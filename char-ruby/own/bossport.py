"""bossport.py -- reusable toolkit for turning a boss's own data into a playable character (Redux).

A character generator (e.g. mods/char-nine/build_nine.py) describes WHAT the character is; this module does the HOW:
  * Port(...)              loads the boss logic, the donor's player flow (Ragna by default) and the boss's clip lengths
  * port.transplant()      a player state (stand, run, jump, hit reactions...) on the boss's own clip, cues and effects
  * port.own_action()      a boss move with boss-only privileges removed (armour, immunity buffs, arena teleports,
                           AI-only branches, arena-wide targeting, warnings); every script parameter remapped to the
                           character's own projectile ids / logic names
  * retime(action, k)      plays a move k times faster by scaling its WHOLE timeline (animation, hits, effects, sounds,
                           scripts, spawns, switches, motions with speeds rescaled so distances hold). Deterministic data,
                           no runtime buff. (Izanami 0.2-0.3 relied on the 1205_changestop buff and mashing broke.)
  * impact()               player hit feel (victim >> attacker hit-stop, light camera shake), from Ragna / Noel numbers
  * Refs / switch / call   new conditions (input held / released, MP, buff stacks, bullet count), switches, script calls
  * input rows             SkillActivate rows whose cancel windows come from the move's real hit timing
  * bullet trees           the character's own copies of the boss's projectile logic under player ids
  * assemble()             the ActionLogicGroup tree (with every referenced condition) + a report of every change
Engine rules behind the choices are in NOTES.md (2026-09-27 sections) and docs/tools/CHARACTER_TOOLKIT.md."""
import copy, io, json, os, re, collections

def _root(here):
    """The loader's folder: the nearest folder at or above this file that holds bbmod.py, else this file's own folder
    (2026-10-09: a character packed for a mod loader carries its own copy of this module inside its mod folder, and
    must still find the loader's data; in the workspace and in a standalone package the answer is what it was)."""
    p = here
    for _ in range(7):
        if os.path.exists(os.path.join(p, "bbmod.py")): return p
        p = os.path.dirname(p)
    return here
ROOT = _root(os.path.dirname(os.path.abspath(__file__)))
def _at(p):
    """a working file of the loader (the game data it read): under ROOT/temp when the loader keeps them there (The
    Zenith Terminal's migration-to-temp), else under ROOT"""
    q = os.path.join(ROOT, "temp", p)
    return q if os.path.exists(q) or os.path.isdir(os.path.join(ROOT, "temp", "decoded")) else os.path.join(ROOT, p)
FP = 4294967296.0
def fp(x): return {"value": int(round(x * FP))}
def fv(v): return v["value"] / FP if isinstance(v, dict) and "value" in v else (float(v) if isinstance(v, (int, float)) else 0.0)
def load(p): return json.load(io.open(p if os.path.isabs(p) else _at(p), encoding="utf-8"))
def logic(name):
    p = "decoded/assets/actor_logicdata_%s.ab__%s.json" % (name, name)
    if not os.path.exists(_at(p)):   # a player's machine (no research dump): read the INSTALLED build's bundle
        import sys
        argv, sys.argv = sys.argv, ["x"]
        import bbmod, UnityPy
        sys.argv = argv
        e = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry("actor/logicdata/%s.ab" % name))); e.typetree_generator = bbmod.typetree_gen()
        t = next(t for t in (o.read_typetree() for o in e.objects if o.type.name == "MonoBehaviour") if "_actions" in t)
        os.makedirs(os.path.dirname(_at(p)), exist_ok=True)
        io.open(_at(p), "w", encoding="utf-8").write(json.dumps(t, ensure_ascii=False))
    return load(p)
def rows(t):
    d = load("decoded/tables/%s.json" % t); return d if isinstance(d, list) else next(v for v in d.values() if isinstance(v, list))
def const(x): return {"UseExpression": 0, "ConstValue": x, "Expression": {"Source": ""}}

# ---------------------------------------------------------------- retime: scale a whole action timeline
# Paths are matched on the key path with list indices removed (".HitDataList.TickRange.Start" etc.).
_T_POINT = re.compile(r"(\.TotalDuration|\.AnimateDuration|\.ActionSwitchs\.TimeCheck\.(Start|End)|\.AddBuff\.Time|\.AddBuff\.Buff\.Duration|"
                      r"\.AddEffects\.Start|\.AddMotions\.Time|\.Motion\.(DurationEx|TimePerLoopEx|TrackDurEx|StartTimeOffsetEx)\.ConstValue|"
                      r"\.AddRoles\.TimeConfig\.(Start|End|Interval)|\.TimeRange\.(Start|Finish)|\.CDList\.Time|\.ChangeActorTag\.Time|"
                      r"\.CollideBoxs\.(Time|Duration)|\.GrabDamages\.Time|\.SetTarget\.Time|\.SpeedChanges\.Time|\.StartSpeed\.Time|"
                      r"\.TurnList\.Time|\.RemoveEffect\.Tick|\.HitDataList\.TickRange\.(Start|End|HitInterval)|"
                      r"\.(MuteSkills|RemoveBuff)\.(Time|TimeConfig\.(Start|End|Interval))|\.(ScriptCalls|Aurora)\.TimeConfig\.(Start|End|Interval))$")
_T_FLOAT = re.compile(r"(\.Audios\.Time|\.JoystickVibrate\.Time|\.CameraShake\.Time|\.WaterInteract\.Time)$")
_T_SPEED = re.compile(r"\.Motion\.(StartSpeedX|StartSpeedY|MaxSpeedEx|TrackInitSpeedEx)\.ConstValue$")
_T_ACCEL = re.compile(r"\.Motion\.(TrackAccelerateEx\.ConstValue|Gravity)$")
def retime(a, k):
    """Play action a k times faster (k > 1) by scaling its timeline. Sentinels (-1 intervals, 9999 'forever') are kept."""
    if abs(k - 1.0) < 1e-6: return a
    def walk(o, path):
        if isinstance(o, dict):
            for key, v in list(o.items()):
                p = path + "." + key
                if isinstance(v, dict) and set(v.keys()) == {"value"}:
                    x = fv(v)
                    if _T_POINT.search(p) and 0 < x < 900: o[key] = fp(x / k)
                    elif _T_SPEED.search(p): o[key] = fp(x * k)
                    elif _T_ACCEL.search(p): o[key] = fp(x * k * k)
                elif isinstance(v, float) and _T_FLOAT.search(p): o[key] = v / k
                else: walk(v, p)
        elif isinstance(o, list):
            for v in o: walk(v, path)
    walk(a, "")
    if a.get("EnableAnimationTimeMap") and (a.get("AnimationTimeMap") or {}).get("m_Curve"):
        for c in a["AnimationTimeMap"]["m_Curve"]:
            c["time"] /= k; c["inSlope"] *= k; c["outSlope"] *= k
    return a

