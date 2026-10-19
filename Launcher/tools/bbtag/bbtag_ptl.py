"""bbtag_ptl.py -- decode and simulate BBTAG particle systems (Cross Effect research; read-only on the install).

Data: data/particle/particle_dat_<code>.pac = particle.bin (emitters), ptlname.bin (names), uvanime.bin (flipbooks);
      data/particle/particle_img_<code>.pac = particle.dds (32-bit BGRA atlas). The common set is code e0 (4096x4096).
Layout, field meanings and evidence: docs/cross-effect/research/PARTICLES.md. Every output goes to the local folder only.

usage:
  python tools/bbtag/bbtag_ptl.py pull [codes...]          extract particle data (+ rrb/e0 atlases) to <local folder>/bbtag/_ptl/
  python tools/bbtag/bbtag_ptl.py list  [--code rrb]
  python tools/bbtag/bbtag_ptl.py info  <name> [--code rrb] [--raw]
  python tools/bbtag/bbtag_ptl.py render <name> [--code rrb] [--ticks N] [--frames-dir DIR] [--seed S]
         [--tint auto|none|R,G,B] [--palette 0] [--face-right] [--ppu 2.2] [--scale-xy 1,1] [--emitter-vel vx,vy]
         [--floor Y] [--rotate DEG] [--view x0,y0,x1,y1] [--max-canvas 1400] [--sheet-cells 24]
  python tools/bbtag/bbtag_ptl.py atlas [--code rrb]         labelled atlas PNG + crops of the common cells it uses
  python tools/bbtag/bbtag_ptl.py stats                      per-field statistics over every fighter (needs pull)

Units: emitter values are BBTAG 3D effect units, y up. Raw data faces LEFT (forward = -x), as in MUA.md.
Renders use --ppu pixels per unit (2.2, the MUA.md fit; inferred for particles) and 60 ticks/s.
"""
import argparse, math, os, random, struct, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bbtag_read as R

LOCAL = R.LOCAL
OUT = os.path.join(LOCAL, "_ptl")
TAU = 2.0 * math.pi






FIELDS = [
    ("H", 0, "flags", "x", "code/partial"), ("H", 1, "pad", "i", "file"),
    ("H", 2, "count_max", "i", "code"), ("H", 3, "count_min", "i", "code"),
    ("H", 4, "life_max", "i", "code"), ("H", 5, "life_min", "i", "code"),
    ("H", 6, "delay_max", "i", "code"), ("H", 7, "delay_min", "i", "code"),
    ("H", 8, "link1_delay", "i", "code"), ("H", 9, "link2_interval", "i", "code"), ("H", 10, "link3_value", "i", "inferred"),
    ("H", 11, "ofs_visual", "o", "code"), ("H", 12, "ofs_shape", "o", "code"), ("H", 13, "ofs_motion", "o", "code"),
    ("H", 14, "link1", "o", "code"), ("H", 15, "link2", "o", "code"), ("H", 16, "link3", "o", "code"), ("H", 17, "pad", "i", "file"),
    ("A", 0, "flags_lo", "x", "code/partial"), ("A", 1, "flags_hi", "x", "code/partial"),
    ("A", 2, "rot_period_max", "i", "code"), ("A", 3, "rot_period_min", "i", "code"),
    ("A", 4, "angle_max", "f", "code"), ("A", 5, "angle_min", "f", "code"),
    ("A", 6, "spin_max", "f", "code"), ("A", 7, "spin_min", "f", "code"),
    ("A", 8, "spin_acc_max", "f", "code"), ("A", 9, "spin_acc_min", "f", "code"), ("A", 10, "spin_damp", "f", "code"),
    ("A", 11, "flip_max", "f", "code"), ("A", 12, "flip_min", "f", "code"),
    ("A", 13, "flip_spin_max", "f", "code"), ("A", 14, "flip_spin_min", "f", "code"),
    ("A", 15, "col_period_max", "i", "code"), ("A", 16, "col_period_min", "i", "code"),
    ("A", 17, "col_start", "c", "code"), ("A", 18, "col_end", "c", "code"), ("A", 19, "col_mid", "c", "code"),
    ("A", 20, "col_mid_t", "f", "code"),
    ("A", 21, "size_period_max", "i", "code"), ("A", 22, "size_period_min", "i", "code"),
    ("A", 23, "w_start_a", "f", "code"), ("A", 24, "h_start_a", "f", "code"),
    ("A", 25, "w_start_b", "f", "code"), ("A", 26, "h_start_b", "f", "code"),
    ("A", 27, "w_end_a", "f", "code"), ("A", 28, "h_end_a", "f", "code"),
    ("A", 29, "w_end_b", "f", "code"), ("A", 30, "h_end_b", "f", "code"),
    ("A", 31, "w_mid_a", "f", "code"), ("A", 32, "h_mid_a", "f", "code"),
    ("A", 33, "w_mid_b", "f", "code"), ("A", 34, "h_mid_b", "f", "code"), ("A", 35, "size_mid_t", "f", "code"),
    ("A", 36, "a36", "f", "unknown"), ("A", 37, "uvanim", "i", "code"),
    ("A", 38, "rect_x0", "f", "code"), ("A", 39, "rect_y0", "f", "code"), ("A", 40, "rect_x1", "f", "code"),
    ("A", 41, "rect_y1", "f", "code"), ("A", 42, "uvanim_ptr", "i", "code"), ("A", 43, "tex_common", "i", "code"),
    ("B", 0, "flags", "x", "code/partial"), ("B", 1, "pad", "i", "file"),
    ("B", 2, "radius", "f", "code"), ("B", 3, "arc_random", "f", "code"), ("B", 4, "arc_start", "f", "code"),
    ("B", 5, "box_min_x", "f", "code"), ("B", 6, "box_min_y", "f", "code"), ("B", 7, "box_min_z", "f", "code"),
    ("B", 8, "box_max_x", "f", "code"), ("B", 9, "box_max_y", "f", "code"), ("B", 10, "box_max_z", "f", "code"),
    ("B", 11, "bounce", "f", "code"), ("B", 12, "system_scale", "f", "code"), ("B", 13, "pad", "i", "file"),
    ("C", 0, "flags", "x", "code/partial"), ("C", 1, "pad", "i", "file"),
    ("C", 2, "vel_a_x", "f", "code"), ("C", 3, "vel_a_y", "f", "code"), ("C", 4, "vel_a_z", "f", "code"),
    ("C", 5, "vel_b_x", "f", "code"), ("C", 6, "vel_b_y", "f", "code"), ("C", 7, "vel_b_z", "f", "code"),
    ("C", 8, "dir_theta_a", "f", "code"), ("C", 9, "dir_phi_a", "f", "code"),
    ("C", 10, "dir_theta_b", "f", "code"), ("C", 11, "dir_phi_b", "f", "code"),
    ("C", 12, "speed_max", "f", "code"), ("C", 13, "speed_min", "f", "code"),
    ("C", 14, "dir_arc_random", "f", "code"), ("C", 15, "dir_arc_start", "f", "code"),
    ("C", 16, "acc_a_x", "f", "code"), ("C", 17, "acc_a_y", "f", "code"), ("C", 18, "acc_a_z", "f", "code"),
    ("C", 19, "acc_b_x", "f", "code"), ("C", 20, "acc_b_y", "f", "code"), ("C", 21, "acc_b_z", "f", "code"),
    ("C", 22, "drag", "f", "code"),
    ("C", 23, "orbit_amp0_x", "f", "code"), ("C", 24, "orbit_amp0_y", "f", "code"), ("C", 25, "orbit_amp0_z", "f", "code"),
    ("C", 26, "orbit_amp1_x", "f", "code"), ("C", 27, "orbit_amp1_y", "f", "code"), ("C", 28, "orbit_amp1_z", "f", "code"),
    ("C", 29, "orbit_spd0_x", "f", "code"), ("C", 30, "orbit_spd0_y", "f", "code"), ("C", 31, "orbit_spd0_z", "f", "code"),
    ("C", 32, "orbit_spd1_x", "f", "code"), ("C", 33, "orbit_spd1_y", "f", "code"), ("C", 34, "orbit_spd1_z", "f", "code"),
    ("C", 35, "orbit_phase_x", "f", "code"), ("C", 36, "orbit_phase_y", "f", "code"), ("C", 37, "orbit_phase_z", "f", "code"),
    ("C", 38, "follow", "f", "code/partial"), ("C", 39, "pad", "i", "file"),
]
SIZES = {"H": 72, "A": 176, "B": 56, "C": 160}


