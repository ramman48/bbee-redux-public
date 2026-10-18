"""ex-common importer: ships the Unity-built EX select bundle (exkit/, the Void Gate) into the build.

bbmod runs it at build/install time as `import_ui.py --out <build dir> --adds <json>`. For every bundle under ui/bundles/
it rewrites the AssetBundle container to the game's path convention (Assets/AssetBundle/UI/Prefab/EX/<Name>.prefab, as the
game's own bundles spell it), writes the bundle into the build and records a manifest entry. The bundle is self-contained:
its own generated textures, sprites and animation, and only Unity's UI scripts. It holds no game art; the mod's JS assigns
Susanoo's illustration from the player's install at runtime.

Refresh the shipped copy after a Unity build (exkit: EXSelectBuild.BuildAll) with:
  python mods/ex-common/ui/import_ui.py pack
"""
import os, sys, json, shutil
import UnityPy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(HERE, "bundles")
KIT = os.path.join(ROOT, "exkit", "Build", "bundles")
CASE = {"assets": "Assets", "assetbundle": "AssetBundle", "ui": "UI", "prefab": "Prefab", "ex": "EX", "exselect": "EXSelect"}


def bundles(base):
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(".ab"):
                yield os.path.relpath(os.path.join(d, f), base).replace("\\", "/")[:-3]


def container_path(key):
    stem, ext = os.path.splitext(key)
    return "/".join(CASE.get(p, p) for p in stem.split("/")) + ext


def pack():
    if os.path.isdir(SRC): shutil.rmtree(SRC)
    n = 0
    for name in bundles(KIT):
        dst = os.path.join(SRC, *name.split("/")) + ".ab"; os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(KIT, *name.split("/")) + ".ab", dst); n += 1
        print("  packed", name, os.path.getsize(dst), "bytes")
    print("packed %d UI bundle(s) from exkit into %s" % (n, SRC))


def do_import(out, adds_path):
    adds = {"names": [], "entries": [], "guids": []}
    for name in bundles(SRC):
        env = UnityPy.load(os.path.join(SRC, *name.split("/")) + ".ab")
        for o in env.objects:
            if o.type.name == "AssetBundle":
                t = o.read_typetree()
                t["m_Container"] = [[container_path(k), v] for k, v in t["m_Container"]]
                t["m_Name"] = name + ".ab"; t["m_AssetBundleName"] = name + ".ab"; o.save_typetree(t)
        dst = os.path.join(out, *name.split("/")) + ".ab"; os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(env.file.save(packer="lz4"))
        adds["names"].append(name); adds["entries"].append((name, []))
        print("  UI bundle %s -> %s" % (name, dst))
    json.dump(adds, open(adds_path, "w"), indent=1)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "pack": pack()
    else:
        kw = dict(zip(a[0::2], a[1::2])); do_import(kw["--out"], kw["--adds"])
