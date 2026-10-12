/* dr-party: the party command (docs/deltarune/party/PARTY.md section 4; DECISIONS.md 2026-10-02).
   Hold Skill: the battle slows to a crawl (the battle's own time scale), the SOUL appears on the nearest enemy Kris
   faces, the stick moves it to the best enemy in that direction (DELTARUNE's rule: within 65 degrees, nearest first),
   Dash swaps between Susie and Ralsei, and letting go fires the chosen companion's move at that enemy. Susie acts first;
   while she recharges, Ralsei's Fireshock is next. No MP: each companion has a recharge that counts battle time.
   The projectiles are created booked to Kris's Skill row, so the hits are Kris's Skill hits (Tactics, Potentials).
   Appended to data/js/window/battle/BattleUI (module scope: csharp_1, TransUtil_1, BattleJs_1, CSharpDefine_1; there
   Util_1 is Core/DataBindingUtil, so core Util comes from require("Core/Util") and $typeof from puerts).
   Runs from globalThis.BB_HUD_TICKS (bbee-sdk: BattleUI.LateUpdateWindow, every rendered frame, real time).
   Safety: the time scale is put back whenever the command ends for any reason (release, death, a new battle, a
   pause, an error); three errors in a row switch the command off for the rest of the battle. */
(function () {
  var G = globalThis, CS = csharp_1, UM = require("Core/Util"), U = UM.U, TQ = TransUtil_1.default, IsNull = CSharpDefine_1.IsNull;
  var PU = G.puerts || require("puerts");
  var T = (G.BB_HUD_TICKS = G.BB_HUD_TICKS || {}); if (T["dr-party/command"]) return;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  var CFG = {
    actor: "200801", bullet: 20080101, row: "kris_cmd",
    slow: 0.05, ease: 0.08, holdDelay: 0.10, tap: 0.15,           // time scale while aiming; seconds (real time)
    buffer: 0.7,                                                   // a press while recharging waits this long (battle s) for the recharge
    recharge: { susie: 3.0, ralsei: 3.0 },                         // seconds of battle time (0.4.1, the lead: "increase cooldown in general"; was 1)
    // companions (PARTY.md 5; the lead 2026-10-02: they follow Kris "at all times ... with some delay just like how
    // they work in chapter 5", and fire "from wherever they are"). dist = DELTARUNE's caterpillardist (frames at 30 fps).
    who: {
      susie: { name: "Rude Buster", colour: [1.0, 0.25, 0.85], bolt: "rb_bolt_home", swing: 0.133, muzzle: [0.45, 0.75], dist: 6,
               actions: { stand: "fol_susie_stand", run: "fol_susie_run", jump: "fol_susie_jump", fall: "fol_susie_fall",
                          land: "fol_susie_land", turn: "fol_susie_turn", cast: "fol_susie_cast", spin: "fol_susie_spin",
                          pose: "fol_susie_pose", dash: "fol_susie_dash", sprint: "fol_susie_sprint", ready: "fol_susie_ready", shock: "fol_susie_shock",
                          fidget: "fol_susie_fidget", dance: "fol_susie_dance", halt: "fol_susie_halt" },
               lengths: { land: 0.27, turn: 0.27, cast: 0.93, spin: 0.45, pose: 0.8 }, height: 1.39 },
      ralsei: { name: "Fireshock", colour: [0.35, 1.0, 0.45], bolt: "fs_ball_home", swing: 0.4, muzzle: [0.5, 0.6], dist: 12,
                actions: { stand: "fol_ralsei_stand", run: "fol_ralsei_run", jump: "fol_ralsei_jump", fall: "fol_ralsei_fall",
                           land: "fol_ralsei_land", turn: "fol_ralsei_turn", cast: "fol_ralsei_cast", spin: "fol_ralsei_spin",
                           pose: "fol_ralsei_pose", dash: "fol_ralsei_dash", sprint: "fol_ralsei_sprint", ready: "fol_ralsei_ready", shock: "fol_ralsei_shock",
                          fidget: "fol_ralsei_fidget", dance: "fol_ralsei_dance", halt: "fol_ralsei_halt" },
                lengths: { land: 0.27, turn: 0.27, cast: 0.8, spin: 0.45, pose: 0.8 }, height: 1.26 }
    },
    unitPerPx: 1.16 / 36,                                         // one DELTARUNE pixel in world units (the party's scale)
    angle: 65, angleOne: 85, stick: 0.55,
    sprites: { soul: "DRParty_SOUL", heart: "DRParty_Heart", reticle: "DRParty_Reticle_", frames: 8, red: "DRParty_ReticleRed",
               circle: "DRParty_Circle", cross: "DRParty_Cross", arrow: "DRParty_Arrow",
               tpFrame: "DRParty_TPFrame", tpBack: "DRParty_TPBack", tpFill: "DRParty_TPFill", tpFlash: "DRParty_TPFlash",
               tpLogo: "DRParty_TPLogo", graze: "DRParty_Graze",
               // 0.5.1: the party panel (DELTARUNE's battle head icons: 0 the face, 1 the sword, 2 the fire, 5 hurt; its
               // name graphics) and the SOUL's end (spr_heartbreak, spr_heartshards)
               head: { susie: "DRParty_HeadS_", ralsei: "DRParty_HeadR_" }, name: { susie: "DRParty_NameS", ralsei: "DRParty_NameR" },
               soulBreak: "DRParty_SoulBreak", shard: "DRParty_Shard_", white: "DRParty_White" },
    // DELTARUNE's own target-mode sounds (snd_spearrise, snd_plat_act_move / _move_fail / _select), built at build time
    // from the player's install into the CRI sheet sfx_dr_pt_ui (audio/import_audio.py)
    sfx: { enter: "sfx_dr_pt_spearrise", move: "sfx_dr_pt_plat_act_move", fail: "sfx_dr_pt_plat_act_move_fail",
           select: "sfx_dr_pt_plat_act_select", poseOn: "sfx_dr_pt_pose_on", poseOff: "sfx_dr_pt_pose_off",
           graze: "sfx_dr_pt_graze",
           // 0.5.1: DELTARUNE's item jingle when a Potential joins the run (snd_item), the SOUL breaking (snd_break1,
           // snd_break2) and forming again (snd_power)
           pick: "sfx_dr_pt_pick", break1: "sfx_dr_pt_break1", break2: "sfx_dr_pt_break2", revive: "sfx_dr_pt_revive" },
    apart: 0.7,                                                    // standing still, the party stands this far apart (u)
    autoTag: false,                                                // "AUTO" over each companion's head (0.5.2: off, the panel says it)
    low: { on: 0.30, off: 0.38 },                                  // Kris's HP as a share of max: the companions' low-HP look begins / ends
    // the Fun Gang's pose (the lead, 2026-10-03: switching Auto, "the entire fun gang stops whereever they are and do
    // their iconic fun gang pose taunts"): Kris's own pose action on the ground / in the air (he hangs there), never
    // forced out of a hit reaction, a knockdown, an entrance or a Tactic's cast (deny); delay: the pose starts this
    // long after the press, so a Summon Tactic's own cast has started and is left alone
    pose: { ground: "kris_pose", air: "kris_pose_air", delay: 0.05,
            deny: "^(behit|push_|knockdown|standUp|quickStand|reactive|dead|born|reborn|pvp_born|winpose|StagePass|paid_show|bornshow|summon|teacherskill|addHP)" },
    // the typed line (ours; English, the other nine languages to come). At most 40 characters (DELTARUNE's charline)
    text: { aim: { susie: "* Move to aim. DASH: Ralsei. Let go: act!", ralsei: "* Move to aim. DASH: Susie. Let go: act!" },
            aimOne: "* Move to aim, then let go to act!", onKris: "* Press a direction to choose a target.",
            cancelled: "* Cancelled. Move to choose again.",
            none: "* No one to target right now.", both: "* Both are recharging. Hang on!",
            rech: { susie: "* Susie is catching her breath...", ralsei: "* Ralsei is gathering his magic..." },
            guard: "* It's guarding! Damage is reduced." },
    labels: null,                                                  // from the build (DELTARUNE's own strings)
    log: "@ROOT@/modlog.txt", testFile: "@ROOT@/drparty_test.txt"
  };
  // the generator's values (action names, swing times) override these: build_kris.py writes __bbDRPartyCFG first
  (function merge(dst, src) { for (var k in src) { if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && dst[k]) merge(dst[k], src[k]); else dst[k] = src[k] } })(CFG, G.__bbDRPartyCFG || {});
  P.CFG = CFG;
  var S = { pl: null, kris: false, on: true, err: 0, state: "idle", held: 0, aimT: 0, sel: null, who: "susie",
            wait: { susie: 0, ralsei: 0 }, prevSkill: false, prevDash: false, prevStick: false, ts: null,
            blocked: false, hudAt: -1e9, shots: [], watch: [], flying: [], fireAt: {}, full: {}, bnow: 0, dualQ: null, missing: {}, ui: null, soulXY: null, lines: [], flushT: 0, perf: { t: 0, n: 0, max: 0 } };
  P.state = S; P.fireAt = S.fireAt;

  // ---------------------------------------------------------------- log (queued, flushed about once a second)
  function log(s) { S.lines.push(new Date().toISOString() + " [DR-PARTY] " + s); }
  function flush(now) {
    if (!S.lines.length || now - S.flushT < 1.0) return;
    S.flushT = now;
    try { CS.System.IO.File.AppendAllText(CFG.log, S.lines.join("\n") + "\n") } catch (e) {}
    S.lines = [];
  }

  // ---------------------------------------------------------------- the game
  function battle() { var b = BattleJs_1.default.Instance; return b && b.Battle }
  function isKris(p) {
    if (S.pl === p) return S.kris;
    // as char-nine's HUD: a mod hero doesn't always report its own id as ActionGroupID, so the run's character
    // (GetFesActor) decides when it doesn't match
    var id = "", fes = "";
    try { id = String(p.ActionGroupID) } catch (e) {}
    try { var fa = BattleJs_1.default.Instance.GetFesActor(); if (fa) fes = String(fa.id) } catch (e) {}
    var base = ""; try { base = String(p.BaseID) } catch (e) {}
    // Kris's own logic group or actor id; the run's character only decides when neither can be read (0.4.3: with the
    // run's character alone, a lobby avatar "F02" got the party and the command)
    S.pl = p; S.kris = id === (CFG.logic || "kris") || id === CFG.actor || base === CFG.actor || (!id && !base && fes === CFG.actor);
    dismissParty("the player is another one");       // (before the handles are forgotten)
    S.state = "idle"; S.sel = null; S.shots = []; S.dualQ = null; S.entered = false; S.wasFell = false; S.hpSeen = false; S.soulEnd = null; S.low = false; S.partyAway = false; resetParty();
    log("player in battle: ActionGroupID " + id + ", actor " + base + ", run character " + fes + (S.kris ? " -> Kris: command ready" : " (not Kris)"));
    return S.kris;
  }
  function f(v) { return U.FpToFloat(v) }
  var MROW = {};
  function monsterRow(id) {
    if (MROW[id] !== undefined) return MROW[id];
    var r = null; try { r = require("Gen/Xlsx").Xlsx.MonsterConfig.Get(id) || null } catch (e) {}
    return (MROW[id] = r);
  }
  function field(r, name) { var v = r[name]; if (v === undefined) v = r[name.charAt(0).toLowerCase() + name.slice(1)]; return v === undefined || v === null ? "" : String(v) }
  var TARGETABLE = {};
  function targetable(a) {                          // not a trap, not scenery, not something the game itself never targets
    var id = a.BaseID; if (TARGETABLE[id] !== undefined) return TARGETABLE[id];
    var ok = true, r = monsterRow(id);
    if (r) {
      var res = field(r, "ActorResistance"), ext = field(r, "ExtParams");
      // every pot, trap, buff zone and trap tree the lead's commands hit carries TargetIgnore, and every real enemy is
      // tagged Monster or Boss (MonsterConfig, all 30 kinds targeted on 2026-10-03): both rules apply
      var tags = (ext.match(/Tag=([^;]*)/) || [])[1] || "";
      if (/TargetIgnore/.test(res) || /CantBeHit/.test(ext) || (tags && !/Monster|Boss/.test(tags))) ok = false;
    }
    if (!ok) log("not a target: " + id + (r ? " (" + field(r, "Name") + ")" : ""));
    return (TARGETABLE[id] = ok);
  }
  function enemies(p) {
    var out = [], L = battle().PlayerObjMgr.ActorList;
    for (var i = 0; i < L.Count; i++) {
      var a = L.get_Item(i);
      try { if (a && a != p && !a.Caster && !a.IsDead && a.Faction != p.Faction && targetable(a)) out.push(a) } catch (e) {}
    }
    return out;
  }
  function guarded(a) { try { return !!a.BuffMgr.Find("dr_pt_guard") } catch (e) { return false } }
  var BOSS = {};
  function isBoss(a) {                                // MonsterConfig ExtParams: Tag=Boss
    var id = a.BaseID; if (BOSS[id] !== undefined) return BOSS[id];
    var r = monsterRow(id), b = false;
    if (r) b = /Boss/.test((field(r, "ExtParams").match(/Tag=([^;]*)/) || [])[1] || "");
    return (BOSS[id] = b);
  }
  function cam() { try { return CS.GamePlay.CameraDirector.Cur.MainCamera } catch (e) { return null } }
  function screen(c, a, dy) {
    var w = c.WorldToScreenPoint(new CS.UnityEngine.Vector3(a.Position.x, a.Position.y + (dy || 0), 0));
    return [w.x, w.y, w.z];
  }
  function onScreen(xy) {
    var W = CS.UnityEngine.Screen.width, H = CS.UnityEngine.Screen.height, m = 12;
    return xy[2] > 0 && xy[0] > m && xy[0] < W - m && xy[1] > m && xy[1] < H - m;
  }
  function centreY(a) { try { return Math.max(0.5, f(a.Attr.BoxHeight) * 0.5) } catch (e) { return 0.8 } }

  // ---------------------------------------------------------------- scripted test input (dev only; see CFG.testFile)
  var TST = { skill: false, dash: false, summon: false, dir: [0, 0], q: [], at: 0, poll: 0 };
  P.test = TST;
  function pollTest(now) {
    if (!TST.q.length) {
      if (now < TST.poll) return;
      TST.poll = now + 0.25;
      try {
        if (!CS.System.IO.File.Exists(CFG.testFile)) return;
        var txt = String(CS.System.IO.File.ReadAllText(CFG.testFile)); CS.System.IO.File.Delete(CFG.testFile);
        TST.q = txt.split(/\r?\n/).map(function (l) { return l.trim() }).filter(function (l) { return l && l[0] !== "#" });
        TST.at = now; log("TEST script: " + TST.q.length + " lines");
      } catch (e) { log("TEST file unreadable: " + e); return }
    }
    while (TST.q.length && now >= TST.at) {
      var a = TST.q.shift().split(/\s+/), c = a[0];
      if (c === "skill") TST.skill = a[1] === "1";
      else if (c === "dash") TST.dash = a[1] === "1";
      else if (c === "summon") TST.summon = a[1] === "1";
      else if (c === "pose") P.pose();
      else if (c === "dance") P.dance();
      else if (c === "tpmax") P.tensionMax();                       // TEST tpmax: Tension's MAX moment now
      else if (c === "soul") { S.soulForce = a[1] === "off" || !a[1] ? null : a[1]; log("TEST soul " + (S.soulForce || "off")) }   // TEST soul fall|break|form|off
      else if (c === "dir") TST.dir = [+a[1] || 0, +a[2] || 0];
      else if (c === "wait") TST.at = now + (+a[1] || 0) / 1000;
      else if (c === "mark") log("TEST MARK " + a.slice(1).join(" "));
      else if (c === "state") logState();
      else if (c === "probe") logProbe();
      else if (c === "respawn") { resetParty(); log("TEST respawn: the companions are recreated") }
      else if (c === "leave") { dismissParty("test"); for (var ln in F) F[ln].wait = +a[1] || 3 }   // TEST leave [s]: they go, and re-join after s
      else if (c === "show") {                     // force the companions' visibility members (which one hides them?)
        for (var sn in F) { var sb = F[sn].b; if (!sb) continue;
          var what = a[1] || "all";
          try { if (what === "all" || what === "logic") sb.SetLogicAlpha(1) } catch (e) { log("TEST show LogicAlpha: " + e) }
          try { if (what === "all" || what === "grass") { sb.SetGrassAlpha(1); sb.IsVisibleGrass = true } } catch (e) { log("TEST show grass: " + e) }
          try { if (what === "all" || what === "hide") sb.IsVisibleHide = true } catch (e) { log("TEST show hide: " + e) }
        }
        log("TEST show " + (a[1] || "all"));
      }
      else if (c === "alpha") {                    // TEST alpha <v>: SetLogicAlpha(v) once on both companions
        for (var an in F) { try { if (F[an].b) F[an].b.SetLogicAlpha(+a[1]) } catch (e) { log("TEST alpha: " + e) } }
        log("TEST alpha " + a[1]);
      }
      else if (c === "automat") { S.autoMat = a[1] !== "0"; log("TEST automat " + S.autoMat) }
      else if (c === "nomat") {                    // TEST nomat: take the companions' material away again (to compare)
        for (var nn in F) { try { if (F[nn].mr) F[nn].mr.sharedMaterial = null } catch (e) {} }
        log("TEST nomat");
      }
      else if (c === "holdalpha") { S.forceAlpha = a[1] === "off" ? null : +a[1]; log("TEST holdalpha " + S.forceAlpha) }
      else if (c === "matfix") { try { matFix(a[1] || "neutral") } catch (e) { log("TEST matfix failed: " + e) } }
      else if (c === "sort") {                     // TEST sort <order> [layer]: the companions' sorting
        for (var so in F) { try { if (F[so].mr) { if (a[2]) F[so].mr.sortingLayerName = a[2]; F[so].mr.sortingOrder = +a[1]; F[so].sortHold = true } } catch (e) { log("TEST sort: " + e) } }
        log("TEST sort " + a.slice(1).join(" "));
      }
      else if (c === "rz") {                       // TEST rz <z>: the companions' renderer z
        for (var zo in F) { try { if (F[zo].mr) { var zp = F[zo].mr.transform.localPosition; F[zo].mr.transform.localPosition = new V3(zp.x, zp.y, +a[1]) } } catch (e) { log("TEST rz: " + e) } }
        log("TEST rz " + a[1]);
      }
      else if (c === "mat") {                      // TEST mat: Kris's sprite material onto the companions' renderers
        try {
          var MR = PU.$typeof(CS.UnityEngine.MeshRenderer), km = S.pl.gameObject.GetComponentInChildren(MR, true).sharedMaterial;
          for (var mn in F) { if (F[mn].b) { var fr = F[mn].b.gameObject.GetComponentInChildren(MR, true); fr.sharedMaterial = km; log("TEST mat " + mn + " <- " + km.name) } }
        } catch (e) { log("TEST mat failed: " + e) }
      }
      else if (!potCall("test", [c, a.slice(1)])) log("TEST ? " + a.join(" "));
    }
  }

  function probeActor(tag, a) {                     // TEST probe: an actor's objects and renderers, as the game holds them
    var out = [tag];
    function tryv(label, fn) { try { var v = fn(); out.push(label + "=" + v) } catch (e) { out.push(label + "=!" + String(e).slice(0, 40)) } }
    tryv("action", function () { return a.ActionMgr.CurrentActionName });
    tryv("pos", function () { return a.Position.x.toFixed(2) + "," + a.Position.y.toFixed(2) });
    tryv("dir", function () { return a.Dir });
    tryv("active", function () { return a.ActiveState });
    tryv("visible", function () { return a.IsVisible });
    tryv("skin", function () { return a.SkinName });
    tryv("LogicAlpha", function () { return a.LogicAlpha });
    tryv("GrassAlpha", function () { return a.GrassAlpha });
    tryv("IsVisibleGrass", function () { return a.IsVisibleGrass });
    tryv("IsVisibleHide", function () { return a.IsVisibleHide });
    tryv("model", function () { var m = a.ActorModel; return m && !IsNull(m) ? m.GetType().Name + " on " + m.gameObject.name + " active " + m.gameObject.activeInHierarchy : "none" });
    var go = null, names = ["gameObject", "GameObject", "Go", "Root", "ModelRoot"];
    for (var i = 0; i < names.length && !go; i++) { try { var g = a[names[i]]; if (g && !IsNull(g) && g.transform) { go = g; out.push("go via " + names[i]) } } catch (e) {} }
    if (!go) { try { var t0 = a.transform || a.Transform; if (t0 && !IsNull(t0)) { go = t0.gameObject; out.push("go via transform") } } catch (e) {} }
    if (!go) { try { var m0 = a.Model || a.ActorModel || a.Anim; if (m0 && !IsNull(m0)) { go = m0.gameObject; out.push("go via model") } } catch (e) {} }
    log("TEST PROBE " + out.join(" | "));
    if (!go) { log("TEST PROBE " + tag + ": no GameObject reachable"); return }
    try {
      var tr = go.transform;
      log("TEST PROBE " + tag + " object " + go.name + " activeSelf " + go.activeSelf + " inHierarchy " + go.activeInHierarchy + " layer " + go.layer +
          " world " + tr.position.x.toFixed(2) + "," + tr.position.y.toFixed(2) + "," + tr.position.z.toFixed(2) +
          " scale " + tr.lossyScale.x.toFixed(3) + "," + tr.lossyScale.y.toFixed(3) + " parent " + (tr.parent ? tr.parent.name : "-") + " children " + tr.childCount);
      var rs = go.GetComponentsInChildren(PU.$typeof(CS.UnityEngine.Renderer), true), n = rs.Length;
      log("TEST PROBE " + tag + " renderers: " + n);
      for (var j = 0; j < n && j < 8; j++) {
        var r = rs.get_Item(j), line = [];
        try { line.push(r.gameObject.name + " (" + r.GetType().Name + ")") } catch (e) { line.push("?") }
        try { line.push("enabled " + r.enabled + " goActive " + r.gameObject.activeInHierarchy + " visible " + r.isVisible) } catch (e) {}
        try { line.push("sort " + r.sortingLayerName + "/" + r.sortingOrder) } catch (e) {}
        try { var tp = r.transform.position, ls = r.transform.lossyScale; line.push("at " + tp.x.toFixed(2) + "," + tp.y.toFixed(2) + "," + tp.z.toFixed(2) + " scale " + ls.x.toFixed(3) + "," + ls.y.toFixed(3)) } catch (e) {}
        try { var mt = r.sharedMaterial; line.push("mat " + (mt ? mt.name + " shader " + mt.shader.name : "NONE")) } catch (e) { line.push("mat !" + String(e).slice(0, 30)) }
        try { var mt2 = r.sharedMaterial; if (mt2 && mt2.HasProperty("_Color")) { var c0 = mt2.GetColor("_Color"); line.push("_Color a " + c0.a.toFixed(2)) } } catch (e) {}
        try { var mt4 = r.sharedMaterial; if (mt4) line.push("queue " + mt4.renderQueue + " layer " + r.gameObject.layer + " z " + r.transform.position.z.toFixed(3)) } catch (e) {}
        try { log("TEST PROBE " + tag + " r" + j + " props: " + matProps(r.sharedMaterial)) } catch (e) { log("TEST PROBE " + tag + " props failed: " + e) }
        try { var mt3 = r.sharedMaterial; if (mt3 && mt3.HasProperty("_MainTex")) { var tx = mt3.GetTexture("_MainTex"); line.push("tex " + (tx ? tx.name + " " + tx.width + "x" + tx.height : "NONE")) } } catch (e) {}
        try { var mf = r.gameObject.GetComponent(PU.$typeof(CS.UnityEngine.MeshFilter)); if (mf && !IsNull(mf)) line.push("mesh " + (mf.sharedMesh ? mf.sharedMesh.name + " v" + mf.sharedMesh.vertexCount : "NONE")) } catch (e) {}
        try { var blk = new CS.UnityEngine.MaterialPropertyBlock(); r.GetPropertyBlock(blk); line.push("block empty " + blk.isEmpty);
              if (!blk.isEmpty) { try { line.push("blk _Alpha " + blk.GetFloat("_Alpha").toFixed(2)) } catch (e) {} try { var bc = blk.GetColor("_Color"); line.push("blk _Color a " + bc.a.toFixed(2)) } catch (e) {} } } catch (e) {}
        log("TEST PROBE " + tag + " r" + j + ": " + line.join(" | "));
      }
    } catch (e) { log("TEST PROBE " + tag + " failed: " + e) }
  }
  function matProps(m) {                              // every float and colour of a material's shader (dev)
    if (!m || IsNull(m)) return "no material";
    var sh = m.shader, n = sh.GetPropertyCount(), out = [];
    for (var i = 0; i < n; i++) {
      var nm = sh.GetPropertyName(i), ty = Number(sh.GetPropertyType(i));
      try {
        if (ty === 2 || ty === 3) { var v = m.GetFloat(nm); out.push(nm + "=" + (Math.round(v * 1000) / 1000)) }
        else if (ty === 0) { var c = m.GetColor(nm); out.push(nm + "=(" + [c.r, c.g, c.b, c.a].map(function (x) { return Math.round(x * 100) / 100 }).join(",") + ")") }
        else if (ty === 4) { var t = m.GetTexture(nm); if (t && !IsNull(t)) out.push(nm + "=" + t.name) }
      } catch (e) { out.push(nm + "=!") }
    }
    var kw = ""; try { var ks = m.shaderKeywords; var kk = []; for (var j = 0; j < ks.Length; j++) kk.push(ks.get_Item(j)); kw = " | keywords " + kk.join(",") } catch (e2) {}
    return n + " properties: " + out.join(" ") + kw;
  }
  function logCameras() {
    try {
      var cs = CS.UnityEngine.Camera.allCameras, n = cs.Length;
      for (var i = 0; i < n; i++) {
        var c = cs.get_Item(i), tt = null; try { tt = c.targetTexture } catch (e) {}
        log("TEST PROBE camera " + c.name + " depth " + c.depth + " mask " + c.cullingMask + " ortho " + c.orthographic + " size " + c.orthographicSize.toFixed(2) +
            " at " + c.transform.position.x.toFixed(2) + "," + c.transform.position.y.toFixed(2) + "," + c.transform.position.z.toFixed(2) +
            " target " + (tt && !IsNull(tt) ? tt.name : "screen") + " clear " + c.clearFlags);
      }
    } catch (e) { log("TEST PROBE cameras failed: " + e) }
  }
  var NEUTRAL = { _Alpha: 1, _AlphaScale: 1, _EnableDissolve: 0, _DissolveThreashold: 0.403, _EnableClip: 0, _EnableGrayscale: 0, _EnableGlow: 0,
                  _EnableTurbulence: 0, _EnableRemap: 0, _EnableRemapColor: 0, _EmissionIntensity: 0, _UseSceneLight: 0, _Stencil: 0, _StencilComp: 8, _ColorMask: 15, _ZTest: 4 };
  function matFix(how) {
    var MR = PU.$typeof(CS.UnityEngine.MeshRenderer), kr = S.pl.gameObject.GetComponentInChildren(MR, true), km = kr.sharedMaterial;
    for (var w in F) {
      var fo = F[w]; if (!fo.b || !fo.mr || IsNull(fo.mr)) continue;
      var m = fo.mr.sharedMaterial, done = [];
      if (how === "kris") {
        var tex = {}, names = ["_MainTex", "_Extra", "_Extra2", "_OutlineTex", "_EmissionTex"];
        for (var i = 0; i < names.length; i++) { try { tex[names[i]] = m.GetTexture(names[i]) } catch (e) {} }
        m.CopyPropertiesFromMaterial(km);
        for (var n2 in tex) { try { m.SetTexture(n2, tex[n2]) } catch (e) {} }
        done.push("copied Kris's values (own textures kept)");
      } else {
        for (var k in NEUTRAL) { try { if (m.HasProperty(k) && m.GetFloat(k) !== NEUTRAL[k]) { done.push(k + " " + m.GetFloat(k) + " -> " + NEUTRAL[k]); m.SetFloat(k, NEUTRAL[k]) } } catch (e) {} }
      }
      log("TEST matfix " + how + " " + w + ": " + (done.join(", ") || "nothing to change"));
    }
  }
  function logProbe() {
    logCameras();
    try { probeActor("kris", S.pl) } catch (e) { log("TEST PROBE kris failed: " + e) }
    for (var n in F) { if (F[n].b) { try { probeActor(n, F[n].b) } catch (e) { log("TEST PROBE " + n + " failed: " + e) } } else log("TEST PROBE " + n + ": no actor") }
  }
  function logState() {                            // TEST state: where everyone is (scripted checks read this)
    var p = S.pl, out = [];
    try { out.push("kris " + p.Position.x.toFixed(2) + "," + p.Position.y.toFixed(2) + " " + krisAction(p) + (grounded(p) ? " ground" : " air")) } catch (e) {}
    for (var n in F) { var f = F[n]; out.push(n + (alive(f) ? " " + f.x.toFixed(2) + "," + f.y.toFixed(2) + " " + f.act + (f.air ? " air" : "") : " absent")) }
    out.push("state " + S.state + ", who " + S.who + ", wait " + S.wait.susie.toFixed(2) + "/" + S.wait.ralsei.toFixed(2) +
             ", time scale " + (battle() ? battle().TimeScale.toFixed(2) : "?") + ", HUD " + (S.hudOn === false ? "hidden" : "shown"));
    log("TEST STATE " + out.join(" | "));
  }

  // ---------------------------------------------------------------- input (raw, so it reads while Kris's are blocked)
  function gim() {                  // GamePlay.GameInputManager (dump: namespace GamePlay), as stock JS reaches it
    try { return CS.GamePlay.GameInputManager.Instance || U.GetSingleton(CS.GamePlay.GameInputManager) } catch (e) {}
    try { return U.GetSingleton(CS.GamePlay.GameInputManager) } catch (e) { return null }
  }
  function held(p, cmd) {
    if (cmd === CS.GamePlay.InputCmd.Skill && TST.skill) return true;
    if (cmd === CS.GamePlay.InputCmd.Dash && TST.dash) return true;
    if (cmd === CS.GamePlay.InputCmd.Summon && TST.summon) return true;
    var g = gim();
    if (g) { try { return g.GetCommandHoldTime(cmd) > 0 } catch (e) {} }
    try { return !!p.Input.GetCmdStatus(cmd).Pressing } catch (e) { return false }
  }
  function own(p) {                 // once per battle: take the Skill button from Kris's row if it can be read raw
    if (S.owned === p) return;
    S.owned = p; S.ownSkill = false;
    var g = gim(), ok = false; try { g.GetCommandHoldTime(CS.GamePlay.InputCmd.Skill); ok = true } catch (e) {}
    if (ok) {
      try { p.Input.AddInputCmdBlock(CS.GamePlay.InputCmd.Skill, CS.GamePlay.InputCmdBlockSource.Script); S.ownSkill = true } catch (e) {}
    }
    log("Skill button: " + (S.ownSkill ? "owned by the command (raw input)" : "left to Kris's row (fallback placeholder)"));
  }
  function rewired() {
    if (S.rw !== undefined) return S.rw;
    S.rw = null;
    try {
      var acts = CS.Rewired.ReInput.mapping.Actions, all = [], h = null, v = null, btn = {};
      for (var i = 0; i < acts.Count; i++) {
        var a = acts.get_Item(i), n = String(a.name), t = String(a.type), lo = n.toLowerCase();
        all.push(a.id + ":" + n + (t.indexOf("Axis") >= 0 || t === "0" ? "(axis)" : ""));
        if (/^ui|menu|camera|map|zoom|scroll/.test(lo)) continue;
        if (h === null && /hori|move.?x|leftright|left_right/.test(lo)) h = a.id;
        if (v === null && /vert|move.?y|updown|up_down/.test(lo)) v = a.id;
        if (/^(move)?.?left$/.test(lo)) btn.left = a.id; if (/^(move)?.?right$/.test(lo)) btn.right = a.id;
        if (/^(move)?.?up$/.test(lo)) btn.up = a.id; if (/^(move)?.?down$/.test(lo)) btn.down = a.id;
      }
      S.rw = { pl: CS.Rewired.ReInput.players.GetPlayer(0), h: h, v: v, btn: btn };
      log("Rewired actions: " + all.join(", "));
      log("stick from Rewired: horizontal " + h + ", vertical " + v + ", buttons " + JSON.stringify(btn));
    } catch (e) { log("Rewired not readable: " + e) }
    return S.rw;
  }
  function stick(p) {
    if (TST.dir[0] || TST.dir[1]) return TST.dir.slice();
    var r = rewired(), x = 0, y = 0;
    if (r) {
      try {
        if (r.h !== null) x = r.pl.GetAxisRaw(r.h); if (r.v !== null) y = r.pl.GetAxisRaw(r.v);
        if (!x && r.btn.left !== undefined && r.pl.GetButton(r.btn.left)) x = -1;
        if (!x && r.btn.right !== undefined && r.pl.GetButton(r.btn.right)) x = 1;
        if (!y && r.btn.down !== undefined && r.pl.GetButton(r.btn.down)) y = -1;
        if (!y && r.btn.up !== undefined && r.pl.GetButton(r.btn.up)) y = 1;
      } catch (e) { if (!S.rwErr) { S.rwErr = 1; log("Rewired read failed: " + e) } }
    }
    if (!x && !y) { try { var c = U.Fp2ToVector2(p.Input.GetMoveDirFromPureInputCache()); x = c.x; y = c.y } catch (e) {} }
    if ((x || y) && !S.stickSeen) { S.stickSeen = 1; log("stick reads " + x.toFixed(2) + "," + y.toFixed(2)) }
    return [x, y];
  }
  var BLOCK = ["Attack", "Skill", "Dash", "Jump", "Summon", "Move", "CustomUse1", "CustomUse2"];
  function block(p, on) {
    if (S.blocked === on) return;
    var src = CS.GamePlay.InputCmdBlockSource.Script;
    for (var i = 0; i < BLOCK.length; i++) {
      var c = CS.GamePlay.InputCmd[BLOCK[i]];
      if (!on && BLOCK[i] === "Skill" && S.ownSkill) continue;
      try { on ? p.Input.AddInputCmdBlock(c, src) : p.Input.RemoveInputCmdBlock(c, src) } catch (e) {}
    }
    S.blocked = on;
  }

  function hudShow(on) {
    if (S.hudOn === on) return;
    S.hudOn = on;
    try {
      var go = S.hud && S.hud.CsObj; if (!go || IsNull(go)) return;
      var cv = go.GetComponent(PU.$typeof(CS.UnityEngine.Canvas));
      if (cv && !IsNull(cv)) { cv.enabled = on; return }
      var cg = go.GetComponent(PU.$typeof(CS.UnityEngine.CanvasGroup));
      if (!cg || IsNull(cg)) cg = addComp(go, CS.UnityEngine.CanvasGroup);
      if (!on) { S.hudAlpha = cg.alpha; cg.alpha = 0 } else cg.alpha = S.hudAlpha === undefined ? 1 : S.hudAlpha;
    } catch (e) { if (!S.hudErr) { S.hudErr = 1; log("HUD hide failed: " + e) } }
  }

  // ---------------------------------------------------------------- time scale
  function setScale(target, dt) {
    var b = battle(); if (!b) return;
    try { if (BattleJs_1.default.Instance.PauseCount > 0) return } catch (e) {}   // a pause owns it; we re-apply after
    var cur = b.TimeScale;
    if (S.ts !== null && Math.abs(cur - S.ts) > 0.001 && Math.abs(cur - 1) > 0.001) return;   // someone else set it
    var step = dt / CFG.ease, next = cur + Math.max(-step, Math.min(step, target - cur));
    if (Math.abs(next - target) < 0.002) next = target;
    b.TimeScale = next; S.ts = next;
  }
  function restoreScale() {
    var b = battle(); if (!b) return;
    try { if (S.ts !== null && Math.abs(b.TimeScale - S.ts) < 0.001) b.TimeScale = 1 } catch (e) {}
    S.ts = null;
  }

  // ---------------------------------------------------------------- the Potentials (js/potentials.js) read and steer the command
  var MODS0 = { rb: {}, fs: {}, guard: { ignore: false }, recharge: null, minCycle: 0.45, dual: false, dualDelay: 0.25, follow: null };
  function M() { return P.mods || MODS0 }
  function pots() { return P.pots || null }
  function potCall(name, args) {                  // a Potential hook never breaks the command
    var h = pots(); if (!h || typeof h[name] !== "function") return undefined;
    try { return h[name].apply(h, args) } catch (e) { if (!S.potErr) { S.potErr = 1; log("Potentials hook " + name + " failed: " + e) } }
  }
  function rechargeOf(w) { var r = M().recharge; return (r && r[w] > 0) ? r[w] : CFG.recharge[w] }
  function guardedNow(a) { return guarded(a) && !(M().guard && M().guard.ignore) }
  P.cut = function (who, secs) {                  // shorten a recharge, never below the minimum cycle since the last shot
    var ws = who === "both" ? ["susie", "ralsei"] : [who];
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], floor = (S.fireAt[w] === undefined ? -1e9 : S.fireAt[w]) + (M().minCycle || 0) - S.bnow;
      S.wait[w] = Math.max(0, S.wait[w] - secs, floor);
    }
  };
  P.launch = function (action, x, y, dx, dy, tgt, opts) {
    var p = S.pl; if (!p) return null;
    var skill = null; try { skill = p.SkillMgr.FindSkillByActionName(CFG.row) } catch (e) {}
    var b = shoot(p, action, x, y, dx, dy, skill ? skill.SkillActivate : null, tgt || null);
    if (b && opts && opts.track) S.flying.push({ b: b, tgt: tgt, name: action, t: 0 });
    return b;
  };
  P.enemies = function () { return S.pl ? enemies(S.pl) : [] };
  P.fire = function (who, tgt, mul) {             // a companion acts on its own (Pen of Hope): true if the shot left;
    var p = S.pl; if (!p || !tgt || S.state === "aim" || !ready(who)) return false;   // mul stretches that shot's recharge
    try { if (tgt.IsDead) return false } catch (e) { return false }
    var keep = S.lastTgt;
    fire(p, who, tgt); S.lastTgt = keep;          // an auto shot does not move the player's own default target
    if (mul > 0 && mul !== 1) { S.wait[who] *= mul; S.full[who] *= mul }
    return true;
  };
  P.held = function (name) { var p = S.pl, c = CS.GamePlay.InputCmd[name]; return !!p && c !== undefined && held(p, c) };
  P.sfx = function (name) { sfx(name) };
  P.isBoss = function (a) { try { return !!a && isBoss(a) } catch (e) { return false } };
  P.onScreen = function (a) { try { var c = cam(); return !!c && !!a && onScreen(screen(c, a, centreY(a))) } catch (e) { return false } };
  P.pose = function () {                          // the Fun Gang's pose: the whole party stops where it is (strikePose)
    if (!S.pl || !CFG.pose) return false;
    S.poseQ = CFG.pose.delay > 0 ? CFG.pose.delay : 0.05;
    return true;
  };
  P.isReady = function (w) { return ready(w) };
  P.isGuarded = function (a) { return guarded(a) };
  P.log = function (s2) { log(s2) };
  // P.fireAt (set where S is made): battle time of each companion's last shot

  // ---------------------------------------------------------------- who acts
  function ready(w) { return S.wait[w] <= 0 }
  function defaultWho() { return ready("susie") ? "susie" : (ready("ralsei") ? "ralsei" : null) }

  // ---------------------------------------------------------------- targets
  function nearestInFront(p, list, c) {
    var best = null, bd = 1e9, dir = p.Dir >= 0 ? 1 : -1, any = null, ad = 1e9;
    for (var i = 0; i < list.length; i++) {
      var a = list[i], xy = screen(c, a, centreY(a)); if (!onScreen(xy)) continue;
      var dx = a.Position.x - p.Position.x, d = Math.abs(dx) + Math.abs(a.Position.y - p.Position.y) * 0.5;
      if (d < ad) { ad = d; any = a }
      if (dx * dir >= -0.3 && d < bd) { bd = d; best = a }
    }
    return best || any;
  }
  // the lead, 2026-10-03: "skill and auto should take priority with the main boss its closest to over enemies even if
  // the regular enemy is closer": the nearest boss on screen is the default target; without one, the nearest in front
  function defaultTarget(p, list, c) {
    var best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var a = list[i]; if (!isBoss(a) || !onScreen(screen(c, a, centreY(a)))) continue;
      var d = Math.abs(a.Position.x - p.Position.x) + Math.abs(a.Position.y - p.Position.y) * 0.5;
      if (d < bd) { bd = d; best = a }
    }
    return best || nearestInFront(p, list, c);
  }
  function stepAcross(p, list, c, dir, noWrap) { // the next enemy to the left / right in screen order
    var cand = [];
    for (var i = 0; i < list.length; i++) { var xy = screen(c, list[i], centreY(list[i])); if (onScreen(xy)) cand.push({ a: list[i], x: xy[0], id: +list[i].UniqueId || 0 }) }
    cand.sort(function (q, r) { return q.x - r.x || q.id - r.id });
    if (!cand.length) return null;
    var at = -1; for (var j = 0; j < cand.length; j++) if (cand[j].a === S.sel) at = j;
    if (at < 0) {                                 // from Kris: the first one on that side, else the nearest end
      var kx = screen(c, p, 1.0)[0];
      for (var k = dir > 0 ? 0 : cand.length - 1; k >= 0 && k < cand.length; k += dir) if ((cand[k].x - kx) * dir > 0) return cand[k].a;
      return cand[dir > 0 ? cand.length - 1 : 0].a;
    }
    if (cand.length < 2) return null;
    if (noWrap && (at + dir < 0 || at + dir >= cand.length)) return null;          // a held direction stops at the end
    return cand[(at + dir + cand.length) % cand.length].a;        // a press wraps at the ends of the row
  }
  function move(p, list, c, dx, dy, held) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      var nxt = stepAcross(p, list, c, dx > 0 ? 1 : -1, !!held);
      if (held && !nxt) return;                     // a held direction at the row's end: nothing, and no fail sound
      if (nxt && nxt !== S.sel) { S.sel = nxt; S.lastTgt = nxt; S.stickyMine = true; sfx(ready(S.who) ? "move" : "fail"); log("cursor -> " + nxt.BaseID + "#" + nxt.UniqueId) }
      else { ui_fail(); sfx("fail") }
      return;
    }
    // up / down: DELTARUNE's find_best_target, in screen space
    var from = S.sel ? screen(c, S.sel, centreY(S.sel)) : screen(c, p, 1.0);
    var press = Math.atan2(dy, dx) * 180 / Math.PI, n = 0, best = null, bd = 1e9, ba = 1e9;
    for (var i = 0; i < list.length; i++) if (list[i] !== S.sel && onScreen(screen(c, list[i], centreY(list[i])))) n++;
    var lim = n === 1 ? CFG.angleOne : CFG.angle;
    for (var j = 0; j < list.length; j++) {
      var a = list[j]; if (a === S.sel) continue;
      var xy = screen(c, a, centreY(a)); if (!onScreen(xy)) continue;
      var vx = xy[0] - from[0], vy = xy[1] - from[1], d = Math.sqrt(vx * vx + vy * vy);
      var ang = Math.abs(((Math.atan2(vy, vx) * 180 / Math.PI - press + 540) % 360) - 180);
      if (ang < lim && d < bd + (ba - ang) * 2) { best = a; bd = d; ba = ang }
    }
    if (!best) {                                    // nobody inside the cone: the nearest enemy above / below at all
      var up = dy > 0 ? 1 : -1, bv = 1e9;
      for (var q2 = 0; q2 < list.length; q2++) {
        var e2 = list[q2]; if (e2 === S.sel) continue;
        var x2 = screen(c, e2, centreY(e2)); if (!onScreen(x2)) continue;
        var dv = (x2[1] - from[1]) * up; if (dv <= 8) continue;
        var cost = dv + Math.abs(x2[0] - from[0]) * 0.5; if (cost < bv) { bv = cost; best = e2 }
      }
    }
    if (best) { S.sel = best; S.lastTgt = best; S.stickyMine = true; sfx(ready(S.who) ? "move" : "fail"); log("cursor -> " + best.BaseID + "#" + best.UniqueId) }
    else { ui_fail(); sfx("fail") }
  }

  // ---------------------------------------------------------------- firing (projectiles booked to Kris's Skill row)
  function fire(p, who, tgt, dual) {
    var w = CFG.who[who], f = F[who];
    var skill = null; try { skill = p.SkillMgr.FindSkillByActionName(CFG.row) } catch (e) {}
    var sa = skill ? skill.SkillActivate : null;
    if (!alive(f)) spawn(p, who);
    var ok = alive(f);
    if (ok) { f.cast = w.lengths.cast; f.face = tgt.Position.x >= f.x ? 1 : -1; act(f, "cast", true) }
    S.shots.push({ t: w.swing, who: who, tgt: tgt, sa: sa, dual: !!dual }); S.lastTgt = tgt;
    S.wait[who] = S.full[who] = rechargeOf(who); S.fireAt[who] = S.bnow;
    log("command " + who + " -> " + tgt.BaseID + "#" + tgt.UniqueId + (guarded(tgt) ? " (guarding)" : "") +
        (ok ? " from " + f.x.toFixed(2) + "," + f.y.toFixed(2) : " [no " + who + " on screen]") +
        (sa ? "" : " [no " + CFG.row + " row: damage unbooked]"));
  }
  function shoot(p, action, x, y, dx, dy, sa, tgt) {
    try {
      var bm = battle().BulletMgr;
      var b = bm.CreateBulletByParams(p, CFG.bullet, U.Vector2ToFp2(new CS.UnityEngine.Vector2(x, y)),
                                      U.Vector2ToFp2(new CS.UnityEngine.Vector2(dx, dy)), U.FloatToFp(1), action, sa, null);
      if (b && tgt) { try { b.TargetMgr.SetTarget(tgt) } catch (e) {} }
      return b;
    } catch (e) { log("projectile " + action + " failed: " + e); return null }
  }
  function watchShots() {
    for (var i = S.watch.length - 1; i >= 0; i--) {
      var o = S.watch[i]; o.n++;
      if (o.n !== 2 && o.n !== 12) { if (o.n > 12) S.watch.splice(i, 1); continue }
      var st = "?";
      try { st = IsNull(o.b) ? "gone" : (o.b.IsDead ? "dead " : "") + String(o.b.ActionMgr.CurrentActionName) + " at " +
            o.b.Position.x.toFixed(2) + "," + o.b.Position.y.toFixed(2) } catch (e) { st = "unreadable: " + e }
      log(o.name + " +" + o.n + " frames (left " + o.x.toFixed(2) + "," + o.y.toFixed(2) + "): " + st);
    }
  }
  function retarget(p, bdt) {
    for (var i = S.flying.length - 1; i >= 0; i--) {
      var o = S.flying[i]; o.t += bdt;
      var live = false; try { live = !IsNull(o.b) && !o.b.IsDead && String(o.b.ActionMgr.CurrentActionName) === o.name } catch (e) {}
      if (!live || o.t > 2) { S.flying.splice(i, 1); continue }
      var dead = true; try { dead = !o.tgt || o.tgt.IsDead } catch (e) {}
      if (!dead) continue;
      var best = null, bd = 100, bx = 0, by = 0;
      try { bx = o.b.Position.x; by = o.b.Position.y } catch (e) { continue }
      var L = enemies(p);
      for (var j = 0; j < L.length; j++) {
        var d = Math.abs(L[j].Position.x - bx) + Math.abs(L[j].Position.y - by);
        if (d < bd) { bd = d; best = L[j] }
      }
      o.tgt = best;
      if (best) { try { o.b.TargetMgr.SetTarget(best); log(o.name + " re-targets " + best.BaseID + "#" + best.UniqueId) } catch (e) {} }
    }
  }
  function launches(p, bdt) {                   // the bolt leaves on the cast's swing frame (battle time), from the companion
    for (var i = S.shots.length - 1; i >= 0; i--) {
      var s = S.shots[i]; s.t -= bdt; if (s.t > 0) continue;
      S.shots.splice(i, 1);
      var w = CFG.who[s.who], f = F[s.who], dir = f.face || 1;
      var ox = alive(f) ? f.x : p.Position.x, oy = alive(f) ? f.y : p.Position.y;
      var x = ox + dir * w.muzzle[0], y = oy + w.muzzle[1];
      var tgt = s.tgt, tx = x + dir * 3, ty = y;
      try { if (tgt && !tgt.IsDead) { tx = tgt.Position.x; ty = tgt.Position.y + centreY(tgt) } } catch (e) {}
      var vx = tx - x, vy = ty - y, n = Math.sqrt(vx * vx + vy * vy) || 1;
      var sec = (s.who === "susie" ? M().rb : M().fs) || {}, base = sec.action || w.bolt;
      var gu = tgt && guardedNow(tgt);                          // DELTARUNE's red bolt on a guarding target
      var bolt = gu ? (sec.guardAction || (s.who === "susie" ? w.boltRed : null) || base) : (s.dual && sec.dualAction ? sec.dualAction : base);
      var b = shoot(p, bolt, x, y, vx / n, vy / n, s.sa, tgt);
      if (!b) S.wait[s.who] = 0;                              // nothing left: nothing spent
      else { S.watch.push({ b: b, n: 0, name: bolt, x: x, y: y }); S.flying.push({ b: b, tgt: tgt, name: bolt, t: 0 });
             potCall("onFire", [s.who, tgt, bolt, b, !!s.dual]) }
      log(bolt + (b ? " launched" : " NOT launched (recharge refunded)"));
    }
  }

  // ---------------------------------------------------------------- the companions: DELTARUNE's caterpillar
  // obj_plat_follower Step: each 30 fps frame, while Kris moves, is in the air or is far away, his position goes into a
  // history; a follower heads for the entry `dist` frames old, covering half the remaining distance each frame, faces
  // the way it moves, and plays its own stand / run / jump / fall / land / turn frames. When Kris stands still the
  // history stops, so they stop where they are instead of piling onto him. Driven here at 30 Hz in battle time.
  var F = { susie: { w: "susie" }, ralsei: { w: "ralsei" } }, H = [], HT = { acc: 0 };
  P.followers = F;
  // Projectiles are pooled: a companion is ours only while its object is in the battle's live list and plays one of its
  // own fol_ actions. A room change (BulletMgr.RemoveAllBullets) pools it: the pooled object keeps its action's name and
  // is neither null nor dead, so until 0.4.2 it looked alive until something reused it (the lead: "susie and ralsei
  // dont automatically spawn when kris enters a new room"; 4 to 26 s in the run of 2026-10-03). Asked once a tick.
  function alive(f) {
    if (f.aT === S.tickN && f.aV !== undefined) return f.aV;
    var v = false;
    try {
      if (f.b && !IsNull(f.b) && !f.b.IsDead) {
        var live = true;
        try { var BL = battle().BulletMgr.BulletList; if (BL && typeof BL.Contains === "function") live = !!BL.Contains(f.b) } catch (e2) {}
        if (live) v = f.fresh > 0 || String(f.b.ActionMgr.CurrentActionName).indexOf("fol_" + f.w + "_") === 0;
      }
    } catch (e) { v = false }
    f.aT = S.tickN; f.aV = v;
    return v;
  }
  function act(f, key, force) {
    if (!force && f.act === key) return;
    var name = CFG.who[f.w].actions[key];
    try { f.b.ActionMgr.ChangeAction(name); f.act = key }
    catch (e) { S.missing[name] = 1; f.act = key; log("follower " + f.w + " action " + name + " failed: " + e) }
  }
  function spawn(p, w) {
    var f = F[w], back = (w === "susie" ? 0.6 : 1.2) * (p.Dir >= 0 ? -1 : 1);
    f.x = p.Position.x + back; f.y = p.Position.y; f.face = p.Dir >= 0 ? 1 : -1;
    var skill = null; try { skill = p.SkillMgr.FindSkillByActionName(CFG.row) } catch (e) {}
    f.b = shoot(p, CFG.who[w].actions.stand, f.x, f.y, f.face, 0, skill ? skill.SkillActivate : null, null);
    f.act = "stand"; f.cast = 0; f.land = 0; f.turn = 0; f.air = false; f.vx = 0; f.vy = 0; f.fresh = 0.5; f.mr = null; f.matNew = true;
    f.pose = 0; f.aT = -1; f.enter = null; f.dx = f.x; f.dy = f.y; f.sep = 0; f.sepMoved = false;
    if (alive(f)) log(w + " joins at " + f.x.toFixed(2) + "," + f.y.toFixed(2));
    else { f.retry = (f.retry || 0) + 1; if (f.retry <= 3) log(w + " could not join (attempt " + f.retry + ")") }
  }
  function grounded(p) {
    try { var off = p.ActorPosition.IsOffGround; if (typeof off === "boolean") return !off } catch (e) {}
    if (!S.gErr) { S.gErr = 1; log("Kris's off-ground flag unreadable: followers use Kris's height instead") }
    return Math.abs(p.Position.y - (S.lastPy === undefined ? p.Position.y : S.lastPy)) < 0.001;
  }
  function krisAction(p) { try { return String(p.ActionMgr.CurrentActionName) } catch (e) { return "" } }
  function follow(p, bdt) {
    // 0.5.6: Kris fell and stayed down, so the companions went (drawSoul): nobody to place until Kris is back
    if (S.partyAway) {
      if (S.wasFell) return;
      S.partyAway = false; S.entered = false; log("Kris is back: the companions return");
    }
    var px = p.Position.x, py = p.Position.y, pg = grounded(p), ka = krisAction(p);
    var dj = ka === "jump2" && S.lastKa !== "jump2"; S.lastKa = ka;
    if (dj) HT.dj = true;                                                   // goes into the next history entry
    // a fresh history lines the party up behind Kris (0.1 u a frame back), so they don't start by walking onto him
    if (!H.length) for (var k = 0; k < 40; k++) H.push({ x: px - (p.Dir >= 0 ? 1 : -1) * k * 0.1, y: py, g: pg });
    HT.still = pg && Math.abs(px - (S.lastPx === undefined ? px : S.lastPx)) < 0.001 ? (HT.still || 0) + bdt : 0;
    S.lastPx = px; S.lastPy = py;
    for (var n in F) {
      var fn = F[n]; if (alive(fn)) continue;
      fn.wait = (fn.wait || 0) - bdt; if (fn.wait > 0) continue;
      spawn(p, n); if (!alive(fn)) fn.wait = 1.0;
    }
    entrance(p, ka);                                                        // (after the companions exist)
    reactions(p, ka);
    lowHp(p);
    HT.acc += bdt;
    var still = 2 * CFG.unitPerPx;                                          // DELTARUNE: "speed > 2" (px a frame)
    while (HT.acc >= 1 / 30) {
      HT.acc -= 1 / 30;
      var last = H[0], moving = Math.abs(px - last.x) > still || Math.abs(py - last.y) > still;
      var far = false, airborne = false;
      for (var m in F) {
        var g = F[m]; if (!alive(g)) continue;
        if (Math.abs(g.x - px) + Math.abs(g.y - py) >= 200 * CFG.unitPerPx) far = true;
        if (g.air) airborne = true;
      }
      if (moving || !pg || far || airborne || HT.dj) { H.unshift({ x: px, y: py, g: pg, dj: !!HT.dj }); HT.dj = false; if (H.length > 40) H.pop() }
      var fm = M().follow, ent = {};
      for (var w in F) ent[w] = H[Math.min(H.length - 1, (fm && fm.dist && fm.dist[w]) || CFG.who[w].dist)];
      spread(p, px, pg, ent);
      for (var w3 in F) step(F[w3], ent[w3], HT.still > 0.25 ? py : null);
    }
    for (var w2 in F) draw(F[w2], bdt);
  }
  function step(f, e, settleY) {                                              // one 30 Hz step toward the history entry
    if (!alive(f)) return;
    if (f.enter || f.pose > 0 || f.dance > 0) { f.px = f.x; f.py = f.y; f.vx = 0; f.vy = 0; f.fallV = 0; return }   // dropping in, posing or dancing: it stays where it is
    var ox = f.x, oy = f.y; f.px = f.x; f.py = f.y;
    if (f.cast <= 0) { f.x += (e.x + (f.sep || 0) - f.x) * 0.5; f.y += (e.y - f.y) * 0.5 }
    if (e.dj && f.lastDj !== e) { f.lastDj = e; f.spin = CFG.who[f.w].lengths.spin; log(f.w + " double jumps") }
    // Kris stands: a companion left IN THE AIR falls to his floor. One whose history entry was on the ground (a higher
    // platform Kris stood on) stays there, as in DELTARUNE: it used to fall through that platform.
    if (settleY !== null && !e.g && f.y > settleY + 0.05) {
      f.fallV = (f.fallV || 0) + 1.2; f.y = Math.max(settleY, f.y - f.fallV / 30);
      if (!f.floatLog) { f.floatLog = 1; log(f.w + " was left " + (oy - settleY).toFixed(2) + " u above Kris's floor (entry g " + e.g + "): falls") }
    } else f.fallV = 0;
    f.vx = (f.x - ox) * 30; f.vy = (f.y - oy) * 30;
    var wasAir = f.air; f.air = (!e.g && settleY === null) || Math.abs(e.y - f.y) > 0.25 || (f.fallV || 0) > 0;
    if (wasAir && !f.air) f.land = CFG.who[f.w].lengths.land;
    if (f.cast <= 0 && Math.abs(f.vx) > 0.3) {
      var face = f.vx > 0 ? 1 : -1;
      if (face !== f.face && !f.air) f.turn = CFG.who[f.w].lengths.turn;
      f.face = face;
    }
  }
  // Standing still, the party stands apart (0.5.1). DELTARUNE's followers stop on their own history entries, and after
  // a straight drop or a short hop those are one spot: Susie and Ralsei stood inside each other (their "AUTO" tags
  // too: the lead, "the auto tag kinda lags and glitches out") or inside Kris. While Kris stands on the ground, each
  // keeps CFG.apart from Kris and from the other one: it shuffles there at a walk and then faces as Kris does. The
  // offset eases away again once Kris moves on.
  function spread(p, px, pg, ent) {
    var A = CFG.apart > 0 ? CFG.apart : 0.7, on = pg && HT.still > 0.25, want = {}, back = p.Dir >= 0 ? -1 : 1, order = ["susie", "ralsei"];
    if (on) for (var i = 0; i < order.length; i++) {
      var w = order[i], fo = F[w], e = ent[w]; if (!fo || !e || !alive(fo) || fo.air || fo.enter) continue;
      var x = e.x;
      if (Math.abs(x - px) < A) x = px + (Math.abs(x - px) > 0.05 ? (x > px ? 1 : -1) : back) * A;
      var o = want[order[0]];
      if (i > 0 && o !== undefined && Math.abs(x - o) < A) x = o + (Math.abs(o - px) > 0.05 ? (o > px ? 1 : -1) : back) * A;   // further out than Susie
      want[w] = x;
    }
    for (var n in F) {
      var f2 = F[n], t = want[n] !== undefined ? want[n] - ent[n].x : 0, d = t - (f2.sep || 0);
      f2.sep = (f2.sep || 0) + Math.max(-0.05, Math.min(0.05, d));
      if (Math.abs(d) >= 0.001) { if (Math.abs(t) > 0.01) f2.sepMoved = true }
      else if (on && f2.sepMoved && Math.abs(f2.vx || 0) < 0.3 && alive(f2)) {
        f2.sepMoved = false;
        var face = p.Dir >= 0 ? 1 : -1;
        if (f2.face !== face && !f2.air && !(f2.cast > 0)) { f2.face = face; f2.turn = CFG.who[n].lengths.turn }
      }
      if (!on) f2.sepMoved = false;
    }
  }
  function dashLook(f) {                              // the Party Dash: the companions run in their dash look
    var fm = M().follow, name = CFG.who[f.w].actions.dash;
    return !!fm && fm.act === "dash" && !!name && !S.missing[name];
  }
  // tearing after a dashing Kris (faster than CFG.sprint u/s): the companion's stronger run; it holds for 0.25 s so a
  // dash's short burst does not flicker between the two runs
  function sprintLook(f) {
    var name = CFG.who[f.w].actions.sprint; if (!name || S.missing[name]) return false;
    if (Math.abs(f.vx) > (CFG.sprint || 9.5)) f.sprintT = 0.25;
    return f.sprintT > 0;
  }
  function readyLook(f) { return S.state === "aim" && S.who === f.w && ready(f.w) && !f.air }   // the one about to act
  function place_(f) {                                // (the end of draw for the looks that return early)
    var k = Math.min(1, HT.acc * 30), dx = f.px === undefined ? f.x : f.px + (f.x - f.px) * k, dy = f.py === undefined ? f.y : f.py + (f.y - f.py) * k;
    f.dx = dx; f.dy = dy;                             // where it is drawn: what the HUD pins its tag and bar to
    try { f.b.Position = new CS.UnityEngine.Vector2(dx, dy); f.b.Dir = f.face } catch (e) {}
    ensureMaterial(f);
  }
  function draw(f, bdt) {
    if (!alive(f)) return;
    f.cast = Math.max(0, f.cast - bdt); f.land = Math.max(0, f.land - bdt); f.turn = Math.max(0, f.turn - bdt);
    f.fresh = Math.max(0, (f.fresh || 0) - bdt); f.spin = Math.max(0, (f.spin || 0) - bdt);
    f.pose = Math.max(0, (f.pose || 0) - bdt); f.sprintT = Math.max(0, (f.sprintT || 0) - bdt);
    if (f.enter) {                                    // the entrance: the jump ball down to the ground beside Kris, then the pose
      f.enter.t += bdt;
      var ek = Math.min(1, f.enter.t / ENTER.drop);
      f.y = f.enter.gy + ENTER.up * (1 - ek * ek); f.px = f.x; f.py = f.y;
      if (ek >= 1) { f.enter = null; f.py = f.y; f.pose = 1.9; act(f, "pose", true) }
      else act(f, S.missing[CFG.who[f.w].actions.spin] ? "fall" : "spin", false);
      f.dx = f.x; f.dy = f.y;
      try { f.b.Position = new CS.UnityEngine.Vector2(f.x, f.y); f.b.Dir = f.face } catch (e) {}
      ensureMaterial(f);
      return;
    }
    if (S.entering && f.pose > 0 && f.pose < 0.3) f.pose = 0.3;      // held while Kris's entrance plays (the action's own length caps it)
    f.dance = Math.max(0, (f.dance || 0) - bdt); f.shock = Math.max(0, (f.shock || 0) - bdt);
    f.halt = Math.max(0, (f.halt || 0) - bdt); f.fidget = Math.max(0, (f.fidget || 0) - bdt);
    var A = CFG.who[f.w].actions, can = function (k) { return !!A[k] && !S.missing[A[k]] };
    if (f.pose > 0 && can("pose")) { act(f, "pose", false); place_(f); return }
    if (f.dance > 0 && can("dance")) { act(f, "dance", false); place_(f); return }
    if (f.cast <= 0 && f.shock > 0 && can("shock")) { act(f, "shock", false); place_(f); return }
    var key = f.pose > 0 && !S.missing[CFG.who[f.w].actions.pose] ? "pose" : f.cast > 0 ? "cast" : f.spin > 0 && f.air && !S.missing[CFG.who[f.w].actions.spin] ? "spin"
            : f.air ? (f.vy > 0.3 ? "jump" : "fall") : f.turn > 0 ? "turn" : f.land > 0 ? "land"
            : f.halt > 0 && can("halt") ? "halt"
            : Math.abs(f.vx) > 0.8 ? (dashLook(f) ? "dash" : sprintLook(f) ? "sprint" : "run")
            : readyLook(f) && can("ready") ? "ready" : "stand";
    if (S.low && (key === "stand" || key === "run") && can(key + "_low")) key += "_low";   // Kris's HP is low: the unhappy set
    // idle fidgets: after 6 to 10 s of standing (Kris standing too, nothing aimed), the companion's own little animation
    if (key === "stand" && S.state === "idle" && HT.still > 2) {
      f.idleT = (f.idleT || 0) + bdt;
      if (f.fidget <= 0 && f.idleT >= (f.idleAt || (f.idleAt = 6 + Math.random() * 4)) && can("fidget")) {
        f.fidget = CFG.who[f.w].lengths.fidget || 1.6; f.idleT = 0; f.idleAt = 6 + Math.random() * 4;
      }
      if (f.fidget > 0) key = "fidget";
    } else { f.idleT = 0; f.fidget = 0 }
    act(f, key, false);
    var k = Math.min(1, HT.acc * 30), dx = f.px === undefined ? f.x : f.px + (f.x - f.px) * k, dy = f.py === undefined ? f.y : f.py + (f.y - f.py) * k;
    f.dx = dx; f.dy = dy;                             // where it is drawn: what the HUD pins its tag and bar to
    try { f.b.Position = new CS.UnityEngine.Vector2(dx, dy); f.b.Dir = f.face } catch (e) {}
    if (S.forceAlpha !== undefined && S.forceAlpha !== null) { try { f.b.SetLogicAlpha(S.forceAlpha) } catch (e) {} }
    ensureMaterial(f);
  }
  // In game (0.2.6 probe) a companion's MeshRenderer had its mesh and frames but NO material, so nothing drew: the game
  // only gave these projectile sprites a material while their alpha was changing (0.2.0's fade was what showed them).
  // A companion without one gets its own copy of Kris's sprite material (same rig, same texture family).
  // 0.5.8: where no battle HUD ticks (the lobby after Kris is picked) the hero stands in front of a world-space
  // screen (the Evotype choice). A companion is sorted as a projectile (MidActor/0; Kris MidActor/99: probe) and was
  // drawn behind that screen: there, and unseen (game, 0.5.7: the log said both dropped in, the capture showed Kris
  // alone). There they take Kris's sorting layer and stand one step behind Kris in it. In a battle nothing changes.
  function sortWith(f) {
    try {
      if (!alive(f) || !f.mr || IsNull(f.mr) || f.sortHold) return;
      if (!S.kmr || IsNull(S.kmr) || S.kmrOf !== S.pl) { S.kmr = S.pl.gameObject.GetComponentInChildren(PU.$typeof(CS.UnityEngine.MeshRenderer), true); S.kmrOf = S.pl }
      var k = S.kmr; if (!k || IsNull(k)) return;
      var id = k.sortingLayerID, ord = k.sortingOrder - 1;
      if (f.mr.sortingLayerID === id && f.mr.sortingOrder === ord) return;
      var was = ""; try { was = f.mr.sortingLayerName + "/" + f.mr.sortingOrder } catch (e0) {}
      f.mr.sortingLayerID = id; f.mr.sortingOrder = ord;
      f.sortN = (f.sortN || 0) + 1;
      if (f.sortN <= 2) log(f.w + ": no battle HUD here, sorted with Kris (" + k.sortingLayerName + "/" + ord + "; was " + was + ")");
    } catch (e) { if (!S.sortErr) { S.sortErr = 1; log("companion sorting: " + e) } }
  }
  // Kris's own material may be in the middle of an effect when it is copied. Game, 0.5.9's probe in the lobby: the copy
  // made during pvp_born kept the keyword _ENABLEDISSOLVE_ON with _DissolveThreashold 0.908 (the spawn-in effect; Kris's
  // steady material has no keyword and 0), and both companions stood beside Kris fully dissolved: there and unseen (the
  // lead, on 0.5.0: "i still dont see susie or ralsei in the character select"). A copy is put into a neutral state:
  // no effect keyword, the effect values off, full alpha, no tint. (Custom/LitRole's own names; a missing one is skipped.)
  var MATOFF = { _Alpha: 1, _AlphaScale: 1, _EnableDissolve: 0, _DissolveThreashold: 0, _EnableGrayscale: 0, _EnableRemap: 0,
                 _EnableTurbulence: 0, _EnableSubTex: 0, _EnableDecoTex: 0, _EmissionIntensity: 0 };
  function fullAlpha(m) {
    var off = [];
    try { var ks = m.shaderKeywords; for (var j = 0; j < ks.Length; j++) off.push(String(ks.get_Item(j))) } catch (e) {}
    for (var i = 0; i < off.length; i++) { try { m.DisableKeyword(off[i]) } catch (e1) {} }
    for (var k in MATOFF) { try { if (m.HasProperty(k)) m.SetFloat(k, MATOFF[k]) } catch (e2) {} }
    try { if (m.HasProperty("_AddColor")) m.SetColor("_AddColor", new COL(0, 0, 0, 0)) } catch (e3) {}
    try { if (m.HasProperty("_TintColor")) m.SetColor("_TintColor", new COL(1, 1, 1, 1)) } catch (e4) {}
    try { if (m.HasProperty("_Color")) { var c = m.GetColor("_Color"); if (c.a < 1) { c.a = 1; m.SetColor("_Color", c) } } } catch (e5) {}
    return off;
  }
  function ensureMaterial(f) {
    if (S.autoMat === false) return;
    try {
      var MR = PU.$typeof(CS.UnityEngine.MeshRenderer);
      if (!f.mr || IsNull(f.mr)) f.mr = f.b.gameObject.GetComponentInChildren(MR, true);
      if (!f.mr || IsNull(f.mr)) return;
      var cur = f.mr.sharedMaterial, had = !!cur && !IsNull(cur);
      // 0.5.7: a companion that has just joined always gets a fresh material. Its projectile comes from a pool, and one
      // that last played a fade-out (fol_<who>_gone, fol_<who>_leave) came back with that faded material: the companion
      // was there and invisible (game, 0.5.6: the log said both joined, the frames showed only Kris)
      if (had && !f.matNew) return;
      var kr = S.pl.gameObject.GetComponentInChildren(MR, true), km = kr && !IsNull(kr) ? kr.sharedMaterial : null;
      if (!km || IsNull(km)) return;
      f.mat = new CS.UnityEngine.Material(km); var kw = fullAlpha(f.mat); f.mr.sharedMaterial = f.mat;
      f.matNew = false;
      f.matN = (f.matN || 0) + 1;
      if (f.matN <= 3 || kw.length) log(f.w + ": " + (had ? "the re-used projectile kept an old material; replaced with" : "the game gave no sprite material; using") +
                           " a copy of Kris's (" + km.name + ")" + (kw.length ? ", taken mid-effect (" + kw.join(",") + "): made neutral" : "") + (f.matN > 1 ? " again (" + f.matN + ")" : ""));
    } catch (e) { if (!S.matErr) { S.matErr = 1; log("companion material: " + e) } }
  }
  // The Fun Gang's pose (P.pose, a moment after the press). Kris goes to his pose action unless he is in a state
  // that must play out (CFG.pose.deny); Susie and Ralsei stop where they are, face as Kris does and play theirs.
  function strikePose(p) {
    var dir = p.Dir >= 0 ? 1 : -1, ka = krisAction(p), deny = null, done = "Kris stays in " + ka, n = 0;
    try { deny = new RegExp(CFG.pose.deny) } catch (e) {}
    var gentle = !!S.poseGentle; S.poseGentle = false;            // a boss kill: Kris poses only out of a neutral state
    if (gentle && !/^(stand|standby|run|runStart|runBrake|squat|drop|dropend|jump|dash)/.test(ka)) deny = /./;
    if (!(deny && deny.test(ka)) && !p.IsDead) {
      var name = grounded(p) ? CFG.pose.ground : CFG.pose.air;
      try { p.ActionMgr.ChangeAction(name); done = "Kris " + name + " (from " + ka + ")" }
      catch (e) { done = "Kris could not pose (" + e + ")" }
    }
    for (var w in F) {
      var fo = F[w]; if (!alive(fo)) continue;
      fo.pose = (CFG.pose && CFG.pose.len) || 0.8; fo.face = dir; fo.cast = 0; fo.spin = 0; fo.land = 0; fo.turn = 0; fo.enter = null;
      act(fo, "pose", true); n++;
    }
    log("pose: " + done + ", " + n + " companions");
  }
  // The lead, 2026-10-03: Susie and Ralsei "should appear with kris or like spawn in with animation next to kris and do
  // their iconic fun gang pose when kris loads into a run and does his taunt". While Kris plays an entrance state
  // (born*, his pose clip), each companion drops in beside Kris in its jump ball (ENTER.drop s from ENTER.up u above),
  // lands and holds its pose until Kris moves on. Once a battle and once a room. With Kris's win pose they pose too.
  var ENTER = { rx: /^(born|pvp_born|bornshow|reborn)/, win: /^(winpose|StagePass)/, drop: 0.32, up: 3.4, at: { susie: 0.95, ralsei: 1.85 } };
  function entrance(p, ka) {
    var ent = ENTER.rx.test(ka), win = ENTER.win.test(ka);
    if (ent && !S.entered) {
      S.entered = true;
      var dir = p.Dir >= 0 ? 1 : -1, n = 0;
      for (var w in F) {
        var fo = F[w]; if (!alive(fo)) continue;
        fo.x = p.Position.x - dir * ENTER.at[w]; fo.face = dir; fo.cast = 0; fo.land = 0; fo.turn = 0; fo.pose = 0;
        fo.enter = { t: 0, gy: p.Position.y }; fo.y = fo.enter.gy + ENTER.up; fo.px = fo.x; fo.py = fo.y;
        n++;
      }
      if (!n) S.entered = false;                    // nobody there yet: try again next tick
      else log("entrance: " + n + " companions drop in beside Kris (" + ka + ")");
    }
    if (win && !S.winPosed) {
      S.winPosed = true;
      for (var w2 in F) { var f2 = F[w2]; if (alive(f2) && !f2.enter) { f2.pose = 1.9; f2.face = p.Dir >= 0 ? 1 : -1; act(f2, "pose", true) } }
      log("win pose: the companions pose with Kris (" + ka + ")");
    }
    if (!win) S.winPosed = false;
    S.entering = ent;
  }
  // Kris's HP is low (0.5.3; the lead: "yes the low hp reaction"; offered as "Ralsei worried, Susie angry"). DELTARUNE's
  // platformer has the sprites: spr_plat_susie_idle_unhappy / _run_unhappy and spr_plat_ralsei_idle_unhappy. At
  // CFG.low.on of max HP or less both flinch once (their shock), then stand (Susie also runs) in the unhappy set until
  // Kris is back over CFG.low.off. They don't fidget meanwhile, and the panel's heads show the hurt face.
  function lowHp(p) {
    var hp = -1, mx = 0;
    try { hp = f(p.Attr.HP); mx = f(p.Attr.MaxHp) } catch (e) { return }
    if (!(mx > 0) || isNaN(hp)) return;
    var r = hp / mx, was = !!S.low;
    if (!was && r > 0 && r <= CFG.low.on) S.low = true;
    else if (was && r >= CFG.low.off) S.low = false;
    if (S.low && !was) {
      for (var w in F) { var fo = F[w]; if (alive(fo) && !fo.enter && !(fo.pose > 0)) fo.shock = CFG.who[w].lengths.shock || 0.5 }
      log("low HP (" + Math.round(r * 100) + " %): the companions show it");
    } else if (!S.low && was) log("low HP over (" + Math.round(r * 100) + " %)");
  }
  // 0.5.0 (the lead's "lets add this"): the companions flinch when Kris is hit; they skid when a Party Dash ends
  var HURT = /^(behit|push_|knockdown)/;
  function reactions(p, ka) {
    var hurt = HURT.test(ka);
    if (hurt && !S.wasHurt) for (var w in F) { var fo = F[w]; if (alive(fo) && !fo.enter && !(fo.pose > 0)) fo.shock = CFG.who[w].lengths.shock || 0.5 }
    S.wasHurt = hurt;
    var dl = !!(M().follow && M().follow.act === "dash");
    if (!dl && S.wasDash) for (var w2 in F) { var f2 = F[w2]; if (alive(f2)) f2.halt = CFG.who[w2].lengths.halt || 0.3 }
    S.wasDash = dl;
  }
  // the dance taunt (Down + Summon): Kris's dance on the ground (never out of a state that must play out), the companions' where they stand
  P.dance = function () {
    var p = S.pl; if (!p || !CFG.dance || S.state === "aim") return false;
    var ka = krisAction(p), deny = null, n = 0, done = "Kris stays in " + ka;
    try { deny = new RegExp(CFG.pose.deny) } catch (e) {}
    if (grounded(p) && !(deny && deny.test(ka)) && !p.IsDead) {
      try { p.ActionMgr.ChangeAction(CFG.dance.action); done = "Kris " + CFG.dance.action } catch (e) { done = "Kris could not dance (" + e + ")" }
    }
    for (var w in F) { var fo = F[w]; if (!alive(fo) || fo.enter) continue; fo.dance = CFG.dance.len || 1.6; fo.face = p.Dir >= 0 ? 1 : -1; fo.cast = 0; fo.pose = 0; act(fo, "dance", true); n++ }
    log("dance: " + done + ", " + n + " companions");
    return true;
  };
  P.stickDown = function () { try { return !!S.pl && stick(S.pl)[1] < -0.5 } catch (e) { return false } };
  // The companions leave (0.5.1): the player is no longer Kris (the lobby avatar is back; a run's end swaps the hero
  // out). Until now they stood where they were for the rest of that battle. Each plays its leave action (the jump ball
  // rising and fading; it ends its projectile by itself); without that action the projectile goes back to the pool.
  function dismissParty(why, key) {
    var n = 0, bm = null;
    try { bm = battle().BulletMgr } catch (e) {}
    for (var w in F) {
      var fo = F[w]; fo.aT = -1;
      if (!fo.b || !alive(fo)) continue;
      var name = CFG.who[w].actions[key || "leave"] || CFG.who[w].actions.leave, done = false;
      if (name && !S.missing[name]) { try { fo.b.ActionMgr.ChangeAction(name); done = true } catch (e) { S.missing[name] = 1 } }
      if (!done) { try { if (bm.RecycleBullet(fo.b) === false) fo.b.IsDead = true } catch (e2) { try { fo.b.IsDead = true } catch (e3) {} } }
      fo.b = null; fo.act = null; n++;
    }
    if (n) log("the companions leave (" + why + "): " + n);
    return n;
  }
  P.dismiss = function (why) { return dismissParty(why || "asked") };
  function resetParty() { H = []; HT.acc = 0; for (var n in F) { F[n].b = null; F[n].act = null; F[n].mr = null; F[n].aT = -1; F[n].wait = 0 } }
  // a new room (the Potentials' core calls it on the stage trigger): the history starts again behind Kris, and a
  // companion the room change took re-joins at once instead of at the next one-second retry
  P.onRoom = function () {
    H = []; HT.acc = 0; S.entered = false; S.bossN = 0;
    for (var n in F) { F[n].aT = -1; if (!alive(F[n])) F[n].wait = 0 }
  };

  // ---------------------------------------------------------------- UI: DELTARUNE's target mode (own overlay canvases)
  // docs/deltarune/party/research/TARGET_MODE_SCREEN.md, read from Chapter 5's code:
  //  - the dim: black at 0.3, in over 5 DELTARUNE frames. (DELTARUNE redraws the actors above it; an overlay can't, so
  //    here they dim too: a known difference.)
  //  - the info strip: black at 0.6, 100 of the 480-pixel view tall, at the bottom (at the top when the selected thing
  //    stands low on screen). Line 1: the category label in the acting companion's colour, then "-->  " and the
  //    target's name in white. Line 2: typed one character a frame, here on the controls or the state (the lead: "a
  //    typed description line telling you to move your reticle and how the controls work").
  //  - every target: the reticle (idle: frame 0 turning 6 degrees a frame; hovered: frames 1, 3, 5, 7 over 4 frames,
  //    easing square, white flash on its 2nd and 3rd frames) and the centre circle at 2x; a cross at 2x instead when the
  //    acting companion is recharging. A guarding target (ours still takes reduced damage) carries the red diamond.
  //  - the arrow trail from the companion who would act to the hovered target (one arrow every 20 pixels, drifting 10
  //    pixels a second, fading in and out over 20 pixels at each end, each with a ghost ahead at a third alpha).
  //  - the SOUL (spr_dodgeheart): it snaps to its target, dropping red afterimages every 24 pixels along the second half
  //    of the way (alpha 0.2 to 0.4, each fading 0.1 a frame).
  //  - recharge bars over busy companions (obj_plat_cooldown_bar): a 60 x 12 frame in the companion's colour, black
  //    inside, a 4-pixel fill.
  // DELTARUNE runs at 30 frames a second: its per-frame steps are per 1/30 s here. World-attached marks use the
  // world's scale (one DELTARUNE pixel = CFG.unitPerPx units, as the party's sprites); the strip and its text map
  // DELTARUNE's 480-pixel view height onto the screen.
  var ACC = { susie: [1, 0, 1], ralsei: [0, 1, 0], none: [0.5, 0.5, 0.5] };
  var V2 = CS.UnityEngine.Vector2, V3 = CS.UnityEngine.Vector3, COL = CS.UnityEngine.Color;
  function sprite(name) {
    S.spr = S.spr || {};
    if (S.spr[name] === undefined) {
      var sp = null; try { sp = S.hud.LoadSprite("UI/Atlas/DR/DR", name) || null } catch (e) {}
      if (sp) { try { sp.texture.filterMode = CS.UnityEngine.FilterMode.Point } catch (e) {} }   // pixel art stays crisp
      S.spr[name] = sp;
    }
    return S.spr[name];
  }
  // 0.6.3: the HUD canvas (the panel, the Tension meter, the recharge bars) is on the battle HUD's camera (0.6.2). A
  // screen pixel there is a point of that canvas's plane, not a world position as on an overlay canvas. HC is that
  // plane (hcUpdate reads it once a frame), HSET the images that live on it; place() converts for those.
  var HC = null, HSET = new Set();
  function hcUpdate() {
    if (!HC) return;
    var ox = 0, oy = 0, oz = 0, kx = 1, ky = 1;
    try {
      var r = HC.rt.rect, W = CS.UnityEngine.Screen.width, H = CS.UnityEngine.Screen.height;
      var o = HC.rt.TransformPoint(new V3(r.x, r.y, 0)), e = HC.rt.TransformPoint(new V3(r.x + r.width, r.y + r.height, 0));
      var a = (e.x - o.x) / W, b = (e.y - o.y) / H;
      if (isFinite(a) && isFinite(b) && a > 0 && b > 0 && isFinite(o.x) && isFinite(o.y) && isFinite(o.z)) { ox = o.x; oy = o.y; oz = o.z; kx = a; ky = b }
    } catch (e2) {}
    if (ox !== HC.ox || oy !== HC.oy || oz !== HC.oz || kx !== HC.kx || ky !== HC.ky) {
      HC.ox = ox; HC.oy = oy; HC.oz = oz; HC.kx = kx; HC.ky = ky; HC.gen++;
      if (HC.gen <= 3) log("HUD canvas plane: origin " + ox.toFixed(2) + "," + oy.toFixed(2) + "," + oz.toFixed(2) + ", " + kx.toFixed(5) + " x " + ky.toFixed(5) + " world units a pixel");
    }
  }
  function hpos(x, y) { return new V3(HC.ox + x * HC.kx, HC.oy + y * HC.ky, HC.oz) }
  function addComp(go, T) { return go.AddComponent(PU.$typeof(T)) }   // as core/Util.js does
  function image(parent, name, w, h) {
    var go = new CS.UnityEngine.GameObject(name); go.transform.SetParent(parent, false);
    var onHud = false;
    try { go.layer = parent.gameObject.layer; onHud = !!HC && parent.IsChildOf(HC.rt) === true } catch (e) {}   // (the HUD's camera draws the HUD's layer only)
    var im = addComp(go, CS.UnityEngine.UI.Image); im.raycastTarget = false;
    if (onHud) HSET.add(im);
    var rt = im.rectTransform; rt.sizeDelta = new V2(w, h);
    rt.anchorMin = new V2(0, 0); rt.anchorMax = new V2(0, 0);
    return im;
  }
  // A plain coloured box needs a sprite here: an Image without one draws nothing in this game. Seen on a capture of
  // 0.5.1: the panel's heads and names drew, its tab plates and bars did not; so the recharge bars over the companions
  // (asked for on 2026-10-03: "add cooldown bars"), Kris's bar, and the target mode's dim and strip had never drawn
  // either. DRParty_White is a white square of our own (party_ui.py).
  function solid(im) {
    var w = sprite(CFG.sprites.white);
    if (w) im.sprite = w;
    else if (!S.whiteErr) { S.whiteErr = 1; log("the white sprite is missing from the HUD atlas: plain boxes will not draw") }
    return im;
  }
  function colour(c, a, white) {
    var w = white || 0;
    return new COL(c[0] + (1 - c[0]) * w, c[1] + (1 - c[1]) * w, c[2] + (1 - c[2]) * w, a);
  }
  function show(go, on) { if (go.activeSelf !== on) go.SetActive(on) }
  function place(im, x, y, w, h, rot, c) {
    var rt = im.rectTransform; rt.sizeDelta = new V2(w, h); rt.position = HC && HSET.has(im) ? hpos(x, y) : new V3(x, y, 0);
    rt.localEulerAngles = new V3(0, 0, rot || 0); if (c) im.color = c;
  }
  function sfx(name) {
    var cue = CFG.sfx && CFG.sfx[name]; if (!cue) return;
    try { require("Core/AudioUtil").default.PlaySoundUI(cue) } catch (e) { if (!S.sfxErr) { S.sfxErr = 1; log("sound " + cue + " failed: " + e) } }
  }

  // ---- DELTARUNE's font (party_ui.py's atlas of fnt_mainbig / fnt_main, metrics in __bbDRPartyFont); a line with a
  // character the font lacks (another script's name) falls back to the HUD's own TextMeshPro
  function font() { if (S.font === undefined) S.font = G.__bbDRPartyFont || null; return S.font }
  function glyph(fk, code) {
    var F = font() && font()[fk]; if (!F) return null;
    S.gly = S.gly || {}; var key = fk + ":" + code;
    if (S.gly[key] !== undefined) return S.gly[key];
    var g = F.g[code], base = sprite(F.tex), sp = null;
    if (g && base && g[2] > 0 && g[3] > 0) {
      try {
        var r = base.textureRect;
        sp = CS.UnityEngine.Sprite.Create(base.texture, new CS.UnityEngine.Rect(r.x + g[0], r.y + g[1], g[2], g[3]), new V2(0, 1), 100);
      } catch (e) { if (!S.glyErr) { S.glyErr = 1; log("font glyphs unavailable: " + e) } }
    }
    S.gly[key] = sp; return sp;
  }
  function fits(fk, str) {
    var F = font() && font()[fk]; if (!F || !sprite(F.tex)) return false;
    for (var i = 0; i < str.length; i++) if (!F.g[str.charCodeAt(i)]) return false;
    return true;
  }
  function textBox(parent, name) {
    var c = image(parent, name, 1, 1); c.enabled = false;
    return { t: c.transform, gl: [], key: null, tmp: null, hud: HSET.has(c) };
  }
  function tmpLine(tb) {                             // the fallback: a clone of the HUD's own text
    if (tb.tmp || !S.ui.tmpSrc) return tb.tmp;
    var o = CS.UnityEngine.Object.Instantiate(S.ui.tmpSrc.gameObject, tb.t); o.name = "Fallback";
    var l = U.GetComponent(o, CS.TMPro.TextMeshProUGUI);
    l.alignment = CS.TMPro.TextAlignmentOptions.TopLeft; l.enableWordWrapping = false; l.richText = true;
    var rt = l.rectTransform; rt.anchorMin = rt.anchorMax = new V2(0, 0); rt.pivot = new V2(0, 1);
    tb.tmp = l; return l;
  }
  // parts: [[text, [r, g, b]], ...] drawn left to right from (x, y) = the line's top-left on screen; s = screen pixels
  // per DELTARUNE pixel; mono = a fixed advance in DELTARUNE pixels (the typer's 16) or 0 for the font's own
  function drawText(tb, parts, x, y, s, fk, mono) {
    var key = JSON.stringify(parts) + "|" + x.toFixed(1) + "|" + y.toFixed(1) + "|" + s.toFixed(3) + (tb.hud && HC ? "|" + HC.gen : "");
    if (tb.key === key) return; tb.key = key;
    var all = parts.map(function (q) { return q[0] }).join(""), n = 0, F = font() && font()[fk];
    if (!fits(fk, all)) {                            // not in DELTARUNE's font: the HUD's text, same place and colours
      var l = tmpLine(tb);
      for (var h = 0; h < tb.gl.length; h++) show(tb.gl[h].gameObject, false);
      if (!l) return;
      show(l.gameObject, true);
      l.text = parts.map(function (q) { var c = q[1]; return "<color=#" + [c[0], c[1], c[2]].map(function (v) {
        return ("0" + Math.round(v * 255).toString(16)).slice(-2) }).join("") + ">" + q[0].replace(/</g, "&lt;") + "</color>" }).join("");
      l.fontSize = 26 * s / 2.25; l.rectTransform.sizeDelta = new V2(620 * s, 40 * s); l.rectTransform.position = tb.hud && HC ? hpos(x, y) : new V3(x, y, 0);
      return;
    }
    if (tb.tmp) show(tb.tmp.gameObject, false);
    var cx = x;
    for (var pi = 0; pi < parts.length; pi++) {
      var str = parts[pi][0], c = colour(parts[pi][1], 1, 0);
      for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i), g = F.g[code], sp = glyph(fk, code);
        if (sp) {
          while (tb.gl.length <= n) tb.gl.push(image(tb.t, "G", 1, 1));
          var im = tb.gl[n++]; show(im.gameObject, true); im.sprite = sp;
          var rt = im.rectTransform; rt.pivot = new V2(0, 1);
          place(im, cx + g[5] * s, y, g[2] / F.scale * s, g[3] / F.scale * s, 0, c);
        }
        cx += (mono || g[4]) * s;
      }
    }
    for (var r = n; r < tb.gl.length; r++) show(tb.gl[r].gameObject, false);
  }

  function buildUI(hud) {
    var go = new CS.UnityEngine.GameObject("DRPartyCommand");
    var cv = addComp(go, CS.UnityEngine.Canvas);
    cv.renderMode = CS.UnityEngine.RenderMode.ScreenSpaceOverlay; cv.sortingOrder = 30000;
    var t = go.transform;
    var dim = solid(image(t, "Dim", 4, 4)); dim.color = new COL(0, 0, 0, 0);
    var drt = dim.rectTransform; drt.anchorMin = new V2(0, 0); drt.anchorMax = new V2(1, 1);
    drt.sizeDelta = new V2(0, 0); drt.anchoredPosition = new V2(0, 0);
    var arrowsT = new CS.UnityEngine.GameObject("Arrows"); arrowsT.transform.SetParent(t, false);
    var marks = new CS.UnityEngine.GameObject("Marks"); marks.transform.SetParent(t, false);
    var ghostsT = new CS.UnityEngine.GameObject("SoulTrail"); ghostsT.transform.SetParent(t, false);
    var soul = image(t, "SOUL", 20, 20);
    var strip = solid(image(t, "Strip", 4, 4)); strip.color = new COL(0, 0, 0, 0.6);
    var srt = strip.rectTransform; srt.anchorMin = new V2(0, 0); srt.anchorMax = new V2(1, 0); srt.pivot = new V2(0.5, 0);
    var tmpSrc = null;
    try {
      var row = TQ.Query(hud.CsObj.transform, "TanlentIcons");
      tmpSrc = row ? TQ.Query(row.transform, "TextCount", CS.TMPro.TextMeshProUGUI) : null;
    } catch (e) {}
    S.ui = { go: go, dim: dim, strip: strip, marksT: marks.transform, marks: [], arrowsT: arrowsT.transform, arrows: [],
             ghostsT: ghostsT.transform, ghosts: [], soul: soul, tmpSrc: tmpSrc, fail: 0, shake: 0 };
    S.ui.line1 = textBox(t, "Line1"); S.ui.name = textBox(t, "Name"); S.ui.line2 = textBox(t, "Line2");
    var bgo = new CS.UnityEngine.GameObject("DRPartyRecharge"), bcv = addComp(bgo, CS.UnityEngine.Canvas);
    // 0.6.2: this canvas (the panel, the Tension meter, the recharge bars) is drawn WITH the battle HUD: on the HUD's
    // camera, in its sorting layer and order, so whatever the game puts over its HUD (the pause menu, a Potential or
    // Tactic choice and its blur, a result screen) is over ours too. As an overlay (0.5.x) it lay on top of every game
    // window (game, 0.6.1: the tabs and the meter over the pause menu's list and over the Potential choice). Without a
    // CanvasScaler one unit is still one screen pixel, so nothing else changes.
    var withHud = false;
    HC = null; HSET = new Set();
    try {
      var hcv = hud.CsObj.GetComponentInParent(PU.$typeof(CS.UnityEngine.Canvas)), hroot = hcv.rootCanvas || hcv, hcam = hroot.worldCamera;
      if (hroot.renderMode !== CS.UnityEngine.RenderMode.ScreenSpaceOverlay && hcam && !IsNull(hcam)) {
        bgo.layer = hud.CsObj.gameObject.layer;                  // (the HUD camera draws its own layer only; image() passes it on)
        bcv.renderMode = CS.UnityEngine.RenderMode.ScreenSpaceCamera; bcv.worldCamera = hcam; bcv.planeDistance = hroot.planeDistance;
        bcv.sortingLayerID = hcv.sortingLayerID; bcv.sortingOrder = hcv.sortingOrder;
        withHud = true;
        HC = { rt: bgo.GetComponent(PU.$typeof(CS.UnityEngine.RectTransform)), ox: 0, oy: 0, oz: 0, kx: 1, ky: 1, gen: 0 }; hcUpdate();
        log("HUD canvas: drawn with the battle HUD (camera " + hcam.name + ", layer " + bgo.layer + ", order " + bcv.sortingOrder + ", plane " + bcv.planeDistance + ")");
      }
    } catch (e) { log("HUD canvas: " + e) }
    if (!withHud) { bcv.renderMode = CS.UnityEngine.RenderMode.ScreenSpaceOverlay; bcv.sortingOrder = 29990; log("HUD canvas: an overlay (the battle HUD's camera was not found)") }
    var bars = {};
    for (var w in CFG.who) {
      var edge = solid(image(bgo.transform, "Bar_" + w, 60, 12)), back = solid(image(edge.transform, "Back", 56, 8)), fill = solid(image(back.transform, "Fill", 52, 4));
      edge.color = colour(ACC[w], 1, 0); back.color = new COL(0, 0, 0, 1); fill.color = colour(ACC[w], 1, 0);
      var ert = back.rectTransform; ert.anchorMin = ert.anchorMax = ert.pivot = new V2(0.5, 0.5); ert.anchoredPosition = new V2(0, 0);
      var frt = fill.rectTransform; frt.pivot = new V2(0, 0.5); frt.anchorMin = frt.anchorMax = new V2(0, 0.5);
      edge.gameObject.SetActive(false);
      bars[w] = { edge: edge, back: back, fill: fill, done: -1 };
    }
    // Kris's own bar (0.4.1, the lead: "add cooldown bars"): X Slash's cooldown, over Kris's head, in Kris's blue
    var kedge = solid(image(bgo.transform, "Bar_kris", 60, 12)), kback = solid(image(kedge.transform, "Back", 56, 8)), kfill = solid(image(kback.transform, "Fill", 52, 4));
    kedge.color = new COL(0.25, 0.85, 1, 1); kback.color = new COL(0, 0, 0, 1); kfill.color = new COL(0.25, 0.85, 1, 1);
    var kert = kback.rectTransform; kert.anchorMin = kert.anchorMax = kert.pivot = new V2(0.5, 0.5); kert.anchoredPosition = new V2(0, 0);
    var kfrt = kfill.rectTransform; kfrt.pivot = new V2(0, 0.5); kfrt.anchorMin = kfrt.anchorMax = new V2(0, 0.5);
    kedge.gameObject.SetActive(false);
    S.ui.krisBar = { edge: kedge, back: kback, fill: kfill, done: -1, full: 0 };
    // the Tension meter (0.5.0; the lead: "adding the tension meter inplace of where the ui meter is"): DELTARUNE's own
    // gauge (25 x 196, slanted) laid on its side where the HUD's MP bar was, its TP logo before it and the figure after
    var tp = {};
    tp.back = image(bgo.transform, "TP_Back", 25, 196); tp.fill = image(bgo.transform, "TP_Fill", 25, 196);
    tp.flash = image(bgo.transform, "TP_Flash", 25, 196); tp.frame = image(bgo.transform, "TP_Frame", 25, 196);
    tp.logo = image(bgo.transform, "TP_Logo", 22, 44); tp.graze = image(bgo.transform, "TP_Graze", 50, 50);
    var tpS = { back: sprite(CFG.sprites.tpBack), fill: sprite(CFG.sprites.tpFill), flash: sprite(CFG.sprites.tpFlash),
                frame: sprite(CFG.sprites.tpFrame), logo: sprite(CFG.sprites.tpLogo), graze: sprite(CFG.sprites.graze) };
    tp.ok = !!(tpS.back && tpS.fill && tpS.frame && tpS.logo);
    for (var tk in tpS) { if (tpS[tk]) tp[tk].sprite = tpS[tk]; tp[tk].gameObject.SetActive(false) }
    try {
      var IT = CS.UnityEngine.UI.Image;
      [tp.fill, tp.flash].forEach(function (im) { im.type = IT.Type.Filled; im.fillMethod = IT.FillMethod.Vertical; im.fillOrigin = 0; im.fillAmount = 0 });
    } catch (e) { tp.ok = false; log("tension meter: filled images unavailable (" + e + ")") }
    tp.text = textBox(bgo.transform, "TP_Text");
    if (!tp.ok) log("tension meter: its sprites are missing from the HUD atlas");
    S.ui.tp = tp;
    S.ui.bgo = bgo; S.ui.bars = bars;
    S.ui.autoTb = { susie: textBox(bgo.transform, "Auto_susie"), ralsei: textBox(bgo.transform, "Auto_ralsei") };
    // 0.5.1: the MAX flash (behind the rest of this canvas), the party panel's two tabs, and the SOUL's end on a canvas
    // of its own (it plays on when the HUD's tick stops)
    var fl = solid(image(bgo.transform, "Flash", 4, 4)), flr = fl.rectTransform;
    flr.anchorMin = new V2(0, 0); flr.anchorMax = new V2(1, 1); flr.sizeDelta = new V2(0, 0); flr.anchoredPosition = new V2(0, 0);
    fl.color = new COL(1, 1, 1, 0); fl.gameObject.SetActive(false);
    try { fl.transform.SetAsFirstSibling() } catch (e) {}
    S.ui.flash = fl;
    var tabs = {}, pok = true;
    for (var pw in CFG.who) {
      var tb2 = { plate: solid(image(bgo.transform, "Tab_plate_" + pw, 4, 4)), line: solid(image(bgo.transform, "Tab_line_" + pw, 4, 4)),
                  head: image(bgo.transform, "Tab_head_" + pw, 4, 4), name: image(bgo.transform, "Tab_name_" + pw, 4, 4),
                  edge: solid(image(bgo.transform, "Tab_bar_" + pw, 4, 4)), auto: textBox(bgo.transform, "Tab_auto_" + pw), frame: -1 };
      tb2.back = solid(image(tb2.edge.transform, "Back", 4, 4)); tb2.fill = solid(image(tb2.back.transform, "Fill", 4, 4));
      tb2.back.color = new COL(0, 0, 0, 1);
      var pbr = tb2.back.rectTransform; pbr.anchorMin = pbr.anchorMax = pbr.pivot = new V2(0.5, 0.5); pbr.anchoredPosition = new V2(0, 0);
      var pfr = tb2.fill.rectTransform; pfr.pivot = new V2(0, 0.5); pfr.anchorMin = pfr.anchorMax = new V2(0, 0.5);
      var hsp = sprite(CFG.sprites.head[pw] + "0"), nsp = sprite(CFG.sprites.name[pw]);
      if (hsp) { tb2.head.sprite = hsp; tb2.frame = 0 }
      if (nsp) tb2.name.sprite = nsp;
      if (!hsp || !nsp) pok = false;
      tb2.head.gameObject.SetActive(false); tb2.name.gameObject.SetActive(false); tb2.edge.gameObject.SetActive(false);
      tb2.plate.gameObject.SetActive(false); tb2.line.gameObject.SetActive(false);
      tabs[pw] = tb2;
    }
    S.ui.panel = { tabs: tabs, ok: pok };
    if (!pok) log("party panel: its sprites are missing from the HUD atlas");
    var sgo = new CS.UnityEngine.GameObject("DRPartySoul"), scv = addComp(sgo, CS.UnityEngine.Canvas);
    scv.renderMode = CS.UnityEngine.RenderMode.ScreenSpaceOverlay; scv.sortingOrder = 29995;
    var se = { heart: image(sgo.transform, "SOUL", 4, 4), broken: image(sgo.transform, "Break", 4, 4), shards: [], fi: [], on: false };
    var se1 = sprite(CFG.sprites.soul), se2 = sprite(CFG.sprites.soulBreak);
    if (se1) se.heart.sprite = se1;
    if (se2) se.broken.sprite = se2;
    se.frames = [0, 1, 2, 3].map(function (i) { return sprite(CFG.sprites.shard + i) });
    for (var si = 0; si < 6; si++) { var shi = image(sgo.transform, "Shard", 4, 4); shi.gameObject.SetActive(false); se.shards.push(shi); se.fi.push(-1) }
    se.heart.gameObject.SetActive(false); se.broken.gameObject.SetActive(false);
    se.ok = !!(se1 && se2 && se.frames[0] && se.frames[1] && se.frames[2] && se.frames[3]);
    if (!se.ok) log("the SOUL's end: its sprites are missing from the HUD atlas");
    S.ui.soulEnd = se; S.ui.sgo = sgo;
    go.SetActive(false);
    var hs = sprite(CFG.sprites.heart) || sprite(CFG.sprites.soul); if (hs) soul.sprite = hs; else log("SOUL sprite missing");
    log("command UI built (DELTARUNE font " + (font() ? "loaded" : "missing: the HUD's text stands in") + ")");
  }
  function worldScale(c, p) {                        // screen pixels per DELTARUNE pixel at the battle's camera
    var a = c.WorldToScreenPoint(new V3(p.Position.x, p.Position.y, 0)), b = c.WorldToScreenPoint(new V3(p.Position.x + 1, p.Position.y, 0));
    return Math.max(0.5, Math.abs(b.x - a.x) * CFG.unitPerPx);
  }
  function ui_fail() { if (S.ui) S.ui.fail = 0.25 }
  // The recharge bars over the heads. DELTARUNE's obj_plat_cooldown_bar is 60 x 12 with 2 px borders; drawn for the
  // first time in 0.5.2 / 0.5.3 (see solid()), it was twice a companion's width at this game's zoom (330 x 66 px on a
  // 3440 px screen) and the two covered each other. 0.5.4: 34 x 7 with 1 px borders, 9 px over the head, and a bar
  // that would cover one already placed goes above it.
  var BAR = { w: 34, h: 7, up: 9 };
  function barAt(placed, x, y, ws) {
    for (var i = 0; i < placed.length; i++)
      if (Math.abs(x - placed[i][0]) < BAR.w * ws && Math.abs(y - placed[i][1]) < (BAR.h + 1) * ws) y = placed[i][1] + (BAR.h + 2) * ws;
    placed.push([x, y]);
    return y;
  }
  function drawBars(c, dt) {
    var u = S.ui; if (!u || u.broken || !u.bars || IsNull(u.bgo)) return;
    var p = S.pl; if (!p) return;
    var ws = worldScale(c, p), shake = u.shake > 0 ? Math.sin(u.shake * 90) * 3 * ws : 0; u.shake = Math.max(0, u.shake - dt);
    var tagAt = null, placed = [];
    for (var w in u.bars) {
      var bar = u.bars[w], fo = F[w], left = S.wait[w], full = S.full[w] || rechargeOf(w);
      if (left > 0) bar.done = 0.15; else if (bar.done > 0) bar.done -= dt;
      var on = alive(fo) && !S.frozen && (left > 0 || bar.done > 0 || u.shake > 0);
      // Where the companion is DRAWN (its 30 Hz steps are eased between: f.dx, f.dy). 0.5.0 pinned the tag and the bar
      // to the step's own position: they jumped 30 times a second beside a sprite that moved smoothly (the lead:
      // "the auto tag kinda lags and glitches out")
      var xy = alive(fo) ? c.WorldToScreenPoint(new V3(fo.dx === undefined ? fo.x : fo.dx, (fo.dy === undefined ? fo.y : fo.dy) + CFG.who[w].height, 0)) : null;
      if (u.autoTb) {                                   // Pen of Hope: "AUTO" over a companion while auto mode is on
        var tag = !!CFG.autoTag && !!P.auto && !!xy && S.state !== "aim" && !S.frozen;
        show(u.autoTb[w].t.gameObject, tag);
        if (tag) {
          // 0.5.1: three quarters the size, just over the head (over the recharge bar while that shows; it stood a
          // whole Kris above the head), on whole pixels; the second tag goes a line up where the two would overlap
          var tsc = ws * 0.75, tx = Math.round(xy.x - 14.5 * tsc), ty = Math.round(xy.y + (on ? BAR.up + BAR.h + 2 : 5) * ws + 11 * tsc);
          if (tagAt && Math.abs(tx - tagAt[0]) < 34 * tsc && Math.abs(ty - tagAt[1]) < 12 * tsc) ty = Math.round(tagAt[1] + 13 * tsc);
          tagAt = [tx, ty];
          drawText(u.autoTb[w], [["AUTO", ACC[w]]], tx, ty, tsc, "main", 0);
        }
      }
      show(bar.edge.gameObject, on);
      if (!on) continue;
      place(bar.edge, xy.x + shake, barAt(placed, xy.x, xy.y + BAR.up * ws, ws), BAR.w * ws, BAR.h * ws, 0, null);
      bar.back.rectTransform.sizeDelta = new V2((BAR.w - 2) * ws, (BAR.h - 2) * ws);
      var fr = bar.fill.rectTransform, k = left > 0 ? 1 - left / full : 1;
      fr.anchoredPosition = new V2(ws, 0); fr.sizeDelta = new V2((BAR.w - 4) * ws * k, (BAR.h - 4) * ws);
      bar.fill.color = left > 0 ? colour(ACC[w], 1, 0) : new COL(1, 1, 1, 1);
    }
    // Kris's bar: X Slash's cooldown (the Potentials' party group keeps the battle time it is ready again)
    var kb = u.krisBar;
    if (kb) {
      var xs = P.potsParty && P.potsParty.x, kl = xs && typeof xs.readyAt === "number" ? xs.readyAt - S.bnow : 0;
      if (!(kl > 0 && kl < 120)) kl = 0;
      if (kl > 0) { if (!(kb.full >= kl)) kb.full = kl; kb.done = 0.15 } else { if (kb.done > 0) kb.done -= dt; else kb.full = 0 }
      var kon = !p.IsDead && S.state !== "aim" && !S.frozen && (kl > 0 || kb.done > 0);
      show(kb.edge.gameObject, kon);
      if (kon) {
        var kxy = c.WorldToScreenPoint(new V3(p.Position.x, p.Position.y + (CFG.krisHeight || 1.16), 0));
        place(kb.edge, kxy.x, barAt(placed, kxy.x, kxy.y + BAR.up * ws, ws), BAR.w * ws, BAR.h * ws, 0, null);
        kb.back.rectTransform.sizeDelta = new V2((BAR.w - 2) * ws, (BAR.h - 2) * ws);
        var kf = kb.fill.rectTransform, kk = kl > 0 && kb.full > 0 ? 1 - kl / kb.full : 1;
        kf.anchoredPosition = new V2(ws, 0); kf.sizeDelta = new V2((BAR.w - 4) * ws * kk, (BAR.h - 4) * ws);
        kb.fill.color = kl > 0 ? new COL(0.25, 0.85, 1, 1) : new COL(1, 1, 1, 1);
      }
    }
  }
  // ---- the Tension meter. Where: the HUD's own MP panel (SelfStatus.PanelMP), whose screen rectangle is read once
  // before it is hidden; if it cannot be found, a fixed place at the bottom left.
  function mpRect(hud) {
    try {
      var st = hud.R && hud.R.SelfStatus, pm = st && st.PanelMP;
      if (!pm || IsNull(pm)) return null;
      if (!S.tpRect) {
        var rt = pm.transform, arr = CS.System.Array.CreateInstance(PU.$typeof(V3), 4);
        rt.GetWorldCorners(arr);
        var a0 = arr.get_Item(0), a2 = arr.get_Item(2);
        if (a2.x - a0.x > 8 && a2.y - a0.y > 1) { S.tpRect = [a0.x, a0.y, a2.x, a2.y]; log("tension meter: the MP panel is at " + S.tpRect.map(function (v) { return v.toFixed(0) }).join(",")) }
      }
      if (pm.activeSelf) pm.SetActive(false);
    } catch (e) { if (!S.tpErr) { S.tpErr = 1; log("tension meter: the MP panel cannot be read (" + e + ")") } }
    return S.tpRect || null;
  }
  P.graze = function () { S.grazeT = 0.3; sfx("graze") };       // a perfect dodge (js/pots_tension.js)
  function drawTension(hud, c, dt, p) {
    var u = S.ui, tp = u && u.tp, T = P.tension;
    if (!tp || !tp.ok || !T) return;
    var on = S.hudOn !== false && S.state !== "aim" && !p.IsDead;
    var r = mpRect(hud), W = CS.UnityEngine.Screen.width, H = CS.UnityEngine.Screen.height;
    if (!r && S.rects) {                              // under the HUD's own HP bar, its left edge on the bar's
      var hb = S.rects.hp, hsc = (hb[3] - hb[1]) / 12;
      r = [hb[0], hb[1] - 41.6 * hsc, hb[0] + 288 * hsc, hb[1] - 24.3 * hsc];
    }
    if (!r) r = [W * 0.05, H * 0.085, W * 0.05 + H * 0.2, H * 0.085 + H * 0.012];
    var len = Math.max(H * 0.16, r[2] - r[0]), k = len / 196, th = 25 * k, logoW = 22 * k * 1.15, logoH = 44 * k * 1.15;
    var cx = r[0] + logoW + 6 * k + len / 2, cy = (r[1] + r[3]) / 2;
    ["back", "fill", "flash", "frame", "logo"].forEach(function (n) { show(tp[n].gameObject, on) });
    show(tp.text.t.gameObject, on);
    if (on) {
      var frac = Math.max(0, Math.min(1, (T.shown === undefined ? T.tp : T.shown) / (T.max || 100))), full = T.tp >= (T.max || 100);
      place(tp.back, cx, cy, 25 * k, len, -90, null); place(tp.frame, cx, cy, 25 * k, len, -90, null);
      place(tp.fill, cx, cy, 25 * k, len, -90, full ? new COL(1, 0.95, 0.35, 1) : new COL(1, 1, 1, 1)); tp.fill.fillAmount = frac;
      place(tp.flash, cx, cy, 25 * k, len, -90, new COL(1, 1, 1, Math.max(0, Math.min(1, (T.flash || 0) / 0.6)))); tp.flash.fillAmount = frac;
      place(tp.logo, r[0] + logoW / 2, cy, logoW, logoH, 0, null);
      var ts = Math.max(0.6, th / 14), col = full ? [1, 0.95, 0.35] : [1, 1, 1];
      drawText(tp.text, full ? [["MAX", col]] : [[String(Math.round(T.shown === undefined ? T.tp : T.shown)), col], ["%", col]],
               cx + len / 2 + 6 * k, cy + 8 * ts, ts, "main", 0);
    }
    // the graze: DELTARUNE's outline heart on Kris, growing and fading
    var g = S.grazeT > 0 && !!tp.graze.sprite; S.grazeT = Math.max(0, (S.grazeT || 0) - dt);
    show(tp.graze.gameObject, g);
    if (g) {
      var q = 1 - S.grazeT / 0.3, ws = worldScale(c, p), xy = c.WorldToScreenPoint(new V3(p.Position.x, p.Position.y + (CFG.krisHeight || 1.16) * 0.5, 0));
      place(tp.graze, xy.x, xy.y, 50 * ws * (1 + q * 0.8), 50 * ws * (1 + q * 0.8), 0, new COL(1, 1, 1, 1 - q));
    }
  }
  // ---- the party panel (0.5.1; the lead accepted "party panel in the HUD"): DELTARUNE's battle tabs for the two
  // companions over the HUD's own status block. The head icon (spr_headsusie / spr_headralsei: the face; the sword or
  // the fire while it acts; the hurt face when Kris is hit), the name graphic, the recharge as the tab's bar in the
  // companion's colour (white for a moment when it is ready again; the tab dims while it recharges), "AUTO" while Pen
  // of Hope's auto mode is on. Whole-number scale (2 at 1440p), the tab drawn in DELTARUNE pixels from its bottom left.
  // Where: over the HP figures, by the same shares of the screen the Tension meter's fallback uses. Looked at before
  // the install as a composite over a capture of the lead's HUD (local_only/deltarune/party/ref/panel_preview.png).
  var TAB = { head: { susie: [34, 25], ralsei: [36, 28] }, name: { susie: 48, ralsei: 61 }, w: 124, act: { susie: 1, ralsei: 2 }, hurt: 5 };
  function drawPanel(hud, dt, p) {
    var u = S.ui, pn = u && u.panel; if (!pn) return;
    var on = pn.ok && S.hudOn !== false && S.state !== "aim" && !p.IsDead;
    var W = CS.UnityEngine.Screen.width, H = CS.UnityEngine.Screen.height, k = Math.max(1, Math.round(H / 720));
    var x0 = Math.round(W * 0.05), y0 = Math.round(H * (CFG.panelY > 0 ? CFG.panelY : 0.152)), i = 0;
    if (S.rects) { x0 = Math.round(S.rects.hp[0]); y0 = Math.round(S.rects.text[3] + (S.rects.hp[3] - S.rects.hp[1])) }   // just over the HP figures
    for (var w in pn.tabs) {
      var tab = pn.tabs[w], fo = F[w], vis = on && alive(fo);
      show(tab.head.gameObject, vis); show(tab.name.gameObject, vis); show(tab.edge.gameObject, vis);
      show(tab.plate.gameObject, vis); show(tab.line.gameObject, vis);
      show(tab.auto.t.gameObject, vis && !!P.auto);
      if (!vis) continue;
      var fr = fo.cast > 0 ? TAB.act[w] : (fo.shock > 0 || S.low) ? TAB.hurt : 0;   // (0.5.3: the hurt face while Kris's HP is low)
      if (tab.frame !== fr) { var hs2 = sprite(CFG.sprites.head[w] + fr) || sprite(CFG.sprites.head[w] + "0"); if (hs2) tab.head.sprite = hs2; tab.frame = fr }
      var left = S.wait[w], full = S.full[w] || rechargeOf(w), busy = left > 0, hs = TAB.head[w], nw = TAB.name[w];
      var tx = x0 + i * TAB.w * k, dimA = busy ? 0.6 : 1;
      // DELTARUNE's tab: black, the companion's colour along its top (the head icons carry their own black)
      place(tab.plate, tx + 58 * k, y0 + 14 * k, 120 * k, 32 * k, 0, new COL(0, 0, 0, 0.72));
      place(tab.line, tx + 58 * k, y0 + 31 * k, 120 * k, 2 * k, 0, colour(ACC[w], busy ? 0.5 : 1, 0));
      place(tab.head, tx + 18 * k, y0 + 14 * k, hs[0] * k, hs[1] * k, 0, new COL(1, 1, 1, dimA));
      place(tab.name, tx + 40 * k + nw * k / 2, y0 + 20.5 * k, nw * k, 15 * k, 0, new COL(1, 1, 1, dimA));
      place(tab.edge, tx + 62 * k, y0 + 5.5 * k, 44 * k, 9 * k, 0, colour(ACC[w], 1, 0));
      tab.back.rectTransform.sizeDelta = new V2(42 * k, 7 * k);
      var pf = tab.fill.rectTransform, part = busy ? Math.max(0, 1 - left / full) : 1, ping = !busy && u.bars && u.bars[w] && u.bars[w].done > 0;
      pf.anchoredPosition = new V2(k, 0); pf.sizeDelta = new V2(40 * k * part, 5 * k);
      tab.fill.color = ping ? new COL(1, 1, 1, 1) : colour(ACC[w], busy ? 0.75 : 1, 0);
      if (P.auto) drawText(tab.auto, [["AUTO", ACC[w]]], tx + 90 * k, y0 + 12 * k, k, "main", 0);
      i++;
    }
  }
  // ---- the SOUL's end (0.5.1; the lead accepted "Kris's SOUL shattering on death and re-forming on revive"):
  // DELTARUNE's game over on Kris's chest where Kris fell: the red SOUL, its break (spr_heartbreak, snd_break1), then
  // six shards thrown outward and falling (spr_heartshards, snd_break2; DELTARUNE's speed 7 and gravity 0.2 a frame).
  // 0.5.4: it starts when Kris's HP reaches 0 (or Kris is marked dead), and SOULEND.formAt s later it looks again: if
  // Kris stands (a revive), the shards fly back in to Kris's chest, wherever Kris is by then, and the whole SOUL
  // swells and fades (snd_power); if not, the shards fall and fade. Why HP: the lead fell twice with a revive (game,
  // 11:43:04Z and 12:11:04Z: "HURT ... hp 0", the buffs stripped, play goes on) and neither set IsDead; the second did
  // not raise Attr.RebornUseCount either (0.5.3's trigger): that revive is a buff's. Timings are ours (DELTARUNE waits
  // 1.7 s and 3 s): this game moves on sooner. Test lines: soul fall (HP 0 for a moment) | soul break | soul form | soul off.
  var SOULEND = { breakAt: 0.25, shardAt: 0.6, formAt: 1.1, end: 2.6, speed: 210, up: 60, grav: 180, form: 0.3, glow: 0.45, fps: 6, ring: 40 };
  function hideSoul(se) {
    if (!se.on) return; se.on = false;
    show(se.heart.gameObject, false); show(se.broken.gameObject, false);
    for (var i = 0; i < se.shards.length; i++) show(se.shards[i].gameObject, false);
  }
  function soulRing(se) {
    var out = [];
    for (var i = 0; i < se.shards.length; i++) out.push({ a: (i + Math.random() * 0.6) / se.shards.length * Math.PI * 2, f: i });
    return out;
  }
  function drawSoul(c, dt, p) {
    var u = S.ui, se = u && u.soulEnd; if (!se || !se.ok) return;
    var E = SOULEND, dead = false, hp = null, q = S.soulEnd;
    try { dead = !!p.IsDead } catch (e) {}
    try { var raw = p.Attr.HP; if (raw !== undefined && raw !== null) hp = f(raw) } catch (e) {}   // (an HP that cannot be read is not a fall)
    if (hp !== null && !isNaN(hp) && hp > 0) S.hpSeen = true;       // (a player whose HP has not been read above 0 yet has not fallen)
    var fell = dead || (S.hpSeen === true && hp !== null && !isNaN(hp) && hp <= 0);
    if (S.soulForce === "break") fell = true;
    else if (S.soulForce === "form") fell = false;
    else if (S.soulForce === "fall") { fell = true; S.soulForce = null }   // one tick at 0: a revive
    if (fell && !S.wasFell && !(q && q.st !== "form" && q.st !== "glow")) {
      q = S.soulEnd = { t: 0, x: p.Position.x, y: p.Position.y + 0.62, st: "whole", sh: [] };
      log("SOUL: Kris fell (HP " + (hp === null ? "?" : hp.toFixed(0)) + (dead ? ", dead" : "") + ")");
      // 0.5.6: the companions see it: both flinch (whatever they were doing stops)
      for (var wf in F) { var ff = F[wf]; if (alive(ff) && !ff.enter) { ff.shock = CFG.who[wf].lengths.shock || 0.5; ff.cast = 0; ff.pose = 0; ff.dance = 0 } }
    } else if (!fell && S.wasFell && !q) {             // back after the shards were gone (a late revive)
      q = S.soulEnd = { t: 0, x: p.Position.x, y: p.Position.y + 0.62, st: "form", sh: soulRing(se), back: true };
      log("SOUL: Kris is back, it forms again");
    }
    S.wasFell = fell;
    if (!q) { hideSoul(se); return }
    q.t += dt;
    if (q.st === "whole" && q.t >= E.breakAt) { q.st = "broken"; sfx("break1") }
    if (q.st === "broken" && q.t >= E.shardAt) {
      q.st = "shards"; sfx("break2");
      for (var j = 0; j < se.shards.length; j++) { var an = Math.random() * Math.PI * 2; q.sh.push({ x: 0, y: 0, vx: Math.cos(an) * E.speed, vy: Math.sin(an) * E.speed + E.up, f: j }) }
    }
    if (q.st === "shards" && !q.back && q.t >= E.formAt && !fell) {   // Kris stands: the shards turn back
      q.st = "form"; q.t = 0; q.sh = soulRing(se); q.back = true;
      log("SOUL: Kris is brought back, it forms again");
    }
    // 0.5.6: Kris stays down: the companions go (their shocked look fading out: fol_<who>_gone; game, 0.5.5: they
    // stood idle beside a dead Kris). follow() brings them back when Kris stands again
    if (q.st === "shards" && !q.back && !q.left && q.t >= E.formAt && fell) { q.left = true; if (dismissParty("Kris fell", "gone") > 0) S.partyAway = true }
    if (q.back) { q.x = p.Position.x; q.y = p.Position.y + 0.62 }     // to Kris, wherever Kris is
    if (q.st === "form" && q.t >= E.form) { q.st = "glow"; q.t = 0; sfx("revive") }
    if ((q.st === "shards" && q.t >= E.end) || (q.st === "glow" && q.t >= E.glow)) { S.soulEnd = null; hideSoul(se); return }
    se.on = true;
    var xy = c.WorldToScreenPoint(new V3(q.x, q.y, 0)), ws = worldScale(c, p), cx = Math.round(xy.x), cy = Math.round(xy.y);
    show(se.heart.gameObject, q.st === "whole" || q.st === "glow"); show(se.broken.gameObject, q.st === "broken");
    if (q.st === "whole") place(se.heart, cx, cy, 16 * ws, 16 * ws, 0, new COL(1, 1, 1, 1));
    else if (q.st === "glow") { var g = q.t / E.glow, sz = 16 * ws * (1 + 0.9 * g); place(se.heart, cx, cy, sz, sz, 0, new COL(1, 1, 1, 1 - g)) }
    else if (q.st === "broken") place(se.broken, cx, cy, 20 * ws, 16 * ws, 0, new COL(1, 1, 1, 1));
    for (var k = 0; k < se.shards.length; k++) {
      var im = se.shards[k], h = q.sh[k], vis = !!h && (q.st === "shards" || q.st === "form");
      show(im.gameObject, vis); if (!vis) continue;
      var sx, sy, al = 1;
      if (q.st === "shards") {
        h.vy -= E.grav * dt; h.x += h.vx * dt; h.y += h.vy * dt;
        sx = cx + h.x * ws; sy = cy + h.y * ws; al = Math.max(0, Math.min(1, (E.end - q.t) / 0.4));
      } else { var rr = E.ring * (1 - q.t / E.form); sx = cx + Math.cos(h.a) * rr * ws; sy = cy + Math.sin(h.a) * rr * ws }
      var fi = (h.f + Math.floor(q.t * E.fps)) % 4;
      if (se.fi[k] !== fi) { se.fi[k] = fi; im.sprite = se.frames[fi] }
      place(im, sx, sy, 10 * ws, 10 * ws, 0, new COL(1, 1, 1, al));
    }
  }
  // ---- Tension at MAX for the first time in a run (js/pots_tension.js; the lead accepted "a flash and the pose the
  // first time Tension hits MAX"): the screen flashes warm white, the party strikes its pose (Kris only out of a
  // neutral state or a dash; he cannot be hurt for that moment: the game's own BattleWinProtect, 0.8 s)
  P.tensionMax = function () {
    S.flashT = 0.5; S.poseGentle = true; P.pose(); sfx("poseOn");
    try { var p = S.pl; if (p && !p.IsDead) p.BuffMgr.AddBuff("BattleWinProtect", U.FloatToFp(0.8), U.FloatToFp(9), 1, p) } catch (e) { log("tension MAX: no protection (" + e + ")") }
    log("tension MAX: the flash and the party's pose");
  };
  function drawFlash(dt) {
    var u = S.ui, fl = u && u.flash; if (!fl) return;
    var on = S.flashT > 0;
    show(fl.gameObject, on);
    if (on) fl.color = new COL(1, 0.96, 0.7, 0.45 * Math.min(1, S.flashT / 0.5));
    S.flashT = Math.max(0, (S.flashT || 0) - dt);
  }
  // ---- the companions' damage numbers in their own colours (0.5.2; the lead accepted "companions' damage numbers in
  // their own colours if tintable"). The game's numbers (GamePlay.DamageNumUI, children of DamageNumUIRoot.Cur's
  // categories) carry EnableTint / TintColor and the hit they show (HitRec.UniqueId: the target; TimeEllaps: their
  // age). js/potentials.js reports each hit of a Rude Buster or Fireshock projectile; the number that appeared for that
  // target within TINT.fresh s takes the companion's colour. The game recycles these objects: a tinted one that starts
  // again (its age drops) gets its own values back first. Known: a number of Kris's on the same enemy in the same
  // tenth of a second is tinted too, and a number the game merges hits into is one number.
  var TINT = { q: [], mine: [], life: 0.35, fresh: 0.12, cats: ["Normal", "Critical", "Element"], n: 0 };
  P.tint = TINT;
  P.tintNumber = function (uid, who) {
    if (CFG.tintNumbers === false || uid === null || uid === undefined || !CFG.who[who]) return;
    TINT.q.push({ uid: uid, who: who, t: CS.UnityEngine.Time.unscaledTime });
  };
  function tintNumbers() {
    if (!TINT.q.length && !TINT.mine.length) return;
    var now = CS.UnityEngine.Time.unscaledTime, keep = [];
    for (var m = 0; m < TINT.mine.length; m++) {     // recycled: back to what the game had set
      var o = TINT.mine[m], age = -1;
      try { if (IsNull(o.d)) continue; age = o.d.TimeEllaps } catch (e) { continue }
      if (age < o.age - 0.01) { try { o.d.EnableTint = o.on; o.d.TintColor = o.col } catch (e2) {} continue }
      o.age = age; keep.push(o);
    }
    TINT.mine = keep;
    if (!TINT.q.length) return;
    var root = null; try { root = CS.GamePlay.DamageNumUIRoot.Cur } catch (e3) {}
    if (!root || IsNull(root)) { TINT.q = []; return }
    var T2 = PU.$typeof(CS.GamePlay.DamageNumUI);
    for (var ci = 0; ci < TINT.cats.length; ci++) {
      var cat = root[TINT.cats[ci]]; if (!cat || IsNull(cat)) continue;
      var arr = cat.GetComponentsInChildren(T2, false), n = arr ? arr.Length : 0;
      for (var i = 0; i < n; i++) {
        var d = arr.get_Item(i), a2 = d.TimeEllaps; if (!(a2 < TINT.fresh)) continue;
        var uid = d.HitRec.UniqueId;
        for (var k = 0; k < TINT.q.length; k++) {
          var e = TINT.q[k]; if (e.uid !== uid) continue;
          var held = null;
          for (var h = 0; h < TINT.mine.length; h++) if (TINT.mine[h].d === d) held = TINT.mine[h];
          if (!held) { held = { d: d, on: d.EnableTint, col: d.TintColor, age: a2 }; TINT.mine.push(held) }
          var c = CFG.who[e.who].colour;
          d.EnableTint = true; d.TintColor = new COL(c[0], c[1], c[2], 1); held.age = a2; e.done = true; TINT.n++;
          break;
        }
      }
    }
    var left = [];
    for (var q = 0; q < TINT.q.length; q++) if (!TINT.q[q].done && now - TINT.q[q].t < TINT.life) left.push(TINT.q[q]);
    TINT.q = left;
    if (TINT.n > 0 && !TINT.said) { TINT.said = true; log("damage numbers: the first of a companion's is tinted") }
  }
  function extras(hud, c, dt, p) {                   // the HUD pieces that draw in every state (Kris up or down)
    try { drawBars(c, dt) } catch (e) { if (!S.barErr) { S.barErr = 1; log("recharge bars error: " + e) } }
    try { drawTension(hud, c, dt, p) } catch (e) { if (!S.tpDrawErr) { S.tpDrawErr = 1; log("tension meter error: " + e) } }
    try { drawPanel(hud, dt, p) } catch (e) { if (!S.panelErr) { S.panelErr = 1; log("party panel error: " + e) } }
    try { drawSoul(c, dt, p) } catch (e) { if (!S.soulErr) { S.soulErr = 1; log("the SOUL's end error: " + e) } }
    try { drawFlash(dt) } catch (e) {}
    try { tintNumbers() } catch (e) { if (!S.tintErr) { S.tintErr = 1; TINT.q = []; log("damage numbers: not tinted (" + e + ")") } }
  }
  // (evidence for a later build: where the HUD's own status block is, in screen pixels. The meter and the panel use
  // fixed shares of the screen: right on the lead's 3440 x 1440, unknown at 16:9. 0.5.0's read of the MP panel never
  // gave a rectangle: its corners were taken as screen pixels, which they are not on a camera canvas.)
  function statusLog(hud) {
    if (S.rectDone) return;                           // (once per HUD, half a second in: its layout has settled)
    S.rectN = (S.rectN || 0) + 1; if (S.rectN < 30) return;
    S.rectDone = true;
    try {
      var st = hud.R && hud.R.SelfStatus; if (!st || IsNull(st)) { log("HUD status block: none"); return }
      var cam2 = null, mode = "?";
      try {
        var cv = hud.CsObj.GetComponentInParent(PU.$typeof(CS.UnityEngine.Canvas)), root = cv.rootCanvas || cv;
        mode = String(root.renderMode); if (root.renderMode !== CS.UnityEngine.RenderMode.ScreenSpaceOverlay) cam2 = root.worldCamera;
      } catch (e) { mode = "? " + String(e).slice(0, 40) }
      var out = [], got = {};
      ["Content", "TextHP", "ImageHPBGTiled", "ImageHPTiled", "PanelMP", "ImageMP", "BuffIconList"].forEach(function (n) {
        var t = n + " ";
        try {
          var o = st[n];
          if (!o || IsNull(o)) t += "none";
          else {
            var arr = CS.System.Array.CreateInstance(PU.$typeof(V3), 4); o.transform.GetWorldCorners(arr);
            var a = CS.UnityEngine.RectTransformUtility.WorldToScreenPoint(cam2, arr.get_Item(0)), b2 = CS.UnityEngine.RectTransformUtility.WorldToScreenPoint(cam2, arr.get_Item(2));
            got[n] = [+a.x, +a.y, +b2.x, +b2.y];
            t += got[n].map(function (v) { return v.toFixed(0) }).join(",");
          }
        } catch (e) { t += "? " + String(e).slice(0, 50) }
        out.push(t);
      });
      if (!S.rectSaid) { S.rectSaid = true; log("HUD status block (screen px; canvas mode " + mode + ", screen " + CS.UnityEngine.Screen.width + "x" + CS.UnityEngine.Screen.height + "): " + out.join("; ")) }
      // 0.5.2: the HP bar and the HP figures place the Tension meter and the party panel (game, 3440 x 1440: the bar
      // 163,164 to 638,176, the figures up to y 205). Kept from one HUD to the next; a reading that makes no sense is
      // dropped and the fixed shares of the screen stand in.
      var hp = got.ImageHPBGTiled || got.ImageHPTiled, tx = got.TextHP, SW = CS.UnityEngine.Screen.width, SH = CS.UnityEngine.Screen.height;
      if (hp && tx && hp[2] - hp[0] > 60 && hp[3] - hp[1] > 2 && hp[3] - hp[1] < 80 && tx[3] > hp[3] && hp[0] >= 0 && hp[2] <= SW && tx[3] <= SH)
        S.rects = { hp: hp, text: tx };
    } catch (e) { log("HUD status block unreadable: " + e) }
  }
  function mark(i) {                                 // a pooled target mark: reticle + centre circle / cross
    var u = S.ui;
    while (u.marks.length <= i) {
      var ret = image(u.marksT, "Reticle", 4, 4), dot = image(u.marksT, "Circle", 4, 4);
      u.marks.push({ ret: ret, dot: dot, a: null, hover: 0, ht: 0, angle: Math.random() * 90, snap: 0 });
    }
    return u.marks[i];
  }
  function arrow(i) {
    var u = S.ui;
    while (u.arrows.length <= i) { var a = image(u.arrowsT, "Arrow", 4, 4), sp = sprite(CFG.sprites.arrow); if (sp) a.sprite = sp; u.arrows.push(a) }
    return u.arrows[i];
  }
  function ghost() {
    var u = S.ui, g = null;
    for (var i = 0; i < u.ghosts.length; i++) if (u.ghosts[i].a <= 0) { g = u.ghosts[i]; break }
    if (!g) { g = { im: image(u.ghostsT, "Ghost", 4, 4), a: 0 }; g.im.sprite = u.soul.sprite; u.ghosts.push(g) }
    return g;
  }
  function soulAt(c, p, a) { return a ? screen(c, a, centreY(a)) : screen(c, p, 0.62) }   // a target's centre / Kris's chest
  function typed(text, now, instant) {               // line 2: retyped from the start whenever it changes
    var T2 = S.typ || (S.typ = { text: null, t0: 0 });
    if (T2.text !== text) { T2.text = text; T2.t0 = now }
    return instant ? text : text.slice(0, Math.floor((now - T2.t0) * 90) + 1);
  }
  function label(w) { var L = CFG.labels || {}; return w === "susie" ? (L.susie || "S-Action") : w === "ralsei" ? (L.ralsei || "R-Action") : (L.none || "No ACT") }
  var GREEK = { "\u03b1": "Alpha", "\u03b2": "Beta", "\u03b3": "Gamma", "\u03b4": "Delta", "\u03bb": "Lambda", "\u039b": "Lambda",
                "\u03bc": "Mu", "\u039c": "Mu", "\u03bd": "Nu", "\u039d": "Nu", "\u03a9": "Omega", "\u03c9": "Omega", "\u03a3": "Sigma",
                "\u03c3": "Sigma", "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u2013": "-", "\u2014": "-", "\u3000": " " };
  var NAMES = {};
  function cleanName(n) {                             // a game name in what DELTARUNE's font can draw, or ""
    n = String(n).replace(/<[^>]*>/g, "");
    var out = "";
    for (var i = 0; i < n.length; i++) { var ch = n.charAt(i); out += GREEK[ch] !== undefined ? GREEK[ch] : ch }
    out = out.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    if (!out) return "";
    for (var j = 0; j < out.length; j++) { var c = out.charCodeAt(j); if (c < 32 || c > 126) return "" }
    return out.length > 24 ? out.slice(0, 24) : out;
  }
  // The game names only bosses and a few others (Monster_<id>: the boss bar's own key). Every other enemy's row name
  // is an internal code ("mst_yellow", "arboss3", "zz_rainbow"): 0.2.8-0.4.1 showed those, which the lead read as
  // garbled text. Now: the game's own name when the font can draw it, else "Boss" or "Enemy".
  function targetName(a) {
    var id = a.BaseID; if (NAMES[id] !== undefined) return NAMES[id];
    var name = "";
    try { var n = U.GetLocale("Monster_" + id); if (n && n !== "Monster_" + id && String(n).charAt(0) !== "_") name = cleanName(n) } catch (e) {}
    if (!name) { var b = false; try { b = isBoss(a) } catch (e2) {} name = b ? "Boss" : "Enemy" }
    return (NAMES[id] = name);
  }
  function line2(list, now) {
    var X = CFG.text, w = S.who, other = w === "susie" ? "ralsei" : "susie";
    if (!S.sel) return [list.length ? (S.lastTgt === null && S.aimT > 0.2 ? X.cancelled : X.onKris) : X.none, true];
    if (!ready("susie") && !ready("ralsei")) return [X.both, false];
    if (!ready(w)) return [X.rech[w], false];
    if (guardedNow(S.sel)) return [X.guard, false];
    return [ready(other) ? X.aim[w] : X.aimOne, false];
  }
  function drawUI(p, c, dt, list) {
    var u = S.ui; if (!u || u.broken || IsNull(u.go)) return;
    var aiming = S.state === "aim", now = CS.UnityEngine.Time.unscaledTime;
    show(u.go, aiming);
    for (var gi = 0; gi < u.ghosts.length; gi++) {   // the SOUL's afterimages fade out even after release
      var g = u.ghosts[gi]; if (g.a <= 0) continue;
      g.a -= 0.1 * dt * 30; g.im.color = new COL(1, 0, 0, Math.max(0, g.a)); show(g.im.gameObject, g.a > 0);
    }
    if (!aiming) { S.soulAt = null; S.uiSel = undefined; u.dim.color = new COL(0, 0, 0, 0); S.typ = null; return }
    var f30 = dt * 30, ws = worldScale(c, p), H = CS.UnityEngine.Screen.height, sc = H / 480;
    var can = ready(S.who), acc = ACC[S.who] || ACC.none;
    u.dim.color = new COL(0, 0, 0, Math.min(0.3, u.dim.color.a + 0.06 * f30));
    var shake = u.fail > 0 ? Math.sin(u.fail * 80) * 3 * ws : 0; u.fail = Math.max(0, u.fail - dt);
    // the SOUL: snaps, with red afterimages along the second half of the way
    var tgtXY = soulAt(c, p, S.sel);
    if (S.uiSel !== S.sel || !S.soulAt) {
      if (S.soulAt) {
        var ax = S.soulAt[0], ay = S.soulAt[1], L = Math.sqrt((tgtXY[0] - ax) * (tgtXY[0] - ax) + (tgtXY[1] - ay) * (tgtXY[1] - ay)), stepPx = 24 * ws;
        for (var d = L / 2; d < L; d += stepPx) {
          var gh = ghost(), k = d / L; gh.a = 0.2 + 0.2 * (k - 0.5) * 2;
          place(gh.im, ax + (tgtXY[0] - ax) * k, ay + (tgtXY[1] - ay) * k, 20 * ws, 20 * ws, 0, new COL(1, 0, 0, gh.a)); show(gh.im.gameObject, true);
        }
      }
      S.uiSel = S.sel;
    }
    S.soulAt = tgtXY;
    place(u.soul, tgtXY[0] + (S.sel ? shake : 0), tgtXY[1], 20 * ws, 20 * ws, 0, null);
    // the target marks
    var n = 0, now30 = now * 30;
    for (var j = 0; j < list.length; j++) {
      var a = list[j], xy = screen(c, a, centreY(a)); if (!onScreen(xy)) continue;
      var m = mark(n++), hov = a === S.sel, gu = guardedNow(a);
      if (m.a !== a) { m.a = a; m.hover = 0; m.ht = 0 }
      if (hov) { if (m.hover === 0) { m.ht = 0; m.snap = Math.round(m.angle / 90) * 90 } m.ht += dt }
      m.hover = Math.max(0, Math.min(1, m.hover + (hov ? 0.25 : -0.25) * f30));
      m.angle += 6 * (1 - m.hover) * f30;
      var ang = m.angle + (m.snap - m.angle) * m.hover, hf = Math.floor(m.ht * 30) + 1;
      var white = hov && (hf === 2 || hf === 3) ? 0.7 : 0;
      show(m.ret.gameObject, can); show(m.dot.gameObject, true);
      if (can) {
        var rs = sprite(CFG.sprites.reticle + Math.floor(m.hover * 7));
        if (rs) m.ret.sprite = rs;
        place(m.ret, xy[0] + (hov ? shake : 0), xy[1], 130 * ws, 130 * ws, ang, colour(acc, 1, white));
        var cs = gu ? sprite(CFG.sprites.red) : sprite(CFG.sprites.circle);
        if (cs) m.dot.sprite = cs;
        place(m.dot, xy[0], xy[1], (gu ? 17 : 6) * 2 * ws, (gu ? 17 : 6) * 2 * ws, 0, gu ? new COL(1, 1, 1, 1) : colour(acc, 1, white));
      } else {                                       // the acting companion is recharging: DELTARUNE's cross
        var xs = sprite(CFG.sprites.cross); if (xs) m.dot.sprite = xs;
        place(m.dot, xy[0] + (hov ? shake : 0), xy[1], 40 * ws, 40 * ws, 0, colour(acc, 1, 0));
      }
    }
    for (var r = n; r < u.marks.length; r++) { show(u.marks[r].ret.gameObject, false); show(u.marks[r].dot.gameObject, false); u.marks[r].a = null }
    // the arrow trail: from the companion who would act to the hovered target
    var na = 0;
    if (S.sel && can) {
      var fo = F[S.who], from = alive(fo) ? c.WorldToScreenPoint(new V3(fo.x, fo.y + CFG.who[S.who].height * 0.5, 0)) : null;
      var A = from ? [from.x, from.y] : screen(c, p, 0.6), B = screen(c, S.sel, centreY(S.sel));
      var vx = B[0] - A[0], vy = B[1] - A[1], L2 = Math.sqrt(vx * vx + vy * vy), rot = Math.atan2(vy, vx) * 180 / Math.PI;
      var step = 20 * ws, drift = ((now * 10) % 20) * ws, sp = sprite(CFG.sprites.arrow);
      if (sp && L2 > 60 * ws) {
        for (var dd = step + drift - step; dd <= L2 - step; dd += step) {
          if (dd < step) continue;
          var fade = Math.min(1, Math.max(0, (dd - step) / step)) * Math.min(1, Math.max(0, (L2 - step - dd) / step));
          if (fade <= 0) continue;
          var a1 = arrow(na++), g2 = arrow(na++), kx = vx / L2, ky = vy / L2, ah = 0.75 * drift;
          show(a1.gameObject, true); show(g2.gameObject, true);
          place(a1, A[0] + kx * dd, A[1] + ky * dd, 18 * ws, 18 * ws, rot, colour(acc, fade, 0));
          place(g2, A[0] + kx * (dd + ah), A[1] + ky * (dd + ah), 18 * ws, 18 * ws, rot, colour(acc, fade / 3, 0));
        }
      }
    }
    for (var ra = na; ra < u.arrows.length; ra++) show(u.arrows[ra].gameObject, false);
    // the info strip: at the top when the selected thing stands in the bottom quarter of the screen
    var mid = S.sel ? screen(c, S.sel, centreY(S.sel)) : screen(c, p, 0.6), top = mid[1] < 112 * sc;
    var srt = u.strip.rectTransform;
    if (top) { srt.anchorMin = new V2(0, 1); srt.anchorMax = new V2(1, 1); srt.pivot = new V2(0.5, 1) }
    else { srt.anchorMin = new V2(0, 0); srt.anchorMax = new V2(1, 0); srt.pivot = new V2(0.5, 0) }
    srt.sizeDelta = new V2(0, 100 * sc); srt.anchoredPosition = new V2(0, 0);
    var ss = top ? H : 100 * sc;                     // the strip's top edge, screen pixels from the bottom
    // line 1: the label at x 20; for a target, "-->  " and its name at x 16 x (label length + 1), as DELTARUNE places it
    var lab = S.sel ? label(S.who) : label(null);
    drawText(u.line1, [[lab, S.sel ? acc : ACC.none]], 20 * sc, ss - 10 * sc, sc, "big", 0);
    show(u.name.t.gameObject, !!S.sel);
    if (S.sel) drawText(u.name, [["-->  " + targetName(S.sel), [1, 1, 1]]], 16 * (lab.length + 1) * sc, ss - 10 * sc, sc, "big", 0);
    var l2 = line2(list, now);
    drawText(u.line2, [[typed(l2[0], now, l2[1]), [1, 1, 1]]], 20 * sc, ss - 40 * sc, sc, "big", l2[1] ? 0 : 16);
  }

  // ---------------------------------------------------------------- the state machine
  function begin(p, list, c) {                     // DELTARUNE's target mode always opens (recharging shows crosses)
    var w = defaultWho() || (S.wait.susie <= S.wait.ralsei ? "susie" : "ralsei");
    var keep = S.lastTgt, sticky = false;
    try { sticky = !!keep && !keep.IsDead && list.indexOf(keep) >= 0 && onScreen(screen(c, keep, centreY(keep))) } catch (e) {}
    // bosses first: a kept target the player never moved the SOUL to gives way to a boss on screen
    var dflt = defaultTarget(p, list, c);
    if (sticky && !S.stickyMine && dflt && isBoss(dflt) && !isBoss(keep)) sticky = false;
    if (!sticky) S.stickyMine = false;
    S.state = "aim"; S.aimT = 0; S.who = w; S.sel = sticky ? keep : dflt; S.prevDash = true; S.prevStick = true;
    S.rep = 0.4; S.stickFree = false; S.prevCancel = true; S.queued = null;
    block(p, true); hudShow(false); sfx("enter");
    log("aim (" + w + (ready(w) ? "" : ", recharging") + ")" + (S.sel ? "" : ": no target on screen"));
  }
  function end(p, fireIt) {
    if (fireIt && !S.ownSkill) log("released (the placeholder row fired the command)");
    else if (fireIt && S.sel && !S.sel.IsDead && ready(S.who) && M().dual && ready("susie") && ready("ralsei")) {
      sfx("select"); fire(p, "susie", S.sel, true); S.dualQ = { t: M().dualDelay || 0.25, tgt: S.sel };
    }
    else if (fireIt && S.sel && !S.sel.IsDead && ready(S.who)) { sfx("select"); fire(p, S.who, S.sel) }
    else if (fireIt && S.sel && !S.sel.IsDead && S.wait[S.who] <= CFG.buffer) {          // buffered: fires when the recharge ends
      S.queued = { who: S.who, tgt: S.sel, left: CFG.buffer }; sfx("select");
      log("buffered " + S.who + " -> " + S.sel.BaseID + "#" + S.sel.UniqueId + " (" + S.wait[S.who].toFixed(2) + " s of recharge left)");
    }
    else if (fireIt && S.sel) { sfx("fail"); if (S.ui) S.ui.shake = 0.3; log("released while " + S.who + " recharges: nothing spent") }
    else if (fireIt) log("released with no target: nothing spent");
    S.state = "release"; S.sel = null; S.relT = 0;
    block(p, false); hudShow(true);
  }
  function cancel(p) { if (S.state === "aim") { log("command cancelled"); block(p, false) } S.state = "idle"; S.sel = null; restoreScale(); hudShow(true) }

  function perf(dt, ts) {
    var q = S.perf; q.t += dt; q.n++; q.max = Math.max(q.max, dt);
    if (q.t < 10) return;
    log("perf: " + (q.n / q.t).toFixed(0) + " fps average, slowest frame " + (q.max * 1000).toFixed(0) + " ms, time scale " +
        ts.toFixed(2) + ", state " + S.state);
    q.t = 0; q.n = 0; q.max = 0;
  }
  // a new HUD: the overlay built for the one before goes (its objects used to stay in the scene)
  function dropUI() {
    var u = S.ui; if (!u || u.broken) return;
    ["go", "bgo", "sgo"].forEach(function (k) { try { if (u[k] && !IsNull(u[k])) CS.UnityEngine.Object.Destroy(u[k]) } catch (e) {} });
  }
  // ---------------------------------------------------------------- without a battle HUD (0.5.1)
  // tick() runs from BattleUI's LateUpdate, so nothing of this ran where no battle HUD is up: the lobby, where picking
  // Kris swaps the avatar for Kris (SceneUIHeroSelect.ChangeAvatarToHero: ChangePlayerSelf, then "pvp_born", Kris's
  // pose) while the Evotype screen is open. The lead, 2026-10-03: Susie and Ralsei "should appear with kris or like
  // spawn in with animation next to kris and do their iconic fun gang pose when kris loads into a run and does his
  // taunt they should also appear in thier idle next to him in the character select". A timer takes over whenever
  // tick() has not run for 0.3 s: the companions alone (they drop in beside Kris, pose with him, stand by him and
  // follow him; they leave when the player is someone else), the SOUL's end if it is playing, and our overlays are
  // hidden so none stays over a results screen or a cutscene. The command, the bars and the Potentials wait for the HUD.
  function offHud() {
    if (!S.on) return;
    var now = CS.UnityEngine.Time.unscaledTime;
    if (now - S.hudAt < 0.3) { S.offAt = undefined; S.offN = 0; return }
    // (0.5.2: three frames of it. A battle's first frames and a long hitch are not "no HUD": 0.5.1 took over for a
    // frame at every battle's start)
    if (now !== S.offLast) { S.offLast = now; S.offN = (S.offN || 0) + 1 }
    if (S.offN < 3) return;
    if (S.ui && !S.ui.broken && !S.uiHidden) {
      S.uiHidden = true;
      try { if (!IsNull(S.ui.bgo)) S.ui.bgo.SetActive(false); if (!IsNull(S.ui.go)) S.ui.go.SetActive(false) } catch (e) {}
      if (S.state !== "idle") {                       // the HUD went while aiming: the buttons and the battle's speed go back
        try { var pb = battle() && battle().PlayerSelf; if (pb) block(pb, false) } catch (e2) {}
        restoreScale(); S.state = "idle"; S.sel = null;
      }
    }
    var dt = S.offAt === undefined ? 0 : Math.min(0.1, now - S.offAt); S.offAt = now;
    if (!(dt > 0)) return;
    if (!U) { U = UM.U; if (!U) return }
    flush(now);
    var b = battle(), p = b && b.PlayerSelf;
    if (!p || IsNull(p)) return;
    if (!isKris(p)) return;                           // (a new player: isKris sends the companions of the one before away)
    S.tickN = (S.tickN || 0) + 1;
    var ts = 1; try { ts = b.TimeScale } catch (e) {}
    var bdt = dt * ts; S.bnow += bdt;
    if (S.offPl !== p) {
      S.offPl = p; var cn = "?"; try { cn = String(BattleJs_1.default.Instance.BattleClassName) } catch (e) {}
      log("no battle HUD here (" + cn + "): the companions run from the timer");
    }
    try { follow(p, bdt) } catch (e) { if (!S.offErr) { S.offErr = 1; log("followers (no HUD): " + e) } }
    for (var ws in F) sortWith(F[ws]);                // (0.5.8: in front of the lobby's screens, as Kris is)
    try { pollTest(now) } catch (e4) {}               // (dev: the test lines are read here too)
    if (S.soulEnd || S.wasFell || p.IsDead) { var c2 = cam(); if (c2) { try { drawSoul(c2, dt, p) } catch (e) {} } }
  }
  P.offHud = offHud;
  function tick(hud) {
    if (!U) { U = UM.U; if (!U) return; log("core Util ready") }
    S.tickN = (S.tickN || 0) + 1;
    var now = CS.UnityEngine.Time.unscaledTime, dt = Math.min(0.1, CS.UnityEngine.Time.unscaledDeltaTime);
    S.hudAt = now;                                    // (the timer below stands in when this stops)
    flush(now); pollTest(now);
    var b = battle(), p = b && b.PlayerSelf;
    if (!p) { if (S.state !== "idle") { S.state = "idle"; S.ts = null } hudShow(true); return }
    if (!isKris(p) || !S.on) return;
    // a new HUD: its sprites are new objects. 0.4.3: the font's glyph sprites too (S.gly): they were cut from the old
    // HUD's texture and drew nothing after it (the lead, in a run started after the test room: "the skill text when
    // held isnt even there anymore auto doesnt appear")
    if (S.hud !== hud) { dropUI(); S.hud = hud; S.spr = {}; S.gly = {}; S.font = undefined; S.ui = null; S.hudOn = true; S.tpRect = null; S.uiHidden = false; S.rectN = 0; S.rectDone = false }
    if (S.uiHidden && S.ui && !S.ui.broken) { S.uiHidden = false; try { if (!IsNull(S.ui.bgo)) S.ui.bgo.SetActive(true) } catch (e) {} }
    if (!S.ui) { try { buildUI(hud) } catch (e) { S.ui = { broken: true }; log("command UI not built: " + e) } }
    statusLog(hud);
    hcUpdate();
    own(p);
    var ts = 1; try { ts = b.TimeScale } catch (e) {}
    var bdt = dt * ts;                                       // battle time this frame
    S.bnow += bdt;
    // 0.5.2: the battle stands still and it is not our own target mode (a Tactic or Potential choice, a pause): what is
    // pinned to the world hides (on 0.5.1's capture the AUTO tags lay over the Tactic selection screen)
    S.frozen = ts < 0.01 && S.state !== "aim" && S.state !== "release";
    if (S.poseQ > 0) { S.poseQ -= dt; if (S.poseQ <= 0) { try { strikePose(p) } catch (e) { log("pose: " + e) } } }
    if (S.queued) {
      var q = S.queued; q.left -= bdt;
      var gone = true; try { gone = !q.tgt || q.tgt.IsDead } catch (e) {}
      if (gone || q.left <= 0) S.queued = null;
      else if (ready(q.who) && S.state !== "aim") { S.queued = null; fire(p, q.who, q.tgt) }
    }
    if (S.dualQ) { S.dualQ.t -= bdt; if (S.dualQ.t <= 0) { var dq = S.dualQ; S.dualQ = null; if (dq.tgt && !dq.tgt.IsDead && ready("ralsei")) fire(p, "ralsei", dq.tgt, true) } }
    S.wait.susie = Math.max(0, S.wait.susie - bdt); S.wait.ralsei = Math.max(0, S.wait.ralsei - bdt);
    try { follow(p, bdt) } catch (e) { log("followers: " + e) }
    launches(p, bdt); watchShots(); retarget(p, bdt);
    perf(dt, ts);
    var c = cam(); if (!c) return;
    if (p.IsDead) { cancel(p); drawUI(p, c, dt, []); extras(hud, c, dt, p); return }
    var skill = held(p, CS.GamePlay.InputCmd.Skill);
    var list = enemies(p);
    // the dance taunt: Summon pressed with Down held (js/pots_pen.js leaves that press alone)
    var summon = held(p, CS.GamePlay.InputCmd.Summon);
    if (summon && !S.prevSummon && S.state !== "aim" && P.stickDown()) P.dance();
    S.prevSummon = summon;
    // a boss goes down and no boss is left: the party strikes its pose (Kris only from a neutral state)
    var bossN = 0; for (var bi = 0; bi < list.length; bi++) if (isBoss(list[bi])) bossN++;
    if (S.bossN > 0 && bossN === 0 && !p.IsDead) { S.poseGentle = true; P.pose(); log("boss down: the party poses") }
    S.bossN = bossN;
    if (skill && !S.prevSkill && (S.state === "idle" || S.state === "release")) {
      if (potCall("skillPress", [p, stick(p), now]) === true) S.skillLock = true;   // a Potential took the press
      else if (!S.skillLock) begin(p, list, c);
    }
    if (!skill) S.skillLock = false;
    if (S.state === "aim") {
      S.aimT += dt;
      if (S.aimT >= CFG.holdDelay) setScale(CFG.slow, dt);
      if (S.sel && (S.sel.IsDead || !onScreen(screen(c, S.sel, centreY(S.sel))))) S.sel = defaultTarget(p, list, c);
      var st = stick(p), mag = Math.sqrt(st[0] * st[0] + st[1] * st[1]), out = mag > CFG.stick;
      // 0.4.3: a direction held since before the aim began (the player was running) is not a press and never repeats:
      // it has to be let go once. A press steps once; held on, it repeats after 0.4 s every 0.22 s (0.32 / 0.12 before)
      if (!out) S.stickFree = true;
      if (out && !S.prevStick && S.stickFree) { move(p, list, c, st[0], st[1]); S.rep = 0.4 }
      else if (out && S.stickFree) { S.rep -= dt; if (S.rep <= 0) { move(p, list, c, st[0], st[1], true); S.rep = 0.22 } }
      S.prevStick = out;
      var dash = held(p, CS.GamePlay.InputCmd.Dash);
      if (dash && !S.prevDash) {
        var other = S.who === "susie" ? "ralsei" : "susie";
        if (ready(other)) { S.who = other; sfx("move"); log("swap -> " + other) } else { ui_fail(); sfx("fail"); if (S.ui) S.ui.shake = 0.3 }
      }
      S.prevDash = dash;
      var cancelKey = held(p, CS.GamePlay.InputCmd.Attack) || held(p, CS.GamePlay.InputCmd.Jump);
      if (cancelKey && !S.prevCancel && S.sel) { S.sel = null; S.lastTgt = null; sfx("fail"); log("SOUL back on Kris (cancel)") }
      S.prevCancel = cancelKey;
      if (!skill) end(p, true);
    }
    if (S.state === "release") {                              // ease back to full speed
      S.relT = (S.relT || 0) + dt;
      setScale(1, dt);
      if (S.ts === null || S.ts >= 1 || S.relT > 0.5) { if (S.relT > 0.5) restoreScale(); S.state = "idle"; S.ts = null }
    }
    S.prevSkill = skill;
    try { drawUI(p, c, dt, list) } catch (e) { if (!S.uiErr) { S.uiErr = 1; log("command UI error: " + e) } }
    extras(hud, c, dt, p);
  }

  T["dr-party/command"] = function (hud) {
    if (!S.on) return;
    try { tick(hud); S.err = 0 }
    catch (e) {
      S.err++; log("error: " + e);
      try { var p = battle() && battle().PlayerSelf; if (p) block(p, false) } catch (e2) {}
      restoreScale(); S.state = "idle"; try { hudShow(true) } catch (e3) {}
      if (S.err >= 3) { S.on = false; log("command switched off after repeated errors"); try { flush(1e9) } catch (e3) {} }
    }
  };
  P.isKris = function (p) { return !!p && String(p.ActionGroupID) === CFG.actor };
  try {
    if (typeof G.setInterval === "function") {
      G.setInterval(function () { try { offHud() } catch (e) { if (!S.timerErr) { S.timerErr = 1; log("timer: " + e) } } }, 16);
      log("timer started (the companions where no battle HUD is up)");
    } else log("this script host has no timers: the companions only run with the battle HUD");
  } catch (e) { log("timer not started: " + e) }
  log("command script registered");
})();
