"""rrb_fx.py -- Ruby V2: which effect each of her actions plays, where and when (docs/cross-effect/V2_REBUILD.md §2).

Replaces 0.3.0's BBTAG flipbooks and their carriers. Every effect is BOUND to the actor that owns it (her, or a round),
so it turns with her facing; pieces that must stay behind (smoke, sparks, casings) simulate in world space inside the
prefab. Every BBTAG effect cue her moves have is classified:
  arc     her scythe arcs, spins, rings: compiled at build time into mesh particles (mods/char-ruby/fxcompile_ruby.py,
          gen/fxplan.json), spawned on the cue's tick at her root (or the frame's attachment point)
  muzzle  BBEE gunfire (fxkit_cross rrb_muzzle / rrb_muzzle_heavy) at the firing frame's MUZZLE POINT, rotated to the
          shot: the frame's attachment point (the barrel tip, JONBIN box3) nudged forward, else BBTAG's own flash
          placement (tools/bbtag/ruby_attach.py draws every one on her frames); Gun Blasts add the shockwave ring
  casing  the spent casing from the ejection point (Noel's shell, which ejects up and back by itself)
  petals  0.1.2's petal puff (the lead: "the petals are great")
  plume   the launch plume of 5AAAA and forward Gun Blasts (BBTAG rrb405Eff draws sprite puffs; Test 6 showed them as cropped
          squares): BBEE's skid wind turned back, with petals
  round   her rounds' own effect rides the projectile (rrb_round), killed with it
Rounds spawn at the muzzle point of their firing frame, in the shot's direction (0.3.0 used Noel's offsets: the Rifle
Shot round started 0.2 u BEHIND her; Test 6).
"""
import copy, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

ARC_PREFIX = "Role/Rrb/arc_"
MUZZLE, MUZZLE_HEAVY, BLAST_RING = "Role/Rrb/rrb_muzzle", "Role/Rrb/rrb_muzzle_heavy", "Role/Rrb/rrb_blast_ring"
CASING, PETALS, PLUME, ROUND = "Role/Rrb/rrb_casing", "Role/Rrb/rrb_petals", "Role/Rrb/rrb_plume", "Role/Rrb/rrb_round"
GROUND_HIT, SKID, HIT_GUN = "Role/Rrb/rrb_ground_hit", "Role/Rrb/rrb_skid", "Role/Rrb/rrb_hit_gun"
BLAST_BURST = "Role/Rrb/rrb_blast_burst"
# screen shake when she fires (stock action CameraShake, as Noel's attack7: strength x = y, seconds): light shots,
# Gun Blasts, heavy shots
SHAKE = {"light": (0.10, 0.10), "blast": (0.14, 0.12), "heavy": (0.22, 0.16)}
# her Dust colours the gunfire (the lead, 2026-09-29: "make sure the bullets change color when you change dust
# cartridges"): every gun effect has a palette per Dust (fxkit_cross RubyVFX.Pals); the Dust buffs are rrb_dust1-4
DUST = [("", None), ("_fire", "rrb_dust1"), ("_ice", "rrb_dust2"), ("_bolt", "rrb_dust3"), ("_grav", "rrb_dust4")]
DUSTED = ("rrb_muzzle", "rrb_muzzle_heavy", "rrb_blast_burst", "rrb_blast_ring", "rrb_round", "rrb_hit_gun",
          "rrb_round_heavy", "rrb_hit_gun_heavy", "rrb_round_end", "rrb_ricochet")
ROUNDS = {"ShotAtk", "RifleShotA", "RifleShotB", "RifleShotEx", "RollingShot", "AirRollingShot", "AirRollingShotEx", "ShotAtk_Assist"}
SKIP = {"rrb450Flare", "rrb610Eff", "rrb450WinPetal", "UltimateAssault_AddAtk"}     # supers: rrb_supers.py
FORWARD_NUDGE = 0.12      # u: the flash starts just past the barrel tip
# arcs whose finished stroke lands a tick after the blade reaches the end of the swing (ruby_preview --ticks sheets):
# spawned that many ticks earlier, so the smear is complete on the frame the blade gets there
LEAD = {"rrb271Eff": 1,
        # V2 Potential moves (the lead, 2026-09-29: "they look delayed"): BBTAG draws these arcs on the frame the stroke
        # completes, 3-4 ticks after the blade passed; they now arrive with the blade (base moves unchanged)
        "rrb201Eff": 3, "rrb202Eff": 3, "rrb231Eff": 3, "rrb311Eff": 3, "rrb311EndEff": 2}
MAX_TURN_V2 = 140.0   # degrees between two frames: past this a new move's trail sweep is ambiguous and skipped


def classify(state, compiled):
    if state in ROUNDS: return "round"
    if "Muzzle" in state: return "muzzle"
    if state == "rrbCaseEff": return "casing"
    if "PetalEff" in state: return "petals"
    if state == "rrb405Eff": return "plume"
    if state in SKIP or state.endswith("_Break"): return "skip"
    return "arc" if compiled["parts"] else "skip"


_comp = {}
def compiled(state):
    import bbtag_fxcompile as FC
    if state not in _comp:
        _comp[state] = FC.compile_state(state)
    return _comp[state]


def muzzle_point(port, mv, t, state):
    """(x, y, angle) of the gun's muzzle on the frame showing at t (facing right, world units, degrees)."""
    fr = [f for f in mv["frames"] if f[1] <= t * 60 + 1e-6 < f[1] + f[2]]
    jb = port.MOVES.jonbin(fr[0][0]) if fr else None
    pts = (jb or {}).get("boxes", {}).get("box3") or []
    r = compiled(state)
    ang = 0.0
    parts = r["parts"]
    if parts:
        import numpy as np
        p = max(parts, key=lambda q: len(q["verts"]))
        c = np.asarray(p["verts"]).mean(0)
        if (c ** 2).sum() > 1e-6: ang = math.degrees(math.atan2(c[1], c[0]))
        ox, oy = p["origin"]
    else:
        ob = next((o for o in r["objects"] if o["model"]), r["objects"][0])
        ox, oy, ang = ob["x"], ob["y"], ob["rot"]
    if pts:                                       # the barrel tip, then a nudge along the shot
        u = port.MOVES.box_u(pts[0])
        a = math.radians(ang)
        return (u[0] + FORWARD_NUDGE * math.cos(a), u[1] + FORWARD_NUDGE * math.sin(a), ang)
    return (ox, oy, ang)


def attach_point(port, mv, t):
    fr = [f for f in mv["frames"] if f[1] <= t * 60 + 1e-6 < f[1] + f[2]]
    jb = port.MOVES.jonbin(fr[0][0]) if fr else None
    pts = (jb or {}).get("boxes", {}).get("box3") or []
    if not pts: return None
    u = port.MOVES.box_u(pts[0]); return (u[0], u[1])


