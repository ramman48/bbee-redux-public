/* palette-maker: the lobby TV's menu gets the "Colour maker" line (appended to manager/TsDialogManager).
   A lobby object's menu is built by ShowIObjEntries(row) from the row's own list of entries, so the line is added to the
   TV's row object (tag IOTV) the first time its menu opens; the table is never rewritten. dr-episode adds its line the
   same way: each hook wraps the one before it. What the line runs is in palcmd.js. */
(function () {
  try {
    var C = exports.default, P = C && C.prototype, FUNC = "OpenPaletteMaker";
    if (!P || typeof P.ShowIObjEntries !== "function" || P.__palMakerEntry) return;
    var stock = P.ShowIObjEntries;
    P.__palMakerEntry = 1;
    P.ShowIObjEntries = function (row) {
      try {
        if (row && row.tag === "IOTV") {
          if (row.funcs && row.funcs.indexOf(FUNC) < 0) row.funcs.push(FUNC);
          if (row.mobileFuncs && row.mobileFuncs.indexOf(FUNC) < 0) { var i = row.mobileFuncs.indexOf("Back"); if (i < 0) row.mobileFuncs.push(FUNC); else row.mobileFuncs.splice(i, 0, FUNC); }
        }
      } catch (e) {}
      return stock.apply(this, arguments);
    };
  } catch (e) { try { CS.UnityEngine.Debug.Log("PALMAKER the lobby TV hook failed: " + e); } catch (e2) {} }
})();
