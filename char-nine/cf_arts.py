"""cf_arts.py -- Nine's Magic Arts stance (0.8.3): her Centralfiction normals on her Attack button (data only).

The design brief (2026-09-29): add her alternate attacks to her kit, on a button that changes
what attacks she does. Back + Summon toggles the stance; while it's on, a ReplaceAction buff swaps her attack chain for
CF's normals (build_nine.py arts()):
  ground  C1 -> 5A (water), B1 -> 5B (wind), C2 -> 5C (fire)      her neutral Attack chain
  air     C1_air -> j.A (water), B1_air -> j.B (wind)
CF colours its A / B / C normals blue / green / red (PowerUpFlashBlue / Green / Red on tick 3 of each), the colours of
her water / wind / fire, so each normal gives its element: the full ground chain gives one of each.

Every number below is CF's own (read from an installed copy of BBCF, 2026-09-29): 60 ticks a
second; "hit" = the ticks the body sprite's hit boxes are armed (0-based, end exclusive) and the union of its boxes in
BBEE's orientation (px ahead of her root, px above it); "fx" = the CF effect state spawned on that tick (rendered from
the player's CF at build time by cf_fx.py: 3D models through tools/bbtag/bbtag_mua.py, 2D sprites through cf_fx.CF).
Nothing here is art: names and numbers only."""

ELEMENT = {"A": "ph_water", "B": "ph_wind", "C": "ph_fire"}








BP_SPLASH = "Benediction/BoonsPlus/Water/bp_w03_skillsplash"









