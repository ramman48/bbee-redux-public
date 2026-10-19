r"""audit_build.py -- will our mods still apply to the INSTALLED game build?

Read-only. Nothing in decoded\ or the game folder is written. For every enabled mod:

  * every JS anchor is looked up in that module AS SHIPPED IN THE CURRENT BUILD (sliced straight from the live
    game, NOAH-decoded with the key recovered from the "use strict" plaintext) and reported as
    OK (exactly once) / MISSING / AMBIGUOUS (more than once);
  * every JS module is compared against the copy we decoded from the old build, so a changed module is flagged
    even when its anchors happen to survive;
  * every table the mod edits is compared, old build vs current build, at the raw-bytes level.

  python audit_build.py [--json out.json] [--mods a,b]    (--mods: audit those mods instead of the enabled set)

Anchors are data, not code: a MISSING anchor means that patch would not apply and the build would abort.
"""
import os, sys, json, hashlib

ROOT = os.path.dirname(os.path.abspath(__file__))
import glob as _g
_prev = sorted(_g.glob(os.path.join(ROOT, "decoded_b*")))
OLD_DEC = _prev[-1] if _prev else os.path.join(ROOT, "decoded")
sys.argv_backup = sys.argv; sys.argv = ["make_patch.py"]
MP = {}
exec(open(os.path.join(ROOT, "make_patch.py"), encoding="utf-8").read().split("\ncmd = ")[0], MP)
sys.argv = sys.argv_backup
import UnityPy


def noah_decode(b):
    if b[:4] != b"NOAH": return b
    key = int.from_bytes(bytes(b[4 + i] ^ b'"use'[i] for i in range(4)), "little")
    k = key.to_bytes(4, "little"); out = bytearray(b[4:])
    for i in range(len(out)): out[i] ^= k[(i + (i >> 2)) & 3]
    return bytes(out)


def live_textasset(logical):
    """the TextAsset payload of a bundle, as the INSTALLED build ships it"""
    env = UnityPy.load(MP["slice_bundle"](MP["find_entry"](logical.lower() + ".ab")))
    for o in env.objects:
        if o.type.name == "TextAsset":
            d = o.read(); s = d.m_Script
            return s.encode("utf-8", "surrogateescape") if isinstance(s, str) else bytes(s)
    return None


def old_js(logical):
    """previous-build stock module, decoded from the RAW extraction. Never from decoded/*.js.orig: on 2026-09-27 one
    of those (PlayerTriggerUtil) was found to contain our own edits, captured before the loader first snapshotted it."""
    p = os.path.join(OLD_DEC.replace("decoded", "extracted_raw"), *logical.split("/")) + ".bin"
    return noah_decode(open(p, "rb").read()) if os.path.exists(p) else None


def main():
    enabled, seen = [], set()
    for p in (os.path.join(ROOT, "shared", "profile.json"), os.path.join(ROOT, "mods", "profile.json")):
        if os.path.exists(p):
            for m in json.load(open(p, encoding="utf-8")).get("enabled", []):
                if m not in seen:
                    seen.add(m)
                    enabled.append(m)
    report = {"build": MP["current_build"](), "mods": {}}
    cache = {}
    ids = sys.argv[sys.argv.index("--mods") + 1].split(",") if "--mods" in sys.argv else enabled
    for mid in ids:
        mj = os.path.join(ROOT, "shared", mid, "mod.json")
        if not os.path.exists(mj):
            mj = os.path.join(ROOT, "mods", mid, "mod.json")
        if not os.path.exists(mj):
            continue
        d = json.load(open(mj, encoding="utf-8"))
        c = d.get("content", {}); r = {"js": [], "jsFiles": [], "tables": []}
        for spec in c.get("js", []):
            lg = spec["file"]
            if lg not in cache:
                try: cache[lg] = noah_decode(live_textasset(lg) or b"").decode("utf-8", "replace")
                except Exception as e: cache[lg] = None; print("  cannot read", lg, e)
            live = cache[lg]; o = old_js(lg)
            same = (o is not None and live is not None and
                    hashlib.md5(o).hexdigest() == hashlib.md5(live.encode("utf-8", "replace")).hexdigest())
            for old, _new in spec.get("replace", []):
                n = live.count(old) if live else -1
                r["js"].append({"file": lg, "moduleUnchanged": same,
                                "anchor": old[:70], "count": n,
                                "status": "OK" if n == 1 else ("MISSING" if n == 0 else ("AMBIGUOUS" if n > 1 else "UNREADABLE"))})
            if spec.get("append") or spec.get("appendFile"):
                r["js"].append({"file": lg, "moduleUnchanged": same, "anchor": "(append)", "count": 1, "status": "OK"})
        for lg, rel in c.get("jsFiles", {}).items():
            try: live = noah_decode(live_textasset(lg) or b"")
            except Exception: live = None
            o = old_js(lg)
            r["jsFiles"].append({"file": lg, "wholeFileReplacement": rel,
                                 "moduleUnchangedSinceOldBuild": bool(o and live and hashlib.md5(o).digest() == hashlib.md5(live).digest())})
        for tname in c.get("tables", {}):
            lg = "data/xlsx/" + tname.lower()
            try: live = live_textasset(lg)
            except Exception: live = None
            op = os.path.join(OLD_DEC.replace("decoded", "extracted_raw"), "data", "xlsx", tname + ".bin")
            old = open(op, "rb").read() if os.path.exists(op) else None
            r["tables"].append({"table": tname, "liveBytes": len(live) if live else None,
                                "oldBytes": len(old) if old else None,
                                "unchanged": bool(live and old and live == old)})
        report["mods"][mid] = r
    return report


if __name__ == "__main__":
    rep = main()
    out = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    if out: json.dump(rep, open(out, "w", encoding="utf-8"), indent=1)
    print("installed build:", rep["build"])
    for mid, r in rep["mods"].items():
        bad = [j for j in r["js"] if j["status"] != "OK"]
        chg = sorted({j["file"].split("/")[-1] for j in r["js"] if not j["moduleUnchanged"]})
        tchg = [t["table"] for t in r["tables"] if not t["unchanged"]]
        wf = [f["file"].split("/")[-1] for f in r["jsFiles"] if not f["moduleUnchangedSinceOldBuild"]]
        print("%-24s anchors %3d ok / %2d bad | js modules changed: %-40s | tables changed: %s%s" % (
            mid, sum(1 for j in r["js"] if j["status"] == "OK"), len(bad),
            ",".join(chg)[:40] or "-", ",".join(tchg) or "-",
            (" | WHOLE-FILE replacements over changed modules: " + ",".join(wf)) if wf else ""))
        for j in bad: print("     %-9s %s :: %r" % (j["status"], j["file"].split("/")[-1], j["anchor"]))
