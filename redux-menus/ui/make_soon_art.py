r"""The character select's "coming soon" pictures: the roadmap's own cast art, scaled for the select, and a head icon
for each (face in the middle, the shape of the game's own hero heads).

    python mods\redux-menus\ui\make_soon_art.py

Reads the art the roadmap sheets use (docs\promo\build\roadmap_v3.py: the Terminal's cast folder, docs\promo\src\guests
and two named files) and writes mods\redux-menus\files\art\soon\<key>.png (at most 900 px high, alpha kept) and
files\art\soon\head\<key>.png (256 px). Kris, Susie and Ralsei are one entry, "party".
The list of keys is the one in files\fourlobbyui.js (SOON); a key with no picture is reported and left out.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CAST = os.path.join(ROOT, "repo_export", "zenith-terminal-gui", "zenith_gui", "art", "cast")
SRC = os.path.join(ROOT, "docs", "promo", "src")
GUESTS = os.path.join(SRC, "guests")
OUT = os.path.join(HERE, "..", "files", "art", "soon")
SPECIAL = {"hakumen": os.path.join(SRC, "hakumen_centralfiction_select.png"),
           "protoman": os.path.join(GUESTS, "protoman_dual_override.webp")}
HERO_OUT = os.path.join(HERE, "..", "files", "art", "hero")
DUMPS = os.path.join(ROOT, "local_only", "redux", "cap")



HEROES = {
    190101: ("dump", None, (0.495, 0.20, 0.10)), 191101: ("dump", None, (0.51, 0.165, 0.12)), 193301: ("dump", None, (0.495, 0.25, 0.10)),
    200301: ("izanami", "izanami", (0.465, 0.28, 0.08)), 200401: ("nine", "nine", (0.54, 0.25, 0.085)),
    201101: ("reki", "reki", (0.52, 0.365, 0.07)), 200701: ("ruby", None, (0.335, 0.31, 0.08)), 201301: ("weiss", None, (0.545, 0.105, 0.08)),
    201001: ("swiftmaster", None, (0.54, 0.18, 0.1))}
KEYS = ["oread", "nan", "hakumen", "celica", "azrael", "izayoi", "litchi", "arakune", "arcueid", "swiftmaster", "yuzuriha",
        "makoto", "dust", "x", "bayonetta", "dante", "vergil", "marie", "2b", "a2", "ramlethal", "lucilius",
        "nenmaster", "gunvolt", "lilac", "neo", "blake", "yang", "margaret", "protoman", "aile", "zero"]
PARTY = ["susie", "kris", "ralsei"]


FACE = {
    "2b": (0.50, 0.08, 0.09), "a2": (0.64, 0.115, 0.09), "aile": (0.73, 0.165, 0.13), "arakune": (0.30, 0.29, 0.09),
    "arcueid": (0.28, 0.115, 0.11), "azrael": (0.45, 0.165, 0.10), "bayonetta": (0.77, 0.05, 0.08), "blake": (0.515, 0.19, 0.13),
    "celica": (0.58, 0.34, 0.08), "dante": (0.41, 0.075, 0.08), "dust": (0.625, 0.25, 0.16), "gunvolt": (0.505, 0.245, 0.14),
    "hakumen": (0.54, 0.175, 0.12), "izayoi": (0.67, 0.28, 0.09), "kris": (0.365, 0.265, 0.20), "lilac": (0.52, 0.175, 0.15),
    "litchi": (0.64, 0.185, 0.09), "lucilius": (0.475, 0.175, 0.08), "makoto": (0.42, 0.15, 0.11), "margaret": (0.48, 0.105, 0.09),
    "marie": (0.565, 0.36, 0.13), "nan": (0.52, 0.23, 0.30), "nenmaster": (0.545, 0.12, 0.09), "neo": (0.52, 0.245, 0.08),
    "oread": (0.505, 0.125, 0.12), "protoman": (0.157, 0.075, 0.105), "ralsei": (0.48, 0.39, 0.25), "ramlethal": (0.5, 0.17, 0.12),
    "susie": (0.345, 0.265, 0.22), "swiftmaster": (0.54, 0.18, 0.1), "vergil": (0.525, 0.205, 0.07), "x": (0.50, 0.14, 0.12),
    "yang": (0.43, 0.295, 0.1), "yuzuriha": (0.31, 0.43, 0.08), "zero": (0.53, 0.12, 0.14)}


BASE = {
    102901: (0.475, 0.12, 0.09), 100101: (0.565, 0.185, 0.10), 100301: (0.55, 0.21, 0.08), 102801: (0.435, 0.29, 0.08),
    103401: (0.625, 0.16, 0.10), 100401: (0.46, 0.28, 0.08), 100501: (0.44, 0.12, 0.17), 100201: (0.47, 0.245, 0.08),
    102501: (0.425, 0.20, 0.11), 101101: (0.54, 0.165, 0.12), 103501: (0.40, 0.235, 0.08), 101401: (0.32, 0.105, 0.08),
    103701: (0.49, 0.20, 0.08), 102201: (0.43, 0.185, 0.10), 103801: (0.43, 0.245, 0.10), 103101: (0.455, 0.185, 0.08),
    101801: (0.39, 0.32, 0.12)}
HEAD = 256


def source(k):
    src = SPECIAL.get(k)
    for d in (GUESTS, CAST):
        if not src and os.path.exists(os.path.join(d, k + ".png")):
            src = os.path.join(d, k + ".png")
    if not src or not os.path.exists(src):
        return None
    im = Image.open(src).convert("RGBA")
    box = im.getbbox()
    return im.crop(box) if box else im


def fit(im, h):
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS) if im.height != h else im.copy()

    a = im.getchannel("A")
    row = a.crop((0, im.height - 2, im.width, im.height - 1)).getdata()
    if sum(1 for v in row if v > 128) > im.width * 0.12:
        n = max(2, im.height // 10)
        ramp = Image.new("L", (1, im.height), 255)
        for y in range(n):
            ramp.putpixel((0, im.height - 1 - y), round(255 * (y / n) ** 1.5))
        im.putalpha(ImageChops.multiply(a, ramp.resize(im.size)))
    return im


def diamond(im):
    """The base heroes' head shape: a square stood on its corner, drawn at four times the size for a clean edge."""
    n = im.width * 4
    m = Image.new("L", (n, n), 0)
    ImageDraw.Draw(m).polygon([(n / 2, 0), (n, n / 2), (n / 2, n), (0, n / 2)], fill=255)
    out = im.copy()
    out.putalpha(ImageChops.multiply(im.getchannel("A"), m.resize(im.size, Image.LANCZOS)))
    return out


