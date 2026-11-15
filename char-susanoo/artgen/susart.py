"""Susanoo's pictures: made from the game's own Susanoo portrait (ui/texture/heroportraitfull/heroportraitfull_103301)
on the player's PC at build time. Nothing here is a game file; the mod folder holds only this code.

Each menu slot takes a crop of the portrait over a dark green ground, at the size of Hakumen's picture for that slot,
and where Hakumen's picture has a shape (the diamond head, the faded strips) his alpha is used as the mask. The Potential
icon atlas is EX Hakumen's recipe under Susanoo's actor id.

  head_sizes()  sprite name -> size (build_susanoo.py writes the aliases and metrics from it)
  slot_sizes()  texture path -> the size the UI metrics row gives it (Hakumen's)
  run(out, adds_path)  the importer: pictures, then the bundles that carry them
  sheet(path)   a review sheet: every picture beside Hakumen's
"""
import os, sys, json, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
EXC = os.path.join(ROOT, "mods", "ex-common")
ACTOR, EXH, DONOR = 193301, 191101, 101101
PORTRAIT = "ui/texture/heroportraitfull/heroportraitfull_103301"
GROUND = (9, 20, 15, 255)
TEMPLATE = "ui/texture/heroportraitcoatarms/heroportraitfull_103701"


HEADS = {
    "HeroHead_%d" % ACTOR: ("HeroHead_%d" % ACTOR, (350, 330, 870, 836), "ui/atlas/evocharacter/evocharacter#HeroHead_%d" % DONOR, False),
    "HeroHead_%d_Off" % ACTOR: ("HeroHead_%d_Off" % ACTOR, (350, 330, 870, 836), "ui/atlas/evocharacter/evocharacter#HeroHead_%d_Off" % DONOR, True),
    "IconHeroHead_%d" % ACTOR: ("IconHeroHead_%d" % ACTOR, (150, 420, 1250, 825), "ui/atlas/iconherohead/iconherohead#IconHeroHead_%d" % DONOR, False),
    "HeroPortraitFull_%d" % ACTOR: ("HeroFinalBattle_%d" % ACTOR, (330, 330, 900, 854), "ui/atlas/finalbattle/finalbattle#HeroPortraitFull_%d" % DONOR, False),
    "PvPFinish_HeroPortraitFull_%d" % ACTOR: ("HeroPvPFinish_%d" % ACTOR, (60, 470, 1300, 801), "ui/atlas/pvpfinish/pvpfinish#PvPFinish_HeroPortraitFull_%d" % DONOR, False),
    "PDA_HeroPortraitFull_%d" % ACTOR: ("HeroPDA_%d" % ACTOR, (200, 200, 1100, 1768),
                                        "ui/atlas/pdaplayinformationportrait/pdaplayinformationportrait#PDA_HeroPortraitFull_%d" % DONOR, False),
    "FesActor_%d4_S" % ACTOR: ("HeroFesActor_%d" % ACTOR, (350, 330, 870, 836), "ui/atlas/resource/resource#FesActor_%d4_S" % DONOR, False),
}
SIZES = {"HeroHead": (189, 184), "IconHeroHead": (380, 140), "HeroFinalBattle": (258, 237), "HeroPvPFinish": (827, 221),
         "HeroPDA": (287, 500), "HeroFesActor": (77, 76)}

SLOTS = [("heroportraitlmb/heroportraitfull_%d", "HeroPortraitLMB/HeroPortraitFull_%d", (1080, 1049), "bust"),
         ("heroportraitfullmb/heroportraitfull_%d", "HeroPortraitFullMB/HeroPortraitFull_%d", (1881, 2067), "full"),
         ("baseactor/baseactor_%d", "BaseActor/BaseActor_%d", (110, 110), "square"),
         ("baseactor/baseactor_%doff", "BaseActor/BaseActor_%dOFF", (110, 110), "square_off"),
         ("heroheadselcetmb/heroheadselect_0_%d", "HeroHeadSelcetMB/HeroHeadSelect_0_%d", (444, 148), "strip0"),
         ("heroheadselcetmb/heroheadselect_1_%d", "HeroHeadSelcetMB/HeroHeadSelect_1_%d", (444, 148), "strip1"),
         ("heroheadselcetmb/heroheadselect_2_%d", "HeroHeadSelcetMB/HeroHeadSelect_2_%d", (444, 148), "strip2")]


