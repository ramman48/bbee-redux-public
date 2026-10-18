"""exart.py -- the EX characters' pictures that come from the game: made on the player's PC at build time.

An EX character's head icons, menu portraits and some HUD icons are the base character's own pictures, recoloured or
resized. Those are the game's pixels, so a mod folder never holds them. Each character has artgen/recipes.json, which
names where a picture is read from in the player's install and what is done to it, and the bundles that carry the
results. The character's importer (artgen/import_art.py) hands that file to run() here.

recipes.json:
  images  [{"file": "<name>.png",
            "sprite": "<atlas bundle>#<sprite name>"  or  "texture": "<texture bundle>",
            "recolor": <bbchar recolour spec>, "resize": [w, h], "opaqueSquare": <side>}, ...]
  clones  [<a bundleClones entry of mod.json>, ...]   "image" and atlasSprites files are names from "images"

The generators (build_ex*.py) use make_image() too, so the sizes they write into the UI metrics rows are the sizes of
the pictures this module makes.
"""
import os, sys, json, shutil, tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next((p for p in (os.path.abspath(os.path.join(_HERE, *([".."] * k))) for k in range(1, 6)) if os.path.exists(os.path.join(p, "bbmod.py"))),
            os.path.abspath(os.path.join(_HERE, "..", "..")))


def make_image(rec):
    """one picture of recipes.json "images" -> PIL image (RGBA)"""
    if ROOT not in sys.path: sys.path.insert(0, ROOT)
    import UnityPy, bbmod, bbchar
    from PIL import Image
    if rec.get("sprite"):
        im = bbchar.stock_sprite_image(rec["sprite"])
    else:
        env = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(rec["texture"] + ".ab")))
        im = next(o.read().image.convert("RGBA") for o in env.objects if o.type.name == "Texture2D")
    if rec.get("recolor"): im = bbchar.recolor_image(im, rec["recolor"])
    if rec.get("opaqueSquare"):
        im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
        side = max(im.size); sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
        im = sq.resize((rec["opaqueSquare"], rec["opaqueSquare"]), Image.LANCZOS)
    if rec.get("resize"): im = im.resize(tuple(rec["resize"]), Image.LANCZOS)
    return im


def run(recipes_path, out, adds_path):
    """make every picture in a temporary folder, build the bundles that carry them into `out`, write the manifest
    additions to `adds_path` (the loader's importer contract)"""
    if ROOT not in sys.path: sys.path.insert(0, ROOT)
    import bbchar
    rec = json.load(open(recipes_path, encoding="utf-8"))
    tmp = tempfile.mkdtemp(prefix="exart_")
    adds = {"names": [], "entries": [], "guids": []}
    try:
        for r in rec["images"]: make_image(r).save(os.path.join(tmp, r["file"]))
        local = lambda ip: ip if ip is None or ip.startswith("sprite:") else os.path.join(tmp, ip)
        for c in rec["clones"]:
            a = bbchar.clone_bundle(c["from"], c["to"], out, tuple(c["rename"]) if c.get("rename") else None,
                                    c.get("image") and os.path.join(tmp, c["image"]), None, c.get("refTypesFrom"), bool(c.get("renameObjects")),
                                    [(n, local(ip)) for n, ip in c["atlasSprites"]] if c.get("atlasSprites") else None)
            for k in ("names", "entries", "guids"): adds[k] += a.get(k, [])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    json.dump(adds, open(adds_path, "w"), indent=1)
    print("EX art: %d pictures made from the game's own, %d bundles" % (len(rec["images"]), len(rec["clones"])))
