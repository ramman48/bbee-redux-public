"""rrb_pots.py -- Ruby Rose V2: the Potential kit (KIT_V2 §3 new moves, §9 38 Potentials + Unleashed, §10 hidden effects).

Called from build_ruby.py (B = that module, passed in: its helpers and tables):
  KIT_V2 / DMG_V2 / GROUP_V2 / AIR_V2 / TRAIL_V2   merged into build_ruby's tables at import (the new moves are built,
                                                    wired and voiced by the same pipeline as the base kit)
  moves_v2(B, port, by)       the new moves' own logic (after B.moves, before the effects are wired)
  potentials_v2(B, port, by)  every Potential and hidden effect in the action data (after the effects are wired, so the
                              variants carry the arcs, trails, sounds of the move they copy)
  bullets_v2(B, port, by, btree)  her new projectiles (petal zone, cartridge blast, Dust round) and the round variants
  rows_v2(B, port, by)        the input rows (replaces build_ruby's group 1 / 4 / 8 / 2 / 3 rows)
  content_v2(B)               BaseActorPotentialConf, triggers, the move list (ActorActionConf) with the texts of
                              rrb_text.py in 10 languages, PotentialComboConf, the buffs

How each Potential works in the engine is written next to it. **Every number here is a proposal** (KIT_V2 approved the
kit's design, not its balance). Engine mechanisms used are the stock ones (evidence in NOTES / research/kb):
  variants        a move switches at its start (0-0.05 s) to a copy while the Potentials are held (ActionSwitch +
                  ActionLogicCondition_Trigger); several Potentials on one move: one copy per combination, the most
                  specific first (variant_matrix)
  conditional     Invincibility, AddBuff, AddEffects, ScriptCalls, AddRoles and AttackerCalls carry a ConditionGroup
  input holds     ActionLogicCondition_Input (InputCmd 1 Attack, 3 Skill; mode 2 Pressing, 3 NotPressing)
  on hit          ActionLogicCondition_Hit (the actor hit something within x s); hit AttackerCalls AddBuff / AddSPBall
  row checks      ReqTriggerId (all listed Potentials), PreScriptCall CheckBuffStack (Naoto's pattern: a checked row
                  first, the plain row after it)
"""
import copy, itertools, json, re

# ---------------------------------------------------------------- the new moves (KIT_V2 §3; built by build_ruby.moves)
# name -> (clip, template (logic, action), BBTAG states for the hits, feel, floor, armor)
KIT_V2 = {
    "rrb_5b":          ("atk5b", ("icey", "attack2"), ["NmlAtk5B"], "light", "normal", 1),               # Scythe Chain 1
    "rrb_5bb":         ("atk5bb", ("icey", "attack3"), ["AN_NmlAtk5B_2nd"], "knock", "heavy", 1),        # Scythe Chain 2
    "rrb_2a":          ("atk2a", ("icey", "attack1"), ["NmlAtk2A"], "light", "normal", 1),               # Low Sweep opener
    "rrb_2b":          ("atk2b", ("icey", "attack1"), ["NmlAtk2B"], "launch", "normal", 1),              # Rising Crescent
    "rrb_launcher_air": ("atk5bbb_air", ("icey", "attackAir1"), ["AN_NmlAtk5B_3rd"], "launch", "air", 1),    # air Rising Reap
    "rrb_clash_chase1": ("clash_chase1_go", ("icey", "attack2"), ["CmnActCrushAttackChase1st"], "light", "heavy", 5),
    "rrb_clash_chase2": ("clash_chase2", ("icey", "attack3"), ["CmnActCrushAttackChase2nd"], "light", "heavy", 5),
    "rrb_clash_finish": ("clash_finish", ("icey", "attack4"), ["CmnActCrushAttackFinish"], "knock", "heavy", 5),
    "rrb_hook":        ("hook", ("icey", "attack1"), ["NmlAtkThrow"], "light", "skill", 5),              # Reaper's Hook
    "rrb_hook_exe":    ("throw_exe", ("icey", "attack4"), ["ThrowExe"], "knock", "skill", 9),
    "rrb_hook_back":   ("throw_back_exe", ("icey", "attack4"), ["BackThrowExe"], "knock", "skill", 9),
    "rrb_buzzsaw_ex":  ("buzzsaw_spin", ("icey", "attackAir3"), ["AirRolling_Ex"], "air", "skill", 5),  # Buzzsaw EX dive
}
# damage budgets (ratio, hits); Ragna's attack1 = 1.0 (research/kb/COMBAT_ECONOMY.md): proposals
DMG_V2 = {"rrb_sypod": (0.6, 1), "rrb_5b": (1.3, 1), "rrb_5bb": (1.6, 1), "rrb_2a": (0.7, 1), "rrb_2b": (1.4, 1), "rrb_launcher_air": (1.4, 1),
          "rrb_clash_chase1": (0.9, 1), "rrb_clash_chase2": (0.9, 1), "rrb_clash_finish": (1.8, 1),
          "rrb_hook": (0.6, 1), "rrb_hook_exe": (3.2, 4), "rrb_hook_back": (3.2, 4), "rrb_buzzsaw_ex": (2.4, 8),
          "rrb_buzzsaw_land_ex": (2.4, 3), "rrb_launcher_rise": (1.4, 1), "rrb_clash_go": (2.2, 1), "rrb_clash_full": (2.9, 1),
          "rrb_clash_exfinish": (3.0, 3), "rrb_guil_loop1": (1.2, 3), "rrb_guil_loop2": (1.2, 3), "rrb_guil_end": (0.9, 1),
          "rrb_petalzone": (0.25, 4), "rrb_petalzone2": (0.6, 6), "rrb_dustburst": (1.2, 1), "b7_hcp": (2.3, 1),
          "rrb_cartblast1": (1.0, 1), "rrb_cartblast2": (1.0, 1), "rrb_cartblast3": (1.0, 1), "rrb_cartblast4": (1.0, 1),
          "rrb_dustround": (1.5, 1), "rrb_dustround_hc": (1.9, 1), "b7_hc": (2.3, 1), "s4_hc": (1.9, 1), "s4end_x": (1.2, 1),
          "rrb_gwell": (0.8, 8), "rrb_gwell_end": (1.0, 1),      # 0.8.0: the well's ticks (0.2 over 6 until 0.7) and its collapse
          "jump_rj": (0.5, 1), "jump2_rj": (0.5, 1), "jump3_rj": (0.5, 1),   # 20741: the blast under a recoil jump (Gun Blast's budget)
          "rrb_spark": (0.5, 1), "rrb_icespike": (0.6, 1), "rrb_flame": (0.15, 5), "rrb_erupt": (1.6, 1),
          "rrb_spark_fire": (0.5, 1), "rrb_spark_ice": (0.5, 1), "rrb_spark_grav": (0.5, 1), "b7_fire": (2.2, 1), "b7_fireend": (0.4, 1)}
# 0.9.0, the rifle's damage (the lead to the testers, 2026-10-04: "i will also reduce the damage and add a stagger
# cooldown to her rifle shots"). Per tap of Rifle Shot, in units of a first attack: 3.0 -> 2.2 (the round and its
# break); High Caliber's and the Fire round 3.0 -> 2.3 / 2.2; the stage 3 burst 3 x 3.2 -> 3 x 1.5 (rrb_power.MAX_ROUNDS).
# RIFLE_STAGGER: a rifle round (and its break) makes a given enemy flinch at most once in this many seconds; the
# damage always lands (rrb_power.stagger_rule)
RIFLE_STAGGER = 1.5
GROUP_V2 = {"rrb_5b": 1, "rrb_5bb": 1, "rrb_2a": 1, "rrb_2b": 1, "rrb_launcher_air": 4, "rrb_launcher_rise": 4,
            "rrb_clash_chase1": 1, "rrb_clash_chase2": 1, "rrb_clash_finish": 1, "rrb_clash_exfinish": 1, "rrb_clash_go": 1,
            "rrb_clash_full": 1, "rrb_hook": 2, "rrb_hook_exe": 2, "rrb_hook_back": 2, "rrb_buzzsaw_ex": 2,
            "rrb_buzzsaw_land_ex": 2, "rrb_guil_loop1": 2, "rrb_guil_loop2": 2, "rrb_guil_end": 2,
            "jump_rj": 5, "jump2_rj": 5, "jump3_rj": 5}     # 20741: the recoil jumps' blast counts as Gun Blast damage
AIR_V2 = {"rrb_launcher_air", "rrb_launcher_rise", "rrb_buzzsaw_ex"}
TRAIL_V2 = ("rrb_5b", "rrb_5bb", "rrb_2a", "rrb_2b", "rrb_launcher_air", "rrb_clash_chase1", "rrb_clash_chase2",
            "rrb_clash_finish", "rrb_hook", "rrb_hook_exe", "rrb_hook_back", "rrb_redreaper")
BLUNT_V2 = ()          # BBTAG draws these with slash smears (dageki only on 5AAA / Clash / j.C / Guillotine)

# ---------------------------------------------------------------- the 38 cards (KIT_V2 §9)
# (id, key, group (OrderId), move-list root (rrb_text.MOVE_TEXT key), prerequisite keys)
DUST_CORE = ("dust_long", "dust_strong", "dust_round", "cart_blast", "dust_combine")
CARDS = [
    (20701, "a3_drag", 1, "rrb_a1", ()),
    (20702, "scythe_chain", 1, "rrb_5b", ()),
    (20703, "a4_pass", 1, "rrb_a1", ()),
    # 0.9.0 (a tester, 2026-10-07: the upward attack "shouldn't be available from the start"; the lead: "for C we can do
    # the kit changes"): Rising Reap comes from a card, and its three cards are offered after it (the stock shape:
    # Ragna's Inferno Divider 5303, then 5304 / 5305 / 5334)
    (20742, "reap", 2, "rrb_launcher", ()),
    (20704, "reap_more", 2, "rrb_launcher", ("reap",)),
    (20705, "reap_air", 2, "rrb_launcher", ("reap",)),
    (20706, "reap_inv", 2, "rrb_launcher", ("reap",)),
    (20707, "sweep_open", 4, "rrb_sweep", ()),
    (20708, "rising_crescent", 4, "rrb_2b", ("sweep_open",)),        # KIT §9: needs Low Sweep's card
    (20709, "clash_ex", 4, "rrb_clash", ()),
    (20710, "rifle_two", 7, "rrb_rifleshot", ()),
    (20711, "sypod_three", 7, "rrb_sypod", ()),
    (20712, "hook", 7, "rrb_throw", ()),
    (20713, "guil_armor", 8, "rrb_guillotine", ()),
    (20714, "guil_hold", 8, "rrb_guillotine", ()),
    (20715, "petal_burst", 9, "rrb_petalburst", ()),
    (20716, "petal_dance", 9, "rrb_petaldance", ()),
    (20717, "red_reaper", 9, "rrb_redreaper", ("petal_burst",)),      # KIT §9: needs Petal Burst
    (20718, "triple_jump", 13, "rrb_jump", ()),
    (20719, "jump_reset", 13, "rrb_jump", ()),
    # 0.9.0 (the same tester: the air spin "should be treated as a Potential"): Buzzsaw Blast comes from a card, on
    # air Down + Skill; the air Skill itself is the Recoil Shot
    (20743, "buzzsaw", 13, "rrb_buzzsaw", ()),
    (20720, "buzzsaw_ex", 13, "rrb_buzzsaw_ex", ("buzzsaw",)),
    (20721, "blast_inv", 19, "rrb_blast", ()),
    (20722, "blast_chain", 19, "rrb_blast", ()),                      # 0.9.0: the chain card (it was "a fourth time")
    (20723, "enhancer", 19, "rrb_blast", ()),
    (20724, "cork_twice", 20, "rrb_corkscrew", ()),
    (20725, "cork_blast", 20, "rrb_corkscrew", ()),
    (20726, "crescent_mastery", 23, "rrb_universal", ()),
    (20727, "high_caliber", 23, "rrb_universal", ()),
    (20728, "semblance", 23, "rrb_universal", ()),
    (20729, "silver_eyes", 23, "rrb_universal", ()),
    (20730, "dust_long", 31, "rrb_dust", ()),
    (20731, "dust_strong", 31, "rrb_dust", ()),
    (20732, "dust_round", 31, "rrb_dustround", ()),
    (20733, "cart_blast", 31, "rrb_dust", ()),
    (20734, "dust_combine", 31, "rrb_dust", ()),
    (20735, "fire_dust", 32, "rrb_dust_fire", DUST_CORE),             # KIT §9: an element card needs one Dust core card
    (20736, "ice_dust", 32, "rrb_dust_ice", DUST_CORE),
    (20737, "bolt_dust", 32, "rrb_dust_lightning", DUST_CORE),
    (20738, "grav_dust", 32, "rrb_dust_gravity", DUST_CORE),
    (20739, "blast_far", 19, "rrb_blast", ()),                        # 2026-10-03: Gun Blast travels farther
    (20740, "blast_shot", 19, "rrb_blast", ()),                       # 2026-10-03: each blast fires a Sy-Pod round
    (20741, "jump_shot", 13, "rrb_jump", ()),                         # 2026-10-03 (0.8.0): every jump fires a round straight down
    # 0.9.0, build 11 (a tester's idea, 2026-10-07; the lead, 2026-10-09: "the Gunswing card ... can we please build
    # all this"): Skill during a scythe attack fires a round and the string goes on (gunswing())
    (20744, "gunswing", 1, "rrb_a1", ()),
]
POT = {k: i for i, k, _, _, _ in CARDS}
# cards that show another card's icon (the stock convention: the cards of one move share its icon, e.g. Ragna's 5321 /
# 5322 / 5324 all show 5321's). The rest have their own Krita icon (art/icons/icons.json)
# (2026-10-03: 20739 and 20740 shared 20722's and 20723's for one build; the lead: "i want their own drawn")
# (0.9.0's first builds: 20742 and 20743, the two cards that add a move, showed 20704's and 20720's. The lead,
#  2026-10-09: "own icons for the two new cards". None is shared now)
ICON_OF = {}
ICON_CARDS = [i for i, *_ in CARDS if i not in ICON_OF]
BLAST_FAR = 1.35                 # 20739: every Gun Blast's travel, x this (2.8 u -> 3.8 u), in the same time (0.9.0: was 1.5 of 2.1 u)
BLAST_SHOT = "s4"                # 20740: the round each blast fires (the stage buffs swap it for s4_hc / s4_max)
# 20741 Recoil Jump: where the shot is (u from her root), the flash's scale, the blast's box under her, the jump's speed
JUMP_SHOT = dict(at=(0.0, 0.2), fx=0.8, box=(-0.9, -0.9, 0.9, 0.7), k=1.15)
DUST_LABEL = 207300      # the Dust core cards' shared extra label: an element card's PreLabels (met by any one of them;
                         # the stock idiom: Hazama 6604 / 6605 share 66045, Mai 6104 / 6105 share 61045)
STOCK_TRIG = {"triple_jump": ("StartStage", "AddTrigger", "Id:11741,RefreshSkill:1")}   # the stock triple-jump trigger
ULTRA = "petal_burst"
# (the lead, 2026-10-02: "gameplay wise ruby feels good except petal dance and petal burst and red reaper ... take them out
#  for now"; then "dont remove them just remove the inputs for them so they cant be used".) False: no input starts Petal
#  Burst or Petal Dance (and so Red Reaper, which Petal Burst becomes): the chords' switches, their SP rows, Buzzsaw EX's
#  chord (hidden 23) and the Ultra slot row are left out. The moves, cards and text stay built. True puts them back.
SP_INPUTS = False
# while they are off, their cards are not offered in a run (2026-10-03: they were, and did nothing): a prerequisite label
# no card carries (PreLabels: every listed label must be owned)
SP_CARDS, SP_LOCK = ("petal_burst", "petal_dance", "red_reaper"), 207990
HOOK_BACK_STEP, HOOK_BACK_T = 3.4, 0.08   # Reaper's Hook's back throw: she passes the hooked enemy by this much (u), in this time (s)
HOOK_BACK_T0 = 0.034                      # the step starts 2 ticks in: she turns on the action's first tick, and a step from
                                          # tick 0 went the old way for that tick (in game: 0.75 u net of 3.4)
UNLEASHED, UNLEASHED_ACTION = 20799, 191

# buffs this kit adds (cloned at build time from stock markers; B.potential_content appends them)
# (0.6.12, audit D2: rrb_pause, rrb_sweep_pd, rrb_x_sweep and rrb_x_enh were set and read by nothing since the gated rows
#  they served became moves of their own; they are gone)
SWEEP_G, ENH, ENH4, ENH_DMG, AFTER_PB, FULL = ("rrb_sweep_g", "rrb_enh", "rrb_enh4", "rrb_enh_dmg", "rrb_after_pb", "rrb_full")
# Row gates. Stock CheckBuffStack passes while the buff's stack is BELOW buff_stack (Naoto's use limit; game trace
# 2026-09-29: 5B came out 0.36 s into 5AA, before rrb_pause existed). So a gated row checks a BLOCKER: present by
# default (her stand and run add it), removed by the move that opens the route, back when she returns to stand.
X_GRAV = "rrb_x_grav"
BLASTING = "rrb_blasting"     # on her while a Gun Blast plays: a new chain can't start until it ends (0.5.0 trace)
X_CHORD_R, X_CHORD_D, X_CHORD_A = "rrb_x_chord_r", "rrb_x_chord_d", "rrb_x_chord_a"   # the chords' windows: from Rifle
                              # Shot (Skill first), a Dust reload (Summon first), an Attack move (Attack first)
ATTACK_MOVES = ("rrb_a1", "rrb_a2", "rrb_a3", "rrb_a4", "rrb_5b", "rrb_5bb", "rrb_2a", "rrb_sweep", "rrb_2b", "rrb_launcher",
                "rrb_ja", "rrb_jb", "rrb_jc", "rrb_j2a", "rrb_clash")   # (prefixes: their variants too)
CARD_UNLOCK_ROWS = True       # cards that unlock a move point at the move's own move-list row (content_v2)
UNLOCKS = ("scythe_chain", "rising_crescent", "hook", "petal_burst", "petal_dance", "red_reaper", "buzzsaw_ex", "dust_round",
           "reap", "buzzsaw")
NEW_MOVE_CARDS = ("reap", "buzzsaw", "gunswing")     # flagged New on the card, as the stock cards that add a move are
REAP_AGAIN = 1.2                  # s: Rising Reap cannot start again this soon after it started ("it shouldn't be spammable")
CHORD = 0.14                  # the chord window (s): the second button within this of the first
PAUSE_T0, PAUSE_END = 0.5, 0.8   # s: Scythe Chain's pause window (5AA -> 5B)
PAUSE_CUE = "Role/Rrb/rrb_ready"  # the glint that marks the window's opening (0.8.0)
PAUSE_CUE_AT = (-0.62, 0.32)      # u from her root, facing right: the middle of her blade on 5AA's held last frame
                                  # (rrb270_09: heel (-0.73, 0.40), tip (-0.48, 0.26); tools/bbtag/ruby_blade.blade)
A4_RECOVER = 0.75             # s: after 5AAAA starts, the Attack groups stay shut this long (its recovery; 0.8.0)
GUIL_FIN = (0.05, 0.10, 0.133)  # s: Guillotine's finish after held spins: its launching cut's window, and its turn's length
HOOK_SWITCH = (0.3, 0.45)       # s into the hook: on a hit it hands over to the flurry (or the back throw) in this window
# Reaper's Hook: her slide in (u; 0.9.0: none, it was 0.5), the hook's window (s: the reach frame and the first pull
# frame of ruby_clips "hook"), where the hooked enemy is set (u from her), the hook's box (the blade at full reach)
HOOK_DASH, HOOK_HIT, HOOK_AT = 0.0, (0.117, 0.25), 1.0
HOOK_BOX = [0.0, 0.0, 2.8, 2.4]
NONBLAST = ["1", "2", "3", "4", "6", "7", "8", "11"]   # every input group but Gun Blast (5): what a committed move mutes
LAND_LOCK = 0.7               # s: Buzzsaw's landing takes no input row until its blast is out (last hit 0.27-0.35 s) and
                              # its hop back is down (5.6 u/s up at 0.267 s, gravity -27: airborne to ~0.68 s). At 0.4
                              # (0.6.9 game test) presses in the hop started the air string off the landing
BLOCKERS = (X_GRAV, BLASTING, X_CHORD_R, X_CHORD_D, X_CHORD_A)
# Clash Assault's chase (the lead, 2026-10-02: "a way faster sequence and reach full screen")
CHASE1_FROM = 0.5             # s: Chase1st's slash (rrb202_00) in BBTAG's state; 0-0.5 s replays the clash's reload pose
CHASE_SPEED = {"rrb_clash_chase1": 1.25, "rrb_clash_chase2": 1.3}   # x faster (the finish keeps 1.0: arc_rrb320eff is Corkscrew's too)
CHASE_TAIL = 0.04             # s: a chase step hands over this long after its hit (its recovery frames are skipped)
# (2026-10-02 game tests: a knock-away at 12 u/s outran the glide; at (8, 3) it knocked the enemy down a short way and
#  she glided past it.) The chase strikes are a hit-stun slide along the floor (the light reaction: no lift), the enemy
#  stays standing in front of her, and each step's glide follows it
CHASE_KNOCK = (8.0, 0.0)      # u/s: each chase strike drives the enemy along the floor; the next step dashes after it
# u, s: each chase step's glide after the enemy (the clash plan's fallback). (2026-10-02 game test: a 2.2 u glide on the
# first step carried her past the enemy, 1.2 u ahead after the bound: it only steps in; the later steps follow the
# enemy the previous strike drove on)
CHASE_GLIDE = {"rrb_clash_chase1": (0.5, 0.08), "rrb_clash_chase2": (2.0, 0.12), "rrb_clash_finish": (2.0, 0.12)}
CHASE_DASH = dict(speed=55.0, dur=0.2, stop=1.3)   # the dash at her target: u/s, s (8 u at most), stops this far short
# (the lead, 2026-10-02 late: "the final big slash from buzzsaw on the ground" is too big) the landing's arcs, bursts and
# the saw's break-up grow only a little by stage; the saw itself keeps its stage size (BUZZ)
LAND_K = {2: 1.1, 3: 1.2}
SAW_SCALE = 1.75              # rrb_saw at stage 1: its rim meets the scythe's reach (the kit's note, 2026-10-02; was 1.4)
GATE_STACK = 2                # blockers go on with 2 stacks: a row checking buff_stack 1 is then blocked whether the
                              # engine's test is stack < n or stack <= n (only the < reading is backed by the game)


def gate(e):
    """a blocker AddBuff entry, with GATE_STACK stacks"""
    e["Buff"]["Stack"] = GATE_STACK
    return e
