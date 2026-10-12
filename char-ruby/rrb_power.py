"""rrb_power.py -- Ruby's power stages and the Cross Tag Ultra rework (the lead, 2026-09-30).

Power stages. The more Potentials she holds, the bigger her moves get:
  stage 1  fewer than STAGE2 cards        base Ruby
  stage 2  STAGE2 cards or more           every scythe move also throws a bigger slash (STAGE[2])
  stage 3  STAGE3 cards and all four Universal cards: near full-screen, Naoto-sized slashes (STAGE[3]); her rounds
           become the High Caliber rounds (ReplaceBulletAction, the stock idiom of Hibiki's and Naoto's upgrades)
The count runs in src/rrb_runtime.js (rrbStage) whenever she enters stand / run (rrb_stagechk), and sets rrb_stage2 /
rrb_stage3 on her. Each scythe move (and all its card variants) spawns its stage slash at its first hit, gated by the
stage buff: a bullet in rrbb1 with the move's hit box and its own arcs, scaled.

Petal Burst (BBTAG 236BC): the enemies she rips through are held in place (rrb_pb_hold), then a rose gust sweeps the
screen: a screen-wide multi-hit wind (rrb_gust_wind) and a push that carries enemies along her dash (rrb_gust,
rrbGust). A recreation of Rachel's screen wind in Ruby's own petals; Rachel's own wind effect is added only for players
who own Rachel (rrb_has_rc, set by rrbStage from the game's own unlock check). With Semblance (her rose-petal card)
the gust lasts longer and pushes harder.

Buzzsaw EX (hold): the landing fires a real round along the ground (BBTAG: the strong versions shoot, not only a
shockwave).
"""
import copy, math, os, re

STAGE2, STAGE3 = 4, 24             # (stage 2 at 4 cards since 2026-10-03, was 8: "stronger early game")
# the moves that throw a stage slash: her scythe moves, and (2026-10-03) Reaper's Hook's two strikes, which had a
# crescent's shape (rrb_fx.WAVE2_MOVES) and no bullet. Buzzsaw's landing threw one until 2026-10-10 (the lead: "remove
# that weird one that doesn't fit on landing")
STAGE_EXTRA = ("rrb_hook_exe", "rrb_hook_back")
# Stage 2's own look (2026-10-03). Its extra hit had nothing drawn for it in a release build. Each swing now throws the
# move's own crescent (the stage 3 projectile's effects) at STAGE2_K of its size, STAGE2_V u/s, until its leading edge
# reaches the end of the stage 2 reach (at least STAGE2_MIN u), and it breaks there. A second bullet that hits nothing
# carries it (<move>_v2): the stage 2 hit bullet (<move>_w2) is as it was.
STAGE2_WAVE = True
STAGE2_K, STAGE2_V, STAGE2_MIN = 0.55, 14.0, 0.9
V2_WANTED = set()                  # the moves whose actions spawn a <move>_v2 (moves fills it, wave_boxes builds them)
# the stage-up flourish: the break of Rising Reap's projectile (its crescent stands 0.77 u ahead of the bullet's origin:
# gen/wave2.json "centre"), played on her by the buffs rrb_stageup2 / rrb_stageup3
STAGE_UP_FX, STAGE_UP_X = "Role/Rrb/wave_rrb_launcher_s3x", 0.77
UNIVERSAL = ("crescent_mastery", "high_caliber", "semblance", "silver_eyes")
# k: hit box and arc scale about her; ky: height; dmg: the slash's damage as a share of the move's; feel: its reaction
# (0.5.0 test, the lead: the slashes look good and their range is close; slightly smaller, nearer Naoto's scale. The box
#  and the arc keep one scale, so the hit matches what is drawn.)
# (the lead, 2026-10-02: stage 3 "like way full screen and bigger like it was in previous tests": the slashes on rrb_slash
#  showed part of the arc and less reach than the old ribbons; stage 3 reaches further)
# stage 2: the slash itself x1.5 (rrb_fx.STAGE_SLASH_SCALE) and its hit reaches as far; stage 3: x2.0, and a slash
# projectile (pk: its crescent's size against the swing, speed u/s, flight s) flies on through enemies and fades
STAGE = {2: dict(k=1.5, ky=1.5, dmg=0.35, feel="light"), 3: dict(k=2.0, ky=2.0, dmg=0.6, feel="knock", pk=1.8, speed=24.0, flight=0.42)}
SLASH_T = 0.04                     # the slash bullet's hit, after it spawns (its arcs at 0)
THRUST_LEN = 0.98                  # u: the kit's rrb_thrust line, grip to tip (fxkit_cross RubyVFX.BuildThrust)
CHORD_SAFE = 0.10                  # s: an Attack move's stage slash never spawns before this (a chord's second button)
WIPES = (0.0, 0.35, 0.7)           # s: the wind fronts of rrb_petal_storm / rrb_petal_gust (fxkit_cross RubyVFX.Wipes)
GUST_T, GUST_DUR, GUST_DUR_U = 1.95, 1.3, 2.0     # Petal Burst: the gust after the dash-through (s)
GUST_PUSH, GUST_PUSH_U = 9.0, 14.0                # the carry speed (u/s), with Semblance
RC_WIND = "Role/Rc/rc_summon_wind_001"            # Rachel's screen wind (owners of Rachel only)
# Holds (the lead, 2026-10-02: "GUILLOTINE needs to lock the enemy in place"; Red Reaper's first target "locked into a
# certain position so it looks like all the hits are hitting it, just like in bbtag"): hold_moves, hold_buffs, rrb_runtime
GUIL_HOLD, RR_HOLD, RR_HOOK = "rrb_guil_hold", "rrb_rr_hold", "rrb_rr_hook"
HOOK_HOLD = "rrb_hook_hold"   # Reaper's Hook (0.8.0): the hooked enemy, held a set distance in front of her until the last strike
GUIL_CARRY = True         # the held enemy keeps its offset from her (carried through her 2.5 u advance, as BBTAG's
                          # MultiAssault keeps the opponent in the spin); False = pinned where it was cut (world)
HOLD_MARGIN = 0.25        # s a Guillotine hold outlasts the gap to the next cut (her hit-stop stretches action time)
HOLD_MARGIN_LAST = 0.08   # s past the releasing cut, should its RemoveBuff not reach the target (the hold then lapses)
RR_PIN = None             # None: Red Reaper holds its target where the dive kick found it (no snap); (x, y) u: at
                          # that point ahead of her root, along her facing
RR_T0, RR_REL = [1.25], [4.70]   # s into Red Reaper: its dive kick; the pin's end, just before the final slash (hold_moves)
# Red Reaper's dive (BBTAG: a teleport and a 12.7 u/s dive, about 8-10 u; the port's dive was 1 frame, 2.8 u, in place
# while Petal Burst's scan picked targets 16 u away): the dive kick now travels RR_DIVE u over its window and hits all
# along it, so the target the scan found (RR_SCAN u) is the one it meets; the pinned target rides the rest of the dive.
# Cross Tag's whiff exit: no hit by RR_MISS[0] s (none in the last RR_MISS[1] s) -> back to neutral
RR_DIVE = dict(t0=1.25, t1=1.60, dx=5.0)
RR_SCAN = 8
RR_MISS = (2.35, 1.15)
SPECS = []


def _first_hit(B, a):
    hs = a.get("HitDataList") or []
    return min((B.fv(h["TickRange"]["Start"]) for h in hs), default=None), (hs[0] if hs else None)


def moves(B, port, by, P):
    """P: rrb_pots (T, cg, POT, SCYTHE, UNLEASHED). Adds the stage slashes' spawns to every scythe move and variant,
    the Petal Burst hold and gust, the Buzzsaw EX round."""
    fp, fv = B.fp, B.fv
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    stage_ref = lambda s: port.refs.buff("rrb_stage%d" % s)
    made = 0
    import rrb_fx
    V2_WANTED.clear()
    stage_moves = tuple(P.SCYTHE) + tuple(b for b in STAGE_EXTRA if b not in P.SCYTHE)
    for base in stage_moves:
        if base not in by: continue
        t0, h = _first_hit(B, by[base])
        if h is None: continue
        arcs = [copy.deepcopy(e) for e in by[base].get("AddEffects") or [] if e["NameEx"]["ConstValue"].startswith("Role/Rrb/arc_")]
        hb = h["HitBox"]; box = [fv(hb["Min"]["x"]), fv(hb["Min"]["y"]), fv(hb["Max"]["x"]), fv(hb["Max"]["y"])]
        # an Attack move can be the first button of a chord (Attack + Summon: Petal Burst): its slash spawned 0.04 s
        # before its hit, inside the 0.14 s chord window, so a quick chord fired 5A's stage 3 reach line and hit before
        # Petal Burst took over (0.6.2 game test, 2026-09-30). Early ones spawn at the hit instead (the slash lands 0.04 s
        # after it), after a two-finger press has switched away
        # (0.8.0: with the chords off, P.SP_INPUTS False, nothing needs that wait, and it made the slash of her fastest
        #  Attack moves 0.04 s late: a tester, 2026-10-03, "the red waves that she shoots out after her scythe swings
        #  being a bit delayed". Every slash now leaves so that it lands with its swing's hit)
        born = lambda tn: tn if P.SP_INPUTS and base in P.ATTACK_MOVES and tn - SLASH_T < CHORD_SAFE else max(0.0, tn - SLASH_T)
        for s, S in STAGE.items():
            name = "%s_w%d" % (base, s)
            SPECS.append(dict(name=name, base=base, box=box, arcs=arcs, arc_t=min((fv(e["Start"]) for e in arcs), default=t0), s=s, t0=t0,
                              born=born(t0)))
        for n, a in by.items():
            if not (n == base or n.startswith(base + "_")) or n.endswith(("_w2", "_w3")): continue
            if any(b2 != base and len(b2) > len(base) and (n == b2 or n.startswith(b2 + "_")) for b2 in stage_moves): continue   # (rrb_clash_chase1 is its own base, not rrb_clash's)
            tn, _ = _first_hit(B, a)
            if tn is None: continue
            for s in STAGE:
                r = B.bp.role(role_t, B.BID, "%s_w%d" % (base, s), born(tn), 0.0, 0.0)
                r["ConditionGroup"] = P.cg([stage_ref(s)])
                a.setdefault("AddRoles", []).append(r); made += 1
            if STAGE2_WAVE and base in rrb_fx.WAVE2_MOVES:      # stage 2: the short crescent (wave_boxes builds <base>_v2)
                r = B.bp.role(role_t, B.BID, base + "_v2", born(tn), 0.0, 0.0)
                r["ConditionGroup"] = P.cg([stage_ref(2)])
                a.setdefault("AddRoles", []).append(r); V2_WANTED.add(base)
    port.note("rrb_a1", "power stages: %d stage-slash spawns on %d moves (and their variants)" % (made, len(stage_moves)))
    gun_levels(B, port, by, P, role_t)
    jc_triple(B, port, by, P, role_t)
    # (a tester, 2026-10-07: the red slashes come off the aerial kick.) Double Kick is a kick: no slash
    for n_, a_ in by.items():
        if n_ == "rrb_j2a" or n_.startswith("rrb_j2a_"):
            a_["AddRoles"] = [r for r in a_.get("AddRoles") or []
                              if not re.match(r"^rrb_j2a(_w\d|_v2)$", str((r.get("StartActionEx") or [{}])[0].get("ConstValue", "")))]
    clash_stage4(B, port, by, P, role_t)

    # Petal Burst: hold whoever she rips through until the gust, then the gust
    # (the upgrade: Semblance, her rose-petal card; Unleashed has no trigger to test)
    ul = P.T(B, port, "semblance")
    nul = port.refs.trigger(P.POT["semblance"] * 10 + 1, invert=1)
    buff = B.bp.buff
    for n in ("stand", "run"):          # the count, each time she's back in neutral
        if n in by: by[n].setdefault("AddBuff", []).append(buff("rrb_stagechk", 0.0, 0.1))
    for n, a in by.items():
        if not (n == "rrb_petalburst" or n.startswith("rrb_petalburst_")): continue
        for h in a.get("HitDataList") or []:
            dragged = "_grav" in n and B.fv(((h.get("Victim") or {}).get("Speed") or {}).get("x") or {"value": 0}) > 20.0
            if B.fv(h["TickRange"]["Start"]) < GUST_T and not dragged:      # (audit 140053: the hold pinned what the drag carries)
                h.setdefault("AttackerCalls", []).append(P.attacker_call(B, "AddBuff", 'buff:"rrb_pb_hold",durOverride:%.2f,hit_target:1' % (GUST_T + 0.15 - B.fv(h["TickRange"]["Start"]))))
        a.setdefault("AddBuff", []).extend([buff("rrb_gust", GUST_T, GUST_DUR, strength=GUST_PUSH, conds=[nul]),
                                            buff("rrb_gust", GUST_T, GUST_DUR_U, strength=GUST_PUSH_U, conds=[ul])])
        for wind, conds in (("rrb_gust_wind", [nul]), ("rrb_gust_wind_u", [ul])):
            r = B.bp.role(role_t, B.BID, wind, GUST_T, 0.0, 0.0); r["ConditionGroup"] = P.cg(conds)
            a.setdefault("AddRoles", []).append(r)
        e = B.fx_entry(port, RC_WIND, GUST_T, scale=1.0, attached=False); e["KillMode"] = 0
        e["ConditionGroup"] = P.cg([port.refs.buff("rrb_has_rc")]); a.setdefault("AddEffects", []).append(e)
        if fv(a["TotalDuration"]) < GUST_T + GUST_DUR_U:
            a["TotalDuration"] = fp(max(fv(a["TotalDuration"]), GUST_T + 0.6))
    finishers(B, port, by, P)
    port.note("rrb_petalburst", "Cross Tag rework: hold on hit, rose gust at %.2f s (%.1f s, %.0f u/s; Unleashed %.1f s, %.0f u/s); Rachel's wind for her owners" % (GUST_T, GUST_DUR, GUST_PUSH, GUST_DUR_U, GUST_PUSH_U))

    guns(B, port, by, P)

    # Buzzsaw EX: the landing shoots a round along the ground
    lx = by.get("rrb_buzzsaw_land_ex")
    if lx:
        tl, _ = _first_hit(B, lx)
        lx.setdefault("AddRoles", []).append(B.bp.role(role_t, B.BID, "b7", (tl or 0.05), 0.9, 0.55))
        lx.setdefault("AddEffects", []).append(dict(B.fx_entry(port, "Role/Rrb/rrb_muzzle_heavy", (tl or 0.05), dx=0.9, dy=0.55, attached=True), KillMode=1))
        port.note("rrb_buzzsaw_land_ex", "Buzzsaw EX: the landing fires a round (b7) along the ground")
    buzzsaw_levels(B, port, by, P)
    # the Summon-first chords' own copies of the SP moves (every gated row needs a move of its own: rrb_pots.rows_v2)
    for n in ("rrb_petalburst", "rrb_petaldance"):
        c = copy.deepcopy(by[n]); c["Name"] = n + "_d"; by[c["Name"]] = c


# ---------------------------------------------------------------- the gun payoffs (the lead, 2026-09-30)
# Stage 3 Rifle Shot (tap Skill): a three-round burst, one recoil per round (clip rifle_burst repeats the fire +
# recoil frames 3-4 of BBTAG's Shot: rounds 8 ticks apart). Stage 3 Sy-Pod (hold Skill): five heavy rounds (clip
# sypod_five repeats the fire block, frames 13-17 of AttackAndShotB, three more times: 21 ticks apart before the 0.75
# retime). Every round has its muzzle flash, ring, casing and shot sound on its own firing tick; the screen shake is
# per round, light on the early rounds of a sequence and heavier on the last (limits for rapid fire).
BURST_GAP = 8 / 60.0
FIVE_GAP = 21 / 60.0 * 0.75
SHAKE_BURST = [(0.09, 0.07, 0.07), (0.09, 0.07, 0.07), (0.20, 0.13, 0.12)]          # (x, y, seconds) per round
SHAKE_FIVE = [(0.22, 0.15, 0.12)] * 4 + [(0.34, 0.22, 0.18)]
MAX_ROUNDS = {"b7_max": dict(src="b7_hcp", box=1.25, speed=84.0, armor=7, shake=(0.24, 0.13, 0.10), dmg=(1.5, 1)),   # (0.9.0: 3.2 -> 1.5 a round)
              "s4_max": dict(src="s4_hc", box=1.35, speed=48.0, armor=9, shake=(0.34, 0.2, 0.14), dmg=(3.4, 1))}


def _shot_parts(B, a, t0, dt=0.075):
    """the entries of one shot fired at t0: its effects (muzzle, ring, skid, casing and their Dust colours) and sounds"""
    fv = B.fv
    fx = [e for e in a.get("AddEffects") or [] if t0 - 0.01 <= fv(e["Start"]) <= t0 + dt and
          any(k in e["NameEx"]["ConstValue"] for k in ("muzzle", "ring", "skid", "casing"))]
    au = [x for x in a.get("Audios") or [] if t0 - 0.01 <= float(x.get("Time") or 0) <= t0 + dt and not (x.get("Cue") or "").startswith("vo_")]
    return fx, au


def _sequence(B, a, t0, times, rounds, shakes, scale=1.0):
    """fire `rounds` at `times` (the first at t0, whose effects and sounds are copied to the others); one shake each"""
    fp, fv = B.fp, B.fv
    fx, au = _shot_parts(B, a, t0)
    role = next((r for r in a.get("AddRoles") or [] if abs(fv(r["TimeConfig"]["Start"]) - t0) < 0.02), None)
    a["AddRoles"] = [r for r in a.get("AddRoles") or [] if abs(fv(r["TimeConfig"]["Start"]) - t0) >= 0.02 and
                     (r.get("StartActionEx") or [{}])[0].get("ConstValue") not in ("b7", "b7_fire", "b7_hc", "s4", "s4_hc")]
    for e in fx:
        for ax in ("x", "y"):
            e["Scale"][ax] = fp(fv(e["Scale"][ax]) * scale)
    names = {e["NameEx"]["ConstValue"] for e in fx}
    for t, rnd in zip(times, rounds):
        r = copy.deepcopy(role)
        r["TimeConfig"]["Start"] = fp(t); r["TimeConfig"]["End"] = fp(t); r["ConditionGroup"] = {"Combine": 0, "Conditions": []}
        r["StartActionEx"][0]["ConstValue"] = rnd
        a["AddRoles"].append(r)
        if abs(t - t0) < 1e-6: continue
        # this round's flash, ring and casing: the first round's, moved here (a shot the clip already had loses its
        # own, so none doubles)
        # (window to 0.09: Sy-Pod's own second casing sits 0.076 s after its round, and the audit found it doubled)
        a["AddEffects"] = [e for e in a["AddEffects"] if not (e["NameEx"]["ConstValue"] in names and t - 0.01 <= fv(e["Start"]) <= t + 0.09)]
        for e in fx:
            c = copy.deepcopy(e); c["Start"] = fp(fv(e["Start"]) - t0 + t); a["AddEffects"].append(c)
        # its gunshot: the stock gun cue, which rrb_sound turns into her own gunshot unless her clip already has a
        # shot cue there (one sound per round, never two)
        B.sfx(a, "sfx_no_attack7", t)
    a["CameraShake"] = [c for c in a.get("CameraShake") or [] if not (t0 - 0.02 <= float(c["Time"]) <= times[-1] + 0.2)]
    a["CameraShake"] += [{"Time": float(t), "ShakeStr": {"x": sx, "y": sy}, "Duration": du} for t, (sx, sy, du) in zip(times, shakes)]


def _shift_after(B, a, t, ext):
    """everything in `a` after t moves ext later (the clip grew by ext before it)"""
    fp, fv = B.fp, B.fv
    for e in a.get("AddEffects") or []:
        if fv(e["Start"]) > t: e["Start"] = fp(fv(e["Start"]) + ext)
    for x in a.get("Audios") or []:
        if float(x["Time"]) > t: x["Time"] = float(x["Time"]) + ext
    for h in a.get("HitDataList") or []:
        if fv(h["TickRange"]["Start"]) > t:
            h["TickRange"]["Start"] = fp(fv(h["TickRange"]["Start"]) + ext); h["TickRange"]["End"] = fp(fv(h["TickRange"]["End"]) + ext)


# her gun strikes' power stages (the lead, 2026-10-02: "her air attacks dont have level 3 versions"; Clash Assault "should
# work exactly like her air gun attack does"): j.C and Clash Assault fire one heavy shot down and ahead. From stage 2 the
# shot bursts where it lands, GUN_REACH u down its line from the muzzle (a blast that hits round it); stage 3's is larger
# and knocks away. {stage: (zone, hit box about the burst, effect scale, damage ratio, camera shake)}
GUN_REACH = 1.3
GUN_LV = {2: ("rrb_gunlv2", (-1.5, -0.7, 1.5, 1.6), 1.25, 0.7, 0.16), 3: ("rrb_gunlv3", (-2.3, -0.9, 2.3, 2.4), 1.8, 1.3, 0.26)}
GUN_STRIKES = ("rrb_jc", "rrb_clash")
# j.C's Dust round (the lead, 2026-10-02: 'at stage 2 the last hit of her air chain where she fires her gun a piercing
# large sypod bullet should come out of her gun diagonally that is guaranteed to apply the full dust effect'). From stage 2
# j.C fires a Sy-Pod-type round from its muzzle along the shot (DirAngleV in degrees, relative to facing: stock es
# attackC_Air -> C1 at -45, jn skillBowAirEX -> H at -39). It pierces (b7_max's rule: no break on hit, each enemy once)
# and bursts where it meets the floor (CollisionSwitchList), catching grounded enemies. rrbDustHit gives every hit of
# these actions (RRB_POWER.full) the loaded Dust's full effect; with no Dust it is a heavy neutral round. It replaces the
# stage 2 / 3 zones j.C spawned 1.3 u down the shot (Clash Assault keeps them). Numbers: proposals.
JC_ROUNDS = {2: dict(rnd='s4_jc', floor='s4_jc_floor', half=1.3, speed=40.0, fx=1.6, dmg=1.9,
                     box=(-1.5, -0.7, 1.5, 1.6), bfx=1.25, bdmg=0.7, shake=0.16),
             3: dict(rnd='s4_jc3', floor='s4_jc3_floor', half=1.7, speed=48.0, fx=2.0, dmg=3.4,
                     box=(-2.3, -0.9, 2.3, 2.4), bfx=1.8, bdmg=1.3, shake=0.26)}
