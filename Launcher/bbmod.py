r"""bbmod.py -- BlazBlue Entropy Effect mod loader / composer (Steam build, merged-AssetBundle route).

usage:  python bbmod.py status                 game build, installed state, enabled mods
        python bbmod.py list                   all mods in mods\, enabled or not
        python bbmod.py enable <id> [<id>..]   / disable <id>..     edit mods\profile.json
        python bbmod.py build                  compose enabled mods -> patch_out (conflict detection, node --check)
        python bbmod.py install                build + write ab\m_mod.m + repoint merge.json (game must be closed)
        python bbmod.py uninstall              restore pristine merge.json, delete m_mod.m
        python bbmod.py doctor                 sanity checks + last Player.log / modlog errors
        python bbmod.py new <id>               scaffold mods\<id>\mod.json

A mod is a folder mods\<id>\ with mod.json:
{ "id": "my-mod", "name": "...", "version": "0.1.0", "author": "...", "description": "...",
  "gameBuilds": ["24904166"],            # Steam buildids this mod was verified on ("*" = any, warns)
  "dependencies": ["bbee-devtools"],    # load order = dependencies first
  "content": {
    "tables": { "BlessConf": [ { "Id": 3222, "Faction": 302, ... } ] },   # row overrides, matched by key fields
                                                                          # (Idx+Lvl, Id[+Quality]); "$delete": true removes; "$new": true inserts
    "locale": { "enu": { "TriggerName_32221": "Attack Speed Boon" }, "chs": {...} },
    "js": [ { "file": "data/js/core/ActorUtil", "replace": [["old exact text", "new text"]], "append": "code", "appendFile": "files/x.js" } ],
    "jsFiles": { "data/js/window/PdAssistant": "files/PdAssistant.js" },     # whole-file replacement (conflicts with any other edit of that file)
    "movies": [ { "name": "MyMod/intro", "file": "files/intro.e.usm",        # a movie of the mod's own: install copies it to
                  "size": 432504, "duration": 5.0, "w": 2560, "h": 1440 } ]  # StreamingAssets\Movie\<name>.e.usm and lists it in MovieData.d;
                                                                             # uninstall takes both out again (see install_movies)
  },
  "settings": [ { "id": "voice", "name": "Voice", "default": "jp", "options": [ { "value": "jp", "label": "JAPANESE" },
                  { "value": "en", "label": "ENGLISH", "content": { ...laid over "content" when chosen... } } ] } ]
                                                                          # choices the player makes; see tools\modsettings.py
}
Conflicts (two mods writing the same row field / locale key / js anchor / js file) abort the build with a report.
"""
import tempfile, os, sys, json, shutil, subprocess, re, struct, glob, time, hashlib

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(errors="backslashreplace")
    except Exception: pass
ROOT = os.path.dirname(os.path.abspath(__file__))
SHARED = os.path.join(ROOT, "shared")
MODS = os.path.join(ROOT, "mods"); INSTALLED = os.path.join(MODS, "installed.json")


PROFILE = os.environ.get("BBMOD_PROFILE") or os.path.join(MODS, "profile.json")
STAGING = bool(os.environ.get("BBMOD_PROFILE") or os.environ.get("BBMOD_OUT"))
DEC = os.path.join(ROOT, "decoded"); TABLES = os.path.join(DEC, "tables"); JSDIR = os.path.join(DEC, "data", "js")
OUT = os.environ.get("BBMOD_OUT") or os.path.join(ROOT, "patch_out"); RAW = os.path.join(ROOT, "extracted_raw")
AB = os.path.join(ROOT, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "ab")
def _steam_manifest(root):
    """<library>/steamapps/common/<game>  ->  <library>/steamapps/appmanifest_2273430.acf (any Steam library)"""
    try:
        g = os.path.realpath(os.path.join(root, "game"))
        cand = os.path.join(os.path.dirname(os.path.dirname(g)), "appmanifest_2273430.acf")
        if os.path.exists(cand): return cand
    except Exception: pass
    return r"C:\Program Files (x86)\Steam\steamapps\appmanifest_2273430.acf"
STEAM_MANIFEST = _steam_manifest(ROOT)
SLOW_IMPORTER = 10          # seconds: an importer slower than this that keeps nothing gets a note in the build log
PLAYER_LOG = os.path.join(os.environ.get("ZENITH_SAVE_ROOT") or os.path.expandvars(r"%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect"), "Player" + ".log")
NODE = "node"
NODE_OLDEST = 18            # an older Node.js cannot read the game's own scripts, so its "syntax error" says nothing about a mod
_node = []
def node_check():
    """(usable, why not): whether this PC's Node.js can double-check the patched scripts. The check is an extra: the
    game does not use Node.js. A player with Node.js 10 had every install stopped at the first script (2026-10-12)."""
    if not _node:
        if shutil.which(NODE) is None: _node.append((False, "Node.js not installed"))
        else:
            try:
                said = subprocess.run([NODE, "--version"], capture_output=True, text=True, errors="replace", timeout=20).stdout.strip()
                major = int(re.match(r"v?(\d+)", said).group(1))
                _node.append((True, "") if major >= NODE_OLDEST else (False, "this PC's Node.js %s is older than %d" % (said, NODE_OLDEST)))
            except Exception:
                _node.append((False, "this PC's Node.js did not answer"))
    return _node[0]


sys.argv_backup = sys.argv; sys.argv = ["make_patch.py"]
_mp = {"__file__": os.path.join(ROOT, "make_patch.py")}
exec(open(_mp["__file__"], encoding="utf-8").read().split("\ncmd = ")[0], _mp)
sys.argv = sys.argv_backup
encode_table, verify_table, encode_fixed_table = _mp["encode_table"], _mp["verify_table"], _mp["encode_fixed_table"]
rebuild_bundle, slice_bundle, find_entry, noah_xor = _mp["rebuild_bundle"], _mp["slice_bundle"], _mp["find_entry"], _mp["noah_xor"]
SCHEMA, JSKEYS = _mp["SCHEMA"], _mp["JSKEYS"]

def game_build():
    try:
        m = re.search(r'"buildid"\s+"(\d+)"', open(STEAM_MANIFEST, encoding="utf-8").read()); return m.group(1) if m else "?"
    except OSError: return "?"


def load_profile():
    if os.environ.get("BBMOD_PROFILE"):
        if os.path.exists(PROFILE): return json.load(open(PROFILE, encoding="utf-8"))
        return {"enabled": []}
    enabled, seen = [], set()
    for p in (os.path.join(SHARED, "profile.json"), os.path.join(MODS, "profile.json")):
        if os.path.exists(p):
            for m in json.load(open(p, encoding="utf-8")).get("enabled", []):
                if m not in seen:
                    seen.add(m)
                    enabled.append(m)
    return {"enabled": enabled}
MOD_DIRS = {}
def mdir(mid):
    if mid in MOD_DIRS: return MOD_DIRS[mid]
    if os.path.isdir(os.path.join(SHARED, mid)): return os.path.join(SHARED, mid)
    return os.path.join(MODS, mid)
def save_profile(p): os.makedirs(MODS, exist_ok=True); json.dump(p, open(PROFILE, "w", encoding="utf-8"), indent=1)
def load_mods():
    mods = {}


    extra = [d for d in (os.environ.get("BBMOD_MODS_EXTRA") or "").split(os.pathsep) if d] if STAGING else []
    for mj in sorted(glob.glob(os.path.join(SHARED, "*", "mod.json"))) + sorted(glob.glob(os.path.join(MODS, "*", "mod.json"))) + [p for d in extra for p in sorted(glob.glob(os.path.join(d, "*", "mod.json")))]:
        m = json.load(open(mj, encoding="utf-8")); m["_dir"] = os.path.dirname(mj); MOD_DIRS[m["id"]] = m["_dir"]
        for k in ("id", "name", "version"): assert k in m, f"{mj}: missing '{k}'"
        assert m["id"] == os.path.basename(m["_dir"]), f"{mj}: id must equal folder name"
        mods[m["id"]] = m
    return mods
def resolve_order(mods, enabled):
    order, seen, stack = [], set(), []
    def visit(i):
        if i in seen: return
        if i in stack: raise SystemExit(f"dependency cycle at {i}")
        if i not in mods: raise SystemExit(f"missing mod '{i}' (required by {stack[-1] if stack else 'profile'})")
        stack.append(i)
        for d in mods[i].get("dependencies", []): visit(d)
        stack.pop(); seen.add(i); order.append(i)
    for i in enabled: visit(i)
    return order


KEY_OVERRIDES = {"BlessScreenGridConf": ["BlessId"], "SkillActivate": ["ActorId", "Group", "Order"], "BaseActorAttrConf": ["ActorId"],
                 "PvpBaseActorAttrConf": ["ActorId"], "SkillDamage": ["ActorId", "HitTimes"], "SkillAttr": ["ActorId", "Order"], "FesActorAttrInheritConf": ["ActorId"],
                 "SkillSlotBanActions": ["ActorId", "SkillSlot"], "HeroPortraitOffsetConfigUI": ["Id"],
                 "SkillFromTeacher": ["TeacherSkillId"]}
def table_keys(name, rows):
    if name in KEY_OVERRIDES: return list(KEY_OVERRIDES[name])
    f = rows[0] if rows else {}
    ks = ["Idx"] if "Idx" in f else ["Id"] if "Id" in f else []
    for extra in ("Lvl", "Quality"):
        if extra in f and ks: ks.append(extra)
    return ks
def rowkey(r, ks): return tuple(r.get(k, 1 if k == "Lvl" else 0) for k in ks)
def depends_on(mods, mid, target, seen=None):
    """True if mod `mid` (transitively) declares `target` as a dependency -> it may override target's values."""
    seen = seen or set()
    for d in mods.get(mid, {}).get("dependencies", []):
        if d == target or (d not in seen and (seen.add(d) or depends_on(mods, d, target, seen))): return True
    return False
def ensure_orig(path):
    if not os.path.exists(path + ".orig"): shutil.copy2(path, path + ".orig")
