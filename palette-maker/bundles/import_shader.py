"""palette-maker importer: ships the colour maker's painter (uikit/Assets/Palette, PaletteBuild.cs) and its two screens
(uikit/Assets/PalMaker, PalMakerBuild.cs: UI/Prefab/PalMaker/PalMaker and PalHeroes) into the build.

bbmod runs it at build/install time as `import_shader.py --out <build dir> --adds <json>`. Each bundle beside this file
gets the game's container spelling (Assets/AssetBundle/Palette/PalRecolour.mat), goes into the build and gets a manifest
entry; the game loads it by its logical path "Palette/PalRecolour". The bundle holds its own shader: no dependencies.

Refresh the shipped copy after a Unity build with:  python mods/palette-maker/bundles/import_shader.py pack
"""
import os, sys, json, shutil
import UnityPy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
KITS = [os.path.join(ROOT, "uikit", "Build", k) for k in ("bundles_palette", "bundles_palmaker")]
CASE = {"assets": "Assets", "assetbundle": "AssetBundle", "palette": "Palette", "palrecolour": "PalRecolour", "shaders": "Shaders",
        "ui": "UI", "prefab": "Prefab", "palmaker": "PalMaker", "palheroes": "PalHeroes"}


def bundles(base):
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(".ab"):
                yield os.path.relpath(os.path.join(d, f), base).replace(os.sep, "/")[:-3]


def container_path(key):
    stem, ext = os.path.splitext(key)
    return "/".join(CASE.get(p, p) for p in stem.split("/")) + ext


def pack():
    n = 0
    for kit in KITS:
      for name in bundles(kit):
        dst = os.path.join(HERE, *name.split("/")) + ".ab"; os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(kit, *name.split("/")) + ".ab", dst); n += 1
        print("  packed", name, os.path.getsize(dst), "bytes")
    print("packed %d bundle(s) from uikit" % n)


def do_import(out, adds_path):
    adds = {"names": [], "entries": [], "guids": []}
    for name in bundles(HERE):
        env = UnityPy.load(os.path.join(HERE, *name.split("/")) + ".ab")
        for o in env.objects:
            if o.type.name == "AssetBundle":
                t = o.read_typetree()
                t["m_Container"] = [[container_path(k), v] for k, v in t["m_Container"]]
                t["m_Name"] = name + ".ab"; t["m_AssetBundleName"] = name + ".ab"; o.save_typetree(t)
        dst = os.path.join(out, *name.split("/")) + ".ab"; os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(env.file.save(packer="lz4"))
        adds["names"].append(name); adds["entries"].append((name, []))
        print("  painter bundle %s -> %s" % (name, dst))
    json.dump(adds, open(adds_path, "w"), indent=1)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "pack": pack()
    else:
        kw = dict(zip(a[0::2], a[1::2])); do_import(kw["--out"], kw["--adds"])