JC_ANGLE = -49.7                 # degrees, if the muzzle effect's rotation is unreadable
# the Dust on her gunfire (the lead, 2026-10-02: 'dust bullet effects still dont apply when they should during sypod or
# rifle tap shots'). rrbDustHit tells the shot from the hit's attacker action:
DUST_FULL_RE = '^s4_jc'                                  # j.C's round and its floor burst: the full effect
DUST_GUN_RE = '^(b7|s4|rrb_dustround)(?![a-z0-9_]*end)'  # her flying rounds (not their breaks): GUN_DOSE doses a hit
GUN_DOSE = 2                     # proposal; 1 = one dose a round, as 0.6.13
FULL_FIRE = (4.0, 45.0)          # the full Burn: s, damage a second (stock buffzone fireboom 1116: 45)
FULL_PULL = (3.0, 0.6)           # the full Gravity pull: up to 3 u toward her, stopping 0.6 u short
GRAV_PULL = (0.6, 0.9)           # a Gravity hit's pull toward her, u: plain / with the Dust card (0.35 / 0.55 until 0.7;
                                 # the lead, 2026-10-03: "make it better and stronger"). A round counts GUN_DOSE of them


def gun_levels(B, port, by, P, role_t):
    fp, fv = B.fp, B.fv
    made = jc = 0
    for n, a in by.items():
        if not any(n == b or n.startswith(b + '_') for b in GUN_STRIKES): continue
        if any(w in n for w in ('chase', 'finish', 'land', 'charge')) or not a.get('HitDataList'): continue
        shots = [e for e in a.get('AddEffects') or [] if e['NameEx']['ConstValue'] == 'Role/Rrb/rrb_muzzle_heavy']
        if not shots: continue
        e = shots[0]
        t = fv(e['Start'])
        deg = fv(e['Rotation']['x']) if isinstance(e.get('Rotation'), dict) and 'x' in e['Rotation'] else JC_ANGLE
        mx, my = fv(e['Position']['x']), fv(e['Position']['y'])
        if n == 'rrb_jc' or n.startswith('rrb_jc_'):
            # j.C from stage 2: the Dust round from the muzzle along the shot (replaces the zones below)
            for s, J in JC_ROUNDS.items():
                r = B.bp.role(role_t, B.BID, J['rnd'], t, round(mx, 3), round(my, 3))
                r['DirAngleV']['ConstValue'] = fp(round(deg, 2))
                r['ConditionGroup'] = P.cg([port.refs.buff('rrb_stage%d' % s)])
                a.setdefault('AddRoles', []).append(r); jc += 1
            continue
        ang = math.radians(deg)
        x = mx + GUN_REACH * math.cos(ang); y = my + GUN_REACH * math.sin(ang)
        for s, (zn, box, k, dmg, shake) in GUN_LV.items():
            r = B.bp.role(role_t, B.BID, zn, t, round(x, 3), round(y, 3))
            r['ConditionGroup'] = P.cg([port.refs.buff('rrb_stage%d' % s)])
            a.setdefault('AddRoles', []).append(r); made += 1
    port.note('rrb_jc', 'gun strike stages: %d j.C Dust-round spawns (%s, %.1f deg), %d burst spawns (Clash Assault and its variants), %s u down the shot' % (
        jc, ', '.join(J['rnd'] for J in JC_ROUNDS.values()), JC_ANGLE, made, GUN_REACH))


# 0.9.0, j.C fires three times (the lead to the testers, 2026-10-04: "3rd attack on air combo will be adjusted to fire
# more bullets and have less hang time"; testers: "seems unfinished because it only shot one bullet", "it doesn't give
# Ruby any backward momentum and leaves her hanging in mid-air", no jump and no air dash after it).
# Two light rounds (JC3["light"]: a plain rifle round at a fraction of its damage, no stagger), then the heavy shot it
# always had (the spike; from stage 2 the Dust round with the full Dust effect, once per j.C as before), `gap` s apart.
# Each shot kicks her back and up a little (`kick`, the last one `last`: u back, u up, s); she holds her height until
# the last round is out, then falls at `fall` (her jump's own gravity is 42; until 0.8 she dropped at 70), and Jump,
# Skill and the rest are open `free` s after the last shot. Numbers: proposals.
JC3 = dict(gap=0.1, light="b7_jc", light_dmg=(0.3, 1), kick=(-0.28, 0.18, 0.08), last=(-0.5, 0.3, 0.1), free=0.05,
           fall=-45.0, shake=(0.09, 0.07, 0.07), fx=0.8)
JC_TIMES = {}                    # action -> its three shot times (s), for the sound pass and the input row


def air_jump_switch(B, by, t0, t1):
    """the fall state's answer to Jump (its switch that calls the engine's DropToJump: the next air jump, if she has one
    left), for an air move that outlasts its own attack; open from t0 to t1 s"""
    src = next((x for x in (by.get("drop") or {}).get("ActionSwitchs") or [] if (x.get("ScriptCall") or {}).get("Function") == "DropToJump"), None)
    if src is None: return None
    s = copy.deepcopy(src)
    s["TimeCheck"]["Start"] = B.fp(t0); s["TimeCheck"]["End"] = B.fp(t1)
    return s


def jc_triple(B, port, by, P, role_t):
    fp, fv, G = B.fp, B.fv, JC3
    ext = 2 * G["gap"]
    for n in [x for x in by if x == "rrb_jc" or (x.startswith("rrb_jc_") and "land" not in x)]:
        a = by[n]
        mz = next((e for e in a.get("AddEffects") or [] if e["NameEx"]["ConstValue"] == "Role/Rrb/rrb_muzzle_heavy"), None)
        if mz is None or not a.get("HitDataList"): continue
        t1 = fv(mz["Start"]); cut = t1 - 0.03
        deg = fv(mz["Rotation"]["x"]) if isinstance(mz.get("Rotation"), dict) and "x" in mz["Rotation"] else JC_ANGLE
        mx, my = fv(mz["Position"]["x"]), fv(mz["Position"]["y"])
        # (a tester, 2026-10-07: the red slashes should not come off shots.) j.C's stage payoff is its Dust round
        a["AddRoles"] = [r for r in a.get("AddRoles") or []
                         if not re.match(r"^rrb_jc(_w\d|_v2)$", str((r.get("StartActionEx") or [{}])[0].get("ConstValue", "")))]
        # the heavy shot, and all that belongs to it, moves to the third beat
        for e in a.get("AddEffects") or []:
            if fv(e["Start"]) >= cut: e["Start"] = fp(fv(e["Start"]) + ext)
        for x in a.get("Audios") or []:
            if float(x["Time"]) >= cut: x["Time"] = float(x["Time"]) + ext
        for h in a["HitDataList"]:
            if fv(h["TickRange"]["Start"]) >= cut:
                h["TickRange"]["Start"] = fp(fv(h["TickRange"]["Start"]) + ext); h["TickRange"]["End"] = fp(fv(h["TickRange"]["End"]) + ext)
        for r in a.get("AddRoles") or []:
            tc = r["TimeConfig"]
            if fv(tc["Start"]) >= cut:
                if fv(tc["End"]) >= cut: tc["End"] = fp(fv(tc["End"]) + ext)
                tc["Start"] = fp(fv(tc["Start"]) + ext)
        for c in a.get("CameraShake") or []:
            if float(c["Time"]) >= cut: c["Time"] = float(c["Time"]) + ext
        for s in a.get("ScriptCalls") or []:
            tc = s.get("TimeConfig") or {}
            if tc.get("StartType") == 1 and fv(tc.get("Start")) >= cut: tc["Start"] = fp(fv(tc["Start"]) + ext)
        t3 = t1 + ext
        casing = min((e for e in a["AddEffects"] if e["NameEx"]["ConstValue"].split("/")[-1].startswith("rrb_casing")),
                     key=lambda e: abs(fv(e["Start"]) - t3), default=None)
        for t in (t1, t1 + G["gap"]):
            e = copy.deepcopy(mz); e["NameEx"]["ConstValue"] = "Role/Rrb/rrb_muzzle"; e["Start"] = fp(t)
            for ax in ("x", "y"): e["Scale"][ax] = fp(fv(e["Scale"][ax]) * G["fx"])
            a["AddEffects"].append(e)
            if casing is not None:
                c = copy.deepcopy(casing); c["Start"] = fp(fv(casing["Start"]) - t3 + t); a["AddEffects"].append(c)
            r = B.bp.role(role_t, B.BID, G["light"], t, round(mx, 3), round(my, 3))
            r["DirAngleV"]["ConstValue"] = fp(round(deg, 2))
            a["AddRoles"].append(r)
            B.sfx(a, "sfx_no_attack7", t)       # (the sound pass turns the stock gun marker into her own gunshot)
            sx, sy, du = G["shake"]
            a.setdefault("CameraShake", []).append({"Time": float(t), "ShakeStr": {"x": sx, "y": sy}, "Duration": du})
            a.setdefault("AddMotions", []).append(B.glide(port, t, G["kick"][0], G["kick"][1], G["kick"][2]))
        a.setdefault("AddMotions", []).append(B.glide(port, t3, G["last"][0], G["last"][1], G["last"][2]))
        # she holds her height until the last round is out, then falls
        hold = round(t3 + 0.04, 3)
        for b in a.get("AddBuff") or []:
            if b["Buff"]["Idx"] == "nogravity_change": b["Buff"]["Duration"] = fp(hold)
        op = a.get("OverridePhysics") or []
        if len(op) >= 2:
            op[0]["TimeRange"]["Finish"] = fp(hold); op[1]["TimeRange"]["Start"] = fp(hold); op[1]["OverrideGravityValue"] = fp(G["fall"])
        # (in game, 2026-10-09: Jump did nothing for the rest of j.C, which lasts until she lands. An air jump is not an
        #  input row: the fall state answers Jump with the engine's DropToJump call, and an attack has no such switch.)
        #  The fall's own jump switch, from the moment she is free
        js = air_jump_switch(B, by, t3 + G["free"], fv(a["TotalDuration"]))
        if js is not None: a["ActionSwitchs"] = (a.get("ActionSwitchs") or []) + [js]
        JC_TIMES[n] = (round(t1, 3), round(t1 + G["gap"], 3), round(t3, 3))
        port.note(n, "0.9.0: three shots at %s s (light, light, heavy); kicks %s / %s; holds to %.2f s, then gravity %.0f; free at %.2f s" % (
            list(JC_TIMES[n]), G["kick"], G["last"], hold, -G["fall"], t3 + G["free"]))


STAG_TAG = "rrb_stag"            # the actor tag an enemy carries for RIFLE_STAGGER s after a rifle round made it flinch
STAG_FREE = "rrb_nostag"         # the actor tag every other enemy carries (rrbStagScan): the damage-only twin skips it
STAG_SCAN = "rrb_stagscan"       # the buff on her whose start call marks the enemies (rrbStagScan)


def stagger_rule(B, port, btree):
    """0.9.0, the stagger cooldown of her gunfire (the lead to the testers, 2026-10-04: "i will also reduce the damage
    and add a stagger cooldown to her rifle shots"; testers: her rifle "can cancel almost all move from bosses", "the
    boss have no opportunity to attack"). For the rounds of Rifle Shot and Sy-Pod (the b7 and s4 families; not j.C's:
    its light rounds never stagger, and its Dust round's spike is its point):
      a flying round  gets its hit twice under one Id, the stock form for overlapping hits of which one may land
                      (Ragna's rgbullet ras / sAF2 / s2; NOTES 2026-10-02: the hold is a record on the victim keyed
                      by the round's action and the Id). First the hit as it was, skipped on an enemy that carries
                      STAG_TAG (ExcludeTags); on a hit it puts the buff rrb_stag on that enemy for RIFLE_STAGGER s
                      (its start and end calls add and remove the tag). Second the same hit with no reaction: no hit
                      action, no push, no armour break, skipped on an enemy that carries STAG_FREE. It lands when
                      the first was skipped, so the damage, the Dust and every on-hit call are the same. The two
                      tags are never on an enemy together, so the game's order between the two hits does not
                      matter (fifth build, in game 2026-10-09 20:44: with STAG_TAG alone the twin landed first on
                      a free enemy: no flinch from the first Rifle Shot, a flinch from the second);
      a break         (the burst a round leaves where it hits) only deals its damage. In game, 2026-10-09: it lands
                      17 ms after its round, sometimes before the tag is on the enemy, and its own reaction is a
                      knock-away: the dummy flew 5.8 u from one Rifle Shot.
    A b7 round's hold between its two hits lasts 0.1 s: shorter than the gap between two rounds of a burst (0.13 s).
    An s4 round keeps its own Id and hold (its pierce counts on them: one hit per enemy per pass)."""
    import rrb_pots
    fp, fv = B.fp, B.fv
    n_round = n_break = 0

    def soften(h):
        v = h["Victim"]
        v["Action"] = ""; v["RandomActions"] = []
        sp = v.get("Speed")
        if isinstance(sp, dict):
            for ax in ("x", "y"):
                if isinstance(sp.get(ax), dict) and "value" in sp[ax]: sp[ax] = fp(0.0)
        da = v.get("DistAdapt")
        if isinstance(da, dict): da["Enable"] = 0; da["EnableY"] = 0
        h["ArmorBreak"] = 0

    for a in btree["_actions"]:
        nm = a["Name"]
        if not re.match(r"^(b7|s4)", nm) or nm.startswith((JC3["light"], "s4_jc")) or not a.get("HitDataList"): continue
        if "end" in nm:                                  # a break: its damage, no reaction
            for h in a["HitDataList"]: soften(h); n_break += 1
            continue
        out = []
        for k, h in enumerate(a["HitDataList"]):
            if nm.startswith("b7"):
                h["Id"] = "rrb_stg_%s_%d" % (nm, k); h["PreventHitBySameBoxType"] = 0
                h["PreventHitBySameBoxIdDuration"] = fp(0.1)
            elif fv(h.get("PreventHitBySameBoxIdDuration") or fp(0.0)) <= 0:
                h["PreventHitBySameBoxIdDuration"] = fp(0.1)
            h["PreventHitBySameBoxIdMaxTimes"] = 1
            soft = copy.deepcopy(h); soften(soft)
            soft["ExcludeTags"] = list(soft.get("ExcludeTags") or []) + [STAG_FREE]
            h["ExcludeTags"] = list(h.get("ExcludeTags") or []) + [STAG_TAG]
            h.setdefault("AttackerCalls", []).append(rrb_pots.attacker_call(B, "AddBuff", 'buff:"%s",durOverride:%.2f,hit_target:1' % (
                STAG_TAG, rrb_pots.RIFLE_STAGGER)))
            out += [h, soft]; n_round += 1
        a["HitDataList"] = out
    port.note(B.BLOGIC, "0.9.0 rifle stagger cooldown: %d round hits doubled, %d break hits without a reaction (flinch once in %.1f s per enemy, tags %s / %s)" % (
        n_round, n_break, rrb_pots.RIFLE_STAGGER, STAG_TAG, STAG_FREE))


def stag_scan(B, port, by):
    """0.9.0: every move of hers that fires a round the stagger rule covers marks the enemies as it starts (the buff
    STAG_SCAN for 0.1 s: its start call rrbStagScan gives each enemy STAG_FREE, or STAG_TAG while it carries the
    rrb_stag buff). rrbStage does the same whenever she is back in stand / run. Called before the reference audit
    and the Dust variants, which copy these moves."""
    buff = B.bp.buff
    made = []
    for n, a in by.items():
        fires = False
        for r in a.get("AddRoles") or []:
            for s in r.get("StartActionEx") or []:
                v = str(s.get("ConstValue", "")) if isinstance(s, dict) else ""
                if re.match(r"^(b7|s4)", v) and not v.startswith((JC3["light"], "s4_jc")): fires = True
        if fires:
            a.setdefault("AddBuff", []).append(buff(STAG_SCAN, 0.0, 0.1)); made.append(n)
    port.note(B.LOGIC, "0.9.0 rifle stagger cooldown: %d moves mark the enemies as they start (%s)" % (len(made), STAG_SCAN))


def _light_round(B, btree, A, name, dmg, victim=None, armor_break=False, reach=None):
    """the plain rifle round b7 as it is built (its look, its break, its Dust) under `name`, kept light at every
    stage: no switch to the bigger rounds, its break a picture only (the plain break is a second hit worth 0.6).
    With `victim` its hits take that reaction; with `reach` it flies that many u"""
    fp, fv = B.fp, B.fv
    a = copy.deepcopy(A["b7"]); a["Name"] = name
    a["ActionSwitchs"] = [x for x in a.get("ActionSwitchs") or [] if not str((x.get("NewActionEx") or {}).get("ConstValue", "")).startswith("b7_")]
    end = A.get("b7end")
    if end is not None:
        e2 = copy.deepcopy(end); e2["Name"] = name + "end"; e2["HitDataList"] = []; e2["HitAudios"] = []; e2["HitEffects"] = []
        btree["_actions"].append(e2)
        for x in a["ActionSwitchs"] + (a.get("CollisionSwitchList") or []):
            if (x.get("NewActionEx") or {}).get("ConstValue") == "b7end": x["NewActionEx"]["ConstValue"] = e2["Name"]
    for h in a.get("HitDataList") or []:
        if victim is not None:
            keep = h["Victim"].get("BuffList") or []
            h["Victim"] = copy.deepcopy(victim); h["Victim"]["BuffList"] = keep
            da = h["Victim"].get("DistAdapt")
            if isinstance(da, dict): da["Enable"] = 0; da["EnableY"] = 0
        if armor_break: h["ArmorBreak"] = 1
    spd = abs(fv(((a.get("StartSpeed") or {}).get("Speed") or {}).get("x") or fp(0)))
    if reach and spd:
        for key in ("TotalDuration", "AnimateDuration"):
            if key in a: a[key] = fp(reach / spd)
    btree["_actions"].append(a)
    B.DMG[name] = dmg
    return a


def jc_light_round(B, port, btree, by):
    """j.C's two light rounds (JC3["light"]): the plain rifle round kept light, at JC3["light_dmg"], with j.A's own
    light air reaction so they keep a launched enemy up and never stagger an armoured one"""
    A = {a["Name"]: a for a in btree["_actions"]}
    if "b7" not in A or JC3["light"] in A: return
    jah = ((by or {}).get("rrb_ja") or {}).get("HitDataList") or []
    _light_round(B, btree, A, JC3["light"], JC3["light_dmg"], victim=jah[0]["Victim"] if jah else None, armor_break=True)
    port.note(B.BLOGIC, "j.C light round %s: b7 without its stage switch, damage %s, j.A's reaction" % (JC3["light"], JC3["light_dmg"]))


# 0.9.0 Gunswing's rounds (rrb_pots.gunswing): the plain rifle round kept light, `reach` u of flight. On the floor
# it flinches in place as the rifle does; in the air it takes j.A's reaction, so a launched enemy stays up
GSW_RND = dict(floor="b7_gsw", air="b7_gswa", dmg=(0.5, 1), reach=7.0)


def gsw_rounds(B, port, btree, by):
    A = {a["Name"]: a for a in btree["_actions"]}
    if "b7" not in A or GSW_RND["floor"] in A: return
    jah = ((by or {}).get("rrb_ja") or {}).get("HitDataList") or []
    _light_round(B, btree, A, GSW_RND["floor"], GSW_RND["dmg"], reach=GSW_RND["reach"])
    _light_round(B, btree, A, GSW_RND["air"], GSW_RND["dmg"], victim=jah[0]["Victim"] if jah else None, armor_break=True, reach=GSW_RND["reach"])
    port.note(B.BLOGIC, "Gunswing rounds %s / %s: b7 kept light, damage %s, %.0f u" % (GSW_RND["floor"], GSW_RND["air"], GSW_RND["dmg"], GSW_RND["reach"]))


def jc_rounds(B, port, btree, zone, by=None):
    '''j.C's Dust rounds (JC_ROUNDS): copies of the stage 3 Sy-Pod round s4_max that pierce, and their floor bursts'''
    fp = B.fp
    jc_light_round(B, port, btree, by)
    gsw_rounds(B, port, btree, by)
    A = {a['Name']: a for a in btree['_actions']}
    src = A['s4_max']
    boom = ((A.get('s4end') or {}).get('Audios') or [])[:1]
    spikes = [r for r in (A['s4end_x'].get('AddRoles') or []) if (r.get('StartActionEx') or [{}])[0].get('ConstValue') == 'rrb_icespike']
    # (C3) the round lands in the same frames as j.C's own spike: it takes the spike's reaction, so the later of the two
    # can't turn the spike into a knock-away; its own BuffList, armour break and hit-freeze stay
    jch = ((by or {}).get('rrb_jc') or {}).get('HitDataList') or []
    jv = copy.deepcopy(min(jch, key=lambda x: B.fv(x['TickRange']['Start']))['Victim']) if jch else None
    if jv is not None and isinstance(jv.get('DistAdapt'), dict): jv['DistAdapt']['Enable'] = 0; jv['DistAdapt']['EnableY'] = 0
    for s, J in JC_ROUNDS.items():
        a = copy.deepcopy(src); a['Name'] = J['rnd']
        a['ActionSwitchs'] = []                   # it pierces: no break on hit (b7_max's rule), each enemy once
        for c in a.get('CollisionSwitchList') or []:
            c['NewActionEx']['ConstValue'] = J['floor']    # the floor or a wall: its burst
            c['NewActionWithTurnAngleType'] = 2            # upright (stock jnbullet H -> Hend, kkbullet a3F -> a3Fboom)
        spd = (a.get('StartSpeed') or {}).get('Speed')
        if spd: spd['x'] = fp(J['speed']); spd['y'] = fp(0)
        k = J['half']
        for h in a['HitDataList']:
            h['HitBox'] = {'Min': {'x': fp(-k), 'y': fp(-k)}, 'Max': {'x': fp(k), 'y': fp(k)}}   # square: right rotated or not
            h['PreventHitBySameBoxIdDuration'] = fp(0.0)   # (a hold keyed on her move would block the next j.C's round: rounds analysis)
            h['TickRange']['HitInterval'] = fp(-1)          # once per enemy per flight
            h['AttackerCalls'] = []               # (hidden 27's rrb_frz: rrbDustHit's full effect covers Ice)
            if jv is not None:
                keep = h['Victim'].get('BuffList') or []
                h['Victim'] = copy.deepcopy(jv); h['Victim']['BuffList'] = keep
        btree['_actions'].append(a)
        B.DMG[J['rnd']] = (J['dmg'], 1)
        z = zone(J['floor'], 0.35, list(J['box']), None, ['Role/Rrb/rrb_blast_burst', 'Role/Rrb/rrb_blast_ring'], 'knock', scale=J['bfx'])
        z['CameraShake'] = [{'Time': 0.0, 'ShakeStr': {'x': J['shake'], 'y': J['shake']}, 'Duration': 0.15}]
        z['Audios'] = [dict(copy.deepcopy(x), Time=0.0) for x in boom]
        z['AddRoles'] = copy.deepcopy(spikes)      # the Ice card: shots leave ice spikes where they hit
        for zh in z['HitDataList']:                # (C2) no melee spacing on a burst
            da = zh['Victim'].get('DistAdapt')
            if isinstance(da, dict): da['Enable'] = 0; da['EnableY'] = 0
        B.DMG[J['floor']] = (J['bdmg'], 1)
    port.note(B.BLOGIC, 'j.C Dust rounds: %s, floor bursts %s' % ([J['rnd'] for J in JC_ROUNDS.values()], [J['floor'] for J in JC_ROUNDS.values()]))


