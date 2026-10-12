"""party_ui.py -- the party's UI textures, made at build time: the command's SOUL, reticles, arrow, circle and the
target-mode screen's two fonts (from the player's own DELTARUNE install) and the portraits (from the official art the
lead chose, kept in local_only; DECISIONS.md 2026-10-02 "Portraits"). Nothing here is stored in the mod: the importer
writes the texture bundles into the build, build_kris.py writes the font metrics and the screen's labels (read from
the install, docs/deltarune/party/research/TARGET_MODE_SCREEN.md 3.2) into the BattleUI append.

Each texture is a clone of a stock UI texture (ICEY's coat-of-arms portrait, as char-ruby's ruby_ui does) with our
image; the mod's static half (spriteAliases and ui/texture/metrics rows) comes from spec(), which build_kris.py
writes into mod.json, so the names on both halves can't drift.

Fonts (font_atlas / font_metrics): every glyph of fnt_mainbig / fnt_main for codes 32-126 (both fonts have no Latin-1
glyphs; 127 is skipped) scaled FONT_SCALE x with nearest, FONT_PAD DELTARUNE px (x FONT_SCALE) of clear space around
each, packed in code order on rows. Positions and sizes are multiples of 4, so every 4 x 4 block of the BC7 texture is
one DELTARUNE pixel (no compression bleed). Glyphs stay white (DELTARUNE's own colour; the script tints). Metrics per
font: {"tex", "scale", "w", "h" (atlas px), "line" (tallest glyph, DELTARUNE px), "g": {"<code>": [x, y, w, h, shift,
offset]}}: x, y, w, h the glyph's rect in the atlas in atlas px with y from the atlas BOTTOM (Sprite.Create's rect),
shift (advance) and offset (x offset) in DELTARUNE px. DELTARUNE's glyph rects all start at the line's top and are cut
off below the last inked row, so a glyph is drawn with its rect's top on the line's top (heights differ: 'g' 32, 'A'
26, '-' 18 on fnt_mainbig).
"""
import json
import os
import pathlib
import struct
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ART = ROOT / "local_only" / "deltarune" / "party" / "art"
ICEY = 103701
DONOR = "ui/texture/heroportraitcoatarms/heroportraitfull_%d" % ICEY
FOLDER = "DR"                                   # UI/Texture/DR/<name>; bundles ui/texture/dr/<name lower>

# name -> (DELTARUNE sprite, frame, scale, keep the whole canvas)  (the command UI; DELTARUNE's own art, white so the UI
# tints it with the acting companion's colour, as DELTARUNE does; whole-number scaling). The reticle's 8 frames keep
# their 130 px canvas so the frames keep their sizes relative to each other (it grows from frame 0 to 7 on hover).
COMMAND = {"DRParty_SOUL": ("spr_heart", 0, 4, True), "DRParty_ReticleRed": ("spr_plat_targetmode_reticle_red", 0, 8, False),
           "DRParty_Dot": ("spr_plat_targetmode_circle", 0, 8, False), "DRParty_Cross": ("spr_plat_targetmode_cross", 0, 4, False)}
COMMAND.update({"DRParty_Reticle_%d" % i: ("spr_plat_targetmode_reticle", i, 2, True) for i in range(8)})
# the target-mode screen (TARGET_MODE_SCREEN.md 3.3-3.5), whole canvases so DELTARUNE's origins keep their places:
# the arrow (18 x 18, origin 9,9 = the centre; white fill, black outline: the accent tints the fill, as image_blend
# does), the centre circle (6 x 6, origin 3,3; white and black), the SOUL (spr_dodgeheart 20 x 20, origin 0,0; red and
# black, drawn untinted)
COMMAND.update({"DRParty_Arrow": ("spr_plat_targetmode_arrow", 0, 4, True),
                "DRParty_Circle": ("spr_plat_targetmode_circle", 0, 4, True),
                "DRParty_Heart": ("spr_dodgeheart", 0, 4, True)})
# the Tension meter (0.5.0): DELTARUNE's own gauge, whole canvases (25 x 196 slanted bar: its frame, its dark inside, the
# orange filling and the white flash of a gain), the TP logo, and the graze outline that flashes on a perfect dodge
COMMAND.update({"DRParty_TPFrame": ("spr_tensionbar", 0, 4, True), "DRParty_TPBack": ("spr_tensionbar", 1, 4, True),
                "DRParty_TPFill": ("spr_tensionfilling", 0, 4, True), "DRParty_TPFlash": ("spr_tensionfilling", 2, 4, True),
                "DRParty_TPLogo": ("spr_tplogo", 0, 4, True), "DRParty_Graze": ("spr_grazeappear", 2, 4, True)})

