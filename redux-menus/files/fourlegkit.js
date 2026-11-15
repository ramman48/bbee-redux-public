(function () {
  // ---- Legacy I from ChatGPT's rebuild kit ----
  // The kit (local_only/redux/v4shots/gpt/legacy_kit/Legacy_I) is the mockup cut into 142 layers, each with its rectangle
  // on a 1916 x 821 canvas (03_manifest/layers.json). The page is laid out in those units under one root, scaled
  // uniformly to the screen and centred, so a capture cropped to the root and resized to 1916 x 821 compares pixel for
  // pixel with the kit's reference (06_verify/compare.py).
  //   K.mode "fixture": every layer where the kit has it, the measurable baseline (the kit guide, 9.1)
  //   K.mode "live":    the menu built from the kit's parts and the real records
  // The page's own pieces (fourlobbyevo.js) keep running in a hidden holder: its state (cursor, list, filters, sort)
  // is what the kit draws, and its input code is unchanged. The tactic picker stays above the kit.
  var cs = CS, G = globalThis, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof, IO = cs.System.IO;
  function log(m) { G.BB4.log("FOURKIT", m); }
  function es(e) { return G.BB4.es ? G.BB4.es(e) : String(e); }
  var W = 1916, H = 821;
  var K = G.BB4LEGKIT = G.BB4LEGKIT || {};
  // the pictures ship in the mod's own folder (the bundle carries a folder a script names); the kit itself, which only
  // the "fixture" measurement reads, stays on the development PC
  var ROOT = (G.BB4 && G.BB4.ROOT) || "", ART = ROOT + "/mods/redux-menus/files/art/legacy/";
  K.dir = ART;
  K.kit = ROOT + "/local_only/redux/v4shots/gpt/legacy_kit/Legacy_I/";
  K.mode = K.mode || "live";
  var texs = K.texs = K.texs || {};
  function V2(x, y) { return new UE.Vector2(x, y); }

  // the kit's pictures are straight-alpha PNGs, read once and kept; no mips, so nothing softens at the kit's own size
  // (a whole path is the fixture's, read from the kit)
  function tex(rel) {
    var t = texs[rel]; if (t && !t.Equals(null)) return t;
    t = new UE.Texture2D(2, 2, UE.TextureFormat.RGBA32, false);
    UE.ImageConversion.LoadImage(t, IO.File.ReadAllBytes(/^([A-Za-z]:|\/)/.test(rel) ? rel : K.dir + rel));
    t.filterMode = UE.FilterMode.Bilinear; t.wrapMode = UE.TextureWrapMode.Clamp; t.name = rel;
    return (texs[rel] = t);
  }
  // a rectangle given as the kit gives it (left, top, width, height in canvas pixels), inside a parent whose own kit
  // rectangle is o (the whole canvas when left out)
  var FULL = [0, 0, W, H];
  function at(rt, r, o) { o = o || FULL; rt.sizeDelta = V2(r[2], r[3]); rt.anchoredPosition = V2(r[0] + r[2] / 2 - (o[0] + o[2] / 2), (o[1] + o[3] / 2) - (r[1] + r[3] / 2)); }
  function box(parent, name, r, o) {
    var rt = K.A.node(parent, name); rt.anchorMin = rt.anchorMax = V2(0.5, 0.5); rt.pivot = V2(0.5, 0.5);
    at(rt, r, o); return rt;
  }
  function pic(parent, name, rel, r, o) {
    var im = box(parent, name, r, o).gameObject.AddComponent(T(UI.RawImage)); im.texture = tex(rel); im.raycastTarget = false; return im;
  }

  function fixture(k) {
    var L = JSON.parse(IO.File.ReadAllText(K.kit + "03_manifest/layers.json"));
    k.cover = pic(k.root, "Cover", K.kit + L.background, [0, 0, W, H]);   // the same plate, stretched to fill a screen wider or taller than the kit
    pic(k.root, "Plate", K.kit + L.background, [0, 0, W, H]);
    var n = L.nodes.slice().sort(function (a, b) { return a.z - b.z; }), c = 0;   // compare.py's order: z, then the manifest's
    n.forEach(function (q) { if (q.kind == "reference_only") return; pic(k.root, q.id, K.kit + q.png, q.xywh); c++; });
    log("fixture: " + c + " layers");
  }

  // ---- live: the kit's parts, the page's records ----
  var OUT = ART + "out/";
  var TA = cs.TMPro.TextAlignmentOptions;
  function hx(s) { return [parseInt(s.substr(1, 2), 16) / 255, parseInt(s.substr(3, 2), 16) / 255, parseInt(s.substr(5, 2), 16) / 255]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  // the colours measured off the kit's reference (its brightest pixels, the label PNGs carry the backdrop)
  var WHITE = [1, 1, 1], INK = [0.08, 0.06, 0.1], GOLD = hx("#ffd27a"), POW = hx("#fff76f"), USE = hx("#9ffe65"), CYAN = hx("#6ffbfe"),
      SUB = hx("#c3c2d6"), ROWSUB = hx("#c0bed0"), NONESUB = hx("#c1bec6"), CAP = hx("#a9a6bb"), BODY = hx("#dfdde7"), PAGE = hx("#c8c4da"),
      SORTCAP = hx("#bbbccf"), SORTIDLE = WHITE, TACIDLE = WHITE, SKIDLE = WHITE, FOOT = [0.86, 0.85, 0.92], DIMT = hx("#8a8698");
  var SORTR = { power: [1262, 26, 131, 49], hero: [1394, 25, 125, 50], element: [1519, 25, 137, 50] };
  var EL_X = 343, EL_W = 88, EL_END = 1140, PAN_BUILD = 11, POW_GAP = 20;
  var BG = "05_background/clean_plate_1916.png";
  function layer(parent, name) { return box(parent, name, FULL); }
  function img(parent, name, r, o) {
    var im = box(parent, name, r, o).gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; im.preserveAspect = true; return im;
  }
  // a line of live text in the game's font, placed by its cap top as the kit's text sits: TextMeshPro puts the cap top
  // 0.26 x size under the rect's top (TopLeft / Top / TopRight), so x is the left edge, the centre or the right edge
  function label(parent, name, x, cap, size, c, al, style, w, h) {
    var L = { x: x, cap: cap, size: size, w: w || 600, h: h || size * 1.6, al: al || "l", s: null, pw: null, ck: null, on: true };
    L.rt = box(parent, name, lrect(L));
    L.t = K.A.txt(parent, name, size, c, L.al == "c" ? TA.Top : L.al == "r" ? TA.TopRight : TA.TopLeft, style == null ? 3 : style);
    L.go = L.rt.gameObject; L.ck = (c || WHITE).join(",");
    return L;
  }
  function lrect(L) { return [L.al == "c" ? L.x - L.w / 2 : L.al == "r" ? L.x - L.w : L.x, L.cap - 0.26 * L.size, L.w, L.h]; }
  function put(L, x, cap) { if (L.x === x && (cap == null || L.cap === cap)) return; L.x = x; if (cap != null) L.cap = cap; at(L.rt, lrect(L)); }
  function say(L, s) { s = s == null ? "" : String(s); if (L.s !== s) { L.s = s; L.t.text = s; L.pw = null; } }
  function pw(L) { if (L.pw == null) L.pw = L.s ? L.t.GetPreferredValues(L.s).x : 0; return L.pw; }
  function tint(L, c, a) { var k = c.join(",") + "/" + (a == null ? 1 : a); if (L.ck !== k) { L.ck = k; L.t.color = K.A.col(c, a == null ? 1 : a); } }
  function show(L, on) { if (L.on !== on) { L.on = on; L.go.SetActive(on); } }
  // an element's glyph, or for an element the game draws no glyph for, a small square in its colour (the kit's blue and green chips)
  function elPic(im, e, r, o) {
    var X = K.E._, sp = X.elTex(e), q = Math.min(15, Math.round(r[2] * 0.6));
    if (sp) { im.sprite = sp; im.color = new UE.Color(1, 1, 1, 1); at(im.rectTransform, r, o); }
    else { im.sprite = null; im.color = K.A.col(X.elCol(e), 1); at(im.rectTransform, [r[0] + (r[2] - q) / 2, r[1] + (r[3] - q) / 2, q, q], o); }
    im.enabled = true;
  }
  function alpha(g, a) { g.color = new UE.Color(1, 1, 1, a); }
  // a chip: its plate (and the lit plate over it, crossfaded), its label, scaled up while it has the focus
  function chip(parent, name, r, on, off) {
    var c = { r: r, rt: box(parent, name, r), lit: 0, sc: 1, scS: 1, oS: 1 };
    c.go = c.rt.gameObject; c.cg = c.go.AddComponent(T(UE.CanvasGroup)); c.cg.blocksRaycasts = false;
    if (off) c.off = pic(c.rt, "Off", off, r, r);
    if (on) c.on = pic(c.rt, "On", on, r, r);
    return c;
  }
  function chipLight(c, lit, foc, kf, t) {
    c.lit += ((lit ? 1 : 0) - c.lit) * kf; if (Math.abs(c.lit - (lit ? 1 : 0)) < 0.004) c.lit = lit ? 1 : 0;
    if (c.on && c.litS !== c.lit) { c.litS = c.lit; alpha(c.on, c.lit); if (c.off) alpha(c.off, 1 - c.lit); }
    c.sc += ((foc ? 1.08 : 1) - c.sc) * kf;
    var s = c.sc * c.oS * (foc ? 1 + 0.012 * Math.sin(t * 6) : 1);
    if (Math.abs(s - c.scS) > 1e-4) { c.scS = s; c.rt.localScale = new UE.Vector3(s, s, 1); }
  }

  // ---- motion ----
  // The kit's own light loop (its render_loop.py, 12 s) played live over the plate, and the page's moves: the open, the
  // focused row, the list, the panel. The light draws with the lobby's Fx materials (fourlight.js, BB4LIT.fxKit); without
  // them the page is drawn still.
  var TAU = Math.PI * 2, PINK = [1, 0.19, 0.43], GLINT = [1, 0.12, 0.38], ROSE = [1, 0.3, 0.5], PALE = [1, 0.55, 0.75], GAIN = 1.9 / 382.5;
  function kp(x, y) { return V2(x - W / 2, H / 2 - y); }
  function eob(t) { t = clamp(t, 0, 1) - 1; return 1 + t * t * (2.7 * t + 1.7); }   // ease out with a small overshoot
  function scl(rt, s) { rt.localScale = new UE.Vector3(s, s, 1); }
  // a whole-canvas holder with its own alpha, moved as one (pieces built inside it keep their kit rectangles)
  function grp(parent, name) {
    var rt = layer(parent, name), g = { rt: rt, cg: rt.gameObject.AddComponent(T(UE.CanvasGroup)), a: -1, x: 0, y: 0 };
    g.cg.blocksRaycasts = false; g.cg.interactable = false; return g;
  }
  function gset(g, a, dx, dy) {
    a = clamp(a, 0, 1); dx = dx || 0; dy = dy || 0;
    if (g.a !== a) { g.a = a; g.cg.alpha = a; }
    if (g.x !== dx || g.y !== dy) { g.x = dx; g.y = dy; g.rt.anchoredPosition = V2(dx, -dy); }
  }
  // a band of light crossing a picture's own shape (the Fx shader's sweep, mode 8); swAt puts it at pos, -0.3 .. 1.3
  // across the picture along its angle, and switches it off outside that
  function sweep(k, parent, name, rel, r, ang, w, c, I, o) {
    var F = k.F, im = pic(parent, name, rel, r, o);
    var m = F.mat(F.MT.Lb_HexSweep ? "Lb_HexSweep" : "Lb_Glow", "kit" + name, { Mode: 8, Angle: ang, Width: w, Intensity: I, Period: 1e9, Seed: 0 });
    im.material = m; im.color = new UE.Color(c[0], c[1], c[2], 1);
    var s = { im: im, m: m, on: true, p: null }; swAt(s, -1); return s;
  }
  function swAt(s, pos) {
    if (!s) return;
    var on = pos > -0.3 && pos < 1.3;
    if (s.on !== on) { s.on = on; s.im.enabled = on; }
    if (on && s.p !== pos) { s.p = pos; s.m.SetFloat("_Seed", (pos + 0.3) / 1.6); }
  }
  // where a pass is: one of `dur` seconds from t0, or one every `every` seconds; -1 while none is running
  function once(t, t0, dur) { var u = t - t0; return u < 0 || u >= dur ? -1 : -0.3 + 1.6 * (0.5 - 0.5 * Math.cos(Math.PI * u / dur)); }
  function pass(t, t0, every, dur) { var u = t - t0; return u < 0 ? -1 : once(u % every, 0, dur); }
  // a soft light (the lobby's lb_dot spot as additive glow) centred at x, y in kit pixels, turned by deg
  function spot(k, parent, name, x, y, w, h, deg, c, m) {
    var F = k.F, im = box(parent, name, [x - w / 2, y - h / 2, w, h]).gameObject.AddComponent(T(UI.Image));
    im.raycastTarget = false; im.sprite = F.SP.lb_dot || null; im.material = m || F.M.glow; im.color = new UE.Color(c[0], c[1], c[2], 1);
    if (deg) im.rectTransform.localEulerAngles = new UE.Vector3(0, 0, deg);
    return { im: im, rt: im.rectTransform, cr: im.canvasRenderer };
  }
  // a plain rectangle drawn by one of the Fx modes (sparks, seam)
  function fxRect(parent, name, r, m, c) {
    var im = box(parent, name, r).gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; im.material = m; im.color = new UE.Color(c[0], c[1], c[2], 1); return im;
  }

  // the kit's loop, its exact numbers: three broad glows breathing (x, y, size x, size y, tilt, strength, phase), five
  // cut glints sliding along their edges (x, y, length, tilt, travel, phase, strength) and 54 motes circling
  // (x, y, radius x, radius y, phase, size, strength); strengths are out of 255 as the kit adds them to the plate
  var BROAD = [[1558, 296, 201, 315, -0.09, 10, 0.4], [1297, 715, 161, 119, -0.24, 6, 2.6], [355, 470, 227, 210, -0.15, 2, 1.3]];
  var CUTS = [[63, 70, 26, 0.08, 0, 0, 13], [339, 747, 57, -0.205, 52, 2.3, 18], [999, 783, 78, -0.34, 49, 4.1, 16], [1840, 624, 60, -0.34, 31, 1.6, 24], [1706, 82, 37, -0.11, 17, 0.8, 9]];
  var MOTES = [[1620.7, 179.9, 22.85, 10.88, 2.0110, 2, 52.0], [805.5, 339.6, 7.39, 14.87, 5.0153, 1, 24.2], [170.3, 68.2, 19.17, 12.42, 5.8599, 1, 47.1],
    [55.5, 421.8, 21.52, 22.53, 5.7694, 1, 39.7], [1328.0, 678.3, 12.14, 19.17, 4.0711, 1, 17.8], [1612.3, 99.5, 20.00, 9.75, 2.3060, 1, 48.3],
    [866.6, 110.4, 23.08, 21.71, 3.6114, 1, 23.7], [1686.8, 182.6, 20.91, 13.43, 6.1774, 1, 30.5], [1023.4, 154.1, 19.55, 15.52, 3.4919, 1, 39.8],
    [277.5, 439.9, 15.46, 12.47, 4.3864, 1, 23.8], [796.8, 733.7, 21.47, 8.16, 5.5632, 2, 28.5], [1001.6, 373.8, 15.31, 8.10, 6.0640, 2, 54.0],
    [1504.7, 757.0, 17.51, 10.90, 1.9305, 1, 23.3], [946.4, 770.6, 11.10, 15.44, 0.4905, 1, 30.3], [1310.8, 344.1, 6.69, 26.80, 1.8124, 2, 44.4],
    [815.4, 625.0, 16.06, 11.85, 3.1069, 1, 37.7], [587.8, 337.2, 16.92, 22.05, 6.2173, 1, 36.3], [1223.4, 106.5, 19.02, 15.12, 3.9895, 1, 48.3],
    [639.2, 8.5, 7.94, 12.24, 2.5460, 1, 25.7], [502.3, 740.2, 8.46, 26.49, 0.8531, 1, 20.1], [1505.3, 704.5, 13.80, 19.68, 0.1060, 2, 20.3],
    [521.3, 428.2, 18.32, 12.60, 3.0183, 1, 34.0], [1481.3, 767.0, 14.90, 24.81, 2.4321, 1, 35.0], [725.0, 595.9, 14.46, 25.68, 4.6401, 1, 20.4],
    [561.8, 649.6, 9.92, 13.68, 0.7838, 1, 48.2], [876.2, 203.7, 15.21, 15.76, 0.5807, 1, 41.4], [594.1, 103.5, 18.11, 8.65, 1.0283, 1, 49.1],
    [1828.0, 229.9, 10.60, 24.10, 2.5079, 1, 42.8], [850.1, 45.0, 18.09, 10.81, 3.6096, 2, 29.8], [1221.6, 660.8, 23.12, 9.40, 2.6801, 2, 36.1],
    [1625.0, 2.0, 22.73, 9.46, 4.4273, 1, 48.6], [418.7, 551.1, 10.43, 13.78, 5.1243, 1, 38.6], [490.0, 173.5, 12.33, 22.02, 1.4199, 1, 44.5],
    [1355.0, 345.1, 15.01, 14.42, 4.0970, 1, 22.5], [1214.6, 511.4, 17.55, 24.75, 1.4776, 1, 41.3], [10.1, 776.5, 17.90, 16.44, 0.2495, 1, 52.1],
    [1780.6, 129.6, 8.97, 20.33, 2.2022, 1, 28.3], [703.1, 131.3, 10.11, 19.00, 0.5904, 1, 15.4], [485.8, 20.7, 16.45, 22.08, 5.0507, 2, 17.0],
    [795.1, 463.8, 18.59, 14.72, 5.9827, 1, 49.3], [1311.2, 540.0, 20.01, 17.81, 3.4011, 1, 21.8], [1421.5, 671.2, 21.88, 17.92, 1.6506, 1, 49.8],
    [1869.9, 624.9, 20.66, 22.96, 1.8856, 1, 51.6], [1856.8, 628.1, 16.42, 23.71, 1.6305, 1, 51.2], [313.3, 772.2, 13.14, 15.69, 4.9654, 1, 35.8],
    [547.1, 414.5, 18.82, 10.92, 4.0303, 1, 47.5], [1035.7, 660.3, 13.33, 26.14, 2.2317, 1, 54.9], [526.0, 574.8, 13.59, 11.35, 4.2381, 1, 17.0],
    [1288.4, 33.4, 23.03, 9.19, 4.9111, 1, 47.1], [12.3, 358.8, 10.87, 18.04, 2.6506, 1, 44.7], [103.9, 740.7, 18.97, 17.73, 1.1447, 1, 45.7],
    [54.4, 600.2, 10.27, 14.39, 1.9915, 1, 45.5], [188.3, 240.4, 15.13, 19.40, 4.9490, 1, 49.1], [1456.1, 654.4, 16.06, 9.83, 3.5439, 2, 37.2]];
  function deg(tilt) { return -Math.atan(tilt) * 180 / Math.PI; }
  // the page's own layer over the kit's loop: wide shafts of light sliding along the plate's diagonals (x at the start,
  // phase, length, width, angle, strength, seconds to cross), haze rolling along the floor, soft dust rising through it
  var SHAFTS = [[0, 0.05, 1900, 170, 34, 0.15, 26], [0, 0.45, 1500, 80, 38, 0.13, 31], [0, 0.75, 2200, 260, 31, 0.08, 37]];
  var DUST = []; for (var b = 0; b < 18; b++) DUST.push([(b * 733 + 211) % W, (b * 397 + 90) % H, 22 + (b * 37) % 74, 9 + (b * 5) % 16, 0.07 + 0.025 * (b % 4), b * 1.3]);
  var WARM = [1, 0.42, 0.6];
  var EDGE_CUT = [[0, 0, 220, H], [1740, 0, W - 1740, H], [220, 0, 1520, 138], [220, 712, 1520, H - 712]];
  function wrap(v, n) { return ((v % n) + n) % n; }
  // over the plate: the kit's glint band, the crimson shaft and the plate's thin lines catching light, the loop's
  // glows, glints and motes (the motes also rise), embers off the floor (masks cut from the plate itself: mkmask.py)
  function ambBuild(k) {
    var F = k.F, g = k.amb = grp(k.drift, "Amb"), p = g.rt, ms = F.mat("Lb_Glow", "kitShaft", { Mode: 4, Intensity: 1, Flicker: 0 });
    g.shafts = SHAFTS.map(function (q, i) { return spot(k, p, "Shaft" + i, 0, H / 2, q[2], q[3], q[4], ROSE, ms); });
    g.haze = fxRect(p, "Haze", [0, 430, W, 391], F.mat("Lb_FloorFire", "kitHaze", { Mode: 0, TintRamp: 1, Intensity: 0.3, Occlude: 0, Speed: 0.07, NoisePx: 640, EdgeFade: 0.14, Glow: 0.3 }), PINK);
    g.glint = sweep(k, p, "Glint", OUT + "amb_glint.png", FULL, -9.73, 0.0428, GLINT, 0.3);
    g.ribbon = sweep(k, p, "Ribbon", OUT + "amb_ribbon.png", FULL, 50, 0.08, ROSE, 0.5);
    // the cut-line pass is cut round the list and the panel: lit through their glass, its lines crossed the text
    g.edges = EDGE_CUT.map(function (r, i) {
      var s = sweep(k, p, "Edges" + i, OUT + "amb_edges.png", r, -9.73, 0.05, PALE, 1);
      s.im.uvRect = new UE.Rect(r[0] / W, 1 - (r[1] + r[3]) / H, r[2] / W, r[3] / H); return s;
    });
    g.broad = BROAD.map(function (q, i) { return spot(k, p, "Broad" + i, q[0], q[1], 3 * q[2], 3 * q[3], deg(q[4]), PINK); });
    g.cuts = CUTS.map(function (q, i) { return [spot(k, p, "Cut" + i, q[0], q[1], 3 * q[2], 3, deg(q[3]), PINK), spot(k, p, "CutH" + i, q[0], q[1], 1.8 * q[2], 12.9, deg(q[3]), PINK)]; });
    g.motes = MOTES.map(function (q, i) { return spot(k, p, "Mote" + i, q[0], q[1], 6 * q[5], 3.6 * q[5], deg(-0.34), PINK); });
    g.dust = DUST.map(function (q, i) { return spot(k, p, "Dust" + i, q[0], q[1], q[2], q[2], 0, WARM); });
    g.embers = fxRect(p, "Embers", [0, 150, W, 671], F.mat("Lb_Motes", "kitEmbers", { Mode: 3, TintRamp: 1, Intensity: 2.2, SparkCell: 56, SparkDensity: 0.2, SparkSize: 0.06, Speed: 0.4, Seed: 3.1 }), PINK);
  }
  function ambFrame(k, t, o) {
    var g = k.amb, a = TAU * (t % 12) / 12;
    gset(g, ease((o - 0.1) / 0.5));
    g.shafts.forEach(function (d, i) {
      var q = SHAFTS[i], f = wrap(t / q[6] + q[1], 1);
      d.rt.anchoredPosition = kp(-500 + (W + 1000) * f, H / 2 + 120 * Math.sin(TAU * f + i)); d.cr.SetAlpha(q[5] * Math.sin(Math.PI * f));
    });
    swAt(g.glint, pass(t, k.openAt + 0.9, 9, 2.6));
    swAt(g.ribbon, pass(t, k.openAt + 0.35, 5, 1.6));
    var pe = pass(t, k.openAt + 2.6, 6, 1.4); g.edges.forEach(function (s) { swAt(s, pe); });
    g.broad.forEach(function (d, i) { var q = BROAD[i]; d.cr.SetAlpha(4 * GAIN * q[5] * (0.5 + 0.35 * Math.sin(a + q[6]) + 0.15 * Math.sin(2 * a - q[6]))); });
    g.cuts.forEach(function (d, i) {
      var q = CUTS[i], xo = q[4] * Math.sin(a + q[5]), s = 2.5 * GAIN * q[6] * (1 + Math.cos(2 * a - q[5])) / 2, p = kp(q[0] + xo, q[1] + xo * q[3]);
      d[0].rt.anchoredPosition = p; d[1].rt.anchoredPosition = p; d[0].cr.SetAlpha(s); d[1].cr.SetAlpha(0.4 * s);
    });
    g.motes.forEach(function (d, i) {
      var q = MOTES[i], y = wrap(q[1] - (6 + 3 * (i % 7)) * t, H + 40) - 20;
      d.rt.anchoredPosition = kp(q[0] + q[2] * Math.sin(a + q[4]), y + q[3] * Math.cos(a + q[4]));
      d.cr.SetAlpha(2.5 * GAIN * q[6] * Math.pow((1 + Math.sin(a + 2 * q[4])) / 2, 1.5) * Math.sin(Math.PI * clamp((y + 20) / (H + 40), 0, 1)));
    });
    g.dust.forEach(function (d, i) {
      var q = DUST[i], n = H + 2 * q[2], y = wrap(q[1] - q[3] * t, n) - q[2];
      d.rt.anchoredPosition = kp(q[0] + 22 * Math.sin(0.4 * t + q[5]), y); d.cr.SetAlpha(q[4] * Math.sin(Math.PI * clamp((y + q[2]) / n, 0, 1)));
    });
  }
  // the plate breathes and drifts, and settles from a push-in when the page opens
  // the drift follows the menus' tilt setting (BB4.opt("tilt"), off by default): off, the plate holds still after its push-in
  function driftFrame(k, t, o) {
    var sw = 0; try { sw = G.BB4 && G.BB4.opt && G.BB4.opt("tilt") ? 1 : 0; } catch (e) {}
    var s = (1.016 + 0.008 * (1 + sw * Math.sin(TAU * t / 17))) * (1 + 0.05 * (1 - ease(o / 0.9)));   // never under 1.016: the drift never shows an edge
    k.drift.localScale = new UE.Vector3(s, s, 1); k.drift.anchoredPosition = V2(sw * 9 * Math.sin(TAU * t / 23), sw * 6 * Math.sin(TAU * t / 19 + 1));
  }
  // the open, in seconds from it: the plate comes up from dark, the title slides in under a streak of light, the chips
  // pop in from left to right, the panel and the rail follow (the rows keep their own cascade, from 0.12 s)
  function chipIn(c, u) { c.cg.alpha = ease(u / 0.2); c.oS = 0.88 + 0.12 * eob(u / 0.28); }
  function openFrame(k, o) {
    var v = 0.22 + 0.78 * ease(o / 0.4), pc = new UE.Color(v, v, v, 1); k.plate.color = pc; k.cover.color = pc;
    var u = ease((o - 0.08) / 0.24); gset(k.gTitle, u, -30 * (1 - u), 0);
    gset(k.gSub, ease((o - 0.16) / 0.24), 0, 4 * (1 - ease((o - 0.16) / 0.24)));
    gset(k.gSortCap, ease((o - 0.14) / 0.2));
    k.chipsA.forEach(function (c) { chipIn(c, o - 0.1 - 0.25 * (c.r[0] - 909) / 850); });
    k.chipsB.forEach(function (c) { chipIn(c, o - 0.12 - 0.3 * ((c.x != null ? c.x : c.r[0]) - 256) / 1500); });
    u = ease((o - 0.2) / 0.32); gset(k.gDet, u, 40 * (1 - u), 0);
    u = ease((o - 0.3) / 0.26); gset(k.gRail, u); gset(k.gFoot, u, 0, 6 * (1 - u));
    streakAt(k, (o - 0.1) / 0.38);
  }
  // the streak of light over the title, su 0 .. 1 across it (it crosses again every 8 s)
  function streakAt(k, su) {
    if (!k.streak) return;
    var son = su > 0 && su < 1;
    if (k.streakOn !== son) { k.streakOn = son; k.streak.im.enabled = son; }
    if (son) { k.streak.rt.anchoredPosition = kp(170 + 470 * ease(su), 37); k.streak.cr.SetAlpha(0.9 * Math.sin(Math.PI * su)); }
  }
  // a point of light runs once round the panel's frame line every 7 s (between the frame's own sweeps), its tail laid
  // along the side it is on
  var CR = [1209, 168, 1712, 669];
  function cometFrame(k, t) {
    var c = k.comet, u = wrap(t - k.openAt - 5.1, 7) / 1.9, on = u < 1 && t - k.openAt > 5;
    if (k.cometOn !== on) { k.cometOn = on; c.forEach(function (d) { d.im.enabled = on; }); }
    if (!on) return;
    var w = CR[2] - CR[0], h = CR[3] - CR[1], d = 2 * (w + h) * (0.5 - 0.5 * Math.cos(Math.PI * u)), side = 0, x, y;
    if (d < w) { x = CR[0] + d; y = CR[1]; } else if ((d -= w) < h) { side = 1; x = CR[2]; y = CR[1] + d; }
    else if ((d -= h) < w) { side = 2; x = CR[2] - d; y = CR[3]; } else { side = 3; x = CR[0]; y = CR[3] - (d - w); }
    var dx = [1, 0, -1, 0][side], dy = [0, 1, 0, -1][side], a = Math.sin(Math.PI * u);
    c[1].rt.anchoredPosition = kp(x, y); c[0].rt.anchoredPosition = kp(x - 120 * dx, y - 120 * dy); c[2].rt.anchoredPosition = kp(x - 26 * dx, y - 26 * dy);
    if (c.side !== side) { c.side = side; var r = new UE.Vector3(0, 0, side % 2 ? 90 : 0); c.forEach(function (d) { d.rt.localEulerAngles = r; }); }
    c[0].cr.SetAlpha(0.6 * a); c[1].cr.SetAlpha(a); c[2].cr.SetAlpha(0.35 * a);
  }
  // a glint crossing a row: a soft band and two slanted stripes. Glow spots, not a sweep of the row's plate, which lit
  // the plate's own line art into stray diagonals. h is the row's height; pos -0.3 .. 1.3 as swAt takes it, faded in
  // and out at the row's ends
  function glintBuild(k, parent, name, h, cB, cC) {
    var s = [spot(k, parent, name + "B", 0, 40, 1.85 * h, h, 0, cB), spot(k, parent, name + "C", 0, 40, 0.2 * h, 1.28 * h, -22, cC),
      spot(k, parent, name + "D", 0, 40, 0.09 * h, 1.18 * h, -22, cC)];
    s.forEach(function (d) { d.im.enabled = false; }); s.on = false; return s;
  }
  function glintAt(s, pos, x0, len, A) {
    if (!s) return;
    var on = pos > -0.3 && pos < 1.3;
    if (s.on !== on) { s.on = on; s.forEach(function (d) { d.im.enabled = on; }); }
    if (!on) return;
    var u = (pos + 0.3) / 1.6, a = A * Math.sin(Math.PI * u), x = x0 + len * u;
    s[0].rt.anchoredPosition = kp(x + 10, 40.5); s[1].rt.anchoredPosition = kp(x, 40.5); s[2].rt.anchoredPosition = kp(x + 24, 40.5);
    s[0].cr.SetAlpha(0.16 * a); s[1].cr.SetAlpha(0.45 * a); s[2].cr.SetAlpha(0.3 * a);
  }
  // the focused row: a light runs along its gold rim and a sheen over its plate when the cursor lands (again every
  // 4.5 s), the rim flares and fades, the lower seam draws in from the left, gold embers rise inside it
  function focusBuild(k) {
    var F = k.F, g = k.fx = grp(k.list, "Focus"), p = g.rt;
    g.rim = sweep(k, p, "RimSw", OUT + "row_gold_rim_light.png", [209, -13, 970, 107], 0, 0.07, GOLD, 0.9);
    g.sheen = glintBuild(k, p, "Sheen", 104, [1, 0.72, 0.42], [1, 0.95, 0.84]);
    g.flare = pic(p, "Flare", OUT + "row_gold_rim_light.png", [209, -13, 970, 107]);
    g.flare.material = F.mat("Lb_Glow", "kitFlare", { Mode: 4, Intensity: 1.6, Flicker: 0 }); g.flare.color = new UE.Color(GOLD[0], GOLD[1], GOLD[2], 1); g.fcr = g.flare.canvasRenderer;
    g.embers = fxRect(p, "Embers", [231, -13, 946, 107], F.mat("Lb_Motes", "kitRowEmbers", { Mode: 3, TintRamp: 1, Intensity: 1.2, SparkCell: 40, SparkDensity: 0.1, SparkSize: 0.07, Speed: 0.5, Seed: 7.3 }), GOLD);
    g.seam = fxRect(p, "Seam", [231, 76, 946, 14], F.mat("Lb_FloorSeam", "kitSeam", { Mode: 5, TintRamp: 1, NoisePx: 260, Speed: 0.35, Erode: 0.3, Intensity: 0.9, EdgeFade: 0.04 }), GOLD).rectTransform;
    g.seam.pivot = V2(0, 0.5); g.seam.anchoredPosition = V2(231 - W / 2, H / 2 - 83);
    g.cg.alpha = 0; g.a = 0;
  }
  function focusFrame(k, Rf, cur, t) {
    var g = k.fx;
    if (!Rf) g.key = null;
    else if (g.key !== cur) {
      g.key = cur; g.at = t;
      if (g.row !== Rf) { g.row = Rf; g.rt.SetParent(Rf.rt, false); g.rt.SetSiblingIndex(3); }
    }
    var R = g.row; if (!R) return;
    gset(g, R.on ? R.lit : 0); if (g.a <= 0) return;
    var u = t - g.at;
    swAt(g.rim, u < 0.6 ? once(t, g.at + 0.04, 0.45) : pass(t, g.at + 4.5, 4.5, 0.6));
    glintAt(g.sheen, u < 0.7 ? once(t, g.at + 0.08, 0.55) : pass(t, g.at + 4.6, 4.5, 0.75), 236, 920, 1.25);
    var f = clamp(1 - u / 0.4, 0, 1); if (g.fS !== f) { g.fS = f; g.fcr.SetAlpha(f * f); g.flare.enabled = f > 0; }
    var sx = ease(u / 0.25); if (g.sS !== sx) { g.sS = sx; g.seam.localScale = new UE.Vector3(sx, 1, 1); }
  }
  // the panel fills in order when the Evotype under the cursor changes: the power counts up and the bar fills, the
  // legend, the Legacy skill (its tile pops), the tactics one by one, then the build's sockets
  function panelFrame(k, t) {
    if (k.pDone) return;
    var p = t - k.pAt;
    if (k.pScore != null) say(k.pPow, "POWER  " + Math.round(k.pScore * ease(p / 0.3)));
    var f = 434 * ease((p - 0.04) / 0.3);
    k.pSegs.forEach(function (sg, i) { var q = k.pSegR[i]; if (!q) return; var w = Math.round(clamp(f - (q[0] - 1247), 0, q[1]) * 10) / 10; if (q[2] !== w) { q[2] = w; at(sg.rectTransform, [q[0], 263, w, 9]); } });
    k.gLeg.forEach(function (g, q) { var u = ease((p - 0.1 - 0.04 * q) / 0.2); gset(g, u, 10 * (1 - u), 0); });
    var u = ease((p - 0.14) / 0.22), s = 0.6 + 0.4 * eob((p - 0.14) / 0.26); gset(k.gSk, u, 0, 6 * (1 - u)); scl(k.pSkTile.rectTransform, s); scl(k.pSk.rectTransform, s);
    gset(k.gTacCap, ease((p - 0.18) / 0.2));
    k.gTac.forEach(function (g, q) { var u = ease((p - 0.2 - 0.05 * q) / 0.22); gset(g, u, 12 * (1 - u), 0); });
    gset(k.gBuild, ease((p - 0.28) / 0.2));
    k.pBuild.forEach(function (b, i) { var s = 0.5 + 0.5 * eob((p - 0.3 - 0.025 * i) / 0.22); scl(b.bg.rectTransform, s); scl(b.ic.rectTransform, s); });
    k.pDone = p > 0.9;
  }

  // one list row: a whole-canvas holder moved down to its place, its parts at the kit's x and at y from its own top
  // (the kit's first Evotype row, hero_1, has its top at 256; the selected plate reaches 13 px above and below it)
  function buildRow(k, i) {
    var A = K.A, c = layer(k.list, "Row" + i);
    var R = { rt: c, go: c.gameObject, lit: 0, on: true, i: i, key: null };
    R.cg = R.go.AddComponent(T(UE.CanvasGroup)); R.cg.blocksRaycasts = false; R.cg.interactable = false;
    R.idle = pic(c, "Idle", OUT + "row_idle_blank.png", [231, 0, 946, 81]);
    R.sel = pic(c, "Sel", OUT + "row_selected_blank.png", [209, -13, 970, 107]);
    R.rim = pic(c, "Rim", OUT + "row_gold_rim_light.png", [209, -13, 970, 107]);
    R.hitA = box(c, "HitA", [231, 0, 946, 81]); R.hitB = box(c, "HitB", [209, -13, 970, 107]);
    // No Legacy (the kit's row_none, 163 px above hero_1)
    var n = R.none = layer(c, "None");
    pic(n, "Badge", OUT + "none_badge.png", [271, 9, 65, 71]);
    pic(n, "Glass", OUT + "none_hourglass.png", [289, 27, 26, 34]);
    R.nName = label(n, "T_Name", 366, 22, 27, WHITE, "l", 3); say(R.nName, "No Legacy");
    R.nUse = label(n, "T_Use", 366 + 0, 22 + 0.78 * 27 - 0.78 * 19, 19, USE, "l", 3); say(R.nUse, "IN USE");
    R.nSub = label(n, "T_Sub", 361, 54, 18, NONESUB, "l", 0);
    // an Evotype
    var h = R.hero = layer(c, "Hero");
    var m = pic(h, "PMask", OUT + "portrait_mask.png", [272, 3, 61, 69]); m.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false;
    var mr = m.rectTransform;
    R.port = layerIn(mr, "Port").gameObject.AddComponent(T(UI.RawImage)); R.port.raycastTarget = false; R.port.gameObject.SetActive(false);
    R.icon = layerIn(mr, "Icon").gameObject.AddComponent(T(UI.Image)); R.icon.raycastTarget = false; R.icon.preserveAspect = true;
    pic(h, "PRim", OUT + "portrait_rim.png", [272, 3, 61, 69]);
    R.hName = label(h, "T_Name", 364, 16, 27, WHITE, "l", 3);
    R.hPow = label(h, "T_Pow", 364, 16 + 0.78 * 27 - 0.78 * 20.5, 20.5, POW, "l", 3);
    R.hUse = label(h, "T_Use", 364, 16 + 0.78 * 27 - 0.78 * 19, 19, USE, "l", 3); say(R.hUse, "IN USE");
    R.hSum = label(h, "T_Sum", 367, 47, 17.5, ROWSUB, "l", 0);
    pic(h, "Track", OUT + "bar_track.png", [744, 53, 170, 12]);
    R.segs = [0, 1, 2, 3].map(function (q) { return pic(h, "Seg" + q, OUT + "bar_seg_white.png", [747, 54, 10, 9]); });
    R.els = [0, 1, 2].map(function (q) { return { ic: img(h, "El" + q, [747, 13, 29, 28]), t: label(h, "T_El" + q, 777, 21, 19, WHITE, "l", 3, 80) }; });
    R.sock = [0, 1, 2].map(function (q) {
      var x = 938 + 53 * q;
      return { bg: pic(h, "Sock" + q, OUT + "skill_socket_blank.png", [x, 7, 53, 55]), ic: img(h, "SockIc" + q, [x + 9, 17, 35, 30]), tier: pic(h, "Tier" + q, OUT + "tier_white.png", [x + 14, 47, 25, 12]) };
    });
    R.tile = pic(h, "Tile", OUT + "hero_1_level_tile.png", [1103, 6, 61, 64]);
    R.sk = img(h, "Skill", [1115, 16, 38, 35]);
    R.lv = label(h, "T_Lv", 1133.5, 53, 18, CYAN, "c", 3, 80);
    return R;
  }
  // a child that fills its parent (the portrait and the head inside the hex mask)
  function layerIn(parent, name) { var rt = K.A.node(parent, name); rt.anchorMin = V2(0, 0); rt.anchorMax = V2(1, 1); rt.sizeDelta = V2(0, 0); rt.anchoredPosition = V2(0, 0); return rt; }

  K.live = function (Z, S, k) {
    var A = K.A, E = K.E, X = E._;
    k.F = null; try { k.F = G.BB4LIT && G.BB4LIT.fxKit ? G.BB4LIT.fxKit(S) : null; } catch (e) { log("fxKit: " + es(e)); }
    if (!k.F) log("live: no Fx materials, the page is drawn still");
    // the plate and the cover behind it drift as one, so their seam at a wide screen's edges never moves
    k.drift = layer(k.root, "Drift");
    k.cover = pic(k.drift, "Cover", BG, [0, 0, W, H]);
    k.plate = pic(k.drift, "Plate", BG, FULL);
    if (k.F) try { ambBuild(k); } catch (e) { log("amb: " + es(e)); k.amb = null; }
    // the header: the step's name, what is shown, the sort
    k.gTitle = grp(k.root, "GTitle"); k.title = label(k.gTitle.rt, "T_Title", 228, 19, 47, WHITE, "l", 3);
    k.gSub = grp(k.root, "GSub"); k.sub = label(k.gSub.rt, "T_Sub", 232, 70, 19, SUB, "l", 0, 900);
    k.gSortCap = grp(k.root, "GSortCap"); k.sortCap = label(k.gSortCap.rt, "T_SortCap", 1198, 43, 18, SORTCAP, "l", 0); say(k.sortCap, "SORT");
    if (k.F) { k.streak = spot(k, k.root, "Streak", 170, 40, 320, 9, 0, GOLD); k.streak.im.enabled = false; k.streakOn = false; }
    k.start = chip(k.root, "StartTactics", [909, 26, 239, 48], null, OUT + "starting_tactics.png");
    k.start.t = label(k.start.rt, "T", 1028.5, 41, 19.5, WHITE, "c", 3, 230); at(k.start.t.rt, lrect(k.start.t), k.start.r);
    k.sorts = X.SORTS.map(function (s, i) {
      var r = SORTR[s[0]], c = chip(k.root, "Sort" + i, r, OUT + "sort_power.png", OUT + (i == 2 ? "sort_element_black.png" : "sort_hero_black.png"));
      c.t = label(c.rt, "T", r[0] + r[2] / 2, 41, 19.5, SORTIDLE, "c", 3, r[2]); at(c.t.rt, lrect(c.t), r); say(c.t, s[1]); c.key = s[0];
      return c;
    });
    // the filter row: All, an element chip for each element these Evotypes have, then hero, tactic and skill
    k.fAll = chip(k.root, "ElAll", [256, 99, 87, 48], OUT + "filter_all.png", OUT + "filter_flame.png");
    k.fAll.t = label(k.fAll.rt, "T", 299.5, 114, 19, WHITE, "c", 3, 87); at(k.fAll.t.rt, lrect(k.fAll.t), k.fAll.r); say(k.fAll.t, "All");
    k.fEl = {};
    for (var e = 1; e <= 11; e++) {
      var r0 = [EL_X, 99, EL_W, 48], c0 = chip(k.root, "El" + e, r0, OUT + "filter_all.png", OUT + "filter_flame.png");
      c0.ic = img(c0.rt, "Ic", [EL_X + 14, 108, 26, 30], r0); elPic(c0.ic, e, [EL_X + 14, 108, 26, 30], r0);
      c0.t = label(c0.rt, "T", EL_X + 56, 115, 18, WHITE, "l", 3, 40); at(c0.t.rt, lrect(c0.t), r0);
      c0.x = EL_X; c0.go.SetActive(false); c0.shown = false; k.fEl[e] = c0;
    }
    k.fHero = chip(k.root, "Hero", [1152, 98, 171, 51], null, OUT + "filter_every_hero.png");
    // the sort and these two filters wear the black plate of every other idle chip (the kit drew them red by mistake)
    k.fTac = chip(k.root, "Tactic", [1323, 98, 267, 51], null, OUT + "filter_any_tactic_black.png");
    k.fSkill = chip(k.root, "Skill", [1590, 98, 165, 51], null, OUT + "filter_any_skill_black.png");
    [[k.fHero, 1237.5, 150, WHITE], [k.fTac, 1464, 200, TACIDLE], [k.fSkill, 1672, 150, SKIDLE]].forEach(function (q) {
      var c = q[0]; c.t = label(c.rt, "T", q[1], 115, 19, q[3], "c", 3, q[2]); at(c.t.rt, lrect(c.t), c.r); c.idle = q[3];
      c.t.t.enableAutoSizing = true; c.t.t.fontSizeMax = 19; c.t.t.fontSizeMin = 13; c.t.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    });
    // the run's triple dash and jump switch, left of Starting Tactics on the same plate (fourlobbyevo.js keeps the setting)
    k.triple = chip(k.root, "Triple", [664, 22, 232, 42], null, OUT + "starting_tactics.png");
    k.triple.t = label(k.triple.rt, "T", 780, 35, 17, WHITE, "c", 3, 222); at(k.triple.t.rt, lrect(k.triple.t), k.triple.r);
    k.chipsA = [k.triple, k.start].concat(k.sorts);
    k.chipsB = [k.fAll].concat(Object.keys(k.fEl).map(function (e) { return k.fEl[e]; }), [k.fHero, k.fTac, k.fSkill]);
    // the list
    k.list = layer(k.root, "List"); k.rows = [];
    for (var i = 0; i < X.ROWS; i++) k.rows.push(buildRow(k, i));
    if (k.F) try { focusBuild(k); } catch (e) { log("focus: " + es(e)); k.fx = null; }
    // a glint runs down the list now and then, row after row
    if (k.F) k.rows.forEach(function (R) { try { R.sw = glintBuild(k, R.rt, "IdleSw", 81, PALE, [1, 0.85, 0.93]); } catch (e) { R.sw = null; } });
    k.gRail = grp(k.root, "GRail");
    k.page = label(k.gRail.rt, "T_Page", 245, 667, 17, PAGE, "l", 0);
    k.track = pic(k.gRail.rt, "Track", "02_assets/scroll/scroll_track.png", [1178, 161, 13, 495]);
    k.thumb = pic(k.gRail.rt, "Thumb", "02_assets/scroll/scroll_thumb.png", [1180, 169, 6, 127]);
    // the detail panel: No Legacy as the kit has it; an Evotype in full (power, elements, Legacy skill, tactics, build)
    k.gDet = grp(k.root, "GDet"); var gd = k.gDet.rt;
    pic(gd, "PFrame", OUT + "detail_frame.png", [1194, 149, 538, 555]);
    if (k.F) try { k.detSw = sweep(k, gd, "FrameSw", OUT + "detail_frame.png", [1194, 149, 538, 555], -60, 0.07, PALE, 0.55); } catch (e) { log("frame sweep: " + es(e)); }
    if (k.F) { k.comet = [spot(k, gd, "CometT", 0, 0, 260, 10, 0, PALE), spot(k, gd, "CometH", 0, 0, 44, 13, 0, [1, 0.85, 0.93]), spot(k, gd, "CometG", 0, 0, 130, 34, 0, ROSE)]; k.comet.forEach(function (d) { d.im.enabled = false; }); k.cometOn = false; }
    pic(gd, "PFace", OUT + "detail_face.png", [1222, 172, 483, 495]);
    var pn = k.panel = layer(gd, "Panel"); k.pcg = pn.gameObject.AddComponent(T(UE.CanvasGroup)); k.pcg.blocksRaycasts = false;
    k.pTitle = label(pn, "T_Title", 1241, 194, 35, WHITE, "l", 3, 450);
    k.pTitle.t.enableAutoSizing = true; k.pTitle.t.fontSizeMax = 35; k.pTitle.t.fontSizeMin = 24; k.pTitle.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    k.pBody = label(pn, "T_Body", 1244, 252, 18.5, BODY, "l", 0, 440, 120); k.pBody.t.enableWordWrapping = true;
    var pe = k.pEv = layer(pn, "Ev");
    k.pPow = label(pe, "T_Pow", 1244, 236, 19, POW, "l", 3, 440);
    pic(pe, "Track", OUT + "bar_track.png", [1244, 262, 440, 12]);
    k.pSegs = [0, 1, 2, 3, 4, 5].map(function (q) { return pic(pe, "Seg" + q, OUT + "bar_seg_white.png", [1247, 263, 10, 9]); });
    // (each part in its own holder, so the panel can fill in order: panelFrame)
    k.gLeg = [0, 1, 2, 3].map(function (q) { return grp(pe, "GLeg" + q); });
    k.pLeg = [0, 1, 2, 3].map(function (q) { var x = 1244 + 110 * q, g = k.gLeg[q].rt; return { ic: img(g, "LegIc" + q, [x, 282, 22, 22]), t: label(g, "T_Leg" + q, x + 26, 286, 15, WHITE, "l", 3, 200) }; });
    k.gSk = grp(pe, "GSk"); var gs = k.gSk.rt;
    k.pSkCap = label(gs, "T_SkCap", 1244, 316, 14, CAP, "l", 1); say(k.pSkCap, "LEGACY SKILL");
    k.pSkTile = pic(gs, "SkTile", OUT + "hero_1_level_tile.png", [1244, 334, 61, 64]);
    k.pSk = img(gs, "SkIc", [1256, 344, 38, 35]);
    k.pSkName = label(gs, "T_SkName", 1318, 340, 22, WHITE, "l", 3, 366);
    k.pSkName.t.enableWordWrapping = false; k.pSkName.t.enableAutoSizing = true; k.pSkName.t.fontSizeMax = 22; k.pSkName.t.fontSizeMin = 15; k.pSkName.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    k.pSkDesc = label(gs, "T_SkDesc", 1318, 368, 15, BODY, "l", 0, 366, 64);
    k.pSkDesc.t.enableWordWrapping = true; k.pSkDesc.t.enableAutoSizing = true; k.pSkDesc.t.fontSizeMax = 15; k.pSkDesc.t.fontSizeMin = 11; k.pSkDesc.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    k.gTacCap = grp(pe, "GTacCap"); k.pTacCap = label(k.gTacCap.rt, "T_TacCap", 1244, 440, 14, CAP, "l", 1); say(k.pTacCap, "TACTICS HANDED DOWN");
    k.gTac = [0, 1, 2].map(function (q) { return grp(pe, "GTac" + q); });
    k.pTac = [0, 1, 2].map(function (q) {
      var y = 456 + 42 * q, g = k.gTac[q].rt;
      return { bg: pic(g, "TSock" + q, OUT + "skill_socket_blank.png", [1244, y, 36, 38]), ic: img(g, "TIc" + q, [1250, y + 7, 24, 24]),
               name: label(g, "T_TName" + q, 1290, y + 4, 17, WHITE, "l", 3, 390), ser: label(g, "T_TSer" + q, 1290, y + 24, 13, CAP, "l", 0, 390) };
    });
    k.gBuild = grp(pe, "GBuild"); var gb = k.gBuild.rt;
    k.pBuildCap = label(gb, "T_BuildCap", 1244, 592, 14, CAP, "l", 1);
    k.pBuild = []; for (var b = 0; b < PAN_BUILD; b++) k.pBuild.push({ bg: pic(gb, "BSock" + b, OUT + "skill_socket_blank.png", [1244 + 40 * b, 610, 36, 38]), ic: img(gb, "BIc" + b, [1250 + 40 * b, 617, 24, 24]) });
    k.pSegR = []; k.pDone = true;
    // the footer: the keys as the kit writes them, [key] then what it does, ending at the panel's right edge
    k.gFoot = grp(k.root, "GFoot"); k.foot = layer(k.gFoot.rt, "Foot"); k.fp = [];
    for (var f = 0; f < 8; f++) k.fp.push({ key: label(k.foot, "K" + f, 0, 780, 19, WHITE, "l", 1, 200), im: img(k.foot, "G" + f, [0, 775.5, 24, 24]), lab: label(k.foot, "L" + f, 0, 780, 19, FOOT, "l", 0, 400), imOn: true });
    k.footSig = null;
    log("live: built");
  };

  function bpf() { var b = G.BPFREE; return b && b.open && b.count ? b : null; }

  // each frame: what the page's state says, drawn on the kit
  K.liveFrame = function (Z, S, k, t) {
    if (!k.rows) return;
    var A = K.A, E = K.E, X = E._, p = S.pick; if (!p || !Z.view) return;
    var l = p.list, two = p.step == "evo2", inUse = two ? p.evo2 : p.evo, nv = Z.view.length, ROWS = X.ROWS;
    var dt = Math.min(0.1, UE.Time.unscaledDeltaTime), kf = 1 - Math.exp(-dt * 18);
    // the motion: the open (once, then its last state written), the plate's drift and the kit's light loop
    var o = t - (k.openAt == null ? t : k.openAt);
    if (!k.oDone) { try { openFrame(k, Math.min(o, 1.3)); } catch (e) { if (!k.oErr) log("open: " + es(e)); k.oErr = true; } if (o >= 1.3) k.oDone = true; }
    try { driftFrame(k, t, o); if (k.amb) ambFrame(k, t, o); } catch (e) { log("amb: " + es(e)); if (k.amb) k.amb.rt.gameObject.SetActive(false); k.amb = null; }
    if (k.oDone) streakAt(k, wrap(t - k.openAt - 5, 8) / 0.5);
    var filt = Z.f.el || Z.f.hero || Z.f.tactic || Z.f.skill;
    say(k.title, two ? "LEGACY II" : "LEGACY I");
    say(k.sub, "for " + A.heroLabelOf(p.hero) + "   ·   " + (filt ? (nv - 1) + " of " + Z.n : Z.n) + (Z.n == 1 ? " Evotype" : " Evotypes") +
      (filt ? "   ·   <color=#ffd27a>filtered</color>" : "") + "   ·   " + X.sortLine(Z));
    // sort tabs and Starting Tactics, matched to the page's own chips (k.smap: its index to ours, for the mouse)
    var st = false; k.smap = [];
    Z.sortChips.forEach(function (c, i) {
      var foc = Z.zone == "sort" && Z.fcur == i;
      if (c.triple) {
        var on3 = X.tripleOn(); say(k.triple.t, X.TRIPLE_LABEL + (on3 ? "  ON" : "  OFF")); tint(k.triple.t, on3 ? GOLD : WHITE);
        chipLight(k.triple, on3, foc, kf, t); k.smap[i] = k.triple; return;
      }
      if (c.start) {
        st = true; var b = bpf(), n = b ? b.count() : 0;
        say(k.start.t, n ? "Starting Tactics " + n + "/4" : "Starting Tactics"); tint(k.start.t, n ? GOLD : WHITE);
        chipLight(k.start, n > 0, foc, kf, t); k.smap[i] = k.start; return;
      }
      var v = null; k.sorts.forEach(function (s) { if (s.key == c.key) v = s; }); if (!v) return;
      // 0.1.7: the Power chip carries weakest first too (fourlobbyevo.js CYCLE), its label says which
      var sk = X.chipKey ? X.chipKey(Z.sort) : Z.sort, lit = sk == c.key; chipLight(v, lit, foc, kf, t); tint(v.t, v.lit > 0.5 ? INK : SORTIDLE); k.smap[i] = v;
      if (c.key == "power" && X.sortName) { var pl = X.sortName(Z.sort == "weak" ? "weak" : "power"); if (v.lab !== pl) { v.lab = pl; say(v.t, pl); } }
    });
    if (k.start.shown !== st) { k.start.shown = st; k.start.go.SetActive(st); }
    // the filter row, in the page's order (k.fmap: its index to ours)
    var seq = Z.filterSeq || [], nEl = 0, ei = 0, seen = {}; k.fmap = [];
    seq.forEach(function (c) { if (c.el) nEl++; });
    var step = nEl > 9 ? (EL_END - EL_X) / nEl : EL_W;
    seq.forEach(function (c, i) {
      var v, lit, foc = Z.zone == "filter" && Z.fcur == i;
      if (c.el !== undefined) {
        if (!c.el) v = k.fAll;
        else {
          v = k.fEl[c.el]; if (!v) return; seen[c.el] = 1;
          var x = EL_X + step * ei++; if (v.x !== x) { v.x = x; at(v.rt, [x, 99, EL_W, 48]); }
          if (!v.shown) { v.shown = true; v.go.SetActive(true); }
          say(v.t, String(Z.els[c.el] || 0));
        }
        lit = Z.f.el == c.el; tint(v.t, v.lit > 0.5 ? INK : WHITE);
      } else {
        v = c == Z.heroChip ? k.fHero : c == Z.tacChip ? k.fTac : k.fSkill;
        lit = c == Z.heroChip ? !!Z.f.hero : c == Z.tacChip ? !!Z.f.tactic : !!Z.f.skill;
        tint(v.t, lit ? GOLD : v.idle);
      }
      chipLight(v, lit, foc, kf, t); k.fmap[i] = v;
    });
    for (var en in k.fEl) { var ce = k.fEl[en]; if (!seen[en] && ce.shown) { ce.shown = false; ce.go.SetActive(false); } }
    var GR = G.BB4SEL && G.BB4SEL.GROUPS, fg = Z.f.hero < 0 && GR ? GR[-Z.f.hero - 1] : null;
    say(k.fHero.t, fg ? "<color=#" + hex(fg.col) + ">" + fg.label + "</color>" : Z.f.hero ? A.heroLabelOf(Z.f.hero) : "Every hero");
    say(k.fTac.t, Z.f.tactic ? X.blessName(Z.f.tactic) : "Any tactic");
    say(k.fSkill.t, Z.f.skill ? "With Legacy skill" : "Any skill");
    // the rows: the focused one lights to the selected plate and the rows under it make room; they come in on the
    // select's group-change rhythm (2 frames apart, 8 frames each, 24 px)
    var u0 = t - Math.max(Z.listAt || 0, (k.openAt || 0) + 0.12), y = 150, Rf = null;
    k.rows.forEach(function (R, i) {
      var kk = Z.top + i, on = kk < nv;
      if (R.on !== on) { R.on = on; R.go.SetActive(on); }
      if (!on) return;
      var j = Z.view[kk], e = l[j], foc = kk == Z.cur && Z.zone == "list" && !Z.picker;
      if (foc) Rf = R;
      R.lit += ((foc ? 1 : 0) - R.lit) * kf; if (Math.abs(R.lit - (foc ? 1 : 0)) < 0.003) R.lit = foc ? 1 : 0;
      var ps = 1 + 0.07 * R.lit; if (R.psS !== ps) { R.psS = ps; scl(R.port.rectTransform, ps); scl(R.icon.rectTransform, ps); }
      var u = ease((u0 - i * 2 / 60) / (8 / 60)), org = y + 13 * R.lit; y += 80 + 26 * R.lit;
      R.cg.alpha = u; R.rt.anchoredPosition = V2((1 - u) * 24, -org);
      if (R.litS !== R.lit) { R.litS = R.lit; alpha(R.idle, 1 - R.lit); alpha(R.sel, R.lit); }
      alpha(R.rim, R.lit * (0.86 + 0.14 * Math.sin(t * 2.6)));
      glintAt(R.sw, R.lit < 0.5 ? pass(t, (k.openAt || 0) + 1.4 + 0.07 * i, 6, 0.8) : -1, 262, 884, 1);
      var using = e ? !!(inUse && e.uid == inUse.uid) : !inUse;
      var key = e ? "h" + e.uid + "/" + using + "/" + Z.max + "/" + X.isFav(e) + "/" + (e.inheritSkillIndex | 0) : "n/" + using + "/" + two;
      if (R.key === key) return; R.key = key;
      R.none.gameObject.SetActive(!e); R.hero.gameObject.SetActive(!!e);
      if (!e) { show(R.nUse, using); if (using) put(R.nUse, 366 + pw(R.nName) + 24); say(R.nSub, two ? "Play with Legacy I only" : "Start the run without one"); return; }
      fillRow(R, e, using, Z, X, A);
    });
    if (k.fx) try { focusFrame(k, Rf, Z.top + "/" + Z.cur, t); } catch (e) { log("focus: " + es(e)); k.fx.rt.gameObject.SetActive(false); k.fx = null; }
    // under the list: where the list is, and the rail
    var r0 = Math.max(Z.top, 1), r1 = Math.min(nv - 1, Z.top + ROWS - 1), rng = (r0 == r1 ? r0 : r0 + "–" + r1) + " of " + (nv - 1);
    say(k.page, nv - 1 > 0 && (nv > ROWS || filt) ? (Z.top == 0 ? "No Legacy, then " + rng : rng) : nv == 1 && filt ? "No Evotype matches these filters" : "");
    var th = nv > ROWS ? clamp(529 * ROWS / nv, 48, 479) : 127, ty = nv > ROWS ? 169 + (479 - th) * Z.top / (nv - ROWS) : 169;
    if (k.thY == null) { k.thY = ty; k.thH = th; }
    k.thY += (ty - k.thY) * kf; k.thH += (th - k.thH) * kf; if (Math.abs(ty - k.thY) < 0.05) k.thY = ty; if (Math.abs(th - k.thH) < 0.05) k.thH = th;
    var tk = k.thH + "/" + k.thY; if (k.thumbK !== tk) { k.thumbK = tk; at(k.thumb.rectTransform, [1180, k.thY, 6, k.thH]); }
    // the detail panel, filled again when the Evotype under the cursor changes, its text easing in
    var ev = l[p.i], pev = ev; if (Z.zone != "list" && !ev && nv > 1) pev = l[Z.view[1]];
    var pk = (pev ? pev.uid : "none") + (two ? "/2" : "/1");
    if (k.pFor !== pk) { k.pFor = pk; k.pAt = t; fillPanel(k, pev, two, X, A); }
    var pu = ease((t - k.pAt) / (10 / 60)); if (k.puS !== pu) { k.puS = pu; k.pcg.alpha = pu; k.panel.anchoredPosition = V2((1 - pu) * 14, 0); }
    try { panelFrame(k, t); } catch (e) { if (!k.pErr) log("panel: " + es(e)); k.pErr = true; k.pDone = true; }
    // a light runs round the panel's frame when it fills, and again every 7 s
    if (k.detSw) swAt(k.detSw, t - k.pAt < 0.75 ? once(t, k.pAt + 0.05, 0.65) : pass(t, k.openAt + 1.6, 7, 1.2));
    if (k.comet) try { cometFrame(k, t); } catch (e) { log("comet: " + es(e)); k.comet.forEach(function (d) { d.im.enabled = false; }); k.comet = null; }
    drawFoot(k, E, S);
  };
  function hex(c) { return c.slice(0, 3).map(function (v) { var s = Math.round(clamp(v, 0, 1) * 255).toString(16); return s.length < 2 ? "0" + s : s; }).join(""); }

  function fillRow(R, e, using, Z, X, A) {
    var kept = e.inheritBlesses || [], ep = X.prof(e), sk = X.skillOf(e);
    say(R.hName, (X.isFav(e) ? X.STAR : "") + A.heroLabelOf(e.id)); say(R.hPow, Math.round(e.score));
    // a long name is set smaller, on the same baseline, so its power (and IN USE) stop short of the element glyphs at 747
    var fs = 27; R.hName.t.fontSize = fs; R.hName.pw = null;
    if (ep.list.length) {
      var over = 364 + pw(R.hName) + POW_GAP + pw(R.hPow) + (using ? 24 + pw(R.hUse) : 0) + 44 - 747;
      if (over > 0) { fs = Math.max(19, 27 * (1 - over / Math.max(1, pw(R.hName)))); R.hName.t.fontSize = fs; R.hName.pw = null; }
    }
    put(R.hName, 364, 16 + 0.96 * (27 - fs));
    var px = 364 + pw(R.hName) + POW_GAP; put(R.hPow, px);
    show(R.hUse, using); if (using) put(R.hUse, px + pw(R.hPow) + 24);
    say(R.hSum, kept.length + " handed down" + (ep.total ? "  ·  " + ep.total + " in build" : ""));
    R.icon.color = new UE.Color(1, 1, 1, 1); X.headInto(R, e.id);
    // power: the bar's length is this Evotype's share of the best one, split by the build's elements
    var ws = 164 * clamp(e.score / Math.max(1, Z.max), 0.04, 1), tot = 0, sx = 747; ep.list.forEach(function (it) { tot += it[1]; });
    R.segs.forEach(function (sg, q) {
      var it = ep.list[q], on = tot > 0 ? !!it : q == 0; sg.gameObject.SetActive(on); if (!on) return;
      var w = tot > 0 ? ws * it[1] / tot : ws; at(sg.rectTransform, [sx, 54, Math.max(1, w - 1), 9]);
      sg.color = tot > 0 ? A.col(X.elCol(it[0]), 1) : new UE.Color(1, 1, 1, 1); sx += w;
    });
    // the build's main elements, up to three, each glyph with its count
    var x = 747;
    R.els.forEach(function (pr, q) {
      var it = ep.list[q]; pr.ic.gameObject.SetActive(!!it); show(pr.t, !!it); if (!it) return;
      elPic(pr.ic, it[0], [x, 13, 29, 28]);
      say(pr.t, Math.round(it[1])); tint(pr.t, X.elCol(it[0])); put(pr.t, x + 30); x += 30 + pw(pr.t) + 18;
    });
    // the tactics it hands down, in its three sockets, each with its quality's colour under it
    R.sock.forEach(function (s, q) {
      var b = kept[q]; s.bg.gameObject.SetActive(!!b); s.ic.gameObject.SetActive(!!b); s.tier.gameObject.SetActive(!!b); if (!b) return;
      s.ic.sprite = X.blessSprite(b.id); var d = X.dq(b.id, b.quality); s.tier.color = A.col(X.QC[d] || X.QC[1], 1);
    });
    // the Legacy skill on the level tile
    var ss = sk && (sk.sprite || A.inheritIcon); R.sk.sprite = ss; R.sk.gameObject.SetActive(!!ss);
    say(R.lv, sk ? "Lv " + sk.level : ""); alpha(R.tile, sk ? 1 : 0.45);
  }

  function fillPanel(k, ev, two, X, A) {
    k.pScore = ev ? ev.score : null; k.pSegR = []; k.pDone = !ev;
    if (!ev) {
      say(k.pTitle, "No Legacy"); show(k.pBody, true); k.pEv.gameObject.SetActive(false);
      say(k.pBody, two ? "Play with Legacy I only." : "Start the run with no Legacy: no tactics or skill handed down.");
      return;
    }
    show(k.pBody, false); k.pEv.gameObject.SetActive(true);
    say(k.pTitle, A.heroLabelOf(ev.id)); say(k.pPow, "POWER  " + Math.round(ev.score));
    var pr = X.prof(ev), tot = 0, x = 1247; pr.list.forEach(function (it) { tot += it[1]; });
    k.pSegs.forEach(function (sg, i) {
      var it = pr.list[i], on = !!it && tot > 0; sg.gameObject.SetActive(on); if (!on) return;
      var w = 434 * it[1] / tot; at(sg.rectTransform, [x, 263, Math.max(2, w - 2), 9]); sg.color = A.col(X.elCol(it[0]), 1);
      k.pSegR[i] = [x, Math.max(2, w - 2), null]; x += w;
    });
    // the legend under the bar: each element at its measured width, the ones that would pass the bar's end left out
    var lx = 1244;
    k.pLeg.forEach(function (lg, i) {
      var it = pr.list[i];
      if (it) { say(lg.t, X.elName(it[0]) + " " + Math.round(it[1])); if (lx + 26 + pw(lg.t) > 1684) it = null; }
      lg.ic.gameObject.SetActive(!!it); show(lg.t, !!it || (i == 0 && !pr.list.length)); if (!it) { lx = 9999; return; }
      elPic(lg.ic, it[0], [lx, 282, 22, 22]); put(lg.t, lx + 26);
      tint(lg.t, X.elCol(it[0])); lx += 26 + pw(lg.t) + 16;
    });
    if (!pr.list.length) { say(k.pLeg[0].t, "No build saved"); tint(k.pLeg[0].t, DIMT); }
    var sk = X.skillOf(ev), ss = sk && (sk.sprite || A.inheritIcon); k.pSk.sprite = ss; k.pSk.gameObject.SetActive(!!ss);
    say(k.pSkName, sk ? (sk.name || "Legacy skill") + "   <size=75%><color=#6ffbfe>Lv " + sk.level + "</color></size>" : "<color=#8a8698>No Legacy skill</color>");
    say(k.pSkDesc, sk ? sk.desc || "" : "This Evotype hands down no skill.");
    var kept = ev.inheritBlesses || [];
    k.pTac.forEach(function (s, i) {
      var b = kept[i]; s.ic.gameObject.SetActive(!!b); s.bg.gameObject.SetActive(!!b || i == 0);
      if (!b) { say(s.name, i == 0 ? "None" : ""); tint(s.name, DIMT); say(s.ser, ""); return; }
      s.ic.sprite = X.blessSprite(b.id); var d = X.dq(b.id, b.quality);
      say(s.name, X.blessName(b.id)); tint(s.name, X.QC[d] || X.QC[1]); say(s.ser, X.seriesOf(b.id).map(X.elName).join(" + ") || "Tactic");
    });
    var bl = A.build(ev.uid) || [];
    say(k.pBuildCap, bl.length ? "THE WHOLE BUILD  ·  " + bl.length + (bl.length > PAN_BUILD ? "  (first " + PAN_BUILD + ")" : "") : "THE WHOLE BUILD  ·  not saved");
    k.pBuild.forEach(function (s, i) { var b = bl[i]; s.bg.gameObject.SetActive(!!b); s.ic.gameObject.SetActive(!!b); if (b) s.ic.sprite = X.blessSprite(b.id); });
  }

  // the footer, laid out again only when the prompts or the controller change
  function drawFoot(k, E, S) {
    var items = E.prompts(S), parts = [];
    items.forEach(function (x) { for (var j = 0; j < x.length; j += 2) parts.push({ id: x[j], label: x[j + 1] }); });
    var gl = parts.map(function (q) { return S.promptGlyph ? S.promptGlyph(q.id) : null; });
    var sig = JSON.stringify(items) + gl.map(function (g) { return g ? (g.sp ? "s" : "") + g.key : ""; }).join("|");
    if (sig === k.footSig) return; k.footSig = sig;
    var x = 1863;
    for (var i = parts.length - 1; i >= 0; i--) {
      var P = k.fp[i]; if (!P) continue;
      var lab = parts[i].label || "", g = gl[i];
      show(P.lab, !!lab); say(P.lab, lab);
      if (lab) { x -= pw(P.lab); put(P.lab, x); x -= 8; }
      var sprite = g && g.sp;
      if (P.imOn !== !!sprite) { P.imOn = !!sprite; P.im.gameObject.SetActive(!!sprite); }
      show(P.key, !sprite);
      if (sprite) { P.im.sprite = sprite; x -= 52; at(P.im.rectTransform, [x, 761.5, 52, 52]); }   // the button fills half its 64 px picture: 52 draws it near 1.5x the label's capitals (the lead 2026-11-03: "a good size")
      else { say(P.key, "[" + ((g && g.key) || "?") + "]"); x -= pw(P.key); put(P.key, x); }
      x -= i > 0 && !parts[i - 1].label ? 8 : 26;   // the two keys of a pair (Q E) sit close
    }
    for (var q = parts.length; q < k.fp.length; q++) { var F = k.fp[q]; show(F.lab, false); show(F.key, false); if (F.imOn) { F.imOn = false; F.im.gameObject.SetActive(false); } }
  }

  // the mouse on the live page: the page's own handler tests its hidden pieces, so rows and chips are tested here
  K.mouse = function (S, mp, click, wheel, moved, over) {
    var E = K.E, Z = E && E.Z, k = Z && Z.kit, orig = E && E.__kitMouseOrig;
    // the v5 Legacy screen is drawn over this one and takes its own clicks: this layer's rows are hidden under it and
    // must not answer (they chose rows and pressed chips the player could not see: the lead, 2026-11-10)
    if (G.BB4E5 && G.BB4E5.st && G.BB4E5.st.shown && Z && !Z.picker) return orig ? orig.call(E, S, mp, click, wheel, moved, over) : false;
    if (!Z || !Z.open || !k || k.mode == "fixture" || !k.rows || Z.picker) return orig ? orig.call(E, S, mp, click, wheel, moved, over) : false;
    var b = G.BPFREE; if (b && (b.picking || b.opening)) return true;   // input belongs to the tree window while it is up
    var ROWS = E._.ROWS, nv = Z.view.length;
    if (wheel) { Z.top = clamp(Z.top + (wheel > 0 ? -1 : 1), 0, Math.max(0, nv - ROWS)); Z.cur = clamp(Z.cur, Z.top, Z.top + ROWS - 1); Z.cur = Math.min(Z.cur, nv - 1); }
    if (!moved && !click) return true;
    var hit = null;
    k.rows.forEach(function (R, i) { if (!hit && R.on && over(R.lit > 0.5 ? R.hitB : R.hitA, mp)) hit = function () { Z.zone = "list"; Z.cur = Z.top + i; if (click) E.press(S); }; });
    (k.fmap || []).forEach(function (v, i) { if (!hit && v && over(v.rt, mp)) hit = function () { Z.zone = "filter"; Z.fcur = i; if (click) E._.act(S, Z.filterSeq[i]); }; });
    (k.smap || []).forEach(function (v, i) { if (!hit && v && v.go.activeSelf && over(v.rt, mp)) hit = function () { Z.zone = "sort"; Z.fcur = i; if (click) E._.act(S, Z.sortChips[i]); }; });
    if (hit) hit();   // a click on empty space does nothing: Esc or the right button backs out
    return true;
  };
  K.mouseWrap = K.mouseWrap || function (S, mp, click, wheel, moved, over) { return K.mouse(S, mp, click, wheel, moved, over); };

  // every picture the live page draws, under ART: with one missing the page stays the one fourlobbyevo.js draws (0.1.1
  // shipped without the two sort chips and stopped half way, over a page it had already hidden)
  var NEED = ["05_background/clean_plate_1916.png", "02_assets/scroll/scroll_track.png", "02_assets/scroll/scroll_thumb.png"].concat(
    ("amb_edges amb_glint amb_ribbon bar_seg_white bar_track detail_face detail_frame filter_all filter_any_skill_black filter_any_tactic_black " +
     "filter_every_hero filter_flame hero_1_level_tile none_badge none_hourglass portrait_mask portrait_rim row_gold_rim_light row_idle_blank " +
     "row_selected_blank skill_socket_blank sort_element_black sort_hero_black sort_power starting_tactics tier_white").split(" ")
      .map(function (n) { return "out/" + n + ".png"; }));
  K.missing = function () { return NEED.filter(function (p) { return !IO.File.Exists(ART + p); }); };
  // a build that fails puts the page back as fourlobbyevo.js drew it
  K.undo = function (Z, S, E) {
    try {
      var k = Z.kit; Z.kit = null;
      if (k && k.root && !k.root.Equals(null)) UE.Object.Destroy(k.root.gameObject);
      var old = k && k.old;
      if (old && !old.Equals(null)) {
        var kids = []; for (var i = 0; i < old.childCount; i++) kids.push(old.GetChild(i));
        kids.forEach(function (c) { c.SetParent(Z.root, false); }); UE.Object.Destroy(old.gameObject);
        Z.pkVeil.rectTransform.SetAsLastSibling(); Z.pick.SetAsLastSibling();
      }
      if (k && k.hid && S && S.promptT) S.promptT.localScale = UE.Vector3.one;
      if (E && E.mouse === K.mouseWrap && E.__kitMouseOrig) E.mouse = E.__kitMouseOrig;
    } catch (e) { log("undo: " + es(e)); }
  };

  K.build = function (Z, S, A, E) {
    try {
      if (K.mode != "fixture") {
        var miss = K.missing();
        if (miss.length) { if (!K.warned) log("missing in " + ART + ": " + miss.join(", ") + "; the page stays as it was"); K.warned = true; return; }
      }
      K.A = A; K.E = E;
      if (E.mouse !== K.mouseWrap) { E.__kitMouseOrig = E.mouse; E.mouse = K.mouseWrap; }
      var root = Z.root, k = Z.kit, old = k ? k.old : null;
      if (k) UE.Object.Destroy(k.root.gameObject);
      if (!old) {
        old = A.node(root, "Old"); old.anchorMin = V2(0, 0); old.anchorMax = V2(1, 1); old.sizeDelta = V2(0, 0); old.anchoredPosition = V2(0, 0);
        var kids = []; for (var i = 0; i < root.childCount; i++) kids.push(root.GetChild(i));
        kids.forEach(function (c) { if (c.name != "Old" && c.name != "PkVeil" && c.name != "Picker") c.SetParent(old, false); });
        old.gameObject.SetActive(false);
      }
      var kr = A.node(root, "Kit"); kr.anchorMin = kr.anchorMax = V2(0.5, 0.5); kr.pivot = V2(0.5, 0.5); kr.sizeDelta = V2(W, H); kr.anchoredPosition = V2(0, 0);
      Z.kit = k = { root: kr, old: old, s: 0, mode: K.mode };
      Z.pkVeil.rectTransform.SetAsLastSibling(); Z.pick.SetAsLastSibling();
      if (K.mode == "fixture") fixture(k);
      else if (K.live) K.live(Z, S, k);
    } catch (e) { log("build: " + es(e)); K.undo(Z, S, E); }
  };

  // each frame the page is up or closing: fit the root to the screen and keep the footer to the kit's own
  K.frame = function (Z, S, t) {
    var k = Z.kit; if (!k) return;
    try {
      var ps = S.promptT;
      if (!Z.open) { k.wasOpen = false; if (k.hid) { ps.localScale = UE.Vector3.one; k.hid = false; } return; }
      if (!k.wasOpen) { k.wasOpen = true; k.openAt = t; k.oDone = false; }   // the page opened (or was built open): play the open
      if (!k.hid) { ps.localScale = UE.Vector3.zero; k.hid = true; }
      var r = Z.root.rect, s = Math.min(r.width / W, r.height / H);
      if (Math.abs(s - k.s) > 1e-5) {
        k.s = s; k.root.localScale = new UE.Vector3(s, s, 1);
        var f = Math.max(r.width / W, r.height / H) / s; if (k.cover) k.cover.rectTransform.sizeDelta = V2(W * f + 4, H * f + 4);
      }
      if (k.mode != "fixture" && K.liveFrame) K.liveFrame(Z, S, k, t);
    } catch (e) { if (!k.err) log("frame: " + es(e)); k.err = true; }
  };

  // a reload of this file over a page already built rebuilds the kit in place
  try { var EV = G.BB4EVO; if (EV && EV.Z && EV.A && G.BB4UI) K.build(EV.Z, G.BB4UI, EV.A, EV); } catch (e) { log("late: " + es(e)); }
  log("ready");
})();