# j.2A once per airtime unless it hits (the lead, 2026-10-02: "you can chain them infinitely ... make it you can only do it
# once in the air but if you hit an enemy you can do it as many times as long as it hits"): a j.2A that hits nothing
# leaves this flag until she lands; the j.2A row is shut while it is on
J2A_SPENT = "rrb_x_j2a"
HOOK_MP = 40      # Reaper's Hook (it was priced as Rifle Shot; the Rifle went to 30 on 2026-10-03, the Hook keeps its 40)
# 0.9.0 Recoil Shot, the air Skill (a tester, 2026-10-07: the air Skill "should be rather related to shooting bullets,
# same as ground version"; "the backward momentum would allow for hovering in mid-air while dealing damage"). BBTAG's
# j.214A, the air backward gun-dash, with a real rifle round: the shot at `shot` s, the recoil carries her `back` u
# and `up` u in `fly` s, she hangs until `hang` s, then falls. Other moves from `free` s, the next shot from `again` s
RECOIL_SHOT = dict(shot=0.1, back=1.5, up=0.35, fly=0.14, hang=0.42, free=0.3, again=0.36, muzzle=(1.25, 1.05))
# 0.9.0 Gunswing (card 20744): Skill after a scythe step's strike fires one light round (rrb_power.GSW_RND) and the
# string goes on. mp a shot; the round leaves `shot` s into the shot; the window stays open `win` s after the strike;
# the string's next press from `free` s, Skill again from `again` s, the string kept until `keep` s
GSW = dict(mp=8, shot=2 / 60.0, win=0.25, free=0.12, again=0.34, keep=0.55)
GSW_ON = "rrb_x_gsw"       # on her from a step's start to its window's end: the neutral Skill rows are shut by it
GSW_STEPS = {"rrb_a1": 1, "rrb_a2": 1, "rrb_a3": 1, "rrb_5b": 1, "rrb_5bb": 1, "rrb_2a": 1, "rrb_sweep": 1, "rrb_ja": 4, "rrb_jb": 4}   # step -> input group
GSW_T0 = {}                # step -> s into it its window opens (gunswing() fills it for rows_v2)
GSW_SHOT = "rrb_gsw_"      # a step's shot action: this + the step's name without "rrb_"
ENH_FX = ("Role/Rrb/rrb_muzzle_heavy", "Role/Rrb/rrb_blast_ring")   # 20723: what an enhanced strike fires at its first hit
BUZZ_RISE = "rrb_x_bzup"   # Buzzsaw with Up held: on through the short rise, so the dive follows it even if Up is let go
# the gravity well (0.8.0): seconds, hit box (u about its centre), tick, pull (u/s toward the centre), effect scale; the
# collapse's box and effect scale. Numbers: proposals
GWELL = dict(dur=2.0, box=(-2.4, -0.5, 2.4, 2.4), tick=0.25, pull=5.0, fx=1.33, end_box=(-2.6, -0.6, 2.6, 2.8), end_fx=1.5, again=2.3)
GW_MARK = "rrb_x_gwm"      # on an enemy a round opened a well on: no new well from it for GWELL["again"] s
MARKERS = (SWEEP_G, ENH, ENH4, AFTER_PB, FULL, J2A_SPENT, BUZZ_RISE, GW_MARK, GSW_ON) + BLOCKERS + tuple("rrb_prev%d" % k for k in range(1, 5))
# her scythe moves: the power stages throw a crescent off each (rrb_power.moves). (2026-10-02, the lead: "her air attacks
# dont have level 3 versions": the air swings j.A / j.B / j.2A have them now; Clash Assault is a gun strike, its levels are
# rrb_power.gun_levels with j.C's)
SCYTHE = ("rrb_a1", "rrb_a2", "rrb_a3", "rrb_a4", "rrb_5b", "rrb_5bb", "rrb_2a", "rrb_sweep", "rrb_2b", "rrb_launcher",
          "rrb_launcher_air", "rrb_corkscrew", "rrb_guillotine", "rrb_ja", "rrb_jb", "rrb_j2a",
          "rrb_clash_chase1", "rrb_clash_chase2", "rrb_clash_finish", "rrb_clash")   # (the chase's own swings; the bound: a made stroke)
ENHANCED = SCYTHE + ("rrb_clash", "rrb_jc", "rrb_rifleshot", "rrb_sypod", "rrb_buzzsaw")


def T(B, port, key):
    """the condition 'she holds Potential `key`' (its trigger, pid*10+1; IncludeRootCaster so her rounds can ask too)"""
    return port.refs.trigger(POT[key] * 10 + 1)


def cg(conds):
    return {"Combine": 0, "Conditions": list(conds)}


def mute_window(B, groups, t0, t1, step=0.1, conds=()):
    """the input rows of `groups` ("all", "5" Gun Blast, ...) muted from t0 to t1 of the action, ending with it if it ends
    early: a chain of one-shot MuteSkills entries every `step`, each muting until the next (the last until t1).

    Engine (GameAssembly, read 2026-09-30): ActionLogicRunner.doSkillMute fires an entry when
    ActionTimedTriggerer.CheckActionTimeTriggerer(timeStart, timeEnd) is true, i.e. once, when its Time falls in the frame;
    TimeConfig's End and Interval are not read for mutes. Each firing sets every listed group's PlayerSkillChain.MuteRemain
    (overwritten, not added); a group can't start a row while MuteRemain > 0. So a TimeConfig window (0.6.7 / 0.6.8) muted
    only 0.1-0.25 s, at the start; entries that are not reached (the action ended) never fire"""
    out, t = [], t0
    while t < t1 - 1e-6:
        hold = min(0.25, t1 - t)       # (0.6.12: steps of 0.1 s; hit-stop stretches the action's time between entries)
        out.append({"Time": B.fp(t), "TimeConfig": {"StartType": 1, "Start": B.fp(t), "End": B.fp(0), "Interval": B.fp(-1), "NonTimeType": 1},
                    "ConditionGroup": cg(list(conds)), "MuteList": ",".join('"%s":%.2f' % (g, hold) for g in groups)})
        t += step
    return out


def inv(B, t0, t1, conds=()):
    """an Invincibility window (stock record: Noel's skill1), with its condition"""
    return {"TimeRange": {"Start": B.fp(t0), "Finish": B.fp(t1)}, "ConditionGroup": cg(conds),
            "InvincipalLvlEx": {"UseExpression": 0, "ConstValue": 1, "Expression": {"Source": ""}}}


def attacker_call(B, fn, params, conds=(), stage=3):
    """an on-hit call (stock: CalcStage 2 before damage, 3 after; e.g. AddSPBall, AddBuff on the target, CreateBullet)"""
    return {"ConditionGroup": cg(conds), "CalcStage": stage, "FuncCall": {"Function": fn, "Params": params}}


def grow(B, v, k):
    """a bigger version of a move: every hit box scaled about her (height from the floor), its arcs and trails scaled too
    (their entries' Scale), so the range reads (E7: Potential-enhanced attacks look stronger)"""
    for h in v.get("HitDataList") or []:
        hb = h["HitBox"]
        for c in ("Min", "Max"):
            hb[c]["x"] = B.fp(B.fv(hb[c]["x"]) * k)
        hb["Max"]["y"] = B.fp(B.fv(hb["Max"]["y"]) * k)
    for e in v.get("AddEffects") or []:
        n = e["NameEx"]["ConstValue"]
        if "/arc_" in n or "/trail_" in n:
            for ax in ("x", "y"):
                e["Scale"][ax] = B.fp(B.fv(e["Scale"][ax]) * k)


def victim(B, port, h, feel):
    """replace a hit's victim reaction with a stock one (B.VICTIM feel), keeping its buffs"""
    lg, an, i = B.VICTIM[feel]
    keep = h["Victim"].get("BuffList") or []
    h["Victim"] = copy.deepcopy(B.tpl(port, lg, an)["HitDataList"][i]["Victim"]); h["Victim"]["BuffList"] = keep


def push(B, h, kx=None, ky=None, x=None, y=None):
    sp = h["Victim"].setdefault("Speed", {})
    if x is not None: sp["x"] = B.fp(x)
    elif kx is not None and isinstance(sp.get("x"), dict): sp["x"] = B.fp(B.fv(sp["x"]) * kx)
    if y is not None: sp["y"] = B.fp(y)
    elif ky is not None and isinstance(sp.get("y"), dict): sp["y"] = B.fp(B.fv(sp["y"]) * ky)


def chase_target(B):
    """SetTarget at 0: ActionSetTargetType 4 SetToHitted, her target = the enemy she hit last (stock: ptbullet sUpHit)"""
    z = lambda: {"x": B.fp(0.0), "y": B.fp(0.0)}
    return {"Time": B.fp(0.0), "TargetType": 4, "Box": {"Min": z(), "Max": z()}, "TargetKey": "", "Sort": 0,
            "CollisionCheck": 0, "InvincipalBreak": 999}


def chase_dash(B, port, t=0.0):
    """a dash along the floor at her target: AddMotionType 10 TrackTarget on MotionEnableAxis 1 (X), the stock homing record
    of iceybullet xuli (constant speed, TrackDur, EndMotionOnTrackArrived) on her; with no target: NoTargetDist ahead"""
    m = B.glide(port, t, 0.0, 0.0, CHASE_DASH["dur"]); M = m["Motion"]
    M["MotionType"] = 10; M["TrackAxis"] = 1; M["TrackTargetBindPos"] = 0; M["TargetKey"] = ""
    M["EndMotionOnTrackArrived"] = 1; M["NoTargetEndAction"] = 0; M["InheriteRemainingSpeedWhenMotionEnds"] = 0
    for k, v in (("TrackInitSpeedEx", CHASE_DASH["speed"]), ("MaxSpeedEx", CHASE_DASH["speed"]), ("TrackAccelerateEx", 0.0),
                 ("TrackDurEx", CHASE_DASH["dur"]), ("TrackArriveDistanceEx", CHASE_DASH["stop"]),
                 ("TrackTargetOffsetX", 0.0), ("TrackTargetOffsetY", 0.0), ("NoTargetDistEx", 1.2), ("NoTargetDistYEx", 0.0),
                 ("MinDistEx", 0.1), ("MaxDistEx", 999.0)):
        M[k]["ConstValue"] = B.fp(v)
    return m


def variant_matrix(B, port, by, base, mods, log):
    """mods: [(key, conds() -> [refs], edit(v))]. One copy of `base` per combination of mods (the most specific first:
    the engine takes the first switch whose conditions hold), named base_key1_key2...; `base` switches to it at its
    start. Copies are made from a clean copy of `base`, so none of them switches again. Returns the variant names."""
    src = copy.deepcopy(by[base]); made, sw = [], []
    for r in range(len(mods), 0, -1):
        for combo in itertools.combinations(mods, r):
            v = copy.deepcopy(src); v["Name"] = base + "_" + "_".join(k for k, _, _ in combo)
            if base in DMG_MUL: DMG_MUL[v["Name"]] = DMG_MUL[base]     # (rrb_clash_full x1.3 was lost on its _cm / _se copies)
            for _, _, ed in combo: ed(v)
            by[v["Name"]] = v; made.append(v["Name"])
            sw.append(B.bp.switch(v["Name"], [c for _, cs, _ in combo for c in cs()], start_type=1, nt=1, t0=0.0, t1=0.05))
    by[base]["ActionSwitchs"] = sw + (by[base].get("ActionSwitchs") or [])
    log(base, "variants (%d): %s" % (len(made), ", ".join(made)))
    return made