def tex_name(sprite): return HEADS[sprite][0]


def head_sizes():
    return {s: SIZES[re.sub(r"_\d+(_Off)?$", "", v[0])] for s, v in HEADS.items()}


def slot_sizes():
    return {"UI/Texture/" + (p % ACTOR): wh for _, p, wh, _ in SLOTS}


import re


def _paths():
    for p in (ROOT, EXC):
        if p not in sys.path: sys.path.insert(0, p)


def _src():
    _paths(); import exart
    return exart.make_image({"texture": PORTRAIT})


def _crop(src, box, size):
    from PIL import Image
    ground = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), GROUND)
    part = src.crop(box); ground.alpha_composite(part)
    return ground.resize(size, Image.LANCZOS)


def _off(im):
    from PIL import ImageOps, ImageEnhance
    a = im.getchannel("A"); g = ImageEnhance.Brightness(ImageOps.grayscale(im.convert("RGB"))).enhance(0.55).convert("RGBA")
    g.putalpha(a); return g


def _tint(im, rgb, k):
    from PIL import ImageOps, Image
    L = ImageOps.grayscale(im.convert("RGB"))
    ch = [L.point(lambda v, c=c: int(min(255, v * c * k))) for c in rgb]
    out = Image.merge("RGB", ch).convert("RGBA"); out.putalpha(im.getchannel("A")); return out


def heads(src):
    """sprite name -> PIL image"""
    _paths(); import exart
    out = {}
    for s, (tn, box, ref, off) in HEADS.items():
        r = exart.make_image({"sprite": ref})
        im = _crop(src, box, r.size); im.putalpha(r.getchannel("A"))
        out[s] = _off(im) if off else im
    return out


