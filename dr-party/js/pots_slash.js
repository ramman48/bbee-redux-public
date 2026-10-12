/* dr-party: Kris's Potentials at runtime, the SLASH group: A1 Wide Slash, A2 Crescent, A3 Endless Slash, A4 Finisher,
   A5 Clash, B1 Wide Spin, B2 Bounce, B3 Diving Spin.
   All eight cards are action data (kp_slash.py): variants of Kris's swings, gated entries on them, and new actions
   (the crescents, the pogo, the dive, its wave, the clash spark). Nothing here changes the fight. The script MEASURES
   what the data promises, so the in-game checks (tests/pots_slash.py) and a person reading modlog.txt can see it:
     POTS slash reach kris_a1_w -> 350501#12 2.10 u           a sword hit: how far away the enemy stood (A1's reach)
     POTS slash launch 350501#12 +1.92 u after kris_a3_f      how high a third swing's victim rose within a second (A4)
     POTS slash spin kris_ja_w: 4 hits on 350501#12 (built for 4)   one air spin's hits on each enemy (B1)
     POTS slash crescent kris_crescent_1 -> 350501#12 5.02 u  a crescent's hit: how far from Kris the enemy stood (A2)
     POTS slash loop #2: kris_a3 -> kris_a1 after 0.19 s (dr_pt_loop on)   the third swing went on into the first (A3)
     POTS slash clash #1 at 3.10,1.20                         an enemy projectile became a clash spark (A5)
     POTS slash pogo #2: kris_ja -> kris_ja_pogo at y 2.31    a spin bounced; the count is per airtime (B2)
     POTS slash dive from kris_ja at y 3.02                   the dive began (B3)
     POTS slash dive hit -> 350501#12                         one of the dive's own hits
     POTS slash dive: fell 3.02 u in 0.13 s, 2 hits -> kris_dive_land
     POTS slash wave -> 350501#12                             the landing's shockwave hit
   The lines are written while the hit log is on (the internal build's default; `ptest hitlog 0` stops them).
   Enemies are only ever taken from api.enemies() (the command's filtered list: no objects, no traps).
   Test lines (drparty_test.txt; dev only):
     ptest slash                           the figures so far
     ptest slash pin <dx> <dy> [secs]      hold the enemies present now at that offset from where Kris stands now (default
                                           3 s): a target that stays in the air, for the spin's check
     ptest slash follow <dx> <dy> [secs]   hold them at that offset from where Kris IS, every frame: a target every spin
                                           of one airtime hits (the bounce's check), or that falls with the dive
     ptest slash unpin | ptest slash reset
   Appended after js/potentials.js (kris_potentials.js_files); registers with its group registry.
   The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis, CS = csharp_1;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  P.potsGroups = P.potsGroups || [];
  for (var g0 = 0; g0 < P.potsGroups.length; g0++) if (P.potsGroups[g0] && P.potsGroups[g0].name === "slash") return;
  var CFG = (G.__bbDRPotsCFG || {}).slash || {};          // the build's values (kp_slash.content): swings, variants, new actions
  var SWINGS = ["kris_a1*", "kris_a2*", "kris_a3*"], THIRD = ["kris_a3*"], FIRST = ["kris_a1*"], CRES = ["kris_crescent_*"];
  var SPINS = CFG.spins || ["kris_ja", "kris_ja_w"];      // exact names: kris_ja_land and kris_ja_pogo are no spins
  var INFO = CFG.swings || {};
  var LOOP = CFG.loop || {}, LOOPBUFF = LOOP.buff || "dr_pt_loop";
  var POGO = (CFG.pogo || {}).action || "kris_ja_pogo";
  var DV = CFG.dive || {}, DIVE = DV.action || "kris_dive", LAND = DV.land || "kris_dive_land", WAVE = DV.wave || "kris_dive_wave";
  var CLASH = (CFG.clash || {}).action || "kris_clash";
  var RISE_T = 1.0, SPIN_T = 0.45;                        // how long a launch is watched; one spin's longest hit window (s)
  var SCAN_T = 0.08;                                      // how often Kris's projectiles are listed for clash sparks (s)
  var S = { n: 0, far: 0, farAct: "", track: {}, launches: 0, best: 0, bestAct: "", spin: null, spins: 0, lastSpin: "", pin: null,
            act: "", thirdT: null, chain: 0, loops: 0, lastGap: 0, air: 0, pogos: 0, dive: null, dives: 0, lastDive: "",
            cres: 0, cresFar: 0, wave: 0, clash: 0, seen: [], scan: 0 };
  P.potsSlash = S;

  function talk() { var c = P.potsState; return !c || c.hitlog !== false }
  function say(api, s) { if (talk()) api.log("slash " + s) }
  function isSpin(name) { for (var i = 0; i < SPINS.length; i++) if (SPINS[i] === name) return true; return false }
  function grounded(p) { try { var off = p.ActorPosition.IsOffGround; if (typeof off === "boolean") return !off } catch (e) {} return null }
  function flushSpin(api) {
    var sp = S.spin; S.spin = null; if (!sp) return;
    var want = INFO[sp.act] && INFO[sp.act].hits, parts = [];
    for (var uid in sp.hits) parts.push(sp.hits[uid] + (sp.hits[uid] === 1 ? " hit on " : " hits on ") + sp.tags[uid]);
    S.spins++; S.lastSpin = sp.act + ": " + parts.join(", ");
    say(api, "spin " + S.lastSpin + (want ? " (built for " + want + ")" : ""));
  }
  function endLaunch(api, uid) {
    var t = S.track[uid]; delete S.track[uid]; if (!t) return;
    S.launches++; if (t.peak > S.best) { S.best = t.peak; S.bestAct = t.act }
    say(api, "launch " + t.tag + " +" + t.peak.toFixed(2) + " u after " + t.act);
  }
  function hold(api) {                                    // only the enemies that were there when the pin was set
    var L = S.pin.who, n = 0, x = S.pin.x, y = S.pin.y;
    if (S.pin.follow) { var me = api.pos(api.player()); x = me.x + S.pin.dx; y = me.y + S.pin.dy }
    for (var i = 0; i < L.length; i++) {
      try { if (!L[i].IsDead) { L[i].Position = new CS.UnityEngine.Vector2(x, y); n++ } } catch (e) {}
    }
    return n;
  }
  // Kris went from one action to another (the tick sees every change; a variant's switch at 0-0.05 s is one too)
  function onAction(p, from, to, api) {
    var t = api.now(), me = api.pos(p);
    if (api.matches(THIRD, to) && !api.matches(THIRD, from)) S.thirdT = t;         // a third swing begins
    if (api.matches(FIRST, to) && !api.matches(FIRST, from)) {
      if (api.matches(THIRD, from)) {                                               // A3: the third swing went on into the first
        var gap = S.thirdT === null ? 0 : t - S.thirdT, on = api.buffState(p, LOOPBUFF);
        S.chain++; S.loops++; S.lastGap = gap;
        say(api, "loop #" + S.chain + ": " + from + " -> " + to + " after " + gap.toFixed(2) + " s" +
                 (on === true ? " (" + LOOPBUFF + " on)" : on === false ? " (" + LOOPBUFF + " off)" : ""));
      } else S.chain = 0;                                                           // a new string
    }
    if (to === POGO && from !== POGO) {                                             // B2 (and the dive's bounce, a hidden pair)
      S.air++; S.pogos++;
      say(api, "pogo #" + S.air + ": " + from + " -> " + to + " at y " + me.y.toFixed(2));
    }
    if (to === DIVE && from !== DIVE) {                                             // B3
      S.dive = { y0: me.y, t0: t, hits: 0 };
      say(api, "dive from " + from + " at y " + me.y.toFixed(2));
    } else if (from === DIVE && to !== DIVE && S.dive) {
      var d = S.dive; S.dive = null; S.dives++;
      S.lastDive = "fell " + (d.y0 - me.y).toFixed(2) + " u in " + (t - d.t0).toFixed(2) + " s, " + d.hits + (d.hits === 1 ? " hit" : " hits") + " -> " + to;
      say(api, "dive: " + S.lastDive);
    }
  }
  function clashes(api) {                                 // A5: Kris's projectiles that are clash sparks (each counted once)
    var i;
    for (i = S.seen.length - 1; i >= 0; i--) if (!api.alive(S.seen[i]) || api.actionOf(S.seen[i]) !== CLASH) S.seen.splice(i, 1);
    var L = api.projectiles(); if (!L) return;
    for (i = 0; i < L.length; i++) {
      if (api.actionOf(L[i]) !== CLASH || S.seen.indexOf(L[i]) >= 0) continue;
      S.seen.push(L[i]); S.clash++;
      var q = api.pos(L[i]);
      say(api, "clash #" + S.clash + " at " + q.x.toFixed(2) + "," + q.y.toFixed(2));
    }
  }
  function line() {
    return "slash figures: " + S.n + " sword hits" + (S.n ? " (farthest " + S.far.toFixed(2) + " u, " + S.farAct + ")" : "") +
           ", launches watched " + S.launches + (S.launches ? " (best +" + S.best.toFixed(2) + " u, " + S.bestAct + ")" : "") +
           ", spins " + S.spins + (S.lastSpin ? " (last " + S.lastSpin + ")" : "") +
           ", crescent hits " + S.cres + (S.cres ? " (farthest " + S.cresFar.toFixed(2) + " u)" : "") +
           ", loops " + S.loops + (S.loops ? " (last after " + S.lastGap.toFixed(2) + " s)" : "") +
           ", clashes " + S.clash + ", pogos " + S.pogos + ", dives " + S.dives + (S.lastDive ? " (last " + S.lastDive + ")" : "") +
           ", wave hits " + S.wave + (S.pin ? ", enemies " + (S.pin.follow ? "following" : "held") + " for " + S.pin.left.toFixed(1) + " s more" : "");
  }

  P.potsGroups.push({
    name: "slash", cards: ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3"],
    onHit: function (h, api) {
      if (!h.target || h.enemy === false) return;          // (a pot or a trap: not measured)
      var act = h.action, q = api.pos(h.target), me = api.pos(h.p), uid = h.uid, d = Math.abs(q.x - me.x);
      if (!h.kris) {                                       // of the party's projectiles, only this group's own
        if (api.matches(CRES, act)) {
          S.cres++; if (d > S.cresFar) S.cresFar = d;
          say(api, "crescent " + act + " -> " + api.tag(h.target) + " " + d.toFixed(2) + " u");
        } else if (act === WAVE) {
          S.wave++; say(api, "wave -> " + api.tag(h.target));
        }
        return;
      }
      if (api.matches(SWINGS, act)) {
        S.n++; if (d > S.far) { S.far = d; S.farAct = act }
        say(api, "reach " + act + " -> " + api.tag(h.target) + " " + d.toFixed(2) + " u");
        if (api.matches(THIRD, act)) {
          if (S.track[uid]) endLaunch(api, uid);
          S.track[uid] = { a: h.target, tag: api.tag(h.target), y0: q.y, peak: 0, left: RISE_T, act: act };
        }
      } else if (isSpin(act)) {
        if (S.spin && (S.spin.act !== act || S.spin.age > SPIN_T)) flushSpin(api);
        if (!S.spin) S.spin = { act: act, age: 0, hits: {}, tags: {} };
        S.spin.hits[uid] = (S.spin.hits[uid] || 0) + 1; S.spin.tags[uid] = api.tag(h.target);
      } else if (act === DIVE) {
        if (S.dive) S.dive.hits++;
        say(api, "dive hit -> " + api.tag(h.target));
      }
    },
    tick: function (p, bdt, api) {
      var cur = api.actionOf(p);
      if (cur !== S.act) { var from = S.act; S.act = cur; if (from) onAction(p, from, cur, api) }
      if (grounded(p) === true && cur !== POGO) S.air = 0;
      for (var uid in S.track) {
        var t = S.track[uid], y = null;
        try { if (!t.a.IsDead) y = t.a.Position.y } catch (e) {}
        if (y !== null && y - t.y0 > t.peak) t.peak = y - t.y0;
        t.left -= bdt;
        if (t.left <= 0 || y === null) endLaunch(api, uid);
      }
      if (S.spin) {
        S.spin.age += bdt;
        if (S.spin.age > SPIN_T || !isSpin(cur)) flushSpin(api);
      }
      if (talk() && (api.has("A5") || S.seen.length)) {     // (a spark lasts 0.3 s: a look every 0.08 s misses none)
        S.scan -= bdt;
        if (S.scan <= 0) { S.scan = SCAN_T; clashes(api) }
      }
      if (S.pin) {
        S.pin.left -= bdt;
        if (S.pin.left <= 0) { S.pin = null; api.log("slash pin released") } else hold(api);
      }
    },
    onStage: function (p, why, api) { S.track = {}; S.spin = null; S.pin = null; S.dive = null; S.thirdT = null; S.chain = 0; S.air = 0; S.seen = [] },
    test: function (cmd, args, api) {
      if (cmd !== "ptest" || args[0] !== "slash") return false;
      var sub = args[1], p = api.player();
      if (!sub) { api.log(line()); return true }
      if (sub === "reset") {
        S.n = 0; S.far = 0; S.farAct = ""; S.launches = 0; S.best = 0; S.bestAct = ""; S.spins = 0; S.lastSpin = "";
        S.cres = 0; S.cresFar = 0; S.loops = 0; S.lastGap = 0; S.clash = 0; S.pogos = 0; S.dives = 0; S.lastDive = ""; S.wave = 0;
        api.log("slash figures reset"); return true;
      }
      if (sub === "unpin") { S.pin = null; api.log("slash pin released"); return true }
      if (sub === "pin" || sub === "follow") {
        var dx = parseFloat(args[2]), dy = parseFloat(args[3]), secs = parseFloat(args[4]);
        if (isNaN(dx) || !p) { api.log("slash " + sub + ": ptest slash " + sub + " <dx> <dy> [secs]"); return true }
        var me = api.pos(p);
        if (isNaN(dy)) dy = 0;
        S.pin = { x: me.x + dx, y: me.y + dy, dx: dx, dy: dy, follow: sub === "follow", left: secs > 0 ? secs : 3, who: api.enemies() };
        api.log("slash " + sub + ": " + hold(api) + " enemies " + (S.pin.follow ? "kept " + dx.toFixed(2) + "," + dy.toFixed(2) + " from Kris" :
                "held at " + S.pin.x.toFixed(2) + "," + S.pin.y.toFixed(2)) + " for " + S.pin.left.toFixed(1) + " s");
        return true;
      }
      api.log("slash: ptest slash [pin <dx> <dy> [secs] | follow <dx> <dy> [secs] | unpin | reset]");
      return true;
    },
    state: function () { return line() }
  });
})(); } catch (e) {
  try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_slash.js: " + e) } catch (e2) {}
}