# ---------------------------------------------------------------- the new moves' logic
def moves_v2(B, port, by):
    fp, fv, note = B.fp, B.fv, port.note
    # Scythe Chain 5B / 5BB: BBTAG's two long sweeps wrap over her head (KIT §3: "hitting in front and behind")
    for n in ("rrb_5b", "rrb_5bb"):
        for h in by[n]["HitDataList"]:
            h["HitBox"]["Min"]["x"] = fp(min(fv(h["HitBox"]["Min"]["x"]), -1.4))
        note(n, "V2 Scythe Chain: hit box also behind her (-1.4 u)")
    # Rising Crescent 2B: head invincibility while the scythe rises (KIT §3), the launch
    by["rrb_2b"]["Invincibility"] = [inv(B, 0.0, 0.25)]
    note("rrb_2b", "invincible 0-0.25 s (the rising scythe)")
    # air Rising Reap (20705): she hangs in the air for the swing (gravity 0 until 0.45 s), then falls as a jump
    la = by["rrb_launcher_air"]; B.no_motion(la)
    ph = copy.deepcopy(port.RA["jump"]["OverridePhysics"][0])
    ph["TimeRange"]["Start"] = fp(0.0); ph["TimeRange"]["Finish"] = fp(0.45); ph["OverrideGravityValue"] = fp(0.0)
    la["OverridePhysics"] = [ph]
    la["CDList"] = [{"Time": fp(0), "ID": "rrb_launcher_air", "Duration": fp(5.0)}]   # once per airtime (reset on landing)
    la["DropAction"] = "drop"; la["NextAction"] = "drop"
    # (0.6.8 game test, 2026-09-30: a Jump press in the air during it did nothing: air moves take the jump chain only when
    #  they end, and she lands before its 0.93 s end.) After the hang (0.45 s, the swing done) a Jump press in the air
    #  hands over to drop, where the jump chain (jump2, jump3 with 20718) takes the press at once: the launcher's jump
    #  cancel, as on the ground, and 20719's reset gets its use
    la["ActionSwitchs"] = [B.bp.switch("drop", [port.refs.input(800, 0, 0.12), port.refs.ground(1)], start_type=1, nt=1, t0=0.45,
                                       t1=fv(la["TotalDuration"]))] + (la.get("ActionSwitchs") or [])
    note("rrb_launcher_air", "air Rising Reap: gravity 0 to 0.45 s, once per airtime; Jump in the air from 0.45 s -> drop (the air jump)")
    # (0.6.7 game test, 2026-09-30: Up + Attack pressed in a jump's first 0.17 s, its input mute, came out as j.A with Up
    #  held throughout; later presses, and every buffered ground press, keep their direction.) j.A starting with Up held
    #  hands over to the air Rising Reap through its row (so the once-per-airtime check applies; on cooldown j.A goes on),
    #  before j.A's first hit at 0.133 s
    by["rrb_ja"]["ActionSwitchs"] = [B.bp.switch("rrb_launcher_air", [port.refs.inputdir(up=1), T(B, port, "reap_air")], start_type=1, nt=1,
                                                 t0=0.0, t1=0.05, mode=1)] + (by["rrb_ja"].get("ActionSwitchs") or [])
    # Clash Assault's chase (base, KIT §3 B9): on a grounded hit she chases: Chase1st, Chase2nd, Finish.
    # (the lead, 2026-10-02: "the clash attacks should be a way faster sequence and reach full screen") Each step opens
    # with a dash at the enemy she hit last (chase_target + chase_dash), strikes, and hands over CHASE_TAIL after its hit;
    # chase1 starts at its slash (clip clash_chase1_go: BBTAG's 0-0.5 s is the clash's reload pose again, already played
    # by rrb_clash_land); chase1 / chase2 play CHASE_SPEED faster; their strikes drive the enemy along the floor
    land = by["rrb_clash_land"]
    land["ActionSwitchs"] = [B.bp.switch("rrb_clash_chase1", [port.refs.hit(0.45)], start_type=1, nt=1, t0=0.0, t1=0.1)] + \
                            (land.get("ActionSwitchs") or [])
    c1, c2, fin = by["rrb_clash_chase1"], by["rrb_clash_chase2"], by["rrb_clash_finish"]
    assert abs(port.LEN["clash_chase1_go"] / 60.0 - (65 / 60.0 - CHASE1_FROM)) < 0.02, "clip clash_chase1_go: %s ticks" % port.LEN["clash_chase1_go"]
    B.with_hits(port, c1, ["CmnActCrushAttackChase1st"], "light", "heavy", offset=CHASE1_FROM)
    B.FX_ACTIONS["rrb_clash_chase1"] = (["CmnActCrushAttackChase1st"], CHASE1_FROM, None)   # its effect / sound cues from the slash on
    c1["NextAction"] = "rrb_clash_chase2"; c2["NextAction"] = "rrb_clash_finish"
    for n, a in (("rrb_clash_chase1", c1), ("rrb_clash_chase2", c2)):
        B.bp.retime(a, CHASE_SPEED[n]); B.RETIMED[n] = round(1.0 / CHASE_SPEED[n], 4)
        a["TotalDuration"] = fp(round(B.last_hit(a) + CHASE_TAIL, 3))
        for h in a["HitDataList"]:
            victim(B, port, h, "light"); push(B, h, x=CHASE_KNOCK[0], y=CHASE_KNOCK[1])
    # (2026-10-02 game test, clash_fast: TrackTarget does not move a player actor: she drifted 0.9 u back while each strike
    #  drove the enemy on.) Each step glides CHASE_GLIDE forward as it opens, after the enemy her last strike pushed
    for a in (c1, c2, fin):
        B.no_motion(a)
        a["SetTarget"] = []
        g = CHASE_GLIDE[a["Name"]]
        a["AddMotions"] = [B.glide(port, 0.0, g[0], 0.0, g[1])]
    for n in ("rrb_clash_chase1", "rrb_clash_chase2", "rrb_clash_finish"):
        B.MOTION_FX[n] = [("Role/Rrb/rrb_speedlines", 0.0)]
    # (0.6.12: entered by a switch and NextAction, the chase had no mutes: any press cut it.) The chase is committed to
    # its finishing blow; Gun Blast leaves it after each strike
    for n in ("rrb_clash_chase1", "rrb_clash_chase2", "rrb_clash_finish"):
        a = by[n]; lh = B.last_hit(a) or 0.3
        # (2026-10-02 game test, clash_mash: a press on chase1's last frame started 5A: the mute ended as it handed over)
        end_ = fv(a["TotalDuration"]) + 0.1 if n != "rrb_clash_finish" else round(lh + 0.05, 2)
        a.setdefault("MuteSkills", []).extend(mute_window(B, NONBLAST, 0.0, end_) + mute_window(B, ["5"], 0.0, round(lh + 0.03, 2)))
    note("rrb_clash_land", "on a hit within 0.45 s: the chase, chase1 %.2f s > chase2 %.2f s > finish; glides %s, strikes push (%.0f, %.0f)" % (
        fv(c1["TotalDuration"]), fv(c2["TotalDuration"]), [g[0] for g in CHASE_GLIDE.values()], CHASE_KNOCK[0], CHASE_KNOCK[1]))
    # Reaper's Hook (20712): the hook reaches 2.4 u and pulls the enemy in; on hit the flurry (ThrowExe), with Back
    # held the back throw (BackThrowExe). BBTAG's throw is a grab; BBEE's grab needs GrabStart data we have no stock
    # template for on this donor, so the hook is a pulling hit and the flurry a hit sequence (proposal, awaiting game)
    hk = by["rrb_hook"]; B.no_motion(hk)
    hk["TotalDuration"] = fp(0.58)
    # 0.8.0: a short slide in on her dash frames (HOOK_DASH u in 0.1 s), then the grab swing; the hook is out on the
    # swing's reach (ruby_clips "hook"). No walking during it: the slide is the approach
    # 0.9.0: no slide either (a tester, 2026-10-07: "an attack where the scythe extends; the hit detection should
    # trigger upon scythe contact, not during the forward dash"): she stays where she is, the blade reaches out
    # (HOOK_BOX, on the reach frame) and what it catches is pulled to her
    hk["AddMotions"] = [B.glide(port, 0.0, HOOK_DASH, 0.0, 0.1)] if HOOK_DASH else []; hk["FreeMoves"] = []
    hk["HitDataList"] = [B.hit(port, "light", HOOK_HIT[0], HOOK_HIT[1], list(HOOK_BOX), "skill")]
    # (0.8.0; a tester, 2026-10-03: "when using the grab Ruby gets a bit too far from the enemy sometimes".) The donor's
    # reaction set the hooked enemy at a RANDOM 1 to 2 u from her, 60 % of the way (the engine's distance adapt). The
    # hook and every strike of the flurry but the last now set it HOOK_AT u in front of her, all the way, from nearer
    # or from farther, over HOOK_EASE s; the last strike throws it.
    # (in game, rsuite fb_hook_*, first try: the pull was set only for a target nearer than HOOK_AT, and the flurry's
    #  first strike, 0.1 s after the hook, cleared the target's motion: the enemy stayed where it was hooked)
    # (second try: the hit's distance adapt at full ratio. It moved the Mecha Gunner about 30 % of the way: enemies carry
    #  a multiplier on it. The hold is the engine's relative lock now, put on by rrb_power.hold_moves: rrb_hook_hold)
    import rrb_power
    back = port.refs.new("ActionLogicCondition_InputDir", {"Invert": 0, "CheckLR": 0, "CheckDown": 0, "CheckFront": 0, "CheckBack": 1, "CheckUp": 0})
    hk["ActionSwitchs"] = [B.bp.switch("rrb_hook_back", [port.refs.hit(0.2), back], start_type=1, nt=1, t0=HOOK_SWITCH[0], t1=HOOK_SWITCH[1]),
                           B.bp.switch("rrb_hook_exe", [port.refs.hit(0.2)], start_type=1, nt=1, t0=HOOK_SWITCH[0], t1=HOOK_SWITCH[1])]
    for n in ("rrb_hook_exe", "rrb_hook_back"):
        B.no_motion(by[n])
    exh = sorted(by["rrb_hook_exe"].get("HitDataList") or [], key=lambda h: fv(h["TickRange"]["Start"]))
    for h in exh[:-1]: rrb_power._held_hit(B, h)
    by["rrb_hook_exe"]["FreeMoves"] = []
    # (2026-10-03, in game, rsuite proj_hookback.) With Back held she turned round and the throw struck the side she had
    # turned to, while the hooked enemy stood where it was: "throw the enemy behind her" threw nothing. The back throw is
    # a side switch now: she has turned her back to the hooked enemy, flashes back through it (HOOK_BACK_STEP u in
    # HOOK_BACK_T s, petals where she leaves and where she lands), and its strikes, from the far side, send the enemy the
    # way she first had her back to
    hb = by["rrb_hook_back"]
    hb["AddMotions"] = [B.glide(port, HOOK_BACK_T0, -HOOK_BACK_STEP, 0.0, HOOK_BACK_T)]
    # (in game, twice: she ended 0.77 u from where she started, not 3.4.) The donor action lets her walk during the move
    # (FreeMoves), and Back is held: she walked back out of her own step. No free movement in the back throw
    hb["FreeMoves"] = []
    t_hit = HOOK_BACK_T0 + HOOK_BACK_T + 0.017
    if hb.get("HitDataList"):
        h0 = min(hb["HitDataList"], key=lambda h: fv(h["TickRange"]["Start"]))
        if fv(h0["TickRange"]["Start"]) < t_hit:
            w_ = fv(h0["TickRange"]["End"]) - fv(h0["TickRange"]["Start"])
            h0["TickRange"]["Start"] = fp(t_hit); h0["TickRange"]["End"] = fp(t_hit + w_)
    hb["AddEffects"] = [dict(B.fx_entry(port, "Role/Rrb/rrb_petals", 0.0, dx=0.0, dy=1.0, attached=False), KillMode=1),
                        dict(B.fx_entry(port, "Role/Rrb/rrb_petals", HOOK_BACK_T0 + HOOK_BACK_T, dx=0.0, dy=1.0, attached=True), KillMode=1)] + (hb.get("AddEffects") or [])
    note("rrb_hook", "hook 0.2-0.3 s (2.4 u, pulls in); on hit -> rrb_hook_exe, or rrb_hook_back with Back held (she passes %.1f u through it first)" % HOOK_BACK_STEP)
    # Buzzsaw EX (20720): the dive from the spin (the hop is done when it switches), cuts every 0.07 s, lands into a
    # bigger shot
    ex = by["rrb_buzzsaw_ex"]
    spin = ex["HitDataList"][0] if ex["HitDataList"] else B.hit(port, "air", 0.0, 1.0, [-0.9, -0.6, 1.3, 1.4], "skill")
    spin["TickRange"]["Start"] = fp(0.0); spin["TickRange"]["End"] = fp(port.LEN["buzzsaw_spin"] / 60.0); spin["TickRange"]["HitInterval"] = fp(0.07)
    ex["HitDataList"] = [spin]
    ex["ScriptCalls"] = [x for x in ex.get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"]
    ex["AddMotions"] = []; B.buzz_dive(port, ex, 0.0)        # the same dive, steered the same way (Up / Down held)
    lx = copy.deepcopy(by["rrb_buzzsaw_land"]); lx["Name"] = "rrb_buzzsaw_land_ex"
    for h in lx["HitDataList"][-1:]:                                           # the landing shot: 1.5x its box
        hb = h["HitBox"]; hb["Max"]["x"] = fp(fv(hb["Max"]["x"]) * 1.5); hb["Max"]["y"] = fp(fv(hb["Max"]["y"]) * 1.5)
    for e in lx.get("AddEffects") or []:
        if e["NameEx"]["ConstValue"].endswith("/rrb_muzzle_heavy"):
            for ax in ("x", "y"): e["Scale"][ax] = fp(fv(e["Scale"][ax]) * 1.35)
    by["rrb_buzzsaw_land_ex"] = lx
    ex["OnGroundAction"] = "rrb_buzzsaw_land_ex"; ex["DropEndAction"] = "rrb_buzzsaw_land_ex"
    # the saw blade (the lead, 2026-09-29): spins with her from the spin's start until the dive ends (KillMode 2: it
    # goes when the dive becomes the landing), centred on her spin (408_05-07: 0.05 u ahead, 1.3 u up, ~1.8 u across);
    # on touchdown the saw breaks up in place (rrb_saw_land) as the landing takes over
    # (the lead, 2026-09-29: the saw "is supposed to disappear as soon as she touches the ground ... if she's on the
    # ground make the vfx for the saw not exist"; "buzzsaw land is also supposed to activate as soon as she touches the
    # ground"): the saw spawns only while she's airborne, the dive switches to its landing on the first grounded tick
    # (a ground-check switch, as the stock air dash's dashAirend: the dive is a scripted motion, which may not raise the
    # engine's landing event), and the landing removes the saw on its first tick
    for n, t0, land in (("rrb_buzzsaw", 0.2, "rrb_buzzsaw_land"), ("rrb_buzzsaw_ex", 0.0, "rrb_buzzsaw_land_ex")):
        e = B.fx_entry(port, "Role/Rrb/rrb_saw", t0, scale=SAW_SCALE, dx=0.05, dy=1.3, attached=True); e["KillMode"] = 2
        e["ConditionGroup"] = cg([port.refs.ground(1)])
        by[n].setdefault("AddEffects", []).append(e)
        a = by[n]
        a["ActionSwitchs"] = [B.bp.switch(land, [port.refs.ground(2)], start_type=1, nt=1, t0=0.15 if n == "rrb_buzzsaw" else 0.02,
                                          t1=fv(a["TotalDuration"]))] + (a.get("ActionSwitchs") or [])
    for n in ("rrb_buzzsaw_land", "rrb_buzzsaw_land_ex"):
        by[n].setdefault("RemoveEffect", []).append({"Tick": fp(0.0), "ConditionGroup": cg([]), "Name": "Role/Rrb/rrb_saw"})
    note("rrb_buzzsaw_ex", "EX dive: spin cuts every 0.07 s; lands into rrb_buzzsaw_land_ex (shot box x1.5, blast x1.35)")


def recoil_shot(B, port, by):
    """0.9.0, the air Skill (RECOIL_SHOT). Made from the air backward gun-dash once its effects and sounds are wired
    (build_logic), before the Potentials pass, so none of the blast cards touch it: its muzzle flash, burst, ring,
    casing and gunshot are the blast's own, in the pose they were placed for. It fires Rifle Shot's round (b7: the
    stage and High Caliber buffs swap it as they do every round of hers, and the loaded Dust colours it) instead of the
    blast's point-blank hit; the recoil carries her back and a little up, she hangs, then falls. No blast lock, no
    blast marker, no invincibility: it is a Skill, paid in MP and repeatable while she has it."""
    fp, fv, R = B.fp, B.fv, RECOIL_SHOT
    a = copy.deepcopy(by["rrb_blast_air_back"]); a["Name"] = "rrb_recoilshot"
    a["HitDataList"] = []; a["HitAudios"] = []; a["HitEffects"] = []
    a["CDList"] = []; a["ActionSwitchs"] = []; a["MuteSkills"] = []; a["Invincibility"] = []; a["SpeedChanges"] = []
    a["AddBuff"] = [b for b in a.get("AddBuff") or [] if b["Buff"]["Idx"] not in (BLASTING, ENH, "2201", "2206_replace2")]
    a["AddBuff"].append(B.bp.buff("nogravity_change", 0.0, R["hang"]))
    a["AddMotions"] = [B.glide(port, R["shot"], -R["back"], R["up"], R["fly"])]
    a["ScriptCalls"] = [x for x in a.get("ScriptCalls") or [] if x["Call"]["Function"] != "AddMotion"]
    role = copy.deepcopy(by["rrb_rifleshot"]["AddRoles"][0])
    role["TimeConfig"]["Start"] = fp(R["shot"]); role["TimeConfig"]["End"] = fp(R["shot"])
    role["ConditionGroup"] = {"Combine": 0, "Conditions": []}
    role["Position"]["OffsetX"]["ConstValue"] = fp(R["muzzle"][0]); role["Position"]["OffsetY"]["ConstValue"] = fp(R["muzzle"][1])
    a["AddRoles"] = [role]
    a["NextAction"] = "drop"; a["DropAction"] = "drop"
    B.armor(a, 1)
    import rrb_power as _rp          # an air jump out of it, as out of a fall, once other moves are open
    js = _rp.air_jump_switch(B, by, R["free"], fv(a["TotalDuration"]))
    if js is not None: a["ActionSwitchs"] = [js]
    by["rrb_recoilshot"] = a
    port.note("rrb_recoilshot", "air Skill: a rifle round at %.2f s from (%.2f, %.2f); recoil %.1f u back, %.2f u up in %.2f s; hangs to %.2f s; "
              "other moves from %.2f s, the next shot from %.2f s" % (R["shot"], R["muzzle"][0], R["muzzle"][1], R["back"], R["up"], R["fly"],
                                                                     R["hang"], R["free"], R["again"]))
    # Rising Reap: not spammable. Its rows read this cooldown (PrecheckActionCd); a combo route into it does not
    by["rrb_launcher"].setdefault("CDList", []).append({"Time": fp(0), "ID": "rrb_launcher", "Duration": fp(REAP_AGAIN)})
    port.note("rrb_launcher", "0.9.0: cannot start again from Up + Attack for %.1f s" % REAP_AGAIN)


# ---------------------------------------------------------------- Potentials and hidden effects in the action data
def potentials_v2(B, port, by):
    fp, fv = B.fp, B.fv
    t = lambda k: (lambda: [T(B, port, k)])
    tt = lambda *ks: (lambda: [T(B, port, k) for k in ks])
    bf = lambda b, *ks: (lambda: [port.refs.buff(b)] + [T(B, port, k) for k in ks])
    log = lambda n, m: port.note(n, "V2 Potentials: " + m)
    buff = B.bp.buff
    gsw_src = {k: copy.deepcopy(by[k]) for k in ("rrb_rifleshot", "rrb_recoilshot") if k in by}

    # hidden 16: out of Rising Crescent she rises with the swing: the air Rising Reap (wired: its arcs, trails, sound)
    # with a rising start speed (11 u/s up)
    rise = copy.deepcopy(by["rrb_launcher_air"]); rise["Name"] = "rrb_launcher_rise"; rise["CDList"] = []
    B.launch(port, rise, 0.05, 0.6, 11.0, -30.0)
    by["rrb_launcher_rise"] = rise
    port.note("rrb_launcher_rise", "hidden 16: the air Rising Reap rising at 11 u/s from 0.05 s")
    # -- conditional parts on the base moves first: the variants copy them
    # 20706 Rising Reap: brief Invincibility at the start (0-0.2 s)
    for n in ("rrb_launcher", "rrb_launcher_air", "rrb_launcher_rise"):
        by[n].setdefault("Invincibility", []).append(inv(B, 0.0, 0.2, [T(B, port, "reap_inv")]))
    # hidden 13 (20703 + 20721): the final strike is Invincible while passing through (the 0.2-0.45 s pass)
    by["rrb_a4"].setdefault("Invincibility", []).append(inv(B, 0.18, 0.45, [T(B, port, "a4_pass"), T(B, port, "blast_inv")]))
    # 20725 Corkscrew: Invincibility during the spin (0-0.35 s)
    by["rrb_corkscrew"].setdefault("Invincibility", []).append(inv(B, 0.0, 0.35, [T(B, port, "cork_blast")]))
    # 20719 Jump: the air attack limit resets on each air jump (Noel's jump2 / jump3: SetActionCD with the trigger).
    # Her Universal Airborne Attacks are the air string (j.A's once-per-airtime start) and the air Rising Reap (its own
    # once-per-airtime limit): both reset (the Rising Reap's added 2026-09-30, decided under the lead's delegation)
    for n in ("jump2", "jump3"):
        if n in by:
            for act in ("rrb_ja", "rrb_launcher_air"):
                by[n].setdefault("ScriptCalls", []).append(B.bp.call(0.0, "SetActionCD", 'action: "%s", cd: 0' % act, [T(B, port, "jump_reset")]))
    # 20723 Enhancer: every Gun Blast leaves rrb_enh (1.5 s); the next attack spends it for +30 % damage (rrb_enh_dmg,
    # the stock all-groups damage buff 12261_all cloned) and a petal flash. Hidden 21 (with 20722): a fourth blast
    # leaves rrb_enh4 too, and the attack spends it for another +20 %
    for n in B.ALL_BLASTS:
        a = by[n]; te = fv(a["TotalDuration"]) * 0.5
        a.setdefault("AddBuff", []).append(buff(ENH, 0.0, 1.5 + te, conds=[T(B, port, "enhancer")]))
    for n in ENHANCED:
        if n not in by: continue
        a = by[n]
        a.setdefault("AddBuff", []).append(buff(ENH_DMG, 0.0, max(0.8, fv(a["TotalDuration"])), strength=0.3, conds=[port.refs.buff(ENH)]))
        a["AddBuff"].append(buff(ENH_DMG + "2", 0.0, max(0.8, fv(a["TotalDuration"])), strength=0.2, conds=[port.refs.buff(ENH4)]))
        e = B.fx_entry(port, "Role/Rrb/rrb_petals", 0.0, dy=1.0, attached=True); e["KillMode"] = 1
        e["ConditionGroup"] = cg([port.refs.buff(ENH)]); a.setdefault("AddEffects", []).append(e)
        # (a tester: "It's unclear if it's actually enhanced") the enhanced strike fires: a heavy muzzle flash and
        # the blast's ring where its first hit lands, while the damage buff is on her
        H = a.get("HitDataList") or []
        if H:
            h0 = min(H, key=lambda h: fv(h["TickRange"]["Start"])); bx = h0["HitBox"]
            fx_x = 0.6 * max(fv(bx["Max"]["x"]), 0.8); fx_y = (fv(bx["Min"]["y"]) + fv(bx["Max"]["y"])) / 2
            for name, sc in ((ENH_FX[0], 1.0), (ENH_FX[1], 0.8)):
                e = B.fx_entry(port, name, fv(h0["TickRange"]["Start"]), scale=sc, dx=fx_x, dy=fx_y, attached=True); e["KillMode"] = 1
                e["ConditionGroup"] = cg([port.refs.buff(ENH_DMG)]); a["AddEffects"].append(e)
        a.setdefault("RemoveBuff", []).extend(
            [{"Time": fp(0.05), "TimeConfig": {"StartType": 1, "Start": fp(0.05), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1}, "BuffName": b}
             for b in (ENH, ENH4)])
    # hidden 14: Low Sweep marks the next Guillotine (20 MP back inside the move)
    by["rrb_sweep"].setdefault("AddBuff", []).extend([buff(SWEEP_G, 0.0, 0.9, conds=[T(B, port, "sweep_open"), T(B, port, "guil_armor")])])
    # the blockers (see BLOCKERS): stand and run put them back (Gravity's only while no Gravity Dust is loaded); the
    # Gravity reload lifts X_GRAV and the other reloads put it back (D4: the fourth blast)
    def unblock(a, b, t=0.0):
        a.setdefault("RemoveBuff", []).append({"Time": fp(t), "TimeConfig": {"StartType": 1, "Start": fp(t), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1}, "BuffName": b})
    for n in ("stand", "run"):
        if n not in by: continue
        by[n].setdefault("AddBuff", []).extend([gate(buff(X_CHORD_R, 0.0, 600.0)), gate(buff(X_CHORD_D, 0.0, 600.0)), gate(buff(X_CHORD_A, 0.0, 600.0)),
                                                gate(buff(X_GRAV, 0.0, 600.0, conds=[port.refs.buff("rrb_dust4", invert=1)]))])
    for n, a in by.items():                       # j.2A: a miss spends it for this airtime (J2A_SPENT)
        if not (n == "rrb_j2a" or n.startswith("rrb_j2a_")) or not a.get("HitDataList"): continue
        t_ = max(fv(h["TickRange"]["End"]) for h in a["HitDataList"]) + 0.02
        miss = port.refs.hit(round(t_ + 0.05, 3)); port.refs.items[-1]["data"]["Invert"] = 1
        a.setdefault("AddBuff", []).append(gate(buff(J2A_SPENT, round(t_, 3), 600.0, conds=[miss])))
    for n in [x for x in by if x in ("stand", "run", "runStart", "quickStand", "knockdown_stand", "standUp", "standUp2")
              or x.startswith(("dropend", "land")) or x.endswith(("_land", "_land_ex", "_land_hc")) or "_land_" in x]:
        unblock(by[n], J2A_SPENT)
    for key, k, *_ in B.DUST_EL:
        a = by["rrb_dust_" + key]
        if k == 4: unblock(a, X_GRAV, B.DUST_LOCK)
        else: a.setdefault("AddBuff", []).append(gate(buff(X_GRAV, B.DUST_LOCK, 600.0)))
    # The SP moves on the kit's chords (KIT_V2; the 0.5.0 test: the engine's "Ultra" input never reaches the game on
    # keyboard): Petal Burst = Attack + Summon, Petal Dance = Skill + Summon, either button first. The first button's
    # move starts (an Attack move, Rifle Shot, a Dust reload); the second within CHORD switches it (ChangeSkill) to the
    # SP move's input-less row, which that move's chord blocker opens for CHORD (rows_v2: pba / pbd / pdc / pdd).
    # (0.6.12, "missing or unreliable Ultra activation": pressed together during another move, the first button's press
    #  is buffered up to 0.3 s and starts its move when that move lets it; the second button's press is then older than
    #  the window and the chord was lost.) With `held`, Summon still DOWN in the move's first frames counts as well.
    #  Not for the Dust reload (Summon first): Attack held over from the last swing would fire Petal Burst on a reload
    def chord(a, src, pairs, held=False):
        unblock(a, src)
        a.setdefault("AddBuff", []).append(gate(buff(src, CHORD, 600.0)))
        sw = [B.bp.switch(target, [port.refs.input(key, 0, CHORD), T(B, port, card)], start_type=1, nt=1, t0=0.0, t1=CHORD, mode=1)
              for key, target, card in pairs]
        if held:
            sw += [B.bp.switch(target, [port.refs.input(key, 2), T(B, port, card)], start_type=1, nt=1, t0=0.0, t1=0.05, mode=1)
                   for key, target, card in pairs]
        a["ActionSwitchs"] = sw + (a.get("ActionSwitchs") or [])
    for n, a in by.items():     # (SP_INPUTS off: the chord windows stay as they were, with no switch into an SP move)
        if n == "rrb_rifleshot" or n.startswith("rrb_rifleshot_"):
            chord(a, X_CHORD_R, [(5, "rrb_petaldance", "petal_dance")] if SP_INPUTS else [], held=True)
        elif n.startswith("rrb_dust_"):
            chord(a, X_CHORD_D, [(1, "rrb_petalburst_d", "petal_burst"), (3, "rrb_petaldance_d", "petal_dance")] if SP_INPUTS else [])
        elif any(n == m or n.startswith(m + "_") for m in ATTACK_MOVES):
            chord(a, X_CHORD_A, [(5, "rrb_petalburst", "petal_burst")] if SP_INPUTS else [], held=True)
    # hidden 14 / 20: Guillotine costs 20 MP less after Low Sweep / an Enhancer blast: the MP back at 0.06 s, when
    #  its card variant (chosen at 0) is running, so exactly one action refunds it
    for n, a in by.items():
        if n == "rrb_guillotine" or n.startswith("rrb_guillotine_"):
            a.setdefault("ScriptCalls", []).extend([
                B.bp.call(0.06, "ChangeMP", "mp:20, chain:2", [T(B, port, "sweep_open"), T(B, port, "guil_armor"), port.refs.buff(SWEEP_G)]),
                B.bp.call(0.06, "ChangeMP", "mp:20, chain:2", [T(B, port, "enhancer"), T(B, port, "guil_armor"), port.refs.buff(ENH),
                                                      port.refs.buff(SWEEP_G, invert=1)])])
    # hidden 24: right after Petal Burst, Petal Dance costs less (rrb_after_pb, 1.5 s from the dash's end)
    pb = by["rrb_petalburst"]
    pb.setdefault("AddBuff", []).append(buff(AFTER_PB, max(0.0, fv(pb["TotalDuration"]) - 0.4), 1.9, conds=[T(B, port, "petal_dance")]))
    # (audit T12: only an undocumented Down + Skill row was cheaper; the chords the move list shows paid in full, and the
    #  marker was read by nothing.) Petal Dance within the marker gives 20 SP back (rrb_sp_back -> rrbSpBack): 30 SP net
    by["rrb_petaldance"].setdefault("AddBuff", []).append(buff("rrb_sp_back", 0.06, 0.2, conds=[T(B, port, "petal_burst"), T(B, port, "petal_dance"),
                                                                                           port.refs.buff(AFTER_PB)]))
    # hidden 28 (20732 + 20722): loading Dust restores a Gun Blast (the air starters' lock cleared)
    for key, k, *_ in B.DUST_EL:
        a = by["rrb_dust_" + key]
        for s in B.AIR_STARTERS:
            a.setdefault("ScriptCalls", []).append(B.bp.call(B.DUST_LOCK, "SetActionCD", 'action: "%s", cd: 0' % s,
                                                            [T(B, port, "dust_round"), T(B, port, "blast_chain")]))

    # -- 20725 / hidden 26: Corkscrew out of every blast: from the end of its travel, or (with 20721) during it
    for n in B.ALL_BLASTS:
        a = by[n]; te = B.travel_end(a)
        atk = lambda: port.refs.input(1, 0, 0.1)
        a["ActionSwitchs"] = [B.bp.switch("rrb_corkscrew", [atk(), T(B, port, "cork_blast"), T(B, port, "blast_inv")], start_type=1, nt=1, t0=0.03, t1=te, mode=1),
                              B.bp.switch("rrb_corkscrew", [atk(), T(B, port, "cork_blast")], start_type=1, nt=1, t0=te, t1=te + 0.35, mode=1)] + \
                             (a.get("ActionSwitchs") or [])

    # -- Scythe Chain's pause (20702): with the card, 5AA holds its end pose 0.4 s longer; a press from 0.50 s (a pause
    #    after the second strike) finds rrb_pause and takes the 5B row, an earlier press the 5AAA row (rows_v2)
    def pause(v):
        # (the pause gate, 2026-09-30: a CheckBuffStack pre-check on the 5B row did not gate in game: mashing gave 5B /
        # 5BB, a slower string lost 5AAA.) Now the stock mechanism of Dash -> Attack (Corkscrew): 5B's rows have no
        # input, so no press selects them; a press after the pause (0.5 s on, 5AA held 0.4 s longer) is taken by this
        # switch, which starts 5B as a chain step (ChangeSkill), so 5BB and the B string's cancels follow by rows. With
        # the card, 5AA's own chain window closes at 0.5 s (rows_v2), so the press reaches only this switch
        # (0.6.11, the lead's play trace, 2026-09-30: 5B came out 0.86 s after 5AA started, long after the string read as
        #  dropped: the window ran to the end of the 0.4 s hold.) The pause window is 0.5-0.8 s and the move ends with it
        v["TotalDuration"] = fp(fv(v["TotalDuration"]) + 0.3)
        v["ActionSwitchs"] = [B.bp.switch("rrb_5b", [port.refs.input(1, 0, 0.1)], start_type=1, nt=1, t0=PAUSE_T0,
                                          t1=PAUSE_END, mode=1)] + (v.get("ActionSwitchs") or [])
        # (0.8.0; a tester, 2026-10-03: "Could use a visual indicator (like Jin's sheathing blink) to know when Scythe
        #  Chain can be used".) The moment the window opens is marked the way the game marks Jin's: a glint (rrb_ready,
        #  built like his blink, in her colours) on her blade, attached to her, gone with the move if she leaves it
        e = B.fx_entry(port, PAUSE_CUE, PAUSE_T0, dx=PAUSE_CUE_AT[0], dy=PAUSE_CUE_AT[1], attached=True); e["KillMode"] = 2
        v["AddEffects"] = (v.get("AddEffects") or []) + [e]

    # -- the variant matrix per move (most specific combination first)
    CM = ("cm", t("crescent_mastery"), lambda v: (grow(B, v, 1.25), mul(v, 1.15)))
    def mul(v, k):   # damage: the variant's own damage row (DMG_MUL), read by build_ruby.damage_rows
        DMG_MUL[v["Name"]] = DMG_MUL.get(v["Name"], 1.0) * k
    def cm_plus(v): grow(B, v, 1.15); mul(v, 1.05)
    def drag(v):
        mul(v, 1.35)
        victim(B, port, v["HitDataList"][-1], "down")
    def a4pass(v):
        for h in v["HitDataList"]:
            h["HitBox"]["Min"]["x"] = fp(-0.4); h["HitBox"]["Max"]["x"] = fp(max(fv(h["HitBox"]["Max"]["x"]), 3.4))
        mul(v, 1.15)
    def reap(v, higher=18.0):
        v["HitDataList"] = v["HitDataList"] + [copy.deepcopy(v["HitDataList"][-1])]
        h = v["HitDataList"][-1]; e = fv(h["TickRange"]["End"])
        h["TickRange"]["Start"] = fp(e + 0.05); h["TickRange"]["End"] = fp(e + 0.12)
        for x in v["HitDataList"]:
            x["HitBox"]["Min"]["x"] = fp(min(fv(x["HitBox"]["Min"]["x"]), -1.2))
        push(B, h, y=higher); mul(v, 1.45)
    def enh_reap(v):   # hidden 19: enhanced by Gun Blast: Super Armor, launches higher
        B.armor(v, 9)
        for h in v["HitDataList"]: push(B, h, ky=1.25)
    def guil(v):       # 20713: Super Armor throughout, the last strike launches
        B.armor(v, 9); victim(B, port, v["HitDataList"][-1], "launch"); mul(v, 1.1)
    def cork2(v):      # 20724: spins twice (every window twice), pulling enemies in
        B.split_hits(v, 2); mul(v, 1.4)
        for h in v["HitDataList"]: push(B, h, x=-2.5)
    def rifle2(v):     # 20710: a second round 0.2 s after the first, with its flash, casing and shot sound
        r = copy.deepcopy(v["AddRoles"][-1]); t0 = fv(r["TimeConfig"]["Start"]); t1 = t0 + 0.2
        r["TimeConfig"]["Start"] = fp(t1); r["TimeConfig"]["End"] = fp(t1); v["AddRoles"].append(r)
        for fx in ("rrb_muzzle", "rrb_casing", "rrb_blast_ring"):
            src = min((e for e in v.get("AddEffects") or [] if e["NameEx"]["ConstValue"].split("/")[-1].startswith(fx)),
                      key=lambda e: abs(fv(e["Start"]) - t0), default=None)
            if src:
                e = copy.deepcopy(src); e["Start"] = fp(fv(src["Start"]) + 0.2); v["AddEffects"].append(e)
        B.sfx(v, "sfx_no_attack7", t1)
        v["TotalDuration"] = fp(fv(v["TotalDuration"]) + 0.12)
    def rifle_hc(v):   # hidden 18: enhanced by Gun Blast, the round is the high-calibre one
        for r in v.get("AddRoles") or []:
            for x in r.get("StartActionEx") or []:
                if x.get("ConstValue") == "b7": x["ConstValue"] = "b7_hc"
    def sypod3(v):     # 20711 (0.9.0): the plant knocks enemies away, and each held round gives MP back (rrb_power.sypod_held).
        # (until 0.8 it added a third round: Sy-Pod is one heavy round a pull now)
        for h in v["HitDataList"]:
            if fv(h["TickRange"]["Start"]) < 0.35: victim(B, port, h, "knock")
    def clash_full(v): # (rrb_clash_full) with 20709: Super Armor through the bound, breaks Super Armor, more damage, marks the chase's flurry
        B.armor(v, 9)
        for h in v["HitDataList"]: h["ArmorBreak"] = 10
        v.setdefault("AddBuff", []).append(buff(FULL, 0.0, 3.0)); mul(v, 1.3)
    def se_clash(v):   # hidden 11: with Silver Eyes, the full charge Staggers (stun 1.5 s + the Red Reaper mark)
        tmpl = copy.deepcopy(B.tpl(port, "icey", "attack1")["HitDataList"][0]["Victim"]["BuffList"][0]); tmpl["ConditionGroup"]["Conditions"] = []
        for h in v["HitDataList"]:
            b1 = copy.deepcopy(tmpl); b1.update({"Idx": B.STUN, "Duration": fp(1.5)})
            b2 = copy.deepcopy(tmpl); b2.update({"Idx": B.MARK, "Duration": fp(4.0)})
            h["Victim"]["BuffList"] = (h["Victim"].get("BuffList") or []) + [b1, b2]
    def rr_se(v):      # hidden 30: Red Reaper deals more damage to bosses (its victims are bosses or Staggered)
        mul(v, 1.3)
    def bz_hc(v):      # High Caliber on the Buzzsaw landing shot: a bigger, harder shot that pushes further
        for h in v["HitDataList"][-1:]:
            grow1(h, 1.3); push(B, h, kx=1.5)
        mul(v, 1.2)
    def grow1(h, k):
        hb = h["HitBox"]; hb["Max"]["x"] = fp(fv(hb["Max"]["x"]) * k); hb["Max"]["y"] = fp(fv(hb["Max"]["y"]) * k)

    # Sy-Pod's plant (audit: the move list's "hitting enemies above" and 20711's "planting knocks enemies away" had no
    # hit behind them: no Sy-Pod action had one). The chop that plants the rifle (its arc at 0.075 s, the blade meets
    # the floor at 0.15 s) hits in front of and above her
    sy = by["rrb_sypod"]
    if not sy.get("HitDataList"):
        sy["HitDataList"] = [B.hit(port, "light", 0.10, 0.18, [0.0, 0.0, 1.9, 2.6], "skill")]
        sy["HitAudios"] = [{"Cue": B.HIT_SFX, "Time": 0.0, "StopWhenChangeAction": 0, "CheckVoiceState": 0, "ConditionGroup": {"Combine": 0, "Conditions": []}}]
        sy["HitEffects"] = copy.deepcopy(B.tpl(port, "icey", "attack1")["HitEffects"])
    # (audit T1: the move list says the third strike "hits several times"; it had one hit, two with 20701)
    if len(by["rrb_a3"]["HitDataList"]) == 1: B.split_hits(by["rrb_a3"], 3)
    M = {}
    for n in ("rrb_a1", "rrb_a2", "rrb_a4"):
        M[n] = [CM, ("cmp", tt("crescent_mastery", "a3_drag"), cm_plus)]
    M["rrb_a2"] = [("chain", t("scythe_chain"), pause)] + M["rrb_a2"]
    M["rrb_a3"] = [("drag", t("a3_drag"), drag), CM, ("cmp", tt("crescent_mastery", "a3_drag"), cm_plus)]
    M["rrb_a4"] = [("pass", t("a4_pass"), a4pass)] + M["rrb_a4"]
    for n in ("rrb_5b", "rrb_5bb", "rrb_2a", "rrb_sweep", "rrb_2b", "rrb_clash", "rrb_clash_full"):
        M[n] = [CM]
    CMR = ("cmp", tt("crescent_mastery", "reap_more"), cm_plus)       # hidden 3: "attacks in an even larger range"
    M["rrb_launcher"] = [("more", t("reap_more"), reap), CM, CMR, ("enh", bf(ENH, "enhancer", "reap_more"), enh_reap)]
    M["rrb_launcher_air"] = [("more", t("reap_more"), reap), CM, CMR]
    M["rrb_launcher_rise"] = [("more", t("reap_more"), reap), CM, CMR]
    M["rrb_corkscrew"] = [("twice", t("cork_twice"), cork2), CM, ("cmp", tt("crescent_mastery", "cork_twice"), cm_plus)]
    M["rrb_guillotine"] = [("armor", t("guil_armor"), guil), CM]
    M["rrb_rifleshot"] = [("two", t("rifle_two"), rifle2), ("hc", bf(ENH, "enhancer", "rifle_two"), rifle_hc)]
    if "rrb_rifleshot_r" in by: M["rrb_rifleshot_r"] = list(M["rrb_rifleshot"])    # 0.9.0: the re-fire has the same versions
    M["rrb_sypod"] = [("three", t("sypod_three"), sypod3)]
    M["rrb_redreaper"] = [("se", t("silver_eyes"), rr_se)]
    M["rrb_buzzsaw_land"] = [("hc", t("high_caliber"), bz_hc)]
    M["rrb_buzzsaw_land_ex"] = [("hc", t("high_caliber"), bz_hc)]

    # Clash Assault with 20709 (the lead, 2026-10-02: "remove that first part of her charged clash ... it should
    # immediently go into the dash part of clash"): no charge stance (0.6.13's rrb_clash_charge, 0.35 s with a petal ring,
    # then rrb_clash_go / _full: the game trace showed four action changes before the bound). With the card every Clash
    # Assault is the full one from its first frame (rrb_clash_full: Super Armor, armour break, x1.3, the flurry finish);
    # its switch is put first after the variants (below)
    base = by["rrb_clash"]
    full = copy.deepcopy(base); full["Name"] = "rrb_clash_full"; clash_full(full); by["rrb_clash_full"] = full
    M["rrb_clash_full"] = [CM, ("se", t("silver_eyes"), se_clash)]
    exf = copy.deepcopy(by["rrb_clash_finish"]); exf["Name"] = "rrb_clash_exfinish"; B.split_hits(exf, 3); by["rrb_clash_exfinish"] = exf
    by["rrb_clash_finish"]["ActionSwitchs"] = [B.bp.switch("rrb_clash_exfinish", [port.refs.buff(FULL)], start_type=1, nt=1, t0=0.0, t1=0.05)] + \
                                              (by["rrb_clash_finish"].get("ActionSwitchs") or [])
    by["rrb_clash_exfinish"].setdefault("RemoveBuff", []).append({"Time": fp(0.0), "TimeConfig": {"StartType": 1, "Start": fp(0.0), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1}, "BuffName": FULL})
    port.note("rrb_clash", "with clash_ex: rrb_clash_full from the first frame (no charge): Super Armor 9, armour break 10, x1.3, the flurry finish")

    # Skill layout (the lead, 2026-09-30: "rifle shot can be the tap skill and sypod can be the held skill"): Rifle Shot
    # turns into Sy-Pod when Skill is still held at 0.15-0.166 s (the round leaves at 0.167 s: a tap fires, a hold plants
    # the rifle; the Rifle's MP pays for it). Reaper's Hook (20712) moved to Down + Skill (rows_v2). Hidden 17 (with
    # 20713): the hook's flurry follows up with Guillotine
    # (0.6.12: the check was at 0.13-0.15 s; a keyboard tap is 70-150 ms, so slow taps planted the rifle. Now the last
    #  frame before the round)
    for n, a in by.items():
        if n == "rrb_rifleshot" or n.startswith("rrb_rifleshot_"):
            a["ActionSwitchs"] = [x for x in a.get("ActionSwitchs") or [] if (x.get("NewActionEx") or {}).get("ConstValue") != "rrb_hook"]
            # (0.9.0: not out of a re-fire, whose round leaves at 0.083 s: a second press is always a shot; Sy-Pod
            #  is the hold on the first press, or Down + Skill)
            if not n.startswith("rrb_rifleshot_r"):
                a["ActionSwitchs"].append(B.bp.switch("rrb_sypod", [port.refs.input(3, 2)], start_type=1, nt=1, t0=0.15, t1=0.166, mode=1))
    # (0.6.5 game test, 2026-09-30: it followed up by itself, a Guillotine nobody pressed for. Decided under the
    #  lead's delegation: it answers a Skill press in the flurry's last 0.4 s, buffered 0.3 s, so the player chooses it)
    for n in ("rrb_hook_exe", "rrb_hook_back"):
        a = by[n]; e = fv(a["TotalDuration"])
        a["ActionSwitchs"] = [B.bp.switch("rrb_guillotine", [T(B, port, "guil_armor"), port.refs.input(3, 0, sticky=0.3)], start_type=1, nt=1,
                                          t0=max(0.0, e - 0.4), t1=e)] + (a.get("ActionSwitchs") or [])
        # (0.6.6 game test: a Skill press in the flurry started Rifle Shot through its row, since a row beats a switch, and
        #  Attack / Jump broke the throw once the hook row's 0.35 s mute ran out.) The flurry is committed like a throw:
        #  every input row stays muted for its whole length, and the Guillotine switch above is its only exit. On the
        #  action, not the hook's row, so a whiffed hook recovers at 0.55 s. (0.6.7 game test: the first version, 0.25 s
        #  renewed by Interval 0.2 with End 0, fired once; 0.6.8's TimeConfig window fired once too: see mute_window)
        a.setdefault("MuteSkills", []).extend(mute_window(B, ["all"], 0.0, e))
    # Buzzsaw EX (20720): Skill still held at 0.2 s (the hop done) -> the EX dive
    bz = by["rrb_buzzsaw"]
    bz["ActionSwitchs"] = [B.bp.switch("rrb_buzzsaw_ex", [T(B, port, "buzzsaw_ex"), port.refs.input(3, 2)], start_type=1, nt=1, t0=0.19, t1=0.22)] + (bz.get("ActionSwitchs") or [])
    # Summon with the Summon gauge full (the lead's 0.6.11 play trace: Summon in a Gun Blast played the stock `summon`, the
    # Summon Tactic's cast, for 2 ms; no Dust was loaded): the Dust rows' SummonSkill pre-call fires her equipped Summon
    # Tactic and the engine plays `summon` instead of the row's reload. `summon` casts the tactic at 0 and now hands over
    # to the reload the direction asks for (the row has taken the Dust's SP). From its first frame: a held direction
    # ended it in the same frame (run), before any later window
    if "summon" in by:
        su = by["summon"]
        def held_dir(**k):
            return port.refs.new("ActionLogicCondition_InputDir", dict({"Invert": 0, "CheckLR": 0, "CheckDown": 0, "CheckFront": 0, "CheckBack": 0, "CheckUp": 0}, **k))
        su["ActionSwitchs"] = [B.bp.switch(act, conds, start_type=1, nt=1, t0=0.0, t1=0.05, mode=1) for act, conds in
                               (("rrb_dust_ice", [held_dir(CheckUp=1)]), ("rrb_dust_bolt", [held_dir(CheckDown=1)]),
                                ("rrb_dust_fire", []))] + (su.get("ActionSwitchs") or [])   # Gravity: held (build_ruby.dust)
    # Guillotine hold (20714): Skill held at the end of the flurry -> the spin again (twice at most), then the finish
    gl = by["rrb_guillotine"]; ge = 0.783
    loops = []
    for i in (1, 2):
        lp = B.clean(port, "icey", "attack4", "rrb_guil_loop%d" % i, "guil_spin")
        B.with_hits(port, lp, ["MultiAssault"], "light", "skill", offset=0.65, span=(0.649, 0.8))
        lp["HitDataList"] = lp["HitDataList"][:1]
        for h in lp["HitDataList"]:          # three cuts over the three turns
            h["TickRange"]["Start"] = fp(0.02); h["TickRange"]["End"] = fp(fv(lp["TotalDuration"]) - 0.02); h["TickRange"]["HitInterval"] = fp(0.13)
        B.no_motion(lp); B.armor(lp, 5); B.sfx(lp, "sfx_no_attack3_p1", 0.0)
        lp["NextAction"] = "rrb_guil_end"; by[lp["Name"]] = lp; loops.append(lp)
    end = B.clean(port, "icey", "attack4", "rrb_guil_end", "guil_end"); B.no_motion(end); end["NextAction"] = ""
    # the launching blow, on the finish's own turn (GUIL_FIN: the turn is 8 ticks; the cut is out from its third)
    end["HitDataList"] = [B.hit(port, "launch", GUIL_FIN[0], GUIL_FIN[1], [-0.6, -0.2, 2.2, 2.6], "skill")]
    by["rrb_guil_end"] = end
    # (0.8.0; a tester, 2026-10-03: "the last part of Guillotine's animation seem to bug when holding the button to extend
    #  it".) The held spins and the finish had no slash at all: the effects pass runs before these actions exist. Each of
    #  their turns now plays the trail of the base move's own spin (its third swing, the same four sprites), in the
    #  three stage looks that trail has
    spin_fx = [e for e in gl.get("AddEffects") or [] if e["NameEx"]["ConstValue"].endswith("trail_rrb_guillotine_d2")]
    for a_, times in [(lp, (0.0, GUIL_FIN[2], 2 * GUIL_FIN[2])) for lp in loops] + [(end, (0.0,))]:
        for t_ in times:
            for e in spin_fx:
                c = copy.deepcopy(e); c["Start"] = B.fp(t_); a_.setdefault("AddEffects", []).append(c)
    port.note("rrb_guillotine", "held spins and finish: %d spin trail effect(s) per turn" % len(spin_fx))
    held = lambda: [T(B, port, "guil_hold"), port.refs.input(3, 2)]
    gl["ActionSwitchs"] = (gl.get("ActionSwitchs") or []) + [B.bp.switch("rrb_guil_loop1", held(), start_type=1, nt=1, t0=ge - 0.02, t1=ge + 0.02)]
    loops[0]["ActionSwitchs"] = [B.bp.switch("rrb_guil_loop2", held(), start_type=1, nt=1, t0=fv(loops[0]["TotalDuration"]) - 0.03, t1=fv(loops[0]["TotalDuration"]))]
    # (0.6.11, the lead's play trace: Rifle Shot cut rrb_guil_loop1 0.10 s in. The loops and the finish are entered by a
    #  switch and NextAction, so no row mutes them.) A held spin is committed for its length (Gun Blast after its first
    #  cut); the finish until its launching blow is out
    for lp in loops:
        lp.setdefault("MuteSkills", []).extend(mute_window(B, NONBLAST, 0.0, fv(lp["TotalDuration"])) + mute_window(B, ["5"], 0.0, 0.15))
    end.setdefault("MuteSkills", []).extend(mute_window(B, NONBLAST, 0.0, 0.25 + GUIL_FIN[2]) + mute_window(B, ["5"], 0.0, GUIL_FIN[1]))
    port.note("rrb_guillotine", "with guil_hold: Skill held at %.2f s -> rrb_guil_loop1 -> (held) rrb_guil_loop2 -> rrb_guil_end" % ge)

    for n, mods in M.items():
        if n in by:
            variant_matrix(B, port, by, n, mods, log)

    # 20744 Gunswing, after the card versions exist; its shots open the Skill-first chord as Rifle Shot does
    if len(gsw_src) == 2:
        for n in gunswing(B, port, by, gsw_src):
            chord(by[n], X_CHORD_R, [(5, "rrb_petaldance", "petal_dance")] if SP_INPUTS else [], held=True)

    # 20709 first (before Crescent Mastery's copy rrb_clash_cm; rrb_clash_full has CM / SE as its own variants): one
    # action change from the hold to the full bound
    by["rrb_clash"]["ActionSwitchs"] = [B.bp.switch("rrb_clash_full", [T(B, port, "clash_ex")], start_type=1, nt=1, t0=0.0, t1=0.05)] + \
                                       (by["rrb_clash"].get("ActionSwitchs") or [])

    # 20721 Gun Blast: Invincible while travelling (the stock buff until the action changes)
    for d in B.ALL_BLASTS:
        by[d].setdefault("AddBuff", []).append(buff(B.INV_BUFF, 0.0, fv(by[d]["TotalDuration"]), conds=[T(B, port, "blast_inv")]))
    # 20739 Gun Blast: travels farther. The blast's one travel entry is doubled: its own behind "card not held", a copy
    # BLAST_FAR times as long (both axes) behind the card, over the same time, so travel_end, the chain windows and
    # the landing are where they were. 20740: a Sy-Pod round out of the muzzle, on the muzzle flash's own tick, place
    # and angle (DirAngleV, relative to her facing: j.C's round, rrb_power.gun_levels)
    role_r = by["rrb_rifleshot"]["AddRoles"][0]
    far_n = shot_n = 0
    for d in B.ALL_BLASTS:
        a = by[d]; out = []
        for m in a.get("AddMotions") or []:
            far = copy.deepcopy(m)
            for ax in ("DeltaX", "DeltaY"):
                far["Motion"][ax]["ConstValue"] = B.fp(round(fv(far["Motion"][ax]["ConstValue"]) * BLAST_FAR, 3))
            m["ConditionGroup"] = cg(list(m["ConditionGroup"]["Conditions"]) + [port.refs.trigger(POT["blast_far"] * 10 + 1, invert=1)])
            far["ConditionGroup"] = cg(list(far["ConditionGroup"]["Conditions"]) + [T(B, port, "blast_far")])
            out += [m, far]; far_n += 1
        a["AddMotions"] = out
        mz = next((e for e in a.get("AddEffects") or [] if e["NameEx"]["ConstValue"].endswith("/rrb_muzzle")), None)
        if mz is None:
            port.note(d, "Gun Blast shot (20740): no muzzle flash on this variant, no round"); continue
        r = B.bp.role(role_r, B.BID, BLAST_SHOT, fv(mz["Start"]), round(fv(mz["Position"]["x"]), 3), round(fv(mz["Position"]["y"]), 3))
        r["DirAngleV"]["ConstValue"] = B.fp(round(fv(mz["Rotation"]["x"]), 2))
        r["ConditionGroup"] = cg([T(B, port, "blast_shot")])
        a.setdefault("AddRoles", []).append(r); shot_n += 1
    port.note("rrb_blast", "Gun Blast: %d travel entries x %.2f behind 20739; a %s round out of the muzzle on %d of %d variants behind 20740" % (
        far_n, BLAST_FAR, BLAST_SHOT, shot_n, len(B.ALL_BLASTS)))
    # 20741 Recoil Jump (0.8.0). The lead, 2026-10-03: "a potential or hidden effect that makes her jump fire a bullet
    # from the bottom of it any time she jumps and have the same vfx for gundash like she does in this image for the
    # show" (a frame of Ruby riding Crescent Rose's recoil, the flash under her); a tester the same evening: "some type
    # of special movement potential to her jump".
    # With the card each of her three jumps hands over to its own recoil version (<jump>_rj): the Gun Blast's flash,
    # pointed straight down under her feet, its burst (and its floor dust on the ground jump), its shot sound, the Gun
    # Blast's own round (BLAST_SHOT) fired straight down, a small blast under her, and JUMP_SHOT["k"] times the jump's
    # speed. The effects are the downward blast's own entries (rrb_blast_air_up), so they take the loaded Dust's colours
    # as every blast does. Numbers: proposals.
    # The air jumps hand over on their first tick. The ground jump cannot: its first 0.1 s is protected from switches
    # (the stock ProtectTime; in game, rsuite fb2_jumpshot: jump2 -> jump2_rj, jump -> nothing). It hands over when
    # the protection ends, 0.03 s after its take-off (0.07 s): its recoil version is entered in the air, on the rising
    # frames (the air jump's clip, not the take-off's crouch again), and fires at once
    src = by["rrb_blast_air_up"]
    blast_hit = next(iter(src.get("HitDataList") or []), None)
    for n in ("jump", "jump2", "jump3"):
        if n not in by: continue
        v = copy.deepcopy(by[n]); v["Name"] = n + "_rj"
        ground = (n == "jump"); prot = fv(by[n].get("ProtectTime") or fp(0.0))
        if prot > 0:
            v["ProtectTime"] = fp(0.0); v["StartSpeed"]["Time"] = fp(0.0)
            if "jump2" in by: v["Animate"] = by["jump2"]["Animate"]; v["AnimateDuration"] = copy.deepcopy(by["jump2"]["AnimateDuration"])
            v["AddEffects"] = [e for e in v.get("AddEffects") or [] if not e["NameEx"]["ConstValue"].startswith("Smoke/")]   # the take-off's dust: once
        t0 = fv(v["StartSpeed"]["Time"])
        v["StartSpeed"]["Speed"]["y"] = fp(round(fv(v["StartSpeed"]["Speed"]["y"]) * JUMP_SHOT["k"], 3))
        fxs = []
        for e in src.get("AddEffects") or []:
            nm = e["NameEx"]["ConstValue"].rsplit("/", 1)[-1]
            kind = "muzzle" if nm.startswith("rrb_muzzle") else "burst" if nm.startswith("rrb_blast_burst") else "floor" if nm == "rrb_ground_hit" else None
            if kind is None or (kind == "floor" and not ground): continue
            c = copy.deepcopy(e); c["Start"] = fp(t0)
            c["Position"] = {"x": fp(JUMP_SHOT["at"][0]), "y": fp(0.0 if kind == "floor" else JUMP_SHOT["at"][1])}
            if kind == "floor": c["OnGround"] = 1            # on the floor under her (she is about 0.4 u up by then)
            if kind == "muzzle":
                c["Rotation"] = {"x": fp(-90.0), "y": fp(-90.0)}; c["Scale"] = {"x": fp(JUMP_SHOT["fx"]), "y": fp(JUMP_SHOT["fx"])}
            fxs.append(c)
        v["AddEffects"] = (v.get("AddEffects") or []) + fxs
        # (its sounds: rrb_sound's plans for <jump>_rj: the stock jump foley, her jump voice, her rifle shot at take-off)
        r = B.bp.role(role_r, B.BID, BLAST_SHOT, t0, JUMP_SHOT["at"][0], JUMP_SHOT["at"][1])
        r["DirAngleV"]["ConstValue"] = B.fp(-90.0)
        v["AddRoles"] = (v.get("AddRoles") or []) + [r]
        if blast_hit is not None:
            h = copy.deepcopy(blast_hit); bx = JUMP_SHOT["box"]
            h["TickRange"]["Start"] = fp(t0); h["TickRange"]["End"] = fp(t0 + 0.05)
            h["HitBox"] = {"Min": {"x": fp(bx[0]), "y": fp(bx[1])}, "Max": {"x": fp(bx[2]), "y": fp(bx[3])}}
            v["HitDataList"] = (v.get("HitDataList") or []) + [h]
            v["HitEffects"] = copy.deepcopy(src.get("HitEffects") or []); v["HitAudios"] = copy.deepcopy(src.get("HitAudios") or [])
        by[v["Name"]] = v
        by[n]["ActionSwitchs"] = [B.bp.switch(v["Name"], [T(B, port, "jump_shot")], start_type=1, nt=1, t0=prot, t1=prot + (0.03 if prot > 0 else 0.02))] + \
                                 (by[n].get("ActionSwitchs") or [])
        port.note(n, "20741 Recoil Jump: -> %s (shot at %.2f s: %d effect entries, a %s round straight down, blast %s, jump speed x%.2f)" % (
            v["Name"], t0, len(fxs), BLAST_SHOT, JUMP_SHOT["box"], JUMP_SHOT["k"]))
    # 20728 Semblance: dashing moves leave rose petals that damage (rrb_petalzone rounds, bullets_v2); hidden 9 (with
    # 20721): the Gun Blast petals are stronger and linger (rrb_petalzone2); hidden 25 (with 20724): each spin a ring
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    def petals(a, t0, act="rrb_petalzone", conds=()):
        r = B.bp.role(role_t, B.BID, act, t0, 0.0, 0.8); r["ConditionGroup"] = cg(conds)
        a.setdefault("AddRoles", []).append(r)
    for d in B.ALL_BLASTS:
        te = B.travel_end(by[d])
        petals(by[d], te * 0.5, "rrb_petalzone2", [T(B, port, "semblance"), T(B, port, "blast_inv")])
        petals(by[d], te * 0.5, "rrb_petalzone", [T(B, port, "semblance"), port.refs.trigger(POT["blast_inv"] * 10 + 1, invert=1)])
    for n in [x for x in by if x.startswith("rrb_corkscrew")]:
        petals(by[n], 0.25, conds=[T(B, port, "semblance")])
    # (audit 140021: Petal Burst's petals spawned at 0.25 s where she stood; the dash is 1.5-1.9 s.) Three along the dash
    for tp in (1.55, 1.70, 1.85):
        petals(by["rrb_petalburst"], tp, conds=[T(B, port, "semblance")])
    for n in [x for x in by if x.startswith("rrb_corkscrew_twice")]:
        petals(by[n], 0.5, conds=[T(B, port, "semblance")])
    # 20717 Red Reaper (KIT §9): against a boss or a Staggered enemy, Petal Burst becomes Red Reaper: ICEY's execution
    # pattern (ScanTargetAndChangeAction with a filter, 16 x 8 u) at its start (0.03 s: it is entered by the chords'
    # skill change), both sides, turning to the target. (0.6.8 game test, 2026-09-30: Petal Burst never changed, a
    # marked Gunner in reach: the 0.x scans lived in build_ruby.potentials_v1, which V2 doesn't run, and hidden 10 below
    # copied a scan that wasn't there.) Its copies (_grav, _gpull, _d) are made later and carry these
    scan = next(s for s in B.tpl(port, "icey", "attack4")["ScriptCalls"] if s["Call"]["Function"] == "ScanTargetAndChangeAction")
    scans = []
    for flt in ('tag:"Boss"', 'bufftag:"stun"', 'bufftag:"ice"', 'bufftag:"weak_boss"', 'buff:"%s"' % B.MARK):
        c = copy.deepcopy(scan); c["Call"]["Params"] = 'x:%d,y:8,act:"rrb_redreaper",%s,turn:true,turn360:true' % (__import__('rrb_power').RR_SCAN, flt)
        c["TimeConfig"]["Start"] = fp(0.03); c["ConditionGroup"] = cg([T(B, port, "red_reaper")]); scans.append(c)
    by["rrb_petalburst"]["ScriptCalls"] = scans + (by["rrb_petalburst"].get("ScriptCalls") or [])
    # Red Reaper vs Elites (hidden 10, with Silver Eyes): the Ultra's target scan also takes Elite enemies
    calls = [s for s in by["rrb_petalburst"].get("ScriptCalls") or [] if s["Call"]["Function"] == "ScanTargetAndChangeAction"]
    if calls:
        c = copy.deepcopy(calls[0]); c["Call"]["Params"] = 'x:%d,y:8,act:"rrb_redreaper",tag:"Elite",turn:true,turn360:true' % __import__('rrb_power').RR_SCAN
        c["ConditionGroup"] = cg([T(B, port, "red_reaper"), T(B, port, "silver_eyes")])
        by["rrb_petalburst"]["ScriptCalls"].append(c)
    # Dust cards (the reload actions): 20730 longer (15 s) and +25 MP; 20731 stronger statuses (the rrb_dustN_s buffs);
    # 20732 a round of that element; 20733 the spent cartridge explodes; 20734 the previous Dust stays 4 s;
    # hidden 32 (20730 + 20731 + 20732): a burst of the element around her
    for key, k, *_ in B.DUST_EL:
        a = by["rrb_dust_" + key]; L = B.DUST_LOCK
        a["AddBuff"].append(buff("rrb_dust%d" % k, L, 15.0, conds=[T(B, port, "dust_long")]))
        a.setdefault("ScriptCalls", []).append(B.bp.call(L, "ChangeMP", "mp:25, chain:2", [T(B, port, "dust_long")]))
        a["AddBuff"].append(buff("rrb_dust%d_s" % k, L, 10.0, conds=[T(B, port, "dust_strong")]))
        a["AddBuff"].append(buff("rrb_dust%d_s" % k, L, 15.0, conds=[T(B, port, "dust_strong"), T(B, port, "dust_long")]))
        r = B.bp.role(role_t, B.BID, "rrb_dustround", L + 0.02, B.RECEIVER[0] + 0.5, B.RECEIVER[1] - 0.2)
        r["ConditionGroup"] = cg([T(B, port, "dust_round")]); a.setdefault("AddRoles", []).append(r)
        a.setdefault("AddEffects", []).append(dict(B.fx_entry(port, "Role/Rrb/rrb_muzzle", L + 0.02, dx=B.RECEIVER[0] + 0.5, dy=B.RECEIVER[1] - 0.2, attached=True),
                                                   KillMode=1, ConditionGroup=cg([T(B, port, "dust_round")])))
        r = B.bp.role(role_t, B.BID, "rrb_dustburst", L, 0.0, 1.0)
        r["ConditionGroup"] = cg([T(B, port, "dust_long"), T(B, port, "dust_strong"), T(B, port, "dust_round")]); a["AddRoles"].append(r)
        for m in range(1, 5):   # the cartridge blast in the element it held (spawned before the swap, at the receiver)
            # (game review 2026-10-02: the blast and the Fire card's flames stood on her and hid her; 20733: "explodes
            #  where it lands".) The casing flies up and back: the burst is on the floor 1.3 u behind her
            r = B.bp.role(role_t, B.BID, "rrb_cartblast%d" % m, B.DUST_EJECT, -1.3, 0.0)
            r["ConditionGroup"] = cg([T(B, port, "cart_blast"), port.refs.buff("rrb_dust%d" % m)]); a["AddRoles"].append(r)
            a["AddBuff"].append(buff("rrb_prev%d" % m, 0.1, 0.5, conds=[port.refs.buff("rrb_dust%d" % m)]))
            if m != k:
                a["AddBuff"].append(buff("rrb_dust%d" % m, L + 0.03, 4.0, conds=[T(B, port, "dust_combine"), port.refs.buff("rrb_prev%d" % m)]))
    port.note("rrb_dust", "V2 Potentials: dust_long 15 s + 25 MP, dust_strong rrb_dustN_s, dust_round, cartridge blast, combine 4 s")
    # hidden 27 / element cards: on-hit statuses and projectiles, only while that Dust is loaded
    #   Ice (27): Sy-Pod rounds Freeze on hit (stock 2101, 1.5 s) -- bullets_v2 (on the rounds)
    #   Lightning (27, 20737): each blast releases a discharge (rrb_spark at its shot)
    #   Fire (20735): Gun Blast leaves a trail of flames (rrb_flame at the travel), Buzzsaw's landing an eruption
    #   Gravity (20738): Rising Reap and Guillotine open a gravity well (rrb_gwell)
    for d in B.ALL_BLASTS:
        te = B.travel_end(by[d])
        r = B.bp.role(role_t, B.BID, "rrb_spark", 0.05, -0.8, 0.8)
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust3"), T(B, port, "dust_strong")]); by[d].setdefault("AddRoles", []).append(r)
        r = B.bp.role(role_t, B.BID, "rrb_spark", te, 0.0, 0.8)
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust3"), T(B, port, "bolt_dust")]); by[d]["AddRoles"].append(r)
        r = B.bp.role(role_t, B.BID, "rrb_flame", te * 0.5, 0.0, 0.1)
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust1"), T(B, port, "fire_dust")]); by[d]["AddRoles"].append(r)
    for n in [x for x in by if x.startswith(("rrb_buzzsaw_land", ))]:
        r = B.bp.role(role_t, B.BID, "rrb_erupt", 0.05, 0.6, 0.0)
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust1"), T(B, port, "fire_dust")]); by[n].setdefault("AddRoles", []).append(r)
        r = B.bp.role(role_t, B.BID, "rrb_flame", 0.05, 0.6, 0.1)
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust1"), T(B, port, "dust_strong")]); by[n]["AddRoles"].append(r)
        r = B.bp.role(role_t, B.BID, "rrb_icespike", 0.1, 0.0, 0.1)            # hidden 38: Ice + Buzzsaw EX: a ring of spikes
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust2"), T(B, port, "ice_dust"), T(B, port, "buzzsaw_ex")]); by[n]["AddRoles"].append(r)
    for n in [x for x in by if x.startswith(("rrb_launcher", "rrb_guillotine"))]:
        r = B.bp.role(role_t, B.BID, "rrb_gwell", 0.3, 2.4, 0.9)             # at the strike, not on her (review: "never on the enemy")
        r["ConditionGroup"] = cg([port.refs.buff("rrb_dust4"), T(B, port, "grav_dust")]); by[n].setdefault("AddRoles", []).append(r)
    # Lightning card (20737): the third strike calls down lightning on the struck enemy. `limit` counts on her for the
    # whole battle, so each use of the strike sets its counter back first, as stock moves do (Prisoner's aBEX: SetExtParams
    # on start); without it the bolt came once a battle (0.7.1 and earlier: found 2026-10-03 on the gravity wells)
    for n in [x for x in by if x.startswith("rrb_a3")]:
        by[n].setdefault("ScriptCalls", []).append(B.bp.call(0.0, "SetExtParams", 'key: "rrb_a3_bolt", value: 0', start_type=3, nt=1))
        for h in by[n]["HitDataList"][-1:]:
            h.setdefault("AttackerCalls", []).append(attacker_call(B, "CreateBullet",
                'bullet_id:"%d",bullet_action:"rrb_spark",pos_x:0,pos_y:0,bullet_target:1,limit:1,limitKey:"rrb_a3_bolt"' % B.BID,
                [port.refs.buff("rrb_dust3"), T(B, port, "bolt_dust")]))
    # Petal Burst's SP rule (the Ultra card: "SP: Gained when Gun Blast hits an enemy"): an SP ball on each blast hit
    # (Naoto's on-hit AddSPBall; 0.04 = 4 SP)
    for d in B.ALL_BLASTS:
        for h in by[d]["HitDataList"]:
            h.setdefault("AttackerCalls", []).append(attacker_call(B, "AddSPBall", 'sp:0.04,actor_pos:2,cd_buff:"scriptcd"', [], stage=2))
    extras_v2(B, port, by)


# 0.9.0 Buzzsaw Blast (testers, 2026-10-04: "add some iframe or cancel animation on buzzsaw blast, for now it can be
# canceled easy by enemy's air attack"; "Add activation speed ... add invincible frames ... add a jump cancel to be able
# to chase and hit enemies in the air, and increase the damage"; the lead: "yes!"):
#   first   s: the saw cuts from here (it was 0.25 s: the cuts began after the hop, with the dive)
#   inv     s of invincibility as it starts; armor: Super Armor from `first` for the whole dive (it was Strong, 5)
#   jump    s: from here (the dive's start) a cut that landed in the last 0.3 s lets Jump leave it (an air jump, if
#           she has one). 0.3 s at first: in game she had landed by then when she started the move low
#   dmg     the dive's and the landing's damage budgets (they were 1.5 and 1.3)
BUZZ9 = dict(first=0.14, inv=0.2, armor=9, jump=0.2, dmg=(1.8, 1.5))


def buzzsaw_090(B, port, by):
    import rrb_power
    fp, fv, Z = B.fp, B.fv, BUZZ9
    done = []
    for n in [x for x in by if x.startswith("rrb_buzzsaw") and "_land" not in x]:
        a = by[n]
        if n == "rrb_buzzsaw":
            for h in a.get("HitDataList") or []:
                if fv(h["TickRange"]["Start"]) > Z["first"]: h["TickRange"]["Start"] = fp(Z["first"])
        a["Invincibility"] = [{"TimeRange": {"Start": fp(0.0), "Finish": fp(Z["inv"])}, "ConditionGroup": {"Combine": 0, "Conditions": []},
                               "InvincipalLvlEx": {"UseExpression": 0, "ConstValue": 1, "Expression": {"Source": ""}}}]
        a["Armors"] = [{"TimeRange": {"Start": fp(0), "Finish": fp(Z["first"])}, "Armor": 5},
                       {"TimeRange": {"Start": fp(Z["first"]), "Finish": B.bp.BIG}, "Armor": Z["armor"]}]
        js = rrb_power.air_jump_switch(B, by, Z["jump"], fv(a["TotalDuration"]))
        if js is not None:
            js["ConditionGroup"] = cg(list(js["ConditionGroup"]["Conditions"]) + [port.refs.hit(0.3)])
            a["ActionSwitchs"] = (a.get("ActionSwitchs") or []) + [js]
        done.append(n)
    B.DMG["rrb_buzzsaw"] = (Z["dmg"][0], B.DMG["rrb_buzzsaw"][1]); B.DMG["rrb_buzzsaw_land"] = (Z["dmg"][1], B.DMG["rrb_buzzsaw_land"][1])
    port.note("rrb_buzzsaw", "0.9.0: cuts from %.2f s; invincible 0-%.2f s; Super Armor %d from %.2f s; Jump on a hit from %.2f s; damage %s (%s)" % (
        Z["first"], Z["inv"], Z["armor"], Z["first"], Z["jump"], Z["dmg"], ", ".join(done)))


REAP_RISE = (0.02, 0.08)         # s after Rising Reap's last hit: the window in which a hit lifts her (card 20705)
# 0.9.0 Rifle Shot again from the aiming pose (a tester, 2026-10-07: "it looks silly when the character repeats the
# weapon-deployment animation over and over"). off: how much sooner the re-fire's round leaves than the first shot's
# (s: it skips the unfolding); start..keep: the window after a first shot starts in which Skill fires again from the
# pose (later, she has folded the rifle away and the whole move plays); again..keep_r: the same after a re-fire
REFIRE = dict(off=5 / 60.0, start=0.3, keep=0.62, again=0.22, keep_r=0.54)


def rifle_refire(B, port, by):
    """rrb_rifleshot_r, made from the wired Rifle Shot before the Potentials pass (so the cards make its versions as
    they make the first shot's): everything before the shot's own lead-in is dropped and the rest moves up by
    REFIRE["off"]. Both lose the donor's second camera kick (0.3 s: Noel's shot time, with nothing of hers on it)."""
    import rrb_power
    fp, fv = B.fp, B.fv
    off = REFIRE["off"]
    base = by["rrb_rifleshot"]
    shot = min([fv(r["TimeConfig"]["Start"]) for r in base.get("AddRoles") or []] or [0.167])
    base["CameraShake"] = [c for c in base.get("CameraShake") or [] if abs(float(c["Time"]) - shot) < 0.05]
    a = copy.deepcopy(base); a["Name"] = "rrb_rifleshot_r"
    rrb_power._retime(B, a, lambda t: None if t < off - 0.005 else t - off)
    for key in ("TotalDuration", "AnimateDuration"): a[key] = fp(fv(a[key]) - off)
    a["Animate"] = "%s_longshot_re" % B.ROLE
    by["rrb_rifleshot_r"] = a
    port.note("rrb_rifleshot_r", "0.9.0: Rifle Shot again from the aiming pose: its round at %.3f s (the first shot's at %.3f s), %.2f s long" % (
        shot - off, shot, fv(a["TotalDuration"])))


def gunswing(B, port, by, src):
    """0.9.0, card 20744: every scythe step in GSW_STEPS (and its card versions) opens a window after its last
    strike in which neutral Skill hands over to the step's own shot action, through that shot's input-less row
    (rows_v2). `src`: the Rifle Shot and the Recoil Shot before the cards' parts went onto them. Returns the shots."""
    import rrb_fx, rrb_power, rrb_sound
    fp, fv = B.fp, B.fv
    buff = B.bp.buff
    def off_at(a, b, t=0.0):
        a.setdefault("RemoveBuff", []).append({"Time": fp(t), "TimeConfig": {"StartType": 1, "Start": fp(t), "End": fp(0), "Interval": fp(-1), "NonTimeType": 1}, "BuffName": b})
    def shot_action(step, air):
        base = src["rrb_recoilshot" if air else "rrb_rifleshot"]
        clip = "gsw_air" if air else "gsw"
        a = copy.deepcopy(base); a["Name"] = "rrb_gsw_" + step[4:]
        rounds = sorted(base.get("AddRoles") or [], key=lambda r: fv(r["TimeConfig"]["Start"]))
        off = fv(rounds[0]["TimeConfig"]["Start"]) - GSW["shot"]
        rrb_power._retime(B, a, lambda t: None if t < off - 0.005 else t - off)
        a["Animate"] = "%s_%s" % (B.ROLE, clip)
        L = port.LEN[clip] / 60.0
        a["TotalDuration"] = fp(L); a["AnimateDuration"] = fp(L)
        for key in ("HitDataList", "HitAudios", "HitEffects", "CDList", "ActionSwitchs", "MuteSkills", "Invincibility", "SpeedChanges",
                    "AddBuff", "RemoveBuff", "ScriptCalls", "AddMotions", "Audios"):
            a[key] = []
        a["AddEffects"] = [e for e in a.get("AddEffects") or [] if e["NameEx"]["ConstValue"] in (rrb_fx.MUZZLE, rrb_fx.CASING)]
        for e in a["AddEffects"]:
            if e["NameEx"]["ConstValue"] == rrb_fx.CASING: e["Start"] = fp(GSW["shot"] + 0.07)
        # no recoil slide (Rifle Shot's -10 u/s): she stays where the swing left her
        ss = (a.get("StartSpeed") or {}).get("Speed")
        if ss: ss["x"] = fp(0.0); ss["y"] = fp(0.0)
        role = min(a["AddRoles"], key=lambda r: fv(r["TimeConfig"]["Start"])); role["ConditionGroup"] = cg([])
        role["StartActionEx"][0]["ConstValue"] = rrb_power.GSW_RND["air" if air else "floor"]
        a["AddRoles"] = [role]
        B.sfx(a, rrb_sound.GUNSHOT, GSW["shot"])
        B.sfx(a, rrb_sound.RA.SFX_PREFIX + rrb_sound.CASING, GSW["shot"] + 0.07)
        off_at(a, GSW_ON)
        if air:
            # she holds her height for the shot, then falls; the air jump answers once the string could go on
            a["AddBuff"].append(buff("nogravity_change", 0.0, L))
            a["NextAction"] = "drop"; a["DropAction"] = "drop"
            js = rrb_power.air_jump_switch(B, by, GSW["free"], L)
            if js is not None: a["ActionSwitchs"].append(js)
        by[a["Name"]] = a
        return a["Name"]
    made, wins = [], []
    for step, g in GSW_STEPS.items():
        if step in by: made.append(shot_action(step, g == 4))
    for n, a in list(by.items()):
        step = next((s for s in GSW_STEPS if n == s or n.startswith(s + "_")), None)
        H = a.get("HitDataList") or []
        if step is None or not H: continue
        last = max(H, key=lambda h: fv(h["TickRange"]["Start"]))
        t0 = round(min(fv(last["TickRange"]["End"]), fv(last["TickRange"]["Start"]) + 0.05), 3)
        t1 = round(min(t0 + GSW["win"], fv(a["TotalDuration"]) - 0.05), 3)
        if n == step: GSW_T0[step] = t0; wins.append("%s %.2f-%.2f" % (n, t0, t1))
        a.setdefault("AddBuff", []).append(gate(buff(GSW_ON, 0.0, t1, conds=[T(B, port, "gunswing")])))
        sw = B.bp.switch("rrb_gsw_" + step[4:], [port.refs.input(3, 0, 0.2), port.refs.inputdir(up=1, invert=1), port.refs.inputdir(down=1, invert=1),
                                                  T(B, port, "gunswing")], start_type=1, nt=1, t0=t0, t1=t1, mode=1)
        a["ActionSwitchs"] = [sw] + (a.get("ActionSwitchs") or [])
    for n in B.ALL_BLASTS:      # a Gun Blast out of a step ends its window with it
        if n in by: off_at(by[n], GSW_ON)
    port.note("rrb_a1", "0.9.0 Gunswing (20744): Skill after the strike -> the step's shot (%d MP): %s" % (GSW["mp"], ", ".join(wins)))
    return made


def reap_rise(B, port, by):
    """0.9.0, card 20705 (it made Rising Reap usable in the air): on the floor, a Rising Reap that hits now carries
    her up with the enemy, by the rise 5AAAA already has (rrb_a4_rise: the launched enemy's own speed and gravity; j.A
    from 0.17 s of it, the air jump and the air Rising Reap after that). After every version's last hit, so the
    second hit of 20704 still lands from the floor."""
    fv = B.fv
    if "rrb_a4_rise" not in by: return
    done = []
    for n in [x for x in by if x.startswith("rrb_launcher") and not x.startswith(("rrb_launcher_air", "rrb_launcher_rise"))]:
        a = by[n]; H = a.get("HitDataList") or []
        if not H: continue
        t_ = max(fv(h["TickRange"]["End"]) for h in H)
        sw = B.bp.switch("rrb_a4_rise", [port.refs.hit(0.4), T(B, port, "reap_air")], start_type=1, nt=1,
                         t0=round(t_ + REAP_RISE[0], 3), t1=round(t_ + REAP_RISE[1], 3))
        a["ActionSwitchs"] = [sw] + (a.get("ActionSwitchs") or [])
        done.append("%s %.2f" % (n, t_ + REAP_RISE[0]))
    port.note("rrb_launcher", "0.9.0, with 20705: on a hit she rises with the enemy (rrb_a4_rise) from: %s" % ", ".join(done))


DMG_MUL = {}   # variant -> damage multiplier over its base move's budget (damage_rows)
STEP4 = ("dash3", "dashAir3", "rrb_blast_back_c", "rrb_blast_up_c", "rrb_blast_air_up_c", "rrb_blast_air_back_c")


def extras_v2(B, port, by):
    """Hidden effects 21, 22, 29, 33 (bullets_v2), 35, 36 / 27-Gravity, 37 (after every other blast / move edit, so
    the copies made here carry them)."""
    fp, fv = B.fp, B.fv
    buff = B.bp.buff
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    # hidden 21 (Enhancer + 20722): the fourth blast is its own action (a copy of the chain step, "<name>_4", which
    # blast_rows uses for step 4); it also leaves rrb_enh4, which the next attack spends for another +20 %
    made = []
    for n in STEP4:
        c = copy.deepcopy(by[n]); c["Name"] = n + "_4"
        c.setdefault("AddBuff", []).append(buff(ENH4, 0.0, 1.5 + fv(c["TotalDuration"]) * 0.5, conds=[T(B, port, "enhancer"), T(B, port, "blast_chain")]))
        by[c["Name"]] = c; made.append(c["Name"])
    B.ALL_BLASTS = tuple(B.ALL_BLASTS) + tuple(made)            # the blast CD cleanup and resets see them too
    B.LOCKERS = tuple(B.LOCKERS) + tuple(m for m in made if "Air" in m or "air" in m or "down" in m)
    port.note("dash3_4", "hidden 21: the fourth blast actions %s (rrb_enh4 with Enhancer + 20722)" % made)
    # hidden 22 (20720 + 20721) and the base rule it lifts (KIT_V2 §4: "from Buzzsaw only on hit"): the Buzzsaw row
    # mutes Gun Blast (rows_v2); these switches take the Dash press instead, on a hit within 0.3 s, or always with
    # both cards. Directional blasts first (Down, Up), then forward
    dash = lambda: port.refs.input(55, 0, 0.15)
    for n in [x for x in by if x.startswith("rrb_buzzsaw")]:
        a = by[n]; air = not n.startswith("rrb_buzzsaw_land")
        # (0.9.0: in the air Down + Dash is the dive, rrb_blast_down; the air backward gun-dash has no row any more, and
        #  a skill change to an action without a row does nothing: local_only\cross_effect\rrb_audit_switch.py)
        dirs = ([("rrb_blast_down", port.refs.inputdir(down=1)), ("rrb_blast_air_up", port.refs.inputdir(up=1)), ("dashAir", None)] if air
                else [("rrb_blast_back", port.refs.inputdir(down=1)), ("rrb_blast_up", port.refs.inputdir(up=1)), ("dash", None)])
        sw = []
        for tgt, d in dirs:
            for gate in ([port.refs.hit(0.3)], [T(B, port, "buzzsaw_ex"), T(B, port, "blast_inv")]):
                conds = [dash()] + gate + ([d] if d is not None else [])
                if d is not None and gate is not None:   # a fresh direction ref per switch
                    d = port.refs.inputdir(down=1) if tgt in ("rrb_blast_down", "rrb_blast_back") else port.refs.inputdir(up=1)
                sw.append(B.bp.switch(tgt, conds, start_type=1, nt=1, t0=0.2 if air else 0.0, t1=fv(a["TotalDuration"]), mode=1))
        a["ActionSwitchs"] = sw + (a.get("ActionSwitchs") or [])
        # (0.6.7 game test, 2026-09-30: Attack 0.06-0.11 s into the landing started 5A and cut the landing blast, its round
        #  at 0.1 s and last hit at 0.27-0.35 s: the Buzzsaw row's 0.35 s mute had run out during the short dive, 0.35-0.46
        #  s.) The dive is committed to the ground and the landing until its blast is out (LAND_LOCK); Gun Blast only
        #  through the switches above for the whole move (on hit, or always with 20720 + 20721). Both windows end with the
        #  action (mute_window), so the air part, which ends on landing long before its 2.25 s, locks nothing after it
        dur = fv(a["TotalDuration"])
        a.setdefault("MuteSkills", []).extend(mute_window(B, ["all"], 0.0, dur) if air else mute_window(B, ["all"], 0.0, LAND_LOCK) + mute_window(B, ["5"], 0.0, dur))
        # hidden 23 (20720 + Petal Burst): Attack + Summon, either order within the chord window, at any point of the
        # Buzzsaw -> Petal Burst through its chord row (so its SP cost applies), which is open while X_CHORD_A is lifted
        # (stand / run put the blocker back). Every input row is muted here, so this switch is the way out
        a.setdefault("RemoveBuff", []).append({"Time": fp(0.0), "TimeConfig": {"StartType": 1, "Start": fp(0.0), "End": fp(0), "Interval": fp(-1),
                                                                               "NonTimeType": 1}, "BuffName": X_CHORD_A})
        if SP_INPUTS:
            a["ActionSwitchs"] = [B.bp.switch("rrb_petalburst", [port.refs.input(1, 0, CHORD), port.refs.input(5, 0, CHORD), T(B, port, "buzzsaw_ex"),
                                                                 T(B, port, "petal_burst")], start_type=1, nt=1, t0=0.0, t1=dur, mode=1)] + a["ActionSwitchs"]
    # (0.6.9 game test, 2026-09-30: Hook -> Skill -> Guillotine, then 0.15 s later the same press started Rifle Shot: a
    #  switch leaves its press for the rows, and a Guillotine entered by a switch has none of its row's mutes.) Every
    #  Guillotine action carries its mutes itself ("all" 0.35 s, Gun Blast 0.75 s, the rest to its last strike): the
    #  buffered press (0.2 s) expires under them; entered by its row, the row's values as well
    for n in [x for x in by if x == "rrb_guillotine" or x.startswith("rrb_guillotine_")]:
        # (0.6.11, the lead's play trace: Guillotine again 0.52 s in, Skill's mute over, cutting its last strikes at
        #  0.65-0.75 s.) Attack, Skill, Summon and Jump wait for the last strike; Gun Blast from 0.75 s as before
        lh = round((B.last_hit(by[n]) or 0.75) + 0.05, 2)
        by[n].setdefault("MuteSkills", []).extend(mute_window(B, ["all"], 0.0, 0.35) + mute_window(B, NONBLAST, 0.0, lh) + mute_window(B, ["5"], 0.0, 0.75))
    # hidden 29 (20719 + 20721): an air Gun Blast also clears the air Rising Reap's once-per-airtime limit
    for n in B.ALL_BLASTS:
        if "Air" in n or "air" in n or "down" in n:
            by[n].setdefault("ScriptCalls", []).append(B.bp.call(0.0, "SetActionCD", 'action: "rrb_launcher_air", cd: 0',
                                                                 [T(B, port, "jump_reset"), T(B, port, "blast_inv")]))
    # hidden 35 (20734 + 20737): with Lightning combined with another Dust, each blast discharges in that other element
    for n in B.ALL_BLASTS:
        te = B.travel_end(by[n])
        for m, el in ((1, "fire"), (2, "ice"), (4, "grav")):
            r = B.bp.role(role_t, B.BID, "rrb_spark_" + el, te, 0.0, 0.8)
            r["ConditionGroup"] = cg([port.refs.buff("rrb_dust3"), port.refs.buff("rrb_dust%d" % m), T(B, port, "dust_combine"), T(B, port, "bolt_dust")])
            by[n].setdefault("AddRoles", []).append(r)
    # hidden 36 (Gravity card + Petal Burst): the dash drags every enemy on its path to its end (their hits carry them
    # at the dash's speed, 11 u over 0.4 s); hidden 27 Gravity (20731): enemies are pulled into the path (a pull in)
    def drag(v):
        for h in v["HitDataList"]: push(B, h, x=26.0, y=0.0)
    def pull(v):
        for h in v["HitDataList"]:
            sp_ = (h.get("Victim") or {}).get("Speed") or {}
            if isinstance(sp_.get("x"), dict) and fv(sp_["x"]) > 20.0: continue     # (audit 140053: the pull replaced the drag)
            push(B, h, x=-4.0, y=0.0)
    variant_matrix(B, port, by, "rrb_petalburst", [
        ("grav", lambda: [port.refs.buff("rrb_dust4"), T(B, port, "grav_dust")], drag),
        ("gpull", lambda: [port.refs.buff("rrb_dust4"), T(B, port, "dust_strong")], pull)], lambda n, m: port.note(n, "V2 Potentials: " + m))
    # hidden 37 (Fire card + Enhancer): enhanced by Gun Blast with Fire Dust, Rifle Shot fires the incendiary round
    # (b7_fire: explodes in fire where it hits)
    for n in [x for x in by if x.startswith("rrb_rifleshot")]:
        a = by[n]
        if not a.get("AddRoles"): continue
        for r in list(a["AddRoles"]):
            if (r.get("StartActionEx") or [{}])[0].get("ConstValue") in ("b7", "b7_hc"):
                f = copy.deepcopy(r); f["StartActionEx"][0]["ConstValue"] = "b7_fire"
                f["ConditionGroup"] = cg([port.refs.buff(ENH_DMG), port.refs.buff("rrb_dust1"), T(B, port, "enhancer"), T(B, port, "fire_dust")])
                if (r.get("ConditionGroup") or {}).get("Conditions"): continue   # (a gated round: left as it is)
                # the plain round otherwise: NOT(all four) = any of them false (Combine 1 AnyTrue, inverted checks)
                r["ConditionGroup"] = {"Combine": 1, "Conditions": [port.refs.buff(ENH_DMG, invert=1), port.refs.buff("rrb_dust1", invert=1),
                                       port.refs.trigger(POT["enhancer"] * 10 + 1, invert=1), port.refs.trigger(POT["fire_dust"] * 10 + 1, invert=1)]}
                a["AddRoles"].append(f)
    port.note("rrb_rifleshot", "hidden 37: b7_fire instead of the round when enhanced with Fire Dust (the plain round needs no rrb_enh)")
    # the power stages, the Petal Burst gust, the Buzzsaw EX round (rrb_power.py; the lead, 2026-09-30)
    import rrb_power, sys
    rrb_power.moves(B, port, by, sys.modules[__name__])



# ---------------------------------------------------------------- the last pass over her actions
def final_v2(B, port, by):
    """After every other step (the engine-state fixes, the effect and sound wiring): rrb_power.after_sound calls it just
    before the tree is assembled. What the 2026-10-02 data audit found (local_only/agents/data/DATA_CHECKS.md)."""
    fp, fv = B.fp, B.fv
    tgt = lambda s: (s.get("NewActionEx") or {}).get("ConstValue")
    # stock links the donor's states and dashes kept. Summon -> `summon` on 13 blast actions and the dash ends fired the
    # Summon Tactic with no Dust and no SP (the lead's 0.6.11 play trace: `summon` for 2 ms in a Gun Blast); Attack +
    # Down -> Buzzsaw in the jump / drop states is Double Kick's input. Her rows own both inputs
    n_su = n_bz = 0
    for a in by.values():
        sw = a.get("ActionSwitchs") or []
        keep = [s for s in sw if tgt(s) not in ("summon", "rrb_buzzsaw")]
        n_su += sum(tgt(s) == "summon" for s in sw); n_bz += sum(tgt(s) == "rrb_buzzsaw" for s in sw)
        if len(keep) != len(sw): a["ActionSwitchs"] = keep
    port.note("summon", "stock links removed: %d Summon -> summon, %d Attack + Down -> rrb_buzzsaw" % (n_su, n_bz))
    # 20718 "When you get knocked away, you can press Jump to recover your stance": the stock switch behind the stock
    # triple-jump trigger (11741, which her card adds) was dropped with the donor's other trigger-gated switches
    for n, t0 in (("push_back", 0.25), ("push_back_2", 0.0), ("push_down_2", 0.0)):
        a = by.get(n)
        if a and "reactive" in by:
            a["ActionSwitchs"] = [B.bp.switch("reactive", [port.refs.input(800, 0), port.refs.ground(1), port.refs.trigger(11741)],
                                              start_type=1, nt=1, t0=t0, t1=1.0)] + (a.get("ActionSwitchs") or [])
    # every air blast resets the air string (KIT 4): the back blasts and the fourth steps had no reset
    for n in B.ALL_BLASTS:
        a = by.get(n)
        if a and ("Air" in n or "_air_" in n or "blast_down" in n) and not any(cd.get("ID") == "rrb_ja" for cd in a.get("CDList") or []):
            a.setdefault("CDList", []).append({"Time": fp(0), "ID": "rrb_ja", "Duration": fp(0)})
    # --- commitment (sweep C). Moves entered by a switch, a scan or NextAction get no row mutes, and a row's mutes run
    # in real time while a sped-up or shortened action ends sooner: these carry their own, which end with the action
    rounds = lambda a: [fv(r["TimeConfig"]["Start"]) for r in a.get("AddRoles") or []
                        if ((r.get("StartActionEx") or [{}])[0].get("ConstValue") or "").startswith(("b7", "s4"))]
    for n, a in by.items():
        dur = fv(a["TotalDuration"])
        ms = []
        if n.startswith("rrb_redreaper"):
            # (it inherited Petal Burst's row: every row open at 4.87 s inside its last hits, Gun Blast at 2.25 s)
            ms.extend(mute_window(B, ["all"], 0.0, max(0.5, dur - 0.3)))
        elif n.startswith("rrb_petaldance"):
            # (stage 3: a storm that hits nothing ends at 2.90 s, the row muted everything to 4.68 s)
            ms.extend(mute_window(B, ["all"], 0.0, dur))
        elif n.startswith("rrb_petalburst"):
            import rrb_power
            # Gun Blast from 0.3 s into the gust, in the action's own time (the stage 2 / 3 quick start shortens it; rows
            # are still shut below stage 3 by the rrb_blasting marker)
            ms.extend(mute_window(B, NONBLAST, 0.0, dur) + mute_window(B, ["5"], 0.0, round(rrb_power.GUST_T + rrb_power.PB_BLAST, 2)))
        elif n.startswith("rrb_sypod") or n.startswith("rrb_rifleshot"):
            # every round leaves before another move can cut the skill (Gun Blast, by its row, is the way out):
            # Sy-Pod opened Dust at 0.20 s and Jump at 0.30 s before its first round, Rifle Shot's second round and
            # the stage 3 bursts could be cut by any press
            rs = rounds(a)
            if rs and max(rs) > 0.3: ms.extend(mute_window(B, NONBLAST, 0.0, round(max(rs) + 0.04, 3)))
        elif n.startswith(("rrb_launcher_more", "rrb_launcher_air_more", "rrb_launcher_rise_more")):
            # 20704's second hit (0.33-0.40 s): Jump, Skill and Dust opened at 0.30 s
            ms.extend(mute_window(B, NONBLAST, 0.0, round((B.last_hit(a) or 0.4) + 0.02, 3)))
        if ms: a["MuteSkills"] = (a.get("MuteSkills") or []) + ms
    # --- Buzzsaw EX's landing (sweep A4 / A5): its actions were copied from the tap landing before the effects, sounds
    # and shake were wired, so the EX landings had none of them (no arc, ground hit, flash, ring, casing), while the EX
    # dives (whose BBTAG state runs through the landing) played those at fixed times in mid-air; the round left at
    # 0.05 s, 0.22 s before the landing shot. Now: the landing's pieces from the tap landing, the round with the shot
    src = by.get("rrb_buzzsaw_land")
    if src:
        import rrb_power
        shot = max((fv(h["TickRange"]["Start"]) for h in src.get("HitDataList") or []), default=0.267)
        land_t = min((fv(e["Start"]) for e in src.get("AddEffects") or [] if "muzzle" in e["NameEx"]["ConstValue"]), default=shot)
        for n, a in by.items():
            if not n.startswith("rrb_buzzsaw_land_ex"): continue
            k = next((LAND_K[s] for s in (2, 3) if n.endswith("_s%d" % s)), 1.0)   # (not the saw's x2.4: LAND_K)
            fx = []
            for e in copy.deepcopy(src.get("AddEffects") or []):
                nm = e["NameEx"]["ConstValue"]
                if "muzzle" in nm or "blast_burst" in nm or "blast_ring" in nm:
                    for ax in ("x", "y"): e["Scale"][ax] = fp(fv(e["Scale"][ax]) * 1.35 * k)
                elif "/arc_" in nm or "/trail_" in nm or "ground_hit" in nm:
                    for ax in ("x", "y"): e["Scale"][ax] = fp(fv(e["Scale"][ax]) * k)
                fx.append(e)
            a["AddEffects"] = fx
            a["Audios"] = copy.deepcopy(src.get("Audios") or [])
            a["CameraShake"] = [dict(c, ShakeStr={"x": c["ShakeStr"]["x"] * 1.3, "y": c["ShakeStr"]["y"] * 1.3}) for c in copy.deepcopy(src.get("CameraShake") or [])]
            rs = [r for r in a.get("AddRoles") or [] if ((r.get("StartActionEx") or [{}])[0].get("ConstValue") or "").startswith("b7")]
            if not rs:      # the High Caliber copy was made before the round was added
                role_t = by["rrb_rifleshot"]["AddRoles"][0]
                r = B.bp.role(role_t, B.BID, "b7", land_t, 0.9, 0.55); a.setdefault("AddRoles", []).append(r); rs = [r]
            for r in rs:
                r["TimeConfig"]["Start"] = fp(land_t); r["TimeConfig"]["End"] = fp(land_t)
        # the saw's break-up on touchdown (the kit's rrb_saw_land was built and never named): where the saw was, left in
        # place, on every landing
        for n, a in by.items():
            if not n.startswith("rrb_buzzsaw_land"): continue
            k = next((LAND_K[s] for s in (2, 3) if n.endswith("_s%d" % s)), 1.0)   # (not the saw's x2.4: LAND_K)
            if not any(e["NameEx"]["ConstValue"].endswith("/rrb_saw_land") for e in a.get("AddEffects") or []):
                a.setdefault("AddEffects", []).append(dict(B.fx_entry(port, "Role/Rrb/rrb_saw_land", 0.0, scale=SAW_SCALE * k, dx=0.05, dy=1.0, attached=False), KillMode=1))
        landed = {e["NameEx"]["ConstValue"] for e in src.get("AddEffects") or []}
        # the dive's spin is drawn by her own saw (fxkit_cross rrb_saw, made for her 2026-10-02): BBTAG's looping spin
        # arcs (arc_rrb408*) played over it, brighter than it, as a second effect for the same motion
        for n, a in by.items():
            if n == "rrb_buzzsaw" or n.startswith("rrb_buzzsaw_ex"):
                a["AddEffects"] = [e for e in a.get("AddEffects") or [] if "/arc_rrb408" not in e["NameEx"]["ConstValue"].lower()]
        for n, a in by.items():
            if not (n == "rrb_buzzsaw_ex" or n.startswith("rrb_buzzsaw_ex_")): continue
            # the landing's pieces leave the dive (the spin's own arcs, saw and petals stay)
            gone = lambda nm: (nm in landed and "rrb_saw" not in nm) or any(k_ in nm for k_ in ("ground_hit", "muzzle", "blast_ring", "casing", "skid"))
            a["AddEffects"] = [e for e in a.get("AddEffects") or [] if not gone(e["NameEx"]["ConstValue"])]
            a["Audios"] = [x for x in a.get("Audios") or [] if float(x.get("Time") or 0) < 0.6]
            a["CameraShake"] = [c for c in a.get("CameraShake") or [] if float(c.get("Time") or 0) < 0.6]
        port.note("rrb_buzzsaw_land_ex", "EX landings carry the tap landing's effects, sounds and shake; the round leaves with the shot (%.3f s)" % land_t)


# ---------------------------------------------------------------- her new projectiles (bullet tree)
def gravity_rounds(B, port, btree):
    """0.8.0 (the lead, 2026-10-03: "let gravity dust effect trigger from her bullets and make it better and stronger").
    With Gravity Dust loaded, every round of hers that hits an enemy opens a gravity well on it: Rifle Shot, Sy-Pod,
    the Dust Round, j.C's round, Gun Blast's rounds (the actions rrb_power.DUST_GUN_RE names; not their breaks). One
    well per enemy at a time: the hit enemy carries a marker (GW_MARK) for GWELL["again"] s, and a round that hits it
    meanwhile opens nothing (the stock CreateBullet target_limit / target_limit_buff). The round checks HER buff
    (IncludeRootCaster, as rrb_fx.dust_variants). Until 0.7 only Rising Reap and Guillotine opened a well, and only with
    the Gravity card (20738); they still do.
    (In game, rsuite fb2_grav_*, first try with `limit:1`: the first well of the battle came and no later one. That
    limit counts on her, the root caster, and nothing resets it: stock actions reset theirs with SetExtParams.)"""
    import re
    import rrb_power
    rx = re.compile(rrb_power.DUST_GUN_RE)
    n = 0
    for a in btree["_actions"]:
        if not rx.search(a["Name"]): continue
        # (0.9.0: the well is opened by rrbDustHit, src/rrb_runtime.js, which keeps the one-per-enemy time itself. The
        #  engine's own limit, CreateBullet target_limit + target_limit_buff, did not hold in game: two wells stacked.)
        n += len(a.get("HitDataList") or [])
    port.note(B.BLOGIC, "Gravity Dust: %d round hits open a gravity well (%.1f s, %.1f u wide, pull %.0f u/s, then its collapse)" % (
        n, GWELL["dur"], GWELL["box"][2] - GWELL["box"][0], GWELL["pull"]))
    return n


def bullets_v2(B, port, by, btree):
    """rrb_petalzone(2), rrb_cartblast1-4, rrb_dustburst, rrb_dustround, rrb_spark, rrb_flame, rrb_icespike, rrb_gwell,
    and the round variants: b7_hc / s4_hc (High Caliber, and the enhanced Rifle Shot), s4end_x (hidden 7)"""
    fp, fv = B.fp, B.fv
    A = {a["Name"]: a for a in btree["_actions"]}
    base = copy.deepcopy(A.get("b7end") or A.get("s4end"))
    def zone(name, dur, box, interval, fx, feel="light", scale=1.0, hits=None):
        a = copy.deepcopy(base); a["Name"] = name
        a["TotalDuration"] = fp(dur); a["AnimateDuration"] = fp(dur); a["NextAction"] = ""
        a["ActionSwitchs"] = []; a["AddRoles"] = []; a["AddBuff"] = []; a["ScriptCalls"] = []
        # (audit A1: every zone, the 28 stage slashes included, kept the round break's camera shake 0.5 / 0.5 for 0.2 s
        #  and its sound at spawn, hit or miss; her heaviest shot shakes 0.34.) A zone is silent and still unless it
        #  says otherwise below
        a["CameraShake"] = []; a["Audios"] = []
        h = B.hit(port, feel, 0.0, dur if interval else 0.05, box, "skill")
        h["HitBox"] = {"Min": {"x": fp(box[0]), "y": fp(box[1])}, "Max": {"x": fp(box[2]), "y": fp(box[3])}}   # exact (no attack floor)
        if interval: h["TickRange"]["HitInterval"] = fp(interval)
        # (0.6.10 game test, 2026-09-30: an ice spike hit 0.09 s after the Freeze and ended it, as any hit ends the stock
        #  Freeze, so the shatter and the Ice card's bonus never came.) Her secondary effects skip a target her Freeze
        #  holds (the actor tag rrbFreezeGo sets): only her own attacks break it
        h["ExcludeTags"] = list(h.get("ExcludeTags") or []) + ["rrb_frozen"]
        a["HitDataList"] = [h]
        a["AddEffects"] = [dict(B.fx_entry(port, f, 0.0, scale=scale, attached=True), KillMode=1) for f in fx]
        btree["_actions"].append(a); A[name] = a
        return a
    zone("rrb_petalzone", 1.0, [-0.9, 0.0, 0.9, 1.4], 0.25, ["Role/Rrb/rrb_petals"])
    zone("rrb_petalzone2", 1.6, [-1.1, 0.0, 1.1, 1.6], 0.25, ["Role/Rrb/rrb_petals", "Role/Rrb/rrb_petals"], scale=1.2)
    BOOM = base.get("Audios") or []                                          # the break's own sound, for the blasts
    def boom(a, t, k):
        a["Audios"] = [dict(copy.deepcopy(x), Time=float(t)) for x in BOOM[:1]]
        a["CameraShake"] = [{"Time": float(t), "ShakeStr": {"x": k, "y": k}, "Duration": 0.15}]
    boom(zone("rrb_dustburst", 0.3, [-2.5, -0.5, 2.5, 2.8], None, ["Role/Rrb/rrb_blast_burst"], "knock", scale=1.6), 0.0, 0.22)
    # the element pieces use BBEE's own element effects where one fits (seen in fxview 2026-09-29): the Blessings'
    # fire wall (Common/buff_628, firebullet "fire3"), fire eruption (benediction_fire_17, "huozhong_boom"), ground
    # ice spikes (buff_ice_006 + Common/buff_608_03, icebullet "ground_thorn"), black hole (benediction_dark_019,
    # darkbullet "Heidong_open": BBEE's teal Umbra, not her violet Gravity palette, flagged). Lightning keeps her own
    # yellow (BBEE's lightning is blue).
    zone("rrb_spark", 0.3, [-1.2, -0.3, 1.2, 2.2], None, ["Role/Rrb/rrb_hit_gun_bolt", "Role/Rrb/rrb_blast_burst_bolt"], "light")
    zone("rrb_flame", 1.2, [-1.6, 0.0, 1.6, 1.2], 0.25, ["Common/buff_628"], "light")
    boom(zone("rrb_erupt", 0.5, [-1.6, -0.3, 1.6, 2.2], None, ["Benediction/Fire/benediction_fire_17"], "knock"), 0.0, 0.2)
    zone("rrb_icespike", 0.6, [-1.6, 0.0, 1.6, 1.4], None, ["Benediction/Ice/buff_ice_006", "Common/buff_608_03", "Role/Rrb/rrb_hit_gun_ice"], "launch")
    # her own violet well (fxkit_cross rrb_gwell) once the effect pack has it; else BBEE's black hole, as before
    import os as _os
    _fm = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "fx", "fxmap.json")
    GWELL_FX = "Role/Rrb/rrb_gwell" if _os.path.exists(_fm) and "rrb_gwell" in open(_fm, encoding="utf-8").read() else "Benediction/Dark/benediction_dark_019"
    # (0.8.0, the lead, 2026-10-03: "let gravity dust effect trigger from her bullets and make it better and stronger".)
    # The well was 1.5 s, 3.6 u wide, pulled at 3 u/s and its six ticks dealt 0.2 in all. GWELL: longer, wider, a harder
    # pull, ticks that count, and it ends in a collapse (rrb_gwell_end) that launches what it gathered. Her rounds open
    # it where they hit (gravity_rounds)
    zone("rrb_gwell", GWELL["dur"], list(GWELL["box"]), GWELL["tick"], [GWELL_FX], "light", scale=GWELL["fx"])
    for e in A["rrb_gwell"]["AddEffects"]: e["KillMode"] = 0          # the black hole loops: it goes with the well
    ge = zone("rrb_gwell_end", 0.3, list(GWELL["end_box"]), None, ["Role/Rrb/rrb_blast_burst_grav", "Role/Rrb/rrb_hit_gun_grav"], "launch", scale=GWELL["end_fx"])
    boom(ge, 0.0, 0.2)
    A["rrb_gwell"]["NextAction"] = "rrb_gwell_end"
    # BBEE's buff effects loop (they are auras). With KillMode 1 (ignore) the Ice card's crystals stayed floating
    # where a round broke, for minutes (0.6.2 game test, 2026-09-30). Each gets the life it needs (OverrideFXLifeTime,
    # as stock does on 190+ entries), and the ice spikes and their ring stand on the floor under the hit (OnGround:
    # stock sets it on landing and ground effects, e.g. Es's fall end, Hakumen's throw landing, fire roads)
    LIFE = {"Benediction/Ice/buff_ice_006": 1.2, "Common/buff_608_03": 1.0, "Common/buff_628": 1.3,
            "Benediction/Fire/benediction_fire_17": 1.2}
    for n in ("rrb_icespike", "rrb_flame", "rrb_erupt"):
        for e in A[n]["AddEffects"]:
            nm = e["NameEx"]["ConstValue"]
            if nm in LIFE: e["OverrideFXLifeTime"] = fp(max(LIFE[nm], fv(A[n]["TotalDuration"])))
            # (the fire pool too: hidden 33 spawns it where the spent Fire cartridge bursts, at her waist; the game test
            #  showed a 2 u fire wall on her that never went out)
            if n in ("rrb_icespike", "rrb_flame") and not nm.startswith("Role/Rrb/"): e["OnGround"] = 1
    for h in A["rrb_gwell"]["HitDataList"]: push(B, h, x=-GWELL["pull"], y=0.0)   # pulls toward its centre
    for m, fx in ((1, "_fire"), (2, "_ice"), (3, "_bolt"), (4, "_grav")):
        a = zone("rrb_cartblast%d" % m, 0.9, [-1.2, -0.3, 1.2, 1.6], None, [], "knock")
        a["HitDataList"][0]["TickRange"]["Start"] = fp(0.55); a["HitDataList"][0]["TickRange"]["End"] = fp(0.6)
        a["AddEffects"] = [dict(B.fx_entry(port, "Role/Rrb/rrb_hit_gun" + fx, 0.55, attached=True), KillMode=1)]
        boom(a, 0.55, 0.2)                                                        # with the blast, not at the spawn
        # the Dust's own status (Burn, Cold, Shock, Curse); hidden 34 (with the Ice card): the Ice cartridge Freezes
        st = {1: "1116", 2: "2102", 3: "10001", 4: "1125"}[m]
        h0 = a["HitDataList"][0]
        h0.setdefault("AttackerCalls", []).append(attacker_call(B, "AddBuff", 'buff:"%s",durOverride:3,hit_target:1' % st))
        if m == 2:
            # (the stock Freeze added inside the hit ends with the hit's reaction: NOTES 2026-09-30; rrb_frz adds it 0.05 s later)
            h0["AttackerCalls"].append(attacker_call(B, "AddBuff", 'buff:"rrb_frz",durOverride:0.3,hit_target:1', [T(B, port, "ice_dust")]))
    for el, st in (("fire", "1116"), ("ice", "2102"), ("grav", "1125")):   # hidden 35: a discharge in the other element
        z = zone("rrb_spark_" + el, 0.3, [-1.2, -0.3, 1.2, 2.2], None, ["Role/Rrb/rrb_hit_gun_" + el, "Role/Rrb/rrb_blast_burst_" + el], "light")
        z["HitDataList"][0].setdefault("AttackerCalls", []).append(attacker_call(B, "AddBuff", 'buff:"%s",durOverride:3,hit_target:1' % st))
    # hidden 33 (20733 + 20735): the spent Fire cartridge leaves a pool of flames where it bursts
    role_t = by["rrb_rifleshot"]["AddRoles"][0]
    r = B.bp.role(role_t, B.BID, "rrb_flame", 0.55, 0.0, 0.0); r["ConditionGroup"] = cg([T(B, port, "fire_dust")])
    A["rrb_cartblast1"].setdefault("AddRoles", []).append(r)
    # the Dust round: the Rifle Shot's round (her Dust palette rides it: rrb_fx.dust_variants on the tree)
    r = copy.deepcopy(A["b7"]); r["Name"] = "rrb_dustround"; btree["_actions"].append(r); A["rrb_dustround"] = r
    # High Caliber rounds: 1.5x box, 1.4x round, pushed 1.5x further; the rounds switch to them at their start
    for src, dst in (("b7", "b7_hc"), ("s4", "s4_hc")):
        v = copy.deepcopy(A[src]); v["Name"] = dst
        for h in v["HitDataList"]:
            hb = h["HitBox"]
            for c in ("Min", "Max"):
                for ax in ("x", "y"): hb[c][ax] = B.fp(B.fv(hb[c][ax]) * 1.5)
            push(B, h, kx=1.5)
        for e in v.get("AddEffects") or []:
            for ax in ("x", "y"): e["Scale"][ax] = fp(fv(e["Scale"][ax]) * 1.4)
        v["ActionSwitchs"] = [s for s in v.get("ActionSwitchs") or [] if (s.get("NewActionEx") or {}).get("ConstValue") != dst]
        btree["_actions"].append(v); A[dst] = v
        A[src]["ActionSwitchs"] = [B.bp.switch(dst, [T(B, port, "high_caliber")], start_type=1, nt=1, t0=0.0, t1=0.05)] + (A[src].get("ActionSwitchs") or [])
    dh = copy.deepcopy(A["b7_hc"]); dh["Name"] = "rrb_dustround_hc"
    dh["ActionSwitchs"] = [s for s in dh.get("ActionSwitchs") or [] if (s.get("NewActionEx") or {}).get("ConstValue") != "b7_hcp"]
    btree["_actions"].append(dh); A["rrb_dustround_hc"] = dh
    A["rrb_dustround"]["ActionSwitchs"] = [B.bp.switch("rrb_dustround_hc", [T(B, port, "high_caliber")], start_type=1, nt=1, t0=0.0, t1=0.05)] + \
                                          [s for s in A["rrb_dustround"].get("ActionSwitchs") or [] if (s.get("NewActionEx") or {}).get("ConstValue") != "b7_hc"]
    # hidden 6 (High Caliber + 20710): the high-calibre Rifle Shot round pierces (its switch to the break on hit goes)
    p = copy.deepcopy(A["b7_hc"]); p["Name"] = "b7_hcp"
    p["ActionSwitchs"] = [s for s in p.get("ActionSwitchs") or [] if "end" not in ((s.get("NewActionEx") or {}).get("ConstValue") or "")]
    for h in p["HitDataList"]: h["PreventHitBySameBoxIdDuration"] = fp(0.0)   # (round_rules sets every round's hold)
    btree["_actions"].append(p); A["b7_hcp"] = p
    A["b7_hc"]["ActionSwitchs"] = [B.bp.switch("b7_hcp", [T(B, port, "rifle_two")], start_type=1, nt=1, t0=0.0, t1=0.05)] + (A["b7_hc"].get("ActionSwitchs") or [])
    # hidden 37: the incendiary round (the high-calibre round; its break erupts in fire)
    fe = copy.deepcopy(A["b7end"]); fe["Name"] = "b7_fireend"
    fe.setdefault("AddRoles", []).append(B.bp.role(by["rrb_rifleshot"]["AddRoles"][0], B.BID, "rrb_erupt", 0.0, 0.0, -0.8))
    btree["_actions"].append(fe); A["b7_fireend"] = fe
    f = copy.deepcopy(A["b7_hc"]); f["Name"] = "b7_fire"
    f["ActionSwitchs"] = [s_ for s_ in f.get("ActionSwitchs") or [] if (s_.get("NewActionEx") or {}).get("ConstValue") != "b7_hcp"]
    for s_ in f["ActionSwitchs"]:
        if (s_.get("NewActionEx") or {}).get("ConstValue") == "b7end": s_["NewActionEx"]["ConstValue"] = "b7_fireend"
    btree["_actions"].append(f); A["b7_fire"] = f
    # hidden 7 (High Caliber + 20711): Sy-Pod's rounds explode on impact (their break: a 2.5 u blast)
    x = copy.deepcopy(A["s4end"]); x["Name"] = "s4end_x"
    for h in x["HitDataList"]:
        h["HitBox"] = {"Min": {"x": fp(-1.25), "y": fp(-1.0)}, "Max": {"x": fp(1.25), "y": fp(1.5)}}
    x["AddEffects"] = (x.get("AddEffects") or []) + [dict(B.fx_entry(port, "Role/Rrb/rrb_blast_burst", 0.0, scale=1.3, attached=True), KillMode=1)]
    btree["_actions"].append(x); A["s4end_x"] = x
    for s in A["s4_hc"].get("ActionSwitchs") or []:
        if (s.get("NewActionEx") or {}).get("ConstValue") == "s4end":
            s2 = copy.deepcopy(s); s2["NewActionEx"]["ConstValue"] = "s4end_x"
            s2["ConditionGroup"]["Conditions"] = s2["ConditionGroup"]["Conditions"] + [T(B, port, "sypod_three")]
            A["s4_hc"]["ActionSwitchs"].insert(0, s2); break
    # hidden 27 (Ice, 20731): Sy-Pod's rounds Freeze on hit while Ice Dust is loaded (stock Freeze 2101, 1.5 s)
    for n in ("s4", "s4_hc"):
        for h in A[n]["HitDataList"]:
            ib = port.refs.buff("rrb_dust2"); port.refs.items[-1]["data"]["IncludeRootCaster"] = 1
            h.setdefault("AttackerCalls", []).append(attacker_call(B, "AddBuff", 'buff:"rrb_frz",durOverride:0.3,trigger:%d,hit_target:1' % (POT["dust_strong"] * 10 + 1), [ib]))
    # Ice card (20736): shots leave ice spikes where they hit (the rounds' breaks spawn rrb_icespike)
    for n in ("b7end", "s4end", "s4end_x"):
        if n not in A: continue
        ib = port.refs.buff("rrb_dust2"); port.refs.items[-1]["data"]["IncludeRootCaster"] = 1
        role_t = by["rrb_rifleshot"]["AddRoles"][0]
        r = B.bp.role(role_t, B.BID, "rrb_icespike", 0.0, 0.0, 0.0); r["ConditionGroup"] = cg([ib, T(B, port, "ice_dust")])
        A[n].setdefault("AddRoles", []).append(r)
    # A round that reaches its range ends through a last action: its glow (KillMode 2: gone when the action changes) then
    # goes with it. (Game review 2026-10-02: the last round of a burst stopped at its range and hung there 0.55 s
    # fading; rounds that hit or meet a wall already change action, to their break.)
    out = zone("rrb_roundout", 0.05, [0.0, 0.0, 0.1, 0.1], None, []); out["HitDataList"] = []
    for n in ("b7", "b7_hc", "b7_hcp", "b7_fire", "rrb_dustround", "rrb_dustround_hc", "s4", "s4_hc", "TS_round1", "TS2007011", "TS2007012"):
        if n in A and not A[n].get("NextAction"): A[n]["NextAction"] = "rrb_roundout"
    import rrb_power
    rrb_power.bullets(B, port, by, btree, zone)
    port.note(B.BLOGIC, "V2 projectiles: petal zones, Dust burst / round, spark, flame, ice spike, gravity well, cartridge blasts, "
                        "High Caliber rounds (b7_hc, b7_hcp, s4_hc, s4end_x)")


