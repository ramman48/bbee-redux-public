"""bbtag_fxport.py -- BBTAG effects as BBEE effects, rendered at build time from the player's own install.

Cross Effect (docs/cross-effect/KIT_V2.md §6: every BBTAG effect tied to Ruby's moves plays in BBEE, accurately and in
full). For one BBTAG effect state (the parent and everything it spawns: 3D models, particle systems, sprite frames) the
renderer draws every tick (60 per second, the rate both games run at) into two layers:
  body   normal blending, straight alpha: the dark edges and red bodies of her slashes, smoke, casings, petals;
  glow   additive light: soft glows, white streaks, muzzle flashes, plus an optional bloom of the body (--bloom).
Blending follows BBTAG draw order: a normal layer drawn over earlier additive light hides it (bbtag_ptl.raster).

The frames are packed into a flipbook grid per layer. BBEE plays them with the kit template rrb_fb (fxkit_cross
RubyVFX.cs: one particle per layer that runs the texture sheet once over the effect's life). `make_bundles` clones the
template per effect (grid, life, size, placement), plus an official texture and material per layer holding the
rendered image (bbchar.clone_bundle). Frames face right (BBEE's convention). The effect's origin is the spawner's root
(her feet), so each effect sits where BBTAG draws it.

Everything rendered is the player's own data: it stays in the local folder and the build output, never in a package.

usage (research / checks):
  python tools/bbtag/bbtag_fxport.py render <state> [...] [--code rrb] [--bloom 0.5]
      -> <local folder>/bbtag/_fxport/<state>_body.png / _glow.png (packed sheets) + <state>.json + <state>_preview.png
"""
import hashlib, json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path[:0] = [HERE, ROOT]
_a, sys.argv = sys.argv, ["x"]
import bbtag_mua as MU
import bbtag_ptl as PT
import bbtag_rig as RG
sys.argv = _a

VERSION = "fxport-5"



CORE_TEX = re.compile(r"zangeki03", re.I)
TAIL = 30
FADE = 10
OUT = os.path.join(ROOT, "local_only", "bbtag", "_fxport")
PTL_OPS = (4001, 4002, 4045, 23067)
SS = 2
MAX_TICKS = 360
MAX_SIDE = 4096



