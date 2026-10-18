// Four-player online: starting the fight on the game's own fight server (the stock "LAN host" path, no 91Act).
// Research: local_only/fourplayer/research/lan_fight_path.md. The host's game opens its fight server, makes one fight
// field with a fighter per player (host first: it is the run's host, Synced[0]), and sends the field's address, id and
// token through the lobby. Every game (host too) then logs in to that field and loads the co-op battle scene
// (ScenePvpBreed), which runs the stock team run (BattleTeamBreedRun) for every fighter in the field.
// A player's fighter id is the Steam id (a decimal number, different for every player). Windows on one PC share
// a Steam account, so there each window uses its own id (window number based). The id is what the fight server knows
// a player by; the game reads it from the "world" login (Identity.AccountId), so it is set there for the fight and put
// back after. Log tag FOURFIGHT.
(function () {
  var cs = CS, G = globalThis, B = G.BB4;
  var WIN = B.WIN;
  function log(m) { B.log("FOURFIGHT", m); }
  var es = B.es;
  var U, LanServer, PTM, Def;
  function mods() {
    if (U) return;
    U = require("Core/Util").U; LanServer = require("GamePlay/Pvp/LanServer").default;
    PTM = require("Window/Pvp/PveTeamMatch").default; Def = require("Window/Pvp/PveTeamMatchDefine");
  }
  var FF = G.BB4F = G.BB4F || {};
  FF.state = FF.state || "idle";
  if (FF.watch) clearInterval(FF.watch);
  if (FF.hashWatch) clearInterval(FF.hashWatch);

  function ident() { mods(); var s = U.GetSingleton(cs.NOAH.Network.Rest.RestManager).GetService("world"); if (!s.Identity) s.Identity = new cs.NOAH.Network.Identity(); return s.Identity; }
  FF.myId = function () {
    var L = G.BB4L;
    if (!L || L.local) return String(4000000000 + WIN);              // windows on one PC: one id per window
    return String(cs.Steamworks.SteamUser.GetSteamID().m_SteamID);
  };
  FF.setId = function (id) { var I = ident(); if (FF.realId == null) FF.realId = String(I.AccountId || ""); I.AccountId = String(id); };
  FF.restoreId = function () { if (FF.realId != null) { try { ident().AccountId = FF.realId; } catch (e) {} FF.realId = null; } };

  // ---- patches the run needs with more than two players (each applied once) ----
  function patches() {
    mods();
    selfTriggers();
    if (FF.patched) return; FF.patched = 1;
    // BattleTeamBreedNetStatus calls Synced.All(...) at the phase-6 boss door; arrays have no All
    if (!Array.prototype.All) Object.defineProperty(Array.prototype, "All", { value: function (f) { return this.every(f); }, enumerable: false });
    // the battle log goes to 91Act after every 2+ player fight: not in this mode
    try {
      var FL = require("Window/Pvp/PvpFriendList").default, orig = FL.InsertAndUploadBattleLog;
      FL.InsertAndUploadBattleLog = function () { if (G.BB4F && BB4F.inFight) return Promise.resolve(true); return orig.apply(this, arguments); };
    } catch (e) { log("battle log patch: " + es(e)); }
  }

  // A mod hero's own triggers (EX Ragna's drain, EX Hakumen's Susanoo gauge) are listed in BB_SELF_TRIGGERS by hero id,
  // and bbee-actors adds them only on the self-player path. A co-op battle adds every main player's triggers through
  // addPersistantPlayerTriggers instead (BattleTeamBreed.teamBreedInitMainPlayersTriggers), so online they were never
  // added for anyone. Here every player gets their own hero's list, on every PC, so each game runs the same triggers.
  // A trigger the player already has is not added twice.
  function selfTriggers() {
    try {
      var P = require("GamePlay/Battle/BattleJs").default.prototype;
      if (P.__bb4self) return;
      var add = P.addPersistantPlayerTriggers;
      P.addPersistantPlayerTriggers = function (e, t) {
        try {
          var x = e && G.BB_SELF_TRIGGERS && G.BB_SELF_TRIGGERS[e.BaseID];
          if (x && t) {
            var miss = x.filter(function (id) { if (t.indexOf(id) >= 0) return false; try { return !e.TriggerMgr.FindTrigger(id); } catch (z) { return true; } });
            if (miss.length) { t = t.concat(miss); log("hero " + e.BaseID + ": its own triggers " + miss.join(", ") + " added"); }
          }
        } catch (z) {}
        return add.call(this, e, t);
      };
      P.__bb4self = 1;
    } catch (e) { log("self triggers: " + es(e)); }
  }

  // ---- the run's rules (the lobby's Run rules board) ----
  // Legacies, the Potential cap and Mind Crystals are decided by each player's own game when it builds its own run
  // (every PC runs its own dungeon model and sends the result to the others), so each game applies them to itself.
  // Enemy scaling is part of the shared fight and must be identical on every PC: it reads the host's copy of the rules
  // that came with the fight (TeamPveHeatData.BB4) and the player count of the fight itself, nothing local.
  // The wrappers are put in when a fight starts and taken out when it ends; outside a Four Player fight they do nothing.
  var SCALE_TRG = [[984001, "Monster", "Boss"], [984002, "Monster", "Boss"], [984003, "Boss", ""], [984004, "Boss", ""]];   // mods\four-player tables
  function rulesNow() { return G.BB4_OPTS || null; }
  function legacyCount(fes) { return (fes && fes.skills || []).filter(function (s) { return s && s.fromActorId; }).length; }
  function potCapFor(m) {
    var o = rulesNow(); if (!o || !o.potCap) return 0;
    try {
      var X = require("Gen/Xlsx").Xlsx, fes = m.FesActor, id = fes.id, b = X.BaseActorConf.Get(id), pool = (b && b.potentialPoolId) || id;
      if (o.potCap != "half") return +o.potCap;
      var total = 0; try { total = require("Server/Module/XlsxUtils").XlsxUtils.ActorPotentialCount.get(pool) | 0; } catch (e) {}
      if (!total) total = X.BaseActorPotentialConf.All.filter(function (r) { return r.actorId == pool; }).length;
      return Math.max(1, Math.ceil(total / 2));
    } catch (e) { log("rules: Potential cap: " + es(e)); return 0; }
  }
  function potHeld(m) {
    try {
      var X = require("Gen/Xlsx").Xlsx, fes = m.FesActor, init = {};
      X.BaseActorPotentialConf.All.forEach(function (r) { if (r.init || r.Init) init[r.id] = 1; });   // the free ones every run starts with do not count
      return (fes.potentials || []).filter(function (p) { return p && p.id && !init[p.id]; }).length;
    } catch (e) { return 0; }
  }
  function capReached(m) { var c = potCapFor(m); return c > 0 && potHeld(m) >= c; }
  FF.rulesOn = function (o) {
    G.BB4_OPTS = o || null; if (!o) return;
    log("run rules for this fight: " + JSON.stringify(o));
    try {
      var A = require("Server/Module/Actor").FesActorUtils;
      if (!A.__bb4) {
        var add = A.AddSkill; A.__bb4 = add;
        A.AddSkill = function (t, e) {
          var r = rulesNow();
          if (r && e && e.fromActorId) {
            var have = (t.skills || []).some(function (s) { return s && s.id == e.id; });
            if (!r.legacy) { log("rules: Legacy skill " + e.id + " left out (Legacies off)"); return; }
            if (!have && legacyCount(t) >= (r.legacyMax || 1)) { log("rules: Legacy skill " + e.id + " left out (" + (r.legacyMax || 1) + " per player)"); return; }
          }
          return add.call(this, t, e);
        };
      }
    } catch (e) { log("rules: Legacies: " + es(e)); }
    try {
      var P = require("Server/Model/BreedDungeon").ModelBreedDungeon.prototype;
      if (!P.__bb4cap) {
        var can = P.CanPotentialRandom, ref = P.refreshPotentialReward; P.__bb4cap = [can, ref];
        P.CanPotentialRandom = function () { if (rulesNow() && capReached(this)) return false; return can.apply(this, arguments); };
        // an offer already open is still rerolled; a new one is not made once the cap is reached (the game then pays EP
        // and shows its own "Potentials are at max" line)
        P.refreshPotentialReward = function (e) { if (!e && rulesNow() && capReached(this)) { log("rules: Potential cap " + potCapFor(this) + " reached: no offer"); return false; } return ref.apply(this, arguments); };
      }
    } catch (e) { log("rules: Potential cap: " + es(e)); }
    try {
      var PL = require("Server/Model/Player").ModelPlayer.prototype;
      if (!PL.__bb4mind) {
        var eff = PL.GetConsciousCrystalEffects, lv = PL.GetConsciousLevelAttr; PL.__bb4mind = [eff, lv];
        PL.GetConsciousCrystalEffects = function () { var r = rulesNow(); if (r && !r.crystals) return []; return eff.apply(this, arguments); };
        PL.GetConsciousLevelAttr = function () { var r = rulesNow(); if (r && !r.crystals) return []; return lv.apply(this, arguments); };
      }
    } catch (e) { log("rules: Mind Crystals: " + es(e)); }
    try {
      var TB = require("GamePlay/Battle/BattleTeamBreed").default.prototype;
      if (!TB.__bb4scale) {
        var start = TB.applyBuffsOnBattleStart; TB.__bb4scale = start;
        TB.applyBuffsOnBattleStart = function () { var r = start.apply(this, arguments); try { scaleEnemies(this); } catch (e) { log("rules: enemy scaling: " + es(e)); } return r; };
      }
    } catch (e) { log("rules: enemy scaling: " + es(e)); }
  };
  // the host's rules as the fight carries them (the same on every PC), else this game's copy from the start signal
  function fightRules() {
    try { var h = require("GamePlay/BattleTeamBreedRun/BattleTeamBreedGlobalRef").BattleTeamBreedGlobalRef.TeamPveHeatData; if (h && h.BB4) return h.BB4; } catch (e) {}
    try { var h2 = require("GamePlay/Pvp/PvpUtil").PvpUtil.GetStaticTeamFightData(); if (h2 && h2.TeamPveHeatData && h2.TeamPveHeatData.BB4) return h2.TeamPveHeatData.BB4; } catch (e) {}
    return null;
  }
  function scaleEnemies(tb) {
    var r = fightRules(), lvl = r ? r.scale | 0 : 0; if (!lvl) return;
    var n = 0; try { n = cs.PvpDefine.ls_info.playerList.Count | 0; } catch (e) {}
    if (n < 3) return;
    var B = tb.Battle, U2 = require("GamePlay/Battle/BattleFesActorBuffUtils").BattleFesActorBuffUtils, done = [];
    SCALE_TRG.forEach(function (x) {
      try { if (B.MonsterEnvTriggerMgr.Find && B.MonsterEnvTriggerMgr.Find(x[0])) return; } catch (e) {}
      U2.ApplyOneEnvTrigger({ id: x[0], level: lvl * 10 + Math.min(8, n), whiteTags: x[1], blackTags: x[2] }, B); done.push(x[0]);
    });
    if (done.length && !FF.scaleLogged) { FF.scaleLogged = 1; log("rules: enemies scaled for " + n + " players (" + (lvl == 2 ? "Strong" : "Light") + "): " + done.join(", ")); }
  }
  FF.rulesOff = function () {
    G.BB4_OPTS = null; FF.scaleLogged = 0;
    try { var A = require("Server/Module/Actor").FesActorUtils; if (A.__bb4) { A.AddSkill = A.__bb4; A.__bb4 = null; } } catch (e) {}
    try { var P = require("Server/Model/BreedDungeon").ModelBreedDungeon.prototype; if (P.__bb4cap) { P.CanPotentialRandom = P.__bb4cap[0]; P.refreshPotentialReward = P.__bb4cap[1]; P.__bb4cap = null; } } catch (e) {}
    try { var PL = require("Server/Model/Player").ModelPlayer.prototype; if (PL.__bb4mind) { PL.GetConsciousCrystalEffects = PL.__bb4mind[0]; PL.GetConsciousLevelAttr = PL.__bb4mind[1]; PL.__bb4mind = null; } } catch (e) {}
    try { var TB = require("GamePlay/Battle/BattleTeamBreed").default.prototype; if (TB.__bb4scale) { TB.applyBuffsOnBattleStart = TB.__bb4scale; TB.__bb4scale = null; } } catch (e) {}
  };
  FF.rules = function () { try { return G.BB4L && G.BB4L.run && G.BB4L.run.rules ? G.BB4L.run.rules : G.BB4_RULES || null; } catch (e) { return null; } };

  // ---- host ----
  // The difficulty and Entropy effects the host set in the game's own Heat menu, read the way the stock co-op host
  // reads them when the menu is closed (PveTeamMatch.Update): the saved mode, level and that mode's effect list.
  FF.heatData = function () {
    mods();
    var HU = require("GamePlay/Heat/HeatUtil").default, DB = require("DataBinding").DB, M = require("Gen/pbdef").EBreedDungeonMode;
    var t = new Def.TeamPveHeatData();
    try {
      t.CurrentBattleMode = HU.CurBattleMode; t.CurHeatLevel = HU.CurLevel;
      if (t.CurrentBattleMode == M.Normal) t.NormalHeatData = U.DeepCopyObj(DB.Heat.NormalModeHeatDatas.Value);
      else if (t.CurrentBattleMode == M.Master) t.MasterHeatData = U.DeepCopyObj(DB.Heat.MasterModeHeatDatas.Value);
      else if (t.CurrentBattleMode == M.Expert) t.ExpertHeatData = U.DeepCopyObj(DB.Heat.ExpertModeHeatDatas.Value);
      if (!Def.TeamPveHeatData.IsValid(t)) { log("the saved difficulty is not usable: the run's default"); return new Def.TeamPveHeatData(); }
    } catch (e) { log("difficulty: " + es(e)); return new Def.TeamPveHeatData(); }
    return t;
  };
  // the run settings as the lobby shows them: { mode: "Expert", level: 3 }
  FF.runSummary = function () {
    try { var HU = require("GamePlay/Heat/HeatUtil").default, M = require("Gen/pbdef").EBreedDungeonMode; return { mode: String(M[HU.CurBattleMode] || ""), level: HU.CurLevel | 0 }; } catch (e) { return null; }
  };
  // a player's Evotypes as the co-op fighter data carries them (the stock two slots)
  function factorsOf(evo, evo2) {
    var m = new Map();
    [evo, evo2].forEach(function (v, i) {
      if (!v || !v.id) return;
      try {
        m.set(m.size, Def.PveTeamMatchFesActor.fromIST({ id: v.id, score: v.score | 0, uid: v.uid, inheritBlesses: (v.inheritBlesses || []).map(function (b) { return { id: b.id, quality: b.quality }; }),
          inheritSkillIndex: v.inheritSkillIndex | 0, inheritSkillLevel: v.inheritSkillLevel | 0 }));
      } catch (e) { log("Evotype " + v.id + ": " + es(e)); }
    });
    return m;
  }
  // players: [{ id, name, hero, skin, evo }], host first
  FF.hostCreate = async function (players) {
    patches();
    // a fresh server for every fight: an old field left on it (one that ended in a game over) kept every later
    // field at frame 0, so no fight began until the server was restarted (2026-10-17)
    try { var sm = U.GetSingleton(cs.FightSvrManager); if (sm.IsFightServerOpen()) { sm.StopFightServerByCSharp(); log("the old fight server stopped"); } } catch (e) { log("stopping the old fight server: " + es(e)); }
    if (!await LanServer.OpenLocalHost("BB4")) { log("the fight server did not open"); return null; }
    var heat = FF.heatData(), mgr = U.GetSingleton(cs.FightSvrManager), rules = FF.rules();
    if (rules) heat.BB4 = rules;
    log("run settings: mode " + heat.CurrentBattleMode + ", level " + heat.CurHeatLevel + (rules ? ", rules " + JSON.stringify(rules) : ""));
    var req = new cs.Act91.Actservice.Fight.ApiCreateFieldPostReq();
    // The server's desync check (HashChecker) compares each game's hash as it comes in. When two that came in differ
    // while a third game's has not (a player who is late, offline or a stand-in), it builds its report from the
    // missing one and throws (NullReferenceException in HashChecker.HashErr, read from the game, 2026-10-18): the
    // server's thread stops, no frame comes again, and every game in the fight freezes. With two players a desync
    // only restarts the room, so the check stays on there; with three or more it is off.
    FF.hashCheck = players.length <= 2;
    req.SpecifyFieldid = "private_bb4_" + Date.now(); req.FrameIntervalMs = 16; req.MaxLifetimeSecs = 10800; req.OpenHashCheck = FF.hashCheck;
    req.SaveFramePerFileCount = 5000; req.MaxHasherrntyCount = 1000; req.Version = cs.PvpMatch.GetClientVersion();
    players.forEach(function (p, i) {
      var f = PTM.prototype.GetFighterDataFromPrepareData.call(null, {
        PlayerTeamData: { baseActorId: p.hero || 100101, baseActorSkinId: p.skin || 0, factors: factorsOf(p.evo, p.evo2) },
        ConsciousData: { level: 0, slotCrystalMap: {} }, ConsciousDataLevel: {}, BuffList: [], DebuffList: [] }, String(p.id), p.name || ("Player " + (i + 1)), i == 0, heat);
      var fi = new cs.Act91.Actservice.Fight.FighterInfo(), b = cs.Js.JsUtil.ToBytes(f.data);
      fi.TeamId = 1; fi.Id = String(p.id); fi.UserData = cs.Google.Protobuf.ByteString.CopyFrom(b, 0, b.Length);
      req.FighterInfos.Add(fi); req.SpecifyFieldid += "_" + p.id;
    });
    var res = await puer.$promise(mgr.CreateFightField(req));
    if (!res) { log("the fight field was not made"); return null; }
    LanServer.SetLastFightFieldId(res.FieldId);
    var local = Def.makeTeamLocalFightSvrData(res.TcpAddr, res.FieldId, res.Token, 1);
    log("field " + res.FieldId + " at " + res.TcpAddr + " for " + players.length + " fighter(s): " + players.map(function (p) { return p.name + " " + p.id + " hero " + p.hero + (p.evo ? " Evotype " + p.evo.id + "/" + p.evo.uid : ""); }).join(", ") + "; the server's desync check " + (FF.hashCheck ? "on" : "off (three or more players)"));
    return { TcpAddr: local.TcpAddr, FightFieldID: local.FightFieldID, FightFieldToken: local.FightFieldToken, LogTrackBuffSize: local.LogTrackBuffSize,
      CheckFrameDelayCount: local.CheckFrameDelayCount, NetDelayValueMs: local.NetDelayValueMs, FrameExecCacheSize: local.FrameExecCacheSize };
  };

  // ---- every player (host too): log in to the field and load the co-op battle ----
  FF.join = async function (local, myId, viaAddr) {
    patches();
    FF.setId(myId); FF.inFight = true; FF.state = "joining"; FF.joinAt = Date.now(); FF.frame0 = frameNow(); FF.began = false;
    var addr = viaAddr || local.TcpAddr;
    try { var B = require("GamePlay/Battle/BattleJs").default.Instance; if (B && B.Battle && B.Battle.PauseBattle) B.Battle.PauseBattle(false); } catch (e) {}
    if (G.BBTR_ACTIVE) { G.BBTR_ACTIVE = false; }
    cs.PvpMatch.SetLogTrackInfo(local.LogTrackBuffSize || 0, false, false, false, false);
    cs.PvpMatch.SetLockStepInfo(local.NetDelayValueMs || 50, local.CheckFrameDelayCount || 20, local.FrameExecCacheSize || 8);
    cs.PvpMatch.SetRoomInfo(local.FightFieldID, local.FightFieldToken, addr, "", "", false);
    try { cs.PvpDefine.CreatePvpFightInfo(); } catch (e) { log("CreatePvpFightInfo: " + es(e)); }
    log("joining field " + local.FightFieldID + " at " + addr + " as " + myId);
    await U.LoadSceneAsync("ScenePvpBreed");
    FF.state = "in the fight"; log("co-op scene loaded");
  };

  // ---- a player on the start list who never comes ----
  // The fight server starts a fight only once every player in it has logged in and loaded. A player who left the
  // lobby (or closed the game) after the host pressed Start never logs in, and every other game sat on the loading
  // screen for good, reconnecting every 18 s (testers, 2026-10-17: "we are stuck loading or loading forever"). The host
  // now logs in a stand-in for each such player: it says it has loaded and leaves at once, so the server starts the
  // fight with that player as a disconnected teammate, the way a player who drops out mid-run is.
  FF.LEFT_MS = 6000;
  function pack(id, msg) {
    var body = cs.Google.Protobuf.MessageExtensions.ToByteArray(msg), n = body.Length, len = n + 2;
    var a = cs.System.Array.CreateInstance(puerts.$typeof(cs.System.Byte), n + 6);
    a.set_Item(0, (len >>> 24) & 255); a.set_Item(1, (len >>> 16) & 255); a.set_Item(2, (len >>> 8) & 255); a.set_Item(3, len & 255);
    a.set_Item(4, (id >>> 8) & 255); a.set_Item(5, id & 255);
    cs.System.Array.Copy(body, 0, a, 6, n); return a;
  }
  function standIn(f, id) {
    var NS = cs.System.Net.Sockets, PF = cs.Act91.Actservice.Fight, p = String(f.addr).split(":"), s = null;
    try {
      s = new NS.Socket(NS.AddressFamily.InterNetwork, NS.SocketType.Stream, NS.ProtocolType.Tcp);
      s.Connect(new cs.System.Net.IPEndPoint(cs.System.Net.IPAddress.Parse(p[0]), parseInt(p[1])));
      var lg = new PF.LoginReq(); lg.FighterId = String(id); lg.FieldId = String(f.field); lg.Token = String(f.token || ""); lg.Reconnect = false;
      var a = pack(1000, lg); s.Send(a, 0, a.Length, NS.SocketFlags.None);
      // It says it has loaded, then keeps the connection alive until the fight has begun: the server starts only while
      // every player in it is connected and loaded at once, and real players may still be loading. Once the frames
      // run it leaves, and the player shows as disconnected.
      var t0 = Date.now(), loaded = false, hbAt = 0, began = 0, sink = cs.System.Array.CreateInstance(puerts.$typeof(cs.System.Byte), 65536);
      s.Blocking = false;
      var tm = setInterval(function () {
        try {
          while (s.Poll(0, NS.SelectMode.SelectRead)) { if (s.Receive(sink, 0, sink.Length, NS.SocketFlags.None) <= 0) throw new Error("the fight server closed it"); }
          if (!loaded && Date.now() - t0 > 800) { loaded = true; var ld = new PF.LoadingReq(); ld.Progress = 100; var b = pack(1020, ld); s.Send(b, 0, b.Length, NS.SocketFlags.None); }
          if (Date.now() - hbAt > 1000) { hbAt = Date.now(); var hb = new PF.Heartbeat(); hb.TimestampMs = BigInt(Date.now()); var h = pack(1, hb); s.Send(h, 0, h.Length, NS.SocketFlags.None); }
          if (FF.began && !began) began = Date.now();
          if ((began && Date.now() - began > 1000) || Date.now() - t0 > FF.START_MS + 60000) { clearInterval(tm); s.Close(); log("stand-in for " + id + " left" + (began ? " (the fight began)" : " (the fight never began)")); }
        } catch (e) { clearInterval(tm); try { s.Close(); } catch (x) {} log("stand-in for " + id + ": " + es(e)); }
      }, 100);
      log("player " + id + " left before the fight began: a stand-in logged in for them (they show as disconnected)");
    } catch (e) { log("stand-in for " + id + ": " + es(e)); try { if (s) s.Close(); } catch (x) {} }
  }
  function fillLeft() {
    var f = FF.field, L = G.BB4L; if (!f || !L) return;
    if (Date.now() - f.at > 300000 || FF.began) { FF.field = null; return; }
    if (Date.now() - f.at < FF.LEFT_MS) return;
    f.ids.forEach(function (id) {
      if (f.filled[id] || id == f.host) return;
      var here = L.members.some(function (m) { return String(L.local ? 4000000000 + parseInt(String(m.id).replace(/\D/g, "") || "0") : m.id) == String(id); });
      if (!here) { f.filled[id] = 1; standIn(f, id); }
    });
  }
  function frameNow() { try { mods(); return U.GetSingleton(cs.LockStepManager).m_logicFrame | 0; } catch (e) { return 0; } }

  // ---- the lobby's Start button (host) and start signal (everyone) ----
  FF.hostStart = async function () {
    var L = G.BB4L; if (!L || !L.host) return;
    var players = L.members.map(function (m, i) { return { id: L.local ? String(4000000000 + parseInt(String(m.id).replace(/\D/g, "") || (i + 1))) : m.id, name: m.name, hero: m.hero || 100101, skin: m.skin || 0, evo: m.evo || null, evo2: m.evo2 || null }; });
    var me = FF.myId(); players.sort(function (a, b) { return (b.id == me) - (a.id == me); });
    FF.state = "making the fight";
    var local = await FF.hostCreate(players); if (!local) { FF.state = "failed to make the fight"; return; }
    if (G.BB4T2 && !L.local) BB4T2.hostOn(local.TcpAddr);
    FF.field = { addr: local.TcpAddr, field: local.FightFieldID, token: local.FightFieldToken, host: me, ids: players.map(function (p) { return String(p.id); }), filled: {}, at: Date.now() };
    FF.began = false;                // the last fight's flag would clear this field before this game has joined
    L.sendStart({ local: local, host: me, ids: players.map(function (p) { return p.id; }), rules: FF.rules() });
  };
  FF.onStart = function (o) {
    FF.gate(); FF.guardPreload(); FF.startAt = Date.now();            // here, not at the game's start: no game module is loaded then
    FF.fightAt = o.at || 0; if (FF.syncSummary) FF.syncSummary();   // the desync check starts again for this fight
    var me = FF.myId();
    if (o.ids.indexOf(me) < 0) { log("this game is not in the fight list (" + me + ")"); return; }
    var L = G.BB4L, via = null;
    FF.rulesOn(o.rules || null);                 // before the run is built: Legacies, Potential cap and Mind Crystals act there
    if (L && !L.local && me != o.host && G.BB4T2) via = BB4T2.guest(o.host);   // over Steam: through this PC's relay
    FF.join(o.local, me, via).catch(function (e) { log("join: " + es(e)); FF.state = "failed: " + e; });
  };
  if (G.BB4L) BB4L.onStart = FF.onStart;
  FF.status = function () { return FF.state; };
  // the fight is over once this game has left the co-op battle for 3 s: the world login gets its own id back, the
  // relay stops, and the lobby is ready for another start
  FF.end = function (why) {
    FF.inFight = false; FF.seenFight = 0; FF.joinAt = 0; FF.began = false; FF.restoreId(); FF.rulesOff();
    try { if (FF.syncSummary) FF.syncSummary(); } catch (e) {}
    if (FF.desyncs) log(FF.desyncs + " desync(s) in this fight"); FF.desyncs = 0;
    if (FF.pdeferred) log(FF.pdeferred + " boon preload(s) held back while a room loaded"); FF.pdeferred = 0;
    try { if (G.BB4T2) BB4T2.stop(); } catch (e) {}
    // the fight is over: the host's server goes too (an open one froze the game on quit, 2026-10-17)
    try { var sm = U.GetSingleton(cs.FightSvrManager); if (sm.IsFightServerOpen()) { sm.StopFightServerByCSharp(); log("fight server stopped"); } } catch (e) { log("stopping the fight server: " + es(e)); }
    try { if (G.BB4L && BB4L.state == "in") { BB4L.setReady(false); BB4L.clearStart(); } } catch (e) {}
    FF.state = "idle"; FF.endAt = Date.now(); log("fight over: " + why);
  };
  // Quitting the game while it hosted a running fight hung it: the fight server inside the game was still open
  // (window 5 on 2026-10-17, window 2 on 2026-10-18; with the server stopped first the game closed in seconds). The
  // game's own quitting event now stops the relay and the server first. It is added once per game and calls the
  // newest FF.onQuit, so a hot load does not add a second one.
  FF.onQuit = function () {
    try { if (G.BB4T2) BB4T2.stop(); } catch (e) {}
    try {
      mods(); var sm = U.GetSingleton(cs.FightSvrManager);
      if (sm && sm.IsFightServerOpen()) { log("quitting: the fight server is stopped first"); sm.StopFightServerByCSharp(); }
    } catch (e) { log("quitting: " + es(e)); }
  };
  if (!G.__bb4quitOn) {
    try { cs.UnityEngine.Application.add_quitting(function () { if (G.BB4F && G.BB4F.onQuit) G.BB4F.onQuit(); }); G.__bb4quitOn = 1; }
    catch (e) { log("quit hook: " + es(e)); }
  }
  // Leaving a fight (abort, defeat, the end) took the game toward 91Act's co-op team room, whose login gate showed
  // "You are offline. Try connecting to the internet?" (Soulve, 2026-10-17: "so we never go back to this screen and
  // we just go back to the base game lobby"). During a Four Player fight and for a minute after it, the gate answers
  // "not online" at once without its box, and the game stays in its own lobby.
  FF.gate = function () {
    try {
      var PU = require("GamePlay/Pvp/PvpUtil").PvpUtil;
      if (PU.__bb4gate) return; PU.__bb4gate = 1;
      var o1 = PU.CheckOnlineFunctionOpenWithLoginCheck, o2 = PU.CheckOnlineFunctionOpenWithLoginCheckAsync;
      function ours() { var F = G.BB4F; return !!F && (F.inFight || (F.endAt && Date.now() - F.endAt < 60000)); }
      PU.CheckOnlineFunctionOpenWithLoginCheck = function (name, yes, no) {
        if (!ours()) return o1.apply(this, arguments);
        G.BB4F.log2("online gate skipped after a Four Player fight (" + name + "): staying in the game's lobby");
        try { if (typeof no == "function") no(); } catch (e) {}
      };
      if (o2) PU.CheckOnlineFunctionOpenWithLoginCheckAsync = function (name) {
        if (!ours()) return o2.apply(this, arguments);
        G.BB4F.log2("online gate skipped after a Four Player fight (" + name + ", async)"); return Promise.resolve(false);
      };
    } catch (e) { log("online gate: " + es(e)); }
  };
  FF.log2 = log;
  // The next room's resources load while the run goes on (StartPreloadStage, not awaited), walking the shared preload
  // batch's sets. A player's boons refreshed meanwhile add their buffs to those sets (PreloadBlessTrigger), and the
  // load throws "Collection was modified" (window 1, 2026-10-17 22:21:54 UTC, three players): its promise never
  // settles and the next room never comes. More players, more refreshes: the testers' freezes on a room's clear and on
  // the loading screen with 3 and 4 players. While a batch is loading, its additions wait and go in once it is done.
  FF.guardPreload = function () {
    try {
      var BP = require("GamePlay/Battle/BattlePreloader").default, P = BP.prototype;
      if (!BP.__bb4trig) BP.__bb4trig = BP.PreloadTrigger;
      if (!P.__bb4stage) P.__bb4stage = P.StartPreloadStage;
      var busy = FF.pbusy = FF.pbusy || [], queue = FF.pqueue = FF.pqueue || [];
      function same(a, b) { if (a === b) return true; try { return !!a && a.Equals(b); } catch (e) { return false; } }
      function isBusy(b) { for (var i = 0; i < busy.length; i++) if (same(busy[i], b)) return true; return false; }
      function flush() {
        for (var i = 0; i < queue.length; ) {
          var q = queue[i]; if (isBusy(q[2])) { i++; continue; }
          queue.splice(i, 1); try { BP.__bb4trig.call(BP, q[0], q[1], q[2]); } catch (e) { log("preload, late addition: " + es(e)); }
        }
      }
      BP.PreloadTrigger = function (e, a, t) {
        if (t && isBusy(t)) { queue.push([e, a, t]); FF.pdeferred = (FF.pdeferred || 0) + 1; return; }
        return BP.__bb4trig.call(this, e, a, t);
      };
      P.StartPreloadStage = function () {
        var b = this.preloadBatch, self = this; busy.push(b);
        function done() { for (var i = 0; i < busy.length; i++) if (busy[i] === b) { busy.splice(i, 1); break; } flush(); }
        var r; try { r = P.__bb4stage.apply(self, arguments); } catch (e) { done(); throw e; }
        Promise.resolve(r).then(done, function (e) { done(); log("room preload: " + es(e)); });
        return r;
      };
      if (!FF.pguardLogged) { FF.pguardLogged = 1; log("room preload guarded: boon additions wait while the next room loads"); }
    } catch (e) { log("preload guard: " + es(e)); }
  };
  // A fight whose frames have not begun to run START_MS after joining never will (the server is waiting for a player
  // who is not coming): this game goes back to the hub and the lobby says why, instead of loading for good.
  FF.START_MS = 240000;            // eight heroes took over a minute to load on the development PC
  function giveUp() {
    log("the fight did not begin in " + (FF.START_MS / 1000) + " s: back to the hub");
    FF.end("the fight never began");
    try { if (G.BB4L) BB4L.note = "The fight did not begin (a player never arrived). Back in the hub: start again."; } catch (e) {}
    try { var Run = require("GamePlay/BattleTeamBreedRun/BattleTeamBreedRun").default; if (Run.SilentInstance) Run.DestroyInstance(); } catch (e) {}
    try { require("GamePlay/Battle/BattleJs").default.Teleport(U.LobbyName(), null, null).catch(function (e) { log("back to the hub: " + es(e)); }); } catch (e) { log("back to the hub: " + es(e)); }
  }
  // The game's own desync check (OpenHashCheck, on in every field we make): the fight server compares each game's
  // hash of every player's position, facing and HP. On a mismatch m_hashErrorState goes up for about a second and the
  // game puts itself right by restarting the room in every game (seen 2026-10-17, a desync made on purpose in one
  // window). Players see a room that starts again; the log says when, and what this game had.
  FF.desyncs = 0; var hashWas = 0;
  if (FF.hashWatch) clearInterval(FF.hashWatch);          // a hot load replaces the watcher instead of adding one
  FF.hashWatch = setInterval(function () {
    if (!FF.inFight || !FF.began) { hashWas = 0; return; }
    var L = null, e = 0; try { mods(); L = U.GetSingleton(cs.LockStepManager); e = L.m_hashErrorState | 0; } catch (x) { return; }
    if (e && !hashWas) {
      FF.desyncs++; var r = [];
      try { var a = require("GamePlay/Battle/BattleJs").default.Instance.Battle.GetAllMainPlayers(); for (var i = 0; i < a.Count; i++) { var p = a.get_Item(i); r.push(p.BaseID + " x " + p.Position.x.toFixed(2) + " hp " + U.FpToFloat(p.Attr.HP).toFixed(1) + " " + p.ActionMgr.CurrentActionName); } } catch (x) {}
      log("desync " + FF.desyncs + " (the game's hash check, state " + e + ") at frame " + L.m_logicFrame + ": the game restarts the room | " + r.join(" | "));
    }
    hashWas = e;
  }, 100);
  // ---- our own desync check (the server's is off with three or more players: see FF.hostCreate) ----
  // Each game keeps a digest of what it shows at every SYNC_STEP-th logic frame it sees: every main player's place,
  // facing and HP, and the enemies' count, total HP and total x. Every second it writes its newest digests to the lobby
  // (Steam member data, or the lobby file), reads everyone else's and compares the frames both of them saw. A
  // difference is logged by every game that sees it, with that game's own detail for the frame, so two players' logs
  // side by side show what differs. It reports only: nothing is put right.
  FF.SYNC_STEP = 6; FF.SYNC_KEEP = 400; FF.SYNC_SEND = 10;
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); }
  function syncDetail() {
    var Bt = require("GamePlay/Battle/BattleJs").default.Instance.Battle, a = Bt.GetAllMainPlayers(), ps = [], self = null;
    for (var i = 0; i < a.Count; i++) {
      var p = a.get_Item(i); if (!self) self = p;
      ps.push({ k: String(p.PlayerIDForFS64), s: p.BaseID + "@" + p.Position.x.toFixed(3) + "," + p.Position.y.toFixed(3) + " d" + p.Dir + " hp" + U.FpToFloat(p.Attr.HP).toFixed(1) });
    }
    ps.sort(function (x, y) { return x.k < y.k ? -1 : 1; });
    var L = Bt.PlayerObjMgr.ActorList, n = 0, hp = 0, xs = 0;
    for (var j = 0; j < L.Count; j++) {
      var e = L.get_Item(j);
      try { if (!e || !self || e.Caster || e.IsDead || e.Faction == self.Faction) continue; n++; hp += U.FpToFloat(e.Attr.HP); xs += e.Position.x; } catch (x) {}
    }
    return ps.map(function (q) { return q.s; }).join("; ") + " | enemies " + n + " hp " + hp.toFixed(1) + " x " + xs.toFixed(2);
  }
  function syncReset() { FF.sync = { ring: {}, order: [], lastF: -1, putAt: 0, checked: 0, bad: 0, badAt: {}, errAt: 0 }; }
  if (!FF.sync) syncReset();
  FF.syncSummary = function () {
    var S = FF.sync; if (S && (S.checked || S.bad)) log("our desync check: " + S.checked + " frame(s) compared with the other players, " + S.bad + " differed");
    syncReset();
  };
  function syncTick() {
    if (!FF.inFight || !FF.began || !G.BB4L || BB4L.state != "in") return;
    var S = FF.sync, now = Date.now();
    try {
      mods(); var f = U.GetSingleton(cs.LockStepManager).m_logicFrame | 0;
      if (f != S.lastF) {
        S.lastF = f;
        if (f > 0 && f % FF.SYNC_STEP == 0) {
          var d = syncDetail(); S.ring[f] = { h: fnv(d), d: d }; S.order.push(f);
          while (S.order.length > FF.SYNC_KEEP) delete S.ring[S.order.shift()];
        }
      }
      if (now - S.putAt < 1000) return;
      S.putAt = now;
      var mine = S.order.slice(-FF.SYNC_SEND).map(function (k) { return k + ":" + S.ring[k].h; }).join(",");
      BB4L.putSync((FF.fightAt || 0) + "|" + mine);
      var all = BB4L.readSync(), me = BB4L.myId();
      Object.keys(all).forEach(function (id) {
        if (id == me) return;
        var parts = String(all[id] || "").split("|"); if (parts.length < 2 || parts[0] != String(FF.fightAt || 0)) return;
        parts[1].split(",").forEach(function (pair) {
          var q = pair.split(":"), k = parseInt(q[0]), r = S.ring[k]; if (!r || !q[1]) return;
          if (S.seen && S.seen[id + ":" + k]) return; (S.seen = S.seen || {})[id + ":" + k] = 1;
          S.checked++;
          if (q[1] == r.h) return;
          S.bad++;
          if (now - (S.badAt[id] || 0) < 10000) return;
          S.badAt[id] = now;
          var who = (BB4L.members || []).filter(function (m) { return m.id == id; })[0];
          log("DESYNC (our check): " + (who ? who.name : id) + "'s game differs from this one at frame " + k + "; this game had: " + r.d);
        });
      });
      if (S.seen && Object.keys(S.seen).length > 4000) S.seen = {};
    } catch (e) { if (now - S.errAt > 10000) { S.errAt = now; log("desync check: " + es(e)); } }
  }
  if (FF.syncTimer) clearInterval(FF.syncTimer);
  FF.syncTimer = setInterval(syncTick, 1);
  // Nobody may start the fight unable to move (Soulve, 2026-10-17: "we got in and i cant move me and boogy cant move").
  // The stock hero select locks the hero (ScriptRequire) and its own flow unlocks it later; Four Player took that flow
  // over and left the lock on. The lobby screen's lock (SpecialLogic) and a menu left open are cleared here too.
  FF.freeInput = function () {
    try {
      var U = require("Core/Util").U, F = cs.NOAH.Input.LockFlag, GI = U.GetSingleton(cs.GamePlay.GameInputManager);
      var was = GI ? "actor " + GI.ActorActionFlag + ", ui " + GI.UIActionFlag : "?";
      U.SetActorActionLock(false, F.ScriptRequire); U.SetAllActionLock(false, F.SpecialLogic);
      var T = G.BBTR, w = T && T.dm && T.dm.win; if (w) { try { require("Core/UIUtil").default.RecycleWindow(w); } catch (e) {} }
      if (G.BB4UI && G.BB4UI.isOpen) G.BB4UI.close();
      log("input at the fight's start: locks were " + was + "; now " + (GI ? "actor " + GI.ActorActionFlag + ", ui " + GI.UIActionFlag : "?") + (w ? "; a menu left open was closed" : ""));
    } catch (e) { log("free input: " + es(e)); }
  };
  FF.watch = setInterval(function () {
    try { fillLeft(); } catch (e) { log("stand-ins: " + es(e)); }
    if (!FF.inFight) return;
    if (!FF.began) {
      var fr = frameNow();
      if (fr > 0 && fr != FF.frame0) { FF.began = true; log("the fight began (" + Math.round((Date.now() - FF.joinAt) / 1000) + " s after joining)"); FF.freeInput(); }
      else if (FF.joinAt && Date.now() - FF.joinAt > FF.START_MS) { setTimeout(function () { if (FF.inFight && !FF.began) giveUp(); }, 2000); FF.joinAt = Date.now() - FF.START_MS + 5000; return; }
    }
    var cls = null; try { cls = require("GamePlay/Battle/BattleJs").default.Instance.BattleClassName; } catch (e) {}
    if (cls == "BattleTeamBreed") { FF.seenFight = Date.now(); return; }
    if (FF.seenFight && Date.now() - FF.seenFight > 3000) FF.end("left the co-op battle (now " + cls + ")");
  }, 1000);
  log("ready in window " + WIN);
  return "FOURFIGHT ready";
})();
