// Redux Menus: the hero step as a list (testers, 2026-11-07: "a list view like the Tactics one for quicker hero
// selection"). Y on a pad, L on a keyboard switches the select's grid of heads to one list of every hero from every group,
// eight rows at a time: the head, the name, the group in its colour and the lock or DLC state, the card on the left still
// showing the hero under the cursor. Up and down step a row, left and right a page, LB / RB (Q / E) change the order (the
// game's group order, by name, owned first). Rows point and click. The choice of grid or list and the order are kept in
// the menus' settings (BB4.opt heroView / heroSort). fourlobbyui.js builds it once (build), draws it from drawSel and hands
// it the hero step's moves while it is on; every pick still goes through the select's own confirm, locks and DLC checks.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof;
  var HL = G.BB4HL = G.BB4HL || {};
  function log(m) { B.log("FOURUI", "hero list: " + m); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function V2(x, y) { return new UE.Vector2(x, y); }
  function hex(c) { return c.slice(0, 3).map(function (v) { var s = Math.round(clamp(v, 0, 1) * 255).toString(16); return s.length < 2 ? "0" + s : s; }).join(""); }
  // where the grid stands (fourlobbyui.js SEL_X / SEL_Y, its 6 x 3 cells of 170 x 150): the list takes the same place
  var ROWS = 8, ROW_H = 56, ROW_W = 960, LIST_X = 415, LIST_TOP = 196;
  var SORTS = [["game", "Group order"], ["name", "By name"], ["owned", "Owned first"]];
  var INK = [0.1, 0.08, 0.12], DIMC = [0.72, 0.7, 0.8], GOLD = [1, 0.82, 0.48], RED = [1, 0.42, 0.4];

  function mode() { try { return B.opt("heroView") == "list" ? "list" : "grid"; } catch (e) { return "grid"; } }
  function sortKey() { var s = "game"; try { s = B.opt("heroSort") || "game"; } catch (e) {} return SORTS.some(function (q) { return q[0] == s; }) ? s : "game"; }
  function sortName(k) { var n = SORTS[0][1]; SORTS.forEach(function (q) { if (q[0] == k) n = q[1]; }); return n; }
  // under the v5 select the list is a mode of that screen (fourselect5.js): this older list stays out of the way
  function v5(S) { try { return !!(G.BB4S5 && G.BB4S5.on && G.BB4S5.on(S)); } catch (e) { return false; } }
  HL.on = function (S) { if (v5(S)) return false; var p = S && S.pick; return !!(HL.Z && S.solo && p && p.step == "hero" && !p.partner && mode() == "list"); };

  HL.build = function (S, Z, H) {
    HL.H = H; HL.S = S;
    var root = H.node(Z.root, "HeroList"); root.anchorMin = root.anchorMax = V2(0.5, 0.5); root.sizeDelta = V2(ROW_W, ROWS * ROW_H); root.anchoredPosition = V2(0, 0);
    var L = { root: root, rows: [], top: 0 };
    for (var i = 0; i < ROWS; i++) {
      var b = H.button(root, "HRow" + i); b.rt.sizeDelta = V2(ROW_W, ROW_H - 6); b.rt.anchoredPosition = V2(LIST_X, LIST_TOP - i * ROW_H);
      var tr = b.t.rectTransform; tr.anchorMin = UE.Vector2.zero; tr.anchorMax = UE.Vector2.one; tr.offsetMin = V2(84, 0); tr.offsetMax = V2(-300, 0);
      b.t.alignment = cs.TMPro.TextAlignmentOptions.Left; b.t.fontSize = 28; b.t.enableAutoSizing = true; b.t.fontSizeMax = 28; b.t.fontSizeMin = 18; b.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
      var hn = H.node(b.rt, "Head"); hn.anchorMin = hn.anchorMax = V2(0, 0.5); hn.sizeDelta = V2(46, 46); hn.anchoredPosition = V2(46, 0);
      var hd = hn.gameObject.AddComponent(T(UI.Image)); hd.preserveAspect = true; hd.raycastTarget = false;
      var pn = H.node(b.rt, "Port"); pn.anchorMin = pn.anchorMax = V2(0, 0.5); pn.sizeDelta = V2(46, 46); pn.anchoredPosition = V2(46, 0);
      var po = pn.gameObject.AddComponent(T(UI.RawImage)); po.raycastTarget = false; pn.gameObject.SetActive(false);
      var gn = H.node(b.rt, "T_HGroup"); gn.anchorMin = gn.anchorMax = V2(1, 0.5); gn.pivot = V2(1, 0.5); gn.sizeDelta = V2(280, ROW_H - 10); gn.anchoredPosition = V2(-20, 0);
      var gt = H.txt(b.rt, "T_HGroup", 22, [1, 1, 1], cs.TMPro.TextAlignmentOptions.Right, 1); gt.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
      L.rows.push({ b: b, head: hd, port: po, g: gt, id: null, key: null });
    }
    L.rail = H.rail(root, "HRail", LIST_X + ROW_W / 2 + 24, LIST_TOP - (ROWS - 1) * ROW_H / 2, ROWS * ROW_H);
    root.gameObject.SetActive(false);
    HL.Z = L; Z.hl = L;
  };

  // every hero of the step's groups, in the chosen order
  function fullList(p, key) {
    var H = HL.H, tabs = p.tabs || [], out = [], gi = {}, gpos = {};
    tabs.forEach(function (tb, g) { tb.ids.forEach(function (id, k) { if (gi[id] == null) { gi[id] = g; gpos[id] = out.length; out.push(id); } }); });
    if (key == "name") out.sort(function (a, b) { var x = H.heroLabelOf(a).toLowerCase(), y = H.heroLabelOf(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : gpos[a] - gpos[b]; });
    else if (key == "owned") out.sort(function (a, b) { var la = H.lockOf(a), lb = H.lockOf(b), oa = la && la.locked ? 1 : 0, ob = lb && lb.locked ? 1 : 0; return oa - ob || gpos[a] - gpos[b]; });
    HL.gi = gi;
    return out;
  }
  // the step's list becomes the full list (or the hero's group again for the grid), the cursor staying on its hero
  function apply(S, on, want) {
    var p = S.pick; if (!p || !p.tabs) return;
    var hero = want || (p.list && p.list[p.i]); p.chg = null;
    if (on) { var l = fullList(p, sortKey()); p.list = l; p.hl = l; p.i = Math.max(0, l.indexOf(hero)); }
    else {
      var t = p.tab || 0; p.tabs.forEach(function (tb, g) { if (tb.ids.indexOf(hero) >= 0) t = g; });
      p.tab = t; p.list = p.tabs[t].ids; p.i = Math.max(0, p.list.indexOf(hero)); p.hl = null;
      if (S.sel) S.sel.top = Math.floor(p.i / 6);
    }
  }
  HL.toggle = function (S) {
    if (v5(S)) { B.setOpt("heroView", mode() != "list" ? "list" : "grid"); if (G.BB4SEL && G.BB4SEL.sfx) G.BB4SEL.sfx("sfx_ui_51"); return; }
    var on = mode() != "list"; B.setOpt("heroView", on ? "list" : "grid");
    apply(S, on); if (S.sel) S.sel.backKey = null;
    if (G.BB4SEL && G.BB4SEL.sfx) G.BB4SEL.sfx("sfx_ui_51");
    log(on ? "list, " + sortName(sortKey()) : "grid");
  };
  HL.page = function (S, d) {
    var i = 0, k = sortKey(); SORTS.forEach(function (q, j) { if (q[0] == k) i = j; });
    var nk = SORTS[(i + d + SORTS.length) % SORTS.length][0]; B.setOpt("heroSort", nk);
    apply(S, true); if (G.BB4SEL && G.BB4SEL.sfx) G.BB4SEL.sfx("sfx_ui_51");
  };
  HL.move = function (S, dx, dy) {
    var p = S.pick, n = p.list.length; if (!n) return;
    var j = dy ? (p.i - dy + n) % n : clamp(p.i + dx * ROWS, 0, n - 1);
    if (j != p.i && G.BB4SEL && G.BB4SEL.sfx) G.BB4SEL.sfx("sfx_ui_51"); p.i = j;
  };
  // the mouse: a row points and chooses (confirm runs the select's own checks); the wheel steps
  HL.mouse = function (S, mp, click, wheel, moved, over, confirm) {
    var L = HL.Z, p = S.pick;
    if (wheel) HL.move(S, 0, wheel > 0 ? 1 : -1);
    if (!moved && !click) return false;
    var hit = -1; L.rows.forEach(function (r, k) { if (hit < 0 && r.b.rt.gameObject.activeSelf && over(r.b.rt, mp)) hit = L.top + k; });
    if (hit < 0) return false;
    if (hit != p.i) { p.i = hit; if (G.BB4SEL && G.BB4SEL.sfx) G.BB4SEL.sfx("sfx_ui_51"); }
    if (click) confirm();
    return true;
  };

  // drawn from drawSel each frame while the hero step shows
  HL.draw = function (S, Z, t) {
    var L = HL.Z; if (!L) return false;
    var on = HL.on(S), p = S.pick;
    if (L.root.gameObject.activeSelf != on) L.root.gameObject.SetActive(on);
    if (Z.grid.gameObject.activeSelf == on) Z.grid.gameObject.SetActive(!on);
    if (!on) { if (p && p.hl && p.list === p.hl) apply(S, false); return false; }
    if (p.list !== p.hl) apply(S, true, p.list === (p.tabs[p.tab] || {}).ids && p.list.indexOf(p.hero) < 0 ? p.hero : null);   // the step came back (from Legacy I, a panel): the list again, on the hero picked
    var H = HL.H, l = p.list, n = l.length, X = G.BB4SEL;
    if (p.i < L.top) L.top = p.i; if (p.i > L.top + ROWS - 1) L.top = p.i - ROWS + 1; L.top = clamp(L.top, 0, Math.max(0, n - ROWS));
    H.railSet(L.rail, L.top, n, ROWS);
    var groups = X && X.GROUPS ? X.GROUPS : [];
    L.rows.forEach(function (r, k) {
      var j = L.top + k, show = j < n; if (r.b.rt.gameObject.activeSelf != show) r.b.rt.gameObject.SetActive(show); if (!show) return;
      var id = l[j], foc = j == p.i, lk = H.lockOf(id), locked = !!(lk && lk.locked);
      H.lightBtn(r.b, foc, false);
      if (foc) r.b.on.color = H.col(Z.k.colour || [0.9, 0.3, 0.4], 0.85);
      var key = id + "|" + foc + "|" + locked + "|" + (lk && lk.dlc) + "|" + (id == p.was);
      if (r.key === key) return; r.key = key;
      if (r.id !== id) {
        r.id = id; var sp = H.headSprite(id), tex = sp ? null : H.heroTexture(id, H.skinOf(id));
        r.head.sprite = sp; r.head.gameObject.SetActive(!!sp); r.port.gameObject.SetActive(!!tex);
        if (tex) { var m = H.measure(tex), s = 0.4, hv = s * tex.width / tex.height; r.port.texture = tex; r.port.uvRect = new UE.Rect(clamp(m.cx - s / 2, 0, 1 - s), clamp(1 - m.top - hv + 0.01, 0, 1 - hv), s, hv); }
      }
      var hc = locked ? new UE.Color(0.42, 0.4, 0.48, 1) : new UE.Color(1, 1, 1, 1); r.head.color = hc; r.port.color = hc;
      var g = groups[X && X.groupOf ? X.groupOf(id) : 0] || { label: "", col: [1, 1, 1] };
      r.b.t.text = "<color=#" + hex(foc ? INK : locked ? DIMC : [1, 1, 1]) + ">" + H.heroLabelOf(id) + "</color>" +
        (id == p.was ? "   <size=70%><color=#" + hex(foc ? [0.3, 0.2, 0.04] : GOLD) + ">PLAYING NOW</color></size>" : "");
      var st = locked ? (lk.dlc ? "DLC" : lk.can ? "READY TO UNLOCK" : "LOCKED") : "";
      r.g.text = (st ? "<color=#" + hex(foc ? [0.5, 0.2, 0.04] : lk.dlc ? GOLD : RED) + ">" + st + "</color>   " : "") +
        "<color=#" + hex(foc ? INK : g.col) + ">" + (g.label || "") + "</color>";
    });
    var owned = l.filter(function (x) { var q = H.lockOf(x); return !(q && q.locked); }).length;
    Z.sub.text = "Every hero   ·   " + (p.i + 1) + " / " + n + (owned < n ? "   ·   " + owned + " owned" : "") + "   ·   " + sortName(sortKey());
    return true;
  };
  HL.sortName = function () { return sortName(sortKey()); };
  log("ready");
})();
