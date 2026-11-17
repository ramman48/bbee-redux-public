// redux-menus: the Entropy menu (packed by local_only\redux\ui-study\entropyv4\pack_dial.py; edit the study files, then
// pack again). The v4 Entropy Dial layers run underneath for what they own (data, clock, room, fonts, materials, navigation,
// the list view, every restore); the last layer, v5's Entropy Core (entropyv5\js\core_v5.js, docs\redux\ui-desk\
// ENTROPY_MENU_V5.md), switches the dial's ring and panels off and draws the screen: a list of every modifier, the core
// built from the game's own Entropy effects, the picked modifier's ranks. The stock menu stays underneath and takes the
// input; every figure on the screen is read from it.
(function () {
  var G = globalThis, log = function (s) { try { (G.BBLOG || console.log)(s); } catch (e) {} };
  // the installer packs the dial's bundle into the game's merged container (ab\m_mod.m); merge.json gives the file and the
  // byte offset ({"r":"ui/prefab/entropydial/entropydial.ab","m":"m_mod.m","s":<offset>}), and Unity opens a bundle at an
  // offset inside a file. The study's dev copy is used only when no installed entry exists.
  G.ED_BUNDLE_OFFSET = 0;
  G.ED_BUNDLE_PATH = function () {
    var F = CS.System.IO.File, dev = 'C:/BBEE_Steam/local_only/redux/ui-study/entropyv4/bundle/entropydial.ab';
    try {
      var ab = CS.UnityEngine.Application.streamingAssetsPath + '/ab/', mj = F.ReadAllText(ab + 'merge.json');
      var m = /"r":"ui\/prefab\/entropydial\/entropydial\.ab","m":"([^"]+)","s":(\d+)/.exec(mj);
      if (m && F.Exists(ab + m[1])) { G.ED_BUNDLE_OFFSET = +m[2]; return ab + m[1]; }
    } catch (e) { log('entropy dial: merge.json ' + e); }
    G.ED_BUNDLE_OFFSET = 0;
    return dev;
  };
  function boot() {
    try { require('GamePlay/Heat/HeatMenu'); } catch (e) { setTimeout(boot, 500); return; }
    if (G.__EDpacked) return; G.__EDpacked = 1;
    var cs = CS, layers = [];
  // ---- entropy_dial.js ----
  layers.push(['entropy_dial.js', function () {
// The Entropy Dial (layout picked by the lead 2026-10-23; direction A, Circuit cyan, picked 2026-10-24): layout and motion.
// The art (entropy_dial_art.js) and the motif layer (entropy_dial_motifs.js, motif_A.js) dress each frame. A runtime layer
// over the stock HeatMenu: the stock menu stays underneath, hidden by CanvasGroup alpha, and still takes the input (the dial
// follows its selection). It opens with every Entropy menu and plays its close before the menu exits (the hooks at the end).
// ED.start() / ED.stop() (stop puts every touched object back).
var _ed = (function () {
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, U = require('Core/Util').U;
  var X = require('Gen/Xlsx').Xlsx, HU = require('GamePlay/Heat/HeatUtil').default;
  if (globalThis.EV3 && EV3.timer) EV3.stop();
  var D = globalThis.ED || {};
  if (D.timer) D.stop();
  D = globalThis.ED = { log: [], made: [], groups: [], timer: 0, t: 0 };
  // the layout in the menu's 2560 x 1440 canvas (centre 0,0): sheet panel A scaled 1.6
  var L = D.L = { cx: 0, cy: -70, R: 368, sock: 0.81, perk: 1.22, arcY: 590, arcR: 3200, arcStep: 420, plaqueX: -860, plaqueY: 30, rightX: 870 };
  // motion, in frames at 60 fps (design numbers: the timing sheet in docs\redux\ui-desk\ENTROPY_DIAL.md)
  var F = D.F = { close: 14, open: 12, sockStep: 1, sockPop: 8, turn: 10, lift: 5, rank: 6, roll: 10, plaque: 8, halo: 3600, shift: 16, soft: 6 };
  var MODES = [1, 2, 4, 104, 105];
  var HUE = { 1: [0.62, 0.74, 0.86], 2: [0.47, 0.59, 1], 4: [0.9, 0.27, 0.24], 104: [0.31, 0.78, 0.9], 105: [0.96, 0.59, 0.2] };
  var GOLD = [0.92, 0.75, 0.35], GREY = [0.19, 0.19, 0.22], PLATE = [0.15, 0.15, 0.18], LINE = [0.27, 0.27, 0.31], INK = [0.88, 0.88, 0.9], DIM = [0.47, 0.47, 0.5];
  var PATH = 'BtnController/SafeAreaFitter/Content/';
  function C(a, al) { return new UE.Color(a[0], a[1], a[2], al == null ? 1 : al); }
  function V2v(x, y) { return new UE.Vector2(x, y); }
  function V3v(x, y, z) { return new UE.Vector3(x, y, z || 0); }   // rotations pass z
  function S3(x, y) { return new UE.Vector3(x, y, 1); }   // scales keep z = 1: TMP draws nothing at a z scale of 0
  function note(s) { D.log.push(s); if (D.log.length > 40) D.log.shift(); }
  function tmpOf(t) { return t ? U.GetComponent(t.gameObject, cs.TMPro.TextMeshProUGUI) : null; }
  function imgOf(t) { return t ? U.GetComponent(t.gameObject, UE.UI.Image) : null; }
  function menu() { return globalThis.__ev3w; }
  function curMode(w) { return D.preview || (w.grimTab ? 104 : w.endlessTab ? 105 : w.CurBattleMode); }
  function made(go) { D.made.push(go); return go; }
  function ease(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); }   // fast in, slow out
  function inout(k) { k = Math.max(0, Math.min(1, k)); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(2 - 2 * k, 3) / 2; }   // eased both ends: scrolls and hand-offs
  function mix(a, b, k) { k = Math.max(0, Math.min(1, k)); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function back(k) { k = Math.max(0, Math.min(1, k)); var s = 1.7; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); }

  // stand-in shapes for the block-out only (never art): a disc, a ring, a hex, drawn once into small textures
  function tex(n, fn) {
    var t = new UE.Texture2D(n, n, UE.TextureFormat.RGBA32, false), px = cs.System.Array.CreateInstance(TY(UE.Color32), n * n);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { var a = fn((x + 0.5) / n * 2 - 1, (y + 0.5) / n * 2 - 1, 2 / n); px.set_Item(y * n + x, new UE.Color32(255, 255, 255, Math.round(255 * Math.max(0, Math.min(1, a))))); }
    t.SetPixels32(px); t.Apply(); t.filterMode = UE.FilterMode.Bilinear;
    t.hideFlags = 32;   // DontUnloadUnusedAsset: the shapes are kept for the game session
    var sp = UE.Sprite.Create(t, new UE.Rect(0, 0, n, n), V2v(0.5, 0.5), 100); sp.hideFlags = 32;
    return sp;
  }
  // 2026-11-14 (the lead: the old Entropy menu showed and froze before the new one): the shapes were drawn pixel by pixel
  // on every open (about 350,000 pixels, the 512 ring most of it), which froze the first frame for a second or more; they
  // are drawn once per game session now, ahead of the first open (ED.prewarm at boot), and kept in globalThis.__EDSP
  function shapes() {
    if (D.sp) return D.sp;
    var cache = globalThis.__EDSP;
    try { if (cache && cache.ring && !cache.ring.Equals(null) && cache.ring.texture && !cache.ring.texture.Equals(null) && cache.white && !cache.white.Equals(null)) return D.sp = cache; } catch (x) {}
    var disc = tex(64, function (x, y, p) { return (1 - Math.hypot(x, y)) / p; });
    var ring = tex(512, function (x, y, p) { var r = Math.hypot(x, y); return Math.min((1 - r) / p, (r - 0.985) / p); });
    // the hexes are flat-sided left/right; their points reach 1/0.866 of the half-width, so the field is scaled to fit
    var hex = tex(64, function (x, y, p) { var ax = Math.abs(x) * 1.16, ay = Math.abs(y) * 1.16; return (0.95 - Math.max(ay * 0.866 + ax * 0.5, ax)) / p; });
    var hexRing = tex(256, function (x, y, p) { var ax = Math.abs(x) * 1.16, ay = Math.abs(y) * 1.16, d = Math.max(ay * 0.866 + ax * 0.5, ax); return Math.min((0.97 - d) / p, (d - 0.93) / p); });
    // the game's Image draws a null sprite with a transparent texture, so plain plates need a white one
    var white = tex(4, function () { return 1; });
    // small rings (socket rims, the rank ring) need a thick band or they alias to dots (review r2)
    var ringS = tex(128, function (x, y, p) { var r = Math.hypot(x, y); return Math.min((1 - r) / p, (r - 0.84) / p); });
    return D.sp = globalThis.__EDSP = { disc: disc, ring: ring, ringS: ringS, hex: hex, hexRing: hexRing, white: white };
  }
  function img(parent, name, w, h, sprite, col) {
    var go = made(new UE.GameObject('ED' + name, TY(UE.RectTransform))); go.layer = parent.gameObject.layer;
    var t = go.transform; t.SetParent(parent, false); t.anchorMin = V2v(0.5, 0.5); t.anchorMax = V2v(0.5, 0.5); t.pivot = V2v(0.5, 0.5);
    t.sizeDelta = V2v(w, h);
    var im = go.AddComponent(TY(UE.UI.Image)); im.raycastTarget = false; im.sprite = sprite || shapes().white; im.color = C(col || INK);
    return im;
  }
  function node(parent, name) {
    var go = made(new UE.GameObject('ED' + name, TY(UE.RectTransform))); go.layer = parent.gameObject.layer;
    var t = go.transform; t.SetParent(parent, false); t.anchorMin = V2v(0.5, 0.5); t.anchorMax = V2v(0.5, 0.5); t.sizeDelta = V2v(1, 1);
    return t;
  }
  // a TMP text cloned from the menu's own (stock font and material)
  function text(src, parent, name, fs, w, h, align) {
    var go = made(UE.Object.Instantiate(src.gameObject, parent, false)); go.name = 'ED' + name;
    for (var i = go.transform.childCount - 1; i >= 0; i--) UE.Object.Destroy(go.transform.GetChild(i).gameObject);
    var t = go.transform; t.anchorMin = V2v(0.5, 0.5); t.anchorMax = V2v(0.5, 0.5); t.pivot = V2v(0.5, 0.5);
    t.sizeDelta = V2v(w, h); t.localScale = S3(1, 1); t.localEulerAngles = V3v(0, 0);
    var tm = tmpOf(t); tm.enableAutoSizing = false; tm.fontSize = fs; tm.alignment = align || 514; tm.enableWordWrapping = true; tm.overflowMode = 0;
    tm.margin = new UE.Vector4(0, 0, 0, 0); tm.color = C(INK);
    return tm;
  }
  // the stock panels stay live for input but draw nothing (alpha 0 keeps their raycasts)
  function hideStock(w) {
    for (var n of ['ContentMasteAndExpert', 'ContentNormal', 'WidgetSwitchModeBox']) {
      var t = w.CsObj.transform.Find(PATH + n); if (!t) continue;
      var g = U.GetComponent(t.gameObject, UE.CanvasGroup), added = false;
      if (!g) { g = t.gameObject.AddComponent(TY(UE.CanvasGroup)); added = true; }
      if (!D.groups.some(function (q) { return q.g === g; })) D.groups.push({ g: g, a: g.alpha, added: added });
      g.alpha = 0;
    }
  }

  // ---- build: the dial's pieces, once ----
  function build(w) {
    var sp = shapes(), content = w.CsObj.transform.Find(PATH.slice(0, -1));
    var src = w.CsObj.transform.Find(PATH + 'ContentMasteAndExpert/DebuffBox/HeatMaxValue');
    var root = node(content, 'Root'); root.SetAsLastSibling(); root.localPosition = V3v(0, 0);
    // the close fades the whole window (stock backdrop and prompts too), so the scene behind shows through before the
    // stock exit removes it; review: fading only the dial left a black screen and a cut
    // final review M4: the window root, so the footer prompts (PDASidePrompt, outside BtnController) fade too
    var wt = w.CsObj.transform, wg = U.GetComponent(wt.gameObject, UE.CanvasGroup), wAdd = false;
    if (!wg) { wg = wt.gameObject.AddComponent(TY(UE.CanvasGroup)); wAdd = true; }
    if (!D.groups.some(function (q) { return q.g === wg; })) D.groups.push({ g: wg, a: D.veil ? D.veil.a : wg.alpha, added: wAdd });   // a veiled window's alpha is the veil's
    var B = { rootG: wg, root: root, src: src, socks: [], perks: [], words: [], ranks: [], rankCost: [], rules: [] };
    B.shade = img(root, 'Shade', 2560, 1440, null, [0.05, 0.05, 0.07]); B.shade.color = C([0.05, 0.05, 0.07], 1);
    var dial = B.dial = node(root, 'Dial'); dial.localPosition = V3v(L.cx, L.cy);
    B.halo = img(dial, 'Halo', L.R * 2, L.R * 2, sp.ring, LINE);
    B.perkRing = node(dial, 'PerkRing');
    for (var k = 0; k < 12; k++) { var ph = img(B.perkRing, 'Perk' + k, 34, 34, sp.hex, LINE); B.perks.push(ph); }
    B.inner = img(dial, 'Inner', L.R * 1.24, L.R * 1.24, sp.ring, HUE[4]);
    B.hex = img(dial, 'Hex', L.R * 0.82, L.R * 0.82, sp.hexRing, HUE[4]); B.hex.transform.localEulerAngles = V3v(0, 0, 90);
    B.total = text(src, dial, 'Total', 96, 300, 120); B.total.transform.localPosition = V3v(0, 8);
    B.limit = text(src, dial, 'Limit', 26, 300, 40); B.limit.transform.localPosition = V3v(0, -62); B.limit.color = C(DIM);
    B.sockRing = node(dial, 'Sockets');
    // stand-ins for the real-time effects layer (white cards, timed; official parts replace them at the art stage)
    B.fxGlow = img(dial, 'FxGlow', L.R * 0.9, L.R * 0.9, sp.disc, INK);
    // the sweep: a head and two trailing copies (10 and 20 degrees behind), so it travels instead of strobing
    B.fxSweep = node(dial, 'FxSweepPivot'); B.fxSweepBars = [];
    for (var sb = 0; sb < 3; sb++) {
      var piv = node(B.fxSweep, 'FxSweepArm' + sb); piv.localEulerAngles = V3v(0, 0, 10 * sb);
      var bar = img(piv, 'FxSweep' + sb, 150, 10, null, INK); bar.transform.localPosition = V3v(0, L.R); B.fxSweepBars.push(bar);
    }
    B.fxHex = img(dial, 'FxHexFlash', L.R * 0.82, L.R * 0.82, sp.hex, INK); B.fxHex.transform.localEulerAngles = V3v(0, 0, 90);
    B.fxRank = img(dial, 'FxRankRing', 90, 90, sp.ringS, INK);
    B.fxTick = img(dial, 'FxTurnTick', 8, 40, null, GOLD); B.fxTick.transform.localPosition = V3v(0, L.R + 34);
    // the mode words on a wide arc above the dial, LB / RB at its ends
    for (var m = 0; m < MODES.length; m++) { var wd = text(src, root, 'Mode' + MODES[m], 34, 400, 50); wd.enableWordWrapping = false; B.words.push(wd); }
    B.under = img(root, 'Under', 190, 4, null, GOLD);
    B.lb = text(src, root, 'LB', 30, 80, 40); B.lb.text = 'LB'; B.lb.color = C(DIM);
    B.rb = text(src, root, 'RB', 30, 80, 40); B.rb.text = 'RB'; B.rb.color = C(DIM);
    // the name plaque: a gold name bar over a plate; every rank in full below, its Entropy cost in a right column
    var pl = B.plaque = node(root, 'Plaque'); pl.localPosition = V3v(L.plaqueX, L.plaqueY);
    B.plaqueG = pl.gameObject.AddComponent(TY(UE.CanvasGroup));
    B.plate = img(pl, 'Plate', 700, 520, null, PLATE); B.plate.transform.localPosition = V3v(0, 10);
    B.bar = img(pl, 'Bar', 720, 104, null, GOLD); B.bar.transform.localPosition = V3v(10, 280); B.bar.transform.localEulerAngles = V3v(0, 0, 1.5);
    B.name = text(src, pl, 'Name', 30, 650, 96, 513); B.name.transform.localPosition = V3v(14, 280); B.name.transform.localEulerAngles = V3v(0, 0, 1.5); B.name.color = C([0.1, 0.1, 0.1]);
    B.rank = text(src, pl, 'Rank', 28, 620, 40, 257); B.rank.transform.localPosition = V3v(0, 186); B.rank.color = C(GOLD);
    for (var r = 0; r < 6; r++) {
      var rt = text(src, pl, 'RankLine' + r, 26, 540, 40, 257); rt.transform.localPosition = V3v(-40, 120 - r * 48); B.ranks.push(rt);
      var rc2 = text(src, pl, 'RankCost' + r, 26, 70, 40, 260); rc2.transform.localPosition = V3v(275, 120 - r * 48); B.rankCost.push(rc2);
    }
    // the right column: Output / Tactic, then the rules
    var rc = B.right = node(root, 'Right'); rc.localPosition = V3v(L.rightX, 0);
    B.rightG = rc.gameObject.AddComponent(TY(UE.CanvasGroup));
    B.otBg = img(rc, 'OTBg', 600, 200, null, PLATE); B.otBg.transform.localPosition = V3v(0, 200);
    B.ot = text(src, rc, 'OT', 30, 540, 160, 257); B.ot.transform.localPosition = V3v(0, 200);
    B.ruBg = img(rc, 'RulesBg', 600, 470, null, PLATE); B.ruBg.transform.localPosition = V3v(0, -170);
    B.ru = text(src, rc, 'Rules', 25, 540, 430, 257); B.ru.transform.localPosition = V3v(0, -170); B.ru.color = C(INK, 0.85);
    B.foot = text(src, root, 'Foot', 22, 2000, 36); B.foot.transform.localPosition = V3v(0, -640); B.foot.color = C(DIM);
    B.foot.text = '';
    return B;
  }

  // ---- data from the stock menu: the rows (or Normal's assist rows), the selection, the totals ----
  var WHD = null, NBI = null;
  function rowsOf(w) {
    var out = [], cn = w.CsObj.transform.Find(PATH + 'ContentNormal');
    if (cn && cn.gameObject.activeInHierarchy) {
      NBI = NBI || require('Widget/NormalBuffItem').default;
      var nl = cn.Find('NormalBuffList');
      for (var i = 0; nl && i < nl.childCount; i++) {
        var row = nl.GetChild(i); if (!row.gameObject.activeSelf) continue;
        var ct = row.Find('Content'), wd = null; try { wd = U.GetBindObj(row.gameObject, NBI); } catch (x) {}
        var b = wd && wd.Buff, mx = 0; try { mx = X.AssistLevelBaseConf.Get(b.id).maxLevel; } catch (x) {}
        var tm = tmpOf(ct.Find('NormalBuffDesc')), sb = ct.Find('NormalBuffSelectBox');
        out.push({ id: 'a' + (b ? b.id : i), lv: b ? b.Level : 0, max: mx, sel: !!(sb && sb.gameObject.activeSelf), sprite: imgOf(ct.Find('NormalBuffImg')), name: tm ? tm.text : '', b: b });
      }
      return out;
    }
    WHD = WHD || require('Widget/WidgetHeatDebuff').default;
    var list = w.R.DebuffList;
    for (var j = 0; list && j < list.childCount; j++) {
      var r = list.GetChild(j); if (!r.gameObject.activeSelf) continue;
      var st = r.Find('Content/DebuffStatusTable'); if (!st) continue;
      var wd2 = null; try { wd2 = U.GetBindObj(r.gameObject, WHD); } catch (x) {}
      var d = wd2 && wd2.Debuff, max = 0; try { max = X.HeatConf.Get(d.id, w.CurBattleMode).maxLevel; } catch (x) {}
      var nm = tmpOf(st.Find('ItemLeft/NameBox/Name')), s = st.Find('ItemSelect');
      out.push({ id: d ? d.id : j, lv: d ? d.Level : 0, max: max, sel: !!(s && s.gameObject.activeSelf), sprite: imgOf(st.Find('ItemLeft/Img')), name: nm ? nm.text : '', d: d });
    }
    return out;
  }
  function textAt(w, p) { var t = tmpOf(w.CsObj.transform.Find(PATH + p)); return t ? t.text : ''; }
  function descAt(d, l, mode) {
    var copy = Object.create(Object.getPrototypeOf(d)); for (var k of Object.keys(d)) copy[k] = d[k];
    copy.Level = l; try { copy.BuffType = d.BuffType; copy.id = d.id; } catch (x) {}
    var v = ''; try { v = HU.GetTotalDebuffValue(copy, mode); } catch (x) {}
    return U.GetLocale('HeatDebuffDesc_Max_' + d.id, v);
  }
  function sanAt(id, l, mode) { var e = X.HeatPunishConf.All.find(function (e) { return e.id == id && e.level == l && e.mode == mode; }); return e ? e.san : 0; }

  // ---- the frame tick: data, then motion ----
  function sockets(B, rows) {
    while (B.socks.length < rows.length) {
      var sp = shapes(), t = node(B.sockRing, 'Sock' + B.socks.length);
      var S = { g: t.gameObject.AddComponent(TY(UE.CanvasGroup)), t: t, plate: img(t, 'SockPlate', 56, 56, sp.disc, GREY), rim: img(t, 'SockRim', 62, 62, sp.ringS, DIM), icon: img(t, 'SockIcon', 40, 40, null, INK), pips: [], lift: 0, pop: 0 };
      S.icon.preserveAspect = true;
      for (var p = 0; p < 6; p++) S.pips.push(img(t, 'Pip' + p, 8, 8, sp.disc, LINE));
      B.socks.push(S);
    }
    for (var k = 0; k < B.socks.length; k++) B.socks[k].t.gameObject.SetActive(k < rows.length);
  }
  function frame() {
    var w = menu(); if (!w || !w.CsObj) return;
    var B = D.B; if (!B) { B = D.B = build(w); D.openAt = D.t; }
    hideStock(w);
    var mode = curMode(w), hue = HUE[mode] || HUE[4], rows = rowsOf(w), n = rows.length;
    // round 4: with the focus on a mutation, a perk or a button no row is selected; the chosen modifier stays the last one
    var fi = rows.findIndex(function (r) { return r.sel; });
    var ownSel = D.forceSel != null && (D.forceSelAt == null || UE.Time.frameCount - D.forceSelAt <= 3);
    var selIdx = ownSel ? D.forceSel % Math.max(1, rows.length) : fi >= 0 ? fi : D.selIdx != null && D.selIdx < rows.length ? D.selIdx : 0;
    // the first open plays in full; a mode change hands over from what is on screen instead of replaying it (the lead,
    // 2026-10-23: "less harsh and more smooth like persona and seemless")
    if (D.mode !== mode || D.n !== n) {
      var ni = Math.max(0, MODES.indexOf(mode));
      if (D.mode == null) { D.openAt = D.t; D.arcFrom = D.arcTo = ni; D.hueFrom = hue; }
      else { var oi = MODES.indexOf(D.mode); D.prevN = D.n || 0; D.shiftAt = D.t; D.shiftDir = ni >= oi ? 1 : -1; D.arcFrom = D.arcPos; D.arcTo = ni; D.hueFrom = D.hueNow || hue; }
      D.mode = mode; D.n = n; D.rot = D.rotTo = selIdx; D.turnAt = null; D.lastLv = null; note('open mode ' + mode + ' rows ' + n);
    }
    var shF = D.shiftAt != null && D.shiftAt > D.openAt ? D.t - D.shiftAt : null;   // frames since the last mode change
    D.arcPos = shF == null ? D.arcTo : D.arcFrom + (D.arcTo - D.arcFrom) * inout(shF / F.shift);
    hue = D.hueNow = shF == null ? hue : mix(D.hueFrom, hue, inout(shF / 10));
    sockets(B, rows);
    // the dial turns the shortest way to the new selection; the selected socket sits at 12 o'clock
    if (D.selIdx !== selIdx) {
      if (D.selIdx != null && n) { var dlt = selIdx - D.rotTo; dlt -= Math.round(dlt / n) * n; D.rotFrom = D.rot; D.rotTo += dlt; D.turnAt = D.t; }
      D.selIdx = selIdx;
    }
    var tk = D.turnAt == null ? 1 : (D.t - D.turnAt) / F.turn; D.rot = D.turnAt == null ? D.rotTo : D.rotFrom + (D.rotTo - D.rotFrom) * ease(tk);
    // the opening: rings grow from 0.6 in F.open frames, sockets pop clockwise one F.sockStep apart
    var ok = (D.t - D.openAt) / F.open, os = 0.6 + 0.4 * ease(ok), oa = ease(ok);
    // round 4: in lean mode (the v4 screen draws, these pieces are hidden) only the data and the clocks are kept
    var lean = !!D.lean;
    if (!lean) { B.halo.transform.localScale = S3(os, os); B.halo.color = C(LINE, oa);
    B.halo.transform.localEulerAngles = V3v(0, 0, -360 * D.t / F.halo); }
    // the hex starts 2 f after the rings (review r1: layer starts offset, never all on one frame)
    var hk = (D.t - D.openAt - 2) / F.open, ha = ease(hk * 3);
    // grey block-out: rings and hex grey; the mode hue only on the mode word, red only on the over-limit total (review r2)
    if (!lean) { B.inner.color = C(DIM, oa); B.hex.color = C(DIM, ha); } var hs = 0.6 + 0.4 * back(hk);
    if (shF != null) hs *= 1 - 0.06 * Math.sin(Math.PI * Math.max(0, Math.min(1, shF / 14)));   // a mode change: the hex breathes in and out
    if (!lean) { B.inner.transform.localScale = S3(os, os); B.hex.transform.localScale = S3(hs, hs); }
    // effects stand-ins: lead glow f0-3, one sweep round the halo f2-14, a 2 f hex flash at f10, the turn tick f6-8
    // the live clock runs in fractional frames, so table lookups take the whole frame
    var oF = D.t - D.openAt, ga = [0.5, 0.8, 0.4][Math.floor(oF)] || 0, gs = 0.3 + 0.1 * Math.max(0, Math.min(3, oF));
    if (!lean) { B.fxGlow.color = C(INK, ga); B.fxGlow.transform.localScale = S3(gs, gs); }
    // linear, 30 degrees a frame, scaled with the halo, fading out over f12-14 instead of a cut; a mode change sweeps once
    // more, from the side it came from
    var sF = shF != null ? shF : oF - 2, swA = sF < 0 || sF > 12 ? 0 : sF <= 10 ? 0.9 : 0.9 * (12 - sF) / 2;
    if (!lean) { B.fxSweep.localEulerAngles = V3v(0, 0, -30 * (shF != null ? D.shiftDir : 1) * Math.max(0, Math.min(12, sF))); B.fxSweep.localScale = S3(os, (shF != null ? D.shiftDir : 1) * os);
    for (var sb = 0; sb < 3; sb++) B.fxSweepBars[sb].color = C(INK, swA * [1, 0.5, 0.25][sb] * (sF >= sb ? 1 : 0));
    B.fxHex.color = C(INK, Math.floor(oF) === 10 ? 0.7 : Math.floor(oF) === 11 ? 0.35 : 0); B.fxHex.transform.localScale = S3(hs, hs); }
    var tF = D.turnAt == null ? 99 : D.t - D.turnAt; if (!lean) B.fxTick.color = C(GOLD, tF >= 6 && tF <= 8 ? 1 - (tF - 6) * 0.35 : 0);
    var rF = D.rankAt == null ? 99 : D.t - D.rankAt, rs = 1 + 0.6 * Math.min(1, rF / 2), rFi = Math.floor(rF);
    if (!lean) { B.fxRank.color = C(INK, [0.9, 0.6, 0.3][rFi] || 0); B.fxRank.transform.localScale = S3(rs * 1.35, rs * 1.35); }
    var big = mode === 4 || mode === 104 || mode === 105;
    if (!lean) B.perkRing.gameObject.SetActive(big);
    if (big && !lean) {
      var perks = w.CsObj.transform.Find(PATH + 'ContentMasteAndExpert/ExpertModeContent/ExpertBuffBox/ExpertBuffList');
      B.perkRing.localEulerAngles = V3v(0, 0, 360 * D.t / (F.halo * 1.5));
      for (var q = 0; q < 12; q++) {
        var a = (90 - 360 * (q + 0.5) / 12) * Math.PI / 180, pk = 0.5 + 0.5 * ease((D.t - D.openAt - F.open - q) / F.sockPop);
        if (shF != null) pk = 0.7 + 0.3 * inout((shF - 4 - q * 0.5) / 8);
        var on = false; try { on = perks.GetChild(q).Find('Open').gameObject.activeSelf; } catch (x) {}
        B.perks[q].transform.localPosition = V3v(L.R * L.perk * Math.cos(a), L.R * L.perk * Math.sin(a));
        var pA = Math.max(0, Math.min(1, (pk - 0.5) * 2));
        B.perks[q].transform.localScale = S3(pk, pk); B.perks[q].color = on ? C(DIM, 0.7 * pA) : C(LINE, 0.5 * pA);
      }
    }
    // a mode change swings the socket ring in from the side it came from and settles it, rather than popping it
    if (!lean) B.sockRing.localEulerAngles = V3v(0, 0, shF == null ? 0 : 36 * D.shiftDir * (1 - ease(shF / F.shift)));
    var dt = D.dt || 1;
    for (var k = 0; k < n && !lean; k++) {
      var S = B.socks[k], R = rows[k], isSel = k === selIdx;
      S.lift += ((isSel ? 1 : 0) - S.lift) * (1 - Math.pow(1 - Math.min(1, 2.2 / F.lift), dt));
      var ang = (90 - 360 * (k - D.rot) / n) * Math.PI / 180, rad = L.R * L.sock + 10 * S.lift;   // lift 10 keeps the pips off the halo
      S.t.localPosition = V3v(rad * Math.cos(ang), rad * Math.sin(ang));
      // sockets grow from 0.6 and fade in (no pop from nothing); on a mode change they cross-fade from 0.85, half a frame apart
      var pk3 = shF != null ? inout((shF - 2 - k * 0.5) / F.sockPop) : ease((D.t - D.openAt - 4 - k * F.sockStep) / F.sockPop);
      var pop = shF != null ? (k < (D.prevN || 0) ? 1 - 0.1 * Math.sin(Math.PI * pk3) : 0.85 + 0.15 * pk3) : 0.6 + 0.4 * pk3, sc = pop * (1 + 0.35 * S.lift);
      // sockets already on screen stay and dip a little as the ring swings; only new ones fade in (review r1: they blinked out)
      S.g.alpha = shF == null ? pk3 : k < (D.prevN || 0) ? 1 - 0.35 * Math.sin(Math.PI * pk3) : pk3;
      if (isSel && D.rankAt != null) { var fl = D.t - D.rankAt; sc *= 1 + 0.35 * (fl <= 1 ? fl : Math.max(0, 1 - ease((fl - 1) / 7))); }
      S.t.localScale = S3(sc, sc);
      if (isSel) B.fxRank.transform.localPosition = S.t.localPosition;
      S.rim.color = isSel ? C(GOLD) : C(DIM, R.lv > 0 ? 1 : 0.5);
      S.rim.transform.localScale = S3(isSel ? 1.12 : 1, isSel ? 1.12 : 1);
      S.plate.color = C(isSel ? [0.4, 0.4, 0.45] : R.lv > 0 ? [0.26, 0.26, 0.3] : GREY);
      if (R.sprite && S.icon.sprite !== R.sprite.sprite) S.icon.sprite = R.sprite.sprite;
      S.icon.color = C(INK, R.lv > 0 || isSel ? 1 : 0.45);
      for (var p = 0; p < 6; p++) {
        var pi = S.pips[p], has = p < R.max; if (pi.gameObject.activeSelf !== has) pi.gameObject.SetActive(has); if (!has) continue;
        var pa = (p - (R.max - 1) / 2) * 0.32 + Math.PI / 2;   // the rank pips on a short arc above each socket
        pi.transform.localPosition = V3v(44 * Math.cos(pa), 44 * Math.sin(pa));
        pi.color = isSel && (rFi === 1 || rFi === 2) ? C(INK) : p < R.lv ? C(isSel ? GOLD : DIM) : C(LINE);   // white on f1-2 of a rank change
      }
    }
    // the selected modifier: rank change flare, total roll
    var sel = rows[selIdx], lvKey = sel ? sel.id + ':' + sel.lv : '';
    if (D.lastLv != null && D.lastLv !== lvKey && D.lastSel === selIdx) D.rankAt = D.t;
    D.lastLv = lvKey; D.lastSel = selIdx;
    var hm = /(\d+)\s*\/\s*(\d+)/.exec(textAt(w, 'ContentMasteAndExpert/DebuffBox/HeatMaxValue') || ''), tot = mode === 1 ? 0 : hm ? +hm[1] : 0;
    if (D.totTo !== tot) { D.totFrom = D.totShown == null ? tot : D.totShown; D.totTo = tot; D.rollAt = D.t; }
    D.totShown = Math.round(D.totFrom + (D.totTo - D.totFrom) * ease((D.t - D.rollAt) / F.roll));
    var over = mode !== 1 && hm && +hm[1] > +hm[2];   // red only for over the limit, pulsing (40 f) so it differs from the mode tint
    if (!lean) B.total.text = '' + D.totShown; if (!lean) B.total.color = C(over ? [1, 0.4, 0.36] : INK, oa * (over ? 0.8 + 0.2 * Math.cos(D.t * Math.PI / 20) : 1));
    B.limit.text = mode === 1 ? '' : hm ? 'limit ' + hm[2] : ''; B.limit.color = C(DIM, oa);
    var wA = Math.max(0, Math.min(1, (oF - 2) / 4));   // mode words and LB/RB in over f2-6
    if (!lean) { B.lb.color = C(DIM, wA); B.rb.color = C(DIM, wA); }
    // the mode words on the arc: the arc scrolls so the current mode slides to the centre; size and colour follow distance
    // final review M2: neighbours sit half a width + 70 px + half a width apart, measured each frame (a long name such as
    // GRIM OF THE ABYSS ran into ENDLESS with a fixed step); words fade out before they reach LB / RB
    var AX = [0];
    for (var m0 = 1; !lean && m0 < MODES.length; m0++) AX.push(AX[m0 - 1] + (B.words[m0 - 1].preferredWidth + B.words[m0].preferredWidth) / 2 + 70);
    var ai = Math.max(0, Math.min(MODES.length - 2, Math.floor(D.arcPos))), ac = AX[ai] + (AX[ai + 1] - AX[ai]) * (D.arcPos - ai);
    for (var m = 0; m < MODES.length && !lean; m++) {
      var Wd = B.words[m], id = MODES[m], dd = Math.abs(m - D.arcPos), nearK = Math.max(0, 1 - dd);
      var ax = AX[m] - ac, ay = L.arcY - (L.arcR - Math.sqrt(Math.max(0, L.arcR * L.arcR - ax * ax)));
      var edgeK = Math.max(0, Math.min(1, (900 - Math.abs(ax)) / 160));
      Wd.text = U.GetLocale('BattleModeName_' + id).toUpperCase(); Wd.fontSize = 30 + 14 * nearK;
      Wd.transform.localPosition = V3v(ax, ay); Wd.transform.localEulerAngles = V3v(0, 0, -Math.asin(Math.max(-1, Math.min(1, ax / L.arcR))) * 180 / Math.PI);
      Wd.color = C(mix(DIM, hue, nearK), wA * edgeK * Math.max(0.25, 1 - 0.3 * dd));
    }
    // the underline stays at the centre and stretches during the scroll
    var uw = shF == null ? ease((D.t - D.openAt - 4) / F.plaque) : 1 + 0.6 * Math.sin(Math.PI * Math.max(0, Math.min(1, shF / F.shift)));
    if (!lean) B.under.color = C(hue, wA); if (!lean) B.under.transform.localPosition = V3v(0, L.arcY - 34); B.under.transform.localEulerAngles = V3v(0, 0, 0); B.under.transform.localScale = S3(uw, 1);
    var ex2 = 1010, ey2 = L.arcY - (L.arcR - Math.sqrt(L.arcR * L.arcR - ex2 * ex2));
    B.lb.transform.localPosition = V3v(-ex2, ey2); B.rb.transform.localPosition = V3v(ex2, ey2);
    // the plaque slides in on the slant; its text is the selected modifier in full
    // plaque at f6 and right column at f8 of the open (a turn restarts the plaque only), alpha in over the first 4 f
    // after the open, a turn or a mode change never blanks the plaque: it dips to 0.35, slides 24 px and comes back over 6 f
    var softAt = Math.max(D.turnAt != null && D.turnAt > D.openAt ? D.turnAt : -1e9, shF != null ? D.shiftAt : -1e9);
    var rF2 = D.t - D.openAt - 8, rk = ease(rF2 / F.plaque);
    if (softAt > -1e9) {
      var sk = inout((D.t - softAt) / F.soft);
      // review r3: a mode change keeps the panels at full strength (only a turn dips the plaque)
      B.plaque.localPosition = V3v(L.plaqueX - 6 * (1 - sk), L.plaqueY); B.plaqueG.alpha = shF != null ? 1 : 0.35 + 0.65 * sk;
    } else {
      var pF = D.t - D.openAt - 6, pk2 = ease(pF / F.plaque);
      B.plaque.localPosition = V3v(L.plaqueX - 60 * (1 - pk2), L.plaqueY); B.plaqueG.alpha = Math.max(0, Math.min(1, pF / 4));
    }
    B.bar.color = C(GOLD, 1);
    if (shF != null) { var rs2 = inout((shF - 2) / F.soft); rk = 1; B.rightG.alpha = 1; B.right.localPosition = V3v(L.rightX + 24 * D.shiftDir * (1 - rs2), 0); }
    else B.rightG.alpha = Math.max(0, Math.min(1, rF2 / 4));
    if (sel) {
      B.name.text = sel.name; B.rank.text = mode === 1 ? 'Level ' + sel.lv + ' / ' + sel.max : 'Rank ' + sel.lv + ' / ' + sel.max + (sel.lv ? '    +' + sanAt(sel.id, sel.lv, w.CurBattleMode) + ' Entropy' : '');
      for (var r2 = 0; r2 < 6 && !lean; r2++) {
        var RL = B.ranks[r2], RC = B.rankCost[r2], l = r2 + 1, show = l <= sel.max && !!sel.d;
        RL.gameObject.SetActive(show); RC.gameObject.SetActive(show); if (!show) continue;
        RL.text = l + '    ' + shortVal(descAt(sel.d, l, w.CurBattleMode)); RC.text = '+' + sanAt(sel.id, l, w.CurBattleMode);
        RL.color = RC.color = l === sel.lv ? C(GOLD) : C(INK, l < sel.lv ? 0.9 : 0.5);
      }
    }
    // the right column: Output / Tactic, then the mode's rules
    var ex = 'ContentMasteAndExpert/ExpertModeContent/ExpertAdditionalBonus/';
    if (!lean) B.right.gameObject.SetActive(mode !== 1);
    if (mode !== 1) {
      B.ot.text = 'Output    ' + textAt(w, ex + 'Consciousness/ConsciousCrystalFragTextExpert') + '    ' + textAt(w, ex + 'AP/CurrencyTextExpert') + '\nTactic     ' + bless(w, ex);
      if (!lean) B.ru.text = rules(w);
      // final review M6: a preview (the recordings' mode shift) keeps the current mode's rules, so it says so and dims them
      if (D.preview) { B.ot.text = 'PREVIEW    ' + U.GetLocale('BattleModeName_' + D.preview).toUpperCase() + '\nCurrent    ' + U.GetLocale('BattleModeName_' + w.CurBattleMode).toUpperCase(); B.ru.alpha = 0.5; }
      else B.ru.alpha = 1;
    }
    if (shF == null) B.right.localPosition = V3v(L.rightX + 60 * (1 - rk), 0);
    // the art layer (entropy_dial_art.js) dresses what this frame laid out
    D.fr = { mode: mode, hue: hue, oF: oF, shF: shF, tF: tF, rF: rF, selIdx: selIdx, n: n, os: os, hs: hs, oa: oa, ha: ha, big: big, over: !!over, rows: rows };
    if (D.art) try { D.art(w, B); } catch (x) { note('art EXC ' + x); }
    // the close (card 7): the whole layer eases out over F.close frames while the dial sinks to 0.82 and turns back 24
    // degrees; the stock exit follows on the last frame
    if (D.closeAt != null) {
      // final review M4: the alpha falls fastest at the start and is 0 on the last frame; the stock exit waits for it
      var cF = (D.t - D.closeAt) / F.close, ck = inout(cF), dk = ease(cF);
      D.closed = true; B.rootG.alpha = 1 - ease(cF); if (D.footG) D.footG.alpha = 1 - ease(cF);
      if (cF >= 1 && D.closeOk) { var ok1 = D.closeOk; D.closeOk = null; ok1(); } B.root.localScale = S3(1 + 0.03 * ck, 1 + 0.03 * ck);
      B.dial.localScale = S3(1 - 0.18 * dk, 1 - 0.18 * dk); B.dial.localEulerAngles = V3v(0, 0, 24 * dk);
    } else if (D.closed) {
      D.closed = false;
      B.rootG.alpha = 1; if (D.footG) D.footG.alpha = 1; B.root.localScale = S3(1, 1); B.dial.localScale = S3(1, 1); B.dial.localEulerAngles = V3v(0, 0, 0);
    }
  }
  // a rank row keeps only the numbers of its sentence ("deal 25% more damage" -> "+25%"); the full sentence is on the bar
  function shortVal(s) {
    var m = String(s || '').replace(/<[^>]*>/g, '').match(/[-+]?\d+(\.\d+)?%?/g);
    return m ? m.map(function (v) { return /^[-+]/.test(v) ? v : '+' + v; }).join('  ') : String(s || '');
  }
  function bless(w, ex) {
    var l = w.CsObj.transform.Find(PATH + ex + 'BlessUpListExpert'), o = [];
    for (var i = 0; l && i < l.childCount; i++) { var t = tmpOf(l.GetChild(i).Find('BlessVal')); if (t) o.push(t.text); }
    return o.join('    ');
  }
  function rules(w) {
    var l = w.CsObj.transform.Find(PATH + 'ContentMasteAndExpert/ExpertModeContent/ExpertHeatAdditionalContent/ContentList'), o = [];
    if (l && !l.gameObject.activeInHierarchy) l = null;   // Advanced keeps Extreme's list, hidden
    for (var i = 0; l && i < l.childCount; i++) { var c = l.GetChild(i); if (!c.gameObject.activeSelf) continue; var t = tmpOf(c.Find('Item/Text')); if (t) o.push(t.text); }
    if (!o.length) { var hm = w.CsObj.transform.Find(PATH + 'ContentMasteAndExpert/MasterModeContent/HeatAdditionalContent'); if (hm) { var ts = U.GetComponentsInChildren(hm.gameObject, cs.TMPro.TextMeshProUGUI, false); for (var k = 0; k < ts.Length; k++) o.push(ts.get_Item(k).text); } }
    return o.join('\n');
  }
  // live, the clock follows real time (fractional design frames at 60 fps), so motion stays smooth at any frame rate;
  // ED.step keeps whole frames for the strips
  // once per drawn frame: a 16 ms timer missed every second frame (the dial moved at 30 Hz, review r1), so the timer polls
  // every 4 ms, the HUD hook calls it too, and the frame counter lets one call through per frame
  function step1() {
    var fc = UE.Time.frameCount; if (fc === D.lastFc) return; D.lastFc = fc;
    var now = UE.Time.unscaledTime; D.dt = D.last == null ? 1 : Math.max(0, Math.min(4, (now - D.last) * 60)); D.last = now;
    D.t += D.dt;
    try { frame(); } catch (x) { note('frame EXC ' + x); }
    if (D.veil) {
      var v5 = D.V5, built = false; try { built = !!(v5 && v5.root && !v5.root.Equals(null) && v5.B === D.B && D.B); } catch (x) {}
      if (built || D.t - D.veilAt > 30 || !menu()) { try { if (!D.veil.g.Equals(null) && D.closeAt == null) D.veil.g.alpha = D.veil.a; } catch (x) {} D.veil = null; }
    }
    // the safety fallback (redux-menus 0.1.4): three errors from the dial's layers in one session and it steps aside,
    // putting the stock menu back (D.stop restores its alpha), and stays off until the game restarts
    if ((fc & 15) === 0) {
      var exc = 0; for (var i = 0; i < D.log.length; i++) if (/EXC/.test(D.log[i])) exc++;
      if (exc >= 3 && !globalThis.__EDfailed) { globalThis.__EDfailed = 1; try { (globalThis.BBLOG || console.log)('entropy dial: off after errors: ' + D.log.filter(function (s) { return /EXC/.test(s); }).join(' | ')); } catch (y) {} D.stop(); }
    }
  }
  function tick() { step1(); D.timer = setTimeout(tick, 4); }
  (globalThis.BB_HUD_TICKS = globalThis.BB_HUD_TICKS || {})['entropy-dial'] = function () { if (D.timer) step1(); };
  D.stop = function () {
    try { clearTimeout(D.timer); } catch (x) {} D.timer = 0;
    for (var q of D.groups) try { if (q.added) UE.Object.Destroy(q.g); else q.g.alpha = q.a; } catch (x) {}
    for (var g of D.made) try { UE.Object.Destroy(g); } catch (x) {}
    // the global prompt bar always comes back, after the stock exit has swapped in the room's prompts
    var fb = D.footG; if (fb) setTimeout(function () { try { fb.alpha = 1; } catch (x) {} }, 300);
    D.groups = []; D.made = []; D.B = null; D.sp = null; D.mode = D.n = D.selIdx = null; D.veil = null;
    return 'dial off';
  };
  // frame-exact strips for the timing sheet: pause the clock, then step it by hand (nothing here touches the settings)
  D.pause = function () { try { clearTimeout(D.timer); } catch (x) {} D.timer = 0; return 't ' + D.t; };
  D.step = function (k) { for (var i = 0; i < (k || 1); i++) { D.t = Math.round(D.t) + 1; D.dt = 1; try { frame(); } catch (x) { note('frame EXC ' + x); } } return 't ' + D.t; };
  D.reopen = function () { D.closeAt = null; D.openAt = D.t; frame(); return 'open at ' + D.t; };
  D.flash = function () { D.rankAt = D.t; frame(); return 'flash at ' + D.t; };
  // 2026-11-14: the first frame (the build) runs here, inside the open, so the stock Entropy window never draws a frame on
  // its own; before, a 10 ms timer let the stock window draw and then the build froze that frame on screen
  D.start = function () {
    D.last = null; D.lastFc = null;
    try { step1(); } catch (x) { note('start EXC ' + x); }
    if (!globalThis.__EDfailed && !D.timer) D.timer = setTimeout(tick, 4);
    return 'dial on';
  };
  // the stock window draws nothing until the new screen is built (alpha 0 on the window's CanvasGroup, put back by D.stop)
  function veil(w) {
    try {
      var wt = w.CsObj.transform, g = U.GetComponent(wt.gameObject, UE.CanvasGroup), add = false;
      if (!g) { g = wt.gameObject.AddComponent(TY(UE.CanvasGroup)); add = true; }
      var q = D.groups.filter(function (e) { return e.g === g; })[0];
      if (!q) { q = { g: g, a: g.alpha, added: add }; D.groups.push(q); }
      D.veil = { g: g, a: q.a > 0 ? q.a : 1 }; D.veilAt = D.t; g.alpha = 0;
      hideStock(w);
    } catch (x) { note('veil EXC ' + x); D.veil = null; }
  }
  D.prewarm = function () { try { shapes(); D.sp = null; return 'shapes ready'; } catch (x) { return 'prewarm EXC ' + x; } };
  // the real menu (installed once; a reload of this file reuses the same hooks, which always call the current ED):
  // an open of the Entropy menu (InitHeat with its open flag) builds the dial fresh on that window; its exit
  // (HeatUtil.ExitHeatMenu, after Save and Return or the read-only back) waits for the close, then runs the stock exit;
  // the read-only menu (another player's settings) keeps the stock screen
  D.attach = function (w) {
    if (!w || w.readonlyMode) return 'readonly';
    // the off switch (redux-menus 0.1.4): a file named redux_entropy_dial_off.txt in the game's data folder keeps the stock
    // menu; and once the dial has failed in this game session it stays off, so the stock menu is always there to use
    try { if (cs.System.IO.File.Exists(UE.Application.persistentDataPath + '/redux_entropy_dial_off.txt')) return 'off by file'; } catch (x) {}
    if (globalThis.__EDfailed) return 'off after a failure';
    if (D.B || D.timer) D.stop();
    globalThis.__ev3w = w; D.closeAt = null; D.mode = null;
    viewWatch(w); viewHint(w);
    if (viewOpt() == 'list') return 'list view';
    veil(w);
    return D.start();
  };
  // ---- the list view (redux-menus 0.1.7) ----
  // Fury, 2026-11-09: "you don't have a good idea of where everything is and how high it's turned up unless you memorize
  // every icon ... the list view for Entropy Settings was better". The dial stays the default (the layout the lead picked,
  // 2026-10-23); Y on a pad or L on a keyboard switches to the list and back, the hero list's buttons, and the game
  // remembers the choice (ReduxMenus.json, entropyView), as it does the hero list's. The list is the stock Entropy menu
  // itself: the dial only ever hid it, and it already shows every modifier's sentence, its rank chevrons and its Entropy,
  // with the stock navigation. (View is taken: the menu's own BtnShowDetail answers 27, View on a pad and Tab on a
  // keyboard, observed in window 5 on 2026-11-10.)
  function viewOpt() { try { return globalThis.BB4.opt('entropyView') == 'list' ? 'list' : 'dial'; } catch (x) { return 'dial'; } }
  function viewPad() {
    try { var c = cs.Rewired.ReInput.players.GetPlayer(0).controllers.GetLastActiveController(); return !!c && c.type == cs.Rewired.ControllerType.Joystick; } catch (x) { return false; }
  }
  // a press is "held now, not at the last look": Y is the game's UIDetail action (24), read only while a pad is in use,
  // because on a keyboard that action is Tab, which opens Level Details here
  function viewHeld() {
    var h = false;
    try { h = UE.Input.GetKey(UE.KeyCode.L); } catch (x) {}
    if (!h && viewPad()) try { h = cs.Rewired.ReInput.players.GetPlayer(0).GetButton(24); } catch (x) {}
    return h;
  }
  D.toggleView = function () {
    var w = menu(); if (!w || D.closeAt != null) return 'no menu';
    var to = viewOpt() == 'list' ? 'dial' : 'list';
    try { globalThis.BB4.setOpt('entropyView', to); } catch (x) {}
    try { (globalThis.BBLOG || console.log)('entropy dial: ' + to + ' view'); } catch (x) {}
    if (to == 'list') D.stop(); else { D.closeAt = null; D.mode = null; D.start(); }
    viewLabel();
    return to;
  };
  // on a pad the Y button's own picture, as the game's prompts draw theirs (fourlobbyui.js promptGlyph); the key's
  // letter when there is none, and on a keyboard
  function viewLabel() {
    var H = D.hint; if (!H) return;
    var pad = viewPad(), sp = null;
    if (pad) try { var gl = globalThis.BB4UI && globalThis.BB4UI.promptGlyph ? globalThis.BB4UI.promptGlyph(24) : null; sp = gl && gl.sp ? gl.sp : null; } catch (x) {}
    var s = (sp ? '' : (pad ? 'Y' : 'L') + '    ') + (viewOpt() == 'list' ? 'Dial view' : 'List view');
    if (H.s !== s) { H.s = s; H.t.text = s; }
    if (H.sp !== sp) {
      H.sp = sp; H.g.sprite = sp; H.g.enabled = !!sp;
      if (sp) { var w = H.t.preferredWidth; H.g.transform.localPosition = V3v(1160 - w - 38, -679); }
    }
  }
  function viewWatch(w) {
    if (D.viewTimer) clearInterval(D.viewTimer);
    D.viewWas = true;   // the press that opened the menu is not a toggle
    D.viewTimer = setInterval(function () {
      if (menu() !== w) { clearInterval(D.viewTimer); D.viewTimer = 0; viewHint(w, true); return; }
      var focus = true; try { focus = UE.Application.isFocused; } catch (x) {}
      var h = focus && viewHeld(), press = h && !D.viewWas; D.viewWas = h;
      if (press) D.toggleView();
      viewLabel();
    }, 16);
  }
  // one line at the bottom right, over the dial and over the list, says which button switches and to what
  function viewHint(w, off) {
    try { if (D.hint && D.hint.go && !D.hint.go.Equals(null)) UE.Object.Destroy(D.hint.go); } catch (x) {}
    try { if (D.hint && D.hint.gg && !D.hint.gg.Equals(null)) UE.Object.Destroy(D.hint.gg); } catch (x) {}
    D.hint = null; if (off) return;
    try {
      var safe = w.CsObj.transform.Find('BtnController/SafeAreaFitter'), src = w.CsObj.transform.Find(PATH + 'ContentMasteAndExpert/DebuffBox/HeatMaxValue');
      if (!safe || !src) return;
      var go = UE.Object.Instantiate(src.gameObject, safe, false); go.name = 'EDViewHint'; go.transform.SetAsLastSibling();
      for (var i = go.transform.childCount - 1; i >= 0; i--) UE.Object.Destroy(go.transform.GetChild(i).gameObject);
      var t = go.transform; t.anchorMin = V2v(0.5, 0.5); t.anchorMax = V2v(0.5, 0.5); t.pivot = V2v(1, 0.5); t.sizeDelta = V2v(600, 44);
      t.localScale = S3(1, 1); t.localEulerAngles = V3v(0, 0); t.localPosition = V3v(1160, -679);
      var tm = tmpOf(t); tm.enableAutoSizing = false; tm.fontSize = 34; tm.alignment = 516; tm.enableWordWrapping = false; tm.color = C(INK);
      tm.raycastTarget = false;
      var gg = new UE.GameObject('EDViewGlyph', TY(UE.RectTransform)); gg.layer = go.layer;
      var gt = gg.transform; gt.SetParent(safe, false); gt.anchorMin = V2v(0.5, 0.5); gt.anchorMax = V2v(0.5, 0.5); gt.pivot = V2v(0.5, 0.5); gt.sizeDelta = V2v(56, 56);
      var gi = gg.AddComponent(TY(UE.UI.Image)); gi.raycastTarget = false; gi.preserveAspect = true; gi.enabled = false;
      D.hint = { go: go, gg: gg, t: tm, g: gi, s: null, sp: undefined }; viewLabel();
    } catch (x) { note('view hint failed: ' + x); }
  }
  D.close = function (w) {
    if (!D.B || !D.timer || menu() !== w || D.closeAt != null) return null;
    D.closeAt = D.t;
    // the footer prompts are the game's global prompt bar, not the menu's: it fades with the close and comes back once the
    // stock exit has put up the room's prompts (final review M4)
    try {
      var fo = UE.GameObject.Find('GameGlobal(Clone)/SingletonOrganizer/(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions');
      if (fo) { var fc = fo.GetComponent(TY(UE.CanvasGroup)); D.footG = fc && !fc.Equals(null) ? fc : fo.AddComponent(TY(UE.CanvasGroup)); }
    } catch (x) { D.footG = null; }
    var fg = D.footG;
    // resolved by frame() once the alpha is 0; the timeout only guards a stalled frame clock
    return new Promise(function (ok) {
      var done = false, fin = function () { if (done) return; done = true; ok(); setTimeout(function () { try { if (fg) fg.alpha = 1; } catch (x) {} }, 300); };
      D.closeOk = fin; setTimeout(fin, 1500);
    });
  };
  var KH = globalThis.__EDhooks;
  if (!KH) {
    var HMp = require('GamePlay/Heat/HeatMenu').default.prototype;
    KH = globalThis.__EDhooks = { init: HMp.InitHeat, exit: HU.ExitHeatMenu };
    HMp.InitHeat = function (e, t, a) {
      var r = KH.init.apply(this, arguments);
      try { if ((a === undefined || a) && globalThis.ED && ED.attach) ED.attach(this); } catch (x) {}
      return r;
    };
    HU.ExitHeatMenu = async function (w) {
      var E = globalThis.ED, wait = null;
      try { if (E && E.close) wait = E.close(w); } catch (x) {}
      if (wait) await wait;
      try { if (E && menu() === w) { E.stop(); globalThis.__ev3w = null; } } catch (x) {}
      return KH.exit.apply(this, arguments);
    };
  }
  return 'dial ready';   // packed: the InitHeat hook starts it
})();
  }]);

  // ---- entropy_dial_art.js ----
  layers.push(['entropy_dial_art.js', function () {
// The Entropy Dial's art layer: dresses the dial's laid-out frame with the game's own Entropy art (the ChaosValue atlases and
// the ChaosValue3MB textures) and plays the game's own Entropy UI effects on each event. Nothing here is drawn by code: every
// picture is a stock sprite or texture, every effect a stock UI effect, tinted half way. Three directions for the lead to
// pick from: ED.theme = 'A' (Circuit), 'B' (Arcane gold), 'C' (Abyss red). Load after entropy_dial.js.
(function () {
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, U = require('Core/Util').U;
  var D = globalThis.ED; if (!D) return 'no dial';
  var AT = 'UI/Atlas/ChaosValue/ChaosValue', TX = 'UI/Texture/ChaosValue3MB/';
  function C(a, al) { return new UE.Color(a[0], a[1], a[2], al == null ? 1 : al); }
  function V2v(x, y) { return new UE.Vector2(x, y); }
  function V3v(x, y, z) { return new UE.Vector3(x, y, z || 0); }
  function S3(x, y) { return new UE.Vector3(x, y, 1); }
  function cl(k) { return Math.max(0, Math.min(1, k)); }
  function ease(k) { k = cl(k); return 1 - Math.pow(1 - k, 3); }
  function inout(k) { k = cl(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(2 - 2 * k, 3) / 2; }
  function mix(a, b, k) { k = cl(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function note(s) { D.log.push('art ' + s); if (D.log.length > 40) D.log.shift(); }

  // the three directions: the frame's own hue (the mode keeps its hue on the hex, the word and the underline)
  var THEMES = {
    A: { name: 'Circuit', deg: 188, col: [0.42, 0.86, 1], ink: [0.86, 0.96, 1], circuit: 'BgChaotic6', bar: 'BtModeSwitching3', barCol: [1, 1, 1],
         plate: 'BgChaoticStage1', core: 'BgChaoticStage2', open: ['ChaosValue_505', 'chaosValue_sweep_501_1'], turn: 'ChaosValue_Select_kuang_502',
         rank: 'ChaosValue_503', shift: 'chaosValue_sweep_501_1', idle: 'ChaosValue_501', rings: 2 },
    B: { name: 'Arcane gold', deg: 40, col: [1, 0.78, 0.4], ink: [1, 0.95, 0.84], circuit: null, bar: 'BtModeSwitching2', barCol: [1, 0.8, 0.45],
         plate: 'BgChaoticStage1', core: 'BgChaoticStage2', open: ['ChaosValue_505', 'ChaosScheduleBGSweep_501'], turn: 'ChaosValue_Select_kuang_502',
         rank: 'ChaosScheduleUnlock_Complete', shift: 'ChaosScheduleBGSweep_501', idle: 'ChaosValue_501', rings: 3 },
    C: { name: 'Abyss red', deg: 354, col: [1, 0.3, 0.32], ink: [1, 0.9, 0.9], circuit: 'BgChaotic4', bar: 'ImageMapNameOpen', barCol: [1, 1, 1],
         plate: 'BgChaoticStage1', core: 'BgChaoticStage3', open: ['ChaosValue_507', 'chaosValue_sweep_501'], turn: 'ChaosValue_Select_kuang_502',
         rank: 'ChaosValue_507', shift: 'chaosValue_sweep_501', idle: 'ChaosValue_501', rings: 1, slash: true }
  };
  D.THEMES = THEMES; if (!D.theme) D.theme = 'A';

  // ---- stock pictures ----
  var SP = D.artSp = D.artSp || {};
  function sp(name) {
    if (SP[name]) return SP[name];
    var w = globalThis.__ev3w, s = null;
    try {
      if (name.indexOf('tex:') === 0) { var t = w.LoadTexture(TX + name.slice(4)); if (t) s = UE.Sprite.Create(t, new UE.Rect(0, 0, t.width, t.height), V2v(0.5, 0.5), 100); }
      // the game's own effect textures (chrome blades, lightning, digit rain, wire rings): 'fx:13_sharp/sharp_645_4r'
      else if (name.indexOf('fx:') === 0) { var t = w.LoadTexture('effect/common/texture/' + name.slice(3)); if (t && t.name) s = UE.Sprite.Create(t, new UE.Rect(0, 0, t.width, t.height), V2v(0.5, 0.5), 100); }
      // the ChaosValue art is split over three atlas bundles (stock index): try each
      // (a missing sprite comes back as a Unity null, which is truthy here: test its name)
      else for (var at of [AT, 'UI/Atlas/ChaosValue2/ChaosValue2', 'UI/Atlas/ChaosValue4/ChaosValue4', 'UI/Atlas/ChaosValue5/ChaosValue5']) {
        s = null; try { s = w.LoadSprite(at, name); if (s && !s.name) s = null; } catch (y) { s = null; } if (s) break;
      }
    } catch (x) { note('sprite ' + name + ' EXC ' + x); }
    if (!s) note('no sprite ' + name);
    return SP[name] = s;
  }
  D.artLoad = sp;
  function img(parent, name, w, h, sprite, col, al) {
    var go = new UE.GameObject('EDA' + name, TY(UE.RectTransform)); go.layer = parent.gameObject.layer; A.made.push(go); D.made.push(go);
    var t = go.transform; t.SetParent(parent, false); t.anchorMin = V2v(0.5, 0.5); t.anchorMax = V2v(0.5, 0.5); t.pivot = V2v(0.5, 0.5); t.sizeDelta = V2v(w, h);
    var im = go.AddComponent(TY(UE.UI.Image)); im.raycastTarget = false; im.sprite = sp(sprite) || D.sp.white; im.color = C(col || [1, 1, 1], al == null ? 1 : al);
    return im;
  }
  function node(parent, name, idx) {
    var go = new UE.GameObject('EDA' + name, TY(UE.RectTransform)); go.layer = parent.gameObject.layer; A.made.push(go); D.made.push(go);
    var t = go.transform; t.SetParent(parent, false); t.anchorMin = V2v(0.5, 0.5); t.anchorMax = V2v(0.5, 0.5); t.sizeDelta = V2v(1, 1);
    if (idx != null) t.SetSiblingIndex(idx);
    return t;
  }

  // ---- stock effects, tinted half way (the donor's brightness stays) ----
  function hsvOf(c) {
    var r = c.r, g = c.g, b = c.b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 1e-5) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    if (h < 0) h += 360; return { h: h, s: mx > 0 ? d / mx : 0, v: mx };
  }
  function rgbOf(h, s, v, a) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0, k = Math.floor(h / 60) % 6;
    if (k === 0) { r = c; g = x; } else if (k === 1) { r = x; g = c; } else if (k === 2) { g = c; b = x; } else if (k === 3) { g = x; b = c; } else if (k === 4) { r = x; b = c; } else { r = c; b = x; }
    return new UE.Color(r + m, g + m, b + m, a);
  }
  function rehue(c, deg) { var q = hsvOf(c); if (q.s < 0.15) return null; return rgbOf(deg, Math.min(1, q.s * 0.9), q.v, c.a); }
  var TO = D.artTint = D.artTint || {};
  function tinters(root, deg) {
    var ts = U.GetComponentsInChildren(root.gameObject, cs.NOAH.VFX.MaterialTinter, true);
    for (var k = 0; k < ts.Length; k++) {
      var ins = ts.get_Item(k).MaterialInterpolators;
      for (var j = 0; ins && j < ins.Length; j++) {
        var it = ins.get_Item(j); if (it.GetType().Name !== 'MaterialColorInterpolator') continue;
        var id = it.GetHashCode(); if (!TO[id]) TO[id] = { a: it.startValue, b: it.endValue };
        var o = TO[id], a = deg == null ? null : rehue(o.a, deg), b = deg == null ? null : rehue(o.b, deg);
        it.startValue = a || o.a; it.endValue = b || o.b;
      }
    }
  }
  // particle systems carry their colour in the start colour and the colour-over-life gradient, not the material
  function rehueGrad(g, deg) {
    var ks = g.colorKeys, n = [];
    for (var i = 0; i < ks.Length; i++) { var k = ks.get_Item(i), c = rehue(k.color, deg); n.push(new UE.GradientColorKey(c || k.color, k.time)); }
    var arr = cs.System.Array.CreateInstance(TY(UE.GradientColorKey), n.length); for (var j = 0; j < n.length; j++) arr.set_Item(j, n[j]);
    var out = new UE.Gradient(); out.SetKeys(arr, g.alphaKeys); out.mode = g.mode; return out;
  }
  function rehueMM(mm, deg) {
    var M = +mm.mode;   // 0 colour, 1 gradient, 2 two colours, 3 two gradients, 4 random colour
    if (M === 0) { var c = rehue(mm.color, deg); return c ? new UE.ParticleSystem.MinMaxGradient(c) : null; }
    if (M === 2) { var a = rehue(mm.colorMin, deg) || mm.colorMin, b = rehue(mm.colorMax, deg) || mm.colorMax; return new UE.ParticleSystem.MinMaxGradient(a, b); }
    if (M === 1 || M === 4) { var g = new UE.ParticleSystem.MinMaxGradient(rehueGrad(mm.gradient, deg)); g.mode = mm.mode; return g; }
    if (M === 3) return new UE.ParticleSystem.MinMaxGradient(rehueGrad(mm.gradientMin, deg), rehueGrad(mm.gradientMax, deg));
    return null;
  }
  function psTint(root, deg) {
    var ps = root.GetComponentsInChildren(TY(UE.ParticleSystem), true);
    for (var i = 0; i < ps.Length; i++) {
      var p = ps.get_Item(i);
      try { var mm = p.main, sc = rehueMM(mm.startColor, deg); if (sc) mm.startColor = sc; } catch (x) { note('ps start EXC ' + x); }
      try { var co = p.colorOverLifetime; if (co.enabled) { var cc = rehueMM(co.color, deg); if (cc) co.color = cc; } } catch (x) { note('ps col EXC ' + x); }
    }
  }
  // particle renderers: a private material each; a colour texture (name ends in c: the donor's pink is baked in) is
  // moved to the hue by a per-channel multiply on its tint, scaled to keep the donor's brightness
  var DONOR = [1, 0.2, 0.75], OM = D.artOM = D.artOM || {}, GC = D.artGC = D.artGC || {};
  function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  // a private copy of a donor material, always made from the material as first seen (pooled effects come back
  // wearing the last copy); a colour texture's baked pink is moved to the hue on _TintColor, other slots are rehued
  // whether a texture really carries colour: the name's "c" is not enough (the Entropy UI's mask_026_4c, streak_500_4c
  // and mask_501_2c are grey, and the pink compensation turned them green). Saturation of the brightness-weighted mean.
  var TS = D.artTS = D.artTS || {};
  function texBaked(mt) {
    if (!mt) return false; var nm = mt.name; if (TS[nm] != null) return TS[nm];
    var res = /c$/.test(nm);
    try {
      var rt = UE.RenderTexture.GetTemporary(32, 32, 0); UE.Graphics.Blit(mt, rt); var pv = UE.RenderTexture.active; UE.RenderTexture.active = rt;
      var tx = new UE.Texture2D(32, 32, UE.TextureFormat.RGBA32, false); tx.ReadPixels(new UE.Rect(0, 0, 32, 32), 0, 0); tx.Apply();
      UE.RenderTexture.active = pv; UE.RenderTexture.ReleaseTemporary(rt);
      var r = 0, g = 0, b = 0, w = 0;
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var c = tx.GetPixel(x, y), k = Math.max(c.r, c.g, c.b) * c.a; r += c.r * k; g += c.g * k; b += c.b * k; w += k; }
      UE.Object.Destroy(tx);
      if (w) { var hi = Math.max(r, g, b), lo = Math.min(r, g, b); res = hi > 0 && (hi - lo) / hi > 0.15; }
    } catch (x) { note('texBaked ' + nm + ' EXC ' + x); }
    return (TS[nm] = res);
  }
  function matTint(id, m0, deg) {
    var m = OM[id] || (OM[id] = m0); if (!m) return null;
    var tc = rgbOf(deg, 0.6, 1, 1), t = [tc.r, tc.g, tc.b], k = lum(DONOR) / lum(t);
    var comp = [t[0] / DONOR[0] * k, t[1] / DONOR[1] * k, t[2] / DONOR[2] * k];
    var sh = m.shader, pc = sh.GetPropertyCount(), mt = m.mainTexture, baked = texBaked(mt), cp = new UE.Material(m);
    for (var j = 0; j < pc; j++) {
      if (+sh.GetPropertyType(j) !== 0) continue; var nm = sh.GetPropertyName(j), c = m.GetColor(nm);
      if (baked && nm === '_TintColor') cp.SetColor(nm, new UE.Color(c.r * comp[0], c.g * comp[1], c.b * comp[2], c.a));
      else { var nc = rehue(c, deg); if (nc) cp.SetColor(nm, nc); }
    }
    return cp;
  }
  function prTint(root, deg) {
    var rs = root.GetComponentsInChildren(TY(UE.ParticleSystemRenderer), true);
    for (var i = 0; i < rs.Length; i++) { var r = rs.get_Item(i), cp = matTint(r.GetInstanceID(), r.sharedMaterial, deg); if (cp) r.sharedMaterial = cp; }
  }
  function halfTint(deg) { if (deg == null) return C([1, 1, 1]); var c = rgbOf(deg, 0.75, 1, 1); return new UE.Color((1 + c.r) / 2, (1 + c.g) / 2, (1 + c.b) / 2, 1); }
  // plays one stock effect on host at (x, y); it is removed after life frames (0: kept, for the loops)
  function fx(host, name, x, y, s, deg, life, rot) {
    var go = new UE.GameObject('EDAfx_' + name, TY(UE.RectTransform)); go.layer = host.gameObject.layer; D.made.push(go);
    var rt = go.transform; rt.SetParent(host, false); rt.anchorMin = V2v(0.5, 0.5); rt.anchorMax = V2v(0.5, 0.5); rt.pivot = V2v(0.5, 0.5);
    rt.sizeDelta = V2v(100, 100); rt.anchoredPosition = V2v(x || 0, y || 0); if (rot) rt.localEulerAngles = V3v(0, 0, rot);
    var p = go.AddComponent(TY(cs.NOAH.VFX.VFXEffectPlayer)); p.m_param = new cs.EffectPlayParamEx();
    p.m_param.name = 'UI/Common/' + name; p.m_param.target = rt; p.m_param.bind = true; p.m_param.AutoOrder = true;
    p.m_param.localScale = V3v(s || 1, s || 1, 1);
    try { p.PlayEffect(1); } catch (e) { note('fx ' + name + ' EXC ' + e); }
    try {
      var e2 = p.Effect; if (e2) (D.fxSeen = D.fxSeen || {})[name] = e2;   // for probes: the last play of each effect
      if (e2 && deg === false) {   // the donor's own colours: a pooled play may come back wearing another theme's copies
        tinters(e2.transform, null);
        var rg = U.GetComponentsInChildren(e2.gameObject, UE.UI.Graphic, true);
        for (var i = 0; i < rg.Length; i++) { var g = rg.get_Item(i), id = g.GetInstanceID(); if (OM[id]) g.material = OM[id]; if (GC[id]) g.color = GC[id]; }
        var rr = e2.transform.GetComponentsInChildren(TY(UE.ParticleSystemRenderer), true);
        for (var i = 0; i < rr.Length; i++) { var r = rr.get_Item(i), id = r.GetInstanceID(); if (OM[id]) r.sharedMaterial = OM[id]; }
      }
      if (e2 && deg !== false) {
        tinters(e2.transform, deg); if (deg != null) { psTint(e2.transform, deg); prTint(e2.transform, deg); }
        var gs = U.GetComponentsInChildren(e2.gameObject, UE.UI.Graphic, true), c = halfTint(deg);
        for (var i = 0; i < gs.Length; i++) {
          var g = gs.get_Item(i), gid = g.GetInstanceID(); if (!GC[gid]) GC[gid] = g.color; g.color = c;
          // the donor's own colours live in its materials (UIParticle draws the ring with the Graphic's material)
          if (deg == null) continue; var cp = matTint(g.GetInstanceID(), g.material, deg); if (cp) g.material = cp;
        }
      }
    } catch (e) { note('tint ' + name + ' EXC ' + e); }
    var o = { go: go, end: life ? D.t + life : 0 }; if (life) A.fx.push(o); return o;
  }
  function modeDeg(hue) { return hsvOf(new UE.Color(hue[0], hue[1], hue[2], 1)).h; }

  // ---- build the dressing for one theme ----
  var A = D.artA || { made: [], fx: [] };
  function teardown() {
    for (var g of A.made) try { UE.Object.Destroy(g); } catch (x) {}
    for (var f of A.fx) try { UE.Object.Destroy(f.go); } catch (x) {}
    if (A.idle) try { UE.Object.Destroy(A.idle.go); } catch (x) {}
    A = D.artA = { made: [], fx: [] };
  }
  function build(B, T) {
    teardown(); A.B = B; A.theme = D.theme; A.T = T;
    var L = D.L, R = L.R, root = B.root, dial = B.dial;
    // behind everything on the root: the theme's backdrop
    var bk = A.back = node(root, 'Back', 1);
    if (T.slash) {   // Abyss red: two long slanted bars across the screen, the plaque riding the lower one (Persona)
      A.band1 = img(bk, 'Band1', 3600, 300, 'BgModeSwitching', [1, 1, 1], 0.55); A.band1.transform.localPosition = V3v(-200, -10); A.band1.transform.localEulerAngles = V3v(0, 0, 9);
      A.band2 = img(bk, 'Band2', 3600, 60, 'BgModeSwitching', [1, 1, 1], 0.8); A.band2.transform.localPosition = V3v(0, -240); A.band2.transform.localEulerAngles = V3v(0, 0, 9);
    }
    A.banner = img(bk, 'Banner', 2560, 640, 'tex:BgDChao', T.col, 0.16); A.banner.transform.localPosition = V3v(0, 470);
    if (T.circuit) {   // circuit traces climbing out of the dial on both sides
      A.circL = img(bk, 'CircL', 676 * 0.95, 816 * 0.95, T.circuit, [1, 1, 1], 0.6); A.circL.transform.localPosition = V3v(-430, L.cy - 40);
      A.circR = img(bk, 'CircR', 676 * 0.95, 816 * 0.95, T.circuit, [1, 1, 1], 0.6); A.circR.transform.localPosition = V3v(430, L.cy - 40); A.circR.transform.localScale = S3(-1, 1);
    }
    // the dial's rings: the stock graduated compass ring and the bracket plate behind the sockets
    var rb = A.rings = node(dial, 'Rings', 0);
    A.tick = img(rb, 'Tick', R * 2.9, R * 2.9, 'tex:BgDChaoModeSwitch', T.col, 0.75);
    A.plateDisc = img(rb, 'PlateDisc', R * 2.25, R * 2.25, 'tex:BgDChaoModeSwitch2', T.col, 0.55);
    if (T.rings >= 2) A.tick2 = img(rb, 'Tick2', R * 1.75, R * 1.75, 'tex:BgDChaoModeSwitch', T.col, 0.35);
    if (T.rings >= 3) A.tick3 = img(rb, 'Tick3', R * 3.4, R * 3.4, 'tex:BgDChaoModeSwitch', T.col, 0.22);
    // the core: a dotted hex plate under the total, a lit hex frame round it (C: the red hex light behind)
    var cb = A.core = node(dial, 'Core', 1);
    if (T.slash) A.light = img(cb, 'Light', R * 1.05, R * 1.21, 'ChaoticStageLight', [1, 1, 1], 0.9);
    A.corePlate = img(cb, 'CorePlate', R * 0.86, R * 0.99, T.core, [1, 1, 1], 0.95);
    A.coreFrame = img(cb, 'CoreFrame', R * 0.98, R * 1.09, 'ImgChaoticStageSelect', [1, 1, 1], 1);
    // the mode underline: a stock slanted tab (C: the red name bar behind the word)
    A.under = img(root, 'Under', 360, 46, T.slash ? 'ImageMapNameOpen' : 'tex:ImgSelect03', [1, 1, 1], 1);
    A.under.transform.SetSiblingIndex(B.words[0].transform.GetSiblingIndex());
    // the plaque: its name bar is the stock mode-switch bar, its plate gets the stock list frame lines
    A.bar = img(B.plaque, 'Bar', 760, 108, T.bar, T.barCol, 1); A.bar.transform.SetSiblingIndex(B.bar.transform.GetSiblingIndex());
    A.bar.transform.localPosition = V3v(10, 280); A.bar.transform.localEulerAngles = V3v(0, 0, 1.5);
    A.lineT = img(B.plaque, 'LineT', 700, 8, 'TipsChos', T.col, 0.9); A.lineT.transform.localPosition = V3v(0, 222);
    A.lineB = img(B.plaque, 'LineB', 700, 8, 'TipsChos', T.col, 0.6); A.lineB.transform.localPosition = V3v(0, -250);
    A.mark = img(B.plaque, 'Mark', 26, 30, 'ImgPhaseMarker1', T.col, 1);
    A.rlineT = img(B.right, 'RLineT', 600, 8, 'TipsChos', T.col, 0.7); A.rlineT.transform.localPosition = V3v(0, 302);
    A.rlineM = img(B.right, 'RLineM', 600, 8, 'TipsChos', T.col, 0.5); A.rlineM.transform.localPosition = V3v(0, 72);
    // the 12 perk slots on the outer ring: stock stage hexes, lit ones the stock lit cube
    A.perks = [];
    for (var q = 0; q < 12; q++) { var pk = img(B.perkRing, 'Perk' + q, 34, 38, 'BgStageL', [1, 1, 1], 1); A.perks.push(pk); }
    // the socket parts are swapped on the dial's own socket pieces each frame (they are made as the rows come in)
    A.idleAt = null; A.lastTurn = D.turnAt; A.lastRank = D.rankAt; A.lastShift = D.shiftAt; A.lastOpen = null;
    note('built ' + D.theme);
  }
  function dressSocket(S, T) {
    if (S.dressed === A) return;
    S.plate.sprite = sp(T.plate); S.plate.transform.sizeDelta = V2v(68, 78); S.plate.preserveAspect = false;
    S.rim.sprite = sp('ImgChaoticStageSelect'); S.rim.transform.sizeDelta = V2v(80, 89);
    S.icon.transform.sizeDelta = V2v(38, 38);
    for (var p = 0; p < S.pips.length; p++) S.pips[p].transform.sizeDelta = V2v(13, 13);
    S.dressed = A;
  }

  // ---- every frame, after the dial's own ----
  D.art = function (w, B) {
    var T = THEMES[D.theme] || THEMES.A, fr = D.fr;
    if (A.B !== B || A.theme !== D.theme) build(B, T);
    var t = D.t, hue = fr.hue, oF = fr.oF, shF = fr.shF, R = D.L.R;
    // the stand-ins give way: their timing now drives the stock parts and effects
    B.halo.color = C([1, 1, 1], 0); B.inner.color = C([1, 1, 1], 0); B.hex.color = C([1, 1, 1], 0);
    B.fxGlow.color = C([1, 1, 1], 0); B.fxHex.color = C([1, 1, 1], 0); B.fxRank.color = C([1, 1, 1], 0);
    for (var sb = 0; sb < B.fxSweepBars.length; sb++) B.fxSweepBars[sb].color = C([1, 1, 1], 0);
    B.foot.gameObject.SetActive(false); B.plate.color = C([0.06, 0.065, 0.08], 0.92); B.bar.color = C([1, 1, 1], 0);
    B.shade.color = C([0.035, 0.038, 0.05], 1);
    // rings: grow with the dial's open, each turning at its own speed (B counter-rotates like an astrolabe)
    var os = fr.os, oa = fr.oa, spin = t / 60;
    A.rings.localScale = S3(os, os);
    A.tick.transform.localEulerAngles = V3v(0, 0, -spin * 1.5); A.tick.color = C(T.col, 0.7 * oa);
    A.plateDisc.transform.localEulerAngles = V3v(0, 0, D.theme === 'B' ? spin * 4 : 0); A.plateDisc.color = C(T.col, 0.5 * oa);
    if (A.tick2) { A.tick2.transform.localEulerAngles = V3v(0, 0, spin * (D.theme === 'B' ? 9 : 3)); A.tick2.color = C(T.col, 0.35 * oa); }
    if (A.tick3) { A.tick3.transform.localEulerAngles = V3v(0, 0, -spin * 0.8); A.tick3.color = C(T.col, 0.2 * oa); }
    // a mode change: the rings swing a quarter turn the way the arc moved, eased both ends
    if (shF != null) A.rings.localEulerAngles = V3v(0, 0, -30 * D.shiftDir * (1 - inout(shF / D.F.shift)));
    else A.rings.localEulerAngles = V3v(0, 0, 0);
    // the core takes the mode hue; it breathes with the dial's hex
    var hs = fr.hs; A.core.localScale = S3(hs, hs);
    // one dominant hue per direction: the core is the theme's, the mode hue only edges it
    A.coreFrame.color = C(mix(T.col, hue, 0.2), fr.ha);
    A.corePlate.color = C(mix([1, 1, 1], T.col, 0.3), 0.95 * fr.ha);
    B.name.color = C(T.ink, 1); B.rank.color = C(mix(T.ink, T.col, 0.5), 1);
    if (!fr.over) B.total.color = C(T.ink, B.total.color.a);
    // the block-out's gold texts on the plaque and the right column take the theme's accent (alpha kept)
    // the dial's texts share a font material with a fire outline and underlay: each theme gets its own copy, its
    // outline and underlay in the theme colour, the vertex gradient off
    if (!A.texts) {
      A.texts = [];
      var tgs = B.root.GetComponentsInChildren(TY(UE.UI.Graphic), true);
      for (var gi = 0; gi < tgs.Length; gi++) { var gg = tgs.get_Item(gi); if (/TextMeshPro/.test(gg.GetType().Name)) A.texts.push(gg); }
      var FM = D.artFont = D.artFont || {};   // source material id -> { src, per theme copy }
      for (var ti = 0; ti < A.texts.length; ti++) {
        var tx = A.texts[ti], sm = tx.fontSharedMaterial; if (!sm) continue;
        var e = null; for (var key in FM) if (FM[key].src === sm || FM[key][D.theme] === sm || FM[key].A === sm || FM[key].B === sm || FM[key].C === sm) { e = FM[key]; break; }
        if (!e) e = FM[sm.GetInstanceID()] = { src: sm };
        if (!e[D.theme]) { var fm = e[D.theme] = new UE.Material(e.src); fm.name = 'EDA font ' + D.theme;
          if (fm.HasProperty('_OutlineColor')) fm.SetColor('_OutlineColor', C(mix(T.col, [0, 0, 0], 0.35), 1));
          if (fm.HasProperty('_UnderlayColor')) fm.SetColor('_UnderlayColor', C(mix(T.col, [0, 0, 0], 0.7), 0.7)); }
        tx.fontSharedMaterial = e[D.theme]; tx.enableVertexGradient = false;
      }
    }
    if (A.light) A.light.color = C([1, 1, 1], fr.ha * (0.75 + 0.25 * Math.cos(t * Math.PI / 45)));
    // backdrop
    var bA = inout((oF - 3) / 12);   // final review M3: eased over 12 f
    A.banner.color = C(T.col, 0.14 * bA);
    if (A.circL) { var cA = 0.55 * ease((oF - 3) / 14); A.circL.color = C([1, 1, 1], cA); A.circR.color = C([1, 1, 1], cA); }
    if (A.band1) {
      var bk = ease((oF - 1) / 10); A.band1.transform.localPosition = V3v(-200 - 900 * (1 - bk), -10); A.band1.color = C([1, 1, 1], 0.55 * bk);
      A.band2.transform.localPosition = V3v(300 * (1 - bk), -240); A.band2.color = C([1, 1, 1], 0.85 * bk);
      // a mode change: the wide band slashes out the way the arc moved and back (Persona's wipe), 16 f
      if (shF != null) A.band1.transform.localPosition = V3v(-200 - D.shiftDir * 1400 * Math.sin(Math.PI * inout(shF / 16)), -10);
    }
    // the underline and the plaque frame
    var wA = cl((oF - 2) / 4), uw = B.under.transform.localScale.x;
    A.under.transform.localPosition = V3v(0, D.L.arcY - (T.slash ? 2 : 36)); A.under.transform.localScale = S3(uw, 1);
    if (T.slash) { var cwd = B.words[Math.round(D.arcPos)]; if (cwd) A.under.transform.sizeDelta = V2v(cwd.preferredWidth + 90, 52); }
    A.under.color = T.slash ? C([1, 1, 1], 0.95 * wA) : C(mix(hue, [1, 1, 1], 0.2), wA);
    B.under.color = C([1, 1, 1], 0);
    if (T.slash) { var cw = B.words[Math.round(D.arcPos)]; if (cw) cw.color = C([1, 1, 1], wA); }
    A.bar.color = C(T.barCol, 1);
    A.mark.transform.localPosition = V3v(-320, fr.rows[fr.selIdx] ? 120 - (Math.max(1, fr.rows[fr.selIdx].lv) - 1) * 48 : 120);
    A.mark.color = C(T.col, fr.rows[fr.selIdx] && fr.rows[fr.selIdx].lv ? 1 : 0);
    B.otBg.color = C([0.06, 0.065, 0.08], 0.9); B.ruBg.color = C([0.06, 0.065, 0.08], 0.9);
    // perks: stock stage hexes; open ones lit in the theme colour
    if (fr.big) for (var q = 0; q < 12; q++) {
      var P = B.perks[q], AP = A.perks[q], lit = P.color.a > 0 && P.color.r > 0.4;
      AP.transform.localPosition = P.transform.localPosition; AP.transform.localScale = P.transform.localScale;
      AP.sprite = sp(lit ? 'IconChos1' : 'BgStageL'); AP.color = C(lit ? T.col : [1, 1, 1], P.color.a > 0 ? Math.min(1, P.color.a * 1.6) : 0);
      P.color = C([1, 1, 1], 0);
    }
    // sockets: the stock dotted hex plates, a lit hex frame on the selected one, ranks as stock lit cubes
    for (var k = 0; k < fr.n; k++) {
      var S = B.socks[k], Rw = fr.rows[k], isSel = k === fr.selIdx; if (!S) continue;
      dressSocket(S, T);
      // final review M5: white glyphs on dark tiles; ranked tiles carry the hue's rim, the selected one a white rim at 1.25
      var ssc = isSel ? 1.25 : 1;
      S.plate.color = C(isSel ? [0.1, 0.13, 0.16] : [0.06, 0.07, 0.085], 0.97);
      S.rim.color = isSel ? C([1, 1, 1], 1) : Rw.lv > 0 ? C(T.col, 0.95) : C([0.32, 0.36, 0.42], 0.55);
      S.icon.color = C([1, 1, 1], isSel || Rw.lv > 0 ? 1 : 0.62);
      S.plate.transform.localScale = S3(ssc, ssc); S.rim.transform.localScale = S3(ssc, ssc); S.icon.transform.localScale = S3(ssc, ssc);
      for (var p = 0; p < S.pips.length; p++) {
        var pi = S.pips[p]; if (!pi.gameObject.activeSelf) continue;
        var on = p < Rw.lv; pi.sprite = sp(on ? 'IconChos1' : 'ImgPhaseBeActivated');
        pi.color = on ? C(isSel ? mix(T.col, [1, 1, 1], 0.3) : T.col, 1) : C([0.6, 0.6, 0.65], 0.8);
        if (isSel && (Math.floor(fr.rF) === 1 || Math.floor(fr.rF) === 2)) pi.color = C([1, 1, 1], 1);
      }
    }
    // ---- events: the stock effects ----
    if (A.lastOpen !== D.openAt) {   // the open: the hex pop on the core at f0, the circuit sweep at f2
      A.lastOpen = D.openAt; A.openFx = [false, false];
    }
    if (A.openFx && !A.openFx[0] && oF >= 0) { A.openFx[0] = true; fx(B.dial, T.open[0], 0, 0, 1.5, D.theme === 'C' ? false : T.deg, 70); }
    if (A.openFx && !A.openFx[1] && oF >= 2) { A.openFx[1] = true; fx(A.rings, T.open[1], 0, 0, D.theme === 'B' ? 2.6 : 1.9, T.deg, 90); }
    if (D.turnAt != null && A.lastTurn !== D.turnAt && t - D.turnAt >= 3) {   // a turn: the select frame snaps onto the new socket as it lands
      A.lastTurn = D.turnAt; var St = B.socks[fr.selIdx];
      // final review 2 N1: the frame rode the socket that lost the selection for 40 f and read as a second selected tile;
      // one frame at a time, short enough to be gone before the next turn lands
      if (A.turnFx) { try { UE.Object.Destroy(A.turnFx.go); } catch (x) {} A.turnFx = null; }
      if (St) A.turnFx = fx(St.t, T.turn, 0, 0, 0.42, T.deg, 14);
    }
    if (D.rankAt != null && A.lastRank !== D.rankAt) {   // a rank change: the hex pop on the socket, the core flashes
      A.lastRank = D.rankAt; var Sr = B.socks[fr.selIdx];
      if (Sr) fx(Sr.t, T.rank, 0, 0, D.theme === 'B' ? 0.7 : 0.55, D.theme === 'C' ? false : T.deg, 60);
      fx(B.dial, 'ChaosValue_Select_kuang_502', 0, 0, 1.25, T.deg, 40);
    }
    if (D.shiftAt != null && A.lastShift !== D.shiftAt && shF != null) {   // a mode change: one sweep in the theme's hue (the mode's own hue stays on the hex, word and underline: one dominant hue)
      A.lastShift = D.shiftAt;
      fx(A.rings, T.shift, 0, 0, D.theme === 'B' ? 2.6 : 1.9, T.deg, 90, D.shiftDir < 0 ? 180 : 0);
      if (A.idle) { try { UE.Object.Destroy(A.idle.go); } catch (x) {} A.idle = null; A.idleAt = t + 16; }
    }
    // idle: the stock hex glow loop round the core, in the mode's hue (C keeps the donor red)
    if (!A.idle && oF >= 14 && (A.idleAt == null || t >= A.idleAt)) {
      A.idle = fx(A.core, T.idle, 0, 0, 1.55, D.theme === 'C' ? false : T.deg, 0); A.idleMode = fr.mode;
      // the loop's ring draws a colour texture with a pink-to-violet ramp baked in, which no tint moves to cyan or gold:
      // A and B keep only its grey-mask glow layers
      // (set both ways: the effect is pooled, and C reuses the same play)
      try { var rg = A.idle.go.transform.GetComponentsInChildren(TY(UE.Transform), true); for (var q = 0; q < rg.Length; q++) if (rg.get_Item(q).name === 'ring') rg.get_Item(q).gameObject.SetActive(D.theme === 'C'); } catch (x) { note('ring EXC ' + x); }
    }
    for (var i = A.fx.length - 1; i >= 0; i--) if (A.fx[i].end && t >= A.fx[i].end) { try { UE.Object.Destroy(A.fx[i].go); } catch (x) {} A.fx.splice(i, 1); }
  };
  D.artA = A;
  return 'art on, theme ' + D.theme;
})();
  }]);

  // ---- entropy_dial_motifs.js ----
  layers.push(['entropy_dial_motifs.js', function () {
// The Entropy Dial's motif layer, round 2 (the lead, 2026-10-24: "the mockup does not have enough inspiration taken from
// all the images i sent you"). This file is the shared part: helpers, the build-on-change and the per-frame hook. Each
// direction is its own file, loaded after this one: motif_A.js (Circuit: images 02-05 and 08-12), motif_B.js (Arcane
// gold: image 01), motif_C.js (Abyss red: images 06 and 07). The take per image is in
// docs\redux\ui-desk\ENTROPY_DIAL_CARDS.md. Everything is the game's own fonts, stock sprites and stock effects, or art
// drawn in Krita (art\*.kra). Load after entropy_dial_art.js (reloading the art file drops the hook).
(function () {
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, U = require('Core/Util').U;
  var D = globalThis.ED; if (!D || !D.art) return 'no art layer';
  var H = D.MH = {};
  H.UE = UE; H.TY = TY; H.U = U;
  H.C = function (a, al) { return new UE.Color(a[0], a[1], a[2], al == null ? 1 : al); };
  H.V2 = function (x, y) { return new UE.Vector2(x, y); };
  H.V3 = function (x, y, z) { return new UE.Vector3(x, y, z || 0); };
  H.S3 = function (x, y) { return new UE.Vector3(x, y == null ? x : y, 1); };
  H.cl = function (k) { return Math.max(0, Math.min(1, k)); };
  H.ease = function (k) { k = H.cl(k); return 1 - Math.pow(1 - k, 3); };
  H.easeIn = function (k) { k = H.cl(k); return k * k * k; };
  H.inout = function (k) { k = H.cl(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(2 - 2 * k, 3) / 2; };
  H.back = function (k) { k = H.cl(k); var c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };   // overshoots, settles
  H.bell = function (k) { k = H.cl(k); return Math.sin(Math.PI * k); };
  H.mix = function (a, b, k) { k = H.cl(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
  H.hex2 = function (a) { var v = Math.round(H.cl(a) * 255).toString(16); return v.length < 2 ? '0' + v : v; };
  H.hexc = function (c, a) { return '#' + H.hex2(c[0]) + H.hex2(c[1]) + H.hex2(c[2]) + H.hex2(a == null ? 1 : a); };
  // seeded, so a rebuild looks the same every time (recordings repeat)
  var seed = 7; H.seed = function (s) { seed = s; }; H.rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  var M = D.MS = D.MS || { made: [] };
  function teardown() { for (var g of M.made) try { UE.Object.Destroy(g); } catch (x) {} M = D.MS = { made: [] }; }
  H.node = function (parent, name, idx) {
    var go = new UE.GameObject('EDM' + name, TY(UE.RectTransform)); go.layer = parent.gameObject.layer; M.made.push(go); D.made.push(go);
    var t = go.transform; t.SetParent(parent, false); t.anchorMin = H.V2(0.5, 0.5); t.anchorMax = H.V2(0.5, 0.5); t.sizeDelta = H.V2(1, 1);
    if (idx != null) t.SetSiblingIndex(idx); return t;
  };
  // sprite: a stock name (the art layer's loader), 'dial:<key>' for the dial's own shapes, or 'png:<file>' for Krita art
  H.sprite = function (name) {
    if (!name) return D.sp.white;
    if (name.indexOf('dial:') === 0) return D.sp[name.slice(5)] || D.sp.white;
    if (name.indexOf('png:') === 0) return H.png(name.slice(4));
    return (D.artLoad ? D.artLoad(name) : D.artSp[name]) || D.sp.white;
  };
  var PNG = D.MPNG = D.MPNG || {};
  H.png = function (file) {
    if (PNG[file]) return PNG[file];
    var path = 'C:/BBEE_Steam/local_only/redux/ui-study/entropyv3/art/' + file;
    if (!cs.System.IO.File.Exists(path)) return D.sp.white;
    var tx = new UE.Texture2D(2, 2, UE.TextureFormat.RGBA32, true); tx.wrapMode = 0;
    UE.ImageConversion.LoadImage(tx, cs.System.IO.File.ReadAllBytes(path), false);
    var s = UE.Sprite.Create(tx, new UE.Rect(0, 0, tx.width, tx.height), H.V2(0.5, 0.5), 100);
    return PNG[file] = s;
  };
  H.img = function (parent, name, w, h, sprite, col, al) {
    var t = H.node(parent, name); t.sizeDelta = H.V2(w, h);
    var im = t.gameObject.AddComponent(TY(UE.UI.Image)); im.raycastTarget = false; im.sprite = H.sprite(sprite); im.color = H.C(col || [1, 1, 1], al == null ? 1 : al);
    return im;
  };
  // fonts: the game's own (Aldrich, Oswald Bold, Oswald, MiSans), found on the screen's texts once
  H.font = function (key) {
    var F = D.MFONT = D.MFONT || {};
    if (!F.ready) {
      var a = UE.Object.FindObjectsOfType(TY(cs.TMPro.TextMeshProUGUI), true);
      for (var i = 0; i < a.Length; i++) { var t = a.get_Item(i), f = t.font, m = t.fontSharedMaterial; if (!f || !m) continue;
        var n = f.name; if (!F[n] && m.name.indexOf(n.replace('-SDF', '')) === 0) F[n] = [f, m]; }
      F.ready = 1;
    }
    return F[key] || null;
  };
  // texts copy the dial's LB label (the game's font, the theme's font material) unless a font is named
  H.txt = function (parent, name, fs, w, h, align, font) {
    var go = UE.Object.Instantiate(D.B.lb.gameObject, parent, false); go.name = 'EDM' + name; M.made.push(go); D.made.push(go);
    var t = go.transform; t.anchorMin = H.V2(0.5, 0.5); t.anchorMax = H.V2(0.5, 0.5); t.pivot = H.V2(0.5, 0.5); t.sizeDelta = H.V2(w, h); t.anchoredPosition = H.V2(0, 0);
    t.localScale = H.S3(1, 1); t.localEulerAngles = H.V3(0, 0);
    var tm = U.GetComponent(go, cs.TMPro.TextMeshProUGUI); tm.enableAutoSizing = false; tm.fontSize = fs; tm.alignment = align || 514;
    tm.enableWordWrapping = false; tm.overflowMode = 0; tm.richText = true; tm.raycastTarget = false; tm.enableVertexGradient = false;
    tm.characterSpacing = 0; tm.fontStyle = 0;
    if (font) { var ff = H.font(font); if (ff) { tm.font = ff[0]; tm.fontSharedMaterial = ff[1]; } }
    return tm;
  };
  // a ransom-note word (Persona 5's cut letters, image 07): each letter its own plate, font, size and tilt, seeded by the word
  var FACES = ['Oswald-Bold-SDF', 'Aldrich-Desc-SDF', 'MiSans-Medium-SDF', 'Oswald-SDF'];
  H.ransom = function (parent, name, word, size, opt) {
    opt = opt || {}; var r = H.node(parent, name), pl = H.node(r, 'P'), ink = H.node(r, 'I'), parts = [], x = 0;
    H.seed(opt.seed || (31 + word.length * 7 + word.charCodeAt(0)));
    for (var i = 0; i < word.length; i++) {
      var ch = word[i]; if (ch === ' ') { x += size * 0.4; continue; }
      var big = H.rnd() < 0.3, fs = Math.round(size * (big ? 1.25 : 0.86 + H.rnd() * 0.2)), face = FACES[Math.floor(H.rnd() * FACES.length)];
      var kind = H.rnd(), red = opt.red == null ? 0.22 : opt.red;
      var plate = kind < red ? [0.86, 0.06, 0.12] : kind < 0.62 ? [0.02, 0.02, 0.025] : [1, 1, 1];
      var col = kind < red ? [1, 1, 1] : kind < 0.62 ? [1, 1, 1] : [0.02, 0.02, 0.025];
      if (opt.mono) { plate = kind < 0.5 ? [0.02, 0.02, 0.025] : [1, 1, 1]; col = kind < 0.5 ? [1, 1, 1] : [0.02, 0.02, 0.025]; }
      var w = fs * (face.indexOf('Oswald') === 0 ? 0.6 : 0.78);
      var pn = H.node(pl, 'L' + i), pi = H.img(pn, 'p', w + fs * 0.16, fs * 1.02, null, plate, 1);
      var ln = H.node(ink, 'L' + i), tm = H.txt(ln, 't', fs, w + 20, fs + 10, 514, face); tm.text = ch; tm.color = H.C(col, 1);
      if (H.rnd() < 0.3) tm.fontStyle = 2;   // italic now and then
      var tilt = (H.rnd() - 0.5) * 18;
      ln.localEulerAngles = H.V3(0, 0, tilt); pn.localEulerAngles = H.V3(0, 0, tilt + (H.rnd() - 0.5) * 8);
      parts.push({ ln: ln, pn: pn, pi: pi, tm: tm, x: x + w / 2, y: (H.rnd() - 0.5) * size * 0.18, plate: plate, col: col, at: parts.length });
      x += w + fs * 0.04;
    }
    for (var p of parts) { p.x -= opt.left ? 0 : x / 2; p.ln.localPosition = p.pn.localPosition = H.V3(p.x, p.y); }
    return { t: r, parts: parts, width: x, word: word };
  };
  // letters cut in one after another: k = frames since the word appeared
  H.ransomIn = function (rw, k, step, al) {
    for (var p of rw.parts) {
      var e = H.back((k - p.at * (step || 1.2)) / 6), a = H.cl((k - p.at * (step || 1.2)) / 2) * (al == null ? 1 : al);
      var s = 0.4 + 0.6 * e; p.ln.localScale = p.pn.localScale = H.S3(s, s);
      p.pi.color = H.C(p.plate, a); p.tm.color = H.C(p.col, a);
    }
  };
  H.ransomDestroy = function (rw) { if (rw) try { UE.Object.Destroy(rw.t.gameObject); } catch (x) {} };
  // a flipbook row of an effect texture (lightning_705 is six bolts stacked): a RawImage showing one band of it
  H.raw = function (parent, name, w, h, sprite, col, al) {
    var t = H.node(parent, name); t.sizeDelta = H.V2(w, h);
    var ri = t.gameObject.AddComponent(TY(UE.UI.RawImage)); ri.raycastTarget = false; ri.texture = H.sprite(sprite).texture; ri.color = H.C(col || [1, 1, 1], al == null ? 1 : al);
    return ri;
  };
  H.aspect = function (sprite) { var s = H.sprite(sprite), r = s.rect; return r.height / r.width; };

  // ---- the metal heart (images 04, 05, 09, 10, 11): the game's chrome blades burst out of a light source ----
  // o: name, x, y, n, blades (fx sprite names, all pointing right), r0, len [min, max], col (chrome tint), al,
  //    rim (rim-light colour or null), glow (light colour), glowR, arcs (lightning count), arcCol, spin (deg / frame), seed
  H.heart = function (parent, o) {
    var hp = { o: o, blades: [], arcs: [], root: H.node(parent, o.name || 'Heart') };
    var r = hp.root; r.localPosition = H.V3(o.x || 0, o.y || 0);
    var lr = hp.light = H.node(r, 'Light');
    hp.glow = H.img(lr, 'Glow', Math.min(o.glowR, 400) * 2, Math.min(o.glowR, 400) * 2, 'fx:02_glow/glow_204_4c', o.glow, 0);
    hp.lines = H.img(lr, 'Lines', o.glowR * 1.5, o.glowR * 1.5, 'fx:11_ring/ring_022_4c', o.glow, 0);
    hp.streak = H.img(lr, 'Streak', o.glowR * 4.2, o.glowR * 0.22, 'fx:02_glow/glow_701_4r', o.glow, 0);
    // the white-hot core (review r3): white in a ring round the total's dark plate, the direction's colour only outside it
    hp.core = H.img(lr, 'Core', 640, 640, 'fx:02_glow/glow_204_4c', [1, 1, 1], 0);
    var br = hp.bl = H.node(r, 'Blades');
    H.seed(o.seed || 77);
    // review r3: no blade in a gap at 12 o'clock (the mode header), and none whose tip (with the burst's overshoot) reaches
    // the footer prompts; each blade gets a dark copy behind it (its black side) and every third a white spec line
    var gap = o.gap == null ? 24 : o.gap, span = 360 - gap, floorY = o.floorY == null ? -580 : o.floorY;
    for (var i = 0; i < o.n; i++) {
      var a = 90 + gap / 2 + ((i + 0.5) / o.n) * span + (H.rnd() - 0.5) * (span / o.n) * 0.7, name = o.blades[i % o.blades.length];
      var r0 = o.r0 * (0.85 + H.rnd() * 0.3), sn = Math.sin(a * Math.PI / 180);
      var len = o.len[0] + H.rnd() * (o.len[1] - o.len[0]);
      if (sn < 0) len = Math.max(60, Math.min(len, (floorY - (o.y || 0)) / (sn * 1.15) - r0));
      var w = len * H.aspect(name) * (o.wf || 1) * (0.75 + H.rnd() * 0.4), fl = H.rnd() < 0.5 ? -1 : 1;
      var pv = H.node(br, 'B' + i); pv.localEulerAngles = H.V3(0, 0, a);
      var dk = null, rim = null, spec = null;
      if (o.dark) { dk = H.img(pv, 'K', len * 1.02, w * 1.1, name, o.dark, 0); dk.transform.pivot = H.V2(0, 0.5); dk.transform.localScale = H.S3(1, fl); }
      var rw = o.rimW == null ? null : o.rimW;
      if (o.rim) { rim = H.img(pv, 'R', rw == null ? len * 1.04 + 10 : len + rw * 2, rw == null ? w * 1.18 + 6 : w + rw, name, o.rim, 0); rim.transform.pivot = H.V2(0, 0.5); rim.transform.localScale = H.S3(1, fl); }
      var im = H.img(pv, 'I', len, w, name, o.col, 0); im.transform.pivot = H.V2(0, 0.5); im.transform.localScale = H.S3(1, fl);
      // the light facet: the same piece at half its width on one side, so a hard line runs down the blade (A, final review M1)
      var lt = null; if (o.light) { lt = H.img(pv, 'Lt', len * 0.97, w * 0.46, name, o.light, 0); lt.transform.pivot = H.V2(0, 0.5); lt.transform.localScale = H.S3(1, fl); }
      if (i % 3 === 0) { spec = H.img(pv, 'Sp', len * 0.7, 2.5, null, o.spec || [1, 1, 1], 0); spec.transform.pivot = H.V2(0, 0.5); }
      hp.blades.push({ pv: pv, im: im, rim: rim, dk: dk, spec: spec, lt: lt, a: a, r0: r0, len: len, w: w, fl: fl, ph: H.rnd() * 6.28, d: H.rnd() * 4, back: i % 3 === 2 });
    }
    // lightning crawling between blade tips: one band of a six-bolt sheet each, re-rolled every few frames
    var ar = H.node(r, 'Arcs');
    for (var q = 0; q < (o.arcs || 0); q++) hp.arcs.push({ ri: H.raw(ar, 'A' + q, 10, 46, o.arcSheet || 'fx:03_lightning/lightning_705_4r', o.arcCol, 0), next: 0, on: 0 });
    hp.burstAt = -999;
    return hp;
  };
  // k: open (0..1), bF: frames since the last burst (open or mode change), t: time; al: the heart's overall alpha
  H.heartTick = function (hp, k, bF, t, al, sh) {
    var o = hp.o, e = bF < 7 ? H.back(bF / 7) : 1 + 0.05 * H.cl((bF - 7) / 50), fl = bF < 3 ? 1 - bF / 3 : 0;
    // a mode change never takes the ring away (review r3: it read as a cut): the blades pull in to 0.6 over 3 f, throw out
    // to 1.15 over 5 f and settle by f16; the flash lives on the light
    var sg = bF < 3 ? 1 - 0.4 * H.easeIn(bF / 3) : bF < 8 ? 0.6 + 0.55 * H.ease((bF - 3) / 5) : 1.15 - 0.15 * H.inout((bF - 8) / 8);
    hp.bl.localEulerAngles = H.V3(0, 0, t * (o.spin || 0.05));
    for (var b of hp.blades) {
      var bk = H.cl((bF - b.d) / 7), wob = 1 + 0.035 * Math.sin(t / 37 + b.ph), g, rad, a;
      if (sh) { g = sg * wob; rad = b.r0 * (0.8 + 0.2 * sg); a = al * k * (b.back ? 0.6 : 1); }
      else { g = (bF - b.d < 7 ? 0.2 + 0.8 * H.back(bk) : e) * wob; rad = b.r0 * (0.55 + 0.45 * H.ease((bF - b.d) / 9)); a = al * k * (b.back ? 0.6 : 1) * H.cl((bF - b.d + 1) / 2); }
      var sy = b.fl * (0.8 + 0.2 * g);
      b.im.transform.localPosition = H.V3(rad, 0); b.im.transform.localScale = H.S3(g, sy);
      b.im.color = H.C(fl > 0 && !sh ? H.mix(o.col, [1, 1, 1], fl) : o.col, (o.al || 1) * a);
      if (b.dk) { b.dk.transform.localPosition = H.V3(rad + 4, -8 * b.fl); b.dk.transform.localScale = H.S3(g, sy); b.dk.color = H.C(o.dark, 0.95 * a); }
      if (b.lt) { b.lt.transform.localPosition = H.V3(rad + 2, b.w * 0.25 * b.fl * (0.8 + 0.2 * g)); b.lt.transform.localScale = H.S3(g, sy); b.lt.color = H.C(fl > 0 && !sh ? [1, 1, 1] : o.light, (o.al || 1) * a); }
      if (b.rim) { b.rim.transform.localPosition = H.V3(o.rimW == null ? rad - 6 : rad - o.rimW, 0); b.rim.transform.localScale = H.S3(g, sy); b.rim.color = H.C(o.rim, (o.rimAl || 0.55) * (1 + 0.45 * fl) * a); }
      if (b.spec) { b.spec.transform.localPosition = H.V3(rad + b.len * 0.12 * g, b.w * 0.08 * b.fl); b.spec.transform.localScale = H.S3(g, 1);
        b.spec.color = H.C(o.spec || [1, 1, 1], (0.55 + 0.35 * Math.sin(t / 23 + b.ph)) * a); }
    }
    // the light: a slow breath, a flash on each burst that fades over 8 f; the disc stays under r 400 and 30% (review r3:
    // it washed over the panels), and the white core burns round the total's plate
    var lb = 0.85 + 0.15 * Math.sin(t / 45), lf = bF < 8 ? 1 - H.ease(bF / 8) : 0;
    hp.glow.color = H.C(o.glow, Math.min(0.3, (o.glowAl || 0.3) * (lb + 0.6 * lf)) * k * al);
    hp.glow.transform.localScale = H.S3(1 + 0.12 * lf, 1 + 0.12 * lf);
    hp.core.color = H.C([1, 1, 1], (o.coreAl || 0.9) * k * al * (0.9 + 0.1 * lb)); hp.core.transform.localScale = H.S3(1 + 0.15 * lf, 1 + 0.15 * lf);
    var lk = H.cl(bF / 26); hp.lines.transform.localScale = H.S3(0.5 + 1.3 * H.ease(lk), 0.5 + 1.3 * H.ease(lk));
    hp.lines.transform.localEulerAngles = H.V3(0, 0, t * 0.2);
    hp.lines.color = H.C(o.glow, al * k * (bF < 26 ? 0.9 * (1 - H.easeIn(lk)) : 0.18 * lb));
    hp.streak.color = H.C(o.glow, al * k * (0.45 * lb + 0.5 * fl)); hp.streak.transform.localScale = H.S3(0.6 + 0.4 * H.ease(bF / 12), 1);
    // lightning: each arc joins two neighbouring blade tips for a few frames, then jumps
    var ft = Math.floor(t), n = hp.blades.length;
    for (var q = 0; q < hp.arcs.length; q++) {
      var A = hp.arcs[q];
      if (ft >= A.next) {
        A.next = ft + 2 + Math.floor(Math.random() * 4); A.on = Math.random() < (bF < 30 ? 0.95 : 0.6);
        var i = Math.floor(Math.random() * n), j = (i + 1 + Math.floor(Math.random() * 2)) % n, B1 = hp.blades[i], B2 = hp.blades[j];
        var spin = (o.spin || 0.05) * t, f1 = 0.55 + Math.random() * 0.4, f2 = 0.55 + Math.random() * 0.4;
        var a1 = (B1.a + spin) * Math.PI / 180, a2 = (B2.a + spin) * Math.PI / 180, d1 = Math.min(o.arcMax || 660, B1.r0 + B1.len * f1), d2 = Math.min(o.arcMax || 660, B2.r0 + B2.len * f2);
        var x1 = Math.cos(a1) * d1, y1 = Math.sin(a1) * d1, x2 = Math.cos(a2) * d2, y2 = Math.sin(a2) * d2;
        if (Math.min(y1, y2) + (o.y || 0) < (o.floorY == null ? -580 : o.floorY) || Math.max(y1, y2) + (o.y || 0) > 560) A.on = false;   // never over the footer or the header
        var tr = A.ri.transform; tr.localPosition = H.V3((x1 + x2) / 2, (y1 + y2) / 2);
        tr.sizeDelta = H.V2(Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) * 1.1, 34 + Math.random() * 30);
        tr.localEulerAngles = H.V3(0, 0, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
        var row = Math.floor(Math.random() * 6); A.ri.uvRect = new UE.Rect(Math.random() < 0.5 ? 0 : 1, row / 6, Math.random() < 0.5 ? 1 : -1, 1 / 6);
      }
      A.ri.color = H.C(Math.random() < 0.3 ? [1, 1, 1] : o.arcCol, A.on ? al * k * (0.65 + Math.random() * 0.35) : 0);
    }
  };

  // ---- the Y2K HUD (images 05, 10): hairline grid, small labels with live numbers, circle pips, glass plates, a thin circle ----
  // o: col, step (grid), gridAl, labels [{x, y, s, al, fn(d, t) or text, align}], pips {x, y, gap, size}, rects [[x, y, w, h, al]], circles [[x, y, r, al]]
  H.hud = function (parent, o) {
    var hu = { o: o, root: H.node(parent, o.name || 'Hud', o.idx), v: [], h: [], labels: [], rects: [], circles: [], pips: [] };
    var r = hu.root, st = o.step || 160;
    if (o.gridAl) {
      for (var x = -1280 + st / 2; x < 1280; x += st) { var vl = H.img(r, 'V', 1.5, 1440, null, o.col, 0); vl.transform.localPosition = H.V3(x, 0); hu.v.push(vl); }
      for (var y = -720 + st / 2; y < 720; y += st) { var hl = H.img(r, 'H', 2560, 1.5, null, o.col, 0); hl.transform.localPosition = H.V3(0, y); hu.h.push(hl); }
    }
    for (var R of (o.rects || [])) { var im = H.img(r, 'Rect', R[2], R[3], null, [1, 1, 1], 0); im.transform.localPosition = H.V3(R[0], R[1]); hu.rects.push({ im: im, al: R[4] }); }
    for (var C of (o.circles || [])) { var ci = H.img(r, 'Circ', C[2] * 2, C[2] * 2, 'fx:11_ring/ring_006_44c', o.col, 0); ci.transform.localPosition = H.V3(C[0], C[1]); hu.circles.push({ im: ci, al: C[3] }); }
    if (o.pips) { var P = o.pips;
      for (var i = 0; i < 8; i++) { var px = P.x + (i % 4) * P.gap, py = P.y - Math.floor(i / 4) * P.gap;
        var fill = H.img(r, 'PipF', P.size, P.size, 'fx:02_glow/glow_205_4c', o.col, 0), ring = H.img(r, 'PipR', P.size * 1.18, P.size * 1.18, 'fx:02_glow/glow_401_4c', o.col, 0);
        fill.transform.localPosition = ring.transform.localPosition = H.V3(px, py); hu.pips.push({ f: fill, r: ring }); } }
    for (var Lb of (o.labels || [])) { var tm = H.txt(r, 'Lbl', Lb.s || 15, 600, 120, Lb.align || 257, Lb.font || 'Aldrich-Desc-SDF'); tm.transform.localPosition = H.V3(Lb.x, Lb.y); hu.labels.push({ tm: tm, L: Lb }); }
    return hu;
  };
  H.hudTick = function (hu, oF, t, d, al) {
    var o = hu.o, gk = H.ease((oF - 3) / 16);
    for (var i = 0; i < hu.v.length; i++) { var vv = hu.v[i]; vv.transform.localScale = H.S3(1, H.ease((oF - 2 - i * 0.5) / 14)); vv.color = H.C(o.col, o.gridAl * al); }
    for (var j = 0; j < hu.h.length; j++) { var hh = hu.h[j]; hh.transform.localScale = H.S3(H.ease((oF - 2 - j * 0.7) / 14), 1); hh.color = H.C(o.col, o.gridAl * al); }
    for (var k = 0; k < hu.rects.length; k++) { var Rc = hu.rects[k], rk = H.ease((oF - 8 - k * 2) / 10); Rc.im.transform.localScale = H.S3(rk, 1); Rc.im.color = H.C(o.rectCol || [1, 1, 1], Rc.al * al); }
    for (var c = 0; c < hu.circles.length; c++) { var Ci = hu.circles[c], ck = H.ease((oF - 6 - c * 3) / 14); Ci.im.transform.localScale = H.S3(0.6 + 0.4 * ck, 0.6 + 0.4 * ck); Ci.im.transform.localEulerAngles = H.V3(0, 0, t * 0.15 * (c % 2 ? -1 : 1)); Ci.im.color = H.C(o.col, Ci.al * ck * al); }
    var sel = d.sel, lv = sel ? sel.lv : 0, mx = sel ? sel.max : 0;
    for (var p = 0; p < hu.pips.length; p++) { var Pp = hu.pips[p], pk = H.back((oF - 10 - p) / 6), has = p < mx, on = p < lv;
      Pp.f.transform.localScale = Pp.r.transform.localScale = H.S3(pk, pk);
      Pp.f.color = H.C(o.pipCol || o.col, on ? al : 0); Pp.r.color = H.C(o.col, (has ? 0.9 : 0.22) * al); }
    for (var l = 0; l < hu.labels.length; l++) { var Lb = hu.labels[l], L = Lb.L;
      Lb.tm.text = L.fn ? L.fn(d, t) : L.text; Lb.tm.color = H.C(L.col || o.col, (L.al || 0.8) * al);
      Lb.tm.maxVisibleCharacters = Math.floor(H.cl((oF - 8 - l * 1.5) / 18) * 90); }
  };
  // a long blade laid across the screen (05's black diagonal): it slides in along its own axis on the open
  H.slab = function (parent, name, sprite, x, y, len, w, ang, col) {
    var t = H.node(parent, name); t.localPosition = H.V3(x, y); t.localEulerAngles = H.V3(0, 0, ang);
    var im = H.img(t, 'I', len, w, sprite, col, 0); return { t: t, im: im, x: x, y: y, ang: ang, col: col };
  };
  H.slabTick = function (s, k, al) {
    var e = H.ease(k); s.im.transform.localPosition = H.V3(-(1 - e) * 1400, 0);
    s.im.color = H.C(s.col, al * H.cl(k * 3));
  };
  // a stable pseudo-random reading that ticks over (10's "73.97165")
  H.readout = function (seed, t, every, digits) { var n = Math.floor(t / (every || 6)); var x = Math.sin(seed * 91.7 + n * 12.9898) * 43758.5453; x -= Math.floor(x); return (x * Math.pow(10, digits || 2)).toFixed(5 - (digits || 2) + 2).slice(0, 8); };

  // the selected modifier's numbers, for the read-outs (only what the menu shows)
  H.data = function () {
    var fr = D.fr || {}, rows = fr.rows || [], sel = rows[fr.selIdx] || null, lit = 0;
    for (var r of rows) if (r.lv > 0) lit++;
    return { n: rows.length, lit: lit, sel: sel, selIdx: fr.selIdx || 0, total: D.totShown || 0, mode: fr.mode,
             modeName: ('' + (D.B && D.B.words[Math.round(D.arcPos)] ? D.B.words[Math.round(D.arcPos)].text : '')).toUpperCase() };
  };

  D.MOT = D.MOT || {};
  var base = D.art.base || D.art;   // reloading this file wraps the art layer once, not twice
  D.art = function (w, B) {
    base(w, B);
    var T = D.THEMES[D.theme], X = D.MOT[D.theme];
    // the turn tick takes the direction's hue (it was the block-out's gold in every direction, review r1)
    var tc = B.fxTick.color; B.fxTick.color = H.C(T.ink, tc.a);
    // a direction with no motif file, or a new build: the last direction's parts go, and the dial's scale comes back (B shrinks it)
    if (!X) { if (M.theme) { teardown(); B.dial.localScale = H.S3(1, 1); } return; }
    if (M.B !== B || M.art !== D.artA || M.theme !== D.theme || M.ver !== X.ver) {
      teardown(); B.dial.localScale = H.S3(1, 1); M.B = B; M.art = D.artA; M.theme = D.theme; M.ver = X.ver; M.f = 0;
      var rr = B.root.parent.rect; M.W = rr.width; M.H = rr.height;
      try { X.build(B, T, M, H); } catch (e) { D.log.push('motif build EXC ' + e); }
      // shared in every direction (review r3): the total on an opaque dark plate, so the light round it can burn white; a red
      // underline, not a red number, for over the limit; a dark band under the footer prompts
      var R = D.L.R;
      M.cPlate = H.img(B.dial, 'TotPlate', R * 0.78, R * 0.78, 'dial:hex', [0.06, 0.07, 0.086], 0); M.cPlate.transform.localEulerAngles = H.V3(0, 0, 90);
      M.cPlate.transform.SetSiblingIndex(B.total.transform.GetSiblingIndex());
      M.cUl = H.img(B.dial, 'TotUl', 120, 6, null, [1, 0.3, 0.28], 0); M.cUl.transform.localPosition = H.V3(0, -40);
      M.cFoot = H.img(B.root, 'FootPlate', 2560, 88, null, [0.03, 0.03, 0.04], 0); M.cFoot.transform.localPosition = H.V3(0, -676);
    }
    M.f++;
    try { X.tick(B, T, M, H); } catch (e) { if (!M.err) { M.err = 1; D.log.push('motif tick EXC ' + e); } }
    var fo = D.fr ? D.fr.oa : 1, tc2 = B.total.color, over = tc2.r > 0.9 && tc2.g < 0.5;
    M.cPlate.color = H.C([0.06, 0.07, 0.086], 0.95 * fo); M.cFoot.color = H.C([0.03, 0.03, 0.04], 0.7 * fo);
    if (over) { B.total.color = H.C(X.cream || [0.96, 0.91, 0.78], tc2.a); M.cUl.color = H.C([1, 0.3, 0.28], tc2.a); } else M.cUl.color = H.C([1, 0.3, 0.28], 0);
  };
  D.art.base = base;
  D.motifs = 2;
  return 'motif core on, theme ' + D.theme;
})();
  }]);

  // ---- motif_V4.js ----
  layers.push(['motif_V4.js', function () {
// Entropy Dial, direction A (Circuit), round 2. One take per reference image (ENTROPY_DIAL_CARDS.md):
// 02 a dense full-screen glyph rain; 03 and 11 a standing speed tunnel into the dial with bursts; 04 the word spaced wide
// behind the dial; 05 the rank as a column of hexes and a type block; 08 chrome rails and shards on the panels; 09 a
// radial grid round the dial with a pulse; 10 thin rules with text blocks at the screen's thirds; 12 lit panel edges with
// a light running along them. Stock parts only: the Entropy atlas (ImgChaoticArow spikes, ImgChaosLine, BgChaosValueLine,
// ChaoticStageMask, ImgChaoticStageSelect, the graduated BgDChaoModeSwitch ring) and the game's fonts.
// v4 (2026-11-05, "the metal heart"): the lead had ChatGPT realise his metal heart / Matrix vision from these references
// and this direction's build (entropyv4\chatgpt: layout spec, motion spec, the heart's exploded view, the Grim mockup).
// This file is direction A with: the heart drawn in Krita as eight layers (entropyv4\heart: glow, rim light, tubes, inner
// plates, blades, spine, core plate, core glow) in place of the stock blade ring; the core readout inside the heart, cyan,
// red over the limit; the screen frame and top frieze (entropyv4\frame); Matrix green data rain; ChatGPT's motion timings.
(function () {
  var D = globalThis.ED; if (!D || !D.MH) return 'load entropy_dial_motifs.js first';
  var H = D.MH, L = D.L;
  // the layout spec: sockets on a wider ring outside the heart, the perks outside them (ChatGPT layout element 7)
  // the sockets and perks stay where direction A had them, inside and round the ring
  // the motion spec in frames at 60 fps: open 24 (rings peak 12), turn 12, mode change 36, close 18
  D.F.open = 12; D.F.turn = 12; D.F.shift = 36; D.F.close = 18;
  var V4 = 'C:/BBEE_Steam/local_only/redux/ui-study/entropyv4/';
  var PV = D.V4PNG = D.V4PNG || {};
  function png(file) {
    if (PV[file]) return PV[file];
    var path = V4 + file; if (!cs.System.IO.File.Exists(path)) { D.log.push('v4 no ' + file); return D.sp.white; }
    var tx = new cs.UnityEngine.Texture2D(2, 2, cs.UnityEngine.TextureFormat.RGBA32, true); tx.wrapMode = 1;
    cs.UnityEngine.ImageConversion.LoadImage(tx, cs.System.IO.File.ReadAllBytes(path), false);
    return PV[file] = cs.UnityEngine.Sprite.Create(tx, new cs.UnityEngine.Rect(0, 0, tx.width, tx.height), H.V2(0.5, 0.5), 100);
  }
  function pimg(parent, name, file, w, h, py) {
    var im = H.img(parent, name, w, h, null, [1, 1, 1], 0); im.sprite = png(file);
    im.transform.pivot = H.V2(0.5, py); im.transform.localPosition = H.V3(0, 0); return im;
  }
  var CYAN = [0.137, 0.84, 1], ICE = [0.55, 0.94, 1], GLOWC = [0, 0.96, 1], RED = [1, 0.38, 0.29], GREEN = [0, 0.9, 0.46];
  // the core point in the heart's documents (500, 520 of 1000 x 1100; the tubes' document is 500 taller)
  var PY = (1100 - 520) / 1100, PYT = (1600 - 1020) / 1600, HW = 1000, HH = 1100;
  // final review m5: Aldrich has no kana (they drew as nothing, so the rain never showed): digits, capitals and signs only
  var GLY = '0123456789' + '0123456789' + 'ABCDEFHKMNRTXZ' + '<>=+*#/:';
  // where the rain stays faint: the dial, the two panels, the mode arc and the prompts (review r1: rain read through them)
  function sstep(a, b, x) { var k = H.cl((x - a) / (b - a)); return k * k * (3 - 2 * k); }
  function mask(x, y) {
    var r = Math.sqrt(x * x + (y - L.cy) * (y - L.cy)), m = 0.06 + 0.94 * sstep(L.R * 1.05, L.R * 1.45, r);
    if (x > L.plaqueX - 380 && x < L.plaqueX + 380 && y > L.plaqueY - 260 && y < L.plaqueY + 330) m = Math.min(m, 0.1);
    if (x > L.rightX - 330 && x < L.rightX + 330 && y > -420 && y < 320) m = Math.min(m, 0.1);
    if (y > 470 && y < 660 && Math.abs(x) < 1130) m = Math.min(m, 0.3);
    if (y < -585) m = Math.min(m, 0.25);
    return m;
  }

  function build(B, T, M, H) {
    var root = B.root, R = L.R;
    H.seed(1201);
    var bg = M.bg = H.node(root, 'ABack', 1);
    // the ground: near-black teal over the stock slate (review r2: no dark mass, no light source)
    M.base = H.img(bg, 'Base', 2700, 1560, null, [0.025, 0.05, 0.075], 0);
    // 09: a wide teal band of motion streaks through the dial's height, and the HUD (05, 10) on the ground
    M.band = H.img(bg, 'Band', 2700, 330, 'fx:21_ray/ray_715_w_4r', T.col, 0); M.band.transform.localPosition = H.V3(0, L.cy);
    M.band2 = H.img(bg, 'Band2', 2700, 90, 'fx:21_ray/ray_715_w_4r', T.ink, 0); M.band2.transform.localPosition = H.V3(0, L.cy - 20); M.band2.transform.localScale = H.S3(-1, 1);
    M.hud = H.hud(bg, { col: T.col, step: 160, gridAl: 0.055,
      circles: [[0, L.cy, R * 2.05, 0.35], [0, L.cy, R * 2.6, 0.16]],
      rects: [[-760, -560, 300, 26, 0.10], [-640, -600, 120, 12, 0.22], [760, 600, 260, 22, 0.10]],
      labels: [
        { x: -960, y: -430, s: 15, fn: function (d, t) { return 'METALHEART ' + H.readout(3, t, 7, 2) + '\nCORE LOAD ' + H.readout(5, t, 11, 1) + '%'; } },
        { x: R * 1.3, y: L.cy + R * 1.1, s: 14, al: 0.9, fn: function (d, t) { return 'r ' + H.readout(9, t, 5, 2) + '\nANG ' + Math.floor((t * 0.04) % 360); } },
        { x: -R * 1.3 - 520, y: L.cy - R * 1.15, s: 14, al: 0.9, align: 260, fn: function (d) { return 'ENTROPY ' + d.total + '\n' + d.lit + ' / ' + d.n + ' LIVE'; } }] });
    M.heart = null;   // made after the rain and the tunnel, so the chrome sits over them
    // 09: the radial grid, two big graduated rings and 24 spokes, and the pulse ring
    M.grid = H.node(bg, 'AGrid'); M.grid.localPosition = H.V3(0, L.cy);
    M.gRing = [H.img(M.grid, 'GR0', R * 3.7, R * 3.7, 'tex:BgDChaoModeSwitch', T.col, 0), H.img(M.grid, 'GR1', R * 5.2, R * 5.2, 'tex:BgDChaoModeSwitch', T.col, 0)];
    M.spokes = [];
    for (var s = 0; s < 24; s++) {
      var pv = H.node(M.grid, 'Sp' + s); pv.localEulerAngles = H.V3(0, 0, s * 15);
      var li = H.img(pv, 'L', 3, 1500, null, T.col, 0); li.transform.pivot = H.V2(0.5, 0); li.transform.localPosition = H.V3(0, R * 1.32);
      li.transform.localEulerAngles = H.V3(0, 0, 0); M.spokes.push(li);
    }
    M.pulse = H.img(M.grid, 'Pulse', R * 2, R * 2, 'tex:BgDChaoModeSwitch', T.ink, 0); M.pulseAt = -999;
    // 02: the rain, one text per column; its line height measured once
    M.rain = []; var rn = H.node(bg, 'ARain');
    var probe = H.txt(rn, 'Probe', 24, 40, 400, 258, 'Aldrich-Desc-SDF'); probe.text = 'A\nA\nA\nA\nA\nA\nA\nA\nA\nA';
    M.lh = Math.max(20, probe.preferredHeight / 10 || 29); probe.gameObject.SetActive(false);
    M.rows = Math.ceil(1440 / M.lh) + 1;
    for (var i = 0; i < 62; i++) {
      var x = -1265 + i * 41.5, tm = H.txt(rn, 'Col' + i, 24, 44, M.rows * M.lh + 40, 258, 'Aldrich-Desc-SDF');
      tm.transform.pivot = H.V2(0.5, 1); tm.transform.localPosition = H.V3(x, 720);
      var col = { tm: tm, x: x, g: [], head: -Math.floor(H.rnd() * M.rows * 1.2), len: 9 + Math.floor(H.rnd() * 22), per: 2 + Math.floor(H.rnd() * 4), next: 0, m: [] };
      for (var r = 0; r < M.rows; r++) { col.g.push(GLY[Math.floor(H.rnd() * GLY.length)]); col.m.push(mask(x, 720 - M.lh * (r + 0.5))); }
      M.rain.push(col);
    }
    // 03 / 11: the speed tunnel, tapered spikes on rays into the dial
    M.tun = []; var tn = H.node(bg, 'ATunnel'); tn.localPosition = H.V3(0, L.cy);
    for (var q = 0; q < 46; q++) {
      var a = (q / 46) * 360 + (H.rnd() - 0.5) * 6, pv2 = H.node(tn, 'Ray' + q); pv2.localEulerAngles = H.V3(0, 0, a);
      var sk = H.img(pv2, 'S', 7 + H.rnd() * 9, 1, 'ImgChaoticArow', T.col, 0);
      M.tun.push({ im: sk, len: 180 + H.rnd() * 420, life: 46 + H.rnd() * 40, ph: H.rnd(), w: 7 + H.rnd() * 9, wh: H.rnd() < 0.25 });
    }
    // v4 (the lead, 2026-11-05): "dont make it a literal metal heart, styled like the ring was before": direction A's
    // ring of chrome blades round the core is back; the heart's Krita and Blender layers are retired (entropyv4/heart, blender)
    // 04, 05, 09, 11: the metal heart, the game's chrome blades bursting out of a cyan light, lightning between their tips
    // v4 (the lead, 2026-11-05): "I don't want literal chrome blades. I want the lighting of metal heart": no metal
    // objects at all; the dial's own shapes are lit like polished metal (EntropyDial/MetalLight) and light effects
    // play over them (EntropyDial/LightFx), both from the entropydial bundle (uikit/Assets/EntropyDial)
    M.heart = null;
    // the screen frame and top frieze (layout element 3), over the ground and under the panels
    M.frame = H.img(bg, 'V4Frame', 2560, 1440, null, CYAN, 0); M.frame.sprite = png('frame/frame_game.png');
    M.frame.transform.localPosition = H.V3(0, 0);
    // 04: ENTROPY spaced wide and stretched behind the dial, an outline word as on the ELEMENTAL poster
    M.word = H.txt(bg, 'AWord', 300, 3000, 360, 514, 'Oswald-Bold-SDF'); M.word.text = 'ENTROPY'; M.word.transform.localPosition = H.V3(0, L.cy + 10);
    // (TMP's outline setters crash the game on these cloned labels, 2026-10-24: the word stays a solid, faint face)
    M.word.transform.localScale = H.S3(1.45, 0.82);
    // 08: two big chrome shards from the corners, rising from the bottom left and falling from the top right
    // review r3: the bottom-left one is a hard piece at 35 degrees kept under the CORE LOAD readout; the top-right one
    // stays above the rank column's label (y 262)
    // v4: no chrome slabs (the heart and its blades carry the chrome; ChatGPT's mockup has none)
    M.slabs = [];
    // 10: thin rules at the screen's thirds, with small text blocks (v4: the top one gave way to the frieze)
    M.rules = [];
    var RL = [[0, -470, 2470, 0], [-1236, 100, 1100, 90], [1236, 100, 1100, 90]];
    for (var k = 0; k < RL.length; k++) { var ru = H.img(bg, 'Rule' + k, RL[k][2], 2, null, T.col, 0); ru.transform.localPosition = H.V3(RL[k][0], RL[k][1]); ru.transform.localEulerAngles = H.V3(0, 0, RL[k][3]); M.rules.push(ru); }
    M.capL = H.txt(bg, 'CapL', 17, 700, 80, 257, 'Aldrich-Desc-SDF'); M.capL.transform.localPosition = H.V3(-840, 640);   // inside the frame's corner
    M.capR = H.txt(bg, 'CapR', 17, 700, 80, 260, 'Aldrich-Desc-SDF'); M.capR.transform.localPosition = H.V3(880, -500);

    // front: 08 rails and shards, 12 the lit edges and their runner, on the panels so they move with them
    M.edges = [];
    function frame(parent, x0, y0, x1, y1, side) {
      var e = { parent: parent, x0: x0, y0: y0, x1: x1, y1: y1, lines: [], run: [] };
      var segs = [[x0, y1, x1, y1], [x1, y1, x1, y0], [x1, y0, x0, y0], [x0, y0, x0, y1]];
      for (var j = 0; j < 4; j++) {
        var sg = segs[j], len = Math.abs(sg[2] - sg[0]) + Math.abs(sg[3] - sg[1]), horiz = sg[1] === sg[3];
        var ln = H.img(parent, 'Edge' + j, horiz ? len : 3, horiz ? 3 : len, 'ImgChaosSelect_White', T.col, 0);
        ln.transform.localPosition = H.V3((sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2); e.lines.push(ln);
      }
      // the runner: a bright head and two fading copies behind it
      for (var h = 0; h < 3; h++) e.run.push(H.img(parent, 'Run' + h, 70 - h * 18, 7 - h, 'ImgChaosSelect_White', T.ink, 0));
      // the chrome rail on the outer edge: the stock tech rail, stretched, and a fan of three shards at its top
      var rx = side < 0 ? x0 - 26 : x1 + 26, noRail = side > 0;   // final review m1: the right rail sat behind the rank hexes
      e.rail = H.img(parent, 'Rail', 30, (y1 - y0) * 0.92, 'BgChaosValueLine', T.ink, 0); e.rail.transform.localPosition = H.V3(rx, (y0 + y1) / 2);
      if (side > 0) e.rail.transform.localScale = H.S3(-1, 1);
      e.shards = [];
      for (var f = 0; f < 3; f++) {
        var sh = H.img(parent, 'Shard' + f, 12 - f * 2, 150 - f * 34, 'ImgChaoticArow', T.ink, 0);
        sh.transform.localPosition = H.V3(rx + side * f * 14, y1 + 40 - f * 6); sh.transform.localEulerAngles = H.V3(0, 0, -side * (18 + f * 16)); e.shards.push(sh);
      }
      e.noRail = noRail; e.per = 2 * ((x1 - x0) + (y1 - y0)); M.edges.push(e);
    }
    frame(B.plaque, -352, -250, 352, 268, -1);
    frame(B.right, -302, -406, 302, 302, 1);
    // 05: the selected modifier's ranks as a column of hexes at the right edge, a type block under the right column
    var fr = M.front = H.node(root, 'AFront');
    M.hexes = [];
    for (var hx = 0; hx < 6; hx++) {
      var hn = H.node(fr, 'Hex' + hx); hn.localPosition = H.V3(1212, 210 - hx * 54);
      M.hexes.push({ t: hn, fill: H.img(hn, 'F', 26, 30, 'ChaoticStageMask', T.col, 0), rim: H.img(hn, 'R', 36, 40, 'ImgChaoticStageSelect', T.col, 0) });
    }
    M.hexLbl = H.txt(fr, 'HexLbl', 16, 120, 30, 514, 'Aldrich-Desc-SDF'); M.hexLbl.transform.localPosition = H.V3(1212, 262);
    M.lastLv = null; M.lastSel = null; M.burstAt = -999;
  }

  function tick(B, T, M, H) {
    var fr = D.fr, t = D.t, oF = fr.oF, shF = fr.shF, R = L.R, d = H.data();
    var oA = H.ease((oF - 2) / 14);
    // a burst plays on the open and on each mode change (03, 11)
    var bF = shF != null ? shF : oF, bk = bF < 22 ? bF / 22 : 1;
    // the grid grows with the dial; the pulse runs out every 150 f and on a mode change
    var gs = fr.os; M.grid.localScale = H.S3(gs, gs);
    // the ground, the band, the HUD, the heart, the corner shards
    // final review M3: the ground eases in over 14 f from f2 (it landed in 3 frames with the dial's own fast alpha)
    M.base.color = H.C([0.025, 0.05, 0.075], 0.94 * H.inout((oF - 2) / 14));
    M.band.color = H.C(T.col, 0.32 * oA); M.band.transform.localPosition = H.V3(Math.sin(t / 70) * 70, L.cy);
    M.band2.color = H.C(T.ink, 0.4 * oA); M.band2.transform.localPosition = H.V3(-Math.sin(t / 50) * 60, L.cy - 20);
    H.hudTick(M.hud, oF, t, d, fr.oa);
    M.frame.color = H.C(CYAN, (0.55 + 0.2 * (shF != null && shF < 36 ? H.bell(shF / 36) : 0)) * H.ease(oF / 12));
    for (var si = 0; si < M.slabs.length; si++) H.slabTick(M.slabs[si], (oF - 4 - si * 3) / 16, 0.85 * fr.oa);
    // the mode word takes the direction's hue (review r2: it showed the mode's orange)
    var cw = B.words[Math.round(D.arcPos)]; if (cw) cw.color = H.C(T.ink, cw.color.a);
    M.gRing[0].transform.localEulerAngles = H.V3(0, 0, t / 20); M.gRing[1].transform.localEulerAngles = H.V3(0, 0, -t / 34);
    M.gRing[0].color = H.C(T.col, 0.22 * oA); M.gRing[1].color = H.C(T.col, 0.12 * oA);
    for (var s = 0; s < 24; s++) M.spokes[s].color = H.C(T.col, (s % 2 ? 0.07 : 0.14) * H.ease((oF - 4 - s * 0.4) / 10));
    if (shF != null && shF < 1.5) M.pulseAt = t - shF;
    var pF = ((t - M.pulseAt) < 80) ? t - M.pulseAt : (oF > 30 ? (t % 150) : 999), pk = pF / 80;
    M.pulse.transform.localScale = H.S3(1 + 2.6 * H.ease(pk), 1 + 2.6 * H.ease(pk)); M.pulse.color = H.C(mix3(T.ink, T.col, 0.4), pk < 1 ? 0.5 * (1 - pk) * H.cl(pF / 3) : 0);
    // the rain: each column steps its head every few frames and rewrites its trail
    var rA = H.ease((oF - 4) / 20), ft = Math.floor(t);
    for (var i = 0; i < M.rain.length; i++) {
      var c = M.rain[i]; if (c.next - ft > 30) c.next = ft;   // the clock restarts on a reopen (review r2: the rain froze in the recordings)
      if (ft < c.next && M.rainA === rA) continue;
      if (ft >= c.next) { c.head++; c.next = ft + c.per; if (c.head - c.len > M.rows) { c.head = -Math.floor(H.rnd() * 14); c.len = 9 + Math.floor(H.rnd() * 22); } c.g[Math.floor(H.rnd() * M.rows)] = GLY[Math.floor(H.rnd() * GLY.length)]; }
      var out = [];
      for (var r = 0; r < M.rows; r++) {
        var dd = c.head - r;
        if (dd < 0 || dd > c.len) { out.push(' '); continue; }
        var a = Math.min(1, (dd === 0 ? 1 : dd < 3 ? 0.9 : 0.85 * (1 - dd / c.len)) * c.m[r] * rA * 0.55);   // final review round 2: once visible it was too loud
        var cc = dd === 0 ? [0.85, 1, 0.92] : dd < 3 ? [0.4, 1, 0.7] : GREEN;   // v4: Matrix green, the data layers only (palette)
        out.push('<color=' + H.hexc(cc, a) + '>' + c.g[r] + '</color>');
      }
      c.tm.text = out.join('\n');
    }
    M.rainA = rA;
    // the tunnel: spikes run in to the dial and fade; a burst throws them all outward first
    for (var q = 0; q < M.tun.length; q++) {
      var S = M.tun[q], k = ((t / S.life) + S.ph) % 1, rad, len, al;
      // final review 2 N2: the burst grows in over 6 f (it appeared at full size and brightness in one frame)
      if (bk < 1) { var e = H.ease(bk), gk = H.ease(bF / 6); rad = R * 0.9 + 1500 * e; len = S.len * (1.6 - 0.8 * e) * (0.3 + 0.7 * gk); al = (1 - e) * 0.85 * gk; }
      else { rad = R * 1.3 + 1500 * (1 - H.easeIn(k)); len = S.len * (0.5 + 0.5 * (1 - k)); al = 0.42 * H.bell(k) * oA; }
      S.im.transform.localPosition = H.V3(0, rad); S.im.transform.sizeDelta = H.V2(S.w * (bk < 1 ? 1.4 : 1), len);
      if (bF < 0) al = 0;   // final review M3: nothing before the burst starts (a static starburst was held)
      S.im.color = H.C(S.wh || bk < 1 ? T.ink : T.col, al);
    }
    // the word: its spacing closes in on the open, the selected mode's name read wide on the arc
    M.word.characterSpacing = 70 + 90 * (1 - H.ease((oF - 2) / 26)); M.word.color = H.C(T.col, 0);   // final review m5: read as smudges
    for (var w = 0; w < B.words.length; w++) { var Wd = B.words[w], nk = Math.max(0, 1 - Math.abs(w - D.arcPos)); Wd.characterSpacing = 28 * nk; }
    // rules draw in from the centre; text blocks type on
    for (var j = 0; j < M.rules.length; j++) { var rk = H.ease((oF - 6 - j * 2) / 12); M.rules[j].transform.localScale = H.S3(rk, 1); M.rules[j].color = H.C(T.col, 0.32 * rk); }
    var lit = d.lit, sel = d.sel;
    M.capL.text = 'ENTROPY DIAL  //  ' + (D.preview ? 'PREVIEW ' : '') + d.modeName + '\n' + lit + ' OF ' + d.n + ' MODIFIERS RANKED';
    M.capR.text = (sel ? ('MOD ' + pad(d.selIdx + 1) + ' / ' + pad(d.n) + '    RANK ' + sel.lv + ' / ' + sel.max) : '') + '\nTOTAL ' + d.total + (D.B.limit.text ? '    ' + D.B.limit.text.toUpperCase() : '');
    var ty = Math.floor(H.cl((oF - 10) / 24) * 80);
    M.capL.maxVisibleCharacters = ty; M.capR.maxVisibleCharacters = ty; M.capL.color = H.C(T.col, 0.85); M.capR.color = H.C(T.col, 0.85);
    // the limit reads (review r1: grey on grey)
    B.limit.fontSize = 28; B.limit.color = H.C(T.ink, 0.8 * fr.oa);
    // edges, rails, shards, runners
    var eA = H.ease((oF - 8) / 10);
    for (var x = 0; x < M.edges.length; x++) {
      var E = M.edges[x];
      for (var l = 0; l < 4; l++) E.lines[l].color = H.C(T.col, (l === 0 ? 0.9 : 0.45) * eA);
      E.rail.color = H.C(T.ink, E.noRail ? 0 : 0.85 * eA); E.rail.transform.localScale = H.S3(E.rail.transform.localScale.x, H.ease((oF - 8) / 12));
      for (var f = 0; f < 3; f++) { var sk2 = H.back((oF - 12 - f * 2) / 8); E.shards[f].transform.localScale = H.S3(sk2, sk2); E.shards[f].color = H.C(T.ink, E.noRail ? 0 : 0.9 * H.cl((oF - 12 - f * 2) / 3)); }
      var pos = ((t * 9 + x * E.per / 2) % E.per);
      for (var h = 0; h < 3; h++) { var p = perim(E, pos - h * 26); E.run[h].transform.localPosition = H.V3(p[0], p[1]); E.run[h].transform.localEulerAngles = H.V3(0, 0, p[2]); E.run[h].color = H.C(h ? T.col : [1, 1, 1], [0.95, 0.55, 0.25][h] * eA); }
    }
    // the rank column: lit hexes for the ranks taken, rims for the rest; a rank change flashes the new hex
    var rF = fr.rF;
    for (var hx = 0; hx < 6; hx++) {
      var Hx = M.hexes[hx], has = sel && hx < sel.max, on = sel && hx < sel.lv;
      var hk = H.ease((oF - 10 - hx * 1.5) / 8), fl = sel && hx === sel.lv - 1 && rF < 8 ? 1 + 0.4 * (1 - rF / 8) : 1;
      Hx.t.localScale = H.S3(hk * fl, hk * fl);
      Hx.fill.color = H.C(rF < 3 && sel && hx === sel.lv - 1 ? [1, 1, 1] : T.col, has && on ? 0.95 : 0);
      Hx.rim.color = H.C(on ? T.ink : T.col, has ? (on ? 0.9 : 0.5) : 0);
    }
    M.hexLbl.text = 'RANK'; M.hexLbl.color = H.C(T.col, 0.8 * hk);
  }
  // ---- v4: the heart's motion (ChatGPT's motion spec, frames at 60 fps) ----
  function off(o) { try { if (o && o.gameObject.activeSelf) o.gameObject.SetActive(false); } catch (x) {} }
  function bell(k) { return H.bell(k); }
  function heartTick(B, M, fr, t, oF, shF) {
    var Hh = M.h4, A = D.artA || {};
    // what the heart replaces: the stock core plate and frame, the shared total plate, the circuit traces
    off(A.corePlate); off(A.coreFrame); off(A.circL); off(A.circR); off(M.cPlate);
    var idle = 2 * Math.PI * t / 180, br = Math.sin(idle);   // the 3 s idle loop
    // OPEN: the glow f0-14, the core forms by f12 (from f4), plates f4-16, blades f6-18, rim f6-14, tubes and spine grow
    var gA = H.ease(oF / 14), coreK = H.back((oF - 4) / 10), plK = H.back((oF - 4) / 12), blK = H.back((oF - 6) / 12);
    var tuK = H.ease(oF / 18), spK = H.ease((oF - 8) / 10), rimA = H.ease((oF - 6) / 8);
    // TURN (tF): the core breathes out and the rim answers, peak f8 of 12
    var tF = fr.tF, tP = tF < 12 ? bell(tF / 12) : 0;
    // RANK UP (rF): the core surges (f2-16, peak 9), the rim pulses twice, the tubes light (f4-16)
    var rF = fr.rF, rS = rF < 16 ? bell(H.cl((rF - 2) / 14)) : 0, rR = rF < 18 ? Math.abs(Math.sin(Math.PI * H.cl((rF - 4) / 14) * 2)) : 0, rT = rF < 16 ? bell(H.cl((rF - 4) / 12)) : 0;
    // OVER THE LIMIT: the core turns red; crossing the limit flashes it (f0-18) and shakes the heart (f0-20)
    var isOver = fr.over || !!D.v4over;   // D.v4over: a test switch, shows the state without changing any Entropy setting
    if (isOver && !Hh.wasOver) Hh.overAt = t; Hh.wasOver = isOver;
    var oK = t - Hh.overAt, flash = oK < 18 ? 1 - H.ease(oK / 18) : 0, shake = oK < 20 ? 9 * (1 - oK / 20) : 0;
    // MODE CHANGE (shF): the heart pulls in and comes back over 36 f (peak 18), the glow brightens with it
    var mS = shF != null && shF < 36 ? bell(shF / 36) : 0;
    var hs = (1 - 0.06 * mS) * (1 + 0.01 * br * (oF > 24 ? 1 : 0));
    M.hv.localScale = H.S3(hs, hs);
    M.hv.localPosition = H.V3(shake ? shake * Math.sin(t * 2.7) : 0, shake ? shake * 0.5 * Math.cos(t * 3.1) : 0);
    var coreC = isOver ? RED : CYAN;
    // round 2 in game: 0.62 and then 0.4 still filled the heart with teal; the inside stays dark, the light on the cuts
    Hh.glow.color = H.C(GLOWC, Math.min(1, (0.24 + 0.06 * br + 0.3 * mS + 0.3 * rS) * gA));
    Hh.rim0.color = H.C(ICE, 0.35 * rimA);
    Hh.rim.color = H.C(ICE, Math.min(1, (0.8 + 0.12 * br + 0.2 * tP + 0.25 * rR) * rimA));
    // the Blender bloom: the outline's light, breathing, surging on a rank up and a mode change
    Hh.bloom.color = H.C(GLOWC, Math.min(1, (0.45 + 0.1 * br + 0.25 * rR + 0.3 * mS) * rimA));
    // the Blender chrome carries its own colours: drawn untinted (a rank up lifts the tubes toward white light)
    Hh.tubes.transform.localScale = H.S3(1, 0.4 + 0.6 * tuK); Hh.tubes.color = H.C(H.mix([0.9, 0.95, 1], [1, 1, 1], rT), H.cl(oF / 6));
    Hh.spine.transform.localScale = H.S3(1, spK); Hh.spine.color = H.C([1, 1, 1], H.cl((oF - 8) / 4));
    Hh.plates.transform.localScale = H.S3(0.86 + 0.14 * plK, 0.86 + 0.14 * plK); Hh.plates.color = H.C([1, 1, 1], H.cl((oF - 4) / 4));
    var bs = 0.7 + 0.3 * blK + 0.012 * Math.sin(t / 40);
    Hh.blades.transform.localScale = H.S3(bs * (0.6 + 0.4 * blK), bs); Hh.blades.color = H.C([1, 1, 1], H.cl((oF - 6) / 4));
    var cs2 = (0.6 + 0.4 * coreK) * (1 + 0.04 * tP + 0.06 * rS);
    Hh.core.transform.localScale = H.S3(cs2, cs2);
    Hh.core.color = H.C(H.mix(coreC, [1, 1, 1], flash * 0.7), H.cl((oF - 4) / 3));
    // the Blender chrome hex frame over the plate, half tinted to the core's colour
    Hh.cframe.transform.localScale = H.S3(cs2, cs2);
    Hh.cframe.color = H.C(H.mix(H.mix(coreC, [1, 1, 1], 0.5), [1, 1, 1], flash * 0.6), H.cl((oF - 4) / 3));
    Hh.cglow.transform.localScale = H.S3(1 + 0.1 * rS, 1 + 0.1 * rS);
    Hh.cglow.color = H.C(coreC, Math.min(0.95, (0.42 + 0.12 * br + 0.3 * tP + 0.45 * rS + 0.5 * flash + (oF < 16 ? 0.5 * bell(H.cl((oF - 8) / 8)) : 0)) * gA));
    // the frame draws in with the scaffold (f0-12) and holds faint, brightening a little on a mode change
    M.frame.color = H.C(CYAN, (0.55 + 0.2 * mS) * H.ease(oF / 12));
    // the total reads white in the cyan core and stays white in the red one (ChatGPT's mockups)
    var tc = B.total.color; B.total.color = H.C([0.97, 0.99, 1], tc.a);
  }
  function mix3(a, b, k) { return H.mix(a, b, k); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  // a point on a panel's edge, distance s round it clockwise from the top left, with the edge's angle
  function perim(E, s) {
    var w = E.x1 - E.x0, h = E.y1 - E.y0; s = ((s % E.per) + E.per) % E.per;
    if (s < w) return [E.x0 + s, E.y1, 0]; s -= w;
    if (s < h) return [E.x1, E.y1 - s, 90]; s -= h;
    if (s < w) return [E.x1 - s, E.y0, 0]; s -= w;
    return [E.x0, E.y0 + s, 90];
  }
  D.MOT.A = { ver: 'V4.8', build: build, tick: tick, cream: [0.97, 0.99, 1] };
  return 'motif V4 on';
})();
  }]);

  // ---- light_v4.js ----
  layers.push(['light_v4.js', function () {
// Entropy Dial v4: metal-heart lighting (the lead, 2026-11-05: "the lighting of metal heart: the way light plays on metal,
// not actual metal objects or shapes", then "both together"). Loads entropyv4\bundle\entropydial.ab (built by
// uikit/Assets/EntropyDial/Editor/EntropyDialBuild.cs) and:
//  - lights the dial's own shapes as polished metal (EntropyDial/MetalLight): the stock rings, the core plate and frame, the
//    socket plates and rims, the screen frame and frieze, the panels' lit edges, the rank hexes, the mode underline;
//  - plays light over them (EntropyDial/LightFx): an anamorphic streak through the core, star glints, sweeps across the two
//    panels, a bloom behind the core;
//  - drives both from the dial's events (open, turn, rank up, mode change, over the limit).
// Load after motif_V4.js (load_v4.js does). Reloading replaces the old layer.
(function () {
  var D = globalThis.ED; if (!D || !D.art) return 'load the dial first';
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, H = D.MH;
  var BUNDLE = globalThis.ED_BUNDLE_PATH();
  var G = globalThis;
  // the bundle stays loaded for the game session; a rebuilt bundle needs a new name or an Unload first
  // a rebuilt bundle (newer file time) is unloaded and loaded again, so a Unity rebuild hot loads
  var stamp = '' + cs.System.IO.File.GetLastWriteTimeUtc(BUNDLE).Ticks;
  if (G.__EDB_PATH !== BUNDLE || G.__EDB_STAMP !== stamp || !G.__EDB || G.__EDB.Equals(null)) {
    try { if (G.__EDB && !G.__EDB.Equals(null)) G.__EDB.Unload(false); } catch (x) {}
    G.__EDB = UE.AssetBundle.LoadFromFile(BUNDLE, 0, BigInt(globalThis.ED_BUNDLE_OFFSET || 0))   // the offset is a ulong: a plain number arrives as 0 (cold boot, 2026-11-06); G.__EDB_PATH = BUNDLE; G.__EDB_STAMP = stamp;
  }
  if (!G.__EDB || G.__EDB.Equals(null)) return 'bundle failed to load';
  var mats = {}, all = G.__EDB.LoadAllAssets(TY(UE.Material));
  for (var i = 0; i < all.Length; i++) { var m = all.get_Item(i); mats[m.name] = m; }
  if (!mats.ED_MetalLight || !mats.ED_LightFx) return 'materials missing: ' + Object.keys(mats).join(',');

  function inst(base, props) { var m = new UE.Material(base); for (var k in props) m.SetFloat(k, props[k]); return m; }
  function col(m, k, c) { m.SetColor(k, new UE.Color(c[0], c[1], c[2], c.length > 3 ? c[3] : 1)); }
  var L = D.LV4 = { made: [], B: null };

  function build(B) {
    for (var g of L.made) try { UE.Object.Destroy(g); } catch (x) {}
    L.made = []; L.B = B;
    // metal for the big rings and plates: wide bands, a soft bevel
    L.mRing = inst(mats.ED_MetalLight, { _BevelPx: 4, _Bump: 2.4, _BandPx: 520, _Spin: 5, _Flow: 0.04, _Spec: 1.2, _SpecPow: 36, _Rim: 1.0, _Glint: 0.9, _TintMix: 0.35 });
    // metal for thin lines (frame, edges, underline): a tight bevel, strong rim so a 2-3 px line still reads as lit metal
    L.mLine = inst(mats.ED_MetalLight, { _BevelPx: 1.2, _Bump: 3.0, _BandPx: 680, _Spin: 5, _Flow: 0.04, _Spec: 1.6, _SpecPow: 24, _Rim: 1.4, _Glint: 1.3, _TintMix: 0.5 });
    // metal for small parts (socket plates, rims, hexes): a bevel in proportion, quicker bands so each one flickers past
    L.mSmall = inst(mats.ED_MetalLight, { _BevelPx: 2.5, _Bump: 2.8, _BandPx: 300, _Spin: 5, _Flow: 0.06, _Spec: 1.5, _SpecPow: 30, _Rim: 1.2, _Glint: 1.0, _TintMix: 0.45 });
    L.metal = [L.mRing, L.mLine, L.mSmall];
    // the light effects
    function fx(parent, name, w, h, mode, props, c) {
      var im = H.img(parent, name, w, h, null, c || [0.55, 0.95, 1], 0); L.made.push(im.gameObject);
      var m = inst(mats.ED_LightFx, Object.assign({ _Mode: mode }, props || {})); im.material = m; return { im: im, m: m, c: c || [0.55, 0.95, 1] };
    }
    var dial = B.dial;
    // the room behind everything: the Zenith Terminal's room ported to Unity with the metal light on top
    // (EntropyDial/Y2KBackground), right over the dark base plate; the v3 rain, tunnel and band it replaces are hidden
    var Ms = D.MS || {};
    if (mats.ED_Y2KBackground && Ms.base) {
      var bgp = Ms.base.transform.parent;
      L.room = H.img(bgp, 'V4Room', 2560, 1440, null, [1, 1, 1], 1); L.made.push(L.room.gameObject);
      L.room.material = L.roomMat = new UE.Material(mats.ED_Y2KBackground);
      L.room.transform.localPosition = H.V3(0, 0); L.room.transform.SetSiblingIndex(Ms.base.transform.GetSiblingIndex() + 1);
    }
    L.bloom = fx(dial, 'V4Bloom', 900, 900, 3, { _Core: 0.5, _Halo: 0.35 }, [0.2, 0.85, 1]);
    L.bloom.im.transform.SetSiblingIndex(1);
    L.streak = fx(dial, 'V4Streak', 2300, 90, 0, { _Thin: 22, _Core: 1.4, _Halo: 0.3 }, [0.6, 0.95, 1]);
    L.streak2 = fx(dial, 'V4Streak2', 1100, 40, 0, { _Thin: 30, _Core: 1.2, _Halo: 0.2 }, [1, 1, 1]);
    L.stars = [];
    var SP = [[-150, 165, 0, 150], [168, -150, 1.7, 110], [-330, -60, 3.1, 90], [300, 230, 4.4, 120], [40, -330, 5.3, 80]];
    for (var s = 0; s < SP.length; s++) {
      var st = fx(dial, 'V4Star' + s, SP[s][3], SP[s][3], 1, { _Thin: 26, _Core: 1.5, _Halo: 0.4, _Twinkle: 0.6, _Rate: 0.35 + 0.1 * s, _Phase: SP[s][2], _Angle: 12 }, [0.85, 1, 1]);
      st.im.transform.localPosition = H.V3(SP[s][0], SP[s][1]); st.x = SP[s][0]; st.y = SP[s][1]; L.stars.push(st);
    }
    L.sweepL = fx(B.plaque, 'V4SweepL', 760, 560, 2, { _Period: 4.2, _Width: 0.09, _Angle: 25, _Core: 0.35 }, [0.6, 0.95, 1]);
    L.sweepR = fx(B.right, 'V4SweepR', 640, 760, 2, { _Period: 4.2, _Width: 0.09, _Angle: 25, _Core: 0.3, _Phase: 1.4 }, [0.6, 0.95, 1]);
    L.sweepR.im.transform.localPosition = H.V3(0, -50);
    // behind the panels' text: right over each panel's plate
    L.sweepL.im.transform.SetSiblingIndex(B.plate.transform.GetSiblingIndex() + 1); L.sweepR.im.transform.SetSiblingIndex(B.ruBg.transform.GetSiblingIndex() + 1);
    L.selStar = fx(dial, 'V4SelStar', 150, 150, 1, { _Thin: 24, _Core: 2.0, _Halo: 0.5, _Twinkle: 0.3, _Rate: 0.8, _Angle: 0 }, [1, 1, 1]);
    L.assigned = {};
  }
  function metalOn(im, m) {
    try { if (!im || im.Equals(null)) return; if (im.material !== m) im.material = m; } catch (x) {}
  }
  function bell(k) { k = Math.max(0, Math.min(1, k)); return Math.sin(Math.PI * k); }

  var base = D.art.baseV4 || D.art;
  D.art = function (w, B) {
    base(w, B);
    try {
      if (L.B !== B || !L.mRing) build(B);
      var fr = D.fr, t = D.t, oF = fr.oF, shF = fr.shF, A = D.artA || {}, M = D.MS || {};
      UE.Shader.SetGlobalFloat('_FourTimeOffset', UE.Time.unscaledTime - UE.Time.timeSinceLevelLoad);
      // which shapes are lit as metal
      [A.tick, A.plateDisc, A.tick2, A.tick3, A.corePlate, A.coreFrame, A.under].forEach(function (im) { metalOn(im, L.mRing); });
      if (M.frame) metalOn(M.frame, L.mLine);
      (M.edges || []).forEach(function (e) { e.lines.forEach(function (ln) { metalOn(ln, L.mLine); }); });
      (M.rules || []).forEach(function (ln) { metalOn(ln, L.mLine); });
      (M.hexes || []).forEach(function (h) { metalOn(h.fill, L.mSmall); metalOn(h.rim, L.mSmall); });
      (B.socks || []).forEach(function (S) { metalOn(S.plate, L.mSmall); metalOn(S.rim, L.mSmall); });
      (A.perks || []).forEach(function (pk) { metalOn(pk, L.mSmall); });
      // events: open (bands sweep in hot), rank up (a white flare), turn (a glint on the selected socket), mode change (the
      // light swings round), over the limit (the streak runs red)
      var openK = oF < 30 ? 1 - oF / 30 : 0, rF = fr.rF, tF = fr.tF;
      var rank = rF < 18 ? bell(rF / 18) : 0, turn = tF < 14 ? bell(tF / 14) : 0, mode = shF != null && shF < 36 ? bell(shF / 36) : 0;
      var boost = 1 + 0.6 * openK + 0.5 * rank + 0.3 * mode;
      if (L.room) {
        L.room.color = H.C([1, 1, 1], H.ease(oF / 14));
        L.roomMat.SetFloat('_Pulse', Math.min(1, 0.8 * rank + 0.6 * mode + 0.5 * openK));
        // the v3 layers the room replaces
        (M.rain || []).forEach(function (c) { c.tm.alpha = 0; });
        (M.tun || []).forEach(function (q) { q.im.color = H.C([1, 1, 1], 0); });
        if (M.band) { M.band.color = H.C([1, 1, 1], 0); M.band2.color = H.C([1, 1, 1], 0); }
      }
      L.metal.forEach(function (m) { m.SetFloat('_Boost', boost); m.SetFloat('_Angle', 60 + 140 * mode + 90 * openK); });
      var oa = fr.oa, over = fr.over || !!D.v4over;
      var cs2 = over ? [1, 0.45, 0.36] : [0.6, 0.95, 1];
      L.streak.im.color = H.C(cs2, (0.55 + 0.45 * rank + 0.4 * openK + 0.15 * Math.sin(t / 50)) * oa);
      L.streak.im.transform.localScale = H.S3(0.6 + 0.4 * H.ease(oF / 16) + 0.25 * rank, 1);
      L.streak2.im.color = H.C([1, 1, 1], (0.35 + 0.6 * rank) * oa);
      L.bloom.im.color = H.C(over ? [1, 0.35, 0.25] : [0.2, 0.85, 1], (0.45 + 0.08 * Math.sin(t / 45) + 0.4 * rank + 0.3 * mode) * oa);
      for (var s = 0; s < L.stars.length; s++) { var st = L.stars[s]; st.im.color = H.C(st.c, (0.55 + 0.4 * openK) * oa); }
      L.sweepL.im.color = H.C(L.sweepL.c, 0.32 * oa); L.sweepR.im.color = H.C(L.sweepR.c, 0.28 * oa);   // in game at 0.9 they washed over the text
      // the selected socket catches a star on each turn and on a rank up
      var sel = B.socks && B.socks[fr.selIdx];
      if (sel) { L.selStar.im.transform.localPosition = sel.t.localPosition; }
      L.selStar.im.color = H.C([1, 1, 1], Math.min(1, (0.35 + 0.9 * turn + 1.0 * rank)) * oa);
      L.selStar.im.transform.localScale = H.S3(1 + 0.6 * rank, 1 + 0.6 * rank);
    } catch (e) { if (!L.err) { L.err = 1; D.log.push('light EXC ' + e); } }
  };
  D.art.baseV4 = base;
  return 'metal light on: ' + Object.keys(mats).join(', ');
})();
  }]);

  // ---- dial_v4.js ----
  layers.push(['dial_v4.js', function () {
// Entropy Dial v4: the screen of entropyv4\design\DESIGN.md (round 2), built live over the stock Entropy menu.
// The lead, 2026-11-05: "Finish in making this real and using the v4 layout now with real time vfx and effects".
// One language: the Zenith Terminal (dark glass, hairline rules with end ticks, raised rows, hex marks, decode-in text,
// the hex warp) carrying NieR: Automata, Cyberpunk 2077 and Destiny 2 structures; the metal-heart light plays over it.
// The stock menu stays underneath and takes the input; every figure here is read from it or from the game's tables.
// Load after light_v4.js (load_v4.js does). Coordinates are DESIGN.md's: a 2560 x 1440 canvas, top-left origin.
(function () {
  var D = globalThis.ED; if (!D || !D.art || !D.MH) return 'load the dial first';
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, H = D.MH, U = require('Core/Util').U, X = require('Gen/Xlsx').Xlsx;
  var V = D.V4 = D.V4 || {};
  // ---- palette (Terminal Theme.qml) and tempo ----
  var C = {
    bg: [0.0196, 0.0275, 0.0431], panel: [0.039, 0.051, 0.078], raised: [0.133, 0.149, 0.176], line: [0.788, 0.827, 0.878],
    text: [0.914, 0.933, 0.965], dim: [0.553, 0.592, 0.663], faint: [0.478, 0.522, 0.6], cyan: [0.31, 0.863, 0.941],
    amber: [1, 0.714, 0.341], rose: [1, 0.247, 0.424]
  };
  var MODES = [1, 2, 4, 104, 105], SHORT = { 1: 'NORMAL', 2: 'ADVANCED', 4: 'EXTREME', 104: 'GRIM', 105: 'ENDLESS' };
  function cl(k) { return Math.max(0, Math.min(1, k)); }
  function oc(k) { k = cl(k); return 1 - Math.pow(1 - k, 3); }            // OutCubic
  function ic(k) { k = cl(k); return k * k * k; }                         // InCubic
  function col(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? 1 : a); }
  function mix(a, b, k) { k = cl(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // ---- materials and fonts from the bundle (light_v4 loaded it) ----
  function mats() {
    var m = {}; try { var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)); for (var i = 0; i < all.Length; i++) m[all.get_Item(i).name] = all.get_Item(i); } catch (x) {}
    return m;
  }
  function fonts() {
    var f = {}; try {
      var all = globalThis.__EDB.LoadAllAssets(TY(cs.TMPro.TMP_FontAsset));
      for (var i = 0; i < all.Length; i++) { var a = all.get_Item(i); f[a.name] = a; }
    } catch (x) {}
    return f;
  }
  function fontFor(kind) {
    var F = V.fonts || {}, want = { display: /aldrich/i, body: /chakra.*semi|chakra/i, bodyR: /chakra.*reg|chakra/i, data: /share.*mono|mono/i }[kind];
    for (var k in F) if (want && want.test(k)) return F[k];
    return null;
  }

  // ---- builders ----
  function toLocal(x, y, w, h) { return H.V3(x + w / 2 - 1280, 720 - (y + h / 2)); }
  function node(parent, name) { var t = H.node(parent, name); V.made.push(t.gameObject); return t; }
  function rect(parent, name, x, y, w, h, c, a) {
    var im = H.img(parent, name, w, h, null, c || C.panel, a == null ? 1 : a); im.transform.localPosition = toLocal(x, y, w, h); V.made.push(im.gameObject); return im;
  }
  // a plate: the Plate shader when the bundle has it (chamfers, glass, light levels), else a plain glass rect
  function plate(parent, name, x, y, w, h, o) {
    o = o || {};
    var im = rect(parent, name, x, y, w, h, o.fill || C.panel, o.alpha == null ? 0.62 : o.alpha);
    if (V.mats.ED_Plate) {
      var m = new UE.Material(V.mats.ED_Plate); im.material = m; im.color = col([1, 1, 1], 1);
      m.SetVector('_Size', new UE.Vector4(w, h, 0, 0));
      var cut = o.cut || [0, 0, 0, 0]; m.SetVector('_Cut', new UE.Vector4(cut[0], cut[1], cut[2], cut[3]));
      m.SetColor('_Fill', col(o.fill || C.panel, o.alpha == null ? 0.62 : o.alpha));
      m.SetColor('_Line', col(o.line || C.line, o.lineA == null ? 0.5 : o.lineA)); m.SetFloat('_LineW', o.lineW == null ? 2 : o.lineW);
      if (o.bracket) { m.SetFloat('_Bracket', 1); m.SetFloat('_BracketLen', o.bracket); m.SetColor('_BracketColor', col(o.bracketC || C.line, 0.8)); }
      if (o.raised) m.SetFloat('_Raised', 1);
      if (o.hex) m.SetFloat('_Hex', 1);
      if (o.dash) m.SetFloat('_Dash', 1);
      m.SetFloat('_Lit', o.lit || 0);
      im.__m = m;
    } else if (o.lineA !== 0) {
      // fallback outline: four hair rules
      // fallback outline: four hair rules, children of the plate so they move, size and hide with it
      var L = o.line || C.line, la = o.lineA == null ? 0.5 : o.lineA, pt = im.transform;
      im.__ol = [[0, h / 2 - 1, w, 2], [0, -h / 2 + 1, w, 2], [-w / 2 + 1, 0, 2, h], [w / 2 - 1, 0, 2, h]].map(function (q, j) {
        var e = H.img(pt, name + 'O' + j, q[2], q[3], null, L, la); e.transform.localPosition = H.V3(q[0], q[1]); return e;
      });
    }
    return im;
  }
  // round 4: with pop_v4 loaded it owns the light level (_Lit); the extras are written only when they change
  // round 5 (item 2): the chosen slot (112 px) sits in a gap 1.25 steps wide on each side; the others share the rest evenly
  function slotAngle(d, n) {
    n = Math.max(1, n); d = ((d % n) + n) % n; if (d >= n / 2) d -= n;
    var step = 360 / n, half = n / 2, ad = Math.abs(d), near = step * 1.25;
    if (half <= 1) return 90 - d * step;
    var a = ad <= 1 ? ad * near : near + (ad - 1) * (180 - near) / (half - 1);
    return 90 - (d < 0 ? -a : a);
  }
  function setLit(im, lit, extra) {
    if (!im || !im.__m) return; var m = im.__m, c = m.__px || (m.__px = {});
    if (!D.V4P) m.SetFloat('_Lit', lit);
    if (extra) for (var k in extra) if (c[k] !== extra[k]) { c[k] = extra[k]; m.SetFloat(k, extra[k]); }
  }
  function text(parent, name, x, y, w, h, fs, kind, align, c) {
    var tm = H.txt(parent, name, fs, w, h, align || 257); V.made.push(tm.gameObject);
    tm.transform.localPosition = toLocal(x, y, w, h);
    var f = fontFor(kind || 'display'); if (f) { tm.font = f; tm.fontSharedMaterial = f.material; }
    else { var gf = H.font(kind === 'data' || kind === 'display' ? 'Aldrich-Desc-SDF' : 'MiSans-Medium-SDF'); if (gf) { tm.font = gf[0]; tm.fontSharedMaterial = gf[1]; } }
    tm.color = col(c || C.text, 1); tm.enableWordWrapping = false; tm.overflowMode = 0;
    return tm;
  }
  // Terminal Rule: a hair line with 14 px end ticks; NieR's dash ticks and dot triplets along it
  function rule(parent, name, x, y, w, nier) {
    rect(parent, name, x, y, w, 2, C.line, 0.5); rect(parent, name + 'TL', x, y - 6, 2, 14, C.line, 0.7); rect(parent, name + 'TR', x + w - 2, y - 6, 2, 14, C.line, 0.7);
    if (nier) for (var p = x + 60; p < x + w - 60; p += 77.2 * 1.333) {
      rect(parent, name + 'd' + p, p, y + 10, 18, 4, C.line, 0.35);
      for (var q = 0; q < 3; q++) rect(parent, name + 'o' + p + q, p + 30 + q * 9, y - 12, 4, 4, C.line, 0.3);
    }
  }

  // ---- data ----
  var WIN = function () { return globalThis.__ev3w; };
  function modeOf(w) { return D.preview || (w.grimTab ? 104 : w.endlessTab ? 105 : w.CurBattleMode); }   // a preview (the recordings) counts as the mode
  function sanAt(id, l, mode) { try { var e = X.HeatPunishConf.All.find(function (e) { return e.id == id && e.level == l && e.mode == mode; }); return e ? e.san : 0; } catch (x) { return 0; } }
  function perksFor(w) {
    var m = w.CurBattleMode, out = [];
    if (V.perkCache && V.perkCache.m === m) return V.perkCache.out;   // the table does not change while the menu is open
    V.perkCache = { m: m, out: out };
    try { X.HeatEffectConf.All.forEach(function (e) { if (e.mode == m) out.push({ at: e.sanMin, id: e.id, icon: e.iconName, tiers: (e.level && e.level.length) || 1 }); }); } catch (x) {}
    out.sort(function (a, b) { return a.at - b.at; });
    return out;
  }
  function limitOf() { var m = /(\d+)/.exec((D.B && D.B.limit.text) || ''); return m ? +m[1] : 0; }
  function mutations(w) {
    var out = [], l = w.CsObj.transform.Find('BtnController/SafeAreaFitter/Content/ContentMasteAndExpert/ExpertModeContent/ExpertBuffBox/ExpertBuffList');
    for (var i = 0; l && i < l.childCount; i++) {
      var b = l.GetChild(i); if (!b.gameObject.activeSelf) continue;
      var st = function (n) { var t = b.Find(n); return !!(t && t.gameObject.activeSelf); };
      out.push({ open: st('Open'), locked: st('Locked'), closed: st('Close') });
    }
    return out;
  }

  // ---- decode-in text (Terminal DecodeText): shuffled glyphs resolve left to right ----
  var GLY = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/+<>#';
  function decode(tm, target, at, frames) {
    // round 4: a finished decode writes its text once (tm.__plain), so a layer that decorates the text afterwards (the title
    // shimmer) is not reset and rebuilt every frame
    var k = (D.t - at) / (frames || 17); if (k >= 1 || at == null) { if (tm.__plain !== target) { tm.text = target; tm.__plain = target; } return; }
    tm.__plain = null;
    var n = target.length, shown = Math.floor(n * oc(k)), s = target.slice(0, shown);
    for (var i = shown; i < Math.min(n, shown + 6); i++) s += target[i] === ' ' || target[i] === '\n' ? target[i] : GLY[Math.floor(Math.random() * GLY.length)];
    tm.text = s;
  }

  // ---- build the screen ----
  function build(B) {
    teardown();
    V.B = B; V.made = []; V.mats = mats(); V.fonts = fonts();
    var root = V.root = node(B.root, 'V4Screen'); root.SetAsLastSibling(); root.localPosition = H.V3(0, 0);
    V.g = root.gameObject.AddComponent(TY(UE.CanvasGroup));
    // header (C4 in the Terminal header): identity, LB, tabs, RB, NEXT PERK AT
    var hd = V.hd = node(root, 'Head');
    V.idHex = plate(hd, 'IdHex', 72, 34, 84, 84, { hex: 1, lit: 2, alpha: 0.4 });
    V.idName = text(hd, 'IdName', 176, 34, 300, 46, 34, 'display', 257); V.idName.text = 'ENTROPY DIAL'; V.idName.characterSpacing = 8;
    V.idMode = text(hd, 'IdMode', 176, 82, 300, 34, 24, 'data', 257, C.dim);
    V.lb = plate(hd, 'LB', 500, 58, 48, 48, { lit: 1 }); V.lbT = text(hd, 'LBT', 500, 58, 48, 48, 24, 'display', 514, C.dim); V.lbT.text = 'LB';
    V.rb = plate(hd, 'RB', 2000, 58, 48, 48, { lit: 1 }); V.rbT = text(hd, 'RBT', 2000, 58, 48, 48, 24, 'display', 514, C.dim); V.rbT.text = 'RB';
    V.tabs = [];
    for (var i = 0; i < 5; i++) {
      var tx = 556 + i * 296, tp = plate(hd, 'Tab' + i, tx, 50, 252, 64, { cut: [12, 0, 0, 0] });
      var tt = text(hd, 'TabT' + i, tx + 50, 50, 200, 64, 28, 'display', 513, C.dim); tt.characterSpacing = 6; tt.text = SHORT[MODES[i]];
      var mark = rect(hd, 'TabM' + i, tx + 18, 72, 20, 20, C.dim, 0.6);
      V.tabs.push({ p: tp, t: tt, m: mark, x: tx });
    }
    V.under = rect(hd, 'TabUnder', 556, 146, 252, 6, C.cyan, 1);
    V.nextL = text(hd, 'NextL', 2090, 40, 398, 36, 24, 'display', 257, C.dim); V.nextL.text = 'NEXT PERK AT'; V.nextL.characterSpacing = 4;
    V.nextV = text(hd, 'NextV', 2090, 76, 398, 60, 50, 'data', 257);
    rule(hd, 'MasterRule', 72, 160, 2416, true);
    // title (N3): the state line and the page title with its ghost copy
    V.state = text(root, 'State', 100, 196, 760, 30, 24, 'display', 257, C.dim); V.state.characterSpacing = 4;
    V.stateHex = plate(root, 'StateHex', 72, 198, 22, 24, { hex: 1, lineA: 0.8, alpha: 0 });
    V.titleG = text(root, 'TitleGhost', 76, 228, 1100, 76, 60, 'display', 257, C.line); V.titleG.characterSpacing = 10;
    V.title = text(root, 'Title', 72, 224, 1100, 76, 60, 'display', 257); V.title.characterSpacing = 10;
    // the hover card (D1) holding the breach matrix (C2) and NieR's rows (N2)
    var cd = V.card = node(root, 'Card');
    V.cardTop = plate(cd, 'Band1', 72, 296, 600, 140, { bracket: 16 });
    V.cardMeta = text(cd, 'Meta', 100, 308, 560, 30, 24, 'data', 257, C.dim);
    V.cardText = text(cd, 'ModText', 100, 340, 552, 90, 32, 'body', 257); V.cardText.enableWordWrapping = true;
    V.head = plate(cd, 'Band2', 72, 436, 600, 48, {});
    V.headL = text(cd, 'HeadL', 100, 436, 200, 48, 24, 'display', 4097, C.dim); V.headL.text = 'HEADROOM'; V.headL.characterSpacing = 4;
    V.headTrack = rect(cd, 'HeadTrack', 300, 458, 344, 4, C.line, 0.25); V.headBar = rect(cd, 'HeadBar', 300, 456, 344, 8, C.line, 0.9);
    V.headBar.transform.pivot = H.V2(0, 0.5); V.headBar.transform.localPosition = H.V3(300 - 1280, 720 - 460);
    V.pow = plate(cd, 'Band3', 72, 484, 600, 100, {});
    V.powV = text(cd, 'PowV', 100, 490, 200, 88, 76, 'display', 4097); V.powL = text(cd, 'PowL', 300, 484, 360, 100, 28, 'display', 4097, C.dim);
    V.powL.text = 'ENTROPY AT THIS RANK'; V.powL.characterSpacing = 4;
    V.mbar = plate(cd, 'MatrixBar', 72, 596, 600, 56, { raised: 1, cut: [16, 0, 0, 0] });
    V.mbarT = text(cd, 'MatrixT', 108, 596, 400, 56, 30, 'display', 4097); V.mbarT.text = 'RANK MATRIX'; V.mbarT.characterSpacing = 6;
    V.buf = [];
    for (var b = 0; b < 6; b++) V.buf.push(plate(cd, 'Buf' + b, 100 + b * 46, 668, 38, 38, { dash: 1, lineA: 0.6 }));
    V.bufT = text(cd, 'BufT', 390, 660, 270, 56, 30, 'data', 4097);
    V.rows = [];
    for (var r = 0; r < 6; r++) {
      var ry = 764 + r * 68;
      var rp = plate(cd, 'Row' + r, 92, ry, 572, 56, { lineA: 0, alpha: 0 });
      var rl = text(cd, 'RowR' + r, 112, ry, 70, 56, 28, 'data', 4097, C.dim);
      var re = text(cd, 'RowE' + r, 190, ry, 200, 56, 28, 'body', 4097, C.dim);
      var rt = rect(cd, 'RowTrack' + r, 400, ry + 26, 150, 4, C.line, 0.2);
      var rb2 = rect(cd, 'RowBar' + r, 400, ry + 24, 150, 8, C.line, 0.85); rb2.transform.pivot = H.V2(0, 0.5); rb2.transform.localPosition = H.V3(400 - 1280, 720 - (ry + 28));
      var rc = text(cd, 'RowC' + r, 560, ry, 96, 56, 28, 'data', 4100, C.dim);
      V.rows.push({ p: rp, l: rl, e: re, t: rt, b: rb2, c: rc, y: ry });
    }
    V.rail = rect(cd, 'Rail', 76, 764, 4, 408, C.line, 0.35); V.railMark = rect(cd, 'RailMark', 72, 764, 12, 56, C.line, 0.9);
    plate(cd, 'CardFrame', 72, 584, 600, 600, { alpha: 0.35, bracket: 18 }).transform.SetSiblingIndex(0);
    // the centre: the gauge (D4) with perk nodes (C3), the slot ring (C1), the bus, the core (D2)
    var dl = V.dial = node(root, 'Dial'); dl.localPosition = H.V3(0, 720 - 750);
    V.gseg = [];
    for (var s = 0; s < 120; s++) {
      // DESIGN.md: value v sits at 120 + 300 v screen degrees (y down): lower left, through the top, to lower right
      var th = 120 + 300 * (s + 0.5) / 120, sg = H.img(dl, 'G' + s, 22, 4, null, C.line, 0.25); V.made.push(sg.gameObject);
      sg.transform.localPosition = gp(480, th); sg.transform.localEulerAngles = H.V3(0, 0, 90 - th);
      V.gseg.push(sg);
    }
    V.perkNodes = []; V.perkHost = node(dl, 'Perks');
    V.bus = H.img(dl, 'Bus', 600, 600, 'dial:ring', C.line, 0.18); V.made.push(V.bus.gameObject);
    V.wires = node(dl, 'Wires'); V.slotHost = node(dl, 'Slots'); V.slots = [];
    V.ptr = rect(dl, 'Pointer', 1258, 286 - (750 - 720), 44, 26, C.line, 0.5);
    V.ptr.transform.localPosition = H.V3(0, 750 - 299); V.ptr.transform.localEulerAngles = H.V3(0, 0, 45); V.ptr.transform.sizeDelta = H.V2(20, 20);
    V.brk = []; for (var k = 0; k < 4; k++) { var bk = H.img(dl, 'Brk' + k, 26, 26, null, C.cyan, 1); V.made.push(bk.gameObject); V.brk.push(bk); }
    V.minus = plate(dl, 'Minus', 0, 0, 88, 60, { cut: [12, 0, 12, 0], bracket: 12 }); V.plus = plate(dl, 'Plus', 0, 0, 88, 60, { cut: [12, 0, 12, 0], bracket: 12 });   // round 5 (item 10)
    // pop pass (2026-11-05): the core is 1.5x, so - and + flank it left and right, and the node label sits over its tip
    V.minus.transform.localPosition = H.V3(-282, 0); V.plus.transform.localPosition = H.V3(282, 0);
    V.minusT = text(dl, 'MinusT', 0, 0, 88, 60, 48, 'display', 514); V.minusT.transform.localPosition = V.minus.transform.localPosition; V.minusT.text = '-';
    V.plusT = text(dl, 'PlusT', 0, 0, 88, 60, 48, 'display', 514); V.plusT.transform.localPosition = V.plus.transform.localPosition; V.plusT.text = '+';
    V.label = text(dl, 'NodeLabel', 0, 0, 520, 40, 36, 'display', 514); V.label.transform.localPosition = H.V3(0, 294); V.label.characterSpacing = 0;
    V.core = plate(dl, 'Core', 0, 0, 450, 510, { hex: 1, lit: 3, alpha: 0.92, lineA: 1, fill: [0.018, 0.022, 0.032] }); V.core.transform.localPosition = H.V3(0, 0);
    V.coreRing = H.img(dl, 'CoreRing', 540, 540, 'dial:ring', C.line, 0.3); V.made.push(V.coreRing.gameObject);
    V.total = text(dl, 'Total', 0, 0, 440, 210, 198, 'display', 514); V.total.transform.localPosition = H.V3(0, 26);
    V.limitT = text(dl, 'Limit', 0, 0, 400, 44, 36, 'display', 514, C.dim); V.limitT.transform.localPosition = H.V3(0, -120); V.limitT.characterSpacing = 2;
    // the right block: NieR storage strip, memory column, status block; Destiny stat column and tracked rows
    var rt2 = V.right = node(root, 'Right');
    V.store = plate(rt2, 'Store', 1888, 296, 600, 60, { bracket: 14 });
    rect(rt2, 'StoreBlock', 1888, 296, 19, 60, C.line, 0.85);
    V.storeL = text(rt2, 'StoreL', 1924, 296, 400, 60, 24, 'display', 4097, C.dim); V.storeL.text = 'ENTROPY BY MODIFIER'; V.storeL.characterSpacing = 4;
    V.storeV = text(rt2, 'StoreV', 2240, 296, 230, 60, 28, 'data', 4100);
    V.mem = plate(rt2, 'Mem', 1888, 372, 100, 824, { alpha: 0.4 }); V.memBlocks = [];
    V.stat = plate(rt2, 'Status', 2008, 372, 480, 824, { bracket: 18 });
    V.statH = plate(rt2, 'StatusH', 2008, 372, 480, 52, { raised: 1, cut: [16, 0, 0, 0] });
    V.statHT = text(rt2, 'StatusHT', 2036, 372, 440, 52, 26, 'display', 4097); V.statHT.text = 'STATUS'; V.statHT.characterSpacing = 6;
    V.oL = text(rt2, 'OutL', 2036, 446, 200, 60, 26, 'display', 4097, C.dim); V.oL.text = 'OUTPUT'; V.oL.characterSpacing = 5;
    V.o1 = text(rt2, 'Out1', 2190, 440, 150, 70, 44, 'display', 4100); V.o2 = text(rt2, 'Out2', 2350, 440, 122, 70, 44, 'display', 4100, C.dim);
    V.tL = text(rt2, 'TacL', 2036, 526, 200, 60, 26, 'display', 4097, C.dim); V.tL.text = 'TACTIC'; V.tL.characterSpacing = 5;
    V.t1 = text(rt2, 'Tac1', 2190, 520, 150, 70, 44, 'display', 4100); V.t2 = text(rt2, 'Tac2', 2350, 520, 122, 70, 44, 'display', 4100, C.dim);
    rule(rt2, 'StatRule', 2028, 610, 440, false);
    V.trH = text(rt2, 'TrackH', 2036, 628, 440, 44, 24, 'display', 4097, C.dim); V.trH.text = 'TRACKED  //  RULES'; V.trH.characterSpacing = 5;
    V.ruleRows = [];
    for (var q = 0; q < 4; q++) {
      var qy = 680 + q * 96, rp2 = plate(rt2, 'Rule' + q, 2028, qy, 440, 84, {}), rh = plate(rt2, 'RuleHex' + q, 2044, qy + 28, 24, 28, { hex: 1, alpha: 0, lineA: 0.7 });
      var rtx = text(rt2, 'RuleT' + q, 2084, qy + 6, 372, 72, 26, 'body', 4097); rtx.enableWordWrapping = true;
      V.ruleRows.push({ p: rp2, h: rh, t: rtx });
    }
    // the Mutations (round-2 review: the stock menu's paid unlocks must stay on screen): a chip row under the rules
    V.mutH = text(rt2, 'MutH', 2036, 1068, 440, 40, 24, 'display', 4097, C.dim); V.mutH.text = 'MUTATIONS'; V.mutH.characterSpacing = 5;
    V.muts = []; for (var mu = 0; mu < 12; mu++) V.muts.push(plate(rt2, 'Mut' + mu, 2036 + (mu % 6) * 72, 1112 + Math.floor(mu / 6) * 0, 60, 60, { cut: [8, 0, 8, 0] }));
    // the foot (NieR help strip in Terminal foot glass) and the bottom rule; the game's own prompt bar sits on its right
    V.foot = plate(root, 'Foot', 72, 1244, 2416, 144, { bracket: 18 });
    rect(root, 'FootBlock', 72, 1244, 19, 144, C.line, 0.85);
    V.footHex = plate(root, 'FootHex', 120, 1286, 48, 54, { hex: 1, alpha: 0, lineA: 0.8 });
    V.footA = text(root, 'FootA', 196, 1262, 900, 54, 34, 'display', 4097); V.footA.characterSpacing = 6;
    V.footB = text(root, 'FootB', 196, 1316, 900, 44, 28, 'body', 4097, C.dim);
    rule(root, 'BottomRule', 72, 1414, 2416, true);
    // the warp overlay (Terminal hex warp) for the open and mode changes, when the bundle has it
    if (V.mats.ED_Warp) { V.warp = rect(root, 'Warp', 0, 0, 2560, 1440, [1, 1, 1], 1); V.warp.material = V.warpM = new UE.Material(V.mats.ED_Warp); }
    V.openAt = D.t; V.decodeAt = {}; V.last = {};
    V.tabKey = V.rowKey = V.memKey = V.hushAt = null;   // round 4: the change keys belong to this build
  }
  function teardown() { for (var g of (V.made || [])) try { UE.Object.Destroy(g); } catch (x) {} V.made = []; V.B = null; V.slots = []; V.perkNodes = []; V.memBlocks = []; }

  // the old layers go quiet: every piece the v3 dial and its art and motif layers drew, except the room
  function hush(B) {
    var keep = { EDV4Screen: 1 };
    for (var i = 0; i < B.root.childCount; i++) {
      var c = B.root.GetChild(i); if (c.name.indexOf('V4Screen') >= 0) continue;   // H.node names are 'EDM' + name
      if (c.name === 'EDMABack' || c.name.indexOf('EDMABack') === 0) {
        for (var j = 0; j < c.childCount; j++) { var cc = c.GetChild(j); var on = cc.name === 'EDMBase' || cc.name === 'EDMV4Room'; if (cc.gameObject.activeSelf !== on) cc.gameObject.SetActive(on); }
        continue;
      }
      if (c.gameObject.activeSelf) c.gameObject.SetActive(false);
    }
  }

  // ---- the slot ring: one cut-corner slot per modifier ----
  function slots(n) {
    while (V.slots.length < n) {
      var i = V.slots.length, t = H.node(V.slotHost, 'Slot' + i); V.made.push(t.gameObject);
      var p = plate(t, 'P', 1280 - 44, 720 - 44, 88, 88, { cut: [0, 0, 22, 0] }); p.transform.localPosition = H.V3(0, 0);
      var ic = H.img(t, 'I', 52, 52, null, [1, 1, 1], 1); ic.preserveAspect = true; V.made.push(ic.gameObject); ic.transform.localPosition = H.V3(0, 8);
      var fg = text(t, 'F', 0, 0, 88, 30, 22, 'data', 514); fg.transform.localPosition = H.V3(0, -30);
      var w = H.img(V.wires, 'W' + i, 2, 72, null, C.line, 0.18); V.made.push(w.gameObject); w.transform.pivot = H.V2(0.5, 0);
      V.slots.push({ t: t, p: p, i: ic, f: fg, w: w, g: t.gameObject.AddComponent(TY(UE.CanvasGroup)) });
    }
    for (var k = 0; k < V.slots.length; k++) { var on = k < n; if (V.slots[k].t.gameObject.activeSelf !== on) { V.slots[k].t.gameObject.SetActive(on); V.slots[k].w.gameObject.SetActive(on); } }
  }

  // ---- the frame ----
  var base = D.art.baseV4s || D.art;
  D.art = function (w, B) {
    // round 4 (frame time): the layers under this one (v3 art, motifs, motif_V4, light_v4) draw pieces hush() hides;
    // they run while the screen builds and opens (the room and its material come from light_v4), during a close, and
    // then stop. pop_v4 keeps the room's pulse and the shaders' clock. ED.lean also tells the v3 frame to skip its hidden
    // pieces. ED.leanOff = true runs everything as before.
    D.lean = !D.leanOff;
    var openF = D.t - (V.openAt == null ? D.t : V.openAt);
    if (!D.lean || !V.root || V.root.Equals(null) || V.B !== B || openF < 24 || D.closeAt != null) base(w, B);
    try { tick(w, B); } catch (e) { if (!V.err) { V.err = 1; D.log.push('v4 EXC ' + e + ' ' + (e.stack || '').split('\n')[1]); } }
  };
  D.art.baseV4s = base;

  // the game's own prompt bar (its own canvas, order 26) sits under the dial's full-screen room: lift it over the menu's
  // canvas while the dial is open, and put its order back when the dial stops
  function liftBar(w) {
    if (V.bar && !V.bar.Equals(null)) return;
    try {
      var fo = UE.GameObject.Find('GameGlobal(Clone)/SingletonOrganizer/(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions'); if (!fo) return;
      var bc = fo.GetComponent(TY(UE.Canvas)), mc = w.CsObj.GetComponentInParent(TY(UE.Canvas)); if (!bc || bc.Equals(null)) return;
      V.bar = bc; V.barOrder = bc.sortingOrder; V.barOverride = bc.overrideSorting;
      bc.overrideSorting = true; bc.sortingOrder = Math.max(bc.sortingOrder, (mc && !mc.Equals(null) ? mc.rootCanvas.sortingOrder : 0) + 1);
    } catch (x) { D.log.push('v4 bar ' + x); }
  }
  if (!D.stopV4wrapped) {
    var st0 = D.stop;
    D.stop = function () { try { if (V.bar && !V.bar.Equals(null)) { V.bar.sortingOrder = V.barOrder; V.bar.overrideSorting = V.barOverride; } } catch (x) {} V.bar = null; return st0.apply(this, arguments); };
    D.stopV4wrapped = true;
  }
  function tick(w, B) {
    if (V.B !== B || !V.root || V.root.Equals(null)) build(B);
    if (V.hushAt == null || D.t - V.hushAt > 15 || D.t < V.hushAt) { V.hushAt = D.t; hush(B); }   // round 4: every 15 frames, not every frame
    var fr = D.fr, t = D.t, oF = t - V.openAt, mode = modeOf(w), rows = fr.rows || [], n = rows.length, sel = rows[fr.selIdx] || null;
    // test only: ED.v4tot shows a forced total (near / at the limit, a perk reached) without touching a rank; null = real
    if (D.v4tot != null) { D.totTo = D.v4tot; D.totShown = D.v4tot; }
    var total = D.totShown || 0, limit = limitOf(), head = limit ? Math.max(0, limit - (D.totTo || 0)) : 0;
    var near = !!D.v4near || (limit && head <= Math.max(1, Math.round(limit * 0.05))), atLim = limit && head === 0;
    // the open (DESIGN.md 5): the room under it, header f18-60, tabs f24-78, glass f36-102, slots f46-92, total f60-96, foot f62-98
    V.g.alpha = 1;
    var hk = oc((oF - 18) / 42), gk = oc((oF - 36) / 40), fk = oc((oF - 62) / 36);
    V.hd.localPosition = H.V3(0, 30 * (1 - hk)); V.hd.localScale = H.S3(1, 1);
    V.card.localPosition = H.V3(-60 * (1 - gk), 0); V.right.localPosition = H.V3(60 * (1 - gk), 0);
    setAlpha(V.hd, hk); setAlpha(V.card, gk); setAlpha(V.right, gk); setAlpha(V.dial, oc((oF - 30) / 30));
    if (V.warpM) { V.warpM.SetFloat('_Progress', cl((oF - 8) / 43)); V.warpM.SetVector('_Origin', new UE.Vector4(0, -30, 0, 0)); V.warp.gameObject.SetActive(oF < 60); }
    // header
    var mi = Math.max(0, MODES.indexOf(mode));
    V.idMode.text = '//MODE ' + (mi + 1) + ' / 5';
    var tabKey = mi + ':' + (oF < 90 ? Math.floor(oF) : 'done');   // round 4: the tabs change on a mode change and during the open
    for (var i = 0; i < 5 && V.tabKey !== tabKey; i++) {
      var T = V.tabs[i], chosen = i === mi, tk = oc((oF - 24 - i * 3) / 20);
      T.p.transform.sizeDelta = H.V2(252, 64);   // round 5 (item 8): one tab height; the underline marks the active one
      T.p.transform.localPosition = H.V3(T.x + 126 - 1280, 720 - (50 + 32));
      setLit(T.p, chosen ? 3 : 1, { _Raised: chosen ? 1 : 0 });
      T.t.color = col(chosen ? C.text : C.dim, tk); T.m.color = col(chosen ? C.text : C.dim, 0.6 * tk);
      T.t.transform.localPosition = H.V3(T.x + 150 - 1280, 720 - (50 + 32));
    }
    V.tabKey = tabKey;
    var ux = V.tabs[mi].x; var cur = V.under.transform.localPosition.x, want = ux + 126 - 1280;
    V.under.transform.localPosition = H.V3(cur + (want - cur) * 0.3, 720 - 149);
    var perks = perksFor(w), next = perks.find(function (p) { return p.at > (D.totTo || 0); });
    V.nextV.text = next ? '' + next.at : 'ALL';
    // title and state line
    var stateW = atLim ? 'AT THE LIMIT' : near ? 'NEAR THE LIMIT' : 'WITHIN THE LIMIT', stC = near ? C.amber : C.dim;
    if (V.last.state !== stateW) { V.last.state = stateW; V.decodeAt.state = t; }
    decode(V.state, stateW, V.decodeAt.state, 17); V.state.color = col(stC, gk);
    var title = (U.GetLocale('BattleModeName_' + mode) || SHORT[mode]).toUpperCase();
    if (V.last.title !== title) { V.last.title = title; V.decodeAt.title = t; }
    decode(V.title, title, V.decodeAt.title, 20); V.titleG.text = V.title.text;   // round 5 (item 6): every decode lands in 20 frames or less
    V.title.color = col(C.text, gk); V.titleG.color = col(C.line, 0.18 * gk);
    // the card: the chosen modifier
    if (sel) {
      var key = sel.id + ':' + mode;
      if (V.last.sel !== key) { V.last.sel = key; V.decodeAt.card = t; }
      V.cardMeta.text = 'MODIFIER ' + pad2(fr.selIdx + 1) + ' / ' + pad2(n);
      decode(V.cardText, (B.name && B.name.text) || sel.name || '', V.decodeAt.card, 17);
      var pts = sel.lv ? sanAt(sel.id, sel.lv, w.CurBattleMode) : 0;
      if (V.last.pts !== pts + key) { V.last.pts = pts + key; V.decodeAt.pow = t; }
      decode(V.powV, '+' + pts, V.decodeAt.pow, 10);
      var rowKey = sel.id + ':' + sel.lv + ':' + sel.max + ':' + w.CurBattleMode + ':' + mode;   // round 4: rows on a change only
      var rowsDirty = V.rowKey !== rowKey; V.rowKey = rowKey;
      for (var b = 0; b < V.buf.length && rowsDirty; b++) {
        var has = b < sel.max, fill = b < sel.lv; V.buf[b].gameObject.SetActive(has);
        V.buf[b].color = V.buf[b].__m ? col([1, 1, 1], 1) : col(fill ? C.line : C.panel, fill ? 0.9 : 0.5);
        setLit(V.buf[b], fill ? 2 : 0, { _Dash: fill ? 0 : 1 });
      }
      V.bufT.text = 'RANK ' + sel.lv + ' / ' + sel.max;
      for (var r = 0; r < 6 && rowsDirty; r++) {
        var R = V.rows[r], l = r + 1, show = l <= sel.max;
        [R.p, R.l, R.e, R.t, R.b, R.c].forEach(function (o) { if (o.gameObject.activeSelf !== show) o.gameObject.SetActive(show); });
        if (!show) continue;
        var cur2 = l === sel.lv, past = l < sel.lv;
        R.l.text = 'R' + l; R.e.text = ((B.ranks && B.ranks[r] && B.ranks[r].text) || '').replace(/^\d+\s+/, '');
        var cost = sanAt(sel.id, l, w.CurBattleMode); R.c.text = '[+' + cost + ']';
        var mx = sanAt(sel.id, sel.max, w.CurBattleMode) || 1; R.b.transform.localScale = H.S3(cl(cost / mx), 1);
        var tc = cur2 ? C.text : past ? C.line : C.faint;
        R.l.color = col(tc, 1); R.e.color = col(tc, 1); R.c.color = col(tc, 1); R.b.color = col(cur2 ? C.text : C.line, cur2 ? 1 : past ? 0.6 : 0.25);
        R.p.color = cur2 ? col(C.raised, 0.9) : col(C.panel, 0); setLit(R.p, cur2 ? 2 : 0, { _Raised: cur2 ? 1 : 0 });
        if (cur2) V.railMark.transform.localPosition = H.V3(78 - 1280, 720 - (R.y + 28));
      }
      V.railMark.gameObject.SetActive(sel.lv > 0);
    }
    // headroom
    var hf = limit ? cl(head / limit) : 0; V.headBar.transform.localScale = H.S3(hf, 1); V.headBar.color = col(near ? C.amber : C.line, 0.9);
    // the dial: gauge, perks, slots, core
    var scale = V.scale = Math.max(limit, perks.length ? perks[perks.length - 1].at : 0, 100);
    var shownTot = total, litTo = cl(shownTot / scale);
    for (var s = 0; s < V.gseg.length && !D.V4P; s++) {   // pop_v4 colours the gauge when it is loaded (round 4)
      var sv = (s + 0.5) / V.gseg.length, on = sv <= litTo;
      V.gseg[s].color = col(on ? (near ? C.amber : C.line) : C.line, on ? 0.9 : 0.18);
    }
    gaugeNodes(perks, scale, shownTot);
    slots(n);
    var rot = D.rot == null ? fr.selIdx : D.rot;
    for (var k = 0; k < n; k++) {
      var S = V.slots[k], Rw = rows[k], isSel = k === fr.selIdx;
      var ang = slotAngle(k - rot, n) * Math.PI / 180, rr = 372;
      var sk = oc((oF - 46 - k) / 14);
      // round 4: the base position is kept on the slot (life_v4 bobs it from there); writes happen when a value changes
      S.bx = rr * Math.cos(ang); S.by = rr * Math.sin(ang);
      if (S.__px !== S.bx || S.__py !== S.by) { S.__px = S.bx; S.__py = S.by; S.t.localPosition = H.V3(S.bx, S.by); }
      if (S.__a !== sk) { S.__a = sk; S.g.alpha = sk; }
      var sz = isSel ? 112 : 88; if (S.__sz !== sz) { S.__sz = sz; S.p.transform.sizeDelta = H.V2(sz, sz); if (S.p.__m) S.p.__m.SetVector('_Size', new UE.Vector4(sz, sz, 0, 0)); }
      setLit(S.p, isSel ? 3 : Rw.lv > 0 ? 2 : 1);
      if (!S.p.__m) S.p.color = col(isSel ? C.raised : C.panel, isSel ? 0.95 : 0.7);
      if (Rw.sprite && S.__sid !== Rw.id + ':' + w.CurBattleMode) { S.__sid = Rw.id + ':' + w.CurBattleMode; S.i.sprite = Rw.sprite.sprite; }
      cC(S.i, [1, 1, 1], Rw.lv > 0 || isSel ? 1 : 0.35);
      cT(S.f, Rw.lv + '/' + Rw.max); cC(S.f, Rw.lv > 0 ? C.text : C.faint, 1);
      // the wire from the slot to the bus
      if (S.__wa !== ang) { S.__wa = ang; S.w.transform.localPosition = H.V3(300 * Math.cos(ang), 300 * Math.sin(ang)); S.w.transform.localEulerAngles = H.V3(0, 0, ang * 180 / Math.PI - 90); }
      cC(S.w, C.line, Rw.lv > 0 ? 0.45 : 0.12);
      if (isSel) {
        var p0 = { x: S.bx, y: S.by }, half = 66;
        var open = D.turnAt != null && t - D.turnAt < 8 ? 6 * (1 - (t - D.turnAt) / 8) : 0;
        [[-1, 1, 0], [1, 1, -90], [1, -1, 180], [-1, -1, 90]].forEach(function (c4, j) {
          var bk = V.brk[j], bkk = p0.x + ':' + p0.y + ':' + open;
          if (bk.__k !== bkk) { bk.__k = bkk; bk.transform.localPosition = H.V3(p0.x + c4[0] * (half + open), p0.y + c4[1] * (half + open)); bk.transform.localEulerAngles = H.V3(0, 0, c4[2]); bk.transform.sizeDelta = H.V2(26, 4); }
        });
      }
    }
    V.label.text = sel ? shortName(sel.name) : '';
    V.minus.gameObject.SetActive(!!sel); V.plus.gameObject.SetActive(!!sel);
    if (sel) { setLit(V.plus, sel.lv < sel.max && !atLim ? 3 : 0); setLit(V.minus, sel.lv > 0 ? 1 : 0); V.plusT.color = col(sel.lv < sel.max && !atLim ? C.cyan : C.faint, 1); V.minusT.color = col(sel.lv > 0 ? C.text : C.faint, 1); }
    // the core: the total rolls (v3 rolls D.totShown), the limit under it; a rank up lights it
    var rF = fr.rF, rk = rF < 28 ? Math.sin(Math.PI * cl((rF - 4) / 24)) : 0;
    V.total.text = '' + total; V.total.color = col(C.text, oc((oF - 60) / 36));
    V.limitT.text = limit ? 'LIMIT ' + limit : ''; setLit(V.core, 2 + rk);
    V.core.transform.localScale = H.S3(1 + 0.03 * rk, 1 + 0.03 * rk);
    V.coreRing.transform.localEulerAngles = H.V3(0, 0, t * 0.2);
    // the right block
    var ranked = rows.filter(function (q) { return q.lv > 0; });
    V.storeV.text = ranked.length + ' RANKED';
    memColumn(rows, limit, w);
    var ot = ((B.ot && B.ot.text) || '').split('\n'), nums = function (s) { return (s || '').match(/\d+%?/g) || []; };
    var on1 = nums(ot[0]), tn = nums(ot[1]);
    V.o1.text = on1[0] || ''; V.o2.text = on1[1] || ''; V.t1.text = tn[0] || ''; V.t2.text = tn[1] || '';
    var rl = ((B.ru && B.ru.text) || '').split('\n').filter(function (x) { return x.trim(); });
    for (var q = 0; q < V.ruleRows.length && !D.V4P; q++) { var RR = V.ruleRows[q], has2 = q < rl.length; [RR.p, RR.h, RR.t].forEach(function (o) { o.gameObject.SetActive(has2); }); if (has2) RR.t.text = rl[q]; }
    var mt = D.V4P ? [] : mutations(w); if (!D.V4P) V.mutH.gameObject.SetActive(mt.length > 0);   // pop_v4 owns the chips (round 4)
    for (var m2 = 0; m2 < V.muts.length && !D.V4P; m2++) {
      var MU = V.muts[m2], hasM = m2 < mt.length; MU.gameObject.SetActive(hasM); if (!hasM) continue;
      MU.transform.localPosition = H.V3(2036 + (m2 % 6) * 72 + 30 - 1280, 720 - (1112 + 30 + Math.floor(m2 / 6) * 0));
      setLit(MU, mt[m2].open ? 2 : mt[m2].locked ? 0 : 1, { _Dash: mt[m2].locked ? 1 : 0 });
    }
    // the foot
    V.footA.text = stateW; V.footA.color = col(near ? C.amber : C.text, fk);
    V.footB.text = limit ? (head === 0 ? 'No Entropy to spare.' : head + ' Entropy to spare.') : '';
    V.footB.color = col(C.dim, fk);
  }
  // a point on the gauge: screen degrees (y down) to the dial's local space (y up)
  function gp(r, th) { var a = th * Math.PI / 180; return H.V3(r * Math.cos(a), -r * Math.sin(a)); }
  // round 4: the group is looked up once per transform, and its alpha is written only when it changes
  function setAlpha(t, a) {
    var g = t.__cg; if (!g) { g = t.gameObject.GetComponent(TY(UE.CanvasGroup)); if (!g || g.Equals(null)) g = t.gameObject.AddComponent(TY(UE.CanvasGroup)); t.__cg = g; }
    a = cl(a); if (t.__a !== a) { t.__a = a; g.alpha = a; }
  }
  // round 4: Image / text colour only on a change (objects only this layer colours, or where a later layer always
  // overwrites); the slot writes below keep their own keys
  function cC(o, c, a) { if (a == null) a = 1; var k = o.__dc; if (k && k[0] === c[0] && k[1] === c[1] && k[2] === c[2] && Math.abs(k[3] - a) < 0.002) return; o.__dc = [c[0], c[1], c[2], a]; o.color = col(c, a); }
  function cT(tm, s) { if (tm.__dt === s) return; tm.__dt = s; tm.text = s; }
  function shortName(s) { s = String(s || '').replace(/<[^>]*>/g, ''); var m = /^([A-Za-z ]+?)\s(deal|take|have|gain|are|will|move|attack|start)/.exec(s); return (m ? m[1] : s.split(' ').slice(0, 2).join(' ')).toUpperCase(); }
  function gaugeNodes(perks, scale, total) {
    while (V.perkNodes.length < perks.length) {
      var i = V.perkNodes.length, p = plate(V.perkHost, 'Perk' + i, 0, 0, 56, 56, { cut: [10, 0, 10, 0] });
      var tt = text(V.perkHost, 'PerkT' + i, 0, 0, 70, 30, 22, 'data', 514); V.perkNodes.push({ p: p, t: tt });
    }
    for (var k = 0; k < V.perkNodes.length && !D.V4P; k++) {   // round 4: pop_v4 draws the perks as ticks
      var N = V.perkNodes[k], has = k < perks.length; N.p.gameObject.SetActive(has); N.t.gameObject.SetActive(has); if (!has) continue;
      var pp = gp(540, 120 + 300 * cl(perks[k].at / scale));
      N.p.transform.localPosition = pp; N.t.transform.localPosition = pp;
      var reached = total >= perks[k].at; setLit(N.p, reached ? 2 : 0); N.t.text = '' + perks[k].at; N.t.color = col(reached ? C.text : C.faint, 1);
    }
  }
  function memColumn(rows, limit, w) {
    var ranked = rows.filter(function (q) { return q.lv > 0; });
    while (V.memBlocks.length < ranked.length) { var b = rect(V.right, 'MemB' + V.memBlocks.length, 1896, 380, 84, 10, C.line, 0.5); b.transform.pivot = H.V2(0.5, 0); V.memBlocks.push(b); }
    // round 4: rebuilt only when the ranks, the limit, the chosen modifier or pop's shift change; pop's shift (the column's
    // bottom follows the status block) is applied here
    var selR = (D.fr.rows || [])[D.fr.selIdx], shift = (D.V4P && D.V4P.memShift) || 0;
    var mk = ranked.map(function (q) { return q.id + '.' + q.lv; }).join(',') + '|' + limit + '|' + (selR && selR.id) + '|' + shift + '|' + w.CurBattleMode;
    if (V.memKey === mk) return; V.memKey = mk;
    var y = 1188 + shift, sum = ranked.reduce(function (s, q) { return s + sanAt(q.id, q.lv, w.CurBattleMode); }, 0), tot = Math.max(1, limit || sum);   // Normal has no limit: the column is the sum
    for (var k = 0; k < V.memBlocks.length; k++) {
      var B2 = V.memBlocks[k], has = k < ranked.length; B2.gameObject.SetActive(has); if (!has) continue;
      var pts = sanAt(ranked[k].id, ranked[k].lv, w.CurBattleMode), h = Math.max(4, 808 * pts / tot - 4);
      B2.transform.sizeDelta = H.V2(84, h); B2.transform.localPosition = H.V3(1938 - 1280, 720 - y); y -= h + 4;
      B2.__sel = ranked[k] === selR; B2.__ic = null; B2.color = col(B2.__sel ? C.text : C.line, B2.__sel ? 0.95 : 0.45);
    }
  }
  return 'v4 screen on: plate ' + !!(mats().ED_Plate) + ', warp ' + !!(mats().ED_Warp) + ', fonts ' + Object.keys(fonts()).join(',');
})();
  }]);

  // ---- life_v4.js ----
  layers.push(['life_v4.js', function () {
// Entropy Dial v4: life (the lead, 2026-11-05: "I don't want the Entropy Dial menu to be colourless. I want it to feel
// alive: each difficulty should tint the whole menu in its own colours; the border boxes should glow; text should look good
// and be animated; basically every part of the menu should be moving").
// A layer over dial_v4.js: it never builds the screen, it colours, lights and moves what dial_v4 built.
//  - colour: each difficulty has a palette (accent and second accent); every line, rule, outline and label on the screen
//    takes it, and the room behind takes it too; a mode change blends over 31 frames (DESIGN.md: horizon tint 520 ms);
//  - glow: every frame (panel, card band, tab, status, foot) gets a real-time glow on its four edges (EntropyDial/LightFx
//    streaks, additive) and a light that runs round it, the Terminal's runner;
//  - text: the title shimmers and carries an accent ghost with a small RGB-style offset; labels re-decode now and then;
//  - motion: data packets run along the rules, a pulse travels through the gauge's lit arc, brackets breathe, the next perk
//    pulses, the memory column ripples, the panels drift, the chosen slot sparkles.
// Load after dial_v4.js (load_v4.js does).
(function () {
  var D = globalThis.ED; if (!D || !D.V4 || !D.MH) return 'load dial_v4.js first';
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, H = D.MH, V = D.V4;
  var LF = D.V4L = { made: [], root: null };
  // the palettes: a = accent, b = second accent (the Terminal's line stays the neutral they mix into)
  var PAL = {
    1: { a: [0.62, 0.86, 1.0], b: [0.79, 0.83, 0.88] },      // Normal: ice
    2: { a: [0.31, 0.86, 0.94], b: [0.25, 0.55, 1.0] },      // Advanced: Terminal cyan into blue
    4: { a: [1.0, 0.70, 0.30], b: [1.0, 0.42, 0.18] },       // Extreme: amber into ember
    104: { a: [1.0, 0.25, 0.42], b: [0.62, 0.10, 0.32] },    // Grim of the Abyss: rose into crimson
    105: { a: [0.66, 0.46, 1.0], b: [0.31, 0.86, 0.94] }     // Endless: violet and cyan
  };
  LF.PAL = PAL;   // pop_v4.js reads the target palette for its recolour wipe
  var LINE = [0.788, 0.827, 0.878], DIM = [0.553, 0.592, 0.663], TEXT = [0.914, 0.933, 0.965];
  function cl(k) { return Math.max(0, Math.min(1, k)); }
  function mix(a, b, k) { k = cl(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function col(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? 1 : a); }
  function near(c, ref) { return Math.abs(c.r - ref[0]) < 0.03 && Math.abs(c.g - ref[1]) < 0.03 && Math.abs(c.b - ref[2]) < 0.03; }
  function hex(c, a) { function h(v) { var s = Math.round(cl(v) * 255).toString(16); return s.length < 2 ? '0' + s : s; } return '#' + h(c[0]) + h(c[1]) + h(c[2]) + (a == null ? '' : h(a)); }

  function glowMat() {
    if (LF.gm) return LF.gm;
    var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)), base = null;
    for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === 'ED_LightFx') base = all.get_Item(i);
    if (!base) return null;
    var m = new UE.Material(base); m.SetFloat('_Mode', 0); m.SetFloat('_Thin', 34); m.SetFloat('_Core', 0.9); m.SetFloat('_Halo', 0.55);
    var s = new UE.Material(base); s.SetFloat('_Mode', 1); s.SetFloat('_Thin', 26); s.SetFloat('_Core', 1.6); s.SetFloat('_Halo', 0.45); s.SetFloat('_Twinkle', 0.5); s.SetFloat('_Rate', 0.6);
    LF.sm = s; return LF.gm = m;
  }
  function fxImg(parent, name, w, h, mat) {
    var im = H.img(parent, name, w, h, null, [1, 1, 1], 0); im.material = mat; LF.made.push(im.gameObject); return im;
  }

  // ---- build: collect what to tint, add glows, packets, sparkle ----
  function build() {
    for (var g of LF.made) try { UE.Object.Destroy(g); } catch (x) {}
    LF.made = []; LF.root = V.root; LF.tint = []; LF.dimT = []; LF.glows = []; LF.packets = [];
    // every Image drawn in the Terminal line colour, and every label in dim, takes the palette
    var ims = V.root.GetComponentsInChildren(TY(UE.UI.Image), true);
    for (var i = 0; i < ims.Length; i++) { var im = ims.get_Item(i); if (near(im.color, LINE)) LF.tint.push({ im: im, a: im.color.a }); }
    var tms = V.root.GetComponentsInChildren(TY(cs.TMPro.TextMeshProUGUI), true);
    for (var j = 0; j < tms.Length; j++) { var tm = tms.get_Item(j); if (near(tm.color, DIM)) LF.dimT.push(tm); }
    var gm = glowMat(); if (!gm) return;
    // glows on the frames: four edges each, and one runner
    var frames = [V.cardTop, V.head, V.pow, V.mbar, V.store, V.stat, V.statH, V.foot, V.mem].concat(V.tabs.map(function (T) { return T.p; }))
      .concat(V.ruleRows.map(function (R) { return R.p; }));
    frames.forEach(function (p, k) {
      if (!p || p.Equals(null)) return;
      var t = p.transform, sz = t.sizeDelta, w = sz.x, h = sz.y, G = { p: p, w: w, h: h, e: [], k: k };
      [[0, h / 2, w + 40, 0], [0, -h / 2, w + 40, 0], [-w / 2, 0, h + 40, 90], [w / 2, 0, h + 40, 90]].forEach(function (q, n) {
        var e = fxImg(t, 'Glow' + n, q[2], 30, gm); e.transform.localPosition = H.V3(q[0], q[1]); e.transform.localEulerAngles = H.V3(0, 0, q[3]); G.e.push(e);
      });
      G.run = fxImg(t, 'Run', 90, 22, gm); G.per = 2 * (w + h);
      LF.glows.push(G);
    });
    // data packets on the rules (Terminal DataLine): three bright streaks each on the master, stat and bottom rules
    [[72, 160, 2416], [72, 1414, 2416], [2028, 610, 440]].forEach(function (r, n) {
      for (var q = 0; q < 3; q++) LF.packets.push({ im: fxImg(V.root, 'Pkt' + n + q, 120, 18, gm), x: r[0], y: r[1], w: r[2], ph: q / 3 + n * 0.17, sp: 0.06 + 0.02 * n });
    });
    // the chosen slot's sparkle, and a soft core bloom (LightFx stars and bloom)
    LF.spark = fxImg(V.dial, 'Spark', 200, 200, LF.sm);
    LF.title0 = null; LF.glitchAt = 0;
  }
  // a point round a frame's perimeter (local to the frame), clockwise from the top left
  function perim(G, s) {
    var w = G.w, h = G.h; s = ((s % G.per) + G.per) % G.per;
    if (s < w) return [s - w / 2, h / 2, 0]; s -= w;
    if (s < h) return [w / 2, h / 2 - s, 90]; s -= h;
    if (s < w) return [w / 2 - s, -h / 2, 0]; s -= w;
    return [-w / 2, -h / 2 + s, 90];
  }

  var base = D.art.baseLife || D.art;
  D.art = function (w, B) {
    base(w, B);
    try { life(w, B); } catch (e) { if (!LF.err) { LF.err = 1; D.log.push('life EXC ' + e); } }
  };
  D.art.baseLife = base;

  function life(w, B) {
    if (!V.root || V.root.Equals(null)) return;
    if (LF.root !== V.root) build();
    var t = D.t, fr = D.fr, oF = t - (V.openAt || 0);
    var mode = D.preview || (w.grimTab ? 104 : w.endlessTab ? 105 : w.CurBattleMode), P = PAL[mode] || PAL[1];
    // the palette blends toward the mode's over about 31 frames
    if (!LF.a) { LF.a = P.a.slice(); LF.b = P.b.slice(); }
    var k = 1 - Math.pow(1 - 0.1, D.dt || 1); LF.a = mix(LF.a, P.a, k); LF.b = mix(LF.b, P.b, k);
    var A = LF.a, Bc = LF.b, breathe = 0.5 + 0.5 * Math.sin(t / 50);
    var ev = Math.max(fr.rF < 24 ? 1 - fr.rF / 24 : 0, fr.shF != null && fr.shF < 36 ? 1 - fr.shF / 36 : 0, oF < 60 ? 1 - oF / 60 : 0);
    // round 4 (frame time): with pop_v4 loaded it sets these colours and materials itself every frame, so life skips them
    var popOwns = !!(D.V4P && D.V4P.root === V.root);
    // colour: lines, outlines and rules take the accent; dim labels lean toward it
    for (var i = 0; i < LF.tint.length && !popOwns; i++) { var T = LF.tint[i]; if (!T.im || T.im.Equals(null)) continue; T.im.color = col(mix(LINE, A, 0.45), T.a); }
    for (var j = 0; j < LF.dimT.length && !popOwns; j++) { var tm = LF.dimT[j]; if (!tm || tm.Equals(null)) continue; tm.color = col(mix(DIM, A, 0.35), tm.color.a); }
    // the room takes the palette
    var L = D.LV4, scrW = 1440 * UE.Screen.width / Math.max(1, UE.Screen.height);
    if (L && L.room && (LF.roomChk == null || t - LF.roomChk > 30 || t < LF.roomChk) && (LF.roomChk = t) && Math.abs(L.room.transform.sizeDelta.x - scrW) > 1) { L.room.transform.sizeDelta = H.V2(Math.max(2560, scrW), 1440); var MS = D.MS; if (MS && MS.base) MS.base.transform.sizeDelta = H.V2(Math.max(2700, scrW + 40), 1560); }
    var rk2 = A.join(',') + Bc.join(',');   // round 4: the room's colours only when the palette moves
    if (L && L.roomMat && LF.roomKey !== rk2) { LF.roomKey = rk2; L.roomMat.SetColor('_Cyan', col(A, 1)); L.roomMat.SetColor('_Rose', col(Bc, 1)); L.roomMat.SetColor('_MoteColor', col(mix(A, [1, 1, 1], 0.4), 1)); }
    // glows: each frame's edges breathe with a wave that runs across the screen; a runner circles each frame
    for (var g = 0; g < LF.glows.length && !popOwns; g++) {
      var G = LF.glows[g]; if (!G.p || G.p.Equals(null) || !G.p.gameObject.activeInHierarchy) continue;
      var x0 = G.p.transform.position.x, wave = 0.5 + 0.5 * Math.sin(t / 30 - x0 * 0.6 + g);
      for (var e = 0; e < 4; e++) G.e[e].color = col(A, 0);
      var pp = perim(G, t * 6 + g * 211); G.run.transform.localPosition = H.V3(pp[0], pp[1]); G.run.transform.localEulerAngles = H.V3(0, 0, pp[2]);
      G.run.color = col(A, 0);
    }
    // data packets along the rules
    for (var p = 0; p < LF.packets.length; p++) {
      var Pk = LF.packets[p], u = ((t / 60) * Pk.sp + Pk.ph) % 1;
      Pk.im.transform.localPosition = H.V3(Pk.x + Pk.w * u - 1280, 720 - Pk.y);
      Pk.im.color = col(mix(A, [1, 1, 1], 0.4), Math.sin(Math.PI * u) * 0.9 * cl(oF / 30));
    }
    // the Plate shader's own glow (the Unity build, 2026-11-05): every plate gets a glow margin, the mode's accent, an
    // event pulse and its runner; the image grows by the pad round the shape dial_v4 sized it to (re-read each frame,
    // since dial_v4 resizes tabs and slots)
    if (!LF.plates || LF.platesRoot !== V.root) {
      LF.platesRoot = V.root; LF.plates = [];
      var all = V.root.GetComponentsInChildren(TY(UE.UI.Image), true);
      for (var a2 = 0; a2 < all.Length; a2++) { var im2 = all.get_Item(a2), m2 = im2.material; if (m2 && !m2.Equals(null) && m2.shader && m2.shader.name === 'EntropyDial/Plate') LF.plates.push({ im: im2, m: m2 }); }
    }
    var PAD = 16, glowA = 0.14 + 0.05 * breathe + 0.2 * ev;   // in game at 0.32-0.9 it hurt to look at (the lead)
    var mi2 = Math.max(0, [1, 2, 4, 104, 105].indexOf(mode)), rowNow = fr.rows && fr.rows[fr.selIdx];
    LF.active = [V.core, V.tabs[mi2] && V.tabs[mi2].p, V.slots && V.slots[fr.selIdx] && V.slots[fr.selIdx].p,
      rowNow && rowNow.lv > 0 && V.rows[rowNow.lv - 1] && V.rows[rowNow.lv - 1].p, rowNow && rowNow.lv < rowNow.max ? V.plus : null].filter(function (x) { return !!x; });
    for (var q3 = 0; q3 < LF.plates.length && !popOwns; q3++) {
      var PL = LF.plates[q3]; if (!PL.im || PL.im.Equals(null) || !PL.im.gameObject.activeInHierarchy) continue;
      var sd = PL.im.transform.sizeDelta;
      if (PL.padW !== sd.x || PL.padH !== sd.y) {   // dial_v4 set a new shape size: keep it as the shape, add the pad
        PL.m.SetVector('_Size', new UE.Vector4(sd.x, sd.y, 0, 0)); PL.m.SetFloat('_Pad', PAD);
        PL.im.transform.sizeDelta = H.V2(sd.x + 2 * PAD, sd.y + 2 * PAD); PL.padW = sd.x + 2 * PAD; PL.padH = sd.y + 2 * PAD;
      }
      // only what is active glows: the chosen tab, the chosen slot, the current rank row, the core, an available plus
      var on = LF.active.indexOf(PL.im) >= 0;
      PL.m.SetColor('_Accent', col(A, 1)); PL.m.SetFloat('_AccentMix', on ? 0.75 : 0.4);
      PL.m.SetColor('_Glow', col(A, on ? glowA : 0)); PL.m.SetFloat('_GlowW', 12); PL.m.SetFloat('_EdgeGlow', on ? 0.25 + 0.15 * breathe : 0);
      PL.m.SetFloat('_Pulse', on ? ev : 0); PL.m.SetFloat('_Run', on ? 1 : 0); PL.m.SetFloat('_RunSpeed', 120); PL.m.SetFloat('_RunPhase', q3 * 97);
    }
    // the gauge: a pulse travels along the lit arc; the unlit track breathes faintly
    var lit = cl((D.totShown || 0) / Math.max(1, V.scale || 200));
    for (var s = 0; s < V.gseg.length && !popOwns; s++) {
      var sv = (s + 0.5) / V.gseg.length, on = sv <= lit, pulse = 0.5 + 0.5 * Math.sin(t / 7 - s * 0.35);
      V.gseg[s].color = on ? col(mix(A, [1, 1, 1], 0.25 * pulse), 0.65 + 0.35 * pulse) : col(mix(LINE, A, 0.3), 0.12 + 0.06 * breathe);
    }
    // perks: reached ones glow softly, the next one pulses
    var tot = D.totTo || 0, nextAt = Infinity;
    (V.perkNodes || []).forEach(function (N) { var v = +N.t.text; if (v > tot && v < nextAt) nextAt = v; });
    (popOwns ? [] : (V.perkNodes || [])).forEach(function (N, n) {
      if (!N.t.gameObject.activeSelf) return; var v = +N.t.text, s2 = 1;
      if (v === nextAt) { s2 = 1 + 0.12 * Math.sin(t / 6); N.t.color = col(mix(A, [1, 1, 1], 0.3), 1); }
      else if (v <= tot) N.t.color = col(mix(TEXT, A, 0.4), 0.85 + 0.15 * Math.sin(t / 25 + n));
      N.p.transform.localScale = H.S3(s2, s2);
    });
    // brackets breathe round the chosen slot; the slot sparkles
    (V.brk || []).forEach(function (bk) { bk.color = col(mix([0.31, 0.86, 0.94], A, 0.3), 0.75 + 0.25 * Math.sin(t / 10)); });
    var sel = V.slots && V.slots[fr.selIdx];
    if (sel && LF.spark) { var sp = sel.t.localPosition; LF.spark.transform.localPosition = H.V3(sp.x - 34, sp.y + 34); LF.spark.color = col(mix(A, [1, 1, 1], 0.5), 0.55 + 0.45 * ev); }
    // the slots bob a little, each on its own phase (the chosen one holds still)
    (V.slots || []).forEach(function (S, n) {
      if (n >= (fr.rows || []).length || n === fr.selIdx || S.bx == null) return;   // round 4: from dial_v4's base position
      var r = Math.sqrt(S.bx * S.bx + S.by * S.by) || 1, d = 3 * Math.sin(t / 20 + n * 0.7);
      S.t.localPosition = H.V3(S.bx * (r + d) / r, S.by * (r + d) / r); S.__px = null;
    });
    // the memory column ripples down
    (popOwns ? [] : (V.memBlocks || [])).forEach(function (Bk, n) { if (Bk.gameObject.activeSelf) Bk.color = col(mix(LINE, A, 0.5), Math.min(1, Bk.color.a * (0.85 + 0.15 * Math.sin(t / 9 - n * 0.6)))); });
    // the panels drift a few pixels
    if (V.card) V.card.localPosition = H.V3(V.card.localPosition.x + 2 * Math.sin(t / 90), 2 * Math.sin(t / 70));
    if (V.right) V.right.localPosition = H.V3(V.right.localPosition.x - 2 * Math.sin(t / 85), 2 * Math.sin(t / 75 + 1));
    // rings turn
    if (V.bus) { V.bus.transform.localEulerAngles = H.V3(0, 0, -t * 0.15); if (!popOwns) V.bus.color = col(mix(LINE, A, 0.6), 0.22 + 0.1 * breathe); }
    if (V.coreRing && !popOwns) V.coreRing.color = col(mix(LINE, A, 0.7), 0.35 + 0.15 * breathe);
    if (V.core && !V.core.__m) V.core.color = col(mix([0.039, 0.051, 0.078], A, 0.12 + 0.1 * ev), 0.85);
    // text: the title shimmers (a bright band runs through it) with an accent ghost that slips sideways; the total and the
    // headers take the accent; one label re-decodes now and then
    var title = V.last && V.last.title;
    if (title && (V.title.__plain === title || V.title.text === title)) {   // __plain: the decode finished on this title (dial_v4)
      var n2 = title.length, pos = ((t * 0.35) % (n2 + 12)) - 6, out = '', pk = Math.round(pos * 2);
      if (LF.shimKey === pk + title && V.title.text === LF.shimOut) { pos = null; } else LF.shimKey = pk + title;
      for (var c = 0; c < n2 && pos != null; c++) { var dd = Math.abs(c - pos); out += dd < 2.5 ? '<color=' + hex(mix(TEXT, [1, 1, 1], 1), 1) + '>' + title[c] + '</color>' : title[c]; }
      if (pos != null) { V.title.text = out; LF.shimOut = out; } V.title.color = col(mix(TEXT, A, 0.12), V.title.color.a);
    }
    var slip = 3 + 2 * Math.sin(t / 13) + (Math.random() < 0.02 ? 8 : 0);
    V.titleG.text = title || V.titleG.text; V.titleG.color = col(A, 0.35 * V.title.color.a);
    V.titleG.transform.localPosition = H.V3(V.title.transform.localPosition.x + slip, V.title.transform.localPosition.y - 2);
    V.total.color = col(mix(TEXT, A, 0.15 + 0.25 * ev), V.total.color.a);
    V.under.color = col(A, 1); V.under.transform.localScale = H.S3(1 + 0.04 * Math.sin(t / 12), 1 + 0.3 * breathe);
    if (fr.shF != null && fr.shF < 2 && t > LF.glitchAt) {   // round 5 (item 6): only on a mode change, never at rest
      LF.glitchAt = t + 30;
      var pool = [V.idName, V.mbarT, V.statHT, V.trH, V.mutH, V.storeL, V.nextL, V.headL, V.powL, V.oL, V.tL].filter(function (q) { return q && q.gameObject.activeInHierarchy; });
      var pick = pool[Math.floor(Math.random() * pool.length)]; if (pick) LF.gl = { tm: pick, txt: pick.text.replace(/<[^>]*>/g, ''), at: t };
    }
    if (LF.gl) {
      var gk = (t - LF.gl.at) / 12, G2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/+<>#';
      if (gk >= 1) { LF.gl.tm.text = LF.gl.txt; LF.gl = null; }
      else { var nn = LF.gl.txt.length, shown = Math.floor(nn * gk), s3 = LF.gl.txt.slice(0, shown); for (var q2 = shown; q2 < nn; q2++) s3 += LF.gl.txt[q2] === ' ' ? ' ' : G2[Math.floor(Math.random() * G2.length)]; LF.gl.tm.text = s3; }
    }
  }
  return 'life on: ' + (glowMat() ? 'glow' : 'no glow material');
})();
  }]);

  // ---- pop_v4.js ----
  layers.push(['pop_v4.js', function () {
// Entropy Dial v4: the pop pass (2026-11-05). The lead: "too glowy everywhere stuff that isnt active should not glow also
// glow is too much it hurts to look at it needs real time vfx ... it feels to flat". Built from inspo\TASTE_CRITIQUE.md
// and inspo\REALTIME_VFX.md (no hologram heart: he rejected any literal heart).
// A layer over dial_v4.js and life_v4.js: it never builds the screen, it runs after both each frame and
//  1. spends a light budget: one L3 (the chosen slot), three L2 (the core, the active tab, the current rank row); every
//     other plate recedes (45 % saturation, dark fill, 0.5 alpha line, no glow); glow eases in 5 f, out 9 f; ED.V4G scales
//     every glow (default 1);
//  2. sets the value structure: a near-black room (its material darkened) under a vignette, neutral glass panels, the
//     core the one thing above 0.85;
//  3. makes the core the hero: lit from inside (a bloom behind it and a faint one inside), breathing in the mode hue; near
//     the limit it strains (amber rim, a 1-2 px jitter, flickering light cracks); a total change fires a pulse ring;
//  4. turns selection into an event: a mode change sends a recolour wipe out of the chosen tab while the palette swaps
//     under it; slots spring to and from their chosen size (8 % overshoot, about 12 f);
//  5. springs and staggers the entrance (slots clockwise, panel parts top to bottom), with a squash before a rank up;
//  6. adds depth: three parallax layers and data motes in three depth groups, a 12-square burst on focus and rank up;
//  7. adds atmosphere: soft light shafts from the top, scanlines and a moving grain at 3-5 %;
//  8. sets the type to four sizes (24, 36, 72, 198), one frame style (hairline + corner brackets on the outer frames only,
//     no outlines on the bands inside them) and a 36 px status strip for the foot.
// Load after life_v4.js (load_v4.js does). Errors land in ED.log as 'pop EXC'.
(function () {
  var D = globalThis.ED; if (!D || !D.V4 || !D.V4L || !D.MH) return 'load life_v4.js first';
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, H = D.MH, V = D.V4, LF = D.V4L;
  var P = D.V4P = { root: null };
  if (D.V4G == null) D.V4G = 1;
  var GREY = [0.62, 0.65, 0.70], DIM = [0.553, 0.592, 0.663], TEXT = [0.914, 0.933, 0.965], W = [1, 1, 1];
  // the strain signal (round 3, review M1): signal lime, a hue no difficulty palette uses (ice, cyan, amber, rose, violet), so
  // the warning reads in every mode, Extreme's amber included; it always comes with a shape and motion cue (the hazard ring,
  // the jitter and cracks of the core) and a state word
  var STRAIN = [0.74, 1.0, 0.22];
  var MODES = [1, 2, 4, 104, 105];
  function cl(k) { return Math.max(0, Math.min(1, k)); }
  function mix(a, b, k) { k = cl(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function col(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? 1 : a); }
  function desat(c, k) { var l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return mix(c, [l, l, l], k); }
  function ss(k) { k = cl(k); return k * k * (3 - 2 * k); }
  // a damped spring from 0 to 1 over k = 0..1 (about 8 % overshoot at k 0.39)
  function spr(k) { if (k <= 0) return 0; if (k >= 1) return 1; return 1 - Math.exp(-6 * k) * Math.cos(8 * k); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ---- round 4: write a value only when it changes (a material property or an Image / text colour); the last value is
  // kept on the JS wrapper of the object. Only objects that no other layer writes every frame use these. ----
  function sF(m, k, v) { var c = m.__pc || (m.__pc = {}); if (c[k] === v) return; c[k] = v; m.SetFloat(k, v); }
  function near4(o, c, a) { return o && Math.abs(o[0] - c[0]) < 0.002 && Math.abs(o[1] - c[1]) < 0.002 && Math.abs(o[2] - c[2]) < 0.002 && Math.abs(o[3] - a) < 0.002; }
  function sC(m, k, c, a) { if (a == null) a = 1; var cc = m.__pc || (m.__pc = {}); if (near4(cc[k], c, a)) return; cc[k] = [c[0], c[1], c[2], a]; m.SetColor(k, col(c, a)); }
  function sV(m, k, x, y) { var cc = m.__pc || (m.__pc = {}), o = cc[k]; if (o && o[0] === x && o[1] === y) return; cc[k] = [x, y]; m.SetVector(k, new UE.Vector4(x, y, 0, 0)); }
  function act(go, on) { if (go.__on === on) return; go.__on = on; go.SetActive(on); }   // round 4: SetActive only on a change
  function perkVals() { return ((V.perkCache && V.perkCache.out) || []).map(function (p) { return p.at; }); }   // dial_v4's cached table
  function iC(im, c, a) { if (a == null) a = 1; if (near4(im.__ic, c, a)) return; im.__ic = [c[0], c[1], c[2], a]; im.color = col(c, a); }

  // ---- textures made once per game session (generated, no files) ----
  var TX = globalThis.__POPTX2 = globalThis.__POPTX2 || {};
  function tex(n, m, fn, point) {
    var t = new UE.Texture2D(n, m, UE.TextureFormat.RGBA32, false), px = cs.System.Array.CreateInstance(TY(UE.Color32), n * m);
    for (var y = 0; y < m; y++) for (var x = 0; x < n; x++) { var c = fn((x + 0.5) / n * 2 - 1, (y + 0.5) / m * 2 - 1, x, y); px.set_Item(y * n + x, new UE.Color32(Math.round(255 * cl(c[0])), Math.round(255 * cl(c[1])), Math.round(255 * cl(c[2])), Math.round(255 * cl(c[3])))); }
    t.SetPixels32(px); t.Apply(); t.filterMode = point ? 0 : 1; t.wrapMode = 0;
    return t;
  }
  function spriteOf(t) { return UE.Sprite.Create(t, new UE.Rect(0, 0, t.width, t.height), H.V2(0.5, 0.5), 100); }
  function textures() {
    if (TX.ok) return;
    // the pulse ring: a soft wavefront with a fading trail inside it
    TX.ring = spriteOf(tex(256, 256, function (x, y) { var r = Math.hypot(x, y), a = Math.exp(-Math.pow((r - 0.93) / 0.03, 2)) + (r < 0.93 ? 0.3 * Math.exp(-(0.93 - r) / 0.1) : 0); return [1, 1, 1, r > 1 ? 0 : a]; }));
    TX.disc = spriteOf(tex(128, 128, function (x, y) { var r = Math.hypot(x, y); return [1, 1, 1, cl((1 - r) / 0.25)]; }));
    TX.vig = spriteOf(tex(128, 128, function (x, y) { var r = Math.hypot(x, y); return [0, 0, 0, 0.92 * Math.pow(cl((r - 0.42) / 0.9), 1.5)]; }));
    TX.scan = tex(2, 2, function (x, y, i, j) { return [0, 0, 0, j === 0 ? 1 : 0]; }, true); TX.scan.wrapMode = 0;   // round 5 (item 14): a 2 px period
    TX.grain = tex(128, 128, function () { return [0, 0, 0, Math.random()]; }, true); TX.grain.wrapMode = 0;
    TX.ok = true;
  }
  function lightFx(props) {
    var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)), b = null;
    for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === 'ED_LightFx') b = all.get_Item(i);
    if (!b) return null; var m = new UE.Material(b); for (var k in props) m.SetFloat(k, props[k]); return m;
  }
  function img(parent, name, w, h, sprite, c, a) {
    var im = H.img(parent, name, w, h, null, c || W, a == null ? 0 : a); if (sprite) im.sprite = sprite; P.made.push(im.gameObject); return im;
  }
  function fx(parent, name, w, h, mat) { var im = img(parent, name, w, h, null, W, 0); im.material = mat; return im; }
  function raw(parent, name, w, h, texr, c, a) {
    var t = H.node(parent, name); t.sizeDelta = H.V2(w, h); P.made.push(t.gameObject);
    var ri = t.gameObject.AddComponent(TY(UE.UI.RawImage)); ri.raycastTarget = false; ri.texture = texr; ri.color = col(c || W, a == null ? 1 : a); return ri;
  }
  function find(t, name) { var c = t && t.Find('EDM' + name); return c ? c.GetComponent(TY(UE.UI.Image)) : null; }

  // ---- build ----
  function build() {
    navUnlisten(); P.navG = null; P.navFoc = null; P.dir = null;
    for (var g of (P.made || [])) try { UE.Object.Destroy(g); } catch (x) {}
    textures();
    P.made = []; P.root = V.root; P.st = new Map(); P.role = new Map(); P.plates = []; P.scanAt = -99;
    P.ss = []; P.rings = []; P.bursts = []; P.motes = []; P.cracks = []; P.kick = 0; P.px = 0; P.py = 0;
    P.mode = null; P.sel = null; P.tot = null; P.rF = 99; P.wipeAt = null; P.antic = 0; P.stagDone = false;
    var scrW = Math.max(2560, 1440 * UE.Screen.width / Math.max(1, UE.Screen.height));
    // the back layer, behind every panel: vignette, light shafts, motes
    var back = P.back = H.node(V.root, 'PopBack'); back.SetSiblingIndex(0); P.made.push(back.gameObject);
    P.under = img(back, 'Under', scrW + 40, 1480, null, [0, 0, 0], 0.72);
    P.vig = img(back, 'Vig', scrW * 1.08, 1560, TX.vig, W, 1);
    P.shaftM = lightFx({ _Mode: 0, _Thin: 1, _Core: 0, _Halo: 2.2 });
    P.shafts = [[-520, -82, 1500, 360], [80, -92, 1700, 300], [700, -101, 1500, 380]].map(function (q, i) {
      var s = fx(back, 'Shaft' + i, q[2], q[3], P.shaftM); s.transform.localPosition = H.V3(q[0], 760 - q[2] * 0.42); s.transform.localEulerAngles = H.V3(0, 0, q[1]);
      return { im: s, x: q[0], a: q[1], y: 760 - q[2] * 0.42, ph: i * 2.1 };
    });
    P.moteM = lightFx({ _Mode: 3, _Core: 1.2, _Halo: 0.25 });
    var GR = [{ n: 12, s: 10, a: 0.4, v: 0.10, f: 0.4 }, { n: 10, s: 16, a: 0.55, v: 0.22, f: 1 }, { n: 8, s: 26, a: 0.7, v: 0.4, f: 1.8 }];
    GR.forEach(function (G, gi) {
      for (var i = 0; i < G.n; i++) {
        var m = fx(back, 'Mote' + gi + '_' + i, G.s, G.s, P.moteM);
        P.motes.push({ im: m, x: rnd(-scrW / 2, scrW / 2), y: rnd(-760, 760), G: G, ph: rnd(0, 6.28) });
      }
    });
    // the dial: blooms behind and inside the core, cracks, pulse rings, the burst
    var ci = V.core.transform.GetSiblingIndex();
    P.bloomM = lightFx({ _Mode: 3, _Core: 0.35, _Halo: 0.55 });
    P.bloom = fx(V.dial, 'CoreBloom', 1150, 1150, P.bloomM); P.bloom.transform.SetSiblingIndex(ci);
    P.innerM = lightFx({ _Mode: 3, _Core: 0.25, _Halo: 0.6 });
    P.inner = fx(V.dial, 'CoreInner', 520, 560, P.innerM); P.inner.transform.SetSiblingIndex(V.core.transform.GetSiblingIndex() + 1);
    P.crackM = lightFx({ _Mode: 0, _Thin: 12, _Core: 3, _Halo: 0.3 });
    for (var c = 0; c < 8; c++) { var ck = fx(V.dial, 'Crack' + c, 200, 18, P.crackM); P.cracks.push({ im: ck, until: 0, a: 0 }); }
    for (var r = 0; r < 3; r++) { var ri = img(V.dial, 'Pulse' + r, 10, 10, TX.ring, W, 0); ri.transform.SetSiblingIndex(V.slotHost.GetSiblingIndex() + 1); P.rings.push({ im: ri, at: null }); }
    for (var b = 0; b < 12; b++) { var bi = img(V.dial, 'Burst' + b, 8, 8, null, W, 0); P.bursts.push({ im: bi, at: null }); }
    P.coreBase = { core: V.core.transform.localPosition, ring: V.coreRing.transform.localPosition, total: V.total.transform.localPosition, lim: V.limitT.transform.localPosition };
    P.dialBase = V.dial.localPosition;
    // the top layer: the recolour wipe, scanlines, grain
    var top = P.top = H.node(V.root, 'PopTop'); top.SetAsLastSibling(); P.made.push(top.gameObject);
    P.wipeDisc = img(top, 'WipeDisc', 10, 10, TX.disc, W, 0); P.wipeRing = img(top, 'WipeRing', 10, 10, TX.ring, W, 0);
    P.scan = raw(top, 'Scan', scrW, 1440, TX.scan, W, 0.035); P.scan.uvRect = new UE.Rect(0, 0, scrW / 2, 1440 / 2);
    P.grain = raw(top, 'Grain', scrW, 1440, TX.grain, W, 0.08);
    P.scrW = scrW;
    // the room: near black, its own lights turned down (the material is ours: light_v4 made the instance)
    var L = D.LV4;
    if (L && L.roomMat) {
      var rm = L.roomMat;
      sC(rm, '_Hall', [0.006, 0.007, 0.011]); sC(rm, '_HallFloor', [0.003, 0.004, 0.007]);
      [['_HexI', 0.16], ['_HorizonI', 0.16], ['_GlowI', 0.1], ['_MoteI', 0.2], ['_SweepI', 0.12], ['_ScanBandI', 0.008], ['_Rain', 0], ['_PanelDim', 0.08], ['_HorizonBlack', 0.8]].forEach(function (q) { sF(rm, q[0], q[1]); });
    }
    type(); frames(); buildR2(); buildR3(); buildR5();
    // round 4: what dial_v4 writes every frame (pop writes these directly, never through the colour cache)
    P.dialImg = new Set((V.slots || []).map(function (S) { return S.w; }));
    P.dynT = new Set([V.limitT, V.state, V.footA, V.footB, V.total, V.label, V.nextV, V.powV, V.cardText, V.bufT, V.storeV, V.idMode, V.title, V.titleG, V.cardMeta, V.o1, V.o2, V.t1, V.t2]
      .concat(V.tabs.map(function (T) { return T.t; })).concat(V.rows.map(function (R) { return R.l; })).concat(V.rows.map(function (R) { return R.e; }))
      .concat(V.rows.map(function (R) { return R.c; })).concat((V.slots || []).map(function (S) { return S.f; })).concat((V.perkNodes || []).map(function (N) { return N.t; })));
    // the panel parts that stagger in (dial_v4 moves the rail mark, memory blocks and mutation chips each frame: not those)
    P.stag = [];
    var skip = new Set([V.railMark].concat(V.muts || []).concat(V.memBlocks || []));
    var mine = new Set(P.made);   // round 5: pieces pop places itself every frame are not staggered (the stagger would reset them)
    [[V.card, -1], [V.right, 1]].forEach(function (q) {
      for (var i = 0; i < q[0].childCount; i++) {
        var ch = q[0].GetChild(i), im = ch.GetComponent(TY(UE.UI.Image));
        if (im && skip.has(im)) continue; if (mine.has(ch.gameObject)) continue;
        P.stag.push({ t: ch, b: ch.localPosition, side: q[1] });
      }
    });
  }

  // ---- type: four sizes at 1.5x or more (24, 36, 72, 198); tracked capitals only on the tabs ----
  function type() {
    var T4 = 24, T3 = 36, T2 = 72, T1 = 198;
    function set(tm, fs, sp) { if (!tm || tm.Equals(null)) return; tm.fontSize = fs; if (sp != null) tm.characterSpacing = sp; }
    [V.idMode, V.lbT, V.rbT, V.state, V.nextL, V.cardMeta, V.headL, V.powL, V.bufT, V.storeL, V.storeV, V.oL, V.tL].forEach(function (tm) { set(tm, T4, 0); });
    V.tabs.forEach(function (T) { set(T.t, T4, 6); });
    // a long rank text (some modifiers spell the whole effect per rank) ends in an ellipsis before the bar, not under it
    V.rows.forEach(function (R) { set(R.l, T4); set(R.e, T4); set(R.c, T4); R.e.overflowMode = 1; });
    V.ruleRows.forEach(function (R) { set(R.t, T4); });
    V.slots.forEach(function (S) { set(S.f, T4); });
    (V.perkNodes || []).forEach(function (N) { set(N.t, T4); });
    [V.idName, V.mbarT, V.statHT, V.trH, V.mutH, V.cardText, V.o1, V.o2, V.t1, V.t2, V.nextV, V.limitT, V.minusT, V.plusT].forEach(function (tm) { set(tm, T3, 0); });
    set(V.idName, T3, 3); set(V.label, T4, 2);   // the node label sits between the core tip and the slot ring: T4 fits there
    V.label.transform.sizeDelta = H.V2(300, 30); V.label.enableAutoSizing = true; V.label.fontSizeMin = 16; V.label.fontSizeMax = T4;
    set(V.title, T2, 3); set(V.titleG, T2, 3); set(V.powV, T2, 0); set(V.total, T1, 0);
    // a long card sentence (Grim's named effects) shrinks to fit its band instead of running over HEADROOM (round 3)
    V.cardText.enableAutoSizing = true; V.cardText.fontSizeMin = T4; V.cardText.fontSizeMax = T3;
    // the foot: a 36 px status strip over the bottom rule
    var y = 1368, ly = 720 - y;
    V.foot.transform.sizeDelta = H.V2(2416, 36); V.foot.transform.localPosition = H.V3(0, ly);
    var fb = find(V.root, 'FootBlock'); if (fb) { fb.transform.sizeDelta = H.V2(6, 36); fb.transform.localPosition = H.V3(75 - 1280, ly); }
    if (V.footHex) V.footHex.gameObject.SetActive(false);
    set(V.footA, T4, 3); V.footA.transform.sizeDelta = H.V2(420, 36); V.footA.transform.localPosition = H.V3(100 + 210 - 1280, ly);
    set(V.footB, T4, 0); V.footB.transform.sizeDelta = H.V2(900, 36); V.footB.transform.localPosition = H.V3(540 + 450 - 1280, ly);
  }
  // ---- one frame style: the outer frames get a hairline and corner brackets, the bands inside them no outline ----
  function frames() {
    var cf = find(V.card, 'CardFrame');
    // round 2: the foot strip freed the band above it, so the card, the memory column and the status block all run down to
    // y 1288 (the mutations get two rows and a label line; the three columns end on one line)
    if (cf) { cf.transform.sizeDelta = H.V2(600, 992); cf.transform.localPosition = H.V3(372 - 1280, 720 - 792); }
    V.stat.transform.sizeDelta = H.V2(480, 916); V.stat.transform.localPosition = H.V3(2008 + 240 - 1280, 720 - 830);
    V.mem.transform.sizeDelta = H.V2(100, 916); V.mem.transform.localPosition = H.V3(1888 + 50 - 1280, 720 - 830);
    var outer = [cf, V.store, V.stat, V.mem, V.foot], inner = [V.cardTop, V.head, V.pow, V.mbar, V.statH].concat(V.ruleRows.map(function (R) { return R.p; }));
    outer.forEach(function (p) {
      if (!p || !p.__m) return; var m = p.__m; P.role.set(p, 'outer');
      sF(m, '_Bracket', 1); sF(m, '_BracketLen', 18); sF(m, '_BracketW', 2); sF(m, '_LineW', 1.5);
      sC(m, '_Fill', [0.008, 0.009, 0.012], 0.92); sF(m, '_Weave', 0.2); sF(m, '_Rim', 0.25);
    });
    inner.forEach(function (p) {
      if (!p || !p.__m) return; var m = p.__m; P.role.set(p, 'inner');
      sF(m, '_Bracket', 0); sC(m, '_Fill', [0.03, 0.033, 0.04], 0.5); sF(m, '_Weave', 0.1); sF(m, '_Rim', 0.2);
    });
  }

  // every Plate under the dial (rescanned: slots and perk nodes are added after the first frame); new ones go to life's
  // list too, so life gives them their glow pad
  function scan() {
    var all = V.root.GetComponentsInChildren(TY(UE.UI.Image), true), list = [], known = new Set((LF.plates || []).map(function (q) { return q.im; }));
    for (var i = 0; i < all.Length; i++) {
      var im = all.get_Item(i), m = im.material;
      if (m && !m.Equals(null) && m.shader && m.shader.name === 'EntropyDial/Plate') { list.push({ im: im, m: m }); if (LF.plates && !known.has(im)) LF.plates.push({ im: im, m: m }); }
    }
    P.plates = list;
  }

  var base = D.art.basePop || D.art;
  D.art = function (w, B) {
    base(w, B);
    try { pop(w, B); } catch (e) { if (!P.err) { P.err = 1; D.log.push('pop EXC ' + e + ' ' + (e.stack || '').split('\n')[1]); } }
  };
  D.art.basePop = base;

  function pop(w, B) {
    if (!V.root || V.root.Equals(null) || !LF.a) return;
    if (P.root !== V.root) build();
    var t = D.t, dt = D.dt || 1, fr = D.fr, oF = t - (V.openAt || 0), G = D.V4G == null ? 1 : D.V4G;
    var mode = D.preview || (w.grimTab ? 104 : w.endlessTab ? 105 : w.CurBattleMode), mi = Math.max(0, MODES.indexOf(mode));
    var rows = fr.rows || [], n = rows.length, selRow = rows[fr.selIdx];
    // events
    var first = P.mode == null;
    if (!first && P.mode !== mode) { P.wipeAt = t; P.wipeFrom = { a: LF.a.slice(), b: LF.b.slice() }; P.wipeO = [V.tabs[mi].x + 126 - 1280, 720 - 101]; }
    P.mode = mode;
    var tot = D.totTo || 0;
    if (P.tot != null && P.tot !== tot) fireRing(t);
    P.tot = tot;
    var rankNow = fr.rF < P.rF; P.rF = fr.rF;
    if (rankNow) { fireRing(t); P.antic = 2; fireBurst(t); }
    if (P.sel != null && P.sel !== fr.selIdx && n) { var dl = fr.selIdx - P.sel; dl -= Math.round(dl / n) * n; P.kick = dl > 0 ? 1 : -1; fireBurst(t + 4); }
    P.sel = fr.selIdx;
    // the wipe sets the palette under it: the accents follow the wavefront, life keeps blending after it
    var wk = P.wipeAt == null ? 1 : (t - P.wipeAt) / 18, PAL = LF.PAL || {}, Pt = PAL[mode] || { a: LF.a, b: LF.b };
    if (wk < 1) { var e = ss(wk); LF.a = mix(P.wipeFrom.a, Pt.a, e); LF.b = mix(P.wipeFrom.b, Pt.b, e); }
    var A = LF.a, Bc = LF.b, Ad = desat(A, 0.55);
    P.akey = A[0].toFixed(3) + A[1].toFixed(3) + A[2].toFixed(3) + (D.V4G == null ? 1 : D.V4G);
    // the limit
    var lm = /(\d+)/.exec((D.B && D.B.limit && D.B.limit.text) || ''), limit = lm ? +lm[1] : 0, head = limit ? limit - tot : 99;
    var strain = !!(D.v4near || D.v4over || fr.over || (limit && head <= Math.max(1, Math.round(limit * 0.05))));
    P.sk = (P.sk || 0) + ((strain ? 1 : 0) - (P.sk || 0)) * cl(dt / 10); var sk = P.sk;
    var ev = Math.max(fr.rF < 24 ? 1 - fr.rF / 24 : 0, fr.shF != null && fr.shF < 36 ? 1 - fr.shF / 36 : 0);
    var breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / (strain ? 120 : 240));   // 0.25 Hz at rest, 0.5 Hz under strain

    try { tickNav(w, t); } catch (x) { if (!P.navErr) { P.navErr = 1; D.log.push('pop nav EXC ' + x); } }
    var NF = P.navFoc || { k: 'none' }, onRow = NF.k === 'row';
    // ---- 1. the light budget ----
    if (t - P.scanAt > 20) { P.scanAt = t; scan(); (V.slots || []).forEach(function (S) { P.dialImg.add(S.w); P.dynT.add(S.f); act(S.f.gameObject, false); /* the slots carry no rank fraction (the approved look) */ }); (V.perkNodes || []).forEach(function (N) { P.dynT.add(N.t); }); }
    var lvl = new Map();
    // round 4: L3 is wherever the focus is: the chosen slot (its ButtonShow), minus or plus, a mutation chip, a perk tick
    (V.slots || []).forEach(function (S, k) { if (k < n) lvl.set(S.p, k === fr.selIdx ? (onRow && NF.b === 'Show' ? 3 : onRow ? 2 : 1) : rows[k].lv > 0 ? 1 : 0); });
    V.tabs.forEach(function (T, i) { lvl.set(T.p, i === mi ? 2 : 0); });
    if (selRow) {
      V.rows.forEach(function (R, r) { lvl.set(R.p, r === selRow.lv - 1 ? 2 : 0); });
      V.buf.forEach(function (b, i) { lvl.set(b, i < selRow.lv ? 1 : 0); });
      lvl.set(V.plus, onRow && NF.b === 'Next' ? 3 : selRow.lv < selRow.max ? 1 : 0); lvl.set(V.minus, onRow && NF.b === 'Prev' ? 3 : 0);
    }
    var totS = D.totShown || 0;
    (V.perkNodes || []).forEach(function (N) { lvl.set(N.p, +N.t.text <= totS ? 1 : 0); });
    lvl.set(V.core, 4);
    var coreAcc = mix(A, STRAIN, sk);
    for (var q = 0; q < P.plates.length; q++) {
      var PL = P.plates[q], im = PL.im, m = PL.m; if (!im) continue;
      var L = lvl.has(im) ? lvl.get(im) : -1, role = P.role.get(im);
      // round 4: a plate that is not lit and not easing keeps its values until its level, the mode hue or the glow scale
      // changes (most of the screen, most frames)
      var pst = P.st.get(im);
      if (L <= 1 && (!pst || pst.g === 0)) { var pk = L + '|' + role + '|' + P.akey; if (PL.key === pk) continue; PL.key = pk; } else PL.key = null;
      var st = P.st.get(im); if (!st) { st = { g: 0 }; P.st.set(im, st); }
      var want = L >= 2 ? 1 : 0; st.g += Math.max(-dt / 9, Math.min(dt / 5, want - st.g));   // in over 5 f, out over 9 f
      var g = ss(st.g);
      if (L === 4) {   // the core: lit from inside, breathing in the hue, amber under strain
        sF(m, '_Lit', 2.4); sC(m, '_Accent', coreAcc, 1); sF(m, '_AccentMix', 0.85);
        sC(m, '_Line', W, 1); sF(m, '_Rim', 1); sC(m, '_Fill', mix([0.01, 0.012, 0.018], coreAcc, 0.05 + 0.04 * breath), 0.95);
        sC(m, '_Glow', coreAcc, (0.12 + 0.08 * breath + 0.2 * sk) * G); sF(m, '_GlowW', 14);
        sF(m, '_EdgeGlow', (0.3 + 0.25 * breath + 0.3 * sk) * G); sF(m, '_Pulse', ev * 0.8 * G);
        sF(m, '_Run', 1); sF(m, '_RunSpeed', strain ? 220 : 70); sF(m, '_RunLen', 120);
        continue;
      }
      if (L < 0) {   // panels and frames: neutral glass, a quiet hairline on the outer ones only
        sF(m, '_Lit', 0.1); sC(m, '_Accent', Ad, 1); sF(m, '_AccentMix', 0.3);
        sC(m, '_Line', GREY, role === 'inner' ? 0 : role === 'outer' ? 0.42 : 0.5);
        sC(m, '_Glow', A, 0); sF(m, '_EdgeGlow', 0); sF(m, '_Run', 0); sF(m, '_Pulse', 0);
        if (role !== 'inner' && role !== 'outer') sF(m, '_Rim', 0.4);
        continue;
      }
      var lo = L === 1 ? 1.1 : 0.35, hi = L === 3 ? 3 : L === 2 ? 2 : lo;
      sF(m, '_Lit', lo + (hi - lo) * g);
      sC(m, '_Accent', L >= 1 ? mix(Ad, A, L >= 2 ? g : 0.5) : Ad, 1); sF(m, '_AccentMix', L === 0 ? 0.25 : L === 1 ? 0.55 : 0.55 + 0.3 * g);
      sC(m, '_Line', mix(GREY, W, g), L === 0 ? 0.5 : L === 1 ? 0.75 : 0.75 + 0.25 * g);
      sC(m, '_Fill', L >= 2 ? mix([0.012, 0.014, 0.018], [0.06, 0.066, 0.08], g) : [0.012, 0.014, 0.018], L >= 2 ? 0.75 + 0.2 * g : 0.75);
      sF(m, '_Rim', L >= 2 ? 0.4 + 0.6 * g : 0.4);
      sC(m, '_Glow', A, L === 3 ? 0.4 * g * G : 0); sF(m, '_GlowW', 16);
      sF(m, '_EdgeGlow', (L === 3 ? 0.55 : L === 2 ? 0.45 : 0) * g * G);
      sF(m, '_Run', L === 3 && g > 0.5 ? 1 : 0); sF(m, '_RunSpeed', 140);
      sF(m, '_Pulse', L >= 2 ? ev * 0.8 * g * G : 0);
    }
    // lines, labels and the gauge: neutral, a little of the hue; the lit arc reads as data, its head is the bright point
    var dataBars = new Set([V.headBar, V.railMark].concat(V.rows.map(function (R) { return R.b; })).concat(V.memBlocks || []).concat(V.gseg || []));
    if (P.lineKey !== P.akey) { P.lineKey = P.akey;   // round 4: the static lines and labels change only with the hue
    (LF.tint || []).forEach(function (T) { if (!T.im || dataBars.has(T.im) || T.im === V.bus || P.dialImg.has(T.im)) return; iC(T.im, mix(GREY, A, 0.3), T.a * 0.65); });
    // the memory column: the chosen modifier's block stays lit (dial_v4 draws it at 0.95), the others recede
    (LF.dimT || []).forEach(function (tm) { if (tm && !P.dynT.has(tm)) iC(tm, mix(DIM, A, 0.08), 1); }); }   // dial_v4 colours the dynamic labels itself
    (V.memBlocks || []).forEach(function (Bk) { if (Bk.__sel) iC(Bk, mix(A, W, 0.25), 0.5); else iC(Bk, mix(GREY, A, 0.35), 0.32); });   // round 4: the chosen block is an edge and a mid fill (m4)
    var litTo = cl(totS / Math.max(1, V.scale || 200)), nseg = (V.gseg || []).length, headSeg = Math.floor(litTo * nseg - 0.5);
    for (var s = 0; s < nseg; s++) {
      var on = (s + 0.5) / nseg <= litTo, hc = strain ? mix(A, STRAIN, sk) : A;
      if (on) iC(V.gseg[s], mix(hc, W, s >= headSeg - 1 ? 0.5 : 0.1), s >= headSeg - 1 ? 0.95 : 0.5); else iC(V.gseg[s], GREY, 0.09);
    }
    if (V.bus) V.bus.color = col(mix(GREY, A, 0.35), 0.12);
    if (V.coreRing) V.coreRing.color = col(mix(GREY, coreAcc, 0.6), 0.3 + 0.12 * breath);
    if (LF.spark) LF.spark.color = col(mix(A, W, 0.5), (0.25 + 0.4 * ev) * G);
    (LF.packets || []).forEach(function (Pk) { Pk.im.color = col(mix(A, W, 0.3), Pk.im.color.a * 0.25 * G); });
    if (LF.glows) LF.glows.forEach(function (Gl) { Gl.e.forEach(function (e) { iC(e, W, 0); }); iC(Gl.run, W, 0); });
    V.titleG.color = col(A, 0.18 * V.title.color.a);
    V.title.color = col(mix([0.6, 0.62, 0.66], A, 0.1), V.title.color.a);   // big but a step under the core numeral (linear 0.6)
    V.total.color = col(mix(W, coreAcc, 0.06), V.total.color.a);
    V.limitT.color = col(mix(DIM, STRAIN, sk), V.limitT.color.a);
    V.tabs.forEach(function (T, i) { if (i !== mi) iC(T.t, DIM, 0.7 * cl((oF - 24 - i * 3) / 20)); else T.t.__ic = null; });   // round 4: from the open's clock, not the label's last alpha

    // ---- 2. ground: room near black, a dark underlay and a vignette (the room keeps its hue, faintly) ----
    var Lr = D.LV4;
    if (Lr && Lr.room && !Lr.room.Equals(null)) { var ra = Lr.room.color.a; Lr.room.color = col([0.42, 0.42, 0.46], ra); }

    // ---- 3. the core ----
    var cb = P.coreBase, jx = 0, jy = 0;
    // round 5 (item 5): the strain moves only the numeral, 1 px at 0.5 Hz, and only at the limit
    var atLim0 = limit && head <= 0, nj = atLim0 ? (Math.floor(t / 60) % 2 ? 1 : -1) : 0;
    if (P.njLast !== nj) { P.njLast = nj; V.total.transform.localPosition = H.V3(cb.total.x + nj, cb.total.y); }
    var coreA = cl(oF / 40);
    iC(P.bloom, A, (0.2 + 0.1 * breath + 0.25 * ev) * G * coreA);   // round 5 (item 5): the ground keeps the mode hue under strain
    P.bloom.transform.localScale = H.S3(1 + 0.04 * breath);
    iC(P.inner, mix(A, W, 0.2), (0.07 + 0.05 * breath + 0.12 * ev) * G * coreA);
    // cracks of light along the face, flickering, only under strain
    P.cracks.forEach(function (Ck) {
      if (t > Ck.until) {
        Ck.until = t + rnd(4, 10); Ck.on = Math.random() < 0.65;
        // along a facet: the hex's edge normals are at 0, 60 .. 300 degrees, its inradius 225; a crack runs just inside an
        // edge, a little off its direction, so it frames the numeral instead of crossing it
        var nrm = 60 * Math.floor(rnd(0, 6)) * Math.PI / 180, r = rnd(176, 206), off = rnd(-70, 70);
        var px = r * Math.cos(nrm) - off * Math.sin(nrm), py = r * Math.sin(nrm) + off * Math.cos(nrm);
        Ck.im.transform.localPosition = H.V3(px, py); Ck.im.transform.localEulerAngles = H.V3(0, 0, nrm * 180 / Math.PI + 90 + rnd(-22, 22));
        Ck.im.transform.sizeDelta = H.V2(rnd(90, 200), 18); Ck.a = rnd(0.6, 1);
      }
      Ck.im.color = col([0.9, 1, 0.62], Ck.on ? Ck.a * sk * Math.max(0.5, G) * (0.6 + 0.4 * Math.random()) : 0);
      Ck.im.transform.SetAsLastSibling();
    });
    // pulse rings out through the slot ring
    P.rings.forEach(function (R) {
      if (R.at == null) { R.im.color = col(W, 0); return; }
      var k = (t - R.at) / 27; if (k >= 1) { R.at = null; R.im.color = col(W, 0); return; }
      var d = 520 + 700 * (1 - Math.pow(1 - k, 2.2)); R.im.transform.sizeDelta = H.V2(d, d);
      R.im.color = col(mix(coreAcc, W, 0.35), 0.75 * Math.pow(1 - k, 1.6) * G);
    });

    // ---- 4. the recolour wipe ----
    if (wk < 1 && P.wipeO) {
      var ox = P.wipeO[0], oy = P.wipeO[1], far = Math.hypot(P.scrW / 2 + Math.abs(ox), 720 + Math.abs(oy)), dd = 2 * far * 1.08 * (1 - Math.pow(1 - wk, 2));
      [P.wipeDisc, P.wipeRing].forEach(function (im) { im.transform.localPosition = H.V3(ox, oy); im.transform.sizeDelta = H.V2(dd, dd); });
      P.wipeRing.color = col(mix(Pt.a, W, 0.25), 0.5 * (1 - wk * wk) * Math.max(0.35, G));
      P.wipeDisc.color = col(Pt.a, 0.12 * (1 - wk));
    } else { P.wipeRing.color = col(W, 0); P.wipeDisc.color = col(W, 0); }
    // slots: a spring to and from the chosen size, a clockwise entrance, a squash before a rank up
    var w0 = 0.55, z0 = 0.62;
    (V.slots || []).forEach(function (S, k) {
      if (k >= n) return;
      var isSel = k === fr.selIdx, tg = isSel ? 112 : 88, sp2 = P.ss[k] || (P.ss[k] = { s: tg, v: 0 });
      if (isSel && P.antic > 0) { sp2.s = tg * 0.94; sp2.v = 0; P.antic -= dt; if (P.antic <= 0) sp2.v = 6.5; }
      else {
        var steps = Math.max(1, Math.ceil(dt)), h = dt / steps;
        for (var i = 0; i < steps; i++) { var acc = -w0 * w0 * (sp2.s - tg) - 2 * z0 * w0 * sp2.v; sp2.v += acc * h; sp2.s += sp2.v * h; }
      }
      var ent = 0.6 + 0.4 * spr((oF - 46 - k * 1.2) / 16), sc = ent * sp2.s / tg;
      S.t.localScale = H.S3(sc, sc);
    });

    // ---- 5. panel parts stagger in, top to bottom, on a spring ----
    if (oF < 140) {
      P.stagDone = false;
      P.stag.forEach(function (Q) {
        if (!Q.t || Q.t.Equals(null)) return;
        var d = 38 + cl((360 - Q.b.y) / 1000) * 22, k = (oF - d) / 20;
        Q.t.localPosition = H.V3(Q.b.x + Q.side * 30 * (1 - spr(k)), Q.b.y);
      });
    } else if (!P.stagDone) { P.stagDone = true; P.cardB = P.statB = null; if (P.r5) P.r5.bot = null;   // round 5: the keyed layout is written again after the stagger
      P.stag.forEach(function (Q) { if (Q.t && !Q.t.Equals(null)) Q.t.localPosition = Q.b; }); }

    // ---- 6. depth: three layers drift with the selection; motes in three depth groups; the burst ----
    P.kick *= Math.pow(0.965, dt);
    var tx = P.kick * 1 + 0.35 * Math.sin(t / 190), ty = 0.35 * Math.sin(t / 240 + 1);
    P.px += (tx - P.px) * cl(0.08 * dt); P.py += (ty - P.py) * cl(0.08 * dt);
    if (Lr && Lr.room && !Lr.room.Equals(null)) { Lr.room.transform.localPosition = H.V3(-7 * P.px, -4 * P.py); Lr.room.transform.localScale = H.S3(1.012); }
    [V.card, V.right, V.hd].forEach(function (g2) { var lp = g2.localPosition; g2.localPosition = H.V3(lp.x + 2.5 * P.px, lp.y + 1.5 * P.py); });
    V.dial.localPosition = H.V3(P.dialBase.x + 7 * P.px, P.dialBase.y + 4 * P.py);
    P.back.localPosition = H.V3(-3 * P.px, -2 * P.py);
    var mc = mix(A, W, 0.45);
    // round 4: the motes move on every second frame (0.1-0.4 px a frame does not show the difference)
    P.mf = (P.mf || 0) + dt; var moteOn = P.mf >= 2; if (moteOn) P.mf = 0;
    if (moteOn) P.motes.forEach(function (M) {
      M.y += M.G.v * 2; if (M.y > 760) { M.y = -760; M.x = rnd(-P.scrW / 2, P.scrW / 2); }
      var x = M.x + 6 * Math.sin(t / 140 + M.ph) + M.G.f * 6 * P.px, y = M.y + M.G.f * 3 * P.py;
      M.im.transform.localPosition = H.V3(x, y);
      iC(M.im, mc, M.G.a * (0.75 + 0.25 * Math.sin(t / 50 + M.ph * 3)) * cl(oF / 60) * (0.6 + 0.4 * G));
    });
    P.bursts.forEach(function (Bu) {
      if (Bu.at == null || t < Bu.at) { Bu.im.color = col(W, 0); return; }
      var k = (t - Bu.at) / Bu.life; if (k >= 1) { Bu.at = null; Bu.im.color = col(W, 0); return; }
      var dd2 = Bu.sp * Bu.life * (1 - Math.pow(1 - k, 2)) / 2;
      Bu.im.transform.localPosition = H.V3(Bu.x + Bu.dx * dd2, Bu.y + Bu.dy * dd2 + 18 * k);
      Bu.im.transform.localEulerAngles = H.V3(0, 0, 45 + 90 * k);
      var s2 = Bu.sz * (1 - 0.5 * k); Bu.im.transform.sizeDelta = H.V2(s2, s2);
      Bu.im.color = col(mix(A, W, 0.4), 0.9 * Math.pow(1 - k, 1.4) * G);
    });

    // ---- 7. atmosphere: shafts, scanlines, grain ----
    var shA = cl(oF / 60);
    P.shafts.forEach(function (Sh, i) {
      Sh.im.transform.localEulerAngles = H.V3(0, 0, Sh.a + 1.5 * Math.sin(t / 300 + Sh.ph));
      Sh.im.transform.localPosition = H.V3(Sh.x + 20 * Math.sin(t / 400 + Sh.ph), Sh.y);
      Sh.im.color = col(mix(A, W, 0.3), (0.08 + 0.02 * Math.sin(t / 160 + Sh.ph)) * shA);
    });

    if ((P.gf = (P.gf || 0) + dt) >= 3) { P.gf = 0; P.grain.uvRect = new UE.Rect(Math.random(), Math.random(), P.scrW / 256, 1440 / 256); }   // round 4: grain re-rolls every 3rd frame
    tickR2(w, B, t, dt, A, sk, limit, tot, oF);
    tickR3(w, B, t, dt, A, sk, limit, tot, oF, strain, head, mode, selRow);
    tickR5(w, t, A, sk, limit, tot, oF, strain, head, selRow, rows, n);
    P.top.SetAsLastSibling();
  }

  // ======== round 2 (2026-11-05): perk tick scale, real mutation states, the hex warp open and close, contrast ========
  function monoFont() { var F = V.fonts || {}; for (var k in F) if (/share.*mono/i.test(k)) return F[k]; return null; }
  function label(parent, name, fs, w, h, align) {
    var tm = H.txt(parent, name, fs, w, h, align); P.made.push(tm.gameObject); tm.gameObject.SetActive(true);   // H.txt copies a stock label that may be hidden
    var f = monoFont(); if (f) { tm.font = f; tm.fontSharedMaterial = f.material; }
    return tm;
  }
  function buildR2() {
    // a soft stage of light under the dial: the median moves off the black ground while the corners stay black
    if (!TX.stage) TX.stage = spriteOf(tex(128, 128, function (x, y) { var r = Math.hypot(x, y); return [1, 1, 1, Math.exp(-r * r * 2.6) * cl((1 - r) / 0.1)]; }));
    P.stage = img(P.back, 'Stage', 2300, 1900, TX.stage, W, 0); P.stage.transform.SetSiblingIndex(P.vig.transform.GetSiblingIndex() + 1);
    // the perk tick scale on the gauge, with two small numbers (the next perk and the limit)
    P.ticks = []; P.tickHost = H.node(V.dial, 'PerkTicks'); P.made.push(P.tickHost.gameObject); P.tickHost.SetSiblingIndex(V.perkHost.GetSiblingIndex() + 1);
    P.nextT = label(P.tickHost, 'NextTick', 24, 120, 30, 514); P.focT = label(P.tickHost, 'FocusTick', 24, 260, 30, 514); P.limT = label(P.tickHost, 'LimitTick', 24, 160, 30, 514);
    // mutations: an icon on each chip and a label line under the rows
    P.mutIcons = (V.muts || []).map(function (MU, i) { var ic = img(MU.transform, 'MutIcon', 40, 40, null, W, 0); ic.preserveAspect = true; return ic; });
    P.mutT = H.txt(V.right, 'MutLabel', 24, 440, 32, 4097); P.made.push(P.mutT.gameObject);
    var bf = V.fonts && (function () { for (var k in V.fonts) if (/chakra.*semi/i.test(k)) return V.fonts[k]; return null; })(); if (bf) { P.mutT.font = bf; P.mutT.fontSharedMaterial = bf.material; }
    P.mutT.transform.localPosition = H.V3(2036 + 220 - 1280, 720 - 1260); P.mutT.enableAutoSizing = true; P.mutT.fontSizeMin = 18; P.mutT.fontSizeMax = 24; P.mutT.enableWordWrapping = true; P.mutT.transform.sizeDelta = H.V2(440, 56);
    P.mutSeen = {}; P.mutLast = null; P.mutN = -1;
    // the close: its own frame count (the hex cells need time to read), and a stand-in group so the v3 close's fade of the
    // whole layer waits for the cells
    if (D.F) D.F.close = 26;
    P.closing = false; P.openSeen = D.openAt;
  }
  // ======== round 5 (2026-11-06): the quality list, inspo\QUALITY_R4.md ========
  var PRIM = [0.60, 0.61, 0.64], SECO = [0.36, 0.37, 0.40], TERT = [0.25, 0.26, 0.28];   // item 12: three text greys
  function plateMat() { var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)); for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === 'ED_Plate') return all.get_Item(i); return null; }
  // a plate as dial_v4 makes them: the Plate shader on a white Image (life_v4 pads it for its glow when it is scanned)
  function mkPlate(parent, name, w, h, o) {
    var im = img(parent, name, w, h, null, W, 1), b = plateMat(); if (!b) return im;
    var m = new UE.Material(b); im.material = m; im.__m = m; o = o || {};
    m.SetVector('_Size', new UE.Vector4(w, h, 0, 0)); var c = o.cut || [0, 0, 0, 0]; m.SetVector('_Cut', new UE.Vector4(c[0], c[1], c[2], c[3]));
    m.SetColor('_Fill', col(o.fill || [0.03, 0.033, 0.04], o.alpha == null ? 0.6 : o.alpha)); m.SetColor('_Line', col(GREY, o.lineA == null ? 0 : o.lineA));
    if (o.raised) m.SetFloat('_Raised', 1); m.SetFloat('_Lit', 0); m.SetFloat('_Weave', 0.1); m.SetFloat('_Rim', 0.2); m.SetFloat('_Run', 0); m.SetFloat('_EdgeGlow', 0);
    return im;
  }
  function at(t, x, y) { t.localPosition = H.V3(x - 1280, 720 - y); }   // DESIGN.md canvas coordinates (centre of the piece)
  function stockImg(w, path) { try { var t = w.CsObj.transform.Find('BtnController/SafeAreaFitter/Content/ContentMasteAndExpert/ExpertModeContent/ExpertAdditionalBonus/' + path); if (!t) return null; var ims = t.GetComponentsInChildren(TY(UE.UI.Image), true); for (var i = 0; i < ims.Length; i++) { var s = ims.get_Item(i).sprite; if (s) return s; } } catch (x) {} return null; }
  function buildR5() {
    var w = globalThis.__ev3w;
    // item 1: the core face lit as metal: six facets from the centre, lit from the upper left (1.25x) to the lower right
    // (0.75x), a bevel line on the lit edges, faint seams to the corners. Values only: white or black at low alpha over
    // the plate, no bloom.
    if (!TX.facet) TX.facet = spriteOf(tex(256, 290, function (x, y) {
      var px = x * 225, py = y * 255, R = 255, hw = R * 0.8660;
      var inside = Math.min(hw - Math.abs(px), R - (Math.abs(py) + Math.abs(px) * 0.5774) * 1);
      if (inside < 0) return [0, 0, 0, 0];
      var ang = Math.atan2(py, px) * 180 / Math.PI, sct = Math.round(ang / 60), nrm = sct * 60 * Math.PI / 180;
      var lit = Math.cos(nrm - 135 * Math.PI / 180), m = 0.25 * lit, a = Math.abs(m) * 0.55;
      var edge = inside < 7 && lit > 0.2 ? (1 - inside / 7) * 0.5 * lit : 0;
      var va = Math.round(ang / 60 - 0.5) * 60 + 30, vr = va * Math.PI / 180, seamD = Math.abs(-Math.sin(vr) * px + Math.cos(vr) * py);
      var seam = seamD < 1.6 && Math.hypot(px, py) > 40 ? 0.10 * (1 - seamD / 1.6) : 0;
      if (edge > 0) return [1, 1, 1, Math.min(1, a * (m > 0 ? 1 : 0) + edge)];
      if (m > 0) return [1, 1, 1, a + seam * 0.2];
      return [0, 0, 0, a + seam];
    }));
    P.facets = img(V.dial, 'CoreFacets', 450, 510, TX.facet, W, 0); P.facets.transform.SetSiblingIndex(V.core.transform.GetSiblingIndex() + 1);
    P.specM = lightFx({ _Mode: 0, _Thin: 16, _Core: 1.6, _Halo: 0.3 }); P.spec = fx(V.dial, 'CoreSpec', 150, 20, P.specM); P.specAt = null;
    // item 2: rank pips on every slot's bottom edge, a top line on a maxed one
    P.pips = []; P.pipAt = -99;
    // item 3: the card: no HEADROOM band (its bar becomes the foot strip's fill), the sentence gets the band's height
    [V.head, V.headL, V.headTrack, V.headBar].forEach(function (o) { if (o) act(o.gameObject, false); });
    V.cardTop.transform.sizeDelta = H.V2(600, 188); at(V.cardTop.transform, 372, 390);
    V.cardText.transform.sizeDelta = H.V2(552, 128); at(V.cardText.transform, 92 + 276, 340 + 64);
    V.cardMeta.transform.localPosition = H.V3(92 + 280 - 1280, 720 - 322);   // inside the band, clear of its top edge
    act(V.bufT.gameObject, false);
    // item 8: the header readout right-aligned to the rule's end (x 2488)
    V.nextL.alignment = 260; V.nextV.alignment = 260;
    P.footFill = img(V.root, 'FootFill', 10, 30, null, W, 0); P.footFill.transform.pivot = H.V2(0, 0.5);
    P.footFill.transform.SetSiblingIndex(V.foot.transform.GetSiblingIndex() + 1);
    // item 9: the card's last line: the next rank's value and its cost (or that the modifier is at its maximum)
    P.nextRk = H.txt(V.card, 'NextRank', 24, 540, 32, 4097); P.made.push(P.nextRk.gameObject); P.nextRk.gameObject.SetActive(true); monoIt(P.nextRk);
    // item 4: one head style: the raised tab bar (52 px) for RANK MATRIX, STATUS, TRACKED // RULES and MUTATIONS
    P.hTR = mkPlate(V.right, 'HeadRules', 440, 52, { raised: 1, cut: [16, 0, 16, 0], alpha: 0.7 });
    P.hMut = mkPlate(V.right, 'HeadMut', 440, 52, { raised: 1, cut: [16, 0, 16, 0], alpha: 0.7 });
    P.hTR.transform.SetSiblingIndex(V.trH.transform.GetSiblingIndex()); P.hMut.transform.SetSiblingIndex(V.mutH.transform.GetSiblingIndex());
    // item 10: the Output and Tactic values carry the stock icons of what they count (crystal fragments, currency, the
    // two blessings), as the stock panel does; the values move to the mono face
    P.otIcons = [['Consciousness', V.o1], ['AP', V.o2], ['BlessUpListExpert', V.t1], ['BlessUpListExpert', V.t2]].map(function (q, i) {
      var sp = null; if (q[0] === 'BlessUpListExpert') { try { var bl = w.CsObj.transform.Find('BtnController/SafeAreaFitter/Content/ContentMasteAndExpert/ExpertModeContent/ExpertAdditionalBonus/BlessUpListExpert'); var ch = bl && bl.GetChild(i - 2); var ims = ch ? ch.GetComponentsInChildren(TY(UE.UI.Image), true) : null; for (var k = 0; ims && k < ims.Length; k++) if (ims.get_Item(k).sprite) { sp = ims.get_Item(k).sprite; break; } } catch (x) {} }
      else sp = stockImg(w, q[0]);
      var ic = img(V.right, 'OTIcon' + i, 30, 30, sp, W, sp ? 0.8 : 0); ic.preserveAspect = true; return { im: ic, tm: q[1] };
    });
    // item 11: the strip: its head spans it only, a count under it, a tick scale, and a leader from the chosen block to the
    // chosen slot
    V.store.transform.sizeDelta = H.V2(100, 60); at(V.store.transform, 1938, 326);
    act(V.storeL.gameObject, false);
    act(V.storeV.gameObject, false);   // dial_v4 writes 'N RANKED' there every frame; the count now sits under the strip
    P.storeT = H.txt(V.right, 'StoreHead', 24, 100, 60, 514); P.made.push(P.storeT.gameObject); P.storeT.gameObject.SetActive(true); P.storeT.text = 'SUM';
    var sb = find(V.right, 'StoreBlock'); if (sb) act(sb.gameObject, false);
    P.memLbl = H.txt(V.right, 'MemLabel', 20, 120, 28, 514); P.made.push(P.memLbl.gameObject); P.memLbl.gameObject.SetActive(true); monoIt(P.memLbl);
    P.memTicks = [0, 1, 2].map(function (i) { var tk = img(V.right, 'MemTick' + i, 12, 2, null, W, 0); var lb = H.txt(V.right, 'MemTickL' + i, 18, 60, 22, 4100); P.made.push(lb.gameObject); lb.gameObject.SetActive(true); monoIt(lb); return { im: tk, tm: lb }; });
    P.leader = img(V.root, 'Leader', 10, 1, null, W, 0); P.leader.transform.pivot = H.V2(0, 0.5);
    // item 9: a perk progress readout fills the status block's gap when the mode has few rules
    P.perkBox = H.txt(V.right, 'PerkBox', 24, 440, 30, 4097); P.made.push(P.perkBox.gameObject); P.perkBox.gameObject.SetActive(true); monoIt(P.perkBox);
    P.perkSegs = []; for (var q = 0; q < 12; q++) P.perkSegs.push(img(V.right, 'PerkSeg' + q, 30, 8, null, W, 0));
    // item 13: a floor ring under the dial and three dark silhouettes far back (3-8 %, with the far layer's parallax)
    P.floor = img(P.back, 'Floor', 1500, 260, TX.ring, W, 0); P.floor.transform.localPosition = H.V3(0, -470);
    P.floor2 = img(P.back, 'FloorGlow', 1200, 200, TX.disc, W, 0); P.floor2.transform.localPosition = H.V3(0, -480);
    P.arch = [[-1050, 120, 260, 1300], [1060, 80, 300, 1250], [0, 560, 2200, 140]].map(function (q, i) { var a = img(P.back, 'Arch' + i, q[2], q[3], null, W, 0); a.transform.localPosition = H.V3(q[0], q[1]); return a; });
    [P.floor, P.floor2].concat(P.arch).forEach(function (o) { o.transform.SetSiblingIndex(P.vig.transform.GetSiblingIndex()); });
    // item 15a: the dial's glyph in the header's hexagon: a ring with a needle at the current load
    P.glyphRing = img(V.hd, 'GlyphRing', 40, 40, TX.ring, W, 0); P.glyphNeedle = img(V.hd, 'GlyphNeedle', 3, 16, null, W, 0); P.glyphNeedle.transform.pivot = H.V2(0.5, 0);
    var hx = V.idHex.transform.localPosition; P.glyphRing.transform.localPosition = hx; P.glyphNeedle.transform.localPosition = hx;
    // item 15c: one chamfer: top left and bottom right, everywhere
    V.tabs.forEach(function (T) { if (T.p.__m) T.p.__m.SetVector('_Cut', new UE.Vector4(12, 0, 12, 0)); });
    [V.mbar, V.statH].forEach(function (p) { if (p && p.__m) p.__m.SetVector('_Cut', new UE.Vector4(16, 0, 16, 0)); });
    if (V.foot.__m) V.foot.__m.SetVector('_Cut', new UE.Vector4(8, 0, 8, 0));
    // item 12: one numeral face for data (the mono), Aldrich only for display (the core, the +12, the title)
    [V.o1, V.o2, V.t1, V.t2, V.nextV].forEach(monoIt);
    V.rows.forEach(function (R) { monoIt(R.e); });
    P.r5 = { bot: null, fk: null, otk: null };
    // item 7: the prompt bar's own group (FixedInputArea ignores the bar's parent group)
    try { var fi = UE.GameObject.Find('GameGlobal(Clone)/SingletonOrganizer/(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions/FixedInputArea'); P.fixedCG = fi ? fi.GetComponent(TY(UE.CanvasGroup)) : null; } catch (x) { P.fixedCG = null; }
  }
  function monoIt(tm) { var f = monoFont(); if (tm && f) { tm.font = f; tm.fontSharedMaterial = f.material; } }
  function tickR5(w, t, A, sk, limit, tot, oF, strain, head, selRow, rows, n) {
    var R5 = P.r5, atLim = limit && head <= 0;
    // ---- item 1: facets (follow the core's open fade), and a specular that runs round the rim on a turn or a new total ----
    iC(P.facets, W, 0.9 * cl(oF / 40));
    if (D.fr.tF != null && D.fr.tF < 1 && P.specAt !== D.turnAt) { P.specAt = D.turnAt; P.specT = t; P.specDir = P.kick >= 0 ? 1 : -1; }
    if (P.specTot !== tot) { if (P.specTot != null) { P.specT = t; P.specDir = 1; } P.specTot = tot; }
    var sk2 = P.specT == null ? 1 : (t - P.specT) / 26;
    if (sk2 < 1) {
      var u = ss(sk2), sP = (P.specDir > 0 ? u : 1 - u) * 6, e = Math.floor(sP) % 6, f = sP - Math.floor(sP);
      var a0 = (90 - 60 * e) * Math.PI / 180, a1 = (90 - 60 * (e + 1)) * Math.PI / 180, Rr = 250;
      var x = Rr * Math.cos(a0) * (1 - f) + Rr * Math.cos(a1) * f, y = Rr * Math.sin(a0) * (1 - f) + Rr * Math.sin(a1) * f;
      P.spec.transform.localPosition = H.V3(x, y); P.spec.transform.localEulerAngles = H.V3(0, 0, Math.atan2(Math.sin(a1) - Math.sin(a0), Math.cos(a1) - Math.cos(a0)) * 180 / Math.PI);
      iC(P.spec, mix(A, W, 0.6), Math.sin(Math.PI * sk2) * 0.8 * D.V4G);
    } else iC(P.spec, W, 0);
    // ---- item 2: pips and plates (on a change of ranks, the chosen slot or the focus) ----
    var NF = P.navFoc || {}, pk = n + ':' + D.fr.selIdx + ':' + NF.key + ':' + rows.map(function (r) { return r.lv; }).join('') + ':' + P.akey;
    if (R5.pk !== pk) {
      R5.pk = pk;
      for (var k = 0; k < (V.slots || []).length; k++) {
        var S = V.slots[k], Rw = rows[k]; if (!S.pips) { S.pips = []; for (var p = 0; p < 6; p++) S.pips.push(img(S.t, 'Pip' + p, 9, 4, null, W, 0)); S.top = img(S.t, 'MaxLine', 56, 2, null, W, 0); }
        var has = k < n; if (!has) continue;
        var isSel = k === D.fr.selIdx, sz = isSel ? 112 : 88, mx = Rw.max || 0, lv = Rw.lv || 0, show = lv > 0 || isSel;
        for (var p2 = 0; p2 < 6; p2++) {
          var pi = S.pips[p2], on2 = p2 < mx && lv > 0;
          if (on2) { pi.transform.localPosition = H.V3((p2 - (mx - 1) / 2) * 12, -sz / 2 + 8); iC(pi, p2 < lv ? mix(A, W, 0.25) : GREY, p2 < lv ? 0.9 : 0.25); } else iC(pi, W, 0);
        }
        S.top.transform.localPosition = H.V3(0, sz / 2 - 6); iC(S.top, mix(A, W, 0.3), lv > 0 && lv >= mx ? 0.8 : 0);
        iC(S.p, W, show || (NF.k === 'row' && NF.r === k) ? 1 : 0);   // item 2c: an unranked slot is its badge alone
      }
    }
    // ---- item 3 / 15e: the foot strip is the headroom bar: filled by the used share, in the hue (lime under strain) ----
    var bot = P.bot || 1196;
    if (R5.bot !== bot) {
      R5.bot = bot; var fy = bot + 48;   // the foot sits under the strip count
      at(V.foot.transform, 1280, fy); var fb = find(V.root, 'FootBlock'); if (fb) at(fb.transform, 75, fy);
      V.footA.transform.localPosition = H.V3(100 + 450 - 1280, 720 - fy);
      at(P.footFill.transform, 72, fy); P.footFill.transform.localPosition = H.V3(72 - 1280 + 4, 720 - fy);
    }
    var used = limit ? cl(tot / limit) : 0, fk = Math.round(used * 400) + ':' + strain + ':' + P.akey;
    if (R5.fk !== fk) { R5.fk = fk; P.footFill.transform.sizeDelta = H.V2(Math.max(0, 2408 * used), 28); }
    iC(P.footFill, strain ? STRAIN : A, limit ? (strain ? 0.32 : 0.2) : 0);
    // ---- item 3: the state line goes (the core line and the gauge tick carry the limit) ----
    act(V.state.gameObject, false); if (V.stateHex) act(V.stateHex.gameObject, false);
    // ---- item 9: the card's next-rank line ----
    if (selRow && selRow.d) {
      var vals = rankVals(selRow.d, selRow.max, w.CurBattleMode), nl = selRow.lv >= selRow.max ? 'AT THE MAXIMUM RANK' : 'NEXT  R' + (selRow.lv + 1) + '   ' + (vals[selRow.lv] || '');
      if (R5.nl !== nl) { R5.nl = nl; P.nextRk.text = nl; }
      at(P.nextRk.transform, 92 + 270, 764 + selRow.max * 68 + 20); iC(P.nextRk, SECO, 1);
    } else iC(P.nextRk, W, 0);
    // ---- item 4: the head bars follow their texts ----
    var tl = V.trH.transform.localPosition, ml = V.mutH.transform.localPosition;
    P.hTR.transform.localPosition = H.V3(2028 + 220 - 1280, tl.y); act(P.hTR.gameObject, V.trH.gameObject.activeSelf);
    P.hMut.transform.localPosition = H.V3(2028 + 220 - 1280, ml.y); act(P.hMut.gameObject, V.mutH.gameObject.activeSelf);
    // ---- item 10: icons left of each Output / Tactic value ----
    P.otIcons.forEach(function (q) { var p3 = q.tm.transform.localPosition, wv = q.tm.preferredWidth; q.im.transform.localPosition = H.V3(p3.x + 75 - Math.min(150, wv) - 22, p3.y); act(q.im.gameObject, q.tm.gameObject.activeInHierarchy && !!q.tm.text); });
    // ---- item 11: the strip's scale, count and leader ----
    var nRanked = rows.filter(function (q) { return q.lv > 0; }).length;
    var mk = bot + ':' + limit + ':' + nRanked;
    if (R5.mk !== mk) {
      R5.mk = mk; P.memLbl.text = nRanked + ' RANKED'; iC(P.memLbl, TERT, 1);
      var top = bot - 8 - 808, lim = limit || 0;
      P.memTicks.forEach(function (T2, i) {
        var y = bot - 8 - 808 * i / 2; at(T2.im.transform, 1882, y); iC(T2.im, GREY, 0.5);
        T2.tm.text = lim ? '' + Math.round(lim * i / 2) : ''; T2.y = y; iC(T2.tm, TERT, 1);
      });
      iC(P.storeT, SECO, 1);
    }
    // text clones of the stock label lose a position written once (seen in game), so their positions are set every frame
    at(P.memLbl.transform, 1938, bot + 13); at(P.storeT.transform, 1938, 326); P.memTicks.forEach(function (T2) { if (T2.y != null) at(T2.tm.transform, 1846, T2.y); });
    var selB = (V.memBlocks || []).filter(function (b) { return b.__sel && b.gameObject.activeSelf; })[0], selS = V.slots && V.slots[D.fr.selIdx];
    if (selB && selS) {
      var bp = selB.transform.localPosition, bh = selB.transform.sizeDelta.y, x0 = V.right.localPosition.x + bp.x - 42, y0 = V.right.localPosition.y + bp.y + bh / 2;
      var sp2 = selS.t.localPosition, x1 = V.dial.localPosition.x + sp2.x + 60, y1 = V.dial.localPosition.y + sp2.y;
      var lk = Math.round(x0) + ':' + Math.round(y0) + ':' + Math.round(x1) + ':' + Math.round(y1);
      if (R5.lk !== lk) { R5.lk = lk; P.leader.transform.localPosition = H.V3(x1, y1); P.leader.transform.sizeDelta = H.V2(Math.hypot(x0 - x1, y0 - y1), 1); P.leader.transform.localEulerAngles = H.V3(0, 0, Math.atan2(y0 - y1, x0 - x1) * 180 / Math.PI); }
      iC(P.leader, A, 0.55 * cl((oF - 90) / 30));
    } else iC(P.leader, W, 0);
    // ---- item 9: perk progress in the status block's gap (only when the gap is 120 px or more) ----
    var pv = perkVals(), got = pv.filter(function (v) { return v <= tot; }).length, gapTop = P.rulesEnd || 0, gapBot = P.mutTop || 0;
    var showPB = pv.length > 0 && gapBot - gapTop >= 120, pbk = got + '/' + pv.length + ':' + gapTop + ':' + showPB + ':' + P.akey;
    if (R5.pbk !== pbk) {
      R5.pbk = pbk; P.perkBox.text = 'PERKS  ' + got + ' / ' + pv.length + ' REACHED'; iC(P.perkBox, showPB ? SECO : W, showPB ? 1 : 0);
      var nS = Math.min(12, pv.length), wS = Math.floor((440 - (nS - 1) * 6) / Math.max(1, nS));
      P.perkSegs.forEach(function (sg, i) { if (!showPB || i >= nS) { iC(sg, W, 0); return; } sg.transform.sizeDelta = H.V2(wS, 8); at(sg.transform, 2036 + i * (wS + 6) + wS / 2, gapTop + 56); iC(sg, i < got ? mix(A, W, 0.2) : GREY, i < got ? 0.85 : 0.22); });
    }
    at(P.perkBox.transform, 2036 + 220, gapTop + 30);
    // ---- item 12: three greys ----
    var gk2 = P.akey + ':' + D.fr.selIdx;
    if (R5.gk !== gk2) {
      R5.gk = gk2;
      [V.cardMeta, V.idMode].forEach(function (tm) { iC(tm, TERT, 1); });
      [V.oL, V.tL, V.nextL, V.powL].forEach(function (tm) { iC(tm, SECO, 1); });
      [V.o1, V.o2, V.t1, V.t2, V.nextV].forEach(function (tm) { iC(tm, PRIM, 1); });
    }
    // ---- item 13: floor and silhouettes ----
    var fa = cl(oF / 60);
    iC(P.floor, mix(A, W, 0.3), 0.07 * fa); iC(P.floor2, A, 0.035 * fa);
    P.arch.forEach(function (a2) { iC(a2, mix([0.02, 0.02, 0.025], A, 0.15), 0.05 * fa); });
    // ---- item 15a: the glyph ----
    iC(P.glyphRing, mix(A, W, 0.3), 0.75 * cl(oF / 40)); iC(P.glyphNeedle, W, 0.9 * cl(oF / 40));
    var gl = limit ? cl(tot / limit) : 0, ga = -(gl * 300 - 150);
    if (R5.ga !== ga) { R5.ga = ga; P.glyphNeedle.transform.localEulerAngles = H.V3(0, 0, ga); }
    // ---- item 7: the prompt bar comes in last on the open (f40-50) and goes first on the close ----
    var cg = P.fixedCG;
    if (cg && !cg.Equals(null)) {
      var want = D.closeAt != null ? cl(1 - (t - D.closeAt) / 8) : cl((oF - 40) / 10);
      if (want < 1 || P.fixedLow) { cg.alpha = want; P.fixedLow = want < 1; }
      if (D.closeAt != null && !P.fixedRestore) { P.fixedRestore = true; setTimeout(function () { try { if (cg && !cg.Equals(null)) cg.alpha = 1; } catch (x) {} P.fixedRestore = false; }, 900); }
    }
  }
  // ======== round 4: navigation (controller and keyboard) ========
  // The stock HeatMenu keeps the input: one InputGroup (HeatMenu) whose Navigation axis moves the focus between the
  // stock selectables (each modifier row's ButtonPrevious / ButtonNext / ButtonShow, the mutation Btns under
  // ExpertModeBuffList, the perk Btns under ExpertBuffList, BtnLeft / BtnRight / DefaultBtn and the side prompts), and
  // its ButtonActions do the rest (A on a row's minus / plus changes the rank, BtnSwitchLeft / Right = LB / RB,
  // BtnShowDetail, BtnReset (hold), BtnBack). The game's own search reads the stock layout, which is not ours (down from a
  // row's ButtonShow went to the last row, left from minus to a perk, right from a mutation to a row), so, as the pause
  // menu does (fourpause.js), the pressed direction is read from NavigationMove.OnChangeInputGroup and, once the game has
  // moved, the focus is put where this layout's map says. Focus on a stock piece this screen does not draw goes to the
  // chosen modifier's minus.
  var CT = 'BtnController/SafeAreaFitter/Content/ContentMasteAndExpert/ExpertModeContent/';
  function navGroup(w) { var g = P.navG; if (!g || g.Equals(null)) { g = P.navG = w.CsObj.GetComponent(TY(cs.GamePlay.InputGroup)); } return g; }
  function navClass(w, s) {
    if (!s || s.Equals(null)) return { k: 'none', key: 'none' };
    var dl = w.R.DebuffList, t = s.transform, nm = s.name;
    for (var q = t, d = 0; q && d < 8; q = q.parent, d++) {
      var par = q.parent; if (!par) break;
      if (dl && par.Equals(dl)) { var b = nm === 'ButtonPrevious' ? 'Prev' : nm === 'ButtonNext' ? 'Next' : 'Show'; var r = q.GetSiblingIndex(); return { k: 'row', r: r, b: b, key: 'row' + r + b }; }
      if (par.name === 'ExpertModeBuffList') { var i = q.GetSiblingIndex(); return { k: 'mut', i: i, key: 'mut' + i }; }
      if (par.name === 'ExpertBuffList') {
        var j = q.GetSiblingIndex(), v = 0; try { var tm = q.GetComponentInChildren(TY(cs.TMPro.TMP_Text), true); v = +(/\d+/.exec(tm.text) || [0])[0]; } catch (x) {}
        return { k: 'perk', j: j, v: v, key: 'perk' + j };
      }
    }
    return { k: 'other', key: 'other:' + nm };
  }
  function navSel(w, c) {
    try {
      if (c.k === 'row') { var r = w.R.DebuffList.GetChild(c.r); return r.Find('Content/DebuffStatusTable/ItemRight/' + (c.b === 'Prev' ? 'ButtonPrevious' : c.b === 'Next' ? 'ButtonNext' : 'ButtonShow')).GetComponent(TY(UE.UI.Selectable)); }
      if (c.k === 'mut') return w.CsObj.transform.Find(CT + 'WidgetExpertModeContent/ExpertModeBuffList').GetChild(c.i).Find('Switcher/Btn').GetComponent(TY(UE.UI.Selectable));
      if (c.k === 'perk') return w.CsObj.transform.Find(CT + 'ExpertBuffBox/ExpertBuffList').GetChild(c.j).Find('Btn').GetComponent(TY(UE.UI.Selectable));
    } catch (x) {}
    return null;
  }
  function navCount(w, path) { var l = w.CsObj.transform.Find(CT + path), n = 0; for (var i = 0; l && i < l.childCount; i++) if (l.GetChild(i).gameObject.activeSelf) n++; return n; }
  // this layout's map: the ring (up / down turn it, wrapping), minus and plus at the core's sides, the perk ticks on the
  // gauge to the left (reached from minus), the mutation chips in the right block (reached from plus)
  function navMove(w, c, dx, dy, nRows) {
    var horiz = Math.abs(dx) >= Math.abs(dy), right = dx > 0, up = dy > 0;
    var selR = D.fr && D.fr.selIdx != null ? D.fr.selIdx : 0;
    if (c.k === 'row') {
      if (!horiz) return { k: 'row', r: ((c.r + (up ? -1 : 1)) % nRows + nRows) % nRows, b: c.b === 'Show' ? 'Prev' : c.b };
      if (c.b === 'Show') return { k: 'row', r: c.r, b: right ? 'Next' : 'Prev' };
      if (c.b === 'Prev') return right ? { k: 'row', r: c.r, b: 'Next' } : (navCount(w, 'ExpertBuffBox/ExpertBuffList') ? { k: 'perk', j: P.navPerk || 0 } : null);
      if (c.b === 'Next') return right ? (navCount(w, 'WidgetExpertModeContent/ExpertModeBuffList') ? { k: 'mut', i: 0 } : null) : { k: 'row', r: c.r, b: 'Prev' };
    }
    if (c.k === 'mut') {
      var n = navCount(w, 'WidgetExpertModeContent/ExpertModeBuffList'), col = c.i % 6;
      if (horiz) { if (!right && col === 0) return { k: 'row', r: selR, b: 'Next' }; var i2 = c.i + (right ? 1 : -1); return i2 >= 0 && i2 < n && Math.floor(i2 / 6) === Math.floor(c.i / 6) ? { k: 'mut', i: i2 } : null; }
      var i3 = c.i + (up ? -6 : 6); return i3 >= 0 && i3 < n ? { k: 'mut', i: i3 } : null;
    }
    if (c.k === 'perk') {
      var np = navCount(w, 'ExpertBuffBox/ExpertBuffList');
      if (horiz && right) return { k: 'row', r: selR, b: 'Prev' };
      if (horiz) return null;
      var j2 = c.j + (up ? 1 : -1); return j2 >= 0 && j2 < np ? { k: 'perk', j: j2 } : null;
    }
    return { k: 'row', r: selR, b: 'Prev' };
  }
  function navListen(w) {
    var g = navGroup(w); if (!g || P.navEv) return;
    try {
      var ev = g.NavigationMove.OnChangeInputGroup;
      // redux-menus 0.1.7 (Fury, 2026-11-07: the analog stick moved two at a time in the pause and dev menus; the same
      // reading is here): the event fires on every change of a stick's value, so a press is the stick crossing half way in
      // a new direction, let go under 0.3; the values in between are the same push
      var dk = function (x, y) { return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'R' : 'L') : (y > 0 ? 'U' : 'D'); };
      P.navFn = function (v) {
        var on = Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5, rest = Math.abs(v.x) < 0.3 && Math.abs(v.y) < 0.3;
        if (!on) { if (rest && P.dir) P.dir.held = false; return; }
        if (P.dir && P.dir.held && dk(P.dir.x, P.dir.y) === dk(v.x, v.y)) return;
        P.dir = { x: v.x, y: v.y, at: UE.Time.unscaledTime, from: P.navFoc, held: true, done: false, ring: { s: D.selIdx, r: D.rot, rt: D.rotTo, ta: D.turnAt, rf: D.rotFrom } };
      };
      ev.AddListener(P.navFn); P.navEv = ev;
    } catch (x) { D.log.push('pop nav: no direction event ' + x); }
  }
  function navUnlisten() { try { if (P.navEv && P.navFn) P.navEv.RemoveListener(P.navFn); } catch (x) {} P.navEv = null; }
  D.V4nav = function (x, y) {   // test only: the game's own navigation event, as a stick or arrow key would raise it
    var w = globalThis.__ev3w, g = w && navGroup(w); if (!g) return 'no group';
    var ev = g.NavigationMove.OnChangeInputGroup; ev.Invoke(new UE.Vector2(x, y)); setTimeout(function () { try { ev.Invoke(new UE.Vector2(0, 0)); } catch (e) {} }, 80); return 'nav ' + x + ',' + y;
  };
  D.V4focus = function () { return P.navFoc ? P.navFoc.key : 'none'; };
  function tickNav(w, t) {
    var g = navGroup(w); if (!g) return;
    navListen(w);
    if (D.V5at != null && UE.Time.frameCount - D.V5at <= 3) return;   // 0.1.16: the v5 screen keeps its own cursor (ownNav)
    var cur = g.CurrentSelectable, key = cur && !cur.Equals(null) ? cur.GetInstanceID() : 0;
    var c = P.navLastId === key && P.navCur ? P.navCur : navClass(w, cur); P.navLastId = key; P.navCur = c;
    var now = UE.Time.unscaledTime, Dd = P.dir, to = null, nRows = (D.fr && D.fr.rows || []).length || 1;
    var prev = P.navFoc;
    // 0.1.7: the game's own navigation steps again while a stick's value is still changing within one push (the pause
    // menu went two tiles for one push, window 5, 2026-11-10): in the first 0.35 s of a push that step is undone, the ring
    // put back where it stood after our own step; after that the game's moves are the held repeat
    if (Dd && Dd.done && prev && c.key === prev.key) Dd.ring = { s: D.selIdx, r: D.rot, rt: D.rotTo, ta: D.turnAt, rf: D.rotFrom };
    if (Dd && prev && Dd.done && Dd.held && c.key !== prev.key && now - Dd.at < 0.35) {
      to = { k: prev.k, r: prev.r, b: prev.b, i: prev.i, j: prev.j };
    } else if (Dd && prev && (!Dd.done ? now - Dd.at > 0.03 : Dd.held && c.key !== prev.key)) {
      var src = !Dd.done ? (Dd.from || prev) : prev; to = navMove(w, src, Dd.x, Dd.y, nRows); Dd.done = true;
      if (!to) to = src;   // no move in this layout: the focus stays where it was
    } else if (c.k === 'other' || c.k === 'none') to = { k: 'row', r: D.fr && D.fr.selIdx || 0, b: 'Prev' };
    if (to) {
      to.key = to.k === 'row' ? 'row' + to.r + to.b : to.k + (to.k === 'mut' ? to.i : to.j);
      // the stock move may already have chosen another row for a frame (the ring started to turn): that is undone first
      if (to.key !== c.key && Dd && Dd.ring && c.k === 'row' && !(to.k === 'row' && to.r === c.r)) { D.selIdx = Dd.ring.s; D.rot = Dd.ring.r; D.rotTo = Dd.ring.rt; D.turnAt = Dd.ring.ta; D.rotFrom = Dd.ring.rf; }
      if (to.key !== c.key) { var s = navSel(w, to); if (s && !s.Equals(null) && s.gameObject.activeInHierarchy) { g.SetCurrentSelectable(s, false, true); c = navClass(w, s); P.navLastId = s.GetInstanceID(); P.navCur = c; } }
    }
    if (c.k === 'perk') P.navPerk = c.j;
    P.navFoc = c;
  }
  // ======== round 3 (2026-11-05, the independent review's majors and quick minors) ========
  function stockRules(w) {
    var PATH = 'BtnController/SafeAreaFitter/Content/ContentMasteAndExpert/', o = [], T = w.CsObj.transform;
    var l = T.Find(PATH + 'ExpertModeContent/ExpertHeatAdditionalContent/ContentList');
    if (l && l.gameObject.activeInHierarchy) for (var i = 0; i < l.childCount; i++) {
      var c = l.GetChild(i); if (!c.gameObject.activeSelf) continue;
      var it = c.Find('Item/Text'), tm = it && it.GetComponent(TY(cs.TMPro.TextMeshProUGUI)); if (tm && String(tm.text).trim()) o.push(tm.text);
    }
    if (!o.length) {
      var hm = T.Find(PATH + 'MasterModeContent/HeatAdditionalContent');
      if (hm && hm.gameObject.activeInHierarchy) {
        var ts = hm.GetComponentsInChildren(TY(cs.TMPro.TextMeshProUGUI), true);
        for (var k = 0; k < ts.Length; k++) { var x = ts.get_Item(k); if (x.gameObject.activeInHierarchy && String(x.text).trim()) o.push(x.text); }
      }
    }
    return o;
  }
  // each rank's distinguishing value (review M4): the numbers that change between the rank sentences; when the sentence
  // is the same at every rank, the rank's own value from HeatUtil; when that is the same too, the effect's short name
  function rankVals(d, max, mode) {
    var key = d.id + ':' + max + ':' + mode; if (P.rvKey === key) return P.rv;
    var HU = require('GamePlay/Heat/HeatUtil').default, U2 = require('Core/Util').U, v = [], s = [], out = [];
    for (var l = 1; l <= max; l++) {
      var copy = Object.create(Object.getPrototypeOf(d)); for (var k of Object.keys(d)) copy[k] = d[k];
      copy.Level = l; try { copy.BuffType = d.BuffType; copy.id = d.id; } catch (x) {}
      var vl = ''; try { vl = HU.GetTotalDebuffValue(copy, mode); } catch (x) {}
      v.push(String(vl)); s.push(String(U2.GetLocale('HeatDebuffDesc_Max_' + d.id, vl) || '').replace(/<[^>]*>/g, ''));
    }
    var nums = s.map(function (x) { return x.match(/[-+]?\d+(\.\d+)?%?/g) || []; });
    var sDiff = s.some(function (x) { return x !== s[0]; }), vDiff = v.some(function (x) { return x !== v[0]; });
    var idx = []; if (sDiff) for (var i = 0; i < nums[0].length; i++) if (nums.some(function (q) { return q[i] !== nums[0][i]; })) idx.push(i);
    var bold = /^\s*([^:]{3,24}):/.exec(s[0]), shortN = bold ? bold[1] : s[0].split(' ').slice(0, 3).join(' ');
    for (var r = 0; r < max; r++) {
      if (sDiff && idx.length) out.push(idx.map(function (i) { var q = nums[r][i] || ''; return /^[-+]/.test(q) ? q : '+' + q; }).join('  '));
      else if (vDiff) out.push(v[r]);
      else out.push(shortN);
    }
    P.rvKey = key; P.rv = out; return out;
  }
  // round 4 (frame time): the groups that move or change every frame get their own sub-canvas, so a change in one of them
  // re-batches that group instead of the whole screen (with the clock paused the screen costs 7 ms a frame, live 17 ms)
  function subCanvases() {
    [V.card, V.right, V.hd, V.dial, P.back, P.top].forEach(function (t) {
      if (!t || t.Equals(null)) return; var c = t.GetComponent(TY(UE.Canvas)); if (!c || c.Equals(null)) t.gameObject.AddComponent(TY(UE.Canvas));
    });
  }
  function buildR3() {
    subCanvases();
    // the hazard ring: a slanted dashed band round the core that turns while the run is near its limit (the shape and
    // motion half of the strain signal)
    if (!TX.haz2) TX.haz2 = spriteOf(tex(512, 512, function (x, y) {
      var r = Math.hypot(x, y), band = cl((r - 0.948) / 0.008) * cl((1 - r) / 0.008), a = Math.atan2(y, x) * 180 / Math.PI;
      var gap = Math.min(Math.abs(a), Math.abs(180 - Math.abs(a))) < 18 ? 0 : 1;
      var u = ((a + 360) / 30 + (r - 0.95) * 6) % 1; return [1, 1, 1, band * gap * (u < 0.55 ? 1 : 0)];
    }));
    if (!TX.haz) TX.haz = spriteOf(tex(256, 256, function (x, y) {
      var r = Math.hypot(x, y), band = cl((r - 0.86) / 0.02) * cl((1 - r) / 0.02);
      var u = (Math.atan2(y, x) / (2 * Math.PI) * 36 + (r - 0.86) * 3) % 1; if (u < 0) u += 1;
      return [1, 1, 1, band * (u < 0.5 ? 1 : 0.12)];
    }));
    P.haz = img(V.dial, 'Hazard', 600, 600, TX.haz2, STRAIN, 0); P.haz.transform.SetSiblingIndex(V.coreRing.transform.GetSiblingIndex() + 1);
    // a perk reached flares on its tick
    P.flareM = lightFx({ _Mode: 1, _Thin: 22, _Core: 1.8, _Halo: 0.5, _Twinkle: 0, _Angle: 0 });
    P.flare = fx(P.tickHost, 'PerkFlare', 160, 160, P.flareM); P.flareAt = null; P.reached = null;
    // the bottom rule ran through the game's prompt bar (review M3): it goes, the foot strip moves up to sit over the bar
    for (var i = 0; i < V.root.childCount; i++) { var c = V.root.GetChild(i); if (c.name.indexOf('EDMBottomRule') === 0) c.gameObject.SetActive(false); }
    var ly = 720 - 1322;
    V.foot.transform.localPosition = H.V3(0, ly);
    var fb = find(V.root, 'FootBlock'); if (fb) fb.transform.localPosition = H.V3(75 - 1280, ly);
    V.footA.transform.sizeDelta = H.V2(900, 36); V.footA.transform.localPosition = H.V3(100 + 450 - 1280, ly);
    V.footB.gameObject.SetActive(false);
    // ultrawide (review m5): the warp field and the stage light run to the screen's sides
    if (V.warp) V.warp.transform.sizeDelta = H.V2(P.scrW, 1440);
    P.stage.transform.sizeDelta = H.V2(Math.min(P.scrW, 3000), 1900);
    P.rvKey = null; P.statB = null; P.cardB = null;
  }
  function tickR3(w, B, t, dt, A, sk, limit, tot, oF, strain, head, mode, selRow) {
    var atLim = limit && head <= 0;
    // ---- M1: the strain signal ----
    var sa = sk * cl(oF / 40);
    iC(P.haz, STRAIN, (atLim ? 0.6 : 0.4) * (0.8 + 0.2 * Math.sin(t / (atLim ? 4 : 9))) * sa);
    if (V.coreRing) { var cr = V.coreRing.color; V.coreRing.color = col([cr.r, cr.g, cr.b], cr.a * (1 - sk)); }
    if (strain && limit) {
      V.limitT.text = atLim ? 'AT THE LIMIT' : 'LIMIT ' + limit + '  ·  ' + head + ' LEFT';
      V.state.color = col(STRAIN, V.state.color.a); V.headBar.color = col(STRAIN, 0.95);
    }
    // ---- m1, m9: no limit state or perk readout where the mode has none; the foot says how much is left (the state word
    // stays in the line over the title) ----
    var hasPerks = perkVals().length > 0;
    act(V.nextL.gameObject, hasPerks); act(V.nextV.gameObject, hasPerks);
    act(V.state.gameObject, !!limit); if (V.stateHex) act(V.stateHex.gameObject, !!limit);
    V.footA.text = !limit ? 'NO ENTROPY LIMIT IN THIS MODE' : head <= 0 ? 'NO ENTROPY TO SPARE' : head + ' ENTROPY TO SPARE';
    V.footA.color = col(strain && limit ? STRAIN : DIM, V.footA.color.a);
    // ---- M4: rank rows carry each rank's own value ----
    if (selRow && selRow.d) {
      var vals = rankVals(selRow.d, selRow.max, w.CurBattleMode);
      for (var r = 0; r < V.rows.length && r < vals.length; r++) V.rows[r].e.text = vals[r];
    } else if (selRow) V.rows.forEach(function (R) { R.e.text = ''; });   // Normal: no per-rank text to read (v3's lines would be stale)
    // ---- m7: the card ends under its last rank row ----
    // round 5 (item 8): the card ends on the columns' common bottom (P.bot); its own need (rows, then the next-rank line)
    var nRk = selRow ? Math.max(1, selRow.max) : 6; P.cardNeed = 764 + nRk * 68 + 64; var cardB = (P.bot || 1196) + ':' + nRk;
    if (P.cardB !== cardB) { cardB = P.bot || 1196;
      P.cardB = (P.bot || 1196) + ':' + nRk; var cf = find(V.card, 'CardFrame');
      if (cf) { cf.transform.sizeDelta = H.V2(600, cardB - 296); cf.transform.localPosition = H.V3(372 - 1280, 720 - (296 + (cardB - 296) / 2)); }
      V.rail.transform.sizeDelta = H.V2(4, nRk * 68 - 12); V.rail.transform.localPosition = H.V3(78 - 1280, 720 - (764 + (nRk * 68 - 12) / 2));
    }
    // ---- m3: the active tab's label at full contrast on a darker plate; m4: the chosen memory block is an edge and a
    // mid fill, not a flat bright block; m6: filled rank cells one value step up ----
    var mi = Math.max(0, MODES.indexOf(mode)), Tb = V.tabs[mi];
    if (Tb && Tb.p.__m) { sF(Tb.p.__m, '_Lit', 1.3); sC(Tb.p.__m, '_Fill', mix([0.006, 0.007, 0.01], A, 0.05), 0.95); Tb.t.color = col(W, Tb.t.color.a); }
    // (round 4: the chosen memory block is coloured with the others in the light pass)
    if (selRow) V.buf.forEach(function (b, i) { if (b.__m && i < selRow.lv) { sC(b.__m, '_Fill', mix([0.02, 0.022, 0.03], A, 0.3), 0.95); sF(b.__m, '_Lit', 1.4); } });
    // ---- M2: a perk reached flares on its tick (the next-perk number moves on by itself) ----
    var vals2 = perkVals();
    var got = vals2.filter(function (v) { return v <= tot; });
    if (P.reachMode !== mode || !P.reached) { P.reachMode = mode; P.reached = got; }
    var fresh = got.filter(function (v) { return P.reached.indexOf(v) < 0; });
    if (fresh.length) { P.flareAt = t; P.flareV = Math.max.apply(null, fresh); }
    P.reached = got;
    var fk = P.flareAt == null ? 1 : (t - P.flareAt) / 30;
    if (fk < 1) {
      var th = 120 + 300 * cl(P.flareV / Math.max(1, V.scale || 200)), a = th * Math.PI / 180, sz2 = 220 - 120 * fk;
      P.flare.transform.localPosition = H.V3(490 * Math.cos(a), -490 * Math.sin(a)); P.flare.transform.sizeDelta = H.V2(sz2, sz2);
      P.flare.color = col(mix(A, W, 0.5), Math.sin(Math.PI * Math.min(1, fk * 1.3 + 0.15)) * D.V4G);
    } else P.flare.color = col(W, 0);
  }
  function tickR2(w, B, t, dt, A, sk, limit, tot, oF) {
    // ---- open sync: ED.reopen() restarts the v4 open too ----
    if (D.openAt !== P.openSeen) { P.openSeen = D.openAt; if (D.openAt != null) { V.openAt = D.openAt; P.stagDone = false; } }
    // ---- contrast: the stage under the dial, panel glass one step up ----
    P.stage.transform.localPosition = H.V3(V.dial.localPosition.x * 0.6, V.dial.localPosition.y * 0.6 - 10);
    iC(P.stage, mix(desat(A, 0.5), [0.5, 0.52, 0.56], 0.35), 0.25 * cl(oF / 40));
    // ---- the memory column runs to the new bottom ----
    // (round 4: dial_v4 applies P.memShift to the memory column itself)
    // ---- 1. the perk tick scale ----
    var scale = Math.max(1, V.scale || 200), vals = [];
    (V.perkNodes || []).forEach(function (N) {
      if (!N.__off) { N.__off = true; N.p.enabled = false; N.t.enabled = false; }   // the boxes go; the ticks below replace them
    });
    vals = perkVals(); var totS = D.totShown || 0, next = null;
    vals.forEach(function (v) { if (v > tot && (next == null || v < next)) next = v; });
    var focV = P.navFoc && P.navFoc.k === 'perk' ? P.navFoc.v : null;   // round 4: the perk under the stock focus
    var marks = vals.map(function (v) { return { v: v, kind: v === next ? 'next' : v <= totS ? 'got' : 'off', foc: v === focV }; });
    if (limit) marks.push({ v: limit, kind: 'lim' });
    while (P.ticks.length < marks.length) { var ti = img(P.tickHost, 'Tick' + P.ticks.length, 30, 3, null, W, 0); P.ticks.push(ti); }
    var pulse = 0.5 + 0.5 * Math.sin(t / 8), hc = mix(A, STRAIN, sk);
    for (var i = 0; i < P.ticks.length; i++) {
      var T = P.ticks[i], M = marks[i];
      if (!M) { iC(T, W, 0); continue; }
      var th = 120 + 300 * cl(M.v / scale), a = th * Math.PI / 180;
      var len = M.foc ? 64 : M.kind === 'lim' ? 56 : M.kind === 'next' ? 44 + 6 * pulse : M.kind === 'got' ? 30 : 22, r0 = M.kind === 'lim' ? 470 : 474, rc = r0 + len / 2;
      var tkey = th.toFixed(2) + ':' + Math.round(len) + M.kind;   // round 4: move a tick only when it changes
      if (T.__tk !== tkey) { T.__tk = tkey; T.transform.localPosition = H.V3(rc * Math.cos(a), -rc * Math.sin(a)); T.transform.localEulerAngles = H.V3(0, 0, -th); T.transform.sizeDelta = H.V2(len, M.kind === 'lim' ? 4 : 3); }
      if (M.foc) { iC(T, W, 1); var fr2 = 552; P.focT.transform.localPosition = H.V3(fr2 * Math.cos(a), -fr2 * Math.sin(a)); P.focT.text = '[ ' + M.v + (M.v <= totS ? '  REACHED' : M.kind === 'next' ? '  NEXT' : '') + ' ]'; iC(P.focT, W, 1); }
      else if (M.kind === 'got') iC(T, mix(hc, W, 0.15), 0.9); else if (M.kind === 'next') iC(T, mix(hc, W, 0.4), 0.55 + 0.45 * pulse);
      else if (M.kind === 'lim') iC(T, mix(W, STRAIN, 0.25 + 0.6 * sk), 0.95); else iC(T, GREY, 0.35);
      if (M.kind === 'next' || M.kind === 'lim') {
        // both labels sit just outside the gauge; when the next perk and the limit are close (Extreme: 105 and 100) they
        // step apart along the arc, the larger value clockwise
        if (focV != null) { iC(M.kind === 'next' ? P.nextT : P.limT, W, 0); continue; }   // a focused perk's label stands alone (round 4)
        var lt = M.kind === 'next' ? P.nextT : P.limT, rl = 548, other = M.kind === 'next' ? limit : next, off = 0;
        if (M.kind === 'next' && other === M.v) { iC(lt, W, 0); continue; }   // the next perk is the limit: MAX says it
        if (other != null && other > 0 && Math.abs(other - M.v) / scale * 300 < 14) off = M.v >= other ? 52 : -52;
        lt.transform.localPosition = H.V3(rl * Math.cos(a) - off * Math.sin(a), -rl * Math.sin(a) - off * Math.cos(a));
        lt.text = M.kind === 'next' ? '' + M.v : 'MAX ' + M.v;
        if (M.kind === 'next') iC(lt, mix(hc, W, 0.5), 0.75 + 0.25 * pulse); else iC(lt, mix(DIM, STRAIN, sk), 0.9);
      }
    }
    if (next == null) iC(P.nextT, W, 0);
    if (focV == null) iC(P.focT, W, 0);
    if (!limit) iC(P.limT, W, 0);
    // ---- 2. mutations, read from the stock menu (nothing is changed) ----
    var L = [], wg = null;
    try { L = w.GetExpertModeBuff() || []; wg = w.widgetExpertModeBuffMap; } catch (x) {}
    // ---- the rules, read where the stock menu shows them (round 3, review m2: v3's fallback read Advanced's hidden list,
    // so Normal and Endless showed Advanced's four rules); a mode with no rules says so ----
    if (!P.rules || P.rulesMode !== w.CurBattleMode + ':' + w.grimTab + ':' + w.endlessTab || t - P.rulesAt > 30) { P.rules = stockRules(w); P.rulesMode = w.CurBattleMode + ':' + w.grimTab + ':' + w.endlessTab; P.rulesAt = t; }
    var rl = P.rules, nR = Math.min(rl.length, V.ruleRows.length);
    for (var rq = 0; rq < V.ruleRows.length; rq++) {
      var RR = V.ruleRows[rq], hasR = rq < Math.max(1, nR);
      [RR.p, RR.h, RR.t].forEach(function (o) { act(o.gameObject, hasR); });
      if (!hasR) continue;
      if (nR) { RR.t.text = rl[rq]; RR.t.color = col(TEXT, 1); RR.p.color = col(W, 1); RR.h.color = col(W, 1); }
      else { RR.t.text = 'This mode has no extra rules.'; RR.t.color = col(DIM, 1); RR.p.color = col(W, 0); RR.h.color = col(W, 0); }
    }
    // the mutation block follows the last rule (review m7: no dead glass between them)
    // round 5 (item 9): the mutation block sits on the status block's bottom when there is room; the gap above it takes the
    // perk progress readout (tickR5)
    var nM0 = Math.min((L && L.length) || 0, (V.muts || []).length), mutH0 = 48 + (nM0 > 6 ? 2 * 52 + 10 : 60) + 22 + 52;
    P.rulesEnd = 680 + Math.max(1, nR) * 96; var mutY = Math.max(P.rulesEnd + 12, 1196 - mutH0 - 8); P.mutTop = mutY;
    var nM = Math.min(L.length || 0, (V.muts || []).length), two = nM > 6, sz = two ? 52 : 60, focus = -1;
    if (P.navFoc && P.navFoc.k === 'mut') focus = P.navFoc.i;   // round 4: the stock focus, read once per frame by tickNav
    if (D.v4mutFocus != null) focus = D.v4mutFocus;   // test only: the stock focus on a mutation, for a picture
    act(V.mutH.gameObject, nM > 0); act(P.mutT.gameObject, nM > 0);
    V.mutH.transform.localPosition = H.V3(V.mutH.transform.localPosition.x, 720 - (mutY + 20));
    var chipY = mutY + 48;
    for (var m = 0; m < (V.muts || []).length; m++) {
      var MU = V.muts[m], ic = P.mutIcons[m], b = L[m], has = m < nM;
      act(MU.gameObject, has);
      if (!has) continue;
      if (MU.__popSz !== sz) { MU.__popSz = sz; MU.transform.sizeDelta = H.V2(sz, sz); ic.transform.sizeDelta = H.V2(sz - 16, sz - 16); }
      var row = two ? Math.floor(m / 6) : 0, col6 = m % 6;
      var mk = chipY + ':' + sz + ':' + row; if (MU.__mk !== mk) { MU.__mk = mk; MU.transform.localPosition = H.V3(2036 + col6 * 74 + sz / 2 - 1280, 720 - (chipY + sz / 2 + row * (sz + 10))); }
      if (ic.__sid !== b.id) { try { var spr0 = wg && wg.get(m) && wg.get(m).R.Img.sprite; if (spr0) { ic.sprite = spr0; ic.__sid = b.id; } } catch (x) {} }
      var lockN = b.IsLock || D.v4mutLock === m;   // test only: ED.v4mutLock shows one chip as locked
      var st = lockN ? 'lock' : b.IsOpen ? 'open' : 'off', mm = MU.__m, foc = m === focus;
      var realSt = b.IsLock ? 'lock' : b.IsOpen ? 'open' : 'off';   // forced test states never count as a change
      if (P.mutSeen[b.id] != null && P.mutSeen[b.id] !== realSt) P.mutLast = { i: m, at: t };
      P.mutSeen[b.id] = realSt;
      if (mm) {
        sF(mm, '_Dash', st === 'lock' ? 1 : 0); sF(mm, '_Lit', st === 'open' ? 1.6 : foc ? 1 : 0.2);
        sC(mm, '_Accent', st === 'open' ? A : desat(A, 0.6), 1); sF(mm, '_AccentMix', st === 'open' ? 0.75 : 0.2);
        sC(mm, '_Line', foc ? W : GREY, foc ? 1 : st === 'open' ? 0.9 : st === 'lock' ? 0.3 : 0.45);
        sC(mm, '_Fill', st === 'open' ? mix([0.012, 0.014, 0.018], A, 0.08) : [0.006, 0.007, 0.009], st === 'lock' ? 0.6 : 0.85);
        sC(mm, '_Glow', A, 0); sF(mm, '_EdgeGlow', foc ? 0.4 * D.V4G : st === 'open' ? 0.2 * D.V4G : 0); sF(mm, '_Run', 0); sF(mm, '_Pulse', 0);
      }
      if (MU.__fs !== foc) { MU.__fs = foc; MU.transform.localScale = H.S3(foc ? 1.1 : 1); }
      iC(ic, W, st === 'open' ? 1 : st === 'off' ? 0.35 : 0.1);
    }
    var pick = focus >= 0 && focus < nM ? focus : P.mutLast && P.mutLast.i < nM ? P.mutLast.i : -1;
    var labY = chipY + (two ? 2 * sz + 10 : sz) + 22;
    if (nM > 0) {
      var U2 = require('Core/Util').U, lab;
      if (pick >= 0) {
        var bb = L[pick], nm = String(U2.GetLocale('ExpertModeBuffName_' + bb.id) || '').replace(/^[^:]*:\s*/, ''), lk2 = bb.IsLock || D.v4mutLock === pick;
        var tip = ''; if (lk2) { try { tip = String(require('GamePlay/Heat/HeatUtil').default.GetExpertModeBuffLockTip(bb) || '').replace(/<[^>]*>/g, ''); } catch (x) {} }
        lab = nm.toUpperCase() + '   ' + (lk2 ? 'LOCKED' + (tip ? '  ' + tip : '') : bb.IsOpen ? 'ON' : 'OFF');
      } else {
        var on = 0, lk = 0; for (var q = 0; q < nM; q++) { if (L[q].IsOpen) on++; if (L[q].IsLock || D.v4mutLock === q) lk++; }
        lab = on + ' OF ' + nM + ' ON' + (lk ? '   ' + lk + ' LOCKED' : '');
      }
      P.mutT.text = lab; P.mutT.color = col(pick >= 0 ? TEXT : DIM, 1);
      P.mutT.transform.localPosition = H.V3(2036 + 220 - 1280, 720 - (labY + 12));
    }
    // the status block and the memory column end together, under the last thing in the block (never above y 1196: the
    // memory column keeps dial_v4's 808 px scale)
    var statB = P.bot = Math.max(1196, nM > 0 ? labY + 52 : mutY, P.cardNeed || 0);   // round 5 (item 8): one bottom
    if (P.statB !== statB) {
      P.statB = statB; var hS = statB - 372;
      V.stat.transform.sizeDelta = H.V2(480, hS); V.stat.transform.localPosition = H.V3(2008 + 240 - 1280, 720 - (372 + hS / 2));
      V.mem.transform.sizeDelta = H.V2(100, hS); V.mem.transform.localPosition = H.V3(1888 + 50 - 1280, 720 - (372 + hS / 2));
    }
    P.memShift = statB - 1196;
    // ---- 3. the hex warp: the open takes the mode's hue; the close runs it backwards into the core ----
    if (V.warpM) {
      var org = new UE.Vector4(V.dial.localPosition.x, V.dial.localPosition.y, 0, 0);
      sF(V.warpM, '_Split', 0.012); sC(V.warpM, '_Tint', A, 1);   // round 5 (item 7) sC(V.warpM, '_Cover', [0.003, 0.004, 0.006], 1); V.warpM.SetVector('_Origin', org);
      var vB = D.B;
      if (D.closeAt != null && vB) {
        if (!P.closing) {
          P.closing = true; P.realG = vB.rootG;
          var go = new UE.GameObject('EDPopCloseStandIn'); P.made.push(go); P.dummyG = go.AddComponent(TY(UE.CanvasGroup)); vB.rootG = P.dummyG;
        }
        var k = (t - D.closeAt) / ((D.F && D.F.close) || 26);
        V.warp.gameObject.SetActive(true); V.warp.transform.SetAsLastSibling();
        V.warpM.SetFloat('_Reverse', 1); V.warpM.SetFloat('_Progress', 0.985 * cl(k / 0.78));   // progress 1 reversed is time 0, where the overlay draws nothing
        // once every cell is shut, the screen under the cover is put away, so fading the cover shows the room, not the dial
        if (k >= 0.8 && !P.hidKids) {
          P.hidKids = [];
          for (var hc2 = 0; hc2 < V.root.childCount; hc2++) { var ch = V.root.GetChild(hc2); if (ch.name !== 'EDMWarp' && ch.gameObject.activeSelf) { ch.gameObject.SetActive(false); P.hidKids.push(ch); } }
        }
        if (P.realG && !P.realG.Equals(null)) P.realG.alpha = 1 - ss((k - 0.8) / 0.2);
      } else {
        if (P.closing) { P.closing = false; if (vB && P.realG && !P.realG.Equals(null)) { vB.rootG = P.realG; P.realG.alpha = 1; } }
        if (P.hidKids) { P.hidKids.forEach(function (ch) { if (ch && !ch.Equals(null)) ch.gameObject.SetActive(true); }); P.hidKids = null; }
        V.warpM.SetFloat('_Reverse', 0);
      }
    }
  }
  function fireRing(t) { var R = P.rings.find(function (r) { return r.at == null; }) || P.rings[0]; R.at = t; }
  function fireBurst(t0) {
    // the chosen slot always comes to rest at 12 o'clock (the ring turns it there), so the burst rises from there
    var p = { x: 0, y: 380 };
    P.bursts.forEach(function (Bu, i) {
      var a = Math.PI / 2 + rnd(-1.3, 1.3);
      Bu.at = t0 + rnd(0, 3); Bu.life = rnd(22, 34); Bu.x = p.x + rnd(-30, 30); Bu.y = p.y + rnd(-20, 30);
      Bu.dx = Math.cos(a); Bu.dy = Math.sin(a); Bu.sp = rnd(2.5, 5); Bu.sz = rnd(6, 11);
    });
  }
  return 'pop on: light budget, core, wipe, springs, depth, atmosphere, type (glow x' + D.V4G + ')';
})();
  }]);

  // ---- core_v5.js ----
  layers.push(['core_v5.js', function () {
// Entropy menu v5: the Entropy Core (docs\redux\ui-desk\ENTROPY_MENU_V5.md, 2026-11-10). The lead: "remake the Entropy
// Menu ... a finished, polished version. Right now it looks like a prototype." Fury, 2026-11-09: the wheel is hard to scroll
// and read; the old list worked better.
// A layer over the v4 dial (packed last by entropyv4\pack_dial.py). v4 keeps running underneath for what it owns: the data
// reads from the stock menu, the clock, the room and its ground, the fonts and materials, the hex warp of the close, the
// palette wipe, the navigation plumbing, the list-view switch and every restore on stop. v4's visible screen (ring, card,
// right column, header, foot) is switched off each frame and this layer draws the v5 screen beside it:
//  - left, a list of every modifier (stock icon, stock sentence, rank pips, the Entropy it adds); up / down pick in list
//    order, left / right lower / raise the picked one (the stock - / + buttons are pressed); LB / RB stay the stock tabs;
//  - centre, the core: a real-time swirl (0.1.18; before it the game's own Entropy schedule vortex plate) inside a gauge ring with a tick per perk, the Mind Crystal
//    equip frame round the total, and layers that join at 25 / 50 / 75 % of the limit; under it a strip of every rank;
//  - right, the picked modifier: its sentence, every rank's value and Entropy, then status, rules and mutations.
// Every effect is a stock UI effect, tinted half way to the mode's hue (the art layer's tint, copied here). Only the
// picked row, the core and the active tab glow. Coordinates: 1080 units high (the root is scaled 4/3 into the 1440 canvas).
// Round 2 (2026-11-10, an independent review's majors): the frame's bloom follows the total, one true limit (the stock
// maxHeatVal), prompts in the device's own pictures and the stock bar's items in v5's footer, Normal's assists in full,
// v4's warp and far-back pillars off, hollow pips at a fixed x, the rank strip as stacks, mutations reachable.
(function () {
  var D = globalThis.ED; if (!D || !D.V4 || !D.V4P || !D.V4L || !D.MH) return 'load pop_v4.js first';
  var UE = cs.UnityEngine, TY = require('puerts').$typeof, H = D.MH, V = D.V4, P = D.V4P, LF = D.V4L;
  var U = require('Core/Util').U, X = require('Gen/Xlsx').Xlsx, HU = require('GamePlay/Heat/HeatUtil').default;
  if (D.V5 && D.V5.made) for (var g0 of D.V5.made) try { UE.Object.Destroy(g0); } catch (x) {}
  var S = D.V5 = { root: null, made: [], err: 0 };
  var MODES = [1, 2, 4, 104, 105];
  var W = [1, 1, 1], TEXT = [0.914, 0.933, 0.965], DIM = [0.553, 0.592, 0.663], FAINT = [0.36, 0.37, 0.40], GREY = [0.62, 0.65, 0.70];
  var AMBER = [1.0, 0.62, 0.2];
  var T4 = 18, T3 = 27, T2 = 54, T1 = 148;   // pop_v4's four sizes (24, 36, 72, 198) in this layer's 1080-unit space
  var PATH = 'BtnController/SafeAreaFitter/Content/';
  var LIST = { x0: -920, x1: -340, top: 342, bot: -432 }, ROWH = 56, PICKH = 84;
  var CORE = { x: 0, y: 24 };
  function cl(k) { return Math.max(0, Math.min(1, k)); }
  function mix(a, b, k) { k = cl(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function col(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? 1 : a); }
  // round 6 (the lead: 'needs more color to match the vibrancy of the original menus'): the mode's hue as a fill of
  // linear value v and saturation s; Normal's ice is nearly white, so its fills take a pale blue
  function tintD(A, v, s) { var m = Math.max(A[0], A[1], A[2], 0.001); return [v * (1 - s + s * A[0] / m), v * (1 - s + s * A[1] / m), v * (1 - s + s * A[2] / m)]; }
  function fillHue(A, mode) { return mode === 1 ? [0.5, 0.78, 1.0] : A; }
  function oc(k) { k = cl(k); return 1 - Math.pow(1 - k, 3); }
  function ss(k) { k = cl(k); return k * k * (3 - 2 * k); }
  function spr(k) { if (k <= 0) return 0; if (k >= 1) return 1; return 1 - Math.exp(-6 * k) * Math.cos(8 * k); }
  function note(s) { D.log.push('v5 ' + s); if (D.log.length > 40) D.log.shift(); }
  // writes only on a change (round 4 of v4: the screen must stay under ~3 ms a frame)
  function near4(o, c, a) { return o && Math.abs(o[0] - c[0]) < 0.002 && Math.abs(o[1] - c[1]) < 0.002 && Math.abs(o[2] - c[2]) < 0.002 && Math.abs(o[3] - a) < 0.002; }
  function iC(im, c, a) { if (a == null) a = 1; if (near4(im.__v5c, c, a)) return; im.__v5c = [c[0], c[1], c[2], a]; im.color = col(c, a); }
  function sT(tm, s) { s = s == null ? '' : '' + s; if (tm.__v5t === s) return; tm.__v5t = s; tm.text = s; }
  function sF(m, k, v) { var c = m.__v5p || (m.__v5p = {}); if (c[k] === v) return; c[k] = v; m.SetFloat(k, v); }
  function sC(m, k, c, a) { if (a == null) a = 1; var cc = m.__v5p || (m.__v5p = {}); if (near4(cc[k], c, a)) return; cc[k] = [c[0], c[1], c[2], a]; m.SetColor(k, col(c, a)); }
  function act(go, on) { if (go.__v5on === on) return; go.__v5on = on; go.SetActive(on); }
  function pos(t, x, y) { var k = t.__v5xy; if (k && Math.abs(k[0] - x) < 0.05 && Math.abs(k[1] - y) < 0.05) return; t.__v5xy = [x, y]; t.localPosition = H.V3(x, y); }
  function scl(t, x, y) { if (y == null) y = x; var k = t.__v5s; if (k && Math.abs(k[0] - x) < 0.0005 && Math.abs(k[1] - y) < 0.0005) return; t.__v5s = [x, y]; t.localScale = H.S3(x, y); }
  function size(t, w, h) { var k = t.__v5z; if (k && Math.abs(k[0] - w) < 0.05 && Math.abs(k[1] - h) < 0.05) return; t.__v5z = [w, h]; t.sizeDelta = H.V2(w, h); }
  function alpha(g, a) { a = cl(a); if (g.__v5a != null && Math.abs(g.__v5a - a) < 0.002) return; g.__v5a = a; g.alpha = a; }

  // ---- builders: nodes, images, plates (the bundle's ED_Plate), texts (the bundle's fonts on a stock label clone) ----
  function node(parent, name, canvas) {
    var t = H.node(parent, 'V5' + name); S.made.push(t.gameObject);
    if (canvas) t.gameObject.AddComponent(TY(UE.Canvas));   // its own batch: a change in one group re-batches only it
    return t;
  }
  function group(t) { var g = t.gameObject.AddComponent(TY(UE.CanvasGroup)); g.interactable = false; g.blocksRaycasts = false; return g; }
  function img(parent, name, w, h, c, a) { var im = H.img(parent, 'V5' + name, w, h, null, c || W, a == null ? 1 : a); S.made.push(im.gameObject); return im; }
  var PM = null;
  function plateMat() {
    if (PM) return PM;
    try { var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)); for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === 'ED_Plate') PM = all.get_Item(i); } catch (x) {}
    return PM;
  }
  function plate(parent, name, w, h, o) {
    o = o || {}; var im = img(parent, name, w, h, W, 1), b = plateMat();
    if (!b) { im.color = col(o.fill || [0.02, 0.022, 0.03], o.alpha == null ? 0.6 : o.alpha); return im; }
    var m = new UE.Material(b); im.material = m; im.__m = m;
    m.SetVector('_Size', new UE.Vector4(w, h, 0, 0)); var c = o.cut || [0, 0, 0, 0]; m.SetVector('_Cut', new UE.Vector4(c[0], c[1], c[2], c[3]));
    sC(m, '_Fill', o.fill || [0.012, 0.014, 0.018], o.alpha == null ? 0.6 : o.alpha); sC(m, '_Line', GREY, o.lineA == null ? 0.25 : o.lineA); sF(m, '_LineW', o.lineW || 1.5);
    if (o.bracket) { sF(m, '_Bracket', 1); sF(m, '_BracketLen', o.bracket); sF(m, '_BracketW', 2); sC(m, '_BracketColor', GREY, 0.4); } else sF(m, '_Bracket', 0);
    sF(m, '_Raised', o.raised ? 1 : 0); sF(m, '_Hex', o.hex ? 1 : 0); sF(m, '_Dash', 0);
    sF(m, '_Lit', o.lit == null ? 0.2 : o.lit); sF(m, '_Weave', o.weave == null ? 0.12 : o.weave); sF(m, '_Rim', 0.25);
    sF(m, '_Run', 0); sF(m, '_EdgeGlow', 0); sF(m, '_Pulse', 0); sC(m, '_Glow', W, 0); sC(m, '_Accent', GREY, 1); sF(m, '_AccentMix', 0.2);
    return im;
  }
  function plateSize(im, w, h) { size(im.transform, w, h); if (im.__m) { var k = im.__v5ps; if (!k || k[0] !== w || k[1] !== h) { im.__v5ps = [w, h]; im.__m.SetVector('_Size', new UE.Vector4(w, h, 0, 0)); } } }
  function fontFor(kind) {
    var F = V.fonts || {}, want = { display: /aldrich/i, body: /chakra.*semi/i, bodyR: /chakra.*reg/i, data: /share.*mono/i }[kind || 'display'];
    for (var k in F) if (want.test(k)) return F[k];
    return null;
  }
  function label(parent, name, fs, w, h, align, kind, c) {
    var tm = H.txt(parent, 'V5' + name, fs, w, h, align || 514); S.made.push(tm.gameObject); tm.gameObject.SetActive(true);
    var f = fontFor(kind); if (f) { tm.font = f; tm.fontSharedMaterial = f.material; }
    tm.color = col(c || TEXT, 1); tm.enableWordWrapping = false; tm.overflowMode = 0;
    return tm;
  }

  // ---- stock effects, tinted half way (the art layer's tint, copied: the art layer stops running once the dial is lean) ----
  function hsvOf(c) {
    var r = c.r, g = c.g, b = c.b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 1e-5) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    if (h < 0) h += 360; return { h: h, s: mx > 0 ? d / mx : 0, v: mx };
  }
  function rgbOf(h, s, v, a) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0, k = Math.floor(h / 60) % 6;
    if (k === 0) { r = c; g = x; } else if (k === 1) { r = x; g = c; } else if (k === 2) { g = c; b = x; } else if (k === 3) { g = x; b = c; } else if (k === 4) { r = x; b = c; } else { r = c; b = x; }
    return new UE.Color(r + m, g + m, b + m, a);
  }
  function rehue(c, deg) { var q = hsvOf(c); if (q.s < 0.15) return null; return rgbOf(deg, Math.min(1, q.s * 0.9), q.v, c.a); }
  // the donors as first seen, kept for the whole game session (a reload of the layers must not take a pooled effect's tinted
  // copy for its original: RoomSelectBgLoop came back invisible that way in window 2, 2026-11-10)
  var TC = globalThis.__EDV5TINT = globalThis.__EDV5TINT || { to: {}, om: {}, gc: {}, ts: {} }, TO = TC.to, OM = TC.om, GC = TC.gc, TS = TC.ts;
  function tinters(root, deg) {
    var ts = U.GetComponentsInChildren(root.gameObject, cs.NOAH.VFX.MaterialTinter, true);
    for (var k = 0; k < ts.Length; k++) {
      var ins = ts.get_Item(k).MaterialInterpolators;
      for (var j = 0; ins && j < ins.Length; j++) {
        var it = ins.get_Item(j); if (it.GetType().Name !== 'MaterialColorInterpolator') continue;
        var id = it.GetHashCode(); if (!TO[id]) TO[id] = { a: it.startValue, b: it.endValue };
        var o = TO[id], a = deg == null ? null : rehue(o.a, deg), b = deg == null ? null : rehue(o.b, deg);
        it.startValue = a || o.a; it.endValue = b || o.b;
      }
    }
  }
  function rehueGrad(g, deg) {
    var ks = g.colorKeys, n = [];
    for (var i = 0; i < ks.Length; i++) { var k = ks.get_Item(i), c = rehue(k.color, deg); n.push(new UE.GradientColorKey(c || k.color, k.time)); }
    var arr = cs.System.Array.CreateInstance(TY(UE.GradientColorKey), n.length); for (var j = 0; j < n.length; j++) arr.set_Item(j, n[j]);
    var out = new UE.Gradient(); out.SetKeys(arr, g.alphaKeys); out.mode = g.mode; return out;
  }
  function rehueMM(mm, deg) {
    var M = +mm.mode;
    if (M === 0) { var c = rehue(mm.color, deg); return c ? new UE.ParticleSystem.MinMaxGradient(c) : null; }
    if (M === 2) { var a = rehue(mm.colorMin, deg) || mm.colorMin, b = rehue(mm.colorMax, deg) || mm.colorMax; return new UE.ParticleSystem.MinMaxGradient(a, b); }
    if (M === 1 || M === 4) { var g = new UE.ParticleSystem.MinMaxGradient(rehueGrad(mm.gradient, deg)); g.mode = mm.mode; return g; }
    if (M === 3) return new UE.ParticleSystem.MinMaxGradient(rehueGrad(mm.gradientMin, deg), rehueGrad(mm.gradientMax, deg));
    return null;
  }
  function psTint(root, deg) {
    var ps = root.GetComponentsInChildren(TY(UE.ParticleSystem), true);
    for (var i = 0; i < ps.Length; i++) {
      var p = ps.get_Item(i);
      try { var mm = p.main, sc = rehueMM(mm.startColor, deg); if (sc) mm.startColor = sc; } catch (x) {}
      try { var co = p.colorOverLifetime; if (co.enabled) { var cc = rehueMM(co.color, deg); if (cc) co.color = cc; } } catch (x) {}
    }
  }
  var DONOR = [1, 0.2, 0.75];
  function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function texBaked(mt) {
    if (!mt) return false; var nm = mt.name; if (TS[nm] != null) return TS[nm];
    var res = /c$/.test(nm);
    try {
      var rt = UE.RenderTexture.GetTemporary(32, 32, 0); UE.Graphics.Blit(mt, rt); var pv = UE.RenderTexture.active; UE.RenderTexture.active = rt;
      var tx = new UE.Texture2D(32, 32, UE.TextureFormat.RGBA32, false); tx.ReadPixels(new UE.Rect(0, 0, 32, 32), 0, 0); tx.Apply();
      UE.RenderTexture.active = pv; UE.RenderTexture.ReleaseTemporary(rt);
      var r = 0, g = 0, b = 0, w = 0;
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var c = tx.GetPixel(x, y), k = Math.max(c.r, c.g, c.b) * c.a; r += c.r * k; g += c.g * k; b += c.b * k; w += k; }
      UE.Object.Destroy(tx);
      if (w) { var hi = Math.max(r, g, b), lo = Math.min(r, g, b); res = hi > 0 && (hi - lo) / hi > 0.15; }
    } catch (x) {}
    return (TS[nm] = res);
  }
  function matTint(id, m0, deg) {
    var m = OM[id] || (OM[id] = m0); if (!m) return null;
    var tc = rgbOf(deg, 0.6, 1, 1), t = [tc.r, tc.g, tc.b], k = lum(DONOR) / lum(t);
    var comp = [t[0] / DONOR[0] * k, t[1] / DONOR[1] * k, t[2] / DONOR[2] * k];
    var sh = m.shader, pc = sh.GetPropertyCount(), baked = texBaked(m.mainTexture), cp = new UE.Material(m);
    for (var j = 0; j < pc; j++) {
      if (+sh.GetPropertyType(j) !== 0) continue; var nm = sh.GetPropertyName(j), c = m.GetColor(nm);
      if (baked && nm === '_TintColor') cp.SetColor(nm, new UE.Color(c.r * comp[0], c.g * comp[1], c.b * comp[2], c.a));
      else { var nc = rehue(c, deg); if (nc) cp.SetColor(nm, nc); }
    }
    return cp;
  }
  function prTint(root, deg) {
    var rs = root.GetComponentsInChildren(TY(UE.ParticleSystemRenderer), true);
    for (var i = 0; i < rs.Length; i++) { var r = rs.get_Item(i), rid = r.GetInstanceID(); if (tinted(r)) { if (OM[rid]) r.sharedMaterial = OM[rid]; continue; } var cp = matTint(rid, r.sharedMaterial, deg); if (cp) r.sharedMaterial = cp; }
  }
  // does a MaterialTinter animate this part's material (the same object, as the effects are built)?
  function tinted(c) { try { var t = c.gameObject.GetComponent(TY(cs.NOAH.VFX.MaterialTinter)); return !!t && !t.Equals(null); } catch (x) { return false; } }
  // the Graphic colour moved k of the way from white to the hue (the art layer's 'half way' is k 0.5)
  function tintCol(deg, k) { var c = rgbOf(deg, 0.75, 1, 1); return new UE.Color(1 + (c.r - 1) * k, 1 + (c.g - 1) * k, 1 + (c.b - 1) * k, 1); }
  function degOf(c) { return hsvOf(new UE.Color(c[0], c[1], c[2], 1)).h; }
  // one stock effect on host at (x, y); life in frames (0: kept, a loop); returns { go, e, end }
  // one stock effect on host at (x, y); life in frames (0: kept, a loop). On a cold cache the player loads the effect
  // asynchronously: p.Effect is null right after PlayEffect (seen on the first open after a cold boot, window 2,
  // 2026-11-10), so the play is kept pending and dressed (tint, parts off, post) when the effect arrives; a one-shot's
  // life starts then. A play that never arrives is given up after GRACE frames.
  var GRACE = 600;
  function fx(host, name, x, y, s, deg, life, rot, tk, opt) {
    var go = new UE.GameObject('V5fx_' + name, TY(UE.RectTransform)); go.layer = host.gameObject.layer; D.made.push(go); S.made.push(go);
    var rt = go.transform; rt.SetParent(host, false); rt.anchorMin = H.V2(0.5, 0.5); rt.anchorMax = H.V2(0.5, 0.5); rt.pivot = H.V2(0.5, 0.5);
    rt.sizeDelta = H.V2(100, 100); rt.anchoredPosition = H.V2(x || 0, y || 0); if (rot) rt.localEulerAngles = H.V3(0, 0, rot);
    var p = go.AddComponent(TY(cs.NOAH.VFX.VFXEffectPlayer)); p.m_param = new cs.EffectPlayParamEx();
    p.m_param.name = 'UI/Common/' + name; p.m_param.target = rt; p.m_param.bind = true; p.m_param.AutoOrder = true;
    p.m_param.localScale = H.V3(s || 1, s || 1, 1);
    var o = { go: go, p: p, e: null, host: rt, name: name, deg: deg, tk: tk, life: life || 0, end: 0, born: D.t, post: opt && opt.post, off: opt && opt.off };
    try { p.PlayEffect(1); } catch (e) { note('fx ' + name + ' EXC ' + e); }
    if (life) S.fx.push(o);
    if (!arrive(o)) { o.waiting = true; (S.pend || (S.pend = [])).push(o); }
    return o;
  }
  // the effect is there: dress it once
  function arrive(o) {
    var e = null; try { e = o.p.Effect; } catch (x) { e = null; }
    if (!e || e.Equals(null)) return false;
    o.e = e; if (o.life) o.end = D.t + o.life;
    if (o.waiting) { o.waiting = false; S.lateN = (S.lateN || 0) + 1; if (S.lateN <= 12) note('late fx ' + o.name + ' after ' + Math.round(D.t - o.born) + ' f'); }
    var deg = o.deg, e2 = e;
    try {
      // the tinter's own colours stay the donor's (a pooled play may wear an earlier build's re-hue)
      tinters(e2.transform, null);
      var gs = U.GetComponentsInChildren(e2.gameObject, UE.UI.Graphic, true);
      for (var i = 0; i < gs.Length; i++) {
        var gg = gs.get_Item(i), gid = gg.GetInstanceID(); if (!GC[gid]) GC[gid] = gg.color;
        if (deg == null) { gg.color = GC[gid]; if (OM[gid]) gg.material = OM[gid]; continue; }   // the donor's own colours
        gg.color = GC[gid]; dressPart(o, gg, false, deg);
      }
      var rr = e2.transform.GetComponentsInChildren(TY(UE.ParticleSystemRenderer), true);
      for (var j = 0; j < rr.Length; j++) { var r0 = rr.get_Item(j), rid = r0.GetInstanceID(); if (deg == null) { if (OM[rid]) r0.sharedMaterial = OM[rid]; continue; } dressPart(o, r0, true, deg); }
      if (deg != null) psTint(e2.transform, deg);
    } catch (x) { note('tint ' + o.name + ' EXC ' + x); }
    if (o.off) try { var ch = e2.GetComponentsInChildren(TY(UE.Transform), true); for (var k = 0; k < ch.Length; k++) if (o.off.indexOf(ch.get_Item(k).name) >= 0) ch.get_Item(k).gameObject.SetActive(false); } catch (x) {}
    if (o.post) try { o.post(e2); } catch (x) {}
    return true;
  }
  // ---- the mode's colour on a part, fully (round 4: the lead wanted round 2's vivid core back) ----
  // every part gets a private copy of its material with each colour moved to the mode's hue and most of the way to its
  // saturation (value and alpha kept); a colour texture with the donor's rose baked in is moved on its _TintColor. A part
  // the game animates (a MaterialTinter on its object) is followed: each frame the animated properties are read from the
  // game's own material, which the tinter keeps driving, and written to the copy through the same colour move. So the
  // copy is never a frozen snapshot (round 3's cold-boot fault) and never the dull half-way tint (round 3's look).
  var CP = {};
  function colProps(sh) { var k = sh.name; if (CP[k]) return CP[k]; var out = [], n = sh.GetPropertyCount(); for (var i = 0; i < n; i++) if (+sh.GetPropertyType(i) === 0) out.push(sh.GetPropertyName(i)); return (CP[k] = out); }
  function modeS() { var c = S.hueNow || [1, 0.25, 0.42], q = hsvOf(new UE.Color(c[0], c[1], c[2], 1)); return Math.max(0.35, q.s); }
  function xcol(c, n, baked, deg, s0) {
    if (baked && n === '_TintColor') { var tc = rgbOf(deg, s0, 1, 1), t = [tc.r, tc.g, tc.b], k = lum(DONOR) / lum(t); return new UE.Color(c.r * t[0] / DONOR[0] * k, c.g * t[1] / DONOR[1] * k, c.b * t[2] / DONOR[2] * k, c.a); }
    var q = hsvOf(c); if (q.v < 0.004) return c;
    return rgbOf(deg, Math.min(1, q.s + (s0 - q.s) * 0.85), q.v, c.a);
  }
  function dressPart(o, part, isR, deg) {
    var id = part.GetInstanceID(), src = OM[id]; if (!src || src.Equals(null)) src = OM[id] = isR ? part.sharedMaterial : part.material;
    if (!src || src.Equals(null)) return;
    var s0 = modeS(), cp = new UE.Material(src), baked = texBaked(src.mainTexture), cols = colProps(src.shader);
    for (var i = 0; i < cols.length; i++) cp.SetColor(cols[i], xcol(src.GetColor(cols[i]), cols[i], baked, deg, s0));
    if (isR) part.sharedMaterial = cp; else part.material = cp;
    var T = null; try { T = part.gameObject.GetComponent(TY(cs.NOAH.VFX.MaterialTinter)); } catch (x) {}
    if (!T || T.Equals(null)) return;
    var ins = T.MaterialInterpolators, rec = { o: o, src: src, dst: cp, c: [], v: [], f: [], baked: baked, deg: deg, s0: s0 };
    for (var j = 0; ins && j < ins.Length; j++) {
      var it = ins.get_Item(j), tn = it.GetType().Name, pn = null; try { pn = it.propName; } catch (x) {}
      if (!pn) continue; if (/Color/.test(tn)) rec.c.push(pn); else if (/Vector/.test(tn)) rec.v.push(pn); else if (/Float/.test(tn)) rec.f.push(pn);
    }
    if (rec.c.length || rec.v.length || rec.f.length) (S.follow || (S.follow = [])).push(rec);
  }
  function followTick() {
    var L = S.follow; if (!L || !L.length) return;
    for (var i = L.length - 1; i >= 0; i--) {
      var r = L[i], o = r.o, gone = false; try { gone = !o.go || o.go.Equals(null) || r.dst.Equals(null) || r.src.Equals(null); } catch (x) { gone = true; }
      if (gone || o.dead) { L.splice(i, 1); continue; }
      try {
        for (var a = 0; a < r.c.length; a++) r.dst.SetColor(r.c[a], xcol(r.src.GetColor(r.c[a]), r.c[a], r.baked, r.deg, r.s0));
        for (var b = 0; b < r.v.length; b++) r.dst.SetVector(r.v[b], r.src.GetVector(r.v[b]));
        for (var d = 0; d < r.f.length; d++) r.dst.SetFloat(r.f[d], r.src.GetFloat(r.f[d]));
      } catch (x) { L.splice(i, 1); }
    }
  }
  // every frame: plays still waiting for their effect
  function pendTick() {
    var L = S.pend; if (!L || !L.length) return;
    for (var i = L.length - 1; i >= 0; i--) {
      var o = L[i], gone = false; try { gone = !o.go || o.go.Equals(null); } catch (x) { gone = true; }
      if (gone || !o.waiting) { L.splice(i, 1); continue; }
      if (arrive(o)) { L.splice(i, 1); continue; }
      if (D.t - o.born > GRACE) { o.waiting = false; o.dead = true; L.splice(i, 1); note('fx ' + o.name + ' never arrived'); }
    }
  }
  // a kept play has ended when its effect went back to the pool; a pending one only once its grace is over
  function fxEnded(o) {
    if (!o.e) return !!o.dead || D.t - o.born > GRACE;
    try { var e = o.e; return e.Equals(null) || !e.gameObject.activeInHierarchy || !e.transform.parent || !e.transform.parent.Equals(o.host); } catch (x) { return true; }
  }
  function kill(o) { if (o) try { UE.Object.Destroy(o.go); } catch (x) {} }
  // a loop on its own host: alpha through a CanvasGroup (the donor's colours stay), replayed when the effect returns to the pool
  function loop(parent, name, fxName, s, x, y, tk) { var t = node(parent, name); pos(t, x || 0, y || 0); return { t: t, g: group(t), fx: fxName, s: s, o: null, deg: null, tk: tk }; }
  function loopTick(L, want, deg, scale) {
    alpha(L.g, want);
    if (want <= 0.001) { if (L.o && L.idle == null) L.idle = D.t; if (L.o && D.t - L.idle > 30) { kill(L.o); L.o = null; } return; }
    L.idle = null;
    // has it gone back to the pool? every frame for a one-shot replayed as a loop (round 5: the 50 % swirl was gone for
    // up to 8 frames plus its own fade at each end, so a picture often missed it), else every 8th frame
    var stale = !L.o || L.deg !== deg || ((L.oneShot || S.fc % 8 === 0) && fxEnded(L.o));
    if (stale) {
      kill(L.o); L.o = fx(L.t, L.fx, 0, 0, L.s, deg, 0, 0, L.tk, { post: L.post, off: L.off }); L.deg = deg;
    }
    if (scale != null) scl(L.t, scale);
  }

  // ---- data ----
  function modeOpen(m) { try { return m === 1 || !!HU.ModeOpen(m); } catch (x) { return true; } }
  function sanAt(id, l, mode) { if (!l) return 0; try { var e = X.HeatPunishConf.All.find(function (e) { return e.id == id && e.level == l && e.mode == mode; }); return e ? e.san : 0; } catch (x) { return 0; } }
  function clean(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function copyAt(d, l) { var c = Object.create(Object.getPrototypeOf(d)); for (var k of Object.keys(d)) c[k] = d[k]; c.Level = l; try { c.BuffType = d.BuffType; c.id = d.id; } catch (x) {} return c; }
  // a rank's stock sentence and its value: a modifier (HeatDebuffDesc_Max_), or Normal's assist (HeatAssistBuff_, as
  // NormalBuffItem.ValChange writes it)
  function sentence(R, l, mode) {
    if (R.d) { var v = ''; try { v = HU.GetTotalDebuffValue(copyAt(R.d, l), mode); } catch (x) {} return { s: clean(U.GetLocale('HeatDebuffDesc_Max_' + R.d.id, v)), v: String(v) }; }
    if (R.b) { var a = ''; try { a = HU.GetNormalBuffValue(copyAt(R.b, l)).toFixed(0); } catch (x) {} return { s: clean(U.GetLocale('HeatAssistBuff_' + R.b.id, a)), v: a }; }
    return { s: clean(R.name), v: '' };
  }
  // a row's words: the stock sentence at its rank (rank 1's for an off row, in every mode); a named Grim modifier keeps
  // its name as the title and the rest as the description
  var TCACHE = {};
  function rowWords(R, mode) {
    var key = R.id + ':' + R.lv + ':' + mode; if (TCACHE[key]) return TCACHE[key];
    var s = R.lv > 0 ? clean(R.name) : sentence(R, 1, mode).s || clean(R.name);
    var m = /^\s*([^:]{3,32}):\s*(.*)$/.exec(s), out = m ? { title: m[1], desc: m[2] } : { title: s, desc: '' };
    return (TCACHE[key] = out);
  }
  // each rank's own value (pop_v4's rankVals): the numbers that change between the rank sentences
  var RV = {};
  function rankVals(R, max, mode) {
    var key = R.id + ':' + max + ':' + mode; if (RV[key]) return RV[key];
    var v = [], s = [], out = [];
    for (var l = 1; l <= max; l++) { var q = sentence(R, l, mode); v.push(q.v); s.push(q.s); }
    var nums = s.map(function (x) { return x.match(/[-+]?\d+(\.\d+)?%?/g) || []; });
    var sDiff = s.some(function (x) { return x !== s[0]; }), vDiff = v.some(function (x) { return x !== v[0]; }), idx = [];
    if (sDiff && nums.length) for (var i = 0; i < nums[0].length; i++) if (nums.some(function (q) { return q[i] !== nums[0][i]; })) idx.push(i);
    for (var r = 0; r < max; r++) {
      if (sDiff && idx.length) out.push(idx.map(function (i) { var q = nums[r][i] || ''; return /^[-+]/.test(q) ? q : '+' + q; }).join('  '));
      else if (vDiff) out.push(v[r]);
      else out.push('');
    }
    return (RV[key] = { vals: out, sent: s });
  }
  function stockRules(w) {
    var o = [], T = w.CsObj.transform, l = T.Find(PATH + 'ContentMasteAndExpert/ExpertModeContent/ExpertHeatAdditionalContent/ContentList');
    if (l && l.gameObject.activeInHierarchy) for (var i = 0; i < l.childCount; i++) {
      var c = l.GetChild(i); if (!c.gameObject.activeSelf) continue;
      var it = c.Find('Item/Text'), tm = it && it.GetComponent(TY(cs.TMPro.TextMeshProUGUI)); if (tm && clean(tm.text)) o.push(clean(tm.text));
    }
    if (!o.length) {
      var hm = T.Find(PATH + 'ContentMasteAndExpert/MasterModeContent/HeatAdditionalContent');
      if (hm && hm.gameObject.activeInHierarchy) { var ts = hm.GetComponentsInChildren(TY(cs.TMPro.TextMeshProUGUI), true); for (var k = 0; k < ts.Length; k++) { var x = ts.get_Item(k); if (x.gameObject.activeInHierarchy && clean(x.text)) o.push(clean(x.text)); } }
    }
    return o;
  }
  // the limit, as the stock menu enforces it (HeatMenu.ChangeMasterDebuff): maxHeatVal is the player's limit now; on Grim
  // the rule's 175 (HeatUtil.GetTotalHeatVal) is the ceiling it rises to by clearing Grim with enough Entropy
  function limitOf(w, mode) { if (mode === 1) return 0; var m = 0; try { m = +w.maxHeatVal || 0; } catch (x) {} if (!m) { var lm = /(\d+)/.exec((D.B && D.B.limit && D.B.limit.text) || ''); m = lm ? +lm[1] : 0; } return m; }
  function limitNote(w, limit) {
    try {
      var total = HU.GetTotalHeatVal(), grim = !!w.grimTab;
      if (!limit || (grim ? limit >= total : limit >= 100)) return '';
      var need = X.HeatLevelConf.Get(w.CurHeatLevel).params[1], msg = clean(U.GetLocale(grim ? 'GRIM_ReachMaxHeatVal' : 'Heat_ReachMaxHeatVal', need));
      var bang = msg.indexOf('!'); if (bang >= 0 && bang < msg.length - 1) msg = msg.slice(bang + 1).trim();   // the stock toast opens with "Limit reached!"
      return 'Your limit is ' + limit + ' now. ' + msg;
    } catch (x) { return ''; }
  }
  function perkVals() { return ((V.perkCache && V.perkCache.out) || []).map(function (p) { return p.at; }); }
  // the stock row behind list row k (its - and + buttons)
  function deep(t, name, d) { if (!t || d > 6) return null; var f = t.Find(name); if (f) return f; for (var i = 0; i < t.childCount; i++) { var r = deep(t.GetChild(i), name, d + 1); if (r) return r; } return null; }
  function stockRow(w, k) {
    var cn = w.CsObj.transform.Find(PATH + 'ContentNormal'), nor = cn && cn.gameObject.activeInHierarchy, list = nor ? cn.Find('NormalBuffList') : w.R.DebuffList;
    for (var i = 0, n = 0; list && i < list.childCount; i++) { var r = list.GetChild(i); if (!r.gameObject.activeSelf) continue; if (!nor && !r.Find('Content/DebuffStatusTable')) continue; if (n === k) return r; n++; }
    return null;
  }
  function press(w, k, up) {
    var r = stockRow(w, k), b = r && deep(r, up ? 'ButtonNext' : 'ButtonPrevious', 0), bt = b && b.GetComponent(TY(UE.UI.Button));
    if (!bt || bt.Equals(null) || !bt.interactable) return false;
    bt.onClick.Invoke(); return true;
  }
  D.V5press = function (up) { var w = globalThis.__ev3w; return w && D.fr ? press(w, D.fr.selIdx, !!up) : false; };   // test: the same press as left / right
  D.V5pressRow = function (k, up) { var w = globalThis.__ev3w; return w ? press(w, k, !!up) : false; };   // test: rank row k up or down

  // ---- prompts: the device in use, as the game draws its own (fourlobbyui's BB4UI.promptGlyph; keyboard keys from the
  // Control atlas) ----
  function isPad() { try { var c = cs.Rewired.ReInput.players.GetPlayer(0).controllers.GetLastActiveController(); return !!c && c.type == cs.Rewired.ControllerType.Joystick; } catch (x) { return false; } }
  var GSP = {};
  function ctlSprite(name) { var c0 = GSP[name]; if (c0 && !c0.Equals(null)) return c0; var s = null; try { s = globalThis.__ev3w.LoadSprite('UI/Atlas/Control/Control', name); if (s && !s.name) s = null; } catch (x) { s = null; } if (s) GSP[name] = s; return s; }
  function pg(id) { try { var B = globalThis.BB4UI; return B && B.promptGlyph ? B.promptGlyph(id) : null; } catch (x) { return null; } }
  // 'A' / 'D' lower and raise (the navigation axis on a pad), 'L' the list view (Y on a pad), else a Rewired action id
  function glyphOf(id) {
    var pad = isPad();
    if (id === 'L') return pad ? pg(24) : { sp: ctlSprite('KB_L_PB_1'), key: 'L' };
    if (id === 'A' || id === 'D') return pad ? pg(34) : { sp: ctlSprite('KB_' + id + '_PB_1'), key: id };
    return pg(id);
  }
  function prompt(parent, name, align) {
    var t = node(parent, name), im = img(t, 'G', 40, 40, W, 1); im.preserveAspect = true;
    var kt = label(t, 'K', 15, 60, 30, 514, 'body', TEXT), lb = label(t, 'T', T4, 260, 30, align || 4097, 'body', TEXT);
    return { t: t, im: im, kt: kt, lb: lb, sig: null, w: 0 };
  }
  // the glyph on the left of the label (or right when after is set); returns the item's width
  function setPrompt(Q, g, text, after) {
    var sp = g && g.sp ? g.sp : null, key = sp ? '' : (g && g.key) || '', sig = (sp ? sp.name : '') + '|' + key + '|' + text + '|' + !!after;
    if (Q.sig === sig) return Q.w; Q.sig = sig;
    if (sp) { Q.im.sprite = sp; act(Q.im.gameObject, true); } else act(Q.im.gameObject, false);
    sT(Q.kt, key ? '[' + key + ']' : ''); sT(Q.lb, text);
    var lw = text ? Math.ceil(Q.lb.preferredWidth) + 6 : 0, gw = sp ? 40 : key ? Math.ceil(Q.kt.preferredWidth) + 6 : 0;
    size(Q.lb.transform, lw, 30);
    if (after) { pos(Q.lb.transform, -(lw + gw + 6) / 2 + lw / 2, 0); pos(Q.im.transform, (lw + gw + 6) / 2 - gw / 2, 0); pos(Q.kt.transform, (lw + gw + 6) / 2 - gw / 2, 0); }
    else { pos(Q.im.transform, -(lw + gw + 6) / 2 + gw / 2, 0); pos(Q.kt.transform, -(lw + gw + 6) / 2 + gw / 2, 0); pos(Q.lb.transform, (lw + gw + 6) / 2 - lw / 2, 0); }
    return (Q.w = lw + gw + 6);
  }

  // ---- input: v4's plumbing reads the direction (P.dir, from the stock navigation event); up / down stay its row moves
  // (list order); down from the last row goes to the mutations and up from them comes back; left / right press the picked
  // row's - / + instead of moving the focus ----
  var CT = PATH + 'ContentMasteAndExpert/ExpertModeContent/';
  function mutSel(w, i) { try { var l = w.CsObj.transform.Find(CT + 'WidgetExpertModeContent/ExpertModeBuffList'); if (!l || !l.gameObject.activeInHierarchy || i >= l.childCount) return null; var b = l.GetChild(i).Find('Switcher/Btn'), s = b && b.GetComponent(TY(UE.UI.Selectable)); return s && !s.Equals(null) && s.gameObject.activeInHierarchy ? s : null; } catch (x) { return null; } }
  function rowSel(w, r) { try { var s = w.R.DebuffList.GetChild(r).Find('Content/DebuffStatusTable/ItemRight/ButtonNext'), q = s && s.GetComponent(TY(UE.UI.Selectable)); return q && !q.Equals(null) && q.gameObject.activeInHierarchy ? q : null; } catch (x) { return null; } }
  function focusTo(sel, c) { var g = P.navG; if (!g || !sel) return false; g.SetCurrentSelectable(sel, false, true); P.navFoc = c; P.navCur = c; P.navLastId = sel.GetInstanceID(); return true; }
  // 0.1.16 (Fury, 2026-11-11: with a mouse the menu flipped between the modifiers and the mutations, a pad had the same
  // fault on the mutations, and a stick pushed right picked the row above or below). Until now the game's own focus was
  // followed and corrected after each of its moves, and the game also moved it under the mouse, onto stock buttons this
  // screen hides. Now the screen keeps its own cursor (a zone, the rows or the mutations, and an index), only this code
  // moves it, and the game's focus is put on it every frame.
  var MUCOLS = 10;
  var N5 = { zone: 'rows', r: 0, m: 0, rep: 0, sw: false, ml: false, mr: false, mk: null, tabQ: 0, tabAt: 0 };
  D.V5cursor = function () { return N5.zone + ':' + (N5.zone === 'rows' ? N5.r : N5.m); };   // test: where the cursor is
  D.V5swap = function () { N5.swapNow = true; return 'swap'; };                               // test: the swap key
  D.V5tab = function (d) { N5.tabQ = d | 0; return 'tab ' + N5.tabQ; };                       // test: d difficulty tabs to the right (left when negative)
  function mutN(w) { var c = 0; try { var l = w.CsObj.transform.Find(CT + 'WidgetExpertModeContent/ExpertModeBuffList'); if (l && l.gameObject.activeInHierarchy) for (var i = 0; i < l.childCount; i++) if (l.GetChild(i).gameObject.activeSelf) c++; } catch (x) {} return Math.min(12, c); }
  // the swap key: M on a keyboard, RT (the game's action 59) on a pad; a press is "held now, not at the last look"
  function swapHeld() {
    var h = false;
    try { h = UE.Input.GetKey(UE.KeyCode.M); } catch (x) {}
    if (!h && isPad()) try { h = cs.Rewired.ReInput.players.GetPlayer(0).GetButton(59); } catch (x) {}
    return h;
  }
  function step5(w, dx, dy, n, nm) {
    if (N5.zone === 'rows') {
      if (dy > 0) { if (N5.r > 0) N5.r--; }
      else if (dy < 0) { if (N5.r < n - 1) N5.r++; else if (nm) N5.zone = 'muts'; }
      else if (dx) { if (S.locked) S.lockedPing = D.t; else if (press(w, N5.r, dx > 0)) S.pressAt = D.t; }
    } else if (dx) { var m2 = N5.m + dx; if (m2 >= 0 && m2 < nm && Math.floor(m2 / MUCOLS) === Math.floor(N5.m / MUCOLS)) N5.m = m2; }   // the chips stand ten across here
    else if (dy > 0) { if (N5.m >= MUCOLS) N5.m -= MUCOLS; else N5.zone = 'rows'; }
    else if (dy < 0) { if (N5.m + MUCOLS < nm) N5.m += MUCOLS; }
  }
  // the mouse: the row or the mutation under the pointer takes the cursor when the pointer moves; a left click on a row
  // raises its rank and a right click lowers it; a left click switches a mutation, presses LOWER / RAISE or picks a tab
  function mouse5(w, n, nm) {
    var mp, l = false, r = false;
    try { mp = UE.Input.mousePosition; l = UE.Input.GetMouseButton(0); r = UE.Input.GetMouseButton(1); } catch (x) { return; }
    var mk = Math.round(mp.x) + ':' + Math.round(mp.y), moved = N5.mk != null && N5.mk !== mk; N5.mk = mk;
    var lc = l && !N5.ml, rc = r && !N5.mr; N5.ml = l; N5.mr = r;
    if (moved || lc || rc) N5.mouseAt = D.t;
    if (!moved && !lc && !rc) return;
    if (S.cam === undefined) { var cv = S.root.GetComponentInParent(TY(UE.Canvas)); cv = cv ? cv.rootCanvas : null; S.cam = cv && +cv.renderMode !== 0 ? cv.worldCamera : null; }
    var sp = new UE.Vector2(mp.x, mp.y);
    var hit = function (rt) { try { return !!rt && rt.gameObject.activeInHierarchy && UE.RectTransformUtility.RectangleContainsScreenPoint(rt, sp, S.cam); } catch (x) { return false; } };
    for (var k = 0; k < n && k < S.rows.length; k++) {
      var R = S.rows[k]; if (R.g.alpha < 0.3 || !hit(R.p.rectTransform)) continue;
      N5.zone = 'rows'; N5.r = k;
      if (lc || rc) { if (S.locked) S.lockedPing = D.t; else if (press(w, k, lc)) S.pressAt = D.t; }
      return;
    }
    for (var m = 0; m < nm && m < S.mu.length; m++) {
      if (!hit(S.mu[m].p.rectTransform)) continue;
      N5.zone = 'muts'; N5.m = m;
      if (lc) { try { var s = mutSel(w, m), b = s && s.GetComponent(TY(UE.UI.Button)); if (b && !b.Equals(null) && b.interactable) b.onClick.Invoke(); } catch (x) {} }
      return;
    }
    if (!lc) return;
    if (hit(S.rPlus.rectTransform) || hit(S.rMinus.rectTransform)) { var up = hit(S.rPlus.rectTransform); if (S.locked) S.lockedPing = D.t; else if (press(w, N5.r, up)) S.pressAt = D.t; return; }
    var mi = Math.max(0, MODES.indexOf(D.fr ? D.fr.mode : MODES[0]));
    for (var q = 0; q < S.tabs.length; q++) if (q !== mi && hit(S.tabs[q].p.rectTransform)) { N5.tabQ = q - mi; return; }
  }
  // a clicked tab is reached one step at a time through the game's own LB / RB buttons, a step every sixth frame
  function tabStep(w) {
    if (!N5.tabQ || S.fc - N5.tabAt < 6) return; N5.tabAt = S.fc;
    var d = N5.tabQ > 0 ? 1 : -1; N5.tabQ -= d;
    // 0.1.18: the buttons are BtnController/.../BtnLeft and BtnRight (read from the running menu); 0.1.16 asked for
    // BtnSwitchLeft / BtnSwitchRight, which the menu does not have, so a clicked tab did nothing
    try { var b = deep(w.CsObj.transform, d > 0 ? 'BtnRight' : 'BtnLeft', 0), bt = b && b.GetComponent(TY(UE.UI.Button)); if (bt && !bt.Equals(null)) bt.onClick.Invoke(); else N5.tabQ = 0; } catch (x) { N5.tabQ = 0; }
  }
  function preNav(w) {
    var n = (D.fr && D.fr.rows || []).length; if (!n) return;
    var now = UE.Time.unscaledTime, nm = mutN(w);
    if (S.n5Root !== S.root) { S.n5Root = S.root; N5.zone = 'rows'; N5.r = D.fr.selIdx || 0; N5.m = 0; N5.tabQ = 0; N5.mk = null; }
    N5.r = Math.max(0, Math.min(n - 1, N5.r)); if (!nm) N5.zone = 'rows'; N5.m = Math.max(0, Math.min(Math.max(0, nm - 1), N5.m));
    var Dd = P.dir;
    if (Dd && !Dd.v5) {
      Dd.v5 = true; Dd.done = true;
      // a stick pushed sideways drifts up or down a little: a push counts when its other axis stays under 0.6 of it
      var ax = Math.abs(Dd.x), ay = Math.abs(Dd.y), hz = ax >= ay;
      Dd.v5ok = (hz ? ay : ax) <= 0.6 * (hz ? ax : ay); Dd.v5x = hz ? (Dd.x > 0 ? 1 : -1) : 0; Dd.v5y = hz ? 0 : (Dd.y > 0 ? 1 : -1);
      if (Dd.v5ok) { step5(w, Dd.v5x, Dd.v5y, n, nm); N5.rep = now + 0.42; }
    } else if (Dd && Dd.held && Dd.v5ok && now > N5.rep && (Dd.v5y || N5.zone === 'muts')) { step5(w, Dd.v5x, Dd.v5y, n, nm); N5.rep = now + 0.11; }   // a held push repeats; a rank change never does
    var sw = swapHeld() || !!N5.swapNow; N5.swapNow = false;
    if (sw && !N5.sw && nm) N5.zone = N5.zone === 'rows' ? 'muts' : 'rows';
    N5.sw = sw;
    try { mouse5(w, n, nm); } catch (x) { if (!S.mouseErr) { S.mouseErr = 1; note('mouse EXC ' + x); } }
    tabStep(w);
    S.hasMut = nm > 0; S.zone5 = N5.zone;
    D.forceSel = N5.r; D.forceSelAt = UE.Time.frameCount; D.V5at = UE.Time.frameCount;
    var want = N5.zone === 'muts' ? mutSel(w, N5.m) : rowSel(w, N5.r), g = P.navG;
    if (g && want) { var cur = g.CurrentSelectable; if (!cur || cur.Equals(null) || cur.GetInstanceID() !== want.GetInstanceID()) g.SetCurrentSelectable(want, false, true); P.navLastId = want.GetInstanceID(); }
    P.navFoc = P.navCur = N5.zone === 'muts' ? { k: 'mut', i: N5.m, key: 'mut' + N5.m } : { k: 'row', r: N5.r, b: 'Next', key: 'row' + N5.r + 'Next' };
  }
  function postNav(w) {}

  // ---- build ----
  var LOCKSP = null;
  function lockSprite(w) { if (LOCKSP && !LOCKSP.Equals(null)) return LOCKSP; try { var a0 = D.artLoad ? D.artLoad('ImgChaosLock') : null; if (a0 && !a0.Equals(null) && a0.name) { LOCKSP = a0; return LOCKSP; } } catch (x) {} try { var all = w.CsObj.GetComponentsInChildren(TY(UE.UI.Image), true); for (var i = 0; i < all.Length; i++) { var s = all.get_Item(i).sprite; if (s && s.name === 'ImgChaosLock') { LOCKSP = s; break; } } } catch (x) {} return LOCKSP; }
  function build(w, B) {
    for (var g of S.made) try { UE.Object.Destroy(g); } catch (x) {}
    S.made = []; S.fx = []; S.pend = []; S.follow = []; S.vroot = V.root; S.B = B; S.panKey = S.pipKey = null; S.cam = undefined;
    var root = S.root = H.node(B.root, 'V5.V4Screen'); S.made.push(root.gameObject);   // 'V4Screen' in the name: dial_v4's hush keeps it
    root.SetAsLastSibling(); scl(root, 4 / 3); S.rootG = group(root);
    var scrW = Math.max(2560, 1440 * UE.Screen.width / Math.max(1, UE.Screen.height)); S.half = scrW / 2 * 0.75;
    // 0.1.16: the stock menu's hidden buttons lie under this screen and took the mouse (a hover moved the game's focus onto
    // them, a click pressed them). A clear plate over everything but the prompt bar takes the pointer; mouse5 reads the mouse
    try { S.rootG.blocksRaycasts = true; var bk = img(root, 'Block', 2 * S.half, 1000, W, 0); bk.raycastTarget = true; pos(bk.transform, 0, 40); bk.transform.SetAsFirstSibling(); } catch (xb) { note('block EXC ' + xb); }
    // far sides: the stock mosaic bands, only where the screen is wider than 16:9; never a tinted play of the pooled effect
    // (RoomSelectBgLoop drew nothing after one): the donor plays as it is, then its quads get a private copy of their
    // material with the tint moved 30 % to the mode's colour
    S.sides = node(root, 'Sides', true);
    S.rain = []; S.sweeps = []; if (S.half > 1000) buildSides();
    S.band = [];
    if (false) {   // round 4: the mosaic bands are gone (the lead: "they look like clutter"); the sides are the room's rain
      var bx = S.half - 20;
      S.band.push(loop(S.sides, 'BandL', 'BossRushSelectBgLoop', 1, -bx, 10)); S.band.push(loop(S.sides, 'BandR', 'BossRushSelectBgLoop', 1, bx, 10));
      scl(S.band[0].t, -0.6, 0.78); scl(S.band[1].t, 0.6, 0.78);
      S.band.forEach(function (L) { L.post = bandTint; });
    }
    buildHead(w); buildList(); buildCore(); buildRight(w); buildFoot();
    S.fxTop = node(root, 'FxTop', true);
    S.mode = null; S.tot = null; S.sel = null; S.lv = {}; S.reached = null; S.openAt = D.t; S.stagAt = D.t; S.scroll = 0; S.scrollV = 0;
    S.gFrac = 0; S.sk = 0; S.t1a = S.t2a = S.t3a = 0; S.tabLay = S.tabKey = S.rKey = S.stat = S.statMode = S.tabBarX = S.quietList = null;
    S.shiftAt = null; S.pressAt = null; S.lockedPing = null; S.rankFlash = null; S.pickFx = S.sweep = null; S.tickPos = {}; S.degShown = null; S.footSig = null;
    note('built, half width ' + Math.round(S.half));
  }
  // the side bands: their tinter's colours moved 30 % toward the mode's colour, alphas kept (the tinter fades the band in,
  // so a material copy froze it at alpha 0 on a cold first play)
  function bandTint(e) {
    var hue = S.hueNow || [1, 1, 1], ts = U.GetComponentsInChildren(e.gameObject, cs.NOAH.VFX.MaterialTinter, true);
    var mv = function (c) { return new UE.Color(c.r + (hue[0] - c.r) * 0.3, c.g + (hue[1] - c.g) * 0.3, c.b + (hue[2] - c.b) * 0.3, c.a); };
    for (var k = 0; k < ts.Length; k++) {
      var ins = ts.get_Item(k).MaterialInterpolators;
      for (var j = 0; ins && j < ins.Length; j++) {
        var it = ins.get_Item(j); if (it.GetType().Name !== 'MaterialColorInterpolator') continue;
        var id = it.GetHashCode(); if (!TO[id]) TO[id] = { a: it.startValue, b: it.endValue };
        it.startValue = mv(TO[id].a); it.endValue = mv(TO[id].b);
      }
    }
    // a pooled band may still wear a copy from an earlier build of this layer
    var gs = U.GetComponentsInChildren(e.gameObject, UE.UI.Graphic, true);
    for (var i = 0; i < gs.Length; i++) { var g = gs.get_Item(i), gid = g.GetInstanceID(); if (OM[gid]) g.material = OM[gid]; }
  }
  var HY = 462;   // the header row (40 units under the screen's top band, the pause menu's spacing)
  function buildHead(w) {
    var h = S.head = node(S.root, 'Head', true); S.headG = group(h);
    S.hEnt = label(h, 'Ent', T4, 300, 24, 4097, 'display', DIM); S.hEnt.characterSpacing = 8; S.hEnt.text = 'ENTROPY'; pos(S.hEnt.transform, -920 + 150, HY + 22);
    S.hMode = label(h, 'Mode', T3, 520, 36, 4097, 'display', TEXT); S.hMode.characterSpacing = 3; pos(S.hMode.transform, -920 + 260, HY - 8);
    S.hLB = prompt(h, 'LB', 514); S.hRB = prompt(h, 'RB', 514);
    // 2026-11-14: Endless is off for this release (entropy-grim: HeatUtil.ENDLESS is 0); the stock LB / RB already stop at
    // Grim, so the strip shows only the tabs the stock menu can reach
    var tabModes = MODES.filter(function (m) { var on = true; try { on = m !== 105 || !!HU.ENDLESS; } catch (x) { on = false; } return on; });
    S.tabs = tabModes.map(function (m, i) {
      var x = -304 + i * 152, p = plate(h, 'Tab' + i, 144, 40, { cut: [10, 0, 10, 0], alpha: 0.55, lineA: 0.22 }); pos(p.transform, x, HY);
      var t = label(h, 'TabT' + i, T4, 132, 30, 514, 'display', DIM); pos(t.transform, x, HY); t.characterSpacing = 2;
      var lk = img(h, 'TabL' + i, 16, 18, W, 0); lk.preserveAspect = true;
      return { p: p, t: t, lk: lk, x: x, m: m };
    });
    S.tabBar = img(h, 'TabBar', 144, 3, W, 0); pos(S.tabBar.transform, 0, HY - 22);
    S.hTot = label(h, 'Tot', T3, 360, 36, 4100, 'display', TEXT); pos(S.hTot.transform, 920 - 180, HY + 4);
    S.hNext = label(h, 'Next', T4, 360, 24, 4100, 'body', DIM); pos(S.hNext.transform, 920 - 180, HY - 22);
    S.hRule = img(h, 'Rule', 1840, 1, GREY, 0.3); pos(S.hRule.transform, 0, HY - 38);
  }
  var PANEL = { top: 404, bot: -450 };
  function panelOpts() { return { bracket: 14, alpha: 0.86, fill: [0.008, 0.009, 0.012], lineA: 0.3 }; }
  function buildList() {
    var l = S.list = node(S.root, 'List', true); S.listG = group(l);
    S.lPanel = plate(l, 'Panel', 600, PANEL.top - PANEL.bot, panelOpts()); pos(S.lPanel.transform, (LIST.x0 + LIST.x1) / 2, (PANEL.top + PANEL.bot) / 2);
    S.lHead = label(l, 'Head', T4, 300, 26, 4097, 'display', DIM); S.lHead.characterSpacing = 4; pos(S.lHead.transform, LIST.x0 + 14 + 150, PANEL.top - 26);
    S.lCount = label(l, 'Count', T4, 260, 26, 4100, 'body', DIM); pos(S.lCount.transform, LIST.x1 - 14 - 130, PANEL.top - 26);
    S.lTrack = img(l, 'Track', 2, LIST.top - LIST.bot, GREY, 0.18); pos(S.lTrack.transform, LIST.x0 - 2, (LIST.top + LIST.bot) / 2);
    S.lMark = img(l, 'Mark', 3, 60, W, 0.6); pos(S.lMark.transform, LIST.x0 - 2, LIST.top);
    S.rowHost = node(l, 'Rows'); S.rows = [];
    // the pips share three plate materials (a fixed 10 x 12 segment): filled, filled on the picked row, hollow
    var b = plateMat(); S.pipM = null;
    if (b) {
      var mk = function (fillA, lineA) { var m = new UE.Material(b); m.SetVector('_Size', new UE.Vector4(PIPW, PIPH, 0, 0)); m.SetVector('_Cut', new UE.Vector4(0, 0, 0, 0)); sC(m, '_Fill', W, fillA); sC(m, '_Line', W, lineA); sF(m, '_LineW', 1.2); sF(m, '_Bracket', 0); sF(m, '_Hex', 0); sF(m, '_Dash', 0); sF(m, '_Raised', 0); sF(m, '_Lit', 0); sF(m, '_Weave', 0); sF(m, '_Rim', 0); sF(m, '_Run', 0); sF(m, '_EdgeGlow', 0); sF(m, '_Pulse', 0); sC(m, '_Glow', W, 0); return m; };
      S.pipM = { on: mk(1, 1), sel: mk(1, 1), off: mk(0, 0.3) };
    }
  }
  var PIPW = 10, PIPH = 12, PIPX = LIST.x1 - 136;   // the pips start at one x on every row, so ranks compare down the column
  function row(k) {
    while (S.rows.length <= k) {
      var i = S.rows.length, t = node(S.rowHost, 'Row' + i), g = group(t);
      var R = { t: t, g: g, h: ROWH, v: 0, y: null, lit: 0 };
      R.p = plate(t, 'P', LIST.x1 - LIST.x0, ROWH - 6, { cut: [8, 0, 8, 0], alpha: 0.5, lineA: 0.12, weave: 0.05 });
      R.ic = img(t, 'I', 38, 38, W, 1); R.ic.preserveAspect = true; pos(R.ic.transform, LIST.x0 + 30, 0);
      R.n = label(t, 'N', T4, 290, 46, 4097, 'body', TEXT); R.n.enableWordWrapping = true; R.n.enableAutoSizing = true; R.n.fontSizeMin = 13; R.n.fontSizeMax = T4; R.n.overflowMode = 1;
      pos(R.n.transform, LIST.x0 + 58 + 145, 0);
      R.pips = []; for (var p = 0; p < 6; p++) { var pi = img(t, 'Pip' + p, PIPW, PIPH, W, 0); if (S.pipM) pi.material = S.pipM.off; pos(pi.transform, PIPX + p * 13, 0); R.pips.push({ im: pi, f: 0 }); }
      R.e = label(t, 'E', T4, 60, 30, 4100, 'body', DIM); pos(R.e.transform, LIST.x1 - 14 - 30, 0);
      pos(R.p.transform, (LIST.x0 + LIST.x1) / 2, 0);
      S.rows.push(R);
    }
    return S.rows[k];
  }
  function buildCore() {
    var c = S.core = node(S.root, 'Core', true); pos(c, CORE.x, CORE.y); S.coreG = group(c);
    // the swirl (the lead, 2026-11-11: "i want the swirl in the middle to be particle vfx instead of a physical drawn shap"):
    // no drawn vortex plate. He meant an effect made in the particle system and playing in real time, not one made of dots
    // (mega rule 7), so the swirl is the Entropy schedule's own unlock swirl (flowing streak meshes, turbulent smoke, a soft
    // glow) made to loop and slowed; from half the limit a faster copy runs over it; a light layer of sparks (rim motes,
    // embers, haze) rides with them. ui\import_swirl.py builds the three effects from the game's own
    S.flow = loop(c, 'SwirlFlow', 'ReduxEntropySwirlFlow', 1.15, 0, 0, 1.0);   // at 1.6 its streaks ran past the gauge ring
    S.flowFast = loop(c, 'SwirlFlowFast', 'ReduxEntropySwirlFlowFast', 1.15, 0, 0, 1.0); S.flowFast.t.localEulerAngles = H.V3(0, 0, 150);
    S.swirlBody = loop(c, 'SwirlBody', 'ReduxEntropySwirlBody', 1.0, 0, 0, 1.0);
    // tier 1 (round 4): the Mind Crystal slot's small hex loop as an outer hex halo round the face (the schedule's icon trail
    // it replaces ran across the list)
    S.tier1 = loop(c, 'Tier1', 'ConsciousEquip_501_loop_small', 3.2);
    // tier 3: the design named PotentialSelect_loop_501_glitch, but that part draws a Potential's claw icon, and
    // RoomSelect_glitch_501 carries a localized word; the hex glow loop round the stock Entropy core (its baked pink ring off)
    S.tier3 = loop(c, 'Tier3', 'ChaosValue_501', 2.3); S.tier3.off = ['ring'];
    // the gauge: 120 segments round the core, from the top, clockwise; a tick per perk outside it
    S.gHost = node(c, 'Gauge'); S.gseg = [];
    for (var s = 0; s < 120; s++) {
      var a = 90 - 360 * (s + 0.5) / 120, r = 262, im = img(S.gHost, 'G' + s, 3, 13, GREY, 0.12);
      pos(im.transform, r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)); im.transform.localEulerAngles = H.V3(0, 0, a - 90);
      S.gseg.push({ im: im, on: -1 });
    }
    S.ticks = [];
    // the face: a dark hex under the numeral with no outline of its own (the frame effect draws the one hex edge)
    S.face = plate(c, 'Face', 268, 312, { hex: 1, alpha: 0.86, fill: [0.01, 0.012, 0.018], lineA: 0, lit: 1.2 });
    S.face.transform.localEulerAngles = H.V3(0, 0, 90);   // flat top, as the frame effect's hex is (measured in game): one outline, not two
    S.frame = loop(c, 'Frame', 'ConsciousEquip_501_loop', 2.55, 0, 0, 0.6);
    // its glow layer (glow1) keeps a baked rose hex under any tint: it plays in the violet-to-rose modes only; elsewhere the
    // face's own edge glow, in the mode's colour, carries the bloom
    // its bgglow layer is a large gear plate that spilled behind both panels (the lead's 'huge faint gear', round 4): off
    S.frame.off = ['bgglow'];
    S.frame.post = function (e) { var ch = e.GetComponentsInChildren(TY(UE.Transform), true); for (var i = 0; i < ch.Length; i++) if (ch.get_Item(i).name === 'glow1') ch.get_Item(i).gameObject.SetActive(S.vk === 1); };   // tinted 60 % toward the mode colour (its glow layer keeps some of its baked violet)
    S.num = label(c, 'Num', T1, 360, 150, 514, 'display', TEXT); pos(S.num.transform, 0, 12);
    S.lim = label(c, 'Lim', T4, 300, 26, 514, 'display', DIM); S.lim.characterSpacing = 4; pos(S.lim.transform, 0, -78);
    // the lock note sits outside the dimmed core, inside the gauge under the face
    S.lock = label(S.root, 'Lock', T4, 400, 60, 514, 'body', TEXT); S.lock.enableWordWrapping = true; pos(S.lock.transform, CORE.x, CORE.y - 212); S.lock.text = '';
    // the rank strip under the core: each modifier a stack of its ranks on one baseline
    S.strip = node(S.root, 'Strip', true); pos(S.strip, 0, STRIPY); S.stripG = group(S.strip); S.cols = [];
    S.stripBase = img(S.strip, 'Base', 620, 1, GREY, 0.35); pos(S.stripBase.transform, 0, -1);
    S.stripMark = img(S.strip, 'Mark', 14, 3, W, 0);
  }
  var STRIPY = -352;
  function buildRight(w) {
    var r = S.right = node(S.root, 'Right', true); S.rightG = group(r); var x0 = 340, cx = 630, x1 = 920;
    S.rPanel = plate(r, 'Panel', 600, PANEL.top - PANEL.bot, panelOpts()); pos(S.rPanel.transform, cx, (PANEL.top + PANEL.bot) / 2);
    S.rRank = label(r, 'Rank', T4, 380, 26, 4097, 'display', DIM); S.rRank.characterSpacing = 3; pos(S.rRank.transform, x0 + 24 + 190, PANEL.top - 26);
    S.rPts = label(r, 'Pts', T4, 200, 26, 4100, 'body', DIM); pos(S.rPts.transform, x1 - 24 - 100, PANEL.top - 26);
    S.rName = label(r, 'Name', T3, 540, 70, 4097, 'display', TEXT); S.rName.enableWordWrapping = true; S.rName.enableAutoSizing = true; S.rName.fontSizeMin = 18; S.rName.fontSizeMax = T3; pos(S.rName.transform, cx, PANEL.top - 78);
    S.rDesc = label(r, 'Desc', T4, 540, 50, 257, 'bodyR', DIM); S.rDesc.enableWordWrapping = true; S.rDesc.enableAutoSizing = true; S.rDesc.fontSizeMin = 13; S.rDesc.fontSizeMax = T4;
    S.lad = [];
    for (var i = 0; i < 6; i++) {
      var p = plate(r, 'Lad' + i, 540, 32, { cut: [6, 0, 6, 0], alpha: 0, lineA: 0 });
      var a = label(r, 'LadR' + i, T4, 70, 30, 4097, 'body', DIM), v = label(r, 'LadV' + i, T4, 250, 30, 4097, 'body', DIM); v.overflowMode = 1;
      var e = label(r, 'LadE' + i, T4, 90, 30, 4100, 'body', DIM), mk = img(r, 'LadM' + i, 4, 22, W, 0), nx = label(r, 'LadN' + i, 13, 70, 30, 4100, 'body', DIM);
      S.lad.push({ p: p, r: a, v: v, e: e, m: mk, nx: nx });
    }
    S.rMinus = plate(r, 'Minus', 250, 40, { cut: [10, 0, 10, 0], alpha: 0.55, lineA: 0.3 }); S.rPlus = plate(r, 'Plus', 250, 40, { cut: [10, 0, 10, 0], alpha: 0.55, lineA: 0.3 });
    S.rMinusQ = prompt(r, 'MinusQ', 514); S.rPlusQ = prompt(r, 'PlusQ', 514);
    S.rSep = img(r, 'Sep', 540, 1, GREY, 0.22);
    S.stH = label(r, 'StatH', T4, 300, 26, 4097, 'display', DIM); S.stH.characterSpacing = 4; S.stH.text = 'STATUS';
    S.st = [0, 1, 2, 3].map(function (i) { var ic = img(r, 'StI' + i, 28, 28, W, 0); ic.preserveAspect = true; var t = label(r, 'StV' + i, T3, 110, 34, 4097, 'body', TEXT); return { ic: ic, t: t }; });
    S.stL = [label(r, 'StL0', T4, 140, 30, 4097, 'bodyR', DIM), label(r, 'StL1', T4, 140, 30, 4097, 'bodyR', DIM)];
    S.ruH = label(r, 'RuleH', T4, 300, 26, 4097, 'display', DIM); S.ruH.characterSpacing = 4; S.ruH.text = 'RULES';
    S.ru = [0, 1, 2, 3, 4].map(function (i) { var t = label(r, 'Ru' + i, 16, 500, 40, 4097, 'bodyR', TEXT); t.enableWordWrapping = true; t.enableAutoSizing = true; t.fontSizeMin = 12; t.fontSizeMax = 16; var m = img(r, 'RuM' + i, 6, 6, W, 0.5); m.transform.localEulerAngles = H.V3(0, 0, 45); return { t: t, m: m }; });
    S.muH = label(r, 'MutH', T4, 300, 26, 4097, 'display', DIM); S.muH.characterSpacing = 4; S.muH.text = 'MUTATIONS';
    S.muT = label(r, 'MutT', 15, 300, 24, 4100, 'body', DIM);
    S.rwH = label(r, 'RewH', T4, 300, 26, 4097, 'display', DIM); S.rwH.characterSpacing = 4; S.rwH.text = 'REWARDS';
    S.rwC = label(r, 'RewC', 15, 300, 24, 4100, 'body', DIM);
    S.rwT = label(r, 'RewT', 15, 100, 100, 257, 'body', TEXT); S.rwT.enableWordWrapping = true; S.rwT.richText = true; S.rwT.enableAutoSizing = true; S.rwT.fontSizeMin = 11; S.rwT.fontSizeMax = 15; S.rwT.overflowMode = 1; S.rwT.lineSpacing = 8;
    S.mu = []; for (var m = 0; m < 12; m++) { var mp = plate(r, 'Mu' + m, 44, 44, { cut: [6, 0, 6, 0], alpha: 0.6, lineA: 0.25 }); var mi = img(r, 'MuI' + m, 32, 32, W, 0); mi.preserveAspect = true; S.mu.push({ p: mp, i: mi }); }
  }
  function buildFoot() {
    var f = S.foot = node(S.root, 'Foot', true); S.footG = group(f);
    S.fTxt = label(f, 'Spare', T4, 640, 26, 514, 'display', DIM); S.fTxt.characterSpacing = 3; pos(S.fTxt.transform, 0, -404);
    S.fTrack = img(f, 'Track', 640, 6, GREY, 0.14); pos(S.fTrack.transform, 0, -428);
    S.fFill = img(f, 'Fill', 640, 6, W, 0.7); S.fFill.transform.pivot = H.V2(0, 0.5); pos(S.fFill.transform, -320, -428);
    S.fMark = img(f, 'Mark', 2, 14, W, 0.8); pos(S.fMark.transform, 320, -428);
    // the prompt row: the stock bar's own items (its labels and the pictures it chose for the device), then the list view
    S.fp = []; for (var i = 0; i < 8; i++) S.fp.push(prompt(f, 'P' + i, 4097));
  }

  // ---- v4's screen goes quiet (the room, its ground and the top atmosphere stay); its warp is off: the close is v5's fade
  // and the sweep, and its far-back silhouettes (the dark pillars at the screen's edges) are off ----
  var KEEP = { EDMPopBack: 1, EDMPopTop: 1 };
  function quiet() {
    var L = S.quietList;
    if (!L || S.quietRoot !== V.root || (S.fc % 30) === 0) {
      L = S.quietList = []; S.quietRoot = V.root;
      for (var i = 0; i < V.root.childCount; i++) { var c = V.root.GetChild(i); if (!KEEP[c.name]) L.push(c.gameObject); }
      (P.arch || []).forEach(function (a) { if (a && !a.Equals(null)) L.push(a.gameObject); });
    }
    try { for (var j = 0; j < L.length; j++) { var g = L[j]; if (g.activeSelf) g.SetActive(false); } }
    catch (x) { S.quietList = null; }   // a piece was destroyed under us: the list is read again next frame
    if (S.root.GetSiblingIndex() !== S.B.root.childCount - 1) S.root.SetAsLastSibling();
    // v3's list-view line goes while v5 draws its own prompt row (D.stop puts it back)
    var hg = D.hint && D.hint.go; if (hg !== S.hintGo) { S.hintGo = hg; S.hints = null; }   // a new open makes a new line
    if (!S.hints || S.fc % 30 === 0) { S.hints = []; try { var sa = globalThis.__ev3w.CsObj.transform.Find('BtnController/SafeAreaFitter'); for (var h = 0; sa && h < sa.childCount; h++) { var hc = sa.GetChild(h); if (hc.name === 'EDViewHint' || hc.name === 'EDViewGlyph') S.hints.push(hc.gameObject); } } catch (x) {} }
    try { S.hints.forEach(function (g) { if (!g.Equals(null) && g.activeSelf) g.SetActive(false); }); } catch (x) { S.hints = null; }
    // the game's prompt bar: v5 draws its items in its own row, so the bar itself stays hidden while v5 is up
    if (!S.fixedCG || S.fixedCG.Equals(null)) { try { var fo = UE.GameObject.Find('GameGlobal(Clone)/SingletonOrganizer/(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions/FixedInputArea'); S.fixedT = fo ? fo.transform : null; S.fixedCG = fo ? fo.GetComponent(TY(UE.CanvasGroup)) : null;
      // 0.1.18: the bar has no group of its own until something gives it one (the pause menu did, when it had been opened
      // first); without one the bar could not be hidden and its prompts lay under the menu's own row
      if (fo && (!S.fixedCG || S.fixedCG.Equals(null))) S.fixedCG = fo.AddComponent(TY(UE.CanvasGroup)); } catch (x) {} }
    if (S.fixedCG && !S.fixedCG.Equals(null) && S.fixedCG.alpha !== 0) S.fixedCG.alpha = 0;
  }
  if (!D.stopV5wrapped) {
    var st0 = D.stop;
    D.stop = function () {
      var r = st0.apply(this, arguments);
      try { var Hn = D.hint; if (Hn) { if (Hn.go && !Hn.go.Equals(null)) Hn.go.SetActive(true); if (Hn.gg && !Hn.gg.Equals(null)) Hn.gg.SetActive(true); } } catch (x) {}
      try { var cg = S.fixedCG; if (cg && !cg.Equals(null)) cg.alpha = 1; } catch (x) {}   // the pause window, when it is open under the menu, hides it again
      return r;
    };
    D.stopV5wrapped = true;
  }

  // ---- the frame ----
  var base = D.art.baseV5 || D.art;
  D.art = function (w, B) {
    try { if (S.root && !S.root.Equals(null)) preNav(w); } catch (e) { if (!S.navErr) { S.navErr = 1; note('nav EXC ' + e); } }
    var pr = D.V5prof, t0 = pr ? UE.Time.realtimeSinceStartupAsDouble : 0;
    base(w, B);
    var t1 = pr ? UE.Time.realtimeSinceStartupAsDouble : 0;
    try { v5(w, B); } catch (e) { if (S.err++ < 3) D.log.push('v5 EXC ' + e + ' ' + (e.stack || '').split('\n')[1]); }
    if (pr) { var t2 = UE.Time.realtimeSinceStartupAsDouble; pr.n++; pr.b += (t1 - t0) * 1000; pr.v += (t2 - t1) * 1000; pr.mx = Math.max(pr.mx, (t2 - t1) * 1000); }   // test: ED.V5prof = { n: 0, b: 0, v: 0, mx: 0 }
  };
  D.art.baseV5 = base;

  function v5(w, B) {
    if (!V.root || V.root.Equals(null) || !LF.a) return;
    if (S.vroot !== V.root || !S.root || S.root.Equals(null) || S.B !== B) build(w, B);
    S.fc = (S.fc || 0) + 1; quiet(); postNav(w);
    var t = D.t, dt = D.dt || 1, fr = D.fr, mode = fr.mode, mi = Math.max(0, MODES.indexOf(mode));
    var rows = fr.rows || [], n = rows.length, sel = fr.selIdx, R0 = rows[sel] || null;
    // an open (or a reopen): every leftover burst and sweep goes
    if (D.openAt !== S.openSeen) { S.openSeen = D.openAt; S.openAt = D.t; S.stagAt = D.t; S.fx.forEach(kill); S.fx = []; kill(S.sweep); S.sweep = null; S.closeFx = false; }
    var oF = t - S.openAt;
    // the close: this layer eases out over 14 f with the sweep across it
    var cA = 1;
    if (D.closeAt != null) { cA = 1 - ss((t - D.closeAt) / 14); if (!S.closeFx) { S.closeFx = true; S.sweep = fx(S.fxTop, 'chaosValue_sweep_501_1', 0, CORE.y, 1.6, degOf(LF.a), 40); } }
    var first = S.mode == null;
    if (!first && S.mode !== mode) { S.shiftAt = t; S.stagAt = t + 4; S.lv = {}; S.reached = null; S.scroll = null;
      // the sweep across the block is the stock menu's own (HeatMenu plays chaosValue_sweep_501_1 on a switch); a second
      // copy at block size drew its outer frame as tall bars at both screen edges
      if (P.wipeAt === t || P.wipeO) P.wipeO = [S.tabs[mi].x * 4 / 3, HY * 4 / 3];   // pop's palette wipe starts from this layout's tab
    }
    S.mode = mode;
    // pop's wipe keeps its colour wash; its ring (the tall bands that crossed both screen edges) is off
    if (P.wipeRing && P.wipeAt != null && t - P.wipeAt < 22) P.wipeRing.color = col(W, 0);
    // the room's two dimmed panel rects are v4's card and right column: off (their edges stood as pillars beside v5's panels)
    var Lr = D.LV4; if (Lr && Lr.roomMat && !Lr.roomMat.Equals(null)) rain(Lr.roomMat, t, dt, mode, LF.a);
    var shF = S.shiftAt != null ? t - S.shiftAt : 99;
    var locked = S.locked = !modeOpen(mode);
    var A = LF.a, akey = S.ck = (P.akey || '') + ':' + A[0].toFixed(2) + A[1].toFixed(2) + A[2].toFixed(2), Ad = mix(A, [0.5, 0.5, 0.52], 0.45);
    // the core's parts change colour at the wipe's front (9 f in), not at the press
    var degNew = degOf((LF.PAL[mode] || { a: A }).a); if (S.degShown == null || shF >= 9) S.degShown = degNew; var deg = S.degShown;
    S.hueNow = (LF.PAL[mode] || { a: A }).a;
    // totals: the limit the stock menu enforces
    var limit = limitOf(w, mode), tot = D.totTo || 0;
    if (mode === 1) { tot = 0; for (var q = 0; q < n; q++) tot += rows[q].lv || 0; }
    var frac = S.frac = limit ? cl(tot / limit) : 0, head = limit ? limit - tot : 99, strain = !!(limit && (tot >= limit * 0.95 || D.v4near));
    S.sk = (S.sk || 0) + ((strain ? 1 : 0) - (S.sk || 0)) * cl(dt / 10); var sk = S.sk;
    var breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / (strain ? 120 : 240));
    var coreC = mix(A, AMBER, sk);
    alpha(S.rootG, cA);
    alpha(S.headG, oc(oF / 12)); pos(S.head, 0, 14 * (1 - oc(oF / 12)));

    var AF = S.AF = fillHue(A, mode), pk = akey + ':' + mode;
    if (S.panKey !== pk) {
      S.panKey = pk;
      [S.lPanel, S.rPanel].forEach(function (p) { var m = p.__m; if (!m) return; sC(m, '_Fill', tintD(AF, 0.075, 0.85), 0.93); sC(m, '_Line', mix(AF, W, 0.15), 0.6); sC(m, '_BracketColor', mix(AF, W, 0.2), 0.85); sC(m, '_Accent', AF, 1); sF(m, '_AccentMix', 0.35); });
      var hc = mix(AF, W, 0.3); [S.lHead, S.stH, S.ruH, S.muH, S.hEnt, S.rRank].forEach(function (l) { iC(l, hc, 1); });
      iC(S.hRule, AF, 0.7); iC(S.rSep, AF, 0.45); iC(S.lTrack, AF, 0.3); iC(S.stripBase, AF, 0.6);
    }
    head5(w, t, mode, mi, tot, limit, oF, A, locked);
    list5(w, t, dt, rows, n, sel, mode, oF, A, Ad, akey, locked);
    core5(w, t, dt, rows, n, sel, mode, oF, A, deg, tot, limit, frac, strain, sk, breath, coreC, locked, shF);
    right5(w, t, rows, n, sel, R0, mode, oF, A, akey, limit, tot, locked, shF);
    foot5(w, t, oF, A, limit, tot, head, strain, coreC, mode);
    events(w, t, rows, n, sel, mode, A, deg, tot, limit);
    pendTick(); followTick();
    for (var i = S.fx.length - 1; i >= 0; i--) { var F1 = S.fx[i]; if ((F1.end && t >= F1.end) || F1.dead) { kill(F1); S.fx.splice(i, 1); } }
    if (S.half > 1000) S.band.forEach(function (L) { if (L.hueKey !== mode && L.o && L.o.e && shF >= 9) { L.hueKey = mode; bandTint(L.o.e); } loopTick(L, 0.85 * oc((oF - 10) / 30) * (locked ? 0.6 : 1), null); });
  }

  // ---- the side zones (round 4): falling glyphs in the mode's colour, only between each panel's outer edge and the
  // screen's edge. The room's own rain sits under pop_v4's black underlay and vignette (0.72 and up to 0.92 at the
  // sides), so each side zone is its own Image above them, with its own instance of the room's material (the bundle's
  // ED_Y2KBackground): every layer but the hall and the rain off, the canvas size set to the Image's, so the glyph cells
  // keep the room's size. The shader's own masks shape it: _PanelL is a soft box over the 120 units next to the panel
  // (the rain fades out there), the rain fades in from the top over a quarter of the height and out toward the
  // "horizon", set near the bottom. Speed and brightness rise with total / limit; a speed change moves _FourTimeOffset so
  // the glyphs keep their place. The room under the panels and the core keeps no rain (_Rain 0, one quiet box).
  var YM = null;
  function y2kMat() {
    if (YM) return YM;
    try { var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)); for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === 'ED_Y2KBackground') YM = all.get_Item(i); } catch (x) {}
    return YM;
  }
  var LFM = null;
  function lightFxMat() {
    if (LFM) return LFM;
    try { var all = globalThis.__EDB.LoadAllAssets(TY(UE.Material)); for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === 'ED_LightFx') LFM = all.get_Item(i); } catch (x) {}
    return LFM;
  }
  // round 5: six depths per side, far to near: glyph scale, share of the column offset (_Pointer), speed and brightness.
  // The pass is opaque (Blend One OneMinusSrcAlpha, colour times alpha), so the layers stack by alpha: layer i at alpha
  // 1 / (i + 1) shows at weight 1 / 6 under the ones above it. The material's _Color (a multiplier on the vertex colour
  // that may pass 1) is set to 6 times the layer's depth brightness, so every layer's glyphs land at their own full
  // value: the stack adds up like additive light while the black between the glyphs stays black.
  var DEPTHS = [{ s: 0.6, px: 0.50, sp: 0.70, k: 0.42 }, { s: 0.8, px: 0.27, sp: 0.80, k: 0.52 }, { s: 1.0, px: 0.71, sp: 0.92, k: 0.64 },
    { s: 1.25, px: 0.13, sp: 1.05, k: 0.78 }, { s: 1.6, px: 0.86, sp: 1.2, k: 0.9 }, { s: 2.0, px: 0.38, sp: 1.4, k: 1.0 }];
  // the Image runs past the screen at the top and bottom, so the shader's own fades (a quarter of the height at the top,
  // 0.22 at the "horizon" set at 0.88) show only over the last ~86 units of each end (round 5: full height)
  var RAINH = 1713, RAINY = 25.5;
  function rainLayer(parent, name, left, D0, i) {
    var w = S.half - 930, x = (left ? -1 : 1) * (930 + w / 2), im = img(parent, name, w, RAINH, W, 1), b = y2kMat(); pos(im.transform, x, RAINY);
    if (!b) { im.color = col(W, 0); return null; }
    var m = new UE.Material(b); im.material = m;
    var rm = D.LV4 && D.LV4.roomMat; try { var gt = rm && rm.GetTexture('_GlyphTex'); if (gt) { m.SetTexture('_GlyphTex', gt); m.SetFloat('_UseGlyphTex', 1); } } catch (x) {}
    m.SetVector('_CanvasSize', new UE.Vector4(w * 4 / 3, RAINH * 4 / 3, 0, 0)); m.SetVector('_Center', new UE.Vector4(0, -9000, 0, 0)); m.SetVector('_VigCenter', new UE.Vector4(0.5, 0.5, 0, 0));
    m.SetVector('_Pointer', new UE.Vector4(left ? D0.px : 1 - D0.px, 0.5, 0, 0));
    // the hall black and the room's two hues a dim grey: haze, beams and horizon light vanish; the Image's colour (the
    // mode's, a vertex multiplier) colours what is left, the rain
    m.SetColor('_Hall', col([0, 0, 0], 1)); m.SetColor('_HallFloor', col([0, 0, 0], 1)); m.SetFloat('_Heat', 0); m.SetColor('_Cyan', col([0.02, 0.02, 0.02], 1)); m.SetColor('_Rose', col([0.02, 0.02, 0.02], 1)); m.SetColor('_MoteColor', col([0, 0, 0], 1));
    ['_HexI', '_HorizonI', '_GlowI', '_MoteI', '_SweepI', '_ScanBandI', '_HorizonBlack', '_Pulse'].forEach(function (n) { m.SetFloat(n, 0); });
    m.SetFloat('_Horizon', 0.88); m.SetFloat('_RainScale', D0.s); m.SetFloat('_Intro', 1); m.SetFloat('_PanelDim', 0);
    // the quiet box: the 80 units next to the panel (soft 40 either side of the box edge)
    var soft = 40 / w, box = left ? new UE.Vector4(1 - soft, 3, -1, 2) : new UE.Vector4(-2, soft, -1, 2);
    m.SetVector('_PanelL', box); m.SetVector('_PanelR', box); m.SetFloat('_PanelSoft', soft);
    var a = 1 / (i + 1); im.color = col(W, a); m.SetColor('_Color', new UE.Color(DEPTHS.length * D0.k, DEPTHS.length * D0.k, DEPTHS.length * D0.k, 1));
    return { im: im, m: m, a: a, d: D0, off: null, sp: null };
  }
  function buildSides() {
    var host = S.sides;
    [true, false].forEach(function (left) {
      DEPTHS.forEach(function (D0, i) { var L = rainLayer(host, (left ? 'RainL' : 'RainR') + i, left, D0, i); if (L) S.rain.push(L); });
      // a slow band of light running down the rain, the two sides half a period apart (ED_LightFx sweep, additive)
      var w = S.half - 930, b = lightFxMat();
      if (b) {
        var sw = img(host, left ? 'SweepL' : 'SweepR', w, 1080, W, 0), m = new UE.Material(b); sw.material = m; pos(sw.transform, (left ? -1 : 1) * (930 + w / 2), 0);
        m.SetFloat('_Mode', 2); m.SetFloat('_Period', 6); m.SetFloat('_Width', 0.09); m.SetFloat('_Angle', -90); m.SetFloat('_Phase', left ? 0 : 3);
        S.sweeps.push(sw);
      }
      // the instrument margin: a hairline down the panel's outer side with a tick every 45 units, a longer one every fifth
      var ex = (left ? -1 : 1) * 950, line = img(host, left ? 'MarginL' : 'MarginR', 1, 860, GREY, 0.28); pos(line.transform, ex, -23);
      S.margins = S.margins || []; S.margins.push(line);
      for (var t = 0; t < 20; t++) {
        var y = 404 - 18 - t * 45, big = t % 5 === 0, tk = img(host, (left ? 'TickL' : 'TickR') + t, big ? 10 : 5, 1, GREY, big ? 0.4 : 0.25);
        pos(tk.transform, ex + (left ? -1 : 1) * (big ? 5 : 2.5), y); S.margins.push(tk);
      }
    });
  }
  function rain(rm, t, dt, mode, A) {
    sF(rm, '_Rain', 0); sF(rm, '_PanelDim', 0);
    var u = 1 / (2 * Math.max(S.half, 960)), x0 = 0.5 - 930 * u;   // the room stays quiet over the whole centre block (v4's two panel boxes are gone)
    if (S.rainBox !== x0) { S.rainBox = x0; var v4 = new UE.Vector4(x0, 1 - x0, -1, 2); rm.SetVector('_PanelL', v4); rm.SetVector('_PanelR', v4); }
    if (!S.rain || !S.rain.length) return;
    var k = 0.6 + 0.4 * (S.frac || 0) + (S.sk > 0.5 ? 0.15 : 0);
    S.rainK = S.rainK == null ? k : S.rainK + (k - S.rainK) * cl(dt / 30);
    var ak = A.map(function (v) { return v.toFixed(3); }).join(','), T0 = UE.Time.timeSinceLevelLoad, rk = +S.rainK.toFixed(3);
    S.rain.forEach(function (Q) {
      var m = Q.m, sp = +(rk * Q.d.sp).toFixed(3);
      // a speed change keeps the glyphs where they are: the layer's own time offset moves with it
      if (Q.sp !== sp) { var off = Q.off == null ? UE.Shader.GetGlobalFloat('_FourTimeOffset') : Q.off, s0 = Q.sp == null ? sp : Q.sp; Q.off = (T0 + off) * s0 / sp - T0; Q.sp = sp; m.SetFloat('_FourTimeOffset', Q.off); m.SetFloat('_Speed', sp); }
      sF(m, '_Rain', +(RAINI * rk).toFixed(3));
      if (Q.ak !== ak) { Q.ak = ak; Q.im.color = col(mix(A, W, 0.1), Q.a); }
    });
    var sa = 0.07 + 0.05 * (S.frac || 0);
    S.sweeps.forEach(function (sw) { iC(sw, mix(A, W, 0.15), sa); });
  }
  var RAINI = 120;   // the rain's brightness at the limit (measured in game against the body text: see Build notes)

  // ---- header: ENTROPY and the mode, five tabs with LB / RB, the total and the next perk ----
  function head5(w, t, mode, mi, tot, limit, oF, A, locked) {
    sT(S.hMode, (U.GetLocale('BattleModeName_' + mode) || '').toUpperCase());
    iC(S.hMode, mix(TEXT, A, 0.15), 1);
    tabLayout(w);
    var k = mi + ':' + S.ck + ':' + Math.min(30, Math.floor(oF));
    if (S.tabKey !== k) {
      S.tabKey = k;
      S.tabs.forEach(function (T, i) {
        var on = i === mi, open = modeOpen(T.m), ap = oc((oF - 4 - i * 2) / 12);
        iC(T.t, on ? W : mix(DIM, fillHue(A, mode), 0.3), (open ? 1 : 0.45) * ap); iC(T.lk, on ? W : DIM, open ? 0 : 0.6 * ap);
        var m = T.p.__m; if (m) {
          sF(m, '_Lit', on ? 2 : 0.25); sF(m, '_Raised', on ? 1 : 0); sC(m, '_Accent', on ? A : GREY, 1); sF(m, '_AccentMix', on ? 0.7 : 0.15);
          var TF = fillHue(A, mode); sC(m, '_Line', on ? mix(TF, W, 0.4) : mix(GREY, TF, 0.55), on ? 0.9 : 0.4); sF(m, '_EdgeGlow', on ? 0.32 : 0); sC(m, '_Fill', on ? tintD(TF, 0.4, 0.9) : tintD(TF, 0.07, 0.8), on ? 0.96 : 0.75);
        }
        iC(T.p, W, ap);
      });
    }
    var bx = S.tabs[mi].x, cx = S.tabBarX == null ? bx : S.tabBarX; cx += (bx - cx) * 0.3; S.tabBarX = cx; pos(S.tabBar.transform, cx, HY - 24); size(S.tabBar.transform, S.tabs[mi].w || 144, 3); iC(S.tabBar, mix(A, W, 0.3), 0.9 * oc(oF / 12));
    var perks = perkVals(), next = null; perks.forEach(function (v) { if (v > tot && (!limit || v <= limit) && (next == null || v < next)) next = v; });
    sT(S.hTot, limit ? tot + ' / ' + limit : mode === 1 ? '' : '' + tot);
    sT(S.hNext, locked || mode === 1 ? '' : next != null ? 'Next perk at ' + next : perks.length ? 'Every perk reached' : '');
    iC(S.hTot, mix(TEXT, A, 0.2), 1);
    if (S.fc % 15 === 1 || S.lbW == null) {
      var lw = setPrompt(S.hLB, glyphOf(16), ''), rw = setPrompt(S.hRB, glyphOf(17), ''); S.lbW = lw;
      var ga = glyphOf('A'); S.glyphOk = !!(ga && ga.sp);   // the panel's LOWER / RAISE redraw once the pictures exist
      pos(S.hLB.t, -S.tabTot / 2 - 10 - lw / 2, HY); pos(S.hRB.t, S.tabTot / 2 + 10 + rw / 2, HY);
    }
  }
  // the tabs take the width of their stock names (every locale), centred; a locked tab carries the stock lock mark
  function tabLayout(w) {
    var anyLock = S.tabs.some(function (T) { return !modeOpen(T.m); }), needLock = anyLock && !(LOCKSP && !LOCKSP.Equals(null)) && S.fc % 30 === 0;
    if (needLock) lockSprite(w);
    var names = S.tabs.map(function (T) { return (U.GetLocale('BattleModeName_' + T.m) || '').toUpperCase(); }), key = names.join('|') + '|' + anyLock + '|' + !!(LOCKSP && !LOCKSP.Equals(null));
    if (S.tabLay === key) return; S.tabLay = key;
    var ls = lockSprite(w);
    var ws = S.tabs.map(function (T, i) { sT(T.t, names[i]); var lk = !modeOpen(T.m); return Math.max(112, Math.ceil(T.t.preferredWidth) + 34 + (lk ? 22 : 0)); });
    var tot = ws.reduce(function (a, b) { return a + b; }, 0) + 8 * (ws.length - 1), x = -tot / 2; S.tabTot = tot;
    S.tabs.forEach(function (T, i) {
      var lk = !modeOpen(T.m); T.x = x + ws[i] / 2; T.w = ws[i]; x += ws[i] + 8;
      plateSize(T.p, ws[i], 40); pos(T.p.transform, T.x, HY); size(T.t.transform, ws[i] - 12 - (lk ? 22 : 0), 30); pos(T.t.transform, T.x + (lk ? 11 : 0), HY);
      if (ls) T.lk.sprite = ls; pos(T.lk.transform, T.x - Math.ceil(T.t.preferredWidth) / 2 - 2, HY);
    });
    S.lbW = null;
  }

  // ---- the list ----
  function list5(w, t, dt, rows, n, sel, mode, oF, A, Ad, akey, locked) {
    var ranked = 0; for (var q = 0; q < n; q++) if (rows[q].lv > 0) ranked++;
    sT(S.lHead, mode === 1 ? 'ASSISTS' : 'MODIFIERS'); sT(S.lCount, ranked + ' of ' + n + ' on');
    alpha(S.listG, locked ? 0.35 : 1);
    var lk = oc((t - S.stagAt + 2) / 14); pos(S.list, -30 * (1 - lk), 0);
    if (S.pipM && S.pipKey !== akey) { S.pipKey = akey; var PF = mix(fillHue(A, mode), W, 0.12); sC(S.pipM.on, '_Fill', PF, 1); sC(S.pipM.on, '_Line', PF, 1); sC(S.pipM.sel, '_Fill', mix(A, W, 0.35), 1); sC(S.pipM.sel, '_Line', mix(A, W, 0.35), 1); sC(S.pipM.off, '_Line', GREY, 0.3); sC(S.pipM.off, '_Fill', GREY, 0); }
    // heights spring to their size (zeta 0.62, omega 0.55 / f); the picked row is taller
    var w0 = 0.55, z0 = 0.62, total = 0;
    for (var k = 0; k < n; k++) {
      var R = row(k), tg = k === sel ? PICKH : ROWH, steps = Math.max(1, Math.ceil(dt)), hh = dt / steps;
      if (R.h == null) R.h = tg;
      for (var i = 0; i < steps; i++) { var acc = -w0 * w0 * (R.h - tg) - 2 * z0 * w0 * R.v; R.v += acc * hh; R.h += R.v * hh; }
      if (Math.abs(R.h - tg) < 0.05 && Math.abs(R.v) < 0.01) { R.h = tg; R.v = 0; }
      R.top = total; total += R.h;
    }
    for (var k2 = n; k2 < S.rows.length; k2++) act(S.rows[k2].t.gameObject, false);
    // the scroll keeps the picked row in the middle third of the list
    var viewH = LIST.top - LIST.bot, maxS = Math.max(0, total - viewH), Rs = S.rows[sel];
    var want = S.scroll == null || S.scrollT == null ? 0 : S.scrollT;
    if (Rs) {
      var c = Rs.top + Rs.h / 2, lo = viewH / 3, hi = viewH * 2 / 3;
      if (S.scroll == null) want = c - viewH / 2;
      else { if (c - want < lo) want = c - lo; if (c - want > hi) want = c - hi; }
    }
    want = Math.max(0, Math.min(maxS, want)); S.scrollT = want;
    if (S.scroll == null) { S.scroll = want; S.scrollV = 0; }
    var st = Math.max(1, Math.ceil(dt)), h2 = dt / st;
    for (var i2 = 0; i2 < st; i2++) { var a2 = -0.3 * 0.3 * (S.scroll - want) - 2 * 0.9 * 0.3 * S.scrollV; S.scrollV += a2 * h2; S.scroll += S.scrollV * h2; }
    if (Math.abs(S.scroll - want) < 0.05) { S.scroll = want; S.scrollV = 0; }
    if (maxS > 0) { var mh = Math.max(40, viewH * viewH / total); size(S.lMark.transform, 3, mh); pos(S.lMark.transform, LIST.x0 - 2, LIST.top - mh / 2 - (viewH - mh) * S.scroll / maxS); iC(S.lMark, mix(GREY, A, 0.3), 0.6); }
    else iC(S.lMark, W, 0);
    var focM = P.navFoc && P.navFoc.k === 'mut';
    for (var k3 = 0; k3 < n; k3++) {
      var R2 = S.rows[k3], Rw = rows[k3], isSel = k3 === sel && !focM, y = LIST.top - (R2.top - S.scroll) - R2.h / 2;
      // a row at the list's edge fades by alpha only, never under 0.6; a row past the edge is off
      var edge = Math.min(cl((LIST.top - (y + R2.h / 2) + 2) / 26), cl(((y - R2.h / 2) - LIST.bot + 2) / 26));   // a row that crosses the edge is off (it never runs under the head)
      var stg = ss((t - S.stagAt - k3 * 1.5) / 10), a = edge > 0.02 ? stg * (0.6 + 0.4 * edge) : 0;
      act(R2.t.gameObject, a > 0.004);
      if (a <= 0.004) continue;
      pos(R2.t, -24 * (1 - stg), y); alpha(R2.g, a);
      plateSize(R2.p, LIST.x1 - LIST.x0, R2.h - 6);
      var rsp = Rw.sprite ? Rw.sprite.sprite : null, key = Rw.id + ':' + Rw.lv + ':' + Rw.max + ':' + mode + ':' + (rsp && !rsp.Equals(null) ? rsp.name : '');
      if (R2.key !== key) {
        R2.key = key; var Wd = rowWords(Rw, w.CurBattleMode); sT(R2.n, Wd.title);
        if (rsp && !rsp.Equals(null) && rsp.name) R2.ic.sprite = rsp;
        sT(R2.e, Rw.lv > 0 && mode !== 1 ? '+' + sanAt(Rw.id, Rw.lv, w.CurBattleMode) : '');
      }
      var litK = isSel ? 1 : 0; R2.lit += (litK - R2.lit) * cl(dt / (litK ? 5 : 9)); var g = ss(R2.lit);
      var vk = key + ':' + isSel + ':' + akey + ':' + g.toFixed(2);
      if (R2.vk !== vk) {
        R2.vk = vk; var on = Rw.lv > 0;
        // switched-on icons at 0.7, full white on the picked row only
        var RF = fillHue(A, mode), bF = on ? tintD(RF, 0.2, 0.88) : tintD(RF, 0.03, 0.6), bA = on ? 0.9 : 0.6;
        iC(R2.n, isSel ? W : on ? TEXT : DIM, 1); iC(R2.ic, isSel ? W : on ? mix(W, RF, 0.3) : W, isSel ? 1 : on ? 0.8 : 0.35); iC(R2.e, isSel ? W : on ? mix(RF, W, 0.45) : DIM, 1);
        var m = R2.p.__m; if (m) {
          sF(m, '_Lit', 0.3 + 1.7 * g); sC(m, '_Accent', fillHue(A, mode), 1); sF(m, '_AccentMix', (Rw.lv > 0 ? 0.5 : 0.2) + 0.3 * g);
          sC(m, '_Line', mix(on ? mix(GREY, RF, 0.7) : GREY, mix(RF, W, 0.45), g), (on ? 0.4 : 0.12) + (on ? 0.5 : 0.75) * g); sC(m, '_Fill', mix(bF, tintD(RF, 0.42, 0.9), g), bA + (0.96 - bA) * g);
          sF(m, '_EdgeGlow', 0.3 * g); sF(m, '_Run', g > 0.5 ? 1 : 0); sF(m, '_RunSpeed', 120); sF(m, '_RunLen', 90);
        }
      }
      // pips: one segment per rank at a fixed x; filled ranks solid, the rest hollow at 30 %; a drained one fades over 8 f
      var mx = Math.min(6, Rw.max || 0);
      for (var p = 0; p < 6; p++) {
        var Pp = R2.pips[p]; if (p >= mx) { if (Pp.vis !== 0) { Pp.vis = 0; act(Pp.im.gameObject, false); } continue; }
        var tf = p < Rw.lv ? 1 : 0; Pp.f += Math.max(-dt / 8, Math.min(dt / 4, tf - Pp.f));
        var pk = Pp.f.toFixed(2) + ':' + isSel; if (Pp.vis === pk) continue; Pp.vis = pk; act(Pp.im.gameObject, true);
        if (S.pipM) { var mm = Pp.f > 0.02 ? (isSel ? S.pipM.sel : S.pipM.on) : S.pipM.off; if (Pp.im.material !== mm) Pp.im.material = mm; iC(Pp.im, W, Pp.f > 0.02 ? Pp.f : 1); }
        else iC(Pp.im, Pp.f > 0.02 ? Ad : GREY, Pp.f > 0.02 ? Pp.f : 0.3);
      }
    }
  }

  // ---- the core ----
  function core5(w, t, dt, rows, n, sel, mode, oF, A, deg, tot, limit, frac, strain, sk, breath, coreC, locked, shF) {
    alpha(S.coreG, (locked ? 0.4 : 1) * oc((oF - 2) / 10));
    var bloom = oc((oF - 2) / 24), shk = shF < 18 ? 1 - 0.08 * Math.sin(Math.PI * shF / 18) : 1;
    var vs = (0.62 + 0.38 * frac) * (1 + 0.025 * breath * (1 + sk)) * bloom * shk;
    // the vortex's texture is violet and keeps most of it under any tint: away from the violet-to-rose modes it sits low,
    // so the mode's own colour leads
    var dv = Math.abs(((deg - 300) % 360 + 540) % 360 - 180), vk = S.vk = 1;   // round 4: every part now takes the mode colour fully, so no mode dims the violet parts
    var t1 = S.t1a = ease(S.t1a, limit && frac >= 0.25 ? 1 : 0, dt), t2 = S.t2a = ease(S.t2a, limit && frac >= 0.5 ? 1 : 0, dt), t3 = S.t3a = ease(S.t3a, limit && frac >= 0.75 ? 1 : 0, dt);
    // the swirl grows with the total and reaches the gauge at the limit. SWK and SWF are a test's scales (1 in play)
    var sw = (0.74 + 0.26 * frac) * (1 + 0.025 * breath * (1 + sk)) * (0.6 + 0.4 * bloom) * shk * (D.SWK || 1);
    loopTick(S.flow, bloom, deg, sw * (D.SWF || 1)); loopTick(S.flowFast, t2 * bloom, deg, sw * (D.SWF || 1));
    loopTick(S.swirlBody, bloom, deg, sw);
    loopTick(S.tier1, 0.4 * t1 * bloom, deg); loopTick(S.tier3, 0.5 * t3 * bloom, deg);
    
    // the frame: its bloom follows the total (0.35 at none, 0.8 at the limit), tinted 60 % to the mode; at the limit it
    // jitters 1.6 px every 2 f
    var jx = 0, jy = 0; if (sk > 0.5 && ((t | 0) % 2 === 0)) { jx = (Math.random() - 0.5) * 3.2; jy = (Math.random() - 0.5) * 3.2; }
    loopTick(S.frame, (0.35 + 0.45 * frac) * FRAMEK * oc((oF - 4) / 14), deg); pos(S.frame.t, jx, jy);
    // the gauge eases to total / limit over 12 f
    var target = limit ? frac : mode === 1 ? 0 : cl(tot / Math.max(1, V.scale || 100)); S.gFrac += (target - S.gFrac) * cl(dt / 6);
    var gOpen = oc((oF - 6) / 18), lit = S.gFrac * gOpen, gk = P.akey + ':' + sk.toFixed(2);
    var headS = Math.floor(lit * 120 - 0.5);
    for (var s = 0; s < 120; s++) {
      var G = S.gseg[s], on = (s + 0.5) / 120 <= lit ? (s >= headS - 1 ? 2 : 1) : 0, vis = (s + 0.5) / 120 <= gOpen;
      var key = on + ':' + vis + ':' + (on ? gk : '');
      if (G.on === key) continue; G.on = key;
      if (!vis) iC(G.im, W, 0); else if (on === 2) iC(G.im, mix(coreC, W, 0.4), 0.9); else if (on) iC(G.im, mix(coreC, W, 0.1), 0.75); else iC(G.im, GREY, 0.13);
    }
    // a tick per perk and one for the limit (no labels: the header says the next perk, the core says the limit)
    var perks = perkVals(), scale = limit || Math.max(1, V.scale || 100), next = null, marks = [];
    if (mode !== 1) {
      perks.forEach(function (v) { if (v <= scale && v > tot && (next == null || v < next)) next = v; });
      perks.forEach(function (v) { if (v <= scale) marks.push({ v: v, k: v === next ? 'next' : v <= tot ? 'got' : 'off' }); });
      if (limit) marks.push({ v: limit, k: 'lim' });
    }
    while (S.ticks.length < marks.length) S.ticks.push(img(S.gHost, 'Tick' + S.ticks.length, 3, 18, W, 0));
    var pulse = 0.5 + 0.5 * Math.sin(t / 8);
    S.tickPos = {};
    for (var i = 0; i < S.ticks.length; i++) {
      var T = S.ticks[i], M = marks[i]; if (!M) { iC(T, W, 0); continue; }
      var a = 90 - 360 * cl(M.v / scale), len = M.k === 'lim' ? 26 : M.k === 'next' ? 22 : 16, r = 276 + len / 2, ar = a * Math.PI / 180;
      var tk = a.toFixed(2) + len; if (T.__tk !== tk) { T.__tk = tk; pos(T.transform, r * Math.cos(ar), r * Math.sin(ar)); T.transform.localEulerAngles = H.V3(0, 0, a - 90); size(T.transform, 3, len); }
      S.tickPos[M.v] = [r * Math.cos(ar), r * Math.sin(ar)];
      if (M.k === 'got') iC(T, mix(coreC, W, 0.2), 0.85 * gOpen); else if (M.k === 'next') iC(T, mix(coreC, W, 0.4), (0.5 + 0.4 * pulse) * gOpen); else if (M.k === 'lim') iC(T, mix(TEXT, AMBER, sk), 0.7 * gOpen); else iC(T, GREY, 0.35 * gOpen);
    }
    // the face: dark, lit a little from inside in the hue (amber under strain)
    var m = S.face.__m; if (m) {
      sF(m, '_Lit', 1.2); sC(m, '_Accent', coreC, 1); sF(m, '_AccentMix', 0.7); sC(m, '_Line', coreC, 0); sF(m, '_Rim', 0);
      sC(m, '_Fill', mix([0.008, 0.01, 0.014], coreC, 0.05 + 0.03 * breath), 0.92); sF(m, '_EdgeGlow', (S.vk === 1 ? 0.06 + 0.05 * breath : (0.35 + 0.45 * frac) * (0.9 + 0.15 * breath)) + 0.12 * sk);
      sF(m, '_Pulse', S.rankFlash ? Math.max(0, 1 - (t - S.rankFlash) / 20) * 0.6 : 0);
    }
    iC(S.face, W, oc((oF - 3) / 10)); scl(S.face.transform, 0.9 + 0.1 * oc((oF - 3) / 14));
    // the numeral counts up on the open, then rolls with the stock total; three digits at 0.82 so it never meets the frame
    var shown = oF < 30 ? Math.round(tot * oc((oF - 6) / 24)) : mode === 1 ? tot : (D.totShown == null ? tot : D.totShown);
    sT(S.num, '' + shown); iC(S.num, mix(W, coreC, 0.04), oc((oF - 6) / 8)); scl(S.num.transform, shown >= 100 ? 0.82 : 1);
    sT(S.lim, locked ? 'LOCKED' : limit ? (tot >= limit ? 'AT THE LIMIT' : 'LIMIT ' + limit) : mode === 1 ? 'ASSIST LEVELS' : '');
    iC(S.lim, mix(DIM, AMBER, sk), oc((oF - 10) / 10));
    sT(S.lock, locked ? clean(U.GetLocale('ModeLocked_' + mode)) : '');
    iC(S.lock, S.lockedPing && t - S.lockedPing < 20 ? W : DIM, locked ? 1 : 0);
    // the rank strip: each modifier a stack of its ranks (filled solid, empty at 25 %), the picked one in the mode colour
    // over a marker; none on Normal
    var showStrip = mode !== 1; act(S.strip.gameObject, showStrip); if (!showStrip) return;
    alpha(S.stripG, (locked ? 0.4 : 1) * oc((oF - 14) / 12));
    var step = 620 / Math.max(1, n), cw = Math.max(4, Math.min(14, step - 6));
    while (S.cols.length < n) S.cols.push({ seg: [] });
    var focM = P.navFoc && P.navFoc.k === 'mut';
    for (var c = 0; c < S.cols.length; c++) {
      var Cc = S.cols[c], Rw = c < n ? rows[c] : null, mx = Rw ? Math.min(6, Rw.max || 0) : 0, isS = c === sel && !focM;
      var ck = c + ':' + n + ':' + (Rw ? Rw.lv + '/' + mx : '-') + ':' + isS + ':' + P.akey;
      if (Cc.k === ck) continue; Cc.k = ck;
      while (Cc.seg.length < mx) Cc.seg.push(img(S.strip, 'S' + c + '_' + Cc.seg.length, cw, 6, W, 0));
      var x = -310 + (c + 0.5) * step;
      for (var sg = 0; sg < Cc.seg.length; sg++) {
        var im = Cc.seg[sg]; if (sg >= mx) { act(im.gameObject, false); continue; } act(im.gameObject, true);
        pos(im.transform, x, 5 + sg * 8); size(im.transform, cw, 6);
        var fill = sg < Rw.lv; var SF = S.AF || A; iC(im, isS ? (fill ? mix(SF, W, 0.35) : SF) : fill ? mix(SF, W, 0.05) : mix(GREY, SF, 0.5), fill ? (isS ? 1 : 0.85) : 0.25);
      }
      if (isS) { pos(S.stripMark.transform, x, -8); size(S.stripMark.transform, cw + 6, 3); iC(S.stripMark, mix(A, W, 0.3), 1); }
    }
    if (focM) iC(S.stripMark, W, 0);
  }
  // the frame's alpha, scaled so its brightest edge stays at least 15 % under the numeral (measured in game: at k 1 the
  // edge was within 3 % of the numeral on Grim at 76 / 125)
  var FRAMEK = 0.36;
  function ease(cur, to, dt) { cur = cur || 0; return cur + (to - cur) * cl(dt / 10); }

  // ---- the right panel: the picked modifier, then status, rules, mutations; laid out top to bottom ----
  function right5(w, t, rows, n, sel, R0, mode, oF, A, akey, limit, tot, locked, shF) {
    var rk = oc((oF - 8) / 14); alpha(S.rightG, rk); pos(S.right, 30 * (1 - rk) + (shF < 12 ? 18 * (1 - oc(shF / 12)) * (D.shiftDir || 1) : 0), 0);
    var x0 = 340, cx = 630, x1 = 920, cm = w.CurBattleMode;
    if (!S.stat || S.statMode !== mode || S.fc % 30 === 0) { S.statMode = mode; statusRead(w, mode, limit); }
    var st = S.stat, L2 = st.muts || [], nM = Math.min(12, L2.length), focI = P.navFoc && P.navFoc.k === 'mut' ? P.navFoc.i : -1;
    // round 6 (the lead: 'do explanations of the mutations show up anywhere if you hover over them?'): the chip under the
    // stock focus, or under the mouse while the mouse was the last thing moved, is explained where the modifier's detail sits
    var navK = sel + ':' + focI; if (S.navK !== navK) { S.navK = navK; S.navAt = t; }
    var hov = -1;
    try {
      var mp = UE.Input.mousePosition, mk = Math.round(mp.x) + ':' + Math.round(mp.y); if (S.mpK == null) { S.mpK = mk; S.mpAt = -1e9; } else if (S.mpK !== mk) { S.mpK = mk; S.mpAt = t; }
      if (nM && S.mpAt > (S.navAt || 0)) {
        if (S.cam === undefined) { var cv = S.root.GetComponentInParent(TY(UE.Canvas)); cv = cv ? cv.rootCanvas : null; S.cam = cv && +cv.renderMode !== 0 ? cv.worldCamera : null; }
        var sp2 = new UE.Vector2(mp.x, mp.y);
        for (var hm = 0; hm < nM; hm++) if (UE.RectTransformUtility.RectangleContainsScreenPoint(S.mu[hm].p.rectTransform, sp2, S.cam)) { hov = hm; break; }
      }
    } catch (x) {}
    var showM = focI >= 0 ? focI : hov; if (showM >= nM) showM = -1; S.showM = showM;
    var key = R0 ? R0.id + ':' + R0.lv + ':' + R0.max + ':' + mode + ':' + akey + ':' + locked + ':' + sel + ':' + tot + ':' + limit + ':' + isPad() + ':' + S.glyphOk + ':' + st.sig + ':' + focI + ':' + showM : 'none:' + mode;
    if (S.rKey !== key) {
      S.rKey = key; S.rKeyAt = t;
      var y = PANEL.top - 132;
      var mutOn = showM >= 0 && !!L2[showM];
      [S.rMinus.gameObject, S.rPlus.gameObject, S.rMinusQ.t.gameObject, S.rPlusQ.t.gameObject].forEach(function (o) { act(o, !mutOn && !!R0); });
      size(S.rDesc.transform, 540, mutOn ? 150 : 50);
      if (mutOn) {
        var mb = L2[showM], mName = '', mDesc = '';
        try { mName = clean(HU.GetExpertModeBuffName(mb) || ''); mDesc = clean(HU.GetExpertModeBuffDesc(mb) || ''); } catch (x) {}
        sT(S.rRank, 'MUTATION    ' + (mb.IsLock ? 'LOCKED' : mb.IsOpen ? 'ON' : 'OFF')); sT(S.rPts, (showM + 1) + ' of ' + nM);
        sT(S.rName, mName); sT(S.rDesc, mDesc); act(S.rDesc.gameObject, !!mDesc);
        pos(S.rDesc.transform, cx, y - 58); y -= 118;
        S.lad.forEach(function (Lq) { [Lq.p, Lq.r, Lq.v, Lq.e, Lq.m, Lq.nx].forEach(function (o) { act(o.gameObject, false); }); });
        S.canUp = S.canDn = false;
      } else if (R0) {
        var Wd = rowWords(R0, cm), cur = R0.lv, mx = R0.max, info = rankVals(R0, mx, cm), unit = mode === 1 ? 'LEVEL' : 'RANK';
        sT(S.rRank, (cur ? '' : 'OFF    ') + unit + ' ' + cur + ' OF ' + mx);
        sT(S.rPts, mode === 1 || !cur ? '' : '+' + sanAt(R0.id, cur, cm) + ' Entropy');
        sT(S.rName, Wd.title);
        // the subline only says what the ladder does not: a named modifier's sentence, the top rank's sentence
        var desc = Wd.desc || (cur && mx > cur && info.sent[mx - 1] ? 'At rank ' + mx + ': ' + info.sent[mx - 1] : cur && cur >= mx && mx > 1 ? 'This modifier is at its highest rank.' : '');
        sT(S.rDesc, desc); act(S.rDesc.gameObject, !!desc);
        if (desc) { pos(S.rDesc.transform, cx, y - 8); y -= 58; } else y -= 6;
        // the ladder: every rank's value and Entropy, the current one marked, the next one named
        for (var i = 0; i < 6; i++) {
          var Lr = S.lad[i], has = i < mx; [Lr.p, Lr.r, Lr.v, Lr.e, Lr.m, Lr.nx].forEach(function (o) { act(o.gameObject, has); });
          if (!has) continue;
          var l = i + 1, isCur = l === cur, past = l < cur, isNext = l === cur + 1, ly = y - i * 36;
          pos(Lr.p.transform, cx, ly); pos(Lr.r.transform, x0 + 40 + 35, ly); pos(Lr.v.transform, x0 + 112 + 125, ly); pos(Lr.e.transform, x1 - 40 - 45, ly); pos(Lr.m.transform, x0 + 32, ly); pos(Lr.nx.transform, x1 - 40 - 90 - 50, ly);
          sT(Lr.r, (mode === 1 ? 'L' : 'R') + l); sT(Lr.v, info.vals[i] || ''); sT(Lr.e, mode === 1 ? '' : '+' + sanAt(R0.id, l, cm)); sT(Lr.nx, isNext ? 'NEXT' : '');
          var c = isCur ? W : past ? TEXT : isNext ? mix(DIM, A, 0.4) : FAINT;
          iC(Lr.r, c, 1); iC(Lr.v, c, 1); iC(Lr.e, isCur ? mix(A, W, 0.4) : c, 1); iC(Lr.nx, mix(A, W, 0.3), 1);
          var LF2 = S.AF || A; iC(Lr.m, isCur ? W : past ? LF2 : W, isCur ? 1 : past ? 0.8 : 0);
          var m = Lr.p.__m; if (m) { sC(m, '_Fill', isCur ? tintD(LF2, 0.4, 0.9) : tintD(LF2, 0.16, 0.85), isCur ? 0.95 : past ? 0.75 : 0.0); sC(m, '_Line', mix(LF2, W, 0.4), isCur ? 0.8 : 0); sF(m, '_Rim', isCur ? 0.25 : 0); sF(m, '_Weave', isCur ? 0.12 : 0); sF(m, '_Lit', isCur ? 0.8 : 0.1); }
        }
        y -= Math.max(1, mx) * 36 - 6;
        // - and + right under the ladder; + greys out at the top rank or when the next rank costs more than is left
        var step = mode === 1 ? 0 : sanAt(R0.id, cur + 1, cm) - sanAt(R0.id, cur, cm), spare = limit ? limit - tot : 1e9;
        var canDn = !locked && cur > 0, canUp = !locked && cur < mx && step <= spare;
        S.canUp = canUp; S.canDn = canDn;
        var yP = y - 14;
        pos(S.rMinus.transform, cx - 136, yP); pos(S.rPlus.transform, cx + 136, yP); pos(S.rMinusQ.t, cx - 136, yP); pos(S.rPlusQ.t, cx + 136, yP);
        setPrompt(S.rMinusQ, glyphOf('A'), 'LOWER'); setPrompt(S.rPlusQ, glyphOf('D'), 'RAISE', true);
        [[S.rMinus, S.rMinusQ, canDn], [S.rPlus, S.rPlusQ, canUp]].forEach(function (q) {
          var en = q[2], m2 = q[0].__m; if (m2) { var BF = S.AF || A; sC(m2, '_Line', en ? mix(BF, W, 0.25) : GREY, en ? 0.8 : 0.1); sF(m2, '_Lit', en ? 0.6 : 0.05); sC(m2, '_Fill', en ? tintD(BF, 0.22, 0.88) : [0.012, 0.014, 0.018], en ? 0.9 : 0.3); }
          iC(q[1].lb, en ? TEXT : FAINT, 1); iC(q[1].im, W, en ? 1 : 0.3); iC(q[1].kt, en ? TEXT : FAINT, 1);
        });
        y = yP - 40;
      }
      // status (every mode that shows it), rules, mutations
      pos(S.rSep.transform, cx, y); y -= 30;
      act(S.stH.gameObject, !!st.has); [0, 1].forEach(function (i) { act(S.stL[i].gameObject, !!st.has); });
      if (st.has) {
        pos(S.stH.transform, x0 + 24 + 150, y); y -= 38;
        sT(S.stL[0], st.l0); sT(S.stL[1], st.l1); pos(S.stL[0].transform, x0 + 24 + 70, y); pos(S.stL[1].transform, x0 + 24 + 70, y - 40);
        for (var q = 0; q < 4; q++) {
          var Sq = S.st[q], v = st.v[q] || '', yy = q < 2 ? y : y - 40, xx = x0 + 200 + (q % 2) * 170;
          sT(Sq.t, v); pos(Sq.t.transform, xx + 72, yy); pos(Sq.ic.transform, xx, yy);
          if (st.ic[q] && !st.ic[q].Equals(null)) Sq.ic.sprite = st.ic[q];
          iC(Sq.ic, W, v && st.ic[q] && !st.ic[q].Equals(null) ? 0.85 : 0); iC(Sq.t, TEXT, v ? 1 : 0);
        }
        y -= 84;
      } else for (var q2 = 0; q2 < 4; q2++) { iC(S.st[q2].ic, W, 0); iC(S.st[q2].t, W, 0); }
      var ru = (st.rules || []).slice(0, 4); if (st.note) ru.push(st.note);
      var nR = ru.length;
      pos(S.ruH.transform, x0 + 24 + 150, y); y -= 32;
      for (var r = 0; r < 5; r++) {
        var Rr = S.ru[r], hasR = r < Math.max(1, nR); act(Rr.t.gameObject, hasR); act(Rr.m.gameObject, hasR && nR > 0); if (!hasR) continue;
        var isNote = st.note && r === nR - 1;
        sT(Rr.t, nR ? ru[r] : 'No extra rules in this mode.'); iC(Rr.t, nR && !isNote ? TEXT : DIM, 1); iC(Rr.m, isNote ? AMBER : mix(GREY, A, 0.4), 0.7);
        pos(Rr.t.transform, x0 + 48 + 250, y); pos(Rr.m.transform, x0 + 34, y); y -= isNote ? 44 : 36;
      }
      act(S.muH.gameObject, nM > 0); act(S.muT.gameObject, nM > 0);
      if (!nM) S.mu.forEach(function (Mu) { act(Mu.p.gameObject, false); act(Mu.i.gameObject, false); });
      else {
        y -= 4; pos(S.muH.transform, x0 + 24 + 150, y); pos(S.muT.transform, x1 - 24 - 150, y);
        var on = 0, lkN = 0; L2.forEach(function (b) { if (b.IsOpen) on++; if (b.IsLock) lkN++; });
        sT(S.muT, on + ' of ' + nM + ' on' + (lkN ? '    ' + lkN + ' locked' : ''));
        y -= 38;
        for (var m3 = 0; m3 < 12; m3++) {
          var Mu = S.mu[m3], hasM = m3 < nM; act(Mu.p.gameObject, hasM); act(Mu.i.gameObject, hasM); if (!hasM) continue;
          var b = L2[m3], xm = x0 + 46 + (m3 % 10) * 52, ym = y - Math.floor(m3 / 10) * 52, foc = m3 === showM;
          pos(Mu.p.transform, xm, ym); pos(Mu.i.transform, xm, ym);
          if (st.muIc[m3] && !st.muIc[m3].Equals(null)) Mu.i.sprite = st.muIc[m3];
          var stt = b.IsLock ? 'lock' : b.IsOpen ? 'open' : 'off', mm = Mu.p.__m;
          iC(Mu.i, W, stt === 'open' || foc ? 1 : stt === 'off' ? 0.4 : 0.14);
          if (mm) { sC(mm, '_Line', foc ? W : stt === 'open' ? mix(A, W, 0.3) : GREY, foc ? 1 : stt === 'open' ? 0.7 : stt === 'lock' ? 0.12 : 0.25); sF(mm, '_Dash', stt === 'lock' ? 1 : 0); sF(mm, '_Lit', foc ? 1.6 : 0.2); sF(mm, '_EdgeGlow', foc ? 0.3 : 0); sC(mm, '_Fill', stt === 'open' ? tintD(S.AF || A, 0.38, 0.9) : tintD(S.AF || A, 0.05, 0.7), stt === 'open' ? 0.92 : 0.75); }
          scl(Mu.p.transform, foc ? 1.12 : 1);
        }
      }
      // 0.1.16 (Fury, 2026-11-11: 'Entropy Rewards (Abyss Stipend/Etc) aren't shown anywhere'): the rewards a mode gives
      // for its Entropy were only marks on the gauge. They are listed under the mutations, each with the Entropy it
      // needs; the ones reached are bright. The list takes the room left above the panel's foot and shrinks to fit
      // 0.1.18: Grim of the Abyss has the longest rules and left 42 units here, under the 44 the list asked for, so the
      // mode Fury plays showed no rewards at all. With little room the list is one line: the next reward to reach
      var yR = (nM ? y - Math.ceil(nM / 10) * 52 + 14 : y) - 10, rh = yR - 34 - (PANEL.bot + 20), rw = rewards5(mode, tot, rh > 150 ? 5 : rh > 100 ? 4 : rh > 70 ? 3 : rh > 56 ? 2 : 1);
      var showR = !!rw && rh > 20; act(S.rwH.gameObject, showR); act(S.rwT.gameObject, showR);
      act(S.rwC.gameObject, showR);
      if (showR) { pos(S.rwH.transform, x0 + 24 + 150, yR); pos(S.rwC.transform, x1 - 24 - 150, yR); sT(S.rwC, S.rwCount || ''); size(S.rwT.transform, x1 - x0 - 48, rh); pos(S.rwT.transform, cx, yR - 22 - rh / 2); sT(S.rwT, rw); }
    }
    var pf = S.pressAt != null ? t - S.pressAt : 99;
    if (S.rPlus.__m) sF(S.rPlus.__m, '_Pulse', pf < 6 && S.canUp !== false ? 0.6 * (1 - pf / 6) : 0);
    var dk = oc((t - (S.rKeyAt || 0)) / 8); iC(S.rName, W, 0.35 + 0.65 * dk); iC(S.rDesc, S.showM >= 0 ? TEXT : DIM, 0.35 + 0.65 * dk);
  }
  // Output and Tactic where the stock menu shows them for this mode (Advanced: MasterModeContent; Extreme and up:
  // ExpertAdditionalBonus), with their stock labels and pictures; the rules and the limit note; the mutations
  function statusRead(w, mode, limit) {
    var st = S.stat = { has: false, v: [], ic: [], rules: [], muts: [], muIc: [], l0: '', l1: '' }, T = w.CsObj.transform, C = PATH + 'ContentMasteAndExpert/';
    var tx = function (p) { var x = T.Find(C + p), tm = x && x.GetComponent(TY(cs.TMPro.TextMeshProUGUI)); return tm && x.gameObject.activeInHierarchy ? clean(tm.text) : ''; };
    var sp = function (p) { var x = T.Find(C + p), im = x && x.GetComponent(TY(UE.UI.Image)); return im && im.sprite ? im.sprite : null; };
    try {
      if (mode !== 1 && tx('MasterModeContent/ModeUpBox/ConsciousCrystalFragBoxMaster/ConsciousCrystalFragTextMaster')) {
        var M = 'MasterModeContent/';
        st.v = [tx(M + 'ModeUpBox/ConsciousCrystalFragBoxMaster/ConsciousCrystalFragTextMaster'), tx(M + 'ModeUpBox/CurrencyBox/CurrencyText')];
        st.ic = [sp(M + 'ModeUpBox/ConsciousCrystalFragBoxMaster/ConsciousCrystalFragImg'), sp(M + 'ModeUpBox/CurrencyBox/CurrencyImg')];
        var bl = T.Find(C + M + 'BlessUpBox/BlessUpList');
        for (var i = 0, k = 0; bl && i < bl.childCount && k < 2; i++) { var it = bl.GetChild(i); if (!it.gameObject.activeSelf) continue; var vt = it.Find('BlessVal'), bg = it.Find('BlessBg'); st.v.push(vt ? clean(vt.GetComponent(TY(cs.TMPro.TextMeshProUGUI)).text) : ''); st.ic.push(bg ? bg.GetComponent(TY(UE.UI.Image)).sprite : null); k++; }
        st.l0 = tx(M + 'ModeUpBox/ModeUpTip') || 'Output'; st.l1 = tx(M + 'BlessUpBox/BlessUpTitle') || 'Tactic'; st.has = true;
      } else if (mode !== 1 && tx('ExpertModeContent/ExpertAdditionalBonus/Consciousness/ConsciousCrystalFragTextExpert')) {
        var E = 'ExpertModeContent/ExpertAdditionalBonus/';
        st.v = [tx(E + 'Consciousness/ConsciousCrystalFragTextExpert'), tx(E + 'AP/CurrencyTextExpert')];
        st.ic = [sp(E + 'Consciousness/IconFragments/Icon'), sp(E + 'AP/IconAP/Icon')];
        var be = T.Find(C + E + 'BlessUpListExpert');
        for (var j = 0, k2 = 0; be && j < be.childCount && k2 < 2; j++) { var b2 = be.GetChild(j); if (!b2.gameObject.activeSelf) continue; var v2 = b2.Find('BlessVal'), i2 = b2.Find('IconAP/Icon'); st.v.push(v2 ? clean(v2.GetComponent(TY(cs.TMPro.TextMeshProUGUI)).text) : ''); st.ic.push(i2 ? i2.GetComponent(TY(UE.UI.Image)).sprite : null); k2++; }
        // the stock labels sit hidden in this layout; their words are the same keys
        var pt = T.Find(C + E + 'ProbabilityText'), stt = T.Find(C + E + 'StrategyText');
        st.l0 = (pt && clean(pt.GetComponent(TY(cs.TMPro.TextMeshProUGUI)).text)) || 'Output'; st.l1 = (stt && clean(stt.GetComponent(TY(cs.TMPro.TextMeshProUGUI)).text)) || 'Tactic'; st.has = true;
      }
    } catch (x) {}
    try { st.rules = stockRules(w); } catch (x) {}
    st.note = limitNote(w, limit);
    try {
      var L = w.GetExpertModeBuff() || [], wg = w.widgetExpertModeBuffMap;
      if (mode !== 1) { st.muts = L; for (var m = 0; m < L.length; m++) { try { st.muIc[m] = wg.get(m).R.Img.sprite; } catch (x) { st.muIc[m] = null; } } }
    } catch (x) {}
    var spn = function (q) { return q && !q.Equals(null) ? q.name : ''; };
    st.sig = st.v.join(',') + '|' + st.ic.map(spn).join(',') + '|' + st.muIc.map(spn).join(',') + '|' + st.rules.length + '|' + st.note + '|' + st.muts.map(function (b) { return (b.IsOpen ? 1 : 0) + (b.IsLock ? 2 : 0); }).join('');
  }

  // the rewards of this mode as lines of text: the Entropy each needs, then the game's own description of it
  function hx5(c) { return c.slice(0, 3).map(function (v) { var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return s.length < 2 ? '0' + s : s; }).join(''); }
  function rewards5(mode, tot, lines) {
    // an empty answer is asked for again every 30 frames: right after the menu opens the game's list is not filled yet
    var key = mode + ':' + tot + ':' + lines; if (S.rwKey === key && (S.rwTxt || S.fc % 30)) return S.rwTxt; S.rwKey = key;
    var out = [];
    try {
      var HU = require('GamePlay/Heat/HeatUtil').default, list = mode === 1 ? null : mode === 2 ? HU.MasterModeHeatDatas.BuffList : HU.ExpertModeHeatDatas.BuffList;
      // each reward carries the Entropy it needs (MinSan). The game's description is asked for as Advanced (2) or
      // Extreme (4): for the modes above Extreme it answers with a text key, and they use Extreme's rewards
      if (list) for (var b of list) {
        var need = +b.MinSan; if (!(need >= 0)) continue;
        // Extreme, Grim of the Abyss and Endless share this list: Grim's rewards are ids 30-37, Endless's 38-45 (entropy-grim).
        // Each tab shows its own: Extreme neither of those, Grim its eight, Endless both sets (as the stock window's PerkInContext)
        var isG = false, isE = false; try { isG = !!(HU.GrimIsPerk && HU.GrimIsPerk(+b.id)); isE = !!(HU.EndlessIsPerk && HU.EndlessIsPerk(+b.id)); } catch (xp) {}
        if (mode === 104 ? !isG : mode === 105 ? !(isG || isE) : (isG || isE)) continue;
        var d = ''; try { d = clean(String(HU.GetHeatBuffDesc(b, Math.max(tot, need), mode === 2 ? 2 : 4) || '')).replace(/\s*\n\s*/g, ' '); } catch (xd) { d = ''; }
        if (!d || /^HeatBuffDesc_/.test(d)) continue;
        out.push({ need: need, got: tot >= need, d: d });
      }
    } catch (x) { note('rewards EXC ' + x); }
    out.sort(function (p, q) { return p.need - q.need; });
    // the list shows the last one or two rewards reached and the next ones to come, as many lines as the room allows; the heading counts them all
    var got = out.filter(function (o) { return o.got; }), next = out.filter(function (o) { return !o.got; });
    S.rwCount = out.length ? got.length + ' of ' + out.length + ' reached' : '';
    var ng = lines >= 4 ? 2 : 1, show = lines <= 1 ? (next.length ? next.slice(0, 1) : got.slice(-1)) : got.slice(-ng).concat(next.slice(0, Math.max(1, lines - Math.min(ng, got.length))));
    return (S.rwTxt = show.map(function (o) { return '<color=#' + hx5(o.got ? TEXT : DIM) + '><b>' + o.need + '</b>   ' + o.d + '</color>'; }).join('\n'));
  }
  // ---- the footer: Entropy to spare, then the prompt row ----
  function foot5(w, t, oF, A, limit, tot, head, strain, coreC, mode) {
    var fk = oc((oF - 16) / 12); alpha(S.footG, fk);
    act(S.fTrack.gameObject, !!limit); act(S.fFill.gameObject, !!limit); act(S.fMark.gameObject, !!limit); act(S.fTxt.gameObject, !!limit);
    sT(S.fTxt, !limit ? '' : head <= 0 ? 'NO ENTROPY TO SPARE' : head + ' ENTROPY TO SPARE');
    iC(S.fTxt, strain ? mix(DIM, AMBER, 0.8) : DIM, 1);
    if (limit) { var u = cl(tot / limit) * oc((oF - 16) / 20); size(S.fFill.transform, 640 * u, 6); iC(S.fFill, mix(coreC, W, 0.1), 0.75); }
    // the stock bar's items (read every 10 frames: the game swaps their pictures with the device), then the list view
    if (S.fc % 10 === 1 || !S.footItems) {
      var items = [];
      try {
        var root = S.fixedT && !S.fixedT.Equals(null) ? S.fixedT.Find('FixedInputRoot') : null;
        for (var i = 0; root && i < root.childCount; i++) {
          var c = root.GetChild(i); if (!c.gameObject.activeSelf) continue;
          var el = c.Find('Elements/Element'), nm = c.Find('TextInputName'), im = el && el.GetComponent(TY(UE.UI.Image)), tm = nm && nm.GetComponent(TY(cs.TMPro.TMP_Text));
          var tx = tm ? clean(tm.text) : ''; if (!tx) continue;
          items.push({ sp: im && im.sprite ? im.sprite : null, key: '', t: tx });
        }
      } catch (x) {}
      var lv = glyphOf('L'); items.push({ sp: lv && lv.sp, key: lv && lv.key, t: 'List view' });
      if (S.hasMut) { var sg = isPad() ? pg(59) : { sp: ctlSprite('KB_M_PB_1'), key: 'M' }; items.push({ sp: sg && sg.sp, key: sg && sg.key, t: S.zone5 === 'muts' ? 'Modifiers' : 'Mutations' }); }
      if (N5.mouseAt != null && D.t - N5.mouseAt < 600 && !isPad()) items.push({ sp: null, key: 'Mouse', t: 'Left raises, right lowers' });
      S.footItems = items;
    }
    var it = S.footItems, sig = it.map(function (q) { return (q.sp ? q.sp.name : q.key) + q.t; }).join('|');
    if (S.footSig !== sig) {
      S.footSig = sig; var x = 920;
      for (var k = S.fp.length - 1; k >= 0; k--) {
        var Q = S.fp[k], q = it[k - (S.fp.length - it.length)];
        if (!q) { act(Q.t.gameObject, false); continue; }
        act(Q.t.gameObject, true); var wq = setPrompt(Q, q, q.t); pos(Q.t, x - wq / 2, -500); x -= wq + 34;
        iC(Q.lb, TEXT, 0.9); iC(Q.kt, TEXT, 0.9);
      }
    }
  }

  // ---- events ----
  function events(w, t, rows, n, sel, mode, A, deg, tot, limit) {
    var ready = t - S.stagAt > 12;
    // a pick: the stock select frame snaps onto the row's icon (0.22 here: the design's 0.42 is v4's socket size and ran
    // past the row; gone in 16 f)
    if (S.sel !== sel) {
      if (S.sel != null && ready) { var R = S.rows[sel]; if (R) { kill(S.pickFx); S.pickFx = fx(R.t, 'ChaosValue_Select_kuang_502', LIST.x0 + 30, 0, 0.22, deg, 16); } }
      S.sel = sel;
    }
    // rank changes: up = a star on the new pip and a ring out of the core; down = the pip drains (no burst)
    var lvNow = {};
    for (var k = 0; k < n; k++) {
      var Rw = rows[k], was = S.lv[Rw.id]; lvNow[Rw.id] = Rw.lv;
      if (was != null && ready && Rw.lv > was) {
        var R2 = S.rows[k];
        if (R2) fx(R2.t, 'ConsciousLevelUp_StarAppear_501', PIPX + (Rw.lv - 1) * 13, 0, 0.6, null, 40);   // the donor's own colours: a tinted copy of this quad drew nothing (window 2)
        fx(S.core, 'ChaosValue_503', 0, 0, 3.6, deg, 40); S.rankFlash = t;
      }
    }
    S.lv = lvNow;
    // a perk crossed: its tick on the gauge lights with the stock unlock burst, untinted (tinted copies of these one-shot
    // quads drew nothing in window 2)
    if (mode !== 1) {
      var got = perkVals().filter(function (v) { return v <= tot && (!limit || v <= limit); });
      if (S.reached && ready) got.forEach(function (v) { if (S.reached.indexOf(v) < 0 && S.tickPos[v]) fx(S.gHost, 'ChaosScheduleUnlock_Complete', S.tickPos[v][0], S.tickPos[v][1], 1.0, null, 70); });
      S.reached = got;
    }
  }
  return 'v5 core on';
})();
  }]);
  layers.forEach(function (L) { try { L[1](); log('entropy dial: ' + L[0] + ' loaded'); } catch (e) { log('entropy dial ' + L[0] + ' EXC ' + e); } });
  setTimeout(function () { try { if (G.ED && G.ED.prewarm && !G.ED.B) log('entropy dial: ' + G.ED.prewarm()); } catch (e) {} }, 1500);
  }
  setTimeout(boot, 500);
})();
