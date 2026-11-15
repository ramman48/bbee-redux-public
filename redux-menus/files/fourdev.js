(function () {
  // The dev menu, V4 (Redux menus, the lead 2026-11-03: "Make sure dev menu has a new layout ... make sure they use
  // animated gradients in the final"). dev-testroom's menu (devmenu.js) stays the owner of every row, tab, page, input and
  // the status text; this file only dresses it: a gold console look on the lobby's materials (fourlight.js fxKit), slim
  // row cards with a notch and a lamp for switches, a rail of tab plates, a big header with the breadcrumb under it, a
  // console bar with the status and the pad prompts, and a backdrop with a hex spine. Everything changed is put back on
  // close, and D.setOff(true) shows the plain menu for comparison.
  var cs = CS, G = globalThis, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof, TMP = cs.TMPro, TM = UE.Time;
  function log(m) { try { G.BB4.log("V4DEV", m); } catch (e) { } }
  function es(e) { return G.BB4 && G.BB4.es ? G.BB4.es(e) : String(e); }
  var D = G.BB4DEV = G.BB4DEV || {};
  if (D.timer) { clearInterval(D.timer); D.timer = null; }
  if (D.slow) { clearInterval(D.slow); D.slow = null; }
  var reopen = false;
  if (D.st && D.close) { reopen = true; try { D.close(); } catch (e) { log("reload close: " + es(e)); } }

  var GOLD = [1, 0.82, 0.29], GOLDW = [1, 0.93, 0.66], AMBER = [1, 0.62, 0.18], STEEL = [0.56, 0.66, 0.76], INK = [0.88, 0.94, 0.96],
    DIM = [0.5, 0.6, 0.66], W = [1, 1, 1], PLATE = [0.035, 0.05, 0.07, 0.9], RAIL = [0.025, 0.035, 0.05, 0.86], CARD = [0.06, 0.07, 0.09, 0.86],
    HEXD = [0.06, 0.045, 0.02], DARK = [0.07, 0.055, 0.02];
  var K = null, M, SP, H, washM;
  function V2(x, y) { return new UE.Vector2(x, y); }
  function V3(x, y, z) { return new UE.Vector3(x, y, z == null ? 1 : z); }
  function alive(o) { try { return o && !o.Equals(null); } catch (e) { return false; } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function plain(s) { return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(); }
  function noSize(s) { return String(s || "").replace(/<\/?size[^>]*>/g, ""); }

  function kit() {
    if (K) return true;
    var B = G.BB4UI, L = G.BB4LIT; if (!B || !L || !L.fxKit) return false;
    var ui = null; try { if (alive(B.ui)) ui = B.ui; } catch (e) { }
    try { K = L.fxKit({ ui: ui || B.prefab().transform }); } catch (e) { K = null; }
    if (!K) return false;
    M = K.M; SP = K.SP; H = K.h;
    washM = K.mat("Lb_Glow", "devWash", { Mode: 9, TintRamp: 1, NoisePx: 1100, Speed: 0.04, Distort: 0.5, Occlude: 0.94, GradLo: 0, GradHi: 0.18,
      Period: 11, Width: 0.18, Angle: -20, Band: 0.25, TexMix: 0, Intensity: 1, Flicker: 0 });
    return true;
  }
  function deep(tr, name) {
    if (!alive(tr)) return null; if (tr.name == name) return tr;
    for (var i = 0; i < tr.childCount; i++) { var r = deep(tr.GetChild(i), name); if (r) return r; }
    return null;
  }
  function trOf(o) { try { return o ? o.transform : null; } catch (e) { return null; } }
  function tmpOf(tr) { return alive(tr) ? tr.GetComponent(T(TMP.TMP_Text)) : null; }
  function cg(tr) { return tr.GetComponent(T(UE.CanvasGroup)) || tr.gameObject.AddComponent(T(UE.CanvasGroup)); }
  function pos(rt, x, y) { var p = rt.anchoredPosition; if (Math.abs(p.x - x) + Math.abs(p.y - y) > 0.25) rt.anchoredPosition = V2(x, y); }
  function alpha(g, a) { if (Math.abs(g.alpha - a) > 0.004) g.alpha = a; }
  function setT(t, v) { v = v == null ? "" : String(v); if (t.text != v) t.text = v; }
  function hex(c) { function h2(v) { var s = Math.round(clamp(v, 0, 1) * 255).toString(16); return s.length < 2 ? "0" + s : s; } return "#" + h2(c[0]) + h2(c[1]) + h2(c[2]); }
  var CORN = null;
  // a transform's rect in the root's own units (1080 tall)
  function rectIn(root, tr) {
    if (!CORN) CORN = cs.System.Array.CreateInstance(T(UE.Vector3), 4);
    tr.GetComponent(T(UE.RectTransform)).GetWorldCorners(CORN);
    var a = root.InverseTransformPoint(CORN.GetValue(0)), b = root.InverseTransformPoint(CORN.GetValue(2));
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, w: b.x - a.x, h: b.y - a.y };
  }

  function txt(s, par, name, x, y, w, h, size, c, align, style, piv) {
    var rt = H.node(par, name); if (piv != null) rt.pivot = V2(piv, 0.5); rt.sizeDelta = V2(w, h); rt.anchoredPosition = V2(x, y);
    var t = rt.gameObject.AddComponent(T(TMP.TextMeshProUGUI));
    if (s.font) { t.font = s.font; if (s.fontMat) t.fontSharedMaterial = s.fontMat; }
    t.fontSize = size; t.color = H.col(c); t.enableWordWrapping = false; t.raycastTarget = false; t.richText = true;
    t.overflowMode = TMP.TextOverflowModes.Overflow; t.alignment = align || TMP.TextAlignmentOptions.Left; t.fontStyle = style == null ? 0 : style;
    return t;
  }
  function hideCG(s, tr, list) {
    if (!alive(tr)) return;
    // put back by alpha, never destroyed: a rebuild in the same frame would find the dying group and lose its hide
    var g = cg(tr), a = g.alpha; g.alpha = 0;
    (list || s.undo).push(function () { if (alive(g)) g.alpha = a; });
    return g;
  }
  function hideImg(s, im, list) {
    if (!alive(im)) return; var c = im.color; im.color = new UE.Color(c.r, c.g, c.b, 0);
    (list || s.undo).push(function () { if (alive(im)) im.color = c; });
  }

  // ---- what the dev menu shows now
  function dmWin() { var dm = G.BBTR && G.BBTR.dm; return dm && dm.win; }
  function dd(s) { try { return s.win._dm; } catch (e) { return null; } }
  function contentOf(d) { try { return deep(trOf(d.cur.page), "Content"); } catch (e) { return null; } }
  function sigOf(d) {
    try { return d.tab.id + "|" + d.stack.map(function (q) { return plain(q.title); }).join(">") + "|" + (d.filter || ""); } catch (e) { return ""; }
  }
  function itemText(it) { try { return typeof it.t == "function" ? it.t() : it.t; } catch (e) { return ""; } }
  function tabName(d) {
    try { var L = d.tabs.filter(function (q) { return q.def == d.tab; })[0]; var n = L && tmpOf(deep(trOf(L.e), "Name")); if (n) return plain(n.text); } catch (e) { }
    try { return plain(d.tab.id); } catch (e) { return ""; }
  }

  D.onOpen = function (win) {
    if (D.off) return;
    [0, 80, 400].forEach(function (ms) { setTimeout(function () { try { D.build(win); } catch (e) { log("build: " + es(e)); try { D.close(); } catch (e2) { } } }, ms); });
  };
  D.build = function (win) {
    if (D.off || !G.BBTR || !G.BBTR.dmOpen) return;
    win = win || dmWin(); if (!win || !win._dm || !win._dm.cur) return;
    if (D.st && D.st.win == win && alive(D.st.root)) return;
    if (!kit()) { if (!D.warned) { D.warned = 1; log("no light kit yet: the plain dev menu stays"); } return; }
    var top = trOf(win.CsObj), sa = deep(top, "SafeAreaFitter"), ct = sa && sa.Find("Content"); if (!alive(ct)) return;
    var ctRt = ct.GetComponent(T(UE.RectTransform)); if (!(ctRt.rect.height > 0)) return;
    if (D.st) D.close();
    build(win, ct, ctRt);
  };

  function build(win, ct, ctRt) {
    var d = win._dm, R = win.R, k = ctRt.rect.height / 1080, RW = ctRt.rect.width / k;
    var s = D.st = { win: win, ct: ct, k: k, RW: RW, t0: TM.unscaledTime, wAt: 0, undo: [], cards: {}, ncards: 0, tabs: [], grids: {}, sig: "", pageAt: TM.unscaledTime, frame: -1 };
    s.det = ct.Find("Detail"); s.gmt = ct.Find("GMTitle"); s.rail = ct.Find("Scroll View");
    s.nameBox = s.det && s.det.Find("CurrentNameBgBox"); s.bar = s.det && s.det.Find("ConstBar");
    if (!alive(s.det) || !alive(s.nameBox) || !alive(s.bar)) { D.st = null; log("no Detail / title / status parts: the plain dev menu stays"); return; }
    var ft = tmpOf(trOf(R.CurrentTabTitle)); if (ft) { s.font = ft.font; s.fontMat = ft.fontSharedMaterial; }
    s.title = ft; s.status = tmpOf(trOf(d.status));
    try { s.g = d.group || win.CsObj.GetComponentInChildren(T(cs.GamePlay.InputGroup), true); } catch (e) { s.g = null; }

    // the Detail panel runs past the right edge on wide screens: pull it in
    var dRt = s.det.GetComponent(T(UE.RectTransform)), om = dRt.offsetMax;
    s.undo.push(function () { if (alive(dRt)) dRt.offsetMax = om; });
    var back = s.back = H.node(ct, "V4DevBack"); back.SetAsFirstSibling(); back.sizeDelta = V2(RW, 1080); back.localScale = V3(k, k);
    var root = s.root = H.node(ct, "V4Dev"); root.SetAsLastSibling(); root.sizeDelta = V2(RW, 1080); root.localScale = V3(k, k);
    [back, root].forEach(function (r) { var g = cg(r); g.blocksRaycasts = false; g.interactable = false; g.alpha = 1; });
    s.undo.push(function () { H.kill(back); H.kill(root); });
    var margin = RW >= 2300 ? 128 : 48, P0 = rectIn(root, s.det), over = P0.x1 - (RW / 2 - margin);
    if (over > 1) dRt.offsetMax = V2(om.x - over * k, om.y);
    s.margin = margin;

    // the stock looks we stand in for
    hideCG(s, s.gmt); hideCG(s, s.nameBox); hideCG(s, s.bar);
    // the tab column's list sits off its own scroll view on wide screens (NavigationSnap moves it sideways): keep it centred
    s.nav = deep(trOf(win.CsObj), "NavBox");
    if (alive(s.nav)) { var nRt = s.navRt = s.nav.GetComponent(T(UE.RectTransform)), np = nRt.anchoredPosition; s.undo.push(function () { if (alive(nRt)) nRt.anchoredPosition = V2(np.x, nRt.anchoredPosition.y); }); }
    var cp = trOf(R.CurrentPage); if (cp) { var ci = cp.GetComponent(T(UI.Image)); if (ci) hideImg(s, ci); }
    s.pagesDone = {};

    backdrop(s);
    header(s);
    console_(s);
    dressTabs(s, d);
    onPage(s, true);
    if (!D.timer) D.timer = setInterval(function () { try { tick(); } catch (e) { if (!D.errAt || TM.unscaledTime - D.errAt > 5) { D.errAt = TM.unscaledTime; log("tick: " + es(e)); } } }, 1);
    log("open: RW " + Math.round(RW) + ", Detail right " + Math.round(rectIn(root, s.det).x1) + " (was " + Math.round(P0.x1) + "), tabs " + s.tabs.length);
  }

  // ---- backdrop: the lobby's light in gold, a panel and a rail plate, a hex spine in the margin
  function backdrop(s) {
    var Bk = s.bd = {}, b = s.back, RW = s.RW, P = rectIn(b, s.det), RL = alive(s.rail) ? rectIn(b, s.rail) : null;
    Bk.wash = H.img(b, "Wash", 0, 0, RW + 40, 1120, null, washM, [AMBER[0], AMBER[1], AMBER[2], 0]);
    Bk.hz = H.img(b, "Horizon", 0, -330, RW + 40, 200, "lb_dot", M.soft, H.off(GOLD));
    Bk.shafts = H.shafts(b, GOLD);
    Bk.flash = [[0.2, 360, 1000, 480], [-0.3, 420, 900, 420]].map(function (q, i) { return H.img(b, "Flash" + i, q[0] * RW, q[1], q[2], q[3], "lb_dot", M.flick, H.off(GOLD)); });
    Bk.dust = H.dust(b, GOLD, -RW / 2, -540, RW, 1080, 12, 11);
    // the rail plate behind the tabs
    if (RL) {
      Bk.rail = H.img(b, "RailPlate", RL.cx, P.cy, RL.w + 36, P.h, "lb_btn", null, RAIL, 0, true);
      Bk.railSeam = H.seam(b, "RailSeam", RL.x1 + 14, P.y1 - 20, RL.x1 + 14, P.y0 + 20, 2, M.glow, H.off(GOLD));
      Bk.rx = RL.cx;
    }
    // the panel: a plate, the animated gradient, a light that drifts along it, a gold left edge and corner brackets
    Bk.panel = H.img(b, "Panel", P.cx, P.cy, P.w + 24, P.h + 16, "lb_btn", null, PLATE, 0, true);
    Bk.pGrad = H.img(b, "PanelGrad", P.cx, P.cy, P.w + 24, P.h + 16, "lb_btn", M.grad, [GOLD[0], GOLD[1], GOLD[2], 0.4], 0, true);
    Bk.pFill = H.fill(b, "PanelFill", P.cx, P.cy, P.w + 24, P.h + 16, AMBER);
    Bk.edge = H.seam(b, "Edge", P.x0 + 4, P.y1 - 24, P.x0 + 4, P.y0 + 24, 3, M.glow, H.off(GOLD));
    Bk.corners = [];
    [[P.x0 - 6, P.y1 + 6, 1, -1], [P.x1 + 6, P.y1 + 6, -1, -1], [P.x0 - 6, P.y0 - 6, 1, 1], [P.x1 + 6, P.y0 - 6, -1, 1]].forEach(function (q, i) {
      Bk.corners.push(H.seam(b, "CornerH" + i, q[0], q[1], q[0] + 46 * q[2], q[1], 3, M.glow, H.off(GOLD)));
      Bk.corners.push(H.seam(b, "CornerV" + i, q[0], q[1], q[0], q[1] + 46 * q[3], 3, M.glow, H.off(GOLD)));
    });
    // the console bar's own plate, darker, over the panel
    var C = rectIn(b, s.bar), N = rectIn(b, s.nameBox);
    Bk.con = H.img(b, "ConsolePlate", C.cx, C.cy, C.w, C.h, null, null, [0.015, 0.02, 0.03, 0.72]);
    Bk.strip = H.img(b, "StripPlate", N.cx, N.cy, N.w, N.h, null, null, [0.015, 0.02, 0.03, 0.45]);
    // the hex spine, in whichever margin has room
    var right = s.RW / 2 - P.x1, left = RL ? RL.x0 + s.RW / 2 : 0, sx = right >= 100 ? P.x1 + right / 2 : left >= 100 ? -s.RW / 2 + left / 2 : null;
    Bk.hex = [];
    if (sx != null) for (var i = 0; i < 8; i++) {
      var hx = sx + (i % 2 ? 20 : -20), hy = P.y0 + 60 + i * 96;
      Bk.hex.push({ ring: H.img(b, "HexR" + i, hx, hy, 76, 86, "lb_hex_mask", M.glow, H.off(GOLD)),
        core: H.img(b, "HexC" + i, hx, hy, 68, 77, "lb_hex_mask", null, [HEXD[0], HEXD[1], HEXD[2], 0]), q: i / 7, p: i * 0.8 });
    }
    // header streaks and the floor comet
    Bk.sr = []; for (var j = 0; j < 5; j++) Bk.sr.push({ g: H.img(b, "Str" + j, 0, 0, 150 + (j * 83) % 200, 8 + (j % 3) * 3, "lb_dot", M.line, H.off(GOLD)), y: P.y1 + 30 + j * 22, sp: 6 + (j * 7) % 5, p: j * 0.41 });
    Bk.fc = H.comet(b, "Floor", -RW / 2, P.y0 - 26, RW / 2, P.y0 - 26, 1.2);
  }
  function backAt(s, t, fi) {
    var Bk = s.bd, RW = s.RW;
    H.setC(Bk.wash, AMBER, 0.16 * fi, 0);
    H.lum(Bk.hz, GOLD, fi * (0.14 + 0.04 * Math.sin(t * 0.8)), 0);
    H.shaftsAt(Bk.shafts, t, -RW / 2, RW, 120, fi * 0.8);
    Bk.flash.forEach(function (g, i) { var u = H.pass(t, 4 + i * 2.9, 9 + i * 2.1, 0.6); H.lum(g, GOLD, u < 0 ? 0 : fi * 0.16 * H.bell(u) * (0.55 + 0.45 * (Math.floor(u * 8) % 2)), 0.1); });
    H.dustAt(Bk.dust, t, fi);
    H.fillAt(Bk.pFill, t, 0.3, 0.55 * fi);
    H.lum(Bk.edge, GOLD, fi * (0.55 + 0.2 * Math.sin(t * 1.3)), 0.15);
    Bk.corners.forEach(function (g, i) { H.lum(g, GOLD, fi * (0.6 + 0.25 * Math.sin(t * 1.7 + (i >> 1))), 0.2); });
    if (Bk.railSeam) H.lum(Bk.railSeam, GOLD, fi * 0.4, 0);
    var hw = H.pass(t, 1.0, 7, 1.8), hp = hw < 0 ? -9 : hw * 1.5 - 0.25;
    Bk.hex.forEach(function (x) { var b = Math.max(0, 1 - Math.abs(hp - x.q) / 0.18); H.lum(x.ring, GOLD, fi * (0.08 + 0.04 * Math.sin(t * 0.7 + x.p) + 0.45 * b), b * 0.4); H.setC(x.core, HEXD, 0.75 * fi, 0); });
    var R2 = RW / 2;
    Bk.sr.forEach(function (q) { var u = H.wrap(t / q.sp + q.p, 1); H.moveTo(q.g, R2 - 80 - u * 900, q.y); H.lum(q.g, GOLD, fi * 0.45 * H.bell(u), 0); });
    H.cometAt(Bk.fc, H.pass(t, 2.5, 10, 2.4), GOLDW, fi * 0.8);
  }

  // ---- header (kicker, big title, row counter) over the stock title's place; the breadcrumb strip under it
  function header(s) {
    var r = s.root, P = rectIn(r, s.det), N = rectIn(r, s.nameBox);
    s.P = P; s.N = N;
    s.kHex = H.img(r, "KickHex", P.x0 + 14, P.y1 + 104, 22, 25, "lb_hex_mask", M.glow, H.off(GOLD));
    s.kick = txt(s, r, "Kicker", P.x0 + 36, P.y1 + 104, 900, 34, 24, GOLD, null, 1, 0);
    s.big = txt(s, r, "Title", P.x0 + 4, P.y1 + 48, 1300, 72, 58, INK, null, 1, 0); s.big.characterSpacing = 6;
    s.count = txt(s, r, "Count", P.x1 - 4, P.y1 + 48, 600, 72, 46, GOLD, TMP.TextAlignmentOptions.Right, 1, 1);
    s.hSeam = H.grow(r, "HeadSeam", P.x0, P.y1 + 10, P.x1, P.y1 + 10, 2, M.glow, H.off(GOLD));
    s.hComet = H.comet(r, "HeadComet", P.x0, P.y1 + 10, P.x1, P.y1 + 10, 0.9);
    s.crumb = txt(s, r, "Crumb", N.x0 + 40, N.cy, N.w - 700, 56, 26, INK, null, 0, 0); s.crumb.overflowMode = TMP.TextOverflowModes.Ellipsis;
    s.hint = txt(s, r, "Hint", N.x1 - 30, N.cy, 640, 30, 18, GOLD, TMP.TextAlignmentOptions.Right, 0, 1);
    s.sSeam = H.grow(r, "StripSeam", N.x0 + 30, N.y0 + 2, N.x1 - 30, N.y0 + 2, 2, M.glow, H.off(GOLD));
    s.sComet = H.comet(r, "StripComet", N.x0 + 30, N.y0 + 2, N.x1 - 30, N.y0 + 2, 0.7);
  }
  // ---- the console: the status in two lines, the prompts on the right
  function console_(s) {
    var r = s.root, C = s.C = rectIn(r, s.bar);
    s.cSeam = H.grow(r, "ConsoleSeam", C.x0 + 20, C.y1 - 2, C.x1 - 20, C.y1 - 2, 2, M.glow, H.off(GOLD));
    s.cComet = H.comet(r, "ConsoleComet", C.x0 + 20, C.y1 - 2, C.x1 - 20, C.y1 - 2, 0.8);
    s.l1 = txt(s, r, "Status1", C.x0 + 40, C.cy + 16, C.w - 520, 48, 22, INK, null, 0, 0); s.l1.overflowMode = TMP.TextOverflowModes.Ellipsis;
    s.l2 = txt(s, r, "Status2", C.x0 + 40, C.cy - 20, C.w - 520, 40, 18, DIM, null, 0, 0); s.l2.overflowMode = TMP.TextOverflowModes.Ellipsis;
    s.prompts = [[9, "Select"], [10, "Back"]].map(function (q, i) {
      var n = H.node(r, "Prompt" + i); n.sizeDelta = V2(200, 60); n.anchoredPosition = V2(0, C.cy);
      var gl = H.img(n, "Glyph", -40, 0, 52, 52, null, null, W); gl.preserveAspect = true;
      var kt = txt(s, n, "Key", -40, 0, 52, 52, 22, INK, TMP.TextAlignmentOptions.Center, 1);
      var lb = txt(s, n, "Label", 0, 0, 140, 52, 24, INK, null, 3, 0); setT(lb, q[1]);
      return { id: q[0], n: n, gl: gl, kt: kt, lb: lb, sp: null };
    });
  }
  function prompts(s) {
    var x = s.C.x1 - 36, B = G.BB4UI;
    for (var i = s.prompts.length - 1; i >= 0; i--) {
      var q = s.prompts[i], gl = null; try { gl = B && B.promptGlyph ? B.promptGlyph(q.id) : null; } catch (e) { }
      var sp = gl && gl.sp ? gl.sp : null; if (q.sp !== sp) { q.sp = sp; q.gl.sprite = sp; q.gl.enabled = !!sp; }
      setT(q.kt, sp ? "" : (gl && gl.key) || ""); q.kt.enabled = !sp;
      var lw = Math.ceil(q.lb.preferredWidth) + 8; q.lb.rectTransform.sizeDelta = V2(lw, 52);
      x -= lw; pos(q.lb.rectTransform, x, 0); x -= 34; pos(q.gl.rectTransform, x, 0); pos(q.kt.rectTransform, x, 0); x -= 50;
    }
  }

  // ---- the tab rail: a plate on each tab, the open one lit gold, the selected one with a rim and a sheen
  function dressTabs(s, d) {
    (d.tabs || []).forEach(function (q) {
      var e = trOf(q.e); if (!alive(e)) return;
      var T0 = { q: q, e: e, on: false, at: 0, hid: [] };
      var im = e.GetComponent(T(UI.Image)); if (im) hideImg(s, im, T0.hid);
      for (var i = 0; i < e.childCount; i++) { var c = e.GetChild(i); if (c.name != "Name") hideCG(s, c, T0.hid); }
      var rt = e.GetComponent(T(UE.RectTransform)), kr = s.root.lossyScale.x / e.lossyScale.x, w = rt.rect.width / kr, h = rt.rect.height / kr;
      var v = H.node(e, "V4Tab"); v.SetAsFirstSibling(); v.localScale = V3(kr, kr); v.sizeDelta = V2(w, h);
      T0.v = v; T0.w = w; T0.h = h;
      T0.rim = H.fimg(v, "Rim", SP.lb_btn, M.glow, H.off(GOLDW), 8, 8, true);
      T0.plate = H.fimg(v, "Plate", SP.lb_btn, null, [0.05, 0.06, 0.08, 0.9], -6, -10, true);
      T0.grad = H.fimg(v, "Grad", SP.lb_btn, M.gradBtn, STEEL, -6, -10, true);
      var mk = H.fimg(v, "Mk", SP.lb_btn, null, [1, 1, 1, 1], -6, -10, true); mk.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false;
      T0.sh = H.sheen(mk.rectTransform, "Sh", h * 0.9, H.off(W), [1, 0.95, 0.85, 0]);
      T0.notch = H.img(v, "Notch", -w / 2 + 22, 0, 5, h - 30, null, null, H.off(GOLD));
      T0.hid.push(function () { H.kill(v); });
      s.tabs.push(T0);
    });
    // the group titles: no stock plate, a gold rule and a hex under each
    s.groups = [];
    var nav = deep(trOf(s.win.CsObj), "NavBox");
    if (alive(nav)) for (var i = 0; i < nav.childCount; i++) {
      var box = nav.GetChild(i); if (box.name.indexOf("Dm") != 0 || !box.gameObject.activeSelf) continue;
      var ti = box.Find("Title"); if (!alive(ti)) continue;
      var hid = [], timg = ti.Find("TitleImg"); if (timg) { var im2 = timg.GetComponent(T(UI.Image)); if (im2) hideImg(s, im2, hid); }
      var tsb = ti.Find("TitleSelectBox"); if (tsb) hideCG(s, tsb, hid);
      var rt = ti.GetComponent(T(UE.RectTransform)), kr = s.root.lossyScale.x / ti.lossyScale.x, w = rt.rect.width / kr, h = rt.rect.height / kr;
      var v = H.node(ti, "V4Grp"); v.SetAsFirstSibling(); v.localScale = V3(kr, kr); v.sizeDelta = V2(w, h);
      var G0 = { ti: ti, timg: timg, hid: hid, v: v };
      G0.rule = H.grow(v, "Rule", -w / 2 + 20, -h / 2 + 10, w / 2 - 20, -h / 2 + 10, 2, M.glow, H.off(GOLD));
      G0.hex = H.img(v, "Hex", -w / 2 + 34, 0, 18, 20, "lb_hex_mask", M.glow, H.off(GOLD));
      hid.push(function () { H.kill(v); });
      s.groups.push(G0);
    }
  }
  function tabsAt(s, t, e, fi, cur) {
    var d = dd(s); if (!d) return;
    s.tabs.forEach(function (T0, i) {
      if (!alive(T0.v)) return;
      var sel = !!cur && cur.transform == T0.e, open = T0.q.def == d.tab;
      if (sel && !T0.on) T0.at = t; T0.on = sel;
      var u = H.ease(H.clamp01((e - 0.06 - i * 0.025) / 0.3)), f = sel ? Math.max(0, 1 - (t - T0.at) / 0.3) : 0;
      // the menu writes the open tab's name in gold and the selected one's in white: neither plate is lit gold under it
      var want = sel ? M.gradOn : M.gradBtn; if (T0.grad.material != want) T0.grad.material = want;
      H.setC(T0.grad, sel ? STEEL : open ? GOLD : STEEL, u * (open && !sel ? 0.45 : 1), 0);
      H.setC(T0.plate, [0.05, 0.06, 0.08], 0.9 * u, 0);
      H.lum(T0.rim, GOLDW, sel ? u * 0.9 : 0, f * 0.6);
      H.lum(T0.notch, open ? GOLDW : GOLD, u * (open ? 1 : sel ? 0.6 : 0), 0);
      H.sheenAt(T0.sh, sel ? H.pass(t, T0.at, 2.6, 0.7) : -1, -T0.w / 2 - 60, T0.w + 120, 0, 1);
      pos(T0.v, -24 * (1 - u) + (sel ? 6 * H.eob(H.clamp01((t - T0.at) / 0.22)) : 0), 0);
    });
    s.groups.forEach(function (G0, i) {
      if (!alive(G0.v)) return;
      var sel = !!cur && G0.timg && cur.transform == G0.timg, u = H.clamp01((e - 0.04 - i * 0.05) / 0.4);
      H.drawIn(G0.rule, u); H.lum(G0.rule.g, sel ? GOLDW : GOLD, fi * (sel ? 1 : 0.55), sel ? 0.3 : 0);
      H.lum(G0.hex, GOLD, fi * (sel ? 1 : 0.7), sel ? 0.3 : 0);
    });
  }

  // ---- the rows: taller cells, a card in each, made as rows come into view
  function gridOf(c) { return c ? c.GetComponent(T(UI.GridLayoutGroup)) : null; }
  function fixGrid(s, d, c) {
    var g = gridOf(c); if (!g) return false;
    var id = c.GetInstanceID();
    if (!s.grids[id]) {
      var cs0 = g.cellSize, sp0 = g.spacing; s.grids[id] = { c: c, g: g };
      s.undo.push(function () { if (alive(g)) { g.cellSize = cs0; g.spacing = sp0; } });
    }
    var kr = s.root.lossyScale.x / c.lossyScale.x, ch = Math.round(54 * kr), sy = Math.round(10 * kr);
    var w = 0; try { w = trOf(s.win.R.CurrentPage).GetComponent(T(UE.RectTransform)).rect.width; } catch (e) { }
    var cols = Math.max(1, g.constraintCount || 1), cw = w > 0 ? Math.floor((w - g.padding.left - g.padding.right - (cols - 1) * g.spacing.x) / cols) : g.cellSize.x;
    var changed = Math.abs(g.cellSize.y - ch) > 0.5 || Math.abs(g.cellSize.x - cw) > 0.5 || Math.abs(g.spacing.y - sy) > 0.5;
    if (!changed) return false;
    g.cellSize = V2(cw, ch); g.spacing = V2(g.spacing.x, sy);
    var crt = c.GetComponent(T(UE.RectTransform));
    UI.LayoutRebuilder.ForceRebuildLayoutImmediate(crt);
    var m = metrics(d, c, g); if (crt.rect.height < m.total - 1) crt.SetSizeWithCurrentAnchors(UE.RectTransform.Axis.Vertical, m.total);
    keepInView(d, c, g);
    return true;
  }
  function metrics(d, c, g) {
    var n = 0; try { n = d.cur.items.length; } catch (e) { }
    var cols = Math.max(1, g.constraintCount || 1), rows = Math.ceil(n / cols), rowH = g.cellSize.y + g.spacing.y;
    var vh = c.parent.GetComponent(T(UE.RectTransform)).rect.height;
    return { n: n, cols: cols, rows: rows, rowH: rowH, cell: g.cellSize.y, pad: g.padding.top, vh: vh, total: g.padding.top + rows * rowH - g.spacing.y + g.padding.bottom };
  }
  function keepInView(d, c, g) {
    try {
      var m = metrics(d, c, g), crt = c.GetComponent(T(UE.RectTransform)), y = crt.anchoredPosition.y, max = Math.max(0, m.total - m.vh);
      if (d.zone == "page") {
        var r = Math.floor((d.sel || 0) / m.cols), top = r ? m.pad + r * m.rowH - g.spacing.y : 0, bot = m.pad + r * m.rowH + m.cell + (r == m.rows - 1 ? g.padding.bottom : g.spacing.y);
        if (top < y) y = top; else if (bot > y + m.vh) y = bot - m.vh;
      }
      y = clamp(y, 0, max); crt.anchoredPosition = V2(0, y); if (d.cur) d.cur.y = y;
    } catch (e) { }
  }
  function onPage(s, first) {
    var d = dd(s); if (!d || !d.cur) return;
    var c = contentOf(d); if (!c) return;
    s.c = c;
    var pg = trOf(d.cur.page), pid = pg ? pg.GetInstanceID() : 0;
    if (pg && !s.pagesDone[pid]) { s.pagesDone[pid] = 1; var pim = pg.GetComponent(T(UI.Image)); if (pim) hideImg(s, pim); }
    fixGrid(s, d, c);
    var sig = sigOf(d); if (sig != s.sig) { s.sig = sig; s.pageAt = TM.unscaledTime; }
    for (var id in s.cards) { var C = s.cards[id]; C.dirty = true; }
    s.texts = true;
  }
  D.onPage = function () { var s = D.st; if (s) try { onPage(s); } catch (e) { log("page: " + es(e)); } };
  D.dirty = function () { var s = D.st; if (s) s.texts = true; };

  function makeCard(s, row) {
    var rt = row.GetComponent(T(UE.RectTransform)), kr = s.root.lossyScale.x / row.lossyScale.x, w = rt.rect.width / kr, h = rt.rect.height / kr;
    var C = { row: row, id: row.GetInstanceID(), w: w, h: h, on: false, at: -9, hid: [], dirty: true, kr: kr };
    for (var i = 0; i < row.childCount; i++) { var ch = row.GetChild(i); if (ch.name != "Toggle" && ch.name != "V4Card") hideCG(s, ch, C.hid); }
    var v = C.root = H.node(row, "V4Card"); v.SetAsFirstSibling(); v.localScale = V3(kr, kr); v.sizeDelta = V2(w, h);
    var vis = C.vis = H.node(v, "Vis"); vis.sizeDelta = V2(w, h); C.cg = cg(vis); C.cg.alpha = 0; C.cg.blocksRaycasts = false; C.cg.interactable = false;
    C.rim = H.fimg(vis, "Rim", SP.lb_btn, M.glow, H.off(GOLDW), 8, 8, true);
    C.plate = H.fimg(vis, "Plate", SP.lb_btn, null, CARD, 0, 0, true);
    C.grad = H.fimg(vis, "Grad", SP.lb_btn, M.gradBtn, GOLD, 0, 0, true);
    var mk = H.fimg(vis, "Mk", SP.lb_btn, null, [1, 1, 1, 1], 0, 0, true); mk.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false;
    C.sh = H.sheen(mk.rectTransform, "Sh", h * 0.95, H.off(W), [1, 0.95, 0.85, 0]);
    C.nGlow = H.img(vis, "NotchGlow", -w / 2 + 24, 0, 30, h + 10, "lb_dot", M.glow, H.off(GOLD));
    C.notch = H.img(vis, "Notch", -w / 2 + 24, 0, 5, h - 18, null, null, GOLD);
    C.label = txt(s, vis, "Label", -w / 2 + 46, 0, w - 200, h, 24, INK, null, 0, 0);
    C.label.enableAutoSizing = true; C.label.fontSizeMin = 16; C.label.fontSizeMax = 24; C.label.overflowMode = TMP.TextOverflowModes.Ellipsis;
    C.more = txt(s, vis, "More", w / 2 - 26, 0, 40, h, 26, DIM, TMP.TextAlignmentOptions.Right, 1, 1);
    var lx = w / 2 - 70; C.lamp = H.node(vis, "Lamp"); C.lamp.anchoredPosition = V2(lx, 0);
    C.pill = H.img(C.lamp, "Pill", 0, 0, 104, 34, "lb_btn", null, [0.02, 0.025, 0.03, 0.9], 0, true);
    C.lGlow = H.img(C.lamp, "Glow", -30, 0, 60, 46, "lb_dot", M.glow, H.off(GOLD));
    C.dot = H.img(C.lamp, "Dot", -30, 0, 14, 14, "lb_dot", null, DIM);
    C.lTxt = txt(s, C.lamp, "Txt", 14, 0, 60, 30, 18, DIM, TMP.TextAlignmentOptions.Center, 1);
    C.hid.push(function () { H.kill(v); });
    return C;
  }
  function dropCard(s, C) { for (var i = C.hid.length - 1; i >= 0; i--) try { C.hid[i](); } catch (e) { } delete s.cards[C.id]; s.ncards--; }
  // a row's picture (a Potential's own icon) sits where the stock button has its star, on the right, under the lamp:
  // it moves to the card's left, after the notch, and goes back when the card is dropped
  function iconLeft(C, tg) {
    if (C.icoRt) return;
    var rt = C.icoRt = tg.GetComponent(T(UE.RectTransform)), k = [rt.anchorMin, rt.anchorMax, rt.pivot, rt.sizeDelta, rt.anchoredPosition];
    var c = V2(0, 0.5); rt.anchorMin = c; rt.anchorMax = c; rt.pivot = V2(0.5, 0.5); rt.sizeDelta = V2(44 * C.kr, 44 * C.kr); rt.anchoredPosition = V2(66 * C.kr, 0);
    C.hid.push(function () { if (!alive(rt)) return; rt.anchorMin = k[0]; rt.anchorMax = k[1]; rt.pivot = k[2]; rt.sizeDelta = k[3]; rt.anchoredPosition = k[4]; });
  }
  function cardText(C, it) {
    var raw = noSize(itemText(it)), sw = it && it.on !== undefined;
    if (it && it.sub) raw = raw.replace(/\s*>\s*$/, "");   // the menu's own " >" for a list: the card draws its own on the right
    C.sw = sw; C.isOn = !!(it && it.on);
    setT(C.label, raw);
    var ico = false; try { var tg = C.row.Find("Toggle"); ico = alive(tg) && tg.gameObject.activeSelf; if (ico) iconLeft(C, tg); } catch (e) { }
    pos(C.label.rectTransform, -C.w / 2 + 46 + (ico ? 64 : 0), 0);
    C.label.rectTransform.sizeDelta = V2(C.w - 46 - (ico ? 64 : 0) - (sw ? 170 : it && it.sub ? 70 : 30), C.h);
    setT(C.more, it && it.sub ? ">" : ""); C.lamp.gameObject.SetActive(sw);
    if (sw) setT(C.lTxt, C.isOn ? "ON" : "OFF");
    C.dirty = false; C.done = false;
  }
  function cardAt(C, t, u, lit, view) {
    if (lit && !C.on) C.at = t; C.on = lit;
    var f = lit ? Math.max(0, 1 - (t - C.at) / 0.3) : 0, a = H.ease(u) * view;
    alpha(C.cg, a);
    var want = lit ? M.gradOn : M.gradBtn; if (C.grad.material != want) C.grad.material = want;
    H.setC(C.grad, lit ? GOLD : STEEL, lit ? 1 : 0.7, 0);
    H.lum(C.rim, GOLDW, lit ? 0.85 : 0, f * 0.6);
    H.sheenAt(C.sh, lit ? H.pass(t, C.at, 2.6, 0.7) : -1, -C.w / 2 - 60, C.w + 120, 0, 1);
    H.setC(C.notch, lit ? GOLDW : C.sw && !C.isOn ? DIM : GOLD, lit ? 1 : 0.8, 0);
    H.lum(C.nGlow, GOLD, lit ? 0.6 + 0.3 * f : 0.14, 0.2 * f);
    H.setC(C.label, lit ? DARK : INK, 1, 0);   // dark on the lit gold: pale text on it did not read
    if (C.sw) {
      H.setC(C.dot, C.isOn ? GOLDW : DIM, 1, 0); H.lum(C.lGlow, GOLD, C.isOn ? 0.45 + 0.1 * Math.sin(t * 3) : 0, 0);
      H.setC(C.lTxt, C.isOn ? GOLD : DIM, 1, 0);
    }
    pos(C.vis, -28 * (1 - H.ease(u)) + (lit ? 6 * H.eob(H.clamp01((t - C.at) / 0.22)) : 0), 0);
    C.done = u >= 1 && !lit && !C.on && f == 0;
  }
  function rowsAt(s, t, cur) {
    var d = dd(s), c = s.c; if (!d || !d.cur || !alive(c)) return;
    if (c != contentOf(d)) { onPage(s); c = s.c; }
    var g = gridOf(c); if (!g) return;
    var m = metrics(d, c, g), y = c.GetComponent(T(UE.RectTransform)).anchoredPosition.y, first = Math.floor(Math.max(0, y - m.pad) / m.rowH), made = 0;
    var litName = cur && cur.transform.parent == c ? cur.name : "";
    var n = Math.min(m.n, c.childCount);
    for (var k = 0; k < n; k++) {
      var row = c.GetChild(k); if (!row.gameObject.activeSelf) continue;
      var r = Math.floor(k / m.cols), top = m.pad + r * m.rowH;
      var near = top + m.cell > y - m.rowH * 2 && top < y + m.vh + m.rowH * 2;
      var id = row.GetInstanceID(), C = s.cards[id];
      if (!C) { if (!near || made >= 8) continue; C = s.cards[id] = makeCard(s, row); s.ncards++; made++; }
      else if (!alive(C.root)) { delete s.cards[id]; s.ncards--; continue; }
      var rt = row.GetComponent(T(UE.RectTransform)), w = rt.rect.width / C.kr, h = rt.rect.height / C.kr;
      if (Math.abs(w - C.w) > 1 || Math.abs(h - C.h) > 1) { dropCard(s, C); continue; }
      if (C.dirty || s.texts) { var it = d.cur.items[k]; if (it) cardText(C, it); }
      var out = Math.max(0, y - top, top + m.cell - (y + m.vh)), view = H.clamp01(1 - out / (m.cell * 0.6));
      var u = H.clamp01((t - s.pageAt - 0.04 - Math.max(0, r - first) * 0.022 - (k % m.cols) * 0.012) / 0.26);
      var lit = row.name == litName;
      if (C.done && !lit && Math.abs((C.lv == null ? -1 : C.lv) - view) < 0.002) continue;
      C.lv = view; cardAt(C, t, u, lit, view);
    }
    s.texts = false;
  }

  // ---- every fifth of a second: the texts
  function watch(s, t) {
    var d = dd(s); if (!d) return;
    var dm = G.BBTR.dm, room = !!G.BBTR_ACTIVE;
    setT(s.kick, (dm.title || "DEV MENU").toUpperCase() + "<color=" + hex(DIM) + ">   /   " + (room ? (G.BBTR.arena ? "ARENA" : "TEST ROOM") : "IN A RUN") + "</color>");
    setT(s.big, tabName(d).toUpperCase());
    var n = d.cur ? d.cur.items.length : 0;
    setT(s.count, d.zone == "page" && n ? (Math.min(d.sel || 0, n - 1) + 1 < 10 ? "0" : "") + (Math.min(d.sel || 0, n - 1) + 1) + "<size=55%><color=" + hex(DIM) + ">  /  " + n + "</color></size>" : "<size=55%><color=" + hex(DIM) + ">TABS</color></size>");
    var tt = s.title ? String(s.title.text || "") : "", hi = tt.indexOf("        ["), main = hi >= 0 ? tt.slice(0, hi) : tt, hint = hi >= 0 ? tt.slice(hi).replace(/^\s*\[/, "").replace(/\]\s*$/, "") : "";
    var seg = main.split("   >   ").map(function (x) { return plain(x); });
    setT(s.crumb, seg.length > 1 ? "<color=" + hex(DIM) + ">" + seg.slice(0, -1).join("  /  ") + "  /  </color>" + seg[seg.length - 1] : seg[0]);
    setT(s.hint, hint.toUpperCase());
    var st = s.status ? noSize(String(s.status.text || "")) : "", nl = st.indexOf("\n");
    setT(s.l1, nl >= 0 ? st.slice(0, nl) : st); setT(s.l2, nl >= 0 ? st.slice(nl + 1) : "");
    // the stock parts kept hidden (the menu may re-show them)
    prompts(s);
    var c = contentOf(d); if (c && c != s.c) onPage(s); else if (c) fixGrid(s, d, c);
  }

  function tick() {
    var s = D.st; if (!s) return;
    var f = TM.frameCount; if (s.frame == f) return; s.frame = f;
    if (!alive(s.root) || !G.BBTR || !G.BBTR.dmOpen || dmWin() != s.win) { D.close(); return; }
    UE.Shader.SetGlobalFloat("_FourTimeOffset", TM.unscaledTime - TM.timeSinceLevelLoad);
    var t = TM.unscaledTime, e = t - s.t0;
    if (t - s.wAt > 0.2) { s.wAt = t; watch(s, t); if (D.st != s) return; }
    if (s.navRt) { var np = s.navRt.anchoredPosition; if (Math.abs(np.x) > 0.5) s.navRt.anchoredPosition = V2(0, np.y); }
    var fi = H.ease(e / 0.4), cur = null;
    try { cur = s.g ? s.g.CurrentSelectable : null; if (!alive(cur)) cur = null; } catch (er) { cur = null; }
    backAt(s, t, fi);
    tabsAt(s, t, e, fi, cur);
    rowsAt(s, t, cur);
    // header and strip slide in, the seams draw across, a comet runs each now and then
    var hu = H.ease(H.clamp01((e - 0.05) / 0.35)), P = s.P, N = s.N, C = s.C;
    pos(s.big.rectTransform, P.x0 + 4 - 24 * (1 - hu), P.y1 + 48); H.setC(s.big, INK, hu, 0);
    pos(s.kick.rectTransform, P.x0 + 36 - 24 * (1 - hu), P.y1 + 104); H.setC(s.kick, GOLD, hu, 0); H.lum(s.kHex, GOLD, hu * (0.8 + 0.2 * Math.sin(t * 2)), 0.2);
    H.setC(s.count, GOLD, hu, 0);
    H.drawIn(s.hSeam, H.clamp01((e - 0.1) / 0.6)); H.lum(s.hSeam.g, GOLD, 0.75 * fi, 0.1);
    H.cometAt(s.hComet, H.pass(t, 1.4, 7, 1.1), GOLDW, fi);
    H.drawIn(s.sSeam, H.clamp01((e - 0.18) / 0.6)); H.lum(s.sSeam.g, GOLD, 0.45 * fi, 0);
    H.cometAt(s.sComet, H.pass(t, 3.2, 8.5, 1.2), GOLDW, fi * 0.7);
    var su = H.ease(H.clamp01((e - 0.12) / 0.35));
    pos(s.crumb.rectTransform, N.x0 + 40 - 18 * (1 - su), N.cy); H.setC(s.crumb, INK, su, 0); H.setC(s.hint, GOLD, su * (0.75 + 0.25 * Math.sin(t * 3)), 0);
    var cu = H.ease(H.clamp01((e - 0.2) / 0.35));
    H.drawIn(s.cSeam, cu); H.lum(s.cSeam.g, GOLD, 0.6 * fi, 0.1); H.cometAt(s.cComet, H.pass(t, 2.2, 9.5, 1.3), GOLDW, fi * 0.8);
    pos(s.l1.rectTransform, C.x0 + 40, C.cy + 16 - 14 * (1 - cu)); H.setC(s.l1, INK, cu, 0);
    pos(s.l2.rectTransform, C.x0 + 40, C.cy - 20 - 14 * (1 - cu)); H.setC(s.l2, DIM, cu, 0);
    s.prompts.forEach(function (q) { if (q.gl.enabled) H.setC(q.gl, W, cu, 0); H.setC(q.kt, INK, cu, 0); H.setC(q.lb, INK, cu, 0); });
  }

  D.close = function () {
    var s = D.st; D.st = null; if (D.timer) { clearInterval(D.timer); D.timer = null; } if (!s) return;
    for (var id in s.cards) try { dropCard(s, s.cards[id]); } catch (e) { }
    (s.tabs || []).forEach(function (T0) { for (var i = T0.hid.length - 1; i >= 0; i--) try { T0.hid[i](); } catch (e) { } });
    (s.groups || []).forEach(function (G0) { for (var i = G0.hid.length - 1; i >= 0; i--) try { G0.hid[i](); } catch (e) { } });
    for (var j = s.undo.length - 1; j >= 0; j--) try { s.undo[j](); } catch (e) { log("restore: " + es(e)); }
    try { var d = s.win._dm, c = d && contentOf(d); if (c) { UI.LayoutRebuilder.ForceRebuildLayoutImmediate(c.GetComponent(T(UE.RectTransform))); keepInView(d, c, gridOf(c)); } } catch (e) { }
  };
  D.setOff = function (v) { D.off = !!v; if (D.off) D.close(); else D.build(); return !D.off; };

  // test handles (jsq)
  D.state = function () {
    var s = D.st; if (!s) return { open: false, off: !!D.off, dmOpen: !!(G.BBTR && G.BBTR.dmOpen) };
    var d = dd(s), c = s.c, g = gridOf(c), cur = null; try { cur = s.g.CurrentSelectable; } catch (e) { }
    var active = 0; if (c) for (var i = 0; i < c.childCount; i++) if (c.GetChild(i).gameObject.activeSelf) active++;
    return { open: true, sig: s.sig, rows: active, items: d && d.cur ? d.cur.items.length : 0, cards: s.ncards, tabs: s.tabs.length, groups: s.groups.length,
      zone: d && d.zone, sel: d && d.sel, cur: alive(cur) ? cur.name : "-", cell: g ? Math.round(g.cellSize.x) + "x" + Math.round(g.cellSize.y) : "-",
      RW: Math.round(s.RW), detR: Math.round(rectIn(s.root, s.det).x1), big: s.big.text, crumb: plain(s.crumb.text), count: plain(s.count.text), l1: plain(s.l1.text).slice(0, 80) };
  };
  D.focus = function (k) { var dm = G.BBTR.dm; dm.go(dm.win, "page", k); return true; };
  D.tab = function (k) { var dm = G.BBTR.dm; dm.go(dm.win, "tabs", k); return true; };
  D.nav = function (dx, dy) { var dm = G.BBTR.dm; return dm.nav(dm.win, dx, dy); };

  // the dev menu's own calls, wrapped once on whatever DM object dev-testroom holds now (a reload of devmenu.js makes a new one)
  function hookDM() {
    var dm = G.BBTR && G.BBTR.dm; if (!dm || dm.__v4) return;
    var o = dm.__v4 = { init: dm.init, uninit: dm.uninit, page: dm.page, status: dm.status };
    dm.init = function (win) { var r = o.init.apply(this, arguments); try { G.BB4DEV.onOpen(win); } catch (e) { log("init: " + es(e)); } return r; };
    dm.uninit = function (win) { try { G.BB4DEV.close(); } catch (e) { log("uninit: " + es(e)); } return o.uninit.apply(this, arguments); };
    dm.page = function () { var r = o.page.apply(this, arguments); try { G.BB4DEV.onPage(); } catch (e) { } return r; };
    dm.status = function () { var r = o.status.apply(this, arguments); try { G.BB4DEV.dirty(); } catch (e) { } return r; };
    log("hooked the dev menu");
  }
  D.slow = setInterval(function () {
    try {
      hookDM();
      if (D.st && !(G.BBTR && G.BBTR.dmOpen)) D.close();
      else if (!D.st && !D.off && G.BBTR && G.BBTR.dmOpen && dmWin()) D.build();
    } catch (e) { }
  }, 1000);
  try { hookDM(); if (reopen || (G.BBTR && G.BBTR.dmOpen)) D.build(); } catch (e) { log("late: " + es(e)); }
  log("ready");
})();
