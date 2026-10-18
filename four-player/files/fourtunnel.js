// Four-player online: the fight traffic between PCs, carried by Steam (no open ports, no 91Act server).
// The host's game runs the game's own fight server (FightSvrManager, the stock "LAN host" one). A guest's game connects
// its fight connection to a listener on its own PC (127.0.0.1); every byte is passed to the host over Steam
// peer-to-peer (SteamNetworking, relayed by Steam), and the host passes it on to its fight server over a local TCP
// connection, one per guest. Bytes coming back take the same road. The game's own connection never knows.
// Channel 0 carries fight bytes, channel 1 carries the open and close of a guest's connection. Log tag FOURTUN.
(function () {
  var cs = CS, G = globalThis, SW = cs.Steamworks, N = cs.System.Net, NS = cs.System.Net.Sockets, B = G.BB4;
  var WIN = B.WIN;
  function log(m) { B.log("FOURTUN", m); }
  var es = B.es;
  var OLD = G.BB4T2; if (OLD && OLD.stop) { try { OLD.stop(); } catch (e) {} try { if (OLD.cbReq) OLD.cbReq.Dispose(); } catch (e) {} try { if (OLD.cbFail) OLD.cbFail.Dispose(); } catch (e) {} }
  var T = G.BB4T2 = { role: null, bytesUp: 0, bytesDown: 0, peers: {} };
  // only players in this game's lobby may open a Steam session with it
  T.allow = function (k) { var L = G.BB4L; if (T.role == "guest" && T.hostKey && String(k) != T.hostKey) return false; return !!(L && L.state == "in" && L.members.some(function (m) { return String(m.id) == String(k) && !m.kicked; })); };
  var BUF = cs.System.Array.CreateInstance(puerts.$typeof(cs.System.Byte), 65536);
  var CTL = cs.System.Array.CreateInstance(puerts.$typeof(cs.System.Byte), 1);
  var RELIABLE = SW.EP2PSend.k_EP2PSendReliable, NONE = NS.SocketFlags.None;
  function sid(n) { return new SW.CSteamID(typeof n == "string" ? cs.System.UInt64.Parse(n) : n); }
  function key(s) { return String(s.m_SteamID); }
  function ctl(to, b) { CTL.set_Item(0, b); SW.SteamNetworking.SendP2PPacket(to, CTL, 1, RELIABLE, 1); }
  // the local fight connections get room for 4 MB in each direction (Windows gives 64 KB)
  function tcp() { var s = new NS.Socket(NS.AddressFamily.InterNetwork, NS.SocketType.Stream, NS.ProtocolType.Tcp); s.NoDelay = true; try { s.SendBufferSize = 1 << 22; s.ReceiveBufferSize = 1 << 22; } catch (e) {} return s; }
  function close(s) { try { if (s) s.Close(); } catch (e) {} }
  // In this game a send on a full connection does not return: it spins until there is room (measured 2026-10-17: a
  // 64 KB send to a connection nobody read froze the window). The relay runs on the game's own frames, so one stalled
  // fight connection would freeze the whole game. Bytes now go out only while the connection has room; the rest waits
  // in its queue (in order) for the next tick.
  function copyOf(buf, off, len) { var a = cs.System.Array.CreateInstance(puerts.$typeof(cs.System.Byte), len); cs.System.Array.Copy(buf, off, a, 0, len); return a; }
  function room(s) { return s.Poll(0, NS.SelectMode.SelectWrite); }
  // c: { s: the socket, q: its queue, an array of byte arrays }
  function flush(c) {
    while (c.q && c.q.length && room(c.s)) { var h = c.q.shift(); c.s.Send(h, 0, h.Length, NONE); }
    if (c.q && c.q.length > 4000) throw new Error("a fight connection has not taken bytes for a long time (" + c.q.length + " waiting)");
  }
  function sendAll(c, buf, len) {
    flush(c);
    if ((!c.q || !c.q.length) && room(c.s)) { c.s.Send(buf, 0, len, NONE); return; }
    (c.q = c.q || []).push(copyOf(buf, 0, len));
    T.queued = (T.queued || 0) + 1; if (T.queued % 100 == 1) log("a fight connection had no room: " + len + " bytes held for the next tick (" + T.queued + " times so far)");
  }
  // Steam asks before a stranger's first packet: accept only lobby members (T.allow). Made when a fight starts
  // (Steam is running by then), not when the game starts.
  T.init = function () {
    if (!T.timer) T.timer = setInterval(T.tick, 1);          // stop() ends it after a fight; the next fight needs it again
    if (T.cbReq) return;
    try {
      T.cbReq = puerts.$generic(SW.Callback$1, SW.P2PSessionRequest_t).Create(function (p) {
        var k = key(p.m_steamIDRemote);
        if (T.allow(k)) { SW.SteamNetworking.AcceptP2PSessionWithUser(p.m_steamIDRemote); log("accepted Steam session from " + k); }
        else log("refused a Steam session from " + k + " (not in the lobby)");
      });
    } catch (e) { log("session request hook: " + es(e)); }
    try { SW.SteamNetworking.AllowP2PPacketRelay(true); } catch (e) {}
    // a Steam connection to another player that broke is written down (the fight then goes on as a disconnect)
    try {
      T.cbFail = puerts.$generic(SW.Callback$1, SW.P2PSessionConnectFail_t).Create(function (p) {
        var k = key(p.m_steamIDRemote);
        log("Steam connection to " + k + " failed (Steam error " + p.m_eP2PSessionError + ")");
        gone(k, "its Steam connection failed");
      });
    } catch (e) { log("session failure hook: " + es(e)); }
  };

  // guest: listen on this PC; the game's fight connection lands here and is carried to the host
  T.guest = function (hostSteamId) {
    T.init();
    T.role = "guest"; T.host = sid(hostSteamId); T.hostKey = String(hostSteamId);
    T.lis = tcp(); T.lis.Bind(new N.IPEndPoint(N.IPAddress.Loopback, 0)); T.lis.Listen(1);
    T.port = T.lis.LocalEndPoint.Port;
    log("guest: carrying the fight connection to host " + T.hostKey + " from 127.0.0.1:" + T.port);
    return "127.0.0.1:" + T.port;
  };
  // host: open a connection to its own fight server for each guest that opens one
  T.hostOn = function (fightAddr) {
    T.init();
    T.role = "host"; var p = String(fightAddr).split(":"); T.fightEp = new N.IPEndPoint(N.IPAddress.Parse(p[0]), parseInt(p[1]));
    log("host: carrying guests to the fight server at " + fightAddr);
  };
  // A crashed or closed game sends nothing, and before 0.3.3 its fight connection on the host stayed open: the fight
  // server kept waiting for its input and every game froze (testers, 2026-10-17: "the game freezes when someone
  // leaves"; Soulve: "crashed players dont crash the whole run ... acts as if they just left"). Each side now sends a
  // one-byte heartbeat a second on channel 1; a player silent for DEAD ms, or whose Steam connection failed, is
  // closed on the fight server like a player who quit, and the server goes on without them. A guest whose host went
  // silent closes its game's fight connection, which takes it back to the game's lobby.
  var DEAD = 10000;
  T.seen = {};
  function gone(k, why) {
    if (T.role == "host" && T.peers[k]) {
      close(T.peers[k].s); var id = T.peers[k].id; delete T.peers[k];
      try { SW.SteamNetworking.CloseP2PSessionWithUser(id); } catch (e) {}
      log("host: guest " + k + " counted as left (" + why + "); the fight goes on without them");
      try { if (G.BB4F && G.BB4F.onPlayerGone) G.BB4F.onPlayerGone(k, why); } catch (e) {}
    } else if (T.role == "guest" && k == T.hostKey && T.conn) {
      close(T.conn); T.conn = null; T.connC = null;
      log("guest: the host is gone (" + why + "); leaving the fight");
      try { if (G.BB4F && G.BB4F.onHostGone) G.BB4F.onHostGone(why); } catch (e) {}
    }
  }
  function beat() {
    var now = Date.now(); if (T.beatAt && now - T.beatAt < 1000) return; T.beatAt = now;
    try {
      if (T.role == "host") for (var k in T.peers) { ctl(T.peers[k].id, 3); if (now - (T.seen[k] || T.peers[k].at) > DEAD) gone(k, "silent for " + DEAD / 1000 + " s"); }
      else if (T.role == "guest" && T.conn) { ctl(T.host, 3); if (now - (T.seen[T.hostKey] || T.connAt) > DEAD) gone(T.hostKey, "silent for " + DEAD / 1000 + " s"); }
    } catch (e) { log("heartbeat: " + es(e)); }
  }
  // A traffic tap for the netcode work (off unless T.tap is set by a test script): each stream's bytes are cut into the
  // fight server's messages ([uint32 BE length = body + 2][uint16 BE id][body]) reading only the 6 header bytes; per
  // stream and id it counts messages, bytes and the largest gap between two arrivals, and logs a summary every 5 s
  var TS = T.tapS = T.tapS || {};
  function tapFeed(name, buf, len) {
    var st = TS[name] || (TS[name] = { h: [], left: 0, ids: {} }), i = 0, now = Date.now();
    while (i < len) {
      if (st.left > 0) { var sk = Math.min(st.left, len - i); st.left -= sk; i += sk; continue; }
      st.h.push(buf.get_Item(i)); i++;
      if (st.h.length < 6) continue;
      var h = st.h, ml = ((h[0] << 24) >>> 0) + (h[1] << 16) + (h[2] << 8) + h[3], id = (h[4] << 8) + h[5];
      st.h = []; st.left = Math.max(0, ml - 2);
      var r = st.ids[id] || (st.ids[id] = { n: 0, b: 0, gap: 0, at: 0 });
      r.n++; r.b += ml + 4; if (r.at) r.gap = Math.max(r.gap, now - r.at); r.at = now;
    }
    if (!T.tapAt) T.tapAt = now;
    if (now - T.tapAt >= 5000) {
      var dt = (now - T.tapAt) / 1000; T.tapAt = now;
      for (var nm in TS) { var ids = TS[nm].ids, parts = []; for (var id2 in ids) { var q = ids[id2]; parts.push(id2 + ":" + (q.n / dt).toFixed(1) + "/s," + Math.round(q.b / Math.max(1, q.n)) + "B,gap" + q.gap); q.n = 0; q.b = 0; q.gap = 0; } if (parts.length) log("TAP " + nm + " " + parts.join(" ")); }
    }
  }
  function readSteam() {
    var size = puerts.$ref(0), who = puerts.$ref(sid("0"));         // a Steam id is a 64-bit number: never a JS number
    for (var ch = 1; ch >= 0; ch--) {
      for (var n = 0; n < 200; n++) {
        if (!SW.SteamNetworking.IsP2PPacketAvailable(puerts.$ref(0), ch)) break;
        if (!SW.SteamNetworking.ReadP2PPacket(BUF, BUF.Length, size, who, ch)) break;
        var len = puerts.$unref(size), from = puerts.$unref(who), k = key(from);
        if (T.role == "guest" && k != T.hostKey) continue;        // a guest takes fight bytes and closes from its host only
        T.seen[k] = Date.now();
        if (ch == 1) {
          var b = BUF.get_Item(0);
          if (T.role == "host" && b == 1) {
            close(T.peers[k] && T.peers[k].s);
            var s = tcp(); try { s.Connect(T.fightEp); s.Blocking = false; T.peers[k] = { s: s, id: from, at: Date.now() }; log("host: guest " + k + " connected to the fight server"); }
            catch (e) { log("host: fight server refused guest " + k + ": " + es(e)); ctl(from, 2); }
          } else if (b == 2) {
            if (T.role == "host") { close(T.peers[k] && T.peers[k].s); delete T.peers[k]; log("host: guest " + k + " closed"); }
            else { close(T.conn); T.conn = null; T.connC = null; log("guest: the host closed the fight connection"); }
          }
          continue;
        }
        T.bytesDown += len;
        if (T.tap) { try { tapFeed((T.role == "host" ? "fromGuest" : "fromHost") + k.slice(-4), BUF, len); } catch (e) { T.tap = false; log("tap: " + es(e)); } }
        try {
          if (T.role == "host") { var pr = T.peers[k]; if (pr) sendAll(pr, BUF, len); }
          else if (T.connC) sendAll(T.connC, BUF, len);
        } catch (e) { log("write to the fight connection: " + es(e)); }
      }
    }
  }
  function pump(s, to) {
    for (var n = 0; n < 64; n++) {
      if (!s.Poll(0, NS.SelectMode.SelectRead)) return true;
      var len = s.Receive(BUF, 0, BUF.Length, NONE);
      if (len <= 0) return false;                       // closed
      if (T.tap) { try { tapFeed((T.role == "host" ? "server>" : "client>") + key(to).slice(-4), BUF, len); } catch (e) { T.tap = false; log("tap: " + es(e)); } }
      SW.SteamNetworking.SendP2PPacket(to, BUF, len, RELIABLE, 0); T.bytesUp += len;
    }
    return true;
  }
  T.tick = function () {
    try {
      if (T.role == "guest") {
        if (!T.conn && T.lis && T.lis.Poll(0, NS.SelectMode.SelectRead)) {
          T.conn = T.lis.Accept(); T.conn.NoDelay = true; T.conn.Blocking = false; T.connC = { s: T.conn, q: [] }; T.connAt = Date.now(); ctl(T.host, 1); log("guest: the game connected; asked the host to open the fight connection");
        }
        if (T.connC) { try { flush(T.connC); } catch (e) { log("guest: " + es(e)); } }
        if (T.conn && !pump(T.conn, T.host)) { close(T.conn); T.conn = null; T.connC = null; ctl(T.host, 2); log("guest: the game closed its fight connection"); }
      } else if (T.role == "host") {
        for (var k in T.peers) { var p = T.peers[k]; try { flush(p); } catch (e) { log("host: guest " + k + ": " + es(e)); } if (!pump(p.s, p.id)) { close(p.s); delete T.peers[k]; ctl(p.id, 2); log("host: fight server closed guest " + k); } }
      }
      if (T.role) { readSteam(); beat(); }
    } catch (e) { if (!T.errT || Date.now() - T.errT > 5000) { T.errT = Date.now(); log("tick: " + es(e)); } }
  };
  T.stop = function () {
    clearInterval(T.timer); T.timer = null; close(T.conn); T.conn = null; T.connC = null; close(T.lis); T.lis = null;
    for (var k in T.peers) close(T.peers[k].s); T.peers = {};
    if (T.role == "guest" && T.host) { try { SW.SteamNetworking.CloseP2PSessionWithUser(T.host); } catch (e) {} }
    T.role = null; log("stopped"); return "FOURTUN stopped";
  };
  // The game drops to 20 frames a second when its window is not in front (TsGameGlobal.OnFocusChange). The relay and
  // the host's fight server run on the game's frames, so one player looking at another window lagged everyone
  // (Soulve, 2026-10-17: "latency issues when everyone is off screen"). While the relay runs, the frame rate the
  // game saved before the drop is put back.
  function keepFps(focused) {
    if (focused || !T.role) return;
    try {
      var TG = require("Manager/TsGameGlobal").default.Instance, U = cs.GameUtility;
      U.FrameRate = TG && TG.backupFrameRate > 20 ? TG.backupFrameRate : 60;
      if (TG) U.VSyncCount = TG.backupVsync;
      log("window not in front: frame rate kept at " + U.FrameRate);
    } catch (e) { log("keep frame rate: " + es(e)); }
  }
  T.keepFps = keepFps;
  // At the game's start Core/Util is not loaded yet (its U is undefined), so the hook is tried again each second until
  // it holds; before 0.3.0 one early try failed and the frame rate was never kept in that game.
  function hookFocus() {
    try {
      var GGl = require("Core/Util").U.GetSingleton(cs.GameGlobal);
      if (G.BB4FOC) { try { GGl.remove_OnFocusChange(G.BB4FOC); } catch (e) {} }
      G.BB4FOC = function (f) { keepFps(f); };
      GGl.add_OnFocusChange(G.BB4FOC);
      if (T.focusTries) log("focus hook in place after " + T.focusTries + " s");
      return true;
    } catch (e) { if (!T.focusTries) log("focus hook not ready yet, trying again each second: " + es(e)); T.focusTries = (T.focusTries || 0) + 1; return false; }
  }
  if (T.focusTimer) { clearInterval(T.focusTimer); T.focusTimer = null; }
  T.focusTries = 0;
  if (!hookFocus()) T.focusTimer = setInterval(function () { if (hookFocus() || T.focusTries > 600) { clearInterval(T.focusTimer); T.focusTimer = null; } }, 1000);
  T.status = function () { return (T.role || "off") + (T.role == "guest" ? " via 127.0.0.1:" + T.port + (T.conn ? ", connected" : "") : T.role == "host" ? ", " + Object.keys(T.peers).length + " guest(s)" : "") + ", up " + T.bytesUp + " B, down " + T.bytesDown + " B"; };
  T.timer = setInterval(T.tick, 1);
  log("ready in window " + WIN);
  return "FOURTUN ready";
})();
