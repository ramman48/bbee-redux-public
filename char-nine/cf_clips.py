"""cf_clips.py -- the clips of Nine's Centralfiction layer (data only: sprite and clip names, timings).

Each clip exists in two builds with the same name and the same length, so the moves that play it never change:
  CF       her BlazBlue Centralfiction sprites (the player's own install), on her own role "ninx";
  FALLBACK frames of her BBEE boss rig (the player's own BBEE install), spliced to the same phases.
import_cf.py builds one or the other at build time. Neither is stored in the mod folder.

Timing: 60 ticks a second. PHASES name the beats the move's data is timed to (build_nine.py flame_punisher()).
"""

ROLE = "ninx"
SKIN = "02"



PUNISHER_PHASES = [("windup", 44), ("palm", 30), ("spin", 15), ("kick", 39), ("recover", 27)]


def _loop(names, ticks, n):
    return [(s, ticks) for _ in range(n) for s in names]


CF = {
    "ninx_flamepunisher":
        [("ph430_00", 3), ("ph430_01", 3), ("ph430_02", 10), ("ph430_03", 5), ("ph430_04", 5), ("ph430_05", 8),
         ("ph430_06", 4), ("ph430_07", 4), ("ph430_08", 2)]
        + [("ph430_09", 3)] + _loop(("ph430_10", "ph430_11", "ph430_12"), 3, 3)
        + [("ph430_13", 3), ("ph430_14", 3), ("ph430_15", 3), ("ph430_16", 3), ("ph430_17", 3)]
        + [("ph430_18", 3)] + _loop(("ph430_19", "ph430_20", "ph430_21"), 3, 4)
        + [("ph430_22", 5), ("ph430_23", 5), ("ph430_24", 5), ("ph430_25", 4), ("ph430_26", 4), ("ph430_27", 4)],
}




FALLBACK_MESH = "actor/mesh/ph/magic"
FALLBACK_DONOR = "ph_magic_AC_atk"
FALLBACK = {
    "ninx_flamepunisher":
        [("ph_magic_AC_pre", i, 4) for i in range(11)]
        + [("ph_magic_AC_atk", 2, 3), ("ph_magic_AC_atk", 3, 3)]
        + [("ph_magic_AC_atk", i, 3) for i in range(4, 12)]
        + [("ph_magic_AC_atk", i, 5) for i in (12, 0, 1)]
        + [("ph_magic_AC_atk", 2, 3), ("ph_magic_AC_atk", 3, 3)]
        + [("ph_magic_AC_atk", i, 3) for i in (4, 5, 6, 7, 8, 9, 10, 11, 4, 5, 6)]
        + [("ph_magic_AC_atk", 12, 5), ("ph_magic_AC_atk", 13, 6), ("ph_magic_AC_atk", 14, 6),
           ("ph_magic_AC_atk", 15, 5), ("ph_magic_AC_atk", 16, 5)],
}



import cf_arts as _ARTS
FALLBACK_DONORS = {}
for _n, _m in list(_ARTS.MOVES.items()) + [(_ARTS.TOGGLE, _ARTS.TOGGLE_CLIP)]:
    CF[_m["clip"]] = list(_m["body"])
    _donor, _frames = _m["fallback"]
    FALLBACK[_m["clip"]] = [(_donor, i, t) for i, t in _frames]
    FALLBACK_DONORS[_m["clip"]] = _donor



PAIRS = [("ph_stand", 0, "ph000_00"), ("ph_show_hat", 3, "ph300_05"), ("ph_214B", 3, "ph401_03"),
         ("ph_magic_AC_atk", 5, "ph204_10"), ("ph_A1_atk", 2, "ph200_02"), ("ph_ODOD_pre", 12, "ph430_37"),
         ("ph_magic_AB_atk", 4, "ph331_06"), ("ph_214C", 5, "ph402_02"), ("ph_magic_BBA_all", 6, "ph312_06")]


ROOT_LIFT_PX = 5
OUTLINE_R = 5


def ticks(seq):
    return sum(t for *_, t in seq)


def check():
    total = sum(t for _, t in PUNISHER_PHASES)
    for name in CF:
        want = total if name == "ninx_flamepunisher" else ticks(CF[name])
        assert ticks(CF[name]) == want, (name, ticks(CF[name]), want)
        assert ticks(FALLBACK[name]) == want, (name, ticks(FALLBACK[name]), want)
    _ARTS.check()
    return total


if __name__ == "__main__":
    print("Flame Punisher: %d ticks (%.3f s), both builds" % (check(), check() / 60.0))
