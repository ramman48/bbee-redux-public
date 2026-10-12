"""ruby_crescent.py -- Ruby's thrown slash projectile: its shape, its meshes and its hit rectangles from one record, so
what is drawn and what hits cannot drift apart (docs/cross-effect/STAGE_FX_SPEC.md "projectile" and "Hit boxes"; the look
approved by the lead on 2026-10-03, NOTES of that date).

  outline(state, roles) / silhouette(name)   ASW's own outer edge of one of her large arcs, as a unit shape
                                   (fang: rrb203Eff, an upright C; riser: rrb430aEff_5, a rising hook)
  lens(flat)                       the front of a level swing's ring as it is seen, a flat crescent (made, not ASW's)
  crescent(sil, L, W, tilt, at, ground, u_dir)   a full, clean crescent on that outer curve, its inner edge the outer one
                                   moved inward by ONE smooth width curve (thin tail, fat shoulder, pointed head)
  boxes(cres, alpha, speed)        hit rectangles cut from the crescent, slabs across its long axis
  wave_spec(sil, cls, at, tilt, u_dir, ground)   everything one move's projectile needs: class timing, bounds, centre,
                                   floor point, hit rectangles, launch box (data side: rrb_fx, rrb_power)
  wave_meshes(spec)                the four meshes the kit template rrb_slashwave2_<class> takes, in the bullet's frame:
                                   mesh (the crescent), flame (the breathing flame mass, laid across it), fang (the
                                   thorn row on the trailing edge), emit (the even strip the flames leave from)

Build time only: the outer curve is read from the player's own BBTAG install through bbtag_fxcompile; nothing of BBTAG
is shipped (the meshes are made at install, like her scythe arcs)."""

import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
import ruby_arcband as RA
import bbtag_fxcompile as FC

SPAN = 150.0                      # degrees of turn of ASW's edge a projectile keeps (its forward part)
COLS, ROWS = 40, 5
ST_X = 1.2                        # streak_701a_a's _MainTex_ST.x (the body clone keeps it: clones can't change tiling)
RASTER = 0.04                     # u per ink sample
PAD_FRONT, PAD_BACK, PAD_TIP = 0.10, 0.15, 0.10
SHARE_ALL, SHARE_BOX = 0.50, 0.35      # ink share of the unpadded boxes: overall, and per box
SIL = {"fang": ("rrb203Eff", ("body",)), "riser": ("rrb430aEff_5", ("flash",)), "skimmer": ("rrb430bEff_5", ("flash",))}
SIL_WINDOW = {"fang": SPAN, "riser": SPAN, "skimmer": None}       # None: ASW's whole edge (the skimmer: not reviewed yet)
SIL_UPRIGHT = {"fang": True}        # stood on its chord (an upright C) before the move's tilt; the hooks keep ASW's own lie
# the crescent's width along the stroke, tail (0) -> head (1): one smooth curve, thin tail, fat shoulder behind the head,
# pointed head (the lead, 2026-10-02: "full arcs and crescents", "dont make the slashes so wobbly")
TAPER_A, TAPER_B = 1.3, 0.75      # f^A (1 - f)^B: widest at A / (A + B) = 0.63 of the stroke


def taper(f):
    f = np.clip(np.asarray(f, float), 0.0, 1.0)
    fm = TAPER_A / (TAPER_A + TAPER_B)
    return f ** TAPER_A * (1.0 - f) ** TAPER_B / (fm ** TAPER_A * (1.0 - fm) ** TAPER_B)


