"""ruby_blade.py -- Crescent Rose's blade on each of Ruby's BBTAG frames, and scythe trails swept by it (Cross Effect,
V2; the lead, 2026-09-29: "the vfx needs to follow the full arc", "the startup of a3 also needs some vfx frames",
"she's swinging her scythe backwards and it's supposed to be like a blunt effect").

BBTAG draws each swing's smear as a few ribbon pieces hand-placed on its key frames; wind-ups, follow-throughs and
back-swings often have none. Here the smear is swept by the blade itself:

  blade(frame)   the blade's steel pixels on the sprite (bright, blue-neutral: b >= r, g >= r, r+g+b > 330), the
                 largest connected region plus nearby pieces; its spine sampled at S points, heel (the wider end, where
                 it meets the scythe head) to tip. Units: world u from her root, facing right, y up.
  sweep(k, k+1)  the rigid motion taking frame k's spine to frame k+1's (least squares), turned about its own
                 centre of rotation so the swept sheet is a true fan (straight in-betweens would cut corners), with
                 the residual blended in; subdivided every <= 8 degrees.
  trail          BBTAG's method: on each frame the blade moved significantly, a partial ribbon covering the last sweeps
                 (the newest at the texture's head, older ones toward its ragged tail: BBTAG ribbons map the stroke onto
                 U 0.5 -> 1.0); shown for that frame, the last one holding and fading (fxcompile_ruby.animate).

Parts are in bbtag_fxcompile's format, so fxcompile_ruby builds them like her compiled arcs (same textures, layers,
glow). Blunt swings use BBTAG's blunt textures (dageki), slashes its slash textures (zangeki).
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np

U_PER_PX = 1.95 / 419
S = 7                      # spine samples, heel to tip
MIN_MOVE = 0.22            # u: a frame change moves the blade tip at least this much to count as a swing
MIN_TURN = 10.0            # degrees: ... or turns it this much
STEP = 8.0                 # degrees per subdivision of a sweep
TEX = {"slash": ("rrbef_zangeki01.DDS", "rrbef_zangeki02.DDS", "rrbef_zangeki03.DDS"),
       "blunt": ("rrbef_dageki01.DDS", "rrbef_dageki02.DDS", None)}
# smooth trails (swing_ribbon) draw the whole blade, heel to tip: the blunt strokes (dageki) are thin spikes on the blade's
# edge, which on a full-blade ribbon read as a thin hoop round her (inst3, 5AA, 2026-10-02). A blunt trail is the filled
# stroke with the blunt spikes as its edge, and shorter
TRAIL_TEX = {"slash": TEX["slash"], "blunt": ("rrbef_zangeki01.DDS", "rrbef_dageki01.DDS", None)}


def _label(mask):
    try:
        from scipy import ndimage
        lab, n = ndimage.label(mask)
        return lab, n
    except ImportError:
        lab = np.zeros(mask.shape, int); n = 0
        H, W = mask.shape
        for y0, x0 in zip(*np.nonzero(mask)):
            if lab[y0, x0]: continue
            n += 1; stack = [(y0, x0)]; lab[y0, x0] = n
            while stack:
                y, x = stack.pop()
                for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; stack.append((yy, xx))
        return lab, n


_cache = {}
def blade(assets, sprite):
    """(S x 2 spine heel->tip, blade pixel cloud N x 2) in world units from her root (facing right), or None."""
    if sprite in _cache: return _cache[sprite]
    fr = assets.frame(sprite) if sprite and sprite != "null" else None
    if not fr: _cache[sprite] = None; return None
    img, (ax, ay) = fr
    a = np.asarray(img).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = (al > 128) & (b >= r - 5) & (g >= r - 10) & ((r + g + b) > 330)
    lab, n = _label(m)
    if n == 0: _cache[sprite] = None; return None
    sizes = np.bincount(lab.ravel())[1:]
    big = int(np.argmax(sizes)) + 1
    if sizes[big - 1] < 120: _cache[sprite] = None; return None
    ys, xs = np.nonzero(lab == big)
    core = np.stack([xs, ys], 1).astype(float)
    # nearby pieces of the same blade (highlight gaps split it): within 10 px of the main region, 25+ px
    keep = [big]
    for k in range(1, n + 1):
        if k == big or sizes[k - 1] < 25: continue
        yk, xk = np.nonzero(lab == k)
        pk = np.stack([xk, yk], 1).astype(float)
        sub = pk[:: max(1, len(pk) // 40)]
        d = np.sqrt(((sub[:, None, :] - core[None, :: max(1, len(core) // 200), :]) ** 2).sum(-1)).min()
        if d <= 10: keep.append(k)
    ys, xs = np.nonzero(np.isin(lab, keep))
    P = np.stack([(xs - ax) * U_PER_PX, (ay - ys) * U_PER_PX], 1)
    c = P.mean(0); U, Sv, Vt = np.linalg.svd(P - c, full_matrices=False)
    ax_ = Vt[0]; proj = (P - c) @ ax_; perp = (P - c) @ Vt[1]
    lo, hi = np.quantile(proj, 0.03), np.quantile(proj, 0.97)
    edges = np.linspace(lo, hi, S + 1)
    spine = []
    for i in range(S):
        sel = (proj >= edges[i]) & (proj <= edges[i + 1])
        spine.append(P[sel].mean(0) if sel.any() else c + ax_ * (edges[i] + edges[i + 1]) / 2)
    spine = np.asarray(spine)
    # heel = the wider end (the blade meets the scythe head there); the tip is the pointed end
    w0 = np.ptp(perp[proj <= np.quantile(proj, 0.2)]); w1 = np.ptp(perp[proj >= np.quantile(proj, 0.8)])
    if w1 > w0: spine = spine[::-1]
    _cache[sprite] = (spine, P)
    return _cache[sprite]


def rigid(A, B):
    """least-squares rotation (radians) + translation taking A onto B (both S x 2); and the centre of rotation"""
    ca, cb = A.mean(0), B.mean(0)
    H = (A - ca).T @ (B - cb)
    th = math.atan2(H[0, 1] - H[1, 0], H[0, 0] + H[1, 1])
    R = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
    t = cb - R @ ca
    if abs(th) > 1e-3:
        centre = np.linalg.solve(np.eye(2) - R, t)
    else:
        centre = None
    return th, t, centre


def sweep(A, B):
    """in-between spines from A to B (list of S x 2), turned about the motion's centre"""
    th, t, centre = rigid(A, B)
    n = max(2, int(math.ceil(abs(math.degrees(th)) / STEP)) + 1)
    R_ = lambda a: np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    fitted = (R_(th) @ A.T).T + t
    resid = B - fitted
    out = []
    for j in range(n):
        f = j / (n - 1)
        if centre is not None:
            X = (R_(th * f) @ (A - centre).T).T + centre
        else:
            X = A + t * f
        out.append(X + resid * f)
    return out


