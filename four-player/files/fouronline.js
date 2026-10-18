// Four-player online mode: the way in (Soulve, 2026-10-16: "make this mode launch from like and new menu that opens
// when you press x or hold x on character select to open online mode like we have for the dev menu and it says 4
// players"). Hold X (keyboard X, or X on a pad) for half a second on character select: the ONLINE · <BB4.MAX> PLAYERS menu
// opens, built on the dev menu's window with only the Online page. Log tag FOURONLINE.
(function () {
  var cs = CS, G = globalThis, B = G.BB4;
  var WIN = B.WIN;
  function log(m) { B.log("FOURONLINE", m); }
  var es = B.es;
  var O = G.BB4ON = G.BB4ON || {};
  if (O.timer) clearInterval(O.timer);
  O.HOLD = 0.5;          // seconds X is held before the menu opens
  O.seen = 0; O.held = 0; O.fired = false;

  // character select marks itself every frame it updates (hooked on the first tick, not while the game's own
  // scripts are still loading: this file is installed at the end of one of them)
  function hook() {
    if (O.hooked) return; O.hooked = 1;
    try {
      var HS = require("GamePlay/BattleBreedPrepare/SceneUIHeroSelect").default, P = HS.prototype;
      if (!P.__bb4on) {
        var up = P.Update;
        P.Update = function (e) { G.BB4ON.seen = Date.now(); G.BB4ON.hs = this; return up.apply(this, arguments); };
        P.__bb4on = 1;
      }
    } catch (e) { log("character select hook: " + es(e)); }
  }

  function xDown() {
    var I = cs.UnityEngine.Input, K = cs.UnityEngine.KeyCode;
    try { return I.GetKey(K.X) || I.GetKey(K.JoystickButton2); } catch (e) { return false; }
  }
  // the hero this player goes in with: the one under the cursor on character select, else the one they stand as.
  // No ownership check here (Soulve, 2026-10-17: "dont do hero checks for now").
  O.myHero = function () {
    try {
      if (Date.now() - O.seen < 1000 && O.hs) {
        var HSM = require("GamePlay/BattleBreedPrepare/SceneUIHeroSelect"), h = O.hs.listHero && O.hs.listHero[HSM.HeroSelectRefHero.selectHeroIndex];
        if (h && h.server && h.server.id) return h.server.id;
      }
    } catch (e) {}
    // a hero id is a BaseActorConf row (100101 and up); the hub's own avatar (1002) is not
    function hero(id) { try { return id >= 100000 && require("Xlsx").Xlsx.BaseActorConf.Get(id) ? id : 0; } catch (e) { return 0; } }
    try { var p = require("GamePlay/Battle/BattleJs").default.Instance.Battle.PlayerSelf; if (p && p.ActorSettings && hero(p.ActorSettings.BaseID)) return p.ActorSettings.BaseID; } catch (e) {}
    try { var DB = require("DataBinding").DB, l = DB.LastSelectHero || DB.LastSelectBaseActor; var v = l && (l.Value != null ? l.Value : l); if (hero(v)) return v; } catch (e) {}
    return G.BB4L && hero(BB4L.me.hero) ? BB4L.me.hero : 0;
  };
  // The Mind Training room's mode buttons (Single-player, Local Co-Op, ...) listen for their keys the whole time, also
  // under a window: Enter in this menu also pressed the room's Single-player (testers, 2026-10-17: Enter on "Your
  // hero" broke the menu and Esc then left to single player). They are switched off while the menu, or the player-ID
  // box it opens, is up, and back on once both have been closed for half a second.
  function roomButtons(on) {
    var n = 0;
    try {
      var Bt = require("GamePlay/Battle/BattleJs").default.Instance.Battle;
      var grp = Bt && Bt.MapMgr && Bt.MapMgr.RootObj && cs.TransQuery.Query(Bt.MapMgr.RootObj.transform, "PrepRoomPreSelectBtns");
      if (!grp) return 0;
      var all = grp.GetComponentsInChildren(puerts.$typeof(cs.GamePlay.InputAction), true);
      for (var i = 0; i < all.Length; i++) { var a = all.get_Item(i); if (on) { if (O.off && O.off[a.GetInstanceID()]) { a.Interactable = true; n++; } } else if (a.Interactable) { (O.off = O.off || {})[a.GetInstanceID()] = 1; a.Interactable = false; n++; } }
      if (on) O.off = null;
    } catch (e) { log("room buttons: " + es(e)); }
    return n;
  }
  function guardRoom() {
    var n = roomButtons(false); if (n) log("room buttons off under the menu: " + n);
    if (O.guard) return;
    var quiet = 0;
    O.guard = setInterval(function () {
      var up = (G.BBTR && G.BBTR.dmOpen) || (G.BB4L && BB4L.asking) || (G.BB4UI && BB4UI.isOpen);
      quiet = up ? 0 : quiet + 100;
      if (quiet < 500) return;
      clearInterval(O.guard); O.guard = null;
      var k = roomButtons(true); if (k) log("room buttons back on: " + k);
    }, 100);
  }
  O.open = function () {
    // never over a fight or its start (2026-10-17: X pressed as Start also opened this menu as the fight loaded, and
    // it held the controls); in a lobby, X goes back to the lobby screen
    var F = G.BB4F, L = G.BB4L;
    if (F && (F.inFight || (F.startAt && Date.now() - F.startAt < 15000))) { log("not opened: a fight is starting or running"); return false; }
    if (L && L.state == "in" && G.BB4UI && G.BB4UI.open) { if (!G.BB4UI.isOpen) G.BB4UI.open(); return true; }
    guardRoom();
    try { var hero = O.myHero(); if (hero && G.BB4L) { BB4L.setHero(hero); } } catch (e) {}
    try { if (G.BB4L) BB4L.steamInit(); } catch (e) {}
    // the lobby screen's own online page (rejoin, every open lobby with ping, host, quick join, player ID); the dev
    // menu's Online window stays as the way in only when B.devOnline is set (a test window) or the page can't load
    if (G.BB4UI && G.BB4UI.openOnline && !B.devOnline) { log("opening the online page"); G.BB4UI.openOnline(); return true; }
    var T = G.BBTR;
    if (!T) { log("no dev menu code in this game"); return false; }
    try { if (T.loadDm) T.loadDm(); } catch (e) { log("dev menu load: " + es(e)); }
    if (!T.menu2) { log("dev menu window not available"); return false; }
    log("opening the online menu");
    T.menu2({ only: ["Online"], title: "ONLINE \u00B7 " + (B.MAX || 8) + " PLAYERS", any: true });
    return true;
  };
  var last = Date.now();
  O.timer = setInterval(function () {
    try {
      hook();
      var now = Date.now(), dt = (now - last) / 1000; last = now;
      var onSelect = now - O.seen < 300;
      if (onSelect && G.BB4L && !BB4L.steamOk) { try { BB4L.steamInit(); } catch (e) {} }
      if (!onSelect || (G.BBTR && G.BBTR.dmOpen)) { O.held = 0; O.fired = false; return; }
      if (xDown()) {
        O.held += dt;
        if (!O.fired && O.held >= O.HOLD) { O.fired = true; O.open(); }
      } else { O.held = 0; O.fired = false; }
    } catch (e) {}
  }, 30);
  log("ready in window " + WIN + ": hold X on character select");
  return "FOURONLINE ready";
})();
