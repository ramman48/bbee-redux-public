/* palette-maker: the colour maker's window (appended to core/ActorUtil after palcore.js; opened from the lobby TV).

   Two screens from the mod's own bundle (uikit/Assets/PalMaker, PalMakerBuild.cs; art in art/krita):
   - PalHeroes, over the lobby: a card for every hero the player owns. Picking one goes to Try Out with that hero, and
     the maker opens there by itself (palcore.js, openWhenReady).
   - PalMaker, over Try Out. Left board: the player's saved palettes for this hero and the ones seen on other players
     online. Right board: the palette being made: its name, every colour part the hero's sprites are made of, and the
     picker for the selected part (lit, shadow and dark colours, or the part kept as it is) plus the hero's effect tint.
     Bottom: save, wear, base palette, copy code, export file, delete, close. The hero in the middle shows every change.
   The prefabs carry the art, the shaders (gold rules, the hue bar, sparks, sweeps) and the 60 fps animation; this script
   fills them in, lights what is hovered or focused and fires their one-shots. Mouse: its own pointer. Controller: the
   left stick moves a gold cursor, A clicks under it or drags on the colour square and hue bar. Keyboard: the arrows move
   a gold focus frame, Enter presses, Enter on the colour square or hue bar lets the arrows move the colour. LB / RB (Q / E)
   switch the lists, B or Esc closes. Nothing here can put on a palette the player does not own. */
