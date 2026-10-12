"""kris_portraits.py -- Kris's portraits and head icons for every screen a playable character appears on, made at BUILD
time from the official art the lead chose (local_only/deltarune/party/art/Kris_artwork_Famitsu.png; DECISIONS.md
"Portraits"). Nothing is stored in the mod: import_kris.py writes the texture bundles into the build folder,
build_kris.py writes spec() (ui/texture/metrics rows, sprite aliases, HeroPortraitOffsetConfigUI rows) into mod.json,
so both halves use the same names. Without the art file nothing is built and spec() is empty: the screens then show
no portrait for Kris (a known gap, never a failure).

0.5.6 (the lead, 2026-10-03: "fix kris portrait and size it up to be the other characters and make sure they have a
libray portrait and lookg ood in character select"). What was wrong, seen in game on 0.5.5 (3440 x 1440 captures):
  * the select portrait sat in the lower half of its card and was 23 % too wide: the art was fitted into ICEY's
    1024 x 2048 slot, which the game shows at ICEY's metrics (1168 x 1904), with ICEY's placement rows;
  * the Prototype File list (Profile) showed another character's banner in Kris's row: no banner sprite existed;
  * the Intel page's Skill slot was empty: no IconSkill sprite existed.

How the game shows a HeroPortraitFull texture (the Cross Effect session's finding, mods/char-ruby/rrb_portrait.py;
checked again here against the capture): the image is sized to the texture's METRICS, anchored at the centre of the
hero cell, with pivot (PivotX, PivotY) and localScale Scale from HeroPortraitOffsetConfigUI[Id, key]; a texture point
(u, v from the top) shows at x = (u - px) W s, y(up) = ((1 - v) - py) H s. So the texture is now the art itself, 1:1,
with metrics = its size (no stretch), and Kris has rows of their own for all twelve keys.

The rows. Kris's art is a short figure (the head is a third of it); the stock art is tall and every screen cuts it
at the thighs. Shown at a stock scale Kris would stand in the lower half of a card (0.5.5); shown as tall as a stock
figure the head alone would fill the card. So the whole figure is shown, standing: Kris's hair top sits on a stock
figure's brow line and Kris's boots where that figure is cut on the select card (the floor line), in every key, with
Kris's face under the stock face. The stock figure is Hibiki's (102901; Ruby's reference too): REF_TOP / REF_FLOOR /
REF_X are lines in his texture, his rows are read from the installed game's table at build time.

Still missing (later): the mobile select strips and the inherit texture (the final-boss start effect skips it).
"""
import json, os, sys

import numpy as np
from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ART = os.path.join(ROOT, "local_only", "deltarune", "party", "art", "Kris_artwork_Famitsu.png")
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import dr_pack                                    # 0.6.4: an alpha TEST package carries the art (dr_pack.py)
if dr_pack.active():
    ART = str(dr_pack.path("art", os.path.basename(ART)))
ACTOR, ICEY = 200801, 103701

# ---------------------------------------------------------------- the art (1112 x 1509 RGBA), measured 2026-10-03
ART_SIZE = (1112, 1509)
ART_BOX = (17, 11, 1101, 1497)      # alpha > 8 bounding box (exclusive right / bottom)
ART_TOP, ART_FEET = 13, 1495        # the top of the hair, the lowest boot sole
ART_FACE_X = 406                    # the middle of the face
HEAD_BOX = (100, 0, 800, 700)       # the coordinator's hand-set head crop (square, the art's own pixels)

# HeroPortraitFull: the figure with a 4 px margin, sides a multiple of 4 (BC7 blocks); shown 1:1 (metrics = size)
FULL_CROP = (13, 8, 1105, 1500)
FULL_SIZE = (FULL_CROP[2] - FULL_CROP[0], FULL_CROP[3] - FULL_CROP[1])   # (1092, 1492)
FULL_METRICS = FULL_SIZE