def mirror_detached(port, acts, log=print):
    """0.9.0: every effect spawned in place (Binding 0) with a rotation that is not 0 or 180 degrees gets a second
    entry for when she faces left, with the opposite angle; the two are told apart by the stock facing condition
    (ActionLogicCondition_ActorDir). The game flips a detached effect and then turns it by the entry's angle, so
    facing left the same angle pointed to 180 + a where the mirror image points to 180 - a (in game, 2026-10-09: the
    upward blast's flash 10 degrees above level in place of below; a tester, 2026-10-07: "the rotation angle seems
    to be calculated incorrectly for all dashes towards left direction"). Run last, after the Dust copies exist."""
    fv, fp = port.fv, port.fp
    n = 0; names = set()
    for a in acts:
        out = []
        for e in a.get("AddEffects") or []:
            rot = e.get("Rotation") if isinstance(e, dict) else None
            if not rot or e.get("Binding") != 0: out.append(e); continue
            rx, ry = fv(rot["x"]), fv(rot["y"])
            if abs(math.sin(math.radians(rx))) < 0.02 and abs(math.sin(math.radians(ry))) < 0.02: out.append(e); continue
            left = copy.deepcopy(e)
            left["Rotation"] = {"x": fp(-ry), "y": fp(-rx)}
            for ent, data in ((e, {"FaceRight": 1}), (left, {"Invert": 1, "FaceRight": 1})):
                cg_ = ent.setdefault("ConditionGroup", {"Combine": 0, "Conditions": []})
                cg_["Conditions"] = list(cg_.get("Conditions") or []) + [port.refs.new("ActionLogicCondition_ActorDir", data)]
            out += [e, left]; n += 1; names.add(a["Name"])
        if a.get("AddEffects") is not None: a["AddEffects"] = out
    log("0.9.0 effects spawned in place with a rotation: %d entries on %d moves now have a facing-left twin" % (n, len(names)))


def entry(port, fx_entry, name, t, x=0.0, y=0.0, angle=0.0, kill=1, attached=True):
    e = fx_entry(port, name, t, angle=angle, dx=x, dy=y, attached=attached)
    e["KillMode"] = kill
    return e


def wire(port, by, btree, action_states, fx_entry, heavy=(), loops=None, log=print):
    """Add every action's effects. action_states: {action: (BBTAG states, start offset in them, cue window end)}.
    heavy: actions whose shots use the heavy muzzle. loops: {action: (state, first tick s, step s)} repeated arcs.
    -> (fxplan {effect name: compile options}, gun events {action: [(t, x, y, angle)]})."""
    plan, guns, n = {}, {}, 0
    retimed = port.RETIMED if hasattr(port, "RETIMED") else {}
    for name, (sts, off, end) in action_states.items():
        a = by.get(name)
        if not a: continue
        k = retimed.get(name, 1.0)
        T = port.fv(a["TotalDuration"])
        mv = port.MOVES.move(*sts)
        for t, kind, v in mv["cues"]:
            if kind != "gfx" or not isinstance(v, str) or t < off - 1e-6 or (end is not None and t >= end - 1e-6):
                continue
            tt = (t - off) * k
            cls = classify(v, compiled(v))
            if tt > T and cls == "casing" and tt - T < 0.25:
                tt = T - 1 / 60.0      # the first Gun Blast ends before BBTAG's late casing cue: eject it on her way out
            if tt > T: continue
            if cls == "arc" and v.lower().endswith("endeff"):
                # BBTAG's "End" smears (rrb311EndEff, rrb407EndEff: Hook's and Rifle Shot's recovery) are 8 different
                # meshes 2-4 ticks each, a 30 Hz flipbook: the "choppy" look the lead reported (2026-10-02). Left out
                continue
            if cls == "arc":
                tt = max(0.0, tt - LEAD.get(v, 0) / 60.0 * k)
                fx = ARC_PREFIX + v.lower()
                grounded = any(is_ground(o) for o in children(v))
                # an arc whose BBTAG effect has a ground-contact child ends ON the floor (its blade is lowered to it,
                # never raised; the lead, Test 6: "the downward attack's path doesn't reach the ground")
                if fx in plan and abs(plan[fx].get("speed", 1.0) - 1.0 / k) > 1e-6:
                    log("rrb_fx: %s plays at two speeds (%s): using the first" % (fx, name))
                else:
                    plan[fx] = {"state": v, "core": True, "floor": grounded and not port.AIRBORNE(name), "speed": round(1.0 / k, 4)}
                p = attach_point(port, mv, t) or (0.0, 0.0)
                a.setdefault("AddEffects", []).append(entry(port, fx_entry, fx, tt, p[0], p[1]))
                n += child_effects(port, a, fx_entry, v, tt, p, T, k)
            elif cls == "muzzle":
                x, y, ang = muzzle_point(port, mv, t, v)
                fx = MUZZLE_HEAVY if name in heavy else MUZZLE
                blast = name.startswith(("dash", "rrb_blast"))
                # a Gun Blast throws her away from the shot: its flash, burst and ring stay where she fired
                # (detached; preview: bound, they rode along with her dash). Standing shots stay bound to her.
                # a shot fired into the floor from her feet (Corkscrew, the Clash finish, ground Up-blast: -130 deg at
                # 0 u): its flame and smoke sprayed underground (preview 2026-09-29). The flame skims along the floor
                # (10 deg down, 0.7x) and the floor takes the blast (below)
                floor_shot = y < 0.35 and -170.0 < ang < -10.0
                if floor_shot:
                    e = entry(port, fx_entry, fx, tt, x, max(y, 0.05), -170.0 if ang < -90.0 else -10.0, attached=not blast)
                    for ax in ("x", "y"): e["Scale"][ax] = port.fp(port.fv(e["Scale"][ax]) * 0.7)
                    a.setdefault("AddEffects", []).append(e)
                else:
                    a.setdefault("AddEffects", []).append(entry(port, fx_entry, fx, tt, x, y, ang, attached=not blast))
                if blast:                    # Gun Blast: the recoil burst with the gunburst and the shockwave
                    a["AddEffects"].append(entry(port, fx_entry, BLAST_BURST, tt, x, y, 0.0, attached=False))   # radial: unrotated
                # the shockwave ring on every shot (the heavy gunburst's own disc read as a block edge-on: dropped).
                # A shot fired into the floor from her feet (Corkscrew, the Clash finish, ground Up-blast: -130 deg at
                # 0 u) would draw its ring underground (preview 2026-09-29): the floor takes the blast instead
                if floor_shot:
                    a["AddEffects"].append(entry(port, fx_entry, GROUND_HIT, tt, x, 0.0, 0.0, attached=False))
                elif not (name in heavy or blast) and _has_fx("rrb_round_heavy"):
                    pass        # (the rebuilt ring is a heavy shot's, as Noel's: a light shot throws none)
                else:
                    a["AddEffects"].append(entry(port, fx_entry, BLAST_RING, tt, x, y, ang, attached=not blast))
                st_, du_ = SHAKE["heavy" if name in heavy else ("blast" if blast else "light")]
                a.setdefault("CameraShake", []).append({"Time": float(tt), "ShakeStr": {"x": st_, "y": st_}, "Duration": du_})
                guns.setdefault(name, []).append((tt, x, y, ang))
                n += child_effects(port, a, fx_entry, v, tt, (0.0, 0.0), T, k)
            elif cls == "casing":
                # Noel's shell ejects up and back by itself (rrb_casing): no rotation, the ejection port is the frame's
                # attachment point
                p = attach_point(port, mv, t) or (0.0, 1.0)
                a.setdefault("AddEffects", []).append(entry(port, fx_entry, CASING, tt, p[0], p[1]))
            elif cls == "petals":
                a.setdefault("AddEffects", []).append(entry(port, fx_entry, PETALS, tt, -0.3, 0.8))
            elif cls == "plume":
                # the skid wind blows back from her feet, petals from her waist (rrb_plume)
                a.setdefault("AddEffects", []).append(entry(port, fx_entry, PLUME, tt, -0.2, 0.0))
            else:
                continue
            n += 1
        if loops and name in loops:
            st, t0, step = loops[name]
            fx = ARC_PREFIX + st.lower(); plan[fx] = {"state": st, "core": True}
            t = t0 + step
            while t < T - 0.05:
                a["AddEffects"].append(entry(port, fx_entry, fx, t, kill=2)); t += step; n += 1
    log("rrb_fx: %d effect spawns on %d actions, %d compiled arc effects" % (n, len(action_states), len(plan)))
    return plan, guns


