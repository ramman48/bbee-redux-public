"""party_clips.py -- Kris's (and the companions') animation clips as DELTARUNE frame keys with 60-tick timings.

Speeds are DELTARUNE's own where its code states them (image_speed, in sprite frames per 30 fps game frame; one tick
here is 1/60 s): Kris's slashes 0.6, run 0.15-0.4 by speed (0.4 at full speed), idle and most poses 0.25, the
companions' casts 0.25. Holds marked "readability" are this design's, not DELTARUNE's: they give each swing its
follow-through before the next can start (docs/characters/NOEL_REFERENCE.md).

Every clip here is an engine-neutral name; build_party.py maps them onto the actions it clones.
"""
from dr_source import strip

K = "spr_kris_plat_"
# The Fun Gang's pose (0.4.0; the lead: switching Auto, "the entire fun gang stops whereever they are and do their
# iconic fun gang pose taunts"): Chapter 5's own platformer poses. Design, not DELTARUNE's timing (its scene sets the
# pose sprite and holds it): a wind-up frame, then the pose held; ticks at 60 Hz (0.1 s + 0.7 s)
POSE = (6, 42)
# the companions' own pose clip holds longer (2 s): js/command.js ends it (0.8 s with Kris's taunt; with Kris's entrance and
# win pose it is held for as long as they play, this being the cap)
POSE_HOLD = 114


def kris():
    c = {}
    c["stand"] = strip(K + "idle", 0.25)
    c["run"] = strip(K + "run", 0.4)
    c["run_stop"] = strip(K + "runstop", 0.25)
    c["turn"] = strip(K + "turn", 0.25, hold_last=4)
    c["crouch"] = strip(K + "crouch", 0.25)
    c["jump_up"] = strip("spr_kris_jump_up", 0.25)
    c["jump_down"] = strip("spr_kris_jump_down", 0.25)
    c["land"] = strip(K + "land", 0.25)
    c["ball"] = strip("spr_plat_kris_ball", 0.5)                       # air dash, knockdown tumble, wall bounce
    c["dash"] = strip(K + "run", 0.8)                                  # DELTARUNE's own answer: the run, faster
    # the ground slash: one 13-frame strip with hits on frames 1, 5 and 9, cut into three swings
    g = strip(K + "slash_ground", 0.6)
    c["attack1"] = hold(g[0:4], {3: 8})                                # readability: follow-through on the last frame
    c["attack2"] = hold(g[4:8], {3: 8})
    c["attack3"] = hold(g[8:13], {4: 10})
    # the air slash: in a jump DELTARUNE starts it on the spin (frames 8-11), the rest is the follow-through
    a = strip(K + "slash_air", 0.6)
    c["attack_air"] = a[8:17]
    c["attack_air_full"] = a
    c["attack_air_land"] = strip(K + "slash_airland", 0.25)
    c["hurt"] = strip(K + "hurt_ground", 1.0, hold_last=10)
    c["hurt_air"] = strip(K + "hurt_air", 1.0, hold_last=10)
    c["clash"] = strip(K + "clash", 0.25)
    c["pose"] = strip(K + "pose", 1.0, hold_last=30)
    c["taunt"] = [(K + "land:0", POSE[0]), (K + "pose:0", POSE[1])]       # the landing crouch as the wind-up
    c["dance"] = strip("spr_kris_dance", 0.25) * 3                        # the dance taunt (0.5.0): three rounds, 1.6 s
    return c


def merge_first(seq, n):
    """The first n frames become one: the n-th frame's key held for their total length."""
    return [(seq[n - 1][0].rsplit(":", 1)[0] + ":%d" % (n - 1), sum(t for _, t in seq[:n]))] + seq[n:]


def swap(seq, keys):
    """Show another frame of the same sprite at some indices ({index: frame}), timing unchanged."""
    return [((k.rsplit(":", 1)[0] + ":%d" % keys[i]) if i in keys else k, t) for i, (k, t) in enumerate(seq)]


def hold(seq, extra):
    """Add ticks to some frames of a sequence ({index in seq: extra ticks})."""
    return [(k, t + extra.get(i, 0)) for i, (k, t) in enumerate(seq)]


