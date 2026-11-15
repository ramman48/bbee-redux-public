globalThis.__BB_NO_ENDLESS=true;
/* Entropy Overhaul: Grim of the Abyss -- HeatUtil helpers (appended to gameplay/heat/HeatUtil). */
;(() => {
  try {
  var GRIM = 104, ABYSS_MIN = 24, ABYSS_MAX = 40, ENDLESS_ROW_MIN = 33;   /* 24-32 Abyss rows, 33-40 Endless rows (0.10.0) */
  HeatUtil.GRIM = GRIM;
  HeatUtil.GrimG = function () {
    return globalThis.__GRIM || (globalThis.__GRIM = { pack: {}, ch: {}, last: -1, gen: -1, log: 0 });
  };
  /* id blocks: Abyss rows (HeatConf 24-40), Grim perks (HeatEffectConf 30-37, Mode 4), Endless perks (38-45, 0.10.0),
     Grim Mutations (ExpertModeConf 6+) */
  HeatUtil.GrimIsAbyss = function (id) { return id >= ABYSS_MIN && id < ENDLESS_ROW_MIN };
  HeatUtil.EndlessIsRow = function (id) { return id >= ENDLESS_ROW_MIN && id <= ABYSS_MAX };
  HeatUtil.GrimIsPerk = function (id) { return id >= 30 && id <= 37 };
  HeatUtil.EndlessIsPerk = function (id) { return id >= 38 && id <= 45 };
  HeatUtil.GrimIsMut = function (id) { return id >= 6 };
  /* the saved Extreme loadout carries at least one Abyss rank (this is what makes a run a Grim run, on the server too) */
  HeatUtil.GrimHasAbyss = function () {
    try {
      var d = HeatUtil.ExpertModeHeatDatas, L = (d && d.DebuffList) || [];
      for (var x of L) if (x.id >= ABYSS_MIN && x.id < ENDLESS_ROW_MIN && x.Level > 0) return true;
    } catch (e) {}
    return false;
  };
  /* Grim is a mode the player SELECTS (0.3.1; the lead: leaving the menu on the Grim tab must keep the hallway and the run
     Grim). The choice is kept in PlayerPrefs (wrapped for JS; survives restarts) and mirrored to globalThis so the local
     server code (server/model/BreedDungeon) reads the same value. Before 0.3.1 a run counted as Grim only when it carried
     an Abyss rank, so leaving the Grim tab at 95 Entropy fell back to Extreme. */
  var SEL_KEY = "BBEE_GRIM_SELECTED";
  HeatUtil.GrimSelected = function () {
    var G = HeatUtil.GrimG();
    if (G.sel == null) { try { G.sel = csharp_1.UnityEngine.PlayerPrefs.GetInt(SEL_KEY, 0) === 1 } catch (e) { G.sel = false } globalThis.__GRIM_SEL = G.sel }
    return G.sel;
  };
  HeatUtil.GrimSetSelected = function (on) {
    var G = HeatUtil.GrimG(); on = !!on;
    G.sel = on; globalThis.__GRIM_SEL = on;
    try { csharp_1.UnityEngine.PlayerPrefs.SetInt(SEL_KEY, on ? 1 : 0); csharp_1.UnityEngine.PlayerPrefs.Save() } catch (e) {}
  };
  /* Grim unlocks with the quota level reached by clearing Extreme at 100 (level 3) */
  HeatUtil.GrimUnlocked = function () {
    try { return HeatUtil.ModeOpen(4) && (DataBinding_1.DB.Heat.CurHeatLevel.Value ?? 0) >= 3 } catch (e) { return false }
  };
  /* the Entropy menu window when it is open and live (not a read-only teammate view); read from the UI system itself,
     not from a flag: 0.4.0 kept a "menu open" flag that went stale after the menu closed, so the hallway kept Extreme's
     colours (game log 02:55:55) */
  HeatUtil.GrimOpenMenu = function () {
    try {
      var w = UIUtil_1.default.FindWindow(HeatMenu_1.default);
      if (w && !w.readonlyMode && w.CsObj && w.CsObj.gameObject.activeInHierarchy) return w;
    } catch (e) {}
    return null;
  };
  /* Grim context: while the Entropy menu is open, the tab on screen; otherwise the selected mode. Endless selected is not
     Grim, even though its loadout carries Abyss ranks (0.10.0: Endless uses them too) */
  HeatUtil.GrimContext = function () {
    try {
      var w = HeatUtil.GrimOpenMenu();
      if (w) return !!w.grimTab && w.CurBattleMode == 4;
      var t = HeatUtil.TeamRunMode ? HeatUtil.TeamRunMode() : null; if (t != null) return t == 104;
      if (HeatUtil.EndlessSelected && HeatUtil.EndlessSelected() && !HeatUtil.GrimSelected() && HeatUtil.EndlessUnlocked()) return false;
      return HeatUtil.GrimSelected() || HeatUtil.GrimHasAbyss();
    } catch (e) { return false }
  };
  /* Grim's content (the Abyss rows, Grim's perks and Mutations) shows for Grim and for Endless (DESIGN 6.9) */
  HeatUtil.AbyssContext = function () {
    try { return HeatUtil.GrimContext() || !!(HeatUtil.EndlessContext && HeatUtil.EndlessContext()) } catch (e) { return false }
  };
  HeatUtil.GrimShowAbyss = function () { return HeatUtil.AbyssContext() };
  /* a row of this mod's block (24-40): Abyss rows for Grim and Endless, Endless rows for Endless only */
  HeatUtil.RowInContext = function (id) {
    if (HeatUtil.EndlessIsRow(id)) { try { return !!(HeatUtil.EndlessContext && HeatUtil.EndlessContext()) } catch (x) { return false } }
    return HeatUtil.AbyssContext();
  };
  /* which perks and Mutations the current context lists: Extreme's, Grim's, or Endless's (Grim's plus its own perks;
     all ten Mutations) */
  HeatUtil.PerkInContext = function (id) {
    var e = false; try { e = !!(HeatUtil.EndlessContext && HeatUtil.EndlessContext()) } catch (x) {}
    if (e) return HeatUtil.GrimIsPerk(id) || HeatUtil.EndlessIsPerk(id);
    return HeatUtil.GrimContext() ? HeatUtil.GrimIsPerk(id) : !(HeatUtil.GrimIsPerk(id) || HeatUtil.EndlessIsPerk(id));
  };
  HeatUtil.MutInContext = function (id) {
    var e = false; try { e = !!(HeatUtil.EndlessContext && HeatUtil.EndlessContext()) } catch (x) {}
    if (e) return true;
    return HeatUtil.GrimIsMut(id) === HeatUtil.GrimContext();
  };
  /* the limit the + / - button art should compare with: 100 on the Extreme tab, the quota on the Grim tab */
  HeatUtil.GrimMaxForUi = function () {
    var v = 100;
    try { v = Misc_1.Misc.heatMisc.levelMaxSanMap[HeatUtil.CurLevel] ?? 100 } catch (e) {}
    var w = HeatUtil.GrimOpenMenu();
    if (w && w.endlessTab) return HeatUtil.ENDLESS_CAP || 200;
    return w && w.grimTab ? v : Math.min(v, 100);
  };

  /* ---------------- Grim colours: the game's own light-blue style (Expert2, HeatStyle 5) ----------------
     Palettes per HeatStyle (dumped 2026-09-28): 3 green, 4 cyan, 5 light blue, 6 purple, 7 orange, 8 red.
     Correction (research 2026-09-28, disassembly): the Mutation count reaches only the TV sign's ICON
     (HeatBillboard.RefreshUIImpl calls GetCurHeatStyle(param, false)). Every other colour -- hallway lamps, floor strip,
     sign platform (HeatChangeLight.GetCurHeatStyle: Mode 4 -> 6) and every HeatChangeColor (menu panels, the sign's grid,
     glow and text: GetCurHeatColor -> GetCurHeatStyle(param, true): Mode 4 -> 6) -- is style 6 for any Extreme param.
     0.3.0-0.4.1 assumed the count coloured everything, which is why the hallway and the sign stayed purple. So Grim now
     re-points style 6's colour data at style 5 while it shows (grimPalettes below); GrimStyleN stays for the sign icon and
     caps Mutation counts at 5 so Grim Mutations can never push the style past Expert5. */
  var GRIM_STYLE_N = 2;
  HeatUtil.GrimStyleN = function (n) {
    try { if (HeatUtil.CurBattleMode == 4 && HeatUtil.GrimContext()) return GRIM_STYLE_N } catch (e) {}
    return Math.min(n || 0, 5);
  };

  /* ---------------- TV sign: the Grim emblem replaces the Extreme icons while Grim is selected ----------------
     HeatBillboard has a static Puerts wrapper (heatIconList, RefreshUI); its HeatModeIcon entries {mode, icon} are read
     through the reflection fallback. Resources.FindObjectsOfTypeAll is not exposed to JS in this build (0.2.2 log), so the
     billboards are found with Object.FindObjectsOfType (wrapped). */
  var CS = csharp_1;
  function TYPEOF(t) { var f = (typeof puerts !== "undefined" && puerts.$typeof) || globalThis.$typeof; return f(t) }
  var VIS = { on: false, undo: [], seen: {}, tex: null };
  var said = {};
  function vlog(k, m) {
    if (said[k]) return; said[k] = 1;
    try { CS.System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM vis " + m + "\n") } catch (x) {}
  }
  function cnt(L) { try { return L.Count != null ? L.Count : L.Length } catch (x) { return 0 } }
  function idOf(o) { try { return o.GetInstanceID() } catch (x) { return null } }
  function grimTexture() {
    if (VIS.tex) return VIS.tex;
    try { VIS.tex = Util_1.U.GetSingleton(CS.NOAH.Asset.AssetManagerBase).LoadAssetByType(TYPEOF(CS.UnityEngine.Texture2D), "UI/Texture/Grim/GrimEmblem") } catch (x) { vlog("tex", "emblem texture EXC " + x) }
    if (!VIS.tex) vlog("texnull", "emblem texture not loaded");
    return VIS.tex;
  }
  function swapIcons() {
    var tex = grimTexture(); if (!tex) return 0;
    var arr = null;
    try { arr = CS.UnityEngine.Object.FindObjectsOfType(TYPEOF(CS.GamePlay.Heat.HeatBillboard), true) } catch (x) { vlog("find", "FindObjectsOfType EXC " + x); return 0 }
    var n = cnt(arr), done = 0, diag = [];
    for (var i = 0; i < n; i++) {
      var bb = arr.get_Item(i), id = idOf(bb);
      if (id == null || VIS.seen["b" + id]) continue;
      VIS.seen["b" + id] = 1;
      try {
        var L = bb.heatIconList, m = cnt(L);
        try { var m0 = m ? L.get_Item(0) : null; diag.push(m + " entries" + (m0 ? " (first mode " + m0.mode + "/" + typeof m0.mode + ")" : "")) } catch (x) { diag.push("entries EXC " + x) }
        for (var j = 0; j < m; j++) {
          var it = L.get_Item(j), md = +it.mode;
          if (md < 3 || md > 8) continue;
          var o = it.icon; it.icon = tex; done++;
          VIS.undo.push(((ii, oo, b) => () => { ii.icon = oo; try { b.RefreshUI() } catch (x) {} })(it, o, bb));
        }
        try { bb.RefreshUI() } catch (x) {}
        signName(bb);
      } catch (x) { vlog("board", "billboard EXC " + x) }
    }
    vlog("boards" + n + "_" + done, "sign: " + n + " billboard(s) found, " + done + " icon(s) swapped [" + diag.join("; ") + "]");
    return done;
  }
  /* ---------------- style 6 -> style 5 while Grim shows ----------------
     HeatChangeLight keeps one colour entry per style on the component (lightChangedParams[].unlitObjectColorParam /
     aceLightColorParam: {style, color -> UnlitObjectColor | AceLightColor}); HeatChangeColor reads shared
     HeatColorPanelConfig assets (heatColorPalette: [{heatStyle, color}], cached until Refresh()). Style 6's entry is
     pointed at style 5's colour, each object/asset once (by instance id), and every change goes on the undo list, so
     leaving Grim puts Extreme's purple back exactly. New lobby objects are caught when they pull the mode (GetModeParam
     hook -> GrimVisuals) before they colour themselves. */
  function items(L) { var out = [], n = cnt(L); for (var i = 0; i < n; i++) { try { out.push(L.get_Item(i)) } catch (x) {} } return out }
  function pair(list, key, a) {   /* [the source entry (style a), style 6's entry]; a = 6 re-hues Extreme's own */
    var ea = null, e6 = null; a = a || 5;
    for (var e of list) { var st = -1; try { st = +e[key] } catch (x) {} if (st === a) ea = e; if (st === 6) e6 = e }
    return ea && e6 ? [ea, e6] : null;
  }
  /* Grim's own lobby light (0.6.0). The lead (clip 23:08): "the hallway blue is too similar to normal blue" -- Normal lights
     the hallway with this same style 5 (HeatChangeLight: Mode 1 -> 5). So Grim re-hues style 5's light instead of copying
     it: lamps, floor strip and the sign go icy cyan-white (hue 196, like the fire), the ambient light goes a darker abyss
     blue (hue 232). Normal's lamp (0.04, 0.68, 2.30) becomes (0.23, 1.75, 2.30) x 1.15; its ambient (0.51, 1.22, 1.96)
     becomes (0.16, 0.35, 1.57). Whites and blacks are left alone. The menu's own panels keep style 5 (the lead: "the menu
     looks good"). */
  function rehue(c, hue, sat, gain) {
    var r = c.r, g = c.g, b = c.b, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (!(mx > 0) || (mx - mn) / mx < 0.15) return c;
    var v = mx * gain, C = v * sat, X = C * (1 - Math.abs(((hue / 60) % 2) - 1)), m = v - C;
    return hue < 240 ? new CS.UnityEngine.Color(m, X + m, C + m, c.a) : new CS.UnityEngine.Color(X + m, m, C + m, c.a);
  }
  function lampCol(c) { return rehue(c, 196, 0.9, 1.15) }
  function ambCol(c) { return rehue(c, 232, 0.9, 0.8) }
  HeatUtil.GrimLampColor = lampCol;
  /* Endless (the lead: "a similar aesthetic to grim mode and for its color to be orange"): Extreme's own lobby light
     (style 6, purple) re-hued to ember orange, keeping its brightness. No stock mode lights the lobby orange
     (HeatChangeLight: Normal 5, Advanced 2 red, Extreme 6), so Endless reads as its own mode. Whites and blacks stay. */
  function hsv(h, s, v, a) {
    var C = v * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - C, r = 0, g = 0, b = 0;
    if (h < 60) { r = C; g = X } else if (h < 120) { r = X; g = C } else if (h < 180) { g = C; b = X }
    else if (h < 240) { g = X; b = C } else if (h < 300) { r = X; b = C } else { r = C; b = X }
    return new CS.UnityEngine.Color(r + m, g + m, b + m, a);
  }
  function emberize(c, hue, sat, gain) {
    var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
    if (!(mx > 0) || (mx - mn) / mx < 0.15) return c;
    return hsv(hue, sat, mx * gain, c.a);
  }
  function eLamp(c) { return emberize(c, 26, 0.88, 1.1) }
  function eAmb(c) { return emberize(c, 14, 0.9, 0.8) }
  var FL = {
    grim: { name: "Grim", sign: "ABYSS", src: 5, lamp: lampCol, amb: ambCol, icons: true, hall: true, hallPf: "UI/Prefab/Grim/GrimHall", signPf: "UI/Prefab/Grim/GrimSign" },
    endless: { name: "Endless", sign: "ENDLESS", src: 6, lamp: eLamp, amb: eAmb, icons: false, hall: true, hallPf: "UI/Prefab/Grim/EndlessHall", signPf: "UI/Prefab/Grim/EndlessSign" }
  };
  HeatUtil.EndlessLampColor = eLamp;
  function pointAt(key, e5, e6) {
    var f = FL[VIS.fl] || FL.grim, o = e6.color, src = e5.color, n = null;
    try {
      if (key === "unlitObjectColorParam") { n = new CS.GamePlay.Heat.UnlitObjectColor(); n.tintColor = f.lamp(src.tintColor) }
      else {
        n = new CS.GamePlay.Heat.AceLightColor();
        n.highLightColor = f.lamp(src.highLightColor); n.brightColor = f.lamp(src.brightColor);
        n.ambientColor = f.amb(src.ambientColor); n.volumeColor = f.amb(src.volumeColor);
      }
    } catch (x) { n = null; vlog("ctor", "light colour object EXC " + x + " (source style used as is)") }
    e6.color = n || src;
    VIS.undo.push(() => { e6.color = o });
  }
  function isSignPanel(cfg) { try { return /normalfx|sceneglow/i.test(cfg.name || "") } catch (x) { return false } }
  function swapLights() {
    var arr = null, done = 0;
    try { arr = CS.UnityEngine.Object.FindObjectsOfType(TYPEOF(CS.GamePlay.Heat.HeatChangeLight), true) } catch (x) { vlog("findl", "HeatChangeLight find EXC " + x); return 0 }
    var n = cnt(arr);
    for (var i = 0; i < n; i++) {
      var h = arr.get_Item(i), id = idOf(h);
      if (id == null || VIS.seen["l" + id]) continue;
      VIS.seen["l" + id] = 1;
      try {
        for (var p of items(h.lightChangedParams))
          for (var key of ["unlitObjectColorParam", "aceLightColorParam"]) { var q = pair(items(p[key]), "style", (FL[VIS.fl] || FL.grim).src); if (q) { pointAt(key, q[0], q[1]); done++ } }
      } catch (x) { vlog("light", "HeatChangeLight EXC " + x) }
    }
    if (done) vlog("lights" + VIS.fl + n + "_" + done, "lights: " + n + " HeatChangeLight(s), " + done + " style-6 entries now " + VIS.fl);
    return done;
  }
  function swapPanel(cfg) {
    var id = idOf(cfg); if (id == null || VIS.seen["p" + id]) return 0;
    VIS.seen["p" + id] = 1;
    var f = FL[VIS.fl] || FL.grim, q = pair(items(cfg.heatColorPalette), "heatStyle", f.src); if (!q) return 0;
    var e6 = q[1], o = e6.color;
    if (f === FL.grim) e6.color = isSignPanel(cfg) ? lampCol(q[0].color) : q[0].color;   /* the TV sign matches the corridor; the menu keeps style 5 */
    else e6.color = f.lamp(o);                                                          /* Endless: Extreme's own colour, in ember orange */
    try { cfg.Refresh() } catch (x) {}
    VIS.undo.push(() => { e6.color = o; try { cfg.Refresh() } catch (x) {} });
    return 1;
  }
  function swapPanels() {
    var done = 0, arr = null;
    try { done += swapPanel(CS.GamePlay.Heat.HeatUtil.DefaultDefaultColorPanelConfig) } catch (x) { vlog("defp", "default panel EXC " + x) }
    try { arr = CS.UnityEngine.Object.FindObjectsOfType(TYPEOF(CS.GamePlay.Heat.HeatChangeColor), true) } catch (x) { vlog("findc", "HeatChangeColor find EXC " + x); return done }
    var n = cnt(arr);
    for (var i = 0; i < n; i++) {
      var c = arr.get_Item(i), id = idOf(c);
      if (id == null || VIS.seen["c" + id]) continue;
      VIS.seen["c" + id] = 1;
      try {
        for (var p of items(c.colorChangedParams)) {
          try { if (p.customColorPanel) done += swapPanel(p.customColorPanel) } catch (x) {}
          try { for (var pr of items(p.changedProperties)) { if (pr.customColorPanel) done += swapPanel(pr.customColorPanel) } } catch (x) {}
        }
      } catch (x) { vlog("hcc", "HeatChangeColor EXC " + x) }
    }
    if (done) vlog("panels" + VIS.fl + n + "_" + done, "panels: " + n + " HeatChangeColor(s), " + done + " palette(s) now " + VIS.fl + " at style 6");
    return done;
  }
  /* ---------------- the lobby on fire: GrimHall (hallway) and GrimSign (TV sign) ----------------
     The lead: "make the hallway like grim blue and on fire and add new cool effects same for the tv". World-space fire
     layers (uikit; bundles ui/prefab/grim/grimhall and grimsign) mounted while Grim shows: the hallway's on
     ExitAniNew/ExitWay (the parent of the active "BlueLight" HeatChangeLight), the sign's on ExitBoard/HeatBoardOpen
     (under the HeatBillboard). Sorting FarScene: above the stock lamps and glows (orders 0 / 15), below the actors.
     They go with the lobby when it unloads; the next lobby mounts fresh ones when it first pulls the mode. */
  var HALL = { hall: null, sign: null, pf: {}, tries: {} };
  function V3(x, y, z) { return new CS.UnityEngine.Vector3(x, y, z) }
  function alive(o) { if (!o) return false; try { return !!o.transform && typeof o.name === "string" } catch (x) { return false } }
  function deep(t, name) {
    var q = [t], n = 0;
    while (q.length && n++ < 600) { var c = q.shift(); for (var i = 0; i < c.childCount; i++) { var ch = c.GetChild(i); if (ch.name === name) return ch; q.push(ch) } }
    return null;
  }
  function prefab(path) {
    if (HALL.pf[path]) return HALL.pf[path];
    if ((HALL.tries[path] = (HALL.tries[path] || 0) + 1) > 5) return null;   /* give up quietly after 5 failed loads */
    var p = null;
    try { p = Util_1.U.GetSingleton(CS.NOAH.Asset.AssetManagerBase).LoadAssetByType(TYPEOF(CS.UnityEngine.GameObject), path) } catch (x) { vlog("pfx" + path, "load EXC " + path + ": " + x) }
    if (!p) vlog("pfnull" + path, "not loaded: " + path);
    return HALL.pf[path] = p || null;
  }
  function mountWorld(path, parent, order, z) {
    var pf = prefab(path); if (!pf) return null;
    var go = CS.UnityEngine.Object.Instantiate(pf, parent, false);
    go.transform.localPosition = V3(0, 0, z);
    try { var cv = Util_1.U.GetComponent(go, CS.UnityEngine.Canvas); cv.sortingLayerName = "FarScene"; cv.sortingOrder = order } catch (x) { vlog("cv" + path, "canvas sorting EXC " + x) }
    return go;
  }
  function hallParent() {
    try {
      var arr = CS.UnityEngine.Object.FindObjectsOfType(TYPEOF(CS.GamePlay.Heat.HeatChangeLight), true), n = cnt(arr);
      for (var i = 0; i < n; i++) { var h = arr.get_Item(i), g = h.gameObject; if (g.name === "BlueLight" && g.activeInHierarchy) return h.transform.parent }
    } catch (x) { vlog("hallp", "hallway search EXC " + x) }
    return null;
  }
  function signParent() {
    try {
      var arr = CS.UnityEngine.Object.FindObjectsOfType(TYPEOF(CS.GamePlay.Heat.HeatBillboard), true), n = cnt(arr);
      /* the billboard is the sign effect spawned INSIDE ExitBoard/HeatBoardOpen (0.5.0 searched only below it and never
         found the sign: log 04:08, "2 billboard(s) found", no mount), so look up its parents first, then below */
      for (var i = 0; i < n; i++) {
        var t = arr.get_Item(i).transform; if (!t.gameObject.activeInHierarchy) continue;
        for (var p = t, k = 0; p && k < 8; p = p.parent, k++) if (p.name === "HeatBoardOpen") return p;
        var f = deep(t, "HeatBoardOpen"); if (f) return f;
      }
      if (!HALL.signMiss) {
        HALL.signMiss = 1;
        var names = []; for (var j = 0; j < n; j++) { try { var q = arr.get_Item(j).transform, chain = []; for (var r = q, c = 0; r && c < 5; r = r.parent, c++) chain.push(r.name); names.push(chain.join(" < ") + (q.gameObject.activeInHierarchy ? "" : " (off)")) } catch (x) {} }
        vlog("signmiss", "sign: HeatBoardOpen not found near " + n + " billboard(s): " + names.join(" | "));
      }
    } catch (x) { vlog("signp", "sign search EXC " + x) }
    return null;
  }
  HeatUtil.GrimHallFx = function (on) {
    if (!on) {
      for (var k of ["hall", "sign"]) { if (alive(HALL[k])) { try { CS.UnityEngine.Object.Destroy(HALL[k]) } catch (x) {} } HALL[k] = null }
      return;
    }
    if (!alive(HALL.hall)) {
      HALL.hall = null;
      var hp = hallParent();
      var F1 = FL[VIS.fl] || FL.grim;
      if (hp) { HALL.hall = mountWorld(F1.hallPf, hp, 3, 0); if (HALL.hall) vlog("hallon" + (HALL.nh = (HALL.nh || 0) + 1), F1.name + " hallway fire mounted under " + hp.name + " (" + HALL.nh + ")") }
    }
    if (!alive(HALL.sign)) {
      HALL.sign = null;
      var sp = signParent();
      var F2 = FL[VIS.fl] || FL.grim;
      if (sp) { HALL.sign = mountWorld(F2.signPf, sp, 16, -0.02); if (HALL.sign) vlog("signon" + (HALL.ns = (HALL.ns || 0) + 1), F2.name + " sign fire mounted under " + sp.name + " (" + HALL.ns + ")") }
    }
  };
  /* The sign's mode name. HeatBillboard.RefreshUIImpl writes BattleModeName_<Mode> ("Extreme") into its `modeName`
     text on every colour event (dump: HeatBillboard.modeName, TextMeshPro). The lead (2026-09-29): "the tv says extreme
     but shows grim abyss it should say abyss". The field is pointed at a hidden copy of the text, so the game's refreshes
     land there, and the real text says ABYSS (keeping its place, font and the sign's colouring); undone when Grim isn't
     shown. */
  function signName(bb) {
    var SIGN_NAME = (FL[VIS.fl] || FL.grim).sign;
    try {
      var mn = bb.modeName; if (!mn || mn.name === "GrimStockModeName") return;
      var dummy = CS.UnityEngine.Object.Instantiate(mn.gameObject, mn.transform.parent, false);
      dummy.name = "GrimStockModeName"; dummy.SetActive(false);
      var dt = Util_1.U.GetComponent(dummy, CS.TMPro.TextMeshPro);
      if (!dt) { CS.UnityEngine.Object.Destroy(dummy); vlog("signname0", "sign: no TextMeshPro on the name copy"); return }
      bb.modeName = dt; mn.text = SIGN_NAME;
      VIS.undo.push(((b, m, d) => () => { try { b.modeName = m; CS.UnityEngine.Object.Destroy(d); b.RefreshUI() } catch (x) {} })(bb, mn, dummy));
      vlog("signname", "sign: mode name shows " + SIGN_NAME);
    } catch (x) { vlog("signnamex", "sign name EXC " + x) }
  }
  /* the sign's name for Endless (no icon swap: Endless keeps Extreme's sign icons until its emblem is approved) */
  function signNames() {
    var arr = null, n = 0, done = 0;
    try { arr = CS.UnityEngine.Object.FindObjectsOfType(TYPEOF(CS.GamePlay.Heat.HeatBillboard), true); n = cnt(arr) } catch (x) { vlog("findn", "billboard find EXC " + x); return 0 }
    for (var i = 0; i < n; i++) {
      var bb = arr.get_Item(i), id = idOf(bb);
      if (id == null || VIS.seen["n" + id]) continue;
      VIS.seen["n" + id] = 1;
      try { signName(bb); done++; bb.RefreshUI() } catch (x) { vlog("namex", "sign name EXC " + x) }
    }
    return done;
  }
  function why() {   /* one-line state for the log when Grim visuals switch off */
    var s = "";
    try { s += "mode " + HeatUtil.CurBattleMode } catch (x) { s += "mode EXC" }
    try { var w = HeatUtil.GrimOpenMenu(); s += ", menu " + !!w + ", tab " + !!(w && w.grimTab) + ", selected " + HeatUtil.GrimSelected() + ", abyss " + HeatUtil.GrimHasAbyss() } catch (x) {}
    return s;
  }
  /* Called just before every stock SendChangeColorEvent and when lobby objects pull the mode (GetModeParam).
     resend = true also re-sends the colour event (used when nothing stock is about to send one). */
  /* Re-entrancy guard: RefreshUI and the colour event call back into GetModeParam -> GrimVisuals. 0.3.0 ran the undo list
     before clearing its state, so each RefreshUI re-entered the restore and the stack overflowed (log 01:44:27,
     "Maximum call stack size exceeded"); the hallway then kept Extreme's colours. */
  HeatUtil.GrimVisuals = function (resend) {
    if (VIS.busy) return;
    VIS.busy = true;
    var want = null;
    try {
      if (HeatUtil.CurBattleMode == 4) {
        if (HeatUtil.GrimContext()) want = "grim";
        else if (HeatUtil.EndlessContext && HeatUtil.EndlessContext()) want = "endless";
      }
    } catch (x) {}
    try {
      if (VIS.on && VIS.fl !== want) {   /* switching off, or from one flavour to the other: undo everything first */
        var undo = VIS.undo, was = VIS.fl; VIS.undo = []; VIS.seen = {}; VIS.on = false; VIS.fl = null;
        for (var k = undo.length - 1; k >= 0; k--) { try { undo[k]() } catch (x) {} }
        try { HeatUtil.GrimHallFx && HeatUtil.GrimHallFx(false) } catch (x) {}
        VIS.offs = (VIS.offs || 0) + 1; if (VIS.offs <= 6) vlog("off" + VIS.offs, FL[was].name + " visuals restored (" + why() + ")");
      }
      if (want) {
        VIS.fl = want;
        var f = FL[want], c = f.icons ? swapIcons() : signNames(), nl = swapLights(), np = swapPanels();
        if (f.hall) { try { HeatUtil.GrimHallFx && HeatUtil.GrimHallFx(true) } catch (x) { vlog("hallx", "hall fx EXC " + x) } }
        if (!VIS.on) { VIS.on = true; vlog("on" + want + c, f.name + " visuals ON: " + c + " sign(s), " + nl + " light entries, " + np + " palettes") }
      }
      if (resend) { var n = 0; try { n = HeatUtil.GetEnabledExpertBuffCount() } catch (x) {} CS.GamePlay.Heat.HeatUtil.SendChangeColorEvent(HeatUtil.CurBattleMode, HeatUtil.GrimStyleN(n)) }
    } catch (x) { vlog("visexc", "GrimVisuals EXC " + x) }
    finally { VIS.busy = false }
  };
  } catch (e) { try { require("csharp").System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM util LOAD EXC " + e + "\n") } catch (x) {} }
})();


/* Entropy Overhaul: Endless -- HeatUtil helpers (appended to gameplay/heat/HeatUtil after grim_util.js).
   Endless is a mode the player selects on its own tab of the Entropy menu (the lead, 2026-09-29: "a new seperate mode
   ... just like you did for grim"). It runs as Extreme internally, with Grim's rules and content carried on to 200
   Entropy (0.10.0, DESIGN 6.9); the server side (the run,
   records, unlock) is src/endless_run.js in server/model/BreedDungeon, reached through globalThis.__ENDLESS. */
;(() => {
  try {
  var ENDLESS = 105, SEL_KEY = "BBEE_ENDLESS_SELECTED";
  /* Part 1 ships Grim alone (the lead, 2026-11-14): build_grim.py ENDLESS_SHIPS False sets __BB_NO_ENDLESS. No tab, no
     selection and no unlock then; a selection saved by an earlier build is dropped, so an Extreme run stays Extreme. */
  var OFF = !!globalThis.__BB_NO_ENDLESS;
  HeatUtil.ENDLESS = OFF ? 0 : ENDLESS;
  if (OFF) globalThis.__ENDLESS_SEL = false;
  HeatUtil.ENDLESS_CAP = 200;   /* Endless's Entropy limit, from the start (DESIGN 6.9; build_grim.py ENDLESS_CAP) */
  function E() { return globalThis.__ENDLESS || {} }
  /* the choice survives restarts (PlayerPrefs) and is mirrored to globalThis for the local server code */
  HeatUtil.EndlessSelected = function () {
    if (OFF) return false;
    if (globalThis.__ENDLESS_SEL == null) { try { globalThis.__ENDLESS_SEL = csharp_1.UnityEngine.PlayerPrefs.GetInt(SEL_KEY, 0) === 1 } catch (e) { globalThis.__ENDLESS_SEL = false } }
    return !!globalThis.__ENDLESS_SEL;
  };
  HeatUtil.EndlessSetSelected = function (on) {
    on = !!on && !OFF; globalThis.__ENDLESS_SEL = on;
    try { csharp_1.UnityEngine.PlayerPrefs.SetInt(SEL_KEY, on ? 1 : 0); csharp_1.UnityEngine.PlayerPrefs.Save() } catch (e) {}
  };
  /* unlocked by a Grim clear (recorded in the Endless sidecar; a saved Extreme clear above 100 also counts) */
  HeatUtil.EndlessUnlocked = function () {
    if (OFF) return false;
    try { return HeatUtil.ModeOpen(4) && !!(E().grimCleared && E().grimCleared()) } catch (e) { return false }
  };
  /* a co-op run's mode, the host's (104 / 105 / 0), while this game is in a Four Player lobby; null otherwise. A guest
     follows it even without the unlock on its own save: the fight is lockstep, so every game builds the same rules */
  HeatUtil.TeamRunMode = function () {
    try { var L = globalThis.BB4L, t = globalThis.__GRIM_TEAM; return L && L.state == "in" && t != null ? t | 0 : null } catch (e) { return null }
  };
  /* Endless context: while the Entropy menu is open, the tab on screen; in a co-op run, the host's mode; otherwise the
     selected mode */
  HeatUtil.EndlessContext = function () {
    try {
      var w = HeatUtil.GrimOpenMenu();
      if (w) return !!w.endlessTab && w.CurBattleMode == 4;
      var t = HeatUtil.TeamRunMode(); if (t != null) return t == ENDLESS;
      return HeatUtil.EndlessSelected() && !HeatUtil.GrimSelected() && HeatUtil.EndlessUnlocked();
    } catch (e) { return false }
  };
  /* the mode this game picked, for a co-op host to send with the fight (Four Player: TeamPveHeatData.BB4.grimMode):
     104 Grim, 105 Endless, 0 stock (0.13.0) */
  HeatUtil.GrimRunMode = function () {
    try {
      if (HeatUtil.CurBattleMode != 4) return 0;
      if (HeatUtil.GrimSelected && HeatUtil.GrimSelected()) return 104;
      if (HeatUtil.EndlessSelected() && HeatUtil.EndlessUnlocked()) return ENDLESS;
    } catch (e) {}
    return 0;
  };
  /* what this PC would start (Four Player's host check): the battle mode, the heat level index and 104 / 105 / 0 */
  HeatUtil.GrimRunSummary = function () {
    var s = { mode: 0, level: 0, grimMode: 0 };
    try { s.mode = HeatUtil.CurBattleMode | 0; s.level = HeatUtil.CurLevel | 0; s.grimMode = HeatUtil.GrimRunMode() } catch (e) {}
    return s;
  };
  /* the deepest stage reached in Endless (any character) */
  HeatUtil.EndlessBest = function () { try { return E().best ? E().best() : 0 } catch (e) { return 0 } };
  } catch (e) { try { require("csharp").System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " ENDLESS util LOAD EXC " + e + "\n") } catch (x) {} }
})();
