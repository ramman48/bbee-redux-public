
/* Entropy Overhaul 1.0.3: the double-reward room's x2 mark (Aneubys, 2026-11-13: "the x2 symbol will appear fully
   white"). Appended to widget/WidgetBreedRoom, so it shares that module's scope.
   Cause (stock clips read 2026-11-14): GraySwitch, the unselected room's animation, fades the room icon and
   Mask_RoomIcon/x2Mask/x2Image to half alpha with the rest of the row. playDoubleRewardFX then plays X2Enable on
   Mask_RoomIcon's own Animator 200 ms after the row is drawn, and that clip holds the x2 at full alpha, so on a grey,
   unselected row the x2 stays bright white over the half-faded reward icon. Fix: a CanvasGroup on x2Mask (a component
   neither clip animates) follows the row: full on the selected or confirmed row, half on an unselected one, the same
   share GraySwitch gives the room icon. */
;(() => {
  try {
    var TY = require("puerts").$typeof, UE = csharp_1.UnityEngine;
    var P = WidgetBreedRoom.prototype;
    function x2Group(w) {
      var m = w.R && w.R.Mask_RoomIcon; if (!m) return null;
      var t = m.transform ? m.transform : m, x = t.Find("x2Mask"); if (!x) return null;
      var g = x.GetComponent(TY(UE.CanvasGroup));
      if (!g || g.Equals(null)) { g = x.gameObject.AddComponent(TY(UE.CanvasGroup)); g.interactable = false; g.blocksRaycasts = false; }
      return g;
    }
    function x2Sync(w) {
      try {
        var on = !!w.room && w.room.rewardMultiply != null && w.room.rewardMultiply > 1; if (!on) return;
        var g = x2Group(w); if (!g) return;
        g.alpha = w.__grimConfirmed || w.m_lastSelected ? 1 : 0.5;
      } catch (x) {}
    }
    WidgetBreedRoom.__grimX2Alpha = function (selected, confirmed) { return confirmed || selected ? 1 : 0.5 };
    var oSel = P.SelectRefreshImpl, oFx = P.playDoubleRewardFX, oConf = P.SetConfirm;
    P.SelectRefreshImpl = function () { var r = oSel.apply(this, arguments); x2Sync(this); return r };
    P.playDoubleRewardFX = function () { var r = oFx.apply(this, arguments); x2Sync(this); return r };
    P.SetConfirm = function () { this.__grimConfirmed = true; return oConf.apply(this, arguments) };
  } catch (e) { try { csharp_1.System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM rooms LOAD EXC " + e + "\n") } catch (x) {} }
})();
