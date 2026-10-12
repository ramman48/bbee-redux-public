"""bbvfx.py -- turn effects built in the Unity kit (vfxkit/) into bundles the game loads, using the game's OWN assets.

  pack   <kit build dir> <mod fx dir>
         Copies OUR effect bundles (effect/prefab/...) from the kit build into the mod, plus:
         - fxmap.json: for every external reference, the official (or Boons Plus clone) bundle it stands for, and the
           referenced objects by type and name;
         - clones.json: our material clones (an official material plus colour/float overrides, e.g. HDR water tints).
         Preview bundles (official materials, textures, meshes) are never copied: a mod package never carries game files.
  import --src <mod fx dir> --out <build folder> --adds <json>      (bbmod "importer", run at build time)
         1. builds each clone from the player's own copy of the official material (bbchar.clone_bundle material_props);
         2. re-points every reference in our effects (materials, meshes, textures) at the game's real object (CAB and
            path id read from the install) or at our clone;
         3. writes the bundles and returns manifest additions (dependencies: every referenced bundle and its own).
BBVFX_KIT selects another kit project (default vfxkit). Clone bundles are ours; everything else is the game's.
"""
import os, sys, json, shutil, hashlib
# (the loader's folder is the nearest one above that holds bbmod.py: a character packed for a mod loader carries its
#  own copy of this module inside its mod folder; in the workspace and a standalone package it is the folder it was)
_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next((p for p in (os.path.abspath(os.path.join(_HERE, *([".."] * k))) for k in range(1, 8)) if os.path.exists(os.path.join(p, "bbmod.py"))), os.path.abspath(os.path.join(_HERE, "..")))
sys.path.insert(0, ROOT)
_argv = list(sys.argv); sys.argv = ["x"]
import bbmod, bbchar
sys.argv = _argv
import UnityPy

KIT = os.environ.get("BBVFX_KIT") or os.path.join(ROOT, "vfxkit")
REF_TYPES = ("Material", "Mesh", "Texture2D")

def cab_of(env): return list(env.file.files.keys())[0]
def game_env(name): return UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(name + ".ab")))
def obj_name(o):
    try: return o.read().m_Name
    except Exception: return ""

OURS = "bp_"                                           # textures we author ourselves are named bp_*; they may ship

