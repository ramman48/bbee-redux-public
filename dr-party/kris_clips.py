"""kris_clips.py -- the party's rig: every clip name the logic and the importer share (role "kris", skin "02").

One rig for the whole party: Kris's clips are kris_<name>, the companions' kris_susie_<name> / kris_ralsei_<name>,
the effect strips kris_fx_<name>. Kris's logic and its projectile logic (krisbullet) both name this role in their
AnimationJsons, so a projectile can play Susie's cast or the Rude Buster bolt.

Frame lists and DELTARUNE speeds come from party_clips.py (the speeds are DELTARUNE's own; holds are design). This
module only renames them for the engine and derives the few clips the engine states need at their donor's length
(Ragna's action lengths, read 2026-10-02: runStart 0.10 s, drop_start 0.10, dash 0.367, behit 0.317, push_back 0.417,
knockdown 0.5, knockdown_stand 0.5, jump2 0.55). No art lives here: import_kris.py reads the pixels at build time from
the player's own DELTARUNE install; build_kris.py reads only the lengths.

The 16 cinematic clips (CINEMA) are the names BBEE's Evotype / inheritance timelines play as <role>_<name>, exact case
(NOTES 2026-09-28; ruby_clips.CINEMA): each is an alias of one of Kris's own clips.
"""
import party_clips as P
from dr_source import strip

ROLE = "kris"
SKIN = "02"          # texture family kris_02 = HeroConfig.Skin = ClientSkinConf.SkinName

K = "spr_kris_plat_"

# party_clips.kris() name -> this rig's clip name (kris_<name>)
KRIS_NAMES = {"stand": "stand", "run": "run", "run_stop": "runbrake", "turn": "turn", "crouch": "squat_loop",
              "jump_up": "jump", "jump_down": "drop", "land": "dropend", "ball": "ball", "attack1": "atk1",
              "attack2": "atk2", "attack3": "atk3", "attack_air": "atkj", "attack_air_full": "atkj_full",
              "attack_air_land": "atkj_land", "clash": "clash", "pose": "pose", "taunt": "taunt", "dance": "dance"}

# Evotype / inheritance timelines: <role>_<name> exact case -> one of Kris's clips
CINEMA = {
    "UPjump_1": "jump", "UPjump_2": "jump2", "UPjump_3": "jump2", "Dash_timeline": "run", "dropend4": "dropend",
    "Stand_timeline": "stand", "Stand2_timeline": "stand", "Born_timeline": "pose", "Born2_timeline": "pose",
    "drop_inherit": "drop", "squat_loop_inherit": "squat_loop", "squat_to_stand": "squat_to_stand",
    "stand_inherit": "stand", "standby_inherit": "stand", "burst_x_inherit": "pose",
    "knockdown_stand_inherit": "getup",
}


def held(key, ticks):
    return [(key, ticks)]


def cycle(seq, total):
    """Repeat a sequence until it lasts `total` ticks (the last frame is cut to fit)."""
    out, t, i = [], 0, 0
    while t < total:
        k, n = seq[i % len(seq)]
        n = min(n, total - t)
        out.append((k, n)); t += n; i += 1
    return out


def kris_clips():
    c = P.kris()
    out = {KRIS_NAMES[k]: v for k, v in c.items() if k in KRIS_NAMES}
    run, jd, crouch, land, ball = c["run"], c["jump_down"], c["crouch"], c["land"], c["ball"]
    out["run_start"] = held(run[0][0], 6)                                   # Ragna's runStart: 0.10 s
    out["drop_start"] = [(jd[0][0], 3), (jd[1][0], 3)]                      # Ragna's drop_start: 0.10 s
    out["squat"] = held(crouch[0][0], 2)                                    # Ragna's squat: 0.03 s, then the loop
    out["squat_to_stand"] = held(crouch[0][0], 10)
    out["jump2"] = cycle(ball, 32)                                          # the curled-ball spin, about Ragna's 0.55 s
    out["dash"] = cycle(c["dash"], 22)                                      # the run at double rate, Ragna's 0.367 s
    out["dash_air"] = ball                                                  # the curled ball, Ragna's 0.267 s
    out["behit"] = held(c["hurt"][0][0], 19)                                # Ragna's behit: 0.317 s
    out["behit_air"] = held(c["hurt_air"][0][0], 25)                        # Ragna's push_back: 0.417 s
    out["tumble"] = cycle(ball, 30)                                         # knockdown: Kris tumbles in the ball (PARTY.md 8)
    out["down"] = held(land[0][0], 20)                                      # knockdown_loop: crouched where the ball stopped
    out["getup"] = land + held(c["stand"][0][0], 30 - sum(t for _, t in land))   # knockdown_stand: 0.5 s
    out["dead"] = held(c["hurt_air"][0][0], 120)
    return out