def frames_of(assets, clip, animdur, total):
    """[(tick, sprite)] of an action's clip, played over AnimateDuration (ticks at 60 fps)"""
    seq = assets.clips.get(clip)
    if not seq: return []
    L = sum(n for _, n in seq)
    k = (animdur * 60.0) / L if L else 1.0
    out, acc = [], 0
    for s, n in seq:
        t = round(acc * k, 4)
        if t <= total * 60 + 1e-6: out.append((t, s))
        acc += n
    return out


class Frames:
    """her sprite frames from the player's BBTAG install (bbtag_rig.Source), as the move viewer places them"""
    def __init__(self, src=None, clips=None):
        if src is None:
            import bbtag_rig
            src = bbtag_rig.Source("rrb")
        self.src, self.clips, self._fr = src, clips or {}, {}
    def frame(self, sprite):
        from PIL import Image
        if sprite not in self._fr:
            r = self.src.frame(sprite)
            self._fr[sprite] = None if r is None else (Image.fromarray(r[0], "RGBA"), r[1])
        return self._fr[sprite]


def orient(prev, cur):
    """the spine `cur` ordered like `prev` (heel -> tip). blade() picks the heel as the wider end, which flips on some
    frames (Scythe Chain 5B: -172 / -152 deg 'turns' between frames, 2026-09-29): a trail swept about a wrong centre,
    drawn off the blade or not at all. The blade swings about her hands, never in place, so a spine much closer to the
    previous one reversed than as it is is the same blade with its ends swapped."""
    if prev is None: return cur
    d_same = np.linalg.norm(cur - prev); d_flip = np.linalg.norm(cur[::-1] - prev)
    return cur[::-1].copy() if d_flip < 0.5 * d_same else cur


def oriented(sp):
    out, prev = [], None
    for t, b in sp:
        b = orient(prev, b); out.append((t, b)); prev = b
    return out


def swings(assets, frames):
    """[[(tick, spine), ...], ...]: runs of frames where the blade keeps swinging (each step moves the tip MIN_MOVE or
    turns MIN_TURN), each with the resting frame before it"""
    sp = [(t, blade(assets, s)) for t, s in frames]
    sp = oriented([(t, b[0]) for t, b in sp if b is not None])
    out, cur = [], []
    for i in range(1, len(sp)):
        (ta, A), (tb, B) = sp[i - 1], sp[i]
        th, _, _ = rigid(A, B)
        moving = np.linalg.norm(B[-1] - A[-1]) >= MIN_MOVE or abs(math.degrees(th)) >= MIN_TURN
        if moving:
            if not cur: cur = [(ta, A)]
            cur.append((tb, B))
        elif cur:
            out.append(cur); cur = []
    if cur: out.append(cur)
    return out


def swing_parts(swing, style="slash", keep=2, end_tick=None, max_turn=None):
    """Parts for one swing (ticks relative to its first moving frame): on each frame, a ribbon over its last `keep`
    sweeps, the newest at the texture's head (U 0.97) and older ones toward its ragged tail (U 0.52); shown until the
    next frame (the last one holds and fades: fxcompile_ruby.animate)."""
    tex_body, tex_edge, tex_glow = TEX[style]
    t_start = swing[1][0]
    parts, sweeps = [], []
    for i in range(1, len(swing)):
        (ta, A), (tb, B) = swing[i - 1], swing[i]
        turn_ = abs(math.degrees(rigid(A, B)[0]))
        if max_turn is not None and turn_ > max_turn:
            sweeps = []          # a whirl too fast to read between two frames (5B / 5BB): the move's BBTAG arc draws it
            continue
        if turn_ < MIN_SWEEP:
            # the blade is carried, not swung (she falls or lunges with it held still): the sweep between the two frames
            # is a straight bar (game review 2026-10-02: "trails drawn as straight bars", air shot and Clash Assault)
            sweeps = []
            continue
        sweeps.append(sweep(A, B))
        rows = []
        for k_, sw in enumerate(sweeps[-keep:]):
            rows += sw if k_ == 0 else sw[1:]
        nR = len(rows)
        verts, uv, tris = [], [], []
        for r_, row in enumerate(rows):
            u = 0.52 + 0.45 * (r_ / (nR - 1))
            for c_ in range(S):
                verts.append([float(row[c_][0]), float(row[c_][1])]); uv.append([u, c_ / (S - 1)])
        for r_ in range(nR - 1):
            for c_ in range(S - 1):
                a0 = r_ * S + c_; a1 = a0 + 1; b0 = a0 + S; b1 = b0 + 1
                tris += [[a0, b0, a1], [a1, b0, b1]]
        t_next = swing[i + 1][0] if i + 1 < len(swing) else (end_tick if end_tick is not None else tb + 3)
        t0 = int(round(tb - t_start)); t1 = max(t0, int(round(t_next - t_start)) - 1)
        for role, tex in (("body", tex_body), ("edge", tex_edge), ("glow", tex_glow)):
            if not tex: continue
            parts.append(dict(key="trail_%d/%s" % (i, role), state="trail", layer=role, texture=tex, role=role,
                              blend="alpha" if role in ("body", "edge") else "add", t0=t0, t1=t1, origin=(0.0, 0.0),
                              verts=[list(v) for v in verts], uv=[list(x) for x in uv], alpha=[1.0] * len(verts), tris=tris,
                              uscroll=[[t0, 0.0]], vscroll=[[t0, 0.0]], fade=[[t0, 1.0]], scale=[], rot=[], tint=[1.0, 1.0, 1.0]))
    return parts


TRAIL_HEAD = 0.94        # the trail textures' stroke head (fxcompile_ruby "#trail" clones: BBTAG's stroke U 0.5 -> 0.97
                         # squeezed into 0 -> 0.94, transparent past it, so the clamped texture shows nothing ahead)
