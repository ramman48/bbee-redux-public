"""build_ruby.py -- Ruby Rose (Cross Effect): generate her playable logic, projectile logic, tables and text.

Runs on the PLAYER'S machine before the build: move timing and hit boxes are read from their own BlazBlue Cross Tag
Battle install (tools/bbtag). Everything it writes (gen/, mod.json content) is regenerated per player and is not part
of a release package; the art (rig, UI) is built later by import_ruby.py through the loader's importer hook.

Design: docs/cross-effect/PROPOSALS.md section 5 (kit draft v1) and DECISIONS.md. Structure follows Nine
(mods/char-nine/build_nine.py): Ragna's player states on her own clips, her moves from cleaned stock templates.

usage: python mods/char-ruby/build_ruby.py
"""
import copy, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path[:0] = [TOOLS, os.path.join(TOOLS, "tools", "bbtag"), HERE, ROOT]
import bossport as bp
from bossport import fp, fv
import ruby_clips as RC

VERSION = "0.9.0"
ACTOR, DONOR, DONOR_LOGIC = 200701, 100101, "rg"
LOGIC = ROLE = RC.ROLE            # "rrb": logic, animation role, texture family prefix
SKIN = RC.SKIN
BID, BLOGIC = 20070101, "rrbb1"    # her projectiles (one bullet logic)
TEMPLATE_LOGICS = ("rg", "icey", "no", "tk")

# ---------------------------------------------------------------- data from the player's BBTAG install
def source():
    import bbtag_read as R, bbtag_rig as RG, bbtag_clips as C, bbtag_moves as M
    scr = R.fpac_files(R.read("data/char/char_rrb_scr.pac"))
    os.makedirs(RG.CACHE, exist_ok=True)
    cats = []
    for fn in ("scr_rrb.bin", "scr_rrbea.bin"):
        p = os.path.join(RG.CACHE, fn); open(p, "wb").write(scr[fn]); cats.append(C.catalog(p))
    clips = RC.sequences(cats[0], RG.normalize, cats[1])
    lengths = {n: sum(t for _, t in s) for n, s in clips.items()}
    cj = os.path.join(RG.CACHE, "ruby_clip_lengths.json")
    json.dump({n: {"frames": v, "ticks": len(clips[n])} for n, v in lengths.items()}, open(cj, "w"))
    src = RG.Source("rrb")
    return cj, lengths, M.Moves(src, scr["scr_rrb.bin"], src.scale), clips


# ---------------------------------------------------------------- 1. engine-facing states on her clips
# player state -> her clip (ruby_clips name), "fit" = over the donor's timing
LOCO = {
    "stand": "stand", "standby1": "standby", "standby2": "appeal",      # idle, idle fidget, idle taunt
    "runStart": "run_start", "run": "run", "runBrake": "runbrake",
    "squat": "squat", "squat_loop": "squat_loop", "squat_to_stand": "squat_to_stand",
    "standUp": "knockdown_stand", "standUp2": "quickstand", "standUp_Dead": "knockdown_stand",
    "quickStand": "quickstand", "reactive": "ukemi_air",
    "behit_up": "behit_up", "behit_middle": "behit_middle",
    "push_back": "push_back", "push_back_2": "behit_heavy", "push_back_3": "push_back", "push_back_4": "push_back",
    "push_down": "push_down", "push_down_2": "push_down", "push_down_3": "push_down_loop", "push_down_4": "push_down_loop",
    "push_back_show": "push_back",
    "drop_down": "drop", "drop_start": "drop_start", "drop": "drop", "drop2": "drop", "AUpdrop": "drop", "jump_down": "drop_start",
    "jump": "jump", "jump2": "jump2", "jump3": "jump2",
    "dropend": "dropend", "dropend2": "dropend", "dropend3": "dropend", "dropend4": "dropend",
    "reborn": "born2", "born": "born", "pvp_born": "born3", "born_start": "jump", "born_start_2": "drop",
    "dead": "dead", "dead_backup": "dead",
    "knockdown": "knockdown", "knockdown_loop": "knockdown_loop", "knockdown_stand": "knockdown_stand", "knockdown_todead": "dead",
    "winpose": "winpose", "winpose2": "winpose2", "StagePass": "winpose3",
    "drop_down_show": "drop", "dropend_show": "dropend", "paid_show": "appeal2",
    "bornshow_standup": "knockdown_stand", "bornshow_fall": "drop", "bornshow_fall_end": "dropend",
    # Gun Blast is her dash (decided): the travel part on the dash actions, the recovery on dashend
    "dash": "blast_f_go", "dash2": "blast_f_chain", "dash3": "blast_f_chain", "dashend": "blast_f_end",
    "dashAir": "blast_air_f_go", "dashAir2": "blast_air_f_chain", "dashAir3": "blast_air_f_chain", "dashAirend": "blast_air_f_end",
    # the flask, the Summon Tactic and Legacy casts: her appeal / "come on" gestures over the donor's timing
    "addHP": ("appeal2", "fit"), "addHPAir": ("appeal2", "fit"),
    "summon": ("request_short", "fit"), "teacherskill": ("request_short", "fit"), "teacherskillAir": ("request_short", "fit"),
}
PLAY_WHOLE = {"standby1", "standby2", "winpose", "winpose2", "StagePass", "paid_show", "born", "pvp_born", "reborn"}
DASHES = ("dash", "dash2", "dash3", "dashAir", "dashAir2", "dashAir3")
# Gun Blast v3 (KIT_V2 §4; V2_COVERAGE C1-C12): six first blasts (ground Forward / Down = back / Up; air Forward / Up /
# Down), each with a chain version that fires on its first frame; any blast chains into any other, up to 3 (4 with
# Potential 20722)
BLASTS_V3 = ("rrb_blast_back", "rrb_blast_back_c", "rrb_blast_up_c", "rrb_blast_air_up_c", "rrb_blast_down_c",
             "rrb_blast_air_back", "rrb_blast_air_back_c")   # the air backward gun-dash (the lead, 2026-09-29)
ALL_BLASTS = DASHES + ("rrb_blast_up", "rrb_blast_air_up", "rrb_blast_down") + BLASTS_V3
# (0.9.0: air Down + Dash is the dive, as three testers expected; the air backward gun-dash is the air Skill now,
#  rrb_recoilshot. Its two blast actions are still built, and no row starts them.)
AIR_STARTERS = ("dashAir", "rrb_blast_air_up", "rrb_blast_down")    # once per airtime, together; landing clears them
# 0.9.0 (a tester, 2026-10-07: "a straight dash covers less distance than a diagonal dash"; "the backward dash is too
# short"): every blast travels about the same distance. Before: forward 2.1 u, back 2.1 u, up (2.5, 3.0) = 3.9 u,
# the dive (2.5, -3.2) = 4.1 u. With one blast at the start instead of three, each is a little longer than the old
# forward one. (The range card multiplies these: rrb_pots.BLAST_FAR.)
# (in game, 2026-10-09: with the speed each blast leaves with, forward = 3.5 u before its recovery, up = 2.45 u
#  forward and 2.15 u up; the backward one, which leaves with little speed, is set to end as far as the forward one)
BLAST_DIST = {"fwd": 2.8, "back": 3.2, "up": (1.8, 2.15), "down": (1.8, -2.15)}
BLAST_PAUSE = 0.08    # s: between two blasts of a chain, after the first one's travel is over (hidden effect: none)
CHAIN_KEEP = 8.0      # s: what is left of a chain stays usable this long; landing gives the count back sooner
BACK_END = "rrb_blastend_back"   # the backward blast's own recovery (blast_distances)
# every blast that leaves the floor (or happens in the air) sets that lock, so the chain count holds for a whole airtime:
# a chain begun with a ground Up blast can't be followed by a fresh air chain once it times out (C6: reset on landing)
LOCKERS = tuple(b for b in ALL_BLASTS if b not in ("dash", "dash2", "dash3", "rrb_blast_back", "rrb_blast_back_c"))
FIRE_TICK = {"SpDash_Front": 8, "SpDash_Back": 8, "SpDash_AntiAir": 7, "AirSpDash_AntiLand": 9, "AirSpDash_Back": 6}
CHAIN_OFF = 8 / 60.0   # a chained Gun Blast skips the wind-up: BBTAG fires on tick 8
SHOT_T = 8 / 60.0      # the first Gun Blast's shot (and her departure)
JC_FLOAT = 0.30        # j.C: she holds in the air until her shot (0.283 s), then drops (0.8.0; the donor's float was 1.0 s)
BUZZ_DIVE = (3.0, -16.0, 1.6)   # Buzzsaw's dive: (forward u, down u, s); it ends when she lands
BUZZ_DOWN = (1.5, -16.0, 0.8)   # ... with Down held: half the reach, twice the speed down (0.8.0)
BUZZ_UP = (1.2, 1.6, 0.25)      # ... with Up held: a short rise forward first, then BUZZ_DIVE
RETIMED = {"rrb_sypod": 0.75}   # actions played faster than their BBTAG clip on purpose (AnimateDuration / clip length)
CLASH_SPEED = 0.6               # Clash Assault plays 0.6 as long as BBTAG's (movement: the shot at 0.25 s)
CLASH_RUSH = 0.10               # s: from here to the shot, Clash Assault's bound strikes what it meets
# the donor's routes out of its states -> hers
REMAP = {"attack1": "rrb_a1", "attackAir": "rrb_ja", "rush": "rrb_corkscrew", "rushAir": "rrb_corkscrew", "rushAD": "rrb_corkscrew",
         "fall": "rrb_buzzsaw", "fallend": "rrb_buzzsaw_land", "attackUp": "rrb_launcher", "attackUpAir": "rrb_ja"}

# ---------------------------------------------------------------- 2. her moves
# cleaned templates: character-specific buffs / calls / cues / effects / switches removed, generic engine parts kept
DROP_BUFF = re.compile(r"^(icey|rg|tk|no|ha|pt|kk|bl|nt)_|skill_times|excution|quick_change|SkillHitAddHPR|trans_buff|offset_protect")
KEEP_CALLS = {"SkillChainReset", "AddMotion", "ScanTargetAndChangeDir"}
CLEAR = ("AddRoles", "Audios", "HitAudios", "AddEffects", "HitEffects", "ActionSwitchs", "Interrupt", "CDList", "TurnList",
         "RaycastList", "CollisionSwitchList", "ForceFields", "MuteSkills", "ChangeActorTag", "InstructionMatchs", "BehitBoxs",
         "SetTarget", "OthersBlockMove", "RemoveBuff", "Aurora", "BehitNotify", "GrabStart", "GrabTimeRange",
         "GrabControlFrames", "GrabDamages", "SpeedChanges", "ValueCurve", "Invincibility", "HitDataList")
GENERIC_NEXT = {"", "stand", "drop", "dropend", "squat_loop", "drop_down", "jump_down"}
HIT_SFX = "sfx_no_attack_hit"                   # stock sounds until her own can play (decided)
# hit feel: victim reaction from stock moves (logic, action, hit index)
VICTIM = {"light": ("icey", "attack1", 0), "knock": ("icey", "attack4", 0), "launch": ("icey", "attack_up_1", 0),
          "air": ("icey", "attackAir1", 0), "down": ("tk", "attack2", 0)}
# stock-scale floor for a hit box (forward reach, height): BBTAG boxes are fighting-game tight at her size
FLOOR = {"normal": (1.9, 1.6), "heavy": (2.4, 1.8), "skill": (2.8, 1.8), "air": (1.9, 1.6), "dash": (1.8, 1.6)}

# her moves: name -> (clip, template (logic, action), BBTAG states for the hits, feel, floor, armor, extra)
KIT = {
    "rrb_a1":        ("atk5a", ("icey", "attack1"), ["NmlAtk5A"], "light", "normal", 1),
    "rrb_a2":        ("atk5aa", ("icey", "attack2"), ["AN_NmlAtk5A_2nd"], "light", "normal", 1),
    "rrb_a3":        ("atk5aaa", ("icey", "attack3"), ["AN_NmlAtk5A_3rd"], "light", "normal", 1),
    "rrb_a4":        ("atk5aaaa", ("icey", "attack4"), ["AN_NmlAtk5A_4th"], "knock", "heavy", 5),
    "rrb_launcher":  ("atk5bbb", ("icey", "attack1"), ["AN_NmlAtk5B_3rd"], "launch", "heavy", 1),
    "rrb_sweep":     ("atk2c", ("icey", "attack1"), ["NmlAtk2C"], "launch", "normal", 1),
    "rrb_clash":     ("clash_air", ("icey", "attack4"), ["CmnActCrushAttack"], "knock", "heavy", 5),
    "rrb_corkscrew": ("corkscrew", ("icey", "rush"), ["CmnActInvincibleAttack"], "knock", "heavy", 5),
    "rrb_ja":        ("atkj5a", ("icey", "attackAir1"), ["NmlAtkAIR5A"], "air", "air", 1),
    "rrb_jb":        ("atkj5b", ("icey", "attackAir2"), ["NmlAtkAIR5B"], "air", "air", 1),
    "rrb_jc":        ("atkj5c_air", ("icey", "attackAir3"), ["NmlAtkAIR5C"], "down", "air", 1),
    "rrb_j2a":       ("atkj2a", ("icey", "attackAir1"), ["NmlAtkAIR2A"], "air", "air", 1),
    "rrb_guillotine": ("guillotine", ("icey", "attack4"), ["MultiAssault"], "launch", "skill", 5),
    "rrb_buzzsaw":   ("buzzsaw", ("icey", "attackAir3"), ["AirRolling_A"], "air", "skill", 5),
}
# (MP cost) of each Skill (decided: Skills cost MP, no cooldowns)
SKILL_MP = {"rrb_rifleshot": 30, "rrb_guillotine": 60, "rrb_sypod": 50, "rrb_buzzsaw": 40}   # (Rifle Shot 40 -> 30, 2026-10-03: three from a full bar)
# damage budget: (total ratio, hit times); Ragna's attack1 = 1.0 (research/kb/COMBAT_ECONOMY.md medians)
DMG = {"rrb_a1": (1.0, 1), "rrb_a2": (1.1, 1), "rrb_a3": (1.3, 2), "rrb_a4": (1.7, 2),
       "rrb_launcher": (1.4, 1), "rrb_sweep": (1.2, 1), "rrb_clash": (2.2, 1), "rrb_corkscrew": (1.5, 1),
       "rrb_ja": (0.8, 1), "rrb_jb": (0.9, 1), "rrb_jc": (1.3, 1), "rrb_j2a": (0.8, 2),
       "rrb_guillotine": (4.2, 4), "rrb_buzzsaw": (1.5, 4), "rrb_buzzsaw_land": (1.3, 3), "rrb_blast": (0.5, 1),
       "rrb_petalburst": (15.0, 6), "rrb_petaldance": (7.0, 8), "rrb_redreaper": (20.0, 3),
       # (0.9.0: the rifle round 2.4 -> 1.8 and its break 0.6 -> 0.4; RIFLE_DMG in rrb_pots has the card and stage rounds)
       "b7": (1.8, 1), "s4": (1.5, 1), "b7end": (0.4, 1), "s4end": (0.6, 1)}
# V2 Potentials (rrb_pots.py): the new moves (Scythe Chain, 2A, Rising Crescent, the Clash chase, Reaper's Hook,
# Buzzsaw EX, air Rising Reap) join the kit; their projectiles and damage budgets too
import rrb_pots
KIT.update(rrb_pots.KIT_V2)
DMG.update(rrb_pots.DMG_V2)


def tpl(port, lg, name):
    return port.TPL[lg][name]


def buzz_dive(port, a, t0):
    """Buzzsaw's dive from t0 s of action `a`, steered by the direction held at that moment (0.8.0; a tester's suggestion,
    2026-10-03: "Buzzsaw could use a Down input to fasten the fall, and an Up input to rise a little, like the B version
    of the move in BBTAG"). Neutral = BUZZ_DIVE, the dive as it was; Down = BUZZ_DOWN, steeper and twice as fast;
    Up = BUZZ_UP, a short rise, then the dive. Down wins over Up.
    The stock pattern: Platinum's attackAirB2 adds an up or a down motion at 0.15 s by the held direction; Kokonoe's
    dash_Portal reads "neither up nor down" as one inverted condition with both flags.
    The rise leaves a flag (rrb_pots.BUZZ_RISE) and the dive after it reads the flag, not the stick: Up let go during the
    rise would otherwise leave her hanging with no motion until the float ran out."""
    def delta(t, dx, dy, dur, *conds):
        m = copy.deepcopy(tpl(port, "icey", "attackAir1")["AddMotions"][0])
        m["Time"] = fp(t); m["ConditionGroup"] = {"Combine": 0, "Conditions": list(conds)}
        m["Motion"]["DeltaX"]["ConstValue"] = fp(dx); m["Motion"]["DeltaY"]["ConstValue"] = fp(dy); m["Motion"]["DurationEx"]["ConstValue"] = fp(dur)
        return m
    hd = lambda **k: port.refs.new("ActionLogicCondition_InputDir", dict({"Invert": 0, "CheckLR": 0, "CheckDown": 0, "CheckFront": 0,
                                                                         "CheckBack": 0, "CheckUp": 0}, **k))
    up = lambda: [hd(CheckUp=1), hd(CheckDown=1, Invert=1)]
    a["AddMotions"] = [m for m in a.get("AddMotions") or [] if fv(m["Time"]) < t0 - 1e-6] + [
        delta(t0, *BUZZ_DIVE, hd(CheckDown=1, CheckUp=1, Invert=1)),
        delta(t0, *BUZZ_DOWN, hd(CheckDown=1)),
        delta(t0, *BUZZ_UP, *up()),
        delta(t0 + BUZZ_UP[2], *BUZZ_DIVE, port.refs.buff(rrb_pots.BUZZ_RISE))]
    a["AddBuff"] = [b for b in a.get("AddBuff") or [] if b["Buff"]["Idx"] != rrb_pots.BUZZ_RISE] + [
        bp.buff(rrb_pots.BUZZ_RISE, t0, BUZZ_UP[2] + 0.1, conds=up())]


def clean(port, lg, an, name, clip, total=None):
    """A template action with every character-specific part removed, on her clip."""
    a = copy.deepcopy(tpl(port, lg, an)); t_len = fv(a["TotalDuration"]) or 1.0
    a["Name"] = name; a["RoleName"] = port.RA["stand"]["RoleName"]
    L = port.LEN[clip] / 60.0
    a["Animate"] = "%s_%s" % (ROLE, clip); a["AnimateDuration"] = fp(L); a["TotalDuration"] = fp(total or L)
    a["EnableAnimationTimeMap"] = 0   # the template's AnimationTimeMap is a curve object; disabled, it's ignored
    for k in CLEAR:
        if k in a:
            a[k] = [] if isinstance(a[k], list) else a[k]
    a["AddBuff"] = [b for b in a.get("AddBuff") or [] if not DROP_BUFF.search(b["Buff"]["Idx"])]
    a["ScriptCalls"] = [s for s in a.get("ScriptCalls") or [] if s["Call"]["Function"] in KEEP_CALLS]
    k = L / t_len   # motions keep their place in the move
    for m in a.get("AddMotions") or []:
        m["Time"] = fp(fv(m["Time"]) * k)
    for f in ("NextAction", "DropAction", "DropEndAction", "DropEndHighAction", "OnGroundAction", "BeginFallAction"):
        if (a.get(f) or "") not in GENERIC_NEXT:
            a[f] = ""
    a["DeadAction"] = "dead"
    port.note(name, "template %s.%s cleaned; clip %s_%s %.2fs" % (lg, an, ROLE, clip, L))
    return a


def hit(port, feel, t0, t1, box, floor):
    lg, an, i = VICTIM[feel]
    h = copy.deepcopy(tpl(port, "icey", "attack1")["HitDataList"][0])
    v = copy.deepcopy(tpl(port, lg, an)["HitDataList"][i]["Victim"]); v["BuffList"] = []
    h["Victim"] = v
    fx, fy = FLOOR[floor]
    x0, y0, x1, y1 = box
    x0 = min(x0, -0.3); x1 = max(x1, fx); y0 = min(y0, 0.0); y1 = max(y1, fy)
    h["HitBox"] = {"Min": {"x": fp(x0), "y": fp(y0)}, "Max": {"x": fp(x1), "y": fp(y1)}}
    h["TickRange"]["Start"] = fp(t0); h["TickRange"]["End"] = fp(max(t1, t0 + 1 / 60.0))
    h["AttackerCalls"] = []
    return h