def outline(state, roles=("body",)):
    """ASW's ribbon for this arc, from its own mesh: its edge rows (the extremes of the ribbon's v), ordered along the
    stroke (u), resampled and lightly smoothed; the longer one is the outer edge. (Binning by angle about the object's
    origin, as bands do, fails on the 430 hooks: their origin is not inside the curve.)"""
    r = FC.compile_state(state)
    parts = [p for p in r["parts"] if p["role"] in roles]
    if not parts: raise SystemExit("ruby_crescent: %s has no %s part" % (state, roles))
    p = max(parts, key=lambda q: len(q["verts"]))                  # the full smear (ASW swaps a growing / shrinking set)
    V = np.asarray(p["verts"], float); T = np.asarray(p["uv"], float)
    rows = []
    for m in (T[:, 1] <= T[:, 1].min() + 0.01, T[:, 1] >= T[:, 1].max() - 0.01):
        o = np.argsort(T[m, 0]); rows.append((T[m, 0][o], V[m][o]))
    E = []
    for ru, rv in rows:
        u = np.linspace(ru[0], ru[-1], 161)
        P = np.column_stack([np.interp(u, ru, rv[:, 0]), np.interp(u, ru, rv[:, 1])])
        P[:, 0] = RA._smooth(P[:, 0], 3); P[:, 1] = RA._smooth(P[:, 1], 3)
        E.append(P)
    def length(P): return float(np.hypot(np.diff(P[:, 0]), np.diff(P[:, 1])).sum())
    outer = E[0] if length(E[0]) >= length(E[1]) else E[1]
    return dict(state=state, key=p["key"], outer=outer, pivot=np.asarray(p["origin"], float), centre=_ellipse_centre(outer))


def _ellipse_centre(P):
    """the centre of the ellipse through points (Fitzgibbon's direct least-squares fit), or None when they are no ellipse"""
    x, y = P[:, 0], P[:, 1]
    mx, my = x.mean(), y.mean(); sc = max(1e-6, float(np.hypot(x - mx, y - my).max()))
    X = (x - mx) / sc; Y = (y - my) / sc
    D1 = np.column_stack([X * X, X * Y, Y * Y]); D2 = np.column_stack([X, Y, np.ones_like(X)])
    S1, S2, S3 = D1.T @ D1, D1.T @ D2, D2.T @ D2
    try:
        T = -np.linalg.solve(S3, S2.T)
        M = S1 + S2 @ T
        M = np.array([M[2] / 2.0, -M[1], M[0] / 2.0])
        w, v = np.linalg.eig(M); v = np.real(v)
        cond = 4 * v[0] * v[2] - v[1] ** 2
        if not (cond > 0).any(): return None
        a1 = v[:, np.argmax(cond)]
    except np.linalg.LinAlgError:
        return None
    A, B, C = a1; D, E, F = T @ a1
    den = 4 * A * C - B * B
    if den <= 1e-12: return None
    cx = (B * E - 2 * C * D) / den; cy = (B * D - 2 * A * E) / den
    return np.array([cx * sc + mx, cy * sc + my])


_sil = {}
def silhouette(name, span="auto"):
    """ASW's outer edge for this silhouette as a unit shape: the stretch whose tangent turns `span` degrees, centred on the
    edge's forward-most point (a C turning less than that is kept whole; a tight hook is cut where it has turned span / 2);
    span None keeps the whole edge. -> outer (n x 2, tip-to-tip chord 1, the chord's middle at the origin, in ASW's own
    orientation), s (n, 0..1 along it). Only the outer curve is ASW's; the width is taper()."""
    if span == "auto": span = SIL_WINDOW.get(name, SPAN)
    if (name, span) in _sil: return _sil[(name, span)]
    state, roles = SIL[name]
    ol = outline(state, roles); O = ol["outer"]
    Tn = np.gradient(O, axis=0); th = np.unwrap(np.arctan2(Tn[:, 1], Tn[:, 0]))
    i0, i1 = 0, len(O) - 1
    if span is not None:
        k = int(np.argmax(O[:, 0])); half = math.radians(span) / 2.0
        m = np.abs(th - th[k]) <= half
        i0 = i1 = k
        while i0 > 0 and m[i0 - 1]: i0 -= 1
        while i1 < len(O) - 1 and m[i1 + 1]: i1 += 1
    O = O[i0:i1 + 1]
    chord = float(np.linalg.norm(O[-1] - O[0])); mid = 0.5 * (O[0] + O[-1])
    O = (O - mid) / chord
    cen = None if ol["centre"] is None else (ol["centre"] - mid) / chord
    if SIL_UPRIGHT.get(name):                                      # turn the chord vertical, the bulge forward
        ch = O[-1] - O[0]; ang = 90.0 - math.degrees(math.atan2(ch[1], ch[0]))
        if abs(ang) > 90.0: ang -= 180.0 * np.sign(ang)
        O = _rot(O, ang)
        if cen is not None: cen = _rot(cen[None, :], ang)[0]
    seg = np.r_[0.0, np.cumsum(np.hypot(np.diff(O[:, 0]), np.diff(O[:, 1])))]
    _sil[(name, span)] = dict(name=name, state=state, outer=O, centre=cen, s=seg / seg[-1], arc=float(seg[-1]),
                              turn=float(math.degrees(abs(th[i1] - th[i0]))), aspect=float(np.ptp(O[:, 0]) / max(1e-6, np.ptp(O[:, 1]))))
    return _sil[(name, span)]