def compose_tables(order, mods, report):
    touched = {}
    for mid in order:
        for tname, rows in mods[mid].get("content", {}).get("tables", {}).items():
            touched.setdefault(tname, []).append((mid, rows))
    for tname, edits in touched.items():
        p = os.path.join(TABLES, tname + ".json"); assert os.path.exists(p), f"unknown table {tname}"
        ensure_orig(p); base = json.load(open(p + ".orig", encoding="utf-8")); ks = table_keys(tname, base)
        index = {rowkey(r, ks): r for r in base if rowkey(r, ks)[:1] not in ((None,), (0,))}; owner = {}
        for mid, rows in edits:
            for e in rows:
                if "$copyRows" in e:
                    spec = e["$copyRows"]; src = [r for r in base if all(r.get(f) == v for f, v in spec["where"].items())]
                    for r in src:
                        n = json.loads(json.dumps(r)); n.update(spec.get("set", {}))
                        for sw in spec.get("setWhere", []):
                            if all(n.get(f) == v for f, v in sw["match"].items()): n.update(sw["set"])
                        if spec.get("idOffset") and ks and ks[0] in n: n[ks[0]] = n[ks[0]] + spec["idOffset"]
                        kk = rowkey(n, ks)
                        if ks and kk in index and kk[:1] not in ((None,), (0,)) and not spec.get("allowDuplicateKeys"):
                            raise AssertionError(f"{mid}: {tname} $copyRows would duplicate key {kk} (set allowDuplicateKeys for multi-row-per-id tables)")
                        base.append(n); index[kk] = n; owner[(kk, "*")] = mid
                    print(f"    {mid}: {tname} copied {len(src)} rows where {spec['where']} -> {spec.get('set')}")
                    continue
                k = rowkey(e, ks)
                if e.get("$append"):
                    r = {kk: v for kk, v in e.items() if not kk.startswith("$")}; base.append(r); owner[(k, "*")] = mid; continue
                if e.get("$new"):
                    assert k not in index, f"{mid}: {tname} row {k} already exists"
                    r = {kk: v for kk, v in e.items() if not kk.startswith("$")}; base.append(r); index[k] = r; owner[(k, "*")] = mid; continue
                assert k in index, f"{mid}: {tname} row {k} not found (use \"$new\": true to insert)"
                r = index[k]
                if e.get("$delete"): base.remove(r); del index[k]; owner[(k, "*")] = mid; continue
                if e.get("$replace"):
                    r.clear(); r.update({kk: v for kk, v in e.items() if not kk.startswith("$")}); owner[(k, "*")] = mid; continue
                for f, v in e.items():
                    if f.startswith("$") or f in ks: continue
                    prev = owner.get((k, f))
                    if prev and prev != mid and r.get(f) != v and not depends_on(mods, mid, prev): report.append(f"CONFLICT table {tname} row {k} field {f}: {prev} vs {mid} (declare {prev} as a dependency to override it)")
                    r[f] = v; owner[(k, f)] = mid
        json.dump(base, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"  table {tname}: {sum(len(r) for _, r in edits)} row edits from {[m for m, _ in edits]}")
    return list(touched)


def js_path(logical): return os.path.join(JSDIR, *logical.split("/")[2:]) + ".js"
REGISTRY_MODULE = "data/js/Example"
def mod_heroes(mod):
    """The hero ids a mod adds (its BaseActorConf rows): the online lobby matches players' versions per hero."""
    rows = mod.get("content", {}).get("tables", {}).get("BaseActorConf", [])
    out = set()
    for r in rows if isinstance(rows, list) else []:
        if not isinstance(r, dict): continue
        a = (r.get("$copyRows", {}).get("set", {}) if "$copyRows" in r else r).get("ActorId")
        if isinstance(a, int) and a >= 190000: out.add(a)
    return sorted(out)
def terminal_release():
    """The Zenith Terminal release this loader came in, from the package's ID.txt next to Launcher (first line
    "0.3.2 alpha", second the package's sha256): {release, label, build, loader}. None when the loader runs from a
    source checkout, which has no package folder. The online lobby shows it (require("Example").ModRegistry.terminal)."""
    try:
        lines = open(os.path.join(os.path.dirname(ROOT), "package", "ID.txt"), encoding="utf-8").read().splitlines()
        words = lines[0].split()
    except (OSError, IndexError):
        return None
    if not words: return None
    try: loader = open(os.path.join(ROOT, "version.txt"), encoding="utf-8").read().strip()
    except OSError: loader = ""
    return {"release": words[0], "label": " ".join(words[1:]), "build": (lines[1].strip()[:12] if len(lines) > 1 else ""), "loader": loader}
def registry_code(order, mods):
    aliases = {}
    for mid in order:
        for k, v in mods[mid].get("content", {}).get("spriteAliases", {}).items(): aliases[k] = v
    modlist = [{"id": m, "name": mods[m]["name"], "version": mods[m]["version"], "heroes": mod_heroes(mods[m])} for m in order]
    taliases = {}
    for mid in order:
        for k, v in mods[mid].get("content", {}).get("textureAliases", {}).items(): taliases[k] = v
    body = ("mods:" + json.dumps(modlist, ensure_ascii=False) + ",spriteAlias:" + json.dumps(aliases, ensure_ascii=False) + ",textureAlias:" + json.dumps(taliases, ensure_ascii=False) +
            ",gameBuild:" + json.dumps(game_build()))
    # "built" stays the time this registry was first made, so a build that changes nothing makes the same bundle
    # (the live update compares bundles: an unchanged mod set must not count as a new script)
    stamp_file = os.path.join(ROOT, "kept", "registry_built.json")
    key = hashlib.sha1(body.encode("utf-8")).hexdigest()
    try: stamp = json.load(open(stamp_file, encoding="utf-8"))
    except (OSError, ValueError): stamp = {}
    if stamp.get("body") != key:
        stamp = {"body": key, "built": time.strftime("%Y-%m-%d %H:%M")}
        os.makedirs(os.path.dirname(stamp_file), exist_ok=True)
        with open(stamp_file, "w", encoding="utf-8") as f: json.dump(stamp, f)
    return ("/* ===== generated by bbmod: ModRegistry ===== */\n"
            "exports.ModRegistry={" + body + ",built:" + json.dumps(stamp["built"]) +
            ",terminal:" + json.dumps(terminal_release(), ensure_ascii=False) + "};")
def compose_js(order, mods, report):
    touched = {}
    for mid in order:
        c = mods[mid].get("content", {})
        for spec in c.get("js", []): touched.setdefault(spec["file"], []).append((mid, spec))
        for logical, rel in c.get("jsFiles", {}).items(): touched.setdefault(logical, []).append((mid, {"wholeFile": os.path.join(mods[mid]["_dir"], rel)}))
    if order: touched.setdefault(REGISTRY_MODULE, []).append(("bbmod", {"append": registry_code(order, mods)}))
    checks = []                 # (logical, written file, edit sets, text): syntax-checked together at the end (check_js)
    for logical, specs in touched.items():
        p = js_path(logical); assert os.path.exists(p), f"unknown js module {logical}"
        ensure_orig(p); s = open(p + ".orig", encoding="utf-8").read(); anchors = {}
        whole = [m for m, sp in specs if "wholeFile" in sp]
        if whole:
            if len(specs) > 1: report.append(f"CONFLICT js {logical}: whole-file replacement by {whole} plus other edits by {[m for m, _ in specs if m not in whole]}")
            s = open(specs[0][1]["wholeFile"], encoding="utf-8").read()
        else:
            appends = []
            for mid, sp in specs:
                for old, new in sp.get("replace", []):
                    if old in anchors and anchors[old] != mid: report.append(f"CONFLICT js {logical}: anchor patched by {anchors[old]} and {mid}: {old[:60]!r}")
                    n = s.count(old)
                    if n == 0: report.append(f"ERROR js {logical} ({mid}): anchor not found: {old[:80]!r}"); continue
                    if n > 1: print(f"    WARNING js {logical} ({mid}): anchor matches {n} times and ALL are replaced -- make it unique: {old[:70]!r}")
                    s = s.replace(old, new.replace("@ROOT@", ROOT.replace("\\", "/"))); anchors[old] = mid
                if sp.get("append"): appends.append(sp["append"])
                if sp.get("appendFile"): appends.append(open(os.path.join(mods[mid]["_dir"], sp["appendFile"]), encoding="utf-8").read())
            if appends:

                appends = [x.replace("@ROOT@", ROOT.replace("\\", "/")) for x in appends]
                marker = "\n//# sourceMappingURL="; i = s.rfind(marker)
                s = (s[:i] + "\n" + "\n".join(appends) + s[i:]) if i >= 0 else s + "\n" + "\n".join(appends)
        open(p, "w", encoding="utf-8", newline="\n").write(s)
        checks.append((logical, p, specs, s))
    check_js(checks, report)
    return list(touched)

JS_CHECKED = os.path.join(ROOT, "kept", "js_checked.json")

def check_js(checks, report):
    """node --check on each composed script, side by side, and only once per content: a script that passed before (the
    same text, the same Node.js) is not checked again (2026-11-07: 59 checks one after another took 5 s of every build)"""
    import hashlib, concurrent.futures
    usable, why = node_check()
    if not usable:
        for logical, p, specs, _ in checks: print(f"  js {logical}: {len(specs)} edit set(s) from {[m for m, _ in specs]}  (syntax check skipped: {why})")
        return
    try: passed = set(json.load(open(JS_CHECKED, encoding="utf-8")))
    except (OSError, ValueError): passed = set()
    key = lambda text: hashlib.sha1((NODE + "\0" + text).encode("utf-8")).hexdigest()
    todo = [c for c in checks if key(c[3]) not in passed]
    def run(c):
        return c, subprocess.run([NODE, "--check", c[1]], capture_output=True, text=True, errors="replace")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as tp: results = {c[0]: r for c, r in tp.map(run, todo)}
    for logical, p, specs, text in checks:
        r = results.get(logical)
        if r is not None and r.returncode != 0:
            # Node prints the file, the whole line (a game script is one line) and only then what is wrong: say that first
            what = next((l for l in r.stderr.splitlines() if "Error" in l.split(":")[0]), "")
            report.append(f"ERROR js {logical}: syntax check failed: {what}\n{r.stderr[:400]}")
        elif r is not None: passed.add(key(text))
        state = "checked before" if r is None else ("OK" if r.returncode == 0 else "SYNTAX ERROR")
        print(f"  js {logical}: {len(specs)} edit set(s) from {[m for m, _ in specs]}  {state}")
    try:
        os.makedirs(os.path.dirname(JS_CHECKED), exist_ok=True)
        with open(JS_CHECKED + ".new", "w", encoding="utf-8") as f: json.dump(sorted(passed), f)
        os.replace(JS_CHECKED + ".new", JS_CHECKED)
    except OSError: pass