def gun_level_zones(B, port, zone):
    """the stage 2 / 3 bursts of her gun strikes (gun_levels)"""
    fp = B.fp
    for s, (zn, box, k, dmg, shake) in GUN_LV.items():
        # (a light reaction: Clash Assault's chase follows its own hit, and a knock-away burst would carry the target off)
        a = zone(zn, 0.35, list(box), None, ["Role/Rrb/rrb_blast_burst", "Role/Rrb/rrb_blast_ring"], "light", scale=k)
        a["CameraShake"] = [{"Time": 0.0, "ShakeStr": {"x": shake, "y": shake}, "Duration": 0.15}]
        B.DMG[zn] = (dmg, 1)


# 5AAAA's pass: the target is lifted and carried to where she stops (u/s along her facing, up). (The lead, 2026-10-02,
# after 9 u/s: "enemy carrying is good but it also need to follow her vertically she still cant combo in the air": now
# Rising Reap's launch height, 15 u/s, so her jump out of it (from 0.3 s) meets the target in the air)
A4_LIFT = (2.5, 15.0)
# 5AAAA's rose gust, hidden effect 39 (20703 + Semblance; the lead, 2026-10-02: "the last hit of 5aaaa should also
# summon the wind and petals that petal burst and petal dance has as like hidden potential effect"). On a hit, once per
# 5AAAA: Petal Burst's rose wind (rrb_gust_a4: its squall, three wipes from behind her, the petal vortex) centred
# A4_GUST["at"] u ahead of where the strike connected (about 0.6 u in front of where her 2.9 u pass stops), light hits on
# the enemies around and a sideways pull to that centre. Each enemy the pass launches carries the actor tag A4_TAG for
# A4_TAG_T s: the gust's hits skip it, so the A4_LIFT launch to her jump height is untouched (the pull, sideways only,
# keeps it in front of her)
A4_GUST = dict(at=3.5, dur=1.3, t0=0.1, t1=0.75, iv=0.2, box=(-6.5, -0.5, 6.5, 4.5), pull=8.0, pop=4.5, dmg=0.6,
               kick=(0.09, 0.06, 0.16), petals=1.6)
A4_TAG, A4_TAG_T = "rrb_a4_lift", 1.0

def a4_gust(B, port, a):
    """hidden 39 on one 5AAAA action (the base and every card variant; the cards' trigger conditions pick it): each hit
    tags the enemy it launches (A4_TAG) and spawns the rose gust once (CreateBullet, limit 1: on the hit, so a jump or
    Gun Blast cancel can't lose it); a burst of petals on each enemy struck"""
    import rrb_pots as P
    conds = lambda: [P.T(B, port, "a4_pass"), P.T(B, port, "semblance")]
    # (the limit's counter lives on her for the whole battle: each 5AAAA sets it back as it starts, the stock way;
    #  0.7.1 and earlier had no reset, so the gust came once a battle)
    a.setdefault("ScriptCalls", []).append(B.bp.call(0.0, "SetExtParams", 'key: "rrb_gust_a4", value: 0', start_type=3, nt=1))
    for h in a.get("HitDataList") or []:
        h.setdefault("AttackerCalls", []).extend([
            P.attacker_call(B, "AddBuff", 'buff:"%s",durOverride:%.2f,hit_target:1' % (A4_TAG, A4_TAG_T), conds()),
            P.attacker_call(B, "CreateBullet", 'bullet_id:"%d",bullet_action:"rrb_gust_a4",targpos:0,pos_x:%.2f,pos_y:0,dir_x:1,dir_y:0,'
                            'limit:1,limitKey:"rrb_gust_a4"' % (B.BID, A4_GUST["at"]), conds())])
    e = B.fx_entry(port, "Role/Rrb/rrb_petals", 0.0, scale=A4_GUST["petals"], hit=True)
    e["ConditionGroup"] = P.cg(conds())
    a.setdefault("HitEffects", []).append(e)

# ---------------------------------------------------------------- launch heights (the lead, 2026-10-02: the down chain
# "does not launch enemies in the air to her vertical height"; 5AAAA "needs to follow her vertically"). Rising Crescent
# and 5AAAA carry the target up WITH her, as stock launchers do (Ragna attackUp, ICEY attack_up_1, her rrb_launcher_rise):
# same take-off, speed, gravity and stop, so it stays level with her; the air string then holds it at her height.
VICTIM_G = -34.0        # BattleDefine.GRAVITY: a launched enemy's gravity (its passive actions have no override)
RISE_2B = dict(t=0.17, vx=0.6, vy=15.0, box_top=2.4)    # take-off just after the hit tick (0.167 s); Ragna's 15 u/s
CARRY_2B = dict(x=0.6, y=15.0, ref=(1.0, 0.3), rx=(0.5, 0.5), ry=(1.0, 1.0), dur=0.1)   # target 1 u ahead, 0.3 u up
A4_RISE = dict(t0=0.45, t1=0.5, within=0.35, ss_t=0.03, vy=15.0, ja=0.17)   # 5AAAA on hit: rise at the end of the pass; j.A from `ja` s of it
AIR_HOLD = dict(x=1.5, y=6.5, ref=(1.1, 0.3), rx=(0.5, 0.5), ry=(0.7, 0.7), dur=0.15)  # j.A / j.B / j.2A
SWEEP_POP = 10.0        # Low Sweep "pops enemies up": 1.5 u (it was the full 15 u/s launch, 3.3 u)


def _dist_adapt(B, h, ref, rx, ry=None, dur=0.15):
    """Victim.DistAdapt (BattleDamage hit path): after its stop the target eases, over dur, toward ref[0] u in front of
    the attacker (rx: share of the gap closed when nearer / farther) and, with ry, ref[1] u above the attacker's feet
    (ry: when lower / higher)."""
    fp = B.fp
    da = h["Victim"].setdefault("DistAdapt", {})
    da["Enable"] = 1
    da["RandomDistanceRef"] = {"x": fp(ref[0]), "y": fp(ref[0])}
    da["PushRatioLeftAndRight"] = {"x": fp(rx[0]), "y": fp(rx[1])}
    if ry is not None:
        da["EnableY"] = 1
        da["RandomDistanceRefY"] = {"x": fp(ref[1]), "y": fp(ref[1])}
        da["PushRatioY"] = {"x": fp(ry[0]), "y": fp(ry[1])}
    da["Duration"] = fp(dur)


def launch_heights(B, port, by):
    import rrb_pots
    fp, fv = B.fp, B.fv
    jump = by["jump"]
    grav = copy.deepcopy(jump["OverridePhysics"][0])        # the jump's entry (ground / air friction untouched)
    n = dict(air=0, rise=0, sweep=0, lift=0)
    for name, a in by.items():
        H = a.get("HitDataList") or []
        if name.startswith(("rrb_ja", "rrb_jb", "rrb_j2a")):
            for h in H:
                rrb_pots.push(B, h, x=AIR_HOLD["x"], y=AIR_HOLD["y"])
                _dist_adapt(B, h, AIR_HOLD["ref"], AIR_HOLD["rx"], AIR_HOLD["ry"], AIR_HOLD["dur"]); n["air"] += 1
        elif name.startswith("rrb_2b"):
            ss = a.setdefault("StartSpeed", copy.deepcopy(jump["StartSpeed"]))
            ss["Time"] = fp(RISE_2B["t"]); ss["Speed"] = {"x": fp(RISE_2B["vx"]), "y": fp(RISE_2B["vy"])}
            ss["InheritSpeed"] = {"x": fp(0.0), "y": fp(0.0)}
            g = copy.deepcopy(grav); g["TimeRange"]["Start"] = fp(RISE_2B["t"]); g["TimeRange"]["Finish"] = fp(3.0)
            g["OverrideGravityValue"] = fp(VICTIM_G); a["OverridePhysics"] = [g]
            for h in H:
                rrb_pots.push(B, h, x=CARRY_2B["x"], y=CARRY_2B["y"])
                _dist_adapt(B, h, CARRY_2B["ref"], CARRY_2B["rx"], CARRY_2B["ry"], CARRY_2B["dur"])
                h["HitBox"]["Max"]["y"] = fp(max(fv(h["HitBox"]["Max"]["y"]), RISE_2B["box_top"]))
            n["rise"] += 1
        elif name.startswith("rrb_sweep"):
            for h in H:
                rrb_pots.push(B, h, y=SWEEP_POP); n["sweep"] += 1
    # 5AAAA: on hit, at the end of the pass, a jump-like rise at the target's launch speed and gravity (it reads as a
    # jump-cancel done for her; the jump's own switches give j.A from 0.17 s and the air jump from 0.3 s)
    lift = copy.deepcopy(jump); lift["Name"] = "rrb_a4_rise"; lift["Audios"] = []
    # (the copy must not hand over to the Recoil Jump, card 20741: this rise is the strike's own, not a jump)
    lift["ActionSwitchs"] = [s for s in lift.get("ActionSwitchs") or [] if not ((s.get("NewActionEx") or {}).get("ConstValue") or "").endswith("_rj")]
    lift["StartSpeed"]["Time"] = fp(A4_RISE["ss_t"]); lift["StartSpeed"]["Speed"] = {"x": fp(0.0), "y": fp(A4_RISE["vy"])}
    for o in lift.get("OverridePhysics") or []:
        o["OverrideGravityValue"] = fp(VICTIM_G)
    # (0.8.0, in game, rsuite fb_a4_mash: with 5AAAA's own recovery in place, mashed Attack reached this rise and gave j.A
    #  0.04 s into it, at floor height: the air row is open the moment she leaves the ground, since no row starts this
    #  action.) The air Attack rows wait for the jump's own time for j.A (A4_RISE["ja"] s), when she is up with the target
    lift["MuteSkills"] = rrb_pots.mute_window(B, ["4"], 0.0, A4_RISE["ja"]) + (lift.get("MuteSkills") or [])
    by["rrb_a4_rise"] = lift
    hit = port.refs.hit(A4_RISE["within"])
    for name, a in list(by.items()):
        if name.startswith("rrb_a4") and name != "rrb_a4_rise":
            a["ActionSwitchs"] = [B.bp.switch("rrb_a4_rise", [hit], start_type=1, nt=1, t0=A4_RISE["t0"], t1=A4_RISE["t1"])] + (a.get("ActionSwitchs") or [])
            n["lift"] += 1
    port.note("rrb_2b", "launch heights: rising 2B x%d (%.0f u/s at %.2f s, gravity %.0f, target to %s), Low Sweep pop %.0f u/s x%d hits, air hold %s on %d hits, 5AAAA lift switch on %d actions" % (
        n["rise"], RISE_2B["vy"], RISE_2B["t"], VICTIM_G, CARRY_2B["ref"], SWEEP_POP, n["sweep"], (AIR_HOLD["x"], AIR_HOLD["y"]), n["air"], n["lift"]))



def _held_hit(B, h):
    """a strike that keeps its target where it is: no push (speed 0, the target's old speed cleared, no distance
    adapt); its flinch stays"""
    fp = B.fp
    v = h["Victim"]
    v["Speed"] = {"x": fp(0.0), "y": fp(0.0)}
    v["SpeedRand"] = {"x": fp(0.0), "y": fp(0.0)}
    v["ClearOldSpeed"] = 1
    if isinstance(v.get("DistAdapt"), dict): v["DistAdapt"]["Enable"] = 0; v["DistAdapt"]["EnableY"] = 0


def _release_hit(B, h, buff):
    """the strike that ends a hold before its own damage and push (stock: Hibiki's s31end removes hb_hit_fixpos with an
    AttackerCall RemoveBuff at CalcStage 1 = PreCalc), so its launch / knock carries a free target"""
    import rrb_pots
    h.setdefault("AttackerCalls", []).append(rrb_pots.attacker_call(B, "RemoveBuff", 'id:"%s"' % buff, stage=1))


def hold_moves(B, port, by):
    """(the lead, 2026-10-02) Guillotine locks what it cuts; Red Reaper pins the first enemy it hits.
    Cause: every Guillotine cut carried the launcher reaction (up 15 u/s, distance adapt) and Red Reaper's dive and lock
    hit the knock one (8, 6 u/s): the first hit sent the target out of the 2.8 x 1.8 u boxes. BBTAG holds them
    (AstralHeat: AttackDefaults_Astral, 9999 hitstun, no pushback).
    Guillotine: every cut but the launching one keeps its target (no push) and puts rrb_guil_hold on it (the stock
    relative lock, Victim.BuffList at AddOnStage 2 as Hibiki / Susanoo do; never on a true boss: Hibiki's
    IfTargetHaveTag gate) for the gap to the next cut + HOLD_MARGIN; the launching cut (the base move's last, rrb_guil_end's
    blow) removes it before its own push. The held spins never release: rrb_guil_end does.
    Red Reaper: the dive kick and the lock hit no longer push; rrb_rr_hook on her lets rrbRrHit pin the first enemy hit
    (rrb_rr_hold until RR_REL); the final slash removes it and knocks it away with its own push."""
    fp, fv = B.fp, B.fv
    tmpl = copy.deepcopy(B.tpl(port, "icey", "attack1")["HitDataList"][0]["Victim"]["BuffList"][0])
    gate = {"Combine": 1, "Conditions": [   # any true: not a Boss, or an Elite (MonsterConfig: Elites are Tag=Boss,...,Elite)
        port.refs.new("ActionLogicCondition_Script", {"Invert": 1, "Call": {"Function": "IfTargetHaveTag", "Params": 'tag:"Boss"'}}),
        port.refs.new("ActionLogicCondition_Script", {"Invert": 0, "Call": {"Function": "IfTargetHaveTag", "Params": 'tag:"Elite"'}})]}
    def entry(dur, idx=GUIL_HOLD):
        e = copy.deepcopy(tmpl)
        e.update({"ConditionGroup": copy.deepcopy(gate), "Idx": idx, "Duration": fp(round(dur, 3)), "Strength": fp(1.0),
                  "Stack": 1, "ParamSet": "", "AddOnStage": 2})
        return e
    ng = nr = 0
    # Reaper's Hook (0.8.0; a tester, 2026-10-03: "when using the grab Ruby gets a bit too far from the enemy sometimes").
    # The hook and every strike of the flurry but the last keep their target (no push) and put rrb_hook_hold on it: the
    # relative lock at a set point, P.HOOK_AT u in front of her (hold_buffs). The last strike removes it before its own
    # throw. The back throw (rrb_hook_back) holds nothing: she steps through the enemy, which must stay where it is
    # (rrbHoldCheck ends the hook's hold when that move starts).
    # (In game, rsuite fb_hook_*: the hit's own distance adapt moved a Mecha Gunner about 30 % of the way, from nearer
    #  and from farther: enemies carry a multiplier on it, buff logic 175 HitDistAdaptModifyRate.)
    import rrb_pots as P_
    nh = 0
    for n, a in by.items():
        if not (n == "rrb_hook" or n == "rrb_hook_exe" or n.startswith("rrb_hook_exe_")) or n.endswith(("_w2", "_w3")): continue
        H = sorted(a.get("HitDataList") or [], key=lambda h: fv(h["TickRange"]["Start"]))
        if not H: continue
        rel = H[-1] if n.startswith("rrb_hook_exe") else None
        for i, h in enumerate(H):
            if h is rel:
                _release_hit(B, h, HOOK_HOLD); continue
            t0 = fv(h["TickRange"]["Start"]); nxt = H[i + 1] if i + 1 < len(H) else None
            gap = (fv(nxt["TickRange"]["Start"]) - t0) if nxt else (P_.HOOK_SWITCH[1] - t0 if n == "rrb_hook" else fv(a["TotalDuration"]) - t0)
            _held_hit(B, h)
            h["Victim"].setdefault("BuffList", []).append(entry(max(0.1, gap) + (HOLD_MARGIN_LAST if nxt is not None and nxt is rel else HOLD_MARGIN), HOOK_HOLD))
            nh += 1
    port.note("rrb_hook", "hold: %d hits keep their target %.1f u in front of her (%s); the flurry's last strike releases it" % (nh, P_.HOOK_AT, HOOK_HOLD))
    for n, a in by.items():
        if not (n == "rrb_guillotine" or n.startswith(("rrb_guillotine_", "rrb_guil_loop", "rrb_guil_end"))) or n.endswith(("_w2", "_w3")):
            continue
        H = sorted(a.get("HitDataList") or [], key=lambda h: fv(h["TickRange"]["Start"]))
        if not H: continue
        rel = None if n.startswith("rrb_guil_loop") else H[-1]      # the held spins hand the target to rrb_guil_end
        for i, h in enumerate(H):
            if h is rel:
                _release_hit(B, h, GUIL_HOLD); continue
            t0, iv = fv(h["TickRange"]["Start"]), fv(h["TickRange"].get("HitInterval") or fp(0))
            nxt = H[i + 1] if i + 1 < len(H) else None
            gap = iv if iv > 0 else ((fv(nxt["TickRange"]["Start"]) if nxt else fv(a["TotalDuration"])) - t0)
            _held_hit(B, h)
            h["Victim"].setdefault("BuffList", []).append(entry(gap + (HOLD_MARGIN_LAST if nxt is not None and nxt is rel else HOLD_MARGIN)))
            ng += 1
    for n, a in by.items():
        if not n.startswith("rrb_redreaper"): continue
        H = sorted(a.get("HitDataList") or [], key=lambda h: fv(h["TickRange"]["Start"]))
        if len(H) < 2: continue
        RR_T0[0] = round(fv(H[0]["TickRange"]["Start"]), 3); RR_REL[0] = round(fv(H[-1]["TickRange"]["Start"]) - 0.05, 3)
        for h in H[:-1]: _held_hit(B, h)            # the dive kick and the lock hit no longer knock it out of the move
        _release_hit(B, H[-1], RR_HOLD)             # the final slash frees it, then knocks it away with its own push
        a.setdefault("AddBuff", []).append(B.bp.buff(RR_HOOK, 0.0, fv(a["TotalDuration"])))
        dive = H[0]                                  # the dive kick travels and hits along the way (RR_DIVE)
        dive["TickRange"]["Start"] = fp(RR_DIVE["t0"]); dive["TickRange"]["End"] = fp(RR_DIVE["t1"])
        dive["TickRange"]["HitInterval"] = fp(-1.0)
        m = copy.deepcopy(port.TPL["rg"]["dashAir"]["AddMotions"][0]); m["Time"] = fp(RR_DIVE["t0"])
        m["ConditionGroup"] = {"Combine": 0, "Conditions": []}
        M = m["Motion"]; M["MotionType"] = 3; M["EaseMode"] = 0
        M["DeltaX"]["ConstValue"] = fp(RR_DIVE["dx"]); M["DeltaY"]["ConstValue"] = fp(0.0)
        M["DurationEx"]["ConstValue"] = fp(RR_DIVE["t1"] - RR_DIVE["t0"])
        a["AddMotions"] = (a.get("AddMotions") or []) + [m]
        # Cross Tag's Red Reaper ends at 2.37 s when its dive misses (ExitState): no hit for 1.15 s -> back to neutral
        miss = port.refs.new("ActionLogicCondition_Hit", {"Invert": 1, "HitSuccTimeEllaps": fp(RR_MISS[1]), "HitSuccCheckType": 0})
        miss2 = port.refs.new("ActionLogicCondition_Hit", {"Invert": 1, "HitSuccTimeEllaps": fp(RR_MISS[1]), "HitSuccCheckType": 0})
        a["ActionSwitchs"] = [
            B.bp.switch("stand", [miss, port.refs.ground(2)], start_type=1, nt=1, t0=RR_MISS[0], t1=RR_MISS[0] + 0.05),
            B.bp.switch("drop", [miss2, port.refs.ground(1)], start_type=1, nt=1, t0=RR_MISS[0], t1=RR_MISS[0] + 0.05)] + (a.get("ActionSwitchs") or [])
        nr += 1
    port.note("rrb_guillotine", "hold: %d cuts keep their target (%s, no push); the launching cut releases it" % (ng, GUIL_HOLD))
    port.note("rrb_redreaper", "pin: %d actions; its first target is held (%s) %.2f-%.2f s; the final slash releases it; dive %.1f u over %.2f-%.2f s; whiff exit at %.2f s" % (
        nr, RR_HOLD, RR_T0[0], RR_REL[0], RR_DIVE["dx"], RR_DIVE["t0"], RR_DIVE["t1"], RR_MISS[0]))



