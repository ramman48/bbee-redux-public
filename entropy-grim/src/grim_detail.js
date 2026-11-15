/* Entropy Overhaul: Grim of the Abyss -- the "Level Details" window (appended to gameplay/heat/BattleModeDifficultyDetailBase).
   The Grim tab (104) runs the window as Extreme (4): stages, rounds, bosses, Space Types and Tactics are Extreme's, which
   is exactly what a Grim run plays (the server runs Grim as Extreme). On top of that the tab shows Grim's identity: the
   Grim emblem, the name in Grim blue, a blue tab highlight, and Grim's notes row (what the mode gives you) in the free band
   under the Space Type row. Everything is undone when another tab shows, because the window is pooled (the Stage-3B guides
   reopen it as Advanced). Research: NOTES 2026-09-28 [Entropy Overhaul], Level Details.
   The Endless tab (105) works the same way in ember orange, with Endless's notes row; it keeps Extreme's mode icon. */
;(() => {
  try {
  var GRIM = 104, ENDLESS = 105, CS = csharp_1, P = BattleModeDifficultyDetailBase.prototype;
  var ICON_ATLAS = "UI/Atlas/ChaosValueMB/ChaosValueMB";      /* ExpertModeImg's own atlas */
  var TIP_ATLAS = "UI/Atlas/ChaosValue4/ChaosValue4";         /* GRIM_TIP_n are aliased from here to the Grim icon atlas */
  var BLUE = [0x7F / 255, 0xD8 / 255, 1], FROST = [0xD8 / 255, 0xF4 / 255, 1];
  var EMBER = [1, 0.6, 0.22], ASH = [1, 0.9, 0.78];
  var LOOK = { 104: { key: "GRIM_DetailNotes", lock: "ModeLocked_104", hue: BLUE, text: FROST, open: () => HeatUtil_1.default.GrimUnlocked() },
               105: { key: "ENDLESS_DetailNotes", lock: "ModeLocked_105", hue: EMBER, text: ASH, open: () => HeatUtil_1.default.EndlessUnlocked() } };
  var said = {};
  function log(k, m) {
    if (said[k]) return; said[k] = 1;
    try { CS.System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM detail " + m + "\n") } catch (x) {}
  }
  function col(c, a) { return new CS.UnityEngine.Color(c[0], c[1], c[2], a) }
  function V2(x, y) { return new CS.UnityEngine.Vector2(x, y) }
  function root(w) { return w.CsObj.transform }
  function findDeep(t, name, depth) {   /* first descendant named `name` (breadth-first, bounded) */
    var q = [t], n = 0;
    while (q.length && n++ < 4000) {
      var c = q.shift();
      for (var i = 0; i < c.childCount; i++) { var ch = c.GetChild(i); if (ch.name === name) return ch; q.push(ch) }
    }
    return null;
  }

  /* mode icon: ExpertModeImg (switched on by SetState(4)) shows the Grim emblem. Its AssetImageAdapter binds the stock
     sprite in Start(), which can run after ShowDetail on the first activation, so LateUpdateWindow re-asserts it. */
  function icon(w, on) {
    var box = findDeep(root(w), "ModeImgBox"), ex = box ? box.Find("ExpertModeImg") : null; if (!ex) return;
    var img = Util_1.U.GetComponent(ex.gameObject, CS.UnityEngine.UI.Image); if (!img) return;
    var s = w.__grimIcon || (w.__grimIcon = {});
    if (on) {
      if (!s.grim) s.grim = w.LoadSprite(ICON_ATLAS, "GRIM_EMBLEM_BLUE");
      if (s.grim) { if (!s.on) s.orig = img.sprite; img.sprite = s.grim; img.preserveAspect = true; s.on = true; s.img = img }
    } else if (s.on) {
      img.sprite = s.orig || w.LoadSprite(ICON_ATLAS, "IconOverrunMode3"); img.preserveAspect = false; s.on = false;
    }
  }
  function nameColour(w, mode) {
    var t = w.R.ModeText; if (!t) return;
    if (w.__grimNameCol == null) w.__grimNameCol = t.color;
    t.color = LOOK[mode] ? col(LOOK[mode].hue, 1) : w.__grimNameCol;
  }
  P.GrimTabTint = function (sel, i) {
    try {
      var img = Util_1.U.GetComponent(sel, CS.UnityEngine.UI.Image); if (!img) return;
      var L = LOOK[this.GrimModeList[i]];
      if (sel.__grimOrig == null) sel.__grimOrig = img.color;
      img.color = L ? col(L.hue, 1) : sel.__grimOrig;
    } catch (x) { log("tab", "tab tint EXC " + x) }
  };
  /* the Grim tab's label keeps one line (the stock label wraps; "Grim of the Abyss" is longer than the stock names) */
  P.GrimTabLabel = function (label, i) {
    try { if (LOOK[this.GrimModeList[i]]) label.enableWordWrapping = false } catch (x) {}
  };

  /* Grim's notes row: a header in the style of the "Space Type" header, then the four Grim entries (icon + text) from
     HeatAdditionalContentConf rows with Mode 104; while Grim is locked, the unlock condition instead. Built once per window
     from clones of the window's own RoomTip text, so font, size and material match the window. */
  /* the free band under the Space Type row is y -527..-631: header on the left, the four entries in a 2 x 2 grid */
  var ROW_Y = -579, HEAD_X = -1017, COL_X = [-800, 120], ROW_DY = 25, COL_W = 860, ICON = 38, FONT = 22;
  function cloneText(w, tip, parent, name) {
    var go = CS.UnityEngine.Object.Instantiate(tip.gameObject, parent, false); go.name = name;
    try { var loc = Util_1.U.GetComponent(go, CS.NOAH.UI.UILocale); if (loc) CS.UnityEngine.Object.Destroy(loc) } catch (x) {}
    var tmp = Util_1.U.GetComponent(go, CS.TMPro.TextMeshProUGUI);
    try { tmp.enableWordWrapping = false; tmp.overflowMode = 0; tmp.enableAutoSizing = false } catch (x) {}
    try { var cg = Util_1.U.GetComponent(go, CS.UnityEngine.CanvasGroup); if (cg) cg.alpha = 1 } catch (x) {}
    return tmp;
  }
  function buildNotes(w, mode) {
    var L = LOOK[mode];
    var box = findDeep(root(w), "RoomBox"), tip = box ? box.Find("RoomTip") : null;
    if (!box || !tip) { log("notesmiss", "notes: RoomBox/RoomTip not found"); return null }
    var holder = uiObject("GrimNotes" + mode), rt = holder.transform; rt.SetParent(box.parent, false);
    rt.anchorMin = V2(0.5, 0.5); rt.anchorMax = V2(0.5, 0.5); rt.pivot = V2(0.5, 0.5); rt.sizeDelta = V2(2300, 90);
    rt.anchoredPosition = V2(0, ROW_Y);
    var head = cloneText(w, tip, rt, "GrimNotesTitle");
    head.text = Util_1.U.GetLocale(L.key); head.color = col(L.hue, 1);
    head.alignment = 513;   /* TextAlignmentOptions.Left (middle-left) */
    head.rectTransform.pivot = V2(0, 0.5); head.rectTransform.sizeDelta = V2(300, 60); head.rectTransform.anchoredPosition = V2(HEAD_X - 100, 0);
    var N = { go: holder, items: [], locked: null };
    var rows = Xlsx_1.Xlsx.HeatAdditionalContentConf.All.filter(e => e.mode && e.mode.includes(mode));
    for (var i = 0; i < rows.length && i < 4; i++) {
      var item = uiObject("GrimNote" + i), it = item.transform;
      it.SetParent(rt, false); it.anchorMin = V2(0.5, 0.5); it.anchorMax = V2(0.5, 0.5); it.pivot = V2(0, 0.5);
      it.sizeDelta = V2(COL_W, 44); it.anchoredPosition = V2(COL_X[i % 2], (i < 2 ? 1 : -1) * ROW_DY);
      var ic = uiObject("Icon"), irt = ic.transform;
      irt.SetParent(it, false); irt.anchorMin = V2(0, 0.5); irt.anchorMax = V2(0, 0.5); irt.pivot = V2(0, 0.5);
      irt.sizeDelta = V2(ICON, ICON); irt.anchoredPosition = V2(0, 0);
      var img = Util_1.U.AddComponent(ic, CS.UnityEngine.UI.Image); img.sprite = w.LoadSprite(TIP_ATLAS, rows[i].imgName);
      img.preserveAspect = true; img.raycastTarget = false; img.color = col(L.hue, 1);
      var tx = cloneText(w, tip, it, "Text"); tx.text = Util_1.U.GetLocale(rows[i].localizationTag); tx.color = col(L.text, 0.95);
      tx.fontSize = FONT; tx.alignment = 513;
      tx.rectTransform.anchorMin = V2(0, 0.5); tx.rectTransform.anchorMax = V2(0, 0.5); tx.rectTransform.pivot = V2(0, 0.5);
      tx.rectTransform.sizeDelta = V2(COL_W - ICON - 14, 40); tx.rectTransform.anchoredPosition = V2(ICON + 12, 0);
      N.items.push(item);
    }
    var lk = cloneText(w, tip, rt, "GrimNotesLocked"); lk.text = Util_1.U.GetLocale(L.lock); lk.color = col(L.text, 0.8);
    lk.fontSize = FONT; lk.alignment = 513; lk.rectTransform.pivot = V2(0, 0.5); lk.rectTransform.sizeDelta = V2(1800, 40);
    lk.rectTransform.anchoredPosition = V2(COL_X[0], 0); N.locked = lk.gameObject;
    log("notes" + mode, "notes row built for mode " + mode + ": " + N.items.length + " entries");
    return N;
  }
  /* a new UI object: a plain GameObject given a RectTransform (AddComponent replaces its Transform) */
  function uiObject(name) {
    var go = new CS.UnityEngine.GameObject(name);
    try { Util_1.U.AddComponent(go, CS.UnityEngine.RectTransform) } catch (x) { log("rtexc", "RectTransform EXC " + x) }
    return go;
  }
  function notes(w, mode) {
    var all = w.__grimNotesBy || (w.__grimNotesBy = {});
    if (LOOK[mode] && !all[mode]) all[mode] = buildNotes(w, mode);
    for (var k in all) {
      var N = all[k]; if (!N) continue;
      var on = +k === mode; N.go.SetActive(on);
      if (on) {
        var open = true; try { open = LOOK[mode].open() } catch (x) {}
        for (var it of N.items) it.SetActive(open);
        if (N.locked) N.locked.SetActive(!open);
      }
    }
  }

  P.GrimDetail = function () {
    var mode = this.grimTab ? GRIM : this.endlessTab ? ENDLESS : 0;
    try { icon(this, mode === GRIM) } catch (x) { log("icon", "icon EXC " + x) }
    try { nameColour(this, mode) } catch (x) { log("name", "name colour EXC " + x) }
    try { notes(this, mode) } catch (x) { log("notes", "notes EXC " + x) }
    log("shown" + mode, "detail tab " + (mode === GRIM ? "Grim" : mode === ENDLESS ? "Endless" : "stock") + " (mode " + this.CurBattleMode + ")");
  };
  var oLate = P.LateUpdateWindow;
  P.LateUpdateWindow = function () {
    try { var s = this.__grimIcon; if (this.grimTab && s && s.grim && s.img && s.img.sprite !== s.grim) s.img.sprite = s.grim } catch (x) {}
    if (oLate) return oLate.apply(this, arguments);
  };
  log("loaded", "Grim detail module loaded");
  } catch (e) { try { require("csharp").System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM detail LOAD EXC " + e + "\n") } catch (x) {} }
})();
