// The new character select (the lead, 2026-10-20: "i want them all to replace the existing base character select this
// will be the new menu ... make new special versions of this menu that you can select with LB and right bumber like you
// can select with difficulties and make special effects and vfx for EX characters Bosses and cross effect and also put a
// llock on characters that people dont own on their icon ... stillt ells you their unlock condition ... still let people
// see their characters so they can see colors and animations").
// The lobby screen's character select (fourlobbyui.js) is the menu; this file is what it needs from the game:
// - the hero groups (one tab each: Heroes, EX, Bosses, Cross Effect), from a table, not an id range (Susanoo is 193301);
// - each hero's lock, through the game's own answer (BattlePrepareUtil.GetBaseActorUnlockState, which the redux mod
//   extends), and the condition in words;
// - the official UI effects it plays (parts of the game's own effects, the mega rule);
// - the bridge to the game's own character select (SceneUIHeroSelect): when that opens, the lobby screen opens over it
//   in "solo" mode and drives it. Choosing, unlocking (ApiResourceConvert), the DLC box, Intel, Video, the wardrobe and
//   the fight all go through the game's own calls, so the server, the room camera and the run start stay the game's.
// Nothing here runs at file load beyond defining functions: the hook is made on the first timer tick (a game module
// required while the game's scripts load hung testers at boot, 2026-10-18). Log tag FOURSEL. BB4SEL.off = true (or
// BB4.newSelect === false) leaves the game's own select as it was.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, T = puerts.$typeof;
  function log(m) { B.log("FOURSEL", m); }
  var es = B.es;
  var X = G.BB4SEL = G.BB4SEL || {};
  if (X.timer) clearInterval(X.timer);

  // ---- the groups ----
  // Heroes from other games and heroes made from the game's bosses. A mod hero not listed goes with the game's cast.
  X.GROUPS = [
    { key: "heroes", name: "HEROES", label: "Heroes", col: [0.92, 0.22, 0.3], ids: null },
    { key: "ex", name: "EX", label: "EX", col: [1, 0.76, 0.3], ids: [190101, 191101] },
    { key: "boss", name: "BOSSES", label: "Bosses", col: [0.66, 0.36, 1], ids: [200401, 200301, 193301, 201101, 201501] },
    { key: "cross", name: "CROSS EFFECT", label: "Cross Effect", col: [0.42, 0.86, 1], ids: [200701, 200801, 200901, 201001, 201301] }
  ];
  // v4 (docs\redux\ui-desk\HERO_SELECT_V4.md 9.2 item 1): NaN 201501 with the bosses, Weiss 201301 with Cross Effect. Makoto 201401,
  // Oread 201601, Yuzuriha 201701 and the dev template 201201 are not placed yet and fall to Heroes until the lead places them.
  X.groupOf = function (id) {
    for (var i = 1; i < X.GROUPS.length; i++) if (X.GROUPS[i].ids.indexOf(id) >= 0) return i;
    if (id >= 190000 && id < 200000) return 1;                       // an EX variant not in the table yet
    return 0;
  };
  // every hero the game lists (owned or not), in the game's order (BaseActorConf.sortNum)
  X.list = function () {
    var out = [];
    try { require("Core/ActorUtil").default.GetListSeedHero().forEach(function (h) { var id = h && h.server && h.server.id; if (id && out.indexOf(id) < 0) out.push(id); }); }
    catch (e) { log("hero list: " + es(e)); }
    // test and paused rigs stay out (Bridget 200101, Order-Sol 200201): not heroes a player picks
    return out.filter(function (id) { return id != 200101 && id != 200201; });
  };

  // ---- the lock ----
  function loc(k, d) { try { var s = require("Core/Util").U.GetLocale(k); return s && s != k ? String(s) : d; } catch (e) { return d; } }
  function itemName(id) { return loc("Item_" + id, "item " + id); }
  // { locked, dlc, redux, item, need, have, can, special, unopened, text (one line), why (the condition, longer) }
  X.lockOf = function (id) {
    if (X.fakeLocks && B.WIN > 1 && X.fakeLocks[id]) return X.fakeLocks[id];   // test windows only: locks to record on a save that owns every hero
    var r = { locked: false, dlc: false, redux: false, item: 0, need: 0, have: 0, can: false, special: false, unopened: false, text: "", why: "" };
    var c = null; try { c = require("Gen/Xlsx").Xlsx.BaseActorConf.Get(id); } catch (e) {}
    if (c && c.unlocked === 0) { r.unopened = true; r.locked = true; r.text = "Not open yet"; r.why = "This hero is not open in this version of the game."; return r; }
    var l = null;
    try { l = require("GamePlay/BattleBreedPrepare/BattlePrepareUtil").default.GetBaseActorUnlockState(id); }
    catch (e) {                                                       // no answer: locked, so nothing unowned is played
      if (!X.lockErr) { X.lockErr = 1; log("lock of " + id + ": " + es(e)); }
      r.locked = true; r.text = "Locked"; r.why = "This hero's unlock could not be read."; return r;
    }
    if (!l || !l.locked) return r;
    r.locked = true; r.dlc = !!l.lockByDlc; r.redux = !!l.lockByRedux; r.special = !!(c && c.special);
    r.item = l.reqDecoderId | 0; r.need = l.reqDecoderCount | 0; r.have = l.hasDecoderCount | 0;
    if (r.dlc) { r.text = "DLC"; r.why = loc("Dlc_PurchaseTip", "Unlock with the hero's DLC."); return r; }
    if (r.redux) { r.why = String(l.lockByRedux); }
    else if (r.special) { r.why = loc("BaseActor_UnlockCondition_" + id, "Unlocked by the story."); }
    else if (r.item) { r.why = "Unlock with " + itemName(r.item) + " x" + r.need + "."; }
    r.can = !!r.item && !r.special && r.have >= r.need;
    r.text = r.item && !r.special ? itemName(r.item) + "  " + r.have + " / " + r.need : "Locked";
    return r;
  };

  // ---- official UI effects on a node ----
  // played as the game plays its UI effects on a node (EffectPlayParam + VFXManager); the holder is the handle: destroy
  // it to end the effect. s scales the effect (they are authored small for this canvas)
  // opt (optional, nothing changes without it): { stencil: { id, comp, pass, fail }, order: { layer, order, auto, keep } }
  // stencil: the effect's renderers all take this stencil (EffectPlayParam.ReplaceAllStencil + stencil; comp, pass and fail
  //   are UnityEngine.Rendering.CompareFunction / StencilOp names or numbers, default Always / Keep / Keep)
  // order: EffectPlayParamEx's sortingLayer (an ESortingLayer name or value), orderInLayer, AutoOrder, KeepChildOrder; the
  //   Ex class is made only when order is given. A field that will not set is logged once and the effect plays without it
  X.fx = function (parent, name, x, y, s, keep, opt) {
    try {
      var g = new UE.GameObject("FX_" + name.split("/").pop()), rt = g.AddComponent(T(UE.RectTransform)); rt.SetParent(parent, false);
      rt.anchorMin = rt.anchorMax = new UE.Vector2(0.5, 0.5); rt.anchoredPosition = new UE.Vector2(x || 0, y || 0); rt.sizeDelta = new UE.Vector2(100, 100);
      rt.localScale = new UE.Vector3(s || 1, s || 1, 1);
      var p = null;
      if (opt && opt.order) { try { p = new cs.EffectPlayParamEx(); } catch (e) { fxOpt("order class", e); } }
      if (!p) p = new cs.NOAH.VFX.EffectPlayParam();
      p.name = name; p.target = rt; p.dontStop = !!keep; p.bind = true;
      if (opt) fxOpts(p, opt);
      require("Core/Util").U.GetSingleton(cs.NOAH.VFX.VFXManager).PlayEffect(p);
      return rt;
    } catch (e) { if (!X.fxErr) { X.fxErr = 1; log("effect " + name + ": " + es(e)); } return null; }
  };
  function fxOpt(what, e) { if (!X.fxOptErr) { X.fxOptErr = {}; } if (!X.fxOptErr[what]) { X.fxOptErr[what] = 1; log("effect option " + what + ": " + es(e)); } }
  function enumOf(type, v, d) { return typeof v == "number" ? v : v == null ? d : type[v]; }
  function fxOpts(p, opt) {
    if (opt.stencil) {
      try {
        var R = cs.UnityEngine.Rendering, st = opt.stencil, sv = new cs.NOAH.Render.StencilStruct();
        sv.ID = st.id | 0; sv.CompareFunction = enumOf(R.CompareFunction, st.comp, 8); sv.PassOperation = enumOf(R.StencilOp, st.pass, 0); sv.FailOperation = enumOf(R.StencilOp, st.fail, 0);
        p.stencil = sv; p.ReplaceAllStencil = true;   // the struct is copied in on assignment: set its fields first
      } catch (e) { fxOpt("stencil", e); }
    }
    if (opt.order) {
      try {
        var o = opt.order;
        if (o.layer != null) p.sortingLayer = enumOf(cs.ESortingLayer, o.layer, 0);
        if (o.order != null) p.orderInLayer = o.order | 0;
        if (o.auto != null) p.AutoOrder = !!o.auto;
        if (o.keep != null) p.KeepChildOrder = !!o.keep;
      } catch (e) { fxOpt("order", e); }
    }
  }
  // a played effect in another colour: each part's _TintColor taken amt of the way to col at the part's own brightness
  // (its alpha and its value bands kept); on copies of the materials, so the game's own uses of the effect keep theirs.
  // False while the effect's parts have not come in yet.
  X.tint = function (h, col, amt) {
    try {
      if (!h || h.Equals(null)) return true;
      var gs = h.GetComponentsInChildren(T(UE.UI.Graphic), true); if (!gs.Length) return false;
      for (var i = 0; i < gs.Length; i++) {
        var g = gs.get_Item(i), m = g.material; if (!m || !m.HasProperty("_TintColor") || String(m.name).endsWith(" bbt")) continue;
        var t = m.GetColor("_TintColor"), l = Math.max(t.r, t.g, t.b); if (!t.a) continue;
        m = new UE.Material(m); m.SetColor("_TintColor", new UE.Color(t.r + (col[0] * l - t.r) * amt, t.g + (col[1] * l - t.g) * amt, t.b + (col[2] * l - t.b) * amt, t.a)); m.name = m.name + " bbt"; g.material = m;   // marked: a part is tinted once
      }
      return true;
    } catch (e) { if (!X.tintErr) { X.tintErr = 1; log("tint: " + es(e)); } return true; }
  };
  X.kill = function (h) { try { if (h && !h.Equals(null)) UE.Object.Destroy(h.gameObject); } catch (e) {} return null; };
  X.sfx = function (id) { try { require("Core/AudioUtil").default.PlaySoundUI(id); } catch (e) {} };

  // ---- the bridge to the game's own select ----
  function HSM() { return require("GamePlay/BattleBreedPrepare/SceneUIHeroSelect"); }
  function canvasOf(hs) { try { return hs.CsObj.GetComponent(T(UE.Canvas)); } catch (e) { return null; } }
  // the game's select hidden and deaf while ours is up; shown and listening again when handed back
  X.quiet = function (hs, on) {
    try { var cv = canvasOf(hs); if (cv) cv.enabled = !on; } catch (e) {}
    try { hs.R.inputGroup.enabled = !on; } catch (e) {}
  };
  // the game's list is the hero list: every hero (ex-common's EX page filtered it) in the game's order
  function fullList(hs) {
    try {
      var all = require("Core/ActorUtil").default.GetListSeedHero();
      if (all && all.length >= hs.listHero.length) hs.listHero = all;
    } catch (e) { log("full list: " + es(e)); }
  }
  X.index = function (hs, id) { for (var i = 0; i < hs.listHero.length; i++) if (hs.listHero[i].server.id == id) return i; return -1; };
  // the game's cursor on a hero, without its scroll (its cards are hidden): the index its calls read
  X.point = function (hs, id) {
    var i = X.index(hs, id); if (i < 0) return false;
    var R = HSM().HeroSelectRefHero; R.selectHeroIndex = i;
    try { hs.nav.movRemainTime = 0; } catch (e) {}
    return true;
  };
  X.enabled = function () { return !X.off && B.newSelect !== false && !!G.BB4UI; };
  function takeover(hs) {
    if (!X.enabled()) return;
    var S = G.BB4UI;
    try { if (cs.NOAH.Criteria.UseMobileUI) return; } catch (e) {}
    if (S.isOpen && !S.solo) { log("the lobby screen is open: the game's select is left to it"); return; }
    fullList(hs);
    X.hs = hs; X.quiet(hs, true);
    var cur = 0; try { cur = hs.listHero[HSM().HeroSelectRefHero.selectHeroIndex].server.id; } catch (e) {}
    S.openSolo({ hero: cur, pve: !!require("DataBinding").DB.CallBackToPvePrepareRoom.Value });
    log("the game's character select opened: the new select is over it (" + hs.listHero.length + " heroes, on " + cur + ")");
  }
  X.take = function (hs) { takeover(hs || (G.BB4ON && G.BB4ON.hs)); };   // a scripted check over a select already open
  X.hook = function () {
    if (X.hooked) return; X.hooked = 1;
    try {
      var P = HSM().default.prototype;
      if (!P.__bbselInit) {
        P.__bbselInit = P.Init;
        P.Init = function () {
          var r = P.__bbselInit.apply(this, arguments), me = this;
          try { if (X.enabled()) { X.quiet(me, true); setTimeout(function () { try { takeover(me); } catch (e) { log("takeover: " + es(e)); X.quiet(me, false); } }, 0); } } catch (e) { log("init: " + es(e)); }
          return r;
        };
      }
      // ex-common's EX page: the tabs replace it while the new select is on
      if (!P.__bbselEx && P.__bbExAvailable) { P.__bbselEx = P.__bbExAvailable; P.__bbExAvailable = function () { return X.enabled() ? false : P.__bbselEx.apply(this, arguments); }; }
    } catch (e) { log("hook: " + es(e)); X.hooked = 0; }
  };

  // ---- hand-offs (the solo screen calls these with the game's select in X.hs) ----
  function stockUp() { var hs = X.hs; try { return !!(hs && hs.CsObj && hs.CsObj.gameObject.activeInHierarchy); } catch (e) { return false; } }
  X.stockUp = stockUp;
  function back(ok) { var S = G.BB4UI; if (S && S.solo) S.soloBack(ok); }
  // Back: the game's own way out of its select (its camera back to the room, the hero free)
  X.leave = function () {
    var hs = X.hs; if (!hs) return;
    // the game's own select stays unseen through its close sequence (it flashed over the new one on the way out: the lead,
    // 2026-11-10); its input comes back now, its canvas once the sequence is over and only if it was not opened again
    // (a disabled canvas through the close left the player unable to move afterwards: the canvas is on again, as the
    // game expects, and a CanvasGroup keeps it unseen for the 1.5 s of its close)
    var cg = null; try { var cv = canvasOf(hs); if (cv) { cg = cv.gameObject.GetComponent(T(UE.CanvasGroup)) || cv.gameObject.AddComponent(T(UE.CanvasGroup)); cg.alpha = 0; } } catch (e) {}
    X.quiet(hs, false);
    setTimeout(function () { try { if (cg && !cg.Equals(null)) cg.alpha = 1; } catch (e) {} }, 1500);
    try { hs.nav.movRemainTime = 0; hs.actorLoaded = false; } catch (e) {}
    // a select the game opened with a way back of its own (the DBS labs story: a prep room, OnHeroSelectClose teleports
    // to the lab) closes as its own Back button does; Sky City keeps OnBackClick
    try { if (require("DataBinding").DB.CallBackToPvePrepareRoom.Value || hs.OnHeroSelectClose) hs.CloseHeroSelect(); else hs.OnBackClick(); } catch (e) { log("back: " + es(e)); }
    X.hs = null;
  };
  // the hero, then the Legacies (Evotype records, or null), then the fight: the game's own steps, its screens hidden
  X.go = async function (id, evos) {
    var hs = X.hs; if (!hs) return false;
    if (!X.point(hs, id)) { log("go: hero " + id + " is not in the game's list"); return false; }
    // never a hero the player does not own: the lock, and the game's own mark on a stock hero it has not given them
    var lk = X.lockOf(id), en = hs.listHero[X.index(hs, id)];
    if (lk.locked || (id < 190000 && en && en.fake)) { log("go: refused, " + id + " is locked"); return false; }
    var DB = require("DataBinding").DB;
    var noEvo = false; try { noEvo = hs.CheckDirectToFight(); } catch (e) {}
    if (noEvo || !evos) {                                             // no Evotypes saved: the game starts straight from the hero
      try { hs.OnConfirmClick(); } catch (e) { log("confirm: " + es(e)); return false; }
      return took(hs);
    }
    hs.RefreshTeamData();
    var td = DB.TeamData.Value; td.factors = new Map(); td.realSelectFactorList = [];
    var n = 0;
    evos.forEach(function (ev) {
      if (!ev || !ev.uid) return;
      var fa = null; DB.FesActor.Values().forEach(function (x) { if (x && x.server && x.server.uid == ev.uid) fa = x; });
      if (!fa) { log("go: Evotype " + ev.uid + " is not saved here"); return; }
      td.factors.set(n, fa); td.realSelectFactorList.push(fa.server.uid); n++;
    });
    log("go: hero " + id + ", " + n + (n == 1 ? " Legacy" : " Legacies") + (DB.CallBackToPvePrepareRoom.Value ? " (back to the team room)" : ""));
    if (DB.CallBackToPvePrepareRoom.Value) { DB.CallBackToPvePrepareRoom.Value(); return took(hs); }
    // 0.1.7 (Boogy, 2026-11-09: "Her entrance animation plays twice ... when you don't take an evotype"): with no Legacy the
    // game's own way is its straight-to-fight path (SceneUIHeroSelect.OnBtnFightHold: ChangeAvatarToHero(false), no
    // "pvp_born", then EnterFight), so the run's own entrance is the only one. With a Legacy the stock order stays: the
    // hero's entrance, then the fight
    if (!n) {
      try { await hs.ChangeAvatarToHero(!1); } catch (e) { log("avatar: " + es(e)); }
      DB.CsEvent.Notify("BreedPrepare", "EnterFight");
      return took(hs);
    }
    X.sfx("sfx_ui_53");
    try { await hs.ChangeAvatarToHero(!0); } catch (e) { log("avatar: " + es(e)); }
    await new Promise(function (r) { setTimeout(r, 500); });
    X.sfx("sfx_ui_38_p2");
    DB.CsEvent.Notify("BreedPrepare", "EnterFight");
    return took(hs);
  };
  // the game took the pick when its select closes (or its own Legacy screen comes up) within 4 s; else the pick is
  // handed back to the new select (a tutorial's override, the game's own refusal)
  function took(hs) {
    var t0 = Date.now();
    return new Promise(function (res) {
      var iv = setInterval(function () {
        var up = true; try { up = !!(hs.CsObj && hs.CsObj.gameObject.activeInHierarchy); } catch (e) { up = false; }
        var fes = G.BB4ON && Date.now() - (G.BB4ON.fesSeen || 0) < 300;
        if (!up || fes) { clearInterval(iv); X.hs = null; res(true); }
        else if (Date.now() - t0 > 4000) { clearInterval(iv); log("go: the game's select is still up: the pick goes back to the new select"); res(false); }
      }, 50);
    });
  }
  // hold to unlock, as the game's own: ApiResourceConvert for the hero, the change pack applied, the hero owned
  X.unlock = async function (id) {
    if (X.fakeLocks && B.WIN > 1 && X.fakeLocks[id]) { delete X.fakeLocks[id]; log("unlocked " + id + " (test lock)"); return true; }
    var hs = X.hs;
    // a multiplayer lobby has no stock select (Geokit, 2026-10-22: "In a multiplayer lobby, I can't use the Prototype
    // analyizer"): the same request goes through the game's global owner, after the select's own checks
    // (CheckHeroCanUnlock: listed as unlockable, locked, not held by a DLC, enough analyzers)
    if (hs && !X.point(hs, id)) hs = null;
    if (!hs) {
      var st = null, XL = require("Gen/Xlsx").Xlsx;
      try { st = require("GamePlay/BattleBreedPrepare/BattlePrepareUtil").default.GetBaseActorUnlockState(id); } catch (e) { log("unlock " + id + ": " + es(e)); return false; }
      var conf = XL.BaseActorConf.Get(id);
      if (!st || !conf || conf.unlocked == 0 || !st.locked || st.lockByDlc) { log("unlock " + id + ": not unlockable here (" + (st ? "locked " + st.locked + ", dlc " + st.lockByDlc : "no state") + ")"); return false; }
      if (st.reqDecoderId != 0 && st.reqDecoderCount > st.hasDecoderCount) { log("unlock " + id + ": " + st.hasDecoderCount + " of " + st.reqDecoderCount + " analyzers"); return false; }
    } else if (hs.OnUnlockHeroOverride && !hs.OnUnlockHeroOverride()) return false;
    var CRS = require("Server/Struct/ClientRequestStruct").ClientApiResourceConvert.ApiResourceConvert, DB = require("DataBinding").DB;
    var q = new CRS.post.req; q.targetId = id; q.num = 1;
    var owner = hs || require("Core/Util").U.GetSingleton(require("Manager/TsGameGlobal").default);
    var res = await owner.Request(CRS).PostAsync(q);
    if (!res || !res.res) { log("unlock " + id + ": no answer"); return false; }
    require("Core/ResourceChange").RC.UpdateChanges(res.res.resChange.list);
    var d = DB.BaseActor.GetData(id); if (!d) { log("unlock " + id + ": not owned after the request"); return false; }
    d.fake = false;
    log("unlocked " + id + (hs ? "" : " (no stock select: the global request)"));
    if (!hs) return true;
    var i = X.index(hs, id); if (i >= 0) hs.listHero[i] = d;
    try { if (require("Core/ResourceUtil").default.GetCount(cs.EResourceType.Item, 4001) > 0 || id >= 190000) hs.PlayUnlockSoundUi && hs.PlayUnlockSoundUi(d); } catch (e) {}
    return true;
  };
  X.dlc = function (id) { var hs = X.hs; if (hs && X.point(hs, id)) { try { hs.ShowDlcBox(); return true; } catch (e) { log("dlc: " + es(e)); } } return false; };
  X.voice = function (id) { var hs = X.hs; if (!hs) return; var i = X.index(hs, id); if (i < 0) return; try { hs.PlayIntroSoundUi(hs.listHero[i]); } catch (e) {} };
  X.hasMovie = function (id) { return id < 190000; };              // mod heroes have no intro movies
  // a stock window over the select (Intel, Video, the wardrobe): ours steps aside and comes back when it closes
  function after(test, done, what) {
    var t0 = Date.now(), seen = false;
    var iv = setInterval(function () {
      var up = false; try { up = test(); } catch (e) {}
      if (up) seen = true;
      if ((seen && !up) || (!seen && Date.now() - t0 > 4000) || Date.now() - t0 > 600000) { clearInterval(iv); log(what + (seen ? " closed" : " did not open")); done(seen); }
    }, 16);   // every frame: the game shows its own select again the frame its screen closes
  }
  X.detail = function (id) {
    var hs = X.hs; if (!hs || !X.point(hs, id)) return false;
    var DU = require("Window/CurrentActorDetail/CurrentActorDetailUtil");
    try { hs.EnterBaseActorDetail(); } catch (e) { log("Intel: " + es(e)); return false; }
    // the game turns its select's controls back on as Intel closes (DB.UIDirty.BackFromActorDetail)
    var UIU = require("Core/UIUtil").default, W = require("Window/CurrentActorDetail/CurrentActorDetail").default;
    after(function () { return !!UIU.FindWindow(W); }, function () { X.quiet(hs, true); back(true); }, "Intel");
    return true;
  };
  X.movie = function (id) {
    var hs = X.hs; if (!hs || !X.point(hs, id) || !X.hasMovie(id)) return false;
    var W = require("Window/BaseActorDetail").default, UIU = require("Core/UIUtil").default;
    try { hs.RefreshTeamData(); W.TryOpenPlayMovie(); } catch (e) { log("Video: " + es(e)); return false; }
    after(function () { var w = UIU.FindWindow(W); return !!w; }, function () { X.quiet(hs, true); back(true); }, "Video");
    return true;
  };
  // the wardrobe: the hero stands in the room, animated, in each palette (the game's own palette screen, as its Legacy
  // screen opens it); on close the room's avatar comes back
  X.wardrobe = async function (id) {
    var hs = X.hs; if (!hs || !X.point(hs, id)) return false;
    var UIU = require("Core/UIUtil").default, BP = UIU.FindWindow(require("Window/BreedPrepareUI").default);
    if (!BP) { log("wardrobe: no prep window"); return false; }
    hs.RefreshTeamData();
    try { await hs.ChangeAvatarToHero(!0); } catch (e) { log("wardrobe avatar: " + es(e)); }
    await avatarIs(id);
    try { BP.OpenSceneUISkinSelect(); } catch (e) { log("wardrobe: " + es(e)); restoreAvatar(); return false; }
    after(function () { return !!(BP.uiChangeSkinObj && BP.uiChangeSkinObj.activeSelf); }, function () {
      setTimeout(function () { restoreAvatar(); X.quiet(hs, true); back(true); }, 450);   // its closing camera move first
    }, "wardrobe");
    return true;
  };
  // the new colour selector (the lead, 2026-10-20: "make a new color selector"): the game's wardrobe runs underneath for
  // its camera, the hero standing in the room, the palette maker's colours and the save; its own strip is hidden and the
  // lobby screen's panel drives it. Resolves to { w: the widget, n: its colour nodes, i: the worn one } or null
  // 0.1.7 (MonoMusa, 2026-11-09: "Going to colors will show the character you've previously chosen instead of the one
  // you're currently on"): the avatar swap loads the new hero over a few frames, and the wardrobe takes whatever stands in
  // the room when it opens, which was still the hero picked before. It now waits (up to 3 s) for the room's hero to be
  // this one
  async function avatarIs(id) {
    var BJ = require("GamePlay/Battle/BattleJs").default;
    for (var k = 0; k < 60; k++) {
      var ps = null; try { ps = BJ.Instance.Battle.PlayerSelf; } catch (e) { ps = null; }
      var bid = 0; try { bid = ps ? ps.BaseID : 0; } catch (e) { bid = 0; }
      if (bid == id) { if (k) log("avatar: " + id + " in the room after " + (k * 50) + " ms"); return true; }
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    log("avatar: the room's hero is still not " + id + " after 3 s"); return false;
  }
  X.avatarIs = avatarIs;
  X.colours = async function (id) {
    var hs = X.hs; if (!hs || !X.point(hs, id)) return null;
    var UIU = require("Core/UIUtil").default, BP = UIU.FindWindow(require("Window/BreedPrepareUI").default);
    if (!BP) { log("colours: no prep window"); return null; }
    hs.RefreshTeamData();
    try { await hs.ChangeAvatarToHero(!0); } catch (e) { log("colours avatar: " + es(e)); }
    await avatarIs(id);
    try { BP.OpenSceneUISkinSelect(); } catch (e) { log("colours: " + es(e)); restoreAvatar(); return null; }
    for (var k = 0; k < 60; k++) {                      // its nodes are made over a few frames
      await new Promise(function (r) { setTimeout(r, 50); });
      // the wardrobe keeps its nodes from one hero to the next and only shows as many as this hero has colours
      // (confList): a hero with fewer colours than the last one showed the last one's extra colour at the end
      var w = BP.widgetChangeSkin, n = w && w.colorNodes ? w.colorNodes.slice(0, w.confList ? w.confList.length : w.colorNodes.length).filter(function (x) { return x && x.cfg; }) : [];
      if (n.length && BP.uiChangeSkinObj && BP.uiChangeSkinObj.activeSelf) {
        X.colourCanvases(BP, false);
        var i = n.findIndex(function (x) { return x.IsSelected(); });
        log("colours: " + n.length + " for " + id);
        return { w: w, n: n, i: i < 0 ? 0 : i, bp: BP };
      }
    }
    log("colours: the wardrobe did not come up"); X.coloursEnd(null, false); return null;
  };
  // the wardrobe's own strip, name and prompts (its canvases): off while our panel shows
  X.colourCanvases = function (BP, on) {
    try { var cv = BP.uiChangeSkinObj.GetComponentsInChildren(T(UE.Canvas), true); for (var i = 0; i < cv.Length; i++) cv.get_Item(i).enabled = on; } catch (e) { log("colour canvases: " + es(e)); }
    // and the game's button hints at the bottom, which the wardrobe brings up (our prompt row says the buttons)
    try { var ins = UE.GameObject.Find("SingletonOrganizer/(Singleton)_UIManager/CanvasRoot/WindowOverlay/Instructions") || X.insGo; if (ins) { X.insGo = ins; var c2 = ins.GetComponent(T(UE.Canvas)); if (c2) c2.enabled = on; } } catch (e) { log("hints: " + es(e)); }
  };
  // the colour under the cursor, on the hero in the room (the game's own selection, which previews it)
  X.colourPick = function (c, i) { try { c.n.forEach(function (x, j) { if (j != i && x.IsSelected()) x.SetSelected(false); }); c.n[i].SetSelected(true); c.i = i; } catch (e) { log("colour pick: " + es(e)); } };
  // wear: the game's own submit (saves an owned colour, then closes); else Back puts the worn colour back
  X.coloursEnd = function (c, wear) {
    return new Promise(function (res) {
      try {
        if (c) { X.colourCanvases(c.bp, true); if (wear) c.w.OnSubmit(); else c.w.RevertAndClose(); }
        else { var BP = require("Core/UIUtil").default.FindWindow(require("Window/BreedPrepareUI").default); if (BP && BP.widgetChangeSkin) BP.widgetChangeSkin.RevertAndClose(); }
      } catch (e) { log("colours end: " + es(e)); }
      setTimeout(function () { restoreAvatar(); try { if (X.hs) X.quiet(X.hs, true); } catch (e) {} res(true); }, 560);   // its closing camera move first
    });
  };
  X.colourInfo = function (cfg) {
    var r = { name: "", owned: true, dlc: false, why: "", col: [1, 1, 1] };
    try { r.name = String(require("Core/ResourceUtil").default.GetActorSkinName(cfg.id, !1) || ""); } catch (e) {}
    try { r.owned = require("GamePlay/AvatarUtil").AvatarUtil.IsSkinUnlocked(cfg.id); } catch (e) {}
    try { var h = String(cfg.color || "").replace("#", ""); if (h.length >= 6) r.col = [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; } catch (e) {}
    if (cfg.__pal) { r.owned = true; return r; }                 // the palette maker's own colours are always worn
    if (!r.owned) {
      try {
        var AU = require("GamePlay/AvatarUtil"), u = (AU.SkinUtil.GetUnlockInfo ? AU.SkinUtil : AU.AvatarUtil).GetUnlockInfo(cfg.id), RT = require("Gen/pbdef").EResourceUnlockType;
        r.dlc = !!(u && RT && (u.firstUnlockType == RT.Dlc || u.firstUnlockType == RT.Shop));
        r.why = u && u.helpText ? String(u.helpText) : "";
        if (!r.why && u && u.cost) { var nm = String(require("Core/ResourceUtil").default.GetName(u.cost.type, u.cost.id) || ""); if (nm) r.why = "Unlock with " + nm + " x" + u.cost.count + " in the wardrobe."; }
      } catch (e) {}
      if (!r.why) r.why = r.dlc ? "Comes with a DLC." : "Locked.";
    }
    return r;
  };
  X.colourDlc = function (cfg) { try { var U = require("Core/Util").U, d = U.GetSkinDLCId(cfg.id); if (d > 0) { U.ShowPurchaseDlcDiaBoxById(d); return true; } } catch (e) { log("colour DLC: " + es(e)); } return false; };

  // ---- Mind Crystals (the lead, 2026-10-20: "make ... a new menu for mind crystals"): the game's own list (the
  // ConsciousEquip window's Crystal class), slots and requests, the same calls its window makes ----
  function req(name, fill) {
    var CRS = require("Server/Struct/ClientRequestStruct"), A = CRS["Client" + name][name], q = new A.post.req; fill(q);
    var TG = require("Manager/TsGameGlobal").default;
    return require("Core/Util").U.GetSingleton(TG).Request(A).PostAsync(q);
  }
  X.crystalOpen = function () {
    try { return !require("Window/Conscious/ConsciousUtil").ConsciousUtil.IsConsciousSlotLocked(); } catch (e) { log("crystal lock: " + es(e)); return true; }
  };
  X.crystals = function () {
    var DB = require("DataBinding").DB, Xl = require("Gen/Xlsx").Xlsx, out = { level: 0, slots: [], list: [], attr: "" };
    try { var cv = DB.Player.Conscious.Value; out.level = cv.level | 0; var m = cv.slotCrystalMap || {};
      Xl.ConsciousCrystalSlotConf.All.forEach(function (s) { out.slots.push({ n: String(s.id), at: s.unlockLevel | 0, open: (s.unlockLevel | 0) <= out.level, id: (m[String(s.id)] | 0) }); });
    } catch (e) { log("crystal slots: " + es(e)); }
    try { out.list = require("Window/Conscious/ConsciousEquip").Crystal.GetAllCrystal(); } catch (e) {
      // the game's call reads the crystal tasks, which a session without them (no quests loaded yet) does not have: build the
      // same list without the unlock tasks
      log("crystal list: " + es(e));
      try { var Cr = require("Window/Conscious/ConsciousEquip").Crystal, pid = require("Core/Util").U.GetCrystalPoolId();
        Xl.ConsciousCrystalPool.All.forEach(function (t) { if (t.poolId != pid) return; var c = new Cr(); c.Id = t.crystalId; c.Priority = t.priority; c.Update(); out.list.push(c); });
        out.list.sort(function (a, b) { return a.Priority - b.Priority; });
      } catch (e2) { log("crystal list fallback: " + es(e2)); }
    }
    try { if (out.level > 0) { var a = Xl.ConsciousLevelConf.Get(out.level).attr, parts = []; a.forEach(function (x) { if (x.type == 2) parts.push("Max HP +" + Math.round(x.value * 100) + "%"); if (x.type == 124) parts.push("Healing flask +" + Math.round(x.value * 100) + "%"); }); out.attr = parts.join("   ·   "); } } catch (e) {}
    return out;
  };
  X.crystalIcon = function (id) {
    try { var nm = "IconConsciousness_" + id, p = null;
      /* a mod's crystal: its icon is named in the loader's alias table ("atlas path|sprite"), as the stock screens read it */
      try { var al = require("Example").ModRegistry.spriteAlias[nm]; if (al && String(al).indexOf("|") > 0) { p = String(al).split("|")[0]; nm = String(al).split("|")[1]; } } catch (e0) {}
      if (!p) p = require("Core/I18nUtils").default.ConsciousIcon.GetAtlasPath(nm, null);
      var s = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.Sprite), p, nm); return s && !s.Equals(null) ? s : null; } catch (e) { return null; }
  };
  X.crystalName = function (id) { try { return String(require("Core/Util").U.GetLocale("ConsciousCrystal_" + id)); } catch (e) { return "Mind Crystal " + id; } };
  X.crystalCond = function (c) {
    try { var l = c.Conf, r = require("GamePlay/GameAchievement/GameAchievementUtil").default.GetAchievementTargetImpl(l.type, l.params, l.maxProgress, c.Task ? c.Task.id : void 0);
      return String(r) + " (" + (c.Task ? c.Task.progress | 0 : 0) + "/" + l.maxProgress + ")"; } catch (e) { return ""; }
  };
  X.costText = function (cost) {
    try { var RU = require("Core/ResourceUtil").default; return cost.map(function (x) { var have = RU.GetCount(x.type, x.id); return String(RU.GetName(x.type, x.id)) + " " + x.count + (have < x.count ? " <color=#ff6a66>(" + have + ")</color>" : ""); }).join("   ·   "); } catch (e) { return ""; }
  };
  // the whole slot map, as the game's window sends it; the answer is what the server kept
  X.crystalSlots = async function (map) {
    var DB = require("DataBinding").DB;
    try { var a = await req("ApiConsciousModifyCrystalSlot", function (q) { q.slotCrystalMap = map; });
      if (!a || !a.res) { log("crystal slots refused"); return false; }
      DB.Player.Conscious.Value.slotCrystalMap = a.res.slotCrystalMap; DB.Player.Conscious.Notify();
      for (var k in map) { var d = DB.ConsciousCrystal.GetData(map[k] | 0); if (d) d.equiped = true; }
      return true;
    } catch (e) { log("crystal slots: " + es(e)); return false; }
  };
  X.crystalEquipFlags = function (old, map) {
    var DB = require("DataBinding").DB, now = {}; for (var k in map) if (map[k]) now[map[k] | 0] = 1;
    for (var j in old) { var id = old[j] | 0; if (id && !now[id]) { var d = DB.ConsciousCrystal.GetData(id); if (d) d.equiped = false; } }
  };
  X.crystalLevelUp = async function (c) {
    try { var a = await req("ApiConsciousCrystalLevelUp", function (q) { q.id = c.Id; q.targetLevel = c.Level + 1; });
      if (!a || !a.res) return false; require("Core/ResourceChange").RC.UpdateChanges(a.res.resChange.list); return true; } catch (e) { log("crystal level: " + es(e)); return false; }
  };
  X.crystalUnlock = async function (c) {
    try { var a = await req("ApiConsciousGetNewCrystal", function (q) { q.id = c.Id; });
      if (!a || !a.res) return false; require("Core/ResourceChange").RC.UpdateChanges(a.res.resChange.list); return true; } catch (e) { log("crystal unlock: " + es(e)); return false; }
  };
  X.restoreAvatar = function () { restoreAvatar(); };

  function restoreAvatar() {
    try {
      var BJ = require("GamePlay/Battle/BattleJs").default.Instance, DB = require("DataBinding").DB, av = DB.Player.Avatar.Value, pos = BJ.Battle.PlayerSelf.Position;
      BJ.SetAvatarSelf(av, pos); BJ.SetAvatarSkin(av); BJ.Battle.PlayerSelf.UpdatgeVisualScale(0.65);
      require("Core/Util").U.SetActorActionLock(!0);             // the select keeps the hero still, as the game's does
    } catch (e) { log("avatar back: " + es(e)); }
  }

  // hooked once fouronline.js has hooked the same class: the module is loaded by then, so nothing new loads while the game
  // starts (0.3.19 and 0.3.21 hung at boot on a module loaded early)
  if (X.timer) clearInterval(X.timer);
  X.timer = setInterval(function () { try { if (G.BB4ON && G.BB4ON.hooked) { X.hook(); if (X.hooked) { clearInterval(X.timer); X.timer = null; } } } catch (e) {} }, 500);
  return "FOURSEL ready";
})();