# Clash Assault's backdrop (the lead, 2026-10-02: "can rubys clash attack have the exact same overlay as the clash effect
# background from cross tag battle across the entire screen"): ruby_clashbg builds BBTAG's own (bg_exultimate's diamond
# vortex, bg_exultimatefinish's colour burst, ef_crusha's start flash) from the player's install, screen-locked. The
# vortex spans the chase, so a buff carries it and its removal is the cleanup (the clashbg agent's contract, CLASH_BG_BUILD §4)
#
# 0.8.0 (a tester, 2026-10-03: "Clash Assault background change may be a bit too fast considering how short it last. Maybe
# it could use only the second background instead of both"; the lead: "lets add all of this persons feedback and
# suggestions!"). Until 0.7 the vortex ran through the chase (0.49 s) and the stage-4 / full-charge finishes swapped it
# for the colour burst: two backdrops inside 1.5 s. Now there is one, the second: the colour burst, in every variant, from
# the chase's first frame until CLASH_BG_OUT s into the finish, then its own 0.3 s fade (about 1.2 s on screen).
# The vortex (ruby_clashbg.CLASH_FX) is no longer placed or built.
# CLASH_BG_OUT: one tick after the finish's blow (out at 0.367 s) and one before Gun Blast can cancel it (0.40 s), so
# the removal always runs and no cancel leaves the backdrop behind. It is a timed entry in each finish variant and not
# an on-interrupt one: the plain finish hands over to its stage-4 / full-charge variants by a switch in its first
# 0.05 s, which would count as an interruption and drop the backdrop at the blow.
# A chase step that is interrupted (she has armour 5; a grab or a death) removes it too (ActionLogicStartEndType
# Interrupt = 4, as 16 stock RemoveBuff entries); the cap is the backstop.
CLASH_BG, CLASH_BG_CAP, CLASH_BG_OUT = "rrb_clash_bg", 1.5, 0.383
CLASH_BG_FX = "Role/Rrb/rrb_clash_finbg"     # = ruby_clashbg.FINISH_FX (checked in clash_bg)
CLASH_STARTS = ("rrb_clash", "rrb_clash_cm", "rrb_clash_full", "rrb_clash_full_cm", "rrb_clash_full_se", "rrb_clash_full_cm_se")
CLASH_CHASE = ("rrb_clash_chase1", "rrb_clash_chase2")
CLASH_FINISHES = ("rrb_clash_finish", "rrb_clash_finish_s4", "rrb_clash_exfinish", "rrb_clash_exfinish_s4")


def clash_bg(B, port, by):
    import ruby_clashbg as CB
    assert CLASH_BG_FX == CB.FINISH_FX
    fp = B.fp
    def rm(t=None, when=0):
        """Remove the backdrop's buff at t s, or (when: 4) when the action is interrupted."""
        tc = {"StartType": 1, "Start": fp(t), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1} if t is not None else \
             {"StartType": 3, "Start": fp(0), "End": fp(0), "Interval": fp(-1), "NonTimeType": when}
        return {"Time": fp(t or 0.0), "TimeConfig": tc, "BuffName": CLASH_BG}
    n = 0
    for nm in CLASH_STARTS:
        if nm not in by: continue
        e = B.fx_entry(port, CB.START_FX, 0.0); e["Binding"], e["BindPos"], e["KillMode"] = 1, 1, 1
        by[nm].setdefault("AddEffects", []).append(e); n += 1
    if "rrb_clash_chase1" in by:
        # (0.9.0; testers, 2026-10-03 / 10-04 / 10-07: "a bit too fast", "distracting", "quick flashes which kinda gave
        #  me discomfort", "a huge mess of unnecessary background effects, even though it's just a normal attack".)
        #  The backdrop only with the full charge (card 20709, rrb_clash_full's marker): the plain Clash has none
        import rrb_pots
        by["rrb_clash_chase1"].setdefault("AddBuff", []).append(B.bp.buff(CLASH_BG, 0.0, CLASH_BG_CAP, conds=[port.refs.buff(rrb_pots.FULL)]))
    for nm in CLASH_CHASE:
        if nm in by: by[nm].setdefault("RemoveBuff", []).append(rm(when=4))
    fin = [nm for nm in CLASH_FINISHES if nm in by]
    for nm in fin:
        by[nm].setdefault("RemoveBuff", []).append(rm(CLASH_BG_OUT))
    port.note("rrb_clash_chase1", "backdrop: %s on buff %s from the chase to %.2f s into the finish (%s); cap %.1f s; start flash on %d actions" % (
        CB.FINISH_FX, CLASH_BG, CLASH_BG_OUT, fin, CLASH_BG_CAP, n))


def after_weight_moves(B, port, by):
    """After build_ruby.weight_pass (it sets every hit's shake by class). The lead, 2026-10-02:
    - Buzzsaw's spin "needs more screenshake and more hits when you hold it" and must "drag the enemy down with ruby as
      it falls": every spin hit kicks the camera (BUZZ shake), the held dive hits every BUZZ iv, and each hit carries
      the target along downward (BUZZ drag) instead of knocking it up;
    - "the last hit of rubys basic attack needs to drag the enemy upwards into her horizontal position so she can keep
      comboing": 5AAAA's pass launches the target and carries it to her (A4_LIFT), not away; and hidden 39's rose gust."""
    import rrb_pots
    fp, fv = B.fp, B.fv
    nb = na = ng = 0
    for name, a in by.items():
        if name.startswith("rrb_buzzsaw") and not name.startswith("rrb_buzzsaw_land"):
            s = 3 if "_s3" in name else 2 if "_s2" in name else 1
            L = BUZZ[s]
            spin = [h for h in a.get("HitDataList") or [] if fv(h["TickRange"].get("HitInterval") or {"value": 0}) > 0]
            for h in spin:
                if name.startswith("rrb_buzzsaw_ex"): h["TickRange"]["HitInterval"] = fp(L["iv"])
                sx, sy, du = L["shake"]; h["CamShake"] = {"Time": 0.0, "ShakeStr": {"x": sx, "y": sy}, "Duration": du}
                drag = L.get("drag", BUZZ_DRAG)
                rrb_pots.push(B, h, x=drag[0], y=drag[1])
                nb += 1
            if spin and name.startswith("rrb_buzzsaw_ex") and name in B.DMG:
                span = max(fv(h["TickRange"]["End"]) - fv(h["TickRange"]["Start"]) for h in spin)
                B.DMG[name] = (B.DMG[name][0], max(1, int(span / L["iv"])))
        elif name.startswith("rrb_a4"):
            for h in a.get("HitDataList") or []:
                rrb_pots.victim(B, port, h, "launch"); rrb_pots.push(B, h, x=A4_LIFT[0], y=A4_LIFT[1])
                na += 1
            a4_gust(B, port, a); ng += 1
    port.note("rrb_buzzsaw_ex", "spin: %d hits drag down (stage drags %s), shake by stage; 5AAAA: %d hits lift to her (%s)" % (
        nb, [BUZZ[s].get("drag", BUZZ_DRAG) for s in (1, 2, 3)], na, A4_LIFT))
    port.note("rrb_a4", "hidden 39 (20703 + Semblance): rose gust rrb_gust_a4 on hit, %.1f u ahead; launched targets tagged %s for %.1f s (%d actions)" % (
        A4_GUST["at"], A4_TAG, A4_TAG_T, ng))
    launch_heights(B, port, by)
    hold_moves(B, port, by)   # the holds (Guillotine, Red Reaper): after weight_pass and every variant, before assembly
    clash_bg(B, port, by)     # Clash Assault's BBTAG backdrop


# Clash Assault's follow-up, "stage 4" (the lead, 2026-10-02: "can all the final up attacks during the auto clash follow
# up get a new stage of attacks called stage 4 that are even bigger even stronger break armor knock bosses back and can
# the last hit hit all enemies on screen 5 times"). At her full power (stage 3) the follow-up's finish (and the full
# charge's flurry finish) is a stage 4 copy: hit boxes and effects x S4["k"], damage x S4["dmg"], armour break, a hard
# knock-back; its last hit sends a cut through every enemy on screen five times (rrb_clash_storm)
S4 = dict(k=1.6, dmg=2.0, armor=10, knock=(14.0, 7.0), shake=(0.45, 0.30, 0.25))
STORM = dict(box=(-11.5, -1.5, 11.5, 8.0), hits=5, iv=0.08, dmg=2.5, shake=(0.22, 0.15, 0.07))
S4_FINISHES = ("rrb_clash_finish", "rrb_clash_exfinish")


def clash_stage4(B, port, by, P, role_t):
    import rrb_pots
    fp, fv = B.fp, B.fv
    st3 = port.refs.buff("rrb_stage3")
    made = {}
    for base in S4_FINISHES:
        if base not in by: continue
        v = copy.deepcopy(by[base]); v["Name"] = base + "_s4"
        v["ActionSwitchs"] = [s for s in v.get("ActionSwitchs") or [] if not ((s.get("NewActionEx") or {}).get("ConstValue") or "").startswith("rrb_clash")]
        H = v.get("HitDataList") or []
        for h in H:
            hb = h["HitBox"]
            for c in ("Min", "Max"):
                for ax in ("x", "y"):
                    hb[c][ax] = fp(fv(hb[c][ax]) * S4["k"])
            h["ArmorBreak"] = S4["armor"]
            rrb_pots.victim(B, port, h, "knock"); rrb_pots.push(B, h, x=S4["knock"][0], y=S4["knock"][1])
        for e in v.get("AddEffects") or []:
            if "/trail_" in e["NameEx"]["ConstValue"]: continue          # (her blade's own trail stays on the blade)
            for ax in ("x", "y"):
                e["Scale"][ax] = fp(fv(e["Scale"][ax]) * S4["k"])
        if H:
            t_last = max(fv(h["TickRange"]["Start"]) for h in H)
            sx, sy, du = S4["shake"]
            v.setdefault("CameraShake", []).append({"Time": float(t_last), "ShakeStr": {"x": sx, "y": sy}, "Duration": du})
            v.setdefault("AddRoles", []).append(B.bp.role(role_t, B.BID, "rrb_clash_storm", round(t_last, 3), 0.0, 0.0))
        d, n = B.DMG.get(base, (1.8, 1))
        B.DMG[v["Name"]] = (round(d * S4["dmg"], 3), n)
        by[v["Name"]] = v; made[base] = v["Name"]
    # at stage 3 the finishes become stage 4 (first: a switch listed earlier wins)
    if "rrb_clash_finish" in made:
        f = by["rrb_clash_finish"]; sw = []
        if "rrb_clash_exfinish" in made:
            sw.append(B.bp.switch(made["rrb_clash_exfinish"], [st3, port.refs.buff(P.FULL)], start_type=1, nt=1, t0=0.0, t1=0.05))
        sw.append(B.bp.switch(made["rrb_clash_finish"], [st3], start_type=1, nt=1, t0=0.0, t1=0.05))
        f["ActionSwitchs"] = sw + (f.get("ActionSwitchs") or [])
    if "rrb_clash_exfinish" in made:
        x = by["rrb_clash_exfinish"]
        x["ActionSwitchs"] = [B.bp.switch(made["rrb_clash_exfinish"], [st3], start_type=1, nt=1, t0=0.0, t1=0.05)] + (x.get("ActionSwitchs") or [])
    port.note("rrb_clash_finish", "stage 4 at stage 3: %s; x%.1f boxes and effects, x%.1f damage, armour break %d, knock %s; last hit: rrb_clash_storm (%d hits on screen)" % (
        list(made.values()), S4["k"], S4["dmg"], S4["armor"], S4["knock"], STORM["hits"]))


def a4_gust_zone(B, port, zone):
    """hidden 39's rose gust (a4_gust): Petal Burst's rose wind once (the squall, three wipes from behind her, the vortex
    at its centre); light hits every A4_GUST["iv"] s that skip the enemy the pass launched (A4_TAG) and every frozen one;
    a sideways pull to its centre (the stock ForceField addMove attract, as Taokaka's up3; StrengthY 0, so it never
    changes a launch's height). Bosses and Elites resist ForceFields (NoForceField)"""
    import rrb_pots
    fp, G = B.fp, A4_GUST
    x0, y0, x1, y1 = G["box"]
    a = zone("rrb_gust_a4", G["dur"], [x0, y0, x1, y1], G["iv"], ["Role/Rrb/rrb_petal_gust"], "light")
    h = a["HitDataList"][0]
    h["TickRange"]["Start"] = fp(G["t0"]); h["TickRange"]["End"] = fp(G["t1"])
    rrb_pots.push(B, h, x=0.0, y=G["pop"])                       # a light hop; the pull carries them, not the hit
    h["ExcludeTags"] = list(h.get("ExcludeTags") or []) + [A4_TAG]
    kx, ky, kd = G["kick"]                                       # (the strike's own heavy shake carries the first wipe)
    a["CameraShake"] = [{"Time": float(w), "ShakeStr": {"x": kx, "y": ky}, "Duration": kd} for w in WIPES[1:]]
    a["ForceFields"] = [{"TimeRange": {"Start": fp(0.05), "Finish": fp(G["t1"])}, "ConditionGroup": {"Combine": 0, "Conditions": []},
                         "Area": {"Min": {"x": fp(x0), "y": fp(y0)}, "Max": {"x": fp(x1), "y": fp(y1)}},
                         "ForceType": 2, "Dir": 1, "FactionFilter": 2, "PushInvincipalLvl": 0,
                         "Strength": fp(G["pull"]), "StrengthY": fp(0.0)}]
    B.DMG["rrb_gust_a4"] = (G["dmg"], int((G["t1"] - G["t0"]) / G["iv"] + 1e-6) + 1)   # 4 ticks: 0.1, 0.3, 0.5, 0.7

def clash_storm_zone(B, port, zone):
    """the stage 4 finish's last hit: every enemy on screen is cut STORM hits times (the cuts are hit effects on each
    target: after_weight)"""
    a = zone("rrb_clash_storm", STORM["hits"] * STORM["iv"] + 0.05, list(STORM["box"]), STORM["iv"], [], "knock")
    a["HitDataList"][0]["TickRange"]["End"] = B.fp(STORM["hits"] * STORM["iv"] - 0.01)
    a["HitDataList"][0]["ArmorBreak"] = S4["armor"]
    sx, sy, du = STORM["shake"]
    a["CameraShake"] = [{"Time": round(i * STORM["iv"], 3), "ShakeStr": {"x": sx, "y": sy}, "Duration": du} for i in range(STORM["hits"])]
    B.DMG["rrb_clash_storm"] = (STORM["dmg"], STORM["hits"])


# 0.9.0 Sy-Pod Shot: one heavy round per pull, and more while Skill stays held. Testers, 2026-10-04 / 10-07: the
# scythe-mode shot "should deal higher damage rather than firing two or three times ... for blasting enemies from a
# distance, with consitent hold unless you interupt it"; "Add movement dash cancel after activating the attack so the
# character does not easily get hit"; "reduce the damage from Sypod Shot" at full power (five rounds of 3.4 and five
# bursts from one 50 MP pull at stage 3).
#   scale  the one round's damage against the plain Sy-Pod round's (1.5): 2.6 where two rounds gave 3.0. At stage 3
#          the round is s4_max (3.4, its burst 1.2), one where there were five
#   more   MP for each further round while Skill stays held; `back` of it returns with card 20711
#   extra  ticks the firing frames hold between two held rounds (before the 0.75 retime): a round every 0.34 s
#          (in game, 2026-10-09: the check fires as its window opens, so the pace is the block less `check`;
#          with a 0.07 s window and 6 ticks the rounds came every 0.27 s)
#   dash   s: a Gun Blast leaves the plant from here (it was after the last round)
#   check  s before the end of the firing frames in which Skill, still held, fires again (two logic ticks)
SY = dict(scale=1.75, more=30, back=10, extra=9, loops=("rrb_syloop1", "rrb_syloop2"), dash=0.2, check=0.034)
SY_T = {}                        # t1, t2 (s) and snd_end (state time) of the built Sy-Pod, for the sound pass and the rows


def _retime(B, a, f):
    """move every timed entry of `a`: f(t) -> its new time, or None to drop the entry"""
    fp, fv = B.fp, B.fv
    def lst(key, get, put):
        out = []
        for x in a.get(key) or []:
            t = f(get(x))
            if t is None: continue
            put(x, max(0.0, round(t, 6))); out.append(x)        # (never a hair below zero: such an entry would not play)
        if key in a or out: a[key] = out
    def role_put(r, t):
        d = t - fv(r["TimeConfig"]["Start"])
        if fv(r["TimeConfig"]["End"]) > 0: r["TimeConfig"]["End"] = fp(fv(r["TimeConfig"]["End"]) + d)
        r["TimeConfig"]["Start"] = fp(t)
    def hit_put(h, t):
        d = t - fv(h["TickRange"]["Start"])
        h["TickRange"]["End"] = fp(fv(h["TickRange"]["End"]) + d); h["TickRange"]["Start"] = fp(t)
    lst("AddEffects", lambda e: fv(e["Start"]), lambda e, t: e.__setitem__("Start", fp(t)))
    lst("Audios", lambda x: float(x["Time"]), lambda x, t: x.__setitem__("Time", float(t)))
    lst("CameraShake", lambda c: float(c["Time"]), lambda c, t: c.__setitem__("Time", float(t)))
    lst("AddMotions", lambda m: fv(m["Time"]), lambda m, t: m.__setitem__("Time", fp(t)))
    lst("AddRoles", lambda r: fv(r["TimeConfig"]["Start"]), role_put)
    lst("HitDataList", lambda h: fv(h["TickRange"]["Start"]), hit_put)


def sypod_held(B, port, by, P):
    """Sy-Pod and its card version, built with BBTAG's two rounds, become the plant and ONE round (the second round's
    firing frames, flash, casing, sounds and round go; the recovery moves up), fired at SY["scale"]; at stage 3 the
    round is s4_max. At the end of the firing frames, Skill still held starts a loop action (two, taking turns: an
    action cannot switch to itself) through its own input-less row, which holds the MP price: the firing frames
    again with one more round, then the same check; without the MP or the button the recovery plays."""
    import rrb_sound
    fp, fv = B.fp, B.fv
    k = B.RETIMED.get("rrb_sypod", 0.75)
    held = lambda: port.refs.input(3, 2)
    done = []
    for n in [x for x in by if x == "rrb_sypod" or x.startswith("rrb_sypod_")]:
        a = by[n]
        shots = sorted({round(fv(r["TimeConfig"]["Start"]), 4) for r in a.get("AddRoles") or []
                        if (r.get("StartActionEx") or [{}])[0].get("ConstValue") in ("s4", "s4_hc")})
        if len(shots) < 2:
            port.note(n, "0.9.0 Sy-Pod: fewer than two rounds found (%s): left as it is" % shots); continue
        t1, t2 = shots[0], shots[1]; blk = t2 - t1; rec = t2 + blk
        _retime(B, a, lambda t: None if t2 - 0.02 <= t < rec - 0.02 else (t - blk if t >= rec - 0.02 else t))
        for key in ("TotalDuration", "AnimateDuration"): a[key] = fp(fv(a[key]) - blk)
        a["Animate"] = "%s_sypod_one" % B.ROLE
        roles = []
        for r in a.get("AddRoles") or []:
            nm = (r.get("StartActionEx") or [{}])[0].get("ConstValue")
            if nm in ("s4", "s4_hc") and abs(fv(r["TimeConfig"]["Start"]) - t1) < 0.02:
                r3 = copy.deepcopy(r)
                r["DamageScaleV"]["ConstValue"] = fp(SY["scale"])
                r["ConditionGroup"] = P.cg(list(r["ConditionGroup"]["Conditions"]) + [port.refs.buff("rrb_stage3", invert=1)])
                r3["StartActionEx"][0]["ConstValue"] = "s4_max"
                r3["ConditionGroup"] = P.cg(list(r3["ConditionGroup"]["Conditions"]) + [port.refs.buff("rrb_stage3")])
                roles += [r, r3]
            else: roles.append(r)
        a["AddRoles"] = roles
        a["ActionSwitchs"] = [x for x in a.get("ActionSwitchs") or [] if (x.get("NewActionEx") or {}).get("ConstValue") != "rrb_sypod_five"]
        a["ActionSwitchs"].append(B.bp.switch(SY["loops"][0], [held()], start_type=1, nt=1, t0=round(t2 - SY["check"], 3), t1=round(t2 - 0.005, 3), mode=1))
        if n == "rrb_sypod": SY_T.update(t1=t1, t2=t2, blk=blk, snd_end=round((t2 - 0.02) / k, 4))
        done.append(n)
    if "t1" not in SY_T:
        port.note("rrb_sypod", "0.9.0 Sy-Pod: the base action was not rebuilt: no held rounds"); return
    t1, t2, blk = SY_T["t1"], SY_T["t2"], SY_T["blk"]
    # the un-plant's fold sound, where BBTAG plays it (0.075 s into the recovery); the sound pass stops reading the
    # state's cues before its second round (build_logic: snd_end)
    rrb_sound.SOUND_PLAN["rrb_sypod"] = [("rrbse_13", round(t2 + 0.075, 3))]
    base = by["rrb_sypod"]
    lblk = round((21 + SY["extra"]) / 60.0 * k, 4)
    for i, ln in enumerate(SY["loops"]):
        c = copy.deepcopy(base); c["Name"] = ln
        _retime(B, c, lambda t: None if t < t1 - 0.005 else (t - t1 if t < t2 - 0.02 else t - t2 + lblk))
        c["HitDataList"] = []; c["HitAudios"] = []; c["HitEffects"] = []
        c["Animate"] = "%s_sypod_loop" % B.ROLE
        for key in ("TotalDuration", "AnimateDuration"): c[key] = fp(lblk + blk)
        c["ActionSwitchs"] = [B.bp.switch(SY["loops"][1 - i], [held()], start_type=1, nt=1, t0=round(lblk - SY["check"], 3), t1=round(lblk - 0.005, 3), mode=1)]
        c["MuteSkills"] = []
        c["ScriptCalls"] = [s for s in c.get("ScriptCalls") or [] if s["Call"]["Function"] != "ChangeMP"] + [
            B.bp.call(0.02, "ChangeMP", "mp:%d, chain:2" % SY["back"], [P.T(B, port, "sypod_three")])]
        by[ln] = c; B.RETIMED[ln] = k
        rrb_sound.SOUND_PLAN[ln] = [("rrbse_02", 0.0), ("rrbse_01", 0.075), ("rrbse_13", round(lblk + 0.075, 3))]
    port.note("rrb_sypod", "0.9.0: one round at %.3f s (x%.2f; s4_max at stage 3) on %s; firing frames end at %.3f s; held: %s, a round every %.3f s for %d MP "
              "(%d back with 20711); recovery %.3f s" % (t1, SY["scale"], done, t2, list(SY["loops"]), lblk, SY["more"], SY["back"], blk))