FLAGS = [
    ("H", 0, 0x7, "bits 0-2 (unknown; set on many multi-particle emitters)", "unknown"),
    ("H", 0, 0x8, "particles expire at life end (else live until removed)", "code"),
    ("H", 0, 0x10, "respawn dead particles (loop)", "code"),
    ("H", 0, 0x20, "delay mode bit A", "code"),
    ("H", 0, 0x40, "delay mode bit B (A+B = sequential emission, immediate respawn)", "code"),
    ("H", 0, 0x80, "link1 enabled", "code"), ("H", 0, 0x100, "link2 enabled", "code"), ("H", 0, 0x200, "link3 enabled", "code"),
    ("H", 0, 0x400, "link1 per particle (sub-emitter at each particle)", "code"),
    ("H", 0, 0x800, "link2 per particle (trail every link2_interval ticks)", "code"),
    ("H", 0, 0x1000, "link3 per particle", "inferred"),
    ("A", 0, 0x4, "render key 1 (batch state; meaning unknown)", "code/partial"),
    ("A", 0, 0x8, "render key 2 (batch state; meaning unknown)", "code/partial"),
    ("A", 0, 0x40, "in-plane rotation enabled", "code"),
    ("A", 0, 0x400, "colour animates (end key used)", "file"),
    ("A", 0, 0x800, "end size used", "code"),
    ("A", 0, 0x1c000, "blend mode field: 0x4000 alpha, 0x8000 additive, 0xc000 subtractive?, other = opaque/none", "code/partial"),
    ("A", 0, 0x20000, "rotate to face the direction of motion (screen space)", "code"),
    ("A", 0, 0x40000, "start size keeps aspect (h = h_a * w / w_a)", "code"),
    ("A", 0, 0x80000, "end size keeps aspect", "code"),
    ("A", 0, 0x4000000, "end size is a multiplier of the start size", "code"),
    ("A", 0, 0x8000000, "render key 3 (batch state; meaning unknown)", "code/partial"),
    ("A", 0, 0x10000000, "colour mid key used", "file"),
    ("A", 0, 0x20000000, "mid size key used", "code"),
    ("A", 0, 0x80000000, "mid size is a multiplier of the start size", "code"),
    ("A", 1, 0x1, "mid size keeps aspect", "code"), ("A", 1, 0x2, "end size multiplies the mid size", "code"),
    ("A", 1, 0x4, "no flip", "code"), ("A", 1, 0x8, "flip about the screen X axis (height squashes)", "code"),
    ("A", 1, 0x10, "flip about the screen Y axis (width squashes)", "code"),
    ("A", 1, 0x20, "render key 4 (inverted; meaning unknown)", "code/partial"),
    ("A", 1, 0xc0, "bits 6-7 (unknown; 0x80 on 80 of 99 petal emitters)", "unknown"),
    ("B", 0, 0x2, "shape: circle / sphere of radius", "code"), ("B", 0, 0x4, "shape: box", "code"),
    ("B", 0, 0x8, "on the edge only (fixed radius)", "code"), ("B", 0, 0x20, "sphere", "code"), ("B", 0, 0x40, "circle", "code"),
    ("B", 0, 0x80, "circle plane XY", "code"), ("B", 0, 0x100, "circle plane XZ", "code"), ("B", 0, 0x200, "circle plane ZY", "code"),
    ("B", 0, 0x1000, "box: random point inside", "code"), ("B", 0, 0x2000, "box: surface/edges (faces by 0x400-0x80000)", "code/partial"),
    ("B", 0, 0x100000, "boundary y > box max", "code"), ("B", 0, 0x200000, "boundary y < box min", "code"),
    ("B", 0, 0x400000, "boundary x > box max", "code"), ("B", 0, 0x800000, "boundary x < box min", "code"),
    ("B", 0, 0x1000000, "boundary z > box max", "code"), ("B", 0, 0x2000000, "boundary z < box min", "code"),
    ("B", 0, 0x4000000, "boundary: stage floor (world y < 0)", "code"),
    ("B", 0, 0x8000000, "boundary response: kill", "code"), ("B", 0, 0x10000000, "boundary response: bounce (velocity x -bounce, clamp)", "code"),
    ("B", 0, 0x20000000, "boundary response: wrap", "code"),
    ("B", 0, 0x40000000, "circle: particles spread evenly by index (+ arc_random, arc_start)", "code"),
    ("C", 0, 0x2, "motion enabled (velocity/acceleration/drag)", "code"),
    ("C", 0, 0x38, "random sign of vel x/y/z (0x8/0x10/0x20)", "code"),
    ("C", 0, 0x40, "direction: random on the unit sphere", "code"), ("C", 0, 0x80, "direction: in a plane", "code"),
    ("C", 0, 0x100, "direction plane XY", "code"), ("C", 0, 0x200, "direction plane YZ (else XZ)", "code"),
    ("C", 0, 0x4000, "orbit (circular wobble around a moving centre)", "code"),
    ("C", 0, 0x38000, "orbit: random sign of the x/y/z speeds", "code"),
    ("C", 0, 0x40000, "orbit: fixed phase (orbit_phase)", "code"),
    ("C", 0, 0x80000, "directional velocity enabled (direction x speed)", "code"),
    ("C", 0, 0x400000, "direction: radial from the emitter origin", "code"),
    ("C", 0, 0x800000, "speed random in [speed_min, speed_max]", "code"),
    ("C", 0, 0x1000000, "one in three particles reversed", "code"),
    ("C", 0, 0x2000000, "radial direction not normalised", "code"),
    ("C", 0, 0x8000000, "planar direction spread evenly by index", "code"),
    ("C", 0, 0x20000000, "orbit phase = particle index x 360 deg / count", "code"),
    ("C", 0, 0x40000000, "follow: particles lag the owner's movement by 'follow'", "code/partial"),
]




def pdat_dir(code):
    for d in (os.path.join(OUT, "pdat", code), os.path.join(LOCAL, "%s_pdat" % code)):
        if os.path.exists(os.path.join(d, "particle.bin")):
            return d
    return None


