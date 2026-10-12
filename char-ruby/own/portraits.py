"""portraits.py -- a character's select-screen / card / Evotype art from one full-body figure image, plus the mod spec
that installs it. Layout boxes are ICEY's (103701) alpha boxes on identically sized textures, so the UI places the new
art like every other character; each texture also needs a row in ui/texture/metrics (NOTES 2026-09-09 round 3).
  make(figure, out_dir)             -> writes portrait_full / _lmb / _mb / _coatarms (1024-2048 px) and head.png
  spec(actor_id, art_dir="art")     -> {"bundleClones": [...], "assets": [metrics op], "spriteAliases": {...}}
A figure can come from animview.py (the character's own frames), e.g.:
  python -c "import animview as a; im,_=a.render('ph_stand',0,ppu=480)[0]; im.save('fig.png')" """
import os
from PIL import Image

TEMPLATE = 103701   # ICEY: the reference slots (texture sizes, alpha boxes, metrics)
SLOTS = [   # (file, canvas, box l,t,r,b, crop fraction of the figure from the top (None = whole), metrics w,h, texture path, bundle)
    ("portrait_full.png", (1024, 2048), (102, 245, 988, 2048), None, (1168, 1904), "HeroPortraitFull/HeroPortraitFull_%d", "heroportraitfull/heroportraitfull_%d"),
    ("portrait_lmb.png", (1024, 1024), (0, 150, 947, 1024), None, (1080, 1049), "HeroPortraitLMB/HeroPortraitFull_%d", "heroportraitlmb/heroportraitfull_%d"),
    ("portrait_mb.png", (2048, 2048), (525, 285, 1639, 1967), None, (1881, 2067), "HeroPortraitFullMB/HeroPortraitFull_%d", "heroportraitfullmb/heroportraitfull_%d"),
    ("portrait_coatarms.png", (1024, 1024), (25, 54, 998, 969), 0.46, (1000, 1000), "HeroPortraitCoatArms/HeroPortraitFull_%d", "heroportraitcoatarms/heroportraitfull_%d"),
]
def _opaque(im):
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
def fit(img, canvas, box):
    """scale img to fill box preserving aspect, bottom-centred, on a transparent canvas"""
    bw, bh = box[2] - box[0], box[3] - box[1]
    k = min(bw / img.width, bh / img.height)
    w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    im = img.resize((w, h), Image.LANCZOS)
    out.paste(im, ((box[0] + box[2]) // 2 - w // 2, box[3] - h), im)
    return out
def make(figure, out_dir, head_fraction=0.30):
    f = _opaque(figure.convert("RGBA") if hasattr(figure, "convert") else Image.open(figure).convert("RGBA"))
    os.makedirs(out_dir, exist_ok=True)
    for name, canvas, box, crop, _, _, _ in SLOTS:
        src = f if crop is None else f.crop((0, 0, f.width, int(f.height * crop)))
        fit(src, canvas, box).save(os.path.join(out_dir, name))
    head = _opaque(f.crop((0, 0, f.width, int(f.height * head_fraction))))
    side = max(head.size); sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(head, (side // 2 - head.width // 2, side // 2 - head.height // 2), head)
    sq.resize((256, 256), Image.LANCZOS).save(os.path.join(out_dir, "head.png"))
    return f.size
def spec(actor, art_dir="art"):
    t = TEMPLATE
    clones = [{"from": "ui/texture/%s" % (b % t), "to": "ui/texture/%s" % (b % actor), "rename": [str(t), str(actor)],
               "image": "%s/%s" % (art_dir, name)} for name, _, _, _, _, _, b in SLOTS]
    clones.append({"from": "ui/texture/heroportraitcoatarms/heroportraitfull_%d" % t, "to": "ui/texture/heroheadicon/heroheadicon_%d" % actor,
                   "rename": [["HeroPortraitCoatArms", "HeroHeadIcon"], ["HeroPortraitFull_%d" % t, "HeroHeadIcon_%d" % actor]],
                   "image": "%s/head.png" % art_dir})
    metrics = [{"list": "_entries", "key": "path", "value": {"path": "UI/Texture/" + (p % actor), "width": m[0], "height": m[1]}}
               for _, _, _, _, m, p, _ in SLOTS]
    metrics.append({"list": "_entries", "key": "path", "value": {"path": "UI/Texture/HeroHeadIcon/HeroHeadIcon_%d" % actor, "width": 256, "height": 256}})
    return {"bundleClones": clones, "assets": [{"bundle": "ui/texture/metrics.ab", "asset": "metrics", "appendItems": metrics}],
            "spriteAliases": {"HeroHead_%d" % actor: "tex:UI/Texture/HeroHeadIcon/HeroHeadIcon_%d" % actor,
                              "HeroHead_%d_Off" % actor: "tex:UI/Texture/HeroHeadIcon/HeroHeadIcon_%d" % actor}}

# ---------------------------------------------------------------- Potential icons
def _motif(kind, S):
    """A grey element motif behind the figure (the stock icons pair a white figure with grey motion shapes)."""
    import math
    from PIL import ImageDraw
    m = Image.new("L", (S, S), 0); d = ImageDraw.Draw(m); w = S // 22
    if kind == "wind":
        for k, r in enumerate((0.44, 0.34, 0.24)):
            box = [S * (0.5 - r), S * (0.5 - r), S * (0.5 + r), S * (0.5 + r)]
            d.arc(box, 200 + 40 * k, 200 + 40 * k + 230, fill=255, width=w)
    elif kind == "ice":
        for ang in range(0, 360, 60):
            a = math.radians(ang); cx, cy = S / 2 + math.cos(a) * S * 0.30, S / 2 + math.sin(a) * S * 0.30
            L, Wd = S * 0.16, S * 0.045
            pts = [(cx + math.cos(a) * L, cy + math.sin(a) * L), (cx + math.cos(a + 1.57) * Wd, cy + math.sin(a + 1.57) * Wd),
                   (cx - math.cos(a) * L * 0.6, cy - math.sin(a) * L * 0.6), (cx - math.cos(a + 1.57) * Wd, cy - math.sin(a + 1.57) * Wd)]
            d.polygon(pts, fill=255)
    elif kind == "fire":
        for k, (x0, h) in enumerate(((0.18, 0.62), (0.38, 0.80), (0.60, 0.70), (0.80, 0.55))):
            bx = S * x0; top = S * (1 - h)
            d.polygon([(bx - S * 0.09, S * 0.95), (bx + S * 0.02, top), (bx + S * 0.10, S * 0.95)], fill=255)
    elif kind == "phantom":
        for k in range(3):
            box = [S * (0.05 + 0.1 * k), S * (0.05 + 0.08 * k), S * (1.1 + 0.05 * k), S * (1.2 - 0.04 * k)]
            d.arc(box, 190, 265, fill=255, width=w + 2)
    elif kind == "rose":   # scattered rose petals (Cross Effect: Ruby)
        import random
        rnd = random.Random(7)
        for _ in range(9):
            cx, cy, r = S * rnd.uniform(0.1, 0.9), S * rnd.uniform(0.1, 0.9), S * rnd.uniform(0.05, 0.09)
            a = rnd.uniform(0, math.pi)
            pts = [(cx + math.cos(a + t) * r * (1.0 if k % 2 == 0 else 0.45), cy + math.sin(a + t) * r * (1.0 if k % 2 == 0 else 0.45))
                   for k, t in enumerate([0, math.pi / 2, math.pi, 3 * math.pi / 2])]
            d.polygon(pts, fill=255)
    elif kind == "shot":   # a muzzle burst: rays from the left edge
        for k in range(7):
            a = math.radians(-36 + 12 * k); L = S * (0.75 if k % 2 else 0.55)
            d.line([(S * 0.08, S / 2), (S * 0.08 + math.cos(a) * L, S / 2 + math.sin(a) * L)], fill=255, width=w)
    elif kind == "arcane":
        d.ellipse([S * 0.08, S * 0.08, S * 0.92, S * 0.92], outline=255, width=w)
        for ang in range(0, 360, 45):
            a = math.radians(ang); cx, cy = S / 2 + math.cos(a) * S * 0.42, S / 2 + math.sin(a) * S * 0.42
            d.ellipse([cx - w * 1.4, cy - w * 1.4, cx + w * 1.4, cy + w * 1.4], fill=255)
    return m
def potential_icon(figure, size=256, margin=0.10, motif=None):
    """A stock-style Potential glyph (the game's are 256 px white/grey two-tone shapes on transparent): the figure in
    white with grey inner detail, over a grey element motif (wind / ice / fire / phantom / arcane)."""
    S = size * 4
    f = _opaque(figure.convert("RGBA"))
    box = int(S * margin), int(S * margin), int(S * (1 - margin)), int(S * (1 - margin))
    k = min((box[2] - box[0]) / f.width, (box[3] - box[1]) / f.height)
    f = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
    a = f.getchannel("A").point(lambda v: 255 if v > 60 else 0)
    L = f.convert("L"); vals = sorted(v for v, m in zip(L.getdata(), a.getdata()) if m)
    t = vals[len(vals) // 4] if vals else 64
    tone = L.point(lambda v: 250 if v >= t else 175)
    fig = Image.merge("RGBA", (tone, tone, tone, a))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if motif:
        mm = _motif(motif, S); grey = Image.new("RGBA", (S, S), (140, 140, 140, 255)); out.paste(grey, (0, 0), mm)
    # a dark cut-out outline so the figure reads over the motif
    edge = a.filter(__import__("PIL.ImageFilter", fromlist=["MaxFilter"]).MaxFilter(13))
    px, py = S // 2 - f.width // 2, S // 2 - f.height // 2
    out.paste(Image.new("RGBA", f.size, (0, 0, 0, 0)), (px, py), edge)
    out.paste(fig, (px, py), fig)
    return out.resize((size, size), Image.LANCZOS)
def potential_icon_spec(actor, icon_ids, art_dir="art"):
    """Install icons art/potential_<id>.png as textures and alias the sprite names the Potential UI asks for
    ("Potential_<IconId>", PotentialUtil.GetPotentialIcon) to them."""
    t = TEMPLATE
    clones = [{"from": "ui/texture/heroportraitcoatarms/heroportraitfull_%d" % t, "to": "ui/texture/iconpotential%d/potential_%d" % (actor, i),
               "rename": [["HeroPortraitCoatArms", "IconPotential%d" % actor], ["HeroPortraitFull_%d" % t, "Potential_%d" % i]],
               "image": "%s/potential_%d.png" % (art_dir, i)} for i in icon_ids]
    metrics = [{"list": "_entries", "key": "path", "value": {"path": "UI/Texture/IconPotential%d/Potential_%d" % (actor, i), "width": 256, "height": 256}}
               for i in icon_ids]
    return {"bundleClones": clones, "metrics": metrics,
            "spriteAliases": {"Potential_%d" % i: "tex:UI/Texture/IconPotential%d/Potential_%d" % (actor, i) for i in icon_ids}}