def companion_extra(who):
    """The followers' turn and halt (0.2.0: Susie and Ralsei follow Kris). Speeds are obj_plat_follower's own: turn
    image_speed 0.5, halt 0.3 (Step_0 / Step_2). Ralsei is hatless everywhere (the lead): the plain spr_plat_ralsei_*
    sprites are the hatless set, the hat set carries _hat."""
    pre = "spr_plat_%s_" % who
    # 0.4.2: dash = the Party Dash's look (DELTARUNE's dash mode keeps the run sprites, faster, with afterimages): the run
    # at the dash's rate for DASH_TICKS, longer than any run lasts, so its kit effect plays once and never restarts
    # 0.4.3: both use the companion's STRONGER run (SPRINT_SPRITE: Susie's and Ralsei's all-out runs), not the
    # platformer's jog. sprint = the same run as a loop, for when they tear after a dashing Kris
    fast = strip(SPRINT_SPRITE[who], 0.5)
    return {"turn": strip(pre + "turn", 0.5), "halt": strip(pre + "halt", 0.3), "dash": cycle(fast, DASH_TICKS), "sprint": fast}


DASH_TICKS = 270       # the companions' dash clip (4.5 s; the Party Dash runs 3.5 s at most)
SPRINT_SPRITE = {"susie": "spr_susie_run_right", "ralsei": "spr_ralsei_running_right"}   # 6 frames each, hatless Ralsei
FLIGHT_TICKS = 72      # the homing projectiles' lifetime (1.2 s): their clips are cycled to it, so none ends early


def effect_clips():
    beam, ball = strip("spr_rudebuster_beam", 0.5), strip("spr_spell_fireball", 0.5)
    return {
        # Rude Buster's bolt: 7 frames at image_speed 0.5 (DELTARUNE's own); its colours cycle, so it loops cleanly
        "fx_rudebuster": beam,
        "fx_rudebuster_flight": cycle(beam, FLIGHT_TICKS),
        # Fireshock's fireball: DELTARUNE's spell fireball, 3 frames at image_speed 0.5, rooted at its core (dr_source)
        "fx_fireball": ball,
        "fx_fireball_flight": cycle(ball, FLIGHT_TICKS),
        # the slash overlays (drawn over Kris in DELTARUNE), at Kris's slash speed; for the effects pass, unused yet
        "fx_slash_ground": strip(K + "slash_ground_foreground", 0.6),
        "fx_slash_air": strip(K + "slash_air_foreground", 0.6),
        # the Party Dash's wall crash (0.5.0): DELTARUNE's own smack star (obj_caterpillar_dash) and dash ripple
        "fx_smack": [("spr_smack_vfx:0", 9)],
        "fx_ripple": strip("spr_dash_ripple", 0.5),
    }


def sequences():
    """{"kris_<name>": [(frame key, ticks at 60 Hz)]} for every clip of the party rig, cinematic aliases included."""
    out = {}
    for name, seq in kris_clips().items():
        out["%s_%s" % (ROLE, name)] = seq
    for who, clips in (("susie", P.susie()), ("ralsei", P.ralsei())):
        clips = dict(clips, **companion_extra(who))
        for name, seq in clips.items():
            out["%s_%s_%s" % (ROLE, who, name)] = seq
    for name, seq in effect_clips().items():
        out["%s_%s" % (ROLE, name)] = seq
    for cname, src in CINEMA.items():
        out["%s_%s" % (ROLE, cname)] = list(out["%s_%s" % (ROLE, src)])
    lower = {}
    for n in out:   # bundle paths are lower case: two names may not differ by case only
        if n.lower() in lower and lower[n.lower()] != n:
            raise SystemExit("clip names %s and %s collide in lower case" % (n, lower[n.lower()]))
        lower[n.lower()] = n
    return out


def lengths(seqs=None):
    """{clip: {"frames": total ticks, "ticks": frame count}} -- the clip-length JSON bossport.Port reads."""
    seqs = seqs or sequences()
    return {n: {"frames": sum(t for _, t in s), "ticks": len(s)} for n, s in seqs.items()}


if __name__ == "__main__":
    for n, s in sorted(sequences().items()):
        print("%-34s %3d frames %.3f s" % (n, len(s), sum(t for _, t in s) / 60.0))