# ---------------------------------------------------------------- input rows
def rows_v2(B, port, by):
    """Group 1 (ground Attack), 4 (air Attack), 8 (hold Attack), 2 (Skill), 3 (Ultra) with the Potential rows.

    Rows are listed with symbolic keys in precedence order (a checked or Potential-gated row before the plain row it
    overrides: the engine takes the first matching row); orders are then numbered 1.. per group in that sequence and
    each PreSkillOrder is resolved from the keys (a key names the plain row and its gated twins). The loader needs a
    unique (actor, group, order) per row."""
    fv, xrow = B.fv, B.xrow
    MP = lambda cost: [{"Slot": 2, "Limit": str(cost), "MpChange": -float(cost)}]
    SP = lambda n: [{"Slot": 3, "Limit": str(n), "MpChange": -float(n)}]
    L = lambda n: fv(by[n]["TotalDuration"])
    cad = lambda n, lo: round(max(lo, B.last_hit(by[n]) + 0.08), 2)
    nxt = lambda n, lo: round(max(lo, B.last_hit(by[n]) + 0.03), 2)
    blast = lambda n: round(B.first_hit(by[n]) or 0.01, 2)
    # a string step's chain window (from its start): while the move plays, and at least 0.2 s past its cadence. (To
    # 0.6.11 it was the move's length + 0.3-0.45 s: a press well after the move had ended still continued the string;
    # the lead: "dropped strings continuing after their continuation window should have expired". Stock strings close
    # 0.1-0.35 s after the step's cadence: Ragna 0.35 -> 0.5 s, Noel 0.35 -> 0.5 s)
    win = lambda n: round(max(L(n) + 0.05, cad(n, 0.25) + 0.2, 0.5), 2)      # (0.5: the stock first steps' window)
    P = lambda *ks: [POT[k] for k in ks]
    def chk(r, buff): r["PreScriptCall"] = "CheckBuffStack"; r["PreScriptCallParams"] = 'buff: "%s", buff_stack: 1' % buff; return r
    R, KEY, PRE = [], {}, {}
    def add(key, r, pre=None):
        R.append(r); KEY[id(r)] = key
        if pre: PRE[id(r)] = pre
        return r
    STR = ["a1", "a2", "a3", "5b", "5bb"]              # the string steps Up / Down may follow
    g1 = lambda *a, **k: xrow(1, 0, *a, **k)
    # ---- group 1 (ground Attack), in precedence order
    add("up", g1("rrb_launcher", "Attack", 1, req=P("reap"), precheck=True, strict=cad("rrb_launcher", 0.45), all_=0.3, jump=0.3, own={1: 0.5}, timeout=0, addcd=0.5, dash=blast("rrb_launcher")))
    # 20707: 2A -> 2C with Attack (any direction); the sweep then opens Skills early (0.15 s)
    add("2c", g1("rrb_sweep", "Attack", None, start=False, req=P("sweep_open"), strict=cad("rrb_sweep", 0.4), all_=0.3, jump=0.25, own={1: 0.45, 2: 0.22}, timeout=win("rrb_sweep"), addcd=0.45, dash=blast("rrb_sweep")), ["2a"])
    # 20708 Rising Crescent: Low Sweep -> Attack
    add("2b", g1("rrb_2b", "Attack", None, start=False, req=P("rising_crescent"), strict=cad("rrb_2b", 0.45), all_=0.35, jump=0.3, timeout=win("rrb_2b"), dash=blast("rrb_2b")), ["down", "down_s", "2c"])
    # hidden 16 (Rising Crescent + 20705): 2B -> a rising Rising Reap
    # (2026-10-02 game test: air="both" let this row take j.B's press after the rising 2B > j.A, which broke the air
    #  string the lead asked for; with 2B rising, Attack after it is the air string, and hidden 16 needs a grounded 2B)
    add("rise", g1("rrb_launcher_rise", "Attack", None, start=False, exit_=True, req=P("rising_crescent", "reap_air"), strict=cad("rrb_launcher_rise", 0.45), all_=0.3, jump=0.3, timeout=0, addcd=0.5, dash=blast("rrb_launcher_rise")), ["2b"])
    add("2a", g1("rrb_2a", "Attack", 2, req=P("sweep_open"), strict=cad("rrb_2a", 0.22), all_=0.2, jump=0.2, timeout=win("rrb_2a"), dash=blast("rrb_2a")))
    add("down", g1("rrb_sweep", "Attack", 2, strict=cad("rrb_sweep", 0.4), all_=0.3, jump=0.25, own={1: 0.45}, timeout=win("rrb_sweep"), addcd=0.45, dash=blast("rrb_sweep")))
    add("up_s", g1("rrb_launcher", "Attack", 1, start=False, exit_=True, req=P("reap"), precheck=True, strict=cad("rrb_launcher", 0.45), all_=0.3, jump=0.3, own={1: 0.5}, timeout=0, addcd=0.5, dash=blast("rrb_launcher")), STR)
    add("down_s", g1("rrb_sweep", "Attack", 2, start=False, strict=cad("rrb_sweep", 0.4), all_=0.3, jump=0.25, own={1: 0.45}, timeout=win("rrb_sweep"), addcd=0.45, dash=blast("rrb_sweep")), STR)
    # the strings. hidden 31 (20701 + 20702 + 20703): Gun Blast at any strike (a twin row first, blast mute 0.05 s)
    def string(key, r, pre=None):
        r2 = copy.deepcopy(r)
        r2["ReqTriggerId"] = (r2.get("ReqTriggerId") or []) + [x for x in P("a3_drag", "scythe_chain", "a4_pass") if x not in (r2.get("ReqTriggerId") or [])]
        v = r2["Mutelist"].split('"5":')[1].split(",")[0]
        r2["Mutelist"] = r2["Mutelist"].replace('"5":' + v, '"5":0.05')
        add(key, r2, pre)
        add(key, r, pre)
    string("a1", g1("rrb_a1", "Attack", strict=cad("rrb_a1", 0.25), all_=nxt("rrb_a1", 0.22), jump=0.2, own={8: 0.3}, timeout=win("rrb_a1"), dash=blast("rrb_a1")))
    # 5AA: with Scythe Chain (20702) its chain window closes at 0.5 s (the pause); the press after it is 5AA's switch
    string("a2", g1("rrb_a2", "Attack", start=False, req=P("scythe_chain"), strict=cad("rrb_a2", 0.36), all_=nxt("rrb_a2", 0.25), jump=0.2, own={8: 0.3}, timeout=0.5, addcd=0.45, dash=blast("rrb_a2")), ["a1"])
    string("a2", g1("rrb_a2", "Attack", start=False, strict=cad("rrb_a2", 0.36), all_=nxt("rrb_a2", 0.25), jump=0.2, own={8: 0.3}, timeout=win("rrb_a2"), dash=blast("rrb_a2")), ["a1"])
    # 20702 Scythe Chain 5B: no input (only 5AA's pause switch starts it, as Corkscrew's rows)
    string("5b", g1("rrb_5b", None, start=False, req=P("scythe_chain"), strict=cad("rrb_5b", 0.4), all_=nxt("rrb_5b", 0.3), jump=0.25, own={8: 0.3}, timeout=win("rrb_5b"), dash=blast("rrb_5b")))
    string("a3", g1("rrb_a3", "Attack", start=False, strict=nxt("rrb_a3", 0.4), all_=nxt("rrb_a3", 0.3), jump=0.25, own={8: 0.3}, timeout=win("rrb_a3"), dash=blast("rrb_a3")), ["a2"])
    # (a tester, 2026-10-03: "her ground combo doesn't have recovery after the last hit, allowing to chain into another
    #  ground basic combo". Every group but the blast opened at 0.35 s, in the middle of the pass (its hit runs to 0.5 s,
    #  the move to 0.97 s). The finisher now keeps Attack shut for A4_RECOVER, as the stock finishers do (Noel's string
    #  end: "1":0.8). Gun Blast, Jump and Skills cancel it as before.)
    string("a4", g1("rrb_a4", "Attack", start=False, exit_=True, strict=round(L("rrb_a4"), 2), all_=0.35, jump=0.3, own={1: A4_RECOVER, 8: A4_RECOVER},
                    timeout=0, addcd=0.7, dash=blast("rrb_a4")), ["a3"])
    # hidden 12 (Scythe Chain + 20704): the second sweep flows into Rising Reap on Attack (after 5BB, before its end)
    add("5bbr", g1("rrb_launcher", "Attack", None, start=False, exit_=True, req=P("scythe_chain", "reap_more"), strict=cad("rrb_launcher", 0.45), all_=0.3, jump=0.3, timeout=0, addcd=0.5, dash=blast("rrb_launcher")), ["5bb"])
    string("5bb", g1("rrb_5bb", "Attack", start=False, req=P("scythe_chain"), strict=cad("rrb_5bb", 0.45), all_=nxt("rrb_5bb", 0.35), jump=0.3, timeout=win("rrb_5bb"), dash=blast("rrb_5bb")), ["5b"])
    # ---- group 4 (air Attack)
    g4 = lambda *a, **k: xrow(4, 0, *a, **k)
    # (0.8.0, a tester's suggestion, 2026-10-03: Double Kick "doesn't appear to serve a purpose initially, until
    #  obtaining Rising Crescent. Maybe it could become part of the Rising Crescent Potential instead of being by itself".
    #  It comes with that card now; without it, Down + Attack in the air is the air string's first step.)
    add("j2a", chk(g4("rrb_j2a", "Attack", 2, air=True, req=P("rising_crescent"), strict=cad("rrb_j2a", 0.35), all_=0.3, jump=0.25, dash=blast("rrb_j2a")), J2A_SPENT))
    add("jup", g4("rrb_launcher_air", "Attack", 1, air=True, req=P("reap_air"), strict=cad("rrb_launcher_air", 0.45), all_=0.3, jump=0.3, precheck=True, timeout=0, addcd=0.3, dash=blast("rrb_launcher_air")))
    # (0.6.7 game test, 2026-09-30: Up + Attack during j.A gave j.B, the air chain's next step taking the press whatever
    #  the direction.) The air string's own Up + Attack step, as the ground's up_s: j.A / j.B / j.2A -> air Rising Reap
    add("jup_s", g4("rrb_launcher_air", "Attack", 1, air=True, start=False, exit_=True, req=P("reap_air"), strict=cad("rrb_launcher_air", 0.45), all_=0.3, jump=0.3, precheck=True, timeout=0, addcd=0.3, dash=blast("rrb_launcher_air")), ["ja", "jb", "j2a"])
    add("ja", g4("rrb_ja", "Attack", air=True, strict=cad("rrb_ja", 0.3), all_=nxt("rrb_ja", 0.25), jump=0.2, timeout=win("rrb_ja"), precheck=True, dash=blast("rrb_ja")))
    add("jb", g4("rrb_jb", "Attack", air=True, start=False, strict=cad("rrb_jb", 0.36), all_=nxt("rrb_jb", 0.25), jump=0.2, timeout=win("rrb_jb"), dash=blast("rrb_jb")), ["ja"])
    # (0.9.0: j.C fires three times; Jump, the air Skill and the rest open right after its last shot, a Gun Blast
    #  from its first shot as before. rrb_power.JC3)
    import rrb_power as _rp
    jc_t = _rp.JC_TIMES.get("rrb_jc")
    jc_free = round(jc_t[2] + _rp.JC3["free"], 2) if jc_t else 0.35
    add("jc", g4("rrb_jc", "Attack", air=True, start=False, exit_=True, strict=round(L("rrb_jc"), 2), all_=jc_free, jump=jc_free if jc_t else 0.3,
                 timeout=0, addcd=0.5, dash=round(jc_t[0] + 0.02, 2) if jc_t else blast("rrb_jc")), ["jb"])
    # ---- group 8: hold Attack = Clash Assault (with 20709 it charges while held: the switch inside the action)
    add("clash", xrow(8, 0, "rrb_clash", "Attack", 5, air=False, strict=0.36, all_=0.3, jump=0.3, own={8: 1.2}, long=(0.25, 0.7), timeout=1.2, dash=blast("rrb_clash")))
    # (the lead, 2026-10-02: "charged attack wont come out if your moving forward running": the row took neutral only
    #  (InputDir 5); forward is direction 3, as the Gravity reload's row)
    add("clash_fwd", xrow(8, 0, "rrb_clash", "Attack", 3, air=False, strict=0.36, all_=0.3, jump=0.3, own={8: 1.2}, long=(0.25, 0.7), timeout=1.2, dash=blast("rrb_clash")))
    # ---- group 2: Skills (MP only), the checked / cheaper rows first
    def sk(key, act, d, air, cost, req=None, check=None, extra=None):
        r = xrow(2, 0, act, "Skill", d, air=air, strict=cad(act, 0.5), all_=0.35, jump=0.3, own={2: 0.5, 11: 0.2}, mps=MP(cost),
                 req=req, sat=[2], timeout=round(L(act) + 0.3, 2), dash=B.skill_blast(by, act))
        if check: chk(r, check)
        if extra: r["Mutelist"] += extra
        add(key, r)
    G = B.SKILL_MP["rrb_guillotine"]
    # the SP moves on stock inputs (Ragna's Ultra: Down + Skill at full SP, group 2, before his Down + Skill move)
    def spm(key, act, d, cost, req, check=None, pre=None, inp="Skill", refund=0):
        import rrb_power
        blast_at = round(rrb_power.GUST_T + rrb_power.PB_BLAST, 2) if act == "rrb_petalburst" else round(L(act), 2)
        # (audit C2 / C3: the rows muted everything for the full move in real time; a stage 3 Petal Dance that hits
        #  nothing ends 1.8 s sooner, a quick-started Petal Burst 0.35-0.56 s sooner, and she stood with no row
        #  available.) The actions mute for their own length (final_v2); the rows only cover their first frames
        r = xrow(2, 0, act, inp, d, air="both", strict=0.6, all_=0.35, jump=None, dash=0.35,
                 mps=SP(cost) + ([{"Slot": 2, "MpChange": float(refund)}] if refund else []), req=req, sat=[2, 11] if inp else None,
                 start=bool(inp), timeout=round(L(act) + 0.3, 2))
        if check: chk(r, check)
        add(key, r, pre)
    # (0.6.0 game test: a row whose CheckBuffStack gate fails also blocks the later rows of the SAME move: at stage 3
    #  the gated cheaper Guillotine rows stopped the plain one, and Up + Skill fired Rifle Shot. So every gated row has
    #  a move of its own: the Summon-first chords start copies of the SP moves, rrb_petalburst_d / rrb_petaldance_d)
    if SP_INPUTS:
        spm("pba", "rrb_petalburst", None, 100, P("petal_burst"), X_CHORD_A, inp=None)          # Attack, then Summon
        spm("pbd", "rrb_petalburst_d", None, 75, P("petal_burst"), X_CHORD_D, inp=None)         # Summon (its reload: 25), then Attack
    # (hidden 24's own row, Down + Skill for 30 SP after Petal Burst, is gone: no text named it, and as the first row of
    #  rrb_petaldance it could take the chords' skill change. The SP comes back inside the move: potentials_v2)
    if SP_INPUTS:
        spm("pdc", "rrb_petaldance", None, 50, P("petal_dance"), X_CHORD_R, inp=None, refund=B.SKILL_MP["rrb_rifleshot"] - 10)
        spm("pdd", "rrb_petaldance_d", None, 25, P("petal_dance"), X_CHORD_D, inp=None)
    # (hidden 15, Low Sweep -> Petal Dance: the chord cancels the sweep through Rifle Shot, which the card opens at 0.15 s)
    # (hidden 14 / 20, the cheaper Guillotine after Low Sweep / an Enhancer blast: an MP refund inside the move now,
    #  potentials_v2; their gated rows blocked the plain row at stage 3)
    sk("guil", "rrb_guillotine", 1, False, G)
    # hold Skill: Rifle Shot's hold switch (ChangeSkill) lands on this input-less row, so Sy-Pod's own cancel windows
    # rule it (not Rifle Shot's, which would let an early press cut Sy-Pod before its first round); the Rifle's MP is
    # spent, the row takes the rest of Sy-Pod's cost
    r = xrow(2, 0, "rrb_sypod", None, None, air=False, strict=cad("rrb_sypod", 0.5), all_=0.5, jump=0.45, own={2: 0.5, 11: 0.2},
             mps=[{"Slot": 2, "Limit": str(B.SKILL_MP["rrb_sypod"] - B.SKILL_MP["rrb_rifleshot"]),
                   "MpChange": -float(B.SKILL_MP["rrb_sypod"] - B.SKILL_MP["rrb_rifleshot"])}],
             start=False, timeout=round(L("rrb_sypod") + 0.3, 2), dash=B.skill_blast(by, "rrb_sypod"))
    add("sypod_h", r)
    # 0.9.0: the held rounds (rrb_power.sypod_held): each loop action's own input-less row, entered by the hold check
    # of the action before it; the row holds the price, so with too little MP the check does nothing and she recovers
    import rrb_power as _sy
    for ln in _sy.SY["loops"]:
        if ln not in by: continue
        r = xrow(2, 0, ln, None, None, air=False, strict=round(L(ln), 2), all_=0.25, jump=0.25, own={2: 0.25, 11: 0.2},
                 mps=[{"Slot": 2, "Limit": str(_sy.SY["more"]), "MpChange": -float(_sy.SY["more"])}],
                 start=False, timeout=round(L(ln) + 0.3, 2), dash=0.05)
        add("sy_" + ln, r)
    sk("hook", "rrb_hook", 2, False, HOOK_MP, P("hook"))                            # Down + Skill: Reaper's Hook (with 20712)
    sk("sypod", "rrb_sypod", 2, False, B.SKILL_MP["rrb_sypod"])                     # Down + Skill without it
    # (0.9.0, a tester: "Add movement dash cancel after activating the attack so the character does not easily get
    #  hit".) A Gun Blast leaves Sy-Pod once the rifle is planted, not only after its round
    for r_ in R:
        if r_.get("Action") == "rrb_sypod" and r_.get("Mutelist"):
            r_["Mutelist"] = re.sub(r'"5":[0-9.]+', '"5":%s' % _sy.SY["dash"], r_["Mutelist"])
    R[-1]["Mutelist"] = R[-1]["Mutelist"].replace('"all":0.35', '"all":0.5')         # its first round at 0.45 s
    # (0.9.0: air Down + Skill, and air Up + Skill too. The dive is steered by the direction still held 0.2 s in
    #  (build_ruby.buzz_dive): Down kept = the fast dive, Up kept = the short rise first, let go = the plain dive)
    for d_ in (2, 1):
        sk("buzz", "rrb_buzzsaw", d_, True, B.SKILL_MP["rrb_buzzsaw"], P("buzzsaw", "buzzsaw_ex", "petal_burst"), extra=',"3":0.3')   # hidden 23
        sk("buzz", "rrb_buzzsaw", d_, True, B.SKILL_MP["rrb_buzzsaw"], P("buzzsaw"))
    for req_, cost_ in ((P("rifle_two"), B.SKILL_MP["rrb_rifleshot"] - 10), (None, B.SKILL_MP["rrb_rifleshot"])):
        r = xrow(2, 0, "rrb_recoilshot", "Skill", None, air=True, strict=RECOIL_SHOT["again"], all_=RECOIL_SHOT["free"], jump=RECOIL_SHOT["free"],
                 own={2: RECOIL_SHOT["again"], 11: 0.2}, mps=MP(cost_), req=req_, sat=[2], timeout=round(L("rrb_recoilshot") + 0.3, 2),
                 dash=round(RECOIL_SHOT["shot"] + 0.05, 2))
        add("rshot", chk(r, GSW_ON))
    # 0.9.0: Skill again while she still aims fires from that pose (rifle_refire). Its rows come first: they follow a
    # Rifle Shot row or each other inside the window (REFIRE); after it the plain rows start the whole move again
    if "rrb_rifleshot_r" in by:
        for req_, cost_ in ((P("rifle_two"), B.SKILL_MP["rrb_rifleshot"] - 10), (None, B.SKILL_MP["rrb_rifleshot"])):
            r = xrow(2, 0, "rrb_rifleshot_r", "Skill", None, air=False, strict=REFIRE["again"], all_=0.3, jump=0.25, own={2: REFIRE["again"], 11: 0.2},
                     mps=MP(cost_), req=req_, sat=[2], timeout=REFIRE["keep_r"], dash=B.skill_blast(by, "rrb_rifleshot_r"))
            add("rifle_r", r, ["rifle", "rifle_r"])
    sk("rifle", "rrb_rifleshot", None, False, B.SKILL_MP["rrb_rifleshot"] - 10, P("rifle_two"), check=GSW_ON)    # 20710: reduced MP
    sk("rifle", "rrb_rifleshot", None, False, B.SKILL_MP["rrb_rifleshot"], check=GSW_ON)
    if "rrb_rifleshot_r" in by:
        for r_ in R:      # the first shot's rows open the re-fire at REFIRE["start"] and keep it until REFIRE["keep"]
            if r_.get("Action") == "rrb_rifleshot":
                r_["ActdurStrict"] = REFIRE["start"]; r_["Timeout"] = REFIRE["keep"]
                r_["Mutelist"] = re.sub(r'"2":[0-9.]+', '"2":%s' % REFIRE["start"], r_["Mutelist"])
    # 0.9.0 Gunswing (gunswing()): each step's shot has an input-less row in the step's own group; what may follow
    # the step may follow its shot, and never sooner than it could follow the step itself
    act_of = {}
    for r_ in R: act_of.setdefault(KEY[id(r_)], r_.get("Action"))
    for step, g in GSW_STEPS.items():
        shot = GSW_SHOT + step[4:]
        if shot not in by or step not in GSW_T0: continue
        cadence = max([r_["ActdurStrict"] for r_ in R if r_.get("Action") == step] or [0.0])
        free = round(max(GSW["free"], cadence - GSW_T0[step]), 2)
        add("g_" + step, xrow(g, 0, shot, None, None, air=(g == 4), start=False, req=P("gunswing"), mps=MP(GSW["mp"]), strict=free, all_=free,
                              jump=free, own={2: GSW["again"]}, timeout=GSW["keep"], dash=round(GSW["shot"] + 0.05, 2)))
        for r_ in R:
            if r_["Group"] == g and any(act_of.get(k) == step for k in PRE.get(id(r_), ())):
                PRE[id(r_)] = list(PRE[id(r_)]) + ["g_" + step]
    # ---- group 3: the Ultra slot only (stock: a group-3 row with no action: the HUD's full-SP marker)
    if SP_INPUTS:
        add("slot", {"$new": True, "ActorId": B.ACTOR, "Group": 3, "Order": 0, "ReqTriggerId": P("petal_burst"), "Mps": [{"Slot": 3, "Limit": "100"}], "ActionpointInputTag": 3})
    # ---- number the orders and resolve the chains
    count = {}
    for r in R:
        count[r["Group"]] = count.get(r["Group"], 0) + 1; r["Order"] = count[r["Group"]]
    orders = {}
    for r in R: orders.setdefault((r["Group"], KEY[id(r)]), []).append(r["Order"])
    for r in R:
        if id(r) in PRE:
            r["PreSkillOrder"] = sorted(o for k in PRE[id(r)] for o in orders[(r["Group"], k)])
            if r.get("Input") and r["Group"] in (1, 4):
                r["Preinputtime"] = 0.35 if KEY[id(r)] in ("2c", "2b", "rise") else 0.3
    return R


