// Redux Menus and Four-player online: what every part of both shares (BB4). Loaded first, by redux-menus;
// four-player requires redux-menus (mod.json "requires"), so this file is always there before its parts.
// - WIN: the window number ("-bbwin N" on the command line; 1 without it). Windows on one PC are for testing only.
// - DEV: true on the PC that builds the mods (the workspace exists): parts are read again from the workspace when
//   their file changes, and the log goes to the workspace's modlog<N>.txt like every other mod's.
// - Everywhere else (a tester's PC) the log is FourPlayer.log in the game's own data folder
//   (%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect), the file testers send when something goes wrong.
(function () {
  var cs = CS, G = globalThis, F = cs.System.IO.File, D = cs.System.IO.Directory;
  var B = G.BB4 = G.BB4 || {};
  B.WIN = 1;
  try { var av = cs.System.Environment.GetCommandLineArgs(); for (var i = 0; i < av.Length - 1; i++) if (String(av.get_Item(i)).toLowerCase() == "-bbwin") B.WIN = Math.max(1, parseInt(av.get_Item(i + 1)) || 1); } catch (e) {}
  var SUF = B.WIN > 1 ? String(B.WIN) : "";
  // the workspace: filled in by the mod loader that builds it; the dev menu's own root; the usual folder
  var roots = ["@ROOT@", G.BBTR && G.BBTR.root, B.ROOT, "C:/BBEE_Steam"];
  B.ROOT = null;
  for (var r = 0; r < roots.length; r++) { var c = roots[r]; if (c && c.charAt(0) != "@") { try { if (D.Exists(c + "/mods/redux-menus/files")) { B.ROOT = c; break; } } catch (e) {} } }
  B.DEV = !!B.ROOT;
  // the folders B.load reads the parts from, in order: the menus' and four-player's files. A test window on the
  // development PC may put a work folder first instead (globalThis.BB4SRC).
  B.SRCS = B.DEV ? [B.ROOT + "/mods/redux-menus/files/", B.ROOT + "/mods/four-player/files/"] : [];
  if (B.DEV && G.BB4SRC && B.WIN > 1) B.SRCS.unshift(G.BB4SRC);
  B.SRC = B.SRCS[0] || null;
  try { B.DATA = String(cs.UnityEngine.Application.persistentDataPath); } catch (e) { B.DATA = "."; }
  B.LOGF = B.DEV ? B.ROOT + "/modlog" + SUF + ".txt" : B.DATA + "/FourPlayer" + SUF + ".log";
  B.LOBBYDIR = B.DEV ? B.ROOT + "/local_only/fourplayer/lobbies" : B.DATA + "/FourPlayerLobbies";
  // redux-menus' own version (four-player's B.VER, the one two games must share, is set in fourlobby.js)
  B.MENUS = "0.1.27";   // keep equal to mod.json
  // how many players a lobby and a fight take (Soulve, 2026-10-17: "increases the max limit of players to 8 and account
  // for up to 16 players in the future"). Every part reads B.MAX; the screens lay themselves out for any count up to
  // B.CAP, so going to 16 is this one number (and a test with 16).
  B.CAP = 16;
  B.MAX = 8;
  B.log = function (tag, m) { try { F.AppendAllText(B.LOGF, (new Date()).toISOString() + " " + tag + " " + m + "\n"); } catch (e) {} };
  B.es = function (e) { return String(e && e.stack || e).replace(/[\r\n]+/g, " ").slice(0, 300); };
  // the menus' own settings, one JSON file in the game's data folder as Tag Mode keeps TagMode.json; a test window
  // (-bbwin N) keeps its own file, so a test never writes window 1's. tilt: the screens lean with the mouse (off: they
  // stand still, the testers' wish of 2026-11-07); heroView / heroSort: the hero step as a grid or a list and the list's
  // order; favEvos: the Evotype uids starred on the Legacy page; triple: runs start with three dashes and three jumps;
  // entropyView: the Entropy menu as the dial or as the list (0.1.7, View / L in the menu); evoSort: the Legacy page's order (0.1.7)
  var OPT_DEF = { tilt: false, heroView: "grid", heroSort: "game", favEvos: [], triple: false, entropyView: "dial", evoSort: "power", heads: "diamond", fx: "full" };
  B.SETF = B.DATA + "/ReduxMenus" + SUF + ".json";
  B.opts = function () {
    var o = B._opts;
    if (!o) {
      o = {};
      try { if (F.Exists(B.SETF)) o = JSON.parse(String(F.ReadAllText(B.SETF))) || {}; } catch (e) { o = {}; B.log("FOURBASE", "settings unreadable, defaults used: " + B.es(e)); }
      B._opts = o;
    }
    for (var k in OPT_DEF) if (o[k] === undefined) o[k] = JSON.parse(JSON.stringify(OPT_DEF[k]));   // a hot load keeps what an older version read
    if (!Array.isArray(o.favEvos)) o.favEvos = [];
    return o;
  };
  B.opt = function (k) { return B.opts()[k]; };
  B.setOpt = function (k, v) {
    B.opts()[k] = v;
    try { F.WriteAllText(B.SETF, JSON.stringify(B.opts())); } catch (e) { B.log("FOURBASE", "settings not saved: " + B.es(e)); }
  };
  // Text from another player's game (Steam names, hero names, lobby names, versions) is shown in TextMeshPro, which reads
  // "<...>" as markup: a name could recolour, resize or hide the screen around it (security review, 2026-10-18). A
  // zero-width space after each "<" shows it as typed; control characters become spaces; the length is capped.
  // Running it twice changes nothing.
  B.safe = function (s, n) {
    s = String(s == null ? "" : s).slice(0, n || 32).replace(/[\u0000-\u001f\u007f]/g, " ");
    return s.replace(/<(?!\u200B)/g, "<\u200B");
  };
  // a part of the mode, read again from the workspace when its file changed (development PC only)
  B.t = B.t || {};
  B.load = function (n) {
    if (!B.DEV) return;
    var p = null; for (var i = 0; i < B.SRCS.length && !p; i++) if (F.Exists(B.SRCS[i] + n)) p = B.SRCS[i] + n;
    if (!p) return;
    var t = String(F.GetLastWriteTimeUtc(p).Ticks);
    if (B.t[n] != t) { (0, eval)(F.ReadAllText(p)); B.t[n] = t; }
  };
  if (!B.started) { B.started = 1; B.log("FOURBASE", "redux-menus " + B.MENUS + " in window " + B.WIN + (B.DEV ? " (work folder)" : " (player PC)") + ", log " + B.LOGF); }
  return "FOURBASE ready";
})();