def guns(B, port, by, P):
    fp, fv = B.fp, B.fv
    st3 = port.refs.buff("rrb_stage3")
    keep = lambda a, drop: [x for x in a.get("ActionSwitchs") or [] if not any(((x.get("NewActionEx") or {}).get("ConstValue") or "").startswith(d) for d in drop)]
    # the burst: a copy of Rifle Shot (its hold and chord switches kept, not the card variants'); 0.9.0: and of the
    # re-fire from the aiming pose, on its own clips
    for base_n, clip_b, clip_s in (("rrb_rifleshot", "rifle_burst", "longshot"), ("rrb_rifleshot_r", "rifle_burst_re", "longshot_re")):
        if base_n not in by: continue
        base = by[base_n]
        burst = copy.deepcopy(base); burst["Name"] = base_n + "_burst"
        burst["ActionSwitchs"] = keep(burst, ("rrb_rifleshot",))
        t0 = min(fv(r["TimeConfig"]["Start"]) for r in base["AddRoles"])
        ext = (port.LEN[clip_b] - port.LEN[clip_s]) / 60.0
        burst["Animate"] = "rrb_" + clip_b
        for k in ("AnimateDuration", "TotalDuration"):
            burst[k] = fp(fv(base[k]) + ext)
        _shift_after(B, burst, t0 + 0.08, ext)
        times = [t0 + i * BURST_GAP for i in range(3)]
        _sequence(B, burst, t0, times, ["b7_max"] * 3, SHAKE_BURST, scale=1.25)
        by[burst["Name"]] = burst
        base["ActionSwitchs"] = [B.bp.switch(burst["Name"], [st3], start_type=1, nt=1, t0=0.0, t1=0.02)] + (base.get("ActionSwitchs") or [])
        port.note(burst["Name"], "stage 3 Rifle Shot: rounds b7_max at %s s, clip +%.3f s" % ([round(t, 3) for t in times], ext))
    # 0.9.0: Sy-Pod is one heavy round per pull, and more while Skill stays held (sypod_held); at stage 3 the round is
    # s4_max (until 0.8: five rounds from one pull)
    sp = by["rrb_sypod"]
    # a card variant Sy-Pod picks in its first frames gets a later window too (0.6.5 game test: held into from Rifle
    # Shot, a skill change, the first-frame switch never fired and the card's version never came out)
    late = []
    for x in sp.get("ActionSwitchs") or []:
        tgt = (x.get("NewActionEx") or {}).get("ConstValue") or ""
        if tgt.startswith("rrb_sypod_") and fv(x["TimeCheck"]["Start"]) < 1e-6 and fv(x["TimeCheck"]["End"]) <= 0.05 + 1e-6:
            y = copy.deepcopy(x); y["TimeCheck"]["Start"] = copy.deepcopy(x["TimeCheck"]["End"]); y["TimeCheck"]["End"] = fp(0.3)
            late.append(y)
    sp["ActionSwitchs"] = (sp.get("ActionSwitchs") or []) + late
    port.note("rrb_sypod", "later windows for its card variants: %s" % [(y.get("NewActionEx") or {}).get("ConstValue") for y in late])
    sypod_held(B, port, by, P)


# Buzzsaw EX by stage (the lead: "make each level a recognizable improvement"; document size, hits, interval, duration,
# damage). k: the saw's hit boxes and effects scale; iv: the spin's hit interval (per target); dmg / land: the dive's
# and the landing's damage budgets (x their stage-1 values); rnd: the landing round.
# fx: the saw's effects scale (the lead, 2026-10-02: "the effect needs to be a lot bigger at stage 3"); shake: each spin
# hit's camera kick (x, y, s; "spin needs more screenshake and more hits when you hold it"; the weight class gave a
# flurry 0.08 / 0.05 for 0.05 s)
BUZZ = {1: dict(k=1.0, fx=1.0, iv=0.05, dmg=1.0, land=1.0, rnd="b7", shake=(0.14, 0.10, 0.06)),
        2: dict(k=1.35, fx=1.5, iv=0.045, dmg=1.4, land=1.35, rnd="b7_hc", shake=(0.18, 0.13, 0.06)),
        3: dict(k=1.9, fx=2.4, iv=0.04, dmg=2.0, land=1.9, rnd="b7_max", shake=(0.24, 0.17, 0.07), drag=(0.6, -3.4))}
# the spin drags what it hits down with her as she falls (the lead: "it also needs to drag the enemy down with ruby as
# it falls"): each hit sets the target moving with her, slightly ahead and downward, instead of knocking it up (4, 8)
BUZZ_DRAG = (1.5, -9.0)
# stage 3's dive (the lead, 2026-10-02: "stage 3 of buzzsaw held should have rwby descend slower in the air so that
# buzzsaw can get more hits in"): no gravity, a slow Linear descent of `down` u over `hang` s (`fwd` u ahead), then a
# plunge at `plunge` u/s that reaches the floor from any height before the action ends; the saw's hit box reaches its
# drawn rim below her (rrb_saw x4.2: about 5 u across, centred 1.3 u up), and the drag matches her descent (BUZZ[3] drag)
BUZZ3_DIVE = dict(hang=0.8, down=2.7, fwd=0.5, plunge=15.0, reach_down=-1.2)
# (the lead, 2026-10-10: "a circular slash on buzzsaw") at stages 2 and 3 every turn of the spin draws one red stroke
# round her at the saw's rim, the way she turns. spin: (effect tag, the saw's radius there, first turn, stage gate)
BUZZ_TURN = 0.2
BUZZ_RING = {"rrb_buzzsaw": ("t2", 1.05, 0.25, 2), "rrb_buzzsaw_ex_s2": ("s2", 1.55, 0.0, None), "rrb_buzzsaw_ex_s3": ("s3", 2.5, 0.0, None)}
BUZZ_RING_AT = (0.05, 1.3)        # the saw's centre on her (rrb_pots.moves_v2)
BUZZ_RING_LOOK = dict(shape="ring", style="slash", a0=150.0, turn=-330.0, k=1.22, ticks=10, kind="ring", draw=0.10, rest=0.18)


def buzz_rings(B, port, by, P, plan):
    """The rings ride her and end with the spin, as the saw does. No hit of their own: the saw's hits already grow
    with the stage (BUZZ)."""
    import rrb_fx
    for name, (tag, radius, first, stage) in BUZZ_RING.items():
        a = by.get(name)
        if a is None: continue
        fx = rrb_fx.WAVE_PREFIX + "buzz_ring_" + tag
        plan[fx] = {"wave": dict(BUZZ_RING_LOOK, radius=radius, thick=round(0.115 * radius, 3), rim=1.4 if tag == "s3" else 1.0)}
        gate = [port.refs.ground(1)] + ([port.refs.buff("rrb_stage%d" % stage)] if stage else [])
        t, n = first, 0
        while t < B.fv(a["TotalDuration"]) - 0.05:
            e = dict(B.fx_entry(port, fx, round(t, 3), dx=BUZZ_RING_AT[0], dy=BUZZ_RING_AT[1], attached=True), KillMode=2)
            e["ConditionGroup"] = P.cg(gate)
            a.setdefault("AddEffects", []).append(e); t += BUZZ_TURN; n += 1
        port.note(name, "a ring slash on every turn: %d from %.2f s, radius %.2f u (%s)" % (n, first, radius, fx))


def buzzsaw_levels(B, port, by, P):
    fp, fv = B.fp, B.fv
    ex, lx = by["rrb_buzzsaw_ex"], by["rrb_buzzsaw_land_ex"]
    made = []
    for s in (3, 2):
        L = BUZZ[s]; k = L["k"]
        v = copy.deepcopy(ex); v["Name"] = "rrb_buzzsaw_ex_s%d" % s
        w = copy.deepcopy(lx); w["Name"] = "rrb_buzzsaw_land_ex_s%d" % s
        for a in (v, w):
            for h in a.get("HitDataList") or []:
                hb = h["HitBox"]
                for c in ("Min", "Max"):
                    for ax in ("x", "y"):
                        hb[c][ax] = fp(fv(hb[c][ax]) * k)
            for e in a.get("AddEffects") or []:
                n = e["NameEx"]["ConstValue"]
                if "rrb_saw" in n or "muzzle" in n or "blast_burst" in n:
                    kf = L["fx"] if "rrb_saw" in n else k
                    for ax in ("x", "y"):
                        e["Scale"][ax] = fp(fv(e["Scale"][ax]) * kf)
        for h in v.get("HitDataList") or []:
            if fv(h["TickRange"].get("HitInterval") or {"value": 0}) > 0: h["TickRange"]["HitInterval"] = fp(L["iv"])
        for r in w.get("AddRoles") or []:
            for x in r.get("StartActionEx") or []:
                if x.get("ConstValue") == "b7": x["ConstValue"] = L["rnd"]
        v["OnGroundAction"] = w["Name"]; v["DropEndAction"] = w["Name"]
        # (0.6.0 game test: the dive lands through its ground-check switch, which still went to the stage 1 landing;
        #  and the landing copy kept the switch to the High Caliber landing)
        for x in v.get("ActionSwitchs") or []:
            if (x.get("NewActionEx") or {}).get("ConstValue") == "rrb_buzzsaw_land_ex": x["NewActionEx"]["ConstValue"] = w["Name"]
        w["ActionSwitchs"] = [x for x in w.get("ActionSwitchs") or [] if not ((x.get("NewActionEx") or {}).get("ConstValue") or "").startswith("rrb_buzzsaw_land_ex")]
        if s == 3:
            # the dive was the tap's Ease (3, -16) u over 1.6 s, EaseOut (about 20 u/s down at once) plus gravity (Flyin 0):
            # from a jump's height she landed about 0.15 s in, 4-5 spin hits. Now no gravity (Flyin 2 NoGravity with
            # DropEnd, as Ragna's skillAirEX: Flyin 2 + a Linear drift) and two Linear legs: a slow descent, then a plunge
            D = BUZZ3_DIVE
            v["Flyin"] = 2
            slow = B.glide(port, 0.0, D["fwd"], -D["down"], D["hang"]); slow["Motion"]["MotionType"] = 2      # AddMotionType Linear
            rest = round(fv(v["TotalDuration"]) - D["hang"], 3)
            plunge = B.glide(port, D["hang"], 0.0, -D["plunge"] * rest, rest); plunge["Motion"]["MotionType"] = 2
            v["AddMotions"] = [slow, plunge]
            for h in v.get("HitDataList") or []:
                if fv(h["TickRange"].get("HitInterval") or {"value": 0}) > 0:
                    h["HitBox"]["Min"]["y"] = fp(min(fv(h["HitBox"]["Min"]["y"]), D["reach_down"]))
            port.note(v["Name"], "stage 3 dive: no gravity, %.1f u down over %.1f s (%.1f u ahead), then %.0f u/s; spin box down to %.1f u" % (
                D["down"], D["hang"], D["fwd"], D["plunge"], D["reach_down"]))
        by[v["Name"]] = v; by[w["Name"]] = w
        d0, n0 = B.DMG["rrb_buzzsaw_ex"]; d1, n1 = B.DMG["rrb_buzzsaw_land_ex"]
        span = max(fv(h["TickRange"]["End"]) - fv(h["TickRange"]["Start"]) for h in v["HitDataList"])
        B.DMG[v["Name"]] = (round(d0 * L["dmg"], 3), max(1, int(span / L["iv"])))
        B.DMG[w["Name"]] = (round(d1 * L["land"], 3), n1)
        made.append((s, v["Name"]))
    ex["ActionSwitchs"] = [B.bp.switch(n, [port.refs.buff("rrb_stage%d" % s)], start_type=1, nt=1, t0=0.0, t1=0.02) for s, n in made] + (ex.get("ActionSwitchs") or [])
    # at stage 3 a TAP is the full held dive too (the lead, 2026-10-02: "at stage 3 even tap buzzsaw should be the held full
    # strong version"): the hold check's switch is copied without its held-Skill condition, gated on stage 3
    st3 = port.refs.buff("rrb_stage3")
    refs = {r["rid"]: r for r in port.refs.items}
    for name, a in by.items():
        if not name.startswith("rrb_buzzsaw") or name.startswith(("rrb_buzzsaw_land", "rrb_buzzsaw_ex")): continue
        add = []
        for s in a.get("ActionSwitchs") or []:
            if ((s.get("NewActionEx") or {}).get("ConstValue") or "") != "rrb_buzzsaw_ex": continue
            c = copy.deepcopy(s)
            kept = [x for x in c["ConditionGroup"]["Conditions"] if "InputKey" not in ((refs.get(x["rid"]) or {}).get("data") or {})]
            if len(kept) == len(c["ConditionGroup"]["Conditions"]): continue      # (no held-Skill condition found: leave it)
            c["ConditionGroup"]["Conditions"] = kept + [st3]
            add.append(c)
        if add: a["ActionSwitchs"] = add + a["ActionSwitchs"]
    port.note("rrb_buzzsaw_ex", "Buzzsaw EX levels: " + "; ".join("stage %d: x%.2f size, every %.2f s, dive %.2f / landing %.2f budget, round %s" % (
        s, BUZZ[s]["k"], BUZZ[s]["iv"], B.DMG["rrb_buzzsaw_ex"][0] * BUZZ[s]["dmg"], B.DMG["rrb_buzzsaw_land_ex"][0] * BUZZ[s]["land"], BUZZ[s]["rnd"]) for s in (1, 2, 3)))


# ---------------------------------------------------------------- stage 3 finishers (the lead, 2026-09-30)
# Petal Dance at stage 3: a gigantic storm (its hits reach most of the screen, a screen-wide petal storm), and the
# finale (BBTAG's second segment: she raises Crescent Rose and brings it down) only if the storm hit someone, with the
# Red Reaper's sky and flash as its cut-scene. Guillotine at stage 3: when it has hit, a horizontal screen-wide slash
# (rrb_guil_wave) with the flash. Placeholder art until the supers' effects pass (V2_COVERAGE F1-F4).
PD_BOX = (-5.0, 0.0, 11.0, 5.0)
FIN_BOX = (-9.0, -0.5, 13.0, 7.0)
WAVE_BOX = (-8.5, -0.6, 13.5, 3.2)
WAVE_FX = (7.0, 2.0, -8.0, 0.6)       # the wave's arc: x scale, y scale, x, y. Low Sweep's arc spans ~3 u (its box
                                      # -0.3..2.8): x7 = ~21 u from -8 u, which WAVE_BOX follows (the move viewer's canvas
                                      # is too narrow to show it whole: the in-game look is still to be checked)
PB_QUICK = {2: (0.3, 1.5 / 1.3), 3: (0.6, 1.5 / 1.6)}     # Petal Burst's startup: speed-up and its real length (s)
PB_BLAST = 0.3                                            # stage 3: Gun Blast from this long into the gust


def _box(h, b, fp):
    h["HitBox"] = {"Min": {"x": fp(b[0]), "y": fp(b[1])}, "Max": {"x": fp(b[2]), "y": fp(b[3])}}


def finishers(B, port, by, P):
    fp, fv = B.fp, B.fv
    st3 = port.refs.buff("rrb_stage3")
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    # the Red Reaper sky and white-out, built here the way build_ruby builds Red Reaper's (a copy of Mi's AH_pre backdrop
    # entry, renamed). They were read from rrb_redreaper, which gets them later in the build (build_ruby.effects runs after
    # this): both came back None, so the finale and the Guillotine wave never had them (0.6.2 game test, 2026-09-30)
    import ruby_fx
    heidi = next(e for e in next(x for x in B.bp.logic("mi")["_actions"] if x["Name"] == "AH_pre")["AddEffects"]
                 if "heidi" in e["NameEx"]["ConstValue"])
    sky = copy.deepcopy(heidi); sky["NameEx"]["ConstValue"] = ruby_fx.ASTRAL_FX; sky["KillMode"] = 2
    flash = copy.deepcopy(heidi); flash["NameEx"]["ConstValue"] = ruby_fx.FLASH_FX; flash["KillMode"] = 2
    FLASH_LEN = B.RR_FLASH[1] - B.RR_FLASH[0]                  # Red Reaper's white-out: 0.13 s, then it fades
    def remove_at(a, t, name): a.setdefault("RemoveEffect", []).append({"Tick": fp(t), "ConditionGroup": {"Combine": 0, "Conditions": []}, "Name": name})
    # Petal Dance
    pd = by["rrb_petaldance"]
    L0, L1 = port.LEN["petaldance_storm"] / 60.0, port.LEN["petaldance_fin"] / 60.0
    storm = copy.deepcopy(pd); storm["Name"] = "rrb_petaldance_s3"; storm["ActionSwitchs"] = []
    storm["Animate"] = "rrb_petaldance_storm"
    for k in ("AnimateDuration", "TotalDuration"): storm[k] = fp(L0)
    storm["HitDataList"] = [h for h in storm["HitDataList"] if fv(h["TickRange"]["Start"]) < L0 - 0.1]
    for h in storm["HitDataList"]: _box(h, PD_BOX, fp)
    r = B.bp.role(role_t, B.BID, "rrb_pd_storm", 1.2, 0.0, 0.0); storm.setdefault("AddRoles", []).append(r)
    storm["ActionSwitchs"] = [B.bp.switch("rrb_petaldance_fin", [port.refs.hit(within=L0)], start_type=1, nt=1, t0=L0 - 0.08, t1=L0)]
    fin = copy.deepcopy(pd); fin["Name"] = "rrb_petaldance_fin"; fin["ActionSwitchs"] = []
    fin["Animate"] = "rrb_petaldance_fin"
    for k in ("AnimateDuration", "TotalDuration"): fin[k] = fp(L1)
    fin["HitDataList"] = [h for h in fin["HitDataList"] if fv(h["TickRange"]["Start"]) >= L0 - 0.05]
    strike = None
    for h in fin["HitDataList"]:
        for k in ("Start", "End"): h["TickRange"][k] = fp(max(0.0, fv(h["TickRange"][k]) - L0))
        _box(h, FIN_BOX, fp); strike = fv(h["TickRange"]["Start"])
    fin["AddMotions"] = []
    fin["AddEffects"] = [e for e in fin.get("AddEffects") or [] if fv(e["Start"]) >= L0]
    for e in fin["AddEffects"]: e["Start"] = fp(fv(e["Start"]) - L0)
    if sky: e = copy.deepcopy(sky); e["Start"] = fp(0.0); fin["AddEffects"].append(e)
    if flash and strike is not None:
        e = copy.deepcopy(flash); e["Start"] = fp(max(0.0, strike - 0.05)); fin["AddEffects"].append(e)
        remove_at(fin, max(0.0, strike - 0.05) + FLASH_LEN, ruby_fx.FLASH_FX)
    if strike is not None: fin["CameraShake"] = [{"Time": float(strike), "ShakeStr": {"x": 0.45, "y": 0.3}, "Duration": 0.35}]
    for x in (storm, fin):
        for inv in x.get("Invincibility") or []:
            for k in ("TimeRange", "Range"):
                if k in inv: inv[k]["Start"] = fp(0); inv[k][[y for y in inv[k] if y != "Start"][0]] = fp(fv(x["TotalDuration"]))
    by[storm["Name"]] = storm; by[fin["Name"]] = fin
    pd["ActionSwitchs"] = [B.bp.switch(storm["Name"], [st3], start_type=1, nt=1, t0=0.0, t1=0.02)] + (pd.get("ActionSwitchs") or [])
    B.FX_ACTIONS[fin["Name"]] = (["UltimateDance"], L0, None)       # its sounds: the move's second half
    B.DMG[storm["Name"]] = (round(B.DMG["rrb_petaldance"][0] * 0.75, 3), len(storm["HitDataList"]))
    B.DMG[fin["Name"]] = (round(B.DMG["rrb_petaldance"][0] * 0.9, 3), max(1, len(fin["HitDataList"])))
    port.note(storm["Name"], "stage 3 Petal Dance: storm %.2f s, box %s; finale %.2f s only on a hit (strike at %s s)" % (L0, PD_BOX, L1, strike))
    # Guillotine: the slash on hit, at its last strike (the plain move and every variant; the hold version at its end)
    n = 0
    for name, a in list(by.items()):
        if not (name == "rrb_guillotine" or name.startswith("rrb_guillotine_") or name == "rrb_guil_end"): continue
        last = max((fv(h["TickRange"]["End"]) for h in a.get("HitDataList") or []), default=None)
        if last is None: continue
        t = last + 0.02
        cond = P.cg([st3, port.refs.hit(within=t + 0.05)])
        r = B.bp.role(role_t, B.BID, "rrb_guil_wave", t, 0.0, 0.0); r["ConditionGroup"] = cond
        a.setdefault("AddRoles", []).append(r)
        # (game review 2026-10-02: the screen went grey-white for 0.33 s under it and hid her; the white-out belongs to
        #  the supers.) The slash kicks the camera instead
        a.setdefault("CameraShake", []).append({"Time": float(t), "ShakeStr": {"x": 0.3, "y": 0.18}, "Duration": 0.2})
        n += 1
    port.note("rrb_guillotine", "stage 3: the screen-wide slash on hit (%d actions)" % n)
    # Petal Burst: shorter startup at stages 2 / 3 (action speed-up until the dash), Gun Blast from the gust at 3
    for name, a in by.items():
        if not (name == "rrb_petalburst" or name.startswith("rrb_petalburst_")): continue
        for st_, (k, real) in PB_QUICK.items():
            e = B.bp.buff("rrb_pb_quick", 0.0, round(real, 3), strength=k); e["ConditionGroup"] = P.cg([port.refs.buff("rrb_stage%d" % st_)])
            a.setdefault("AddBuff", []).append(e)
        e = B.bp.buff(P.BLASTING, GUST_T + PB_BLAST, max(0.1, fv(a["TotalDuration"]) - GUST_T - PB_BLAST), conds=[port.refs.buff("rrb_stage3", invert=1)])
        e["Buff"]["Stack"] = P.GATE_STACK
        a["AddBuff"].append(e)


