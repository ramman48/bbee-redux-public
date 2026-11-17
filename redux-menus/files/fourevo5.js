// Redux Menus: the Legacy (Evotype) step of the character select, rebuilt in the v5 select's language (the lead,
// 2026-11-10: "Rework ... the Legacy rework menu ... new positions new layout new assets new effects", then "I'd rather
// that we work on The New Legacy Menu now"). The logic stays fourlobbyevo.js's (the list, its order and filters, the
// cursor, the zones, Starting Tactics, Triple Dash & Jump, the star, the skill switch): this file only draws it, over
// that screen, which is kept unseen. Built with the select's own kit (fourselect5.js, V.K): the roster panel becomes
// the list of Evotypes on the left, the Evotype's hero stands on the stage, and what it hands down is on the right as
// nodes (power and elements, the Legacy skill, the tactics handed down, the whole build).
// The tactic picker and the Legacy skill's kit view are still the older screens: while one is open this layer steps aside.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, TMP = cs.TMPro, T = puerts.$typeof;
  var V = G.BB4E5 = {};
  var W = [1, 1, 1], INK = [0.9, 0.92, 0.96], DIM = [0.56, 0.58, 0.66], GREY = [0.62, 0.65, 0.7], AMBER = [1, 0.82, 0.48], GREEN = [0.56, 0.89, 0.6];
  function log(m) { try { B.log("FOURUI", "Legacy v5: " + m); } catch (e) {} }
  function K() { return G.BB4S5 && G.BB4S5.K; }
  function EK() { return G.BB4EVO && G.BB4EVO.K; }
  function hex(c) { return c.slice(0, 3).map(function (v) { var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return s.length < 2 ? "0" + s : s; }).join(""); }
  V.on = function (S) { return V.enabled !== false && !!(S && S.solo) && !!K() && !!EK() && !!(G.BB4S5.on && G.BB4S5.on(S)); };

  function build(S, Z) {
    var k = K(), node = k.node, plate = k.plate, label = k.label, img = k.img, V2 = k.V2, clamp = k.clamp;
    var RW = G.BB4_TESTW || UE.Screen.width * 1080 / Math.max(1, UE.Screen.height), LW = clamp(Math.round(RW * 0.3), 560, 760),   // 0.1.17 (Aneubys: the list "can be decreased to the size of the character select menu")
         RWd = clamp(Math.round(RW * 0.27), 500, 720), PAD = 30, lw = LW - 2 * PAD, rw = RWd - 2 * PAD;
    var root = node(Z.root.parent, "Legacy5", 0, 0); root.anchorMin = UE.Vector2.zero; root.anchorMax = UE.Vector2.one; root.sizeDelta = UE.Vector2.zero; root.anchoredPosition = UE.Vector2.zero;
    var st = V.st = { root: root, RW: RW, LW: LW, lw: lw, RWd: RWd, rw: rw, rows: [], top: 0, t0: UE.Time.unscaledTime };
    function gf(t) { try { if (Z.title && Z.title.font) { t.font = Z.title.font; t.fontSharedMaterial = Z.title.fontSharedMaterial; t.fontStyle = 3; } } catch (e) {} return t; }
    st.cg = root.gameObject.AddComponent(T(UE.CanvasGroup)); st.cg.alpha = 0; st.cg.blocksRaycasts = false; st.cg.interactable = false;
    st.veil = img(root, "Veil", 0, 0, RW + 80, 1200, [0.02, 0.012, 0.03], 0.985);
    // the stage: the splash-art mosaic and the Evotype's hero on the floor
    var cwid = RW - LW - RWd, cx = (LW - RWd) / 2; st.cx = cx;
    var m = k.mats();
    // a flat bar (an element's share): a plate with no edge, sized and coloured each time it changes
    function bar(par, name, h) { var s = plate(par, name, 0, 0, 10, h, { alpha: 0, lineA: 0, weave: 0, lit: 0 }); s.rectTransform.pivot = V2(0, 0.5); s.__m.SetFloat("_Rim", 0); return s; }
    st.barSet = function (s, x, y, w, h, c, a) { var kk = Math.round(x) + ":" + Math.round(y) + ":" + Math.round(w) + ":" + c[0].toFixed(2) + c[1].toFixed(2) + c[2].toFixed(2) + ":" + a; if (s.__bk === kk) return; s.__bk = kk; s.rectTransform.anchoredPosition = V2(x, y); s.rectTransform.sizeDelta = V2(w, h); s.__m.SetVector("_Size", new UE.Vector4(w, h, 0, 0)); k.mc(s.__m, "_Fill", c, a); };
    st.tri = img(root, "TriField", cx, 0, cwid, 1080, W, 0);
    if (m.T) { var tm = new UE.Material(m.T); st.tri.material = tm; st.tri.__m = tm; tm.SetFloat("_Aspect", cwid / 1080); tm.SetFloat("_Base", 0.24); tm.SetFloat("_Mark", 0.8); tm.SetFloat("_Bottom", 0.08); tm.SetFloat("_GradLo", -1.25); tm.SetFloat("_GradHi", 0.05); } else st.tri.enabled = false;
    function sfx(name, front) { var im = img(root, name, cx, 0, cwid, 1080, W, 0); if (m.S) { var mm = new UE.Material(m.S); im.material = mm; im.__m = mm; mm.SetFloat("_Aspect", cwid / 1080); mm.SetFloat("_Front", front ? 1 : 0); } else im.enabled = false; return im; }
    st.fxB = sfx("StageFxBack", false);
    // 0.1.17 (Aneubys, 2026-11-11, after DRAGON BALL FighterZ's select): a Legacy that is set stands in the background,
    // Legacy I in the left half of the stage and Legacy II in the right, each fading out at its edges (a soft mask); the
    // Evotype under the cursor stands in front as before
    st.bg = [0, 1].map(function (i) {
      var bx = cx + (i ? 1 : -1) * cwid / 4, mrt = node(root, "BgMask" + i, bx, 52, cwid / 2 + 40, 976), mk = mrt.gameObject.AddComponent(T(UI.RectMask2D));
      try { mk.softness = new UE.Vector2Int(Math.round(cwid * 0.13), 70); } catch (e) {}
      var rt = node(mrt, "BgArt" + i, 0, 0, 600, 900), ri = rt.gameObject.AddComponent(T(UI.RawImage)); ri.raycastTarget = false; ri.color = k.col(W, 0);
      var lb = label(root, "BgLabel" + i, bx, 486, cwid / 2 - 40, 26, 18, DIM, TMP.TextAlignmentOptions.Center, "display"); lb.characterSpacing = 4;
      return { ri: ri, lb: lb, uid: undefined, has: false };
    });
    // the hero stands behind the stage floor: a mask ends at the floor's top edge (the testers: the art must not lie over the stage)
    var am0 = node(root, "ArtMask", cx, 52, cwid, 976); am0.gameObject.AddComponent(T(UI.RectMask2D)); st.maskY = 52;
    var art = node(am0, "Art", 0, 0, 600, 900); st.art = art.gameObject.AddComponent(T(UI.RawImage)); st.art.raycastTarget = false; st.art.color = k.col(W, 0);
    if (m.A) { var am = new UE.Material(m.A); st.art.material = am; st.art.__m = am; am.SetFloat("_RimW", 0.003); am.SetFloat("_RimPulse", 0); am.SetFloat("_Sheen", 0.25); }
    st.fxF = sfx("StageFxFront", true);
    st.goP = plate(root, "StartRun", cx, -372, 440, 96, { bracket: 14, cut: [18, 0, 18, 0], alpha: 0.95 });
    st.goT = gf(label(root, "StartRunT", cx, -372, 420, 56, 44, W, TMP.TextAlignmentOptions.Center, "display"));
    // with no Evotype on the stage the two lines stand on the mosaic: a plate behind them keeps them readable
    st.noneP = plate(root, "NoneP", cx, 4, Math.min(cwid - 60, 900), 200, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.9 }); st.noneP.gameObject.SetActive(false);
    st.none = gf(label(root, "None", cx, 40, Math.min(cwid - 100, 860), 80, 64, INK, TMP.TextAlignmentOptions.Center, "display"));
    st.none.enableAutoSizing = true; st.none.fontSizeMin = 26; st.none.fontSizeMax = 64;   // at 16:9 "STARTING TACTICS" was wider than the stage
    st.noneSub = label(root, "NoneSub", cx, -34, Math.min(cwid - 120, 820), 64, 24, INK, TMP.TextAlignmentOptions.Center, "body"); st.noneSub.enableWordWrapping = true;
    // ---- left: the header, the two rows of chips, the list
    var lp = st.lp = node(root, "List", -RW / 2 + LW / 2, 0, LW, 1080);
    st.lpP = plate(lp, "Panel", -12, 0, LW + 24, 1128, { alpha: 0.93 });
    function hexField(par, w) { var im = img(par, "HexField", 0, 0, w, 1080, W, 0); if (m.H) { var mh = new UE.Material(m.H); im.material = mh; im.__m = mh; mh.SetFloat("_Aspect", w / 1080); mh.SetFloat("_Scale", 24); mh.SetFloat("_MaskA", 0.5); mh.SetFloat("_MaskB", 0.02); } else im.enabled = false; return im; }
    st.lHex = hexField(lp, LW);
    st.title = gf(label(lp, "Title", -lw / 2 + 260, 492, 520, 60, 50, W, null, "display"));
    st.sub = label(lp, "Sub", 0, 448, lw, 30, 21, DIM, null, "body"); st.sub.richText = true;
    st.count = label(lp, "Count", 0, 492, lw, 30, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    st.chipsA = []; st.chipsB = [];
    st.fsum = label(lp, "FilterSum", 0, 0, lw, 28, 19, DIM, null, "body"); st.fsum.richText = true;
    st.chip = function (arr, i) {
      while (arr.length <= i) { var q = arr.length, p = plate(lp, "Chip" + (arr === st.chipsA ? "A" : "B") + q, 0, 0, 120, 42, { cut: [9, 0, 9, 0], alpha: 0.9 }), t = label(lp, "ChipT" + (arr === st.chipsA ? "A" : "B") + q, 0, 0, 200, 36, 19, INK, TMP.TextAlignmentOptions.Center, "display"); t.richText = true; arr.push({ p: p, t: t }); }
      return arr[i];
    };
    st.rh = 78; st.listTop = 296; st.rv = Math.max(3, Math.floor((st.listTop + 392) / (st.rh + 8)));   // the list ends above the EQUIPPED lines
    st.grid = node(lp, "Rows", 0, 0, 100, 100);
    st.rail = img(lp, "Rail", lw / 2 + 12, 0, 3, 60, W, 0);
    st.row = function (i) {
      while (st.rows.length <= i) {
        var q = st.rows.length, rt = node(st.grid, "Row" + q, 0, 0, lw, st.rh), g = rt.gameObject.AddComponent(T(UE.CanvasGroup)), b = { rt: rt, g: g, f: 0, h: 0, key: null };
        b.p = plate(rt, "P", 0, 0, lw, st.rh, { cut: [12, 0, 12, 0], alpha: 0.9, weave: 0.05 });
        var hd = node(rt, "Head", -lw / 2 + 44, 0, 64, 64); b.head = hd.gameObject.AddComponent(T(UI.Image)); b.head.preserveAspect = true; b.head.raycastTarget = false;
        var pm = node(rt, "PortMask", -lw / 2 + 44, 0, 66, 66); pm.gameObject.AddComponent(T(UI.RectMask2D)); b.portM = pm.gameObject;
        var po = node(pm, "Port", 0, 0, 66, 66); b.port = po.gameObject.AddComponent(T(UI.RawImage)); b.port.raycastTarget = false; b.portM.SetActive(false);
        var nw = lw * 0.46;
        b.name = label(rt, "Name", -lw / 2 + 90 + nw / 2, 14, nw, 36, 27, INK, null, "body"); b.name.richText = true; b.name.overflowMode = TMP.TextOverflowModes.Ellipsis; b.name.enableAutoSizing = true; b.name.fontSizeMin = 17; b.name.fontSizeMax = 27;
        b.sub = label(rt, "Sub", -lw / 2 + 90 + nw / 2, -18, nw, 26, 18, DIM, null, "bodyR"); b.sub.richText = true;
        b.els = label(rt, "Els", lw * 0.13, 14, lw * 0.27, 30, 20, INK, null, "body"); b.els.richText = true; b.els.enableWordWrapping = false; b.els.overflowMode = TMP.TextOverflowModes.Ellipsis;
        b.tac = [0, 1].map(function (z) { var ic = img(rt, "Tac" + z, lw / 2 - 176 + z * 56, 0, 46, 46, W, 0); ic.preserveAspect = true; return ic; });
        b.sk = img(rt, "Skill", lw / 2 - 48, 8, 40, 40, W, 0); b.sk.preserveAspect = true;
        b.lv = label(rt, "Lv", lw / 2 - 48, -24, 80, 22, 16, [0.44, 0.99, 1], TMP.TextAlignmentOptions.Center, "display");
        st.rows.push(b);
      }
      return st.rows[i];
    };
    st.pp = plate(lp, "Popup", 0, 0, 200, 100, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.97 }); st.ppT = label(lp, "PopupT", 0, 0, 400, 28, 20, W, TMP.TextAlignmentOptions.Center, "display"); st.ppT.characterSpacing = 4;
    st.ppN = label(lp, "PopupName", 0, 0, 400, 34, 23, W, null, "body"); st.ppN.richText = true; st.ppN.enableWordWrapping = false; st.ppN.overflowMode = TMP.TextOverflowModes.Ellipsis;
    st.ppF = label(lp, "PopupFoot", 0, 0, 400, 84, 19, DIM, TMP.TextAlignmentOptions.TopLeft, "bodyR"); st.ppF.enableWordWrapping = true;
    // 0.1.17 (Fury, 2026-11-11: "The menu lacks information for which starting skills and legacy tactics you have
    // equipped"): one line each for Legacy I, Legacy II and the Starting Tactics, under the list
    st.eqP = plate(lp, "Equip", 0, -472, lw + 36, 124, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.93 });
    st.eqH = label(lp, "EquipH", -lw / 2 + 150, -428, 300, 26, 18, W, null, "display"); st.eqH.characterSpacing = 4; k.setT(st.eqH, "// EQUIPPED");
    st.eq = [0, 1, 2].map(function (i) { var t = label(lp, "Equip" + i, 0, -456 - i * 26, lw, 26, 17, INK, null, "body"); t.richText = true; t.overflowMode = TMP.TextOverflowModes.Ellipsis; return t; });
    st.pcells = [];
    st.pcell = function (i) {
      while (st.pcells.length <= i) {
        var q = st.pcells.length, rt = node(lp, "PopCell" + q, 0, 0, 78, 78), c = { rt: rt, key: null };
        c.p = plate(rt, "P", 0, 0, 78, 78, { cut: [9, 0, 9, 0], alpha: 0.9 });
        var hd = node(rt, "Head", 0, 0, 66, 66); c.head = hd.gameObject.AddComponent(T(UI.Image)); c.head.preserveAspect = true; c.head.raycastTarget = false;
        var pm = node(rt, "PortMask", 0, 0, 68, 68); pm.gameObject.AddComponent(T(UI.RectMask2D)); c.portM = pm.gameObject;
        var po = node(pm, "Port", 0, 0, 68, 68); c.port = po.gameObject.AddComponent(T(UI.RawImage)); c.port.raycastTarget = false; c.portM.SetActive(false);
        c.t = label(rt, "T", 0, 0, 330, 40, 20, INK, TMP.TextAlignmentOptions.Center, "display");
        st.pcells.push(c);
      }
      return st.pcells[i];
    };
    // ---- right: what the Evotype hands down, as nodes
    var rp = st.rp = node(root, "Sheet", RW / 2 - RWd / 2, 0, RWd, 1080);
    st.nodes = [];
    st.rHex = hexField(rp, RWd); if (st.rHex.__m) st.rHex.__m.SetFloat("_Phase", 11);
    function nodeBox(name, top, bot) { var p2 = plate(rp, name, 0, (top + bot) / 2, rw + 36, top - bot, { bracket: 12, cut: [14, 0, 14, 0], alpha: 0.93 }); st.nodes.push(p2); return p2; }
    function head(name, y, s) { var h = label(rp, name, -rw / 2 + 150, y, 300, 28, 20, W, null, "display"); h.characterSpacing = 4; k.setT(h, s); return h; }
    nodeBox("NodeName", 522, 340);
    st.heads = [head("H0", 498, "// EVOTYPE")];
    st.rStep = label(rp, "Step", 0, 498, rw, 28, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    st.rName = gf(label(rp, "Name", 0, 430, rw, 80, 62, W, null, "display")); st.rName.enableAutoSizing = true; st.rName.fontSizeMin = 26; st.rName.fontSizeMax = 62;
    st.rPow = label(rp, "Power", rw / 4, 366, rw / 2, 34, 26, AMBER, TMP.TextAlignmentOptions.Right, "display");
    st.rUse = label(rp, "Use", -rw / 4, 366, rw / 2, 34, 22, GREEN, null, "body");
    nodeBox("NodeEl", 326, 196);
    st.heads.push(head("H1", 302, "// TACTICS BY ELEMENT"));
    st.seg = [0, 1, 2, 3, 4, 5].map(function (z) { return bar(rp, "ElSeg" + z, 14); });
    st.leg = [0, 1, 2, 3].map(function (z) { return label(rp, "ElT" + z, -rw / 2 + rw / 8 + z * rw / 4, 226, rw / 4, 26, 18, INK, null, "body"); });
    nodeBox("NodeSkill", 182, -18);
    st.heads.push(head("H2", 158, "// LEGACY SKILL"));
    st.skP = plate(rp, "SkP", -rw / 2 + 36, 104, 64, 64, { cut: [8, 0, 8, 0], alpha: 0.92 });
    st.skI = img(rp, "SkI", -rw / 2 + 36, 104, 54, 54, W, 0); st.skI.preserveAspect = true;
    st.skN = label(rp, "SkN", 40, 104, rw - 84, 40, 24, W, null, "body"); st.skN.richText = true; st.skN.enableWordWrapping = false; st.skN.enableAutoSizing = true; st.skN.fontSizeMin = 13; st.skN.fontSizeMax = 24;
    st.skD = label(rp, "SkD", 0, 24, rw, 76, 19, INK, TMP.TextAlignmentOptions.TopLeft, "bodyR"); st.skD.enableWordWrapping = true; st.skD.enableAutoSizing = true; st.skD.fontSizeMin = 12; st.skD.fontSizeMax = 19; st.skD.richText = true;
    nodeBox("NodeTac", -32, -218);
    st.heads.push(head("H3", -56, "// HANDED DOWN")); st.heads[3].enableAutoSizing = true; st.heads[3].fontSizeMin = 13; st.heads[3].fontSizeMax = 20;
    st.kept = [0, 1].map(function (z) {
      var y = -106 - z * 62, o = {};
      o.ic = img(rp, "KeptI" + z, -rw / 2 + 30, y, 52, 52, W, 0); o.ic.preserveAspect = true;
      o.n = label(rp, "KeptN" + z, 34, y + 12, rw - 76, 30, 22, INK, null, "body"); o.n.overflowMode = TMP.TextOverflowModes.Ellipsis;
      o.e = label(rp, "KeptE" + z, 34, y - 14, rw - 76, 24, 17, DIM, null, "bodyR");
      return o;
    });
    nodeBox("NodeBuild", -232, -452);   // ends above the prompt row, which lay over the third row of icons
    st.heads.push(head("H4", -256, "// THE WHOLE BUILD"));
    st.bN = label(rp, "BuildN", 0, -256, rw, 28, 20, DIM, TMP.TextAlignmentOptions.Right, "body");
    var bc = Math.max(6, Math.floor(rw / 58)), bs = rw / bc; st.build = [];
    for (var z2 = 0; z2 < bc * 4; z2++) { var bi = img(rp, "B" + z2, -rw / 2 + bs / 2 + (z2 % bc) * bs, -306 - Math.floor(z2 / bc) * 56, 48, 48, W, 0); bi.preserveAspect = true; st.build.push(bi); }
    log("built: RW " + Math.round(RW) + ", list " + LW + ", rows " + st.rv);
    return st;
  }

  // what a popup holds: the order (two lines), the heroes these Evotypes are of (All, then a square each), the elements
  V.items = function (Z) {
    var e = EK(), C5 = G.BB4S5.C;
    if (V.pop == "power") return [{ s: "Strongest to weakest", on: Z.sort == "power", v: "power" }, { s: "Weakest to strongest", on: Z.sort == "weak", v: "weak" }];
    if (V.pop == "hero") return [{ s: "ALL", on: !Z.f.heroSet, all: true }].concat((Z.heroes || []).filter(function (h) { return h > 0; }).map(function (h) { return { id: h, s: C5.heroLabelOf(h), on: !Z.f.heroSet || !!Z.f.heroSet[h] }; }));
    if (V.pop == "start") { var bp = e.bpfree(), have = bp ? bp.picks() : [], tabs = V.tabs(Z), tab = V.tabOf(tabs);
      // 0.1.21 (the lead, 2026-11-12: "Any Tactic"): the chips are the elements; under the one chosen, every Tactic of
      // that element the game has. A two-element Tactic (the red ones) sits under both of its elements, with no tab of
      // its own as the game's Tactics screen gives it (Fury, 2026-11-12)
      var chips = tabs.map(function (el) { return { id: el, s: e.elName(el), on: el == tab, tab: true, col: e.elCol(el) }; }).concat([{ s: "CLEAR", on: !have.length, all: true, tab: true }]);
      return chips.concat(V.pool(Z).filter(function (id) { return e.seriesOf(id).indexOf(tab) >= 0; }).map(function (id) {
        var sr = e.seriesOf(id), names = []; sr.forEach(function (x) { var n = e.elName(x); if (names.indexOf(n) < 0) names.push(n); });
        return { id: id, s: e.blessName(id), on: have.indexOf(id) >= 0, tac: true, col: sr.length > 1 ? (e.QC && e.QC[5]) || [1, 0.3, 0.45] : sr.length ? e.elCol(sr[0]) : null, els: names.join(" + ") + (sr.length > 1 ? "   two-element" : "") }; })); }
    if (V.pop == "el") return [{ s: "All", on: !Z.f.elSet, all: true }].concat(Object.keys(Z.els || {}).map(function (x) { return { id: x | 0, s: e.elName(x | 0) + "  " + Z.els[x], on: !Z.f.elSet || !!Z.f.elSet[x], col: e.elCol(x | 0) }; }));
    return [];
  };
  // 0.1.21: every Tactic on the game's own Tactics screen (BlessScreenGridConf, the mods' rows included) and any the
  // player's Evotypes hold that the screen leaves out, by id. Before 0.1.21 only what the Evotypes held was offered
  // (the lead, 2026-11-11: "From my Evotypes"; 2026-11-12: "Any Tactic").
  V.pool = function (Z) {
    var e = EK(), l = Z.list || [], key = "all:" + l.length + ":" + (Z.n || 0); if (V.poolKey === key && V.poolList) return V.poolList;
    var seen = {}, out = [];
    try { var rows = require("Gen/Xlsx").Xlsx.BlessScreenGridConf.All || []; for (var g = 0; g < rows.length; g++) { var bid = rows[g].blessId || rows[g].BlessId; if (bid && !seen[bid] && e.seriesOf(bid).length) { seen[bid] = 1; out.push(bid); } } }
    catch (x) { log("the Tactics screen's table could not be read: " + x); }
    for (var j = 1; j < l.length; j++) { if (!l[j]) continue; e.tactics(l[j]).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } }); }
    out.sort(function (a, b) { return a - b; });
    V.poolKey = key; return (V.poolList = out);
  };
  // the element chips: every element the pool's Tactics belong to, in the game's order; Dual (9) gets no chip of its own
  V.tabs = function (Z) { var e = EK(), seen = {}, out = []; V.pool(Z).forEach(function (id) { e.seriesOf(id).forEach(function (s) { if (s != 9 && !seen[s]) { seen[s] = 1; out.push(s); } }); }); out.sort(function (a, b) { return a - b; }); return out; };
  V.tabOf = function (tabs) { if (tabs.indexOf(V.tab) < 0) V.tab = tabs[0] || 0; return V.tab; };
  V.TW = 92; V.TH = 34; V.TPW = 62;   // an element chip's size in the Free Choice popup, and a Tactic tile's width
  V.tcols = function (nt, pc) { return Math.max(1, Math.min(nt, Math.floor((pc * (V.TPW + 8)) / (V.TW + 6)))); };   // chips per row: as many as the grid is wide
  V.cols = function (kind) { return kind == "hero" ? 6 : kind == "el" ? 3 : kind == "start" ? Math.max(6, Math.floor(((V.st ? V.st.lw : 640) - 28) / 70)) : 1; };
  V.startOn = function () { try { var b = EK().bpfree(); return !!b && b.count() > 0; } catch (x) { return false; } };
  V.open = function (kind) { V.pop = kind; V.pcur = 0; V.popAt = UE.Time.unscaledTime; try { EK().tick(); } catch (x) {} };
  V.choose = function (S, Z) {
    var e = EK(), it = V.items(Z)[V.pcur]; if (!it) return;
    if (V.pop == "start") {
      var bp = e.bpfree(), have = bp.picks(); V.msg = "";
      if (it.tab && !it.all) { V.tab = it.id; try { e.tick(); } catch (x) {} return; }
      if (it.all) have = []; else if (have.indexOf(it.id) >= 0) have.splice(have.indexOf(it.id), 1);
      else if (have.length >= (bp.max || 4)) V.msg = "You can pick up to four. Take one off first.";
      else { var clash = null; try { var BU = require("GamePlay/BattleBreedPrepare/BattlePrepareBlessUtil").default; have.forEach(function (o) { if (clash == null && BU.CheckBlessMutualExclusion({ id: o }, { id: it.id })) clash = o; }); } catch (x) {}
        if (clash != null) V.msg = "Cannot be taken together with " + e.blessName(clash) + "."; else have.push(it.id); }
      bp.set(have); try { e.tick(); } catch (x) {} return;
    }
    if (V.pop == "power") { e.setSort(Z, it.v); V.pop = null; }
    else { var key = V.pop == "hero" ? "heroSet" : "elSet", set = Z.f[key];
      if (it.all) set = null; else { if (!set) set = {}; if (set[it.id]) delete set[it.id]; else set[it.id] = 1; if (!Object.keys(set).length) set = null; }
      Z.f[key] = set; }
    e.refresh(S); try { e.tick(); } catch (x) {}
  };
  // the bar's buttons by drawn line, top line first, each line left to right (indices into V.BAR); chipRow in V.frame
  // puts every button's centre on its plate (cx, cy). Before the first frame the bar counts as one line.
  V.barLines = function (st, BAR) {
    var by = {}, ys = [];
    BAR.forEach(function (c, i) {
      var q = st && st.chipsA ? st.chipsA[i] : null, y = q && q.cy != null ? Math.round(q.cy) : 0;
      if (!by[y]) { by[y] = []; ys.push(y); } by[y].push(i);
    });
    ys.sort(function (a, b) { return b - a; });
    return ys.map(function (y) { return by[y].sort(function (a, b) { var qa = st.chipsA[a], qb = st.chipsA[b]; return (qa && qa.cx != null ? qa.cx : a) - (qb && qb.cx != null ? qb.cx : b); }); });
  };
  // one pad move on the bar: the new index, "list" (down from the last line), or null (nowhere to go)
  V.barMove = function (st, BAR, cur, dx, dy) {
    var L = V.barLines(st, BAR), li = -1, pi = -1;
    L.forEach(function (ln, a) { var k = ln.indexOf(cur); if (k >= 0) { li = a; pi = k; } });
    if (li < 0) return BAR.length ? 0 : null;
    if (dx) { var j = Math.max(0, Math.min(L[li].length - 1, pi + (dx > 0 ? 1 : -1))); return L[li][j]; }
    if (!dy) return null;
    var nl = dy < 0 ? li + 1 : li - 1;
    if (nl >= L.length) return "list";
    if (nl < 0) return null;
    var cx = function (i) { var q = st.chipsA[i]; return q && q.cx != null ? q.cx : 0; }, x0 = cx(cur), best = L[nl][0];
    L[nl].forEach(function (i) { if (Math.abs(cx(i) - x0) < Math.abs(cx(best) - x0)) best = i; });
    return best;
  };
  // the bar and the popups answer the pad and the keyboard here (fourlobbyevo.js asks first); null leaves it to that file
  V.input = function (S, kind, dx, dy) {
    var st = V.st, Z = G.BB4EVO.Z, e = EK(); if (!st || !st.shown || !Z || Z.picker) return null;
    if (V.pop) {
      var items = V.items(Z), pc = V.cols(V.pop);
      if (kind == "move" && V.pop == "start") {
        // the chips are one row above the grid: left and right walk the chips, down goes to the grid, up from the grid's
        // first row goes back to the lit chip
        var nt = items.filter(function (q) { return q.tab; }).length, n2 = V.pcur, ng = items.length - nt, tc = V.tcols(nt, pc);
        if (V.pcur < nt) { if (dx) n2 = Math.max(0, Math.min(nt - 1, V.pcur + dx)); else if (dy > 0) { if (V.pcur - tc >= 0) n2 = V.pcur - tc; } else if (dy < 0) n2 = V.pcur + tc < nt ? V.pcur + tc : ng > 0 ? nt : V.pcur; }
        else { var gi = V.pcur - nt;
          if (dx) n2 = nt + Math.max(0, Math.min(ng - 1, gi + dx));
          else if (dy > 0) { if (gi < pc) { n2 = 0; for (var q2 = 0; q2 < nt; q2++) if (items[q2].on && !items[q2].all) n2 = q2; } else n2 = V.pcur - pc; }
          else if (dy < 0 && gi + pc < ng) n2 = V.pcur + pc; }
        if (n2 != V.pcur) { V.pcur = n2; e.tick(); }
      }
      else if (kind == "move") { var n = V.pcur + (dx || 0) + (dy ? (dy > 0 ? -pc : pc) : 0); if (n >= 0 && n < items.length && n != V.pcur) { V.pcur = n; e.tick(); } }
      else if (kind == "press") V.choose(S, Z);
      else if (kind == "back") V.pop = null;
      return true;
    }
    var p = S.pick;
    if (Z.zone == "go") {
      if (kind == "press") { try { S.v5Start(); } catch (x) {} } else if (kind == "back" || (kind == "move" && (dx < 0 || dy))) { Z.zone = "list"; e.tick(); }
      return true;
    }
    if (Z.zone == "list") {
      if (kind == "move" && dx > 0) { Z.zone = "go"; e.tick(); return true; }
      // up from the list's first row comes back to the bar's last line (0.1.22), its first button
      if (kind == "move" && dy > 0 && !dx && Z.cur == 0) { var lastL = V.barLines(st, V.BAR || []); if (lastL.length) { Z.zone = "sort"; Z.fcur = lastL[lastL.length - 1][0]; e.tick(); return true; } }
      if (kind == "press") {   // a row only sets this Legacy: the run starts from the Start Run button alone
        var ee = p.list[Z.view[Z.cur]] || null;   // 0.1.19: Free Choice keeps the Legacies (their skills and talents); only the tactics they hand down are replaced
        if (p.step == "evo2") p.evo2 = ee; else { p.evo = ee; if (!ee || (p.evo2 && (p.evo2.uid == ee.uid || p.evo2.id == ee.id))) p.evo2 = null; }
        Z.zone = "go";   // 0.1.21 (Boogy, 2026-11-12): once a Legacy is chosen the cursor moves to Start Dive by itself, as the stock game's does; left or up comes back to the list
        // 0.1.26 (Kirin, 2026-11-16): a first Legacy moves on to the second one by itself, as the stock screen and the solo pick did;
        // the cursor goes to Start Dive after the second, or at once when no second Legacy is left to choose
        if (p.step == "evo1" && p.evo && p.evos.filter(function (q) { return q.id != p.hero && q.id != p.evo.id; }).length && S.v5Step("evo2")) Z.zone = "list";
        st.setAt = st.burstAt = UE.Time.unscaledTime;
        try { if (G.BB4SEL) G.BB4SEL.sfx("sfx_ui_53"); } catch (x) {} return true;
      }
      return null;
    }
    var BAR = V.BAR || [];
    if (kind == "move") {
      // 0.1.22 (Sansy, 2026-11-14: "these buttons wont get selected with controller, from triple dash to any skill; it goes
      // from legacy I to no legacy"): the bar wraps onto several lines, but down left it for the list from any button.
      // Now the pad walks the lines as they are drawn: down and up go to the nearest button on the next line, left and
      // right stay on the line, and only down from the last line goes to the list.
      var was = Z.fcur | 0, to = V.barMove(st, BAR, was, dx, dy);
      if (to == "list") { Z.zone = "list"; Z.cur = Math.max(0, Math.min(Z.view.length - 1, st.top | 0)); }
      else if (to != null) Z.fcur = to;
      if (was != Z.fcur || Z.zone == "list") e.tick(); return true;
    }
    if (kind == "back") { Z.zone = "list"; return true; }
    if (kind == "press") {
      var it = BAR[Z.fcur | 0]; if (!it) return true;
      if (it.k == "slot1" || it.k == "slot2") { if (!S.v5Step(it.k == "slot1" ? "evo1" : "evo2")) { try { G.BB4SEL.sfx("sfx_ui_13"); } catch (x) {} } else Z.zone = "list"; return true; }
      if (it.k == "power" || it.k == "hero" || it.k == "el") { V.open(it.k); return true; }
      if (it.k == "start") { var bp0 = e.bpfree(); if (bp0 && bp0.set && bp0.picks) { V.msg = ""; V.open("start"); return true; } }
      var chip = it.k == "triple" ? Z.sortChips.filter(function (c) { return c.triple; })[0] : it.k == "start" ? Z.sortChips.filter(function (c) { return c.start; })[0] : it.k == "tac" ? Z.tacChip : Z.skillChip;
      if (chip) e.act(S, chip);
      return true;
    }
    return null;
  };
  V.vis = function (S, Z, on) {
    var st = V.st;
    if (!st) { if (!on) return; try { st = build(S, Z); } catch (e) { log("build: " + e + String(e.stack).slice(0, 300)); V.enabled = false; return; } }
    if (!st.root || st.root.Equals(null)) { V.st = null; return; }
    if (st.root.gameObject.activeSelf != !!on) st.root.gameObject.SetActive(!!on);
    if (on && !st.shown) { st.shown = true; st.openAt = UE.Time.unscaledTime; st.root.SetSiblingIndex(Z.root.GetSiblingIndex() + 1); st.forId = undefined; try { S.promptT.SetAsLastSibling(); if (S.verT) S.verT.SetAsLastSibling(); } catch (e) {} }
    if (!on) { st.shown = false; V.pop = null; }
    try { if (G.BB4S5 && G.BB4S5.avatarKeep) G.BB4S5.avatarKeep(!!on); } catch (e) {}
  };

  V.frame = function (S, Z, ev, pr, inUse, two, t) {
    var st = V.st; if (!st || !st.shown) return;
    var k = K(), e = EK(), C5 = G.BB4S5.C, mixc = k.mixc, tintD = k.tintD, mc = k.mc, setT = k.setT, setC = k.setC, pos = k.pos, act = k.act, ease = k.ease, V2 = k.V2;
    var p = S.pick, l = p.list, o = ease((t - st.openAt) / 0.3); st.cg.alpha = Z.a * o;
    var H = e.groupCol(p.hero), lum = 0.3 * H[0] + 0.59 * H[1] + 0.11 * H[2], HP = mixc(mixc(H, [lum, lum, lum], 0.3), W, 0.22), hk = hex(H);
    var cm = false; try { cm = B.opt("fx") == "calm"; } catch (ec) {}
    pos(st.lp, -st.RW / 2 + st.LW / 2 - 70 * (1 - o), 0); pos(st.rp, st.RW / 2 - st.RWd / 2 + 70 * (1 - o), 0);
    var gi = e.groupIdx(p.hero), bu = st.burstAt != null ? (t - st.burstAt) / 0.7 : 2;
    [st.fxB, st.fxF].forEach(function (x, i) { if (!x.__m) return; if (st.fxMode !== gi) x.__m.SetFloat("_Mode", gi); x.__m.SetColor("_Hot", k.col(mixc(HP, W, 0.5), 1)); x.__m.SetFloat("_Burst", bu > 0 && bu < 1 && !cm ? bu : 0); x.__m.SetFloat("_BurstAmp", 0.7); setC(x, HP, cm ? 0 : o * (i ? 0.45 : gi == 3 ? 0.42 : 0.5)); });
    st.fxMode = gi;
    [st.lHex, st.rHex].forEach(function (x) { if (!x.__m) return; x.__m.SetColor("_Hot", k.col(mixc(H, W, 0.6), 1)); setC(x, HP, cm ? 0 : o * 0.3); });
    // the mouse
    var mnow = null, mlive = false, click = false;
    try { var m0 = UE.Input.mousePosition, mk0 = Math.round(m0.x) + ":" + Math.round(m0.y); if (st.mK == null) { st.mK = mk0; st.mAt = -1e9; } else if (st.mK !== mk0) { st.mK = mk0; st.mAt = t; }
      mlive = t - st.mAt < 3; mnow = V2(m0.x, m0.y); if (V.pend) { click = true; mnow = V2(V.pend[0], V.pend[1]); mlive = true; V.pend = null; }
      if (st.cam === undefined) { var cvm = st.root.GetComponentInParent(T(UE.Canvas)); cvm = cvm ? cvm.rootCanvas : null; st.cam = cvm && +cvm.renderMode !== 0 ? cvm.worldCamera : null; } } catch (em) { mlive = false; }
    function over(rt2) { try { return mlive && UE.RectTransformUtility.RectangleContainsScreenPoint(rt2, mnow, st.cam); } catch (e9) { return false; } }
    // panels and nodes in the group's colour; the node under the mouse lights
    if (st.hk !== hk) { st.hk = hk; mc(st.lpP.__m, "_Fill", tintD(H, 0.06, 0.6), 0.94); mc(st.lpP.__m, "_Line", mixc(H, W, 0.15), 0.65); st.heads.forEach(function (h) { setC(h, mixc(H, W, 0.3), 1); }); mc(st.skP.__m, "_Fill", tintD(H, 0.1, 0.85), 0.92); mc(st.skP.__m, "_Line", mixc(H, W, 0.2), 0.6); st.rows.forEach(function (b) { b.key = null; }); st.chipK = null; }
    st.nodes.forEach(function (pl) {
      var hv = over(pl.rectTransform) ? 1 : 0; pl.__h = (pl.__h || 0) + (hv - (pl.__h || 0)) * 0.25; var hq = Math.round(pl.__h * 20) / 20;
      if (pl.__hq !== hq + ":" + hk) { pl.__hq = hq + ":" + hk; var m9 = pl.__m; mc(m9, "_Fill", tintD(H, 0.06, 0.6), 0.94); mc(m9, "_Line", mixc(mixc(H, W, 0.15), W, 0.55 * hq), 0.65 + 0.35 * hq); mc(m9, "_BracketColor", mixc(H, W, 0.3), 0.9); m9.SetFloat("_EdgeGlow", 0.22 * hq); m9.SetFloat("_Run", hq > 0.5 ? 1 : 0); m9.SetFloat("_RunSpeed", 110); m9.SetFloat("_RunLen", 90); mc(m9, "_Accent", H, 1); }
    });
    // header
    var filt = Z.f.el || Z.f.hero || Z.f.tactic || Z.f.skill;
    setT(st.title, two ? "LEGACY II" : "LEGACY I");
    setT(st.sub, "for " + C5.heroLabelOf(p.hero) + "   ·   " + (filt ? (Z.view.length - 1) + " of " + Z.n : Z.n) + (Z.n == 1 ? " Evotype" : " Evotypes") + (filt ? "   ·   <color=#ffd27a>filtered</color>" : "") + "   ·   " + e.sortLine(Z));
    // chips: the first row is the screen's switches and its order, the second its filters; the same indices as the logic's
    function chipRow(arr, src, y, zone, text, isOn, tint) {
      var x = -st.lw / 2;
      src.forEach(function (c, i) {
        var q = st.chip(arr, i), s = text(c, i), on = isOn(c, i), foc = Z.zone == zone && Z.fcur == i && !V.pop, hv = !foc && !V.pop && over(q.p.rectTransform), w = Math.max(70, s.replace(/<[^>]*>/g, "").length * 12.5 + 34), tc = tint(c) || H;
        if (x + w > st.lw / 2) { x = -st.lw / 2; y -= 50; }
        pos(q.p.rectTransform, x + w / 2, y); pos(q.t.rectTransform, x + w / 2, y); q.cx = x + w / 2; q.cy = y; x += w + 8;
        var key = s + ":" + on + ":" + foc + ":" + hv + ":" + hk + ":" + Math.round(w);
        if (q.key !== key) { q.key = key; setT(q.t, s); q.p.rectTransform.sizeDelta = V2(w, 42); try { q.p.__m.SetVector("_Size", new UE.Vector4(w, 42, 0, 0)); } catch (e5) {}
          var m2 = q.p.__m; mc(m2, "_Fill", on ? tintD(tc, 0.4, 0.9) : tintD(tc, 0.07, 0.8), on ? 0.96 : 0.8); mc(m2, "_Line", foc ? W : on ? mixc(tc, W, 0.4) : hv ? mixc(tc, W, 0.6) : mixc(GREY, tc, 0.55), foc || hv ? 1 : on ? 0.9 : 0.45);
          m2.SetFloat("_Lit", on ? 2 : hv ? 1.2 : 0.25); m2.SetFloat("_EdgeGlow", foc ? 0.5 : on ? 0.3 : hv ? 0.2 : 0); m2.SetFloat("_Run", foc ? 1 : 0); m2.SetFloat("_RunSpeed", 160); m2.SetFloat("_RunLen", 70); mc(m2, "_Accent", tc, 1);
          setC(q.t, on || foc || hv ? W : mixc(DIM, tc, 0.3), 1); }
        act(q.p.gameObject, true); act(q.t.gameObject, true);
        if (click && !V.pop && over(q.p.rectTransform)) { click = false; try { Z.zone = zone; Z.fcur = i; S.press(); } catch (e6) {} }
      });
      for (var z = src.length; z < arr.length; z++) { act(arr[z].p.gameObject, false); act(arr[z].t.gameObject, false); }
      return y;
    }
    var bp = e.bpfree(), nst = bp ? bp.count() : 0, on3 = e.tripleOn();
    var hs = Z.f.heroSet ? Object.keys(Z.f.heroSet).length : 0, es = Z.f.elSet ? Object.keys(Z.f.elSet).length : 0;
    var nm = function (x) { return x ? C5.heroLabelOf(x.id) + " " + Math.round(x.score) : "none"; }, can2 = !!p.evo;
    var BAR = V.BAR = [
      { k: "slot1", s: "Legacy I: " + nm(p.evo), on: !two },
      { k: "slot2", s: "Legacy II: " + (can2 ? nm(p.evo2) : "none"), on: two },
      { k: "triple", s: e.TRIPLE_LABEL + (on3 ? "  ON" : "  OFF"), on: on3, tint: AMBER },
      { k: "start", s: nst ? "Free Choice " + nst + "/4" : "Free Choice", on: nst > 0, tint: AMBER },
      { k: "power", s: "Order: " + (Z.sort == "weak" ? "weakest first" : Z.sort == "power" ? "strongest first" : "by " + e.sortName(Z.sort).toLowerCase()), on: V.pop == "power" },
      { k: "hero", s: "Heroes: " + (hs || "all"), on: hs > 0 || V.pop == "hero" },
      { k: "el", s: "Elements: " + (es || "all"), on: es > 0 || V.pop == "el" },
      { k: "tac", s: Z.f.tactic ? e.blessName(Z.f.tactic) : "Any tactic", on: !!Z.f.tactic },
      { k: "skill", s: Z.f.skill ? "With Legacy skill" : "Any skill", on: !!Z.f.skill }];
    // the older single filters (one element, one hero or group) have no button here: the popups replace them
    if (Z.f.el || Z.f.hero) { Z.f.el = 0; Z.f.hero = 0; e.refresh(S); }
    if (Z.zone == "filter") Z.zone = "sort";
    if (Z.zone == "sort") Z.fcur = Math.max(0, Math.min(BAR.length - 1, Z.fcur | 0));
    filt = filt || hs > 0 || es > 0;
    k.act(st.fsum.gameObject, false); st.chipsB.forEach(function (q) { act(q.p.gameObject, false); act(q.t.gameObject, false); });
    var yB = chipRow(st.chipsA, BAR, 398, "sort", function (c) { return c.s; }, function (c) { return c.on; }, function (c) { return c.tint || null; });
    // the list
    var top0 = yB - 34, rv = Math.max(3, Math.floor((top0 + 404) / (st.rh + 8))), nv = Z.view.length;   // the list ends above the EQUIPPED lines (their plate's top is at -410)
    if (Z.cur < st.top) st.top = Z.cur; if (Z.cur > st.top + rv - 1) st.top = Z.cur - rv + 1; st.top = Math.max(0, Math.min(st.top, Math.max(0, nv - rv)));
    var u0 = t - (Z.listAt || 0);
    for (var c2 = 0; c2 < Math.max(st.rows.length, rv); c2++) {
      var kq = st.top + c2, show = c2 < rv && kq < nv; if (!show && c2 >= st.rows.length) continue;
      var b = st.row(c2); act(b.rt.gameObject, show); if (!show) continue;
      var j = Z.view[kq], ee = l[j], foc = kq == Z.cur && Z.zone == "list";
      var using = ee ? !!(inUse && ee.uid == inUse.uid) : !inUse, fav = !!ee && e.isFav(ee);
      b.f += ((foc ? 1 : 0) - b.f) * 0.3; if (Math.abs(b.f - (foc ? 1 : 0)) < 0.01) b.f = foc ? 1 : 0;
      var hv2 = !foc && over(b.rt) ? 1 : 0; b.h += (hv2 - b.h) * 0.3; if (Math.abs(b.h - hv2) < 0.01) b.h = hv2;
      if (click && !V.pop && over(b.rt)) { click = false; Z.zone = "list"; Z.cur = kq; try { S.press(); } catch (e7) {} }
      var g = Math.max(b.f, b.h * 0.45), key = (ee ? ee.uid : "none") + ":" + g.toFixed(2) + ":" + using + ":" + fav + ":" + hk + ":" + two + ":" + nst;
      if (b.key !== key) {
        b.key = key; var m3 = b.p.__m, ep = e.prof(ee), dom = ee && ep.dom ? e.elCol(ep.dom) : H;
        mc(m3, "_Fill", mixc(tintD(H, 0.1, 0.85), tintD(H, 0.42, 0.92), g), 0.9 + 0.06 * g); mc(m3, "_Line", mixc(mixc(GREY, H, 0.7), mixc(H, W, 0.5), g), 0.4 + 0.55 * g);
        m3.SetFloat("_Lit", 0.3 + 1.7 * g); m3.SetFloat("_EdgeGlow", 0.3 * g); m3.SetFloat("_Run", b.f > 0.5 ? 1 : 0); m3.SetFloat("_RunSpeed", 240); m3.SetFloat("_RunLen", 130); mc(m3, "_Accent", dom, 1);
        var tag = using ? "   <size=64%><color=#8fe39a>IN USE</color></size>" : "";
        if (!ee) {
          act(b.head.gameObject, false); act(b.portM, false);
          // the count sits in the second line: with it in the name, "IN USE" was cut off on a 16:9 screen
          setT(b.name, "No Legacy" + tag); setT(b.sub, two ? "Play with Legacy I only" : "Start the run without one"); setT(b.els, ""); setT(b.lv, "");
          b.tac.forEach(function (ic) { setC(ic, W, 0); }); setC(b.sk, W, 0);
        } else {
          if (b.hid !== ee.id) { b.hid = ee.id; k.setHead(b, ee.id, C5.headSquare ? C5.headSquare() : false, 66, 66); }
          var kept = ee.inheritBlesses || [], sk = e.skillOf(ee);
          setT(b.name, (fav ? "<color=#ffd27a>★</color> " : "") + C5.heroLabelOf(ee.id) + "   <size=78%><color=#ffd27a>" + Math.round(ee.score) + "</color></size>" + tag);
          setT(b.sub, kept.length + " handed down" + (ep.total ? "   ·   " + ep.total + " in build" : ""));
          setT(b.els, "");
          b.tac.forEach(function (ic, q) { var kb = kept[q], sp = kb ? e.blessSprite(kb.id) : null; ic.sprite = sp; setC(ic, W, sp ? 1 : 0); });
          var ss = sk && (sk.sprite || e.inheritIcon()); b.sk.sprite = ss; setC(b.sk, W, ss ? 1 : 0); setT(b.lv, sk ? "Lv " + sk.level : "");
        }
        setC(b.name, mixc(INK, W, g), 1);
      }
      var sf = using && st.setAt != null && !cm ? t - st.setAt : 9, pl = sf < 0.4 ? 1 - sf / 0.4 : 0; if (b.pl !== pl) { b.pl = pl; b.p.__m.SetFloat("_Pulse", pl); }
      var u = ease((u0 - c2 * 0.03) / 0.2); b.g.alpha = u * (V.pop ? 0.1 : 1); pos(b.rt, (1 - u) * 40 + 10 * b.f, top0 - st.rh / 2 - c2 * (st.rh + 8));
    }
    if (nv > rv) { var gh = rv * (st.rh + 8), mh = Math.max(40, gh * rv / nv); st.rail.rectTransform.sizeDelta = V2(3, mh); pos(st.rail.rectTransform, st.lw / 2 + 12, top0 - mh / 2 - (gh - mh) * st.top / (nv - rv)); setC(st.rail, H, 0.7); } else setC(st.rail, H, 0);
    var gFoc = Z.zone == "go" && !V.pop, gHv = !gFoc && !V.pop && over(st.goP.rectTransform), gk = gFoc + ":" + gHv + ":" + hk;
    if (st.goK !== gk) { st.goK = gk; var mg = st.goP.__m; mc(mg, "_Fill", gFoc || gHv ? tintD(H, 0.42, 0.92) : tintD(H, 0.14, 0.88), 0.96); mc(mg, "_Line", gFoc ? W : mixc(H, W, gHv ? 0.6 : 0.4), gFoc || gHv ? 1 : 0.8); mc(mg, "_BracketColor", mixc(H, W, 0.6), 0.9);
      mg.SetFloat("_Lit", gFoc ? 2 : gHv ? 1.4 : 0.5); mg.SetFloat("_EdgeGlow", gFoc ? 0.4 : gHv ? 0.25 : 0.06); mg.SetFloat("_Run", 1); mg.SetFloat("_RunSpeed", gFoc || gHv ? 260 : 70); mg.SetFloat("_RunLen", 120); mc(mg, "_Accent", H, 1); setC(st.goT, gFoc || gHv ? W : mixc(INK, H, 0.25), 1); }
    setT(st.goT, "START DIVE");
    // the button answers: it grows a little under the focus and rings when a Legacy is set
    st.gf = (st.gf || 0) + ((gFoc || gHv ? 1 : 0) - (st.gf || 0)) * 0.25; var gp = st.setAt != null && !cm ? Math.max(0, 1 - (t - st.setAt) / 0.45) : 0;
    k.scl(st.goP.rectTransform, 1 + 0.05 * st.gf + 0.04 * gp); k.scl(st.goT.rectTransform, 1 + 0.05 * st.gf + 0.04 * gp); if (st.gpW !== gp) { st.gpW = gp; st.goP.__m.SetFloat("_Pulse", gp); }
    if (click && !V.pop && over(st.goP.rectTransform)) { click = false; try { S.v5Start(); } catch (eg) {} }
    // the popup under the bar: the order, the heroes or the elements
    var items = V.pop ? V.items(Z) : [], PD = { power: [1, 340, 48], hero: [6, 78, 78], el: [3, 176, 46], start: [V.cols("start"), 62, 62] }[V.pop] || [1, 10, 10], pc = PD[0], pw = PD[1], ph = PD[2], isSt = V.pop == "start";
    var nt = isSt ? items.filter(function (q) { return q.tab; }).length : 0, tcols = isSt ? V.tcols(nt, pc) : 1, TROW = isSt ? Math.ceil(nt / tcols) * (V.TH + 6) + 4 : 0;   // 0.1.21: the element chips' rows
    act(st.pp.gameObject, !!V.pop); act(st.ppT.gameObject, !!V.pop); if (!V.pop) { act(st.ppF.gameObject, false); act(st.ppN.gameObject, false); }
    if (V.pop) {
      var bi9 = BAR.map(function (x9) { return x9.k; }).indexOf(V.pop), ch9 = st.chipsA[bi9], prows = Math.ceil((items.length - nt) / pc), PW = Math.max(pc * (pw + 8) + 28, tcols * (V.TW + 6) + 28), PH = prows * (ph + 8) + 66 + TROW + (isSt ? 180 : 0);
      var px = Math.max(-st.lw / 2 + PW / 2, Math.min(st.lw / 2 - PW / 2, ch9 ? ch9.cx : 0)), py = Math.min(ch9 ? ch9.cy : 398, yB) - 30 - PH / 2;
      var pu = ease((t - (V.popAt || 0)) / 0.14); k.scl(st.pp.rectTransform, 0.95 + 0.05 * pu);
      pos(st.pp.rectTransform, px, py); var pk = PW + ":" + PH + ":" + hk; if (st.ppK !== pk) { st.ppK = pk; st.pp.rectTransform.sizeDelta = V2(PW, PH); st.pp.__m.SetVector("_Size", new UE.Vector4(PW, PH, 0, 0)); mc(st.pp.__m, "_Fill", tintD(H, 0.09, 0.7), 0.97); mc(st.pp.__m, "_Line", mixc(H, W, 0.45), 0.95); mc(st.pp.__m, "_BracketColor", mixc(H, W, 0.4), 1); }
      pos(st.ppT.rectTransform, px, py + PH / 2 - 26); setT(st.ppT, isSt ? "// FREE CHOICE   " + nst + " / 4" : V.pop == "power" ? "// ORDER" : V.pop == "hero" ? "// HEROES TO SHOW" : "// ELEMENTS TO SHOW");
      act(st.ppF.gameObject, isSt); act(st.ppN.gameObject, isSt);
      if (isSt) { var fi = items[V.pcur]; pos(st.ppN.rectTransform, px, py - PH / 2 + 146); pos(st.ppF.rectTransform, px, py - PH / 2 + 66); st.ppN.rectTransform.sizeDelta = V2(PW - 36, 34); st.ppF.rectTransform.sizeDelta = V2(PW - 36, 112);
        setT(st.ppN, V.msg ? "<color=#ffd27a>" + V.msg + "</color>" : fi && fi.tac ? fi.s + "   <size=75%><color=#" + hex(fi.col || DIM) + ">" + (fi.els || "Tactic") + "</color></size>" : fi && fi.all ? "Take every pick off" : fi && fi.tab ? fi.s + " Tactics" : "");
        setT(st.ppF, "Pick up to four Tactics from every one the game has: a chip for each element, a two-element Tactic under both. Picked Tactics replace the tactics your Legacies hand down; the Legacy skill and talent stay. Take them all off to play Classic."); } setC(st.ppT, mixc(H, W, 0.3), 1);
      if (click && !over(st.pp.rectTransform)) { click = false; V.pop = null; }
    }
    for (var pi = 0; pi < Math.max(st.pcells.length, items.length); pi++) {
      var it9 = items[pi], show9 = !!V.pop && !!it9; if (!show9 && pi >= st.pcells.length) continue;
      var c9 = st.pcell(pi); act(c9.rt.gameObject, show9); if (!show9) continue;
      var foc9 = pi == V.pcur, hv9 = !foc9 && over(c9.rt), tab9 = isSt && !!it9.tab, gi9 = pi - nt, x9, y9;
      if (tab9) { x9 = px - PW / 2 + 14 + V.TW / 2 + (pi % tcols) * (V.TW + 6); y9 = py + PH / 2 - 52 - V.TH / 2 - Math.floor(pi / tcols) * (V.TH + 6); }
      else { x9 = px - PW / 2 + 14 + pw / 2 + (gi9 % pc) * (pw + 8); y9 = py + PH / 2 - 52 - TROW - ph / 2 - Math.floor(gi9 / pc) * (ph + 8); }
      pos(c9.rt, x9, y9);
      var tc9 = it9.col || H, k9 = V.pop + ":" + (it9.id || it9.s) + ":" + it9.on + ":" + foc9 + ":" + hv9 + ":" + hk + (tab9 ? ":tab" : ""), cw9 = tab9 ? V.TW : pw, ch9h = tab9 ? V.TH : ph;
      if (c9.key !== k9) {
        c9.key = k9; c9.rt.sizeDelta = V2(cw9, ch9h); c9.p.rectTransform.sizeDelta = V2(cw9, ch9h); c9.p.__m.SetVector("_Size", new UE.Vector4(cw9, ch9h, 0, 0));
        var m9 = c9.p.__m; mc(m9, "_Fill", it9.on ? tintD(tc9, 0.4, 0.9) : tintD(tc9, 0.05, 0.7), it9.on ? 0.96 : 0.8); mc(m9, "_Line", foc9 ? W : it9.on ? mixc(tc9, W, 0.4) : hv9 ? mixc(tc9, W, 0.6) : mixc(GREY, tc9, 0.5), foc9 || hv9 ? 1 : it9.on ? 0.9 : 0.4);
        m9.SetFloat("_Lit", it9.on ? 2 : hv9 ? 1.2 : 0.25); m9.SetFloat("_EdgeGlow", foc9 ? 0.5 : it9.on ? 0.3 : 0); m9.SetFloat("_Run", foc9 ? 1 : 0); m9.SetFloat("_RunSpeed", 160); m9.SetFloat("_RunLen", 70); mc(m9, "_Accent", tc9, 1);
        var isHead = V.pop == "hero" && !!it9.id; act(c9.head.gameObject, false); act(c9.portM, false);
        if (isHead) { k.setHead(c9, it9.id, C5.headSquare ? C5.headSquare() : false, 68, 68); var hc9 = it9.on ? W : [0.4, 0.4, 0.46]; setC(c9.head, hc9, 1); setC(c9.port, hc9, 1); }
        var isTac = isSt && !!it9.tac; if (isTac) { c9.head.sprite = e.blessSprite(it9.id); c9.head.rectTransform.sizeDelta = V2(52, 52); act(c9.head.gameObject, true); setC(c9.head, it9.on ? W : [0.6, 0.6, 0.66], 1); } else c9.head.rectTransform.sizeDelta = V2(66, 66);
        c9.t.fontSize = tab9 ? 16 : 20; setT(c9.t, isHead || isTac ? "" : it9.s); setC(c9.t, it9.on || foc9 || hv9 ? W : mixc(DIM, tc9, 0.3), 1);
      }
      if (click && over(c9.rt)) { click = false; V.pcur = pi; V.choose(S, Z); }
    }
    setT(st.count, nv - 1 > 0 ? Math.min(nv - 1, Math.max(1, Z.cur)) + " / " + (nv - 1) : filt ? "No Evotype matches" : "");
    // the stage and the sheet follow the Evotype under the cursor (the first of the list while the cursor is on the chips)
    // 0.1.19 (Fury's two modes; the lead, 2026-11-11: "From my Evotypes"): Free Choice no longer takes the Legacies away.
    // Until now picked tactics forced the cursor onto the first row and the run started with no Legacy at all
    var pev = ev; if (Z.zone != "list" && !ev && nv > 1) pev = l[Z.view[1]];
    var fid = pev ? pev.uid + ":" + (G.BB4EVO.skillRev | 0) + ":" + (nst && bp && bp.picks ? bp.picks().join(",") : "") : "none" + nst + (bp && bp.picks ? bp.picks().join(",") : "");
    if (st.tri.__m) { st.tri.__m.SetColor("_Hot", k.col(mixc(HP, W, 0.4), 1)); setC(st.tri, HP, o * 0.7); }
    if (st.forId !== fid) {
      st.forId = fid; st.swapAt = t;
      var tex = pev ? C5.heroTexture(pev.id, C5.skinOf(pev.id)) : null; st.art.texture = tex; st.hasArt = !!tex;
      if (tex) { var mq = C5.measure(tex), bt = mq.bot == null ? 1 : mq.bot, fh = Math.max(0.2, bt - mq.top), fw = Math.max(0.2, (mq.r == null ? 1 : mq.r) - (mq.l || 0)), cw = st.RW - st.LW - st.RWd;
        var hh = 900 / fh, ww = hh * tex.width / tex.height; if (ww * fw > cw - 40) { ww = (cw - 40) / fw; hh = ww * tex.height / tex.width; }
        st.art.rectTransform.sizeDelta = V2(ww, hh); st.artX = st.cx - (((mq.l || 0) + (mq.r == null ? 1 : mq.r)) / 2 - 0.5) * ww; st.artY = -500 - hh / 2 + bt * hh - st.maskY; st.artX -= st.cx; }
      setT(st.none, pev ? "" : "NO LEGACY"); setT(st.noneSub, pev ? "" : two ? "Play with Legacy I only." : nst ? "Start the run with no Legacy. Your Free Choice tactics still come with you." : "Start the run with no Legacy. No tactics or skill are handed down.");
      if (st.noneOn !== !pev) { st.noneOn = !pev; st.noneP.gameObject.SetActive(!pev); }
      var pp = e.prof(pev), sk2 = pev ? e.skillOf(pev) : null, kept2 = pev ? pev.inheritBlesses || [] : [], bl = pev ? e.build(pev.uid) || [] : [];
      // Free Choice: the Evotype's own handed-down tactics stay on its sheet under a heading that says they are replaced
      // (the first try listed the picks here, which read as if this Evotype handed them down)
      setT(st.heads[3], nst && pev ? "// REPLACED BY FREE CHOICE" : "// HANDED DOWN");
      setT(st.rName, pev ? String(C5.heroLabelOf(pev.id)).toUpperCase() : "NO LEGACY"); setT(st.rPow, pev ? "POWER  " + Math.round(pev.score) : "");
      var tot2 = 0; pp.list.forEach(function (it) { tot2 += it[1]; }); var x2 = -st.rw / 2;
      st.seg.forEach(function (s, q) { var it = pp.list[q]; if (!it || !tot2) { st.barSet(s, 0, 262, 1, 14, W, 0); return; } var w3 = st.rw * it[1] / tot2; st.barSet(s, x2 + 1, 262, Math.max(2, w3 - 2), 14, e.elCol(it[0]), 1); x2 += w3; });
      st.leg.forEach(function (lg, q) { var it = pp.list[q]; setT(lg, it ? e.elName(it[0]) + " " + Math.round(it[1]) : q == 0 ? (pev ? "No build saved" : "Nothing handed down") : ""); setC(lg, it ? e.elCol(it[0]) : DIM, 1); });
      var ps = sk2 && (sk2.sprite || e.inheritIcon()); st.skI.sprite = ps || null; setC(st.skI, W, ps ? 1 : 0);
      setT(st.skN, sk2 ? (sk2.name || "Legacy skill") + "   <size=75%><color=#70fdff>Lv " + sk2.level + "</color></size>" : "<color=#8a8698>No Legacy skill</color>");
      setT(st.skD, sk2 ? sk2.desc || "" : pev ? "This Evotype hands down no skill." : "");
      st.kept.forEach(function (x, q) { var kb = kept2[q], sp = kb ? e.blessSprite(kb.id) : null; x.ic.sprite = sp; setC(x.ic, W, sp ? 1 : 0);
        setT(x.n, kb ? e.blessName(kb.id) : q == 0 ? "None" : ""); setC(x.n, kb ? (e.QC[e.dq(kb.id, kb.quality)] || W) : DIM, 1); setT(x.e, kb ? (e.seriesOf(kb.id).map(e.elName).join(" + ") || "Tactic") : ""); });
      // a build saved under an older version can hold tactics the game no longer has (no table row, no icon): they are
      // counted apart, so the number matches the icons shown
      var bsp = [], gone = 0; bl.forEach(function (kb) { var sp = kb ? e.blessSprite(kb.id) : null; if (!sp) gone++; else if (bsp.length < st.build.length) bsp.push(sp); });
      var have = bl.length - gone;
      setT(st.bN, bl.length ? have + (have > st.build.length ? "  (first " + st.build.length + ")" : "") + (have == 1 ? " tactic" : " tactics") + (gone ? "   ·   " + gone + " no longer in the game" : "") : pev ? "not saved" : "");
      // the grid fills 166 units of height (the node's inside): the column count that gives the largest icons wins
      var nb = bsp.length, bcol = 4, bsz = 0; for (var bq = 4; bq <= 12; bq++) { var bz = Math.min(st.rw / bq, 166 / Math.max(1, Math.ceil(nb / bq))); if (bz > bsz + 0.01) { bsz = bz; bcol = bq; } }
      var bic = Math.min(72, bsz - 10);
      st.build.forEach(function (bi, q) { var sp = bsp[q] || null; bi.sprite = sp; setC(bi, W, sp ? 1 : 0); if (!sp) return;
        bi.rectTransform.sizeDelta = V2(bic, bic); pos(bi.rectTransform, -st.rw / 2 + (st.rw - bcol * bsz) / 2 + bsz / 2 + (q % bcol) * bsz, -282 - bsz / 2 - Math.floor(q / bcol) * bsz); });
    }
    var using2 = pev ? !!(inUse && pev.uid == inUse.uid) : !inUse; setT(st.rUse, using2 ? "In use" : ""); setT(st.rStep, (two ? "Legacy II" : "Legacy I") + " for " + C5.heroLabelOf(p.hero));
    var da = ease((t - (st.swapAt || 0)) / 0.22);
    if (st.art.__m) { st.art.__m.SetFloat("_Dissolve", 1 - da); st.art.__m.SetColor("_Rim", k.col(mixc(H, W, 0.1), 0.14)); st.art.__m.SetColor("_Edge", k.col(mixc(H, W, 0.55), 1)); }
    var dupI = pev && p.evo && pev.uid == p.evo.uid ? 0 : pev && p.evo2 && pev.uid == p.evo2.uid ? 1 : -1;
    setC(st.art, W, st.hasArt && dupI < 0 ? o : 0); if (st.hasArt) pos(st.art.rectTransform, st.artX + 18 * (1 - da), st.artY);
    [p.evo, p.evo2].forEach(function (be, i) {
      var B0 = st.bg[i], uid = be ? be.uid : null;
      if (B0.uid !== uid) {
        B0.uid = uid; var tx = uid != null ? C5.heroTexture(be.id, C5.skinOf(be.id)) : null; B0.ri.texture = tx; B0.has = !!tx;
        if (tx) { var mb = C5.measure(tx), bb = mb.bot == null ? 1 : mb.bot, bh = Math.max(0.2, bb - mb.top), hh2 = 1040 / bh, ww2 = hh2 * tx.width / tx.height;
          B0.ri.rectTransform.sizeDelta = V2(ww2, hh2); pos(B0.ri.rectTransform, -(((mb.l || 0) + (mb.r == null ? 1 : mb.r)) / 2 - 0.5) * ww2, -560 - hh2 / 2 + bb * hh2); }
        setT(B0.lb, uid != null ? (i ? "LEGACY II" : "LEGACY I") : "");
      }
      // dim behind the cursor's Evotype; full when the cursor is on this very Legacy, or on no Evotype
      var ba = !B0.has ? 0 : i == dupI ? 0.92 : pev ? 0.32 : 0.62; B0.a = B0.a == null ? ba : B0.a + (ba - B0.a) * 0.2;
      setC(B0.ri, i == dupI ? W : [0.7, 0.68, 0.74], o * B0.a); setC(B0.lb, mixc(HP, W, 0.4), B0.has ? o * 0.85 : 0);
    });
    // what is equipped, in words
    var eqDim = "<color=#" + hex(DIM) + ">", eqLine = function (tag, be, free) {
      if (!be) return eqDim + tag + "   none</color>";
      var sk0 = e.skillOf(be), kp = (be.inheritBlesses || []).map(function (kb) { return e.blessName(kb.id); }).filter(function (x) { return x; });
      return eqDim + tag + "</color>   " + C5.heroLabelOf(be.id) + (sk0 && sk0.name ? eqDim + "   skill</color> " + sk0.name : "") + (free ? eqDim + "   tactics replaced by Free Choice</color>" : kp.length ? eqDim + "   tactics</color> " + kp.join(", ") : "");
    };
    var stN = nst && bp && bp.picks ? bp.picks().map(e.blessName).join(", ") : "";
    // a pop-up reaches down over this block: while one is open the block is hidden (its lines showed through the grid)
    var eqOn = !V.pop; if (st.eqOn !== eqOn) { st.eqOn = eqOn; act(st.eqP.gameObject, eqOn); act(st.eqH.gameObject, eqOn); st.eq.forEach(function (q) { act(q.gameObject, eqOn); }); }
    setT(st.eq[0], eqLine("Legacy I", p.evo, nst > 0));
    setT(st.eq[1], eqLine("Legacy II", p.evo2, nst > 0));
    setT(st.eq[2], stN ? eqDim + "Free Choice</color>   " + stN : eqDim + "Free Choice   off. Classic: the tactics come from your Legacies</color>");
  };
})();
