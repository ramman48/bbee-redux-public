// Four-player online: the rows of the ONLINE · <BB4.MAX> PLAYERS menu (the dev menu's window, Online page). Loads the lobby,
// the Steam relay and the fight start from the same folder, each read again when its file changes.
(function () {
  var cs = CS, G = globalThis, B = G.BB4;
  var M = G.BB4M = G.BB4M || {};
  // on the development PC each part is read again from the workspace when its file changed; elsewhere they are
  // already in the game (installed with the mod)
  function need() { ["fourbase.js", "fourlobby.js", "fourtunnel.js", "fourfight.js", "fourhud.js", "fourentry.js", "fouronline.js", "fourvote.js", "fourlobbyui.js"].forEach(function (n) { try { B.load(n); } catch (e) { M.err = n + ": " + e; } }); }
  // a hero this game does not have (another player's mod character) shows the name that player's game sent, marked
  // (testers, 2026-10-17: "the character name shows up as a String of Numbers")
  function heroName(id, sent) {
    var s = G.BB4L ? G.BB4L.heroName(id) : ""; if (s) return s;
    if (!id) return "no hero yet";
    return (sent || "a mod hero") + " (not installed here)";
  }
  // every hero in the game's hero table, mod characters included. No other checks (Soulve, 2026-10-17: "dont do hero
  // checks for now"), except paid content: a DLC hero this player does not own stays out (CLAUDE.md, never unlock
  // paid content; the same gate as the dev menu's hero list).
  function heroes() {
    if (M.heroes && M.heroes.length) return M.heroes;
    var out = [], seen = {};
    try {
      var X = require("Gen/Xlsx").Xlsx, AU = require("Core/ActorUtil").default;
      X.HeroConfig.All.forEach(function (h) {
        var id = h.id; if (seen[id] || !X.BaseActorConf.Get(id)) return; seen[id] = 1;
        var locked = false; try { locked = AU.IsDlcLock(id); } catch (e) {}
        if (!locked) out.push(id);
      });
    } catch (e) {}
    out.sort(function (a, b) { return a - b; }); return (M.heroes = out.length ? out : [100101]);
  }
  function nextHero(h) { var l = heroes(), i = l.indexOf(h); return l[(i + 1) % l.length]; }
  M.items = function () {
    need();
    var L = G.BB4L, FF = G.BB4F, out = [];
    if (!L) return [{ t: "The lobby did not load" + (M.err ? ": " + M.err : ""), act: function () {} }];
    if (L.state != "in") {
      if (L.note && L.state != "none") out.push({ t: "<color=#FFD24A>" + L.note + "</color>", act: function () {} });
      out.push({ t: "Status: " + L.status() + (L.local ? " (windows on this PC)" : ""), act: function () {} });
      out.push({ t: "Host a lobby: friends join through your Steam invite or your lobby code", act: function () { L.hostLobby(); } });
      if (!L.local) out.push({ t: "Join by player ID: type your friend's ID", leave: true, act: async function () {
        L.asking = true; var id = ""; try { id = await L.askId(); } finally { L.asking = false; }
        if (id) L.joinById(id);
        if (G.BB4ON) BB4ON.open();
      } });
      out.push({ t: "Find a lobby: joins the fullest open one, or hosts one if there is none", act: function () { L.find(); } });
      if (!L.local && L.aceId()) out.push({ t: "Your player ID: " + L.aceId() + "   (friends type this to join your lobby)", act: function () {} });
      out.push({ t: (L.local ? "Play over: windows on this PC (test)   >   switch to Steam" : "Play over: Steam   >   switch to windows on this PC (test)"), act: function () { L.leave(); L.local = !L.local; } });
      return out;
    }
    // In a lobby this page goes back to the lobby screen (Lilith, 2026-10-17: joined from the Dev Menu, backed out of
    // the lobby screen with B and could not get back in; outside the Mind Training room and character select X does
    // nothing, and this page only listed the old rows). The ONLINE menu (this page alone) goes there at once; the full
    // dev menu reopens on the page it was left on, so there the first row does it (an automatic jump would keep a
    // player in a lobby out of every other page). The rows below stay for test windows (B.devOnline).
    var UI = G.BB4UI, T = G.BBTR, w = T && T.dm && T.dm.win, back = UI && UI.open && !UI.isOpen && !B.devOnline && !(FF && FF.inFight);
    if (back && !(T && T.dm && T.dm.only)) out.push({ t: "<color=#FFD24A>Back to the lobby screen</color>", leave: true, act: function () { if (G.BB4L && BB4L.state == "in" && !UI.isOpen) { B.log("FOURONLINE", "dev menu: back to the lobby screen"); UI.open(); } } });
    else if (back && w && !(M.sentAt && Date.now() - M.sentAt < 2000)) {
      M.sentAt = Date.now();   // once per opening (the game reuses the window object, so the time is the guard)
      setTimeout(function () {
        try { require("Core/UIUtil").default.RecycleWindow(w); } catch (e) {}
        setTimeout(function () { if (G.BB4L && BB4L.state == "in" && !UI.isOpen) { B.log("FOURONLINE", "dev menu Online page: back to the lobby screen"); UI.open(); } }, 350);
      }, 0);
      return [{ t: "Back to the lobby screen...", act: function () {} }];
    }
    out.push({ t: "Lobby " + L.code + "   " + L.members.length + "/" + L.MAX + "   " + (L.host ? "you host" : "host: " + ((L.members.filter(function (m) { return m.host; })[0] || {}).name || "?")) + (L.local ? "   (this PC)" : ""), act: function () {} });
    // the host presses a player's name to leave them out of the fight (Soulve, 2026-10-17: "kicking them from the
    // lobby"). Steam lets no one remove a lobby member, but Start sends only the players kept, and a game not in the
    // fight list stays out of it.
    M.kick = M.kick || {};
    for (var i = 0; i < L.MAX; i++) {
      (function (m, i) {
        var out1 = m && M.kick[m.id];
        out.push({ t: (i + 1) + ".  " + (m ? m.name + "   " + heroName(m.hero, m.hname) + "   " + (out1 ? "REMOVED from the fight (press to undo)" : m.stale ? "NOT RESPONDING (their game left this lobby or closed; left out of the fight)" : (m.ready ? "READY" : "not ready")) + (m.host ? "   (host)" : (L.host && !out1 ? "   (press to remove)" : "")) : "open"),
          act: function () { if (!L.host || !m || m.host) return; if (M.kick[m.id]) delete M.kick[m.id]; else M.kick[m.id] = 1; } });
      })(L.members[i], i);
    }
    // a member whose game stopped answering is not sent into the fight
    var kept = L.members.filter(function (m) { return !M.kick[m.id] && !m.stale; });
    if (heroes().indexOf(L.me.hero) < 0) L.setHero(heroes()[0]);
    out.push({ t: "Your hero: " + heroName(L.me.hero || 100101) + "   (press for the next one)", act: function () { L.setHero(nextHero(L.me.hero || 100101)); } });
    if (!L.local && L.host && L.aceId()) out.push({ t: "Friends join by typing your player ID: " + L.aceId(), act: function () {} });
    if (!L.local) {
      // a Steam friend to invite, picked here (playing this game first, then online), sent as Steam's own invite
      if (!M.fr || Date.now() - (M.frT || 0) > 15000) { M.fr = L.friends(); M.frT = Date.now(); }
      if (M.fi == null || M.fi >= M.fr.length) M.fi = 0;
      var fr = M.fr[M.fi];
      out.push({ t: fr ? "Steam friend: " + fr.name + (fr.here ? "   (playing now)" : "") + "   (press for the next one)" : "Steam friend: none online", act: function () { if (M.fr.length) M.fi = (M.fi + 1) % M.fr.length; } });
      if (fr) out.push({ t: "Send " + fr.name + " an invite" + (M.sent == fr.id ? "   (sent)" : ""), act: function () { if (L.inviteFriend(fr)) M.sent = fr.id; } });
      if (L.overlayOn()) out.push({ t: "Invite Steam friends (Steam's invite window)", act: function () { L.inviteOverlay(); } });
    }
    out.push({ t: L.me.ready ? "Not ready" : "Ready", act: function () { L.setReady(!L.me.ready); } });
    if (L.host) {
      var all = kept.length >= 2 && kept.every(function (m) { return m.ready; });
      out.push({ t: "Start" + (all ? "" : " (everyone ready, two players or more)"), act: function () {
        if (!all || !FF) return;
        var allM = L.members; L.members = kept;                     // hostStart reads the list before its first wait
        try { FF.hostStart(); } finally { L.members = allM; }
      } });
    }
    // a fight takes its players when it starts: one that began before this game joined cannot take it in
    var running = null; try { running = L.started ? JSON.parse(L.started) : null; } catch (e) {}
    var mine = running && FF && (running.ids || []).map(String).indexOf(String(FF.myId())) >= 0;
    if (running && !mine && !(FF && FF.inFight)) out.push({ t: "A fight is on in this lobby: you can play in the next one, when it is over", act: function () {} });
    else if (FF && FF.status && FF.status() != "idle") out.push({ t: "Fight: " + FF.status(), act: function () {} });
    out.push({ t: "Leave the lobby", act: function () { L.leave(); } });
    return out;
  };
  return "FOURMENU ready";
})();