(function () {
  var G = globalThis, cs = CS, UE = cs.UnityEngine, UI = UE.UI, PT = require("puerts"), T = function (t) { return PT.$typeof(t); };
  var M = G.BBPAL; if (!M) return;
  var TMP = cs.TMPro.TextMeshProUGUI, TA = cs.TMPro.TextAlignmentOptions, V2 = UE.Vector2, V3 = UE.Vector3;
  function C(r, g, b, a) { return new UE.Color(r, g, b, a === undefined ? 1 : a); }
  function log(s) { M.log("window: " + s); }
  function isNull(o) { try { return !o || o.Equals(null); } catch (e) { return !o; } }
  var COL = { text: C(0.95, 0.93, 0.89), dim: C(0.66, 0.63, 0.66), gold: C(1, 0.84, 0.52), ink: C(0.13, 0.09, 0.05), bad: C(1, 0.42, 0.38) };
  var GOLD = [1, 0.82, 0.48];
  // each official hero's card colour (four-player's lobby, measured from the hero's full portrait)
  var HERO_COLOUR = {"100101": [0.85, 0.12, 0.18], "100201": [0.26, 0.45, 0.85], "100301": [0.25, 0.45, 0.95], "100302": [0.30, 0.37, 0.85], "100401": [0.85, 0.17, 0.23], "100501": [0.95, 0.75, 0.20], "100601": [0.85, 0.14, 0.23], "100701": [0.85, 0.18, 0.20], "100801": [0.85, 0.14, 0.12], "100901": [0.85, 0.13, 0.16], "101001": [0.52, 0.30, 0.85], "101101": [0.85, 0.27, 0.18], "101201": [0.30, 0.51, 0.85], "101301": [0.85, 0.28, 0.36], "101401": [0.30, 0.80, 0.40], "101501": [0.30, 0.37, 0.85], "101601": [0.85, 0.43, 0.11], "101701": [0.85, 0.53, 0.08], "101801": [0.95, 0.45, 0.75], "101901": [0.85, 0.30, 0.52], "102001": [0.85, 0.73, 0.10], "102002": [0.85, 0.73, 0.10], "102101": [0.85, 0.15, 0.24], "102201": [0.85, 0.71, 0.08], "102301": [0.85, 0.28, 0.65], "102401": [0.85, 0.11, 0.08], "102501": [0.85, 0.22, 0.30], "102601": [0.85, 0.57, 0.15], "102701": [0.85, 0.58, 0.13], "102801": [0.85, 0.76, 0.13], "102901": [0.28, 0.33, 0.85], "103001": [0.85, 0.17, 0.23], "103101": [0.85, 0.17, 0.19], "103201": [0.86, 0.62, 0.19], "103301": [0.26, 0.85, 0.48], "103401": [0.30, 0.50, 0.95], "103501": [0.55, 0.35, 0.90], "103601": [0.89, 0.59, 0.13], "103701": [0.13, 0.75, 0.85], "103801": [0.85, 0.10, 0.35]};
  // portraits whose face falls outside the card at the shared framing: [x, y, scale] (y down shows more of the top)
  var FRAME = {"103401": [-130, -150, 1], "101401": [0, -110, 1], "101701": [-10, -90, 1], "102901": [0, -110, 1], "100701": [-40, -10, 1], "100601": [-40, -130, 1], "193301": [40, 30, 1],
    // the mod heroes' select portraits, framed to the base cards' bust: face about 72 px below the card's top, head about
    // 44 px high (2026-11-14, set on each portrait's face point; Weiss and Reki were full figures low on the card)
    "200301": [54, 1, 1.7], "200401": [-22, -41, 1.36], "200701": [60, -14, 1.36], "201001": [10, 27, 0.76], "201101": [51, 115, 1.14], "201301": [-24, 66, 1.51]};
  // the mod heroes' card colours, from each mod's own colour (presentation.colour or its skin row's Color), brought to
  // the base cards' brightness. Nine and Reki have none fit for a card (a second skin's swatch), so theirs is measured
  // from the portrait; Swift Master has none at all, so his is his coat's violet
  function modColour(hex) { var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16), m = Math.max(r, g, b) || 1; return [r / m * 0.88, g / m * 0.88, b / m * 0.88]; }
  [["190101", "#8a55e6"], ["191101", "#3fae6a"], ["193301", "#3fae6a"], ["200301", "#6b3fa0"], ["200701", "#c8102e"], ["201301", "#9FC9E8"],
   ["200801", "#4a5fc8"], ["200901", "#e8d27a"], ["201401", "#E2B12B"], ["201501", "#4FA9E8"], ["201601", "#C8202E"], ["201701", "#B0245E"], ["201801", "#3FB8A4"]
  ].forEach(function (p) { HERO_COLOUR[p[0]] = modColour(p[1]); });
  HERO_COLOUR["200401"] = [0.88, 0.31, 0.33]; HERO_COLOUR["201001"] = [0.62, 0.45, 0.88]; HERO_COLOUR["201101"] = [0.88, 0.37, 0.27];
  // a hero whose select portrait is not a picture of the hero: Izanami's points at her boss crest (char-izanami's texture
  // alias); the card takes the game's own full portrait of her, the one the roadmap and the four-player lobby use
  var PORTRAIT = {"200301": "UI/Texture/HeroPortraitFull/HeroPortraitFull_103201"};
  // Spine heroes (ICEY, The Prisoner, Reki): the maker paints sprite-sheet palettes only, so picking one went to Try Out
  // and never opened (docs/palettes/HANDOFF.md); they are left off the hero choice until the maker reads atlas pages
  var SPINE = {"103701": 1, "103801": 1, "201101": 1};
  var old = M.ui; if (old && old.kill) { try { old.kill(); } catch (e) {} }
  var W = M.ui = { isOpen: false, tab: "mine", page: 0, sel: 0, stop: "lit", hsv: [0, 0, 1], dirty: false, hov: [], tw: [], drag: null };
  var ROWS = 8, CARDS = 12;

  // ------------------------------------------------------------------ the stock palette window's fonts
  var FONT = {};
  function fonts() {
    if (FONT.title && !isNull(FONT.title)) return;
    try {
      var AM = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase);
      var go = AM.LoadAssetByType(T(UE.GameObject), "GamePlay/Map/FunctionalPrefab/SceneUIHeroSkin");
      var ts = go.GetComponentsInChildren(T(TMP), true);
      for (var i = 0; i < ts.Length; i++) { var f = ts.get_Item(i).font; if (!f) continue; var n = String(f.name); if (/Aldrich/.test(n)) FONT.title = f; if (/MiSans/.test(n)) FONT.body = f; }
    } catch (e) { log("fonts: " + e); }
    if (!FONT.title) { var any = UE.Object.FindObjectOfType(T(TMP)); FONT.title = FONT.body = any ? any.font : null; }
    FONT.body = FONT.body || FONT.title;
  }

  // ------------------------------------------------------------------ the prefabs
  // installed: through the asset manager; a test window that hot-loads a new build sets BBPAL_UI_BUNDLE to the uikit file
  var NAMES = ["PalMaker", "PalHeroes"];
  function prefabs() {
    var out = {}, dev = G.BBPAL_UI_BUNDLE;
    if (!dev) {
      try { var AM = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase); NAMES.forEach(function (n) { var p = AM.LoadAssetByType(T(UE.GameObject), "UI/Prefab/PalMaker/" + n); if (p && !isNull(p)) out[n] = p; }); } catch (e) { log("prefab: " + e); }
      if (out.PalMaker && out.PalHeroes) return out;
      log("installed screens: " + NAMES.filter(function (n) { return !out[n]; }).join(", ") + " missing"); return out;
    }
    // a hot load: BBPAL_UI_BUNDLE names palmaker.ab; palheroes.ab sits beside it (one prefab per bundle, as installed)
    G.BBPAL_BUNDLES = G.BBPAL_BUNDLES || {};
    NAMES.forEach(function (n) {
      try {
        var file = dev.replace(/palmaker\.ab$/i, n.toLowerCase() + ".ab"), b = G.BBPAL_BUNDLES[n];
        // the one-argument LoadFromFile and LoadAsset are stripped from the game's build
        if (!b || isNull(b)) b = UE.AssetBundle.LoadFromFile(file, 0, 0);
        if (!b || isNull(b)) {           // the installed copy holds the bundle's name: let it go, then load ours
          var am = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase);
          var bn = "ui/prefab/palmaker/" + n.toLowerCase() + ".ab";
          try { var a = cs.System.Array.CreateInstance(T(cs.System.String), 1); a.SetValue(bn, 0); am.UnloadBundleByPath(a); } catch (e) { log("unload: " + e); }
          try { var L = UE.AssetBundle.GetAllLoadedAssetBundles().GetEnumerator(); while (L.MoveNext()) { var x = L.Current; if (x && String(x.name) == bn) x.Unload(false); } } catch (e) { log("unload loaded: " + e); }
          b = UE.AssetBundle.LoadFromFile(file, 0, 0);
        }
        G.BBPAL_BUNDLES[n] = b;
        var all = b.LoadAllAssets(T(UE.GameObject));
        for (var i = 0; i < all.Length; i++) { var g = all.get_Item(i); out[String(g.name)] = g; }
      } catch (e) { log("dev bundle " + n + ": " + e); }
    });
    return out;
  }

  // ------------------------------------------------------------------ building blocks
  function find(tr, path) { var n = tr.Find(path); if (isNull(n)) throw new Error("prefab has no " + path); return n; }
  function img(tr, path) { return find(tr, path).GetComponent(T(UI.Image)); }
  function rtOf(tr, path) { return (path ? find(tr, path) : tr).GetComponent(T(UE.RectTransform)); }
  function setA(g, a) { var c = g.color; c.a = a; g.color = c; }
  function tint(g, c, a) { g.color = C(c[0], c[1], c[2], a === undefined ? g.color.a : a); }
  // a TextMeshPro line on one of the prefab's T_* nodes
  function txt(tr, path, size, c, align, face) {
    var n = path ? find(tr, path) : tr, t = n.GetComponent(T(TMP));
    if (isNull(t)) t = n.gameObject.AddComponent(T(TMP));
    var f = face == "body" ? FONT.body : FONT.title; if (f) t.font = f;
    t.fontSize = size; t.color = c || COL.text; t.enableWordWrapping = false; t.raycastTarget = false;
    t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis; t.alignment = align || TA.MidlineLeft; t.text = "";
    // Ellipsis also hides a whole line taller than its box: the box grows to the line
    var r = n.GetComponent(T(UE.RectTransform)), sd = r.sizeDelta; if (sd.y > 0 && sd.y < size * 1.5) r.sizeDelta = new V2(sd.x, size * 1.5);
    return t;
  }
  function now() { return UE.Time.unscaledTime; }
  function tween(dur, f) { W.tw.push({ t0: now(), d: dur, f: f }); }
  function ease(u) { return 1 - Math.pow(1 - u, 3); }
  // something the pointer or the focus frame can press. pre: where its On / Glow / Gold / Off images sit in the node
  function el(tr, act, o) {
    o = o || {}; var pre = o.pre || "", e = { go: tr.gameObject, tr: tr, act: act, on: false, gold: !!o.gold, glow: 0, o: o };
    ["On", "Glow", "Gold"].forEach(function (k) { var n = tr.Find(pre + k); if (!isNull(n)) e[k.toLowerCase() + "I"] = n.GetComponent(T(UI.Image)); });
    var l = tr.Find("T_Label"); if (!isNull(l)) e.t = txt(l, null, o.size || 20, COL.text, o.align || TA.Center, o.face);
    if (!e.glowI && !o.card) e.selfI = tr.GetComponent(T(UI.Image));
    if (W.buildingHz) e.hz = true; W.hov.push(e); paint(e); return e;
  }
  function paint(e) {
    if (e.onI) setA(e.onI, e.on ? (e.o.onA || 1) : 0);
    if (e.goldI) setA(e.goldI, e.gold && !e.on ? 1 : 0);
    if (e.t) e.t.color = e.on || e.gold ? COL.ink : COL.text;
  }
  function setOn(e, on) { on = !!on; if (e.on === on) return; e.on = on; paint(e); }
  function label(e, s) { if (e.t) e.t.text = s; }
  function show(e, on) { if (e.go.activeSelf != !!on) e.go.SetActive(!!on); }
  function hexOf(c) { return "#" + c.slice(0, 3).map(function (v) { var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return s.length < 2 ? "0" + s : s; }).join("").toUpperCase(); }
  function rgbToHsv(c) { var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0; if (d > 1e-6) h = mx == r ? ((g - b) / d + 6) % 6 : mx == g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, mx > 1e-6 ? d / mx : 0, mx]; }
  function hsvToRgb(h, s, v) { var i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i]; }
  function ucol(c, a) { return C(c[0], c[1], c[2], a === undefined ? 1 : a); }

  // ------------------------------------------------------------------ state
  function me() { return M.me(); }
  function heroName(id) { var n = ""; try { n = String(require("Core/Util").U.GetLocale("BaseActor_chs_" + id) || ""); } catch (e) {} return n || "Hero " + id; }
  function status(s, bad) {
    log(s); if (W.msg === s) return; W.msg = s;
    if (!W.st) return;
    W.st.text = s; W.st.color = bad ? COL.bad : COL.text; tint(W.toastAcc, bad ? [1, 0.3, 0.26] : GOLD);
    fire(bad ? "Bad" : "Toast");
  }
  // The one-shot layer has weight only while a one-shot plays: once it has played one, an idle one-shot layer at full weight
  // keeps writing stale values over the opening and the idle loop (tiles and the bar froze half faded).
  var SHOT_LEN = { Close: 0.3, Tab: 0.3, Wear: 0.5, Save: 0.44, Pick: 0.24, Bad: 0.4, Toast: 0.2 };
  function fire(trigger) {
    if (!W.anM || W.picking) return;
    if (trigger == "Toast" && now() - (W.openedAt || 0) < 0.6) return;     // the opening brings the toast in itself
    try { W.anM.SetLayerWeight(1, 1); W.anM.SetTrigger(trigger); W.fxUntil = Math.max(W.fxUntil || 0, now() + (SHOT_LEN[trigger] || 0.5)); } catch (e) { log("trigger " + trigger + ": " + e); }
  }
  function burstAt(e, trigger) { try { var c = centre(e.go); W.burst.position = new V3(c[0], c[1], 0); fire(trigger); } catch (er) { log("burst: " + er); } }
  // W.sel: a colour part (0 up), the effect tint (-1) or a glow entry (-2 down; W.glows from M.glowParts)
  function part() { return W.pal && W.sel >= 0 && W.pal.parts[W.sel]; }
  function gsel() { return W.pal && W.sel <= -2 ? (W.glows || [])[-2 - W.sel] : null; }
  function hasTarget() { return W.pal && (W.sel == -1 || !!gsel() || !!part()); }
  function glowNow(g) { return W.pal.glow && W.pal.glow[g.chs[0]]; }
  function glowName(i) {
    var g = W.glows[i], line = g && g.chs.length == 1 && g.chs[0] == "W", n = W.glows.filter(function (h) { return !(h.chs.length == 1 && h.chs[0] == "W"); }).length;
    return line ? "glow line" : n > 1 ? "glow " + (W.glows.slice(0, i).filter(function (h) { return !(h.chs.length == 1 && h.chs[0] == "W"); }).length + 1) : "glow";
  }
  function stopColour() {
    if (W.sel == -1) return W.pal.fx || [1, 1, 1];
    var g = gsel(); if (g) return glowNow(g) || g.base;
    var p = part(); if (!p) return [1, 1, 1];
    if (W.stop == "shadow") return p.sh || mix(p.lit || p.base, [0, 0, 0], 0.5);
    if (W.stop == "dark") return p.dk || [0, 0, 0];
    return p.lit || p.base;
  }
  function mix(a, b, k) { return [0, 1, 2].map(function (i) { return a[i] * (1 - k) + b[i] * k; }); }
  function setStop(c) {
    var g = gsel();
    if (W.sel == -1) { W.pal.fx = c; }
    else if (g) { W.pal.glow = W.pal.glow || {}; W.pal.glow2 = true; g.chs.forEach(function (ch) { W.pal.glow[ch] = c; }); }
    else {
      var p = part(); if (!p) return; p.on = true;
      if (W.stop == "shadow") p.sh = c; else if (W.stop == "dark") p.dk = c; else p.lit = c;
    }
    W.dirty = true; W.changed = true;
  }
  // a saved or seen code into an editable palette: the hero's own part names and base colours added back
  function editable(pal) {
    var a = me(), parts = []; try { parts = M.parts(a); } catch (e) {}
    pal.parts.forEach(function (p, i) {
      var best = null, bd = 9; parts.forEach(function (q) { var d = Math.pow(q.c[0] - p.c[0], 2) + Math.pow(q.c[1] - p.c[1], 2) + Math.pow(q.c[2] - p.c[2], 2); if (d < bd) { bd = d; best = q; } });
      p.name = best && bd < 0.001 ? best.name : "part " + (i + 1); p.base = best ? best.base : [0.5, 0.5, 0.5]; p.share = best ? best.share : 0;
      if (!p.lit) p.lit = p.base.slice();
    });
    return pal;
  }

  // ------------------------------------------------------------------ the window
  W.build = function () {
    fonts();
    var pf = prefabs(); if (!pf.PalMaker || !pf.PalHeroes) throw new Error("the colour maker's screens are not in the game (bundle ui/prefab/palmaker)");
    var root = W.root = new UE.GameObject("PaletteMaker", T(UE.RectTransform));
    UE.Object.DontDestroyOnLoad(root);
    var cv = root.AddComponent(T(UE.Canvas)); cv.renderMode = UE.RenderMode.ScreenSpaceOverlay; cv.sortingOrder = 29400;
    var sc = root.AddComponent(T(UI.CanvasScaler)); sc.uiScaleMode = UI.CanvasScaler.ScaleMode.ScaleWithScreenSize; sc.referenceResolution = new V2(1920, 1080); sc.matchWidthOrHeight = 1;
    W.canvas = cv;
    var mg = UE.Object.Instantiate(pf.PalMaker, root.transform, false); mg.name = "PalMaker"; W.mk = mg.transform; W.anM = mg.GetComponent(T(UE.Animator));
    var hg = UE.Object.Instantiate(pf.PalHeroes, root.transform, false); hg.name = "PalHeroes"; W.hz = hg.transform; W.anH = hg.GetComponent(T(UE.Animator));
    buildMaker(); buildHeroes();
    // the controller's cursor: the colour square's reticle, over everything
    var cg = UE.Object.Instantiate(W.svCur.gameObject, root.transform, false), crt = cg.GetComponent(T(UE.RectTransform)); cg.name = "PadCursor";
    crt.anchorMin = crt.anchorMax = new V2(0, 0); crt.pivot = new V2(0.5, 0.5); crt.sizeDelta = new V2(48, 48);
    W.vcur = { go: cg, rt: crt, img: cg.GetComponent(T(UI.Image)), s: 1 }; cg.SetActive(false);
    root.SetActive(false);
  };
  function buildMaker() {
    var mk = W.mk, L = find(mk, "Lib/Slide"), S = find(mk, "Studio/Slide"), P = find(S, "Picker");
    txt(L, "T_Title", 42, COL.gold, TA.MidlineLeft).text = "COLOUR MAKER";
    W.heroT = txt(L, "T_Hero", 19, COL.dim, TA.MidlineLeft, "body");
    W.tabMine = el(find(L, "TabMine"), function () { W.setTab("mine"); }, { size: 18 }); label(W.tabMine, "MY PALETTES");
    W.tabSeen = el(find(L, "TabSeen"), function () { W.setTab("seen"); }, { size: 18 }); label(W.tabSeen, "SEEN ONLINE");
    W.rows = [];
    for (var i = 0; i < ROWS; i++) (function (k) {
      var tr = find(L, "Rows/Row" + k), e = el(tr, function () { W.pick(k); }, { pre: "Slide/", onA: 0.55 });
      e.name = txt(tr, "Slide/T_Name", 22, COL.text, TA.MidlineLeft, "body"); e.sub = txt(tr, "Slide/T_Sub", 15, COL.dim, TA.MidlineLeft, "body");
      e.sw = []; for (var j = 0; j < 5; j++) e.sw.push({ go: find(tr, "Slide/Sw" + j).gameObject, now: img(tr, "Slide/Sw" + j + "/Now") });
      e.badge = find(tr, "Slide/Badge").gameObject; rtOf(tr, "Slide/Badge").anchoredPosition = new V2(398, 60);   // a tab on the row's top edge, over the swatches
      e.badgeT = txt(tr, "Slide/Badge/T_Badge", 13, COL.ink, TA.Center); e.badgeT.text = "WORN";
      e.sweep = rtOf(tr, "Slide/Mask/Sweep"); e.sweepI = img(tr, "Slide/Mask/Sweep");
      W.rows.push(e);
    })(i);
    W.prev = el(find(L, "PrevPage"), function () { W.page = Math.max(0, W.page - 1); W.list(true); });
    W.next = el(find(L, "NextPage"), function () { W.page++; W.list(true); });
    W.pageT = txt(L, "T_Page", 16, COL.dim, TA.Center, "body");
    W.bNew = el(find(L, "BtnNew"), function () { W.fresh(); }, { size: 17 }); label(W.bNew, "NEW");
    W.bPaste = el(find(L, "BtnPaste"), function () { W.paste(); }, { size: 16 }); label(W.bPaste, "PASTE CODE");
    W.bFiles = el(find(L, "BtnFiles"), function () { W.importFiles(); }, { size: 16 }); label(W.bFiles, "IMPORT FILES");
    W.bKeep = el(find(L, "BtnKeep"), function () { W.keepSeen(); }, { size: 17, gold: true }); label(W.bKeep, "SAVE TO MY PALETTES");

    W.bName = el(find(S, "BtnName"), function () { W.rename(); }, { size: 26, face: "body", align: TA.MidlineLeft });
    W.bName.t.margin = new UE.Vector4(26, 0, 52, 0);
    txt(S, "T_Parts", 15, COL.dim, TA.MidlineLeft).text = "COLOUR PARTS  -  PICK ONE, THEN ITS COLOURS";
    W.cells = [];
    for (var c = 0; c < 16; c++) (function (k) {
      var tr = find(S, "Tiles/Tile" + k), e = el(tr, function () { W.select(k); burstAt(e, "Pick"); }, { pre: "Pop/", onA: 0.85 });
      e.was = img(tr, "Pop/Hex/Was"); e.now = img(tr, "Pop/Hex/Now");
      e.name = txt(tr, "Pop/T_Name", 15, COL.text, TA.MidlineLeft, "body"); e.name.enableAutoSizing = true; e.name.fontSizeMin = 11; e.name.fontSizeMax = 15; e.sub = txt(tr, "Pop/T_Sub", 13, COL.dim, TA.MidlineLeft, "body");
      W.cells.push(e);
    })(c);
    W.fxCell = el(find(S, "FxTile"), function () { W.select(-1); burstAt(W.fxCell, "Pick"); }, { size: 16, align: TA.MidlineLeft, onA: 0.85 });
    W.fxCell.now = img(S, "FxTile/Hex/Now");

    W.selT = txt(P, "T_Sel", 20, COL.gold, TA.MidlineLeft); var sr = rtOf(P, "T_Sel"); sr.anchoredPosition = new V2(sr.anchoredPosition.x + 16, sr.anchoredPosition.y);
    W.bLit = el(find(P, "StopLit"), function () { W.useStop("lit"); }, { size: 16 }); label(W.bLit, "LIT");
    W.bSh = el(find(P, "StopShadow"), function () { W.useStop("shadow"); }, { size: 16 });
    W.bDk = el(find(P, "StopDark"), function () { W.useStop("dark"); }, { size: 16 }); label(W.bDk, "DARK");
    W.bChange = el(find(P, "BtnChange"), function () { W.toggle(true); }, { size: 15 });
    W.bKeepP = el(find(P, "BtnKeepPart"), function () { W.toggle(false); }, { size: 15 });
    W.bReset = el(find(P, "BtnReset"), function () { W.resetPart(); }, { size: 15 }); label(W.bReset, "RESET PART");
    W.bShOff = el(find(P, "BtnNoShadow"), function () { var p = part(); if (p) { p.sh = null; W.dirty = W.changed = true; W.useStop("lit"); } }, { size: 15 }); label(W.bShOff, "NO SHADOW");
    W.sv = find(P, "SV").gameObject; W.svRaw = W.sv.GetComponent(T(UI.RawImage)); W.svCur = rtOf(P, "SV/Cursor");
    W.hue = find(P, "Hue").gameObject; W.notch = rtOf(P, "Hue/Notch");
    W.swNow = img(P, "Swatch/Now"); W.swWas = img(P, "Swatch/Was"); W.ring = img(P, "Swatch/Ring"); W.ringRt = rtOf(P, "Swatch/Ring");
    W.hexT = txt(P, "T_Hex", 22, COL.text, TA.Center);
    var PRE = ["#E8E4DC", "#8A8C94", "#202024", "#C8102E", "#F28C28", "#F2C14E", "#3FA34D", "#2A9D8F", "#2F6FDE", "#7B3FC4", "#E04E9A", "#6B4226"];
    PRE.forEach(function (h, k) {
      var c = [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255], tr = find(P, "Presets/Pre" + k);
      img(tr, "Now").color = ucol(c);
      el(tr, function () { if (!hasTarget()) return; W.hsv = rgbToHsv(c); setStop(c); W.refresh(); W.pulse(); }, { grow: 1.18 });
    });

    var acts = [["BtnSave", "SAVE", function () { W.save(); }, 1], ["BtnWear", "WEAR", function () { W.wear(); }], ["BtnBase", "BASE PALETTE", function () { W.base(); }],
      ["BtnCopy", "COPY CODE", function () { W.copy(); }], ["BtnExport", "EXPORT FILE", function () { W.exportFile(); }], ["BtnDelete", "DELETE", function () { W.del(); }], ["BtnClose", "CLOSE", function () { if (W.studio()) { W.holdT = 0; W.holdBlock = true; W.leave(); } else W.close(); }]];
    acts.forEach(function (a) {
      var e = el(find(mk, "Bar/" + a[0]), a[2], { size: 19, gold: !!a[3] }); label(e, a[1]); if (a[0] == "BtnClose") W.bClose = e;
      if (a[0] == "BtnDelete") { if (e.glowI) tint(e.glowI, [1, 0.3, 0.26]); if (e.onI) tint(e.onI, [1, 0.42, 0.36]); }   // the one button that loses work glows red
    });
    // the view row over the bar (0.2.6): backdrop and light, sit still, try moves. Copies of a bar button, kept in the
    // bar so they come and go with it; in the middle, clear of both boards (712 to 1208 of 1920)
    var bar = find(mk, "Bar"), tpl = find(mk, "Bar/BtnBase").gameObject;
    W.viewBtns = [["BtnLight", function () { W.cycleLight(); }], ["BtnStill", function () { W.toggleStill(); }], ["BtnTry", function () { W.studioToggle(); }]].map(function (a, k) {
      var g = UE.Object.Instantiate(tpl, bar, false); g.name = a[0];
      var rt = g.GetComponent(T(UE.RectTransform)); rt.anchoredPosition = new V2(602 + k * 170, 98); rt.sizeDelta = new V2(156, 44);
      return el(g.transform, a[1], { size: 15 });
    });
    W.bLight = W.viewBtns[0]; W.bStill = W.viewBtns[1]; W.bTry = W.viewBtns[2]; label(W.bTry, "TRY MOVES");
    // the hex code is a field: pressed, it asks for a colour
    W.bHex = el(find(P, "T_Hex"), function () { W.typeHex(); }, { grow: 1.08 });
    W.boards = ["Lib", "Studio", "Bar", "Toast"].map(function (n) { return find(mk, n).gameObject; });
    W.vig = img(mk, "Vignette");
    W.st = txt(mk, "Toast/T_Toast", 19, COL.text, TA.Center, "body"); W.st.enableAutoSizing = true; W.st.fontSizeMin = 14; W.st.fontSizeMax = 19; W.toastAcc = img(mk, "Toast/Accent");
    W.burst = find(mk, "Fx/Burst");
    W.mFocus = { rt: rtOf(mk, "Focus"), img: img(mk, "Focus") };
  }
  // The hero screen's exit clip fades its cards out, and its animator then keeps writing that 0 over them on every later
  // open (rebinding or switching it off and on did not clear it; seen 2026-10-18): after an exit, a fresh screen.
  function rebuildHeroes() {
    var pf = prefabs(); if (!pf.PalHeroes) return;
    var old = W.hz, at = old.GetSiblingIndex();
    W.hov = W.hov.filter(function (e) { return !e.hz; });
    var hg = UE.Object.Instantiate(pf.PalHeroes, W.root.transform, false); hg.name = "PalHeroes"; hg.transform.SetSiblingIndex(at);
    UE.Object.Destroy(old.gameObject);
    W.hz = hg.transform; W.anH = hg.GetComponent(T(UE.Animator)); buildHeroes(); W.hzUsed = false;
  }
  function buildHeroes() {
    W.buildingHz = true; try { buildHeroesNow(); } finally { W.buildingHz = false; }
  }
  function buildHeroesNow() {
    var H = W.hz;
    txt(H, "Title/T_Title", 46, COL.gold, TA.MidlineLeft).text = "COLOUR MAKER";
    txt(H, "Title/T_Sub", 20, COL.dim, TA.MidlineLeft, "body").text = "Choose a hero to colour";
    txt(H, "Info/T_Info", 19, COL.text, TA.MidlineRight, "body").text = "Colours are made in Try Out";
    txt(H, "Info/T_Code", 16, COL.dim, TA.MidlineRight, "body").text = "so you can try your moves in them";
    var tpl = find(H, "Cards/Card"), cards = find(H, "Cards"); tpl.gameObject.SetActive(false);
    W.cards = [];
    for (var i = 0; i < CARDS; i++) (function (k) {
      var g = UE.Object.Instantiate(tpl.gameObject, cards, false); g.name = "Card" + k; g.SetActive(true);
      var rt = g.GetComponent(T(UE.RectTransform)); rt.anchoredPosition = new V2(((k % 6) - 2.5) * 290, k < 6 ? 580 : 222); rt.localScale = new V3(0.9, 0.9, 1);
      var e = el(g.transform, function () { W.chooseHero(k); }, { card: true });
      e.an = g.GetComponent(T(UE.Animator)); e.art = find(g.transform, "Lift/Rig/Face/Mask/ArtSlot/Art").GetComponent(T(UI.RawImage)); e.artRt = rtOf(g.transform, "Lift/Rig/Face/Mask/ArtSlot/Art");
      e.fill = img(g.transform, "Lift/Rig/Face/Fill"); e.fg = img(g.transform, "Lift/Rig/Face/FrameGlow"); e.hg = img(g.transform, "Lift/Rig/Face/HoverGlow"); e.flash = img(g.transform, "Lift/Rig/Flash");
      e.name = txt(g.transform, "Lift/Rig/Name/T_Name", 22, COL.text, TA.Center);
      e.count = find(g.transform, "Lift/Rig/Count").gameObject; e.countT = txt(g.transform, "Lift/Rig/Count/T_Count", 17, COL.ink, TA.Center);
      W.cards.push(e);
    })(i);
    W.hPrev = el(find(H, "Bar/BtnPrev"), function () { W.hPage = Math.max(0, W.hPage - 1); W.heroList(true); }, { size: 19 }); label(W.hPrev, "PREVIOUS");
    W.hNext = el(find(H, "Bar/BtnNext"), function () { W.hPage++; W.heroList(true); }, { size: 19 }); label(W.hNext, "NEXT");
    W.hClose = el(find(H, "Bar/BtnClose"), function () { W.close(); }, { size: 19 }); label(W.hClose, "CLOSE");
    W.hPageT = txt(H, "Bar/T_Page", 18, COL.dim, TA.Center, "body");
    W.hFocus = { rt: rtOf(H, "Focus"), img: img(H, "Focus") };
  }

  // ------------------------------------------------------------------ filling it in
  W.items = function () {
    var a = me(); if (!a) return [];
    if (W.tab == "mine") return M.mine(a.BaseID).map(function (o) { var p = M.decode(o.code); return { pal: p, code: o.code, worn: M.wornCode(a.BaseID) == o.code, sub: "made on palette " + p.skin }; });
    return M.seen().map(function (s) { var p = M.decode(s.code); return p ? { pal: p, code: s.code, seen: s, sub: "on " + (s.from || "a player") + (p.hero != a.BaseID ? ", another hero" : p.skin != (parseInt(String(a.ActorModel.Renderer.Skin)) || 0) ? ", made on palette " + p.skin : "") } : null; }).filter(function (x) { return x; });
  };
  W.setTab = function (t) { var same = W.tab == t; W.tab = t; W.page = 0; W.list(!same); };
  W.list = function (anim) {
    setOn(W.tabMine, W.tab == "mine"); setOn(W.tabSeen, W.tab == "seen");
    var it = W.items(), pages = Math.max(1, Math.ceil(it.length / ROWS)); W.page = Math.min(W.page, pages - 1); W.cur = it;
    W.rows.forEach(function (r, k) {
      var x = it[W.page * ROWS + k]; show(r, !!x); if (!x) return;
      r.name.text = x.pal.name; r.sub.text = x.sub; r.code = x.code;
      if (r.badge.activeSelf != !!x.worn) r.badge.SetActive(!!x.worn);
      var lits = x.pal.parts.filter(function (p) { return p.on; }).map(function (p) { return p.lit; });
      r.sw.forEach(function (s, j) { var on = !!lits[j]; if (s.go.activeSelf != on) s.go.SetActive(on); if (on) s.now.color = ucol(lits[j]); });
      setOn(r, W.pal && W.loadedCode == x.code);
    });
    W.pageT.text = it.length ? (pages > 1 ? (W.page + 1) + " / " + pages : "") : (W.tab == "mine" ? "No palettes yet: press NEW" : "Other players' palettes appear here");
    show(W.prev, W.page > 0); show(W.next, W.page < pages - 1);
    var seen = W.tab == "seen"; show(W.bKeep, seen); [W.bNew, W.bPaste, W.bFiles].forEach(function (e) { show(e, !seen); });
    if (anim) fire("Tab");
  };
  W.refresh = function () {
    var a = me(), pal = W.pal; if (!pal) return;
    W.heroT.text = (a ? heroName(a.BaseID) : "?") + ", made on palette " + pal.skin;
    label(W.bName, pal.name);
    var np = pal.parts.length, gl = W.glows || [];
    W.cells.forEach(function (e, k) {
      var p = pal.parts[k], g = k >= np ? gl[k - np] : null; show(e, !!(p || g)); e.gi = g ? k - np : -1;
      if (g) {                                       // the glow entries follow the colour parts
        var gn = glowNow(g); e.was.color = ucol(g.base); e.now.color = ucol(gn || g.base);
        e.name.text = glowName(k - np); e.sub.text = "light" + (gn ? "" : "  kept"); setOn(e, W.sel == -2 - (k - np)); return;
      }
      if (!p) return;
      e.was.color = ucol(p.base); e.now.color = p.on ? ucol(p.lit) : ucol(p.base);
      e.name.text = p.name; e.sub.text = Math.round((p.share || 0) * 100) + "%" + (p.on ? "" : "  kept");
      setOn(e, k == W.sel);
    });
    W.fxCell.now.color = pal.fx ? ucol(pal.fx) : C(1, 1, 1, 0.15);
    label(W.fxCell, "EFFECT TINT   " + (pal.fx ? hexOf(pal.fx) : "the hero's own effects"));
    setOn(W.fxCell, W.sel == -1);
    var p = part(), fxSel = W.sel == -1, g = gsel(), one = fxSel || !!g, gOn = g && !!glowNow(g);
    W.selT.text = fxSel ? "EFFECT TINT" : g ? glowName(-2 - W.sel).toUpperCase() + (gOn ? "" : "  (KEPT)") : p ? p.name.toUpperCase() + (p.on ? "" : "  (KEPT)") : "";
    [W.bLit, W.bSh, W.bDk, W.bShOff].forEach(function (e) { show(e, !one); }); show(W.bReset, !fxSel);
    label(W.bChange, fxSel ? "TINT ON" : "CHANGE IT"); label(W.bKeepP, fxSel ? "TINT OFF" : "KEEP AS IS");
    setOn(W.bChange, fxSel ? !!pal.fx : g ? gOn : p && p.on); setOn(W.bKeepP, fxSel ? !pal.fx : g ? !gOn : p && !p.on);
    setOn(W.bLit, W.stop == "lit"); setOn(W.bSh, W.stop == "shadow"); setOn(W.bDk, W.stop == "dark");
    label(W.bSh, p && p.sh ? "SHADOW" : "SHADOW +");
    var c = stopColour(); W.swNow.color = ucol(c); W.hexT.text = hexOf(c) + "  <size=60%><color=#A9A1A9>TYPE</color></size>";
    viewLabels();
    var was = fxSel ? null : g ? g.base : W.stop == "lit" ? p && p.base : null;
    W.swWas.color = was ? ucol(was) : C(0, 0, 0, 0);
    var h = W.hsv; W.svRaw.color = ucol(hsvToRgb(h[0], 1, 1));
    W.svCur.anchoredPosition = new V2(h[1] * 300, h[2] * 250);
    W.notch.anchoredPosition = new V2(17, h[0] * 250);
  };
  // the big swatch's ring breaks outward when a colour is chosen or a part picked
  W.pulse = function () {
    tween(0.32, function (u) { setA(W.ring, 0.9 * (1 - ease(u))); var s = 0.92 + 0.22 * ease(u); W.ringRt.localScale = new V3(s, s, 1); });
  };
  W.select = function (k) { var c = W.cells[k]; if (c && c.gi >= 0) k = -2 - c.gi; W.sel = k; if (k >= 0 && W.stop == "shadow" && !(part() && part().sh)) W.stop = "lit"; W.hsv = rgbToHsv(stopColour()); W.refresh(); W.pulse(); };
  W.useStop = function (s) { W.stop = s; var p = part(); if (s == "shadow" && p && !p.sh) { p.sh = mix(p.lit || p.base, [0, 0, 0], 0.45); p.on = true; W.dirty = W.changed = true; } W.hsv = rgbToHsv(stopColour()); W.refresh(); W.pulse(); };
  W.toggle = function (on) {
    var g = gsel();
    if (W.sel == -1) { W.pal.fx = on ? (W.pal.fx || [1, 1, 1]) : null; }
    else if (g) { if (on) setStop((glowNow(g) || g.base).slice()); else glowOff(g); }
    else { var p = part(); if (!p) return; p.on = on; if (on && !p.lit) p.lit = p.base.slice(); }
    W.dirty = W.changed = true; W.hsv = rgbToHsv(stopColour()); W.refresh();
  };
  function glowOff(g) { if (!W.pal.glow) return; g.chs.forEach(function (ch) { delete W.pal.glow[ch]; }); if (!Object.keys(W.pal.glow).length) W.pal.glow = null; W.dirty = W.changed = true; }
  W.resetPart = function () { var g = gsel(); if (g) { glowOff(g); W.select(W.sel); return; } var p = part(); if (!p) return; p.on = false; p.lit = p.base.slice(); p.sh = null; p.dk = [0, 0, 0]; W.dirty = W.changed = true; W.select(W.sel); };
  W.load = function (pal, code) { W.pal = pal; W.glows = M.glowParts(me()); W.loadedCode = code || null; W.sel = 0; W.stop = "lit"; W.changed = false; W.hsv = rgbToHsv(stopColour()); W.dirty = true; W.refresh(); W.list(); };
  W.fresh = function () {
    var a = me(); if (!a) { status("Stand as a hero first.", true); return; }
    try { var p = M.blank(a, "Palette " + (M.mine(a.BaseID).length + 1)); W.load(p, null); status("A new palette from the one you wear. Pick a part and give it a colour."); }
    catch (e) { status("This palette's colours could not be read: " + e, true); }
  };
  W.pick = function (k) {
    var x = W.cur && W.cur[W.page * ROWS + k]; if (!x) return;
    var a = me(), p = M.decode(x.code); if (!p || !a) return;
    if (p.hero != a.BaseID) { status("This palette is for another hero (" + p.hero + "). Stand as that hero to wear it.", true); return; }
    var sk = parseInt(String(a.ActorModel.Renderer.Skin)) || 0;
    if (p.skin != sk) { status("This palette is made on palette " + p.skin + ". Put that palette on first (from the stock palette window).", true); return; }
    W.load(editable(p), x.code); status("Loaded " + p.name + ".");
  };

  // ------------------------------------------------------------------ actions
  // A game dialog answers through the game's own Confirm / Cancel actions and the real cursor: the maker's input lock
  // and hidden cursor come off while it is up (with them on, renaming locked the game for a tester, 2026-10-18).
  async function gameDialog(open) {
    var U = require("Core/Util").U, LF = cs.NOAH.Input.LockFlag.SpecialLogic;
    W.canvas.enabled = false; W.dialog = true;
    try { U.SetAllActionLock(false, LF); } catch (e) {}
    try { UE.Cursor.visible = true; UE.Cursor.lockState = UE.CursorLockMode.None; } catch (e) {}
    try { return await open(); }
    finally {
      W.dialog = false;
      if (W.isOpen && W.canvas) {
        W.canvas.enabled = true; W.arming = true; W.holdBlock = true;
        try { U.SetAllActionLock(true, LF); } catch (e) {}
        try { if (W.mode == "stick") UE.Cursor.visible = false; } catch (e) {}
      }
    }
  }
  function ask(title, now, tips, limit) {
    var UIU = require("Core/UIUtil").default, Win = require("Window/Dialog/UniversalTextInput").default;
    return gameDialog(async function () {
      try { var w = await UIU.AcquireWindowAsync(Win); w.Init(title, now || "", tips || ""); w.SetInputLimit(limit || 24); var r = await w.CloseAsync(); return r == null ? null : String(r).trim(); }
      catch (e) { log("text input: " + e); return null; }
    });
  }
  function yesNo(text) {
    var WU = require("Core/WindowUtil").default;
    return gameDialog(async function () { try { return await WU.ShowDialogYesNoAsync(text, null, null, "Colour maker"); } catch (e) { log("yes / no: " + e); return false; } });
  }
  function rowOf(code) { var k = W.cur ? W.cur.map(function (x) { return x.code; }).indexOf(code) - W.page * ROWS : -1; return k >= 0 && k < ROWS ? W.rows[k] : null; }
  W.rename = async function () { if (!W.pal) return; var n = await ask("Name this palette", W.pal.name, "Up to 24 letters, numbers and spaces"); if (n) { W.pal.name = String(n).replace(/[^A-Za-z0-9 _\-]/g, "").slice(0, 24) || W.pal.name; W.changed = true; W.refresh(); } };
  // SAVE also wears: with SAVE alone, leaving put the old palette back and testers read it as "not saved" (Geokit, 10-22)
  W.save = function () {
    var a = me(); if (!W.pal) return; var c = M.save(W.pal);
    if (!c) { status("Could not save; see PaletteMaker.log.", true); return; }
    W.loadedCode = c; W.changed = false; W.tab = "mine";
    var ok = false; if (a && W.pal.hero == a.BaseID) { M.setWorn(a.BaseID, c); W.worn = c; ok = M.preview(a, M.decode(c)); }
    W.list(); status(ok ? "Saved " + W.pal.name + ", and it is worn." : "Saved " + W.pal.name + ".");
    var r = rowOf(c); if (r) burstAt(r, "Save");
    return c;
  };
  W.wear = function () {
    var a = me(); if (!W.pal || !a) return;
    var c = M.save(W.pal); if (!c) { status("Could not save, so not worn.", true); return; }
    M.setWorn(a.BaseID, c); W.loadedCode = c; W.changed = false; W.worn = c;
    var ok = M.preview(a, M.decode(c)); W.list();
    status(ok ? W.pal.name + " is worn: in the lobby, in runs and online." : "It could not be put on: the base palette stays.", !ok);
    if (ok) fire("Wear");
  };
  W.base = function () { var a = me(); if (!a) return; M.setWorn(a.BaseID, ""); W.worn = ""; M.unwear(a); W.list(); status("Base palette back on."); };
  W.copy = function () { if (!W.pal) return; var c = M.encode(W.pal); M.toClipboard(c); status("The code is copied: paste it anywhere to share " + W.pal.name + "."); };
  W.exportFile = function () { if (!W.pal) return; var f = M.exportFile(W.pal); status(f ? "Exported to " + f : "Could not export.", !f); };
  W.del = async function () {
    var a = me(); if (!W.pal || !a || !W.loadedCode || W.tab != "mine") { status("Pick one of your saved palettes to delete it.", true); return; }
    if (!await yesNo("Delete " + W.pal.name + "? This cannot be undone.")) return;
    if (M.wornCode(a.BaseID) == W.loadedCode) W.base();
    M.remove(a.BaseID, W.pal.name); W.loadedCode = null; W.fresh(); W.list(); status("Deleted.");
  };
  function accept(p, from) {
    var a = me(); if (!p) return false;
    if (!a || p.hero != a.BaseID) { status(p.name + " is for another hero (" + p.hero + "): it is kept in your files, stand as that hero to use it.", true); return false; }
    var sk = parseInt(String(a.ActorModel.Renderer.Skin)) || 0;
    if (p.skin != sk) { status(p.name + " is made on palette " + p.skin + ". Put that palette on first.", true); return false; }
    W.load(editable(p), null); W.changed = true; status(p.name + " " + from + ". Press SAVE to keep it."); return true;
  }
  W.paste = async function () {
    var p = M.decode(M.fromClipboard());
    if (!p) { var s = await ask("Paste a palette code", "", "A code starts with BBP1-", 700); p = s ? M.decode(s) : null; }
    if (!p) { status("That is not a palette code.", true); return; }
    accept(p, "pasted");
  };
  W.importFiles = function () {
    var ps = M.importFiles(), n = 0;
    ps.forEach(function (p) { M.save(p); n++; });
    W.tab = "mine"; W.list(true);
    status(n ? n + " palette file(s) imported from " + M.dir() + "/import" : "No .bbpal files in " + M.dir() + "/import", !n);
  };
  W.keepSeen = function () { if (!W.pal || W.tab != "seen") { status("Pick a palette seen online first.", true); return; } W.save(); };

  // ------------------------------------------------------------------ the hero choice
  // the heroes the player owns (DLC heroes only when bought), named as the hero list names them
  function heroTexture(id) {
    var path = PORTRAIT[String(id)] || "UI/Texture/HeroPortraitFull/HeroPortraitFull_" + id;
    if (!PORTRAIT[String(id)]) try { var A = require("Example").ModRegistry.textureAlias; if (A && A[path]) path = A[path]; } catch (e) {}
    try { var t = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Texture2D), path); if (!isNull(t)) return t; } catch (e) {}
    return null;
  }
  W.heroList = function (anim) {
    var AU = require("Core/ActorUtil").default, ids = [];
    try { ids = AU.GetUnlockActor().filter(function (id) { try { return !SPINE[String(id)] && !AU.IsDlcLock(id); } catch (e) { return false; } }); } catch (e) { log("heroes: " + e); }
    var pages = Math.max(1, Math.ceil(ids.length / CARDS)); W.hPage = Math.min(W.hPage || 0, pages - 1); W.heroIds = ids;
    W.cards.forEach(function (e, k) {
      var id = ids[W.hPage * CARDS + k]; show(e, !!id); e.id = id; if (!id) return;
      var hc = HERO_COLOUR[String(id)] || GOLD, pale = [hc[0] + (1 - hc[0]) * 0.55, hc[1] + (1 - hc[1]) * 0.55, hc[2] + (1 - hc[2]) * 0.55];
      tint(e.fill, hc, 0.9); tint(e.fg, hc); tint(e.hg, pale); tint(e.flash, pale);
      e.name.text = heroName(id).toUpperCase();
      var n = M.mine(id).length; if (e.count.activeSelf != n > 0) e.count.SetActive(n > 0); e.countT.text = String(n);
      var tex = heroTexture(id); e.art.texture = tex; e.art.color = C(1, 1, 1, tex ? 1 : 0);
      // the full portrait, the head near the card's top: these portraits are square with the figure's head at about a fifth down
      var f = FRAME[String(id)] || [0, 0, 1], h = 340 * 1.9 * f[2], w = tex ? h * tex.width / tex.height : h;
      e.artRt.pivot = new V2(0.5, 0.82); e.artRt.sizeDelta = new V2(w, h); e.artRt.anchoredPosition = new V2(150 + f[0], 300 + f[1]);
    });
    W.hPageT.text = pages > 1 ? "PAGE " + (W.hPage + 1) + " / " + pages : "A NUMBER: PALETTES SAVED";
    show(W.hPrev, W.hPage > 0); show(W.hNext, W.hPage < pages - 1);
    // the cards rise in one after another: each is switched on (its animator then plays its intro) two frames after the last
    var n = 0, t = now();
    W.cards.forEach(function (e) { e.showAt = 0; e.hov = false; if (!e.id) return; e.go.SetActive(false); e.showAt = t + (6 + 2 * n++) / 60; });
    try { W.hz.Find("Cards").GetComponent(T(UE.CanvasGroup)).alpha = 1; rtOf(W.hz, "Cards").anchoredPosition = new V2(0, 0); } catch (er) {}
  };
  function stagger(t) { W.cards.forEach(function (e) { if (e.showAt && t >= e.showAt) { e.showAt = 0; e.go.SetActive(true); } }); }
  W.chooseHero = function (k) {
    var e = W.cards[k]; if (!e || !e.id || W.leaving) return;
    W.leaving = true;
    try { e.an.SetTrigger("Pick"); W.anH.SetLayerWeight(1, 1); W.anH.SetTrigger("Exit"); } catch (er) {}
    tween(0.34, function (u) { if (u >= 1) { W.leaving = false; W.pickHero(k); } });
  };
  W.pickHero = function (k) {
    var id = W.heroIds && W.heroIds[(W.hPage || 0) * CARDS + k]; if (!id) return;
    var AU = require("Core/ActorUtil").default, fes = null;
    try { fes = AU.GenFesActorFromSeed(id); } catch (e) { log("hero " + id + ": " + e); }
    if (!fes) { log("hero " + id + " cannot be tried out from here"); return; }
    W.close(true);
    var from = null; try { from = require("GamePlay/Battle/BattleJs").default.Instance.Battle; } catch (e) {}
    M.pendingOpen = { hero: id, until: Date.now() + 60000, from: from };
    // 99 is the test room's return type: Try Out's quit falls through to the lobby
    try { require("GamePlay/BattleTryout/BattleTryoutRun").default.Start(fes, 99); log("to Try Out with hero " + id); }
    catch (e) { M.pendingOpen = null; log("Try Out: " + (e && e.stack || e)); }
  };

  // ------------------------------------------------------------------ open, close, the frame tick
  W.open = function () {
    try {
      if (W.isOpen) return;
      var a = me(); if (!a) { log("no hero"); return; }
      if (!W.root || isNull(W.root)) W.build();
      W.closeAt = 0; W.leaving = false; W.fxUntil = 0; W.openedAt = now();
      W.picking = !M.paintable(a);
      if (W.picking && W.hzUsed) rebuildHeroes();
      W.mk.gameObject.SetActive(!W.picking); W.hz.gameObject.SetActive(W.picking);
      W.root.SetActive(true); W.canvas.enabled = true; W.isOpen = true;
      [W.anM, W.anH].forEach(function (an) { try { if (an.isActiveAndEnabled) an.SetLayerWeight(1, 0); } catch (e) {} });
      W.arming = true; W.held = {}; W.kh = {}; W.downAt = null; W.stillFrom = 0; W.adjust = null; W.pad = false; W.focus = null; W.msg = null;
      [W.mFocus, W.hFocus].forEach(function (f) { if (f) setA(f.img, 0); });   // the A that opened it is not a press here
      try { require("Core/Util").U.SetAllActionLock(true, cs.NOAH.Input.LockFlag.SpecialLogic); } catch (e) { log("input lock: " + e); }
      W.cursor = [UE.Cursor.visible, UE.Cursor.lockState]; UE.Cursor.visible = true; UE.Cursor.lockState = UE.CursorLockMode.None;
      // opened with a controller: its cursor shows at once, in the middle; the mouse takes over when it moves
      W.mode = null; W.mouseWas = true; W.downOn = null; if (joyActive()) { W.mode = "stick"; W.vc = [UE.Screen.width / 2, UE.Screen.height / 2]; UE.Cursor.visible = false; }
      if (W.picking) { W.hidden = false; W.pal = null; W.hPage = 0; W.heroList(); log("hero choice opened"); return; }
      M.editing = true; M.hideHud(true);
      if (W.studio()) { recentre(a); if (ZM.ryId === undefined) findRightY(); W.zoomTo(ZM.last != null ? ZM.last : ZM.def); }
      label(W.bClose, W.studio() ? (W.mode == "stick" ? "HOLD B TO LEAVE" : "LEAVE") : "CLOSE");
      viewLabels();
      if (W.hidden && W.pal && W.pal.hero == a.BaseID) {     // back from trying moves: the palette as it was left
        W.hidden = false; W.list(); W.refresh(); status(keysHint(false)); log("back for hero " + a.BaseID); return;
      }
      W.hidden = false;
      W.worn = M.wornCode(a.BaseID);
      var p = M.decode(W.worn), sk = parseInt(String(a.ActorModel.Renderer.Skin)) || 0;
      if (p && p.hero == a.BaseID && p.skin == sk) W.load(editable(p), W.worn); else W.fresh();
      W.tab = "mine"; W.list();
      status(W.studio() ? keysHint(false) : "Pick a part on the right, then its colours. SAVE keeps it and puts it on.");
      log("opened for hero " + a.BaseID);
    } catch (e) { log("open: " + (e && e.stack || e)); W.close(true); }
  };
  // The hero back on the spot it arrived on, and the camera put on it at once (CameraDirector's chase
  // camera leaves the hero up to XDiffStartMove off centre, and a wall clamps it further), so the hero stands between the
  // boards every time the maker opens: after mashing left and right while it loaded, and after trying moves.
  function recentre(a) {
    var sp = M.studio && M.studio.spot; if (!sp) return;
    try {
      var p = a.Position, d = Math.abs(p.x - sp[0]) + Math.abs(p.y - sp[1]);
      if (d > 0.05) { a.Position = new V2(sp[0], sp[1]); log("hero back on its spot (" + Math.round(d * 100) / 100 + " m away)"); }
    } catch (e) { log("back on the spot: " + e); }
    try { var c = camDir(); if (c && !isNull(c)) c.TeleportToTarget(); } catch (e) { log("camera: " + e); }
  }
  // the Try Out visit the maker started, with the maker over it
  W.studio = function () { return !!M.studio && !W.picking; };
  function keysHint(leaving) {
    var pad = W.mode == "stick" || joyActive(), start = pad ? "Start" : "Esc", b = pad ? "B" : "Backspace";
    return leaving ? "Hold " + b + " or click LEAVE to leave the Colour Maker. " + start + " or TRY MOVES hides the maker so you can try your moves."
      : pad ? "Point at the hero and press A to pick its part. Start: try moves. Right stick: zoom. Hold B: leave."
      : "Click the hero to pick its part. Esc: try moves. F: sit still. L: backdrop. H: type a colour. Wheel: zoom. LEAVE or hold Backspace: leave.";
  }
  // Start (Esc) or TRY MOVES in the dressing room: hide the maker to try moves in the palette being made, and bring it
  // back. One press can reach here twice (read by the window and by Try Out's pause hook): 0.35 s apart counts once.
  W.studioToggle = function () {
    if (W.dialog || (W.isOpen && W.picking)) return;    // a name or yes / no box is answered first
    if (!W.isOpen && !W.hidden && !M.studio) return;
    var t = now(); if (t - (W.toggledAt || 0) < 0.35) return; W.toggledAt = t;
    if (W.isOpen) { if (W.studio()) W.close(false, true); } else W.open();
  };
  // Try Out is over (left, or quit from anywhere): the maker goes, the worn palette comes back
  W.leftStudio = function () { if (W.isOpen) W.close(true); W.hidden = false; M.editing = false; W.holdT = 0; unfreeze(); lightOn(false); };
  W.leave = async function () {
    if (W.changed && W.pal && await yesNo("Save " + W.pal.name + " and wear it before you leave?")) W.save();
    W.close(true); W.hidden = false; M.editing = false; M.leaveStudio();
  };
  // quick: no closing animation (going to Try Out, or a failed open). keep: hidden to try moves; the edit stays on the hero
  W.close = function (quick, keep) {
    if (!W.isOpen) return;
    W.isOpen = false; M.editing = !!keep; M.hideHud(false); W.holdT = 0;
    unfreeze();      // at once: leaving Try Out quits right after this, and a paused battle would hold the quit
    if (ZM.keep) { ZM.last = ZM.lv; W.zoomOff(); }
    try { require("Core/Util").U.SetAllActionLock(false, cs.NOAH.Input.LockFlag.SpecialLogic); } catch (e) {}
    try { if (W.cursor) { UE.Cursor.visible = W.cursor[0]; UE.Cursor.lockState = W.cursor[1]; } } catch (e) {}
    if (quick === true || !W.root || isNull(W.root)) { try { if (W.root && !isNull(W.root)) W.root.SetActive(false); } catch (e) {} }
    else { try { if (W.picking) { W.anH.SetLayerWeight(1, 1); W.anH.SetTrigger("Exit"); } else { W.anM.SetLayerWeight(1, 1); W.anM.SetTrigger("Close"); } } catch (e) {} W.closeAt = now() + (W.picking ? 0.34 : 0.2); }
    if (W.picking) { W.picking = false; W.hzUsed = true; log("closed"); return; }
    if (keep) { W.hidden = true; log("hidden: Start brings it back"); return; }
    // what was being edited and not worn comes off: the worn palette (or the base) goes back on
    var a = me(); if (a) { var wp = M.decode(M.wornCode(a.BaseID)); if (wp) M.preview(a, wp); else M.unwear(a); }
    log("closed");
  };
  function inRect(go, pos) { return UE.RectTransformUtility.RectangleContainsScreenPoint(go.GetComponent(T(UE.RectTransform)), pos, null); }
  function local(go, pos) { var r = go.GetComponent(T(UE.RectTransform)), ref = PT.$ref(new V2(0, 0)); UE.RectTransformUtility.ScreenPointToLocalPointInRectangle(r, pos, null, ref); return PT.$unref(ref); }
  // ------------------------------------------------------------------ keyboard and controller
  // The script timer does not run every frame, so a one-frame "pressed" flag can be missed (four-player's lobby screen
  // lost two presses in three to it): a press is "held now, not held at the last check". Rewired ids (four-player's
  // probe): Confirm 9, Cancel 10, TabLeft 16, TabRight 17, MoveX/Y 0/1, NavigateX/Y 34/35.
  var KEYS = { confirm: ["Return", "KeypadEnter", "J"], cancel: ["Escape", "Backspace", "K"], tabL: ["Q"], tabR: ["E"] }, BTN = { confirm: 9, cancel: 10, tabL: 16, tabR: 17 };
  function rwp() { try { return cs.Rewired.ReInput.players.GetPlayer(0); } catch (e) { return null; } }
  function held(p, a) {
    try { if (p && p.GetButton(BTN[a])) return true; } catch (e) {}
    var I = UE.Input, K = UE.KeyCode, ks = KEYS[a] || [];
    if (a == "cancel" && M.studio) ks = ks.filter(function (k) { return k != "Escape"; });   // Esc is Start there
    return ks.some(function (k) { try { return I.GetKey(K[k]); } catch (e) { return false; } });
  }
  W.held = {};
  function pressed(p, a) { var h = held(p, a), was = W.held[a]; W.held[a] = h; return h && !was && !W.arming; }
  function keyHit(k) { var h = false; try { h = UE.Input.GetKey(UE.KeyCode[k]); } catch (e) {} W.kh = W.kh || {}; var was = W.kh[k]; W.kh[k] = h; return h && !was && !W.arming; }
  function axis(p, id) { try { return p.GetAxis(id); } catch (e) { return 0; } }
  function dirNow(p) {
    var I = UE.Input, K = UE.KeyCode, x = axis(p, 34) || axis(p, 0), y = axis(p, 35) || axis(p, 1);
    try { if (I.GetKey(K.LeftArrow) || I.GetKey(K.A)) x = -1; if (I.GetKey(K.RightArrow) || I.GetKey(K.D)) x = 1; if (I.GetKey(K.UpArrow) || I.GetKey(K.W)) y = 1; if (I.GetKey(K.DownArrow) || I.GetKey(K.S)) y = -1; } catch (e) {}
    return [Math.abs(x) > 0.5 ? Math.sign(x) : 0, Math.abs(y) > 0.5 ? Math.sign(y) : 0];
  }
  var nav = { d: "", t: 0 };
  function steer(d) {        // a held direction repeats after 0.3 s, then every 0.07 s
    var key = d.join(","), t = now();
    if (!d[0] && !d[1]) { nav.d = ""; return false; }
    if (key != nav.d) { nav.d = key; nav.t = t + 0.3; return true; }
    if (t >= nav.t) { nav.t = t + 0.07; return true; }
    return false;
  }
  // centre and half size on screen
  function centre(go) { var r = go.GetComponent(T(UE.RectTransform)), p = r.position, w = r.rect.width * r.lossyScale.x, h = r.rect.height * r.lossyScale.y; return [p.x + (0.5 - r.pivot.x) * w, p.y + (0.5 - r.pivot.y) * h, w / 2, h / 2]; }
  function live(e) { return e.go && !isNull(e.go) && e.go.activeInHierarchy; }
  function focusables() {
    var out = W.hov.filter(live);
    if (!W.picking && hasTarget()) { out.push(W.svF); out.push(W.hueF); }
    return out;
  }
  function showFocus(e) { W.focus = e; }
  function move(d) {
    var list = focusables(); if (!list.length) return;
    if (!W.focus || list.indexOf(W.focus) < 0) { showFocus(list[0]); return; }
    // the nearest box in that direction, measured to its edges (a wide row is straight below everything above it);
    // boxes inside a 45 degree cone first
    var c = centre(W.focus.go), best = null, bs = 1e9, cone = false;
    list.forEach(function (e) {
      if (e === W.focus) return; var q = centre(e.go), dx = q[0] - c[0], dy = q[1] - c[1];
      var along = d[0] ? dx * d[0] - q[2] - c[2] : dy * d[1] - q[3] - c[3];
      if ((d[0] ? dx * d[0] : dy * d[1]) <= 4 || along < -4) return;
      along = Math.max(0, along);
      var side = d[0] ? Math.max(0, Math.abs(dy) - q[3] - c[3]) : Math.max(0, Math.abs(dx) - q[2] - c[2]), inCone = side <= along + 4;
      var s = along + side * 2.2;
      if ((inCone && !cone) || (inCone == cone && s < bs)) { bs = s; best = e; cone = inCone; }
    });
    if (best) showFocus(best);
  }
  // the controller's cursor: the left stick moves a reticle over both screens; A clicks or drags under it like the mouse
  function joyActive() { try { return cs.Rewired.ReInput.controllers.GetLastActiveControllerType() == cs.Rewired.ControllerType.Joystick; } catch (e) { return false; } }
  function stickTick(p, dt) {
    if (!joyActive()) return;
    var sx = axis(p, 0), sy = axis(p, 1), m = Math.sqrt(sx * sx + sy * sy); if (m < 0.2) return;
    var sw = UE.Screen.width, sh = UE.Screen.height;
    if (W.mode != "stick") { W.mode = "stick"; W.pad = false; if (!W.vc) W.vc = [sw / 2, sh / 2]; try { UE.Cursor.visible = false; } catch (e) {} }
    var v = sh * (0.35 + 1.25 * m * m) * dt / m;         // slow near the centre for fine work, fast at the rim
    W.vc = [Math.max(0, Math.min(sw, W.vc[0] + sx * v)), Math.max(0, Math.min(sh, W.vc[1] + sy * v))];
  }
  function cursorTick(over, dt) {
    var c = W.vcur; if (!c) return;
    var on = W.mode == "stick" && W.isOpen; if (c.go.activeSelf != on) c.go.SetActive(on); if (!on) return;
    c.rt.position = new V3(W.vc[0], W.vc[1], 0);
    var k = follow(dt, 16); c.s += ((over ? 1.25 : 1) - c.s) * k; c.rt.localScale = new V3(c.s, c.s, 1);
    tint(c.img, over ? [1, 0.93, 0.78] : GOLD, 1);
  }
  function padInput() {
    var p = rwp(), stick = W.mode == "stick" && joyActive(), d = stick ? [0, 0] : dirNow(p), go = steer(d);
    var conf = pressed(p, "confirm"), canc = pressed(p, "cancel"), tl = pressed(p, "tabL"), tr = pressed(p, "tabR");
    var kF = keyHit("F"), kL = keyHit("L"), kH = keyHit("H");
    W.arming = false;
    if (!W.picking && !W.adjust) { if (kF) W.toggleStill(); if (kL) W.cycleLight(); if (kH) { W.typeHex(); return; } }
    if (W.adjust) {                                  // the colour square or hue bar is being moved with the stick
      if (conf || canc) { W.adjust = null; status("Colour set."); W.pulse(); return; }
      if (go && W.pal) {
        var h = W.hsv, k = 0.02;
        if (W.adjust == "sv") { h[1] = Math.max(0, Math.min(1, h[1] + d[0] * k)); h[2] = Math.max(0, Math.min(1, h[2] + d[1] * k)); }
        else h[0] = (h[0] + (d[1] || d[0]) * 0.01 + 1) % 1;
        setStop(hsvToRgb(h[0], h[1], h[2])); W.refresh();
      }
      return;
    }
    if (canc) { if (W.studio()) status(keysHint(true)); else { W.close(); return; } }
    if (W.picking) { if (tl && W.hPage > 0) { W.hPage--; W.heroList(true); } if (tr) { W.hPage++; W.heroList(true); } }
    else { if (tl) W.setTab("mine"); if (tr) W.setTab("seen"); }
    if (go) { W.pad = true; W.mode = "keys"; move(d); }
    if (conf && W.focus && W.mode == "keys") {
      if (W.focus === W.svF || W.focus === W.hueF) { W.adjust = W.focus === W.svF ? "sv" : "hue"; status("Move the stick to change the colour; A to finish."); }
      else press(W.focus);
    }
  }
  function press(e) { try { e.act(); } catch (er) { log("press: " + (er && er.stack || er)); } }
  W.move = move;    // scripted tests drive the focus with it
  W.press = press;
  W.setColour = function (c) { if (!hasTarget()) return; W.hsv = rgbToHsv(c); setStop(c); W.refresh(); };

  // ------------------------------------------------------------------ the live parts: hover light, focus frame, tweens
  function follow(dt, rate) { return 1 - Math.exp(-dt * rate); }
  function hoverTick(e, hot, dt) {
    if (e.o.card) {                                 // a hero card: its own animator lifts it and lights its frame
      if (hot != !!e.hov) { e.hov = hot; try { e.an.SetTrigger(hot ? "Hover" : "Unhover"); } catch (er) {} }
      return;
    }
    var k = follow(dt, 18); e.glow += ((hot ? 1 : 0) - e.glow) * k;
    if (e.glowI) setA(e.glowI, e.glow * 0.9);
    else if (e.selfI || e.o.grow) { var s = 1 + ((e.o.grow || 1.12) - 1) * e.glow; e.tr.localScale = new V3(s, s, 1); }
    if (hot && !e.wasHot && e.sweep) {           // a row: a light runs across it
      var sw = e.sweep, si = e.sweepI;
      tween(0.24, function (u) { sw.anchoredPosition = new V2(-120 + 720 * ease(u), 31); setA(si, 0.55 * Math.sin(Math.PI * u)); });
    }
    e.wasHot = hot;
  }
  function focusTick(dt) {
    var f = W.picking ? W.hFocus : W.mFocus; if (!f) return;
    var want = W.pad && W.focus && live(W.focus), a = f.img.color.a;
    if (!want) { if (a > 0.001) setA(f.img, a * (1 - follow(dt, 20))); return; }
    var c = centre(W.focus.go), s = W.root.transform.lossyScale.x || 1, k = a < 0.05 ? 1 : follow(dt, 22);
    var p = f.rt.position, sd = f.rt.sizeDelta, w = c[2] * 2 / s + 20, h = c[3] * 2 / s + 20;
    f.rt.position = new V3(p.x + (c[0] - p.x) * k, p.y + (c[1] - p.y) * k, 0);
    f.rt.sizeDelta = new V2(sd.x + (w - sd.x) * k, sd.y + (h - sd.y) * k);
    // a slow breath on the frame so it reads as lit, not drawn
    setA(f.img, Math.min(1, a + follow(dt, 20)) * (0.82 + 0.18 * Math.sin(now() * 5)));
  }
  // leaving Try Out: B (Backspace) held, or the leave button held down, for HOLD_S; the button fills as it is held
  var HOLD_S = 0.8;
  function holdTick(t, down, over) {
    var b = W.bClose; if (!b || !W.studio() || W.adjust) { W.holdT = 0; return false; }
    var on = held(rwp(), "cancel") || (down && W.downOn === b && over === b);
    if (W.holdBlock) { if (!on) W.holdBlock = false; return false; }      // after an answer: let go first
    if (!on) { if (W.holdT) { W.holdT = 0; b.tr.localScale = new V3(1, 1, 1); } return false; }
    if (!W.holdT) W.holdT = t;
    var u = Math.min(1, (t - W.holdT) / HOLD_S);
    b.glow = Math.max(b.glow, u); if (b.glowI) setA(b.glowI, 0.25 + 0.75 * u);
    var s = 1 + 0.06 * ease(u); b.tr.localScale = new V3(s, s, 1);
    if (u >= 1) { W.holdT = 0; W.downOn = null; W.holdBlock = true; b.tr.localScale = new V3(1, 1, 1); W.leave(); return true; }
    return false;
  }
  function runTweens() {
    var t = now();
    W.tw = W.tw.filter(function (w) { var u = Math.min(1, (t - w.t0) / w.d); try { w.f(u); } catch (e) { return false; } return u < 1; });
  }
  W.tick = function () {
    try { var TM = UE.Time; UE.Shader.SetGlobalFloat("_PalTimeOffset", TM.unscaledTime - TM.timeSinceLevelLoad); } catch (e) {}
    var t = now(), dt = Math.min(0.1, Math.max(0, t - (W.lastT || t))); W.lastT = t;
    if (W.fxUntil && t >= W.fxUntil && W.isOpen) { W.fxUntil = 0; try { W.anM.SetLayerWeight(1, 0); } catch (e) {} }
    if (W.closeAt && t >= W.closeAt) { W.closeAt = 0; W.tw = []; try { if (!W.isOpen && W.root && !isNull(W.root)) W.root.SetActive(false); } catch (e) {} }
    try { startTick(); } catch (e) { if (!W.e5) { W.e5 = 1; log("start key: " + (e && e.stack || e)); } }
    try { viewTick(t); } catch (e) { if (!W.e6) { W.e6 = 1; log("view: " + (e && e.stack || e)); } }
    if (!W.root || isNull(W.root) || !W.root.activeSelf) return;
    runTweens();
    if (!W.isOpen) return;
    if ((W.hudN = (W.hudN || 0) + 1) % 20 == 1) M.hideHud(true);   // rooms show their HUD again on entry
    if (W.picking) stagger(t);
    var I = UE.Input, pos = new V2(I.mousePosition.x, I.mousePosition.y);
    if (!W.canvas.enabled) { W.arming = true; return; }       // a game dialog is up (text input, yes / no)
    if (!W.svF) { W.svF = { go: W.sv }; W.hueF = { go: W.hue }; }
    if (W.lastMouse && (Math.abs(W.lastMouse.x - pos.x) > 2 || Math.abs(W.lastMouse.y - pos.y) > 2) && !W.adjust && W.testDown == null) {   // the mouse takes over
      W.pad = false; if (W.mode == "stick") { try { UE.Cursor.visible = true; } catch (e) {} } W.mode = "mouse";
    }
    W.lastMouse = pos;
    stickTick(rwp(), dt);
    padInput(); if (!W.isOpen) return;
    zoomInput(dt);
    var stick = W.mode == "stick", down = W.testDown != null ? W.testDown : stick ? held(rwp(), "confirm") : I.GetMouseButton(0);   // testDown: scripted tests
    if (stick) pos = new V2(W.vc[0], W.vc[1]);
    var over = null;
    W.hov.forEach(function (e) {
      if (!live(e)) { if (e.glow) { e.glow = 0; if (e.glowI) setA(e.glowI, 0); } return; }
      var h = W.pad ? W.focus === e : !W.leaving && inRect(e.go, pos); if (h && !W.pad) over = e;
      hoverTick(e, h, dt);
    });
    if (holdTick(t, down, over)) return;
    focusTick(dt);
    cursorTick(over || (!W.picking && (inRect(W.sv, pos) || inRect(W.hue, pos))), dt);
    if (down && !W.mouseWas) {
      W.drag = !W.picking && inRect(W.sv, pos) ? "sv" : !W.picking && inRect(W.hue, pos) ? "hue" : null; W.downOn = W.drag ? null : over;
      // pressed on open stage (no button, no board): a click on the hero picks the part under it
      W.downAt = !W.drag && !over && !W.picking && !(W.boards || []).some(function (g) { return inRect(g, pos); }) ? [pos.x, pos.y] : null;
    }
    if (!down && W.mouseWas) {
      if (W.downOn && W.downOn === over) press(over);
      else if (W.downAt && !over && Math.abs(pos.x - W.downAt[0]) + Math.abs(pos.y - W.downAt[1]) < 16) W.pickOnHero(pos.x, pos.y);
      W.downOn = null; W.downAt = null; if (W.drag) W.pulse();
    }
    W.mouseWas = down;
    if (!down) W.drag = null;
    if (W.drag && hasTarget()) {
      var l = local(W.drag == "sv" ? W.sv : W.hue, pos), h = W.hsv;
      if (W.drag == "sv") { h[1] = Math.max(0, Math.min(1, l.x / 300)); h[2] = Math.max(0, Math.min(1, l.y / 250)); }
      else h[0] = Math.max(0, Math.min(0.999, l.y / 250));
      setStop(hsvToRgb(h[0], h[1], h[2])); W.refresh();
    }
    var ms = Date.now();
    if (W.dirty && ms - (W.paintAt || 0) > 60) {
      W.dirty = false; W.paintAt = ms; var a = me();
      if (a && W.pal) { var c = M.decode(M.encode(W.pal)); if (c && !M.preview(a, c)) status("This palette could not be painted: the base palette stays.", true); }
    }
  };
  // ------------------------------------------------------------------ Start, the view, sitting still, typed colours (0.2.6)
  // Start (Esc) while the maker is up: the maker's input lock (SetAllActionLock) holds the game's Pause action as well,
  // so Try Out's pause handler (palcore hookPause) never heard it and Start did nothing in the maker (testers 10-19,
  // 11-07). The window reads it itself, open or hidden; the hook still answers it while the maker is hidden, and
  // studioToggle counts the two as one press.
  function findStart() {
    W.startId = -1;
    try {
      var acts = cs.Rewired.ReInput.mapping.Actions, names = [];
      for (var i = 0; i < acts.Count; i++) {
        var a = acts.get_Item(i), n = String(a.name); names.push(a.id + " " + n);
        if (W.startId < 0 && /^(Pause|Menu|Start|PauseMenu|OpenMenu|Option|Options|Esc|Escape)$/i.test(n)) { W.startId = a.id; log("Start is the game's action " + n + " (" + a.id + ")"); }
      }
      if (W.startId < 0) log("no Pause action found; Esc only. Actions: " + names.join(", "));
    } catch (e) { log("start action: " + e); }
  }
  function startHeld() {
    try { if (UE.Input.GetKey(UE.KeyCode.Escape)) return true; } catch (e) {}
    if (W.startId === undefined) findStart();
    var p = rwp(); try { if (p && W.startId >= 0 && p.GetButton(W.startId)) return true; } catch (e) {}
    return false;
  }
  function startTick() {
    var h = !!M.studio && !W.dialog && !W.picking && (W.isOpen || W.hidden) && startHeld(), was = W.startWas; W.startWas = h;
    if (h && !was) W.studioToggle();
  }

  // The view (testers 11-07: too dark to judge colours). The test room plays a dim movie behind the hero, lights it with
  // ACELights in the hero's own colour, and the maker lays its vignette over the stage. In the dressing room the maker
  // puts a flat grey sheet behind the hero (over the room, under the hero and its effects), turns the room's lights
  // neutral white at their own strength and drops its vignette. STAGE gives the room back as the game draws it.
  var VIEWS = [{ n: "GREY", bg: 0.5 }, { n: "LIGHT", bg: 0.78 }, { n: "DARK", bg: 0.2 }, { n: "STAGE", bg: null }];
  var UV = M.uiView = M.uiView || { light: 0, still: false };
  function battleJs() { try { return require("GamePlay/Battle/BattleJs").default.Instance; } catch (e) { return null; } }
  function viewLabels() {
    if (!W.bLight) return;
    var on = W.studio(); W.viewBtns.forEach(function (e) { show(e, on); });
    label(W.bLight, "VIEW: " + VIEWS[UV.light].n); setOn(W.bLight, false);
    label(W.bStill, UV.still ? "SITTING STILL" : "SIT STILL"); setOn(W.bStill, UV.still);
  }
  W.cycleLight = function () {
    if (!W.studio()) return;
    UV.light = (UV.light + 1) % VIEWS.length; viewLabels();
    var v = VIEWS[UV.light]; status(v.bg == null ? "View: the room as the game draws it." : "View: " + v.n.toLowerCase() + " backdrop, neutral light. L or VIEW changes it.");
  };
  W.toggleStill = function () {
    if (!W.studio()) return;
    UV.still = !UV.still; viewLabels();
    status(UV.still ? "Sitting still: the hero holds its idle pose while you colour. F or SIT STILL lets go." : "The hero moves again.");
  };
  function neutral(c) { var m = Math.max(c.r, c.g, c.b); return new UE.Color(m, m, m, c.a); }
  function whiteSprite() {
    if (W.wspr && !isNull(W.wspr)) return W.wspr;
    var tx = new UE.Texture2D(8, 8, UE.TextureFormat.RGBA32, false);
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) tx.SetPixel(x, y, C(1, 1, 1, 1));
    tx.Apply();
    return (W.wspr = UE.Sprite.Create(tx, new UE.Rect(0, 0, 8, 8), new V2(0.5, 0.5), 64, 0, UE.SpriteMeshType.FullRect, new UE.Vector4(0, 0, 0, 0)));
  }
  function lightOn(want) {
    var L = W.lit;
    if (!want) {
      if (!L) return; W.lit = null;
      try { if (L.sheet && !isNull(L.sheet)) UE.Object.Destroy(L.sheet.gameObject); } catch (e) {}
      L.lights.forEach(function (o) { try { if (isNull(o.l)) return; var li = o.l.Light; li.HighlightColor = o.h; li.BrightColor = o.b; li.AmbientColor = o.a; li.VolumeColor = o.v; o.l.UpdateMat(); } catch (e) {} });
      L.movies.forEach(function (r) { try { if (!isNull(r)) r.enabled = true; } catch (e) {} });
      try { if (W.vig && !isNull(W.vig)) W.vig.enabled = true; } catch (e) {}
      log("view: the room's own light back"); return;
    }
    if (L) return;
    var B = battleJs(), a = me(); if (!B || !B.Battle || !a) return;
    L = W.lit = { b: B, lights: [], movies: [], sheet: null };
    try {
      var ls = UE.Object.FindObjectsOfType(T(cs.ACELight));
      for (var i = 0; i < ls.Length; i++) {
        var l = ls.get_Item(i), li = l.Light; if (!li) continue;
        L.lights.push({ l: l, h: li.HighlightColor, b: li.BrightColor, a: li.AmbientColor, v: li.VolumeColor });
        li.HighlightColor = neutral(li.HighlightColor); li.BrightColor = neutral(li.BrightColor); li.AmbientColor = neutral(li.AmbientColor); li.VolumeColor = neutral(li.VolumeColor);
        l.UpdateMat();
      }
    } catch (e) { log("view lights: " + e); }
    try {
      var he = B.Battle.MapMgr.FindMapElementByName("Hero");
      if (he && !isNull(he)) {
        var ms = he.GetComponentsInChildren(T(cs.NOAH.Criware.CriwareMovieAssistScene), false);
        for (var j = 0; j < ms.Length; j++) { var r = ms.get_Item(j).GetComponent(T(UE.Renderer)); if (r && !isNull(r) && r.enabled) { r.enabled = false; L.movies.push(r); } }
      }
    } catch (e) { log("view movie: " + e); }
    try {
      // behind the hero's effects when their layer is under the hero's (MidEffectBack under MidActor), else just under the hero
      var mr = a.ActorModel.Renderer.MeshRenderer, SL = UE.SortingLayer, hv = SL.GetLayerValueFromID(mr.sortingLayerID), bk = SL.GetLayerValueFromName("MidEffectBack");
      var go = new UE.GameObject("PaletteMakerBackdrop"), sr = go.AddComponent(T(UE.SpriteRenderer)); sr.sprite = whiteSprite();
      if (bk > 0 && bk <= hv) { sr.sortingLayerName = "MidEffectBack"; sr.sortingOrder = -32768; } else { sr.sortingLayerID = mr.sortingLayerID; sr.sortingOrder = Math.max(-32768, mr.sortingOrder - 1); }
      go.transform.localScale = new V3(4000, 4000, 1); L.sheet = sr; L.mr = mr;
      log("view: grey backdrop on " + sr.sortingLayerName + " " + sr.sortingOrder + " (hero on " + mr.sortingLayerName + " " + mr.sortingOrder + "), " + L.lights.length + " light(s) neutral, " + L.movies.length + " movie(s) hidden");
    } catch (e) { log("view backdrop: " + e); }
  }
  function viewTick(t) {
    if (W.lit && W.lit.b !== battleJs()) W.lit = null;               // the room is gone, and what was changed with it
    var studio = !!M.studio && !W.picking, v = VIEWS[UV.light] || VIEWS[0];
    lightOn(studio && v.bg != null && (W.isOpen || W.hidden));
    var L = W.lit;
    if (L && L.sheet && !isNull(L.sheet)) {
      var cam = UE.Camera.main;
      if (cam && !isNull(cam)) { var cp = cam.transform.position, hz = L.mr && !isNull(L.mr) ? L.mr.transform.position.z : 0; L.sheet.transform.position = new V3(cp.x, cp.y, hz + 6); }
      L.sheet.color = C(v.bg, v.bg, v.bg, 1);
    }
    try { if (W.vig && !isNull(W.vig)) { var vo = !L; if (W.vig.enabled != vo) W.vig.enabled = vo; } } catch (e) {}
    stillTick(t);
  }

  // Sitting still (testers 11-07: "please sit still for the love of god Ruby"): while the maker is up the battle is
  // paused (BattleJs.PauseBattle, counted, as the dev menu does), from the first frame of the hero's idle loop so the
  // pose is the neutral one; fidgets and landings are waited out (2.5 s at most). Hidden to try moves, it moves.
  function stillTick(t) {
    var B = battleJs(), want = UV.still && W.isOpen && W.studio() && !W.picking;
    if (W.paused && (!want || W.paused !== B)) unfreeze();
    if (!want || W.paused) { W.stillFrom = 0; return; }
    if (!B || !B.Battle || t - (W.openedAt || 0) < 0.3) return;
    var a = me(), v = a && a.ActorModel.Renderer, loop = false; try { loop = !!v.Loop; } catch (e) {}
    if (!W.stillFrom) W.stillFrom = t;
    if (!loop && t - W.stillFrom < 2.5) return;
    try { if (loop) v.SetAnimationTime(0); } catch (e) { log("still pose: " + e); }
    try { B.PauseBattle(true); W.paused = B; log("sitting still" + (loop ? "" : " (not in the idle loop)")); } catch (e) { log("sit still: " + e); UV.still = false; viewLabels(); }
  }
  function unfreeze() {
    var B = W.paused; W.paused = null; if (!B) return;
    try { if (B === battleJs()) B.PauseBattle(false); } catch (e) {}
    log("moving again");
  }

  // a colour typed as a hex code, through the game's own text box (as renaming does: keyboard, and the pad's own entry)
  W.typeHex = async function () {
    if (!hasTarget()) { status("Pick a part first, then type its colour.", true); return; }
    var s = await ask("Type a colour", hexOf(stopColour()), "#RRGGBB, like #C8102E", 7);
    if (s == null || s === "") return;
    var h = String(s).replace(/[^0-9a-fA-F]/g, "");
    if (h.length == 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length != 6) { status("That is not a colour code: six digits 0-9 and A-F, like #C8102E.", true); return; }
    var c = [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    W.setColour(c); W.pulse(); status("Colour set to " + hexOf(c) + ".");
  };
  // a click (or A under the pad's cursor) on the hero: the colour part that paints the pixel under it
  W.pickOnHero = function (x, y) {
    var a = me(); if (!a || !W.pal) return;
    var r = null; try { r = M.partAt(a, W.pal, x, y); } catch (e) { log("pick on the hero: " + (e && e.stack || e)); return; }
    if (!r || r.part < 0) return;           // nothing of the hero there
    W.select(r.part); var c = W.cells[r.part]; if (c && live(c)) burstAt(c, "Pick");
    status("Picked " + W.pal.parts[r.part].name + " from the hero.");
    log("picked part " + r.part + " on the hero (pixel " + hexOf(r.rgb) + ", " + Math.round(r.dist * 1000) / 1000 + " from its centre)");
  };

  // The preview zoom (testers 2026-10-22: the hero is too small to judge colours): CameraDirector's zoom levels, 5% of the
  // view each, found from the current distance scale as EX Hakumen's runtime.js does; the framing is given back on close.
  var ZM = { keep: null, dir: null, lv0: 0, lv: 0, def: 6, extra: 4, slope: null };
  function camDir() { try { return cs.GamePlay.CameraDirector.Cur; } catch (e) { return null; } }
  W.zoomTo = function (lv) {
    var c = camDir(); if (!c || isNull(c)) return;
    try {
      if (!ZM.keep || ZM.dir !== c) {
        var keep = new cs.GamePlay.CameraZLevelParam(); keep.Copy(c.CurZLevel);
        var max = c.MaxZLevel, lv0 = -1;
        for (var i = 0; i <= max && lv0 < 0; i++) { c.SetZLevel(i); if (Math.abs(c.CurZLevel.ZScale - keep.ZScale) < 1e-4) lv0 = i; }
        if (lv0 < 0) { c.CurZLevel.Copy(keep); log("zoom: the framing is no zoom level, left alone"); return; }
        ZM.keep = keep; ZM.dir = c; ZM.lv0 = lv0; ZM.lv = 0;
      }
      // past the camera's last level (ZScale 0.55), up to ZM.extra more steps of the same size, written into the current
      // level's numbers: ZScale down to 0.35 at most, the height (YExtra) following the game's own slope a little steeper
      // so the feet stay above the buttons (testers 10-24 and 11-07: "I wish we could zoom a bit more")
      var top = c.MaxZLevel - ZM.lv0;
      lv = Math.max(0, Math.min(top + ZM.extra, lv | 0));
      ZM.lv = lv; c.SetZLevel(ZM.lv0 + Math.min(lv, top));
      if (lv > top) {
        var z = c.CurZLevel, k = lv - top;
        if (!ZM.slope) { c.SetZLevel(c.MaxZLevel - 1); var a0 = [c.CurZLevel.ZScale, c.CurZLevel.YExtra]; c.SetZLevel(c.MaxZLevel); ZM.slope = [z.ZScale - a0[0], z.YExtra - a0[1]]; z = c.CurZLevel; }
        z.ZScale = Math.max(0.35, z.ZScale + ZM.slope[0] * k); z.YExtra = z.YExtra + ZM.slope[1] * k * 1.15;
      }
    } catch (e) { log("zoom: " + e); }
  };
  W.zoomOff = function () {
    var c = ZM.dir; ZM.dir = null; if (!ZM.keep) return;
    try { if (c && !isNull(c) && c === camDir()) { c.SetZLevel(ZM.lv0); c.CurZLevel.Copy(ZM.keep); } } catch (e) {}
    ZM.keep = null;
  };
  W.zoomLevel = function () { return ZM.keep ? ZM.lv : -1; };
  // wheel, + / - (or PageUp / PageDown), and the right stick up and down
  var ZKEYS = { inn: ["Equals", "KeypadPlus", "PageUp"], out: ["Minus", "KeypadMinus", "PageDown"] };
  function zoomInput(dt) {
    if (!W.studio() || W.dialog || !ZM.keep) return;
    var I = UE.Input, K = UE.KeyCode, d = 0;
    try { var w = I.mouseScrollDelta.y; if (w) d += w > 0 ? 1 : -1; } catch (e) {}
    ["inn", "out"].forEach(function (k) {
      var on = ZKEYS[k].some(function (n) { try { return I.GetKey(K[n]); } catch (e) { return false; } });
      if (on && !ZM["h" + k]) d += k == "inn" ? 1 : -1; ZM["h" + k] = on;
    });
    var p = rwp(), ry = 0; try { if (p && ZM.ryId >= 0) ry = p.GetAxis(ZM.ryId); } catch (e) {}
    if (Math.abs(ry) > 0.6) { ZM.rt = (ZM.rt || 0) - dt; if (ZM.rt <= 0) { d += ry > 0 ? 1 : -1; ZM.rt = 0.12; } } else ZM.rt = 0;
    if (d) W.zoomTo(ZM.lv + d);
  }
  // the right stick's vertical action, looked up by name once (Rewired's ids differ per action map)
  function findRightY() {
    ZM.ryId = -1;
    try {
      var acts = cs.Rewired.ReInput.mapping.Actions;
      for (var i = 0; i < acts.Count; i++) { var a = acts.get_Item(i), n = String(a.name); if (/^(CameraY|RightStickY|RightY|ViewY|LookY)$/i.test(n)) { ZM.ryId = a.id; log("zoom on the right stick: " + n); break; } }
    } catch (e) { log("right stick: " + e); }
  }
  W.zoomInput = zoomInput;
  W.kill = function () { try { unfreeze(); lightOn(false); } catch (e) {} try { W.zoomOff(); } catch (e) {} try { W.close(true); } catch (e) {} try { if (W.root && !isNull(W.root)) UE.Object.Destroy(W.root); } catch (e) {} };
  log("window ready");
})();
