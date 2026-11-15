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
import concurrent.futures
import hashlib
import json
import os
import shutil
import time

# importers that read another game the player may or may not have: once they ran at every install (an ownership check
# was never kept around). Since the lead's rule of 2026-10-23 no ownership check is required, so such a mod is kept like
# any other, with where that game is and when its folder last changed in its fingerprint (Nine's Centralfiction frames;
# 7 s at every install before 2026-11-07). An importer that must still run every time says "everyInstall": true.
ALWAYS = set()
OTHER_GAME = {"char-nine": "BBCF_DIR"}      # mod -> the environment variable naming the other game's folder


def other_game_state(mid):
    var = OTHER_GAME.get(mid)
    if not var: return ""
    d = os.environ.get(var) or ""
    try: return "%s %s %d" % (var, d, os.stat(d).st_mtime_ns) if d else "%s none" % var
    except OSError: return "%s %s missing" % (var, d)
# clonecache is tools\clonecache: a store of made clones, not loader code. Hashed with the code, every install that made a
# new clone changed the loader's fingerprint, and the next install made every mod again (seen 2026-11-07: thirteen mods
# nobody had updated were made again because the install before had made Ruby's clones).
SKIP_DIRS = {"__pycache__", "kept", ".git", "clonecache"}
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


def loader_code_tree(root, hasher):
    """The loader's code in a folder: its .py files and the schema snapshots, nothing else. Tools keep stores and build
    output there too (clonecache; tools\\hca, whose C# build writes bin\\ and obj\\ at every DELTARUNE: Party build), and
    any of them in the fingerprint made every mod count as changed at the next install (2026-11-07)."""
    h = hashlib.sha1()
    for dp, dn, fn in os.walk(root):
        dn[:] = sorted(d for d in dn if d not in SKIP_DIRS and d not in ("bin", "obj"))
        for f in sorted(fn):
            p = os.path.join(dp, f); rel = os.path.relpath(p, root).replace("\\", "/")
            if f in NOT_OUTPUT or f.endswith("_test.py"): continue
            if f.endswith(".py") or (rel.startswith("schema/") and f.endswith(".json")):
                h.update(rel.encode("utf-8") + b"\0" + hasher.file(p).encode() + b"\n")
    return h.hexdigest()


# loader files that never take part in making a mod's clones or importer output: the install's own steps, the save
# tools, this bookkeeping and the tests. A loader update that changes only these leaves every kept mod kept; one that
# changes anything else (bbmod.py, bbchar.py, bbrig.py, make_patch.py, the bbtag/bbcf readers, the schema) makes every
# mod again, as before.
NOT_OUTPUT = {"entry_point.py", "pipeline.py", "audit_build.py", "animview.py", "quick.py", "live.py", "savefile.py", "savejson.py",
              "gameslot.py", "modsettings.py"}


def loader_hash(loader_files, hasher):
    h = hashlib.sha1()
    for p in loader_files:
        b = os.path.basename(p)
        if b in NOT_OUTPUT or b.endswith("_test.py"): continue
        h.update((b + "\0" + (loader_code_tree(p, hasher) if os.path.isdir(p) else hasher.file(p)) + "\n").encode())
    return h.hexdigest()


def fingerprint(mid, mods, mdir, settings, build_id, loader, hasher, fps, skip=()):
    """one mod's fingerprint; it includes those of the mods it depends on (fps), and leaves out the files in its folder
    its own build writes (skip: Ruby's sounds step writes gen/audio_map.json at every run)"""
    h = hashlib.sha1()
    h.update(("build %s\nloader %s\nfolder %s\n" % (build_id, loader, hasher.tree(mdir(mid), skip))).encode())
    if mid in OTHER_GAME: h.update(("other game %s\n" % other_game_state(mid)).encode())
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


