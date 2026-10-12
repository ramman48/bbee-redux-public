"""ruby_arcband.py (from the kit agent's arcband.py, 2026-10-02) -- look D's geometry and timing: Ruby's slash bands shaped and timed like her own BBTAG arcs (Cross Effect).

The lead (2026-10-02): "you see how bbtag is like circular for her slashes ... and only applies when the scythe is attacking
and not when the scythe is in its later recovery frames back to idle ... bbtag is also very exaggerated and big".

What BBTAG does (bbtag_fxcompile parts of rrb201/202/203/232/251/252/270/271Eff, read from the player's install):
  - each swing is ONE ribbon model round her (a circle or a perspective ellipse about the object's origin), 140-360 degrees;
  - the whole stroke is there on the effect's first tick (U offset ~0 for 3-4 ticks), then its texture scrolls (0.07 U a tick)
    and erases it from the tail toward the head; it is gone 9-14 ticks after it appeared (0.15-0.23 s);
  - 270 / 271 / 203 swap 2-4 ribbon meshes instead (the smear growing, then shrinking), with the same life;
  - 5A has no arc; 5AAAA's cut (rrb405Eff) is a sprite flipbook ("Issen"), not a ribbon: no band.
So the band here is the union of the stroke's visible ribbon (texture u in its content range after the scroll), laid
round the object's origin; it is drawn in DRAW_TICKS (a near-instant smear, as BBTAG shows it at once) and erased from the
tail over the rest of BBTAG's life (rrb_slash's drift), then dissolved.

API (the shape fxcompile_ruby._fill_slash takes):
  band_from_bbtag(state, kind="sweep", spawn=None, k=None, u0=U0) -> [dict(
      verts  [[x, y]]  her root frame, facing right, world units (u),
      uv     [[U, V]]  U along the stroke: u0 at the tail -> 1 at the head (by the stroke, see below); V 0 inner -> 1 outer,
      tris   [[a, b, c]],
      t_beg  ticks from the move's start: the BBTAG arc appears,
      t_end  ticks: its head is in place (t_beg + DRAW_TICKS),
      t_out  ticks: BBTAG's arc is gone (its last visible tick + 1),
      hold   ticks the head stays at the end after t_end before the drift starts (BBTAG holds the stroke ~3 ticks),
      drift  how far rrb_slash's head should run on after the hold to erase the stroke from the tail by t_out (U),
      centroid, head, extent, pivot, k, state, kind)]
  No vertex colours. U: BBTAG shows the whole stroke at once, so there is no head travel to lay U by time: U follows the
  stroke itself (BBTAG's own u, tail -> head), and rrb_slash's wipe (linear in U over t_beg..t_end) draws it in DRAW_TICKS.
  u0 = 0.45: when rrb_slash's head reaches U 1 its stroke texture (tiled x1.2: 0.75 of U long) covers the band from its
  thick middle to the head, so the whole band shows at once at t_end, bold (u0 0.25 squeezed the stroke's thin tail in,
  and the band read as a blob running round a thin line). drift = 1 - u0 + 0.05 erases it from the tail by t_out.
  spawn: ticks from the move's start at which her move spawns the BBTAG effect (default: SPAWN, the canonical move's, read
  from the release tree mods/char-ruby/gen/rrb_tree.json; e.g. rrb202Eff in 5BB at 9, in the Clash chase at 38).
  k: the exaggeration about the arc's own origin (default EXAGGERATE[kind]; 1.0 = BBTAG's size).
  band_from_obj(path, kind, spawn): the fallback for a swing BBTAG draws no ribbon for (5AAAA): the builder's blade-path
  band from its OBJ, exaggerated k about her body (PIVOT), timed the same way (draw = the blade's ticks, hold, erase).

Build time only: it reads the player's install through bbtag_fxcompile. Nothing of BBTAG is shipped.
usage: python arcband.py <state> [kind] [--png]     (summary; --png draws the bands next to BBTAG's ribbons)
"""
import math, os, sys
import numpy as np

# (the loader's folder is the nearest one above that holds bbmod.py: a character packed for a mod loader carries its
#  own copy of this module inside its mod folder; in the workspace and a standalone package it is the folder it was)
_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next((p for p in (os.path.abspath(os.path.join(_HERE, *([".."] * k))) for k in range(1, 8)) if os.path.exists(os.path.join(p, "bbmod.py"))), os.path.abspath(os.path.join(_HERE, "..", "..")))
sys.path.insert(0, _HERE)
import bbtag_fxcompile as FC

