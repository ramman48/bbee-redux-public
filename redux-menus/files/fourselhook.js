// Redux Menus: the stock character select and Legacy screen mark themselves every frame they update
// (BB4ON.seen / BB4ON.hs, BB4ON.fesSeen). The new select (fourselect.js) and the hold-X online menu
// (four-player's fouronline.js) both read these; BB4ON.hooked says the wrap is in. Hooked on the first tick,
// not while the game's own scripts are still loading: this file is installed at the end of one of them.
(function () {
  var G = globalThis, B = G.BB4;
  function log(m) { B.log("FOURSELHOOK", m); }
  var es = B.es;
  var O = G.BB4ON = G.BB4ON || {};
  O.seen = O.seen || 0;
  function hook() {
    if (O.hooked) return; O.hooked = 1;
    try {
      var HS = require("GamePlay/BattleBreedPrepare/SceneUIHeroSelect").default, P = HS.prototype;
      if (!P.__bb4on) {
        var up = P.Update;
        P.Update = function (e) { G.BB4ON.seen = Date.now(); G.BB4ON.hs = this; return up.apply(this, arguments); };
        P.__bb4on = 1;
      }
      // the Legacy screen (inheriting Legacies) sits over character select, which keeps updating under it: while it
      // updates, holding a button never opens the Online menu (Ghostly, 2026-10-18: holding Circle / B while inheriting
      // Legacies opened the Online Lobby and kept him from inheriting and starting the run)
      var FS = require("GamePlay/BattleBreedPrepare/SceneUIFesSelect").default, FP = FS.prototype;
      if (!FP.__bb4on) {
        var fup = FP.Update;
        FP.Update = function (e) { G.BB4ON.fesSeen = Date.now(); return fup.apply(this, arguments); };
        FP.__bb4on = 1;
      }
    } catch (e) { log("character select hook: " + es(e)); }
  }
  if (O.hookTimer) clearInterval(O.hookTimer);
  O.hookTimer = setInterval(function () { try { hook(); if (O.hooked) { clearInterval(O.hookTimer); O.hookTimer = 0; } } catch (e) {} }, 30);
  return "FOURSELHOOK ready";
})();
