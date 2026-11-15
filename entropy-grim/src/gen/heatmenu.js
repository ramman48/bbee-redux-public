/* Entropy Overhaul: Grim of the Abyss -- Entropy menu additions (appended to gameplay/heat/HeatMenu).
   - a 4th carousel tab GRIM (104), a UI-only pseudo mode showing Extreme's data (the save keeps Extreme's loadout);
   - Abyss rows (HeatConf ids 24-40) only on the Grim tab: leaving it zeroes and stashes their ranks;
   - Grim's own perks (HeatEffectConf 30-45, Mode 4) and free Mutations (ExpertModeConf 6+) only on the Grim tab, each in
     its own layout; Extreme's perks and Mutations only on the Extreme tab (Grim runs get every Extreme perk anyway);
   - Grim's own "what this mode gives you" entries (HeatAdditionalContentConf Mode 104);
   - the Extreme tab stays capped at 100; the Grim tab uses the quota (125 / 150 / 175);
   - a scrolling modifier list (mask + ScrollRect + smooth follow of the selected row);
   - light-blue theme + motion (emblem pulse, periodic sweep) while the Grim tab shows;
   - a 5th tab ENDLESS (105, 2026-09-29; the lead: "a new seperate mode ... just like you did for grim") with Endless's
     presentation (src/endless_ui.js). 0.10.0 (DESIGN 6.9; the lead: "endless should have all the mutations and stuff
     for extreme and grim ... from zero ... to 200"): the stock and Abyss rows, Grim's perks plus Endless's own, all ten
     Mutations, a limit of 200. Grim and Endless share the Abyss ranks; what a tab doesn't allow is stashed.
   Design: docs/entropy-overhaul/DESIGN.md section 7; decisions: DECISIONS.md 2026-09-28. */
