/* dr-party: TENSION (TP), Kris's run-long gauge (kp_tension.py). No card is needed for it; the card H3 Graze and the
   hidden pair HP12 (Graze + Triple Dash) raise what a perfect dodge gives.
   The lead, 2026-10-03: "the more tension the more damage you do and its permanent for the run you get 5 from perfect
   doding but theres potentials or hidden effects that give you more tension for perfect dodges instead of gaining sp
   every 20 mp gained equals 5 tension gained".
     - a perfect dodge: +5 (Graze: +10; Graze and Triple Dash: +15), up to CFG.max;
     - MP, in a run: Kris spends none. What MP the game gives is taken off again and counted: every 20 MP is 5 Tension.
       Not in the first 1.5 s of a room (the game may set MP there), never while the Try Out room's refill buff
       (train_add_SPMP) is on Kris, and not outside a run at all (the Try Out room: MP is left alone) unless
       "ptest tp mp on";
     - damage: the buff CFG.buff on Kris, strength CFG.rate x Tension in steps of CFG.step (+2 % per 10);
     - the first time it reaches MAX in a run: the meter flashes and the party strikes its pose (js/command.js
       P.tensionMax);
     - kept for the run. The run is the single-player run model (Server/Model/BreedDungeon, as the game's own "server"
       holds it), and only in a run battle (BattleJs.Instance.BattleClassName "BattleBreed"):
         a new run     its clock is at 0 (baseInfo.useTime counts the rooms finished so far) -> Tension starts at 0;
         a later room  the script's own value goes on (it lives as long as the game runs);
         a run continued after the game was closed: what was stored for it (PlayerPrefs: its dungeon, character, mode
                       and Entropy, with the run's clock when it was stored), else 0;
         no run        (the Try Out room, co-op: not read) starts at 0 whenever it is entered and is never stored.
       0.5.0 looked for a seed on BattleJs.Instance.enterData. That object does not exist (enterData is
       BattleBreedRun's) and a normal run's seed is 0, so every battle was "run none": Tension was never reset, and
       what the Try Out room's refill gave as the lead quit it (188 x "+25" in 0.3 s) was at MAX in the run after.
       Known: a run continued in its first room starts at 0 again (its clock is still 0); two save slots that hold the
       same character at the same settings share one stored value.
   js/command.js draws the meter from __bbDR.party.tension ({ tp, max, flash, gain, shown }).
     POTS tension +5 (perfect dodge) -> 35                 a gain
     POTS tension: a new run (1003:200801:2:0): starts at 0
     POTS tension: run 1003:200801:2:0 (412 s in): restored 35
     POTS tension: MAX for the first time this run
   Test lines (drparty_test.txt; dev only): ptest tp <n> | add <n> | dodge | mp on|off | (none: the state).
   The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis, CS = csharp_1;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  P.potsGroups = P.potsGroups || [];
  for (var g0 = 0; g0 < P.potsGroups.length; g0++) if (P.potsGroups[g0] && P.potsGroups[g0].name === "tension") return;
  var CFG = (G.__bbDRPotsCFG || {}).tension || {};
  var MAX = CFG.max > 0 ? CFG.max : 100, DODGE = CFG.dodge && CFG.dodge.length === 3 ? CFG.dodge : [5, 10, 15];
  var MP = CFG.mp && CFG.mp.length === 2 ? CFG.mp : [20, 5], RATE = CFG.rate > 0 ? CFG.rate : 0.002, STEP = CFG.step > 0 ? CFG.step : 10;
  var BUFF = CFG.buff || "dr_pt_tension", SLOT = CFG.slot === undefined ? 2 : CFG.slot, KEY = "bbdr_party_tension";
  var RUN_BATTLE = CFG.runBattle || "BattleBreed", REFILL = CFG.refill || "train_add_SPMP";
  var S = { tp: 0, max: MAX, acc: 0, seed: null, fresh: null, used: 0, step: -1, flash: 0, gain: 0, shown: 0, quiet: 0, buffT: 0, saveT: 0,
            dirty: false, mpTest: false, dodges: 0, fromMp: 0, maxed: false, runErr: null };
  P.tension = S;
  S.runKey = function () { var r = runOf(); return r ? r.key : "none" };   // (js/potentials.js: which run a card joined)

  function U() { return require("Core/Util").U }
  // the run this battle belongs to, or null (see the head of this file)
  function runOf() {
    try {
      var bj = BattleJs_1.default.Instance;
      if (!bj || bj.BattleClassName !== RUN_BATTLE) return null;
      var m = require("Server/Model/BreedDungeon").ModelBreedDungeon.Instance, b = m && m.data && m.data.baseInfo;
      if (!b || !b.id) return null;
      return { key: [b.id, b.actorId, b.mode || 0, b.heat || 0].join(":"), used: +b.useTime || 0, began: +b.beginTimestamp || 0 };
    } catch (e) { if (!S.runErr) S.runErr = String(e); return null }
  }
  function load(key, used) {                          // what was stored for this run, if it was stored no later than now
    try {
      var raw = String(CS.UnityEngine.PlayerPrefs.GetString(KEY, "")), a = raw.split("|");
      if (a.length >= 4 && a[0] === key && (+a[3] || 0) <= used + 1)
        return { tp: Math.max(0, Math.min(MAX, +a[1] || 0)), acc: Math.max(0, +a[2] || 0) };
    } catch (e) {}
    return null;
  }
  function save() {
    S.dirty = false;
    if (!S.seed || S.seed === "none") return;
    try { CS.UnityEngine.PlayerPrefs.SetString(KEY, [S.seed, S.tp, S.acc.toFixed(2), Math.floor(S.used)].join("|")); CS.UnityEngine.PlayerPrefs.Save() } catch (e) {}
  }
  function add(n, why, api) {
    if (!(n > 0)) return;
    var before = S.tp; S.tp = Math.min(MAX, S.tp + n);
    S.gain = S.tp - before; S.flash = 0.6; S.dirty = true;
    api.log("tension +" + n + " (" + why + ") -> " + S.tp + (S.tp >= MAX ? " MAX" : ""));
    if (before < MAX && S.tp >= MAX && !S.maxed) {    // once a run: the flash and the party's pose
      S.maxed = true;
      api.log("tension: MAX for the first time this run");
      try { if (typeof P.tensionMax === "function") P.tensionMax() } catch (e) {}
    }
  }
  function dodgeGain(api) { return api.has("H3") ? (api.has("G1") ? DODGE[2] : DODGE[1]) : DODGE[0] }
  function mpOf(p) { try { return U().FpToFloat(p.Attr.GetMP(SLOT)) } catch (e) { return null } }
  function buff(p, api, force) {
    var step = Math.floor(S.tp / STEP);
    if (!force && step === S.step) return;
    S.step = step;
    try { api.removeBuff(p, BUFF) } catch (e) {}
    if (step > 0) api.addBuff(p, BUFF, 9999, step * STEP * RATE, 1, p);
  }
  // which run this is, and what Tension it starts with (asked every tick: a new battle, a new run, the Try Out room)
  function whichRun(api) {
    var r = runOf(), id = r ? r.key : "none", fresh = r && r.used === 0 ? id + "@" + r.began : null;
    if (S.runErr && S.runErr !== true) { api.log("tension: the run cannot be read (" + S.runErr + "): kept for this battle only"); S.runErr = true }
    if (id !== S.seed || (fresh && fresh !== S.fresh)) {
      if (S.dirty) save();                            // what the run before had, under its own key
      var got = null, why;
      if (!r) why = "no run here (the Try Out room): starts at 0, MP is left alone";
      else if (fresh) why = "a new run (" + id + "): starts at 0";
      else { got = load(id, r.used); why = "run " + id + " (" + Math.round(r.used) + " s in): " + (got ? "restored " + got.tp : "nothing stored for it, starts at 0") }
      S.seed = id; if (fresh) S.fresh = fresh;
      S.tp = got ? got.tp : 0; S.acc = got ? got.acc : 0; S.step = -1; S.quiet = 1.5; S.flash = 0; S.gain = 0;
      S.maxed = S.tp >= MAX; S.used = r ? r.used : 0; S.dirty = !!r && !got;
      api.log("tension: " + why);
    }
    if (r) S.used = r.used;
    return r;
  }

  P.potsGroups.push({
    name: "tension", cards: ["H3"],
    onDodge: function (p, api) { S.dodges++; add(dodgeGain(api), "perfect dodge", api); try { if (P.graze) P.graze() } catch (e) {} },
    onStage: function (p, why, api) { S.quiet = 1.5; S.step = -1; if (S.dirty) save() },
    tick: function (p, bdt, api) {
      var r = whichRun(api);
      S.flash = Math.max(0, S.flash - bdt); S.quiet = Math.max(0, S.quiet - bdt);
      S.shown += (S.tp - S.shown) * Math.min(1, bdt * 10); if (Math.abs(S.tp - S.shown) < 0.05) S.shown = S.tp;
      // MP -> Tension (in a run, or when the test asks; never the Try Out room's refill)
      var mp = mpOf(p);
      if (mp !== null && mp > 0.01 && (S.mpTest || (r && api.buffState(p, REFILL) !== true))) {
        if (S.quiet <= 0) {
          S.acc += mp; S.fromMp += mp;
          var n = Math.floor(S.acc / MP[0]);
          if (n > 0) { S.acc -= n * MP[0]; add(n * MP[1], n * MP[0] + " MP", api) }
        }
        try { p.Attr.SetMP(U().FloatToFp(0), SLOT) } catch (e) {}
      }
      S.buffT -= bdt;
      if (S.buffT <= 0) { S.buffT = 1.0; if (S.step > 0 && api.buffState(p, BUFF) === false) S.step = -1 }   // a new room took the buff
      buff(p, api, false);
      if (S.dirty) { S.saveT -= bdt; if (S.saveT <= 0) { S.saveT = 1.0; save() } }
    },
    test: function (cmd, args, api) {
      if (cmd !== "ptest" || args[0] !== "tp") return false;
      var p = api.player();
      if (args[1] === "add") add(+args[2] || 5, "test", api);
      else if (args[1] === "dodge") { S.dodges++; add(dodgeGain(api), "perfect dodge (test)", api); try { if (P.graze) P.graze() } catch (e) {} }
      else if (args[1] === "mp") S.mpTest = args[2] === "on";
      else if (args[1] !== undefined && !isNaN(+args[1])) { S.tp = Math.max(0, Math.min(MAX, +args[1])); S.flash = 0.6; S.dirty = true; S.step = -1; S.maxed = S.tp >= MAX }
      if (p) buff(p, api, false);
      api.log("tension " + S.tp + "/" + MAX + ", damage +" + Math.round(Math.floor(S.tp / STEP) * STEP * RATE * 100) + "%, run " + S.seed + ", per dodge " + dodgeGain(api) +
              ", MP counted " + S.fromMp.toFixed(0) + " (" + S.acc.toFixed(1) + " towards the next " + MP[1] + "), buff " + (p ? api.buffState(p, BUFF) : "?"));
      return true;
    },
    state: function () { return "tension " + S.tp + "/" + MAX + " (" + S.dodges + " perfect dodges, " + S.fromMp.toFixed(0) + " MP counted, run " + S.seed + ")" }
  });
})() } catch (e) { try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_tension.js: " + e) } catch (e2) {} }