# 0.5.1: the party panel (js/command.js drawPanel): DELTARUNE's battle head icons (frame 0 the face, 1 the sword, 2 the
# fire, 5 the hurt face) and name graphics; the SOUL's end (drawSoul): the broken heart and its four shard frames (the
# whole SOUL is DRParty_SOUL above)
COMMAND.update({"DRParty_HeadS_%d" % i: ("spr_headsusie", i, 4, True) for i in (0, 1, 5)})
COMMAND.update({"DRParty_HeadR_%d" % i: ("spr_headralsei", i, 4, True) for i in (0, 2, 5)})
COMMAND.update({"DRParty_NameS": ("spr_bnamesusie", 0, 4, True), "DRParty_NameR": ("spr_bnameralsei", 0, 4, True),
                "DRParty_SoulBreak": ("spr_heartbreak", 0, 4, True)})
COMMAND.update({"DRParty_Shard_%d" % i: ("spr_heartshards", i, 4, True) for i in range(4)})

# Potential icons: DELTARUNE's own pixel glyphs (0.5.3: the heart, the lead's "i want the white heart icon"; 0.5.5: the
# other ten, the lead's "yes icon sheet is good" on local_only/deltarune/party/icons/glyphs_review.png). Nothing is drawn
# here: every shape is a DELTARUNE sprite read from the player's install, in the game's two icon tones (white, and its
# secondary grey at alpha 106 with a clear gap to the white), scaled by whole numbers on the game's 256 x 256 canvas.
# A layer: (sprite, frame, tone, fit, centre x, centre y, flip, quarter turns, bright):
#   fit     the largest whole-number scale whose drawn area fits that many pixels;
#   bright  keep only the sprite's light pixels (luminance from that value up: a swirl, a glyph on a black tile).
# Each is built as the card texture UI/Texture/IconPotential/<name> and painted into the HUD atlas's cell of the same
# name (paint_hud_cells; kris_potentials.FINAL_ICONS asks the loader for those cells).
def _L(spr, i, tone, fit, cx=128, cy=128, flip=False, rot=0, bright=None):
    return (spr, i, tone, fit, cx, cy, flip, rot, bright)


ICON_GREY, ICON_GAP = 106, 5
ICONS = {
    "Potential_20801": [_L("spr_headkris", 1, "main", 190, bright=40)],                                  # A: Kris's slash (the sword)
    "Potential_20806": [_L("spr_plat_kris_ball", 0, "main", 170, bright=110),                           # B: the air spin (the ball)
                        _L("spr_plat_cloudplatform_fx", 4, "grey", 230, 128, 226)],
    "Potential_20808": [_L("spr_plat_kris_ball", 1, "main", 130, 128, 84, bright=110),                  # B3: the Diving Spin
                        _L("spr_kris_plat_slash_air_foreground", 10, "grey", 200, 128, 190)],
    "Potential_20809": [_L("spr_rudebuster_beam", 2, "main", 200, 136, 128),                            # C: Rude Buster (its beam)
                        _L("spr_rudebuster_beam", 0, "grey", 150, 60, 128)],
    "Potential_20816": [_L("spr_headralsei", 2, "main", 190)],                                           # D: Fireshock (the flame)
    "Potential_20822": [_L("spr_heart", 0, "main", 160)],                                                # E: the party command (the SOUL)
    "Potential_20825": [_L("spr_attack_cut1", 0, "grey", 215, flip=True), _L("spr_attack_cut1", 0, "main", 215)],   # E4: X Slash
    "Potential_20826": [_L("spr_plat_targetmode_arrow", 0, "main", 150, 128, 100, rot=1),               # F: the jumps
                        _L("spr_plat_cloudplatform_fx", 3, "grey", 200, 128, 204), _L("spr_plat_cloudplatform_fx", 4, "grey", 230, 128, 232)],
    "Potential_20828": [_L("spr_kris_plat_run", 1, "main", 200, 140, 118), _L("spr_dash_ripple", 3, "grey", 200, 110, 222)],   # G1: the dash
    "Potential_20829": [_L("spr_headralsei", 0, "grey", 96, 50, 112, bright=40), _L("spr_headsusie", 0, "grey", 96, 128, 112, bright=40),   # G2-3: Party Dash
                        _L("spr_headkris", 0, "main", 96, 206, 112, bright=40), _L("spr_dash_ripple", 3, "grey", 220, 128, 206)],
    "Potential_20831": [_L("spr_tplogo", 0, "main", 200)],                                               # H: the universal cards (TP)
}
HUD_ATLAS = "ui/atlas/iconpotential200801/iconpotential200801"
FOLDERS = {name: "IconPotential" for name in ICONS}      # every other texture here lives in UI/Texture/DR


