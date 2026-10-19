"""Kept work: what a mod's importer made last time, put back instead of made again.

An importer writes files into the build folder and hands the loader its manifest additions. When nothing it reads
has changed since the last install, that is the same work on the same input. This keeps the result of a run and
puts it back the next time, in a second or two.

For a mod author there are two ways to use it:

1. The importer checks nothing that has to be checked at every install, and what it makes depends only on the
   mod's own files, the loader and the game's build. Then say so in mod.json and write no code:

       "importers": [{"script": "fx/import_fx.py", "keep": true}]

   The loader keeps and puts back that importer's whole output without starting the script.

2. The importer has a check that must run every time (ownership of another game, a file the player has to have),
   or reads something outside the mod. Then it runs every time, does its check FIRST, and wraps the slow part:

       import kept
       adds = kept.work("char-example", out, make,              # make() writes into `out`, returns the additions
                        reads=[HERE, other_game_folder],         # every folder and file the work reads
                        says=[game_build, some_setting])         # anything else the result depends on

   `reads` is compared by each file's path, size and time, so a changed file makes the work run again; `says` by
   value. If in doubt, name more: a wrong hit gives a player an old build, a miss only costs time.
   A file the work itself writes inside a folder it reads would make every run look new: name it in
   `skip=["gen/made.json"]` (its path inside the folder), and it is left out of the comparison.

What is kept: the files the work added to or changed in the build folder, and what it returned (JSON). One result
per name (the newest); a new one replaces the old. Where: <loader>/kept. BBMOD_NOKEEP=1 switches it off, and
deleting the folder is always safe.

Not kept, so that a hit can never differ from a run: work that removed a file from the build folder, and work that
raised an error.
"""
import hashlib
import json
import os
import shutil
import time

HOME = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kept")
SKIP_DIRS = ("__pycache__", ".git")
VERSION = "kept/2"           # 2: a result records the starting versions of the build-folder files it changed


def _walk(path):
    """every file under a folder (or the file itself) as (relative path, size, time), in a fixed order"""
    if os.path.isfile(path):
        st = os.stat(path)
        return [(os.path.basename(path), st.st_size, st.st_mtime_ns)]
    out = []
    for folder, dirs, files in os.walk(path):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(files):
            if name.endswith((".pyc", ".pyo")): continue
            full = os.path.join(folder, name)
            try: st = os.stat(full)
            except OSError: continue
            out.append((os.path.relpath(full, path).replace("\\", "/"), st.st_size, st.st_mtime_ns))
    return out


def signature(reads=(), says=(), skip=()):
    """one word for everything the work depends on"""
    h = hashlib.sha256(VERSION.encode()); skip = {s.replace("\\", "/") for s in skip}
    for path in reads:
        path = os.path.abspath(path)
        h.update(b"\0read\0" + os.path.normcase(path).encode("utf-8", "replace"))
        if not os.path.exists(path): h.update(b"\0absent"); continue
        for rel, size, when in _walk(path):
            if rel not in skip: h.update(("\0%s\0%d\0%d" % (rel, size, when)).encode("utf-8", "replace"))
    h.update(b"\0says\0" + json.dumps(list(says), sort_keys=True, default=str).encode())
    return h.hexdigest()[:32]


def _snapshot(out):
    return {rel: (size, when) for rel, size, when in _walk(out)} if os.path.isdir(out) else {}


def _safe(name):
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)[:80] or "work"


def off():
    return os.environ.get("BBMOD_NOKEEP") == "1"


def look(name, key, home=None):
    """the kept result for this name and key as (folder, record), or None"""
    folder = os.path.join(home or HOME, _safe(name))
    try:
        with open(os.path.join(folder, "kept.json"), encoding="utf-8") as f: record = json.load(f)
    except (OSError, ValueError):
        return None
    if record.get("key") != key or record.get("version") != VERSION: return None
    for rel, size in record["files"]:
        try:
            if os.path.getsize(os.path.join(folder, "files", *rel.split("/"))) != size: return None
        except OSError:
            return None                                   # a kept file is gone or cut short: make it again
    return folder, record