;(() => {
  try {
  /* module references are read lazily: HeatUtil and HeatMenu can load in a circular order at boot, when
     HeatUtil_1.default is still undefined (0.2.0 hung the game on the warning screen doing this at load) */
  var GRIM = 104, ENDLESS = 105, ABYSS_MIN = 24, ABYSS_MAX = 40, CS = csharp_1;
  function GG() { var h = HeatUtil_1.default; return h && h.GrimG ? h.GrimG() : (globalThis.__GRIM = globalThis.__GRIM || {}) }
  function HU() { return HeatUtil_1.default }
  var logged = {};
  function log(k, m) {
    if (logged[k]) return; logged[k] = 1;
    try { CS.System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM menu " + m + "\n") } catch (x) {}
  }
  function isAbyss(id) { return id >= ABYSS_MIN && id <= ABYSS_MAX }          /* this mod's row block: Abyss and Endless rows */
  function isEndlessRow(id) { return id >= 33 && id <= ABYSS_MAX }               /* Endless's own rows (0.10.0) */
  function isGrimPerk(id) { return id >= 30 && id <= 37 }
  function isEndlessPerk(id) { return id >= 38 && id <= 45 }
  function isGrimMut(id) { return id >= 6 }
  /* what each tab lists and carries: 0 = Extreme (or a read-only view), GRIM, ENDLESS */
  function tabOf(w) { return w.readonlyMode ? 0 : w.grimTab ? GRIM : w.endlessTab ? ENDLESS : 0 }
  function perkOn(tab, id) { return tab === ENDLESS ? isGrimPerk(id) || isEndlessPerk(id) : tab === GRIM ? isGrimPerk(id) : !(isGrimPerk(id) || isEndlessPerk(id)) }
  function mutOn(tab, id) { return tab === ENDLESS ? true : tab === GRIM ? isGrimMut(id) : !isGrimMut(id) }
  /* the loadout items only some tabs may carry (all other ranks, perks and Mutations are Extreme's, shared by every tab) */
  /* HeatConf 11 (hides Space info) is Extreme's only (balance A, 0.14.2); 17's stash holds a rank IV off the Extreme tab */
  function ours(kind, id) { return kind === "rank" ? isAbyss(id) || id == 11 : kind === "perk" ? isGrimPerk(id) || isEndlessPerk(id) : isGrimMut(id) }
  function allowed(tab, kind, id) {
    if (kind === "rank" && id == 11) return !tab;
    if (kind === "rank" && id == 17) return !!tab;
    return tab === ENDLESS || tab === GRIM && (kind === "rank" ? isAbyss(id) && !isEndlessRow(id) : kind === "perk" ? isGrimPerk(id) : true)
  }
  function V2(x, y) { return new CS.UnityEngine.Vector2(x, y) }
  var P = HeatMenu.prototype;

  /* ---------------- the Extreme tab is capped at 100; the Grim tab uses the quota ---------------- */
  Object.defineProperty(P, "maxHeatVal", {
    configurable: true,
    get() {
      var v = 0; try { v = require("Misc").Misc.heatMisc.levelMaxSanMap[this.CurHeatLevel] ?? 0 } catch (x) {}
      return this.endlessTab && !this.readonlyMode ? (HeatUtil_1.default.ENDLESS_CAP || 200) : this.grimTab ? v : Math.min(v, 100);
    }
  });

  /* ---------------- per-tab lists: each tab shows only its own perks and Mutations ---------------- */
  var oGetHeatBuff = P.GetHeatBuff;
  P.GetHeatBuff = function () {
    var L = oGetHeatBuff.call(this);
    try {
      if (L && this.CurBattleMode == 4) { var tb = tabOf(this); L = L.filter(b => perkOn(tb, b.id)) }
    } catch (x) { log("gethb", "GetHeatBuff EXC " + x) }
    return L;
  };
  var oGetExpertModeBuff = P.GetExpertModeBuff;
  P.GetExpertModeBuff = function () {
    var L = oGetExpertModeBuff.call(this);
    try {
      if (L && this.CurBattleMode == 4) { var tb = tabOf(this); L = L.filter(b => mutOn(tb, b.id)) }
    } catch (x) { log("getmb", "GetExpertModeBuff EXC " + x) }
    return L;
  };
  /* the Mutation tooltip sets its "unlocked" panel state only when a next price exists; Grim Mutations have none */
  var oTip = P.ChangeExpertModeBuffTip;
  P.ChangeExpertModeBuffTip = function (e) {
    var r = oTip.apply(this, arguments);
    try {
      var b = (this.GetExpertModeBuff() || [])[e];
      if (b && isGrimMut(b.id)) { var sw = Util_1.U.GetComponent(this.R.BuffDescBox, CS.NOAH.UI.UIChildrenSwitcher); if (sw) sw.SetState(2) }
    } catch (x) { log("tip", "Mutation tip EXC " + x) }
    return r;
  };
  /* bottom list: Grim's own entries (HeatAdditionalContentConf rows with Mode 104) */
  P.ShowHeatAdditionalContent = function () {
    var hc = this.HeatAdditionalContent; if (!hc) return;
    hc.ShowAdditionalContent(this.CurBattleMode == 4 && this.grimTab ? GRIM : this.CurBattleMode == 4 && this.endlessTab ? ENDLESS : this.CurBattleMode, this.GetExpertModeBuff() || []);
  };

  /* ---------------- tab state and the stash of what a tab doesn't carry ----------------
     Every tab shares one Extreme loadout in the save. The Extreme tab must not carry Abyss ranks (they count toward the
     total), Grim or Endless perks (the server rejects the whole save when a switched-on perk's threshold is above the
     total) or Grim Mutations; the Grim tab must not carry Endless's perks. They are switched off and kept in memory until
     a tab that carries them is shown again (0.10.0: per tab; Grim and Endless share the Abyss ranks). */
  function expertData() { try { return HeatUtil_1.default.ExpertModeHeatDatas } catch (x) { return null } }
  function expertList() { var d = expertData(); return (d && d.DebuffList) || [] }
  function expertPerks() { var d = expertData(); return (d && d.BuffList) || [] }
  function expertMuts() { var d = expertData(); return (d && d.ExpertBuffList) || [] }
  /* bring back what this tab carries, then put away what it doesn't (ranks first: the perks check the new total) */
  function stashFor(tab) {
    var s = GG().stash || { ranks: {}, perks: {}, muts: {} };
    for (var d of expertList()) {
      if (s.ranks[d.id] != null && allowed(tab, "rank", d.id)) { d.Level = s.ranks[d.id]; delete s.ranks[d.id] }
      else if (ours("rank", d.id) && !allowed(tab, "rank", d.id) && d.Level > 0) { s.ranks[d.id] = d.Level; d.Level = 0 }
      /* balance A (0.14.2): more standard enemies' rank IV is Grim's and Endless's; the Extreme tab keeps rank III */
      else if (d.id == 17 && !tab && d.Level > 3) { s.ranks[d.id] = d.Level; d.Level = 3 }
    }
    var heat = 999; try { heat = HeatUtil_1.default.GetCurHeatVal(expertList(), 4) } catch (x) {}
    for (var b of expertPerks()) {
      if (s.perks[b.id] && allowed(tab, "perk", b.id)) { if (b.MinSan <= heat) b.IsOpen = true; delete s.perks[b.id] }
      else if (ours("perk", b.id) && !allowed(tab, "perk", b.id) && b.IsOpen) { s.perks[b.id] = 1; b.IsOpen = false }
    }
    for (var m of expertMuts()) {
      if (s.muts[m.id] && allowed(tab, "mut", m.id)) { if (!m.IsLock) m.IsOpen = true; delete s.muts[m.id] }
      else if (ours("mut", m.id) && !allowed(tab, "mut", m.id) && m.IsOpen) { s.muts[m.id] = 1; m.IsOpen = false }
    }
    GG().stash = s;
  }
  /* safety net before any save: a switched-on perk above the current total makes the server reject the whole save */
  function sanitizePerks() {
    var heat = null; try { heat = HeatUtil_1.default.GetCurHeatVal(expertList(), 4) } catch (x) {}
    if (heat == null) return;
    var n = 0;
    for (var b of expertPerks()) if (b.IsOpen && b.MinSan > heat) { b.IsOpen = false; n++ }
    if (n) log("sanitize", "closed " + n + " perk(s) above the current Entropy before saving");
  }
  var oInitHeat = P.InitHeat;
  P.InitHeat = function (e, t, a = !0) {
    try {
      if (a) {   /* opening the menu: land on the Grim tab when Grim is the selected mode (0.3.1) */
        var H = HeatUtil_1.default;
        /* Endless first: its loadout carries Abyss ranks too, which alone used to mean Grim */
        this.endlessTab = e == 4 && !this.readonlyMode && !!H.EndlessSelected && H.EndlessSelected() && !H.GrimSelected() && H.EndlessUnlocked();
        this.grimTab = e == 4 && !this.readonlyMode && !this.endlessTab && (H.GrimSelected() || H.GrimHasAbyss()) && H.GrimUnlocked();
        GG().tab = !!this.grimTab;
      }
    } catch (x) { log("initheat", "InitHeat EXC " + x) }
    return oInitHeat.call(this, e, t, a);
  };
  var oInitExpert = P.InitExpertMode;
  P.InitExpertMode = function () {
    try { stashFor(this.CurBattleMode == 4 ? tabOf(this) : 0) } catch (x) { log("stash", "stash EXC " + x) }
    oInitExpert.call(this);
    try { if (this.grimTab) this.WidgetSwitchModeBox.ShowDetail(GRIM, 0); else if (this.endlessTab) this.WidgetSwitchModeBox.ShowDetail(ENDLESS, 0) } catch (x) { log("box", "ShowDetail EXC " + x) }
    lsSetup(this);
    perkLayout(this, !!this.grimTab);
    theme(this, !!this.grimTab);
    try { this.grimTab ? gateOn(this) : gateOff(this) } catch (x) { log("gateexc", "gate EXC " + x) }
    endlessShow(this, !!this.endlessTab && !this.readonlyMode);
  };
  /* LB/RB: Normal -> Advanced -> Extreme -> Grim -> Endless (the stock list is left alone: other screens read it) */
  P.SwitchMode = async function (d) {
    var L = HeatUtil_1.default.ENDLESS ? [1, 2, 4, GRIM, ENDLESS] : [1, 2, 4, GRIM], cur = this.grimTab ? GRIM : this.endlessTab ? ENDLESS : this.CurBattleMode, i = L.indexOf(cur);
    if (i < 0) i = 0;
    var n = L[Util_1.U.GetLoopRealIndex(i + d, L.length)];
    this.R.BuffDescBoxCanvasGroup.alpha = 0;
    HeatUtil_1.default.ModeOpen(n) || WindowUtil_1.default.QueueMessages(Util_1.U.GetLocale("ModeLocked_" + n));
    var wasGrim = !!this.grimTab, wasEndless = !!this.endlessTab;
    this.grimTab = n === GRIM; GG().tab = this.grimTab;
    this.endlessTab = n === ENDLESS;
    if (wasGrim && !this.grimTab) leaveGrim(this);
    if (wasEndless && !this.endlessTab) endlessShow(this, false);
    DataBinding_1.DB.Heat.CurBattleMode.Value = n === GRIM || n === ENDLESS ? 4 : n;
    this.InitHeat(this.CurBattleMode, this.teamMode, !1);
    this.MessageRollerWidget.ClearMessages();
    this.SendSwitchModeMsg();
  };
  function leaveGrim(w) {
    theme(w, false);
    perkLayout(w, false);
    try { gateOff(w) } catch (x) {}
  }
  /* leaving the menu: save guard, remember the selected mode, then the lobby (hallway lights, TV sign) follows it */
  var oBack = P.OnBackClick;
  P.OnBackClick = async function () {
    var wasGrim = !!this.grimTab && this.CurBattleMode == 4, wasEndless = !!this.endlessTab && this.CurBattleMode == 4, ro = !!this.readonlyMode;
    try { if (!ro) sanitizePerks() } catch (x) { log("sanexc", "sanitize EXC " + x) }
    try { if (!ro) HeatUtil_1.default.GrimSetSelected(wasGrim) } catch (x) { log("selexc", "select EXC " + x) }
    try { if (!ro && HeatUtil_1.default.EndlessSetSelected) HeatUtil_1.default.EndlessSetSelected(wasEndless && HeatUtil_1.default.EndlessUnlocked()) } catch (x) { log("eselexc", "Endless select EXC " + x) }
    try { return await oBack.apply(this, arguments) }
    finally {
      GG().tab = false; this.endlessTab = false;
      try { if (wasGrim) leaveGrim(this) } catch (x) {}
      try { if (wasEndless) endlessShow(this, false) } catch (x) {}
      try { HeatUtil_1.default.GrimVisuals && HeatUtil_1.default.GrimVisuals(true) } catch (x) {}
      log("exit" + wasGrim + wasEndless, "menu closed: selected mode " + (wasGrim ? "Grim" : wasEndless ? "Endless" + (HeatUtil_1.default.EndlessUnlocked() ? "" : " (locked: not selected)") : "stock " + this.CurBattleMode));
    }
  };

  /* ---- src/grim_ui.js ---- */
/* Entropy Overhaul: Grim of the Abyss -- the Grim tab's presentation, shared by the hub Entropy menu (HeatMenu, via
   grim_menu.js) and the in-run Entropy view (WidgetHeatMenu, via grim_widget.js). Not a module of its own: build_grim.py
   composes it into both at their GRIM_UI marker comment, inside their scope. The host provides: CS, log, V2, GG, HU and
   isGrimPerk / isGrimMut; a view whose layout differs from the hub's sets w.__grimMap (path mapping) and
   w.__grimLines (the frame's lines and parent). Everything here takes the view `w` (a window or a widget):
   w.CsObj.transform (root), w.R.ExpertBuffList / w.R.DebuffList, w.GetExpertModeBuff(), w.curHeatVal. */
  /* ---------------- Grim's top: "The Descent" ----------------
     The 8 Grim perks form an inverted-triangle funnel (4 over 3 over 1, in unlock order 105..175) that narrows toward the
     gate; the 175 capstone hangs at the tip, 15% larger. Output and Tactic move onto two angled glass panels in the lower
     corners beside the funnel. Art and animation: the GrimTop prefab (uikit/), mounted at EMC (0,400) behind them.
     Positions below are EMC-space px relative to that origin, converted to ExpertBuffList space (ExpertBuffBox sits at EMC
     (0,428), scale 0.863). Extreme's GridLayoutGroup and size fitter are off while Grim shows; the badges keep their
     stock scale (0.7; 0.3.0 wrongly set 1.0, so its badges were 43% too large). */
  var TOP_Y = 400, BUFFBOX_Y = 428, BUFFBOX_SCALE = 0.863, CAP_SCALE = 1.15;
  /* the look a presentation state G wears: Grim's unless G.look says otherwise (the Endless tab passes its own frame,
     row skin and text colours; src/endless_ui.js) */
  function lookOf(G) {
    return (G && G.look) || { frame: FRAME_PATH, skin: SKIN_PATH, under: [0.12, 0.5, 1.0, 0.85], outline: [0.42, 0.8, 1.0, 1], bot: TXT_BOT };
  }
  var PERK_POS = [[-156, 116], [-52, 116], [52, 116], [156, 116], [-104, 36], [0, 36], [104, 36], [0, -54]];
  function perkLocal(i) { var p = PERK_POS[i]; return [p[0] / BUFFBOX_SCALE, (p[1] + TOP_Y - BUFFBOX_Y) / BUFFBOX_SCALE] }
  function perkLayout(w, on) {
    try {
      var box = w.R.ExpertBuffList; if (!box) return;
      var tr = box.transform, go = tr.gameObject;
      var grid = Util_1.U.GetComponent(go, CS.UnityEngine.UI.GridLayoutGroup);
      var fit = null; try { fit = Util_1.U.GetComponent(go, CS.NOAH.UI.UISizeFitter) } catch (x) {}
      if (on) {
        if (grid) grid.enabled = false;
        if (fit) fit.enabled = false;
        var kids = [], n = tr.childCount;
        for (var i = 0; i < n && kids.length < PERK_POS.length; i++) {
          var c = tr.GetChild(i); if (!c.gameObject.activeSelf) continue;
          if (c.__grimBase == null) c.__grimBase = c.localScale.x;
          c.anchorMin = V2(0.5, 0.5); c.anchorMax = V2(0.5, 0.5); c.pivot = V2(0.5, 0.5);
          var sc = c.__grimBase * (kids.length === PERK_POS.length - 1 ? CAP_SCALE : 1);
          c.localScale = new CS.UnityEngine.Vector3(sc, sc, 1);
          kids.push(c);
        }
        w.__grimPerkKids = kids;
        placePerks(w);
        log("perklayout", "Grim perk layout (the Descent): " + kids.length + " perks");
      } else {
        var K = w.__grimPerkKids || [];
        for (var c2 of K) { try { var b0 = c2.__grimBase || 0.7; c2.localScale = new CS.UnityEngine.Vector3(b0, b0, 1) } catch (x) {} }
        w.__grimPerkKids = null;
        if (grid && !grid.enabled) grid.enabled = true;
        if (fit && !fit.enabled) fit.enabled = true;
      }
    } catch (x) { log("perklay", "perk layout EXC " + x) }
  }
  function placePerks(w) {
    var K = w.__grimPerkKids; if (!K) return;
    for (var k = 0; k < K.length; k++) { var q = perkLocal(k); K[k].anchoredPosition = V2(q[0], q[1]) }
  }

  /* ---------------- Grim's own centre piece: "The Abyss Gate" ----------------
     A Unity-built UI prefab (uikit/, bundle ui/prefab/grim/grimgate) mounted in Extreme's hex container behind the
     Entropy number, so the stock intro fade/scale carries it. Extreme's own centre pieces are switched off while Grim
     shows and restored on leave (paths and reasons: NOTES 2026-09-28 [Entropy Overhaul], centre-piece research).
     Prefab contract: child "Gauge" (Image, radial fill), "Links/Link0..4", "Slots/Slot0..4", Animator trigger "Pulse". */
  var EMC = "BtnController/SafeAreaFitter/Content/ContentMasteAndExpert/ExpertModeContent";
  var WEMC = EMC + "/WidgetExpertModeContent";
  var HIDE = [WEMC + "/Decorations", WEMC + "/ExpertHeatWaveBox/WaveBg", WEMC + "/ExpertHeatWaveBox/LiquidMask",
              WEMC + "/ExpertHeatWaveBox/ExpertHeatImg", WEMC + "/ExpertHeatWaveBox/FXSweep",
              WEMC + "/ExpertHeatWaveBox/FxExpertBuffFull", EMC + "/ExpertBuffBox/BuffBg", EMC + "/ExpertAdditionalBonus/Bg"];
  /* the gate sits between the Output/Tactic plate and the bottom list: centre (0,60) in the hex container, 0.57 scale
     (ring radius 268 px; checked on a composite over the lead's 20:45 frame); the Mutation sockets are on the tick ring at radius 440 prefab units */
  var GATE_X = 0, GATE_Y = 60, GATE_SCALE = 0.57, SOCKET_R = 440 * GATE_SCALE, SOCKET_DEG = [210, 150, 270, 30, 330];
  var GATE_PATH = "UI/Prefab/Grim/GrimGate", GAUGE_MAX = 175;
  function TYPEOF(t) { var f = (typeof puerts !== "undefined" && puerts.$typeof) || globalThis.$typeof; return f(t) }
  function V3(x, y, z) { return new CS.UnityEngine.Vector3(x, y, z) }
  /* paths are written for the hub menu; a host with another layout (the in-run view) maps them through w.__grimMap */
  function find(w, path) { try { if (w.__grimMap) path = w.__grimMap(path); return path == null ? null : w.CsObj.transform.Find(path) } catch (x) { return null } }
  /* prefab loading: the hub window loads through its own asset scope; a widget has none, so the global manager is used */
  function loadPf(w, path) {
    try { if (w.CsObj && w.CsObj.LoadAssetByType) return w.CsObj.LoadAssetByType(TYPEOF(CS.UnityEngine.GameObject), path) } catch (x) {}
    return Util_1.U.GetSingleton(CS.NOAH.Asset.AssetManagerBase).LoadAssetByType(TYPEOF(CS.UnityEngine.GameObject), path);
  }
  function findDeep(t, name) {
    var q = [t], n = 0;
    while (q.length && n++ < 400) { var c = q.shift(); for (var i = 0; i < c.childCount; i++) { var ch = c.GetChild(i); if (ch.name === name) return ch; q.push(ch) } }
    return null;
  }
  function socketPos(i) { var a = SOCKET_DEG[i] * Math.PI / 180; return [GATE_X + Math.cos(a) * SOCKET_R, GATE_Y + Math.sin(a) * SOCKET_R] }

  function gateOn(w) {
    var G = w.__gate || (w.__gate = { hidden: [], slots: null, go: null, anim: null, gauge: null, links: [], fires: [], fill: 0, buffs: -1, open: -1 });
    if (!G.go) {
      var box = find(w, WEMC + "/ExpertHeatWaveBox"); if (!box) { log("gatebox", "gate: hex container not found"); return }
      var pf = null; try { pf = loadPf(w, GATE_PATH) } catch (x) { log("gateload", "gate load EXC " + x) }
      if (!pf) { log("gatenull", "gate: prefab " + GATE_PATH + " not loaded"); return }
      var go = CS.UnityEngine.Object.Instantiate(pf, box, false);
      var rt = go.transform; rt.SetSiblingIndex(0);
      rt.anchoredPosition = V2(GATE_X, GATE_Y); rt.localScale = V3(GATE_SCALE, GATE_SCALE, 1);
      G.go = go; G.anim = Util_1.U.GetComponent(go, CS.UnityEngine.Animator);
      try { G.gauge = Util_1.U.GetComponent(rt.Find("Gauge").gameObject, CS.UnityEngine.UI.Image) } catch (x) { log("gauge", "gauge not found " + x) }
      for (var i = 0; i < 5; i++) { try { G.links.push(rt.Find("Links/Link" + i).gameObject) } catch (x) { G.links.push(null) } }
      for (var j = 0; j < 5; j++) { try { G.fires.push(rt.Find("SocketFire/Fire" + j).gameObject) } catch (x) { G.fires.push(null) } }
      log("gate", "Abyss Gate mounted");
    } else G.go.SetActive(true);   /* re-enabling restarts the Animator at its Intro state */
    for (var p of HIDE) {
      var t = find(w, p); if (!t) { log("hide" + p, "gate: not found " + p); continue }
      if (t.gameObject.activeSelf) { t.gameObject.SetActive(false); G.hidden.push(t.gameObject) }
    }
    slotsOn(w, G);
    topOn(w, G);
    frameOn(w, G);
    textFxOn(w, G);
    skinOn(w);
    G.buffs = -1; G.open = -1;
  }
  function gateOff(w) {
    var G = w.__gate; if (!G) return;
    if (G.go) { try { G.go.SetActive(false) } catch (x) {} }
    for (var go of G.hidden) { try { go.SetActive(true) } catch (x) {} }
    G.hidden = [];
    slotsOff(w, G);
    topOff(w, G);
    frameOff(w, G);
    namesOff(G);
    textFxOff(w, G);
    skinOff(w);
  }
  /* The Descent (top): the GrimTop prefab (funnel plate, side panels, beam) behind the perks and the Output/Tactic
     content; Output's label and values move onto the left panel, Tactic's onto the right; the perk badges get Grim's own
     backgrounds (the prefab carries them as sprites on its hidden "Badges" child). Everything is restored on leave. */
  var TOP_PATH = "UI/Prefab/Grim/GrimTop", BONUS = EMC + "/ExpertAdditionalBonus";
  /* ExpertAdditionalBonus sits at EMC (0,250), 150 px below the top's origin. Panel geometry (art/make_grim_top_art.py):
     outer edge x = -371, inner edge parallel to the funnel side, so the panel is narrow at the top (label row, y +26)
     and wide at the bottom (value rows, y -2 and -46, where it spans x -371..-173 and -371..-132). The right panel mirrors. */
  var BONUS_MOVE = [["ProbabilityText", -285, 176], ["Consciousness", -272, 148], ["AP", -272, 104],
                    ["StrategyText", 285, 176], ["BlessUpListExpert/0", 272, 148], ["BlessUpListExpert/1", 272, 104]];
  var BONUS_VALUES = ["Consciousness/ConsciousCrystalFragTextExpert", "AP/CurrencyTextExpert", "BlessUpListExpert/0/BlessVal", "BlessUpListExpert/1/BlessVal"];
  var BADGE = { close: "Close/BuffBgClose", open: "Open/BuffBgOpen", openBase: "Open/bgblack", locked: "Locked/BuffBgLocked" };
  function topOn(w, G) {
    bonusOn(w, G);
    if (!G.top) {
      var emc = find(w, EMC); if (!emc) return;
      var pf = null; try { pf = loadPf(w, TOP_PATH) } catch (x) { log("toplx", "top load EXC " + x) }
      if (!pf) { log("topnull", "top prefab not loaded: " + TOP_PATH); return }
      var go = CS.UnityEngine.Object.Instantiate(pf, emc, false), rt = go.transform;
      rt.SetSiblingIndex(0); rt.anchoredPosition = V2(0, TOP_Y);
      G.top = go; G.badge = {};
      for (var n of ["badge_locked", "badge_off", "badge_on", "badge_cap_locked", "badge_cap_off", "badge_cap_on"]) {
        try { G.badge[n] = Util_1.U.GetComponent(rt.Find("Badges/" + n).gameObject, CS.UnityEngine.UI.Image).sprite } catch (x) { log("badge" + n, "badge sprite missing: " + n) }
      }
      log("top", "Grim top mounted");
    } else G.top.SetActive(true);
    reskin(w, G, true);
  }
  function bonusOn(w, G) {
    if (!G.bonus) {
      G.bonus = [];
      for (var m of BONUS_MOVE) {
        var t = null, parts = m[0].split("/");
        try { t = find(w, BONUS + "/" + parts[0]); if (t && parts.length > 1) t = t.GetChild(+parts[1]) } catch (x) { t = null }
        if (!t) { log("bonus" + m[0], "bonus item not found: " + m[0]); continue }
        G.bonus.push({ t: t, x: t.anchoredPosition.x, y: t.anchoredPosition.y, to: [m[1], m[2]] });
      }
    }
    for (var b of G.bonus) b.t.anchoredPosition = V2(b.to[0], b.to[1]);
    if (!G.values) {
      G.values = [];
      for (var vp of BONUS_VALUES) {
        var parts2 = vp.split("/"), t2 = find(w, BONUS + "/" + parts2[0]);
        try { for (var j = 1; t2 && j < parts2.length; j++) t2 = /^\d+$/.test(parts2[j]) ? t2.GetChild(+parts2[j]) : t2.Find(parts2[j]) } catch (x) { t2 = null }
        var tmp = t2 ? Util_1.U.GetComponent(t2.gameObject, CS.TMPro.TextMeshProUGUI) : null;
        if (tmp) G.values.push({ tmp: tmp, t: t2, last: null, pop: 0 }); else log("val" + vp, "value text not found: " + vp);
      }
    }
  }
  function topOff(w, G) {
    if (G.top) { try { G.top.SetActive(false) } catch (x) {} }
    for (var b of (G.bonus || [])) { try { b.t.anchoredPosition = V2(b.x, b.y) } catch (x) {} }
    for (var v of (G.values || [])) { try { v.t.localScale = V3(1, 1, 1); v.pop = 0; v.last = null } catch (x) {} }
    for (var oi of (G.openImg || [])) { try { if (oi) { var c1 = oi.color; c1.a = 1; oi.color = c1 } } catch (x) {} }
    reskin(w, G, false);
  }
  /* badge backgrounds: set on the Grim tab after every stock refresh (WidgetHeatBuff.SetBuffImg rewrites BuffBgOpen);
     the original sprites are kept per Image and put back when Grim is left */
  function reskin(w, G, on) {
    G.skinned = G.skinned || [];
    if (!on) {
      for (var r of G.skinned) { try { r.img.sprite = r.orig; r.img.gameObject.SetActive(r.act) } catch (x) {} }
      G.skinned = []; return;
    }
    var K = w.__grimPerkKids, B = G.badge; if (!K || !B) return;
    G.openImg = [];
    function put(c, path, sprite, hide) {
      var t = c.Find(path); if (!t) return;
      var img = Util_1.U.GetComponent(t.gameObject, CS.UnityEngine.UI.Image); if (!img) return;
      if (!G.skinned.some(r => r.img === img)) G.skinned.push({ img: img, orig: img.sprite, act: t.gameObject.activeSelf });
      if (hide) { t.gameObject.SetActive(false); return }
      if (sprite) img.sprite = sprite;
    }
    for (var k = 0; k < K.length; k++) {
      var c = K[k], cap = k === K.length - 1;
      put(c, BADGE.close, B[cap ? "badge_cap_off" : "badge_off"]);
      put(c, BADGE.open, B[cap ? "badge_cap_on" : "badge_on"]);
      try { G.openImg[k] = Util_1.U.GetComponent(c.Find(BADGE.open).gameObject, CS.UnityEngine.UI.Image) } catch (x) {}
      put(c, BADGE.locked, B[cap ? "badge_cap_locked" : "badge_locked"]);
      put(c, BADGE.openBase, null, true);
    }
  }

  /* Mutation widgets: moved onto the gate's sockets (only Extreme's top slot [2] changes side), with the stock socket art
     hidden (the gate draws its own). Controller navigation needs no change: InputGroup finds the nearest selectable
     geometrically (research 2026-09-28), so moved widgets navigate as they look. */
  function slotsOn(w, G) {
    var list = find(w, WEMC + "/ExpertModeBuffList"); if (!list) return;
    if (!G.slots) {
      G.slots = [];
      for (var i = 0; i < Math.min(5, list.childCount); i++) {
        var c = list.GetChild(i), bg = c.Find("Switcher/Bg"), trail = findDeep(c, "OpenEffect");
        G.slots.push({ t: c, x: c.anchoredPosition.x, y: c.anchoredPosition.y, bg: bg ? bg.gameObject : null, trail: trail ? trail.gameObject : null });
        if (!trail && !G.trailLogged) { G.trailLogged = 1; log("trail", "Mutation OpenEffect not found under slot " + i) }
      }
    }
    for (var k = 0; k < G.slots.length; k++) {
      var s = G.slots[k], q = socketPos(k);
      s.t.anchoredPosition = V2(q[0], q[1]);
      if (s.bg) s.bg.SetActive(false);
      if (s.trail) { s.trailOn = s.trail.activeSelf; s.trail.SetActive(false) }   /* Extreme's purple "switched on" trail */
    }
  }
  function slotsOff(w, G) {
    if (!G.slots) return;
    for (var s of G.slots) {
      try { s.t.anchoredPosition = V2(s.x, s.y); if (s.bg) s.bg.SetActive(true); if (s.trail && s.trailOn) s.trail.SetActive(true) } catch (x) {}
    }
  }
  /* per frame on the Grim tab: keep Extreme's pieces off (C# re-enables the full-power effect at 5 Mutations), ease the
     depth gauge to Entropy / 175, light the conduit of each Mutation that is on, pulse on a new perk or Mutation */
  function gateTick(w) {
    var G = w.__gate; if (!G || !G.go) return;
    for (var go of G.hidden) { try { if (go.activeSelf) go.SetActive(false) } catch (x) {} }
    for (var sl of (G.slots || [])) { try { if (sl.trail && sl.trail.activeSelf) { sl.trailOn = true; sl.trail.SetActive(false) } } catch (x) {} }
    var target = Math.max(0, Math.min(1, (w.curHeatVal || 0) / GAUGE_MAX)), dt = 0.016;
    try { dt = CS.UnityEngine.Time.unscaledDeltaTime } catch (x) {}
    G.fill += (target - G.fill) * Math.min(1, dt * 6);
    if (G.gauge) G.gauge.fillAmount = G.fill;
    var list = (w.GetExpertModeBuff && w.GetExpertModeBuff()) || [], open = 0;
    for (var i = 0; i < G.links.length; i++) {
      var on = !!(list[i] && list[i].IsOpen); if (on) open++;
      var lk = G.links[i]; if (lk && lk.activeSelf !== on) lk.SetActive(on);
      var fi = G.fires[i]; if (fi && fi.activeSelf !== on) fi.SetActive(on);   /* a switched-on Mutation burns in its socket */
    }
    try { namesTick(w, G) } catch (x) { log("namesx", "name flames EXC " + x) }
    try { var nowT = CS.UnityEngine.Time.unscaledTime; textFxTick(w, G, nowT) } catch (x) { log("txtx", "fire text tick EXC " + x) }
    /* the fire shader's clock: _Time.y (time since level load, scaled) + this offset = unscaled time, so the fire keeps
       burning if the game is paused behind the menu; after the menu closes the offset stays and the clock runs on */
    try { var TM = CS.UnityEngine.Time; CS.UnityEngine.Shader.SetGlobalFloat("_GrimTimeOffset", TM.unscaledTime - TM.timeSinceLevelLoad) } catch (x) { if (!G.clockErr) { G.clockErr = 1; log("clock", "fire clock EXC " + x) } }
    /* the top: switched-on perks breathe (each on its own phase); an Output/Tactic value pops when it changes */
    var now = 0; try { now = CS.UnityEngine.Time.unscaledTime } catch (x) {}
    var K = w.__grimPerkKids || [];
    for (var k = 0; k < K.length; k++) {
      var oi = G.openImg && G.openImg[k]; if (!oi) continue;
      try { var c0 = oi.color; c0.a = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(now * 1.6 + k * 0.9)); oi.color = c0 } catch (x) {}
    }
    for (var v of (G.values || [])) {
      try {
        var txt = v.tmp.text;
        if (v.last !== null && txt !== v.last) v.pop = 1;
        v.last = txt;
        if (v.pop > 0) { v.pop = Math.max(0, v.pop - dt / 0.28); var s1 = 1 + 0.18 * v.pop * v.pop; v.t.localScale = V3(s1, s1, 1) }
      } catch (x) {}
    }
    var buffs = w.curBuffCount || 0;
    if (G.anim && ((G.buffs >= 0 && buffs > G.buffs) || (G.open >= 0 && open > G.open))) { try { G.anim.SetTrigger("Pulse") } catch (x) {} }
    G.buffs = buffs; G.open = open;
  }

  /* ---------------- the modifier rows' skin ----------------
     The lead: "remake all the buttons on this page to match grims new aesthetic". Every sprite of a stock row
     (Widget/WidgetHeatDebuff: row background, selected row, the - / + buttons, the cost cube, the level chevrons) comes
     from the ChaosValue atlas by name; on the Grim tab each is swapped for Grim's own (GrimSkin prefab; art/
     make_grim_skin_art.py) by that name. The row re-sets stock sprites in RefreshUI / SetSelectStatus / SetSelectShow /
     SetLevelImg, so those are wrapped to re-skin straight after (no stock frame shows); the buttons' sprite-swap states
     (pressed / disabled) are remapped too. The last stock sprite of every image is kept and put back on leave. */
  var SKIN_PATH = "UI/Prefab/Grim/GrimSkin";
  var SKIN_MAP = { ImgChaosUnselected: "row_bg", ImgChaosSelect: "row_select", ImgNoMinus: "btn_minus_on", ImgMinus_: "btn_minus_off",
                   ImgNoPlus: "btn_plus_on", ImgPlus: "btn_plus_off", IconChos1: "shard", ImgPhase3: "chevron" };
  var SKIN_REV = {}; for (var sk in SKIN_MAP) SKIN_REV[SKIN_MAP[sk]] = sk;
  var SKINS = {}, SKIN_ERR = {};   /* per skin prefab path: { S: sprites by stock name | null, logged } */
  function skinFor(row) {
    var h = row && row.__grimSkinHost, p = (h && h.__grimSkinPath) || SKIN_PATH, K = SKINS[p];
    return K ? K.S : null;
  }
  var SS_FIELDS = ["highlightedSprite", "pressedSprite", "selectedSprite", "disabledSprite"];
  function baseName(sp) { var n = ""; try { n = sp.name || "" } catch (x) {} return n.endsWith("(Clone)") ? n.slice(0, -7) : n }
  function skinLoad(w, path) {
    path = path || SKIN_PATH;
    var K = SKINS[path] || (SKINS[path] = { S: undefined });
    if (K.S !== undefined) return K.S;
    K.S = null;
    try {
      var pf = loadPf(w, path);
      if (!pf) { log("skinnull" + path, "skin prefab not loaded: " + path); return null }
      var S = {}, n = 0;
      for (var k in SKIN_MAP) {
        var t = pf.transform.Find(SKIN_MAP[k]), im = t ? Util_1.U.GetComponent(t.gameObject, CS.UnityEngine.UI.Image) : null;
        if (im && im.sprite) { S[k] = im.sprite; n++ } else log("skinmiss" + path + k, "skin sprite missing: " + SKIN_MAP[k] + " in " + path);
      }
      K.S = S; log("skin" + path, "row skin loaded: " + n + " sprites from " + path);
    } catch (x) { log("skinx" + path, "skin load EXC " + x) }
    return K.S;
  }
  function skinRow(row, on) {
    var S = skinFor(row); if (!row || (on && !S)) return;
    var R = row.__grimSkin;
    if (!R) { if (!on) return; R = row.__grimSkin = { imgs: {}, btns: {} } }
    if (on) {   /* rescan each time: SetLevelImg adds level chevrons after the first skin */
      try {
        var go = row.R.DebuffStatusTable.gameObject;
        var ia = Util_1.U.GetComponentsInChildren(go, CS.UnityEngine.UI.Image, true);
        for (var i = 0; i < ia.Length; i++) { var im = ia.get_Item(i), iid = im.GetInstanceID(); if (!R.imgs[iid]) R.imgs[iid] = { img: im, stock: null } }
        var ba = Util_1.U.GetComponentsInChildren(go, CS.UnityEngine.UI.Button, true);
        for (var j = 0; j < ba.Length; j++) { var bt = ba.get_Item(j), bid = bt.GetInstanceID(); if (!R.btns[bid]) R.btns[bid] = { b: bt, ss: null } }
      } catch (x) { if (!SKIN_ERR.row) { SKIN_ERR.row = 1; log("skinrow", "row skin EXC " + x) } }
    }
    for (var ik in R.imgs) {
      var e = R.imgs[ik];
      try {
        var sp = e.img.sprite; if (!sp) continue;
        var nm = baseName(sp);
        if (on) { var to = S[nm]; if (to) { e.stock = sp; e.img.sprite = to; e.skinned = true } }
        else if (e.skinned && e.stock) { e.img.sprite = e.stock; e.skinned = false }   /* any skin's sprite goes back to the stock one */
      } catch (x) {}
    }
    for (var bk in R.btns) {
      var b = R.btns[bk];
      try {
        if (on) {
          var ss = b.b.spriteState, ch = false;
          for (var f of SS_FIELDS) { var s0 = ss[f]; if (!s0) continue; var t2 = S[baseName(s0)]; if (t2) { if (!b.ss) b.ss = b.b.spriteState; ss[f] = t2; ch = true } }
          if (ch) b.b.spriteState = ss;
        } else if (b.ss) { b.b.spriteState = b.ss; b.ss = null }
      } catch (x) {
        if (!SKIN_ERR.ss) { SKIN_ERR.ss = 1; log("skinss", "button sprite states EXC " + x + "; switching their transition off on the Grim tab instead") }
        try { b.b.transition = on ? 0 : 2 } catch (y) {}
      }
    }
  }
  function rowWidgets(w) {
    var out = [], list = w.R && w.R.DebuffList; if (!list) return out;
    for (var i = 0; i < list.childCount; i++) {
      var c = list.GetChild(i), wd = null;
      try { wd = Util_1.U.GetBindObj(c.gameObject, WidgetHeatDebuff_1.default) } catch (x) {}
      if (!wd) { try { wd = Util_1.U.GetBindObj(c, WidgetHeatDebuff_1.default) } catch (x) {} }
      if (wd) out.push(wd);
    }
    return out;
  }
  function skinOn(w, path) {
    path = path || SKIN_PATH;
    if (w.__grimSkinOn && w.__grimSkinPath !== path) skinOff(w);   /* one skin at a time: the stock sprites come back first */
    if (!skinLoad(w, path)) return;
    wrapRows(); w.__grimSkinPath = path; w.__grimSkinOn = true;
    var n = 0; for (var r of rowWidgets(w)) { r.__grimSkinHost = w; skinRow(r, true); n++ }
    var K = SKINS[path]; if (!K.logged) { K.logged = 1; log("skinon" + path, "row skin on " + n + " rows (" + path + ")") }
  }
  function skinOff(w) { w.__grimSkinOn = false; for (var r of rowWidgets(w)) { try { skinRow(r, false) } catch (x) {} } }
  /* a row is re-skinned after its own refresh while its host view shows Grim (the hub's Grim tab or the in-run view) */
  function skinWanted(row) {
    try {
      if (row && row.__grimSkinHost) return !!row.__grimSkinHost.__grimSkinOn && !!skinFor(row);
      var w = HeatUtil_1.default.GrimOpenMenu();
      if (w && w.__grimSkinOn && w.CurBattleMode == 4) { row.__grimSkinHost = w; return !!skinFor(row) }   /* a row made after the skin went on */
      return false;
    } catch (x) { return false }
  }
  /* wrapped on first use, not at load: during a circular import WidgetHeatDebuff_1.default can still be undefined here */
  function wrapRows() {
    if (SKIN_ERR.wrapped) return; SKIN_ERR.wrapped = true;
    var WHD = WidgetHeatDebuff_1.default && WidgetHeatDebuff_1.default.prototype; if (!WHD) { log("whd", "row widget prototype not found"); return }
    for (var mn of ["RefreshUI", "SetSelectStatus", "SetSelectShow", "SetLevelImg"]) (function (mn) {
      var o = WHD[mn]; if (typeof o !== "function") { log("whd" + mn, "row widget has no " + mn); return }
      WHD[mn] = function () { var r = o.apply(this, arguments); try { if (skinWanted(this)) skinRow(this, true) } catch (x) {} return r };
    })(mn);
  }

  /* ---------------- glowing blue fire text ----------------
     The lead: "make the text on this menu like a glowing blue cool fire font". The UI font shader is
     TextMeshPro/Mobile/Distance Field with compiled OUTLINE_ON and UNDERLAY_ON (+ UNDERLAY_QUAD_SAMPLE) variants and no
     glow (research 2026-09-28). On the Grim tab every text under ContentMasteAndExpert and the mode header gets:
     a Grim copy of its font material (one per original material) with a soft blue underlay halo and a thin cyan outline,
     and a vertex gradient from white-hot at the top to ice blue at the bottom (multiplied with the text's own colour,
     so dimmed and red texts keep their meaning). The halo breathes a little each frame. Leaving the tab puts every
     text's own material and gradient back. */
  var TXT_HEAD = "BtnController/SafeAreaFitter/Content/WidgetSwitchModeBox";
  var TXT_TOP = [1, 1, 1, 1], TXT_BOT = [0.6, 0.86, 1, 1];
  function col(a) { return new CS.UnityEngine.Color(a[0], a[1], a[2], a[3]) }
  function grimMat(G, orig) {
    var id = orig.GetInstanceID(), M = G.txtMats || (G.txtMats = {});
    if (M[id]) return M[id].m;
    var m = new CS.UnityEngine.Material(orig);
    m.name = orig.name + " (Grim fire)";
    m.EnableKeyword("UNDERLAY_ON"); m.EnableKeyword("UNDERLAY_QUAD_SAMPLE"); m.EnableKeyword("OUTLINE_ON");
    var L = lookOf(G);
    m.SetColor("_UnderlayColor", col(L.under));
    m.SetFloat("_UnderlayOffsetX", 0); m.SetFloat("_UnderlayOffsetY", 0);
    m.SetFloat("_UnderlayDilate", 0.45); m.SetFloat("_UnderlaySoftness", 0.85);
    m.SetColor("_OutlineColor", col(L.outline));
    m.SetFloat("_OutlineWidth", 0.07); m.SetFloat("_FaceDilate", 0.03);
    M[id] = { m: m, ph: Object.keys(M).length * 1.7 };
    return m;
  }
  function textFxScan(w, G) {
    var T = G.txt || (G.txt = { list: [], ids: {} });
    var roots = [find(w, CME), find(w, TXT_HEAD)], added = 0;
    for (var r of roots) {
      if (!r) continue;
      var arr = null; try { arr = Util_1.U.GetComponentsInChildren(r.gameObject, CS.TMPro.TextMeshProUGUI, true) } catch (x) { log("txtscan", "text scan EXC " + x); continue }
      for (var i = 0; i < arr.Length; i++) {
        var t = arr.get_Item(i), id = t.GetInstanceID(); if (T.ids[id]) continue;
        var orig = null; try { orig = t.fontSharedMaterial } catch (x) {}
        if (!orig) continue;
        T.ids[id] = 1; T.list.push({ t: t, mat: orig, grad: t.enableVertexGradient, cg: t.colorGradient, on: false }); added++;
      }
    }
    return added;
  }
  function textFxOn(w, G) {
    try {
      var n = textFxScan(w, G), T = G.txt, bot = lookOf(G).bot, grad = new CS.TMPro.VertexGradient(col(TXT_TOP), col(TXT_TOP), col(bot), col(bot));
      for (var e of T.list) {
        if (e.on) continue;
        try {
          e.t.fontSharedMaterial = grimMat(G, e.mat);
          e.t.enableVertexGradient = true; e.t.colorGradient = grad;
          e.t.UpdateMeshPadding(); e.t.SetVerticesDirty(); e.on = true;
        } catch (x) { if (!G.txtErr) { G.txtErr = 1; log("txton", "fire text EXC " + x) } }
      }
      if (!G.txtLogged) { G.txtLogged = 1; log("txt", "fire text on " + T.list.length + " texts, " + Object.keys(G.txtMats || {}).length + " Grim material(s)") }
    } catch (x) { log("txtonx", "fire text on EXC " + x) }
  }
  function textFxOff(w, G) {
    var T = G.txt; if (!T) return;
    for (var e of T.list) {
      if (!e.on) continue;
      try { e.t.fontSharedMaterial = e.mat; e.t.enableVertexGradient = e.grad; e.t.colorGradient = e.cg; e.t.UpdateMeshPadding(); e.t.SetVerticesDirty() } catch (x) {}
      e.on = false;
    }
  }
  function textFxTick(w, G, now) {
    if ((G.txtT = (G.txtT || 0) + 1) % 30 === 0 && textFxScan(w, G)) textFxOn(w, G);   /* texts created after the tab opened */
    for (var k in (G.txtMats || {})) {
      var q = G.txtMats[k], f = Math.sin(now * 6.1 + q.ph) * 0.5 + Math.sin(now * 13.7 + q.ph * 2) * 0.3;
      try { q.m.SetFloat("_UnderlayDilate", 0.45 + 0.07 * f); q.m.SetFloat("_UnderlaySoftness", 0.85 - 0.06 * f) } catch (x) {}
    }
  }

  /* ---------------- the blue-fire surround (GrimFrame) ----------------
     The lead (clip 21:55): "surround the menu for entropy in like new glowing blue fire". A Unity-built prefab (uikit,
     bundle ui/prefab/grim/grimframe) mounted in ContentMasteAndExpert at sibling 0, so it draws above the menu background
     and behind the list, the gate and the top. It is fitted to the two divider lines every time the Grim tab opens:
     bottom edge on Line_2, top edge on Line_1, sides at the lines' ends (the prefab anchors every part to an edge, so it
     follows the lines on any aspect ratio). Since 0.6.0 every flame is real-time (uikit shader Grim/Fire), so nothing
     depends on the fitted width. */
  var CME = "BtnController/SafeAreaFitter/Content/ContentMasteAndExpert", FRAME_PATH = "UI/Prefab/Grim/GrimFrame";
  /* the two divider lines the frame is fitted to, and the parent it mounts in: the hub's Line_1 / Line_2 in
     ContentMasteAndExpert; a host can supply its own (w.__grimLines(w) -> [top, bottom, parent]) */
  function frameLines(w) {
    if (w.__grimLines) return w.__grimLines(w);
    var cme = find(w, CME); return cme ? [cme.Find("Line_1"), cme.Find("Line_2"), cme] : [null, null, null];
  }
  /* 0.6.1: the frame's seams replace the stock divider lines while Grim shows (their images are switched off) */
  function linesShown(G, on) {
    for (var ln of (G.lines || [])) { try { var im = Util_1.U.GetComponent(ln.gameObject, CS.UnityEngine.UI.Image); if (im) im.enabled = on } catch (x) {} }
  }
  function frameOn(w, G) {
    var LN = frameLines(w), cme = LN[2]; if (!cme) { log("cme", "frame: no parent for the frame"); return }
    if (!G.frame) {
      var fp = lookOf(G).frame, pf = null; try { pf = loadPf(w, fp) } catch (x) { log("framelx" + fp, "frame load EXC " + x) }
      if (!pf) { log("framenull" + fp, "frame prefab not loaded: " + fp); return }
      G.frame = CS.UnityEngine.Object.Instantiate(pf, cme, false);
      log("frame" + fp, "fire frame mounted: " + fp);
      if (w.__grimFrameMounted) try { w.__grimFrameMounted(G.frame) } catch (x) {}
    } else G.frame.SetActive(true);   /* re-enabling replays its intro (the fire beds rise) */
    G.frame.transform.SetSiblingIndex(0);
    frameFit(G, LN);
    G.lines = [LN[0], LN[1]].filter(x => !!x); linesShown(G, false);
  }
  function frameOff(w, G) { if (G.frame) { try { G.frame.SetActive(false) } catch (x) {} } linesShown(G, true) }
  /* Fits the frame to the lines. Positions are converted into the frame's parent through world space, so the lines can
     live in another panel (the in-run view's are inside DebuffBox). LN[3], when given, widens the span to that line's
     ends (the in-run view spans the whole view, like the hub, not just the list). */
  function frameFit(G, LN) {
    try {
      var l1 = LN[0], l2 = LN[1], par = LN[2];
      if (!l1 || !l2) { log("framelines", "frame: divider lines not found"); return }
      function edge(l) {
        var r = l.rect;
        var p = par.InverseTransformPoint(l.TransformPoint(V3(r.xMin, r.center.y, 0)));
        var q = par.InverseTransformPoint(l.TransformPoint(V3(r.xMax, r.center.y, 0)));
        return { x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), y: (p.y + q.y) / 2 };
      }
      var a = edge(l1), b = edge(l2), x0 = Math.min(a.x0, b.x0), x1 = Math.max(a.x1, b.x1);
      if (LN[3]) { var c = edge(LN[3]); x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1) }
      var W = x1 - x0, H = a.y - b.y;
      if (!(W > 100 && H > 100)) { log("framebad", "frame: odd line geometry " + W + " x " + H); return }
      var rt = G.frame.transform;
      rt.anchorMin = V2(0.5, 0.5); rt.anchorMax = V2(0.5, 0.5); rt.pivot = V2(0.5, 0.5);
      rt.sizeDelta = V2(W, H); rt.localPosition = V3((x0 + x1) / 2, (a.y + b.y) / 2, 0); rt.localScale = V3(1, 1, 1);
      if (!G.frameLogged) { G.frameLogged = 1; log("framefit", "frame fitted to the divider lines: " + W.toFixed(0) + " x " + H.toFixed(0) + " at (" + ((x0 + x1) / 2).toFixed(0) + ", " + ((a.y + b.y) / 2).toFixed(0) + ")") }
    } catch (x) { log("framefitx", "frame fit EXC " + x) }
  }


  /* ---------------- Abyss names: white-hot text on a burning band ----------------
     The lead: the purple Abyss names should be "blue glowing extreme fire text". Each Abyss description starts with its
     name in NAME_TAG (build_grim.py NAME_COLOR, bold). A GrimNameFlame (uikit, bundle ui/prefab/grim/grimnameflame) sits
     behind the name as the text's previous sibling (so the row's own dimming and the list's mask apply to it), sized from
     the name's measured width and placed on the first line of the rendered text. Rows are pooled and re-filled, so each
     row is re-checked every 10 frames. */
  var NAME_TAG = "<color=#E4F8FF>", NAMEFLAME_PATH = "UI/Prefab/Grim/GrimNameFlame";
  function nameText(row) {
    try {
      var arr = Util_1.U.GetComponentsInChildren(row.gameObject, CS.TMPro.TextMeshProUGUI, true);
      for (var i = 0; i < arr.Length; i++) { var t = arr.get_Item(i); if ((t.text || "").indexOf(NAME_TAG) === 0) return t }
    } catch (x) {}
    return null;
  }
  function namesTick(w, G) {
    if ((G.nameT = (G.nameT || 0) + 1) % 10 !== 1) return;
    var list = w.R && w.R.DebuffList; if (!list) return;
    if (G.flamePf === undefined) {
      G.flamePf = null;
      try { G.flamePf = loadPf(w, NAMEFLAME_PATH) } catch (x) { log("nflx", "name flame load EXC " + x) }
      if (!G.flamePf) log("nflnull", "name flame prefab not loaded: " + NAMEFLAME_PATH);
    }
    if (!G.flamePf) return;
    G.flames = G.flames || {};
    for (var i = 0; i < list.childCount; i++) {
      var row = list.GetChild(i), id = row.GetInstanceID(), f = G.flames[id] || (G.flames[id] = { tmp: null, go: null, key: null });
      if (!row.gameObject.activeSelf) continue;
      if (!f.tmp || (f.tmp.text || "").indexOf(NAME_TAG) !== 0) f.tmp = nameText(row);
      if (!f.tmp) { if (f.go && f.go.activeSelf) f.go.SetActive(false); continue }
      var tmp = f.tmp, txt = tmp.text, trt = tmp.transform;
      if (!f.go) {
        f.go = CS.UnityEngine.Object.Instantiate(G.flamePf, trt.parent, false);
        var frt = f.go.transform; frt.anchorMin = V2(0.5, 0.5); frt.anchorMax = V2(0.5, 0.5); frt.pivot = V2(0.5, 0);
      }
      if (!f.go.activeSelf) f.go.SetActive(true);
      if (f.go.transform.GetSiblingIndex() !== trt.GetSiblingIndex() - 1) f.go.transform.SetSiblingIndex(trt.GetSiblingIndex());
      if (f.key !== txt) {   /* measure the name as it is marked up (bold) */
        var end = txt.indexOf("</color>"), pv = tmp.GetPreferredValues(txt.substring(0, end + 8));
        f.nw = pv.x; f.lh = pv.y; f.key = txt;
      }
      var bnd = tmp.textBounds, sc = trt.localScale, lp = trt.localPosition;
      if (!(bnd.size.x > 0)) continue;   /* not rendered yet */
      /* the fire stands on the name's line: its base just under the letters, flames licking up past their tops; the bed
         fades out at both ends (16% each), so it is wider than the name */
      var Wf = f.nw + 44, Hf = f.lh * 1.75;
      var cx = bnd.min.x + f.nw / 2, by = bnd.max.y - f.lh - 2;
      var frt2 = f.go.transform;
      frt2.localPosition = V3(lp.x + cx * sc.x, lp.y + by * sc.y, 0); frt2.sizeDelta = V2(Wf, Hf); frt2.localScale = V3(sc.x, sc.y, 1);
    }
  }
  function namesOff(G) { for (var k in (G.flames || {})) { try { var f = G.flames[k]; if (f.go) f.go.SetActive(false) } catch (x) {} } }

  /* ---------------- light-blue theme ----------------
     Every HeatChangeColor gets Grim's light blue from the palette remap in HeatUtil.GrimVisuals (style 6 -> style 5;
     research 2026-09-28: the colour comes from Mode 4 alone, not the Mutation count); this pass lifts the remaining
     purple and deep-blue tints (graphics no HeatChangeColor drives) to Grim's sky blue. */
  var PROPS = ["_TintColor", "_GlowTint", "_SubAddColor", "_Color"];
  var GRIM_HUE = 197, GRIM_GAIN = 1.12;
  function hsv(c) {
    var r = c.r, g = c.g, b = c.b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 1e-5) {
      if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return { h: h, s: mx > 0 ? d / mx : 0, v: mx };
  }
  function fromHsv(h, s, v, a) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
    else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
    return new CS.UnityEngine.Color(r + m, g + m, b + m, a);
  }
  function tinted(c) { var q = hsv(c); return q.s > 0.18 && q.v > 0.05 && q.h >= 205 && q.h <= 335 }
  function blue(c) { var q = hsv(c); return fromHsv(GRIM_HUE, Math.min(1, q.s * 0.92), q.v * GRIM_GAIN, c.a) }
  function collect(w) {
    var out = [];
    try {
      var arr = Util_1.U.GetComponentsInChildren(w.CsObj.gameObject, CS.UnityEngine.UI.Graphic, true);
      for (var i = 0; i < arr.Length; i++) {
        var gr = arr.get_Item(i), m = null; try { m = gr.material } catch (x) {}
        var props = [];
        if (m) for (var p of PROPS) { try { if (m.HasProperty(p)) props.push(p) } catch (x) {} }
        out.push({ g: gr, m: m, props: props, orig: {}, vc: null });
      }
    } catch (x) { log("collect", "theme collect EXC " + x) }
    return out;
  }
  function applyTheme(w) {
    var T = w.__grimTheme; if (!T) return;
    for (var t of T.items) {
      try {
        for (var p of t.props) {
          var c = t.m.GetColor(p);
          if (tinted(c)) { if (!(p in t.orig)) t.orig[p] = c; t.m.SetColor(p, blue(c)) }
        }
        var vc = t.g.color;
        if (tinted(vc)) { if (!t.vc) t.vc = vc; t.g.color = blue(vc) }
      } catch (x) {}
    }
  }
  function theme(w, on) {
    try {
      if (on) {
        if (!w.__grimTheme) w.__grimTheme = { items: collect(w), tick: 0 };
        applyTheme(w);
        log("themeon", "Grim theme on (" + w.__grimTheme.items.length + " graphics)");
      } else if (w.__grimTheme) {
        for (var t of w.__grimTheme.items) {
          try { for (var p in t.orig) t.m.SetColor(p, t.orig[p]); if (t.vc) t.g.color = t.vc } catch (x) {}
        }
        w.__grimTheme = null;
        if (!w.__grimMap) { try { HeatUtil_1.default.GrimVisuals && HeatUtil_1.default.GrimVisuals(true) } catch (x) {} }
      }
    } catch (x) { log("theme", "theme EXC " + x) }
  }

  /* the shared Grim presentation (src/grim_ui.js) is composed in here at build time */
  /* ---- src/endless_ui.js ---- */
  /* ---------------- the Endless tab: "the Endless Engine" (composed into grim_menu.js at its ENDLESS_UI marker) ----------------
     The lead (2026-09-29): "remember how i had you make a entirely differeny layout for grim abyss and entirely new menus
     too you need to do that for endless too and make it even more extremer than grim same with the hallway effect".
     The whole left panel becomes one machine round the approved Cauldron core (EndlessCore v4); geometry in EMC space
     (ExpertModeContent, 743 x 1090, +y up; the stock layout read from the game's own prefabs, NOTES 2026-09-29):
       - the core in the hex container, centred at EMC (0,5), scale 0.56; the five Mutations ride its coil (each slot
         keeps its stock angle, moved onto the coil); the Entropy number sits on the core's plate;
       - EndlessTop (uikit GrimBuildEndlessTop.cs) behind the stock content at EMC (0,0): a forged ring at radius 320 with
         lava that fills round it as Entropy rises; the 12 Extreme perks are moved into it as furnace vents at 15 + 30 i
         degrees clockwise from the top (their badge art swapped for the vent sprites); a vent burns once its perk is on;
       - a crown of fire over the ring with the deepest Endless stage in its low middle; the obsidian altar under the
         ring, the lava pouring into it, Output and Tactic in its two windows; Endless's rules live in Level Details;
       - around it: EndlessFrame (lava seams on the menu's lines), the forged row skin (EndlessSkin) and ember text,
         through grim_ui.js's look (ENDLESS_LOOK).
     Everything is undone when the tab changes. */
  var CORE_PATH = "UI/Prefab/Grim/EndlessCore", ETOP_PATH = "UI/Prefab/Grim/EndlessTop";
  var ENDLESS_LOOK = { frame: "UI/Prefab/Grim/EndlessFrame", skin: "UI/Prefab/Grim/EndlessSkin",
                       under: [1.0, 0.36, 0.06, 0.85], outline: [1.0, 0.6, 0.22, 1], bot: [1.0, 0.72, 0.42, 1] };
  /* v2 (the lead: "still too similar to grim ... the top layer it needs a totally diff layout"): top to bottom, a crown,
     the engine, and the obsidian altar the lava pours into, whose two windows carry Output and Tactic. v3 (the lead: "the
     crystals look really bad remove them"): the crown is fire, not crystals, and the altar has no crystals */
  var E_CORE = [0, 5], E_CORE_SCALE = 0.56, E_RING = 320, E_WEMC_Y = -134, E_HEX = "/ExpertHeatWaveBox";
  var E_CROWN_WIN = [0, 440], E_ALTAR_WIN = [141, -523], E_BONUS_Y = 250;   /* the crown's readout (v3: over the crown of fire) */
  var E_SAN = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];
  /* 0.10.0 (DESIGN 6.9): Endless runs 0-200 with every Extreme perk on from the start. Lap 1 (0-100) fills the ring
     orange; lap 2 (100-200) runs white-hot over it and lights the vents, which hold Grim's 8 perks and Endless's 4 (their
     thresholds are read from the perk list; these are the defaults) */
  var E_SAN2 = [105, 115, 125, 135, 145, 155, 165, 175, 180, 185, 190, 200], E_LAP = 100, E_CAP = 200;
  var HEATVAL = WEMC + "/ExpertHeatWaveBox/ExpertHeatValText";
  function ventAngle(i) { return 15 + 30 * i }
  function ventPos(i) { var a = ventAngle(i) * Math.PI / 180; return [E_CORE[0] + Math.sin(a) * E_RING, E_CORE[1] + Math.cos(a) * E_RING] }
  /* Entropy -> degrees round the ring: each vent's angle at its perk's threshold, linear between, the last 15 to 100 */
  function lavaAngle(e) {
    if (!(e > 0)) return 0;
    if (e < E_SAN[0]) return 15 * e / E_SAN[0];
    for (var i = 1; i < E_SAN.length; i++) if (e < E_SAN[i]) return ventAngle(i - 1) + 30 * (e - E_SAN[i - 1]) / (E_SAN[i] - E_SAN[i - 1]);
    return Math.min(360, ventAngle(11) + 15 * (e - E_SAN[11]) / (100 - E_SAN[11]));
  }
  /* lap 2: 100-200 -> degrees, each vent's angle at its perk's threshold, linear between, the last stretch to 200 */
  function lavaAngle2(e, T) {
    T = T && T.length === 12 ? T : E_SAN2;
    if (!(e > E_LAP)) return 0;
    if (e < T[0]) return 15 * (e - E_LAP) / (T[0] - E_LAP);
    for (var i = 1; i < T.length; i++) if (e < T[i]) return ventAngle(i - 1) + 30 * (e - T[i - 1]) / (T[i] - T[i - 1]);
    return e >= E_CAP ? 360 : Math.min(360, ventAngle(11) + 15 * (e - T[11]) / (E_CAP - T[11]));
  }
  HeatMenu.__endlessLavaAngle = lavaAngle; HeatMenu.__endlessLavaAngle2 = lavaAngle2; HeatMenu.__endlessVentPos = ventPos;
  function EndlessHeat(h) {
    h = Math.max(0, Math.min(1, h));
    return { spin: 1 + 1.6 * h, coil: 1 + 3.4 * h * h + 0.6 * h, ringI: 1.0 + 0.5 * h, ringH: 0.04 + 0.05 * h, ringS: 0.45 + 0.8 * h,
             coreI: 1.3 + 0.6 * h, coreH: 0.16 + 0.12 * h, sparkD: 0.2 + 0.35 * h, sparkS: 0.3 + 0.6 * h, sprayA: 0.4 + 0.6 * h,
             seamA: 0.2 + 0.8 * h, runeA: 0.15 + 0.75 * h, gearA: 0.03 + 0.42 * h * h, bladeA: 0.05 + 0.4 * h,
             cageA: 0.03 + 0.35 * h * h, arcsHi: Math.max(0, Math.min(1, (h - 0.38) / 0.25)) };
  }
  HeatMenu.__endlessHeat = EndlessHeat;
  function depthHeat(d) { return d > 1 ? Math.min(1, (d - 1) / 29) : 0 }
  HeatMenu.__endlessDepthHeat = depthHeat;
  function lerpCol(a, b, t, al) { return new CS.UnityEngine.Color(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, al) }
  var METAL_LO = [0.75, 0.14, 0.03], METAL_HI = [1, 0.42, 0.1], GOLD_LO = [1, 0.42, 0.1], GOLD_HI = [1, 0.72, 0.32];
  var EGLOWS = [["Serpent/SeamGlow", "seamA", 1], ["Runes/RuneGlow", "runeA", 1], ["Gear/GearGlow", "gearA", 0], ["Blades/BladeGlow", "bladeA", 0], ["Cage/CageGlow", "cageA", 0]];
  function graphic(t) { try { return Util_1.U.GetComponent(t.gameObject, CS.UnityEngine.UI.Graphic) } catch (x) { return null } }
  function img(t) { try { return Util_1.U.GetComponent(t.gameObject, CS.UnityEngine.UI.Image) } catch (x) { return null } }
  function tmpOf(t) { try { return Util_1.U.GetComponent(t.gameObject, CS.TMPro.TextMeshProUGUI) } catch (x) { return null } }
  function keep(C, t) { if (t && !C.moved.some(m => m.t === t)) C.moved.push({ t: t, pos: t.anchoredPosition, sc: t.localScale }) }
  /* a text in the game's own font: a copy of a stock text, its localisation driver removed */
  function cloneTmp(src, parent, name) {
    var go = CS.UnityEngine.Object.Instantiate(src.gameObject, parent, false); go.name = name;
    try { var loc = Util_1.U.GetComponent(go, CS.NOAH.UI.UILocale); if (loc) CS.UnityEngine.Object.Destroy(loc) } catch (x) {}
    var t = tmpOf(go.transform); try { t.enableWordWrapping = false; t.enableAutoSizing = false; t.alignment = 514 } catch (x) {}
    return t;
  }

  function endlessOn(w) {
    var C = w.__endless || (w.__endless = { look: ENDLESS_LOOK, hidden: [], moved: [], go: null, top: null, anim: null, mats: {}, glows: [], sprays: [],
                                            arcsHi: null, best: -1, fill: -1, fill2: -1, vents: [], lit: [], perks: null, slots: null, crest: null });
    var emc = find(w, EMC), box = find(w, WEMC + E_HEX);
    if (!emc || !box) { log("ecbox", "Endless: panel not found"); return }
    // the machine behind the stock content
    if (!C.top) {
      var tp = null; try { tp = loadPf(w, ETOP_PATH) } catch (x) { log("etopl", "Endless top load EXC " + x) }
      if (tp) {
        C.top = CS.UnityEngine.Object.Instantiate(tp, emc, false);
        var trt = C.top.transform; trt.anchoredPosition = V2(0, 0);
        var q = trt.Find("Lava"); C.lava = q ? img(q) : null;
        q = trt.Find("LavaGlow"); C.lavaGlow = q ? img(q) : null;
        q = trt.Find("LavaHot"); C.hot = q ? img(q) : null;
        q = trt.Find("LavaHotGlow"); C.hotGlow = q ? img(q) : null;
        q = trt.Find("LavaHead"); C.head = q || null;
        q = trt.Find("Pour"); C.pour = q ? graphic(q) : null;
        q = trt.Find("PourGlow"); C.pourGlow = q ? q.gameObject : null;
        for (var i = 0; i < 12; i++) { var f = trt.Find("VentFires/VentFire" + i); C.vents.push(f ? f.gameObject : null); C.lit.push(false) }
        C.badge = {};
        for (var bn of ["locked", "off", "on", "cap_locked", "cap_off", "cap_on"]) { var bt = trt.Find("Badges/vent_" + bn); var bi = bt ? img(bt) : null; if (bi) C.badge[bn] = bi.sprite }
        log("etop", "Endless Engine mounted (" + Object.keys(C.badge).length + " vent sprites)");
      } else log("etopnull", "Endless: prefab " + ETOP_PATH + " not loaded");
    } else C.top.SetActive(true);
    if (C.top) C.top.transform.SetSiblingIndex(0);
    // the core in the hex container
    if (!C.go) {
      var pf = null; try { pf = loadPf(w, CORE_PATH) } catch (x) { log("ecload", "Endless core load EXC " + x) }
      if (pf) {
        var go = CS.UnityEngine.Object.Instantiate(pf, box, false), rt = go.transform;
        rt.SetSiblingIndex(0); rt.anchoredPosition = V2(E_CORE[0], E_CORE[1] - E_WEMC_Y); rt.localScale = V3(E_CORE_SCALE, E_CORE_SCALE, 1);
        C.go = go; C.anim = Util_1.U.GetComponent(go, CS.UnityEngine.Animator);
        for (var s = 0; s < 6; s++) { var so = rt.Find("Serpent/Socket" + s); if (so) so.gameObject.SetActive(false) }
        var dp = rt.Find("Depth"); if (dp) dp.gameObject.SetActive(false);
        for (var n of ["SerpentFire", "CoreFire", "Sparks"]) { var t1 = rt.Find(n), g1 = t1 ? graphic(t1) : null; if (g1) C.mats[n] = g1.material }
        for (var e of EGLOWS) { var t2 = rt.Find(e[0]), g2 = t2 ? graphic(t2) : null; if (g2) C.glows.push([g2, e[1], e[2]]) }
        for (var j = 0; j < 2; j++) { var sp = rt.Find("Spray" + j), gs = sp ? graphic(sp) : null; if (gs) C.sprays.push(gs) }
        try { C.arcsHi = Util_1.U.GetComponent(rt.Find("Blades/ArcsHi").gameObject, CS.UnityEngine.CanvasGroup) } catch (x) {}
        log("ecmount", "Endless core mounted (" + Object.keys(C.mats).length + " fire materials, " + C.glows.length + " glows)");
      } else log("ecnull", "Endless: prefab " + CORE_PATH + " not loaded");
    } else C.go.SetActive(true);
    for (var p of HIDE) {
      var h = find(w, p); if (!h) continue;
      if (h.gameObject.activeSelf) { h.gameObject.SetActive(false); C.hidden.push(h.gameObject) }
    }
    endlessPerks(w, C, true);
    endlessSlots(w, C, true);
    endlessBonus(w, C, true);
    endlessCrest(w, C, true);
    frameOn(w, C);
    textFxOn(w, C);
    skinOn(w, ENDLESS_LOOK.skin);
    C.best = -1; C.fill = -1; C.fill2 = -1;
  }
  function endlessOff(w) {
    var C = w.__endless; if (!C) return;
    for (var o of [C.go, C.top]) { if (o) { try { o.SetActive(false) } catch (x) {} } }
    for (var go of C.hidden) { try { go.SetActive(true) } catch (x) {} }
    C.hidden = [];
    endlessPerks(w, C, false);
    endlessSlots(w, C, false);
    endlessCrest(w, C, false);
    for (var m of C.moved) { try { m.t.anchoredPosition = m.pos; m.t.localScale = m.sc } catch (x) {} }
    C.moved = [];
    try { frameOff(w, C) } catch (x) {}
    try { textFxOff(w, C) } catch (x) {}
    try { skinOff(w) } catch (x) {}
  }
  function endlessShow(w, on) { try { on ? endlessOn(w) : endlessOff(w) } catch (x) { log("ecshow", "Endless show EXC " + x) } }

  /* the 12 perks into the ring: the grid and its fitter off, each badge moved to its vent (the list sits in ExpertBuffBox,
     EMC (0,428), scale 0.863), its three backgrounds swapped for the vent sprites (the last perk is the capstone) */
  function endlessPerks(w, C, on) {
    try {
      var box = w.R.ExpertBuffList; if (!box) return;
      var tr = box.transform, go = tr.gameObject;
      var grid = Util_1.U.GetComponent(go, CS.UnityEngine.UI.GridLayoutGroup), fit = null;
      try { fit = Util_1.U.GetComponent(go, CS.NOAH.UI.UISizeFitter) } catch (x) {}
      if (on) {
        if (grid) grid.enabled = false;
        if (fit) fit.enabled = false;
        /* the grid anchors its children at its top-left corner; a vent's position is from the list's centre, so each badge
           is re-anchored on the centre first, as Grim's Descent does (seen in game 2026-09-30: the vents sat on an arc
           down and left of the ring). Re-enabling the grid on leave re-anchors them itself. */
        var kids = [];
        for (var i = 0; i < tr.childCount && kids.length < 12; i++) {
          var c = tr.GetChild(i); if (!c.gameObject.activeSelf) continue;
          c.anchorMin = V2(0.5, 0.5); c.anchorMax = V2(0.5, 0.5); c.pivot = V2(0.5, 0.5);
          kids.push(c);
        }
        C.perks = kids;
        placeVents(C);
        endlessReskin(w, true);
        log("eperks" + kids.length, "Endless: " + kids.length + " perks in the ring");
      } else {
        endlessReskin(w, false);
        C.perks = null;
        if (grid && !grid.enabled) grid.enabled = true;
        if (fit && !fit.enabled) fit.enabled = true;
      }
    } catch (x) { log("eperkx", "Endless perks EXC " + x) }
  }
  function placeVents(C) {
    var K = C.perks; if (!K) return;
    for (var k = 0; k < K.length; k++) { var q = ventPos(k); K[k].anchoredPosition = V2(q[0] / BUFFBOX_SCALE, (q[1] - BUFFBOX_Y) / BUFFBOX_SCALE) }
  }
  function endlessReskin(w, on) {
    var C = w.__endless; if (!C) return;
    C.skinned = C.skinned || [];
    if (!on) { for (var r of C.skinned) { try { r.img.sprite = r.orig; r.img.gameObject.SetActive(r.act) } catch (x) {} } C.skinned = []; return }
    var K = C.perks, B = C.badge; if (!K || !B) return;
    function put(c, path, sprite, hide) {
      var t = c.Find(path); if (!t) return; var im = img(t); if (!im) return;
      if (!C.skinned.some(r => r.img === im)) C.skinned.push({ img: im, orig: im.sprite, act: t.gameObject.activeSelf });
      if (hide) { t.gameObject.SetActive(false); return }
      if (sprite) im.sprite = sprite;
    }
    for (var k = 0; k < K.length; k++) {
      var c = K[k], cap = k === K.length - 1 ? "cap_" : "";
      put(c, BADGE.close, B[cap + "off"]); put(c, BADGE.open, B[cap + "on"]); put(c, BADGE.locked, B[cap + "locked"]);
      put(c, BADGE.openBase, null, true);
    }
  }
  /* the Mutations onto the coil: each keeps its stock angle round the hex centre (WEMC (0,32)), at the coil's radius */
  /* 0.10.0: the tab lists all ten Mutations (Extreme's 5, then Grim's 5; the list builds one child per Mutation), spread
     evenly round the coil clockwise from the top; five or fewer keep their stock angles */
  function endlessSlots(w, C, on) {
    var list = find(w, WEMC + "/ExpertModeBuffList"); if (!list) return;
    C.slots = C.slots || [];
    for (var i = 0; i < list.childCount; i++) {
      var c = list.GetChild(i);
      if (!C.slots.some(s => s.t === c)) C.slots.push({ t: c, x: c.anchoredPosition.x, y: c.anchoredPosition.y, i: i });
    }
    var act = C.slots.filter(s => { try { return s.t.gameObject.activeSelf } catch (x) { return false } });
    var cy = E_CORE[1] - E_WEMC_Y, R = 404 * E_CORE_SCALE, n = act.length;
    for (var s of C.slots) {
      try {
        if (!on) { s.t.anchoredPosition = V2(s.x, s.y); continue }
        var k = act.indexOf(s); if (k < 0) continue;
        var a = n > 5 ? (90 - 360 / n * k) * Math.PI / 180 : Math.atan2(s.y - 32, s.x);
        s.t.anchoredPosition = V2(E_CORE[0] + Math.cos(a) * R, cy + Math.sin(a) * R);
      } catch (x) {}
    }
  }
  HeatMenu.__endlessSlots = endlessSlots; HeatMenu.__endlessPerks = endlessPerks;
  /* Output / Tactic onto the plates (ExpertAdditionalBonus sits at EMC (0,250)); the entries onto the rail */
  /* the altar's windows (EMC): the label on the upper line, its two values under it */
  var E_BONUS = [["ProbabilityText", -E_ALTAR_WIN[0], E_ALTAR_WIN[1] + 16], ["Consciousness", -E_ALTAR_WIN[0] - 48, E_ALTAR_WIN[1] - 14], ["AP", -E_ALTAR_WIN[0] + 48, E_ALTAR_WIN[1] - 14],
                 ["StrategyText", E_ALTAR_WIN[0], E_ALTAR_WIN[1] + 16], ["BlessUpListExpert/0", E_ALTAR_WIN[0] - 48, E_ALTAR_WIN[1] - 14], ["BlessUpListExpert/1", E_ALTAR_WIN[0] + 48, E_ALTAR_WIN[1] - 14]];
  function endlessBonus(w, C, on) {
    if (!on) return;
    for (var m of E_BONUS) {
      var t = null, parts = m[0].split("/");
      try { t = find(w, BONUS + "/" + parts[0]); if (t && parts.length > 1) t = t.GetChild(+parts[1]) } catch (x) { t = null }
      if (!t) { log("ebonus" + m[0], "Endless: bonus item not found: " + m[0]); continue }
      keep(C, t); t.anchoredPosition = V2(m[1], m[2] - E_BONUS_Y);
    }
    var tips = find(w, EMC + "/ExpertHeatAdditionalContent");   /* the rules live in Level Details on this tab */
    if (tips && tips.gameObject.activeSelf) { tips.gameObject.SetActive(false); C.hidden.push(tips.gameObject) }
    var v = find(w, HEATVAL);
    if (v) { keep(C, v); C.val = v }
  }
  /* the crown's window: "DEEPEST" and the number, in the game's own font (copies of the Entropy number) */
  function endlessCrest(w, C, on) {
    if (!on) { if (C.crest) { try { C.crest.label.gameObject.SetActive(false); C.crest.num.gameObject.SetActive(false) } catch (x) {} } return }
    var emc = find(w, EMC), src = find(w, HEATVAL); if (!emc || !src) return;
    if (!C.crest) {
      var lab = cloneTmp(src, emc, "EndlessCrestLabel"), num = cloneTmp(src, emc, "EndlessCrestNum");
      if (!lab || !num) return;
      C.crest = { label: lab, num: num };
      lab.text = Util_1.U.GetLocale("ENDLESS_DEEPEST");
      lab.color = new CS.UnityEngine.Color(1, 0.78, 0.45, 1);
      lab.transform.anchoredPosition = V2(E_CROWN_WIN[0], E_CROWN_WIN[1] + 26); lab.transform.localScale = V3(0.3, 0.3, 1);
      num.transform.anchoredPosition = V2(E_CROWN_WIN[0], E_CROWN_WIN[1] - 8); num.transform.localScale = V3(0.58, 0.58, 1);
    }
    C.crest.label.gameObject.SetActive(true); C.crest.num.gameObject.SetActive(true);
    C.crest.label.transform.SetAsLastSibling(); C.crest.num.transform.SetAsLastSibling();
  }

  function endlessTick(w) {
    var C = w.__endless; if (!C) return;
    for (var go of C.hidden) { try { if (go.activeSelf) go.SetActive(false) } catch (x) {} }   /* stock intros re-enable them */
    placeVents(C);
    if (C.val) { C.val.anchoredPosition = V2(E_CORE[0], E_CORE[1] - E_WEMC_Y - 188 * E_CORE_SCALE); C.val.localScale = V3(0.5, 0.5, 1) }
    endlessSlots(w, C, true);
    var now = 0, dt = 0.016;
    try { now = CS.UnityEngine.Time.unscaledTime; dt = CS.UnityEngine.Time.unscaledDeltaTime } catch (x) {}
    // the lava: lap 1 round the ring to 100, lap 2 white-hot over it to 200, both eased; the bright head rides the front
    var perks = (w.GetHeatBuff && w.GetHeatBuff()) || [], T = perks.length === 12 ? perks.map(b => b.MinSan) : E_SAN2;
    var heat = w.curHeatVal || 0, target = Math.min(heat, E_LAP) / E_LAP, target2 = lavaAngle2(heat, T) / 360;
    if (C.fill < 0) C.fill = 0;
    if (C.fill2 < 0) C.fill2 = 0;
    var k4 = Math.min(1, dt * 4);
    C.fill2 += (target2 - C.fill2) * k4;
    C.fill += (target - C.fill) * (C.fill2 > 0.002 && target < C.fill ? k4 * 0.5 : k4);   // lap 1 drains after lap 2
    for (var li of [C.lava, C.lavaGlow]) { if (li) li.fillAmount = C.fill }
    // once lap 2 runs, lap 1 cools to a darker crimson so the white-hot front reads clearly (GrimBuildEndlessTop ELapCooled)
    var cool = Math.min(1, C.fill2 / 0.04);
    if (C.lava && C.cool !== cool) {
      C.cool = cool;
      var lc = C.lava.color; lc.r = 1 - 0.38 * cool; lc.g = 1 - 0.7 * cool; lc.b = 1 - 0.78 * cool; C.lava.color = lc;   // RGB only: the
      if (C.lavaGlow) { var gc = C.lavaGlow.color; gc.r = 1 - 0.3 * cool; gc.g = 1 - 0.65 * cool; gc.b = 1 - 0.8 * cool; C.lavaGlow.color = gc }   // animator owns alpha
    }
    for (var lh of [C.hot, C.hotGlow]) { if (lh) lh.fillAmount = C.fill2 }
    if (C.head) {
      var front = C.fill2 > 0.002 ? C.fill2 : C.fill, ha = front * 2 * Math.PI;
      C.head.anchoredPosition = V2(E_CORE[0] + Math.sin(ha) * E_RING, E_CORE[1] + Math.cos(ha) * E_RING);
      var hg = graphic(C.head); if (hg) { var hc = hg.color; hc.a = front > 0.005 && (C.fill < 0.998 || C.fill2 > 0.002) ? 0.9 : 0; hg.color = hc }
    }
    // the lava pours into the altar once it has run past the ring's bottom
    var pouring = C.fill >= 0.5;
    if (C.pour && C.pour.enabled !== pouring) C.pour.enabled = pouring;
    if (C.pourGlow && C.pourGlow.activeSelf !== pouring) C.pourGlow.SetActive(pouring);
    // a vent burns while its perk is on; a new one erupts (its flame pops tall)
    for (var i = 0; i < C.vents.length; i++) {
      var on = !!(perks[i] ? (perks[i].IsOpen || perks[i].MinSan <= heat) : heat >= T[i]), v = C.vents[i];
      if (!v) continue;
      if (on !== C.lit[i]) {
        C.lit[i] = on; v.SetActive(on);
        if (on) { C.pop = C.pop || {}; C.pop[i] = 1 }
      }
      if (C.pop && C.pop[i] > 0) {
        C.pop[i] = Math.max(0, C.pop[i] - dt / 0.5);
        var s = 1 + 0.9 * C.pop[i] * C.pop[i]; v.transform.localScale = V3(i % 2 ? -s : s, s, 1);
      }
    }
    // the crest: the deepest stage reached
    var best = 0; try { best = HeatUtil_1.default.EndlessBest() } catch (x) {}
    if (C.crest && C.crest.num.text !== String(best)) C.crest.num.text = String(best);
    // the core burns as deep as the deepest run
    var H = EndlessHeat(depthHeat(best));
    if (best !== C.best && C.go) {
      C.best = best;
      try { if (C.anim) { C.anim.SetFloat("Spin", H.spin); C.anim.SetFloat("Coil", H.coil) } } catch (x) { log("ecanim", "Endless animator EXC " + x) }
      try {
        var m = C.mats;
        if (m.SerpentFire) { m.SerpentFire.SetFloat("_Intensity", H.ringI); m.SerpentFire.SetFloat("_RingH", H.ringH); m.SerpentFire.SetFloat("_Speed", H.ringS) }
        if (m.CoreFire) { m.CoreFire.SetFloat("_Intensity", H.coreI); m.CoreFire.SetFloat("_RingH", H.coreH) }
        if (m.Sparks) { m.Sparks.SetFloat("_SparkDensity", H.sparkD); m.Sparks.SetFloat("_Speed", H.sparkS) }
      } catch (x) { log("ecmat", "Endless materials EXC " + x) }
      if (C.arcsHi) C.arcsHi.alpha = H.arcsHi;
      log("echeat" + best, "Endless core: deepest stage " + best + " (heat " + depthHeat(best).toFixed(2) + ")");
    }
    var h = depthHeat(best);
    for (var k = 0; k < C.glows.length; k++) {
      var gl = C.glows[k], a = H[gl[1]] * (0.85 + 0.15 * Math.sin(now * (5 + 3 * h) + k));
      gl[0].color = gl[2] ? lerpCol(GOLD_LO, GOLD_HI, h, a) : lerpCol(METAL_LO, METAL_HI, h, a);
    }
    for (var sq of C.sprays) { var c = sq.color; c.a = H.sprayA; sq.color = c }
    try { textFxTick(w, C, now) } catch (x) {}
    try { CS.UnityEngine.Shader.SetGlobalFloat("_GrimTimeOffset", CS.UnityEngine.Time.unscaledTime - CS.UnityEngine.Time.timeSinceLevelLoad) } catch (x) {}
  }
  /* the Endless tab's presentation (src/endless_ui.js) */
  var oSetBuffs = P.SetMasterBuffList, oUpdBuffs = P.UpdateMasterBuff;
  /* a rebuilt perk list: Grim reskins its badges; Endless puts every badge back in its vent (anchors, place, skin) */
  P.SetMasterBuffList = function () { var r = oSetBuffs.apply(this, arguments); try { if (this.grimTab && this.__gate) reskin(this, this.__gate, true); if (this.endlessTab && this.__endless) endlessPerks(this, this.__endless, true) } catch (x) {} return r };
  P.UpdateMasterBuff = function () { var r = oUpdBuffs.apply(this, arguments); try { if (this.grimTab && this.__gate) reskin(this, this.__gate, true); if (this.endlessTab && this.__endless) endlessPerks(this, this.__endless, true) } catch (x) {} return r };
  /* the Mutation list is rebuilt with one child per Mutation: Endless spreads its ten round the coil again */
  var oSetMuts = P.SetExpertModeBuffList;
  P.SetExpertModeBuffList = function () { var r = oSetMuts.apply(this, arguments); try { if (this.endlessTab && this.__endless) endlessSlots(this, this.__endless, true) } catch (x) {} return r };
  /* ---------------- scrolling modifier list (0.3.1: rebuilt from the ground up) ----------------
     Why 0.2.x-0.3.0 never scrolled (research 2026-09-28): DebuffList's UISizeFitter runs before its VerticalLayoutGroup,
     so the list's rect never grows past the 15-row viewport and every scroll mechanism (ScrollRect, NavigationSnap, our
     follow) clamped to 0; and the wheel only reaches Rewired action 18 (MapZoom), never UnityEngine.Input.
     Design: every row stays a real, navigable row at its layout position (InputGroup already navigates into masked rows;
     the stock Up/Down locks stay); the viewport is a hard-edged RectMask2D on "Debuff"; the list is moved in whole rows
     (pitch 75 = 66 px row + 9 px spacing) with a short ease, following the selected row with one row of look-ahead and
     revealing the locked tail at the last interactive row; the wheel moves one row per notch. Nothing depends on the
     list's own rect height, the fitters or a ScrollRect. */
  var PITCH = 75, VIEW = 15, MARGIN = 1, SLIDE = 0.12;
  function LS(w) { return w.__ls || (w.__ls = { k: 0, y: 0, from: 0, to: 0, t: 1, selId: 0, rows: 0, ready: false }) }
  function activeRows(l) { var n = 0; for (var i = 0; i < l.childCount; i++) if (l.GetChild(i).gameObject.activeSelf) n++; return n }
  function lsSetup(w) {
    var s = LS(w);
    try {
      var list = w.R.DebuffList, view = list.parent, UI = CS.UnityEngine.UI;
      if (!s.ready) {
        var vlg = Util_1.U.GetComponent(view.gameObject, UI.VerticalLayoutGroup); if (vlg) vlg.enabled = false;
        var fit = Util_1.U.GetComponent(view.gameObject, CS.NOAH.UI.UISizeFitter); if (fit) fit.enabled = false;
        var sr = Util_1.U.GetComponent(view.gameObject, UI.ScrollRect); if (sr) sr.enabled = false;   /* never fight the scroller */
        view.sizeDelta = V2(view.sizeDelta.x, VIEW * PITCH - 9);
        var m = Util_1.U.GetComponent(view.gameObject, UI.RectMask2D) || Util_1.U.AddComponent(view.gameObject, UI.RectMask2D);
        try { m.softness = new CS.UnityEngine.Vector2Int(0, 0) } catch (x) {}   /* a soft edge would dim rows 1 and 15 */
        list.anchorMin = V2(0.5, 1); list.anchorMax = V2(0.5, 1); list.pivot = V2(0.5, 1);
        s.ready = true;
      }
      s.rows = activeRows(list); s.k = 0; s.t = 1; s.selId = 0; lsApply(w, 0);
      log("ls" + s.rows, "list: " + s.rows + " rows, view " + view.rect.height.toFixed(0) + " px (mode " + w.CurBattleMode + (w.grimTab ? " Grim" : "") + ")");
    } catch (x) { log("lsexc", "list setup EXC " + x) }
  }
  function lsApply(w, y) { var s = LS(w), l = w.R.DebuffList; s.y = y; l.anchoredPosition = V2(l.anchoredPosition.x, y) }
  /* the scroll target in whole rows, clamped to [0, rows - 15] */
  function lsClamp(s, k) { return Math.max(0, Math.min(Math.max(0, s.rows - VIEW), k)) }
  function lsGo(w, k) { var s = LS(w); k = lsClamp(s, k); if (k === s.k) return; s.k = k; s.from = s.y; s.to = k * PITCH; s.t = 0 }
  function lsRowOf(w, sel) {
    var lid = w.R.DebuffList.GetInstanceID(), t = sel.transform;
    for (var i = 0; t && i < 12; i++) { var p = t.parent; if (p && p.GetInstanceID() === lid) return t.GetSiblingIndex(); t = p }
    return -1;
  }
  /* which row window keeps the selected row r visible with one row of look-ahead (pure: unit-tested offline) */
  function lsFollow(k, r, rows, last) {
    if (r < k + MARGIN) k = r - MARGIN; else if (r > k + VIEW - 1 - MARGIN) k = r - (VIEW - 1 - MARGIN);
    if (r === last) k = Math.max(k, Math.min(rows - VIEW, r - MARGIN));   /* at the last interactive row, show the locked tail */
    return Math.max(0, Math.min(Math.max(0, rows - VIEW), k));
  }
  HeatMenu.__grimFollow = lsFollow;
  var WHEEL = { src: null };
  function lsWheel() {
    var v = 0;
    try { v = CS.Rewired.ReInput.players.GetPlayer(0).GetAxisRaw(18) } catch (x) { if (!WHEEL.e1) { WHEEL.e1 = 1; log("wheelr", "Rewired wheel EXC " + x) } }
    if (v) { if (WHEEL.src !== "rewired") { WHEEL.src = "rewired"; log("wheelsrc1", "wheel via Rewired MapZoom: " + v) } return v }
    try { v = CS.UnityEngine.Input.mouseScrollDelta.y } catch (x) {}
    if (v && WHEEL.src !== "legacy") { WHEEL.src = "legacy"; log("wheelsrc2", "wheel via UnityEngine.Input: " + v) }
    return v;
  }
  function lsTick(w) {
    var s = LS(w); if (!s.ready || w.CurBattleMode == 1) return;
    s.rows = activeRows(w.R.DebuffList);
    var cur = null, id = 0; try { cur = w.InputGroup.CurrentSelectable; id = cur ? cur.GetInstanceID() : 0 } catch (x) {}
    if (id !== s.selId) {
      s.selId = id;
      var mouse = false; try { mouse = TsGameInputManager_1.default.Instance.GameInputManager.CursorVisible } catch (x) {}
      var r = cur ? lsRowOf(w, cur) : -1;
      if (r >= 0 && !mouse) lsGo(w, lsFollow(s.k, r, s.rows, (w.curMasterDebuffList || []).length - 1));
    }
    var v = lsWheel();
    if (v) lsGo(w, s.k + (v > 0 ? -1 : 1) * Math.max(1, Math.round(Math.abs(v))));
    if (s.t < 1) {
      var dt = 0.016; try { dt = CS.UnityEngine.Time.unscaledDeltaTime } catch (x) {}
      s.t = Math.min(1, s.t + dt / SLIDE);
      lsApply(w, s.from + (s.to - s.from) * (1 - Math.pow(1 - s.t, 3)));
    }
  }
  /* the d-pad locks of each modifier row (tester report 2026-10-18: a controller could not move up from the bottom
     row). The stock list grows by cloning row 0, which carries row 0's Up lock, and LockDir adds to a lock without
     clearing it: the new last row ended up locked Up and Down. Same rule as stock: row 0 Up, the last Down (pure). */
  function navLock(i, n) { return i === 0 ? 1 : i === n - 1 ? 4 : 0 }
  HeatMenu.__grimNavLock = navLock;
  function fixNavLocks(w) {
    var l = w.R.DebuffList, n = (w.curMasterDebuffList || []).length;
    for (var i = 0; i < l.childCount; i++) {
      var es = Util_1.U.GetComponentsInChildren(l.GetChild(i).gameObject, CS.GamePlay.ExcludeInputDirection, true), f = i < n ? navLock(i, n) : 0;
      for (var j = 0; j < es.Length; j++) { var e = es.get_Item(j); e.ReleaseDirALL(); if (f) e.LockDir(f) }
    }
  }
  /* 1.0.3 (Fury, Entropy Select: the mouse and a pad flipped between Mutations and Modifiers, and a stick pushed right
     picked the row above or below). With Redux Menus' Entropy screen up (globalThis.ED.V5), that screen keeps its own
     cursor and puts the game's focus on it every frame, but the game's InputGroup.Navigate still stepped once more for
     every press, so a neighbour was selected for a frame (its select sound and description box) before the cursor took it
     back. Navigate first asks the selected object's GamePlay.ExcludeInputDirection.CheckCanMove, which reads ONE
     direction, the first flag set in the order Up 1, Left 8, Down 4, Right 2 (GameAssembly, read for the pause menu fix,
     local_only/crunch/tester_1114/redux_menus_report.md). So on each new press, from the same direction event the
     screen reads and before Navigate runs, every row button and Mutation chip gets the pressed direction alone as its
     lock: the game's step for that press and its held repeat are refused and the screen's cursor is the only mover.
     Without that screen (stock menu) nothing changes: the stock row locks (fixNavLocks) stay. */
  var NAVBIT = { U: 1, R: 2, D: 4, L: 8 };
  function navBit(x, y) { var k = Math.abs(x) >= Math.abs(y) ? (x > 0 ? "R" : "L") : (y > 0 ? "U" : "D"); return NAVBIT[k] }
  HeatMenu.__grimNavBit = navBit;
  function v5On() { try { var S = globalThis.ED && globalThis.ED.V5; return !!(S && S.root && !S.root.Equals(null) && S.root.gameObject.activeInHierarchy) } catch (x) { return false } }
  function navSels(w) {
    var out = [], TY = require("puerts").$typeof, UI = CS.UnityEngine.UI, X = CS.GamePlay.ExcludeInputDirection;
    var lists = [w.R.DebuffList]; try { var e = w.R.ExpertModeBuffList; if (e) lists.push(e.transform || e) } catch (x) {}
    for (var l of lists) {
      if (!l) continue;
      var ss = l.GetComponentsInChildren(TY(UI.Selectable), false);
      for (var i = 0; i < ss.Length; i++) {
        var go = ss.get_Item(i).gameObject, c = go.GetComponent(TY(X));
        if (!c || c.Equals(null)) c = go.AddComponent(TY(X));
        out.push(c);
      }
    }
    return out;
  }
  function navGuard(w) {
    if (w.__grimNavEv) return;
    var g = null; try { g = w.InputGroup } catch (x) {}
    if (!g) return;
    try {
      var ev = g.NavigationMove.OnChangeInputGroup, st = w.__grimNavSt = { f: 0, held: false };
      w.__grimNavFn = function (v) {
        try {
          var on = Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5;
          if (!on) { if (Math.abs(v.x) < 0.3 && Math.abs(v.y) < 0.3) st.held = false; return }
          if (!v5On()) {
            /* the screen is off (its off switch, list view, a failure): give the stock menu its own locks back once */
            if (st.applied) { st.applied = false; st.f = 0; try { for (var c0 of navSels(w)) c0.exlucdeDir = 0; fixNavLocks(w) } catch (y) {} }
            return;
          }
          var f = navBit(v.x, v.y); if (st.held && st.f === f) return;
          st.held = true; st.f = f; st.applied = true;
          var cs = navSels(w); for (var c of cs) c.exlucdeDir = f;
          if (!st.logged) { st.logged = 1; log("navguard", "Entropy screen: the game's own step is refused (" + cs.length + " buttons)") }
        } catch (x) { if (!st.err) { st.err = 1; log("navguardx", "nav guard EXC " + x) } }
      };
      ev.AddListener(w.__grimNavFn); w.__grimNavEv = ev;
    } catch (x) { log("navguard0", "nav guard not set: " + x) }
  }
  var oExitGuard = P.ExitHeatMenu;
  if (oExitGuard) P.ExitHeatMenu = function () { try { if (this.__grimNavEv && this.__grimNavFn) this.__grimNavEv.RemoveListener(this.__grimNavFn) } catch (x) {} this.__grimNavEv = null; return oExitGuard.apply(this, arguments) };
  var oSetDebuffs = P.SetMasterDebuffList;
  P.SetMasterDebuffList = function () {
    var r = oSetDebuffs.apply(this, arguments);
    try { fixNavLocks(this) } catch (x) { log("navlock", "row locks EXC " + x) }
    return r;
  };
  var oInitMaster = P.InitMasterMode;
  P.InitMasterMode = function () { oInitMaster.apply(this, arguments); lsSetup(this) };
  var oLate = P.LateUpdateWindow;
  P.LateUpdateWindow = function () {
    try { lsTick(this) } catch (x) { log("lsx", "scroller EXC " + x) }
    try { navGuard(this) } catch (x) {}
    if (!this.__lsLogged) { this.__lsLogged = 1; log("late", "LateUpdateWindow running") }
    if (oLate) return oLate.apply(this, arguments);
  };

  /* ---------------- per-frame work (bound from the prototype when the window is created) ---------------- */
  var oUpdate = P.UpdateWindow;
  P.UpdateWindow = function () {
    try { navGuard(this) } catch (x) {}
    try {
      if (this.grimTab && this.CurBattleMode == 4) {
        if (this.__grimTheme && (++this.__grimTheme.tick % 6) === 0) applyTheme(this);
        if (!this.__grimTheme) theme(this, true);
        placePerks(this); try { gateTick(this) } catch (x) { log("gatetick", "gate tick EXC " + x) }
      } else if (this.endlessTab && this.CurBattleMode == 4) {
        try { endlessTick(this) } catch (x) { log("etick", "Endless tick EXC " + x) }
      }
    } catch (x) { log("tick", "tick EXC " + x) }
    if (oUpdate) return oUpdate.apply(this, arguments);
  };
  /* 1.0.3: a hot load of this mod makes a new HeatMenu module, and Redux Menus' Entropy screen hooks InitHeat only once
     per game session (globalThis.__EDhooks), so after a hot load the menu opened as the stock one with no screen and
     its own navigation (2026-11-14, window 4). When the screen's hooks already exist, the new prototype gets the same
     attach call. A cold start or install never takes this path (the screen boots after this module). */
  try {
    var KH = globalThis.__EDhooks;
    if (KH && !P.__edAttach) {
      var oInitHeat = P.InitHeat; P.__edAttach = 1;
      P.InitHeat = function (e, t, a) { var r = oInitHeat.apply(this, arguments); try { if ((a === undefined || a) && globalThis.ED && globalThis.ED.attach) globalThis.ED.attach(this) } catch (x) {} return r };
      log("edhook", "Entropy screen hook put back on the hot-loaded menu");
    }
  } catch (x) {}
  /* ---- src/grim_presets.js ---- */
  /* ---------------- Entropy presets (1.0.2; composed into src/gen/heatmenu.js at the GRIM_PRESETS marker) ----------------
     Tester request 2026-11-13 (Fury): "Having a way to save pre-sets similar to mind crystals would be great". On the
     Extreme, Grim and Endless tabs the menu gets one more button, "Entropy Presets" (Rewired action PRESET_ACTION, pad R3
     / keyboard R: the menu's own buttons use 9, 10, 16, 17, 27 and 31), in the game's hint row like the others. It opens
     the game's Mind Crystal set window in preset mode (src/grim_presets_window.js), which calls back here:
     - snapshot: what the tab shows now (ranks, perks switched on, Mutations switched on, the tab, its Entropy);
     - apply: a preset into the menu, on the preset's tab when that tab is open on this account; a rank above its row's
       top, a row this account has not reached, a perk above the new Entropy, a locked Mutation or ranks past the tab's
       limit are left off (and counted, so the window can say so); what the tab does not carry is put away as a tab
       switch puts it away; then the menu is drawn again the way a tab switch draws it. Nothing is saved here: leaving
       the menu saves the selection the stock way, as if it had been set by hand. */
  var PRESET_ACTION = 73;
  var GP = globalThis.__GRIM_PRESETS = globalThis.__GRIM_PRESETS || {};
  function ptab(t) { return t === GRIM || t === ENDLESS ? t : 0 }
  function pSnapshot(w) {
    var ranks = {}, perks = [], muts = [], heat = 0;
    for (var d of expertList()) if (d.Level > 0) ranks[d.id] = d.Level;
    for (var b of expertPerks()) if (b.IsOpen) perks.push(b.id);
    for (var m of expertMuts()) if (m.IsOpen) muts.push(m.id);
    try { heat = HU().GetCurHeatVal(expertList(), 4) } catch (x) {}
    return { v: 1, tab: tabOf(w), heat: heat, ranks: ranks, perks: perks.sort((a, b) => a - b), muts: muts.sort((a, b) => a - b) };
  }
  function pSame(w, p) {
    if (!w || !p) return false;
    var s = pSnapshot(w), ka = Object.keys(s.ranks), kb = Object.keys(p.ranks || {});
    if (ptab(s.tab) !== ptab(p.tab) || ka.length !== kb.length) return false;
    for (var k of ka) if (s.ranks[k] !== p.ranks[k]) return false;
    var pp = (p.perks || []).slice().sort((a, b) => a - b), pm = (p.muts || []).slice().sort((a, b) => a - b);
    return s.perks.join() === pp.join() && s.muts.join() === pm.join();
  }
  function pSummary(p) {
    var mode = ""; try { mode = Util_1.U.GetLocale("BattleModeName_" + (ptab(p.tab) || 4)) } catch (x) {}
    try { return Util_1.U.GetLocale("GRIM_PRESET_SUM", mode, String(p.heat || 0)) } catch (x) { return mode + " " + (p.heat || 0) }
  }
  /* the body of SwitchMode without its InitHeat (apply draws the menu once at the end) */
  function pGoTab(w, n) {
    var wasGrim = !!w.grimTab, wasEndless = !!w.endlessTab;
    w.grimTab = n === GRIM; GG().tab = w.grimTab;
    w.endlessTab = n === ENDLESS;
    if (wasGrim && !w.grimTab) leaveGrim(w);
    if (wasEndless && !w.endlessTab) endlessShow(w, false);
    DataBinding_1.DB.Heat.CurBattleMode.Value = 4;
    try { w.MessageRollerWidget.ClearMessages() } catch (x) {}
  }
  function pApply(w, p) {
    if (!w || !p || w.readonlyMode || w.CurBattleMode != 4) return { ok: false };
    var skipped = 0, want = ptab(p.tab), H = HU();
    if (want !== tabOf(w)) { if (H.ModeOpen(want || 4)) pGoTab(w, want || 4); else skipped++ }
    GG().stash = { ranks: {}, perks: {}, muts: {} };
    var vis = null; try { vis = new Set(H.GetCurLevelDebuffList(expertList(), 4).map(d => d.id)) } catch (x) {}
    var ranks = p.ranks || {};
    for (var d of expertList()) {
      var lv = +ranks[d.id] || 0, mx = lv;
      try { mx = Xlsx_1.Xlsx.HeatConf.Get(d.id, 4).maxLevel } catch (x) {}
      if (lv && vis && !vis.has(d.id)) { lv = 0; skipped++ }
      if (lv > mx) { lv = mx; skipped++ }
      d.Level = lv;
    }
    /* the tab's limit: ranks come off the last rows first until the total fits */
    var cap = w.maxHeatVal, guard = 0;
    while (H.GetCurHeatVal(expertList(), 4) > cap && guard++ < 999) {
      var L = expertList().filter(d => d.Level > 0); if (!L.length) break;
      L[L.length - 1].Level--; skipped++;
    }
    var heat = H.GetCurHeatVal(expertList(), 4), perks = p.perks || [], muts = p.muts || [];
    for (var b of expertPerks()) { var wantP = perks.indexOf(b.id) >= 0; b.IsOpen = wantP && b.MinSan <= heat; if (wantP && !b.IsOpen) skipped++ }
    for (var m of expertMuts()) { var wantM = muts.indexOf(m.id) >= 0; m.IsOpen = wantM && !m.IsLock; if (wantM && m.IsLock) skipped++ }
    w.InitHeat(w.CurBattleMode, w.teamMode, false);   /* InitExpertMode puts away what this tab does not carry */
    try { sanitizePerks() } catch (x) {}
    try { w.SendSwitchModeMsg() } catch (x) {}
    log("papply" + Date.now(), "preset loaded on tab " + (tabOf(w) || "Extreme") + ": Entropy " + H.GetCurHeatVal(expertList(), 4) + (skipped ? ", " + skipped + " left off" : ""));
    return { ok: true, skipped: skipped };
  }
  GP.api = { snapshot: pSnapshot, same: pSame, summary: pSummary, apply: pApply };
  HeatMenu.__grimPresets = GP.api;

  async function pOpen(w) {
    if (GP.busy || (GP.win && GP.win.__gp) || w.readonlyMode || w.CurBattleMode != 4) return;
    GP.busy = true;
    try {
      GP.pending = { menu: w, at: Date.now() };
      var G = require("Window/Conscious/ConsciousGroup");
      await UIUtil_1.default.AcquireWindowAsync(G.default);
    } catch (x) { GP.pending = null; log("popen", "presets window EXC " + x) }
    finally { GP.busy = false }
  }
  /* the button: a copy of Level Details (BtnShowDetail) with its own action and label, beside it in the button box */
  function presetBtn(w) {
    try {
      var show = w.CurBattleMode == 4 && !w.readonlyMode, go = w.__gpBtn;
      if (!go || CSharpDefine_1.IsNull(go)) {
        if (!show) return;
        var src = w.R.BtnShowDetail; if (!src) return;
        var sg = src.gameObject || src;
        go = CS.UnityEngine.Object.Instantiate(sg, sg.transform.parent, false); go.name = "BtnGrimPresets";
        go.SetActive(false);
        var ba = Util_1.U.GetComponent(go, CS.GamePlay.ButtonAction);
        ba.ActionId = PRESET_ACTION; ba.InputTag = "GRIM_PRESET_TITLE";
        UIUtil_1.default.BindButtonEvent(ba, () => { pOpen(w) });
        w.__gpBtn = go;
        log("pbtn", "presets button made (action " + PRESET_ACTION + ")");
      }
      if (go.activeSelf !== show) go.SetActive(show);
    } catch (x) { log("pbtnx", "presets button EXC " + x) }
  }
  var oInitHeatP = P.InitHeat;
  P.InitHeat = function () { var r = oInitHeatP.apply(this, arguments); presetBtn(this); return r };
  /* a team member's read-only view of the leader's Entropy: no presets (the window is reused, so hide a button made before) */
  var oInitBtnRo = P.InitBtnReadonly;
  if (oInitBtnRo) P.InitBtnReadonly = function () {
    var r = oInitBtnRo.apply(this, arguments);
    try { if (this.__gpBtn && !CSharpDefine_1.IsNull(this.__gpBtn)) this.__gpBtn.SetActive(false) } catch (x) {}
    return r;
  };
  /* Entropy presets (src/grim_presets.js) */
  log("loaded", "Grim menu module loaded");
  } catch (e) { try { require("csharp").System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM menu LOAD EXC " + e + "\n") } catch (x) {} }
})();