MOVES = {

    "cf_5A": {
        "clip": "ninx_5a", "button": "A", "replaces": "C1", "air": False,
        "body": [("ph200_00", 3), ("ph200_01", 3), ("ph200_02", 2), ("ph200_03", 6), ("ph200_04", 5), ("ph200_05", 5),
                 ("ph200_06", 5), ("ph200_07", 5)],
        "hit": (8, 11), "box": [(111, 97, 459, 345)],
        "fx": [("ph200_eff", 8, "3d")],


        "rt": [("Monster/Ph/NineArts/nine_arts_5a", 8, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_ice",
        "rt_box": (0.4, 0.0, 18.0, 2.2), "rt_hit": (8, 15),
        "sfx": [("sfx_ph_A1_pre", 6)],
        "fallback": ("ph_A1_atk", [(i, t) for i, t in enumerate((3, 3, 2, 6, 5, 5, 5, 5))]),
    },
    "cf_5B": {
        "clip": "ninx_5b", "button": "B", "replaces": "B1", "air": False,
        "body": [("ph201_00", 3), ("ph201_01", 3), ("ph201_02", 3), ("ph201_03", 2), ("ph201_04", 3), ("ph201_05", 3),
                 ("ph201_06", 6), ("ph201_07", 5), ("ph201_08", 5), ("ph201_09", 5)],
        "hit": (11, 17), "box": [(19, 137, 513, 274), (66, 128, 642, 304)],
        "fx": [("ph201_eff", 11, "3d")],



        "rt": [("Monster/Ph/NineArts/nine_arts_5b", 11, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_wind",
        "rt_box": (0.6, 0.0, 18.0, 3.0), "rt_hit": (11, 20),
        "sfx": [("vo_ph_B1", 9), ("sfx_ph_B1", 11)],
        "fallback": ("ph_B1", [(0, 4), (1, 4), (2, 6), (3, 6), (4, 6), (5, 6), (6, 6)]),
    },
    "cf_5C": {
        "clip": "ninx_5c", "button": "C", "replaces": "C2", "air": False,
        "body": [("ph202_00", 3), ("ph202_01", 4), ("ph202_02", 4), ("ph202_03", 6), ("ph202_04", 6), ("ph202_05", 6),
                 ("ph202_06", 5), ("ph202_07", 5)],
        "hit": (11, 14), "box": [(84, 140, 597, 274)],
        "fx": [("ph202_eff", 11, "3d")],

        "rt": [("Monster/Ph/NineArts/nine_arts_5c", 11, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_fire",
        "rt_box": (0.5, 0.0, 18.0, 2.2), "rt_hit": (11, 15),
        "sfx": [("vo_ph_C1", 9), ("sfx_ph_C2_p1", 11)],
        "launch": True,
        "fallback": ("ph_C1", [(0, 3), (1, 4), (2, 4), (3, 6), (4, 6), (5, 6), (6, 5), (7, 5)]),
    },
    "cf_j5A": {
        "clip": "ninx_j5a", "button": "A", "replaces": None, "air": True, "next": ("cf_j5B", 10),
        "body": [("ph250_00", 3), ("ph250_01", 2), ("ph250_02", 2), ("ph250_03", 3), ("ph250_04", 5), ("ph250_05", 5),
                 ("ph250_06", 5), ("ph250_07", 5), ("ph250_08", 5)],
        "hit": (7, 10), "box": [(-19, 223, 461, 458)],
        "fx": [("ph250_eff", 7, "3d")],

        "rt": [("Monster/Ph/NineArts/nine_arts_j5a", 7, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_ice",
        "rt_box": (0.0, 0.2, 14.4, 2.9), "rt_hit": (7, 14),
        "sfx": [("sfx_ph_A1_pre", 5)],
        "fallback": ("ph_A1_atk", [(0, 3), (1, 2), (2, 2), (3, 3), (4, 5), (5, 5), (6, 5), (7, 10)]),
    },
    "cf_j5B": {
        "clip": "ninx_j5b", "button": "B", "replaces": None, "air": True,
        "body": [("ph251_00", 3), ("ph251_01", 3), ("ph251_02", 3), ("ph251_03", 3), ("ph251_04", 6), ("ph251_05", 6),
                 ("ph251_06", 6), ("ph251_07", 6), ("ph251_08", 6)],
        "hit": (9, 15), "box": [(-10, 232, 416, 358), (8, 254, 586, 343)],

        "fx": [("ph251_eff", 9, "2d")],

        "rt": [("Monster/Ph/NineArts/nine_arts_j5b", 9, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_wind",
        "rt_box": (0.3, -0.8, 8.2, 2.6), "rt_hit": (9, 18),
        "sfx": [("vo_ph_B1", 6), ("sfx_ph_B1", 9)],
        "fallback": ("ph_B1", [(0, 4), (1, 4), (2, 6), (3, 6), (4, 8), (5, 8), (6, 6)]),
    },





    "cf_2B": {
        "clip": "ninx_2b", "button": "B", "replaces": "A1_pre", "air": False, "next": ("cf_2A", 16),
        "body": [("ph231_00", 4), ("ph231_01", 3), ("ph231_02", 3), ("ph231_03", 3), ("ph231_04", 3), ("ph231_05", 6),
                 ("ph231_06", 5), ("ph231_07", 5), ("ph231_08", 5)],
        "hit": (10, 16), "box": [(-44, 157, 479, 335)],
        "fx": [],

        "rt": [("Monster/Ph/NineArts/nine_arts_2b", 10, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_wind",
        "rt_box": (0.4, 0.0, 18.0, 1.9), "rt_hit": (10, 18),
        "sfx": [("vo_ph_B1", 7), ("sfx_ph_B1", 10)],
        "fallback": ("ph_B1", [(0, 5), (1, 5), (2, 5), (3, 6), (4, 6), (5, 5), (6, 5)]),
    },
    "cf_2A": {
        "clip": "ninx_2a", "button": "A", "replaces": None, "air": False, "next": ("cf_2C", 13),
        "body": [("ph230_00", 3), ("ph230_01", 3), ("ph230_02", 3), ("ph230_03", 3), ("ph230_04", 5), ("ph230_05", 5),
                 ("ph230_06", 5), ("ph230_07", 4), ("ph230_08", 4)],
        "hit": (9, 12), "box": [(12, 0, 391, 131)],
        "fx": [],

        "rt": [("Monster/Ph/NineArts/nine_arts_2a", 9, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_ice",
        "rt_box": (0.4, 0.0, 18.0, 1.5), "rt_hit": (9, 15),
        "sfx": [("sfx_ph_A1_pre", 7)],
        "fallback": ("ph_A1_atk", [(0, 3), (1, 3), (2, 3), (3, 3), (4, 5), (5, 5), (6, 5), (7, 8)]),
    },
    "cf_2C": {
        "clip": "ninx_2c", "button": "C", "replaces": None, "air": False, "launch": True,
        "body": [("ph232_00", 5), ("ph232_01", 5), ("ph232_02", 6), ("ph232_03", 6), ("ph232_04", 6), ("ph232_05", 5),
                 ("ph232_06", 5)],
        "hit": (10, 13), "box": [(-27, 84, 426, 199)],
        "fx": [],

        "rt": [("Monster/Ph/NineArts/nine_arts_2c", 10, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_fire",
        "rt_box": (0.4, 0.0, 18.0, 1.6), "rt_hit": (10, 15),
        "sfx": [("vo_ph_C1", 8), ("sfx_ph_C2_p1", 10)],
        "fallback": ("ph_C1", [(0, 5), (1, 5), (2, 6), (3, 6), (4, 6), (5, 5), (6, 5)]),
    },
    "cf_j5C": {
        "clip": "ninx_j5c", "button": "C", "replaces": "C1_air", "air": True, "next": ("cf_j5A", 13),
        "body": [("ph252_00", 4), ("ph252_01", 4), ("ph252_02", 2), ("ph252_03", 3), ("ph252_04", 5), ("ph252_05", 5),
                 ("ph252_06", 5), ("ph252_07", 5), ("ph252_08", 5)],
        "hit": (10, 13), "box": [(20, 217, 492, 347)],
        "fx": [],

        "rt": [("Monster/Ph/NineArts/nine_arts_j5c", 10, 0.0, 0.0, 1.0, 0)], "rt_hitfx": "Monster/Ph/NineArts/nine_arts_hit_fire",
        "rt_box": (0.2, -1.2, 7.0, 1.9), "rt_hit": (10, 15),
        "sfx": [("vo_ph_C1", 8), ("sfx_ph_C2_p1", 10)],
        "fallback": ("ph_C1", [(0, 4), (1, 4), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5), (7, 5)]),
    },
}


FX2D = {
    "ph251_eff": {"seq": [("vr_ph254_00", 4), ("vr_ph254_01", 3), ("vr_ph254_02", 3), ("vr_ph254_03", 3)],
                  "fwd": 20, "up": 0, "tint": (0.42, 1.0, 0.58)},
}


FX_FALLBACK = {"ph200_eff": "effect/prefab/monster/ph/ph_a1_02", "ph250_eff": "effect/prefab/monster/ph/ph_a1_02",
               "ph201_eff": "effect/prefab/monster/ph/ph_b1_01", "ph251_eff": "effect/prefab/monster/ph/ph_b1_01",
               "ph202_eff": "effect/prefab/monster/ph/ph_c1_01"}

TOGGLE = "nine_arts"

TOGGLE_CLIP = {"clip": "ninx_arts",
               "body": [("ph203_00", 3), ("ph203_04", 2), ("ph203_05", 2), ("ph203_06", 2), ("ph203_07", 4), ("ph203_08", 4),
                        ("ph203_09", 4)],
               "fallback": ("ph_A1_pre", [(0, 3), (1, 3), (2, 3), (3, 4), (4, 4), (5, 4)])}
BUFF = "MOD_nine_arts"
CELL_TICKS = 2


def fx_name(state):
    return "ninx_" + state.lower()


def ticks(seq):
    return sum(t for *_, t in seq)


def check():
    assert ticks(TOGGLE_CLIP["body"]) == ticks(TOGGLE_CLIP["fallback"][1])
    for n, m in MOVES.items():
        assert ticks(m["body"]) == ticks(m["fallback"][1]), (n, ticks(m["body"]), ticks(m["fallback"][1]))
        a, b = m["hit"]
        assert 0 <= a < b <= ticks(m["body"]), n
        for st, t, kind in m["fx"]:
            assert kind in ("2d", "3d") and (kind == "3d" or st in FX2D) and st in FX_FALLBACK, (n, st)
        if m.get("next"):
            assert m["next"][0] in MOVES and 0 < m["next"][1] < ticks(m["body"]), n
    return len(MOVES)


if __name__ == "__main__":
    print("Magic Arts: %d moves: %s" % (check(), ", ".join("%s %d ticks" % (n, ticks(m["body"])) for n, m in MOVES.items())))