_gen = None
class _CachedTypeTrees:
    """UnityPy typetree generator with a per-game-build cache (tools/typetrees/<build>/). With dump/DummyDll present
    (Il2CppDumper output) nodes are generated and the cache refreshed; without it -- an end user's machine -- the cached
    nodes are used, so installing never needs Il2CppDumper. Type layouts are metadata, not game content."""
    def __init__(self):
        self.real = False; self.dir = os.path.join(ROOT, "tools", "typetrees", str(game_build()))
    def _real(self):
        if self.real is False:
            dll = os.path.join(ROOT, "dump", "DummyDll"); self.real = None
            if os.path.isdir(dll):
                from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
                self.real = TypeTreeGenerator("2022.3.62f3"); self.real.load_local_dll_folder(dll)
        return self.real
    def get_nodes_up(self, assembly, fullname):
        f = os.path.join(self.dir, "%s__%s.json" % (assembly.replace(".dll", ""), fullname))
        g = self._real()
        if g is not None:
            node = g.get_nodes_up(assembly, fullname)
            os.makedirs(self.dir, exist_ok=True); json.dump(node.to_dict_list(), open(f, "w", encoding="utf-8"))
            return node
        if os.path.exists(f):
            from UnityPy.helpers.TypeTreeNode import TypeTreeNode
            return TypeTreeNode.from_list(json.load(open(f, encoding="utf-8")))
        raise SystemExit("no dump/DummyDll and no cached type tree for %s (build %s). See docs/boons-plus/README.md." % (fullname, game_build()))
def typetree_gen():
    global _gen
    if _gen is None: _gen = _CachedTypeTrees()
    return _gen
def resolve_path(obj, path):
    """returns (container, key) for the last segment so callers can get/set"""
    toks = re.findall(r"\[([^\]]+)\]|([^.\[\]]+)", path); cur = obj; last = None
    for i, (sel, name) in enumerate(toks):
        if last is not None: cur = last[0][last[1]]
        if name: last = (cur, name)
        elif "=" in sel:
            f, v = sel.split("=", 1); idx = next((j for j, e in enumerate(cur) if str(e.get(f)) == v), None)
            if idx is None: raise KeyError(f"no element with {f}={v} in {path}")
            last = (cur, idx)
        else: last = (cur, int(sel))
    return last
def apply_asset_ops(tree, spec, mid, report):
    if spec.get("treeFile"):
        p = os.path.join(mdir(mid), spec["treeFile"])
        if not os.path.exists(p): report.append(f"ERROR asset {spec['bundle']} ({mid}): treeFile {spec['treeFile']} missing"); return
        src = json.load(open(p, encoding="utf-8"))
        for k, v in src.items():
            if not k.startswith("m_") or k == "m_Name": tree[k] = v
    if spec.get("copyTreeFrom"):
        import UnityPy
        src = spec["copyTreeFrom"]; env = UnityPy.load(slice_bundle(find_entry(src["bundle"]))); env.typetree_generator = typetree_gen(); st = None
        for o in env.objects:
            if o.type.name == "MonoBehaviour":
                t = o.read_typetree()
                if t.get("m_Name") == src["asset"]: st = t; break
        if st is None: report.append(f"ERROR asset {spec['bundle']} ({mid}): copyTreeFrom source {src} not found"); return
        for k, v in st.items():
            if not k.startswith("m_") or k == "references": tree[k] = json.loads(json.dumps(v))
        if "references" in tree: tree["references"]["RefIds"] = [r for r in tree["references"]["RefIds"] if r.get("type", {}).get("class") != ""]
    for op in spec.get("set", []):
        c, k = resolve_path(tree, op["path"]); c[k] = {"value": int(round(op["fp"] * 4294967296))} if "fp" in op else op["value"]
    for cp in spec.get("copyActions", []):
        src = next((a for a in tree["_actions"] if a["Name"] == cp["from"]), None)
        if src is None: report.append(f"ERROR asset {spec['bundle']} ({mid}): copyActions source '{cp['from']}' not found"); continue
        new = json.loads(json.dumps(src)); new["Name"] = cp["name"]
        for op in cp.get("set", []):
            c, k = resolve_path(new, op["path"]); c[k] = {"value": int(round(op["fp"] * 4294967296))} if "fp" in op else op["value"]
        tree["_actions"] = [a for a in tree["_actions"] if a["Name"] != cp["name"]] + [new]
    for a in spec.get("addActions", []): tree["_actions"] = [x for x in tree["_actions"] if x["Name"] != a["Name"]] + [a]
    for im in spec.get("importActions", []):
        import UnityPy
        src = im["from"]; env = UnityPy.load(slice_bundle(find_entry(src["bundle"]))); env.typetree_generator = typetree_gen(); sa = None
        for o in env.objects:
            if o.type.name != "MonoBehaviour": continue
            t = o.read_typetree()
            if t.get("m_Name") == src["asset"]:
                sa = next((x for x in t.get("_actions", []) if x["Name"] == src["action"]), None); break
        if sa is None: report.append(f"ERROR asset {spec['bundle']} ({mid}): importActions source {src} not found"); continue
        if sa.get("AddRoles"): report.append(f"ERROR asset {spec['bundle']} ({mid}): '{src['action']}' spawns bullet actors (AddRoles) and cannot be imported")
        new = json.loads(json.dumps(sa))
        def _scrub(o):
            if isinstance(o, dict):
                if "Conditions" in o and isinstance(o["Conditions"], list): o["Conditions"] = []
                for x in o.values(): _scrub(x)
            elif isinstance(o, list):
                for x in o: _scrub(x)
        _scrub(new)




        tgt = next((x for x in tree["_actions"] if x["Name"] == im["name"]), None)
        for f in ("ActionSwitchs", "Interrupt"):
            if f in new: new[f] = []
        for f in ("NextAction", "DropAction", "DropEndAction", "DropEndHighAction",
                  "OnGroundAction", "BeginFallAction", "DeadAction"):
            if f in new: new[f] = (tgt or {}).get(f, "")
        new["Name"] = im["name"]
        if im.get("animate"): new["Animate"] = im["animate"]
        rn = next((x.get("RoleName") for x in tree["_actions"] if x.get("RoleName")), None)
        if rn: new["RoleName"] = rn
        for op in im.get("set", []):
            c, k = resolve_path(new, op["path"]); c[k] = {"value": int(round(op["fp"] * 4294967296))} if "fp" in op else op["value"]
        tree["_actions"] = [x for x in tree["_actions"] if x["Name"] != im["name"]] + [new]
        print(f"    {mid}: imported {src['asset']}.{src['action']} -> {im['name']} (anim {new.get('Animate')})")

    for cp in spec.get("copyItems", []):
        c, k = resolve_path(tree, cp["list"]); lst = c[k]; key = cp.get("key", "Name")
        src = next((e for e in lst if e.get(key) == cp["from"]), None)
        if src is None: report.append(f"ERROR asset {spec['bundle']} ({mid}): copyItems source {key}={cp['from']} not found in {cp['list']}"); continue
        new = json.loads(json.dumps(src)); new[key] = cp["to"]
        for op in cp.get("set", []):
            cc, kk = resolve_path(new, op["path"]); cc[kk] = {"value": int(round(op["fp"] * 4294967296))} if "fp" in op else op["value"]
        lst[:] = [e for e in lst if e.get(key) != cp["to"]] + [new]
    for ap in spec.get("appendItems", []):
        c, k = resolve_path(tree, ap["list"]); lst = c[k]; key = ap.get("key", "Name"); v = ap["value"]
        lst[:] = [e for e in lst if e.get(key) != v.get(key)] + [v]
def compose_assets(order, mods, report):
    import UnityPy
    touched = {}
    for mid in order:
        for spec in mods[mid].get("content", {}).get("assets", []): touched.setdefault((spec["bundle"], spec["asset"]), []).append((mid, spec))
    import hashlib
    cache_dir = os.path.join(ROOT, "kept", "assetcache")
    for (bundle, asset), specs in touched.items():
        gen = typetree_gen()
        staged = os.path.join(OUT, *bundle.split("/"))
        base = open(staged, "rb").read() if os.path.exists(staged) else slice_bundle(find_entry(bundle))
        # the same bundle, asset and edits (and the tree files they name) make the same result: kept between builds
        # (2026-11-07: the asset step was 6 s of every build, most of it loading and saving a few large bundles again)
        h = hashlib.sha1(b"assets/1\0" + base + asset.encode("utf-8") + json.dumps([[m, s] for m, s in specs], sort_keys=True, default=str).encode("utf-8"))
        for mid, spec in specs:
            if spec.get("treeFile"):
                try: h.update(open(os.path.join(mdir(mid), spec["treeFile"]), "rb").read())
                except OSError: pass
        cached = os.path.join(cache_dir, h.hexdigest() + ".ab")
        if os.path.exists(cached):
            dst = os.path.join(OUT, *bundle.split("/")); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(cached, dst)
            print(f"  asset {bundle}::{asset}: as the last build made it (kept)"); continue
        env = UnityPy.load(base); env.typetree_generator = gen
        obj = tree = None
        for o in env.objects:
            if o.type.name != "MonoBehaviour": continue
            t = o.read_typetree()
            if t.get("m_Name") == asset: obj, tree = o, t; break
        if obj is None: report.append(f"ERROR asset {bundle}: asset '{asset}' not found"); continue
        if "references" in tree: tree["references"]["RefIds"] = [r for r in tree["references"]["RefIds"] if r.get("type", {}).get("class") != ""]
        for mid, spec in specs: apply_asset_ops(tree, spec, mid, report)
        obj.save_typetree(tree); data = env.file.save(packer="lz4")
        dst = os.path.join(OUT, *bundle.split("/")); os.makedirs(os.path.dirname(dst), exist_ok=True); open(dst, "wb").write(data)
        if not any(r.startswith(("ERROR", "CONFLICT")) and bundle in r for r in report):
            os.makedirs(cache_dir, exist_ok=True); open(cached + ".new", "wb").write(data); os.replace(cached + ".new", cached)
        print(f"  asset {bundle}::{asset}: {sum(len(s.get('set', [])) + len(s.get('copyActions', [])) + len(s.get('addActions', [])) for _, s in specs)} ops from {[m for m, _ in specs]} -> {len(data)} bytes")


M32 = 0xFFFFFFFF
def tag_hash(s):
    h = 0x1234567
    for c in s: h = (((ord(c) & 0xFF) ^ h) * 0x89ABCDEF) & M32
    return struct.pack("<I", (h * 0x89ABCDEF) & M32)
def compose_locale(order, mods, report):
    merged = {}; owner = {}
    for mid in order:
        for lang, table in mods[mid].get("content", {}).get("locale", {}).items():
            for k, v in table.items():
                if (lang, k) in owner and owner[(lang, k)] != mid and merged[lang][k] != v: report.append(f"CONFLICT locale {lang}/{k}: {owner[(lang, k)]} vs {mid}")
                merged.setdefault(lang, {})[k] = v; owner[(lang, k)] = mid
    return merged
