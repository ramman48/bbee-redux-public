// Four-player online: the team HUD for any number of players. The stock co-op HUD has one teammate card (top left:
// portrait and health) and one off-screen tracker. This builds one of each for every other player in the fight from
// the game's own card and tracker (the same objects, cloned), so each player sees all the others. Soulve, 2026-10-17:
// "each player should have the other 3 charcters icons with their health"; "only one offscreen character tracker
// for each character when it should track the other 3"; "we can just remake the screen and any ui ourself so it
// natively supports anything we add or remove". Log tag FOURHUD.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine;
  function log(m) { B.log("FOURHUD", m); }
  var OLD = G.BB4H; if (OLD) { try { OLD.clear(); } catch (e) {} if (OLD.timer) clearInterval(OLD.timer); }
  var H = G.BB4H = { cards: [], tags: [], key: "", GAP: 8, TAGSIZE: 24, TAGLIFT: 0.1 };
  var Mode, BTR;
  function mods() {
    if (Mode) return;
    Mode = require("Window/Battle/BattleUITeamBreedMode");
    BTR = require("GamePlay/BattleTeamBreedRun/BattleTeamBreedRun").default;
  }
  function destroy(o) { try { if (o) UE.Object.Destroy(o); } catch (e) {} }
  H.clear = function () { try { if (H.stockCard && !H.stockCard.Equals(null)) H.stockCard.transform.localScale = UE.Vector3.one; } catch (e) {} H.stockCard = null; H.cards.forEach(function (c) { destroy(c.cardGo); destroy(c.hintGo); }); H.tags.forEach(function (c) { destroy(c.go); }); destroy(H.waitGo); H.waitGo = null; H.cards = []; H.tags = []; H.key = ""; H.busy = {}; };
  H.busy = {};
  function others(Bt) {
    var L = Bt.GetAllMainPlayers(), me = Bt.PlayerSelf, out = [];
    for (var i = 0; i < L.Count; i++) { var p = L.get_Item(i); if (p != me) out.push(p); }
    return out;
  }
  function nameOf(run, p) { try { var s = run.PlayerNetSt.GetStatusByUid(p.PlayerIDForFS64); return s && s.Name ? String(s.Name) : ""; } catch (e) { return ""; } }
  function setName(go, s) { try { var t = go.transform.Find("TextName"); if (!t) { var all = go.GetComponentsInChildren(puerts.$typeof(cs.TMPro.TextMeshProUGUI), true); for (var i = 0; i < all.Length; i++) if (String(all.get_Item(i).name) == "TextName") { all.get_Item(i).text = s; return; } return; } t.GetComponent(puerts.$typeof(cs.TMPro.TextMeshProUGUI)).text = s; } catch (e) {} }

  H.sync = function () {
    mods();
    var run = BTR.SilentInstance, BI = null, Bt = null;
    try { BI = require("GamePlay/Battle/BattleJs").default.Instance; Bt = BI.Battle; } catch (e) {}
    var ui = BI && BI.TeamBreedUI;
    if (!ui || !Bt || !ui.R || !ui.R.FriendStatus) { if (H.cards.length || H.tags.length) H.clear(); return; }
    var os = others(Bt);
    if (!os.length) { if (H.cards.length || H.tags.length) H.clear(); return; }
    var key = os.map(function (p) { return String(p.PlayerIDForFS64); }).join(",");
    if (key == H.key && H.ui === ui && H.tags.every(function (c) { return c.go && !c.go.Equals(null); })) return;
    H.clear(); H.ui = ui; H.key = key;
    var card = ui.R.FriendStatus, hint = ui.R.TeammatePosHint, bounds = ui.R.PosHintBounds;
    var rt = card.GetComponent(puerts.$typeof(UE.RectTransform)), h = rt.rect.height, pos = rt.anchoredPosition;
    // a name tag over every other player, in the HUD's own type (the card's name text, cloned)
    var src = null; try { var all = card.GetComponentsInChildren(puerts.$typeof(cs.TMPro.TextMeshProUGUI), true); for (var j = 0; j < all.Length; j++) if (String(all.get_Item(j).name) == "TextName") src = all.get_Item(j); if (!src && all.Length) src = all.get_Item(0); } catch (e) {}
    if (src) os.forEach(function (p, i) {
      var go = UE.Object.Instantiate(src.gameObject, bounds); go.name = "BB4NameTag" + i; go.SetActive(true);
      // the card's only text is its reconnect hint, whose locale component wrote "Waiting for connection" back over
      // the name (testers, 2026-10-17: "everyone has waiting for connection on top of them"): the copy loses it
      try { var lc = go.GetComponent(puerts.$typeof(cs.NOAH.UI.UILocale)); if (lc) UE.Object.DestroyImmediate(lc); } catch (e) {}
      var t = go.GetComponent(puerts.$typeof(cs.TMPro.TextMeshProUGUI)), r = go.GetComponent(puerts.$typeof(UE.RectTransform));
      t.text = nameOf(run, p) || ("Player " + (i + 2)); t.alignment = cs.TMPro.TextAlignmentOptions.Bottom; t.enableWordWrapping = false;
      t.fontSize = H.TAGSIZE; t.raycastTarget = false;
      r.anchorMin = r.anchorMax = new UE.Vector2(0.5, 0.5); r.pivot = new UE.Vector2(0.5, 0); r.sizeDelta = new UE.Vector2(400, 40);
      H.tags.push({ p: p, go: go, r: r });
    });
    // one line at the top: who the run is waiting on (busyAndWait fills it)
    if (src) {
      var wg = UE.Object.Instantiate(src.gameObject, bounds); wg.name = "BB4WaitLine"; wg.SetActive(false);
      try { var lc2 = wg.GetComponent(puerts.$typeof(cs.NOAH.UI.UILocale)); if (lc2) UE.Object.DestroyImmediate(lc2); } catch (e) {}
      var wt = wg.GetComponent(puerts.$typeof(cs.TMPro.TextMeshProUGUI)), wr = wg.GetComponent(puerts.$typeof(UE.RectTransform));
      wt.alignment = cs.TMPro.TextAlignmentOptions.Center; wt.enableWordWrapping = false; wt.fontSize = 30; wt.raycastTarget = false; wt.color = new UE.Color(1, 0.82, 0.29, 1);
      wr.anchorMin = wr.anchorMax = new UE.Vector2(0.5, 1); wr.pivot = new UE.Vector2(0.5, 1); wr.sizeDelta = new UE.Vector2(1400, 44); wr.anchoredPosition = new UE.Vector2(0, -170);
      H.waitGo = wg; H.waitT = wt;
    }
    if (os.length < 2) { log("name tags: " + H.tags.length); return; }          // one teammate: the stock card and tracker do it
    // the stock card and tracker keep the first other player (the game binds them); the rest are ours
    var lay = layout(rt, os.length);
    card.transform.localScale = new UE.Vector3(lay.s, lay.s, 1); H.stockCard = card;
    for (var i = 1; i < os.length; i++) {
      var p = os[i];
      var cg = UE.Object.Instantiate(card.gameObject, card.transform.parent); cg.name = "BB4FriendStatus" + i;
      var crt = cg.GetComponent(puerts.$typeof(UE.RectTransform)), at = lay.at(i);
      crt.anchoredPosition = new UE.Vector2(pos.x + at.x, pos.y + at.y); cg.transform.localScale = new UE.Vector3(lay.s, lay.s, 1);
      var st = new Mode.PveTeamFightPlayerStatus(cg.transform, ui); st.BindPlayer(p); setName(cg, nameOf(run, p));
      var hg = UE.Object.Instantiate(hint.gameObject, hint.transform.parent); hg.name = "BB4PosHint" + i;
      var ph = new Mode.PveTeamFightPlayerPositionHint(hg.transform, ui); ph.Bind(p, bounds);
      H.cards.push({ p: p, cardGo: cg, hintGo: hg, st: st, ph: ph });
    }
    log("team HUD: " + os.length + " other players, " + H.cards.length + " card(s) and tracker(s) added, " + lay.cols + " column(s) of " + lay.per + " at scale " + lay.s.toFixed(2));
  };
  // Where the cards go: a column under the stock card while they fit in the top HALF of the screen, then more columns
  // beside it; when the columns would pass HWIDE of the screen's width every card shrinks (never under SMIN) so 15
  // other players (16 in all, BB4.CAP) still fit in the top-left corner. Card i sits at layout.at(i) from the stock one.
  H.HTALL = 0.5; H.HWIDE = 0.45; H.SMIN = 0.55;
  function layout(rt, n) {
    var cw = rt.rect.width, ch = rt.rect.height, cv = null;
    try { cv = rt.GetComponentInParent(puerts.$typeof(UE.Canvas)).rootCanvas.GetComponent(puerts.$typeof(UE.RectTransform)).rect; } catch (e) {}
    var W = cv ? cv.width : 2560, Hh = cv ? cv.height : 1440, s = 1, per = 1, cols = 1;
    for (; s >= H.SMIN; s -= 0.05) {
      per = Math.max(1, Math.floor((Hh * H.HTALL) / ((ch + H.GAP) * s)));
      cols = Math.ceil(n / per);
      if (cols * (cw + H.GAP) * s <= W * H.HWIDE) break;
    }
    s = Math.max(s, H.SMIN);
    return { s: s, per: per, cols: cols, at: function (i) { return { x: Math.floor(i / per) * (cw + H.GAP) * s, y: -(i % per) * (ch + H.GAP) * s }; } };
  }
  // a tag sits over its player's head: the player's place in the camera's view, put on the tracker's screen frame
  function placeTags() {
    if (!H.tags.length) return;
    var U = require("Core/Util").U, e = cs.GamePlay.BattleBase.Cur.CameraDirector.GetCurrentViewportRange();
    var bd = H.ui && H.ui.R && H.ui.R.PosHintBounds;
    if (!bd || bd.Equals(null)) { H.clear(); return; }     // the fight UI is gone: sync builds them again
    var b = bd.rect;
    for (var i = 0; i < H.tags.length; i++) {
      var c = H.tags[i], p = c.p, show = false;
      try {
        if (!p.Attr.IsHPZero && !(G.BB4V && BB4V.open)) {     // not over the room vote screen
          var w = p.Position, y = w.y + U.FpToFloat(p.SceneCollideSize.y) + H.TAGLIFT;
          var nx = (w.x - e.xMin) / e.width, ny = (y - e.yMin) / e.height;
          show = nx > -0.05 && nx < 1.05 && ny > -0.05 && ny < 1.1;
          if (show) { c.px = (nx - 0.5) * b.width; c.py = (ny - 0.5) * b.height; }
        }
      } catch (x) {}
      if (c.shown !== show) { c.go.SetActive(show); c.shown = show; }
    }
    // tags of players standing together stack upward instead of printing over each other
    var on = H.tags.filter(function (c) { return c.shown; }).sort(function (a, b) { return a.py - b.py; }), placed = [];
    on.forEach(function (c) {
      var y = c.py;
      for (var k = 0; k < placed.length; k++) { var o = placed[k]; if (Math.abs(o.x - c.px) < 150 && Math.abs(o.y - y) < 30) { y = o.y + 30; k = -1; } }
      placed.push({ x: c.px, y: y });
      c.r.anchoredPosition = new UE.Vector2(c.px, y);
    });
  }
  // Every card follows its own player's connection state. The stock card is built for one teammate and is left on
  // "waiting for connection" (its reconnect state) when the HUD binds after a reconnect, and the extra cards were
  // copied from it (testers, 2026-10-17: "everyone has waiting for connection on top of them").
  function netStates() {
    var run = BTR && BTR.SilentInstance, BI = null; try { BI = require("GamePlay/Battle/BattleJs").default.Instance; } catch (e) {}
    if (!run || !run.PlayerNetSt || !BI || !BI.TeamBreedUI) return;
    var F = require("Gen/pbdef").FightExDataGameStateFlag, list = [];
    var os = others(BI.Battle); if (os.length && BI.TeamBreedUI.FriendStatusObj) list.push({ p: os[0], st: BI.TeamBreedUI.FriendStatusObj, ph: BI.TeamBreedUI.FriendPositionHintObj });
    H.cards.forEach(function (c) { list.push(c); });
    list.forEach(function (c) {
      var s = null; try { s = run.PlayerNetSt.GetStatusByUid(c.p.PlayerIDForFS64); } catch (e) {}
      if (!s) return;
      var off = s.GameState == F.OffLine;
      if (s.GameState == F.Normal && c.st.reconnecting) { c.st.reconnecting = false; c.st.SetPlayerOffline(false); if (c.ph) c.ph.SetPlayerOffline(false); log("card for " + (s.Name || c.p.PlayerIDForFS64) + ": connected, waiting label cleared"); }
      else if (c !== list[0] && !!c.st.offline != off) { c.st.SetPlayerOffline(off); if (c.ph) c.ph.SetPlayerOffline(off); }
    });
  }
  // A teammate who has a menu open (the rest room's, a shop's) gets the hourglass over their head and on their card.
  // The game's own marker knows one teammate: its "busy" message does not say whose, so with four players the
  // hourglass went over player 2 whoever it was, and the last to finish cleared it for all (testers, 2026-10-17:
  // "Rest Room was bugged", "everyone had to use the room"). Here each player's own flag drives their own marker.
  // While the run waits for everyone at a step (the rest room, loading, a door), the line at the top names who it is
  // still waiting on, after 1.5 s.
  function busyAndWait() {
    var run = BTR && BTR.SilentInstance, BI = null; try { BI = require("GamePlay/Battle/BattleJs").default.Instance; } catch (e) {}
    var N = run && run.PlayerNetSt; if (!N || !BI || !BI.TeamBreedUI || !BI.Battle) return;
    var pb = require("Gen/pbdef"), F = pb.FightExDataGameStateFlag, A = pb.FightExDataAFKFlag;
    var stage = ""; try { stage = String(BI.Battle.BattleContextBase.Stage); } catch (e) {}
    if (stage != H.stage) { H.stage = stage; H.busy = {}; }          // a room change stops every hourglass
    var os = others(BI.Battle), cards = {};
    if (os.length && BI.TeamBreedUI.FriendStatusObj) cards[String(os[0].PlayerIDForFS64)] = BI.TeamBreedUI.FriendStatusObj;
    H.cards.forEach(function (c) { cards[String(c.p.PlayerIDForFS64)] = c.st; });
    os.forEach(function (p) {
      var id = String(p.PlayerIDForFS64), s = null; try { s = N.GetStatusByUid(p.PlayerIDForFS64); } catch (e) {}
      var busy = !!(s && s.Afk != null && s.Afk != A.None && s.GameState == F.Normal && !p.Attr.IsHPZero);
      if (H.busy[id] === busy) return;
      H.busy[id] = busy;
      try {
        p.EffectMgr.StopEffect("UI/Button/HourGlass_501", true);
        if (busy) { var v = p.ActorModel.VisualTransform.position; p.EffectMgr.StartEffect("UI/Button/HourGlass_501", new UE.Vector2(v.x, 2 + v.y), new UE.Vector2(0.5, 0.5), 0, cs.LayerHelper.ESortingLayer.NearEffectFront); }
      } catch (e) { log("hourglass: " + B.es(e)); }
      try { if (cards[id]) cards[id].SetPlayerBusy(busy); } catch (e) {}
    });
    if (!H.waitGo || H.waitGo.Equals(null)) return;
    var w = N.CurrentWaitStatus, names = [];
    if (w) {
      if (H.waitS !== w.Status || !H.waitAt) { H.waitS = w.Status; H.waitAt = Date.now(); }
      N.Synced.forEach(function (s) { if (!s.IsSelf && s.GameState == F.Normal && s.Src && s.Src.status != w.Status) names.push(String(s.Name || s.Uid)); });
    } else H.waitAt = 0;
    var show = !!(w && names.length && Date.now() - H.waitAt > 1500 && !(G.BB4V && BB4V.open));
    if (show) { var t = "Waiting for " + names.join(", "); if (H.waitT.text != t) H.waitT.text = t; }
    if (H.waitGo.activeSelf != show) H.waitGo.SetActive(show);
  }
  // the game's one-teammate hourglass stays off in this mode (busyAndWait does every teammate's).
  // Made from the timer, never while this file runs: this file runs inside the game's own start-up loading (it is
  // added to Core/ActorUtil), and loading a window's code there broke the game's start (0.2.8: the game stayed on
  // the warning screen for testers).
  function busyHook() {
    if (H.busyHooked) return; H.busyHooked = 1;
    try {
      var MP = require("Window/Battle/BattleUITeamBreedMode").default.prototype;
      if (!MP.__bb4busy) { var ub = MP.UpdateTeammateBusy; MP.UpdateTeammateBusy = function () { if (G.BB4F && BB4F.inFight) return; return ub.apply(this, arguments); }; MP.__bb4busy = 1; }
    } catch (e) { log("busy hook: " + B.es(e)); }
  }
  var n = 0;
  H.timer = setInterval(function () {
    try {
      if (++n % 30 == 0) { busyHook(); H.sync(); netStates(); }
      if (n % 12 == 0) busyAndWait();
      placeTags();
      for (var i = 0; i < H.cards.length; i++) { var c = H.cards[i]; c.ph.Update(); if (n % 6 == 0) c.st.Update(); }
    } catch (e) { if (!H.errT || Date.now() - H.errT > 10000) { H.errT = Date.now(); log("tick: " + B.es(e)); } }
  }, 16);
  return "FOURHUD ready";
})();