TRAIL_PREFIX = "Role/Rrb/trail_"
WAVE_PREFIX = "Role/Rrb/wave_"
# stage slashes (rrb_power): {(action, stage): effect name}: a crescent thrown off the action's damaging swing, built
# from that swing's own blade path (tools/bbtag/ruby_blade.wave_parts). Flight time (ticks) and ribbon width (u) by stage
WAVES = {}
WAVE_TICKS = {}      # {(action, stage): its flight in ticks} (rrb_power times the hit by it)
# moves whose every big swing throws a crescent of its own (the supers' execution slashes; game review 2026-10-02: Red
# Reaper's largest hit had "no slash arc on the blade", only a stock spark)
SWING_WAVES = {"rrb_redreaper": dict(k=3.2, ky=1.5, ticks=10, thick=0.46, rim=1.3, min_reach=1.6)}
# (preview 2026-10-02: thrown off its own flat spin, the slash was a streak along the floor.) Two standing crescents, floor
# to 2.9 u, thrown out to both sides
GUIL_FIN = dict(shape="stand", height=2.9, bulge=0.75, x0=0.9, k=8.5, ticks=10, thick=0.55, rim=1.3)
# Red Reaper's strikes: crossing cuts on the enemy at every hit (game review 2026-10-02: its largest hit had "only the
# ordinary star spark"). A hit effect, so it stands where the target is
RR_CUT = "Role/Rrb/wave_rr_cut"
RR_CUT_PLAN = dict(shape="cuts", angles=(38.0, -32.0, 84.0), length=3.4, bulge=0.5, k=1.3, ticks=6, thick=0.26, rim=1.2, gap=2)
_FX_ENTRY = [None]    # Guillotine's stage 3 finishing slash: thrown off its
                     # own swing to both sides, across the screen (rrb_power WAVE_BOX: -8.5..13.5 u)
WAVE_LOOK = {2: dict(ticks=8, thick=0.30), 3: dict(ticks=12, thick=0.40)}
# the kind of swing (the lead, 2026-10-02: her effects "distinguish quick cuts, broad sweeps, spins, and heavy
# finishers"): flight time x, ribbon width x, hot rim x. Moves not listed are broad sweeps (1, 1, 1)
WAVE_KIND = {"quick": (0.75, 0.75, 0.8), "heavy": (1.25, 1.35, 1.0)}
WAVE_MOVES = {"rrb_a2": "quick", "rrb_ja": "quick", "rrb_j2a": "quick", "rrb_sypod": "quick",
              "rrb_a4": "heavy", "rrb_launcher": "heavy", "rrb_clash": "heavy", "rrb_clash_land": "heavy", "rrb_jc": "heavy",
              "rrb_buzzsaw_land": "heavy"}
# her scythe moves: every swing gets a trail swept by the blade on her own frames (tools/bbtag/ruby_blade.py)
# (5A is a jab with the spear end: its blade only turns behind her, and the swept trail drew a ring and a swirl there in
#  game. It plays rrb_thrust instead: build_ruby.THRUST; the effects pass, 2026-09-30)
# (Clash Assault and its landing are left out: the lead, 2026-10-02: it "has a scythe slash even though it should work
#  exactly like her air gun attack does". It is her gun strike, with j.C's gun effects: build_ruby.movement)
# (Buzzsaw's landing spin is left out since 0.8.0. A tester, 2026-10-03: "a horizontal effect shows up in the middle of
#  the spin and it looks kinda weird": the spin is level, so its trail is seen edge-on, a pale flat wedge across the saw
#  wheel. The wheel (rrb_saw_land) is the landing spin's effect.)
TRAIL_ACTIONS = ("rrb_a2", "rrb_a3", "rrb_a4", "rrb_launcher", "rrb_sweep",
                 "rrb_corkscrew", "rrb_ja", "rrb_jb", "rrb_jc", "rrb_j2a", "rrb_guillotine", "rrb_sypod")
# air moves: their stage slashes fly free of the floor (her root is in the air: a floor at her feet cut the crescents)
AIR_WAVES = ("rrb_ja", "rrb_jb", "rrb_jc", "rrb_j2a")
# swings whose blade can't be read off her frames (j.2A turns 154 degrees between two frames): a made stroke for their stage
# slashes (ruby_blade.wave_from_plan shape "arc": radius, from a0 to a1 degrees about her body)
MADE_STROKES = {"rrb_j2a": dict(shape="arc", radius=1.55, a0=35.0, a1=-115.0),
                # (the lead, 2026-10-02: the stage waves "extend her attack range ... for the dash attack and the clash attack")
                # 5AAAA's flash-through: a level crescent thrown ahead of the pass; Clash Assault: down and ahead along its shot
                "rrb_a4": dict(shape="arc", radius=1.5, a0=55.0, a1=-35.0, back=False),
                "rrb_clash": dict(shape="arc", radius=1.6, a0=35.0, a1=-80.0, back=False)}