def build_locale(merged):
    import UnityPy
    for lang, table in merged.items():
        logical = f"data/localization/localization_{lang}.ab"; name = f"localization_{lang}"
        env = UnityPy.load(slice_bundle(find_entry(logical)))
        raw = next(o.read().m_Script.encode("utf-8", "surrogateescape") for o in env.objects if o.type.name == "TextAsset")
        entries = []; p = 0
        while p + 8 <= len(raw):
            h = raw[p:p+4]; n = struct.unpack("<I", raw[p+4:p+8])[0]; entries.append([h, raw[p+8:p+8+n]]); p += 8 + n
        idx = {e[0]: e for e in entries}; upd = add = 0
        for k, text in table.items():
            h = tag_hash(k)
            if h in idx: idx[h][1] = text.encode("utf-8"); upd += 1
            else: entries.append([h, text.encode("utf-8")]); add += 1
        rebuild_bundle(logical, name, b"".join(h + struct.pack("<I", len(v)) + v for h, v in entries))
        print(f"  locale {lang}: {upd} updated, {add} added")


def _modsettings():
    if os.path.join(ROOT, "tools") not in sys.path: sys.path.insert(0, os.path.join(ROOT, "tools"))
    import modsettings
    return modsettings
SETTINGS_USED = {}          # {mod: {setting: value}} of the last build, for the mods that went into it
FULL = "--full" in sys.argv  # build / install --full: every mod's clones and importers made again (tools/quick.py)
QUICK_RESULT = {}           # {mod: "kept" | "made" | "none" | "failed"} of the last quick build
def _free_ram_gb():
    """Physical memory free now, in GB (Windows; None elsewhere or when it cannot be read)."""
    if os.name != "nt": return None
    try:
        import ctypes
        class MS(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong), ("ullTotalPhys", ctypes.c_ulonglong),
                        ("ullAvailPhys", ctypes.c_ulonglong), ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong), ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        m = MS(); m.dwLength = ctypes.sizeof(MS)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)): return None
        return m.ullAvailPhys / 1024 ** 3
    except Exception:
        return None

