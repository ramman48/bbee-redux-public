"""Reki's screen pictures from the lead's full-body illustration (the lead, 2026-10-23: "dont use Rekis standing sprite
for her portraits use her transparent full character png i gave you").

    python mods\\char-reki\\tools\\make_portraits.py [source.png]

Default source: local_only\\redux\\art\\heroes\\reki\\source\\reki_lead.png (the lead's file; kept local). A source on a
white background is keyed to transparent. Writes mods\\char-reki\\art\\portrait_full / _mb / _lmb.png on ICEY's canvases
(the sizes the bundle clones and metrics carry) and copies the UI desk's small slots, cut from the same picture
(local_only\\redux\\art\\heroes\\reki\\out: head, pda, pvpfinish, finalbattle, smallhead).

Framing follows the stock heroes, not a fit inside ICEY's box: her pose is wide (a sword longer than she is tall), and
fitting it whole by width left her small at the bottom of a tall frame.
- full (1024x2048, hero select): she fills the height from the hair to the feet, centred on her body; the sword's tip
  and the hair's end run off the sides, as Mai's spear and Ragna's coat tails do.
- mb (2048x2048, the Prototype pages): the whole picture, height filled, centred.
- lmb (1024x1024, the bust): head to hips, the face in the upper third, as every stock bust.
"""
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "local_only", "redux", "art", "heroes", "reki", "source", "reki_lead.png")
DESK = os.path.join(ROOT, "local_only", "redux", "art", "heroes", "reki", "out")
ART = os.path.join(ROOT, "mods", "char-reki", "art")

FACE = (0.497, 0.383)
BODY_X = 0.54


def load(path):
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A")
    if a.getextrema()[0] == 255:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, _ = px[x, y]
                m = min(r, g, b)
                if m > 238:
                    px[x, y] = (r, g, b, max(0, int((255 - m) * 255 / 17)))
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box)


def place(fig, canvas, scale, anchor_src, anchor_dst):
    f = fig.resize((max(1, round(fig.width * scale)), max(1, round(fig.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.paste(f, (round(anchor_dst[0] - anchor_src[0] * f.width), round(anchor_dst[1] - anchor_src[1] * f.height)), f)
    return out


def main():
    fig = load(sys.argv[1] if len(sys.argv) > 1 else SRC)
    W, H = fig.size

    s = 1800 / H
    place(fig, (1024, 2048), s, (BODY_X, 1.0), (470, 1988)).save(os.path.join(ART, "portrait_full.png"))

    s = 1880 / H
    place(fig, (2048, 2048), s, (0.5, 0.5), (1024, 1024)).save(os.path.join(ART, "portrait_mb.png"))

    s = 1024 / ((0.62 - FACE[1] + 0.14) * H)
    place(fig, (1024, 1024), s, FACE, (540, 300)).save(os.path.join(ART, "portrait_lmb.png"))
    for n in ("head.png", "pda.png", "pvpfinish.png", "finalbattle.png", "smallhead.png"):
        if os.path.exists(os.path.join(DESK, n)):
            shutil.copy(os.path.join(DESK, n), os.path.join(ART, n))
    print("source", W, "x", H, "->", ART)


if __name__ == "__main__":
    main()