def mod_stages(order, mods, mdir, out, root, settings, build_id, loader_files, run_clones, run_importers, report, full=False, stages=None):
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
    snap = None                 # stat_map(out) as it is now, once a mod has been made (None: walk the folder)
    clone_adds, import_adds, what = {}, {}, {}
    pending = []                # mods made side by side in their own folders, merged into out in load order (flush)

    def record(mid, store, rec_path, ca, ia, files, seeds, writes, src_before, took):
        """keep a made mod's files (already in out) and its record; returns the record"""
        work = os.path.join(store, "out.new")
        if os.path.exists(work): shutil.rmtree(work)
        os.makedirs(work, exist_ok=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as tp:
            list(tp.map(lambda rel: put(out, work, rel), list(files)))
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
        what[mid] = "made"; clone_adds[mid] = ca; import_adds[mid] = ia
        return rec

    def make_here(mid, store, rec_path, writes):
        """made in out itself, after every mod before it: it may build on their files"""
        nonlocal snap
        t0 = time.time(); before = snap if snap is not None else stat_map(out); src_before = stat_map(mdir(mid))
        ca = run_clones(mid, out)
        ia = run_importers(mid, out) if ca is not None else None
        if ca is None or ia is None:
            what[mid] = "failed"; snap = None
            if os.path.exists(rec_path): os.remove(rec_path)      # never put back a half-made mod
            return
        took = time.time() - t0
        after = stat_map(out); snap = dict(after)
        changed = sorted(f for f, st in after.items() if before.get(f) != st)
        files, seeds = {}, {}
        for rel in changed:
            seeds[rel] = known.get(rel)
            known[rel] = files[rel] = file_sha(os.path.join(out, *rel.split("/")))
        record(mid, store, rec_path, ca, ia, files, seeds, writes, src_before, took)

    def flush():
        """make the pending mods side by side, each in its own empty folder, then lay their files into out in load order.
        Only mods whose last making wrote new files and built on none are pending (see below); if one would now write a
        file an earlier mod left in out, its folder is dropped and it is made in out the usual way."""
        nonlocal snap
        if not pending: return
        jobs = list(pending); pending.clear()
        def one(job):
            mid, store, rec_path, writes = job
            folder = os.path.join(store, "build.tmp")
            if os.path.exists(folder): shutil.rmtree(folder)
            os.makedirs(folder)
            t0 = time.time(); src_before = stat_map(mdir(mid))
            ca = run_clones(mid, folder)
            ia = run_importers(mid, folder) if ca is not None else None
            return folder, ca, ia, src_before, time.time() - t0
        t_all = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(jobs))) as tp:
            results = list(tp.map(one, jobs))
        print("  QUICK %d mods made side by side in %.0f s: %s" % (len(jobs), time.time() - t_all, ", ".join(j[0] for j in jobs)))
        for (mid, store, rec_path, writes), (folder, ca, ia, src_before, took) in zip(jobs, results):
            if ca is None or ia is None:
                what[mid] = "failed"
                if os.path.exists(rec_path): os.remove(rec_path)
                shutil.rmtree(folder, ignore_errors=True); continue
            made = sorted(stat_map(folder))
            if any(rel in known for rel in made):
                print("  QUICK %s: it now writes a file an earlier mod made; making it again in the build folder" % mid)
                shutil.rmtree(folder, ignore_errors=True); make_here(mid, store, rec_path, writes); continue
            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as tp:
                list(tp.map(lambda rel: put(folder, out, rel), made))
            files = {}
            for rel in made:
                known[rel] = files[rel] = file_sha(os.path.join(out, *rel.split("/")))
                if snap is not None:
                    st = os.stat(os.path.join(out, *rel.split("/"))); snap[rel] = (st.st_size, st.st_mtime_ns)
            record(mid, store, rec_path, ca, ia, files, {rel: None for rel in made}, writes, src_before, took)
            shutil.rmtree(folder, ignore_errors=True)

    making = set()              # mods made in this build, so far (a mod waits for its dependencies among them)
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
        kept_out = (rec or {}).get("outDir") or os.path.join(store, "out")
        if (not full and not always and rec and rec.get("fingerprint") == fps[mid] and not moved
                and os.path.isdir(kept_out)):
            flush()                     # the mods before it are in out first, as in load order
            t0 = time.time()
            # copied side by side: a mod's files are its own and copying waits on the disk, not the processor
            # (2026-11-07: eighteen kept mods took 13.5 s one file at a time)
            rels = list(rec["files"])
            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as tp:
                list(tp.map(lambda rel: put(kept_out, out, rel), rels))
            for rel in rels:
                known[rel] = rec["files"][rel]
                if snap is not None:
                    st = os.stat(os.path.join(out, *rel.split("/"))); snap[rel] = (st.st_size, st.st_mtime_ns)
            print("  QUICK %s %s: unchanged since %s, %d files put back in %.1f s (making it took %.0f s)"
                  % (mid, mods[mid].get("version", "?"), rec.get("made", "?"), len(rec["files"]), time.time() - t0, rec.get("took", 0)))
            what[mid] = "kept"; clone_adds[mid] = rec["cloneAdds"]; import_adds[mid] = rec["importAdds"]
            continue
        st = (stages or {}).get(mid)
        if st and not full and not always and not [f for f, h in st[1].get("seeds", {}).items() if known.get(f) != h]:
            # the channel's ready-made stage of this mod (made from the same mod, options, loader and game build): put
            # back as it is, and kept here from now on, so nothing of it is made on this PC
            flush(); t0 = time.time(); sroot, sd = st
            rels = list(sd.get("files", {}))
            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as tp:
                list(tp.map(lambda rel: put(os.path.join(sroot, "out"), out, rel), rels))
            for rel in rels:
                known[rel] = sd["files"][rel]
                if snap is not None:
                    stt = os.stat(os.path.join(out, *rel.split("/"))); snap[rel] = (stt.st_size, stt.st_mtime_ns)
            # kept from now on by reading its files where the channel delivered them (no second copy): a channel update
            # that changes the stage changes the mod or the loader too, so the record no longer matches then
            if os.path.exists(os.path.join(store, "out")): shutil.rmtree(os.path.join(store, "out"))
            os.makedirs(store, exist_ok=True)
            w2 = sd.get("writes", [])
            fps[mid] = fingerprint(mid, mods, mdir, settings, build_id, loader, hasher, fps, w2)
            rec = {"mod": mid, "version": mods[mid].get("version"), "fingerprint": fps[mid], "made": sd.get("made", "?"),
                   "took": sd.get("took", 0), "files": sd.get("files", {}), "seeds": sd.get("seeds", {}), "writes": w2,
                   "cloneAdds": sd.get("cloneAdds"), "importAdds": sd.get("importAdds"), "from": "the channel's ready-made stage",
                   "outDir": os.path.join(sroot, "out")}
            with open(rec_path + ".new", "w", encoding="utf-8") as f: json.dump(rec, f, indent=1)
            os.replace(rec_path + ".new", rec_path)
            print("  QUICK %s %s: the channel's ready-made stage, %d files put back in %.1f s" % (mid, mods[mid].get("version", "?"), len(rels), time.time() - t0))
            what[mid] = "kept"; clone_adds[mid] = rec["cloneAdds"] or {}; import_adds[mid] = rec["importAdds"] or {}
            continue
        if full: why = "full build"
        elif always: why = "its importer runs at every install: " + ", ".join(always)
        elif not rec: why = "not made before"
        elif rec.get("fingerprint") != fps[mid]: why = "changed since %s" % rec.get("made", "?")
        else: why = "it builds on files an earlier mod changed: " + ", ".join(moved[:3])
        print("  QUICK %s %s: making it (%s)" % (mid, mods[mid].get("version", "?"), why))
        # made side by side when its last making only wrote new files (it built on nothing an earlier mod made) and none
        # of the mods it depends on is being made now; otherwise in out, in load order, once the others are laid in
        own = rec is not None and not any(v is not None for v in rec.get("seeds", {}).values())
        deps_made = [d for d in mods[mid].get("dependencies", []) if d in making]
        making.add(mid)
        if own and not always and not deps_made:
            pending.append((mid, store, rec_path, writes))
        else:
            flush(); make_here(mid, store, rec_path, writes)
    flush()
    clone_adds = [clone_adds[m] for m in order if m in clone_adds]
    import_adds = [import_adds[m] for m in order if m in import_adds]
    # the order a full build writes them in: every mod's clones first, then the importers, mod by mod
    adds = {"names": [], "entries": [], "guids": []}
    for a in clone_adds + import_adds:
        for k in adds: adds[k] += a.get(k, [])
    if clone_adds:
        with open(os.path.join(out, "_manifest_add.json"), "w") as f: json.dump(adds, f, indent=1)
    hasher.save()
    # stores of mods no longer in the load order stay: switching a mod back on puts it back without making it
    return what