TRAIL_LMAX = 5.0         # (unused since the trails are laid out by time: TRAIL_TICKS)
TRAIL_TICKS = {"slash": 9, "blunt": 6}   # ticks of the blade's path a trail shows (its length on screen, by time)
TRAIL_LEAD = 3           # ticks: the head leaves the pose before a swing's first moving frame at most this long before it
TRAIL_LINGER, TRAIL_HOLD = 10, 2   # ticks after the swing: the tail closes on the head while the stroke fades (held 2)


def swing_runs(swing, max_turn=None):
    """the swing's consecutive swept steps [[(ta, A, tb, B), ...], ...]: a carried blade (< MIN_SWEEP) or a whirl too fast
    to read between two frames (> max_turn) ends a run"""
    runs, cur = [], []
    for i in range(1, len(swing)):
        (ta, A), (tb, B) = swing[i - 1], swing[i]
        turn_ = abs(math.degrees(rigid(A, B)[0]))
        if (max_turn is not None and turn_ > max_turn) or turn_ < MIN_SWEEP:
            if cur: runs.append(cur)
            cur = []
            continue
        cur.append((ta, A, tb, B))
    if cur: runs.append(cur)
    return runs


def swing_ribbon(swing, style="slash", max_turn=None, lead=0.0, linger=TRAIL_LINGER, hold=TRAIL_HOLD, until=None):
    """Smooth trails (the lead, 2026-10-02: her effects looked "choppy and cut up and low fps" with "choppy cutoffs";
    "make the effects tied to [the game's frame rate] rather than ruby's sprites"). swing_parts drew one still ribbon per
    sprite frame, so the trail moved only when her sprite changed (every 2-5 ticks) and each piece vanished in one tick.

    Here each run of a swing is ONE ribbon over every in-between spine of the run, and the stroke travels along it by its
    U scroll (Custom1.x, a curve the particle evaluates every rendered frame): the head passes each sprite pose when that
    pose appears (the blade's true motion, which her sprite samples) and moves on between them; behind it the stroke
    covers the last TRAIL_TICKS of the path (the texture is laid out by time, so the scroll is one straight line). After
    the swing the tail closes on the head in that time while the stroke dims: no part appears or disappears in one tick. Ticks are relative to the swing's first moving frame minus `lead` (the
    effect is spawned that much earlier: the head leaves the rest pose then). Layers: dark edge, crimson body, additive
    glow, and a hot core on the blade's outer edge, all on the same scroll."""
    tex_body, tex_edge, tex_glow = TRAIL_TEX[style]
    base = swing[1][0] - lead
    T = float(TRAIL_TICKS[style] if isinstance(TRAIL_TICKS, dict) else TRAIL_TICKS)
    gt = TRAIL_HEAD / T
    parts = []
    for ri, run in enumerate(swing_runs(swing, max_turn)):
        # each row's time: when the head passes it (the head reaches each pose when that pose appears, at an even pace
        # between poses). The texture is laid out by THAT time, not by distance: the stroke on screen is always the last
        # T ticks of the blade's path, as a trail renderer draws (game check 2026-10-02: laid out by distance, up to 5 u of
        # 5AA's looping path stayed up at once, a thin hoop round her that outlived the swing)
        rows, tau = [], []
        for j, (ta, A, tb, B) in enumerate(run):
            sw = sweep(A, B)
            t_from = (max(ta, tb - TRAIL_LEAD, base) if j == 0 else ta) - base
            n_ = len(sw) - 1
            for k_, r in enumerate(sw if j == 0 else sw[1:]):
                f = (k_ if j == 0 else k_ + 1) / max(1, n_)
                rows.append(r); tau.append(t_from + f * (tb - base - t_from))
        for i in range(1, len(tau)):
            tau[i] = max(tau[i], tau[i - 1] + 1e-3)
        if until is not None:                  # the attack window ends: the blade's recovery draws nothing
            keep = sum(1 for t_ in tau if t_ - lead <= until)
            if keep < 2: continue
            rows, tau = rows[:keep], tau[:keep]
        reach = sum(float(np.linalg.norm(b[-1] - a[-1])) for a, b in zip(rows, rows[1:]))
        if reach < 0.15: continue
        t_end = tau[-1]
        t0 = int(math.floor(tau[0])); t1 = int(math.ceil(t_end + T)) + 1
        uscroll = [[t0, round((t0 - t_end) * gt, 5)], [t1, round((t1 - t_end) * gt, 5)]]   # one straight line
        nR = len(rows)
        verts, uv, tris = [], [], []
        for r_, row in enumerate(rows):
            u = TRAIL_HEAD + (tau[r_] - t_end) * gt
            for c_ in range(S):
                verts.append([float(row[c_][0]), float(row[c_][1])]); uv.append([round(u, 5), c_ / (S - 1)])
        for r_ in range(nR - 1):
            for c_ in range(S - 1):
                a0 = r_ * S + c_; a1 = a0 + 1; b0 = a0 + S; b1 = b0 + 1
                tris += [[a0, b0, a1], [a1, b0, b1]]
        # after the swing the tail closes on the head in T ticks; the stroke dims a little as it goes
        fade = [[t0, 1.0], [t_end + 0.3 * T, 1.0], [t_end + T, 0.35], [t1, 0.0]]
        hot = [[t0, 1.0], [t_end + 1, 1.0], [t_end + 0.6 * T, 0.0], [t1, 0.0]]
        # the hot core: the outer (tip) side of the blade, gone before the body
        rim = [min(1.0, max(0.0, (x[1] - 0.45) / 0.55) ** 1.5) for x in uv]
        for role, tex, blend, fk, al in (("edge", tex_edge, "alpha", fade, None), ("body", tex_body, "alpha", fade, None),
                                         ("glow", tex_glow, "add", fade, None), ("core", tex_body, "add", hot, rim)):
            if not tex: continue
            parts.append(dict(key="trail_r%d/%s" % (ri, role), state="trail", layer=role, texture=tex + "#trail", role=role,
                              blend=blend, t0=t0, t1=t1, origin=(0.0, 0.0), verts=[list(v) for v in verts],
                              uv=[list(x) for x in uv], alpha=list(al) if al else [1.0] * len(verts), tris=tris,
                              uscroll=[list(k) for k in uscroll], vscroll=[[t0, 0.0]], fade=[list(k) for k in fk], scale=[],
                              rot=[], tint=[1.0, 1.0, 1.0], smooth=True))
    return parts


