/* Entropy Overhaul: Grim of the Abyss -- the in-run Entropy view (appended to gameplay/heat/WidgetHeatMenu).
   The character sheet's ENTROPY EFFECT tab (and the pause menu) show the run's Entropy through WidgetHeatMenu. Its
   Extreme section has the same parts as the hub menu's (Content/Heat/ExpertModeContent: ExpertBuffBox,
   ExpertAdditionalBonus, WidgetExpertModeContent, ExpertHeatAdditionalContent; prefab dump 2026-09-29), so for Grim
   (a Grim run, or Grim selected in the lobby) it gets the hub Grim tab's whole presentation through the shared code
   (src/grim_ui.js, composed in below at build time):
   - the Abyss Gate with the Mutations in its sockets, its fire ring and socket flames;
   - "The Descent": the 8 Grim perks in the funnel, Output/Tactic on the angled panels, the beam, Grim badges;
   - burning seams on the list's two lines, flames at their ends, sparks; the fire text; the Grim row skin; the Abyss
     names' fire; the light-blue hue lift.
   The hub's paths are mapped onto this prefab (mapPath) and the frame is fitted to DebuffBox's two lines. The list
   (up to 19 rows in a 15-row box) gets its own scroller: a RectMask2D on DebuffList and the rows moved through the
   layout's top padding, following the selected row and the mouse wheel. The lead (2026-09-29): "port the main hub grim
   abyss menu to this with all the animations and effects". */