def _later(B, a, t_from, dt):
    """everything of `a` timed at or after t_from happens dt later; a window open across t_from ends dt later"""
    fp, fv = B.fp, B.fv
    late = lambda v: fv(v) >= t_from - 1e-6
    mv = lambda v: fp(fv(v) + dt) if late(v) else v
    for key, at in (("AddMotions", "Time"), ("AddEffects", "Start"), ("AddBuff", "Time"), ("RemoveBuff", "Time"), ("MuteSkills", "Time"),
                    ("RemoveEffect", "Tick"), ("CDList", "Time")):
        for x in a.get(key) or []:
            if isinstance(x.get(at), dict): x[at] = mv(x[at])
    for key in ("Audios", "CameraShake"):
        for x in a.get(key) or []:
            if float(x["Time"]) >= t_from - 1e-6: x["Time"] = float(x["Time"]) + dt
    for key, box, s, e in (("FreeMoves", "TimeRange", "Start", "Finish"), ("PlatMoveLimit", "TimeRange", "Start", "Finish"),
                           ("Armors", "TimeRange", "Start", "Finish"), ("Invincibility", "TimeRange", "Start", "Finish"),
                           ("OverridePhysics", "TimeRange", "Start", "Finish"), ("SpeedChanges", "TimeRange", "Start", "Finish"),
                           ("TimeScales", "TimeRange", "Start", "Finish"), ("ActionSwitchs", "TimeCheck", "Start", "End"),
                           ("CollisionSwitchList", "TimeCheck", "Start", "End"), ("ScriptCalls", "TimeConfig", "Start", "End"),
                           ("AddRoles", "TimeConfig", "Start", "End"), ("RemoveBuff", "TimeConfig", "Start", "End"),
                           ("MuteSkills", "TimeConfig", "Start", "End"), ("HitDataList", "TickRange", "Start", "End")):
        for x in a.get(key) or []:
            w = x.get(box)
            if not (isinstance(w, dict) and s in w and e in w): continue
            if fv(w[e]) > 0 and late(w[e]): w[e] = fp(fv(w[e]) + dt)      # (a zero end is "no end")
            w[s] = mv(w[s])


# 0.9.0 Guillotine's spin (the lead, 2026-10-09: "new animation for Guillotine's third hit"): the clip's run-up
# (ruby_clips guillotine_p) sits between the thrust's gunshot and the spin; she closes GUIL_RUN["dx"] u through both
GUIL_RUN = dict(t=39 / 60.0, ticks=6, dx=1.6, over=0.24)


def guil_runup(B, port, by):
    """every Guillotine that plays the full clip: the run-up clip, its later times GUIL_RUN["ticks"] later, the advance"""
    fp, fv = B.fp, B.fv
    clip, dt = "guillotine_p", GUIL_RUN["ticks"] / 60.0
    if clip not in port.LEN: return
    done = []
    for n, a in by.items():
        if a.get("Animate") != "rrb_guillotine" or not n.startswith("rrb_guillotine") or n.endswith(("_w2", "_w3", "_v2")): continue
        _later(B, a, GUIL_RUN["t"] - 0.005, dt)
        a["Animate"] = "rrb_" + clip; a["AnimateDuration"] = fp(port.LEN[clip] / 60.0); a["TotalDuration"] = fp(fv(a["TotalDuration"]) + dt)
        a.setdefault("AddMotions", []).append(B.glide(port, GUIL_RUN["t"], GUIL_RUN["dx"], 0.0, GUIL_RUN["over"], ease=2))
        done.append(n)
    port.note("rrb_guillotine", "run-up before the spin: clip %s, times from %.2f s moved %.2f s later, %.1f u forward over %.2f s (%s)" % (
        clip, GUIL_RUN["t"], dt, GUIL_RUN["dx"], GUIL_RUN["over"], ", ".join(done)))


# 0.9.0 the air Rising Reap's own clip (ruby_clips atk5bbb_air): its air frames float AIR_REAP["dy"] u above the root and
# the swing's frames stand on it, so she rises that much as the swing starts and comes back down as it ends
AIR_REAP = dict(dy=0.4, up=13 / 60.0, down=49 / 60.0, over=2 / 60.0)


def air_reap_lift(B, port, by):
    for n, a in by.items():
        if a.get("Animate") != "rrb_atk5bbb_air" or not n.startswith("rrb_launcher_air"): continue
        a.setdefault("AddMotions", []).extend([B.glide(port, AIR_REAP["up"], 0.0, AIR_REAP["dy"], AIR_REAP["over"]),
                                               B.glide(port, AIR_REAP["down"], 0.0, -AIR_REAP["dy"], AIR_REAP["over"])])


# 0.9.0 cinematic starts (the lead, 2026-10-09: in Cross Tag her Down + Skill, Guillotine, Petal Dance and Petal Burst
# change the camera and lock the enemies on screen in place). Tick 3: the backdrop and rrb_cine on her (rrb_runtime
# rrbCineOn: the camera in, every enemy on screen held); tick 4: time all but stops for CINE["hold"] s, then eases back.
# All of it sits after the first ticks, where a move hands over to its card version or to Red Reaper.
# (hold, back) in real seconds: short on the two Skills (at 0.36 every Guillotine stood half a second), longer on the SP moves
CINE = dict(t=3 / 60.0, slow=0.05, push=4, dark=0.22, after=0.15, zoom=(0.25, 0.9), skill=(0.22, 0.10), sp=(0.40, 0.14))
CINE_BUFF, CINE_HOLD = "rrb_cine", "rrb_cine_hold"


def cine_moves(by):
    return [n for n in by if (n == "rrb_hook" or n.startswith(("rrb_guillotine", "rrb_petalburst", "rrb_petaldance"))) and
            not n.startswith("rrb_petaldance_fin") and not n.endswith(("_w2", "_w3", "_v2"))]


def cine_starts(B, port, by):
    fp, fv = B.fp, B.fv
    none = {"Combine": 0, "Conditions": []}
    dark = next(e for e in next(x for x in B.bp.logic("mi")["_actions"] if x["Name"] == "AH_pre")["AddEffects"] if "heidi" in e["NameEx"]["ConstValue"])
    res = dark["NameEx"]["ConstValue"]
    t, t1 = CINE["t"], CINE["t"] + 1 / 60.0
    scale = lambda dur, a_, b_: B.bp.call(t1, "ChangeTimeScale", "duration: %.2f, startTimeScale: %.2f, endTimeScale: %.2f, ignoreSetting: true" % (dur, a_, b_))
    names = cine_moves(by)
    for n in names:
        a = by[n]
        H = sorted(fv(h["TickRange"]["Start"]) for h in a.get("HitDataList") or [])
        first = H[0] if H else 0.3
        lock = round(max(0.1, first - t) + CINE["after"], 3)        # held until her first strike has landed
        zoom = round(min(max(first - t, CINE["zoom"][0]), CINE["zoom"][1]), 3)
        hold, back = CINE["sp" if n.startswith("rrb_petal") else "skill"]
        a.setdefault("ScriptCalls", []).extend([scale(hold, CINE["slow"], CINE["slow"]), scale(back, CINE["slow"], 1.0)])
        a.setdefault("AddBuff", []).append(B.bp.buff(CINE_BUFF, t, zoom, strength=lock))
        d = copy.deepcopy(dark); d["Start"] = fp(t); d["KillMode"] = 2
        if "ConditionGroup" in d: d["ConditionGroup"] = copy.deepcopy(none)
        a.setdefault("AddEffects", []).append(d)
        a.setdefault("RemoveEffect", []).append({"Tick": fp(t1 + CINE["dark"]), "ConditionGroup": copy.deepcopy(none), "Name": res})
    port.note("rrb_guillotine", "cinematic start (%s at %.3f s; time x%.2f for %.2f s, the SP moves %.2f s; backdrop %s): %s" % (
        CINE_BUFF, t, CINE["slow"], CINE["skill"][0], CINE["sp"][0], res, ", ".join(names)))


def after_sound(B, port, by, gunshot):
    import rrb_pots
    rrb_pots.final_v2(B, port, by)          # the last pass (stock links, commitment, the EX landing's effects)
    _after_sound(B, port, by, gunshot)
    guil_runup(B, port, by); air_reap_lift(B, port, by)
    cine_starts(B, port, by)


def _after_sound(B, port, by, gunshot):
    """after rrb_sound.wire: every round of the stage 3 burst / five rounds has exactly one gunshot on its firing tick
    (the sound pass keeps her clip's shot cues and drops a stock marker another shot cue covers within 0.3 s, which
    left the burst's second round silent)"""
    fv = B.fv
    for n in ("rrb_rifleshot_burst", "rrb_rifleshot_r_burst", "rrb_sypod_five") + tuple(JC_TIMES):
        a = by.get(n)
        if not a: continue
        shots = sorted(fv(r["TimeConfig"]["Start"]) for r in a.get("AddRoles") or [] if (r.get("StartActionEx") or [{}])[0].get("ConstValue") in MAX_ROUNDS)
        if n in JC_TIMES: shots = list(JC_TIMES[n])      # (0.9.0: j.C's three shots, one gunshot each)
        au = a.get("Audios") or []
        keep = []
        for x in au:     # a gunshot belongs to the nearest round; a second one on the same round goes
            if x.get("Cue") == gunshot:
                t = float(x["Time"]); near = min(shots, key=lambda s: abs(s - t)) if shots else None
                if near is not None and abs(near - t) < 0.04 and any(y.get("Cue") == gunshot and abs(float(y["Time"]) - near) < 0.04 for y in keep):
                    continue
            keep.append(x)
        for t in shots:
            if not any(x.get("Cue") == gunshot and abs(float(x["Time"]) - t) < 0.04 for x in keep):
                keep.append({"Cue": gunshot, "Time": float(t), "StopWhenChangeAction": 0, "CheckVoiceState": 0,
                             "ConditionGroup": {"Combine": 0, "Conditions": []}})
        a["Audios"] = sorted(keep, key=lambda x: float(x["Time"]))


def after_weight(B, port, btree):
    """after build_ruby.weight_pass (which sets every round's hit effects by class): the stage 3 rounds' impacts grow
    with their rounds"""
    fp, fv = B.fp, B.fv
    import rrb_fx
    for a in btree["_actions"]:
        if a["Name"] == "rrb_clash_storm":       # each of the five strikes cuts every enemy it reaches
            a["HitEffects"] = [B.fx_entry(port, rrb_fx.RR_CUT, 0.0, hit=True), B.fx_entry(port, "Role/Rrb/rrb_hit_h", 0.0, hit=True)]
        if rrb_fx._has_fx("rrb_hit_gun_heavy"):   # a heavy round's impact (fxkit_cross, 0.6.13)
            nm_ = a["Name"][:-2] if a["Name"].endswith("_p") else a["Name"]
            if nm_ in rrb_fx.HEAVY_ROUNDS or nm_ == "s4end_x":
                for e in (a.get("HitEffects") or []) + (a.get("AddEffects") or []):
                    n_ = e["NameEx"]["ConstValue"]
                    if n_.startswith("Role/Rrb/rrb_hit_gun") and "_heavy" not in n_:
                        e["NameEx"]["ConstValue"] = n_.replace("rrb_hit_gun", "rrb_hit_gun_heavy")
    for a in btree["_actions"]:
        M = MAX_ROUNDS.get(a["Name"])
        if not M: continue
        for e in a.get("HitEffects") or []:
            for ax in ("x", "y"):
                # (game review: at point-blank the stage 3 rounds' star bursts, x1.5-1.6, hid both characters)
                e["Scale"][ax] = fp(fv(e["Scale"][ax]) * min(M["box"] * 1.2, 1.2))
    # j.C's Dust rounds are large (gun_v2 caps a round's glow at 1.2): every Dust colour of the heavy round
    for a in btree['_actions']:
        J = next((J for J in JC_ROUNDS.values() if J['rnd'] == a['Name']), None)
        if not J: continue
        for e in a.get('AddEffects') or []:
            if e['NameEx']['ConstValue'].split('/')[-1].startswith('rrb_round'):
                for ax in ('x', 'y'): e['Scale'][ax] = fp(J['fx'])
    for a in btree["_actions"]:   # Guillotine's stage slashes cut without knocking away (hold_moves): its launching cut, or
        if a["Name"] in ("rrb_guillotine_w2", "rrb_guillotine_w3"):   # the stage 3 screen-wide slash, sends them
            for h in a.get("HitDataList") or []: _held_hit(B, h)


# moves that can repeat themselves faster than their projectile's hit window: the record that keeps one hit per enemy ends
# 0.10 s before the move can start again, so the next projectile of the same move is not refused
WAVE_REPEAT = ("rrb_ja", "rrb_j2a", "rrb_jb")
WAVE_RECORD = "rrb_sw"
# the projectile's end (2026-10-03, the lead: "the projectiles need to dissaper when they hit a wall and not linger when
# they hit a wall they also need a cooler fade out animation"). It had no wall rule: the engine stopped it against the
# wall and it burned there until its flight time ran out.
WAVE_END_T = 0.45                 # the end action lasts as long as the break (0.9.0: its petals live 0.4 s, not a second)
# 0.9.0 (the lead, 2026-10-09: "the red slashes' new look and passing through walls"): a slash is no longer stopped by
# scenery. rrb_ghost empties its movement's scenery masks for the flight (rrbGhostOn); the look-ahead wall rule is gone,
# and the move's own collision result stays from the third tick, so a slash the engine still stops breaks there
WAVE_GHOST = "rrb_ghost"
WAVE_GHOST_SAFE = 2 / 60.0
WAVE_DRIFT = 0.40                 # at the end of its flight it goes on at this share of its speed,
WAVE_BRAKE = ((0.04, 0.5), (0.08, 0.5), (0.12, 0.0))   # braked in steps (s, x speed) to a stop while it breaks
WAVE_WALL_GAP = 0.10              # its leading edge this far from the wall when it breaks (u)
WAVE_WALL_HIT = 0.05              # the wall break's own hit window (s): what stands in the crescent as it breaks
# What counts as a wall: Solid (1). Measured in the Try Out arena, 2026-10-03: its side limits are AirWalls (4), which do
# not stop a bullet (the projectile flew on off screen), so breaking on them would end it at an invisible line inside the
# screen; the base game's own rounds (Noel's: filter 3) fly through them too. RRB_WALLTEST=1 (dev) puts 5AA's on
# Solid + AirWall, to check the snap against the arena's side.
WAVE_WALL_FILTER = 1


def wave_boxes(B, port, by, btree, log=print):
    """the last pass (after weight_pass, after_weight, floor_reach and round_rules): each stage 3 slash projectile takes its
    flight (6 u/s for 0.08 s, then its class speed, stopped at the end of the flight so the wake plays out), its effect and
    break burst, and the hit rectangles cut from its crescent, which share one record so each enemy is hit once"""
    import rrb_fx
    fp, fv = B.fp, B.fv
    A = {a["Name"]: a for a in btree["_actions"]}
    n = n2 = 0
    for sp in SPECS:
        w = rrb_fx.WAVE2.get(sp["base"])
        a = A.get(sp["name"])
        if sp["s"] != 3 or w is None or a is None: continue
        fx = rrb_fx.WAVES.get((sp["base"], 3))
        win0, win1 = w["win"]
        end, wall = sp["name"] + "_x", sp["name"] + "_xw"
        # the body and the wake ride the bullet and stop when its action changes (KillMode 2): the body's hub stops at
        # once, the wake's softly (fxcompile_ruby.WAVE2_KINDS)
        a["AddEffects"] = [dict(B.fx_entry(port, fx, 0.0, attached=True), KillMode=2),
                           dict(B.fx_entry(port, fx + "k", 0.0, attached=True), KillMode=2)]
        a["StartSpeed"]["Speed"]["x"] = fp(w["v0"]); a["StartSpeed"]["Speed"]["y"] = fp(0.0)
        one, zero = {"x": fp(1.0), "y": fp(1.0)}, {"x": fp(0.0), "y": fp(0.0)}
        # (the stock form: rgbullet a4EX_sAF adds 25 u/s at 0.1 s with SpeedAddType 1)
        a["SpeedChanges"] = [{"Time": fp(w["t0"]), "SpeedAdd": {"x": fp(w["v1"] - w["v0"]), "y": fp(0.0)}, "SpeedAddType": 1, "SpeedMultiply": copy.deepcopy(one)}]
        a["TotalDuration"] = fp(w["flight"]); a["AnimateDuration"] = fp(w["flight"])
        a["NextAction"] = end
        # a wall: the stock rule (subullet fashe2gz: HitWall, Solid + AirWall), looking as far ahead as the crescent's
        # leading edge and not snapped onto the wall, so the break plays where the crescent is; and, should that ray
        # miss, the move's own collision result
        sw = copy.deepcopy(next(c for x in btree["_actions"] if x["Name"] == "s4_max" for c in x["CollisionSwitchList"]))
        sw["TimeRange"] = {"Start": fp(0.0), "Finish": fp(w["flight"])}
        sw["CollisionFilter"] = 5 if (os.environ.get("RRB_WALLTEST") and sp["base"] == "rrb_a2") else WAVE_WALL_FILTER
        sw["HitWallOrGround"] = 2; sw["Bounce"] = 0
        # the bullet's origin is her root; the crescent's leading edge is `reach` ahead of it. The rule looks that far
        # ahead, and the bullet is put on the wall and pushed back out by the same reach (the stock snap: Mai's spear
        # 0.2, Nine's 1.0), so the leading edge ends WAVE_WALL_GAP short of the wall whatever the engine's own look-ahead
        reach = round(max(0.3, w["bounds"][2] - WAVE_WALL_GAP), 3)
        sw["LengthMargin"] = fp(reach); sw["SnapToHit"] = 1; sw["SnapExtraPush"] = fp(reach)
        sw["NewActionEx"]["ConstValue"] = wall
        sw["NewActionWithTurnAngleType"] = 0; sw["NewActionWithTurnAngleRandom"] = fp(0.0)
        # and, should that ray miss (a ledge under the ray's line), the move's own collision result: whatever stops it
        sw2 = copy.deepcopy(sw); sw2["UseMoveCollideResult"] = 1; sw2["LengthMargin"] = fp(0.1); sw2["SnapToHit"] = 0; sw2["SnapExtraPush"] = fp(0.0)
        sw2["CollisionFilter"] = 7
        if WAVE_GHOST and not (os.environ.get("RRB_WALLTEST") and sp["base"] == "rrb_a2"):
            sw2["TimeRange"]["Start"] = fp(WAVE_GHOST_SAFE)
            a["CollisionSwitchList"] = [sw2]
            a["AddBuff"] = [b for b in a.get("AddBuff") or [] if b["Buff"]["Idx"] != WAVE_GHOST] + [B.bp.buff(WAVE_GHOST, 0.0, round(w["flight"] + WAVE_END_T, 3))]
        else:
            a["CollisionSwitchList"] = [sw, sw2]
        record = win1 - win0
        if sp["base"] in WAVE_REPEAT and sp["base"] in by:
            record = min(record, max(0.2, fv(by[sp["base"]]["TotalDuration"]) - 0.10))
        h0 = a["HitDataList"][0]
        lb = w["launch_box"]
        hits = []
        for r, t0, t1 in ([(lb, 0.0, 0.05)] if lb else []) + [(q, win0, win1) for q in w["rects"]]:
            h = copy.deepcopy(h0)
            h["HitBox"] = {"Min": {"x": fp(min(r[0], r[2])), "y": fp(r[1])}, "Max": {"x": fp(max(r[0], r[2])), "y": fp(r[3])}}
            h["TickRange"]["Start"] = fp(t0); h["TickRange"]["End"] = fp(t1); h["TickRange"]["HitInterval"] = fp(-1)
            h["Id"] = WAVE_RECORD; h["PreventHitBySameBoxType"] = 0; h["PreventHitBySameBoxIdMaxTimes"] = 1
            h["PreventHitBySameBoxIdDuration"] = fp(round(record, 3))
            fz = h.get("HitFreezeN") or {}                    # the bullet is the attacker: a hit does not stall it
            for k in ("FreezeAttacker", "FreezeAttackerMotion"):
                if k in fz: fz[k] = fp(0.0)
            hits.append(h)
        a["HitDataList"] = hits
        # its two ends: the break on the crescent; no hits. At the flight's end it drifts on and brakes; at a wall it
        # stands where it is
        for nm, drift in ((end, True), (wall, False)):
            e = copy.deepcopy(a); e["Name"] = nm
            e["AddEffects"] = [dict(B.fx_entry(port, fx + "x", 0.0, attached=True), KillMode=1)]
            e["Audios"] = []
            if drift:
                e["HitDataList"] = []; e["HitEffects"] = []; e["HitAudios"] = []
            else:
                # at a wall the break hits what stands in the crescent: its rectangles for 3 ticks, the same record (an
                # enemy the flight already hit is not hit again). Without this a projectile thrown with the wall inside
                # its reach broke before its hit window opened, and a cornered enemy took nothing from it
                wh = []
                for h in e["HitDataList"]:
                    if fv(h["TickRange"]["Start"]) < win0 - 1e-6: continue            # (the launch box)
                    h["TickRange"]["Start"] = fp(0.0); h["TickRange"]["End"] = fp(WAVE_WALL_HIT); wh.append(h)
                e["HitDataList"] = wh
                if sp["name"] in B.DMG: B.DMG[nm] = B.DMG[sp["name"]]               # the projectile's own damage budget
            e["CollisionSwitchList"] = []; e["NextAction"] = ""; e["AddRoles"] = []; e["ScriptCalls"] = []; e["AddBuff"] = []
            # (2026-10-03) a heavy crescent that breaks on a wall kicks the camera (the heavy class: 5AAAA, Rising Reap,
            # Clash Assault); the others and every range-end break stay still
            heavy = rrb_fx.WAVE2_MOVES.get(sp["base"], ("",))[0] == "heavy"
            e["CameraShake"] = [{"Time": 0.0, "ShakeStr": {"x": 0.12, "y": 0.08}, "Duration": 0.10}] if (heavy and not drift) else []
            e["StartSpeed"]["Speed"]["x"] = fp(w["v1"] * WAVE_DRIFT if drift else 0.0); e["StartSpeed"]["Speed"]["y"] = fp(0.0)
            e["SpeedChanges"] = [{"Time": fp(t), "SpeedAdd": copy.deepcopy(zero), "SpeedAddType": 1, "SpeedMultiply": {"x": fp(m), "y": fp(m)}}
                                 for t, m in WAVE_BRAKE] if drift else []
            e["TotalDuration"] = fp(WAVE_END_T); e["AnimateDuration"] = fp(WAVE_END_T)
            btree["_actions"].append(e); A[nm] = e
        n += 1
        if STAGE2_WAVE and sp["base"] in V2_WANTED:
            # stage 2's short crescent: the same three effects at STAGE2_K, on a bullet that hits nothing. It flies until
            # its leading edge is at the end of the stage 2 reach (bullets(): the move's hit box x STAGE[2]["k"])
            sp2 = next(q for q in SPECS if q["base"] == sp["base"] and q["s"] == 2)
            x1 = sp2["box"][2]
            lead = w["bounds"][2] * STAGE2_K
            dist = max(STAGE2_MIN, max(x1 * STAGE[2]["k"], x1 + 0.5) - lead)
            fl2 = round(max(0.07, dist / STAGE2_V), 3)
            vn = sp["base"] + "_v2"
            v = copy.deepcopy(a); v["Name"] = vn
            for k_ in ("HitDataList", "HitEffects", "HitAudios", "Audios", "AddRoles", "ScriptCalls", "CameraShake", "SpeedChanges"): v[k_] = []
            v["AddEffects"] = [dict(B.fx_entry(port, fx, 0.0, attached=True, scale=STAGE2_K), KillMode=2),
                               dict(B.fx_entry(port, fx + "k", 0.0, attached=True, scale=STAGE2_K), KillMode=2)]
            v["StartSpeed"]["Speed"]["x"] = fp(STAGE2_V); v["StartSpeed"]["Speed"]["y"] = fp(0.0)
            v["TotalDuration"] = fp(fl2); v["AnimateDuration"] = fp(fl2); v["NextAction"] = vn + "_x"
            reach2 = round(max(0.3, lead - WAVE_WALL_GAP), 3)
            for c_ in v["CollisionSwitchList"]:
                c_["TimeRange"] = {"Start": c_["TimeRange"]["Start"], "Finish": fp(fl2)}; c_["NewActionEx"]["ConstValue"] = vn + "_xw"
                if c_.get("SnapToHit"): c_["LengthMargin"] = fp(reach2); c_["SnapExtraPush"] = fp(reach2)
            btree["_actions"].append(v); A[vn] = v
            for nm, drift in ((vn + "_x", True), (vn + "_xw", False)):
                e = copy.deepcopy(A[sp["name"] + ("_x" if drift else "_xw")]); e["Name"] = nm
                for k_ in ("HitDataList", "HitEffects", "HitAudios", "CameraShake"): e[k_] = []
                e["AddEffects"] = [dict(B.fx_entry(port, fx + "x", 0.0, attached=True, scale=STAGE2_K), KillMode=1)]
                if drift: e["StartSpeed"]["Speed"]["x"] = fp(STAGE2_V * WAVE_DRIFT)
                btree["_actions"].append(e); A[nm] = e
            n2 += 1
    # a move whose actions spawn the stage 2 crescent but which got no projectile (rrb_fx found no stroke for it): an empty
    # action, so the spawn finds one
    for base in sorted(V2_WANTED):
        if base + "_v2" in A or base + "_w2" not in A: continue
        v = copy.deepcopy(A[base + "_w2"]); v["Name"] = base + "_v2"
        for k_ in ("HitDataList", "HitEffects", "HitAudios", "Audios", "AddEffects", "AddRoles", "ScriptCalls", "CameraShake"): v[k_] = []
        v["TotalDuration"] = fp(0.05); v["AnimateDuration"] = fp(0.05)
        btree["_actions"].append(v); A[base + "_v2"] = v
        log("rrb_power: %s: no crescent for stage 2 (it has no projectile): an empty action" % base)
    log("rrb_power: %d slash projectiles: flight, wall rule, break and %s hit rectangles; %d stage 2 crescents (x%.2f, %.0f u/s)" % (
        n, "/".join(sorted({str(len(w["rects"]) + 1) for w in rrb_fx.WAVE2.values()})), n2, STAGE2_K, STAGE2_V))


