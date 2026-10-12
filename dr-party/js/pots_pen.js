/* dr-party: Kris's Potentials at runtime, PEN OF HOPE (E5) and its steps up (E6 Quick Thinking, E7 In Sync): the
   party's auto mode (kp_pen.py).
   While Kris holds E5, a press of Summon switches Auto on or off. The switch then rests for CFG.cooldown (the lead: "a
   cool down of 2 seconds"), and "the entire fun gang stops whereever they are and do their iconic fun gang pose
   taunts" (js/command.js P.pose). On Auto, Susie and Ralsei each act when they are ready: on the nearest boss on screen
   (the lead: "priority with the main boss ... even if the regular enemy is closer"), else on the enemy Kris last hit
   while it lives, else on the nearest enemy on screen. The shot goes through the command's own fire
   (__bbDR.party.fire), so the other cards' changes to their moves apply and the recharge bars show.
   Auto's two penalties (the lead after 0.4.0: "auto is too op"; "a 40 percent or 50 percent damage penality and it
   should have increased cool down"):
     - an auto shot's recharge is the commanded one x the highest held card's factor (E5 3, E6 2, E7 1.5); switching
       Auto off cuts a recharge still running down to the commanded one;
     - while Auto is on the script holds the marker buff CFG.buff on Kris: the projectiles' hits read it and deal
       CFG.penalty less (kp_pen._auto_cut; data, not this script).
   Commanding by hand still works and has priority while the target-mode screen is open (no switching while it is).
   js/command.js shows "AUTO" over the companions while __bbDR.party.auto is set.
     POTS pen of hope: auto ON / OFF                      the switch
     POTS pen of hope: switch resting (1.20 s left)       a press during the cooldown
     POTS pen of hope: susie -> 350501#12 (every 9.0 s)   an auto shot and the recharge it starts
   Test lines (drparty_test.txt; dev only): ptest pen on | off | ready | state ; the command's own "summon 1|0" presses
   Summon. The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  P.potsGroups = P.potsGroups || [];
  for (var g0 = 0; g0 < P.potsGroups.length; g0++) if (P.potsGroups[g0] && P.potsGroups[g0].name === "pen") return;
  var CFG = (G.__bbDRPotsCFG || {}).pen || {};
  var GAP = CFG.gap > 0 ? CFG.gap : 0.35, COOL = CFG.cooldown > 0 ? CFG.cooldown : 2.0, POSE = CFG.pose > 0 ? CFG.pose : 0.8;
  var TIERS = CFG.tiers && CFG.tiers.length ? CFG.tiers : [["E5", 3], ["E6", 2], ["E7", 1.5]];   // the last one held wins
  var BUFF = CFG.buff || "dr_pt_auto";
  var S = { on: false, prev: true, last: null, gap: 0, fired: 0, cool: 0, mul: TIERS[0][1], buffT: 0, buffed: false };
  P.potsPen = S;

  function alive(a) { try { return !!a && !a.IsDead } catch (e) { return false } }
  function seen(a) { try { return typeof P.onScreen === "function" ? !!P.onScreen(a) : true } catch (e) { return true } }
  function boss(a) { try { return typeof P.isBoss === "function" && !!P.isBoss(a) } catch (e) { return false } }
  function mul(api) { var m = TIERS[0][1]; for (var i = 0; i < TIERS.length; i++) if (api.has(TIERS[i][0])) m = TIERS[i][1]; return m }
  function pick(p, api) {                             // the nearest boss; else the enemy Kris last hit; else the nearest
    var L = api.enemies(), best = null, bd = 1e9, bs = null, bb = 1e9, px = p.Position.x, py = p.Position.y;
    for (var i = 0; i < L.length; i++) {
      var a = L[i]; if (!alive(a) || !seen(a)) continue;
      var d = Math.abs(a.Position.x - px) + Math.abs(a.Position.y - py) * 0.5;
      if (d < bd) { bd = d; best = a }
      if (d < bb && boss(a)) { bb = d; bs = a }
    }
    if (bs) return bs;
    if (!alive(S.last)) S.last = null;
    if (S.last && L.indexOf(S.last) >= 0 && seen(S.last)) return S.last;
    return best;
  }
  function marker(p, on, api) {                       // the buff the projectiles' hits read (the damage penalty)
    try {
      if (on) S.buffed = !!api.addBuff(p, BUFF, 9999, 1, 1, p);
      else { api.removeBuff(p, BUFF); S.buffed = false }
    } catch (e) {}
  }
  function capWaits() {                               // Auto off: no recharge longer than the commanded one is left running
    try {
      var st = P.state, ws = ["susie", "ralsei"];
      for (var i = 0; i < ws.length; i++) {
        var w = ws[i], base = (P.mods && P.mods.recharge && P.mods.recharge[w] > 0) ? P.mods.recharge[w] : P.CFG.recharge[w];
        if (base > 0 && st.wait[w] > base) { st.wait[w] = base; st.full[w] = base }
      }
    } catch (e) {}
  }
  function set(on, api, why, quiet) {
    if (S.on === on) return;
    S.on = on; S.cool = COOL; S.gap = quiet ? 0 : POSE + 0.1;      // no auto shot while the party poses
    api.log("pen of hope: auto " + (on ? "ON" : "OFF") + (why ? " (" + why + ")" : ""));
    var p = null; try { p = api.player() } catch (e) {}
    if (p) marker(p, on, api);
    if (!on) capWaits();
    if (quiet) return;
    try { if (P.sfx) P.sfx(on ? "poseOn" : "poseOff") } catch (e) {}
    try { if (P.pose) P.pose() } catch (e) {}
  }

  P.potsGroups.push({
    name: "pen", cards: ["E5", "E6", "E7"],
    onHit: function (h, api) { if (h.kris && h.target) S.last = h.target },
    tick: function (p, bdt, api) {
      var has = api.has("E5"), down = false;
      try { down = !!(P.held && P.held("Summon")) } catch (e) {}
      S.cool = Math.max(0, S.cool - bdt);
      if (!has) { if (S.on) set(false, api, "the card is gone", true); P.auto = false; S.prev = down; return }
      var aiming = !!P.state && P.state.state === "aim";
      var dancing = false; try { dancing = typeof P.stickDown === "function" && P.stickDown() } catch (e) {}   // Down + Summon is the dance taunt
      if (down && !S.prev && !aiming && !dancing) {
        if (S.cool > 0) { api.log("pen of hope: switch resting (" + S.cool.toFixed(2) + " s left)"); try { if (P.sfx) P.sfx("fail") } catch (e) {} }
        else set(!S.on, api);
      }
      S.prev = down;
      P.auto = S.on;
      S.mul = mul(api);
      if (!S.on) return;
      S.buffT -= bdt;                                              // a new room may have cleared the marker: put it back
      if (S.buffT <= 0) { S.buffT = 1.0; if (api.buffState(p, BUFF) === false) marker(p, true, api) }
      if (typeof P.fire !== "function") return;
      S.gap = Math.max(0, S.gap - bdt);
      if (S.gap > 0) return;
      var who = api.ready("susie") ? "susie" : (api.ready("ralsei") ? "ralsei" : null);
      if (!who) return;
      var t = pick(p, api);
      if (t && P.fire(who, t, S.mul)) {
        S.fired++; S.gap = GAP;
        var secs = 0; try { secs = P.state.full[who] } catch (e) {}
        api.log("pen of hope: " + who + " -> " + api.tag(t) + " (every " + (secs > 0 ? secs.toFixed(1) : "?") + " s)");
      }
    },
    test: function (cmd, args, api) {
      if (cmd !== "ptest" || args[0] !== "pen") return false;
      if (args[1] === "on") { if (api.has("E5")) set(true, api, "test") } else if (args[1] === "off") set(false, api, "test");
      else if (args[1] === "ready") S.cool = 0;
      var p = null, st = null; try { p = api.player(); st = api.buffState(p, BUFF) } catch (e) {}
      api.log("pen of hope: " + (S.on ? "auto ON" : "auto OFF") + ", " + S.fired + " auto shots, recharge x" + mul(api) + ", switch " +
              (S.cool > 0 ? "resting " + S.cool.toFixed(2) + " s" : "ready") + ", marker " + (st === true ? "on Kris" : st === false ? "off" : "unreadable") +
              ", card " + (api.has("E5") ? "held" : "not held"));
      return true;
    },
    state: function () { return "pen " + (S.on ? "ON" : "off") + " (" + S.fired + " auto shots, recharge x" + S.mul + ")" }
  });
})() } catch (e) { try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_pen.js: " + e) } catch (e2) {} }