def hit_window(a):
    """(first hit start, last hit end) in action seconds, from HitDataList; (None, None) if the move has no own hits."""
    h = [(fv(x["TickRange"]["Start"]), fv(x["TickRange"]["End"])) for x in a.get("HitDataList") or []]
    return (min(s for s, e in h), max(e for s, e in h)) if h else (None, None)

def active_window(a):
    """Like hit_window, but a move whose damage comes from spawned projectiles uses its first/last spawn time."""
    s, e = hit_window(a)
    spawns = [fv(r["TimeConfig"]["Start"]) for r in a.get("AddRoles") or [] if 0 <= fv(r["TimeConfig"]["Start"]) < fv(a["TotalDuration"])
              and not any("warning" in str(x.get("ConstValue")) for x in r.get("StartActionEx") or [])]   # a telegraph is not the spell
    spawns += [fv(c["TimeConfig"]["Start"]) for c in a.get("ScriptCalls") or []
               if c["TimeConfig"].get("StartType") == 1 and re.search(r"Create|ChangeAction", c["Call"]["Function"]) and fv(c["TimeConfig"]["Start"]) < fv(a["TotalDuration"])]
    if spawns:
        s = min([s] + spawns) if s is not None else min(spawns)
        e = max([e] + spawns) if e is not None else max(spawns)
    return s, e

# ---------------------------------------------------------------- hit feel
IMPACT = {"light": (0.12, 0.03, 0.15, 0.00, 0.10), "medium": (0.16, 0.04, 0.20, 0.00, 0.15),
          "heavy": (0.24, 0.05, 0.25, 0.05, 0.22)}      # victim stop, attacker stop, shake x, y, time (Ragna melee)
HEAVIER = {"light": "medium", "medium": "heavy", "heavy": "heavy"}
def impact(a, cls):
    hits = a.get("HitDataList") or []
    for i, h in enumerate(hits):
        c = HEAVIER[cls] if (len(hits) > 1 and i == len(hits) - 1) else cls
        v, at, sx, sy, st = IMPACT[c]
        for k2 in ("FreezeVictimGround", "FreezeVictimGroundMotion", "FreezeVictimFlying", "FreezeVictimFlyingMotion"): h["HitFreezeN"][k2] = fp(v)
        for k2 in ("FreezeAttacker", "FreezeAttackerMotion"): h["HitFreezeN"][k2] = fp(at)
        h["CamShake"] = {"Time": 0.0, "ShakeStr": {"x": sx, "y": sy}, "Duration": st}
    H = active_window(a)[0]
    if H is not None:   # impact effects finish on their own; wind-up effects still stop when the move is interrupted
        for e in a.get("AddEffects") or []:
            if e.get("KillMode") == 2 and fv(e.get("Start")) >= H - 0.08: e["KillMode"] = 0

def strip_victim_buffs(o, idxs):
    """Boss hits can put boss-only buffs on the VICTIM (Izanami: anti-combo armour; Nine: cutscene slow)."""
    if isinstance(o, dict):
        v = o.get("Victim")
        if isinstance(v, dict) and v.get("BuffList"): v["BuffList"] = [b for b in v["BuffList"] if b.get("Idx") not in idxs]
        for x in o.values(): strip_victim_buffs(x, idxs)
    elif isinstance(o, list):
        for x in o: strip_victim_buffs(x, idxs)

def projectile_impact(a, cls):
    """Spell projectiles: single strikes get player hit-stop on the victim (+ shake); continuous hitboxes (ticks longer
    than 0.3 s, e.g. a travelling wall) keep their small per-tick freeze so enemies are not stun-locked."""
    v, _, sx, sy, st = IMPACT[cls]
    for h in a.get("HitDataList") or []:
        if fv(h["TickRange"]["End"]) - fv(h["TickRange"]["Start"]) > 0.3: continue
        for k2 in ("FreezeVictimGround", "FreezeVictimGroundMotion", "FreezeVictimFlying", "FreezeVictimFlyingMotion"):
            h["HitFreezeN"][k2] = fp(max(fv(h["HitFreezeN"][k2]), v))
        if cls != "light": h["CamShake"] = {"Time": 0.0, "ShakeStr": {"x": sx, "y": sy}, "Duration": st}

# ---------------------------------------------------------------- building blocks
def switch(target, conds=None, start_type=3, nt=2, t0=0.0, t1=0.0, mode=0):
    """start_type 3 + nt 2 = at the end of the action; start_type 1 + [t0,t1] = while in that window."""
    return {"TimeCheck": {"StartType": start_type, "Start": fp(t0), "End": fp(t1), "NonTimeType": nt},
            "ConditionGroup": {"Combine": 0, "Conditions": conds or []}, "NewActionEx": const(target), "NewActionMode": mode,
            "SkillCheck": 13, "SkillGroup": 0, "NewActionWithAutoFace": 1, "ScriptCall": {"Function": "", "Params": ""}}
def call(t, fn, params, conds=None, start_type=1, nt=1):
    """start_type 1 = at time t; start_type 3 + nt 1/2/4 = on start / at the end / when interrupted."""
    return {"TimeConfig": {"StartType": start_type, "Start": fp(t), "End": fp(0), "Interval": fp(-1), "NonTimeType": nt},
            "ConditionGroup": {"Combine": 0, "Conditions": conds or []}, "Call": {"Function": fn, "Params": params}}