# ---- the slash projectile, per move (2026-10-03; the kit's rrb_slashwave2_<class> on this move's own crescent:
# tools/bbtag/ruby_crescent.py). move: (class, silhouette, tilt in degrees counter-clockwise from the silhouette's own lie,
# head: +1 the pointed end is the upper tip / -1 the lower, on the floor). Classes: quick 3.6 u long, 26 u/s, 0.65 s;
# sweep 4.6 u, 24 u/s, 0.90 s; heavy 5.6 u, 24 u/s, 0.95 s. fang = an upright crescent (vertical cuts, launchers, heavy
# blows), riser = a rising hook (diagonal cuts), lens = a flat crescent (level cuts and spins: the front of their ring
# as it is seen; a sixth value is that ring's short axis / long axis). The two shapes the lead approved are 5AA's riser
# and Rising Reap's fang.
# (the lead, 2026-10-10: "Do the each red slash". Each entry is its swing's own slash measured on her frames,
#  local_only/cross_effect/swing_measure.py: an upright ring takes the fang at its lean, a rising one the riser at its
#  axis less the riser's own 24 degrees, a level one the lens at its axis, held to 20 degrees either way)
WAVE2_MOVES = {
    "rrb_a2": ("quick", "riser", 0.0, +1, True),            # 5AA (approved)
    "rrb_a3": ("sweep", "fang", 20.0, -1, True),            # 5AAA, the overhead: its top leans back, it ends at the floor
    "rrb_a4": ("heavy", "fang", 0.0, +1, True),             # 5AAAA
    "rrb_5b": ("sweep", "lens", -8.0, +1, True, 0.26),      # the level cut at the waist
    "rrb_5bb": ("sweep", "riser", 0.0, +1, True),           # the rising cut after it lies as 5AA's does
    "rrb_sweep": ("sweep", "lens", -12.0, -1, True, 0.30),  # Low Sweep: along the floor
    "rrb_2b": ("sweep", "riser", 5.0, +1, True),            # Rising Crescent
    "rrb_launcher": ("heavy", "fang", 12.0, +1, True),      # Rising Reap (approved)
    "rrb_launcher_air": ("sweep", "fang", 12.0, +1, False),
    "rrb_corkscrew": ("sweep", "lens", -20.0, +1, True, 0.36),
    "rrb_guillotine": ("sweep", "lens", 0.0, +1, True, 0.28),
    "rrb_ja": ("quick", "lens", -14.0, +1, False, 0.27),
    "rrb_jb": ("sweep", "fang", 20.0, +1, False),           # the air overhead: its top leans back
    "rrb_jc": ("sweep", "fang", -25.0, -1, False),          # the downward blow
    "rrb_j2a": ("quick", "fang", -35.0, -1, False),         # Double Kick: down and forward
    "rrb_clash": ("heavy", "fang", -25.0, -1, False),       # Clash Assault: down and forward along its shot
    "rrb_clash_chase1": ("sweep", "riser", 0.0, +1, True),
    "rrb_clash_chase2": ("sweep", "fang", 0.0, +1, True),
    "rrb_clash_finish": ("sweep", "lens", -20.0, +1, True, 0.36),
    "rrb_hook_exe": ("sweep", "fang", 0.0, +1, True),       # Reaper's Hook's strikes are upright cuts
    "rrb_hook_back": ("sweep", "fang", 0.0, +1, True),
}
WAVE2 = {}           # {move: its projectile's spec (ruby_crescent.wave_spec)}; rrb_power.wave_boxes reads it


def _wave_at(port, by, plan, name):
    """where the move's projectile leaves the swing: (the forward-most x of its stage 1 band, the middle height of the
    band's forward part); a move without a band: the front and middle of its hit boxes"""
    import numpy as np
    b = ((plan.get(TRAIL_PREFIX + name + "_d0") or {}).get("slash") or {}).get("band")
    if b:
        V = np.asarray(b["verts"], float)
        fwd = V[V[:, 0] >= V[:, 0].max() - 0.35 * np.ptp(V[:, 0])]
        return float(V[:, 0].max()), float(0.5 * (fwd[:, 1].min() + fwd[:, 1].max())), "band"
    hits = (by.get(name) or {}).get("HitDataList") or []
    if hits:
        x1 = max(port.fv(h["HitBox"]["Max"]["x"]) for h in hits)
        h0 = min(hits, key=lambda h: port.fv(h["TickRange"]["Start"]))
        return float(x1), float(0.5 * (port.fv(h0["HitBox"]["Min"]["y"]) + port.fv(h0["HitBox"]["Max"]["y"]))), "hit box"
    return 1.5, 1.0, "default"


def _blade_frames(RB, assets, fr):
    """[(tick, sprite, blade spine heel -> tip or None, swinging)] on each frame change of her action's clip, ticks from the
    action's start (ruby_arcband.move_blade's reading, on the frames this build plays)"""
    import numpy as np
    out, prev = [], None
    for tick, sp in fr:
        b = RB.blade(assets, sp)
        spine = None if b is None else RB.orient(prev, b[0])
        sw = False
        if spine is not None and prev is not None:
            th, _, _ = RB.rigid(prev, spine)
            sw = bool(np.linalg.norm(spine[-1] - prev[-1]) >= RB.MIN_MOVE or abs(math.degrees(th)) >= RB.MIN_TURN)
        out.append((float(tick), sp, spine, sw))
        if spine is not None: prev = spine
    return out


def look_d(port, a, name, kind, arcs, fx_entry, plan, RB, assets, fr):
    """Look D (the lead, 2026-10-02: BBTAG's slashes are "circular ... and only applies when the scythe is attacking", "a mix
    of that and C"; "the slash vfx is not synced up to rubys animatioons ... keep it 60 dps"): each of the move's BBTAG arcs
    becomes one rrb_slash band of BBTAG's own shape and size (ruby_arcband.band_from_bbtag), its head following her blade
    frame by frame (sync_band; BBTAG's own timing where the blade is not on it), nothing in recovery. The BBTAG arc entry it
    replaces goes. -> the effect names made"""
    import ruby_arcband as AB
    if not getattr(AB.FC, "_rrb_memo", None):          # (variants share arcs: one compile each)
        AB.FC.compile_state = (lambda f: (lambda st, *x, **k: f(st, *x, **k) if (x or k) else (_comp[st] if st in _comp else _comp.setdefault(st, f(st)))))(AB.FC.compile_state)
        AB.FC._rrb_memo = True
    blade = _blade_frames(RB, assets, fr)
    made, keep = [], []
    for e in a.get("AddEffects") or []:
        nm = e["NameEx"]["ConstValue"]
        st = next((v for t_, v in arcs if nm == ARC_PREFIX + v.lower()), None) if nm.startswith(ARC_PREFIX) else None
        if st is None:
            keep.append(e); continue
        bands = AB.band_from_bbtag(st, kind, spawn=port.fv(e["Start"]) * 60.0, blade=blade)
        if not bands:
            keep.append(e); continue
        for b in bands:
            if not AB.sync_band(b, blade, AB.sync_window(b), t_out_bbtag=b["t_out"]): AB.default_wipe(b)
            fx = TRAIL_PREFIX + "%s_d%d" % (name, len(made))
            plan[fx] = {"slash": dict(kind=kind, band={k_: b[k_] for k_ in ("verts", "uv", "tris", "t_beg", "t_end", "t_out", "wipe",
                                                                             "drift", "centroid", "head", "extent", "fit_rms", "ellipse", "closed", "turn_deg", "state") if k_ in b})}
            try: import rrb_preview as PV  # (dev only, RRB_PREVIEW=1: the lab's stage 2 / 3 looks on three moves)
            except ImportError: PV = None  # a release package has no preview module: every stage plays the move's own slash
            for st_, sc_ in STAGE_SLASH_SCALE.items():
                e2 = entry(port, fx_entry, (PV.slash_fx(name, st_, len(made)) if PV else None) or fx, max(0.0, b["t_beg"]) / 60.0)
                if sc_ != 1.0: e2["Scale"] = {"x": port.fp(sc_), "y": port.fp(sc_)}
                e2["ConditionGroup"] = {"Combine": 0, "Conditions": _stage_conds(port, st_)}
                keep.append(e2)
                af = PV.after_fx(name, st_) if (PV and len(made) == 0) else None
                if af:
                    e3 = entry(port, fx_entry, af[0], af[1], attached=False)
                    e3["ConditionGroup"] = {"Combine": 0, "Conditions": _stage_conds(port, st_)}
                    keep.append(e3)
            made.append(fx)
    if made: a["AddEffects"] = keep
    return made


