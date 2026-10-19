r"""bbrig.py -- turn a rig spec (sprite frames + animation lists) into Spine data and inject it into cloned rig bundles.

  python bbrig.py build <rigs\name.json> <out_dir>     build only (writes <out_dir>\<name>.{json,atlas,png})
  python bbrig.py inject <rigs\name.json> <patch_out>  build + inject into patch_out\actor\spine\<name>\*.ab

Spec (rigs\<name>.json):
  { "source": "<frames dir>", "prefix": "o_sol_", "ext": ".bmp", "pad": 4, "fps": 60, "scale": 0.01,
    "animations": { "P/stand": {"frames": [0,1,2], "hold": 6, "loop": true}, ... } }
`frames` entries may be ints (formatted with prefix+zero-padded number+ext) or literal filenames.
Animation names must match the `Animate` strings the ActionLogicGroup uses.
"""
import os, sys, json, shutil
import bbspine

def expand(spec):
    pref, ext, pad = spec.get("prefix", ""), spec.get("ext", ".png"), spec.get("pad", 4)
    out = {}
    for an, a in spec["animations"].items():
        fr = [f if isinstance(f, str) else f"{pref}{f:0{pad}d}{ext}" for f in a["frames"]]
        out[an] = dict(a, frames=fr, hold=a.get("hold", 4), loop=a.get("loop", False))   # keep any other per-animation keys the spec sets
    return {"fps": spec.get("fps", 60), "animations": out}

def build(spec_path, out_dir):
    spec = json.load(open(spec_path, encoding="utf-8")); name = os.path.splitext(os.path.basename(spec_path))[0]
    os.makedirs(out_dir, exist_ok=True)
    info = bbspine.build(spec["source"], expand(spec), out_dir, name, page=spec.get("page", 4096))
    missing = []
    for a in spec["animations"].values():
        for f in a["frames"]:
            fn = f if isinstance(f, str) else f"{spec.get('prefix','')}{f:0{spec.get('pad',4)}d}{spec.get('ext','.png')}"
            if not os.path.exists(os.path.join(spec["source"], fn)): missing.append(fn)
    if missing: print("  MISSING FRAMES:", sorted(set(missing))[:12], f"({len(set(missing))} total)")
    print(f"  built {name}: {info}")
    return name, info

def inject(spec_path, patch_out):
    """replace the cloned rig's skeleton TextAsset (JSON), atlas TextAsset and atlas Texture2D with the built ones"""
    import UnityPy
    from PIL import Image
    spec = json.load(open(spec_path, encoding="utf-8")); name = os.path.splitext(os.path.basename(spec_path))[0]
    tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rigs", "_build", name)
    build(spec_path, tmp)
    base = os.path.join(patch_out, "actor", "spine", name)
    skel_json = open(os.path.join(tmp, name + ".json"), "rb").read()
    atlas_txt = open(os.path.join(tmp, name + ".atlas"), "rb").read()
    png = Image.open(os.path.join(tmp, name + ".png")).convert("RGBA")

    def edit(bundle, fn):
        p = os.path.join(base, bundle); env = UnityPy.load(p); touched = fn(env)
        if touched: open(p, "wb").write(env.file.save(packer="lz4"))
        return touched

    def set_skel(env):
        hit = False
        for o in env.objects:
            if o.type.name == "TextAsset":
                d = o.read(); d.m_Name = name              # no ".skel" -> spine-unity parses it as JSON
                d.m_Script = skel_json.decode("utf-8", "surrogateescape"); d.save(); hit = True
        return hit
    def set_atlas(env):
        hit = False
        for o in env.objects:
            if o.type.name == "TextAsset":
                d = o.read(); d.m_Name = name + ".atlas"
                d.m_Script = atlas_txt.decode("utf-8", "surrogateescape"); d.save(); hit = True
        return hit
    def set_tex(env):
        hit = False
        for o in env.objects:
            if o.type.name == "Texture2D":
                d = o.read(); d.m_Name = name
                d.set_image(png) if hasattr(d, "set_image") else setattr(d, "image", png)
                d.save(); hit = True
        return hit
    def set_scale(env):
        hit = False
        for o in env.objects:
            if o.type.name == "MonoBehaviour":
                t = o.read_typetree()
                if "atlasAssets" in t and "scale" in t:
                    t["m_Name"] = name + "_SkeletonData"; t["scale"] = spec.get("scale", 0.01); o.save_typetree(t); hit = True
        return hit

    r = {"skel": edit(f"{name}.skel.ab", set_skel), "atlas": edit(f"{name}.atlas.ab", set_atlas),
         "tex": edit(f"{name}.ab", set_tex), "skeletondata": edit(f"{name}_skeletondata.ab", set_scale)}
    r["actions"] = remap_actions(spec, name, patch_out)
    print(f"  injected {name}: {r}")
    return r

def remap_actions(spec, name, patch_out):
    """The cloned ActionLogicGroup references the DONOR's animation names. Point every action at an animation this rig
    actually has: explicit spec["animationMap"] first, then a fallback (default 'P/stand'), so nothing asks Spine for a
    missing clip. Also renames the asset and its RoleName to the new character."""
    import UnityPy
    sys.argv_backup = sys.argv; sys.argv = ["x"]
    import bbmod as _bb
    sys.argv = sys.argv_backup
    have = set(spec["animations"].keys()); amap = spec.get("animationMap", {}); fb = spec.get("animationFallback", "P/stand")
    actmap = spec.get("actionMap", {})   # action name -> one of OUR animations (takes priority; the donor's own name is often unrelated)
    p = os.path.join(patch_out, "actor", "logicdata", name + ".ab")
    if not os.path.exists(p): return {"error": "no cloned logicdata at " + p}
    env = UnityPy.load(p); env.typetree_generator = _bb.typetree_gen(); stats = {"kept": 0, "mapped": 0, "fallback": 0}
    for o in env.objects:
        if o.type.name != "MonoBehaviour": continue
        t = o.read_typetree()
        if "_actions" not in t: continue
        if "references" in t: t["references"]["RefIds"] = [x for x in t["references"]["RefIds"] if x.get("type", {}).get("class") != ""]
        t["m_Name"] = name
        for a in t["_actions"]:
            an = a.get("Animate", "")
            if not an: continue
            if a["Name"] in actmap and actmap[a["Name"]] in have: a["Animate"] = actmap[a["Name"]]; stats["mapped"] += 1
            elif an in have: stats["kept"] += 1
            elif an in amap and amap[an] in have: a["Animate"] = amap[an]; stats["mapped"] += 1
            else: a["Animate"] = fb; stats["fallback"] += 1
        o.save_typetree(t); open(p, "wb").write(env.file.save(packer="lz4")); break
    return stats

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "build": build(sys.argv[2], sys.argv[3])
    elif cmd == "inject": inject(sys.argv[2], sys.argv[3])
