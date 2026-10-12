"""rrb_portrait.py -- Ruby's character-select portrait: the HeroPortraitFull / HeroPortraitFullMB compositions and her
HeroPortraitOffsetConfigUI rows (every screen key), sized so she displays as tall as Hibiki (the lead, 2026-09-29).

How the game shows a HeroPortraitFull texture (verified in the stock JS and the select prefab, 2026-09-29):
  SceneUIHeroSelect.SetHeroPortrait: RImgHero.sizeDelta = the texture's METRICS size (ui/texture/metrics), anchored
  position (0, 0) at the centre of the hero cell, pivot = (PivotX, PivotY), localScale = Scale from
  HeroPortraitOffsetConfigUI[Id, "BreedPrepare"] (selected; its parent ChangeHero is scaled 1.065) or
  [Id, "BreedPrepareS"] (the other cells). The cell soft-masks it to a 526-unit-wide strip (300 unselected).
  Every other screen (FesL/FesR, BreedResult, BreedFinishRoom, GenericActorDetail, BattleChallengePrepare,
  PvpTeamMatchL/R, FesShadowL/R) does the same with its own key (UIUtil.SetPortraitConfig / WidgetActorPortrait).
So what a player sees is fixed by (metrics, row) and the art's placement inside the texture. For each key her row is
solved so that her body (hair top to lowest boot) displays exactly as tall as Hibiki's in the same key (K), with her
eye line and eye midpoint where Hibiki's are: the same size and alignment as the lead's reference on every screen.

The texture is her whole BBTAG figure (art_main_36rrb, read from the player's install at build time) at its own
resolution: cropped to the figure, no resampling, no stretch, nothing clipped (hand, spear tip, scythe blades,
boots), metrics = texture size (like Hibiki's 1480x1788). Nothing here stores any BBTAG pixels.

Landmarks were measured on the stock textures of the installed build (HeroPortraitOffsetConfigUI of build 25598842
decoded live == decoded/tables/.orig) and on art_main_36rrb.hip, 2026-09-29. The offline check renders the carousel and
every key from these numbers: local_only/ruby_v2/portrait/render_portraits.py (development only; its PNGs hold game art).
"""

ACTOR = 200701

# ---------------------------------------------------------------- her art (art_main_36rrb.hip, 2048 x 2048 RGBA)
ART_SIZE = (2048, 2048)
ART_ALPHA_BOX = (244, 57, 1902, 1992)   # alpha > 8 bounding box (exclusive right / bottom)
ART_HEAD_TOP = 525                      # top of her hair (her raised hand, 410, and the shaft's spike, 57, excluded)
ART_FEET = 1990                         # lowest boot sole
ART_EYES = (836, 651)                   # midpoint between her eyes

# HeroPortraitFull: the figure with a 2-4 px margin, sides a multiple of 4 (BC7 blocks); shown 1:1 (metrics = size)
FULL_CROP = (242, 53, 1906, 1993)
FULL_SIZE = (FULL_CROP[2] - FULL_CROP[0], FULL_CROP[3] - FULL_CROP[1])   # (1664, 1940)
FULL_METRICS = FULL_SIZE

# ---------------------------------------------------------------- the reference: Hibiki Kohaku (102901)
REF_SIZE = (1480, 1788)                 # HeroPortraitFull texture == metrics
REF_HEAD_TOP, REF_FEET, REF_EYES = 34, 1787, (712, 192)
# her stock rows, every key (Id 102901; installed build 25598842): key -> (PivotX, PivotY, Scale)
REF_ROWS = {
    "BattleChallengePrepare": (0.50, 0.32, 0.80), "BreedFinishRoom": (0.41, 0.53, 1.30),
    "BreedPrepare": (0.43, 0.62, 1.00), "BreedPrepareS": (0.46, 0.69, 0.90), "BreedResult": (0.50, 0.45, 1.00),
    "FesL": (0.33, 0.51, 0.62), "FesR": (0.66, 0.51, 0.62), "FesShadowL": (0.80, 0.42, 1.00), "FesShadowR": (0.18, 0.42, 1.00),
    "GenericActorDetail": (0.62, 0.32, 0.80), "PvpTeamMatchL": (0.45, 0.51, 1.20), "PvpTeamMatchR": (0.50, 0.51, 1.20),
}
K = 1.0          # her displayed body height / Hibiki's (1.0 = equal; her head then shows ~10 % larger, her pose is a leap)
EYE_DY = 0.0     # extra lift of her eye line above Hibiki's, in Hibiki display units (negative lowers her)

# HeroPortraitFullMB (2048 x 2048, metrics 1881 x 2067 for every stock hero; co-op / mobile screens set the texture
# only, no row): Hibiki's MB is her full art 1:1 at offset (+405, +276): eyes (1117, 468), head top 310, feet cut
# at the bottom. Her whole figure cannot match that (it would need 2315 px of height and cut the scythe blade), so
# MB fills the texture height with the whole figure (1935 -> 2047 px, x1.058: body 88 % of Hibiki's; was 73 %)
# and keeps her eyes as close to Hibiki's x as the blade allows.
MB_SIZE, MB_METRICS = (2048, 2048), (1881, 2067)
MB_REF_EYES = (1117, 468)