def with_hits(port, a, states, feel, floor, offset=0.0, span=None):
    mv = port.MOVES.move(*states)
    hs = [w for w in mv["hits"] if span is None or (span[0] - 1e-6 <= w["start"] < span[1])]
    a["HitDataList"] = [hit(port, feel, w["start"] - offset, w["end"] - offset, w["box"], floor) for w in hs]
    a["HitAudios"] = [{"Cue": HIT_SFX, "Time": 0.0, "StopWhenChangeAction": 0, "CheckVoiceState": 0, "ConditionGroup": {"Combine": 0, "Conditions": []}}]
    a["HitEffects"] = copy.deepcopy(tpl(port, "icey", "attack1")["HitEffects"])
    port.note(a["Name"], "%d hit window(s) from %s: %s" % (len(hs), "+".join(states),
              ", ".join("%.2f-%.2fs" % (w["start"] - offset, w["end"] - offset) for w in hs)))
    return mv


def armor(a, level):
    a["Armors"] = [{"TimeRange": {"Start": fp(0), "Finish": bp.BIG}, "Armor": level}]


def sfx(a, cue, t=0.0):
    a.setdefault("Audios", []).append({"Cue": cue, "Time": float(t), "StopWhenChangeAction": 0, "CheckVoiceState": 0,
                                       "ConditionGroup": {"Combine": 0, "Conditions": []}})


def launch(port, a, t, vx, vy, g, t_end=3.0):
    """A jump-style start speed at t (x along her facing, u/s) with its own gravity (u/s2) from t: how BBEE's jump
    leaves the floor (StartSpeed + OverridePhysics), for BBTAG's physicsX/YImpulse."""
    ss = copy.deepcopy(port.RA["jump"]["StartSpeed"])
    ss["Time"] = fp(t); ss["Speed"]["x"] = fp(vx); ss["Speed"]["y"] = fp(vy)
    ss["InheritSpeed"]["x"] = fp(0.0); ss["InheritSpeed"]["y"] = fp(0.0)
    a["StartSpeed"] = ss
    ph = copy.deepcopy(port.RA["jump"]["OverridePhysics"][0])
    ph["TimeRange"]["Start"] = fp(0.0); ph["TimeRange"]["Finish"] = fp(t_end); ph["OverrideGravityValue"] = fp(g)
    ph["OverrideAirFriction"] = fp(0.0)   # the impulse carries her the whole arc (BBTAG has no air friction here)
    a["OverridePhysics"] = [ph]


def glide(port, t, dx, dy, dur, ease=0):
    """A stock eased motion (Ragna's dash's: AddMotionType 3 Ease; EaseMode 0 out = fast start, 1 in, 2 in-out)."""
    m = copy.deepcopy(port.TPL["rg"]["dashAir"]["AddMotions"][0])
    m["Time"] = fp(t); m["ConditionGroup"] = {"Combine": 0, "Conditions": []}
    M = m["Motion"]; M["MotionType"] = 3; M["EaseMode"] = ease
    M["DeltaX"]["ConstValue"] = fp(dx); M["DeltaY"]["ConstValue"] = fp(dy); M["DurationEx"]["ConstValue"] = fp(dur)
    return m


