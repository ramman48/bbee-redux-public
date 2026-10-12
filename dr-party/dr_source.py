"""dr_source.py -- DELTARUNE sprites as a frame source for the native sprite rig builder (tools/bbtag/bbtag_rig.py).

Frames are read at build time from the PLAYER'S OWN DELTARUNE install (Chapter 5) with the reader in
tools/deltarune/research_scratch (Core's research version, until its library ships). Nothing read here is stored in
the mod: decoded frames are cached under local_only/deltarune/party/frames/ and the rig goes to the build folder.

The look (the lead, 2026-10-02): large visible pixels, and the party slightly smaller than the enemies. After playing
0.1.0 the lead said "kris is just way too big and tall all of them are the same size as the enemies when they should be
slightly smaller than the enemy same for ralsei and susie" (0.1.0 had Kris at Platinum's height, 1.685 units). The
reference is now the test room's ninja (350501), 1.45 units tall (animview ninja_stand): Kris is 80 % of it, 1.16
units, and his side-view idle is 36 DELTARUNE pixels, so one DELTARUNE pixel is 1.16 / 36 = 0.0322 units for the whole
party (Susie and Ralsei keep their sizes relative to Kris: 1.39 and 1.26 units, both under the ninja). Frames are
scaled up by a whole number K with nearest-neighbour before they go on the sheets, so the pixels stay square.

A frame key is "<sprite>:<index>", e.g. "spr_kris_plat_idle:0". DELTARUNE draws a sprite at its origin, near the
body's centre; the rig's root is the feet. Every sprite of one character is rooted FEET[character] DELTARUNE pixels
below its origin (measured on the idle), so the game's own relative placement of all its sprites is kept.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SCRATCH = ROOT / "tools" / "deltarune" / "research_scratch"
CACHE = ROOT / "local_only" / "deltarune" / "party" / "frames"
# 0.6.4: an alpha TEST package carries the frames the build uses (dr_pack.py; the lead, 2026-10-03). With a pack the
# install is never opened; without one nothing changes. DRPARTY_RECORD=<file>: every sprite name a build asks for is
# written into it (make_pack.py copies exactly those)
import os as _os
if str(pathlib.Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import dr_pack
if dr_pack.active():
    CACHE = dr_pack.path("frames")
_RECORDED = set()

NINJA_HEIGHT = 1.45              # units: the test room's ninja 350501 (animview ninja_stand), the coordinator 2026-10-02
KRIS_HEIGHT = 0.8 * NINJA_HEIGHT # 1.16: "slightly smaller than the enemy" (0.1.0: Platinum's 1.685)
KRIS_IDLE_PX = 36                # spr_kris_plat_idle frame 0, opaque height
UNIT_PER_PX = KRIS_HEIGHT / KRIS_IDLE_PX

# DELTARUNE pixels from a sprite's origin down to the feet, per character (idle: bottom of the opaque area - origin y)
FEET = {"kris": 18, "susie": 22, "ralsei": 24}
# sprites whose origin is not on the body (DELTARUNE places them by hand in a cutscene): rooted at the bottom of what
# is drawn, this many DELTARUNE pixels in from its back (left) edge (Ralsei's idle is 20 wide, origin at 10).
# (r3: Ralsei's fireball cast moved to CANVAS_ROOT: each frame's drawn area starts at a different x (13, 11, 11, 6, 0,
# 8 px), so a root measured from it moved 13 px through the cast)
BACK_EDGE = {}
# sprites with their origin at (0, 0), rooted at a hand-set point of their own canvas (DELTARUNE pixels, edges):
#   Ralsei's fireball cast (48 x 41): his feet are centred at x 24.0-24.5 on every frame and the canvas bottom is the
#     floor (row 40 is the last drawn); his idle's root sits 1.5 px left of its feet centre, so the cast's is (23, 41)
#   the fireball (34 x 20): the centre of its yellow core, which is where the projectile is
#   the companions' double-jump balls (their origin is the ball's bottom): the ball's centre on the body's centre, as
#     Kris's ball sits (spr_plat_kris_ball, origin at its centre, 18 px over the feet = half of Kris): Susie is 43 px
#     tall, her 30 px ball's bottom 6.5 px over her feet; Ralsei 39 px, his 20 px ball's bottom 9.5 px over his
# (0.4.3: the stronger runs are overworld sprites with a corner origin: root = the feet, mid-body, on the ground line)
CANVAS_ROOT = {"spr_susie_run_right": (20, 39), "spr_ralsei_running_right": (15, 40),
               # (0.5.0: the dance and laugh strips, overworld sprites too)
               "spr_kris_dance": (11, 31), "spr_susie_dance": (16, 43), "spr_ralsei_dance": (14, 42), "spr_susie_laugh_dw": (14, 41),
               "spr_plat_ralsei_spell_fireball_right": (23, 41), "spr_spell_fireball": (24, 8),
               "spr_plat_susie_jump_ball": (14, 36), "spr_plat_ralsei_jump_ball": (10, 30)}
# effect sprites rooted at their own origin (their centre), not at a character's feet: the projectile that plays one
# sits where DELTARUNE would draw it (the Rude Buster bolt: 43 x 62, origin 20, 30)
ORIGIN_ROOT = {"spr_rudebuster_beam", "spr_smack_vfx", "spr_dash_ripple"}
# Kris's slash smears come out of the body frames (the lead, 2026-10-02: "the smears are gone and replaced with vfx we
# make"; Kris's slashes are kit effects, docs/deltarune/party/VFX.md). DELTARUNE bakes each smear into the body frame
# AND draws it again as <sprite>_foreground over Kris; every foreground pixel is identical in the body frame (checked
# 2026-10-02 on all 13 + 17 frames), so the smear is removed by clearing the body wherever the foreground draws, and
# Kris underneath is whole (smear_split.png in local_only/deltarune/party/smear/). Not cleared: the straight blades in
# ground frames 7-8 (the sword in front of Kris, not a smear); the air strip's frames 1 and 5 carry a smear with no
# foreground but are only in the unused full air clip.
DESMEAR = {"spr_kris_plat_slash_ground": {1, 2, 5, 6, 9, 10}, "spr_kris_plat_slash_air": {9, 10, 11, 12, 13}}
# The companions' casts carry their effect in the body frame too (the lead, 2026-10-02: "do the same for susies axe
# and all the busters and the same for ralseis fire and fire shock"). Ralsei's fireball cast has no foreground layer, but
# its fire uses colours his body never does: pixels whose colour is absent from the clean frames listed are cleared,
# then specks under 12 px that no longer touch the body (desmear_spr_plat_ralsei_spell_fireball_right.png). Frame 3 (the
# throw, mostly fire) is not used: party_clips shows frame 4 there. Susie's axe arcs (spr_susiep_attack 0-1) share her
# own colours, so those two frames are dropped from her cast instead (party_clips) and the kit swing plays there.
DEPALETTE = {"spr_plat_ralsei_spell_fireball_right": ((5,), {0, 1, 2, 4})}


def _components(mask):
    """4-connected components of a boolean mask -> (labels, sizes)."""
    lab = np.zeros(mask.shape, np.int32); sizes = [0]
    H, W = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n = len(sizes); lab[y0, x0] = n; st = [(y0, x0)]; c = 0
        while st:
            y, x = st.pop(); c += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
        sizes.append(c)
    return lab, sizes


def character_of(sprite):
    s = sprite.lower()
    for name in ("susie", "ralsei"):
        if name in s:
            return name
    return "kris"


class Frames:
    """DELTARUNE sprites by name, decoded once (cached as PNG frames plus origins)."""

    def __init__(self, cache=CACHE):
        self.cache = pathlib.Path(cache)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.meta_p = self.cache / "meta.json"
        self.meta = json.loads(self.meta_p.read_text()) if self.meta_p.exists() else {}
        self._g = None

    def _reader(self):
        if dr_pack.active():
            dr_pack.missing("a sprite")
        if self._g is None:
            sys.path.insert(0, str(SCRATCH))
            import gmdata   # noqa: E402  (read-only on the install)
            import sheet    # noqa: E402
            self._g, self._sheet = gmdata.GM(), sheet
            self._by = {s["name"]: s for s in self._g.sprites}
        return self._g

    def info(self, name):
        rec = _os.environ.get("DRPARTY_RECORD")
        if rec and name not in _RECORDED:
            _RECORDED.add(name)
            with open(rec, "a", encoding="utf-8") as f:
                f.write(name + "\n")
        if name not in self.meta and dr_pack.active():
            dr_pack.missing("the sprite " + name)
        if name not in self.meta:
            g = self._reader()
            s = self._by[name]
            for i in range(s["frames"]):
                self._sheet.frame(g, s, i).save(self.cache / f"{name}_{i}.png")
            self.meta[name] = {"frames": s["frames"], "ox": s["ox"], "oy": s["oy"], "w": s["w"], "h": s["h"]}
            self.meta_p.write_text(json.dumps(self.meta, indent=0))
        return self.meta[name]

    def get(self, name, i):
        m = self.info(name)
        return Image.open(self.cache / f"{name}_{i}.png").convert("RGBA"), (m["ox"], m["oy"])

    def body(self, name, i):
        """get(), with the slash smear cleared on the DESMEAR frames and effect colours on the DEPALETTE frames."""
        im, o = self.get(name, i)
        if i in DESMEAR.get(name, ()):
            a, f = np.array(im), np.array(self.get(name + "_foreground", i)[0])
            a[f[..., 3] > 0] = 0
            im = Image.fromarray(a)
        if name in DEPALETTE and i in DEPALETTE[name][1]:
            pal = set()
            for j in DEPALETTE[name][0]:
                r = np.array(self.get(name, j)[0]); pal |= set(map(tuple, r[r[..., 3] > 0][:, :3].tolist()))
            a = np.array(im); m = a[..., 3] > 0
            keep = np.array([tuple(c) in pal for c in a[..., :3].reshape(-1, 3).tolist()]).reshape(m.shape) & m
            lab, sizes = _components(keep)
            big = int(np.argmax(sizes))
            ok = np.isin(lab, [k for k in range(1, len(sizes)) if k == big or sizes[k] >= 12])
            a[~ok] = 0
            im = Image.fromarray(a)
        return im, o

    def count(self, name):
        return self.info(name)["frames"]


class DRSource:
    """The interface bbtag_rig.build_rig expects: code, palette, scale, scale_mul, frame(key), mul(key)."""

    def __init__(self, k=8, frames=None):
        self.k = k
        self.code = f"dr_party_k{k}"           # build_rig's frame cache keys on code + palette
        self.palette = "ch5-r6"                 # change whenever frame() / the scale changes (r2: ORIGIN_ROOT; r3: CANVAS_ROOT; r4: 1.16 u; r5: DESMEAR; r6: DEPALETTE)
        self.scale = UNIT_PER_PX / k            # world units per sheet texel
        self.scale_mul = []
        self.frames = frames or Frames()

    def mul(self, key):
        return 1.0

    def frame(self, key):
        """-> (RGBA uint8 array cropped to what is drawn, (root x, root y) inside it, in sheet texels)."""
        if key == "null" or ":" not in key:
            return np.zeros((2, 2, 4), np.uint8), (1, 1)
        name, idx = key.rsplit(":", 1)
        im, (ox, oy) = self.frames.body(name, int(idx))
        bb = im.getchannel("A").getbbox()
        if not bb:
            return np.zeros((2, 2, 4), np.uint8), (1, 1)
        k = self.k
        crop = im.crop(bb)
        big = crop.resize((crop.width * k, crop.height * k), Image.NEAREST)
        if name in CANVAS_ROOT:    # a hand-set root on the sprite's own canvas
            cx, cy = CANVAS_ROOT[name]
            return np.array(big), ((cx - bb[0]) * k, (cy - bb[1]) * k)
        if name in BACK_EDGE:      # origin in the corner: root = the feet, a body's half-width in from the back edge
            return np.array(big), (BACK_EDGE[name] * k, crop.height * k)
        if name in ORIGIN_ROOT:    # an effect: root = its origin
            return np.array(big), ((ox - bb[0]) * k, (oy - bb[1]) * k)
        feet = FEET[character_of(name)]
        return np.array(big), ((ox - bb[0]) * k, (oy + feet - bb[1]) * k)


def ticks(image_speed):
    """60-tick frame lengths for a DELTARUNE image_speed (sprite frames per 30 fps game frame), as a repeating pattern
    that keeps the exact average (e.g. 0.6 -> 3, 4, 3, 3, 4, 3 ...)."""
    per = 2.0 / image_speed
    out, acc, t = [], 0, 0.0

    def gen():
        nonlocal acc, t
        while True:
            t += per
            n = int(round(t)) - acc
            acc += n
            yield max(1, n)
    return gen()


def strip(name, image_speed, frames=None, indices=None, hold_last=0, src_frames=None):
    """[(frame key, ticks)] for a whole sprite (or some of its frames) at a DELTARUNE speed."""
    fr = src_frames or Frames()
    idx = list(indices) if indices is not None else list(range(fr.count(name)))
    g = ticks(image_speed)
    seq = [(f"{name}:{i}", next(g)) for i in idx]
    if hold_last:
        seq[-1] = (seq[-1][0], seq[-1][1] + hold_last)
    return seq
