r"""Build only the mods that changed (bbmod.py build / install; 2026-10-17).

Most of an install's time goes into each mod's own work: its clones (rigClones, bundleClones) and its importers,
which make bundles from the player's own game files. That work depends only on the mod itself, the mods it depends
on, the game build and the loader, so it is kept per mod in kept/quick/<mod>/ with a fingerprint of all of those,
and made again only when the fingerprint changes. The parts several mods write into (tables, scripts, text, edits of
the game's own assets) are composed again at every build, as before: they take seconds.

    kept/quick/<mod>/out/              the files the mod's clones and importers made, as they were made
    kept/quick/<mod>/quick.json        its fingerprint, the manifest additions, the time it took to make

A mod's fingerprint is the content of every file in its folder (read again only when a file's size or time
changed), the options chosen for it, its content after those options, the fingerprints of the mods it depends on,
the game build and the loader's own code (every .py next to bbmod.py and in tools/).

An importer that has to run at every install says so with "everyInstall": true in its mod.json entry (one that
checks what the player owns, for example); its mod's part is then made at every install. A full build
(`bbmod.py install --full`, or BBMOD_FULL=1) makes everything again and replaces what is kept.
"""
import hashlib
import json
import os
import shutil
import time

# importers that read another game the player may or may not own: they run at every install whatever their mod
# says, so an ownership check is never kept around (Nine's Centralfiction frames)
ALWAYS = {("char-nine", "import_cf.py")}
SKIP_DIRS = {"__pycache__", "kept", ".git"}
STAT_CACHE = "_hashes.json"