def no_motion(a):
    a["ScriptCalls"] = [x for x in a.get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"]
    a["AddMotions"] = []; a["SpeedChanges"] = []
    a["StartSpeed"]["Speed"]["x"] = fp(0.0); a["StartSpeed"]["Speed"]["y"] = fp(0.0)
    a["StartSpeed"]["InheritSpeed"]["x"] = fp(0.0); a["StartSpeed"]["InheritSpeed"]["y"] = fp(0.0)


def landing(port, by, air, name, clip, arm):
    """The landing half of a BBTAG air move (its label 9): its own action, entered when the air half touches down."""
    a = clean(port, "icey", "attack1", name, clip); a["NextAction"] = ""
    a["HitDataList"] = []; a["HitAudios"] = []; a["HitEffects"] = []
    no_motion(a); armor(a, arm)
    # as her jump: OnGroundAction / DropEndAction on touchdown; DropAction ("drop") only if the action ENDS airborne
    by[air]["OnGroundAction"] = name; by[air]["DropEndAction"] = name
    by[name] = a
    port.note(name, "landing frames of %s (clip %s), played only when she touches down" % (air, clip))
    return a


def movement(port, by):
    """V2_PLAN P7: she moves where BBTAG's script moves her, at its ticks (bbtag_moves impulse cues); air moves stay in
    the air and their landing frames play on landing. The ICEY / Noel template motions are removed first."""
    # 5AAAA: the flash-through. BBTAG: physicsXImpulse 60000 on tick 12 (0.2 s) = 16.8 u/s at once, then friction;
    # video: she crosses the target in 2-3 frames and skids to a stop past it. Test 5: ICEY's 2.5 u over 0.4 s read as
    # a glide. Now 2.6 u eased out over 0.2 s (about 2 u in the first 0.1 s), then a 0.3 u skid; the finisher's
    # recovery is the clip's own (the extra 0.1 s is gone).
    a4 = by["rrb_a4"]; no_motion(a4)
    a4["AddMotions"] = [glide(port, 0.2, 2.6, 0.0, 0.2), glide(port, 0.4, 0.3, 0.0, 0.2)]
    a4["TotalDuration"] = copy.deepcopy(a4["AnimateDuration"])
    port.note("rrb_a4", "flash-through at 0.2 s: 2.6 u eased over 0.2 s + 0.3 u skid (BBTAG impulse tick)")
    # Clash Assault: the leap. BBTAG CmnActCrushAttack: physicsYImpulse on tick 4 (0.067 s), the strike in the air at
    # 0.417-0.467 s, the landing frames on touchdown (label 9). 8 u/s up, gravity 30: 1.07 u high, lands at 0.6 s
    # (after the strike, as in BBTAG); 1.2 u forward over the arc for reach (BBTAG has none: BBEE's rooms are wider).
    # 0.6.13 (the lead, 2026-10-02: "a weird start up and delay and it doesnt move her far enough ... it should work
    # exactly like her air gun attack does"): the whole move plays CLASH_SPEED as long (the shot at 0.25 s, was 0.417),
    # and the leap is a low forward bound, 11 u/s along her facing and 6 u/s up under gravity 42: 0.29 s in the air,
    # about 3.2 u forward (was 1.35 u), the shot 0.3 u above the floor. Her gun strike only: no scythe trail or slash
    cl = by["rrb_clash"]; no_motion(cl)
    bp.retime(cl, 1.0 / CLASH_SPEED); RETIMED["rrb_clash"] = CLASH_SPEED
    launch(port, cl, 0.033, 11.0, 7.0, -42.0)
    # (game check, inst3 2026-10-02 18:01: she touched down 0.22 s after the bound, before the shot, and the ground
    #  switch cut the strike; at stage 3 she bounded past the target.) The strike is the rush itself: it hits on contact
    #  from 0.1 s to the end of the shot (a Gun Blast's path through the enemy), and she lands only after the shot
    for h in cl["HitDataList"]:   # the strike lands while she's still up to 1 u high: reach the floor under her
        h["HitBox"]["Min"]["y"] = fp(min(fv(h["HitBox"]["Min"]["y"]), -1.2))
        h["TickRange"]["Start"] = fp(CLASH_RUSH)
    clash_end = max(fv(h["TickRange"]["End"]) for h in cl["HitDataList"])
    landing(port, by, "rrb_clash", "rrb_clash_land", "clash_land", 5)
    # (0.6.4 game test, 2026-09-30: started on the floor, its OnGroundAction fired on the first frame, before the leap at
    #  0.067 s: a long press went 5A -> rrb_clash_land, no leap and no overhead strike, and the chase ran off 5A's hit.
    #  BBEE's jump survives the same 0.07 s lift only through its row's SkillJumpStart call.) She lands through a
    #  ground-check switch armed from 0.15 s instead (0.56 u up by then; she touches down at 0.6 s, after the strike),
    #  the way her Buzzsaw dives land; the charge variants (rrb_clash_go / _full and their card copies) inherit it
    cl["OnGroundAction"] = ""; cl["DropEndAction"] = ""
    cl.setdefault("ActionSwitchs", []).append(bp.switch("rrb_clash_land", [port.refs.ground(2)], start_type=1, nt=1,
                                                        t0=round(clash_end + 0.01, 3), t1=fv(cl["TotalDuration"])))
    port.note("rrb_clash", "x%.2f long; bound: 11 u/s forward, 7 u/s up at 0.033 s, gravity 42; strikes on contact %.2f-%.2f s; lands into rrb_clash_land after it" % (CLASH_SPEED, CLASH_RUSH, clash_end))
    # j.C: BBTAG NmlAtkAIR5C: physicsYImpulse 16000 + setGravity 1600 at tick 0 (a small float), the gun blast at
    # 0.283 s, then the fall loop until landing. In BBEE's jump physics (gravity 42): 5.6 u/s up (the same 0.37 u
    # float), then after the shot a heavier fall (70) for the drop; her horizontal drift is kept.
    # V2 (Test 6 #22: "j.C launches her upward off the screen", 350-550 px, a 0.3-0.5 s hang, every time): the data
    # (5.6 u/s up, gravity 42, as her jump) gives 0.37 u, so the engine applies this start speed differently from the
    # stock jump; not reproducible offline. j.C now has NO lift, as the stock air attacks: she keeps her momentum
    # (inherited, capped by a light gravity 20 until the shot = a short hang), then drops at 70. Awaiting game check.
    jc = by["rrb_jc"]; no_motion(jc)
    launch(port, jc, 0.0, 0.0, 0.0, -20.0, t_end=0.34)
    jc["StartSpeed"]["InheritSpeed"]["x"] = fp(1.0); jc["StartSpeed"]["InheritSpeed"]["y"] = fp(0.35)
    drop = copy.deepcopy(jc["OverridePhysics"][0])
    drop["TimeRange"]["Start"] = fp(0.34); drop["TimeRange"]["Finish"] = fp(5.0); drop["OverrideGravityValue"] = fp(-70.0)
    drop["OverrideAirFriction"] = fp(-1.0)
    jc["OverridePhysics"].append(drop)
    # (a tester, 2026-10-03: j.C "leaves her in the air without doing anything for way too long without any momentum".
    #  The donor's float buff, nogravity_change = no gravity until the move changes, was set for 1.0 s, and j.C's move
    #  does not change until she lands: she hung for a second after the shot, whatever the gravity above said. It now
    #  ends with the shot, and the drop takes over.)
    for b in jc.get("AddBuff") or []:
        if b["Buff"]["Idx"] == "nogravity_change": b["Buff"]["Duration"] = fp(JC_FLOAT)
    landing(port, by, "rrb_jc", "rrb_jc_land", "atkj5c_land", 1)
    port.note("rrb_jc", "float 5.6 u/s at 0, gravity 42, then 70 after the shot; lands into rrb_jc_land")
    # Gun Blast: BBTAG fires on tick 8 (0.133 s) and she leaves with the shot. Ragna's air dash (the blasts' physics)
    # moved her from 0.03 s, so the muzzle and rings appeared 0.07-0.1 s behind her (Test 5 #12). The first blast now
    # travels from the shot, over 0.12 s so it ends inside the 0.27 s air clip; chained blasts start on their firing
    # frame already (CHAIN_OFF). The ground blasts copy this below.
    ab = by["dashAir"]
    for m in ab.get("AddMotions") or []:
        m["Time"] = fp(SHOT_T); m["Motion"]["DurationEx"]["ConstValue"] = fp(0.12)
    for sc in ab.get("ScriptCalls") or []:
        if sc["Call"]["Function"] == "AddMotion":
            sc["TimeConfig"]["Start"] = fp(SHOT_T)
            sc["Call"]["Params"] = re.sub(r"Duration: [0-9.]+", "Duration: 0.12", sc["Call"]["Params"])
    port.note("dashAir", "travel from the shot (%.3f s), 0.12 s" % SHOT_T)


# ---------------------------------------------------------------- V2: Dust (KIT_V2 §5; V2_COVERAGE D1-D9)
# (key, buff number, the status her hits add while it is loaded, its duration s, its strength): stock statuses, sized as
# the stock Tactics apply them (Shock 10001: 10 s at 0.2); the numbers stay open for balance
# (2026-10-02: stock Burn 1116's Strength is damage a second (NOTES: 'Stock Burn 1116 = ElementDamageOT'); stock rounds
#  apply it at 20 (commonbullet deadball_boom) and 45 (buffzone fireboom). 0.2 burned 0.2-0.3 HP a second in game)
DUST_EL = [('fire', 1, '1116', 3.0, 20.0), ('ice', 2, '2102', 3.0, 0.5), ('bolt', 3, '10001', 10.0, 0.2), ('grav', 4, '1125', 0.5, 0.3)]
# Summon (the lead, 2026-10-02: "ice up yellow down fire forward or neutral and gravity held summon"; Back + Summon
# turns her round, so it reads as Forward): Up = Ice, Down = Lightning, any other direction (0) = Fire; Summon held
# past DUST_HOLD s = Gravity (a switch in the tapped reload, before its cartridge comes out)
DUST_DIR = {"ice": 1, "bolt": 2, "fire": 0}
DUST_HOLD = (0.17, 0.20)
DUST_SP, DUST_TIME = 25, 10.0
DUST_EJECT, DUST_LOCK, DUST_FREE = 0.21, 0.28, 0.30         # the spent cartridge (after the hold check), the new one locks, cancellable (s)
RECEIVER = (0.05, 1.55)       # the rifle's receiver on rrb611_02 (her rifle pose; the frame has no attachment point)


def dust(port, by):
    """The Dust reload: fold to the rifle, the spent cartridge pops out (grey when none was loaded, else the colour of
    the one that was), the new one locks in with a flash (0.28 s: the buff, so her gunfire and aura change colour on
    that tick), the other Dusts go, and she unfolds. One action per element; the rows pick it by direction."""
    for key, k, status, dur, stre in DUST_EL:
        n = "rrb_dust_" + key
        a = clean(port, "icey", "attack1", n, "dust_reload")
        a["HitDataList"] = []; a["HitAudios"] = []; a["HitEffects"] = []; no_motion(a); a["NextAction"] = ""
        for j in range(5):
            conds = [port.refs.buff("rrb_dust%d" % m, invert=1) for m in range(1, 5)] if j == 0 else [port.refs.buff("rrb_dust%d" % j)]
            e = fx_entry(port, "Role/Rrb/rrb_dust_cart_%d" % j, DUST_EJECT, dx=RECEIVER[0], dy=RECEIVER[1], attached=True)
            e["KillMode"] = 1; e["ConditionGroup"] = {"Combine": 0, "Conditions": conds}
            a.setdefault("AddEffects", []).append(e)
        e = fx_entry(port, "Role/Rrb/rrb_dust_lock_%d" % k, DUST_LOCK, dx=RECEIVER[0], dy=RECEIVER[1], attached=True)
        e["KillMode"] = 1; a["AddEffects"].append(e)
        a["RemoveBuff"] = [{"Time": fp(DUST_LOCK), "TimeConfig": {"StartType": 1, "Start": fp(DUST_LOCK), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1},
                            "BuffName": "rrb_dust%d" % m} for m in range(1, 5) if m != k]
        a.setdefault("AddBuff", []).append(bp.buff("rrb_dust%d" % k, DUST_LOCK, DUST_TIME))
        if key != "grav":       # Summon still held: Gravity (DUST_DIR)
            a["ActionSwitchs"] = [bp.switch("rrb_dust_grav", [port.refs.input(5, 2)], start_type=1, nt=1, t0=DUST_HOLD[0], t1=DUST_HOLD[1])] + (a.get("ActionSwitchs") or [])
        by[n] = a
        port.note(n, "Dust %s: reload %.2f s, cartridge %.2f s, lock-in + buff rrb_dust%d %.2f s (status %s on hit)" % (key, fv(a["TotalDuration"]), DUST_EJECT, k, DUST_LOCK, status))


def dust_logic(k):
    """the Dust buff's hit logic: one call per hit, rrbDustHit (src/rrb_runtime.js, PostHit), which adds the status
    (Burn / Cold / Shock / Curse; x1.5 with the Dust card) and the element's base effect. (0.5.0 test: the status used
    to come from two buffs at once, the Dust and the card's strong Dust, so Cold stacked twice per hit.)"""
    out = [{"Type": 105, "ValueConstFp": {"value": 0}, "ValueAddForStackFp": {"value": 4294967296},
            "OverTimeUpdateIntervalFp": {"value": 0}, "OnlyUpdateWhenBattleRun": 0, "ScriptCall": "rrbDustHit",
            "ParamSet": {"ParamList": [{"Key": "el", "Value": str(k)}, {"Key": "HitStage", "Value": "PostHit"}],
                         "ParamHintTypeInEditor": "BuffLogic_ScriptCallHit"}}]
    if k == 2:
        # (0.6.9 game test, 2026-09-30: a hit ends the stock Freeze before PostHit, so rrbDustHit never saw a Frozen
        #  enemy: no shatter, no Ice-card bonus.) rrbIcePre notes the target's Freeze before the damage (PreCalc, as the
        #  stock 12911's AddBuffWhenHit); rrbDustHit reads the note for the same hit
        out.insert(0, dict(out[0], ScriptCall="rrbIcePre", ParamSet={"ParamList": [{"Key": "el", "Value": "2"}, {"Key": "HitStage", "Value": "PreCalc"}],
                                                                     "ParamHintTypeInEditor": "BuffLogic_ScriptCallHit"}))
    return out


def dust_buffs():
    """the four Dust buffs, cloned at build time from the stock on-hit buff 12911 (logic 105 AddBuffWhenHit: adds a
    buff to whatever the owner hits): the status, its duration and strength, and the aura"""
    out = []
    for key, k, status, dur, stre in DUST_EL:
        out.append({"list": "BuffList", "key": "Idx", "from": "12911", "to": "rrb_dust%d" % k, "set": [
            {"path": "Name", "value": "Ruby Dust: %s" % key},
            {"path": "LogicArray", "value": dust_logic(k)},
            {"path": "AddEffects", "value": [{"Res": "Role/Rrb/rrb_dust_aura_%d" % k, "BindPos": 0, "Offset": {"x": 0.0, "y": 0.0},
                                              "Scale": 1.0, "FitRole": 0, "Layer": 678496669, "BindDirType": 0, "BindPosEveryFrame": 0,
                                              "ValidBuffStackMin": 0, "ValidBuffStackMax": 99999, "StartTimeType": 0}]}]})
    # (the aura record is the stock buff effect record, e.g. 1823's; BindPos 0 = her root: the aura is authored from her
    # feet up. Awaiting a game check)
    return out


def blasts_v3(port, by, delta):
    """Gun Blast v3: the ground Down blast (BBTAG 214A, SpDash_Back: she fires FORWARD and the recoil throws her back,
    facing kept: V2_COVERAGE C2), and the chain versions of the directional blasts (each from its firing frame)."""
    def shift(a, off):
        for m in a.get("AddMotions") or []: m["Time"] = fp(max(0.0, fv(m["Time"]) - off))
        for sc in a.get("ScriptCalls") or []:
            if sc["Call"]["Function"] == "AddMotion": sc["TimeConfig"]["Start"] = fp(max(0.0, fv(sc["TimeConfig"]["Start"]) - off))
    # the back blast: the forward ground blast's physics, travel reversed; the shot's hit in front of her
    bb = copy.deepcopy(by["dash"]); bb["Name"] = "rrb_blast_back"
    L = port.LEN["blast_b_go"] / 60.0
    bb["Animate"] = "%s_blast_b_go" % ROLE; bb["AnimateDuration"] = fp(L); bb["TotalDuration"] = fp(L)
    for m in bb.get("AddMotions") or []:
        m["Motion"]["DeltaX"]["ConstValue"] = fp(-abs(fv(m["Motion"]["DeltaX"]["ConstValue"])))
    for sc in bb.get("ScriptCalls") or []:
        if sc["Call"]["Function"] == "AddMotion":
            sc["Call"]["Params"] = re.sub(r"Distance: *([0-9.]+)", r"Distance: -\1", sc["Call"]["Params"])
    with_hits(port, bb, ["SpDash_Back"], "light", "dash", span=(0, L + 0.01))
    bb["NextAction"] = "dashend"
    by["rrb_blast_back"] = bb
    port.note("rrb_blast_back", "ground Down + Dash: BBTAG 214A, the shot forward, the recoil carries her back (facing kept)")
    # the air backward gun-dash (BBTAG j.214A, AirSpDash_Back; the lead, 2026-09-29): the air blast's physics, travel
    # reversed and leaving on its shot (tick 6); its own BBTAG sprites through the recoil flight, then her fall
    ab = copy.deepcopy(by["dashAir"]); ab["Name"] = "rrb_blast_air_back"
    L = port.LEN["blast_air_b_go"] / 60.0
    ab["Animate"] = "%s_blast_air_b_go" % ROLE; ab["AnimateDuration"] = fp(L); ab["TotalDuration"] = fp(L)
    t_shot = FIRE_TICK["AirSpDash_Back"] / 60.0
    for m in ab.get("AddMotions") or []:
        m["Time"] = fp(t_shot); m["Motion"]["DeltaX"]["ConstValue"] = fp(-abs(fv(m["Motion"]["DeltaX"]["ConstValue"])))
    for sc in ab.get("ScriptCalls") or []:
        if sc["Call"]["Function"] == "AddMotion":
            sc["TimeConfig"]["Start"] = fp(t_shot)
            sc["Call"]["Params"] = re.sub(r"Distance: *([0-9.]+)", r"Distance: -\1", sc["Call"]["Params"])
    with_hits(port, ab, ["AirSpDash_Back"], "light", "dash", span=(0, L + 0.01))
    ab["NextAction"] = "drop"
    by["rrb_blast_air_back"] = ab
    port.note("rrb_blast_air_back", "air Down + Dash: BBTAG j.214A, the shot forward at %.2f s, the recoil carries her back" % t_shot)
    # chain versions: from the firing frame, travel and hits moved up by the wind-up they skip
    for name, base, clip, st in (("rrb_blast_back_c", "rrb_blast_back", "blast_b_chain", "SpDash_Back"),
                                 ("rrb_blast_air_back_c", "rrb_blast_air_back", "blast_air_b_chain", "AirSpDash_Back"),
                                 ("rrb_blast_up_c", "rrb_blast_up", "blast_u_chain", "SpDash_AntiAir"),
                                 ("rrb_blast_air_up_c", "rrb_blast_air_up", "blast_u_chain", "SpDash_AntiAir"),
                                 ("rrb_blast_down_c", "rrb_blast_down", "blast_air_d_chain", "AirSpDash_AntiLand")):
        c = copy.deepcopy(by[base]); c["Name"] = name
        off = FIRE_TICK[st] / 60.0
        L = port.LEN[clip] / 60.0
        c["Animate"] = "%s_%s" % (ROLE, clip); c["AnimateDuration"] = fp(L); c["TotalDuration"] = fp(L)
        shift(c, off)
        with_hits(port, c, [st], "launch" if "up" in name else ("down" if "down" in name else "light"), "dash", offset=off, span=(off, off + L + 0.01))
        by[name] = c
        port.note(name, "chain version of %s: from the firing frame (%.3f s of wind-up skipped)" % (base, off))
    # once per airtime: any first air blast locks all three until she lands (landing states clear them, as the stock
    # air dash's own cooldown); the chain versions are separate actions, so a chain runs on (V2_COVERAGE C6)
    for n in LOCKERS:
        by[n]["CDList"] = [x for x in by[n].get("CDList") or [] if x.get("ID") not in AIR_STARTERS] + \
                          [{"Time": fp(0), "ID": m, "Duration": fp(5.0)} for m in AIR_STARTERS]


def blast_distances(port, by):
    """0.9.0, after every blast action exists and before the Potentials pass copies them: one distance for all
    (BLAST_DIST); the backward blast no longer ends with a pull forward; and an air blast lasts until the next blast of
    a chain may start, so its landing frames never show between two blasts ("awkward hopping")."""
    for n in ALL_BLASTS:
        a = by[n]
        kind = "back" if "back" in n else "up" if "_up" in n else "down" if "down" in n else "fwd"
        want = BLAST_DIST[kind]
        for m in a.get("AddMotions") or []:
            if kind in ("fwd", "back"):
                m["Motion"]["DeltaX"]["ConstValue"] = fp(want if kind == "fwd" else -want)
            else:
                m["Motion"]["DeltaX"]["ConstValue"] = fp(want[0]); m["Motion"]["DeltaY"]["ConstValue"] = fp(want[1])
        if kind == "back":
            # (a tester, 2026-10-07: the backward dash "pulls you back forward at the very end of animation". The donor's
            #  air dash adds 6.5 u/s forward at 0.25 s, its exit speed, and the stock dashend accelerates forward: right
            #  for a forward dash, a pull the wrong way for this one.) It keeps a little of its own backward speed
            for sc_ in a.get("SpeedChanges") or []:
                sc_["SpeedAdd"]["x"] = fp(-2.5)
            if a.get("NextAction") == "dashend": a["NextAction"] = BACK_END
        te = travel_end(a)
        if "Air" in n or "air" in n or "down" in n:
            need = round(te + BLAST_PAUSE + 0.02, 3)
            if fv(a["TotalDuration"]) < need: a["TotalDuration"] = fp(need)
        port.note(n, "0.9.0: travels %s u; travel over at %.2f s; lasts %.2f s" % (want, te, fv(a["TotalDuration"])))
    # (its name must not read as "<a move>_<suffix>": the effect and sound passes treat such an action as a card
    #  version of that move, and the first 0.9.0 build played the blast's gunshot and voice line again in the recovery)
    end = copy.deepcopy(by["dashend"]); end["Name"] = BACK_END
    end["StartSpeed"]["Accelerate"]["x"] = fp(0.0)
    end["Animate"] = "%s_blast_b_end" % ROLE; end["AnimateDuration"] = fp(port.LEN["blast_b_end"] / 60.0)
    by[BACK_END] = end
    port.note(BACK_END, "the backward blast's own recovery: its own frames (SpDash_Back's end), the stock dashend without its forward acceleration")


def moves(port, by):
    def delta(t, dx, dy, dur):
        m = copy.deepcopy(tpl(port, "icey", "attackAir1")["AddMotions"][0])
        m["Time"] = fp(t); m["ConditionGroup"] = {"Combine": 0, "Conditions": []}
        m["Motion"]["DeltaX"]["ConstValue"] = fp(dx); m["Motion"]["DeltaY"]["ConstValue"] = fp(dy); m["Motion"]["DurationEx"]["ConstValue"] = fp(dur)
        return m
    for name, (clip, (lg, an), states, feel, floor, arm) in KIT.items():
        a = clean(port, lg, an, name, clip)
        with_hits(port, a, states, feel, floor)
        armor(a, arm)
        sfx(a, "sfx_no_attack1" if floor in ("normal", "air") else "sfx_no_attack3_p1", 0.05)
        by[name] = a
    movement(port, by)
    # Corkscrew Slice = BBTAG's Reversal Action, a wide spin IN PLACE (Test 2: "just a slide"). ICEY's rush template
    # gave it a 10 u/s start speed and two AddMotion calls (1.5 u); now only a small carry out of the blast (0.8 u)
    ck = by["rrb_corkscrew"]
    ck["StartSpeed"]["Speed"]["x"] = fp(0.0); ck["StartSpeed"]["InheritSpeed"]["x"] = fp(0.0)
    ck["ScriptCalls"] = [x for x in ck.get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"]
    ck["AddMotions"] = [delta(0.1, 0.8, 0.0, 0.3)]
    port.note("rrb_corkscrew", "spin in place (0.8 u carry); the rush template's speed and motion calls removed")
    # Buzzsaw Blast (BBTAG AirRolling_A, Test 2: "should be a spinning dropping attack"):
    #   air:     a small hop (BBTAG impulse at 0.05 s), then the spin (408_05-07) LOOPED all the way down on a steady dive,
    #            cutting every 0.1 s (0.1.x played one spin, then the landing animation in mid-air)
    #   landing: (BBTAG upon-landing -> label 9) the grounded spin, the finishing shot forward-down at +0.27 s
    #            (AirRollingShot) with its recoil hop back, then recovery (label 99)
    bz = by["rrb_buzzsaw"]; bz["OnGroundAction"] = "rrb_buzzsaw_land"; bz["DropEndAction"] = "rrb_buzzsaw_land"
    spin = bz["HitDataList"][0]
    spin["TickRange"]["Start"] = fp(0.25); spin["TickRange"]["End"] = fp(port.LEN["buzzsaw"] / 60.0); spin["TickRange"]["HitInterval"] = fp(0.1)
    bz["HitDataList"] = [spin]
    bz["ScriptCalls"] = [x for x in bz.get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"]
    bz["AddMotions"] = [delta(0.05, 0.3, 0.4, 0.12)]
    buzz_dive(port, bz, 0.2)
    port.note("rrb_buzzsaw", "hop, then the spin looped on a dive (about 10 u/s down) until landing; cuts every 0.1 s; "
              "Down held at 0.2 s: %s; Up held: %s, then the dive" % (BUZZ_DOWN, BUZZ_UP))
    land = clean(port, "icey", "attack1", "rrb_buzzsaw_land", "buzzsaw_land"); land["NextAction"] = ""
    ls = hit(port, "air", 0.0, 0.25, [-0.9, -0.2, 1.3, 1.6], "skill"); ls["TickRange"]["HitInterval"] = fp(0.1)
    shot = hit(port, "knock", 0.267, 0.35, [0.2, -0.3, 3.6, 1.4], "skill")
    land["HitDataList"] = [ls, shot]
    land["HitAudios"] = copy.deepcopy(bz.get("HitAudios") or [])
    land["HitEffects"] = copy.deepcopy(bz.get("HitEffects") or [])
    land["ScriptCalls"] = [x for x in land.get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"]
    land["AddMotions"] = []
    # BBTAG 409_04 (0.267 s): physicsXImpulse -6000, physicsYImpulse 20000 = back 1.7 u/s, up 5.6 u/s. A motion delta
    # doesn't lift a grounded action (Test 5: the backflip played on the floor); a start speed does, as her jump's does.
    # Gravity 27 u/s2 (BBTAG's own air-move gravity, j.C's setGravity 1600) gives a 0.58 u backflip that lands at 0.69 s,
    # where the clip's held airborne frame (409_07) gives way to BBTAG's recovery (409_08, label 99).
    launch(port, land, 0.267, -1.7, 5.6, -27.0)
    sfx(land, "sfx_no_attack7", 0.267)
    armor(land, 5)
    by["rrb_buzzsaw_land"] = land
    port.note("rrb_buzzsaw_land", "grounded spin 0-0.25 s, finishing shot forward at 0.27 s, recoil hop back")
    # Skills with projectiles: Noel's Rifle Shot / Sy-Pod bodies on her clips; the shots are her bullets
    for name, clip, an, shots in (("rrb_rifleshot", "longshot", "attack7", ["b7"]), ("rrb_sypod", "sypod", "skill4s", ["s4"])):
        a = clean(port, "no", an, name, clip)
        src = tpl(port, "no", an)
        roles = [copy.deepcopy(r) for r in src.get("AddRoles") or [] if any(x.get("ConstValue") in shots for x in r.get("StartActionEx") or [])]
        # Rifle Shot is BBTAG's Shot: she folds Crescent Rose into the rifle and fires (VIDEO_STUDY_MOVESET: no slash)
        mv = port.MOVES.move("Shot" if name == "rrb_rifleshot" else "AttackAndShotB")
        shot_t = [t for t, k, v in mv["cues"] if k == "gfx" and str(v).startswith(("RifleShot", "ShotAtk"))]
        roles = roles[:len(shot_t)]   # BBTAG fires one round per spawn in her script (Sy-Pod: 2)
        for i, r in enumerate(roles):
            r["RoleId"]["ConstValue"] = BID
            if i < len(shot_t):
                r["TimeConfig"]["Start"] = fp(shot_t[i]); r["TimeConfig"]["End"] = fp(shot_t[i])
        a["AddRoles"] = roles
        a["AddEffects"] = [e for e in copy.deepcopy(src.get("AddEffects") or []) if "attack7_01" in json.dumps(e) or "skill4_01" in json.dumps(e)]
        for r, t in zip(roles, shot_t):
            sfx(a, "sfx_no_attack7", t)
        armor(a, 5)
        a["NextAction"] = ""
        if name == "rrb_sypod":   # Test 2: "more oomph, stronger, faster": the whole move 25 % faster (shots included)
            bp.retime(a, 4.0 / 3.0)           # retime(a, k): k times faster
            shot_t = [t * 0.75 for t in shot_t]
        port.note(name, "shots at %s s (from her script's projectile spawns)" % [round(t, 2) for t in shot_t])
        by[name] = a
    # Gun Blast: the dash actions get the recoil shot's hit (behind her: the shot propels her forward) and pass-through
    for d in DASHES:
        air = "Air" in d
        a = by[d]
        st = "AirSpDash_Front" if air else "SpDash_Front"
        off = CHAIN_OFF if d[-1] in "23" else 0.0   # chained blasts start at the firing frame
        mv = with_hits(port, a, [st], "light", "dash", offset=off, span=(off, off + fv(a["AnimateDuration"]) + 0.01))
        for h in a["HitDataList"]:   # the shot behind + her path through the enemy
            h["HitBox"]["Min"]["x"] = fp(min(fv(h["HitBox"]["Min"]["x"]), -1.6)); h["HitBox"]["Max"]["x"] = fp(max(fv(h["HitBox"]["Max"]["x"]), 1.2))
        sfx(a, "sfx_no_attack7", 0.15)
        a["AddEffects"] = []
    # Gun Blast v2 (Test 2): the ground blasts take the air blast's physics, so her recoil launches her on the ground
    # too (0.1.x used Ragna's ground dash: 12 u/s start speed + 1.2 u, which read as a plain dash)
    for g_, a_ in (("dash", "dashAir"), ("dash2", "dashAir2"), ("dash3", "dashAir3")):
        for k in ("StartSpeed", "SpeedChanges", "AddMotions", "Flyin"):
            by[g_][k] = copy.deepcopy(by[a_].get(k))
        by[g_]["ScriptCalls"] = ([x for x in by[g_].get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"] +
                                 [copy.deepcopy(x) for x in by[a_].get("ScriptCalls") or [] if x["Call"]["Function"] == "AddMotion"])
        port.note(g_, "air blast physics (from %s), along the floor (V2: no lift; BBTAG's forward blast is a low streak)" % a_)
    # directional blasts (Up on the ground, Down in the air): the dash actions' physics, her diagonal clips
    for name, base, clip, st in (("rrb_blast_up", "dash", "blast_u_go", "SpDash_AntiAir"), ("rrb_blast_down", "dashAir", "blast_air_d_go", "AirSpDash_AntiLand")):
        a = copy.deepcopy(by[base]); a["Name"] = name
        a["Animate"] = "%s_%s" % (ROLE, clip); a["AnimateDuration"] = fp(port.LEN[clip] / 60.0); a["TotalDuration"] = fp(port.LEN[clip] / 60.0)
        with_hits(port, a, [st], "launch" if name == "rrb_blast_up" else "down", "dash", span=(0, port.LEN[clip] / 60.0 + 0.01))
        a["NextAction"] = "dashend" if name == "rrb_blast_up" else "dashAirend"
        by[name] = a
    # travel: the diagonal blasts leave the dash's horizontal motion call for a stock delta motion, from the shot
    # (BBTAG: SpDash_AntiAir fires and moves her at 0.117 s, AirSpDash_AntiLand at 0.15 s; 0.2.x used 0.17 / 0.18 s,
    # read with the old sprite-end cue timing, so she left 0.03-0.05 s after her muzzle flash). The Down blast's travel
    # takes 0.15 s so it ends inside its 0.30 s clip. Distances are design values.
    by["rrb_blast_air_up"] = copy.deepcopy(by["rrb_blast_up"]); by["rrb_blast_air_up"]["Name"] = "rrb_blast_air_up"
    by["rrb_blast_air_up"]["NextAction"] = "dashAirend"   # Test 2: "i cant use the up version when im in the air"
    for name, (t, dx, dy, dur) in (("rrb_blast_up", (0.117, 2.5, 3.0, 0.22)), ("rrb_blast_air_up", (0.117, 2.5, 3.0, 0.22)),
                                   ("rrb_blast_down", (0.15, 2.5, -3.2, 0.15))):
        a = by[name]
        a["ScriptCalls"] = [s for s in a.get("ScriptCalls") or [] if s["Call"]["Function"] != "AddMotion"]
        a["AddMotions"] = [delta(t, dx, dy, dur)]
        port.note(name, "diagonal travel %.1f, %.1f u at %.2f s" % (dx, dy, t))
    blasts_v3(port, by, delta)
    blast_distances(port, by)
    MOTION = {"rrb_petalburst": [(1.5, 11.0, 0.0, 0.4), (2.8, 2.0, 0.0, 0.2)],   # BBTAG: impulses 1.50 s, teleport 2.80 s
              "rrb_petaldance": [(1.43, 1.0, 0.0, 0.3)]}
    # SP moves: Petal Burst (the Ultra), Petal Dance (its own SP move), Red Reaper (the Ultra's final upgrade)
    for name, clip, st in (("rrb_petalburst", "petalburst", "UltimateAssault"), ("rrb_petaldance", "petaldance", "UltimateDance"),
                           ("rrb_redreaper", "redreaper", "AstralHeat")):
        a = clean(port, "icey", "attack4", name, clip)
        with_hits(port, a, [st], "knock", "skill")
        armor(a, 9)
        a["ScriptCalls"] = [s for s in a.get("ScriptCalls") or [] if s["Call"]["Function"] != "AddMotion"]
        a["AddMotions"] = [delta(*m) for m in MOTION.get(name, [])]
        if name in MOTION: port.note(name, "travel %s" % MOTION[name])
        a["Invincibility"] = copy.deepcopy(tpl(port, "rg", "dashend").get("Invincibility") or [])
        for inv in a["Invincibility"]:
            for k in ("TimeRange", "Range"):
                if k in inv:
                    inv[k]["Start"] = fp(0); inv[k][[x for x in inv[k] if x != "Start"][0]] = fp(fv(a["TotalDuration"]))
        by[name] = a
    rrb_pots.moves_v2(sys.modules[__name__], port, by)     # V2: the new moves' own logic (chase, hook, EX dive...)


def bullet_tree(port):
    """Her projectile logic: Noel's shot (b7) and planted round (s4) with their own follow-ups; everything else dropped."""
    T = copy.deepcopy(port.TPL_RAW["nobullet"])
    A = {a["Name"]: a for a in T["_actions"]}
    keep, todo = set(), ["b7", "s4", "blt"]
    while todo:
        n = todo.pop()
        if n in keep or n not in A: continue
        keep.add(n); a = A[n]
        todo += [a.get("NextAction") or ""] + [(s.get("NewActionEx") or {}).get("ConstValue") or "" for s in a.get("ActionSwitchs") or []]
    T["_actions"] = [a for a in T["_actions"] if a["Name"] in keep]
    for a in T["_actions"]:
        a["AddEffects"] = [e for e in a.get("AddEffects") or [] if "kkbullet" not in json.dumps(e)]
    used = set(int(x) for x in re.findall(r'\{"rid": (-?\d+)\}', json.dumps(T["_actions"])))
    T["references"]["RefIds"] = [r for r in T["references"]["RefIds"] if r["rid"] in used and r["type"]["class"]]
    missing = used - {r["rid"] for r in T["references"]["RefIds"]} - {-2}
    if missing: raise SystemExit("projectile tree: unresolved reference ids %s" % sorted(missing)[:5])
    T["m_Name"] = BLOGIC
    T["AnimationJson"] = ROLE; T["AnimationJsons"] = [ROLE]   # her effect clips (texture family rrb_02)
    port.note(BLOGIC, "projectiles: %s (Noel's bullet logic, Kokonoe's trail effect removed)" % sorted(keep))
    return {k: v for k, v in T.items() if not k.startswith("m_") or k == "m_Name"}


# ---------------------------------------------------------------- 2b. Legacy skills (what her Evotype passes on)
# Stock shape (Nine's): SkillFromTeacher -> the receiver plays its own `teacherskill` and creates her bullet with action
# TS<id>; that root spawns the rounds. Each skill has its own round action, so its Legacy damage row (group 9, AttrRoleId /
# AttrDamageOrder) scales with that skill's level. Values sized on Rachel's Legacy skills, like Nine's.
# The row's defaults (cast `teacherskill`, 100 MP, mute "all":0.4, ground and air) come from LEGACY_DONOR: Jin's first
# Legacy row, base game. Until 0.6.11 it was Rachel's 1004011 (paid DLC; INTEGRATION_AUDIT O2): the two stock rows are
# equal in every field legacy_rows() doesn't set itself, so her rows are unchanged.
LEGACY_DONOR = 1002011
LEGACY = [   # KIT_V2 §3: her BBTAG partner skills (replace 0.x's Rifle Volley / Rose Barrage); texts: rrb_text.LEGACY_TEXT
    dict(id=2007011, order=1, name="Rifle Shot", donor=LEGACY_DONOR, dmg=(2.4, 7.2), value=1.0, round="TS_round1", ratio=0.75,
         state="CmnActChangePartnerAssistAtk_A", clip="assist_shot",
         desc='Fires a very fast rifle round straight ahead, dealing {"v":"damage","Color":9} damage.',
         up="The damage increases with the level."),
    dict(id=2007012, order=2, name="Rose Lunge", donor=LEGACY_DONOR, dmg=(2.2, 6.6), value=1.0, round="TS2007012", ratio=0.75,
         state="CmnActChangePartnerAssistAtk_D", clip="assist_lunge",
         desc='Lunges forward with the scythe, dealing {"v":"damage","Color":9} damage and launching enemies.',
         up="The damage increases with the level."),
]


# ---------------------------------------------------------------- 2c. Red Reaper's presentation
# Her effect clips (ruby_clips EFFECTS) play as small projectiles of her bullet logic (effects(): fx_action), the way
# Noel's shell casing `blt` does: the rifle flashes from above and the two halves of the petal wipe.

RR_SKY = (2.667, 5.95)    # Red Reaper: her astral sky on / off (s); off while the petal wipe is densest
RR_FLASH = (2.62, 2.75)   # the white-out around the switch to the sky (in 0.1 s, out 0.35 s)
RR_WIPE, RR_WIPE_Y = 5.317, 2.0   # the petal wipe: start (s) and height of its centre above her feet (about mid-screen)


# ---------------------------------------------------------------- V2: which BBTAG states' cues an action plays
# Her effects are compiled arcs and kit effects (rrb_fx.wire, fxcompile_ruby); her sounds are rrb_sound.wire. Both read
# the cue times from her BBTAG script (bbtag_moves) for the states listed here.
FX_ACTIONS = {   # action -> (BBTAG states whose effect cues it plays, the action's start inside them, cue window end)
    "rrb_buzzsaw": (["AirRolling_A"], 0.0, 0.45), "rrb_buzzsaw_land": (["AirRolling_A"], 0.45, None),
    "rrb_rifleshot": (["Shot"], 0.0, None), "rrb_sypod": (["AttackAndShotB"], 0.0, None),
    "rrb_clash": (["CmnActCrushAttack"], 0.0, 0.47), "rrb_clash_land": (["CmnActCrushAttack"], 0.6, None),
    "rrb_jc": (["NmlAtkAIR5C"], 0.0, 0.34), "rrb_jc_land": (["NmlAtkAIR5C"], 0.433, None),
    "dash": (["SpDash_Front"], 0.0, None), "dash2": (["SpDash_Front"], CHAIN_OFF, None), "dash3": (["SpDash_Front"], CHAIN_OFF, None),
    "dashAir": (["AirSpDash_Front"], 0.0, None), "dashAir2": (["AirSpDash_Front"], CHAIN_OFF, None),
    "dashAir3": (["AirSpDash_Front"], CHAIN_OFF, None), "rrb_blast_up": (["SpDash_AntiAir"], 0.0, None),
    "rrb_blast_back": (["SpDash_Back"], 0.0, None), "rrb_blast_back_c": (["SpDash_Back"], 8 / 60.0, None),
    "rrb_blast_up_c": (["SpDash_AntiAir"], 7 / 60.0, None), "rrb_blast_air_up_c": (["SpDash_AntiAir"], 7 / 60.0, None),
    "rrb_blast_down_c": (["AirSpDash_AntiLand"], 9 / 60.0, None),
    "rrb_blast_air_back": (["AirSpDash_Back"], 0.0, None), "rrb_blast_air_back_c": (["AirSpDash_Back"], 6 / 60.0, None),
    "rrb_blast_air_up": (["SpDash_AntiAir"], 0.0, None), "rrb_blast_down": (["AirSpDash_AntiLand"], 0.0, None),
}
FX_LOOP = {"rrb_buzzsaw": ("rrb408Eff", 0.25, 0.2)}   # her spin loops on the dive: the wheel again every loop (0.2 s)


def fx_entry(port, name, t, angle=0.0, scale=1.0, dx=0.0, dy=0.0, hit=False, attached=None):
    src = tpl(port, "icey", "attack1")["HitEffects" if hit else "AddEffects"][0]
    e = copy.deepcopy(src)
    e["NameEx"]["ConstValue"] = name
    e["Start"] = fp(max(0.0, t))
    e["Rotation"] = {"x": fp(angle), "y": fp(angle)}
    e["Scale"] = {"x": fp(scale), "y": fp(scale)}
    e["Position"] = {"x": fp(dx), "y": fp(dy)}
    if attached is not None:
        # attached: follows her and flips with her; KillMode 1 lets a short arc finish when she cancels into the next
        # move (BBTAG keeps them too). Detached: spawned in place, where BBTAG leaves it.
        e["Binding"], e["KillMode"], e["BindPos"] = (1, 1, 0) if attached else (0, 1, 0)
    return e


# ---------------------------------------------------------------- V2: weight (V2_PLAN P5; research/BBEE_REFERENCE_RAGNA_NAOTO.md)
# Every hit had victim 0.10 s / attacker 0.02 s hitstop and no camera shake (Test 5: "flat"). BBEE's strings escalate:
# victim 0.15 / 0.20 / 0.20 / 0.30 s, attacker 0.02-0.10 s, a shake on every hit (vertical on the launcher).
HIT_L, HIT_M, HIT_H, HIT_GUN = "Role/Rrb/rrb_hit_l", "Role/Rrb/rrb_hit", "Role/Rrb/rrb_hit_h", "Role/Rrb/rrb_hit_gun"
# blunt hits: the moves BBTAG itself strikes blunt (its hit effect rrbHitEff, not rrbHitEff_Slash; its smears use the
# blunt dageki textures): 5AAA, Clash Assault, j.C, Guillotine (the lead, 2026-09-29: 5AAA "is supposed to be like a
# blunt effect"). Their hits thud instead of cut: BBEE's impact bursts hit_601 / hit_602 in her colours (fxkit_cross).
BLUNT_MOVES = ("rrb_a3", "rrb_clash", "rrb_jc", "rrb_guillotine")
BLUNT_OF = {HIT_L: "Role/Rrb/rrb_hitb_m", HIT_M: "Role/Rrb/rrb_hitb_m", HIT_H: "Role/Rrb/rrb_hitb_h"}
WCLASS = {   # victim, attacker hitstop (s); shake x, y, duration; hit effects
    "light":  (0.15, 0.03, (0.12, 0.06, 0.08), [HIT_L]),
    "medium": (0.20, 0.045, (0.18, 0.10, 0.10), [HIT_M]),
    "heavy":  (0.30, 0.09, (0.30, 0.18, 0.15), [HIT_H]),
    "launch": (0.30, 0.08, (0.08, 0.30, 0.15), [HIT_H]),
    "gun":    (0.15, 0.0, (0.15, 0.08, 0.08), [HIT_GUN]),
    "gunheavy": (0.25, 0.0, (0.25, 0.15, 0.12), [HIT_GUN, HIT_H]),
    # stage 3 rounds (rrb_power.MAX_ROUNDS): the Rifle's piercing round and Sy-Pod's heavy round
    "gunmax":   (0.22, 0.0, (0.26, 0.14, 0.11), [HIT_GUN, HIT_H]),
    "gunmaxheavy": (0.30, 0.0, (0.36, 0.22, 0.15), [HIT_GUN, HIT_H]),
    # the repeated hits of a flurry (Guillotine, 5AAA's re-hits, Buzzsaw's spin): short stops so the move keeps its
    # rhythm; only the flurry's last hit carries the move's own weight (ref rule 12)
    "multi":  (0.07, 0.02, (0.08, 0.05, 0.05), [HIT_L]),
}
# the hit sound by class (V2_PLAN §4 audio): stock sounds until her own BBTAG sounds are imported (KIT_V2 §8), all
# from Noel's bank, which already plays for her (0.1.x-0.2.x used sfx_no_attack_hit on every hit)
HIT_SOUND = {"light": "sfx_no_attack_hit", "multi": "sfx_no_attack_hit", "medium": "sfx_no_attackZ_hit",
             "heavy": "sfx_no_attackEX_hit", "launch": "sfx_no_attackEX_hit", "gun": "sfx_no_skillEX_hit",
             "gunheavy": "sfx_no_skillEX_hit", "gunmax": "sfx_no_skillEX_hit", "gunmaxheavy": "sfx_no_skillEX_hit"}
ATTACKER_FREEZE = {"rrb_a4": 0.02}   # the 5AAAA pass keeps going through the target (the victim still stops 0.30 s)
LIGHTER = {"heavy": "medium", "launch": "medium", "medium": "light", "light": "light", "gun": "gun", "gunheavy": "gun"}
WEIGHT = {"s4_jc": "gunmaxheavy", "rrb_gust_a4": "multi", "b7_max": "gunmax", "s4_max": "gunmaxheavy", "rrb_guil_wave": "heavy", "rrb_pd_storm": "multi", "rrb_a1": "light", "rrb_a2": "light", "rrb_a3": "medium", "rrb_a4": "heavy", "rrb_launcher": "launch",
          "rrb_sweep": "medium", "rrb_clash": "heavy", "rrb_corkscrew": "medium", "rrb_ja": "light", "rrb_jb": "light",
          "rrb_jc": "heavy", "rrb_j2a": "light", "rrb_guillotine": "heavy", "rrb_buzzsaw": "medium",
          "rrb_buzzsaw_land": "heavy", "rrb_petalburst": "heavy", "rrb_petaldance": "heavy", "rrb_redreaper": "heavy",
          "dash": "light", "rrb_blast": "light", "b7": "gun", "s4": "gunheavy", "TS_round": "gun",
          "TS2007012": "heavy",                      # Legacy II Rose Lunge: 5AAAA's cut, 5AAAA's weight
          # V2 Potentials
          "rrb_5b": "medium", "rrb_5bb": "heavy", "rrb_2a": "light", "rrb_2b": "launch", "rrb_clash_chase": "medium",
          "rrb_clash_finish": "heavy", "rrb_clash_exfinish": "heavy", "rrb_hook": "light", "rrb_hook_exe": "heavy",
          "rrb_hook_back": "heavy", "rrb_guil_loop": "multi", "rrb_petalzone": "multi", "rrb_cartblast": "gunheavy",
          "rrb_dustburst": "heavy", "rrb_dustround": "gun", "rrb_spark": "medium", "rrb_flame": "multi",
          "rrb_icespike": "launch", "rrb_gwell": "multi", "rrb_gwell_end": "launch", "rrb_erupt": "heavy"}

# Rising Crescent carries the target up with her (rrb_power.launch_heights): both stop for the same short time so they
# leave together (stock: Ragna's launcher 0.10 / 0.09). Its stage slashes (rrb_2b_w2/_w3) take the class by prefix.
WCLASS["carry"] = (0.08, 0.08, (0.08, 0.30, 0.15), [HIT_H])
HIT_SOUND["carry"] = "sfx_no_attackEX_hit"
LIGHTER["carry"] = "medium"
WEIGHT["rrb_2b"] = "carry"


FLOOR_GAP = 0.05


def floor_reach(port, by, btree):
    """(The lead, 2026-10-02: "tap shot and sypod shot also have times where they arent hitting enemies or they arent
    hitting grounded enemies; make sure all attacks that should hit grounded enemies do".) A round fired at her muzzle
    height (Rifle 1.24 u, Sy-Pod 0.93 u) had a box 0.5 u under it, so anything shorter than 0.74 / 0.43 u on the floor was
    missed; several zones spawned at her waist had the same gap. Every projectile her GROUND moves spawn now reaches down
    to the floor from the highest point it is spawned at (its switch copies and pierce copies inherit the height)."""
    air = ("rrb_ja", "rrb_jb", "rrb_jc", "rrb_j2a", "rrb_buzzsaw", "rrb_launcher_air", "dashAir", "rrb_blast_air", "rrb_guil_loop")
    B_ = {a["Name"]: a for a in btree["_actions"]}
    high = {}
    def note(tgt, oy):
        if tgt in B_: high[tgt] = max(high.get(tgt, -9.0), oy)
    for src, acts in ((by, list(by.values())), (B_, btree["_actions"])):
        for a in acts:
            if a["Name"].startswith(air): continue
            for r in a.get("AddRoles") or []:
                tgt = (r.get("StartActionEx") or [{}])[0].get("ConstValue")
                oy = fv(((r.get("Position") or {}).get("OffsetY") or {}).get("ConstValue") or fp(0))
                note(tgt, oy + (high.get(a["Name"], 0.0) if src is B_ else 0.0))
    for _ in range(3):                    # through the rounds' switches (b7 -> b7_hc -> b7_hcp; s4 -> s4_p ...)
        for n, h_ in list(high.items()):
            for s in B_[n].get("ActionSwitchs") or []:
                t = (s.get("NewActionEx") or {}).get("ConstValue")
                if t in B_ and not t.endswith(("end", "end_x", "out", "_fireend")): note(t, h_)
    fixed = []
    for n, h_ in high.items():
        if h_ <= FLOOR_GAP: continue
        for hd in B_[n].get("HitDataList") or []:
            y0 = fv(hd["HitBox"]["Min"]["y"])
            if h_ + y0 > FLOOR_GAP:
                hd["HitBox"]["Min"]["y"] = fp(-(h_ + FLOOR_GAP)); fixed.append("%s (%.2f u up)" % (n, h_))
    port.note(BLOGIC, "floor reach: %s" % sorted(set(fixed)))


def weight_of(name):
    best = None
    for k, v in WEIGHT.items():   # Potential variants (rrb_a3_crescent_flurry...) take their base move's class
        if (name == k or name.startswith(k)) and (best is None or len(k) > len(best[0])): best = (k, v)
    return best[1] if best else None


def hit_classes(a, cls):
    """The weight class of each hit window: a flurry (3+ windows, or a re-hitting window) stops briefly ("multi")
    except its last hit; a two-hit move's first hit is one class lighter. (tools/bbtag/check_ruby_build.py audits it.)"""
    H = a.get("HitDataList") or []
    if not H: return []
    last = max(range(len(H)), key=lambda i: fv(H[i]["TickRange"]["Start"]))
    out = []
    for i, h in enumerate(H):
        rehit = fv(h["TickRange"].get("HitInterval") or fp(0)) > 0.03
        if len(H) >= 3 or rehit: out.append(cls if (i == last and not rehit) else "multi")
        else: out.append(cls if (i == last or len(H) == 1) else LIGHTER[cls])
    return out


ARMOR_CLASSES, ARMOR_STRONG = ("heavy", "launch", "carry"), 5


def weight_pass(port, acts):
    """Hitstop, camera shake and hit effect by weight class. On multi-hit moves every window but the last is one class
    lighter (the finisher of a flurry is its heavy hit)."""
    n = 0
    for a in acts:
        cls = weight_of(a["Name"])
        H = a.get("HitDataList") or []
        if not cls or not H: continue
        for h, c in zip(H, hit_classes(a, cls)):
            v, at, (sx, sy, sd), _ = WCLASS[c]
            f = h.setdefault("HitFreezeN", {})
            for k in ("FreezeVictimGround", "FreezeVictimGroundMotion", "FreezeVictimFlying", "FreezeVictimFlyingMotion"):
                f[k] = fp(v)
            at = next((v_ for k_, v_ in ATTACKER_FREEZE.items() if a["Name"].startswith(k_)), at)
            for k in ("FreezeAttacker", "FreezeAttackerMotion"):
                f[k] = fp(at)
            h["CamShake"] = {"Time": 0.0, "ShakeStr": {"x": sx, "y": sy}, "Duration": sd}
            # (2026-10-03) a heavy or launching hit breaks Strong armor (ArmorType tier 5), as the base cast's string
            # finishers do (rgbullet a4s, jn attack3, icey attack5_end: 5); every scythe hit was Weak (1)
            if c in ARMOR_CLASSES: h["ArmorBreak"] = max(int(h.get("ArmorBreak") or 0), ARMOR_STRONG)
        blunt = a["Name"].startswith(BLUNT_MOVES)
        a["HitEffects"] = [fx_entry(port, BLUNT_OF.get(e, e) if blunt else e, 0.0, hit=True) for e in WCLASS[cls][3]]
        a["HitAudios"] = [{"Cue": HIT_SOUND[cls], "Time": 0.0, "StopWhenChangeAction": 0, "CheckVoiceState": 0,
                           "ConditionGroup": {"Combine": 0, "Conditions": []}}]
        # (the audio pass, 2026-10-02: flurries played Noel's 0.45-0.6 s layered hits on every tick and chopped each
        #  other, 252 audible cut-offs in a one-target simulation, 4 after this.) A flurry ticking every 0.25 s or
        #  faster takes Noel's own short flurry tick; other hits closer than 0.15 s to the last sounded one stay silent
        #  (the game's SkipActionHitAudio, as stock Bullet's projectiles use it)
        if any(0 < fv(h["TickRange"].get("HitInterval") or fp(0)) <= 0.25 + 1e-6 for h in H):
            a["HitAudios"][0]["Cue"] = "sfx_no_skillEX_hit"
        else:
            last = None
            for h in sorted(H, key=lambda h: fv(h["TickRange"]["Start"])):
                st = fv(h["TickRange"]["Start"])
                if last is not None and st - last < 0.15 - 1e-6:
                    h["SkipActionHitAudio"] = 1
                else:
                    last = st
        n += 1
    port.note(LOGIC, "V2 weight: %d actions (hitstop, shake and hit effect by class)" % n)


# ---------------------------------------------------------------- V2: effect wiring (rrb_fx.py; V2_REBUILD §2)
AIR_ACTIONS = {"rrb_ja", "rrb_jb", "rrb_jc", "rrb_j2a", "rrb_buzzsaw", "rrb_clash", "dashAir", "dashAir2", "dashAir3",
               "rrb_blast_air_up", "rrb_blast_down", "rrb_blast_air_back", "rrb_blast_air_back_c"} | rrb_pots.AIR_V2   # actions that play in the air (arcs not floored)
HEAVY_SHOTS = ("rrb_sypod", "rrb_clash", "rrb_jc", "rrb_buzzsaw_land", "rrb_guillotine")
# where the blade (or a slam) meets the floor: (time s, x u ahead of her root, "hit" rubble / "skid" dust)
# (BBTAG's own ground contacts, 5AAA / Sy-Pod's chop / the Buzzsaw landing, come from its effects: rrb_fx.child_effects)
GROUND = {"rrb_sweep": [(0.2, 0.9, "skid")], "rrb_clash_land": [(0.0, 0.9, "hit"), (0.0, 0.0, "skid")],
          "rrb_jc_land": [(0.0, 0.9, "hit"), (0.0, 0.0, "skid")], "dashend": [(0.0, 0.0, "skid")],
          BACK_END: [(0.0, 0.0, "skid")],
          "rrb_a4": [(0.45, 0.0, "skid")]}
# BBEE motion effects bound to her (world-space particles stay behind): the 5AAAA pass and forward Gun Blasts streak,
# the Corkscrew spin throws a petal ring
MOTION_FX = {"rrb_a4": [("Role/Rrb/rrb_speedlines", 0.2)], "dash": [("Role/Rrb/rrb_speedlines", 0.13)],
             "rrb_clash": [("Role/Rrb/rrb_speedlines", 0.033)],
             "dash2": [("Role/Rrb/rrb_speedlines", 0.05)], "dash3": [("Role/Rrb/rrb_speedlines", 0.05)],
             "dashAir": [("Role/Rrb/rrb_speedlines", 0.13)], "dashAir2": [("Role/Rrb/rrb_speedlines", 0.05)],
             "dashAir3": [("Role/Rrb/rrb_speedlines", 0.05)], "rrb_corkscrew": [("Role/Rrb/rrb_petal_ring", 0.2)],
             "rrb_blast_back": [("Role/Rrb/rrb_speedlines", 0.13)], "rrb_blast_back_c": [("Role/Rrb/rrb_speedlines", 0.0)],
             "rrb_blast_up": [("Role/Rrb/rrb_speedlines", 0.117)], "rrb_blast_air_up": [("Role/Rrb/rrb_speedlines", 0.117)],
             "rrb_blast_down": [("Role/Rrb/rrb_speedlines", 0.15)], "rrb_blast_up_c": [("Role/Rrb/rrb_speedlines", 0.0)],
             "rrb_blast_air_up_c": [("Role/Rrb/rrb_speedlines", 0.0)], "rrb_blast_down_c": [("Role/Rrb/rrb_speedlines", 0.0)],
             "rrb_blast_air_back": [("Role/Rrb/rrb_speedlines", 0.1)], "rrb_blast_air_back_c": [("Role/Rrb/rrb_speedlines", 0.0)],
             }     # (0.9.0: Reaper's Hook does not slide any more: no streaks)
# thrusts: (time s, grip x, y u from her root, angle deg). 5A's spear end reaches (1.26, 0.96) on the 0.08 s frame
# (ruby_preview --ticks), from her hands at about (0.3, 0.92)
THRUST = {"rrb_a1": (0.067, 0.3, 0.92, 3.0)}


def wire_effects(port, by):
    import rrb_fx
    rrb_fx.TRAIL_ACTIONS = tuple(dict.fromkeys(rrb_fx.TRAIL_ACTIONS + rrb_pots.TRAIL_V2))   # the new scythe moves' trails
    port.TRAIL_V2 = rrb_pots.TRAIL_V2
    port.fv, port.fp, port.RETIMED = fv, fp, RETIMED
    port.AIRBORNE = lambda n: n in AIR_ACTIONS
    acts = {n: (v[2], 0.0, None) for n, v in KIT.items()}
    acts.update(FX_ACTIONS)
    plan, guns = rrb_fx.wire(port, by, None, acts, fx_entry, heavy=HEAVY_SHOTS, loops=FX_LOOP, log=lambda m: port.note(LOGIC, m))
    rrb_fx.place_rounds(port, by, guns, {"rrb_rifleshot": ["b7"], "rrb_sypod": ["s4"]})
    rrb_fx.ground_hits(port, by, fx_entry, GROUND)
    rrb_fx.trails(port, by, fx_entry, plan, acts, log=lambda m: port.note(LOGIC, m))
    for n, lst in MOTION_FX.items():
        for fx, t in lst:
            if n in by:
                e = fx_entry(port, fx, t, attached=True); e["KillMode"] = 1
                by[n].setdefault("AddEffects", []).append(e)
    # 5A's jab (the kit's rrb_thrust): from the grip along the spear end, a tick before its hit (0.083 s); cut if the
    # jab is cancelled
    for n, (t, x, y, ang) in THRUST.items():
        if n in by:
            e = fx_entry(port, "Role/Rrb/rrb_thrust", t, angle=ang, dx=x, dy=y, attached=True); e["KillMode"] = 2
            by[n].setdefault("AddEffects", []).append(e)
            import math, rrb_power
            L = rrb_power.THRUST_LEN; r = math.radians(ang)      # the tip flash at the line's end
            e = fx_entry(port, "Role/Rrb/rrb_thrust_tip", t, dx=x + L * math.cos(r), dy=y + L * math.sin(r), attached=True); e["KillMode"] = 2
            by[n]["AddEffects"].append(e)
    port.note(LOGIC, "V2 gun events: %s" % {k: [(round(t, 3), round(x, 2), round(y, 2), round(a, 1)) for t, x, y, a in v] for k, v in guns.items()})
    return plan


def dedupe_effects(acts):
    """An effect entry identical to another on the same action (same effect, tick, place, angle) spawns twice on top of
    itself: drop the copy (tools/bbtag/audit_ruby_fx.py flags DUP)."""
    n = 0
    for a in acts:
        seen, keep = set(), []
        for e in a.get("AddEffects") or []:
            k = json.dumps(e, sort_keys=True)
            if k in seen: n += 1; continue
            seen.add(k); keep.append(e)
        if a.get("AddEffects"): a["AddEffects"] = keep
    return n


def audit_refs(acts, where):
    """V2_PLAN P9: no transition to an action that doesn't exist (Test 5's Gun Blast hang: 15 switches to Ragna's
    actions). Raises, so a build with a dangling reference can't be made."""
    names = {a["Name"] for a in acts}
    bad = []
    for a in acts:
        for f in ("NextAction", "DropAction", "DropEndAction", "DropEndHighAction", "OnGroundAction", "BeginFallAction"):
            v = a.get(f)
            if v and v not in names: bad.append("%s.%s -> %s" % (a["Name"], f, v))
        for w in a.get("ActionSwitchs") or []:
            v = (w.get("NewActionEx") or {}).get("ConstValue")
            if v and v not in names: bad.append("%s switch -> %s" % (a["Name"], v))
    if bad:
        raise SystemExit("%s: %d transitions to missing actions: %s" % (where, len(bad), bad[:8]))


def effects(port, by, btree):
    A = {a["Name"]: a for a in btree["_actions"]}
    base = copy.deepcopy(A.get("blt") or port.TPL["nobullet"]["blt"])
    made = set()
    def fx_action(clip):
        n = clip
        if n in made: return n
        a = copy.deepcopy(base); a["Name"] = n
        for k in CLEAR + ("AddMotions",):
            if isinstance(a.get(k), list): a[k] = []
        a["ScriptCalls"] = []; a["AddBuff"] = []; a["NextAction"] = ""
        L = port.LEN[clip] / 60.0
        a["Animate"] = "%s_%s" % (ROLE, clip); a["AnimateDuration"] = fp(L); a["TotalDuration"] = fp(L)
        btree["_actions"].append(a); made.add(n)
        return n
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    total = 0
    # Red Reaper's presentation (BBTAG AstralHeat + its effect object rrb450, times with sprite-start cue timing):
    #   2.67 s  signal 32: white-out, the astral sky replaces the stage   -> a white flash, her sky fades in (0.4 s)
    #   3.37 s  signal 33: ten rifle shots from above                      -> her muzzle flash, pointing down
    #   5.32 s  signal 34 (4.58 s) + 44 ticks: the petal wipe, two screen-wide halves -> fx_rr_petals_l / _r
    #   6.08 s  the red fill, then the sky goes (6.75 s)                   -> the sky fades out at 5.95 s, under the wipe
    # (2026-10-02 game test: Silver Eyes plays rrb_redreaper_se, made before this ran, and it had no sky, white-out,
    #  shots or petal wipe: every Red Reaper variant gets the presentation)
    import ruby_fx
    for rr_name in sorted(n_ for n_ in by if n_ == "rrb_redreaper" or n_.startswith("rrb_redreaper_")):
        a = by[rr_name]
        tpl_fx = next(e for e in bp.logic("mi")["_actions"] if e["Name"] == "AH_pre")["AddEffects"]
        sky = copy.deepcopy(next(e for e in tpl_fx if "heidi" in e["NameEx"]["ConstValue"]))
        sky["NameEx"]["ConstValue"] = ruby_fx.ASTRAL_FX
        sky["Start"] = fp(RR_SKY[0]); sky["KillMode"] = 2          # OnActionChange: an interrupted move takes it along
        a.setdefault("AddEffects", []).append(sky)
        a.setdefault("RemoveEffect", []).append({"Tick": fp(RR_SKY[1]), "ConditionGroup": {"Combine": 0, "Conditions": []},
                                                 "Name": ruby_fx.ASTRAL_FX})
        flash = copy.deepcopy(sky); flash["NameEx"]["ConstValue"] = ruby_fx.FLASH_FX; flash["Start"] = fp(RR_FLASH[0])
        a["AddEffects"].append(flash)
        a["RemoveEffect"].append({"Tick": fp(RR_FLASH[1]), "ConditionGroup": {"Combine": 0, "Conditions": []}, "Name": ruby_fx.FLASH_FX})
        # BBTAG rrb450MuzzleEff (signal 33, 3.37 s): ten rifle shots fired down from above, 25 ticks apart (the last 58 later)
        for k, dt in enumerate([i * 25 for i in range(9)] + [258]):
            r = bp.role(role_t, BID, fx_action("fx_muzzle"), 3.367 + dt / 60.0, 1.0, 6.5)
            r["DirAngleV"]["ConstValue"] = fp(-90.0); a["AddRoles"].append(r); total += 1
        # the two halves (x4.2: each about 12 x 13 u) leave a 0.4 u seam at the centre: nudge them to overlap
        # (2026-10-02 game test: placed on her, the two halves left the screen edge bare when the camera was not centred on
        #  her, e.g. near a wall: two more halves further out)
        for clip, dx in (("fx_rr_petals_l", -0.25), ("fx_rr_petals_r", 0.25), ("fx_rr_petals_l", -10.0), ("fx_rr_petals_r", 10.0)):
            a.setdefault("AddRoles", []).append(bp.role(role_t, BID, fx_action(clip), RR_WIPE, dx, RR_WIPE_Y)); total += 1
    if "rrb_redreaper" in by:
        port.note("rrb_redreaper", "astral sky %s %.2f-%.2f s; petal wipe at %.2f s (every variant)" % (ruby_fx.ASTRAL_FX, RR_SKY[0], RR_SKY[1], RR_WIPE))
    # her projectiles' hit effects and weight: weight_pass (gun class)
    # Sy-Pod's rounds hit with weight (Test 2: "more oomph"): Noel's rounds had no hit-freeze and no camera shake
    for a in btree["_actions"]:
        if a["Name"] in ("s4", "s4end"):
            for h in a.get("HitDataList") or []:
                for k in ("FreezeVictimGround", "FreezeVictimGroundMotion", "FreezeVictimFlying", "FreezeVictimFlyingMotion"):
                    h["HitFreezeN"][k] = fp(0.12)
                h["CamShake"] = {"Time": 0.0, "ShakeStr": {"x": 0.18, "y": 0.18}, "Duration": 0.12}
                sp = h["Victim"].get("Speed") or {}
                if isinstance(sp.get("x"), dict): sp["x"] = fp(fv(sp["x"]) * 1.5)
    port.note(BLOGIC, "s4 / s4end: victim freeze 0.12 s, camera shake 0.18 for 0.12 s, push x1.5")
    btree["_actions"] = [a for a in btree["_actions"] if a["Name"] != "blt"]   # the template (Noel's shell clip) goes
    port.note(BLOGIC, "her sprite effects: %d effect actors, %d spawns on her moves" % (len(made), total))


def legacy(port, by, btree):
    """Her Legacy skills as her BBTAG partner skills: the inheritor calls her in. A phantom Ruby (a projectile of her
    bullet logic playing her own assist clip) appears just behind the inheritor and performs it:
      Rifle Shot (assist A): the rifle raised, one fast round from the muzzle on tick 10, flash and casing;
      Rose Lunge (assist D): a gun-propelled lunge forward, the scythe's hit (ticks 12-30) launches.
    Their presentation is Rifle Shot's and 5AAAA's own (same clips). (Proposal: the numbers and the phantom's placement.
    Open: whether her cue sheets are loaded when another character casts them: check by ear and in Player.log.)"""
    A = {a["Name"]: a for a in btree["_actions"]}
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    r = copy.deepcopy(A["b7"]); r["Name"] = "TS_round1"; btree["_actions"].append(r)
    def phantom(name, clip):
        a = bp.root_action(A["b7"], name, [], 0.1)
        L = port.LEN[clip] / 60.0
        a["Animate"] = "%s_%s" % (ROLE, clip); a["AnimateDuration"] = fp(L); a["TotalDuration"] = fp(L)
        a["HitDataList"] = []; a["AddEffects"] = []; a["NextAction"] = ""
        # (2026-10-03, the first time they were run in game, on Noel: the phantom appeared 7 u ahead of the caster and
        # flew on, past every enemy.) The action is built from her rifle round (b7) and kept its flight: 60 u/s and the
        # round's wall rule. The phantom stands where it is called and moves only by its own motions below
        a["StartSpeed"]["Speed"]["x"] = fp(0.0); a["StartSpeed"]["Speed"]["y"] = fp(0.0)
        a["SpeedChanges"] = []; a["CollisionSwitchList"] = []
        m = copy.deepcopy(port.TPL["rg"]["dashAir"]["AddMotions"][0]); m["Time"] = fp(0.0)
        m["ConditionGroup"] = {"Combine": 0, "Conditions": []}
        M = m["Motion"]; M["MotionType"] = 3; M["EaseMode"] = 0
        M["DeltaX"]["ConstValue"] = fp(-0.9); M["DeltaY"]["ConstValue"] = fp(0.0); M["DurationEx"]["ConstValue"] = fp(0.06)
        a["AddMotions"] = [m]                               # she appears just behind the inheritor
        return a
    def point(state, tick):                                 # the frame's attachment point (as effects() does)
        mv = port.MOVES.move(state)
        fr = [f for f in mv["frames"] if f[1] <= tick < f[1] + f[2]]
        jb = port.MOVES.jonbin(fr[0][0]) if fr else None
        pts = (jb or {}).get("boxes", {}).get("box3") or []
        return tuple(port.MOVES.box_u(pts[0])[:2]) if pts else (0.75, 1.2)
    # Rifle Shot
    shot = phantom("TS2007011", "assist_shot"); t = 10 / 60.0
    x, y = point("CmnActChangePartnerAssistAtk_A", 10)
    shot["AddRoles"] = [bp.role(role_t, BID, "TS_round1", t, x, y)]
    shot["AddEffects"] = [dict(fx_entry(port, "Role/Rrb/rrb_muzzle", t, dx=x, dy=y, attached=True), KillMode=1),
                          dict(fx_entry(port, "Role/Rrb/rrb_blast_ring", t, dx=x, dy=y, attached=False), KillMode=1),
                          dict(fx_entry(port, "Role/Rrb/rrb_casing", 14 / 60.0, dx=x - 0.4, dy=y, attached=True), KillMode=1)]
    # Rose Lunge: the hit and the travel from BBTAG's own script
    lunge = phantom("TS2007012", "assist_lunge")
    mv = port.MOVES.move("CmnActChangePartnerAssistAtk_D")
    w = mv["hits"][0] if mv["hits"] else {"start": 12 / 60.0, "end": 30 / 60.0, "box": [-0.6, -0.1, 0.7, 1.4]}
    h = hit(port, "launch", w["start"], w["end"], w["box"], "skill")
    lunge["HitDataList"] = [h]
    lunge["HitAudios"] = []; lunge["HitEffects"] = copy.deepcopy(tpl(port, "icey", "attack1")["HitEffects"])
    m2 = copy.deepcopy(lunge["AddMotions"][0]); m2["Time"] = fp(w["start"])
    m2["Motion"]["DeltaX"]["ConstValue"] = fp(3.6); m2["Motion"]["DurationEx"]["ConstValue"] = fp(w["end"] - w["start"])
    lunge["AddMotions"].append(m2)
    lunge["AddEffects"] = [dict(fx_entry(port, "Role/Rrb/rrb_speedlines", w["start"], attached=True), KillMode=1)]
    # (2026-10-03, "lets also get her inherntence and legacy skills made 2 please".) The assist clips are her own Rifle
    # Shot and 5AAAA frame for frame (rrb_assist_shot == rrb_longshot, rrb_assist_lunge == rrb_atk5aaaa) and BBTAG plays
    # the same cues on them, so the phantom takes those moves' finished presentation: their stage 1 effects (the stage
    # conditions dropped: the inheritor has no Ruby stage), sounds, voice line and camera shake. by[...] is final here
    ref = {r["rid"]: r for r in port.refs.items}
    def stage1(conds):
        d = [ref.get(c.get("rid"), {}).get("data", {}) for c in conds]
        return sorted((x.get("BuffId"), x.get("Invert")) for x in d) == [("rrb_stage2", 1), ("rrb_stage3", 1)]
    def presentation(src):
        fx = []
        for e in src.get("AddEffects") or []:
            c = e["ConditionGroup"]["Conditions"]
            if c and not stage1(c): continue             # other stages, Dust colours, card effects: not the phantom's
            e2 = copy.deepcopy(e); e2["ConditionGroup"] = {"Combine": 0, "Conditions": []}
            fx.append(e2)
        return fx, copy.deepcopy(src.get("Audios") or []), copy.deepcopy(src.get("CameraShake") or [])
    _, shot["Audios"], shot["CameraShake"] = presentation(by["rrb_rifleshot"])
    lunge["AddEffects"], lunge["Audios"], lunge["CameraShake"] = presentation(by["rrb_a4"])
    for a in (shot, lunge):                              # she arrives and leaves in rose petals
        T = fv(a["TotalDuration"])
        a["AddEffects"] = [dict(fx_entry(port, "Role/Rrb/rrb_petals", 0.0, dx=0.0, dy=1.0, attached=False), KillMode=1)] + a["AddEffects"] + \
                          [dict(fx_entry(port, "Role/Rrb/rrb_petals", max(0.0, T - 0.08), dx=0.0, dy=1.0, attached=True), KillMode=1)]
    btree["_actions"] += [shot, lunge]
    port.note(BLOGIC, "Legacy presentation: Rifle Shot %d sounds, %d shakes; Rose Lunge %d effects, %d sounds, %d shakes (from Rifle Shot and 5AAAA, stage 1)" % (
        len(shot["Audios"]), len(shot["CameraShake"]), len(lunge["AddEffects"]), len(lunge["Audios"]), len(lunge["CameraShake"])))
    port.note(BLOGIC, "Legacy I Rifle Shot: phantom Ruby (assist A), round at %.2f s from (%.2f, %.2f); Legacy II Rose Lunge: "
                      "phantom Ruby (assist D), launching hit %.2f-%.2f s over 3.6 u" % (t, x, y, w["start"], w["end"]))


def legacy_rows():
    import ruby_ui
    icon = lambda sid: "".join(chr(x) for x in icon_bytes([(ruby_ui.HUD_ATLAS_PATH, "IconSkill_%d" % sid)]))
    out = {"SkillFromTeacher": [], "SkillAttr": [], "FesActorSkillLevelConf": [], "SkillDamage": []}
    for L in LEGACY:
        out["SkillFromTeacher"].append({"$copyRows": {"where": {"TeacherSkillId": L["donor"]}, "set": {
            "TeacherSkillId": L["id"], "Order": L["order"], "Icon": icon(L["id"]), "BulletId": BID,
            "BulletAction": "TS%d" % L["id"], "BuffList": []}}})
        for lvl, dmg in ((1, L["dmg"][0]), (9, L["dmg"][1])):
            out["SkillAttr"].append({"$append": True, "ActorId": ACTOR, "Order": L["order"], "SkillGroup": [9, 10], "Level": lvl,
                                     "Damage": dmg, "Value": [L["value"], L["value"]]})
        for lvl in range(1, 10):
            out["FesActorSkillLevelConf"].append({"$append": True, "SkillId": L["id"], "Level": lvl, "Score": 20 * lvl})
        out["SkillDamage"].append({"$append": True, "ActorId": BID, "Action": L["round"], "HitTimes": 1.0, "SkillGroupId": 9,
                                   "FluctMin": 1.0, "FluctMax": 1.0, "DamageRatio": [L["ratio"]], "DamageRatioPvp": [L["ratio"]],
                                   "AttrSkillGroupCondition": [9, 10], "AttrRoleId": ACTOR, "AttrDamageOrder": L["order"],
                                   "AttrDamageRate": 1.0, "NoArmoredFreezeAdd": 1})
    return out


# ---------------------------------------------------------------- 3. assembly
class Port(bp.Port):
    """bossport.Port with Ragna as both halves, plus template logics whose references are merged in assemble()."""
    def __init__(self, clips_json, lengths, moves):
        super().__init__(DONOR_LOGIC, clips_json, {}, {}, donor=DONOR_LOGIC)
        self.TPL_RAW = {lg: bp.logic(lg) for lg in TEMPLATE_LOGICS + ("nobullet",)}
        self.TPL = {lg: {a["Name"]: a for a in L["_actions"]} for lg, L in self.TPL_RAW.items()}
        self.LEN = {n[len(ROLE) + 1:]: v for n, v in lengths.items()}
        self.MOVES = moves

    def assemble(self, acts, name):
        used = set()
        def walk(o):
            if isinstance(o, dict):
                if "rid" in o and len(o) == 1: used.add(o["rid"])
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(acts)
        pool = {}
        for L in [self.R] + list(self.TPL_RAW.values()):
            for r in L["references"]["RefIds"]:
                if r["type"]["class"]: pool.setdefault(r["rid"], r)
        for r in self.refs.items: pool[r["rid"]] = r
        missing = used - set(pool) - {-2}
        if missing: raise SystemExit("unresolved reference ids: %s" % sorted(missing)[:5])
        tree = {k: copy.deepcopy(v) for k, v in self.R.items() if not k.startswith("m_") and k not in ("_actions", "references")}
        tree.update({"m_Name": name, "ALGType": 0, "AnimationJson": ROLE, "AnimationJsons": [ROLE], "_actions": acts,
                     "references": {"version": self.R["references"]["version"], "RefIds": [pool[r] for r in sorted(used) if r in pool]}})
        return tree


# ---------------------------------------------------------------- 3b. donor hooks she can never fire
# Her engine states are Ragna's, her moves are cleaned ICEY templates, her rounds are Noel's. Each still carried
# entries gated on its DONOR's Potentials (Ragna 5310 / 5322 / 5326 / 5327; ICEY 6505 and her shadow clone's buff; Noel
# 5502 / 5508 / 5509 / 5515 / 5522 / 5524 / 5530). Ruby can never hold another character's Potential, so they never
# ran; several named actions her trees don't have (attackUpAir, b7s, s4endS, and Noel's own bullet action dash_T_boom
# on Noel's bullet 10030101). They are removed, so the donors' behaviour cannot run beside hers (INTEGRATION_AUDIT
# D3; the lead: "her own library"). What stays: tests of triggers no character owns (the engine's generic ones, e.g.
# 11681 / 12661, boons, Tactics), and every INVERTED test of a donor Potential (always true for her: the donor's
# default behaviour, which is hers).
FOREIGN_GATE_BUFFS = ("shadow_player_5051",)   # on ICEY's shadow clone only (stock buff "艾希天赋分身"); her tree never has it
STRIPPED_TRIGGERS = set()                      # the donor trigger ids actually removed (write_mod checks none is hers)


def foreign_triggers():
    """Trigger ids that belong to ANOTHER character's Potentials. Stock BaseActorPotentialConf gives every character
    one block of 100 Potential ids (Ragna 53xx, Noel 55xx, ICEY 65xx, ...: 17 blocks, none shared, checked
    2026-10-02) and every Potential's trigger is Id x 10 + level, so a trigger id t is a character's when t // 1000 is
    that character's block. The whole block counts, not only the Potentials in the table: Noel's rounds also test
    55091, a trigger of her block that no Potential grants. Read from the pristine table when the loader kept one."""
    p = os.path.join(ROOT, "decoded", "tables", "BaseActorPotentialConf.json")
    d = bp.load(p + ".orig" if os.path.exists(p + ".orig") else p)
    out = set()
    for r in d if isinstance(d, list) else next(v for v in d.values() if isinstance(v, list)):
        if r.get("Id") and r.get("ActorId") != ACTOR:
            b = r["Id"] // 100
            out.update(range(b * 1000, b * 1000 + 1000))
    # never one she can hold: her own cards' triggers, her talent's, and the stock ones her cards add (triple jump)
    hers = set(range(TALENT_EFFECT, TALENT_EFFECT + 5))
    for pid in rrb_pots.POT.values():
        hers.update(range(pid * 10 + 1, pid * 10 + 6))
    for v in rrb_pots.STOCK_TRIG.values():
        for m in re.finditer(r"Id:(\d+)", " ".join(str(x) for x in v)):
            hers.update(range(int(m.group(1)), int(m.group(1)) + 5))
    return out - hers


def strip_foreign_hooks(port, T, foreign):
    """Remove from tree T every list entry that cannot apply to her:
      - its condition group can never pass: with Combine 0 (all true) one condition that never holds is enough, with
        Combine 1 (any true) all of them; a condition never holds when it is a plain (not inverted) test of a donor
        Potential's trigger, or of a buff in FOREIGN_GATE_BUFFS;
      - a ChangeAction call whose own `trigger:` parameter is a donor Potential (the call tests it itself: Noel's
        rounds switch to b7s / s4endS with her Potentials 5524 / 5509).
    References no action uses afterwards are dropped. Returns {top-level field: entries removed}."""
    R = {r["rid"]: r for r in port.refs.items}
    R.update({r["rid"]: r for r in T["references"]["RefIds"]})
    removed = {}
    trig_param = re.compile(r"\btrigger\s*:\s*(\d+)")
    def never(c):
        d = (R.get(c.get("rid")) or {}).get("data") or {}
        if d.get("Invert"): return False
        if "TriggerIdMin" in d:
            ids = range(d["TriggerIdMin"], d["TriggerIdMax"] + 1)
            if ids and all(i in foreign for i in ids): STRIPPED_TRIGGERS.update(ids); return True
            return False
        return d.get("BuffId") in FOREIGN_GATE_BUFFS
    def dead(e):
        cg = e.get("ConditionGroup")
        if isinstance(cg, dict) and cg.get("Conditions"):
            cs = [never(c) for c in cg["Conditions"]]
            if all(cs) if cg.get("Combine") else any(cs): return True
        call = e.get("Call")
        if isinstance(call, dict) and call.get("Function") == "ChangeAction":
            m = trig_param.search(call.get("Params") or "")
            if m and int(m.group(1)) in foreign: STRIPPED_TRIGGERS.add(int(m.group(1))); return True
        return False
    def walk(o, field):
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if isinstance(v, list):
                    keep = [x for x in v if not (isinstance(x, dict) and dead(x))]
                    if len(keep) != len(v):
                        removed[field or k] = removed.get(field or k, 0) + len(v) - len(keep); o[k] = keep
                    for x in keep: walk(x, field or k)
                else:
                    walk(v, field or k)
        elif isinstance(o, list):
            for x in o: walk(x, field)
    for a in T["_actions"]:
        walk(a, None)
    used = set(int(x) for x in re.findall(r'\{"rid": (-?\d+)\}', json.dumps(T["_actions"])))
    n0 = len(T["references"]["RefIds"])
    T["references"]["RefIds"] = [r for r in T["references"]["RefIds"] if r["rid"] in used]
    port.note(T["m_Name"], "donor hooks removed (entries gated on another character's Potential): %s; references %d -> %d"
              % (dict(sorted(removed.items())) or "none", n0, len(T["references"]["RefIds"])))
    return removed


def build_logic():
    cj, lengths, moves_, clips = source()
    port = Port(cj, lengths, moves_)
    port.SEQS = clips              # her clip frame sequences (scythe trails; bossport keeps its own CLIPS)
    by = {}
    for rn, spec in LOCO.items():
        clip, fit = (spec if isinstance(spec, tuple) else (spec, None))
        dur = fv(port.RA[rn]["TotalDuration"]) if fit == "fit" else None
        by[rn] = port.transplant(rn, "%s_%s" % (ROLE, clip), None, dur)
        if rn in PLAY_WHOLE:
            by[rn]["TotalDuration"] = fp(max(port.LEN[clip] / 60.0, fv(by[rn]["AnimateDuration"])))
    for rn in ("addHP", "addHPAir", "summon", "teacherskill", "teacherskillAir"):   # keep the donor's heal / cast calls
        by[rn]["ScriptCalls"] = copy.deepcopy(port.RA[rn].get("ScriptCalls") or [])
        by[rn]["AddBuff"] = [b for b in copy.deepcopy(port.RA[rn].get("AddBuff") or []) if not DROP_BUFF.search(b["Buff"]["Idx"])]
    for rn in ("born", "pvp_born", "reborn"):   # entrances play in place
        by[rn]["AddMotions"] = []; by[rn]["SpeedChanges"] = []
    moves(port, by)
    dust(port, by)
    fxplan = wire_effects(port, by)                  # V2: every effect bound, at its tick and point (rrb_fx.py)
    # 0.9.0 (a tester, 2026-10-07: the upward dash "uses an inappropriate visual effect (shot + smoke) while used in
    # air"): the air versions are the ground blast's action; the dust it kicks off the floor is not theirs
    for n in [x for x in by if x.startswith("rrb_blast_air_up")]:
        by[n]["AddEffects"] = [e for e in by[n].get("AddEffects") or [] if e["NameEx"]["ConstValue"].split("/")[-1] not in ("rrb_ground_hit", "rrb_skid")]
    for n in ALL_BLASTS:   # (before the Potentials pass: its copies of the blasts inherit it)
        a = by[n]
        e = bp.buff(rrb_pots.BLASTING, 0.0, max(0.1, fv(a["TotalDuration"]) - 0.05)); e["Buff"]["Stack"] = rrb_pots.GATE_STACK
        a.setdefault("AddBuff", []).append(e)
    # 0.9.0 (a tester, 2026-10-07: on the floor "there needs to be a slight delay before the dash charges reset after
    # the last one is used, effectively equal to the full duration of the dash animation"): a blast's recovery keeps
    # a new chain shut too. A blast cancelled into another move never plays its recovery, so nothing is slower there
    for n in ("dashend", BACK_END):
        e = bp.buff(rrb_pots.BLASTING, 0.0, max(0.1, fv(by[n]["TotalDuration"]) - 0.05)); e["Buff"]["Stack"] = rrb_pots.GATE_STACK
        by[n].setdefault("AddBuff", []).append(e)
    rrb_pots.recoil_shot(sys.modules[__name__], port, by)    # the air Skill, from the wired air backward gun-dash
    rrb_pots.rifle_refire(sys.modules[__name__], port, by)   # 0.9.0: Rifle Shot again from the aiming pose
    potentials(port, by)
    rrb_pots.buzzsaw_090(sys.modules[__name__], port, by)    # 0.9.0: earlier cuts, a start that is not knocked out, Jump on a hit
    # the air string once per airtime (stock rule, Ragna's idiom): its first hit puts itself on a 5 s cooldown; the
    # engine states copied from Ragna reset "attackAir" on landing / jump / dash -> they now reset hers; her row prechecks it
    by["rrb_ja"]["CDList"] = [{"Time": fp(0), "ID": "rrb_ja", "Duration": fp(5.0)}]
    for a in by.values():
        for cd in a.get("CDList") or []:
            if cd.get("ID") == "attackAir": cd["ID"] = "rrb_ja"
        extra = []
        for cd in a.get("CDList") or []:
            if cd.get("ID") == "dashAir" and fv(cd["Duration"]) == 0 and a["Name"] not in ALL_BLASTS:
                extra += [dict(copy.deepcopy(cd), ID=b) for b in AIR_STARTERS + ("rrb_launcher_air",) if b != "dashAir"]   # V2: + air Rising Reap
        if extra: a["CDList"] = (a.get("CDList") or []) + extra
        if a["Name"] in ALL_BLASTS and "Air" in a["Name"] or a["Name"] in ("rrb_blast_air_up", "rrb_blast_down", "rrb_blast_air_up_c", "rrb_blast_down_c"):
            # every air blast resets the air attack limit (KIT_V2 §4, C11): j.string -> blast -> j.string
            if not any(cd.get("ID") == "rrb_ja" for cd in a.get("CDList") or []):
                a.setdefault("CDList", []).append({"Time": fp(0), "ID": "rrb_ja", "Duration": fp(0)})
        for sc in a.get("ScriptCalls") or []:   # Ragna's dashes reset "attackAir"; hers is rrb_ja
            if sc["Call"]["Function"] == "SetActionCD" and 'action: "attackAir"' in sc["Call"]["Params"]:
                sc["Call"]["Params"] = sc["Call"]["Params"].replace('"attackAir"', '"rrb_ja"')
    port.note("rrb_ja", "air string once per airtime: 5 s self-cooldown, reset by landing / jump / dash states")
    # 0.9.0: what is left of a Gun Blast chain keeps for CHAIN_KEEP s (blast_rows), so that a late press in the air
    # still fires; the states that give the air blasts back (they clear `dashAir`'s cooldown: stand, run, the landings,
    # the jump from the floor) also set the chain itself back, the stock call (Ragna's air dashes and air jumps reset
    # the air attack chain the same way: SkillChainReset chain: 4)
    back = [a["Name"] for a in by.values() if a["Name"] not in ALL_BLASTS and
            any(cd.get("ID") == "dashAir" and fv(cd["Duration"]) == 0 for cd in a.get("CDList") or [])]
    for n in back:
        by[n].setdefault("ScriptCalls", []).append(bp.call(0.0, "SkillChainReset", "chain: 5, cd: 0", start_type=3, nt=1))
    port.note("dash", "0.9.0: the blast chain is set back by %s" % ", ".join(sorted(back)))
    # Gun Blast v3: a blast never cools another blast down (the donor's dash CDs, e.g. dashAir -> dashAir3 5 s, would
    # block a chain's third step); only the air starters' shared once-per-airtime lock stays
    for n in ALL_BLASTS:
        a = by[n]
        a["CDList"] = [cd for cd in a.get("CDList") or [] if cd.get("ID") not in ALL_BLASTS or
                       (n in LOCKERS and cd.get("ID") in AIR_STARTERS)]
    # nor does anything else cool a chain step down: Ragna's stand, run, jump and every landing put dashAir2 on a 10 s
    # cooldown (his Triple Dash gate), so her second neutral air blast never came out (0.6.5 game test, 2026-09-30).
    # Chain steps are gated by their rows' PreSkillOrder only; the air starters' once-per-airtime lock is kept
    step = re.compile(r"^(dash|dashAir)[23](_4)?$|^rrb_blast_\w+_c(_4)?$")
    n_cd = 0
    for a in by.values():
        keep = [cd for cd in a.get("CDList") or [] if not (step.match(cd.get("ID") or "") and fv(cd["Duration"]) > 0)]
        n_cd += len(a.get("CDList") or []) - len(keep)
        if a.get("CDList"): a["CDList"] = keep
    port.note("dashAir2", "donor cooldowns on Gun Blast chain steps removed: %d" % n_cd)
    for rn in list(by):   # every action (Test 5: the directional blasts, deep-copied from dash, kept Ragna's switches)
        port.fix_player_state(by[rn], by, REMAP)
    # Gun Blast -> Attack = Corkscrew Slice from the first frames of the travel: the switch REMAP just named (ICEY's dash
    # attack, "rush") answered from 0.1 s on the ground / 0.05 s in the air; blast_rows keeps 5A / j.A shut meanwhile
    not_up, not_dn = port.refs.inputdir(up=1, invert=1), port.refs.inputdir(down=1, invert=1)
    for a in by.values():
        for x in a.get("ActionSwitchs") or []:
            if (x.get("NewActionEx") or {}).get("ConstValue") != "rrb_corkscrew": continue
            if abs(fv(x["TimeCheck"]["End"]) - 0.4) < 1e-3 and fv(x["TimeCheck"]["Start"]) > 0.04:
                x["TimeCheck"]["Start"] = fp(0.03)
            # neutral / forward only: Up + A and Down + A go to Rising Reap / Low Sweep (the rows above)
            x.setdefault("ConditionGroup", {"Combine": 0, "Conditions": []})["Conditions"] += [not_up, not_dn]
    for a in by.values():   # no donor voices or sounds left anywhere
        a["Audios"] = [x for x in a.get("Audios") or [] if not re.search(r"(^|_)rg(_|$)|^vo_|^sfx_rg|^HB_|^no_voice|_voice_", x.get("Cue") or "")]
        # nor the templates' character effects (Noel's gun flashes sit at Noel's hands): her own muzzle / smoke replace them
        a["AddEffects"] = [e for e in a.get("AddEffects") or [] if not e["NameEx"]["ConstValue"].startswith("Role/No/")]
        a["RemoveEffect"] = [e for e in a.get("RemoveEffect") or [] if not (e.get("Name") or "").startswith("Role/No/")]
        # nor the templates' character buffs on her (tools/bbtag/audit_ruby_foreign.py): Ragna's rush put 1103_cur
        # ("current-HP damage, Ragna only") on Corkscrew, so every Corkscrew cost her HP
        keep = [x for x in a.get("AddBuff") or [] if (x.get("Buff") or {}).get("Idx") not in FOREIGN_BUFFS]
        if len(keep) != len(a.get("AddBuff") or []):
            port.note(a["Name"], "donor buffs removed: %s" % sorted({(x.get("Buff") or {}).get("Idx") for x in a["AddBuff"]} & set(FOREIGN_BUFFS)))
            a["AddBuff"] = keep
    import rrb_sound   # her BBTAG sounds and English voice on BBTAG's ticks (KIT_V2 §8; after the donor-voice filter)
    snd = {n: (v[2], 0.0, None) for n, v in KIT.items()}; snd.update(FX_ACTIONS)
    # the EX finish is a copy of the finish (rrb_pots): its sounds are the finish's, not Clash's opening shot, which the
    # variant rule gave it (rrb_clash_exfinish read as a variant of rrb_clash)
    if "rrb_clash_finish" in snd and "rrb_clash_exfinish" not in snd: snd["rrb_clash_exfinish"] = snd["rrb_clash_finish"]
    # 0.9.0: the Recoil Shot plays the air backward gun-dash's frames, so its gunshot and boom are that state's
    if "rrb_recoilshot" in by: snd["rrb_recoilshot"] = FX_ACTIONS["rrb_blast_air_back"]
    # 0.9.0: the re-fire starts REFIRE["off"] into BBTAG's Shot: its cues from there, moved up (its card and stage
    # versions follow it by name)
    if "rrb_rifleshot_r" in by: snd["rrb_rifleshot_r"] = (FX_ACTIONS["rrb_rifleshot"][0], rrb_pots.REFIRE["off"], None)
    # 0.9.0: Sy-Pod fires once; BBTAG's state has a second round, whose gunshot, casing and line must not come back
    import rrb_power as _sy
    if _sy.SY_T.get("snd_end"): snd["rrb_sypod"] = (FX_ACTIONS["rrb_sypod"][0], 0.0, _sy.SY_T["snd_end"])
    rrb_sound.wire(port, by, snd, sfx, log=lambda m: port.note(LOGIC, m))
    import rrb_power
    rrb_power.after_sound(sys.modules[__name__], port, by, rrb_sound.GUNSHOT)   # one gunshot per round of the stage 3 guns
    weight_pass(port, list(by.values()))
    rrb_power.after_weight_moves(sys.modules[__name__], port, by)   # Buzzsaw EX's rumble and drag (over the class's)
    rrb_power.buzz_rings(sys.modules[__name__], port, by, rrb_pots, fxplan)   # 0.9.0: a red ring on every turn of the spin
    # 0.9.0: with 20705 a Rising Reap that hits lifts her with the enemy (after the pass above: it makes the rise, rrb_a4_rise)
    rrb_pots.reap_rise(sys.modules[__name__], port, by)
    rrb_power.stag_scan(sys.modules[__name__], port, by)            # 0.9.0: her gun moves mark the enemies (stagger_rule)
    audit_refs(list(by.values()), LOGIC)
    import rrb_fx
    rrb_fx.dust_variants(port, list(by.values()), log=lambda m: port.note(LOGIC, m))   # gunfire in her Dust colour
    dedupe_effects(list(by.values()))          # before assembling: the tree is built from these actions
    rrb_fx.mirror_detached(port, list(by.values()), log=lambda m: port.note(LOGIC, m))   # 0.9.0: flashes fired facing left
    acts = list(by.values())
    tree = port.assemble(acts, LOGIC)
    btree = bullet_tree(port)
    legacy(port, by, btree)
    effects(port, by, btree)
    import rrb_fx
    rrb_fx.round_effects(port, btree, fx_entry)                     # rrb_round rides each round; the gun burst where it ends
    rrb_pots.bullets_v2(sys.modules[__name__], port, by, btree)     # V2 projectiles (petal zones, Dust, High Caliber...)
    rrb_fx.gun_v2(port, btree, fx_entry, log=lambda m: port.note(BLOGIC, m))   # the rebuilt rounds (fxkit_cross, 0.6.13)
    rrb_fx.dust_variants(port, btree["_actions"], root_caster=True, log=lambda m: port.note(BLOGIC, m))
    weight_pass(port, btree["_actions"])
    import rrb_power
    rrb_power.after_weight(sys.modules[__name__], port, btree)      # the stage 3 rounds' bigger impacts
    floor_reach(port, by, btree)                                    # her rounds and zones hit enemies on the floor
    rrb_power.round_rules(sys.modules[__name__], port, by, btree)   # every round of a chain connects (per-target hold, no DistAdapt)
    rrb_pots.gravity_rounds(sys.modules[__name__], port, btree)     # 0.8.0: with Gravity Dust her rounds open a gravity well
    rrb_power.stagger_rule(sys.modules[__name__], port, btree)      # 0.9.0: a rifle round staggers an enemy once in RIFLE_STAGGER s
    rrb_power.wave_boxes(sys.modules[__name__], port, by, btree, log=lambda m: port.note(BLOGIC, m))   # the slash projectiles
    json.dump(rrb_fx.WAVE2, open(os.path.join(HERE, "gen", "wave2.json"), "w"), indent=1)             # (review sheets read it)
    audit_refs(btree["_actions"], BLOGIC)
    json.dump(fxplan, open(os.path.join(HERE, "gen", "fxplan.json"), "w"), indent=1)   # read by import_ruby -> fxcompile_ruby
    # her rounds' glow ends when the round breaks (OnActionChange): with KillMode 0 it waited for the actor's destroy,
    # and a round that stopped at a wall kept glowing there (0.6.2 game test, 2026-09-30). Every flight action with it,
    # including the copies made from the base rounds (card, stage 3 and Dust rounds)
    for a in btree["_actions"]:
        for e in a.get("AddEffects") or []:
            leaf = e["NameEx"]["ConstValue"].split("/")[-1]
            if leaf.startswith("rrb_round") and not leaf.startswith("rrb_round_end"): e["KillMode"] = 2
    dedupe_effects(btree["_actions"])
    rrb_fx.finish_refs(port, btree)
    foreign = foreign_triggers()                     # last: every copy and variant made above is covered
    for T in (tree, btree):
        strip_foreign_hooks(port, T, foreign)
    os.makedirs(os.path.join(HERE, "gen"), exist_ok=True)
    io.open(os.path.join(HERE, "gen", "%s_tree.json" % LOGIC), "w", encoding="utf-8", newline="\n").write(json.dumps(tree, ensure_ascii=False))
    io.open(os.path.join(HERE, "gen", "%s_tree.json" % BLOGIC), "w", encoding="utf-8", newline="\n").write(json.dumps(btree, ensure_ascii=False))
    json.dump(RETIMED, open(os.path.join(HERE, "gen", "retimed.json"), "w"), indent=1)   # for tools/bbtag/check_clips.py
    port.report(os.path.join(HERE, "gen", "report.txt"), "%s: %d actions, %d references" % (LOGIC, len(acts), len(tree["references"]["RefIds"])))
    print("%s: %d actions, %d references; %s: %d actions" % (LOGIC, len(acts), len(tree["references"]["RefIds"]), BLOGIC, len(btree["_actions"])))
    return port, by, btree


# ---------------------------------------------------------------- 4. Potentials (stock layout; hidden effects = variant swaps, gated rows, buffs)
POT = rrb_pots.POT                     # key -> Potential id: the 38 cards (rrb_pots.CARDS; Unleashed: rrb_pots.UNLEASHED)
TALENT, TALENT_EFFECT = 5098, 50981
MARK = "rrb_break"          # her stagger marker (Breaking Clash); Red Reaper looks for it
STUN = "2100"               # stock stun (docs/cross-effect/research/STAGGER.md)
INV_BUFF = "2206_replace2"  # stock: invincible until the action changes (NOTES 2026-09-27)


def split_hits(a, n):
    """Each hit window becomes n consecutive hits."""
    out = []
    for h in a["HitDataList"]:
        t0, t1 = fv(h["TickRange"]["Start"]), fv(h["TickRange"]["End"]); d = (t1 - t0) / n
        for i in range(n):
            x = copy.deepcopy(h); x["TickRange"]["Start"] = fp(t0 + i * d); x["TickRange"]["End"] = fp(t0 + (i + 1) * d); out.append(x)
    a["HitDataList"] = out


FOREIGN_BUFFS = ("1103_cur",)     # character-only buffs the stock templates carry (audit_ruby_foreign.py)


def potentials(port, by):
    rrb_pots.potentials_v2(sys.modules[__name__], port, by)


# ---------------------------------------------------------------- 5. input rows, damage rows
def xrow(g, o, act, inp=None, d=None, air=False, strict=0.3, all_=0.3, jump=0.2, own=None, mps=None, long=None, req=None,
         pre=None, start=True, exit_=False, timeout=None, addcd=None, precheck=False, sat=None, dash=0.01):
    r = {"$new": True, "ActorId": ACTOR, "Group": g, "Order": o, "Action": act, "AllowActiveState": True, "AutoTurn": 1,
         "ActionpointInputTag": g, "ActionpointInputTag2": 1, "Preinputtime": 0.2, "ActdurStrict": round(strict, 2)}
    if air in (True, "both"): r["AllowFlying"] = True
    if air in (False, "both"): r["AllowGround"] = True
    if inp: r["Input"] = inp
    if d: r["InputDir"] = d
    if pre: r["PreSkillOrder"] = pre
    if start: r["StartTrigger"] = ["Start_%d" % g]
    if exit_: r["ExitTrigger"] = ["End_%d" % g]
    if long: r["UseLongPress"] = True; r["LongPressStart"], r["LongPressEnd"] = long
    if sat: r["SatisfyInputkey"] = sat
    if mps: r["Mps"] = mps
    if req: r["ReqTriggerId"] = req
    if precheck: r["PrecheckActionCd"] = 1
    ml = {"all": round(all_, 2), "5": dash}
    if jump is not None: ml["7"] = round(jump, 2)
    for k, v in (own or {}).items(): ml[str(k)] = round(v, 2)
    r["Mutelist"] = ",".join('"%s":%s' % kv for kv in ml.items())
    r["Timeout"] = round(timeout if timeout is not None else strict + 0.6, 2)
    if addcd is not None: r["TimeoutAddcd"] = addcd
    return r


def last_hit(a):
    return max([fv(h["TickRange"]["End"]) for h in a.get("HitDataList") or []] + [0.0])


def first_hit(a):
    return min([fv(h["TickRange"]["Start"]) for h in a.get("HitDataList") or []] or [0.0])


def skill_blast(by, act):
    """When a Skill can be blast-cancelled: after its (last) shot or its last strike's start (KIT_V2 §4)."""
    a = by[act]
    # her rounds only (V2: Potential spawns, e.g. the gravity well or petal zones, are not the Skill's shot)
    shots = [fv(r["TimeConfig"]["Start"]) for r in a.get("AddRoles") or [] if r.get("RoleId", {}).get("ConstValue") == BID
             and str((r.get("StartActionEx") or [{}])[0].get("ConstValue", "")) in ("b7", "s4", "b7_hc", "s4_hc")]
    if shots: return round(max(shots) + 0.05, 2)
    starts = [fv(h["TickRange"]["Start"]) for h in a.get("HitDataList") or []]
    return round(max(starts) if len(starts) > 1 and act != "rrb_buzzsaw" else (min(starts) if starts else 0.01), 2)


def travel_end(a):
    """when a blast's travel is over (its last motion's end): Attack, Skills and Jump are free from there (KIT_V2 §4)"""
    ends = [fv(m["Time"]) + fv(m["Motion"]["DurationEx"]["ConstValue"]) for m in a.get("AddMotions") or []]
    for sc in a.get("ScriptCalls") or []:
        if sc["Call"]["Function"] == "AddMotion":
            d = re.search(r"Duration: *([0-9.]+)", sc["Call"]["Params"])
            ends.append(fv(sc["TimeConfig"]["Start"]) + (float(d.group(1)) if d else 0.1))
    return round(max(ends) if ends else fv(a["TotalDuration"]) * 0.7, 2)




def blast_rows(by):
    """Gun Blast's input table (group 5). 0.9.0 (the lead, 2026-10-07: "lets give ruby 1 dash"; a tester the same day:
    three dashes "should be a 'Potential' upgrade, not a base ability"):
      step 1  one blast. Directional rows first (the first matching row wins; a row with no direction matches every
              direction): air Down (the dive; it was Forward until 0.8), ground Up, ground Down (the backward
              gun-dash, BBTAG 214A), air Up, then Dash (ground, air). Up / Down blasts keep her facing (no auto-turn);
              a plain Dash turns to the held side, as the stock dash. Air first blasts lock each other until she
              lands (their cooldowns).
      step 2  every blast's chain version (no wind-up), from any first blast: with card 20722 (the chain card, as the
              stock "Can dash 3 times"), or with Gravity Dust loaded
      step 3  the same from step 2, with the card
      step 4  with the card and Gravity Dust
    Each row comes twice: a twin for the hidden effect of 20722 + 20721 first (the next blast as soon as the travel is
    over), then the plain row (BLAST_PAUSE later). Until 0.8 the next blast could start on the shot, 0.07 s before the
    travel ended: a chain covered less ground than its blasts and "looked like awkward hopping" (a tester).
    What is left of a chain stays usable for CHAIN_KEEP s, so a late press in the air still fires (until 0.8 the
    window was 0.6 s: "the dash limit should ... reset upon touching the ground, rather than based on a timer");
    landing and standing set the chain back (SkillChainReset on the states that clear the air locks: build_logic).
    Attack, Skills, Jump and the SP moves are muted until the blast's travel is over."""
    CARD, INV = rrb_pots.POT["blast_chain"], rrb_pots.POT["blast_inv"]
    GRAV = 'buff: "rrb_x_grav", buff_stack: 1'                 # rrb_pots.BLOCKERS: passes while Gravity Dust is loaded
    first = [(0, "rrb_blast_down", 2, True), (2, "rrb_blast_up", 1, False), (3, "rrb_blast_back", 2, False),
             (4, "rrb_blast_air_up", 1, True), (5, "dash", None, False), (6, "dashAir", None, True)]
    chain = lambda g, a: [(0, "rrb_blast_down_c", 2, True), (2, "rrb_blast_up_c", 1, False), (3, "rrb_blast_back_c", 2, False),
                          (4, "rrb_blast_air_up_c", 1, True), (5, g, None, False), (6, a, None, True)]
    both = lambda base: list(range(base, base + 7)) + list(range(base + 100, base + 107))   # a step's twin and plain rows
    # (base order, its blasts, the step before, the cards it needs, whether it needs Gravity Dust)
    steps = [(50, first, None, [], False), (60, chain("dash2", "dashAir2"), both(50), [CARD], False),
             (70, chain("dash3", "dashAir3"), both(60), [CARD], False), (80, chain("dash3", "dashAir3"), both(70), [CARD], True)]
    rows = []
    for base, acts, pre, req, grav in steps:
        for off, act, d, air in acts:
            if base == 80 and act + "_4" in by: act = act + "_4"   # hidden 21: the fourth blast is its own action
            a = by[act]
            shot = 0.0 if base > 50 else SHOT_T             # a chained blast fires on its first frame
            end = max(round(shot + 0.05, 2), travel_end(a))  # the travel is over: everything else is free from here
            for fast in (True, False):
                nxt = end if fast else round(end + BLAST_PAUSE, 2)
                # (0.8.0: every blast fires the dash-start event, Start_5, as each of the stock dashes does)
                r = xrow(5, base + off + (0 if fast else 100), act, "Dash", d, air=air, strict=nxt, all_=end, jump=end, pre=pre, start=True,
                         timeout=CHAIN_KEEP, dash=nxt, req=sorted(set(req + ([CARD, INV] if fast else []))) or None,
                         precheck=(act in AIR_STARTERS))
                r["AutoTurn"] = 1 if act.startswith("dash") else 0
                if base == 50:   # a new chain never cancels a blast (0.5.0 trace: one press ran 3 blasts in 0.1 s)
                    r["PreScriptCall"] = "CheckBuffStack"; r["PreScriptCallParams"] = 'buff: "%s", buff_stack: 1' % rrb_pots.BLASTING
                if grav:
                    r["PreScriptCall"] = "CheckBuffStack"; r["PreScriptCallParams"] = GRAV
                rows.append(r)
            if base == 60:   # Gravity Dust (KIT_V2 section 5): one more blast without the card while rrb_dust4 is loaded
                g = copy.deepcopy(rows[-1]); g.pop("ReqTriggerId", None); g["Order"] = base + off + 200
                g["PreScriptCall"] = "CheckBuffStack"; g["PreScriptCallParams"] = GRAV
                rows.append(g)
    return rows


def input_rows(port, by):
    MP = lambda cost: [{"Slot": 2, "Limit": str(cost), "MpChange": -float(cost)}]
    SP = lambda n: [{"Slot": 3, "Limit": str(n), "MpChange": -float(n)}]
    L = lambda n: fv(by[n]["TotalDuration"])
    cad = lambda n, lo: round(max(lo, last_hit(by[n]) + 0.08), 2)   # next step: after its last hit, never before `lo`
    # when the NEXT string step may start (the row's "all" mute): after this step's last strike (Test 2: the 3rd step's
    # three strikes run to 0.43 s but the finisher could start at 0.30, so mashing cut the flurry and snapped the pose)
    nxt = lambda n, lo: round(max(lo, last_hit(by[n]) + 0.03), 2)
    # Gun Blast cancels a move from its first damaging frame, hit or miss (KIT_V2 §4; was from 0.01 s, which let a
    # blast skip every swing); Skills after their shot / last strike
    blast = lambda n: round(first_hit(by[n]) or 0.01, 2)
    R_ = rrb_pots.rows_v2(sys.modules[__name__], port, by)
    R_old = [   # (0.x's rows, replaced by rrb_pots.rows_v2; kept until the switchover for reference, not written)
        # Attack (ground): Up / Down first (also out of the first three string steps), then the string
        xrow(1, 1, "rrb_launcher", "Attack", 1, strict=cad("rrb_launcher", 0.45), all_=0.3, jump=0.3, own={1: 0.5}, timeout=0, addcd=0.5, dash=blast("rrb_launcher")),
        xrow(1, 2, "rrb_sweep", "Attack", 2, strict=cad("rrb_sweep", 0.4), all_=0.3, jump=0.25, own={1: 0.45}, timeout=0, addcd=0.45, dash=blast("rrb_sweep")),
        xrow(1, 3, "rrb_launcher", "Attack", 1, pre=[8, 9, 10], start=False, exit_=True, strict=cad("rrb_launcher", 0.45), all_=0.3, jump=0.3, own={1: 0.5}, timeout=0, addcd=0.5, dash=blast("rrb_launcher")),
        xrow(1, 4, "rrb_sweep", "Attack", 2, pre=[8, 9, 10], start=False, exit_=True, strict=cad("rrb_sweep", 0.4), all_=0.3, jump=0.25, own={1: 0.45}, timeout=0, addcd=0.45, dash=blast("rrb_sweep")),
        # the string's cadence (V2_PLAN §4): 5AA from 0.25 s, 5AAA from 0.36 s, 5AAAA from 0.46 s (after its 3 strikes)
        xrow(1, 8, "rrb_a1", "Attack", strict=cad("rrb_a1", 0.25), all_=nxt("rrb_a1", 0.22), jump=0.2, own={8: 0.3}, timeout=round(L("rrb_a1") + 0.35, 2), dash=blast("rrb_a1")),
        xrow(1, 9, "rrb_a2", "Attack", pre=[8], start=False, strict=cad("rrb_a2", 0.36), all_=nxt("rrb_a2", 0.25), jump=0.2, own={8: 0.3}, timeout=round(L("rrb_a2") + 0.35, 2), dash=blast("rrb_a2")),
        xrow(1, 10, "rrb_a3", "Attack", pre=[9], start=False, strict=nxt("rrb_a3", 0.4), all_=nxt("rrb_a3", 0.3), jump=0.25, own={8: 0.3}, timeout=round(L("rrb_a3") + 0.35, 2), dash=blast("rrb_a3")),
        xrow(1, 11, "rrb_a4", "Attack", pre=[10], start=False, exit_=True, strict=round(L("rrb_a4"), 2), all_=0.35, jump=0.3, timeout=0, addcd=0.7, dash=blast("rrb_a4")),
        # Attack (air): Down = the double kick; the string j.A -> j.B -> j.C
        xrow(4, 1, "rrb_j2a", "Attack", 2, air=True, strict=cad("rrb_j2a", 0.35), all_=0.3, jump=0.25, dash=blast("rrb_j2a")),
        xrow(4, 10, "rrb_ja", "Attack", air=True, strict=cad("rrb_ja", 0.3), all_=nxt("rrb_ja", 0.25), jump=0.2, timeout=round(L("rrb_ja") + 0.35, 2), precheck=True, dash=blast("rrb_ja")),
        xrow(4, 11, "rrb_jb", "Attack", air=True, pre=[10], start=False, strict=cad("rrb_jb", 0.36), all_=nxt("rrb_jb", 0.25), jump=0.2, timeout=round(L("rrb_jb") + 0.35, 2), dash=blast("rrb_jb")),
        xrow(4, 12, "rrb_jc", "Attack", air=True, pre=[11], start=False, exit_=True, strict=round(L("rrb_jc"), 2), all_=0.35, jump=0.3, timeout=0, addcd=0.5, dash=blast("rrb_jc")),
        # hold Attack: Clash Assault (one per hold: its own group stays muted past the hold window); nothing cuts the
        # leap before its strike (0.417 s)
        xrow(8, 1, "rrb_clash", "Attack", 5, air=False, strict=0.36, all_=0.3, jump=0.3, own={8: 1.2}, long=(0.3, 0.7), timeout=1.2, dash=blast("rrb_clash")),
    ]
    # (Skills and the SP moves: rrb_pots.rows_v2)
    sk = []
    o = 1
    for act, d, air in sk:
        cost = SKILL_MP[act]; variants = []
        if act == "rrb_rifleshot":
            variants += [([POT["quick_draw"], POT["crescent_mastery"]], 15), ([POT["quick_draw"]], 25)]
        variants.append(([POT["crescent_mastery"]], cost - 10))
        for req, c_ in variants + [(None, cost)]:
            R_.append(xrow(2, o, act, "Skill", d, air=air, strict=cad(act, 0.5), all_=0.35, jump=0.3, own={2: 0.5, 11: 0.2}, mps=MP(c_),
                           req=req, sat=[2], timeout=round(L(act) + 0.3, 2), dash=skill_blast(by, act)))
            o += 1
    # Summon = Dust (KIT_V2 §5): the direction picks the element (directional rows first, neutral last). Each has two
    # rows: with the Summon gauge full it also fires her equipped Summon Tactic (the stock SummonSkill pre-call and gauge
    # check), else it only loads the Dust; 25 SP either way; cancellable from 0.30 s
    o = 1
    for key in ("ice", "bolt", "fire"):          # Gravity: Summon held (dust())
        act = "rrb_dust_" + key
        for tactic in (True, False):
            mps = ([{"Slot": 11, "Limit": "100"}] if tactic else []) + SP(DUST_SP)
            r = xrow(11, o, act, "Summon", DUST_DIR[key], air="both", strict=DUST_FREE, all_=DUST_FREE, jump=DUST_FREE, dash=DUST_FREE,
                     mps=mps, sat=[11], timeout=round(L(act) + 0.3, 2))
            if tactic: r["PreScriptCall"] = "SummonSkill"
            r["Preinputtime"] = 0.4
            R_.append(r); o += 1
    # the SP moves on the Ultra input (Summon now loads Dust): Petal Burst, and Petal Dance with Down. KIT_V2 asked
    # for Skill + Summon, which the engine has no input for (stock inputs: Attack, Skill, Dash, Summon, Jump, Ultra):
    # a proposal, flagged in V2_COVERAGE (F), awaiting the lead and a game check
    # (the SP moves and the Ultra slot: rrb_pots.rows_v2)
    # Gun Blast v3 (its own table: blast_rows), then the donor's jump / summon rows and its dash recovery rows
    R_ += blast_rows(by)
    # Gun Blast -> Attack (the 0.6.4 / 0.6.5 game tests, 2026-09-30; decided under the lead's delegation):
    #   neutral A = Corkscrew Slice through the whole blast: the ground 5A rows are gated off while the blast's gate buff
    #   (rrb_blasting) is on, so its Corkscrew switch gets the press (a row beats a switch: in 0.6.4 a press after 0.25 s
    #   started 5A). 0.6.5 shut the whole Attack group instead, and then Up + A also came out as Corkscrew;
    #   Up + A / Down + A = Rising Reap / Low Sweep (or their card versions): their rows open at 0.25 s as before, and
    #   the Corkscrew switches ignore a press with Up or Down held (build_ruby, after fix_player_state)
    for r in R_:
        if r.get("Group") == 1 and r.get("Action") == "rrb_a1" and not r.get("PreScriptCall"):
            r["PreScriptCall"] = "CheckBuffStack"; r["PreScriptCallParams"] = 'buff: "%s", buff_stack: 1' % rrb_pots.BLASTING
    for r in bp.rows("SkillActivate"):
        if r["ActorId"] != DONOR: continue
        ok = not r.get("ReqTriggerId") or set(r["ReqTriggerId"]) <= {1180, 1174}
        take = ok and r.get("Action") in by and ((r["Group"] == 5 and not r.get("Input")) or r["Group"] == 7)
        if take:
            rr = copy.deepcopy(r); rr["ActorId"] = ACTOR; rr["$new"] = True
            if rr["Group"] == 5 and rr.get("Action") in ("dash2", "dash3", "dashAir2", "dashAir3"):
                rr.pop("ReqTriggerId", None)   # Test 2: three Gun Blasts in a row from the start (was Triple Dash only)
            if rr["Group"] == 5 and rr.get("Mutelist"):   # the next blast right after the shot (was 0.42 / 0.56 s)
                rr["Mutelist"] = re.sub(r'"5":[0-9.]+', '"5":0.2', rr["Mutelist"])
                # Attack after a ground blast from the end of its travel (KIT_V2 §4; Ragna's 0.7 s left a dead gap)
                rr["Mutelist"] = re.sub(r'"1":0\.7\b', '"1":0.35', rr["Mutelist"])
            if rr["Group"] == 5 and rr.get("Action") == "dash2":
                rr["PreSkillOrder"] = sorted(set(rr.get("PreSkillOrder") or []) | {1, 2, 12})   # after a directional blast
            if rr["Group"] == 5 and rr.get("Action") == "dashAirend":
                # (0.6.4 game test, 2026-09-30: Ragna's row has no cancel list, so the 0.6 s air recovery could not be
                #  interrupted and an air chain needed its press in the last 87 ms of the 0.27 s travel. Now like the
                #  ground recovery: the next blast at once, attacks and the rest after 0.1 s. Decided under
                #  the lead's delegation: "Chains up to 3 times in any order and direction" holds in the air too)
                rr["Mutelist"] = '"all":0.1,"5":0.0'
            if rr["Group"] == 11: rr["Order"] = 3
            if rr["Group"] == 11 and not rr.get("Timeout"): rr["Timeout"] = round(L("summon") + 0.3, 2)
            R_.append(rr)
            if rr["Group"] == 5 and rr.get("Action") == "dashend" and BACK_END in by:
                # 0.9.0: the backward blast's own recovery reads as the ground recovery does, and keeps her facing
                rb = copy.deepcopy(rr); rb["Action"] = BACK_END; rb["Order"] = 7; rb["AutoTurn"] = 0
                R_.append(rb)
        if r["Group"] == 6 and not r.get("ReqTriggerId") and r.get("Action") in ("rush", "rushAir"):
            rr = copy.deepcopy(r); rr["ActorId"] = ACTOR; rr["$new"] = True
            rr["Action"] = "rrb_corkscrew" if r["Action"] == "rush" else "rrb_jc"
            if not rr.get("Timeout"): rr["Timeout"] = round(L(rr["Action"]) + 0.3, 2)
            if rr["Action"] == "rrb_corkscrew":   # Test 5 #10: 0.55-0.6 s of dead crouch; blast after the spin, the rest from 0.45 s
                rr["Mutelist"] = '"all":0.45,"1":0.45,"5":%.2f,"7":0.45' % max(0.3, last_hit(by["rrb_corkscrew"]))
            R_.append(rr)
    row_timing(R_, L)
    return R_


FOLLOW_GRACE = 0.10      # a follow-up may start at most this long after the previous move ends (then the string resets)
PRESS_MARGIN = 0.05      # a follow-up's buffer stays this much shorter than the previous move's cancel point


def row_timing(rows, L):
    """Input timing for every chained row (0.5.0 test, the lead: one press advanced 5A -> 5AA; a dropped string
    continued after a pause). The engine does not consume a press when a row uses it: any row whose Preinputtime still
    covers that press may take it. A press that starts move A is at least A's ActdurStrict old when A's follow-ups open,
    so a follow-up's Preinputtime must stay below the smallest ActdurStrict of the rows it follows. And the follow-ups
    of a move expire FOLLOW_GRACE after it ends: its row's Timeout (how long its followers stay valid) is capped at
    its action's length + FOLLOW_GRACE."""
    by_key = {(r.get("Group"), r.get("Order")): r for r in rows}
    for r in rows:
        if r.get("Timeout") and r.get("Action") and r["Group"] in (1, 4, 6, 8):
            r["Timeout"] = round(min(r["Timeout"], L(r["Action"]) + FOLLOW_GRACE), 2)
    for r in rows:
        pre = [by_key.get((r["Group"], o)) for o in r.get("PreSkillOrder") or []]
        # a Gunswing shot is started by Skill and opens its followers no sooner than its step would: it sets no limit
        # (0.9.0 builds 13 to 15 counted it, and every string step's buffer fell to about 0.1 s)
        pre = [p for p in pre if p and not str(p.get("Action")).startswith(rrb_pots.GSW_SHOT)]
        stricts = [p.get("ActdurStrict") for p in pre if p and p.get("ActdurStrict")]
        if r.get("Input") and stricts:
            cap = round(min(stricts) - PRESS_MARGIN, 2)
            r["Preinputtime"] = max(0.08, min(r.get("Preinputtime") or 0.2, cap))


def icon_bytes(pairs):
    """SkillActivate.Icon as the table decoder stores it: raw bytes of each AtlasSprite {1: atlas, 2: sprite} message
    (make_patch splits them back into one message per sprite). Same helper as Nine's."""
    out = []
    for atlas, sprite in pairs:
        for fnum, sv in ((1, atlas), (2, sprite)):
            b = sv.encode("utf-8"); out += [(fnum << 3) | 2, len(b)] + list(b)
    return out


def row_icons(rows_):
    import ruby_ui
    A = ruby_ui.HUD_ATLAS_PATH
    skill = icon_bytes([(A, "IconSkill_%d" % ACTOR), (A, "IconSkill_%dOFF" % ACTOR)])
    summon = icon_bytes([("UI/Atlas/Common/Common", "ImgSummon"), ("UI/Atlas/Common/Common", "ImgSummonOFF")])
    pot = lambda k: icon_bytes([(A, "Potential_%d" % POT[k])] * 2)
    for r in rows_:
        if r.get("Group") == 2: r["Icon"] = skill
        elif r.get("Group") == 11:
            r["Icon"] = pot("petal_burst") if r.get("Action") == "rrb_petalburst" else pot("petal_dance") if r.get("Action") == "rrb_petaldance" else summon
        elif r.get("Group") == 3: r["Icon"] = pot("petal_burst")


GROUP_OF = dict(rrb_pots.GROUP_V2, **{"rrb_a1": 1, "rrb_a2": 1, "rrb_a3": 1, "rrb_a4": 1, "rrb_clash": 1, "rrb_launcher": 4, "rrb_sweep": 4, "rrb_ja": 4, "rrb_jb": 4,
            "rrb_jc": 4, "rrb_j2a": 4, "rrb_corkscrew": 6, "rrb_rifleshot": 2, "rrb_guillotine": 2, "rrb_sypod": 2, "rrb_buzzsaw": 2, "rrb_buzzsaw_land": 2,
            "rrb_petalburst": 3, "rrb_petaldance": 3, "rrb_redreaper": 3, "b7": 2, "s4": 2, "b7end": 2, "s4end": 2})


DMG_NOTES = []
def port_note(k, msg): DMG_NOTES.append(msg)


def damage_rows(by, btree):
    base = next(r for r in bp.rows("SkillDamage") if r["ActorId"] == DONOR and r.get("Action") == "attack1")
    out = []
    def row(actor, n, ratio, times, g):
        r = copy.deepcopy(base); r.update({"ActorId": actor, "Action": n, "HitTimes": float(times), "DamageRatio": [round(ratio, 3)],
                                           "DamageRatioPvp": [round(ratio, 3)], "SkillGroupId": g, "$append": True})
        out.append(r)
    for n, a in by.items():
        if not a.get("HitDataList"): continue
        base_name = next((k for k in GROUP_OF if n == k or n.startswith(k + "_")), None)
        g = GROUP_OF.get(base_name) if base_name else (5 if n in DASHES or n.startswith(("rrb_blast", "dash")) else None)
        if n in DMG: ratio, times = DMG[n]
        elif g == 5: ratio, times = DMG["rrb_blast"]
        elif base_name in DMG: ratio, times = DMG[base_name]
        elif n in LOCO:   # an engine state with the donor's own hit (a heavy landing): the donor's row
            d = next((r for r in bp.rows("SkillDamage") if r["ActorId"] == DONOR and r.get("Action") == n), None)
            ratio, times = (d["DamageRatio"][0], d.get("HitTimes", 1)) if d else (0.5, 1)
            g = d.get("SkillGroupId") if d else 1
        else: raise SystemExit("no damage budget for %s" % n)
        ratio *= rrb_pots.DMG_MUL.get(n, 1.0)
        real = 0
        for h in a["HitDataList"]:
            iv = fv(h["TickRange"].get("HitInterval") or {"value": 0})
            real += max(1, int((fv(h["TickRange"]["End"]) - fv(h["TickRange"]["Start"])) / iv + 1e-6)) if iv > 0 else 1
        if real != times: port_note("damage", "%s: budget %.2f over %d hits (planned %d)" % (n, ratio, real, times))
        row(ACTOR, n, ratio, max(real, 1), g or 1)
    for a in btree["_actions"]:
        if a["Name"].startswith("TS"): continue   # Legacy rounds and roots: their own rows (legacy_rows)
        if a.get("HitDataList") and a["Name"] in DMG:
            ratio, times = DMG[a["Name"]]; row(BID, a["Name"], ratio, times, 2)
        elif a.get("HitDataList") and not a["Name"].startswith("fxc_"):
            raise SystemExit("no damage budget for her projectile %s" % a["Name"])
    return out


# ---------------------------------------------------------------- 6. tables, text, mod.json
NAME_LOC = {"enu": "Ruby Rose", "chs": "露比·萝丝", "cht": "露比·蘿絲", "deu": "Ruby Rose",
            "esp": "Ruby Rose", "fac": "Ruby Rose", "jpn": "ルビー・ローズ", "kor": "루비 로즈",
            "ptb": "Ruby Rose", "rus": "Руби Роуз"}
LANGS = tuple(NAME_LOC)
# (2026-10-03, the lead: "she just needs to be stronger early game".) HP 980 -> 1060, Attack 160 -> 180: the base cast's
# medians are 1060 / 150; 180 is above every fast character (Ragna 170, Noel 160) and under the heavy hitters (210, 320)
ATTRS = [{"Type": 1, "Value": 1060.0}, {"Type": 6, "Value": 180.0}, {"Type": 18, "Value": 100.0}, {"Type": 92, "Value": 1.0},
         {"Type": 98, "Value": 99.0}, {"Type": 115, "Value": 0.3}]


def write_mod(port, by, btree):
    copyrow = lambda where, setv, **kw: [{"$copyRows": dict({"where": where, "set": setv}, **kw)}]
    rows_ = input_rows(port, by)
    row_icons(rows_)
    ptabs, ploc, pbuffs = rrb_pots.content_v2(sys.modules[__name__])   # V2: per language
    # a trigger her own rows grant must never have been stripped from her trees as "a donor's" (strip_foreign_hooks)
    granted = {int(m.group(1)) for r in ptabs["PlayerBattleTriggerDetail"] for m in re.finditer(r"Id:(\d+)", str(r.get("OPParams") or ""))}
    granted |= {r["Idx"] for r in ptabs["PlayerBattleTriggerDetail"]}
    clash = sorted(i for i in granted if any(j in STRIPPED_TRIGGERS for j in range(i, i + 5)))
    if clash: raise SystemExit("donor hooks were removed for triggers her own rows grant: %s (build_ruby.foreign_triggers)" % clash)
    T = {
        "HeroConfig": copyrow({"Id": DONOR}, {"Id": ACTOR, "LogicRes": LOGIC, "Skin": [SKIN], "MoveSpeed": 7.2, "Describe": LOGIC,
                                               "Boxwidth": 0.5, "Boxheight": 1.45, "Colwidth": 0.9, "Colheight": 1.45, "CueSheets": __import__("rrb_sound").CUE_SHEETS}),
        "BaseActorConf": copyrow({"ActorId": DONOR}, {"ActorId": ACTOR, "PotentialPoolId": ACTOR, "SortNum": 105, "PvpUnlocked": 0,
                                                       "InheritSkill": [], "Talents": [{"Id": TALENT, "Quality": 1}], "Name": NAME_LOC["chs"]}),
        "BaseActorAttrConf": copyrow({"ActorId": DONOR}, {"ActorId": ACTOR, "Attr": ATTRS}),
        "PvpBaseActorAttrConf": copyrow({"ActorId": DONOR}, {"ActorId": ACTOR}),
        "FesActorAttrInheritConf": copyrow({"ActorId": DONOR}, {"ActorId": ACTOR}),
        # her select / result portraits: solved so she stands as tall as Hibiki with his eye line (rrb_portrait.py)
        "HeroPortraitOffsetConfigUI": __import__("ruby_ui").portrait_rows(),
        "ActorConfig": copyrow({"Id": DONOR}, {"Id": ACTOR}),
        "ClientSkinConf": copyrow({"Id": 100101020}, {"Id": ACTOR * 1000 + 20, "HeroId": ACTOR, "SkinName": SKIN, "Color": "#c8102e"}),
        "SkinUnlockConf": copyrow({"Id": 100101020}, {"Id": ACTOR * 1000 + 20}),
        "BulletConfig": [{"$copyRows": {"where": {"Id": 10030101}, "set": {"Id": BID, "LogicRes": BLOGIC}}}],
        "SkillActivate": rows_,
        "SkillDamage": damage_rows(by, btree),
    }
    for k, v in ptabs.items(): T[k] = T.get(k, []) + v
    for k, v in legacy_rows().items(): T[k] = T.get(k, []) + v
    T["BaseActorConf"][0]["$copyRows"]["set"]["InheritSkill"] = [L["id"] for L in LEGACY]
    enu = {}   # the Legacy texts in English: the fallback for a language rrb_text.LEGACY_TEXT lacks
    import rrb_text as TX
    for L in LEGACY:
        enu.update({"InheritSkill_%d" % L["id"]: L["name"], "InheritSkillDesc_%d" % L["id"]: L["desc"], "InheritSkillDescUpgrade_%d" % L["id"]: L["up"]})
    AT = TX.ACTOR_TEXT
    loc = {}
    for lang in LANGS:
        actor = {"BaseActor_chs_%d" % ACTOR: NAME_LOC[lang], "ActorSkill_%d" % ACTOR: AT["skill"][lang], "ActorSkillDesc_%d" % ACTOR: AT["skill_desc"][lang],
                 "ActorUltra_%d" % ACTOR: AT["ultra"][lang], "ActorUltraDesc_%d" % ACTOR: AT["ultra_desc"][lang]}   # rrb_text.ACTOR_TEXT
        d = dict(actor, **enu); d.update(ploc[lang]); d.update(actor)
        for L in LEGACY:   # the Legacy texts in each language (rrb_text.LEGACY_TEXT)
            lt = TX.LEGACY_TEXT.get(L["id"]) or {}
            for key, f in (("InheritSkill_%d", "name"), ("InheritSkillDesc_%d", "desc"), ("InheritSkillDescUpgrade_%d", "up")):
                v = lt.get(f)
                if isinstance(v, dict) and v.get(lang): d[key % L["id"]] = v[lang]
        loc[lang] = d
    import rrb_power   # the runtime (Dust, power stages, the Petal Burst gust) with its constants from rrb_power.py
    js = [{"file": "data/js/gameplay/buff/BuffFuncs",
           "append": rrb_power.js_config(rrb_pots, sys.modules[__name__]) + io.open(os.path.join(HERE, "src", "rrb_runtime.js"), encoding="utf-8").read()},
          # 0.8.0: her SP badge on the battle HUD (the game shows SP only on the Ultra card's icon; her Dust spends it)
          {"file": "data/js/window/battle/BattleUI",
           "append": io.open(os.path.join(HERE, "src", "rrb_hud.js"), encoding="utf-8").read().replace("@ACTOR@", str(ACTOR))},
          {"file": "data/js/core/ActorUtil",
           "append": "/* char-ruby: economy tables use Ragna's rows (donor) until her own exist */\n"
                     "try{globalThis.BB_ACTOR_DONOR=globalThis.BB_ACTOR_DONOR||{};globalThis.BB_ACTOR_DONOR[%d]=%d;(globalThis.BB_HUD_SPRITES=globalThis.BB_HUD_SPRITES||{})[\"Talent_%d\"]=\"IconPotential%d\"}catch(e){}" % (ACTOR, DONOR, TALENT, ACTOR)}]
    import ruby_ui
    pids = ruby_ui.card_ids(rrb_pots.ICON_CARDS, rrb_pots.UNLEASHED)   # the 38 cards + Potential Unleashed (IconId 20799)
    content = {
        "tables": T, "locale": loc, "spriteAliases": ruby_ui.aliases(pids), "textureAliases": {}, "js": js,
        # the art (rig + every UI texture, icon and her HUD atlas) is built at build time from the player's own BBTAG
        "importers": [{"script": "import_ruby.py", "args": ["all"]}],
        # refTypesFrom: bundles whose condition-class registrations are merged into the clone, so the tree may use a
        # class its donor file never declared. Base-game bundles only (until 0.6.11 Bullet's `bl` and `blbullet`, paid
        # DLC, were listed too: they add no class the others lack; INTEGRATION_AUDIT O2). check_ruby_build confirms
        # every class her trees use is registered in the built bundles.
        "bundleClones": [
            {"from": "actor/logicdata/%s" % DONOR_LOGIC, "to": "actor/logicdata/%s" % LOGIC,
             "rename": [["LogicData/%s.asset" % DONOR_LOGIC, "LogicData/%s.asset" % LOGIC]],
             "refTypesFrom": ["actor/logicdata/%s" % lg for lg in TEMPLATE_LOGICS if lg != DONOR_LOGIC] + ["actor/logicdata/pt"]},
            {"from": "actor/logicdata/nobullet", "to": "actor/logicdata/%s" % BLOGIC, "rename": [["LogicData/nobullet.asset", "LogicData/%s.asset" % BLOGIC]],
             "refTypesFrom": ["actor/logicdata/rg"]},
        ],
        "assets": [{"bundle": "actor/logicdata/%s.ab" % LOGIC, "asset": DONOR_LOGIC, "treeFile": "gen/%s_tree.json" % LOGIC},
                   {"bundle": "actor/logicdata/%s.ab" % BLOGIC, "asset": "nobullet", "treeFile": "gen/%s_tree.json" % BLOGIC},
                   {"bundle": "actor/buff/buff.ab", "asset": "Buff", "copyItems": pbuffs},
                   {"bundle": "ui/texture/metrics.ab", "asset": "metrics", "appendItems": ruby_ui.metrics_rows(pids)}],
    }
    mp = os.path.join(HERE, "mod.json")
    m = json.load(io.open(mp, encoding="utf-8")) if os.path.exists(mp) else {}
    m.update({"id": os.path.basename(HERE), "name": "Ruby Rose (Cross Effect, alpha)", "author": "BBEE modding project", "version": VERSION,
              "description": "Ruby Rose from BlazBlue Cross Tag Battle as a playable character (ActorId 200701). Built on your machine from "
                             "your own BlazBlue Cross Tag Battle install; requires BBTAG and all of its DLC. Unofficial.",
              "gameBuilds": ["25478197", "25598842", "25621352", "25627491"], "dependencies": ["bbee-sdk", "bbee-actors"], "content": content})
    io.open(mp, "w", encoding="utf-8", newline="\n").write(json.dumps(m, ensure_ascii=False, indent=1) + "\n")
    print("mod.json: %d tables, %d input rows, %d damage rows, %d Potentials, %d text keys" % (
        len(T), len(T["SkillActivate"]), len(T["SkillDamage"]), len(rrb_pots.CARDS) + 1, len(loc["enu"])))


def main():
    # her moves, timings and boxes are derived from the player's Cross Tag Battle script: the ownership check comes
    # before anything is read from that install (it used to run only at install; INTEGRATION_AUDIT O3)
    import import_ruby
    import_ruby.require_ownership()
    port, by, btree = build_logic()
    write_mod(port, by, btree)


if __name__ == "__main__":
    main()
