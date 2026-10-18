// Four-player online: the lobby (who is in, who is ready, the start signal), on Steam.
// Soulve, 2026-10-16: "it says 4 players and then we can invnite people just like we do regularlly".
// - Host: a Steam lobby for B.MAX players (8 since 2026-10-17), tagged mode=bb4 with a 5-letter code. Invite: Steam's own invite window (the overlay),
//   so a friend accepts the way Steam invites always work; the game then joins (GameLobbyJoinRequested_t).
// - Join by code, or Find (the fullest open bb4 lobby; hosts one if none).
// - Each member writes its hero and ready flag on the lobby; the host writes the start signal (the fight address,
//   field and token, and each player's fighter id) and the guests connect.
// Windows on the same PC share one Steam account and cannot meet on Steam: BB4L.local = true uses a lobby file in
// local_only/fourplayer/lobbies instead, with the same calls. Log tag FOURLOBBY.
(function () {
  var cs = CS, G = globalThis, SW = cs.Steamworks, MM = cs.Steamworks.SteamMatchmaking, B = G.BB4;
  var WIN = B.WIN, DIR = B.LOBBYDIR;
  function log(m) { B.log("FOURLOBBY", m); }
  var es = B.es;
  var F = cs.System.IO.File;
  var OLD = G.BB4L; if (OLD && OLD.timer) clearInterval(OLD.timer);
  var L = G.BB4L = { MAX: B.MAX || 8, local: OLD ? OLD.local : false, lobby: null, code: "", host: false, state: "none", members: [], onStart: OLD ? OLD.onStart : null, win: WIN };
  // a new copy of this file (an update on the development PC) keeps the lobby this game is in: it used to start empty
  // and never leave the old lobby on Steam, so the others kept seeing this player there while they were elsewhere
  if (OLD) ["lobby", "code", "host", "state", "members", "started", "note", "want", "seen", "beatN"].forEach(function (k) { if (OLD[k] !== undefined) L[k] = OLD[k]; });
  L.seen = L.seen || {}; L.beatN = L.beatN || 0;
  var ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function newCode() { var s = ""; for (var i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function myId() { return L.local ? "win" + WIN : String(SW.SteamUser.GetSteamID().m_SteamID); }
  function myName() { try { return L.local ? "Window " + WIN : String(SW.SteamFriends.GetPersonaName()); } catch (e) { return "Player"; } }
  // evo: the one Evotype this player brings (its saved record: id, uid, score, inheritBlesses, inheritSkillIndex,
  // inheritSkillLevel), picked on the game's own Evotype screen; null for none. skin: the hero's skin id.
  L.me = { hero: 0, ready: false, evo: null, skin: 0 };

  // ---------- Steam ----------
  function cr(type, fn) { return puerts.$generic(SW.CallResult$1, type).Create(fn); }
  function cb(type, fn) { return puerts.$generic(SW.Callback$1, type).Create(fn); }
  // Steam's callbacks, made once Steam is running (the first time character select shows, or at the first lobby call).
  // A friend who accepts an invite while the game is closed starts it with "+connect_lobby <id>": joined then too.
  L.steamInit = function () {
    if (L.steamOk || L.local) return !!L.steamOk;
    // IsSteamRunning() says false in this game even with Steam up; the user's Steam id is the real test
    try { if (!String(SW.SteamUser.GetSteamID().m_SteamID).replace(/^0$/, "")) return false; } catch (e) { return false; }
    try {
      // a Steam invite reaches every window of the account: only the player's own window (1) answers it
      L.cbJoinReq = cb(SW.GameLobbyJoinRequested_t, function (p) { if (B.WIN > 1) { log("Steam invite for this account: left to window 1"); return; } log("Steam invite accepted: joining " + p.m_steamIDLobby.m_SteamID); G.BB4ON && BB4ON.open && BB4ON.open(); L.joinSteam(p.m_steamIDLobby); });
      L.cbUpd = cb(SW.LobbyDataUpdate_t, function (p) { if (L.lobby && String(p.m_ulSteamIDLobby) == String(L.lobby.m_SteamID)) L.readSteam(); });
      L.cbChat = cb(SW.LobbyChatUpdate_t, function (p) { if (L.lobby && String(p.m_ulSteamIDLobby) == String(L.lobby.m_SteamID)) L.readSteam(); });
      // every lobby this game enters, whoever asked: the one place a lobby is taken or turned down
      L.cbEnter = cb(SW.LobbyEnter_t, function (p) { L.entered(p); });
      L.steamOk = true; log("Steam lobby calls ready");
    } catch (e) { log("Steam callbacks: " + es(e)); return false; }
    try {
      var av = cs.System.Environment.GetCommandLineArgs();
      for (var i = 0; i < av.Length - 1; i++) if (String(av.get_Item(i)).toLowerCase() == "+connect_lobby" && !L.cmdJoined && B.WIN == 1) {
        L.cmdJoined = 1; var id = String(av.get_Item(i + 1)); log("started from a Steam invite: joining " + id);
        G.BB4ON && BB4ON.open && BB4ON.open(); L.joinSteam(new SW.CSteamID(cs.System.UInt64.Parse(id)));
      }
    } catch (e) { log("invite on the command line: " + es(e)); }
    return true;
  };
  if (OLD) { ["cbJoinReq", "cbUpd", "cbChat", "cbEnter"].forEach(function (k) { try { if (OLD[k]) OLD[k].Dispose(); } catch (e) {} }); L.cmdJoined = OLD.cmdJoined; L.me = OLD.me || L.me; }
  // A member is "not responding" when its game has stopped writing its heartbeat for 15 s: a game that closed
  // without Steam noticing yet, or a player whose game is really in another lobby. They are shown so and left out of
  // the fight (testers, 2026-10-17: "itll show a player is in the lobby when they arent and 2 player will see them
  // but then the other player is in a whole different lobby").
  L.STALE = 15000;
  L.kickList = OLD && OLD.kickList || {}; L.run = OLD ? OLD.run : null;
  function colOf(s) { s = String(s || "").split(",").map(parseFloat); return s.length == 3 && s.every(function (v) { return v >= 0 && v <= 1; }) ? s : null; }
  function myCol() { try { var c = G.BB4UI && G.BB4UI.colourOf ? G.BB4UI.colourOf(L.me.hero, L.me.skin) : null; return c ? c.slice(0, 3).map(function (v) { return Math.round(v * 100) / 100; }) : null; } catch (e) { return null; } }
  // The modes this game can run: every stock mode (Normal, Master, Expert), and Grim 104 / Endless 105 only when the
  // Entropy Overhaul mod that adds it is installed. The host's unlocks decide the mode for the whole lobby (Soulve,
  // 2026-10-18, T8: "the host's unlocks decide the difficulty for the whole lobby"; it replaced the 2026-10-17 check of
  // every player's unlocks), so only a mode a player's game does not have at all blocks the start. null: not known.
  L.myModes = function () {
    try {
      var HU = require("GamePlay/Heat/HeatUtil").default, out = (HU.ModeListSorted || []).map(function (m) { return m | 0; });
      if (!out.length) return null;
      if (typeof HU.GrimUnlocked == "function") out.push(104);
      if (typeof HU.EndlessUnlocked == "function") out.push(105);
      return out;
    } catch (e) { return null; }
  };
  function modesOf(s) { try { var a = JSON.parse(String(s || "")); return Array.isArray(a) ? a : null; } catch (e) { return null; } }
  function evoOf(s) { try { s = String(s || ""); var o = s ? JSON.parse(s) : null; return o && o.id ? o : null; } catch (e) { return null; } }
  L.readSteam = function () {
    if (!L.lobby) return;
    var n = MM.GetNumLobbyMembers(L.lobby), out = [], owner = String(MM.GetLobbyOwner(L.lobby).m_SteamID), me = myId(), now = Date.now(), here = false;
    for (var i = 0; i < n; i++) {
      var m = MM.GetLobbyMemberByIndex(L.lobby, i), id = String(m.m_SteamID), beat = String(MM.GetLobbyMemberData(L.lobby, m, "beat") || "");
      var s = L.seen[id]; if (!s || s.b != beat) s = L.seen[id] = { b: beat, t: now };
      if (id == me) here = true;
      out.push({ id: id, name: String(SW.SteamFriends.GetFriendPersonaName(m)), hero: parseInt(MM.GetLobbyMemberData(L.lobby, m, "hero")) || 0,
        hname: String(MM.GetLobbyMemberData(L.lobby, m, "hname") || ""), hcol: colOf(MM.GetLobbyMemberData(L.lobby, m, "hcol")), skin: parseInt(MM.GetLobbyMemberData(L.lobby, m, "skin")) || 0,
        evo: evoOf(MM.GetLobbyMemberData(L.lobby, m, "evo")), evo2: evoOf(MM.GetLobbyMemberData(L.lobby, m, "evo2")), mods: modsOf(String(MM.GetLobbyMemberData(L.lobby, m, "mods") || "")), kicked: !!L.kickList[id],
        modes: modesOf(MM.GetLobbyMemberData(L.lobby, m, "modes")), ver: String(MM.GetLobbyMemberData(L.lobby, m, "ver") || ""),
        ready: MM.GetLobbyMemberData(L.lobby, m, "ready") == "1", host: id == owner, stale: id != me && now - s.t > L.STALE });
    }
    try { L.run = JSON.parse(String(MM.GetLobbyData(L.lobby, "run") || "null")); } catch (e) { L.run = null; }
    L.kickList = {}; try { JSON.parse(String(MM.GetLobbyData(L.lobby, "kick") || "[]")).forEach(function (k) { L.kickList[k] = 1; }); } catch (e) {}
    // the host took this player out of the lobby: this game leaves and says so (Steam lets no one remove a member)
    if (L.kickList[me] && owner != me) { log("the host removed this game from lobby " + L.code); var kc = L.code; L.leave(); L.note = "the host removed you from the lobby " + kc; return; }
    // Steam no longer lists this game in its lobby (the lobby closed, or this game was dropped): say so
    if (!here && ++L.miss < 3) return;                                        // one empty read is not proof
    L.miss = 0;
    if (!here) { log("Steam no longer lists this game in lobby " + L.lobby.m_SteamID + ": left it"); var gone = L.code; L.leave(); L.note = "the lobby " + gone + " closed or dropped you: host or join again"; return; }
    if (owner == me && !L.host) { L._who = ""; L._loc = ""; }
    L.members = out; L.host = owner == me; L.verCheck(); L.runSync();
    var st = String(MM.GetLobbyData(L.lobby, "start") || "");
    if (st && st != L.started) { L.started = st; try { L.startSignal(JSON.parse(st)); } catch (e) { log("start signal unreadable: " + es(e)); } }
    else if (!st) L.started = "";                                // the host cleared it: that fight is over
  };
  // Steam answers a host or a join some time later, and an answer can arrive after the player has already pressed
  // something else (Host twice, Find then Join, an invite accepted while joining). Such a late lobby used to be kept
  // on Steam without this game knowing: the player sat in two lobbies, a ghost in the first. Now every lobby this
  // game enters comes through here: the one it is waiting for is taken, any other is left at once.
  L.entered = function (p) {
    var id = String(p.m_ulSteamIDLobby), ok = p.m_EChatRoomEnterResponse == 1, sl = new SW.CSteamID(p.m_ulSteamIDLobby);
    if (L.lobby && String(L.lobby.m_SteamID) == id) return;                  // already taken (both answers come)
    var owner = ""; try { owner = String(MM.GetLobbyOwner(sl).m_SteamID); } catch (e) {}
    var wanted = L.want ? L.want == id : (L.state == "creating" && owner == myId());
    // Only a late answer to this game's own recent ask is left. Several windows on one PC share one Steam account, and
    // Steam tells every one of them when any enters a lobby: a leave from a window that did not ask would take the
    // whole account out (2026-10-17: the lead's live lobby reached test windows 2 and 3).
    if (!wanted) {
      var mine = L.askedAt && Date.now() - L.askedAt < 60000;
      if (ok && mine) { try { MM.LeaveLobby(sl); } catch (e) {} log("left lobby " + id + ": a late answer this game no longer wanted"); }
      else log("lobby " + id + " entered by another window of this Steam account: not touched");
      return;
    }
    L.want = "";
    if (!ok) { L.state = "none"; L.note = "could not join that lobby (Steam answered " + p.m_EChatRoomEnterResponse + ": full, closed or gone)"; log(L.note); return; }
    L.lobby = sl;
    if (L.state == "creating") {
      MM.SetLobbyData(sl, "mode", "bb4"); MM.SetLobbyData(sl, "code", L.code); MM.SetLobbyData(sl, "ver", L.VER);
      MM.SetLobbyData(sl, "name", myName() + "'s lobby"); MM.SetLobbyData(sl, "start", ""); L._who = ""; L._loc = "";
      if (L.aceId()) MM.SetLobbyData(sl, "ace", L.aceId());          // friends join by typing the host's player ID
      L.started = ""; L.state = "in"; L._modsSent = false; L.pushMe(); L.readSteam(); log("hosting Steam lobby " + id + ", code " + L.code);
      return;
    }
    L.code = String(MM.GetLobbyData(sl, "code"));
    var v = String(MM.GetLobbyData(sl, "ver") || "");
    if (v != L.VER) { L.note = "that lobby runs four-player " + (v || "?") + ", you have " + L.VER + ": both need the same version"; log(L.note); try { MM.LeaveLobby(sl); } catch (e) {} L.lobby = null; L.state = "none"; return; }
    // a start left on the lobby from an earlier fight is not a call to this one
    L.started = String(MM.GetLobbyData(sl, "start") || "");
    L.note = ""; L.state = "in"; L._modsSent = false; L.pushMe(); L.readSteam(); log("joined Steam lobby " + id + ", code " + L.code + ", " + L.members.length + " in");
  };
  L.hostSteam = function () {
    L.steamInit();
    if (L.state == "creating") return;                                       // already asked; Steam is answering
    L.leave(); L.state = "creating"; L.code = newCode(); L.want = ""; L.askedAt = Date.now();
    L.crCreate = cr(SW.LobbyCreated_t, function (p, io) {
      if (io || p.m_eResult != SW.EResult.k_EResultOK) { if (L.state == "creating") { L.state = "none"; L.note = "Steam did not make the lobby (result " + p.m_eResult + "): try again"; } log("lobby not created: result " + p.m_eResult + (io ? ", io failure" : "")); return; }
      L.entered({ m_ulSteamIDLobby: p.m_ulSteamIDLobby, m_EChatRoomEnterResponse: 1 });
    });
    L.crCreate.Set(MM.CreateLobby(SW.ELobbyType.k_ELobbyTypePublic, L.MAX), null);
  };
  L.joinSteam = function (lobbyId) {
    L.steamInit();
    L.leave(); L.state = "joining"; L.want = String(lobbyId.m_SteamID); L.askedAt = Date.now();
    L.crEnter = cr(SW.LobbyEnter_t, function (p, io) {
      if (io) { if (L.want == String(lobbyId.m_SteamID)) { L.want = ""; L.state = "none"; L.note = "could not reach Steam to join: try again"; } log("join: io failure"); return; }
      L.entered(p);
    });
    L.crEnter.Set(MM.JoinLobby(lobbyId), null);
  };
  function listSteam(code, then, ace) {
    L.steamInit();
    MM.AddRequestLobbyListStringFilter("mode", "bb4", SW.ELobbyComparison.k_ELobbyComparisonEqual);
    if (!ace) MM.AddRequestLobbyListStringFilter("ver", L.VER, SW.ELobbyComparison.k_ELobbyComparisonEqual);
    if (code) MM.AddRequestLobbyListStringFilter("code", code, SW.ELobbyComparison.k_ELobbyComparisonEqual);
    if (ace) MM.AddRequestLobbyListStringFilter("ace", ace, SW.ELobbyComparison.k_ELobbyComparisonEqual);
    MM.AddRequestLobbyListFilterSlotsAvailable(1);
    MM.AddRequestLobbyListDistanceFilter(SW.ELobbyDistanceFilter.k_ELobbyDistanceFilterWorldwide);
    L.crList = cr(SW.LobbyMatchList_t, function (p) {
      var out = []; for (var i = 0; i < p.m_nLobbiesMatching; i++) { var id = MM.GetLobbyByIndex(i); out.push({ id: id, n: MM.GetNumLobbyMembers(id), code: String(MM.GetLobbyData(id, "code")), name: String(MM.GetLobbyData(id, "name")) }); }
      then(out);
    });
    L.crList.Set(MM.RequestLobbyList(), null);
  }
  // the player ID the game shows on the profile (the ACE account id): a lobby is tagged with its host's, so a friend
  // joins by typing it (Soulve, 2026-10-17: "cant we just do it to where we can invite them by their acer id")
  // during a fight the world login carries the fight id (fourfight setId), so the real one is read from what it saved
  L.aceId = function () { try { var F = G.BB4F; if (F && F.realId) return String(F.realId); return String(require("Core/Util").U.GetAceAccountId() || ""); } catch (e) { return ""; } };
  L.joinById = function (id) {
    id = String(id || "").replace(/\D/g, ""); if (!id) return;
    if (L.local) { L.note = "joining by player ID works over Steam only"; return; }
    L.leave(); L.started = ""; L.note = ""; L.state = "searching";
    log("looking for the lobby of player " + id);
    listSteam(null, function (r) {
      if (!r.length) { L.state = "none"; L.note = "player " + id + " is not hosting an open lobby"; log(L.note); return; }
      L.joinSteam(r[0].id);                                        // a version mismatch is reported by joinSteam
    }, id);
  };
  // the game's own text box (the crystal set rename window): -> what was typed, or "" when cancelled
  L.askId = async function () {
    var UIU = require("Core/UIUtil").default, W = require("Window/Dialog/UniversalTextInput").default;
    var w = await UIU.AcquireWindowAsync(W);
    w.Init("Your friend's player ID", "", "The number on their profile. They have to be hosting a four-player lobby.");
    w.SetInputLimit(20);
    return String(await w.CloseAsync() || "").trim();
  };
  // Steam friends, the ones playing this game first, then the ones online: invited straight from the menu, so no
  // Steam overlay is needed (it can be off for the game). The friend gets Steam's usual invite; accepting it joins.
  L.friends = function () {
    var out = [];
    try {
      var SF = SW.SteamFriends, FL = SW.EFriendFlags.k_EFriendFlagImmediate, n = SF.GetFriendCount(FL), app = SW.SteamUtils.GetAppID().m_AppId;
      for (var i = 0; i < n; i++) {
        var f = SF.GetFriendByIndex(i, FL), st = Number(SF.GetFriendPersonaState(f)); if (!st) continue;
        var gi = new SW.FriendGameInfo_t(), here = false;
        try { here = SF.GetFriendGamePlayed(f, gi) && gi.m_gameID.AppID().m_AppId == app; } catch (e) {}
        out.push({ id: String(f.m_SteamID), sid: f, name: String(SF.GetFriendPersonaName(f)), here: here });
      }
    } catch (e) { log("friends: " + es(e)); }
    out.sort(function (a, b) { return (b.here - a.here) || a.name.localeCompare(b.name); });
    return out;
  };
  L.inviteFriend = function (f) {                                  // f: one of L.friends()
    if (L.local || !L.lobby || !f) return false;
    var ok = false; try { ok = MM.InviteUserToLobby(L.lobby, f.sid); } catch (e) { log("invite: " + es(e)); }
    log("invite to " + f.name + " (" + f.id + "): " + ok); return ok;
  };
  L.overlayOn = function () { try { return !!SW.SteamUtils.IsOverlayEnabled(); } catch (e) { return false; } };
  L.inviteOverlay = function () { if (L.local || !L.lobby) return false; SW.SteamFriends.ActivateGameOverlayInviteDialog(L.lobby); log("Steam invite window opened"); return true; };

  // ---------- every open lobby, with ping (Soulve, 2026-10-17: "a button that says see all active sessions and it shows
  // ping and all the visuals and information and all you need to know about them and you can try to join them") ----------
  // Steam lets a player outside a lobby read its lobby data but not its members' data, so the host's game writes a
  // summary every few seconds: "who" (per player: name, hero, hero name, colour, host, ready) and "loc", the host's
  // Steam ping location. A list reader estimates its ping to the host from that (Steam's relay network estimate).
  L.relayInit = function () { if (L.relayAsked) return; L.relayAsked = true; try { SW.SteamNetworkingUtils.InitRelayNetworkAccess(); } catch (e) { log("relay: " + es(e)); } };
  L.myLoc = function () {
    try {
      L.relayInit(); var NU = SW.SteamNetworkingUtils, loc = puerts.$ref(new SW.SteamNetworkPingLocation_t());
      if (NU.GetLocalPingLocation(loc) < 0) return "";                          // not measured yet: asked again later
      var s = puerts.$ref(""); NU.ConvertPingLocationToString(loc, s, 512); return String(puerts.$unref(s) || "");
    } catch (e) { return ""; }
  };
  L.pingTo = function (str) {
    if (!str) return null;
    try { var NU = SW.SteamNetworkingUtils, loc = puerts.$ref(new SW.SteamNetworkPingLocation_t()); if (!NU.ParsePingLocationString(str, loc)) return null; var ms = NU.EstimatePingTimeFromLocalHost(loc); return ms >= 0 ? Math.round(ms) : null; } catch (e) { return null; }
  };
  function whoOf(list) { return (list || []).filter(function (m) { return !m.stale && !m.kicked; }).slice(0, L.MAX).map(function (m) { return [String(m.name || "").slice(0, 24), m.hero | 0, m.hname || L.heroName(m.hero) || "", m.hcol || null, m.host ? 1 : 0, m.ready ? 1 : 0]; }); }
  function whoRead(a) { return (Array.isArray(a) ? a : []).map(function (w) { return { name: String(w[0] || ""), hero: w[1] | 0, hname: String(w[2] || ""), hcol: w[3] || null, host: !!w[4], ready: !!w[5] }; }); }
  function jparse(s) { try { return s ? JSON.parse(String(s)) : null; } catch (e) { return null; } }
  L.publish = function () {
    if (!L.host || L.state != "in" || L.local || !L.lobby) return;
    var w = JSON.stringify(whoOf(L.members));
    if (w != L._who) { L._who = w; MM.SetLobbyData(L.lobby, "who", w); }
    if (!L._loc) { var lc = L.myLoc(); if (lc) { L._loc = lc; MM.SetLobbyData(L.lobby, "loc", lc); log("ping location shared for the sessions list"); } }
  };
  // -> then([{ id, code, name, ver, n, max, started, run, who: [...], ping (ms or null), mine, local }]), this version
  // first, then by ping. No version or room filter: a full lobby or another version shows, and says why it can't be joined
  L.listAll = function (then) {
    if (L.local) {
      var out = [], now = Date.now();
      try {
        var files = cs.System.IO.Directory.GetFiles(DIR, "*.json");
        for (var i = 0; i < files.Length; i++) {
          var code = cs.System.IO.Path.GetFileNameWithoutExtension(files.get_Item(i)), o = lread(code); if (!o || !o.m) continue;
          var live = Object.keys(o.m).filter(function (k) { return now - o.m[k].t < 6000; }); if (!live.length) continue;
          var who = live.map(function (k) { var m = o.m[k]; return { name: m.name, hero: m.hero | 0, hname: m.hname || "", hcol: m.hcol || null, host: k == o.host, ready: !!m.ready }; });
          who.sort(function (a, b) { return b.host - a.host; });
          var hn = (who.filter(function (w) { return w.host; })[0] || who[0]).name;
          out.push({ id: code, code: code, name: hn + "'s lobby", ver: o.ver || "", n: live.length, max: L.MAX, started: !!o.start, run: o.run || null, who: who, ping: 0, mine: code == L.code, local: true });
        }
      } catch (e) { log("sessions list: " + es(e)); }
      out.sort(function (a, b) { return (a.ver == L.VER ? 0 : 1) - (b.ver == L.VER ? 0 : 1) || b.n - a.n; });
      setTimeout(function () { then(out); }, 0); return;
    }
    L.steamInit(); L.relayInit();
    MM.AddRequestLobbyListStringFilter("mode", "bb4", SW.ELobbyComparison.k_ELobbyComparisonEqual);
    MM.AddRequestLobbyListDistanceFilter(SW.ELobbyDistanceFilter.k_ELobbyDistanceFilterWorldwide);
    try { MM.AddRequestLobbyListResultCountFilter(50); } catch (e) {}
    L.crAll = cr(SW.LobbyMatchList_t, function (p, io) {
      var out = [];
      if (io) { log("sessions list: Steam did not answer"); then(out, "Steam did not answer"); return; }
      for (var i = 0; i < p.m_nLobbiesMatching; i++) {
        try {
          var id = MM.GetLobbyByIndex(i), d = function (k) { return String(MM.GetLobbyData(id, k) || ""); };
          out.push({ id: id, sid: String(id.m_SteamID), code: d("code"), name: d("name"), ver: d("ver"), n: MM.GetNumLobbyMembers(id), max: MM.GetLobbyMemberLimit(id) || L.MAX,
            started: !!d("start"), run: jparse(d("run")), who: whoRead(jparse(d("who"))), ping: L.pingTo(d("loc")), mine: !!(L.lobby && String(L.lobby.m_SteamID) == String(id.m_SteamID)) });
        } catch (e) { log("sessions list row " + i + ": " + es(e)); }
      }
      out.sort(function (a, b) { return (a.ver == L.VER ? 0 : 1) - (b.ver == L.VER ? 0 : 1) || (a.ping == null ? 9999 : a.ping) - (b.ping == null ? 9999 : b.ping); });
      then(out);
    });
    L.crAll.Set(MM.RequestLobbyList(), null);
  };
  // why a listed lobby can't be joined, or "" when it can
  L.whyNot = function (e) {
    if (!e) return "gone";
    if (e.mine) return "you're in it";
    if (e.ver && e.ver != L.VER) return "needs Four Player " + e.ver;
    if (e.n >= (e.max || L.MAX)) return "full";
    return "";
  };
  L.joinListed = function (e) { if (!e || L.whyNot(e)) return false; if (e.local) L.join(e.code); else L.joinSteam(e.id); return true; };
  // the last lobby this game was in, kept in a small file (rejoin last lobby: who was there, their heroes, joinable)
  var LASTF = (B.DEV ? B.ROOT + "/local_only/fourplayer" : B.DATA) + "/FourPlayerLast" + (WIN > 1 ? WIN : "") + ".json";
  L.remember = function () {
    if (L.state != "in") return;
    var host = (L.members || []).filter(function (m) { return m.host; })[0];
    var o = { sid: L.lobby ? String(L.lobby.m_SteamID) : "", code: L.code, local: !!L.local, host: host ? host.name : "", who: whoRead(whoOf(L.members)), at: Date.now() };
    var j = JSON.stringify(o); if (j == L._lastJ) return; L._lastJ = j;
    try { F.WriteAllText(LASTF, j); } catch (e) { if (!L._lastErr) { L._lastErr = 1; log("last lobby file: " + es(e)); } }
  };
  L.last = function () { try { return F.Exists(LASTF) ? JSON.parse(F.ReadAllText(LASTF)) : null; } catch (e) { return null; } };

  // ---------- this PC (windows sharing one account) ----------
  function lpath(code) { return DIR + "/" + code + ".json"; }
  function lread(code) { try { return JSON.parse(F.ReadAllText(lpath(code))); } catch (e) { return null; } }
  function lwrite(code, o) { try { cs.System.IO.Directory.CreateDirectory(DIR); F.WriteAllText(lpath(code), JSON.stringify(o)); } catch (e) { log("lobby file: " + es(e)); } }
  L.readLocal = function () {
    var o = lread(L.code); if (!o) { log("the lobby " + L.code + " is gone"); L.state = "none"; L.code = ""; return; }
    var now = Date.now(), out = [];
    L.kickList = {}; (o.kick || []).forEach(function (k) { L.kickList[k] = 1; }); L.run = o.run || null;
    if (L.kickList[myId()] && o.host != myId()) { var kc = L.code; L.leave(); L.note = "the host removed you from the lobby " + kc; return; }
    Object.keys(o.m).forEach(function (k) { var m = o.m[k]; if (now - m.t < 6000) out.push({ id: k, name: m.name, hero: m.hero, hname: m.hname || "", hcol: m.hcol || null, ready: m.ready, host: k == o.host, evo: m.evo || null, evo2: m.evo2 || null, skin: m.skin || 0, mods: modsOf(m.mods), modes: Array.isArray(m.modes) ? m.modes : null, ver: String(m.ver || ""), kicked: !!L.kickList[k] }); });
    out.sort(function (a, b) { return (b.host - a.host) || (a.id < b.id ? -1 : 1); });
    L.members = out; L.host = o.host == myId(); L.verCheck(); L.runSync();
    if (o.start && JSON.stringify(o.start) != L.started) { L.started = JSON.stringify(o.start); L.startSignal(o.start); }
    else if (!o.start) L.started = "";                           // the host cleared it: that fight is over
  };
  function lput(fn) { var o = lread(L.code); if (!o) return; fn(o); lwrite(L.code, o); }

  // ---------- the same calls for both ----------
  L.VER = B.VER;
  L.hostLobby = function () {
    L.leave(); L.started = ""; L.note = "";
    if (!L.local) return L.hostSteam();
    L.code = newCode(); lwrite(L.code, { host: myId(), m: {}, t: Date.now(), ver: L.VER }); L.state = "in"; L.pushMe(); L.readLocal();
    log("hosting lobby " + L.code + " on this PC");
  };
  L.join = function (code) {
    code = String(code || "").toUpperCase().trim(); if (!code) return;
    L.leave(); L.started = "";
    if (L.local) { var lo = lread(code); if (!lo) { log("no lobby " + code + " on this PC"); return; } var have = Object.keys(lo.m || {}).filter(function (k) { return Date.now() - lo.m[k].t < 6000; }).length; if (have >= L.MAX) { L.note = "lobby " + code + " is full (" + have + "/" + L.MAX + ")"; log(L.note); return; } L.code = code; L.started = lo.start ? JSON.stringify(lo.start) : ""; L.state = "in"; L.pushMe(); L.readLocal(); log("joined lobby " + code); return; }
    L.state = "searching"; listSteam(code, function (r) { if (!r.length) { L.state = "none"; L.note = "no open lobby with the code " + code; log(L.note); return; } L.joinSteam(r[0].id); });
  };
  L.find = function () {
    L.leave(); L.started = "";
    if (L.local) {
      var best = null;
      try { var fs = cs.System.IO.Directory.GetFiles(DIR, "*.json"); for (var i = 0; i < fs.Length; i++) { var c = cs.System.IO.Path.GetFileNameWithoutExtension(fs.get_Item(i)), o = lread(c); if (!o || o.start) continue; var n = Object.keys(o.m).filter(function (k) { return Date.now() - o.m[k].t < 6000; }).length; if (n > 0 && n < L.MAX && (!best || n > best.n)) best = { c: c, n: n }; } } catch (e) {}
      if (best) return L.join(best.c); return L.hostLobby();
    }
    L.state = "searching"; listSteam("", function (r) { r.sort(function (a, b) { return b.n - a.n; }); if (r.length) L.joinSteam(r[0].id); else { log("no open lobby: hosting one"); L.hostSteam(); } });
  };
  L.leave = function () {
    if (L.local && L.code) lput(function (o) { delete o.m[myId()]; if (o.host == myId()) { var k = Object.keys(o.m); o.host = k[0] || ""; } });
    if (!L.local && L.lobby) { try { MM.LeaveLobby(L.lobby); } catch (e) {} }
    if (L.state == "in") log("left the lobby " + L.code);
    L.lobby = null; L.code = ""; L.state = "none"; L.members = []; L.host = false; L.want = ""; L.seen = {}; L.miss = 0; L.kickList = {}; L.run = null;
  };
  L.pushMe = function () {
    if (L.state != "in") return;
    if (L.local) { lput(function (o) { o.m[myId()] = { name: myName(), hero: L.me.hero, hname: L.heroName(L.me.hero) || "", hcol: myCol(), ready: L.me.ready, evo: L.me.evo, evo2: L.me.evo2 || null, skin: L.me.skin, mods: L.myMods(), modes: L.myModes(), ver: L.VER, t: Date.now() }; }); return; }
    MM.SetLobbyMemberData(L.lobby, "hero", String(L.me.hero)); MM.SetLobbyMemberData(L.lobby, "ready", L.me.ready ? "1" : "0");
    MM.SetLobbyMemberData(L.lobby, "hname", L.heroName(L.me.hero) || "");      // for a player who has no such hero
    MM.SetLobbyMemberData(L.lobby, "skin", String(L.me.skin || 0));
    var hc = myCol(); MM.SetLobbyMemberData(L.lobby, "hcol", hc ? hc.join(",") : "");
    MM.SetLobbyMemberData(L.lobby, "evo", L.me.evo ? JSON.stringify(L.me.evo) : "");
    MM.SetLobbyMemberData(L.lobby, "evo2", L.me.evo2 ? JSON.stringify(L.me.evo2) : "");
    if (!L._modsSent) { MM.SetLobbyMemberData(L.lobby, "mods", JSON.stringify(L.myMods())); MM.SetLobbyMemberData(L.lobby, "ver", L.VER); L._modsSent = true; }
    var md = L.myModes(); MM.SetLobbyMemberData(L.lobby, "modes", md ? JSON.stringify(md) : "");
  };
  // the player's pick from the game's own hero and Evotype screens (BB4UI hands it here); a change of loadout is not ready
  L.setLoadout = function (hero, evo, skin, evo2) {
    if (hero && hero != L.me.hero && !L.heroCheck(hero).ok) { log("mods: " + hero + " is not on every PC at one version; kept " + L.me.hero); return false; }
    L.me.hero = hero || L.me.hero; L.me.evo2 = evo2 || null; L.me.evo = evo || null; L.me.skin = skin || 0; L.me.ready = false; L.pushMe(); };
  // ---- host only ----
  // the run settings everyone sees on the lobby screen (the fight itself takes them from the host's game)
  L.setRun = function (o) {
    if (!L.host || L.state != "in") return;
    L.run = o; if (L.local) lput(function (x) { x.run = o; }); else MM.SetLobbyData(L.lobby, "run", JSON.stringify(o));
  };
  // take a player out of the lobby: their game leaves by itself, Start leaves them out, and the relay refuses them
  L.kick = function (id) {
    if (!L.host || L.state != "in" || String(id) == myId()) return false;
    L.kickList[String(id)] = 1; var ks = Object.keys(L.kickList);
    if (L.local) lput(function (x) { x.kick = ks; delete x.m[String(id)]; }); else MM.SetLobbyData(L.lobby, "kick", JSON.stringify(ks));
    log("removed " + id + " from the lobby"); return true;
  };
  // A player on another version of Four Player is removed by the host's game (GeokitFX, 2026-10-17: an old version
  // joined and broke things). Since 0.3.10 every game says its version in the lobby; a game that says another one, or
  // none (older than 0.3.10, which cannot refuse an invite itself), is removed once it has been in the lobby 6 s
  // (its data arrives in pieces). The host is told who needs which version. Newer games refuse such a lobby on entry.
  // The difficulty and Entropy everyone sees on the lobby screen came only from closing the Entropy menu, so a lobby
  // whose host never opened it showed none, and a change made elsewhere did not show (Soulve, 2026-10-17: "changing
  // Entropy isn't working right"). The fight always took the host's setting (checked 2026-10-18: host level 1, the
  // guest's own 3, the guest's fight at 1). The host's game now keeps the lobby's mode and level current.
  L.runSync = function () {
    if (!L.host || L.state != "in" || !G.BB4F || !BB4F.runSummary || BB4F.inFight) return;
    var s = BB4F.runSummary(); if (!s || !s.mode) return;
    if (L.run && L.run.mode == s.mode && L.run.level == s.level) return;
    var r = {}; Object.keys(L.run || {}).forEach(function (k) { r[k] = L.run[k]; }); r.mode = s.mode; r.level = s.level;
    L.setRun(r); log("run settings shown: " + s.mode + ", Entropy " + s.level);
  };
  L.firstAt = L.firstAt || {}; L.vkick = L.vkick || {};
  L.verCheck = function () {
    if (!L.host || L.state != "in") return;
    var now = Date.now(), me = myId();
    // a removal for the version is lifted after 15 s (the old game has left by then), so the player can come back
    // once updated; the host's own kicks stay
    Object.keys(L.vkick).forEach(function (id) {
      if (now - L.vkick[id] < 15000) return;
      delete L.vkick[id]; delete L.firstAt[id];
      if (!L.kickList[id]) return;
      delete L.kickList[id]; var ks = Object.keys(L.kickList);
      if (L.local) lput(function (x) { x.kick = ks; }); else MM.SetLobbyData(L.lobby, "kick", JSON.stringify(ks));
      log("version: " + id + " may join again (removed for the version 15 s ago)");
    });
    (L.members || []).forEach(function (m) {
      if (m.id == me || m.kicked || m.stale) return;
      var t = L.firstAt[m.id] = L.firstAt[m.id] || now;
      if (m.ver == L.VER || now - t < 6000) return;
      if (!L.kick(m.id)) return;
      L.vkick[m.id] = now;
      var msg = (m.name || "A player") + " has " + (m.ver ? "Four Player " + m.ver : "an older Four Player") + ": everyone needs " + L.VER + " to play together";
      log("version: " + msg); L.note = msg;
      try { if (G.BB4UI && BB4UI.say) BB4UI.say(msg); } catch (e) {}
    });
  };
  // hand the lobby to another player (lobby only: during a run the fight lives on the host's PC)
  L.makeHost = function (id) {
    if (!L.host || L.state != "in" || String(id) == myId()) return false;
    if (L.local) { lput(function (x) { x.host = String(id); }); log("gave the lobby to " + id); return true; }
    var ok = MM.SetLobbyOwner(L.lobby, new SW.CSteamID(cs.System.UInt64.Parse(String(id))));
    log((ok ? "gave the lobby to " : "Steam refused to give the lobby to ") + id); return !!ok;
  };
  // the hero's name in this game's language, or "" when this game has no such hero (a mod character not installed)
  L.heroName = function (id) { try { var k = "BaseActor_chs_" + id, s = require("Core/Util").U.GetLocale(k); if (s && s != k && String(s).indexOf("_") !== 0) return String(s); } catch (e) {} return ""; };
  // ---------- mod heroes: which version each player has, and whether a hero can be played together ----------
  // Every player's game shares, for each mod hero it has (ids from 190000: EX variants, then added characters), the mod
  // that adds it, the mod's version and a fingerprint of the hero's gameplay rows (hero, stats, Potentials, actions).
  // A hero can be picked only when every player in the lobby has it with the same version and the same fingerprint:
  // each PC runs its own copy of the fight, so different data would make the players' games disagree.
  var HERO_MOD = { 190101: "ex-ragna", 191101: "ex-hakumen", 200101: "test-bridget-rig", 200201: "char-order-sol", 200301: "char-izanami",
                   200401: "char-nine", 200701: "char-ruby", 200801: "dr-party", 200901: "char-arcueid", 201001: "char-swiftmaster" };   // until the registry carries "heroes" (bbmod 2026-10-17)
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); }
  function rowsOf(id) {
    var X = require("Gen/Xlsx").Xlsx, b = X.BaseActorConf.Get(id), pool = (b && b.potentialPoolId) || id, out = [b];
    try { out.push(X.BaseActorAttrConf.Get(id)); } catch (e) {}
    try { out.push(X.BaseActorPotentialConf.All.filter(function (r) { return r.actorId == pool; })); } catch (e) {}
    try { out.push(X.ActorActionConf.All.filter(function (r) { return r.actorId == id; })); } catch (e) {}
    return out;
  }
  function stable(v) { try { return JSON.stringify(v, function (k, x) { return typeof x == "bigint" ? String(x) : x; }); } catch (e) { return String(v); } }
  L.myMods = function () {
    if (L._mods) return L._mods;
    var reg = null, o = { b: "", h: {} }; try { reg = require("Example").ModRegistry; o.b = String(reg.gameBuild || ""); } catch (e) {}
    var tm = reg && reg.terminal; if (tm && tm.build) o.t = { r: String(tm.release || ""), l: String(tm.label || ""), b: String(tm.build) };
    var byHero = {}; ((reg && reg.mods) || []).forEach(function (m) { (m.heroes || []).forEach(function (h) { byHero[h] = m; }); });
    var X = require("Gen/Xlsx").Xlsx;
    X.BaseActorConf.All.forEach(function (r) {
      var id = r.actorId; if (id < 190000) return;
      var m = byHero[id] || null; if (!m && reg) { var mid = HERO_MOD[id]; m = (reg.mods || []).filter(function (x) { return x.id == mid; })[0] || null; }
      var fp = "?"; try { fp = fnv(stable(rowsOf(id))); } catch (e) { log("mods: no fingerprint for " + id + ": " + es(e)); }
      o.h[id] = [m ? m.id : (HERO_MOD[id] || "?"), m ? String(m.version) : "?", fp];
    });
    L._mods = o; log("mods: " + Object.keys(o.h).map(function (k) { return k + " " + o.h[k].join(" "); }).join(", "));
    return o;
  };
  function modsOf(s) { try { var o = s ? (typeof s == "string" ? JSON.parse(s) : s) : null; return o && o.h ? o : null; } catch (e) { return null; } }
  // the lobby's verdict on a hero: ok, or why not (who lacks it, who has which version); stock heroes are always ok here
  L.heroCheck = function (id, list) {
    var ms = (list || L.members || []).filter(function (m) { return !m.kicked && !m.stale; });
    var r = { id: id, ok: true, mod: false, ver: "", missing: [], differ: [], unknown: [], who: [] };
    if (!id || id < 190000) return r;
    r.mod = true;
    var mine = L.myMods().h[id]; if (mine) { r.modId = mine[0]; r.ver = mine[1]; }
    var ref = null;
    var refM = null;
    ms.forEach(function (m) { var md = m.id == L.myId() ? L.myMods() : m.mods, e = md && md.h ? md.h[id] : null; if (e && (m.host || !ref)) { ref = e; refM = m; } });
    r.refT = refM ? L.terminalOf(refM) : null;
    ms.forEach(function (m) {
      var md = m.id == L.myId() ? L.myMods() : m.mods, e = md && md.h ? md.h[id] : null, st;
      if (!md) { st = "unknown"; r.unknown.push(m); }
      else if (!e) { st = "missing"; r.missing.push(m); }
      else { if (!r.modId) { r.modId = e[0]; r.ver = e[1]; } st = e[1] == ref[1] && e[2] == ref[2] ? "same" : "differ"; if (st == "differ") r.differ.push(m); }
      r.who.push({ m: m, st: st, ver: e ? e[1] : "", fp: e ? e[2] : "", t: md ? md.t || null : null });
    });
    // a player whose version differs from the first: tell everyone which version each one has
    if (r.differ.length) r.who.forEach(function (w) { if (w.st == "same" && ref) w.st = "ref"; });
    r.ok = !r.missing.length && !r.differ.length && !r.unknown.length;
    return r;
  };
  L.myId = function () { return myId(); };
  // a player's Terminal release ({r, l, b}), or null outside a Terminal install; players compare on b (the exact package)
  L.terminalOf = function (m) { var md = m.id == myId() ? L.myMods() : m.mods; return md && md.t ? md.t : null; };
  L.terminalName = function (t) { return t ? "Terminal " + t.r + (t.l ? " " + t.l : "") : ""; };
  // what a player lacking a hero, or holding another version, should do: update the Terminal when the reference player's
  // Terminal is a different package; otherwise get that mod's version
  L.fixFor = function (c, w) {
    var ref = c.refT, mine = w.t;
    if (ref && mine && mine.b != ref.b) return "update to " + L.terminalName(ref);
    if (ref && !mine) return "get " + L.terminalName(ref) + " or " + (c.modId || "the mod") + " v" + c.ver;
    return "get " + (c.modId || "the mod") + " v" + c.ver;
  };
  // after the Terminal loads changed mods into this game (zenith-live), read the mod list again and send it
  G.ZENITH_LIVE_HOOKS = G.ZENITH_LIVE_HOOKS || [];
  G.ZENITH_LIVE_HOOKS = G.ZENITH_LIVE_HOOKS.filter(function (f) { return !f.__bb4; });
  (function () { var hook = function (list, answer) { L._mods = null; L._modsSent = false; if (L.state == "in") L.pushMe(); log("mods: read again after a live load (" + (answer && answer.ok === false ? "it failed" : "ok") + ")"); }; hook.__bb4 = 1; G.ZENITH_LIVE_HOOKS.push(hook); })();
  L.setHero = function (h) { if (h != L.me.hero && !L.heroCheck(h).ok) { log("mods: " + h + " is not on every PC at one version; kept " + L.me.hero); return false; } L.me.hero = h; L.pushMe(); return true; };
  L.setReady = function (r) { L.me.ready = !!r; L.pushMe(); };
  // a short string of this game's for the fight's own desync check (fourfight.js): every player writes theirs and reads
  // everyone's. In a lobby file it has its own key, since a member's entry is written whole every 1.5 s.
  L.putSync = function (s) {
    if (L.state != "in") return;
    try { if (L.local) lput(function (o) { (o.sync = o.sync || {})[myId()] = s; }); else MM.SetLobbyMemberData(L.lobby, "sync", s); } catch (e) {}
  };
  L.readSync = function () {
    var r = {}; if (L.state != "in") return r;
    try {
      if (L.local) { var o = lread(L.code); if (o && o.sync) Object.keys(o.sync).forEach(function (k) { r[k] = String(o.sync[k] || ""); }); return r; }
      var n = MM.GetNumLobbyMembers(L.lobby);
      for (var i = 0; i < n; i++) { var m = MM.GetLobbyMemberByIndex(L.lobby, i); r[String(m.m_SteamID)] = String(MM.GetLobbyMemberData(L.lobby, m, "sync") || ""); }
    } catch (e) {}
    return r;
  };
  // host only: everyone reads this and connects. Each start is marked with its time, so two starts never look alike.
  L.sendStart = function (o) {
    if (!L.host) return false;
    o.at = Date.now();
    if (L.local) lput(function (x) { x.start = o; }); else MM.SetLobbyData(L.lobby, "start", JSON.stringify(o));
    log("start sent: " + JSON.stringify(o).slice(0, 200)); return true;
  };
  // host, once a fight is over: the lobby no longer carries its start (a player joining later must not follow it)
  L.clearStart = function () {
    if (!L.host || L.state != "in") return;
    if (L.local) lput(function (x) { delete x.start; }); else MM.SetLobbyData(L.lobby, "start", "");
    L.started = ""; log("start cleared");
  };
  L.startSignal = function (o) { log("start signal: " + JSON.stringify(o).slice(0, 200)); if (L.onStart) { try { L.onStart(o); } catch (e) { log("start: " + es(e)); } } };
  L.status = function () { if (L.state == "none" && L.note) return L.note; return L.state == "in" ? (L.local ? "this PC" : "Steam") + " lobby " + L.code + ", " + L.members.length + "/" + L.MAX + (L.host ? ", you host" : "") : ({ none: "not in a lobby", creating: "making a lobby", joining: "joining", searching: "looking for a lobby" })[L.state] || L.state; };
  // Steam: the member list is read again every second (it used to wait for Steam's update calls, and a missed one
  // left a player listed who had gone) and this game's heartbeat is written every 4 s
  var beat = 0;
  L.timer = setInterval(function () {
    try {
      if (L.state != "in") return;
      if (L.local) { if (Date.now() - beat > 1500) { beat = Date.now(); L.pushMe(); L.remember(); } L.readLocal(); return; }
      if (Date.now() - beat > 4000) { beat = Date.now(); MM.SetLobbyMemberData(L.lobby, "beat", String(++L.beatN)); try { L.publish(); L.remember(); } catch (e) { log("summary: " + es(e)); } }
      L.readSteam();
    } catch (e) { if (!L.errT || Date.now() - L.errT > 10000) { L.errT = Date.now(); log("tick: " + es(e)); } }
  }, 1000);
  if (OLD && OLD.steamOk) L.steamInit();               // the Steam calls of the copy this one replaced were let go
  log("ready in window " + WIN + (L.local ? " (this PC)" : " (Steam)"));
  return "FOURLOBBY ready";
})();