def landmarks():
    """Her landmarks in the HeroPortraitFull texture, normalised (x / width, y / height from the top)."""
    x0, y0 = FULL_CROP[:2]; W, H = FULL_SIZE
    return {"head_top": (ART_HEAD_TOP - y0) / H, "feet": (ART_FEET - y0) / H,
            "eye_x": (ART_EYES[0] - x0) / W, "eye_y": (ART_EYES[1] - y0) / H}


def ref_landmarks():
    W, H = REF_SIZE
    return {"head_top": REF_HEAD_TOP / H, "feet": REF_FEET / H, "eye_x": REF_EYES[0] / W, "eye_y": REF_EYES[1] / H}


def match_row(ref_row, ref_metrics, ref_lm, metrics, lm, k=K, eye_dy=EYE_DY):
    """(PivotX, PivotY, Scale) that shows `lm` (normalised landmarks in a texture shown at `metrics`) with its body
    k x as tall as the reference's, its eye line and eye midpoint where the reference's are (same anchor, same key).
    Display (up = +y) of a normalised point (u, v) = ((u - px) * W * s, ((1 - v) - py) * H * s)."""
    px_r, py_r, s_r = ref_row; Wr, Hr = ref_metrics; W, H = metrics
    s = k * s_r * Hr * (ref_lm["feet"] - ref_lm["head_top"]) / (H * (lm["feet"] - lm["head_top"]))
    eye_up = s_r * Hr * ((1 - ref_lm["eye_y"]) - py_r) + eye_dy      # reference eye line above the anchor
    py = (1 - lm["eye_y"]) - eye_up / (s * H)
    px = lm["eye_x"] - s_r * Wr * (ref_lm["eye_x"] - px_r) / (s * W)
    return px, py, s


def row_values(key, k=K, eye_dy=EYE_DY):
    return match_row(REF_ROWS[key], REF_SIZE, ref_landmarks(), FULL_METRICS, landmarks(), k, eye_dy)


def offset_rows(actor=ACTOR, k=K, eye_dy=EYE_DY):
    """Her HeroPortraitOffsetConfigUI rows, all 12 keys, as bbmod table edits (append-only rows: Id is not unique
    in this table). Use in place of the copied donor rows: T["HeroPortraitOffsetConfigUI"] = offset_rows()."""
    out = []
    for key in sorted(REF_ROWS):
        px, py, s = row_values(key, k, eye_dy)
        out.append({"Id": actor, "Key": key, "PivotX": round(px, 4), "PivotY": round(py, 4), "Scale": round(s, 4), "$append": True})
    return out


def check_art(fig):
    """The composition depends on measured landmarks: refuse an art file that is not the one they were measured on."""
    if fig.size != ART_SIZE:
        raise SystemExit("Cross Effect: art_main_36rrb is %dx%d, expected %dx%d (portrait landmarks)" % (fig.size + ART_SIZE))
    box = fig.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box is None or box[0] < FULL_CROP[0] or box[1] < FULL_CROP[1] or box[2] > FULL_CROP[2] or box[3] > FULL_CROP[3]:
        raise SystemExit("Cross Effect: art_main_36rrb's figure %s falls outside the portrait crop %s" % (box, FULL_CROP))
    if abs(box[0] - ART_ALPHA_BOX[0]) > 6 or abs(box[1] - ART_ALPHA_BOX[1]) > 6 or abs(box[3] - ART_ALPHA_BOX[3]) > 6:
        raise SystemExit("Cross Effect: art_main_36rrb differs from the measured one (figure box %s, expected %s)" % (box, ART_ALPHA_BOX))


def compose_full(fig):
    """HeroPortraitFull (FULL_SIZE, shown at FULL_METRICS): the whole figure, 1:1, no resampling."""
    fig = fig.convert("RGBA"); check_art(fig)
    return fig.crop(FULL_CROP)


def mb_layout():
    """(scale, x offset, y offset) of the 2048 art inside the MB texture."""
    x0, y0, x1, y1 = ART_ALPHA_BOX
    s = (MB_SIZE[1] - 1) / (y1 - y0)                       # the figure fills the height
    right = MB_SIZE[0] - 4                                  # keep the scythe blade inside
    eye_x = min(MB_REF_EYES[0], right - (x1 - ART_EYES[0]) * s)
    ox = eye_x - ART_EYES[0] * s; oy = -y0 * s
    return s, ox, oy


def compose_mb(fig):
    from PIL import Image
    fig = fig.convert("RGBA"); check_art(fig)
    s, ox, oy = mb_layout()
    im = fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)
    ox, oy = round(ox), round(oy)
    # the part of the scaled art that lands inside the texture (only empty margins fall outside)
    sx, sy = max(0, -ox), max(0, -oy)
    ex, ey = min(im.width, MB_SIZE[0] - ox), min(im.height, MB_SIZE[1] - oy)
    out = Image.new("RGBA", MB_SIZE, (0, 0, 0, 0))
    out.alpha_composite(im.crop((sx, sy, ex, ey)), (ox + sx, oy + sy))
    return out


if __name__ == "__main__":
    lm = landmarks()
    print("texture %dx%d, metrics %dx%d; head %.4f feet %.4f eyes (%.4f, %.4f)" % (FULL_SIZE + FULL_METRICS + (lm["head_top"], lm["feet"], lm["eye_x"], lm["eye_y"])))
    for r in offset_rows():
        print("  %-24s PivotX %.4f  PivotY %.4f  Scale %.4f" % (r["Key"], r["PivotX"], r["PivotY"], r["Scale"]))
    print("MB layout: scale %.4f offset (%.1f, %.1f)" % mb_layout())