LENS_SPAN = 92.0                  # degrees of the ring kept to each side of its nose
LENS_TAPER = 0.7                  # its width round the ring: cos(angle from the nose) ^ this, a point at each arm's end
LENS_FLAT = 0.28                  # the ring's short axis / long axis when a move names none
LENS_LEN = 0.74                   # its depth, nose to arm ends, x the class length


def lens(flat=None):
    """A level swing is a ring seen from the side: an ellipse. Its forward part as a unit shape, depth 1, nose at +x,
    with the ring's centre, so crescent() makes the inner edge a smaller ring about it. -> as silhouette()"""
    flat = LENS_FLAT if flat is None else float(flat)
    if ("lens", flat) in _sil: return _sil[("lens", flat)]
    ph = np.radians(np.linspace(-LENS_SPAN, LENS_SPAN, 161))
    depth = 1.0 - math.cos(math.radians(LENS_SPAN))
    O = np.column_stack([np.cos(ph), flat * np.sin(ph)]) / depth
    seg = np.r_[0.0, np.cumsum(np.hypot(np.diff(O[:, 0]), np.diff(O[:, 1])))]
    width = np.cos(0.5 * np.pi * np.linspace(-1.0, 1.0, len(ph))) ** LENS_TAPER
    # cols: samples at equal steps of the ring's angle, so the tight nose gets most of them
    _sil[("lens", flat)] = dict(name="lens", state=None, outer=O, centre=np.zeros(2), s=seg / seg[-1], arc=float(seg[-1]),
                                turn=2.0 * LENS_SPAN, aspect=float(np.ptp(O[:, 0]) / max(1e-6, np.ptp(O[:, 1]))), flat=flat,
                                width=width, cols=np.interp(np.linspace(0.0, 1.0, COLS), np.linspace(0.0, 1.0, len(ph)), seg / seg[-1]))
    return _sil[("lens", flat)]


def _rot(P, deg):
    t = math.radians(deg); R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
    return P @ R.T


def _flips(A, B):
    """triangles of the strip between polylines A and B whose winding differs from the majority"""
    sg = []
    for c in range(len(A) - 1):
        for (p, q, r_) in ((A[c], A[c + 1], B[c]), (B[c], A[c + 1], B[c + 1])):
            sg.append((q[0] - p[0]) * (r_[1] - p[1]) - (q[1] - p[1]) * (r_[0] - p[0]))
    sg = np.asarray(sg); sg = sg[np.abs(sg) > 1e-7]
    return int(min((sg > 0).sum(), (sg < 0).sum()))


def _grid(A, B, rows, u):
    verts, uv, tris = [], [], []
    for c in range(len(A)):
        for q in range(rows):
            f = q / (rows - 1); p = A[c] + (B[c] - A[c]) * f
            verts.append([round(float(p[0]), 5), round(float(p[1]), 5)]); uv.append([round(float(u[c]), 5), round(f, 5)])
    for c in range(len(A) - 1):
        for q in range(rows - 1):
            a0 = c * rows + q; a1 = a0 + 1; b0 = a0 + rows; b1 = b0 + 1
            tris += [[a0, b0, a1], [a1, b0, b1]]
    return dict(verts=verts, uv=uv, tris=tris)


CHORD_K = 0.78                    # the inner edge stays this share of the way from the outer edge to the chord at most


def _smin(a, b, p=3.0):
    a = np.maximum(np.asarray(a, float), 1e-9); b = np.maximum(np.asarray(b, float), 1e-9)
    return (a ** -p + b ** -p) ** (-1.0 / p)


