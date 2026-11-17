(function () {
  // v5 (the lead, 2026-11-10: "Pause menu ... need a rework from the ground up new positions new layout new assets new
  // effects new vfx new animations"): the same mechanism as V4 below, a new screen in the Entropy menu's language: a command
  // list on the left, a live core in the middle, the MODS panel on the right, on the Entropy bundle's plates and fonts.
  // The pause menu, V4 (Redux menus, the lead 2026-11-03: "make sure pause menu also has a new layout ... use animated
  // gradients"). The stock window stays and keeps working: its rows are the buttons, input and navigation. We hide its
  // left column, move each row's rect onto a card of our own (a 3-column grid of tiles, then the pills), so the game's own
  // navigation walks the grid, and draw the cards, the header, the MODS panel and the backdrop over it on the lobby's
  // materials (fourlight.js fxKit). Everything we change is put back on close. Co-op pauses keep the stock layout.
  var cs = CS, G = globalThis, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof, TMP = cs.TMPro, TM = UE.Time;
  function log(m) { G.BB4.log("V4PAUSE", m); }
  function es(e) { return G.BB4.es ? G.BB4.es(e) : String(e); }
  var P = G.BB4PAUSE = G.BB4PAUSE || {};
  if (P.timer) { clearInterval(P.timer); P.timer = null; }
  var reopen = null;
  if (P.st && P.close) { reopen = P.st.w; try { P.close(); } catch (e) { log("reload close: " + es(e)); } }

  var TEAL = [0.18, 0.78, 0.88], TEALW = [0.6, 0.94, 1], STEEL = [0.56, 0.66, 0.76], INK = [0.88, 0.94, 0.96], DIM = [0.5, 0.6, 0.66],
    RED = [1, 0.26, 0.32], REDW = [1, 0.6, 0.62], PLATE = [0.035, 0.075, 0.095, 0.9], HEXD = [0.02, 0.06, 0.08], W = [1, 1, 1];
  var GY = 8, TOP = 452, VIEW = 828, RH = 84;
  var K = null, M, SP, H, washM;
  function V2(x, y) { return new UE.Vector2(x, y); }
  function alive(o) { return o && !o.Equals(null); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function kit() {
    if (K) return true;
    var B = G.BB4UI, L = G.BB4LIT; if (!B || !L || !L.fxKit) return false;
    var ui = null; try { if (alive(B.ui)) ui = B.ui; } catch (e) { }
    K = L.fxKit({ ui: ui || B.prefab().transform }); if (!K) return false;
    M = K.M; SP = K.SP; H = K.h;
    washM = K.mat("Lb_Glow", "pauseWash", { Mode: 9, TintRamp: 1, NoisePx: 900, Speed: 0.05, Distort: 0.6, Occlude: 0.92, GradLo: 0, GradHi: 0.2,
      Period: 9, Width: 0.2, Angle: 25, Band: 0.3, TexMix: 0, Intensity: 1, Flicker: 0 });
    return true;
  }
  function deep(tr, name) {
    if (!alive(tr)) return null; if (tr.name == name) return tr;
    for (var i = 0; i < tr.childCount; i++) { var r = deep(tr.GetChild(i), name); if (r) return r; }
    return null;
  }
  function tmpOf(tr) { return alive(tr) ? tr.GetComponent(T(TMP.TMP_Text)) : null; }
  function cg(tr) { return tr.GetComponent(T(UE.CanvasGroup)) || tr.gameObject.AddComponent(T(UE.CanvasGroup)); }
  function pos(rt, x, y) { var p = rt.anchoredPosition; if (Math.abs(p.x - x) + Math.abs(p.y - y) > 0.25) rt.anchoredPosition = V2(x, y); }
  function scl(rt, s) { if (Math.abs(rt.localScale.x - s) > 0.002) rt.localScale = new UE.Vector3(s, s, 1); }
  function alpha(g, a) { if (Math.abs(g.alpha - a) > 0.004) g.alpha = a; }

  // the rows of TabArea: tiles before LineBox, pills after it
  function rowsOf(ta) {
    var R = { tiles: [], pills: [] }, line = false;
    for (var j = 0; j < ta.childCount; j++) {
      var r = ta.GetChild(j); if (r.name == "LineBox") { line = true; continue; }
      if (!r.gameObject.activeSelf || !r.GetComponent(T(UI.Selectable))) continue;
      (line ? R.pills : R.tiles).push(r);
    }
    R.sig = R.tiles.concat(R.pills).map(function (r) { return r.name; }).join(",");
    return R;
  }
  function pgOf(w) { try { var g = w.CsObj.gameObject; if (alive(g)) return g; } catch (e) { } return UE.GameObject.Find("PDAssistant"); }

  P.onOpen = function (w) {
    if (!kit() || !bundle()) { if (!P.warned) { P.warned = 1; log("no light kit or plate bundle yet: the stock pause stays"); } return "wait"; }
    var pg = pgOf(w); if (!alive(pg) || !pg.activeInHierarchy) return;
    var sa = pg.transform.Find("SafeAreaFitter"), ta = sa && sa.Find("Left/TabArea"); if (!alive(ta)) return;
    var tm = sa.Find("TeammatchFuncs"); if (alive(tm) && tm.gameObject.activeInHierarchy) return "stock";
    var R = rowsOf(ta); if (!R.tiles.length) return;
    var s = P.st; if (s && s.pg == pg && s.sig == R.sig && alive(s.root)) return;
    if (s) P.close();
    try { build(w, pg, sa, ta, R); } catch (e) { log("build: " + es(e)); try { P.close(); } catch (e2) { } }
  };

  // ---- text
  function txt(s, par, name, x, y, w, h, size, c, align, style, piv) {
    var rt = H.node(par, name); if (piv != null) rt.pivot = V2(piv, 0.5); rt.sizeDelta = V2(w, h); rt.anchoredPosition = V2(x, y);
    var t = rt.gameObject.AddComponent(T(TMP.TextMeshProUGUI));
    if (s.font) { t.font = s.font; if (s.fontMat) t.fontSharedMaterial = s.fontMat; }
    t.fontSize = size; t.color = H.col(c); t.enableWordWrapping = false; t.raycastTarget = false;
    t.overflowMode = TMP.TextOverflowModes.Overflow; t.alignment = align || TMP.TextAlignmentOptions.Left; t.fontStyle = style == null ? 3 : style;
    return t;
  }
  function setT(t, v) { v = v == null ? "" : String(v); if (t.text != v) t.text = v; }

  // ---- v5: the Entropy menu's plates and fonts (its bundle, shared through G.__EDB), the hue as a dark saturated fill
  var PMAT = null, LMAT = null, CMAT = null, FONTS = null;
  function bundle() {
    try {
      if (!G.__EDB || G.__EDB.Equals(null)) { var p = G.ED_BUNDLE_PATH(); G.__EDB = UE.AssetBundle.LoadFromFile(p, 0, BigInt(G.ED_BUNDLE_OFFSET || 0)); }
      var b = G.__EDB; if (!b || b.Equals(null)) return false;
      if (!PMAT || PMAT.Equals(null)) { var all = b.LoadAllAssets(T(UE.Material)); for (var i = 0; i < all.Length; i++) if (all.get_Item(i).name === "ED_Plate") PMAT = all.get_Item(i); else if (all.get_Item(i).name === "ED_LightFx") LMAT = all.get_Item(i); else if (all.get_Item(i).name === "ED_CoreEnergy") CMAT = all.get_Item(i); }
      if (!FONTS) { FONTS = {}; var fa = b.LoadAllAssets(T(TMP.TMP_FontAsset)); for (var j = 0; j < fa.Length; j++) FONTS[fa.get_Item(j).name] = fa.get_Item(j); }
      return !!PMAT && !PMAT.Equals(null);
    } catch (e) { log("bundle: " + es(e)); return false; }
  }
  function fnt(t, kind) {
    var want = { display: /aldrich/i, body: /chakra.*semi/i, bodyR: /chakra.*reg/i, data: /share.*mono/i }[kind || "display"];
    for (var k in FONTS) if (want.test(k)) { t.font = FONTS[k]; t.fontSharedMaterial = FONTS[k].material; break; }
    t.fontStyle = 0; return t;
  }
  function tintD(A, v, sat) { var m = Math.max(A[0], A[1], A[2], 0.001); return [v * (1 - sat + sat * A[0] / m), v * (1 - sat + sat * A[1] / m), v * (1 - sat + sat * A[2] / m)]; }
  function mixc(a, b, k) { k = clamp(k, 0, 1); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function mc(m, k, c, a) { m.SetColor(k, new UE.Color(c[0], c[1], c[2], a == null ? 1 : a)); }
  function plate(s, par, name, x, y, w, h, o) {
    o = o || {}; var im = H.img(par, name, x, y, w, h, null, null, [1, 1, 1, 1]), m = new UE.Material(PMAT); im.material = m; im.raycastTarget = false; im.__m = m;
    s.undo.push(function () { try { UE.Object.Destroy(m); } catch (e) { } });
    m.SetVector("_Size", new UE.Vector4(w, h, 0, 0)); var c = o.cut || [0, 0, 0, 0]; m.SetVector("_Cut", new UE.Vector4(c[0], c[1], c[2], c[3]));
    mc(m, "_Fill", o.fill || tintD(TEAL, 0.085, 0.92), o.alpha == null ? 0.93 : o.alpha); mc(m, "_Line", o.line || mixc(TEAL, W, 0.15), o.lineA == null ? 0.6 : o.lineA); m.SetFloat("_LineW", o.lineW || 1.5);
    if (o.bracket) { m.SetFloat("_Bracket", 1); m.SetFloat("_BracketLen", o.bracket); m.SetFloat("_BracketW", 2); mc(m, "_BracketColor", mixc(TEAL, W, 0.2), 0.85); } else m.SetFloat("_Bracket", 0);
    m.SetFloat("_Raised", 0); m.SetFloat("_Hex", o.hex ? 1 : 0); m.SetFloat("_Dash", 0); m.SetFloat("_Lit", o.lit == null ? 0.2 : o.lit); m.SetFloat("_Weave", o.weave == null ? 0.12 : o.weave);
    m.SetFloat("_Rim", 0.25); m.SetFloat("_Run", 0); m.SetFloat("_EdgeGlow", o.edge || 0); m.SetFloat("_Pulse", 0); mc(m, "_Glow", W, 0); mc(m, "_Accent", TEAL, 1); m.SetFloat("_AccentMix", 0.35);
    return im;
  }
  // a light drawn by the Entropy bundle's light shader (0 streak, 1 star glint, 2 sweep, 3 bloom): every pixel computed
  // each frame at the screen's resolution; the Image colour is its colour and its alpha the strength
  function light(s, par, name, x, y, w, h, mode, props, c, a) {
    var im = H.img(par, name, x, y, w, h, null, null, [c[0], c[1], c[2], a == null ? 1 : a]); im.raycastTarget = false; if (!LMAT || LMAT.Equals(null)) { im.enabled = false; return im; }
    var m = new UE.Material(LMAT); m.SetFloat("_Mode", mode); for (var k in props) m.SetFloat(k, props[k]); im.material = m; im.__m = m;
    s.undo.push(function () { try { UE.Object.Destroy(m); } catch (e) { } });
    return im;
  }
  function la(im, c, a) { if (im.__la != null && Math.abs(im.__la - a) < 0.004) return; im.__la = a; im.color = H.col(c, a); }
  // one of the game's own menu effects on a node of ours (bound to it, scaled through the play parameter)
  function fxPlay(par, name, x, y, sc) {
    var rt = H.node(par, "Fx_" + name); rt.sizeDelta = V2(100, 100); rt.anchoredPosition = V2(x, y);
    var p = rt.gameObject.AddComponent(T(cs.NOAH.VFX.VFXEffectPlayer)); p.m_param = new cs.EffectPlayParamEx();
    p.m_param.name = "UI/Common/" + name; p.m_param.target = rt; p.m_param.bind = true; p.m_param.AutoOrder = true; p.m_param.localScale = new UE.Vector3(sc, sc, 1);
    try { p.PlayEffect(1); } catch (e) { log("fx " + name + ": " + es(e)); }
    return { rt: rt, p: p };
  }
  function fxAlive(o) { try { var e = o.p.Effect; return !!e && !e.Equals(null) && e.gameObject.activeInHierarchy; } catch (e2) { return false; } }

  // ---- one row of the list (or a button under it): a plate the stock row's rect follows
  function card(s, par, row, i, x, y, w, h, pill) {
    var slot = H.node(par, "Slot" + i); slot.sizeDelta = V2(w, h); slot.anchoredPosition = V2(x, y);
    var vis = H.node(slot, "Vis"); vis.sizeDelta = V2(w, h); var g = cg(vis); g.alpha = 0; g.blocksRaycasts = false; g.interactable = false;
    var B = { row: row, name: row.name, slot: slot, vis: vis, cg: g, x: x, y: y, w: w, h: h, pill: pill, on: false, at: 0, offAt: -9, red: pill && row.name == "NodeGiveUp" };
    B.p = plate(s, vis, "Plate", 0, 0, w, h, { cut: [10, 0, 10, 0], alpha: 0.85, lineA: 0.4, weave: 0.05 });
    var mk = H.fimg(vis, "Mk", SP.lb_btn, null, [1, 1, 1, 1], 0, 0, true); mk.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = false;
    B.sh = H.sheen(mk.rectTransform, "Sh", h * 0.9, H.off(W), [1, 0.9, 0.95, 0]);
    var src = tmpOf(row) || row.GetComponentInChildren(T(TMP.TMP_Text), true); B.src = src;
    if (pill) {
      B.label = fnt(txt(s, vis, "Label", 0, 0, w - 30, h, 25, INK, TMP.TextAlignmentOptions.Center, 0), "display");
    } else {
      var ic = row.Find("Box/icon"), im = ic ? ic.GetComponent(T(UI.Image)) : null;
      // 0.1.26 (Boogy, 2026-11-15: the first time the menu opened there were no icons beside the names, a second open had them):
      // the stock row has not set its icon yet when the card is built, so the icon is made whenever the row has one and takes the sprite as soon as it is there
      if (im) { B.icSrc = im; B.icon = H.img(vis, "Icon", -w / 2 + 52, 0, 58, 58, null, null, INK); B.icon.preserveAspect = true; B.icon.sprite = im.sprite; B.icon.enabled = !!im.sprite; }
      B.idx = fnt(txt(s, vis, "Idx", w / 2 - 22, 0, 60, 34, 21, DIM, TMP.TextAlignmentOptions.Right, 0, 1), "body"); setT(B.idx, (i < 9 ? "0" : "") + (i + 1));
      B.label = fnt(txt(s, vis, "Label", -w / 2 + 104, 0, w - 190, h * 0.85, 33, INK, TMP.TextAlignmentOptions.Left, 0, 0), "body");
      B.label.enableWordWrapping = true; B.label.enableAutoSizing = true; B.label.fontSizeMin = 20; B.label.fontSizeMax = 33;
      B.redSrc = row.Find("Box/ImgRed"); B.dot = H.img(vis, "Red", -w / 2 + 14, h / 2 - 12, 14, 14, "lb_dot", M.glow, H.off(RED));
    }
    if (!pill) B.ul = H.grow(vis, "Ul", -w / 2 + 104, -h / 2 + 14, -w / 2 + 104 + Math.min(300, w - 230), -h / 2 + 14, 2, M.glow, H.off(TEALW));
    B.gl = light(s, vis, "Glint", pill ? 0 : -w / 2 + 52, 0, 150, 150, 1, { _Thin: 22, _Core: 1.8, _Twinkle: 0.15, _Rate: 2 }, TEALW, 0);
    if (B.src) setT(B.label, B.src.text);
    return B;
  }
  function cardAt(B, t, u, lit) {
    if (lit && !B.on) B.at = t; if (!lit && B.on) B.offAt = t; B.on = lit;
    if (B.icSrc && B.icon) { try { var spr = B.icSrc.sprite; if (spr && !spr.Equals(null) && B.icon.sprite !== spr) { B.icon.sprite = spr; B.icon.enabled = true; } } catch (e) { } }
    var g = B.g = lit ? H.ease(H.clamp01((t - B.at) / 0.12)) : 1 - H.ease(H.clamp01((t - B.offAt) / 0.2));
    var HUE = B.red ? mixc(TEAL, RED, g) : TEAL, key = g.toFixed(2) + (B.red ? "r" : "");
    if (B.vk !== key) {
      B.vk = key; var m = B.p.__m;
      mc(m, "_Fill", mixc(tintD(HUE, B.pill ? 0.1 : 0.2, 0.92), tintD(HUE, 0.46, 0.92), g), 0.88 + 0.08 * g);
      mc(m, "_Line", mixc(mixc(STEEL, HUE, 0.7), mixc(HUE, W, 0.45), g), 0.4 + 0.5 * g);
      m.SetFloat("_Lit", 0.3 + 1.7 * g); m.SetFloat("_EdgeGlow", 0.3 * g); m.SetFloat("_Run", g > 0.5 ? 1 : 0); m.SetFloat("_RunSpeed", 120); m.SetFloat("_RunLen", 90);
      mc(m, "_Accent", HUE, 1); m.SetFloat("_AccentMix", 0.4 + 0.3 * g);
      H.setC(B.label, mixc(INK, W, g), 1, 0);
      if (B.icon) H.setC(B.icon, mixc(mixc(INK, TEAL, 0.35), W, g), 1, 0);
      if (B.idx) H.setC(B.idx, mixc(DIM, W, g), 1, 0);
    }
    if (B.dot) H.lum(B.dot, RED, B.hasRed ? 0.75 + 0.25 * Math.sin(t * 4) : 0, 0.1);
    // the highlight: a pulse through the plate (0.25 s), a glint that opens on the icon (0.35 s), a sheen across the row
    // (again every 2.6 s while it stays picked), an underline that draws in
    var since = lit ? t - B.at : 9, HOT = B.red ? REDW : TEALW;
    H.sheenAt(B.sh, lit ? H.pass(t, B.at, 2.6, 0.6) : -1, -B.w / 2 - 60, B.w + 120, 0, 1);
    var pl = since < 0.25 ? 0.7 * (1 - since / 0.25) : 0; if (pl !== B.pl) { B.pl = pl; B.p.__m.SetFloat("_Pulse", pl); }
    var ga = since < 0.35 ? 1 - since / 0.35 : 0; if (ga !== B.ga) { B.ga = ga; la(B.gl, HOT, ga); scl(B.gl.rectTransform, 0.5 + 1.0 * (1 - ga)); }
    if (B.ul) { H.drawIn(B.ul, lit ? H.clamp01(since / 0.3) : 0); H.lum(B.ul.g, HOT, lit ? 0.9 : 0, 0.2); }
  }

  // ---- the ground: the lobby's teal wash, horizon, shafts and dust (its materials), nothing else behind the panels
  function backdrop(s, root, RW) {
    var D = s.bd = {}, Md = H.node(root, "Back"); Md.sizeDelta = V2(RW, 1080);
    D.wash = H.img(Md, "Wash", 0, 0, RW + 40, 1120, null, washM, [TEAL[0], TEAL[1], TEAL[2], 0.32]);
    D.hz = H.img(Md, "Horizon", 0, -175, RW + 40, 160, "lb_dot", M.soft, H.off(TEAL));
    D.shafts = H.shafts(Md, TEAL);
    D.fc = H.comet(Md, "Floor", -RW / 2, -486, RW / 2, -486, 1.4);
    D.dust = H.dust(Md, TEAL, -RW / 2, -320, RW, 860, 14, 5);
  }
  function backAt(s, t, fi) {
    var D = s.bd, RW = s.RW;
    H.setC(D.wash, TEAL, 0.32 * fi, 0);
    H.lum(D.hz, TEAL, fi * (0.2 + 0.05 * Math.sin(t * 0.8)), 0);
    H.shaftsAt(D.shafts, t, -RW / 2, RW, 60, fi);
    H.cometAt(D.fc, H.pass(t, 2, 9, 2.2), TEALW, fi);
    H.dustAt(D.dust, t, fi);
  }

  function build(w, pg, sa, ta, R) {
    var saRt = sa.GetComponent(T(UE.RectTransform)), k = saRt.rect.height / 1080, RW = saRt.rect.width / k;
    var s = P.st = { w: w, pg: pg, sa: sa, ta: ta, sig: R.sig, t0: TM.unscaledTime, wAt: 0, k: k, RW: RW, tiles: [], pills: [], undo: [], scroll: 0, target: 0, foc: "" };
    s.g = pg.GetComponent(T(cs.GamePlay.InputGroup));
    var lab = R.tiles[0].GetComponentInChildren(T(TMP.TMP_Text), true); if (lab) { s.font = lab.font; s.fontMat = lab.fontSharedMaterial; }
    var root = s.root = H.node(sa, "V4Pause"); root.SetAsLastSibling(); root.sizeDelta = V2(RW, 1080); root.localScale = new UE.Vector3(k, k, 1);
    s.undo.push(function () { H.kill(root); });
    s.rootCG = cg(root); s.cover = 0;
    backdrop(s, root, RW);

    // layout, in 1080 units: the list, the core, the MODS panel
    var LW = clamp(Math.round(RW * 0.28), 500, 760), PAD = 30, ML = PAD, x0 = -RW / 2 + PAD, xR = RW / 2 - PAD, lw = LW - 2 * PAD, gx = 0;
    var tw = lw, th = RH, nr = R.tiles.length, gw = lw, gR = x0 + lw;
    var pw = LW, PT = 540, PB = -540, PH = PT - PB, CX = 0, CS = clamp((RW - 2 * LW) / 800, 0.8, 1.2);
    s.L = { ML: ML, x0: x0, xR: xR, tw: tw, th: th, gx: gx, nr: nr, gR: gR, hc: nr * th + (nr - 1) * GY, CX: CX, CS: CS };

    // the stock parts we stand in for
    var left = sa.Find("Left"), lcg = left.GetComponent(T(UE.CanvasGroup)), lAdd = !lcg; lcg = cg(left);
    var lk = [lcg.alpha, lcg.blocksRaycasts, lcg.interactable]; s.leftCG = lcg; lcg.alpha = 0; lcg.blocksRaycasts = true; lcg.interactable = true;
    s.undo.push(function () { if (!alive(lcg)) return; lcg.alpha = lk[0]; lcg.blocksRaycasts = lk[1]; lcg.interactable = lk[2]; });
    s.stage = tmpOf(sa.Find("BattleInfoStatWrap/StageInfo"));
    if (s.stage) { var se = s.stage.enabled; s.undo.push(function () { if (alive(s.stage)) s.stage.enabled = se; }); }
    var bg = deep(pg.transform, "BgPDA"); s.bgOff = [];
    if (bg) ["point", "grid"].forEach(function (n) { var c = bg.Find(n); if (alive(c)) { var a = c.gameObject.activeSelf; s.bgOff.push(c.gameObject); s.undo.push(function () { if (alive(c)) c.gameObject.SetActive(a); }); } });
    s.fixed = UE.GameObject.Find("FixedInputArea"); if (s.fixed) hideCG(s, s.fixed.transform, "fixedCG");
    // 2026-11-14 (the lead: "You can still see the old pause menu behind the new menu"): the battle stats (Highest Combos,
    // Perfect Kills, battle time...) under BattleInfoStatWrap drew through the see-through wash. Every stock child of the safe
    // area except the ones handled here (Left keeps its input, Debug its text) draws nothing; alpha 0 keeps them live
    s.kidG = [];
    for (var ki = 0; ki < sa.childCount; ki++) {
      var kc = sa.GetChild(ki), kn = kc.name; if (kn == "V4Pause" || kn == "Left" || kn == "Debug" || kn == "TeammatchFuncs") continue;
      hideCG(s, kc, "kidTmp"); s.kidG.push(s.kidTmp);
    }
    var dbg = sa.Find("Debug"); s.dbgT = tmpOf(sa.Find("Debug/TextDebug")); if (alive(dbg)) {
      // the stock debug panel stays live for its text, but its own button (NodeBlessDebug) must not take the focus unseen
      hideCG(s, dbg, "dbgCG"); var dg = s.dbgCG, di = [dg.interactable, dg.blocksRaycasts]; dg.interactable = false; dg.blocksRaycasts = false;
      s.undo.push(function () { if (alive(dg)) { dg.interactable = di[0]; dg.blocksRaycasts = di[1]; } });
      // the game's navigation reads neither flag: the button's Selectable itself is switched off while the pause is open
      var ds = dbg.GetComponentsInChildren(T(UI.Selectable), true);
      for (var di2 = 0; di2 < ds.Length; di2++) (function (x) { var on = x.enabled; x.enabled = false; s.undo.push(function () { if (alive(x)) x.enabled = on; }); })(ds.get_Item(di2));
    }

    // the rows onto the cards; a full-size hit area on each so the mouse takes the whole card
    var vlg = ta.GetComponent(T(UI.VerticalLayoutGroup)); if (vlg) { var ve = vlg.enabled; vlg.enabled = false; s.undo.push(function () { if (alive(vlg)) vlg.enabled = ve; if (alive(ta)) UI.LayoutRebuilder.ForceRebuildLayoutImmediate(ta.GetComponent(T(UE.RectTransform))); }); }
    // the list panel, its rows (one column, the stock order) and the two buttons under them
    var lp = s.lp = H.node(root, "ListPanel"); lp.sizeDelta = V2(RW, 1080); s.lpG = cg(lp); s.lpG.alpha = 0; s.lpG.blocksRaycasts = false;
    var lpP = plate(s, lp, "Panel", -RW / 2 + LW / 2 - 12, 0, LW + 24, PH + 48, { alpha: 0.93 });   // past the screen on three sides: only its inner edge shows
    lpP.__m.SetFloat("_Run", 1); lpP.__m.SetFloat("_RunSpeed", 55); lpP.__m.SetFloat("_RunLen", 220);
    light(s, lp, "PanelSweep", -RW / 2 + LW / 2, 0, LW, PH, 2, { _Period: 7, _Width: 0.1, _Angle: 20 }, TEALW, 0.07);
    s.lHead = fnt(txt(s, lp, "Head", x0, PT - 44, 300, 30, 22, mixc(TEAL, W, 0.3), null, 0, 0), "display"); s.lHead.characterSpacing = 4; setT(s.lHead, "MENU");
    s.lCount = fnt(txt(s, lp, "Count", gR, PT - 44, 200, 30, 20, DIM, TMP.TextAlignmentOptions.Right, 0, 1), "body"); setT(s.lCount, "");
    var grid = H.node(root, "Grid"); grid.sizeDelta = V2(RW, 1080);
    R.tiles.forEach(function (row, i) {
      var B = card(s, grid, row, i, x0 + lw / 2, TOP - th / 2 - i * (th + GY), lw, th, false);
      B.r = i; B.c = 0; s.tiles.push(B); hook(s, B);
    });
    var pills = H.node(root, "Pills"); pills.sizeDelta = V2(RW, 1080);
    var np = Math.max(1, R.pills.length), pwid = (lw - (np - 1) * 12) / np;
    R.pills.forEach(function (row, i) { var B = card(s, pills, row, 9 + i, x0 + pwid / 2 + i * (pwid + 12), PB + 88, pwid, 60, true); B.r = nr + 1; B.c = i; s.pills.push(B); hook(s, B); });

    // the rail, shown only when the list scrolls
    s.rail = H.img(root, "Rail", x0 - 10, TOP - VIEW / 2, 3, VIEW, null, null, H.off(DIM));
    s.thumb = H.img(root, "Thumb", x0 - 10, TOP, 4, 80, "lb_dot", M.glow, H.off(TEAL));

    // the core: a hex face with the state and the stage, the game's own hex trail effect behind it, a scanning gauge round it
    var core = s.core = H.node(root, "Core"); core.sizeDelta = V2(700, 700); core.anchoredPosition = V2(CX, 86); s.coreG = cg(core); s.coreG.alpha = 0; s.coreG.blocksRaycasts = false;
    // the core's own effect (uikit\Assets\EntropyDial\Shaders\CoreEnergy.shader, ours): the energy between the two hexes,
    // the rays, the ticks with their scanning sector and the two dashed rings, computed per pixel at the screen's size
    s.energy = H.img(core, "Energy", 0, 0, 900, 900, null, null, [TEAL[0], TEAL[1], TEAL[2], 0]); s.energy.raycastTarget = false;
    if (CMAT && !CMAT.Equals(null)) { var em = new UE.Material(CMAT); s.energy.material = em; s.energy.__m = em; em.SetColor("_Hot", H.col(mixc(TEALW, W, 0.5), 1)); em.SetFloat("_Inner", 0.30); em.SetFloat("_Outer", 0.435); em.SetFloat("_PulseAmp", 0.1);   // a faint ripple (the testers, 2026-11-10: the pulse on every move was too much)
      s.undo.push(function () { try { UE.Object.Destroy(em); } catch (e) { } }); } else s.energy.enabled = false;
    s.beams = [1, -1].map(function (d, i) { var b = light(s, core, "Beam" + i, 0, d * 395, 330, 46, 0, { _Thin: 30, _Halo: 0.45, _Core: 1.3 }, TEALW, 0); b.rectTransform.localEulerAngles = new UE.Vector3(0, 0, 90); return b; });
    s.dust2 = H.dust(core, TEAL, -360, -360, 720, 720, 24, 4);
    // the frame is drawn by the plate shader at the screen's own resolution (the lead, 2026-11-10: a stock effect scaled up
    // 2.3x here "looks low quality ... they need to be high res"): an outer hex with two runner lights, a thin middle hex
    s.ring = plate(s, core, "Ring", 0, 0, 392, 452, { hex: 1, alpha: 0, line: mixc(TEAL, W, 0.25), lineA: 1, lineW: 5, lit: 1.6, edge: 0.55, weave: 0 });
    var rm = s.ring.__m; rm.SetFloat("_Run", 1); rm.SetFloat("_RunSpeed", 90); rm.SetFloat("_RunLen", 160); rm.SetFloat("_Rim", 0);
    s.ring2 = plate(s, core, "Ring2", 0, 0, 326, 376, { hex: 1, alpha: 0, line: TEAL, lineA: 0.55, lineW: 1.5, lit: 0.6, edge: 0.15, weave: 0 });
    s.ring2.__m.SetFloat("_Rim", 0);
    s.face = plate(s, core, "Face", 0, 0, 268, 312, { hex: 1, alpha: 0.9, fill: tintD(TEAL, 0.05, 0.8), line: mixc(TEAL, W, 0.4), lineA: 0.9, lit: 1.2, edge: 0.3 });
    s.glints = [[0, 226], [196, 113], [196, -113], [0, -226], [-196, -113], [-196, 113]].map(function (q, i) { return light(s, core, "Vx" + i, q[0], q[1], 86, 86, 1, { _Thin: 20, _Core: 1.5, _Twinkle: 0.85, _Rate: 0.6, _Phase: i * 0.37 }, TEALW, 0); });
    s.title = fnt(txt(s, core, "Title", 0, 10, 300, 70, 50, INK, TMP.TextAlignmentOptions.Center, 0), "display"); setT(s.title, "PAUSED");
    s.kick = fnt(txt(s, core, "Kicker", 0, -42, 300, 30, 17, TEAL, TMP.TextAlignmentOptions.Center, 0), "display"); s.kick.characterSpacing = 3;
    var pp = s.pp = H.node(root, "Player"); pp.sizeDelta = V2(560, 104); pp.anchoredPosition = V2(CX, 86 - 372 * CS - 66); s.ppG = cg(pp); s.ppG.alpha = 0; s.ppG.blocksRaycasts = false;
    plate(s, pp, "Plate", 0, 0, 560, 104, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.92 });
    s.name = fnt(txt(s, pp, "Name", -252, 16, 270, 44, 32, INK, null, 0, 0), "display"); s.name.enableAutoSizing = true; s.name.fontSizeMin = 18; s.name.fontSizeMax = 32;
    s.pid = fnt(txt(s, pp, "Id", -252, -24, 270, 26, 18, DIM, null, 0, 0), "body");
    H.img(pp, "Rule", 36, 0, 1, 64, null, null, [TEAL[0], TEAL[1], TEAL[2], 0.5]);
    s.curI = H.img(pp, "CurIcon", 70, 0, 36, 36, null, null, [1, 1, 1, 0]); s.curI.preserveAspect = true; s.curI.raycastTarget = false;
    s.curT = fnt(txt(s, pp, "Cur", 98, 0, 166, 44, 30, TEALW, null, 0, 0), "display"); s.curT.enableAutoSizing = true; s.curT.fontSizeMin = 16; s.curT.fontSizeMax = 30;
    s.srcName = tmpOf(sa.Find("Left/PlayerInfo/TextPlayerName")); s.srcId = tmpOf(sa.Find("Left/PlayerID/TextPlayerId"));
    // the stock money row stays where it is, hidden with the stock column; its number and picture are read from it
    var cur = sa.Find("Left/PlayerInfo/NodeCurrency");
    if (alive(cur)) { s.cur = cur; s.curSrcT = tmpOf(cur.Find("TextCount")); var ci0 = cur.Find("ImgRes"); s.curSrcI = ci0 ? ci0.GetComponent(T(UI.Image)) : null; }

    // the MODS panel (the loader's list, which the stock pause prints top left)
    // 0.1.16 (Aneubys, 2026-11-11: "the mod list box should be smaller"): a box in the top right corner, a fifth of the
    // screen wide and under half its height, instead of a panel down the whole right side; a longer list still scrolls
    pw = clamp(Math.round(RW * 0.2), 380, 500); PH = 540;
    var pn = s.pn = H.node(root, "Mods"); pn.sizeDelta = V2(pw, PH); s.pnX = RW / 2 - 30 - pw / 2; s.pnY = 540 - 30 - PH / 2; pn.anchoredPosition = V2(s.pnX, s.pnY);
    s.pcg = cg(pn); s.pcg.alpha = 0; s.pcg.blocksRaycasts = false;
    var pnP = plate(s, pn, "Plate", 0, 0, pw, PH, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.93 });
    pnP.__m.SetFloat("_Run", 1); pnP.__m.SetFloat("_RunSpeed", 55); pnP.__m.SetFloat("_RunLen", 220); pnP.__m.SetFloat("_RunPhase", 0.5);
    light(s, pn, "PanelSweep", 0, 0, pw, PH, 2, { _Period: 7, _Width: 0.1, _Angle: 20, _Phase: 0.5 }, TEALW, 0.07);
    s.pHead = fnt(txt(s, pn, "Head", -pw / 2 + PAD, PH / 2 - 44, 300, 30, 22, mixc(TEAL, W, 0.3), null, 0, 0), "display"); s.pHead.characterSpacing = 4; setT(s.pHead, "MODS");
    s.pCount = fnt(txt(s, pn, "Count", pw / 2 - PAD, PH / 2 - 44, 160, 30, 20, DIM, TMP.TextAlignmentOptions.Right, 0, 1), "body");
    H.img(pn, "Rule", 0, PH / 2 - 72, pw - 2 * PAD, 1, null, null, [TEAL[0], TEAL[1], TEAL[2], 0.45]);
    var vh = s.modVH = PH - 72 - 24 - 40, vp = H.node(pn, "View"); vp.sizeDelta = V2(pw - 2 * PAD, vh); vp.anchoredPosition = V2(0, PH / 2 - 72 - 24 - vh / 2); vp.gameObject.AddComponent(T(UI.RectMask2D));
    // one mod a line: its name on the left, its version in a column on the right. 0.1.18: the names have their own clipped
    // column and each long name is cut to it with "..." in modLines. (TextMeshPro's Ellipsis mode is not per line: the
    // first name too wide for the box ended the whole text there, so the box showed one name and every version.)
    var nw = s.modNW = pw - 2 * PAD - 16 - 118, nvp = H.node(vp, "Names"); nvp.sizeDelta = V2(nw, vh); nvp.anchoredPosition = V2(-8 - 59, 0); nvp.gameObject.AddComponent(T(UI.RectMask2D));
    s.pList = fnt(txt(s, nvp, "List", 0, vh / 2, nw, vh, 17, INK, TMP.TextAlignmentOptions.TopLeft, 0), "bodyR");
    s.pList.rectTransform.pivot = V2(0.5, 1); s.pList.rectTransform.anchoredPosition = V2(0, vh / 2);
    s.pList.enableWordWrapping = false; s.pList.overflowMode = TMP.TextOverflowModes.Overflow; s.pList.richText = true; s.pList.lineSpacing = 10;
    s.pList.rectTransform.sizeDelta = V2(nw, 6000);
    s.pVer = fnt(txt(s, vp, "Versions", 0, vh / 2, pw - 2 * PAD - 16, vh, 17, DIM, TMP.TextAlignmentOptions.TopRight, 0), "bodyR");
    s.pVer.rectTransform.pivot = V2(0.5, 1); s.pVer.rectTransform.anchoredPosition = V2(-8, vh / 2);
    s.pVer.enableWordWrapping = false; s.pVer.overflowMode = TMP.TextOverflowModes.Overflow; s.pVer.richText = true; s.pVer.lineSpacing = 10; s.pVer.raycastTarget = false;
    s.pListX = 0;
    s.modMark = H.img(pn, "ScrollMark", pw / 2 - 12, 0, 3, 60, null, null, [TEAL[0], TEAL[1], TEAL[2], 0]);

    // prompts, bottom right, at the size of the lobby's (52 in 1080)
    s.prompts = [[9, "Select"], [10, "Back"]].map(function (q, i) {
      var n = H.node(root, "Prompt" + i); n.sizeDelta = V2(200, 60);
      var gl = H.img(n, "Glyph", -40, 0, 52, 52, null, null, W); gl.preserveAspect = true;
      var kt = txt(s, n, "Key", -40, 0, 52, 52, 22, INK, TMP.TextAlignmentOptions.Center, 1);
      var lb = fnt(txt(s, n, "Label", 0, 0, 140, 52, 22, INK, null, 0, 0), "body"); setT(lb, q[1]);
      return { id: q[0], n: n, gl: gl, kt: kt, lb: lb, sp: null };
    });
    s.cgP = cg(H.node(root, "PromptFade")); // placeholder for symmetry; prompts fade through their own colours

    // the stock wrap catchers: above the grid, and far below the pills (closer, it took "down" from the third column
  // before the pills could, and wrapped to the top)
    s.catch = [["BtnHideTop", x0 + gw / 2, TOP + 40], ["BtnHideBottom", x0 + 150, -1400]].map(function (q) {
      var b = deep(pg.transform, q[0]); if (!b) return null;
      var pin = H.node(root, q[0] + "Pin"); pin.anchoredPosition = V2(q[1], q[2]);
      var p0 = b.position; s.undo.push(function () { if (alive(b)) b.position = p0; });
      return { b: b, pin: pin };
    }).filter(function (x) { return x; });

    watch(s, TM.unscaledTime); placeAll(s); prompts(s); listen(s);
    var first = s.tiles[0].row.GetComponent(T(UI.Selectable)), curSel = s.g && s.g.CurrentSelectable;
    if (s.g && !(alive(curSel) && rowNamed(s, curSel.name))) s.g.SetCurrentSelectable(first, false, true);
    s.undo.push(function () { if (alive(s.g)) { s.g.SetSelectableDirty(); s.g.SetNavigationDirty(); } });
    if (!P.timer) P.timer = setInterval(function () { try { tick(); } catch (e) { if (!P.errAt || TM.unscaledTime - P.errAt > 5) { P.errAt = TM.unscaledTime; log("tick: " + es(e)); } } }, 1);
    log("open: " + s.tiles.length + " tiles, " + s.pills.length + " pills, RW " + Math.round(RW) + ", tile " + tw + "x" + th);
  }
  function hideCG(s, tr, key) {
    var add = !tr.GetComponent(T(UE.CanvasGroup)), g = cg(tr), a = g.alpha; s[key] = g; s[key + "A"] = a; g.alpha = 0;
    s.undo.push(function () { if (alive(g)) g.alpha = a; });
  }
  function rowNamed(s, n) { return s.tiles.concat(s.pills).some(function (B) { return B.name == n; }); }
  // the row's rect follows its card; the old rect comes back on close
  function hook(s, B) {
    var rt = B.row.GetComponent(T(UE.RectTransform)), keep = [rt.anchorMin, rt.anchorMax, rt.pivot, rt.sizeDelta, rt.anchoredPosition];
    var hit = H.node(B.row, "V4Hit"); hit.anchorMin = V2(0, 0); hit.anchorMax = V2(1, 1); hit.sizeDelta = V2(0, 0);
    var im = hit.gameObject.AddComponent(T(UI.Image)); im.color = new UE.Color(1, 1, 1, 0); im.raycastTarget = true;
    B.rt = rt; s.undo.push(function () { if (alive(hit)) UE.Object.Destroy(hit.gameObject); if (!alive(rt)) return; rt.anchorMin = keep[0]; rt.anchorMax = keep[1]; rt.pivot = keep[2]; rt.sizeDelta = keep[3]; rt.anchoredPosition = keep[4]; });
    try { var sel = B.row.GetComponent(T(UI.Selectable)), nav0 = sel.navigation; s.undo.push(function () { try { if (alive(sel)) sel.navigation = nav0; } catch (e) { } }); } catch (e) { }
    lockNav(s, B);
  }
  // 0.1.22 (Fury, 2026-11-12, again in the 11-14 sweep: "when you scroll down to Settings/Abort/Main Menu/Etc, it will
  // select another option first and then immediately scroll over to Settings"): 0.1.21's explicit navigation did not
  // stop it, because the game's InputGroup.Navigate ignores it and, a frame after steerNow had put the focus on the
  // right card, still stepped once more from there; steer took that step back a tick later (window 3, 2026-11-14:
  // down from NodeBreedingActor lit NodeTask, then NodeProfile 50 ms later). Navigate first asks the selected object's
  // GamePlay.ExcludeInputDirection.CheckCanMove and stops when it says no (read in GameAssembly with capstone). That
  // check looks at ONE direction only, the first flag set in the order Up 1, Left 8, Down 4, Right 2, so "all four" (15)
  // blocks only Up. Each press therefore sets every card's flag to the pressed direction (setLock, from the direction
  // event, before the game's Navigate runs): the game's step for that press and its held repeat are refused, and this
  // map is the only mover. Navigate also played the move sound (cue NavigationSelect on the InputGroup's
  // CriwareAudioAssist); our moves play it now. A row's own lock, if it had one, comes back on close.
  function lockNav(s, B) {
    try {
      var X = cs.GamePlay.ExcludeInputDirection, go = B.row.gameObject, c = go.GetComponent(T(X)), made = false, old = 0;
      if (!alive(c)) { c = go.AddComponent(T(X)); made = true; } else old = c.exlucdeDir;
      c.exlucdeDir = 0; (s.lockC = s.lockC || []).push(c); s.locks = s.lockC.length;
      s.undo.push(function () { try { if (!alive(c)) return; if (made) UE.Object.Destroy(c); else c.exlucdeDir = old; } catch (e) { } });
    } catch (e) { if (!s.lockErr) { s.lockErr = true; log("navigation lock not set, the game's own moves stay: " + es(e)); } }
  }
  var LOCKBIT = { U: 1, R: 2, D: 4, L: 8 };
  function setLock(s, k) {
    var f = LOCKBIT[k] || 0; if (s.lockF === f || !s.lockC) return; s.lockF = f;
    s.lockC.forEach(function (c) { try { if (alive(c)) c.exlucdeDir = f; } catch (e) { } });
  }
  function navSound(s) {
    if (!s.locks || s.lockErr) return;   // without the locks the game's own step plays it
    try {
      // the InputGroup's own player, else the game's fallback: the input manager singleton's (the pause's group has none)
      if (s.au === undefined) {
        var AX = T(cs.NOAH.Criware.CriwareAudioAssist), au = s.g.GetComponent(AX);
        if (!alive(au)) { var gm = UE.GameObject.Find("(Singleton)_GameInputManager"); au = alive(gm) ? gm.GetComponent(AX) : null; }
        s.au = alive(au) ? au : null;
      }
      if (s.au) s.au.PlaySoundNoReturn("NavigationSelect");
    } catch (e) { if (!s.auErr) { s.auErr = true; log("move sound: " + es(e)); } }
  }
  // 0.1.21 (Fury, 2026-11-12: "when you scroll down to Settings/End Trial, it will select End Trial first and then
  // immediately scroll over to Settings"): the game's own search moved first and the map put that right a frame or two
  // later, so the wrong card lit up for a moment. Now every row's Selectable carries the map as explicit navigation, so
  // a search that reads it goes straight to the right card; and a press is steered the moment its event arrives
  // (steerNow) instead of on a later tick.
  function explicitNav(s) {
    try {
      var all = s.tiles.concat(s.pills), MODE = UI.Navigation.Mode.Explicit;
      all.forEach(function (B) {
        var sel = B.row.GetComponent(T(UI.Selectable)); if (!sel) return;
        var nav = sel.navigation; nav.mode = MODE;
        var g = function (dx, dy) { var to = moveFrom(s, B, dx, dy); return (to || B).row.GetComponent(T(UI.Selectable)); };
        nav.selectOnUp = g(0, 1); nav.selectOnDown = g(0, -1); nav.selectOnLeft = g(-1, 0); nav.selectOnRight = g(1, 0);
        sel.navigation = nav;
      });
    } catch (e) { if (!s.navErr) { s.navErr = true; log("explicit navigation not set: " + es(e)); } }
  }
  function place(s, B) {
    var rt = B.rt, f = s.root.lossyScale.x / rt.parent.lossyScale.x, c = V2(0.5, 0.5);
    rt.anchorMin = c; rt.anchorMax = c; rt.pivot = c; rt.sizeDelta = V2(B.w * f, B.h * f); rt.position = B.slot.position;
  }
  function placeAll(s) {
    s.tiles.concat(s.pills).forEach(function (B) { place(s, B); });
    s.catch.forEach(function (c) { c.b.position = c.pin.position; });
    explicitNav(s);
    if (s.g) { s.g.SetSelectableDirty(); s.g.SetNavigationDirty(); }
  }
  function prompts(s) {
    var x = (s.L.CX || 0) + 150, B = G.BB4UI;
    for (var i = s.prompts.length - 1; i >= 0; i--) {
      var q = s.prompts[i], gl = null; try { gl = B && B.promptGlyph ? B.promptGlyph(q.id) : null; } catch (e) { }
      var sp = gl && gl.sp ? gl.sp : null; if (q.sp !== sp) { q.sp = sp; q.gl.sprite = sp; q.gl.enabled = !!sp; }
      setT(q.kt, sp ? "" : (gl && gl.key) || ""); q.kt.enabled = !sp;
      var lw = Math.ceil(q.lb.preferredWidth) + 8; q.lb.rectTransform.sizeDelta = V2(lw, 52);
      x -= lw; pos(q.lb.rectTransform, x, 0); x -= 34; pos(q.gl.rectTransform, x, 0); pos(q.kt.rectTransform, x, 0); x -= 50;
      q.n.anchoredPosition = V2(0, -500);
    }
  }

  // every quarter second: texts, stock parts kept hidden, rects that drifted, rows that changed
  function watch(s, t) {
    var R = rowsOf(s.ta); if (R.sig != s.sig) { var w = s.w; P.close(); P.onOpen(w); return; }
    s.tiles.concat(s.pills).forEach(function (B) {
      if (B.src && alive(B.src)) setT(B.label, B.src.text);
      if (B.redSrc) B.hasRed = alive(B.redSrc) && B.redSrc.gameObject.activeInHierarchy;
    });
    if (s.stage) { setT(s.kick, s.stage.text); if (s.stage.enabled) s.stage.enabled = false; }
    if (s.srcName) setT(s.name, s.srcName.text);
    // offline the game writes "Unknown" for the ID: nothing is shown then, and the name sits in the middle of its plate
    if (s.srcId) { var idv = String(s.srcId.text || "").trim(), noId = !idv || /^unknown$/i.test(idv); setT(s.pid, noId ? "" : idv); pos(s.name.rectTransform, -252, noId ? 0 : 16); }
    s.bgOff.forEach(function (g) { if (alive(g) && g.activeSelf) g.SetActive(false); });
    // 0.1.7 (Fury, 2026-11-07: "The confirm/deny buttons are missing when trying to return back to the main menu"): the
    // game's own prompt row (FixedInputArea) is hidden under the pause's prompts, but a dialog box opened over the pause
    // draws its Confirm and Cancel there: while one is up the row shows
    var dlg = false; try { dlg = !!require("Core/UIUtil").default.FindWindowByName("DialogBox"); } catch (e) { }
    if (s.fixedCG && alive(s.fixedCG)) alpha(s.fixedCG, dlg ? (s.fixedCGA == null ? 1 : s.fixedCGA) : 0); if (s.dbgCG && alive(s.dbgCG)) alpha(s.dbgCG, 0);
    if (s.kidG) s.kidG.forEach(function (g) { if (alive(g) && g.alpha != 0) g.alpha = 0; });
    var dt = s.dbgT && alive(s.dbgT) ? String(s.dbgT.text || "") : "", m = /MODS \((\d+)\)/.exec(dt), nl = dt.indexOf("\n");
    setT(s.pCount, m ? m[1] + " loaded" : "");
    if (dt !== s.modSrc) { s.modSrc = dt; var ml = modLines(nl >= 0 ? dt.slice(nl + 1) : "", s.pList, s.modNW - 4); setT(s.pList, ml[0]); setT(s.pVer, ml[1]); }
    if (s.curSrcT && alive(s.curSrcT)) { var cv = String(s.curSrcT.text || ""), cn2 = +cv; setT(s.curT, cv && isFinite(cn2) ? String(Math.round(cn2)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : cv); }
    if (s.curSrcI && alive(s.curSrcI) && s.curSrcI.sprite && s.curI.sprite != s.curSrcI.sprite) { s.curI.sprite = s.curSrcI.sprite; s.curI.color = H.col(W, 1); }
    // the height comes from the versions text (it overflows freely); the names text cuts itself to its box, so in the
    // smaller box of 0.1.16 its own preferred height was two lines and the rest of the names were gone: its box stays tall
    var lh = Math.ceil(s.pVer.preferredHeight); if (lh !== s.modH) { s.modH = lh; s.pList.rectTransform.sizeDelta = V2(s.pList.rectTransform.sizeDelta.x, Math.max(lh, 6000)); s.pVer.rectTransform.sizeDelta = V2(s.pVer.rectTransform.sizeDelta.x, lh); }
    var drift = false, k = s.root.lossyScale.x;
    s.tiles.concat(s.pills).forEach(function (B) { if (UE.Vector3.Distance(B.rt.position, B.slot.position) / k > 1.5) drift = true; });
    if (drift) placeAll(s);
    if (s.prompts) prompts(s);
  }
  // the loader's list ("- <name> v<version>" a line) as two columns of the same lines: the names, then the versions.
  // Mods a player has for play come first; development-only ones (the loader marks them in the name) follow under their
  // own heading, dimmer. A line that is not a mod (the loader's hint about its debug keys) is left out.
  function hx(c) { return "#" + c.map(function (v) { var h = Math.round(clamp(v, 0, 1) * 255).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }
  // a name cut to the column's width with "..." (measured with the text's own font; by letter count if that fails)
  function fitName(tm, nm, w) {
    if (!tm || !w) return nm;
    var wide = function (q) { try { return tm.GetPreferredValues(q).x; } catch (e) { return q.length * 9.4; } };
    if (wide(nm) <= w) return nm;
    var lo = 1, hi = nm.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (wide(nm.slice(0, mid).replace(/\s+$/, "") + "...") <= w) lo = mid; else hi = mid - 1; }
    return nm.slice(0, lo).replace(/[\s(]+$/, "") + "...";
  }
  function modLines(text, tm, w) {
    var play = [], dev = [], dim = hx(DIM), head = hx(mixc(TEAL, W, 0.3));
    String(text || "").split(/\r?\n/).forEach(function (ln) {
      // the loader writes rich text (<size>, <b>, the version inside <alpha>): the tags go first
      var q = /^\s*-\s+(.*?)\s*$/.exec(ln.replace(/<[^>]+>/g, "")); if (!q) return;
      var nm = q[1], v = /^(.*?)\s+v(\d[\w.+-]*)$/.exec(nm), ver = ""; if (v) { nm = v[1]; ver = v[2]; }
      var isDev = /DEV ONLY|never ship|developer tool|\(development\)/i.test(nm);
      nm = nm.replace(/^DEV ONLY:\s*/i, "").replace(/\s*\((never package, never ship|developer tool|development)\)/ig, "");
      nm = nm.charAt(0).toUpperCase() + nm.slice(1);
      // the words in brackets after a name are dimmer; a cut name keeps the dim part dim
      var par = /^(.*?)\s*(\([^)]*\))\s*$/.exec(nm), base = par && par[1] ? par[1] : nm, cut = fitName(tm, par && par[1] ? par[1] + " " + par[2] : nm, w);
      nm = cut.length > base.length + 1 && par && par[1] ? base + " <color=" + dim + ">" + cut.slice(base.length + 1) + "</color>" : cut;
      (isDev ? dev : play).push([nm, ver]);
    });
    var a = [], b = [];
    play.forEach(function (r) { a.push(r[0]); b.push(r[1]); });
    if (dev.length) {
      if (play.length) { a.push(""); b.push(""); }
      a.push("<cspace=3><color=" + head + ">DEVELOPMENT</color></cspace>"); b.push("<color=" + head + ">" + dev.length + "</color>");
      dev.forEach(function (r) { a.push("<color=" + dim + ">" + r[0].replace(/<\/?color[^>]*>/g, "") + "</color>"); b.push(r[1]); });
    }
    return [a.join("\n"), b.join("\n")];
  }
  var CORN = null;
  function pinCurrency(s) {
    var rt = s.cur.GetComponent(T(UE.RectTransform)); if (!CORN) CORN = cs.System.Array.CreateInstance(T(UE.Vector3), 4);
    rt.GetWorldCorners(CORN); var a = CORN.GetValue(0), b = CORN.GetValue(2), p = s.curPin.position;
    var dx = p.x - Math.max(a.x, b.x), dy = p.y - (a.y + b.y) / 2;
    if (Math.abs(dx) + Math.abs(dy) > 0.5 * s.root.lossyScale.x) rt.position = new UE.Vector3(rt.position.x + dx, rt.position.y + dy, rt.position.z);
  }

  // the grid scrolls only when it is taller than its view: the focused tile is kept in view, the wheel moves it too
  function scrollAt(s, t, dt, cn) {
    var L = s.L, over = L.hc - VIEW; if (over <= 0) { s.rail.enabled = false; s.thumb.enabled = false; return false; }
    if (cn != s.foc) { s.foc = cn; s.tiles.forEach(function (B) { if (B.name != cn) return; var top = B.r * (L.th + GY); if (top < s.target) s.target = top; if (top + L.th > s.target + VIEW) s.target = top + L.th - VIEW; }); }
    if (!s.noWheel) try { var wy = UE.Input.mouseScrollDelta.y; if (wy) s.target -= wy * 90; } catch (e) { s.noWheel = true; }
    s.target = clamp(s.target, 0, over);
    var moved = Math.abs(s.target - s.scroll) > 0.3; s.scroll = moved ? s.scroll + (s.target - s.scroll) * Math.min(1, dt * 12) : s.target;
    s.tiles.forEach(function (B) {
      var y = B.y + s.scroll; pos(B.slot, B.x, y);
      var outT = y + L.th / 2 - TOP, outB = (TOP - VIEW) - (y - L.th / 2); B.view = H.clamp01(1 - Math.max(outT, outB, 0) / 60);
    });
    H.lum(s.rail, DIM, 0.25, 0); var th = Math.max(60, VIEW * VIEW / L.hc); s.thumb.rectTransform.sizeDelta = V2(6, th);
    H.moveTo(s.thumb, L.x0 - 10, TOP - th / 2 - (VIEW - th) * (s.scroll / over)); H.lum(s.thumb, TEAL, 0.9, 0.2);
    return moved;
  }

  // the pause's own map of moves: the game's search reads the stock list's layout and picks odd targets on ours (right
  // from a row's last tile went to the hidden debug panel's button, down from the third column wrapped to the top past
  // the buttons, up from End Trial skipped a row, left from it did nothing). The pressed direction comes from the game's
  // own event (NavigationMove.OnChangeInputGroup); after the game has moved, the focus is put where this map says.
  function cardOf(s, n) { var all = s.tiles.concat(s.pills); for (var i = 0; i < all.length; i++) if (all[i].name == n) return all[i]; return null; }
  function tileAt(s, r, c) {
    var row = s.tiles.filter(function (B) { return B.r == r; }); if (!row.length) return null;
    return row.filter(function (B) { return B.c == c; })[0] || row[row.length - 1];
  }
  function moveFrom(s, A, dx, dy) {
    var nr = s.L.nr, np = s.pills.length, last = nr - 1;
    if (Math.abs(dx) >= Math.abs(dy)) {
      var dc = dx > 0 ? 1 : -1;
      if (A.pill) { var i = s.pills.indexOf(A) + dc; return i >= 0 && i < np ? s.pills[i] : A; }
      var nb = s.tiles.filter(function (B) { return B.r == A.r && B.c == A.c + dc; })[0]; return nb || A;
    }
    var up = dy > 0;
    if (A.pill) { var pi = s.pills.indexOf(A); return up ? tileAt(s, last, pi) : tileAt(s, 0, pi); }
    if (up) return A.r > 0 ? tileAt(s, A.r - 1, A.c) : np ? s.pills[Math.min(A.c, np - 1)] : tileAt(s, last, A.c);
    return A.r < last ? tileAt(s, A.r + 1, A.c) : np ? s.pills[Math.min(A.c, np - 1)] : tileAt(s, 0, A.c);
  }
  function listen(s) {
    try {
      var ev = s.g.NavigationMove.OnChangeInputGroup;
      // 0.1.7 (Fury, 2026-11-07: "using the analog stick on my controller always causes two selection movements at a
      // time"): the event fires on every change of an analog stick's value, and each one past half way was taken as a new
      // press from where the focus had already moved. Now a press is the stick crossing half way in a new direction; it is
      // let go under 0.3, and the values in between are the same push
      function dk(x, y) { return Math.abs(x) >= Math.abs(y) ? (x > 0 ? "R" : "L") : (y > 0 ? "U" : "D"); }
      s.dirFn = function (v) {
        if (P.st !== s) return;
        var on = Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5, rest = Math.abs(v.x) < 0.3 && Math.abs(v.y) < 0.3, D = s.dir;
        if (!on) { if (rest && D) D.held = false; return; }
        if (D && D.held && dk(D.x, D.y) == dk(v.x, v.y)) return;
        s.dir = { x: v.x, y: v.y, at: TM.unscaledTime, from: s.prevFoc, held: true, done: false };
        setLock(s, dk(v.x, v.y));
        steerNow(s);
      };
      ev.AddListener(s.dirFn);
      s.undo.push(function () { try { ev.RemoveListener(s.dirFn); } catch (e) { } });
    } catch (e) { log("no direction event: the game's own moves stay: " + es(e)); }
  }
  // 0.1.21: a press is answered in its own event, from where the focus was; a step the game takes for the same press
  // after this is undone by steer's first branch (within 0.35 s), as the analog double-step was before
  function steerNow(s) {
    var D = s.dir, A = cardOf(s, s.prevFoc); if (!D || !A || !s.g) return;
    var to = moveFrom(s, A, D.x, D.y); D.done = true;
    if (!to || to.name == s.prevFoc) return;
    try { s.g.SetCurrentSelectable(to.row.GetComponent(T(UI.Selectable)), false, true); s.prevFoc = to.name; navSound(s); } catch (e) { log("steer now: " + es(e)); }
    if (G.BB4PAUSE.debug) log("steer now " + A.name + " => " + to.name);
  }
  function steer(s, cur, cn, t) {
    var prev = s.prevFoc || "", A = cardOf(s, prev), B = cardOf(s, cn), to = null, D = s.dir;
    if (s.locks && !s.lockErr) {
      // 0.1.22: every card is locked, so only this map moves the focus. A press is answered at its event (steerNow);
      // one that steerNow could not take is taken here; a held direction repeats after 0.4 s, every 0.12 s.
      if (D && A && !D.done) { to = moveFrom(s, cardOf(s, D.from) || A, D.x, D.y); D.done = true; D.rep = t; if (to && to.name == cn) to = null; if (to) navSound(s); }
      else if (D && A && D.held && D.done && cn == prev && t - D.at > 0.4 && t - (D.rep || D.at) > 0.12) { D.rep = t; to = moveFrom(s, A, D.x, D.y); if (to && to.name == prev) to = null; if (to) navSound(s); }
      else if (A && !B && cn && cur.transform.IsChildOf(s.sa) && !/^BtnHide/.test(cn)) to = A;
    } else if (D && A && D.done && D.held && cn != prev && t - D.at < 0.35) {
      // 0.1.7: the game's own navigation steps again while an analog stick's value is still changing within one push
      // (seen in window 5, 2026-11-10: one push right went two tiles). In the first 0.35 s of a push that step is undone;
      // after it the game's moves are the held repeat
      to = A;
    } else if (D && A && (!D.done ? t - D.at > 0.03 : D.held && cn != prev)) {
      // a press (or the game's repeat while it is held): where our map goes from where the focus was
      var src = !D.done ? cardOf(s, D.from) || A : A; to = moveFrom(s, src, D.x, D.y); D.done = true;
      if (to && to.name == cn) to = null;
    } else if (A && !B && cn && cur.transform.IsChildOf(s.sa) && !/^BtnHide/.test(cn)) to = A;
    if (to) { if (G.BB4PAUSE.debug) log("steer " + prev + " -> " + cn + " => " + to.name); s.g.SetCurrentSelectable(to.row.GetComponent(T(UI.Selectable)), false, true); s.prevFoc = to.name; return to.name; }
    if (B) s.prevFoc = cn;
    return cn;
  }
  function tick() {
    var s = P.st; if (!s) return;
    if (!alive(s.pg) || !s.pg.activeInHierarchy || !alive(s.root)) { P.close(); return; }
    UE.Shader.SetGlobalFloat("_FourTimeOffset", TM.unscaledTime - TM.timeSinceLevelLoad);
    var t = TM.unscaledTime, e = t - s.t0, dt = Math.min(0.1, t - (s.last || t)); s.last = t;
    if (t - s.wAt > 0.25) { s.wAt = t; watch(s, t); if (P.st != s) return; }
    if (s.leftCG.alpha != 0) s.leftCG.alpha = 0;
    // a screen opened from the pause (Training Details, the codexes, Settings) draws over this window with a see-through
    // ground: our cards showed behind it, blurred. While any window stands above the pause, the layer fades out.
    var cov = covered(s) ? 1 : 0; s.cover += (cov - s.cover) * Math.min(1, dt * (cov ? 18 : 10)); if (Math.abs(cov - s.cover) < 0.01) s.cover = cov;
    alpha(s.rootCG, 1 - s.cover);
    var cur = s.g ? s.g.CurrentSelectable : null, cn = alive(cur) ? cur.name : "";
    cn = steer(s, cur, cn, TM.unscaledTime);
    if (scrollAt(s, t, dt, cn)) placeAll(s);
    var fi = H.ease(e / 0.4);
    backAt(s, t, fi);
    alpha(s.lpG, H.ease(H.clamp01((e - 0.04) / 0.3)));
    s.tiles.forEach(function (B, i) {
      var u = H.clamp01((e - 0.1 - i * 0.028) / 0.28), v = B.view == null ? 1 : B.view;
      cardAt(B, t, u, cn == B.name); pos(B.vis, -28 * (1 - H.ease(u)) + 12 * (B.g || 0), 0); alpha(B.cg, H.ease(u) * v);
    });
    s.pills.forEach(function (B, i) { var u = H.clamp01((e - 0.36 - i * 0.05) / 0.3); cardAt(B, t, u, cn == B.name); pos(B.vis, 0, -16 * (1 - H.ease(u))); alpha(B.cg, H.ease(u)); });
    // the core opens in three beats 5 frames apart (outer hex, middle hex, face, each with a small overshoot), the gauge
    // draws round clockwise, then: breathing at 0.25 Hz, a lit arc going round once in 8 s, dots turning the other way in
    // 11 s, a sweep over the face every 5 s, glints twinkling on the six corners, two beams, motes
    var cu = H.ease(H.clamp01((e - 0.12) / 0.5)); alpha(s.coreG, H.clamp01((e - 0.08) / 0.2)); scl(s.core, s.L.CS); alpha(s.ppG, H.ease(H.clamp01((e - 0.3) / 0.35))); pos(s.pp, s.L.CX, 86 - 372 * s.L.CS - 66 - 18 * (1 - H.ease(H.clamp01((e - 0.3) / 0.35))));
    [s.ring, s.ring2, s.face].forEach(function (im, i) { var o = H.clamp01((e - 0.1 - i * 0.085) / 0.4); scl(im.rectTransform, o >= 1 ? 1 : 0.62 + 0.38 * (H.ease(o) + 0.12 * Math.sin(o * Math.PI))); });
    var br = 0.5 + 0.5 * Math.sin(t * Math.PI / 2), fm = s.face.__m; if (fm) fm.SetFloat("_EdgeGlow", 0.22 + 0.16 * br);
    if (s.ring.__m) s.ring.__m.SetFloat("_EdgeGlow", 0.45 + 0.2 * br);
    // the energy opens from the centre outward; each move of the focus sends one hex ripple out through it
    if (cn != s.pfoc) { if (s.pfoc != null) s.pulseAt = t; s.pfoc = cn; }
    var em2 = s.energy.__m; if (em2) { em2.SetFloat("_Open", H.clamp01((e - 0.1) / 0.7)); var pu2 = s.pulseAt != null ? (t - s.pulseAt) / 0.5 : 2; em2.SetFloat("_Pulse", pu2 < 1 ? pu2 : 0); la(s.energy, TEAL, cu * (0.85 + 0.15 * br)); }
    s.beams.forEach(function (b, i) { la(b, TEALW, cu * (0.3 + 0.18 * Math.sin(t * 1.7 + i * 2))); });
    s.glints.forEach(function (g) { la(g, TEALW, cu * 0.75); });
    H.dustAt(s.dust2, t, cu);
    if (cu < 1 || s.tsp !== 0) { s.tsp = cu < 1 ? 1 : 0; s.title.characterSpacing = 26 * (1 - cu); }
    H.setC(s.title, INK, cu, 0); H.setC(s.kick, TEAL, cu, 0);
    // a list taller than its view scrolls by itself: 2.5 s at the top, down at 40 units a second, 2.5 s at the end, back up
    // four times as fast; a mark at the panel's edge shows where it is
    var over = (s.modH || 0) - s.modVH, my = 0;
    if (over > 4) { var dn = over / 40, upT = over / 160, cyc = 2.5 + dn + 2.5 + upT, ph = (t - s.t0) % cyc; my = ph < 2.5 ? 0 : ph < 2.5 + dn ? (ph - 2.5) * 40 : ph < 5 + dn ? over : over - (ph - 5 - dn) * 160;
      var mh2 = Math.max(40, s.modVH * s.modVH / s.modH); s.modMark.rectTransform.sizeDelta = V2(3, mh2); pos(s.modMark.rectTransform, s.pn.sizeDelta.x / 2 - 12, s.pn.sizeDelta.y / 2 - 96 - mh2 / 2 - (s.modVH - mh2) * (my / over)); la(s.modMark, TEAL, 0.7); } else la(s.modMark, TEAL, 0);
    pos(s.pList.rectTransform, s.pListX, s.modVH / 2 + my); pos(s.pVer.rectTransform, -8, s.modVH / 2 + my);
    // the MODS panel slides in from the right
    var pu = H.ease(H.clamp01((e - 0.2) / 0.4)); pos(s.pn, s.pnX + 36 * (1 - pu), s.pnY); alpha(s.pcg, pu);
    var ru = H.ease(H.clamp01((e - 0.4) / 0.3));
    s.prompts.forEach(function (q) { if (q.gl.enabled) H.setC(q.gl, W, ru, 0); H.setC(q.kt, INK, ru, 0); H.setC(q.lb, INK, ru, 0); });
  }

  // true while another window of the same layer sits above the pause window and is shown
  function covered(s) {
    try {
      var tr = s.pg.transform, par = tr.parent; if (!alive(par)) return false;
      for (var i = tr.GetSiblingIndex() + 1; i < par.childCount; i++) if (par.GetChild(i).gameObject.activeInHierarchy) return true;
    } catch (e) { }
    return false;
  }

  P.close = function () {
    var s = P.st; P.st = null; if (P.timer) { clearInterval(P.timer); P.timer = null; } if (!s) return;
    for (var i = s.undo.length - 1; i >= 0; i--) try { s.undo[i](); } catch (e) { log("restore: " + es(e)); }
  };
  P.onClose = function () { P.pending = null; if (P.openTimer) { clearInterval(P.openTimer); P.openTimer = null; } unveil(); if (P.st) P.close(); };

  // 2026-11-14 (the lead: the old pause menu showed before and behind the new one): the open used to wait for timers at
  // 0 / 60 / 300 / 1000 ms after InitWindow while the stock screen drew. Now the safe area is veiled (a CanvasGroup at
  // alpha 0) inside InitWindow, before its first frame, and the build is tried at once and then every tick until the
  // stock rows exist; the veil lifts once ours is built (it hides the stock parts itself), or when this pause keeps the
  // stock screen (co-op, no plate bundle after 1.2 s)
  function veil(w) {
    var pg = pgOf(w), sa = alive(pg) ? pg.transform.Find("SafeAreaFitter") : null; if (!alive(sa)) return;
    var V = P.veil;
    if (!V || V.sa != sa || !alive(V.g)) { var add = !sa.GetComponent(T(UE.CanvasGroup)), g = cg(sa); V = P.veil = { sa: sa, g: g, a: g.alpha, add: add }; }
    if (V.g.alpha != 0) V.g.alpha = 0;
  }
  function unveil() {
    var V = P.veil; P.veil = null; if (!V || !alive(V.g)) return;
    try { if (V.add) { V.g.alpha = 1; UE.Object.Destroy(V.g); } else V.g.alpha = V.a; } catch (e) { }
  }
  P.openSoon = function (w) {
    P.pending = w; if (P.openTimer) { clearInterval(P.openTimer); P.openTimer = null; }
    try { veil(w); } catch (e) { log("veil: " + es(e)); }
    var t0 = TM.unscaledTime;
    var go = function () {
      if (P.pending !== w) { if (P.openTimer) { clearInterval(P.openTimer); P.openTimer = null; } return true; }
      var r = null; try { r = P.onOpen(w); } catch (e) { log("open: " + es(e)); }
      var built = !!(P.st && P.st.w === w && alive(P.st.root));
      if (built || r === "stock" || TM.unscaledTime - t0 > 1.2) {
        P.pending = null; if (P.openTimer) { clearInterval(P.openTimer); P.openTimer = null; } unveil(); return true;
      }
      try { veil(w); } catch (e) { }
      return false;
    };
    if (!go()) P.openTimer = setInterval(go, 1);
  };

  // test handles (jsq)
  P.state = function () {
    var s = P.st; if (!s) return { open: false };
    var cur = s.g ? s.g.CurrentSelectable : null, k = s.root.lossyScale.x;
    return { open: true, sig: s.sig, tiles: s.tiles.length, pills: s.pills.length, RW: Math.round(s.RW), tw: s.L.tw, th: s.L.th, focus: alive(cur) ? cur.name : "-",
      drift: s.tiles.concat(s.pills).map(function (B) { return Math.round(UE.Vector3.Distance(B.rt.position, B.slot.position) / k); }).join(","),
      scroll: Math.round(s.scroll), mods: s.pCount.text, kicker: s.kick.text };
  };
  P.focus = function (n) { var s = P.st; if (!s) return false; var B = s.tiles.concat(s.pills).filter(function (b) { return b.name == n; })[0]; if (!B) return false; s.g.SetCurrentSelectable(B.row.GetComponent(T(UI.Selectable)), false, true); return true; };
  P.nav = function (x, y) { var s = P.st; if (!s) return false; var oc = s.g.NavigationMove.OnChangeInputGroup; oc.Invoke(V2(x, y)); setTimeout(function () { try { oc.Invoke(V2(0, 0)); } catch (e) { } }, 60); return true; };

  function hookWin() {
    var Pr; try { Pr = require("Window/PDAssistant_Standalone").default.prototype; } catch (e) { if (!P.hookSaid) { P.hookSaid = 1; log("hook (will retry): " + es(e)); } return false; }
    if (!Pr.__v4init) { Pr.__v4init = Pr.InitWindow; Pr.__v4uninit = Pr.UninitWindow; }
    Pr.InitWindow = function () {
      var r = Pr.__v4init.apply(this, arguments), w = this;
      try { if (G.BB4PAUSE.openSoon) G.BB4PAUSE.openSoon(w); } catch (e) { log("open: " + es(e)); }
      return r;
    };
    Pr.UninitWindow = function () { try { if (G.BB4PAUSE.onClose) G.BB4PAUSE.onClose(this); } catch (e) { log("close: " + es(e)); } return Pr.__v4uninit.apply(this, arguments); };
  }
  // hooked on the first tick, not while the game's own scripts are still loading (this file is appended to one of them)
  if (P.hookTimer) clearInterval(P.hookTimer);
  P.hookTimer = setInterval(function () { try { if (hookWin() !== false) { clearInterval(P.hookTimer); P.hookTimer = 0; if (reopen) { P.onOpen(reopen); reopen = null; } } } catch (e) { } }, 30);
  log("ready");
})();
