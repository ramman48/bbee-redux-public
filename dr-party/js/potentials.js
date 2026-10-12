/* dr-party: Kris's Potentials at runtime (local_only/deltarune/party/potentials/PLAN.md section 2). THE CORE: it owns
   globalThis.__bbDR.party.mods (what js/command.js fires and how), reads which cards Kris holds, receives their hit /
   dodge / stage triggers and hands everything to the group files. No card's effect lives here.
   Appended to data/js/window/battle/BattleUI after js/command.js (module scope: csharp_1, BattleJs_1, CSharpDefine_1);
   runs from globalThis.BB_HUD_TICKS (every rendered frame, real time), after the command's tick.
   Log: "[DR-PARTY] POTS ..." lines in modlog.txt (the command's queue); the in-game tests read them.

   THE REGISTRY. A group file js/pots_<group>.js (appended after this one, sorted by name) registers one object:
     globalThis.__bbDR.party.potsGroups.push({
       name: "rudebuster",
       cards: ["C1", "C2"],                          // the cards it implements (pots_state lists them)
       mods: function (m, has, api) {},              // the cards changed: edit m, a FRESH copy of the defaults (below)
       onFire: function (f, api) {},                 // a command's projectile left: f = { who, tgt, action, bullet, dual, t, x, y }
       onImpact: function (f, api) {},               // that projectile ended (its hit, a wall, its life): f + { end, t1, age }
                                                     // also for a projectile api.launch made: who "script", scripted true
       onHit: function (h, api) {},                  // one of Kris's hits landed (trigger 208901): h below
       onDodge: function (p, api) {},                // a perfect dodge (208902, at most every 0.5 s)
       onStage: function (p, why, api) {},           // a new room: forget per-room state
       onTalent: function (p, a, api, ctx) {},       // the talent's trigger (trDR_pot_talent): for Kris, and for an Evotype
                                                     // heir who holds the talent (ctx.heir true; ctx.room = a per-room key)
       skillPress: function (p, stick, now, api) { return false },   // the Skill press edge; true = taken (no target mode)
       tick: function (p, bdt, api) {},              // every frame while Kris is in battle; bdt = battle seconds
       test: function (cmd, args, api) { return false },             // a drparty_test.txt line nobody else knew
       state: function () { return "" }              // one line for pots_state
     });
   Every call is guarded: a group that throws is logged once per hook and the rest go on.
   mods() runs for every group, in file order, each time the held cards change: scale what several cards share
   (m.recharge.susie *= 0.7), set what one card owns (m.rb.action = "rb_bolt_home_b"), and pick an action from ALL the
   cards that shape it in one place (the group that owns the bolt decides rb.action from has("C1"), has("C4"), has("C6")).
   Log each effect when it happens with api.log("chain 1/2 -> ..."): the in-game tests read "[DR-PARTY] POTS chain 1/2".
   mods (defaults = no cards; the command reads it every frame):
     { v: 2, sig: "20809,20812", rb: { action, guardAction, dualAction, timed }, fs: { action, guardAction },
       guard: { ignore }, recharge: { susie, ralsei }, minCycle: 0.45, dual, dualDelay: 0.25, ultra, follow: null }
   h (a hit): { p, attacker, target, action (the attacker's action), kris (Kris's own body hit), tactic (a Tactic's hit),
       foe, enemy (a REAL enemy: see below), guarded (the target guards and guard.ignore is off), uid, base, session,
       primary (a command's own bolt in flight; never its explosion), scripted (a secondary projectile: one a script
       launched, or one another projectile made: never a source),
       src: { chain, detonate, sp, rally, pdash, loop } }   // PLAN.md's source sets: may this hit start that effect?
     A set is a list of action names: "x*" = a name starting with x, "!x" (or "!x*") = never that one ("rb_red*" would
     take Red Buster's explosion rb_red_boom for a bolt: the sets that mean the bolt say "!rb_red_boom"). api.matches
     reads a set by its key ("primary", "bolt", "command", "chain", ...) or a list of patterns.
   REAL ENEMIES (the lead, 2026-10-03: "itll try to select objects too and traps"). The hit trigger reports anything of
     another faction: pots, traps, buff zones. js/command.js's own list (__bbDR.party.enemies: MonsterConfig tagged
     Monster or Boss, never TargetIgnore / CantBeHit, nothing summoned) is the one rule, by kind (BaseID): a kind that
     list has held in this room is an enemy, alive or killed by this very hit; any other kind is an object, and a hit
     on it comes with h.enemy false (the groups start nothing on it; it is still forwarded: a chain hop that ended on a
     pot must hear of it). While the list has shown nothing at all in this room, nothing is concluded (every foe counts).
     EVERY enemy a script picks comes from api.enemies() / api.near() / api.chase(), never from the raw actor list.
   api (also globalThis.__bbDR.party.potsApi):
     ids.A1 -> 20801; key(20801) -> "A1"; has("A1" | 20801); owned() -> [ids]; mods(); player(); log(s); now() (battle s)
     press -> { rt, bt } the last Skill press (real / battle time; never consumed by reading)
     launch(action, x, y, dx, dy, tgt, opts) -> bullet, booked to Kris's Skill row and remembered as scripted while it
       plays that action (projectiles are pooled: the object comes back as some later projectile); its end reaches
       onImpact with who "script"
     launchAs(row, action, x, y, dx, dy) -> the same, booked to the input row of Kris's own action `row` (kris_a1 =
       the Attack row: its damage counts as that move's); the command's row stands in if that row cannot be found
     isOurs(bullet); cut(who, secs, why); ready(who); enemies(); guarded(a); isEnemy(a) (see REAL ENEMIES)
     chase(x, y, r, pred) -> like near(), plus every enemy that is on screen however far ("after it hits one enemy it
       chases the next from anywhere on screen"): what a chain hop, a leap or a steered bolt may go to next
     onScreen(a) -> true / false; null = the camera cannot be read; setTarget(bullet, a) -> a homing projectile's target
     note(key) / noted(key, secs) -> one group tells the others something happened (fireshock: "detonated <enemy>")
     pos(a) -> { x, y, cy } (its feet; cy = what the command aims at: the feet + 0.8 u)
     centre(a) -> { x, y, read } the middle of its hit box (ActorBindPos.BehitBoxCenter); read false = pos(a)'s x, cy
     near(x, y, r, pred) -> enemies within r, nearest first; after(secs, fn) (battle time, dropped at a room change)
     cd(key, secs) -> true and starts it when it is free
     hasBuff(a, idx); buffState(a, idx) -> true / false / null (it cannot be read: conclude nothing)
     addBuff(a, idx, dur, str, stack, caster); removeBuff(a, idx); burn(target, dur, perSecond)
     hasTag(a, t); addTag(a, t); removeTag(a, t); isBoss(a) (the tags Boss / boss / EliteBoss / FinalBoss)
     move(a, dx, dy) (collision-aware: ActorPosition.AddMove); place(a, x, y) (tests: sets its Position)
     alive(a); actionOf(a); projectiles() -> Kris's live projectiles, or null when they cannot be listed
     unleashed() -> how many Potential Unleashed the run holds (it is no card of the 32: has() never sees it); -1 = unreadable
     reports() -> { kris, shot } how many hits the trigger has reported in this battle: by Kris's own body / by a
       projectile. While shot is 0 nobody knows whether the trigger reports projectile hits at all (PLAN.md R1): a
       group may then read a hit from where a projectile ended. Once shot > 0, a projectile without a report MISSED
     matches(set, action); f(fp) / fp(x); refresh()
   The command's hooks (globalThis.__bbDR.party.pots; they never throw): skillPress, onFire, test, held, grant, and the
   trigger forwarders' hit / dodge / stage / talent (js/potentials_trig.js).
   Test lines (drparty_test.txt): pots_state; ptest hitlog 0|1; ptest own <keys or ids | none | real>; ptest grant <id>;
   ptest held; ptest pos; ptest dodge; ptest stage; ptest press; ptest armor <level>; ptest burn;
   ptest reports 0 (forget the hit reports seen: the groups' no-report fallbacks are on again);
   ptest buffs <idx> [idx ...] (which of these buffs Kris and each enemy carry: "buffs 350501#12: 1116=1 2303=0 | ...").
   Every hit, launch, cut and projectile end is logged while hitlog is on: the internal build's default (the in-game
   tests read those lines); a build made with KP_HITLOG=0 (kris_potentials.py) starts with it off.
   Names of js/command.js this file reads besides the agreed interface (each guarded, and reported once if it is gone):
   __bbDR.party.state.{bnow, pl, kris, wait, fireAt}, __bbDR.party.CFG.{who, recharge}, __bbDR.party.isKris.
   The whole file is wrapped: BattleUI is every hero's HUD module, so nothing thrown while it loads may escape. */