def trails(port, by, fx_entry, plan, action_states, log=print):
    _FX_ENTRY[0] = fx_entry
    plan[RR_CUT] = {"wave": dict(RR_CUT_PLAN)}
    """Scythe trails: one effect per swing of each scythe move (bound to her, from the swing's first moving frame);
    blunt (BBTAG's dageki textures) when BBTAG draws the move's own smear blunt, else slash. The move's BBTAG arcs stay
    as the impact accent: shown from the tick their stroke is complete (plan "hero": their build-up pieces, which did
    not always sit on the blade, are left to the trail)."""
    _tools = next(p for p in (os.path.join(HERE, "own"), port_root()) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # (her own copies in a loader pack)
    sys.path.insert(0, os.path.join(_tools, "tools", "bbtag"))
    import ruby_blade as RB
    assets = RB.Frames(port.MOVES.src, port.SEQS)
    n = 0
    for name in TRAIL_ACTIONS:
        a = by.get(name)
        if not a: continue
        sts = (action_states.get(name) or ([], 0, None))[0]
        style = "slash"
        arcs = []                                           # (cue tick, BBTAG arc state) of this move's own arcs
        for st in sts:
            mv = port.MOVES.move(st)
            for t, kind, v in mv["cues"]:
                if kind == "gfx" and isinstance(v, str) and classify(v, compiled(v)) == "arc":
                    arcs.append((t, v))
                    if ARC_PREFIX + v.lower() in plan: plan[ARC_PREFIX + v.lower()]["hero"] = True
                    if any("dageki" in (q.get("texture") or "") for q in compiled(v)["parts"]): style = "blunt"
        fr = RB.frames_of(assets, a["Animate"], port.fv(a["AnimateDuration"]), port.fv(a["TotalDuration"]))
        planned = RB.plan_swings(assets, fr, style)
        # effects only in the attack window (the lead's release brief): a swing that starts after the move's last hit
        # is its recovery (5AA's and 5AAA's return swings drew trails after the strike), and draws none
        hs_ = a.get("HitDataList") or []
        if hs_:
            last_ = max(port.fv(h["TickRange"]["End"]) for h in hs_) * 60.0
            cut_ = [t0 for t0, o in planned if t0 > last_ + 3.0]
            planned = [(t0, o) for t0, o in planned if t0 <= last_ + 3.0]
            for t0, o in planned:
                o["until"] = round(last_ + 3.0 - t0, 2)     # and a swing still going after it stops drawing there
            if cut_: log("rrb_fx: %s: %d recovery swing(s) after its last hit draw no trail" % (name, len(cut_)))
        drawn = []                                           # (from, to) s: where a smooth trail draws this move's blade
        slash = _has_fx("rrb_slash")                         # the kit's slash template (0.6.13): crescents, not trails
        kind = slash_kind(name)
        made_d = look_d(port, a, name, kind, arcs, fx_entry, plan, RB, assets, fr) if slash and arcs else []
        if made_d:
            n += len(made_d)
            log("rrb_fx: %s: look D, %d band(s) from its BBTAG arcs, synced to her blade" % (name, len(made_d)))
        for k, (t0, o) in enumerate(planned if not made_d else []):
            o["max_turn"] = MAX_TURN_V2      # (every move: a smooth trail would sweep a 154-degree jump as a fan)
            sw_ = RB.oriented([(t_, b_[0]) for t_, b_ in ((t_, RB.blade(assets, s_)) for t_, s_ in o["frames"]) if b_ is not None])
            at = max(0.0, t0 - o.get("lead", 0.0)) / 60.0
            if slash:
                cres = RB.swing_crescent(sw_, kind, o["max_turn"], o.get("lead", 0.0), o.get("until")) if len(sw_) >= 2 else []
                for j, c in enumerate(cres):
                    fx = TRAIL_PREFIX + "%s_%d_%d" % (name, k, j)
                    plan[fx] = {"slash": dict(frames=o["frames"], kind=kind, lead=o.get("lead", 0.0), until=o.get("until"),
                                              max_turn=o["max_turn"], run=j)}
                    # one entry per power stage: the slash grows with her (the lead, 2026-10-02: "stage 2 is the bigger
                    # slashes and stage 3 is even bigger and sends large slash projectiles"); about her feet
                    for st_, sc_ in STAGE_SLASH_SCALE.items():
                        e = entry(port, fx_entry, fx, at)
                        if sc_ != 1.0: e["Scale"] = {"x": port.fp(sc_), "y": port.fp(sc_)}
                        e["ConditionGroup"] = {"Combine": 0, "Conditions": _stage_conds(port, st_)}
                        a.setdefault("AddEffects", []).append(e)
                    n += 1
            else:
                fx = TRAIL_PREFIX + "%s_%d" % (name, k)
                plan[fx] = {"trail": o, "core": True}
                a.setdefault("AddEffects", []).append(entry(port, fx_entry, fx, at))
                n += 1
            for run in RB.swing_runs(sw_, o["max_turn"]):
                drawn.append(((t0 + run[0][0] - 2) / 60.0, (t0 + run[-1][2] + 2) / 60.0))
        # one smear per swing (the lead, 2026-10-02: "cut up"; the effects study: a swing drew up to three smears on
        # different clocks, the trail, BBTAG's arc popping in whole at the finished stroke, and the stage wave). Where a
        # smooth trail draws the blade, the move's BBTAG arc is left out; it stays where none does (5B / 5BB's whirls)
        before = len(a.get("AddEffects") or [])
        a["AddEffects"] = [e for e in a.get("AddEffects") or [] if not (e["NameEx"]["ConstValue"].startswith(ARC_PREFIX)
                           and any(s0 <= port.fv(e["Start"]) <= s1 for s0, s1 in drawn))]
        if len(a["AddEffects"]) < before:
            log("rrb_fx: %s: %d BBTAG arc(s) left out where its trail draws" % (name, before - len(a["AddEffects"])))
        if name in SWING_WAVES:
            W_ = dict(SWING_WAVES[name]); need = W_.pop("min_reach")
            made_ = 0
            for k, (t0, o) in enumerate(planned):
                sw_ = [(t_, RB.blade(assets, s_)) for t_, s_ in o["frames"]]
                sw_ = RB.oriented([(t_, b_[0]) for t_, b_ in sw_ if b_ is not None])
                if len(sw_) < 2: continue
                pts_ = RB.stroke_from_swing(sw_, None, o.get("max_turn"))
                reach_ = sum(math.hypot(b_[0] - a_[0], b_[1] - a_[1]) for a_, b_ in zip(pts_, pts_[1:]))
                if reach_ < need: continue
                fx = WAVE_PREFIX + "%s_sw%d" % (name, k)
                plan[fx] = {"wave": dict(frames=o["frames"], state=None, style="slash", back=True, max_turn=o.get("max_turn"), **W_)}
                t_end = t0 + (o["frames"][-1][0] - o["frames"][0][0])
                a.setdefault("AddEffects", []).append(entry(port, fx_entry, fx, max(0.0, t_end - 2.0) / 60.0))
                made_ += 1
            log("rrb_fx: %s: %d thrown crescents on its swings" % (name, made_))
        # the stage slashes of this move: thrown off the swing that lands its first hit (the one already moving when
        # the hit starts), from that swing's stroke up to the hit
        hits = a.get("HitDataList") or []
        if hits and (planned or arcs):
            import rrb_power
            h0 = min(hits, key=lambda h: port.fv(h["TickRange"]["Start"]))
            ht, he = port.fv(h0["TickRange"]["Start"]) * 60.0, port.fv(h0["TickRange"]["End"]) * 60.0
            x0 = min(port.fv(h["HitBox"]["Min"]["x"]) for h in hits)
            # the swing that carries the hit: of the swings moving in the 14 ticks before the hit ends, the one whose
            # blade tip draws the longest stroke in front of her (Clash Assault's hit lands at the END of its downswing:
            # the swing that starts on the hit frame barely moves)
            def reach(t0_, o_):
                sw = [(t_, RB.blade(assets, s_)) for t_, s_ in o_["frames"]]
                sw = RB.oriented([(t_, b_[0]) for t_, b_ in sw if b_ is not None])
                if len(sw) < 2: return 0.0
                pts = RB.stroke_from_swing(sw, he - t0_ + 2.0, o_.get("max_turn"))
                fwd = [q for q in pts if q[0] - RB.PIVOT[0] > -0.2 * math.hypot(q[0] - RB.PIVOT[0], q[1] - RB.PIVOT[1])]
                return sum(math.hypot(b_[0] - a_[0], b_[1] - a_[1]) for a_, b_ in zip(fwd, fwd[1:]))
            live = [(reach(t0_, o_), t0_, o_) for t0_, o_ in planned if t0_ <= ht + 1.0 and t0_ + o_["frames"][-1][0] >= ht - 14.0]
            best = max(live, key=lambda x: x[0]) if live else (0.0, ht, {"frames": []})
            if name in MADE_STROKES and best[0] < 1.2 and not arcs:
                kt, kw, kr = WAVE_KIND.get(WAVE_MOVES.get(name), (1.0, 1.0, 1.0))
                for st, S in rrb_power.STAGE.items():
                    fx = WAVE_PREFIX + "%s_s%d" % (name, st)
                    look = WAVE_LOOK[st]
                    plan[fx] = {"wave": dict(MADE_STROKES[name], style="slash", k=S["k"], ky=S["ky"], floor=-99.0,
                                             ticks=int(round(look["ticks"] * kt)), thick=round(look["thick"] * kw, 3), rim=kr)}
                    WAVES[(name, st)] = fx; WAVE_TICKS[(name, st)] = int(round(look["ticks"] * kt))
                log("rrb_fx: %s: stage slashes from a made stroke (%s)" % (name, MADE_STROKES[name]))
                continue
            if best[0] < 1.2 and not arcs:
                log("rrb_fx: %s: no stage wave (its blade draws no stroke in front of her: %.2f u); the thrust line stays" % (name, best[0]))
                continue
            t0, o = best[1], best[2]
            # the stroke: the move's own BBTAG arc where it has one (ASW's ribbon for this swing: its outer edge), else
            # the path her blade tip swept up to the end of the hit
            state = min(arcs, key=lambda c: abs(c[0] - ht))[1] if arcs else None
            kt, kw, kr = WAVE_KIND.get(WAVE_MOVES.get(name), (1.0, 1.0, 1.0))
            for st, S in rrb_power.STAGE.items():
                fx = WAVE_PREFIX + "%s_s%d" % (name, st)
                look = WAVE_LOOK[st]
                plan[fx] = {"wave": dict(frames=o["frames"], state=state, style="slash", k=S["k"], ky=S["ky"],
                                         upto=round(he - t0 + 2.0, 2), back=bool(x0 < -0.8), max_turn=o.get("max_turn"),
                                         ticks=int(round(look["ticks"] * kt)), thick=round(look["thick"] * kw, 3), rim=kr,
                                         floor=-99.0 if name in AIR_WAVES else 0.03)}
                WAVES[(name, st)] = fx; WAVE_TICKS[(name, st)] = int(round(look["ticks"] * kt))
            if name == "rrb_guillotine":
                fx = WAVE_PREFIX + "rrb_guillotine_fin"
                plan[fx] = {"wave": dict(frames=o["frames"], state=state, style="slash", upto=round(he - t0 + 2.0, 2), back=True,
                                         max_turn=o.get("max_turn"), **GUIL_FIN)}
                WAVES[(name, "fin")] = fx; WAVE_TICKS[(name, "fin")] = GUIL_FIN["ticks"]
        log("rrb_fx: %s: %s trail, %d swing(s)" % (name, style, len(RB.plan_swings(assets, fr, style))))
    # made strokes of moves that draw no trail (Clash Assault, her gun strike): their stage slashes only
    import rrb_power
    for name, ms in MADE_STROKES.items():
        if name in TRAIL_ACTIONS or name not in by or (name, 2) in WAVES: continue
        kt, kw, kr = WAVE_KIND.get(WAVE_MOVES.get(name), (1.0, 1.0, 1.0))
        for st, S in rrb_power.STAGE.items():
            fx = WAVE_PREFIX + "%s_s%d" % (name, st); look = WAVE_LOOK[st]
            plan[fx] = {"wave": dict(ms, style="slash", k=S["k"], ky=S["ky"], ticks=int(round(look["ticks"] * kt)),
                                     thick=round(look["thick"] * kw, 3), rim=kr)}
            WAVES[(name, st)] = fx; WAVE_TICKS[(name, st)] = int(round(look["ticks"] * kt))
        log("rrb_fx: %s: stage slashes from a made stroke (no trail)" % name)
    # (the lead, 2026-10-02) stage 2: the blade slashes themselves are bigger (STAGE_SLASH_SCALE), no thrown crescent;
    # stage 3: even bigger, and each throws a large slash projectile that flies on and fades (rrb_power.bullets moves the
    # stage 3 bullet; its crescent keeps its size: "travel")
    S3 = rrb_power.STAGE[3]
    for key in [k_ for k_ in list(WAVES) if k_[1] == 2]:
        plan.pop(WAVES.pop(key), None); WAVE_TICKS.pop(key, None)
    for key in [k_ for k_ in WAVES if k_[1] == 3]:
        w = plan[WAVES[key]]["wave"]
        w.update(travel=True, k=S3["pk"], ky=S3["pk"], ticks=int(round(S3["flight"] * 60)), back=False)
        WAVE_TICKS[key] = int(round(S3["flight"] * 60))
    # the slash projectile on every move that throws one: its stage 3 wave becomes the kit's projectile on this move's own
    # crescent (the same record gives rrb_power its flight and hit rectangles and fxcompile_ruby its meshes)
    import ruby_crescent as RC
    WAVE2.clear()
    for key in sorted(k_ for k_ in WAVES if k_[1] == 3):
        name = key[0]
        if name not in WAVE2_MOVES:
            log("rrb_fx: %s: no projectile class listed (WAVE2_MOVES): it keeps the earlier wave" % name); continue
        cls, sil, tilt, ud, ground = WAVE2_MOVES[name][:5]
        flat = WAVE2_MOVES[name][5] if len(WAVE2_MOVES[name]) > 5 else None
        x, y, src = _wave_at(port, by, plan, name)
        hits = (by.get(name) or {}).get("HitDataList") or []
        bx0 = min([port.fv(h["HitBox"]["Min"]["x"]) for h in hits] or [-0.3])
        spec = RC.wave_spec(sil, cls, (x, y), tilt, ud, ground, box_x0=bx0, flat=flat)
        spec["move"] = name; spec["at_from"] = src
        plan[WAVES[key]] = {"wave2": spec}
        WAVE2[name] = spec
        log("rrb_fx: %s: projectile %s %s (tilt %.0f, %s) at %.2f, %.2f from its %s: %d hit rectangles, %.1f u of flight" % (
            name, cls, sil, tilt, "floor" if ground else "air", x, y, src, len(spec["rects"]), spec["distance"]))
    return n


# (the lead, 2026-10-02 late: "the projectile slashes should be the slashes that are large the scythe slashes are too big
#  and look weird": her scythe slashes grow only a little by stage; stage 3's thrown slashes carry the size)
# (the lead, 2026-10-02 night: "stage 1 looks good for the slashes but making them bigger messes all of that up stage 2
#  and 3 need to have seperate different looking effects ... more ferocious and stronger": no scaling at any stage; the
#  stage 2 / 3 looks are their own effects, STAGE_SLASH_FX)
STAGE_SLASH_SCALE = {1: 1.0, 2: 1.0, 3: 1.0}


def _stage_conds(port, st):
    """the conditions for power stage st's entry (rrb_stage2 / rrb_stage3 are her stage buffs)"""
    if st == 1: return [port.refs.buff("rrb_stage2", invert=1), port.refs.buff("rrb_stage3", invert=1)]
    if st == 2: return [port.refs.buff("rrb_stage2"), port.refs.buff("rrb_stage3", invert=1)]
    return [port.refs.buff("rrb_stage3")]


def port_root():
    return next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))