def clone_jobs(n_specs):
    """How many clone workers: one per spare core, at most 12, fewer when memory is short (a large palette sprite sheet
    peaks near 0.55 GB in a worker), and none idle on a short list. BBMOD_JOBS=<n> sets it; 1 is one worker."""
    try: n = int(os.environ.get("BBMOD_JOBS", "0"))
    except ValueError: n = 0
    if n <= 0:
        n = max(1, min((os.cpu_count() or 2) - 2, 12))
        free = _free_ram_gb()
        if free: n = max(1, min(n, int(free // 0.8)))
    return max(1, min(n, (n_specs + 3) // 4))      # (workers stay up for the whole build, so a short list may use a few)

def clone_one(mid, spec, out, rep):
    """one rig or bundle clone of a mod into the folder out; its manifest additions"""
    import bbchar
    if spec.get("_kind") == "bundle":
        img = spec.get("image") and os.path.join(mdir(mid), spec["image"])
        a = bbchar.clone_bundle(spec["from"], spec["to"], out, tuple(spec["rename"]) if spec.get("rename") else None, img, None, spec.get("refTypesFrom"),
                                bool(spec.get("renameObjects")),
                                [(n, ip if ip is None or ip.startswith("sprite:") else os.path.join(mdir(mid), ip)) for n, ip in spec["atlasSprites"]] if spec.get("atlasSprites") else None,
                                recolor=spec.get("recolor"), remap_deps=spec.get("remapDeps"),
                                deactivate=spec.get("deactivate"), hub_delay=spec.get("hubDelay"))
        if spec.get("guid"): a["guids"] = list(a.get("guids", [])) + [[spec["to"], spec["guid"]]]
    else:
        a = bbchar.clone_rig(spec["from"], spec["to"], out, rep, spec.get("logicFrom"))
    if spec.get("rigSpec"):
        import bbrig; bbrig.inject(os.path.join(mdir(mid), spec["rigSpec"]), out)
    return {k: list(a[k]) for k in ("names", "entries", "guids")}

class ClonePool:
    """Clone workers started once per build and given every mod's clones in turn. Each worker is `bbmod.py _rigserve`:
    it imports UnityPy and reads the game's manifest once (about 1.5 s, more when a dozen start together), then takes
    jobs from its stdin. Started afresh for every mod, that start-up was most of an install whose clones were all in
    tools\\clonecache: 17 mods' clones took 40 s, almost none of it cloning (2026-11-07)."""
    def __init__(self):
        import threading
        self.workers = []           # (process, log path)
        self.lock = threading.Lock()    # one job set at a time (quick.py makes several mods side by side)
    def ensure(self, n):
        while len(self.workers) < n:
            k = len(self.workers)
            log = os.path.join(tempfile.gettempdir(), "bbmod_rigserve_%d_%d.log" % (os.getpid(), k))
            p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "_rigserve", log], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.DEVNULL, text=True, encoding="utf-8", env=dict(os.environ, BBMOD_OUT=OUT, PYTHONIOENCODING="utf-8"))
            self.workers.append((p, log))
    def run(self, specs, out, n):
        """make these (mod, spec) pairs into out on n workers; ({index: additions}, [error lines], [log lines])"""
        with self.lock: return self._run(specs, out, n)
    def _run(self, specs, out, n):
        self.ensure(n)
        tag = "%d_%d" % (os.getpid(), int(time.time() * 1000) % 100000)
        jobs = []
        for k in range(n):
            mine = [[i, specs[i][0], specs[i][1]] for i in range(k, len(specs), n)]
            if not mine: continue
            adds = os.path.join(tempfile.gettempdir(), "bbmod_rigadds_%s_%d.json" % (tag, k))
            p, log = self.workers[k]
            try:
                p.stdin.write(json.dumps({"specs": mine, "out": out, "adds": adds}) + "\n"); p.stdin.flush()
            except OSError as e:
                return {}, ["ERROR rigs: clone worker %d stopped (%s)" % (k + 1, e)], []
            jobs.append((k, p, log, adds))
        per_index, errs, logs = {}, [], []
        for k, p, log, adds in jobs:
            line = p.stdout.readline().strip()
            try: text = open(log, encoding="utf-8", errors="replace").read(); open(log, "w").close()
            except OSError: text = ""
            if text.strip(): logs += ["  [%d] %s" % (k, l) for l in text.rstrip().splitlines()[-40:]]
            if line != "DONE":
                errs.append("ERROR rigs: clone worker %d of %d failed: %s %s" % (k + 1, n, line, text[-800:])); continue
            try: per_index.update({int(i): a for i, a in json.load(open(adds, encoding="utf-8")).items()}); os.remove(adds)
            except (OSError, ValueError) as e: errs.append("ERROR rigs: clone worker %d of %d left no result (%s)" % (k + 1, n, e))
        return per_index, errs, logs
    def close(self):
        for p, log in self.workers:
            try: p.stdin.close(); p.wait(timeout=20)
            except Exception:
                try: p.kill()
                except Exception: pass
            try: os.remove(log)
            except OSError: pass
        self.workers = []

def build():
    pool = ClonePool()
    try: return _build(pool)
    finally: pool.close()

def _build(pool):
    mods = load_mods(); prof = load_profile(); order = resolve_order(mods, prof["enabled"]); build_id = game_build()
    print(f"game build {build_id}; load order: {order}"); began = time.time()
    used = _modsettings().apply(mods, _modsettings().read(PROFILE))     # each mod's chosen options, laid over its content
    SETTINGS_USED.clear(); SETTINGS_USED.update({mid: used[mid] for mid in order if mid in used})
    for mid in order:
        gb = mods[mid].get("gameBuilds", ["*"])
        if "*" not in gb and build_id not in gb: print(f"  WARNING {mid} verified on builds {gb}, game is {build_id}")
    report = []
    if os.path.exists(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)
    def phase(name, t=[time.time()]):
        now = time.time(); print("  [%.1f s] %s" % (now - t[0], name)); t[0] = now
    print("tables:"); tnames = compose_tables(order, mods, report); phase("tables composed")
    print("js:"); jsnames = compose_js(order, mods, report); phase("scripts composed")
    locale = compose_locale(order, mods, report)
    print("movies:"); movies = movie_specs(order, mods, report); phase("text and movies")
    print("rigs:")
    def run_clones(specs, out):
        """the clones of these (mod, spec) pairs, made into the folder out; their manifest additions, None if it failed.
        They are spread over clone_jobs() worker processes (each takes every n-th spec) and their additions joined back
        in spec order, so the result is the one a single worker makes (2026-11-07: a palette mod's 540 recoloured
        sprite sheets ran ~5 s each one after another and held an install for over 15 minutes)."""
        none = {"names": [], "entries": [], "guids": []}
        if not specs: return none
        jobs = clone_jobs(len(specs)); t0 = time.time()
        per_index, errs, logs = pool.run(specs, out, jobs)
        if logs: print("\n".join(logs))
        print("  %d clones took %.1f s (%d worker%s)" % (len(specs), time.time() - t0, jobs, "" if jobs == 1 else "s"))
        if errs: report.extend(errs); return None
        adds = {"names": [], "entries": [], "guids": []}
        for i in range(len(specs)):
            a = per_index.get(i)
            if a is None: report.append("ERROR rigs: no result for clone %d (%s)" % (i, specs[i][1].get("to"))); return None
            for key in adds: adds[key] += a.get(key, [])
        with open(os.path.join(out, "_manifest_add.json"), "w") as f: json.dump(adds, f, indent=1)
        return adds
    def clone_specs(mid):
        return ([(mid, r) for r in mods[mid].get("content", {}).get("rigClones", [])] +
                [(mid, dict(r, _kind="bundle")) for r in mods[mid].get("content", {}).get("bundleClones", [])])
    full = FULL or os.environ.get("BBMOD_FULL") == "1"
    if full:
        run_clones([s for m in order for s in clone_specs(m)], OUT)



    class _ImporterFailed(Exception): pass
    def run_importer(mid, spec, out):
        addp = os.path.join(tempfile.gettempdir(), "bbmod_import_%s_%d.json" % (mid, os.getpid()))
        t0 = time.time()
        r = subprocess.run([sys.executable, os.path.join(mdir(mid), spec["script"])] + list(spec.get("args", [])) + ["--out", out, "--adds", addp],
                           capture_output=True, text=True, errors="replace", env=dict(os.environ, BBMOD_OUT=out))
        took = time.time() - t0
        print("\n".join(r.stdout.rstrip().splitlines()[-25:])); print("  %s %s took %.0f s" % (mid, spec["script"], took))
        if r.returncode != 0 or not os.path.exists(addp):
            report.append("ERROR importer %s: rc %d: %s" % (mid, r.returncode, (r.stderr or r.stdout)[-800:])); raise _ImporterFailed()
        if took >= SLOW_IMPORTER and not spec.get("keep") and "kept" not in r.stdout:
            print("  NOTE %s: this importer does the same work at every install. tools/kept.py keeps it between installs "
                  "(docs/FAST_MODS.md)." % mid)
        add = json.load(open(addp, encoding="utf-8")); os.remove(addp)
        return add
    # the loader's own code: an importer kept with "keep": true is made again when any of it changes
    loader_code = sorted(glob.glob(os.path.join(ROOT, "*.py"))) + [os.path.join(ROOT, "tools")]
    def run_importers(mid, out):
        """one mod's importers, in order, into the folder out; their manifest additions, None if one failed"""
        adds = {"names": [], "entries": [], "guids": []}
        for spec in mods[mid].get("content", {}).get("importers", []):
            print("importer %s: %s" % (mid, spec["script"]))
            try:
                if spec.get("keep") is True:
                    # the mod's author says: nothing in it must run at every install, and it reads only the mod's own
                    # files, the loader and the game (tools/kept.py). Its output is put back without starting it.
                    sys.path.insert(0, os.path.join(ROOT, "tools")) if os.path.join(ROOT, "tools") not in sys.path else None
                    import kept
                    add = kept.work("%s %s" % (mid, spec["script"]), out, lambda: run_importer(mid, spec, out),
                                    reads=[mdir(mid)] + [mdir(d) for d in mods[mid].get("dependencies", []) if d in mods] + loader_code,
                                    says=[build_id, spec], skip=spec.get("keepSkip", []))
                else:
                    add = run_importer(mid, spec, out)
            except _ImporterFailed:
                if not full: return None
                continue
            for k in adds: adds[k] += add.get(k, [])
            if full:
                madd = os.path.join(out, "_manifest_add.json")
                cur = json.load(open(madd)) if os.path.exists(madd) else {"names": [], "entries": [], "guids": []}
                for k in ("names", "entries", "guids"): cur[k] += add.get(k, [])
                json.dump(cur, open(madd, "w"), indent=1)
        return adds
    if full:
        for mid in order: run_importers(mid, OUT)
    else:
        # each mod's clones and importers are made only when the mod changed (tools/quick.py)
        sys.path.insert(0, os.path.join(ROOT, "tools")) if os.path.join(ROOT, "tools") not in sys.path else None
        import quick
        QUICK_RESULT.clear()
        try: stages = prebuilt_stages()
        except Exception as e: stages = {}; print("  (the channel's ready-made stages could not be checked: %s)" % e)
        QUICK_RESULT.update(quick.mod_stages(order, mods, mdir, OUT, ROOT, SETTINGS_USED, build_id, loader_code,
                                             lambda mid, out: run_clones(clone_specs(mid), out), run_importers, report, stages=stages))
    phase("clones and importers")
    print("assets:")
    if any(mods[m].get("content", {}).get("assets") for m in order):
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "_assets", json.dumps(order)], capture_output=True, text=True, errors="replace")
        print(r.stdout.rstrip()); [report.append(l) for l in r.stdout.splitlines() if l.startswith(("CONFLICT", "ERROR"))]
        if r.returncode != 0: report.append("ERROR assets: child process failed (rc %d): %s" % (r.returncode, r.stderr[-600:]))
    errs = [r for r in report if r.startswith(("CONFLICT", "ERROR"))]
    if errs: print("\nBUILD ABORTED:\n  " + "\n  ".join(errs)); return False
    # a mod's sound files are addressed from the game folder, not from this PC's path to the loader (tools/portable_sounds.py)
    import portable_sounds
    portable_sounds.rewrite(OUT, typetree_gen())
    phase("assets and sounds")
    print("encoding:")
    for name in tnames:
        raw = encode_table(name); verify_table(name, raw); rebuild_bundle(f"data/xlsx/{name.lower()}.ab", name, raw)
        if name + "FixedPoint" in SCHEMA and os.path.exists(os.path.join(RAW, "data", "xlsxfixed", name + "FixedPointWrap.bin")):
            fraw = encode_fixed_table(name, KEY_OVERRIDES.get(name)); verify_table(name + "FixedPointWrap", fraw)
            rebuild_bundle(f"data/xlsxfixed/{name.lower()}fixedpointwrap.ab", name + "FixedPointWrap", fraw)
    for lp in jsnames:
        src = open(js_path(lp), "rb").read(); key = JSKEYS.get(lp)
        rebuild_bundle(lp.lower() + ".ab", lp.split("/")[-1], (b"NOAH" + noah_xor(src, int(key, 16))) if key else src)
    phase("tables and scripts encoded")
    build_locale(locale); phase("text encoded")
    json.dump({"gameBuild": build_id, "mods": {m: mods[m]["version"] for m in order}, "built": time.strftime("%Y-%m-%d %H:%M:%S")},
              open(os.path.join(OUT, "_build.json"), "w"), indent=1)
    json.dump(movies, open(os.path.join(OUT, "_movies.json"), "w", encoding="utf-8"), indent=1)
    print("build OK ->", OUT, "(%.0f s)" % (time.time() - began)); return True

MOVIE = os.path.join(ROOT, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Movie")
MOVIE_LEDGER = os.path.join(MODS, "installed_movies.json")
MOVIE_NAME = re.compile(r"^[A-Za-z0-9_]+(/[A-Za-z0-9_]+)+$")
# the top folders of the game's own MovieData.d names (Steam build 25627491): a listed name in one of them is never
# taken as a mod's from another install folder (movie_specs), so no uninstall can remove a game movie
GAME_MOVIE_FOLDERS = {f.lower() for f in (
    "Achievement add_tri BattleChallenge BlackMarket BossBigTV01a BossBigTV01b BossBigTV01c BossBigTV02a BossBigTV02b "
    "BossBigTV02c BossBigTV03a BossBigTV03b BossBigTV03c BossBigTV04a BossBigTV04b BossBigTV04c BossRush CapitalF1 "
    "CapitalF2 ChampionshipFlag ConsolePlot ContractRoom CoopTraining Ending EventRoom GambleRoom HeroSelect "
    "KeepCalmAndCarryOn Login Mobile NewComing player Plot PVP RMBSkin S01_Build S04_Build S04_BuildF01 S04_BuildF02 "
    "S04_BuildF02b S05_Boss04 S06_Boss SAN ShopRoom STAGE01 STAGE01_console STAGE01_IN STAGE02 STAGE02_console "
    "STAGE02_IN STAGE03 STAGE03_console STAGE03_IN STAGE03B STAGE03B_console STAGE03B_IN STAGE04 STAGE04_console "
    "STAGE04_IN STAGE06_IN TriangleScreen TV01 TV02 TV02b Virtual").split()}

def movie_specs(order, mods, report):
    """Every enabled mod's content.movies, checked: a name of the mod's own (Folder/name, not one of the game's),
    a file that exists, and the four numbers MovieData.d wants. The game plays a movie by its name in that list;
    "size" is the ixsize field of the movie's video header, and the file must be wrapped the way the game's own
    movies are (an .e.usm), or its window stays empty for the listed time."""
    specs, seen = [], {}
    stock = set()
    if not any(mods[mid].get("content", {}).get("movies") for mid in order): return specs      # no movie: the game's list is not needed
    try: stock ={e["name"].lower() for e in _movie_list()[0]["list"]} - {n.lower() for n in _movie_ledger()}
    except (OSError, ValueError) as e: report.append("ERROR movies: cannot read the game's MovieData.d (%s)" % e)
    # 2026-10-23: a movie placed by another install folder (the workspace, an older or moved Terminal) is listed but not
    # in this folder's ledger. It is ours when every listed name in its top folder is one an enabled mod declares: the
    # game's own folders (HeroSelect, Plot, RMBSkin...) all hold names no mod declares. Such names join the ledger at
    # install (install_movies), so the old line is replaced, not listed twice
    declared = {s.get("name", "").lower() for mid in order for s in mods[mid].get("content", {}).get("movies", [])}
    top = lambda n: n.split("/")[0]
    foreign = {top(n) for n in stock if n not in declared} | GAME_MOVIE_FOLDERS
    for mid in order:
        for s in mods[mid].get("content", {}).get("movies", []):
            name, src = s.get("name", ""), os.path.join(mdir(mid), s.get("file", ""))
            if not MOVIE_NAME.match(name): report.append(f"ERROR {mid}: movie name '{name}' must be Folder/name in letters, digits and _"); continue
            adopt = name.lower() in stock and top(name.lower()) not in foreign
            if adopt: print(f"  {mid}: {name} is listed from another install folder: taken as this mod's, replaced at install")
            elif name.lower() in stock: report.append(f"ERROR {mid}: movie '{name}' is one of the game's own"); continue
            if name.lower() in seen: report.append(f"CONFLICT movie '{name}': {seen[name.lower()]} and {mid}"); continue
            if not os.path.isfile(src): report.append(f"ERROR {mid}: movie file missing: {s.get('file')}"); continue
            if not all(isinstance(s.get(k), (int, float)) and s[k] > 0 for k in ("size", "duration", "w", "h")):
                report.append(f"ERROR {mid}: movie '{name}' needs size, duration, w and h as numbers"); continue
            seen[name.lower()] = mid; specs.append({"name": name, "src": src, "size": int(s["size"]), "duration": s["duration"], "w": int(s["w"]), "h": int(s["h"]),
                                                    **({"adopt": True} if adopt else {})})
            print(f"  {mid}: {name}  ({os.path.getsize(src)} bytes)")
    return specs

def _movie_list():
    raw = open(os.path.join(MOVIE, "MovieData.d"), "rb").read()
    return json.loads(raw.decode("utf-8-sig")), raw[:3] == b"\xef\xbb\xbf"

def _movie_list_write(data, bom):
    # indent 4 and CRLF is how the game ships the file: with our entries out, it is the shipped file byte for byte
    text = json.dumps(data, indent=4, ensure_ascii=False).replace("\n", "\r\n")
    tmp = os.path.join(MOVIE, "MovieData.d.tmp")
    with open(tmp, "wb") as f: f.write((b"\xef\xbb\xbf" if bom else b"") + text.encode("utf-8"))
    os.replace(tmp, os.path.join(MOVIE, "MovieData.d"))

def _movie_ledger():
    try: return json.load(open(MOVIE_LEDGER, encoding="utf-8"))
    except (OSError, ValueError): return []

def remove_movies():
    """Take out every movie an earlier install placed: the files, their folders when left empty, and their lines in
    MovieData.d. The ledger (mods\\installed_movies.json) is the only source of what is ours."""
    names = _movie_ledger()
    if not names: return
    data, bom = _movie_list(); low = {n.lower() for n in names}
    kept = [e for e in data["list"] if e["name"].lower() not in low]
    if len(kept) != len(data["list"]): data["list"] = kept; _movie_list_write(data, bom)
    for n in names:
        p = os.path.join(MOVIE, *n.split("/")) + ".e.usm"
        if os.path.exists(p): os.remove(p)
        d = os.path.dirname(p)
        while os.path.normcase(d) != os.path.normcase(MOVIE) and os.path.isdir(d) and not os.listdir(d): os.rmdir(d); d = os.path.dirname(d)
    os.remove(MOVIE_LEDGER)
    print("movies: removed", ", ".join(names))

def install_movies(specs):
    """Place the enabled mods' movies. The ledger is written before the first file, so an interrupted install is
    still undone by the next install or uninstall."""
    adopted = [s["name"] for s in specs if s.get("adopt")]
    if adopted:          # listed by another install folder (movie_specs): this ledger takes them, so they are replaced
        led = _movie_ledger()
        json.dump(led + [n for n in adopted if n.lower() not in {x.lower() for x in led}], open(MOVIE_LEDGER, "w", encoding="utf-8"), indent=1)
    remove_movies()
    if not specs: return
    json.dump([s["name"] for s in specs], open(MOVIE_LEDGER, "w", encoding="utf-8"), indent=1)
    for s in specs:
        dst = os.path.join(MOVIE, *s["name"].split("/")) + ".e.usm"
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(s["src"], dst)
    data, bom = _movie_list()
    data["list"] += [{"name": s["name"], "linguals": [{"lingualTag": "common", "path": s["name"], "size": s["size"],
                                                        "duration": s["duration"], "w": s["w"], "h": s["h"]}]} for s in specs]
    _movie_list_write(data, bom)
    print("movies: installed", ", ".join(s["name"] for s in specs))

def game_running():
    """True while BlazblueEntropyEffect.exe runs. 2026-09-28: the game was started during an install; it read the old
    merge.json, then bundles from the rewritten m_mod.m at the old offsets, lost the mod rows of BaseActorConf, and its
    login crashed on the save's mod characters ('reading special'), reporting every save as corrupted."""
    try:
        import subprocess
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq BlazblueEntropyEffect.exe"], capture_output=True, text=True, errors="replace").stdout
        return "blazblueentropyeffect.exe" in out.lower()
    except Exception:
        return False

def gameslot_block():
    """2026-09-30: installs are scheduled (tools/gameslot.py): refuse while ANOTHER session holds the game slot.
    Set BBEE_SLOT=<your workstream> after `python tools/gameslot.py acquire <name> "<purpose>"`."""
    try:
        sys.path.insert(0, os.path.join(ROOT, "tools")); import gameslot
        return gameslot.check(os.environ.get("BBEE_SLOT", ""))
    except Exception:
        return None

LAST_INSTALL = os.path.join(ROOT, "kept", "last_install.json")

def install_inputs():
    """A fingerprint of everything an install is made from: the game build, the loader's code, the profile (which mods,
    their options), every enabled mod's folder, and where Centralfiction is (Nine's importer reads it). File contents are
    hashed only when a file's size or time changed (tools/quick.py's store), so this takes a second or two."""
    import hashlib
    sys.path.insert(0, os.path.join(ROOT, "tools")) if os.path.join(ROOT, "tools") not in sys.path else None
    import quick
    hasher = quick.Hasher(os.path.join(ROOT, "kept", "quick"))
    mods = load_mods(); prof = load_profile(); order = resolve_order(mods, prof["enabled"])
    loader_code = sorted(glob.glob(os.path.join(ROOT, "*.py"))) + [os.path.join(ROOT, "tools")]
    h = hashlib.sha1()
    h.update(("build %s\nloader %s\n" % (game_build(), quick.loader_hash(loader_code, hasher))).encode())
    h.update(open(PROFILE, "rb").read() if os.path.exists(PROFILE) else b"")
    for mid in order: h.update(("mod %s %s\n" % (mid, hasher.tree(mdir(mid)))).encode())
    cf = os.environ.get("BBCF_DIR") or ""
    try: h.update(("bbcf %s %d\n" % (cf, os.stat(cf).st_mtime_ns if cf else 0)).encode())
    except OSError: h.update(("bbcf %s missing\n" % cf).encode())
    hasher.save()
    return h.hexdigest()

def game_files_stamp():
    """size and time of the game files an install writes; a hot load (tools/live.py), an uninstall, a game update or
    Steam's file check changes at least one of them"""
    out = {}
    for p in (os.path.join(AB, "merge.json"), os.path.join(AB, "m_mod.m"), os.path.join(AB, "manifest"), os.path.join(MOVIE, "MovieData.d")):
        try: st = os.stat(p); out[os.path.basename(p)] = [st.st_size, st.st_mtime_ns]
        except OSError: out[os.path.basename(p)] = None
    return out

PREBUILT = os.path.join(MODS, "redux-prebuilt")
LAUNCHER_FILES = os.path.join(os.path.dirname(ROOT), "Updater", "state", "Launcher.files.txt")

def stamp_loader(quick, hasher):
    """The loader as the ready-made build's stamp names it. In a Terminal, its Launcher's own file list as the updater
    keeps it (Updater\\state\\Launcher.files.txt, checked against the files at every update), output code only: a build
    adds files of its own beside the loader (importers copy tools in), so the folder itself differs from PC to PC.
    Elsewhere (the workspace, a sandbox without an updater), the loader's output code as tools/quick.py hashes it."""
    if os.path.exists(LAUNCHER_FILES):
        import hashlib
        rows = []
        for line in open(LAUNCHER_FILES, encoding="utf-8"):
            parts = line.rstrip("\n").split("  ", 1)
            if len(parts) != 2: continue
            sha, rel = parts; base = rel.rsplit("/", 1)[-1]
            if rel.startswith("shared/") or base in quick.NOT_OUTPUT or base.endswith("_test.py"): continue
            if rel.endswith(".py") or (rel.startswith("tools/schema/") and rel.endswith(".json")): rows.append(rel + " " + sha)
        return "list " + hashlib.sha1("\n".join(sorted(rows)).encode("utf-8")).hexdigest()
    loader_code = sorted(glob.glob(os.path.join(ROOT, "*.py"))) + [os.path.join(ROOT, "tools")]
    return quick.loader_hash(loader_code, hasher)

def _quick():
    sys.path.insert(0, os.path.join(ROOT, "tools")) if os.path.join(ROOT, "tools") not in sys.path else None
    import quick
    return quick

def current_settings(mods, order):
    used = _modsettings().apply(mods, _modsettings().read(PROFILE))
    return {m: used[m] for m in order if m in used}

def mod_stamps(order, mods, settings, writes, quick, hasher, loader):
    """each mod's ready-made-stage stamp: the game build, the loader (stamp_loader), its folder (the files its own build
    writes there left out), its options and the stamps of the mods it depends on"""
    import hashlib
    out = {}
    for m in order:
        h = hashlib.sha1()
        h.update(("build %s\nloader %s\nfolder %s\n" % (game_build(), loader, hasher.tree(mdir(m), (writes or {}).get(m, [])))).encode())
        h.update(json.dumps((settings or {}).get(m), sort_keys=True, default=str).encode("utf-8"))
        for d in mods[m].get("dependencies", []): h.update(("dep %s %s\n" % (d, out.get(d, "absent"))).encode())
        out[m] = h.hexdigest()
    return out

def current_stamp(writes=None):
    """What a build of the enabled mods is made from, as the ready-made build's stamp.json records it: the game build,
    the loader's output code, the set of mods, their options and each mod's stage stamp (mod_stamps)."""
    quick = _quick(); hasher = quick.Hasher(os.path.join(ROOT, "kept", "quick"))
    mods = load_mods(); prof = load_profile(); order = resolve_order(mods, prof["enabled"])
    settings = current_settings(mods, order); loader = stamp_loader(quick, hasher)
    stamp = {"gameBuild": game_build(), "loader": loader, "order": sorted(order),
             "settings": json.loads(json.dumps(settings, sort_keys=True, default=str)),
             "mods": mod_stamps(order, mods, settings, writes, quick, hasher, loader)}
    hasher.save()
    return stamp, settings

def prebuilt_stages():
    """{mod: (its stage folder, stage.json)} of the channel's ready-made stages (mods\\redux-prebuilt\\stages) whose
    stamp is this PC's for that mod: quick.mod_stages puts those back instead of making them"""
    base = os.path.join(PREBUILT, "stages")
    if not os.path.isdir(base) or FULL: return {}
    found = {}
    for m in os.listdir(base):
        try: found[m] = (os.path.join(base, m), json.load(open(os.path.join(base, m, "stage.json"), encoding="utf-8")))
        except (OSError, ValueError): pass
    if not found: return {}
    quick = _quick(); hasher = quick.Hasher(os.path.join(ROOT, "kept", "quick"))
    mods = load_mods(); order = resolve_order(mods, load_profile()["enabled"])
    stamps = mod_stamps(order, mods, current_settings(mods, order), {m: st.get("writes", []) for m, (_, st) in found.items()},
                        quick, hasher, stamp_loader(quick, hasher))
    hasher.save()
    return {m: v for m, v in found.items() if m in stamps and v[1].get("stamp") == stamps[m]}

def prebuilt_source():
    """(stamp, why): the channel's ready-made build (mods\\redux-prebuilt, delivered by the updater like a mod) when it
    was made from exactly what this install would build; otherwise (None, the reason)."""
    sp = os.path.join(PREBUILT, "stamp.json")
    if not (os.path.exists(sp) and os.path.isdir(os.path.join(PREBUILT, "stages"))): return None, None
    if FULL: return None, "a full build was asked for"
    try: want = json.load(open(sp, encoding="utf-8"))
    except (OSError, ValueError) as e: return None, "its stamp cannot be read (%s)" % e
    have, settings = current_stamp(want.get("writes", {}))
    names = {"gameBuild": "game build", "loader": "loader", "order": "set of mods", "settings": "choice of mod options"}
    for k in ("gameBuild", "loader", "order", "settings"):
        if want.get(k) != have[k]: return None, "it was made for another %s" % names[k]
    diff = [m for m in have["mods"] if want.get("mods", {}).get(m) != have["mods"][m]]
    if diff: return None, "these mods are not the channel's copies: " + ", ".join(diff[:6])
    SETTINGS_USED.clear(); SETTINGS_USED.update(settings)
    return want, "game build %s, %d mods" % (have["gameBuild"], len(have["order"]))

def prebuilt_files(stamp):
    """{logical file: its path in the ready-made build}: every mod's stage in load order, the composed files over them"""
    files = {}
    for root in [os.path.join(PREBUILT, "stages", m, "out") for m in stamp["layOrder"]] + [os.path.join(PREBUILT, "composed")]:
        for d, _, fs in os.walk(root):
            for f in fs:
                p = os.path.join(d, f); files[os.path.relpath(p, root).replace("\\", "/")] = p
    return files

def write_mod_file(files):
    """m_mod.m and merge.json from {logical file: path} (bundle files only; names starting with "_" are the build's own
    records), as make_patch.install_steam writes them from patch_out, streamed to the disk instead of held in memory"""
    _mp["require_usable_backup"](_mp["MERGE_BAK"], "install")
    if not os.path.exists(_mp["MERGE_BAK"]): _mp["make_backup"](_mp["MERGE"], _mp["MERGE_BAK"])
    entries = json.load(open(_mp["MERGE_BAK"], encoding="utf-8")); idx = {e["r"]: e for e in entries}
    modfile = _mp["MODFILE"]; tmp_m, tmp_j = os.path.join(AB, modfile + ".new"), _mp["MERGE"] + ".new"
    n = pos = 0
    # the files are opened side by side: a file the build has just written is checked by the PC's virus scanner when it is
    # first opened, and one after another those waits came to ~10 s for 3,700 files (2026-11-07; 1 s once scanned)
    import concurrent.futures
    names = [l for l in sorted(files) if not l.rsplit("/", 1)[-1].startswith("_")]
    def read(l):
        with open(files[l], "rb") as f: return f.read()
    with open(tmp_m, "wb") as out, concurrent.futures.ThreadPoolExecutor(max_workers=16) as tp:
        for logical, data in zip(names, tp.map(read, names)):
            if logical not in idx:
                e = {"r": logical, "m": modfile, "s": 0}; entries.append(e); idx[logical] = e
            e = idx[logical]; e["m"] = modfile; e["s"] = type(e["s"])(pos) if not isinstance(e["s"], str) else str(pos)
            out.write(data); pos += len(data); n += 1
    with open(tmp_j, "w", encoding="utf-8") as f: json.dump(entries, f, separators=(",", ":"), ensure_ascii=False)
    os.replace(tmp_m, os.path.join(AB, modfile)); os.replace(tmp_j, _mp["MERGE"])
    print("installed %d bundles into %s (%.0f MB); merge.json updated" % (n, os.path.join(AB, modfile), pos / 2 ** 20))

def local_sound_list(path):
    """the ready-made build's sound list with its "{ROOT}" paths made this loader folder's"""
    try: lst = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError): return {}
    def local(v):
        if v.startswith("{PREBUILT}/"): return os.path.join(PREBUILT, *v[len("{PREBUILT}/"):].split("/"))
        if v.startswith("{ROOT}/"): return os.path.join(ROOT, *v[len("{ROOT}/"):].split("/"))
        return v
    return {k: local(v) for k, v in lst.items()}

def export_prebuilt(dest):
    """After a build of the channel's set (bbmod.py build): its ready-made build into dest: stages\\<mod>\\ (the mod's
    clones and importer output as kept\\quick holds them, with stage.json), composed\\ (what the build's later steps made or
    changed, compared with the stages) and stamp.json."""
    import hashlib
    if not os.path.exists(os.path.join(OUT, "_build.json")): raise SystemExit("no finished build in %s: run bbmod.py build first" % OUT)
    mods = load_mods(); order = resolve_order(mods, load_profile()["enabled"])
    recs = {}
    for m in order:
        try: recs[m] = json.load(open(os.path.join(ROOT, "kept", "quick", m, "quick.json"), encoding="utf-8"))
        except (OSError, ValueError): pass
    writes = {m: r.get("writes", []) for m, r in recs.items()}
    stamp, settings = current_stamp(writes); stamp["writes"] = writes; stamp["made"] = time.strftime("%Y-%m-%d %H:%M:%S")
    built = json.load(open(os.path.join(OUT, "_build.json"), encoding="utf-8"))
    if built.get("mods") and sorted(built["mods"]) != stamp["order"]: raise SystemExit("the build in %s is of another set of mods" % OUT)
    for sub in ("stages", "composed", "out"):
        if os.path.exists(os.path.join(dest, sub)): shutil.rmtree(os.path.join(dest, sub))
    staged = {}                                          # rel -> sha1 of the version the stages, laid in order, leave
    stamp["layOrder"] = []
    for m in order:
        r = recs.get(m); src = os.path.join(ROOT, "kept", "quick", m, "out")
        if not r or not os.path.isdir(src): continue
        shutil.copytree(src, os.path.join(dest, "stages", m, "out"))
        st = {k: r.get(k) for k in ("mod", "version", "files", "seeds", "writes", "cloneAdds", "importAdds", "took")}
        st["stamp"] = stamp["mods"][m]; st["made"] = stamp["made"]
        with open(os.path.join(dest, "stages", m, "stage.json"), "w", encoding="utf-8") as f: json.dump(st, f, indent=1)
        staged.update(r.get("files", {})); stamp["layOrder"].append(m)
    composed = 0
    for d, _, fs in os.walk(OUT):
        for f in fs:
            p = os.path.join(d, f); rel = os.path.relpath(p, OUT).replace("\\", "/")
            if rel in ("_build.json", "_movies.json"): continue
            h = hashlib.sha1(open(p, "rb").read()).hexdigest()
            if staged.get(rel) == h: continue
            q = os.path.join(dest, "composed", *rel.split("/")); os.makedirs(os.path.dirname(q), exist_ok=True)
            if rel == "_sounds.json":       # the sound files themselves travel with the build (an importer may have made
                lst = json.load(open(p, encoding="utf-8"))  # them outside every mod folder: DELTARUNE: Party's sheets)
                sd = os.path.join(dest, "sounds"); os.makedirs(sd, exist_ok=True)
                for k, v in lst.items(): shutil.copyfile(v, os.path.join(sd, k))
                json.dump({k: "{PREBUILT}/sounds/" + k for k in lst}, open(q, "w", encoding="utf-8"), indent=1)
            else: shutil.copyfile(p, q)
            composed += 1
    with open(os.path.join(dest, "stamp.json"), "w", encoding="utf-8") as f: json.dump(stamp, f, indent=1)
    print("ready-made build into %s: %d mod stages, %d composed files (game build %s)" % (dest, len(stamp["layOrder"]), composed, stamp["gameBuild"]))

def install():
    if STAGING: print("refusing: BBMOD_PROFILE/BBMOD_OUT set (staging build); unset them to install"); return
    blocked = gameslot_block()
    if blocked: print("REFUSING to install: " + blocked); return
    if game_running(): print("REFUSING to install: the game is running. Close it completely, then run install again."); return
    # nothing changed since the last install, and the game still holds it: done at once (2026-11-07: an install with
    # nothing new still took a minute: every kept mod copied back, every table encoded again, 450 MB written again)
    t_check = time.time()
    try:
        inputs = install_inputs(); last = json.load(open(LAST_INSTALL, encoding="utf-8")) if os.path.exists(LAST_INSTALL) else {}
    except Exception as e:
        inputs, last = None, {}; print("  (could not check for changes: %s; building)" % e)
    if (inputs and not FULL and last.get("inputs") == inputs and last.get("game") == game_files_stamp()
            and os.path.exists(INSTALLED)):
        os.utime(INSTALLED, None)
        print("nothing changed since the install of %s: the game already has it (checked in %.1f s)"
              % (last.get("when", "?"), time.time() - t_check))
        print("installed; run the game and check", os.path.join(ROOT, "modlog.txt")); return
    # the channel's ready-made build, when it was made from exactly these mods, options, loader and game build: laid in
    # as it is, with nothing built here (the lead, 2026-11-07: "All loading and building needs to be near instant")
    src, why, ready = None, None, None
    try: ready, why = prebuilt_source()
    except Exception as e: why = "it could not be checked (%s)" % e
    movies = None
    if ready:
        rep = []; mods_now = load_mods(); movies = movie_specs(resolve_order(mods_now, load_profile()["enabled"]), mods_now, rep)
        if any(l.startswith(("CONFLICT", "ERROR")) for l in rep): why = "; ".join(rep)[:300]
        else:
            src = "ready"; print("the channel's ready-made build matches (%s): installed as it is, nothing built" % why)
    if not src:
        if why: print("  (the channel's ready-made build is not used: %s)" % why)
        if not build(): return
        src = OUT
        if os.path.exists(os.path.join(OUT, "_build.json")): os.remove(os.path.join(OUT, "_build.json"))
        mv = os.path.join(OUT, "_movies.json"); movies = json.load(open(mv, encoding="utf-8")); os.remove(mv)
    if game_running():
        print("REFUSING to install: the game was started during the build. Nothing in the game folder was changed. "
              "Close the game completely, then run install again."); return
    t_in = [time.time()]
    def iphase(name):
        now = time.time(); print("  [%.1f s] %s" % (now - t_in[0], name)); t_in[0] = now
    import portable_sounds
    if src == "ready":
        files = prebuilt_files(ready); write_mod_file(files); iphase("bundles written into m_mod.m")
        import tempfile as _tf
        sdir = _tf.mkdtemp(prefix="bbmod_sounds_")
        json.dump(local_sound_list(files["_sounds.json"]) if "_sounds.json" in files else {}, open(os.path.join(sdir, portable_sounds.LIST), "w"))
        sound_src, madd = sdir, files.get("_manifest_add.json", os.path.join(sdir, "_none.json"))
    else:
        files = {}
        for d, _, fs in os.walk(src):
            for f in fs: p = os.path.join(d, f); files[os.path.relpath(p, src).replace("\\", "/")] = p
        write_mod_file(files); iphase("bundles written into m_mod.m")
        sound_src, madd = src, os.path.join(src, "_manifest_add.json")
    import live; n = live.remove_live_files(AB)        # m_mod.m holds everything again (tools/live.py)
    if n: print("removed %d live file(s): m_mod.m holds everything again" % n)
    portable_sounds.place(sound_src, portable_sounds.game_folder(ROOT))
    iphase("live files and sounds")
    install_movies(movies); iphase("movies")
    import bbchar
    if os.path.exists(madd): bbchar.apply_manifest_additions(json.load(open(madd)))
    else: bbchar.restore_manifest()
    iphase("manifest")
    prof = load_profile(); known = load_mods()
    # the version of each mod as it went in: a newer copy of an installed mod can then be told from the one in the game
    versions = {m: str(known[m]["version"]) for m in prof["enabled"] if m in known}
    json.dump({"gameBuild": game_build(), "enabled": prof["enabled"], "versions": versions, "installed": time.strftime("%Y-%m-%d %H:%M:%S")}, open(INSTALLED, "w"), indent=1)
    _modsettings().record(SETTINGS_USED, INSTALLED)
    if inputs:     # what this install was made from and what it left in the game: the next install with nothing new stops at once
        os.makedirs(os.path.dirname(LAST_INSTALL), exist_ok=True)
        with open(LAST_INSTALL + ".new", "w", encoding="utf-8") as f:
            json.dump({"inputs": inputs, "game": game_files_stamp(), "when": time.strftime("%Y-%m-%d %H:%M:%S")}, f, indent=1)
        os.replace(LAST_INSTALL + ".new", LAST_INSTALL)
    print("installed; run the game and check", os.path.join(ROOT, "modlog.txt"))
def uninstall():
    if STAGING: print("refusing: BBMOD_PROFILE/BBMOD_OUT set (staging build)"); return
    blocked = gameslot_block()
    if blocked: print("REFUSING to uninstall: " + blocked); return
    if game_running(): print("REFUSING to uninstall: the game is running. Close it completely, then run uninstall again."); return
    _mp["uninstall_steam"]()
    if os.path.join(ROOT, "tools") not in sys.path: sys.path.insert(0, os.path.join(ROOT, "tools"))
    import live; live.remove_live_files(AB)
    import portable_sounds; portable_sounds.clear(portable_sounds.game_folder(ROOT))
    remove_movies()
    import bbchar; bbchar.restore_manifest()
    if os.path.exists(INSTALLED): os.remove(INSTALLED)
    if os.path.exists(LAST_INSTALL): os.remove(LAST_INSTALL)
    print("uninstalled (pristine merge.json restored, m_mod.m removed)")

def status():
    prof = load_profile(); mods = load_mods()
    print("game build:", game_build(), "| merge.json.orig present:", os.path.exists(os.path.join(AB, "merge.json.orig")), "| m_mod.m present:", os.path.exists(os.path.join(AB, "m_mod.m")))
    print("installed:", json.load(open(INSTALLED)) if os.path.exists(INSTALLED) else "nothing recorded")
    print("enabled:", prof["enabled"]); print("available:", sorted(mods))
def list_mods():
    prof = load_profile()
    for mid, m in load_mods().items():
        c = m.get("content", {})
        print(f"[{'x' if mid in prof['enabled'] else ' '}] {mid} v{m['version']} - {m['name']}  (tables {list(c.get('tables', {}))}, js {len(c.get('js', []))}+{len(c.get('jsFiles', {}))}, locale {list(c.get('locale', {}))}, deps {m.get('dependencies', [])})")
def doctor():
    status()
    if os.path.exists(PLAYER_LOG):
        log = open(PLAYER_LOG, encoding="utf-8", errors="replace").read().splitlines()
        bad = [l for l in log if re.search(r"SyntaxError|c# exception|ReferenceError|TypeError: |is not a function|Cannot read", l)]
        print(f"Player.log: {len(log)} lines; JS-ish errors: {len(bad)}"); [print("  ", l[:200]) for l in bad[:10]]
    ml = os.path.join(ROOT, "modlog.txt")
    if os.path.exists(ml):
        lines = open(ml, encoding="utf-8", errors="replace").read().splitlines(); print(f"modlog.txt: {len(lines)} lines; last:"); [print("  ", l[:160]) for l in lines[-8:]]
def report():
    """compact session report: errors/exceptions from Player.log + the full modlog, written to reports/<timestamp>.md"""
    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True); out = os.path.join(ROOT, "reports", time.strftime("%Y%m%d-%H%M%S") + ".md")
    lines = ["# BBEE session report " + time.strftime("%Y-%m-%d %H:%M"), ""]
    if os.path.exists(PLAYER_LOG):
        log = open(PLAYER_LOG, encoding="utf-8", errors="replace").read().splitlines()
        lines += [f"## Player.log ({len(log)} lines)", ""]
        keep = re.compile(r"SyntaxError|c# exception|Exception: |TypeError|ReferenceError|unhandledRejection|\|Error\||Missing localization|Texture Original Size|表格.*没有找到|AcquireWindow (?!Instructions|InputLock|OverlayInfoUI|FloatingUI|MessageRoller)")
        i = 0; shown = 0
        while i < len(log) and shown < 400:
            l = log[i]
            if keep.search(l):
                block = [l.strip()]
                for j in range(1, 6):
                    if i + j < len(log) and log[i + j].startswith("    at "): block.append(log[i + j].strip())
                lines.append("- " + " ⏎ ".join(block)[:600]); shown += 1
            i += 1
    ml = os.path.join(ROOT, "modlog.txt")
    if os.path.exists(ml):
        mlines = open(ml, encoding="utf-8", errors="replace").read().splitlines()
        lines += ["", f"## modlog.txt ({len(mlines)} lines)", ""] + ["    " + l for l in mlines[-5000:]]
    lines += ["", "## installed", "", "    " + json.dumps(json.load(open(INSTALLED)) if os.path.exists(INSTALLED) else {})]
    open(out, "w", encoding="utf-8").write("\n".join(lines)); print("report written:", out, f"({len(lines)} lines)")
