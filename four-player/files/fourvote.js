// Four-player online: room voting for every player. The stock vote screen (TeamBreedUISelectRoom) shows one pair,
// "you" on the left and the first other player on the right, each with the room they point at and a frame that lights
// when they have confirmed. With three or four players the others were missing (testers, 2026-10-17: "it only shows
// 2 of the 4"; Soulve: "gotta make it show 4 people during room selection voting"). This puts more pairs of the
// game's own (the same objects, cloned) under the first, one for each two more players (3 and 4, 5 and 6, ...),
// filled the way the stock pair is.
// Log tag FOURVOTE.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine;
  function log(m) { B.log("FOURVOTE", m); }
  var V = G.BB4V = G.BB4V || {};
  if (V.timer) clearInterval(V.timer);
  var LOADT = Date.now();
  V.GAP = 165;                    // each further pair sits this far under the one above (clear of the teammate's stats)
  // With eight players (BB4.MAX since 2026-10-17) there are three more pairs, with sixteen (BB4.CAP) seven: past
  // V.FIT rows in all the pairs shrink together so the last one stays on the screen (never under V.SMIN).
  V.FIT = 4; V.SMIN = 0.5;
  function NAME(k) { return "BB4Couple" + (k + 2); }
  var Win, Run;
  function mods() { if (!Win) { Win = require("Window/Battle/TeamBreedUISelectRoom").default; Run = require("GamePlay/BattleTeamBreedRun/BattleTeamBreedRun").default; } }
  function q(t, path) { try { return t.Find(path); } catch (e) { return null; } }
  function txt(t) { return t ? t.GetComponent(puerts.$typeof(cs.TMPro.TMP_Text)) : null; }
  function img(t) { return t ? t.GetComponent(puerts.$typeof(UE.UI.Image)) : null; }

  // the copied pair k (players 3 and 4 are pair 0, 5 and 6 pair 1, ...), made once per window object
  function row(w, k) {
    var all = w.__bb4cs = w.__bb4cs || [], have0 = all[k];
    if (have0 && have0.t && !have0.t.Equals(null) && have0.stats) return have0;
    var orig = w.R.SelectStatusCouple.transform, par = orig.parent, have = q(par, NAME(k));
    if (!have) {
      have = UE.Object.Instantiate(orig.gameObject, par).transform; have.name = NAME(k);
      ["SelfWrap/SelfSelectHint", "OtherWrap/OtherSelectHint"].forEach(function (p) { var t = q(have, p); if (t) t.gameObject.SetActive(false); });
      log("vote pair " + (k + 2) + " made");
    }
    // each player of the second pair has the stock stats line (health, revives, flasks, coins): player 4's is the
    // copied one under the right-hand side, player 3's a copy of it under the left-hand side
    var st4 = q(have, "OtherWrap/CharacterStats"), st3 = q(have, "BB4Stats3");
    if (st4 && !st3) {
      st3 = UE.Object.Instantiate(st4.gameObject, have).transform; st3.name = "BB4Stats3";
      var r4 = st4.GetComponent(puerts.$typeof(UE.RectTransform)), r3 = st3.GetComponent(puerts.$typeof(UE.RectTransform));
      var mid = have.InverseTransformPoint(st4.TransformPoint(new UE.Vector3(r4.rect.center.x, r4.rect.center.y, 0)));
      r3.anchorMin = r3.anchorMax = r3.pivot = new UE.Vector2(0.5, 0.5); r3.sizeDelta = r4.rect.size;
      r3.localPosition = new UE.Vector3(-mid.x, mid.y, 0);           // the same place, mirrored to the left side
      // the line's icons sit at its left with empty room after them: mirrored, that room opened a gap next to the
      // name, so the copy moves right by it and ends under the name
      try {
        var last = q(st4, "DpStat").GetComponent(puerts.$typeof(UE.RectTransform));
        var endIcons = have.InverseTransformPoint(last.TransformPoint(new UE.Vector3(last.rect.xMax, 0, 0))).x;
        var endLine = have.InverseTransformPoint(st4.TransformPoint(new UE.Vector3(r4.rect.xMax, 0, 0))).x;
        r3.localPosition = new UE.Vector3(-mid.x + (endLine - endIcons), mid.y, 0);
      } catch (e) {}
    }
    function stats(t) { return t ? { root: t, hp: txt(q(t, "HpStat/HpStatText")), rb: txt(q(t, "RebornStat/RebornStatText")), fl: txt(q(t, "HpRecoverStat/HpRecoverStatText")), dp: txt(q(t, "DpStat/DpStatText")) } : null; }
    var c = {
      t: have, sw: have.GetComponent(puerts.$typeof(cs.NOAH.UI.UIChildrenSwitcher)), stats: [stats(st3), stats(st4)],
      side: [
        { wrap: q(have, "SelfWrap"), status: img(q(have, "SelfWrap/SelfStatus")), glitch: q(have, "SelfWrap/SelfGlitch"), name: txt(q(have, "SelfWrap/SelfNameWrap/SelfNameText")) },
        { wrap: q(have, "OtherWrap"), status: img(q(have, "OtherWrap/TeammateStatus")), glitch: q(have, "OtherWrap/OtherGlitch"), name: txt(q(have, "OtherWrap/OtherNameWrap/OtherNameText")) }
      ]
    };
    return (all[k] = c);
  }
  // keep the copies under the stock pair while the screen's intro moves and fades it
  function follow(w) {
    var o = w.R.SelectStatusCouple.transform, ro = o.GetComponent(puerts.$typeof(UE.RectTransform)), cs_ = w.__bb4cs || [];
    var used = cs_.filter(function (c) { return c && c.n > 0; }).length, sc = Math.max(V.SMIN, Math.min(1, (V.FIT - 1) / Math.max(1, used)));
    cs_.forEach(function (c, k) {
      if (!c || !c.t || c.t.Equals(null)) return;
      var rc = c.t.GetComponent(puerts.$typeof(UE.RectTransform));
      rc.anchoredPosition = new UE.Vector2(ro.anchoredPosition.x, ro.anchoredPosition.y - V.GAP * (1 + k) * sc);
      c.t.localScale = new UE.Vector3(o.localScale.x * sc, o.localScale.y * sc, 1);
      c.t.gameObject.SetActive(o.gameObject.activeInHierarchy && c.n > 0);
    });
  }
  function others(N) { var other = N.OtherStatus; return N.Synced.filter(function (s) { return !s.IsSelf && s !== other; }); }
  V.update = function (w) {
    mods();
    var run = Run.SilentInstance, N = run && run.PlayerNetSt; if (!N || !w || !w.R || !w.R.SelectStatusCouple) return;
    var ex = others(N), pairs = Math.max(Math.ceil(ex.length / 2), (w.__bb4cs || []).length);
    for (var k = 0; k < pairs; k++) fillPair(w, row(w, k), ex.slice(2 * k, 2 * k + 2), k);
    follow(w);
  };
  // one copied pair: ex holds its 0 to 2 players
  function fillPair(w, c, ex, k) {
    var st = 0;
    c.n = ex.length;
    for (var i = 0; i < 2; i++) {
      var s = ex[i], sd = c.side[i];
      if (sd.wrap) sd.wrap.gameObject.SetActive(!!s);
      if (!s) continue;
      if (sd.name) sd.name.text = String(s.Name || ("Player " + (2 * k + i + 3)));
      var icon = s.Src && s.Src.selectRoomIconFullPath ? String(s.Src.selectRoomIconFullPath) : "", picked = !!(s.Src && s.Src.selectRoomConfirm > 0);
      if (sd.glitch) sd.glitch.gameObject.SetActive(!icon);
      if (sd.status) {
        sd.status.gameObject.SetActive(!!icon);
        if (icon) {
          var k = icon.lastIndexOf("/");
          try { sd.status.sprite = w.LoadSprite(icon.substring(0, k), icon.substring(k + 1)); } catch (e) {}
          var small = w.IsSmallRoomIcon(icon); sd.status.rectTransform.sizeDelta = new UE.Vector2(small ? 60 : 80, small ? 60 : 80);
        }
        // the icon comes in with the stock pair's own animation (it starts hidden in the copied state)
        var key = icon + "|" + picked;
        if (sd.last != key) { sd.last = key; try { require("Core/UIUtil").default.PlayTween(sd.status.transform, "In"); } catch (e) {} }
      }
      if (picked) st |= (i == 0 ? 1 : 2);
      fillStats(c.stats[i], s);
    }
    for (var j = ex.length; j < 2; j++) if (c.stats[j]) c.stats[j].root.gameObject.SetActive(false);
    try { if (c.sw) c.sw.SetState(st); } catch (e) {}
  }
  // the stock stats line, for one player: health %, revives, flasks (their fighter), coins (their run status)
  function fillStats(o, s) {
    if (!o) return;
    o.root.gameObject.SetActive(true);
    var p = null; try { var Bt = require("GamePlay/Battle/BattleJs").default.Instance.Battle, L = Bt.GetAllMainPlayers(); for (var i = 0; i < L.Count; i++) { var x = L.get_Item(i); if (String(x.PlayerIDForFS64) == String(s.Uid)) p = x; } } catch (e) {}
    var U = require("Core/Util").U, hp = 0, rb = 0, fl = 0, dp = 0;
    if (p) { try { hp = U.FpToFloat(p.Attr.HP) / U.FpToFloat(p.Attr.MaxHpBaseOri); rb = p.Attr.RebornRemain; fl = p.Attr.HealthFlaskRemainCount; } catch (e) {} }
    try { dp = s.Dungeon && s.Dungeon.resourceInfo ? (s.Dungeon.resourceInfo.count[Number(require("Gen/pbdef").EBreedDungeonResType.Coin)] || 0) : 0; } catch (e) {}
    function put(t, v) { if (t && t.text != v) t.text = v; }
    put(o.hp, (100 * hp).toFixed(0) + "%"); put(o.rb, "X" + rb); put(o.fl, "X" + fl); put(o.dp, String(dp));
  }
  // ---- the vote timer (Soulve, 2026-10-17: "make it so there is a 30 second timer for a vote") ----
  // 30 seconds count down beside the title, the same on every game: the count is in the fight's own frames (every game
  // runs the same frames in step) from the frame when every player in the fight could vote (each one's status says it
  // is choosing a room), not from when this game's screen opened. At zero:
  //   - a player who has not confirmed a room is confirmed for the room with the most confirmed votes (a tie goes to the
  //     host's pick; no votes at all: the room the host points at);
  //   - a player who confirmed a room keeps it; only if the confirmed picks still differ V.SETTLE seconds later does
  //     every player move to the room with the most votes, so the vote cannot stay stuck.
  // Every game works this out from the same shared votes, again every 3 s until the vote closes.
  // (0.2.7 to 0.2.10 timed 30 s by each game's own clock from its own screen and confirmed everyone at zero: testers,
  // 2026-10-17, "never allows all players to choose. Makes the first to choose the location taken as well".)
  V.SECS = 30; V.SETTLE = 10; V.FPS = 60;
  function timerText(w) {
    if (w.__bb4tt && !w.__bb4tt.Equals(null)) return w.__bb4tt;
    var src = w.R.WaitForSelectText; if (!src) return null;
    // a child of the title: it moves and fades with it; the copy keeps neither the title's locale text nor its fade
    var go = UE.Object.Instantiate(src.gameObject, src.transform); go.name = "BB4VoteTimer";
    try { var lc = go.GetComponent(puerts.$typeof(cs.NOAH.UI.UILocale)); if (lc) UE.Object.DestroyImmediate(lc); } catch (e) {}
    try { var cg = go.GetComponent(puerts.$typeof(UE.CanvasGroup)); if (cg) UE.Object.DestroyImmediate(cg); } catch (e) {}
    var t = go.GetComponent(puerts.$typeof(cs.TMPro.TMP_Text)), r = go.GetComponent(puerts.$typeof(UE.RectTransform));
    r.anchorMin = r.anchorMax = new UE.Vector2(1, 0.5); r.pivot = new UE.Vector2(0, 0.5); r.anchoredPosition = new UE.Vector2(28, 0); r.sizeDelta = new UE.Vector2(90, 40);
    t.enableWordWrapping = false; t.alignment = cs.TMPro.TextAlignmentOptions.Left;
    return (w.__bb4tt = go);
  }
  function voters(N) { var F = require("Gen/pbdef").FightExDataGameStateFlag; return N.Synced.filter(function (s) { return s.GameState == F.Normal; }); }
  function majority(N, w) {
    var ps = voters(N), n = {}, best = -1, top = 0;
    ps.forEach(function (s) { if (s.Src && s.Src.selectRoomConfirm > 0 && s.Src.selectRoomIndex >= 0) n[s.Src.selectRoomIndex] = (n[s.Src.selectRoomIndex] || 0) + 1; });
    for (var k in n) if (n[k] > top) top = n[k];
    var host = N.Synced[0] && N.Synced[0].Src, hostPick = host && host.selectRoomConfirm > 0 ? host.selectRoomIndex : -1;
    if (top > 0) { if (hostPick >= 0 && n[hostPick] == top) best = hostPick; else for (var k2 in n) if (n[k2] == top && (best < 0 || +k2 < best)) best = +k2; }
    else best = host && host.selectRoomIndex >= 0 ? host.selectRoomIndex : 0;
    return Math.max(0, Math.min(best, w.roomList.length - 1));
  }
  // force: also a player who confirmed another room (only once the settle time is over)
  function autoPick(w, force) {
    var N = Run.SilentInstance.PlayerNetSt, idx = majority(N, w), r = w.roomList[idx], me = N.MyStatus && N.MyStatus.Src;
    if (me && me.selectRoomConfirm > 0 && (me.selectRoomIndex == idx || !force)) return;
    try { if (w.selectIndex != null && w.roomList[w.selectIndex]) w.roomList[w.selectIndex].SetSelected(false); r.SetSelected(true); w.selectIndex = r.index; } catch (e) {}
    N.SendRoomSelection(r.index, r.room.roomType, true, r.roomIconFullPath);
    log("vote time up: confirmed room " + idx + " for this player" + (force ? " (the picks still differed)" : " (it had not picked)"));
  }
  function frameNow() { try { return require("Core/Util").U.GetSingleton(cs.LockStepManager).m_logicFrame | 0; } catch (e) { return 0; } }
  // the frame when every player in the fight could vote, or 0 while someone cannot yet
  function openFrame(w) {
    if (w.__bb4f0) return w.__bb4f0;
    var N = Run.SilentInstance.PlayerNetSt, S = require("Gen/pbdef").FightExDataBreedStatus.SelectRoom, ps = voters(N);
    if (!ps.length || !ps.every(function (s) { return s.Src && s.Src.status == S; })) return 0;
    var f = frameNow(); if (!f) return 0;
    w.__bb4f0 = f; w.__bb4next = 0; log("everyone can vote from frame " + f + ": " + V.SECS + " s");
    return f;
  }
  function voteTimer(w) {
    var on = !!(G.BB4F && BB4F.inFight) && w.roomList && w.roomList.length > 0;
    var tt = on ? timerText(w) : (w.__bb4tt && !w.__bb4tt.Equals(null) ? w.__bb4tt : null);
    if (!on) { if (tt) tt.SetActive(false); w.__bb4f0 = 0; return; }
    var f0 = openFrame(w), gone = f0 ? Math.max(0, (frameNow() - f0) / V.FPS) : 0, left = Math.max(0, V.SECS - gone);
    if (tt) {
      tt.SetActive(!!f0);
      var t = tt.GetComponent(puerts.$typeof(cs.TMPro.TMP_Text)), s = String(Math.ceil(left));
      if (t.text != s) t.text = s;
      t.color = left <= 10 ? new UE.Color(1, 0.35, 0.3, 1) : UE.Color.white;
    }
    if (f0 && left <= 0 && Date.now() >= (w.__bb4next || 0)) {
      w.__bb4next = Date.now() + 3000;
      try { autoPick(w, gone >= V.SECS + V.SETTLE); } catch (e) { log("vote time up: " + B.es(e)); }
    }
  }
  function hook() {
    mods();
    // wrapped from the game's own function each time this file loads, so a hot load replaces the wrapper
    var P = Win.prototype; if (P.__bb4vote === LOADT) return; P.__bb4vote = LOADT;
    if (!P.__bb4orig) P.__bb4orig = P.UpdateSelectStatus;
    var up = P.__bb4orig;
    // the stock refresh fills the right-hand slot from the last other player it loops over, not the one it names
    // there (OtherStatus): with four players player 2's slot showed player 4's pick. It gets player 2's own.
    P.UpdateSelectStatus = function () {
      var a = Array.prototype.slice.call(arguments);
      try {
        var o = G.BB4F && BB4F.inFight && Run.SilentInstance.PlayerNetSt.OtherStatus;
        if (o && o.Src && a.length >= 4) { a[1] = o.Src.selectRoomConfirm > 0; a[3] = o.Src.selectRoomIconFullPath || null; }
      } catch (e) {}
      var r = up.apply(this, a); try { V.update(this); } catch (e) { log("update: " + B.es(e)); } return r; };
    log("vote screen hooked");
  }
  V.timer = setInterval(function () {
    try {
      hook();
      var UIU = require("Core/UIUtil").default, w = UIU.FindWindow(Win);
      var open = !!(w && w.R && w.R.SelectStatusCouple && (!w.CsObj || w.CsObj.gameObject.activeInHierarchy));
      if (open && !V.open && w) { w.__bb4f0 = 0; w.__bb4next = 0; }   // a vote screen that has just opened counts from its own start
      V.open = open;
      if (open) { if (!w.__bb4cs || !w.__bb4cs.length) V.update(w); else follow(w); voteTimer(w); }
      else if (w && w.__bb4f0) { w.__bb4f0 = 0; if (w.__bb4tt && !w.__bb4tt.Equals(null)) w.__bb4tt.SetActive(false); }
    } catch (e) { if (!V.errT || Date.now() - V.errT > 10000) { V.errT = Date.now(); log("tick: " + B.es(e)); } }
  }, 50);
  return "FOURVOTE ready";
})();