DRAW_TICKS = 2.0                  # BBTAG shows the stroke at once; rrb_slash draws it in 2 ticks (a smear, not a pop)
U0 = 0.45                         # the band's tail U (see above)
WIDTH_GAIN = 1.0                  # the band's width against BBTAG's ribbon (1.0: its own; the lead, 2026-10-02: scythe slashes at BBTAG's size)
HOLD_TICKS = 2.0                  # BBTAG holds the whole stroke ~3 ticks before erasing it: rrb_slash holds its head at the end this long
ROWS = 5
COLS_MAX = 64
NB = 144                          # angle bins (2.5 degrees)
TEX_U = (0.5, 0.99)               # BBTAG's stroke textures (zangeki / dageki 01): content from u 0.5 to the head at ~0.97
# the size against BBTAG's own: 1.0 for every scythe slash. (First proposal 1.2-1.35, for "very exaggerated and big";
# the lead, 2026-10-02: "the projectile slashes should be the slashes that are large the scythe slashes are too big and look
# weird": BBTAG's arcs are already big against her; only the thrown slash projectiles are larger.)
EXAGGERATE = {"quick": 1.0, "sweep": 1.0, "heavy": 1.0, "spin": 1.0, "air": 1.0, "thrust": 1.0}
# ticks from the move's start at which the canonical move spawns each arc (the release tree's arc_rrbXXXeff Start x 60)
SPAWN = {"rrb270Eff": 4, "rrb271Eff": 9, "rrb203Eff": 14, "rrb232Eff": 12, "rrb320Eff": 12, "rrb251Eff": 8, "rrb252Eff": 10,
         "rrb201Eff": 6, "rrb202Eff": 9, "rrb231Eff": 7, "rrb311Eff": 11, "rrb409Eff": 0}


def _spawn_from_tree(state):
    import json
    p = os.path.join(ROOT, "mods", "char-ruby", "gen", "rrb_tree.json")
    if not os.path.exists(p): return None
    try:
        t = json.load(open(p, encoding="utf-8"))
        for a in t["_actions"]:
            for e in a.get("AddEffects") or []:
                if e["NameEx"]["ConstValue"].split("/")[-1].lower() == "arc_" + state.lower():
                    return round(e["Start"]["value"] / 4294967296.0 * 60.0, 3)
    except Exception:
        return None
    return None


def _interp(keys, t, default=0.0):
    if not keys: return default
    if t <= keys[0][0]: return keys[0][1]
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b: return va + (vb - va) * ((t - a) / (b - a) if b > a else 1.0)
    return keys[-1][1]


def _visible(parts, ticks):
    """(world points, BBTAG u, part index, tick) of every body vertex whose scrolled texture u is in the stroke's content"""
    P, U, I, T = [], [], [], []
    for i, p in enumerate(parts):
        o = np.asarray(p["origin"], float); V = np.asarray(p["verts"], float) + o; u = np.asarray(p["uv"], float)[:, 0]
        for t in range(int(p["t0"]), int(p["t1"]) + 1):
            if _interp(p["fade"], t, 1.0) < 0.05: continue
            tu = u - _interp(p["uscroll"], t, 0.0)
            m = (tu >= TEX_U[0]) & (tu <= TEX_U[1])
            if m.any():
                P.append(V[m]); U.append(u[m]); I.append(np.full(m.sum(), i)); T.append(np.full(m.sum(), t))
    if not P: return None
    return np.concatenate(P), np.concatenate(U), np.concatenate(I), np.concatenate(T)


def blade_dir(blade, pivot, win):
    """+1 / -1: the way her blade tip turns about `pivot` over the swing frames in ticks win (counter-clockwise +), 0 if
    unknown. Steps over 170 degrees are ambiguous and left out."""
    pv = np.asarray(pivot, float); tot, prev = 0.0, None
    for tick, sp, spine, sw in blade:
        if spine is None: continue
        th = math.atan2(spine[-1][1] - pv[1], spine[-1][0] - pv[0])
        if prev is not None and sw and win[0] <= tick <= win[1]:
            d = (th - prev + math.pi) % (2 * math.pi) - math.pi
            if abs(d) < math.radians(170): tot += d
        prev = th
    return 0 if abs(tot) < math.radians(10) else (1 if tot > 0 else -1)


def _smooth(a, n=2, closed=False):
    a = np.asarray(a, float).copy()
    k = np.array([0.25, 0.5, 0.25])
    for _ in range(n):
        if closed: a = np.convolve(np.r_[a[-1], a, a[0]], k, "valid")
        elif len(a) >= 3: a[1:-1] = np.convolve(a, k, "valid")
    return a


FIT_RMS = 0.04                    # u: the fit follows BBTAG's edge this closely (its real shape), no closer (the bin noise)
FIT_HARM = 10                     # at most this many harmonics (the scallops are 30+ a turn)


