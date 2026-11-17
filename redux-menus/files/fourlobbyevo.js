// Four-player online mode: the Legacy (Evotype) selector. A tester (jester_ac, 2026-10-20): "i would like to have a better
// select screen for evotypes, with sorting and filters ... i barely save evotypes bc it becomes a hassle to search which one
// you are looking for"; the lead: "completely make a new Evotype legacy selector menu on the same level of quality as v3 you
// can sort by hero you can sort by power level you can sort by element and specific tactic ... you can use filters ... you
// can see skills and inherentences".
// The screen: a list of the player's Evotypes on the left (hero, power, the build's elements, the tactics it hands down and
// its Legacy skill), the one under the cursor in full on the right (power, the build's element mix, the Legacy skill with its
// text, the kept tactics, the whole build). Sort by power, hero or element (Q / E or the chips); filter by element, hero,
// tactic (a grid of every tactic in these Evotypes) and Legacy skill. Built from the lobby prefab's own board art; the 3D
// pass (fourlobby3d.js) stands it in depth. fourlobbyui.js calls build() once, then draw / move / page / press / back /
// mouse while a Legacy step is open; A is fourlobbyui's helper set.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof;
  var E = G.BB4EVO = G.BB4EVO || {};
  function log(m) { B.log("FOURUI", "Legacy select: " + m); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function hex(c) { return c.slice(0, 3).map(function (v) { var s = Math.round(clamp(v, 0, 1) * 255).toString(16); return s.length < 2 ? "0" + s : s; }).join(""); }
  function V2(x, y) { return new UE.Vector2(x, y); }
  function C(c, a) { return new UE.Color(c[0], c[1], c[2], a == null ? 1 : a); }
  var ROWS = 6, ROW_H = 96, ROW_STEP = 105, FOC_GAP = 10, FOC_DX = 6, LIST_X = -339, LIST_W = 1252, LIST_TOP = 268, PANEL_X = 676, PANEL_Y = -10, PANEL_W = 676, PANEL_H = 676;
  var BX = LIST_W / 1150;   // the row's parts were placed on a 1150 px row
  var GOLD = [1, 0.82, 0.42], DIM = [0.62, 0.6, 0.7], TEXT = [0.88, 0.86, 0.94];
  // the elements (BlessConf.Series): the game's names where it has them; colours ours, one per element, read on dark
  var EL = { 1: ["Fire", [1, 0.45, 0.28]], 2: ["Ice", [0.48, 0.84, 1]], 3: ["Electric", [1, 0.87, 0.32]], 4: ["Toxin", [0.58, 0.92, 0.36]],
             5: ["Umbra", [0.68, 0.45, 1]], 6: ["Light", [1, 0.95, 0.72]], 7: ["Blade", [0.86, 0.86, 0.96]], 8: ["Generic", [0.7, 0.7, 0.78]],
             9: ["Dual", [1, 0.62, 0.86]], 10: ["Water", [0.32, 0.66, 1]], 11: ["Radiation", [0.78, 1, 0.28]] };
  // the game's own tactic quality colours (WidgetInheritBless, by display quality)
  var QC = { 1: [1, 1, 1], 2: [0.31, 0.62, 0.98], 3: [0.88, 0.38, 1], 4: [1, 0.93, 0], 5: [1, 0.21, 0.42] };
  var SORTS = [["power", "Power"], ["hero", "Hero"], ["element", "Element"]];
  // 0.1.7 (Boogy, 2026-11-09: "Allow us to sort from the least powerful first ... needing to scroll down for so long every
  // time"): weakest first is the Power chip's second state (its label reads Weakest), next after Power in the LB / RB
  // cycle, and the order chosen is kept between sessions (BB4.opt evoSort). Starred Evotypes still lead every order
  var CYCLE = ["power", "weak", "hero", "element"];
  function chipKey(s) { return s == "weak" ? "power" : s; }
  function sortName(s) { if (s == "weak") return "Weakest"; var n = "Power"; SORTS.forEach(function (q) { if (q[0] == s) n = q[1]; }); return n; }
  function savedSort() { var v = "power"; try { v = B.opt("evoSort") || "power"; } catch (x) {} return CYCLE.indexOf(v) >= 0 ? v : "power"; }
  function setSort(Z, v) { Z.sort = v; try { B.setOpt("evoSort", v); } catch (x) {} }
  // v4's family (HERO_SELECT_V4.md 9.10, direction A, the lead 2026-11-02): the select's ground per group (fourlobbyui.js
  // TABFX veils), its group-change rhythm for rows coming in (CHG_*: starts 2 frames apart, 8 frames each, 24 px), and
  // its card back behind the detail panel (role_selection_004, tinted to the group as setCardBack does)
  var VEIL = { heroes: [0.1, 0.02, 0.04], ex: [0.11, 0.07, 0.02], boss: [0.06, 0.02, 0.1], cross: [0.02, 0.06, 0.1] };
  var TINT = { ex: [1, 0.7, 0.22, 0.75], boss: [0.6, 0.28, 1, 0.75], cross: [0.28, 0.66, 1, 0.75] };   // the select's TABFX tints
  var ROW_GAP = 2 / 60, ROW_IN = 8 / 60, ROW_PX = 24, CARD_S = 1.0;
  function groups() { var X = G.BB4SEL; return X && X.GROUPS ? X.GROUPS : [{ key: "heroes", label: "Heroes", col: [0.92, 0.22, 0.3] }]; }
  function groupOf(id) { var X = G.BB4SEL; return X && X.groupOf ? X.groupOf(id) : 0; }

  // ---- game data, read once ----
  var cache = { tex: {}, bs: {}, conf: {}, name: {}, dq: {}, skill: {}, prof: {}, el: {} };
  function U() { return require("Core/Util").U; }
  function AM() { return U().GetSingleton(cs.NOAH.Asset.AssetManagerBase); }
  function tex(path) {
    if (cache.tex[path] !== undefined) return cache.tex[path];
    var t = null; try { t = AM().LoadAssetByType(T(UE.Texture2D), path); if (t && t.Equals(null)) t = null; } catch (e) {}
    return (cache.tex[path] = t);
  }
  function conf(id) { if (cache.conf[id] !== undefined) return cache.conf[id]; var c = null; try { c = require("Gen/Xlsx").Xlsx.BlessConf.Get(id) || null; } catch (e) {} return (cache.conf[id] = c); }
  function seriesOf(id) { var c = conf(id), s = c && (c.series || c.Series); var out = []; if (s) for (var i = 0; i < s.length; i++) out.push(s[i] | 0); return out; }
  function elName(n) {
    if (cache.el[n] !== undefined) return cache.el[n];
    var s = ""; try { s = U().GetLocale("BlessSeries_" + n) || ""; } catch (e) {}
    if (!s || s.indexOf("BlessSeries") >= 0) s = (EL[n] || ["Element " + n])[0];
    return (cache.el[n] = String(s));
  }
  function elCol(n) { return (EL[n] || [0, [0.7, 0.7, 0.78]])[1]; }
  // the game's glyph; Water and Radiation (Boons Plus's elements) keep theirs in that mod's texture route, made a sprite here
  function elTex(n) {
    var k = "e" + n; if (cache.bs[k] !== undefined) return cache.bs[k];
    var s = E.A.spriteOf(["UI/Atlas/IconCommon/IconCommon", "BlessType_" + n + "_S"]);
    if (!s) try {
      var nm = "BlessType_" + n + "_S", tx = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Texture2D), "UI/Texture/BPIcon/" + nm, nm);
      if (tx && !tx.Equals(null)) s = UE.Sprite.Create(tx, new UE.Rect(0, 0, tx.width, tx.height), V2(0.5, 0.5), 100);
    } catch (e) { s = null; }
    return (cache.bs[k] = s || null);
  }
  function blessName(id) {
    if (cache.name[id] !== undefined) return cache.name[id];
    var s = ""; try { var AU = require("Core/ActorUtil").default; s = AU.GetBlessName(id) || ""; var c = conf(id); if (c && AU.GetBlessGradationStr) s += AU.GetBlessGradationStr(c.gradation) || ""; } catch (e) {}
    return (cache.name[id] = String(s || "Tactic " + id));
  }
  function dq(id, q) { var k = id + "/" + q; if (cache.dq[k] !== undefined) return cache.dq[k]; var d = q; try { d = require("Core/ActorUtil").default.GetBlessDisplayQuality(id, q) || q; } catch (e) {} return (cache.dq[k] = d); }
  function blessSprite(id) {
    if (cache.bs[id] !== undefined) return cache.bs[id];
    var sp = null; try { var at = require("GamePlay/BlessUtil").BlessUtil.GetBlessAtlas(id); sp = E.A.spriteOf([at, "IconBless_" + id]); } catch (e) {}
    if (!sp) { var s = seriesOf(id)[0]; sp = E.A.spriteOf([s ? "UI/Atlas/IconBless_" + s + "/IconBless_" + s : "UI/Atlas/IconBless/IconBless", "IconBless_" + id]); }
    return (cache.bs[id] = sp);
  }
  function qualBg(d) { var k = "q" + d; if (cache.bs[k] !== undefined) return cache.bs[k]; return (cache.bs[k] = E.A.spriteOf(["UI/Atlas/CommonMB/CommonMB", "BgTactic_" + d])); }
  // the Legacy skill an Evotype hands down: {id, level, name, desc, sprite}, or null
  // the skill's damage is the Evotype's base attack times the skill's factor (WidgetInheritSkill): its own AtkBase, else the hero's
  function atkOf(ev, raw) {
    var AT = require("csharp").EAttrType.AtkBase, v = 0;
    try { var ba = raw && raw.baseAttrs; if (ba) for (var i = 0; i < ba.length; i++) if (ba[i] && ba[i].type == AT) v = ba[i].value; } catch (e) {}
    if (!v) try { var at = require("Gen/Xlsx").Xlsx.BaseActorAttrConf.Get(ev.id).attr; for (var j = 0; j < at.length; j++) if (at[j].type == AT) v = at[j].value; } catch (e) {}
    return v || 0;
  }
  function skillOf(ev) {
    if (!ev) return null;
    if (cache.skill[ev.uid] !== undefined) return cache.skill[ev.uid];
    var r = null, raw = E.A.raw(ev.uid);
    try {
      var IS = require("Core/InheritSkillUtil").InheritSkillUtil, s = raw ? IS.GetTeacherSkillFromFactor(raw) : null;
      if (s && s.id) {
        r = { id: s.id, level: s.level || 1, name: "", desc: "" };
        try { r.name = U().GetLocale("InheritSkill_" + s.id) || ""; } catch (e) {}
        try { r.desc = IS.GetTeacherSkillDesc ? IS.GetTeacherSkillDesc(atkOf(ev, raw), s) || "" : ""; } catch (e) {}
        if (!r.desc || r.desc.indexOf("NaN") >= 0) try { r.desc = U().GetLocale("InheritSkillDesc_" + s.id) || ""; } catch (e) {}
        if (r.name.indexOf("InheritSkill_") >= 0) r.name = "Legacy skill";
        if (r.desc.indexOf("InheritSkillDesc_") >= 0) r.desc = "";
        r.sprite = E.A.spriteOf(["UI/Atlas/IconSkill/IconSkill", "IconSkill_" + s.id]);
      }
    } catch (e) {}
    return (cache.skill[ev.uid] = r);
  }
  // the build's elements: how many of its tactics are of each (a double tactic counts half to each), the main one first
  function prof(ev) {
    if (!ev) return { n: {}, list: [], total: 0, dom: 0 };
    if (cache.prof[ev.uid]) return cache.prof[ev.uid];
    var n = {}, bl = E.A.build(ev.uid) || ev.inheritBlesses || [], total = 0;
    bl.forEach(function (b) { var s = seriesOf(b.id); if (!s.length) return; var w = 1 / s.length; s.forEach(function (x) { n[x] = (n[x] || 0) + w; }); total++; });
    var list = Object.keys(n).map(function (k) { return [k | 0, n[k]]; }).sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });
    return (cache.prof[ev.uid] = { n: n, list: list, total: total, dom: list.length ? list[0][0] : 0 });
  }
  function tactics(ev) { var seen = {}, out = []; (ev.inheritBlesses || []).concat(E.A.build(ev.uid) || []).forEach(function (b) { if (!seen[b.id]) { seen[b.id] = 1; out.push(b.id); } }); return out; }

  // ---- building blocks ----
  function rt(parent, name, x, y, w, h) { var r = E.A.node(parent, name); r.anchorMin = r.anchorMax = V2(0.5, 0.5); r.pivot = V2(0.5, 0.5); r.anchoredPosition = V2(x, y); r.sizeDelta = V2(w, h); return r; }
  function img(parent, name, x, y, w, h, sprite, c) { var r = rt(parent, name, x, y, w, h), im = r.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; if (sprite) { im.sprite = sprite; im.preserveAspect = true; } im.color = c || new UE.Color(1, 1, 1, 1); return im; }
  function raw(parent, name, x, y, w, h) { var r = rt(parent, name, x, y, w, h), im = r.gameObject.AddComponent(T(UI.RawImage)); im.raycastTarget = false; return im; }
  function text(parent, name, x, y, w, h, size, c, align, style) {
    var r = rt(parent, name, x, y, w, Math.max(h, size * 1.5)), t = E.A.txt(parent, name, size, c, align || cs.TMPro.TextAlignmentOptions.Left, style);
    t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis; return t;
  }
  function chip(parent, name, w) {
    var g = UE.Object.Instantiate(E.chipTpl.gameObject, parent, false); g.SetActive(true); g.name = name;
    var c = { rt: g.GetComponent(T(UE.RectTransform)), on: E.A.comp(g.transform, "On", UI.Image), off: E.A.comp(g.transform, "Off", UI.Image), glow: E.A.comp(g.transform, "Glow", UI.Image),
              star: E.A.comp(g.transform, "Star", UI.Image), t: E.A.txt(g.transform, "T_Opt", 24, null, cs.TMPro.TextAlignmentOptions.Center), sc: 1 };
    c.rt.anchorMin = c.rt.anchorMax = V2(0.5, 0.5); c.rt.pivot = V2(0.5, 0.5); c.rt.sizeDelta = V2(w, 50); E.A.setA(c.star, 0);
    c.focus = img(c.rt, "Focus", 0, -33, w - 18, 5, null, C(GOLD, 0)); c.focus.preserveAspect = false;
    return c;
  }
  function lightChip(c, sel, foc, tint) {
    E.A.setA(c.on, sel ? 1 : 0); if (sel && tint) c.on.color = C(tint, 1);
    c.t.color = sel ? E.A.INK : C(TEXT);
    E.A.setA(c.glow, foc ? 0.55 + 0.25 * Math.sin(UE.Time.unscaledTime * 4) : 0);
    if (c.focus) E.A.setA(c.focus, foc ? 0.85 + 0.15 * Math.sin(UE.Time.unscaledTime * 6) : 0);
    c.sc += ((foc ? 1.08 : 1) - c.sc) * 0.35; c.rt.localScale = new UE.Vector3(c.sc, c.sc, 1);
    if (c.icon) c.icon.color = sel ? new UE.Color(0.08, 0.06, 0.1, 1) : new UE.Color(1, 1, 1, 1);
  }
  // a tactic: its quality frame with the icon on it
  function tacticSlot(parent, name, x, y, s) {
    var bg = img(parent, name, x, y, s, s, null, new UE.Color(1, 1, 1, 1)); bg.preserveAspect = false;
    var ic = img(bg.rectTransform, "Icon", 0, 0, s * 0.82, s * 0.82, null);
    return { bg: bg, ic: ic, go: bg.gameObject, rt: bg.rectTransform };
  }
  function setTactic(sl, b) {
    if (!b) { sl.go.SetActive(false); return; }
    sl.go.SetActive(true);
    var d = dq(b.id, b.quality), bg = qualBg(d), sp = blessSprite(b.id);
    if (sl.id !== b.id || sl.q !== d) {
      sl.id = b.id; sl.q = d;
      sl.bg.sprite = bg; sl.bg.color = bg ? new UE.Color(1, 1, 1, 1) : C(QC[d] || QC[1], 0.35);
      sl.ic.sprite = sp; sl.ic.gameObject.SetActive(!!sp);
    }
  }

  // ---- build: once, after the lobby screen ----
  E.build = function (S, A) {
    E.A = A; var Z = { rows: [], chips: [], sortChips: [], elChips: [], open: false, a: 0, zone: "list", cur: 0, top: 0, f: { el: 0, hero: 0, tactic: 0, skill: 0 }, sort: savedSort(), view: [0] };
    var root = A.node(S.ui, "Legacy"); root.anchorMin = UE.Vector2.zero; root.anchorMax = UE.Vector2.one; root.sizeDelta = UE.Vector2.zero; Z.root = root;
    Z.cg = root.gameObject.AddComponent(T(UE.CanvasGroup)); Z.cg.blocksRaycasts = false; Z.cg.interactable = false;
    var veil = A.node(root, "Veil"); veil.anchorMin = UE.Vector2.zero; veil.anchorMax = UE.Vector2.one; veil.sizeDelta = V2(600, 600);
    Z.veil = veil.gameObject.AddComponent(T(UI.Image)); Z.veil.color = new UE.Color(VEIL.heroes[0], VEIL.heroes[1], VEIL.heroes[2], 0.975); Z.veil.raycastTarget = false;
    var bd = S.rulesBoard;
    E.chipTpl = A.find(bd, "Row0/Slide/Opts/Opt");
    var descBody = A.comp(bd, "Desc/Body", UI.Image), rowTpl = A.find(bd, "Row0");
    // the header: the step's name in large type, what is shown under it
    Z.title = text(root, "T_EvoTitle", -598, 486, 760, 90, 62, null, null);
    Z.sub = text(root, "T_EvoSub", -428, 436, 1100, 36, 24, DIM, null, 0);
    Z.subT = Z.sub;
    // sort: three chips at the top right
    var sl = text(root, "T_SortLbl", 333, 474, 120, 40, 22, DIM, cs.TMPro.TextAlignmentOptions.Right, 0); sl.text = "SORT";
    SORTS.forEach(function (s, i) { var c = chip(root, "Sort" + i, 160); c.rt.anchoredPosition = V2(500 + i * 172, 474); c.t.text = s[1]; c.key = s[0]; Z.sortChips.push(c); });
    // Tactics Plus Ultra's Starting Tactics: up to 4 picks from any tree replace the Legacy Tactics at run start
    if (bpfree()) { var st = chip(root, "StartTactics", 310); st.rt.anchoredPosition = V2(97, 474); st.start = true; Z.sortChips.unshift(st); }
    // the run starts with three dashes and three jumps (BB4.opt("triple"), applied by tripleTick below)
    var tj = chip(root, "Triple", 180); tj.rt.anchoredPosition = V2(-150, 474); tj.triple = true; tj.t.enableAutoSizing = true; tj.t.fontSizeMax = 22; tj.t.fontSizeMin = 14; Z.sortChips.unshift(tj);
    // filters: All and an element chip per element (shown when an Evotype has it), then hero, tactic and skill
    Z.filterRow = rt(root, "Filters", 0, 380, 1800, 56);
    var all = chip(Z.filterRow, "ElAll", 96); all.t.text = "All"; all.el = 0; Z.elChips.push(all);
    for (var n = 1; n <= 11; n++) {
      var c = chip(Z.filterRow, "El" + n, 104); c.el = n; c.t.text = ""; c.t.alignment = cs.TMPro.TextAlignmentOptions.Right; c.t.margin = new UE.Vector4(0, 0, 14, 0); c.t.fontSize = 22;
      c.icon = img(c.rt, "Icon", -22, 0, 38, 38, null); c.dot = img(c.rt, "Dot", -22, 0, 18, 18, null, C(elCol(n)));
      Z.elChips.push(c);
    }
    Z.heroChip = chip(Z.filterRow, "Hero", 218); Z.heroChip.t.alignment = cs.TMPro.TextAlignmentOptions.Left; Z.heroChip.t.margin = new UE.Vector4(58, 0, 10, 0);
    Z.heroChip.t.enableAutoSizing = true; Z.heroChip.t.fontSizeMax = 24; Z.heroChip.t.fontSizeMin = 15;
    Z.heroChip.head = img(Z.heroChip.rt, "Head", -80, 0, 44, 44, null);
    Z.tacChip = chip(Z.filterRow, "Tactic", 336); Z.tacChip.t.alignment = cs.TMPro.TextAlignmentOptions.Left; Z.tacChip.t.margin = new UE.Vector4(58, 0, 10, 0);
    Z.tacChip.slot = tacticSlot(Z.tacChip.rt, "Slot", -140, 0, 42); Z.tacChip.t.enableAutoSizing = true; Z.tacChip.t.fontSizeMax = 24; Z.tacChip.t.fontSizeMin = 15; Z.tacChip.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    Z.skillChip = chip(Z.filterRow, "Skill", 208);
    // the list: rows made from the board's own row (hex socket, slide, sweep), its option chips taken off
    for (var i = 0; i < ROWS; i++) {
      var g = UE.Object.Instantiate(rowTpl.gameObject, root, false); g.name = "EvoRow" + i; g.SetActive(true);
      var tr = g.transform, r = g.GetComponent(T(UE.RectTransform)), slide = A.find(tr, "Slide");
      r.anchorMin = r.anchorMax = V2(0.5, 0.5); r.pivot = V2(0.5, 0.5); r.sizeDelta = V2(LIST_W, ROW_H); r.anchoredPosition = V2(LIST_X, LIST_TOP - i * ROW_STEP);
      var opts = A.find(slide, "Opts"); for (var k = opts.childCount - 1; k >= 0; k--) UE.Object.Destroy(opts.GetChild(k).gameObject);
      var row = { tr: tr, rt: r, cg: slide.GetComponent(T(UE.CanvasGroup)), on: A.comp(slide, "On", UI.Image), glow: A.comp(slide, "Glow", UI.Image),
                  sweep: A.comp(slide, "Mask/Sweep", UI.Image), icon: A.comp(slide, "Socket/HMask/Icon", UI.Image), lit: 0, sweepAt: -9, i: i };
      ["ChevL", "ChevR"].forEach(function (p) { var ch = slide.Find(p); if (ch && !ch.Equals(null)) ch.gameObject.SetActive(false); });
      row.name = A.txt(slide, "T_Name", 34); row.sub = A.txt(slide, "T_Sub", 22, DIM, null, 0);
      row.name.overflowMode = row.sub.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
      row.name.rectTransform.sizeDelta = V2(470, 52); row.sub.rectTransform.sizeDelta = V2(470, 32);
      var nmp = row.name.rectTransform.anchoredPosition; nmp.x += 22; row.name.rectTransform.anchoredPosition = nmp;
      var sbp = row.sub.rectTransform.anchoredPosition; sbp.x += 18; row.sub.rectTransform.anchoredPosition = sbp;
      row.name.enableAutoSizing = row.sub.enableAutoSizing = true; row.name.fontSizeMax = 34; row.name.fontSizeMin = 24; row.sub.fontSizeMax = 22; row.sub.fontSizeMin = 17;
      // a mod hero has no head in the game's atlas: its portrait's face, cut as the select's grid cuts it, in the socket's mask
      var hm = A.find(slide, "Socket/HMask"); if (hm) { row.port = raw(hm, "Port", 0, 0, 10, 10); var pr0 = row.port.rectTransform; pr0.anchorMin = UE.Vector2.zero; pr0.anchorMax = UE.Vector2.one; pr0.sizeDelta = UE.Vector2.zero; row.port.gameObject.SetActive(false); }
      var bits = rt(slide, "Bits", 0, 0, LIST_W, ROW_H); row.bits = bits;
      // power: a thin gold bar along the row's foot, as long as this Evotype's share of the best one
      var track = img(bits, "PowTrack", 162 * BX, -28, 216, 5, null, new UE.Color(1, 1, 1, 0.08)); track.preserveAspect = false;
      row.seg = [0, 1, 2, 3].map(function (q) { var sg = img(bits, "Seg" + q, 50, -28, 10, 5, null, null); sg.preserveAspect = false; sg.rectTransform.pivot = V2(0, 0.5); return sg; });
      // the build's main elements: up to three icons with their share
      row.els = [0, 1, 2].map(function (e) {
        var ex = (70 + e * 74) * BX, ic = img(bits, "El" + e, ex, 8, 34, 34, null), dot = img(bits, "ElDot" + e, ex, 6, 16, 16, null), t = text(bits, "T_El" + e, ex + 38, 6, 44, 34, 25, TEXT, null, 1);
        return { ic: ic, dot: dot, t: t };
      });
      // the tactics it hands down, then the Legacy skill at the row's end
      row.tac = [0, 1, 2].map(function (e) { return tacticSlot(bits, "Tac" + e, (318 + e * 66) * BX, 0, 60); });
      row.skillBg = img(bits, "SkillRing", 532 * BX, 0, 64, 64, null, new UE.Color(0.1, 0.08, 0.14, 0.9)); row.skill = img(bits, "Skill", 532 * BX, 0, 56, 56, null);
      row.skillLv = text(bits, "T_SkillLv", 532 * BX, -32, 64, 26, 21, [0.44, 0.99, 1], cs.TMPro.TextAlignmentOptions.Center, 1);
      Z.rows.push(row);
    }
    Z.count = text(root, "T_EvoCount", LIST_X - 341, LIST_TOP - ROWS * ROW_STEP + 16, 560, 34, 22, DIM, null, 0);
    Z.scroll = img(root, "Scroll", LIST_X + LIST_W / 2 + 2, LIST_TOP - (ROWS - 1) * ROW_STEP / 2, 6, ROWS * ROW_STEP - 8, null, new UE.Color(1, 1, 1, 0.08)); Z.scroll.preserveAspect = false;
    Z.thumb = img(Z.scroll.rectTransform, "Thumb", 0, 0, 6, 80, null, C(GOLD, 0.85)); Z.thumb.preserveAspect = false;
    // the detail panel, on v4's card back (played in draw, once the panel knows its group)
    Z.cardFx = rt(root, "CardFx", PANEL_X, PANEL_Y, 100, 100);
    var pn = rt(root, "Panel", PANEL_X, PANEL_Y, PANEL_W, PANEL_H); Z.panel = pn;
    var pb = pn.gameObject.AddComponent(T(UI.Image)); pb.sprite = descBody.sprite; pb.type = descBody.sprite && descBody.sprite.border.x > 0 ? UI.Image.Type.Sliced : UI.Image.Type.Simple; pb.raycastTarget = false; Z.panelImg = pb;
    pn.gameObject.AddComponent(T(UI.Mask)).showMaskGraphic = true;
    Z.port = raw(pn, "Portrait", 0, PANEL_H / 2 - 170, PANEL_W, 340); Z.port.color = new UE.Color(1, 1, 1, 0.3);
    var fade = img(pn, "PortFade", 0, PANEL_H / 2 - 300, PANEL_W, 120, null, new UE.Color(0.04, 0.02, 0.06, 0.85)); fade.preserveAspect = false; Z.pFade = fade;
    var L = -PANEL_W / 2 + 48, TW = PANEL_W - 96, y = PANEL_H / 2;
    Z.pName = text(pn, "T_Name", L + TW / 2, y - 60, TW, 56, 46, null, null);
    Z.pPow = text(pn, "T_Pow", L + TW / 2, y - 108, TW, 40, 30, GOLD, null, 1);
    Z.pElLbl = text(pn, "T_ElLbl", L + TW / 2, y - 160, TW, 28, 20, DIM, null, 0); Z.pElLbl.text = "BUILD ELEMENTS";
    Z.pBar = rt(pn, "ElBar", 0, y - 192, TW, 14); Z.pSegs = [];
    for (var s = 0; s < 6; s++) { var sg = img(Z.pBar, "Seg" + s, 0, 0, 10, 14, null); sg.preserveAspect = false; sg.rectTransform.pivot = V2(0, 0.5); Z.pSegs.push(sg); }
    Z.pLeg = [0, 1, 2, 3].map(function (e) { var x = L + 20 + e * 140; return { ic: img(pn, "LegIc" + e, x, y - 226, 30, 30, null), dot: img(pn, "LegDot" + e, x, y - 226, 14, 14, null), t: text(pn, "T_Leg" + e, x + 70, y - 226, 104, 28, 19, TEXT, null, 0) }; });
    Z.pSkLbl = text(pn, "T_SkLbl", L + TW / 2, y - 270, TW, 28, 20, DIM, null, 0); Z.pSkLbl.text = "LEGACY SKILL";
    Z.pSkRing = img(pn, "SkRing", L + 40, y - 322, 80, 80, null, new UE.Color(0.1, 0.08, 0.14, 0.95));
    Z.pSk = img(pn, "SkIcon", L + 40, y - 322, 70, 70, null);
    Z.pSkName = text(pn, "T_SkName", L + 96 + (TW - 96) / 2, y - 300, TW - 96, 36, 28, null, null);
    Z.pSkDesc = text(pn, "T_SkDesc", L + 96 + (TW - 96) / 2, y - 348, TW - 96, 58, 19, TEXT, null, 0); Z.pSkDesc.enableWordWrapping = true; Z.pSkDesc.enableAutoSizing = true; Z.pSkDesc.fontSizeMax = 19; Z.pSkDesc.fontSizeMin = 13;
    Z.pSkDescAt = [Z.pSkDesc.rectTransform.anchoredPosition, Z.pSkDesc.rectTransform.sizeDelta]; Z.pEmptyAt = [V2(L + TW / 2, y - 140), V2(TW, 80)];
    Z.pTacLbl = text(pn, "T_TacLbl", L + TW / 2, y - 404, TW, 28, 20, DIM, null, 0); Z.pTacLbl.text = "TACTICS HANDED DOWN";
    Z.pTac = [0, 1, 2].map(function (e) {
      var yy = y - 448 - e * 58;
      return { slot: tacticSlot(pn, "PTac" + e, L + 26, yy, 52), name: text(pn, "T_PTac" + e, L + 66 + (TW - 66) / 2, yy + 10, TW - 66, 30, 24, null, null, 0), el: text(pn, "T_PTacEl" + e, L + 66 + (TW - 66) / 2, yy - 14, TW - 66, 24, 18, DIM, null, 0) };
    });
    Z.pBuildLbl = text(pn, "T_BuildLbl", L + TW / 2, y - 618, TW, 28, 20, DIM, null, 0);
    Z.pBuild = []; for (var b2 = 0; b2 < 13; b2++) Z.pBuild.push(tacticSlot(pn, "PB" + b2, L + 18 + b2 * 39, y - 660, 36));
    // v3 drew the board's thin frame and glow here; v4's card back (Z.cardFx) takes their place
    // the tactic picker: a grid of every tactic in these Evotypes
    Z.pkVeil = img(root, "PkVeil", 0, 0, 2400, 1400, null, new UE.Color(0.02, 0.01, 0.035, 0.78)); Z.pkVeil.preserveAspect = false; Z.pkVeil.gameObject.SetActive(false);
    var pk = rt(root, "Picker", 0, -10, 1060, 640); Z.pick = pk;
    var pkb = pk.gameObject.AddComponent(T(UI.Image)); pkb.sprite = pb.sprite; pkb.type = pb.type; pkb.raycastTarget = false;
    Z.pkTitle = text(pk, "T_PkTitle", 0, 270, 980, 60, 44, null, null); Z.pkTitle.text = "CHOOSE A TACTIC";
    Z.pkName = text(pk, "T_PkName", 0, -270, 980, 40, 26, GOLD, cs.TMPro.TextAlignmentOptions.Center, 1);
    Z.pkCells = [];
    for (var q = 0; q < 48; q++) {
      var cx = (q % 12 - 5.5) * 80, cy = 190 - Math.floor(q / 12) * 96;
      var cb = A.button(pk, "Cell" + q); cb.rt.anchoredPosition = V2(cx, cy); cb.rt.sizeDelta = V2(72, 72); cb.t.text = ""; cb.t.fontSize = 18;
      cb.slot = tacticSlot(cb.rt, "Slot", 0, 0, 60); cb.elBar = img(cb.rt, "ElBar", 0, -40, 44, 4, null, null); cb.elBar.preserveAspect = false; cb.sc = 1; Z.pkCells.push(cb);
    }
    pk.gameObject.SetActive(false);
    root.gameObject.SetActive(false);
    S.evo = Z; E.Z = Z;
    if (G.BB4LIT && G.BB4LIT.lgBuild) G.BB4LIT.lgBuild(Z, S);   // the mockup's light (fourlight.js)
    if (G.BB4LEGKIT && G.BB4LEGKIT.build) G.BB4LEGKIT.build(Z, S, A, E);   // ChatGPT's rebuild kit (fourlegkit.js)
  };

  // ---- which Evotypes show, in what order ----
  function refresh(S) {
    var Z = E.Z, p = S.pick, l = p.list, out = [], f = Z.f;
    for (var j = 1; j < l.length; j++) {
      var ev = l[j]; if (!ev) continue;
      if (f.el && !(prof(ev).n[f.el] > 0)) continue;
      if (f.hero > 0 && ev.id != f.hero) continue;
      if (f.hero < 0 && groupOf(ev.id) != -f.hero - 1) continue;   // a group: -(index + 1)
      if (f.tactic && tactics(ev).indexOf(f.tactic) < 0) continue;
      if (f.skill && !skillOf(ev)) continue;
      if (f.heroSet && !f.heroSet[ev.id]) continue;                 // the v5 popups: any of the heroes switched on
      if (f.elSet) { var okE = false, pn = prof(ev).n; for (var qe in f.elSet) if (pn[qe] > 0) okE = true; if (!okE) continue; }   // any of the elements switched on
      out.push(j);
    }
    var lab = function (j) { return E.A.heroLabelOf(l[j].id); };
    if (Z.sort == "hero") out.sort(function (a, b) { var x = lab(a), y = lab(b); return x < y ? -1 : x > y ? 1 : l[b].score - l[a].score; });
    else if (Z.sort == "element") out.sort(function (a, b) {
      var pa = prof(l[a]), pb = prof(l[b]), ka = f.el ? -(pa.n[f.el] || 0) / Math.max(1, pa.total) : pa.dom || 99, kb = f.el ? -(pb.n[f.el] || 0) / Math.max(1, pb.total) : pb.dom || 99;
      return ka - kb || l[b].score - l[a].score;
    });
    else if (Z.sort == "weak") out.sort(function (a, b) { return l[a].score - l[b].score; });
    else out.sort(function (a, b) { return l[b].score - l[a].score; });
    // the starred Evotypes lead the list in the chosen order (testers, 2026-11-07: the ones used most stay at the top)
    var fv = favs(); if (fv.length) { var rank = {}; out.forEach(function (j, q) { rank[j] = q; }); out.sort(function (a, b) { return (isFav(l[b]) ? 1 : 0) - (isFav(l[a]) ? 1 : 0) || rank[a] - rank[b]; }); }
    var keep = Z.view[Z.cur];
    Z.view = [0].concat(out); Z.n = l.length - 1;
    var at = Z.view.indexOf(keep); Z.cur = at >= 0 ? at : 0;
    Z.max = 1; for (var m = 1; m < l.length; m++) if (l[m] && l[m].score > Z.max) Z.max = l[m].score;
    Z.listAt = UE.Time.unscaledTime;
    // the filter choices this list has: its heroes, its elements, its tactics
    var heroes = {}, els = {}, tac = {};
    for (var k = 1; k < l.length; k++) { var e2 = l[k]; if (!e2) continue; heroes[e2.id] = 1; Object.keys(prof(e2).n).forEach(function (x) { els[x] = (els[x] || 0) + 1; }); tactics(e2).forEach(function (t) { tac[t] = (tac[t] || 0) + 1; }); }
    // the hero chip cycles: every hero, then each of v4's groups these Evotypes have, then each hero in group order
    var hl = Object.keys(heroes).map(Number).sort(function (a, b) { var ga = groupOf(a), gb = groupOf(b), x = E.A.heroLabelOf(a), y = E.A.heroLabelOf(b); return ga - gb || (x < y ? -1 : x > y ? 1 : 0); });
    var gs = []; hl.forEach(function (h) { var g = -groupOf(h) - 1; if (gs.indexOf(g) < 0) gs.push(g); });
    Z.heroes = [0].concat(gs.length > 1 ? gs : [], hl);
    Z.els = els; Z.tacN = tac;
    Z.tacs = [0].concat(Object.keys(tac).map(Number).sort(function (a, b) { var sa = seriesOf(a)[0] || 99, sb = seriesOf(b)[0] || 99; return sa - sb || tac[b] - tac[a] || a - b; })).slice(0, 48);
    layoutFilters();
  }
  // the filter row: All, the elements these Evotypes have, then hero, tactic, skill; laid out left to right
  function layoutFilters() {
    var Z = E.Z, x = -940, seq = [];
    Z.elChips.forEach(function (c) {
      var show = c.el == 0 || Z.els[c.el] > 0;
      c.rt.gameObject.SetActive(show); if (!show) return;
      var w = c.rt.sizeDelta.x; c.rt.anchoredPosition = V2(x + w / 2, 0); x += w + 12; seq.push(c);
      if (c.el) {
        var t = elTex(c.el); c.icon.sprite = t; c.icon.gameObject.SetActive(!!t); c.dot.gameObject.SetActive(!t);
        c.t.text = String(Z.els[c.el]);
      }
    });
    x += 50;
    [Z.heroChip, Z.tacChip, Z.skillChip].forEach(function (c) { var w = c.rt.sizeDelta.x; c.rt.anchoredPosition = V2(x + w / 2, 0); x += w + 16; seq.push(c); });
    Z.filterSeq = seq;
  }
  // the three chips on a player's card: the Legacy's hero, its skill (the Legacy mark when only the owner's save knows it), its first tactic
  var CHIPS = {};
  E.chipIcons = function (e) {
    if (!e || !e.id || !E.A) return [];
    var key = (e.uid || e.id) + ":" + ((e.inheritBlesses && e.inheritBlesses[0] && e.inheritBlesses[0].id) || 0);
    if (CHIPS[key]) return CHIPS[key];
    var r = [null, null, null];
    try { r[0] = E.A.headSprite(e.id); } catch (x) {}
    try { var sk = e.uid ? skillOf(e) : null; r[1] = (sk && sk.sprite) || E.A.inheritIcon; } catch (x) {}
    try { var b = e.inheritBlesses && e.inheritBlesses[0]; r[2] = b ? blessSprite(b.id) : null; } catch (x) {}
    return (CHIPS[key] = r);
  };
  E.hasSkill = function (e) { try { return !!(e && e.uid && E.A && skillOf(e)); } catch (x) { return false; } };   // index 0 is a skill too: ask the save
  // what the v5 drawing of this screen reads (fourevo5.js): the same data, names, colours and switches
  E.K = { prof: prof, skillOf: skillOf, tactics: tactics, seriesOf: seriesOf, elName: elName, elCol: elCol, blessName: blessName, blessSprite: blessSprite, dq: dq, QC: QC,
    isFav: function (ev) { return isFav(ev); }, sortLine: function (Z) { return sortLine(Z); }, sortName: sortName, chipKey: chipKey, bpfree: function () { return bpfree(); }, tripleOn: function () { return tripleOn(); },
    TRIPLE_LABEL: "Triple Dash & Jump", refresh: function (S) { refresh(S); }, act: function (S, c) { act(S, c); }, setSort: function (Z, v) { setSort(Z, v); }, tick: function () { tick(); }, inheritIcon: function () { return E.A.inheritIcon || null; }, build: function (uid) { return E.A.build(uid); },
    groupIdx: function (id) { return groupOf(id) | 0; },
    groupCol: function (id) { var g = groups()[groupOf(id)] || groups()[0]; return g && g.col ? g.col : [0.9, 0.5, 0.55]; }, groupLabel: function (i) { var g = groups()[i]; return g ? g.label : "Group"; } };
  E.on = function (S) { return !!(E.Z && E.Z.open); };
  E.ready = function () { return !!E.Z; };

  // ---- open and close with the step ----
  function sync(S) {
    var Z = E.Z, p = S.pick, want = !!(p && (p.step == "evo1" || p.step == "evo2"));
    if (want && (!Z.open || Z.step != p.step || Z.list != p.list)) {
      var fresh = !Z.open; Z.open = true; Z.step = p.step; Z.list = p.list;
      if (fresh) { Z.openAt = UE.Time.unscaledTime; Z.zone = "list"; Z.picker = false; Z.root.gameObject.SetActive(true); Z.root.SetAsLastSibling(); S.promptT.SetAsLastSibling(); if (S.verT) S.verT.SetAsLastSibling(); }
      Z.view = [p.i]; Z.cur = 0; refresh(S);
      Z.top = clamp(Z.cur - 2, 0, Math.max(0, Z.view.length - ROWS));
      log((fresh ? "open " : "step ") + p.step + ", " + (p.list.length - 1) + " Evotypes");
    }
    if (!want && Z.open) { Z.open = false; Z.picker = false; }
  }

  // ---- every frame ----
  E.draw = function (S) {
    var Z = E.Z; if (!Z) return;
    var fc = UE.Time.frameCount; if (Z.fc === fc) return; Z.fc = fc;
    sync(S);
    var t = UE.Time.unscaledTime, A = E.A, LT = G.BB4LIT && G.BB4LIT.lgFrame && Z.lit ? G.BB4LIT : null;
    Z.a += ((Z.open ? 1 : 0) - Z.a) * 0.22; if (!Z.open && Z.a < 0.02) Z.a = 0; if (Z.open && Z.a > 0.98) Z.a = 1;
    if (Z.root.gameObject.activeSelf != Z.a > 0) Z.root.gameObject.SetActive(Z.a > 0);
    Z.cg.alpha = Z.a;
    if (!Z.open) { if (G.BB4E5 && G.BB4E5.st) G.BB4E5.vis(S, Z, false); if (Z.kit) G.BB4LEGKIT.frame(Z, S, t); return; }
    var p = S.pick, l = p.list, two = p.step == "evo2", inUse = two ? p.evo2 : p.evo;
    if (LT) LT.lgFrame(Z, t);
    if (Z.cur >= Z.view.length) Z.cur = Z.view.length - 1;
    if (Z.cur < Z.top) Z.top = Z.cur; if (Z.cur > Z.top + ROWS - 1) Z.top = Z.cur - ROWS + 1;
    Z.top = clamp(Z.top, 0, Math.max(0, Z.view.length - ROWS));
    p.i = Z.view[Z.cur];                                                     // the lobby card behind shows the one under the cursor
    var ev = l[p.i], pr = prof(ev), dom = ev ? pr.dom : 0, dc = dom ? elCol(dom) : [0.85, 0.75, 0.6];
    // the v5 drawing (fourevo5.js) stands over this screen, which stays unseen; the tactic picker is still this one
    var v5 = !!(G.BB4E5 && G.BB4E5.on && G.BB4E5.on(S)) && !Z.picker;
    if (G.BB4E5 && (v5 || G.BB4E5.st)) G.BB4E5.vis(S, Z, v5);
    if (v5 && G.BB4E5.st && G.BB4E5.st.shown) {
      Z.cg.alpha = 0;
      try { G.BB4E5.frame(S, Z, ev, pr, inUse, two, t); } catch (x5) { G.BB4E5.enabled = false; log("v5 drawing stopped: " + x5 + String(x5.stack || "").slice(0, 300)); }
      return;   // the older kit layer (fourlegkit.js) does not run under the v5 drawing
    }
    // the dark behind is the hero's group veil from the select, with a little of the element under the cursor
    var gk = (groups()[groupOf(p.hero)] || groups()[0]).key, gv = VEIL[gk] || VEIL.heroes;
    var vc = Z.veil.color; Z.veil.color = new UE.Color(vc.r + (gv[0] + dc[0] * 0.05 - vc.r) * 0.08, vc.g + (gv[1] + dc[1] * 0.05 - vc.g) * 0.08, vc.b + (gv[2] + dc[2] * 0.05 - vc.b) * 0.08, 0.975);
    // v4's card back behind the panel, played again when the group changes and tinted once its parts are there
    var X = G.BB4SEL;
    if (X && Z.cardKey != gk) { Z.cardKey = gk; Z.cardTinted = false; Z.cardBack = X.kill(Z.cardBack); Z.cardBack = X.fx(Z.cardFx, "UI/Common/role_selection_004", 0, 0, CARD_S, true); }
    if (X && !Z.cardTinted && Z.cardBack) { var tc = TINT[gk]; Z.cardTinted = !tc || X.tint(Z.cardBack, tc, tc[3]); }
    Z.title.text = two ? "LEGACY II" : "LEGACY I";
    var filt = Z.f.el || Z.f.hero || Z.f.tactic || Z.f.skill;
    Z.sub.text = "for " + A.heroLabelOf(p.hero) + "   ·   " + (filt ? (Z.view.length - 1) + " of " + Z.n : Z.n) + (Z.n == 1 ? " Evotype" : " Evotypes") + (filt ? "   ·   <color=#ffd27a>filtered</color>" : "") + "   ·   " + sortLine(Z);
    // sort and filter chips
    Z.sortChips.forEach(function (c, i) {
      if (c.start) { var n = bpfree() ? bpfree().count() : 0; c.t.text = n ? "Starting Tactics " + n + "/4" : "Starting Tactics"; lightChip(c, n > 0, Z.zone == "sort" && Z.fcur == i, GOLD); return; }
      if (c.triple) { var on3 = tripleOn(); c.t.text = TRIPLE_LABEL + (on3 ? " ON" : " OFF"); lightChip(c, on3, Z.zone == "sort" && Z.fcur == i, GOLD); return; }
      if (c.key == "power") c.t.text = sortName(Z.sort == "weak" ? "weak" : "power");
      lightChip(c, chipKey(Z.sort) == c.key, Z.zone == "sort" && Z.fcur == i, null);
    });
    Z.filterSeq.forEach(function (c, i) {
      var foc = Z.zone == "filter" && Z.fcur == i;
      if (c.el !== undefined) lightChip(c, Z.f.el == c.el, foc, c.el ? elCol(c.el) : null);
      else lightChip(c, c == Z.heroChip ? !!Z.f.hero : c == Z.tacChip ? !!Z.f.tactic : !!Z.f.skill, foc, null);
    });
    var fg = Z.f.hero < 0 ? groups()[-Z.f.hero - 1] : null;
    var hs = Z.f.hero > 0 ? A.headSprite(Z.f.hero) : null; Z.heroChip.head.sprite = hs; Z.heroChip.head.gameObject.SetActive(!!hs);
    Z.heroChip.t.text = fg ? "<color=#" + hex(fg.col) + ">" + fg.label + "</color>" : Z.f.hero ? A.heroLabelOf(Z.f.hero) : "Every hero"; Z.heroChip.t.margin = new UE.Vector4(hs ? 58 : 16, 0, 10, 0);
    setTactic(Z.tacChip.slot, Z.f.tactic ? { id: Z.f.tactic, quality: 4 } : null);
    Z.tacChip.t.text = Z.f.tactic ? blessName(Z.f.tactic) : "Any tactic"; Z.tacChip.t.margin = new UE.Vector4(Z.f.tactic ? 58 : 52, 0, 10, 0);
    Z.tacChip.t.alignment = Z.f.tactic ? cs.TMPro.TextAlignmentOptions.Left : cs.TMPro.TextAlignmentOptions.Center;
    Z.skillChip.t.text = Z.f.skill ? "With Legacy skill" : "Any skill";
    // rows
    var u0 = (t - (Z.listAt || 0)), dy = 0;
    Z.rows.forEach(function (row, i) {
      var k = Z.top + i, show = k < Z.view.length;
      if (row.tr.gameObject.activeSelf != show) row.tr.gameObject.SetActive(show);
      if (!show) return;
      var j = Z.view[k], e = l[j], foc = k == Z.cur && Z.zone == "list" && !Z.picker;
      A.lightRow(row, foc, false, t); if (LT) LT.lgRow(Z, row, foc, t);
      // rows come in on the select's group-change rhythm: 2 frames apart, 8 frames each, 24 px
      var u = ease((u0 - i * ROW_GAP) / ROW_IN);
      row.cg.alpha = u; var rp = row.rt.anchoredPosition; rp.x = LIST_X + (1 - u) * ROW_PX + FOC_DX * row.lit; rp.y = LIST_TOP - i * ROW_STEP - dy; row.rt.anchoredPosition = rp;
      dy += FOC_GAP * row.lit;   // the rows under the focused one step down, as it lights
      var using = e ? !!(inUse && e.uid == inUse.uid) : !inUse, tag = using ? "  <size=70%><color=#8fe39a>IN USE</color></size>" : "";
      if (!e) {
        row.name.text = "No Legacy" + tag; row.sub.text = two ? "Play with Legacy I only" : "Start the run without one";
        if (row.ik != "none") { row.icon.sprite = A.inheritIcon; row.icon.gameObject.SetActive(true); if (row.port) row.port.gameObject.SetActive(false); row.ik = "none"; } row.icon.color = new UE.Color(1, 0.86, 0.62, 1);
        row.bits.gameObject.SetActive(false); return;
      }
      row.bits.gameObject.SetActive(true);
      var ep = prof(e), sk = skillOf(e), kept = e.inheritBlesses || [];
      row.name.text = (isFav(e) ? STAR : "") + A.heroLabelOf(e.id) + "   <size=72%><color=#ffd27a>" + Math.round(e.score) + "</color></size>" + tag;
      row.sub.text = kept.length + " handed down" + (ep.total ? "  ·  " + ep.total + " in build" : "");
      var ik = "h" + e.id; if (row.ik != ik) { row.ik = ik; headInto(row, e.id); } row.icon.color = new UE.Color(1, 1, 1, 1);
      var ws = 216 * clamp(e.score / Z.max, 0.04, 1), st = 0, sx = 162 * BX - 108; ep.list.forEach(function (it) { st += it[1]; });
      row.seg.forEach(function (sg, q) { var it = ep.list[q], on = !!it && st > 0; sg.gameObject.SetActive(on); if (!on) return; var w = ws * it[1] / st; sg.rectTransform.anchoredPosition = V2(sx, -28); sg.rectTransform.sizeDelta = V2(Math.max(1, w - 1), 5); sg.color = C(elCol(it[0]), 0.95); sx += w; });
      row.els.forEach(function (x, q) {
        var it = ep.list[q], on = !!it; x.t.gameObject.SetActive(on); x.ic.gameObject.SetActive(false); x.dot.gameObject.SetActive(false); if (!on) return;
        var tx = elTex(it[0]); if (tx) { x.ic.sprite = tx; x.ic.gameObject.SetActive(true); } else { x.dot.color = C(elCol(it[0])); x.dot.gameObject.SetActive(true); }
        x.t.text = String(Math.round(it[1])); x.t.color = C(elCol(it[0]));
      });
      row.tac.forEach(function (s, q) { setTactic(s, kept[q] || null); });
      var ss = sk && (sk.sprite || E.A.inheritIcon); row.skill.sprite = ss; row.skill.gameObject.SetActive(!!ss); row.skillBg.gameObject.SetActive(!!sk);
      row.skillLv.text = sk ? "Lv " + sk.level : "";
    });
    var nv = Z.view.length;
    // No Legacy takes the first row and is not an Evotype: the count names it rather than "1–5" under six rows
    var r0 = Math.max(Z.top, 1), r1 = Math.min(nv - 1, Z.top + ROWS - 1), rng = (r0 == r1 ? r0 : r0 + "–" + r1) + " of " + (nv - 1);
    Z.count.text = nv - 1 > 0 && (nv > ROWS || filt) ? (Z.top == 0 ? "No Legacy, then " + rng : rng) : nv == 1 && filt ? "No Evotype matches these filters" : "";
    Z.scroll.gameObject.SetActive(nv > ROWS);
    if (nv > ROWS) { var H = ROWS * ROW_STEP - 8, th = Math.max(40, H * ROWS / nv), tr2 = Z.thumb.rectTransform; tr2.sizeDelta = V2(6, th); tr2.anchoredPosition = V2(0, H / 2 - th / 2 - (H - th) * Z.top / (nv - ROWS)); }
    var pev = ev; if (Z.zone != "list" && !ev && Z.view.length > 1) pev = l[Z.view[1]];
    drawPanel(S, pev, pev === ev ? pr : prof(pev), sk2(pev));
    drawPicker(S);
    if (Z.kit) G.BB4LEGKIT.frame(Z, S, t);
  };
  function sk2(ev) { return ev ? skillOf(ev) : null; }
  // a row's head: the atlas head when the hero has one, otherwise the select grid's face cut from the portrait (fourlobbyui.js)
  function headInto(row, id) {
    var A = E.A, hs = A.headSprite(id), tex = !hs && row.port ? A.heroTexture(id, A.skinOf(id)) : null;
    if (tex) {
      var r = A.measure(tex), s = 0.4, hv = s * tex.width / tex.height;
      row.port.texture = tex; row.port.uvRect = new UE.Rect(clamp(r.cx - s / 2, 0, 1 - s), clamp(1 - r.top - hv + 0.01, 0, 1 - hv), s, hv);
    }
    if (row.port) row.port.gameObject.SetActive(!!tex);
    row.icon.sprite = hs || A.inheritIcon; row.icon.gameObject.SetActive(!tex);
  }
  function sortLine(Z) {
    if (Z.sort == "hero") return "by hero, then power";
    if (Z.sort == "element") return Z.f.el ? "most " + elName(Z.f.el) + " first" : "by main element, then power";
    if (Z.sort == "weak") return "weakest first";
    return "strongest first";
  }
  function drawPanel(S, ev, pr, sk) {
    var Z = E.Z, A = E.A, p = S.pick, two = p.step == "evo2";
    if (Z.pFor === (ev ? ev.uid : "none")) return; Z.pFor = ev ? ev.uid : "none"; Z.panelAt = UE.Time.unscaledTime;
    var showAll = !!ev;
    [Z.pPow, Z.pElLbl, Z.pBar, Z.pSkLbl, Z.pTacLbl, Z.pBuildLbl].forEach(function (x) { (x.gameObject || x).SetActive(showAll); });
    Z.pLeg.forEach(function (x) { x.ic.gameObject.SetActive(false); x.dot.gameObject.SetActive(false); x.t.gameObject.SetActive(false); });
    if (!ev) {
      Z.pName.text = "No Legacy"; Z.port.texture = null; Z.port.gameObject.SetActive(false);
      Z.pSk.gameObject.SetActive(false); Z.pSkName.text = ""; Z.pSkDesc.text = two ? "Play with Legacy I only." : "Start the run with no Legacy: no tactics or skill handed down.";
      Z.pFade.gameObject.SetActive(false); Z.pSkRing.gameObject.SetActive(false);
      Z.pSkDesc.rectTransform.anchoredPosition = Z.pEmptyAt[0]; Z.pSkDesc.rectTransform.sizeDelta = Z.pEmptyAt[1]; Z.pSkDesc.color = C(DIM);
      Z.pTac.forEach(function (x) { setTactic(x.slot, null); x.name.text = ""; x.el.text = ""; }); Z.pBuild.forEach(function (s) { setTactic(s, null); });
      return;
    }
    Z.pFade.gameObject.SetActive(true); Z.pSkRing.gameObject.SetActive(true);
    Z.pSkDesc.rectTransform.anchoredPosition = Z.pSkDescAt[0]; Z.pSkDesc.rectTransform.sizeDelta = Z.pSkDescAt[1]; Z.pSkDesc.color = C(TEXT);
    Z.pName.text = A.heroLabelOf(ev.id);
    Z.pPow.text = "POWER  " + Math.round(ev.score);
    var tx = A.heroTexture(ev.id, A.skinOf(ev.id));
    Z.port.gameObject.SetActive(!!tx);
    if (tx) { var r = A.measure(tex2(tx)), s = 0.62, hv = s * tx.width / tx.height * (340 / PANEL_W); Z.port.texture = tx; Z.port.uvRect = new UE.Rect(clamp(r.cx - s / 2, 0, 1 - s), clamp(1 - r.top - hv + 0.02, 0, 1 - hv), s, hv); }
    // the element mix: one bar, a segment per element, the four largest named
    var W = PANEL_W - 96, x = -W / 2, tot = 0; pr.list.forEach(function (it) { tot += it[1]; });
    Z.pSegs.forEach(function (sg, i) {
      var it = pr.list[i]; sg.gameObject.SetActive(!!it && tot > 0); if (!it || !tot) return;
      var w = W * it[1] / tot; sg.rectTransform.anchoredPosition = V2(x + 1, 0); sg.rectTransform.sizeDelta = V2(Math.max(2, w - 2), 14); sg.color = C(elCol(it[0])); x += w;
    });
    Z.pLeg.forEach(function (lg, i) {
      var it = pr.list[i]; if (!it) return;
      var t2 = elTex(it[0]); if (t2) { lg.ic.sprite = t2; lg.ic.gameObject.SetActive(true); } else { lg.dot.color = C(elCol(it[0])); lg.dot.gameObject.SetActive(true); }
      lg.t.gameObject.SetActive(true); lg.t.text = elName(it[0]) + " " + Math.round(it[1]); lg.t.color = C(elCol(it[0]));
    });
    if (!pr.list.length) { Z.pLeg[0].t.gameObject.SetActive(true); Z.pLeg[0].t.text = "No build saved"; Z.pLeg[0].t.color = C(DIM); }
    // the Legacy skill
    var ps = sk && (sk.sprite || E.A.inheritIcon); Z.pSk.sprite = ps; Z.pSk.gameObject.SetActive(!!ps);
    Z.pSkName.text = sk ? (sk.name || "Legacy skill") + "   <size=75%><color=#70fdff>Lv " + sk.level + "</color></size>" : "<color=#8a8698>No Legacy skill</color>";
    Z.pSkDesc.text = sk ? sk.desc || "" : "This Evotype hands down no skill.";
    // the tactics handed down
    var kept = ev.inheritBlesses || [];
    Z.pTac.forEach(function (x, i) {
      var b = kept[i]; setTactic(x.slot, b || null);
      if (!b) { x.name.text = i == 0 ? "<color=#8a8698>None</color>" : ""; x.el.text = ""; return; }
      var d = dq(b.id, b.quality), s1 = seriesOf(b.id);
      x.name.text = blessName(b.id); x.name.color = C(QC[d] || QC[1]);
      x.el.text = s1.map(elName).join(" + ") || "Tactic";
    });
    // the whole build
    var bl = E.A.build(ev.uid) || [];
    Z.pBuildLbl.text = bl.length ? "THE WHOLE BUILD  ·  " + bl.length + (bl.length > Z.pBuild.length ? "  (first " + Z.pBuild.length + ")" : "") : "THE WHOLE BUILD  ·  not saved";
    Z.pBuild.forEach(function (s, i) { setTactic(s, bl[i] || null); });
  }
  function tex2(t) { return t; }
  function drawPicker(S) {
    var Z = E.Z, on = !!Z.picker;
    if (Z.pick.gameObject.activeSelf != on) { Z.pick.gameObject.SetActive(on); Z.pkVeil.gameObject.SetActive(on); if (on) Z.pickAt = UE.Time.unscaledTime; }
    if (!on) return;
    Z.pkCells.forEach(function (c, i) {
      var id = Z.tacs[i], show = i < Z.tacs.length; c.rt.gameObject.SetActive(show); if (!show) return;
      E.A.lightBtn(c, i == Z.pcur, true);
      if (i == 0) { setTactic(c.slot, null); c.t.text = "Any"; c.elBar.color = new UE.Color(1, 1, 1, 0.25); } else { setTactic(c.slot, { id: id, quality: 4 }); c.t.text = ""; c.elBar.color = C(elCol(seriesOf(id)[0] || 8), 0.9); }
      var fz = i == Z.pcur; c.sc += ((fz ? 1.16 : 1) - c.sc) * 0.35; c.rt.localScale = new UE.Vector3(c.sc, c.sc, 1); if (fz) c.rt.SetAsLastSibling();
    });
    var id2 = Z.tacs[Z.pcur];
    var n2 = id2 ? Z.tacN[id2] || 0 : 0;
    Z.pkName.text = id2 ? blessName(id2) + "   <size=75%><color=#a8a4b8>" + seriesOf(id2).map(elName).join(" + ") + "   ·   in " + n2 + (n2 == 1 ? " Evotype" : " Evotypes") + "</color></size>" : "Any tactic   <size=75%><color=#a8a4b8>show every Evotype</color></size>";
  }

  // ---- input ----
  function step(S, d) { var Z = E.Z; Z.cur = clamp(Z.cur + d, 0, Z.view.length - 1); }
  function tick() { var X = G.BB4SEL; if (X && X.sfx) X.sfx("sfx_ui_51"); }   // the select's cursor sound
  function bpfree() { try { globalThis.BPFREE || require("Core/ActorUtil"); } catch (x) {} var b = globalThis.BPFREE; return b && b.open && b.count ? b : null; }
  // input belongs to the tree window while it is up
  function treeUp() { var b = globalThis.BPFREE; return !!(b && (b.picking || b.opening)); }

  // ---- favourites: Evotypes starred with R3 / R lead the list; the uids are kept in the menus' settings file (BB4.opts) ----
  var STAR = "<color=#ffd27a>★</color> ";
  function favs() { try { return B.opt("favEvos") || []; } catch (x) { return []; } }
  function isFav(ev) { return !!ev && favs().indexOf(String(ev.uid)) >= 0; }
  function curEvo(S) { var Z = E.Z, p = S.pick; if (!Z || !Z.open || !p || Z.zone != "list" || Z.picker) return null; return p.list[Z.view[Z.cur]] || null; }
  // a row or the panel drawn from an Evotype is drawn again after a star or a skill change
  function redraw(uid) {
    var Z = E.Z; if (!Z) return; Z.pFor = null;
    var k = Z.kit; if (k) { k.pFor = null; (k.rows || []).forEach(function (R) { R.key = null; }); }
    for (var c in CHIPS) if (c.indexOf(String(uid) + ":") == 0) delete CHIPS[c];
  }
  E.fav = function (S) {
    var Z = E.Z, ev = curEvo(S); if (!ev || treeUp()) { var X0 = G.BB4SEL; if (X0 && X0.sfx && Z && Z.open) X0.sfx("sfx_ui_13"); return false; }
    var l = favs().slice(), u = String(ev.uid), at = l.indexOf(u), on = at < 0;
    if (on) l.push(u); else l.splice(at, 1);
    B.setOpt("favEvos", l);
    var X = G.BB4SEL; if (X && X.sfx) X.sfx(on ? "sfx_ui_55" : "sfx_ui_51");
    log((on ? "starred " : "unstarred ") + ev.id + "/" + u + ", " + l.length + " starred");
    refresh(S); redraw(u); return true;
  };

  // ---- the Legacy skill: an Evotype whose hero has two hands one of them down. The stock Evotype screen's switch
  // (SceneUIFesSelect.OnSwitchInheritSkill, also FesActorSelect_Mobile): the next index, allowed once the hero's Boss Rush
  // is finished (GetBossRushFinishedRecord), else its CanNotSwitchInheritSkill text; the change is the game's own request
  // (BattleResultNetWorkHandler.SelectInheritSkill), which also sets the skill's level as the game does ----
  function skillCount(ev) { try { var c = require("Gen/Xlsx").Xlsx.BaseActorConf.Get(ev.id); return c && c.inheritSkill ? c.inheritSkill.length : 0; } catch (x) { return 0; } }
  E.switchSkill = async function (S) {
    var Z = E.Z, X = G.BB4SEL, ev = curEvo(S);
    function no(msg) { if (X && X.sfx) X.sfx("sfx_ui_13"); if (msg && E.A.toast) E.A.toast(msg); return false; }
    if (!ev || treeUp() || E.switching) return no(null);
    var n = skillCount(ev); if (n < 2) return no(E.A.heroLabelOf(ev.id) + " has one Legacy skill");
    E.switching = true;
    try {
      var NH = require("GamePlay/BattleResult/BattleResultNetWorkHandler").default, U0 = U();
      var done = await NH.GetBossRushFinishedRecord();
      if (!done || !done.includes(ev.id)) { var t = ""; try { t = String(U0.GetLocale("CanNotSwitchInheritSkill") || ""); } catch (x) {} return no(t && t != "CanNotSwitchInheritSkill" ? t : "Finish " + E.A.heroLabelOf(ev.id) + "'s Boss Rush to switch the Legacy skill"); }
      var from = ev.inheritSkillIndex | 0, to = (from + 1) % n;
      await NH.SelectInheritSkill(ev.uid, to);
      var fa = require("DataBinding").DB.FesActor.GetData(ev.uid), sv = fa && fa.server;
      if (!sv) return no("The game did not switch the Legacy skill");
      E.A.setRaw(ev.uid, sv);
      ev.inheritSkillIndex = sv.inheritSkillIndex | 0; ev.inheritSkillLevel = sv.inheritSkillLevel | 0;
      delete cache.skill[ev.uid]; E.skillRev = (E.skillRev | 0) + 1; redraw(ev.uid);   // 0.1.17: the v5 sheet redraws on this count (Fury: the skill's text did not follow a switch)
      if (X && X.sfx) X.sfx("sfx_ui_158");
      var sk = skillOf(ev); log("Legacy skill of " + ev.id + "/" + ev.uid + ": " + from + " -> " + ev.inheritSkillIndex + (sk ? " (" + sk.id + ")" : ""));
      if (E.A.toast) E.A.toast("Legacy skill: " + (sk && sk.name ? sk.name : "switched"));
      return true;
    } catch (x) { log("skill switch: " + B.es(x)); return no("The Legacy skill could not be switched"); }
    finally { E.switching = false; }
  };

  // ---- triple dash and jump at run start: the game's own Triple Dash and Triple Jump triggers (PlayerBattleTriggerDetail
  // 11801 and 11741, what the heroes' own cards add through OPFunc AddTrigger with RefreshSkill), put on the hero in a run.
  // Checked once a second; a hero that already has one (its own card) is left as it is. Never in a Four Player lobby or
  // fight: every PC there plays every hero and only this one would know ----
  var TRIPLE = [11801, 11741], TRIPLE_LABEL = "Triple Dash & Jump";
  function tripleOn() { try { return !!B.opt("triple"); } catch (x) { return false; } }
  var HTRIPLE = {};
  function heroTriple(base) {
    if (HTRIPLE[base]) return HTRIPLE[base];
    var out = [];
    try {
      var X = require("Gen/Xlsx").Xlsx;
      X.BaseActorPotentialConf.All.forEach(function (p) {
        if (p.actorId != base || !p.triggerInfo) return;
        var d = X.PlayerBattleTriggerDetail.Get(p.triggerInfo.id, p.triggerInfo.level || 1);
        if (d && d.OPFunc == "AddTrigger" && /^Id:(11801|11741)(,RefreshSkill:1)?$/.test(String(d.OPParams)) && out.indexOf(p.triggerInfo.id) < 0) out.push(p.triggerInfo.id);
      });
    } catch (x) { log("triple cards of " + base + ": " + B.es(x)); }
    return (HTRIPLE[base] = out);
  }
  E.tripleTick = function (testRoom) {   // testRoom: the test room (not a run) may call it, to see what a run would add
    if (!tripleOn()) return "off";
    var L = G.BB4L; if (L && L.state && L.state != "none") return "four-player lobby";
    var b = null; try { b = require("GamePlay/Battle/BattleJs").default.Instance; } catch (x) {}
    if (!b || (b.BattleClassName != "BattleBreed" && !(testRoom && b.BattleClassName == "BattleTryout"))) return "not in a run";
    var pl = b.Battle && b.Battle.PlayerSelf; if (!pl || pl.Equals(null) || !pl.TriggerMgr) return "no hero";
    var added = [];
    // 0.1.26 (Fury, 2026-11-16: the switch did nothing for some added heroes): a hero whose dash and jump rows wait on their own card (Reki's
    // 21122 / 21119, Ex Hakumen's 19214) is not opened by the stock triggers alone. Its Triple Dash and Triple Jump cards are the Potentials
    // whose trigger is only "AddTrigger 11801 / 11741"; the hero gets those trigger nodes too, as if it held the cards.
    var own = heroTriple(pl.BaseID);
    TRIPLE.concat(own).forEach(function (id) {
      try {
        if (pl.TriggerMgr.FindTrigger(id, true)) return;
        var nd = cs.GamePlay.PlayerTriggerMgr.NewTriggerNode(id, 1);
        if (nd && pl.TriggerMgr.AddTriggerNode(nd)) { nd.Tag = "bb4triple"; pl.TriggerMgr.TriggerNodeStartOnInstantAdded(nd); added.push(id); }
      } catch (x) { if (!E.tripleErr) { E.tripleErr = true; log("triple " + id + ": " + B.es(x)); } }
    });
    if (added.length) { try { pl.SkillMgr.MarkSkillChainNeedRebuild(); } catch (x) {} log("triple dash and jump: triggers " + added.join(", ") + " on " + pl.BaseID); }
    return added.length ? "added " + added.join(",") : "on";
  };
  if (E.tripleTimer) clearInterval(E.tripleTimer);
  E.tripleTimer = setInterval(function () { try { E.tripleTick(); } catch (x) {} }, 1000);
  function act(S, c) {
    var Z = E.Z;
    if (c.start) { if (bpfree()) bpfree().open(); return; }
    if (c.triple) { var v = !tripleOn(); B.setOpt("triple", v); tick(); log("triple dash and jump " + (v ? "on" : "off")); return; }
    // the Power chip pressed again turns the order over (strongest first, weakest first)
    if (c.key) { setSort(Z, c.key == "power" && Z.sort == "power" ? "weak" : c.key); refresh(S); return; }
    if (c.el !== undefined) { Z.f.el = Z.f.el == c.el ? 0 : c.el; if (Z.f.el && Z.sort != "element") setSort(Z, "element"); refresh(S); return; }
    if (c == Z.heroChip) { var i = Z.heroes.indexOf(Z.f.hero); Z.f.hero = Z.heroes[(i + 1) % Z.heroes.length]; refresh(S); return; }
    if (c == Z.skillChip) { Z.f.skill = Z.f.skill ? 0 : 1; refresh(S); return; }
    if (c == Z.tacChip) { Z.picker = true; Z.pcur = Math.max(0, Z.tacs.indexOf(Z.f.tactic)); return; }
  }
  E.move = function (S, dx, dy) {
    var Z = E.Z; if (!Z || !Z.open) return false; if (treeUp()) return true;
    if (G.BB4E5 && G.BB4E5.input) { var r5 = G.BB4E5.input(S, "move", dx, dy); if (r5 != null) return r5; }
    var was = Z.zone + Z.cur + "/" + Z.fcur + "/" + Z.pcur, r = move(S, dx, dy);
    if (Z.zone + Z.cur + "/" + Z.fcur + "/" + Z.pcur != was) tick();
    return r;
  };
  // Y: to the filter row and back (fourlobbyui.js routes the colours button here on a Legacy step)
  E.filters = function (S) {
    var Z = E.Z; if (!Z || !Z.open || Z.picker || treeUp()) return false;
    if (Z.zone == "list") { Z.zone = "filter"; Z.fcur = clamp(Z.fcur || 0, 0, Z.filterSeq.length - 1); } else Z.zone = "list";
    tick(); return true;
  };
  function move(S, dx, dy) {
    var Z = E.Z;
    if (Z.picker) {
      var n = Z.tacs.length; if (dx) Z.pcur = clamp(Z.pcur + dx, 0, n - 1); if (dy) Z.pcur = clamp(Z.pcur + (dy > 0 ? -12 : 12), 0, n - 1); return true;
    }
    if (Z.zone == "list") {
      if (dy > 0 && Z.cur == 0) { Z.zone = "filter"; Z.fcur = clamp(Z.fcur || 0, 0, Z.filterSeq.length - 1); return true; }
      if (dy) step(S, dy > 0 ? -1 : 1);
      if (dx) step(S, dx * ROWS);
      return true;
    }
    if (Z.zone == "filter") {
      if (dy < 0) { Z.zone = "list"; return true; }
      if (dy > 0) { Z.zone = "sort"; Z.fcur = 0; return true; }
      Z.fcur = clamp(Z.fcur + dx, 0, Z.filterSeq.length - 1); return true;
    }
    if (Z.zone == "sort") {
      if (dy < 0) { Z.zone = "filter"; Z.fcur = 0; return true; }
      Z.fcur = clamp(Z.fcur + dx, 0, Z.sortChips.length - 1); return true;
    }
    return true;
  }
  E.page = function (S, d) { var Z = E.Z; if (!Z || !Z.open) return false; var i = Math.max(0, CYCLE.indexOf(Z.sort)); setSort(Z, CYCLE[(i + d + CYCLE.length) % CYCLE.length]); refresh(S); return true; };
  E.press = function (S) {
    var Z = E.Z; if (!Z || !Z.open) return false; if (treeUp()) return true;
    if (G.BB4E5 && G.BB4E5.input) { var r5 = G.BB4E5.input(S, "press"); if (r5 != null) return r5; }
    if (Z.picker) { Z.f.tactic = Z.tacs[Z.pcur] || 0; Z.picker = false; refresh(S); return true; }
    if (Z.zone == "filter") { act(S, Z.filterSeq[Z.fcur]); return true; }
    if (Z.zone == "sort") { act(S, Z.sortChips[Z.fcur]); return true; }
    S.pick.i = Z.view[Z.cur]; E.A.confirmPick(); return true;
  };
  E.back = function (S) {
    var Z = E.Z; if (!Z || !Z.open) return false; if (treeUp()) return true;
    if (G.BB4E5 && G.BB4E5.input) { var r5 = G.BB4E5.input(S, "back"); if (r5 != null) return r5; }
    if (Z.picker) { Z.picker = false; return true; }
    if (Z.zone != "list") { Z.zone = "list"; return true; }
    E.A.cancelPick(); return true;
  };
  E.prompts = function (S) {
    var Z = E.Z; if (!Z) return [[9, "Choose"], [10, "Back"]];
    var name = sortName(Z.sort);
    if (Z.picker) return [[9, "Filter"], [10, "Back"]];
    if (Z.zone != "list") return [[9, "Set"], [10, "Back to the list"], [33, "List"]];
    var v5e = !!(G.BB4E5 && G.BB4E5.st && G.BB4E5.st.shown);   // 0.1.17: on the v5 menu LB / RB swap Legacy I and II (Fury); the order is on its own button there
    var it = [[9, "Choose"], [10, "Back"], [33, "Filters"], [16, "", 17, v5e ? "Legacy I / II" : "Sort: " + name]], ev = curEvo(S);
    if (ev) { if (skillCount(ev) > 1) it.push([30, "Legacy skill"]); it.push([73, isFav(ev) ? "Unstar" : "Star"]); }
    return it;
  };
  // the mouse: rows, chips and grid cells point and click; the wheel scrolls the list
  E.mouse = function (S, mp, click, wheel, moved, over) {
    var Z = E.Z; if (!Z || !Z.open) return false; if (treeUp()) return true;
    if (!Z.picker && G.BB4E5 && G.BB4E5.st && G.BB4E5.st.shown) { if (click) G.BB4E5.pend = [mp.x, mp.y]; if (wheel) { Z.zone = "list"; Z.cur = clamp(Z.cur + (wheel > 0 ? -1 : 1), 0, Z.view.length - 1); } return true; }   // the v5 drawing takes its own clicks
    if (Z.picker) {
      if (!moved && !click) return true;
      var hc = -1; Z.pkCells.forEach(function (c, i) { if (hc < 0 && c.rt.gameObject.activeSelf && over(c.rt, mp)) hc = i; });
      if (hc >= 0) { Z.pcur = hc; if (click) E.press(S); } else if (click && !over(Z.pick, mp)) Z.picker = false;
      return true;
    }
    if (wheel) { Z.top = clamp(Z.top + (wheel > 0 ? -1 : 1), 0, Math.max(0, Z.view.length - ROWS)); Z.cur = clamp(Z.cur, Z.top, Z.top + ROWS - 1); Z.cur = Math.min(Z.cur, Z.view.length - 1); }
    if (!moved && !click) return true;
    var hit = null;
    Z.rows.forEach(function (row, i) { if (!hit && row.tr.gameObject.activeSelf && over(row.rt, mp)) hit = function () { Z.zone = "list"; Z.cur = Z.top + i; if (click) E.press(S); }; });
    Z.filterSeq.forEach(function (c, i) { if (!hit && c.rt.gameObject.activeSelf && over(c.rt, mp)) hit = function () { Z.zone = "filter"; Z.fcur = i; if (click) act(S, c); }; });
    Z.sortChips.forEach(function (c, i) { if (!hit && over(c.rt, mp)) hit = function () { Z.zone = "sort"; Z.fcur = i; if (click) act(S, c); }; });
    if (hit) hit();   // a click on empty space does nothing: Esc or the right button backs out
    return true;
  };
  // what the kit reads the records with
  E._ = { prof: prof, skillOf: skillOf, elTex: elTex, elCol: elCol, elName: elName, blessSprite: blessSprite, blessName: blessName, qualBg: qualBg,
    tactics: tactics, sortLine: sortLine, refresh: refresh, setTactic: setTactic, headInto: headInto, seriesOf: seriesOf, dq: dq, act: act,
    QC: QC, EL: EL, SORTS: SORTS, chipKey: chipKey, sortName: sortName, ROWS: ROWS, isFav: isFav, tripleOn: tripleOn, TRIPLE_LABEL: TRIPLE_LABEL, STAR: STAR };
  log("ready");
})();
