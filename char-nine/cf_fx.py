"""cf_fx.py -- Nine's Centralfiction effects, built at import time (import_cf.py) from the player's own CF install.

Mauvette Roar (CF 214B, state AntiAir): the Phantom's giant arm sweeps up and forward through a diagonal pillar of fire.
  CF data (scr_phea Eff_401 / Eff_401Fire, read 2026-09-29):
    Eff_401      spawned on the move's tick 6, 140 px BEHIND her (teleportRelativeX -140000; + is forward: 18 of 18
                 CF Nine effects that also move spawn ahead and travel forward). Invisible 6 ticks, then the arm
                 sprite ph401_cutin at full alpha (3001 255) for 9 ticks (its hit: ticks 12-17 of the move), then a
                 fade of 51 alpha a tick (3004 -51).
    Eff_401Fire  spawned with Eff_401, 35 px ahead of it, then 22.5 px further on each of its next two drawings;
                 op 1096 1300 (1096 clusters at 1000 across her 150 uses: a per-mille scale, read as x1.3);
                 flames vr_ph401_00..07 for 3,3,5,3,3,3,3,3 ticks (char_ph_vri; one mirrored 512 px chunk each).
  Checked by eye (research composite): the flame hugs the arm and the arm's five hit boxes sit on the flame's
  diagonal, so the offsets, the mirror rule and the sign agree.

  Played as a two-layer flipbook (the Redux flipbook template, fx/ninx_fb: one particle per layer on BBEE's plane mesh):
    body (alpha blend)  the arm in front of the fire, both in CF's own colours and line art;
    glow (additive)     the fire's bright core, blurred, at an HDR tint so BBEE's bloom lights it.
  9 cells of 3 ticks (27 ticks, 0.45 s): CF's 3-5 tick drawings land within one tick of their CF time.

Nothing here is written to the mod folder: sheets go to the build folder and the local cache (CACHE).
The fallback (no CF) plays her BBEE fire rush eruption (ph_C2_01) under the same effect name.

usage: python mods/char-nine/cf_fx.py template     (re)writes fx/ from the archived kit template (Redux-authored)
       python mods/char-nine/cf_fx.py preview      renders the review sheet to the local cache (CACHE)
"""
import hashlib, io, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
for p in (os.path.join(ROOT, "tools", "bbtag"), os.path.join(ROOT, "tools", "bbcf"), os.path.join(ROOT, "tools"), ROOT, HERE):
    if p not in sys.path:
        sys.path.insert(0, p)
import numpy as np

FX_DIR = os.path.join(HERE, "fx")


CF_FLIPBOOKS = False
CACHE = os.path.join(ROOT, "local_only", "cache", "nine_cf_fx")
VERSION = "cffx-1"
U_PER_PX = 1.0 / 230
LIFT_PX = 5

TEMPLATE = {
    "prefab": "effect/prefab/role/ninx/ninx_fb", "dir": "ninx/fb", "prefab_dir": "ninx",
    "layers": {
        "body": {"go": "body", "mat": "effect/common/material/ninx/particles_018_m__ninxfb", "tex": "effect/common/texture/ninx/ninx_fb_body",
                 "donor_mat": "effect/common/material/08_particles/particles_018_m", "donor_tex": "effect/common/texture/08_particles/particles_018_4c",
                 "tint": [1.0, 1.0, 1.0, 1.0]},
        "glow": {"go": "glow", "mat": "effect/common/material/ninx/glow_205_b__ninxfb", "tex": "effect/common/texture/ninx/ninx_fb_glow",
                 "donor_mat": "effect/common/material/02_glow/glow_205_b", "donor_tex": "effect/common/texture/02_glow/glow_205_4c",
                 "tint": [1.3, 1.3, 1.3, 1.0]},
    }}


