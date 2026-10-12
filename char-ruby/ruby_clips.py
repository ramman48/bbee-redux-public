"""ruby_clips.py -- which BBTAG animation segments become Ruby's BBEE clips.

Each clip is built at BUILD time from the player's own BBTAG install (tools/bbtag/bbtag_rig.py); this file holds only
names and segment choices, no art. A source is (BBTAG state, [segment indexes]) from tools/bbtag/bbtag_clips.py; the
segments are concatenated. A "+" entry appends another state's segments.
"""

ROLE = "rrb"
SKIN = "02"          # texture family rrb_02 = HeroConfig.Skin = ClientSkinConf.SkinName (stock heroes use "02")

# engine-facing, menu and presentation states (every stock hero has these)
BASE = {
    "stand":            [("CmnActStand", [0])],                   # idle loop
    "standby":          [("CmnActStand", [1])],                   # idle variation (fidget)
    "turn":             [("CmnActStandTurn", [0])],
    "walk":             [("CmnActFWalk", [1])],
    "run_start":        [("CmnActFDash", [0])],
    "run":              [("CmnActFDash", [1])],
    "runbrake":         [("CmnActFDashStop", [0])],
    "jump":             [("CmnActJumpPre", [0]), ("CmnActJumpUpper", [0])],
    "jump2":            [("CmnActJumpUpper", [0])],
    "jump_top":         [("CmnActJumpUpperEnd", [0])],
    "drop_start":       [("CmnActJumpDown", [0])],
    "drop":             [("CmnActJumpDown", [1])],
    "dropend":          [("CmnActJumpLanding", [0])],
    "squat":            [("CmnActStand2Crouch", [0])],
    "squat_loop":       [("CmnActCrouch", [0])],
    "squat_to_stand":   [("CmnActCrouch2Stand", [0])],
    "behit_light":      [("CmnActHitStandLv1", [0])],
    "behit_up":         [("CmnActHitStandLv3", [0])],
    "behit_middle":     [("CmnActHitStandLowLv3", [0])],
    "behit_heavy":      [("CmnActHitStandLv5", [0])],
    "behit_air":        [("CmnActBDownUpper", [0, 1])],
    "push_back":        [("CmnActBlowoff", [0, 1])],
    "push_down":        [("CmnActBDownUpper", [0, 1]), ("CmnActBDownUpperEnd", [0]), ("CmnActBDownDown", [0])],
    "push_down_loop":   [("CmnActBDownDown", [1])],
    "knockdown":        [("CmnActBDownCrash", [0]), ("CmnActBDownBound", [0])],
    "knockdown_loop":   [("CmnActBDownLoop", [0])],
    "knockdown_stand":  [("CmnActBDown2Stand", [0])],
    "fdown":            [("CmnActFDownCrash", [0]), ("CmnActFDownBound", [0])],
    "fdown_stand":      [("CmnActFDown2Stand", [0])],
    "dead":             [("CmnActBDownCrash", [0]), ("CmnActBDownBound", [0]), ("CmnActBDownLoop", [0])],
    "wallbound":        [("CmnActWallBound", [0])],
    "stagger":          [("CmnActStaggerLoop", [0, 1])],
    "stagger_down":     [("CmnActStaggerDown", [0])],
    "freeze":           [("CmnActFreeze", [0])],
    "spin":             [("CmnActKirimomiUpper", [0])],
    "ukemi_air":        [("CmnActUkemiAirN", [0])],
    "quickstand":       [("CmnActUkemiLandN", [0])],
    "guard":            [("CmnActMidGuardPre", [0]), ("CmnActMidGuardLoop", [0])],
    "guard_end":        [("CmnActMidGuardEnd", [0])],
    "air_turn":         [("CmnActAirTurn", [0])],
    "burst":            [("CmnActOverDriveBegin", [0, 1]), ("CmnActOverDriveLoop", [0, 1]), ("CmnActOverDriveEnd", [0])],
    "burst_air":        [("CmnActAirOverDriveBegin", [0, 1]), ("CmnActAirOverDriveLoop", [0, 1]), ("CmnActAirOverDriveEnd", [0])],
    # entrances, victories, defeat, taunts / appeals (menus, select screen, results, cinematics)
    "born":             [("CmnActEntry", [1])],
    "born2":            [("CmnActEntry", [2])],
    "born3":            [("CmnActEntry", [6, 7])],
    "winpose":          [("CmnActMatchWin", [2, 3])],
    "winpose2":         [("CmnActMatchWin", [4, 5])],
    "winpose3":         [("CmnActMatchWin", [6, 7])],
    "lose":             [("CmnActLose", [0, 1])],
    "appeal":           [("CmnActChangePartnerAppeal", [0])],     # taunt
    "appeal2":          [("CmnActChangeReturnAppeal", [0])],      # longer taunt
    "appeal_air":       [("CmnActChangePartnerAppealAir", [0, 1, 2])],
    "request":          [("CmnActChangeRequest", [0, 1, 2])],     # "come on" gesture
    "request_short":    [("CmnActChangeRequest", [0])],           # its first beat (0.53 s): Summon Tactic, Legacy casts
    "out":              [("CmnActChangePartnerOut", [0])],
    "quick_in":         [("CmnActChangePartnerQuickIn", [0])],
}

