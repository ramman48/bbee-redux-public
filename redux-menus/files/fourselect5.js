(function () {
  // The character select, v5 (the lead, 2026-11-10: "Pause menu and character select need a rework from the ground up new
  // positions new layout new assets new effects new vfx new animations"; "lets make our own vfx and custom shaders and
  // graphics in unity"). A screen of its own drawn over the solo select of fourlobbyui.js, which keeps everything that
  // touches the game: the roster, the cursor, the groups, locks and unlocking, confirming, the panels, the prompts.
  // This file only draws: the roster down the left side, the hero's art centre stage over our energy shader, the hero's
  // details down the right side, on the Entropy bundle's plates, lights and fonts. Solo select only; the list view (Y / L)
  // and the lobby's own pick keep the earlier screen.
  var cs = CS, G = globalThis, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof, TMP = cs.TMPro;
  var V = G.BB4S5 = G.BB4S5 || {};
  function log(m) { try { G.BB4.log("SEL5", m); } catch (e) { } }
  function es(e) { try { return G.BB4.es ? G.BB4.es(e) : String(e); } catch (x) { return String(e); } }
  if (V.st && V.st.root && !V.st.root.Equals(null)) { try { UE.Object.Destroy(V.st.root.gameObject); } catch (e) { } }
  V.st = null;

  var W = [1, 1, 1], INK = [0.9, 0.92, 0.96], DIM = [0.56, 0.58, 0.66], GREY = [0.62, 0.65, 0.7], AMBER = [1, 0.82, 0.48], GREEN = [0.56, 0.89, 0.6];
  var COLS = 5; V.cols = COLS;
  // heroes on the published roadmap that are not in the game yet (the 2026 and 2027 roadmap sheets in docs/promo), by group:
  // shown under the roster as "coming soon" (the lead, 2026-11-10); a name already in the roster is left out
  var SOON = {};   // the roadmap's heroes are entries of the grid (fourlobbyui.js, SOON); no list under it
  function V2(x, y) { return new UE.Vector2(x, y); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function c01(v) { return clamp(v, 0, 1); }
  function ease(k) { k = c01(k); return 1 - Math.pow(1 - k, 3); }
  function col(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? 1 : a); }
  function mixc(a, b, k) { k = c01(k); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function tintD(A, v, sat) { var m = Math.max(A[0], A[1], A[2], 0.001); return [v * (1 - sat + sat * A[0] / m), v * (1 - sat + sat * A[1] / m), v * (1 - sat + sat * A[2] / m)]; }

  // ---- the Entropy bundle: plates, lights, the core's energy, fonts ----
  var PMAT = null, LMAT = null, CMAT = null, SMAT = null, AMAT = null, HMAT = null, TMAT = null, FONTS = null;
  function bundle() {
    try {
      if (!G.__EDB || G.__EDB.Equals(null)) { var p = G.ED_BUNDLE_PATH(); G.__EDB = UE.AssetBundle.LoadFromFile(p, 0, BigInt(G.ED_BUNDLE_OFFSET || 0)); }
      var b = G.__EDB; if (!b || b.Equals(null)) return false;
      if (!PMAT || PMAT.Equals(null)) { var all = b.LoadAllAssets(T(UE.Material)); for (var i = 0; i < all.Length; i++) { var m = all.get_Item(i); if (m.name === "ED_Plate") PMAT = m; else if (m.name === "ED_LightFx") LMAT = m; else if (m.name === "ED_CoreEnergy") CMAT = m; else if (m.name === "ED_StageFx") SMAT = m; else if (m.name === "ED_HeroArt") AMAT = m; else if (m.name === "ED_HexField") HMAT = m; else if (m.name === "ED_TriField") TMAT = m; } }
      if (!FONTS) { FONTS = {}; var fa = b.LoadAllAssets(T(TMP.TMP_FontAsset)); for (var j = 0; j < fa.Length; j++) FONTS[fa.get_Item(j).name] = fa.get_Item(j); }
      return !!PMAT && !PMAT.Equals(null);
    } catch (e) { if (!V.bundleSaid) { V.bundleSaid = 1; log("bundle: " + es(e)); } return false; }
  }
  V.on = function (S) { return V.enabled !== false && !!(S && S.solo) && bundle(); };

  // ---- builders ----
  function node(par, name, x, y, w, h) {
    var g = new UE.GameObject(name), rt = g.AddComponent(T(UE.RectTransform)); rt.SetParent(par, false); g.layer = par.gameObject.layer;
    rt.sizeDelta = V2(w == null ? 100 : w, h == null ? 100 : h); rt.anchoredPosition = V2(x || 0, y || 0); return rt;
  }
  function img(par, name, x, y, w, h, c, a) { var rt = node(par, name, x, y, w, h), im = rt.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; im.color = col(c || W, a == null ? 1 : a); return im; }
  function mc(m, k, c, a) { m.SetColor(k, col(c, a)); }
  function plate(par, name, x, y, w, h, o) {
    o = o || {}; var im = img(par, name, x, y, w, h, W, 1), m = new UE.Material(PMAT); im.material = m; im.__m = m;
    m.SetVector("_Size", new UE.Vector4(w, h, 0, 0)); var c = o.cut || [0, 0, 0, 0]; m.SetVector("_Cut", new UE.Vector4(c[0], c[1], c[2], c[3]));
    mc(m, "_Fill", o.fill || [0.02, 0.02, 0.03], o.alpha == null ? 0.92 : o.alpha); mc(m, "_Line", o.line || GREY, o.lineA == null ? 0.5 : o.lineA); m.SetFloat("_LineW", o.lineW || 1.5);
    if (o.bracket) { m.SetFloat("_Bracket", 1); m.SetFloat("_BracketLen", o.bracket); m.SetFloat("_BracketW", 2); mc(m, "_BracketColor", W, 0.8); } else m.SetFloat("_Bracket", 0);
    m.SetFloat("_Raised", 0); m.SetFloat("_Hex", o.hex ? 1 : 0); m.SetFloat("_Dash", 0); m.SetFloat("_Lit", o.lit == null ? 0.2 : o.lit); m.SetFloat("_Weave", o.weave == null ? 0.1 : o.weave);
    m.SetFloat("_Rim", 0.25); m.SetFloat("_Run", o.run ? 1 : 0); m.SetFloat("_RunSpeed", 55); m.SetFloat("_RunLen", 220); m.SetFloat("_EdgeGlow", o.edge || 0); m.SetFloat("_Pulse", 0); mc(m, "_Glow", W, 0); mc(m, "_Accent", W, 1); m.SetFloat("_AccentMix", 0.35);
    return im;
  }
  function light(par, name, x, y, w, h, mode, props, c, a) {
    var im = img(par, name, x, y, w, h, c, a); if (!LMAT || LMAT.Equals(null)) { im.enabled = false; return im; }
    var m = new UE.Material(LMAT); m.SetFloat("_Mode", mode); for (var k in props) m.SetFloat(k, props[k]); im.material = m; im.__m = m; return im;
  }
  function label(par, name, x, y, w, h, size, c, align, kind) {
    var rt = node(par, name, x, y, w, h), t = rt.gameObject.AddComponent(T(TMP.TextMeshProUGUI));
    var want = { display: /aldrich/i, body: /chakra.*semi/i, bodyR: /chakra.*reg/i }[kind || "display"];
    for (var k in FONTS) if (want.test(k)) { t.font = FONTS[k]; t.fontSharedMaterial = FONTS[k].material; break; }
    t.fontSize = size; t.color = col(c || INK, 1); t.enableWordWrapping = false; t.raycastTarget = false; t.overflowMode = TMP.TextOverflowModes.Overflow;
    t.alignment = align || TMP.TextAlignmentOptions.Left; t.fontStyle = 0; t.text = ""; return t;
  }
  function setT(t, v) { v = v == null ? "" : String(v); if (t.__v !== v) { t.__v = v; t.text = v; } }
  function setC(g, c, a) { var k = c[0].toFixed(3) + c[1].toFixed(3) + c[2].toFixed(3) + (a == null ? 1 : a).toFixed(3); if (g.__c === k) return; g.__c = k; g.color = col(c, a); }
  function pos(rt, x, y) { var k = rt.__p; if (k && Math.abs(k[0] - x) < 0.1 && Math.abs(k[1] - y) < 0.1) return; rt.__p = [x, y]; rt.anchoredPosition = V2(x, y); }
  function scl(rt, s) { if (rt.__s != null && Math.abs(rt.__s - s) < 0.001) return; rt.__s = s; rt.localScale = new UE.Vector3(s, s, 1); }
  function act(go, on) { if (go.__on === on) return; go.__on = on; go.SetActive(on); }

  // ---- build (once the screen's width is known) ----
  function build(S, Z, C) {
    var RW = G.BB4_TESTW || UE.Screen.width * 1080 / Math.max(1, UE.Screen.height), LW = clamp(Math.round(RW * 0.27), 500, 720), PAD = 30, lw = LW - 2 * PAD;
    var root = node(Z.root.parent, "Select5", 0, 0); root.anchorMin = UE.Vector2.zero; root.anchorMax = UE.Vector2.one; root.sizeDelta = UE.Vector2.zero; root.anchoredPosition = UE.Vector2.zero;
    var st = V.st = { root: root, RW: RW, LW: LW, lw: lw, PAD: PAD, cells: [], C: C, t0: UE.Time.unscaledTime, CS: clamp((RW - 2 * LW) / 820, 0.8, 1.15) };
    try { if (Z.title && Z.title.font) { st.gfont = Z.title.font; st.gmat = Z.title.fontSharedMaterial; } } catch (e) { }
    function gameFace(t) { if (st.gfont) { t.font = st.gfont; if (st.gmat) t.fontSharedMaterial = st.gmat; t.fontStyle = 3; } return t; }   // the lead, 2026-11-10: the text "looks kinda basic and boring"
    st.cg = root.gameObject.AddComponent(T(UE.CanvasGroup)); st.cg.alpha = 0; st.cg.blocksRaycasts = false; st.cg.interactable = false;
    // the ground: a dark veil in the group's colour, a wide soft light behind the stage
    st.veil = img(root, "Veil", 0, 0, RW + 80, 1200, [0.02, 0.012, 0.03], 0.985);
    st.back = light(root, "BackLight", 0, 40, 1500, 1500, 3, { _Core: 0.25, _Halo: 0.5 }, W, 0);
    st.topLight = light(root, "TopLight", 0, 620, RW - 2 * LW + 500, 1100, 3, { _Core: 0.0, _Halo: 0.9 }, W, 0);   // the colour comes down from the top; the bottom stays dark
    // the group's own stage effect (uikit\Assets\EntropyDial\Shaders\StageFx.shader, ours): one layer behind the hero, one of
    // loose particles in front; Heroes embers and slashes, EX rays and sparkles, Bosses a spiral and lightning, Cross Effect a rift
    var cwid = st.cwid = RW - 2 * LW + 60;
    function stageFx(name, front) { var im = img(root, name, 0, 0, cwid, 1080, W, 0); if (SMAT && !SMAT.Equals(null)) { var m = new UE.Material(SMAT); im.material = m; im.__m = m; m.SetFloat("_Aspect", cwid / 1080); m.SetFloat("_Front", front ? 1 : 0); } else im.enabled = false; return im; }
    st.fxBack = stageFx("StageFxBack", false);
    // the ground of the stage in the language of the game's own splash art (uikit\Assets\EntropyDial\Shaders\TriField.shader,
    // ours): a dot-matrix mosaic of triangles, the game's triangle mark lit behind the hero, colour at the top, dark below
    st.tri = img(root, "TriField", 0, 0, cwid, 1080, W, 0);
    if (TMAT && !TMAT.Equals(null)) { var tm = new UE.Material(TMAT); st.tri.material = tm; st.tri.__m = tm; tm.SetFloat("_Aspect", cwid / 1080); } else st.tri.enabled = false;
    // centre stage: our energy shader, the hero's art (two layers, for the turn from one hero to the next), the name plate
    var stage = st.stage = node(root, "Stage", 0, 70, 100, 100);
    st.energy = img(stage, "Energy", 0, 20, 1040, 1040, W, 0);
    if (CMAT && !CMAT.Equals(null)) { var em = new UE.Material(CMAT); st.energy.material = em; st.energy.__m = em; em.SetFloat("_Inner", 0.26); em.SetFloat("_Outer", 0.40); em.SetFloat("_PulseAmp", 0.15); em.SetFloat("_Rays", 0.0); em.SetFloat("_Rings", 0.0); em.SetFloat("_Solid", 1); em.SetFloat("_Energy", 1); } else st.energy.enabled = false;
    // the portrait keeps a faint steady edge only: testers, 2026-11-10, read a glowing pulsing outline as machine-made
    // 0.1.16 (Aneubys, 2026-11-11: "have the splash art in the background so that it isnt blocking the platform"): the
    // picture is cut at the platform's top edge, as on the Legacy menu, and stands lower, so it reads as behind it
    var artM = node(stage, "ArtMask", 0, -18, 2400, 976); artM.gameObject.AddComponent(T(UI.RectMask2D));
    st.art = [0, 1].map(function (i) { var rt = node(artM, "Art" + i, 0, 0, 600, 900), ri = rt.gameObject.AddComponent(T(UI.RawImage)); ri.raycastTarget = false; ri.color = col(W, 0); if (AMAT && !AMAT.Equals(null)) { var am = new UE.Material(AMAT); ri.material = am; ri.__m = am; am.SetFloat("_Phase", i * 3); am.SetFloat("_RimW", 0.003); am.SetFloat("_RimPulse", 0); am.SetFloat("_Sheen", 0.25); } return ri; });
    st.beam = light(stage, "FloorLight", 0, -452, 760, 60, 0, { _Thin: 9, _Halo: 0.6, _Core: 1.1 }, W, 0);
    st.fxFront = stageFx("StageFxFront", true);
    var np = st.np = node(root, "NamePlate", 0, -392, 640, 112);
    st.npP = plate(np, "Plate", 0, 0, 640, 112, { bracket: 12, cut: [16, 0, 16, 0], alpha: 0.92 });
    st.name = gameFace(label(np, "Name", 0, 12, 600, 60, 54, W, TMP.TextAlignmentOptions.Center, "display")); st.name.enableAutoSizing = true; st.name.fontSizeMin = 24; st.name.fontSizeMax = 54;
    st.status = label(np, "Status", 0, -30, 600, 30, 21, DIM, TMP.TextAlignmentOptions.Center, "body"); st.status.richText = true;
    // left: the roster. Tabs for the groups, then the heads, four across
    var lp = st.lp = node(root, "Roster", -RW / 2 + LW / 2, 0, LW, 1080); st.lpG = lp.gameObject.AddComponent(T(UE.CanvasGroup));
    st.lpP = plate(lp, "Panel", -12, 0, LW + 24, 1128, { alpha: 0.93 });
    // the empty space of each panel: a field of hexagons (uikit\Assets\EntropyDial\Shaders\HexField.shader, ours) rising from
    // under the panel's content: lit cells, drops of light down the columns, a wave now and then
    function hexField(par) { var im = img(par, "HexField", 0, 0, LW, 1080, W, 0); if (HMAT && !HMAT.Equals(null)) { var m = new UE.Material(HMAT); im.material = m; im.__m = m; m.SetFloat("_Aspect", LW / 1080); m.SetFloat("_Scale", 24); m.SetFloat("_Cells", 0.3); m.SetFloat("_Rain", 0.3); m.SetFloat("_Wave", 0.4); m.SetFloat("_Lattice", 0.16); } else im.enabled = false; return im; }
    st.lHex = hexField(lp);
    st.lSweep = light(lp, "Sweep", 0, 0, LW, 1080, 2, { _Period: 7, _Width: 0.1, _Angle: 20 }, W, 0.06);
    st.lHead = label(lp, "Head", -lw / 2 + 150, 496, 300, 30, 22, W, null, "display"); st.lHead.characterSpacing = 4; setT(st.lHead, "// ROSTER");
    st.lCount = label(lp, "Count", lw / 2 - 150, 496, 300, 30, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    st.tabs = [0, 1, 2, 3].map(function (j) {
      var tw = (lw - 3 * 8) / 4, x = -lw / 2 + tw / 2 + j * (tw + 8);
      var p = plate(lp, "Tab" + j, x, 432, tw, 50, { cut: [10, 0, 10, 0], alpha: 0.9 }), t = label(lp, "TabT" + j, x, 432, tw - 14, 40, 20, INK, TMP.TextAlignmentOptions.Center, "display");
      t.enableAutoSizing = true; t.fontSizeMin = 11; t.fontSizeMax = 20; return { p: p, t: t, x: x, w: tw };
    });
    st.gridTop = 386; st.gap = 10; st.cw = (lw - (COLS - 1) * st.gap) / COLS; st.ch = Math.round(st.cw * 0.9); st.rowsVis = Math.max(1, Math.min(6, Math.floor((st.gridTop + 330) / (st.ch + st.gap))));
    st.grid = node(lp, "Grid", 0, 0, 100, 100); st.top = 0; st.rows = []; st.rh = 60; st.rowsVisL = Math.max(1, Math.floor((st.gridTop + 330) / (st.rh + 6)));
    st.rail = img(lp, "Rail", lw / 2 + 12, 0, 3, 60, W, 0);
    // under the heads: who is coming to this group, then what the player has saved for the hero
    st.soonH = label(lp, "SoonH", -lw / 2 + 150, 0, 300, 28, 20, W, null, "display"); st.soonH.characterSpacing = 4; setT(st.soonH, "// COMING SOON");
    st.soonN = label(lp, "SoonN", lw / 2 - 150, 0, 300, 28, 18, DIM, TMP.TextAlignmentOptions.Right, "body");
    st.soon = []; var sw2 = (lw - 10) / 2;
    for (var si = 0; si < 28; si++) { var sp3 = plate(lp, "Soon" + si, 0, 0, sw2, 32, { cut: [8, 0, 8, 0], alpha: 0.85, lineA: 0.3, weave: 0 }), sn = label(lp, "SoonT" + si, 0, 0, sw2 - 80, 28, 18, INK, null, "body"), sy2 = label(lp, "SoonY" + si, 0, 0, 60, 28, 16, DIM, TMP.TextAlignmentOptions.Right, "body"); sn.overflowMode = TMP.TextOverflowModes.Ellipsis; st.soon.push({ p: sp3, n: sn, y: sy2 }); }
    st.sw2 = sw2;
    st.evoP = plate(lp, "NodeEvo", 0, -398, lw + 36, 104, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.93 });
    st.evoH = label(lp, "EvoH", -lw / 2 + 150, -380, 300, 28, 20, W, null, "display"); st.evoH.characterSpacing = 4; setT(st.evoH, "// EVOTYPES");
    st.evoT = label(lp, "EvoT", 0, -416, lw, 30, 21, INK, null, "body");
    // right: the hero. Name, group and place, what stands between the player and the hero, what comes next
    var rp = st.rp = node(root, "Hero", RW / 2 - LW / 2, 0, LW, 1080); st.rpG = rp.gameObject.AddComponent(T(UE.CanvasGroup));
    st.rpP = plate(rp, "Panel", 12, 0, LW + 24, 1128, { alpha: 0, lineA: 0, weave: 0 }); st.rpP.gameObject.SetActive(false);
    st.nodes = [];
    function nodeBox(name, top, bot) { var p2 = plate(rp, name, 0, (top + bot) / 2, lw + 36, top - bot, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.93 }); st.nodes.push(p2); try { p2.rectTransform.SetSiblingIndex(st.rHex.rectTransform.GetSiblingIndex() + 1); } catch (e) { } return p2; }
    st.rHex = hexField(rp); if (st.rHex.__m) { st.rHex.__m.SetFloat("_Phase", 11); st.rHex.__m.SetFloat("_MaskA", 0.16); st.rHex.__m.SetFloat("_MaskB", 0.03); }
    st.rSweep = light(rp, "Sweep", 0, 0, LW, 1080, 2, { _Period: 7, _Width: 0.1, _Angle: 20, _Phase: 0.5 }, W, 0.06);
    st.rHead = label(rp, "Head", -lw / 2 + 150, 496, 300, 30, 22, W, null, "display"); st.rHead.characterSpacing = 4; setT(st.rHead, "// HERO");
    st.rPlace = label(rp, "Place", lw / 2 - 150, 496, 300, 30, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    st.rRule = plate(rp, "Rule", 0, 468, lw, 2, { alpha: 0.9, lineA: 0, weave: 0 }); st.lRule = plate(lp, "Rule", 0, 468, lw, 2, { alpha: 0.9, lineA: 0, weave: 0 });
    st.rName = gameFace(label(rp, "Name", 0, 420, lw, 74, 62, W, null, "display")); st.rName.enableAutoSizing = true; st.rName.fontSizeMin = 26; st.rName.fontSizeMax = 62;
    st.rGroup = label(rp, "Group", -lw / 4, 368, lw / 2, 34, 25, INK, null, "body");
    st.rState = label(rp, "State", lw / 4, 368, lw / 2, 34, 25, INK, TMP.TextAlignmentOptions.Right, "display");
    // the moveset video (the game's own movie of the hero, HeroSelect/C_Introduction_<id>), playing in a frame, no sound
    nodeBox("NodeName", 522, 348);
    var vw = lw, vh = Math.round(lw * 9 / 16), vy = 330 - vh / 2; st.vy = vy; st.vh = vh;
    st.vidP = plate(rp, "VidFrame", 0, vy, vw + 10, vh + 10, { bracket: 14, alpha: 0.96, fill: [0.004, 0.004, 0.006] });
    var vn = node(rp, "Video", 0, vy, vw, vh); st.vid = vn.gameObject.AddComponent(T(UI.RawImage)); st.vid.raycastTarget = false; st.vid.color = col(W, 0);
    st.vidNo = label(rp, "NoVideo", 0, vy, vw, 40, 22, DIM, TMP.TextAlignmentOptions.Center, "body");
    st.vidTag = label(rp, "VidTag", -lw / 2 + 110, vy + vh / 2 - 22, 200, 24, 16, W, null, "display"); st.vidTag.characterSpacing = 4; setT(st.vidTag, "MOVESET");
    // the sheet: three bars against the best in the roster
    var sy = vy - vh / 2 - 44; st.nStats = nodeBox("NodeStats", sy + 24, sy - 42 - 2 * 42 - 26); st.sHead = label(rp, "StatsH", -lw / 2 + 150, sy, 300, 28, 20, W, null, "display"); st.sHead.characterSpacing = 4; setT(st.sHead, "// STATS");
    var bx0 = -lw / 2 + 150, bw = lw - 150 - 110;
    st.stats = ["Health", "Attack", "MP"].map(function (nm, i) {
      var y = sy - 42 - i * 42, o = { v: 0, shown: -1 };
      o.n = label(rp, "StN" + i, -lw / 2 + 70, y, 140, 30, 22, INK, null, "body"); setT(o.n, nm);
      // plates, not plain images: a plain Image with no sprite drew nothing on this canvas (seen in window 2)
      o.tr = plate(rp, "StT" + i, bx0 + bw / 2, y, bw, 14, { cut: [5, 0, 5, 0], alpha: 0.9, lineA: 0.35, weave: 0 });
      o.f = plate(rp, "StF" + i, bx0, y, 10, 14, { cut: [5, 0, 5, 0], alpha: 1, lineA: 0, weave: 0, lit: 1.2 }); o.f.rectTransform.pivot = V2(0, 0.5);
      o.g = light(rp, "StG" + i, bx0, y, 90, 90, 1, { _Thin: 24, _Core: 1.4, _Twinkle: 0.2, _Rate: 1.5, _Phase: i }, W, 0);
      o.val = label(rp, "StV" + i, lw / 2 - 50, y, 100, 30, 24, W, TMP.TextAlignmentOptions.Right, "display");
      return o;
    });
    st.bx0 = bx0; st.bw = bw;
    // Legacy skills and the talent: the game's own icons and names
    var gy = sy - 42 - 3 * 42 - 28; st.nLeg = nodeBox("NodeLegacy", gy + 24, gy - 62 - 44); st.gHead = label(rp, "LegH", -lw / 2 + 150, gy, 300, 28, 20, W, null, "display"); st.gHead.characterSpacing = 4; setT(st.gHead, "// LEGACY SKILLS");
    st.leg = [0, 1, 2].map(function (i) {
      var cw3 = lw / 3, x = -lw / 2 + cw3 * i, y = gy - 62, o = {};
      o.p = plate(rp, "LegP" + i, x + 36, y, 64, 64, { cut: [8, 0, 8, 0], alpha: 0.92 });
      o.ic = img(rp, "LegI" + i, x + 36, y, 54, 54, W, 0); o.ic.preserveAspect = true;
      o.t = label(rp, "LegT" + i, x + 74 + (cw3 - 78) / 2, y, cw3 - 78, 62, 18, INK, null, "body"); o.t.enableWordWrapping = true; o.t.enableAutoSizing = true; o.t.fontSizeMin = 9; o.t.fontSizeMax = 18; o.t.overflowMode = TMP.TextOverflowModes.Ellipsis;   // 0.1.16: a long name shrinks and is cut with an ellipsis; it no longer leaves its place
      return o;
    });
    // the lock (what stands between the player and the hero), or what comes next
    var wy = gy - 62 - 74; st.wy = wy; nodeBox("NodeNext", wy + 24, Math.max(wy - 136, -522));
    st.rWhy = label(rp, "Why", 0, wy - 30, lw, 90, 21, INK, TMP.TextAlignmentOptions.TopLeft, "bodyR"); st.rWhy.enableWordWrapping = true; st.rWhy.richText = true; st.rWhy.lineSpacing = 6;
    st.holdTrack = plate(rp, "HoldTrack", 0, wy - 92, lw, 24, { cut: [8, 0, 8, 0], alpha: 0.9 });
    st.holdFill = img(rp, "HoldFill", -lw / 2 + 4, wy - 92, 10, 14, W, 0); st.holdFill.rectTransform.pivot = V2(0, 0.5);
    st.holdT = label(rp, "HoldT", 0, wy - 122, lw, 28, 20, AMBER, null, "body");
    st.detN = label(rp, "DetName", 0, wy, lw, 30, 22, W, null, "display"); st.detD = label(rp, "DetDesc", 0, wy - 62, lw, 96, 19, INK, TMP.TextAlignmentOptions.TopLeft, "bodyR"); st.detD.enableWordWrapping = true; st.detD.enableAutoSizing = true; st.detD.fontSizeMin = 13; st.detD.fontSizeMax = 19;
    st.rRule2 = plate(rp, "Rule2", 0, wy + 28, lw, 2, { alpha: 0, lineA: 0, weave: 0 }); st.rRule2.gameObject.SetActive(false);
    st.rNextH = label(rp, "NextH", -lw / 2 + 150, wy, 300, 28, 20, W, null, "display"); st.rNextH.characterSpacing = 4; setT(st.rNextH, "// NEXT");
    st.rNext = label(rp, "Next", 60, wy, lw - 120, 34, 24, INK, TMP.TextAlignmentOptions.Right, "body");
    st.rWorn = label(rp, "Worn", 0, wy - 36, lw, 30, 20, DIM, TMP.TextAlignmentOptions.Right, "bodyR"); st.rWorn.richText = true;
    log("built: RW " + Math.round(RW) + ", panel " + LW + ", cell " + Math.round(st.cw) + "x" + st.ch + ", rows " + st.rowsVis);
    return st;
  }
  function cell(st, k) {
    while (st.cells.length <= k) {
      var i = st.cells.length, rt = node(st.grid, "Cell" + i, 0, 0, st.cw, st.ch), g = rt.gameObject.AddComponent(T(UE.CanvasGroup));
      var b = { rt: rt, g: g, id: null, f: 0, at: -9 };
      b.p = plate(rt, "P", 0, 0, st.cw, st.ch, { cut: [12, 0, 12, 0], alpha: 0.9, weave: 0.05 });
      var hd = node(rt, "Head", 0, 4, st.cw - 14, st.ch - 14); b.head = hd.gameObject.AddComponent(T(UI.Image)); b.head.preserveAspect = true; b.head.raycastTarget = false;
      var pm = node(rt, "PortMask", 0, 0, st.cw - 12, st.ch - 12); pm.gameObject.AddComponent(T(UI.RectMask2D)); b.portM = pm.gameObject;
      var po = node(pm, "Port", 0, 0, st.cw - 12, st.ch - 12); b.port = po.gameObject.AddComponent(T(UI.RawImage)); b.port.raycastTarget = false; b.portM.SetActive(false);
      b.tag = label(rt, "Tag", 0, -st.ch / 2 + 14, st.cw, 22, 15, AMBER, TMP.TextAlignmentOptions.Center, "display"); b.tag.characterSpacing = 3;
      b.txt = label(rt, "Txt", 0, 0, st.cw - 10, st.ch - 10, 17, INK, TMP.TextAlignmentOptions.Center, "body"); b.txt.enableWordWrapping = true;
      b.gl = light(rt, "Glint", 0, 0, st.cw * 1.5, st.cw * 1.5, 1, { _Thin: 22, _Core: 1.6, _Twinkle: 0.1, _Rate: 2 }, W, 0);
      st.cells.push(b);
    }
    return st.cells[k];
  }

  // the screen's alpha follows the select's own (fourlobbyui's Z.a); off, nothing of it runs
  // Settings > Redux > Menu effects: Calm stops what moves on the stage and in the panels (the ground, the hero and the
  // layout stay); the testers asked for a way to pick between the two, 2026-11-10
  function calm() { try { return G.BB4.opt("fx") == "calm"; } catch (e) { return false; } }
  // the list view (Y / L): the roster as rows, one hero a line, in this screen's own panel (the lead, 2026-11-10)
  function listMode() { try { return G.BB4.opt("heroView") == "list"; } catch (e) { return false; } }
  V.colsNow = function () { return listMode() ? 1 : COLS; };
  // the player's own avatar stands in the lobby right where the hero is shown: its renderers draw nothing while this
  // screen is up (forceRenderingOff: the game switches enabled back on every frame)
  function avatar(st, hide) {
    try {
      if (hide) {
        if (st.av) return; st.av = []; var a = UE.Object.FindObjectsOfType(T(UE.Renderer));
        for (var i = 0; i < a.Length; i++) { var r = a.get_Item(i); if (!r) continue; var q = r.transform, hit = false; for (var k = 0; k < 10 && q; k++) { if (String(q.name).indexOf("SpineActor") == 0) { hit = true; break; } q = q.parent; } if (hit) { r.forceRenderingOff = true; st.av.push(r); } }
      } else if (st.av) { st.av.forEach(function (r) { try { if (r && !r.Equals(null)) r.forceRenderingOff = false; } catch (e) {} }); st.av = null; }
    } catch (e) { }
  }
  // one head, as the game's sprite, our face-centred file, or a crop of the portrait, into a cell or a row of w x h
  function setHead(b, hid, sq, w, h) {
    var C = V.C, sp = C.headSprite(hid), tex = sp ? null : C.heroTexture(hid, C.skinOf(hid));
    var hx = C.soonHead ? C.soonHead(hid) : null; if (hx) { tex = hx; sp = null; }
    b.head.sprite = sp; act(b.head.gameObject, !!sp); act(b.portM, !!tex);
    var dm = Math.min(w, h) + 6; b.port.rectTransform.sizeDelta = hx && !sq ? V2(dm, dm) : V2(w, h);
    if (hx && sq) { var ca = h / w, cu = ca > 1 ? 1 / ca : 1, cv = ca < 1 ? ca : 1; b.port.texture = hx; b.port.uvRect = new UE.Rect((1 - cu) / 2, (1 - cv) / 2, cu, cv); }
    else if (hx) { b.port.texture = hx; b.port.uvRect = new UE.Rect(0, 0, 1, 1); }
    else if (tex) { var ms = C.measure(tex), s2 = 0.4, hv = s2 * tex.width / tex.height * (h / w); b.port.texture = tex; b.port.uvRect = new UE.Rect(clamp(ms.cx - s2 / 2, 0, 1 - s2), clamp(1 - ms.top - hv + 0.01, 0, 1 - hv), s2, hv); }
    return !!(sp || tex);
  }
  function rowCell(st, k) {
    while (st.rows.length <= k) {
      var i = st.rows.length, lw = st.lw, rh = st.rh, rt = node(st.grid, "Row" + i, 0, 0, lw, rh), g = rt.gameObject.AddComponent(T(UE.CanvasGroup));
      var b = { rt: rt, g: g, id: null, f: 0, h: 0, at: -9 };
      b.p = plate(rt, "P", 0, 0, lw, rh, { cut: [12, 0, 12, 0], alpha: 0.9, weave: 0.05 });
      var hd = node(rt, "Head", -lw / 2 + 36, 0, rh - 8, rh - 8); b.head = hd.gameObject.AddComponent(T(UI.Image)); b.head.preserveAspect = true; b.head.raycastTarget = false;
      var pm = node(rt, "PortMask", -lw / 2 + 36, 0, rh - 6, rh - 6); pm.gameObject.AddComponent(T(UI.RectMask2D)); b.portM = pm.gameObject;
      var po = node(pm, "Port", 0, 0, rh - 6, rh - 6); b.port = po.gameObject.AddComponent(T(UI.RawImage)); b.port.raycastTarget = false; b.portM.SetActive(false);
      b.name = label(rt, "Name", 20, 0, lw - 250, rh - 8, 25, INK, null, "body"); b.name.overflowMode = TMP.TextOverflowModes.Ellipsis;
      b.tag = label(rt, "Tag", lw / 2 - 80, 0, 140, 24, 16, AMBER, TMP.TextAlignmentOptions.Right, "display"); b.tag.characterSpacing = 3;
      st.rows.push(b);
    }
    return st.rows[k];
  }
  // the kit, for the other screens drawn in this language (fourevo5.js)
  V.K = { V2: V2, clamp: clamp, ease: ease, col: col, mixc: mixc, tintD: tintD, node: node, img: img, mc: mc, plate: plate, light: light, label: label, setT: setT, setC: setC, pos: pos, scl: scl, act: act,
    setHead: function (b, hid, sq, w, h) { return setHead(b, hid, sq, w, h); }, mats: function () { bundle(); return { P: PMAT, L: LMAT, C: CMAT, S: SMAT, A: AMAT, H: HMAT, T: TMAT }; } };
  // another screen of the select (the Legacy step) keeps the avatar hidden while this one is not drawn
  V.avatarKeep = function (on) { V.avKeep = !!on; if (V.st) avatar(V.st, !!on || !!V.st.shown); };
  V.closeAnim = function () { if (V.st) V.st.closeAt = UE.Time.unscaledTime; };
  // closed: nothing draws this screen after the lobby layer is gone, so its state is put back here (the close fade left
  // it invisible on the next open: the lead, 2026-11-10)
  V.reset = function () { var st = V.st; if (!st) return; try { movieStop(st); } catch (e) {} st.sheetId = null; st.shown = false; st.closeAt = null; avatar(st, false); try { if (st.root && !st.root.Equals(null)) { st.cg.alpha = 0; st.root.gameObject.SetActive(false); } } catch (e) {} };
  V.vis = function (S, Z, a, vis, v5) {
    var st = V.st, on = vis && (v5 == null ? V.on(S) && !(G.BB4HL && G.BB4HL.on(S)) : !!v5) && bundle();
    if (!st) { if (!on) return; try { st = build(S, Z, V.C); } catch (e) { log("build: " + es(e)); V.enabled = false; return; } }
    if (!st.root || st.root.Equals(null)) { V.st = null; return; }
    act(st.root.gameObject, !!on);
    // the lobby's own backdrop is a bright additive layer that shows through any veil: off while this screen is up
    try { var bd = st.bd && !st.bd.Equals(null) ? st.bd : (st.bd = st.root.parent.Find("Backdrop")); if (bd && !bd.Equals(null)) { if (on && bd.gameObject.activeSelf) { bd.gameObject.SetActive(false); st.bdOff = true; } } } catch (e) { }
    if (!on) { if (st.shown) { movieStop(st); st.sheetId = null; } st.shown = false; if (!V.avKeep) avatar(st, false); return; }
    avatar(st, true);
    if (st.closeAt != null && !S.leaving) st.closeAt = null;
    if (!st.shown) { st.shown = true; st.openAt = UE.Time.unscaledTime; st.root.SetSiblingIndex(Z.root.GetSiblingIndex() + 1); st.want = null; st.tabWas = null; st.closeAt = null; }
    var ck0 = st.closeAt != null ? Math.min(1, (UE.Time.unscaledTime - st.closeAt) / 0.14) : 0; st.cg.alpha = a * (1 - ck0);
  };

  V.frame = function (S, Z, F) {
    var st = V.st; if (!st || !st.shown) return;
    var C = V.C, t = F.t, e = t - st.openAt, p = F.p, tabs = F.tabs, tab = tabs[p.tab] || tabs[0], l = p.list, n = l.length, ci = p.i, id = l[ci], lk0 = C.lockOf(id), locked0 = !!(lk0 && lk0.locked);
    UE.Shader.SetGlobalFloat("_FourTimeOffset", UE.Time.unscaledTime - UE.Time.timeSinceLevelLoad);
    // the group's colour, eased from the last one
    var gc = tab.g.col, H = st.hue || gc; H = st.hue = [H[0] + (gc[0] - H[0]) * 0.18, H[1] + (gc[1] - H[1]) * 0.18, H[2] + (gc[2] - H[2]) * 0.18];
    var lumH = 0.3 * H[0] + 0.59 * H[1] + 0.11 * H[2], HS = mixc(H, [lumH, lumH, lumH], 0.45);   // the ground and the stage: the group's colour at about half its saturation (a tester, 2026-11-10)
    var HP = mixc(mixc(H, [lumH, lumH, lumH], 0.3), W, 0.22);   // the stage's colour: the group's, toward pastel
    var hk = H[0].toFixed(2) + H[1].toFixed(2) + H[2].toFixed(2);
    if (st.hk !== hk) {
      st.hk = hk;
      [st.lpP, st.npP, st.evoP].concat(st.nodes).forEach(function (pl) { var m = pl.__m; mc(m, "_Fill", tintD(H, 0.06, 0.6), 0.94); mc(m, "_Line", mixc(H, W, 0.15), 0.65); mc(m, "_BracketColor", mixc(H, W, 0.2), 0.85); mc(m, "_Accent", H, 1); });
      var hc = mixc(H, W, 0.3); [st.lHead, st.rHead, st.rNextH].forEach(function (x) { setC(x, hc, 1); });
      [st.rRule, st.lRule, st.rRule2].forEach(function (x) { mc(x.__m, "_Fill", tintD(H, 0.35, 0.85), 0.9); }); setC(st.lSweep, H, 0); setC(st.rSweep, H, 0);
      setC(st.veil, [0.004, 0.004, 0.006], 0.99); mc(st.holdTrack.__m, "_Fill", tintD(H, 0.05, 0.8), 0.9); mc(st.holdTrack.__m, "_Line", H, 0.6);
      if (st.energy.__m) st.energy.__m.SetColor("_Hot", col(mixc(H, W, 0.6), 1));
      st.cells.forEach(function (b) { b.vk = null; }); st.tabKey = null;
    }
    // open: the panels slide in from their sides, the stage rises
    var ck = st.closeAt != null ? ease((t - st.closeAt) / 0.14) : 0;
    var po = ease((e - 0.02) / 0.35); pos(st.lp, -st.RW / 2 + st.LW / 2 - 60 * (1 - po) - 140 * ck, 0); pos(st.rp, st.RW / 2 - st.LW / 2 + 60 * (1 - po) + 140 * ck, 0); st.lpG.alpha = po; st.rpG.alpha = po;
    var so = ease((e - 0.1) / 0.45); scl(st.stage, st.CS * (0.94 + 0.06 * so));
    // tabs
    var mnow = null, mlive = false;
    try {
      var m0 = UE.Input.mousePosition, mk0 = Math.round(m0.x) + ":" + Math.round(m0.y); if (st.mK0 == null) { st.mK0 = mk0; st.mAt0 = -1e9; } else if (st.mK0 !== mk0) { st.mK0 = mk0; st.mAt0 = t; }
      mlive = t - st.mAt0 < 3; mnow = V2(m0.x, m0.y);
      if (st.cam === undefined) { var cvm = st.root.GetComponentInParent(T(UE.Canvas)); cvm = cvm ? cvm.rootCanvas : null; st.cam = cvm && +cvm.renderMode !== 0 ? cvm.worldCamera : null; }
    } catch (em) { mlive = false; }
    if (V.mouseTest) { mnow = V2(V.mouseTest[0], V.mouseTest[1]); mlive = true; }   // a test hook: a mouse position given by a script
    function over(rt2) { try { return mlive && UE.RectTransformUtility.RectangleContainsScreenPoint(rt2, mnow, st.cam); } catch (e9) { return false; } }
    var tabHov = -1; for (var th = 0; th < tabs.length; th++) if (over(st.tabs[th].p.rectTransform)) tabHov = th;
    var tk = p.tab + ":" + tabs.length + ":" + hk + ":" + (F.tabFocus ? 1 : 0) + ":" + tabHov;
    if (st.tabKey !== tk) {
      st.tabKey = tk;
      st.tabs.forEach(function (Tb, j) {
        var show = j < tabs.length; act(Tb.p.gameObject, show); act(Tb.t.gameObject, show); if (!show) return;
        var cur = j == p.tab, tg = tabs[j].g, m = Tb.p.__m; setT(Tb.t, tg.name);
        mc(m, "_Fill", cur ? tintD(tg.col, 0.42, 0.9) : tintD(tg.col, 0.07, 0.8), cur ? 0.96 : 0.8); mc(m, "_Line", cur ? mixc(tg.col, W, 0.4) : mixc(GREY, tg.col, 0.55), cur ? 0.9 : 0.45);
        var tf = cur && F.tabFocus; if (tf) mc(m, "_Line", W, 1); m.SetFloat("_Run", tf ? 1 : 0); m.SetFloat("_RunSpeed", 160); m.SetFloat("_RunLen", 70);
        var thv = !cur && j == tabHov; if (thv) mc(m, "_Line", mixc(tg.col, W, 0.6), 0.95);
        m.SetFloat("_Lit", cur ? 2 : thv ? 1.2 : 0.25); m.SetFloat("_EdgeGlow", cur ? (tf ? 0.5 : 0.32) : thv ? 0.2 : 0); mc(m, "_Accent", tg.col, 1); setC(Tb.t, cur || thv ? W : mixc(DIM, tg.col, 0.3), 1);
      });
    }
    // a group change: the heads come in from the side the new group lies on, a column at a time
    if (st.tabWas != null && st.tabWas != p.tab) { st.chgAt = t; st.chgDir = p.tab > st.tabWas ? 1 : -1; st.top = 0; st.burstAt = t + 0.12; st.burstAmp = 0.8; }
    // each group keeps its own layered effect over a black ground (a tester, 2026-11-10, on what made Cross Effect's stage work:
    // simple effects in layers in front of and behind the art, a pastel colour so the art's own colours stand out, a solid
    // black background; the lead on the flat mosaic alone: "it needs to have more flavor")
    var mode = ({ heroes: 0, ex: 1, boss: 2, cross: 3 })[tab.g.key] || 0;
    if (st.modeShown == null) { st.modeShown = mode; st.modeAt = -9; [st.fxBack, st.fxFront].forEach(function (x) { if (x.__m) x.__m.SetFloat("_Mode", mode); }); }
    else if (st.modeWant !== mode && st.modeShown !== mode) { st.modeWant = mode; st.modeAt = t; }
    var mf = (t - st.modeAt) / 0.3, mk = mf >= 1 ? 1 : mf < 0.5 ? 1 - mf * 2 : (mf - 0.5) * 2;
    if (st.modeWant != null && mf >= 0.5 && st.modeShown !== st.modeWant) { st.modeShown = st.modeWant; [st.fxBack, st.fxFront].forEach(function (x) { if (x.__m) x.__m.SetFloat("_Mode", st.modeShown); }); }
    st.tabWas = p.tab;
    var click = false, mpt = null;
    try { click = !!V.pend; if (click) { mpt = V2(V.pend[0], V.pend[1]); V.pend = null; if (st.cam === undefined) { var cv0 = st.root.GetComponentInParent(T(UE.Canvas)); cv0 = cv0 ? cv0.rootCanvas : null; st.cam = cv0 && +cv0.renderMode !== 0 ? cv0.worldCamera : null; } } } catch (e0) { click = false; }
    if (click && mpt && C.tabTo) for (var tq = 0; tq < tabs.length; tq++) if (UE.RectTransformUtility.RectangleContainsScreenPoint(st.tabs[tq].p.rectTransform, mpt, st.cam)) { C.tabTo(tq); break; }
    [st.evoP].concat(st.nodes).forEach(function (pl) {
      var hv = over(pl.rectTransform) ? 1 : 0; pl.__h = (pl.__h || 0) + (hv - (pl.__h || 0)) * 0.25; var hq9 = Math.round(pl.__h * 20) / 20;
      if (pl.__hq !== hq9 + ":" + hk) { pl.__hq = hq9 + ":" + hk; var m9 = pl.__m; mc(m9, "_Line", mixc(mixc(H, W, 0.15), W, 0.55 * hq9), 0.65 + 0.35 * hq9); m9.SetFloat("_EdgeGlow", 0.22 * hq9); m9.SetFloat("_Run", hq9 > 0.5 ? 1 : 0); m9.SetFloat("_RunSpeed", 110); m9.SetFloat("_RunLen", 90); mc(m9, "_Accent", H, 1); }
    });
    // the grid: the cursor's row stays in view
    var LM = listMode(), cols = LM ? 1 : COLS, rowsVis = LM ? st.rowsVisL : st.rowsVis;
    if (st.lmWas !== LM) { if (st.lmWas != null) { st.chgAt = t; st.chgDir = 1; } st.lmWas = LM; st.top = 0; }
    var rows = Math.ceil(n / cols), r = Math.floor(ci / cols);
    if (r < st.top) st.top = r; if (r > st.top + rowsVis - 1) st.top = r - rowsVis + 1; st.top = clamp(st.top, 0, Math.max(0, rows - rowsVis));
    // the left field starts under the last row of heads
    var rowsShown = Math.min(rows, st.rowsVis), yb = st.gridTop - rowsShown * (st.ch + st.gap) - 6;
    // coming soon: this group's names from the roadmap that the roster does not hold yet, two across
    var sk = tab.g.key + ":" + n + ":" + hk;
    if (st.soonKey !== sk) {
      st.soonKey = sk; var have = {}; (p.heroes || l).forEach(function (h0) { have[String(C.heroLabelOf(h0)).toLowerCase().replace(/[^a-z0-9]/g, "")] = 1; });
      var list = (SOON[tab.g.key] || []).filter(function (q0) { var k0 = q0[0].toLowerCase().replace(/[^a-z0-9]/g, ""); return !have[k0] && !have[k0.replace(/^ex/, "") + "ex"]; });
      var room = Math.max(0, Math.floor((yb - 44 + 380) / 38)) * 2; list = list.slice(0, Math.min(28, room)); st.soonList = list; st.soonY = yb - 30;
      act(st.soonH.gameObject, list.length > 0); act(st.soonN.gameObject, list.length > 0); setT(st.soonN, list.length + (list.length == 1 ? " hero" : " heroes"));
      pos(st.soonH.rectTransform, -st.lw / 2 + 150, st.soonY); pos(st.soonN.rectTransform, st.lw / 2 - 150, st.soonY); setC(st.soonH, mixc(H, W, 0.3), 1); setC(st.evoH, mixc(H, W, 0.3), 1);
      st.soon.forEach(function (o, i) {
        var q1 = list[i]; act(o.p.gameObject, !!q1); act(o.n.gameObject, !!q1); act(o.y.gameObject, !!q1); if (!q1) return;
        var cx2 = -st.lw / 2 + st.sw2 / 2 + (i % 2) * (st.sw2 + 10), cy2 = st.soonY - 40 - Math.floor(i / 2) * 38;
        pos(o.p.rectTransform, cx2, cy2); pos(o.n.rectTransform, cx2 - 26, cy2); pos(o.y.rectTransform, cx2 + st.sw2 / 2 - 42, cy2); setT(o.n, q1[0]); setT(o.y, q1[1]);
        mc(o.p.__m, "_Fill", tintD(H, 0.05, 0.6), 0.85); mc(o.p.__m, "_Line", mixc(GREY, H, 0.5), 0.35); setC(o.n, mixc(INK, DIM, 0.3), 1); setC(o.y, mixc(DIM, H, 0.4), 1);
      });
      st.soonBot = st.soonY - 40 - Math.ceil(list.length / 2) * 38;
    }
    setT(st.evoT, F.evoN ? F.evoN + (F.evoN == 1 ? " saved for this hero" : " saved for this hero") + (F.evoBest ? "   ·   best score " + F.evoBest : "") : "None saved for this hero yet");
    var hotH = col(mixc(H, W, 0.6), 1), ua = (Math.min(yb, st.soonBot == null ? yb : st.soonBot) + 540) / 1080;
    if (st.lHex.__m) { if (st.hexA !== ua) { st.hexA = ua; st.lHex.__m.SetFloat("_MaskA", ua); st.lHex.__m.SetFloat("_MaskB", ua - 0.13); } st.lHex.__m.SetColor("_Hot", hotH); setC(st.lHex, HS, calm() ? 0 : po * 0.35); }
    if (st.rHex.__m) { st.rHex.__m.SetColor("_Hot", hotH); setC(st.rHex, HS, calm() ? 0 : po * 0.35); }
    var owned = 0, x0 = -st.lw / 2 + st.cw / 2;
    var real = 0; for (var q = 0; q < n; q++) { var lq = C.lockOf(l[q]); if (lq && lq.soon) continue; real++; if (!(lq && lq.locked)) owned++; }
    setT(st.lCount, owned + " / " + real + " owned" + (n > real ? "   ·   " + (n - real) + " coming" : ""));
    for (var c = 0; c < Math.max(st.cells.length, st.rowsVis * COLS); c++) {
      var j = st.top * COLS + c, show = !LM && c < st.rowsVis * COLS && j < n; if (!show && c >= st.cells.length) continue;
      var b = cell(st, c); act(b.rt.gameObject, show); if (!show) continue;
      var cc = c % COLS, cr = Math.floor(c / COLS), ca = 1, ox = 0;
      if (st.chgAt != null) { var u = ease((t - st.chgAt - cc * 0.03) / 0.2); ca = u; ox = st.chgDir * 70 * (1 - u); if (t - st.chgAt > 0.5) st.chgAt = null; }
      var oa = ease((e - 0.12 - (cr * COLS + cc) * 0.012) / 0.25);
      var hid = l[j], foc = j == ci && !F.tabFocus, lk = C.lockOf(hid), locked = !!(lk && lk.locked);
      var sq = C.headSquare ? C.headSquare() : false;
      if (b.id !== hid || b.sq !== sq) {
        b.id = hid; b.sq = sq; b.vk = null; var hasH = setHead(b, hid, sq, st.cw - 12, st.ch - 12);
        setT(b.txt, hasH ? "" : C.heroLabelOf(hid));
      }
      if (click && mpt && C.pickIndex && UE.RectTransformUtility.RectangleContainsScreenPoint(b.rt, mpt, st.cam)) { C.pickIndex(j); click = false; }
      if (foc && !b.was) b.at = t; b.was = foc;
      b.f += ((foc ? 1 : 0) - b.f) * 0.3; if (Math.abs(b.f - (foc ? 1 : 0)) < 0.01) b.f = foc ? 1 : 0;
      var hvC = !foc && over(b.rt) ? 1 : 0; if (hvC && !b.hw) b.at2 = t; b.hw = hvC; b.h = (b.h || 0) + (hvC - (b.h || 0)) * 0.3; if (Math.abs(b.h - hvC) < 0.01) b.h = hvC;
      var g = Math.max(b.f, b.h * 0.45), vk = hid + ":" + g.toFixed(2) + ":" + locked + ":" + (lk && lk.dlc ? 1 : 0) + ":" + (hid == p.was ? 1 : 0);
      if (b.vk !== vk) {
        b.vk = vk; var m2 = b.p.__m;
        mc(m2, "_Fill", mixc(locked ? tintD(H, 0.03, 0.5) : tintD(H, 0.14, 0.88), tintD(H, 0.46, 0.92), g), 0.9 + 0.06 * g);
        mc(m2, "_Line", mixc(locked ? GREY : mixc(GREY, H, 0.7), mixc(H, W, 0.5), g), (locked ? 0.25 : 0.45) + 0.5 * g);
        m2.SetFloat("_Lit", 0.3 + 1.7 * g); m2.SetFloat("_EdgeGlow", 0.32 * g); m2.SetFloat("_Run", g > 0.5 ? 1 : 0); m2.SetFloat("_RunSpeed", 140); m2.SetFloat("_RunLen", 80); mc(m2, "_Accent", H, 1);
        var hcol = locked ? (lk.soon ? mixc([0.5, 0.49, 0.55], [0.85, 0.84, 0.9], g) : mixc([0.3, 0.29, 0.36], [0.62, 0.6, 0.68], g)) : mixc([0.74, 0.72, 0.8], W, g);
        setC(b.head, hcol, 1); setC(b.port, hcol, 1); setT(b.tag, locked ? (lk.soon ? "SOON" : lk.dlc ? "DLC" : lk.can ? "UNLOCK" : "LOCKED") : hid == p.was ? "PLAYING" : "");
        setC(b.tag, locked ? (lk.soon ? mixc(DIM, H, 0.4) : lk.can ? GREEN : AMBER) : mixc(H, W, 0.5), 1);
      }
      var wv = ((t % 7) - (cc + cr) * 0.075) / 0.32, shim = 0;
      var since = foc ? t - b.at : 9, pl = Math.max(shim, since < 0.25 ? 0.7 * (1 - since / 0.25) : 0); if (pl !== b.pl) { b.pl = pl; b.p.__m.SetFloat("_Pulse", pl); }
      var ga = since < 0.35 ? 1 - since / 0.35 : 0; if (ga !== b.ga) { b.ga = ga; setC(b.gl, mixc(H, W, 0.6), ga); scl(b.gl.rectTransform, 0.5 + (1 - ga)); }
      pos(b.rt, x0 + cc * (st.cw + st.gap) + ox, st.gridTop - st.ch / 2 - cr * (st.ch + st.gap)); scl(b.rt, 1 + 0.07 * g); b.g.alpha = ca * oa;
      if (foc) b.rt.SetAsLastSibling();
    }
    // the list: one hero a row (head, name, state), the same focus, lock and hover language as the heads
    for (var c2 = 0; c2 < Math.max(st.rows.length, LM ? rowsVis : 0); c2++) {
      var j2 = st.top + c2, show2 = LM && c2 < rowsVis && j2 < n; if (!show2 && c2 >= st.rows.length) continue;
      var b2 = rowCell(st, c2); act(b2.rt.gameObject, show2); if (!show2) continue;
      var hid2 = l[j2], foc2 = j2 == ci && !F.tabFocus, lk2 = C.lockOf(hid2), locked2 = !!(lk2 && lk2.locked), sq2 = C.headSquare ? C.headSquare() : false;
      if (b2.id !== hid2 || b2.sq !== sq2) { b2.id = hid2; b2.sq = sq2; b2.vk = null; setHead(b2, hid2, sq2, st.rh - 6, st.rh - 6); setT(b2.name, C.heroLabelOf(hid2)); }
      if (click && mpt && C.pickIndex && UE.RectTransformUtility.RectangleContainsScreenPoint(b2.rt, mpt, st.cam)) { C.pickIndex(j2); click = false; }
      b2.f += ((foc2 ? 1 : 0) - b2.f) * 0.3; if (Math.abs(b2.f - (foc2 ? 1 : 0)) < 0.01) b2.f = foc2 ? 1 : 0;
      var hv2 = !foc2 && over(b2.rt) ? 1 : 0; b2.h += (hv2 - b2.h) * 0.3; if (Math.abs(b2.h - hv2) < 0.01) b2.h = hv2;
      var g2 = Math.max(b2.f, b2.h * 0.45), vk2 = hid2 + ":" + g2.toFixed(2) + ":" + locked2 + ":" + (hid2 == p.was ? 1 : 0) + ":" + hk;
      if (b2.vk !== vk2) {
        b2.vk = vk2; var m3 = b2.p.__m;
        mc(m3, "_Fill", mixc(locked2 ? tintD(H, 0.03, 0.5) : tintD(H, 0.1, 0.85), tintD(H, 0.42, 0.92), g2), 0.9 + 0.06 * g2);
        mc(m3, "_Line", mixc(locked2 ? GREY : mixc(GREY, H, 0.7), mixc(H, W, 0.5), g2), (locked2 ? 0.2 : 0.4) + 0.55 * g2);
        m3.SetFloat("_Lit", 0.3 + 1.7 * g2); m3.SetFloat("_EdgeGlow", 0.3 * g2); m3.SetFloat("_Run", b2.f > 0.5 ? 1 : 0); m3.SetFloat("_RunSpeed", 220); m3.SetFloat("_RunLen", 120); mc(m3, "_Accent", H, 1);
        var hc3 = locked2 ? (lk2.soon ? mixc([0.5, 0.49, 0.55], [0.85, 0.84, 0.9], g2) : mixc([0.3, 0.29, 0.36], [0.62, 0.6, 0.68], g2)) : mixc([0.78, 0.76, 0.84], W, g2);
        setC(b2.head, hc3, 1); setC(b2.port, hc3, 1); setC(b2.name, locked2 ? mixc(DIM, INK, 0.3 + 0.5 * g2) : mixc(INK, W, g2), 1);
        setT(b2.tag, locked2 ? (lk2.soon ? "SOON" : lk2.dlc ? "DLC" : lk2.can ? "UNLOCK" : "LOCKED") : hid2 == p.was ? "PLAYING" : "");
        setC(b2.tag, locked2 ? (lk2.soon ? mixc(DIM, H, 0.4) : lk2.can ? GREEN : AMBER) : AMBER, 1);
      }
      var ra = 1, rox = 0; if (st.chgAt != null) { var u2 = ease((t - st.chgAt - c2 * 0.018) / 0.2); ra = u2; rox = st.chgDir * 50 * (1 - u2); }
      pos(b2.rt, rox + 10 * b2.f, st.gridTop - st.rh / 2 - c2 * (st.rh + 6)); b2.g.alpha = ra * ease((e - 0.12 - c2 * 0.012) / 0.25);
    }
    if (LM && st.chgAt != null && t - st.chgAt > 0.6) st.chgAt = null;
    if (rows > rowsVis) { var gh = rowsVis * (LM ? st.rh + 6 : st.ch + st.gap), mh = Math.max(40, gh * rowsVis / rows); st.rail.rectTransform.sizeDelta = V2(3, mh); pos(st.rail.rectTransform, st.lw / 2 + 12, st.gridTop - mh / 2 - (gh - mh) * st.top / (rows - rowsVis)); setC(st.rail, H, 0.7); } else setC(st.rail, H, 0);
    // centre stage: the art turns to the new hero (the old one leaves to one side as the new one arrives from the other)
    if (st.want !== id) {
      var dir = st.want == null ? 0 : (st.lastI != null && ci < st.lastI ? -1 : 1); st.want = id; st.lastI = ci; st.swapAt = t; st.swapDir = dir;
      var A = st.art[0], Bq = st.art[1]; st.art = [Bq, A];                       // st.art[0] is always the arriving layer
      var tex2 = C.heroTexture(id, C.skinOf(id)), ar = st.art[0];
      ar.texture = tex2; ar.__has = !!tex2;
      if (tex2) {
        // the figure (what is drawn, not the texture) stands on the floor, in the middle, up to 900 high and 940 wide
        var mq = C.measure(tex2), bt = mq.bot == null ? 1 : mq.bot, fh = Math.max(0.2, bt - mq.top), fw = Math.max(0.2, (mq.r == null ? 1 : mq.r) - (mq.l || 0));
        var hh = (lk0 && lk0.soon ? 800 : 880) / fh, ww = hh * tex2.width / tex2.height; if (ww * fw > 940) { ww = 940 / fw; hh = ww * tex2.height / tex2.width; }
        ar.rectTransform.sizeDelta = V2(ww, hh); ar.__x = -(((mq.l || 0) + (mq.r == null ? 1 : mq.r)) / 2 - 0.5) * ww; ar.__y = -552 - hh / 2 + bt * hh;   // in the mask's own space: the feet are 64 under the platform's edge
      }
      ar.rectTransform.SetAsLastSibling(); st.beam.rectTransform.SetAsLastSibling();
      if (dir) { st.pulseAt = t; st.burstAt = t; st.burstAmp = 0.3; }
    }
    // the turn: the leaving hero burns away (0.26 s) as the arriving one burns in (0.38 s), each along its own noise with an
    // edge lit in the group's colour; the figure floats a few units up and down; a locked hero is greyed
    var a0 = st.art[0], a1 = st.art[1], since2 = t - (st.swapAt || 0), sd = st.swapDir || 0, bob = 0;
    var rimC = col(mixc(H, W, 0.1), 0.14), edgeC = col(mixc(H, W, 0.55), 1);
    if (a0.__m) {
      var d0 = 1 - ease(since2 / 0.38), d1 = ease(since2 / 0.26);
      a0.__m.SetFloat("_Dissolve", sd ? d0 : 0); a0.__m.SetFloat("_Dim", locked0 ? (lk0.soon ? 0.3 : 1) : 0); a0.__m.SetColor("_Rim", rimC); a0.__m.SetColor("_Edge", edgeC);
      a1.__m.SetFloat("_Dissolve", d1); a1.__m.SetColor("_Rim", rimC); a1.__m.SetColor("_Edge", edgeC);
      setC(a0, W, a0.__has ? so : 0); setC(a1, W, a1.__has && d1 < 0.999 ? so : 0);
      pos(a0.rectTransform, (a0.__x || 0) + sd * 26 * (1 - ease(since2 / 0.38)), (a0.__y == null ? 6 : a0.__y) + 10 * (1 - so) + bob); pos(a1.rectTransform, (a1.__x || 0) - sd * 26 * d1, (a1.__y == null ? 6 : a1.__y) + bob);
      if (st.dimFor !== id) { st.dimFor = id; a1.__m.SetFloat("_Dim", st.dimLast ? 1 : 0); st.dimLast = locked0; }
    } else {
      var sw = ease(since2 / 0.22), dimA = locked0 ? [0.42, 0.4, 0.48] : W;
      setC(a0, dimA, a0.__has ? sw * so : 0); pos(a0.rectTransform, sd * 46 * (1 - sw), 6 + 10 * (1 - so) + bob);
      setC(a1, a1.__dim || W, a1.__has ? (1 - sw) * so : 0); pos(a1.rectTransform, -sd * 46 * sw, 6 + bob); a0.__dim = dimA;
    }
    // the stage effect: the group's colour, a burst from the centre on each new hero (stronger on a new group)
    var bu = st.burstAt != null ? (t - st.burstAt) / 0.55 : 2, hotC = col(mixc(H, W, 0.6), 1);
    var cm = calm();
    [st.fxBack, st.fxFront].forEach(function (x, i) {
      if (!x.__m) return; x.__m.SetColor("_Hot", hotC); x.__m.SetFloat("_Burst", bu > 0 && bu < 1 ? bu : 0); x.__m.SetFloat("_BurstAmp", st.burstAmp || 0.6);
      setC(x, HP, cm ? 0 : so * mk * (locked0 && !lk0.soon ? 0.4 : 1) * (i ? 0.5 : (st.modeShown === 3 ? 0.42 : 0.5)));
    });
    var br = 0.5 + 0.5 * Math.sin(t * Math.PI / 2), em2 = st.energy.__m;
    if (em2) { em2.SetFloat("_Open", c01((e - 0.1) / 0.7)); var pu = st.pulseAt != null ? (t - st.pulseAt) / 0.5 : 2; em2.SetFloat("_Pulse", pu < 1 && !cm ? pu : 0); setC(st.energy, HS, so * (locked0 ? 0.4 : 0.8)); }
    setC(st.back, HS, so * 0.06); setC(st.beam, mixc(HS, W, 0.4), so * 0.12); setC(st.topLight, HP, so * 0.2);
    // the mosaic is the emblem behind the hero, not a wall: the mark lit, the rest near black; fainter behind Cross Effect's rift
    if (st.tri.__m) { if (st.triSet !== st.modeShown) { st.triSet = st.modeShown; st.tri.__m.SetFloat("_Base", 0.24); st.tri.__m.SetFloat("_Mark", 0.8); st.tri.__m.SetFloat("_Bottom", 0.08); st.tri.__m.SetFloat("_GradLo", -1.25); st.tri.__m.SetFloat("_GradHi", 0.05); } if (st.triCalm !== cm) { st.triCalm = cm; st.tri.__m.SetFloat("_Drift", cm ? 0 : 1); } st.tri.__m.SetColor("_Hot", col(mixc(HP, W, 0.4), 1)); setC(st.tri, HP, so * mk * (locked0 ? 0.4 : st.modeShown === 3 ? 0.3 : 0.75)); }
    // the name plate
    var npo = 0; if (st.np.gameObject.activeSelf) st.np.gameObject.SetActive(false);
    var name = C.heroLabelOf(id), dk = ease((t - (st.swapAt || 0)) / 0.18);
    setT(st.name, String(name).toUpperCase()); setC(st.name, W, npo * (0.3 + 0.7 * dk)); var ks = dk < 1 ? Math.round(22 * (1 - dk)) : 0; if (st.ks !== ks) { st.ks = ks; st.name.characterSpacing = ks; }
    var stt = locked0 ? (lk0.soon ? "Coming soon" : lk0.dlc ? "DLC hero" : lk0.can ? "Ready to unlock" : "Locked") : id == p.was ? "Playing now" : "Choose to play";
    setT(st.status, stt); setC(st.status, locked0 ? (lk0.can ? GREEN : AMBER) : id == p.was ? AMBER : mixc(DIM, H, 0.4), npo);
    // the right panel: the hero's sheet
    setT(st.rPlace, (ci + 1) + " / " + n); setT(st.rName, String(name).toUpperCase()); setC(st.rName, W, 0.3 + 0.7 * dk);
    setT(st.rGroup, tab.g.label); setC(st.rGroup, mixc(H, W, 0.45), 1);
    setT(st.rState, stt.toUpperCase()); setC(st.rState, locked0 ? (lk0.can ? GREEN : AMBER) : id == p.was ? AMBER : mixc(H, W, 0.6), 1);
    if (st.hk2 !== hk) { st.hk2 = hk; var hc2 = mixc(H, W, 0.3); [st.sHead, st.gHead, st.vidTag].forEach(function (x) { setC(x, hc2, 1); }); var vm = st.vidP.__m; mc(vm, "_Line", mixc(H, W, 0.2), 0.8); mc(vm, "_BracketColor", mixc(H, W, 0.3), 0.9); mc(vm, "_Accent", H, 1);
      st.leg.forEach(function (o) { mc(o.p.__m, "_Fill", tintD(H, 0.1, 0.85), 0.92); mc(o.p.__m, "_Line", mixc(H, W, 0.2), 0.6); }); }
    // what the sheet shows changes with the hero: its numbers, its skills, its video (started once the cursor rests)
    if (st.sheetId !== id) {
      st.sheetId = id; st.sheetAt = t; var d = sheetOf(id, p); st.sheet = d;
      st.leg.forEach(function (o, i) { var q = d.leg[i]; act(o.p.gameObject, !!q); act(o.ic.gameObject, !!q); act(o.t.gameObject, !!q); if (!q) return; o.ic.sprite = q.sp; setC(o.ic, W, q.sp ? 1 : 0); setT(o.t, q.name); });
      act(st.gHead.gameObject, d.leg.length > 0); act(st.nLeg.gameObject, d.leg.length > 0);
      var hasSt = d.stats.some(function (q9) { return !!q9; }); act(st.nStats.gameObject, hasSt); act(st.sHead.gameObject, hasSt);
      st.stats.forEach(function (o9) { [o9.n, o9.tr, o9.f, o9.g, o9.val].forEach(function (x9) { act(x9.gameObject, hasSt); }); });
      movieStop(st); st.movWant = d.movie ? id : 0; st.movStartAt = t + 0.4; setT(st.vidNo, d.movie ? "" : d.soon ? "Coming in " + d.soon : "No video for this hero");
    }
    var d2 = st.sheet || { stats: [], leg: [] }, sa = ease((t - st.sheetAt) / 0.3);
    st.stats.forEach(function (o, i) {
      var q = d2.stats[i], tg = q ? q.k : 0; o.v += (tg - o.v) * 0.14; if (Math.abs(tg - o.v) < 0.002) o.v = tg;
      var wpx = Math.max(2, st.bw * o.v); if (o.w !== Math.round(wpx)) { o.w = Math.round(wpx); o.f.rectTransform.sizeDelta = V2(wpx, 14); o.f.__m.SetVector("_Size", new UE.Vector4(wpx, 14, 0, 0)); pos(o.g.rectTransform, st.bx0 + wpx, o.f.rectTransform.anchoredPosition.y); }
      var moving = Math.abs(tg - o.v) > 0.01 ? 1 : 0; o.gk = (o.gk || 0) + (moving - (o.gk || 0)) * 0.2;
      if (o.hk !== hk) { o.hk = hk; mc(o.f.__m, "_Fill", tintD(H, 0.5, 0.9), 1); mc(o.tr.__m, "_Fill", tintD(H, 0.03, 0.6), 0.9); mc(o.tr.__m, "_Line", H, 0.4); } setC(o.f, W, q ? 1 : 0); setC(o.g, mixc(H, W, 0.6), q ? 0.25 + 0.75 * o.gk : 0);
      var shown = q ? Math.round(q.v * (0.5 + 0.5 * Math.min(1, o.v / Math.max(0.001, tg)))) : -1; if (o.shown !== shown) { o.shown = shown; setT(o.val, q ? String(shown) : "-"); }
    });
    st.leg.forEach(function (o, i) { var k = ease((t - st.sheetAt - 0.08 * i) / 0.28); pos(o.ic.rectTransform, o.p.rectTransform.anchoredPosition.x, o.p.rectTransform.anchoredPosition.y); scl(o.ic.rectTransform, 0.7 + 0.3 * k); });
    // the video: prepared 0.4 s after the cursor comes to rest on a hero, faded in once it plays, looped
    if (st.movWant && st.movId !== st.movWant && t >= st.movStartAt) movieStart(st, st.movWant);
    var mvk = st.movOk ? ease((t - st.movOkAt) / 0.3) : 0; setC(st.vid, W, mvk);
    // the lock, or what comes next
    var why = locked0 ? (lk0.why || "") + (lk0.item && (!lk0.special || lk0.can) && !lk0.dlc ? "\n<color=#ffd27a>" + lk0.text + "</color>" : "") : "";
    setT(st.rWhy, why);
    var hp = F.hp || 0, holding = !!F.holding, canHold = locked0 && lk0.can;
    act(st.holdTrack.gameObject, canHold); act(st.holdFill.gameObject, canHold); act(st.holdT.gameObject, canHold);
    if (canHold) { st.holdFill.rectTransform.sizeDelta = V2(Math.max(0, (st.lw - 8) * hp), 14); setC(st.holdFill, mixc(GREEN, W, 0.2), holding ? 1 : 0); setT(st.holdT, holding ? "Unlocking  " + Math.round(hp * 100) + "%" : "Hold " + (F.pad ? "A" : "Enter") + " to unlock"); setC(st.holdT, holding ? GREEN : AMBER, 1); }
    // a Legacy skill or the talent under the mouse (while the mouse was the last thing moved) is named and explained under the row
    var hov = -1;
    try {
      var mp = UE.Input.mousePosition, mk = Math.round(mp.x) + ":" + Math.round(mp.y); if (st.mpK == null) { st.mpK = mk; st.mpAt = -1e9; } else if (st.mpK !== mk) { st.mpK = mk; st.mpAt = t; }
      if (st.cam === undefined) { var cv = st.root.GetComponentInParent(T(UE.Canvas)); cv = cv ? cv.rootCanvas : null; st.cam = cv && +cv.renderMode !== 0 ? cv.worldCamera : null; }
      if (st.mpAt > (st.swapAt || 0)) { var sp2 = V2(mp.x, mp.y); for (var hq = 0; hq < d2.leg.length; hq++) if (UE.RectTransformUtility.RectangleContainsScreenPoint(st.leg[hq].p.rectTransform, sp2, st.cam) || UE.RectTransformUtility.RectangleContainsScreenPoint(st.leg[hq].t.rectTransform, sp2, st.cam)) { hov = hq; break; } }
    } catch (e3) { }
    if (V.hovTest != null) hov = V.hovTest;
    var hq2 = hov >= 0 ? d2.leg[hov] : null, showDet = !!hq2 && !locked0;
    if (st.hov !== hov) { st.hov = hov; st.leg.forEach(function (o, i) { var m = o.p.__m; mc(m, "_Line", i === hov ? W : mixc(H, W, 0.2), i === hov ? 1 : 0.6); m.SetFloat("_Lit", i === hov ? 1.6 : 0.2); m.SetFloat("_EdgeGlow", i === hov ? 0.3 : 0); }); }
    act(st.detN.gameObject, showDet); act(st.detD.gameObject, showDet);
    if (showDet) { setT(st.detN, hq2.name); setC(st.detN, mixc(H, W, 0.6), 1); setT(st.detD, hq2.desc || hq2.kind); }
    act(st.rNextH.gameObject, !locked0 && !showDet); setT(st.rNext, locked0 || showDet ? "" : F.next || ""); setT(st.rWorn, locked0 || showDet ? "" : F.worn || "");
  };

  // ---- the hero's sheet: its numbers against the roster's best, its Legacy skills and talent, whether it has a video ----
  var SHEET = {}, BEST = null;
  // a Legacy or talent icon by name, through the mods' sprite aliases (ModRegistry.spriteAlias, the table bbee-sdk's
  // LoadSprite hook reads): C.spriteOf asks the atlas directly, so a mod hero's IconSkill_/Talent_ names never resolved
  var ICONS = {};
  function iconOf(atlas, name) {
    var key = name; if (ICONS[key] !== undefined) return ICONS[key];
    var sp = null;
    try {
      var A = require("Example").ModRegistry.spriteAlias, a = A && A[name];
      if (a && a.indexOf("tex:") === 0) {
        var tx = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Texture2D), a.slice(4));
        if (tx && !tx.Equals(null)) sp = UE.Sprite.Create(tx, new UE.Rect(0, 0, tx.width, tx.height), new UE.Vector2(0.5, 0.5), 100);
      } else if (a) { if (a.indexOf("|") >= 0) { var q = a.split("|"); atlas = q[0]; name = q[1]; } else name = a; }
    } catch (e) { sp = null; }
    if (!sp && V.C && V.C.spriteOf) sp = V.C.spriteOf([atlas, name]);
    return (ICONS[key] = sp || null);
  }
  function txtOf(v) { return String(v || "").replace(/<[^>]*>/g, "").replace(/\{[^{}]*\}/g, "").replace(/\s+/g, " ").trim(); }
  // the first three numbers in the order the game's own hero page reads them: Health, Attack, MP
  function attrOf(id) { var o = {}; try { var a = require("Gen/Xlsx").Xlsx.BaseActorAttrConf.Get(id); var l = a && a.attr || []; if (l[0]) o.MaxHp = l[0].value; if (l[1]) o.AtkBase = l[1].value; if (l[2]) o.MaxMp = l[2].value; } catch (e) { } return o; }
  function sheetOf(id, p) {
    if (SHEET[id]) return SHEET[id];
    var sq = V.C.soonOf ? V.C.soonOf(id) : null; if (sq) return (SHEET[id] = { stats: [null, null, null], leg: [], movie: false, soon: sq.year });
    var C = V.C, U = require("Core/Util").U, X = require("Gen/Xlsx").Xlsx, d = { stats: [], leg: [], movie: false };
    if (!BEST) { BEST = { MaxHp: 1, AtkBase: 1, MaxMp: 1 }; (p.heroes || []).forEach(function (h) { var a = attrOf(h); for (var k in BEST) if (a[k] > BEST[k]) BEST[k] = a[k]; }); }
    var a = attrOf(id); ["MaxHp", "AtkBase", "MaxMp"].forEach(function (k) { d.stats.push(a[k] != null ? { v: a[k], k: Math.max(0.04, Math.min(1, a[k] / BEST[k])) } : null); });
    try {
      var c = X.BaseActorConf.Get(id);
      (c && c.inheritSkill || []).slice(0, 2).forEach(function (sid) { var nm = U.GetLocale("InheritSkill_" + sid); var ds = U.GetLocale("InheritSkillDesc_" + sid); d.leg.push({ sp: iconOf("UI/Atlas/IconSkill/IconSkill", "IconSkill_" + sid), name: nm && nm != "InheritSkill_" + sid ? nm : "Legacy skill", desc: ds && ds != "InheritSkillDesc_" + sid ? txtOf(ds) : "", kind: "Legacy skill" }); });
      var tl = c && c.talents && c.talents[0];
      if (tl) {
        var eff = 0; try { (X.BaseActorTalentQualityConf.All || []).forEach(function (q) { if (!eff && q.talentId == tl.id && q.quality == (tl.quality || 1)) eff = q.talentEffectId; }); } catch (e2) { }
        var tn = eff ? U.GetLocale("TalentEffectName_" + eff) : "", td = eff ? U.GetLocale("TalentEffectDesc_" + eff) : "";
        d.leg.push({ sp: iconOf("UI/Atlas/IconTalent/IconTalent", "Talent_" + tl.id), name: tn && tn != "TalentEffectName_" + eff ? txtOf(tn) : "Talent", desc: td && td != "TalentEffectDesc_" + eff ? txtOf(td) : "", kind: "Talent" });
      }
    } catch (e) { }
    try { d.movie = id < 190000 && U.GetSingleton(cs.NOAH.Criware.CriwareMovieManager).GetMovieDuration("HeroSelect/C_Introduction_" + id) > 0; } catch (e) { d.movie = false; }
    return (SHEET[id] = d);
  }
  function movieStop(st) { st.movOk = false; st.movId = 0; try { if (st.mv && !st.mv.Equals(null)) { st.mv.Stop(); st.mv.Release(); st.mv.ResetMovieInfo(); } } catch (e) { } }
  function movieStart(st, id) {
    st.movId = id;
    try {
      if (!st.mv || st.mv.Equals(null)) { st.mv = st.vid.gameObject.AddComponent(T(cs.NOAH.Criware.CriwareMovieAssistUI)); st.mv.Target = st.vid; }
      var mv = st.mv; mv.ResetMovieInfo(); mv.SetMovieInfoWithSubtitle("HeroSelect/C_Introduction_" + id, 1);
      try { mv.AudioOn = false; } catch (e) { }
      mv.Prepare(function () { if (st.movId === id) { st.movOk = true; st.movOkAt = UE.Time.unscaledTime; } }, function () { try { if (st.movId === id) mv.Replay(); } catch (e) { } });
      mv.Play();
    } catch (e) { if (!V.movSaid) { V.movSaid = 1; log("video: " + es(e)); } }
  }
  V.movieStop = function () { if (V.st) movieStop(V.st); };
  log("ready");
})();