# ---------------------------------------------------------------- the reference: Hibiki Kohaku (102901)
REF_ID, REF_SIZE = 102901, (1480, 1788)   # his HeroPortraitFull texture == its metrics
REF_TOP = 141        # the line Kris's hair top sits on: his brow (his own hair top is 34, his eyes 192)
REF_FLOOR = 1256     # the line Kris's boots stand on: where the select card's floor cuts him
REF_X = 712          # the line Kris's face is centred on: the midpoint between his eyes
KEYS = ("BattleChallengePrepare", "BreedFinishRoom", "BreedPrepare", "BreedPrepareS", "BreedResult", "FesL", "FesR",
        "FesShadowL", "FesShadowR", "GenericActorDetail", "PvpTeamMatchL", "PvpTeamMatchR")

_CA = "ui/texture/heroportraitcoatarms/heroportraitfull_%d" % ICEY
# the four slots every stock character has: key -> (bundle pattern, texture size, metrics)
SLOTS = {
    "full": ("heroportraitfull/heroportraitfull_%d", FULL_SIZE, FULL_METRICS),
    "lmb": ("heroportraitlmb/heroportraitfull_%d", (1024, 1024), (1080, 1049)),
    "mb": ("heroportraitfullmb/heroportraitfull_%d", (2048, 2048), (1881, 2067)),
    "coatarms": ("heroportraitcoatarms/heroportraitfull_%d", (1024, 1024), (1000, 1000)),
}
SLOT_PATH = {"full": "HeroPortraitFull/HeroPortraitFull_%d", "lmb": "HeroPortraitLMB/HeroPortraitFull_%d",
             "mb": "HeroPortraitFullMB/HeroPortraitFull_%d", "coatarms": "HeroPortraitCoatArms/HeroPortraitFull_%d"}
# key -> (folder, texture name, size, kind)
HEADS = {
    "head": ("HeroHeadIcon", "HeroHeadIcon_%d" % ACTOR, (256, 256), "square"),
    "smallhead": ("HeroHeadIcon", "HeroSmallHead_%d" % ACTOR, (128, 128), "square"),
    "evohead": ("HeroHeadIcon", "HeroEvoHead_%d" % ACTOR, (189, 184), "diamond"),
    "evohead_off": ("HeroHeadIcon", "HeroEvoHead_Off_%d" % ACTOR, (189, 184), "diamond_grey"),
    "finalbattle": ("HeroHeadIcon", "HeroFinalBattle_%d" % ACTOR, (258, 237), "final"),   # the final boss's fighting-game HUD
    "pvpfinish": ("HeroHeadIcon", "HeroPvPFinish_%d" % ACTOR, (827, 221), "banner"),      # the Prototype File list (Profile)
    "pda": ("HeroHeadIcon", "HeroPDA_%d" % ACTOR, (287, 477), "pda"),                     # the player-information cards
}
# sprite name -> head key (the SDK's tex: aliases; the names are char-ruby's ruby_ui.ALIASES for 200701)
ALIASES = {"HeroHead_%d" % ACTOR: "evohead", "HeroHead_%d_Off" % ACTOR: "evohead_off", "HeroPortraitFull_%d_S" % ACTOR: "head",
           "PVE_HeroPortraitFull_%d_H" % ACTOR: "smallhead", "PVP_HeroPortraitFull_%d" % ACTOR: "smallhead",
           "BaseActor_%d" % ACTOR: "smallhead", "BaseActor_%d_S" % ACTOR: "smallhead",
           "FesActor_%dk" % ACTOR: "smallhead", "FesActor_%dk_S" % ACTOR: "smallhead",
           "HeroPortraitFull_%d" % ACTOR: "finalbattle", "PvPFinish_HeroPortraitFull_%d" % ACTOR: "pvpfinish",
           "PDA_HeroPortraitFull_%d" % ACTOR: "pda"}