def pull(codes, images=("rrb", "e0")):
    os.makedirs(OUT, exist_ok=True)
    for c in codes:
        b = R.read("data/particle/particle_dat_%s.pac" % c)
        d = os.path.join(OUT, "pdat", c)
        os.makedirs(d, exist_ok=True)
        for n, v in R.fpac_files(b).items():
            open(os.path.join(d, n), "wb").write(v)
    for c in images:
        d = os.path.join(OUT, "pimg", c)
        if os.path.exists(os.path.join(d, "particle.dds")):
            continue
        os.makedirs(d, exist_ok=True)
        for n, v in R.fpac_files(R.read("data/particle/particle_img_%s.pac" % c)).items():
            open(os.path.join(d, n), "wb").write(v)


def ensure(code):
    if pdat_dir(code) is None:
        pull([code], images=())
    return pdat_dir(code)


def names_of(nb):
    n = struct.unpack_from("<I", nb, 8)[0]
    return [nb[16 + 32 * i:48 + 32 * i].split(b"\0")[0].decode("latin1") for i in range(n)]


def uvanime(ub):
    """uvanime.bin: 'LTP ' header with the animation count, then per animation an 'LTP ' header with the frame count
    and frames of (u32 ticks, float x, y, w, h) in atlas pixels, relative to the emitter's rect origin (code)."""
    if len(ub) < 16 or ub[:4] != b"LTP ":
        return []
    n = struct.unpack_from("<I", ub, 8)[0]
    out, p = [], 16
    for _ in range(n):
        k = struct.unpack_from("<I", ub, p + 8)[0]
        p += 16
        out.append([struct.unpack_from("<I4f", ub, p + 20 * i) for i in range(k)])
        p += 20 * k
    return out


class Bank:
    """One particle_dat set: emitters by index/name, flipbooks."""

    def __init__(self, code):
        self.code = code
        d = ensure(code)
        if d is None:
            raise SystemExit("no particle data for %s" % code)
        pb = open(os.path.join(d, "particle.bin"), "rb").read()
        if pb[:4] != b"LTP " or struct.unpack_from("<I", pb, 4)[0] != 0x102:
            raise SystemExit("not an LTP 0x102 particle.bin")
        self.names = names_of(open(os.path.join(d, "ptlname.bin"), "rb").read())
        self.anims = uvanime(open(os.path.join(d, "uvanime.bin"), "rb").read())
        n = struct.unpack_from("<I", pb, 8)[0]
        self.recs = []
        for i in range(n):
            h = pb[16 + 72 * i:88 + 72 * i]
            hw = struct.unpack("<18I", h)
            blk = {"H": h, "A": pb[hw[11]:hw[11] + 176], "B": pb[hw[12]:hw[12] + 56], "C": pb[hw[13]:hw[13] + 160]}
            self.recs.append(Emitter(i, self.names[i], blk))
        self.by_offset = {16 + 72 * i: i for i in range(n)}
        self.by_name = {e.name: e for e in self.recs}

    def get(self, name):
        if name in self.by_name:
            return self.by_name[name]
        if name.isdigit():
            return self.recs[int(name)]
        raise SystemExit("no emitter %r in %s" % (name, self.code))

    def link(self, e, k):
        o = e.i("H", 14 + k)
        return self.recs[self.by_offset[o]] if o else None


class Emitter:
    def __init__(self, idx, name, blk):
        self.idx, self.name, self.blk = idx, name, blk

    def i(self, b, w):
        return struct.unpack_from("<i", self.blk[b], 4 * w)[0]

    def u(self, b, w):
        return struct.unpack_from("<I", self.blk[b], 4 * w)[0]

    def f(self, b, w):
        return struct.unpack_from("<f", self.blk[b], 4 * w)[0]

    def v3(self, b, w):
        return np.array(struct.unpack_from("<3f", self.blk[b], 4 * w), dtype=np.float64)


    @property
    def hf(self): return self.u("H", 0)

    @property
    def af(self): return self.u("A", 0)

    @property
    def af2(self): return self.u("A", 1)

    @property
    def bf(self): return self.u("B", 0)

    @property
    def cf(self): return self.u("C", 0)

    def blend(self):
        m = self.af & 0x1C000
        return {0x4000: "alpha", 0x8000: "add", 0xC000: "sub?"}.get(m, "opaque?" if m else "none?")


def argb(u):
    return np.array([(u >> 16) & 255, (u >> 8) & 255, u & 255, (u >> 24) & 255], dtype=np.float64)


def fmt_field(e, b, w, t):
    if t == "f":
        return "%.6g" % e.f(b, w)
    if t in ("x", "o"):
        return "0x%x" % e.u(b, w)
    if t == "c":
        c = argb(e.u(b, w)).astype(int)
        return "0x%08x (rgb %d,%d,%d a %d)" % (e.u(b, w), c[0], c[1], c[2], c[3])
    return str(e.i(b, w))





SPAWN = (4001, 4002, 4045, 23067)


def script_uses(code, name):
    try:
        import bbscript_dump as S
    except ImportError:
        return []
    uses = []
    for fn in ("scr_%sea.bin" % code, "scr_%s.bin" % code):
        p = None
        for d in (os.path.join(LOCAL, "%s_scr" % code), os.path.join(LOCAL, "scripts_all")):
            if os.path.exists(os.path.join(d, fn)):
                p = os.path.join(d, fn)
                break
        if p is None:
            continue
        b = open(p, "rb").read()
        for st, a, z in S.states(b):
            sub, ent, other = 0, None, []
            for _, op, ar in S.decode(b, a, z):
                if op == 0:
                    sub, ent = 0, None
                elif op == 4061 and ar:
                    sub = ar[0]
                elif op == 4047 and len(ar) >= 3:
                    ent = tuple(ar[:3])
                elif op in (4048, 4054) and ar:
                    other.append((op, ar[0]))
                elif op in SPAWN and ar and ar[0] == '"%s"' % name:
                    uses.append({"script": fn, "state": st, "cmd": op, "sub": sub, "entries": ent, "other": list(other)})
    return uses


def palette_colours(code, pal, sub, entries):
    p = os.path.join(LOCAL, "%s_pal" % code, "%s%02d_%02d.hpl" % (code, pal, sub))
    if not os.path.exists(p):
        return None
    b = open(p, "rb").read()
    n = struct.unpack_from("<I", b, 12)[0]
    cols = np.frombuffer(b, np.uint8, count=n * 4, offset=0x20).reshape(n, 4)[:, [2, 1, 0, 3]].astype(np.float64)
    return [cols[k] for k in entries]




class Rng:
    def __init__(self, seed):
        self.r = random.Random(seed)

    def r15(self):
        return self.r.getrandbits(15)

    def fr(self, a, b):
        return a + (b - a) * self.r15() / 32767.0

    def ir(self, lo, hi):
        n = (hi - lo + 1) & 0xFFFFFFFF
        return lo + (self.r15() % n if n else 0)

    def v3(self, a, b):
        return np.array([self.fr(a[k], b[k]) for k in range(3)])

    def unit3(self):
        while True:
            v = np.array([self.fr(-1, 1) for _ in range(3)])
            n = np.linalg.norm(v)
            if n > 1e-6:
                return v / n

    def unit2(self):
        while True:
            u = np.array([self.fr(-1, 1), self.fr(-1, 1)])
            n = np.linalg.norm(u)
            if n > 1e-6:
                return u / n