# ---------------------------------------------------------------- tables and texts
def content_v2(B):
    """Potential rows, triggers, the move list (ActorActionConf: Type 1 roots, Type 2 Potential rows, Type 2 Close
    hidden-effect rows) with rrb_text's 10 languages, PotentialComboConf, the Talent, the marker buffs."""
    import rrb_text as TX
    tabs = {k: [] for k in ("BaseActorPotentialConf", "PlayerBattleTriggerDetail", "ActorActionConf", "PotentialComboConf",
                            "BaseActorTalentQualityConf", "TalentEffectConf")}
    loc = {l: {} for l in TX.LANGS}
    def text(aid, name, desc, inp=None):
        for l in TX.LANGS:
            loc[l]["ActorActionName_%d" % aid] = name[l]; loc[l]["ActorActionNameRuby_%d" % aid] = name[l]
            loc[l]["ActorActionDesc_%d" % aid] = desc[l]
            loc[l]["ActorActionInput_%d" % aid] = (inp or {}).get(l, "") if isinstance(inp, dict) else (inp or "")
    mid = {k: m["id"] for k, m in TX.MOVE_TEXT.items()}
    cost = {"rrb_rifleshot": B.SKILL_MP["rrb_rifleshot"], "rrb_guillotine": B.SKILL_MP["rrb_guillotine"], "rrb_recoilshot": B.SKILL_MP["rrb_rifleshot"],
            "rrb_sypod": B.SKILL_MP["rrb_sypod"], "rrb_buzzsaw": B.SKILL_MP["rrb_buzzsaw"], "rrb_throw": HOOK_MP,
            "rrb_buzzsaw_ex": B.SKILL_MP["rrb_buzzsaw"], "rrb_dust": 25, "rrb_petaldance": 50}
    for k, m in TX.MOVE_TEXT.items():
        row = {"$new": True, "Id": m["id"], "ActorId": B.ACTOR, "Type": 1}
        if m.get("parent"): row["Inherit"] = [mid[m["parent"]]]
        if k == "rrb_petalburst": row.update({"IsUltraSkill": True, "SkillCostOrigin": 100})
        elif k in cost: row["SkillCostOrigin"] = cost[k]
        if k in ("rrb_dust", "rrb_petaldance"):      # they spend SP: the UI prints "MP:" unless told (stock row 50191's form)
            row["SkillCostDesc"] = "<color=#DF72B2>SP:%d</color>" % cost[k]
        tabs["ActorActionConf"].append(row); text(m["id"], m["name"], m["desc"], m.get("input"))
    for rank, (pid, key, grp, root, pre) in enumerate(CARDS, 1):
        aid, tr = 100000 + pid, pid * 10 + 1
        label = [pid] + ([DUST_LABEL] if key in DUST_CORE else [])
        row = {"$new": True, "Id": pid, "Rank": rank, "Label": label, "Score": 40, "TriggerInfo": {"Id": tr, "Level": 1},
               "AddDamageAttack": 0.2, "AddDamageSkill": 0.2, "OrderId": [grp], "ActorId": B.ACTOR, "RelationId": [aid], "IconId": ICON_OF.get(pid, pid)}
        # (audit T14.) A card that unlocks a move points at that move's own row (Type 1), as 195 stock cards do (Ragna's
        # Ultra card 5317 -> rows 11161 the move, 11162 its SP line): the card then shows the move's name and input, and
        # the move list knows the move comes from the card. Enhancement cards keep their Type 2 row under the move
        unlock = CARD_UNLOCK_ROWS and key in UNLOCKS
        sp_line = TX.POTENTIAL_TEXT[pid].get("sp") if unlock else None
        if unlock: row["RelationId"] = [mid[root]] + ([aid] if sp_line else [])
        if pre: row["PreLabels"] = [DUST_LABEL] if pre == DUST_CORE else [POT[x] for x in pre]
        if key in SP_CARDS and not SP_INPUTS: row["PreLabels"] = [SP_LOCK]
        if key == ULTRA: row.update({"IsUltraSkill": 1, "SkillCost": 100, "New": True})
        if key in NEW_MOVE_CARDS: row["New"] = True
        tabs["BaseActorPotentialConf"].append(row)
        for lvl in (1, 5):
            t = {"$new": True, "Idx": tr, "Lvl": lvl, "Name": "Ruby %s" % key, "Value": [0.1], "UiShowType": "CD", "Pvpvalue": [0.1]}
            if key in STOCK_TRIG: t.update(dict(zip(("TrigType", "OPFunc", "OPParams"), STOCK_TRIG[key])))
            if key == ULTRA: t.update({"TrigType": "StartStage", "OPBuff": ["Self,MPtoSP,9999,v0,1"], "Value": [0.5]})
            if key == "silver_eyes":   # the stock boss-damage trigger's buff (73091: +30 % against bosses)
                t.update({"TrigType": "StartStage", "OPBuff": ["Self,73091,99999,v0,1"], "Value": [0.3], "Pvpvalue": [0.3]})
            tabs["PlayerBattleTriggerDetail"].append(t)
        p = TX.POTENTIAL_TEXT[pid]
        if unlock and not sp_line: continue
        tabs["ActorActionConf"].append({"$new": True, "Id": aid, "ActorId": B.ACTOR, "Type": 2, "Inherit": [mid[root]]})
        if sp_line: text(aid, {l: "" for l in TX.LANGS}, sp_line)      # the Ultra's "SP: gained when..." line (stock shape)
        else: text(aid, p["name"], p["desc"], p.get("input"))
    # Potential Unleashed (stock text)
    tabs["BaseActorPotentialConf"].append({"$new": True, "Id": UNLEASHED, "Rank": len(CARDS) + 1, "Label": [UNLEASHED], "Score": 40,
                                           "AddDamageAttack": 0.2, "AddDamageSkill": 0.2, "OrderId": [99], "ActorId": B.ACTOR,
                                           "RelationId": [UNLEASHED_ACTION], "IconId": UNLEASHED, "IsDamageSkill": True})
    tabs["ActorActionConf"].append({"$new": True, "Id": UNLEASHED_ACTION, "ActorId": B.ACTOR, "Type": 3})
    u = TX.POTENTIAL_TEXT[UNLEASHED]; text(UNLEASHED_ACTION, u["name"], u["desc"])
    # hidden effects: one Close row per move each changes, one combo row per effect (row 27: one per element)
    hid = 140000
    for n, h in sorted(TX.HIDDEN_TEXT.items()):
        rel = []
        for sub, row in enumerate(h if isinstance(h, list) else [h]):
            for mk in row["move"]:
                hid += 1
                tabs["ActorActionConf"].append({"$new": True, "Id": hid, "ActorId": B.ACTOR, "Type": 2, "Inherit": [mid[mk]], "Close": True})
                blank = {l: "" for l in TX.LANGS}
                text(hid, blank, row["text"]); rel.append(hid)
        needs = (h[0] if isinstance(h, list) else h)["needs"]
        tabs["PotentialComboConf"].append({"$new": True, "Id": 207000 + n, "ActorId": B.ACTOR, "Potentials": list(needs), "SortOrder": n, "RelationId": rel})
    # the talent (unchanged: Huntress Focus)
    for q in (1, 2, 3, 4):
        tabs["BaseActorTalentQualityConf"].append({"$append": True, "TalentId": B.TALENT, "Quality": q, "Score": 30, "TalentEffectId": B.TALENT_EFFECT + q - 1})
        tabs["TalentEffectConf"].append({"$append": True, "EffectId": B.TALENT_EFFECT + q - 1, "EffectType": 1, "Trigger": [8, B.TALENT_EFFECT, 16, q]})
    for lvl in (1, 5):
        tabs["PlayerBattleTriggerDetail"].append({"$new": True, "Idx": B.TALENT_EFFECT, "Lvl": lvl, "Name": "Ruby Huntress Focus",
                                                  "Value": [0.25, 8.0], "TrigType": "SkillEnter", "TrigCond": "Start_9,Start_10,Start_11",
                                                  "OPBuff": ["Self,MOD_ruby_talent,v1,v0,1"], "UiShowType": "CD", "Pvpvalue": [0.25, 8.0]})
    tt = TX.TALENT_TEXT
    for l in TX.LANGS:
        loc[l]["TriggerName_%d" % B.TALENT_EFFECT] = tt["name"][l] if isinstance(tt["name"], dict) else tt["name"]
        loc[l]["TriggerDesc_%d" % B.TALENT_EFFECT] = tt["desc"][l]
    # buffs: the talent, the stagger mark, Dust (and the strong versions), the markers, the Enhancer damage
    buffs = [{"list": "BuffList", "key": "Idx", "from": "50491", "to": "MOD_ruby_talent", "set": [{"path": "Name", "value": "Ruby talent: Huntress Focus"}]},
             {"list": "BuffList", "key": "Idx", "from": "skill_times", "to": B.MARK, "set": [{"path": "Name", "value": "Ruby: staggered (Red Reaper)"}]}]
    buffs += B.dust_buffs()
    for key, k, status, dur, stre in B.DUST_EL:   # 20731: a flag; rrbDustHit makes the status 1.5x and the effect stronger
        buffs.append({"list": "BuffList", "key": "Idx", "from": "skill_times", "to": "rrb_dust%d_s" % k, "set": [
            {"path": "Name", "value": "Ruby Dust (strong): %s" % key}]})
    import rrb_power
    buffs += rrb_power.buffs(B)
    for m in MARKERS:
        # plain flags: the stock switch-condition buff (no logic, no effects). They were clones of icey_excution_ok,
        # which carried Icey's execution scripts and her electric effects onto every marker
        s = [{"path": "Name", "value": "Ruby marker: %s" % m}]
        if m == ENH:      # 0.9.0: while the enhancement waits, petals turn about her (a buff's effect loops and ends with it)
            s.append({"path": "AddEffects", "value": [{"Res": "Role/Rrb/rrb_petals", "BindPos": 0, "Offset": {"x": 0.0, "y": 1.0}, "Scale": 0.7,
                                                       "FitRole": 0, "Layer": 678496669, "BindDirType": 0, "BindPosEveryFrame": 0,
                                                       "ValidBuffStackMin": 0, "ValidBuffStackMax": 99999, "StartTimeType": 0}]})
        buffs.append({"list": "BuffList", "key": "Idx", "from": "skill_times", "to": m, "set": s})
    for b, k in ((ENH_DMG, "Enhancer"), (ENH_DMG + "2", "Enhancer (4th blast)")):
        buffs.append({"list": "BuffList", "key": "Idx", "from": "12261_all", "to": b, "set": [{"path": "Name", "value": "Ruby %s: damage" % k}]})
    return tabs, loc, buffs