def pack(kit_build, dst, skip=()):
    names = [l.strip() for l in open(os.path.join(kit_build, "effects.txt"), encoding="utf-8") if l.strip()]
    fx = [n for n in names if n.startswith("effect/prefab/") and n.rsplit("/", 1)[-1] not in skip]
    cl = os.path.join(kit_build, "clones.json")
    clones = json.load(open(cl, encoding="utf-8")) if os.path.exists(cl) else []
    clone_from = {c["to"]: c["from"] for c in clones}
    placeholder = {}                                   # preview CAB -> (bundle it stands for, {path id: [type, name]})
    for m in names:
        if m in fx: continue
        env = UnityPy.load(os.path.join(kit_build, *m.split("/")))
        objs = {str(o.path_id): [o.type.name, obj_name(o)] for o in env.objects if o.type.name in REF_TYPES}
        if m in clone_from:                            # a clone holds the official material under its official name
            objs = {k: [t, clone_from[m].rsplit("/", 1)[-1] if t == "Material" else nm] for k, (t, nm) in objs.items()}
        placeholder[cab_of(env).lower()] = (m, objs)
    fxmap = {}
    shutil.rmtree(os.path.join(dst, "bundles"), ignore_errors=True)
    for n in fx:
        src = os.path.join(kit_build, *n.split("/")); env = UnityPy.load(src); sf = env.file.files[cab_of(env)]
        leaked = ["%s %s" % (o.type.name, obj_name(o)) for o in env.objects
                  if o.type.name in ("Material", "Shader") or (o.type.name in ("Texture2D", "Mesh") and not obj_name(o).startswith(OURS))]
        if leaked:                                     # the project rule: release packages never contain game files
            raise SystemExit("refusing to pack %s: it contains %s (give each a placeholder bundle in the kit build)" % (n, ", ".join(leaked[:6])))
        exts = []
        for e in sf.externals:
            cab = e.path.split("/")[-1].lower()
            exts.append({"path": e.path, "bundle": placeholder[cab][0], "objects": placeholder[cab][1]} if cab in placeholder else {"path": e.path})
        fxmap[n] = exts
        out = os.path.join(dst, "bundles", *n.split("/")) + ".ab"; os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.copyfile(src, out)
    json.dump(fxmap, open(os.path.join(dst, "fxmap.json"), "w", encoding="utf-8"), indent=1)
    # only the clones the packed effects use (a material clone, then the texture clones it points at)
    used = {e["bundle"] for exts in fxmap.values() for e in exts if e.get("bundle")}
    for c in clones:
        if c["to"] in used: used |= set((c.get("remapDeps") or {}).values())
    clones = [c for c in clones if c["to"] in used]
    shutil.rmtree(os.path.join(dst, "textures"), ignore_errors=True)
    kit_root = os.path.dirname(os.path.dirname(os.path.abspath(kit_build)))       # <kit>/Build/<dir> -> <kit>
    for c in clones:                                   # our own art (bp_* textures) ships with the mod
        if c.get("image"):
            os.makedirs(os.path.join(dst, os.path.dirname(c["image"])), exist_ok=True)
            shutil.copyfile(os.path.join(kit_root, c.pop("imageSource")), os.path.join(dst, c["image"]))
    json.dump(clones, open(os.path.join(dst, "clones.json"), "w", encoding="utf-8"), indent=1)
    print("packed %d effect bundles, %d material clones (%d preview bundles mapped, none copied) -> %s" % (len(fx), len(clones), len(placeholder), dst))

def container_path(name):
    """effect/prefab/benediction/boonsplus/water/bp_x -> Assets/AssetBundle/Effect/Prefab/Benediction/BoonsPlus/Water/bp_x.prefab"""
    fixed = {"effect": "Effect", "prefab": "Prefab", "benediction": "Benediction", "boonsplus": "BoonsPlus", "water": "Water", "radiation": "Radiation"}
    return "Assets/AssetBundle/" + "/".join(fixed.get(p, p) for p in name.split("/")) + ".prefab"