def spawn_offset(e, rng, f1):
    fl, r0 = e.bf, e.f("B", 2)
    p = np.zeros(3)
    if fl & 2:
        if fl & 0x20:
            r = r0 if fl & 8 else rng.fr(-r0, r0)
            return rng.unit3() * r
        if fl & 0x40:
            if fl & 0x40000000:
                r = r0 if fl & 8 else rng.fr(0, r0)
                a = rng.fr(0, e.f("B", 3)) + f1 * TAU + e.f("B", 4)
                if fl & 0x80:
                    return np.array([r * math.cos(a), r * math.sin(a), 0])
                if fl & 0x100:
                    return np.array([r * math.sin(a), 0, r * math.cos(a)])
                if fl & 0x200:
                    return np.array([0, r * math.cos(a), r * math.sin(a)])
                return p
            r = r0 if fl & 8 else rng.fr(-r0, r0)
            u = rng.unit2() * r
            if fl & 0x80:
                return np.array([u[0], u[1], 0])
            if fl & 0x100:
                return np.array([u[0], 0, u[1]])
            if fl & 0x200:
                return np.array([0, u[1], u[0]])
        return p
    if fl & 4:
        lo, hi = e.v3("B", 5), e.v3("B", 8)
        if fl & 0x1000:
            return rng.v3(lo, hi)
        if fl & 0x2000:
            ax = rng.ir(0, 2)
            q = rng.v3(lo, hi)
            q[ax] = lo[ax] if rng.r15() & 1 else hi[ax]
            return q
    return p


def direction(e, rng, pos, f2):
    fl = e.cf
    if fl & 0x400000:
        n = np.linalg.norm(pos)
        return pos / n if (n > 1e-9 and not fl & 0x2000000) else pos.copy()
    if fl & 0x40:
        return rng.unit3()
    if fl & 0x80:
        if fl & 0x8000000:
            a = rng.fr(0, e.f("C", 14)) + f2 * TAU + e.f("C", 15)
            c, s = math.cos(a), math.sin(a)
        else:
            c, s = rng.unit2()
        if fl & 0x100:
            return np.array([c, s, 0])
        if fl & 0x200:
            return np.array([0, c, s])
        return np.array([s, 0, c]) if fl & 0x8000000 else np.array([c, 0, s])
    th = rng.fr(e.f("C", 10), e.f("C", 8))
    ph = rng.fr(e.f("C", 11), e.f("C", 9))
    return np.array([math.sin(th) * math.sin(ph), math.cos(ph), -math.sin(ph) * math.cos(th)])


def rand_size(e, rng, w0, aspect):
    wa, ha, wb, hb = (e.f("A", w0 + k) for k in range(4))
    w = rng.fr(wb, wa)
    if aspect:
        return np.array([w, ha * w / wa if wa != 0 else 0.0])
    return np.array([w, rng.fr(hb, ha)])


class Particle:
    pass


