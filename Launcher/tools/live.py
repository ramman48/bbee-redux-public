r"""Add or update mods while the game is open (bbmod.py live; the Zenith Terminal, 2026-10-17).

    python bbmod.py live                 build what changed, add it to the game folder, load it into the open game
    python bbmod.py live --no-persist    only load it into the open game; the game folder is left as it is, and the
                                         change lasts until the game closes
    python bbmod.py live --pid <n>       the game process to load into (default: every running copy of this game)

A player who joins an online lobby without a character, or with another version of one, gets it without closing
the game. What is built is compared, bundle by bundle, with what the game folder holds; only the bundles that
differ are written, into a file of their own (ab/m_mod_live_<time>.m), and the game's index (merge.json) points
those bundles there, so the next start of the game has them too. m_mod.m, which the open game is reading, is never
written while it runs. The next install with the game closed puts everything back into m_mod.m and removes the
live files.

The open game is told through a list in <Launcher>/live/<process id>.json, which the zenith-live mod (in shared/,
always installed) reads once a second; its answer comes back in <process id>.done.json. What it cannot carry, and
what then needs the game restarted:
  - switching a mod off, or anything installed for the first time (a mod's characters may have to be taken out of
    the save, which only works with the game closed): refused, close the game and install;
  - a game update (the game data must be read again: setup);
  - new sounds (the game reads its list of sound files when it starts);
  - a bundle new to the game that the game could not be told about (the answer names it).
The save is never touched here: the game holds it while it runs.
"""
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time

WAIT = 20                   # seconds the open game has to answer
REQ = re.compile(r'require\("([A-Za-z0-9_./-]+)"\)')


def sha(b): return hashlib.sha1(b).hexdigest()[:20]


def kind_of(r):
    if r.startswith("data/js/"): return "js"
    if r.startswith(("data/xlsx/", "data/xlsxfixed/")): return "table"
    if r.startswith("data/localization/"): return "locale"
    return "asset"


def ours(m): return m == "m_mod.m" or m.startswith("m_mod_live_")


def installed_hashes(ab, cache):
    """bundle name -> hash of what the game folder holds for it, over m_mod.m and the live files"""
    entries = json.load(open(os.path.join(ab, "merge.json"), encoding="utf-8"))
    by_file = {}
    for e in entries:
        if ours(e["m"]): by_file.setdefault(e["m"], []).append(e)
    stamps = {}
    for m in by_file:
        p = os.path.join(ab, m)
        if os.path.exists(p): st = os.stat(p); stamps[m] = "%d-%d" % (st.st_mtime_ns, st.st_size)
    try:
        c = json.load(open(cache, encoding="utf-8"))
    except (OSError, ValueError):
        c = {}
    out = {}
    for m, ents in by_file.items():
        if m not in stamps: continue
        got = c.get(m)
        if got and got.get("stamp") == stamps[m]:
            hashes = got["hashes"]
        else:
            ents_all = sorted((e for e in entries if e["m"] == m), key=lambda e: int(e["s"]))
            size = os.path.getsize(os.path.join(ab, m)); hashes = {}
            with open(os.path.join(ab, m), "rb") as f:
                for i, e in enumerate(ents_all):
                    s = int(e["s"]); end = int(ents_all[i + 1]["s"]) if i + 1 < len(ents_all) else size
                    f.seek(s); hashes[e["r"]] = sha(f.read(end - s))
            c[m] = {"stamp": stamps[m], "hashes": hashes}
        for e in ents:
            if e["r"] in hashes: out[e["r"]] = hashes[e["r"]]
    c = {m: v for m, v in c.items() if m in stamps}
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    json.dump(c, open(cache, "w", encoding="utf-8"))
    return out


def require_names(jsdir, cache):
    """lower-case module path -> the name the game's own code requires it by (Core/ActorUtil)"""
    try:
        if time.time() - os.path.getmtime(cache) < 7 * 86400: return json.load(open(cache, encoding="utf-8"))
    except (OSError, ValueError):
        pass
    names = {}
    for d, _, fs in os.walk(jsdir):
        for f in fs:
            if not f.endswith(".js"): continue
            try: s = open(os.path.join(d, f), encoding="utf-8", errors="replace").read()
            except OSError: continue
            for n in REQ.findall(s): names.setdefault(n.lower().removesuffix(".js"), n)
    json.dump(names, open(cache, "w", encoding="utf-8"))
    return names