class Hasher:
    """content hashes of files, kept by (size, time) so an unchanged file is not read again"""

    def __init__(self, store):
        self.path = os.path.join(store, STAT_CACHE)
        try:
            self.seen = json.load(open(self.path, encoding="utf-8"))
        except (OSError, ValueError):
            self.seen = {}
        self.used = {}

    def file(self, p):
        st = os.stat(p)
        key = os.path.normcase(os.path.abspath(p))
        stamp = "%d-%d" % (st.st_size, st.st_mtime_ns)
        got = self.seen.get(key)
        if not got or got[0] != stamp:
            h = hashlib.sha1()
            with open(p, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
            got = [stamp, h.hexdigest()]
        self.used[key] = got
        return got[1]

    def tree(self, root, skip=()):
        h = hashlib.sha1(); skip = set(skip)
        for dp, dn, fn in os.walk(root):
            dn[:] = sorted(d for d in dn if d not in SKIP_DIRS)
            for f in sorted(fn):
                if f.endswith(".pyc"): continue
                p = os.path.join(dp, f); rel = os.path.relpath(p, root).replace("\\", "/")
                if rel in skip: continue
                h.update(rel.encode("utf-8") + b"\0" + self.file(p).encode() + b"\n")
        return h.hexdigest()

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        merged = dict(self.seen); merged.update(self.used)
        tmp = self.path + ".new"
        with open(tmp, "w", encoding="utf-8") as f: json.dump(merged, f)
        os.replace(tmp, self.path)


def every_install(mid, mod):
    return [s["script"] for s in mod.get("content", {}).get("importers", [])
            if s.get("everyInstall") or (mid, os.path.basename(s["script"])) in ALWAYS]


def loader_hash(loader_files, hasher):
    h = hashlib.sha1()
    for p in loader_files:
        h.update((os.path.basename(p) + "\0" + (hasher.tree(p) if os.path.isdir(p) else hasher.file(p)) + "\n").encode())
    return h.hexdigest()


def fingerprint(mid, mods, mdir, settings, build_id, loader, hasher, fps, skip=()):
    """one mod's fingerprint; it includes those of the mods it depends on (fps), and leaves out the files in its folder
    its own build writes (skip: Ruby's sounds step writes gen/audio_map.json at every run)"""
    h = hashlib.sha1()
    h.update(("build %s\nloader %s\nfolder %s\n" % (build_id, loader, hasher.tree(mdir(mid), skip))).encode())
    h.update(json.dumps([settings.get(mid), mods[mid].get("content", {})], sort_keys=True, ensure_ascii=False, default=str).encode("utf-8"))
    for d in mods[mid].get("dependencies", []):
        h.update(("dep %s %s\n" % (d, fps.get(d, "absent"))).encode())
    return h.hexdigest()


def has_work(mod):
    c = mod.get("content", {})
    return bool(c.get("rigClones") or c.get("bundleClones") or c.get("importers"))




def stat_map(root):
    """relative path -> (size, time) of every file in a build folder, the folder's own records (_*.json) left out"""
    out = {}
    for dp, dn, fn in os.walk(root):
        for f in fn:
            if f.startswith("_") and dp == root: continue
            p = os.path.join(dp, f); st = os.stat(p)
            out[os.path.relpath(p, root).replace(os.sep, "/")] = (st.st_size, st.st_mtime_ns)
    return out


def file_sha(p):
    h = hashlib.sha1()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()


def put(src_root, dst_root, rel):
    dst = os.path.join(dst_root, *rel.split("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(os.path.join(src_root, *rel.split("/")), dst)    # a copy, never a link: later steps edit files in place


def mod_stages(order, mods, mdir, out, root, settings, build_id, loader_files, run_clones, run_importers, report, full=False):
    """Make every mod's clones and importer output in the build folder out, in load order, making again only the mods
    that changed; the others are put back from kept/quick/<mod>/.

    Importers may build on what an earlier mod's importer left in the build folder (Ruby's sounds are added to the
    sound list DELTARUNE: Party's importer wrote), so a mod is made in out itself, after the mods before it, and its
    record keeps, for every file it changed, the version of that file it started from. A kept mod is put back only
    when those versions are still the ones in the folder; otherwise it is made again.

    run_clones(mid, folder) and run_importers(mid, folder) do one mod's work and return its manifest additions
    ({names, entries, guids}), or None when they failed (they put the error in report).
    Returns {mod: "kept" | "made" | "none" | "failed"} and writes out/_manifest_add.json as a full build does.
    """
    store_root = os.path.join(root, "kept", "quick")
    os.makedirs(store_root, exist_ok=True)
    hasher = Hasher(store_root)
    loader = loader_hash(loader_files, hasher)
    fps = {}
    known = {}                  # relative path -> sha1 of the version now in out (a seed of None: not there yet)
    clone_adds, import_adds, what = [], [], {}
    for mid in order:
        store = os.path.join(store_root, mid); rec_path = os.path.join(store, "quick.json")
        rec = None
        try: rec = json.load(open(rec_path, encoding="utf-8"))
        except (OSError, ValueError): pass
        writes = (rec or {}).get("writes", [])
        fps[mid] = fingerprint(mid, mods, mdir, settings, build_id, loader, hasher, fps, writes)
        if not has_work(mods[mid]): what[mid] = "none"; continue
        always = every_install(mid, mods[mid])
        moved = [f for f, h in (rec or {}).get("seeds", {}).items() if known.get(f) != h]
        if (not full and not always and rec and rec.get("fingerprint") == fps[mid] and not moved
                and os.path.isdir(os.path.join(store, "out"))):
            t0 = time.time()
            for rel, h in rec["files"].items():
                put(os.path.join(store, "out"), out, rel); known[rel] = h
            print("  QUICK %s %s: unchanged since %s, %d files put back in %.1f s (making it took %.0f s)"
                  % (mid, mods[mid].get("version", "?"), rec.get("made", "?"), len(rec["files"]), time.time() - t0, rec.get("took", 0)))
            what[mid] = "kept"
        else:
            if full: why = "full build"
            elif always: why = "its importer runs at every install: " + ", ".join(always)
            elif not rec: why = "not made before"
            elif rec.get("fingerprint") != fps[mid]: why = "changed since %s" % rec.get("made", "?")
            else: why = "it builds on files an earlier mod changed: " + ", ".join(moved[:3])
            print("  QUICK %s %s: making it (%s)" % (mid, mods[mid].get("version", "?"), why))
            t0 = time.time(); before = stat_map(out); src_before = stat_map(mdir(mid))
            ca = run_clones(mid, out)
            ia = run_importers(mid, out) if ca is not None else None
            if ca is None or ia is None:
                what[mid] = "failed"
                if os.path.exists(rec_path): os.remove(rec_path)      # never put back a half-made mod
                continue
            took = time.time() - t0
            after = stat_map(out)
            changed = sorted(f for f, st in after.items() if before.get(f) != st)
            files, seeds = {}, {}
            work = os.path.join(store, "out.new")
            if os.path.exists(work): shutil.rmtree(work)
            for rel in changed:
                seeds[rel] = known.get(rel)
                put(out, work, rel)
                known[rel] = files[rel] = file_sha(os.path.join(out, *rel.split("/")))
            os.makedirs(work, exist_ok=True)
            old = os.path.join(store, "out")
            if os.path.exists(old): shutil.rmtree(old)
            os.replace(work, old)
            # files the mod's own build wrote into its folder are left out of its fingerprint from now on
            src_after = stat_map(mdir(mid))
            writes = sorted(set(writes) | {f for f, st in src_after.items() if src_before.get(f) != st})
            fps[mid] = fingerprint(mid, mods, mdir, settings, build_id, loader, hasher, fps, writes)
            rec = {"mod": mid, "version": mods[mid].get("version"), "fingerprint": fps[mid], "made": time.strftime("%Y-%m-%d %H:%M:%S"),
                   "took": round(took, 1), "files": files, "seeds": seeds, "writes": writes,
                   "cloneAdds": ca, "importAdds": ia}
            with open(rec_path + ".new", "w", encoding="utf-8") as f: json.dump(rec, f, indent=1)
            os.replace(rec_path + ".new", rec_path)
            print("  QUICK %s: made in %.0f s, %d files" % (mid, took, len(files)))
            what[mid] = "made"
        clone_adds.append(rec["cloneAdds"]); import_adds.append(rec["importAdds"])
    # the order a full build writes them in: every mod's clones first, then the importers, mod by mod
    adds = {"names": [], "entries": [], "guids": []}
    for a in clone_adds + import_adds:
        for k in adds: adds[k] += a.get(k, [])
    if clone_adds:
        with open(os.path.join(out, "_manifest_add.json"), "w") as f: json.dump(adds, f, indent=1)
    hasher.save()
    # stores of mods no longer in the load order stay: switching a mod back on puts it back without making it
    return what