MAUVETTE = "ninx_mauvette"
FIRE = [("vr_ph401_00", 3), ("vr_ph401_01", 3), ("vr_ph401_02", 5), ("vr_ph401_03", 3),
        ("vr_ph401_04", 3), ("vr_ph401_05", 3), ("vr_ph401_06", 3), ("vr_ph401_07", 3)]
FIRE_FWD = [-105.0, -82.5, -60.0, -60.0, -60.0, -60.0, -60.0, -60.0]
FIRE_SCALE = 1.3
ARM, ARM_FWD = "ph401_cutin", -140.0
CELL_TICKS, CELLS = 3, 9
GLOW_GAIN = 0.55
FALLBACK_DONOR = "effect/prefab/monster/ph/ph_c2_01"


def arm_alpha(t):
    """CF: invisible for 6 ticks, full for 9, then -51 of 255 a tick."""
    if t < 6: return 0.0
    if t < 15: return 1.0
    return max(0.0, 1.0 - 0.2 * (t - 14))


def fire_at(t):
    """-> index of the flame drawing shown on effect tick t, or None after the last."""
    end = 0
    for i, (_, d) in enumerate(FIRE):
        end += d
        if t < end: return i
    return None




def _hip(b):
    import bbtag_formats as F
    try:
        return F.hip(b)
    except ValueError:
        import struct
        cw, ch = struct.unpack_from("<5I", b, 4)[3:5]
        ext = struct.unpack_from("<I", b, 0x1c)[0]
        d = np.frombuffer(b, np.uint8, (len(b) - 0x20 - ext) // 5 * 5, 0x20 + ext).reshape(-1, 5)
        px = np.repeat(d[:, :4], d[:, 4].astype(np.int64), axis=0)[:cw * ch].reshape(ch, cw, 4)[..., [2, 1, 0, 3]]
        return {"rgba_canvas": px.copy()}


def compose(img, jb, palette=None, layers=(0,)):
    """One CF frame in CF's own orientation (she faces LEFT): -> (RGBA, (root x, root y)) with y down.
    Like bbtag_formats.compose, plus chunks with a negative source or destination size: that chunk is drawn flipped
    over the normalised rectangle. Only the flame sheets use them here (one chunk each); the composite check in the
    module docstring is what verifies the rule for them."""
    if "rgba_canvas" in img:
        cv = img["rgba_canvas"]; h, w = cv.shape[:2]
        pal = np.concatenate([np.zeros((1, 4), np.uint8), cv.reshape(-1, 4)])
        index = np.arange(1, h * w + 1, dtype=np.int64).reshape(h, w); ox = oy = 0
    else:
        pal = (img["palette"] if palette is None else palette).copy(); index = img["index"]
        (ox, oy), (w, h) = img["offset"], img["size"]
    pal[0, 3] = 0
    chunks = sorted([c for c in jb["chunks"] if c["layer"] in layers], key=lambda c: c["layer"])
    if not chunks:
        return np.zeros((1, 1, 4), np.uint8), (0, 0)
    rects = []
    for c in chunks:
        sx, sy, sw, sh = c["src"]; dx, dy, dw, dh = c["dst"]
        rects.append((int(min(sx, sx + sw)), int(min(sy, sy + sh)), int(abs(sw)), int(abs(sh)),
                      int(min(dx, dx + dw)), int(min(dy, dy + dh)), (sw < 0) != (dw < 0), (sh < 0) != (dh < 0)))
    x0 = min(r[4] for r in rects); y0 = min(r[5] for r in rects)
    x1 = max(r[4] + r[2] for r in rects); y1 = max(r[5] + r[3] for r in rects)
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    full = np.zeros((max(oy + h, 1), max(ox + w, 1)), np.int64)
    full[oy:oy + h, ox:ox + w] = index
    for sx, sy, sw, sh, dx, dy, fx, fy in rects:
        part = full[max(sy, 0):sy + sh, max(sx, 0):sx + sw]
        if part.size == 0:
            continue
        part = pal[part]
        if fx: part = part[:, ::-1]
        if fy: part = part[::-1]
        reg = out[dy - y0:dy - y0 + part.shape[0], dx - x0:dx - x0 + part.shape[1]]
        part = part[:reg.shape[0], :reg.shape[1]]
        reg[:] = np.where(part[..., 3:4] > 0, part, reg)
    return out, (-x0, -y0)


class CF:
    """Her CF archives (read-only): sprites in BBEE's orientation (facing right), root (x, y) with y down."""
    def __init__(self):
        import bbcf_read, bbtag_formats as F
        self.F = F
        self.img = bbcf_read.files("Char/char_ph_img.pac")
        self.col = bbcf_read.files("Char/char_ph_col.pac")
        self.vri = bbcf_read.files("Char/char_ph_vri.pac")
        self.pal = F.hpl(bbcf_read.files("Char/char_ph_pal.pac")["ph00_00.hpl"])

    def sprite(self, name):
        jb = self.F.jonbin(self.col[name + ".jonbin"])
        if name + ".hip" in self.img:
            a, (ox, oy) = compose(_hip(self.img[name + ".hip"]), jb, self.pal)
        else:
            a, (ox, oy) = compose(_hip(self.vri[name + ".hip"]), jb)
        return a[:, ::-1].copy(), (a.shape[1] - ox, oy)

    def hitboxes(self, name):
        """[(fwd0, up0, fwd1, up1)] px in BBEE orientation, relative to the sprite's root."""
        jb = self.F.jonbin(self.col[name + ".jonbin"])
        return [(-(b["x"] + b["w"]), -(b["y"] + b["h"]), -b["x"], -b["y"]) for b in jb["boxes"]["hit"]]




CANVAS = (900, 740)
ORIGIN = (260, 700)


def _paste(cv, im, o, fwd, up, alpha=1.0, scale=1.0, org=None):
    from PIL import Image
    if scale != 1.0:
        p = Image.fromarray(im).resize((max(1, round(im.shape[1] * scale)), max(1, round(im.shape[0] * scale))), Image.LANCZOS)
        im, o = np.asarray(p), (o[0] * scale, o[1] * scale)
    org = org or ORIGIN
    x = int(round(org[0] + fwd - o[0])); y = int(round(org[1] - up - LIFT_PX - o[1]))
    src = im.astype(np.float32) / 255.0
    if alpha < 1.0:
        src[..., 3] *= alpha
    H, W = cv.shape[:2]
    sx0, sy0 = max(0, -x), max(0, -y); dx0, dy0 = max(0, x), max(0, y)
    w = min(im.shape[1] - sx0, W - dx0); h = min(im.shape[0] - sy0, H - dy0)
    if w <= 0 or h <= 0:
        return
    s = src[sy0:sy0 + h, sx0:sx0 + w]; d = cv[dy0:dy0 + h, dx0:dx0 + w]
    a = s[..., 3:4]; oa = a + d[..., 3:4] * (1 - a)
    rgb = (s[..., :3] * a + d[..., :3] * d[..., 3:4] * (1 - a)) / np.maximum(oa, 1e-6)
    d[..., :3] = rgb; d[..., 3:4] = oa


def mauvette_frames(cf):
    """-> (body frames, glow frames): CELLS float RGBA canvases each, sampled at each cell's middle tick."""
    from PIL import Image, ImageFilter
    arm = cf.sprite(ARM)
    fires = [cf.sprite(n) for n, _ in FIRE]
    body, glow = [], []
    for c in range(CELLS):
        t = c * CELL_TICKS + CELL_TICKS // 2
        fi, aa = fire_at(t), arm_alpha(t)
        b = np.zeros((CANVAS[1], CANVAS[0], 4), np.float32)
        f = np.zeros_like(b)
        if fi is not None:
            _paste(f, fires[fi][0], fires[fi][1], FIRE_FWD[fi], 0.0, scale=FIRE_SCALE)
            b[:] = f
        a = np.zeros_like(b)
        if aa > 0:
            _paste(a, arm[0], arm[1], ARM_FWD, 0.0, alpha=aa)
            _paste(b, arm[0], arm[1], ARM_FWD, 0.0, alpha=aa)

        lum = f[..., :3].max(-1)
        core = f[..., 3] * np.clip((lum - 0.8) / 0.2, 0, 1) * GLOW_GAIN
        core *= 1.0 - 0.85 * a[..., 3]
        g = np.zeros_like(b)
        g[..., :3] = f[..., :3]; g[..., 3] = core
        g8 = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(7))
        body.append((np.clip(b, 0, 1) * 255).astype(np.uint8)); glow.append(np.asarray(g8).copy())
    return body, glow


