/* dr-party: Kris's Potentials at runtime, the MOVE group: F1 Triple Jump, F2 Air Reset, G1 Triple Dash, G2 Party Dash,
   G3 Full Speed, and the hidden pairs HP6 (G2 + A1) and HP7 (G2 + E2).
   F1, F2, G1 and HP6 are action data and table rows (kp_move.py): nothing here touches them. The Party Dash itself is
   action data too (the hold entry, the run that restarts itself, the jump, the wall switch, the projectile scan, the
   crash wave). What the script adds while Kris plays a kris_pdash action:
     - mods.follow: Susie and Ralsei close up behind Kris (js/command.js reads it for the followers' history step);
     - the WALL FALLBACK (PLAN.md W8): running but not moving for 0.10 s of battle time is a wall, and the script changes
       Kris to the bonk itself. The action data's own wall switch (CollisionSwitchList) is the first route; whichever
       comes first wins. Hit-stop is not a wall: nothing is judged for 0.15 s after one of the run's own hits;
     - HP7: every enemy the run knocks aside cuts both recharges (api.cut: the minimum cycle applies);
     - G3: a boss in the way is a crash: the script changes Kris to the bonk (whose action data releases the wave), gives
       the boss Push Buster's knock-back offset for the wave when it carries the stock "can't be knocked back" buff, and
       slides it a little if the wave still did not move it (only in a hit reaction, never an opted-out enemy: the Rude
       Buster group's own rule and values, __bbDRPotsCFG.rb.push);
     - one enemy counts once per pass: by the hit report (trigger 208901), or, while the trigger has reported no hit of
       Kris's own in this battle (PLAN.md R1), by reach;
     - the log the in-game scenarios read (tests/pots_move.py):
         POTS pdash start kris_pdash_loop at 12.40,0.00
         POTS pdash hit 350501#12 #1
         POTS crash wall wave at 31.20,0.00 after 1.42 s           (wall | boss; "wave" with Full Speed)
         POTS pdash end release after 2.05 s, 28.6 u, 3 hits; followers 1.4 / 2.3 u behind     (release | time | crash | into <action>)
   Test lines (drparty_test.txt; dev only):
     ptest move            the figures so far
     ptest move trig       does Kris hold the game's own Triple Jump / Triple Dash triggers (what F1 and G1 add)
     ptest move bonk       change Kris to the bonk now (to look at it, and at the wave with G3)
     ptest move reset
   Appended after js/potentials.js (kris_potentials.js_files); registers with its group registry.
   The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  P.potsGroups = P.potsGroups || [];
  for (var g0 = 0; g0 < P.potsGroups.length; g0++) if (P.potsGroups[g0] && P.potsGroups[g0].name === "move") return;
  var CFG = (G.__bbDRPotsCFG || {}).move || {};          // the build's values (kp_move.content)
  var RUNS = ["kris_pdash*"], LOOPS = ["kris_pdash_loop*"];
  var END = CFG.end || "kris_pdash_end", BONK = CFG.bonk || "kris_pdash_bonk";
  var WALL = CFG.wall || { js: true, stall: 0.10, speed: 2.0 };
  var BOSS = CFG.boss || { cd: 3.0, hold: 0.8, check: 0.45, min: 0.5, slide: 1.0, over: 0.15 };
  var ONCE = CFG.once || 0.6, CUT = CFG.cut || 0.3, QUIET = 0.15;
  var BOX = CFG.box || [-0.2, 0, 1.4, 1.6];
  var TRIG = CFG.triggers || { F1: 11741, G1: 11801 };
  var FOLLOW0 = { dist: { susie: 2, ralsei: 4 }, act: "dash" };
  var RELEASE = CFG.release > 0 ? CFG.release : 0.06;     // Dash let go for this long ends the run (battle seconds)
  var S = { run: null, runs: 0, hits: 0, cuts: 0, crashes: 0, last: "", touched: {}, slides: [], prev: "", said: {} };
  P.potsMove = S;

  function once(api, key, s) { if (!S.said[key]) { S.said[key] = 1; api.log(s) } }
  function followOf(r) { var f = CFG.follow && CFG.follow[r.loop]; return f || FOLLOW0 }
  function maxOf(r) { var m = CFG.max && CFG.max[r.loop]; return m > 0 ? m : 2.5 }
  function setFollow(api, f) { var m = api.mods(); if (m) m.follow = f }
  function behind(p) {                                      // how far behind Kris each companion is (u), or "?"
    var out = [], F = P.followers || {}, names = ["susie", "ralsei"], px = 0;
    try { px = p.Position.x } catch (e) {}
    for (var i = 0; i < names.length; i++) {
      var f = F[names[i]], d = f && typeof f.x === "number" && isFinite(f.x) ? Math.abs(f.x - px) : null;
      out.push(d === null ? "?" : d.toFixed(1));
    }
    return out.join(" / ");
  }
  function bonk(p, api, why) {
    try { p.ActionMgr.ChangeAction(BONK); api.log("pdash bonk by the script: " + why); return true }
    catch (e) { once(api, "bonk", "pdash bonk refused: " + e); return false }
  }
  function bossKnock(p, a, api) {                           // the wave should move a boss: Push Buster's offset, its opt-outs
    var push = ((G.__bbDRPotsCFG || {}).rb || {}).push;
    if (!push || !push.buff) { once(api, "nopush", "pdash boss: no knock-back offset in this build (the Rude Buster group's)"); return }
    var skip = (push.skipTag && api.hasTag(a, push.skipTag)), ids = push.skipIds || [], hard = push.hard || [], i, carries = false;
    for (i = 0; i < ids.length; i++) if (String(ids[i]) === String(a.BaseID)) skip = true;
    if (skip) { api.log("pdash boss " + api.tag(a) + " has opted out of being pushed"); return }
    for (i = 0; i < hard.length; i++) if (api.hasBuff(a, hard[i])) carries = true;
    if (carries) api.addBuff(a, push.buff, BOSS.hold, push.k === undefined ? 0.4 : push.k, 1, p);
    var x0 = api.pos(a).x, dir = p.Dir >= 0 ? 1 : -1, rx = null;
    try { if (push.reactRx) rx = new RegExp(push.reactRx) } catch (e) {}
    api.after(BOSS.check, function () {
      if (!api.alive(a)) return;
      var moved = (api.pos(a).x - x0) * dir, act = api.actionOf(a), slide = moved < BOSS.min && (!rx || rx.test(act));
      api.log("pdash boss " + api.tag(a) + " moved " + moved.toFixed(2) + " u" + (carries ? " (offset " + push.buff + ")" : "") +
              (slide ? ": slid on to " + BOSS.slide.toFixed(1) + " u" : ""));
      if (slide) S.slides.push({ a: a, left: BOSS.slide - Math.max(0, moved), dir: dir, per: BOSS.slide / BOSS.over });
    });
  }
  // one enemy, once per pass: the hit report, or reach while nothing reports
  function touch(p, a, api, how) {
    var r = S.run, uid = api.tag(a), t = api.now();
    if (S.touched[uid] !== undefined && t - S.touched[uid] < ONCE - 0.05) return false;
    S.touched[uid] = t; S.hits++;
    if (r) { r.hits++; r.quiet = QUIET }
    if (api.verbose()) api.log("pdash hit " + uid + " #" + (r ? r.hits : S.hits) + (how === "near" ? " (no hit report yet: by reach)" : ""));
    if (api.has("G2") && api.has("E2")) { api.cut("both", CUT, "party dash"); S.cuts++ }
    if (r && !r.crashed && api.has("G3") && api.isBoss(a) && api.matches(LOOPS, api.actionOf(p)) && api.cd("move.boss." + uid, BOSS.cd)) {
      r.boss = true; bossKnock(p, a, api); bonk(p, api, "a boss in the way");
    }
    return true;
  }
  function begin(p, act, api) {
    var q = api.pos(p);
    var r = { t: 0, x: q.x, x0: q.x, dist: 0, hits: 0, still: 0, quiet: 0, loop: api.matches(LOOPS, act) ? act : (CFG.loops ? CFG.loops[CFG.loops.length - 1] : ""),
              boss: false, crashed: false };
    S.run = r; S.runs++;
    api.log("pdash start " + act + " at " + q.x.toFixed(2) + "," + q.y.toFixed(2));
    return r;
  }
  function finish(p, api, why) {
    var r = S.run; S.run = null; setFollow(api, null);
    if (!r) return;
    S.last = why + " after " + r.t.toFixed(2) + " s, " + r.dist.toFixed(1) + " u, " + r.hits + (r.hits === 1 ? " hit" : " hits");
    api.log("pdash end " + S.last + "; followers " + behind(p) + " u behind");
  }
  function crashed(p, api, r) {
    var q = api.pos(p);
    S.crashes++; if (r) r.crashed = true;
    try {                                             // 0.5.0: DELTARUNE's own smack star and dash ripple where Kris hit the wall
      var fx = P.CFG && P.CFG.fx, dir = p.Dir >= 0 ? 1 : -1;
      if (fx && typeof P.launch === "function") {
        if (fx.smack) P.launch(fx.smack, q.x + dir * 0.5, q.y + 0.7, dir, 0, null);
        if (fx.ripple) P.launch(fx.ripple, q.x, q.y + 0.1, dir, 0, null);
      }
    } catch (e) {}
    api.log("crash " + (r && r.boss ? "boss" : "wall") + (api.has("G3") ? " wave" : "") + " at " + q.x.toFixed(2) + "," + q.y.toFixed(2) +
            (r ? " after " + r.t.toFixed(2) + " s" : " (no run)"));
  }
  function line() {
    return "move figures: " + S.runs + (S.runs === 1 ? " run" : " runs") + ", " + S.hits + " enemies knocked aside, " + S.cuts + " recharge cuts, " + S.crashes +
           (S.crashes === 1 ? " crash" : " crashes") + (S.last ? " (last run: " + S.last + ")" : "") + (S.run ? ", running now (" + S.run.t.toFixed(2) + " s)" : "");
  }

  P.potsGroups.push({
    name: "move", cards: ["F1", "F2", "G1", "G2", "G3"],
    mods: function (m, has, api) { if (S.run) m.follow = followOf(S.run) },      // a recompute in the middle of a run
    onHit: function (h, api) {
      if (!h.src || !h.src.pdash || !h.target) return;      // Kris's own body in a kris_pdash action
      if (h.enemy === false) return;                        // a pot or a trap in the way: no enemy knocked aside, no cut
      touch(h.p, h.target, api, "report");
    },
    tick: function (p, bdt, api) {
      var act = api.actionOf(p), running = api.matches(RUNS, act), r = S.run, i;
      if (act === BONK && S.prev !== BONK) crashed(p, api, r);
      S.prev = act;
      if (running && !r && act !== END && act !== BONK) r = begin(p, act, api);
      if (r) {
        r.t += bdt;
        if (!running) finish(p, api, "into " + (act || "?"));
        else if (act === BONK) finish(p, api, "crash");
        else if (act === END) finish(p, api, r.t >= maxOf(r) - 0.08 ? "time" : "release");
        else {
          var loop = api.matches(LOOPS, act), q = api.pos(p), dx = Math.abs(q.x - r.x);
          if (loop) r.loop = act;
          // 0.4.2: THE SCRIPT HOLDS THE RUN. In game the loop's own "Dash released" switch fired the moment the run began
          // (10 of 10 runs ended after 0.01-0.07 s on 2026-10-03: the lead, "party dash still isnt implented"), so the
          // loop has no such switch any more: the raw button ends the run here, and the time limit too (the data's
          // timer buff stays as its second guard). A jump, a fall and the landing play out; the run ends on the ground.
          var down = true; try { if (typeof P.held === "function") down = !!P.held("Dash") } catch (e) {}
          r.up = down ? 0 : (r.up || 0) + bdt;
          if (loop && !r.ending && (r.up >= RELEASE || r.t >= maxOf(r))) {
            r.ending = true;
            try { p.ActionMgr.ChangeAction(END) } catch (e) { once(api, "end", "pdash: the run cannot be ended by the script (" + e + ")") }
          }
          setFollow(api, followOf(r));
          r.dist += dx; r.x = q.x;
          r.quiet = Math.max(0, r.quiet - bdt);
          if (loop && WALL.js && bdt > 1e-4 && r.t > 0.12) {       // the wall fallback: running, yet not moving
            if (r.quiet > 0 || dx / bdt >= WALL.speed) r.still = 0;
            else {
              r.still += bdt;
              if (r.still >= WALL.stall) { r.still = 0; bonk(p, api, "no movement for " + WALL.stall.toFixed(2) + " s (the wall fallback)") }
            }
          }
          if (loop && api.reports().kris === 0) {                  // nothing reports Kris's hits yet: by reach
            var dir = p.Dir >= 0 ? 1 : -1, cx = q.x + dir * (BOX[0] + BOX[2]) / 2, cy = q.y + (BOX[1] + BOX[3]) / 2;
            var L = api.near(cx, cy, Math.max(BOX[2] - BOX[0], BOX[3] - BOX[1]) / 2);
            for (i = 0; i < L.length; i++) touch(p, L[i].a, api, "near");
          }
        }
      }
      for (i = S.slides.length - 1; i >= 0; i--) {                 // a boss the wave did not move
        var s = S.slides[i], step = Math.min(s.left, s.per * bdt);
        if (!api.alive(s.a) || step <= 0 && s.left <= 0) { S.slides.splice(i, 1); continue }
        api.move(s.a, s.dir * step, 0); s.left -= step;
        if (s.left <= 1e-4) S.slides.splice(i, 1);
      }
    },
    onStage: function (p, why, api) { S.run = null; S.touched = {}; S.slides = []; S.prev = ""; setFollow(api, null) },
    test: function (cmd, args, api) {
      if (cmd !== "ptest" || args[0] !== "move") return false;
      var sub = args[1], p = api.player();
      if (!sub) { api.log(line()); return true }
      if (sub === "reset") { S.runs = 0; S.hits = 0; S.cuts = 0; S.crashes = 0; S.last = ""; S.touched = {}; api.log("move figures reset"); return true }
      if (sub === "trig") {
        var out = [];
        for (var k in TRIG) {
          var v = "?";
          try { v = p.TriggerMgr.FindTrigger(TRIG[k]) ? 1 : 0 } catch (e) {}
          out.push(TRIG[k] + "=" + v + " (" + k + (api.has(k) ? ", card held" : "") + ")");
        }
        api.log("move triggers: " + out.join(" ")); return true;
      }
      if (sub === "bonk") { if (p) bonk(p, api, "a test line"); return true }
      api.log("move: ptest move [trig | bonk | reset]");
      return true;
    },
    state: function () { return line() }
  });
})(); } catch (e) {
  try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_move.js: " + e) } catch (e2) {}
}