# HeroPortraitFullMB (the co-op card and the mobile select; no placement row there): the reference's art sits in his
# 2048 x 2048 texture at offset (405, 276), 1.0888 times as wide (2048 / 1881: the texture is shown at its metrics) and
# 0.991 times as tall (measured 2026-10-03: his head is 1.09 times as wide there as in his HeroPortraitFull, his hair top
# is at 310). Kris goes between the same lines of his, so the co-op card frames Kris as the select card does
MB_REF = (405, 276, 2048 / 1881, 2048 / 2067)
# the banner and the card: (the art rows shown from the top, the art x at the middle)
BANNER_ROWS, BANNER_X = 700, 406     # the head, the scarf and the pointing hand; the face in the middle (as the stock busts)
PDA_ROWS, PDA_X = 1165, 375          # the head down to the knees; the hand and the hair inside the card
# the crest (HeroPortraitCoatArms: a white emblem on every stock character, ICEY's alpha box): DELTARUNE's own heart
# outline, read from the player's install, whole-number scale. The page that shows it is switched off in the PC game
CREST, CREST_BOX = ("spr_heartoutline", 0), (25, 54, 973, 969)


def available():
    return os.path.exists(ART)


def art():
    im = Image.open(ART).convert("RGBA")
    if im.size != ART_SIZE:
        raise SystemExit("DELTARUNE: Party: %s is %dx%d, expected %dx%d (the portrait landmarks were measured on that file)" % ((ART,) + im.size + ART_SIZE))
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box is None or any(abs(a - b) > 6 for a, b in zip(box, ART_BOX)):
        raise SystemExit("DELTARUNE: Party: %s differs from the measured art (figure box %s, expected %s)" % (ART, box, ART_BOX))
    return im


# ---------------------------------------------------------------- placement rows
def landmarks():
    """Kris's lines in the HeroPortraitFull texture, normalised (x / width, y / height from the top)."""
    x0, y0 = FULL_CROP[:2]; W, H = FULL_SIZE
    return {"top": (ART_TOP - y0) / H, "feet": (ART_FEET - y0) / H, "x": (ART_FACE_X - x0) / W}


def ref_rows():
    """Hibiki's rows in the installed game's table: key -> (PivotX, PivotY, Scale)."""
    p = os.path.join(ROOT, "decoded", "tables", "HeroPortraitOffsetConfigUI.json")
    rows = json.load(open(p + ".orig" if os.path.exists(p + ".orig") else p, encoding="utf-8"))
    rows = rows if isinstance(rows, list) else next(v for v in rows.values() if isinstance(v, list))
    return {r["Key"]: (r["PivotX"], r["PivotY"], r["Scale"]) for r in rows if r["Id"] == REF_ID}


def match_row(ref_row, k=1.0):
    """(PivotX, PivotY, Scale) that shows Kris's figure between the reference's REF_TOP and REF_FLOOR lines with the
    face on REF_X, in the reference's own key. k scales the figure about its feet (1 = hair top on REF_TOP)."""
    px_r, py_r, s_r = ref_row; Wr, Hr = REF_SIZE; W, H = FULL_METRICS; lm = landmarks()
    top = REF_FLOOR - (REF_FLOOR - REF_TOP) * k
    y_top = ((1 - top / Hr) - py_r) * Hr * s_r               # where the reference shows those lines (units, up)
    y_floor = ((1 - REF_FLOOR / Hr) - py_r) * Hr * s_r
    x_face = (REF_X / Wr - px_r) * Wr * s_r
    s = (y_top - y_floor) / (H * (lm["feet"] - lm["top"]))
    return lm["x"] - x_face / (s * W), (1 - lm["top"]) - y_top / (s * H), s


def row_values(key, k=1.0):
    return match_row(ref_rows()[key], k)


def offset_rows():
    """Kris's HeroPortraitOffsetConfigUI rows, every key the reference has (appended: Id is not unique in the table)."""
    ref = ref_rows(); out = []
    for key in KEYS:
        if key not in ref: continue
        px, py, s = match_row(ref[key])
        out.append({"Id": ACTOR, "Key": key, "PivotX": round(px, 4), "PivotY": round(py, 4), "Scale": round(s, 4), "$append": True})
    return out


# ---------------------------------------------------------------- compositions
def compose_full(im=None):
    """HeroPortraitFull: the whole figure, 1:1, no resampling."""
    return (im or art()).crop(FULL_CROP)


