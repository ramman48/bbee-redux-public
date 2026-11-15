// Redux Menus: the Colours step of the character select in the v5 select's language (the lead, 2026-11-11, on the
// mockup local_only/redux/v4shots/colours5/mock_1920.png: "Yes, build it"). The game's wardrobe still runs underneath
// (fourselect.js X.colours: the hero in the room, every colour, the palette maker's colours, the save) and
// fourselpanels.js keeps the logic (open, wear, refuse, close). This file draws it with the select's kit (fourselect5.js,
// V.K): every colour as a tile on the left, the hero in the room in the middle with the camera brought closer, the
// focused colour's sheet on the right. Q / E step the filter tabs; X shows what is worn now and goes back.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, TMP = cs.TMPro, T = puerts.$typeof;
  var V = G.BB4C5 = {};
  var W = [1, 1, 1], INK = [0.9, 0.92, 0.96], DIM = [0.56, 0.58, 0.66], GOLD = [1, 0.82, 0.48], RED = [1, 0.42, 0.4], HUE = [0.86, 0.2, 0.32], DARK = [0.03, 0.02, 0.03];
  var NCHIP = 5, GAP = 10, FOV = 11;
  function log(m) { try { B.log("FOURUI", "Colours v5: " + m); } catch (e) {} }
  function K() { return G.BB4S5 && G.BB4S5.K; }
  function hex(c) { return c.slice(0, 3).map(function (v) { var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return s.length < 2 ? "0" + s : s; }).join(""); }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  V.on = function (S) { try { return V.enabled !== false && !!K() && !!(G.BB4S5.on && G.BB4S5.on(S)); } catch (e) { return false; } };

  // the filter tabs: every colour, the ones owned, the ones that change the hero's effects, the palette maker's own
  var TABS = [
    { n: "ALL", f: function () { return true; } },
    { n: "OWNED", f: function (A, j) { return !!A.colInfo(j).owned; } },
    { n: "EFFECTS", f: function (A, j) { return !!A.fxOf(j); } },
    { n: "MADE", f: function (A, j, c) { return !!(c.n[j].cfg && c.n[j].cfg.__pal); } }
  ];
  function viewOf(st, A, c) {
    var key = st.tab + ":" + c.n.length; if (st.viewKey === key) return st.view;
    var v = []; for (var j = 0; j < c.n.length; j++) if (TABS[st.tab].f(A, j, c)) v.push(j);
    st.viewKey = key; st.view = v; return v;
  }
  function tabCount(st, A, c, q) { var n = 0; for (var j = 0; j < c.n.length; j++) if (TABS[q].f(A, j, c)) n++; return n; }

  // built again at every open: the tiles are as tall as the hero's number of colours allows (four rows of tall tiles
  // for eight colours, six rows of short ones, scrolling, for more than twelve)
  function build(P, n) {
    var k = K(), node = k.node, plate = k.plate, label = k.label, V2 = k.V2, clamp = k.clamp;
    var TH = clamp(Math.floor((818 + GAP) / clamp(Math.ceil(n / 2), 4, 6)) - GAP, 124, 196);
    var RW = G.BB4_TESTW || UE.Screen.width * 1080 / Math.max(1, UE.Screen.height), LW = clamp(Math.round(RW * 0.27), 500, 640), RWd = LW, PAD = 26, lw = LW - 2 * PAD, rw = RWd - 2 * PAD;
    var root = node(P.ui, "Colours5", 0, 0); root.anchorMin = UE.Vector2.zero; root.anchorMax = UE.Vector2.one; root.sizeDelta = UE.Vector2.zero; root.anchoredPosition = UE.Vector2.zero;
    var st = V.st = { root: root, RW: RW, LW: LW, lw: lw, RWd: RWd, rw: rw, tab: 0, top: 0, tiles: [], tabs: [], chips: [], rail: [], worn: [], mine: [] };
    st.cg = root.gameObject.AddComponent(T(UE.CanvasGroup)); st.cg.alpha = 0; st.cg.blocksRaycasts = false; st.cg.interactable = false;
    function flat(par, name, x, y, w, h, c) { var p = plate(par, name, x, y, w, h, { fill: c || W, alpha: 1, line: W, lineA: 0.28, lineW: 1, weave: 0, lit: 0 }); p.__m.SetFloat("_Rim", 0); return p; }
    function head(par, x, y, s) { var h = label(par, "H_" + s.replace(/\W/g, ""), x + 150, y, 300, 28, 20, W, null, "display"); h.characterSpacing = 4; k.setT(h, s); return h; }
    function box(par, name, top, bot, w) { return plate(par, name, 0, (top + bot) / 2, w + 36, top - bot, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.93 }); }

    // ---- the stage: the room shows through; the colour's name and strip stand above the hero
    var cx = (LW - RWd) / 2, cwid = RW - LW - RWd; st.cx = cx; st.cwid = cwid;
    var sg = st.sg = node(root, "Stage", cx, 0, cwid, 1080);
    // a curtain over the room while the camera goes to the hero and the hero's picture is taken in each colour
    st.veil = plate(sg, "Veil", 0, 0, cwid - 6, 1080, { fill: [0.02, 0.012, 0.02], alpha: 1, lineA: 0, weave: 0, lit: 0 }); st.veil.__m.SetFloat("_Rim", 0);
    st.veilT = label(sg, "VeilT", 0, 10, cwid - 80, 40, 24, DIM, TMP.TextAlignmentOptions.Center, "display"); st.veilT.characterSpacing = 6;
    st.veilN = label(sg, "VeilN", 0, -30, cwid - 80, 30, 19, DIM, TMP.TextAlignmentOptions.Center, "body");
    st.sP = plate(sg, "NamePlate", 0, 462, Math.min(cwid - 60, 620), 104, { cut: [14, 0, 14, 0], alpha: 0.86 });
    st.sName = label(sg, "Name", 0, 484, Math.min(cwid - 100, 580), 40, 28, W, TMP.TextAlignmentOptions.Center, "display"); st.sName.characterSpacing = 3; st.sName.richText = true;
    st.sName.enableAutoSizing = true; st.sName.fontSizeMin = 16; st.sName.fontSizeMax = 28;
    var rbw = Math.min(96, (Math.min(cwid - 100, 560) - 4 * 6) / NCHIP);
    for (var r0 = 0; r0 < NCHIP; r0++) st.rail.push(flat(sg, "Rail" + r0, (r0 - (NCHIP - 1) / 2) * (rbw + 6), 440, rbw, 20));
    st.edges = [-1, 1].map(function (d, q) { var e = plate(sg, "Edge" + q, d * (cwid / 2 - 3), 0, 3, 1080, { fill: W, alpha: 0.55, lineA: 0, weave: 0, lit: 0 }); e.__m.SetFloat("_Rim", 0); return e; });
    st.wearing = label(sg, "Wearing", -cwid / 2 + 30 + 300, -488, 600, 30, 19, DIM, null, "body"); st.wearing.richText = true; st.wearing.characterSpacing = 2;

    // ---- left: the header, the filter tabs, the tiles, the hero's line
    var lp = st.lp = node(root, "Left", -RW / 2 + LW / 2, 0, LW, 1080);
    plate(lp, "Panel", -12, 0, LW + 24, 1128, { alpha: 0.95 });
    head(lp, -lw / 2, 498, "// COLOURS");
    st.owned = label(lp, "Owned", 0, 498, lw, 28, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    var tw = (lw - 3 * 8) / 4;
    TABS.forEach(function (tb, q) {
      var x = -lw / 2 + tw / 2 + q * (tw + 8), p = plate(lp, "Tab" + q, x, 442, tw, 44, { cut: [9, 0, 9, 0], alpha: 0.92 });
      var t = label(lp, "TabT" + q, x, 442, tw, 36, 17, INK, TMP.TextAlignmentOptions.Center, "display"); t.characterSpacing = 2; k.setT(t, tb.n);
      st.tabs.push({ p: p, t: t });
    });
    var gy0 = 400, gbot = -418, tw2 = (lw - GAP) / 2; st.rv = Math.max(2, Math.floor((gy0 - gbot + GAP) / (TH + GAP))); st.tw2 = tw2;
    for (var q2 = 0; q2 < st.rv * 2; q2++) {
      var col = q2 % 2, row = Math.floor(q2 / 2), tx = -lw / 2 + tw2 / 2 + col * (tw2 + GAP), ty = gy0 - TH / 2 - row * (TH + GAP);
      var rt = node(lp, "Tile" + q2, tx, ty, tw2, TH), o = { rt: rt, x: tx, y: ty, key: null, f: 0, bars: [] };
      o.g = rt.gameObject.AddComponent(T(UE.CanvasGroup));
      o.p = plate(rt, "P", 0, 0, tw2, TH, { cut: [10, 0, 10, 0], alpha: 0.92, weave: 0.04 });
      var bw = (tw2 - 28 - (NCHIP - 1) * 4) / NCHIP;
      var bh = TH - 72;
      for (var b0 = 0; b0 < NCHIP; b0++) o.bars.push(flat(rt, "Bar" + b0, -tw2 / 2 + 14 + bw / 2 + b0 * (bw + 4), TH / 2 - 14 - bh / 2, bw, bh));
      // once the hero's picture in this colour is taken it stands in place of the tall bars, with the bars as a strip under it
      var pw = tw2 - 28, ph = bh - 16; o.pw = pw; o.ph = ph; st.pw = pw; st.ph = ph;
      o.bust = node(rt, "Bust", 0, TH / 2 - 14 - ph / 2, pw, ph).gameObject.AddComponent(T(UI.RawImage)); o.bust.raycastTarget = false; o.bust.gameObject.SetActive(false);
      o.strip = []; for (var s1 = 0; s1 < NCHIP; s1++) { var sp = flat(rt, "Strip" + s1, -tw2 / 2 + 14 + bw / 2 + s1 * (bw + 4), TH / 2 - 14 - bh + 5, bw, 10); sp.gameObject.SetActive(false); o.strip.push(sp); }
      o.name = label(rt, "Name", -6, -TH / 2 + 26, tw2 - 52, 30, 20, INK, null, "body"); o.name.richText = true; o.name.overflowMode = TMP.TextOverflowModes.Ellipsis;
      o.name.enableAutoSizing = true; o.name.fontSizeMin = 14; o.name.fontSizeMax = 20;   // on a 16:9 screen's narrower tiles the longer names were cut
      o.fx = plate(rt, "Fx", tw2 / 2 - 22, -TH / 2 + 26, 13, 13, { fill: W, alpha: 1, line: W, lineA: 0.9, lineW: 1.5, weave: 0, lit: 0 }); o.fx.__m.SetFloat("_Rim", 0); o.fx.rectTransform.localEulerAngles = new UE.Vector3(0, 0, 45);
      o.tagP = plate(rt, "TagP", tw2 / 2 - 14 - 48, TH / 2 - 14 - 12, 96, 24, { fill: DARK, alpha: 0.9, lineA: 0.6, lineW: 1, weave: 0, lit: 0 });
      o.tag = label(rt, "Tag", tw2 / 2 - 14 - 48, TH / 2 - 14 - 12, 96, 22, 13, INK, TMP.TextAlignmentOptions.Center, "display"); o.tag.characterSpacing = 2;
      o.under = plate(rt, "Under", 0, -TH / 2 + 3, tw2 - 24, 4, { fill: W, alpha: 1, lineA: 0, weave: 0, lit: 0 }); o.under.__m.SetFloat("_Rim", 0);
      st.tiles.push(o);
    }
    st.more = label(lp, "More", 0, gbot - 14, lw, 24, 17, DIM, TMP.TextAlignmentOptions.Center, "body");
    plate(lp, "Foot", 0, -486, lw + 36, 76, { cut: [12, 0, 12, 0], alpha: 0.93 });
    st.footH = label(lp, "FootH", 0, -470, lw, 26, 17, W, null, "display"); st.footH.characterSpacing = 4;
    st.footT = label(lp, "FootT", 0, -500, lw, 28, 19, DIM, null, "body"); st.footT.richText = true; st.footT.overflowMode = TMP.TextOverflowModes.Ellipsis;

    // ---- right: the focused colour's sheet
    var rp = st.rp = node(root, "Sheet", RW / 2 - RWd / 2, 0, RWd, 1080);
    plate(rp, "Panel", 12, 0, RWd + 24, 1128, { alpha: 0.95 });
    box(rp, "NodeName", 522, 336, rw);
    head(rp, -rw / 2, 498, "// COLOUR");
    st.count = label(rp, "Count", 0, 498, rw, 28, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    st.name = label(rp, "Name", 0, 428, rw, 84, 58, W, null, "display"); st.name.enableAutoSizing = true; st.name.fontSizeMin = 24; st.name.fontSizeMax = 58; st.name.fontStyle = 2;
    st.hero = label(rp, "Hero", -rw / 4, 362, rw / 2, 32, 22, INK, null, "body");
    st.state = label(rp, "State", rw / 4, 362, rw / 2, 32, 22, GOLD, TMP.TextAlignmentOptions.Right, "display"); st.state.characterSpacing = 2;
    box(rp, "NodePal", 322, 168, rw);
    head(rp, -rw / 2, 298, "// PALETTE");
    var cw = (rw - (NCHIP - 1) * 10) / NCHIP;
    for (var c0 = 0; c0 < NCHIP; c0++) {
      var cxp = -rw / 2 + cw / 2 + c0 * (cw + 10), fr = plate(rp, "ChipF" + c0, cxp, 228, cw, 82, { fill: DARK, alpha: 1, lineA: 0.5, lineW: 1, cut: [8, 0, 8, 0], weave: 0, lit: 0 });
      st.chips.push({ fr: fr, c: flat(rp, "Chip" + c0, cxp, 228, cw - 10, 72) });
    }
    box(rp, "NodeFx", 154, 52, rw);
    head(rp, -rw / 2, 130, "// EFFECTS");
    st.fxD = plate(rp, "FxD", -rw / 2 + 18, 88, 20, 20, { fill: W, alpha: 1, line: W, lineA: 0.9, lineW: 2, weave: 0, lit: 0 }); st.fxD.__m.SetFloat("_Rim", 0); st.fxD.rectTransform.localEulerAngles = new UE.Vector3(0, 0, 45);
    st.fxT = label(rp, "FxT", 26, 88, rw - 52, 30, 20, INK, null, "body"); st.fxT.enableAutoSizing = true; st.fxT.fontSizeMin = 14; st.fxT.fontSizeMax = 20;
    box(rp, "NodeVs", 38, -92, rw);
    head(rp, -rw / 2, 14, "// BESIDE WHAT YOU WEAR");
    var sw = (rw * 0.46 - (NCHIP - 1) * 4) / NCHIP;
    st.vsT = [0, 1].map(function (z) { var t = label(rp, "VsT" + z, -rw / 4 - 6, -30 - z * 34, rw / 2 - 12, 28, 18, z ? INK : DIM, null, "body"); t.overflowMode = TMP.TextOverflowModes.Ellipsis; return t; });
    for (var s0 = 0; s0 < NCHIP; s0++) { var sx = rw / 2 - rw * 0.46 + sw / 2 + s0 * (sw + 4); st.worn.push(flat(rp, "Worn" + s0, sx, -30, sw, 18)); st.mine.push(flat(rp, "Mine" + s0, sx, -64, sw, 18)); }
    box(rp, "NodeInfo", -106, -214, rw);
    st.info = label(rp, "Info", 0, -160, rw, 84, 20, INK, TMP.TextAlignmentOptions.Left, "body"); st.info.enableWordWrapping = true; st.info.richText = true; st.info.enableAutoSizing = true; st.info.fontSizeMin = 14; st.info.fontSizeMax = 20;
    st.goRt = node(rp, "WearBtn", 0, -300, rw + 36, 96);
    st.goP = plate(st.goRt, "P", 0, 0, rw + 36, 96, { bracket: 14, cut: [18, 0, 18, 0], alpha: 0.95 });
    st.goT = label(st.goRt, "T", 0, 0, rw, 56, 42, W, TMP.TextAlignmentOptions.Center, "display"); st.goT.characterSpacing = 6; st.goT.fontStyle = 2;
    log("built: RW " + Math.round(RW) + ", panels " + LW + ", tiles " + st.rv * 2);
    return st;
  }

  // ---- the camera: closer on the hero while the screen is open, put back when it closes
  function camFind() { var cams = UE.Camera.allCameras; for (var i = 0; i < cams.Length; i++) { var c = cams.get_Item(i); if (c.name == "CameraMid") return c; } return null; }
  function camIn(st, t, ease) {
    try {
      var c = st.cam && !st.cam.Equals(null) ? st.cam : (st.cam = camFind()); if (!c || c.orthographic) return;
      var p = c.transform.position;
      if (!st.cam0) {
        // the game moves the camera from the select's room to the wardrobe's view over a few frames: the view it comes to
        // rest on is the one to start from (taken too early, the camera was pinned inside the room and the stage was black)
        var kk = p.x.toFixed(3) + "," + p.y.toFixed(3) + "," + p.z.toFixed(3) + "," + c.fieldOfView.toFixed(2);
        if (kk !== st.camKey) { st.camKey = kk; st.camStill = t; return; }
        // while the select is up the camera sits inside the room (z about +2); the wardrobe's view stands well back
        // from the hero (z about -16) and the game goes there a moment after the wardrobe opens
        if (p.z > -8 || t - st.camStill < 0.3) return;
        st.cam0 = { fov: c.fieldOfView, x: p.x, y: p.y, z: p.z }; st.camAt = t;
      }
      // the hero's feet sit 0.39 of the picture's height below its middle at the game's own view; they go 0.36 below
      // it at the closer one, so the hero stands on the same floor line, larger. The move takes a third of a second.
      var u = ease((t - st.camAt) / 0.35), fov = st.cam0.fov + (FOV - st.cam0.fov) * u, d = Math.abs(st.cam0.z), DEG = Math.PI / 180;
      var floor = st.cam0.y - 0.78 * Math.tan(st.cam0.fov / 2 * DEG) * d, y = floor + (0.78 - 0.06 * u) * Math.tan(fov / 2 * DEG) * d;
      if (Math.abs(c.fieldOfView - fov) > 0.01) c.fieldOfView = fov;
      if (Math.abs(p.y - y) > 0.004 || Math.abs(p.x - st.cam0.x) > 0.004 || Math.abs(p.z - st.cam0.z) > 0.004) c.transform.position = new UE.Vector3(st.cam0.x, y, st.cam0.z);
    } catch (e) { if (!st.camErr) { st.camErr = 1; log("camera: " + e); } }
  }
  function camOut(st) {
    try { var c = st.cam; if (c && !c.Equals(null) && st.cam0) { c.fieldOfView = st.cam0.fov; c.transform.position = new UE.Vector3(st.cam0.x, st.cam0.y, st.cam0.z); } } catch (e) {}
    st.cam0 = null; st.cam = null;
  }

  V.open = function (S, P, c) {
    var st = V.st;
    try { if (st && st.root && !st.root.Equals(null)) UE.Object.Destroy(st.root.gameObject); } catch (e0) {}
    V.st = null;
    try { st = build(P, c.n.length); } catch (e) { log("build: " + e + String(e.stack).slice(0, 300)); V.enabled = false; return false; }
    st.root.gameObject.SetActive(true); st.root.SetAsLastSibling(); st.openAt = UE.Time.unscaledTime;
    st.tab = 0; st.top = 0; st.viewKey = null; st.wornI = c.i; st.pk = null; st.lastI = -1; st.tiles.forEach(function (o) { o.key = null; });
    st.cam0 = null; st.cam = null; st.camKey = null; st.flashAt = null; st.shakeAt = null;
    st.job = null; st.jobDone = false; st.revealAt = null;
    // the pictures taken for one hero are kept while that hero's colours are opened again; another hero drops them
    var hid = P.col ? P.col.hero : 0; if (V.tcHero !== hid) { dropThumbs(); V.tcHero = hid; }
    return true;
  };
  V.close = function () { var st = V.st; if (!st) return; jobEnd(st, null); camOut(st); st.pk = null; try { if (st.root && !st.root.Equals(null)) st.root.gameObject.SetActive(false); } catch (e) {} };

  // ---- the hero's picture in each colour: a copy of the room's camera draws the hero, colour after colour, behind the
  // curtain. The game's own pick plays a sound and takes about four frames to show, so each colour is put on through
  // the wardrobe's ApplySkin (no sound) and drawn five frames later; the colour in focus goes back on at the end.
  V.tc = {}; V.tcHero = null;
  function dropThumbs() { for (var kx in V.tc) { try { var r = V.tc[kx]; if (r && !r.Equals(null)) { r.Release(); UE.Object.Destroy(r); } } catch (e) {} } V.tc = {}; }
  function skinOn(c, j) { var nd = c.n[j]; nd.bevRoot.ApplySkin(nd.cfg.skinName); }
  function jobStart(st, c) {
    var list = []; for (var j = 0; j < c.n.length; j++) { var id = c.n[j].cfg && c.n[j].cfg.id; if (id != null && !V.tc[id]) list.push(j); }
    if (!list.length) { st.jobDone = true; return; }
    var go = new UE.GameObject("C5ThumbCam"), cam = go.AddComponent(T(UE.Camera)); cam.CopyFrom(st.cam); cam.enabled = false;
    st.job = { list: list, k: 0, phase: 0, f0: 0, go: go, cam: cam, n: list.length };
  }
  function jobStep(st, c) {
    var jb = st.job, j = jb.list[jb.k];
    if (jb.phase == 0) { skinOn(c, j); jb.phase = 1; jb.f0 = UE.Time.frameCount; return; }
    if (UE.Time.frameCount - jb.f0 < 5) return;
    // the camera draws its whole view once, large; the part from the chest to above the head, as wide as a tile's picture
    // is, is copied into the small picture the tile keeps (the hero is 57 % of the view's height, the head 30 % from the top)
    var sa = UE.Screen.width / Math.max(1, UE.Screen.height);
    if (!jb.big) jb.big = new UE.RenderTexture(1920, Math.max(64, Math.round(1920 / sa)), 16);
    var hF = 0.22, wF = Math.min(1, hF * (st.pw / st.ph) / sa), rt = new UE.RenderTexture(480, Math.max(32, Math.round(480 * st.ph / st.pw)), 0);
    jb.cam.targetTexture = jb.big; jb.cam.Render(); jb.cam.targetTexture = null;
    UE.Graphics.Blit(jb.big, rt, new UE.Vector2(wF, hF), new UE.Vector2(0.5 - wF / 2, 0.505)); V.tc[c.n[j].cfg.id] = rt;
    jb.k++; jb.phase = 0; if (jb.k >= jb.list.length) jobEnd(st, c);
  }
  function jobEnd(st, c) {
    var jb = st.job; if (!jb) return; st.job = null; st.jobDone = true;
    try { if (jb.go && !jb.go.Equals(null)) UE.Object.Destroy(jb.go); } catch (e) {}
    try { if (jb.big) { jb.big.Release(); UE.Object.Destroy(jb.big); } } catch (e1) {}
    try { if (c) skinOn(c, c.i); } catch (e2) { log("skin back: " + e2); }
    st.tiles.forEach(function (o) { o.key = null; });
  }
  function busy(st) { return !!(st && st.job); }
  function focus(st, c) { return st.pk ? st.pk.back : c.i; }
  function endPeek(st, c) { if (!st.pk) return; var b = st.pk.back; st.pk = null; if (c.i != b) G.BB4SEL.colourPick(c, b); }

  V.move = function (P, A, dx, dy) {
    var st = V.st, c = P.c; if (!st || !c || busy(st)) return; endPeek(st, c);
    var v = viewOf(st, A, c); if (!v.length) return;
    var at = v.indexOf(c.i); if (at < 0) at = 0;
    var ni = at + (dx || 0) + (dy ? (dy > 0 ? -2 : 2) : 0); ni = Math.max(0, Math.min(v.length - 1, ni));
    if (v[ni] != c.i) G.BB4SEL.colourPick(c, v[ni]);
  };
  V.tab = function (P, A, d) {
    var st = V.st, c = P.c; if (!st || !c || busy(st)) return; endPeek(st, c);
    for (var q = 1; q <= TABS.length; q++) { var nt = (st.tab + d * q + TABS.length * q) % TABS.length; if (tabCount(st, A, c, nt)) { V.setTab(P, A, nt); return; } }
  };
  V.setTab = function (P, A, nt) {
    var st = V.st, c = P.c; if (!st || busy(st) || nt == st.tab || !tabCount(st, A, c, nt)) return;
    st.tab = nt; st.viewKey = null; st.top = 0; st.tiles.forEach(function (o) { o.key = null; });
    var v = viewOf(st, A, c); if (v.indexOf(c.i) < 0) G.BB4SEL.colourPick(c, v[0]);
    try { P.sfx("sfx_ui_51"); } catch (e) {}
  };
  // X: the hero in the colour worn now, and back to the pick
  V.peek = function (P, A) {
    var st = V.st, c = P.c; if (!st || !c || busy(st)) return;
    if (st.pk) { endPeek(st, c); try { P.sfx("sfx_ui_36"); } catch (e) {} return; }
    if (c.i == st.wornI) { try { P.sfx("sfx_ui_13"); A.toast("You are wearing this colour"); } catch (e) {} return; }
    st.pk = { back: c.i }; G.BB4SEL.colourPick(c, st.wornI); try { P.sfx("sfx_ui_51"); } catch (e) {}
  };
  // a press while the worn colour is shown goes back to the pick first; true means the press is used up
  V.pressFirst = function (P) { var st = V.st, c = P.c; if (!st || !c) return false; if (busy(st)) return true; if (!st.pk) return false; endPeek(st, c); return true; };
  V.focusIndex = function (P) { var st = V.st; return st && P.c ? focus(st, P.c) : 0; };
  V.flash = function () { if (V.st) V.st.flashAt = UE.Time.unscaledTime; };
  V.shake = function () { if (V.st) V.st.shakeAt = UE.Time.unscaledTime; };
  V.prompts = function (P, A) {
    var st = V.st, c = P.c; if (!st || !c) return [[10, "Back"]];
    var inf = A.colInfo(focus(st, c));
    if (st.pk) return [[9, "Back to my pick"], [10, "Back"]];
    return [[9, inf.owned ? "Wear" : inf.dlc ? "DLC" : "Locked"], [10, "Back"], [16, "", 17, "Filter"], [30, "What I wear"]];
  };
  V.mouse = function (P, A, mp, click, wheel, moved, over) {
    var st = V.st, c = P.c; if (!st || !c || busy(st)) return;
    if (wheel) V.move(P, A, 0, wheel > 0 ? 1 : -1);
    if (!moved && !click) return;
    var fi = focus(st, c), hit = false;
    st.tiles.forEach(function (o) { if (hit || o.j == null || !o.rt.gameObject.activeSelf || !over(o.rt, mp)) return; hit = true;
      if (o.j != fi) { endPeek(st, c); G.BB4SEL.colourPick(c, o.j); } if (click) P.press(); });
    if (hit || !click) return;
    st.tabs.forEach(function (tb, q) { if (!hit && over(tb.p.rectTransform, mp)) { hit = true; V.setTab(P, A, q); } });
    if (!hit && over(st.goRt, mp)) P.press();
  };

  V.frame = function (S, P, A) {
    var st = V.st, c = P.c; if (!st || !c) return;
    var k = K(), setT = k.setT, setC = k.setC, mc = k.mc, pos = k.pos, act = k.act, ease = k.ease, mixc = k.mixc, t = UE.Time.unscaledTime;
    var n = c.n.length, fi = focus(st, c), v = viewOf(st, A, c), o = ease((t - st.openAt) / 0.3);
    st.cg.alpha = o; camIn(st, t, ease);
    // the curtain stays until the camera is on the hero and every picture is taken; if the wardrobe's view has not come
    // 2.5 s after the open, it lifts on the room as it is and the tiles keep their bars
    if (!st.jobDone && !st.job) {
      if (st.cam0 && t - st.camAt > 0.4) { try { jobStart(st, c); } catch (ej) { log("pictures: " + ej); st.jobDone = true; } }
      else if (!st.cam0 && t - st.openAt > 2.5) st.jobDone = true;
    }
    if (st.job) { try { jobStep(st, c); } catch (ej2) { log("picture: " + ej2); jobEnd(st, c); } }
    if (st.jobDone && st.revealAt == null) st.revealAt = t;
    var va = st.revealAt == null ? 1 : 1 - ease((t - st.revealAt) / 0.25);
    mc(st.veil.__m, "_Fill", [0.02, 0.012, 0.02], va); act(st.veil.gameObject, va > 0.004);
    setT(st.veilT, va > 0.02 ? "READING COLOURS" : ""); setC(st.veilT, DIM, va);
    setT(st.veilN, st.job ? Math.min(st.job.n, st.job.k + 1) + " / " + st.job.n : ""); setC(st.veilN, DIM, va);
    pos(st.lp, -st.RW / 2 + st.LW / 2 - 70 * (1 - o), 0); pos(st.rp, st.RW / 2 - st.RWd / 2 + 70 * (1 - o), 0);
    var inf = A.colInfo(fi), chips = A.chipsOf(fi), fx = A.fxOf(fi), main = chips[0] || inf.col || W, lum = 0.3 * main[0] + 0.59 * main[1] + 0.11 * main[2];
    var lit = lum < 0.35 ? mixc(main, W, 0.45) : main, nm = inf.name || "Colour " + (fi + 1), wornInf = A.colInfo(st.wornI), wornNm = wornInf.name || "Colour " + (st.wornI + 1);
    // the tabs
    st.tabs.forEach(function (tb, q) {
      var on = q == st.tab, has = tabCount(st, A, c, q) > 0, kk = (on ? 1 : 0) + ":" + (has ? 1 : 0); if (tb.key === kk) return; tb.key = kk;
      mc(tb.p.__m, "_Fill", on ? HUE : [0.05, 0.03, 0.04], on ? 0.95 : 0.9); mc(tb.p.__m, "_Line", on ? mixc(HUE, W, 0.6) : DIM, on ? 0.9 : 0.4);
      setC(tb.t, on ? W : has ? INK : DIM, has ? 1 : 0.45);
    });
    var own = 0; for (var j0 = 0; j0 < n; j0++) if (A.colInfo(j0).owned) own++;
    setT(st.owned, own + " / " + n + " owned");
    // the tiles: the focused one kept in view, two a row
    var at = v.indexOf(fi), row = at < 0 ? 0 : Math.floor(at / 2), rows = Math.ceil(v.length / 2);
    if (row < st.top) st.top = row; if (row > st.top + st.rv - 1) st.top = row - st.rv + 1; st.top = Math.max(0, Math.min(Math.max(0, rows - st.rv), st.top));
    var sh = st.shakeAt != null ? (t - st.shakeAt) / 0.3 : 2;
    st.tiles.forEach(function (ti, q) {
      var j = v[st.top * 2 + q], show = j != null; act(ti.rt.gameObject, show); ti.j = show ? j : null; if (!show) return;
      var foc = j == fi, tg = foc ? 1 : 0; ti.f += (tg - ti.f) * Math.min(1, 0.25); if (Math.abs(tg - ti.f) < 0.01) ti.f = tg;
      var io = ease((t - st.openAt - 0.05 - q * 0.02) / 0.22); ti.g.alpha = io;
      pos(ti.rt, ti.x + (foc && sh < 1 ? 10 * Math.sin(sh * 28) * (1 - sh) : 0) - 30 * (1 - io), ti.y);
      var tex = V.tc[c.n[j].cfg.id] || null, hasT = !!tex && !tex.Equals(null);
      var info = A.colInfo(j), worn = j == st.wornI, key = j + "|" + foc + "|" + worn + "|" + info.owned + "|" + hasT; if (ti.key === key) return; ti.key = key;
      var cc = A.chipsOf(j), f2 = A.fxOf(j), m0 = cc[0] || W;
      // the hero's picture: the part of the camera's view from the hips to above the head, as wide as the tile allows
      act(ti.bust.gameObject, hasT); ti.bars.forEach(function (b) { act(b.gameObject, !hasT); });
      ti.strip.forEach(function (sp, z) { act(sp.gameObject, hasT); if (hasT) mc(sp.__m, "_Fill", cc[z] || cc[cc.length - 1] || W, info.owned ? 1 : 0.45); });
      if (hasT) { ti.bust.texture = tex; ti.bust.color = k.col(info.owned ? W : [0.42, 0.42, 0.48], 1); }
      ti.bars.forEach(function (b, z) { var cz = cc[z] || cc[cc.length - 1] || W; mc(b.__m, "_Fill", cz, info.owned ? 1 : 0.38); mc(b.__m, "_Line", W, info.owned ? 0.28 : 0.12); });
      mc(ti.p.__m, "_Fill", foc ? [0.13, 0.05, 0.08] : [0.05, 0.03, 0.04], 0.94); mc(ti.p.__m, "_Line", foc ? W : [0.45, 0.18, 0.25], foc ? 1 : 0.7); ti.p.__m.SetFloat("_LineW", foc ? 2.5 : 1.5);
      setT(ti.name, "<color=#" + hex(DIM) + ">" + two(j + 1) + "</color>  " + (info.name || "Colour " + (j + 1))); setC(ti.name, info.owned ? INK : DIM, 1);
      act(ti.fx.gameObject, !!f2); if (f2) { var fc = f2.col; mc(ti.fx.__m, "_Fill", [Math.max(fc[0], 0.3), Math.max(fc[1], 0.3), Math.max(fc[2], 0.3)], 1); }
      var tag = worn ? "WEARING" : !info.owned ? (info.dlc ? "DLC" : "LOCKED") : "";
      act(ti.tagP.gameObject, !!tag); act(ti.tag.gameObject, !!tag);
      if (tag) { setT(ti.tag, tag); setC(ti.tag, worn ? [0.1, 0.06, 0.02] : info.dlc ? GOLD : RED, 1); mc(ti.tagP.__m, "_Fill", worn ? GOLD : DARK, worn ? 1 : 0.9); mc(ti.tagP.__m, "_Line", worn ? GOLD : DIM, 0.7); }
      act(ti.under.gameObject, foc); if (foc) mc(ti.under.__m, "_Fill", lum < 0.2 ? mixc(m0, W, 0.5) : m0, 1);
    });
    setT(st.more, rows > st.rv ? (st.top + st.rv < rows ? "more below" : "more above") : "");
    setT(st.footH, "// " + String(A.heroLabel()).toUpperCase());
    setT(st.footT, "Wearing <color=#" + hex(INK) + ">" + two(st.wornI + 1) + " " + wornNm + "</color>");
    // the stage
    setT(st.sName, st.pk ? "<color=#" + hex(GOLD) + ">WHAT YOU WEAR NOW</color>   " + two(st.wornI + 1) + "  " + String(wornNm).toUpperCase() : two(fi + 1) + "  /  " + String(nm).toUpperCase());
    var shown = st.pk ? A.chipsOf(st.wornI) : chips;
    st.rail.forEach(function (b, z) { var cz = shown[z] || shown[shown.length - 1] || W; mc(b.__m, "_Fill", cz, 1); });
    st.edges.forEach(function (e) { mc(e.__m, "_Fill", lit, 0.6 * o); });
    setT(st.wearing, fi == st.wornI ? "" : "WEARING  <color=#" + hex(GOLD) + ">" + two(st.wornI + 1) + " " + String(wornNm).toUpperCase() + "</color>");
    // the sheet
    if (st.lastI !== fi) { st.lastI = fi; st.popAt = t; }
    setT(st.count, (fi + 1) + " / " + n); setT(st.name, String(nm).toUpperCase()); setT(st.hero, A.heroLabel());
    setT(st.state, fi == st.wornI ? "WEARING" : inf.owned ? "OWNED" : inf.dlc ? "DLC" : "LOCKED"); setC(st.state, inf.owned ? GOLD : inf.dlc ? GOLD : RED, 1);
    var fl = st.flashAt != null ? (t - st.flashAt) / 0.4 : 2;
    st.chips.forEach(function (ch, z) {
      var cz = chips[z] || chips[chips.length - 1] || W; mc(ch.c.__m, "_Fill", cz, inf.owned ? 1 : 0.5);
      var pp = ease((t - st.popAt - z * 0.03) / 0.18), s = 0.72 + 0.28 * pp + (fl < 1 ? 0.14 * Math.sin(fl * Math.PI) : 0); k.scl(ch.c.rectTransform, s);
    });
    act(st.fxD.gameObject, !!fx); if (fx) mc(st.fxD.__m, "_Fill", [Math.max(fx.col[0], 0.3), Math.max(fx.col[1], 0.3), Math.max(fx.col[2], 0.3)], 1);
    setT(st.fxT, fx ? (fx.line ? "This colour has its own effects." : "This colour tints the hero's effects.") : "The effects keep their usual colours.");
    pos(st.fxT.rectTransform, fx ? 26 : 0, 88); setC(st.fxT, fx ? INK : DIM, 1);
    setT(st.vsT[0], two(st.wornI + 1) + " " + wornNm); setT(st.vsT[1], two(fi + 1) + " " + nm);
    var wc = A.chipsOf(st.wornI);
    st.worn.forEach(function (b, z) { mc(b.__m, "_Fill", wc[z] || wc[wc.length - 1] || W, 1); });
    st.mine.forEach(function (b, z) { mc(b.__m, "_Fill", chips[z] || chips[chips.length - 1] || W, 1); });
    setT(st.info, fi == st.wornI ? "You are wearing this colour." : inf.owned ? "You own this colour. Choose it to wear it." : inf.why);
    setC(st.info, inf.owned ? INK : inf.dlc ? GOLD : RED, 1);
    var can = inf.owned && fi != st.wornI;
    setT(st.goT, st.pk ? "BACK TO MY PICK" : fi == st.wornI ? "WEARING" : inf.owned ? "WEAR" : inf.dlc ? "DLC" : "LOCKED");
    mc(st.goP.__m, "_Fill", can || st.pk ? mixc(HUE, DARK, 0.25) : [0.06, 0.04, 0.05], 0.96); mc(st.goP.__m, "_Line", can || st.pk ? mixc(HUE, W, 0.6) : DIM, can || st.pk ? 1 : 0.5);
    setC(st.goT, can || st.pk ? W : DIM, 1); k.scl(st.goRt, 1 + (fl < 1 ? 0.06 * Math.sin(fl * Math.PI) : 0));
  };
})();