# her moves (BBTAG states; the kit design is docs/cross-effect/PROPOSALS.md section 5)
KIT = {
    "atk5a":            [("NmlAtk5A", [0])],
    "atk5aa":           [("AN_NmlAtk5A_2nd", [0])],
    "atk5aaa":          [("AN_NmlAtk5A_3rd", [0])],
    # (0.9.0; a tester, 2026-10-07: "The transition between the 3rd and 4th attacks looks bad".) The third attack ends
    # with the scythe planted far ahead; BBTAG's fourth opens crouched with it behind her, one frame later. Its first
    # 12 ticks are now the third's own recovery (the scythe pulled out, raised, brought round: rrb271_06 to 08) and then
    # its crouch's last two frames, so the lunge frame (tick 12) and every time after it stay where they were
    "atk5aaaa":         [("@", [("rrb271_06", 2), ("rrb271_07", 2), ("rrb271_08", 2)]), ("AN_NmlAtk5A_4th", [0], 2, None),
                         ("AN_NmlAtk5A_4th", [1, 2])],
    "atk5b":            [("NmlAtk5B", [0])],
    "atk5bb":           [("AN_NmlAtk5B_2nd", [0])],
    "atk5bbb":          [("AN_NmlAtk5B_3rd", [0])],
    "atk2a":            [("NmlAtk2A", [0])],
    "atk2b":            [("NmlAtk2B", [0])],
    "atk2c":            [("NmlAtk2C", [0])],
    "atkj5a":           [("NmlAtkAIR5A", [0])],
    "atkj2a":           [("NmlAtkAIR2A", [0, 1, 2, 3])],
    "atkj5b":           [("NmlAtkAIR5B", [0])],
    "atkj5c":           [("NmlAtkAIR5C", [0, 1, 2])],
    # V2 (Test 5: ground poses in mid-air): BBTAG plays the air part, loops the fall until she lands, then the landing
    # frames (upon landing -> label 9). The air clip loops the fall long enough for any height; landing switches.
    # (0.9.0: three shots, 6 ticks apart. BBTAG's own frames to its shot (tick 17, rrb204_06), then the shot frame
    #  twice more with the fall loop's two frames between, so the pose kicks with each round; rrb_power.JC3)
    "atkj5c_air":       [("@", [("rrb253_00", 3), ("rrb253_01", 3), ("rrb253_02", 4), ("rrb204_04", 3), ("rrb204_05", 4),
                                ("rrb204_06", 3), ("rrb204_07", 3), ("rrb204_06", 3), ("rrb204_08", 3), ("rrb204_06", 4)]),
                         ("NmlAtkAIR5C", [1] * 20)],
    "atkj5c_land":      [("NmlAtkAIR5C", [2])],
    "clash":            [("CmnActCrushAttack", [0, 1, 2])],
    "clash_air":        [("CmnActCrushAttack", [0] + [1] * 12)],   # V2: the leap, then the fall loop until she lands
    "clash_land":       [("CmnActCrushAttack", [2])],
    "corkscrew":        [("CmnActInvincibleAttack", [0])],
    "throw":            [("NmlAtkThrow", [2])],
    "throw_exe":        [("ThrowExe", [0, 1, 2])],
    # V2 Potentials and the Clash chase (KIT_V2 §3): BBTAG's own states for each
    "clash_charge":     [("CmnActCrushAttack", [0, 0, 0])],       # 20709: the charge loop (010_xx) held while Attack is held
    "clash_chase1":     [("CmnActCrushAttackChase1st", [0, 1, 2])],
    # Clash chase, 2026-10-02 (the lead: 'a way faster sequence'): Chase1st from its slash (rrb202_00, sprite 10 =
    # BBTAG 0.5 s); sprites 0-9 (rrb204_07-15) replay the clash's own landing/reload pose that rrb_clash_land already plays
    "clash_chase1_go":  [("CmnActCrushAttackChase1st", [0, 1, 2], 10, None)],
    "clash_chase2":     [("CmnActCrushAttackChase2nd", [0, 1, 2])],
    "clash_finish":     [("CmnActCrushAttackFinish", [0])],
    "throw_back_exe":   [("BackThrowExe", [0, 1, 2])],
    # (0.8.0; a tester, 2026-10-03: the grab "could work without Ruby's running animation. Another option could be making
    #  her advance with the short dash".) It was BBTAG's run-in only (segments 0 and 1, rrb032: her dash frames), cut off
    #  before the grab itself. Now: the first two dash frames (7 ticks, she slides in: rrb_pots HOOK_DASH), then the grab
    #  swing (segment 2, rrb310: its reach is on its third and fourth sprites)
    # (0.9.0: no dash frames. The grab swing alone, its first frames slower so the reach reads: ready 3 + 4 ticks,
    #  the blade out for 5 (tick 7: the hit), then the pull)
    "hook":             [("@", [("rrb310_00", 3), ("rrb310_01", 4), ("rrb310_02", 5), ("rrb310_03", 4), ("rrb310_04", 4), ("rrb310_05", 4),
                                ("rrb310_06", 4), ("rrb310_07", 4), ("rrb310_08", 3)])],
    # Legacy (KIT_V2 §3: her partner skills): Rifle Shot = assist A (the shot on tick 10), Rose Lunge = assist D
    "assist_shot":      [("CmnActChangePartnerAssistAtk_A", [0])],
    "assist_lunge":     [("CmnActChangePartnerAssistAtk_D", [0, 1, 2])],                 # 20712: the reach (032_14), the hook held (032_02)
    "buzzsaw_spin":     [("AirRolling_A", [1] * 10)],             # 20720: the EX dive from the spin (the hop is done)
    # 20714: the flurry spin again (sprites 16-19 = ticks 39-47 of 236C; a range is SPRITE indexes), three turns
    "guil_spin":        [("MultiAssault", [0], 16, 20)] * 3,
    # the finish after the held spins: one more turn (the launching cut is on it: 0.8.0; before, the blow landed on the
    # first frame of her drop, with no swing to see), then the rest of 236C after the flurry (sprite 20 on)
    "guil_end":         [("MultiAssault", [0], 16, 20), ("MultiAssault", [0, 1, 2], 20, None)],
    "blast_f":          [("SpDash_Front", [0])],
    # Gun Blast as her dash: the stock dash is two actions (dash 0.37 s, dashend 0.35 s), so each blast is cut at the
    # end of its travel: "_go" (wind-up, shot, travel) and "_end" (recovery)
    "blast_f_go":       [("SpDash_Front", [0], 0, 8)],
    "blast_f_end":      [("SpDash_Front", [0], 8, None)],
    "blast_f_chain":    [("SpDash_Front", [0], 2, 8)],      # a chained blast starts at the firing frame (no wind-up)
    "blast_air_f_chain": [("AirSpDash_Front", [0], 3, 8)],
    "blast_u_go":       [("SpDash_AntiAir", [0], 0, 7)],
    "blast_u_end":      [("SpDash_AntiAir", [0], 7, None)],
    "blast_air_f_go":   [("AirSpDash_Front", [0], 0, 7)],
    "blast_air_f_end":  [("AirSpDash_Front", [0], 7, None)],
    "blast_air_d_go":   [("AirSpDash_AntiLand", [0, 1], 0, 6)],
    "blast_air_d_end":  [("AirSpDash_AntiLand", [0, 1, 2], 6, None)],
    "blast_b":          [("SpDash_Back", [0, 1, 2])],
    # Gun Blast v3 (V2_COVERAGE C2, C6): the ground Down blast is BBTAG's 214A (fires forward, flies back); every blast
    # has a chain version starting on its firing ("ex") frame
    "blast_b_go":       [("SpDash_Back", [0], 0, 8)],
    # 0.9.0: the backward blast's own recovery (it ended on the forward blast's skid frames: blast_f_end)
    "blast_b_end":      [("SpDash_Back", [0], 8, None), ("SpDash_Back", [1, 2])],
    "blast_b_chain":    [("SpDash_Back", [0], 2, 8)],
    "blast_u_chain":    [("SpDash_AntiAir", [0], 3, 7)],
    "blast_air_d_chain": [("AirSpDash_AntiLand", [0, 1], 3, 6)],
    "blast_u":          [("SpDash_AntiAir", [0])],
    "blast_air_f":      [("AirSpDash_Front", [0])],
    "blast_air_b":      [("AirSpDash_Back", [0])],
    # the air backward gun-dash (the lead, 2026-09-29: Down + Dash = the backward bullet dash, ground and air)
    "blast_air_b_go":   [("AirSpDash_Back", [0], 0, 12)],        # wind-up, the shot (sprite 2, tick 6), the recoil flight
    "blast_air_b_chain": [("AirSpDash_Back", [0], 2, 12)],       # a chained one from its firing sprite
    "blast_air_d":      [("AirSpDash_AntiLand", [0, 1, 2])],
    "rifleshot":        [("AttackAndShotA", [0])],
    # the Dust reload (KIT_V2 §5, D7): her win pose folds Crescent Rose into its rifle form (611_00 -> 611_02); held as a
    # rifle while the spent cartridge ejects (0.12 s) and the new one locks in (0.28 s); it unfolds into her ready
    # stance (601_07 -> 601_08). 29 ticks, 0.48 s; cancellable from 0.30 s (the row)
    "dust_reload":      [("@", [("rrb611_00", 3), ("rrb611_01", 3), ("rrb611_02", 12), ("rrb601_07", 5), ("rrb601_08", 6)])],
    "sypod":            [("AttackAndShotB", [0])],
    # stage 3 guns (rrb_power.guns): the fire + recoil frames repeated, one recoil per round
    "rifle_burst":      [("Shot", [0], 0, 5), ("Shot", [0], 3, 5), ("Shot", [0], 3, 5), ("Shot", [0], 5, None)],
    "sypod_five":       [("AttackAndShotB", [0], 0, 18)] + [("AttackAndShotB", [0], 13, 18)] * 3 + [("AttackAndShotB", [0], 18, None)],
    # 0.9.0 (rrb_power.sypod_held): the plant and one round (the first firing block, then the recovery), and the held
    # round's loop (the firing block with its last frame held 18 ticks: the next round's check comes at 0.34 s; then
    # the recovery)
    "sypod_one":        [("AttackAndShotB", [0], 0, 13), ("AttackAndShotB", [0], 18, None)],
    "sypod_loop":       [("@", [("rrb404_08", 3), ("rrb404_09", 3), ("rrb404_10", 3), ("rrb404_11", 3), ("rrb404_12", 18)]),
                         ("AttackAndShotB", [0], 18, None)],
    "rifleshot_ex":     [("AttackAndShotEx", [0])],
    # 0.9.0: BBTAG's Shot with the aim held until a second press can no longer fire from the pose (rrb_pots.REFIRE keep,
    # 0.62 s), and the fold-away after that in 17 ticks. It folded from 0.50 s in 24: a re-fire pressed late snapped her
    # back out of the fold (pictures from inside the game, 2026-10-09: k9v_refire, the third shot). Still 54 ticks
    "longshot":         [("Shot", [0], 0, 5), ("@", [("rrb407_05", 15), ("rrb407_06", 4), ("rrb601_03", 3), ("rrb601_04", 3),
                                                     ("rrb601_05", 3), ("rrb601_06", 3), ("rrb601_07", 3), ("rrb601_08", 2)])],
    # 0.9.0: Rifle Shot fired again from the aiming pose (rrb_pots.rifle_refire): the hold frame, the frame before the
    # shot, then BBTAG's Shot from its firing frame (index 3: tick 5 here, tick 10 there), the aim held to the end of
    # its own window (REFIRE keep_r, 0.54 s) and the same fold-away: 49 ticks as before; the stage 3 burst likewise
    "longshot_re":      [("@", [("rrb407_05", 2), ("rrb407_02", 3)]), ("Shot", [0], 3, 5),
                         ("@", [("rrb407_05", 15), ("rrb407_06", 4), ("rrb601_03", 3), ("rrb601_04", 3),
                                ("rrb601_05", 3), ("rrb601_06", 3), ("rrb601_07", 3), ("rrb601_08", 2)])],
    "rifle_burst_re":   [("@", [("rrb407_05", 2), ("rrb407_02", 3)]), ("Shot", [0], 3, 5), ("Shot", [0], 3, 5), ("Shot", [0], 3, 5), ("Shot", [0], 5, None)],
    # 0.9.0 Gunswing (rrb_pots.gunswing): the rifle comes up in two ticks, the round leaves on the third, then the
    # Rifle Shot's own fold-away; in the air, the Recoil Shot's firing frames
    "gsw":              [("@", [("rrb407_02", 2), ("rrb407_03", 4), ("rrb407_04", 4), ("rrb407_05", 5), ("rrb407_06", 4), ("rrb601_03", 3),
                                ("rrb601_04", 3), ("rrb601_05", 3), ("rrb601_06", 3), ("rrb601_07", 3), ("rrb601_08", 2)])],
    "gsw_air":          [("@", [("rrb401_10", 2), ("rrb401_02ex", 3), ("rrb401_03", 2), ("rrb401_02", 2), ("rrb401_03", 2), ("rrb401_04", 5)])],
    "guillotine":       [("MultiAssault", [0, 1, 2])],
    # 0.9.0: the spin no longer starts from the held thrust. She pulls the scythe back behind her (the lunge's own frames,
    # backwards) over 6 ticks and swings into it; rrb_power.guil_runup moves the action's later times with it
    "guillotine_p":     [("MultiAssault", [0, 1, 2], 0, 16), ("@", [("rrb406_07", 2), ("rrb406_06", 2), ("rrb406_05", 2)]),
                         ("MultiAssault", [0, 1, 2], 16, None)],
    # 0.9.0: the air Rising Reap opened on the ground version's crouch, the blade on a floor that is not there. Its first
    # 14 ticks are now j.B's recovery backwards (the scythe drops behind and under her) and its last 6 j.B's air poses,
    # so the swing's frames and every time stay where they were
    "atk5bbb_air":      [("@", [("rrb252_09", 2), ("rrb252_08", 2), ("rrb252_07", 3), ("rrb252_06", 3), ("rrb252_05", 4)]),
                         ("AN_NmlAtk5B_3rd", [0], 7, 19), ("@", [("rrb252_09", 3), ("rrb252_10", 3)])],
    "buzzsaw":          [("AirRolling_A", [0] + [1] * 10)],   # startup, then the spin looped (the action lands out of it)
    "buzzsaw_fall":     [("AirRolling_A", [3])],
    # BBTAG label 9 (landing spin + shot, recoil backflip), 409_07 held while airborne (BBTAG holds it until landing:
    # 7 ticks = the hop's 0.42 s airtime), then label 99 (recovery)
    "buzzsaw_land":     [("AirRolling_A", [2] + [3] * 7 + [4])],
    "petalburst":       [("UltimateAssault", [0, 1])],
    "petaldance":       [("UltimateDance", [0, 1])],
    "petaldance_storm": [("UltimateDance", [0])],        # stage 3 (rrb_power.finishers): the storm
    "petaldance_fin":   [("UltimateDance", [1])],        # and the finale, only on a hit
    "redreaper":        [("AstralHeat", [0, 1, 2, 3, 4, 5, 6])],
    "finalblow":        [("CmnActAComboFinalBlow", [2])],
}