def _circle_centre(P):
    """least-squares circle through points -> its centre"""
    A = np.column_stack([2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]); y = (P ** 2).sum(1)
    c = np.linalg.lstsq(A, y, rcond=None)[0]
    return c[:2]


def crescent(sil, L, W, tilt=0.0, at=(0.0, 1.0), ground=False, u_dir=1, flat=None):
    """sil: a silhouette name ("lens" with its `flat`: L is then its depth). L: tip to tip (u). W: its widest (u), reduced where ASW's arc is too shallow for it (see
    CHORD_K). tilt: degrees counter-clockwise from ASW's own. at: where the leading edge's forward-most point goes (x)
    and the shape's centre height (y); ground: lift it so nothing is below the floor (a tall shape's lower tip touches
    it). u_dir: +1 the head (U 1: the pointed end with the shoulder behind it) is the upper tip, -1 the lower.
    The shape: ASW's outer curve; the inner edge = the outer one moved inward by t(s) = smooth-min(W taper(s), CHORD_K x
    the distance to the chord), so both tips are points, the middle is fat and the inner edge is concave like the outer
    (a crescent; past the chord it would be a leaf). The direction inward is the edge's own normal, turning toward one
    interior centre where the edge curls tighter than the width (straight normals would cross there)."""
    S = sil if not isinstance(sil, str) else lens(flat) if sil == "lens" else silhouette(sil)
    s = np.asarray(S["cols"], float) if "cols" in S else np.linspace(0.0, 1.0, COLS)
    O = np.column_stack([np.interp(s, S["s"], S["outer"][:, 0]), np.interp(s, S["s"], S["outer"][:, 1])]) * L
    ecen = None if S.get("centre") is None else np.asarray(S["centre"], float)[None, :] * L
    if tilt:
        O = _rot(O, tilt)
        if ecen is not None: ecen = _rot(ecen, tilt)
    if (O[-1][1] - O[0][1]) * u_dir < 0: O = O[::-1].copy()        # index 0 = the tail tip, -1 = the head tip
    tp = np.interp(s, S["s"], S["width"]) if "width" in S else taper(s)      # (the lens: the same at both arms)
    T = np.gradient(O, axis=0); ds = np.linalg.norm(T, axis=1); T /= np.maximum(1e-9, ds)[:, None]
    N = np.column_stack([-T[:, 1], T[:, 0]])
    k = int(np.argmax(O[:, 0])); mid = 0.5 * (O[0] + O[-1])
    if ((mid - O[k]) @ N[k]) < 0: N = -N                           # inward: toward the chord from the forward-most point
    N[:, 0] = RA._smooth(N[:, 0], 4); N[:, 1] = RA._smooth(N[:, 1], 4); N /= np.maximum(1e-9, np.linalg.norm(N, axis=1))[:, None]
    th = np.unwrap(np.arctan2(T[:, 1], T[:, 0])); kappa = np.abs(np.gradient(th)) / np.maximum(1e-9, ds)      # curvature, 1 / u
    cen = ecen[0] if ecen is not None else _circle_centre(O)           # the ring's centre (ASW's edge is a circle in perspective)
    if np.linalg.norm(cen - mid) > 3.0 * L or ((cen - O[k]) @ N[k]) < 0: cen = mid + (mid - O[k]) * 0.25      # (a near-straight edge)
    R = cen - O; rl = np.linalg.norm(R, axis=1); R /= np.maximum(1e-9, rl)[:, None]
    ch = (O[-1] - O[0]) / np.linalg.norm(O[-1] - O[0]); cn = np.array([-ch[1], ch[0]])
    # one rule for the whole shape, so the inner edge has no joint: a shallow arc is offset along its own normals; a hook,
    # whose nose curls tighter than the width, along rays to one interior centre (its inner edge is then a smaller copy
    # of the outer one about that centre, as ASW's rings are)
    hook = "width" in S or bool((W * tp * kappa).max() > 0.6)
    for radial in ((True,) if hook else (False, True)):
        D = R.copy() if radial else N.copy()
        # distance along D from the outer edge to the chord line (far when D runs along it or away from it)
        den = D @ cn; num = (O[0] - O) @ cn
        t_ch = np.where(np.abs(den) > 1e-6, num / np.where(np.abs(den) > 1e-6, den, 1.0), 1e6)
        t_ch = np.where(t_ch > 0, t_ch, 1e6)
        t = _smin(_smin(W * tp, CHORD_K * t_ch), 0.8 * rl); t[0] = t[-1] = 0.0
        I = O + D * t[:, None]
        tb = 0.30 * t                                              # the flame mass reaches 0.30 of the local width further back
        if _flips(O, I) == 0 and _flips(I, I + D * tb[:, None]) == 0: break
    P = np.concatenate([O, I])
    dx = at[0] - float(O[:, 0].max()); dy = at[1] - 0.5 * float(P[:, 1].min() + P[:, 1].max())
    if ground: dy = max(dy, -float(P[:, 1].min()))
    if ground and np.ptp(P[:, 1]) > np.ptp(P[:, 0]): dy = -float(P[:, 1].min())      # a tall ground shape stands on the floor
    O = O + [dx, dy]; I = I + [dx, dy]
    # U along the middle line, 0 -> 1 / ST_X: the body's texture (cut to its ink box) runs tip to tip at Custom1.x 0
    M = 0.5 * (O + I)
    seg = np.r_[0.0, np.cumsum(np.hypot(np.diff(M[:, 0]), np.diff(M[:, 1])))]
    U = seg / seg[-1] / ST_X
    mesh = _grid(I, O, ROWS, U)                                   # V 0 trailing (inner) -> 1 leading (outer)
    back_pt = I + D * tb[:, None]
    if ground: back_pt[:, 1] = np.maximum(back_pt[:, 1], 0.0)
    strip = _grid(I, I + (O - I) * 0.18, 2, s)                    # the trailing edge: the emitter of tongues and streaks
    back = _grid(back_pt, O, ROWS, s)                             # its own 0..1 UV (a Flame mask, not the stroke)
    wd = np.linalg.norm(O - I, axis=1)
    return dict(sil=S["name"], L=L, W=W, tilt=tilt, mesh=mesh, strip=strip, back=back, outer=O, inner=I, width=wd, widest=float(wd.max()),
                lean=1.0 if radial else 0.0, hook=hook, bounds=[float(P[:, 0].min() + dx), float(P[:, 1].min() + dy), float(P[:, 0].max() + dx), float(P[:, 1].max() + dy)],
                centre=[float(M[:, 0].mean()), float(M[:, 1].mean())], floor=[float(M[:, 0].mean()), 0.0] if ground else None,
                head=[float(O[-1][0]), float(O[-1][1])], tail=[float(O[0][0]), float(O[0][1])], u1=1.0 / ST_X)