;(() => {
  try {
  var GRIM = 104, CS = csharp_1;
  function GG() { var h = HeatUtil_1.default; return h && h.GrimG ? h.GrimG() : (globalThis.__GRIM = globalThis.__GRIM || {}) }
  function HU() { return HeatUtil_1.default }
  var logged = {};
  function log(k, m) {
    if (logged[k]) return; logged[k] = 1;
    try { CS.System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM widget " + m + "\n") } catch (x) {}
  }
  function isGrimPerk(id) { return id >= 30 && id <= 45 }
  function isGrimMut(id) { return id >= 6 }
  function V2(x, y) { return new CS.UnityEngine.Vector2(x, y) }
  var P = WidgetHeatMenu.prototype;
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

  /* ---------------- this view's layout ---------------- */
  var HUB = "BtnController/SafeAreaFitter/Content/ContentMasteAndExpert";
  function mapPath(path) {
    if (path.indexOf(HUB) === 0) return "Content/Heat" + path.substring(HUB.length);
    return path.indexOf("BtnController/") === 0 ? null : path;   /* hub-only parts (the mode header) aren't in this view */
  }
  /* The frame's lines: DebuffBox's two "Line" children give the heights (the list's top and bottom); the width spans the
     whole view like the hub's (HeatNormal/Line_1, the Normal tab's full-width line, gives its ends). The frame mounts in
     Content/Heat, behind everything. 0.6.1 fitted it to the list alone, so the top fire never reached over the Descent
     (the lead, clip 01:53: "make sure the entropy effects top flames show"). */
  function lines(w) {
    var heat = w.CsObj.transform.Find("Content/Heat"), box = w.CsObj.transform.Find("Content/Heat/DebuffBox"), L = [];
    if (box) for (var i = 0; i < box.childCount; i++) { var c = box.GetChild(i); if (c.name === "Line") L.push(c) }
    L.sort((a, b) => b.localPosition.y - a.localPosition.y);
    var span = w.CsObj.transform.Find("Content/HeatNormal/Line_1");
    return L.length >= 2 ? [L[0], L[L.length - 1], heat || box, span] : [null, null, heat || box, null];
  }
  function frameMounted(go) {}
  function wanted(w) { try { return w.CurBattleMode == 4 && HeatUtil_1.default.GrimContext() } catch (x) { return false } }

  /* ---------------- the list scroller ---------------- */
  var PITCH = 75, VIEW = 15, MARGIN = 1, SLIDE = 0.12;
  function WS(w) { return w.__wls || (w.__wls = { k: 0, y: 0, from: 0, to: 0, t: 1, sel: null, rows: 0, on: false }) }
  function activeRows(l) { var n = 0; for (var i = 0; i < l.childCount; i++) if (l.GetChild(i).gameObject.activeSelf) n++; return n }
  function wlsSetup(w) {
    var s = WS(w);
    try {
      var list = w.R.DebuffList, UI = CS.UnityEngine.UI; if (!list) return;
      var vlg = Util_1.U.GetComponent(list.gameObject, UI.VerticalLayoutGroup); if (!vlg) { log("novlg", "list has no layout group"); return }
      if (!s.on) {
        var r = list.rect;
        s.orig = { size: list.sizeDelta, pivot: list.pivot, pos: list.anchoredPosition, pad: vlg.padding.top };
        var top = list.anchoredPosition.y + (1 - list.pivot.y) * r.height;     /* keep the list's top edge where it is */
        list.pivot = V2(0.5, 1); list.anchoredPosition = V2(list.anchoredPosition.x, top);
        list.sizeDelta = V2(list.sizeDelta.x, VIEW * PITCH - 9);
        s.mask = Util_1.U.GetComponent(list.gameObject, UI.RectMask2D) || Util_1.U.AddComponent(list.gameObject, UI.RectMask2D);
        s.mask.enabled = true;
        try { s.mask.softness = new CS.UnityEngine.Vector2Int(0, 0) } catch (x) {}
        s.vlg = vlg; s.on = true;
      }
      s.rows = activeRows(list); s.k = 0; s.t = 1; apply(w, 0);
      log("ls" + s.rows, "list: " + s.rows + " rows, " + VIEW + " shown");
    } catch (x) { log("lsx", "list setup EXC " + x) }
  }
  function wlsOff(w) {
    var s = w.__wls; if (!s || !s.on) return;
    try {
      var list = w.R.DebuffList, o = s.orig;
      setTop(s.vlg, o.pad);
      list.pivot = o.pivot; list.sizeDelta = o.size; list.anchoredPosition = o.pos;
      if (s.mask) s.mask.enabled = false;
    } catch (x) {}
    s.on = false;
  }
  /* rows move through the layout's top padding. A NEW RectOffset each time: LayoutGroup.padding's setter ignores the
     same object (SetProperty compares with Equals), so editing the current one would never re-lay the rows */
  function setTop(vlg, top) { var pd = vlg.padding; vlg.padding = new CS.UnityEngine.RectOffset(pd.left, pd.right, top, pd.bottom) }
  function apply(w, y) {
    var s = WS(w); s.y = y;
    try { setTop(s.vlg, Math.round((s.orig ? s.orig.pad : 0) - y)) } catch (x) { log("padx", "list padding EXC " + x) }
  }
  function follow(k, r, rows) {
    if (r < k + MARGIN) k = r - MARGIN; else if (r > k + VIEW - 1 - MARGIN) k = r - (VIEW - 1 - MARGIN);
    return Math.max(0, Math.min(Math.max(0, rows - VIEW), k));
  }
  function go(w, k) { var s = WS(w); k = Math.max(0, Math.min(Math.max(0, s.rows - VIEW), k)); if (k === s.k) return; s.k = k; s.from = s.y; s.to = k * PITCH; s.t = 0 }
  function rowOf(w, go) {
    var lid = w.R.DebuffList.GetInstanceID(), t = go ? go.transform : null;
    for (var i = 0; t && i < 12; i++) { var p = t.parent; if (p && p.GetInstanceID() === lid) return t.GetSiblingIndex(); t = p }
    return -1;
  }
  function wheel() {
    var v = 0;
    try { v = CS.Rewired.ReInput.players.GetPlayer(0).GetAxisRaw(18) } catch (x) {}
    if (!v) { try { v = CS.UnityEngine.Input.mouseScrollDelta.y } catch (x) {} }
    return v;
  }
  /* The in-run rows are read-only: the game hides their selectable part, so a controller never enters the list and
     selection can't drive the scroll (0.6.1). The right stick does: Rewired actions Secondary_Space_Y (45) and LookY (21)
     (dump: the game's action constants), one row per step, repeating while held. */
  function stick() {
    var v = 0;
    try { var pl = CS.Rewired.ReInput.players.GetPlayer(0); v = pl.GetAxisRaw(45); if (!v) v = pl.GetAxisRaw(21) } catch (x) {}
    return v || 0;
  }
  function wlsTick(w) {
    var s = WS(w); if (!s.on) return;
    s.rows = activeRows(w.R.DebuffList);
    var cur = null; try { cur = CS.UnityEngine.EventSystems.EventSystem.current.currentSelectedGameObject } catch (x) {}
    var id = cur ? cur.GetInstanceID() : 0;
    if (id !== s.sel) { s.sel = id; var r = cur ? rowOf(w, cur) : -1; if (r >= 0) go(w, follow(s.k, r, s.rows)) }
    var v = wheel(); if (v) go(w, s.k + (v > 0 ? -1 : 1) * Math.max(1, Math.round(Math.abs(v))));
    var st = stick(), now = 0; try { now = CS.UnityEngine.Time.unscaledTime } catch (x) {}
    if (Math.abs(st) > 0.5) {
      if (!s.held || now >= s.next) { go(w, s.k + (st > 0 ? -1 : 1)); s.next = now + (s.held ? 0.09 : 0.32); s.held = true; if (!s.stickLogged) { s.stickLogged = 1; log("stick", "list scrolled with the stick") } }
    } else s.held = false;
    if (s.t < 1) {
      var dt = 0.016; try { dt = CS.UnityEngine.Time.unscaledDeltaTime } catch (x) {}
      s.t = Math.min(1, s.t + dt / SLIDE);
      apply(w, s.from + (s.to - s.from) * (1 - Math.pow(1 - s.t, 3)));
    }
  }

  /* ---------------- switching Grim on and off with the view ---------------- */
  function on(w) {
    w.__grimMap = mapPath; w.__grimLines = lines; w.__grimFrameMounted = frameMounted;
    perkLayout(w, true);
    theme(w, true);
    gateOn(w);
    wlsSetup(w);
    w.__grimOn = true;
    log("on", "Grim in-run view on (" + ((w.GetExpertModeBuff && w.GetExpertModeBuff()) || []).length + " Mutations)");
  }
  function off(w) {
    if (!w.__grimOn) return;
    w.__grimOn = false;
    try { gateOff(w) } catch (x) {}
    try { perkLayout(w, false) } catch (x) {}
    try { theme(w, false) } catch (x) {}
    wlsOff(w);
  }
  var oExpert = P.InitExpertHeat;
  P.InitExpertHeat = function () {
    var r = oExpert.apply(this, arguments);
    try { wanted(this) ? on(this) : off(this) } catch (x) { log("onx", "Grim view EXC " + x) }
    return r;
  };
  for (var mn of ["InitNormalHeat", "InitMasterHeat"]) (function (mn) {
    var o = P[mn]; if (typeof o !== "function") return;
    P[mn] = function () { try { off(this) } catch (x) {} return o.apply(this, arguments) };
  })(mn);
  /* the badges are re-skinned after the stock refresh; rows are re-skinned and re-measured after the list is rebuilt */
  var oBuffs = P.SetMasterBuffList;
  P.SetMasterBuffList = function () { var r = oBuffs.apply(this, arguments); try { if (this.__grimOn && this.__gate) reskin(this, this.__gate, true) } catch (x) {} return r };
  var oDebuffs = P.SetMasterDebuffList;
  P.SetMasterDebuffList = function () { var r = oDebuffs.apply(this, arguments); try { if (this.__grimOn) { skinOn(this); wlsSetup(this) } } catch (x) {} return r };
  var oDisable = P.OnDisable;
  P.OnDisable = function () { try { off(this) } catch (x) {} return oDisable.apply(this, arguments) };
  /* per frame (TsBehaviour binds LateUpdate from the prototype when the widget is created) */
  P.LateUpdate = function () {
    if (!this.__grimOn) return;
    try {
      if (this.__grimTheme && (++this.__grimTheme.tick % 6) === 0) applyTheme(this);
      placePerks(this); gateTick(this); wlsTick(this);
    } catch (x) { log("tick", "tick EXC " + x) }
  };
  log("loaded", "Grim in-run view module loaded");
  } catch (e) { try { require("csharp").System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM widget LOAD EXC " + e + "\n") } catch (x) {} }
})();
