"""rrb_sound.py -- Ruby V2: her own BBTAG sounds and English voice on her actions, on BBTAG's ticks (KIT_V2 §8).

The cue sheets are made at build time by ruby_audio.py (research/AUDIO.md): sfx_cx_ruby (her sound bank, plus the
common and Ragna sounds her script plays) and vo_cx_ruby (the English battle voice, one cue per line plus one "_rnd"
cue per variant list her script plays, which rotates the variants without repeating).

Timing: the same rules as rrb_fx.wire. Each action plays a window of one or more BBTAG states: (states, the action's
start inside them, the cue window's end). A cue at BBTAG time t lands at (t - start) x RETIMED, and cues past the
action's TotalDuration are dropped. Sounds come from:
  - her state: SFX commands and voice lists (bbtag_moves reads them);
  - the effect states it spawns (scr_rrbea.bin: the muzzle flashes carry the gunshot rrbse_02, the petal bursts
    rrbse_10 / 11), on the spawn tick plus the effect's own time.
Presentation actions (intro, win poses, idles, taunts) find their states from their clip: ruby_clips says which BBTAG
state segments the clip is made of, so the cue window is exactly the clip's part of the state.

Voice (the voice pass, 2026-10-03; the lead: "she sounds good but we should add more voicelines and attack lines and
sounds for her"; study in local_only/agents/voice): each move speaks the line BBTAG plays on that move, at BBTAG's tick.
VOICE_PLAN lists the line per move; a move it does not list keeps the earlier rule (VOICED: Skills, Gun Blasts on every
other one in a chain, supers and Red Reaper, the intro and the win poses speak every script line in their window).
  - Normals use BBTAG's generic attack shouts at BBTAG's own chance (light 60 %, medium 75 %, heavy always; set in the
    cue, ruby_audio.VOICE_CLASS). 5A, 2A, j.2A and 5AAA stay silent (jabs are mashed; 5AAA's shout would be cut by
    5AAAA's call-out on every full string).
  - One voice plays at a time: the cue priorities (ruby_audio.VOICE_CLASS) decide which. A move's second line has its
    first line's priority + 1, so it replaces it (the stock follow-up rule).
  - Engine states (hurt, recovery, double jump, idle, revive) take BBTAG's damage cries, recovery lines and efforts on
    the actions where the stock heroes speak. Death, character select and room lines are cues the game asks for by
    name (ruby_audio.ALIASES): nothing to wire here.
  - Tag-partner lines (rrb6xx / rrb7xx: a line addressed to a BBTAG partner) are never used.
  - Where BBTAG picks between alternatives on the same beat, the move's own line is kept: the intro keeps its random
    three-line cue (not the 25 % rrb501 branch); win poses keep the pose's own pair (not rrb402, BBTAG's team-mode
    line).
Stock sounds: a template's Noel sound (sfx_no_*) is removed when one of her own sounds covers the same beat (within
-0.15..+0.30 s of it). Moves BBTAG leaves silent keep theirs (j.2A). HitAudios (weight_pass) and footsteps are
untouched.
"""
import json, os, re, sys, types

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
for _p in (os.path.join(TOOLS, "tools", "bbtag"), HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import ruby_audio as RA

# preloaded with her (HeroConfig.CueSheets): sfx_no stays for her hit sounds (weight_pass HIT_SOUND) and the stock swing
# on moves BBTAG leaves silent
CUE_SHEETS = ["sfx_no", RA.SFX_SHEET, RA.VO_SHEET]

# KIT_V2 §8: the actions that may speak (Potential variants follow their base move)
VOICED = {"rrb_rifleshot", "rrb_sypod", "rrb_guillotine", "rrb_buzzsaw",                       # Skills
          "dash", "dash3", "dashAir", "dashAir3",                                              # every other blast
          "rrb_blast_up", "rrb_blast_air_up", "rrb_blast_down",                                # directional blasts
          "rrb_petalburst", "rrb_petaldance", "rrb_redreaper",                                 # supers
          "born", "reborn", "pvp_born", "winpose", "winpose2", "StagePass"}                    # intro, win poses
# lines added where BBTAG has none: (voice group key or line, time s). BBTAG's Shot (the fold-and-fire her Rifle Shot
# plays) is silent: Rifle Shot's own lines (rrb207, AttackAndShotA/B) on the fold. The partner intro clip (pvp_born) only
# has a partner line in BBTAG: the intro's own random line at the intro's beat (0.2 s).
VOICE_ADD = {"pvp_born": [("rrb500_504_505", 0.2)]}
# the line of each move: {action: [(voice key, time)]}. key = a variant group (ruby_audio groups / EXTRA_GROUPS), a line, or
# an exact cue name (ruby_audio.ALIASES). time = seconds into the action, or "script" = where BBTAG's script plays that key
# inside the action's window. [] = deliberately silent. Potential variants (<action>_<suffix>) follow the longest listed
# name. BBTAG's ticks: 5AA tick 8, 5AAAA 9, 5B 6, 2B 7, 5BB / Low Sweep 9, Rising Reap 12, j.A 5, j.B 8, j.C 13.
VOICE_PLAN = {
    "rrb_a1": [], "rrb_2a": [], "rrb_j2a": [], "rrb_a3": [], "rrb_a4_rise": [], "rrb_jc_land": [],
    "rrb_a2": [("rrb102", 0.133)], "rrb_a4": [("rrb209_v12", 0.150)],
    "rrb_5b": [("rrb102", 0.100)], "rrb_2b": [("rrb102", 0.117)], "rrb_5bb": [("rrb104", 0.150)], "rrb_sweep": [("rrb104", 0.150)],
    "rrb_launcher": [("rrb101", 0.200)],
    "rrb_ja": [("rrb101", 0.083)], "rrb_jb": [("rrb103", 0.133)], "rrb_jc": [("rrb105", 0.217)],
    # Corkscrew speaks one step under the Gun Blast call-out it is entered from (heard after a silent blast)
    "rrb_corkscrew": [("rrb200", 0.0)],
    # Clash Assault: the start line, the finish line on the strike; the chase is too short for BBTAG's 2 s chase line
    "rrb_clash": [("rrb157", 0.04)], "rrb_clash_land": [], "rrb_clash_chase1": [], "rrb_clash_chase2": [], "rrb_clash_storm": [],
    "rrb_clash_finish": [("rrb159", 0.15)], "rrb_clash_exfinish": [("rrb159", 0.15)],
    # Reaper's Hook: the attempt's line only on a miss (a hook that connects has left the action by 0.45 s)
    "rrb_hook": [("rrb155", 0.47)], "rrb_hook_exe": [("rrb153", 0.05), ("rrb154", 0.517)], "rrb_hook_back": [("rrb153", 0.05), ("rrb154", 0.533)],
    "rrb_guil_loop1": [], "rrb_guil_loop2": [], "rrb_guil_end": [("rrb104", 0.0)],
    # Buzzsaw: 0.23 s is past the EX switch window (0.19-0.22 s), so base and EX never both speak
    "rrb_buzzsaw": [("rrb213", 0.23)], "rrb_buzzsaw_ex": [("rrb214", 0.03)], "rrb_buzzsaw_land": [("rrb215", 0.20)],
    "rrb_rifleshot": [("rrb212", 0.10)],                 # BBTAG's Shot plays rrb212 (command 7007)
    "rrb_rifleshot_r": [],                               # 0.9.0: fired again from the aiming pose: no line each time
    "rrb_blast_back": [("rrb203", 0.067)], "rrb_blast_air_back": [("rrb204", 0.05)],
    "rrb_recoilshot": [("vo_cx_ruby_recoil", 0.05)],     # 0.9.0: the air Skill, on the air backward gun-dash's frames
    "rrb_blast_up_c": [], "rrb_blast_air_up_c": [], "rrb_blast_back_c": [], "rrb_blast_air_back_c": [], "rrb_blast_down_c": [],
    "rrb_dust_fire": [("vo_cx_ruby_reload", 0.05)], "rrb_dust_ice": [("vo_cx_ruby_reload", 0.05)],
    "rrb_dust_bolt": [("vo_cx_ruby_reload", 0.05)], "rrb_dust_grav": [("vo_cx_ruby_reload", 0.05)],
    # engine states, on the actions and times where the stock heroes speak (exact names: never the variant rule)
    "behit_up": [("hurt_light", 0.0)], "behit_middle": [("hurt_light", 0.0)],
    "push_back": [("hurt_heavy", 0.0)], "push_down": [("hurt_heavy", 0.0)], "push_down_2": [("hurt_heavy", 0.0)],
    "push_back_4": [("hurt_launch", 0.02)], "push_down_4": [("hurt_launch", 0.02)],
    "quickStand": [("tech_ground", 0.0)], "standUp": [("tech_ground", 0.02)], "standUp2": [("tech_ground", 0.02)],
    "reactive": [("tech_air", 0.0)],
    "jump2": [("jump", 0.0)], "jump3": [("jump", 0.0)],
    "jump_rj": [], "jump2_rj": [("jump", 0.0)], "jump3_rj": [("jump", 0.0)],      # the Recoil Jump's versions (card 20741)
    "dead_backup": [("hurt_heavy", 0.0), ("vo_cx_ruby_revive", 1.90)],
    "standby1": [("rrb000", 0.02)],
}
ENGINE = ("behit_up", "behit_middle", "push_back", "push_down", "push_down_2", "push_back_4", "push_down_4", "quickStand", "standUp",
          "standUp2", "reactive", "jump2", "jump3", "jump2_rj", "jump3_rj", "dead_backup", "standby1")       # (exact names only)
# her own sounds on actions BBTAG's script does not cover (her kit's own actions): {action: [(sound name in her bank, time)]}
#   Dust reload: the fold, then the casing and bolt clicks on the cartridge eject (0.21 s) and the lock-in (0.30 s)
#   Guillotine's last cut: MultiAssault's cut;  the hold loops: her spin;  Reaper's Hook: BBTAG's throw swing
SOUND_PLAN = {
    "rrb_dust_fire": [("rrbse_13", 0.0), ("rrbse_01", 0.16)], "rrb_dust_ice": [("rrbse_13", 0.0), ("rrbse_01", 0.16)],
    "rrb_dust_bolt": [("rrbse_13", 0.0), ("rrbse_01", 0.16)], "rrb_dust_grav": [("rrbse_13", 0.0), ("rrbse_01", 0.16)],
    "rrb_guil_end": [("rrbse_05", 0.0)],
    # 0.9.0 (a tester, 2026-10-07: the aerial kick "plays a gunshot sound effect"): the template's sound was Noel's
    # first attack, a pistol shot. Cloth on each kick instead (chosen by name: nobody has heard it yet)
    "rrb_j2a": [("019_cloth_b", 0.05), ("019_cloth_b", 0.17)],
    "rrb_guil_loop1": [("rrbse_03", 0.0), ("rrbse_03", 0.20)], "rrb_guil_loop2": [("rrbse_03", 0.0), ("rrbse_03", 0.20)],
    "rrb_hook": [("010_swing_sword_0", 0.10)], "rrb_hook_exe": [("010_swing_sword_0", 0.15)], "rrb_hook_back": [("010_swing_sword_0", 0.15)],
    # the Recoil Jump (card 20741, 0.8.0): her rifle shot as the recoil version starts (rrb_pots.JUMP_SHOT)
    "jump_rj": [("rrbse_02", 0.0)], "jump2_rj": [("rrbse_02", 0.0)], "jump3_rj": [("rrbse_02", 0.0)],
}
# BBTAG alternatives on the same beat: the one not used (a line or a variant group key)
ALTERNATIVE = {"CmnActEntry": {"rrb501"}, "CmnActMatchWin": {"rrb402"}}
PARTNER = re.compile(r"^rrb[67]\d\d")          # tag-partner dialogue
STOCK_REPLACEABLE = re.compile(r"^sfx_no_")   # the templates' placeholder sounds (build_ruby sfx())
STOCK_GUN = {"sfx_no_attack7"}                 # Noel's gunshot: only her gunshot replaces it
HER_GUN = ("rrbse_02", "rrbse_08")             # her rifle shot (every muzzle effect plays rrbse_02) and the blast boom
GUNSHOT = RA.SFX_PREFIX + "rrbse_02"
CASING = "rrbse_01"                            # the casing clink: BBTAG plays it with rrbCaseEff
COVER = (-0.15, 0.30)                          # her sound this far before / after a stock one replaces it
# the supers aren't in build_ruby's KIT / FX_ACTIONS tables (rrb_supers.py owns their effects): defaults here
SUPERS = {"rrb_petalburst": (["UltimateAssault"], 0.0, None), "rrb_petaldance": (["UltimateDance"], 0.0, None),
          "rrb_redreaper": (["AstralHeat"], 0.0, None)}
VOICE_LEAD = 0.25    # a voice line up to this long before a chained action's start (dash3 starts on BBTAG's firing tick)
                     # plays at 0: she still speaks as the chained blast fires
PRESENTATION = ("born", "reborn", "pvp_born", "winpose", "winpose2", "StagePass", "standby1", "standby2", "paid_show")
HOLD = 30000


# stock foley on the engine states (exact action names): the donor's body sounds went with the donor's voice, which left
# her jumps, landings, squats, knockdowns and recoveries silent. These are the cues Noel's own actions play on the same
# states, at Noel's times (all at the action's start): a light character's foley rather than Ragna's.
STOCK_PLAN = {
    "jump": [("sfx_no_jump_01", 0.0)], "jump2": [("sfx_no_jump_02", 0.0)], "jump3": [("sfx_no_jump_02", 0.0)],
    # (the Recoil Jump's versions, card 20741: the ground one is entered 0.1 s into the stock jump, whose foley has played)
    "jump2_rj": [("sfx_no_jump_02", 0.0)], "jump3_rj": [("sfx_no_jump_02", 0.0)],
    # (5AAAA's automatic rise, rrb_a4_rise, is made later by rrb_power with no sounds: the strike's own sounds cover it)
    "dropend": [("HA_drop", 0.0)], "dropend2": [("HA_drop", 0.0)], "dropend3": [("sfx_no_dropend3", 0.0)], "dropend4": [("sfx_no_dropend4", 0.0)],
    "squat": [("sfx_no_squat", 0.0)], "squat_to_stand": [("sfx_no_squat_to_stand", 0.0)],
    "push_back_3": [("sfx_no_push_back", 0.0)], "push_down_3": [("sfx_no_push_back", 0.0)],
    "push_back_4": [("sfx_no_push_back_3", 0.0)], "push_down_4": [("sfx_no_push_back_3", 0.0)], "knockdown": [("sfx_no_push_back_3", 0.0)],
    "standUp": [("sfx_no_standup2", 0.0)], "standUp2": [("sfx_no_standup2", 0.0)], "knockdown_stand": [("sfx_es_standup", 0.0)],
    "quickStand": [("HA_jump1", 0.0)], "reactive": [("sfx_no_reactive", 0.0)], "drop_down": [("sfx_no_drop_down", 0.0)],
}


# ------------------------------------------------------------------------------------------------ BBTAG timelines
def _walk(moves, state):
    """bbtag_moves.Moves.move's cue timing (a command runs on the first tick of the sprite it follows; `upon`
    handlers other than IMMEDIATE are off the timeline) -> [(t s, kind, value)]: kind sfx / voice / spawn (GFX_0 or
    createObject: an effect state)."""
    import bbscript_dump as S
    out, t, cur, upon = [], 0, 0, None
    for x in S.decode(moves.b, *moves.st[state]):
        op, ar = x[1], x[-1]
        name = S.NAMES.get(op, str(op))
        strs = [v.strip('"') for v in ar if isinstance(v, str)]
        if name == "upon":
            upon = ar[0] if ar else 0; continue
        if name == "endUpon":
            upon = None; continue
        if upon not in (None, 0):
            continue
        at = (t if upon == 0 else cur) / 60
        if op == 2 and strs:
            d = ar[1] if len(ar) > 1 else 1
            d = 1 if d >= HOLD else max(1, d)
            cur = t; t += d
        elif name.startswith("SFX"):
            out.append((at, "sfx", strs[0] if strs else ar))
        elif op in (7006, 7007) or name == "tag_voice":      # (7007: 7006 that never repeats the line still playing)
            out.append((at, "voice", list(strs)))
        elif (name == "GFX_0" or op == 21015) and strs:
            out.append((at, "spawn", strs[0]))
    return out


_EA = {}
def effect_moves():
    if "m" not in _EA:
        import bbtag_moves as M, bbtag_read as R, bbtag_xact as X
        ea = R.fpac_files(X.read_fast(RA.SCRIPT[0]))["scr_rrbea.bin"]
        _EA["m"] = M.Moves(types.SimpleNamespace(col={}), ea, 1.0)
    return _EA["m"]


def timeline(moves, states, depth=3):
    """Her states played back to back -> sorted [(t, kind, value, source state)] with the sounds of every effect state
    they spawn (nested up to `depth`)."""
    ea = effect_moves()
    out, t0 = [], 0.0

    def effect(name, at, d, seen):
        if d <= 0 or name in seen or name not in ea.st:
            return
        for te, k, v in _walk(ea, name):
            if k == "spawn":
                effect(v, at + te, d - 1, seen | {name})
            else:
                out.append((at + te, k, v, name))

    for st in states:
        for t, k, v in _walk(moves, st):
            if k == "spawn":
                effect(v, t0 + t, depth, frozenset())
            else:
                out.append((t0 + t, k, v, st))
        t0 += moves.move(st)["total"]
    return sorted(out, key=lambda x: (x[0], x[1], str(x[2])))


def clip_windows(port, by, names):
    """Presentation actions -> (BBTAG state, start s, end s) from their clip (ruby_clips: one state, contiguous
    segments). A clip stretched to the donor's timing ("fit") scales by AnimateDuration / clip length."""
    import bbtag_clips as BC, bbscript_dump as S, ruby_clips as RC
    b = port.MOVES.b
    cat = {n: BC.segments(b, a, z) for n, a, z in S.states(b)}
    table = {}
    for n in names:
        a = by.get(n)
        if not a or not str(a.get("Animate", "")).startswith(RC.ROLE + "_"):
            continue
        clip = a["Animate"][len(RC.ROLE) + 1:]
        src = RC.BASE.get(clip) or RC.KIT.get(clip)
        if not src or len(src) != 1 or src[0][0] not in cat:
            continue
        st, idx = src[0]
        segs = cat[st]
        ticks = [sum(f[1] for f in sg["frames"]) for sg in segs]
        if idx != list(range(idx[0], idx[-1] + 1)):
            continue
        start, end = sum(ticks[:idx[0]]) / 60.0, sum(ticks[:idx[-1] + 1]) / 60.0
        L = end - start
        k = port.fv(a["AnimateDuration"]) / L if L > 0 else 1.0
        table[n] = ([st], start, end, k)
    return table


# ------------------------------------------------------------------------------------------------ wiring
def _base(name, keys):
    best = None
    for k in keys:
        if name.startswith(k + "_") and (best is None or len(k) > len(best)):
            best = k
    return best


def _entry(a, cue, t):
    """The Audios entry build_ruby.sfx() makes (the stock format: voices use it too, e.g. rg / bl / pt)."""
    a.setdefault("Audios", []).append({"Cue": cue, "Time": float(t), "StopWhenChangeAction": 0, "CheckVoiceState": 0,
                                       "ConditionGroup": {"Combine": 0, "Conditions": []}})


def load_map():
    if not os.path.exists(RA.MAP):
        RA.write_map(RA.plan())
    amap = json.load(open(RA.MAP, encoding="utf-8"))
    # (0.9.0) a map left by an older version of her files lacks the newer line names (a package unzipped over an older
    # one; the released folder after a sync): it is written again here, where the build used to stop
    if any(k not in (amap.get("aliases") or {}) for k in RA.ALIASES):
        RA.write_map(RA.plan()); amap = json.load(open(RA.MAP, encoding="utf-8"))
    return amap


def _voice_key(cue):
    return cue[len(RA.VO_PREFIX):-len(RA.GROUP_SUFFIX)] if cue.endswith(RA.GROUP_SUFFIX) else cue[len(RA.VO_PREFIX):]


def voice_plan(action):
    """the VOICE_PLAN entry of an action: its own, else the longest listed name it is a variant of (<name>_<suffix>);
    engine states by exact name only. None: not listed"""
    if action in VOICE_PLAN:
        return VOICE_PLAN[action]
    k = _base(action, [n for n in VOICE_PLAN if n not in ENGINE])
    return VOICE_PLAN[k] if k else None


def voice_cue(key, amap):
    """a VOICE_PLAN key -> its cue name (a variant group, a line or an exact cue), or None"""
    g = amap["groups"].get(key) or amap["voice"].get(key) or (amap.get("aliases") or {}).get(key)
    return g["cue"] if g else None


def plan_action(port, name, a, spec, amap, retimed=1.0, clamp_voice=False, action=None):
    """-> (picks [(t, cue)], skipped [(t, value, why)]) for one action. spec = (states, start, end[, clip scale]).
    clamp_voice: a chained move (it starts on BBTAG's firing tick) speaks at 0 if its line was just before its start.
    The casing clink past the action's end by less than 0.25 s plays on its last tick (rrb_fx does the same with the
    casing effect: the first Gun Blast ends before BBTAG's late casing cue)."""
    sts, off, end = spec[:3]
    k = (spec[3] if len(spec) > 3 else 1.0) * retimed
    T = port.fv(a["TotalDuration"])
    vp = voice_plan(action or name)                      # None: the earlier rule (VOICED)
    scripted = {k_ for k_, t_ in (vp or []) if t_ == "script"}
    voiced = (name in VOICED) if vp is None else bool(scripted)
    alt = set().union(*[ALTERNATIVE.get(s, set()) for s in sts]) if sts else set()
    picks, skipped = [], []
    for t, kind, v, src in timeline(port.MOVES, sts):
        if kind == "voice" and voiced and clamp_voice and off - VOICE_LEAD <= t < off:
            t = off
        if t < off - 1e-6 or (end is not None and t >= end - 1e-6):
            continue
        tt = round((t - off) * k, 4)
        if tt > T + 1e-6 and v == CASING and tt - T < 0.25:
            tt = round(T - 1 / 60.0, 4)
        if tt > T + 1e-6:
            skipped.append((tt, v, "after the action ends (%.2f s)" % T)); continue
        names = v if isinstance(v, list) else [v]
        if not isinstance(names[0], str):
            skipped.append((tt, v, "numeric sound command")); continue
        if any(PARTNER.match(x) for x in names):
            skipped.append((tt, v, "tag-partner line")); continue
        cue = RA.cue_for(kind, v, amap)
        if cue is None:
            skipped.append((tt, v, "not imported")); continue
        if cue.startswith(RA.VO_PREFIX):
            key = _voice_key(cue)
            if key in alt or any(x in alt for x in names) or any(key.startswith(x + "_") for x in alt):
                skipped.append((tt, v, "BBTAG alternative on this beat")); continue
            if vp is not None and key not in scripted:
                skipped.append((tt, v, "not this move's line (VOICE_PLAN)")); continue
            if not voiced:
                skipped.append((tt, v, "no voice on this action (KIT_V2 §8)")); continue
        picks.append((tt, cue))
    for key, t in vp or []:                              # the move's own lines at their own times
        if t == "script": continue
        cue = voice_cue(key, amap)
        if cue is None:
            raise SystemExit("rrb_sound: VOICE_PLAN %s: no cue for %r (run `python ruby_audio.py map`)" % (action or name, key))
        if t <= T + 1e-6: picks.append((round(min(t, max(0.0, T - 1 / 60.0)), 4), cue))
        else: skipped.append((t, key, "after the action ends (%.2f s)" % T))
    for snd_, t in SOUND_PLAN.get(action or name, SOUND_PLAN.get(name, [])):
        e = amap["sfx"].get(snd_)
        if e is None:
            raise SystemExit("rrb_sound: SOUND_PLAN %s: sound %r is not imported" % (action or name, snd_))
        if t <= T + 1e-6: picks.append((round(t, 4), e["cue"]))
    have = {x.get("Cue") for x in a.get("Audios") or []}
    for cue, t in STOCK_PLAN.get(action or name, []):
        if cue not in have and t <= T + 1e-6: picks.append((round(t, 4), cue))
    for key, t in VOICE_ADD.get(name, []):
        g = amap["groups"].get(key)
        cue = g["cue"] if g else (amap["voice"].get(key) or {}).get("cue")
        if cue and t <= T:
            picks.append((round(t, 4), cue))
    seen, out = set(), []
    for t, cue in sorted(picks):
        if (round(t * 120), cue) in seen:          # one play per cue per tick
            continue
        seen.add((round(t * 120), cue)); out.append((t, cue))
    return out, skipped


def wire(port, by, action_states, sfx_entry=None, log=print):
    """Add her sounds and voice to every action. action_states: {action: (BBTAG states, start offset in them, cue
    window end)} as for rrb_fx.wire; presentation actions are added from their clips. Potential variants (base_suffix)
    follow their base move. sfx_entry(a, cue, t) appends one Audios entry (default: build_ruby.sfx()'s format).
    -> {action: [(t, cue)]}"""
    amap = load_map()
    add = sfx_entry or _entry
    retimed = getattr(port, "RETIMED", None) or {}
    pres = clip_windows(port, by, [n for n in PRESENTATION if n not in action_states])
    moves_ = dict(SUPERS)
    moves_.update({n: tuple(v) for n, v in action_states.items()})
    specs = dict(pres); specs.update(moves_)
    result, n_add, n_rm = {}, 0, 0
    for name in sorted(by):
        a = by[name]
        base = name if name in specs else _base(name, moves_)   # Potential variants: moves only (not born_start...)
        if base is None:
            # no BBTAG window (engine states, her kit's own actions): only what the plans list for it
            if voice_plan(name) is None and name not in SOUND_PLAN and name not in STOCK_PLAN:
                continue
            picks, skipped = plan_action(port, name, a, ([], 0.0, None), amap, 1.0, action=name)
        else:
            rk = retimed.get(name, retimed.get(base, 1.0))
            picks, skipped = plan_action(port, base, a, specs[base], amap, rk, clamp_voice=base in moves_, action=name)
        own = [t for t, c in picks if c.startswith(RA.SFX_PREFIX)]
        gun = [t for t, c in picks if c[len(RA.SFX_PREFIX):] in HER_GUN]
        keep, removed, swapped = [], [], []
        for x in a.get("Audios") or []:
            c, t = x.get("Cue") or "", float(x.get("Time") or 0.0)
            if c.startswith((RA.SFX_PREFIX, RA.VO_PREFIX)):
                continue                                # re-wiring replaces her own cues
            if STOCK_REPLACEABLE.match(c):
                cover = gun if c in STOCK_GUN else own
                if any(t + COVER[0] - 1e-6 <= o <= t + COVER[1] + 1e-6 for o in cover):
                    removed.append((round(t, 3), c)); continue
                if c in STOCK_GUN:                      # a shot BBTAG doesn't have (a Potential's extra round): her gunshot
                    swapped.append((round(t, 3), c)); picks.append((round(t, 4), GUNSHOT)); continue
            keep.append(x)
        a["Audios"] = keep
        picks.sort()
        for t, cue in picks:
            add(a, cue, t)
        result[name] = picks
        n_add += len(picks); n_rm += len(removed) + len(swapped)
        if picks or removed:
            log("rrb_sound %s%s: %s%s%s" % (name, "" if base == name else " (as %s)" % base,
                                           ", ".join("%.3f %s" % (t, c.replace(RA.SFX_PREFIX, "s:").replace(RA.VO_PREFIX, "v:")) for t, c in picks) or "-",
                                           ("; removed stock " + ", ".join("%s@%.3f" % (c, t) for t, c in removed)) if removed else "",
                                           ("; stock gunshot -> hers " + ", ".join("@%.3f" % t for t, c in swapped)) if swapped else ""))
    log("rrb_sound: %d cues on %d actions, %d stock sounds replaced" % (n_add, sum(1 for v in result.values() if v), n_rm))
    return result


def presentation_table(port, by):
    """The action -> (BBTAG state, start s, end s, clip scale) table wire() uses for presentation actions."""
    return clip_windows(port, by, PRESENTATION)