def bullets(B, port, by, btree, zone):
    """the stage slashes and the gust winds (zone: rrb_pots' zone builder)"""
    fp, fv = B.fp, B.fv
    gun_level_zones(B, port, zone)
    clash_storm_zone(B, port, zone)
    a4_gust_zone(B, port, zone)
    for sp in SPECS:
        S = STAGE[sp["s"]]; k, ky = S["k"], S["ky"]
        x0, y0, x1, y1 = sp["box"]
        box = [min(x0, -0.3), y0, max(x1 * k, x1 + 0.5), max(y1 * ky, y1)]
        a = zone(sp["name"], 0.3, box, None, [], S["feel"])
        h = a["HitDataList"][0]; h["TickRange"]["Start"] = fp(SLASH_T); h["TickRange"]["End"] = fp(SLASH_T + 0.06)
        a["AddEffects"] = []
        # (2026-10-02, the lead: large slashes are made for her swing, not an arc drawn again larger.) The slash is a
        # crescent thrown off the move's own swing (rrb_fx.WAVES, ruby_blade.wave_parts): it leaves the blade at the
        # hit and flies out to this box in WAVE_LOOK ticks; the hit lands while it passes
        import rrb_fx
        wave = rrb_fx.WAVES.get((sp["base"], sp["s"]))
        # (the 5AAAA analysis, 2026-10-02: the stage slash hits in the same frames as its move, and its own reaction could
        #  overwrite the move's: 5AAAA's lift to her jump height, a launcher's launch.) It takes the move's own reaction
        src = (by.get(sp["base"]) or {}).get("HitDataList") or []
        if src:
            first = min(src, key=lambda x: fv(x["TickRange"]["Start"]))
            keep = h["Victim"].get("BuffList") or []
            h["Victim"] = copy.deepcopy(first["Victim"]); h["Victim"]["BuffList"] = keep
            if h["Victim"].get("DistAdapt"): h["Victim"]["DistAdapt"]["Enable"] = 0; h["Victim"]["DistAdapt"]["EnableY"] = 0
        if sp["base"] == "rrb_a4":   # (C10) a target only the stage slash launches is tagged too, so the gust leaves it
            import rrb_pots as P_
            h.setdefault("AttackerCalls", []).append(P_.attacker_call(B, "AddBuff", 'buff:"%s",durOverride:%.2f,hit_target:1' % (A4_TAG, A4_TAG_T),
                                                                  [P_.T(B, port, "a4_pass"), P_.T(B, port, "semblance")]))
        if sp["s"] == 2:
            # this bullet carries stage 2's reach; what is seen of it is the short crescent on <base>_v2 (wave_boxes)
            ratio = B.DMG.get(sp["base"], (1.0, 1))[0]
            B.DMG[sp["name"]] = (round(ratio * S["dmg"], 3), 1)
            # the thrusts (5A, 2A: no arc, no crescent) fall through and draw their line to the stage 2 reach, as at stage 3
            if sp["arcs"] or sp["base"] in rrb_fx.WAVE2_MOVES or not STAGE2_WAVE: continue
        if wave and sp["s"] == 3:
            # the slash projectile: it leaves with the swing, flies on at S["speed"] for S["flight"], hits each enemy it
            # passes once, and its crescent (attached) fades as it goes
            a["AddEffects"] = [dict(B.fx_entry(port, wave, 0.0, attached=True), KillMode=1)]
            pk = S["pk"]
            h["HitBox"] = {"Min": {"x": fp(min(x0, -0.3)), "y": fp(y0)}, "Max": {"x": fp(max(x1 * pk, x1 + 0.5)), "y": fp(max(y1 * pk, y1))}}
            h["TickRange"]["Start"] = fp(0.0); h["TickRange"]["End"] = fp(S["flight"]); h["TickRange"]["HitInterval"] = fp(-1)
            a["StartSpeed"]["Speed"]["x"] = fp(S["speed"]); a["StartSpeed"]["Speed"]["y"] = fp(0.0)
            a["TotalDuration"] = fp(S["flight"] + 0.05); a["AnimateDuration"] = fp(S["flight"] + 0.05)
            ratio = B.DMG.get(sp["base"], (1.0, 1))[0]
            B.DMG[sp["name"]] = (round(ratio * S["dmg"], 3), 1)
            continue
        if wave:
            a["AddEffects"] = [dict(B.fx_entry(port, wave, 0.0, attached=True), KillMode=1)]
            fl = rrb_fx.WAVE_TICKS[(sp["base"], sp["s"])] / 60.0
            h["TickRange"]["Start"] = fp(round(0.3 * fl, 3)); h["TickRange"]["End"] = fp(round(0.3 * fl + 0.06, 3))
            a["TotalDuration"] = fp(max(0.3, fl + 0.12)); a["AnimateDuration"] = fp(max(0.3, fl + 0.12))
            ratio = B.DMG.get(sp["base"], (1.0, 1))[0]
            B.DMG[sp["name"]] = (round(ratio * S["dmg"], 3), 1)
            continue
        for e in sp["arcs"]:
            e = copy.deepcopy(e)
            e["Start"] = fp(max(0.0, fv(e["Start"]) - sp["arc_t"]))
            for ax in ("x", "y"):
                e["Scale"][ax] = fp(fv(e["Scale"][ax]) * k)
                e["Position"][ax] = fp(fv(e["Position"][ax]) * (k if ax == "x" else ky))
            e["KillMode"] = 1
            a["AddEffects"].append(e)
        # 5A's jab (the kit's rrb_thrust line and rrb_thrust_tip, wired after these specs were taken): the line keeps its
        # grip and thickness and reaches to the slash's hit box, the tip flash sits at its end (without them the stage
        # 2 / 3 jab reached across the screen invisibly; the effects pass, 2026-09-30)
        born = sp["born"]                                           # the slash's spawn, in the move's time
        line = [e for e in by[sp["base"]].get("AddEffects") or [] if e["NameEx"]["ConstValue"].endswith("rrb_thrust")]
        tip = [e for e in by[sp["base"]].get("AddEffects") or [] if e["NameEx"]["ConstValue"].endswith("rrb_thrust_tip")]
        if not sp["arcs"] and not line:
            # a move with neither (5AAAA's pass, 2A, Clash Assault: their only effect is her blade trail, which rides her
            # body and can't stretch): the same line across the reach, at the middle of the move's own hit box
            gy = round(min(max((y0 + y1) / 2, 0.3), 1.4), 2)
            line = [B.fx_entry(port, "Role/Rrb/rrb_thrust", sp["t0"] - 0.017, dx=0.3, dy=gy, attached=True)]
            tip = [B.fx_entry(port, "Role/Rrb/rrb_thrust_tip", sp["t0"] - 0.017, attached=True)]
        for e0 in line:
            gx, gy = fv(e0["Position"]["x"]), fv(e0["Position"]["y"]); ang = math.radians(fv(e0["Rotation"]["x"]))
            sx = max(1.0, (box[2] - gx) / THRUST_LEN * 0.92)
            e = copy.deepcopy(e0); e["Start"] = fp(max(0.0, fv(e0["Start"]) - born)); e["KillMode"] = 1
            e["Scale"]["x"] = fp(fv(e0["Scale"]["x"]) * sx); e["Scale"]["y"] = fp(fv(e0["Scale"]["y"]) * min(ky, 1.4))
            a["AddEffects"].append(e)
            for t0_ in tip:
                t = copy.deepcopy(t0_); t["Start"] = fp(max(0.0, fv(t0_["Start"]) - born)); t["KillMode"] = 1
                t["Position"]["x"] = fp(gx + THRUST_LEN * sx * math.cos(ang)); t["Position"]["y"] = fp(gy + THRUST_LEN * sx * math.sin(ang))
                for ax in ("x", "y"): t["Scale"][ax] = fp(fv(t0_["Scale"][ax]) * min(ky, 1.4))
                a["AddEffects"].append(t)
        ratio = B.DMG.get(sp["base"], (1.0, 1))[0]
        B.DMG[sp["name"]] = (round(ratio * S["dmg"], 3), 1)
    import rrb_pots
    A = {x["Name"]: x for x in btree["_actions"]}
    for name, M in MAX_ROUNDS.items():   # stage 3 rounds: bigger, faster, armor-breaking, knockback
        a = copy.deepcopy(A[M["src"]]); a["Name"] = name
        drop = ("b7end", "b7_hcp") if name == "b7_max" else ("s4end",)
        # b7_max pierces: flies on through every enemy, each hit once (b7_hcp's rule), for its 0.3 s. s4_max bursts
        # on contact, always the big burst (s4end_x, without its card condition)
        a["ActionSwitchs"] = [x for x in a.get("ActionSwitchs") or [] if (x.get("NewActionEx") or {}).get("ConstValue") not in drop]
        for x in a["ActionSwitchs"]:
            if (x.get("NewActionEx") or {}).get("ConstValue") == "s4end_x":
                x["ConditionGroup"]["Conditions"] = x["ConditionGroup"]["Conditions"][:1]
        spd = (a.get("StartSpeed") or {}).get("Speed")
        if spd: spd["x"] = fp(M["speed"])
        for h in a["HitDataList"]:
            hb = h["HitBox"]
            for c in ("Min", "Max"):
                for ax in ("x", "y"):
                    hb[c][ax] = fp(fv(hb[c][ax]) * M["box"])
            h["ArmorBreak"] = M["armor"]
            rrb_pots.victim(B, port, h, "knock")
            sx, sy, du = M["shake"]; h["CamShake"] = {"Time": 0.0, "ShakeStr": {"x": sx, "y": sy}, "Duration": du}
        for e in (a.get("AddEffects") or []) + (a.get("HitEffects") or []):
            sc = e.get("Scale")
            if isinstance(sc, dict):
                for ax in ("x", "y"):
                    if isinstance(sc.get(ax), dict): sc[ax] = fp(fv(sc[ax]) * M["box"])
        btree["_actions"].append(a); A[name] = a
        B.DMG[name] = M["dmg"]
    a = zone("rrb_guil_wave", 0.35, list(WAVE_BOX), None, [], "launch")          # the stage 3 Guillotine slash
    a["HitDataList"][0]["TickRange"]["Start"] = fp(0.05); a["HitDataList"][0]["TickRange"]["End"] = fp(0.1)
    # the look: Low Sweep's flat crescent (a horizontal stroke), stretched across the screen and raised to her waist
    # (5BB's arc is a full swirl: scaled up it read as a tilted ring; move viewer, 2026-09-30)
    # (2026-10-02, the lead: finishers are made for her swing. It was Low Sweep's arc stretched x7: a slab.) Now a
    # crescent thrown off Guillotine's own swing to both sides (rrb_fx.GUIL_FIN); the stretched arc only if no stroke
    # could be read
    import rrb_fx
    fin = rrb_fx.WAVES.get(("rrb_guillotine", "fin"))
    if fin:
        a["AddEffects"] = [dict(B.fx_entry(port, fin, 0.0, attached=True), KillMode=1)]
    else:
        arcs = [copy.deepcopy(e) for e in by["rrb_sweep"].get("AddEffects") or [] if e["NameEx"]["ConstValue"].startswith("Role/Rrb/arc_")][:1]
        for e in arcs:
            e["Start"] = fp(0.0); e["KillMode"] = 1
            e["Scale"]["x"] = fp(fv(e["Scale"]["x"]) * WAVE_FX[0]); e["Scale"]["y"] = fp(fv(e["Scale"]["y"]) * WAVE_FX[1])
            e["Position"]["x"] = fp(WAVE_FX[2]); e["Position"]["y"] = fp(WAVE_FX[3])
        a["AddEffects"] = arcs
    B.DMG["rrb_guil_wave"] = (round(B.DMG["rrb_guillotine"][0] * 0.6, 3), 1)
    a = zone("rrb_pd_storm", 1.3, [-8.0, -0.5, 12.0, 6.0], 0.2, [], "light")       # the stage 3 Petal Dance storm
    # the look: the kit's squall of small petals and wind lines blowing with her facing (effects pass, 2026-09-30:
    # before, six of her hit-petal bursts at 4x, petals up to 1 u across)
    a["AddEffects"] = [dict(B.fx_entry(port, "Role/Rrb/rrb_petal_storm", 0.0, dx=1.0, attached=True), KillMode=1)]
    a["CameraShake"] = [{"Time": float(w), "ShakeStr": {"x": 0.07, "y": 0.05}, "Duration": 0.14} for w in WIPES]
    B.DMG["rrb_pd_storm"] = (0.8, int(1.3 / 0.2))
    for name, dur in (("rrb_gust_wind", GUST_DUR), ("rrb_gust_wind_u", GUST_DUR_U)):
        a = zone(name, dur, [-14.0, -0.5, 14.0, 6.0], 0.25, [], "light")
        # the gust blows in toward her from both sides (it carries them to her); each squall lasts 1.2 s and wipes the
        # screen three times (the kit's WIPES), each wipe with a camera kick (the lead: "Make sure the wind for petal
        # burst is really visual and strong too")
        starts = [x * 0.8 for x in range(int((dur - 1.2) / 0.8 + 1e-6) + 1)]
        a["AddEffects"] = [dict(B.fx_entry(port, "Role/Rrb/rrb_petal_gust", t, attached=True), KillMode=1) for t in starts]
        a["CameraShake"] = [{"Time": float(t + w), "ShakeStr": {"x": 0.09, "y": 0.06}, "Duration": 0.16}
                            for t in starts for w in WIPES if t + w < dur]
        B.DMG[name] = ((0.9, int(dur / 0.25)) if name == "rrb_gust_wind" else (1.4, int(dur / 0.25)))
    port.note(B.BLOGIC, "power stages: %d stage slashes; Petal Burst gust winds" % len(SPECS))
    jc_rounds(B, port, btree, zone, by)
    sypod_pierce(B, port, by, btree)


# Sy-Pod's rounds pierce (the lead, 2026-10-02, after playing the rebuilt gun: "sypod needs to pierce and have
# screenshake when it hits an enemy"). A round used to break on its first enemy (switch to s4end / s4end_x, the burst).
# Now each hit sends it into a copy of itself (<round>_p) that spawns that burst where it hit, with a camera kick, and
# flies on; it hits each enemy once per round (a PIERCE_HOLD record: round_rules). The copy's own hit switch opens
# after PIERCE_GUARD (the hit condition looks back 0.1 s: earlier, it would re-enter itself on the same hit)
SYPOD_ROUNDS = ("s4", "s4_hc", "s4_max")
PIERCE_GUARD = 0.12
SYPOD_KICK = {"s4end": (0.30, 0.20, 0.14), "s4end_x": (0.38, 0.26, 0.16)}


def sypod_pierce(B, port, by, btree):
    fp, fv = B.fp, B.fv
    A = {a["Name"]: a for a in btree["_actions"]}
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    refs = {r["rid"]: r for r in btree["references"]["RefIds"]}
    refs.update({r["rid"]: r for r in port.refs.items})
    made = []
    for n in SYPOD_ROUNDS:
        a = A.get(n)
        if not a: continue
        ends = [s for s in a.get("ActionSwitchs") or [] if ((s.get("NewActionEx") or {}).get("ConstValue") or "").startswith("s4end")]
        if not ends: continue
        targets = [s["NewActionEx"]["ConstValue"] for s in ends]
        p = copy.deepcopy(a); p["Name"] = n + "_p"
        p["ActionSwitchs"] = [copy.deepcopy(s) for s in ends[:1]]        # on its next enemy: itself again
        p["ActionSwitchs"][0]["NewActionEx"]["ConstValue"] = p["Name"]
        p["ActionSwitchs"][0]["ConditionGroup"]["Conditions"] = p["ActionSwitchs"][0]["ConditionGroup"]["Conditions"][:1]
        p["ActionSwitchs"][0]["TimeCheck"]["Start"] = fp(PIERCE_GUARD)
        for e in p.get("AddEffects") or []:
            if e["NameEx"]["ConstValue"].split("/")[-1].startswith("rrb_round"): e["Start"] = fp(0.0)   # it flies on, lit
        # the burst where it hit: the break it used to switch to, by the same conditions (the first that holds wins:
        # the later ones get the earlier ones' extra conditions inverted)
        seen = []
        for s, tgt in zip(ends, targets):
            extra = list(s["ConditionGroup"]["Conditions"][1:])
            conds = list(extra)
            for c in seen:
                d = (refs.get(c["rid"]) or {}).get("data") or {}
                if "TriggerIdMin" in d: conds.append(port.refs.trigger(d["TriggerIdMin"], invert=1 - d.get("Invert", 0)))
            seen += extra
            r = B.bp.role(role_t, B.BID, tgt, 0.0, 0.0, 0.0); r["ConditionGroup"] = {"Combine": 0, "Conditions": conds}
            p.setdefault("AddRoles", []).append(r)
        for s in ends: s["NewActionEx"]["ConstValue"] = p["Name"]
        for h in (a.get("HitDataList") or []) + (p.get("HitDataList") or []):
            h["PreventHitBySameBoxIdDuration"] = fp(PIERCE_HOLD)    # one enemy per round pass, never across the chain (round_rules)
        btree["_actions"].append(p); A[p["Name"]] = p
        B.DMG[p["Name"]] = B.DMG.get(n, (1.5, 1))
        made.append(p["Name"])
    for n, (sx, sy, du) in SYPOD_KICK.items():
        if n in A: A[n]["CameraShake"] = [{"Time": 0.0, "ShakeStr": {"x": sx, "y": sy}, "Duration": du}]
    port.note(B.BLOGIC, "Sy-Pod pierces: %s; bursts kick the camera %s" % (made, SYPOD_KICK))