try { (function () {
  var G = globalThis, CS = csharp_1, UM = require("Core/Util"), IsNull = CSharpDefine_1.IsNull;
  var T = (G.BB_HUD_TICKS = G.BB_HUD_TICKS || {}); if (T["dr-party/potentials"]) return;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  var CFG = G.__bbDRPotsCFG || {};                 // the build's values (kris_potentials.content): ids, source sets
  var KEYS = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "D1", "D2", "D3", "D4", "D5", "D6",
              "E1", "E2", "E3", "E4", "F1", "F2", "G1", "G2", "G3", "H1", "H2", "E5", "E6", "E7", "H3"];     // (E5 Pen of Hope is the 33rd: 20833; E6, E7 its steps up; H3 Graze)
  var ID = {}, KEY = {}, k0;
  for (k0 = 0; k0 < KEYS.length; k0++) ID[KEYS[k0]] = 20801 + k0;
  if (CFG.ids) for (var ck in CFG.ids) ID[ck] = CFG.ids[ck];
  for (var ik in ID) KEY[ID[ik]] = ik;
  // PLAN.md section 2, "Source sets": "x*" = a name starting with x; "!x" = never that one (kris_potentials.SOURCES)
  var SRC = CFG.src || {
    primary: ["rb_bolt_home*", "rb_red*", "!rb_red_boom"], bolt: ["rb_bolt_home*", "rb_red*"], command: ["rb_bolt_home*", "rb_red*", "fs_burst*"],
    chain: ["rb_chain*"], detonate: ["rb_bolt_home*", "rb_red*", "rb_chain*", "!rb_red_boom"],
    sp: ["rb_bolt_home*", "rb_red*", "fs_burst*", "!fs_burst_c"], rally: ["kris_a1*", "kris_a2*", "kris_a3*", "kris_ja*", "kris_dive*"],
    pdash: ["kris_pdash*"], loop: ["kris_a3*"],
    scripted: ["rb_chain*", "rb_detonate", "rb_shock", "rb_red_boom", "fs_chain", "fs_burst_c", "fs_field", "fs_spread*", "fs_pillar", "xslash_*"] };
  var S = { pl: null, battle: null, stage: undefined, owned: {}, sig: null, pollT: 0, fake: null, bnow: 0, room: 0, resetT: -10,
            press: { rt: -1e9, bt: -1e9 }, fired: [], launched: [], timers: [], cds: {}, hitlog: CFG.hitlog !== false, errs: {}, early: [], hits: 0,
            dodges: 0, pollErr: 0, reports: { kris: 0, shot: 0 }, leanT: 0,
            kinds: {}, censusN: 0, censusT: 0, objects: 0, notes: {}, heir: {} };
  P.potsGroups = P.potsGroups || [];
  P.potsState = S;

  // ---------------------------------------------------------------- basics
  function log(s) {
    if (typeof P.log === "function") {
      try { while (S.early.length) P.log("POTS " + S.early.shift()); P.log("POTS " + s) } catch (e) {}
    } else if (S.early.length < 50) S.early.push(s);
  }
  function U() { return UM.U }
  function f(v) { return U().FpToFloat(v) }
  function fp(x) { return U().FloatToFp(x) }
  function battle() { var b = BattleJs_1.default.Instance; return b && b.Battle }
  function now() { var cs = P.state; return cs && typeof cs.bnow === "number" ? cs.bnow : S.bnow }
  function tag(a) { try { return a.BaseID + "#" + a.UniqueId } catch (e) { return "?" } }
  function matches(set, name) {                    // "x*" = a name starting with x; "!x" / "!x*" = never that one
    var L = typeof set === "string" ? SRC[set] : set; if (!L || !name) return false;
    var hit = false;
    for (var i = 0; i < L.length; i++) {
      var q = L[i], neg = q.charAt(0) === "!";
      if (neg) q = q.slice(1);
      if (q.charAt(q.length - 1) === "*" ? name.indexOf(q.slice(0, -1)) === 0 : name === q) { if (neg) return false; hit = true }
    }
    return hit;
  }
  function each(hook, args) {                      // every group's hook; a failing group is logged once per hook
    var out = [], L = P.potsGroups;
    for (var i = 0; i < L.length; i++) {
      var g = L[i]; if (!g || typeof g[hook] !== "function") continue;
      try { out.push(g[hook].apply(g, args)) }
      catch (e) { var key = (g.name || i) + "." + hook; if (!S.errs[key]) { S.errs[key] = 1; log("group " + key + " failed: " + e) } }
    }
    return out;
  }

  // ---------------------------------------------------------------- mods: what the command fires
  function defaults() {
    var C = P.CFG || {}, who = C.who || {}, su = who.susie || {}, ra = who.ralsei || {}, rc = C.recharge || {};
    return { v: 2, sig: "",
             rb: { action: su.bolt || "rb_bolt_home", guardAction: su.boltRed || su.bolt || "rb_bolt_home_red", dualAction: null, timed: false },
             fs: { action: ra.bolt || "fs_ball_home", guardAction: ra.bolt || "fs_ball_home" },
             guard: { ignore: false }, recharge: { susie: rc.susie > 0 ? rc.susie : 1.0, ralsei: rc.ralsei > 0 ? rc.ralsei : 1.0 },
             minCycle: 0.45, dual: false, dualDelay: 0.25, ultra: false, follow: null };
  }
  function has(k) { var id = typeof k === "number" ? k : ID[k]; return !!(id && S.owned[id]) }
  function ownedIds() { var out = []; for (var id in S.owned) if (S.owned[id]) out.push(+id); out.sort(function (a, b) { return a - b }); return out }
  function keysOf(ids) { return ids.map(function (id) { return KEY[id] || String(id) }) }
  function summary(m) {
    return "rb=" + m.rb.action + "/" + m.rb.guardAction + "/" + (m.rb.dualAction || "-") + (m.rb.timed ? " timed" : "") +
           " fs=" + m.fs.action + "/" + m.fs.guardAction + " guard.ignore=" + !!m.guard.ignore +
           " recharge=" + (+m.recharge.susie).toFixed(2) + "/" + (+m.recharge.ralsei).toFixed(2) + " min=" + m.minCycle +
           " dual=" + !!m.dual + "@" + m.dualDelay + " ultra=" + !!m.ultra + " follow=" + (m.follow ? JSON.stringify(m.follow) : "-");
  }
  function recompute(why) {
    var m = defaults(); m.sig = S.sig || "";
    each("mods", [m, has, api]);
    P.mods = m;
    log("cards [" + keysOf(ownedIds()).join(" ") + "] (" + why + ")");
    log("mods " + summary(m));
  }
  function readOwned(p) {
    var o = {}, k;
    if (S.fake) { for (k = 0; k < S.fake.length; k++) o[S.fake[k]] = true; return o }
    for (k in ID) {
      var v = false;
      try { v = !!p.TriggerMgr.FindTrigger(ID[k] * 10 + 1) } catch (e) { if (!S.pollErr) { S.pollErr = 1; log("cannot read the cards: " + e) } }
      if (v) o[ID[k]] = true;
    }
    return o;
  }
  function poll(p, why) {
    var o = readOwned(p), ids = [];
    for (var id in o) ids.push(+id);
    ids.sort(function (a, b) { return a - b });
    var sig = ids.join(",");
    if (sig === S.sig) return;
    // 0.5.1 (the lead accepted "a DELTARUNE jingle when a Kris Potential is picked"): a card this run did not hold at
    // the last look plays DELTARUNE's item jingle, once however many joined. Not for the cards the first look of a
    // game session finds, nor for another run's (a run continued from a save), nor for a test set.
    var run = "?"; try { if (P.tension && typeof P.tension.runKey === "function") run = P.tension.runKey() } catch (e) {}
    if (S.known && S.knownRun === run && !S.fake) {
      var joined = 0; for (var q in o) if (!S.known[q]) joined++;
      if (joined > 0) { try { if (typeof P.sfx === "function") P.sfx("pick") } catch (e2) {} log("card picked: " + joined + " new, the jingle plays") }
    }
    if (!S.fake) { S.known = o; S.knownRun = run }
    S.owned = o; S.sig = sig; recompute(why || (S.fake ? "test set" : "cards changed"));
  }

  // ---------------------------------------------------------------- the api the groups use
  function player() { return S.pl }
  function enemies() { try { return P.enemies ? P.enemies() : [] } catch (e) { return [] } }
  function guarded(a) { try { return !!(P.isGuarded && P.isGuarded(a)) && !(P.mods && P.mods.guard && P.mods.guard.ignore) } catch (e) { return false } }
  function pos(a) {                                 // cy: what the command aims at (js/command.js centreY: the same read)
    var x = 0, y = 0, h = 0.8;
    try { x = a.Position.x; y = a.Position.y } catch (e) {}
    try { var bh = f(a.Attr.BoxHeight) * 0.5; if (isFinite(bh)) h = Math.max(0.5, bh) } catch (e) {}
    return { x: x, y: y, cy: y + h };
  }
  function centre(a) {                              // the middle of its hit box, as the game binds effects to it
    var q = pos(a);
    try {
      var v = U().Fp2ToVector2(a.GetGlobalPosByBindPosType(CS.GamePlay.ActorBindPos.BehitBoxCenter));
      if (isFinite(v.x) && isFinite(v.y) && Math.abs(v.x - q.x) < 6 && v.y - q.y > -1 && v.y - q.y < 10) return { x: v.x, y: v.y, read: true };
    } catch (e) {}
    return { x: q.x, y: q.cy, read: false };
  }
  function alive(a) { try { return !!a && !IsNull(a) && !a.IsDead } catch (e) { return false } }
  function actionOf(a) { try { return String(a.ActionMgr.CurrentActionName || "") } catch (e) { return "" } }
  function once(key, s) { if (!S.errs[key]) { S.errs[key] = 1; log(s) } }
  function near(x, y, r, pred) {
    var L = enemies(), out = [];
    for (var i = 0; i < L.length; i++) {
      var q = pos(L[i]), d = Math.sqrt((q.x - x) * (q.x - x) + (q.cy - y) * (q.cy - y));
      if (d <= r && (!pred || pred(L[i]))) out.push({ a: L[i], d: d, x: q.x, y: q.cy });
    }
    out.sort(function (a, b) { return a.d - b.d });
    return out;
  }
  // Real enemies only (the header's REAL ENEMIES). The command's list goes by kind (BaseID), and so does this: a kind
  // the list has held in this room is an enemy (also one this very hit killed); another kind is an object or a trap.
  // The list is read every 0.25 s and again whenever a kind is not known. A pot the hit destroyed is no enemy: its kind
  // was never on the list. While the list has shown nothing at all in this room, nothing is concluded.
  function census() {
    var L = enemies();
    for (var i = 0; i < L.length; i++) { try { S.kinds[L[i].BaseID] = true } catch (e) {} }
    S.censusN += L.length;
  }
  function isEnemy(a) {
    var id; try { id = a.BaseID } catch (e) { return false }
    if (id === undefined || id === null) return false;
    if (S.kinds[id] === true) return true;
    census();
    if (S.kinds[id] === true) return true;
    if (!S.censusN) return true;
    if (S.kinds[id] === undefined) {
      S.kinds[id] = false;
      if (S.hitlog) log("not an enemy: kind " + id + " (an object or a trap: the command's list has not held it in this room); a hit on it starts nothing");
    }
    return false;
  }
  // Is it on screen? true / false; null = the camera cannot be read. The same read js/command.js makes for its target
  // cursor (CameraDirector.Cur.MainCamera.WorldToScreenPoint of the point the command aims at)
  function onScreen(a) {
    try {
      var c = CS.GamePlay.CameraDirector.Cur.MainCamera; if (!c || IsNull(c)) return null;
      var q = pos(a), w = c.WorldToScreenPoint(new CS.UnityEngine.Vector3(q.x, q.cy, 0));
      var W = +CS.UnityEngine.Screen.width, H = +CS.UnityEngine.Screen.height, x = +w.x, y = +w.y, z = +w.z;
      if (!(W > 0) || !(H > 0) || !isFinite(x) || !isFinite(y)) return null;
      return z > 0 && x > 0 && x < W && y > 0 && y < H;
    } catch (e) { return null }
  }
  // Where a chase may go from (x, y): every enemy within r, and every enemy on screen however far (the lead: "after it
  // hits one enemy it chases the next from anywhere on screen"), nearest first. pred as in near()
  function chase(x, y, r, pred) {
    var L = enemies(), out = [];
    for (var i = 0; i < L.length; i++) {
      var q = pos(L[i]), d = Math.sqrt((q.x - x) * (q.x - x) + (q.cy - y) * (q.cy - y));
      if (pred && !pred(L[i])) continue;
      if (d <= r || onScreen(L[i]) === true) out.push({ a: L[i], d: d, x: q.x, y: q.cy });
    }
    out.sort(function (a, b) { return a.d - b.d });
    return out;
  }
  function setTarget(b, a) {                        // a homing projectile's target (what js/command.js re-targets its bolts with)
    try { var tm = b.TargetMgr; if (!tm || typeof tm.SetTarget !== "function") return false; tm.SetTarget(a); return true }
    catch (e) { return false }
  }
  // one group tells the others that something happened (battle time; forgotten at a room change)
  function note(key) { S.notes[key] = now() }
  function noted(key, secs) { var t = S.notes[key]; return t !== undefined && now() - t <= secs }
  // a projectile a script launched is "ours" only while it plays the action it was launched with: projectiles are
  // pooled, so the same object is some other projectile later (a command's own bolt must never read as scripted)
  function isOurs(b) {
    for (var i = 0; i < S.launched.length; i++) {
      var q = S.launched[i]; if (q.b !== b) continue;
      var n = actionOf(b);
      return !n || n === q.action || !q.seen;
    }
    return false;
  }
  function remember(b, action, x, y, tgt) {         // a projectile a script made: watched to its end (onImpact, who "script")
    for (var i = S.launched.length - 1; i >= 0; i--) if (S.launched[i].b === b) S.launched.splice(i, 1);   // the pool handed an object back
    S.launched.push({ who: "script", scripted: true, bullet: b, b: b, tgt: tgt || null, action: action, name: action, dual: false,
                      t: now(), age: 0, frames: 0, seen: false, x: +x, y: +y });
  }
  function launch(action, x, y, dx, dy, tgt, opts) {
    if (typeof P.launch !== "function") { once("no launch", "launch " + action + ": the command has no launch()"); return null }
    var b = P.launch(action, x, y, dx, dy, tgt || null, opts || null);
    if (b) remember(b, action, x, y, tgt);
    if (S.hitlog || !b) log("launch " + action + (b ? "" : " FAILED") + " at " + (+x).toFixed(2) + "," + (+y).toFixed(2) + (tgt ? " -> " + tag(tgt) : ""));
    return b;
  }
  // The same, booked to the input row of one of Kris's own actions (row "kris_a1": the Attack row, so the damage counts
  // as that move's and not as the command's Skill). The projectile is made as js/command.js makes its own
  // (BulletMgr.CreateBulletByParams with that row's SkillActivate). If the row cannot be found, or the call fails, the
  // command's own row stands in (launch above), said once.
  function launchAs(row, action, x, y, dx, dy) {
    var p = S.pl, sa = null, b = null;
    try { var sk = p.SkillMgr.FindSkillByActionName(row); sa = sk ? sk.SkillActivate : null } catch (e) {}
    if (sa) {
      try {
        var V2 = CS.UnityEngine.Vector2, cfg = P.CFG || {};
        b = battle().BulletMgr.CreateBulletByParams(p, cfg.bullet || 20080101, U().Vector2ToFp2(new V2(x, y)), U().Vector2ToFp2(new V2(dx, dy)),
                                                    U().FloatToFp(1), action, sa, null);
      } catch (e2) { b = null; once("book " + row, "launch " + action + ": not booked to the row of " + row + " (" + e2 + "): the command's row stands in") }
    } else once("row " + row, "launch " + action + ": Kris has no input row for " + row + ": booked to the command's row");
    if (!b) return launch(action, x, y, dx, dy, null, null);
    remember(b, action, x, y, null);
    if (S.hitlog) log("launch " + action + " at " + (+x).toFixed(2) + "," + (+y).toFixed(2) + " (the row of " + row + ")");
    return b;
  }
  function cut(who, secs, why) {
    if (typeof P.cut !== "function") return;
    P.cut(who, secs);
    var w = P.state && P.state.wait;
    if (S.hitlog) log("cut " + who + " " + (+secs).toFixed(2) + (why ? " (" + why + ")" : "") + (w ? ": wait " + w.susie.toFixed(2) + "/" + w.ralsei.toFixed(2) : ""));
  }
  function ready(w) { try { return !!P.isReady(w) } catch (e) { return false } }
  function after(secs, fn) { S.timers.push({ left: secs, fn: fn }) }
  function cd(key, secs) { var t = now(); if (S.cds[key] !== undefined && t < S.cds[key]) return false; S.cds[key] = t + secs; return true }
  // does it carry the buff? true / false; null = its buffs cannot be read (BuffMgr.BuffExist, else BuffMgr.Find: both
  // stock; the dev test room uses the first, EX Ragna's runtime the second)
  function buffState(a, idx) {
    var bm = null;
    try { bm = a.BuffMgr } catch (e) {}
    if (!bm) return null;
    try { if (typeof bm.BuffExist === "function") return !!bm.BuffExist(idx) } catch (e1) {}
    try { if (typeof bm.Find === "function") return !!bm.Find(idx) } catch (e2) {}
    return null;
  }
  function hasBuff(a, idx) { return buffState(a, idx) === true }
  function addBuff(a, idx, dur, str, stack, caster) {
    try { a.BuffMgr.AddBuff(idx, fp(dur), fp(str === undefined ? 1 : str), stack || 1, caster || S.pl); return true }
    catch (e) { once("buff " + idx, "buff " + idx + " not added: " + e); return false }
  }
  function removeBuff(a, idx) { try { a.BuffMgr.Remove(idx); return true } catch (e) { return false } }
  // stock Burn (1116: str = damage a second) with Kris as its caster: JsPort.ActorFuncUtils.AddBuffFire(player, target,
  // dur, str, interval), the helper the game's own Burn Tactic calls (research/kb/ELEMENT_PIPELINE.md; dump.cs: the class
  // is in namespace JsPort, not GamePlay). Calling it from a mod is unproven in game. A plain AddBuff is the last resort
  function burn(tgt, dur, str) {
    var p = S.pl; if (!p || !tgt) return false;
    try {
      var AF = CS.JsPort && CS.JsPort.ActorFuncUtils;
      if (AF && typeof AF.AddBuffFire === "function") return AF.AddBuffFire(p, tgt, fp(dur), fp(str), fp(1)) !== false;
      once("burn route", "burn: JsPort.ActorFuncUtils.AddBuffFire is not there: a plain AddBuff 1116 stands in");
    } catch (e) { once("burn failed", "burn: AddBuffFire failed (" + e + "): a plain AddBuff 1116 stands in") }
    return addBuff(tgt, "1116", dur, str, 1, p);
  }
  function hasTag(a, t) { try { return !!a.TagMgr.HasTag(t) } catch (e) { return false } }
  function addTag(a, t) { try { a.TagMgr.AppendTag(t); return true } catch (e) { return false } }
  function removeTag(a, t) { try { a.TagMgr.RemoveTag(t); return true } catch (e) { return false } }
  function isBoss(a) { return hasTag(a, "Boss") || hasTag(a, "boss") || hasTag(a, "EliteBoss") || hasTag(a, "FinalBoss") }   // as the other mods' runtimes
  function move(a, dx, dy) {                        // through the game's own collision (walls stop it): as char-ruby's runtime
    try { a.ActorPosition.AddMove(U().Vector2ToFp2(new CS.UnityEngine.Vector2(dx, dy || 0))); return true }
    catch (e) { once("move", "move failed: " + e); return false }
  }
  function place(a, x, y) { try { a.Position = new CS.UnityEngine.Vector2(x, y); return true } catch (e) { return false } }
  function projectiles() {                          // everything Kris is the root caster of (the test room's route)
    try {
      var L = battle().PlayerObjMgr.FindPlayersByRootCaster(S.pl), out = [];
      for (var i = 0; i < L.Count; i++) { var b = L.get_Item(i); if (alive(b)) out.push(b) }
      return out;
    } catch (e) { return null }
  }
  function unleashed() {                            // Potential Unleashed has no trigger: the run's own list says
    try {
      var fa = BattleJs_1.default.Instance.GetFesActor(), id = CFG.unleashed || 20899, n = 0;
      for (var i = 0; i < fa.potentials.length; i++) if (+fa.potentials[i].id === id) n++;
      return n;
    } catch (e) { return -1 }
  }
  function reports() { return S.reports }
  var api = { ids: ID, key: function (id) { return KEY[id] }, has: has, owned: ownedIds, mods: function () { return P.mods }, player: player,
              log: log, now: now, reports: reports, verbose: function () { return S.hitlog }, press: S.press, launch: launch, launchAs: launchAs,
              isOurs: isOurs, cut: cut, ready: ready, enemies: enemies, guarded: guarded, isEnemy: isEnemy, onScreen: onScreen, chase: chase,
              setTarget: setTarget, note: note, noted: noted, room: function () { return S.room },
              pos: pos, centre: centre, near: near, after: after, cd: cd, hasBuff: hasBuff, buffState: buffState, addBuff: addBuff,
              removeBuff: removeBuff, burn: burn, hasTag: hasTag, addTag: addTag, removeTag: removeTag, isBoss: isBoss, move: move, place: place,
              alive: alive, actionOf: actionOf, projectiles: projectiles, unleashed: unleashed,
              matches: matches, f: f, fp: fp, tag: tag, refresh: function () { S.sig = null; S.pollT = 0 } };
  P.potsApi = api;

  // ---------------------------------------------------------------- per-room state
  function reset(p, why) {
    S.resetT = CS.UnityEngine.Time.unscaledTime; S.room++;
    S.timers = []; S.fired = []; S.launched = [];
    S.kinds = {}; S.censusN = 0; S.censusT = 0; S.notes = {};      // which kinds are enemies is learnt again in each room
    S.press.rt = -1e9; S.press.bt = -1e9;
    log("room reset #" + S.room + " (" + why + ")");
    try { if (typeof P.onRoom === "function") P.onRoom(S.room, why) } catch (e) {}     // js/command.js: the companions re-join
    each("onStage", [p, why, api]);
  }
  function stageName(b) { try { return String(b.BattleContextBase.Stage) } catch (e) { return "" } }

  // ---------------------------------------------------------------- the command's projectiles: where and how they end
  function watchFired(bdt) {
    for (var i = S.fired.length - 1; i >= 0; i--) {
      var o = S.fired[i], live = false, name = "";
      try { live = !IsNull(o.bullet) && !o.bullet.IsDead; if (live) name = String(o.bullet.ActionMgr.CurrentActionName) } catch (e) { live = false }
      o.age += bdt;
      if (live && name === o.action) { o.seen = true; try { o.x = o.bullet.Position.x; o.y = o.bullet.Position.y } catch (e2) {} if (o.age < 4) continue }
      else if (live && !o.seen && o.frames++ < 3) continue;        // just created: its action may only show next frame
      S.fired.splice(i, 1);
      o.end = live ? name : "gone"; o.t1 = now();
      if (S.hitlog) log("impact " + o.who + " " + o.action + " -> " + o.end + " at " + (+o.x).toFixed(2) + "," + (+o.y).toFixed(2) +
                        " after " + o.age.toFixed(2) + " s");
      each("onImpact", [o, api]);
    }
    // the projectiles the scripts launched: the same watch, so a group hears of their end too (who "script")
    for (var j = S.launched.length - 1; j >= 0; j--) {
      var q = S.launched[j], ql = false, qn = "";
      try { ql = !IsNull(q.b) && !q.b.IsDead; if (ql) qn = String(q.b.ActionMgr.CurrentActionName) } catch (e3) { ql = false }
      q.age += bdt;
      if (ql && qn === q.action) { q.seen = true; try { q.x = q.b.Position.x; q.y = q.b.Position.y } catch (e4) {} if (q.age < 4) continue }
      else if (ql && !q.seen && q.frames++ < 3) continue;
      S.launched.splice(j, 1);
      q.end = ql ? qn : "gone"; q.t1 = now();
      if (S.hitlog) log("impact script " + q.action + " -> " + q.end + " at " + (+q.x).toFixed(2) + "," + (+q.y).toFixed(2) + " after " + q.age.toFixed(2) + " s");
      each("onImpact", [q, api]);
    }
  }
  function timers(bdt) {
    if (!S.timers.length) return;
    var due = [], keep = [];
    for (var i = 0; i < S.timers.length; i++) { var t = S.timers[i]; t.left -= bdt; (t.left <= 0 ? due : keep).push(t) }
    S.timers = keep;
    for (var j = 0; j < due.length; j++) { try { due[j].fn() } catch (e) { if (!S.errs.timer) { S.errs.timer = 1; log("a timer failed: " + e) } } }
  }

  // ---------------------------------------------------------------- hooks (js/command.js and js/potentials_trig.js call these)
  function guard(name, fn) {                        // a hook never throws into the command or the trigger system
    return function () {
      try { return fn.apply(null, arguments) }
      catch (e) { if (!S.errs["hook " + name]) { S.errs["hook " + name] = 1; log("hook " + name + " failed: " + e) } }
    };
  }
  function skillPress(p, stick, t) {
    S.press.rt = t; S.press.bt = now();
    var r = each("skillPress", [p, stick, t, api]);
    for (var i = 0; i < r.length; i++) if (r[i] === true) { log("press taken by a Potential (stick " + (+stick[0]).toFixed(2) + "," + (+stick[1]).toFixed(2) + ")"); return true }
    return false;
  }
  function onFire(who, tgt, action, bullet, dual) {
    var o = { who: who, tgt: tgt, action: action, bullet: bullet, dual: !!dual, t: now(), age: 0, frames: 0, seen: false, x: 0, y: 0 };
    try { o.x = bullet.Position.x; o.y = bullet.Position.y } catch (e) {}
    S.fired.push(o);
    if (S.hitlog) log("fire " + who + " " + action + (tgt ? " -> " + tag(tgt) : "") + (dual ? " (dual)" : ""));
    each("onFire", [o, api]);
  }
  function hit(p, a) {
    if (!a) return;
    var at = a.Attacker, tg = a.Target, s = a.Ssss, act = "", foe = false, kris = false;
    try { act = String(at.ActionMgr.CurrentActionName || "") } catch (e) {}
    try { foe = !!tg && tg != p && tg.Faction != p.Faction } catch (e) {}
    try { kris = at === p || at.UniqueId === p.UniqueId } catch (e) {}
    var scripted = matches("scripted", act) || isOurs(at), enemy = foe && isEnemy(tg);
    var h = { p: p, attacker: at, target: tg, action: act, kris: kris, tactic: !!(s && s.TriggerNode), foe: foe, enemy: enemy, guarded: foe && guarded(tg),
              session: s, uid: null, base: null, primary: !kris && matches("primary", act), scripted: scripted,
              src: { chain: !kris && matches("primary", act), detonate: !kris && matches("detonate", act), sp: !kris && matches("sp", act),
                     rally: kris && matches("rally", act), pdash: kris && matches("pdash", act), loop: kris && matches("loop", act) } };
    try { h.uid = tg.UniqueId; h.base = tg.BaseID } catch (e) {}
    S.hits++;
    if (kris) S.reports.kris++; else if (at) S.reports.shot++;
    if (foe && !enemy) S.objects++;
    if (S.hitlog) log("hit " + (act || "?") + " -> " + h.base + "#" + h.uid + (kris ? " (Kris)" : " (projectile)") + (h.tactic ? " tactic" : "") +
                      (foe ? (enemy ? "" : " object") : " not-a-foe") + (h.guarded ? " guarded" : "") + (scripted ? " scripted" : "") + (h.primary ? " primary" : ""));
    // 0.5.2: a companion's projectile hit an enemy: its damage number takes that companion's colour (js/command.js)
    if (!kris && foe && enemy && h.uid !== null && typeof P.tintNumber === "function") {
      var by = /^rb_/.test(act) ? "susie" : /^fs_/.test(act) ? "ralsei" : null;
      if (by) { try { P.tintNumber(h.uid, by) } catch (e) {} }
    }
    if (!foe || h.tactic) return;                   // Kris's own side and Tactic hits start nothing
    each("onHit", [h, api]);                        // (a hit on an object or a trap goes on with h.enemy false: see the header)
  }
  function dodge(p, a) { S.dodges++; log("dodge #" + S.dodges); each("onDodge", [p, api]) }
  function stage(p, a) { reset(p, "stage trigger") }
  // The talent's trigger (HpChangeDown: it fires on every loss of HP, so it is only logged with the hit log). It is
  // forwarded for ANY hero who holds the talent (js/potentials_trig.js): an Evotype heir of Kris's has it too, and for
  // that hero this file's tick does not run (no cards, no room count). `ctx` tells the groups: { heir, room } where room
  // is a key that changes with the room (Kris: this file's room count; an heir: the battle and its stage, read at the
  // trigger, so the worst case for an heir is once per battle instead of once per room).
  function talent(p, a) {
    var mine = !!S.pl && (p === S.pl || sameActor(p, S.pl)), ctx = { heir: !mine, room: "room " + S.room };
    if (!mine) {
      var b = null; try { b = battle() } catch (e) {}
      if (S.heir.b !== b) { S.heir.b = b; S.heir.n = (S.heir.n || 0) + 1 }
      ctx.room = "heir " + S.heir.n + " " + stageName(b) + " " + tag(p);
    }
    if (S.hitlog) log("talent trigger" + (mine ? "" : " (an heir: " + tag(p) + ")"));
    each("onTalent", [p, a, api, ctx]);
  }
  function sameActor(a, b) { try { return typeof a.UniqueId === "number" && a.UniqueId !== 0 && a.UniqueId === b.UniqueId } catch (e) { return false } }
  function held() { return ownedIds() }
  function grant(id) {                              // dev and episode only: the route the test room's `pots` uses
    id = +id;
    var p = S.pl, bj = BattleJs_1.default.Instance, fa = bj && bj.GetFesActor();
    if (!p || !fa || !KEY[id] && id !== (CFG.unleashed || 20899)) { log("grant " + id + ": not possible here"); return false }
    for (var i = 0; i < fa.potentials.length; i++) if (fa.potentials[i].id === id) { log("grant " + id + ": already held"); return true }
    var PB = require("Gen/pbdef");
    fa.potentials.push(new PB.STPotential({ id: id, active: true }));
    var L = p.TriggerMgr.FindTriggersBySource(CS.GamePlay.PlayerTriggerNodeSource.Potential), ids = [];
    for (var j = 0; j < L.Count; j++) ids.push(L.get_Item(j).Id);
    for (var k = 0; k < ids.length; k++) p.TriggerMgr.RemoveTriggerNodeByIdx(ids[k]);
    bj.AddPlayerTriggersFromFesActor(p, fa);
    p.SkillMgr.MarkSkillChainNeedRebuild();
    try { bj.UIMain.RefreshBlessStatusUI(true) } catch (e) {}
    S.sig = null; S.pollT = 0;
    log("grant " + id + " (" + (KEY[id] || "Unleashed") + "): " + fa.potentials.length + " held");
    return true;
  }
  function state() {
    var gs = P.potsGroups.map(function (g) { return (g.name || "?") + "(" + (g.cards || []).join(",") + ")" });
    log("state cards [" + keysOf(ownedIds()).join(" ") + "]" + (S.fake ? " TEST SET" : "") + " room #" + S.room + " hits " + S.hits + " dodges " + S.dodges +
        " fired " + S.fired.length + " scripted " + S.launched.length + " timers " + S.timers.length +
        " press " + (now() - S.press.bt).toFixed(2) + " s ago | hit reports: Kris " + S.reports.kris + ", projectiles " + S.reports.shot +
        ", on objects " + S.objects +
        " | groups " + (gs.join(" ") || "none"));
    log("state mods " + (P.mods ? summary(P.mods) : "none") + " | unleashed " + unleashed());
    var st = each("state", []);
    for (var i = 0; i < st.length; i++) if (st[i]) log("state " + st[i]);
  }
  function test(cmd, args) {
    args = args || [];
    if (cmd === "pots_state") { state(); return true }
    if (cmd === "ptest") {
      var sub = args[0], a = args.slice(1), p = S.pl, L, i, n = 0;
      if (sub === "reports") {                      // dev: as if the trigger had reported nothing yet (the fallback world)
        if (a[0] === "0") { S.reports.kris = 0; S.reports.shot = 0 }
        log("reports kris " + S.reports.kris + " projectile " + S.reports.shot); return true;
      }
      if (sub === "hitlog") { S.hitlog = !(a[0] === "0" || a[0] === "off"); log("hitlog " + (S.hitlog ? "on" : "off")); return true }
      if (sub === "own") {                          // the scripts' view only: gates in the action data need the real cards
        var v = a.join(",");
        if (!v || v === "real") S.fake = null;
        else if (v === "none") S.fake = [];
        else S.fake = v.split(",").filter(function (x) { return x }).map(function (x) { return ID[x] || +x }).filter(function (x) { return x > 0 });
        S.sig = null; S.pollT = 0; log("own " + (S.fake ? "TEST SET [" + keysOf(S.fake).join(" ") + "]" : "the real cards"));
        if (p) poll(p);
        return true;
      }
      if (sub === "grant") { grant(a[0]); return true }
      if (sub === "held") { log("held " + held().join(",")); return true }
      if (sub === "press") { S.press.rt = CS.UnityEngine.Time.unscaledTime; S.press.bt = now(); log("press recorded"); return true }
      if (sub === "dodge") { dodge(p, null); return true }
      if (sub === "stage") { stage(p, null); return true }
      if (sub === "pos") {
        L = enemies(); var out = [];
        if (p) out.push("kris " + pos(p).x.toFixed(2) + "," + pos(p).y.toFixed(2));
        for (i = 0; i < L.length; i++) out.push(tag(L[i]) + " " + pos(L[i]).x.toFixed(2) + "," + pos(L[i]).y.toFixed(2));
        log("pos " + out.join(" | ")); return true;
      }
      if (sub === "armor") {                        // Super Armor on every enemy (stock 2301 at this level)
        L = enemies(); for (i = 0; i < L.length; i++) if (addBuff(L[i], "2301", 9999, +a[0] || 5, 1, L[i])) n++;
        log("armor " + (+a[0] || 5) + " on " + n + " enemies"); return true;
      }
      if (sub === "burn") {
        L = enemies(); for (i = 0; i < L.length; i++) if (burn(L[i], +a[0] || 5, +a[1] || 150)) n++;
        log("burn on " + n + " enemies"); return true;
      }
      if (sub === "buffs") {                        // which of these buffs each actor carries (1 / 0 / ? = unreadable)
        if (!a.length) { log("buffs: ptest buffs <idx> [idx ...]"); return true }
        L = (p ? [p] : []).concat(enemies()); var rows = [];
        for (i = 0; i < L.length; i++) {
          var cells = [];
          for (var bi = 0; bi < a.length; bi++) { var bs = buffState(L[i], a[bi]); cells.push(a[bi] + "=" + (bs === null ? "?" : bs ? 1 : 0)) }
          rows.push((L[i] === p ? "kris" : tag(L[i])) + ": " + cells.join(" "));
        }
        log("buffs " + rows.join(" | ")); return true;
      }
    }
    var r = each("test", [cmd, args, api]);
    for (var j = 0; j < r.length; j++) if (r[j] === true) return true;
    return false;
  }
  P.pots = { skillPress: guard("skillPress", skillPress), onFire: guard("onFire", onFire), test: guard("test", test),
             held: guard("held", held), grant: guard("grant", grant), hit: guard("hit", hit), dodge: guard("dodge", dodge),
             stage: guard("stage", stage), talent: guard("talent", talent) };
  P.mods = defaults();

  // what this file reads of js/command.js beyond the agreed interface: said once if a name is gone (the fallbacks
  // below then stand in: the script's own clock, its own defaults, no recharge figures in the log)
  function lean() {
    var cs = P.state, miss = [];
    if (!cs) miss.push("state");
    else {
      if (typeof cs.bnow !== "number") miss.push("state.bnow");
      if (!cs.wait) miss.push("state.wait");
      if (!cs.fireAt) miss.push("state.fireAt");
    }
    if (!P.CFG) miss.push("CFG");
    if (typeof P.isKris !== "function") miss.push("isKris");
    var need = ["cut", "launch", "enemies", "isReady", "isGuarded", "log"];
    for (var i = 0; i < need.length; i++) if (typeof P[need[i]] !== "function") miss.push(need[i] + "()");
    if (miss.length) once("lean " + miss.join(","), "js/command.js does not publish: " + miss.join(", ") + " (the scripts' own fallbacks stand in)");
  }

  // ---------------------------------------------------------------- the tick
  function tick(hud) {
    if (!U()) return;
    var b = battle(), p = b && b.PlayerSelf; if (!p) return;
    var cs = P.state, kris = cs && cs.pl === p ? !!cs.kris : (typeof P.isKris === "function" ? P.isKris(p) : false);
    if (!kris) return;
    var rt = CS.UnityEngine.Time.unscaledTime, dt = Math.min(0.1, CS.UnityEngine.Time.unscaledDeltaTime), ts = 1;
    try { ts = b.TimeScale } catch (e) {}
    var bdt = dt * ts; S.bnow += bdt;
    if (S.pl !== p || S.battle !== b) {             // a new battle: the cards are read again, per-room state is dropped
      S.pl = p; S.battle = b; S.sig = null; S.pollT = 0; S.stage = stageName(b);
      S.reports.kris = 0; S.reports.shot = 0;       // whether the trigger reports projectile hits is learnt per battle
      lean();
      var le = G.__bbDRPotsLoadErr;
      if (le && le.length) { log("SCRIPT LOAD FAILED: " + le.join(" | ")); G.__bbDRPotsLoadErr = [] }
      var early = G.__bbDRPotsEarly;
      if (early) { log("triggers before this script loaded: " + JSON.stringify(early)); G.__bbDRPotsEarly = null }
      if (rt - S.resetT > 1) reset(p, "new battle");
    } else {
      var st = stageName(b);
      if (st !== S.stage) { S.stage = st; if (rt - S.resetT > 1) reset(p, "new stage " + st) }
    }
    if (rt >= S.pollT) { S.pollT = rt + 0.25; poll(p, S.sig === null ? "battle start" : null) }
    if ((S.censusT += dt) >= 0.25) { S.censusT = 0; census() }     // which kinds are real enemies (isEnemy)
    timers(bdt); watchFired(bdt);
    each("tick", [p, bdt, api]);
  }
  T["dr-party/potentials"] = function (hud) {
    try { tick(hud) } catch (e) { if (!S.errs.tick) { S.errs.tick = 1; log("tick failed: " + e) } }
  };
  log("script registered (" + KEYS.length + " cards, build values " + (G.__bbDRPotsCFG ? "v" + CFG.v : "missing: defaults") + ")");
})(); } catch (e) {
  try { globalThis.__bbDR.party.log("POTS SCRIPT LOAD FAILED: potentials.js: " + e) } catch (e2) {}
}