def ink(cres, alpha, held=0.0, raster=RASTER):
    """alpha: the body texture's alpha (H x W, row 0 = the top = V 1). -> (mask of ink >= 0.5, x0, y0, raster)"""
    V = np.asarray(cres["mesh"]["verts"]); T = np.asarray(cres["mesh"]["uv"]); F = np.asarray(cres["mesh"]["tris"])
    x0, y0 = V[:, 0].min() - raster, V[:, 1].min() - raster
    nx = int(math.ceil((V[:, 0].max() - x0) / raster)) + 2; ny = int(math.ceil((V[:, 1].max() - y0) / raster)) + 2
    mask = np.zeros((ny, nx), bool)
    H, W = alpha.shape
    gx = x0 + (np.arange(nx) + 0.5) * raster; gy = y0 + (np.arange(ny) + 0.5) * raster
    for a, b, c in F:
        A, B, C = V[a], V[b], V[c]
        den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
        if abs(den) < 1e-12: continue
        ix0 = max(0, int((min(A[0], B[0], C[0]) - x0) / raster) - 1); ix1 = min(nx, int((max(A[0], B[0], C[0]) - x0) / raster) + 2)
        iy0 = max(0, int((min(A[1], B[1], C[1]) - y0) / raster) - 1); iy1 = min(ny, int((max(A[1], B[1], C[1]) - y0) / raster) + 2)
        X, Y = np.meshgrid(gx[ix0:ix1], gy[iy0:iy1])
        l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den
        l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den
        l3 = 1 - l1 - l2
        inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
        if not inside.any(): continue
        u = (l1 * T[a][0] + l2 * T[b][0] + l3 * T[c][0] + held) * ST_X
        v = l1 * T[a][1] + l2 * T[b][1] + l3 * T[c][1]
        px = np.clip((u * W - 0.5).round().astype(int), 0, W - 1); py = np.clip(((1.0 - v) * H - 0.5).round().astype(int), 0, H - 1)
        on = inside & (u >= 0) & (u <= 1) & (alpha[py, px] >= 0.5)
        mask[iy0:iy1, ix0:ix1] |= on
    return mask, float(x0), float(y0), raster