def children(state):
    """BBTAG child effect objects of an effect (no model of their own): ground contacts, recoil dust, petals."""
    return [o for o in compiled(state)["objects"] if not o["model"] and o["state"] != state]


def is_ground(o):
    return "GroundEff" in o["state"]


def child_effects(port, a, fx_entry, state, tt, p, T, k=1.0):
    """BBEE effects for an effect's BBTAG children, at BBTAG's x and tick. Ground contacts and recoil dust go ON the
    floor: BBTAG stores them at the parent's height (rrb404Eff's rrbGroundEff at y 1.15) and drops them at run time,
    which 0.3.0 did not (Test 6: "the yellow ground sparks float 70-240 px above the floor")."""
    n = 0
    for o in children(state):
        t = tt + o["t0"] / 60.0 * k
        if t > T: continue
        x = p[0] + o["x"]
        if is_ground(o):
            a.setdefault("AddEffects", []).append(entry(port, fx_entry, GROUND_HIT, t, x, 0.0)); n += 1
        elif o["state"] == "rrb404Smoke":          # recoil dust under the gun (0.3.0: a cropped sprite sheet)
            # (the effects pass, 2026-09-30: the skid dust drew a pale grey wedge at her feet on every shot; neither RWBY
            #  game kicks up dust on a shot. Landings and stops keep theirs: build_ruby.GROUND)
            continue
        elif "PetalEff" in o["state"]:
            a.setdefault("AddEffects", []).append(entry(port, fx_entry, PETALS, t, x, p[1] + o["y"])); n += 1
    return n


