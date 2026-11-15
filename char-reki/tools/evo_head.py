"""Reki's Evotype tile (HeroHead_201101 and its _Off twin) on the stock tile's footprint.

    python mods\\char-reki\\tools\\evo_head.py [--sheet OUT.png]

The Evotype screens draw HeroHead_<id> from the stock atlas UI/Atlas/EvoCharacter: 189 x 184 sprites, a head and
shoulders inside the diamond of BgEvo_* (its alpha), head height about 0.9 of the tile, the face about 0.4 of its width,
the eyes about 0.41 down; the _Off twin is the same picture in grey (stock 100101 / 102201 measured 2026-11-10).
Until 0.5.2 Reki's tile was the 256 x 256 square close-up art/head.png (every head slot shares it), so it filled the
whole square edge to edge and its face was 0.74 of the width: it read bigger than every stock tile (tester, 2026-11-10).

This re-crops the same illustration (art/portrait_lmb.png, the lead's picture; no new art) at the stock scale and masks
it with the stock diamond. Writes art/evo_head.png and art/evo_head_off.png; character.json presentation.icons sends
HeroHead_201101 and HeroHead_201101_Off to them. The diamond mask is read from the stock BgEvo_1 sprite in
local_only (game art, kept local), so this runs in the workspace only; the PNGs it writes are what the build reads."""
import argparse
import os

from PIL import Image, ImageEnhance, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ART = os.path.join(ROOT, "mods", "char-reki", "art")
STOCK = os.path.join(ROOT, "local_only", "redux", "ui-study", "stock", "ui__atlas__evocharacter")
TILE = (189, 184)

CROP = (275, 115, 795, 621)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", help="also write a review sheet: stock tiles and hers, on the stock background and frame")
    args = ap.parse_args()
    src = Image.open(os.path.join(ART, "portrait_lmb.png")).convert("RGBA")
    pic = src.crop(CROP).resize(TILE, Image.LANCZOS)
    bg = Image.open(os.path.join(STOCK, "BgEvo_1.png")).convert("RGBA")
    mask = bg.getchannel("A").resize(TILE)

    a = Image.composite(pic.getchannel("A"), Image.new("L", TILE, 0), mask.point(lambda v: 255 if v > 200 else 0))
    pic.putalpha(a)
    pic.save(os.path.join(ART, "evo_head.png"))
    off = ImageEnhance.Brightness(ImageOps.grayscale(pic.convert("RGB"))).enhance(0.8).convert("RGBA")
    off.putalpha(a)
    off.save(os.path.join(ART, "evo_head_off.png"))
    print("evo_head.png / evo_head_off.png", TILE, "alpha bbox", a.point(lambda v: 255 if v > 16 else 0).getbbox())
    if args.sheet:
        names = ["HeroHead_100101", "HeroHead_102201", "HeroHead_103701", "HeroHead_101101"]
        frame = Image.open(os.path.join(STOCK, "FrameEvo_1.png")).convert("RGBA")
        tiles = [Image.open(os.path.join(STOCK, n + ".png")).convert("RGBA") for n in names]
        old = Image.open(os.path.join(ART, "head.png")).convert("RGBA").resize(TILE, Image.LANCZOS)
        tiles += [old, pic, off]
        labels = names + ["Reki 0.5.1 (head.png)", "Reki 0.5.2", "Reki 0.5.2 Off"]
        from PIL import ImageDraw
        sh = Image.new("RGBA", ((TILE[0] + 12) * len(tiles), TILE[1] + 24), (40, 40, 48, 255))
        d = ImageDraw.Draw(sh)
        for i, t in enumerate(tiles):
            x = i * (TILE[0] + 12)
            cell = Image.new("RGBA", TILE, (0, 0, 0, 0))
            cell.alpha_composite(bg.resize(TILE))
            cell.alpha_composite(t.resize(TILE) if t.size != TILE else t)
            cell.alpha_composite(frame.resize(TILE))
            sh.alpha_composite(cell, (x, 20))
            d.text((x + 2, 4), labels[i], fill=(255, 255, 0, 255))
        sh.save(args.sheet)
        print("sheet", args.sheet)


if __name__ == "__main__":
    main()