SLASH_W = {"quick": 0.55, "sweep": 0.85, "heavy": 1.15, "spin": 0.75, "air": 0.75, "thrust": 0.30}   # u (VFX_RECIPE 2.5 x1.7:
# its widths read as thin dark lines on rrb_slash in game, inst2 2026-10-02: the cel streak fills ~1/3 of the band)
SLASH_TICKS = {"quick": 8, "sweep": 10, "heavy": 12, "spin": 10, "air": 9, "thrust": 7}  # ticks of path on screen
SLASH_ROWS = 5


BAND_W = {"quick": 0.38, "sweep": 0.5, "spin": 0.45, "heavy": 0.65, "air": 0.45, "thrust": 0.25}   # u: the band's widest
BAND_PROFILE = ([0.0, 0.3, 0.7, 0.9, 1.0], [0.08, 0.55, 1.0, 0.85, 0.15])   # its width along the stroke (U 0 tail -> 1 head)


def swing_crescent(swing, kind="sweep", max_turn=None, lead=0.0, until=None):
    """The rebuilt slashes (the lead, 2026-10-02: the saw and gun, rebuilt from BBEE's own parts, are "perfect"; "all the
    slashes need a rework"): per run of a swing, a CRESCENT on the outer side of the blade (VFX_RECIPE 2.2: the tip path
    is its outer edge, the inner edge pulled toward the heel by the kind's width, pointed at both ends of the run), not
    the heel-to-tip fan. U runs 0 (the run's start) -> 1 (its end) by the time the head passes each point, so a wipe
    linear in time keeps the stroke's head on the blade; V runs inner (0) to outer (1). For the kit's rrb_slash
    template (fxcompile_ruby.build_slashes): -> [dict(verts, uv, tris, t_beg, t_end (ticks from the spawn), centroid,
    head, extent, reach)]"""
    W = SLASH_W.get(kind, 0.5)
    T = float(SLASH_TICKS.get(kind, 10))
    gt = TRAIL_HEAD / T
    base = swing[1][0] - lead
    out = []
    for run in swing_runs(swing, max_turn):
        rows, tau = [], []
        for j, (ta, A, tb, B) in enumerate(run):
            sw = sweep(A, B)
            t_from = (max(ta, tb - TRAIL_LEAD, base) if j == 0 else ta) - base
            n_ = len(sw) - 1
            for k_, r in enumerate(sw if j == 0 else sw[1:]):
                f = (k_ if j == 0 else k_ + 1) / max(1, n_)
                rows.append(r); tau.append(t_from + f * (tb - base - t_from))
        for i in range(1, len(tau)):
            tau[i] = max(tau[i], tau[i - 1] + 1e-3)
        if until is not None:
            keep = sum(1 for t_ in tau if t_ - lead <= until)
            if keep < 2: continue
            rows, tau = rows[:keep], tau[:keep]
        tips = np.array([r[-1] for r in rows]); heels = np.array([r[0] for r in rows])
        reach = float(np.sum(np.linalg.norm(np.diff(tips, axis=0), axis=1)))
        if reach < 0.15: continue
        t_end = tau[-1]; t_beg = tau[0]
        verts, uv, tris = [], [], []
        n = len(rows)
        # (the kit's slash look study, 2026-10-02: an inner edge pulled toward the heel lay mostly ALONG the path, 0.5-0.8 u,
        #  and only 0.1-0.3 u across it, and on Low Sweep and 5BB it changed side mid-stroke: a thin folding line.) The band
        #  runs ACROSS the tip path, always on its concave side (the sign of the stroke's whole turn), BAND_W wide at most,
        #  shaped along the stroke by BAND_PROFILE; the outer edge (V 1) stays on the tip path
        Wb = BAND_W.get(kind, 0.5)
        turn = 0.0
        for i in range(1, n - 1):
            d0 = tips[i] - tips[i - 1]; d1 = tips[i + 1] - tips[i]
            turn += math.atan2(d0[0] * d1[1] - d0[1] * d1[0], float(np.dot(d0, d1)))
        side = 1.0 if turn >= 0 else -1.0
        for i in range(n):
            f = (tau[i] - t_beg) / max(1e-6, t_end - t_beg)
            d = tips[i] - heels[i]; L = float(np.linalg.norm(d)) or 1.0; d = d / L
            tg = tips[min(n - 1, i + 2)] - tips[max(0, i - 2)]; tl = float(np.linalg.norm(tg)) or 1.0; tg = tg / tl
            nrm = np.array([-tg[1], tg[0]]) * side
            outer = tips[i] + 0.04 * d
            w = min(Wb * float(np.interp(f, *BAND_PROFILE)), 1.4 * L)
            u = f                                     # 0 tail -> 1 head, by the time the head passes (rrb_slash's U)
            for q in range(SLASH_ROWS):
                fq = q / (SLASH_ROWS - 1)
                p = outer + nrm * (1.0 - fq) * w
                verts.append([float(p[0]), float(p[1])]); uv.append([round(u, 5), fq])
        for i in range(n - 1):
            for q in range(SLASH_ROWS - 1):
                a0 = i * SLASH_ROWS + q; a1 = a0 + 1; b0 = a0 + SLASH_ROWS; b1 = b0 + 1
                tris += [[a0, b0, a1], [a1, b0, b1]]
        t0 = int(math.floor(t_beg)); t1 = int(math.ceil(t_end + T)) + 1
        out.append(dict(verts=verts, uv=uv, tris=tris, t0=t0, t1=t1, t_beg=t_beg, t_end=t_end, T=T, u_by_time=True,
                        uscroll=[[t0, round((t0 - t_end) * gt, 5)], [t1, round((t1 - t_end) * gt, 5)]],
                        centroid=[float(x) for x in np.asarray(verts).mean(0)], head=[float(x) for x in tips[-1]],
                        extent=[float(x) for x in (np.asarray(verts).max(0) - np.asarray(verts).min(0))], reach=reach))
    return out


MIN_SWEEP = 6.0          # degrees: below this turn between two frames the blade is being carried, and no trail is drawn
WAVE_STEP = 2          # ticks per wave frame (each frame is its own ribbon, gliding to the next by its scale keys)
WAVE_ARC = 150.0         # degrees: the most of a blade-swept stroke a wave is made from (the newest part, back from the hit)
WAVE_ROWS = 4            # ribbon samples across the wave (inner -> outer edge)
PIVOT = (0.0, 0.95)      # u from her root: her body, which every swing turns about and every wave flies out from


