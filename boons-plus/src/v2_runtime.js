
/* ===== Boons Plus v2 runtime (Water "Tides" / Radiation "Decay") -- appended to PlayerTriggerFuncs by bbmod =====
   Generated tables come first (build_v2.py): BP2_TRIG (trigger id -> Tactic key), BP2_RT (tuning), BP2_FX (effects),
   BP2_BUFF (buff ids), BP2_VERSION, BP2_LOG, BP2_DEBUG.
   ExternCall invokes trigFuncs[name](actor, triggerNode, params, payload); payload = ActorHitResult for hit triggers.
   Rules that keep online co-op in step: only BATTLE time (BattleBase.BattleTimeFp), never wall time or random
   numbers in anything that changes the fight; all state is per owner (player uid) and per battle. */
var BP2X = (function () {
  var CS = csharp_1, U = Util_1.U, LOG = (typeof BP2_LOG === "string" ? BP2_LOG : ""), DEBUG = (typeof BP2_DEBUG === "boolean" ? BP2_DEBUG : false);
  var warned = {}, lines = 0, CAP = 4000;
  var buf = [], flushed = -1;
  function write() { if (!buf.length) return; var s = buf.join(""); buf = []; try { CS.System.IO.File.AppendAllText(LOG, s) } catch (x) {} }
  /* debug lines are buffered: written once a second on the battle clock (flush, from the poll), or at 40 lines */
  function log(m) { if (!DEBUG || !LOG || lines > CAP) return; lines++; buf.push((new Date()).toISOString() + " BP2 " + m + "\n"); if (buf.length >= 40) write() }
  function flush(tn) { if (buf.length && (!(tn >= 0) || tn < flushed || tn - flushed >= 1)) { flushed = tn >= 0 ? tn : -1; write() } }
  function once(k, m) { if (!warned[k]) { warned[k] = 1; var d = DEBUG; DEBUG = true; log(m); DEBUG = d; write() } }   // warnings always log once, at once
  function uid(a) { try { return a ? a.UniqueId : -1 } catch (x) { return -1 } }
  function f(v) { try { return U.FpToFloat(v) } catch (x) { return NaN } }
  function fp(n) { return U.FloatToFp(n) }
  /* battle clock only; unreadable -> NaN and the caller skips (no wall-clock fallback: it would desync co-op) */
  function now() { try { return U.FpToFloat(CS.GamePlay.BattleBase.Cur.BattleTimeFp) } catch (x) { once("clock", "battle clock unreadable: " + x); return NaN } }
  function pos(a) { try { var v = a.Position; return { x: v.x, y: v.y } } catch (x) { return null } }
  function dist(a, b) { var p = pos(a), q = pos(b); return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity }
  function maxHp(a) { try { return f(a.Attr.MaxHp) } catch (x) { return 0 } }
  function tags(a) { try { return a.TagMgr } catch (x) { return null } }
  function isBoss(a) { var g = tags(a); try { return !!g && (g.HasTag("boss") || g.HasTag("Boss") || g.HasTag("EliteBoss") || g.HasTag("FinalBoss")) } catch (x) { return false } }
  function isElite(a) { var g = tags(a); try { return !!g && (g.HasTag("elite") || g.HasTag("Elite")) } catch (x) { return false } }
  /* can hits move it (NoHitFly = 1, FixPosition = 5)? Unknown -> treat as immovable (boss rules, never a shove) */
  function launchable(a) { try { var at = a.Attr; return !(at.GetResistance(1) || at.GetResistance(5)) } catch (x) { once("res", "GetResistance EXC " + x); return false } }
  function invincible(a) { try { return (a.ActionMgr && a.ActionMgr.Attr && a.ActionMgr.Attr.Invincipal > 0) || (a.BuffMgr && a.BuffMgr.BuffAttr && a.BuffMgr.BuffAttr.Invincipal > 0) } catch (x) { return false } }
  function fp2(x, y) { return U.Vector2ToFp2(new CS.UnityEngine.Vector2(x, y)) }
  /* how far the ground is below a point (m): BattleUtils.GroundHeight casts a ray straight down and returns the hit
     distance, or maxDist when nothing is below (disassembly, 2026-09-30); 0 if unreadable */
  function ground(q) {
    var M = typeof BP2_RT === "object" && BP2_RT.airMax > 0 ? BP2_RT.airMax : 30;
    try { var h = f(CS.GamePlay.BattleUtils.GroundHeight(fp2(q.x, q.y), fp(M), false)); return h > 0 ? Math.min(h, M) : 0 }
    catch (x) { once("ground", "GroundHeight EXC " + x); return 0 }
  }
  /* how far a straight line runs before it meets the level (floor, wall, ceiling): BattleUtils.RayCastGround(from, dir,
     dist, layerMask 0, defaultPhysics false) -> RaycastHit2DWarp { collider, distance, ... } (dump, 2026-10-04; its
     straight-down case is GroundHeight). Nothing in the way, or unreadable: dist. NOT yet tried in the game. */
  function ray(x, y, dx, dy, dist) {
    try {
      var h = CS.GamePlay.BattleUtils.RayCastGround(fp2(x, y), fp2(dx, dy), fp(dist), 0, false);
      if (h && h.collider) { var d = f(h.distance); if (d >= 0 && d <= dist) return d }
      return dist;
    } catch (x2) { once("ray", "RayCastGround EXC " + x2 + " (jets run their full length)"); return dist }
  }
  function addVel(a, vx, vy) { try { a.ActorPosition.AddVelocity(fp2(vx, vy)); return true } catch (x) { once("vel", "AddVelocity EXC " + x); return false } }
  function enemies(p) {
    var out = [];
    try {
      var L = CS.GamePlay.BattleBase.Cur.PlayerObjMgr.ActorList, fa = p.Faction;
      for (var i = 0; i < L.Count; i++) { var a = L.get_Item(i); try { if (a && a.Faction !== fa && !a.IsDead && a.BuffMgr) out.push(a) } catch (x) {} }
    } catch (x) { once("enem", "enemy scan EXC " + x) }
    return out;
  }
  function ownedBy(b, owner) { try { var rc = b.RootCaster || b.Caster; return !!rc && uid(rc) === uid(owner) } catch (x) { return false } }
  function has(a, idx, owner) { try { var b = a.BuffMgr.Find(idx); return !!b && ownedBy(b, owner) } catch (x) { return false } }
  function stacks(a, idx, owner) { try { var b = a.BuffMgr.Find(idx); return b && ownedBy(b, owner) ? b.Stack : 0 } catch (x) { return 0 } }
  function stacksAny(a, idx) { try { var b = a.BuffMgr.Find(idx); return b ? b.Stack : 0 } catch (x) { return 0 } }
  function dead(a) { try { return !a || a.IsDead } catch (x) { return true } }
  /* the buff's timer from zero again, in place (public Buff.TimeEllapsed setter) */
  function restart(a, idx) { try { var b = a.BuffMgr.Find(idx); if (b) b.TimeEllapsed = fp(0) } catch (x) { once("rst_" + idx, "restart " + idx + " EXC " + x) } }
  function remove(a, idx) { try { if (a.BuffMgr.Find(idx)) a.BuffMgr.Remove(idx) } catch (x) {} }
  /* a stack count in place (no re-add: its effects keep running, nothing replays) */
  function setStack(a, idx, n) {
    try { if (n <= 0) { remove(a, idx); return true } a.BuffMgr.ChangeBuffStack(idx, n); return true }
    catch (x) { once("stk_" + idx, "ChangeBuffStack " + idx + " EXC " + x); return false }
  }
  function add(a, idx, dur, str, n, owner) { try { a.BuffMgr.AddBuff(idx, fp(dur), fp(str), n, owner); return true } catch (x) { once("add_" + idx, "AddBuff " + idx + " EXC " + x); return false } }
  /* a new battle: the clock or the actor-id generator went backwards (ids and sessions restart per battle) */
  var ep = { n: 0, t: -1, gen: -1 }, resets = [];
  function epoch() {
    var t = -1, gen = -1;
    try { var c = CS.GamePlay.BattleBase.Cur; t = U.FpToFloat(c.BattleTimeFp); gen = c.m_ActorUniqueIdGen } catch (x) { return ep.n }
    if ((ep.t >= 0 && t < ep.t - 0.05) || (ep.gen >= 0 && gen < ep.gen)) {
      ep.n++; log("battle " + ep.n + ": per-battle state reset");
      for (var i = 0; i < resets.length; i++) { try { resets[i]() } catch (x) { once("reset" + i, "reset EXC " + x) } }
    }
    ep.t = t; ep.gen = gen; return ep.n;
  }
  function onReset(fn) { resets.push(fn) }
  return { log: log, once: once, flush: flush, uid: uid, f: f, fp: fp, now: now, pos: pos, dist: dist, maxHp: maxHp, isBoss: isBoss, isElite: isElite,
           launchable: launchable, invincible: invincible, addVel: addVel, enemies: enemies, has: has, stacks: stacks, remove: remove,
           add: add, epoch: epoch, onReset: onReset, stacksAny: stacksAny, dead: dead, setStack: setStack, restart: restart, ground: ground, ray: ray };
})();

/* ---- Water = the engine's element 9. Every actor's element arrays grow from 9 to 11 slots before its first Water
   hit (hero at battle start, monsters at spawn through a monster env trigger re-added each stage, a sweep as a
   safety net); nothing in a battle replaces them. Proven in game (bp-proofs, 2026-09-28). */
var BP2W = (function () {
  var CS = csharp_1, X = BP2X, T = {};
  function typ(n) {
    if (!T[n]) T[n] = n === "Fp" ? puerts.$typeof(CS.Unity.Mathematics.FixedPoint.Fp) : n === "Bool" ? puerts.$typeof(CS.System.Boolean) : puerts.$typeof(CS.UnityEngine.Color);
    return T[n];
  }
  function grow(arr, t, n) { if (!arr || arr.Length >= n) return arr; var a = CS.System.Array.CreateInstance(t, n); CS.System.Array.Copy(arr, a, arr.Length); return a }
  function widen(a) {
    try {
      var b = a && a.BuffMgr && a.BuffMgr.BuffAttr; if (!b) return false;
      if (b.ElementBeHitMissProb.Length >= 11 && b.ElementHitMissProb.Length >= 11 && b.ElementWeakness.Length >= 11) return true;
      b.ElementBeHitMissProb = grow(b.ElementBeHitMissProb, typ("Fp"), 11);
      b.ElementHitMissProb = grow(b.ElementHitMissProb, typ("Fp"), 11);
      b.ElementWeakness = grow(b.ElementWeakness, typ("Bool"), 11);
      try { if (a.Statistics) a.Statistics.ElementDamage = grow(a.Statistics.ElementDamage, typ("Fp"), 11) } catch (x) { X.once("statw", "statistics widen EXC " + x) }
      return true;
    } catch (x) { X.once("widen", "widen EXC " + x); return false }
  }
  function sweep(p) { var L = X.enemies(p); for (var i = 0; i < L.length; i++) widen(L[i]) }
  function env() {
    try { var mgr = CS.GamePlay.BattleBase.Cur.MonsterEnvTriggerMgr; if (!mgr.Find(BP2_RT.envTrigger)) mgr.Add(new CS.GamePlay.MonsterEnvTrigger(BP2_RT.envTrigger, 1)) }
    catch (x) { X.once("env", "monster env trigger EXC " + x) }
  }
  return { widen: widen, sweep: sweep, env: env };
})();

/* ---- world effects: the Unity-kit prefabs (bbvfx importer), played at a point; mirror flips horizontally */
var BP2F = (function () {
  var CS = csharp_1, X = BP2X;
  function play(key, x, y, scale, mirror, life, sy, rot) {
    var res = BP2_FX[key]; if (!res) return null;
    try {
      var sc = CS.GamePlay.BattleBase.Cur.BattleScene; if (!sc) return null;
      var s = scale || 1;
      return sc.StartSceneEffect(res, new CS.UnityEngine.Vector2(x, y), new CS.UnityEngine.Vector2(mirror ? -s : s, sy || s), rot || 0, life || 0);
    } catch (e) { X.once("fx_" + key, "effect " + res + " EXC " + e); return null }
  }
  function at(key, a, dy, scale, mirror) { var q = X.pos(a); return q ? play(key, q.x, q.y + (dy || 0), scale, mirror) : null }
  /* stop a held effect early (a looping one started with a lifetime) */
  function stop(h) { if (!h) return; try { CS.GamePlay.BattleBase.Cur.BattleScene.StopSceneEffect(h, false) } catch (e) { X.once("fxstop", "StopSceneEffect EXC " + e) } }
  /* move a playing effect to (x, y) over `dur` s with DOTween, so the engine drives it every frame */
  function fly(h, x, y, dur) {
    try { var tr = h.transform; tr.DOMove(new CS.UnityEngine.Vector3(x, y, tr.position.z), dur) }
    catch (e) { X.once("fxfly", "DOMove EXC " + e) }
  }
  return { play: play, at: at, stop: stop, fly: fly };
})();

/* ---- sounds: stock cues by name (BP2_SFX, build_v2.py) through the game's own Core/AudioUtil, at an actor (3D).
   Presentation only (co-op state never depends on it). Each cue's sheet is preloaded at battle start, so a cue from a
   character's sheet (e.g. Platinum's liquid hits) plays whoever you play. A key sounds at most once per `gap` s. */
var BP2S = (function () {
  var X = BP2X, A = null, last = {};
  function au() {
    if (A === null) { try { A = require("Core/AudioUtil").default || false } catch (x) { A = false; X.once("aud", "AudioUtil EXC " + x) } }
    return A || null;
  }
  function preload() {
    var a = au(), done = {}; if (!a || typeof BP2_SFX !== "object") return;
    for (var k in BP2_SFX) { var c = BP2_SFX[k]; if (done[c]) continue; done[c] = 1; try { a.PreloadCue(c) } catch (x) { X.once("pre_" + c, "PreloadCue " + c + " EXC " + x) } }
  }
  function play(key, actor, gap) {
    var a = au(), cue = typeof BP2_SFX === "object" ? BP2_SFX[key] : null; if (!a || !cue || !actor) return;
    var tn = X.now(); if (tn >= 0 && last[key] > tn - (gap || 0.06)) return; last[key] = tn;
    try { a.PlaySoundByActor(actor, cue) } catch (x) { X.once("snd_" + key, "PlaySoundByActor " + cue + " EXC " + x) }
  }
  X.onReset(function () { last = {} });
  return { preload: preload, play: play };
})();