def place_rounds(port, by, guns, shooters):
    """Her rounds spawn at the muzzle point of their firing frame, in the shot's direction. shooters: {action: [round
    actions in firing order]}."""
    for name, rounds in shooters.items():
        a = by.get(name)
        if not a: continue
        events = sorted(guns.get(name, []))
        roles = [r for r in a.get("AddRoles") or [] if (r.get("StartActionEx") or [{}])[0].get("ConstValue") in rounds]
        roles.sort(key=lambda r: port.fv(r["TimeConfig"]["Start"]))
        for r in roles:
            t = port.fv(r["TimeConfig"]["Start"])
            ev = min(events, key=lambda e: abs(e[0] - t)) if events else None
            if ev is None: continue
            _, x, y, ang = ev
            # the offsets are expression fields ({UseExpression, ConstValue, Expression}): write the constant inside
            r["Position"]["OffsetX"]["ConstValue"] = port.fp(x); r["Position"]["OffsetY"]["ConstValue"] = port.fp(y)
            r["Position"]["OffsetX"]["UseExpression"] = 0; r["Position"]["OffsetY"]["UseExpression"] = 0
            if "DirAngleV" in r:
                # (Sy-Pod's first role came from Noel's gatling with RandomCenter2(0.5,2.5): a random tilt; her rounds fly
                #  along the muzzle, as Noel's single shot attack7 does: the rounds analysis, 2026-10-02)
                r["DirAngleV"]["ConstValue"] = port.fp(ang); r["DirAngleV"]["UseExpression"] = 0


