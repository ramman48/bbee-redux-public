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

  var F = 1 / 60;                                  // one frame at 60 fps
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
    if (skin && skin != id) { var t0 = heroTexture(skin); if (t0) return t0; }
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
    buildRules(); buildPrompts();
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
    try { k.an.SetTrigger(name); } catch (e) { log("trigger " + name + ": " + es(e)); } officialFx(k, name); }
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
    k.hero_t.text = L.heroName(m.hero) || m.hname || (m.hero ? "Hero " + m.hero : "Picking a hero");
    var who = (m.name || m.id) + (m.id == my ? "  (you)" : "");
    var hc = m.hero >= 190000 ? L.heroCheck(m.hero, members()) : null;
    k.name_t.text = k.missing ? who + "  ·  <color=#ffc46b>not installed here</color>" : hc ? who + "  ·  " + "<color=#" + (hc.ok ? "8fe39a" : "ff7a7a") + ">" + (hc.ver ? "v" + hc.ver : "no mod here") + "</color>" : who;
    banner(k, hc && !hc.ok ? (hc.missing.length ? "NOT ON EVERY PC" : hc.differ.length ? "VERSIONS DIFFER" : "CHECKING MODS") : "");
    if (m.picking && S.pick) {
      var P = S.pick, cnt = "  ·  " + (P.i + 1) + " / " + P.list.length;
      if (P.step == "hero") k.name_t.text = "<color=#ffd27a>Choose a hero" + cnt + "</color>";
      else { var ev = P.list[P.i]; k.name_t.text = "<color=#ffd27a>Legacy " + (P.step == "evo1" ? "I" : "II") + ":  " + (ev ? (L.heroName(ev.id) || "Hero " + ev.id) + "  " + ev.score : "None") + cnt + "</color>"; }
    }
    k.tag_t.text = m.host ? "HOST" : "P" + (k.i + 1);
    k.crown.gameObject.SetActive(!!m.host);
    var bars = m.id == my ? 4 : m.ping == null ? 0 : m.ping < 60 ? 4 : m.ping < 120 ? 3 : m.ping < 200 ? 2 : 1;
    k.bars.forEach(function (b, j) { setA(b, j < bars ? 1 : 0.18); });
    var e = m.evo, have = [!!(e && e.id), !!(e && e.inheritSkillIndex), !!(e && e.inheritBlesses && e.inheritBlesses.length)];
    k.chips.gameObject.SetActive(have[0]);
    k.chipRims.forEach(function (r, j) { r.color = have[j] ? col(k.colour || NO_HERO) : new UE.Color(1, 1, 1, 0.55); });
    var ready = !!(m.ready || m.host);
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
  function places() { var n = members().length; return Math.min(B.MAX, Math.max(4, n + (n < B.MAX ? 1 : 0))); }
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
      it.push({ t: notReady ? "Force start  ·  " + notReady + " not ready" : "Start", act: function () { forceStart(notReady); }, start: 1 });
    } else {
      it.push({ t: m && m.ready ? "Not ready" : "Ready", act: toggleReady, start: 1 });
      it.push(rulesItem());
    }
    it.push({ t: "Leave", act: function () { L.leave(); S.openOnline(); } });
    return it;
  }
  // the host may start whenever they like; with players not ready, a second press within 3 s confirms
  function forceStart(notReady) {
    if (blockedPicks().length) { startFight(); return; }                   // says why it can't start
    if (!notReady || (S.forceAt && now() - S.forceAt < 3)) { S.forceAt = 0; startFight(); return; }
    S.forceAt = now(); toast(notReady + (notReady == 1 ? " player is" : " players are") + " not ready. Press Start again to start now");
  }
  function rulesItem() {
    var n = modIssues();
    return { t: n ? "Rules  ·  <color=#ff7a7a>" + n + (n == 1 ? " mod issue" : " mod issues") + "</color>" : "Rules", act: function () { openRules(n ? "mods" : "rules"); } };
  }
  function modIssues() { try { return blockedPicks().length; } catch (e) { return 0; } }
  function invite() { if (!isHost()) return; if (!G.BB4L.inviteOverlay()) toast("Invites go through Steam: open the overlay (Shift+Tab)"); }
  function toggleReady() { var L = G.BB4L, m = me(); if (!isHost() && L) L.setReady(!(m && m.ready)); }
  function drawBar() {
    var it = barItems(), gap = 16, ws = [], tot = -gap;
    while (S.btns.length < it.length) S.btns.push(button(S.barT, "Btn" + S.btns.length));
    it.forEach(function (x, k) {                                       // each button as wide as its label needs, 220 at least
      var tw = 0; try { tw = S.btns[k].t.GetPreferredValues(x.t).x; } catch (e) {}
      ws[k] = Math.max(x.start ? 280 : 220, tw + 90); tot += ws[k] + gap;
    });
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
               boss: ["UI/Atlas/Fight/Fight", "IconBoss"] };
  var RULES = [
    { k: "legacy", t: "Legacies", icon: "inherit", o: [[1, "On"], [0, "Off"]],
      sub: function (r) { return r.legacy ? "Players bring their Evotype's Legacy" : "No Legacy skills in this run"; },
      d: function (r) { return r.legacy ? "Each player starts with the Legacy skill of their Evotype, as in a normal run." : "Nobody starts with a Legacy skill, and none can be found in the run. Every hero plays with its own kit only."; } },
    { k: "legacyMax", t: "Legacies per player", icon: "swap", o: [[1, "1"], [2, "2"]], off: function (r) { return !r.legacy; },
      sub: function (r) { return r.legacy ? "Up to " + r.legacyMax + " each" : "Legacies are off"; },
      d: function (r) { return r.legacy ? "How many Legacy skills each player may hold. A player who brings more keeps the first " + r.legacyMax + "." : "Turn Legacies on to choose how many each player may hold."; } },
    { k: "potCap", t: "Potential cap", icon: "potential", o: [[0, "No cap"], ["half", "Half"], [4, "4"], [6, "6"], [8, "8"], [10, "10"], [12, "12"]],
      sub: function (r) { return r.potCap === 0 ? "As many as the run offers" : r.potCap == "half" ? "Half of each hero's Potentials" : "At most " + r.potCap + " each"; },
      d: function (r) { return r.potCap === 0 ? "No limit: players take Potentials as the run offers them." : "Once a player holds " + (r.potCap == "half" ? "half of their hero's Potentials" : r.potCap + " Potentials") + ", the run offers them no more; they get the game's usual reward for a full set instead."; } },
    { k: "crystals", t: "Mind Crystals", icon: "crystal", o: [[1, "On"], [0, "Off"]],
      sub: function (r) { return r.crystals ? "Each player's own Mind Crystals" : "Off for everyone"; },
      d: function (r) { return r.crystals ? "Every player keeps the Mind Crystal bonuses from their own save." : "Mind Crystal bonuses are switched off for every player for this run: everyone starts on even terms."; } },
    { k: "scale", t: "Enemy scaling", icon: "boss", o: [[0, "Off"], [1, "Light"], [2, "Strong"]],
      sub: function (r, n) { if (!r.scale) return "Enemies as in a two-player run"; var s = scaleAt(r.scale, n); return n + " players: health " + times(s.hp) + ", damage " + times(s.dmg); },
      d: function (r, n) { if (!r.scale) return "Enemies keep the stock co-op strength, however many players join."; var a = scaleAt(r.scale, 4), b = scaleAt(r.scale, 8); return "Each player past the second makes enemies and bosses tougher, on top of the Entropy level. 4 players: health " + times(a.hp) + ", damage " + times(a.dmg) + ". 8 players: health " + times(b.hp) + ", damage " + times(b.dmg) + "."; } }
  ];
  var RULES_DEFAULT = { legacy: 1, legacyMax: 1, potCap: 0, crystals: 1, scale: 0 };
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
    return out.join("  ·  ");
  }
  function ruleIdx(R, r) { for (var i = 0; i < R.o.length; i++) if (R.o[i][0] === r[R.k]) return i; return 0; }
  // d: a step (left / right), or set: an option's index (a click)
  function setRule(j, d, set) {
    var R = RULES[j]; if (!R) return;
    if (!isHost()) { toast("Only the host sets the rules"); return; }
    var r = S.rules(); if (R.off && R.off(r)) return;
    var i = set != null ? set : clamp(ruleIdx(R, r) + d, 0, R.o.length - 1);
    if (R.o[i][0] === r[R.k]) return;
    r[R.k] = R.o[i][0]; G.BB4_RULES = r;
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
  function heroLabel(c) { var L = G.BB4L, n = L.heroName(c.id); if (!n) c.who.forEach(function (w) { if (!n && w.m.hero == c.id && w.m.hname) n = w.m.hname; }); return n || "Hero " + c.id; }
  function pname(m) { return m.id == meId() ? "you" : (m.name || m.id); }
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
      host ? "You set the rules" : "Set by " + (hostM ? hostM.name || hostM.id : "the host");
    var cnt = S.rcount();
    if (mods && S.rfocusHero) { S.mlist.forEach(function (c, i) { if (c.id == S.rfocusHero) S.rcur = i; }); S.rfocusHero = 0; }
    if (mods && S.rcur < cnt) { if (S.rcur < S.mtop) S.mtop = S.rcur; if (S.rcur > S.mtop + 4) S.mtop = S.rcur - 4; }
    S.rrows.forEach(function (row, i) {
      var k = mods ? S.mtop + i : i, show = k < cnt && i < 5;
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
    return (r && r.mode ? r.mode + " · Entropy " + r.level + "  ·  " : "") + (e.started ? "<color=#ff6a66>In battle</color>" : "In the lobby") +
      "  ·  " + e.n + " / " + (e.max || B.MAX) + "  ·  " + pingText(e) + (e.ver && e.ver != L.VER ? "  ·  <color=#ff7a7a>v" + e.ver + "</color>" : "");
  }
  function whoLine(who) {
    var L = G.BB4L;
    return (who || []).map(function (w) { return (w.host ? "<color=#ffd27a>" + w.name + " (host)</color>" : w.name) + ": " + (w.hname || L.heroName(w.hero) || (w.hero ? "Hero " + w.hero : "picking a hero")); }).join("    ·    ") || "Nobody listed yet.";
  }
  function hostOf(who) { return (who || []).filter(function (w) { return w.host; })[0] || (who || [])[0] || null; }
  function joinEntry(e) {
    var L = G.BB4L, why = L.whyNot(e);
    if (why) { toast("Can't join: " + why); return; }
    S.slistAt = 0; L.joinListed(e); toast("Joining " + (e.name || "the lobby") + "..."); log("joining " + (e.local ? "lobby " + e.code : "Steam lobby " + e.sid) + " from the online page");
  }
  function onlineHero() { try { var O = G.BB4ON, h = O && O.myHero ? O.myHero() : 0; if (h && G.BB4L) G.BB4L.setHero(h); } catch (e) {} }
  function onlineRows() {
    var L = G.BB4L, la = L.last ? L.last() : null, le = lastEntry(la), n = (S.slist || []).length, rows = [];
    var lwhy = le ? L.whyNot(le) : "";
    rows.push({ k: "last", head: la ? (hostOf(le ? le.who : la.who) || {}).hero : 0, who: le ? le.who : la ? la.who : [],
      t: la ? "Rejoin " + (la.host || "your last") + "'s lobby" : "Rejoin last lobby",
      sub: !la ? "You haven't been in a lobby yet" : !S.slistAt ? "Looking for it..." : !le ? "<color=#ff7a7a>Closed: nobody is in it now</color>" : lobbyLine(le) + (lwhy ? "  ·  <color=#ff7a7a>" + lwhy + "</color>" : "  ·  <color=#8fe39a>can join</color>"),
      dis: !(le && !lwhy), act: function () { if (le) joinEntry(le); else toast(la ? "That lobby has closed" : "No last lobby yet"); },
      d: la ? whoLine(le ? le.who : la.who) + (le ? "" : "\n<color=#8a8698>Who was there when you left.</color>") : "The lobby you were in last shows here: who is in it now, their heroes, and whether you can join." });
    var open = (S.slist || []).filter(function (e) { return !L.whyNot(e); }).length;
    rows.push({ k: "all", icon: "potential", t: "See all active sessions" + (S.slistAt ? "  (" + n + ")" : ""),
      sub: !S.slistAt ? "Asking Steam..." : n ? n + (n == 1 ? " lobby" : " lobbies") + "  ·  " + open + " you can join" : "No open lobbies right now",
      act: function () { S.rtab = "sessions"; S.rcur = 0; S.mtop = 0; S.refreshList(); S.rrows.forEach(function (w) { w.focWas = null; w.sweepAt = UE.Time.unscaledTime + w.i * 0.03; }); },
      d: "Every open Four Player lobby: the host, who is in it with their heroes, the mode and Entropy, whether it is in battle, and your ping to the host." });
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
  function headSprite(id) { if (!id) return null; if (HEADS[id] !== undefined) return HEADS[id]; return (HEADS[id] = spriteOf(["UI/Atlas/EvoCharacter/EvoCharacter", "HeroHead_" + id])); }
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
      row.name.text = ses ? (it.name || "Lobby") + "   <size=70%><color=#a7a3b5>" + it.code + "</color></size>" : it.t;
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
  function skinOf(id) { try { return require("GamePlay/AvatarUtil").SkinUtil.GetCurrentSkinId(id) | 0; } catch (e) { return 0; } }
  function inMindTraining() { var E = G.BB4E; return !!(E && E.shown && Date.now() - E.shown < 1500); }
  // the steps: the hero, then Legacy I and Legacy II from the player's saved Evotypes when the lobby's rules allow them
  // (the stock Evotype screen waited on 91Act's servers at "Completing Preparation": Nocturn's clip, 2026-10-18)
  function evoOf(ev) { return ev ? { id: ev.id, uid: ev.uid, score: ev.score | 0, inheritBlesses: (ev.inheritBlesses || []).map(function (b) { return { id: b.id, quality: b.quality }; }), inheritSkillIndex: ev.inheritSkillIndex | 0, inheritSkillLevel: ev.inheritSkillLevel | 0 } : null; }
  function evoList() {
    var out = [];
    try { require("DataBinding").DB.FesActor.Values().forEach(function (x) { if (x && x.server) out.push(evoOf(x.server)); }); } catch (e) { log("Evotypes: " + es(e)); }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function legacySlots() { var r = S.rules ? S.rules() : null; return !r || r.legacy ? Math.max(1, Math.min(2, (r && r.legacyMax) || 1)) : 0; }
  function heroLabelOf(id) { var L = G.BB4L; return (L && L.heroName(id)) || "Hero " + id; }
  function sortEvos(l, by) {
    var a = l.slice();
    if (by == "hero") a.sort(function (x, y) { var hx = heroLabelOf(x.id), hy = heroLabelOf(y.id); return hx < hy ? -1 : hx > hy ? 1 : y.score - x.score; });
    else a.sort(function (x, y) { return y.score - x.score; });
    return a;
  }
  // the hero is picked on the card; Legacy I and II on the board's Legacy list (below)
  function setStep(step) {
    var p = S.pick, l, i;
    if (step == "hero") { l = p.heroes; i = l.indexOf(p.hero); }
    else {
      var other = step == "evo1" ? null : p.evo;
      l = [null].concat(sortEvos(p.evos.filter(function (e) { return !other || (e.uid != other.uid && e.id != other.id); }), p.sort));   // two Legacies: two heroes
      var cur = step == "evo1" ? p.evo : p.evo2; i = 0;
      if (cur) for (var j = 1; j < l.length; j++) if (l[j].uid == cur.uid) i = j;
    }
    p.step = step; p.list = l; p.i = i < 0 ? 0 : i;
    if (step == "hero") { if (legacyTab()) closeRules(); }
    else {
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
  function startPick() {
    var m = me(), L = G.BB4L; if (!m) return;
    S.pick = { heroes: heroList(), evos: evoList(), hero: m.hero, evo: L.me.evo || null, evo2: L.me.evo2 || null, was: m.hero };
    setStep("hero");
    S.zone = "cards"; S.cur = members().indexOf(m); S.menu.SetActive(false);
    log("hero pick open on the card (" + S.pick.heroes.length + " heroes, " + S.pick.evos.length + " Evotypes)");
  }
  function pickHero() { var p = S.pick; return !p ? 0 : p.step == "hero" ? p.list[p.i] : p.hero; }
  function pickEvo(n) { var p = S.pick; if (!p) return null; var k = n == 1 ? "evo1" : "evo2"; return p.step == k ? p.list[p.i] : n == 1 ? p.evo : p.evo2; }
  function stepPick(d) { var p = S.pick; p.i = (p.i + d + p.list.length) % p.list.length; }
  function confirmPick() {
    var L = G.BB4L, p = S.pick, m = me();
    if (!m || !p) { S.pick = null; return; }
    if (p.step == "hero") {
      var hero = p.list[p.i];
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
    S.pick = null; log("hero pick closed, loadout kept");
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
  function openHeat() {
    var HU = require("GamePlay/Heat/HeatUtil").default, HM = require("GamePlay/Heat/HeatMenu").default, UIU = require("Core/UIUtil").default;
    S.close(true); hookBacks();
    try { var w = UIU.AcquireWindow(HM); w.InitHeat(HU.CurBattleMode); S.heatW = w; S.heatAt = now(); }
    catch (e) { log("run settings: " + es(e)); S.open(); }
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
    var bl = blockedPicks();
    if (bl.length) { log("can't start: " + S.whyLong(G.BB4L.heroCheck(bl[0].hero, members()))); openRules("mods"); S.rfocusHero = bl[0].hero; return; }   // the board says why
    var mm = modeMissing();
    if (mm.who.length) {
      var names = mm.who.map(function (m) { return m.name; }).join(", ");
      toast(names + (mm.who.length == 1 ? " doesn't" : " don't") + " have " + mm.name + " installed. Pick another mode in Entropy");
      log("can't start: " + names + " without " + mm.name); return;
    }
    S.starting = true;
    S.cards.forEach(function (k, j) { if (k.id) setTimeout(function () { shot(k, "Start"); }, j * 4 * F * 1000); });
    setTimeout(function () { S.starting = false; try { G.BB4F.hostStart(); } catch (e) { log("start: " + es(e)); } S.close(); }, 620);
  }

  // ---- cursor ----
  S.zone = "cards"; S.cur = 0; S.scroll = 0; S.scrollT = 0;
  S.move = function (dx, dy) {
    if (S.pick) { if (legacyTab()) legacyMove(dx, dy); else stepPick(dy ? -dy : dx); return; }   // up the list, down it; left and right too
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
    if (S.pick) { if (legacyTab()) legacySort(); else stepPick(d * 5); return; }
    if (S.rulesOpen) { S.rtabSwitch(); return; }
    if (S.menu.activeSelf) return;
    var n = places(), R = row(n), vis = Math.max(1, Math.floor((R.vh * 2 - BW * R.s) / R.step) + 1);
    if (S.zone != "cards") { S.zone = "cards"; S.cur = 0; }
    S.cur = clamp(S.cur + d * vis, 0, n - 1);
  };
  S.press = function () {
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
      if (S.mcur == 0 && k.id) { L.kick(k.id); toast("removed " + k.name_t.text + " from the lobby"); }
      if (S.mcur == 1 && k.id) { L.makeHost(k.id); toast(k.name_t.text + " is the host now"); }
      S.menu.SetActive(false); return;
    }
    if (S.zone == "bar") { var b = S.btns[S.cur]; if (b && b.act) b.act(); return; }
    var c = S.cards[S.cur];
    if (c.id && c.id != meId() && isHost()) {
      S.menuCard = S.cur; S.mcur = 2;
      S.menuRt.anchoredPosition = new UE.Vector2(c.pos.x - S.scroll + 30, c.pos.y + FLOOR - 540 + CH * c.pos.s * 0.5); S.menuRt.SetAsLastSibling(); S.menu.SetActive(true);
    }
    else if (c.id == meId()) startPick();
    else if (!c.id && isHost()) invite();
  };
  S.back = function () {
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
    if (S.pick && a != "confirm" && a != "cancel" && a != "pageL" && a != "pageR") return;   // the pick holds the screen until A or B
    if (S.onlinePage && a != "confirm" && a != "cancel" && a != "pageL" && a != "pageR") { if (a == "loadout" && !S.listBusy) { S.refreshList(); toast("Refreshing the lobby list..."); } return; }
    ({ confirm: S.press, cancel: S.back, pageL: function () { S.page(-1); }, pageR: function () { S.page(1); },
       start: function () { if (S.rulesOpen) return; if (isHost()) forceStart(members().filter(function (x) { return !x.host && !x.ready; }).length); else toggleReady(); }, ready: toggleReady,
       loadout: function () { if (!S.rulesOpen) pickLoadout(); }, invite: invite, rules: function () { S.rulesOpen ? closeRules() : openRules(); } })[a]();
  };

  // ---- input: the game's Rewired actions for player 1 (keyboard and gamepad) ----
  // ids from ReInput.mapping (probe 2026-10-17): Confirm 9, Cancel 10, TabLeft 16, TabRight 17, UIDetail 24 (Y / Tab),
  // FightStart 25 (X / Space), InviteFriend 42 (LT / I), PVPReady 49 (Back / R); MoveX/Y 0/1, NavigateX/Y 34/35
  var BTN = [[9, "confirm"], [10, "cancel"], [16, "pageL"], [17, "pageR"], [25, "start"], [24, "loadout"], [42, "invite"], [49, "ready"]];
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
               pageL: ["Q"], pageR: ["E"], ready: ["R"], invite: [] };
  function keyHeld(names) { var I = UE.Input, K = UE.KeyCode; for (var i = 0; i < names.length; i++) { try { if (I.GetKey(K[names[i]])) return true; } catch (e) {} } return false; }
  function held(p, a) {
    for (var j = 0; j < BTN.length; j++) if (BTN[j][1] == a) { try { if (p && p.GetButton(BTN[j][0])) return true; } catch (e) {} }
    return keyHeld(KEYS[a] || []);
  }
  // true once per press. S.arm: the first check after the screen opens only records what is held (the A that opened it)
  function edge(name, h) { var was = S.held[name]; S.held[name] = h; return h && !was && !S.arming; }
  S.pressed = function (p, a) { return edge(a, held(p, a)); };
  function input() {
    var p = rwp(), I = UE.Input;
    S.arming = !!S.arm; S.arm = false;
    var acts = ["cancel", "confirm", "start", "loadout", "pageL", "pageR", "ready", "invite"], hit = null;
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
  function over(rt, mp) { try { return UE.RectTransformUtility.RectangleContainsScreenPoint(rt, new UE.Vector2(mp.x, mp.y), null); } catch (e) { return false; } }
  function mouse() {
    if (!S.isOpen) return;
    var I = UE.Input, mp, wheel = 0, click = false;
    var rclick = false;
    try { mp = I.mousePosition; wheel = I.mouseScrollDelta.y; click = edge("mouse0", I.GetMouseButton(0)); rclick = edge("mouse1", I.GetMouseButton(1)); } catch (e) { return; }
    if (rclick) { S.back(); return; }                                         // the right button backs out, as in the game's menus
    var moved = !S.mlast || Math.abs(mp.x - S.mlast.x) + Math.abs(mp.y - S.mlast.y) > 2; S.mlast = { x: mp.x, y: mp.y };
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
    try {
      var m = p.controllers.maps.GetFirstElementMapWithAction(ctl, id, true); if (!m) return null;
      var st = glyphStore(), g = st ? st.GetGlyphEntry(m, puerts.$ref(null)) : null, sp = g ? g.GetGlyph(0) : null;
      return { sp: sp && !sp.Equals(null) ? sp : null, key: String(m.elementIdentifierName || "") };
    } catch (e) { return null; }
  }
  // when the game has no picture or name for a button (testers saw "[?]"): the fixed keys this screen reads, or the pad's
  var KEYNAME = { 9: ["Enter", "A"], 10: ["Esc", "B"], 16: ["Q", "LB"], 17: ["E", "RB"], 25: ["Space", "X"], 24: ["Tab", "Y"], 49: ["R", "Back"], 42: ["I", "LT"] };
  function keyName(ctl, id) {
    var pad = false; try { pad = String(ctl.type).indexOf("Joystick") >= 0 || ctl.type == 2; } catch (e) {}
    var k = KEYNAME[id]; return k ? k[pad ? 1 : 0] : "?";
  }
  function lastController(p) {
    try { var c = p.controllers.GetLastActiveController(); if (c) return c; } catch (e) {}
    try { return p.controllers.Keyboard; } catch (e) { return null; }
  }
  function buildPrompts() {
    var rt = node(S.ui, "Prompts"); rt.anchorMin = rt.anchorMax = new UE.Vector2(1, 0); rt.pivot = new UE.Vector2(1, 0.5);
    rt.anchoredPosition = new UE.Vector2(-56, 24); rt.sizeDelta = new UE.Vector2(10, 40); S.promptT = rt; S.prompts = [];
  }
  function promptItems() {
    if (S.pick && legacyTab()) return [[9, "Choose"], [10, "Back"], [16, "", 17, S.pick.sort == "hero" ? "Best score first" : "By hero"]];
    if (S.pick) return [[9, "Choose"], [10, "Back"], [16, "", 17, "Skip 5"]];
    if (S.rulesOpen && S.onlinePage) return [[9, S.rtab == "sessions" ? "Join" : "Select"], [10, S.rtab == "sessions" ? "Back" : "Close"], [24, "Refresh"], [16, "", 17, "Switch tab"]];
    if (S.rulesOpen) return [[9, isHost() && S.rtab == "rules" ? "Change" : "Select"], [10, "Back"], [16, "", 17, "Switch tab"]];
    if (S.menu.activeSelf) return [[9, "Select"], [10, "Back"]];
    var it = [[9, "Select"], [10, "Back"], [25, isHost() ? "Start" : "Ready"], [24, "Loadout"]];
    if (row(places()).over) it.push([16, "", 17, "Scroll"]);
    return it;
  }
  function drawPrompts() {
    var p = rwp(); if (!p) { S.promptT.gameObject.SetActive(false); return; }
    var ctl = lastController(p), it = promptItems(), sig = (ctl ? ctl.name : "") + "|" + JSON.stringify(it);
    if (sig == S.promptSig) return; S.promptSig = sig;
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
      var gw = 40;
      if (g && g.sp) { P.im.sprite = g.sp; P.im.gameObject.SetActive(true); P.kt.text = ""; }
      else { P.im.gameObject.SetActive(false); P.kt.text = "[" + ((g && g.key) || keyName(ctl, parts[i].id)) + "]"; gw = P.kt.GetPreferredValues(P.kt.text).x + 6; }
      P.im.rectTransform.sizeDelta = new UE.Vector2(40, 40); P.im.rectTransform.anchoredPosition = new UE.Vector2(-lw - 22, 0);
      P.kt.rectTransform.sizeDelta = new UE.Vector2(gw, 36); P.kt.rectTransform.anchoredPosition = new UE.Vector2(-lw - gw / 2 - 2, 0);
      P.rt.anchoredPosition = new UE.Vector2(-x, 0); x += lw + gw + (parts[i].label ? 30 : 6);
    }
    for (var k = parts.length; k < S.prompts.length; k++) S.prompts[k].rt.gameObject.SetActive(false);
  }

  // ---- every frame while open ----
  function tick() {
    if (!S.isOpen) { if (S.locked) lock(false); heatClosed(); return; }
    if (G.BB4F && G.BB4F.inFight && !S.starting) { S.close(); log("closed: the fight is starting"); return; }   // every game, host or not
    lock(true);
    try { var TM = UE.Time; UE.Shader.SetGlobalFloat("_FourTimeOffset", TM.unscaledTime - TM.timeSinceLevelLoad); } catch (e) {}
    var L = G.BB4L;
    if (S.onlinePage && L && L.state == "in") { S.onlinePage = false; closeRules(); S.openAt = now(); S.cur = 0; S.zone = "cards"; log("online page: lobby entered, lobby view"); }
    if (S.onlinePage) {
      S.title.text = "ONLINE  ·  " + B.MAX + " PLAYERS"; S.sub.text = (L && L.note) || "Not in a lobby";
      S.info.text = "Online"; S.code.text = L && !L.local && L.aceId && L.aceId() ? "Your player ID  " + L.aceId() : "";
      S.cards.forEach(function (k) { if (k.tr.gameObject.activeSelf) k.tr.gameObject.SetActive(false); });
      S.edge.forEach(function (e) { e.rt.gameObject.SetActive(false); e.trt.gameObject.SetActive(false); });
      if (!S.barCg || S.barCg.Equals(null)) S.barCg = S.barT.GetComponent(T(UE.CanvasGroup)) || S.barT.gameObject.AddComponent(T(UE.CanvasGroup));
      S.barCg.alpha = 0; drawRules(); drawPrompts(); S.rulesT.SetAsLastSibling(); S.promptT.SetAsLastSibling();
      if (!S.rulesOpen) { S.close(); return; }
      if (S.toastUntil && now() > S.toastUntil) { S.toast.text = ""; S.toastUntil = 0; }
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
      var hn = host ? "Host  " + (host.name || host.id) : "Co-op lobby";
      S.sub.text = (r && r.mode ? "<color=#ffd27a>" + r.mode + "  ·  Entropy " + r.level + "</color>   ·   " : "") + hn;
      var busy = !!L.started;
      S.info.text = busy ? "<color=#ff6a66>In battle</color>" : "Mind Training";
      // a player who joined during a run (Soulve's clip, 2026-10-18: "players cant join mid game"): the fight took its
      // players at its start, so this one waits for the next start, which takes every player in the lobby
      if (busy && !(G.BB4F && G.BB4F.inFight) && !S.toastUntil)
        S.toast.text = "The others are in a run. You join the next one when it starts. Pick your hero on your card while you wait";
      else if (!busy && !S.toastUntil && S.toast.text.indexOf("The others are in a run") === 0) S.toast.text = "";
      S.code.text = "Lobby " + L.code + "  ·  " + ms.length + " / " + B.MAX + (rs ? "   ·   " + rs : "");
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
    S.barCg.alpha += ((S.rulesOpen ? 0.3 : 1) - S.barCg.alpha) * 0.25;   // the bar steps back behind the board
    if (S.rulesOpen) { S.rulesT.SetAsLastSibling(); S.promptT.SetAsLastSibling(); }
    if (S.toastUntil && now() > S.toastUntil) { S.toast.text = ""; S.toastUntil = 0; }
    input();
  }

  S.open = function () {
    try {
      if (!S.root || S.root.Equals(null)) build();
      S.root.SetActive(true); S.isOpen = true; S.arm = true; S.pick = null; S.onlinePage = false; S.quietUntil = now() + 0.4; S.openAt = now(); S.zone = "cards"; S.cur = 0; S.scroll = S.scrollT = 0; S.promptSig = null;
      S.cards.forEach(function (k) { k.tr.gameObject.SetActive(false); k.pos = null; k.to = null; k.colour = null; });
      closeRules(); S.menu.SetActive(false);
      lock(true);
      log("lobby screen open (" + B.MAX + " places)");
    } catch (e) { log("open: " + es(e)); }
  };
  // forPicker: a stock screen (hero select, Entropy) opens over it and needs the input
  // closing for good (Back, Leave) also frees the hero: a lock a stock picker left must not follow the player into the
  // room (testers, 2026-10-17: "When LEAVING ONLINE lobby you are unable to MOVE in your Solo Lobby")
  S.close = function (forPicker) { if (S.root && !S.root.Equals(null)) S.root.SetActive(false); S.isOpen = false; lock(false); if (!forPicker) { S.closedAt = Date.now(); unlockHero(); log("lobby screen closed"); } };
  S.shot = function (name) {                       // a picture of the screen for the review sheet (comes out upside down)
    var w = UE.Screen.width, h = UE.Screen.height, rt = UE.RenderTexture.GetTemporary(w, h, 0);
    UE.ScreenCapture.CaptureScreenshotIntoRenderTexture(rt); var prev = UE.RenderTexture.active; UE.RenderTexture.active = rt;
    var tex = new UE.Texture2D(w, h, UE.TextureFormat.RGB24, false); tex.ReadPixels(new UE.Rect(0, 0, w, h), 0, 0, false); UE.RenderTexture.active = prev; UE.RenderTexture.ReleaseTemporary(rt);
    cs.System.IO.File.WriteAllBytes(B.ROOT + "/local_only/fourplayer/" + name + ".jpg", UE.ImageConversion.EncodeToJPG(tex, 88)); UE.Object.Destroy(tex); return w + "x" + h;
  };
  if (S.timer) clearInterval(S.timer);
  S.timer = setInterval(function () { try { tick(); } catch (e) { if (!S.errAt || now() - S.errAt > 5) { S.errAt = now(); log("tick: " + es(e)); } } }, 1);   // as often as the timer runs (half the frames at 144: presses are read as held states)
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