def _ease_out(x, p=2.2):
    return 1.0 - (1.0 - min(1.0, max(0.0, x))) ** p


def stroke_from_swing(swing, upto=None, max_turn=None):
    """the path her blade TIP drew in one swing, oldest point first (world u from her root): the newest WAVE_ARC degrees
    of it up to `upto` (ticks from the swing's first moving frame). [] when no sweep can be read."""
    t_start = swing[1][0]
    pairs = [(swing[i - 1], swing[i]) for i in range(1, len(swing))]
    if upto is not None:
        pairs = [p for p in pairs if p[0][0] - t_start < upto + 0.5] or pairs[:1]
    rows, turned = [], 0.0
    for (ta, A), (tb, B) in reversed(pairs):                   # newest sweep first
        th = abs(math.degrees(rigid(A, B)[0]))
        if max_turn is not None and th > max_turn: break        # a whirl too fast to read between two frames
        sw = sweep(A, B)
        rows = sw if not rows else sw[:-1] + rows
        turned += th
        if turned >= WAVE_ARC: break
    return [r[-1] for r in rows]


def stroke_from_parts(parts, pivot=PIVOT, bins=48):
    """the OUTER EDGE of one of her BBTAG arcs (bbtag_fxcompile parts: the ribbons ASW drew for this swing), as points
    ordered around the pivot: of every body / edge vertex, the farthest from the pivot in each direction. -> (points,
    closed): closed when the arc goes all the way round (a spin)."""
    P = []
    for p in parts:
        if p.get("role") not in ("body", "edge"): continue
        o = np.asarray(p["origin"], float); P.append(np.asarray(p["verts"], float) + o)
    if not P: return [], False
    P = np.concatenate(P) - np.asarray(pivot)
    ang = np.arctan2(P[:, 1], P[:, 0]); rad = np.hypot(P[:, 0], P[:, 1])
    idx = np.floor((ang + np.pi) / (2 * np.pi) * bins).astype(int) % bins
    best = {}
    for i, b in enumerate(idx):
        if b not in best or rad[i] > rad[best[b]]: best[b] = i
    used = sorted(best)
    if len(used) < 4: return [], False
    closed = len(used) >= bins - 3
    if not closed:                                              # start after the largest empty gap
        gaps = [((used[(i + 1) % len(used)] - used[i]) % bins, i) for i in range(len(used))]
        g, gi = max(gaps)
        used = used[gi + 1:] + used[:gi + 1]
    pts = [P[best[b]] + np.asarray(pivot) for b in used]
    # smooth the edge a little (the bins pick single vertices)
    A = np.asarray(pts)
    if len(A) >= 5:
        ker = np.array([0.25, 0.5, 0.25])
        for ax in (0, 1):
            if closed:
                A[:, ax] = np.convolve(np.r_[A[-1, ax], A[:, ax], A[0, ax]], ker, "valid")
            else:
                A[1:-1, ax] = np.convolve(A[:, ax], ker, "valid")
    return [x for x in A], closed