def head(im, k, mult=1.7, cut=True):
    fx, fy, hh = FACE[k] if isinstance(k, str) else k
    side = hh * im.height * mult
    cx, cy = fx * im.width, fy * im.height + side * 0.06
    box = tuple(round(v) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))
    out = im.crop(box).resize((HEAD, HEAD), Image.LANCZOS)
    return diamond(out) if cut else out


def main():
    for d in (os.path.join(OUT, "head"), os.path.join(OUT, "headsq"), os.path.join(HERO_OUT, "head"), os.path.join(HERO_OUT, "headsq")):
        os.makedirs(d, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".png") and f[:-4] not in KEYS + ["party"]:
            os.remove(os.path.join(OUT, f))
    total = 0
    for k in KEYS:
        im = source(k)
        if im is None:
            print("no picture for", k)
            continue
        dst = os.path.join(OUT, k + ".png")
        fit(im, min(900, im.height)).save(dst, optimize=True)
        head(im, k).save(os.path.join(OUT, "head", k + ".png"), optimize=True)
        head(im, k, 2.0, False).save(os.path.join(OUT, "headsq", k + ".png"), optimize=True)
        total += os.path.getsize(dst)
    for hid, face in BASE.items():
        f = os.path.join(DUMPS, "tex_%d.png" % hid)
        if not os.path.exists(f):
            print("no source for", hid)
            continue
        im = Image.open(f).convert("RGBA")
        head(im.crop(im.getbbox()), face, 2.0, False).save(os.path.join(HERO_OUT, "headsq", "%d.png" % hid), optimize=True)
    for hid, (src, stage, face) in HEROES.items():
        f = os.path.join(DUMPS, "tex_%d.png" % hid) if src == "dump" else os.path.join(CAST, src + ".png")
        if not os.path.exists(f):
            print("no source for", hid)
            continue
        im = Image.open(f).convert("RGBA")
        im = im.crop(im.getbbox())
        head(im, face).save(os.path.join(HERO_OUT, "head", "%d.png" % hid), optimize=True)
        head(im, face, 2.0, False).save(os.path.join(HERO_OUT, "headsq", "%d.png" % hid), optimize=True)
        if stage:
            fit(im, min(1000, im.height)).save(os.path.join(HERO_OUT, "%d.png" % hid), optimize=True)

    su, kr, ra = (source(k) for k in PARTY)
    su, kr, ra = fit(su, 900), fit(kr, 700), fit(ra, 760)
    width = 1240
    art = Image.new("RGBA", (width, 900), (0, 0, 0, 0))
    art.alpha_composite(su, (0, 0))
    art.alpha_composite(ra, (width - ra.width, 900 - ra.height))
    art.alpha_composite(kr, ((width - kr.width) // 2 - 30, 900 - kr.height))
    art.save(os.path.join(OUT, "party.png"), optimize=True)
    hd = Image.new("RGBA", (HEAD, HEAD), (0, 0, 0, 0))
    hs, hk, hr = head(source("susie"), "susie", 1.5, False), head(source("kris"), "kris", 1.7, False), head(source("ralsei"), "ralsei", 1.5, False)
    hd.alpha_composite(hs.resize((140, 140), Image.LANCZOS), (-6, 0))
    hd.alpha_composite(hr.resize((140, 140), Image.LANCZOS), (122, 0))
    hd.alpha_composite(hk.resize((150, 150), Image.LANCZOS), (53, 106))
    diamond(hd).save(os.path.join(OUT, "head", "party.png"), optimize=True)
    hd.save(os.path.join(OUT, "headsq", "party.png"), optimize=True)
    print("wrote", len(KEYS) + 1, "pictures and heads,", round(total / 1e6, 1), "MB in", os.path.normpath(OUT))


if __name__ == "__main__":
    sys.exit(main())