def susie():
    return {
        "stand": strip("spr_plat_susie_idle", 0.25),
        "run": strip("spr_plat_susie_run", 0.4),
        "jump": strip("spr_plat_susie_jump", 0.25),
        "fall": strip("spr_plat_susie_fall", 0.25),
        "land": strip("spr_plat_susie_land", 0.25),
        # DELTARUNE's quick command: the ready pose, then the swing at 0.25. The swing's two arc frames (0-1) are
        # dropped (their arcs are drawn in Susie's own colours; the kit's axe swing plays there): frame 2 starts where
        # frame 0 did and holds for all three, so the cast and its launch moment (sequence index 1) keep their timing
        "cast": [("spr_susiep_attackready:0", 8)] + merge_first(strip("spr_susiep_attack", 0.25), 3),
        # Kris's double jump, followed (the lead: "susie and ralsei need to use the same double jump animation")
        "spin": strip("spr_plat_susie_jump_ball", 0.5),
        "shock": strip("spr_plat_susie_shock_r", 0.25, hold_last=20),
        "pose": [("spr_plat_susie_pre_pose:0", POSE[0]), ("spr_plat_susie_pose:0", POSE_HOLD)],
        # 0.5.0 (the lead's "lets add this"): ready = her axe drawn back while she is the one aimed with; fidget = her
        # laugh after standing a while; dance = the dance taunt (two rounds, 1.6 s)
        "ready": [("spr_susiep_attackready:0", 20)],
        # 0.5.3 (the lead: "yes the low hp reaction"): while Kris's HP is low, DELTARUNE's own unhappy idle and run
        "stand_low": strip("spr_plat_susie_idle_unhappy", 0.25),
        "run_low": strip("spr_plat_susie_run_unhappy", 0.4),
        "fidget": strip("spr_susie_laugh_dw", 0.25) * 6,
        "dance": strip("spr_susie_dance", 0.25) * 2,
    }


def ralsei():
    return {
        "stand": strip("spr_plat_ralsei_idle", 0.25),
        "run": strip("spr_plat_ralsei_run", 0.4),
        "jump": strip("spr_plat_ralsei_jump", 0.25),
        "fall": strip("spr_plat_ralsei_fall", 0.25),
        "land": strip("spr_plat_ralsei_land", 0.25),
        # Fireshock: his hand fire is cleared by colour (dr_source.DEPALETTE); the throw frame 3 is mostly fire, so frame
        # 4's pose shows there (index 3 is still the launch moment)
        "cast": swap(strip("spr_plat_ralsei_spell_fireball_right", 0.25), {3: 4}),
        "spin": strip("spr_plat_ralsei_jump_ball", 0.5),
        "spell": strip("spr_plat_ralsei_spellready", 0.25) + strip("spr_plat_ralsei_spell", 0.25),   # Heal Prayer
        "shock": strip("spr_plat_ralsei_shocked_subtle", 0.25, hold_last=20),
        "pose": [("spr_plat_ralsei_pre_pose:0", POSE[0]), ("spr_plat_ralsei_pose:0", POSE_HOLD)],   # the hatless pose
        # 0.5.0: ready = his spell stance; fidget = his little dance, once round; dance = the same, a round and a half
        "ready": strip("spr_plat_ralsei_spellready", 0.25),
        # 0.5.3: while Kris's HP is low, his unhappy idle (DELTARUNE has no unhappy run for him: his own run)
        "stand_low": strip("spr_plat_ralsei_idle_unhappy", 0.25),
        "run_low": strip("spr_plat_ralsei_run", 0.4),
        "fidget": strip("spr_ralsei_dance", 0.25),
        "dance": (strip("spr_ralsei_dance", 0.25) * 2)[:12],
    }


if __name__ == "__main__":
    for who, clips in (("kris", kris()), ("susie", susie()), ("ralsei", ralsei())):
        for name, seq in clips.items():
            print(f"{who:6s} {name:16s} {len(seq):2d} frames {sum(t for _, t in seq) / 60:.2f} s")