def boxes(cres, alpha, speed, held=0.0):
    """-> dict(rects [[x0, y0, x1, y1]] in the bullet frame, shares per box (ink / unpadded box), overall, n, axis, ...)"""
    mask, x0, y0, r = ink(cres, alpha, held)
    ys, xs = np.nonzero(mask)
    if len(xs) == 0: raise SystemExit("ruby_crescent: no ink")
    X = x0 + (xs + 0.5) * r; Y = y0 + (ys + 0.5) * r
    tall = np.ptp(Y) >= np.ptp(X)
    min_w = speed / 60.0 + 0.35
    A_, B_ = (Y, X) if tall else (X, Y)                      # A_: along the long axis (slabs), B_: across
    lo, hi = float(A_.min()) - r / 2, float(A_.max()) + r / 2 + 1e-6
    best, tried = None, []
    for N in range(4, 8):
        rects, shares, ink_a, box_a = [], [], 0.0, 0.0
        for i in range(N):
            a, b = lo + (hi - lo) * i / N, lo + (hi - lo) * (i + 1) / N
            m = (A_ >= a) & (A_ < b)
            if not m.any(): continue
            c0, c1 = float(B_[m].min()) - r / 2, float(B_[m].max()) + r / 2
            area = max(1e-9, (c1 - c0) * (b - a)); shares.append(float(m.sum() * r * r / area))
            ink_a += m.sum() * r * r; box_a += area
            if tall:                                          # horizontal slabs: x padded front / back, the end slabs past the tips
                rx0, rx1 = c0 - PAD_BACK, c1 + PAD_FRONT
                if rx1 - rx0 < min_w: rx0 = rx1 - min_w
                rects.append([rx0, a - (PAD_TIP if i == 0 else 0.0), rx1, b + (PAD_TIP if i == N - 1 else 0.0)])
            else:                                             # vertical slabs: the last slab is the front
                rx0, rx1 = a - (PAD_BACK if i == 0 else 0.0), b + (PAD_FRONT if i == N - 1 else 0.0)
                if rx1 - rx0 < min_w: rx0 = rx1 - min_w
                rects.append([rx0, c0 - PAD_TIP, rx1, c1 + PAD_TIP])
        inside = np.zeros(len(X), bool)
        for q in rects: inside |= (X >= q[0]) & (X <= q[2]) & (Y >= q[1]) & (Y <= q[3])
        cand = (rects, shares, float(ink_a / box_a), N, "y" if tall else "x", float(inside.mean()))
        tried.append((N, round(cand[2], 3), round(min(shares), 3)))
        if cand[2] >= SHARE_ALL and min(shares) >= SHARE_BOX: best = cand; break
        # no count meets both (a pointed tip fills at most half its slab, and no box is thinner than a 60 Hz step plus a
        # thin enemy): the count with the best overall share
        if best is None or cand[2] > best[2]: best = cand
    rects, shares, overall, N, axis, covered = best
    return dict(rects=[[round(v, 3) for v in q] for q in rects], shares=[round(s, 3) for s in shares], overall=round(overall, 3), n=N,
                axis=axis, ink_inside=round(covered, 4), min_width=round(min_w, 3), ok=bool(overall >= SHARE_ALL and min(shares) >= SHARE_BOX), tried=tried,
                ink_bounds=[float(X.min() - r / 2), float(Y.min() - r / 2), float(X.max() + r / 2), float(Y.max() + r / 2)],
                ink_area=round(float(len(X) * r * r), 3))


