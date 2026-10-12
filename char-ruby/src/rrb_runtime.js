/* char-ruby runtime, appended to gameplay/buff/BuffFuncs by bbmod (build_ruby prepends RRB_POWER from rrb_power.py).

   rrbDustHit: the Dust base effects (KIT_V2 §5).
   The loaded Dust buff (rrb_dust1-4) calls rrbDustHit on every hit she lands (buff logic 105, PostHit): it adds
   the element's status (RRB_POWER.dust: Burn 1116 / Cold 2102 / Shock 10001 / Curse 1125), then:
     el 2 Ice:       the 5th Cold (2102) stack Freezes (2101, 1.5 s, 0.05 s later) and clears the Cold; bosses only take Cold.
     el 3 Lightning: every 3rd hit on the same enemy Paralyses it (21521, 0.5 s); not bosses.
     el 4 Gravity:   each hit pulls the enemy 0.35 u toward her (AddMove; not bosses or immovable enemies).
   With the Dust card (20731: rrb_dustN_s on her) each is stronger (the card: "Burn spreads, Frozen enemies shatter,
   Paralysis jumps to a nearby enemy, Gravity pulls harder"):
     Fire:      a hit on a burning enemy spreads the Burn to the nearest other enemy within 3 u (once per 0.6 s each);
     Ice:       Freeze at 4 stacks for 2.25 s; her direct hit that breaks the Freeze shatters it: 6 % of its max HP
                as Ice damage (her secondary effects skip a frozen enemy: the rrb_frozen tag);
     Lightning: Paralysis every 2nd hit, and it jumps to the nearest other enemy within 4 u (not bosses);
     Gravity:   a harder pull.
   With the Ice card (20736: trigger 207361) her scythe hits deal 30 % more damage to Frozen enemies (Ice damage).
   (0.6.5 game test, 2026-09-30: the spread, shatter, jump and scythe bonus were missing. 0.6.8-0.6.11: the Freeze never
   held (added inside the hit; any hit ends the stock Freeze): it is delayed 0.05 s (rrbFreezeGo), read before the hit
   (rrbIcePre) and protected from her secondary effects.)
   ExternCall passes (owner, buff, params, payload); the payload is taken as the ActorHitResult (payload.Target), as the
   trigger hits are. Script damage is BattleUtils.ActorDirectDamage (verified by Boons Plus; it is not a hit). Every
   step is guarded: a failure logs once to modlog.txt and the hit is unchanged. */