class Group:
    def __init__(self, sim, e, start, base):
        self.sim, self.e, self.start, self.base = sim, e, start, np.array(base, dtype=np.float64)
        self.parts, self.started = [], False

    def begin(self):
        e, rng = self.e, self.sim.rng
        self.started = True
        n = rng.ir(e.i("H", 3), e.i("H", 2))
        perm = list(range(n))
        if e.cf & 0x8000000 and e.cf & 0x80 and not e.cf & 0x10000000:
            for k in range(n):
                j = rng.r15() % n
                perm[k], perm[j] = perm[j], perm[k]
        seq = (e.hf & 0x20) and (e.hf & 0x40)
        acc = 0
        for k in range(n):
            p = Particle()
            p.k, p.f1, p.f2 = k, k / n, perm[k] / n
            p.life = rng.ir(e.i("H", 5), e.i("H", 4))
            if seq:
                p.delay = acc
                acc += rng.ir(e.i("H", 7), e.i("H", 6))
            else:
                p.delay = rng.ir(e.i("H", 7), e.i("H", 6))
            p.waiting, p.alive = True, True
            self.parts.append(p)
        dur = max([p.delay + p.life for p in self.parts] or [0])

        for k, bit, per in ((0, 0x80, 0x400), (1, 0x100, 0x800), (2, 0x200, 0x1000)):
            c = self.sim.bank.link(e, k)
            if c is None or not e.hf & bit:
                continue
            if k == 0:
                if e.hf & per:
                    for p in self.parts:
                        self.sim.pending.append(("particle", c, self, p, self.start + p.delay + e.i("H", 8)))
                else:
                    self.sim.add(c, self.start + e.i("H", 8), self.base)
            elif k == 1:
                step = max(1, e.i("H", 9))
                if e.hf & per:
                    for p in self.parts:
                        for t in range(p.delay + step, p.delay + p.life, step):
                            self.sim.pending.append(("particle", c, self, p, self.start + t))
                else:
                    for t in range(step, dur, step):
                        self.sim.add(c, self.start + t, self.base)
            else:
                for p in self.parts:
                    self.sim.pending.append(("particle", c, self, p, self.start + p.delay + p.life + e.i("H", 10)))


    def init(self, p):
        e, rng = self.e, self.sim.rng
        p.age = 0
        p.pos = spawn_offset(e, rng, p.f1)
        cf = e.cf
        if cf & 2:
            v = rng.v3(e.v3("C", 5), e.v3("C", 2))
            if cf & 0x38:
                r = rng.r15()
                for ax, bit in enumerate((8, 0x10, 0x20)):
                    if cf & bit and r & (1 << ax):
                        v[ax] = -v[ax]
            if cf & 0x80000:
                d = direction(e, rng, p.pos, p.f2)
                s = rng.fr(e.f("C", 13), e.f("C", 12)) if cf & 0x800000 else e.f("C", 12)
                if cf & 0x1000000 and rng.r15() % 3 == 0:
                    d = -d
                v = v + d * s
            p.vel, p.acc, p.drag = v, rng.v3(e.v3("C", 19), e.v3("C", 16)), e.f("C", 22)
        else:
            p.vel, p.acc, p.drag = np.zeros(3), np.zeros(3), 1.0
        p.inh = np.zeros(3)
        p.follow = e.f("C", 38) if cf & 0x40000000 else 0.0
        p.prev = p.pos - p.vel
        p.orbit = bool(cf & 0x4000)
        if p.orbit:
            inv = 1.0 / max(1, p.life)
            p.center = p.pos.copy()
            p.amp = e.v3("C", 23)
            p.damp = (e.v3("C", 26) - p.amp) * inv
            s0, s1 = e.v3("C", 29), e.v3("C", 32)
            r = rng.r15()
            for ax, bit in enumerate((0x8000, 0x10000, 0x20000)):
                if cf & bit and r & (2 << ax):
                    s0[ax], s1[ax] = -s0[ax], -s1[ax]
            p.spd, p.dspd = s0, (s1 - s0) * inv
            if cf & 0x20000000:
                p.phase = np.full(3, p.f2 * TAU)
            elif cf & 0x40000:
                p.phase = e.v3("C", 35)
            else:
                p.phase = np.array([rng.fr(-TAU, TAU) for _ in range(3)])
            p.pos = p.center + orbit_offset(p.amp, p.phase)

        af, af2 = e.af, e.af2
        p.rper = rng.ir(e.i("A", 3), e.i("A", 2)) or p.life
        p.rcnt = 0
        if af & 0x40:
            p.ang = rng.fr(e.f("A", 5), e.f("A", 4))
            p.avel0 = p.avel = rng.fr(e.f("A", 7), e.f("A", 6))
            p.aacc = rng.fr(e.f("A", 9), e.f("A", 8))
            p.adamp = e.f("A", 10)
        else:
            p.ang = p.avel0 = p.avel = p.aacc = 0.0
            p.adamp = 1.0
        p.fmode = 0 if af2 & 4 else (1 if af2 & 8 else (-1 if af2 & 0x10 else 0))
        p.flip = p.fspd = 0.0
        if p.fmode:
            p.flip = rng.fr(e.f("A", 12), e.f("A", 11))
            p.fspd = rng.fr(e.f("A", 14), e.f("A", 13))
            p.flip = wrap_flip(p.flip, p.fmode)

        colour_reset(e, rng, p)

        p.sper = rng.ir(e.i("A", 22), e.i("A", 21)) or p.life
        p.scnt = 0
        p.s0 = rand_size(e, rng, 23, af & 0x40000)
        if af & 0x20000000:
            p.s1 = rand_size(e, rng, 31, af2 & 1)
            p.smid = e.f("A", 35)
            if af & 0x80000000:
                p.s1 = p.s1 * p.s0
        else:
            p.s1, p.smid = p.s0.copy(), 0.0
        if af & 0x800:
            p.s2 = rand_size(e, rng, 27, af & 0x80000)
            if af & 0x4000000:
                p.s2 = p.s2 * p.s0
            elif af & 0x20000000 and af2 & 2:
                p.s2 = p.s2 * p.s1
        else:
            p.s2 = p.s0.copy()
        p.size = p.s0.copy()
        p.frame, p.fcnt = 0, 0
        p.waiting = False


    def update(self, p, owner_delta):
        e = self.e
        p.age += 1
        p.prev = p.pos.copy()
        if p.follow:
            p.inh = -p.follow * owner_delta
        p.vel = (p.vel + p.acc) * p.drag
        d = p.vel + p.inh
        if p.orbit:
            p.center += d
            p.amp += p.damp
            p.spd += p.dspd
            p.phase += p.spd
            p.pos = p.center + orbit_offset(p.amp, p.phase)
        else:
            p.pos += d
        if not self.boundary(p):
            return False

        p.rcnt += 1
        if p.rcnt >= p.rper:
            p.rcnt = 0
            if e.af & 0x40:
                p.avel = p.avel0
        else:
            p.avel = (p.avel + p.aacc) * p.adamp
            p.ang += p.avel
            p.flip = wrap_flip(p.flip + p.fspd, p.fmode) if p.fmode else 0.0

        p.ccnt += 1
        if p.ccnt >= p.cper:
            colour_reset(e, self.sim.rng, p)
        else:
            t = p.ccnt / p.cper
            if p.cmid > t:
                p.cfrom, p.cto, p.cfrac, p.cph = p.c0, p.c1, t / p.cmid, 0
            else:
                p.cfrom, p.cto, p.cph = p.c1, p.c2, 1
                p.cfrac = (t - p.cmid) / (1 - p.cmid) if p.cmid < 1 else 1.0

        p.scnt += 1
        if p.scnt >= p.sper:
            p.scnt = 0
        else:
            t = p.scnt / p.sper
            if p.smid > t:
                p.size = p.s0 + (p.s1 - p.s0) * (t / p.smid)
            else:
                p.size = p.s1 + (p.s2 - p.s1) * ((t - p.smid) / (1 - p.smid) if p.smid < 1 else 1.0)

        an = self.sim.anim(e)
        if an:
            if p.fcnt >= an[p.frame][0]:
                p.fcnt, p.frame = 0, (p.frame + 1) % len(an)
            else:
                p.fcnt += 1
        return True

    def boundary(self, p):
        e, fl = self.e, self.e.bf
        if not fl & 0x7F00000:
            return True
        lo, hi, k = e.v3("B", 5), e.v3("B", 8), e.f("B", 11)
        for bit, ax, out_hi in ((0x100000, 1, True), (0x200000, 1, False), (0x400000, 0, True), (0x800000, 0, False),
                                (0x1000000, 2, True), (0x2000000, 2, False)):
            if not fl & bit:
                continue
            lim = hi[ax] if out_hi else lo[ax]
            if (p.pos[ax] > lim) if out_hi else (p.pos[ax] < lim):
                if fl & 0x8000000:
                    return False
                if fl & 0x10000000:
                    for vec in (p.vel, p.inh):
                        if (vec[ax] > 0) if out_hi else (vec[ax] < 0):
                            vec[ax] = -k * vec[ax]
                    p.pos[ax] = lim
                elif fl & 0x20000000:
                    p.pos[ax] += (lo[ax] - hi[ax]) if out_hi else (hi[ax] - lo[ax])
        if fl & 0x4000000 and self.sim.floor is not None:
            wy = (p.pos[1] + self.base[1]) * self.sim.sy
            if wy < self.sim.floor:
                if fl & 0x8000000:
                    return False
                if fl & 0x10000000:
                    for vec in (p.vel, p.inh):
                        if vec[1] < 0:
                            vec[1] = -k * vec[1]
                    p.pos[1] = self.sim.floor / self.sim.sy - self.base[1]
        return True


def orbit_offset(a, ph):

    return np.array([a[2] * math.cos(ph[2]) + a[1] * math.sin(ph[1]),
                     a[0] * math.cos(ph[0]) + a[2] * math.sin(ph[2]),
                     a[0] * math.sin(ph[0]) + a[1] * math.cos(ph[1])])


def wrap_flip(a, mode):
    if mode > 0:
        while a < 0:
            a += TAU
    elif mode < 0:
        while a > 0:
            a -= TAU
    return a


def colour_reset(e, rng, p):
    p.cper = rng.ir(e.i("A", 16), e.i("A", 15)) or p.life
    p.ccnt = 0
    p.c0, p.c2, p.c1 = argb(e.u("A", 17)), argb(e.u("A", 18)), argb(e.u("A", 19))
    p.cmid = e.f("A", 20)
    p.cfrom, p.cto, p.cfrac, p.cph = p.c0, p.c1, 0.0, 0