def slots(src):
    """bundle -> PIL image at the donor texture's own size"""
    from PIL import Image
    out = {}
    for b, p, wh, kind in SLOTS:
        if kind == "bust":
            im = src.crop((0, 120, 1360, 1480)).resize((1024, 1024), Image.LANCZOS)
            fade = Image.linear_gradient("L").resize((1024, 1024))
            fade = fade.point(lambda v: 255 if v < 190 else max(0, int(255 * (255 - v) / 65)))
            a = Image.composite(im.getchannel("A"), Image.new("L", im.size, 0), fade); im.putalpha(a)
        elif kind == "full":
            h = 1900; w = int(round(src.width * h / src.height))
            im = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0)); im.alpha_composite(src.resize((w, h), Image.LANCZOS), ((2048 - w) // 2, 74))
        elif kind.startswith("square"):
            im = _crop(src, (380, 370, 840, 830), (110, 110))
            if kind.endswith("off"): im = _off(im)
        else:
            im = _crop(src, (130, 450, 1240, 820), (444, 148))
            if kind == "strip0": im = _off(im)
            elif kind == "strip1": im = _tint(im, (0.62, 0.55, 0.85), 0.75)
        out[b % ACTOR] = im
    return out


DESK = os.path.join(ROOT, "mods", "char-susanoo", "art", "desk_icons")
DESK_ICONS = {"IconSkill_1933011": "legacy_1933011.png", "IconSkill_1933012": "legacy_1933012.png", "Talent_5983": "talent_5983_hud.png"}


def _exh_recipes():

    return json.load(open(os.path.join(ROOT, "mods", "char-susanoo", "donor", "recipes.json"), encoding="utf-8"))


def run(out, adds_path):
    _paths(); import bbchar, exart
    tmp = tempfile.mkdtemp(prefix="susart_"); adds = {"names": [], "entries": [], "guids": []}
    clones = []
    try:
        src = _src()
        for s, im in heads(src).items():
            tn = HEADS[s][0]; fn = tn.lower() + ".png"; im.save(os.path.join(tmp, fn))
            clones.append({"from": TEMPLATE, "to": "ui/texture/heroheadicon/" + tn.lower(),
                           "rename": [["HeroPortraitCoatArms", "HeroHeadIcon"], ["HeroPortraitFull_103701", tn]], "image": fn})
        for b, im in slots(src).items():
            fn = b.replace("/", "_") + ".png"; im.save(os.path.join(tmp, fn))
            donor = b.replace(str(ACTOR), str(DONOR))
            clones.append({"from": "ui/texture/" + donor, "to": "ui/texture/" + b, "rename": [str(DONOR), str(ACTOR)], "image": fn})

        R = _exh_recipes(); need = set()
        for c in R["clones"]:
            if "iconpotential%d" % EXH in c["to"]:
                c = json.loads(json.dumps(c).replace("IconPotential%d" % EXH, "IconPotential%d" % ACTOR).replace("iconpotential%d" % EXH, "iconpotential%d" % ACTOR))

                c["atlasSprites"] = [[n, os.path.join(DESK, DESK_ICONS[n])] if n in DESK_ICONS else [n, ip] for n, ip in c["atlasSprites"]]
                c["atlasSprites"] += [["Potential_%d" % i, os.path.join(ROOT, "mods", "char-susanoo", "art", "pot_icons", "p%d.png" % i)] for i in range(21371, 21380)]
                clones.append(c); need |= {ip for _, ip in c.get("atlasSprites") or [] if ip and not ip.startswith("sprite:")}
        for r in R["images"]:
            if r["file"] in need: exart.make_image(r).save(os.path.join(tmp, r["file"]))
        local = lambda ip: ip if ip is None or ip.startswith("sprite:") else os.path.join(tmp, ip)
        for c in clones:
            a = bbchar.clone_bundle(c["from"], c["to"], out, tuple(c["rename"]) if c.get("rename") else None,
                                    c.get("image") and os.path.join(tmp, c["image"]), None, c.get("refTypesFrom"), bool(c.get("renameObjects")),
                                    [(n, local(ip)) for n, ip in c["atlasSprites"]] if c.get("atlasSprites") else None)
            for k in ("names", "entries", "guids"): adds[k] += a.get(k, [])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    json.dump(adds, open(adds_path, "w"), indent=1)
    print("Susanoo art: %d bundles from the game's own portrait" % len(clones))


def sheet(path):
    """review sheet for the lead: each picture with Hakumen's beside it, on the game's dark ground"""
    _paths(); import exart
    from PIL import Image, ImageDraw
    src = _src(); H = heads(src); S = slots(src)
    rows = []
    for s, im in H.items(): rows.append((s, im, exart.make_image({"sprite": HEADS[s][2]})))
    for b, im in S.items():
        rows.append((b, im, exart.make_image({"texture": "ui/texture/" + b.replace(str(ACTOR), str(DONOR))})))
    cell = 300; pad = 16
    sheet = Image.new("RGBA", (pad + 2 * (cell + pad) + 260, pad + len(rows) * (cell + pad)), (24, 26, 28, 255))
    d = ImageDraw.Draw(sheet)
    for i, (name, mine, his) in enumerate(rows):
        y = pad + i * (cell + pad)
        for j, im in enumerate((his, mine)):
            t = im.copy(); t.thumbnail((cell, cell))
            x = pad + j * (cell + pad); sheet.alpha_composite(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        d.text((pad + 2 * (cell + pad), y + cell // 2), "%s\n%dx%d\n(left: Hakumen, right: Susanoo)" % (name, mine.width, mine.height), fill=(220, 220, 210, 255))
    sheet.convert("RGB").save(path, quality=90)
    return path


if __name__ == "__main__":
    print(sheet(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "review_sheet.jpg")))
