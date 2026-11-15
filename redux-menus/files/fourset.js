// Redux Menus: a "Redux" tab in the game's Settings window (the lead, 2026-11-10: "make a new tab for settings for
// Redux"). The tab and its page are copies of the game's own "Other" tab and page, so they look, sound and navigate
// like the rest of the window (pad, keyboard and mouse through the game's own Switcher rows); the copies carry none of
// the game's settings code. Each row writes one of this mod's options (fourbase.js, ReduxMenus.json).
//   heads   the hero icons on the character select: diamond (the game's shape) or square
//   fx      the menus' moving effects: full or calm (the character select obeys it: no stage effects, a still ground)
(function () {
  var G = globalThis, B = G.BB4; if (!B) return;
  var cs = CS, UE = cs.UnityEngine, TMP = cs.TMPro, T = puerts.$typeof;
  var S = G.BB4SET = G.BB4SET || {};
  S.ROWS = [
    { key: "heads", name: "Hero icons", values: ["diamond", "square"], labels: ["Diamond", "Square"],
      hint: "Sets the shape of the hero icons on the character select. Diamond is the game's own shape, and Square shows more of each face." },
    { key: "fx", name: "Menu effects", values: ["full", "calm"], labels: ["Full", "Calm"],
      hint: "Full plays every effect of the Redux menus. Calm keeps the layout and colours and stops the moving stage effects, for a quieter screen." }
  ];
  function log(m) { try { B.log("FOURSET", m); } catch (e) {} }
  function kill(go, typeName) {
    var cs2 = go.GetComponents(T(UE.Component));
    for (var i = cs2.Length - 1; i >= 0; i--) { var c = cs2.get_Item(i); if (c && c.GetType().Name == typeName) UE.Object.DestroyImmediate(c); }
  }
  function setText(tr, s) { var t = tr.GetComponent(T(TMP.TMP_Text)); if (!t) return; kill(tr.gameObject, "UILocale"); t.text = s; }
  function ensure(win) {
    var root = win.CsObj.transform, tabs = root.Find("TabList"), pages = root.Find("PageList");
    if (!tabs || !pages) return;
    var have = tabs.Find("TabRedux"); if (have && !have.Equals(null)) return;
    var UI = require("Core/UIUtil").default, U = require("Core/Util").U, AU = require("Core/AudioUtil").default;
    var srcTab = tabs.Find("TabMisc"), srcPage = pages.Find("MiscSettingsWidget");
    // the page: a copy made while switched off, so the game's page code never runs in it
    var wasOn = srcPage.gameObject.activeSelf; srcPage.gameObject.SetActive(false);
    var page = UE.Object.Instantiate(srcPage.gameObject, pages, false); page.name = "ReduxSettingsWidget";
    srcPage.gameObject.SetActive(wasOn);
    kill(page, "JsBehaviour"); kill(page, "JsInjector");
    var pt = page.transform, content = pt.Find("Scroll View/Viewport/Content"), btn = pt.Find("Buttons"); if (btn) btn.gameObject.SetActive(false);
    var tpl = content.Find("DashSettings");
    for (var i = content.childCount - 1; i >= 0; i--) { var ch = content.GetChild(i); if (ch != tpl && !ch.Equals(tpl)) UE.Object.DestroyImmediate(ch.gameObject); }
    var dT = pt.Find("SettingDetail/DetailTitleText"), dC = pt.Find("SettingDetail/DetailContentText");
    function detail(r) { try { pt.Find("SettingDetail").gameObject.SetActive(true); setText(dT, r ? r.name : ""); setText(dC, r ? r.hint : ""); } catch (e) {} }
    var first = null;
    S.ROWS.forEach(function (r, n) {
      var row = n == 0 ? tpl : UE.Object.Instantiate(tpl.gameObject, content, false).transform; row.name = "Redux_" + r.key; row.gameObject.SetActive(true);
      setText(row.Find("Name"), r.name);
      var swT = null; for (var k = 0; k < row.childCount; k++) if (row.GetChild(k).GetComponent(T(cs.NOAH.UI.Switcher))) swT = row.GetChild(k);
      var sw = swT.GetComponent(T(cs.NOAH.UI.Switcher)); swT.name = "Switcher_" + r.key;
      var list = new (puerts.$generic(cs.System.Collections.Generic.List$1, cs.System.String))(); r.labels.forEach(function (x) { list.Add(x); });
      sw.Options = list; var cur = r.values.indexOf(B.opt(r.key)); sw.ValueNoSeedCallBack = cur < 0 ? 0 : cur;
      UI.BindSwitchEvent(sw, function (v) { B.setOpt(r.key, r.values[v] || r.values[0]); log(r.key + " = " + B.opt(r.key)); });
      UI.BindSelectEvent(sw, function () { detail(r); });
      if (!first) first = swT.gameObject;
    });
    detail(S.ROWS[0]);
    // the tab: a copy of "Other" that shows our page and nothing of the game's
    var tab = UE.Object.Instantiate(srcTab.gameObject, tabs, false); tab.name = "TabRedux";
    kill(tab, "UIToggleObjects"); kill(tab, "ToggleChangeHandler");
    tab.transform.SetSiblingIndex(srcTab.GetSiblingIndex() + 1);
    setText(tab.transform.Find("Label"), "Redux");
    var tg = tab.GetComponent(T(UE.UI.Toggle)); tg.isOn = false; var sel = tab.transform.Find("Selected"); if (sel) sel.gameObject.SetActive(false);
    tg.onValueChanged.AddListener(function () {
      var on = tg.isOn; page.SetActive(on); if (sel) sel.gameObject.SetActive(on);
      if (!on) return;
      try { win.OnTabClick(tg); AU.PlaySoundUI("sfx_ui_levelup1"); UI.PlayAllTween(tab.transform, "Select"); } catch (e) {}
      try { S.ROWS.forEach(function (r) { var q = content.Find("Redux_" + r.key + "/Switcher_" + r.key); if (q) { var c = r.values.indexOf(B.opt(r.key)); q.GetComponent(T(cs.NOAH.UI.Switcher)).ValueNoSeedCallBack = c < 0 ? 0 : c; } }); } catch (e) {}
      try { UE.EventSystems.EventSystem.current.SetSelectedGameObject(first); } catch (e) {}
    });
    try { win.tabMap.set("TabRedux", tg); } catch (e) {}
    page.SetActive(false);
    log("Redux tab added to Settings");
  }
  S.ensure = ensure;
  // the window's module is asked for after the boot, never while this file loads (a require of a window here hangs a
  // cold boot: tools\bootcheck.py); tried every 3 s until it answers
  function hookWin() {
    var P; try { P = require("Window/GameSettings").default.prototype; } catch (e) { return false; }
    if (!P.__rdxInit) { P.__rdxInit = P.InitWindow; P.InitWindow = function () { try { G.BB4SET.ensure(this); } catch (e) { try { G.BB4.log("FOURSET", "tab not added: " + e); } catch (e2) {} } return P.__rdxInit.apply(this, arguments); }; log("Settings window hooked"); }
    return true;
  }
  if (S.timer) { try { clearInterval(S.timer); } catch (e) {} }
  var tries = 0; S.timer = setInterval(function () { if (hookWin() || ++tries > 200) { clearInterval(S.timer); S.timer = null; } }, 3000);
})();