def pack(frames, scale, pad=4):
    """Frames (same canvas) -> (sheet, cols, rows, cell w, cell h, crop box, sheet size). The crop is the union of
    every frame's content plus `pad` px of empty border, so a bilinear sample at a cell's edge never reads its
    neighbour. Cells are multiples of 4 (BC7 blocks)."""
    from PIL import Image
    import math
    boxes = [b for b in (Image.fromarray(f[..., 3]).getbbox() for f in frames) if b]
    if not boxes:
        return None
    H, W = frames[0].shape[:2]
    m = int(math.ceil(pad / scale))
    x0 = max(0, min(b[0] for b in boxes) - m); y0 = max(0, min(b[1] for b in boxes) - m)
    x1 = min(W, max(b[2] for b in boxes) + m); y1 = min(H, max(b[3] for b in boxes) + m)
    c4 = lambda v: max(4, -(-int(math.ceil(v)) // 4) * 4)
    cw, ch = c4((x1 - x0) * scale), c4((y1 - y0) * scale)
    n = len(frames)
    best = None
    for cols in range(1, n + 1):
        rows = -(-n // cols); w_, h_ = cols * cw, rows * ch
        score = (max(w_, h_), w_ * h_)
        if max(w_, h_) <= 4096 and (best is None or score < best[0]):
            best = (score, cols, rows)
    if best is None:
        raise ValueError("sheet over 4096 px: lower the scale")
    _, cols, rows = best
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        cell = Image.fromarray(f[y0:y1, x0:x1], "RGBA").resize((cw, ch), Image.LANCZOS)
        sheet.paste(cell, ((i % cols) * cw, (i // cols) * ch))
    return sheet, cols, rows, cw, ch, (x0, y0, x1, y1), sheet.size


def mauvette_meta(cf, out_dir, scales=(0.75, 0.4)):
    os.makedirs(out_dir, exist_ok=True)
    body, glow = mauvette_frames(cf)
    meta = {"ticks": CELLS * CELL_TICKS, "frames": CELLS, "scale": {"body": scales[0], "glow": scales[1]}, "layers": {}}
    for layer, frames, sc in (("body", body, scales[0]), ("glow", glow, scales[1])):
        sheet, cols, rows, cw, ch, (x0, y0, x1, y1), (W, H) = pack(frames, sc)
        png = os.path.join(out_dir, "%s_%s.png" % (MAUVETTE, layer)); sheet.save(png)
        meta["layers"][layer] = {"png": png, "cols": cols, "rows": rows, "cell": [cw, ch], "sheet": [W, H],

                                 "centre": [(x0 + x1) / 2 - ORIGIN[0], ORIGIN[1] - (y0 + y1) / 2]}
    return meta, body, glow







def mua():
    """bbtag_mua reading the player's BBCF instead of BBTAG (in memory; nothing written)."""
    import bbcf_read as C, bbtag_read as R, bbtag_mua as M
    def _read(logical):
        rel = logical[5:] if logical.lower().startswith("data/") else logical
        return C.unwrap(open(os.path.join(C.BBCF, "data", rel.replace("/", os.sep)), "rb").read())
    def _fpac(b):
        b = C.unwrap(b)
        return {n: b[o:o + s] for n, o, s in C.fpac_entries(b)}
    R.read = _read; R.fpac_files = _fpac; M.R = R
    return M


def mua_frames(M, S_, state, n=240, ss=2, ppu=1.0, box=None):
    """-> {tick: (body RGBA, glow RGBA)} in BBEE's orientation, and the spawner's root (x, y) in them (px, y down).
    Alpha-blended meshes go to the body, additive ones to the glow (as CF blends them: script 3032 / 3033, else the
    model's hint)."""
    from PIL import Image
    code = S_.code
    objs, tl = M.run_effect(S_, state, frames=n)
    placed = []
    for t, draw in tl:
        for ob, st, mt in draw:
            for g in M.model(st["model"], code).geometry(mt):
                placed.append(M.project(g["xyz"][np.unique(g["tris"])], -st["x"], -st["y"], M.UNIT_PX, st["sx"], st["sy"], st["rot"]))


    box = (np.array(box[0], float), np.array(box[1], float)) if box else M._frame_box(placed)
    if box is None:
        return {}, (0, 0)
    lo, hi = box
    k, pad = ppu * ss, 10 * ss
    W, H = int((hi[0] - lo[0]) * k) + 2 * pad, int((hi[1] - lo[1]) * k) + 2 * pad
    ox, oy = pad - lo[0] * k, pad - lo[1] * k
    def batch_blend(mdl, g, script_blend):
        """CF's scripts set 3032 on these states (read by the renderer as normal blending), but a model object can carry its
        own additive hint (2), and flat white textures under vertex colours are glow / haze quads: drawn with alpha they
        are the dark rectangles seen on 5B and 5C (checked 2026-09-29), so they add."""
        obj = next((m["skeleton"] for m in mdl.meshes if m["name"] == g["mesh"]), -1)
        hint = mdl.objects[obj]["blend_hint"] if 0 <= obj < len(mdl.objects) else None
        if hint == 2:
            return "add"
        if hint == 4:
            return "sub"
        tx = M.texture(g["texture"], code)
        if tx[..., 3].min() > 0.99:
            return "add"
        return script_blend or M._default_blend(mdl, code)
    out = {}
    for t, draw in tl:
        cv = {"alpha": M.Canvas(W, H), "add": M.Canvas(W, H), "sub": M.Canvas(W, H)}
        for ob, st, mt in draw:
            mdl = M.model(st["model"], code)
            cx, cy = ox - st["x"] * k, oy - st["y"] * k
            for g in mdl.geometry(mt):
                blend = batch_blend(mdl, g, st["blend"])
                cv[blend if blend in ("add", "sub") else "alpha"].draw(
                    M.project(g["xyz"], cx, cy, k * M.UNIT_PX, st["sx"], st["sy"], st["rot"]), g["uv"], g["rgba"], g["tris"],
                    M.texture(g["texture"], code), blend, M.effect_tint(code, 0, st), st["alpha"] / 255.0)
        pair = []
        for key in ("alpha", "add", "sub"):
            im = cv[key].rgba().resize((W // ss, H // ss), Image.LANCZOS).transpose(Image.FLIP_LEFT_RIGHT)
            pair.append(np.asarray(im).copy())
        body, glow, sub = pair
        if sub[..., 3].any():
            sd = (sub[..., :3].max(-1).astype(np.float32) / 255.0) * (sub[..., 3].astype(np.float32) / 255.0)
            da = np.clip(sd * 0.8, 0, 0.8); a1 = body[..., 3].astype(np.float32) / 255.0
            oa = a1 + da * (1 - a1)
            rgb = body[..., :3].astype(np.float32) * (a1 / np.maximum(oa, 1e-6))[..., None]
            body = np.dstack([rgb, oa * 255.0]).clip(0, 255).astype(np.uint8)
        out[t] = (body, glow)
    return out, ((W - ox) / ss, oy / ss)


def fx2d_frames(cf, spec):
    """A 2D effect state (cf_arts.FX2D): {tick: (body, glow)}; the white sprite is tinted, added, and shown faintly in the
    body so it still reads on a bright stage."""
    out, t = {}, 0
    tint = np.array(spec["tint"] + (1.0,), np.float32)
    for name, d in spec["seq"]:
        im, o = cf.sprite(name)
        g = (im.astype(np.float32) * tint).clip(0, 255).astype(np.uint8)
        b = g.copy(); b[..., 3] = (b[..., 3].astype(np.float32) * 0.25).astype(np.uint8)
        for _ in range(d):
            out[t] = (b, g, o); t += 1
    return out


def arts_meta(cf, M, S_, state, out_dir, scales=(0.75, 0.5)):
    """One effect state -> a flipbook meta (cells of cf_arts.CELL_TICKS ticks), on a canvas around her root."""
    import cf_arts as A
    step = A.CELL_TICKS
    if state in A.FX2D:
        spec = A.FX2D[state]
        fr = fx2d_frames(cf, spec)
        items = {t: [(b, o, spec["fwd"], spec["up"]), (g, o, spec["fwd"], spec["up"])] for t, (b, g, o) in fr.items()}
    else:
        fr, o = mua_frames(M, S_, state)
        items = {t: [(b, o, 0.0, 0.0), (g, o, 0.0, 0.0)] for t, (b, g) in fr.items()}
    if not items:
        raise ValueError("%s draws nothing" % state)

    L = min(fwd - o_[0] for v in items.values() for im, o_, fwd, up in v) - 8
    R_ = max(fwd - o_[0] + im.shape[1] for v in items.values() for im, o_, fwd, up in v) + 8
    T = max(up + LIFT_PX + o_[1] for v in items.values() for im, o_, fwd, up in v) + 8
    B = min(up + LIFT_PX + o_[1] - im.shape[0] for v in items.values() for im, o_, fwd, up in v) - 8
    org = (int(-L), int(T)); size = (int(R_ - L), int(T - B))
    n = max(items) + 1
    cells = -(-n // step)
    body, glow = [], []
    for c in range(cells):
        t = min(c * step + step // 2, n - 1)
        while t not in items and t > 0: t -= 1
        layers = []
        for li in (0, 1):
            cv = np.zeros((size[1], size[0], 4), np.float32)
            if t in items:
                im, o_, fwd, up = items[t][li]
                _paste(cv, im, o_, fwd, up, org=org)
            layers.append((np.clip(cv, 0, 1) * 255).astype(np.uint8))
        body.append(layers[0]); glow.append(layers[1])
    meta = {"ticks": cells * step, "frames": cells, "scale": {"body": scales[0], "glow": scales[1]}, "layers": {}}
    name = A.fx_name(state)
    for layer, frames, sc in (("body", body, scales[0]), ("glow", glow, scales[1])):
        pk = pack(frames, sc)
        if pk is None:
            continue
        sheet, cols, rows, cw, ch, (x0, y0, x1, y1), (W, H) = pk
        png = os.path.join(out_dir, "%s_%s.png" % (name, layer)); sheet.save(png)
        meta["layers"][layer] = {"png": png, "cols": cols, "rows": rows, "cell": [cw, ch], "sheet": [W, H],
                                 "centre": [(x0 + x1) / 2 - org[0], org[1] - (y0 + y1) / 2]}
    meta["canvas"] = {"size": size, "origin": org}
    return meta, body, glow


def arts_states():
    import cf_arts as A
    return sorted({st for m in A.MOVES.values() for st, _, _ in m["fx"]})




def build(out, template_deps):
    """CF path: the Mauvette Roar flipbook and the Magic Arts effects. The template (fx/) must already be imported into
    `out` (bbvfx.do_import). -> manifest additions."""
    import bbtag_fxport as FX, cf_arts as A
    cf = CF()
    sheets = os.path.join(CACHE, "sheets"); os.makedirs(sheets, exist_ok=True)
    meta, _, _ = mauvette_meta(cf, sheets)
    metas = {MAUVETTE: meta}
    M = mua(); S_ = M.Script("ph")
    for st in arts_states():
        metas[A.fx_name(st)] = arts_meta(cf, M, S_, st, sheets)[0]
    tpl = dict(TEMPLATE, deps=template_deps)
    return FX.make_bundles(metas, out, tpl, U_PER_PX)


def build_fallback(out):
    """No CF: her BBEE fire rush eruption as Mauvette Roar, her boss's element strikes as the Magic Arts effects (same
    names, so the moves are the same)."""
    import bbchar, cf_arts as A
    adds = bbchar.clone_bundle(FALLBACK_DONOR, "effect/prefab/role/ninx/" + MAUVETTE, out)
    for st in arts_states():
        a = bbchar.clone_bundle(A.FX_FALLBACK[st], "effect/prefab/role/ninx/" + A.fx_name(st), out)
        for k in adds: adds[k] += a[k]
    return adds




def make_template():
    """fx/ = the Redux flipbook template (fxkit_cross RubyVFX.rrb_fb, archived with Ruby 0.3.0) renamed for Nine, so her
    mod doesn't depend on Ruby's: bundle + fxmap.json + clones.json + two 64 px white placeholder textures."""
    import UnityPy
    from PIL import Image
    arc = os.path.join(ROOT, "archive", "char-ruby-0.3.0", "fx")
    src = os.path.join(arc, "bundles", "effect", "prefab", "role", "rrb", "rrb_fb.ab")
    env = UnityPy.load(open(src, "rb").read())
    old_cab = list(env.file.files.keys())[0]
    new_cab = "CAB-" + hashlib.md5(b"redux/ninx/ninx_fb").hexdigest()
    sf = env.file.files.pop(old_cab); env.file.files[new_cab] = sf
    for o in env.objects:
        if o.type.name == "GameObject":
            t = o.read_typetree()
            if t["m_Name"] == "rrb_fb":
                t["m_Name"] = "ninx_fb"; o.save_typetree(t)
        elif o.type.name == "AssetBundle":
            t = o.read_typetree()
            t["m_Name"] = t["m_AssetBundleName"] = TEMPLATE["prefab"] + ".ab"
            t["m_Container"] = [[k.replace("rrb/rrb_fb", "ninx/ninx_fb"), v] for k, v in t["m_Container"]]
            o.save_typetree(t)
    dst = os.path.join(FX_DIR, "bundles", *(TEMPLATE["prefab"] + ".ab").split("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, "wb").write(env.file.save(packer="lz4"))
    ren = lambda s: s.replace("rrb/rrb_fb", "ninx/ninx_fb").replace("/rrb/", "/ninx/").replace("__rrbfb", "__ninxfb").replace("rrb_fb_", "ninx_fb_")
    fxmap = json.load(open(os.path.join(arc, "fxmap.json")))["effect/prefab/role/rrb/rrb_fb"]
    fxmap = [dict(e, bundle=ren(e["bundle"])) for e in fxmap]
    json.dump({TEMPLATE["prefab"]: fxmap}, open(os.path.join(FX_DIR, "fxmap.json"), "w"), indent=1)
    clones = [c for c in json.load(open(os.path.join(arc, "clones.json"))) if "rrb_fb" in c["to"] or "__rrbfb" in c["to"]]
    out = []
    for c in clones:
        c = json.loads(ren(json.dumps(c)))
        if "props" in c and "glow" in c["to"]:
            c["props"]["colors"]["_TintColor"] = TEMPLATE["layers"]["glow"]["tint"]
        out.append(c)
    json.dump(out, open(os.path.join(FX_DIR, "clones.json"), "w"), indent=1)
    os.makedirs(os.path.join(FX_DIR, "textures"), exist_ok=True)
    for n in ("ninx_fb_body.png", "ninx_fb_glow.png"):
        Image.new("RGBA", (64, 64), (255, 255, 255, 255)).save(os.path.join(FX_DIR, "textures", n))
    print("fx/: template %s (%s), %d references, %d clones" % (TEMPLATE["prefab"], new_cab, len(fxmap), len(out)))




def preview(path=None):
    """Each cell over a dark and a bright stage colour, with her CF body at that tick and the hit boxes."""
    from PIL import Image, ImageDraw
    cf = CF()
    meta, body, glow = mauvette_meta(cf, os.path.join(CACHE, "sheets"))
    seq = [("ph401_00", 3), ("ph401_01", 3), ("ph401_02", 6), ("ph401_03", 3), ("ph401_04", 3), ("ph401_05", 5), ("ph401_06", 5),
           ("ph401_07", 5), ("ph401_08", 5), ("ph401_09", 5), ("ph401_10", 5), ("ph401_11", 5)]
    def body_at(t):
        e = 0
        for n, d in seq:
            e += d
            if t < e: return n
        return seq[-1][0]
    hb = cf.hitboxes(ARM)
    tiles = []
    for bg in ((26, 30, 40), (150, 140, 120)):
        for c in range(CELLS):
            t_move = 6 + c * CELL_TICKS + 1
            cv = np.zeros((CANVAS[1], CANVAS[0], 4), np.float32); cv[..., :3] = np.array(bg) / 255.0; cv[..., 3] = 1
            im, o = cf.sprite(body_at(t_move)); _paste(cv, im, o, 0.0, 0.0)
            b = body[c].astype(np.float32) / 255; a = b[..., 3:4]
            cv[..., :3] = b[..., :3] * a + cv[..., :3] * (1 - a)
            g = glow[c].astype(np.float32) / 255
            cv[..., :3] = np.clip(cv[..., :3] + g[..., :3] * g[..., 3:4] * TEMPLATE["layers"]["glow"]["tint"][0], 0, 1)
            tile = Image.fromarray((cv[..., :3] * 255).astype(np.uint8)); d = ImageDraw.Draw(tile)
            d.line((0, ORIGIN[1], CANVAS[0], ORIGIN[1]), fill=(90, 90, 90)); d.line((ORIGIN[0], 0, ORIGIN[0], CANVAS[1]), fill=(70, 70, 90))
            if 12 <= t_move <= 17:
                for f0, u0, f1, u1 in hb:
                    d.rectangle((ORIGIN[0] + ARM_FWD + f0, ORIGIN[1] - LIFT_PX - u1, ORIGIN[0] + ARM_FWD + f1, ORIGIN[1] - LIFT_PX - u0), outline=(255, 40, 40))
            d.text((8, 8), "cell %d  move tick %d  %s" % (c, t_move, body_at(t_move)), fill=(255, 230, 90))
            tiles.append(tile.resize((CANVAS[0] // 2, CANVAS[1] // 2)))
    sheet = Image.new("RGB", (CANVAS[0] // 2 * CELLS, CANVAS[1] // 2 * 2))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % CELLS) * CANVAS[0] // 2, (i // CELLS) * CANVAS[1] // 2))
    path = path or os.path.join(CACHE, "mauvette_review.png")
    os.makedirs(os.path.dirname(path), exist_ok=True); sheet.save(path)
    L = meta["layers"]
    print("review sheet %s; body %dx%d cells %s, glow %dx%d cells %s" % (path, L["body"]["cols"], L["body"]["rows"], L["body"]["cell"],
                                                                         L["glow"]["cols"], L["glow"]["rows"], L["glow"]["cell"]))
    return path


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "template": make_template()
    elif cmd == "preview": preview()
    else: print(__doc__)