def put_back(found, out):
    """the kept files copied into the build folder; -> what the work returned"""
    folder, record = found
    for rel, _ in record["files"]:
        dest = os.path.join(out, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(os.path.join(folder, "files", *rel.split("/")), dest)
    return record["result"]


def _sha_of(path):
    """the content hash of a file, or None when it is not there"""
    try:
        h = hashlib.sha1()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def keep(name, key, out, before, result, home=None, took=0.0, starts=None):
    """Store what changed in `out` since the snapshot `before`. -> how many files, or -1 when it was not kept.
    starts: content hashes of the files that were in `out` before the work; those it changed are recorded, so the
    result is put back only onto the same versions of them."""
    after = _snapshot(out)
    if any(rel not in after for rel in before): return -1           # the work removed something: never kept
    changed = sorted(rel for rel, mark in after.items() if before.get(rel) != mark)
    try: json.dumps(result)
    except (TypeError, ValueError): return -1
    folder = os.path.join(home or HOME, _safe(name)); fresh = folder + ".new"
    shutil.rmtree(fresh, ignore_errors=True)
    try:
        for rel in changed:
            dest = os.path.join(fresh, "files", *rel.split("/"))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(os.path.join(out, *rel.split("/")), dest)
        os.makedirs(fresh, exist_ok=True)
        record = {"version": VERSION, "key": key, "name": name, "made": time.strftime("%Y-%m-%d %H:%M:%S"), "took": round(took, 1),
                  "files": [[rel, after[rel][0]] for rel in changed], "result": result,
                  "starts": {rel: starts[rel] for rel in changed if starts and rel in starts}}
        with open(os.path.join(fresh, "kept.json"), "w", encoding="utf-8") as f: json.dump(record, f)
        shutil.rmtree(folder, ignore_errors=True)
        os.replace(fresh, folder)
    except OSError:
        shutil.rmtree(fresh, ignore_errors=True)                     # a full disk: the build itself is unharmed
        return -1
    return len(changed)


def work(name, out, make, reads=(), says=(), home=None, tell=print, skip=()):
    """make()'s result, from the kept copy when nothing in `reads` and `says` changed since it was kept.
    make() writes its files into `out` and returns something JSON can hold."""
    if off(): return make()
    key = signature(reads, says, skip)
    found = look(name, key, home)
    # a file the work changed that an earlier step had left in the build folder (one mod's sounds added to the sound
    # list another mod's importer wrote) is part of its input too: put back only onto the same starting version
    moved = [rel for rel, h in (found[1].get("starts", {}) if found else {}).items() if _sha_of(os.path.join(out, *rel.split("/"))) != h]
    if found and not moved:
        start = time.time(); result = put_back(found, out)
        if tell: tell("  %s: kept from %s, %d files put back in %.1f s (it took %.0f s to make)"
                      % (name, found[1].get("made", "?"), len(found[1]["files"]), time.time() - start, found[1].get("took", 0)))
        return result
    if moved and tell: tell("  %s: made again: it builds on %s, which an earlier step changed" % (name, ", ".join(moved[:3])))
    before = _snapshot(out); start = time.time()
    starts = {rel: _sha_of(os.path.join(out, *rel.split("/"))) for rel in before}
    result = make()
    if signature(reads, says, skip) != key:
        # the result belongs to no one state of what it reads, so it is not kept; an author sees why
        if tell: tell("  %s: made in %.0f s, not kept: something it reads changed while it ran (a file it writes "
                      "inside a folder named in `reads` belongs in `skip`)" % (name, time.time() - start))
        return result
    count = keep(name, key, out, before, result, home, time.time() - start, starts)
    if tell: tell("  %s: made in %.0f s%s" % (name, time.time() - start, (", %d files kept for next time" % count) if count >= 0 else ", not kept"))
    return result