def new_mod(mid):
    d = os.path.join(MODS, mid); os.makedirs(os.path.join(d, "files"), exist_ok=True)
    json.dump({"id": mid, "name": mid, "version": "0.1.0", "author": "", "description": "", "gameBuilds": [game_build()], "dependencies": [],
               "content": {"tables": {}, "locale": {"enu": {}}, "js": [], "jsFiles": {}}}, open(os.path.join(d, "mod.json"), "w", encoding="utf-8"), indent=1)
    print("created", d)





LOCK = os.path.join(MODS, ".bbmod.lock")
def _pid_alive(pid):
    if not pid: return False
    if os.name == "nt":
        import ctypes
        h = ctypes.windll.kernel32.OpenProcess(0x1000, False, int(pid))
        if not h: return False
        code = ctypes.c_ulong(); ok = ctypes.windll.kernel32.GetExitCodeProcess(h, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(h)
        return bool(ok) and code.value == 259
    try: os.kill(int(pid), 0); return True
    except OSError: return False
def acquire_lock(what, wait_s=900):
    import time
    t0 = time.time(); said = 0
    while True:
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, json.dumps({"pid": os.getpid(), "cmd": what, "since": time.strftime("%H:%M:%S")}).encode()); os.close(fd)
            return True
        except FileExistsError:
            try: info = json.load(open(LOCK, encoding="utf-8"))
            except Exception: info = {}
            if not _pid_alive(info.get("pid")):
                print(f"  (clearing a stale build lock from pid {info.get('pid')})");
                try: os.remove(LOCK)
                except OSError: pass
                continue
            if time.time() - t0 > wait_s:
                print(f"refusing: another session's bbmod {info.get('cmd')} (pid {info.get('pid')}, since {info.get('since')}) "
                      f"still holds {LOCK} after {wait_s}s"); return False
            if time.time() - said > 15:
                print(f"  waiting: another session's bbmod {info.get('cmd')} is running (pid {info.get('pid')}, since {info.get('since')})")
                said = time.time()
            time.sleep(2)