def _fit(a, ang, harm=None):
    """a smooth curve through per-bin samples round the arc (the lead, 2026-10-02: "dont make the slashes so wobbly"; the
    per-bin outermost vertex jumped 0.1-0.37 u between neighbouring 2.5 degree bins on a band 0.2-0.6 u wide: scalloped
    edges). BBTAG's arcs are circles and perspective ellipses about the pivot, whose radius is a few low harmonics of
    the angle (a flat ellipse needs more than a round one): a least-squares fit of the mean plus harmonics in the real
    angle, the fewest that follow the edge within FIT_RMS (at most FIT_HARM), lightly damped so a short arc stays
    well-behaved. `harm`: a fixed count instead."""
    a = np.asarray(a, float); th = np.asarray(ang, float); n = len(a)
    if n < 8: return a
    def fit(hm):
        M = np.column_stack([np.ones(n)] + [f(h * th) for h in range(1, hm + 1) for f in (np.cos, np.sin)])
        R = np.eye(M.shape[1]) * (1e-3 * n); R[0, 0] = 0.0
        return M @ np.linalg.solve(M.T @ M + R, M.T @ a)
    if harm is not None: return fit(harm)
    out = None
    for hm in range(2, min(FIT_HARM, max(2, n // 6)) + 1):
        out = fit(hm)
        if float(np.sqrt(((out - a) ** 2).mean())) <= FIT_RMS: break
    return out


ELLIPSE_RMS = 0.09                # u: an outer edge this close to one ellipse is drawn as that ellipse


def _ellipse_edge(ang, rad, pivot):
    """the outer edge as ONE ellipse (BBTAG's arcs are circles and tilted rings: an ellipse cannot wobble): a direct
    least-squares conic through the edge points (Fitzgibbon's ellipse-specific fit), then the radius about `pivot` at
    each angle. -> (radii, rms against the samples) or None when the points are no ellipse (a hook, a straight cut)"""
    th = np.asarray(ang, float); r = np.asarray(rad, float)
    x = r * np.cos(th); y = r * np.sin(th)                      # about the pivot
    mx, my = x.mean(), y.mean(); sc = max(1e-6, float(np.hypot(x - mx, y - my).max()))
    X = (x - mx) / sc; Y = (y - my) / sc
    D1 = np.column_stack([X * X, X * Y, Y * Y]); D2 = np.column_stack([X, Y, np.ones_like(X)])
    S1, S2, S3 = D1.T @ D1, D1.T @ D2, D2.T @ D2
    try:
        T = -np.linalg.solve(S3, S2.T)
        M = S1 + S2 @ T
        M = np.array([M[2] / 2.0, -M[1], M[0] / 2.0])
        w, v = np.linalg.eig(M)
        v = np.real(v); cond = 4 * v[0] * v[2] - v[1] ** 2
        a1 = v[:, np.argmax(cond)] if (cond > 0).any() else None
    except np.linalg.LinAlgError:
        a1 = None
    if a1 is None or not (4 * a1[0] * a1[2] - a1[1] ** 2 > 0): return None
    A, B, C = a1; D, E, F = T @ a1
    # the radius along each ray from the pivot: (pivot in normalized coords) p0 + t d, solve the conic for t
    px, py = (0.0 - mx) / sc, (0.0 - my) / sc
    out = np.empty(len(th))
    for i, t_ in enumerate(th):
        dx, dy = math.cos(t_) / sc, math.sin(t_) / sc
        qa = A * dx * dx + B * dx * dy + C * dy * dy
        qb = 2 * A * px * dx + B * (px * dy + py * dx) + 2 * C * py * dy + D * dx + E * dy
        qc = A * px * px + B * px * py + C * py * py + D * px + E * py + F
        disc = qb * qb - 4 * qa * qc
        if abs(qa) < 1e-12 or disc < 0: return None
        roots = [(-qb + sg * math.sqrt(disc)) / (2 * qa) for sg in (1, -1)]
        roots = [t for t in roots if t > 0]
        if not roots: return None
        out[i] = min(roots, key=lambda t: abs(t - r[i]))
    return out, float(np.sqrt(((out - r) ** 2).mean()))


# ---- one clean arc (2026-10-03). A scythe's sweep is a circle seen at an angle: an ellipse. The band's outer edge is the
# best ellipse through BBTAG's edge points, each point moved onto it and their order along it made one-way; the harmonic
# fit above drew lumps and dents wherever the edge was not already an ellipse (Corkscrew and the Clash finish: 17 changes
# of curvature; Guillotine's flat rings; 5AA's hook; Rising Reap's bent foot).
MIN_AXIS = 0.20                   # a ring seen nearly edge-on keeps at least this minor / major axis (it must read as a ring)
TAPER_A, TAPER_B = 1.3, 0.75      # the width along the stroke, f^A (1 - f)^B: thin tail, fat shoulder, pointed head
DENSE = 6                         # the clean curve is sampled this many times finer than the columns, then columns are chosen
TURN_SHARE = 0.5                  # by length and by turning in these shares (a flat ring's tight ends get the columns)
WIDTH_FLAT = 0.35                 # the width across a tilted ring: this share kept, the rest foreshortened with the radius


def _taper(f):
    f = np.clip(np.asarray(f, float), 0.0, 1.0)
    fm = TAPER_A / (TAPER_A + TAPER_B)
    return f ** TAPER_A * (1.0 - f) ** TAPER_B / (fm ** TAPER_A * (1.0 - fm) ** TAPER_B)


def _smin(a, b, p=3.0):
    a = np.maximum(np.asarray(a, float), 1e-9); b = np.maximum(np.asarray(b, float), 1e-9)
    return (a ** -p + b ** -p) ** (-1.0 / p)


def _ellipse_params(P):
    """Fitzgibbon's ellipse through points -> (centre, semi-axes a >= b, rotation of the a axis) or None"""
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
    Fc = F + 0.5 * (D * cx + E * cy)
    Q = np.array([[A, B / 2.0], [B / 2.0, C]])
    lam, vec = np.linalg.eigh(Q)
    if Fc == 0 or not np.all(-Fc / lam > 0): return None
    ax = np.sqrt(-Fc / lam)                                      # semi-axes along the eigenvectors
    i = int(np.argmax(ax)); a, b = float(ax[i]), float(ax[1 - i])
    rot = math.atan2(vec[1, i], vec[0, i])
    return np.array([cx * sc + mx, cy * sc + my]), a * sc, b * sc, rot


def _clean_arc(P, closed):
    """ordered outer-edge points -> (ONE smooth curve through them, sampled DENSE times finer; its centre or None; rms
    distance the points moved; its semi-major axis or None).
    An ellipse where the points are one (its minor axis at least MIN_AXIS of the major); else a circle; else, for a nearly
    straight edge, a shallow bow (a quadratic across the chord)."""
    P = np.asarray(P, float); n = len(P); nd = max(96, n * DENSE)
    ext = float(max(np.ptp(P[:, 0]), np.ptp(P[:, 1]), 1e-6))
    el = _ellipse_params(P)
    if el is not None:
        cen, a, b, rot = el
        if not (np.isfinite([a, b, rot]).all() and a < 6.0 * ext and np.linalg.norm(cen - P.mean(0)) < 6.0 * ext): el = None
    if el is None:                                               # a circle
        A_ = np.column_stack([2 * P[:, 0], 2 * P[:, 1], np.ones(n)]); c_ = np.linalg.lstsq(A_, (P ** 2).sum(1), rcond=None)[0]
        cen = c_[:2]; rr = float(np.sqrt(max(1e-9, c_[2] + cen @ cen)))
        if rr < 8.0 * ext: el = (cen, rr, rr, 0.0)
    if el is None:                                               # nearly straight: a shallow bow over the chord
        ch = P[-1] - P[0]; L = float(np.linalg.norm(ch)) or 1.0; e1 = ch / L; e2 = np.array([-e1[1], e1[0]])
        u = (P - P[0]) @ e1; v = (P - P[0]) @ e2
        u = np.maximum.accumulate(u)
        c2 = np.polyfit(u, v, 2)
        us = np.linspace(u[0], u[-1], n)
        O = P[0] + np.outer(us, e1) + np.outer(np.polyval(c2, us), e2)
        ud = np.linspace(u[0], u[-1], nd)
        return P[0] + np.outer(ud, e1) + np.outer(np.polyval(c2, ud), e2), None, float(np.sqrt(((O - P) ** 2).sum(1).mean())), None
    cen, a, b, rot = el
    b = max(b, MIN_AXIS * a)
    cr, sr = math.cos(rot), math.sin(rot)
    D = P - cen
    xe = D[:, 0] * cr + D[:, 1] * sr; ye = -D[:, 0] * sr + D[:, 1] * cr
    ph = np.unwrap(np.arctan2(ye / b, xe / a))
    sg = 1.0 if ph[-1] >= ph[0] else -1.0
    ph = sg * np.maximum.accumulate(sg * ph)                      # one way round
    if closed and abs(ph[-1] - ph[0]) < 2 * np.pi * 0.9: ph = np.linspace(ph[0], ph[0] + sg * 2 * np.pi * (n - 1) / n, n)
    ph = np.linspace(ph[0], ph[-1], n) * 0.5 + _smooth(ph, 6) * 0.5      # evened: no bunching where the bins were dense
    xo = a * np.cos(ph); yo = b * np.sin(ph)
    O = cen + np.column_stack([xo * cr - yo * sr, xo * sr + yo * cr])
    rms = float(np.sqrt(((O - P) ** 2).sum(1).mean()))
    pd = np.interp(np.linspace(0.0, n - 1.0, nd), np.arange(n), ph)
    xo = a * np.cos(pd); yo = b * np.sin(pd)
    return cen + np.column_stack([xo * cr - yo * sr, xo * sr + yo * cr]), cen, rms, a


def band_from_bbtag(state, kind="sweep", spawn=None, k=None, u0=U0, blade=None):
    r = FC.compile_state(state)
    parts = [p for p in r["parts"] if p["role"] == "body"]
    if not parts: return []
    vis = _visible(parts, r["ticks"])
    if vis is None: return []
    P, Ub, I, T = vis
    if spawn is None:
        spawn = _spawn_from_tree(state)
        if spawn is None: spawn = SPAWN.get(state, 0)
    k = EXAGGERATE.get(kind, 1.3) if k is None else k
    pivot = np.asarray(parts[0]["origin"], float)                 # the arc object's origin: the centre BBTAG turns it about
    D = P - pivot
    ang = np.arctan2(D[:, 1], D[:, 0]); rad = np.hypot(D[:, 0], D[:, 1])
    b = np.floor((ang + np.pi) / (2 * np.pi) * NB).astype(int) % NB
    rin, rout, um = {}, {}, {}
    for j in np.unique(b):
        m = b == j
        jo = np.argmax(np.where(m, rad, -1))                   # the outermost vertex of the bin, and its own part's band
        same = m & (I == I[jo])
        rout[j] = rad[jo]; rin[j] = rad[same].min(); um[j] = float(np.median(Ub[same]))
    occ = sorted(rout)
    if len(occ) < 6: return []
    closed = len(occ) >= NB - 4
    if not closed:                                               # the stroke runs between the largest gap's ends
        gaps = [((occ[(i + 1) % len(occ)] - occ[i]) % NB, i) for i in range(len(occ))]
        g, gi = max(gaps)
        order = occ[gi + 1:] + occ[:gi + 1]
        if np.corrcoef(np.arange(len(order)), [um[j] for j in order])[0, 1] < 0: order = order[::-1]
    else:                                                        # a full ring: start at its tail (lowest u), run toward
        s = min(occ, key=lambda j: um[j])                        # the neighbour whose u is lower (the other side is the head)
        step = 1 if um[(s + 1) % NB] <= um[(s - 1) % NB] else -1
        order = [j for j in ((s + step * i) % NB for i in range(NB)) if j in rout]   # (a ring may miss up to 4 bins)
    a_ = np.array([(j + 0.5) / NB * 2 * np.pi - np.pi for j in order])
    a_ = np.unwrap(a_)
    # the stroke runs the way her blade swings (BBTAG's own u can run either way across its pieces: rrb203Eff's ran top
    # -> bottom on an upward swing): with her blade, the order follows its turn about the pivot in the arc's window
    if blade is not None:
        t_first = spawn + int(T.min())
        bd = blade_dir(blade, pivot, (t_first - 2.0, t_first + DRAW_TICKS + 4.0))
        if bd != 0 and np.sign(a_[-1] - a_[0]) != bd:
            order = order[::-1]
            a_ = np.unwrap(np.array([(j + 0.5) / NB * 2 * np.pi - np.pi for j in order]))
    ro_raw = np.asarray([rout[j] for j in order]); ri_raw = np.asarray([rin[j] for j in order])
    # ONE clean arc (see _clean_arc): the outer edge is the best ellipse through BBTAG's edge, never its harmonics
    Praw = np.column_stack([ro_raw * np.cos(a_), ro_raw * np.sin(a_)])        # about the pivot
    Oc, cen, fit_rms, amaj = _clean_arc(Praw, closed)
    # <= COLS_MAX columns, spread by length and by turning (a flat ring's ends are tight: columns by length alone drew
    # them as corners)
    n = min(COLS_MAX, max(12, len(order)))
    dO = np.diff(Oc, axis=0)
    seg = np.r_[0.0, np.cumsum(np.hypot(dO[:, 0], dO[:, 1]))]
    hd = np.unwrap(np.arctan2(dO[:, 1], dO[:, 0]))
    trn = np.r_[0.0, 0.0, np.cumsum(np.abs(np.diff(hd)))]
    key = (1.0 - TURN_SHARE) * seg / max(1e-9, seg[-1]) + TURN_SHARE * trn / max(1e-9, trn[-1])
    kq = np.linspace(0.0, key[-1], n)
    O = np.column_stack([np.interp(kq, key, Oc[:, 0]), np.interp(kq, key, Oc[:, 1])]) * k
    fa = np.interp(kq, key, seg) / max(1e-6, seg[-1])           # each column's share of the arc's length
    # and ONE smooth width along it (thin tail, fat shoulder, pointed head: the projectile's crescent). The inner edge
    # is a smaller copy of the outer ellipse: the width follows the distance to its centre, as a ring seen at an angle
    # is (full at its far ends, foreshortened across), so it has no bump and cannot cross the outer edge
    w_raw = ro_raw - ri_raw
    Wm = max(0.08, float(np.percentile(w_raw, 70))) * WIDTH_GAIN * k
    tp = _taper(fa)
    if cen is not None:
        R = cen * k - O; rl = np.linalg.norm(R, axis=1); R /= np.maximum(1e-9, rl)[:, None]
        wd = Wm * tp * (WIDTH_FLAT + (1.0 - WIDTH_FLAT) * rl / max(1e-6, amaj * k))
        t = rl * (1.0 - np.exp(-wd / np.maximum(1e-6, rl)))      # never past the centre, and no knee where it nears it
    else:                                                        # a shallow bow: along its normals, toward the pivot's side
        Tn = np.gradient(O, axis=0); Tn /= np.maximum(1e-9, np.linalg.norm(Tn, axis=1))[:, None]
        R = np.column_stack([-Tn[:, 1], Tn[:, 0]])
        if float((R @ (-O.mean(0))).mean()) < 0: R = -R
        t = Wm * tp
    t[0] = t[-1] = 0.0
    I = O + R * t[:, None]
    # U by length along the band's middle (BBTAG's own u is no measure along the stroke: its pieces map it differently,
    # rrb203Eff's per-direction u peaked near the tail), tail u0 -> head 1
    MID = (O + I) * 0.5
    L = np.r_[0.0, np.cumsum(np.hypot(np.diff(MID[:, 0]), np.diff(MID[:, 1])))]
    Un = u0 + (1.0 - u0) * L / max(1e-6, L[-1])
    verts, uv, tris = [], [], []
    for c in range(n):
        for q in range(ROWS):
            fq = q / (ROWS - 1)
            pt = I[c] + (O[c] - I[c]) * fq
            verts.append([round(float(pivot[0] + pt[0]), 5), round(float(pivot[1] + pt[1]), 5)])
            uv.append([round(float(Un[c]), 5), round(fq, 5)])
    for c in range(n - 1):
        for q in range(ROWS - 1):
            a0 = c * ROWS + q; a1 = a0 + 1; b0 = a0 + ROWS; b1 = b0 + 1
            tris += [[a0, b0, a1], [a1, b0, b1]]
    V = np.asarray(verts)
    t_first, t_last = int(T.min()), int(T.max())
    t_beg = spawn + t_first; t_end = t_beg + DRAW_TICKS; t_out = spawn + t_last + 1
    head = verts[(n - 1) * ROWS + ROWS - 1]
    return [dict(verts=verts, uv=uv, tris=tris, t_beg=float(t_beg), t_end=float(t_end), t_out=float(t_out), hold=HOLD_TICKS,
                 drift=round(1.0 - u0 + 0.05, 3), centroid=[float(x) for x in V.mean(0)], head=[float(x) for x in head],
                 extent=[float(x) for x in V.max(0) - V.min(0)], pivot=[float(x) for x in pivot], k=k, state=state, kind=kind,
                 closed=closed, turn_deg=round(float(np.degrees(abs(a_[-1] - a_[0]))), 1), fit_rms=round(fit_rms, 4),
                 ellipse=bool(cen is not None))]


PIVOT = (0.0, 0.95)               # her body (ruby_blade.PIVOT): blade-path bands are exaggerated about it
ERASE_TICKS = 7.0                 # blade-path bands: erased this long after the hold (BBTAG's arcs are gone 9-14 ticks after appearing)


def band_from_obj(path, kind="heavy", spawn=0.0, k=None, u0=U0, pivot=PIVOT):
    """the fallback for a swing BBTAG draws no ribbon for (5AAAA's cut is the rrbef405_issen flipbook; 5A a thrust):
    the builder's own blade-path band (ruby_blade.swing_crescent, as fxcompile_ruby writes it: an OBJ in her root frame,
    U by time 0 tail -> 1 head, header 'ticks A-B from spawn'), exaggerated k about her body and timed as look D:
    drawn over the blade's own ticks, held HOLD_TICKS, erased in ERASE_TICKS. spawn: ticks from the move's start at
    which her move spawns that trail. -> [band dict] as band_from_bbtag."""
    import re
    V, T, F = [], [], []
    head = open(path).readline()
    m = re.search(r"ticks ([\d.]+)-([\d.]+) from spawn", head)
    a, b = (float(m.group(1)), float(m.group(2))) if m else (0.0, 6.0)
    for ln in open(path):
        p = ln.split()
        if not p: continue
        if p[0] == "v": V.append([float(p[1]), float(p[2])])
        elif p[0] == "vt": T.append([float(p[1]), float(p[2])])
        elif p[0] == "f": F.append([int(x.split("/")[0]) - 1 for x in p[1:4]])
    k = EXAGGERATE.get(kind, 1.3) if k is None else k
    pv = np.asarray(pivot, float)
    Vn = pv + k * (np.asarray(V) - pv)
    uv = [[round(u0 + (1.0 - u0) * u, 5), round(v, 5)] for u, v in T]
    ih = int(np.argmax([u for u, v in T]))
    t_beg = spawn + a; t_end = spawn + b
    verts = [[round(float(x), 5), round(float(y), 5)] for x, y in Vn]
    return [dict(verts=verts, uv=uv, tris=F, t_beg=float(t_beg), t_end=float(t_end), t_out=float(t_end + HOLD_TICKS + ERASE_TICKS),
                 hold=HOLD_TICKS, drift=round(1.0 - u0 + 0.05, 3), centroid=[float(x) for x in Vn.mean(0)], head=verts[ih],
                 extent=[float(x) for x in Vn.max(0) - Vn.min(0)], pivot=[float(x) for x in pv], k=k,
                 state=os.path.basename(path)[:-4], kind=kind, closed=False, turn_deg=0.0)]


# ---------------------------------------------------------------- sync with her animation (the lead, 2026-10-02: "the slash
# vfx is not synced up to rubys animatioons ... keep it 60 fps"). The band's head follows the blade: on each frame of her clip
# where the blade swings, the head runs (over 2 ticks, centred on the frame change) to the point of the band at the blade's
# angle about the band's pivot; the last swing frame inside the arc's window takes it to the band's head. Before the swing
# nothing shows; after it, it holds HOLD_TICKS and erases from the tail (by BBTAG's own end, at most ERASE_MAX after).
# The result is band["wipe"] = [[tick from t_beg, w], ...], w 0 -> 1 the stroke head running U W_HEAD0 -> W_HEAD1 (rrb_slash's
# body: zangeki head at u 0.94, tiling 1.2), 1 -> 2 the erase (rrb_slash's drift). Custom1.x for a layer with offset H:
#   w <= 1: H + 0.02 - 1.02 w        w > 1: H - 1 - drift (w - 1)
W_HEAD0, W_HEAD1 = 0.114, 0.964
SYNC_TOL = 30.0                   # degrees: a blade further than this from every point of the band is not on it
ERASE_MIN, ERASE_MAX = 5.0, 9.0   # ticks the erase takes (BBTAG's own end, clamped)
TREE = os.path.join(ROOT, "local_only", "ruby_dev", "mods", "char-ruby-dev", "gen", "rrb_tree.json")
_assets = None


def _fv(v):
    if isinstance(v, dict) and "value" in v: return v["value"] / 4294967296.0
    if isinstance(v, dict) and "ConstValue" in v: return _fv(v["ConstValue"])
    return v


def move_blade(action, tree=TREE):
    """[(tick, sprite, spine S x 2 heel -> tip or None, swinging)] on each frame change of her action's clip, as the BBEE
    action plays it (ruby_blade.frames_of over its AnimateDuration), ticks from the action's start"""
    global _assets
    import json
    _a, sys.argv = sys.argv, ["x"]
    import ruby_move_view as MV, ruby_blade as RB
    sys.argv = _a
    if _assets is None: _assets = MV.Assets()
    t = json.load(open(tree, encoding="utf-8"))
    a = next(a for a in t["_actions"] if _fv(a["Name"]) == action)
    dur = _fv(a["AnimateDuration"])
    out, prev = [], None
    for tick, sp in RB.frames_of(_assets, _fv(a["Animate"]), dur, dur):
        b = RB.blade(_assets, sp)
        spine = None if b is None else RB.orient(prev, b[0])
        sw = False
        if spine is not None and prev is not None:
            th, _, _ = RB.rigid(prev, spine)
            sw = bool(np.linalg.norm(spine[-1] - prev[-1]) >= RB.MIN_MOVE or abs(math.degrees(th)) >= RB.MIN_TURN)
        out.append((float(tick), sp, spine, sw))
        if spine is not None: prev = spine
    return out


def _edge(band):
    """the band's outer edge, tail -> head: (U, points, angles about the pivot, unwrapped)"""
    V = np.asarray(band["verts"], float); T = np.asarray(band["uv"], float)
    m = T[:, 1] > 0.99
    o = np.argsort(T[m, 0])
    U = T[m, 0][o]; P = V[m][o]
    pv = np.asarray(band["pivot"], float)
    A = np.unwrap(np.arctan2(P[:, 1] - pv[1], P[:, 0] - pv[0]))
    return U, P, A


def _on_band(band, tip, u_from=0.0):
    """U of the band's point at the blade tip's angle (the first such point at or after u_from), and the angle error (deg)"""
    U, P, A = _edge(band)
    pv = np.asarray(band["pivot"], float)
    th = math.atan2(tip[1] - pv[1], tip[0] - pv[0])
    d = np.degrees(np.abs((A - th + np.pi) % (2 * np.pi) - np.pi))
    ok = U >= u_from - 1e-6
    if not ok.any(): return None, 999.0
    d2 = np.where(ok, d, 999.0)
    i = int(np.argmin(d2))
    # a closed ring passes the same angle twice: take the first pass after u_from within the tolerance
    near = np.nonzero(ok & (d <= SYNC_TOL))[0]
    if len(near): i = int(near[0]) if d[near[0]] <= d2[i] + 8.0 else i
    return float(U[i]), float(d[i])


U_DONE = 0.95                     # a blade this far along the band has finished the stroke


def default_wipe(band):
    """BBTAG's own timing (no blade to follow): drawn over t_beg .. t_end, held, erased by t_out"""
    t0, t1, t2 = band["t_beg"], band["t_end"], band["t_out"]
    w0 = (min(u for u, v in band["uv"]) - W_HEAD0) / (W_HEAD1 - W_HEAD0)
    band["wipe"] = [[0.0, round(w0, 4)], [t1 - t0, 1.0], [t1 - t0 + HOLD_TICKS, 1.0], [max(t2, t1 + HOLD_TICKS + ERASE_MIN) - t0, 2.0]]
    band["t_out"] = float(t0 + band["wipe"][-1][0])
    return band


def sync_window(band):
    """the ticks a swing for this band can be in: from 2 before the source's appearance to 4 after its stroke is complete
    (BBTAG shows the stroke at once on its first tick; the release spawns some arcs up to 3 ticks before the blade gets
    there, rrb_fx.LEAD)"""
    return (band["t_beg"] - 2.0, band["t_end"] + 4.0)


def sync_band(band, blade, win, t_out_bbtag=None):
    """band["wipe"], t_beg / t_end / t_out from her blade (move_blade) within ticks win = (a, b) of the move (sync_window):
    the swing frames in the window whose blade lies on the band, up to the one that reaches its head (U_DONE). Returns
    False (band unchanged) when no swing frame is on it."""
    u0 = min(u for u, v in band["uv"])
    keys, u_cur = [], u0
    fr = [f for f in blade if win[0] <= f[0] <= win[1] and f[3] and f[2] is not None]
    hits = []
    for tick, sp, spine, sw in fr:
        u, err = _on_band(band, spine[-1], u_cur)
        if u is None or err > SYNC_TOL: continue
        u_cur = max(u_cur, u); hits.append((tick, u_cur, sp, err))
        if u_cur >= U_DONE: break                 # the blade is at the stroke's head: later frames are its recovery
    if not hits: return False
    # the swing's last frame on the band takes the head to the band's head (BBTAG's stroke ends where the swing ends)
    hits[-1] = (hits[-1][0], 1.0, hits[-1][2], hits[-1][3])
    w = lambda U: (U - W_HEAD0) / (W_HEAD1 - W_HEAD0)
    t_beg = hits[0][0] - 1.0
    prev_t, prev_w = t_beg, w(u0)
    keys = [(0.0, prev_w)]
    for tick, U, sp, err in hits:
        a, b_ = max(prev_t, tick - 1.0), tick + 1.0
        if a > prev_t: keys.append((a - t_beg, prev_w))
        keys.append((b_ - t_beg, min(1.0, w(U))))
        prev_t, prev_w = b_, min(1.0, w(U))
    t_end = prev_t
    t_hold = t_end + HOLD_TICKS
    er = ERASE_MAX if t_out_bbtag is None else min(ERASE_MAX, max(ERASE_MIN, t_out_bbtag - t_hold))
    t_out = t_hold + er
    keys += [(t_hold - t_beg, 1.0), (t_out - t_beg, 2.0)]
    band.update(t_beg=float(t_beg), t_end=float(t_end), t_out=float(t_out), wipe=[[round(a, 3), round(b_, 4)] for a, b_ in keys],
                sync=[[t, round(U, 3), sp, round(err, 1)] for t, U, sp, err in hits])
    return True


def write_obj(band, path):
    with open(path, "w") as f:
        f.write("# %s kind %s draw %.3f s (ticks %.1f-%.1f from the move's start; BBTAG gone at %.1f); U tail -> head, V inner -> outer; "
                "units u from her feet, facing right\n" % (band["state"], band["kind"], (band["t_end"] - band["t_beg"]) / 60.0,
                                                            band["t_beg"], band["t_end"], band["t_out"]))
        for x, y in band["verts"]: f.write("v %.5f %.5f 0\n" % (x, y))
        for u, v in band["uv"]: f.write("vt %.5f %.5f\n" % (u, v))
        for a, b_, c in band["tris"]: f.write("f %d/%d %d/%d %d/%d\n" % (a + 1, a + 1, b_ + 1, b_ + 1, c + 1, c + 1))


def draw_png(state, bands, path, scale=110):
    from PIL import Image, ImageDraw
    r = FC.compile_state(state)
    parts = [p for p in r["parts"] if p["role"] == "body"]
    W, H = 900, 640
    im = Image.new("RGB", (W, H), (22, 24, 32)); d = ImageDraw.Draw(im, "RGBA")
    def P(x, y): return (W / 2 + x * scale, H - 120 - y * scale)
    d.line([P(-4, 0), P(4, 0)], fill=(80, 84, 96))
    for p in parts:
        V = np.asarray(p["verts"]) + np.asarray(p["origin"])
        for tri in p["tris"]: d.polygon([P(*V[i]) for i in tri], fill=(200, 40, 60, 40))
    for bd in bands:
        V = bd["verts"]
        for tri in bd["tris"]:
            u = bd["uv"][tri[0]][0]
            d.polygon([P(*V[i]) for i in tri], outline=(int(80 + 175 * u), 200, int(255 - 175 * u), 140))
        d.ellipse([P(*bd["head"])[0] - 4, P(*bd["head"])[1] - 4, P(*bd["head"])[0] + 4, P(*bd["head"])[1] + 4], fill=(255, 255, 255))
        d.text((6, 6), "%s  k %.2f  turn %.0f  ticks %.0f-%.0f, gone %.0f  (BBTAG red, band outline: tail blue -> head yellow)" % (
            state, bd["k"], bd["turn_deg"], bd["t_beg"], bd["t_end"], bd["t_out"]), fill=(255, 220, 90))
    im.save(path)


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    st = a[0]; kind = a[1] if len(a) > 1 else "sweep"
    bands = band_from_bbtag(st, kind)
    for bd in bands:
        print("%s kind %s: %d verts, %d tris, ticks %.1f -> %.1f (BBTAG gone %.1f), turn %.0f deg, closed %s, extent %.2f x %.2f u, k %.2f, pivot %s" % (
            st, kind, len(bd["verts"]), len(bd["tris"]), bd["t_beg"], bd["t_end"], bd["t_out"], bd["turn_deg"], bd["closed"],
            bd["extent"][0], bd["extent"][1], bd["k"], bd["pivot"]))
    if "--png" in sys.argv:
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "arcband"); os.makedirs(out, exist_ok=True)
        draw_png(st, bands, os.path.join(out, st + ".png"))
        for i, bd in enumerate(bands): write_obj(bd, os.path.join(out, "%s_%d.obj" % (st, i)))