def do_import(src, out, adds_path):
    fxmap = json.load(open(os.path.join(src, "fxmap.json"), encoding="utf-8"))
    for exts in fxmap.values():                        # packs made before 2026-09-28 (materials only): same meaning
        for e in exts:
            if "official" in e and "bundle" not in e:
                e["bundle"] = e.pop("official"); e["objects"] = {pid: ["Material", nm] for pid, nm in e.pop("materials", {}).items()}
    cp = os.path.join(src, "clones.json")
    clones = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else []
    names, entries, _ = bbchar.read_manifest()
    deps = {names[int(i, 16)]: [names[int(d, 16)] for d in dd] for i, dd in entries}
    adds = {"names": [], "entries": [], "guids": []}
    clone_src, clone_deps = {}, {}
    for c in clones:                                   # 1. our texture/material clones, built from the player's own files
        a = bbchar.clone_bundle(c["from"], c["to"], out, material_props=c.get("props"), recolor=c.get("recolor"),
                                remap_deps=c.get("remapDeps"), image=os.path.join(src, c["image"]) if c.get("image") else None)
        for k in ("names", "entries", "guids"): adds[k] += a[k]
        clone_src[c["to"]] = c["from"]
        clone_deps[c["to"]] = next((d for n2, d in a["entries"] if n2 == c["to"]), [])
    target = {}                                        # bundle -> (CAB, {(type, lower name): path id})
    def resolve(bundle):
        if bundle not in target:
            env = game_env(clone_src.get(bundle, bundle))          # a clone keeps its source's path ids
            objs = {(o.type.name, obj_name(o).lower()): o.path_id for o in env.objects if o.type.name in REF_TYPES}
            for typ in REF_TYPES:                      # a bundle holding ONE object of a type: any name maps to it
                only = [pid for (t, _), pid in objs.items() if t == typ]           # (kit .obj meshes get their own names)
                if len(only) == 1: objs[(typ, "*")] = only[0]
            cab = ("CAB-" + hashlib.md5(bundle.encode()).hexdigest()) if bundle in clone_src else cab_of(env)
            target[bundle] = (cab, objs)
        return target[bundle]
    for n, exts in fxmap.items():                      # 2. re-point every reference
        env = UnityPy.load(os.path.join(src, "bundles", *n.split("/")) + ".ab"); sf = env.file.files[cab_of(env)]
        remap, need = {}, []
        for i, e in enumerate(exts):
            b = e.get("bundle")
            if not b: continue
            gcab, gobjs = resolve(b)
            old = sf.externals[i].path; sf.externals[i].path = old.replace(old.split("/")[-1], gcab)
            m = {}
            for pid, (typ, nm) in e["objects"].items():
                k = (typ, nm.lower())
                if k in gobjs: m[int(pid)] = gobjs[k]
                elif (typ, "*") in gobjs: m[int(pid)] = gobjs[(typ, "*")]
                elif nm != "Default-Material":         # Unity's own default on kit .obj meshes; nothing references it
                    print("  WARNING %s: %s '%s' not found in %s" % (n, typ, nm, b))
            remap[i + 1] = m; need.append(b)
        def walk(v):
            changed = False
            if isinstance(v, dict):
                if set(v) == {"m_FileID", "m_PathID"}:
                    m = remap.get(v["m_FileID"])
                    if m and v["m_PathID"] in m: v["m_PathID"] = m[v["m_PathID"]]; return True
                    return False
                for x in v.values(): changed |= walk(x)
            elif isinstance(v, list):
                for x in v: changed |= walk(x)
            return changed
        for o in env.objects:
            if o.type.name == "AssetBundle":
                t = o.read_typetree(); t["m_Container"] = [[container_path(n), v] for k, v in t["m_Container"]]
                walk(t["m_PreloadTable"])              # objects Unity loads first: must name the game's objects too
                # match the game's bundle header (explicit data layout 1, path flags 0, mixed-case paths). With Unity's
                # default (0 / 7) a lookup by the path finds nothing (checked in fxview, the same Unity runtime).
                t["m_PathFlags"] = 0
                t["m_ExplicitDataLayout"] = 1
                t["m_Name"] = n + ".ab"; t["m_AssetBundleName"] = n + ".ab"; o.save_typetree(t)
            elif o.type.name in ("ParticleSystem", "ParticleSystemRenderer", "MonoBehaviour", "MeshRenderer", "MeshFilter", "TrailRenderer", "LineRenderer"):
                t = o.read_typetree()
                if walk(t): o.save_typetree(t)
        dst = os.path.join(out, *n.split("/")) + ".ab"; os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(env.file.save(packer="lz4"))
        dep_list = []                                  # 3. manifest: every referenced bundle, then its dependencies
        for b in need:
            for d in [b] + (clone_deps[b] if b in clone_deps else deps.get(b, [])):
                if d not in dep_list: dep_list.append(d)
        adds["names"].append(n); adds["entries"].append((n, dep_list))
        print("  effect %s: %d referenced bundles, %d dependencies" % (n, len(need), len(dep_list)))
    json.dump(adds, open(adds_path, "w"), indent=1)

if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "pack": pack(a[1], a[2], skip=a[a.index("--skip") + 1].split(",") if "--skip" in a else ())
    elif a and a[0] == "import":
        kw = dict(zip(a[1::2], a[2::2])); do_import(kw["--src"], kw["--out"], kw["--adds"])
    else: print(__doc__)