def buff(idx, t, dur, strength=1.0, conds=None):
    return {"Time": fp(t), "ConditionGroup": {"Combine": 0, "Conditions": conds or []},
            "Buff": {"Idx": idx, "Duration": fp(dur), "Strength": fp(strength), "Stack": 1, "ParamSet": ""}}
BIG = {"value": 42945377992704}   # the editor's "9999"

class Refs:
    """New condition references (the boss never needed them). Their classes must be in the output bundle's ref_types:
    pass refTypesFrom [rg (Input/GroundCheck/Trigger), bl (MP, Input), pt (BulletCount)] to the bundle clone."""
    def __init__(self, base): self.base, self.items = base, []
    def new(self, cls, data):
        rid = self.base + len(self.items)
        self.items.append({"rid": rid, "type": {"class": cls, "ns": "GamePlay", "asm": "Assembly-CSharp"}, "data": dict({"Invert": 0}, **data)})
        return {"rid": rid}
    def input(self, key, mode, sticky=0.0):   # InputCmd 1 Attack 3 Skill 5 Summon 55 Dash 800 Jump; mode 0 Pressed 2 Pressing 3 NotPressing
        return self.new("ActionLogicCondition_Input", {"InputKey": key, "InputKeyMode": mode, "InputStickyTime": fp(sticky), "InputStickyTimeEnd": fp(0)})
    def buff(self, bid, invert=0, stack_min=0, stack_max=None):
        return self.new("ActionLogicCondition_Buff", {"Invert": invert, "BuffId": bid, "Str": {"Min": fp(0), "Max": BIG},
                                                      "Stack": {"Min": fp(stack_min), "Max": fp(stack_max) if stack_max is not None else BIG}, "IncludeRootCaster": 0})
    def mp(self, lo, hi=100, slot=2): return self.new("ActionLogicCondition_MP", {"Slot": slot, "Min": fp(lo), "Max": fp(hi)})
    def ground(self, off): return self.new("ActionLogicCondition_GroundCheck", {"OffGroundCheck": off})   # 1 in the air, 2 on the ground
    def trigger(self, tid, invert=0):   # the character holds Potential/trigger tid (levels tid..tid+4); works from projectiles
        return self.new("ActionLogicCondition_Trigger", {"Invert": invert, "TriggerIdMin": tid, "TriggerIdMax": tid + 4, "IncludeRootCaster": 1, "CDCheck": 0})
    def hit(self, within=0.1):         # this actor hit something in the last `within` seconds
        return self.new("ActionLogicCondition_Hit", {"HitSuccTimeEllaps": fp(within), "HitSuccCheckType": 0})
    def inputdir(self, lr=0, down=0, up=0, invert=0):
        return self.new("ActionLogicCondition_InputDir", {"Invert": invert, "CheckLR": lr, "CheckDown": down, "CheckFront": 0, "CheckBack": 0, "CheckUp": up})
    def bullets(self, logic, tag, names, none=True):
        return self.new("ActionLogicCondition_BulletCount", {"Invert": 1 if none else 0, "BulletActionGroup": logic, "ActionNames": names,
                                                             "BulletTag": tag, "Min": 1, "Max": 999})

# Ragna's player states (the engine-facing flow: physics, timings, transitions the controller expects)
PLAYER_STATES = ["stand", "standby1", "standby2", "runStart", "run", "runBrake", "squat", "squat_loop", "squat_to_stand",
                 "standUp", "standUp2", "standUp_Dead", "quickStand", "reactive", "dash", "dashend", "dashAir", "dashAirend",
                 "behit_up", "behit_middle", "push_back", "push_back_2", "push_back_3", "push_back_4", "push_down", "push_down_2",
                 "push_down_3", "push_down_4", "push_back_show", "drop_down", "drop_start", "drop", "drop2", "AUpdrop", "jump_down",
                 "jump", "dropend", "dropend2", "dropend3", "dropend4", "reborn", "born", "born_start", "born_start_2", "pvp_born",
                 "dead", "dead_backup", "knockdown", "knockdown_loop", "knockdown_stand", "knockdown_todead", "winpose", "winpose2",
                 "StagePass", "drop_down_show", "dropend_show", "paid_show", "bornshow_standup", "bornshow_fall", "bornshow_fall_end"]
LOOPERS = {"stand", "run", "squat_loop", "drop", "drop2", "drop_down", "AUpdrop", "knockdown_loop", "drop_down_show"}

