/* dr-party: the Potentials' trigger forwarders (local_only/deltarune/party/potentials/PLAN.md section 1).
   Appended to data/js/gameplay/playertrigger/PlayerTriggerFuncs (module scope: trigFuncs). The rows 208901-208903 ride
   on Kris only (bbee-actors BB_SELF_TRIGGERS[200801]); each forwards to js/potentials.js, which lives in the BattleUI
   module: globalThis.__bbDR.party.pots.hit / dodge / stage / talent (player, args). The talent's trigger (208961,
   Second Wind) belongs to whoever holds the talent: Kris, or an Evotype heir of Kris's, so its forwarder does not ask
   who the hero is (before the script has loaded, an early talent trigger is only counted, like the others).
   A trigger that fires before BattleUI has loaded is counted in globalThis.__bbDRPotsEarly (the script logs it and
   resets per-room state from its own tick, so nothing is lost). Shape: ex-ragna runtime.js's forwarders.
   Wrapped: PlayerTriggerFuncs is every hero's module, so nothing thrown while this loads may escape. */
try { (function () {
  var G = globalThis, ACTOR = 200801;
  function kris(t) { try { return !!t && (t.BaseID === ACTOR || String(t.ActionGroupID) === String(ACTOR)) } catch (x) { return false } }
  function fwd(name, any) {                         // any: for whoever holds the trigger (the talent rides on an Evotype heir too)
    return function (t, e, l, a) {
      try {
        if (any ? !!t : kris(t)) {
          var P = G.__bbDR && G.__bbDR.party, h = P && P.pots;
          if (h && typeof h[name] === "function") h[name](t, a);
          else { var q = (G.__bbDRPotsEarly = G.__bbDRPotsEarly || {}); q[name] = (q[name] || 0) + 1 }
        }
      } catch (x) {}
      return !1;
    };
  }
  trigFuncs.trDR_pot_hit = fwd("hit");
  trigFuncs.trDR_pot_dodge = fwd("dodge");
  trigFuncs.trDR_pot_stage = fwd("stage");
  trigFuncs.trDR_pot_talent = fwd("talent", true);  // Second Wind: Kris, or a hero who inherited it (js/potentials.js talent)
})(); } catch (e) {
  try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("potentials_trig.js: " + e) } catch (e2) {}
}