def place(src, canvas, metrics, box, rows=None, centre=None):
    """The figure (or its top `rows`) in a stock slot: as large as fits `box` (canvas px), bottom-centred (or centred
    on the art x `centre`), drawn so that it is NOT stretched when the game shows the canvas at `metrics`."""
    if rows: src = src.crop((0, 0, src.width, rows))
    ux, uy = metrics[0] / canvas[0], metrics[1] / canvas[1]          # shown units per canvas px
    bw, bh = box[2] - box[0], box[3] - box[1]
    k = min(bw * ux / src.width, bh * uy / src.height)               # shown units per art px
    w, h = max(1, round(src.width * k / ux)), max(1, round(src.height * k / uy))
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    im = src.resize((w, h), Image.LANCZOS)
    x = (box[0] + box[2]) // 2 - (w // 2 if centre is None else round(centre * k / ux))
    out.alpha_composite(im, (max(0, min(canvas[0] - w, x)), box[3] - h))
    return out


def compose_mb(im):
    """HeroPortraitFullMB: Kris between the reference's REF_TOP and REF_FLOOR lines, where his texture has them."""
    ox, oy, kx, ky = MB_REF
    k = (REF_FLOOR - REF_TOP) / (ART_FEET - ART_TOP)                 # reference art px per art px
    sc = im.resize((round(im.width * k * kx), round(im.height * k * ky)), Image.LANCZOS)
    x = round(ox + REF_X * kx - ART_FACE_X * k * kx); y = round(oy + REF_TOP * ky - ART_TOP * k * ky)
    out = Image.new("RGBA", SLOTS["mb"][1], (0, 0, 0, 0))
    out.alpha_composite(sc, (x, y))
    return out


def window(im, size, rows, centre):
    """A head / card crop: the art's top `rows` rows fill the height, the art x `centre` is in the middle."""
    w, h = size; k = h / rows
    sc = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    x = round(w / 2 - centre * k)
    src = sc.crop((max(0, -x), 0, min(sc.width, w - x), h))
    out.alpha_composite(src, (max(0, x), 0))
    return out