def wave_ribbons(points, style="slash", k=1.65, ky=1.3, ticks=8, back=False, thick=0.34, closed=False, pivot=PIVOT, floor=0.03,
                 wake=1, echo=0.3, rim=1.0, fly=None, taper_mode="auto", tag="", t_shift=0, travel=False, even=False):
    """A stage slash thrown off one swing (the lead, 2026-10-02: her large slashes are made for her, they "follow
    Crescent Rose's blade and the actual path of each swing"; before, a stage slash was the move's arc drawn again 1.65 /
    4.2 times larger: a flat slab that stayed 0.3 s).

    `points` is the stroke: the outer edge of the move's own BBTAG arc, or the path her blade tip swept (oldest first).
    The crescent leaves the blade there and flies outward from her body (PIVOT), reaching k times as far forward and ky
    times as high in `ticks`, fast at first (ease out). It is a thin ribbon of constant width tapered to a point at both
    ends (a spin's ring keeps its width all round), one ribbon per WAVE_STEP ticks; each glides to the next one's place by
    scale keys about the pivot (fxcompile_ruby: size over lifetime) and fades behind as a short wake. Layers, as her
    trails: dark edge, crimson body (BBTAG's slash stroke, its clean head at the stroke's newest end) and a hot additive
    rim on the outer edge.
    back: the move also hits behind her (5B, Corkscrew): the whole stroke is thrown; else only the part in front of her.
    wake / echo: each ribbon stays `wake` ticks after its step at `echo` of its opacity, fading out. (The first version
    kept 3 ticks at half opacity: three nested crescents at once, which read as the slash drawn three times.)
    rim: the hot outer edge's strength (a heavy finisher's burns hotter than a quick cut's).
    fly (default: for a closed stroke, a spin's ring): the stroke's two ends are thrown as crescents that keep their
    shape and fly apart, instead of the whole stroke stretching about her. (A ring stretched 4-7 times sideways was a
    hollow hoop 10 u wide, and Guillotine's across-the-screen slash a line along the floor: preview 2026-10-02.)
    even: the stroke opens the same above and below the pivot (a ring round its own centre)."""
    tex_body, tex_edge, tex_glow = TEX[style]
    c = np.asarray(pivot, float)
    d = np.asarray(points, float) - c
    if len(d) < 4: return []
    if travel: closed, fly = False, False          # a projectile: the stroke's front part, one crescent that flies on
    if not back and not closed:
        keep = d[:, 0] > -0.2 * np.hypot(d[:, 0], d[:, 1])
        if keep.sum() < 4: return []
        i0, i1 = np.nonzero(keep)[0][[0, -1]]
        d = d[i0:i1 + 1]
    if closed: d = np.r_[d, d[:1]]
    seg = np.r_[0.0, np.cumsum(np.hypot(*np.diff(d, axis=0).T))]
    if seg[-1] < 0.5: return []
    m = int(max(8, min(36 if k <= 5 else 56, round(seg[-1] / 0.16 * (1.0 if k <= 5 else 1.6)))))   # a far-flying one: finer
    sarc = np.linspace(0.0, seg[-1], m)
    d = np.stack([np.interp(sarc, seg, d[:, 0]), np.interp(sarc, seg, d[:, 1])], 1)
    u = sarc / seg[-1]                                          # 0 the oldest end, 1 the newest (the stroke's head)
    fly = closed if fly is None else fly
    xref = 1.0
    if fly and taper_mode == "ends":
        # a made shape (one crescent, already on its side of her): pointed at both ends, thrown out whole
        taper = np.clip(np.sin(np.pi * np.clip(u * 0.94 + 0.03, 0, 1)), 0.0, 1.0) ** 0.7
        xref = float(np.abs(d[:, 0]).mean())
    elif fly:
        # only the stroke's far ends: the part beyond 45 % of its reach to each side, tapering in from there
        ax_ = np.abs(d[:, 0]); mx_ = max(float(ax_.max()), 1e-6)
        taper = np.clip((ax_ / mx_ - 0.45) / 0.55, 0.0, 1.0) ** 1.2
        if taper.sum() < 1e-3: return []
        xref = float(np.average(ax_, weights=np.maximum(taper, 1e-3)))
    else:
        taper = np.clip(np.sin(np.pi * np.clip(u * 0.94 + 0.03, 0, 1)), 0.0, 1.0) ** 0.7
    nfr = max(2, int(round(ticks / WAVE_STEP)))
    lowest = floor - c[1]
    if not fly and WAVE_SMOOTH:
        return _wave_smooth(d, u, taper, k, ky, ticks, thick, lowest, rim, c, tex_body, tex_edge, tag, t_shift, travel, even)
    parts = []
    for j in range(nfr):
        e0, e1 = _ease_out(j / nfr), _ease_out((j + 1) / nfr)
        def grow(e):
            return 1.0 + (k - 1.0) * e, 1.0 + (ky - 1.0) * e
        sx0, sy0 = grow(e0); sx1, sy1 = grow(e1)
        if fly:
            # each end keeps its shape and is carried outward; inside a step it glides by a scale about her that moves
            # its middle the same distance (the small stretch that comes with it is gone at the next step)
            s0_, s1_ = (k - 1.0) * xref * e0, (k - 1.0) * xref * e1
            O = np.stack([d[:, 0] + np.sign(d[:, 0]) * s0_, np.where(d[:, 1] > 0, d[:, 1] * sy0, d[:, 1])], 1)
            sx0, sx1 = xref + s0_, xref + s1_
            base_ = d
        else:
            O = np.stack([d[:, 0] * sx0, np.where(d[:, 1] > 0, d[:, 1] * sy0, d[:, 1])], 1)   # below her body it only flies out
            base_ = O
        O[:, 1] = np.maximum(O[:, 1], lowest)
        rl = np.hypot(base_[:, 0], base_[:, 1]); rl[rl < 1e-6] = 1.0
        nrm = base_ / rl[:, None]                                                        # outward from the pivot
        w = thick * (1.0 + 0.5 * e0) * taper
        verts, uv, alpha, tris = [], [], [], []
        for r in range(m):
            for q in range(WAVE_ROWS):
                fq = q / (WAVE_ROWS - 1)                                                 # 0 inner edge, 1 outer edge
                pt = O[r] - nrm[r] * w[r] * (1.0 - fq)
                verts.append([float(pt[0]), float(max(pt[1], lowest))])
                uv.append([0.52 + 0.45 * float(u[r]), fq])
                alpha.append(float(min(1.0, taper[r] * 1.6)))
        for r in range(m - 1):
            for q in range(WAVE_ROWS - 1):
                a0 = r * WAVE_ROWS + q; a1 = a0 + 1; b0 = a0 + WAVE_ROWS; b1 = b0 + 1
                tris += [[a0, b0, a1], [a1, b0, b1]]
        t0 = t_shift + j * WAVE_STEP; t1 = t0 + WAVE_STEP - 1
        a_lo = 1.0 if e0 < 0.5 else max(0.0, 1.0 - (e0 - 0.5) / 0.5)                     # full for the first half of the flight
        a_hi = 1.0 if e1 < 0.5 else max(0.0, 1.0 - (e1 - 0.5) / 0.5)
        scale = [[t0, 1.0, 1.0], [t1 + 1, sx1 / sx0, sy1 / sy0], [t1 + 1 + wake, sx1 / sx0, sy1 / sy0]]
        fade = [[t0, a_lo], [t1 + 0.9, a_hi], [t1 + 1, a_hi * echo], [t1 + 1 + wake, 0.0]]
        for role, tex, blend in (("edge", tex_edge, "alpha"), ("body", tex_body, "alpha"), ("core", tex_body, "add")):
            if not tex: continue
            al = alpha
            if role == "core":                                                           # the hot rim: the outer part
                al = [min(1.0, rim * a_ * (max(0.0, (x[1] - 0.5) / 0.5) ** 1.3)) for a_, x in zip(alpha, uv)]
            parts.append(dict(key="wave%s_%d/%s" % (tag, j, role), state="wave", layer=role, texture=tex, role=role, blend=blend,
                              t0=t0, t1=t1 + wake, origin=(float(c[0]), float(c[1])), verts=[list(v) for v in verts],
                              uv=[list(x) for x in uv], alpha=list(al), tris=tris, uscroll=[[t0, 0.0]], vscroll=[[t0, 0.0]],
                              fade=[list(x) for x in fade], scale=[list(x) for x in scale], rot=[], tint=[1.0, 1.0, 1.0]))
    return parts


WAVE_SMOOTH = True       # one ribbon per stage slash, flown by its size curve (_wave_smooth); False: the 2-tick steps


