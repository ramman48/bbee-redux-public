/* char-ruby: the SP readout (0.8.0).
   Two testers of the 0.7.0 alpha, 2026-10-03: "SP meter (which is supposed to be used for Dust reloads) doesn't show
   up", "SP count didn't show up throughout the run". On PC the game shows SP in one place only, the Ultra Potential's
   icon in the HUD row (BattleUI_Standalone: IsUltra; the mobile HUD has an SP bar of its own). Her Dust reloads spend SP
   from the first room, with no card, so nothing showed it.
   She gets a badge of her own: a copy of the HUD's own MP badge, above it, labelled SP in the game's SP colour
   (#DF72B2), its number and its fill showing gauge slot 3 (the game's SP). Only while the local character is Ruby: for
   anyone else the copy is removed. The game drives the MP badge through its own references, so it never touches the copy.
   Runs from globalThis.BB_HUD_TICKS (bbee-sdk >= 0.3.3: once a frame with the HUD window).
   Appended to data/js/window/battle/BattleUI (module scope: csharp_1, Util_1, BattleJs_1, CSharpDefine_1), as Nine's
   spell HUD is. Her actor id (the ACTOR token below) is filled in by build_ruby.py. */
(function () {
  var G = globalThis, CS = csharp_1;
  /* (0.9.0) read when used, never kept from the moment the module loads: in the test copy Util_1.U was not there yet
     at that moment, every use threw ("Cannot read properties of undefined (reading 'GetComponent')"), and the badge
     was copied again every frame without ever being labelled (a picture taken inside the game, 2026-10-09) */
  function U() { return Util_1.U }
  function IsNull(x) { return CSharpDefine_1.IsNull(x) }
  var T = (G.BB_HUD_TICKS = G.BB_HUD_TICKS || {}); if (T["char-ruby/sp"]) return;
  var ACTOR = +"@ACTOR@", NAME = "RubySp";    // (inside a string: this file is valid JavaScript before the build fills it in)
  var DY = 104, SCALE = 0.8;                  // above the MP badge (its own units), a size under it
  var PINK = [0.875, 0.447, 0.698];           // #DF72B2: PotentialUtil's colour for SP costs
  var S = { ui: null, go: null, num: null, fill: null, shown: -1, max: -1, err: 0, fail: 0 };

  function player() { try { var b = BattleJs_1.default.Instance; return b && b.Battle ? b.Battle.PlayerSelf : null } catch (e) { return null } }
  function drop() {
    if (S.go && !IsNull(S.go)) CS.UnityEngine.Object.Destroy(S.go);
    S.go = null; S.num = null; S.fill = null; S.ui = null; S.shown = -1;
  }
  function make(ui) {
    var st = ui && ui.R ? ui.R.SelfStatus : null; if (!st || IsNull(st)) return false;
    var tr = st.transform, mp = tr.Find("mp"); if (!mp || IsNull(mp)) return false;
    var old = tr.Find(NAME); if (old && !IsNull(old)) CS.UnityEngine.Object.Destroy(old.gameObject);
    var o = CS.UnityEngine.Object.Instantiate(mp.gameObject, tr); o.name = NAME;
    var rt = o.transform;
    var lab = rt.Find("mp"), num = rt.Find("textMp"), fill = rt.Find("ImageMpFill"), fx = rt.Find("MpAddEffect");
    if (!lab || !num || !fill) { CS.UnityEngine.Object.Destroy(o); return false }
    try {
      rt.anchoredPosition = new CS.UnityEngine.Vector2(mp.anchoredPosition.x, mp.anchoredPosition.y + DY);
      rt.localScale = new CS.UnityEngine.Vector3(SCALE, SCALE, 1);
      var pink = new CS.UnityEngine.Color(PINK[0], PINK[1], PINK[2], 1);
      var tl = U().GetComponent(lab.gameObject, CS.TMPro.TMP_Text); tl.text = "SP"; tl.color = pink;
      S.num = U().GetComponent(num.gameObject, CS.TMPro.TMP_Text);
      S.fill = U().GetComponent(fill.gameObject, CS.UnityEngine.UI.Image); S.fill.color = pink;
      if (fx) fx.gameObject.SetActive(false);   // the MP badge's own gain effect: not copied
    } catch (e) { CS.UnityEngine.Object.Destroy(o); S.num = null; S.fill = null; throw e }   // never leave a half-made copy
    S.go = o; S.ui = ui; S.shown = -1; S.max = -1;
    return !!(S.num && S.fill);
  }
  T["char-ruby/sp"] = function (ui) {
    if (S.fail >= 5) return;                  // it could not be made five times: no badge this session, no copy a frame
    try {
      var p = player(), mine = false;
      try { mine = !!p && Number(p.BaseID) === ACTOR } catch (e) {}
      if (!mine) { if (S.go) drop(); return }
      if (S.ui !== ui || !S.go || IsNull(S.go)) { if (!make(ui)) return }
      var sp = 0, mx = 100;
      try { sp = U().FpToFloat(p.Attr.GetMP(3)); mx = U().FpToFloat(p.Attr.GetMPMax(3)) || 100 } catch (e) {}
      var n = Math.floor(sp + 0.001);
      if (n !== S.shown || mx !== S.max) {
        S.num.text = "" + n; S.fill.fillAmount = Math.max(0, Math.min(1, sp / mx)); S.shown = n; S.max = mx;
      }
    } catch (e) { S.fail++; if (!S.err) { S.err = 1; try { console.error("char-ruby sp hud: " + e) } catch (x) {} } }
  };
})();