# effects with sprite art (her effect script, scr_rrbea); played by projectile/effect actors. Slash arcs and bullets
# are 3D meshes in BBTAG (.MUA, not decoded yet): those use BBEE effects for now.
EFFECTS = {
    "fx_muzzle":        [("rrbMuzzleEff_B3", [0])],
    "fx_smoke":         [("rrb404Smoke", [0])],
    "fx_dashsmoke":     [("rrb405_DashSmoke", [0])],
    "fx_ringsmoke_a":   [("rrb405_RingSmokeA", [0])],
    "fx_ringsmoke_b":   [("rrb405_RingSmokeB", [0])],
    "fx_ringsmoke_c":   [("rrb405_RingSmokeC", [0])],
    "fx_ground":        [("rrbGroundEff", [0])],
    "fx_rr_petals_l":   [("rrb450_TransitionL", [0])],
    "fx_rr_petals_r":   [("rrb450_TransitionR", [0])],
}

# effect art drawn larger than her body scale: Red Reaper's petal wipe tiles (613 x 683 px) are two halves of a wall
# that covers the screen, so each is about 12 x 13 u (x4.2)
EFFECT_SCALE = [("rrbef450_transition", 4.2)]

# BBEE's Evotype / inheritance cinematics play these by name, EXACT case (NOTES 2026-09-28): <role>_<name>
CINEMA = {
    "UPjump_1": "jump", "UPjump_2": "jump2", "UPjump_3": "jump2", "Dash_timeline": "run", "dropend4": "dropend",
    "Stand_timeline": "stand", "Stand2_timeline": "standby", "Born_timeline": "born", "Born2_timeline": "born2",
    "drop_inherit": "drop", "squat_loop_inherit": "squat_loop", "squat_to_stand": "squat_to_stand",
    "stand_inherit": "stand", "standby_inherit": "standby", "burst_x_inherit": "burst",
    "knockdown_stand_inherit": "knockdown_stand",
}


def sequences(catalog, normalize, effects_catalog=None):
    """-> {clip name: [(sprite, ticks), ...]} for every BASE, KIT, CINEMA and (with the effect catalog) EFFECTS clip."""
    out = {}
    tables = [(BASE, catalog), (KIT, catalog)] + ([(EFFECTS, effects_catalog)] if effects_catalog else [])
    for table, cat in tables:
        for name, parts in table.items():
            seq = []
            for part in parts:                      # (state, [segments]) or (state, [segments], first, last) sprites
                if part[0] == "@":                  # ("@", [(sprite, ticks), ...]): an explicit frame list
                    seq += [tuple(f) for f in part[1]]; continue
                state, segs = part[0], part[1]
                sg = cat[state]; one = []
                for i in segs:
                    one += [tuple(f) for f in sg[i]["frames"]]
                seq += one[part[2]:part[3]] if len(part) > 2 else one
            out["%s_%s" % (ROLE, name)] = normalize(seq)
    for cname, src in CINEMA.items():
        out["%s_%s" % (ROLE, cname)] = out["%s_%s" % (ROLE, src)]
    return out