XLSX_DEF = re.compile(r'\bc\((\w+),\$pb\.([\w.]+),\[([^\]]*)\]\)')


def js_tables(jsdir):
    """table name -> how the game's scripts build it ({cls, pb, keys}), read from its Gen/Xlsx.js: scripts keep their
    own copy of a table (built from the bundle at first use), apart from the tables the game's C# side holds"""
    path = next((os.path.join(d, f) for d, _, fs in os.walk(jsdir) for f in fs
                 if f.lower() == "xlsx.js" and os.path.basename(d).lower() == "gen"), None)
    if not path: return {}
    src = open(path + ".orig" if os.path.exists(path + ".orig") else path, encoding="utf-8", errors="replace").read()
    out = {}
    for cls, pb, keys in XLSX_DEF.findall(src):
        try: out[pb.split(".")[-1]] = {"cls": cls, "pb": pb, "keys": json.loads("[" + keys + "]")}
        except ValueError: pass
    return out


def table_raw(path):
    """(asset name, raw bytes) of a table bundle's TextAsset"""
    import UnityPy
    env = UnityPy.load(path)
    for o in env.objects:
        if o.type.name == "TextAsset":
            d = o.read(); s = d.m_Script
            return d.m_Name, (s.encode("utf-8", "surrogateescape") if isinstance(s, str) else bytes(s))
    return None, None


def game_pids(game_dir):
    """process ids of the running BlazblueEntropyEffect.exe started from this game folder"""
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command",
                            "Get-Process BlazblueEntropyEffect -ErrorAction SilentlyContinue | ForEach-Object { \"$($_.Id)|$($_.Path)\" }"],
                           capture_output=True, text=True, timeout=30)
    except Exception:
        return []
    want = os.path.normcase(os.path.realpath(game_dir))
    out = []
    for line in r.stdout.splitlines():
        pid, _, path = line.strip().partition("|")
        if pid.isdigit() and path and os.path.normcase(os.path.realpath(path)).startswith(want): out.append(int(pid))
    return out