buffFuncs.rrbDustHit = (e, t, a, r) => {
  var S = globalThis.RRB_DUST || (globalThis.RRB_DUST = { bolt: new Map(), said: {} }), U = Util_1.U, CS = csharp_1;
  if (!S.cd) S.cd = new Map();
  if (!S.frz) S.frz = new Map();
  function say(k, m) {
    if (S.said[k]) return; S.said[k] = 1;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY DUST " + m + "\n") } catch (x) {}
  }
  function now() { try { return U.FpToFloat(CS.GamePlay.BattleBase.Cur.BattleTimeFp) } catch (x) { return -1 } }
  function trace(m) {
    var T = globalThis.BBTR; if (!T || !T.trace || !globalThis.BBTR_ACTIVE) return;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY TRACE dust " + m + "\n") } catch (x) {}
  }
  function isBoss(x) { try { var g = x.TagMgr; return !!g && (g.HasTag("boss") || g.HasTag("Boss") || g.HasTag("EliteBoss") || g.HasTag("FinalBoss")) } catch (y) { return false } }
  /* once per `gap` s for a key (battle time); a clock that went backwards (a new battle) resets it */
  function ready(key, gap) {
    var tn = now(); if (!(tn >= 0)) return false;
    var last = S.cd.get(key);
    if (last !== undefined && last <= tn && tn - last < gap) return false;
    S.cd.set(key, tn); if (S.cd.size > 1024) S.cd.clear(); return true;
  }
  /* the other live enemies within r of `src`, nearest first (Boons Plus's scan: PlayerObjMgr.ActorList by faction) */
  function near(src, r) {
    var out = [];
    try {
      var L = CS.GamePlay.BattleBase.Cur.PlayerObjMgr.ActorList, fa = e.Faction, sx = src.Position.x, sy = src.Position.y;
      for (var i = 0; i < L.Count; i++) {
        var o = L.get_Item(i);
        try {
          if (!o || o === src || o.IsDead || !o.BuffMgr || o.Faction === fa) continue;
          var d = Math.hypot(o.Position.x - sx, o.Position.y - sy); if (d <= r) out.push({ a: o, d: d });
        } catch (x) {}
      }
    } catch (x) { say("scan", "enemy scan EXC " + x) }
    out.sort(function (p, q) { return p.d - q.d });
    return out;
  }
  function damage(to, amount, element) {
    if (!(amount > 0)) return false;
    try { CS.GamePlay.BattleUtils.ActorDirectDamage(e, to, U.FloatToFp(amount), element); return true } catch (x) { say("dmg", "damage EXC " + x); return false }
  }
  function maxHp(x) { try { return U.FpToFloat(x.Attr.MaxHp) } catch (y) { return 0 } }
  var SCYTHE = /^rrb_(a[1-4]|5b|2a|2b|sweep|launcher|clash|corkscrew|guil|ja|jb|jc|hook)/;
  try {
    var v = null;
    try { v = r && r.Target && r.Target.BuffMgr ? r.Target : (r && r.BuffMgr ? r : null) } catch (x) {}
    if (!v || !e) { say("nov", "no target in the hit payload (" + (r && r.GetType ? r.GetType().Name : typeof r) + ")"); return false }
    var el = 0; try { el = a.GetI("el") } catch (x) {}
    var strong = false; try { strong = !!e.BuffMgr.Find("rrb_dust" + el + "_s") } catch (x) {}
    var boss = isBoss(v), vid = 0; try { vid = v.UniqueId } catch (x) {}
    // held by Guillotine or pinned by Red Reaper: no Paralysis (an x-only lock of its own) and no Gravity pull fight the hold
    var held = false; try { held = !!(v.BuffMgr.Find("rrb_guil_hold") || v.BuffMgr.Find("rrb_rr_hold")) } catch (x) {}
    if (globalThis.BBTR && globalThis.BBTR.trace) {
      var tw = "", tf = false, tc = 0;
      try { tw = (r.Attacker && r.Attacker.ActionMgr ? r.Attacker.ActionMgr.CurrentActionName : "") || "" } catch (x) {}
      try { tf = !!v.BuffMgr.Find("2101") } catch (x) {}
      try { var tcb = v.BuffMgr.Find("2102"); tc = tcb ? tcb.Stack : 0 } catch (x) {}
      trace("hit el " + el + (strong ? " strong" : "") + " by " + tw + " on " + vid + (boss ? " boss" : "") + " frozen " + tf + " cold " + tc +
            " since " + (S.frz.has(vid) ? (now() - S.frz.get(vid)).toFixed(2) : "-"));
    }
    var D = RRB_POWER.dust[el];   // the element's status, once per hit (x1.5 with the Dust card)
    // the shot that landed this hit (its attacker action, the trace's 'by'): j.C's Dust round and its floor burst
    // (RRB_POWER.full) give the loaded Dust's full effect, once per enemy and element in 0.3 s; her other flying rounds
    // (RRB_POWER.gun) count RRB_POWER.gunDose doses, so one landed round shows its element (the lead, 2026-10-02: "dust
    // bullet effects still dont apply when they should during sypod or rifle tap shots")
    var shot = ''; try { shot = (r.Attacker && r.Attacker.ActionMgr ? r.Attacker.ActionMgr.CurrentActionName : '') || '' } catch (x) {}
    if (!S.reF && RRB_POWER.full) S.reF = new RegExp(RRB_POWER.full);
    if (!S.reG && RRB_POWER.gun) S.reG = new RegExp(RRB_POWER.gun);
    var full = !!(S.reF && S.reF.test(shot));
    var dose = (!full && S.reG && S.reG.test(shot)) ? (RRB_POWER.gunDose || 1) : 1;
    if (full) {
      if (!ready('full' + el + '_' + vid, 0.3)) return true;
      trace('full el ' + el + (strong ? ' strong' : '') + ' by ' + shot + ' on ' + vid + (boss ? ' boss' : ''));
    }
    if (el === 1 && strong && D) {   // Fire: a burning enemy passes its Burn on
      var burning = false; try { burning = !!v.BuffMgr.Find(D[0]) } catch (x) {}
      if (burning && ready("fs" + vid, 0.6)) {
        var nf = near(v, 3.0);
        if (nf.length) { try { nf[0].a.BuffMgr.AddBuff(D[0], U.FloatToFp(D[1] * 1.5), U.FloatToFp(D[2] * 1.5), 1, e); say("spread", "Fire: Burn spreads to a nearby enemy") } catch (x) { say("spx", "spread EXC " + x) } }
      }
    }
    if (el === 2 && !boss) {   // Ice: shatter, and the Ice card's scythe bonus, on a Frozen enemy
      // Frozen when this hit landed: rrbIcePre's note (PreCalc), since the hit ends the stock Freeze before PostHit
      var tn = now(), pre = S.pre ? S.pre.get(vid) : undefined;
      var frozen = !!(pre && pre.frozen && Math.abs(pre.t - tn) < 0.0005);
      if (!frozen) { try { frozen = !!v.BuffMgr.Find("2101") } catch (x) {} }
      if (frozen) {
        try { v.TagMgr.RemoveTag("rrb_frozen"); if (v.BuffMgr.Find("rrb_frz_tag")) v.BuffMgr.Remove("rrb_frz_tag") } catch (x) {}
        var since = S.frz.get(vid);
        if (since === undefined || since > tn) { since = tn; S.frz.set(vid, tn) }
        var who = ""; try { who = (r.Attacker && r.Attacker.ActionMgr ? r.Attacker.ActionMgr.CurrentActionName : "") || e.ActionMgr.CurrentActionName } catch (x) {}
        var iceCard = false; try { iceCard = !!e.TriggerMgr.FindTriggerByIdxRange(207361, 207361) } catch (x) {}
        if (iceCard && SCYTHE.test(who || "")) {
          var hit = 0; try { hit = U.FpToFloat(r.DamageDetail.PhsycalDamageTotal) } catch (x) {}
          if (damage(v, hit * 0.3, 2)) say("icebonus", "Ice card: +30 % scythe damage on a Frozen enemy (" + Math.round(hit * 0.3) + ")");
        }
        // (0.6.11 game test: her multi-hit attacks break the Freeze 0.1-0.2 s in, so the old ">= 0.5 s Frozen" rule
        //  almost never shattered.) With the Dust card, the direct hit that breaks the Freeze shatters it
        if (strong && tn >= 0 && ready("sh" + vid, 1.0)) {   // one shatter per enemy a second (every Sy-Pod round connects now)
          trace("shatter on " + vid);
          try { if (v.BuffMgr.Find("2101")) v.BuffMgr.Remove("2101") } catch (x) {}
          S.frz.delete(vid);
          if (damage(v, maxHp(v) * 0.06, 2)) say("shatter", "Ice: a Frozen enemy shatters (6 % max HP)");
          return true;
        }
      } else if (S.frz.has(vid)) S.frz.delete(vid);
      if (S.frz.size > 512) S.frz.clear();
    }
    if (D) {
      var k_ = strong ? 1.5 : 1, dur_ = D[1], str_ = D[2];
      if (full && el === 1 && RRB_POWER.fullFire) { dur_ = RRB_POWER.fullFire[0]; str_ = RRB_POWER.fullFire[1] }
      // Cold: one stack a dose; the full Ice hit on a boss tops it up to the Freeze count (bosses only take Cold)
      var c0 = null; try { c0 = el === 2 ? v.BuffMgr.Find('2102') : null } catch (x) {}
      var reps = el !== 2 ? 1 : (full && boss ? Math.max(1, (strong ? 4 : 5) - (c0 ? c0.Stack : 0)) : dose);
      for (var i_ = 0; i_ < reps; i_++) v.BuffMgr.AddBuff(D[0], U.FloatToFp(dur_ * k_), U.FloatToFp(str_ * k_), 1, e);
      say('dst' + el, 'status ' + D[0] + ' on hit (element ' + el + (strong ? ', strong' : '') + ')');
      trace('status ' + D[0] + ' x' + reps + ' str ' + Math.round(str_ * k_ * 100) / 100 + (full ? ' full' : '') + ' by ' + shot + ' on ' + vid);
    }
    if (el === 2) {
      var c = v.BuffMgr.Find("2102"), n = c ? c.Stack : 0, need = strong ? 4 : 5;
      say("ice", "Ice: first hit, Cold " + n + (boss ? " (boss)" : ""));
      if (boss || (n < need && !full) || v.BuffMgr.Find("2101") || v.BuffMgr.Find("rrb_frz") || v.BuffMgr.Find("rrb_frz_s")) return true;
      // the Freeze comes 0.05 s later (rrbFreezeGo): added inside this hit, the hit reaction ended it at once (0.6.8)
      v.BuffMgr.AddBuff(strong ? "rrb_frz_s" : "rrb_frz", U.FloatToFp(0.3), U.FloatToFp(1), 1, e);
      v.BuffMgr.Remove("2102");
      say("icef", "Ice: Freeze at " + need + " Cold stacks");
    } else if (el === 3) {
      var every = strong ? 2 : 3, k = full ? every : (S.bolt.get(vid) || 0) + dose;
      say("bolt", "Lightning: first hit" + (boss ? " (boss)" : ""));
      if (k >= every) {
        k = 0;
        if (!boss && !held) { v.BuffMgr.AddBuff("21521", U.FloatToFp(0.5), U.FloatToFp(1), 1, e); say("boltp", "Lightning: Paralysis on hit " + every); trace("paralysis on " + vid + (full ? " full" : "")) }
        if (strong) {   // the Paralysis jumps on
          var nb = near(v, 4.0);
          for (var j = 0; j < nb.length; j++) {
            if (isBoss(nb[j].a)) continue;
            try { nb[j].a.BuffMgr.AddBuff("21521", U.FloatToFp(0.5), U.FloatToFp(1), 1, e); say("jump", "Lightning: Paralysis jumps to a nearby enemy") } catch (x) { say("jmx", "jump EXC " + x) }
            break;
          }
        }
      }
      S.bolt.set(vid, k); if (S.bolt.size > 512) S.bolt.clear();
    } else if (el === 4) {
      /* 0.9.0: a round of hers opens a gravity well on the enemy it hits, one per enemy every RRB_POWER.gwAgain s.
         (0.8.0 asked the engine for that limit: CreateBullet's target_limit with a marker buff. In game, 2026-10-09,
         the marker never went on the enemy and Sy-Pod's two rounds opened two wells on one target.) */
      if (S.reG && S.reG.test(shot) && !/^rrb_gwell/.test(shot) && ready("gw" + vid, RRB_POWER.gwAgain || 2.3)) {
        try {
          var W2 = CS.UnityEngine.Vector2, sa0 = null;
          try { var sk0 = e.SkillMgr.FindSkillByActionName("rrb_rifleshot"); sa0 = sk0 ? sk0.SkillActivate : null } catch (x) {}
          var wb = CS.GamePlay.BattleBase.Cur.BulletMgr.CreateBulletByParams(e, RRB_POWER.bid, U.Vector2ToFp2(new W2(v.Position.x, v.Position.y)),
                     U.Vector2ToFp2(new W2(1, 0)), U.FloatToFp(1), "rrb_gwell", sa0, null);
          trace("gwell on " + vid + (wb ? "" : " (not created)"));
        } catch (x) { say("gwx", "gravity well EXC " + x) }
      }
      if (boss || held) return true;
      if (/^rrb_gwell/.test(shot)) return true;      // the gravity well's own ticks pull to ITS centre (the zone's push), not to her
      try { var at = v.Attr; if (at.GetResistance(1) || at.GetResistance(5)) return true } catch (x) { return true }
      var me = e; try { if (t && t.RootCaster) me = t.RootCaster } catch (x) {}
      var stop = full && RRB_POWER.fullPull ? RRB_POWER.fullPull[1] : 0.6;
      var gp = RRB_POWER.gravPull || [0.35, 0.55];
      var reach = full && RRB_POWER.fullPull ? RRB_POWER.fullPull[0] * (strong ? 1.35 : 1) : (strong ? gp[1] : gp[0]) * dose;
      var dx = me.Position.x - v.Position.x;
      if (Math.abs(dx) < stop) return true;
      var mv = (dx > 0 ? 1 : -1) * Math.min(Math.abs(dx) - stop, reach);
      v.ActorPosition.AddMove(U.Vector2ToFp2(new CS.UnityEngine.Vector2(mv, 0)));
      say("grav", "Gravity: pull");
      trace("pull " + Math.abs(mv).toFixed(2) + (full ? " full" : "") + " on " + vid);
    }
    return true;
  } catch (x) { say("exc" + (a && a.GetI ? a.GetI("el") : ""), "EXC " + x); return false }
};