# ---- her rounds connect for the whole chain (the lead, 2026-10-02: "for her rifle shot and sypod it needs to be able
# to hit enemies its hit for the full chain or however many bullets fire ... enemies have a problem with dropping out of
# hit"). Engine (GameAssembly: ActorBehitBoxMgr.procOneBehitCol -> ActorBehitHistory.CheckCanHit / AddBehitIdRec): a hit
# with an Id and PreventHitBySameBoxIdDuration > 0 leaves a record on the VICTIM keyed (root caster, action, Id) for that
# long and is refused while a matching record has reached MaxTimes. With PreventHitBySameBoxType 0 the action is the
# round's Ssss.CasterAction (HER move that fired it): every round of a chain, and of every later press of that move,
# shares the key, so 9 s let one round per enemy per 9 s through. A round that never re-enters needs no record
# (HitInterval -1 hits each enemy once per flight: stock jnbullet H, cellsbullet PBd). Sy-Pod's pierce re-enters
# (<round> -> <round>_p, a fresh hit box), so its rounds keep a record just long enough to leave the enemy they hit,
# and shorter than the gap to the chain's next round (0.2625 s).
PIERCE_HOLD = 0.18
PIERCE_FAMILY = ("s4", "s4_hc", "s4_max")
GUN_ROUNDS = ("b7", "b7_hc", "b7_hcp", "b7_max", "b7_fire", "rrb_dustround", "rrb_dustround_hc") + PIERCE_FAMILY + \
    tuple(J["rnd"] for J in JC_ROUNDS.values()) + (GSW_RND["floor"], GSW_RND["air"])   # (C2) j.C's Dust rounds: hold 0, no melee spacing
ENEMY_W = 4.0       # the widest hurt box (u) a piercing round must clear within PIERCE_HOLD
ROUND_TOP = None    # design option (lead): e.g. 1.0 = every round's box reaches 1.0 u above its line (juggled targets)


def round_rules(B, port, by, btree):
    """after floor_reach: per-target hold of every round (0 = once per flight; PIERCE_HOLD for Sy-Pod's re-entering
    pierce), no melee DistAdapt on any round hit; asserts the hold against the chains' gaps and the rounds' speeds"""
    fp, fv = B.fp, B.fv
    A = {a["Name"]: a for a in btree["_actions"]}
    gaps = {}
    for a in by.values():                     # the shortest gap between two of the same round fired by one move
        ts = {}
        for r in a.get("AddRoles") or []:
            n = (r.get("StartActionEx") or [{}])[0].get("ConstValue")
            if n in A: ts.setdefault(n, []).append(fv(r["TimeConfig"]["Start"]))
        for n, t in ts.items():
            t = sorted(t); d = [y - x for x, y in zip(t, t[1:]) if y - x > 0.01]
            if d: gaps[n] = min(gaps.get(n, 9.0), min(d))
    fam_gap = min([gaps.get(n, 9.0) for n in PIERCE_FAMILY])   # (stage swaps turn s4 into s4_hc / s4_max)
    assert PIERCE_HOLD < fam_gap - 0.05, "pierce hold %.3f s vs Sy-Pod chain gap %.3f s" % (PIERCE_HOLD, fam_gap)
    done = []
    for n, a in A.items():
        base = n[:-2] if n.endswith("_p") else n
        if base not in GUN_ROUNDS: continue
        hold = PIERCE_HOLD if base in PIERCE_FAMILY else 0.0
        spd = abs(fv(((a.get("StartSpeed") or {}).get("Speed") or {}).get("x") or fp(0)))
        for h in a.get("HitDataList") or []:
            h["PreventHitBySameBoxIdDuration"] = fp(hold)
            if hold:
                w = fv(h["HitBox"]["Max"]["x"]) - fv(h["HitBox"]["Min"]["x"])
                assert hold * spd - w >= ENEMY_W, "%s: %.1f u/s x %.2f s does not clear a %.1f u enemy" % (n, spd, hold, ENEMY_W)
            da = (h.get("Victim") or {}).get("DistAdapt")
            if da: da["Enable"] = 0; da["EnableY"] = 0
            if ROUND_TOP is not None and fv(h["HitBox"]["Max"]["y"]) < ROUND_TOP:
                h["HitBox"]["Max"]["y"] = fp(ROUND_TOP)
        done.append("%s %.2f" % (n, hold))
    port.note(B.BLOGIC, "round rules: per-target hold %s (chain gaps %s); DistAdapt off on every round" % (
        done, {k: round(v, 3) for k, v in sorted(gaps.items())}))


def hold_buffs(logic):
    """rrb_guil_hold, rrb_rr_hold, rrb_rr_hook (hold_moves; rrb_runtime rrbHoldCheck / rrbRrReset / rrbRrHit). `logic` is
    buffs()'s record builder. ConstrainXZ (logic 21; GameAssembly): value 0 = x and y moved onto the target point every
    update (AddMove); ConstrainToCaster = the point follows her; AddCurrentOffset = the offset the hit found;
    LocalCasterOffset + RandomX/Y = a set point along her facing; a holder resisting FixPosition is left alone"""
    cxz = lambda params: dict(logic(21, params=params, hint="BuffLogic_ConstrainXZ"), OnlyUpdateWhenBattleRun=0)   # as stock
    nocol = logic(22, params=(("NoInterCollision", "1"),), interval=0.5, hint="BuffLogic_ResistanceChange")
    check = lambda pre, start: ([logic(101, "rrbHoldCheck", params=(("pre", pre),), hint="BuffLogic_ScriptCallStart")] if start else []) + \
        [logic(103, "rrbHoldCheck", params=(("pre", pre),), interval=0.05, hint="BuffLogic_ScriptCallRepeat")]
    guil = (("ConstrainToCaster", "1"), ("AddCurrentOffset", "1")) if GUIL_CARRY else ()
    pin = ((("ConstrainToCaster", "1"), ("AddCurrentOffset", "1")) if RR_PIN is None else
           (("ConstrainToCaster", "1"), ("LocalCasterOffset", "1"), ("RandomX", "%.2f,%.2f" % (RR_PIN[0], RR_PIN[0])),
            ("RandomY", "%.2f,%.2f" % (RR_PIN[1], RR_PIN[1]))))
    import rrb_pots as P_
    hook = (("ConstrainToCaster", "1"), ("LocalCasterOffset", "1"), ("RandomX", "%.2f,%.2f" % (P_.HOOK_AT, P_.HOOK_AT)), ("RandomY", "0.00,0.00"))
    hook_check = [logic(101, "rrbHoldCheck", params=(("pre", "rrb_hook"), ("not", "rrb_hook_back")), hint="BuffLogic_ScriptCallStart"),
                  logic(103, "rrbHoldCheck", params=(("pre", "rrb_hook"), ("not", "rrb_hook_back")), interval=0.05, hint="BuffLogic_ScriptCallRepeat")]
    return [
        # Reaper's Hook (0.8.0): the same relative lock at a set point in front of her (the pin form: LocalCasterOffset)
        {"list": "BuffList", "key": "Idx", "from": "hb_hit_fixpos", "to": HOOK_HOLD, "set": [
            {"path": "Name", "value": "Ruby: hooked (Reaper's Hook)"},
            {"path": "LogicArray", "value": [cxz(hook), nocol] + hook_check},
            {"path": "StopCond.EndOnCasterDie", "value": 1},
            {"path": "Tags", "value": "change_pos"},
            {"path": "AddEffects", "value": []}]},
        # Guillotine: the stock relative lock (Hibiki's hb_hit_fixpos / Mi's mi_ConstrainXZ_Normalatk), no Stun
        {"list": "BuffList", "key": "Idx", "from": "hb_hit_fixpos", "to": GUIL_HOLD, "set": [
            {"path": "Name", "value": "Ruby: held by Guillotine"},
            {"path": "LogicArray", "value": [cxz(guil), nocol] + check("rrb_guil", True)},
            {"path": "StopCond.EndOnCasterDie", "value": 1},
            {"path": "Tags", "value": "change_pos"},
            {"path": "AddEffects", "value": []}]},
        # Red Reaper: Mai's spear pin (2114: Stun + ConstrainXZ to the caster + freeze frame) with the astral-heat lock's
        # no inter-collision and armor ceiling (AH_target_control_B: 99); Cross Tag holds the opponent in its hit pose
        {"list": "BuffList", "key": "Idx", "from": "2114", "to": RR_HOLD, "set": [
            {"path": "Name", "value": "Ruby: pinned by Red Reaper"},
            {"path": "LogicArray", "value": [logic(18, value=1.0, hint="BuffLogic_Stun"), cxz(pin),
                                             logic(10, value=-1000.0, hint="BuffLogic_PassiveActSpeedChange"), nocol] + check("rrb_redreaper", False)},
            {"path": "StopCond.EndOnDie", "value": 1},
            {"path": "MaxArmorLevel", "value": 99.0}, {"path": "MaxArmorLevelFp", "value": {"value": 99 * 4294967296}},
            {"path": "AddEffects", "value": []}]},
        # on her for Red Reaper (ends when her action changes): its start forgets the last pick, each hit she lands may pick
        {"list": "BuffList", "key": "Idx", "from": "skill_times", "to": RR_HOOK, "set": [
            {"path": "Name", "value": "Ruby: Red Reaper's target"},
            {"path": "MaxStack", "value": 1}, {"path": "AddReplaceType", "value": 3},
            {"path": "StopCond.EndStateChanged", "value": 1},
            {"path": "LogicArray", "value": [
                logic(101, "rrbRrReset", hint="BuffLogic_ScriptCallStart"),
                dict(logic(105, "rrbRrHit", params=(("HitStage", "PostHit"), ("rel", "%.2f" % RR_REL[0]), ("t0", "%.2f" % RR_T0[0])),
                           hint="BuffLogic_ScriptCallHit"), ValueAddForStackFp={"value": 4294967296})]}]}]


def buffs(B):
    """rrb_stage2 / 3 (3 swaps her rounds for the High Caliber ones), rrb_stagechk (the count), rrb_gust (the carry),
    rrb_pb_hold (held in place), rrb_has_rc (owns Rachel: her wind shows)"""
    def logic(t, call="", params=(), value=0.0, interval=0.0, hint=""):
        return {"Type": t, "ValueConstFp": {"value": int(round(value * 4294967296))}, "ValueAddForStackFp": {"value": 0},
                "OverTimeUpdateIntervalFp": {"value": int(round(interval * 4294967296))}, "OnlyUpdateWhenBattleRun": 1 if t in (21, 103) else 0,
                "ScriptCall": call, "ParamSet": {"ParamList": [{"Key": a, "Value": b} for a, b in params], "ParamHintTypeInEditor": hint}}
    def flag(idx, name, logics=None):
        s = [{"path": "Name", "value": name}]
        if logics is not None: s.append({"path": "LogicArray", "value": logics})
        return {"list": "BuffList", "key": "Idx", "from": "skill_times", "to": idx, "set": s}
    s2 = [("rrbb1/" + a, "rrbb1/" + b) for a, b in (("b7", "b7_hc"), ("s4", "s4_hc"))]
    s3 = [("rrbb1/" + a, "rrbb1/" + b) for a, b in (("b7", "b7_max"), ("b7_hc", "b7_max"), ("s4", "s4_max"), ("s4_hc", "s4_max"))]
    # (2026-10-03) reaching a stage is marked (rrbStage adds the buff for a second when the stage rises): the break of a
    # slash projectile played on her, a crescent that flashes white and scatters into rose petals. At stage 2 it is the
    # small crescent her swings now throw, at stage 3 the full one. (A first version scaled the petal puff x2 / x3: six
    # large flat petals, seen in game and dropped.) The crescent is Rising Reap's upright fang (STAGE_UP_FX), centred on
    # her; the effect record is the Dust aura's
    def stage_up(st, k):
        rec = lambda res, x, y, sc: {"Res": res, "BindPos": 0, "Offset": {"x": x, "y": y}, "Scale": sc, "FitRole": 0, "Layer": 678496669,
                                     "BindDirType": 0, "BindPosEveryFrame": 0, "ValidBuffStackMin": 0, "ValidBuffStackMax": 99999, "StartTimeType": 0}
        return {"list": "BuffList", "key": "Idx", "from": "skill_times", "to": "rrb_stageup%d" % st, "set": [
            {"path": "Name", "value": "Ruby power: stage %d reached" % st},
            {"path": "MaxStack", "value": 1}, {"path": "AddReplaceType", "value": 3},
            {"path": "AddEffects", "value": [rec(STAGE_UP_FX, -STAGE_UP_X * k, 0.0, k), rec("Role/Rrb/rrb_petals", 0.0, 1.0, 1.3)]}]}
    return [stage_up(2, STAGE2_K), stage_up(3, 1.0),
            flag("rrb_stage2", "Ruby power: stage 2", [logic(126, params=s2)]),
            flag("rrb_stage3", "Ruby power: stage 3", [logic(126, params=s3)]),
            flag("rrb_stagechk", "Ruby power: count", [logic(101, "rrbStage", hint="BuffLogic_ScriptCallStart")]),
            flag(STAG_SCAN, "Ruby: marks the enemies her rounds can make flinch", [logic(101, "rrbStagScan", hint="BuffLogic_ScriptCallStart")]),
            flag("rrb_gust", "Ruby: Petal Burst gust", [logic(103, "rrbGust", interval=0.05, hint="BuffLogic_ScriptCallRepeat")]),
            flag("rrb_has_rc", "Ruby: owns Rachel (her wind)"),
            flag(WAVE_GHOST, "Ruby: a slash projectile passes through scenery", [logic(101, "rrbGhostOn", hint="BuffLogic_ScriptCallStart"),
                                                                                logic(102, "rrbGhostOff", hint="BuffLogic_ScriptCallEnd")]),
            # 0.9.0 cinematic starts (cine_starts): on her, the camera pushed in while it lasts and the lock handed out
            # (its Strength is the lock's length); on each enemy on screen, the lock: stunned, its pose frozen, no stun tag
            # (Petal Burst reads that tag to become Red Reaper)
            {"list": "BuffList", "key": "Idx", "from": "skill_times", "to": CINE_BUFF, "set": [
                {"path": "Name", "value": "Ruby: cinematic start"},
                {"path": "MaxStack", "value": 1}, {"path": "AddReplaceType", "value": 3},
                {"path": "LogicArray", "value": [logic(101, "rrbCineOn", params=(("lv", str(CINE["push"])),), hint="BuffLogic_ScriptCallStart"),
                                                 logic(102, "rrbCineOff", hint="BuffLogic_ScriptCallEnd")]}]},
            {"list": "BuffList", "key": "Idx", "from": "2114", "to": CINE_HOLD, "set": [
                {"path": "Name", "value": "Ruby: locked by a cinematic start"},
                {"path": "LogicArray", "value": [logic(18, value=1.0, hint="BuffLogic_Stun"),
                                                 logic(10, value=-1000.0, hint="BuffLogic_PassiveActSpeedChange"),
                                                 logic(103, "rrbHoldCheck", params=(("pre", "rrb_"),), interval=0.05, hint="BuffLogic_ScriptCallRepeat")]},
                {"path": "StopCond.EndOnDie", "value": 1}, {"path": "Tags", "value": ""},
                {"path": "AddEffects", "value": []}]},
            # hidden 24: Petal Dance right after Petal Burst gives 20 SP back (rrbSpBack; rrb_pots.potentials_v2)
            flag("rrb_sp_back", "Ruby: Petal Dance after Petal Burst (SP back)", [logic(101, "rrbSpBack", params=(("sp", "20"),), hint="BuffLogic_ScriptCallStart")]),
            # Silver Eyes (20729) against Staggered enemies: the stock boss buff 73091 covers bosses and Elites (both carry
            # the Boss tag); rrbStage keeps this on her while the card is held, and its hit hook adds the rest (rrb_runtime)
            {"list": "BuffList", "key": "Idx", "from": "12911", "to": "rrb_silver", "set": [
                {"path": "Name", "value": "Ruby: Silver Eyes (Staggered enemies)"},
                {"path": "LogicArray", "value": [dict(logic(105, "rrbSilverHit", params=(("HitStage", "PostHit"),), hint="BuffLogic_ScriptCallHit"),
                                                      ValueAddForStackFp={"value": 4294967296})]},
                {"path": "AddEffects", "value": []}]},
            # Ice Dust's Freeze, delayed as the stock Cold does it (2102 -> 2101_delay): the stock Freeze (2101) ends when
            # its target enters a hit reaction (StopCond EndStatePassive), so added inside the hit that earned it, it ended
            # at once (0.6.8 trace: "frozen false" 1 ms after every Freeze). rrbDustHit puts one of these on the enemy;
            # 0.05 s later (BuffLogic_ScriptCallDelayed, as 2101's own Start_2101) rrbFreezeGo adds 2101 for cs/100 s
            {"list": "BuffList", "key": "Idx", "from": "2101_delay", "to": "rrb_frz", "set": [
                {"path": "Name", "value": "Ruby: Ice Dust Freeze (delayed)"},
                {"path": "LogicArray", "value": [logic(106, "rrbFreezeGo", params=(("Delay", "0.05"), ("cs", "150")), hint="BuffLogic_ScriptCallDelayed")]}]},
            {"list": "BuffList", "key": "Idx", "from": "2101_delay", "to": "rrb_frz_s", "set": [
                {"path": "Name", "value": "Ruby: Ice Dust Freeze (delayed, Dust card)"},
                {"path": "LogicArray", "value": [logic(106, "rrbFreezeGo", params=(("Delay", "0.05"), ("cs", "225")), hint="BuffLogic_ScriptCallDelayed")]}]},
            # the Freeze's actor tag (rrb_frozen, which her secondary effects' hits exclude) lasts as long as the Freeze:
            # this buff ends with it and rrbFrozenEnd removes the tag (a hit that breaks the Freeze removes both earlier)
            {"list": "BuffList", "key": "Idx", "from": "2101_delay", "to": "rrb_frz_tag", "set": [
                {"path": "Name", "value": "Ruby: Frozen (tag)"},
                {"path": "LogicArray", "value": [logic(102, "rrbFrozenEnd", hint="BuffLogic_ScriptCallEnd")]}]},
            {"list": "BuffList", "key": "Idx", "from": "1205", "to": "rrb_pb_quick", "set": [{"path": "Name", "value": "Ruby: Petal Burst quick start"}]},
            # hidden 39: an enemy 5AAAA launched carries the actor tag rrb_a4_lift while this lasts (rrbLiftOn / rrbLiftOff);
            # the rose gust's hits exclude the tag (HitData.ExcludeTags matches actor tags, as rrb_frozen)
            {"list": "BuffList", "key": "Idx", "from": "2101_delay", "to": A4_TAG, "set": [
                {"path": "Name", "value": "Ruby: launched by 5AAAA (the rose gust skips it)"},
                {"path": "LogicArray", "value": [logic(101, "rrbLiftOn", hint="BuffLogic_ScriptCallStart"),
                                                 logic(102, "rrbLiftOff", hint="BuffLogic_ScriptCallEnd")]}]},
            # 0.9.0: an enemy a rifle round made flinch carries the actor tag rrb_stag while this lasts (stagger_rule)
            {"list": "BuffList", "key": "Idx", "from": "2101_delay", "to": STAG_TAG, "set": [
                {"path": "Name", "value": "Ruby: staggered by a rifle round (the next rounds do not make it flinch)"},
                {"path": "LogicArray", "value": [logic(101, "rrbStagOn", hint="BuffLogic_ScriptCallStart"),
                                                 logic(102, "rrbStagOff", hint="BuffLogic_ScriptCallEnd")]}]},
            {"list": "BuffList", "key": "Idx", "from": "skill_times", "to": CLASH_BG, "set": [
                {"path": "Name", "value": "Ruby: Clash Assault backdrop"},
                {"path": "MaxStack", "value": 1}, {"path": "AddReplaceType", "value": 3},
                {"path": "StopCond.EndOnDie", "value": 1},
                {"path": "AddEffects", "value": [{"Res": CLASH_BG_FX, "BindPos": 0, "Offset": {"x": 0.0, "y": 0.0}, "Scale": 1.0,
                                                  "FitRole": 0, "Layer": 678496669, "BindDirType": 0, "BindPosEveryFrame": 0,
                                                  "ValidBuffStackMin": 0, "ValidBuffStackMax": 99999, "StartTimeType": 0}]}]},
            {"list": "BuffList", "key": "Idx", "from": "21521", "to": "rrb_pb_hold", "set": [
                {"path": "Name", "value": "Ruby: held by Petal Burst"},
                {"path": "LogicArray", "value": [logic(21, value=0.02, interval=0.1, hint="BuffLogic_ConstrainXZ")]},
                {"path": "AddEffects", "value": []}]}] + hold_buffs(logic)


def js_config(P, B):
    import json
    cards = [i * 10 + 1 for i, *_ in P.CARDS]
    uni = [P.POT[k] * 10 + 1 for k in UNIVERSAL]
    dust = {k: [status, dur, stre] for key, k, status, dur, stre in B.DUST_EL}
    return ('var RRB_POWER = {cards: %s, universal: %s, s2: %d, s3: %d, rachel: 100401, silver: %d, dust: %s, '
            'full: %s, gun: %s, gunDose: %d, fullFire: %s, fullPull: %s, gravPull: %s, bid: %d, gwAgain: %s, rifleStagger: %s};' % (
                cards, uni, STAGE2, STAGE3, P.POT['silver_eyes'] * 10 + 1, json.dumps(dust),
                json.dumps(DUST_FULL_RE), json.dumps(DUST_GUN_RE), GUN_DOSE, json.dumps(list(FULL_FIRE)),
                json.dumps(list(FULL_PULL)), json.dumps(list(GRAV_PULL)), B.BID, P.GWELL["again"],
                json.dumps(getattr(P, "RIFLE_STAGGER", None)))) + chr(10)