def _wave_smooth(d, u, taper, k, ky, ticks, thick, lowest, rim, c, tex_body, tex_edge, tag="", t_shift=0, travel=False, even=False):
    """A stage slash as ONE ribbon (2026-10-02: the stepped flight, a new ribbon every 2 ticks with a 30 % ghost at each
    step, read as "choppy" and "cut up" in game). The crescent is built where it ends its flight (the stroke scaled k
    forward, ky upward about her body, its width growing to 1.5 x thick), drawn at 1/k, 1/ky of that and grown back to
    full size by its size-over-lifetime curve (ease out), which the particle evaluates every rendered frame: it leaves the
    blade thin and opens as it flies. (Below her body the flight only widens it: those points are placed at y / ky so the
    floor clamp holds at the end; they start a little high and settle.) The stroke wipes along itself as it goes (the
    texture slides toward the head, eating in from the tail) and fades over the second half, no step and no ghost.
    Layers: dark edge, crimson body, hot outer rim; the #trail texture clones (transparent past the head)."""
    m = len(d)
    O = np.stack([d[:, 0] * k, d[:, 1] * ky if even else np.where(d[:, 1] > 0, d[:, 1] * ky, d[:, 1])], 1)
    O[:, 1] = np.maximum(O[:, 1], lowest)
    rl = np.hypot(O[:, 0], O[:, 1]); rl[rl < 1e-6] = 1.0
    nrm = O / rl[:, None]
    w = thick * 2.6 * taper                                                  # (x1.5 before rrb_slash: its streak fills ~1/3)
    verts, uv, alpha, tris = [], [], [], []
    for r in range(m):
        for q in range(WAVE_ROWS):
            fq = q / (WAVE_ROWS - 1)                                           # 0 inner edge, 1 outer edge
            pt = O[r] - nrm[r] * w[r] * (1.0 - fq)
            pt = np.array([pt[0], max(pt[1], lowest)])
            verts.append([float(pt[0]), float(pt[1])])                        # the end of the flight (size curve: 1/k -> 1)
            uv.append([round(TRAIL_HEAD * float(u[r]), 5), fq])
            alpha.append(float(min(1.0, taper[r] * 1.6)))
    for r in range(m - 1):
        for q in range(WAVE_ROWS - 1):
            a0 = r * WAVE_ROWS + q; a1 = a0 + 1; b0 = a0 + WAVE_ROWS; b1 = b0 + 1
            tris += [[a0, b0, a1], [a1, b0, b1]]
    t0 = int(t_shift); T = int(ticks); t1 = t0 + T + 2
    xs = [0.0, 0.15, 0.3, 0.5, 0.75, 1.0]
    scale = [[t0 + x * T, (1.0 + (k - 1.0) * _ease_out(x)) / k, (1.0 + (ky - 1.0) * _ease_out(x)) / ky] for x in xs] + [[t1, 1.0, 1.0]]
    if travel:                         # a projectile keeps its size: its bullet carries it (rrb_power.bullets, stage 3)
        scale = []
    fade = [[t0, 0.85], [t0 + 1, 1.0], [t0 + 0.45 * T, 1.0], [t0 + 0.75 * T, 0.5], [t0 + T, 0.12], [t1, 0.0]]
    uscroll = [[t0, -0.06], [t0 + 0.4 * T, 0.04], [t1, 0.32]]                 # the wipe: head in, then the tail eats in
    parts = []
    for role, tex, blend in (("edge", tex_edge, "alpha"), ("body", tex_body, "alpha"), ("core", tex_body, "add")):
        if not tex: continue
        al = alpha
        if role == "core":                                                     # the hot rim: the outer part
            al = [min(1.0, rim * a_ * (max(0.0, (x[1] - 0.5) / 0.5) ** 1.3)) for a_, x in zip(alpha, uv)]
        fk = fade if role != "core" else [[t0, 1.0], [t0 + 0.35 * T, 1.0], [t0 + 0.7 * T, 0.2], [t0 + T, 0.0], [t1, 0.0]]
        parts.append(dict(key="wave%s/%s" % (tag, role), state="wave", layer=role, texture=tex + "#trail", role=role, blend=blend,
                          t0=t0, t1=t1, origin=(float(c[0]), float(c[1])), verts=[list(v) for v in verts],
                          uv=[list(x) for x in uv], alpha=list(al), tris=tris, uscroll=[list(x) for x in uscroll],
                          vscroll=[[t0, 0.0]], fade=[list(x) for x in fk], scale=[list(x) for x in scale], rot=[],
                          tint=[1.0, 1.0, 1.0], smooth=True))
    return parts


def wave_from_plan(assets, o, arc_parts=None):
    """fxcompile_ruby: the parts of a planned stage wave {"frames", "state", "style", "k", "ky", "ticks", "upto", "back"}.
    arc_parts: the compiled parts of the move's BBTAG arc ("state"), when it has one: its outer edge is the stroke; else
    the path her blade tip swept over "frames"."""
    common = dict(style=o.get("style", "slash"), thick=o.get("thick", 0.34), wake=o.get("wake", 1), echo=o.get("echo", 0.3),
                  rim=o.get("rim", 1.0), ticks=o.get("ticks", 8))
    if o.get("shape") == "arc":
        # a made stroke: an arc about her body (PIVOT) of radius r, from angle a0 to a1 (degrees, 0 = ahead of her, 90 =
        # up), oldest end first: for a swing whose blade can't be read off her frames (j.2A's downward cut)
        r_, a0, a1 = o.get("radius", 1.6), math.radians(o.get("a0", 40.0)), math.radians(o.get("a1", -120.0))
        th = np.linspace(a0, a1, 28)
        pts_ = np.stack([PIVOT[0] + r_ * np.cos(th), PIVOT[1] + r_ * np.sin(th)], 1)
        return wave_ribbons(pts_, k=o.get("k", 1.65), ky=o.get("ky", 1.3), back=o.get("back", True), floor=o.get("floor", 0.03),
                            travel=bool(o.get("travel")), **common)
    if o.get("shape") == "ring":
        # a made stroke round the effect's own origin: from a0 through `turn` degrees (negative: clockwise, the way her
        # forward spin turns when she faces right), opening evenly to k times its radius (Buzzsaw's turn)
        a0 = math.radians(o.get("a0", 150.0)); th = np.linspace(a0, a0 + math.radians(o.get("turn", -330.0)), 44)
        pts_ = o.get("radius", 1.0) * np.stack([np.cos(th), np.sin(th)], 1)
        return wave_ribbons(pts_, k=o.get("k", 1.2), ky=o.get("k", 1.2), back=True, fly=False, pivot=(0.0, 0.0), floor=-99.0,
                            even=True, **common)
    if o.get("shape") == "stand":
        # two standing crescents, ) in front of her and ( behind, floor to `height`, thrown out to both sides: a blade's
        # edge crossing the screen (Guillotine's stage 3 finishing slash)
        t = np.linspace(0.0, 1.0, 26)
        right = np.stack([o.get("x0", 1.0) + o.get("bulge", 0.7) * np.sin(np.pi * t), 0.05 + o.get("height", 2.8) * t], 1)
        out = []
        for tag, pts_ in (("r", right), ("l", right * np.array([-1.0, 1.0]))):
            out += wave_ribbons(pts_, k=o.get("k", 8.0), ky=1.0, back=True, fly=True, taper_mode="ends", tag=tag, **common)
        return out
    if o.get("shape") == "cuts":
        # a flurry of crossing cuts about the hit point (a hit effect: Red Reaper's strikes on her target): each a thin
        # crescent that opens a little and is gone, one after another
        out = []
        L, bulge = o.get("length", 3.2), o.get("bulge", 0.45)
        t = np.linspace(0.0, 1.0, 22)
        base = np.stack([(t - 0.5) * L, bulge * np.sin(np.pi * t) - bulge * 0.5], 1)
        for i, ang in enumerate(o.get("angles", (35.0, -30.0, 82.0))):
            a_ = math.radians(ang); R_ = np.array([[math.cos(a_), -math.sin(a_)], [math.sin(a_), math.cos(a_)]])
            out += wave_ribbons((R_ @ base.T).T, k=o.get("k", 1.3), ky=o.get("k", 1.3), back=True, fly=False, pivot=(0.0, 0.0), floor=-99.0,
                                tag="c%d" % i, t_shift=i * o.get("gap", 2), **common)
        return out
    pts, closed = [], False
    if arc_parts:
        pts, closed = stroke_from_parts(arc_parts)
    if len(pts) < 4:
        sw = []
        for t, s in o.get("frames") or []:
            b = blade(assets, s)
            if b is not None: sw.append((t, b[0]))
        sw = oriented(sw)
        if len(sw) >= 2: pts, closed = stroke_from_swing(sw, o.get("upto"), o.get("max_turn")), False
    if len(pts) < 4: return []
    return wave_ribbons(pts, o.get("style", "slash"), k=o.get("k", 1.65), ky=o.get("ky", 1.3), ticks=o.get("ticks", 8),
                        back=o.get("back", False), thick=o.get("thick", 0.34), closed=closed, wake=o.get("wake", 1),
                        echo=o.get("echo", 0.3), rim=o.get("rim", 1.0), fly=o.get("fly"), floor=o.get("floor", 0.03),
                        travel=bool(o.get("travel")))