var BP2 = (function () {
  var CS = csharp_1, X = BP2X, W = BP2W, F = BP2F, RT = BP2_RT, B = BP2_BUFF, SND = BP2S;
  /* which v2 Tactics this player owns -> { key: triggerNode }, rescanned only when the trigger list changes */
  var cache = { p: -2, t: -1, m: null };
  function owned(p) {
    try {
      var tm = p.TriggerMgr, mt = tm.LastTriggerModifyTime, id = X.uid(p);
      if (cache.m && cache.p === id && cache.t === mt && live(cache.m)) return cache.m;
      var m = {}, L = tm.GetAllTriggers(false), any = false;
      for (var i = 0; i < L.Count; i++) { var n = L.get_Item(i), k = BP2_TRIG[n.Id]; if (k && !n.Inactive) { m[k] = n; any = true } }
      m._any = any; cache = { p: id, t: mt, m: m };
      if (any) X.log("owned: " + Object.keys(m).filter(function (k) { return k !== "_any" }).join(","));
      return m;
    } catch (x) { X.once("owned", "owned EXC " + x); return { _any: false } }
  }
  /* every cached node still active? (Inactive is a plain field: flipping it doesn't change LastTriggerModifyTime) */
  function live(m) { try { for (var k in m) if (k !== "_any" && m[k].Inactive) return false; return true } catch (x) { return false } }
  function v(n, i) { try { return X.f(n.ParamSet.GetFp("v" + i)) } catch (x) { return 0 } }
  /* per-owner, per-battle state */
  var OWN = new Map;
  function state(p) {
    var id = X.uid(p), s = OWN.get(id);
    if (!s) { s = { cd: new Map, hit: new Map, prev: new Map, crashN: 0, dashCd: -9, splashAct: new Map, pushed: new Map, fxT: new Map, iso: new Map, melt: new Map, blast: new Map, mut: new Map, waves: [], later: [], geysers: [], aired: new Map, gyHit: new Map, fount: [], castT: {}, jets: [], lines: [], jetCd: -9, pools: [], poolCd: -9, rays: [], rayCd: -9, cores: [], links: [], wisps: [], wispCd: -9, dashes: [], trails: [], falloutCd: -9, flashCd: -9, foHit: new Map, rips: [], currents: [], ripCd: -9, swellCd: -9, cswellCd: -9, wispUntil: -9 }; OWN.set(id, s) }
    return s;
  }
  X.onReset(function () { OWN.clear(); cache = { p: -2, t: -1, m: null }; seen.clear(); lastK = ""; lastT = -1 });

  /* ---------------- Soak ---------------- */
  function soakNode(own) { return own.attack_soak || own.skill_soak || own.dash_soak || null }
  /* Soaked and Crash are Water's rules, not the Soak tree's: with no Soak tier I the element's base numbers apply
     (RT.baseCrash: flat, max-HP share, Soaked seconds, slow) */
  function waterAny(own) { return !!(soakNode(own) || own.legacy_geyser || own.skill_hydro_jet || own.legacy_hydro_jet || own.summon_whirlpool || own.dash_riptide) }
  function sv(own, i) { var n = soakNode(own); return n ? v(n, i) : RT.baseCrash[i] }
  function soaked(t, p) { return X.has(t, B.soak, p) || X.has(t, B.pull, p) }
  function soak(p, t, own, S) {
    if (!waterAny(own) || !t || !t.BuffMgr || X.dead(t)) return false;
    W.widen(t);
    var dur = sv(own, 2) + (own.flash_flood ? v(own.flash_flood, 1) : 0);
    var slow = own.flash_flood ? v(own.flash_flood, 2) : sv(own, 3);
    var fresh = !soaked(t, p);
    var want = own.undertow ? B.pull : B.soak, other = own.undertow ? B.soak : B.pull;
    if (X.has(t, want, p) && X.has(t, B.slow, p)) { X.restart(t, want); X.restart(t, B.slow) }   // already yours: the timers restart in place (the pop plays once)
    else {
      X.remove(t, other); X.remove(t, want); X.add(t, want, dur, 1, 1, p);
      X.remove(t, B.slow); X.add(t, B.slow, dur, slow, 1, p);
    }
    var tn = X.now(), id = X.uid(t);
    if (fresh || !(S.fxT.get(id) > tn - 0.4)) {
      S.fxT.set(id, tn);
      var tq = X.pos(t) || {}, pq = X.pos(p) || {};
      F.at("soakHit", t, 0.8, 1, tq.x < pq.x); SND.play("soak", t, 0.1);
      if (own.undertow) F.at("undertow", t, 0.6, 1, tq.x > pq.x);        // Undertow: currents dragging it toward you
    }
    return true;
  }
  function bonus(own) { var b = 0; ["undertow", "deep_water", "flash_flood"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  /* forward: counted() is defined below; the Whirlpool tree calls it */
  function crashAmount(t, own, mult) {
    if (!waterAny(own)) return 0;
    var base = sv(own, 0), share = sv(own, 1) * X.maxHp(t);
    if (X.isBoss(t) || X.isElite(t)) share = Math.min(share, base * RT.hpShareCapBoss);
    return (base + share) * (1 + bonus(own)) * (mult || 1);
  }
  /* ActorDirectDamage applies no element formula, so Water takes the game's ratio first, as the stock Cold Attack echo
     does (the attacker's elemental damage bonuses, the victim's resistances). Unreadable or out of range: 1 (logged once) */
  /* stock Tactic damage grows with Attack the way the card's ElemAddR number does (TextUtil.GetFinalValue): the player's
     Attack over their base Attack (EAttrType 6 base, 7 rate, 8 flat). Unreadable: 1 */
  function atk(p) {
    try {
      var A = p.Attr.FinalAttr, b = X.f(A.get_Item(6)), a = b * (1 + X.f(A.get_Item(7))) + X.f(A.get_Item(8)), k = b > 0 ? a / b : 1;
      if (k >= 1 && k < 20) { X.once("atk_ok", "attack scale " + k.toFixed(3) + " (first read)"); return k }
      X.once("atk_bad", "attack scale out of range: " + k + " (using 1)"); return 1;
    } catch (x) { X.once("atk_exc", "attack scale EXC " + x + " (using 1)"); return 1 }
  }
  function ratio(p, t, el) {
    var name = el === RT.radElement ? "Radiation" : "Water";
    try {
      var r = X.f(CS.GamePlay.BattleUtils.GetElementDamageRatio(p, t, el === undefined ? RT.waterElement : el));
      if (r > 0.05 && r < 20) { X.once("ratio_ok" + name, name + " element ratio " + r.toFixed(3) + " (first read)"); return r * atk(p) }
      X.once("ratio_bad" + name, name + " element ratio out of range: " + r + " (using 1)"); return 1;
    } catch (x) { X.once("ratio" + name, "GetElementDamageRatio EXC " + x + " (using 1)"); return 1 }
  }
  function water(p, t, amount) {
    if (!(amount > 0) || X.dead(t) || X.invincible(t)) return;
    W.widen(t);
    try { CS.GamePlay.BattleUtils.ActorDirectDamage(p, t, X.fp(amount * ratio(p, t)), RT.waterElement) } catch (x) { X.once("dmg", "water damage EXC " + x) }
  }
  /* one enemy's share of a Crash: its own 0.5 s cooldown, then the damage */
  function crashHit(p, t, own, S, tn) {
    var id = X.uid(t); if (X.dead(t) || S.cd.get(id) > tn) return false;
    S.cd.set(id, tn + RT.crashCd);
    water(p, t, crashAmount(t, own));
    return true;
  }
  /* Deep Water: the Crash splashes, Soaking the enemies right next to it (skip = the enemies that Crashed) */
  function spread(p, own, S, pts, skip) {
    if (!own.deep_water || !pts.length) return;
    var r = v(own.deep_water, 1), L = X.enemies(p);
    for (var i = 0; i < L.length; i++) {
      var e = L[i]; if (skip.indexOf(e) >= 0) continue; var eq = X.pos(e); if (!eq) continue;
      for (var j = 0; j < pts.length; j++) if (Math.abs(eq.x - pts[j].x) <= r && Math.abs(eq.y - pts[j].y) <= r) { soak(p, e, own, S); break }
    }
  }
  /* every Crash counts once toward the Tsunami */
  function counted(p, own, S, kind, t, other) {
    S.crashN++;
    X.log("CRASH " + kind + " #" + S.crashN + " on " + X.uid(t) + (other ? " (with " + X.uid(other) + ")" : ""));
    if (own.tsunami && S.crashN % Math.max(1, Math.round(v(own.tsunami, 1))) === 0) tsunami(p, own, S);
    if (own.fountainhead) fountain(p, t, own, S);
  }
  /* a wall or floor Crash: one victim */
  function crash(p, t, kind, own, S) {
    var tn = X.now(); if (!(tn >= 0) || !crashHit(p, t, own, S, tn)) return false;
    var q = X.pos(t), pp = X.pos(p);
    if (kind === "wall") F.at("crashWall", t, 0.8, 1, !!(q && pp && q.x > pp.x));
    else F.at("crashFloor", t, 0, 1);
    SND.play("crash", t, 0.08);
    if (q && own.deep_water) F.play("deepSpread", q.x, q.y - X.ground(q), 1, false);   // Deep Water: it runs out along the floor
    if (q) spread(p, own, S, [q], [t]);
    counted(p, own, S, kind, t, null);
    return true;
  }
  /* a Soaked enemy knocked into another: ONE Crash that both take (each on its own cooldown), one splash between them;
     Deep Water Soaks the enemy it hit and the ones next to either */
  function crashPair(p, a, b, own, S) {
    var tn = X.now(); if (!(tn >= 0)) return false;
    var ha = crashHit(p, a, own, S, tn), hb = crashHit(p, b, own, S, tn); if (!ha && !hb) return false;
    var qa = X.pos(a), qb = X.pos(b), pp = X.pos(p);
    if (qa && qb) {
      var mx = (qa.x + qb.x) / 2, my = (qa.y + qb.y) / 2; F.play("crashEnemy", mx, my + 0.8, 1, !!(pp && mx < pp.x));
      if (own.deep_water) F.play("deepSpread", mx, my - X.ground({ x: mx, y: my }), 1, false);
    }
    SND.play("crash", a, 0.08);
    if (own.deep_water) { soak(p, b, own, S); spread(p, own, S, [qa, qb].filter(Boolean), [a, b]) }
    counted(p, own, S, "enemy", a, b);
    return true;
  }
  /* Pressure (the lead, 2026-09-29: on every enemy, not only bosses): each hit on a Soaked enemy adds 1; at the cap a
     geyser erupts under it. The bubble around it swells in three steps (pressureSteps): a step change re-adds the buff
     so the new bubble layer (stack-gated AddEffects) and the pop play once; within a step the stack changes in place
     and the timer restarts, so nothing replays on every hit. */
  function pStep(n) { var s = RT.pressureSteps; return n >= s[2] ? 3 : n >= s[1] ? 2 : n >= s[0] ? 1 : 0 }
  function pressure(p, t, own, S, add) {
    if (X.dead(t)) return;
    var cur = X.stacks(t, B.pressure, p), n = cur + add;
    if (n >= RT.pressureMax) { X.remove(t, B.pressure); geyser(p, t, own, S); return }
    if (cur > 0 && pStep(n) === pStep(cur)) { X.setStack(t, B.pressure, n); X.restart(t, B.pressure); return }
    X.remove(t, B.pressure); X.add(t, B.pressure, RT.pressureHold, 1, n, p);
    SND.play("pressure", t, 0.1);
  }
  function geyser(p, t, own, S) {
    var q = X.pos(t); if (!q) return;
    water(p, t, crashAmount(t, own, RT.geyserMult));
    F.play("geyser", q.x, q.y, 1, false);
    SND.play("geyser", t, 0.05); SND.play("geyserPop", t, 0.05);
    if (X.launchable(t)) X.addVel(t, 0, RT.geyserLift);
    var L = X.enemies(p);
    for (var i = 0; i < L.length; i++) {
      var e = L[i]; if (e === t || !X.launchable(e)) continue; var eq = X.pos(e);
      if (eq && Math.abs(eq.x - q.x) <= RT.geyserRadius && Math.abs(eq.y - q.y) <= RT.geyserRadius) { X.addVel(e, 0, RT.geyserLift); soak(p, e, own, S) }
    }
    X.log("GEYSER on " + X.uid(t));
  }
  /* ---------------- Geyser tree (BATCH_02 W3) ----------------
     Legacy Geyser: using a Legacy Skill erupts a geyser under each of the v1 nearest enemies within v2 m (Wellspring:
     more of them). A geyser damages and launches what stands on it; an enemy takes one geyser per cast, however many
     come up around it. Standing Water keeps each column erupting. Aftershock: what a geyser launched Crashes on the
     floor when it comes down. Fountainhead: every Crash sets off a small geyser (no launch mark: it can't chain). */
  function gyBonus(own) { var b = 0; ["wellspring", "aftershock"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function floorOf(q) { return q.y - X.ground(q) }
  /* one eruption at (x, gy): every enemy on it that `taken` doesn't hold yet takes dmg and is launched */
  function erupt(p, own, S, x, gy, dmg, lift, scale, taken, mark, tn) {
    F.play("geyser", x, gy, scale, false);
    var L = X.enemies(p), r = RT.geyserRadius * scale, n = 0;
    for (var i = 0; i < L.length; i++) {
      var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
      if (Math.abs(q.x - x) > r || q.y < gy - 0.5 || q.y > gy + 3.5 * scale) continue;
      var id = X.uid(e); if (taken && taken.has(id)) continue;
      if (taken) taken.add(id);
      water(p, e, dmg); n++;
      if (X.launchable(e)) { X.addVel(e, 0, lift); if (mark) S.aired.set(id, { t: tn, up: false }) }
    }
    return n;
  }
  function legacyGeyser(p, own, S, tn) {
    var node = own.legacy_geyser, pp = X.pos(p); if (!pp) return false;
    var count = Math.round(v(node, 1) + (own.wellspring ? v(own.wellspring, 1) : 0)), range = v(node, 2);
    var L = X.enemies(p), c = [];
    for (var i = 0; i < L.length; i++) {
      var q = X.pos(L[i]); if (!q || X.dead(L[i])) continue;
      var d = Math.hypot(q.x - pp.x, q.y - pp.y); if (d <= range) c.push({ q: q, d: d, id: X.uid(L[i]) });
    }
    if (!c.length) return false;
    c.sort(function (a, b) { return a.d - b.d || a.id - b.id }); c = c.slice(0, Math.max(1, count));
    var dmg = v(node, 0) * (1 + gyBonus(own)), taken = new Set, hit = 0;
    for (var j = 0; j < c.length; j++) {
      var x = c[j].q.x, gy = floorOf(c[j].q);
      hit += erupt(p, own, S, x, gy, dmg, RT.geyserLift, 1, taken, !!own.aftershock, tn);
      if (own.standing_water) S.geysers.push({ x: x, gy: gy, until: tn + v(own.standing_water, 1) + 1e-6, next: tn + v(own.standing_water, 2), dmg: dmg * v(own.standing_water, 0) });
    }
    SND.play("geyser", p, 0.05); SND.play("geyserPop", p, 0.05);
    X.log("LEGACY GEYSER: " + c.length + " geysers, " + hit + " enemies");
    return true;
  }
  /* Standing Water: each column erupts again every v2 s until its time is up */
  function geyserTick(p, own, S, tn) {
    if (!S.geysers.length) return;
    var every = own.standing_water ? v(own.standing_water, 2) : 0.5;
    for (var k = S.geysers.length - 1; k >= 0; k--) {
      var g = S.geysers[k];
      if (tn >= g.next && g.next <= g.until) {
        g.next += every;
        F.play("geyser", g.x, g.gy, 1, false);
        var L = X.enemies(p), r = RT.geyserRadius;
        for (var i = 0; i < L.length; i++) {
          var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
          if (Math.abs(q.x - g.x) > r || q.y < g.gy - 0.5 || q.y > g.gy + 5) continue;
          var id = X.uid(e); if (S.gyHit.get(id) > tn - RT.gyTickCd) continue;      // one column at a time
          S.gyHit.set(id, tn); water(p, e, g.dmg);
          if (X.launchable(e)) { X.addVel(e, 0, RT.geyserLift * RT.gyStandLift); if (own.aftershock) S.aired.set(id, { t: tn, up: false }) }
        }
      }
      if (g.next > g.until) S.geysers.splice(k, 1);
    }
  }
  /* Aftershock: an enemy a geyser launched, seen in the air and then back on the floor, Crashes there.
     Spike Down: so does an enemy a jet slammed down out of the air (marked `spike`, with or without Aftershock) */
  function landings(p, own, S, tn, P) {
    if (!S.aired.size) return;
    for (var i = 0; i < P.length; i++) {
      var a = S.aired.get(P[i].id); if (!a) continue;
      var h = X.ground(P[i].q);
      if (!a.up) { if (h >= RT.gyAirMin) a.up = true; else if (tn - a.t > 1) S.aired.delete(P[i].id); continue }
      if (h <= RT.gyLand) { S.aired.delete(P[i].id); if (own.aftershock || a.spike) crash(p, P[i].a, "floor", own, S) }
    }
    S.aired.forEach(function (a, id) { if (tn - a.t > RT.gyAirFor) S.aired.delete(id) });
  }
  /* Fountainhead: a small geyser under an enemy that just Crashed (up to v1 a second). It lifts a little and leaves no
     launch mark, so it can't set off another */
  function fountain(p, t, own, S) {
    var tn = X.now(), q = X.pos(t); if (!(tn >= 0) || !q) return;
    S.fount = S.fount.filter(function (x) { return x > tn - 1 });
    if (S.fount.length >= Math.max(1, Math.round(v(own.fountainhead, 1)))) return;
    S.fount.push(tn);
    var n = erupt(p, own, S, q.x, floorOf(q), v(own.fountainhead, 0) * (1 + gyBonus(own)), RT.gySmallLift, RT.gySmall, null, false, tn);
    SND.play("geyserPop", t, 0.1);
    X.log("FOUNTAINHEAD on " + X.uid(t) + ": " + n + " enemies");
  }
  /* ---------------- Hydro Jet tree (BATCH_02 W2) ----------------
     A jet is a front leaving (x, y) along a unit direction at RT.jetSpeed. It takes each enemy on its line once (the
     line's half width plus the enemy's own), damages it and pushes it along the jet. The level cuts its reach; with
     Ricochet the rest of its length runs back from there (its own front: an enemy can take both). Spray bursts on the
     first enemy; Waterline lays water on the floor under the finished jet. */
  function jetBonus(own) {
    var b = 0; ["ricochet", "pressure_cutter"].forEach(function (k) { if (own[k]) b += v(own[k], 0) });
    return b + (own.spray ? v(own.spray, 2) : 0);
  }
  function fireJets(p, own, S, tn, node, angles) {
    var pp = X.pos(p); if (!pp) return false;
    var face = 1; try { face = p.Dir < 0 ? -1 : 1 } catch (x) {}
    var len = v(node, 1), half = (own.pressure_cutter ? v(own.pressure_cutter, 1) : v(node, 2)) / 2, dmg = v(node, 0) * (1 + jetBonus(own));
    for (var i = 0; i < angles.length; i++) {
      var a = angles[i] * Math.PI / 180;
      launchJet(p, own, S, tn, pp.x, pp.y + 0.8, face * Math.cos(a), Math.sin(a), len, half, dmg, v(node, 3), !!own.ricochet, floorOf(pp));
    }
    SND.play("dashWave", p, 0.2);
    X.log("HYDRO JET x" + angles.length + " " + (face > 0 ? "right" : "left"));
    return true;
  }
  function launchJet(p, own, S, tn, x, y, dx, dy, len, half, dmg, push, bounce, gy) {
    var reach = X.ray(x, y, dx, dy, len), left = dx < 0, up = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
    F.play("hydroJet", x, y, reach / RT.jetLen, left, 0, 1, left ? -up : up);     // mirrored for a jet to the left, turned by its rise
    S.jets.push({ x: x, y: y, dx: dx, dy: dy, t0: tn, reach: reach, half: half, dmg: dmg, push: push, hit: new Set, first: true, gy: gy,
                  back: bounce && reach < len - 0.5 ? len - reach : 0 });
  }
  function sprayBurst(p, own, S, t, dmg) {
    var q = X.pos(t); if (!q) return;
    F.at("crashEnemy", t, 0.8, 1, false);
    var r = v(own.spray, 1), L = X.enemies(p), n = 0;
    for (var i = 0; i < L.length; i++) {
      var e = L[i]; if (e === t) continue; var eq = X.pos(e);
      if (eq && Math.hypot(eq.x - q.x, eq.y - q.y) <= r) { water(p, e, dmg * v(own.spray, 0)); n++ }
    }
    X.log("SPRAY on " + X.uid(t) + ": " + n + " enemies");
  }
  /* Crashing Jet (Double: Hydro Jet's tier III + any Soak tier I): a Soaked enemy rides the jet to the end of its path
     and Crashes there. It is thrown along the jet at RT.cjPush; the jet's end comes reach / jetSpeed after it left, and
     the Crash RT.cjDelay s after that. Sooner, if the flight meets a wall or another enemy: it is marked as one of
     ours, and the Crash's own cooldown keeps it to one */
  function carryCrash(p, S, e, id, j, tn) {
    X.addVel(e, j.dx * RT.cjPush, Math.max(1.5, j.dy * RT.cjPush));
    S.hit.set(id, tn);
    S.later.push({ at: j.t0 + j.reach / RT.jetSpeed + RT.cjDelay, f: function () { if (!X.dead(e) && soaked(e, p)) crash(p, e, "wall", owned(p), S) } });
    F.at("riptide", e, 0.8, 1, j.dx < 0);
    X.log("CRASHING JET carries " + id);
  }
  function jetTick(p, own, S, tn) {
    if (!S.jets.length) return;
    var L = X.enemies(p);
    for (var k = S.jets.length - 1; k >= 0; k--) {
      var j = S.jets[k], front = Math.min(j.reach, RT.jetSpeed * (tn - j.t0));
      for (var i = 0; i < L.length; i++) {
        var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
        var id = X.uid(e); if (j.hit.has(id)) continue;
        var rx = q.x - j.x, ry = q.y + 0.8 - j.y, s = rx * j.dx + ry * j.dy, d = Math.abs(rx * j.dy - ry * j.dx);
        if (s < -0.3 || s > front || d > j.half + RT.jetBody) continue;
        j.hit.add(id);
        water(p, e, j.dmg);
        if (X.launchable(e)) {
          var h = X.ground(q);
          if (own.spike_down && h >= RT.gyAirMin) {                  // Spike Down (Double): slammed to the floor, where it Crashes
            X.addVel(e, j.dx * j.push * RT.spikeAcross, -RT.spikeDown);
            S.aired.set(id, { t: tn, up: true, spike: true });
            F.at("crashEnemy", e, 0.8, 1, j.dx < 0);
            X.log("SPIKE DOWN on " + id + ", " + h.toFixed(2) + " m up");
          } else if (own.crashing_jet && soaked(e, p)) carryCrash(p, S, e, id, j, tn);
          else X.addVel(e, j.dx * j.push, Math.max(1.5, j.dy * j.push));
        }
        if (j.first) { j.first = false; if (own.spray) sprayBurst(p, own, S, e, j.dmg) }
      }
      if (front < j.reach) continue;
      S.jets.splice(k, 1);
      if (j.back > 0) launchJet(p, own, S, tn, j.x + j.dx * j.reach, j.y + j.dy * j.reach, -j.dx, j.dy, j.back, j.half, j.dmg, j.push, false, j.gy);
      if (own.waterline) layLine(p, own, S, tn, j);
    }
  }
  /* Waterline: water on the floor under a finished jet's path, for v1 s; every v2 s it Soaks and damages what stands in it */
  function layLine(p, own, S, tn, j) {
    var xa = j.x, xb = j.x + j.dx * j.reach, len = Math.abs(xb - xa); if (len < 0.5) return;
    F.play("waterline", xa, j.gy, len / RT.lineLen, xb < xa);
    S.lines.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), gy: j.gy, until: tn + v(own.waterline, 1) + 1e-6, next: tn + v(own.waterline, 2) });
  }
  function lineTick(p, own, S, tn) {
    if (!S.lines.length) return;
    var every = own.waterline ? v(own.waterline, 2) : 0.5, dmg = own.waterline ? v(own.waterline, 0) : 0, L = null;
    for (var k = S.lines.length - 1; k >= 0; k--) {
      var ln = S.lines[k];
      if (tn >= ln.next && ln.next <= ln.until) {
        ln.next += every; L = L || X.enemies(p);
        for (var i = 0; i < L.length; i++) {
          var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
          if (q.x < ln.x0 || q.x > ln.x1 || q.y < ln.gy - 0.3 || q.y > ln.gy + RT.lineUp) continue;
          soak(p, e, own, S); water(p, e, dmg);
        }
      }
      if (ln.next > ln.until) S.lines.splice(k, 1);
    }
  }
  /* ---------------- Whirlpool tree (BATCH_02 W5) ----------------
     Every v1 s a whirlpool opens on the floor under the largest group of enemies near the player and stays for v2 s. It
     drags what can be moved toward its eye (a small velocity on every poll), and every v3 s damages what is inside. A
     boss takes the damage and is Soaked. Spit throws its catch outward when it closes; Vortex Heart makes two or more
     enemies inside collide every pulse (a Crash each, counted once). */
  function poolBonus(own) { var b = 0; ["maelstrom", "twin_currents", "spit"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function summonPool(p, own, S, tn) {
    var node = own.summon_whirlpool; if (!node || tn < S.poolCd) return false;
    var pp = X.pos(p), L = X.enemies(p), c = []; if (!pp) return false;
    for (var i = 0; i < L.length; i++) {
      var q = X.pos(L[i]);
      if (q && !X.dead(L[i]) && Math.abs(q.x - pp.x) <= RT.poolScanX && Math.abs(q.y - pp.y) <= RT.poolScanY) c.push({ q: q, id: X.uid(L[i]) });
    }
    if (!c.length) return false;
    S.poolCd = tn + v(node, 1);
    var R = v(node, 4) * (own.maelstrom ? v(own.maelstrom, 1) : 1), want = 1 + (own.twin_currents ? Math.round(v(own.twin_currents, 1)) : 0);
    var dmg = v(node, 0) * (1 + poolBonus(own)), made = 0;
    for (var n = 0; n < want && c.length; n++) {
      var best = null, bestN = -1;                                   // the enemy with the most others within the pool's width (ties: the lowest id)
      for (var a = 0; a < c.length; a++) {
        var k = 0; for (var b2 = 0; b2 < c.length; b2++) if (Math.abs(c[b2].q.x - c[a].q.x) <= R && Math.abs(c[b2].q.y - c[a].q.y) <= 3) k++;
        if (k > bestN || (k === bestN && c[a].id < best.id)) { best = c[a]; bestN = k }
      }
      var x = best.q.x, gy = floorOf(best.q);
      F.play("whirlpool", x, gy, R / RT.poolR, false, v(node, 2));   // held for the pool's life
      S.pools.push({ x: x, gy: gy, r: R, until: tn + v(node, 2) + 1e-6, next: tn + v(node, 3), every: v(node, 3), dmg: dmg });
      c = c.filter(function (o) { return Math.abs(o.q.x - x) > R }); made++;
    }
    SND.play("pressure", p, 0.2);
    X.log("WHIRLPOOL x" + made + ", radius " + R);
    return true;
  }
  function poolTick(p, own, S, tn) {
    if (!S.pools.length) return;
    var L = X.enemies(p);
    for (var k = S.pools.length - 1; k >= 0; k--) {
      var w = S.pools[k], inside = [];
      for (var i = 0; i < L.length; i++) {
        var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
        if (Math.abs(q.x - w.x) > w.r || q.y < w.gy - 0.5 || q.y > w.gy + 3) continue;
        inside.push(e);
        if (X.launchable(e) && Math.abs(q.x - w.x) > 0.4) X.addVel(e, (w.x > q.x ? 1 : -1) * RT.poolPull, 0);   // dragged toward the eye
      }
      if (tn >= w.next && w.next <= w.until) {
        w.next += w.every;
        for (var j = 0; j < inside.length; j++) { water(p, inside[j], w.dmg); if (!X.launchable(inside[j])) soak(p, inside[j], own, S) }
        if (own.vortex_heart && inside.length >= 2) {                // they collide: a share of a Crash each, one count for the pool
          var any = false;
          for (var j2 = 0; j2 < inside.length; j2++) {
            var id2 = X.uid(inside[j2]); if (X.dead(inside[j2]) || S.cd.get(id2) > tn) continue;
            S.cd.set(id2, tn + RT.crashCd); water(p, inside[j2], crashAmount(inside[j2], own, v(own.vortex_heart, 0))); any = true;
          }
          if (any) counted(p, own, S, "pool", inside[0], inside[1]);
        }
      }
      if (tn < w.until) continue;
      S.pools.splice(k, 1);
      F.play("crashFloor", w.x, w.gy, 1.2, false);                   // it closes in a splash
      if (own.undertow_geyser) {                                     // Undertow Geyser (Double): it erupts as a geyser at its eye
        var gd = (own.legacy_geyser ? v(own.legacy_geyser, 0) : 0) * (1 + gyBonus(own)) * v(own.undertow_geyser, 0);
        var gn = erupt(p, own, S, w.x, w.gy, gd, RT.geyserLift, RT.ugScale * w.r / RT.poolR, new Set, !!own.aftershock, tn);
        SND.play("geyser", p, 0.05); SND.play("geyserPop", p, 0.05);
        X.log("UNDERTOW GEYSER at " + w.x.toFixed(1) + ": " + gn + " enemies");
      }
      if (own.spit) for (var j3 = 0; j3 < inside.length; j3++) {
        var e3 = inside[j3], q3 = X.pos(e3); soak(p, e3, own, S);
        if (q3 && X.launchable(e3)) { X.addVel(e3, (q3.x >= w.x ? 1 : -1) * RT.poolSpit, RT.poolSpitLift); S.hit.set(X.uid(e3), tn) }   // a flight that can Crash into others
      }
    }
  }
  function tsunami(p, own, S) {
    var pp = X.pos(p); if (!pp) return;
    /* in the air the wave still stands on the floor: stretched up so its crest is where it would be at your height */
    var h = X.ground(pp), gy = pp.y - h, cr = RT.waves.tsunami.crest, sy = (h + cr) / cr;
    F.play("tsunamiSurge", pp.x, gy, 1, false);                          // the water erupts from the floor (once)...
    for (var m = 0; m < 2; m++) {                                        // ...and rolls out both ways
      F.play("tsunami", pp.x, gy, 1, m === 1, 0, sy);
      F.play("tsunamiGround", pp.x, gy, 1, m === 1);                     // its wake, crowns and end crash (never stretched)
    }
    SND.play("tsunami", p, 0.3);
    var both = new Map;                                              // one touch list for the pair: an enemy at the origin
    launchWave(p, S, "tsunami", pp.x, pp.y, 1, 0, both, gy); launchWave(p, S, "tsunami", pp.x, pp.y, -1, 0, both, gy);   // is hit by one wave
    X.log("TSUNAMI after Crash #" + S.crashN + (h > 0.3 ? " (in the air, " + h.toFixed(2) + " m up)" : ""));
  }

  /* ---------------- travelling waves (the lead, 2026-09-29: waves carry enemies, and the Tsunami damages across its
     whole run) ----------------
     A front leaves x0 along dir at W.speed m/s (the effect's crests are laid out at the same speed) until W.reach. An
     enemy inside the crest band (the last W.band m behind the front, within W.height of the start) is Soaked, carried
     (a push along dir, at most every W.every s) and damaged on each of those ticks (Tsunami v0, Dash Soak v6); the first touch
     adds the Tsunami's Pressure. When the front has run its course, what it still holds is hurled away (W.fling). */
  function launchWave(p, S, kind, x0, y0, dir, reach, last, gy) {
    var tn = X.now(); if (!(tn >= 0)) return;
    var own = owned(p), r = (reach || RT.waves[kind].reach) * (own.rip_current ? v(own.rip_current, 0) : 1), wall = null;
    if (own.breakwater) {                                              // Breakwater (Double): the wall it reaches is where it ends
      var d = X.ray(x0, (gy === undefined ? y0 : gy) + RT.bwUp, dir, 0, r);
      if (d < r - 0.1) { r = Math.max(0.5, d); wall = x0 + dir * d }
      X.log("BREAKWATER ray from " + x0.toFixed(1) + (dir < 0 ? " left " : " right ") + d.toFixed(1) + " of " + r.toFixed(1) + (wall === null ? ", no wall" : ""));
    }
    S.waves.push({ kind: kind, x0: x0, y0: y0, g: gy === undefined ? y0 : gy, dir: dir, t0: tn, last: last || new Map, n: 0, reach: r, wall: wall });
  }
  function waveTick(p, own, S, tn) {
    if (!S.waves.length) return;
    var L = X.enemies(p);
    for (var k = S.waves.length - 1; k >= 0; k--) {
      var w = S.waves[k], W = RT.waves[w.kind], el = tn - w.t0, front = Math.min(w.reach, W.speed * el), done = W.speed * el >= w.reach + W.band;
      var every = w.kind === "tsunami" ? (own.tsunami ? v(own.tsunami, 3) : 0) : w.kind === "dash" && own.dash_soak ? v(own.dash_soak, 7) : 0;
      if (!(every > 0)) every = W.every;
      for (var i = 0; i < L.length; i++) {
        var e = L[i], q = X.pos(e); if (!q) continue;
        var d = (q.x - w.x0) * w.dir;
        if (d < -W.back || d > front || d < front - W.band || q.y > w.y0 + W.height || q.y < Math.min(w.y0 - W.height, w.g - 0.5)) continue;
        var id = X.uid(e), lt = w.last.get(id);
        if (!done && lt !== undefined && tn - lt < every) continue;
        var first = lt === undefined; w.last.set(id, tn);
        if (first) SND.play("waveHit", e, 0.12);
        soak(p, e, own, S);
        S.hit.set(id, tn);                                         // carried: a flight that can Crash into others
        var wd = w.kind === "tsunami" ? (own.tsunami ? v(own.tsunami, 0) : 0) : w.kind === "dash" ? (own.dash_soak ? v(own.dash_soak, 6) : 0) : swellDmg(own);
        if (w.kind === "tsunami" && own.tsunami && first) pressure(p, e, own, S, Math.round(v(own.tsunami, 2)));
        if (wd > 0) {                                              // the lead: the dash wave damages too
          water(p, e, wd);
          if (first && own.rip_current) S.later.push({ at: tn + RT.ripAgain, f: (function (a, amt) { return function () { water(p, a, amt) } })(e, wd) });
        }
        if (X.launchable(e)) X.addVel(e, w.dir * (done ? W.fling : W.carry), done ? W.flingLift : W.lift);
        if (first) w.n++;
      }
      if (done) { S.waves.splice(k, 1); waveEnd(p, own, S, tn, w, L); X.log((w.kind === "tsunami" ? "TSUNAMI" : w.kind === "swell" ? "SWELL" : "DASH WAVE") + " wave " + (w.dir > 0 ? "right" : "left") + ": " + w.n + " enemies") }
    }
  }

  /* ---------------- Riptide tree (BATCH_02 W4 option A) ----------------
     Dash Riptide: the path of a dash (read RT.dashTime s after it starts, as Dash Fallout's) becomes a current for v2 s:
     the enemies standing in it are dragged the way you dashed and, every v3 s, Soaked and damaged. Dodge Swell and
     Counter Swell send a swell wave (Dash Riptide's tick times RT.swellMult); Breaker makes every wave break at its end;
     Rip Current runs every wave further and makes it hit again. Surfing Whirlpool and Breakwater are its Doubles. */
  function ripBonus(own) {
    var b = own.rip_current ? v(own.rip_current, 1) : 0;
    ["dodge_swell", "counter_swell", "breaker"].forEach(function (k) { if (own[k]) b += v(own[k], 0) });
    return b;
  }
  function swellDmg(own) { return own.dash_riptide ? v(own.dash_riptide, 0) * (1 + ripBonus(own)) * RT.swellMult : 0 }
  function layCurrent(p, own, S, tn, d) {
    var node = own.dash_riptide, pp = X.pos(p); if (!node || !pp) return;
    var x1 = pp.x; if (Math.abs(x1 - d.x0) < RT.trailMin) x1 = d.x0 + d.face * RT.trailMin;
    var a = Math.min(d.x0, x1), b = Math.max(d.x0, x1), life = v(node, 2) * (own.rip_current ? v(own.rip_current, 0) : 1);
    var fx = F.play("riptide", d.x0, d.gy, (b - a) / RT.ripLen, d.x0 > a, life);
    S.currents.push({ x0: a, x1: b, gy: d.gy, dir: x1 >= d.x0 ? 1 : -1, until: tn + life + 1e-6, every: v(node, 3), next: tn + v(node, 3), fx: fx });
    X.log("RIPTIDE " + a.toFixed(1) + " .. " + b.toFixed(1) + " for " + life + " s");
  }
  function currentTick(p, own, S, tn) {
    for (var i = S.rips.length - 1; i >= 0; i--) if (tn >= S.rips[i].at) { var d = S.rips[i]; S.rips.splice(i, 1); layCurrent(p, own, S, tn, d) }
    if (!S.currents.length) return;
    var node = own.dash_riptide, L = X.enemies(p);
    for (var k = S.currents.length - 1; k >= 0; k--) {
      var c = S.currents[k], tick = tn >= c.next && c.next <= c.until, n = 0;
      if (tick) c.next += c.every;
      for (var j = 0; j < L.length; j++) {
        var e = L[j], q = X.pos(e); if (!q || X.dead(e)) continue;
        if (q.x < c.x0 || q.x > c.x1 || q.y < c.gy - 0.3 || q.y > c.gy + RT.ripUp) continue;
        if (node && X.launchable(e)) X.addVel(e, c.dir * v(node, 1), 0);
        if (tick && node) { soak(p, e, own, S); water(p, e, v(node, 0) * (1 + ripBonus(own))); n++ }
      }
      if (tick && n) X.log("RIPTIDE tick: " + n + " enemies");
      if (tn >= c.until) S.currents.splice(k, 1);
    }
  }
  /* a swell from x along dir on the floor at gy: the dash wave's effect, raised to the swell's crest */
  function swell(p, own, S, x, y, gy, dir, reach) {
    var sc = RT.waves.swell.crest / RT.waves.dash.crest;
    F.play("dashWave", x, gy, sc, dir < 0);
    F.play("dashGround", x, gy, sc, dir < 0);
    SND.play("dashWave", p, 0.2);
    launchWave(p, S, "swell", x, y, dir, reach, null, gy);
  }
  function counterSwell(p) {
    var own = owned(p), n = own.counter_swell; if (!n) return false;
    X.epoch();
    var S = state(p), tn = X.now(), pp = X.pos(p); if (!(tn >= 0) || !pp || tn < S.cswellCd) return false;
    var L = X.enemies(p), best = null, bd = 1e9;
    for (var i = 0; i < L.length; i++) {
      var q = X.pos(L[i]); if (!q || X.dead(L[i])) continue;
      var d = Math.hypot(q.x - pp.x, q.y - pp.y); if (d < bd) { bd = d; best = q }
    }
    if (!best || bd > RT.poolScanX) return false;
    S.cswellCd = tn + v(n, 2);
    swell(p, own, S, best.x, best.y, floorOf(best), best.x >= pp.x ? 1 : -1, v(n, 1));
    X.log("COUNTER SWELL at " + best.x.toFixed(1));
    return true;
  }
  /* where a wave has run its course: Breaker's splash, Surfing Whirlpool's small pool, Breakwater's burst on the wall */
  function waveEnd(p, own, S, tn, w, L) {
    var fx = w.x0 + w.dir * w.reach, i, e, q;
    if (own.breaker) {
      var r = v(own.breaker, 1), bn = 0;
      F.play("crashFloor", fx, w.g, r / 2, false);
      for (i = 0; i < L.length; i++) {
        e = L[i]; q = X.pos(e); if (!q || X.dead(e) || Math.abs(q.x - fx) > r || q.y > w.g + RT.ripUp + 1 || q.y < w.g - 0.5) continue;
        soak(p, e, own, S); water(p, e, v(own.breaker, 2)); bn++;
      }
      X.log("BREAKER at " + fx.toFixed(1) + ": " + bn + " enemies");
    }
    if (own.surfing_whirlpool && (w.kind === "dash" || w.kind === "swell")) {
      var sw = own.surfing_whirlpool, life = v(sw, 1), base = own.summon_whirlpool ? v(own.summon_whirlpool, 0) * (1 + poolBonus(own)) : 0;
      var every = own.summon_whirlpool ? v(own.summon_whirlpool, 3) : 0.5;
      F.play("whirlpool", fx, w.g, RT.surfPoolR / RT.poolR, false, life);
      S.pools.push({ x: fx, gy: w.g, r: RT.surfPoolR, until: tn + life + 1e-6, next: tn + every, every: every, dmg: base * v(sw, 0) });
      X.log("SURFING WHIRLPOOL at " + fx.toFixed(1));
    }
    if (own.breakwater && w.wall !== null && w.wall !== undefined) {
      var R = v(own.breakwater, 0), wn = 0;
      F.play("crashWall", w.wall, w.g + 0.8, 1.2, w.dir < 0);
      for (i = 0; i < L.length; i++) {
        e = L[i]; q = X.pos(e); if (!q || X.dead(e) || Math.abs(q.x - w.wall) > R || q.y > w.g + RT.waves[w.kind].height + 1) continue;
        soak(p, e, own, S); crash(p, e, "wall", own, S); wn++;
      }
      X.log("BREAKWATER at " + w.wall.toFixed(1) + ": " + wn + " enemies");
    }
  }

  /* ---------------- Isotopes ----------------
     A native stacking debuff (bp2_isotopes, AddStack, max 25): each stack is +1% (Long Half-life 1.5%) elemental damage
     taken, set by the buff's strength. Every 2 s (3 s) after an enemy first gets Isotopes, half of them (rounded up)
     decay: the stack drops in place (ChangeBuffStack) and each decaying Isotope deals Radiation (Chaos 8) damage.
     Only the buff's owner decays it, so co-op partners never decay the same Isotopes twice. */
  function isoNode(own) { return own.attack_isotope || own.skill_isotope || null }
  /* Isotopes, Decay and the amplifier are Radiation's rules, not the Isotope tree's: with no Isotope tier I the element's
     base Decay applies (RT.baseDecay per decaying Isotope); the Isotope tree's tier II bonuses apply either way */
  function radAny(own) { return !!(isoNode(own) || own.skill_gamma_ray || own.legacy_gamma_ray || own.legacy_reactor || own.summon_wisp || own.dash_fallout) }
  function isoDmg(own) { var n = isoNode(own); return (n ? v(n, 0) : RT.baseDecay) * (1 + isoBonus(own)) }
  function isoBonus(own) { var b = 0; ["enrichment", "long_half_life", "fission"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function isoPeriod(own) { return own.long_half_life ? v(own.long_half_life, 1) : RT.isoPeriod }
  function isoAmp(own) { return own.long_half_life ? v(own.long_half_life, 2) : RT.isoAmp }
  function rad(p, t, amount) {
    if (!(amount > 0) || X.dead(t) || X.invincible(t)) return;
    try { CS.GamePlay.BattleUtils.ActorDirectDamage(p, t, X.fp(amount * ratio(p, t, RT.radElement)), RT.radElement) } catch (x) { X.once("rdmg", "radiation damage EXC " + x) }
  }
  function addIso(p, t, own, S, n) {
    if (!radAny(own) || !t || !t.BuffMgr || !(n > 0) || X.dead(t)) return 0;
    var tn = X.now(); if (!(tn >= 0)) return 0;
    var id = X.uid(t), cur = X.stacksAny(t, B.iso), add = Math.min(n, RT.isoMax - cur);
    if (add > 0) X.add(t, B.iso, RT.isoHold, isoAmp(own), add, p);
    var e = S.iso.get(id);
    if (!e) { e = { a: t, at: tn + isoPeriod(own), n: 0, q: null }; S.iso.set(id, e) }
    else if (cur <= 0) e.at = tn + isoPeriod(own);                 // a fresh set of Isotopes starts its own clock
    e.n = X.stacksAny(t, B.iso); e.q = X.pos(t) || e.q; e.mine = X.has(t, B.iso, p);
    if (add > 0) X.log("ISO +" + add + " on " + id + " -> " + e.n);
    if (own.critical_mass && e.n >= RT.isoMax) meltdown(p, t, own, S, e);
    return add;
  }
  function meltAmount(e, own, node) {
    var n = node || own.critical_mass, base = v(n, 0), share = v(n, 1) * X.maxHp(e);
    if (X.isBoss(e) || X.isElite(e)) share = Math.min(share, base * RT.meltCapBoss);
    return base + share;
  }
  /* Critical Mass: at 25 the enemy melts down, blasting itself and everything near it; it keeps half its Isotopes */
  function meltdown(p, t, own, S, ent, node) {
    node = node || own.critical_mass;
    var tn = X.now(), id = X.uid(t); if (!(tn >= 0) || S.melt.get(id) > tn) return;
    S.melt.set(id, tn + RT.meltCd);
    var q = X.pos(t); if (!q) return;
    if (own.fallout_fission) putTrail(p, own, S, tn, q.x - RT.zoneSize / 2, q.x + RT.zoneSize / 2, floorOf(q), null, v(own.fallout_fission, 1));   // Fallout Fission (Double)
    F.play("meltdown", q.x, q.y + 0.8, 1, false);                    // the dark core swells, then the blast
    var keep = Math.floor(RT.isoMax / 2); X.setStack(t, B.iso, keep); if (ent) ent.n = keep;
    var r = v(node, 2);
    S.later.push({ at: tn + RT.meltDelay, f: function (now) {         // the damage lands at the flash
      var L = X.enemies(p), hit = 0;
      for (var i = 0; i < L.length; i++) {
        var e = L[i], eq = X.pos(e); if (!eq) continue;
        if (e !== t && (Math.abs(eq.x - q.x) > r || Math.abs(eq.y - q.y) > r)) continue;
        var eid = X.uid(e);
        if (S.blast.get(eid) > now) continue;                         // one blast at a time, however many go critical together
        S.blast.set(eid, now + RT.blastCd); rad(p, e, meltAmount(e, own, node)); hit++;
      }
      X.log((node === own.critical_mass ? "MELTDOWN" : "CRITICAL BEAM meltdown") + " on " + id + ": " + hit + " enemies");
    } });
  }
  /* Fission: half the dead enemy's Isotopes split among the nearest enemies (nearest first, ties by id: deterministic) */
  function fission(p, own, S, e) {
    var n = own.fission, give = Math.ceil(e.n * RT.fissionShare), q = e.q; if (!(give > 0) || !q) return;
    var r = v(n, 2), max = Math.max(1, Math.round(v(n, 1))), L = X.enemies(p), c = [];
    for (var i = 0; i < L.length; i++) {
      var a = L[i]; if (a === e.a || X.dead(a)) continue; var aq = X.pos(a); if (!aq) continue;
      var d = Math.hypot(aq.x - q.x, aq.y - q.y); if (d <= r) c.push({ a: a, d: d, id: X.uid(a) });
    }
    c.sort(function (x, y) { return x.d - y.d || x.id - y.id }); c = c.slice(0, max);
    if (!c.length) return;
    F.play("fission", q.x, q.y + 0.8, 1, false);
    var each = Math.floor(give / c.length), rem = give % c.length;
    for (var j = 0; j < c.length; j++) {
      addIso(p, c[j].a, own, S, each + (j < rem ? 1 : 0));
      /* an arc from the dead enemy to the receiver: drawn arcLen m long along +x, stretched to the distance and turned
         toward it (mirrored for a receiver on the left, so its bow stays upward) */
      var aq = X.pos(c[j].a); if (!aq) continue;
      var dx = aq.x - q.x, dy = aq.y - q.y, d = Math.hypot(dx, dy); if (d < 0.3) continue;
      var left = dx < 0, ang = (left ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx)) * 180 / Math.PI;
      F.play("fissionArc", q.x, q.y + 0.8, d / RT.arcLen, left, 0, 1, ang);
      F.play("fissionLand", aq.x, aq.y + 0.8, 1, false);              // where it lands: a cell snaps open on the receiver
    }
    X.log("FISSION " + give + " Isotopes to " + c.length + " enemies");
  }
  /* the frame an enemy dies, the game clears its buffs before IsDead turns true: no HP left counts as dead (Fission, Cascade) */
  function hp0(a) { try { return X.f(a.Attr.HP) <= 0 } catch (x) { return false } }
  function isoTick(p, own, S, tn) {
    var dmg = isoDmg(own);
    S.iso.forEach(function (e, id) {
      if (X.dead(e.a)) { S.iso.delete(id); if (own.fission && e.mine && e.n > 0) fission(p, own, S, e); return }
      var n = X.stacksAny(e.a, B.iso);
      if (n <= 0) { S.iso.delete(id); if (own.fission && e.mine && e.n > 0 && hp0(e.a)) fission(p, own, S, e); return }
      e.n = n; e.q = X.pos(e.a) || e.q; e.mine = X.has(e.a, B.iso, p);
      if (tn < e.at) return;
      e.at = tn + isoPeriod(own);
      if (!e.mine) return;                                          // a partner's Isotopes: their owner decays them
      var k = Math.ceil(n / 2);
      X.setStack(e.a, B.iso, n - k); e.n = n - k;
      X.log("DECAY " + k + " of " + n + " on " + id + " (" + Math.round(k * dmg) + ")");
      rad(p, e.a, k * dmg);
      F.at("decay", e.a, 0.8, 1, false);
    });
  }

  /* a share of an enemy's Isotopes decays at once (Ionize): the stack drops in place and each decaying Isotope deals
     the Decay damage; the enemy's own clock is left alone. Only the Isotopes' owner decays them */
  function decayNow(p, t, own, S, share) {
    if (X.dead(t) || !X.has(t, B.iso, p)) return 0;
    var n = X.stacksAny(t, B.iso), k = Math.ceil(n * share); if (!(k > 0)) return 0;
    X.setStack(t, B.iso, n - k);
    var e = S.iso.get(X.uid(t)); if (e) e.n = n - k;
    rad(p, t, k * isoDmg(own));
    F.at("decay", t, 0.8, 1, false);
    X.log("IONIZE " + k + " of " + n + " on " + X.uid(t));
    return k;
  }
  /* ---------------- Gamma Ray tree (BATCH_03 R2) ----------------
     A Skill ray takes everything on its line at once: v2 m from the middle of the body, v3 m thick, cut by the level.
     A Legacy ray sweeps from v4 to v5 degrees round the facing direction in v6 s, v2 m long: an enemy takes it once,
     when the ray has reached it. Collimator doubles a ray's width. Scatter sends the part of a level ray that a wall
     cut off back from that wall (after a sweep: the part of its level position). Ionize makes a share of each enemy's
     Isotopes decay at once. Burst Beam fires every ray again, along the same line, for a share of its damage. */
  function rayBonus(own) { var b = 0; ["collimator", "scatter", "ionize"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function muzzle(p) {
    var pp = X.pos(p); if (!pp) return null;
    var face = 1; try { face = p.Dir < 0 ? -1 : 1 } catch (x) {}
    return { x: pp.x, y: pp.y + 0.8, face: face, gy: floorOf(pp) };
  }
  function rayHit(p, own, S, e, dmg, iso) {
    rad(p, e, dmg); addIso(p, e, own, S, iso);
    if (own.ionize) decayNow(p, e, own, S, v(own.ionize, 1));
    /* Critical Beam (Double): enough Isotopes and the ray sets off a Meltdown at once */
    if (own.critical_beam && !X.dead(e) && X.stacksAny(e, B.iso) >= v(own.critical_beam, 3)) meltdown(p, e, own, S, S.iso.get(X.uid(e)), own.critical_beam);
  }
  /* a level ray from (x, y) toward dir: every enemy within `half` (plus its own half width) of the line, out to the wall */
  function lineRay(p, own, S, x, y, dir, len, half, dmg, iso, scatter) {
    var reach = X.ray(x, y, dir, 0, len), L = X.enemies(p), n = 0;
    F.play("gammaRay", x, y, reach / RT.rayLen, dir < 0, 0, half / RT.rayHalf);
    for (var i = 0; i < L.length; i++) {
      var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
      var s = (q.x - x) * dir, d = Math.abs(q.y + 0.8 - y);
      if (s < -0.3 || s > reach || d > half + RT.jetBody) continue;
      rayHit(p, own, S, e, dmg, iso); n++;
    }
    if (scatter && reach < len - 0.5) n += lineRay(p, own, S, x + dir * reach, y, -dir, len - reach, half, dmg, iso, false);
    return n;
  }
  function rayHalf(own, node) { return v(node, 3) / 2 * (own.collimator ? v(own.collimator, 1) : 1) }
  function fireRay(p, own, S, tn, node, at, again) {
    if (!at) return false;
    var n = lineRay(p, own, S, at.x, at.y, at.face, v(node, 2), rayHalf(own, node), v(node, 0) * (1 + rayBonus(own)) * (again || 1), Math.round(v(node, 1)), !!own.scatter);
    X.log("GAMMA RAY " + (at.face > 0 ? "right" : "left") + (again ? " (burst)" : "") + ": " + n + " enemies");
    if (!again && own.gamma_trail && own.dash_fallout) {             // Gamma Trail (Double): fallout on the floor under the ray's path
      var xe = at.x + at.face * X.ray(at.x, at.y, at.face, 0, v(node, 2));
      putTrail(p, own, S, tn, Math.min(at.x, xe), Math.max(at.x, xe), at.gy, at.x, own.hot_zone ? v(own.hot_zone, 2) : v(own.dash_fallout, 2));
    }
    if (!again && own.burst_beam) S.later.push({ at: tn + RT.rayAgain, f: function (now) {
      var o = owned(p); if (o.skill_gamma_ray && o.burst_beam) fireRay(p, o, S, now, o.skill_gamma_ray, at, v(o.burst_beam, 0));
    } });
    return true;
  }
  function fireSweep(p, own, S, tn, node, at, again) {
    if (!at) return false;
    F.play("gammaSweep", at.x, at.y, v(node, 2) / RT.sweepLen, at.face < 0);
    S.rays.push({ x: at.x, y: at.y, gy: at.gy, face: at.face, t0: tn, T: v(node, 6), a0: v(node, 4), a1: v(node, 5), len: v(node, 2), half: rayHalf(own, node),
                  dmg: v(node, 0) * (1 + rayBonus(own)) * (again || 1), iso: Math.round(v(node, 1)), hit: new Set, n: 0, again: !!again });
    return true;
  }
  /* the sweeping rays: an enemy is taken once the ray's angle has reached it (its own width counted as an angle) */
  function rayTick(p, own, S, tn) {
    if (!S.rays.length) return;
    var L = X.enemies(p), DEG = 180 / Math.PI;
    for (var k = S.rays.length - 1; k >= 0; k--) {
      var r = S.rays[k], a = r.a0 + (r.a1 - r.a0) * Math.min(1, (tn - r.t0) / r.T);
      for (var i = 0; i < L.length; i++) {
        var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
        var id = X.uid(e); if (r.hit.has(id)) continue;
        var rx = (q.x - r.x) * r.face, ry = q.y + 0.8 - r.y, d = Math.hypot(rx, ry);
        if (d > r.len + RT.jetBody) continue;
        var tol = d > 0.3 ? Math.asin(Math.min(1, (r.half + RT.jetBody) / d)) * DEG : 90, ang = Math.atan2(ry, rx) * DEG;
        if (ang < r.a0 - tol || ang > a + tol) continue;
        r.hit.add(id); r.n++; rayHit(p, own, S, e, r.dmg, r.iso);
      }
      if (tn - r.t0 < r.T) continue;
      S.rays.splice(k, 1);
      X.log("GAMMA SWEEP " + (r.face > 0 ? "right" : "left") + (r.again ? " (burst)" : "") + ": " + r.n + " enemies");
      if (own.scatter) {                                             // what a wall cut off its level position runs back along the floor
        var reach = X.ray(r.x, r.y, r.face, 0, r.len);
        if (reach < r.len - 0.5) lineRay(p, own, S, r.x + r.face * reach, r.y, -r.face, r.len - reach, r.half, r.dmg, r.iso, false);
      }
      if (!r.again && own.gamma_trail && own.dash_fallout) {         // Gamma Trail: under the sweep's level position
        var xs = r.x + r.face * X.ray(r.x, r.y, r.face, 0, r.len);
        putTrail(p, own, S, tn, Math.min(r.x, xs), Math.max(r.x, xs), r.gy, r.x, own.hot_zone ? v(own.hot_zone, 2) : v(own.dash_fallout, 2));
      }
      if (!r.again && own.burst_beam && own.legacy_gamma_ray) fireSweep(p, own, S, tn, own.legacy_gamma_ray, { x: r.x, y: r.y, face: r.face }, v(own.burst_beam, 0));
    }
  }

  /* ---------------- Reactor tree (BATCH_03 R3) ----------------
     Legacy Reactor drops a core RT.coreUp m over the floor under the player for v2 s. Every v3 s it pulses: Radiation
     damage and v1 Isotopes to the enemies within v4 m. Overclocked Core pulses faster; Containment Field reaches
     further and slows what is inside; Scram makes a core whose time is up explode for its v0 times the pulses that
     reached an enemy. A new cast replaces the oldest core (no Scram: its time was not up). Chain Reaction allows v1
     cores and links cores within v2 m of each other with a beam that takes what stands in it every v3 s. */
  function reactorBonus(own) { var b = 0; ["overclocked_core", "containment_field"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function dropCore(p, own, S, tn) {
    var node = own.legacy_reactor, pp = X.pos(p); if (!pp) return false;
    var max = own.chain_reaction ? Math.max(1, Math.round(v(own.chain_reaction, 1))) : 1;
    while (S.cores.length >= max) endCore(p, own, S, S.cores.shift(), tn, false);
    var gy = floorOf(pp), R = own.containment_field ? v(own.containment_field, 1) : v(node, 4), life = v(node, 2);
    var c = { x: pp.x, y: gy + RT.coreUp, r: R, until: tn + life + 1e-6, every: own.overclocked_core ? v(own.overclocked_core, 1) : v(node, 3), pulses: 0 };
    c.next = tn + c.every;
    c.fx = F.play("reactorCore", c.x, c.y, R / RT.coreR, false, life);   // held for the core's life
    S.cores.push(c); relink(p, own, S, tn);
    X.log("REACTOR core at " + c.x.toFixed(1) + ", reach " + R);
    return true;
  }
  /* a core goes: replaced (its effect is stopped) or its time is up (Scram) */
  function endCore(p, own, S, c, tn, timeUp) {
    F.stop(c.fx);
    if (timeUp && own.scram && c.pulses > 0) {
      var amt = v(own.scram, 0) * c.pulses;
      F.play("meltdown", c.x, c.y, RT.scramScale, false);
      S.later.push({ at: tn + RT.meltDelay, f: function () {            // the damage lands at the flash
        var L = X.enemies(p), n = 0;
        for (var i = 0; i < L.length; i++) {
          var q = X.pos(L[i]); if (!q || X.dead(L[i]) || Math.hypot(q.x - c.x, q.y + 0.8 - c.y) > c.r) continue;
          rad(p, L[i], amt); n++;
        }
        X.log("SCRAM at " + c.x.toFixed(1) + ": " + c.pulses + " pulses, " + n + " enemies");
      } });
    }
    relink(p, own, S, tn);
  }
  /* Chain Reaction: a beam between every two cores within range (drawn RT.beamLen m long: turned and stretched) */
  function relink(p, own, S, tn) {
    for (var i = 0; i < S.links.length; i++) F.stop(S.links[i].fx);
    S.links = [];
    if (!own.chain_reaction) return;
    var range = v(own.chain_reaction, 2);
    for (var a = 0; a < S.cores.length; a++) for (var b = a + 1; b < S.cores.length; b++) {
      var c1 = S.cores[a], c2 = S.cores[b], dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
      if (d < 0.5 || d > range) continue;
      var left = dx < 0, ang = (left ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx)) * 180 / Math.PI;
      S.links.push({ a: c1, b: c2, d: d, next: tn + v(own.chain_reaction, 3),
                     fx: F.play("chainBeam", c1.x, c1.y, d / RT.beamLen, left, Math.min(c1.until, c2.until) - tn, 1, ang) });
    }
  }
  /* a ray from (x, y) along the unit direction (dx, dy): as lineRay, at any angle; the effect is turned (and mirrored
     for a ray going left, as the Fission arc is) */
  function aimRay(p, own, S, x, y, dx, dy, len, half, dmg, iso) {
    var reach = X.ray(x, y, dx, dy, len), L = X.enemies(p), n = 0, left = dx < 0;
    F.play("gammaRay", x, y, reach / RT.rayLen, left, 0, half / RT.rayHalf, (left ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx)) * 180 / Math.PI);
    for (var i = 0; i < L.length; i++) {
      var e = L[i], q = X.pos(e); if (!q || X.dead(e)) continue;
      var rx = q.x - x, ry = q.y + 0.8 - y, s = rx * dx + ry * dy;
      if (s < -0.3 || s > reach || Math.abs(rx * dy - ry * dx) > half + RT.jetBody) continue;
      rayHit(p, own, S, e, dmg, iso); n++;
    }
    return n;
  }
  /* Reactor Beam (Double: Reactor's tier III + any Gamma Ray tier I): a core fires the owned Gamma Ray at the enemy
     carrying the most Isotopes round it (none irradiated: the nearest), with that ray's numbers and bonuses */
  function coreBeam(p, own, S, c) {
    var node = own.skill_gamma_ray || own.legacy_gamma_ray; if (!node) return;
    var t = wispTarget(p, c.x, c.y, null), q = t && X.pos(t.a); if (!q) return;
    var dx = q.x - c.x, dy = q.y + 0.8 - c.y, d = Math.hypot(dx, dy); if (d < 0.2) { dx = 1; dy = 0; d = 1 }
    var n = aimRay(p, own, S, c.x, c.y, dx / d, dy / d, v(node, 2), rayHalf(own, node), v(node, 0) * (1 + rayBonus(own)) * v(own.reactor_beam, 0), Math.round(v(node, 1)));
    X.log("REACTOR BEAM from " + c.x.toFixed(1) + ": " + n + " enemies");
  }
  function coreTick(p, own, S, tn) {
    if (!S.cores.length) return;
    var node = own.legacy_reactor, L = X.enemies(p);
    for (var k = S.cores.length - 1; k >= 0; k--) {
      var c = S.cores[k];
      if (node && tn >= c.next && c.next <= c.until) {
        c.next += c.every;
        var dmg = v(node, 0) * (1 + reactorBonus(own)), n = 0;
        var cr = c.r * (own.wisp_core && tn < S.wispUntil ? v(own.wisp_core, 0) : 1);
        F.play("reactorPulse", c.x, c.y, cr / RT.coreR, false);
        for (var i = 0; i < L.length; i++) {
          var e = L[i], q = X.pos(e); if (!q || X.dead(e) || Math.hypot(q.x - c.x, q.y + 0.8 - c.y) > cr) continue;
          rad(p, e, dmg); addIso(p, e, own, S, Math.round(v(node, 1))); n++;
          if (own.containment_field) {                               // slowed until a pulse no longer reaches it
            if (X.has(e, B.field, p)) X.restart(e, B.field); else X.add(e, B.field, c.every + 0.3, v(own.containment_field, 2), 1, p);
          }
        }
        if (n && cr > c.r) X.log("WISP CORE pulse, reach " + cr);
        if (n) c.pulses++;                                           // a pulse that reaches nobody doesn't count for Scram
        c.count = (c.count || 0) + 1;                                // Reactor Beam (Double): every v1-th pulse fires a gamma ray
        if (own.reactor_beam && c.count % Math.max(1, Math.round(v(own.reactor_beam, 1))) === 0) coreBeam(p, own, S, c);
      }
      if (tn < c.until) continue;
      S.cores.splice(k, 1); endCore(p, own, S, c, tn, true);
    }
    if (!S.links.length || !own.chain_reaction) return;
    var every = v(own.chain_reaction, 3);
    for (var m = 0; m < S.links.length; m++) {
      var ln = S.links[m]; if (tn < ln.next) continue;
      ln.next += every;
      var ux = (ln.b.x - ln.a.x) / ln.d, uy = (ln.b.y - ln.a.y) / ln.d;
      for (var i2 = 0; i2 < L.length; i2++) {
        var e2 = L[i2], q2 = X.pos(e2); if (!q2 || X.dead(e2)) continue;
        var rx = q2.x - ln.a.x, ry = q2.y + 0.8 - ln.a.y, s = rx * ux + ry * uy;
        if (s < 0 || s > ln.d || Math.abs(rx * uy - ry * ux) > RT.beamHalf + RT.jetBody) continue;
        rad(p, e2, v(own.chain_reaction, 0)); addIso(p, e2, own, S, Math.round(v(own.chain_reaction, 4)));
      }
    }
  }

  /* ---------------- Cherenkov Wisp tree (BATCH_03 R5) ----------------
     Every v1 s a wisp goes to the enemy carrying the most of this player's Isotopes (none irradiated: the nearest) and,
     v4 s later, pulses: a share v2 of its Isotopes decays at once for v0 times their Decay damage (no Isotopes: v3
     damage). Twin Wisps sends a second wisp to the next enemy; Resonance adds Isotopes round the pulse; Brilliance
     damages everything round it; Cascade sends the pulse on at once when the pulsed enemy dies inside its window.
     The wisp starts at the player and DOTween flies it to the target over its flight time, then it lingers. */
  function wispBonus(own) { var b = 0; ["twin_wisps", "resonance"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function myIso(t, p) { return X.has(t, B.iso, p) ? X.stacksAny(t, B.iso) : 0 }
  /* the enemy a wisp goes to: the most Isotopes, then the nearest to (x, y), then the lowest id; `skip` = ids taken */
  function wispTarget(p, x, y, skip) {
    var L = X.enemies(p), best = null;
    for (var i = 0; i < L.length; i++) {
      var e = L[i], q = X.pos(e); if (!q || X.dead(e) || hp0(e)) continue;
      var id = X.uid(e); if (skip && skip.has(id)) continue;
      if (Math.abs(q.x - x) > RT.poolScanX || Math.abs(q.y - y) > RT.poolScanY) continue;
      var c = { a: e, id: id, n: myIso(e, p), d: Math.hypot(q.x - x, q.y - y) };
      if (!best || c.n > best.n || (c.n === best.n && (c.d < best.d || (c.d === best.d && c.id < best.id)))) best = c;
    }
    return best;
  }
  function summonWisp(p, own, S, tn) {
    var node = own.summon_wisp, pp = X.pos(p); if (!node || !pp || tn < S.wispCd) return false;
    var want = 1 + (own.twin_wisps ? Math.round(v(own.twin_wisps, 1)) : 0), skip = new Set, made = 0;
    for (var k = 0; k < want; k++) {
      var c = wispTarget(p, pp.x, pp.y, skip); if (!c) break;
      skip.add(c.id); made++;
      sendWisp(p, S, c.a, tn, v(node, 4), v(node, 5), 0);
    }
    if (!made) return false;
    S.wispCd = tn + v(node, 1);
    X.log("WISP x" + made);
    return true;
  }
  /* a wisp at `t`, held for its flight time and its linger; the pulse comes `fly` s later (0: at once) */
  function sendWisp(p, S, t, tn, fly, linger, chain) {
    var q = X.pos(t); if (!q) return;
    S.wispUntil = Math.max(S.wispUntil, tn + fly + linger);
    var pp = fly > 0 ? X.pos(p) : null;
    var h = F.play("wisp", pp ? pp.x : q.x, (pp ? pp.y : q.y) + 0.8, 1, false, fly + linger);
    if (h && pp) F.fly(h, q.x, q.y + 0.8, fly);
    if (fly > 0) S.later.push({ at: tn + fly, f: function (now) { wispPulse(p, owned(p), S, t, now, chain) } });
    else wispPulse(p, owned(p), S, t, tn, chain);
  }
  function wispPulse(p, own, S, t, tn, chain) {
    var node = own.summon_wisp; if (!node) return;
    if (X.dead(t) || hp0(t)) { var pp = X.pos(p), c = pp && wispTarget(p, pp.x, pp.y, null); if (!c) return; t = c.a }   // it died first: the next one
    var q = X.pos(t); if (!q) return;
    var n = myIso(t, p), mult = 1 + wispBonus(own), id = X.uid(t);
    if (n > 0) {
      var k = Math.ceil(n * v(node, 2));
      X.setStack(t, B.iso, n - k); var e = S.iso.get(id); if (e) e.n = n - k;
      rad(p, t, k * isoDmg(own) * v(node, 0) * mult);
      X.log("WISP pulse on " + id + ": " + k + " of " + n);
    } else { rad(p, t, v(node, 3) * mult); X.log("WISP pulse on " + id + ": base") }
    F.play("wispPulse", q.x, q.y + 0.8, 1, false);
    if (own.resonance || own.brilliance) {
      var L = X.enemies(p);
      for (var i = 0; i < L.length; i++) {
        var a = L[i], aq = X.pos(a); if (!aq || X.dead(a)) continue;
        var d = Math.hypot(aq.x - q.x, aq.y - q.y);
        if (own.brilliance && d <= v(own.brilliance, 1)) rad(p, a, v(own.brilliance, 0));
        if (own.resonance && d <= v(own.resonance, 2) && !X.dead(a)) addIso(p, a, own, S, Math.round(v(own.resonance, 1)));
      }
    }
    if (own.cascade) S.wisps.push({ a: t, until: tn + v(own.cascade, 1), chain: chain, q: q });
  }
  /* Cascade: a pulsed enemy that dies inside its window sends the pulse on to the next enemy, at once */
  function wispTick(p, own, S, tn) {
    if (!S.wisps.length) return;
    var W2 = S.wisps; S.wisps = [];
    for (var i = 0; i < W2.length; i++) {
      var w = W2[i];
      if (!X.dead(w.a) && !hp0(w.a)) { if (tn <= w.until) S.wisps.push(w); continue }
      if (!own.cascade || !own.summon_wisp || w.chain + 1 >= Math.round(v(own.cascade, 2))) continue;
      var c = wispTarget(p, w.q.x, w.q.y, null); if (!c) continue;
      X.log("CASCADE to " + c.id);
      sendWisp(p, S, c.a, tn, 0, v(own.summon_wisp, 5), w.chain + 1);
    }
  }

  /* ---------------- Fallout Step tree (BATCH_03 R4) ----------------
     Dash Fallout: a dash leaves a fallout trail on the floor under its path for v2 s. The path is read RT.dashTime s
     after the dash starts: from where it began to where the player then is, RT.trailMin m at least. Every v3 s the
     trail deals Radiation damage and adds v1 Isotopes to the enemies standing in it (their feet within v5 m over the
     floor). Hot Zone doubles that reach and lengthens the trail's life; Accelerant makes the Isotopes of the enemies
     inside decay twice as fast (every tick inside takes one tick's time off their Decay clock); Glowing Path fuses a
     new trail and an older one it crosses into a zone, which ticks like a trail with its own damage. */
  function falloutBonus(own) { var b = 0; ["hot_zone", "accelerant"].forEach(function (k) { if (own[k]) b += v(own[k], 0) }); return b }
  function startTrail(p, S, tn, list) {
    var pp = X.pos(p); if (!pp) return false;
    var face = 1; try { face = p.Dir < 0 ? -1 : 1 } catch (x) {}
    (list || S.dashes).push({ x0: pp.x, gy: floorOf(pp), face: face, at: tn + RT.dashTime });
    return true;
  }
  function layTrail(p, own, S, tn, d) {
    var node = own.dash_fallout, pp = X.pos(p); if (!node || !pp) return;
    var x1 = pp.x; if (Math.abs(x1 - d.x0) < RT.trailMin) x1 = d.x0 + d.face * RT.trailMin;
    putTrail(p, own, S, tn, Math.min(d.x0, x1), Math.max(d.x0, x1), d.gy, d.x0, own.hot_zone ? v(own.hot_zone, 2) : v(node, 2));
  }
  /* fallout on the floor from a to b for `life` s, ticking with Dash Fallout's numbers: a trail drawn from `from`
     (mirrored when it runs to the left of it) or, with from === null, a patch drawn with the zone effect (Fallout
     Fission). Glowing Path fuses it with an older trail it crosses */
  function putTrail(p, own, S, tn, a, b, gy, from, life) {
    var node = own.dash_fallout; if (!node) return;
    var d = { gy: gy }, up = own.hot_zone ? v(own.hot_zone, 1) : v(node, 5);
    if (own.glowing_path) for (var k = 0; k < S.trails.length; k++) {  // it crosses an older trail on the same floor: both become one zone
      var o = S.trails[k]; if (o.zone || Math.abs(o.gy - d.gy) > 1 || o.x1 < a || o.x0 > b) continue;
      F.stop(o.fx); S.trails.splice(k, 1);
      var g = own.glowing_path, cx = (Math.max(o.x0, a) + Math.min(o.x1, b)) / 2, half = v(g, 1) / 2, zl = v(g, 2);
      S.trails.push({ zone: true, x0: cx - half, x1: cx + half, gy: d.gy, up: up, until: tn + zl + 1e-6, every: v(g, 3), next: tn + v(g, 3),
                      fx: F.play("falloutZone", cx, d.gy, v(g, 1) / RT.zoneSize, false, zl) });
      X.log("GLOWING PATH zone at " + cx.toFixed(1));
      return;
    }
    S.trails.push({ x0: a, x1: b, gy: gy, up: up, until: tn + life + 1e-6, every: v(node, 3), next: tn + v(node, 3),
                    fx: from === null ? F.play("falloutZone", (a + b) / 2, gy, (b - a) / RT.zoneSize, false, life)
                                      : F.play("falloutTrail", from, gy, (b - a) / RT.trailLen, from > a, life, up / v(node, 5)) });
    X.log("FALLOUT trail " + a.toFixed(1) + " .. " + b.toFixed(1));
  }
  function falloutTick(p, own, S, tn) {
    for (var i = S.dashes.length - 1; i >= 0; i--) if (tn >= S.dashes[i].at) { var d = S.dashes[i]; S.dashes.splice(i, 1); layTrail(p, own, S, tn, d) }
    if (!S.trails.length) return;
    var node = own.dash_fallout, L = null;
    for (var k = S.trails.length - 1; k >= 0; k--) {
      var t = S.trails[k];
      if (tn >= t.next && t.next <= t.until) {
        t.next += t.every; L = L || X.enemies(p);
        var dmg = t.zone ? (own.glowing_path ? v(own.glowing_path, 0) : 0) : (node ? v(node, 0) * (1 + falloutBonus(own)) : 0);
        for (var j = 0; j < L.length; j++) {
          var e = L[j], q = X.pos(e); if (!q || X.dead(e)) continue;
          if (q.x < t.x0 || q.x > t.x1 || q.y < t.gy - 0.3 || q.y > t.gy + t.up) continue;
          var id = X.uid(e); if (S.foHit.get(id) > tn - RT.foTickCd) continue;   // one trail at a time
          S.foHit.set(id, tn);
          rad(p, e, dmg); addIso(p, e, own, S, node ? Math.round(v(node, 1)) : 1);
          if (own.accelerant) { var en = S.iso.get(id); if (en) en.at -= t.every * (v(own.accelerant, 1) - 1) }
        }
      }
      if (t.next > t.until) S.trails.splice(k, 1);
    }
  }
  /* Dodge Flash: a Perfect Dodge (the stock SuccessDodge trigger) flashes round the player, on the floor */
  function onDodge(p) {
    var own = owned(p); if (!own.dodge_flash && !own.dodge_swell) return false;
    X.epoch();
    var S = state(p), tn = X.now(), pp = X.pos(p); if (!(tn >= 0) || !pp) return false;
    var done = false;
    if (own.dodge_swell && tn >= S.swellCd) {                        // Dodge Swell: a swell rolls out behind you
      S.swellCd = tn + v(own.dodge_swell, 2);
      var face = 1; try { face = p.Dir < 0 ? -1 : 1 } catch (x) {}
      swell(p, own, S, pp.x, pp.y, floorOf(pp), -face, v(own.dodge_swell, 1));
      X.log("DODGE SWELL " + (face > 0 ? "left" : "right")); done = true;
    }
    if (!own.dodge_flash || tn < S.flashCd) return done;
    var n = own.dodge_flash, r = v(n, 2), L = X.enemies(p), hit = 0;
    S.flashCd = tn + v(n, 3);
    F.play("falloutFlash", pp.x, floorOf(pp), r / RT.flashR, false);
    for (var i = 0; i < L.length; i++) {
      var q = X.pos(L[i]); if (!q || X.dead(L[i]) || Math.hypot(q.x - pp.x, q.y - pp.y) > r) continue;
      rad(p, L[i], v(n, 0)); addIso(p, L[i], own, S, Math.round(v(n, 1))); hit++;
    }
    X.log("DODGE FLASH: " + hit + " enemies");
    return true;
  }

  /* ---------------- Mutagen (Toxin Double: Poison III + Isotope I) ----------------
     Once a second, each enemy carrying this player's stock Poison (33551; RootCaster = the player) gains Isotopes
     (doubled on bosses), and every v1 Isotopes on it bring the Poison forward by v2 s: its public TimeEllapsed is raised,
     so the native kill (or the boss burst) and the countdown ring follow. Never below mutagenFloor s left per step. */
  function mutTick(p, own, S, tn) {
    var n = own.mutagen, L = X.enemies(p), live = new Set;
    for (var i = 0; i < L.length; i++) {
      var e = L[i], pb = null, rc = null;
      try { pb = e.BuffMgr.Find(RT.poisonBuff); rc = pb && (pb.RootCaster || pb.Caster) } catch (x) {}
      if (!pb || !rc || X.uid(rc) !== X.uid(p)) continue;
      var id = X.uid(e), due = S.mut.get(id); live.add(id);
      if (due === undefined) { S.mut.set(id, tn + 1); continue }
      if (tn < due) continue;
      S.mut.set(id, tn + 1);
      addIso(p, e, own, S, Math.round(v(n, 0) * (X.isBoss(e) ? v(n, 3) : 1)));
      var steps = Math.floor(X.stacksAny(e, B.iso) / Math.max(1, v(n, 1)));
      if (steps <= 0) continue;
      try {
        var adv = Math.min(steps * v(n, 2), X.f(pb.TimeRemain) - RT.mutagenFloor);
        if (adv > 0) { pb.TimeEllapsed = X.fp(X.f(pb.TimeEllapsed) + adv); X.log("MUTAGEN Poison +" + adv.toFixed(2) + " s on " + id); F.at("mutagenTick", e, 0.8, 1, false) }
      } catch (x) { X.once("mut", "Mutagen poison timer EXC " + x) }
    }
    S.mut.forEach(function (_d, id) { if (!live.has(id)) S.mut.delete(id) });   // a new Poison waits its first second
  }

  /* ---------------- hits ---------------- */
  var seen = new Map, lastK = "", lastT = -1;
  function family(g) { return g === 2 || g === 3 ? "skill" : g === 9 || g === 10 ? "legacy" : g >= 1 ? "attack" : "?" }
  function onHit(p, node, a) {
    if (!a) return false;
    var k = ""; try { k = X.uid(p) + ":" + a.Ssss.SkillSessionId + ":" + a.Target.UniqueId } catch (x) {}
    X.epoch();
    /* the same hit reaching another owned node: same player, skill session and target at the same battle time. The hit
       object itself says nothing: the engine reuses one for every hit of a skill session (in game 2026-10-03 a multi-hit
       Skill on a single enemy counted once) */
    var t0 = X.now();
    if (k === lastK && t0 === lastT) return false;
    lastK = k; lastT = t0;
    var t = null, sid = -1, g = -1, gen = false;
    try { t = a.Target; var s = a.Ssss; sid = s.SkillSessionId; gen = !!s.TriggerNode; g = s.SkillActivate ? s.SkillActivate.Group : -1 } catch (x) { X.once("pay", "hit payload EXC " + x) }
    if (!t || gen) return false;                           // Tactic-made hits never feed Tactics
    var tn = X.now(); if (!(tn >= 0)) return false;
    var key = sid + ":" + X.uid(t); if (seen.get(key) > tn - 0.05) return false;
    seen.set(key, tn); if (seen.size > 2000) seen.delete(seen.keys().next().value);
    var own = owned(p); if (!own._any) return false;
    var S = state(p), fam = family(g);
    S.hit.set(X.uid(t), tn);
    if (fam === "?") return true;                              // not an Attack / Skill / Legacy hit (e.g. Tactic damage)
    if (isoNode(own)) {
      var ni = fam === "attack" && own.attack_isotope ? v(own.attack_isotope, 1) : fam === "skill" && own.skill_isotope ? v(own.skill_isotope, 1) : 0;
      if (ni > 0) addIso(p, t, own, S, Math.round(ni + (own.enrichment ? v(own.enrichment, 1) : 0)));
    }
    if (!soakNode(own)) return true;
    var wasSoaked = soaked(t, p), movable = X.launchable(t);
    if ((fam === "attack" && own.attack_soak) || (fam === "skill" && own.skill_soak)) soak(p, t, own, S);
    /* Skill Soak: the hit's splash pushes the enemy away (the Soaked knockback does the rest) */
    if (fam === "skill" && own.skill_soak && movable && !own.undertow) {
      var q = X.pos(t), pp = X.pos(p);
      var pk = sid + ":" + X.uid(t);
      if (q && pp && !S.pushed.has(pk)) {
        S.pushed.set(pk, tn); if (S.pushed.size > 500) S.pushed.delete(S.pushed.keys().next().value);
        X.addVel(t, (q.x >= pp.x ? 1 : -1) * v(own.skill_soak, 4), 2);
        if (!(S.splashAct.get(sid) > tn - 1)) { S.splashAct.set(sid, tn); F.play("skillSplash", q.x, q.y + 0.6, 1, q.x < pp.x) }
      }
    }
    if (wasSoaked) pressure(p, t, own, S, 1);
    return true;
  }

  /* ---------------- events ---------------- */
  function onDash(p, node) {
    var own = owned(p); if (!own.dash_soak && !own.dash_fallout && !own.dash_riptide) return false;
    X.epoch();
    var S = state(p), tn = X.now(); if (!(tn >= 0)) return false;
    var laid = false;                                                 // Dash Fallout and Dash Riptide: laid when the dash is over
    if (own.dash_fallout && tn >= S.falloutCd) { S.falloutCd = tn + v(own.dash_fallout, 4); laid = startTrail(p, S, tn) }
    if (own.dash_riptide && tn >= S.ripCd) { S.ripCd = tn + v(own.dash_riptide, 4); laid = startTrail(p, S, tn, S.rips) || laid }
    var n = own.dash_soak; if (!n || tn < S.dashCd) return laid;
    S.dashCd = tn + v(n, 4);
    var pp = X.pos(p); if (!pp) return laid;
    var face = 1; try { face = p.Dir < 0 ? -1 : 1 } catch (x) {}
    var h = X.ground(pp), gy = pp.y - h, cr = RT.waves.dash.crest;   // an air dash's wave still stands on the floor,
    F.play("dashWave", pp.x, gy, 1, face < 0, 0, (h + cr) / cr);       // stretched up to your height
    F.play("dashGround", pp.x, gy, 1, face < 0);
    launchWave(p, S, "dash", pp.x, pp.y, face, v(n, 5), null, gy);   // a wave thrown v5 m ahead of the dash (see waveTick)
    if (h > 0.3) X.log("DASH WAVE in the air, " + h.toFixed(2) + " m up");
    SND.play("dashWave", p, 0.2);
    return true;
  }
  /* a Legacy Skill (or a Skill) starts: the cast Tactics. One per kind per battle moment, whichever node reports it */
  function onCast(p, kind) {
    var own = owned(p); if (!own._any) return false;
    X.epoch();
    var S = state(p), tn = X.now(); if (!(tn >= 0) || S.castT[kind] === tn) return false;
    S.castT[kind] = tn;
    var done = false;
    if (kind === "legacy" && own.legacy_geyser) done = legacyGeyser(p, own, S, tn) || done;
    if (kind === "legacy" && own.legacy_hydro_jet) {
      var n = Math.max(1, Math.round(v(own.legacy_hydro_jet, 4))), step = v(own.legacy_hydro_jet, 5), fan = [];
      for (var i = 0; i < n; i++) fan.push(i * step);
      done = fireJets(p, own, S, tn, own.legacy_hydro_jet, fan) || done;
    }
    if (kind === "skill" && own.skill_hydro_jet && tn >= S.jetCd) {
      S.jetCd = tn + v(own.skill_hydro_jet, 4);
      done = fireJets(p, own, S, tn, own.skill_hydro_jet, [0]) || done;
    }
    if (kind === "legacy" && own.legacy_gamma_ray) done = fireSweep(p, own, S, tn, own.legacy_gamma_ray, muzzle(p), 0) || done;
    if (kind === "legacy" && own.legacy_reactor) done = dropCore(p, own, S, tn) || done;
    if (kind === "skill" && own.skill_gamma_ray && tn >= S.rayCd) {
      S.rayCd = tn + v(own.skill_gamma_ray, 4);
      done = fireRay(p, own, S, tn, own.skill_gamma_ray, muzzle(p), 0) || done;
    }
    return done;
  }
  /* the Summon slot's trigger: the engine calls it on its cooldown while an enemy is in its scan box */
  function onSummon(p) {
    var own = owned(p); if (!own.summon_whirlpool && !own.summon_wisp) return false;
    X.epoch();
    var tn = X.now(); if (!(tn >= 0)) return false;
    var S = state(p), done = false;
    if (own.summon_whirlpool) done = summonPool(p, own, S, tn) || done;
    if (own.summon_wisp) done = summonWisp(p, own, S, tn) || done;
    return done;
  }
  /* wall / floor impacts: native events on the last attacker's triggers, with the victim */
  function onImpact(kind, p, victim) {
    var own = owned(p); if (!waterAny(own)) return false;
    var t = null; try { t = victim && victim.BuffMgr ? victim : (victim && victim.Target && victim.Target.BuffMgr ? victim.Target : null) } catch (x) {}
    if (!t || !soaked(t, p)) return false;
    X.epoch(); return crash(p, t, kind, own, state(p));
  }
  /* 20 times a second: a Soaked enemy flying from one of our hits that meets another enemy is a Crash for both */
  /* Conductive Current: the stock chain is one native LightningJump on bullet 800002 ("shandianlian"), which reads its
     remaining jumps from the bullet's ExtParams "Jumps" 0.1 s after the bullet starts. A chain seen before then gets one
     more jump per Soaked enemy near it (v0 m, at most v1); every Soaked enemy that chain strikes takes a Crash */
  function chainTick(p, own, S, tn) {
    var n = own.conductive_current, L;
    try { L = CS.GamePlay.BattleBase.Cur.BulletMgr.BulletList } catch (x) { X.once("cc_list", "Conductive Current: bullet list EXC " + x); return }
    if (!S.chains) S.chains = new Map;
    var pid = X.uid(p), alive = new Set;
    for (var i = 0; i < L.Count; i++) {
      var b = L.get_Item(i);
      try { if (!b || b.BaseID != 800002 || X.uid(b.RootCaster) !== pid) continue } catch (x) { continue }
      var bid = X.uid(b); alive.add(bid);
      var c = S.chains.get(bid);
      if (!c) {
        c = { hit: new Set }; S.chains.set(bid, c);
        var bq = X.pos(b), E = X.enemies(p), near = [];
        for (var k = 0; k < E.length; k++) {
          var q = X.pos(E[k]), d = bq && q ? Math.hypot(q.x - bq.x, q.y - bq.y) : 1e9;
          if (d <= v(n, 0) && soaked(E[k], p)) near.push({ e: E[k], d: d });
        }
        var soakedNear = near.length;
        /* the native jump picks its own targets and raises no event, so the Crashes follow the chain's pace instead:
           the Soaked enemies nearest the chain first, one per hop (the first hop at 0.1 s, then every chainHop s) */
        near.sort(function (a, b2) { return a.d - b2.d });
        near.forEach(function (o, idx) {
          S.later.push({ at: tn + 0.1 + idx * RT.chainHop, f: function () { if (soaked(o.e, p) && crash(p, o.e, "floor", own, S)) { F.at("conductive", o.e, 0.8, 1, false); X.log("CONDUCT crash on " + X.uid(o.e)) } } });
        });
        var add = Math.min(Math.round(v(n, 1)), soakedNear);
        X.log("CONDUCT chain " + bid + " seen, " + soakedNear + " Soaked within " + v(n, 0) + " m");
        if (add > 0) {
          try {
            var ps = b.ExtParams, j = ps.GetI("Jumps", 0); ps.Set("Jumps", j + add);
            X.log("CONDUCT chain " + bid + " jumps " + j + " -> " + ps.GetI("Jumps", 0) + " (" + soakedNear + " Soaked near)");
          } catch (x) { X.once("cc_set", "Conductive Current: Jumps write EXC " + x) }
        }
      }
    }
    S.chains.forEach(function (_c, id) { if (!alive.has(id)) S.chains.delete(id) });
  }
  function poll(p) {
    var own = owned(p), soak = waterAny(own), iso = radAny(own); if (!soak && !iso) return false;
    X.epoch();
    var S = state(p), tn = X.now(); if (!(tn >= 0)) return false;
    X.flush(tn);
    if (S.later.length) {                                           // delayed steps, on the battle clock
      var due = S.later.filter(function (x) { return x.at <= tn }); S.later = S.later.filter(function (x) { return x.at > tn });
      for (var d0 = 0; d0 < due.length; d0++) due[d0].f(tn);
    }
    if (iso) { isoTick(p, own, S, tn); rayTick(p, own, S, tn); coreTick(p, own, S, tn); wispTick(p, own, S, tn); falloutTick(p, own, S, tn) }
    if (iso && own.mutagen) mutTick(p, own, S, tn);
    if (!soak) return true;
    waveTick(p, own, S, tn); currentTick(p, own, S, tn);
    geyserTick(p, own, S, tn);
    jetTick(p, own, S, tn); lineTick(p, own, S, tn); poolTick(p, own, S, tn);
    if (own.conductive_current) chainTick(p, own, S, tn);
    var L = X.enemies(p), P = [];
    for (var i = 0; i < L.length; i++) {
      var q = X.pos(L[i]); if (!q) continue;
      var id = X.uid(L[i]), pr = S.prev.get(id), known = !!pr && tn > pr.t;
      P.push({ a: L[i], q: q, id: id, known: known, vx: known ? (q.x - pr.x) / (tn - pr.t) : 0, vy: known ? (q.y - pr.y) / (tn - pr.t) : 0 });
      S.prev.set(id, { x: q.x, y: q.y, t: tn });
    }
    landings(p, own, S, tn, P);
    for (var i2 = 0; i2 < P.length; i2++) {
      var e = P[i2]; if (!e.known) continue;
      if (Math.hypot(e.vx, e.vy) < RT.knockSpeed || !(S.hit.get(e.id) > tn - RT.knockWindow) || !soaked(e.a, p)) continue;
      for (var j = 0; j < P.length; j++) {
        var o = P[j]; if (o === e) continue;
        if (Math.abs(o.q.x - e.q.x) > RT.crashReach || Math.abs(o.q.y - e.q.y) > RT.crashReachY) continue;
        /* the closing speed: how fast e moves toward o, less how fast o moves away (0 for enemies riding one wave) */
        var dx = o.q.x - e.q.x, dy = o.q.y - e.q.y, d = Math.hypot(dx, dy), rvx = e.vx - o.vx, rvy = e.vy - o.vy;
        var closing = d > 0.05 ? (rvx * dx + rvy * dy) / d : Math.hypot(rvx, rvy);
        if (closing < RT.crashClosing) continue;
        crashPair(p, e.a, o.a, own, S);
        break;
      }
    }
    if (S.prev.size > 256) S.prev.clear();
    return true;
  }
  function start(p) { X.epoch(); W.widen(p); W.env(); W.sweep(p); SND.preload(); X.log((typeof BP2_VERSION === "string" ? BP2_VERSION : "v2") + " battle start, player " + X.uid(p)) }
  function stage(p) { X.epoch(); W.env(); W.sweep(p) }
  return { onHit: onHit, onDash: onDash, onCast: onCast, onSummon: onSummon, onDodge: onDodge, onBehit: counterSwell, onImpact: onImpact, poll: poll, start: start, stage: stage };
})();

BP2X.log("Boons Plus " + (typeof BP2_VERSION === "string" ? BP2_VERSION : "v2") + " runtime loaded: " + Object.keys(BP2_TRIG).length + " trigger ids");
trigFuncs.trBP2_hit = (t, e, l, a) => { try { return BP2.onHit(t, e, a) } catch (x) { BP2X.once("hit_exc", "trBP2_hit EXC " + x + " " + (x && x.stack)); return !1 } };
trigFuncs.trBP2_dash = (t, e, l, a) => { try { return BP2.onDash(t, e) } catch (x) { BP2X.once("dash_exc", "trBP2_dash EXC " + x); return !1 } };
trigFuncs.trBP2_legacy = (t, e, l, a) => { try { return BP2.onCast(t, "legacy") } catch (x) { BP2X.once("legacy_exc", "trBP2_legacy EXC " + x + " " + (x && x.stack)); return !1 } };
trigFuncs.trBP2_skillcast = (t, e, l, a) => { try { return BP2.onCast(t, "skill") } catch (x) { BP2X.once("skillcast_exc", "trBP2_skillcast EXC " + x + " " + (x && x.stack)); return !1 } };
trigFuncs.trBP2_summon = (t, e, l, a) => { try { return BP2.onSummon(t) } catch (x) { BP2X.once("summon_exc", "trBP2_summon EXC " + x + " " + (x && x.stack)); return !1 } };
trigFuncs.trBP2_dodge = (t, e, l, a) => { try { return BP2.onDodge(t) } catch (x) { BP2X.once("dodge_exc", "trBP2_dodge EXC " + x + " " + (x && x.stack)); return !1 } };
trigFuncs.trBP2_behit = (t, e, l, a) => { try { return BP2.onBehit(t) } catch (x) { BP2X.once("behit_exc", "trBP2_behit EXC " + x + " " + (x && x.stack)); return !1 } };
trigFuncs.trBP2_wall = (t, e, l, a) => { try { BP2.onImpact("wall", t, a) } catch (x) { BP2X.once("wall_exc", "trBP2_wall EXC " + x) } return !0 };
trigFuncs.trBP2_floor = (t, e, l, a) => { try { BP2.onImpact("floor", t, a) } catch (x) { BP2X.once("floor_exc", "trBP2_floor EXC " + x) } return !0 };
trigFuncs.trBP2_poll = (t, e, l, a) => { try { BP2.poll(t) } catch (x) { BP2X.once("poll_exc", "trBP2_poll EXC " + x) } return !0 };
trigFuncs.trBP2_start = (t, e, l, a) => { try { BP2.start(t) } catch (x) { BP2X.once("start_exc", "trBP2_start EXC " + x) } return !0 };
trigFuncs.trBP2_stage = (t, e, l, a) => { try { BP2.stage(t) } catch (x) { BP2X.once("stage_exc", "trBP2_stage EXC " + x) } return !0 };
trigFuncs.trBP2_mon = (t, e, l, a) => { try { BP2W.widen(t) } catch (x) { BP2X.once("mon_exc", "trBP2_mon EXC " + x) } return !0 };