def dust_variants(port, acts, root_caster=False, log=print):
    """Every gun effect entry becomes five: her rose (no Dust loaded: none of rrb_dust1-4) and one per Dust element
    (its buff held), each an entry of the effect's palette version. Her rounds check HER buffs (IncludeRootCaster)."""
    def cond(bid, invert=0):
        r = port.refs.buff(bid, invert=invert)
        if root_caster: port.refs.items[-1]["data"]["IncludeRootCaster"] = 1
        return r
    if not root_caster and _FX_ENTRY[0]:
        # (her actions, after build_ruby.weight_pass has set each move's hit effects by class) Red Reaper's cuts
        for a in acts:
            if a["Name"].startswith("rrb_redreaper") and not any(e["NameEx"]["ConstValue"] == RR_CUT for e in a.get("HitEffects") or []):
                a.setdefault("HitEffects", []).append(_FX_ENTRY[0](port, RR_CUT, 0.0, hit=True))
    n = 0
    for a in acts:
        out = []
        for e in a.get("AddEffects") or []:
            nm = e["NameEx"]["ConstValue"]
            if nm.split("/")[-1] not in DUSTED: out.append(e); continue
            base = list((e.get("ConditionGroup") or {}).get("Conditions") or [])
            e0 = copy.deepcopy(e); e0["ConditionGroup"] = {"Combine": 0, "Conditions": base + [cond(bid, 1) for _, bid in DUST[1:]]}
            out.append(e0)
            for sfx, bid in DUST[1:]:
                ek = copy.deepcopy(e); ek["NameEx"]["ConstValue"] = nm + sfx
                ek["ConditionGroup"] = {"Combine": 0, "Conditions": base + [cond(bid)]}
                out.append(ek)
            n += 1
        if a.get("AddEffects"): a["AddEffects"] = out
    log("rrb_fx: %d gun effect spawns take her Dust colour" % n)
    return n


def finish_refs(port, T):
    """a tree edited after its references were chosen (her bullet tree): keep the ones its actions use, add ours"""
    import json as _j, re as _r
    used = set(int(x) for x in _r.findall(r'\{"rid": (-?\d+)\}', _j.dumps(T["_actions"])))
    have = {r["rid"] for r in T["references"]["RefIds"]}
    T["references"]["RefIds"] = [r for r in T["references"]["RefIds"] if r["rid"] in used] + \
                                [r for r in port.refs.items if r["rid"] in used and r["rid"] not in have]
    missing = used - {r["rid"] for r in T["references"]["RefIds"]} - {-2}
    if missing: raise SystemExit("unresolved reference ids in %s: %s" % (T.get("m_Name"), sorted(missing)[:5]))


def round_effects(port, btree, fx_entry, rounds=("b7", "s4", "TS_round1", "TS_round2")):
    """Each round carries rrb_round (bound, dies with the round); where it ends, the gun hit burst."""
    for a in btree["_actions"]:
        n = a["Name"]
        if n in rounds or n.startswith("TS_round"):
            e = fx_entry(port, ROUND, 0.0, attached=True); e["KillMode"] = 0
            a["AddEffects"] = [e]          # only hers: the donor rounds' Noel / Kokonoe effects go (Test 4, audit)
        elif n.endswith("end") and (n[:-3] in rounds):
            e = fx_entry(port, HIT_GUN, 0.0, attached=True); e["KillMode"] = 1
            a["AddEffects"] = [e]


# the kind of each scythe move's crescent (VFX_RECIPE 2.5; the lead's brief: "distinguish quick cuts, broad sweeps, spins
# and heavy finishers"). Prefix match, longest first; sweep otherwise
SLASH_KINDS = {"rrb_a2": "quick", "rrb_2a": "quick", "rrb_ja": "quick", "rrb_j2a": "quick", "rrb_sypod": "quick", "rrb_hook": "quick",
               "rrb_jb": "air", "rrb_5bb": "spin", "rrb_corkscrew": "spin", "rrb_launcher_air": "spin", "rrb_guil_loop": "spin",
               "rrb_a4": "heavy", "rrb_jc": "heavy", "rrb_launcher": "heavy", "rrb_buzzsaw_land": "heavy", "rrb_clash_finish": "heavy",
               "rrb_guillotine": "heavy", "rrb_redreaper": "heavy", "rrb_hook_exe": "heavy", "rrb_hook_back": "heavy"}


def slash_kind(name):
    best = max((k for k in SLASH_KINDS if name == k or name.startswith(k)), key=len, default=None)
    return SLASH_KINDS[best] if best else "sweep"


HEAVY_ROUNDS = ("b7_hc", "b7_hcp", "b7_max", "s4_hc", "s4_max", "rrb_dustround_hc", "s4_jc", "s4_jc3")
ROUND_DELAY = 0.02        # s: the round shows a tick after it leaves (the muzzle covers its first stretch; Noel 0-0.1 s)


def _has_fx(leaf):
    p = os.path.join(HERE, "fx", "fxmap.json")
    return os.path.exists(p) and ("/" + leaf + '"') in open(p, encoding="utf-8").read()


def gun_v2(port, btree, fx_entry, log=print):
    """The rebuilt gun effects (fxkit_cross, 2026-10-02: the lead, "her bullets still look extremely bad and weird ...
    rebuilt around the vfx of the game"; Noel's structure: a streak head and glow with a short trail on the round,
    vanishing the frame it breaks, the impact spawned there). Before dust_variants. Only when the pack has them."""
    if not _has_fx("rrb_round_heavy"): return 0
    n = 0
    for a in btree["_actions"]:
        nm_ = a["Name"]
        passing = nm_.endswith("_p")                       # a piercing round flying on (rrb_power.sypod_pierce): lit
        if passing: nm_ = nm_[:-2]
        for e in a.get("AddEffects") or []:
            leaf = e["NameEx"]["ConstValue"].split("/")[-1]
            if leaf == "rrb_round":
                e["Start"] = port.fp(0.0 if passing else ROUND_DELAY); e["KillMode"] = 2
                if nm_ in HEAVY_ROUNDS:
                    e["NameEx"]["ConstValue"] = "Role/Rrb/rrb_round_heavy"
                for ax in ("x", "y"):            # (the heavy round is authored at its size: no x1.75 on top)
                    e["Scale"][ax] = port.fp(min(port.fv(e["Scale"][ax]), 1.2))
                n += 1
    # a round that reaches its range fizzles where it is (it used to vanish at full brightness)
    out = next((a for a in btree["_actions"] if a["Name"] == "rrb_roundout"), None)
    if out is not None and _has_fx("rrb_round_end"):
        e = fx_entry(port, "Role/Rrb/rrb_round_end", 0.0, attached=True); e["KillMode"] = 1
        out["AddEffects"] = [e]
    log("rrb_fx: rebuilt gun effects on %d round spawns (heavy rounds: %s)" % (n, ", ".join(HEAVY_ROUNDS)))
    return n


def ground_hits(port, by, fx_entry, spec):
    """spec: {action: [(t, x, kind)]}: where the blade or a slam meets the floor (kind "hit" rubble, "skid" dust)."""
    for name, evs in spec.items():
        a = by.get(name)
        if not a: continue
        for t, x, kind in evs:
            a.setdefault("AddEffects", []).append(entry(port, fx_entry, GROUND_HIT if kind == "hit" else SKID, t, x, 0.0))