def plan_swings(assets, frames, style):
    """-> [(start tick, {"frames": [[tick rel, sprite], ...], "style": style})]: one trail effect per swing, for
    fxcompile_ruby (frame names and ticks only: the geometry is rebuilt from the player's install at import)"""
    names = {round(t, 4): s for t, s in frames}
    out = []
    for sw in swings(assets, frames):
        t0 = sw[1][0]
        fr = [[round(t - t0, 4), names[round(t, 4)]] for t, _ in sw]
        # smooth trails (swing_ribbon): the effect is spawned `lead` ticks before the first moving frame
        out.append((t0, {"frames": fr, "style": style, "lead": round(min(TRAIL_LEAD, t0 - sw[0][0]), 3)}))
    return out


def parts_from_plan(assets, o):
    """fxcompile_ruby: the parts of a planned trail {"frames": [[tick rel, sprite], ...], "style"}"""
    sw = []
    for t, s in o["frames"]:
        b = blade(assets, s)
        if b is not None: sw.append((t, b[0]))
    sw = oriented(sw)
    if len(sw) < 2: return []
    if "lead" in o:
        return swing_ribbon(sw, o.get("style", "slash"), max_turn=o.get("max_turn"), lead=o["lead"], until=o.get("until"))
    return swing_parts(sw, o.get("style", "slash"), max_turn=o.get("max_turn"))


def trail_parts(assets, frames, style="slash", window=(0, 1e9), keep=2, root=None):
    """Parts (bbtag_fxcompile format, ticks relative to the effect's spawn at window[0]) for a scythe trail over
    `frames` [(tick, sprite)]: on each frame where the blade swung (vs the previous frame), a ribbon over the last
    `keep` sweeps, visible until the next frame. root: {tick: (x, y)} her simulated root offset (moving moves)."""
    tex_body, tex_edge, tex_glow = TEX[style]
    fs = [(t, s) for t, s in frames if window[0] - 1e-6 <= t <= window[1] + 1e-6]
    spines = []
    for t, s in fs:
        b = blade(assets, s)
        if b is None: continue
        sp = b[0].copy()
        if root:
            ox, oy = root.get(int(round(t)), (0.0, 0.0)); sp = sp + np.array([ox, oy])
        spines.append((t, sp))
    parts, sweeps = [], []
    t_start = window[0]
    for i in range(1, len(spines)):
        (ta, A), (tb, B) = spines[i - 1], spines[i]
        move = np.linalg.norm(B[-1] - A[-1]); th, _, _ = rigid(A, B)
        if move < MIN_MOVE and abs(math.degrees(th)) < MIN_TURN:
            sweeps = []                      # the blade rested: the trail restarts
            continue
        sweeps.append(sweep(A, B))
        # one ribbon: rows = the in-between spines, oldest first; U 0.52 (tail) -> 0.97 (head), V heel -> tip
        rows = []
        for k_, sw in enumerate(sweeps[-keep:]):
            rows += sw if k_ == 0 else sw[1:]
        nR = len(rows)
        verts, uv, tris = [], [], []
        for r_, row in enumerate(rows):
            u = 0.52 + 0.45 * (r_ / (nR - 1))
            for c_ in range(S):
                verts.append([float(row[c_][0]), float(row[c_][1])]); uv.append([u, c_ / (S - 1)])
        for r_ in range(nR - 1):
            for c_ in range(S - 1):
                a0 = r_ * S + c_; a1 = a0 + 1; b0 = a0 + S; b1 = b0 + 1
                tris += [[a0, b0, a1], [a1, b0, b1]]
        t_next = spines[i + 1][0] if i + 1 < len(spines) else tb + 3
        t0 = int(round(tb - t_start)); t1 = max(t0, int(round(t_next - t_start)) - 1)
        for role, tex in (("body", tex_body), ("edge", tex_edge), ("glow", tex_glow)):
            if not tex: continue
            parts.append(dict(key="trail_%d/%s" % (i, role), state="trail", layer=role, texture=tex, role=role,
                              blend="alpha" if role in ("body", "edge") else "add", t0=t0, t1=t1, origin=(0.0, 0.0),
                              verts=[[x, y, 0.0] for x, y in verts], uv=uv, alpha=[1.0] * len(verts), tris=tris,
                              uscroll=[[t0, 0.0]], vscroll=[[t0, 0.0]], fade=[[t0, 1.0]], scale=[], rot=[], tint=[1.0, 1.0, 1.0]))
    return parts

