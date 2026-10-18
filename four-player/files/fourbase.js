// Four-player online: what every part of the mode shares. Loaded first.
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
  for (var r = 0; r < roots.length; r++) { var c = roots[r]; if (c && c.charAt(0) != "@") { try { if (D.Exists(c + "/mods/four-player/files")) { B.ROOT = c; break; } } catch (e) {} } }
  B.DEV = !!B.ROOT;
  // a test window on the development PC may read the parts from a work folder instead (globalThis.BB4SRC)
  B.SRC = B.DEV ? (G.BB4SRC && B.WIN > 1 ? G.BB4SRC : B.ROOT + "/mods/four-player/files/") : null;
  try { B.DATA = String(cs.UnityEngine.Application.persistentDataPath); } catch (e) { B.DATA = "."; }
  B.LOGF = B.DEV ? B.ROOT + "/modlog" + SUF + ".txt" : B.DATA + "/FourPlayer" + SUF + ".log";
  B.LOBBYDIR = B.DEV ? B.ROOT + "/local_only/fourplayer/lobbies" : B.DATA + "/FourPlayerLobbies";
  // the version two games must share to meet in a lobby: the mod's own version (make_test_zips.py checks they match)
  B.VER = "0.3.11";
  // how many players a lobby and a fight take (Soulve, 2026-10-17: "increases the max limit of players to 8 and account
  // for up to 16 players in the future"). Every part reads B.MAX; the screens lay themselves out for any count up to
  // B.CAP, so going to 16 is this one number (and a test with 16).
  B.CAP = 16;
  B.MAX = 8;
  B.log = function (tag, m) { try { F.AppendAllText(B.LOGF, (new Date()).toISOString() + " " + tag + " " + m + "\n"); } catch (e) {} };
  B.es = function (e) { return String(e && e.stack || e).replace(/[\r\n]+/g, " ").slice(0, 300); };
  // a part of the mode, read again from the workspace when its file changed (development PC only)
  B.t = B.t || {};
  B.load = function (n) {
    if (!B.DEV) return;
    var p = B.SRC + n; if (!F.Exists(p)) return;
    var t = String(F.GetLastWriteTimeUtc(p).Ticks);
    if (B.t[n] != t) { (0, eval)(F.ReadAllText(p)); B.t[n] = t; }
  };
  if (!B.started) { B.started = 1; B.log("FOURBASE", "four-player " + B.VER + " in window " + B.WIN + (B.DEV ? " (development PC)" : "") + ", log " + B.LOGF); }
  return "FOURBASE ready";
})();