class Sim:
    def __init__(self, bank, root, seed=1, floor=None, sxy=(1.0, 1.0), emitter_vel=(0.0, 0.0), rotate=0.0):
        self.bank, self.rng = bank, Rng(seed)
        self.rot = math.radians(rotate)
        self.floor, (self.sx, self.sy) = floor, sxy
        self.ev = np.array([emitter_vel[0], emitter_vel[1], 0.0])
        self.groups, self.pending = [], []
        self.add(root, 0, (0, 0, 0))

    def anim(self, e):
        k = e.i("A", 37)
        return self.bank.anims[k] if 0 <= k < len(self.bank.anims) else None

    def add(self, e, start, base):
        self.groups.append(Group(self, e, start, base))

    def step(self, t):
        """Advance to tick t and return the drawable particles [(group, particle)]."""
        for item in [x for x in self.pending if x[4] <= t]:
            self.pending.remove(item)
            if getattr(self, "stopped", False):
                continue
            _, c, g, p, _ = item
            pos = g.base + getattr(p, "pos", np.zeros(3))
            self.add(c, t, pos)
        out = []
        owner_delta = self.ev
        gi = 0
        while gi < len(self.groups):
            g = self.groups[gi]
            gi += 1
            if t < g.start:
                continue
            if not g.started:
                g.begin()
            e = g.e
            for p in g.parts:
                if not p.alive:
                    continue
                if p.waiting:
                    if p.delay > 0:
                        p.delay -= 1
                        continue
                    g.init(p)
                else:
                    ok = g.update(p, owner_delta)
                    expired = (e.hf & 8) and p.age >= p.life
                    if not ok or expired:
                        if ok and e.hf & 0x10 and not getattr(self, "stopped", False):
                            rng = self.rng
                            p.life = rng.ir(e.i("H", 5), e.i("H", 4))
                            p.delay = rng.ir(e.i("H", 7), e.i("H", 6))
                            if e.hf & 0x20 and e.hf & 0x40:
                                p.delay = 0
                                g.init(p)
                            else:
                                p.waiting = True
                                continue
                        else:
                            p.alive = False
                            continue
                out.append((g, p))
        return out

    def quad(self, g, p, tint, face_right, ppu):
        """-> (corners px 4x2 in y-up units*ppu, uv rect, rgba 0..1, blend, tex page)."""
        e = g.e
        w, h = p.size * e.f("B", 12)
        w, h = w * self.sx, h * self.sy
        loc = np.array([[-w / 2, h / 2], [w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]])
        ang = p.ang
        if e.af & 0x20000:
            dx, dy = (p.pos - p.prev)[:2]
            ang = math.atan2(-dx * self.sx, dy * self.sy)
        ang += self.rot
        flip = p.flip
        if face_right:
            ang = -ang
            if flip < 0:
                flip = -TAU - flip
        c, s = math.cos(ang), math.sin(ang)
        rot = loc @ np.array([[c, s], [-s, c]])
        if flip > 0:
            rot[:, 1] *= math.cos(flip)
        elif flip < 0:
            rot[:, 0] *= math.cos(flip)
        centre = (g.base + p.pos) * e.f("B", 12)
        cx, cy = centre[0] * self.sx, centre[1] * self.sy
        if self.rot:
            cr, sr = math.cos(self.rot), math.sin(self.rot)
            cx, cy = cx * cr - cy * sr, cx * sr + cy * cr
        pts = (rot + [cx, cy]) * ppu
        if face_right:
            pts[:, 0] = -pts[:, 0]
        x0, y0, x1, y1 = (e.f("A", 38 + k) for k in range(4))
        an = self.anim(e)
        if an:
            _, fx, fy, fw, fh = an[p.frame]
            x0, y0, x1, y1 = x0 + fx, y0 + fy, x0 + fx + fw, y0 + fy + fh
        col = p.cfrom + (p.cto - p.cfrom) * p.cfrac
        if tint is not None:
            gf, gt = (tint[0], tint[1]) if p.cph == 0 else (tint[1], tint[2])
            col = (p.cfrom * gf + (p.cto * gt - p.cfrom * gf) * p.cfrac) / 255.0
        return pts, (x0, y0, x1, y1), np.clip(col / 255.0, 0, 1), e.blend(), e.i("A", 43)




_TEX = {}


def texture(code):
    if code in _TEX:
        return _TEX[code]
    for p in (os.path.join(OUT, "pimg", code, "particle.dds"), os.path.join(LOCAL, "%s_pimg" % code, "particle.dds")):
        if os.path.exists(p):
            break
    else:
        pull([], images=(code,))
        p = os.path.join(OUT, "pimg", code, "particle.dds")
    b = open(p, "rb").read()
    h, w = struct.unpack_from("<II", b, 12)
    if struct.unpack_from("<I", b, 0x58)[0] == 32 and b[0x54:0x58] == b"\0\0\0\0":
        a = np.frombuffer(b, np.uint8, count=w * h * 4, offset=128).reshape(h, w, 4)[..., [2, 1, 0, 3]]
    else:
        a = np.asarray(Image.open(p).convert("RGBA"))
    _TEX[code] = np.ascontiguousarray(a)
    return _TEX[code]


def raster(buf, pts, uv, rgba, blend, tex, ox, oy):
    """Draw one textured parallelogram. pts: y-up pixel coords (c0,c1,c2 define it); buf = dict of float arrays."""
    H, W = buf["A"].shape
    P = pts.copy()
    P[:, 0] += ox
    P[:, 1] = oy - P[:, 1]
    xmin, xmax = int(math.floor(P[:, 0].min())), int(math.ceil(P[:, 0].max()))
    ymin, ymax = int(math.floor(P[:, 1].min())), int(math.ceil(P[:, 1].max()))
    xmin, ymin, xmax, ymax = max(xmin, 0), max(ymin, 0), min(xmax, W), min(ymax, H)
    if xmin >= xmax or ymin >= ymax:
        return
    ex, ey = P[1] - P[0], P[2] - P[0]
    det = ex[0] * ey[1] - ex[1] * ey[0]
    if abs(det) < 1e-6:
        return
    ys, xs = np.mgrid[ymin:ymax, xmin:xmax]
    dx, dy = xs + 0.5 - P[0][0], ys + 0.5 - P[0][1]
    s = (dx * ey[1] - dy * ey[0]) / det
    t = (ex[0] * dy - ex[1] * dx) / det
    m = (s >= 0) & (s <= 1) & (t >= 0) & (t <= 1)
    if not m.any():
        return
    x0, y0, x1, y1 = uv
    tu = x0 + s[m] * (x1 - x0) - 0.5
    tv = y0 + t[m] * (y1 - y0) - 0.5
    tu = np.clip(tu, x0, max(x0, x1 - 1.001))
    tv = np.clip(tv, y0, max(y0, y1 - 1.001))
    iu, iv = np.floor(tu).astype(int), np.floor(tv).astype(int)
    fu, fv = (tu - iu)[:, None], (tv - iv)[:, None]
    th, tw = tex.shape[:2]
    iu, iv = np.clip(iu, 0, tw - 2), np.clip(iv, 0, th - 2)
    T = lambda y, x: tex[y, x].astype(np.float32) * (1.0 / 255.0)
    smp = (T(iv, iu) * (1 - fu) * (1 - fv) + T(iv, iu + 1) * fu * (1 - fv) +
           T(iv + 1, iu) * (1 - fu) * fv + T(iv + 1, iu + 1) * fu * fv)
    c = smp * rgba
    a = c[:, 3:4]
    yy, xx = ys[m], xs[m]
    if blend == "add":
        buf["L"][yy, xx] += c[:, :3] * a
    else:
        if blend == "sub?":
            c = c.copy()
            c[:, :3] = 0.0
        buf["P"][yy, xx] = c[:, :3] * a + buf["P"][yy, xx] * (1 - a)
        buf["L"][yy, xx] = buf["L"][yy, xx] * (1 - a)
        buf["A"][yy, xx] = a[:, 0] + buf["A"][yy, xx] * (1 - a[:, 0])


def straight(buf):
    """Premultiplied normal layer + additive light -> straight-alpha RGBA (exact over black)."""
    P, L, A = buf["P"], buf["L"], buf["A"]
    tot = np.clip(P + L, 0, 1)
    ao = np.clip(np.maximum(A, tot.max(axis=2)), 0, 1)
    rgb = np.where(ao[..., None] > 1e-6, tot / np.maximum(ao[..., None], 1e-6), 0)
    return np.dstack([np.clip(rgb, 0, 1), ao])


def over_bg(buf, bg):
    return np.clip(buf["P"] + buf["L"] + np.array(bg, np.float32) / 255.0 * (1 - buf["A"][..., None]), 0, 1)