def run(bbmod, argv):
    say = print
    persist = "--no-persist" not in argv
    pids = [int(argv[argv.index("--pid") + 1])] if "--pid" in argv else None
    if bbmod.STAGING: say("LIVE REFUSED: BBMOD_PROFILE/BBMOD_OUT set (staging build)"); return 2
    blocked = bbmod.gameslot_block()
    if blocked: say("LIVE REFUSED: " + blocked); return 2
    ab, out, root = bbmod.AB, bbmod.OUT, bbmod.ROOT
    game_dir = os.path.join(root, "game")
    live_dir = os.path.join(root, "live"); os.makedirs(live_dir, exist_ok=True)
    kept = os.path.join(root, "kept", "quick"); os.makedirs(kept, exist_ok=True)

    # what only an install with the game closed may do
    prof = bbmod.load_profile()
    try: inst = json.load(open(bbmod.INSTALLED, encoding="utf-8"))
    except (OSError, ValueError): inst = None
    if not inst:
        say("LIVE REFUSED: nothing is installed yet. The first install needs the game closed."); return 2
    if str(inst.get("gameBuild")) != str(bbmod.game_build()):
        say("LIVE REFUSED: the game was updated since the last install (build %s, now %s). Close the game, run setup, then install."
            % (inst.get("gameBuild"), bbmod.game_build())); return 2
    off = [m for m in inst.get("enabled", []) if m not in prof["enabled"]]
    if off:
        say("LIVE REFUSED: %s would be switched off. Switching a mod off needs the game closed (its characters are taken "
            "out of the save then). Close the game and install." % ", ".join(off)); return 2

    t0 = time.time()
    if not bbmod.build(): say("LIVE: the build stopped with an error (above); nothing was changed."); return 1
    built_s = time.time() - t0

    base = installed_hashes(ab, os.path.join(kept, "installed_hashes.json"))
    rows, blob = [], bytearray()
    for dp, dn, fn in os.walk(out):
        for f in sorted(fn):
            if f.startswith("_") and dp == out: continue
            p = os.path.join(dp, f); r = os.path.relpath(p, out).replace(os.sep, "/")
            data = open(p, "rb").read(); h = sha(data)
            if base.get(r) == h: continue
            rows.append({"r": r, "s": len(blob), "size": len(data), "hash": h, "kind": kind_of(r), "new": r not in base, "path": p})
            blob += data
    versions = {m: str(bbmod.load_mods()[m]["version"]) for m in prof["enabled"] if m in bbmod.load_mods()}
    # a mod counts as changed when it is new, has a new version, or made one of the bundles that differ
    # (Nine's importer runs at every install, but makes the same bundles when nothing of hers changed)
    differ = {r["r"] for r in rows}
    def made_one(m):
        try: return bool(differ & set(json.load(open(os.path.join(kept, m, "quick.json"), encoding="utf-8"))["files"]))
        except (OSError, ValueError, KeyError): return False
    changed_mods = sorted(m for m in prof["enabled"] if m not in inst.get("enabled", []) or inst.get("versions", {}).get(m) != versions.get(m)
                          or made_one(m))
    if not rows:
        say("LIVE: nothing differs from what the game has (built in %.0f s)." % built_s); return 0

    stamp = time.strftime("%Y%m%d_%H%M%S")
    # the changed bundles, one after another, the way the game's own m_*.m files are
    if persist:
        name = "m_mod_live_%s.m" % stamp; container = os.path.join(ab, name)
    else:
        name = None; container = os.path.join(live_dir, "m_live_%s.m" % stamp)
    with open(container + ".new", "wb") as f: f.write(blob)
    os.replace(container + ".new", container)

    restart = []
    if persist:
        mj = os.path.join(ab, "merge.json")
        entries = json.load(open(mj, encoding="utf-8")); idx = {e["r"]: e for e in entries}
        for r in rows:
            e = idx.get(r["r"])
            if e is None: e = {"r": r["r"], "m": name, "s": 0}; entries.append(e); idx[r["r"]] = e
            e["m"] = name; e["s"] = type(e["s"])(r["s"]) if not isinstance(e["s"], str) else str(r["s"])
        with open(mj + ".new", "w", encoding="utf-8") as f: json.dump(entries, f, separators=(",", ":"), ensure_ascii=False)
        os.replace(mj + ".new", mj)
        madd = os.path.join(out, "_manifest_add.json")
        if any(r["new"] for r in rows) and os.path.exists(madd):
            import bbchar; bbchar.apply_manifest_additions(json.load(open(madd)))
        # sound files are named by their content: a changed sound is a new file, and the open game keeps its old ones
        lst = os.path.join(out, "_sounds.json")
        sounds = json.load(open(lst)) if os.path.exists(lst) else {}
        dest = os.path.join(root, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Audio", "zenith")
        new_sounds = [n for n in sounds if not os.path.exists(os.path.join(dest, n))]
        if new_sounds:
            os.makedirs(dest, exist_ok=True)
            for n in new_sounds: shutil.copy2(sounds[n], os.path.join(dest, n))
            restart.append("%d new sound file(s): the game reads its sound list when it starts" % len(new_sounds))
        inst.update({"enabled": prof["enabled"], "versions": versions, "installed": time.strftime("%Y-%m-%d %H:%M:%S"),
                     "live": sorted(set(inst.get("live", []) + [name]))})
        with open(bbmod.INSTALLED, "w") as f: json.dump(inst, f, indent=1)

    # what the open game needs besides the bundles: the scripts as text, the tables as raw rows
    names = require_names(bbmod.JSDIR, os.path.join(kept, "require_names.json"))
    jsout = os.path.join(live_dir, "js_" + stamp); tout = os.path.join(live_dir, "tables_" + stamp)
    scripts = []; jst = js_tables(bbmod.JSDIR)
    for r in rows:
        if r["kind"] == "js":
            logical = r["r"][:-3]                           # data/js/core/actorutil
            src_path = bbmod.js_path(next((lp for lp in _logicals(bbmod) if lp.lower() == logical), logical))
            rel = os.path.relpath(src_path, bbmod.JSDIR).replace(os.sep, "/")[:-3]
            req = names.get(rel.lower(), rel)
            os.makedirs(jsout, exist_ok=True)
            dst = os.path.join(jsout, rel.replace("/", "_") + ".js"); shutil.copyfile(src_path, dst)
            scripts.append({"logical": logical, "name": req, "file": dst.replace(os.sep, "/"), "hash": r["hash"]})
        elif r["kind"] == "table":
            an, raw = table_raw(r["path"])
            if an:
                os.makedirs(tout, exist_ok=True)
                tf = os.path.join(tout, an + ".bin"); open(tf, "wb").write(raw)
                r["table"] = an; r["raw"] = tf.replace(os.sep, "/")
                r["loader"] = "XlsxLoader_" + (an[:-len("FixedPointWrap")] if an.endswith("FixedPointWrap") else an)
                if an in jst: r["js"] = jst[an]
    for r in rows: del r["path"]
    madd = os.path.join(out, "_manifest_add.json")
    listing = {"id": stamp, "time": time.strftime("%Y-%m-%d %H:%M:%S"), "file": container.replace(os.sep, "/"), "mods": changed_mods,
               "rows": rows, "scripts": scripts, "manifestAdd": json.load(open(madd)) if os.path.exists(madd) else None}
    by = {}
    for r in rows: by.setdefault(r["kind"], []).append(r)
    say("LIVE: %d bundle(s) differ (%s), %.1f MB; mods: %s" % (len(rows), ", ".join("%d %s" % (len(v), k) for k, v in sorted(by.items())),
                                                             len(blob) / 1e6, ", ".join(changed_mods) or "none"))
    if persist: say("LIVE: written to the game folder (%s, merge.json); the next start of the game has it" % name)

    targets = pids if pids is not None else game_pids(game_dir)
    if not targets:
        say("LIVE: the game is not running" + ("; it reads everything at its next start." if persist else "; nothing was loaded."))
        return 0
    answers = {}
    for pid in targets:
        done = os.path.join(live_dir, "%d.done.json" % pid)
        if os.path.exists(done): os.remove(done)
        lp = os.path.join(live_dir, "%d.json" % pid)
        with open(lp + ".new", "w", encoding="utf-8") as f: json.dump(listing, f, ensure_ascii=False)
        os.replace(lp + ".new", lp)
    end = time.time() + WAIT
    while time.time() < end and len(answers) < len(targets):
        for pid in targets:
            done = os.path.join(live_dir, "%d.done.json" % pid)
            if pid in answers or not os.path.exists(done): continue
            try:
                a = json.load(open(done, encoding="utf-8"))
                if a.get("id") == stamp: answers[pid] = a
            except (OSError, ValueError):
                pass
        time.sleep(0.3)
    ok = True
    for pid in targets:
        a = answers.get(pid)
        if not a:
            ok = False
            say("LIVE: the game (process %d) did not answer in %d s. It loads mods once their scripts run (from the title "
                "screen on); if it still has not, restart the game: everything is in the game folder." % (pid, WAIT)); continue
        say("LIVE: loaded into the game (process %d): %d script(s), %d bundle(s), %d table(s) filled again%s"
            % (pid, len(a.get("scripts", [])), a.get("bundles", 0), a.get("tables", 0),
               ", %d new to the game" % a["announced"] if a.get("announced") else ""))
        for s in a.get("failed", []):
            ok = False; restart.append(s)
    if restart:
        say("LIVE: restart the game to finish: " + "; ".join(restart))
    elif ok:
        say("LIVE: done; no restart needed. What is on screen now keeps what it was made from: pick the character again.")
    # files older than a day that no list names any more
    for old in glob.glob(os.path.join(live_dir, "m_live_*.m")) + glob.glob(os.path.join(live_dir, "js_*")) + glob.glob(os.path.join(live_dir, "tables_*")):
        if time.time() - os.path.getmtime(old) > 86400:
            shutil.rmtree(old, ignore_errors=True) if os.path.isdir(old) else os.remove(old)
    return 0 if ok and not restart else 3


def _logicals(bbmod):
    """the JS module names the enabled mods touch, with their case (data/js/core/ActorUtil)"""
    mods = bbmod.load_mods(); order = bbmod.resolve_order(mods, bbmod.load_profile()["enabled"])
    out = [bbmod.REGISTRY_MODULE]
    for mid in order:
        c = mods[mid].get("content", {})
        out += [s["file"] for s in c.get("js", [])] + list(c.get("jsFiles", {}))
    return out


def remove_live_files(ab):
    """after an install with the game closed: m_mod.m holds everything again, the live files are not used"""
    n = 0
    for p in glob.glob(os.path.join(ab, "m_mod_live_*.m")):
        try: os.remove(p); n += 1
        except OSError: pass
    return n


if __name__ == "__main__":
    sys.exit("run it as: python bbmod.py live")
