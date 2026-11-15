/* palette-maker: the command behind the lobby TV's "Colour maker" line (appended to window/dialog/TsDialogCmdHandler). */
(function () {
  try {
    var H = exports.TsDialog && exports.TsDialog.CmdHandler;
    if (H && !H.OpenPaletteMaker) H.OpenPaletteMaker = function () {
      var M = globalThis.BBPAL;
      if (M && M.ui && M.ui.open) M.ui.open();
      else CS.UnityEngine.Debug.Log("PALMAKER the colour maker is not loaded");
    };
  } catch (e) { try { CS.UnityEngine.Debug.Log("PALMAKER the TV command could not be added: " + e); } catch (e2) {} }
})();