def cmd_list(a):
    bank = Bank(a.code)
    for e in bank.recs:
        links = [bank.link(e, k).name for k in range(3) if bank.link(e, k)]
        print("%3d %-28s cnt %3d-%-3d life %3d-%-3d blend %-6s tex %s %s" % (
            e.idx, e.name, e.i("H", 3), e.i("H", 2), e.i("H", 5), e.i("H", 4), e.blend(),
            "e0 " if e.i("A", 43) else a.code, ("-> " + ", ".join(links)) if links else ""))


def describe(e, bank, raw=False):
    L = ["%s  (#%d in %s)" % (e.name, e.idx, bank.code)]
    for blk, title in (("H", "header"), ("A", "visual"), ("B", "shape"), ("C", "motion")):
        L.append("[%s] %s" % (blk, title))
        for b, w, n, t, st in FIELDS:
            if b != blk or n == "pad":
                continue
            val = fmt_field(e, b, w, t)
            if not raw and t == "f" and e.f(b, w) == 0 and st != "unknown":
                continue
            if not raw and t == "i" and e.i(b, w) == 0 and n not in ("uvanim",):
                continue
            L.append("  +0x%02x %-18s %-34s %s" % (4 * w, n, val, st))
        for b, w, m, n, st in FLAGS:
            if b == blk:
                v = e.u(b, w) & m
                if v:
                    L.append("  flag %s%d & 0x%x = 0x%x  %s (%s)" % (b, w, m, v, n, st))
    an = bank.anims[e.i("A", 37)] if 0 <= e.i("A", 37) < len(bank.anims) else None
    if an:
        L.append("  flipbook %d: " % e.i("A", 37) + ", ".join("%dt@(%g,%g %gx%g)" % f for f in an))
    L.append("  blend %s, texture %s" % (e.blend(), "common e0" if e.i("A", 43) else bank.code))
    for k in range(3):
        c = bank.link(e, k)
        if c:
            L.append("  link%d -> %s" % (k + 1, c.name))
    return L


def cmd_info(a):
    bank = Bank(a.code)
    e = bank.get(a.name)
    print("\n".join(describe(e, bank, a.raw)))
    for u in script_uses(a.code, e.name)[:12]:
        print("  used by %s %s (cmd %d) tint sub %s entries %s %s" % (u["script"], u["state"], u["cmd"], u["sub"],
                                                                      u["entries"], u["other"] or ""))


def resolve_tint(a, bank, e):
    if a.tint == "none":
        return None, "none"
    if a.tint != "auto":
        c = [float(x) for x in a.tint.split(",")]
        c = np.array((c + [255.0])[:4])
        return [c, c, c], "manual %s" % a.tint
    for u in script_uses(bank.code, e.name):
        if u["entries"]:
            cols = palette_colours(bank.code, a.palette, u["sub"], u["entries"])
            if cols:
                return cols, "script %s: palette %02d sub %d entries %s" % (u["state"], a.palette, u["sub"], u["entries"])
    return None, "none (no 4047 before any spawn)"