class Port:
    def __init__(self, boss, clips, bullet_ids, bullet_logic, fx_own=r"^(Monster/|Common/|Smoke/|smoke/|Scene/)",
                 boss_buffs=(), ai_flags=(), drop_scripts=(), skip=r"beifen|test|_clone|\(clone\)", donor="rg", target_box=(16, 8),
                 ref_base=9107000000000000001):
        self.B = logic(boss); self.R = logic(donor); self.boss = boss
        self.BA = {a["Name"]: a for a in self.B["_actions"]}; self.RA = {a["Name"]: a for a in self.R["_actions"]}
        self.BREF = {r["rid"]: r for r in self.B["references"]["RefIds"]}; self.RREF = {r["rid"]: r for r in self.R["references"]["RefIds"]}
        self.CLIPS = {k.lower(): (k, v) for k, v in load(clips).items()}
        self.BUL, self.BLOGIC = dict(bullet_ids), dict(bullet_logic)
        self.fx_own, self.boss_buffs, self.ai_flags = re.compile(fx_own), set(boss_buffs), set(ai_flags)
        self.drop_scripts, self.skip, self.target_box = set(drop_scripts), re.compile(skip), target_box
        self.rep = collections.defaultdict(list); self.refs = Refs(ref_base)
    def note(self, n, msg): self.rep[n].append(msg)
    def clip(self, name):
        k = self.CLIPS.get(name.lower())
        if not k: raise SystemExit("no clip " + name)
        return k[0], k[1]["frames"] / 60.0
    # -- parameters: own projectile ids / logic names, bounded targeting
    def fix_params(self, p):
        for o, n in self.BUL.items(): p = p.replace(str(o), str(n))
        for o, n in self.BLOGIC.items(): p = p.replace('"%s"' % o, '"%s"' % n)
        bx, by = self.target_box   # boss scans cover the arena (x:99); a player's targeting covers what she can see
        p = re.sub(r"\bx\s*:\s*99\b", "x:%d" % bx, p); p = re.sub(r"\by\s*:\s*99\b", "y:%d" % by, p)
        p = re.sub(r"\bsizex\s*:\s*99\b", "sizex:%d" % bx, p); p = re.sub(r"\bsizey\s*:\s*99\b", "sizey:%d" % by, p)
        return p
    def fix_all_params(self, o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "Params" and isinstance(v, str): o[k] = self.fix_params(v)
                else: self.fix_all_params(v)
        elif isinstance(o, list):
            for v in o: self.fix_all_params(v)
    def cond_info(self, c, own=True):
        r = (self.BREF if own else self.RREF).get(c["rid"])
        return (r["type"]["class"] if r else "", (r or {}).get("data", {}))
    # -- a player state on the boss's own clip
    def transplant(self, rn, clipname, own=None, dur=None):
        a = copy.deepcopy(self.RA[rn]); c, sec = self.clip(clipname)
        a["Animate"] = c; a["AnimateDuration"] = fp(dur or sec)
        if rn in LOOPERS: a["TotalDuration"] = fp(sec)
        elif dur: a["AnimateDuration"] = fp(dur)
        mine = self.BA.get(own) if own else None
        if mine is not None:
            a["Audios"] = copy.deepcopy(mine.get("Audios") or []); a["HitAudios"] = []
            a["AddEffects"] = [e for e in copy.deepcopy(mine.get("AddEffects") or []) if self.fx_own.match(((e.get("NameEx") or {}).get("ConstValue") or ""))]
            if dur:   # her move played over the donor's (shorter) timing: her cues and effects keep their place in it
                r = dur / max(0.01, fv(mine["TotalDuration"]))
                for x in a["Audios"]: x["Time"] = float(x.get("Time") or 0) * r
                for e in a["AddEffects"]: e["Start"] = fp(fv(e.get("Start")) * r)
        else:
            # also the donor's per-id select lines (vo_<actorId>_ready / _intro / _unlock), e.g. Ragna's vo_100101_ready
            a["Audios"] = [x for x in a.get("Audios") or [] if not re.search(r"(^|_)rg(_|$)|^vo_rg|^sfx_rg|^HB_|^vo_\d{6}_", x.get("Cue") or "")]
            a["AddEffects"] = [e for e in a.get("AddEffects") or [] if self.fx_own.match(((e.get("NameEx") or {}).get("ConstValue") or ""))]
        a["AddBuff"] = [b for b in a.get("AddBuff") or [] if not re.search(r"rg|skill_times|pvp", b["Buff"]["Idx"])]
        a["ScriptCalls"] = [s for s in a.get("ScriptCalls") or [] if s["Call"]["Function"] not in ("CreateBullet_summon",)]
        self.note(rn, "player flow on her clip %s (%.2fs)%s" % (c, sec, ", her cues/effects from " + own if mine else ""))
        return a
    # -- a boss move without boss-only privileges
    def own_action(self, a, keep_names, family_of=lambda n: re.sub(r"_.*$", "", n), helpers=()):
        a = copy.deepcopy(a); n = a["Name"]; dur = fv(a["TotalDuration"])
        self.fix_all_params(a)
        if a.get("Armors"): self.note(n, "boss armour removed (%s)" % max(x.get("Armor", 0) for x in a["Armors"])); a["Armors"] = []
        kept = [b for b in a.get("AddBuff") or [] if b["Buff"]["Idx"] not in self.boss_buffs and b["Buff"]["Idx"] not in self.ai_flags]
        if len(kept) != len(a.get("AddBuff") or []): self.note(n, "boss buffs removed: %s" % sorted({b["Buff"]["Idx"] for b in a["AddBuff"]} - {b["Buff"]["Idx"] for b in kept}))
        a["AddBuff"] = kept
        sc = []
        for s in a.get("ScriptCalls") or []:
            if s["Call"]["Function"] in self.drop_scripts: self.note(n, "script removed: " + s["Call"]["Function"]); continue
            keep, s["ConditionGroup"]["Conditions"] = self._gate(s["ConditionGroup"].get("Conditions", []))
            if keep: sc.append(s)
            else: self.note(n, "boss-only variant of %s removed" % s["Call"]["Function"])
        a["ScriptCalls"] = sc
        roles = []
        for r in a.get("AddRoles") or []:
            rid = r.get("RoleId") or {}
            if rid.get("ConstValue") in self.BUL: rid["ConstValue"] = self.BUL[rid["ConstValue"]]
            keep, r["ConditionGroup"]["Conditions"] = self._gate(r["ConditionGroup"].get("Conditions", []))
            if not keep: self.note(n, "boss-only spawn variant removed (%s)" % [x.get("ConstValue") for x in r.get("StartActionEx") or []]); continue
            pos = r.get("Position") or {}
            if pos.get("RefCenter", 0) >= 11:   # arena-bound spawn (edges / centre of the boss arena) -> around her
                self.note(n, "arena-bound spawn -> local (%s)" % [x.get("ConstValue") for x in r.get("StartActionEx") or []])
                pos["RefCenter"] = 0; pos["RefOffsetType"] = 1
            roles.append(r)
        a["AddRoles"] = roles
        fx = [e for e in a.get("AddEffects") or [] if not re.search(r"warning|caution|danger", ((e.get("NameEx") or {}).get("ConstValue") or ""), re.I)]
        if len(fx) != len(a.get("AddEffects") or []): self.note(n, "boss warning effects removed")
        a["AddEffects"] = fx
        out = []
        for s in a.get("ActionSwitchs") or []:
            tgt = (s.get("NewActionEx") or {}).get("ConstValue") or ""
            keep, conds = self._gate(s["ConditionGroup"].get("Conditions", []))
            internal = tgt == "" or family_of(tgt) == family_of(n) or tgt in helpers
            if tgt and tgt not in keep_names: self.note(n, "switch -> %s dropped (not in the player set)" % tgt); continue
            if not internal or not keep: self.note(n, "AI branch -> %s removed" % tgt); continue
            s["ConditionGroup"]["Conditions"] = conds; out.append(s)
        a["ActionSwitchs"] = out
        for f in ("NextAction", "DropAction", "DropEndAction", "DropEndHighAction", "OnGroundAction", "BeginFallAction", "DeadAction"):
            v = a.get(f) or ""
            if v and v not in keep_names: self.note(n, "%s %s -> ''" % (f, v)); a[f] = "dead" if f == "DeadAction" else ""
        return a
    def _gate(self, conds):
        """Boss decision conditions: a Script test ('is there a target', 'is the player near') or an AI bookkeeping
        buff. The positive branch is what the player gets (condition stripped); the negated fallback is dropped.
        Returns (keep the entry, remaining conditions)."""
        out, keep = [], True
        for c in conds:
            cls, d = self.cond_info(c)
            if cls == "ActionLogicCondition_Script" or (cls == "ActionLogicCondition_Buff" and d.get("BuffId") in self.ai_flags):
                if d.get("Invert"): keep = False
                continue
            out.append(c)
        return keep, out
    def fix_player_state(self, a, by, remap):
        """A transplanted player state's switches: the donor's names -> the character's, potential-gated routes and
        routes to donor-only moves removed."""
        out = []
        for s in a.get("ActionSwitchs") or []:
            t = (s.get("NewActionEx") or {}).get("ConstValue") or ""
            t2 = remap.get(t, t); keep_c = []; gated = False
            for c in s["ConditionGroup"].get("Conditions", []):
                r = self.RREF.get(c["rid"]); cls = r["type"]["class"] if r else ""
                if cls == "ActionLogicCondition_Trigger":
                    if not r["data"].get("Invert"): gated = True
                    continue
                keep_c.append(c)
            if gated: self.note(a["Name"], "donor potential route -> %s removed" % t); continue
            if t2 and t2 not in by: self.note(a["Name"], "switch -> %s dropped (donor-only)" % t); continue
            if t2 != t: s["NewActionEx"]["ConstValue"] = t2; self.note(a["Name"], "switch %s -> %s" % (t, t2))
            s["ConditionGroup"]["Conditions"] = keep_c; out.append(s)
        a["ActionSwitchs"] = out
        for f in ("NextAction", "DropAction", "DropEndAction", "DropEndHighAction", "OnGroundAction", "BeginFallAction", "DeadAction"):
            v = a.get(f) or ""
            if v and v not in by: a[f] = "dead" if f == "DeadAction" else ""
    # -- tree
    def assemble(self, acts, name):
        used = set()
        def walk(o):
            if isinstance(o, dict):
                if "rid" in o and len(o) == 1: used.add(o["rid"])
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(acts)
        refs = [r for r in self.B["references"]["RefIds"] if r["rid"] in used and r["type"]["class"]] + \
               [r for r in self.R["references"]["RefIds"] if r["rid"] in used and r["type"]["class"]] + \
               [r for r in self.refs.items if r["rid"] in used]
        missing = used - {r["rid"] for r in refs} - {-2}
        if missing: raise SystemExit("unresolved reference ids: %s" % sorted(missing)[:5])
        tree = {k: copy.deepcopy(v) for k, v in self.B.items() if not k.startswith("m_") and k not in ("_actions", "references")}
        tree.update({"m_Name": name, "ALGType": 0, "_actions": acts, "references": {"version": self.B["references"]["version"], "RefIds": refs}})
        return tree
    def bullet_tree(self, src, dst, extra=None):
        T = copy.deepcopy(logic(src))
        for a in T["_actions"]:
            self.fix_all_params(a)
            for r in a.get("AddRoles") or []:
                rid = r.get("RoleId") or {}
                if rid.get("ConstValue") in self.BUL: rid["ConstValue"] = self.BUL[rid["ConstValue"]]
        if extra: extra(T)
        T["m_Name"] = dst
        return {k: v for k, v in T.items() if not k.startswith("m_") or k == "m_Name"}
    def report(self, path, header):
        with io.open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(header + "\n\n")
            for n in sorted(self.rep): f.write("%s\n  - %s\n" % (n, "\n  - ".join(self.rep[n])))

def flow_len(n, by, family_of=lambda n: n.split("_")[0], seen=()):
    """Longest time the move runs through its own parts (NextAction and switches into the same family)."""
    a = by[n]; best = 0.0; fam = family_of(n)
    tg = [a.get("NextAction") or ""] + [(s.get("NewActionEx") or {}).get("ConstValue") or "" for s in a.get("ActionSwitchs") or []]
    for t in set(tg):
        if t and t in by and t not in seen and t != n and family_of(t) == fam:
            best = max(best, flow_len(t, by, family_of, seen + (n,)))
    return fv(a["TotalDuration"]) + best

def skill_row(actor, g, o, act, by, inp=None, d=None, pre=None, air=False, start=None, exit_=False, long=None, mute=None,
              tag2=1, sat=None, flow=None, window=None, jump=None, **kw):
    """One SkillActivate row with engine-correct timing (PlayerSkillChain, NOTES 2026-09-27):
    - cancel point (ActdurStrict) = last hit / spawn + 0.08 s: the next step of the SAME chain never cuts the current
      move before it lands (Noel's rule); other chains may take over after the first hit ('all' lock);
    - Timeout = the move's length + 0.35 s so the string survives the move's own recovery;
    - every row gets a Timeout (a step without one resets its chain at once)."""
    e = flow if flow is not None else fv(by[act]["TotalDuration"])
    H0, H1 = window if window is not None else active_window(by[act])   # window: (first, last) visual release, when
                                                                          # the spells are queued at the press
    if H0 is not None:
        strict = min(max(H1 + 0.08, 0.15), max(0.15, e - 0.02)); m = round(min(max(0.1, H0 - 0.02), strict), 2)
    else:
        strict = 0.75 * e; m = round(min(0.45, 0.5 * e), 2)
    if mute == "flow": m = strict = round(e, 2)
    elif mute is not None: m = mute
    r = {"$new": True, "ActorId": actor, "Group": g, "Order": o, "Action": act, "AllowActiveState": True, "AutoTurn": 1,
         "ActionpointInputTag": g, "ActionpointInputTag2": tag2}
    if air in (True, "both"): r["AllowFlying"] = True
    if air in (False, "both"): r["AllowGround"] = True
    if inp: r["Input"] = inp
    if d: r["InputDir"] = d
    if pre: r["PreSkillOrder"] = pre
    if start or (start is None and not pre): r["StartTrigger"] = ["Start_%d" % g]
    if exit_: r["ExitTrigger"] = ["End_%d" % g]
    if long: r["UseLongPress"] = True; r["LongPressStart"], r["LongPressEnd"] = long
    if sat: r["SatisfyInputkey"] = sat
    ml = {"all": m, "5": m if mute == "flow" else 0.01}
    if g == 1: ml["8"] = 0.38 if not pre else round(strict, 2)
    if g == 2: ml["3"] = 0.38 if not pre else round(strict, 2)
    if jump is not None: ml["7"] = jump
    r["Mutelist"] = ",".join('"%s":%s' % kv for kv in ml.items())
    r["Preinputtime"] = 0.35
    r["ActdurStrict"] = round(max(m, strict), 2)
    r["Timeout"] = round(e + 0.35, 2)
    r.update(kw)
    return r

# ---------------------------------------------------------------- spells that outlive the caster's action
# A spell has a RELEASE event (the moment it is committed). Anything the boss scheduled LATER in its own animation
# (a delayed projectile, a command telling an existing projectile to advance) dies if the player cancels after the
# release. These helpers move that work onto the projectiles so it resolves on its own:
#   wait_action(T, name, target, delay)   a projectile action that waits `delay` seconds, then becomes `target`
#   role(...)                              an AddRoles entry (spawn a projectile action) built from a template
#   target_spawn(...)                      spawn on the nearest enemy AHEAD (scan box in front), fixed forward fallback
#   self_drive(port, by, start, T)         replay the caster's sequence from `start`; every ScanBulletsAndChangeAction
#                                          (X -> Y at time t) becomes X's own duration + NextAction Y
def wait_action(template, name, target, delay):
    w = copy.deepcopy(template)
    for k in ("HitDataList", "AddEffects", "AddRoles", "ScriptCalls", "AddBuff", "AddMotions", "ActionSwitchs", "Audios",
              "HitAudios", "BehitBoxs", "OthersBlockMove", "CollideBoxs", "RemoveBuff", "RemoveEffect", "CameraShake"):
        if k in w: w[k] = []
    w["Name"] = name; w["TotalDuration"] = fp(max(0.01, delay)); w["NextAction"] = target; w["Animate"] = ""
    return w
def role(template, bullet_id, action, t, x=0.0, y=0.0, center=0, ground=None, gh=None, tag=""):
    """An AddRoles entry (spawn projectile `action` at time t) from a template role. ground/gh: UseGroundHeight and
    GroundHeight (height above the ground under the spawn point); None keeps the template's."""
    r = copy.deepcopy(template)
    r["TimeConfig"] = {"StartType": 1, "Start": fp(t), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1}
    r["ConditionGroup"] = {"Combine": 0, "Conditions": []}
    r["RoleId"] = const(bullet_id); r["StartActionEx"] = [const(action)]; r["TagV"] = const(tag)
    r["DuplicateEx"] = const(1)
    p = r["Position"]; p["RefCenter"] = center
    p["OffsetX"] = const(fp(x)); p["OffsetY"] = const(fp(y))
    if ground is not None: p["UseGroundHeight"] = ground
    if gh is not None: p["GroundHeight"] = fp(gh)
    return r
def root_action(template, name, roles, dur=0.1):
    """A projectile that only places other projectiles (e.g. created on the target, it spawns a strike above it)."""
    a = wait_action(template, name, "", dur); a["AddRoles"] = roles; return a
def next_of(a):
    """Where an action goes on its own: NextAction, or an unconditional switch at its end."""
    if a.get("NextAction"): return a["NextAction"]
    for w in a.get("ActionSwitchs") or []:
        tc = w["TimeCheck"]
        if tc.get("StartType") == 3 and tc.get("NonTimeType") == 2 and not w["ConditionGroup"].get("Conditions"):
            return (w.get("NewActionEx") or {}).get("ConstValue") or ""
    return ""
def target_spawn(t, bullet_id, action, ahead=16.0, below=2.0, above=8.0, fallback=(5.0, 1.0), anchor="Center"):
    """Nearest enemy inside a box in FRONT of the caster (local to her facing), chosen once at t; the projectile is
    created on it (anchor "Center" = the target's body centre). With no enemy in the box it is created at a fixed
    forward fallback (local offset). ScanTargetAndCreateBullet_MustCreate; the scan box is centre + FULL size
    (ActorTargetMgr.ScanTarget -> BattleTargetScanRange.SetCenterSize2, verified in the disassembly)."""
    return call(t, "ScanTargetAndCreateBullet_MustCreate",
                'center_x: %g, center_y: %g, x: %g, y: %g, bullet_id:%d,bullet_action: "%s", Mode:"Nearest", bindpos: "%s", '
                'noPlayerPos_x: %g, noPlayerPos_y: %g' % (ahead / 2.0, (above - below) / 2.0, ahead, above + below, bullet_id, action,
                                                          anchor, fallback[0], fallback[1]))
def release_waves(a, T, t_rel, template, prefix):
    """Projectile waves the caster spawns AFTER the release time t_rel are spawned AT t_rel as waiting projectiles
    (wait_action) that turn into the wave on schedule, so all waves come even if she is interrupted after t_rel."""
    P = {x["Name"]: x for x in T["_actions"]}; made = []
    for r in a.get("AddRoles") or []:
        t = fv(r["TimeConfig"]["Start"])
        if r["TimeConfig"].get("StartType") != 1 or t <= t_rel + 1e-6: continue
        for sx in r.get("StartActionEx") or []:
            tgt = sx["ConstValue"]; name = "%s_%s_%d" % (prefix, tgt, int(round((t - t_rel) * 1000)))
            if name not in P:
                w = wait_action(template, name, tgt, t - t_rel); T["_actions"].append(w); P[name] = w
            sx["ConstValue"] = name
        r["TimeConfig"]["Start"] = fp(t_rel); made.append("%.2fs" % t)
    return made
def self_drive(by, start, T, note=None, keep=()):
    """Simulate the caster's sequence from `start` (NextAction chain) together with the projectiles it spawns
    (their own NextAction chains and spawns). Every ScanBulletsAndChangeAction(BulletAction X -> Action Y) the caster
    issues at time t becomes X's own duration (t - when X was entered) + NextAction Y, and is removed from the caster,
    so the spell finishes on its own if she is interrupted after the release. Returns the list of changes."""
    P = {a["Name"]: a for a in T["_actions"]}
    entered, changes, q = {}, [], []
    def enter(x, t):
        if x not in P or (x in entered and entered[x] <= t): return
        entered[x] = t; a = P[x]
        for r in a.get("AddRoles") or []:
            if r["TimeConfig"].get("StartType") == 1:
                for sx in r.get("StartActionEx") or []: q.append((t + fv(r["TimeConfig"]["Start"]), "enter", sx.get("ConstValue")))
        if a.get("NextAction"): q.append((t + fv(a["TotalDuration"]), "enter", a["NextAction"]))
    t0, n, seen, cmds = 0.0, start, set(), []
    while n and n in by and n not in seen:
        seen.add(n); a = by[n]; dur = fv(a["TotalDuration"])
        for r in a.get("AddRoles") or []:
            if r["TimeConfig"].get("StartType") == 1:
                for sx in r.get("StartActionEx") or []: q.append((t0 + fv(r["TimeConfig"]["Start"]), "enter", sx.get("ConstValue")))
        for s in a.get("ScriptCalls") or []:
            c, tc = s["Call"], s["TimeConfig"]
            m = re.search(r'BulletAction:\s*"([^"]+)"\s*,\s*Action:\s*"([^"]+)"', c.get("Params", ""))
            if c["Function"] != "ScanBulletsAndChangeAction" or not m or "BulletTag" in c.get("Params", ""): continue
            st, nt = tc.get("StartType"), tc.get("NonTimeType")
            if st == 1: tt = fv(tc["Start"])
            elif nt in (1, 2): tt = 0.0 if nt == 1 else dur
            else: continue
            q.append((t0 + tt, "cmd", (m.group(1), m.group(2), a, s)))
        t0 += dur; n = next_of(a)
    while q:
        q.sort(key=lambda e: (e[0], e[1] != "cmd")); t, kind, v = q.pop(0)
        if kind == "enter": enter(v, t); continue
        x, y, a, s = v
        if x not in entered or y not in P or x in keep: continue
        d = max(0.02, t - entered[x]); P[x]["TotalDuration"] = fp(d); P[x]["NextAction"] = y
        a["ScriptCalls"] = [c for c in a["ScriptCalls"] if c is not s]
        changes.append("%s -> %s after %.2fs" % (x, y, d)); enter(y, t)
    if note and changes: note(start, "self-driven projectiles: " + "; ".join(changes))
    return changes
def anim_segment(a, keys):
    """Play part of a clip: keys = [(action time, animation time), ...] (linear between keys) via AnimationTimeMap."""
    curve = []
    for i, (t, v) in enumerate(keys):
        sl_in = (v - keys[i - 1][1]) / max(1e-6, t - keys[i - 1][0]) if i > 0 else 0.0
        sl_out = (keys[i + 1][1] - v) / max(1e-6, keys[i + 1][0] - t) if i + 1 < len(keys) else 0.0
        if i == 0: sl_in = sl_out
        if i + 1 == len(keys): sl_out = sl_in
        curve.append({"time": float(t), "value": float(v), "inSlope": sl_in, "outSlope": sl_out, "weightedMode": 0, "inWeight": 0.0, "outWeight": 0.3333333432674408})
    a["EnableAnimationTimeMap"] = 1
    a["AnimationTimeMap"] = {"m_Curve": curve, "m_PreInfinity": 2, "m_PostInfinity": 2, "m_RotationOrder": 4}

# ---------------------------------------------------------------- player pacing: trim the wind-up, commit on press
_T_SHIFT = re.compile(r"(\.ActionSwitchs\.TimeCheck\.(Start|End)|\.AddBuff\.Time|\.AddEffects\.Start|\.AddMotions\.Time|"
                      r"\.AddRoles\.TimeConfig\.(Start|End)|\.TimeRange\.(Start|Finish)|\.CDList\.Time|\.ChangeActorTag\.Time|"
                      r"\.CollideBoxs\.Time|\.GrabDamages\.Time|\.SetTarget\.Time|\.SpeedChanges\.Time|\.StartSpeed\.Time|"
                      r"\.TurnList\.Time|\.RemoveEffect\.Tick|\.HitDataList\.TickRange\.(Start|End)|"
                      r"\.(MuteSkills|RemoveBuff)\.(Time|TimeConfig\.(Start|End))|\.(ScriptCalls|Aurora)\.TimeConfig\.(Start|End))$")
def quicken(a, skip, k):
    """Skip the first `skip` seconds of the move (the boss's telegraph) and play the rest k times faster. Every
    time point shifts by -skip (clamped at 0), then the whole timeline is retimed; the animation is mapped through
    AnimationTimeMap so the clip starts `skip` in. Returns the new length."""
    total, anim = fv(a["TotalDuration"]), fv(a.get("AnimateDuration"))
    def walk(o, path):
        if isinstance(o, dict):
            for key, v in list(o.items()):
                p = path + "." + key
                if isinstance(v, dict) and set(v.keys()) == {"value"}:
                    x = fv(v)
                    if _T_SHIFT.search(p) and 0 < x < 900: o[key] = fp(max(0.0, x - skip))
                elif isinstance(v, float) and p.endswith(".Audios.Time"): o[key] = max(0.0, v - skip)
                else: walk(v, p)
        elif isinstance(o, list):
            for v in o: walk(v, path)
    walk(a, ""); a["TotalDuration"] = fp(max(0.05, total - skip))
    a["EnableAnimationTimeMap"] = 0; a["AnimationTimeMap"] = {"m_Curve": [], "m_PreInfinity": 2, "m_PostInfinity": 2, "m_RotationOrder": 4}
    retime(a, k); T = fv(a["TotalDuration"])
    a["AnimateDuration"] = fp(anim)
    anim_segment(a, [(0.0, skip), (T, skip + T * k)])
    return T

def _role_events(a, t0):
    ev = []
    for r in a.get("AddRoles") or []:
        tc = r["TimeConfig"]; t = fv(tc["Start"])
        if tc.get("StartType") == 1 and t < fv(a["TotalDuration"]) and t < 50: ev.append(("role", t0 + t, r))
    for c in a.get("ScriptCalls") or []:
        tc = c["TimeConfig"]
        if c["Call"]["Function"].startswith("ScanTargetAndCreate") and tc.get("StartType") == 1: ev.append(("call", t0 + fv(tc["Start"]), c))
    return ev
def flow_of(by, start):
    """[(action, start time)] along NextAction / unconditional end switches, stopping at loops."""
    out, t0, n, seen = [], 0.0, start, set()
    while n and n in by and n not in seen:
        seen.add(n); out.append((by[n], t0)); t0 += fv(by[n]["TotalDuration"]); n = next_of(by[n])
    return out
def commit_on_press(by, starts, T, tmpl, prefix="nine_q", keep_first=0.02, tid=None):
    """Commit a cast when it starts: every projectile its flow spawns (and every target placement it makes) is queued
    at t = 0 of the first action as a waiting projectile that becomes the spell at its original time. Interrupting
    the caster (dash, jump, hit) then only cuts the animation. `starts` share later actions (e.g. ground/air
    versions), so events are collected for every start before they are removed. Returns {start: [event times]}."""
    P = {x["Name"]: x for x in T["_actions"]}
    per, owned = {}, []
    for s in starts:
        evs = []
        for a, t0 in flow_of(by, s): evs += [(k, t, o, a) for k, t, o in _role_events(a, t0)]
        per[s] = evs; owned += evs
    for k, t, o, a in owned:
        lst = a["AddRoles"] if k == "role" else a["ScriptCalls"]
        if any(x is o for x in lst): lst[:] = [x for x in lst if x is not o]
    out = {}
    for s in starts:
        first = by[s]
        for k, t, o, a in per[s]:
            if k == "role":
                r = copy.deepcopy(o); r["TimeConfig"]["Start"] = fp(0)
                if t > keep_first:
                    tgt = r["StartActionEx"][0]["ConstValue"]; name = "%s_%s_%d" % (prefix, tgt, int(round(t * 1000)))
                    rid = (r.get("RoleId") or {}).get("ConstValue")
                    if tid is not None and rid != tid:   # another projectile logic: wait here, then a spawner makes it
                        sp = name + "_spawn"
                        if sp not in P:
                            child = copy.deepcopy(o); child["TimeConfig"]["Start"] = fp(0); child["ConditionGroup"]["Conditions"] = []
                            child["Position"]["OffsetX"] = const(fp(0)); child["Position"]["OffsetY"] = const(fp(0))
                            P[sp] = root_action(tmpl, sp, [child]); T["_actions"].append(P[sp])
                        tgt = sp; r["RoleId"] = const(tid)
                    if name not in P: P[name] = wait_action(tmpl, name, tgt, t); T["_actions"].append(P[name])
                    r["StartActionEx"] = [const(name)] + r["StartActionEx"][1:]
                first["AddRoles"] = (first.get("AddRoles") or []) + [r]
            else:   # a placement call: a waiting projectile at her position makes it later (it scans from where she cast)
                c = copy.deepcopy(o); c["TimeConfig"]["Start"] = fp(0)
                if t <= keep_first:
                    first["ScriptCalls"] = (first.get("ScriptCalls") or []) + [c]; continue
                m = re.search(r'bullet_action:\s*"([^"]+)"', c["Call"]["Params"])
                caller = "%s_call_%s_%d" % (prefix, m.group(1) if m else "x", int(round(t * 1000)))
                if c["ConditionGroup"].get("Conditions"): caller += "_c%d" % (abs(c["ConditionGroup"]["Conditions"][0]["rid"]) % 100000)
                if caller not in P:
                    P[caller] = wait_action(tmpl, caller, "", 0.1); P[caller]["ScriptCalls"] = [c]; T["_actions"].append(P[caller])
                    w = wait_action(tmpl, caller + "_w", caller, t); P[w["Name"]] = w; T["_actions"].append(w)
                r0 = _ROLE0(tmpl_role(by), caller + "_w")
                r0["ConditionGroup"]["Conditions"] = list(c["ConditionGroup"].get("Conditions") or [])   # checked on her side
                P[caller]["ScriptCalls"][0]["ConditionGroup"]["Conditions"] = []
                first["AddRoles"] = (first.get("AddRoles") or []) + [r0]
        out[s] = [round(t, 3) for _, t, _, _ in per[s]]
    return out
def tmpl_role(by):
    """Any plain local spawn in the character's moves (used as a template for new AddRoles entries)."""
    for a in by.values():
        for r in a.get("AddRoles") or []:
            if r["Position"]["RefCenter"] == 0 and not r["Position"]["OffsetX"].get("UseExpression"): return r
    raise SystemExit("no role template")
def _ROLE0(tmpl, action):
    r = copy.deepcopy(tmpl); r["TimeConfig"] = {"StartType": 1, "Start": fp(0), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1}
    r["ConditionGroup"] = {"Combine": 0, "Conditions": []}; r["StartActionEx"] = [const(action)]; r["DuplicateEx"] = const(1)
    r["Position"]["OffsetX"] = const(fp(0)); r["Position"]["OffsetY"] = const(fp(0)); r["Position"]["UseGroundHeight"] = 0
    r["TagV"] = const(""); return r
def move_cancel(a, t, cond):
    """Walking (left/right held) ends the move from t on: the recovery can be cut by movement, like a player move."""
    a["ActionSwitchs"] = (a.get("ActionSwitchs") or []) + [switch("", [cond], start_type=1, nt=1, t0=t, t1=99.0)]