def diamond(im, w, h):
    """A stock-shaped diamond cut: the square scaled to w, cropped to h, outside the diamond transparent (4x mask)."""
    sq = im.resize((w, w), Image.LANCZOS).crop((0, (w - h) // 2, w, (w - h) // 2 + h))
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).polygon([(w * 2, 0), (w * 4, h * 2), (w * 2, h * 4), (0, h * 2)], fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    sq.putalpha(Image.fromarray(np.minimum(np.array(sq.getchannel("A")), np.array(m))))
    return sq


def crest(frames):
    """HeroPortraitCoatArms: DELTARUNE's heart outline in white (its own pixels, the largest whole-number scale that
    fits the stock crest box), on the stock 1024 canvas."""
    a = np.array(frames.get(*CREST)[0]); m = a[..., 3] > 0
    ys, xs = np.where(m); m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    bw, bh = CREST_BOX[2] - CREST_BOX[0], CREST_BOX[3] - CREST_BOX[1]
    k = max(1, min(bw // m.shape[1], bh // m.shape[0]))
    m = np.kron(m, np.ones((k, k), bool)); h, w = m.shape
    out = np.zeros((1024, 1024, 4), np.uint8); out[..., :3] = 255
    x, y = (CREST_BOX[0] + CREST_BOX[2] - w) // 2, (CREST_BOX[1] + CREST_BOX[3] - h) // 2
    out[y:y + h, x:x + w, 3] = m * 255
    return Image.fromarray(out)


def images(frames=None):
    """{bundle path: (donor bundle, renames, PIL image)} for every texture; {} without the art."""
    if not available():
        return {}
    im = art()
    fig = im.crop(ART_BOX)
    pics = {"full": compose_full(im),
            # the mobile slot (no placement row there: the art goes where the stock art is in the texture)
            "lmb": place(fig, (1024, 1024), SLOTS["lmb"][2], (0, 150, 947, 1024), rows=int(fig.height * 0.78)),
            "mb": compose_mb(im)}
    if frames is None:
        import dr_source
        frames = dr_source.Frames()
    pics["coatarms"] = crest(frames)
    out = {}
    for key, (b, size, _) in SLOTS.items():
        assert pics[key].size == size, (key, pics[key].size, size)
        out["ui/texture/" + (b % ACTOR)] = ("ui/texture/" + (b % ICEY), [(str(ICEY), str(ACTOR))], pics[key])
    head = im.crop(HEAD_BOX)
    for key, (folder, name, (w, h), kind) in HEADS.items():
        if kind == "square":
            pic = head.resize((w, h), Image.LANCZOS)
        elif kind == "final":                                   # the head, whole, in the middle of the plate's box
            pic = Image.new("RGBA", (w, h), (0, 0, 0, 0)); sq = head.resize((h, h), Image.LANCZOS); pic.alpha_composite(sq, ((w - h) // 2, 0))
        elif kind == "banner":
            pic = window(im, (w, h), BANNER_ROWS, BANNER_X)
        elif kind == "pda":
            pic = window(im, (w, h), PDA_ROWS, PDA_X)
        else:
            pic = diamond(head, w, h)
            if kind == "diamond_grey":
                g = ImageOps.grayscale(pic).convert("RGBA"); g.putalpha(pic.getchannel("A")); pic = g
        out["ui/texture/%s/%s" % (folder.lower(), name.lower())] = (_CA, [("HeroPortraitCoatArms", folder), ("HeroPortraitFull_%d" % ICEY, name)], pic)
    return out


def build(out_dir, log=print, frames=None):
    """Write the texture bundles into the build folder; returns manifest additions (empty without the art)."""
    adds = {"names": [], "entries": [], "guids": []}
    if not available():
        log("  Kris portraits: the official art is missing (%s): no portraits this build" % ART)
        return adds
    sys.path.insert(0, os.path.join(ROOT, "tools", "bbtag"))
    import bbtag_rig
    for dst, (src, renames, im) in images(frames).items():
        r = bbtag_rig.clone_texture(src, dst, renames, im, out_dir, log)
        for k in adds: adds[k] += r[k]
    log("  Kris portraits: %d textures" % len(adds["names"]))
    return adds


def spec():
    """mod.json's static half: {"spriteAliases", "metrics" (appendItems), "HeroPortraitOffsetConfigUI" (table edits)}."""
    if not available():
        return {"spriteAliases": {}, "metrics": [], "HeroPortraitOffsetConfigUI": []}
    metrics = [{"list": "_entries", "key": "path", "value": {"path": "UI/Texture/" + (SLOT_PATH[k] % ACTOR), "width": m[0], "height": m[1]}}
               for k, (_, _, m) in SLOTS.items()]
    metrics += [{"list": "_entries", "key": "path", "value": {"path": "UI/Texture/%s/%s" % (f, n), "width": s[0], "height": s[1]}}
                for f, n, s, _ in HEADS.values()]
    aliases = {sprite: "tex:UI/Texture/%s/%s" % (HEADS[k][0], HEADS[k][1]) for sprite, k in ALIASES.items()}
    return {"spriteAliases": aliases, "metrics": metrics, "HeroPortraitOffsetConfigUI": offset_rows()}


if __name__ == "__main__":   # a local preview sheet (local_only only: it holds the official art)
    ims = images()
    for r in offset_rows():
        print("  %-24s PivotX %.4f  PivotY %.4f  Scale %.4f" % (r["Key"], r["PivotX"], r["PivotY"], r["Scale"]))
    sheet = Image.new("RGBA", (sum(min(im.width, 512) + 8 for _, _, im in ims.values()), 1024), (16, 19, 24, 255)); x = 0
    for _, _, im in ims.values():
        t = im.copy(); t.thumbnail((512, 1024)); sheet.alpha_composite(t, (x, 0)); x += t.width + 8
    p = os.path.join(ROOT, "local_only", "deltarune", "party", "kris_portraits_preview.png"); sheet.save(p); print(p, len(ims), "textures")
