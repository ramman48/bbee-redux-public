"""Boons Plus importer: the View Tactic Tree layouts for Tide and Decay. Each tree is a clone of a stock tree of the same
shape (store + pre-drawn line texture), read from the player's install at build time, with its node ids re-pointed at
our Tactics (fx/trees.json, written by build_v2.py)."""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE
while not os.path.exists(os.path.join(ROOT, "bbmod.py")) and os.path.dirname(ROOT) != ROOT: ROOT = os.path.dirname(ROOT)
sys.path.insert(0, ROOT)
import bbchar, make_patch, UnityPy
a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
out = kw["--out"]
adds = {"names": [], "entries": [], "guids": []}
for t in json.load(open(os.path.join(HERE, "trees.json"), encoding="utf-8")):
    tid, donor = t["id"], t["donor"]
    for src, dst, tok in (("gameplay/map/strategytree/strategytree_%d", "gameplay/map/strategytree/strategytree_%d", "StrategyTree_%d"),
                          ("ui/texture/strategytree/strategytreeline_%d", "ui/texture/strategytree/strategytreeline_%d", "StrategyTreeLine_%d")):

        r = bbchar.clone_bundle(src % donor, dst % tid, out, rename=(tok % donor, tok % tid), rename_objects=True)
        for k in ("names", "entries", "guids"): adds[k] += r[k]

    raw = next(bytes(o.read().get_image_data()) for o in UnityPy.load(make_patch.slice_bundle(make_patch.find_entry(
        "ui/texture/strategytree/strategytreeline_%d.ab" % donor))).objects if o.type.name == "Texture2D")
    lp = os.path.join(out, *("ui/texture/strategytree/strategytreeline_%d.ab" % tid).split("/"))
    env = UnityPy.load(lp)
    for o in env.objects:
        if o.type.name == "Texture2D":
            tt = o.read_typetree(); tt["image data"] = raw; tt["m_StreamData"] = {"offset": 0, "size": 0, "path": ""}
            o.save_typetree(tt)
    open(lp, "wb").write(env.file.save(packer="lz4"))
    path = os.path.join(out, *("gameplay/map/strategytree/strategytree_%d.ab" % tid).split("/"))
    env = UnityPy.load(path)
    for o in env.objects:
        if o.type.name != "MonoBehaviour": continue
        tt = o.read_typetree()
        if "Nodes" not in tt: continue
        tt["m_Name"] = "StrategyTree_%d" % tid; tt["TreeID"] = tid
        pos = {}
        for n in tt["Nodes"]:
            ids = t["layers"][str(n["Layer"])]
            k = pos.get(n["Layer"], 0); pos[n["Layer"]] = k + 1
            if k >= len(ids): raise SystemExit("tree %d: layer %d needs %d ids, has %d" % (tid, n["Layer"], k + 1, len(ids)))
            n["ID"] = ids[k]
        o.save_typetree(tt)
    open(path, "wb").write(env.file.save(packer="lz4"))
json.dump(adds, open(kw["--adds"], "w"), indent=1)