def icon_image(frames, name):
    import numpy as np
    from PIL import ImageFilter
    main = np.zeros((256, 256), bool); grey = np.zeros((256, 256), bool)
    for spr, i, tone, fit, cx, cy, flip, rot, bright in ICONS[name]:
        a = np.array(frames.get(spr, i)[0])
        m = a[..., 3] > 0
        if bright is not None:
            m &= (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114) >= bright
        if flip: m = m[:, ::-1]
        if rot: m = np.rot90(m, rot)
        ys, xs = np.where(m)
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        k = max(1, fit // max(m.shape))
        m = np.kron(m, np.ones((k, k), bool))
        h, w = m.shape
        x, y = int(round(cx - w / 2)), int(round(cy - h / 2))
        ys, xs = np.where(m); ys, xs = ys + y, xs + x
        ok = (ys >= 0) & (ys < 256) & (xs >= 0) & (xs < 256)
        (main if tone == "main" else grey)[ys[ok], xs[ok]] = True
    near = np.array(Image.fromarray((main * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * ICON_GAP + 1))) > 0
    grey &= ~near                                     # the grey stops short of the white: the stock icons' rule
    out = np.zeros((256, 256, 4), np.uint8); out[..., :3] = 255
    out[..., 3] = np.where(main, 255, np.where(grey, ICON_GREY, 0))
    return Image.fromarray(out)


def paint_hud_cells(out_dir, frames, log=print):
    """The HUD atlas clone (made by the loader before the importers run) has a cell for each ICONS name, filled with a
    stand-in: put our image there. The cell's place is its Sprite's m_Rect (pixels from the page's bottom left)."""
    import UnityPy
    p = os.path.join(str(out_dir), *(HUD_ATLAS + ".ab").split("/"))
    if not os.path.exists(p):
        raise SystemExit("DELTARUNE: Party: the HUD atlas %s is not in the build (it is made by the loader's bundleClones)" % HUD_ATLAS)
    env = UnityPy.load(p)
    rects, tex = {}, None
    for o in env.objects:
        if o.type.name == "Sprite":
            d = o.read()
            if d.m_Name in ICONS:
                r = d.m_Rect; rects[d.m_Name] = (int(round(r.x)), int(round(r.y)), int(round(r.width)), int(round(r.height)))
        elif o.type.name == "Texture2D":
            tex = o
    miss = [n for n in ICONS if n not in rects]
    if miss or tex is None:
        raise SystemExit("DELTARUNE: Party: the HUD atlas has no cell for %s" % (miss or "any sprite (no texture)"))
    d = tex.read(); page = d.image.convert("RGBA"); H = page.height
    for name, (x, y, w, h) in rects.items():
        page.paste(icon_image(frames, name).resize((w, h), Image.LANCZOS), (x, H - y - h))
    d.image = page; d.save()
    with open(p, "wb") as f:
        f.write(env.file.save(packer="lz4"))
    log("  party UI: HUD atlas cells painted: %s" % ", ".join("%s %dx%d" % (n, r[2], r[3]) for n, r in sorted(rects.items())))


# the target-mode screen's fonts: texture name -> (DELTARUNE font, key in __bbDRPartyFont)
FONTS = {"DRParty_FontBig": ("fnt_mainbig", "big"), "DRParty_FontMain": ("fnt_main", "main")}
FONT_SCALE = 4
FONT_PAD = 2                                    # DELTARUNE px of clear space around each glyph (x FONT_SCALE in the atlas)
FONT_CODES = list(range(32, 127)) + list(range(160, 256))   # printable ASCII and Latin-1, where the font has them
# the screen's category labels (stringsetloc keys in obj_plat_foreground_writer Create; TARGET_MODE_SCREEN.md 3.2)
LABEL_CODE = "gml_Object_obj_plat_foreground_writer_Create_0"
LABEL_KEYS = {"none": "obj_plat_foreground_writer_slash_Create_0_gml_4_0", "susie": "obj_plat_foreground_writer_slash_Create_0_gml_6_0",
              "ralsei": "obj_plat_foreground_writer_slash_Create_0_gml_7_0", "all": "obj_plat_foreground_writer_slash_Create_0_gml_8_0"}
CACHE = ROOT / "local_only" / "deltarune" / "party" / "frames"   # dr_source.Frames' cache folder (DELTARUNE data stays local)
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import dr_pack                                    # 0.6.4: an alpha TEST package carries these files (dr_pack.py)
if dr_pack.active():
    CACHE, ART = dr_pack.path("frames"), dr_pack.path("art")

# the HUD heads (square crops of the official art; boxes in the art's own pixels)
HEADS = {"DRParty_Head_Kris": ("Kris_artwork_Famitsu.png", (100, 0, 800, 700)),
         "DRParty_Head_Susie": ("Susie_artwork_Famitsu.png", (230, 20, 830, 620)),
         "DRParty_Head_Ralsei": ("Ralsei_artwork_Famitsu.png", (560, 220, 1100, 760))}


def images(frames):
    """name -> PIL RGBA image, for every texture this module makes."""
    out = {}
    for name, (spr, i, k, whole) in COMMAND.items():
        im, _ = frames.get(spr, i)
        if not whole:
            im = im.crop(im.getchannel("A").getbbox() or (0, 0, im.width, im.height))
        out[name] = pad4(im.resize((im.width * k, im.height * k), Image.NEAREST))
    for name in FONTS:
        out[name] = font_atlas(name)[0]
    # 0.5.2: a white square of our own for the overlay's plain boxes (js/command.js solid(): an Image without a sprite
    # draws nothing in this game)
    out["DRParty_White"] = Image.new("RGBA", (16, 16), (255, 255, 255, 255))
    for name in ICONS:
        out[name] = icon_image(frames, name)
    for name, (fn, box) in HEADS.items():
        p = ART / fn
        if p.exists():
            out[name] = Image.open(p).convert("RGBA").crop(box).resize((256, 256), Image.LANCZOS)
    return out


def pad4(im):
    """Block-compressed textures want sides in multiples of 4."""
    w, h = (im.width + 3) // 4 * 4, (im.height + 3) // 4 * 4
    if (w, h) == im.size:
        return im
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return c


# ---------------------------------------------------------------- fonts and labels (read from the DELTARUNE install)
def _gm():
    """The research reader (tools/deltarune/research_scratch), read-only on the install, and its page decoder."""
    import dr_source
    if str(dr_source.SCRATCH) not in sys.path:
        sys.path.insert(0, str(dr_source.SCRATCH))
    import gmdata, sheet
    return gmdata, sheet


def _stamp():
    """The install's data.win (size, mtime): the local cache is redone when DELTARUNE updates."""
    if dr_pack.active():
        return dr_pack.stamp()
    gmdata, _ = _gm()
    st = os.stat(gmdata.CH5)
    return [st.st_size, st.st_mtime_ns]


_FONTS, _G = {}, []


def _reader():
    if dr_pack.active():
        dr_pack.missing("a font or the target-mode labels")
    if not _G:
        gmdata, sheet = _gm()
        _G[:] = [gmdata.GM(), sheet]
    return _G


def font_source(font):
    """-> (the font's glyph sheet as PIL RGBA, {code: (x, y, w, h, shift, offset)}) in DELTARUNE px, cached under
    local_only (font_<name>.png / .json)."""
    if font in _FONTS:
        return _FONTS[font]
    png, js = CACHE / ("font_%s.png" % font), CACHE / ("font_%s.json" % font)
    stamp = _stamp()
    if png.exists() and js.exists():
        meta = json.loads(js.read_text())
        if meta.get("stamp") == stamp:
            _FONTS[font] = (Image.open(png).convert("RGBA"), {int(k): tuple(v) for k, v in meta["glyphs"].items()})
            return _FONTS[font]
    g, sheet = _reader()
    for p in g.plist("FONT"):
        if g.s(g.u32(p)) == font:
            break
    else:
        raise SystemExit("DELTARUNE: Party: font %s not found in %s" % (font, g.path))
    # FONT entry: name, display name, size, bold, italic, range, ..., TPAG pointer at +28, glyph count at +52 (as
    # tm_render.font(); the glyph: char, x, y, w, h (u16), shift, offset (i16))
    tp = g.tpag(g.u32(p + 28))
    page = sheet.page(g, tp["page"]).crop((tp["sx"], tp["sy"], tp["sx"] + tp["sw"], tp["sy"] + tp["sh"]))
    glyphs = {}
    for k in range(g.u32(p + 52)):
        ch, x, y, w, h, shift, off = struct.unpack_from("<5H2h", g.mm, g.u32(p + 56 + 4 * k))
        glyphs[ch] = (x, y, w, h, shift, off)
    CACHE.mkdir(parents=True, exist_ok=True)
    page.save(png)
    js.write_text(json.dumps({"font": font, "stamp": stamp, "glyphs": {str(k): v for k, v in sorted(glyphs.items())}}))
    _FONTS[font] = (page, glyphs)
    return _FONTS[font]


def font_atlas(name):
    """-> (atlas PIL RGBA, metrics dict for __bbDRPartyFont) for a FONTS texture. Deterministic: the same install gives
    the same atlas."""
    font = FONTS[name][0]
    page, glyphs = font_source(font)
    S, P = FONT_SCALE, FONT_PAD * FONT_SCALE
    codes = [c for c in FONT_CODES if c in glyphs]
    sized = [(c, glyphs[c][2] * S, glyphs[c][3] * S) for c in codes]
    W = (max(w for _, w, _ in sized) + 2 * P + 63) // 64 * 64
    while True:   # the narrowest width (multiple of 64) whose rows fit in a square
        pos, x, y, row = {}, P, P, 0
        for c, w, h in sized:
            if w == 0 or h == 0:
                continue
            if x + w + P > W:
                x, y, row = P, y + row + P, 0
            pos[c] = (x, y); x += w + P; row = max(row, h)
        H = (y + row + P + 3) // 4 * 4
        if H <= W:
            break
        W += 64
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = {}
    for c, w, h in sized:
        x0, y0, gw, gh, shift, off = glyphs[c]
        if c not in pos:
            g[str(c)] = [0, 0, 0, 0, shift, off]
            continue
        x, y = pos[c]
        atlas.paste(page.crop((x0, y0, x0 + gw, y0 + gh)).resize((w, h), Image.NEAREST), (x, y))
        g[str(c)] = [x, H - y - h, w, h, shift, off]          # y from the atlas bottom (Unity's texture space)
    line = max(glyphs[c][3] for c in codes)
    return atlas, {"tex": name, "scale": S, "w": W, "h": H, "line": line, "g": g}


def font_metrics():
    """globalThis.__bbDRPartyFont: {"big": metrics, "main": metrics} (see the module docstring)."""
    return {key: font_atlas(name)[1] for name, (_, key) in FONTS.items()}


def _code_strings(g, entry_name):
    """{stringsetloc key: English text} for every stringsetloc(text, key) in one code entry: the call pushes its
    arguments last-first, so a key's push is followed (after an optional conv) by its English text's push."""
    e = next((c for c in g.code if c["name"] == entry_name), None)
    if e is None:
        raise SystemExit("DELTARUNE: Party: code entry %s not found in %s" % (entry_name, g.path))
    ins, p, end = [], e["addr"], e["addr"] + e["length"]
    while p < end:                       # instruction sizes as tools/deltarune/research_scratch/gmdis.py
        w = g.u32(p); op, t1 = w >> 24, (w >> 16) & 0xF
        size = 4
        if op in (0xC0, 0xC1, 0xC2, 0xC3, 0x84):
            size = 12 if t1 in (0, 3) else 8 if t1 in (1, 2, 4, 5, 6) else 4
        elif op == 0x45 and t1 != 0xF or op == 0xD9 or op == 0xFF and t1 == 2:
            size = 8
        ins.append(("s", g.strg(g.u32(p + 4))) if op == 0xC0 and t1 == 6 else (op, None))
        p += size
    out = {}
    for i, (k, v) in enumerate(ins):
        if k == "s" and v.startswith("obj_") and "_gml_" in v:
            j = i + 1
            while j < len(ins) and ins[j][0] == 0x07:   # conv
                j += 1
            if j < len(ins) and ins[j][0] == "s":
                out[v] = ins[j][1]
    return out


def labels():
    """-> ({none, susie, ralsei, all}: English, the same in Japanese or None): the target-mode screen's category labels
    ("No ACT", "S-Action", "R-Action", "ACT"), read from the install (English: the Chapter 5 code's stringsetloc
    defaults; Japanese: chapter5_windows/lang/lang_ja.json). Only these short labels are read."""
    js = CACHE / "ui_labels.json"
    stamp = _stamp()
    if js.exists():
        meta = json.loads(js.read_text(encoding="utf-8"))
        if meta.get("stamp") == stamp:
            return meta["en"], meta.get("ja")
    g, _ = _reader()
    found = _code_strings(g, LABEL_CODE)
    miss = [k for k in LABEL_KEYS.values() if k not in found]
    if miss:
        raise SystemExit("DELTARUNE: Party: target-mode labels not found in %s: %s" % (LABEL_CODE, miss))
    en = {w: found[k] for w, k in LABEL_KEYS.items()}
    gmdata, _ = _gm()
    ja = None
    jp = os.path.join(gmdata.DR, "chapter5_windows", "lang", "lang_ja.json")
    if os.path.exists(jp):
        lang = json.load(open(jp, encoding="utf-8"))
        if all(k in lang for k in LABEL_KEYS.values()):
            ja = {w: lang[k] for w, k in LABEL_KEYS.items()}
    CACHE.mkdir(parents=True, exist_ok=True)
    js.write_text(json.dumps({"stamp": stamp, "en": en, "ja": ja}, ensure_ascii=False), encoding="utf-8")
    return en, ja


def build(out_dir, frames, log=print):
    """Write every texture bundle into the build folder; returns manifest additions."""
    sys.path.insert(0, str(ROOT / "tools" / "bbtag"))
    import bbtag_rig
    adds = {"names": [], "entries": [], "guids": []}
    made = images(frames)
    for name, im in made.items():
        folder = FOLDERS.get(name, FOLDER)
        dst = "ui/texture/%s/%s" % (folder.lower(), name.lower())
        r = bbtag_rig.clone_texture(DONOR, dst, [("HeroPortraitCoatArms", folder), ("HeroPortraitFull_%d" % ICEY, name)],
                                    im, str(out_dir), log)
        for k in adds:
            adds[k] += r[k]
    paint_hud_cells(out_dir, frames, log)
    missing = [n for n in HEADS if n not in made]
    if missing:
        log("  party UI: official art missing for %s (local_only\\deltarune\\party\\art)" % ", ".join(missing))
    return adds, {n: im.size for n, im in made.items()}


def spec(sizes):
    """The static half for mod.json: sprite aliases and metrics rows, for the textures build() made."""
    aliases = {n: "tex:UI/Texture/%s/%s" % (FOLDERS.get(n, FOLDER), n) for n in sizes}
    metrics = [{"list": "_entries", "key": "path",
                "value": {"path": "UI/Texture/%s/%s" % (FOLDERS.get(n, FOLDER), n), "width": w, "height": h}} for n, (w, h) in sizes.items()]
    return {"spriteAliases": aliases, "assets": [{"bundle": "ui/texture/metrics.ab", "asset": "metrics", "appendItems": metrics}]}


def sizes(frames=None):
    """The texture sizes without building bundles (for the generator, which writes spec() into mod.json)."""
    import dr_source
    return {n: im.size for n, im in images(frames or dr_source.Frames()).items()}


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    import dr_source
    fr = dr_source.Frames()
    made = images(fr)
    for n, im in made.items():
        print(n, im.size)
    for k, m in font_metrics().items():
        print("font %s: %s %dx%d, line %d, %d glyphs, 'A' %s" % (k, m["tex"], m["w"], m["h"], m["line"], len(m["g"]), m["g"].get("65")))
    print("labels", labels())
    sheet = Image.new("RGBA", (sum(im.width + 8 for im in made.values()), max(im.height for im in made.values())), (16, 19, 24, 255))
    x = 0
    for im in made.values():
        sheet.alpha_composite(im, (x, 0)); x += im.width + 8
    p = ROOT / "local_only" / "deltarune" / "party" / "planner" / "ui_textures.png"
    sheet.save(p); print(p)
