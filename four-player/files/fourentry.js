// Four-player online: the way in from the Mind Training room (the robot's screen: Single-player, Local Co-Op, Online).
// Soulve, 2026-10-17: "theres no option to go into the new mode"; "we can just remake the screen and any ui ourself".
// The room has a fourth mode button the game only uses on Switch 2 (BtnGameShareLocal, input action Refresh: R on a
// keyboard). The game's own hint row shows every active button of the room with its key, so switching that button on
// gives the mode its own entry with the right key glyph; it is labelled "<BB4.MAX> Players Online" (8 since
// 2026-10-17) and opens the ONLINE · <BB4.MAX> PLAYERS menu. Shown whenever the stock Online button shows. Log tag FOURENTRY.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine;
  function log(m) { B.log("FOURENTRY", m); }
  var OLD = G.BB4E; if (OLD && OLD.timer) clearInterval(OLD.timer); if (OLD && OLD.keys) clearInterval(OLD.keys);
  var E = G.BB4E = { LABEL: (B.MAX || 8) + " Players Online", bound: {}, force: OLD ? OLD.force : false };
  var STOCK = /GameShare/i;
  var ROW = "(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions/FixedInputArea/FixedInputRoot";
  function q(root, n) { try { return cs.TransQuery.Query(root, n); } catch (e) { return null; } }
  function relabel() {
    var fr = UE.GameObject.Find(ROW); if (!fr) return;
    var ts = fr.GetComponentsInChildren(puerts.$typeof(cs.TMPro.TMP_Text), true);
    for (var i = 0; i < ts.Length; i++) { var t = ts.get_Item(i); if (String(t.name) == "TextInputName" && STOCK.test(String(t.text))) t.text = E.LABEL; }
  }
  E.tick = function () {
    var Bt; try { Bt = require("GamePlay/Battle/BattleJs").default.Instance.Battle; } catch (e) { return; }
    if (!Bt || !Bt.MapMgr || !Bt.MapMgr.RootObj) return;
    if (G.BB4L && !BB4L.steamOk && !BB4L.local) { try { BB4L.steamInit(); } catch (e) {} }   // Steam invites work from the hub on
    var root = Bt.MapMgr.RootObj.transform, grp = q(root, "PrepRoomPreSelectBtns");
    if (!grp || !grp.gameObject.activeInHierarchy) return;
    var team = q(root, "BtnTeamPve"), mine = q(root, "BtnGameShareLocal");
    if (!mine) return;
    // X is the mode's key (Soulve, 2026-10-17: "its press x"): the stock Online button (X) needs 91Act's servers, so
    // it is hidden and this entry takes its X action and place in the row
    var want = true;
    if (team && team.gameObject.activeSelf) team.gameObject.SetActive(false);
    if (mine.gameObject.activeInHierarchy != want) { mine.parent.gameObject.SetActive(want); mine.gameObject.SetActive(want); }
    var id = mine.gameObject.GetInstanceID();
    if (!E.bound[id]) {
      E.bound[id] = 1;
      var ba = mine.GetComponent(puerts.$typeof(cs.GamePlay.ButtonAction));
      try { ba.ActionId = 30; } catch (e) { log("action id: " + B.es(e)); }
      require("Core/UIUtil").default.BindButtonEvent(ba, function () { log(E.LABEL + " pressed"); try { if (G.BB4ON) BB4ON.open(); } catch (e) { log("open: " + B.es(e)); } });
      log("entry button ready in the Mind Training room");
    }
    if (want) relabel();
    E.shown = want ? Date.now() : 0;
  };
  // the button's own input event did not fire on PC (Soulve, 2026-10-17: "pressing or holding y does not work"), so
  // the key is read here: X on a pad (square on PlayStation), X on a keyboard, or the game's SwitchMode action (30)
  function yDown() {
    var I = UE.Input, K = UE.KeyCode, d = false;
    try { d = I.GetKey(K.X); } catch (e) {}                                   // the pad: the game's SwitchMode action below (a raw button index differs by pad)
    if (!d) { try { d = cs.Rewired.ReInput.players.GetPlayer(0).GetButton(30); } catch (e) {} }
    return d;
  }
  // The lobby screen's B closed it and this watcher reopened it a second later (Soulve, 2026-10-18: "i still cant leave
  // this screen by pressing or holding b or esc"; trace: close, then "8 Players Online pressed" 0.6-1 s after, as the
  // room's buttons came back under a button still held). Now: nothing counts for 1.5 s after the lobby screen closes,
  // and a button already down when the watcher wakes must be released first.
  E.keys = setInterval(function () {
    try {
      var on = E.shown && Date.now() - E.shown < 600 && !(G.BBTR && G.BBTR.dmOpen) && !(G.BB4UI && BB4UI.isOpen);
      var U = G.BB4UI, grace = U && U.closedAt && Date.now() - U.closedAt < 1500;
      if (!on || grace) { E.was = true; return; }                            // wakes wanting a fresh press
      var d = yDown();
      if (d && !E.was) { log(E.LABEL + " pressed"); if (G.BB4ON) BB4ON.open(); }
      E.was = d;
    } catch (e) { log("keys: " + B.es(e)); }
  }, 30);
  E.timer = setInterval(function () { try { E.tick(); } catch (e) { if (!E.errT || Date.now() - E.errT > 10000) { E.errT = Date.now(); log("tick: " + B.es(e)); } } }, 250);
  return "FOURENTRY ready";
})();