/* rrbStage (buff rrb_stagechk, added whenever she enters stand / run): counts the Potentials she holds (their triggers)
   and sets her power stage (rrb_power.py): rrb_stage2 / rrb_stage3 on her, the other removed. Also sets rrb_has_rc
   when the account has Rachel unlocked (the game's own check), so Rachel's wind shows in Petal Burst only for her owners. */
buffFuncs.rrbStage = (e, t, a, r) => {
  var S = globalThis.RRB_DUST || (globalThis.RRB_DUST = { bolt: new Map(), said: {} }), U = Util_1.U, C = RRB_POWER;
  function say(k, m) {
    if (S.said[k]) return; S.said[k] = 1;
    try { csharp_1.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY POWER " + m + "\n") } catch (x) {}
  }
  try {
    if (!e || !e.TriggerMgr || !e.BuffMgr) return false;
    try { buffFuncs.rrbStagScan(e) } catch (x) {}      // 0.9.0: the enemies her rounds can make flinch (stagger rule)
    try { if (!e.BuffMgr.Find("rrb_cine")) buffFuncs.rrbCineOff(e) } catch (x) {}   // (a cinematic start's camera, should its end be missed)
    function has(id) { try { return !!e.TriggerMgr.FindTriggerByIdxRange(id, id) } catch (x) { return false } }
    var n = 0, uni = 0;
    for (var i = 0; i < C.cards.length; i++) if (has(C.cards[i])) n++;
    for (var j = 0; j < C.universal.length; j++) if (has(C.universal[j])) uni++;
    var st = n >= C.s3 && uni === C.universal.length ? 3 : n >= C.s2 ? 2 : 1;
    for (var k = 2; k <= 3; k++) {
      var b = e.BuffMgr.Find("rrb_stage" + k);
      if (st === k && !b) e.BuffMgr.AddBuff("rrb_stage" + k, U.FloatToFp(600), U.FloatToFp(1), 1, e);
      else if (st !== k && b) e.BuffMgr.Remove("rrb_stage" + k);
    }
    if (S.stage !== st) {
      /* (2026-10-03) reaching a stage is marked: a crescent that flashes and scatters into rose petals (buff rrb_stageup2 / 3, 1.3 s: the break plays 1.1 s). Not on
         the first count of a session (a run that is continued), nor when the stage drops (a new run) */
      if (S.stage !== undefined && st > S.stage) {
        try { e.BuffMgr.AddBuff("rrb_stageup" + st, U.FloatToFp(1.3), U.FloatToFp(1), 1, e) } catch (x) { say("upx", "stage-up EXC " + x) }
      }
      S.stage = st; S.said["st" + st] = 0; say("st" + st, "stage " + st + " (" + n + " Potentials, " + uni + " Universal)")
    }
    if (S.rc === undefined) {
      S.rc = false;
      try { var DB = require("../../DataBinding").DB; S.rc = !!DB.BaseActor.GetData(C.rachel) } catch (x) { say("rcx", "Rachel unlock check EXC " + x) }
      say("rc", "Rachel " + (S.rc ? "owned: her wind shows in Petal Burst" : "not owned: rose petals only"));
    }
    if (S.rc && !e.BuffMgr.Find("rrb_has_rc")) e.BuffMgr.AddBuff("rrb_has_rc", U.FloatToFp(600), U.FloatToFp(1), 1, e);
    // Silver Eyes: its hit hook against Staggered enemies (rrbSilverHit) while the card is held
    var se = has(C.silver), sb = e.BuffMgr.Find("rrb_silver");
    if (se && !sb) e.BuffMgr.AddBuff("rrb_silver", U.FloatToFp(600), U.FloatToFp(1), 1, e);
    else if (!se && sb) e.BuffMgr.Remove("rrb_silver");
    return true;
  } catch (x) { say("exc", "EXC " + x); return false }
};

/* rrbIcePre (the Ice Dust buff rrb_dust2, hit logic at PreCalc): notes whether the target is Frozen when the hit lands,
   before the damage; the stock Freeze ends on the hit (StopCond EndStatePassive / its Behit2101) before rrbDustHit's
   PostHit, which reads this note for the same hit (same battle time). */
buffFuncs.rrbIcePre = (e, t, a, r) => {
  var S = globalThis.RRB_DUST || (globalThis.RRB_DUST = { bolt: new Map(), said: {} }), U = Util_1.U;
  try {
    var v = r && r.Target && r.Target.BuffMgr ? r.Target : null; if (!v) return true;
    if (!S.pre) S.pre = new Map();
    var tn = -1; try { tn = U.FpToFloat(csharp_1.GamePlay.BattleBase.Cur.BattleTimeFp) } catch (x) {}
    var fz = false; try { fz = !!v.BuffMgr.Find("2101") } catch (x) {}
    S.pre.set(v.UniqueId, { t: tn, frozen: fz });
    if (S.pre.size > 512) S.pre.clear();
    return true;
  } catch (x) { return false }
};

/* rrbFreezeGo (buffs rrb_frz / rrb_frz_s, BuffLogic_ScriptCallDelayed 0.05 s; rrbDustHit puts one on an enemy whose Cold
   reached the Freeze threshold). The stock Freeze (2101) ends when its target enters a hit reaction (StopCond
   EndStatePassive): added inside the hit that earned it, it ended at once, so no Freeze, shatter or Ice-card bonus ever
   happened (0.6.8 test-room trace). The stock Cold delays it the same way (2102 adds 2101_delay). */
buffFuncs.rrbFreezeGo = (e, t, a, r) => {
  var S = globalThis.RRB_DUST || (globalThis.RRB_DUST = { bolt: new Map(), said: {} }), U = Util_1.U, CS = csharp_1;
  function say(k, m) {
    if (S.said[k]) return; S.said[k] = 1;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY DUST " + m + "\n") } catch (x) {}
  }
  try {
    if (!e || !e.BuffMgr || e.IsDead) return true;
    if (e.BuffMgr.Find("2101")) return true;
    var cs = 150; try { cs = a.GetI("cs") || 150 } catch (x) {}
    var c = null; try { var hb = e.BuffMgr.Find("rrb_frz_s") || e.BuffMgr.Find("rrb_frz"); c = hb ? (hb.RootCaster || hb.Caster) : null } catch (x) {}
    e.BuffMgr.AddBuff("2101", U.FloatToFp(cs / 100), U.FloatToFp(1), 1, c);
    var on = false; try { on = !!e.BuffMgr.Find("2101") } catch (x) {}
    if (!S.frz) S.frz = new Map();
    if (on) {
      try { S.frz.set(e.UniqueId, U.FpToFloat(CS.GamePlay.BattleBase.Cur.BattleTimeFp)) } catch (x) {}
      // her secondary effects (zones) exclude this tag, so only her attacks break the Freeze; rrb_frz_tag ends with it
      try { e.TagMgr.AppendTag("rrb_frozen"); e.BuffMgr.AddBuff("rrb_frz_tag", U.FloatToFp(cs / 100), U.FloatToFp(1), 1, c) } catch (x) {}
    }
    say(on ? "frzon" : "frzno", on ? "Ice: Frozen for " + (cs / 100) + " s" : "Ice: the Freeze did not take (armor above 7?)");
    var T = globalThis.BBTR;
    if (T && T.trace && globalThis.BBTR_ACTIVE) {
      try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY TRACE dust freeze " + (on ? "on " : "failed on ") + e.UniqueId + " for " + (cs / 100) + " s\n") } catch (x) {}
    }
    return true;
  } catch (x) { say("frzx", "Freeze EXC " + x); return false }
};

/* rrbSpBack (buff rrb_sp_back starts on her: Petal Dance used right after Petal Burst, hidden effect 24): SP back
   (gauge slot 3), so the move costs less. The row has already taken the full cost. */
buffFuncs.rrbSpBack = (e, t, a, r) => {
  try {
    if (!e || !e.Attr) return true;
    var sp = 20; try { sp = a.GetI("sp") || 20 } catch (x) {}
    e.Attr.ChangeMPBy(Util_1.U.StringToFp(String(sp)), 3);
    return true;
  } catch (x) { return false }
};

/* rrbFrozenEnd (buff rrb_frz_tag ends: the Freeze's time is up, or a hit broke it): the tag goes */
buffFuncs.rrbFrozenEnd = (e, t, a, r) => {
  try { if (e && e.TagMgr) e.TagMgr.RemoveTag("rrb_frozen") } catch (x) {}
  return true;
};

/* rrbLiftOn / rrbLiftOff (buff rrb_a4_lift on an enemy 5AAAA launched while 20703 + Semblance are held, hidden effect
   39): the actor tag rrb_a4_lift while the buff lasts. The rose gust's hits (rrbb1 rrb_gust_a4) exclude it, so they never
   touch the launch to her jump height; the gust's pull (a sideways ForceField) still holds it in front of her. */
buffFuncs.rrbLiftOn = (e, t, a, r) => {
  try { if (e && e.TagMgr && !e.TagMgr.HasTag("rrb_a4_lift")) e.TagMgr.AppendTag("rrb_a4_lift") } catch (x) {}
  return true;
};
buffFuncs.rrbLiftOff = (e, t, a, r) => {
  try { if (e && e.TagMgr) e.TagMgr.RemoveTag("rrb_a4_lift") } catch (x) {}
  return true;
};

/* rrbStagOn / rrbStagOff (buff rrb_stag on an enemy a rifle round made flinch, 0.9.0): the actor tag rrb_stag while
   the buff lasts, and rrb_nostag the rest of the time. A rifle round's flinching hit skips rrb_stag and its
   damage-only twin skips rrb_nostag, so exactly one of them can land on an enemy: it flinches from her rifle at
   most once per RRB_POWER.rifleStagger seconds, whichever of the two hits the game looks at first. */
buffFuncs.rrbStagOn = (e, t, a, r) => {
  try {
    var g = e && e.TagMgr;
    if (g) { if (!g.HasTag("rrb_stag")) g.AppendTag("rrb_stag"); if (g.HasTag("rrb_nostag")) g.RemoveTag("rrb_nostag") }
  } catch (x) {}
  return true;
};
buffFuncs.rrbStagOff = (e, t, a, r) => {
  try {
    var g = e && e.TagMgr;
    if (g) { if (g.HasTag("rrb_stag")) g.RemoveTag("rrb_stag"); if (!g.HasTag("rrb_nostag")) g.AppendTag("rrb_nostag") }
  } catch (x) {}
  return true;
};

/* rrbStagScan (buff rrb_stagscan on her as a move that fires rifle or Sy-Pod rounds starts; rrbStage calls it too):
   every live enemy gets rrb_nostag, or rrb_stag while it carries the rrb_stag buff (a tag whose buff went another
   way is put right here). An enemy spawned since the last scan has neither tag until the next one. */
buffFuncs.rrbStagScan = (e, t, a, r) => {
  var n = 0;
  try {
    var L = csharp_1.GamePlay.BattleBase.Cur.PlayerObjMgr.ActorList, fa = e.Faction;
    for (var i = 0; i < L.Count; i++) {
      try {
        var o = L.get_Item(i);
        if (!o || o === e || o.IsDead || !o.BuffMgr || !o.TagMgr || o.Faction === fa) continue;
        var g = o.TagMgr;
        if (o.BuffMgr.Find("rrb_stag")) { if (!g.HasTag("rrb_stag")) g.AppendTag("rrb_stag"); if (g.HasTag("rrb_nostag")) g.RemoveTag("rrb_nostag") }
        else { if (g.HasTag("rrb_stag")) g.RemoveTag("rrb_stag"); if (!g.HasTag("rrb_nostag")) { g.AppendTag("rrb_nostag"); n++ } }
      } catch (x) {}
    }
  } catch (x) {}
  if (n && globalThis.BBTR && globalThis.BBTR.trace && globalThis.BBTR_ACTIVE) {
    try { csharp_1.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY TRACE dust stag free +" + n + "\n") } catch (x) {}
  }
  return true;
};

/* rrbSilverHit (buff rrb_silver, on her while she holds Silver Eyes, 20729: "Deals more damage to bosses, Elites and
   Staggered enemies"). Bosses and Elites take the stock +30 % (73091; both carry the Boss tag). Here: +30 % of the hit
   (Physical total, as ActorDirectDamage, not a hit) against a Staggered enemy that is not one: the states Red Reaper
   reads (stun 2100 family, entangle 2105, freeze 2101, the boss weak window) and her Breaking Clash mark (rrb_break). */
buffFuncs.rrbSilverHit = (e, t, a, r) => {
  var S = globalThis.RRB_DUST || (globalThis.RRB_DUST = { bolt: new Map(), said: {} }), U = Util_1.U;
  function say(k, m) {
    if (S.said[k]) return; S.said[k] = 1;
    try { csharp_1.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY SILVER " + m + "\n") } catch (x) {}
  }
  try {
    var v = r && r.Target && r.Target.BuffMgr ? r.Target : null;
    if (!v || !e) return false;
    var g = v.TagMgr; if (g && (g.HasTag("boss") || g.HasTag("Boss") || g.HasTag("EliteBoss") || g.HasTag("FinalBoss"))) return true;
    var ids = ["2100", "2100_weak", "2100_su", "2100_event", "2105", "2101", "weak_boss", "rrb_break"], st = "";
    for (var i = 0; i < ids.length && !st; i++) { try { if (v.BuffMgr.Find(ids[i])) st = ids[i] } catch (x) {} }
    if (!st) return true;
    var hit = 0; try { hit = U.FpToFloat(r.DamageDetail.PhsycalDamageTotal) } catch (x) {}
    if (!(hit > 0)) return true;
    csharp_1.GamePlay.BattleUtils.ActorDirectDamage(e, v, U.FloatToFp(hit * 0.3), 0);
    say("hit", "+30 % against a Staggered enemy (" + st + ")");
    return true;
  } catch (x) { say("exc", "EXC " + x); return false }
};

/* rrbGust (buff rrb_gust, repeating every 0.05 s during Petal Burst's rose gust): every enemy on screen is carried
   along her dash -- toward her, since she has passed through them -- at the buff's strength (u/s); bosses and immovable
   enemies are held by their own rules. */
buffFuncs.rrbGust = (e, t, a, r) => {
  var U = Util_1.U;
  try {
    var sp = U.FpToFloat(t.Strength) || 9, L = csharp_1.GamePlay.BattleBase.Cur.PlayerObjMgr.ActorList, fa = e.Faction, ex = e.Position.x;
    for (var i = 0; i < L.Count; i++) {
      var v = L.get_Item(i);
      try {
        if (!v || v.Faction === fa || v.IsDead || !v.BuffMgr) continue;
        var g = v.TagMgr; if (g && (g.HasTag("boss") || g.HasTag("Boss") || g.HasTag("EliteBoss") || g.HasTag("FinalBoss"))) continue;
        var at = v.Attr; if (at.GetResistance(1) || at.GetResistance(5)) continue;
        var dx = ex - v.Position.x; if (Math.abs(dx) < 1.2) continue;
        v.ActorPosition.AddMove(U.Vector2ToFp2(new csharp_1.UnityEngine.Vector2((dx > 0 ? 1 : -1) * sp * 0.05, 0)));   // collision-aware, per 0.05 s tick
      } catch (x) {}
    }
    return true;
  } catch (x) { return false }
};

/* Holds (rrb_power.hold_moves; the lead, 2026-10-02: "GUILLOTINE needs to lock the enemy in place", and Red Reaper's
   first target "locked into a certain position so it looks like all the hits are hitting it, just like in bbtag").
   rrbHoldCheck (on the held enemy: rrb_guil_hold at its start and every 0.05 s, rrb_rr_hold every 0.05 s): the hold ends
   at once when the one holding (its caster: her) is dead or no longer in the move that holds (param pre, an action-name
   prefix: a cancel, being knocked out of it, the move's end), and never stays on a true boss (Boss but not Elite:
   MonsterConfig gives Elites Tag=Boss,...,Elite) or on an object (Stuff / Trap). It ends the buff the way stock buff
   scripts end their own (TimeEllapsed = Duration - 0.01, buffFuncs.behit_51061), not by removing it inside its update. */
buffFuncs.rrbHoldCheck = (e, t, a, r) => {
  var U = Util_1.U;
  try {
    var c = null; try { c = t.RootCaster || t.Caster } catch (x) {}
    if (!c) return true;                                   // no caster known: the hold's own time ends it
    var pre = "rrb_"; try { pre = String(a.Get("pre") || pre) } catch (x) {}
    var not = ""; try { not = String(a.Get("not") || "") } catch (x) {}       // (Reaper's Hook: not the back throw)
    var act = ""; try { act = c.IsDead ? "" : String(c.ActionMgr.CurrentActionName || "") } catch (x) { return true }
    var skip = false;
    try { var g = e.TagMgr; skip = !!g && (((g.HasTag("Boss") || g.HasTag("boss") || g.HasTag("FinalBoss")) && !g.HasTag("Elite")) || g.HasTag("Stuff") || g.HasTag("Trap")) } catch (x) {}
    if (skip || act.indexOf(pre) !== 0 || (not && act.indexOf(not) === 0)) t.TimeEllapsed = U.FloatToFp(Math.max(0, U.FpToFloat(t.Duration) - 0.01));
    return true;
  } catch (x) { return false }
};

/* Red Reaper's one target. rrb_rr_hook is on her for the move (it ends when her action changes); its start forgets the
   last pick (rrbRrReset). rrbRrHit (PostHit, every hit she lands meanwhile): the first enemy hit stays the only one.
   Unless it is a true boss or immovable (FixPosition resistance), it gets rrb_rr_hold from her (stunned, held where the
   dive kick found it, its hit pose frozen: Cross Tag's Astral Heat keeps the opponent in 9999 hitstun with no pushback)
   until `rel` s into the move, just before the final slash, which also removes it and knocks it away. */
buffFuncs.rrbRrReset = (e, t, a, r) => {
  var S = globalThis.RRB_HOLD || (globalThis.RRB_HOLD = { rr: new Map(), said: {} });
  try { S.rr.delete(e.UniqueId) } catch (x) {}
  return true;
};
buffFuncs.rrbRrHit = (e, t, a, r) => {
  var S = globalThis.RRB_HOLD || (globalThis.RRB_HOLD = { rr: new Map(), said: {} }), U = Util_1.U, CS = csharp_1;
  function say(k, m) {
    if (S.said[k]) return; S.said[k] = 1;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY HOLD " + m + "\n") } catch (x) {}
  }
  function trace(m) {
    if (!globalThis.BBTR || !globalThis.BBTR.trace || !globalThis.BBTR_ACTIVE) return;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY TRACE hold " + m + "\n") } catch (x) {}
  }
  try {
    var v = r && r.Target && r.Target.BuffMgr ? r.Target : null;
    if (!v || !e || v.IsDead) return true;
    try { if (U.FpToFloat(v.Attr.HP) <= 0) return true } catch (x) {}
    var act = ""; try { act = String(e.ActionMgr.CurrentActionName || "") } catch (x) {}
    if (act.indexOf("rrb_redreaper") !== 0 || S.rr.has(e.UniqueId)) return true;     // one target per Red Reaper
    var g = null; try { g = v.TagMgr } catch (x) {}
    try { if (g && (g.HasTag("Stuff") || g.HasTag("Trap"))) return true } catch (x) {}   // an object is never the one
    S.rr.set(e.UniqueId, v.UniqueId); if (S.rr.size > 64) S.rr.clear();
    var boss = false; try { boss = !!g && (g.HasTag("Boss") || g.HasTag("boss") || g.HasTag("FinalBoss")) && !g.HasTag("Elite") } catch (x) {}
    var fixed = false; try { fixed = !!v.Attr.GetResistance(5) } catch (x) {}
    if (boss || fixed) { say("skip", "Red Reaper: its target " + (boss ? "is a boss" : "resists position changes") + ", not pinned"); trace("rr skip " + v.UniqueId); return true }
    var at = -1; try { at = U.FpToFloat(e.ActionMgr.Time) } catch (x) {}
    var rel = 4.7, t0 = 1.25; try { rel = a.GetF("rel", 4.7) || rel; t0 = a.GetF("t0", 1.25) || t0 } catch (x) {}
    if (!(at >= 0 && at < rel)) at = t0;          // ActionMgr.Time read as her time in the move; anything else: the dive's
    var dur = rel - at; if (!(dur > 0.05)) return true;
    v.BuffMgr.AddBuff("rrb_rr_hold", U.FloatToFp(dur), U.FloatToFp(1), 1, e);
    var on = false; try { on = !!v.BuffMgr.Find("rrb_rr_hold") } catch (x) {}
    say(on ? "pin" : "nopin", on ? "Red Reaper: its first target is pinned" : "Red Reaper: the pin did not take on its target");
    trace("rr " + (on ? "pin " : "pin failed on ") + v.UniqueId + " at " + at.toFixed(2) + " s for " + dur.toFixed(2) + " s");
    return true;
  } catch (x) { say("exc", "rrbRrHit EXC " + x); return false }
};

/* Cinematic starts (rrb_power.cine_starts; the lead, 2026-10-09: in Cross Tag her Down + Skill, Guillotine, Petal Dance
   and Petal Burst change the camera and lock the enemies on screen in place). rrb_cine is on her from the move's third
   tick. rrbCineOn pushes the camera in `lv` zoom levels from the level it is at (found by its distance scale; a framing
   that is no level, or already the nearest, is left alone) and puts rrb_cine_hold on every enemy on screen for the
   buff's Strength in seconds (never a true boss or an object). rrbCineOff gives the camera back exactly as it was; so
   does rrbStage once she is back on her feet without the buff. */
buffFuncs.rrbCineOff = (e, t, a, r) => {
  var S = globalThis.RRB_CINE;
  if (!S || !S.keep) return true;
  try { var c = csharp_1.GamePlay.CameraDirector.Cur; if (c && c === S.dir) { c.SetZLevel(S.lv0); c.CurZLevel.Copy(S.keep) } } catch (x) {}
  S.keep = null; S.dir = null;
  return true;
};
buffFuncs.rrbCineOn = (e, t, a, r) => {
  var S = globalThis.RRB_CINE || (globalThis.RRB_CINE = { keep: null, dir: null, lv0: 0, said: {} }), U = Util_1.U, CS = csharp_1;
  function say(k, m) {
    if (S.said[k]) return; S.said[k] = 1;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY CINE " + m + "\n") } catch (x) {}
  }
  function trace(m) {
    if (!globalThis.BBTR || !globalThis.BBTR.trace || !globalThis.BBTR_ACTIVE) return;
    try { CS.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY TRACE cine " + m + "\n") } catch (x) {}
  }
  try {
    var c = CS.GamePlay.CameraDirector.Cur;
    if (S.keep && S.dir !== c) { S.keep = null; S.dir = null }          // (another scene's camera: nothing of ours is on it)
    if (c && !S.keep) {
      var keep = new CS.GamePlay.CameraZLevelParam(); keep.Copy(c.CurZLevel);
      var max = c.MaxZLevel, lv0 = -1, push = 4; try { push = a.GetF("lv", 4) || push } catch (x) {}
      for (var i = 0; i <= max && lv0 < 0; i++) { c.SetZLevel(i); if (Math.abs(c.CurZLevel.ZScale - keep.ZScale) < 1e-4) lv0 = i }
      if (lv0 < 0 || lv0 >= max) {
        if (lv0 >= 0) c.SetZLevel(lv0);
        c.CurZLevel.Copy(keep); say("lv", "camera left alone (" + (lv0 < 0 ? "its framing is no zoom level" : "already nearest") + ")");
      } else {
        c.SetZLevel(Math.min(max, lv0 + push));
        try { c.CurZLevel.SmoothDampTime = new CS.UnityEngine.Vector3(0.004, 0.004, 0.004) } catch (x) { say("damp", "damp EXC " + x) }
        S.keep = keep; S.dir = c; S.lv0 = lv0;
        say("in", "camera in from level " + lv0 + " to " + Math.min(max, lv0 + push));
        trace("in " + lv0 + " -> " + Math.min(max, lv0 + push));
      }
    }
  } catch (x) { say("cam", "camera EXC " + x) }
  try {
    var lock = U.FpToFloat(t.Strength) || 0;
    if (!(lock > 0.02)) return true;
    var L = CS.GamePlay.BattleBase.Cur.PlayerObjMgr.ActorList, fa = e.Faction, ex = e.Position.x, ey = e.Position.y, n = 0;
    for (var j = 0; j < L.Count; j++) {
      try {
        var v = L.get_Item(j);
        if (!v || v === e || v.Faction === fa || v.IsDead || !v.BuffMgr) continue;
        var g = v.TagMgr;
        if (g && (((g.HasTag("Boss") || g.HasTag("boss") || g.HasTag("FinalBoss")) && !g.HasTag("Elite")) || g.HasTag("Stuff") || g.HasTag("Trap"))) continue;
        if (Math.abs(v.Position.x - ex) > 13 || Math.abs(v.Position.y - ey) > 6.5) continue;
        v.BuffMgr.AddBuff("rrb_cine_hold", U.FloatToFp(lock), U.FloatToFp(1), 1, e); n++;
      } catch (x) {}
    }
    trace("lock " + n + " for " + lock.toFixed(2) + " s");
    return true;
  } catch (x) { say("lock", "lock EXC " + x); return false }
};

/* A slash projectile passes through walls and ledges (rrb_power.wave_boxes, 0.9.0): rrb_ghost is on the projectile for
   its flight, and while it lasts the scenery masks its movement collides with are empty. rrbGhostOff puts them back. */
buffFuncs.rrbGhostOn = (e, t, a, r) => {
  var G = globalThis.RRB_GHOST || (globalThis.RRB_GHOST = { keep: {}, said: {} });
  try {
    var p = e.ActorPosition, m1 = p.SceneSolidLayerMask, m2 = p.SceneSolidAndPassableLayerMask;
    if (!(e.UniqueId in G.keep)) G.keep[e.UniqueId] = [m1.Value, m2.Value];
    m1.Value = 0; m2.Value = 0;
    p.SceneSolidLayerMask = m1; p.SceneSolidAndPassableLayerMask = m2;
    if (!G.said.on) { G.said.on = 1; csharp_1.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY GHOST masks " + G.keep[e.UniqueId].join("/") + " -> " + p.SceneSolidLayerMask.Value + "/" + p.SceneSolidAndPassableLayerMask.Value + "\n") }
  } catch (x) {
    if (!G.said.exc) { G.said.exc = 1; try { csharp_1.System.IO.File.AppendAllText("@ROOT@/modlog.txt", (new Date()).toISOString() + " RUBY GHOST EXC " + x + "\n") } catch (y) {} }
  }
  return true;
};
buffFuncs.rrbGhostOff = (e, t, a, r) => {
  var G = globalThis.RRB_GHOST, k = G && G.keep[e.UniqueId];
  if (!k) return true;
  try {
    var p = e.ActorPosition, m1 = p.SceneSolidLayerMask, m2 = p.SceneSolidAndPassableLayerMask;
    m1.Value = k[0]; m2.Value = k[1];
    p.SceneSolidLayerMask = m1; p.SceneSolidAndPassableLayerMask = m2;
  } catch (x) {}
  delete G.keep[e.UniqueId];
  return true;
};