class Buf:
    """P: premultiplied normal colour, L: additive light, A: normal coverage (bbtag_ptl's layout)."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.d = {"P": np.zeros((h, w, 3), np.float32), "L": np.zeros((h, w, 3), np.float32), "A": np.zeros((h, w), np.float32)}

    def tris(self, xy, uv, rgba, tris, tex, blend, tint, alpha):
        """Textured triangles (canvas px, y down), as bbtag_mua.Canvas.draw, blended into P / L / A."""
        th, tw = tex.shape[:2]
        tint = np.asarray(tint, np.float32)
        P, L, A = self.d["P"], self.d["L"], self.d["A"]
        for tri in tris:
            p = xy[tri]
            x0, y0 = np.floor(p.min(0)).astype(int)
            x1, y1 = np.ceil(p.max(0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1 + 1, self.w), min(y1 + 1, self.h)
            if x1 <= x0 or y1 <= y0:
                continue
            (ax, ay), (bx, by), (cx, cy) = p
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            l0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            l1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            l2 = 1 - l0 - l1
            m = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
            if not m.any():
                continue
            Lm = np.stack([l0[m], l1[m], l2[m]], 1)
            u, v = (Lm @ uv[tri]).T
            col = Lm @ rgba[tri]
            s = MU._bilinear(tex, u, v, tw, th)
            src = s[:, :3] * col[:, :3] * tint
            a = np.clip(s[:, 3] * col[:, 3] * alpha, 0, 1)
            yy, xx = gy[m].astype(int), gx[m].astype(int)
            if blend == "add":
                L[yy, xx] += src * a[:, None]
            else:
                P[yy, xx] = src * a[:, None] + P[yy, xx] * (1 - a[:, None])
                L[yy, xx] = L[yy, xx] * (1 - a[:, None])
                A[yy, xx] = a + A[yy, xx] * (1 - a)

    def image(self, rgba, x0, y0, blend, alpha=1.0):
        """A straight-alpha float image (h, w, 4) with its top-left at canvas (x0, y0)."""
        h, w = rgba.shape[:2]
        X0, Y0 = max(0, x0), max(0, y0)
        X1, Y1 = min(self.w, x0 + w), min(self.h, y0 + h)
        if X1 <= X0 or Y1 <= Y0:
            return
        s = rgba[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
        a = s[..., 3:4] * alpha
        P, L, A = self.d["P"][Y0:Y1, X0:X1], self.d["L"][Y0:Y1, X0:X1], self.d["A"][Y0:Y1, X0:X1]
        if blend == "add":
            L += s[..., :3] * a
        else:
            P[:] = s[..., :3] * a + P * (1 - a)
            L[:] = L * (1 - a)
            A[:] = a[..., 0] + A * (1 - a[..., 0])


def _down(arr, k):
    """Box-filter downsample by k on the first two axes."""
    h, w = arr.shape[0] // k * k, arr.shape[1] // k * k
    a = arr[:h, :w]
    return a.reshape(h // k, k, w // k, k, *a.shape[2:]).mean((1, 3))



class Renderer:
    def __init__(self, code="rrb", pal=0):
        self.code, self.pal = code, pal
        self.script = MU.Script(code)
        self._bank = self._src = None

    @property
    def bank(self):
        if self._bank is None:
            self._bank = PT.Bank(self.code)
        return self._bank

    @property
    def src(self):
        if self._src is None:
            self._src = RG.Source(self.code)
        return self._src

    def ops(self, state, seed=1, stop=None, move=None, no_ptl=()):
        """-> (ticks, per tick [draw op]) in RAW orientation (BBTAG faces left; y up; px, origin = her root).
        stop: the tick the move script ends the effect (a signal or removal the linear run can't follow): its objects
        end there and its particle systems stop emitting, letting the particles already out finish.
        move: (vx, vy, t0, t1): the spawner travels (her dash) at (vx, vy) px per tick, forward / up, from tick t0 to
        t1. Emitters that ride on her then drop their particles along her path (Gun Blast's petal trails), the way
        BBTAG draws them; the flipbook is detached, so the trail stays where it fell."""
        objs, tl = MU.run_effect(self.script, state, frames=MAX_TICKS)
        if stop is not None:
            for ob in objs:
                ob.dead = stop if ob.dead is None else min(ob.dead, stop)
            tl = [(t, d) for t, d in tl if t < stop]
        by_t = {t: draw for t, draw in tl}

        sims = []
        for ob in objs:
            sub, ent, rot = 0, None, 0.0
            for te, op, ar in ob.events:
                if op == 4061 and ar:
                    sub = ar[0]
                elif op == 4047 and len(ar) >= 3:
                    ent = tuple(ar[:3])
                elif op == 4048 and ar:
                    rot = ar[0] / 1000.0
                elif op in PTL_OPS and ar and isinstance(ar[0], str):
                    if ar[0].strip('"') in no_ptl:
                        continue
                    try:
                        e = self.bank.get(ar[0].strip('"'))
                    except Exception:
                        e = None
                    if e is None:
                        continue
                    st = MU.obj_params(ob, te)
                    tint = PT.palette_colours(self.code, self.pal, sub, ent) if ent else None
                    floor = None
                    if any(self.bank.recs[i].bf & 0x4000000 for i in PT.chain_ids(self.bank, e)):
                        floor = -st["y"] / MU.UNIT_PX
                    sim = PT.Sim(self.bank, e, seed, floor, (1.0, 1.0), (0.0, 0.0), rot + st["rot"])
                    sims.append((te, sim, tint, (-st["x"], st["y"])))
        end = max([ob.end if ob.dead is None else min(ob.end, ob.dead) for ob in objs] + [0])


        top = objs[0] if objs else None
        cap = MAX_TICKS if top is None else min(MAX_TICKS, (top.end if top.dead is None else min(top.end, top.dead)) + TAIL)
        if stop is not None:
            cap = min(MAX_TICKS, stop + 60)
        frames, last_ptl = [], 0
        T = cap
        self.capped = False
        for t in range(T):
            ops = []
            for ob, st, mt in by_t.get(t, []):
                mdl = MU.model(st["model"], self.code)
                tint = MU.effect_tint(self.code, self.pal, st)
                blend = st["blend"] or MU._default_blend(mdl, self.code)
                for g in mdl.geometry(mt):
                    xy = MU.project(g["xyz"], -st["x"], -st["y"], MU.UNIT_PX, st["sx"], st["sy"], st["rot"])
                    bl = "add" if CORE_TEX.search(g["texture"] or "") else blend
                    ops.append(("tri", xy, g["uv"], g["rgba"], g["tris"], g["texture"], bl, tint, st["alpha"] / 255.0))
            for ob in objs:
                oend = ob.end if ob.dead is None else min(ob.end, ob.dead)
                if not (ob.t0 <= t < oend):
                    continue
                for s0, s1, name in ob.sprites:
                    if s0 <= t < s1 and name != "null":
                        st = MU.obj_params(ob, t)
                        ops.append(("spr", name, st))
            dx = dy = 0.0
            if move:
                vx, vy, m0, m1 = move
                k = min(max(t - m0, 0), m1 - m0)
                dx, dy = -vx * k, vy * k
            for te, sim, tint, base in sims:
                if t < te:
                    continue
                if stop is not None and t >= stop:
                    sim.stopped = True
                if move:
                    on = m0 <= t < m1
                    sim.ev = np.array([(-vx if on else 0.0) / MU.UNIT_PX, (vy if on else 0.0) / MU.UNIT_PX, 0.0])
                for g, p in sim.step(t - te):
                    pts, uv, rgba, blend, page = sim.quad(g, p, tint, False, MU.UNIT_PX)
                    ops.append(("ptl", pts + np.array(base) + [dx, dy], uv, rgba, blend, page))
                    last_ptl = t
            frames.append(ops)
            if t >= end and t > last_ptl + 2 and not ops:
                break
        else:
            self.capped = any(frames[-FADE:])
        while frames and not frames[-1]:
            frames.pop()
        return len(frames), frames

    def _sprite(self, name, st):
        """-> (straight float RGBA, x0, y0 y-down relative to the root, blend) in raw orientation."""
        r = self.src.frame(name)
        if r is None:
            return None
        arr, (ax, ay) = r
        arr, ax = arr[:, ::-1], arr.shape[1] - ax
        im = Image.fromarray(np.ascontiguousarray(arr), "RGBA")
        sx, sy = abs(st["sx"]) or 1.0, abs(st["sy"]) or 1.0
        if abs(sx - 1) > 1e-3 or abs(sy - 1) > 1e-3:
            im = im.resize((max(1, round(im.width * sx)), max(1, round(im.height * sy))), Image.BILINEAR)
            ax, ay = ax * sx, ay * sy
        if abs(st["rot"]) > 1e-3:
            W0, H0 = im.size
            im = im.rotate(st["rot"], resample=Image.BICUBIC, expand=True)
            a = math.radians(st["rot"]); cx0, cy0 = ax - W0 / 2, ay - H0 / 2
            ax = im.width / 2 + cx0 * math.cos(a) + cy0 * math.sin(a)
            ay = im.height / 2 - cx0 * math.sin(a) + cy0 * math.cos(a)
        f = np.asarray(im, np.float32) / 255.0
        if getattr(self, "sprite_tint", None):
            f = f.copy(); f[..., :3] *= np.asarray(self.sprite_tint, np.float32)
        blend = st["blend"] or ("add" if name in self.src.additive else "alpha")
        return f, -st["x"] - ax, -st["y"] - ay, blend

    def render(self, state, seed=1, bloom=0.0, stop=None, move=None, no_ptl=(), sprite_tint=None):
        """-> dict(body=[HxWx4 uint8], glow=[...], origin=(x, y) px in the frame (face right, y down), ticks).
        sprite_tint: RGB multiplier for sprite effects (BBTAG's white smoke recoloured to her rose, V2_PLAN P2)."""
        self.sprite_tint = sprite_tint
        n, frames = self.ops(state, seed, stop, move, tuple(no_ptl or ()))
        if not n:
            return None

        pts = []
        sprite_cache = {}
        for ops in frames:
            for op in ops:
                if op[0] == "tri":
                    pts.append(op[1][np.unique(op[4])])
                elif op[0] == "ptl":
                    q = op[1].copy(); q[:, 1] = -q[:, 1]; pts.append(q)
                else:
                    k = (op[1], tuple(sorted((kk, round(float(v), 3)) for kk, v in op[2].items() if kk in ("x", "y", "sx", "sy", "rot"))))
                    if k not in sprite_cache:
                        sprite_cache[k] = self._sprite(op[1], op[2])
                    s = sprite_cache[k]
                    if s is not None:
                        f, x0, y0, _ = s
                        pts.append(np.array([[x0, y0], [x0 + f.shape[1], y0 + f.shape[0]]]))
        if not pts:
            return None
        P_ = np.concatenate([p for p in pts if len(p)])
        P_ = P_[np.abs(P_).max(1) < 1e5]
        lo, hi = np.floor(P_.min(0)) - 4, np.ceil(P_.max(0)) + 4
        W, H = int(hi[0] - lo[0]), int(hi[1] - lo[1])
        ox, oy = -lo[0], -lo[1]
        texs = {0: PT.texture(self.code)}
        try:
            texs[1] = PT.texture("e0")
        except Exception:
            pass
        ss = SS if W * H * SS * SS <= 4.0e6 else 1
        body, glow = [], []
        for fi, ops in enumerate(frames):
            b = Buf(W * ss, H * ss)
            for op in ops:
                if op[0] == "tri":
                    _, xy, uv, rgba, tris, tex, blend, tint, al = op
                    b.tris((xy + [ox, oy]) * ss, uv, rgba, tris, MU.texture(tex, self.code), blend, tint, al)
                elif op[0] == "ptl":
                    _, pts2, uv, rgba, blend, page = op
                    if page in texs:
                        PT.raster(b.d, pts2 * ss, uv, rgba, blend, texs[page], ox * ss, oy * ss)
                else:
                    k = (op[1], tuple(sorted((kk, round(float(v), 3)) for kk, v in op[2].items() if kk in ("x", "y", "sx", "sy", "rot"))))
                    s = sprite_cache.get(k)
                    if s is not None:
                        f, x0, y0, blend = s
                        if ss > 1:
                            f = np.asarray(Image.fromarray((f * 255).astype(np.uint8), "RGBA").resize((f.shape[1] * ss, f.shape[0] * ss), Image.BILINEAR), np.float32) / 255.0
                        b.image(f, int(round((x0 + ox) * ss)), int(round((y0 + oy) * ss)), blend, op[2]["alpha"] / 255.0)
            Pd, Ld, Ad = (_down(b.d[k], ss) if ss > 1 else b.d[k] for k in ("P", "L", "A"))
            del b
            if bloom > 0:
                bl = Image.fromarray((np.clip(Pd, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
                Ld = Ld + np.asarray(bl, np.float32) / 255.0 * bloom
            if self.capped and fi >= len(frames) - FADE:
                f = (len(frames) - fi) / float(FADE + 1)
                Pd, Ld, Ad = Pd * f, Ld * f, Ad * f
            a = np.clip(Ad, 0, 1)
            rgb = np.where(a[..., None] > 1e-4, Pd / np.maximum(a[..., None], 1e-4), 0)
            body.append((np.dstack([np.clip(rgb, 0, 1), a]) * 255).astype(np.uint8)[:, ::-1])
            la = np.clip(Ld.max(-1), 0, 1)
            lrgb = np.where(la[..., None] > 1e-4, Ld / np.maximum(la[..., None], 1e-4), 0)
            glow.append((np.dstack([np.clip(lrgb, 0, 1), la]) * 255).astype(np.uint8)[:, ::-1])
        return {"body": body, "glow": glow, "origin": (W - ox, oy), "ticks": n, "size": (W, H)}



def _pack(frames, scale):
    """Frames (same size) -> (sheet image, cols, rows, cell w, cell h, crop box (x0, y0, x1, y1) in frame px) or None
    for an empty layer. The crop is the union of every frame's content, so all cells share one placement."""
    boxes = [Image.fromarray(f[..., 3]).getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    c4 = lambda v: max(4, -(-int(math.ceil(v)) // 4) * 4)
    cw, ch = c4((x1 - x0) * scale), c4((y1 - y0) * scale)
    n = len(frames)
    best = None
    for cols in range(1, n + 1):
        rows = -(-n // cols)
        W, H = cols * cw, rows * ch
        k = min(1.0, MAX_SIDE / max(W, H))
        score = (W * H) / (k * k) if k < 1 else W * H
        if best is None or score < best[0] or (score == best[0] and abs(W - H) < abs(best[3] - best[4])):
            best = (score, cols, rows, W, H, k)
    _, cols, rows, W, H, k = best
    if k < 1:
        cw, ch = max(4, int(cw * k) // 4 * 4), max(4, int(ch * k) // 4 * 4)
        W, H = cols * cw, rows * ch
    W4, H4 = W, H
    sheet = Image.new("RGBA", (W4, H4), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        cell = Image.fromarray(f[y0:y1, x0:x1], "RGBA").resize((cw, ch), Image.LANCZOS)

        sheet.paste(cell, ((i % cols) * cw, (i // cols) * ch))
    return sheet, cols, rows, cw, ch, (x0, y0, x1, y1), (W4, H4)


def port(r, state, scale=1.0, glow_scale=0.5, bloom=0.0, seed=1, step=1, out_dir=OUT, budget=(3.0e6, 0.8e6), stop=None, move=None,
         no_ptl=(), sprite_tint=None):
    """Render + pack one state, cached by content. -> meta dict (+ PNGs next to it) or None when nothing draws.
    step: keep every step-th frame (slow drifting effects such as petals play at 60 / step frames per second).
    budget: most pixels a layer's sheet may hold (body, glow). Effects over it get every second frame when longer than
    40 frames, then smaller cells: every effect then costs a few MB of GPU memory at most."""
    os.makedirs(out_dir, exist_ok=True)
    k = (VERSION, r.code, r.pal, state, scale, glow_scale, bloom, seed, step, budget) + ((stop,) if stop is not None else ())
    k += (("move", tuple(move)),) if move else ()
    k += (("noptl", tuple(sorted(no_ptl))),) if no_ptl else ()
    k += (("stint", tuple(sprite_tint)),) if sprite_tint else ()
    key = hashlib.sha1(repr(k).encode()).hexdigest()[:12]
    mp = os.path.join(out_dir, "%s_%s.json" % (state, key))
    if os.path.exists(mp):
        return json.load(open(mp))
    res = r.render(state, seed=seed, bloom=bloom, stop=stop, move=move, no_ptl=no_ptl, sprite_tint=sprite_tint)
    if res is None:
        json.dump(None, open(mp, "w")); return None
    def area(fr):
        bb = [Image.fromarray(f[..., 3]).getbbox() for f in fr]
        bb = [b for b in bb if b]
        if not bb: return 0
        return (max(b[2] for b in bb) - min(b[0] for b in bb)) * (max(b[3] for b in bb) - min(b[1] for b in bb))
    A = area(res["body"]) or area(res["glow"])
    n = len(res["body"])
    if step == 1 and n > 40 and n * A * scale * scale > budget[0]:
        step = 2
    nf = len(res["body"][::step])
    scales = {"body": scale, "glow": glow_scale}
    for layer, i in (("body", 0), ("glow", 1)):
        a = area(res[layer])
        if a and nf * a * scales[layer] ** 2 > budget[i]:
            scales[layer] = max(0.2, math.sqrt(budget[i] / (nf * a)))
    meta = {"state": state, "ticks": res["ticks"], "frames": nf, "origin": list(res["origin"]),
            "size": list(res["size"]), "scale": scales, "step": step, "layers": {}}
    for layer in ("body", "glow"):
        pk = _pack(res[layer][::step], scales[layer])
        if pk is None:
            continue
        sheet, cols, rows, cw, ch, (x0, y0, x1, y1), (W4, H4) = pk
        png = os.path.join(out_dir, "%s_%s_%s.png" % (state, key, layer))
        sheet.save(png)
        ox, oy = res["origin"]
        meta["layers"][layer] = {"png": png, "cols": cols, "rows": rows, "cell": [cw, ch], "sheet": [W4, H4],

                                 "centre": [(x0 + x1) / 2 - ox, oy - (y0 + y1) / 2], "extent": [x1 - x0, y1 - y0],
                                 "uv_used": [cols * cw / W4, rows * ch / H4]}
    json.dump(meta, open(mp, "w"), indent=1)
    return meta



def _cab(name):
    return "CAB-" + hashlib.md5(name.encode()).hexdigest()


def make_bundles(metas, out, tpl, u_per_px):
    """Clone the kit's flipbook template per ported effect. tpl = {
        "prefab": our imported template bundle (e.g. effect/prefab/role/rrb/rrb_fb),
        "deps": its manifest dependencies (from the kit import),
        "dir": the logical folder for our clones (e.g. "rrb/fb"),
        "layers": {layer: {"go": child object name, "mat" / "tex": the template's material / texture clone bundles,
                           "donor_mat": official material, "donor_tex": official texture, "tint": [r, g, b, a]}}}
    A layer an effect doesn't use keeps the template's clones (built in the same build) and emits nothing.
    metas: {effect name: port() meta}. Writes into `out`; -> manifest additions {"names", "entries", "guids"}."""
    import bbchar, UnityPy
    adds = {"names": [], "entries": [], "guids": []}
    tpath = os.path.join(out, *(tpl["prefab"] + ".ab").split("/"))
    raw = open(tpath, "rb").read()
    tcab = list(UnityPy.load(raw).file.files.keys())[0]
    for name, meta in metas.items():
        if not meta or not meta["layers"]:
            continue
        dst = "effect/prefab/role/" + tpl.get("prefab_dir", tpl["dir"]) + "/" + name
        remap, subst = {}, {}
        for layer, L in tpl["layers"].items():
            m = meta["layers"].get(layer)
            if not m:
                continue
            tex = "effect/common/texture/%s/%s_%s" % (tpl["dir"], name, layer)
            mat = "effect/common/material/%s/%s_%s" % (tpl["dir"], name, layer)
            a = bbchar.clone_bundle(L["donor_tex"], tex, out, image=m["png"])
            for k in adds: adds[k] += a[k]
            a = bbchar.clone_bundle(L["donor_mat"], mat, out, material_props={"colors": {"_TintColor": (meta.get("tint") or {}).get(layer, L["tint"])}},
                                    remap_deps={L["donor_tex"]: tex})
            for k in adds: adds[k] += a[k]
            remap[_cab(L["mat"])] = _cab(mat)
            subst[L["mat"]], subst[L["tex"]] = mat, tex
        env = UnityPy.load(raw)
        sf = env.file.files[tcab]
        env.file.files = {_cab(dst): sf}
        for e in sf.externals:
            for old, new in remap.items():
                e.path = re.sub(re.escape(old), new, e.path, flags=re.I)
        gos = {o.path_id: o.read_typetree().get("m_Name") for o in env.objects if o.type.name == "GameObject"}
        life = meta["ticks"] / 60.0
        for o in env.objects:
            t = None
            if o.type.name == "AssetBundle":
                t = o.read_typetree()
                t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
                t["m_Container"] = [[k.replace(tpl["prefab"].rsplit("/", 1)[-1] + ".prefab", name + ".prefab"), v] for k, v in t["m_Container"]]
            elif o.type.name == "GameObject":
                t = o.read_typetree()
                if t.get("m_Name") == tpl["prefab"].rsplit("/", 1)[-1]:
                    t["m_Name"] = name
                else:
                    t = None
            elif o.type.name in ("ParticleSystem", "Transform"):
                t = o.read_typetree()
                layer = next((ly for ly, L in tpl["layers"].items() if gos.get(t["m_GameObject"]["m_PathID"]) == L["go"]), None)
                if layer is None:
                    t = None
                else:
                    m = meta["layers"].get(layer)
                    if o.type.name == "Transform":
                        if m:
                            cx, cy = m["centre"]
                            t["m_LocalPosition"] = {"x": float(cx * u_per_px), "y": float(cy * u_per_px), "z": 0.0}
                    else:
                        t["lengthInSec"] = float(life)
                        im = t["InitialModule"]
                        im["startLifetime"]["scalar"] = im["startLifetime"]["minScalar"] = float(life)
                        uv = t["UVModule"]
                        b = t["EmissionModule"]["m_Bursts"][0]["countCurve"]
                        if m:
                            sc = meta["scale"][layer]
                            im["startSize"]["scalar"] = im["startSize"]["minScalar"] = float(m["cell"][0] / sc * u_per_px)
                            im["startSizeY"]["scalar"] = im["startSizeY"]["minScalar"] = float(m["cell"][1] / sc * u_per_px)
                            uv["tilesX"], uv["tilesY"] = int(m["cols"]), int(m["rows"])
                            cells = m["cols"] * m["rows"]
                            uv["frameOverTime"]["scalar"] = float((meta["frames"] - 0.01) / cells)
                            b["scalar"] = b["minScalar"] = 1.0
                        else:
                            b["scalar"] = b["minScalar"] = 0.0
            elif o.type.name == "MonoBehaviour":
                t = o.read_typetree()
                if "m_duration" in t:
                    t["m_duration"] = float(life + 0.05); t["m_maxParticleLifetime"] = float(life)
                else:
                    t = None
            if t is not None:
                o.save_typetree(t)
        p = os.path.join(out, *(dst + ".ab").split("/"))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(env.file.save(packer="lz4"))
        dl = []
        for d in tpl["deps"]:
            d = subst.get(d, d)
            if d not in dl: dl.append(d)
        adds["names"].append(dst); adds["entries"].append((dst, dl))
    return adds



def preview(meta, path, bg=(34, 38, 46)):
    """A contact sheet of the two layers composited over a dark background (checks by eye)."""
    L = meta["layers"]
    if not L:
        return
    ims = {k: Image.open(v["png"]).convert("RGBA") for k, v in L.items()}
    k0 = next(iter(L))
    cols, rows = L[k0]["cols"], L[k0]["rows"]
    n = meta.get("frames", meta["ticks"])
    cw, ch = L[k0]["cell"]
    sheet = Image.new("RGB", (cols * cw, rows * ch), bg)
    for layer, im in ims.items():
        c2 = L[layer]
        base = im.resize((c2["cols"] * cw, c2["rows"] * ch)) if (c2["cell"] != L[k0]["cell"]) else im
        if layer == "glow":
            arr = np.asarray(sheet, np.float32) / 255
            g = np.asarray(base.crop((0, 0, sheet.width, sheet.height)), np.float32) / 255
            arr = np.clip(arr + g[..., :3] * g[..., 3:4] * 1.6, 0, 1)
            sheet = Image.fromarray((arr * 255).astype(np.uint8))
        else:
            sheet.paste(base.crop((0, 0, sheet.width, sheet.height)), (0, 0), base.crop((0, 0, sheet.width, sheet.height)))
    d = ImageDraw.Draw(sheet)
    for i in range(n):
        d.text(((i % cols) * cw + 3, (i // cols) * ch + 2), str(i), fill=(255, 230, 90))
    sheet.save(path)


def main():
    a = sys.argv[1:]
    if not a or a[0] != "render":
        print(__doc__); return
    code = a[a.index("--code") + 1] if "--code" in a else "rrb"
    bloom = float(a[a.index("--bloom") + 1]) if "--bloom" in a else 0.0
    states = [x for i, x in enumerate(a[1:], 1) if not x.startswith("--") and a[i - 1] not in ("--code", "--bloom")]
    r = Renderer(code)
    for st in states:
        m = port(r, st, bloom=bloom)
        if not m:
            print(st, "draws nothing"); continue
        pv = os.path.join(OUT, st + "_preview.png"); preview(m, pv)
        print(st, "%d ticks," % m["ticks"], ", ".join("%s %dx%d cells %s (sheet %s)" % (k, v["cols"], v["rows"], v["cell"], v["sheet"])
                                                      for k, v in m["layers"].items()), "->", pv)


if __name__ == "__main__":
    main()
