(function () {
  // ---- the character select's light (the lead, 2026-11-02: "Make sure to recreate it perfectly INCLUDING THE NEW LIGHTING"):
  // the neon of the approved mockup (local_only/redux/v4shots/gpt/mock_hero) made of the lobby's own sprites and its Fx shader
  // (FourLobbyFx: mode 0 fire bed as low smoke, 3 sparks as embers, 4 glow, 5 seam as neon lines). fourlobbyui.js calls build
  // once from buildSel, cell and tab from drawSel's loops and frame once a frame. Every entry point catches its own errors:
  // if this file fails the screen draws as it did before it. The neon takes the tab's colour (NEON), easing over a few frames ----
  var cs = CS, G = globalThis, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof;
  function log(m) { G.BB4.log("FOURLIT", m); }
  function es(e) { return G.BB4.es ? G.BB4.es(e) : String(e); }
  var L = G.BB4LIT = { ok: false };
  var NEON = { heroes: [1, 0.2, 0.5], ex: [1, 0.64, 0.2], boss: [0.68, 0.32, 1], cross: [0.3, 0.68, 1] };
  var SLANT = 20;   // lb_btn's sides lean this far over the cell's height (the cells and tabs are lb_btn, sliced)
  var SP = {}, MT = {}, M = {};
  function col(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? (c.length > 3 ? c[3] : 1) : a); }
  function gather(S) {
    var ims = S.ui.GetComponentsInChildren(T(UI.Image), true);
    for (var i = 0; i < ims.Length; i++) { var s = ims.get_Item(i).sprite; if (s && !s.Equals(null) && !SP[s.name]) SP[s.name] = s; }
    var gs = S.ui.GetComponentsInChildren(T(UI.Graphic), true);
    for (var j = 0; j < gs.Length; j++) { var m = null; try { m = gs.get_Item(j).material; } catch (e) { continue; } if (m && !m.Equals(null) && m.name.indexOf("Lb_") == 0 && !MT[m.name]) MT[m.name] = m; }
  }
  function mat(base, name, p) {
    var m = new UE.Material(MT[base]); m.name = "Lit_" + name;
    for (var k in p) if (m.HasProperty("_" + k)) m.SetFloat("_" + k, p[k]);
    return m;
  }
  function mats() {
    M.glow = mat("Lb_Glow", "glow", { Mode: 4, Intensity: 1.5, Flicker: 0 });
    M.flick = mat("Lb_Glow", "flick", { Mode: 4, Intensity: 1.9, Flicker: 0.35, Seed: 0.37 });
    M.soft = mat("Lb_Glow", "soft", { Mode: 4, Intensity: 1, Flicker: 0.6, Seed: 0.71 });
    // neon: a seam whose ramp is built from the line's colour, so its core runs white and its halo keeps the hue
    M.line = mat("Lb_FloorSeam", "line", { Mode: 5, TintRamp: 1, NoisePx: 300, Speed: 0.3, Erode: 0.4, Intensity: 1.25, EdgeFade: 0.05 });
    M.hot = mat("Lb_FloorSeam", "hot", { Mode: 5, TintRamp: 1, NoisePx: 260, Speed: 0.35, Erode: 0.3, Intensity: 1.7, EdgeFade: 0.04, Seed: 0.4 });
    M.tick = mat("Lb_FloorSeam", "tick", { Mode: 5, TintRamp: 1, NoisePx: 200, Speed: 0.4, Erode: 0.45, Intensity: 1.8, EdgeFade: 0 });
    M.embers = mat("Lb_Motes", "embers", { Mode: 3, TintRamp: 1, Intensity: 1.3 });
    M.smoke = mat("Lb_FloorFire", "smoke", { Mode: 0, TintRamp: 1, Intensity: 0.2, Occlude: 0, Speed: 0.08, NoisePx: 560, EdgeFade: 0.12, Glow: 0.25 });
  }
  function node(par, name) {
    var g = new UE.GameObject(name), rt = g.AddComponent(T(UE.RectTransform)); rt.SetParent(par, false);
    rt.anchorMin = rt.anchorMax = new UE.Vector2(0.5, 0.5); return rt;
  }
  function solid() {
    if (!SP.__solid) { var tx = UE.Texture2D.whiteTexture; SP.__solid = UE.Sprite.Create(tx, new UE.Rect(0, 0, tx.width, tx.height), new UE.Vector2(0.5, 0.5)); }
    return SP.__solid;
  }
  function img(par, name, x, y, w, h, sp, m, c, rot, sliced) {
    var rt = node(par, name); rt.sizeDelta = new UE.Vector2(w, h); rt.anchoredPosition = new UE.Vector2(x, y);
    if (rot) rt.localEulerAngles = new UE.Vector3(0, 0, rot);
    var im = rt.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false;
    if (sp) { im.sprite = SP[sp] || null; if (sliced) im.type = 1; }
    else if (!m) im.sprite = solid();   // the game's empty Image draws a transparent texture: a flat fill needs a sprite
    if (m) im.material = m;
    im.color = col(c);
    return im;
  }
  // a line from (x0, y0) to (x1, y1), th wide (the seam's halo fills it; the core is a few px)
  function seam(par, name, x0, y0, x1, y1, th, m, c) {
    var dx = x1 - x0, dy = y1 - y0;
    return img(par, name, (x0 + x1) / 2, (y0 + y1) / 2, Math.sqrt(dx * dx + dy * dy), th, null, m, c, Math.atan2(dy, dx) * 180 / Math.PI);
  }
  function copyRect(d, s, grow) {
    d.anchorMin = s.anchorMin; d.anchorMax = s.anchorMax; d.pivot = s.pivot; d.anchoredPosition = s.anchoredPosition;
    d.sizeDelta = new UE.Vector2(s.sizeDelta.x + (grow || 0), s.sizeDelta.y + (grow || 0)); d.localScale = s.localScale;
  }
  // a neon part: its colour follows the tab's (alpha a, k of the way to white)
  function neon(Z, g, a, k) { Z.lit.neon.push({ g: g, a: a, k: k || 0 }); return g; }

  L.build = function (Z, S) {
    try {
      gather(S);
      if (!MT.Lb_Glow || !MT.Lb_FloorSeam || !MT.Lb_Motes || !MT.Lb_FloorFire) { log("no lobby Fx materials in this bundle: no light"); return; }
      mats();
      var P = NEON.heroes, back = node(Z.root, "Lit"); back.SetSiblingIndex(1); back.sizeDelta = new UE.Vector2(2580, 1080);
      Z.lit = { back: back, neon: [], nc: P.slice(), want: P.slice() };
      // the room: deep red pools low on the left and right, a glow along the horizon, smoke off the floor, embers rising
      img(back, "FogL", -1050, -430, 1500, 760, "lb_dot", M.soft, [0.62, 0.04, 0.13, 0.55]);
      img(back, "FogR", 1080, -240, 1500, 900, "lb_dot", M.soft, [0.52, 0.03, 0.13, 0.24]);
      img(back, "FogTop", 650, 470, 1900, 520, "lb_dot", M.soft, [0.34, 0.02, 0.08, 0.16]);
      img(back, "Horizon", 300, -320, 3600, 320, "lb_dot", M.soft, [0.72, 0.05, 0.2, 0.22]);
      var sm = img(back, "Smoke", 0, -540, 2700, 400, null, M.smoke, [0.8, 0.07, 0.22, 0.6]); sm.rectTransform.pivot = new UE.Vector2(0.5, 0);
      img(back, "Embers", 0, 0, 2580, 1080, null, M.embers, [1, 0.3, 0.52, 0.9]);
      // slow light shafts and dust in the tab's colour (they hold nc itself, so they follow it)
      var Q = Z.lit; Q.grow = []; Q.shaft = shafts(back, Q.nc); Q.dust = dust(back, Q.nc, -1290, -540, 2580, 1080, 20, 7);
      Q.fog = [[img(back, "FogL2", -1050, -430, 1100, 560, "lb_dot", M.soft, [0.7, 0.05, 0.16, 0]), [0.7, 0.05, 0.16], 0.3, 0],
        [img(back, "FogR2", 1100, -200, 1100, 700, "lb_dot", M.soft, [0.6, 0.04, 0.16, 0]), [0.6, 0.04, 0.16], 0.16, 2.1]];
      // the neon lines, each drawn in from its first end when the screen opens: d its delay, u its length of time
      function gl(par, name, x0, y0, x1, y1, th, m, a, d, u, k) { var s = grow(par, name, x0, y0, x1, y1, th, m, P); s.d = d; s.u = u; Q.grow.push(s); neon(Z, s.g, a, k); return s; }
      // the floor's neon: two lines under the grid, the upper one starting behind the card (the lead, 2026-11-03: no line
      // left of the card, none along the grid's foot)
      gl(back, "LineB", -930, -321, 1290, -321, 46, M.hot, 1, 0, 0.5);
      gl(back, "LineC", -242, -445, 1290, -445, 40, M.line, 0.65, 0.18, 0.45);
      // the title's underline: bent down at its left end, up at its right, each running on a short way
      Q.tg = img(back, "TitleGlow", 440, 430, 1300, 200, "lb_dot", M.soft, [0.8, 0.08, 0.3, 0.22]);
      gl(back, "TitleLine", -81, 402, 927, 402, 40, M.hot, 1, 0.12, 0.42);
      gl(back, "TitleEndL", -81, 402, -128, 372, 34, M.line, 0.9, 0.16, 0.1);
      gl(back, "TitleEndL2", -128, 372, -300, 372, 34, M.line, 0.6, 0.24, 0.22);
      gl(back, "TitleEndR", 927, 402, 974, 432, 34, M.line, 0.9, 0.42, 0.1);
      gl(back, "TitleEndR2", 974, 432, 1180, 432, 34, M.line, 0.6, 0.5, 0.25);
      // lights that run along the floor's lines and the title's
      Q.runB = comet(back, "RunB", -930, -321, 1290, -321, 1.3);
      Q.runC = comet(back, "RunC", -242, -445, 1290, -445, 0.8);
      Q.runT = comet(back, "RunT", -81, 402, 927, 402, 0.9);
      // the card's band (the tab look's slab behind the card, in CardFx): neon up both its edges, a second fainter line
      // outside the left one, the plinth's edge lit under the card; a light runs up the right edge and down the left
      var C = Z.cardFx, dx = 650 * Math.cos(80.3 * Math.PI / 180), dy = 650 * Math.sin(80.3 * Math.PI / 180);
      [["BandL", -232, 64, 1], ["BandL2", -276, 40, 0.45], ["BandR", 301, 64, 1]].forEach(function (e, i) {
        gl(C, e[0], e[1] - dx, -30 - dy, e[1] + dx, -30 + dy, e[2], e[3] > 0.9 ? M.hot : M.line, e[3], 0.04 + i * 0.06, 0.45);
      });
      Q.runR = comet(C, "RunBR", 301 - dx, -30 - dy, 301 + dx, -30 + dy, 0.9);
      Q.runL = comet(C, "RunBL", -232 + dx, -30 + dy, -232 - dx, -30 - dy, 0.9);
      Q.plg = img(C, "PlinthGlow", 0, -372, 620, 120, "lb_base_glow", M.flick, [1, 0.22, 0.52, 0.8]);
      gl(C, "Plinth", -250, -372, 250, -372, 44, M.hot, 1, 0.22, 0.35, 0.15);
      // the card's own frame in neon, over the hero-coloured FrameGlow, with a soft halo outside it
      var face = Z.k.tr.Find("Rig/Face"), fg = face ? face.Find("FrameGlow") : null;
      if (fg && !fg.Equals(null)) {
        var frt = fg.GetComponent(T(UE.RectTransform));
        var lh = img(face, "LitHalo", 0, 0, 0, 0, "lb_card_frame_glow", M.soft, P); copyRect(lh.rectTransform, frt, 40); neon(Z, lh, 0.5);
        lh.rectTransform.SetSiblingIndex(fg.GetSiblingIndex());
        var lf = img(face, "LitFrame", 0, 0, 0, 0, "lb_card_frame_glow", M.flick, P); copyRect(lf.rectTransform, frt, 0); neon(Z, lf, 1, 0.1);
        lf.rectTransform.SetSiblingIndex(fg.GetSiblingIndex() + 1); Q.frame = lf;
      } else log("the card has no FrameGlow: no neon frame");
      // a slanted sheen that crosses the portrait now and then, inside the card's mask
      var mk = face ? face.Find("Mask") : null;
      if (mk && !mk.Equals(null)) {
        Q.sweep = { s: [img(mk, "LitSweepB", 0, 0, 380, 1000, "lb_dot", M.glow, [1, 0.55, 0.68, 0], -12),
          img(mk, "LitSweepS", 0, 0, 64, 1000, "lb_dot", M.glow, [1, 0.92, 0.95, 0], -12),
          img(mk, "LitSweepT", 0, 0, 26, 1000, "lb_dot", M.glow, [1, 0.92, 0.95, 0], -12)], cB: [1, 0.55, 0.68], cS: [1, 0.92, 0.95] };
        Q.sweep.s.forEach(function (g) { g.enabled = false; });
      }
      // the tabs: a neon rim behind each; the current one also glows
      Z.tabs.forEach(function (tb) {
        var w = tb.rt.sizeDelta.x, h = tb.rt.sizeDelta.y;
        tb.litHalo = img(tb.rt, "LitHalo", 0, 0, w + 90, h + 70, "lb_dot", M.soft, P); tb.litHalo.rectTransform.SetSiblingIndex(0);
        tb.litRim = img(tb.rt, "LitRim", 0, 0, w + 8, h + 8, "lb_btn", M.glow, P, 0, true); tb.litRim.rectTransform.SetSiblingIndex(1);
      });
      L.ok = true; log("built: " + Z.lit.neon.length + " neon parts");
    } catch (e) { log("build: " + es(e)); Z.lit = null; }
  };

  // a cell's light, made the first time drawSel shows the cell: rim, halo, corner brackets, the paid hero's hex badge
  function parts(Z, b) {
    var w = b.rt.sizeDelta.x, h = b.rt.sizeDelta.y, nc = Z.lit.nc, P = {};
    P.halo = img(b.rt, "LitHalo", 0, 0, w + 110, h + 96, "lb_dot", M.soft, nc, 0); P.halo.rectTransform.SetSiblingIndex(0);
    P.rim = img(b.rt, "LitRim", 0, 0, w + 8, h + 8, "lb_btn", M.glow, nc, 0, true); P.rim.rectTransform.SetSiblingIndex(1);
    // brackets on the top-left and bottom-right corners, one arm along the top or bottom edge, one down the slanted side
    P.br = node(b.rt, "LitBrackets"); P.brs = [];
    var ax = w / 2 - SLANT / 2 + 4, ay = h / 2 + 4, ex = SLANT / h * 42, ey = 42;
    [[-1, 1], [1, -1]].forEach(function (s) {
      var cx = s[0] < 0 ? -w / 2 + SLANT - 4 : w / 2 - SLANT + 4, cy = s[1] * ay;
      P.brs.push(seam(P.br, "BrH", cx, cy, cx - s[0] * 46, cy, 30, M.tick, nc));
      P.brs.push(seam(P.br, "BrV", cx, cy, cx + s[0] * ex, cy - s[1] * ey, 30, M.tick, nc));
    });
    P.br.gameObject.SetActive(false); P.foc = false;
    // the paid hero: the game's lock crest (its hex frame, pegs and cube) lit from behind: a glow, a pink hex a little
    // larger than the crest's frame, a dark hex inside it so the frame reads as a neon edge. The label: big, gold, italic
    P.dlc = node(b.rt, "LitDlc"); P.dlc.SetSiblingIndex(b.lockN.GetSiblingIndex());
    var y = 8;
    P.dh = img(P.dlc, "Halo", 0, y, 250, 250, "lb_dot", M.soft, nc, 0);
    P.ring = img(P.dlc, "Ring", 0, y, 112, 126, "lb_hex_mask", M.flick, nc, 0);
    img(P.dlc, "Dark", 0, y, 100, 113, "lb_hex_mask", null, [0.1, 0.015, 0.04, 1]);
    img(P.dlc, "Core", 0, y, 58, 66, "lb_hex_mask", null, [1, 0.8, 0.83, 1]);   // under the crest's cube, which is additive: it reads pale
    P.sp = [];
    b.dlc.fontSize = 26; b.dlc.fontStyle = 3; b.dlc.color = new UE.Color(1, 0.84, 0.24, 1);
    b.dlc.rectTransform.anchoredPosition = new UE.Vector2(10, 4);
    P.dlc.gameObject.SetActive(false); P.dlcOn = false;
    return P;
  }
  function setC(g, c, a, k) {   // a colour, set only when it changed
    var r = c[0] + (1 - c[0]) * k, gg = c[1] + (1 - c[1]) * k, bb = c[2] + (1 - c[2]) * k, o = g.color;
    if (Math.abs(o.r - r) + Math.abs(o.g - gg) + Math.abs(o.b - bb) + Math.abs(o.a - a) > 0.004) g.color = new UE.Color(r, gg, bb, a);
  }
  // per cell per frame: foc the cursor's cell, dlc a paid hero the player does not own
  L.cell = function (Z, b, foc, dlc, t) {
    if (!Z.lit) return;
    try {
      var P = b.lit || (b.lit = parts(Z, b)), nc = Z.lit.nc;
      if (P.foc !== foc) { P.foc = foc; P.br.gameObject.SetActive(foc); if (foc) P.at = t; }
      if (P.dlcOn !== dlc) { P.dlcOn = dlc; P.dlc.gameObject.SetActive(dlc); }
      var k = foc ? Math.max(0, 1 - (t - P.at) / 0.3) : 0;   // the cursor lands: a flash that settles in 0.3 s
      setC(P.rim, nc, foc ? 1 : dlc ? 0.4 : 0.22, k * 0.6);
      setC(P.halo, nc, foc ? 0.4 + 0.12 * Math.sin(t * 4.2) + 0.5 * k : 0, 0);
      if (foc) P.brs.forEach(function (g) { setC(g, nc, 1, k * 0.5); });
      if (dlc) {
        var q = 0.5 + 0.5 * Math.sin(t * 2.6 + (b.j || 0) * 0.9);
        setC(P.dh, nc, 0.32 + 0.16 * q, 0); setC(P.ring, nc, 0.8 + 0.2 * q, 0.1);
        P.sp.forEach(function (g) { setC(g, nc, 0.7 + 0.3 * q, 0); });
        var hc = b.head.color; b.head.color = new UE.Color(hc.r, hc.g, hc.b, 0.12); var pc = b.port.color; b.port.color = new UE.Color(pc.r, pc.g, pc.b, 0.12);
      }
    } catch (e) { if (!L.cerr) { L.cerr = true; log("cell: " + es(e)); } }
  };
  L.tab = function (Z, tb, cur, t) {
    if (!Z.lit || !tb.litRim) return;
    try {
      var nc = Z.lit.nc;
      setC(tb.litRim, nc, cur ? 1 : 0.62, cur ? 0.12 : 0);
      setC(tb.litHalo, nc, cur ? 0.34 + 0.08 * Math.sin(t * 3.3) : 0, 0);
    } catch (e) { if (!L.terr) { L.terr = true; log("tab: " + es(e)); } }
  };
  // once a frame (drawSel calls it only while the select shows; Z.openAt is when it last came up): the neon eases to the
  // tab's colour and breathes; the open draws the lines in; lights run along the floor, the title and the band; a new tab
  // sends a light across the floor and whitens the neon for a moment; a new hero on the card flares the band and plinth
  L.frame = function (Z, t, key) {
    var Q = Z.lit; if (!Q) return;
    try {
      var w = NEON[key] || NEON.heroes, nc = Q.nc, d = Math.abs(w[0] - nc[0]) + Math.abs(w[1] - nc[1]) + Math.abs(w[2] - nc[2]);
      for (var i = 0; i < 3; i++) nc[i] = d < 0.003 ? w[i] : nc[i] + (w[i] - nc[i]) * 0.12;
      if (Q.key !== key) { if (Q.key) Q.tabAt = t; Q.key = key; }
      var op = Z.openAt || 0, o = t - op, fi = ease(o / 0.5);
      var tw = Math.max(0, 1 - (t - (Q.tabAt || -9)) / 0.6), sw = Math.max(0, 1 - (t - (Z.swapAt || -9)) / 0.5), lc = [nc[0] + (1 - nc[0]) * 0.35, nc[1] + (1 - nc[1]) * 0.35, nc[2] + (1 - nc[2]) * 0.35];
      if (o < 1.2 || !Q.drawn) { Q.grow.forEach(function (s) { drawIn(s, (o - s.d) / s.u); }); Q.drawn = o >= 1.2; }
      Q.neon.forEach(function (n, j) { lum(n.g, nc, n.a * fi * (0.9 + 0.1 * Math.sin(t * 1.3 + j * 0.7)), Math.min(1, n.k + 0.45 * tw)); });
      if (Q.frame) lum(Q.frame, nc, fi, 0.1 + 0.6 * sw);
      lum(Q.tg, [0.8, 0.08, 0.3], fi * (0.2 + 0.04 * Math.sin(t * 1.1)) + 0.25 * tw, 0);
      lum(Q.plg, nc, fi * (0.7 + 0.12 * Math.sin(t * 2.3)) + 0.5 * sw, 0.3 * sw);
      Q.fog.forEach(function (f) { lum(f[0], f[1], fi * f[2] * (0.6 + 0.4 * Math.sin(t * 0.37 + f[3])), 0); });
      shaftsAt(Q.shaft, t, -1290, 2580, 120, fi); dustAt(Q.dust, t, fi);
      // the lights: a new tab sends them across now; otherwise each comes round on its own clock
      function run(q, u0, t0, every, dur, a) { var u = u0 >= 0 ? u0 : pass(t, op + t0, every, dur); cometAt(q, u, lc, a); }
      run(Q.runB, once(t, Q.tabAt || -9, 0.7), 0.6, 5.3, 1.7, 1);
      run(Q.runT, once(t, (Q.tabAt || -9) + 0.06, 0.55), 1.1, 6.1, 1.1, 0.9);
      run(Q.runC, -1, 4.2, 8.1, 1.4, 0.7);
      run(Q.runR, once(t, Z.swapAt || -9, 0.5), 0.35, 4.7, 1, 1);
      run(Q.runL, once(t, (Z.swapAt || -9) + 0.04, 0.5), 2.7, 4.7, 1, 1);
      if (Q.sweep) sheenAt(Q.sweep, pass(t, op + 1.8, 6.4, 0.9), -520, 1040, 0, 0.75);
    } catch (e) { if (!L.ferr) { L.ferr = true; log("frame: " + es(e)); } }
  };
  // for a hot reload of this file: take away everything L.build made, so a fresh build starts clean
  L.heroKill = function (Z) {
    kill(Z.root.Find("Lit"));
    var C = Z.cardFx;
    ["BandL", "BandL2", "BandR", "PlinthGlow", "Plinth"].forEach(function (n) { kill(C.Find(n)); });
    ["RunBR", "RunBL"].forEach(function (n) { ["Tail", "Mid", "Head"].forEach(function (p) { kill(C.Find(n + p)); }); });
    var face = Z.k.tr.Find("Rig/Face");
    if (face) { kill(face.Find("LitHalo")); kill(face.Find("LitFrame")); ["B", "S", "T"].forEach(function (p) { kill(face.Find("Mask/LitSweep" + p)); }); }
    Z.tabs.forEach(function (tb) { kill(tb.rt.Find("LitHalo")); kill(tb.rt.Find("LitRim")); tb.litHalo = tb.litRim = null; });
    Z.lit = null;
  };

  // ---- Mind Crystals (the approved mockup local_only/redux/v4shots/gpt/mock_crystals): a navy room lit blue, faint hexes
  // drifting, light streaks in the corners, a neon rim on every row and crystal, the focused crystal in a lit hex inside a
  // slanted panel. fourselpanels.js calls crBuild once from buildCrystals, crFrame once a frame and crRow / crCell from
  // drawCrystals' loops ----
  var CRN = [0.32, 0.45, 1], CRG = [1, 0.78, 0.25], CRV = [0.38, 0.36, 1];   // CRV: the bars' fill, the mockup's violet-blue
  function ready(S) {
    if (M.glow) return true;
    gather(S); if (!MT.Lb_Glow || !MT.Lb_FloorSeam || !MT.Lb_Motes || !MT.Lb_FloorFire) return false;
    mats(); return true;
  }
  // the Legacy kit page (fourlegkit.js), the pause menu (fourpause.js) and the dev menu (fourdev.js) light themselves with
  // the same materials, sprites and helpers (the gradients included)
  L.fxKit = function (S) {
    if (!ready(S)) return null; gradMats();
    return { M: M, SP: SP, MT: MT, mat: mat, h: { node: node, img: img, seam: seam, grow: grow, drawIn: drawIn, comet: comet, cometAt: cometAt,
      sheen: sheen, sheenAt: sheenAt, dust: dust, dustAt: dustAt, shafts: shafts, shaftsAt: shaftsAt, fimg: fimg, lum: lum, setC: setC, moveTo: moveTo,
      scaleTo: scaleTo, col: col, off: off, ease: ease, eob: eob, wrap: wrap, bell: bell, once: once, pass: pass, clamp01: clamp01, kill: kill,
      fill: fill, fillAt: fillAt } };
  };
  L.crBuild = function (R, S) {
    try {
      if (!ready(S)) { log("crystals: no lobby Fx materials: no light"); return; }
      var back = node(R.rt, "Lit"); back.SetSiblingIndex(R.veil.transform.GetSiblingIndex() + 1); back.sizeDelta = new UE.Vector2(2580, 1080);
      var Q = R.lit = { back: back, hex: [], streak: [], grow: [] };
      Q.cg = back.gameObject.AddComponent(T(UE.CanvasGroup)); Q.cg.alpha = 0; Q.cg.blocksRaycasts = false;
      function gl(name, x0, y0, x1, y1, th, m, c, d, u) { var s = grow(back, name, x0, y0, x1, y1, th, m, c); s.d = d; s.u = u; Q.grow.push(s); return s; }
      img(back, "FogL", -980, -360, 1500, 820, "lb_dot", M.soft, [0.14, 0.22, 0.95, 0.5]);
      img(back, "FogTL", -760, 470, 1700, 520, "lb_dot", M.soft, [0.22, 0.3, 1, 0.3]);
      img(back, "FogR", 1120, 80, 1400, 1100, "lb_dot", M.soft, [0.1, 0.18, 0.85, 0.3]);
      img(back, "FogMid", 420, -40, 1500, 900, "lb_dot", M.soft, [0.12, 0.16, 0.6, 0.18]);
      Q.flare = img(back, "FlareBL", -1150, -330, 980, 230, "lb_dot", M.flick, [0.42, 0.5, 1, 0.5], 38);
      // hexes far behind, drifting slowly; a few near the grid's right edge, a cluster top left
      [[-1180, 250, 220], [-980, 120, 150], [-1230, -60, 170], [-420, -470, 190], [180, 470, 160], [1130, 380, 240],
       [1220, 140, 160], [1160, -120, 210], [1240, -380, 170], [960, -470, 140], [-250, 140, 130], [700, 470, 120]].forEach(function (h, i) {
        var g = img(back, "Hex" + i, h[0], h[1], h[2], h[2] * 1.13, "lb_hex_mask", null, [0.3, 0.42, 1, 0.07]);
        Q.hex.push({ g: g, x: h[0], y: h[1], p: i * 1.7, a: 0.05 + (i % 3) * 0.025 });
      });
      // diagonal light streaks: two across the top-left corner, two up from the bottom-left, one faint behind the grid
      [[-1290, 330, -880, 540, 90, 0.5], [-1290, 220, -760, 540, 40, 0.65], [-1290, -470, -980, -260, 70, 0.45],
       [-1220, -540, -860, -300, 34, 0.6], [-120, 540, 120, 300, 60, 0.18], [1000, -540, 1290, -300, 60, 0.3]].forEach(function (s, i) {
        Q.streak.push({ g: seam(back, "Streak" + i, s[0], s[1], s[2], s[3], s[4], M.line, CRN), a: s[5], p: i * 2.3 });
      });
      var sm = img(back, "Smoke", 0, -540, 2700, 360, null, M.smoke, [0.22, 0.32, 1, 0.5]); sm.rectTransform.pivot = new UE.Vector2(0.5, 0);
      img(back, "Motes", 0, 0, 2580, 1080, null, M.embers, [0.45, 0.6, 1, 0.7]);
      // slow light shafts and dust, cold blue
      Q.shaft = shafts(back, [0.36, 0.5, 1]); Q.dust = dust(back, [0.5, 0.62, 1], -1290, -540, 2580, 1080, 18, 3);
      // the title's underline: under the title, rising at its right end and running on fainter; they draw in on opening
      Q.tg = img(back, "TitleGlow", -560, 440, 1300, 170, "lb_dot", M.soft, [0.3, 0.4, 1, 0.3]);
      gl("TitleLine", -950, 425, -160, 425, 40, M.hot, CRN, 0.06, 0.42);
      gl("TitleRise", -160, 425, -112, 478, 34, M.line, CRN, 0.4, 0.1);
      gl("TitleRun", -112, 478, 340, 478, 30, M.line, [CRN[0], CRN[1], CRN[2], 0.55], 0.46, 0.4);
      // gold rules after the two headers
      gl("SlotRule", -712, 341, -622, 341, 22, M.line, [CRG[0], CRG[1], CRG[2], 0.9], 0.2, 0.25);
      gl("ListRule", 302, 343, 930, 343, 22, M.line, [CRG[0], CRG[1], CRG[2], 0.9], 0.24, 0.45);
      // lights that run along the lines now and then
      Q.runT = comet(back, "RunT", -950, 425, -160, 425, 0.8);
      Q.runR = comet(back, "RunR", -112, 478, 340, 478, 0.6);
      Q.runL = comet(back, "RunL", 302, 343, 930, 343, 0.6);
      Q.runS = [comet(back, "RunS0", -1290, 330, -880, 540, 0.9), comet(back, "RunS3", -1220, -540, -860, -300, 0.8), comet(back, "RunS5", 1000, -540, 1290, -300, 0.8)];
      // the detail panel: a dark slanted slab with a neon rim, the hex at its left
      img(back, "PanelHalo", 482, -333, 1480, 330, "lb_dot", M.soft, [0.2, 0.3, 1, 0.22]);
      Q.panelRim = img(back, "PanelRim", 482, -333, 1338, 218, "lb_btn", M.glow, [CRN[0], CRN[1], CRN[2], 0.75], 0, true);
      img(back, "Panel", 482, -333, 1330, 210, "lb_btn", null, [0.018, 0.026, 0.085, 0.94], 0, true);
      Q.pfill = fill(back, "PanelFill", 482, -333, 1330, 210, CRV);
      gl("PanelTop", -100, -228, 1100, -228, 26, M.line, [CRN[0], CRN[1], CRN[2], 0.6], 0.3, 0.5);
      Q.runP = comet(back, "RunP", -100, -228, 1100, -228, 0.8);
      // the large crystal's hex, behind its loop and icon; a new crystal there sends a hex out from under its ring
      var bg = node(R.big, "LitHex"); bg.SetSiblingIndex(0);
      Q.bigHalo = img(bg, "Halo", 0, 0, 420, 420, "lb_dot", M.soft, [0.3, 0.42, 1, 0.7]);
      Q.burst = img(bg, "Burst", 0, 0, 178, 200, "lb_hex_mask", M.glow, [0.6, 0.7, 1, 0]); Q.burst.enabled = false;
      Q.bigRing = img(bg, "Ring", 0, 0, 178, 200, "lb_hex_mask", M.flick, [0.42, 0.55, 1, 1]);
      img(bg, "Dark", 0, 0, 162, 182, "lb_hex_mask", null, [0.02, 0.03, 0.09, 1]);
      Q.bigRing2 = img(bg, "Ring2", 0, 0, 132, 148, "lb_hex_mask", M.glow, [0.35, 0.48, 1, 0.5]);
      img(bg, "Dark2", 0, 0, 122, 137, "lb_hex_mask", null, [0.03, 0.045, 0.12, 1]);
      // each row: a halo and a neon rim behind it, a dark slanted tab under its numeral
      R.slots.forEach(function (s, i) {
        var rt = s.b.rt, w = rt.sizeDelta.x, h = rt.sizeDelta.y, P = s.lit = { foc: -1, bx: rt.anchoredPosition.x, off: 0, ph: i * 0.9 };
        P.halo = img(rt, "LitHalo", 0, 0, w + 280, h + 210, "lb_dot", M.soft, CRN); P.halo.rectTransform.SetSiblingIndex(0);
        P.rim = img(rt, "LitRim", 0, 0, w + 8, h + 8, "lb_btn", M.glow, CRN, 0, true); P.rim.rectTransform.SetSiblingIndex(1);
        P.tab = img(rt, "LitTab", -w / 2 + 52, 0, 92, h - 12, "lb_btn", null, [0.015, 0.02, 0.07, 0.92], 0, true);
        P.tab.rectTransform.SetSiblingIndex(s.b.on.transform.GetSiblingIndex() + 1);
        P.tabRim = img(rt, "LitTabRim", -w / 2 + 52, 0, 96, h - 8, "lb_btn", M.glow, [CRN[0], CRN[1], CRN[2], 0.4], 0, true);
        P.tabRim.rectTransform.SetSiblingIndex(P.tab.transform.GetSiblingIndex());
        // the fill goes under On, so the cursor's row still lights white over it
        P.fill = fill(rt, "LitFill", 0, 0, w, h, CRV); P.fill.g.rectTransform.SetSiblingIndex(s.b.on.transform.GetSiblingIndex());
        P.w = w; P.sh = sheen(rt, "LitSheen", h, [0.55, 0.65, 1, 0], [0.9, 0.94, 1, 0]);
      });
      R.cells.forEach(function (c) {
        var rt = c.b.rt, w = rt.sizeDelta.x, h = rt.sizeDelta.y, P = c.lit = { foc: null };
        P.halo = img(rt, "LitHalo", 0, 0, w + 100, h + 90, "lb_dot", M.soft, CRN); P.halo.rectTransform.SetSiblingIndex(0);
        P.rim = img(rt, "LitRim", 0, 0, w + 6, h + 6, "lb_btn", M.glow, CRN, 0, true); P.rim.rectTransform.SetSiblingIndex(1);
      });
      log("crystals: built");
    } catch (e) { log("crystals build: " + es(e)); R.lit = null; }
  };
  // once a frame while the screen shows (R.openAt is when it opened): the room fades up and its lines draw in; hexes drift
  // and one at a time catches the light; lights run along the title, the rules, the panel's top edge and the streaks; a new
  // crystal in the detail panel flares the large hex and sends a hex out from it, and runs a light along the panel
  var CRL = [0.62, 0.72, 1], CRGL = [1, 0.86, 0.5];
  L.crFrame = function (R, t) {
    var Q = R.lit; if (!Q) return;
    try {
      var op = R.openAt || 0, o = t - op, fi = ease(o / 0.45);
      if (Q.cg && Math.abs(Q.cg.alpha - fi) > 0.003) Q.cg.alpha = fi;
      if (o < 1.2 || !Q.drawn) { Q.grow.forEach(function (s) { drawIn(s, (o - s.d) / s.u); }); Q.drawn = o >= 1.2; }
      var hk = Math.floor(t / 2.3), hu = t / 2.3 - hk, hs = (hk * 5) % Q.hex.length;
      Q.hex.forEach(function (h, i) {
        moveTo(h.g, h.x + 14 * Math.sin(t * 0.17 + h.p), h.y + 10 * Math.sin(t * 0.23 + h.p * 1.3));
        setC(h.g, [0.3, 0.42, 1], h.a * (0.7 + 0.3 * Math.sin(t * 0.6 + h.p)) + (i == hs ? 0.14 * bell(hu) : 0), 0);
      });
      Q.streak.forEach(function (s) { setC(s.g, CRN, s.a * (0.75 + 0.25 * Math.sin(t * 0.9 + s.p)), 0.1); });
      setC(Q.flare, [0.42, 0.5, 1], 0.34 + 0.08 * Math.sin(t * 1.3), 0);
      setC(Q.tg, [0.3, 0.4, 1], 0.27 + 0.05 * Math.sin(t * 1.1), 0);
      shaftsAt(Q.shaft, t, -1290, 2580, 60, 1); dustAt(Q.dust, t, 1);
      if (Q.bk !== R.bigKey) { if (Q.bk !== undefined && R.bigKey) Q.bigAt = t; Q.bk = R.bigKey; }
      if (Q.dk !== R.dkey) { if (Q.dk !== undefined && R.dkey) Q.detAt = t; Q.dk = R.dkey; }
      var bw = Math.max(0, 1 - (t - (Q.bigAt || -9)) / 0.5), bu = once(t, Q.bigAt || -9, 0.55);
      setC(Q.bigHalo, [0.3, 0.42, 1], 0.7 + 0.15 * Math.sin(t * 2.2) + 0.3 * bw, 0);
      setC(Q.bigRing, CRN, 1, 0.15 + 0.1 * Math.sin(t * 2.2) + 0.55 * bw);
      if (bu >= 0) scaleTo(Q.burst, 1 + 0.8 * ease(bu));
      lum(Q.burst, CRL, bu >= 0 ? 0.85 * (1 - bu) * (1 - bu) : 0, 0.25);
      var dw = Math.max(0, 1 - (t - (Q.detAt || -9)) / 0.5);
      setC(Q.panelRim, CRN, 0.65 + 0.12 * Math.sin(t * 1.6) + 0.3 * dw, 0.4 * dw);
      fillAt(Q.pfill, t, 3.1, 1 + 0.5 * dw);
      // the lights: each on its own clock from the open; the panel's runs at once when its crystal changes
      var dp = once(t, Q.detAt || -9, 0.6);
      cometAt(Q.runT, pass(t, op + 0.5, 5.8, 1.2), CRL, 0.9);
      cometAt(Q.runR, pass(t, op + 1.5, 5.8, 0.9), CRL, 0.6);
      cometAt(Q.runL, pass(t, op + 1.2, 6.6, 1.1), CRGL, 0.8);
      cometAt(Q.runP, dp >= 0 ? dp : pass(t, op + 2.6, 7.1, 1.5), CRL, 0.8);
      cometAt(Q.runS[0], pass(t, op + 3.3, 9.4, 1.3), CRL, 0.7);
      cometAt(Q.runS[1], pass(t, op + 6.1, 9.4, 1.0), CRL, 0.6);
      cometAt(Q.runS[2], pass(t, op + 4.4, 11, 1.1), CRL, 0.55);
    } catch (e) { if (!L.crerr) { L.crerr = true; log("crystals frame: " + es(e)); } }
  };
  // for a hot reload of this file: take away everything crBuild made
  L.crKill = function (R) {
    kill(R.rt.Find("Lit")); kill(R.big.Find("LitHex"));
    R.slots.forEach(function (s) { ["LitHalo", "LitRim", "LitTab", "LitTabRim", "LitFill", "LitSheenB", "LitSheenS", "LitSheenT"].forEach(function (n) { kill(s.b.rt.Find(n)); }); s.lit = null; });
    R.cells.forEach(function (c) { ["LitHalo", "LitRim"].forEach(function (n) { kill(c.b.rt.Find(n)); }); c.lit = null; });
    R.lit = null;
  };
  // f: 1 the cursor's row, 0.6 the row a crystal is being chosen for, 0 the rest. After the slide-in the focused row
  // stands out to the right
  L.crRow = function (R, s, f, t, settled) {
    var P = s.lit; if (!P) return;
    try {
      if (P.foc !== f) { if (f == 1) P.at = t; P.foc = f; }
      var k = f == 1 ? Math.max(0, 1 - (t - P.at) / 0.3) : 0;
      setC(P.rim, CRN, f ? 0.85 + 0.15 * f : 0.34, k * 0.6);
      setC(P.halo, CRN, f ? (0.75 + 0.15 * Math.sin(t * 3.4)) * f + 0.3 * k : 0, 0);
      setC(P.tabRim, CRN, f ? 0.8 : 0.4, 0);
      fillAt(P.fill, t, P.ph, f ? 1 : 0.8);
      // a sheen crosses the cursor's row as it arrives, then again now and then
      var su = f == 1 ? once(t, P.at, 0.5) : -1; if (su < 0 && f == 1) su = pass(t, P.at + 1.4, 4.6, 0.75);
      sheenAt(P.sh, su, -P.w / 2, P.w, 0, 1);
      if (settled) {
        P.off += ((f == 1 ? 28 : 0) - P.off) * 0.25;
        var p = s.b.rt.anchoredPosition; if (Math.abs(p.x - (P.bx + P.off)) > 0.05) s.b.rt.anchoredPosition = new UE.Vector2(P.bx + P.off, p.y);
      }
    } catch (e) { if (!L.crerr2) { L.crerr2 = true; log("crystals row: " + es(e)); } }
  };
  L.crCell = function (R, c, foc, t) {
    var P = c.lit; if (!P) return;
    try {
      if (P.foc !== foc) { P.foc = foc; if (foc) P.at = t; }
      var k = foc ? Math.max(0, 1 - (t - P.at) / 0.3) : 0;
      setC(P.rim, CRN, foc ? 1 : 0.3, k * 0.6);
      setC(P.halo, CRN, foc ? 0.42 + 0.1 * Math.sin(t * 4) + 0.4 * k : 0, 0);
    } catch (e) { if (!L.crerr3) { L.crerr3 = true; log("crystals cell: " + es(e)); } }
  };
  // ---- Legacy I and II (fourlobbyevo.js): the mockup's crimson room (local_only/redux/v4shots/gpt/mock_legacy). A bright
  // magenta band rising behind the detail panel with neon edges and a light that runs up it, crimson fog, hexes drifting at
  // the top right and the left, shallow streaks, smoke and embers; a pink rim round every row and chip, a gold halo and a
  // hex mesh on the cursor's row, and a bevelled crimson frame round the panel that flares when its Evotype changes ----
  var LGN = [1, 0.17, 0.42], LGG = [1, 0.78, 0.3], LGB = 76.9;   // LGB: the band's angle, from the mockup
  function kill(t) { if (t) UE.Object.Destroy(t.gameObject); }
  L.lgKill = function (Z) {
    ["Lit", "LitFrame", "LitFrameIn", "LitDim"].forEach(function (n) { kill(Z.root.Find(n)); });
    Z.rows.forEach(function (row) { kill(row.tr.Find("LitHalo")); var sl = row.cg.transform; kill(sl.Find("LitRim")); kill(sl.Find("LitHex")); row.lgl = null; });
    Z.sortChips.concat(Z.elChips, [Z.heroChip, Z.tacChip, Z.skillChip]).forEach(function (c) { if (c && c.rt) { kill(c.rt.Find("LitRim")); c.lgl = null; } });
    Z.lit = null;
  };
  L.lgBuild = function (Z, S) {
    try {
      if (!ready(S)) { log("legacy: no lobby Fx materials: no light"); return; }
      L.lgKill(Z);
      var back = node(Z.root, "Lit"); back.SetSiblingIndex(Z.veil.transform.GetSiblingIndex() + 1); back.sizeDelta = new UE.Vector2(2580, 1080);
      var Q = Z.lit = { back: back, hex: [], streak: [], grow: [], rows: [], chips: [] };
      img(back, "FogL", -1000, -380, 1500, 860, "lb_dot", M.soft, [0.5, 0.03, 0.12, 0.5]);
      img(back, "FogMid", -100, 60, 2300, 1100, "lb_dot", M.soft, [0.36, 0.02, 0.1, 0.3]);
      Q.fogTR = img(back, "FogTR", 960, 380, 1500, 760, "lb_dot", M.soft, [0.86, 0.08, 0.32, 0.42]);
      img(back, "FogBR", 1100, -420, 1100, 760, "lb_dot", M.soft, [0.7, 0.05, 0.24, 0.32]);
      // the band: a wide glow along it, its two neon edges and a faint third line to its right
      Q.band = img(back, "Band", 560, 0, 1500, 430, "lb_dot", M.flick, [0.85, 0.08, 0.3, 0.3], LGB);
      Q.bandCore = img(back, "BandCore", 520, -60, 1250, 170, "lb_dot", M.soft, [1, 0.3, 0.55, 0.3], LGB);
      [[242, -540, 524, 540, 46, M.hot, 0.85], [625, -540, 846, 540, 36, M.line, 0.6], [1010, -540, 1200, 540, 30, M.line, 0.3]].forEach(function (s, i) {
        var g = seam(back, "BandEdge" + i, s[0], s[1], s[2], s[3], s[4], s[5], LGN);
        var r = g.rectTransform, len = r.sizeDelta.x; r.pivot = new UE.Vector2(0, 0.5); r.anchoredPosition = new UE.Vector2(s[0], s[1]);
        Q.grow.push({ g: g, len: len, a: s[6], d: i * 0.06 });
      });
      // a light that runs up the band's left edge every few seconds
      Q.runner = img(back, "Runner", 242, -540, 260, 110, "lb_dot", M.glow, [1, 0.55, 0.75, 0], LGB);
      // hexes: a cluster in the top right corner and one at the left, drifting slowly
      [[1050, 500, 150], [1180, 470, 130], [1250, 360, 110], [1110, 340, 90], [960, 420, 80],
       [-1220, 300, 140], [-1100, 200, 120], [-1230, 110, 110], [-1010, 70, 90], [-1150, -10, 80]].forEach(function (h, i) {
        var g = img(back, "Hex" + i, h[0], h[1], h[2], h[2] * 1.13, "lb_hex_mask", null, [1, 0.3, 0.5, 0.08]);
        Q.hex.push({ g: g, x: h[0], y: h[1], p: i * 1.9, a: 0.035 + (i % 3) * 0.02 });
      });
      // shallow streaks across the left, the foot and the right
      [[-1290, -110, -940, -12, 34, 0.55], [-1290, -386, -880, -288, 30, 0.45], [-1250, 452, -1150, 466, 20, 0.7],
       [1080, -110, 1290, -50, 28, 0.5], [-180, -540, 300, -420, 28, 0.3], [-1290, 40, -1160, 70, 18, 0.5]].forEach(function (s, i) {
        Q.streak.push({ g: seam(back, "Streak" + i, s[0], s[1], s[2], s[3], s[4], M.line, LGN), a: s[5], p: i * 2.1 });
      });
      var sm = img(back, "Smoke", 0, -540, 2700, 300, null, M.smoke, [0.8, 0.06, 0.24, 0.32]); sm.rectTransform.pivot = new UE.Vector2(0.5, 0);
      img(back, "Motes", 0, 0, 2580, 1080, null, M.embers, [1, 0.35, 0.55, 0.85]);
      // the card back's band follows the mockup's slant and place
      Z.cardFx.anchoredPosition = new UE.Vector2(Z.panel.anchoredPosition.x - 170, Z.panel.anchoredPosition.y);
      Z.cardFx.localEulerAngles = new UE.Vector3(0, 0, -6);
      Z.cardFx.SetSiblingIndex(back.GetSiblingIndex() + 1);   // behind the chips it crossed
      // the panel's frame: a pink glow, a neon rim with cut corners, a dark bevel, then the panel; lines and a hex mesh inside it
      var pn = Z.panel, pw = pn.sizeDelta.x, ph = pn.sizeDelta.y, px = pn.anchoredPosition.x, py = pn.anchoredPosition.y;
      var fr = node(Z.root, "LitFrame"); fr.SetSiblingIndex(pn.GetSiblingIndex()); fr.sizeDelta = new UE.Vector2(10, 10); fr.anchoredPosition = new UE.Vector2(px, py);
      Q.pHalo = img(fr, "Halo", 0, 0, pw + 300, ph + 260, "lb_dot", M.soft, [0.9, 0.1, 0.36, 0.3]);
      Q.pRim = img(fr, "Rim", 0, 0, pw + 2, ph + 2, "lb_btn", M.glow, [1, 0.5, 0.64, 0.6], 0, true);
      img(fr, "Bevel", 0, 0, pw, ph, "lb_btn", null, [0.16, 0.03, 0.08, 1], 0, true);
      Q.pRim2 = img(fr, "Rim2", 0, 0, pw + 2, ph + 2, "lb_btn", M.glow, [1, 0.82, 0.88, 0.4], 0, true);
      Z.panelImg.color = new UE.Color(0.55, 0.42, 0.5, 1);
      var fi = node(Z.root, "LitFrameIn"); fi.SetSiblingIndex(pn.GetSiblingIndex() + 1); fi.sizeDelta = new UE.Vector2(10, 10); fi.anchoredPosition = new UE.Vector2(px, py);
      var band = node(fi, "Band"), BW = 13;
      [[0, ph / 2, pw, 0, -1], [0, -ph / 2, pw, 0, 1], [-pw / 2, 0, ph, 1, 0], [pw / 2, 0, ph, -1, 0]].forEach(function (e, k) {
        var hz = e[3] == 0, at = function (d, th, c, n) { img(band, n + k, e[0] + e[3] * d, e[1] + e[4] * d, hz ? e[2] : th, hz ? th : e[2], null, null, c); };
        at(BW / 2, BW, [0.33, 0.21, 0.27, 1], "Band"); at(1.5, 3, [0.6, 0.47, 0.52, 1], "Out"); at(BW - 1.5, 3, [0.46, 0.34, 0.38, 1], "In");
      });
      Q.pTop = seam(fi, "Top", -pw / 2 + 40, ph / 2 - BW + 1, pw / 2 - 30, ph / 2 - BW + 1, 24, M.hot, [LGN[0], LGN[1], LGN[2], 0.75]);
      seam(fi, "Left", -pw / 2 + BW - 1, ph / 2 - 40, -pw / 2 + BW - 1, -ph / 2 + 60, 18, M.line, [LGN[0], LGN[1], LGN[2], 0.45]);
      seam(fi, "Foot", -pw / 2 + 60, -ph / 2 + BW - 1, pw / 2 - 40, -ph / 2 + BW - 1, 18, M.line, [LGN[0], LGN[1], LGN[2], 0.45]);
      Q.pCut = [seam(fi, "CutTR", pw / 2 - 46, ph / 2 + 1, pw / 2 + 1, ph / 2 - 46, 16, M.hot, [1, 0.8, 0.88, 0.7]),
                seam(fi, "CutBL", -pw / 2 - 1, -ph / 2 + 46, -pw / 2 + 46, -ph / 2 - 1, 16, M.hot, [1, 0.8, 0.88, 0.7])];
      Q.pHex = [];
      [[pw / 2 - 70, -ph / 2 + 70, 70], [pw / 2 - 130, -ph / 2 + 104, 60], [pw / 2 - 128, -ph / 2 + 36, 56], [pw / 2 - 64, -ph / 2 + 150, 56], [pw / 2 - 186, -ph / 2 + 70, 48]].forEach(function (h, i) {
        Q.pHex.push({ g: img(fi, "Hex" + i, h[0], h[1], h[2], h[2] * 1.13, "lb_hex_mask", null, [1, 0.3, 0.5, 0.07]), p: i * 1.3 });
      });
      // every row: a pink rim the row's own shape, a gold halo behind it, a hex mesh at its right end.
      // The shape is the row body's sprite: the depth pass copies it into Slab0, but only runs with 3D on
      Z.rows.forEach(function (row) {
        var slide = row.cg.transform, body = slide.Find("Body"), shape = body ? body.GetComponent(T(UI.Image)) : null, P = row.lgl = { foc: null, at: -9 };
        P.halo = img(row.tr, "LitHalo", 0, 0, row.rt.sizeDelta.x + 220, row.rt.sizeDelta.y + 130, "lb_dot", M.soft, [LGG[0], LGG[1], LGG[2], 0]);
        P.halo.rectTransform.SetSiblingIndex(0);
        P.rim = img(slide, "LitRim", 0, 0, 10, 10, null, M.glow, [LGN[0], LGN[1], LGN[2], 0.4]); if (shape) P.rim.sprite = shape.sprite;
        var rr = P.rim.rectTransform; rr.anchorMin = UE.Vector2.zero; rr.anchorMax = UE.Vector2.one; rr.sizeDelta = new UE.Vector2(10, 10); rr.SetSiblingIndex(0);
        var hx = node(slide, "LitHex"); hx.anchorMin = hx.anchorMax = new UE.Vector2(1, 0.5); hx.anchoredPosition = new UE.Vector2(-110, 0);
        hx.SetSiblingIndex(slide.Find("Glow").GetSiblingIndex() + 1);
        P.hex = [[-40, 18, 40], [0, -6, 40], [40, 18, 40], [-40, -30, 40], [40, -30, 40], [80, -6, 40], [-80, -6, 40]].map(function (h, i) {
          return { g: img(hx, "H" + i, h[0], h[1], h[2], h[2] * 1.13, "lb_hex_mask", null, [LGG[0], LGG[1], LGG[2], 0]), p: i * 0.8 };
        });
        Q.rows.push(row);
      });
      // every chip: a pink rim its own shape
      Z.sortChips.concat(Z.elChips, [Z.heroChip, Z.tacChip, Z.skillChip]).forEach(function (c) {
        if (!c || !c.off) return;
        var r = img(c.rt, "LitRim", 0, 0, 8, 8, null, M.glow, [LGN[0], LGN[1], LGN[2], 0.35]); r.sprite = c.off.sprite;
        var rr = r.rectTransform; rr.anchorMin = c.off.rectTransform.anchorMin; rr.anchorMax = c.off.rectTransform.anchorMax;
        rr.anchoredPosition = c.off.rectTransform.anchoredPosition; rr.sizeDelta = new UE.Vector2(c.off.rectTransform.sizeDelta.x + 8, c.off.rectTransform.sizeDelta.y + 8);
        rr.SetSiblingIndex(c.off.transform.GetSiblingIndex());
        c.lgl = { rim: r }; Q.chips.push(c);
      });
      log("legacy: built");
    } catch (e) { log("legacy build: " + es(e)); Z.lit = null; }
  };
  var LGDIM = 0.5;
  function dimFx(h) {
    var gs = h.GetComponentsInChildren(T(UI.Graphic), true); if (!gs.Length) return false;
    for (var i = 0; i < gs.Length; i++) {
      var g = gs.get_Item(i), m = null; try { m = g.material; } catch (e) { continue; }
      if (!m || !m.HasProperty("_TintColor") || String(m.name).endsWith(" bbd")) continue;
      var c = m.GetColor("_TintColor"); m = new UE.Material(m); m.name = m.name + " bbd";
      m.SetColor("_TintColor", new UE.Color(c.r * LGDIM, c.g * LGDIM, c.b * LGDIM, c.a)); g.material = m;
    }
    return true;
  }
  L.lgFrame = function (Z, t) {
    var Q = Z.lit; if (!Q) return;
    try {
      if (Z.cardBack && Z.cardTinted !== false && Q.dimmed !== Z.cardBack && !Z.cardBack.Equals(null) && dimFx(Z.cardBack)) Q.dimmed = Z.cardBack;
      var o = Math.max(0, t - (Z.openAt || 0));
      // on opening the band's edges draw up from the floor, quick in, slow out
      Q.grow.forEach(function (s) {
        var u = Math.min(1, Math.max(0, (o - s.d) / 0.45)), e = 1 - Math.pow(1 - u, 3), r = s.g.rectTransform;
        var w = Math.max(1, s.len * e); if (Math.abs(r.sizeDelta.x - w) > 0.5) r.sizeDelta = new UE.Vector2(w, r.sizeDelta.y);
        setC(s.g, LGN, s.a * (0.85 + 0.15 * Math.sin(t * 1.1 + s.d * 20)), u < 1 ? (1 - u) * 0.5 : 0);
      });
      var bi = Math.min(1, o / 0.5);
      setC(Q.band, [0.85, 0.08, 0.3], bi * (0.26 + 0.05 * Math.sin(t * 0.8)), 0);
      setC(Q.bandCore, [1, 0.3, 0.55], bi * (0.16 + 0.05 * Math.sin(t * 1.3 + 1)), 0);
      setC(Q.fogTR, [0.7, 0.05, 0.24], 0.26 + 0.05 * Math.sin(t * 0.5), 0);
      // the runner: up the band's left edge in 1.1 s, every 3.6 s
      var ru = ((t + 1.4) % 3.6) / 1.1, rr = Q.runner.rectTransform;
      if (ru <= 1) { var ee = ru * ru * (3 - 2 * ru); rr.anchoredPosition = new UE.Vector2(242 + 282 * ee, -540 + 1080 * ee); setC(Q.runner, [1, 0.55, 0.75], 0.9 * Math.sin(Math.PI * ru), 0.2); }
      else setC(Q.runner, [1, 0.55, 0.75], 0, 0);
      Q.hex.forEach(function (h) {
        h.g.rectTransform.anchoredPosition = new UE.Vector2(h.x + 12 * Math.sin(t * 0.17 + h.p), h.y + 9 * Math.sin(t * 0.23 + h.p * 1.3));
        setC(h.g, [1, 0.3, 0.5], h.a * (0.7 + 0.3 * Math.sin(t * 0.6 + h.p)), 0);
      });
      Q.streak.forEach(function (s) { setC(s.g, LGN, s.a * (0.75 + 0.25 * Math.sin(t * 0.9 + s.p)), 0.1); });
      // the panel's frame flares white-pink when its Evotype changes, then breathes
      var k = Math.max(0, 1 - (t - (Z.panelAt || -9)) / 0.35);
      setC(Q.pRim, [1, 0.5, 0.64], 0.55 + 0.08 * Math.sin(t * 1.6) + 0.3 * k, k * 0.55);
      setC(Q.pRim2, [1, 0.82, 0.88], 0.36 + 0.3 * k, k * 0.4);
      setC(Q.pHalo, [0.9, 0.1, 0.36], 0.26 + 0.05 * Math.sin(t * 1.2) + 0.25 * k, 0);
      Q.pCut.forEach(function (g, i) { setC(g, [1, 0.8, 0.88], 0.6 + 0.2 * Math.sin(t * 2 + i * 3) + 0.3 * k, 0.2 + k * 0.5); });
      setC(Q.pTop, LGN, 0.7 + 0.25 * k, k * 0.5);
      Q.pHex.forEach(function (h) { setC(h.g, [1, 0.3, 0.5], 0.05 + 0.04 * Math.sin(t * 0.9 + h.p), 0); });
      Q.chips.forEach(function (c) {
        var sel = c.on && c.on.color.a > 0.5, foc = c.glow && c.glow.color.a > 0.2;
        setC(c.lgl.rim, sel ? LGG : LGN, foc ? 0.95 : sel ? 0.6 : 0.34, foc ? 0.3 : 0);
      });
    } catch (e) { if (!L.lgerr) { L.lgerr = true; log("legacy frame: " + es(e)); } }
  };
  // the cursor's row: a gold halo that swells as it lands and breathes, its hex mesh shimmering; the rest keep a pink rim
  L.lgRow = function (Z, row, foc, t) {
    var P = row.lgl; if (!P) return;
    try {
      if (P.foc !== foc) { P.foc = foc; if (foc) P.at = t; }
      var k = foc ? Math.max(0, 1 - (t - P.at) / 0.3) : 0;
      setC(P.halo, LGG, foc ? 0.32 + 0.08 * Math.sin(t * 3.4) + 0.35 * k : 0, 0);
      setC(P.rim, foc ? LGG : LGN, foc ? 0.9 : 0.4, k * 0.6);
      P.hex.forEach(function (h) { setC(h.g, LGG, foc ? 0.1 + 0.08 * Math.sin(t * 2.6 + h.p) + 0.2 * k : 0, 0); });
    } catch (e) { if (!L.lgerr2) { L.lgerr2 = true; log("legacy row: " + es(e)); } }
  };
  // ---- motion shared by the screens (the lead, 2026-11-03: "Animate the UI elements ... Add real-time VFX ... Animate the
  // background ... advanced motion graphics and motion design"): eases, timed passes, lines that draw themselves in, a light
  // that runs along a line, a sheen across a bar, slow light shafts and drifting dust ----
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(u) { u = 1 - clamp01(u); return 1 - u * u * u; }                 // fast in, slow out
  function eob(u) { u = clamp01(u) - 1; return 1 + u * u * (2.7 * u + 1.7); }    // runs a little past, settles back
  function wrap(v, n) { return ((v % n) + n) % n; }
  function bell(u) { return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u); }
  // how far t is through a pass of dur s from t0, 0 to 1 (-1 outside it); pass repeats it every `every` s
  function once(t, t0, dur) { var u = (t - t0) / dur; return u < 0 || u >= 1 ? -1 : u; }
  function pass(t, t0, every, dur) { return t < t0 ? -1 : once(wrap(t - t0, every), 0, dur); }
  // a light's colour and strength; switched off while it would not show
  function lum(g, c, a, k) { var on = a > 0.004; if (g.enabled != on) g.enabled = on; if (on) setC(g, c, a, k || 0); }
  function moveTo(g, x, y) { var r = g.rectTransform, p = r.anchoredPosition; if (Math.abs(p.x - x) + Math.abs(p.y - y) > 0.25) r.anchoredPosition = new UE.Vector2(x, y); }
  function scaleTo(g, s) { var r = g.rectTransform; if (Math.abs(r.localScale.x - s) > 0.002) r.localScale = new UE.Vector3(s, s, 1); }
  // a neon line that draws itself in from its first end
  function grow(par, name, x0, y0, x1, y1, th, m, c) {
    var g = seam(par, name, x0, y0, x1, y1, th, m, c), r = g.rectTransform;
    r.pivot = new UE.Vector2(0, 0.5); r.anchoredPosition = new UE.Vector2(x0, y0);
    return { g: g, len: r.sizeDelta.x, th: th, c: c };
  }
  function drawIn(s, u) { var r = s.g.rectTransform, w = Math.max(1, s.len * ease(u)); if (Math.abs(r.sizeDelta.x - w) > 0.5) r.sizeDelta = new UE.Vector2(w, s.th); }
  // a light that runs along a line: a bright head, a glow just behind it, a long faint tail (w scales it)
  function comet(par, name, x0, y0, x1, y1, w) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy), deg = Math.atan2(dy, dx) * 180 / Math.PI;
    var q = { x0: x0, y0: y0, ux: dx / len, uy: dy / len, len: len, w: w || 1, s: [] };
    [["Tail", 300, 30], ["Mid", 130, 44], ["Head", 64, 52]].forEach(function (p) {
      var g = img(par, name + p[0], x0, y0, p[1] * q.w, p[2] * q.w, "lb_dot", M.glow, [1, 1, 1, 0], deg); g.enabled = false; q.s.push(g);
    });
    return q;
  }
  var CBACK = [150, 55, 0], CA = [0.32, 0.6, 1], CK = [0, 0.25, 0.65];
  // u: 0 to 1 along the line (outside it the light is off), in colour c at strength a
  function cometAt(q, u, c, a) {
    var on = u >= 0 && u <= 1, e = u * u * (3 - 2 * u), f = on ? Math.min(1, u / 0.12, (1 - u) / 0.18) : 0;
    for (var i = 0; i < 3; i++) {
      var g = q.s[i]; if (f <= 0) { if (g.enabled) g.enabled = false; continue; }
      var d = q.len * e - CBACK[i] * q.w; moveTo(g, q.x0 + q.ux * d, q.y0 + q.uy * d); lum(g, c, a * CA[i] * f, CK[i]);
    }
  }
  // a sheen across a bar h tall: a soft band and two slanted stripes (the Legacy kit's numbers)
  function sheen(par, name, h, cB, cS) {
    var s = [img(par, name + "B", 0, 0, 1.85 * h, h, "lb_dot", M.glow, cB), img(par, name + "S", 0, 0, 0.2 * h, 1.28 * h, "lb_dot", M.glow, cS, -22),
      img(par, name + "T", 0, 0, 0.09 * h, 1.18 * h, "lb_dot", M.glow, cS, -22)];
    s.forEach(function (g) { g.enabled = false; }); return { s: s, cB: cB, cS: cS };
  }
  // the mockup's bar fill: navy lit blue-violet along the bottom edge and at the left, with a softer light drifting along
  // it. Soft lights under a mask of the bar's own slanted shape (lb_btn, sliced); the mask itself draws nothing. The lights
  // keep the default UI material: the mask clips only what draws with the stencil properties
  function fill(par, name, x, y, w, h, c) {
    var g = img(par, name, x, y, w, h, "lb_btn", null, [1, 1, 1, 1], 0, true), r = g.rectTransform;
    g.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false;
    function lit(n, lx, ly, lw, lh) { return img(r, n, lx, ly, lw, lh, "lb_dot", null, [c[0], c[1], c[2], 0]); }
    return { g: g, w: w, h: h, c: c, bot: lit("Bot", 0, -h / 2, w * 1.25, h * 1.5), left: lit("Left", -w / 2 + Math.min(w * 0.12, 130), 0, Math.min(w * 0.5, 420), h * 2.4),
      run: lit("Run", 0, -h * 0.2, Math.min(w * 0.42, 420), h * 1.7) };
  }
  // p: the bar's own phase; a: its strength. The edge and the left breathe; the drifting light crosses every 7.5 s
  function fillAt(F, t, p, a) {
    if (!F) return;
    setC(F.bot, F.c, a * (0.5 + 0.12 * Math.sin(t * 0.9 + p)), 0);
    setC(F.left, F.c, a * (0.32 + 0.1 * Math.sin(t * 0.7 + p * 1.7)), 0);
    var u = wrap(t / 7.5 + p * 0.13, 1);
    moveTo(F.run, -F.w / 2 - 120 + (F.w + 240) * u, -F.h * 0.2); setC(F.run, F.c, a * 0.4 * Math.sin(Math.PI * u), 0.15);
  }
  var SH_DX = [10, 0, 24], SH_A = [0.16, 0.45, 0.3];
  function sheenAt(q, u, x0, len, y, a) {
    for (var i = 0; i < 3; i++) {
      var g = q.s[i]; if (u < 0 || u > 1) { if (g.enabled) g.enabled = false; continue; }
      moveTo(g, x0 + len * u + SH_DX[i], y); lum(g, i ? q.cS : q.cB, a * SH_A[i] * bell(u), 0);
    }
  }
  // light shafts crossing a region slowly, each [phase, length, thickness, angle, alpha, period]
  var SHAFTS = [[0.05, 1900, 170, 34, 0.12, 26], [0.45, 1500, 80, 38, 0.1, 31], [0.75, 2200, 260, 31, 0.07, 37]];
  function shafts(par, c) { return SHAFTS.map(function (q, i) { var g = img(par, "Shaft" + i, 0, 0, q[1], q[2], "lb_dot", M.soft, [c[0], c[1], c[2], 0], q[3]); g.enabled = false; return { g: g, q: q, c: c }; }); }
  function shaftsAt(list, t, x0, w, y, fi) {
    list.forEach(function (s, i) {
      var q = s.q, f = wrap(t / q[5] + q[0], 1);
      moveTo(s.g, x0 - 500 + (w + 1000) * f, y + 120 * Math.sin(6.2832 * f + i)); lum(s.g, s.c, fi * q[4] * Math.sin(Math.PI * f), 0);
    });
  }
  // dust drifting up through a region (x0, y0 its bottom left), soft and out of focus
  function dust(par, c, x0, y0, w, h, n, seed) {
    var D = { d: [], x0: x0, y0: y0, w: w, h: h, c: c };
    for (var b = 0; b < n; b++) {
      var s = 14 + (b * 37 + seed) % 60, g = img(par, "Dust" + b, 0, 0, s, s, "lb_dot", M.glow, [c[0], c[1], c[2], 0]); g.enabled = false;
      D.d.push({ g: g, x: x0 + (b * 733 + 211 + seed) % w, y: (b * 397 + 90 + seed) % h, v: 9 + (b * 5) % 16, a: 0.06 + 0.025 * (b % 4), p: b * 1.3 });
    }
    return D;
  }
  function dustAt(D, t, fi) {
    var n = D.h + 120;
    D.d.forEach(function (q) {
      var y = wrap(q.y + q.v * t, n) - 60;
      moveTo(q.g, q.x + 22 * Math.sin(0.4 * t + q.p), D.y0 + y); lum(q.g, D.c, fi * q.a * Math.sin(Math.PI * clamp01((y + 60) / n)), 0);
    });
  }

  // ---- Colours (fourselpanels.js; the approved mockup local_only/redux/v4shots/gpt/mock_colours): the hero on a dark stage,
  // hot red neon down the slab's edge, a kinked neon bar top left with light running through it, an outline honeycomb along the
  // top, the stage's front edge lit, red ticks after the title, the info bar framed in neon, a gold rim on the cursor's row.
  // coBuild once from buildColours, coFrame once a frame and coRow from drawColours' row loop ----
  var COR = [1, 0.16, 0.3], COG = [1, 0.66, 0.2], CORW = [0.85, 0.5, 0.6], HEXD = [0.05, 0.05, 0.075, 0.95], KD = 55;   // KD: the kink's diagonal
  L.coBuild = function (C, S) {
    try {
      if (!ready(S)) { log("colours: no lobby Fx materials: no light"); return; }
      if (C.lit && C.lit.run) kill(C.lit.run);
      ["Lit", "LitTop"].forEach(function (n) { kill(C.rt.Find(n)); });
      C.rows.forEach(function (r) { if (r.lit) { kill(r.lit.halo.transform); kill(r.lit.rim.transform); r.lit = null; } });
      var side = C.rt.Find("Side"), back = node(C.rt, "Lit"); back.SetSiblingIndex(0); back.sizeDelta = new UE.Vector2(2580, 1080);
      var Q = C.lit = { back: back, br: [], slab: [], hatch: [], hex: [], tick: [], lines: [] };
      function breathe(g, c, a, amp, sp, p) { Q.br.push({ g: g, c: c, a: a, amp: amp, sp: sp, p: p }); return g; }
      // the room: a navy lift over the black, red haze low left, top left and along the slab, dark slabs leaning like the kink
      breathe(img(back, "Ambient", -360, 160, 2300, 1000, "lb_dot", M.soft, [0.08, 0.1, 0.26, 0.3]), [0.08, 0.1, 0.26], 0.28, 0.04, 0.3, 0);
      breathe(img(back, "FogL", -900, -420, 1400, 600, "lb_dot", M.soft, [0.62, 0.04, 0.13, 0.45]), [0.62, 0.04, 0.13], 0.42, 0.07, 0.7, 1);
      breathe(img(back, "FogTL", -1050, 380, 1200, 520, "lb_dot", M.soft, [0.55, 0.03, 0.11, 0.3]), [0.55, 0.03, 0.11], 0.3, 0.06, 0.5, 2);
      breathe(img(back, "EdgeHaze", 170, -40, 1200, 420, "lb_dot", M.soft, [0.65, 0.04, 0.15, 0.24], 76), [0.65, 0.04, 0.15], 0.22, 0.05, 0.9, 3);
      [[-1215, 110, 1150, 120, 0.062], [-1010, 330, 760, 92, 0.052], [-860, 470, 480, 70, 0.046], [-1190, -250, 520, 84, 0.042], [-560, 520, 300, 46, 0.04]].forEach(function (s, i) {
        Q.slab.push({ g: img(back, "Slab" + i, s[0], s[1], s[2], s[3], null, null, [s[4] * 1.35, s[4] * 1.5, s[4] * 2.2, 1], KD), x: s[0], y: s[1], p: i * 1.7 });
      });
      // faint red strokes leaning with the slabs, the upper one running down from the kink's foot
      [[-1290, 140, -1164, 291, 22, 0.32], [-1290, -330, -1150, -130, 20, 0.22], [-760, 540, -640, 380, 18, 0.18]].forEach(function (s, i) {
        Q.lines.push({ g: seam(back, "Stroke" + i, s[0], s[1], s[2], s[3], s[4], M.line, [COR[0], COR[1], COR[2], s[5]]), a: s[5], p: i * 2.3 + 1 });
      });
      // the kinked bar: a dark red fill (a block and the wedge under the diagonal), light running up through it, the hot edge
      // along its foot and up the diagonal, a glow at the bend, a second fainter edge splitting off to the right
      img(back, "BarFill", -1183, 416, 214, 250, null, null, [0.2, 0.024, 0.06, 1]);
      img(back, "BarWedge", -1041, 473, 340, 150, null, null, [0.2, 0.024, 0.06, 1], KD);
      breathe(img(back, "BarGlow", -1120, 430, 520, 380, "lb_dot", M.soft, [0.7, 0.05, 0.15, 0.3]), [0.7, 0.05, 0.15], 0.28, 0.06, 1.1, 0.5);
      for (var h = 0; h < 5; h++) { var hg = seam(back, "Hatch" + h, -1077, 291, -903, 540, 14, M.line, [COR[0], COR[1], COR[2], 0]); hg.enabled = false; Q.hatch.push(hg); }
      Q.kinkGlow = img(back, "KinkGlow", -1077, 291, 170, 90, "lb_dot", M.flick, [1, 0.25, 0.4, 0.6]);
      Q.kink = [grow(back, "KinkH", -1290, 291, -1077, 291, 40, M.hot, COR), grow(back, "KinkD", -1077, 291, -903, 540, 44, M.hot, COR)];
      Q.edge2b = grow(back, "BarEdge2", -1007, 380, -877, 540, 30, M.line, [COR[0], COR[1], COR[2], 0.45]);
      // the honeycomb along the top: outline hexes; a wave of light crosses them now and then
      [[-413, 490], [-295, 490], [-59, 490], [59, 490], [177, 490], [-354, 390], [-118, 390], [0, 390], [118, 390], [236, 390], [-59, 290], [177, 290]].forEach(function (p, i) {
        var ring = img(back, "Hex" + i, p[0], p[1], 116, 131, "lb_hex_mask", M.glow, [COR[0], COR[1], COR[2], 0]); ring.enabled = false;
        img(back, "HexIn" + i, p[0], p[1], 106, 120, "lb_hex_mask", null, HEXD);
        Q.hex.push({ g: ring, q: (p[0] + 460) / 760, p: i * 2.1 });
      });
      // the stage: shaded dark like the mockup's (the lobby's floor reads salmon under its own light), its front edge in hot neon
      // with a light that runs along it, the plinth's edge, the stage's two lights
      img(back, "FloorShade", -495, -490, 1590, 126, null, null, [0.035, 0.01, 0.025, 0.74]);
      breathe(img(back, "FloorGlow", -600, -440, 1900, 150, "lb_dot", M.soft, [0.8, 0.06, 0.2, 0.3]), [0.8, 0.06, 0.2], 0.28, 0.05, 1.3, 4);
      Q.floor = grow(back, "Floor", -1290, -427, 88, -427, 46, M.hot, COR);
      Q.plinth = grow(back, "Plinth", -240, -365, 100, -365, 30, M.line, [COR[0], COR[1], COR[2], 0.55]);
      breathe(img(back, "CyanL", -262, -408, 170, 56, "lb_dot", M.flick, [0.3, 0.85, 1, 0.4]), [0.3, 0.85, 1], 0.38, 0.06, 2.3, 0);
      breathe(img(back, "CyanR", -40, -378, 230, 50, "lb_dot", M.flick, [0.3, 0.85, 1, 0.35]), [0.3, 0.85, 1], 0.32, 0.06, 2.9, 2);
      Q.floorRun = comet(back, "FloorRun", -1290, -427, 88, -427, 1);
      var sm = img(back, "Smoke", -560, -540, 1500, 260, null, M.smoke, [0.8, 0.07, 0.2, 0.42]); sm.rectTransform.pivot = new UE.Vector2(0.5, 0);
      img(back, "Embers", -640, -60, 1300, 960, null, M.embers, [1, 0.24, 0.4, 0.85]);
      Q.shaft = shafts(back, [0.9, 0.12, 0.3]);
      Q.dust = dust(back, [1, 0.3, 0.45], -1290, -540, 1450, 1080, 16, 0);
      // over the slab: its edge in hot neon with a fainter line beside it and a halo on the slab's side; it draws down from the top
      var top = node(C.rt, "LitTop"); top.SetSiblingIndex(side ? side.GetSiblingIndex() + 1 : 1); top.sizeDelta = new UE.Vector2(2580, 1080);
      breathe(img(top, "EdgeHalo", 222, 0, 1150, 80, "lb_dot", M.soft, [0.9, 0.08, 0.25, 0.3], 76), [0.9, 0.08, 0.25], 0.28, 0.06, 1.5, 1);
      Q.edge = grow(top, "Edge", 331, 540, 62, -540, 46, M.hot, COR);
      Q.edge2 = grow(top, "Edge2", 301, 540, 92, -300, 26, M.line, [COR[0], COR[1], COR[2], 0.35]);
      Q.edgeRun = comet(top, "EdgeRun", 331, 540, 62, -540, 1.1);
      // the title: a glow behind it, six red ticks after it, a rule under the hero's name
      breathe(img(top, "TitleGlow", 620, 455, 1000, 190, "lb_dot", M.soft, [0.85, 0.08, 0.25, 0.22]), [0.85, 0.08, 0.25], 0.2, 0.04, 0.8, 2);
      Q.tickGlow = img(top, "TickGlow", 1060, 452, 280, 80, "lb_dot", M.soft, [0.9, 0.1, 0.28, 0.25]);
      for (var k = 0; k < 6; k++) Q.tick.push(img(top, "Tick" + k, 996 + k * 27, 452, 12, 32, null, null, COR, -22));
      // more of the honeycomb at the slab's top right corner, clear of the card and the rows
      [[1250, 490], [1191, 390], [1309, 390], [1250, 290]].forEach(function (p, i) {
        var ring = img(top, "Hex" + i, p[0], p[1], 116, 131, "lb_hex_mask", M.glow, [COR[0], COR[1], COR[2], 0]); ring.enabled = false;
        img(top, "HexIn" + i, p[0], p[1], 106, 120, "lb_hex_mask", null, HEXD);
        Q.hex.push({ g: ring, q: 0.35 + (p[1] - 290) / 400, p: i * 1.7 + 0.5 });
      });
      Q.subRule = grow(top, "SubRule", 367, 358, 1120, 358, 20, M.line, [COR[0], COR[1], COR[2], 0.5]);
      // the info bar: a dark plate in a neon rim, its foot lit, a glow at its left end that flares when the colour changes
      Q.infoRim = img(top, "InfoRim", 830, -351, 1008, 70, "lb_btn", M.glow, [COR[0], COR[1], COR[2], 0.5], 0, true);
      img(top, "InfoPlate", 830, -351, 1000, 62, "lb_btn", null, [0.03, 0.012, 0.022, 0.9], 0, true);
      Q.infoFoot = grow(top, "InfoFoot", 340, -384, 1320, -384, 30, M.hot, COR);
      Q.infoGlow = img(top, "InfoGlow", 400, -351, 300, 120, "lb_dot", M.soft, [1, 0.2, 0.35, 0.3]);
      // the slab's right edge and the corner by the button hints: thin neon strokes
      [[1290, 380, 1195, 60, 24, 0.4], [1290, 140, 1240, -30, 20, 0.3], [880, -452, 1290, -452, 22, 0.5], [880, -452, 838, -540, 22, 0.45]].forEach(function (s, i) {
        Q.lines.push({ g: seam(top, "Line" + i, s[0], s[1], s[2], s[3], s[4], M.line, [COR[0], COR[1], COR[2], s[5]]), a: s[5], p: i * 1.9 });
      });
      // the card of colours: a sheen across it when the cursor moves
      Q.cardSheen = sheen(C.cardFx, "LitSheen", 66, [1, 0.7, 0.75], [1, 0.95, 0.97]);
      // the cursor's row: a light runs along its gold rim, top edge left to right and the foot back, moved to the row it lands on
      var rw = C.rows[0].b.rt.sizeDelta.x, rh = C.rows[0].b.rt.sizeDelta.y;
      Q.run = node(C.rt, "LitRun");
      Q.rc = [comet(Q.run, "Top", -rw / 2 + 14, rh / 2 + 3, rw / 2 - 2, rh / 2 + 3, 0.6), comet(Q.run, "Foot", rw / 2 - 14, -rh / 2 - 3, -rw / 2 + 2, -rh / 2 - 3, 0.6)];
      Q.runAt = -9;
      log("colours: built");
    } catch (e) { log("colours build: " + es(e)); C.lit = null; }
  };
  L.coFrame = function (C, t) {
    var Q = C.lit; if (!Q) return;
    try {
      var o = t - (C.openAt || 0), fi = ease(o / 0.5);
      Q.br.forEach(function (b) { lum(b.g, b.c, fi * (b.a + b.amp * Math.sin(t * b.sp + b.p)), 0); });
      Q.slab.forEach(function (s) { var d = 16 * Math.sin(t * 0.13 + s.p); moveTo(s.g, s.x + 0.574 * d, s.y + 0.819 * d); });
      // the open: the slab's edge draws down, the kink blinks on and draws along its bar, the floor, the rules and the info
      // bar's foot draw out, the ticks pop in one after another
      drawIn(Q.edge, o / 0.4); drawIn(Q.edge2, (o - 0.08) / 0.45);
      var eu = clamp01(o / 0.4); lum(Q.edge.g, COR, 1, (1 - eu) * 0.5 + 0.06 * Math.sin(t * 2.1)); lum(Q.edge2.g, COR, 0.35 * fi, 0);
      var bl = o < 0.1 ? 0 : o < 0.45 ? 0.45 + 0.55 * (Math.floor(o / 0.05) % 2) : 0.92 + 0.08 * Math.sin(t * 1.7);
      drawIn(Q.kink[0], (o - 0.1) / 0.15); drawIn(Q.kink[1], (o - 0.22) / 0.22); drawIn(Q.edge2b, (o - 0.3) / 0.3);
      Q.kink.forEach(function (s) { lum(s.g, COR, bl, 0.1); }); lum(Q.edge2b.g, COR, 0.45 * bl, 0);
      lum(Q.kinkGlow, [1, 0.25, 0.4], bl * (0.5 + 0.15 * Math.sin(t * 1.7)), 0);
      drawIn(Q.floor, (o - 0.15) / 0.5); lum(Q.floor.g, COR, fi, 0.05);
      drawIn(Q.plinth, (o - 0.3) / 0.35); lum(Q.plinth.g, COR, 0.55 * fi, 0);
      drawIn(Q.subRule, (o - 0.2) / 0.35); lum(Q.subRule.g, COR, 0.5 * fi, 0);
      drawIn(Q.infoFoot, (o - 0.3) / 0.45); lum(Q.infoFoot.g, COR, 0.85 * fi, 0.05);
      // the ticks: popped in, then a light chases along them every 2.4 s
      var ch = pass(t, (C.openAt || 0) + 0.9, 2.4, 0.9), wp = ch < 0 ? -9 : ch * 1.5 - 0.25;
      Q.tick.forEach(function (g, k) {
        var u = (o - 0.25 - k * 0.04) / 0.22, b = Math.max(0, 1 - Math.abs(wp - k / 5) / 0.22);
        scaleTo(g, u <= 0 ? 0.4 : 0.4 + 0.6 * eob(u)); lum(g, COR, u <= 0 ? 0 : (0.4 + 0.6 * k / 5) * clamp01(u * 3) + 0.5 * b, b * 0.6);
      });
      lum(Q.tickGlow, [0.9, 0.1, 0.28], fi * (0.22 + 0.04 * Math.sin(t * 1.9)) + 0.2 * (ch < 0 ? 0 : bell(ch)), 0);
      // light running up through the bar, a wave across the honeycomb, lights along the slab's edge and the stage's front
      Q.hatch.forEach(function (g, i) {
        var d = wrap(t * 40 + i * 64, 320); moveTo(g, -990 - d, 415.5); lum(g, COR, fi * 0.22 * bell(d / 320), 0);
      });
      var hw = pass(t, (C.openAt || 0) + 1.2, 6.5, 1.6), hp = hw < 0 ? -9 : hw * 1.6 - 0.3;
      Q.hex.forEach(function (h) {
        var b = Math.max(0, 1 - Math.abs(hp - h.q) / 0.16), hf = ease((o - 0.15 - h.q * 0.3) / 0.3);
        lum(h.g, COR, hf * (0.11 + 0.05 * Math.sin(t * 0.7 + h.p) + 0.5 * b), b * 0.4);
      });
      cometAt(Q.edgeRun, pass(t, (C.openAt || 0) + 0.6, 5.5, 1.2), [1, 0.4, 0.55], 1);
      cometAt(Q.floorRun, pass(t, (C.openAt || 0) + 1.4, 6.4, 1.5), [1, 0.4, 0.55], 0.9);
      shaftsAt(Q.shaft, t, -1290, 1600, 40, fi); dustAt(Q.dust, t, fi);
      Q.lines.forEach(function (l) { lum(l.g, COR, fi * l.a * (0.8 + 0.2 * Math.sin(t * 1.2 + l.p)), 0); });
      // the colour changed: the info bar flares, a sheen crosses the card
      var kp = Math.max(0, 1 - (t - (C.popAt || -9)) / 0.4);
      lum(Q.infoGlow, [1, 0.2, 0.35], fi * (0.25 + 0.05 * Math.sin(t * 2)) + 0.5 * kp, 0);
      lum(Q.infoRim, COR, fi * 0.5 + 0.35 * kp, kp * 0.4);
      var su = once(t, (C.popAt || -9) + 0.1, 0.55); if (su < 0) su = pass(t, (C.openAt || 0) + 2, 6, 0.8);
      sheenAt(Q.cardSheen, su, -420, 840, 0, 1);
      // the cursor's row: a light round its rim as it lands, again every 4.5 s
      var ru = once(t, Q.runAt + 0.02, 0.5); if (ru < 0) ru = pass(t, Q.runAt + 4.5, 4.5, 0.7);
      cometAt(Q.rc[0], ru, COG, 1); cometAt(Q.rc[1], ru, COG, 0.8);
    } catch (e) { if (!L.coerr) { L.coerr = true; log("colours frame: " + es(e)); } }
  };
  // per row per frame: the cursor's row gets a gold rim that flashes as it lands and a gold halo; the rest a faint red rim
  L.coRow = function (C, r, foc, t) {
    var Q = C.lit; if (!Q) return;
    try {
      var P = r.lit;
      if (!P) {
        var rt = r.b.rt, w = rt.sizeDelta.x, h = rt.sizeDelta.y; P = r.lit = { foc: null, at: -9 };
        P.halo = img(rt, "LitHalo", 0, 0, w + 200, h + 120, "lb_dot", M.soft, [COG[0], COG[1], COG[2], 0]); P.halo.rectTransform.SetSiblingIndex(0);
        P.rim = img(rt, "LitRim", 0, 0, w + 8, h + 8, "lb_btn", M.glow, [CORW[0], CORW[1], CORW[2], 0.14], 0, true); P.rim.rectTransform.SetSiblingIndex(1);
      }
      if (P.foc !== foc) {
        P.foc = foc;
        if (foc) { P.at = t; Q.runAt = t; Q.run.SetParent(r.b.rt, false); Q.run.anchoredPosition = UE.Vector2.zero; Q.run.SetAsLastSibling(); }
      }
      var k = foc ? Math.max(0, 1 - (t - P.at) / 0.3) : 0;
      lum(P.rim, foc ? COG : CORW, foc ? 0.95 + 0.05 * Math.sin(t * 3) : 0.14, k * 0.7);
      lum(P.halo, COG, foc ? 0.3 + 0.07 * Math.sin(t * 3.4) + 0.4 * k : 0, 0);
    } catch (e) { if (!L.coerr2) { L.coerr2 = true; log("colours row: " + es(e)); } }
  };

  // ---- the lobby V4 (the lead, 2026-11-03: "make and animate and finalize the V4 menus ... make sure they use animated
  // gradients in the final"; the mockup local_only/redux/v4shots/gpt/mock_lobby_view): the top plates filled with a slow
  // gradient and framed in a hot rim that draws in on open, pink neon card frames with red notches at two corners, lit
  // plinths, bar buttons with a gradient fill and a pink foot line, and behind it all an outline honeycomb on the left, red
  // streaks on the right, a glow along the horizon, flashes in the sky. fourlobbyui.js calls lbBuild once from build() and
  // lbFrame once a frame from each branch of its tick ----
  var PINK = [1, 0.2, 0.5], PINKW = [1, 0.45, 0.65];
  function ext(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  function gradMats() {
    if (M.grad) return;
    // mode 9: the tint's ramp read across the canvas through slow noise, a band of light drifting over it
    var g = { Mode: 9, TintRamp: 1, NoisePx: 900, Speed: 0.08, Distort: 0.6, Occlude: 0.92, GradLo: 0.02, GradHi: 0.3, Period: 5, Width: 0.14, Angle: 20, Band: 0.55, TexMix: 0, Intensity: 1, Flicker: 0 };
    M.grad = mat("Lb_Glow", "grad", g);
    M.gradBtn = mat("Lb_Glow", "gradBtn", ext(g, { Period: 0, Band: 0, GradLo: 0, GradHi: 0.13 }));
    M.gradOn = mat("Lb_Glow", "gradOn", ext(g, { Period: 0, Band: 0, GradLo: 0.3, GradHi: 0.62, Speed: 0.16 }));
  }
  // a flat graphic made after the 3D pass gave the lobby's plain graphics its material takes it too, or it draws off the plane
  function pic3d(g) { var D = G.BB4UI3D; if (D && D.ok && D.ui3d) g.material = D.ui3d; return g; }
  // a picture filling its parent (grown by gx, gy)
  function fimg(par, name, sp, m, c, gx, gy, sliced) {
    var rt = node(par, name); rt.anchorMin = new UE.Vector2(0, 0); rt.anchorMax = new UE.Vector2(1, 1);
    rt.sizeDelta = new UE.Vector2(gx || 0, gy == null ? (gx || 0) : gy); rt.anchoredPosition = new UE.Vector2(0, 0);
    var im = rt.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false;
    if (sp) { im.sprite = sp; if (sliced) im.type = 1; } if (m) im.material = m; im.color = col(c); return im;
  }
  // a picture over another one's rect (grown by grow), with that one's sprite
  function over(par, name, src, m, c, grow) {
    var rt = node(par, name); copyRect(rt, src, grow); var si = src.GetComponent(T(UI.Image));
    var im = rt.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false;
    if (si) { im.sprite = si.sprite; im.type = si.type; } if (m) im.material = m; im.color = col(c); return im;
  }
  function afterSlabs(par) { var n = 0; for (var i = 0; i < par.childCount; i++) if (par.GetChild(i).name.indexOf("Slab") == 0) n = i + 1; return n; }
  function off(c) { return [c[0], c[1], c[2], 0]; }
  // the corner numbers are each plate's face measured from its centre: TL, TR, BR, BL
  var PLATES = { Title: [[-337, 56], [359, 56], [336, -56], [-360, -56]], Info: [[-237, 56], [259, 56], [236, -56], [-260, -56]] };
  function plateBuild(S, Q, name) {
    var p = S.ui.Find(name), pt = PLATES[name]; if (!p) return null;
    var si = p.GetComponent(T(UI.Image)), at = afterSlabs(p), tl = pt[0], tr = pt[1], br = pt[2], bl = pt[3], o = 12;
    var gr = fimg(p, "LitGrad", si ? si.sprite : null, M.grad, COR); if (si) gr.type = si.type; gr.transform.SetSiblingIndex(at);
    var e = node(p, "LitEdge"); e.SetSiblingIndex(at + 1); Q.made.push(gr.transform, e);
    var P = { gr: gr, rim: [], br: [], cm: comet(e, "Run", tl[0], tl[1], tr[0], tr[1], 0.8), ph: Q.plates.length * 0.7 };
    [[tl, tr], [tr, br], [br, bl], [bl, tl]].forEach(function (s, i) { P.rim.push(grow(e, "Rim" + i, s[0][0], s[0][1], s[1][0], s[1][1], 26, M.hot, off(COR))); });
    // brackets just outside two corners, along the top and down the slanted side (the side leans 23 px over the plate's 112)
    P.br.push(grow(e, "BrT", tl[0] - o, tl[1] + o, tl[0] + 110, tl[1] + o, 14, M.line, off(COR)));
    P.br.push(grow(e, "BrL", tl[0] - o, tl[1] + o, tl[0] - o - 12, tl[1] + o - 59, 14, M.line, off(COR)));
    P.br.push(grow(e, "BrB", br[0] + o, br[1] - o, br[0] - 110, br[1] - o, 14, M.line, off(COR)));
    P.br.push(grow(e, "BrR", br[0] + o, br[1] - o, br[0] + o + 12, br[1] - o + 59, 14, M.line, off(COR)));
    Q.plates.push(P); return P;
  }
  var RIM_A = [0.95, 0.7, 0.9, 0.7];
  function plateFrame(P, t, o) {
    P.rim.forEach(function (s, i) { drawIn(s, (o - 0.05 - 0.1 * i) / 0.35); lum(s.g, COR, RIM_A[i] + 0.06 * Math.sin(t * 1.9 + i + P.ph), (1 - clamp01((o - 0.1 * i) / 0.5)) * 0.5); });
    var bl = o < 0.45 ? 0 : o < 0.75 ? 0.4 + 0.6 * (Math.floor(o / 0.05) % 2) : 0.85 + 0.15 * Math.sin(t * 2.4 + P.ph);
    P.br.forEach(function (s, i) { drawIn(s, (o - 0.45 - 0.04 * i) / 0.2); lum(s.g, COR, bl, 0.15); });
    cometAt(P.cm, pass(t, 1.4 + P.ph, 6, 1.1), PINKW, 0.9);
  }
  // card corners from the card's centre: the frame leans 100 px over its 680 (left side unit vector 0.1455, 0.9894)
  var NOTCH = [[-150, 340, -60, 340], [-150, 340, -163.1, 251], [150, -340, 60, -340], [150, -340, 163.1, -251]];
  function notches(par) { return NOTCH.map(function (n, i) { return grow(par, "LitNotch" + i, n[0], n[1], n[2], n[3], 18, M.hot, off(COR)); }); }
  function cardBuild(S, Q, k) {
    var C = { k: k, sel: false, at: -9 }, fg = k.face.Find("FrameGlow"), mask = k.face.Find("Mask"), back = k.back;
    if (!fg) return null;
    // joined: a soft halo and a pink neon frame around the stock one, hot notches, a sheen across the art now and then
    C.halo = over(k.face, "LitHalo", fg, M.soft, off(PINK), 40); C.frame = over(k.face, "LitFrame", fg, M.flick, off(PINK), 0);
    var gi = fg.GetSiblingIndex(); C.halo.transform.SetSiblingIndex(gi); C.frame.transform.SetSiblingIndex(gi + 2);
    C.n = notches(k.face);
    if (mask) C.sh = sheen(mask, "LitSheen", 700, off(PINKW), [1, 0.88, 0.94, 0]);
    // an empty place: the same frame dimmer, a faint honeycomb lit through the card's own shape, the notches
    var bsp = back.GetComponent(T(UI.Image));
    C.bm = fimg(back, "LitMask", bsp ? bsp.sprite : null, null, [1, 1, 1, 1]); C.bm.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false; pic3d(C.bm);
    var hl = SP.lb_card_hexlight; if (hl) C.bhex = fimg(C.bm.rectTransform, "LitHex", hl, M.glow, off(PINK));
    C.bhalo = over(back, "LitHalo", fg, M.soft, off(PINK), 40); C.bframe = over(back, "LitFrame", fg, M.flick, off(PINK), 0);
    C.bn = notches(back);
    // the plus glows pink behind it
    var plus = k.empty.Find("Plus");
    if (plus) { var pp = plus.anchoredPosition; C.pg = img(k.empty, "LitPlus", pp.x, pp.y, 430, 430, "lb_dot", M.soft, off(PINK)); C.pg.transform.SetSiblingIndex(0); }
    // the plinth: its glow in neon pink, a neon line along its top
    var bg = k.rig.Find("BaseGlow"), base = k.rig.Find("Base");
    if (bg) { C.pl = over(k.rig, "LitPlinth", bg, M.flick, off(PINK), 0); C.pl.transform.SetSiblingIndex(bg.GetSiblingIndex() + 1); }
    if (base) C.top = grow(base, "LitTop", -220, 18, 220, 18, 16, M.line, off(PINK));
    [C.halo, C.frame, C.bm, C.bhalo, C.bframe, C.pg, C.pl].forEach(function (g) { if (g) Q.made.push(g.transform); });
    C.n.concat(C.bn).forEach(function (s) { Q.made.push(s.g.transform); });
    if (C.top) Q.made.push(C.top.g.transform);
    if (C.sh) C.sh.s.forEach(function (g) { Q.made.push(g.transform); });
    Q.cards.push(C); return C;
  }
  function cardFrame(S, C, t, o) {
    var k = C.k, joined = k.face.localScale.x > 0.5, sel = S.zone == "cards" && S.cur == k.i && !(S.menu && S.menu.activeSelf) && !S.rulesOpen;
    if (sel && !C.sel) C.at = t; C.sel = sel;
    var f = sel ? Math.max(0, 1 - (t - C.at) / 0.35) : 0, br = 0.07 * Math.sin(t * 2.3 + k.i * 1.7), fi = ease((o - 0.1 - 0.06 * k.i) / 0.5);
    lum(C.frame, PINK, fi * ((sel ? 1 : 0.78) + br), f * 0.6);
    lum(C.halo, PINK, fi * ((sel ? 0.42 : 0.2) + br + 0.4 * f), 0);
    lum(C.bframe, PINK, fi * ((sel ? 0.85 : 0.5) + br), f * 0.5);
    lum(C.bhalo, PINK, fi * ((sel ? 0.3 : 0.1) + br + 0.3 * f), 0);
    if (C.bhex) lum(C.bhex, PINK, fi * (0.14 + 0.06 * Math.sin(t * 1.3 + k.i) + 0.22 * f), 0);
    if (C.pg) lum(C.pg, PINK, fi * (0.3 + 0.1 * Math.sin(t * 2.1 + k.i) + 0.25 * f), 0);
    var nk = 0.1 + f * 0.5;
    for (var j = 0; j < 4; j++) {
      var u = (o - 0.3 - 0.06 * k.i - 0.04 * j) / 0.25; drawIn(C.n[j], u); drawIn(C.bn[j], u);
      lum(C.n[j].g, COR, 0.95, nk); lum(C.bn[j].g, COR, 0.8, nk);
    }
    if (C.pl) lum(C.pl, PINK, fi * (joined ? (sel ? 0.95 : 0.7) : 0.38), f * 0.4);
    if (C.top) { drawIn(C.top, (o - 0.2 - 0.06 * k.i) / 0.4); lum(C.top.g, PINK, joined ? 0.95 : 0.55, 0.12 + f * 0.4); }
    if (C.sh) sheenAt(C.sh, joined ? pass(t, 1.6 + k.i * 0.45, 7, 0.9) : -1, -430, 860, 0, 1);
  }
  // a bar button's light, made the first time the button shows (the bar makes more buttons as it needs them)
  function btnBuild(Q, b) {
    var r = b.rt, offT = r.Find("Off"); if (!offT) return null;
    var oi = offT.GetComponent(T(UI.Image)), sp = oi ? oi.sprite : SP.lb_btn, B = { at: -9, on: false, m: false };
    B.halo = fimg(r, "LitHalo", SP.lb_dot, M.soft, off(COR), 200, 120); B.halo.transform.SetSiblingIndex(0);
    B.rim = fimg(r, "LitRim", sp, M.glow, off(COR), 8, 8, true); B.rim.transform.SetSiblingIndex(1);
    B.grad = fimg(r, "LitGrad", sp, M.gradBtn, COR, 0, 0, true); B.grad.transform.SetSiblingIndex(offT.GetSiblingIndex() + 1);
    // the foot line runs along the bottom edge inside the slant (lb_btn's sides lean SLANT px)
    var ft = node(r, "LitFoot"); ft.anchorMin = new UE.Vector2(0, 0); ft.anchorMax = new UE.Vector2(1, 0);
    ft.anchoredPosition = new UE.Vector2(-6, 3); ft.sizeDelta = new UE.Vector2(-40, 22); ft.SetSiblingIndex(B.grad.transform.GetSiblingIndex() + 1);
    B.foot = ft.gameObject.AddComponent(T(UI.Image)); B.foot.raycastTarget = false; B.foot.material = M.hot; B.foot.color = col(PINK, 0);
    B.mk = fimg(r, "LitMask", sp, null, [1, 1, 1, 1], 0, 0, true); B.mk.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false; pic3d(B.mk);
    B.mk.transform.SetSiblingIndex(ft.GetSiblingIndex() + 1);
    B.sh = sheen(B.mk.rectTransform, "Sh", 66, off(PINKW), [1, 0.9, 0.95, 0]);
    Q.made.push(B.halo.transform, B.rim.transform, B.grad.transform, ft, B.mk.transform);
    return B;
  }
  function btnFrame(b, B, lit, t, fi) {
    if (lit && !B.on) B.at = t; B.on = lit;
    var f = lit ? Math.max(0, 1 - (t - B.at) / 0.3) : 0;
    if (B.m != lit) { B.grad.material = lit ? M.gradOn : M.gradBtn; B.m = lit; }
    lum(B.halo, COR, lit ? 0.3 + 0.06 * Math.sin(t * 3.2) + 0.3 * f : 0, 0);
    lum(B.rim, lit ? PINK : COR, fi * (lit ? 0.95 : 0.38), f * 0.6);
    lum(B.foot, PINK, fi * (lit ? 1 : 0.7), lit ? 0.2 + 0.3 * f : 0);
    var w = b.rt.sizeDelta.x; sheenAt(B.sh, lit ? pass(t, B.at, 2.4, 0.7) : -1, -w / 2 - 60, w + 120, 0, 1);
    // the focused button keeps its dark plate, lit by the brighter gradient, its label white (lightBtn's white plate is off)
    if (lit) {
      var oc = b.on.color; if (oc.a > 0.001) b.on.color = new UE.Color(oc.r, oc.g, oc.b, 0);
      var tc = b.t.color; if (tc.r < 0.99 || tc.b < 0.99) b.t.color = new UE.Color(1, 1, 1, 1);
    }
  }
  // the room behind: anchor nodes at the left edge, the right edge and the centre, so the wide screen keeps its edges
  var HEXS = [[40, 300], [158, 300], [276, 300], [99, 200], [217, 200], [335, 200], [40, 100], [158, 100], [276, 100]];
  var FLASH = [[520, 360, 1100, 520], [-420, 420, 900, 420], [980, 250, 800, 380]];
  function backBuild(S, Q) {
    var bd = S.ui.Find("Backdrop"), bk = node(S.ui, "LitBack");
    bk.anchorMin = new UE.Vector2(0, 0); bk.anchorMax = new UE.Vector2(1, 1); bk.sizeDelta = new UE.Vector2(0, 0); bk.anchoredPosition = new UE.Vector2(0, 0);
    bk.SetSiblingIndex(bd ? bd.GetSiblingIndex() + 1 : 0); Q.made.push(bk);
    function edge(n, x) { var r = node(bk, n); r.anchorMin = r.anchorMax = new UE.Vector2(x, 0.5); r.sizeDelta = new UE.Vector2(0, 0); return r; }
    var Lt = edge("L", 0), Rt = edge("R", 1), Md = edge("Mid", 0.5), K = Q.back = { bk: bk, hex: [], st: [], ls: [], fl: [] };
    K.hz = img(Md, "Horizon", 0, -175, 2600, 160, "lb_dot", M.soft, off(COR));
    K.sh = shafts(Md, COR);
    K.fl = FLASH.map(function (q, i) { var g = img(Md, "Flash" + i, q[0], q[1], q[2], q[3], "lb_dot", M.flick, off(COR)); g.enabled = false; return g; });
    HEXS.forEach(function (h, i) {
      var ring = img(Lt, "Hex" + i, h[0], h[1], 116, 131, "lb_hex_mask", M.glow, off(COR)); ring.enabled = false;
      pic3d(img(Lt, "HexIn" + i, h[0], h[1], 106, 120, "lb_hex_mask", null, [HEXD[0], HEXD[1], HEXD[2], 0.75]));
      K.hex.push({ g: ring, q: (h[0] + (400 - h[1])) / 700, p: i * 1.1 });
    });
    // streaks: thin neon lines sliding left low on the right, and right low on the left
    for (var i = 0; i < 7; i++) {
      var y = -72 - i * 36 - (i * 13) % 20, len = 160 + (i * 83) % 220, g = img(Rt, "Streak" + i, 0, y, len, 10 + (i % 3) * 4, null, M.line, off(COR)); g.enabled = false;
      K.st.push({ g: g, y: y, sp: 5 + (i * 7) % 6, p: i * 0.37 });
    }
    for (var j = 0; j < 4; j++) {
      var y2 = -140 - j * 38, g2 = img(Lt, "Streak" + j, 0, y2, 140 + (j * 97) % 160, 10, null, M.line, off(COR)); g2.enabled = false;
      K.ls.push({ g: g2, y: y2, sp: 6 + j * 1.7, p: j * 0.53 });
    }
    K.fc = comet(Md, "Floor", -1300, -302, 1300, -302, 1.4);
    K.du = dust(Md, [1, 0.35, 0.5], -1300, -320, 2600, 860, 14, 5);
  }
  function backFrame(K, t, fi) {
    lum(K.hz, COR, fi * (0.2 + 0.05 * Math.sin(t * 0.8)), 0);
    shaftsAt(K.sh, t, -1300, 2600, 160, fi);
    K.fl.forEach(function (g, i) { var u = pass(t, 3 + i * 2.3, 7 + i * 1.9, 0.6); lum(g, COR, u < 0 ? 0 : fi * 0.22 * bell(u) * (0.55 + 0.45 * (Math.floor(u * 8) % 2)), 0.1); });
    var hw = pass(t, 1.2, 6.5, 1.6), hp = hw < 0 ? -9 : hw * 1.6 - 0.3;
    K.hex.forEach(function (h) { var b = Math.max(0, 1 - Math.abs(hp - h.q) / 0.16); lum(h.g, COR, fi * (0.11 + 0.05 * Math.sin(t * 0.7 + h.p) + 0.5 * b), b * 0.4); });
    K.st.forEach(function (s) { var u = wrap(t / s.sp + s.p, 1); moveTo(s.g, -60 - u * 760, s.y); lum(s.g, COR, fi * 0.7 * bell(u), 0.1); });
    K.ls.forEach(function (s) { var u = wrap(t / s.sp + s.p, 1); moveTo(s.g, 60 + u * 700, s.y); lum(s.g, COR, fi * 0.5 * bell(u), 0.1); });
    cometAt(K.fc, pass(t, 2, 9, 2.2), PINKW, fi);
    dustAt(K.du, t, fi);
  }
  L.lbKill = function (S) {
    var Q = S && S.lb; if (!Q) return;
    Q.made.forEach(function (t) { try { kill(t); } catch (e) { } });
    (S.btns || []).forEach(function (b) { b.lit = null; });
    S.lb = null;
  };
  L.lbBuild = function (S) {
    try {
      if (!S || !S.ui) return;
      L.lbKill(S);
      if (!ready(S)) { log("lobby: no Fx materials in this bundle: no light"); return; }
      gather(S); gradMats();
      var Q = S.lb = { made: [], plates: [], cards: [], frame: -1 };
      plateBuild(S, Q, "Title"); plateBuild(S, Q, "Info");
      (S.cards || []).forEach(function (k) { cardBuild(S, Q, k); });
      backBuild(S, Q);
      log("lobby lit: " + Q.plates.length + " plates, " + Q.cards.length + " cards");
    } catch (e) { log("lobby light: " + es(e)); }
  };
  L.lbFrame = function (S, t) {
    var Q = S && S.lb; if (!Q) return;
    try {
      var fc = UE.Time.frameCount; if (Q.frame == fc) return; Q.frame = fc;
      // the solo select is drawn on this screen with its own light: the room goes dark while it shows
      var show = !S.solo; if (Q.back.bk.gameObject.activeSelf != show) Q.back.bk.gameObject.SetActive(show);
      if (!show) return;
      var o = t - (S.openAt || 0), fi = ease(o / 0.5);
      Q.plates.forEach(function (P) { plateFrame(P, t, o); });
      Q.cards.forEach(function (C) { if (C.k.tr.gameObject.activeSelf) cardFrame(S, C, t, o); });
      (S.btns || []).forEach(function (b, j) {
        if (!b.rt.gameObject.activeSelf) return;
        var B = b.lit || (b.lit = btnBuild(Q, b)); if (!B) return;
        btnFrame(b, B, S.zone == "bar" && S.cur == j && !S.rulesOpen, t, fi);
      });
      backFrame(Q.back, t, fi);
    } catch (e) { if (!L.lberr) { L.lberr = true; log("lobby frame: " + es(e)); } }
  };

  // the lobby (and its Legacy screen) is built when fourlobbyui.js loads, which can be before this file: light it now
  try { var EZ = G.BB4EVO && G.BB4EVO.Z; if (EZ && !EZ.lit && G.BB4UI) L.lgBuild(EZ, G.BB4UI); } catch (e) { log("legacy late: " + es(e)); }
  try { if (G.BB4UI && G.BB4UI.ui && !G.BB4UI.lb) L.lbBuild(G.BB4UI); } catch (e) { log("lobby late: " + es(e)); }
  log("loaded");
})();
