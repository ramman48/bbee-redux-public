r"""prebuilt_replay.py -- puts a character's ready-made importer output into the build (the loader runs it as an importer).

  python mods/<id>/prebuilt_replay.py --out <build folder> --adds <json path>

This mod's real importers (mod.json: content.importersSource) read another game's install, which no dev or tester
needs to have (the lead, 2026-10-24). The mod folder carries what they made on the Redux team's PC instead
(tools\prebuilt_importers.py, which also puts this copy of tools\prebuilt_replay.py here), in prebuilt\ beside this file:
  - each file is copied into the build folder;
  - the cue sheets in prebuilt\audio are added to the build's data\audiocollection (whatever another mod already put in
    it is kept), with the full path of the .acb in this mod folder;
  - the manifest additions are handed back to the loader.
Made for one game build (prebuilt\prebuilt.json): after a game update the team sends a new one.
"""
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "prebuilt")
COLLECTION = "data/audiocollection.ab"


def loader():
    """the loader this mod is installed in (bbmod.py two or more folders up), imported as a module"""
    d = HERE
    for _ in range(6):
        d = os.path.dirname(d)
        if os.path.exists(os.path.join(d, "bbmod.py")):
            argv, sys.argv = sys.argv, ["x"]
            sys.path.insert(0, d)
            import bbmod
            sys.argv = argv
            return bbmod
    raise SystemExit("prebuilt: no bbmod.py above %s" % HERE)


def add_sheets(out, sheets):
    bbmod = loader()
    import UnityPy
    built = os.path.join(out, *COLLECTION.split("/"))
    if os.path.exists(built):
        with open(built, "rb") as f: env = UnityPy.load(f.read())
    else:
        env = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(COLLECTION)))
    env.typetree_generator = bbmod.typetree_gen()
    mb = next(o for o in env.objects if o.type.name == "MonoBehaviour")
    t = mb.read_typetree()
    ours = {s["Name"] for s in sheets}
    t["ListCueSheet"] = [s for s in t["ListCueSheet"] if s["Name"] not in ours]
    taken = {c["Name"] for s in t["ListCueSheet"] for l in s["Linguals"] for c in l["Cues"]}
    next_id = max(s["Id"] for s in t["ListCueSheet"]) + 1
    for s in sheets:
        clash = [c["Name"] for l in s["Linguals"] for c in l["Cues"] if c["Name"] in taken]
        if clash: raise SystemExit("prebuilt: cue names already in the collection: %s" % clash[:5])
        if next_id >= 1000: raise SystemExit("prebuilt: no cue sheet id left under 1000")
        s = json.loads(json.dumps(s))
        s["Id"] = next_id
        for l in s["Linguals"]:
            l["_acbPath"] = os.path.join(DATA, *l["_acbPath"].split("/"))
            if not os.path.isfile(l["_acbPath"]): raise SystemExit("prebuilt: missing %s" % l["_acbPath"])
        t["ListCueSheet"].append(s)
        taken.update(c["Name"] for l in s["Linguals"] for c in l["Cues"])
        next_id += 1
    mb.save_typetree(t)
    os.makedirs(os.path.dirname(built), exist_ok=True)
    with open(built, "wb") as f: f.write(env.file.save(packer="lz4"))
    print("prebuilt: audio collection +%s" % ", ".join(sorted(ours)))


def main():
    kw = dict(zip(sys.argv[1::2], sys.argv[2::2]))
    if "--out" not in kw: print(__doc__); sys.exit(2)
    with open(os.path.join(DATA, "prebuilt.json"), encoding="utf-8") as f: meta = json.load(f)
    for rel, digest in meta["files"].items():
        src = os.path.join(DATA, "files", *rel.split("/"))
        with open(src, "rb") as f:
            if hashlib.sha256(f.read()).hexdigest() != digest: raise SystemExit("prebuilt: %s is damaged" % rel)
        dst = os.path.join(kw["--out"], *rel.split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
    print("prebuilt: %s %s, %d files (made for game build %s)" % (meta["mod"], meta["version"], len(meta["files"]), meta["gameBuild"]))
    if meta.get("sheets"): add_sheets(kw["--out"], meta["sheets"])
    if "--adds" in kw:
        with open(kw["--adds"], "w", encoding="utf-8") as f: json.dump(meta["adds"], f, indent=1)


if __name__ == "__main__":
    main()