def cmd_render(a):
    bank = Bank(a.code)
    e = bank.get(a.name)
    tint, tint_src = resolve_tint(a, bank, e)
    ev = [float(x) for x in a.emitter_vel.split(",")]
    sxy = [float(x) for x in a.scale_xy.split(",")]
    floor = a.floor
    if floor is None and any(bank.recs[i].bf & 0x4000000 for i in chain_ids(bank, e)):
        floor = -60.0
    sim = Sim(bank, e, a.seed, floor, sxy, ev, a.rotate)
    frames, alive, births = [], [], []
    for t in range(a.ticks):
        dr = sim.step(t)
        q = [sim.quad(g, p, tint, a.face_right, a.ppu) for g, p in dr]
        births += [qq[0] for qq, (g, p) in zip(q, dr) if p.age == 0]
        frames.append(q)
        alive.append(len(q))
    pts = [f[0] for fr in frames for f in fr]
    if not pts:
        raise SystemExit("nothing drawn in %d ticks" % a.ticks)
    allp = np.vstack(pts)
    xmin, xmax = min(allp[:, 0].min(), -8), max(allp[:, 0].max(), 8)
    ymin, ymax = min(allp[:, 1].min(), -8), max(allp[:, 1].max(), 8)
    if floor is not None:
        ymin = min(ymin, floor * a.ppu - 8)
    view = "all particles"
    if a.view == "all":
        view = "all particles (forced)"
    elif a.view:
        vx0, vy0, vx1, vy1 = (float(v) * a.ppu for v in a.view.split(","))
        xmin, ymin, xmax, ymax = min(vx0, vx1), min(vy0, vy1), max(vx0, vx1), max(vy0, vy1)
        view = "--view %s units" % a.view
    elif max(xmax - xmin, ymax - ymin) > 2.5 * a.max_canvas and births:
        bp = np.vstack(births)
        bx0, bx1, by0, by1 = bp[:, 0].min(), bp[:, 0].max(), bp[:, 1].min(), bp[:, 1].max()
        mx, my = max(0.25 * (bx1 - bx0), 40), max(0.25 * (by1 - by0), 40)
        xmin, xmax = max(xmin, bx0 - mx), min(xmax, bx1 + mx)
        ymin, ymax = max(ymin, by0 - my), min(ymax, by1 + my)
        view = "spawn area x1.5 (particles travel further)"
    pad = 12
    W, H = int(xmax - xmin) + 2 * pad, int(ymax - ymin) + 2 * pad
    k = min(1.0, a.max_canvas / max(W, H))
    W, H = max(8, int(W * k)), max(8, int(H * k))
    ox, oy = (-xmin + pad) * k, (ymax + pad) * k
    texs = {0: texture(a.code), 1: texture("e0")}
    name = e.name
    fdir = os.path.abspath(a.frames_dir or os.path.join(OUT, name))
    if not fdir.lower().startswith(os.path.abspath(LOCAL).lower() + os.sep):
        raise SystemExit("--frames-dir must be under %s (derived game data stays local)" % LOCAL)
    os.makedirs(fdir, exist_ok=True)
    first = next((t for t, n in enumerate(alive) if n), 0)
    last = max((t for t, n in enumerate(alive) if n), default=0)
    span = list(range(first, last + 1))
    n = min(a.sheet_cells, len(span))
    want = sorted({span[round(i * (len(span) - 1) / max(1, n - 1))] for i in range(n)})
    cw, ch = min(W, 360), min(H, 360)
    sc = min(cw / W, ch / H)
    cw, ch = max(1, int(W * sc)), max(1, int(H * sc))
    pick = []
    for t, fr in enumerate(frames):
        buf = {"P": np.zeros((H, W, 3), np.float32), "L": np.zeros((H, W, 3), np.float32), "A": np.zeros((H, W), np.float32)}
        for pts_, uv, rgba, blend, page in fr:
            raster(buf, pts_ * k, uv, rgba.astype(np.float32), blend, texs[page], ox, oy)
        img = straight(buf)
        Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(fdir, "frame_%04d.png" % t))
        if t in want:
            pick.append((t, Image.fromarray((over_bg(buf, (58, 58, 66)) * 255 + 0.5).astype(np.uint8), "RGB")
                         .resize((cw, ch), Image.LANCZOS)))
        del buf, img

    n = len(pick)
    cols = min(6, max(1, n))
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cw + 6) + 6, rows * (ch + 22) + 30), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    d.text((6, 6), "%s  seed %d  tint %s  ppu %.2f x%.2f  blend %s" % (name, a.seed, tint_src, a.ppu, k, e.blend()),
           fill=(230, 230, 230))
    for i, (t, im) in enumerate(pick):
        x, y = 6 + (i % cols) * (cw + 6), 26 + (i // cols) * (ch + 22)
        sheet.paste(im, (x, y))
        cx, cy = x + ox * sc, y + oy * sc
        d.line((cx - 5, cy, cx + 5, cy), fill=(0, 200, 255))
        d.line((cx, cy - 5, cx, cy + 5), fill=(0, 200, 255))
        if floor is not None:
            fy = y + (oy - floor * a.ppu * k) * sc
            d.line((x, fy, x + cw, fy), fill=(120, 90, 40))
        d.text((x + 2, y + ch + 3), "t=%d (%d)" % (t, len(frames[t])), fill=(200, 200, 200))
    sp = os.path.join(OUT, "%s_sheet.png" % os.path.basename(fdir))
    sheet.save(sp)
    print("%s: %d ticks, drawn ticks %d..%d, peak %d particles, canvas %dx%d (x%.2f), view %s, tint %s" % (
        name, a.ticks, first, last, max(alive), W, H, k, view, tint_src))
    print("frames:", fdir)
    print("sheet :", sp)


def chain_ids(bank, e, seen=None):
    seen = seen if seen is not None else set()
    if e.idx in seen:
        return seen
    seen.add(e.idx)
    for k in range(3):
        c = bank.link(e, k)
        if c:
            chain_ids(bank, c, seen)
    return seen


def cmd_atlas(a):
    bank = Bank(a.code)
    own = texture(a.code).astype(np.float32) / 255.0
    H, W = own.shape[:2]
    chk = ((np.indices((H, W)).sum(axis=0) // 16) % 2)[..., None] * 40 + 60
    rgb = own[..., :3] * 255 * own[..., 3:4] + chk * (1 - own[..., 3:4])
    img = Image.fromarray(rgb.astype(np.uint8), "RGB").resize((W * 2, H * 2), Image.NEAREST)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 64):
        d.line((2 * x, 0, 2 * x, 2 * H), fill=(90, 90, 110))
        d.text((2 * x + 2, 2), str(x), fill=(160, 160, 190))
    for y in range(0, H, 64):
        d.line((0, 2 * y, 2 * W, 2 * y), fill=(90, 90, 110))
        d.text((2, 2 * y + 2), str(y), fill=(160, 160, 190))
    cells = {}
    for e in bank.recs:
        r = tuple(int(e.f("A", 38 + k)) for k in range(4)) + (e.i("A", 43),)
        cells.setdefault(r, []).append(e.idx)
    for (x0, y0, x1, y1, page), ids in sorted(cells.items()):
        if page == 0:
            d.rectangle((2 * x0, 2 * y0, 2 * x1 - 1, 2 * y1 - 1), outline=(255, 220, 0), width=2)
            d.text((2 * x0 + 4, 2 * y0 + 14), ",".join(map(str, ids))[:40], fill=(255, 255, 0))
    p1 = os.path.join(OUT, "atlas.png" if a.code == "rrb" else "atlas_%s.png" % a.code)
    img.save(p1)

    com = [(r, ids) for r, ids in sorted(cells.items()) if r[4] == 1]
    e0 = texture("e0")
    tile = 160
    sheet = Image.new("RGB", (max(1, min(6, len(com))) * (tile + 8) + 8, ((len(com) + 5) // 6) * (tile + 34) + 8), (18, 18, 22))
    d2 = ImageDraw.Draw(sheet)
    for i, ((x0, y0, x1, y1, _), ids) in enumerate(com):
        c = e0[y0:y1, x0:x1].astype(np.float32) / 255.0
        hh, ww = c.shape[:2]
        ck = ((np.indices((hh, ww)).sum(axis=0) // 8) % 2)[..., None] * 40 + 60
        im = Image.fromarray((c[..., :3] * 255 * c[..., 3:4] + ck * (1 - c[..., 3:4])).astype(np.uint8), "RGB")
        im.thumbnail((tile, tile))
        x, y = 8 + (i % 6) * (tile + 8), 8 + (i // 6) * (tile + 34)
        sheet.paste(im, (x, y))
        d2.text((x, y + tile + 2), "e0 %d,%d %dx%d" % (x0, y0, x1 - x0, y1 - y0), fill=(220, 220, 220))
        d2.text((x, y + tile + 16), ",".join(map(str, ids))[:28], fill=(255, 220, 0))
    p2 = os.path.join(OUT, "atlas_e0_used_by_%s.png" % a.code)
    sheet.save(p2)
    print(p1)
    print(p2)
    for (x0, y0, x1, y1, page), ids in sorted(cells.items(), key=lambda kv: kv[1][0]):
        print("%-4s rect %4d,%4d-%4d,%4d  %s" % ("e0" if page else a.code, x0, y0, x1, y1,
                                                  ", ".join(bank.recs[i].name for i in ids)))


def cmd_stats(a):
    base = os.path.join(OUT, "pdat")
    codes = sorted(os.listdir(base)) if os.path.isdir(base) else []
    if not codes:
        raise SystemExit("run 'pull' with codes first")
    recs = [e for c in codes for e in Bank(c).recs]
    print("%d emitters in %d sets" % (len(recs), len(codes)))
    for b, w, n, t, st in FIELDS:
        vals = [e.u(b, w) for e in recs]
        nz = sum(1 for v in vals if v)
        if t == "f":
            fv = [e.f(b, w) for e in recs if e.u(b, w)]
            rng_ = "%.4g..%.4g" % (min(fv), max(fv)) if fv else "-"
        else:
            iv = [e.i(b, w) for e in recs if e.u(b, w)]
            rng_ = "%d..%d" % (min(iv), max(iv)) if iv else "-"
        print("%s+0x%02x %-18s nonzero %5d  distinct %5d  range %s" % (b, 4 * w, n, nz, len(set(vals)), rng_))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd")
    p = sp.add_parser("pull")
    p.add_argument("codes", nargs="*", default=["rrb", "e0"])
    p = sp.add_parser("list")
    p.add_argument("--code", default="rrb")
    p = sp.add_parser("info")
    p.add_argument("name")
    p.add_argument("--code", default="rrb")
    p.add_argument("--raw", action="store_true")
    p = sp.add_parser("render")
    p.add_argument("name")
    p.add_argument("--code", default="rrb")
    p.add_argument("--ticks", type=int, default=90)
    p.add_argument("--frames-dir")
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--tint", default="auto")
    p.add_argument("--palette", type=int, default=0)
    p.add_argument("--face-right", action="store_true")
    p.add_argument("--ppu", type=float, default=2.2)
    p.add_argument("--scale-xy", default="1,1")
    p.add_argument("--emitter-vel", default="0,0")
    p.add_argument("--floor", type=float)
    p.add_argument("--rotate", type=float, default=0.0)
    p.add_argument("--view")
    p.add_argument("--max-canvas", type=int, default=1400)
    p.add_argument("--sheet-cells", type=int, default=24)
    p = sp.add_parser("atlas")
    p.add_argument("--code", default="rrb")
    sp.add_parser("stats")
    a = ap.parse_args()
    if a.cmd == "pull":
        pull(a.codes)
        print("pulled", a.codes, "->", OUT)
    elif a.cmd == "list":
        cmd_list(a)
    elif a.cmd == "info":
        cmd_info(a)
    elif a.cmd == "render":
        cmd_render(a)
    elif a.cmd == "atlas":
        cmd_atlas(a)
    elif a.cmd == "stats":
        cmd_stats(a)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