# ---------------------------------------------------------------------------------------------------- the roll-out
# class timing (STAGE_FX_SPEC): length tip to tip, cruise speed, flight; 6 u/s for the first 0.08 s, the hit window from
# 2 ticks in to the flight's last tick (the body is whole until its break starts: rrb_power.wave_boxes)
WAVE_CLASS = {"quick": dict(L=3.6, v1=26.0, flight=0.65, tag="q"), "sweep": dict(L=4.6, v1=24.0, flight=0.90, tag="s"),
              "heavy": dict(L=5.6, v1=24.0, flight=0.95, tag="h")}
# (0.9.0; a tester, 2026-10-07: the slashes are "too dense and cluttered". The body was 0.27 / 0.24 x L at its widest, the
#  wake 0.31 x L deep and the thorn row at full depth: a slimmer crescent with the same blade, rim and tips)
WAVE_W = {"fang": 0.21, "riser": 0.19, "lens": 0.30}      # the widest part, x L
V0, T0 = 6.0, 0.08
WAKE = 0.20                                  # the flame mass reaches this x L behind the trailing edge at the belly
THORN = 0.72                                 # the thorn row's depth, x the 0.7 look's
EMIT_N, EMIT_DEPTH = 33, 0.12
REAR_MAX = -1.8                              # the crescent's rear at spawn, no further behind her root than this (u)
FLAME_ROWS, FANG_ROWS = 9, 4


def wave_spec(sil, cls, at, tilt=0.0, u_dir=1, ground=True, box_x0=-0.3, flat=None):
    """one move's projectile. at: (the forward-most x of the swing it leaves, the height of its centre). -> dict: the
    crescent's arguments (sil, L, W, tilt, at, ground, u_dir), class timing (v0, t0, v1, flight, win, carrier), bounds,
    centre, floor (its floor point on a ground move, else None), rects (hit rectangles in the bullet's frame), launch_box"""
    C = WAVE_CLASS[cls]; at0 = [float(at[0]), float(at[1])]
    L = C["L"] * (LENS_LEN if sil == "lens" else 1.0); W = WAVE_W[sil] * L
    c = crescent(sil, L, W, tilt, at=at, ground=ground, u_dir=u_dir, flat=flat)
    if c["bounds"][0] < REAR_MAX:                 # a long hook's tail: no further behind her than 5AA's (the approved one)
        at = (at[0] + (REAR_MAX - c["bounds"][0]), at[1])
        c = crescent(sil, L, W, tilt, at=at, ground=ground, u_dir=u_dir, flat=flat)
    bx = boxes(c, np.ones((2, 2), np.float32), C["v1"])
    flight = C["flight"]
    # the launch box (live 0-0.05 s): the gap between her and a crescent that starts ahead of her, so an enemy standing on
    # her is still hit; none when the crescent already reaches back to her
    xa, xb = min(box_x0, -0.3), c["bounds"][0] + 0.3
    launch = [round(xa, 3), round(c["bounds"][1], 3), round(xb, 3), round(c["bounds"][3], 3)] if xb - xa >= 0.4 else None
    return dict(sil=sil, cls=cls, tag=C["tag"], L=L, W=W, flat=flat, tilt=float(tilt), at=[float(at[0]), float(at[1])], at0=at0, ground=bool(ground),
                u_dir=int(u_dir), v0=V0, t0=T0, v1=C["v1"], flight=flight, win=[round(2 / 60.0, 4), round(flight - 1 / 60.0, 4)],
                carrier=round(flight + 0.40, 4), bounds=[round(v, 4) for v in c["bounds"]], centre=[round(v, 4) for v in c["centre"]],
                floor=None if c["floor"] is None else [round(v, 4) for v in c["floor"]], rects=bx["rects"], box_share=bx["overall"],
                launch_box=launch,
                distance=round(V0 * T0 + C["v1"] * (flight - T0), 2))


