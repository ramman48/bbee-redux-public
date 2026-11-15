// Four-player online mode: the lobby screen (direction C, docs/four-player/PROPOSAL_LOBBY_UI.md section 4). Soulve,
// 2026-10-17, on the grey block-out: "it's supposed to look like castle crashers menu be a fully fledged new ui with real
// time vfx just like we did for grim". This draws the Unity-built screen (uikit/Assets/FourPlayer, bundle
// ui/prefab/fourplayer/fourlobby: Krita art, 60 fps animation, real-time light in each hero's colour) and drives it.
// One card per player up to BB4.MAX (8), in one row that scrolls when the cards would get smaller than 0.7 (works to
// BB4.CAP). Input: the game's own Rewired actions (keyboard and gamepad, with the game's button pictures in a prompt
// row), the mouse (hover, click, wheel). While the screen is open the hero and the game's menus are locked
// (GameInputManager's SpecialLogic lock), released on every close. Reads BB4L (the lobby) and BB4F (the fight).
// Log tag FOURUI. API: BB4UI.open() / close() / move(dx, dy) / press() / back() / page(d) / act(name) / shot(name) /
// colourOf(hero, skin) / rules(). BB4UI.devBundle (a file path) loads the bundle straight from disk (hot load).
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof;
  function log(m) { B.log("FOURUI", m); }
  var es = B.es;
  var S = G.BB4UI = G.BB4UI || {};
  if (S.timer) clearInterval(S.timer);
  if (S.locked) { try { require("Core/Util").U.SetAllActionLock(false, cs.NOAH.Input.LockFlag.SpecialLogic); } catch (e) {} S.locked = false; }
  if (S.root && !S.root.Equals(null)) { try { UE.Object.Destroy(S.root); } catch (e) {} }
  S.root = null; S.isOpen = false;
  // the group change's block-out switches (read where the change is drawn; kept across a hot load):
  // S.chgPlain true: the three setTabLook beats do nothing, so the motion is judged on plain cells
  // S.chgScrub a frame number or null: when a number, the running change is drawn at that frame instead of the clock
  if (S.chgPlain == null) S.chgPlain = true;
  if (S.chgScrub === undefined) S.chgScrub = null;

  var F = 1 / 60;                                 // one frame at 60 fps
  var BW = 500, CH = 680, SL = 100;                // the card's box (the prefab's FourLobbyBuild.CW/CH/SL)
  var FLOOR = 238;                                 // the stage's front edge, px above the bottom (1080 reference)
  var MIN_S = 0.7, MAX_S = 0.85;                   // the cards' size range: below 0.7 the row scrolls instead
  // each official hero's card colour, measured from its HeroPortraitFull art (local_only/fourplayer/lobby/hero_colours.py);
  // corrected by eye where red trim outweighs the hero's own colour in the measure: Noel, Taokaka, Hazama, Platinum, Es, Mai
  var HERO_COLOUR = {"100101": [0.85, 0.12, 0.18], "100201": [0.26, 0.45, 0.85], "100301": [0.25, 0.45, 0.95], "100302": [0.30, 0.37, 0.85], "100401": [0.85, 0.17, 0.23], "100501": [0.95, 0.75, 0.20], "100601": [0.85, 0.14, 0.23], "100701": [0.85, 0.18, 0.20], "100801": [0.85, 0.14, 0.12], "100901": [0.85, 0.13, 0.16], "101001": [0.52, 0.30, 0.85], "101101": [0.85, 0.27, 0.18], "101201": [0.30, 0.51, 0.85], "101301": [0.85, 0.28, 0.36], "101401": [0.30, 0.80, 0.40], "101501": [0.30, 0.37, 0.85], "101601": [0.85, 0.43, 0.11], "101701": [0.85, 0.53, 0.08], "101801": [0.95, 0.45, 0.75], "101901": [0.85, 0.30, 0.52], "102001": [0.85, 0.73, 0.10], "102002": [0.85, 0.73, 0.10], "102101": [0.85, 0.15, 0.24], "102201": [0.85, 0.71, 0.08], "102301": [0.85, 0.28, 0.65], "102401": [0.85, 0.11, 0.08], "102501": [0.85, 0.22, 0.30], "102601": [0.85, 0.57, 0.15], "102701": [0.85, 0.58, 0.13], "102801": [0.85, 0.76, 0.13], "102901": [0.28, 0.33, 0.85], "103001": [0.85, 0.17, 0.23], "103101": [0.85, 0.17, 0.19], "103201": [0.86, 0.62, 0.19], "103301": [0.26, 0.85, 0.48], "103401": [0.30, 0.50, 0.95], "103501": [0.55, 0.35, 0.90], "103601": [0.89, 0.59, 0.13], "103701": [0.13, 0.75, 0.85], "103801": [0.85, 0.10, 0.35]};
  // framing corrections the measure cannot see (x, y in card px, s = size factor), keyed by hero id
  var ART_FIX = S.ARTFIX || {};
  var NO_HERO = [0.55, 0.52, 0.66];
  var TINT = ["Rig/Face/Fill", "Rig/Face/Mask/Aura", "Rig/Face/Mask/Sparks", "Rig/Face/Mask/HexLight", "Rig/Face/Frame", "Rig/Face/FrameGlow",
              "Rig/Face/FrameFlash", "Rig/BaseGlow", "Rig/Medal/Glow", "Rig/Medal/Join", "Rig/Plate"];
  var PALE = { "Rig/Face/Frame": 1, "Rig/Plate": 1 };   // these take the colour half way to white
  var LIFT = { "Rig/Face/Fill": 1, "Rig/Face/Mask/HexLight": 1 };   // the hex field behind the art: brighter behind dark art

  // ---- building blocks ----
  var font = null, fontMat = null;
  function findFont() {
    if (font) return;
    try { var all = UE.Object.FindObjectsOfType(T(cs.TMPro.TextMeshProUGUI)); for (var i = 0; i < all.Length; i++) { var t = all.get_Item(i); if (t.font) { font = t.font; fontMat = t.fontSharedMaterial; return; } } } catch (e) { log("font: " + es(e)); }
  }
  function col(a, al) { return new UE.Color(a[0], a[1], a[2], al != null ? al : (a.length > 3 ? a[3] : 1)); }
  function pale(c, k) { return [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function find(tr, path) { var n = tr.Find(path); if (!n || n.Equals(null)) throw new Error("prefab has no " + path); return n; }
  function comp(tr, path, type) { return find(tr, path).GetComponent(T(type)); }
  function node(parent, name) { var g = new UE.GameObject(name); var rt = g.AddComponent(T(UE.RectTransform)); rt.SetParent(parent, false); return rt; }
  // a scroll rail beside a grid that holds more rows than it shows: Legacy's track and thumb (fourlegkit.js, the same
  // pictures and the same 8 px inset), the thumb as tall as the share of rows on screen and as low as the first one shown.
  // Hidden while every row fits
  var RAIL_DIR = (B.ROOT || "") + "/mods/redux-menus/files/art/legacy/02_assets/scroll/", railTex = S.railTex = S.railTex || {};
  function railPic(n) {
    var t = railTex[n]; if (t && !t.Equals(null)) return t;
    if (!cs.System.IO.File.Exists(RAIL_DIR + n + ".png")) return null;   // without the picture: a plain bar (rail)
    t = new UE.Texture2D(2, 2, UE.TextureFormat.RGBA32, false); UE.ImageConversion.LoadImage(t, cs.System.IO.File.ReadAllBytes(RAIL_DIR + n + ".png"));
    t.filterMode = UE.FilterMode.Bilinear; t.wrapMode = UE.TextureWrapMode.Clamp; return (railTex[n] = t);
  }
  function rail(parent, name, x, y, h) {
    var R = { rt: node(parent, name), h: h, k: null };
    R.rt.anchorMin = R.rt.anchorMax = new UE.Vector2(0.5, 0.5); R.rt.anchoredPosition = new UE.Vector2(x, y); R.rt.sizeDelta = new UE.Vector2(13, h);
    var ti = R.rt.gameObject.AddComponent(T(UI.RawImage)); ti.texture = railPic("scroll_track"); ti.raycastTarget = false; if (!ti.texture) ti.color = new UE.Color(1, 1, 1, 0.12);
    R.th = node(R.rt, "Thumb"); R.th.anchorMin = R.th.anchorMax = R.th.pivot = new UE.Vector2(0.5, 1);
    var hi = R.th.gameObject.AddComponent(T(UI.RawImage)); hi.texture = railPic("scroll_thumb"); hi.raycastTarget = false; if (!hi.texture) hi.color = new UE.Color(1, 1, 1, 0.6);
    R.rt.gameObject.SetActive(false); return R;
  }
  function railSet(R, top, rows, shown) {
    var k = rows > shown ? top + "/" + rows : "off"; if (!R || R.k === k) return; R.k = k;
    R.rt.gameObject.SetActive(rows > shown); if (rows <= shown) return;
    var room = R.h - 16, hh = Math.max(40, room * shown / rows);
    R.th.sizeDelta = new UE.Vector2(6, hh); R.th.anchoredPosition = new UE.Vector2(0, -8 - (room - hh) * top / (rows - shown));
  }
  // a TextMeshPro line on one of the prefab's T_* nodes, in the game's font
  function txt(tr, path, size, c, align, style) {
    var n = find(tr, path), t = n.GetComponent(T(cs.TMPro.TextMeshProUGUI)) || n.gameObject.AddComponent(T(cs.TMPro.TextMeshProUGUI));
    if (font) { t.font = font; if (fontMat) t.fontSharedMaterial = fontMat; }
    t.fontSize = size; t.color = col(c || [1, 1, 1]); t.enableWordWrapping = false; t.raycastTarget = false;
    t.overflowMode = cs.TMPro.TextOverflowModes.Overflow;
    t.alignment = align || cs.TMPro.TextAlignmentOptions.Left; t.fontStyle = style == null ? 3 : style;   // bold italic, as the select screen's names
    t.text = ""; return t;
  }
  function setA(g, a) { var c = g.color; c.a = a; g.color = c; }

  // ---- loading the screen ----
  function prefab() {
    var p = null;
    if (!S.devBundle) {                             // a test window with a hot-loaded build skips the installed copy, which may be older
      try { p = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.GameObject), "UI/Prefab/FourPlayer/FourLobby"); } catch (e) {}
      if (p && !p.Equals(null)) return p;
    } else {                                        // a test window: the bundle straight from the uikit build (hot load)
      try {
        // the one-argument LoadFromFile is stripped from the game's build; (path, crc, offset) is there
        if (!G.BB4UI_BUNDLE || G.BB4UI_BUNDLE.Equals(null)) G.BB4UI_BUNDLE = UE.AssetBundle.LoadFromFile(S.devBundle, 0, 0);
        if (!G.BB4UI_BUNDLE || G.BB4UI_BUNDLE.Equals(null)) {       // the installed copy holds the bundle's name: let it go, then load ours
          // Unity's own listing calls are stripped from the game; its asset manager unloads by logical path
          var am = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase);
          ["ui/prefab/fourplayer/fourlobby.ab", "ui/prefab/fourplayer/fourlobby"].forEach(function (pth) {
            if (G.BB4UI_BUNDLE && !G.BB4UI_BUNDLE.Equals(null)) return;
            try { var a = CS.System.Array.CreateInstance(T(CS.System.String), 1); a.SetValue(pth, 0); am.UnloadBundleByPath(a); } catch (e) { log("unload " + pth + ": " + es(e)); }
            G.BB4UI_BUNDLE = UE.AssetBundle.LoadFromFile(S.devBundle, 0, 0);
            if (G.BB4UI_BUNDLE && !G.BB4UI_BUNDLE.Equals(null)) log("installed lobby bundle let go (" + pth + ") for the hot-loaded one");
          });
        }
        var all = G.BB4UI_BUNDLE.LoadAllAssets(T(UE.GameObject));       // LoadAsset is stripped too
        for (var i = 0; i < all.Length; i++) { var a = all.get_Item(i); if (a.name == "FourLobby") return a; }
      } catch (e) { log("dev bundle: " + es(e)); }
    }
    return null;
  }
  // a hero's full portrait: the skin's first, then the hero's; mod heroes through the SDK's texture aliases
  function heroTexture(id, skin) {
    var sq = soonOf(id); if (sq) return soonArt(sq);
    if (skin && skin != id) { var t0 = heroTexture(skin); if (t0) return t0; }
    var ov = heroFile(id, false); if (ov) return ov;
    var path = "UI/Texture/HeroPortraitFull/HeroPortraitFull_" + id;
    try { var A = require("Example").ModRegistry.textureAlias; if (A && A[path]) path = A[path]; } catch (e) {}
    try { var t = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Texture2D), path); if (t && !t.Equals(null)) return t; } catch (e) {}
    return null;
  }
  // what a portrait looks like, read once from a 48 px copy: where the figure's top is (0 = the texture's top edge),
  // where its head sits across, how dark it is, and its main colour (for heroes with no colour of their own)
  var MEAS = S.meas = S.meas || {};
  function measure(tex) {
    var key = tex.name + "/" + tex.width; if (MEAS[key]) return MEAS[key];
    var r = { top: 0.05, cx: 0.5, luma: 0.5, colour: null };
    try {
      var w = 48, h = Math.max(8, Math.round(48 * tex.height / tex.width));
      var rt = UE.RenderTexture.GetTemporary(w, h, 0, UE.RenderTextureFormat.ARGB32);
      UE.Graphics.Blit(tex, rt); var prev = UE.RenderTexture.active; UE.RenderTexture.active = rt;
      var t2 = new UE.Texture2D(w, h, UE.TextureFormat.RGBA32, false); t2.ReadPixels(new UE.Rect(0, 0, w, h), 0, 0, false); t2.Apply();
      UE.RenderTexture.active = prev; UE.RenderTexture.ReleaseTemporary(rt);
      var px = t2.GetPixels32(), a = [], rows = []; UE.Object.Destroy(t2);
      var ls = 0, ln = 0, cr = 0, cg = 0, cb = 0, cw = 0;
      for (var y = 0; y < h; y++) {                 // ReadPixels' row 0 is the bottom; rows[] counts from the top
        var n = 0, row = h - 1 - y;
        for (var x = 0; x < w; x++) {
          var c = px.get_Item(y * w + x), al = c.a / 255; a[row * w + x] = al;
          if (al > 0.5) {
            n++; var R = c.r / 255, Gc = c.g / 255, Bc = c.b / 255, mx = Math.max(R, Gc, Bc), mn = Math.min(R, Gc, Bc);
            ls += 0.3 * R + 0.59 * Gc + 0.11 * Bc; ln++;
            var sat = mx > 0 ? (mx - mn) / mx : 0, wt = sat * sat * mx; cr += R * wt; cg += Gc * wt; cb += Bc * wt; cw += wt;
          }
        }
        rows[row] = n;
      }
      var top = 0; while (top < h && rows[top] < 2) top++;
      var band = Math.max(2, Math.round(h * 0.06)), sx = 0, sn = 0;          // the head: the figure's first 6 % from its top
      for (var yy = top; yy < Math.min(h, top + band); yy++) for (var xx = 0; xx < w; xx++) if (a[yy * w + xx] > 0.5) { sx += xx; sn++; }
      r.top = top / h; r.cx = sn ? (sx / sn + 0.5) / w : 0.5; r.luma = ln ? ls / ln : 0.5;
      // the box of what is drawn (parts of the texture, from its top-left): the select stands the figure on its floor by it
      var bot = h; while (bot > top + 1 && rows[bot - 1] < 2) bot--; var lx = w, rx = -1;
      for (var y2 = top; y2 < bot; y2++) for (var x2 = 0; x2 < w; x2++) if (a[y2 * w + x2] > 0.5) { if (x2 < lx) lx = x2; if (x2 > rx) rx = x2; }
      r.bot = bot / h; r.l = rx >= 0 ? lx / w : 0; r.r = rx >= 0 ? (rx + 1) / w : 1;
      if (cw > 0) { var m = Math.max(cr, cg, cb) / cw || 1; r.colour = [cr / cw / m * 0.88, cg / cw / m * 0.88, cb / cw / m * 0.88]; }
    } catch (e) { log("measure " + key + ": " + es(e)); }
    MEAS[key] = r; return r;
  }

  function build() {
    findFont();
    var pf = prefab(); if (!pf) throw new Error("the lobby screen's bundle is not loaded (ui/prefab/fourplayer/fourlobby)");
    var go = new UE.GameObject("BB4LobbyUI"); UE.Object.DontDestroyOnLoad(go);
    var cv = go.AddComponent(T(UE.Canvas)); cv.renderMode = UE.RenderMode.ScreenSpaceOverlay; cv.sortingOrder = 30000;
    var sc = go.AddComponent(T(UI.CanvasScaler)); sc.uiScaleMode = UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;
    sc.referenceResolution = new UE.Vector2(1920, 1080); sc.matchWidthOrHeight = 1;          // by height: a wide window gets more room at the sides
    S.root = go;
    var inst = UE.Object.Instantiate(pf, go.transform, false); inst.name = "FourLobby"; S.ui = inst.transform;
    S.subFit = 0; S.title = txt(S.ui, "Title/T_Title", 44); S.sub =txt(S.ui, "Title/T_Sub", 24, [0.75, 0.72, 0.82], null, 0);
    S.info = txt(S.ui, "Info/T_Info", 34, null, cs.TMPro.TextAlignmentOptions.Right); S.code = txt(S.ui, "Info/T_Code", 22, [0.75, 0.72, 0.82], cs.TMPro.TextAlignmentOptions.Right, 0);
    S.toast = txt(S.ui, "T_Toast", 28, [1, 0.85, 0.5], cs.TMPro.TextAlignmentOptions.Center); S.toastUntil = 0;
    var cardsT = find(S.ui, "Cards"), tpl = find(cardsT, "Card");
    S.cards = [];
    for (var i = 0; i < B.MAX; i++) {
      var cg = UE.Object.Instantiate(tpl.gameObject, cardsT, false); cg.name = "Card" + (i + 1);
      S.cards.push(card(cg.transform, i));
    }
    // the row's edge arrows (more cards off screen): the cards' own arrow art, larger, with a count
    S.edge = [-1, 1].map(function (d) {
      var g = UE.Object.Instantiate(find(tpl, "Rig/ChevL").gameObject, S.ui, false); g.name = d < 0 ? "EdgeL" : "EdgeR";
      var rt = g.GetComponent(T(UE.RectTransform)); rt.anchorMin = rt.anchorMax = new UE.Vector2(0.5, 0); rt.pivot = new UE.Vector2(0.5, 0.5);
      rt.sizeDelta = new UE.Vector2(72, 100); rt.localScale = new UE.Vector3(d < 0 ? 1 : -1, 1, 1);
      // the same arrow in black, larger, behind it: it reads over light art too
      var sh = UE.Object.Instantiate(g, rt, false); sh.name = "Shade"; var srt = sh.GetComponent(T(UE.RectTransform));
      srt.anchorMin = srt.anchorMax = new UE.Vector2(0.5, 0.5); srt.anchoredPosition = new UE.Vector2(3, -4); srt.sizeDelta = new UE.Vector2(72, 100);
      srt.localScale = new UE.Vector3(1.25, 1.25, 1); sh.GetComponent(T(UI.Image)).color = new UE.Color(0, 0, 0, 0.75); srt.SetAsFirstSibling();
      var art = UE.Object.Instantiate(g, rt, false); art.name = "Art"; UE.Object.Destroy(art.transform.Find("Shade").gameObject);
      var art_rt = art.GetComponent(T(UE.RectTransform)); art_rt.anchorMin = art_rt.anchorMax = new UE.Vector2(0.5, 0.5); art_rt.anchoredPosition = UE.Vector2.zero; art_rt.localScale = UE.Vector3.one;
      g.GetComponent(T(UI.Image)).enabled = false;
      var nr = node(S.ui, "T_More" + (d < 0 ? "L" : "R")); nr.anchorMin = nr.anchorMax = new UE.Vector2(0.5, 0); nr.sizeDelta = new UE.Vector2(120, 40);
      var t = txt(S.ui, "T_More" + (d < 0 ? "L" : "R"), 26, [0.9, 0.88, 0.96], cs.TMPro.TextAlignmentOptions.Center);
      return { d: d, rt: rt, img: art.GetComponent(T(UI.Image)), t: t, trt: nr };
    });
    tpl.gameObject.SetActive(false);
    S.barT = find(S.ui, "Bar"); S.btnTpl = find(S.barT, "Btn"); S.btnTpl.gameObject.SetActive(false); S.btns = [];
    // the host's menu on another player's card: three buttons in a column
    S.menu = new UE.GameObject("CardMenu"); var mrt = S.menu.AddComponent(T(UE.RectTransform)); mrt.SetParent(S.ui, false); S.menuRt = mrt;
    S.menuItems = ["Kick", "Make host", "Cancel"].map(function (s, k) { var b = button(mrt, "M" + k); b.rt.anchoredPosition = new UE.Vector2(0, 76 - k * 76); b.t.text = s; return b; });
    S.menu.SetActive(false);
    buildRules(); buildPrompts(); buildSel();
    S.evo = null;
    if (G.BB4EVO) { try { G.BB4EVO.build(S, { node: node, txt: txt, find: find, comp: comp, setA: setA, col: col, spriteOf: spriteOf, headSprite: headSprite, heroLabelOf: heroLabelOf,
      heroTexture: heroTexture, measure: measure, skinOf: skinOf, lightRow: lightRow, button: button, lightBtn: lightBtn, confirmPick: confirmPick, cancelPick: cancelPick,
      INK: INK, inheritIcon: spriteOf(ICON.inherit), raw: function (uid) { return S.evoRaw[uid] || null; }, build: evoBuild,
      setRaw: function (uid, sv) { S.evoRaw[uid] = sv; delete EVOBUILD[uid]; }, toast: toast }); } catch (e) { S.evo = null; log("Legacy selector: " + es(e)); } }
    S.d3 = false;   // the v3 depth pass (fourlobby3d.js): the screen stays flat if it fails
    if (G.BB4UI3D) { try { G.BB4UI3D.built(S); S.d3 = !!G.BB4UI3D.ok; } catch (e) { log("3D pass: " + es(e)); } }
    if (G.BB4LIT && G.BB4LIT.lbBuild) { try { G.BB4LIT.lbBuild(S); } catch (e) { log("lobby light: " + es(e)); } }   // the V4 light layer (fourlight.js)
  }
  function button(parent, name) {
    var g = UE.Object.Instantiate(S.btnTpl.gameObject, parent, false); g.name = name; g.SetActive(true);
    var rt = g.GetComponent(T(UE.RectTransform)); rt.anchorMin = rt.anchorMax = new UE.Vector2(0.5, 0.5);
    return { rt: rt, on: comp(g.transform, "On", UI.Image), t: txt(g.transform, "T_Label", 28, null, cs.TMPro.TextAlignmentOptions.Center) };
  }
  function lightBtn(b, lit, scale) {
    setA(b.on, lit ? 1 : 0); b.t.color = lit ? new UE.Color(0.08, 0.06, 0.1, 1) : new UE.Color(1, 1, 1, 1);
    if (scale) { b.sc = b.sc == null ? 1 : b.sc + ((lit ? 1.06 : 1) - b.sc) * 0.35; b.rt.localScale = new UE.Vector3(b.sc, b.sc, 1); }
  }
  function card(tr, i) {
    var k = { i: i, tr: tr, rt: tr.GetComponent(T(UE.RectTransform)), an: tr.GetComponent(T(UE.Animator)), id: "", hero: 0, rd: null, colour: null };
    k.rig = find(tr, "Rig"); k.face = find(tr, "Rig/Face"); k.back = find(tr, "Rig/Back"); k.empty = find(tr, "Rig/Empty");
    k.backImg = k.back.GetComponent(T(UI.Image));
    k.art = comp(tr, "Rig/Face/Mask/ArtSlot/Art", UI.RawImage);
    k.plate = find(tr, "Rig/Plate"); k.chips = find(tr, "Rig/Chips"); k.crown = find(tr, "Rig/Plate/Crown");
    k.chev = [find(tr, "Rig/ChevL"), find(tr, "Rig/ChevR")];
    k.glyph = { join: find(tr, "Rig/Medal/Join"), wait: find(tr, "Rig/Medal/Wait"), ready: find(tr, "Rig/Medal/Ready") };
    k.burst = comp(tr, "Rig/Medal/Burst", UI.Image);
    var jb = tr.Find("Rig/Medal/JoinBurst"); k.joinBurst = jb && !jb.Equals(null) ? jb.GetComponent(T(UI.Image)) : null;   // bundles before 2026-10-17 evening have none
    k.bars = [0, 1, 2, 3].map(function (b) { return comp(tr, "Rig/Plate/Ping/Bar" + b, UI.Image); });
    k.chipRims = [0, 1, 2].map(function (c) { return comp(tr, "Rig/Chips/Chip" + c, UI.Image); });
    // the chips' own icon is an empty RawImage in the bundle (a white hex): an Image beside it takes the game's sprites
    k.chipIco = [0, 1, 2].map(function (c) {
      var m = find(tr, "Rig/Chips/Chip" + c + "/Mask"), ri = comp(m, "Icon", UI.RawImage), n = node(m, "Ico");
      n.anchorMin = n.anchorMax = new UE.Vector2(0.5, 0.5); n.sizeDelta = new UE.Vector2(c == 0 ? 84 : 62, c == 0 ? 84 : 62);
      var im = n.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; im.preserveAspect = true; im.enabled = false;
      if (ri) { if (ri.material) im.material = ri.material; ri.enabled = false; }
      return im;
    });
    k.tint = TINT.map(function (p) { return { g: find(tr, p).GetComponent(T(UI.Graphic)), pale: !!PALE[p], lift: !!LIFT[p] }; });
    k.hero_t = txt(tr, "Rig/Plate/T_Hero", 40); k.name_t = txt(tr, "Rig/Plate/T_Player", 22, [0.78, 0.76, 0.86], null, 0);
    k.tag_t = txt(tr, "Rig/Plate/T_Tag", 22); k.empty_t = txt(tr, "Rig/Empty/T_Empty", 26, [0.7, 0.68, 0.78], cs.TMPro.TextAlignmentOptions.Center, 0);
    tr.gameObject.SetActive(false);
    return k;
  }

  // ---- what each card shows ----
  // BB4UI_FAKE: extra made-up players drawn after the real ones, for layout pictures in a test window only
  function members() { var L = G.BB4L, m = L && L.state == "in" ? (L.members || []).filter(function (x) { return !x.stale && !x.kicked; }) : [];   /* a game that stopped answering (closed, crashed, in another lobby) is not shown */ return G.BB4UI_FAKE && B.WIN > 1 ? m.concat(G.BB4UI_FAKE) : m; }
  function meId() { try { return G.BB4L && G.BB4L.myId ? G.BB4L.myId() : G.BB4F.myId(); } catch (e) { return ""; } }   // the lobby's id (a window's own on this PC)
  function me() { var id = meId(); return members().filter(function (m) { return m.id == id; })[0] || null; }
  function isHost() { var L = G.BB4L; return !!(L && L.host); }
  // a hero's card colour: the measured table, a mod's own (BB4_HERO_COLOUR), the colour the player's game shared
  // (a mod hero this PC lacks), else measured from the portrait here
  function heroColour(id, m, tex) {
    if (!id) return NO_HERO;
    var c = HERO_COLOUR[String(id)]; if (c) return c;
    try { var M = G.BB4_HERO_COLOUR; if (M && M[id]) return M[id]; } catch (e) {}
    if (m && m.hcol && m.hcol.length == 3) return m.hcol;
    if (tex) { var r = measure(tex); if (r.colour) return r.colour; }
    return [0.85, 0.2, 0.3];
  }
  S.colourOf = function (id, skin) { return heroColour(id, null, id ? heroTexture(id, skin) : null); };
  function tint(k, c, lift) {
    lift = lift || 1;
    if (k.colour && k.colour[0] == c[0] && k.colour[1] == c[1] && k.colour[2] == c[2] && k.lift == lift) return;
    k.colour = c; k.lift = lift;
    k.tint.forEach(function (p) {
      var a = p.g.color.a, cc = p.pale ? pale(c, 0.55) : c;
      if (p.lift && lift != 1) cc = [Math.min(1, cc[0] * lift), Math.min(1, cc[1] * lift), Math.min(1, cc[2] * lift)];
      p.g.color = col(cc, a);
    });
    k.tag_t.color = col(c);
  }
  // the card's art, colour and framing for a hero. The bust is 1.6 x the card's width; its top sits just above the card's
  // top edge (the approved framing), lowered where the figure starts at the texture's top (it would be cut: Taokaka's
  // hood), shifted so the head is over the card's middle, and the hex field behind dark art is lit 15 % more (Hakumen)
  function look(k, id, skin, m) {
    var tex = id ? heroTexture(id, skin) : null;
    k.art.texture = tex; k.art.gameObject.SetActive(!!tex); k.missing = !!id && !tex;
    if (!tex) { if (id && !k.warned) { k.warned = 1; log("no portrait for hero " + id + " on this PC"); } tint(k, heroColour(id, m, null)); return; }
    var r = measure(tex), fx = ART_FIX[id] || {}, w = BW * 1.6 * (fx.s || 1), h = w * tex.height / tex.width, rt = k.art.rectTransform;
    var y = Math.min(CH + 30, CH - 34 + r.top * h) + (fx.y || 0), x = BW * 0.56 + clamp((0.5 - r.cx) * w, -90, 90) + (fx.x || 0);
    rt.sizeDelta = new UE.Vector2(w, h); rt.pivot = new UE.Vector2(0.5, 1); rt.anchoredPosition = new UE.Vector2(x, y);
    tint(k, heroColour(id, m, tex), r.luma < 0.3 ? 1.15 : 1);
  }
  // the card's sides without an animation (screen opening, a place appearing). A card's Animator writes the prefab's
  // values back on the frame after the card is switched on, so tick() holds this for its first 6 frames (k.pin)
  function resting(k, occupied) {
    k.face.localScale = new UE.Vector3(occupied ? 1 : 0, 1, 1); k.face.GetComponent(T(UE.CanvasGroup)).alpha = occupied ? 1 : 0;
    k.back.localScale = new UE.Vector3(occupied ? 0 : 1, 1, 1); k.empty.GetComponent(T(UE.CanvasGroup)).alpha = occupied ? 0 : 1;
    k.backImg.color = new UE.Color(1, 1, 1, k.backImg.color.a);                  // Join darkens the back as it turns
    k.rig.localScale = UE.Vector3.one;
    k.empty.gameObject.SetActive(!occupied);
    var pg = k.plate.GetComponent(T(UE.CanvasGroup)); if (pg) pg.alpha = 1;     // the prefab's Join and Leave move the plate
    var pr = k.plate.GetComponent(T(UE.RectTransform)), pp = pr.anchoredPosition; if (k.plateY == null) k.plateY = pp.y; pp.y = k.plateY; pr.anchoredPosition = pp;
  }
  // the card as it must look when nothing is playing on it: sides, plate, empty text and art agree with k.id. The
  // Animator (write defaults off) writes back the last value of everything it has ever animated, every frame, so a
  // flip cut midway cannot be set right from code: the clip that ends in the right look is jumped to its last frame
  // (Join for a taken place, Leave for an empty one; layer 1 is the card's Fx layer)
  function settle(k) {
    var occ = !!k.id; k.settledAt = now();
    var f = k.face.localScale.x, b = k.back.localScale.x, pg = k.plate.GetComponent(T(UE.CanvasGroup)), pa = pg ? pg.alpha : 1;
    if (occ ? (f < 0.99 || b > 0.01 || pa < 0.99) : (f > 0.01 || b < 0.99)) {
      try { k.an.Play(occ ? "Join" : "Leave", 1, 1); k.an.Update(0); } catch (e) { log("settle: " + es(e)); }
      tr(k, "snapped to " + (occ ? "Join" : "Leave") + "'s end (face " + f.toFixed(2) + ", back " + b.toFixed(2) + ", plate " + pa.toFixed(2) + ")");
    }
    resting(k, occ);
    k.plate.gameObject.SetActive(occ);                                           // fill() owns the chips of an occupied card
    if (occ) k.art.gameObject.SetActive(!!(k.art.texture && !k.art.texture.Equals(null))); else k.chips.gameObject.SetActive(false);
    k.glyph.join.gameObject.SetActive(!occ); if (!occ) { k.glyph.wait.gameObject.SetActive(false); k.glyph.ready.gameObject.SetActive(false); }
  }
  // a one-shot on the card. Join's ring is the solid one in the hero's colour, Ready's the broken gold one
  // Every clip starts from Any State, so a second one cuts the first wherever it is. A player's data comes in pieces
  // (the id, then the hero, then ready), so Swap or Ready cut the Join flip at its crossover and the card stayed with
  // no face, no back and a faded plate (Soulve, 2026-10-18: "sometimes i cant see my character"; GeokitFX's card in his
  // window: plate alpha 0, face 0, back 0). Now a clip that moves the card's sides or plate owns the card for its
  // length (k.flipUntil): other shots wait their turn (k.after), and tick() puts the card back to its resting state
  // when the window ends, whatever the Animator left
  // clip lengths (uikit FourCard.controller): Join 0.43 s, Leave 0.33, Swap 0.23, Start 0.6; a little over each
  var FLIP = { Join: 0.5, Leave: 0.4, Swap: 0.3, Start: 0.7 };
  S.trace = S.trace || [];
  function tr(k, what) { S.trace.push(now().toFixed(2) + " c" + k.i + " " + what); if (S.trace.length > 300) S.trace.splice(0, 100); }
  function shot(k, name) {
    if (k.flipUntil && now() < k.flipUntil) { k.after = k.after || []; if (k.after[k.after.length - 1] != name) k.after.push(name); tr(k, name + " waits"); return; }
    if (FLIP[name]) k.flipUntil = now() + FLIP[name];
    tr(k, name);
    if (name == "Ready") k.burst.color = new UE.Color(1, 0.85, 0.45, k.burst.color.a);
    if (name == "Join") { var rg = k.joinBurst || k.burst; rg.color = col(pale(k.colour || NO_HERO, 0.6), rg.color.a); }
    try { k.an.SetTrigger(name); } catch (e) { log("trigger " + name + ": " + es(e)); } officialFx(k, name);
    if (G.BB4UI3D) { try { G.BB4UI3D.shot(S, k, name); } catch (e) {} } }
  // the game's own UI effects over the card for the big moments (parts of official effects, the mega rule); S.OFX = false
  // switches them off. Only effects checked over a card in game go in. Role_Selection_011 was tried for Join
  // (2026-10-17): it is a whole-screen hex wall, not a card effect, and it stayed on screen
  var OFX = S.OFXMAP || {};
  function officialFx(k, name) {
    if (S.OFX === false || !OFX[name]) return;
    try {
      var p = new cs.NOAH.VFX.EffectPlayParam(); p.name = OFX[name]; p.target = find(k.tr, "Rig/Medal"); p.dontStop = false; p.bind = true;
      require("Core/Util").U.GetSingleton(cs.NOAH.VFX.VFXManager).PlayEffect(p);
    } catch (e) { if (!S.ofxErr) { S.ofxErr = 1; log("official effect " + OFX[name] + ": " + es(e)); } }
  }
  // a strip across the card's lower half: this hero cannot be played in this lobby (the chip art, tinted red, and the game's warning sign)
  function banner(k, text) {
    if (!text) { if (k.ban) k.ban.go.SetActive(false); return; }
    if (!k.ban) {
      var rig = find(k.tr, "Rig"), tpl = find(S.rulesBoard, "Row0/Slide/Opts/Opt");
      var g = UE.Object.Instantiate(tpl.gameObject, rig, false); g.name = "ModBanner"; g.SetActive(true);
      var rt = g.GetComponent(T(UE.RectTransform)); rt.anchorMin = rt.anchorMax = new UE.Vector2(0, 0); rt.pivot = new UE.Vector2(0.5, 0.5);
      rt.anchoredPosition = new UE.Vector2(200 + 100 * (200 / 680), 200); rt.sizeDelta = new UE.Vector2(340, 58);
      var b = { go: g, rt: rt, off: comp(g.transform, "Off", UI.Image), on: comp(g.transform, "On", UI.Image), glow: comp(g.transform, "Glow", UI.Image), t: txt(g.transform, "T_Opt", 26, [1, 0.92, 0.9], cs.TMPro.TextAlignmentOptions.Center) };
      setA(comp(g.transform, "Star", UI.Image), 0);
      var wn = node(g.transform, "Warn"), im = wn.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; im.preserveAspect = true;
      var wr = wn.GetComponent(T(UE.RectTransform)); wr.anchorMin = wr.anchorMax = new UE.Vector2(0, 0.5); wr.anchoredPosition = new UE.Vector2(30, 0); wr.sizeDelta = new UE.Vector2(34, 34);
      im.sprite = S.statusSp && S.statusSp.bad; b.warn = im;
      b.t.margin = new UE.Vector4(54, 0, 14, 0); b.t.enableAutoSizing = true; b.t.fontSizeMax = 26; b.t.fontSizeMin = 16; k.ban = b;
    }
    var t = UE.Time.unscaledTime, b = k.ban; b.go.SetActive(true); b.go.transform.SetAsLastSibling();
    b.t.text = text; b.off.color = new UE.Color(0.75, 0.12, 0.16, 0.92); setA(b.on, 0); b.glow.color = new UE.Color(1, 0.3, 0.3, 0.35 + 0.25 * Math.sin(t * 4));
    if (b.warn) { b.warn.color = new UE.Color(1, 0.85, 0.8, 1); b.warn.gameObject.SetActive(!!b.warn.sprite); }
  }
  function fill(k, m) {
    var L = G.BB4L, my = meId();
    if (!m) { banner(k, ""); k.empty_t.text = isHost() ? "Invite a friend" : "Waiting for a player"; k.chev[0].gameObject.SetActive(false); k.chev[1].gameObject.SetActive(false); return; }
    // a mod hero this PC does not have: the name the player's game sent, and a line saying so
    k.hero_t.text = L.heroName(m.hero) || B.safe(m.hname, 40) || (m.hero ? "Hero " + m.hero : "Picking a hero");
    var who = B.safe(m.name || m.id, 32) + (m.id == my ? "  (you)" : "");
    var hc = m.hero >= 190000 ? L.heroCheck(m.hero, members()) : null;
    k.name_t.text = k.missing ? who + "  ·  <color=#ffc46b>not installed here</color>" : hc ? who + "  ·  " + "<color=#" + (hc.ok ? "8fe39a" : "ff7a7a") + ">" + (hc.ver ? "v" + hc.ver : "no mod here") + "</color>" : who;
    banner(k, hc && !hc.ok ? (hc.missing.length ? "NOT ON EVERY PC" : hc.differ.length ? "VERSIONS DIFFER" : "CHECKING MODS") : m.fin ? "SAVING RUN" : "");
    if (m.fin) k.name_t.text = who + "  ·  <color=#ffd27a>on results</color>";
    if (m.picking && S.pick) {
      var P = S.pick, cnt = "  ·  " + (P.i + 1) + " / " + P.list.length;
      if (P.step == "hero") k.name_t.text = "<color=#ffd27a>Choose a hero" + cnt + "</color>";
      else { var ev = P.list[P.i]; k.name_t.text = "<color=#ffd27a>Legacy " + (P.step == "evo1" ? "I" : "II") + ":  " + (ev ? (L.heroName(ev.id) || "Hero " + ev.id) + "  " + ev.score : "None") + cnt + "</color>"; }
    }
    k.tag_t.text = m.host ? "HOST" : "P" + (k.i + 1);
    k.crown.gameObject.SetActive(!!m.host);
    var bars = m.id == my ? 4 : m.ping == null ? 0 : m.ping < 60 ? 4 : m.ping < 120 ? 3 : m.ping < 200 ? 2 : 1;
    k.bars.forEach(function (b, j) { setA(b, j < bars ? 1 : 0.18); });
    var e = m.evo, have = [!!(e && e.id), !!(e && e.id && (e.inheritSkillIndex || e.inheritSkillLevel || (G.BB4EVO && G.BB4EVO.hasSkill && G.BB4EVO.hasSkill(e)))), !!(e && e.inheritBlesses && e.inheritBlesses.length)];
    k.chips.gameObject.SetActive(have[0]);
    k.chipRims.forEach(function (r, j) { r.color = have[j] ? col(k.colour || NO_HERO) : new UE.Color(1, 1, 1, 0.55); });
    if (k.chipIco) { var ci = have[0] && G.BB4EVO && G.BB4EVO.chipIcons ? G.BB4EVO.chipIcons(e) : [];
      k.chipIco.forEach(function (im, j) { var sp = have[j] ? ci[j] || null : null; if (im.sprite != sp) im.sprite = sp; if (im.enabled != !!sp) im.enabled = !!sp; }); }
    var ready = !!(m.ready || m.host) && !m.fin;
    k.glyph.join.gameObject.SetActive(false); k.glyph.wait.gameObject.SetActive(!ready); k.glyph.ready.gameObject.SetActive(ready);
    var sel = S.zone == "cards" && S.cur == k.i && !S.menu.activeSelf && !S.rulesOpen;
    k.chev[0].gameObject.SetActive(sel); k.chev[1].gameObject.SetActive(sel);
    // at the smaller sizes the plate's small lines grow so they still read (finding, 8 players)
    var big = k.pos && k.pos.s < 0.75; k.name_t.fontSize = big ? 28 : 22; k.tag_t.fontSize = big ? 28 : 22;
    k.hero_t.enableAutoSizing = true; k.hero_t.fontSizeMax = big ? 44 : 40; k.hero_t.fontSizeMin = 24;          // a long name shrinks to its plate
    k.name_t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis; k.hero_t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    if (!k.boxed) { k.boxed = 1; k.name_t.rectTransform.sizeDelta = new UE.Vector2(350, 46); k.hero_t.rectTransform.sizeDelta = new UE.Vector2(296, 62); }   // tall enough for one line at the large sizes; short of the signal bars
  }

  // ---- layout: one row, the stage's line-up. Four places at 0.85; from the fifth the cards shrink, down to 0.7; past
  // that the row scrolls to keep the focused card in view (bumpers, the wheel, the edge arrows) ----
  // the screen's own clock; S.SLOW slows it from the moment it is set (timing pictures; the cards' Animators are
  // slowed by the same factor through Animator.speed)
  var clk = S.clk = S.clk || { t: 0, last: null };
  function now() { var r = UE.Time.unscaledTime; if (clk.last == null) clk.last = r; clk.t += (r - clk.last) * (S.SLOW || 1); clk.last = r; return clk.t; }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
  function lobbySize() { var L = G.BB4L; return L && L.size ? L.size() : B.MAX; }
  function places() { var n = members().length, m = Math.max(n, lobbySize()); return Math.min(m, Math.max(Math.min(4, m), n + (n < m ? 1 : 0))); }
  // the game's own button hints at the bottom (the room's Single-player / Local Co-Op / Online / Hold to Return row):
  // off while this screen shows, under our own prompt row (Geokit, 2026-10-22: the two rows drew over each other)
  function stockHints(on) {
    try {
      var c = S.insCv;
      if (!c || c.Equals(null)) { var g = UE.GameObject.Find("SingletonOrganizer/(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions"); c = S.insCv = g ? g.GetComponent(T(UE.Canvas)) : null; }
      if (c && !c.Equals(null) && c.enabled != on) c.enabled = on;
    } catch (e) { if (!S.insErr) { S.insErr = true; log("hints: " + es(e)); } }
  }
  function viewW() { try { return UE.Screen.width * 1080 / UE.Screen.height - 120; } catch (e) { return 1800; } }
  function row(n) {
    var s = clamp(2112 / (n * 440), MIN_S, MAX_S), step = Math.min(440 * s, 1800 / n);
    if (s <= MIN_S + 1e-6) step = 440 * s * 0.96;                    // scrolling: a little overlap, every name clear
    var half = (n - 1) * step / 2 + BW * 0.5 * s, vh = viewW() / 2;
    return { s: s, step: step, over: Math.max(0, half - vh), vh: vh, fit: Math.min(1, step / (440 * s)) };
  }
  function slot(i, n, R) { return { x: (i - (n - 1) / 2) * R.step - SL * 0.5 * R.s, y: (MAX_S - R.s) * 240, s: R.s, fit: R.fit }; }
  // the row's offset: the focused card stays inside the view with a margin
  function scrollTo(n, R) {
    if (!R.over) { S.scrollT = 0; return; }
    if (S.zone == "cards") {
      var cx = (S.cur - (n - 1) / 2) * R.step, room = R.vh - BW * 0.5 * R.s - 40;
      if (cx - S.scrollT > room) S.scrollT = cx - room; if (cx - S.scrollT < -room) S.scrollT = cx + room;
    }
    S.scrollT = clamp(S.scrollT || 0, -R.over, R.over);
  }
  function place(k, n, R) {
    var to = slot(k.i, n, R);
    if (!k.pos) k.pos = { x: to.x, y: to.y, s: to.s };
    if (!k.to || k.to.x != to.x || k.to.y != to.y || k.to.s != to.s) { k.from = { x: k.pos.x, y: k.pos.y, s: k.pos.s }; k.to = to; k.moveAt = now(); }
    var u = ease((now() - k.moveAt) / (12 * F));
    k.pos = { x: k.from.x + (k.to.x - k.from.x) * u, y: k.from.y + (k.to.y - k.from.y) * u, s: k.from.s + (k.to.s - k.from.s) * u };
    var sel = S.zone == "cards" && S.cur == k.i && !S.menu.activeSelf && !S.rulesOpen ? 1.04 : 1;
    k.selS = k.selS == null ? sel : k.selS + (sel - k.selS) * 0.25;
    k.rt.anchoredPosition = new UE.Vector2(k.pos.x - S.scroll, k.pos.y); k.rt.localScale = new UE.Vector3(k.pos.s * k.selS, k.pos.s * k.selS, 1);
    // where the cards overlap, each plate shrinks to the gap so it does not cover the plate on its left
    var pf = to.fit * 0.97; k.plate.localScale = new UE.Vector3(pf, pf, 1);
  }
  function drawEdges(n, R) {
    var t = UE.Time.unscaledTime;
    S.edge.forEach(function (e) {
      // cards past this edge: their centres beyond the view
      var c = 0; for (var i = 0; i < n; i++) { var x = (i - (n - 1) / 2) * R.step - S.scroll; if (e.d < 0 ? x < -R.vh + 20 : x > R.vh - 20) c++; }
      var on = c > 0 && !S.rulesOpen; e.rt.gameObject.SetActive(on); e.trt.gameObject.SetActive(on); if (!on) return;
      e.rt.SetAsLastSibling(); e.trt.SetAsLastSibling();                       // over the row of cards
      var x0 = e.d * (R.vh - 4) + e.d * 6 * Math.sin(t * 5), y0 = FLOOR + CH * R.s * 0.5;
      e.rt.anchoredPosition = new UE.Vector2(x0, y0); e.trt.anchoredPosition = new UE.Vector2(e.d * (R.vh - 4), y0 - 74);
      e.t.text = "+" + c; e.img.color = new UE.Color(1, 1, 1, 0.75 + 0.25 * Math.sin(t * 5));
    });
  }

  // ---- the bottom bar ----
  function barItems() {
    var L = G.BB4L, m = me();
    var it = [{ t: "Loadout", act: pickLoadout }];
    if (isHost()) {
      it.push({ t: "Invite", act: invite });
      it.push({ t: "Entropy", act: openHeat });
      it.push(rulesItem());
      var others = members().filter(function (x) { return !x.host; }), notReady = others.filter(function (x) { return !x.ready; }).length;
      var onRes = others.filter(function (x) { return x.fin; }).length;
      it.push({ t: onRes ? "Start  ·  <color=#ffd27a>" + onRes + " on results</color>" : notReady ? "Force start  ·  " + notReady + " not ready" : "Start", act: function () { forceStart(notReady); }, start: 1 });
      // another player placed better for everyone's ping (BB4L.bestHost): one press hands them the lobby
      var hh = L.hostHint;
      if (hh) it.push({ t: "Best host: " + B.safe(hh.name, 16) + "  ·  <color=#8fe39a>" + hh.ms + " ms</color> (now " + hh.now + ")", act: function () { if (L.makeHost(hh.id)) toast(B.safe(hh.name, 24) + " hosts now: the worst ping in the lobby is about " + hh.ms + " ms"); } });
    } else {
      it.push({ t: m && m.ready ? "Not ready" : "Ready", act: toggleReady, start: 1 });
      it.push({ t: "Entropy", act: function () {
        var lv = L.run && L.run.level; toast("The host sets Entropy for the run" + (lv ? ": level " + lv : ""));
      } });
      it.push(rulesItem());
    }
    it.push({ t: "Shop", act: openShop });
    it.push({ t: "Leave", act: function () { L.leave(); S.openOnline(); } });
    return it;
  }
  // The game's own Mind Training shop (Training Preparation: buffs, and debuffs to exclude, paid in the player's own AP),
  // as the stock co-op lobby opens it (PveTeamMatch.GetPveTeamMatchBuffShopData). What a player buys is theirs: the
  // game applies it to their own dungeon when the run starts (BreedDungeonEnter) and clears it after. Testers, 2026-10-18:
  // "use the shop before a run to buy debuff exclusions"
  function openShop() {
    var UIU = require("Core/UIUtil").default, W = null;
    try { W = require("Window/PVEShop").default; } catch (e) { log("shop: " + es(e)); toast("The shop can't open here"); return; }
    var held = inputHeld();
    if (held) { log("shop not opened: " + held); toast("The game is still loading. Try the shop again in a moment"); return; }
    hookPause();
    var my = S.shopN = (S.shopN || 0) + 1;
    var back = function () {
      if (my != S.shopN) return;                       // an older shop window, recycled for this one
      S.shopOn = false; S.picking = false; unlockHero(); S.open();
      try { var P = require("Server/Model/Player").ModelPlayer.Instance; log("shop closed: buffs " + JSON.stringify(P.GetShopActiveBuff()) + ", debuffs excluded " + JSON.stringify(P.GetShopActiveDebuff())); } catch (e) {}
    };
    S.close(true); S.picking = true;
    try {
      if (UIU.FindWindowByName("PVEShop")) UIU.RecycleWindowByName("PVEShop");
      var w = UIU.AcquireWindow(W); log("shop open");
      // straight to Training Preparation (tab 2: buffs, and debuffs to exclude); Q / E still change tab
      var tries = 0, tab = setInterval(function () {
        try { if (++tries > 40) { clearInterval(tab); return; } var tb = w.tabs; if (tb && tb.length > 2 && tb[2] && tb[2].gameObject.activeInHierarchy && w.selectedTabIndex != null) { if (w.selectedTabIndex != 2) tb[2].isOn = true; clearInterval(tab); } } catch (e) { clearInterval(tab); }
      }, 100);
      // back to the lobby once the shop has been on screen and is gone (its CloseAsync can hand back an older, already
      // closed result after a recycle: the lobby came back over the shop at once, checked in game 2026-10-18)
      var seen = false, t0 = Date.now(), watch = setInterval(function () {
        var on = false; try { var cur = UIU.FindWindow(W); on = !!(cur && cur.CsObj && !cur.CsObj.Equals(null) && cur.CsObj.gameObject.activeInHierarchy); } catch (e) {}
        if (on && !seen) {
          seen = true; S.shopOn = true;
          setTimeout(function () {                     // shown but deaf (its buy button took no key): say so and close it
            if (my != S.shopN || !S.shopOn) return;
            if (!inputHeld()) return;                  // its tabs have input groups of their own: only a held load counts
            log("shop has no controls: they are at " + inputWhere() + "; closed");
            toast("The shop didn't get the controls. Try again in a moment");
            try { UIU.RecycleWindowByName("PVEShop"); } catch (e) {}
          }, 1200);
        }
        if ((seen && !on) || (!seen && Date.now() - t0 > 8000) || my != S.shopN) { clearInterval(watch); if (!seen) log("shop: the window never showed"); back(); }
      }, 250);
    } catch (e) { log("shop: " + es(e)); back(); }
  }
  // the host may start whenever they like; with players not ready, a second press within 3 s confirms
  function forceStart(notReady) {
    if (blockedPicks().length || (G.BB4F && G.BB4F.startBlock && G.BB4F.startBlock())) { startFight(); return; }   // says why it can't start
    if (!notReady || (S.forceAt && now() - S.forceAt < 3)) { S.forceAt = 0; startFight(); return; }
    S.forceAt = now(); toast(notReady + (notReady == 1 ? " player is" : " players are") + " not ready. Press Start again to start now");
  }
  function rulesItem() {
    var n = modIssues();
    return { t: n ? "Rules  ·  <color=#ff7a7a>" + n + (n == 1 ? " mod issue" : " mod issues") + "</color>" : "Rules", act: function () { openRules(n ? "mods" : "rules"); } };
  }
  function modIssues() { try { return blockedPicks().length; } catch (e) { return 0; } }
  function invite() { if (!isHost()) return; if (!G.BB4L.inviteOverlay()) toast("Invites go through Steam: open the overlay (Shift+Tab)"); }
  // the skin and colour picker for this player's hero (BB4L.openSkinPicker, Four Player's hook in fourlobby.js)
  function openColours() {
    var L = G.BB4L;
    if (!L || !L.openSkinPicker) { toast("Colours can't open in this build"); return; }
    try { log("colours: skin picker"); L.openSkinPicker(); } catch (e) { log("colours: " + es(e)); toast("Colours didn't open. Try again in a moment"); }
  }
  function toggleReady() { var L = G.BB4L, m = me(); if (!isHost() && L) L.setReady(!(m && m.ready)); }
  function drawBar() {
    var it = barItems(), gap = 16, ws = [], tot = -gap;
    while (S.btns.length < it.length) S.btns.push(button(S.barT, "Btn" + S.btns.length));
    it.forEach(function (x, k) {                                       // each button as wide as its label needs, 220 at least
      var tw = 0; try { tw = S.btns[k].t.GetPreferredValues(x.t).x; } catch (e) {}
      ws[k] = Math.max(x.start ? 280 : 220, tw + 90); tot += ws[k] + gap;
    });
    // a row wider than the screen (the host's eight items, Best host's long label, a 4:3 or 16:10 window) is drawn
    // smaller to fit: Loadout and Invite went off the left edge (Geokit, 2026-10-22)
    var room = viewW(); if (tot > room) { tot -= gap * (it.length - 1) / 2; gap /= 2; }
    var fit = tot > room ? room / tot : 1;
    if (S.barFit !== fit) { S.barFit = fit; try { S.barT.localScale = new UE.Vector3(fit, fit, 1); } catch (e) {} }
    var xs = -tot / 2;
    S.btns.forEach(function (b, k) {
      var on = k < it.length; b.rt.gameObject.SetActive(on); if (!on) return;
      b.rt.sizeDelta = new UE.Vector2(ws[k], 66);
      b.rt.anchoredPosition = new UE.Vector2(xs + ws[k] / 2, 0); xs += ws[k] + gap; b.t.text = it[k].t; b.act = it[k].act;
      lightBtn(b, S.zone == "bar" && S.cur == k && !S.rulesOpen, true);
    });
    S.barN = it.length; S.barIt = it;
  }
  function toast(s) { S.toast.text = s; S.toastUntil = now() + 3; log(s); }
  S.say = function (s) { try { if (S.toast) toast(s); } catch (e) {} };   // for the lobby's own messages (an old version removed)

  // ---- the run's rules (the host sets them; every player's game reads them from the lobby: BB4L.run.rules) ----
  // The board is the prefab's Rules node (FourLobbyBuild.BuildRules: Krita art, Open and Idle clips); this fills its rows
  // with the game's own icons, the option chips and the text, and drives focus, the row light and the chip pop.
  // Enemy scaling per player past the stock two: health and damage, Light and Strong (the fight reads BB4_SCALE too)
  var SCALE = G.BB4_SCALE = G.BB4_SCALE || { hp: [0, 0.25, 0.5], dmg: [0, 0.1, 0.2] };
  function scaleAt(lvl, n) { var x = Math.max(0, n - 2); return { hp: 1 + SCALE.hp[lvl] * x, dmg: 1 + SCALE.dmg[lvl] * x }; }
  function times(v) { return "x" + (Math.round(v * 100) / 100); }
  var ICON = { inherit: ["UI/Atlas/CommonMB/CommonMB", "IconBtn_Inherit"], swap: ["UI/Atlas/CommonMB/CommonMB", "Icon_Exchange"],
               potential: ["UI/Atlas/CommonMB/CommonMB", "Icon_Potential"], crystal: ["UI/Atlas/CommonMB/CommonMB", "IconBtn_Consciousness"],
               boss: ["UI/Atlas/Fight/Fight", "IconBoss"], team: ["UI/Atlas/CommonMB/CommonMB", "IconBtn_InviteTeam"] };
  var RULES = [
    // one row for both Legacy rules (the board has room for five): Off, or how many each player may hold
    { k: "legacy", t: "Legacies", icon: "inherit", o: [[1, "1 each"], [2, "2 each"], [0, "Off"]],
      get: function (r) { return r.legacy ? (r.legacyMax == 2 ? 2 : 1) : 0; },
      set: function (r, v) { r.legacy = v ? 1 : 0; if (v) r.legacyMax = v; },
      sub: function (r) { return !r.legacy ? "No Legacy skills in this run" : r.legacyMax == 2 ? "Up to 2 each" : "Players bring their Evotype's Legacy"; },
      d: function (r) { return !r.legacy ? "Nobody starts with a Legacy skill, and none can be found in the run. Every hero plays with its own kit only." : r.legacyMax == 2 ? "Each player may hold up to two Legacy skills. A player who brings more keeps the first two." : "Each player starts with the Legacy skill of their Evotype, as in a normal run."; } },
    { k: "potCap", t: "Potential cap", icon: "potential", o: [[0, "No cap"], ["half", "Half"], [4, "4"], [6, "6"], [8, "8"], [10, "10"], [12, "12"]],
      sub: function (r) { return r.potCap === 0 ? "As many as the run offers" : r.potCap == "half" ? "Half of each hero's Potentials" : "At most " + r.potCap + " each"; },
      d: function (r) { return r.potCap === 0 ? "Players take Potentials as the run offers them, with no limit." : "Once a player holds " + (r.potCap == "half" ? "half of their hero's Potentials" : r.potCap + " Potentials") + ", the run offers them no more; they get the game's usual reward for a full set instead."; } },
    { k: "crystals", t: "Mind Crystals", icon: "crystal", o: [[1, "On"], [0, "Off"]],
      sub: function (r) { return r.crystals ? "Each player's own Mind Crystals" : "Off for everyone"; },
      d: function (r) { return r.crystals ? "Every player keeps the Mind Crystal bonuses from their own save." : "Mind Crystal bonuses are switched off for every player for this run: everyone starts on even terms."; } },
    { k: "scale", t: "Enemy scaling", icon: "boss", o: [[0, "Off"], [1, "Light"], [2, "Strong"]],
      sub: function (r, n) { if (!r.scale) return "Enemies as in a two-player run"; var s = scaleAt(r.scale, n); return n + " players: health " + times(s.hp) + ", damage " + times(s.dmg); },
      d: function (r, n) { if (!r.scale) return "Enemies keep the stock co-op strength, however many players join."; var a = scaleAt(r.scale, 4), b = scaleAt(r.scale, 8); return "Each player past the second makes enemies and bosses tougher, on top of the Entropy level. 4 players: health " + times(a.hp) + ", damage " + times(a.dmg) + ". 8 players: health " + times(b.hp) + ", damage " + times(b.dmg) + "."; } },
    { k: "size", t: "Lobby size", icon: "team", o: [[2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7"], [8, "8"]],
      sub: function (r) { return "Up to " + r.size + " players" + (members().length >= r.size ? "  ·  full" : ""); },
      d: function (r) { var n = members().length; return "Sets how many players the lobby takes, you included. Anyone past " + r.size + " is turned away and the lobby list shows it as full. It can't go below the " + (n == 1 ? "one player" : n + " players") + " already here."; } },
    // Four Player 0.3.39: the fight runs through its rollback driver when the host picks it (fourfight.js reads rules.netcode)
    // the chips stay one word each and the sub stays short: a wider chip row runs over the sub line (window 3, 2026-11-07)
    { k: "netcode", t: "Netcode", icon: "swap", o: [["lockstep", "Lockstep"], ["rollback", "Rollback"]],
      sub: function (r) { return r.netcode == "rollback" ? "Your input plays at once (experimental)" : "Every game waits for every input"; },
      d: function (r) { return r.netcode == "rollback" ? "This mode is experimental. Your hero answers right away even at high ping. Now and then another hero or an enemy may snap a short distance. If the games ever disagree, a line in the fight log tells you. Please report it." : "Every game waits for every player's input before it moves on, so all games stay identical. At high ping your hero answers a little late."; } }
  ];
  var RULES_DEFAULT = { legacy: 1, legacyMax: 1, potCap: 0, crystals: 1, scale: 0, size: B.MAX, netcode: "lockstep" };
  S.rules = function () {
    var L = G.BB4L, r = L && L.run && L.run.rules ? L.run.rules : isHost() ? G.BB4_RULES : null, o = {};
    Object.keys(RULES_DEFAULT).forEach(function (k) { o[k] = r && r[k] != null ? r[k] : RULES_DEFAULT[k]; }); return o;
  };
  function rulesShort(r) {
    var out = [];
    if (!r.legacy) out.push("No Legacies"); else if (r.legacyMax != 1) out.push(r.legacyMax + " Legacies");
    if (r.potCap) out.push(r.potCap == "half" ? "Half Potentials" : "Potentials " + r.potCap);
    if (!r.crystals) out.push("No Mind Crystals");
    if (r.scale) out.push((r.scale == 2 ? "Strong" : "Light") + " scaling");
    if (r.size && r.size < B.MAX) out.push(r.size + " players");
    if (r.netcode == "rollback") out.push("Rollback");
    return out.join("  ·  ");
  }
  function ruleVal(R, r) { return R.get ? R.get(r) : r[R.k]; }
  function ruleIdx(R, r) { var v = ruleVal(R, r); for (var i = 0; i < R.o.length; i++) if (R.o[i][0] === v) return i; return 0; }
  // d: a step (left / right), or set: an option's index (a click)
  function setRule(j, d, set) {
    var R = RULES[j]; if (!R) return;
    if (!isHost()) { toast("Only the host sets the rules"); return; }
    var r = S.rules(); if (R.off && R.off(r)) return;
    var i = set != null ? set : clamp(ruleIdx(R, r) + d, 0, R.o.length - 1);
    if (R.o[i][0] === ruleVal(R, r)) return;
    if (R.k == "size" && R.o[i][0] < members().length) { toast(members().length + " players are already in the lobby"); return; }
    if (R.set) R.set(r, R.o[i][0]); else r[R.k] = R.o[i][0]; G.BB4_RULES = r;
    var L = G.BB4L, run = {}; Object.keys(L.run || {}).forEach(function (k) { run[k] = L.run[k]; }); run.rules = r; L.setRun(run);
    var row = S.rrows[j]; row.popAt = UE.Time.unscaledTime; row.pop = i;
    log("rules: " + JSON.stringify(r));
  }
  function spriteOf(a) { try { var s = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Sprite), a[0], a[1]); return s && !s.Equals(null) ? s : null; } catch (e) { return null; } }
  // The board has two pages, switched with the bumpers (LB / RB, Q / E) or a click on the title: the run's rules, and
  // the mod check (every mod hero in the lobby: the version each player has, and whether it can be played together).
  var STATUS = { ok: ["UI/Atlas/Fight/Fight", "IconDone"], bad: ["UI/Atlas/CommonMB/CommonMB", "Icon_Warning"] };
  function buildRules() {
    var rt = find(S.ui, "Rules"), bd = find(rt, "Board");
    S.rulesT = rt; S.rulesBoard = bd; S.rtab = "rules"; S.mtop = 0;
    S.rulesTitle = txt(bd, "T_Title", 52); S.rulesNote = txt(bd, "T_Note", 24, [0.75, 0.72, 0.82], null, 0);
    S.rulesWho = txt(bd, "T_Who", 26, [1, 0.8, 0.55], cs.TMPro.TextAlignmentOptions.Right);
    S.rulesDesc = txt(bd, "Desc/T_Desc", 25, [0.86, 0.84, 0.92], cs.TMPro.TextAlignmentOptions.Left, 0); S.rulesDesc.enableWordWrapping = true;
    S.rulesDesc.enableAutoSizing = true; S.rulesDesc.fontSizeMax = 25; S.rulesDesc.fontSizeMin = 16;
    var dn = find(bd, "Done"); S.rulesDone = { rt: dn.GetComponent(T(UE.RectTransform)), on: comp(dn, "On", UI.Image), t: txt(dn, "T_Label", 30, null, cs.TMPro.TextAlignmentOptions.Center) };
    S.rulesDone.t.text = "Done";
    S.titleRt = find(bd, "T_Title").GetComponent(T(UE.RectTransform));
    var tpl = find(bd, "Row0/Slide/Opts/Opt"); tpl.gameObject.SetActive(false);
    S.statusSp = { ok: spriteOf(STATUS.ok), bad: spriteOf(STATUS.bad) };
    function chip(row, name) {
      var g = UE.Object.Instantiate(tpl.gameObject, row.opts, false); g.SetActive(true); g.name = name;
      var c = { rt: g.GetComponent(T(UE.RectTransform)), on: comp(g.transform, "On", UI.Image), off: comp(g.transform, "Off", UI.Image), glow: comp(g.transform, "Glow", UI.Image),
                star: comp(g.transform, "Star", UI.Image), t: txt(g.transform, "T_Opt", 26, null, cs.TMPro.TextAlignmentOptions.Center) };
      c.rt.anchorMin = c.rt.anchorMax = new UE.Vector2(1, 0.5); c.rt.pivot = new UE.Vector2(1, 0.5); return c;
    }
    S.rrows = [];
    for (var i = 0; i < 6; i++) {
      var tr = find(bd, "Row" + i), sl = find(tr, "Slide"), R = RULES[i];
      var row = { tr: tr, rt: tr.GetComponent(T(UE.RectTransform)), cg: sl.GetComponent(T(UE.CanvasGroup)), on: comp(sl, "On", UI.Image), glow: comp(sl, "Glow", UI.Image),
                  sweep: comp(sl, "Mask/Sweep", UI.Image), icon: comp(sl, "Socket/HMask/Icon", UI.Image), opts: find(sl, "Opts"),
                  chev: [comp(sl, "ChevL", UI.Image), comp(sl, "ChevR", UI.Image)], chips: [], pchips: [], lit: 0, sweepAt: -9, popAt: -9 };
      row.name = txt(sl, "T_Name", 34); row.sub = txt(sl, "T_Sub", 21, [0.72, 0.7, 0.8], null, 0);
      row.name.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis; row.sub.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
      row.name.rectTransform.sizeDelta = new UE.Vector2(520, 52); row.sub.rectTransform.sizeDelta = new UE.Vector2(520, 34);   // one line's full height, or the ellipsis hides it all
      if (R) {
        row.ruleIcon = spriteOf(ICON[R.icon]); if (!row.ruleIcon) log("rules: no icon " + ICON[R.icon][1]);
        var x = 0;
        for (var j = R.o.length - 1; j >= 0; j--) {                   // the chips, right to left, each as wide as its label
          var c = chip(row, "Opt" + j);
          c.t.text = R.o[j][1]; var w = Math.max(R.o.length > 4 ? 62 : 84, c.t.GetPreferredValues(R.o[j][1]).x + (R.o.length > 4 ? 30 : 46));
          c.rt.sizeDelta = new UE.Vector2(w, 52); c.rt.anchoredPosition = new UE.Vector2(-x, 0); x += w + 8;
          row.chips[j] = c;
        }
        row.width = x - 8;
      }
      for (var p = 0; p < 8; p++) {                                       // the mod check: a chip per player, P1 at the left
        var pc = chip(row, "Player" + p); pc.rt.sizeDelta = new UE.Vector2(54, 52); pc.rt.anchoredPosition = new UE.Vector2(-(7 - p) * 58, 0);
        pc.t.fontSize = 22; row.pchips.push(pc);
      }
      row.i = i; S.rrows[i] = row;
    }
    // The prefab spaces its six rows for five (RowY: 620 - 98 i, 96 high), so a sixth sits on the description panel
    // (centre 96, 112 high). With six rules the rows close up and rise: the top edge goes from 668 to 688 (T_Note starts
    // at 705), every row is scaled 0.84 and stepped 82, so the sixth ends at 196, 44 px over the panel's top at 152. The
    // board's slant drops each row's right end, so the focused sixth row needs that room: 0.86 from 668 sat on the panel,
    // and 0.84 from 668 still dipped onto it at the right (window 3, 2026-11-07). Each row slides along the board's lean
    // (120 px across its 820 px height) as it moves, so the column keeps its slant.
    if (RULES.length > 5) {
      var s6 = 0.84;
      S.rrows.forEach(function (w, i) {
        var p = w.rt.anchoredPosition, ny = 688 - 48 * s6 - 98 * s6 * i;
        w.rt.anchoredPosition = new UE.Vector2(p.x + 120 * (ny - p.y) / 820, ny); w.rt.localScale = new UE.Vector3(s6, s6, 1);
      });
    }
    rt.gameObject.SetActive(false); S.rulesOpen = false;
  }
  // the lobby's mod heroes, the ones in play first, then the ones that cannot be played together, then the rest
  function modList() {
    var L = G.BB4L, ms = members(), seen = {}, out = [];
    function add(id) { if (!id || id < 190000 || seen[id]) return; seen[id] = 1; out.push(L.heroCheck(id, ms)); }
    ms.forEach(function (m) { add(m.hero); });
    var mine = L.myMods ? L.myMods().h : {}; Object.keys(mine).forEach(function (k) { add(+k); });
    ms.forEach(function (m) { if (m.mods && m.mods.h) Object.keys(m.mods.h).forEach(function (k) { add(+k); }); });
    var inPlay = {}; ms.forEach(function (m) { inPlay[m.hero] = 1; });
    out.forEach(function (c, i) { c.order = (inPlay[c.id] ? 0 : 2) + (c.ok ? 1 : 0) + i / 1000; c.inPlay = !!inPlay[c.id]; });
    return out.sort(function (a, b) { return a.order - b.order; });
  }
  function heroLabel(c) { var L = G.BB4L, n = L.heroName(c.id); if (!n) c.who.forEach(function (w) { if (!n && w.m.hero == c.id && w.m.hname) n = B.safe(w.m.hname, 40); }); return n || "Hero " + c.id; }
  function pname(m) { return m.id == meId() ? "you" : B.safe(m.name || m.id, 32); }
  // what is wrong, in a line (cards and the row under the name) and in full (the description strip, toasts)
  S.whyShort = function (c) { return c.ok ? "v" + c.ver + "  ·  on every PC" : c.missing.length ? "missing on " + c.missing.length + (c.missing.length == 1 ? " PC" : " PCs") : c.differ.length ? "versions differ" : "waiting for every player's mod list"; };
  S.whyLong = function (c) {
    var name = heroLabel(c), ref = c.who.filter(function (w) { return w.st == "ref" || w.st == "same"; })[0];
    if (c.ok) return name + " v" + c.ver + " is on every PC: it can be picked.";
    var parts = [];
    var have = c.who.filter(function (w) { return w.st != "missing" && w.st != "unknown"; });
    if (c.missing.length > 3 && have.length <= 2) parts.push("only " + have.map(function (w) { return pname(w.m); }).join(" and ") + (have.length == 1 && have[0].m.id != meId() ? " has" : " have") + " it");
    else if (c.missing.length) parts.push(c.missing.map(pname).join(", ") + (c.missing.length == 1 && c.missing[0].id != meId() ? " doesn't" : " don't") + " have it");
    c.who.filter(function (w) { return w.st == "differ"; }).forEach(function (w) { parts.push(pname(w.m) + " " + (w.m.id == meId() ? "have " : "has ") + (w.ver == (ref && ref.ver) ? w.ver + " built differently" : w.ver)); });
    if (c.unknown.length) parts.push(c.unknown.map(pname).join(", ") + ": no mod list yet");
    var fix = c.who.filter(function (w) { return w.st == "missing" || w.st == "differ"; }).map(function (w) { return pname(w.m) + ": " + G.BB4L.fixFor(c, w); });
    return name + " can't be picked: " + parts.join("; ") + "." + (fix.length && fix.length <= 3 ? " " + fix.join("; ") + "." : ref ? " Everyone needs v" + ref.ver + "." : "");
  };
  function openRules(tab) { S.rulesOpen = true; S.rtab = tab || "rules"; S.rcur = 0; S.mtop = 0; S.rulesT.gameObject.SetActive(true); S.rrows.forEach(function (w) { w.lit = 0; w.focWas = null; }); }
  S.openRules = openRules; S.openShop = function () { openShop(); }; S.openHeat = function () { openHeat(); };
  function closeRules() { S.rulesOpen = false; if (S.rulesT) S.rulesT.gameObject.SetActive(false); }
  S.rtabSwitch = function () { S.rtab = onlineTab() ? (S.rtab == "online" ? "sessions" : "online") : S.rtab == "rules" ? "mods" : "rules"; S.rcur = 0; S.mtop = 0; S.rrows.forEach(function (w) { w.focWas = null; w.sweepAt = UE.Time.unscaledTime + w.i * 0.03; }); };
  // players on different Terminal packages, said once in the Mod check header (the heroes may still all match)
  S.termSplit = function (ms) {
    var L = G.BB4L, hostM = ms.filter(function (m) { return m.host; })[0] || ms[0], ht = hostM ? L.terminalOf(hostM) : null;
    if (!ht) return "";
    var off = ms.filter(function (m) { var t = L.terminalOf(m); return t && t.b != ht.b; });
    return off.length ? (off.length == 1 ? pname(off[0]) + " is on " + L.terminalName(L.terminalOf(off[0])) : off.length + " players on other Terminals") : "";
  };
  S.rcount = function () { return onlineTab() ? S.ocount() : S.rtab == "legacy" ? (S.pick && S.pick.list ? S.pick.list.length : 0) : S.rtab == "rules" ? RULES.length : (S.mlist || []).length; };
  function lightRow(row, foc, dis, t) {
    if (foc && row.focWas !== true) row.sweepAt = t;                    // the light crosses the row it lands on
    row.focWas = foc;
    row.lit += ((foc ? 1 : 0) - row.lit) * 0.3;
    setA(row.on, row.lit * (dis ? 0.5 : 1)); setA(row.glow, foc ? 0.55 + 0.25 * Math.sin(t * 4) : row.lit * 0.5);
    var u = (t - row.sweepAt) / (14 * F), sp = row.sweep.rectTransform, p = sp.anchoredPosition;
    p.x = -200 + 1560 * ease(u); sp.anchoredPosition = p; setA(row.sweep, u >= 0 && u <= 1 ? 0.7 * Math.sin(Math.PI * u) : 0);
    row.cg.alpha = dis ? 0.45 : 1;                                       // the open clip fades the rows in; this only dims a disabled one
  }
  var INK = new UE.Color(0.08, 0.06, 0.1, 1);
  function drawRules() {
    if (!S.rulesOpen) return;
    if (onlineTab()) { drawOnline(); return; }
    if (S.rtab == "legacy") { if (!S.pick || S.pick.step == "hero") { closeRules(); return; } drawLegacy(); return; }
    var r = S.rules(), host = isHost(), ms = members(), n = Math.max(2, ms.length), t = UE.Time.unscaledTime;
    var hostM = ms.filter(function (m) { return m.host; })[0], mods = S.rtab == "mods";
    S.mlist = modList();
    var bad = S.mlist.filter(function (c) { return !c.ok; }).length;
    S.rulesTitle.text = mods ? "MOD CHECK" : "RUN RULES";
    S.rulesNote.text = (mods ? "<color=#8a8698>Run rules</color>   <color=#ffd27a><u>Mod check</u></color>" : "<color=#ffd27a><u>Run rules</u></color>   <color=#8a8698>Mod check" + (bad ? "  (" + bad + ")" : "") + "</color>");
    S.rulesWho.text = mods ? (bad ? "<color=#ff7a7a>" + bad + (bad == 1 ? " hero can't" : " heroes can't") + " be played together</color>" : "Every mod hero matches" + (S.termSplit(ms) ? "  ·  <color=#ffbf4d>" + S.termSplit(ms) + "</color>" : "")) :
      host ? "You set the rules" : "Set by " + (hostM ? B.safe(hostM.name || hostM.id, 32) : "the host");
    var cnt = S.rcount();
    if (mods && S.rfocusHero) { S.mlist.forEach(function (c, i) { if (c.id == S.rfocusHero) S.rcur = i; }); S.rfocusHero = 0; }
    if (mods && S.rcur < cnt) { if (S.rcur < S.mtop) S.mtop = S.rcur; if (S.rcur > S.mtop + 4) S.mtop = S.rcur - 4; }
    S.rrows.forEach(function (row, i) {
      var k = mods ? S.mtop + i : i, show = k < cnt && i < (mods ? 5 : 6);   // the mod check pages five at a time; the rules show all six
      row.tr.gameObject.SetActive(show); if (!show) return;
      var foc = S.rcur == k;
      row.chips.forEach(function (c) { c.rt.gameObject.SetActive(!mods); });
      row.pchips.forEach(function (c, p) { c.rt.gameObject.SetActive(mods && p < ms.length); });
      if (!mods) {
        var R = RULES[k], dis = !!(R.off && R.off(r)), sel = ruleIdx(R, r);
        lightRow(row, foc, dis, t);
        row.name.rectTransform.sizeDelta = new UE.Vector2(520, 52); row.sub.rectTransform.sizeDelta = new UE.Vector2(520, 34);
        row.name.text = R.t; row.sub.text = R.sub(r, n); row.sub.color = new UE.Color(0.72, 0.7, 0.8, 1);
        if (row.ruleIcon && row.ik != "rule") { row.icon.sprite = row.ruleIcon; row.ik = "rule"; } setA(row.icon, row.ruleIcon ? 1 : 0); row.icon.color = new UE.Color(1, 0.86, 0.62, 1);
        row.chips.forEach(function (c, j) {
          var on = j == sel, pu = row.pop == j ? (t - row.popAt) / (10 * F) : 2;
          setA(c.on, on ? 1 : 0); setA(c.glow, on && foc && host && !dis ? 0.6 + 0.4 * Math.sin(t * 5) : 0);
          c.t.color = on ? INK : new UE.Color(1, 1, 1, foc ? 0.95 : 0.7);
          var sc = pu < 1 ? 1 + 0.18 * (1 - ease(pu)) : 1; c.rt.localScale = new UE.Vector3(sc, sc, 1);
          var su = row.pop == j ? (t - row.popAt) / (12 * F) : 2;
          setA(c.star, su < 1 ? 1 - ease(su) : 0); var ss = 0.4 + 0.9 * ease(Math.min(1, su)); c.star.rectTransform.localScale = new UE.Vector3(ss, ss, 1);
        });
        // the arrows either side of the chips on the focused row (only when the host can change it)
        var arrows = foc && host && !dis, ox = row.opts.GetComponent(T(UE.RectTransform)).anchoredPosition.x, bob = 3 * Math.sin(t * 6);
        row.chev.forEach(function (c, s) { setA(c, arrows ? 1 : 0); var rr = c.rectTransform, q = rr.anchoredPosition; q.x = s ? ox + 22 + bob : ox - row.width - 22 - bob; rr.anchoredPosition = q; });
        return;
      }
      // the mod check: the hero, its version or what is wrong, and a chip per player (lit: same version; red: missing; amber: other version)
      var c = S.mlist[k];
      lightRow(row, foc, false, t);
      row.chev.forEach(function (ch) { setA(ch, 0); });
      row.name.text = heroLabel(c);
      row.sub.text = (c.inPlay ? "<color=#ffd27a>IN PLAY</color>  ·  " : "") + S.whyShort(c); row.sub.color = c.ok ? new UE.Color(0.56, 0.89, 0.6, 1) : new UE.Color(1, 0.48, 0.45, 1);
      var sp = c.ok ? S.statusSp.ok : S.statusSp.bad, ik = c.ok ? "ok" : "bad"; if (sp && row.ik != ik) { row.icon.sprite = sp; row.ik = ik; }
      setA(row.icon, sp ? 1 : 0); row.icon.color = c.ok ? new UE.Color(0.6, 0.95, 0.65, 1) : new UE.Color(1, 0.45, 0.4, 0.75 + 0.25 * Math.sin(t * 5));
      var shift = (8 - ms.length) * 58;                                  // the chips sit at the right whatever the count
      var nw = 1126 - ms.length * 58 - 146 - 18; row.name.rectTransform.sizeDelta = new UE.Vector2(nw, 52); row.sub.rectTransform.sizeDelta = new UE.Vector2(nw, 34);
      row.pchips.forEach(function (pc, p) {
        if (p >= ms.length) return;
        var w = c.who.filter(function (x) { return x.m.id == ms[p].id; })[0], st = w ? w.st : "unknown";
        var q = pc.rt.anchoredPosition; q.x = -(7 - p) * 58 + shift; pc.rt.anchoredPosition = q;
        pc.t.text = "P" + (p + 1);
        var good = st == "same" || st == "ref";
        var amber = st == "differ";
        if (!pc.onCol) pc.onCol = pc.on.color; pc.on.color = amber ? new UE.Color(1, 0.62, 0.18, 1) : pc.onCol;   // the art's own gold, kept
        setA(pc.on, good || amber ? 1 : 0); setA(pc.glow, 0); setA(pc.star, 0);
        pc.off.color = st == "missing" ? new UE.Color(1, 0.35, 0.35, 1) : st == "differ" ? new UE.Color(1, 0.75, 0.3, 1) : new UE.Color(1, 1, 1, 1);
        pc.t.color = good || amber ? INK : st == "missing" ? new UE.Color(1, 0.5, 0.48, 1) : new UE.Color(1, 1, 1, 0.5);
      });
    });
    var dfoc = S.rcur >= cnt;
    setA(S.rulesDone.on, dfoc ? 1 : 0); S.rulesDone.t.color = dfoc ? INK : new UE.Color(1, 1, 1, 1);
    if (dfoc) S.rulesDesc.text = mods ? "Back to the lobby." : host ? "Back to the lobby. Everyone already sees these rules." : "Back to the lobby.";
    else if (!mods) S.rulesDesc.text = RULES[S.rcur].d(r, n);
    else {
      var c = S.mlist[S.rcur];
      S.rulesDesc.text = S.whyLong(c) + "\n<size=85%><color=#ffd27a>Gold</color><color=#a7a3b5>: has this version    </color><color=#ff6a66>Red</color><color=#a7a3b5>: doesn't have it    </color><color=#ff9e2e>Amber</color><color=#a7a3b5>: another version</color></size>";
    }
    if (!cnt && mods) S.rulesDesc.text = "Nobody in the lobby has a mod hero. Mod heroes show here with the version each player has.";
  }


  // ---- the online page: the board before a lobby (Soulve, 2026-10-17: "its own unique custom ui just like you did for
  // character select"; "a button that says see all active sessions and it shows ping and all the visuals and
  // information ... and you can try to join them"; "rejoin last lobby button with visuals showing you whos in the last
  // lobby you were in what charcters and if you can join or not"). Two pages, switched like the rules board's:
  // Online (rejoin, all sessions, host, quick join, join by player ID) and Sessions (every open lobby, ping first) ----
  S.refreshList = function () {
    var L = G.BB4L; if (!L || !L.listAll || S.listBusy) return;
    S.listBusy = true; S.listAsked = UE.Time.unscaledTime;
    try { L.listAll(function (out, err) { S.listBusy = false; S.slist = out || []; S.slistAt = UE.Time.unscaledTime; S.listErr = err || ""; }); }
    catch (e) { S.listBusy = false; S.listErr = "the lobby list failed"; log("sessions list: " + es(e)); }
  };
  function onlineTab() { return S.rtab == "online" || S.rtab == "sessions"; }
  function lastEntry(la) { if (!la) return null; return (S.slist || []).filter(function (e) { return la.local ? e.local && e.code == la.code : !e.local && e.sid == la.sid; })[0] || null; }
  function pingText(e) {
    if (e.local) return "this PC";
    if (e.ping == null) return "<color=#8a8698>ping ?</color>";
    return "<color=#" + (e.ping < 60 ? "8fe39a" : e.ping < 120 ? "ffd27a" : e.ping < 200 ? "ff9e2e" : "ff6a66") + ">" + e.ping + " ms</color>";
  }
  function lobbyLine(e) {
    var r = e.run, L = G.BB4L;
    return (r && r.mode ? B.safe(r.mode, 16) + " · Entropy " + (r.level | 0) + "  ·  " : "") + (e.started ? (e.rejoin ? "<color=#8fe39a>In battle · can rejoin</color>" : "<color=#ff6a66>In battle</color>") : "In the lobby") +
      "  ·  " + e.n + " / " + (e.max || B.MAX) + "  ·  " + pingText(e) + (e.ver && e.ver != L.VER ? "  ·  <color=#ff7a7a>v" + B.safe(e.ver, 16) + "</color>" : "");
  }
  function whoLine(who) {
    var L = G.BB4L;
    return (who || []).map(function (w) { var nm = B.safe(w.name, 24); return (w.host ? "<color=#ffd27a>" + nm + " (host)</color>" : nm) + ": " + (B.safe(w.hname, 40) || L.heroName(w.hero) || (w.hero ? "Hero " + (w.hero | 0) : "picking a hero")); }).join("    ·    ") || "Nobody listed yet.";
  }
  function hostOf(who) { return (who || []).filter(function (w) { return w.host; })[0] || (who || [])[0] || null; }
  function joinEntry(e) {
    var L = G.BB4L, why = L.whyNot(e);
    if (why) { toast("Can't join: " + why); return; }
    S.slistAt = 0; L.joinListed(e); toast("Joining " + (B.safe(e.name, 48) || "the lobby") + "..."); log("joining " + (e.local ? "lobby " + e.code : "Steam lobby " + e.sid) + " from the online page");
  }
  function onlineHero() { try { var O = G.BB4ON, h = O && O.myHero ? O.myHero() : 0; if (h && G.BB4L) G.BB4L.setHero(h); } catch (e) {} }
  function onlineRows() {
    var L = G.BB4L, la = L.last ? L.last() : null, le = lastEntry(la), n = (S.slist || []).length, rows = [];
    var lwhy = le ? L.whyNot(le) : "";
    rows.push({ k: "last", head: la ? (hostOf(le ? le.who : la.who) || {}).hero : 0, who: le ? le.who : la ? la.who : [],
      t: la ? "Rejoin " + (la.host || "your last") + "'s lobby" : "Rejoin last lobby",
      sub: !la ? "You haven't been in a lobby yet" : !S.slistAt ? "Looking for it..." : !le ? "<color=#ff7a7a>Closed and empty now</color>" : lobbyLine(le) + (lwhy ? "  ·  <color=#ff7a7a>" + lwhy + "</color>" : "  ·  <color=#8fe39a>can join</color>"),
      dis: !(le && !lwhy), act: function () { if (le) joinEntry(le); else toast(la ? "That lobby has closed" : "No last lobby yet"); },
      d: la ? whoLine(le ? le.who : la.who) + (le ? "" : "\n<color=#8a8698>Who was there when you left.</color>") : "The lobby you were in last shows here: who is in it now, their heroes, and whether you can join." });
    var open = (S.slist || []).filter(function (e) { return !L.whyNot(e); }).length;
    rows.push({ k: "all", icon: "potential", t: "See all active sessions" + (S.slistAt ? "  (" + n + ")" : ""),
      sub: !S.slistAt ? "Asking Steam..." : n ? n + (n == 1 ? " lobby" : " lobbies") + "  ·  " + open + " you can join" : "No open lobbies right now",
      act: function () { S.rtab = "sessions"; S.rcur = 0; S.mtop = 0; S.refreshList(); S.rrows.forEach(function (w) { w.focWas = null; w.sweepAt = UE.Time.unscaledTime + w.i * 0.03; }); },
      d: "Lists every open Four Player lobby with its host, who is in it with their heroes, the mode and Entropy, whether it is in battle, and your ping to the host." });
    rows.push({ k: "host", head: L.me && L.me.hero, t: "Host a lobby", sub: "Friends join with your Steam invite, your lobby code or your player ID",
      act: function () { onlineHero(); L.hostLobby(); toast("Making your lobby..."); }, d: "Opens a lobby for up to " + B.MAX + " players with you as the host. You pick the mode, the Entropy and the rules." });
    rows.push({ k: "find", icon: "swap", t: "Quick join", sub: "Joins the fullest open lobby, or hosts one if there is none",
      act: function () { onlineHero(); L.find(); toast("Looking for a lobby..."); }, d: "Joins the open lobby with the most players at your version. If there is none, you host one." });
    if (!L.local) rows.push({ k: "id", icon: "inherit", t: "Join by player ID", sub: L.aceId() ? "Your player ID: " + L.aceId() : "Type a friend's player ID",
      act: async function () { onlineHero(); L.asking = true; var id = ""; try { id = await L.askId(); } finally { L.asking = false; } if (id) { L.joinById(id); toast("Looking for player " + id + "'s lobby..."); } },
      d: "Type the player ID from your friend's profile to join the lobby they host." + (L.aceId() ? " Yours is " + L.aceId() + "." : "") });
    return rows;
  }
  S.ocount = function () { return S.rtab == "sessions" ? (S.slist || []).length : (S.orows || onlineRows()).length; };
  var HEADS = {};
  function headSprite(id) { if (!id || soonOf(id)) return null; if (HEADS[id] !== undefined) return HEADS[id]; return (HEADS[id] = spriteOf(["UI/Atlas/EvoCharacter/EvoCharacter", "HeroHead_" + id])); }
  function initials(w) { var n = w.hname || G.BB4L.heroName(w.hero) || ""; n = n.replace(/[^A-Za-z0-9 ]/g, "").trim(); var p = n.split(/\s+/); return (p.length > 1 && p[0].length <= 3 ? p[1] : p[0] || "?").slice(0, 2); }
  function drawOnline() {
    var L = G.BB4L, t = UE.Time.unscaledTime, ses = S.rtab == "sessions";
    if (S.listBusy && t - S.listAsked > 10) { S.listBusy = false; S.listErr = "Steam did not answer"; }
    if (!S.listBusy && (!S.slistAt || t - S.slistAt > 5)) S.refreshList();
    var rows = ses ? (S.slist || []) : onlineRows(); if (!ses) S.orows = rows;
    var cnt = rows.length, n = (S.slist || []).length;
    S.rulesTitle.text = ses ? "ALL SESSIONS" : "ONLINE";
    S.rulesNote.text = ses ? "<color=#8a8698>Online</color>   <color=#ffd27a><u>Sessions (" + n + ")</u></color>" : "<color=#ffd27a><u>Online</u></color>   <color=#8a8698>Sessions" + (S.slistAt ? " (" + n + ")" : "") + "</color>";
    S.rulesWho.text = L.note ? "<color=#ffbf4d>" + L.note + "</color>" : L.state == "joining" || L.state == "searching" || L.state == "creating" ? "<color=#ffd27a>" + L.status() + "...</color>" :
      S.listErr ? "<color=#ff7a7a>" + S.listErr + "</color>" : !S.slistAt ? "Asking Steam for open lobbies..." : (L.local ? "Lobbies on this PC" : "Updated every 5 s");
    S.rulesDone.t.text = ses ? "Back" : "Close";
    if (S.rcur < cnt) { if (S.rcur < S.mtop) S.mtop = S.rcur; if (S.rcur > S.mtop + 4) S.mtop = S.rcur - 4; }
    S.rrows.forEach(function (row, i) {
      var k = S.mtop + i, show = k < cnt && i < 5;
      row.tr.gameObject.SetActive(show); if (!show) return;
      var foc = S.rcur == k, it = rows[k], who = it.who || [], np = Math.min(8, who.length), chips = ses || it.k == "last";
      var why = ses ? L.whyNot(it) : "", dis = ses ? !!why : !!it.dis;
      lightRow(row, foc, dis && !foc, t);
      row.chips.forEach(function (c) { c.rt.gameObject.SetActive(false); }); row.chev.forEach(function (ch) { setA(ch, 0); });
      row.pchips.forEach(function (c, p) { c.rt.gameObject.SetActive(chips && p < np); });
      var nw = chips && np ? 1126 - np * 58 - 146 - 18 : 940; row.name.rectTransform.sizeDelta = new UE.Vector2(nw, 52); row.sub.rectTransform.sizeDelta = new UE.Vector2(nw, 34);
      row.name.text = ses ? (B.safe(it.name, 48) || "Lobby") + "   <size=70%><color=#a7a3b5>" + B.safe(it.code, 8) + "</color></size>" : it.t;
      row.sub.text = ses ? lobbyLine(it) + (why ? "  ·  <color=#ff7a7a>" + why + "</color>" : "") : it.sub;
      row.sub.color = new UE.Color(0.72, 0.7, 0.8, 1);
      // the icon: the host's hero head (a lobby, the last lobby, hosting with your hero), else the row's own sign
      var hid = ses ? (hostOf(who) || {}).hero : it.head, sp = headSprite(hid), ik = "h" + hid;
      if (!sp && it.icon) { sp = spriteOf(ICON[it.icon]); ik = it.icon; }
      if (sp && row.ik != ik) { row.icon.sprite = sp; row.ik = ik; }
      setA(row.icon, sp ? 1 : 0); row.icon.color = sp && ik.charAt(0) == "h" ? new UE.Color(1, 1, 1, 1) : new UE.Color(1, 0.86, 0.62, 1);
      // a chip per player in the hero's colour, with the hero's first letters; the host's is outlined in gold
      var shift = (8 - np) * 58;
      row.pchips.forEach(function (pc, p) {
        if (!chips || p >= np) return;
        var w = who[p], c = w.hcol && w.hcol.length == 3 ? w.hcol : S.colourOf(w.hero, 0);
        var q = pc.rt.anchoredPosition; q.x = -(7 - p) * 58 + shift; pc.rt.anchoredPosition = q;
        if (!pc.onCol) pc.onCol = pc.on.color;
        pc.on.color = col(c, 1); setA(pc.glow, 0); setA(pc.star, 0);
        pc.off.color = w.host ? new UE.Color(1, 0.85, 0.45, 1) : new UE.Color(1, 1, 1, 0.6);
        pc.t.text = w.hero ? initials(w) : "?"; pc.t.color = new UE.Color(1, 1, 1, 1);
      });
    });
    var dfoc = S.rcur >= cnt;
    setA(S.rulesDone.on, dfoc ? 1 : 0); S.rulesDone.t.color = dfoc ? INK : new UE.Color(1, 1, 1, 1);
    if (dfoc) S.rulesDesc.text = ses ? "Back to the online page." : "Close the online screen.";
    else if (!ses) S.rulesDesc.text = rows[S.rcur].d;
    else { var e = rows[S.rcur], wy = L.whyNot(e); S.rulesDesc.text = whoLine(e.who) + "\n" + (wy ? "<color=#ff7a7a>Can't join: " + wy + ".</color>" : "<color=#8fe39a>Press A to join.</color>") + (e.started && !wy ? "<color=#a7a3b5>  The run is on: you play from the next one.</color>" : ""); }
    if (ses && !cnt) S.rulesDesc.text = S.slistAt ? "No Four Player lobbies are open right now. Host one from the online page." : "Asking Steam for open lobbies...";
  }
  S.openOnline = function (tab) {
    try {
      if (!S.root || S.root.Equals(null)) build();
      S.open(); S.onlinePage = true; S.slistAt = 0; S.listErr = "";
      openRules(tab || "online"); S.rcur = 0;
      log("online page open");
    } catch (e) { log("online page: " + es(e)); }
  };

  // ---- the hero pick on the player's own card (Soulve, 2026-10-17: "press a to enter scroll up and down mode to
  // select them that way and then press b to exit out"). Works anywhere in the lobby, also for a player who joined
  // during a run. Heroes this PC owns only: a DLC hero not bought stays out (AU.IsDlcLock), the skin is the player's own ----
  function heroList() {
    if (S.heroes && S.heroes.length) return S.heroes;
    // the new select (2026-10-20): every hero, owned or not, in the game's order; a locked one shows its lock and condition
    if (G.BB4SEL) { var all = G.BB4SEL.list(); if (all.length) return (S.heroes = all); }
    var out = [], seen = {};
    try {
      var X = require("Gen/Xlsx").Xlsx, AU = require("Core/ActorUtil").default;
      X.HeroConfig.All.forEach(function (h) {
        var id = h.id; if (seen[id] || !X.BaseActorConf.Get(id)) return; seen[id] = 1;
        var locked = true; try { locked = !!AU.IsDlcLock(id); } catch (e) {}
        if (!locked) out.push(id);
      });
    } catch (e) { log("hero list: " + es(e)); }
    out.sort(function (a, b) { return a - b; });
    return (S.heroes = out.length ? out : [100101]);
  }
  function skinOf(id) { if (soonOf(id)) return 0; try { return require("GamePlay/AvatarUtil").SkinUtil.GetCurrentSkinId(id) | 0; } catch (e) { return 0; } }
  function inMindTraining() { var E = G.BB4E; return !!(E && E.shown && Date.now() - E.shown < 1500); }
  // the steps: the hero, then Legacy I and Legacy II from the player's saved Evotypes when the lobby's rules allow them
  // (the stock Evotype screen waited on 91Act's servers at "Completing Preparation": Nocturn's clip, 2026-10-18)
  function evoOf(ev) { return ev ? { id: ev.id, uid: ev.uid, score: ev.score | 0, inheritBlesses: (ev.inheritBlesses || []).map(function (b) { return { id: b.id, quality: b.quality }; }), inheritSkillIndex: ev.inheritSkillIndex | 0, inheritSkillLevel: ev.inheritSkillLevel | 0 } : null; }
  S.evoRaw = S.evoRaw || {}; var EVOBUILD = {};
  function evoBuild(uid) {   // the whole build of an Evotype: its tactics as {id, quality}
    if (EVOBUILD[uid]) return EVOBUILD[uid]; var r = S.evoRaw[uid], out = [];
    try { (r && r.blesses || []).forEach(function (b) { if (b && b.id) out.push({ id: b.id, quality: b.quality }); }); } catch (e) {}
    return (EVOBUILD[uid] = out);
  }
  function evoOn() { return !!(G.BB4EVO && S.evo && S.pick && (S.pick.step == "evo1" || S.pick.step == "evo2")); }
  function evoList() {
    var out = [];
    try { require("DataBinding").DB.FesActor.Values().forEach(function (x) { if (x && x.server) { out.push(evoOf(x.server)); S.evoRaw[x.server.uid] = x.server; } }); } catch (e) { log("Evotypes: " + es(e)); }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function legacySlots() { var r = S.rules ? S.rules() : null; return !r || r.legacy ? Math.max(1, Math.min(2, (r && r.legacyMax) || 1)) : 0; }
  // the hero's own name; four-player's BB4L may be off, so read the locale row it reads (BaseActor_chs_<id>) directly
  function heroLabelOf(id) {
    var sq = soonOf(id); if (sq) return sq.name;
    var L = G.BB4L, n = L && L.heroName ? L.heroName(id) : "";
    if (!n) { try { var k = "BaseActor_chs_" + id, s = require("Core/Util").U.GetLocale(k); if (s && s != k && String(s).indexOf("_") !== 0) n = String(s); } catch (e) {} }
    return n || "Hero " + id;
  }
  function sortEvos(l, by) {
    var a = l.slice();
    if (by == "hero") a.sort(function (x, y) { var hx = heroLabelOf(x.id), hy = heroLabelOf(y.id); return hx < hy ? -1 : hx > hy ? 1 : y.score - x.score; });
    else a.sort(function (x, y) { return y.score - x.score; });
    return a;
  }
  // the hero is picked on the card; Legacy I and II on the board's Legacy list (below)
  function setStep(step) {
    var p = S.pick, l, i;
    if (step == "hero") {
      tabsOf(p);
      if (p.tab == null) { p.tab = 0; p.tabs.forEach(function (tb, k) { if (tb.ids.indexOf(p.hero) >= 0) p.tab = k; }); }
      l = p.tabs[p.tab].ids; i = l.indexOf(p.hero);
    }
    else {
      var other = step == "evo1" ? null : p.evo;
      // two Legacies: two heroes; and never the hero being played (the game's own Legacy screen refuses those:
      // SceneUIFesSelect sameAsSeed; GeokitFX, 2026-10-18: the list offered the hero's own Evotypes)
      l = [null].concat(sortEvos(p.evos.filter(function (e) { return e.id != p.hero && (!other || (e.uid != other.uid && e.id != other.id)); }), p.sort));
      var cur = step == "evo1" ? p.evo : p.evo2; i = 0;
      if (cur) for (var j = 1; j < l.length; j++) if (l[j].uid == cur.uid) i = j;
    }
    p.step = step; p.list = l; p.i = i < 0 ? 0 : i;
    if (step == "hero") { if (legacyTab()) closeRules(); }
    else {
      if (S.evo) { if (legacyTab()) closeRules(); return; }   // the Legacy selector (fourlobbyevo.js) takes the step
      if (!legacyTab()) openRules("legacy");
      S.rcur = p.i; S.mtop = Math.max(0, p.i - 2);
      S.rrows.forEach(function (w) { w.focWas = null; w.sweepAt = UE.Time.unscaledTime + w.i * 0.03; });
    }
  }

  // ---- the Legacy list (Ghostly, 2026-10-17: "I personally prefer being able to jus choose my legacy cuz ik some have
  // TONSSSSSSS of legacy"). Legacy I and II are picked on the board, five rows at a time: the hero's head, the score,
  // the kept boons (a chip per boon in its quality's colour) and the Legacy skill. Best score first or grouped by hero
  // (LB / RB); left and right jump to the next hero, or five rows. The card behind shows the one under the cursor ----
  function legacyTab() { return S.rulesOpen && S.rtab == "legacy"; }
  var BLESS = {};
  function blessName(id) { if (BLESS[id] !== undefined) return BLESS[id]; var s = ""; try { s = require("Core/ActorUtil").default.GetBlessName(id) || ""; } catch (e) {} return (BLESS[id] = String(s || "")); }
  var QCOL = { 1: [0.78, 0.78, 0.84], 2: [0.36, 0.66, 1], 3: [0.74, 0.46, 1], 4: [1, 0.78, 0.3], 5: [1, 0.42, 0.36] };
  function qcol(q) { return QCOL[q] || QCOL[1]; }
  function hexOf(c) { return c.map(function (v) { var h = Math.round(v * 255).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }
  function legacyMove(dx, dy) {
    var p = S.pick, l = p.list, cnt = l.length, nr = cnt + 1;
    function hid(j) { return l[j] ? l[j].id : 0; }
    if (dy) { S.rcur = (S.rcur + (dy > 0 ? -1 : 1) + nr) % nr; return; }
    if (!dx) return;
    if (S.rcur >= cnt) { S.rcur = dx > 0 ? 0 : cnt - 1; return; }
    if (p.sort != "hero") { S.rcur = clamp(S.rcur + dx * 5, 0, cnt - 1); return; }
    var j = S.rcur, h = hid(j);
    if (dx > 0) { while (j < cnt && hid(j) == h) j++; if (j >= cnt) j = 0; }
    else {
      var st = j; while (st > 0 && hid(st - 1) == h) st--;
      if (st < j) j = st;
      else { j = st - 1; if (j < 0) j = cnt - 1; var h2 = hid(j); while (j > 0 && hid(j - 1) == h2) j--; }
    }
    S.rcur = j;
  }
  function legacySort() {
    var p = S.pick, sel = p.list[S.rcur];
    p.sort = p.sort == "hero" ? "score" : "hero";
    setStep(p.step);
    var j = 0; if (sel) for (var k = 1; k < p.list.length; k++) if (p.list[k].uid == sel.uid) j = k;
    S.rcur = j; S.mtop = Math.max(0, j - 2);
  }
  function drawLegacy() {
    var p = S.pick, t = UE.Time.unscaledTime, l = p.list, cnt = l.length, two = p.step == "evo2", inUse = two ? p.evo2 : p.evo, by = p.sort == "hero";
    if (S.rcur < cnt) p.i = S.rcur;
    S.rulesTitle.text = two ? "LEGACY II" : "LEGACY I";
    S.rulesNote.text = by ? "<color=#8a8698>Best score</color>   <color=#ffd27a><u>By hero</u></color>" : "<color=#ffd27a><u>Best score</u></color>   <color=#8a8698>By hero</color>";
    S.rulesWho.text = (cnt - 1) + (cnt == 2 ? " Evotype" : " Evotypes") + "  ·  for " + heroLabelOf(p.hero) + (S.rcur < cnt ? "  ·  " + (S.rcur + 1) + " / " + cnt : "");
    S.rulesDone.t.text = "Back";
    if (S.rcur < cnt) { if (S.rcur < S.mtop) S.mtop = S.rcur; if (S.rcur > S.mtop + 4) S.mtop = S.rcur - 4; }
    S.rrows.forEach(function (row, i) {
      var k = S.mtop + i, show = k < cnt && i < 5;
      row.tr.gameObject.SetActive(show); if (!show) return;
      var ev = l[k], foc = S.rcur == k, kept = ev ? (ev.inheritBlesses || []) : [], np = Math.min(8, kept.length);
      var using = ev ? !!(inUse && ev.uid == inUse.uid) : !inUse;
      lightRow(row, foc, false, t);
      row.chips.forEach(function (c) { c.rt.gameObject.SetActive(false); }); row.chev.forEach(function (ch) { setA(ch, 0); });
      row.pchips.forEach(function (c, j) { c.rt.gameObject.SetActive(j < np); });
      var nw = np ? 1126 - np * 58 - 146 - 18 : 940; row.name.rectTransform.sizeDelta = new UE.Vector2(nw, 52); row.sub.rectTransform.sizeDelta = new UE.Vector2(nw, 34);
      row.name.text = ev ? heroLabelOf(ev.id) + "   <size=70%><color=#ffd27a>" + ev.score + "</color></size>" : "No Legacy";
      row.sub.text = (ev ? kept.length + (kept.length == 1 ? " boon kept" : " boons kept") + (ev.inheritSkillIndex ? "  ·  Legacy skill Lv " + (ev.inheritSkillLevel || 1) : "") : "Start the run without " + (two ? "a second one" : "one")) +
        (using ? "  ·  <color=#8fe39a>IN USE</color>" : "");
      row.sub.color = new UE.Color(0.72, 0.7, 0.8, 1);
      var sp = ev ? headSprite(ev.id) : null, ik = ev ? "h" + ev.id : "inherit";
      if (!sp) { sp = spriteOf(ICON.inherit); ik = "inherit"; }
      if (sp && row.ik != ik) { row.icon.sprite = sp; row.ik = ik; }
      setA(row.icon, sp ? 1 : 0); row.icon.color = ik.charAt(0) == "h" ? new UE.Color(1, 1, 1, 1) : new UE.Color(1, 0.86, 0.62, 1);
      var shift = (8 - np) * 58;
      row.pchips.forEach(function (pc, j) {
        if (j >= np) return;
        var q = pc.rt.anchoredPosition; q.x = -(7 - j) * 58 + shift; pc.rt.anchoredPosition = q;
        if (!pc.onCol) pc.onCol = pc.on.color;
        pc.on.color = col(qcol(kept[j].quality), 1); setA(pc.glow, 0); setA(pc.star, 0);
        pc.off.color = new UE.Color(1, 1, 1, 0.6); pc.t.text = "";
      });
    });
    var dfoc = S.rcur >= cnt;
    setA(S.rulesDone.on, dfoc ? 1 : 0); S.rulesDone.t.color = dfoc ? INK : new UE.Color(1, 1, 1, 1);
    if (dfoc) { S.rulesDesc.text = two ? "Back to Legacy I." : "Back to the hero."; return; }
    var e = l[S.rcur];
    if (!e) { S.rulesDesc.text = two ? "Play with Legacy I only." : "Start the run with no Legacy."; return; }
    var names = (e.inheritBlesses || []).map(function (b) { var nm = blessName(b.id); return nm ? "<color=#" + hexOf(qcol(b.quality)) + ">" + nm + "</color>" : ""; }).filter(function (x) { return x; });
    S.rulesDesc.text = heroLabelOf(e.id) + "  ·  score " + e.score + (e.inheritSkillIndex ? "  ·  Legacy skill Lv " + (e.inheritSkillLevel || 1) : "") + "\n" +
      (names.length ? names.slice(0, 10).join("<color=#8a8698>  ·  </color>") + (names.length > 10 ? "<color=#8a8698>  +" + (names.length - 10) + "</color>" : "") : "<color=#8a8698>No boons kept.</color>");
  }
  // ---- the character select (the lead, 2026-10-20: "lets make a new dedicated character select"). The loadout's hero
  // step has its own screen over the lobby: every hero as a grid of heads on the right, the one under the cursor on a
  // large card on the left in its colour, turning over to each new hero. Legacy I and II follow. fourlobby3d.js stands
  // it in depth. Since the same day it is also the game's own character select ("solo", over SceneUIHeroSelect through
  // fourselect.js): tabs on LB / RB for the game's heroes, EX, Bosses and Cross Effect, each with its own look made of
  // the game's own UI effects; heroes the player does not own show the game's lock crest and say how to get them; hold
  // A unlocks one the player can afford; Y opens the wardrobe (the hero in the room, every palette), Intel and Video are
  // the game's own ----
  // the grid's pitch (SEL_PX, SEL_PY) and cell size, the card's x, the tabs' row and spacing: the approved mockup's
  // layout (local_only/redux/v4shots/gpt/mock_hero), measured on the 2580 x 1080 canvas
  var SEL_COLS = 6, SEL_ROWS = 3, SEL_PX = 170, SEL_PY = 150, SEL_W = 156, SEL_H = 134, SEL_X = 415, SEL_Y = 8, CARD_X = -650,
      TAB_X = 434, TAB_DX = 235, TAB_Y = 305, HOLD_S = 1;
  // each tab's look: loop effects behind the card (x, y, scale), the burst when the tab comes in, the veil's colour
  // (a loop's fifth field "top" puts it over the card; tint: the card slab's colour, taken this far from the game's crimson)
  var TABFX = {
    heroes: { loop: [], intro: "UI/Common/choosediff_intro_501r", veil: [0.1, 0.02, 0.04], tint: [0.62, 0.06, 0.16, 0.85] },
    ex: { loop: [["UI/Common/role_selection_mastermode_003", 0, 0, 1, "top"], ["UI/Common/role_selection_mastermode_004", 0, 0, 1, "top"]],
          intro: "UI/Common/choosediff_intro_501w", veil: [0.11, 0.07, 0.02], tint: [1, 0.7, 0.22, 0.75] },
    boss: { loop: [["UI/Common/bossrushselectbgloop", 0, 0, 2.6]], intro: "UI/Common/choosediff_intro_501r", veil: [0.06, 0.02, 0.1], tint: [0.6, 0.28, 1, 0.75] },
    cross: { loop: [], intro: "UI/Common/choosediff_intro_501b", veil: [0.02, 0.06, 0.1], tint: [0.28, 0.66, 1, 0.75] }
  };
  function tabsOf(p) {
    if (p.tabs) return p.tabs;
    var X = G.BB4SEL, gs = X ? X.GROUPS : [{ key: "heroes", name: "HEROES", label: "Heroes", col: [0.92, 0.22, 0.3] }];
    var tabs = gs.map(function (g) { return { g: g, ids: [] }; });
    p.heroes.forEach(function (id) { tabs[X ? X.groupOf(id) : 0].ids.push(id); });
    // the roadmap's heroes join their group, after the ones in the game; a name the roster already holds is left out
    if (X && v5on()) { var have = {}; p.heroes.forEach(function (id) { have[String(heroLabelOf(id)).toLowerCase().replace(/[^a-z0-9]/g, "")] = 1; });
      SOON.list.forEach(function (q, i) { var k = q[1].toLowerCase().replace(/[^a-z0-9]/g, ""); if (have[k] || have[k.replace(/^ex/, "") + "ex"]) return; tabs.forEach(function (t) { if (t.g.key == q[3]) t.ids.push(990001 + i); }); }); }
    return (p.tabs = tabs.filter(function (t) { return t.ids.length; }));
  }
  // v5 (fourselect5.js) draws the solo select; this file keeps the cursor, the groups, the locks and the confirm. While it
  // is on, this screen's own picture is hidden and its particle effects (which no group dims) are not started
  function v5on() { try { return !!(G.BB4S5 && G.BB4S5.on && G.BB4S5.on(S)); } catch (e) { return false; } }
  function selCols() { return v5on() && !(G.BB4HL && G.BB4HL.on(S)) ? (G.BB4S5.colsNow ? G.BB4S5.colsNow() : G.BB4S5.cols || 4) : SEL_COLS; }
  // heroes on the published roadmap that are not in the game yet (the 2026 and 2027 sheets in docs/promo), as entries of
  // their group in the v5 select: a greyed head, their art on the stage, "Coming soon" (the lead, 2026-11-10). They are
  // locked for every path of this file (a lock of their own kind), have no head sprite, no voice, no stock windows, and
  // their ids (990001 and up) exist nowhere in the game. Art: files/art/soon/<key>.png (ui/make_soon_art.py)
  var SOON = S.SOON = { byId: {}, list: [
    ["oread", "Oread", 2026, "boss"], ["nan", "NaN", 2026, "boss", "UI/Texture/IconBoss/IconBoss_3566"], ["hakumen", "EX Hakumen", 2026, "ex"],
    ["party", "Kris, Susie & Ralsei", 2026, "cross"], ["arcueid", "Arcueid", 2026, "cross"], ["swiftmaster", "Swift Master", 2027, "cross"], ["yuzuriha", "Yuzuriha", 2027, "cross"],
    ["makoto", "Makoto", 2027, "cross"], ["dust", "Dust", 2027, "cross"], 
    ["celica", "Celica", 2027, "ex"], ["azrael", "Azrael", 2027, "ex"], ["izayoi", "Izayoi", 2027, "ex"], ["litchi", "Litchi", 2027, "ex"], ["arakune", "Arakune", 2027, "ex"],
    ["x", "Mega Man X", 2027, "cross"], ["bayonetta", "Bayonetta", 2027, "cross"], ["dante", "Dante", 2027, "cross"], ["vergil", "Vergil", 2027, "cross"], ["marie", "Marie", 2027, "cross"],
    ["2b", "2B", 2027, "cross"], ["a2", "A2", 2027, "cross"], ["ramlethal", "Ramlethal", 2027, "cross"], ["lucilius", "Lucilius", 2027, "cross"], ["nenmaster", "Nen Master", 2027, "cross"],
    ["gunvolt", "Gunvolt", 2027, "cross"], ["lilac", "Lilac", 2027, "cross"], ["neo", "Neo", 2027, "cross"], ["blake", "Blake", 2027, "cross"], ["yang", "Yang", 2027, "cross"],
    ["margaret", "Margaret", 2027, "cross"], ["protoman", "Proto Man", 2027, "cross"], ["aile", "Aile", 2027, "cross"], ["zero", "? ? ?", 2027, "cross"]] };
  SOON.list.forEach(function (q, i) { SOON.byId[990001 + i] = { id: 990001 + i, key: q[0], name: q[1], year: q[2], g: q[3], tex: q[4] || null }; });
  function soonOf(id) { return SOON.byId[id] || null; }
  var soonTex = S.soonTex = S.soonTex || {};
  function soonArt(q, head) {
    // a picture the game holds (NaN: her boss icon, the lead, 2026-11-10) before a file of ours
    if (!head && q.tex) { try { var gt = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Texture2D), q.tex); if (gt && !gt.Equals(null)) return gt; } catch (e) {} }
    var kk = (head ? headDir() : "") + q.key, t = soonTex[kk]; if (t && !t.Equals(null)) return t; if (t === 0) return null;
    try {
      var f = (B.ROOT || "") + "/mods/redux-menus/files/art/soon/" + kk + ".png"; if (!cs.System.IO.File.Exists(f)) { soonTex[kk] = 0; return null; }
      t = new UE.Texture2D(2, 2, UE.TextureFormat.RGBA32, false); UE.ImageConversion.LoadImage(t, cs.System.IO.File.ReadAllBytes(f));
      t.name = "soon_" + kk; t.wrapMode = UE.TextureWrapMode.Clamp; return (soonTex[kk] = t);
    } catch (e) { soonTex[kk] = 0; return null; }
  }
  // our own pictures for heroes the mods add (files/art/hero/<id>.png and head/<id>.png, ui/make_soon_art.py): the
  // stage picture where the game's is cut, stretched or a crest, and a head icon with the face in the middle
  // the head icons come as diamonds (the game's own shape; the base roster keeps its sprites) or as squares for
  // everyone, by the option "heads" (the lead, 2026-11-10: a toggle in Settings)
  function headSquare() { try { return B.opt("heads") == "square"; } catch (e) { return false; } }
  function headDir() { return headSquare() ? "headsq/" : "head/"; }
  function heroFile(id, head) {
    var kk = "hero/" + (head ? headDir() : "") + id, t = soonTex[kk]; if (t && !t.Equals(null)) return t; if (t === 0) return null;
    try {
      var f = (B.ROOT || "") + "/mods/redux-menus/files/art/" + kk + ".png"; if (!cs.System.IO.File.Exists(f)) { soonTex[kk] = 0; return null; }
      t = new UE.Texture2D(2, 2, UE.TextureFormat.RGBA32, false); UE.ImageConversion.LoadImage(t, cs.System.IO.File.ReadAllBytes(f));
      t.name = "hero_" + (head ? "head_" : "") + id; t.wrapMode = UE.TextureWrapMode.Clamp; return (soonTex[kk] = t);
    } catch (e) { soonTex[kk] = 0; return null; }
  }
  var LOCKS = {};
  function lockOf(id) { var sq = soonOf(id); if (sq) return { locked: true, soon: true, year: sq.year, why: "Coming in " + sq.year + ".", dlc: false, can: false }; if (!G.BB4SEL || !id) return null; var c = LOCKS[id]; if (c && now() - c.at < 1) return c.v; var v = G.BB4SEL.lockOf(id); LOCKS[id] = { v: v, at: now() }; return v; }
  // the game's UI effects mask with a stencil they never clear (role_selection_004's MASK): the card's art, masked by the
  // same stencil value, showed through the slab's whole band, legs and weapon past the card's frame (the lead,
  // 2026-10-20). A full-screen graphic that only writes stencil 0 goes after each layer of effects
  function stencilClear(parent, name) {
    var rt = node(parent, name); rt.anchorMin = UE.Vector2.zero; rt.anchorMax = UE.Vector2.one; rt.sizeDelta = new UE.Vector2(400, 400);
    var im = rt.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false;
    var m = new UE.Material(UI.Graphic.defaultGraphicMaterial); m.name = "bb stencil clear";
    m.SetFloat("_Stencil", 0); m.SetFloat("_StencilComp", 8); m.SetFloat("_StencilOp", 2); m.SetFloat("_StencilWriteMask", 255); m.SetFloat("_StencilReadMask", 255); m.SetFloat("_ColorMask", 0);
    im.material = m; return rt;
  }
  function buildSel() {
    var root = node(S.ui, "Select"); root.anchorMin = UE.Vector2.zero; root.anchorMax = UE.Vector2.one; root.sizeDelta = UE.Vector2.zero;
    var Z = { root: root, cg: root.gameObject.AddComponent(T(UE.CanvasGroup)), a: 0, cells: [], top: 0, on: false, tabs: [] };
    Z.cg.blocksRaycasts = false; Z.cg.interactable = false;
    var veil = node(root, "Veil"); veil.anchorMin = UE.Vector2.zero; veil.anchorMax = UE.Vector2.one; veil.sizeDelta = new UE.Vector2(600, 600);
    var vi = veil.gameObject.AddComponent(T(UI.Image)); vi.color = new UE.Color(0.02, 0.01, 0.035, 0.84); vi.raycastTarget = false;
    Z.fx = node(root, "TabFx"); Z.fx.anchorMin = Z.fx.anchorMax = new UE.Vector2(0.5, 0.5); Z.fx.sizeDelta = new UE.Vector2(1920, 1080);
    Z.cardFx = node(root, "CardFx"); Z.cardFx.anchorMin = Z.cardFx.anchorMax = new UE.Vector2(0.5, 0.5); Z.cardFx.anchoredPosition = new UE.Vector2(CARD_X, -40);
    stencilClear(root, "StencilClear");
    var tpl = find(find(S.ui, "Cards"), "Card");
    Z.veil = vi;
    var cgo = UE.Object.Instantiate(tpl.gameObject, root, false); cgo.name = "Showcase";
    var k = card(cgo.transform, 90); Z.k = k; cgo.SetActive(true);
    k.rt.anchorMin = k.rt.anchorMax = new UE.Vector2(0.5, 0.5); k.rt.pivot = new UE.Vector2(0.5, 0.5); k.rt.anchoredPosition = new UE.Vector2(CARD_X, -40);
    ["Rig/Medal", "Rig/Chips", "Rig/ChevL", "Rig/ChevR", "Rig/Plate/Crown", "Rig/Plate/Ping"].forEach(function (p) {   // the card's Animator writes their scale: a group of their own hides them
      var n = k.tr.Find(p); if (!n || n.Equals(null)) return; var g = n.gameObject.AddComponent(T(UE.CanvasGroup)); g.alpha = 0; g.ignoreParentGroups = false; });
    Z.cardTop = node(root, "CardTop"); Z.cardTop.anchorMin = Z.cardTop.anchorMax = new UE.Vector2(0.5, 0.5); Z.cardTop.anchoredPosition = new UE.Vector2(CARD_X, -40);
    stencilClear(root, "StencilClear2");
    var grid = node(root, "Grid"); grid.anchoredPosition = new UE.Vector2(SEL_X, SEL_Y); Z.grid = grid;
    for (var c = 0; c < SEL_COLS * SEL_ROWS; c++) {
      var b = button(grid, "Cell" + c); b.rt.sizeDelta = new UE.Vector2(SEL_W, SEL_H); b.t.text = ""; b.t.fontSize = 18; b.t.enableWordWrapping = true;
      b.home = new UE.Vector2((c % SEL_COLS - (SEL_COLS - 1) / 2) * SEL_PX, ((SEL_ROWS - 1) / 2 - Math.floor(c / SEL_COLS)) * SEL_PY); b.j = c;
      b.rt.anchoredPosition = b.home; b.ox = 0; b.ca = 1;
      // a group of its own dims head, portrait, lock crest, DLC label and text together for the group change (drawSel). It only
      // multiplies the screen's group: raycasts stay as the screen's group sets them
      b.cg = b.rt.gameObject.GetComponent(T(UE.CanvasGroup)); if (!b.cg || b.cg.Equals(null)) b.cg = b.rt.gameObject.AddComponent(T(UE.CanvasGroup));
      b.cg.ignoreParentGroups = false; b.cg.alpha = 1;
      var hd = node(b.rt, "Head"); hd.anchorMin = UE.Vector2.zero; hd.anchorMax = UE.Vector2.one; hd.sizeDelta = new UE.Vector2(-14, -14);
      b.head = hd.gameObject.AddComponent(T(UI.Image)); b.head.preserveAspect = true; b.head.raycastTarget = false;
      // a hero with no head picture in the game's atlas (a mod hero): its portrait's face, cut to the cell's shape
      var pm = node(b.rt, "PortMask"); pm.anchorMin = UE.Vector2.zero; pm.anchorMax = UE.Vector2.one; pm.sizeDelta = new UE.Vector2(-10, -10);
      var pmi = pm.gameObject.AddComponent(T(UI.Image)); var offi = comp(b.rt, "Off", UI.Image); pmi.sprite = offi.sprite; pmi.type = offi.type; pmi.raycastTarget = false;
      pm.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false;
      var po = node(pm, "Port"); po.anchorMin = UE.Vector2.zero; po.anchorMax = UE.Vector2.one; po.sizeDelta = UE.Vector2.zero;
      b.port = po.gameObject.AddComponent(T(UI.RawImage)); b.port.raycastTarget = false; b.portM = pm.gameObject; b.portM.SetActive(false);
      // the lock: the game's own crest (role_locktip_501) over a darkened head; "DLC" under it for a paid hero
      b.lockN = node(b.rt, "Lock"); b.lockN.anchorMin = b.lockN.anchorMax = new UE.Vector2(0.5, 0.5);
      // the "DLC" label sits on the cell's bottom edge and a paid hero's crest is lifted (cellLock), so the two never touch
      var dn = node(b.rt, "T_Dlc"); dn.anchorMin = dn.anchorMax = new UE.Vector2(0.5, 0); dn.anchoredPosition = new UE.Vector2(0, DLC_Y); dn.sizeDelta = new UE.Vector2(110, 26);
      b.dlc = txt(b.rt, "T_Dlc", 18, [1, 0.84, 0.5], cs.TMPro.TextAlignmentOptions.Center);
      b.t.transform.SetAsLastSibling(); Z.cells.push(b);
    }
    Z.rail = rail(grid, "Rail", (SEL_COLS - 1) / 2 * SEL_PX + SEL_W / 2 + 24, 0, (SEL_ROWS - 1) * SEL_PY + SEL_H);
    // the tabs: one per group with heroes, LB / RB or a click
    for (var j = 0; j < 4; j++) {
      var tb = button(root, "Tab" + j); tb.rt.sizeDelta = new UE.Vector2(226, 58); tb.t.fontSize = 26; tb.t.enableAutoSizing = true; tb.t.fontSizeMax = 26; tb.t.fontSizeMin = 14;
      var ul = node(tb.rt, "Under"); ul.anchorMin = new UE.Vector2(0, 0); ul.anchorMax = new UE.Vector2(1, 0); ul.pivot = new UE.Vector2(0.5, 0); ul.sizeDelta = new UE.Vector2(-24, 5); ul.anchoredPosition = new UE.Vector2(0, -9);
      tb.under = ul.gameObject.AddComponent(T(UI.Image)); tb.under.raycastTarget = false; Z.tabs.push(tb);
    }
    var tt = node(root, "T_SelTitle"); tt.anchoredPosition = new UE.Vector2(490, 441); tt.sizeDelta = new UE.Vector2(1000, 80);
    Z.title = txt(root, "T_SelTitle", 68, null, cs.TMPro.TextAlignmentOptions.Left);
    var st = node(root, "T_SelSub"); st.anchoredPosition = new UE.Vector2(490, 372); st.sizeDelta = new UE.Vector2(1000, 36);
    Z.sub = txt(root, "T_SelSub", 27, [0.75, 0.72, 0.82], cs.TMPro.TextAlignmentOptions.Left, 0);
    // under the grid: the hero's lock and how to get it, or what the buttons do
    var wn = node(root, "T_Why"); wn.anchoredPosition = new UE.Vector2(SEL_X, -290); wn.sizeDelta = new UE.Vector2(1000, 80);
    Z.why = txt(root, "T_Why", 26, [0.88, 0.86, 0.94], cs.TMPro.TextAlignmentOptions.TopLeft, 0); Z.why.enableWordWrapping = true;
    var hn = node(root, "T_Hold"); hn.anchoredPosition = new UE.Vector2(CARD_X, -150); hn.sizeDelta = new UE.Vector2(500, 50);
    Z.holdT = txt(root, "T_Hold", 32, [1, 0.9, 0.62], cs.TMPro.TextAlignmentOptions.Center);
    if (G.BB4LIT) G.BB4LIT.build(Z, S);   // the neon, fog and embers (fourlight.js)
    if (G.BB4HL) { try { G.BB4HL.build(S, Z, { node: node, txt: txt, button: button, lightBtn: lightBtn, col: col, rail: rail, railSet: railSet, headSprite: headSprite,
      heroTexture: heroTexture, measure: measure, skinOf: skinOf, heroLabelOf: heroLabelOf, lockOf: function (id) { return lockOf(id); } }); } catch (e) { log("hero list: " + es(e)); } }   // the list view (fourherolist.js)
    if (G.BB4S5) G.BB4S5.C = { headSprite: headSprite, heroTexture: heroTexture, measure: measure, skinOf: skinOf, heroLabelOf: heroLabelOf, spriteOf: spriteOf, lockOf: function (id) { return lockOf(id); }, soonOf: soonOf, headSquare: headSquare, soonHead: function (id) { var q = soonOf(id); return q ? soonArt(q, true) : heroFile(id, true); },
      pickIndex: function (j) { var p = S.pick; if (!p || p.step != "hero" || j < 0 || j >= p.list.length || selBusy(false)) return; S.tabFocus = false; if (p.i == j) S.press(); else { p.i = j; if (G.BB4SEL) G.BB4SEL.sfx("sfx_ui_51"); } },
      tabTo: function (k) { var p = S.pick; if (!p || p.step != "hero") return; var d = k - p.tab; if (d) tabStep(d); } };
    root.gameObject.SetActive(false);
    S.sel = Z;
  }
  // the tab's own look: its loop effects behind the card, its colour in the dark, a burst as it comes in
  // A group change plays it in three beats (drawSel, frames 6, 9 and 12 of the change, three frames apart as in
  // role_selection_008_2): part "intro" the old group's loops go and the burst plays, "tint" the slab takes the group's colour,
  // "loops" the group's loops start. No part: all at once, as the first open of the screen does
  function setTabLook(Z, key, burst, part) {
    var t = UE.Time.unscaledTime;
    if (part) {
      var P = TABFX[key] || TABFX.heroes;
      if (part == "intro") {
        (Z.loops || []).forEach(function (h) { G.BB4SEL.kill(h); }); Z.loops = []; Z.loopTint = []; Z.burstH = null;
        if (P.intro) { var bh = G.BB4SEL.fx(Z.cardTop, P.intro, 0, 0, 0.85, false); if (bh) { Z.burstH = bh; setTimeout(function () { G.BB4SEL.kill(bh); }, 1500); } }
      } else if (part == "tint") {
        Z.tintFor = P.tint || null; Z.backKey = null;   // the slab comes again in the group's colour, and the burst with it
        if (Z.burstH && P.tint) (Z.loopTint = Z.loopTint || []).push({ h: Z.burstH, till: t + 0.6 });
      } else if (part == "loops") {
        Z.lookKey = key;
        P.loop.forEach(function (e) { var h = G.BB4SEL.fx(e[4] == "top" ? Z.cardTop : Z.fx, e[0], e[1], e[2], e[3], true); if (h) Z.loops.push(h); });
        if (P.tint && e4top(P)) Z.loopTint = (Z.loopTint || []).concat(Z.loops.map(function (h) { return { h: h, till: t + 0.6 }; }));
      }
      return;
    }
    if (Z.lookKey == key) return; Z.lookKey = key;
    (Z.loops || []).forEach(function (h) { G.BB4SEL.kill(h); }); Z.loops = [];
    var L = TABFX[key] || TABFX.heroes;
    L.loop.forEach(function (e) { var h = G.BB4SEL.fx(e[4] == "top" ? Z.cardTop : Z.fx, e[0], e[1], e[2], e[3], true); if (h) Z.loops.push(h); });
    var till = UE.Time.unscaledTime + 0.6;   // parts keep coming in for a few frames
    Z.loopTint = L.tint && e4top(L) ? Z.loops.map(function (h) { return { h: h, till: till }; }) : [];
    Z.tintFor = L.tint || null; Z.backKey = null;   // the slab comes again in the tab's colour
    if (burst && L.intro) {   // the burst round the card, in the tab's colour
      var b = G.BB4SEL.fx(Z.cardTop, L.intro, 0, 0, 0.85, false);
      if (b) { if (L.tint) Z.loopTint.push({ h: b, till: till }); setTimeout(function () { G.BB4SEL.kill(b); }, 1500); }
    }
  }
  function e4top(L) { return L.loop.some(function (e) { return e[4] == "top"; }); }
  // the card's back slab: the game's own (role_selection_004 for a hero the player owns, _006 for one locked)
  function setCardBack(Z, locked) {
    var key = locked ? "006" : "004";
    if (Z.backKey != key) { Z.backKey = key; Z.backTinted = false; Z.back = G.BB4SEL.kill(Z.back); Z.back = G.BB4SEL.fx(Z.cardFx, "UI/Common/role_selection_" + key, 0, 0, 1.0, true); }
    // the effect's parts come in a frame or two after the play: tinted once they are there
    if (!Z.backTinted && Z.back) { var c = Z.tintFor; Z.backTinted = !c || G.BB4SEL.tint(Z.back, c, c[3]); }
  }
  // a paid hero's cell carries "DLC" under its crest: the label at DLC_Y above the cell's bottom edge, the crest lifted by DLC_LIFT.
  // Estimated from the 2026-10-20 captures (the crest's lower point reached the label); awaiting a look in game
  var DLC_Y = 7, DLC_LIFT = 8;
  function cellLock(b, lk) {
    var key = !lk || !lk.locked ? "" : lk.dlc ? "dlc" : lk.can ? "can" : "lock";
    if (b.lockKey == key) return; b.lockKey = key;
    b.lockFx = G.BB4SEL.kill(b.lockFx);
    // lockHome: the crest's place under lockN and its scale; fourlobby3d moves it to where the 3D pass draws the cell
    b.lockHome = [key == "dlc" ? 6 + DLC_LIFT : 6, 0.5];
    if (key) b.lockFx = G.BB4SEL.fx(b.lockN, key == "can" ? "UI/Common/role_locktip_501cell" : "UI/Common/role_locktip_501", 0, b.lockHome[0], b.lockHome[1], true);
  }
  // the select's panels (fourselpanels.js: Partner, Colours, Mind Crystals) get the screen's own helpers
  function pan() { var P = G.BB4PAN; if (!P || !S.solo) return null; try { P.ensure(S, PH); return P; } catch (e) { log("panels: " + es(e)); return null; } }
  var PH = { node: node, txt: function (tr, n, sz, c, al, st) { return txt(tr, n, sz, c, al, st); }, button: button, lightBtn: lightBtn, setA: setA, col: col, clamp: clamp,
    heroLabelOf: heroLabelOf, headSprite: headSprite, toast: toast, padNow: function () { return padNow(); }, hexOf: hexOf, stencilClear: stencilClear, rail: rail, railSet: railSet };
  S.refx = function (Z) { refx(Z); };
  function panOn() { var P = S.solo && G.BB4PAN; return !!(P && P.active()); }
  function drawSel() {
    var Z = S.sel; if (!Z) return;
    var fc = UE.Time.frameCount; if (Z.fc === fc) return; Z.fc = fc;   // the lobby's timer runs several times a frame
    var p = S.pick, on = !!(p && p.step == "hero" && !legacyTab() && !S.rulesOpen), t = UE.Time.unscaledTime, X = G.BB4SEL;
    Z.a += ((on ? 1 : 0) - Z.a) * (!on && Z.v5live ? 0.5 : 0.22); if (!on && Z.a < 0.02) Z.a = 0; if (on && Z.a > 0.98) Z.a = 1;
    var vis = Z.a > 0;
    if (Z.root.gameObject.activeSelf != vis) {
      Z.root.gameObject.SetActive(vis);
      if (vis) { Z.root.SetSiblingIndex(S.promptT.GetSiblingIndex()); Z.openAt = t; Z.k.id = "sel"; Z.k.hero = 0; Z.pend = Z.want != null ? { id: Z.want, at: 0 } : null; settle(Z.k); refx(Z); if (p) p.chg = null; }   // a group change that was running when the screen went away is over
      else { if (Z.hold && G.BB4SEL) G.BB4SEL.kill(Z.hold.fx); Z.hold = null; }   // the swirl goes with the screen
    }
    if (!vis) Z.v5live = false; else if (v5on()) Z.v5live = true;
    var V5 = (v5on() || !!Z.v5live) && !(G.BB4HL && G.BB4HL.on(S));
    Z.cg.alpha = V5 ? 0 : Z.a; Z.on = on;
    // the lobby's light layers (fourlight.js) are additive and ignore a group's alpha: the hidden screen is also scaled to nothing
    var zs = V5 ? 0 : 1; if (Z.zs !== zs) { Z.zs = zs; Z.root.localScale = new UE.Vector3(zs, zs, 1); }
    if (G.BB4S5 && G.BB4S5.vis) { try { G.BB4S5.vis(S, Z, Z.a, vis, V5); } catch (e) { if (!S.s5Err) { S.s5Err = true; log("select5: " + es(e)); } } }
    if (!vis || !p || !p.list || p.step != "hero") return;
    var tabs = tabsOf(p), ch = p.chg, f = 0, old = false;
    // the group change (tabStep starts it, p.chg holds its clock): frame f counts 60 per second from t0, or is S.chgScrub. The
    // tab buttons already show the new group; the grid, the sub-title and the card keep the old group until frame CHG_SWAP
    // (l, ci and tab are what those draw), and the cursor and list the input reads (p.list, p.i) are the new ones from frame 0
    if (ch) {
      f = S.chgScrub != null ? +S.chgScrub : (t - ch.t0) * 60;
      if (f >= CHG_SWAP && !(ch.beats & 1)) { ch.beats |= 1; if (X && !S.chgPlain && !V5) setTabLook(Z, tabs[ch.to].g.key, true, "intro"); }
      if (f >= CHG_SWAP + 3 && !(ch.beats & 2)) { ch.beats |= 2; if (X && !S.chgPlain && !V5) setTabLook(Z, tabs[ch.to].g.key, true, "tint"); }
      if (f >= CHG_SWAP + 6 && !(ch.beats & 4)) { ch.beats |= 4; if (X && !S.chgPlain && !V5) setTabLook(Z, tabs[ch.to].g.key, true, "loops"); }
      if (f >= CHG_END && ch.beats == 7 && S.chgScrub == null) { p.chg = ch = null; }   // settled; a scrub keeps the change to be stepped back through
      else old = f < CHG_SWAP;
    }
    var hlOn = !!(G.BB4HL && G.BB4HL.on(S));   // the list view (fourherolist.js) stands where the grid and the tabs are
    var tab = tabs[(old ? ch.from : p.tab)] || tabs[0], gc = tab.g.col;
    var l = old ? ch.fromList : p.list, ci = old ? ch.fromI : p.i, n = l.length, top = old ? ch.fromTop : Z.top;
    if (X && !ch && !S.chgPlain && !V5) setTabLook(Z, tab.g.key, Z.tabWas != null && Z.tabWas != p.tab); Z.tabWas = p.tab;
    Z.tabs.forEach(function (tb, j) {
      var show = j < tabs.length && !hlOn; if (tb.rt.gameObject.activeSelf != show) tb.rt.gameObject.SetActive(show); if (!show) return;
      var w = tabs.length, cur = j == p.tab, tg = tabs[j].g;
      tb.rt.anchoredPosition = new UE.Vector2(TAB_X + (j - (w - 1) / 2) * TAB_DX, TAB_Y);
      if (!tb.fit) { tb.fit = 1; tb.t.enableWordWrapping = false; tb.t.fontSizeMax = tb.t.fontSize; tb.t.fontSizeMin = 14; tb.t.margin = new UE.Vector4(22, 0, 22, 0); tb.t.enableAutoSizing = true; }   // "CROSS EFFECT" shrinks to its tab
      tb.t.text = tg.name; lightBtn(tb, false, false);
      // the current tab is filled with its group's colour, deepened, under white text; the others are dark with a lit rim (fourlight.js)
      tb.t.color = cur ? new UE.Color(1, 1, 1, 1) : new UE.Color(0.78, 0.74, 0.84, 1);
      tb.under.color = col(tg.col, 0); tb.on.color = col([tg.col[0] * 0.72, tg.col[1] * 0.26, tg.col[2] * 0.46], cur ? 1 : 0);
      if (G.BB4LIT) G.BB4LIT.tab(Z, tb, cur, t);
    });
    var rows = Math.ceil(p.list.length / SEL_COLS), r = Math.floor(p.i / SEL_COLS);   // the scroll follows the real list and cursor
    if (r < Z.top) Z.top = r; if (r > Z.top + SEL_ROWS - 1) Z.top = r - SEL_ROWS + 1; Z.top = clamp(Z.top, 0, Math.max(0, rows - SEL_ROWS));
    if (!old) top = Z.top;
    railSet(Z.rail, top, Math.ceil(n / SEL_COLS), SEL_ROWS);
    if (!hlOn) Z.cells.forEach(function (b, c) {
      var j = top * SEL_COLS + c, show = j < n; b.j = old ? -1 : j;   // the leaving cells are not under the mouse or the cursor
      if (b.rt.gameObject.activeSelf != show) { b.rt.gameObject.SetActive(show); b.lockKey = null; }
      if (!show) { b.lockFx = X ? X.kill(b.lockFx) : null; return; }
      // the change's motion on this cell. The group travels like a carousel: pressing forward (RB, the next tab, which sits to the
      // right) sends the old cells out to the left and brings the new ones in from the right; back is the mirror. Leaving: the
      // whole block over CHG_SWAP frames, eased in (square), alpha to 0 and CHG_PX px along. Arriving: column k starts at
      // CHG_SWAP + 2k, 8 frames, eased out (cubic), from alpha 0 and CHG_PX px on the side it comes from, to rest
      var ca = 1, ox = 0;
      if (ch) {
        if (old) { var q = clamp(f / CHG_SWAP, 0, 1), e = q * q; ca = 1 - e; ox = -ch.dir * CHG_PX * e; }
        else { var q2 = clamp((f - (CHG_SWAP + 2 * (c % SEL_COLS))) / 8, 0, 1), e2 = 1 - Math.pow(1 - q2, 3); ca = e2; ox = ch.dir * CHG_PX * (1 - e2); }
      }
      if (b.ca !== ca) { b.ca = ca; b.cg.alpha = ca; }
      if (b.ox !== ox) { b.ox = ox; b.rt.anchoredPosition = new UE.Vector2(b.home.x + ox, b.home.y); }
      var id = l[j];
      if (b.id != id) {
        b.id = id; var sp = headSprite(id), tex = sp ? null : heroTexture(id, skinOf(id));
        b.head.sprite = sp; b.head.gameObject.SetActive(!!sp); b.portM.SetActive(!!tex);
        if (tex) {   // a square around the face: the figure's top and centre as the card measures them
          var r = measure(tex), s = 0.4, hv = s * tex.width / tex.height;
          b.port.texture = tex; b.port.uvRect = new UE.Rect(clamp(r.cx - s / 2, 0, 1 - s), clamp(1 - r.top - hv + 0.01, 0, 1 - hv), s, hv);
        }
        b.t.text = sp || tex ? "" : heroLabelOf(id);
      }
      var lk = lockOf(id), locked = !!(lk && lk.locked);
      // the crest is particles, which the cell's CanvasGroup does not dim: during a change a leaving cell drops it at the press and
      // an arriving one gets it once its column has landed, so the crest's own intro plays on a still cell
      if (X) cellLock(b, V5 || (ch && (old || ca < 1)) ? null : lk);
      b.dlc.text = locked && lk.dlc ? "DLC" : "";
      var foc = j == ci, used = id == p.was;
      var hcol = locked ? (foc ? new UE.Color(0.62, 0.6, 0.68, 1) : new UE.Color(0.3, 0.29, 0.36, 1)) : foc ? new UE.Color(1, 1, 1, 1) : used ? new UE.Color(0.95, 0.9, 0.8, 1) : new UE.Color(0.66, 0.64, 0.74, 1);
      lightBtn(b, foc, true);
      if (foc) b.on.color = col(S.sel.k.colour || NO_HERO, 0.85);   // the cell under the cursor fills with the hero's colour, not white over the art
      if (p.partner && G.BB4PAN && G.BB4PAN.cellDim(id)) hcol = new UE.Color(0.24, 0.23, 0.29, 1);
      b.head.color = hcol; b.port.color = hcol;
      if (G.BB4LIT) G.BB4LIT.cell(Z, b, foc, !!(locked && lk.dlc), t);   // its rim, brackets, the paid hero's hex badge
    });
    // the card turns over to a new hero: its art changes at the turn's middle (Swap is 0.23 s)
    // in a group change the card keeps the hero it already wants until frame CHG_SWAP, then turns to the new one. Not the leaving
    // group's cursor hero: in a chain of presses the card never showed that one, and turning to it would play Swap on every press
    var id = old && Z.want != null ? Z.want : l[ci], lk0 = lockOf(id), locked0 = !!(lk0 && lk0.locked);
    if (Z.want != id) {
      Z.want = id; Z.restAt = t; Z.voiced = false; Z.hold = null;
      if (!Z.k.hero) Z.pend = { id: id, at: 0 }; else { shot(Z.k, "Swap"); Z.pend = { id: id, at: t + 0.1 }; }
    }
    if (Z.pend && t >= Z.pend.at) {
      var h = Z.pend.id; Z.pend = null; Z.k.hero = h; look(Z.k, h, skinOf(h), null);
      Z.k.hero_t.text = heroLabelOf(h); Z.k.hero_t.enableAutoSizing = true; Z.k.hero_t.fontSizeMax = 44; Z.k.hero_t.fontSizeMin = 18;
      Z.k.hero_t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis; Z.k.hero_t.rectTransform.sizeDelta = new UE.Vector2(296, 62);
      Z.swapAt = t;
    }
    if (X && !V5) setCardBack(Z, !!(Z.k.hero == id ? locked0 : (function (q) { return q && q.locked; })(lockOf(Z.k.hero))));
    var ck = !V5 && locked0 && Z.k.hero == id ? (lk0.can ? "can" : "lock") + id : "";   // the card's lock crest, once the card shows that hero
    if (X && Z.crestKey !== ck) {
      Z.crestKey = ck; Z.crest = X.kill(Z.crest);
      if (ck) Z.crest = X.fx(Z.cardTop, lk0.can ? "UI/Common/role_locktip_501cell" : "UI/Common/role_locktip_501", 0, 40, 1.3, true);
    }
    if (X && Z.loopTint && Z.loopTint.length && Z.tintFor) { var tc = Z.tintFor; Z.loopTint = Z.loopTint.filter(function (e) { X.tint(e.h, tc, tc[3]); return t < e.till; }); }
    var lkc = Z.k.hero == id ? lk0 : lockOf(Z.k.hero), lockedC = !!(lkc && lkc.locked);   // the card's own hero while it turns over
    Z.k.art.color = lockedC ? new UE.Color(0.42, 0.4, 0.48, 1) : new UE.Color(1, 1, 1, 1);
    // the group's name is on its tab and in the line under the title: no tag over the card's corner (it sat across the
    // card's edge and the ribbon, and "CROSS EFFECT" ran off the plate)
    Z.k.tag_t.text = ""; Z.k.tag_t.color = col(gc);
    Z.k.name_t.text = lockedC ? "<color=#ffd27a>" + (lkc.dlc ? "DLC hero" : lkc.can ? "Ready to unlock" : "Locked") + "</color>" : (Z.k.hero == p.was ? "<color=#ffd27a>Playing now</color>" : "Choose to play") + (S.solo && G.BB4PAN && Z.k.hero ? G.BB4PAN.wornTag(Z.k.hero) : "");
    // the voice line when the cursor rests (the game's own: vo_<id>_intro)
    if (S.solo && X && !Z.voiced && t - (Z.restAt || 0) > 0.6) { Z.voiced = true; if (!soonOf(id)) X.voice(id); }
    // hold to unlock: the game's hold swirl on the card while A is held, the unlock burst when it lands
    var hold = Z.hold, hp = 0;
    if (hold && hold.id == id) {
      var still = S.holdTest || held(rwp(), "confirm") || (hold.mouse && Input_mouse0());   // holdTest: a scripted check holds it
      if (!still && !hold.done) { Z.hold = null; hold.fx = X.kill(hold.fx); X.sfx("sfx_ui_38_p2"); }
      else if (!hold.done) {
        hp = clamp((t - hold.t0) / HOLD_S, 0, 1);
        if (hp >= 1) { hold.done = true; hold.fx = X.kill(hold.fx); unlockNow(id); }
      }
    } else if (hold) { hold.fx = X ? X.kill(hold.fx) : null; Z.hold = null; }
    Z.holdT.text = Z.hold && !Z.hold.done ? "UNLOCKING  " + Math.round(hp * 100) + "%" : "";
    Z.why.text = locked0 ? lk0.why + (lk0.item && !lk0.special && !lk0.dlc ? "\n<color=#ffd27a>" + lk0.text + "</color>" + (lk0.can ? "   <color=#8fe39a>Hold " + (padNow() ? "A" : "Enter") + " to unlock</color>" : "") : "")
      : S.solo ? "" : "";
    var hc = Z.k.colour || NO_HERO, tv = (TABFX[tab.g.key] || TABFX.heroes).veil;
    var vc = Z.veil.color, wr = hc[0] * 0.05 + tv[0], wg = hc[1] * 0.05 + tv[1], wb = hc[2] * 0.05 + tv[2];
    Z.veil.color = new UE.Color(vc.r + (wr - vc.r) * 0.1, vc.g + (wg - vc.g) * 0.1, vc.b + (wb - vc.b) * 0.1, S.solo ? 0.9 : 0.94);   // the dark takes the tab's colour and a little of the hero's
    Z.title.text = "CHOOSE YOUR HERO";
    var owned = l.filter(function (x) { var q = lockOf(x); return !(q && q.locked); }).length;
    Z.sub.text = tab.g.label + "   ·   " + (ci + 1) + " / " + n + (owned < n ? "   ·   " + owned + " owned" : "") + "   ·   " +
      (S.solo ? (p.evos.length ? "Legacy I and II next" : "No Evotypes saved") : legacySlots() && p.evos.length ? (legacySlots() > 1 ? "Legacy I and II next" : "Legacy next") : "No Legacy in this lobby");
    var PP = pan(); if (PP && PP.drawPartner(Z, id)) Z.sub.text = tab.g.label + "   ·   " + (ci + 1) + " / " + n + "   ·   Tag Mode";
    if (G.BB4HL) { try { G.BB4HL.draw(S, Z, t); } catch (e) { if (!S.hlErr) { S.hlErr = true; log("hero list: " + es(e)); } } }
    if (V5) { try { G.BB4S5.frame(S, Z, { t: t, p: p, tabs: tabs, hp: hp, holding: !!(Z.hold && !Z.hold.done), pad: padNow(), tabFocus: !!S.tabFocus, next: p.evos.length ? "Legacy I and II" : "No Evotypes saved", evoN: p.evos.filter(function (q) { return q.id == id; }).length, evoBest: p.evos.reduce(function (m, q) { return q.id == id && q.score > m ? q.score : m; }, 0), worn: G.BB4PAN && id ? G.BB4PAN.wornTag(id) : "" }); }
      catch (e) { if (!S.s5Err) { S.s5Err = true; log("select5: " + es(e) + " " + String(e && e.stack).split("\n")[1]); } } }
    if (G.BB4LIT) G.BB4LIT.frame(Z, t, tab.g.key);
  }
  function Input_mouse0() { try { return UE.Input.GetMouseButton(0); } catch (e) { return false; } }
  function padNow() { try { var c = lastController(rwp()); return !!c && (String(c.type).indexOf("Joystick") >= 0 || c.type == 2); } catch (e) { return false; } }
  async function unlockNow(id) {
    var Z = S.sel, X = G.BB4SEL, ok = false;
    Z.unlocking = true;   // the request is in flight: no group change and no confirm until it answers (selBusy)
    try { ok = await X.unlock(id); } catch (e) { log("unlock: " + es(e)); }
    Z.unlocking = false;
    LOCKS = {};
    if (!ok) { X.sfx("sfx_ui_13"); toast("Couldn't unlock " + heroLabelOf(id)); Z.hold = null; return; }
    X.sfx("sfx_ui_52");
    var b = X.fx(Z.cardTop, "UI/Common/chaosscheduleunlock_complete", 0, 40, 2.2, false); if (b) setTimeout(function () { X.kill(b); }, 2500);   // the hold swirl's own finish
    Z.crest = X.kill(Z.crest); Z.backKey = null; Z.cells.forEach(function (c) { c.lockKey = null; });
    shot(Z.k, "Ready"); Z.hold = null;
    toast(heroLabelOf(id) + " unlocked");
  }
  // one test for "may this start" on the hero step, for tabStep (a group change) and for the confirms (soloConfirm and the
  // mouse's card click). A group change waits while the hold-to-unlock runs or its request is in flight. A confirm also waits
  // while the screen opens (Z.a < 1), the card still shows another hero (Z.pend, or the cursor ahead of drawSel), a group change
  // runs (p.chg for CHG_S), the return window after a hand-back plays (S.quietUntil, 0.4 s) and a panel is up or closing. A
  // press that waits is dropped without a sound, as the game's own select drops it. A group change does not wait on the card
  // or on another group change: a second press snaps to the next group (the change's motion reads p.chg)
  // the group change's sheet (HERO_SELECT_V4.md 9.2 item 5), in frames at 60 fps: the old cells leave over 0 to CHG_SWAP, the
  // list and the card change at CHG_SWAP, the new cells arrive by column and the last lands at CHG_END
  var CHG_SWAP = 6, CHG_END = 24, CHG_PX = 24;
  var CHG_S = CHG_END / 60;   // how long a group change runs: a confirm waits this long
  function selBusy(confirm) {
    var Z = S.sel, p = S.pick; if (!Z || !p || p.step != "hero") return false;
    if (Z.unlocking || Z.hold) return true;
    if (!confirm) return false;
    return Z.a < 1 || !!Z.pend || Z.k.hero != p.list[p.i] || !!(p.chg && UE.Time.unscaledTime < p.chg.t0 + CHG_S) || now() < (S.quietUntil || 0) || panOn();
  }
  // the tab under LB / RB, Q / E or a click: the cursor goes to the hero last on in that tab, else the first the player owns, else
  // the first. A tab two away is one change. p.chg records it for the group-change motion: t0 (unscaledTime), dir (1 forward,
  // -1 back), from and to (tab indexes)
  function tabStep(d) {
    var p = S.pick; if (!p || p.step != "hero") return;
    var tabs = tabsOf(p), n = tabs.length; if (n < 2 || selBusy(false)) return;
    var from = p.tab, to = ((from + d) % n + n) % n; if (to == from) return;
    p.last = p.last || {}; p.last[tabs[from].g.key] = p.list[p.i];
    var ids = tabs[to].ids, i = ids.indexOf(p.last[tabs[to].g.key]);
    if (i < 0) { i = 0; for (var k = 0; k < ids.length; k++) { var lk = lockOf(ids[k]); if (!(lk && lk.locked)) { i = k; break; } } }
    // fromList, fromI and fromTop are what the old group's cells are drawn from for frames 0 to 6 while p.tab, p.list and p.i
    // already hold the new group. A press during a change lands here too: the running change is dropped, so its cells are
    // at rest on its new list, and this one starts from there with a fresh clock (beats: bit 1 intro, 2 tint, 4 loops, once each)
    p.chg = { t0: UE.Time.unscaledTime, dir: d > 0 ? 1 : -1, from: from, to: to, fromList: p.list, fromI: p.i, fromTop: S.sel.top, beats: 0 };
    p.tab = to; p.list = ids; p.i = i; S.sel.top = 0;
    if (G.BB4SEL) G.BB4SEL.sfx("sfx_ui_51");
  }
  function startPick() {
    var m = me(), L = G.BB4L; if (!m) return;
    S.pick = { heroes: heroList(), evos: evoList(), hero: m.hero, evo: L.me.evo || null, evo2: L.me.evo2 || null, was: m.hero };
    setStep("hero");
    S.zone = "cards"; S.cur = members().indexOf(m); S.menu.SetActive(false);
    log("hero pick open on the card (" + S.pick.heroes.length + " heroes, " + S.pick.evos.length + " Evotypes)");
  }
  function pickHero() { var p = S.pick; return !p ? 0 : p.step == "hero" ? p.list[p.i] : p.hero; }
  function pickEvo(n) { var p = S.pick; if (!p) return null; var k = n == 1 ? "evo1" : "evo2"; return p.step == k ? p.list[p.i] : n == 1 ? p.evo : p.evo2; }
  // a row up or down, wrapping in the same column (a short last row is skipped where it has no hero in that column)
  function stepRow(d) {
    var p = S.pick, n = p.list.length, C = selCols(), rows = Math.ceil(n / C), col = p.i % C, r = Math.floor(p.i / C);
    if (rows < 2) return;
    do { r = (r + d + rows) % rows; } while (r * C + col >= n);
    stepPick(r * C + col - p.i);
  }
  function stepPick(d) { var p = S.pick; var j = (p.i + d + p.list.length) % p.list.length; if (j != p.i && S.solo && G.BB4SEL) G.BB4SEL.sfx("sfx_ui_51"); p.i = j; }
  // a locked hero chosen: the DLC box for a paid one, the hold for one the player can afford, else the condition
  function lockedPick(hero, lk) {
    var X = G.BB4SEL;
    if (lk.soon) { if (X) X.sfx("sfx_ui_13"); toast(heroLabelOf(hero) + " is coming in " + lk.year); return; }
    if (lk.dlc) { if (S.solo && X && X.dlc(hero)) return; toast(heroLabelOf(hero) + " comes with a DLC"); return; }
    if (lk.can && S.solo) { S.sel.hold = { id: hero, t0: UE.Time.unscaledTime, fx: X.fx(S.sel.cardTop, "UI/Common/chaosscheduleunlock_hold", 0, 40, 0.8, true) }; X.sfx("sfx_ui_38_p1"); return; }
    if (X) X.sfx("sfx_ui_13");
    toast(lk.can ? heroLabelOf(hero) + " is unlocked in the character select" : lk.why || heroLabelOf(hero) + " is locked");
  }
  function confirmPick() {
    var L = G.BB4L, p = S.pick, m = me();
    if (S.solo) { soloConfirm(); return; }
    if (!m || !p) { S.pick = null; return; }
    if (p.step == "hero") {
      var hero = p.list[p.i], lk = lockOf(hero);
      if (lk && lk.locked) { lockedPick(hero, lk); return; }
      if (hero >= 190000) { var c = L.heroCheck(hero, members()); if (!c.ok) { toast((L.heroName(hero) || "That hero") + " can't be played here: " + S.whyLong(c)); return; } }
      p.hero = hero;
      if (legacySlots() && p.evos.length) { setStep("evo1"); return; }
    } else if (p.step == "evo1") {
      p.evo = p.list[p.i];
      if (p.evo2 && p.evo && (p.evo2.uid == p.evo.uid || p.evo2.id == p.evo.id)) p.evo2 = null;
      if (!p.evo) p.evo2 = null;
      else if (legacySlots() > 1) { setStep("evo2"); return; }
    } else p.evo2 = p.list[p.i];
    if (L.setLoadout(p.hero, p.evo, skinOf(p.hero), legacySlots() > 1 ? p.evo2 : null) === false) { toast("That hero can't be played here"); setStep("hero"); return; }
    log("hero pick: " + p.hero + (p.hero == p.was ? " (unchanged)" : "") + ", Legacy I " + (p.evo ? p.evo.id + "/" + p.evo.uid : "none") + ", Legacy II " + (p.evo2 && legacySlots() > 1 ? p.evo2.id + "/" + p.evo2.uid : "none"));
    S.pick = null;
  }
  // B steps back: Legacy II to Legacy I to the hero, and from the hero out (nothing changed)
  function cancelPick() {
    var p = S.pick; if (!p) return;
    if (p.step == "evo2") { setStep("evo1"); return; }
    if (p.step == "evo1") { setStep("hero"); return; }
    if (p.partner && G.BB4PAN) { G.BB4PAN.partnerEnd(); return; }
    if (S.solo) { soloLeave(); return; }
    S.pick = null; log("hero pick closed, loadout kept");
  }

  // ---- solo: the new select as the game's own character select (fourselect.js opens it over SceneUIHeroSelect) ----
  var SOLO_HIDE = ["Title", "Info", "Cards", "Bar", "EdgeL", "EdgeR", "T_MoreL", "T_MoreR", "T_Ver"];
  function soloParts(on) { SOLO_HIDE.forEach(function (n) { var t = S.ui.Find(n); if (t && !t.Equals(null)) t.gameObject.SetActive(on); }); }
  S.openSolo = function (o) {
    S.open(); if (!S.isOpen) return;
    S.solo = o || {}; S.tabFocus = false; S.leaving = false; soloParts(false); if (G.BB4PAN) G.BB4PAN.reset();
    try { if (v5on()) { var bd0 = S.ui.Find("Backdrop"); if (bd0 && !bd0.Equals(null)) bd0.gameObject.SetActive(false); } } catch (e) {}
    S.heroes = null; LOCKS = {};
    S.pick = { heroes: heroList(), evos: evoList(), hero: S.solo.hero || 0, evo: null, evo2: null, was: S.solo.hero || 0, solo: true };
    setStep("hero"); S.sel.tabWas = null;
    log("solo select open (" + S.pick.heroes.length + " heroes, " + S.pick.tabs.length + " tabs, " + S.pick.evos.length + " Evotypes)");
  };
  function soloClose() { S.solo = null; S.pick = null; S.tabFocus = false; S.leaving = false; try { if (G.BB4S5 && G.BB4S5.reset) G.BB4S5.reset(); } catch (e) {}
    // the lobby's own parts (its cards, bar and title) come back only once this layer is out of sight: put back at once,
    // they showed for a moment on the way out (the lead's clip, 2026-11-10)
    var late = !!(G.BB4S5 && G.BB4S5.enabled !== false);
    if (late) setTimeout(function () { try { if (!S.solo) { soloParts(true); var bd2 = S.ui.Find("Backdrop"); if (bd2 && !bd2.Equals(null)) bd2.gameObject.SetActive(true); } } catch (e) {} }, 900); else { try { soloParts(true); } catch (e) {} }
    S.close(true); if (!late) { try { var bd = S.ui.Find("Backdrop"); if (bd && !bd.Equals(null)) bd.gameObject.SetActive(true); } catch (e) {} } }
  function soloLeave() {
    log("solo select: Back");
    if (v5on() && G.BB4S5.closeAnim && !S.leaving) { S.leaving = true; G.BB4S5.closeAnim(); setTimeout(function () { S.leaving = false; soloClose(); if (G.BB4SEL) G.BB4SEL.leave(); }, 140); return; }
    soloClose(); if (G.BB4SEL) G.BB4SEL.leave();
  }
  // a stock window over the select (Intel, Video, the wardrobe): the screen steps aside, the pick kept
  function soloAside() { if (S.root && !S.root.Equals(null)) S.root.SetActive(false); S.isOpen = false; lock(false); stockHints(true); }
  S.soloBack = function () { if (!S.solo || !S.root || S.root.Equals(null)) return; S.root.SetActive(true); S.isOpen = true; S.arm = true; S.quietUntil = now() + 0.4; S.promptSig = null; lock(true); if (S.sel) refx(S.sel); };
  // the effects stop while the screen is off (Intel, Video, the wardrobe): all of them play again when it comes back
  function refx(Z) { Z.lookKey = null; Z.backKey = null; Z.crestKey = null; Z.cells.forEach(function (b) { b.lockKey = null; }); }
  S.soloExit = function () { if (S.solo) soloLeave(); };
  function soloConfirm() {
    var p = S.pick, X = G.BB4SEL; if (!p || !X) return;
    if (selBusy(true)) return;   // opening, card turning, group change, return window, panel: the press is dropped
    if (p.step == "hero" && p.partner && G.BB4PAN) { G.BB4PAN.partnerChoose(p.list[p.i]); return; }
    if (p.step == "hero") {
      var hero = p.list[p.i], lk = lockOf(hero);
      if (lk && lk.locked) { lockedPick(hero, lk); return; }
      p.hero = hero; X.sfx("sfx_ui_53");
      if (p.evos.length) { setStep("evo1"); return; }
      return soloGo(null);
    }
    if (p.step == "evo1") {
      p.evo = p.list[p.i]; X.sfx("sfx_ui_55");
      if (p.evo && p.evos.filter(function (e) { return e.id != p.hero && e.id != p.evo.id; }).length) { setStep("evo2"); return; }
      return soloGo([p.evo]);
    }
    p.evo2 = p.list[p.i]; X.sfx("sfx_ui_55");
    soloGo([p.evo, p.evo2]);
  }
  // the v5 Legacy screen (fourevo5.js): its rows only set a Legacy, its two slot buttons change the step, and its Start
  // Run button is the one way into the run
  S.v5Step = function (step) { var p = S.pick; if (!p || !S.solo || (step != "evo1" && step != "evo2")) return false; if (step == "evo2" && !p.evo) return false; if (p.step != step) setStep(step); return true; };
  S.v5Start = function () { var p = S.pick; if (!p || !S.solo || selBusy(true) || (p.step != "evo1" && p.step != "evo2")) return false; if (G.BB4SEL) G.BB4SEL.sfx("sfx_ui_55"); soloGo(p.evos.length ? [p.evo || null, p.evo ? p.evo2 || null : null] : null); return true; };
  function soloGo(evos) {
    var p = S.pick, hero = p.hero, ev = evos ? evos.filter(function (e) { return !!e; }) : null;
    log("solo select: " + hero + ", Legacies " + (ev ? ev.map(function (e) { return e.id + "/" + e.uid; }).join(", ") || "none" : "(no Evotypes saved)"));
    // out of sight while the game takes the pick; closed once it has, back on the hero if it did not
    soloAside();
    function refused(why) { log("solo select: " + why); if (!S.solo) return; p.step = "hero"; S.soloBack(); G.BB4SEL.sfx("sfx_ui_13"); toast("The game did not take " + heroLabelOf(hero) + ": pick again"); }
    G.BB4SEL.go(hero, ev).then(function (ok) { if (ok) soloClose(); else refused("the game did not take the pick"); }, function (e) { refused("go: " + es(e)); });
  }
  function soloAct(a) {
    var p = S.pick, X = G.BB4SEL;
    if (p && p.step == "hero" && soonOf(p.list[p.i]) && a != "view") return;   // nothing of the game's to open for a hero that is not in it yet
    // on a Legacy step Y goes to the filter row and back (HERO_SELECT_V4.md 9.10, direction A, the lead 2026-11-02); X switches
    // the Evotype's Legacy skill (the stock Evotype screen's button, testers 2026-10-25); R3 / R stars it as a favourite
    if (p && (p.step == "evo1" || p.step == "evo2") && evoOn()) {
      if (a == "filters" && G.BB4EVO.filters) G.BB4EVO.filters(S);
      else if (a == "movie" && G.BB4EVO.switchSkill) G.BB4EVO.switchSkill(S);
      else if (a == "crystals" && G.BB4EVO.fav) G.BB4EVO.fav(S);
      return;
    }
    if (!p || p.step != "hero" || !X) return;
    if (a == "view") { if (G.BB4HL && !p.partner) G.BB4HL.toggle(S); return; }
    var id = p.list[p.i];
    // Colours: a locked hero too, its palettes and its stance in the room before it is unlocked
    if (a == "colours") { var PC = pan(); if (PC) { if (p.partner) return; PC.coloursOpen(id); return; } soloAside(); X.wardrobe(id).then(function (ok) { if (!ok) S.soloBack(); }); return; }
    if (a == "partner") { var P1 = pan(); if (!P1 || !P1.tagOn()) return; if (p.partner) P1.partnerOff(); else P1.partnerStart(); return; }
    if (a == "crystals") { var P2 = pan(); if (P2 && !p.partner) P2.crystalsOpen(); return; }
    if (a == "detail") { soloAside(); if (!X.detail(id)) S.soloBack(); return; }
    if (a == "movie") { if (!X.hasMovie(id)) { X.sfx("sfx_ui_13"); toast("No video for " + heroLabelOf(id)); return; } soloAside(); if (!X.movie(id)) S.soloBack(); return; }
  }

  // ---- the stock pickers ----
  function pickLoadout() {
    // the stock hero select closed and reopened the screen outside the Mind Training room (Soulve's clip, 2026-10-18)
    // and its Evotype screen hung on "Completing Preparation" (Nocturn's clip): Loadout is the card pick now. The
    // stock path below stays for a scripted check only (S.stockPick)
    if (!S.stockPick) { startPick(); return; }
    var DB = require("DataBinding").DB, W = require("Window/BreedPrepareUI").default, UIU = require("Core/UIUtil").default, L = G.BB4L;
    DB.CallBackToPvePrepareRoom.Value = function () {
      try {
        var td = DB.TeamData.Value, hero = td && td.seed && td.seed.server ? td.seed.server.id : 0, evs = [];
        if (!td.factors || !td.factors.size) return;                              // the hero confirm calls once with none
        td.factors.forEach(function (x) { if (evs.length < 2 && x && x.server) evs.push(x.server); });   // both of the stock slots (two Legacies)
        function evoOf(ev) { return ev ? { id: ev.id, uid: ev.uid, score: ev.score | 0, inheritBlesses: (ev.inheritBlesses || []).map(function (b) { return { id: b.id, quality: b.quality }; }), inheritSkillIndex: ev.inheritSkillIndex | 0, inheritSkillLevel: ev.inheritSkillLevel | 0 } : null; }
        var evo = evoOf(evs[0]), evo2 = evoOf(evs[1]);
        var skin = 0; try { skin = td.seed.server.skinId | 0; } catch (e) {}
        if (L.setLoadout(hero, evo, skin, evo2) === false) { S.refused = hero; log("loadout: hero " + hero + " refused (not on every PC at one version)"); }
        else log("loadout: hero " + hero + " Evotype " + (evo ? evo.id : "none"));
      } catch (e) { log("loadout: " + es(e)); }
      DB.CallBackToPvePrepareRoom.Value = null; S.picking = false; unlockHero(); S.open();
      if (S.refused) { var c = G.BB4L.heroCheck(S.refused, members()); openRules("mods"); S.rfocusHero = S.refused; S.refused = 0; log("refused: " + S.whyLong(c)); }   // the board says why
    };
    S.close(true); S.picking = true; hookBacks();
    try { UIU.AcquireWindow(W).OpenSingleBreedHeroSelect().catch(function (e) { log("hero select: " + es(e)); S.picking = false; unlockHero(); S.open(); }); }
    catch (e) { log("hero select: " + es(e)); DB.CallBackToPvePrepareRoom.Value = null; S.picking = false; unlockHero(); S.open(); }
  }
  // Back in the stock screens: the hero select's Back closed it into the bare room, and the player was left outside
  // the lobby screen (testers, 2026-10-17: "I hit back and now i'm stuck here"). Both Backs now come here.
  function hookBacks() {
    try {
      var pr = require("Window/BreedPrepareUI").default.prototype;
      if (!pr.__bb4orig) pr.__bb4orig = pr.OnHeroSelectBack;            // the stock one, kept once: a reload wraps it again
      pr.OnHeroSelectBack = function () { try { return pr.__bb4orig.apply(this, arguments); } finally { try { G.BB4UI && G.BB4UI.pickBack && G.BB4UI.pickBack(); } catch (e) {} } };
      pr.__bb4back = 1;
    } catch (e) { log("hero select back hook: " + es(e)); }
    try {
      var HU = require("GamePlay/Heat/HeatUtil").default;
      if (!HU.__bb4orig) HU.__bb4orig = HU.ExitHeatMenu;
      HU.ExitHeatMenu = function () { try { return HU.__bb4orig.apply(this, arguments); } finally { try { G.BB4UI && G.BB4UI.heatBack && G.BB4UI.heatBack(); } catch (e) {} } };
      HU.__bb4exit = 1;
    } catch (e) { log("Entropy back hook: " + es(e)); }
  }
  // the hero select locks the hero (ScriptRequire) and the stock flow after it unlocks it; this flow is ours, so we do
  function unlockHero() { try { require("Core/Util").U.SetActorActionLock(false, cs.NOAH.Input.LockFlag.ScriptRequire); } catch (e) { log("unlock hero: " + es(e)); } }
  S.pickBack = function () {
    if (!S.picking) return;
    S.picking = false; unlockHero(); try { require("DataBinding").DB.CallBackToPvePrepareRoom.Value = null; } catch (e) {}
    log("hero select: Back, to the lobby screen"); setTimeout(function () { if (G.BB4L && G.BB4L.state == "in" && !S.isOpen) S.open(); }, 150);
  };
  S.heatBack = function () { if (S.heatW) { S.heatAt = 0; setTimeout(heatClosed, 150); } };
  // The game's controls go to one input group at a time (GameInputManager.CurInputGroup). While a load is running the
  // game holds them on its Loading screen (LockFlag.AsyncLoading on the UI); a stock menu opened then shows but takes no
  // key (Tag Mode 1.0.0's hub line left that lock on for good, 2026-10-18: "Entropy does not appear to actually change",
  // the shop "cannot purchase anything"). The lobby screen reads the keys itself, so it still worked over it.
  function gim() { try { return require("Core/Util").U.GetSingleton(cs.GamePlay.GameInputManager); } catch (e) { return null; } }
  function inputHeld() {
    var g = gim(); if (!g) return "";
    try { if ((Number(g.UIActionFlag) & Number(cs.NOAH.Input.LockFlag.AsyncLoading)) != 0) return "the game is still loading (" + g.CurInputGroupName + ")"; } catch (e) {}
    return "";
  }
  // after a stock window has opened: false only on evidence that the game's controls are elsewhere (still held by a
  // load, or another input group than the window's own when it has one)
  function inputAt(w) {
    if (inputHeld()) return false;
    var g = gim(), own = null; try { own = w && w.InputGroup; } catch (e) {}
    if (!g || !own) return true;
    try { var cur = g.CurInputGroup; return !!cur && !cur.Equals(null) && cur.Equals(own); } catch (e) { return true; }
  }
  function inputWhere() { var g = gim(); try { return g ? g.CurWindowInputGroupBelong + " / " + g.CurInputGroupName + ", UI lock " + Number(g.UIActionFlag) : "?"; } catch (e) { return "?"; } }
  // the pause menu (Save & Return, Give up) does not open over the lobby's Entropy menu or shop: its Save & Return took
  // the player to the room's start with the menu still on screen (Geokit, 2026-10-18)
  function hookPause() {
    try {
      var P = require("Window/PDAssistant").default.prototype;
      if (!P.__bb4init) P.__bb4init = P.InitWindow;
      P.InitWindow = function () {
        var r = P.__bb4init.apply(this, arguments);
        if (G.BB4UI && G.BB4UI.overStock && G.BB4UI.overStock()) {
          log("pause menu not opened over the lobby's " + G.BB4UI.overStock());
          setTimeout(function () { try { require("Core/UIUtil").default.RecycleWindowByName("PDAssistant"); } catch (e) {} }, 0);
        }
        return r;
      };
    } catch (e) { log("pause hook: " + es(e)); }
  }
  S.overStock = function () { return S.heatW || S.heatOpening ? "Entropy menu" : S.picking && S.shopN && S.shopOn ? "shop" : ""; };
  // a menu a fight took down (the scene changed under it) or an open that never finished: forgotten, so Entropy opens
  // again after a run (the 10-23 triage: "Entropy can't be opened after a run") and the pause menu is not refused
  function heatStale() {
    if (S.heatW) { var up = false; try { up = !!(S.heatW.CsObj && !S.heatW.CsObj.Equals(null) && S.heatW.CsObj.gameObject.activeInHierarchy); } catch (e) {} if (!up) { log("Entropy menu: the last one is gone"); S.heatW = null; } }
    if (S.heatOpening && now() - S.heatOpening > 5) { log("Entropy menu: the last open never finished"); S.heatOpening = false; }
  }
  function openHeat() {
    var HU = require("GamePlay/Heat/HeatUtil").default, HM = require("GamePlay/Heat/HeatMenu").default, UIU = require("Core/UIUtil").default;
    var held = inputHeld();
    if (held) { log("Entropy menu not opened: " + held); toast("The game is still loading. Try Entropy again in a moment"); return; }
    heatStale();
    if (S.heatOpening || S.heatW) return;
    S.close(true); hookBacks(); hookPause(); S.heatOpening = Math.max(now(), 0.01);
    // the game's own way in, the one the Entropy device in the Mind Training room uses (HeatUtil.OpenHeat): the hero
    // locked in its touch pose, the room's Entropy camera, then the menu with its first row selected. Its own way out
    // (ExitHeatMenu: back, or Save) unlocks the hero and turns the camera back; heatBack brings the lobby screen back.
    Promise.resolve().then(function () { return HU.OpenHeat(); }).then(function () {
      S.heatOpening = false;
      var w = UIU.FindWindow(HM);
      if (!w) { log("Entropy menu: the game did not open it"); unlockHero(); S.open(); return; }
      S.heatW = w; S.heatAt = now(); log("Entropy menu open");
      setTimeout(function () {
        if (S.heatW !== w || inputAt(w)) return;
        log("Entropy menu has no controls: they are at " + inputWhere() + "; closed");
        toast("The Entropy menu didn't get the controls. Try again in a moment");
        try { HU.ExitHeatMenu(w); } catch (e) { log("Entropy menu close: " + es(e)); S.heatW = null; unlockHero(); S.open(); }
      }, 1200);
    }, function (e) { S.heatOpening = false; log("Entropy menu: " + es(e)); unlockHero(); S.open(); });
  }
  function heatClosed() {                          // the stock menu closed itself (its own back button)
    if (!S.heatW) return;
    var on = false; try { on = !!(S.heatW.CsObj && S.heatW.CsObj.gameObject.activeInHierarchy); } catch (e) {}
    if (on || now() - S.heatAt < 0.5) return;
    S.heatW = null;
    try { var r = G.BB4F.runSummary() || {}; r.rules = S.rules(); G.BB4L.setRun(r); log("run settings: " + JSON.stringify(r)); } catch (e) { log("run settings: " + es(e)); }
    S.open();
  }
  // start: the cards flash in turn, 4 frames apart (36-frame clip), then the fight
  function blockedPicks() {
    var L = G.BB4L, ms = members();
    return ms.filter(function (m) { return m.hero && !L.heroCheck(m.hero, ms).ok; });
  }
  // players whose game does not have the mode the host set in Entropy (Grim or Endless without its mod); the host's
  // unlocks decide otherwise (T8, 2026-10-18). Members with no list are not blocked.
  function modeMissing() {
    var mode = -1, name = "";
    try { var HU = require("GamePlay/Heat/HeatUtil").default, M = require("Gen/pbdef").EBreedDungeonMode; mode = HU.CurBattleMode | 0; name = String(M[mode] || ""); } catch (e) { return { who: [], name: "" }; }
    if (mode == 104) name = "Grim of the Abyss"; else if (mode == 105) name = "Endless";
    return { who: members().filter(function (m) { return Array.isArray(m.modes) && m.modes.indexOf(mode) < 0; }), name: name || ("mode " + mode) };
  }
  function startFight() {
    if (!isHost() || S.starting) return;
    var held = inputHeld();
    if (held) { log("can't start: " + held); toast("Your game is stuck on a load, so the run can't start. Restart the game and host again"); return; }
    var bl = blockedPicks();
    if (bl.length) { log("can't start: " + S.whyLong(G.BB4L.heroCheck(bl[0].hero, members()))); openRules("mods"); S.rfocusHero = bl[0].hero; return; }   // the board says why
    var mm = modeMissing();
    if (mm.who.length) {
      var names = mm.who.map(function (m) { return B.safe(m.name || m.id, 32); }).join(", ");
      toast(names + (mm.who.length == 1 ? " doesn't" : " don't") + " have " + mm.name + " installed. Pick another mode in Entropy");
      log("can't start: " + names + " without " + mm.name); return;
    }
    // a player still on their end screen: a new start now would settle their run as a quit (its Evotype lost, the
    // clear not counted). FF.hostStart refuses it too; asked here first so the screen stays open (Force start as well)
    var fin = ""; try { fin = G.BB4F && G.BB4F.startBlock ? G.BB4F.startBlock() : ""; } catch (e) {}
    if (fin) { toast(fin + " still on the results screen. Start once their run is saved"); log("can't start: " + fin + " on the end screen"); return; }
    S.starting = true;
    S.cards.forEach(function (k, j) { if (k.id) setTimeout(function () { shot(k, "Start"); }, j * 4 * F * 1000); });
    setTimeout(function () { S.starting = false; try { G.BB4F.hostStart(); } catch (e) { log("start: " + es(e)); } S.close(); }, 620);
  }

  // ---- cursor ----
  S.zone = "cards"; S.cur = 0; S.scroll = 0; S.scrollT = 0;
  S.move = function (dx, dy) {
    if (panOn()) { G.BB4PAN.move(dx, dy); return; }
    if (S.pick && evoOn()) { G.BB4EVO.move(S, dx, dy); return; }
    if (S.pick && G.BB4HL && G.BB4HL.on(S)) { G.BB4HL.move(S, dx, dy); return; }   // the hero list: a row, or a page
    if (S.pick && S.pick.step == "hero" && !legacyTab() && v5on()) {
      if (S.tabFocus) { if (dx) tabStep(dx); else if (dy < 0) S.tabFocus = false; return; }
      if (dy > 0 && Math.floor(S.pick.i / selCols()) == 0) { S.tabFocus = true; if (G.BB4SEL) G.BB4SEL.sfx("sfx_ui_51"); return; }
    }
    if (S.pick) { if (legacyTab()) legacyMove(dx, dy); else if (dy && S.pick.step == "hero") stepRow(-dy); else stepPick(dy ? -dy * selCols() : dx); return; }   // the hero grid: up and down a row, left and right one
    if (S.rulesOpen) { var nr = S.rcount() + 1; if (dy) S.rcur = (S.rcur + (dy > 0 ? -1 : 1) + nr) % nr; if (dx && S.rtab == "rules" && RULES[S.rcur]) setRule(S.rcur, dx); return; }
    if (S.menu.activeSelf) { S.mcur = (S.mcur + (dy > 0 ? -1 : dy < 0 ? 1 : 0) + 3) % 3; return; }
    var n = places();
    if (S.zone == "cards") {
      if (dx) S.cur = clamp(S.cur + dx, 0, n - 1);
      if (dy < 0) { S.zone = "bar"; S.cur = 0; }
    } else {
      if (dx) S.cur = clamp(S.cur + dx, 0, S.barN - 1);
      if (dy > 0) { S.zone = "cards"; S.cur = 0; }
    }
  };
  // a page of cards at a time (the bumpers): as many as the view holds
  S.page = function (d) {
    if (panOn()) { G.BB4PAN.page(d); return; }
    if (S.pick && evoOn()) {
      // 0.1.17 (Fury, 2026-11-11: "Pressing L/R ... could swap between Legacy 1 and 2"): on the v5 Legacy menu LB / RB
      // (Q / E) go from Legacy I to Legacy II and back; the list's order has its own button there
      var E5 = G.BB4E5;
      if (E5 && E5.st && E5.st.shown) {
        var p5 = S.pick, to5 = p5.step == "evo1" ? "evo2" : "evo1";
        if (to5 == "evo2" && !p5.evo) { toast("Set Legacy I first"); try { G.BB4SEL.sfx("sfx_ui_13"); } catch (e5) { } }
        else if (S.v5Step(to5)) { try { G.BB4SEL.sfx("sfx_ui_51"); } catch (e6) { } }
        return;
      }
      G.BB4EVO.page(S, d); return;
    }
    if (S.pick && G.BB4HL && G.BB4HL.on(S)) { G.BB4HL.page(S, d); return; }   // the hero list: LB / RB change its order
    if (S.pick) { if (legacyTab()) legacySort(); else tabStep(d); return; }   // the hero step: LB / RB switch the tab
    if (S.rulesOpen) { S.rtabSwitch(); return; }
    if (S.menu.activeSelf) return;
    var n = places(), R = row(n), vis = Math.max(1, Math.floor((R.vh * 2 - BW * R.s) / R.step) + 1);
    if (S.zone != "cards") { S.zone = "cards"; S.cur = 0; }
    S.cur = clamp(S.cur + d * vis, 0, n - 1);
  };
  S.press = function () {
    if (panOn()) { G.BB4PAN.press(); return; }
    if (S.pick && evoOn()) { G.BB4EVO.press(S); return; }
    if (S.pick) {
      if (legacyTab()) { if (S.rcur >= S.pick.list.length) { cancelPick(); return; } S.pick.i = S.rcur; }
      confirmPick(); return;
    }
    if (S.rulesOpen) {
      if (onlineTab()) {
        if (S.rcur >= S.rcount()) { S.back(); return; }
        if (S.rtab == "sessions") joinEntry((S.slist || [])[S.rcur]); else { var orow = (S.orows || [])[S.rcur]; if (orow && orow.act) orow.act(); }
        return;
      }
      if (S.rcur >= S.rcount()) { closeRules(); return; }
      if (S.rtab == "rules") { var R0 = RULES[S.rcur]; setRule(S.rcur, 0, (ruleIdx(R0, S.rules()) + 1) % R0.o.length); }
      return;
    }
    if (S.menu.activeSelf) {
      var k = S.cards[S.menuCard], L = G.BB4L;
      if (S.menuMine) { S.menu.SetActive(false); if (S.mcur == 0) startPick(); else if (S.mcur == 1) openColours(); return; }
      if (S.mcur == 0 && k.id) { L.kick(k.id); toast("removed " + k.name_t.text + " from the lobby"); }
      if (S.mcur == 1 && k.id) { L.makeHost(k.id); toast(k.name_t.text + " is the host now"); }
      S.menu.SetActive(false); return;
    }
    if (S.zone == "bar") { var b = S.btns[S.cur]; if (b && G.BB4UI3D) { try { G.BB4UI3D.press(S, S.cur); } catch (e) {} } if (b && b.act) b.act(); return; }
    var c = S.cards[S.cur];
    // the player's own card: Hero and Legacies, or Colours (the skin picker of fourlobby.js) when this build has it
    var mine = c.id && c.id == meId() && G.BB4L && G.BB4L.openSkinPicker;
    if (c.id && (mine || (c.id != meId() && isHost()))) {
      S.menuCard = S.cur; S.menuMine = !!mine; S.mcur = mine ? 0 : 2;
      ["Kick", "Make host", "Cancel"].forEach(function (s, j) { S.menuItems[j].t.text = mine ? ["Hero and Legacies", "Colours", "Cancel"][j] : s; });
      S.menuRt.anchoredPosition = new UE.Vector2(c.pos.x - S.scroll + 30, c.pos.y + FLOOR - 540 + CH * c.pos.s * 0.5); S.menuRt.SetAsLastSibling(); S.menu.SetActive(true);
    }
    else if (c.id == meId()) startPick();
    else if (!c.id && isHost()) invite();
  };
  S.back = function () {
    if (panOn()) { G.BB4PAN.back(); return; }
    if (S.pick && evoOn()) { G.BB4EVO.back(S); return; }
    if (S.pick) { cancelPick(); return; }
    if (S.rulesOpen && S.rtab == "sessions" && S.onlinePage) { S.rtab = "online"; S.rcur = 1; S.mtop = 0; return; }
    if (S.rulesOpen && S.onlinePage) { S.close(); return; }
    if (S.rulesOpen) { closeRules(); return; }
    if (S.menu.activeSelf) { S.menu.SetActive(false); return; }
    if (S.zone == "bar") { S.zone = "cards"; S.cur = 0; return; }
    S.close();
  };
  // a named action, as the buttons and the prompt row call them (also for scripted tests)
  S.act = function (a) {
    if (panOn()) { if (a == "confirm") S.press(); else if (a == "cancel") S.back(); else if (a == "pageL" || a == "pageR") S.page(a == "pageL" ? -1 : 1); else G.BB4PAN.act(a); return; }
    if (S.solo) {                                                   // the game's own select: X the wardrobe, Intel, Video
      if (a == "loadout") a = "colours";
      if (a == "colours" || a == "detail" || a == "movie" || a == "partner" || a == "crystals" || a == "filters" || a == "view") { soloAct(a); return; }
    }
    if (S.pick && a != "confirm" && a != "cancel" && a != "pageL" && a != "pageR") return;   // the pick holds the screen until A or B
    if (S.onlinePage && a != "confirm" && a != "cancel" && a != "pageL" && a != "pageR") { if (a == "loadout" && !S.listBusy) { S.refreshList(); toast("Refreshing the lobby list..."); } return; }
    ({ confirm: S.press, cancel: S.back, pageL: function () { S.page(-1); }, pageR: function () { S.page(1); },
       start: function () { if (S.rulesOpen) return; if (isHost()) forceStart(members().filter(function (x) { return !x.host && !x.ready; }).length); else toggleReady(); }, ready: toggleReady,
       loadout: function () { if (!S.rulesOpen) pickLoadout(); }, colours: function () { if (!S.rulesOpen) openColours(); }, invite: invite, rules: function () { S.rulesOpen ? closeRules() : openRules(); } })[a]();
  };

  // ---- input: the game's Rewired actions for player 1 (keyboard and gamepad) ----
  // ids from ReInput.mapping (probe 2026-10-17): Confirm 9, Cancel 10, TabLeft 16, TabRight 17, UIDetail 24 (Y / Tab),
  // FightStart 25 (X / Space), InviteFriend 42 (LT / I), PVPReady 49 (Back / R); MoveX/Y 0/1, NavigateX/Y 34/35
  // 16 and 17 are the Rewired actions the stock select's own BtnTabLeft / BtnTabRight answer (observed in game, window 2,
  // 2026-11-02: R.BtnTabLeft.ActionId = 16, R.BtnTabRight.ActionId = 17): LB / RB here is the same input as theirs
  // 30 SwitchMode (X / X) is what the stock BtnShowCCF answers. In the solo select Y (33) previews the colours and X (30)
  // plays the video (the lead, 2026-11-02: "preview a character's color variations using the Y button"). 73 SwitchRoles
  // (Right Stick Button / R) is Mind Crystals there. Y was bound to 24 and 33 and View to 27 and 49, and the first action in
  // the check order always won, so Colours and Mind Crystals could not be reached on a pad (observed in game, window 2,
  // 2026-11-02). 24 (loadout) and 49 (ready) stay for the lobby, where the solo list is not read.
  // 2026-11-07: 33 is the game's PlayVideo (RewiredConsts.Action, dump.cs), the action of the stock select's own Video button,
  // and testers found Colours and Video on one button with only Video answering. Colours moved to 59 ChangeSkin_Space_RT,
  // the game's own change-skin action (RT / Space by its name; the binding is read from the player's map, not observed yet),
  // and C. 33 is the Legacy page's Filters only; the hero step's Y is the list view through 24 on a pad and L on a keyboard
  // ("pad": only while a pad is the last controller used, because 24 is also Tab, Intel's key). The solo screen reads the
  // hero step's actions or the Legacy page's, never both, so one press is one action
  var BTN = [[9, "confirm"], [10, "cancel"], [16, "pageL"], [17, "pageR"], [25, "start"], [24, "loadout"], [42, "invite"], [49, "ready"], [27, "detail"], [59, "colours"], [33, "filters"], [24, "view", "pad"], [30, "movie"], [42, "partner"], [73, "crystals"]];
  function rwp() { try { return cs.Rewired.ReInput.players.GetPlayer(0); } catch (e) { return null; } }
  function lock(on) {
    if (!!S.locked == on) return;
    try { require("Core/Util").U.SetAllActionLock(on, cs.NOAH.Input.LockFlag.SpecialLogic); S.locked = on; log("game input " + (on ? "locked (lobby screen open)" : "released")); }
    catch (e) { log("input lock: " + es(e)); }
  }
  var nav = { d: "", t: 0 };
  function steer(dx, dy) {                         // a held direction repeats after 0.32 s, then every 0.1 s
    var key = dx + "," + dy, t = UE.Time.unscaledTime;
    if (!dx && !dy) { nav.d = ""; return; }
    if (key != nav.d) { nav.d = key; nav.t = t + 0.32; S.move(dx, dy); }
    else if (t >= nav.t) { nav.t = t + 0.1; S.move(dx, dy); }
  }
  function axis(p, id) { try { return p.GetAxis(id); } catch (e) { return 0; } }
  // A press is read as "held now, not held at the last check", never as the one-frame "pressed" flag. The script timer
  // does not run every frame: at 144 frames a second it ran on 95 of 282 (probe 2026-10-17), so two presses in three
  // of A, B, Esc and the mouse were lost (testers: "you gotta spam click"). A held state lasts the whole press.
  // Each action takes its Rewired button (pad and keyboard as the player set them) and fixed keys, as one held state.
  var KEYS = { confirm: ["Return", "KeypadEnter", "J"], cancel: ["Escape", "Backspace", "K"], start: ["Space"], loadout: ["Tab"],
               pageL: ["Q"], pageR: ["E"], ready: ["R"], invite: [], detail: [], movie: [], colours: ["C"], filters: [], view: ["L"], partner: ["I"], crystals: ["R"] };
  function keyHeld(names) { var I = UE.Input, K = UE.KeyCode; for (var i = 0; i < names.length; i++) { try { if (I.GetKey(K[names[i]])) return true; } catch (e) {} } return false; }
  function held(p, a) {
    for (var j = 0; j < BTN.length; j++) if (BTN[j][1] == a) { if (BTN[j][2] == "pad" && !padNow()) continue; try { if (p && p.GetButton(BTN[j][0])) return true; } catch (e) {} }
    return keyHeld(KEYS[a] || []);
  }
  // true once per press. S.arm: the first check after the screen opens only records what is held (the A that opened it)
  function edge(name, h) { var was = S.held[name]; S.held[name] = h; return h && !was && !S.arming; }
  S.pressed = function (p, a) { return edge(a, held(p, a)); };
  function input() {
    var p = rwp(), I = UE.Input;
    // a window in the background takes no input, as the stock setting means (Rewired's ignoreInputWhenAppNotInFocus is on).
    // Rewired still reported a pad's d-pad to window 3 while another window had focus (2026-11-02: axes 34 and 0 at 1.00,
    // the cursor walking the roster and changing tabs), so the check is made here. Back in focus, the first check only
    // records what is held, as when the screen opens
    try { if (!UE.Application.isFocused) { S.arm = true; nav.d = ""; return; } } catch (e) {}
    S.arming = !!S.arm; S.arm = false;
    var acts = S.solo ? (evoOn() ? ["cancel", "confirm", "movie", "filters", "pageL", "pageR", "crystals"] : ["cancel", "confirm", "detail", "movie", "colours", "view", "pageL", "pageR", "partner", "crystals"]) : ["cancel", "confirm", "start", "loadout", "pageL", "pageR", "ready", "invite"], hit = null;
    acts.forEach(function (a) { if (S.pressed(p, a) && !hit) hit = a; });    // every edge is recorded; one action a check
    // a second B right after a stock screen handed back (the Entropy menu's Back pressed twice) closed this screen 54 ms
    // after it reopened (Soulve's window, 23:11:45 UTC): Back is not read for the first 0.4 s after a hand-back
    if (hit == "cancel" && S.quietUntil && now() < S.quietUntil) hit = null;
    if (hit) { S.act(hit); if (!S.isOpen) { S.arming = false; return; } }
    var ax = p ? (axis(p, 34) || axis(p, 0)) : 0, ay = p ? (axis(p, 35) || axis(p, 1)) : 0;
    if (!ax) ax = (keyHeld(["RightArrow", "D"]) ? 1 : 0) - (keyHeld(["LeftArrow", "A"]) ? 1 : 0);
    if (!ay) ay = (keyHeld(["UpArrow", "W"]) ? 1 : 0) - (keyHeld(["DownArrow", "S"]) ? 1 : 0);
    var dx = Math.abs(ax) > 0.55 && Math.abs(ax) >= Math.abs(ay) ? (ax > 0 ? 1 : -1) : 0, dy = !dx && Math.abs(ay) > 0.55 ? (ay > 0 ? 1 : -1) : 0;
    if (S.arming) { nav.d = dx + "," + dy; nav.t = UE.Time.unscaledTime + 0.32; } else steer(dx, dy);
    mouse();
    S.arming = false;
  }
  S.held = {};
  // the mouse: pointing moves the focus, a click presses, the wheel steps through the cards
  // the mouse test follows the drawing: with the 3D pass on, BB3D.cginc projects every corner around the screen centre
  // plus the eye offset (1600 px focal length at 1080), so the flat rect misses chips far from the centre (Geokit, chips 5-8)
  function over(rt, mp) {
    try {
      var D = G.BB4UI3D;
      if (!(D && D.ok && D.eye)) return UE.RectTransformUtility.RectangleContainsScreenPoint(rt, new UE.Vector2(mp.x, mp.y), null);
      var a = cs.System.Array.CreateInstance(T(UE.Vector3), 4); rt.GetWorldCorners(a);
      var W = UE.Screen.width, H = UE.Screen.height, sc = H / 1080, f = 1600 * sc, cx = W / 2 - D.eye[0] * 34 * sc, cy = H / 2 - D.eye[1] * 20 * sc, q = [];
      for (var i = 0; i < 4; i++) { var p = a.get_Item(i), k = f / Math.max(f + p.z, f * 0.05); q.push([cx + (p.x - cx) * k, cy + (p.y - cy) * k]); }
      var s = 0;
      for (var j = 0; j < 4; j++) { var u = q[j], v = q[(j + 1) % 4], c = (v[0] - u[0]) * (mp.y - u[1]) - (v[1] - u[1]) * (mp.x - u[0]); if (c) { if (s && (c > 0) != (s > 0)) return false; s = c; } }
      return true;
    } catch (e) { return false; }
  }
  function mouse() {
    if (!S.isOpen) return;
    try { if (!UE.Application.isFocused) return; } catch (e) {}   // as the stock input module: a window in the background ignores the pointer
    var I = UE.Input, mp, wheel = 0, click = false;
    var rclick = false;
    try { mp = I.mousePosition; wheel = I.mouseScrollDelta.y; click = edge("mouse0", I.GetMouseButton(0)); rclick = edge("mouse1", I.GetMouseButton(1)); } catch (e) { return; }
    if (rclick) { S.back(); return; }                                         // the right button backs out, as in the game's menus
    var moved = !S.mlast || Math.abs(mp.x - S.mlast.x) + Math.abs(mp.y - S.mlast.y) > 2; S.mlast = { x: mp.x, y: mp.y };
    if (S.pick && evoOn()) { G.BB4EVO.mouse(S, mp, click, wheel, moved, over); return; }
    if (panOn()) { G.BB4PAN.mouse(mp, click, wheel, moved, over); return; }
    if (S.pick && legacyTab()) {                                              // the Legacy list: rows point and click, the title switches the order
      if (wheel) S.move(0, wheel > 0 ? 1 : -1);
      if (!moved && !click) return;
      var lk = -1; S.rrows.forEach(function (row, j) { if (row.tr.gameObject.activeSelf && over(row.rt, mp)) lk = S.mtop + j; });
      if (lk < 0 && over(S.rulesDone.rt, mp)) lk = S.pick.list.length;
      if (lk >= 0) { S.rcur = lk; if (click) S.press(); }
      else if (click && over(S.titleRt, mp)) legacySort();
      else if (click && !over(S.rulesBoard.GetComponent(T(UE.RectTransform)), mp)) cancelPick();
      return;
    }
    if (S.pick) {                                                             // the wheel steps, a click on the card chooses, elsewhere backs out
      if (wheel) S.move(0, wheel > 0 ? 1 : -1);
      if (S.sel && S.sel.on) {                                                  // the character select: a head points and chooses, the card chooses, elsewhere backs out
        if (!moved && !click) return;
        // the v5 select draws and hit-tests its own heads, rows, tabs and nodes: a click is handed to it (this code would
        // test the old, hidden cells and "choose" the hero already playing: the lead, 2026-11-10)
        if (v5on()) { if (click && G.BB4S5) G.BB4S5.pend = [mp.x, mp.y]; return; }
        if (G.BB4HL && G.BB4HL.on(S)) {                                           // the list view: rows point and choose, the card chooses
          var waitL = S.solo && selBusy(true);
          if (G.BB4HL.mouse(S, mp, click, 0, moved, over, function () { if (!waitL) confirmPick(); })) return;
          if (click && over(S.sel.k.rt, mp) && !waitL) confirmPick();
          return;
        }
        var hc = -1; S.sel.cells.forEach(function (b) { if (hc < 0 && b.rt.gameObject.activeSelf && over(b.rt, mp)) hc = b.j; });
        var tc = -1; S.sel.tabs.forEach(function (tb, j) { if (tc < 0 && tb.rt.gameObject.activeSelf && over(tb.rt, mp)) tc = j; });
        if (tc >= 0) { if (click && tc != S.pick.tab) tabStep(tc - S.pick.tab); return; }
        var wait = S.solo && selBusy(true);                                       // the same test as soloConfirm: a click that waits is dropped
        if (hc >= 0) { if (hc != S.pick.i) stepPick(hc - S.pick.i); if (click && !wait) { confirmPick(); if (S.sel.hold) S.sel.hold.mouse = true; } }
        else if (click) { if (over(S.sel.k.rt, mp)) { if (!wait) { confirmPick(); if (S.sel.hold) S.sel.hold.mouse = true; } } else if (!S.solo) cancelPick(); }
        return;
      }
      if (click) { var mk = S.cards[S.cur]; if (mk && over(mk.rt, mp)) confirmPick(); else cancelPick(); }
      return;
    }
    if (wheel) { if (S.rulesOpen) S.move(0, wheel > 0 ? 1 : -1); else { if (S.zone != "cards") { S.zone = "cards"; } S.move(wheel > 0 ? -1 : 1, 0); } }
    if (!moved && !click) return;
    var hit = null;
    if (S.rulesOpen) {
      if (click && over(S.titleRt, mp)) { hit = function () { S.rtabSwitch(); click = false; }; }
      S.rrows.forEach(function (row, j) {
        if (!row.tr.gameObject.activeSelf) return;
        var k = S.rtab == "mods" || onlineTab() ? S.mtop + j : j;
        if (S.rtab == "rules") row.chips.forEach(function (c, ci) { if (!hit && over(c.rt, mp)) hit = function () { S.rcur = k; if (click) { setRule(k, 0, ci); click = false; } }; });
        if (!hit && over(row.rt, mp)) hit = function () { S.rcur = k; if (click && !onlineTab()) click = false; };
      });
      if (!hit && over(S.rulesDone.rt, mp)) hit = function () { S.rcur = S.rcount(); };
    }
    else if (S.menu.activeSelf) S.menuItems.forEach(function (b, j) { if (!hit && over(b.rt, mp)) hit = function () { S.mcur = j; }; });
    else {
      for (var j = 0; j < (S.barN || 0) && !hit; j++) if (over(S.btns[j].rt, mp)) (function (jj) { hit = function () { S.zone = "bar"; S.cur = jj; }; })(j);
      var n = places(), order = [S.zone == "cards" ? S.cur : -1]; for (var i = 0; i < n; i++) order.push(i);
      order.forEach(function (i) { var k = S.cards[i]; if (!hit && k && k.tr.gameObject.activeSelf && over(k.rt, mp)) hit = function () { S.zone = "cards"; S.cur = i; }; });
    }
    if (hit) { hit(); if (click) S.press(); }
    else if (click && S.rulesOpen && !S.onlinePage && !over(S.rulesBoard.GetComponent(T(UE.RectTransform)), mp)) closeRules();
  }

  // ---- the prompt row: the game's own button pictures for the controller in use, bottom right ----
  function glyphStore() { if (S.gst && !S.gst.Equals(null)) return S.gst; try { S.gst = UE.Object.FindObjectOfType(T(cs.GamePlay.Controller.ControllerGlyphStore), true); } catch (e) {} return S.gst; }
  function glyph(p, ctl, id) {
    if (id < 0) return null;   // a fixed key with no Rewired action: KEYNAME names it
    try {
      var m = p.controllers.maps.GetFirstElementMapWithAction(ctl, id, true); if (!m) return null;
      var st = glyphStore(), g = st ? st.GetGlyphEntry(m, puerts.$ref(null)) : null, sp = g ? g.GetGlyph(0) : null;
      // the store fills a sprite only once a stock screen has shown it (Mind Crystals showed "[Enter]" on 2026-11-02);
      // its path, "UI/Atlas/Control/Control.KB_Return_PB_1", loads the same picture at any time
      if ((!sp || sp.Equals(null)) && g) { var pa = String(g.GetPath(0) || ""), d = pa.lastIndexOf("."); if (d > 0) sp = spriteOf([pa.slice(0, d), pa.slice(d + 1)]); }
      return { sp: sp && !sp.Equals(null) ? sp : null, key: String(m.elementIdentifierName || "") };
    } catch (e) { return null; }
  }
  // when the game has no picture or name for a button (testers saw "[?]"): the fixed keys this screen reads, or the pad's
  var KEYNAME = { 9: ["Enter", "A"], 10: ["Esc", "B"], 16: ["Q", "LB"], 17: ["E", "RB"], 25: ["Space", "X"], 24: ["Tab", "Y"], 30: ["X", "X"], 49: ["R", "Back"], 73: ["R", "R3"], 42: ["I", "LT"],
    33: ["V", "Y"], 27: ["Tab", "View"], 59: ["Space", "RT"], "-1": ["L", "Y"] };   // -1: the list view, a fixed key with no Rewired action   // 33 Colours / Filters, 27 Intel: the keyboard keys read from player 0's map, window 3, 2026-11-02
  function keyName(ctl, id) {
    var pad = false; try { pad = String(ctl.type).indexOf("Joystick") >= 0 || ctl.type == 2; } catch (e) {}
    var k = KEYNAME[id]; return k ? k[pad ? 1 : 0] : "?";
  }
  function lastController(p) {
    if (S.forcePad) try { var js = p.controllers.Joysticks; if (js.Count > 0) return js.get_Item(0); } catch (e) {}   // test recordings: the pad's pictures with no pad pressed
    try { var c = p.controllers.GetLastActiveController(); if (c && c.type != 1) return c; } catch (e) {}   // the mouse holds none of these buttons: its prompts are the keyboard's
    try { return p.controllers.Keyboard; } catch (e) { return null; }
  }
  function buildPrompts() {
    var rt = node(S.ui, "Prompts"); rt.anchorMin = rt.anchorMax = new UE.Vector2(1, 0); rt.pivot = new UE.Vector2(1, 0.5);
    rt.anchoredPosition = new UE.Vector2(-56, 34); rt.sizeDelta = new UE.Vector2(10, 40); S.promptT = rt; S.prompts = [];
    // this game's Four Player version, bottom left, level with the prompts (Soulve, 2026-10-18: "shows your active four
    // player mode version on the bottom left of the screen"): two games meet only on the same version
    var vt = node(S.ui, "T_Ver"); vt.anchorMin = vt.anchorMax = new UE.Vector2(0, 0); vt.pivot = new UE.Vector2(0, 0.5);
    vt.anchoredPosition = new UE.Vector2(56, 34); vt.sizeDelta = new UE.Vector2(600, 40); S.verT = vt;
    S.ver = txt(S.ui, "T_Ver", 22, [0.75, 0.72, 0.82], cs.TMPro.TextAlignmentOptions.Left, 0); S.ver.text = B.VER ? "Four Player " + B.VER : "Redux Menus " + B.MENUS;
  }
  function promptItems() {
    if (panOn()) return G.BB4PAN.prompts();
    if (S.solo && S.pick && S.pick.partner) { var to = G.BBTAG && G.BBTAG.opts ? G.BBTAG.opts() : {}; var ip = [[9, "Choose partner"], [10, "Back"]]; if ((S.pick.tabs || []).length > 1) ip.push([16, "", 17, "Switch tab"]); if (to.on) ip.push([42, "Tag Mode off"]); return ip; }
    if (S.pick && evoOn()) return G.BB4EVO.prompts(S);
    if (S.pick && legacyTab()) return [[9, "Choose"], [10, "Back"], [16, "", 17, S.pick.sort == "hero" ? "Best score first" : "By hero"]];
    if (S.pick && S.pick.step == "hero" && S.sel) {
      var lk = lockOf(S.pick.list[S.pick.i]), it0 = [[9, lk && lk.locked ? (lk.dlc ? "DLC" : lk.can && S.solo ? "Hold to unlock" : "Locked") : "Choose"], [10, "Back"]];
      if ((S.pick.tabs || []).length > 1) it0.push([16, "", 17, "Switch tab"]);
      if (S.solo) { if (G.BB4HL && !S.pick.partner) it0.push([padNow() ? 24 : -1, G.BB4HL.on(S) || (v5on() && B.opt("heroView") == "list") ? "Grid" : "List"]); it0.push([59, "Colours"], [27, "Intel"]); if (G.BB4SEL && G.BB4SEL.hasMovie(S.pick.list[S.pick.i])) it0.push([30, "Video"]);
        if (G.BB4PAN && G.BB4PAN.tagOn()) it0.push([42, "Partner"]); if (G.BB4PAN) it0.push([73, "Mind Crystals"]); }
      return it0;
    }
    if (S.pick) return [[9, "Choose"], [10, "Back"]];
    if (S.rulesOpen && S.onlinePage) return [[9, S.rtab == "sessions" ? "Join" : "Select"], [10, S.rtab == "sessions" ? "Back" : "Close"], [24, "Refresh"], [16, "", 17, "Switch tab"]];
    if (S.rulesOpen) return [[9, isHost() && S.rtab == "rules" ? "Change" : "Select"], [10, "Back"], [16, "", 17, "Switch tab"]];
    if (S.menu.activeSelf) return [[9, "Select"], [10, "Back"]];
    var it = [[9, "Select"], [10, "Back"], [25, isHost() ? "Start" : "Ready"], [24, "Loadout"]];
    if (row(places()).over) it.push([16, "", 17, "Scroll"]);
    return it;
  }
  function drawPrompts() {
    var p = rwp(); if (!p) { S.promptT.gameObject.SetActive(false); return; }
    // the 52 px pictures clear the screen edge; on the v5 select and Legacy screens the row also stands clear of the mark
    // in the right panel's bottom corner, which lay under the last prompt
    var v5p = false; try { v5p = !!(S.solo && G.BB4S5 && G.BB4S5.on && G.BB4S5.on(S)); } catch (e5) { }
    var lg = evoOn(), ctl = lastController(p), it = promptItems(), sig = (lg ? "L" : "") + (v5p ? "5" : "") + (ctl ? ctl.name : "") + "|" + JSON.stringify(it);
    if (sig == S.promptSig) return; S.promptSig = sig;
    // BB4_TESTW (a test's layout width, see fourselect5.js): the row moves in with the narrower layout
    var tw5 = G.BB4_TESTW ? (UE.Screen.width * 1080 / Math.max(1, UE.Screen.height) - G.BB4_TESTW) / 2 : 0;
    S.promptT.anchoredPosition = new UE.Vector2((v5p ? -150 : -56) - (v5p ? tw5 : 0), lg ? 52 : 34);
    var parts = []; it.forEach(function (x) { for (var j = 0; j < x.length; j += 2) parts.push({ id: x[j], label: x[j + 1] }); });
    while (S.prompts.length < parts.length) {
      var q = node(S.promptT, "P" + S.prompts.length), im = node(q, "Glyph").gameObject.AddComponent(T(UI.Image)); im.preserveAspect = true; im.raycastTarget = false;
      var ln = node(q, "T_P"); var t = txt(q, "T_P", 24, [0.88, 0.86, 0.94], null, 0); var kn = node(q, "T_K"); var kt = txt(q, "T_K", 20, [1, 1, 1], cs.TMPro.TextAlignmentOptions.Center, 1);
      S.prompts.push({ rt: q, im: im, t: t, kt: kt });
    }
    var x = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var P = S.prompts[i], g = glyph(p, ctl, parts[i].id);
      P.rt.gameObject.SetActive(true); P.t.text = parts[i].label;
      var lw = parts[i].label ? P.t.GetPreferredValues(parts[i].label).x + 8 : 0;
      P.t.rectTransform.sizeDelta = new UE.Vector2(lw, 36); P.t.rectTransform.anchoredPosition = new UE.Vector2(-lw / 2, 0);
      var gs = lg ? 76 : 68, gw = gs;   // the button fills about half its 64 px picture: 68 draws it near 1.5x the label's capitals (52 read small, the lead 2026-11-03)
      if (g && g.sp) { P.im.sprite = g.sp; P.im.gameObject.SetActive(true); P.kt.text = ""; }
      else { P.im.gameObject.SetActive(false); P.kt.text = "[" + ((g && g.key) || keyName(ctl, parts[i].id)) + "]"; gw = P.kt.GetPreferredValues(P.kt.text).x + 6; }
      P.im.rectTransform.sizeDelta = new UE.Vector2(gs, gs); P.im.rectTransform.anchoredPosition = new UE.Vector2(-lw - gs / 2 - 2, 0);
      P.kt.rectTransform.sizeDelta = new UE.Vector2(gw, 36); P.kt.rectTransform.anchoredPosition = new UE.Vector2(-lw - gw / 2 - 2, 0);
      P.rt.anchoredPosition = new UE.Vector2(-x, 0); x += lw + gw + (i > 0 && !parts[i - 1].label ? (lg ? 12 : 6) : (lg ? 36 : 30));   // the gap between the two glyphs of a pair (LB RB), else between items
    }
    for (var k = parts.length; k < S.prompts.length; k++) S.prompts[k].rt.gameObject.SetActive(false);
  }
  // one prompt's picture and key name for the controller in use, for screens that draw their own prompt row (fourlegkit.js)
  S.promptGlyph = function (id) { var p = rwp(); if (!p) return null; var ctl = lastController(p), g = glyph(p, ctl, id); return { sp: g && g.sp, key: (g && g.key) || keyName(ctl, id) }; };

  // ---- every frame while open ----
  function tick() {
    if (!S.isOpen) { if (S.locked) lock(false); heatClosed(); return; }
    if (G.BB4F && G.BB4F.inFight && !S.starting) { S.close(); log("closed: the fight is starting"); return; }   // every game, host or not
    lock(true);
    try { var TM = UE.Time; UE.Shader.SetGlobalFloat("_FourTimeOffset", TM.unscaledTime - TM.timeSinceLevelLoad); } catch (e) {}
    var L = G.BB4L;
    if (S.solo) {
      if (G.BB4SEL && !G.BB4SEL.stockUp() && now() - S.openAt > 1 && !panOn()) { log("solo select: the game's select is gone, closing"); soloClose(); return; }
      drawPrompts(); S.promptT.SetAsLastSibling();
      if (S.toastUntil && now() > S.toastUntil) { S.toast.text = ""; S.toastUntil = 0; }
      S.toast.transform.SetAsLastSibling(); if (G.BB4LIT && G.BB4LIT.lbFrame) G.BB4LIT.lbFrame(S, now()); input(); return;
    }
    if (S.onlinePage && L && L.state == "in") { S.onlinePage = false; closeRules(); S.openAt = now(); S.cur = 0; S.zone = "cards"; log("online page: lobby entered, lobby view"); }
    if (S.onlinePage) {
      S.title.text = "ONLINE  ·  " + B.MAX + " PLAYERS"; S.sub.text = (L && L.note) || "Not in a lobby";
      S.info.text = "Online"; S.code.text = L && !L.local && L.aceId && L.aceId() ? "Your player ID  " + L.aceId() : "";
      S.cards.forEach(function (k) { if (k.tr.gameObject.activeSelf) k.tr.gameObject.SetActive(false); });
      S.edge.forEach(function (e) { e.rt.gameObject.SetActive(false); e.trt.gameObject.SetActive(false); });
      if (!S.barCg || S.barCg.Equals(null)) S.barCg = S.barT.GetComponent(T(UE.CanvasGroup)) || S.barT.gameObject.AddComponent(T(UE.CanvasGroup));
      S.barCg.alpha = 0; drawRules(); drawPrompts(); S.rulesT.SetAsLastSibling(); S.promptT.SetAsLastSibling(); if (S.verT) S.verT.SetAsLastSibling();
      if (!S.rulesOpen) { S.close(); return; }
      if (S.toastUntil && now() > S.toastUntil) { S.toast.text = ""; S.toastUntil = 0; }
      if (G.BB4LIT && G.BB4LIT.lbFrame) G.BB4LIT.lbFrame(S, now());
      input(); return;
    }
    var ms = members(), n = places(), R = row(n);
    if (S.pick) {                                                             // the player's own card shows the hero under the cursor
      var myid = meId(), ph = pickHero();
      ms = ms.map(function (x) { if (x.id != myid) return x; var y = {}; for (var q in x) y[q] = x[q]; y.hero = ph; y.skin = skinOf(ph); y.hname = ""; y.picking = 1; y.evo = pickEvo(1); y.evo2 = pickEvo(2); return y; });
    }
    if (S.cur >= n && S.zone == "cards") S.cur = n - 1;
    scrollTo(n, R); S.scroll += (S.scrollT - S.scroll) * 0.22; if (Math.abs(S.scrollT - S.scroll) < 0.5) S.scroll = S.scrollT;
    S.title.text = "ONLINE  ·  " + B.MAX + " PLAYERS";
    if (!L || L.state != "in") { S.sub.text = (L && L.note) || "Not in a lobby"; S.info.text = ""; S.code.text = ""; }
    else {
      // left: the difficulty and Entropy, then the host (Soulve, 2026-10-17: "show the difficulty with the entropy
      // number in the top left"); right: whether the lobby is in a fight, the code and count, and the rules
      var r = L.run, host = ms.filter(function (m) { return m.host; })[0], rs = rulesShort(S.rules());
      var hn = host ? "Host  " + B.safe(host.name || host.id, 32) : "Co-op lobby";
      S.sub.text = (r && r.mode ? "<color=#ffd27a>" + B.safe(r.mode, 16) + "  ·  Entropy " + (r.level | 0) + "</color>   ·   " : "") + hn;
      var busy = !!L.started;
      S.info.text = busy ? "<color=#ff6a66>In battle</color>" : "Mind Training";
      // a player who joined during a run (Soulve's clip, 2026-10-18: "players cant join mid game"): the fight took its
      // players at its start, so this one waits for the next start, which takes every player in the lobby
      if (busy && !(G.BB4F && G.BB4F.inFight) && !S.toastUntil)
        S.toast.text = "The others are in a run. You join the next one when it starts. Pick your hero on your card while you wait";
      else if (!busy && !S.toastUntil && S.toast.text.indexOf("The others are in a run") === 0) S.toast.text = "";
      S.code.text = "Lobby " + L.code + "  ·  " + ms.length + " / " + lobbySize() + (rs ? "   ·   " + rs : "");
      if (!S.subFit) {
        // the left line stays inside its plate (it ran past it under the HOST tag): left edge kept, 470 wide
        try { var srt = S.sub.rectTransform, sw = srt.rect.width, sp = srt.anchoredPosition, left = sp.x - sw * srt.pivot.x;
              srt.pivot = new UE.Vector2(0, srt.pivot.y); srt.anchoredPosition = new UE.Vector2(left, sp.y); srt.SetSizeWithCurrentAnchors(UE.RectTransform.Axis.Horizontal, 470); } catch (e) { log("header: " + es(e)); }
      }
      if (!S.subFit) { S.subFit = 1; [S.sub, S.code].forEach(function (t) { t.enableAutoSizing = true; t.fontSizeMax = t.fontSize; t.fontSizeMin = 15; t.enableWordWrapping = false; t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis; }); }
    }
    S.cards.forEach(function (k, i) {
      var on = i < n, t0 = S.openAt + i * 4 * F;
      if (!on || now() < t0) { if (k.tr.gameObject.activeSelf) k.tr.gameObject.SetActive(false); return; }
      var m = ms[i] || null, id = m ? m.id : "";
      if (!k.tr.gameObject.activeSelf) {             // the place appears (Intro plays from the Animator's first state)
        k.tr.gameObject.SetActive(true); k.id = id; k.hero = m ? m.hero : 0; k.skin = m ? m.skin : 0; k.rd = m ? !!(m.ready || m.host) : null;
        k.shownAt = now(); k.flipUntil = 0; k.after = null; k.settledAt = 0; tr(k, "appears " + (id ? "occupied" : "empty"));
        resting(k, !!id); k.pin = now() + 6 * F; look(k, k.hero, k.skin, m);
        k.plate.gameObject.SetActive(!!id); k.chips.gameObject.SetActive(!!id); k.glyph.join.gameObject.SetActive(!id);
        if (!id) { k.glyph.wait.gameObject.SetActive(false); k.glyph.ready.gameObject.SetActive(false); }
      } else if (id != k.id) {
        if (id) {                                    // someone took this place: the card flips to its face
          k.hero = m.hero; k.skin = m.skin; look(k, k.hero, k.skin, m); k.plate.gameObject.SetActive(true); k.chips.gameObject.SetActive(true);
          k.empty.gameObject.SetActive(true); shot(k, "Join"); k.rd = !!(m.ready || m.host);
          setTimeout(function () { if (k.id) k.empty.gameObject.SetActive(false); }, 26 * F * 1000);   // the Join clip has faded it
        } else {                                     // they left: back to an empty place
          k.empty.gameObject.SetActive(true); shot(k, "Leave"); k.chips.gameObject.SetActive(false);
          setTimeout(function () { if (!k.id) k.plate.gameObject.SetActive(false); }, 6 * F * 1000);   // after the plate has faded
          k.glyph.join.gameObject.SetActive(true); k.glyph.wait.gameObject.SetActive(false); k.glyph.ready.gameObject.SetActive(false); k.rd = null;
        }
        k.id = id;
      } else if (m && (m.hero != k.hero || m.skin != k.skin)) {   // a new hero or skin: the art slides out, swaps on frame 5, slides in
        var hid = m.hero, sk = m.skin, mm = m; k.hero = hid; k.skin = sk; shot(k, "Swap");
        setTimeout(function () { look(k, hid, sk, mm); }, 5 * F * 1000);
      }
      if (m) {
        var rd = !!(m.ready || m.host);
        if (k.rd != null && rd != k.rd) shot(k, rd ? "Ready" : "Unready");
        k.rd = rd;
      }
      if (k.pin && now() < k.pin) resting(k, !!k.id);
      // the end of a flip: the truth of the card, then the shot that waited. A quiet card is also put right every
      // second or so (a clip cut by the screen closing and reopening mid-flip; the Intro is long over by then)
      if (k.flipUntil && now() >= k.flipUntil) {
        k.flipUntil = 0; settle(k);
        if (k.after && k.after.length) shot(k, k.after.shift());
      } else if (!k.flipUntil && now() - (k.shownAt || 0) > 1.5 && (!k.settledAt || now() - k.settledAt > 1)) settle(k);
      fill(k, m); place(k, n, R);
    });
    for (var d = n - 1; d >= 0; d--) S.cards[d].tr.SetAsLastSibling();
    if (S.zone == "cards" && S.cards[S.cur]) S.cards[S.cur].tr.SetAsLastSibling();
    drawEdges(n, R);
    S.menuItems.forEach(function (b, k) { lightBtn(b, S.mcur == k, false); });
    drawBar(); drawRules(); drawPrompts();
    if (!S.barCg || S.barCg.Equals(null)) S.barCg =S.barT.GetComponent(T(UE.CanvasGroup)) || S.barT.gameObject.AddComponent(T(UE.CanvasGroup));
    S.barCg.alpha += ((evoOn() ? 0 : S.rulesOpen ? 0.3 : 1) - S.barCg.alpha) * 0.25;   // the bar steps back behind the board
    if (S.rulesOpen) { S.rulesT.SetAsLastSibling(); S.promptT.SetAsLastSibling(); }
    if (S.verT) S.verT.SetAsLastSibling();
    if (S.toastUntil && now() > S.toastUntil) { S.toast.text = ""; S.toastUntil = 0; }
    if (G.BB4LIT && G.BB4LIT.lbFrame) G.BB4LIT.lbFrame(S, now());   // after drawBar: the lit button's plate and label are set here
    input();
  }

  S.open = function () {
    try {
      if (!S.root || S.root.Equals(null)) build();
      S.root.SetActive(true); S.isOpen = true; S.arm = true; S.pick = null; S.onlinePage = false; S.quietUntil = now() + 0.4; S.openAt = now(); S.zone = "cards"; S.cur = 0; S.scroll = S.scrollT = 0; S.promptSig = null;
      S.cards.forEach(function (k) { k.tr.gameObject.SetActive(false); k.pos = null; k.to = null; k.colour = null; });
      closeRules(); S.menu.SetActive(false); heatStale();
      lock(true); stockHints(false);
      log("lobby screen open (" + B.MAX + " places)");
    } catch (e) { log("open: " + es(e)); }
  };
  // forPicker: a stock screen (hero select, Entropy) opens over it and needs the input
  // closing for good (Back, Leave) also frees the hero: a lock a stock picker left must not follow the player into the
  // room (testers, 2026-10-17: "When LEAVING ONLINE lobby you are unable to MOVE in your Solo Lobby")
  S.close = function (forPicker) { if (!forPicker && S.solo) { S.solo = null; S.pick = null; try { soloParts(true); } catch (e) {} } if (S.root && !S.root.Equals(null)) S.root.SetActive(false); S.isOpen = false; lock(false); stockHints(true); if (G.BB4UI3D) G.BB4UI3D.off(); if (!forPicker) { S.closedAt = Date.now(); if (stockSelectUp()) log("lobby screen closed over the game's own character or Legacy select: the hero stays locked"); else unlockHero(); log("lobby screen closed"); } };
  // The stock character select and Legacy screen lock the hero and unlock it on their own way out. A close of ours
  // over them (the Online menu opened from either) must leave that lock alone: Ghostly, 2026-10-18, "I CAN MOVE
  // DURING INHERITING LEGACIES" after the Online Lobby had opened over the Legacy screen and been closed.
  function stockSelectUp() { var O = G.BB4ON, now = Date.now(); return !!O && (now - (O.seen || 0) < 500 || now - (O.fesSeen || 0) < 500); }
  S.prefab = prefab;                               // the pause and dev menus take the lobby's light materials from it
  S.shot = function (name) {                       // a picture of the screen for the review sheet (comes out upside down)
    var w = UE.Screen.width, h = UE.Screen.height, rt = UE.RenderTexture.GetTemporary(w, h, 0);
    UE.ScreenCapture.CaptureScreenshotIntoRenderTexture(rt); var prev = UE.RenderTexture.active; UE.RenderTexture.active = rt;
    var tex = new UE.Texture2D(w, h, UE.TextureFormat.RGB24, false); tex.ReadPixels(new UE.Rect(0, 0, w, h), 0, 0, false); UE.RenderTexture.active = prev; UE.RenderTexture.ReleaseTemporary(rt);
    cs.System.IO.File.WriteAllBytes(B.ROOT + "/local_only/fourplayer/" + name + ".jpg", UE.ImageConversion.EncodeToJPG(tex, 88)); UE.Object.Destroy(tex); return w + "x" + h;
  };
  if (S.timer) clearInterval(S.timer);
  S.timer = setInterval(function () { try { tick(); if (S.isOpen) { stockHints(false); drawSel(); if (S.evo && G.BB4EVO) G.BB4EVO.draw(S); if (S.solo && G.BB4PAN) G.BB4PAN.draw(); } if (S.isOpen && S.d3 && G.BB4UI3D) G.BB4UI3D.frame(S); } catch (e) { if (!S.errAt || now() - S.errAt > 5) { S.errAt = now(); log("tick: " + es(e)); } } }, 1);   // as often as the timer runs (half the frames at 144: presses are read as held states)
  // the way in: X opens the online menu (fouronline.js); once the player hosts or joins a lobby there, that menu closes
  // and this screen takes over. Leaving the lobby (Leave, a kick, the host closing it) closes this screen.
  if (S.entryTimer) clearInterval(S.entryTimer);
  S.entryTimer = setInterval(function () {
    try {
      var L = G.BB4L, inNow = !!(L && L.state == "in");
      if (inNow && !S.wasIn && !S.isOpen && !(G.BB4F && G.BB4F.inFight)) {
        var T = G.BBTR, w = T && T.dm && T.dm.win;
        if (w) { try { require("Core/UIUtil").default.RecycleWindow(w); } catch (e) { log("online menu close: " + es(e)); } }
        setTimeout(function () { if (G.BB4L && G.BB4L.state == "in" && !S.isOpen) S.open(); }, 350);
        log("lobby entered: the lobby screen takes over from the online menu");
      }
      // out of the lobby (Leave, a kick, the lobby closed) with the lobby view up: the online page, which says why
      if (!inNow && S.wasIn && S.isOpen && !S.onlinePage) S.openOnline();
      S.wasIn = inNow;
    } catch (e) { if (!S.entryErr) { S.entryErr = 1; log("entry watch: " + es(e)); } }
  }, 250);
  log("ready in window " + B.WIN);
  return "FOURUI ready";
})();