def release_lock():
    try:
        info = json.load(open(LOCK, encoding="utf-8"))
        if info.get("pid") == os.getpid(): os.remove(LOCK)
    except Exception: pass
def locked(fn, what):
    if not acquire_lock(what): sys.exit(1)
    try: return fn()
    finally: release_lock()

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "status": status()
    elif cmd == "list": list_mods()
    elif cmd == "enable": p = load_profile(); [p["enabled"].append(i) for i in sys.argv[2:] if i not in p["enabled"]]; save_profile(p); print(p)
    elif cmd == "disable": p = load_profile(); p["enabled"] = [i for i in p["enabled"] if i not in sys.argv[2:]]; save_profile(p); print(p)
    elif cmd == "build": locked(build, "build")
    elif cmd == "install": locked(install, "install")
    elif cmd == "live":         # add or update mods while the game is open (tools/live.py)
        sys.path.insert(0, os.path.join(ROOT, "tools")); import live
        sys.exit(locked(lambda: live.run(sys.modules[__name__], sys.argv[2:]), "live"))
    elif cmd == "uninstall": locked(uninstall, "uninstall")
    elif cmd == "doctor": doctor()
    elif cmd == "new": new_mod(sys.argv[2])
    elif cmd == "report": report()
    elif cmd == "prebuilt-export": export_prebuilt(sys.argv[2])
    elif cmd == "_rigs":
        rep = []; adds = {"names": [], "entries": [], "guids": []}
        arg = sys.argv[2]; a_rest = sys.argv[3:]
        # --part k/n: every n-th spec from the k-th; --adds <file>: each spec's additions by index
        pk, pn = (int(x) for x in (a_rest[a_rest.index("--part") + 1] if "--part" in a_rest else "0/1").split("/"))
        adds_file = a_rest[a_rest.index("--adds") + 1] if "--adds" in a_rest else None
        by_index = {}
        for i, (mid, spec) in enumerate(json.load(open(arg[1:], encoding="utf-8")) if arg.startswith("@") else json.loads(arg)):
            if i % pn != pk: continue
            a = clone_one(mid, spec, OUT, rep)
            for k in ("names", "entries", "guids"): adds[k] += a[k]
            by_index[i] = a
        if adds_file: json.dump(by_index, open(adds_file, "w"))
        else: json.dump(adds, open(os.path.join(OUT, "_manifest_add.json"), "w"), indent=1)
        [print(l) for l in rep]
    elif cmd == "_rigserve":
        # a ClonePool worker: one job per stdin line {"specs": [[index, mod, spec], ...], "out": folder, "adds": file};
        # what the clones print goes to the log file argv[2]; "DONE" (or "FAILED <why>") answers each job on stdout
        proto = sys.stdout; logf = open(sys.argv[2], "a", encoding="utf-8", errors="replace"); sys.stdout = logf
        import bbchar
        for line in sys.stdin:
            if not line.strip(): continue
            try:
                job = json.loads(line); rep = []; by_index = {}
                for i, mid, spec in job["specs"]: by_index[i] = clone_one(mid, spec, job["out"], rep)
                for l in rep: print(l)
                json.dump(by_index, open(job["adds"], "w")); logf.flush()
                proto.write("DONE\n"); proto.flush()
            except BaseException as e:
                import traceback; traceback.print_exc(file=logf); logf.flush()
                proto.write("FAILED %s\n" % str(e).replace("\n", " ")[:300]); proto.flush()
    elif cmd == "_assets":
        rep = []; compose_assets(json.loads(sys.argv[2]), load_mods(), rep); [print(l) for l in rep]; sys.exit(1 if any(l.startswith("ERROR") for l in rep) else 0)
    else: print(__doc__)