def _strip_grid(P, Q, rows, U, vfun=None):
    """a (len(P) x rows) grid between polylines P (row 0) and Q (last row): verts, uv (U per column, V 0 -> 1), tris"""
    verts, uv, tris = [], [], []
    n = len(P)
    for c_ in range(n):
        for r in range(rows):
            g = r / (rows - 1.0); p = P[c_] + (Q[c_] - P[c_]) * g
            verts.append([round(float(p[0]), 5), round(float(p[1]), 5)]); uv.append([round(float(U[c_]), 5), round(float(g), 5)])
    for c_ in range(n - 1):
        for r in range(rows - 1):
            a0 = c_ * rows + r; a1 = a0 + 1; b0 = a0 + rows; b1 = b0 + 1
            tris += [[a0, b0, a1], [a1, b0, b1]]
    return dict(verts=verts, uv=uv, tris=tris)


def wave_meshes(spec):
    """the four meshes of rrb_slashwave2_<class> for this projectile, in the bullet's frame (x forward, y up)"""
    c = crescent(spec["sil"], spec["L"], spec["W"], spec["tilt"], at=tuple(spec["at"]), ground=spec["ground"], u_dir=spec["u_dir"],
                 flat=spec.get("flat"))
    O = np.asarray(c["outer"], float); I = np.asarray(c["inner"], float)
    n = len(O); f = np.linspace(0.0, 1.0, n); k = spec["L"] / 5.6
    wid = np.linalg.norm(O - I, axis=1); ok = wid > 0.05
    back = np.zeros((n, 2))
    for i in range(n):
        j = i if ok[i] else min((q for q in range(n) if ok[q]), key=lambda q: abs(q - i))
        back[i] = (I[j] - O[j]) / wid[j]
    wake = 0.3 * back + 0.7 * np.array([-1.0, 0.0]); wake /= np.linalg.norm(wake, axis=1)[:, None]
    # the flame mass: laid ACROSS the crescent (U 0 on the leading edge -> 1 at the wake's end; the flame shader's masks are
    # solid at U 0 and ragged toward U 1), V mirrored about the belly so the mask's long tongues flank the belly, where the
    # wake is deepest, and its notched top and bottom rows are left out
    D = WAKE * spec["L"] * (0.30 + 0.70 * np.sin(np.pi * f) ** 0.7)
    vm = 0.10 + 0.78 * np.clip(1.0 - np.abs(f - 0.47) / 0.53, 0.0, 1.0)
    fv, fu, ft = [], [], []
    for i in range(n):
        total = wid[i] + D[i]
        for r in range(FLAME_ROWS):
            g = r / (FLAME_ROWS - 1.0); d = g * total
            p = O[i] + back[i] * d if d <= wid[i] else I[i] + wake[i] * (d - wid[i])
            fv.append([round(float(p[0]), 5), round(float(max(p[1], 0.0) if spec["ground"] else p[1]), 5)]); fu.append([round(g, 5), round(float(vm[i]), 5)])
    for i in range(n - 1):
        for r in range(FLAME_ROWS - 1):
            a0 = i * FLAME_ROWS + r; a1 = a0 + 1; b0 = a0 + FLAME_ROWS; b1 = b0 + 1
            ft += [[a0, b0, a1], [a1, b0, b1]]
    flame = dict(verts=fv, uv=fu, tris=ft)
    # the thorn row: from just inside the trailing edge outward, deepest at the belly; U tiled along the arc
    depth = (0.27 + 0.73 * np.sin(np.pi * f) ** 0.8) * k * THORN
    P = I + (O - I) * 0.06; Q = P + back * depth[:, None]
    if spec["ground"]: Q[:, 1] = np.maximum(Q[:, 1], 0.0)
    fang = _strip_grid(P, Q, FANG_ROWS, f * (spec["L"] / 1.12))
    # the emitter strip: the trailing edge at equal steps of its length, so flames leave it evenly from tip to tip
    seg = np.linalg.norm(np.diff(I, axis=0), axis=1); Ls = np.concatenate([[0.0], np.cumsum(seg)])
    at = np.linspace(0.04 * Ls[-1], 0.96 * Ls[-1], EMIT_N)
    E = np.column_stack([np.interp(at, Ls, I[:, 0]), np.interp(at, Ls, I[:, 1])])
    emit = _strip_grid(E, E + np.array([-EMIT_DEPTH, 0.0]), 2, np.linspace(0.0, 1.0, EMIT_N))
    return dict(mesh=c["mesh"], flame=flame, fang=fang, emit=emit)
