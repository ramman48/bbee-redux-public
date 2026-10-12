/* dr-party: Kris's Potentials at runtime, group "fireshock": D1 Big Fireshock, D2 Kindle, D3 Wildfire, D4 Aftershock,
   D5 Quick Ralsei, D6 Detonate, and Potential Unleashed (kp_fireshock.py builds the data; PLAN.md's updates 3, 4, 7, 8
   and section 4 "D. Fireshock"). Appended after js/potentials.js. Every enemy this file picks comes from the core's
   api.near / api.enemies, which read __bbDR.party.enemies() (real enemies only: no objects, no traps); a hit the
   trigger reports on anything that list has not held in this room (a pot, a trap) starts nothing here.
   What the script does:
     D1  mods.fs.action = the big fireball (fs_ball_home_b, which bursts as fs_burst_b).
     any card  mods.fs.guardAction = the plain Fireshock (fs_guard_ball -> fs_guard_burst): a guarding target gets the base
         burst with nothing a card adds. With no cards the base fireball is already plain.
     D2  after each Fireshock hit (a burst, a chain burst, an aftershock, the burning ground) it looks at the enemy 0.1 s
         later: burning -> "kindle <enemy> burning"; not burning -> it burns it from the script ("kindle fallback",
         PLAN.md R4) unless that is switched off. (The chain burst and the ground burn with D3 alone.)
     D3  THE CHAIN: from each enemy the cast's fire hits (the burst, then each chain burst), 0.08 s later, a leap
         (fs_chain, which bursts as fs_burst_c) flies to the nearest enemy on screen (api.chase: on screen however far,
         or within 30 u when off it) that this cast has neither hit nor sent a leap to and that is not guarding; up to
         3 leaps a cast ("fire chain 1/3 -> <enemy>"). A leap is not
         tracked by the command (its re-targeting would take any enemy): this file gives a leap whose target is gone the
         nearest enemy its cast has not hit. A leap whose burst hit nobody: its target was lost -> it leaps again from
         there (not counted twice); else the next leap leaves from where it burst.
         THE SPREAD: every 0.5 s each enemy that is not burning and stands within 2.5 u of a burning one catches fire
         from the script ("spread <a> -> <b>"), one step per pulse. Each fire (an ignition by a hit, or a burn found
         that this file did not spread) passes to an enemy once: two enemies never keep each other burning for ever.
         The enemy that catches shows fs_spread / fs_spread_n (a projectile without a hit, launched there).
         The burning ground (fs_field) is data on the burst; its hits are only counted and kindled here.
     D4  after each burst hit it looks for the pillar the hit created ("aftershock under <enemy>"); none -> "aftershock: no
         fs_pillar under <enemy>" and, only when the fallback is on, it launches one itself.
     D5  mods.recharge.ralsei x 0.7.
     D6  a Rude Buster bolt or chain hop (the core's source set "detonate": never the bolt's explosion) hits an enemy
         that burns and does not guard: rb_detonate is launched on its middle and its burn is taken off ("detonate
         <enemy> ..."). With the pair C2 + D2 the chain's hops carry fire themselves: such a hop only detonates an enemy
         that was burning 0.1 s or more before it (never the fire it has just lit: "detonate: ... its own fire").
         Each detonation is told to the other groups (api.note "detonated <enemy>").
     U   Potential Unleashed has no script side (the stock card); pots_state and `ptest unleashed` say whether it is held.
   Hits come from Kris's hit trigger (js/potentials.js onHit). Whether it reports projectile hits is not known (PLAN.md
   R1). WHILE NO PROJECTILE HIT HAS BEEN REPORTED IN THIS BATTLE the place where a projectile ended stands in ("... by
   position"): the enemies within a burst's reach were hit by it (Kindle, the chain's start and its next leaps); a
   burning enemy within 1.6 u of where a bolt ended before its life ran out was hit by it (Detonate). Once one report
   has come, a projectile without a report hit nobody.
   Log lines ("[DR-PARTY] POTS ..."): burst <action> at x,y: n enemies in reach | kindle ... | aftershock ... |
   fire chain n/3 -> ... | fire chain #<cast> over ... | spread a -> b | detonate ... | unleashed held n.
   Test lines (drparty_test.txt): ptest unleashed | ptest fsfallback <kindle|aftershock> <on|off> | ptest pillar (a pillar
   under every enemy, from the script) | ptest fschain (a chain from the nearest enemy, as if a burst had just hit it) |
   ptest fsburn [n] (the script burns the n nearest enemies; 1) | ptest fsspread (one spread pulse now) | ptest fsfield
   (the burning ground under the nearest enemy, from the script) | ptest fsdetonate (the nearest burning enemy) |
   ptest fs (this group's state).
   The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis, DR = G.__bbDR, P = DR && DR.party;
  if (!P || !P.potsGroups) return;                  // js/potentials.js is not loaded
  for (var gi = 0; gi < P.potsGroups.length; gi++) if (P.potsGroups[gi] && P.potsGroups[gi].name === "fireshock") return;
  var IsNull = CSharpDefine_1.IsNull;
  var C = (G.__bbDRPotsCFG || {}).fireshock || {};   // the build's values (kp_fireshock.content); the defaults are the same
  function val(o, k, d) { return o && o[k] !== undefined && o[k] !== null ? o[k] : d }
  var BALL = { base: val(C.ball, "base", "fs_ball_home"), big: val(C.ball, "big", "fs_ball_home_b"), guard: val(C.ball, "guard", "fs_guard_ball") };
  var BURST = { base: val(C.burst, "base", "fs_burst"), big: val(C.burst, "big", "fs_burst_b"), guard: val(C.burst, "guard", "fs_guard_burst"),
                r: val(C.burst, "r", 1.6), rBig: val(C.burst, "rBig", 2.4) };
  var KIN = { buff: val(C.kindle, "buff", "1116"), dur: val(C.kindle, "dur", 5), dps: val(C.kindle, "dps", 150), check: val(C.kindle, "check", 0.1) };
  var PIL = { action: val(C.pillar, "action", "fs_pillar"), delay: val(C.pillar, "delay", 0.35), check: val(C.pillar, "check", 0.12) };
  var CHN = { ball: val(C.chain, "ball", "fs_chain"), burst: val(C.chain, "burst", "fs_burst_c"), leaps: val(C.chain, "leaps", 3),
              range: val(C.chain, "range", 30), delay: val(C.chain, "delay", 0.08), offset: val(C.chain, "offset", 0.5),
              check: val(C.chain, "check", 0.12), window: val(C.chain, "window", 0.45), r: val(C.chain, "r", 1.12), life: val(C.chain, "life", 1.8) };
  var FLD = { action: val(C.field, "action", "fs_field") };
  var SPR = { every: val(C.spread, "every", 0.5), range: val(C.spread, "range", 2.5), dur: val(C.spread, "dur", 5), dps: val(C.spread, "dps", 150),
              flash: val(C.spread, "flash", [["fs_spread_n", 1.5], ["fs_spread", 99]]), at: val(C.spread, "at", "feet") };
  var DET = { action: val(C.detonate, "action", "rb_detonate"), r: val(C.detonate, "r", 2.6), reach: val(C.detonate, "reach", 1.6),
              cd: val(C.detonate, "cd", 0.25), life: val(C.detonate, "life", 1.5), skip: val(C.detonate, "skip", []) };
  var QUICK = { ralsei: val(C.quick, "ralsei", 0.7) };
  var FB = { kindle: val(C.kindle, "fallback", true) !== false, aftershock: val(C.pillar, "fallback", false) === true };
  var BURSTS = ["fs_burst*"], BALLS = ["fs_ball_home*"];
  var S = { casts: 0, big: 0, hits: 0, plain: 0, kindled: 0, kindleFb: 0, notBurning: 0, shocks: 0, pillars: 0, noPillar: 0, shockFb: 0, pillarHits: 0,
            byPos: 0, said: {},
            chains: [], links: [], seq: 0, leaps: 0, chainHits: 0, fieldHits: 0,      // D3: the casts that chain, their leaps in flight
            fire: {}, fireSeq: 0, spreadT: 0, spreads: 0,                             // D3: what is known of each enemy's fire
            dets: 0, detHits: 0, hot: {}, hotPrev: {}, hotT: 0, ownFire: 0,           // D6; who burned at the last two looks
            objects: 0 };                                                             // hits on anything that is no real enemy
  P.potsFireshock = S;
  function verbose() { return !P.potsState || P.potsState.hitlog !== false }
  function say(api, s) { if (verbose()) api.log(s) }
  function noReports(api) { var r = typeof api.reports === "function" ? api.reports() : null; return !r || !(r.shot > 0) }

  function once(api, key, s) { if (!S.said[key]) { S.said[key] = 1; api.log(s) } }
  function alive(a) { try { return !!a && !IsNull(a) && !a.IsDead } catch (e) { return false } }
  function actionOf(a) { try { return String(a.ActionMgr.CurrentActionName || "") } catch (e) { return "" } }
  function uid(a) { try { return a.UniqueId } catch (e) { return undefined } }
  function same(a, b) {                              // one projectile: the same object, or the same (real) id
    if (!a || !b) return false;
    if (a === b) return true;
    var x = uid(a);
    return typeof x === "number" && x !== 0 && x === uid(b);
  }
  function among(L, n) { for (var i = 0; i < L.length; i++) if (L[i] === n) return true; return false }
  function isBurst(api, n) { return api.matches(BURSTS, n) }
  function isPlain(n) { return n === BURST.guard }
  function onoff(b) { return b ? "on" : "off" }
  function at(x, y) { return (+x).toFixed(2) + "," + (+y).toFixed(2) }
  function mid(a, api) { var q = api.centre(a); return { x: q.x, y: q.y } }
  function nearest(api) {                            // the enemy nearest to Kris (the test lines)
    var p = api.player(); if (!p) return null;
    var q = api.pos(p), L = api.near(q.x, q.cy, 60);
    return L.length ? L[0].a : null;
  }
  // Real enemies only (PLAN.md's update 8). The hit trigger also reports objects and traps (anything of another
  // faction): the script adds nothing to those. The rule is the core's (api.isEnemy; the hit's own h.enemy): a kind the
  // command's own list (__bbDR.party.enemies) has held in this room is an enemy, also one the hit killed; a pot or a
  // trap never is
  function real(a, api) { return api.isEnemy(a) }
  // D6 asks whether an enemy burned BEFORE the hit: a chain hop that carries fire itself (the pair C2 + D2: Burn on the
  // hop's victims) must not detonate the fire it has just lit. S.hot / S.hotPrev: who burned at the last two looks (every
  // 0.1 s while D6 is held). For such a hop the enemy must have burned at both, that is for 0.1 s or more: a look made
  // between the hop's hit and its report (or its end, when nothing reports) cannot make the hop's own fire count
  function lookHot(api) {
    var L = api.enemies(), hot = {};
    for (var i = 0; i < L.length; i++) if (api.buffState(L[i], KIN.buff) === true) hot[api.tag(L[i])] = 1;
    S.hotPrev = S.hot; S.hot = hot;
  }
  function carriesFire(act, api) { return api.matches("chain", act) && api.has("C2") && api.has("D2") }
  function burnedBefore(a, act, api) {
    if (api.buffState(a, KIN.buff) !== true) return false;
    var k = api.tag(a);
    return !carriesFire(act, api) || (!!S.hot[k] && !!S.hotPrev[k]);
  }
  // what is known of an enemy's fire (D3's spread): on = it burned at the last pulse; fresh = a hit set it on fire since;
  // fire = the fire it burns with; had = every fire it has had (a fire passes to an enemy once)
  function rec(k) { return S.fire[k] || (S.fire[k] = { on: false, fresh: false, fire: 0, had: {} }) }
  // which fire hits kindle: the cast's burst and the aftershock with D2; the chain burst and the ground with D2 or D3
  function kindles(act, api) { return act === CHN.burst || act === FLD.action ? api.has("D2") || api.has("D3") : api.has("D2") }

  // ---- D2: is the enemy burning? api.buffState: true / false; null = it cannot be read (then nothing is concluded and
  // nothing is added)
  function look(tg, act, api, how) {                // how: "" for a reported hit, " by position" for the no-report route
    if (!alive(tg)) return;
    var who = api.tag(tg), st = api.buffState(tg, KIN.buff);
    if (st === true) { S.kindled++; rec(who).fresh = true; say(api, "kindle " + who + " burning (" + act + ")" + how); return }
    if (st === null) { once(api, "burn?", "kindle: the burn on " + who + " cannot be read (no check, no fallback)"); return }
    if (!FB.kindle) { S.notBurning++; say(api, "kindle " + who + " NOT burning after " + act + how); return }
    var ok = api.burn(tg, KIN.dur, KIN.dps);
    S.kindleFb++;
    if (ok) rec(who).fresh = true;
    say(api, "kindle fallback " + who + (ok ? " burning (script)" : " NOT burning: the script could not add it") + " after " + act + how);
  }
  function kindle(h, api) {
    var tg = h.target, act = h.action;
    api.after(KIN.check, function () { look(tg, act, api, "") });
  }
  // no projectile hit has been reported in this battle: the enemies within the burst's box when it is seen to burst.
  // (The data's own Burn does not need the trigger; this is its confirmation, and its stand-in if the data did not burn)
  function kindleAt(x, y, r, act, api) {
    var L = api.near(x, y, r + 0.9), who = [];      // (near() measures to the enemy's middle: about half a body beyond the box)
    for (var i = 0; i < L.length; i++) if (!api.guarded(L[i].a)) who.push(L[i].a);
    if (!who.length) return;
    S.byPos++;
    api.after(KIN.check + 0.05, function () {
      if (!noReports(api)) return;                   // a report came meanwhile: the reported hits are looked at instead
      for (var j = 0; j < who.length; j++) look(who[j], act, api, " by position");
    });
  }

  // ---- D4: the pillar the hit created (api.projectiles: Kris's live projectiles, or null when they cannot be listed)
  function pillarsNear(api, x, y) {
    var L = api.projectiles(), n = 0;
    if (!L) return null;
    for (var i = 0; i < L.length; i++) {
      try {
        var b = L[i];
        if (!alive(b) || String(b.ActionMgr.CurrentActionName) !== PIL.action) continue;
        if (Math.abs(b.Position.x - x) <= 1.0 && Math.abs(b.Position.y - y) <= 2.0) n++;
      } catch (e) {}
    }
    return n;
  }
  function aftershock(h, api) {
    var tg = h.target, who = api.tag(tg), q = api.pos(tg);
    S.shocks++;
    say(api, "aftershock under " + who + " at " + at(q.x, q.y) + " (erupts in " + PIL.delay + " s)");
    api.after(PIL.check, function () {
      var n = pillarsNear(api, q.x, q.y);
      if (n === null) { once(api, "bullets?", "aftershock: Kris's projectiles cannot be listed (no check, no fallback)"); return }
      if (n > 0) { S.pillars++; return }
      S.noPillar++;
      if (!FB.aftershock) { say(api, "aftershock: no " + PIL.action + " under " + who); return }
      S.shockFb++;
      say(api, "aftershock fallback under " + who + " (script)");
      api.launch(PIL.action, q.x, q.y, 1, 0, null, null);
    });
  }

  // ---- D3: the chain. A cast = { hit: what this cast's fire has done to each enemy (1 a leap is on its way, 2 hit,
  // 3 its leap burst short of it), n: leaps flown, wait: timers pending, over }
  function castOf(b, api) {                          // the cast a burst object belongs to (projectiles are pooled: only while it bursts)
    if (!b) return null;
    var t = api.now();
    for (var i = S.chains.length - 1; i >= 0; i--) if (same(S.chains[i].src, b) && t - S.chains[i].t <= CHN.window) return S.chains[i];
    return null;
  }
  function newCast(b, api) {
    var c = { id: ++S.seq, src: b || null, hit: {}, n: 0, hits: 0, wait: 0, t: api.now(), over: false };
    S.chains.push(c);
    if (S.chains.length > 12) S.chains.shift();
    return c;
  }
  function flying(c) { var n = 0; for (var i = 0; i < S.links.length; i++) if (S.links[i].c === c && !S.links[i].closed) n++; return n }
  function settle(c, api) {                          // nothing in flight, nothing pending: the chain is over
    if (c.over || c.wait > 0 || flying(c) > 0) return;
    c.over = true;
    say(api, "fire chain #" + c.id + " over: " + c.n + " of " + CHN.leaps + " leaps, " + c.hits + " enemies hit" +
             (c.n >= CHN.leaps ? "" : " (no enemy left that this cast has not hit)"));
  }
  function free(c, api) { return function (a) { return !c.hit[api.tag(a)] && alive(a) && !api.guarded(a) } }   // a leap may go there
  function struck(c, tg, api) {                      // this cast's fire has hit tg: a leap leaves from it (once per enemy)
    var k = api.tag(tg);
    if (c.hit[k] === 2) return false;
    c.hit[k] = 2; c.hits++; c.over = false;
    var from = mid(tg, api);
    c.wait++;
    api.after(CHN.delay, function () { c.wait--; leap(c, from, api, 0) });
    return true;
  }
  function leap(c, from, api, again) {               // again: the number of a leap that flies again (its target was lost)
    if (c.over) return;
    if (!again && c.n >= CHN.leaps) { settle(c, api); return }
    var L = api.chase(from.x, from.y, CHN.range, free(c, api));       // anywhere on screen (and within CHN.range off it)
    if (!L.length) { settle(c, api); return }
    var q = L[0], dx = q.x - from.x, dy = q.y - from.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) { dx = 1; dy = 0; d = 1 }
    var off = Math.min(CHN.offset, d * 0.5), sx = from.x + dx / d * off, sy = from.y + dy / d * off, n = again || c.n + 1;
    // not tracked by the command (opts null): its re-targeting takes the nearest enemy, hit by this cast or not
    var b = api.launch(CHN.ball, sx, sy, dx / d, dy / d, q.a, null);
    if (!b) { api.log("fire chain " + n + "/" + CHN.leaps + " not launched"); settle(c, api); return }
    if (!again) c.n = n;
    for (var i = S.links.length - 1; i >= 0; i--) if (S.links[i].b === b) S.links.splice(i, 1);     // the pool handed the object back
    c.hit[api.tag(q.a)] = 1; S.leaps++;
    S.links.push({ b: b, tgt: q.a, c: c, n: n, t: api.now(), x: sx, y: sy, hits: 0, end: "", endT: null, closed: false, again: !!again, retT: null, lost: false });
    say(api, "fire chain " + n + "/" + CHN.leaps + (again ? " again" : "") + " -> " + api.tag(q.a) + " (" + d.toFixed(1) + " u)");
  }
  function linkOf(b) { if (b) for (var i = S.links.length - 1; i >= 0; i--) if (same(S.links[i].b, b)) return S.links[i]; return null }
  function chainHit(h, api) {                        // a chain burst hit somebody
    S.chainHits++;
    var lk = linkOf(h.attacker), tg = h.target, k = api.tag(tg);
    if (lk) lk.hits++;
    if (h.guarded) { if (lk && lk.c.hit[k] !== 2) { lk.c.hit[k] = 2; lk.c.hits++ } return }     // hit, but the script adds nothing
    if (kindles(CHN.burst, api)) kindle(h, api);
    if (lk && api.has("D3")) struck(lk.c, tg, api);
  }
  function leapEnded(o, api) {                       // the core saw a leap end (its burst, or it is gone)
    var lk = linkOf(o.bullet || o.b);
    if (!lk || lk.endT !== null) return;
    lk.endT = api.now(); lk.x = +o.x; lk.y = +o.y; lk.end = String(o.end || "");
    lk.c.wait++;
    api.after(CHN.check, function () { lk.c.wait--; judge(lk, api) });
  }
  function judge(lk, api) {                          // CHN.check after a leap ended: what did its burst do?
    var c = lk.c, i;
    if (lk.closed) return;
    lk.closed = true;
    if (lk.hits > 0) { settle(c, api); return }      // its hits were reported: each started the next leap itself
    var here = { x: lk.x, y: lk.y }, name = "fire chain " + lk.n + "/" + CHN.leaps;
    if (lk.end === CHN.burst && noReports(api)) {    // no projectile hit was ever reported: who stands in its reach was hit
      var L = api.near(here.x, here.y, CHN.r + 0.9), who = [];
      for (i = 0; i < L.length; i++) if (!api.guarded(L[i].a)) who.push(L[i].a);
      if (who.length) {
        S.byPos++;
        say(api, name + " burst at " + at(here.x, here.y) + ": " + who.length + " enemies in reach (no hit report: read by position)");
        for (i = 0; i < who.length; i++) { if (kindles(CHN.burst, api)) look(who[i], CHN.burst, api, " by position"); struck(c, who[i], api) }
        settle(c, api);
        return;
      }
    }
    // it hit nobody. Its target was lost (dead, or handed over a moment before it ended): it leaps again from here
    var k = lk.tgt ? api.tag(lk.tgt) : null, lost = !alive(lk.tgt) || (lk.retT !== null && lk.endT - lk.retT < 0.2);
    if (k && c.hit[k] === 1) { if (lost) delete c.hit[k]; else c.hit[k] = 3 }
    if (lost && !lk.again) {
      say(api, name + (lk.end === CHN.burst ? " burst at " : " ended at ") + at(here.x, here.y) + ": its target was lost");
      leap(c, here, api, lk.n);
    } else {
      say(api, name + (lk.end === CHN.burst ? " burst at " + at(here.x, here.y) + " and hit nobody" : " ended as " + (lk.end || "?") + ": no burst"));
      leap(c, here, api, 0);                         // the next leap, if one is left, leaves from where this one ended
    }
    settle(c, api);
  }
  function watchLinks(api) {
    var t = api.now();
    for (var i = S.links.length - 1; i >= 0; i--) {
      var lk = S.links[i];
      if (lk.endT !== null) { if (lk.closed && t - lk.endT > 1.5) S.links.splice(i, 1); continue }
      if (t - lk.t > CHN.life + 1.5) { lk.closed = true; S.links.splice(i, 1); settle(lk.c, api); continue }   // its end was never seen
      if (!alive(lk.b) || actionOf(lk.b) !== CHN.ball) continue;        // ending: the core's watch tells (onImpact)
      try { lk.x = lk.b.Position.x; lk.y = lk.b.Position.y } catch (e) {}
      if (lk.lost || alive(lk.tgt)) continue;
      // its target is gone: the nearest enemy this cast has not hit, from where the leap is
      var L = api.chase(lk.x, lk.y, CHN.range, free(lk.c, api));
      if (!L.length) { lk.lost = true; continue }
      if (!api.setTarget(lk.b, L[0].a)) { lk.lost = true; continue }
      lk.tgt = L[0].a; lk.c.hit[api.tag(L[0].a)] = 1; lk.retT = t;
      say(api, "fire chain " + lk.n + "/" + CHN.leaps + " re-targets " + api.tag(L[0].a));
    }
  }
  // no projectile hit has been reported in this battle: the enemies in the burst's reach start the chain
  function chainAt(b, x, y, r, api) {
    var L = api.near(x, y, r + 0.9), who = [];
    for (var i = 0; i < L.length; i++) if (!api.guarded(L[i].a)) who.push(L[i].a);
    if (!who.length) return;
    api.after(CHN.check, function () {
      if (!noReports(api) || castOf(b, api)) return; // a report came meanwhile: the reported hits started it
      var c = newCast(b, api);
      S.byPos++;
      say(api, "fire chain #" + c.id + " starts from " + who.length + " enemies in the burst's reach (no hit report: read by position)");
      for (var j = 0; j < who.length; j++) if (alive(who[j])) struck(c, who[j], api);
      settle(c, api);
    });
  }

  // ---- D3: the spread. One pulse: every enemy that burns now is a source; each enemy that does not burn (and does not
  // guard) catches the nearest source's fire within SPR.range, unless it has had that fire already
  function flash(src, u, d, api) {
    if (!SPR.flash.length) return;
    var name = SPR.flash[SPR.flash.length - 1][0];
    for (var i = 0; i < SPR.flash.length; i++) if (d <= SPR.flash[i][1]) { name = SPR.flash[i][0]; break }
    api.launch(name, u.x, SPR.at === "middle" ? u.y : u.fy, u.x >= src.x ? 1 : -1, 0, null, null);
  }
  function pulse(api) {
    var L = api.enemies(), hot = [], cold = [], seen = {}, i, j, k, n = 0;
    for (i = 0; i < L.length; i++) {
      var a = L[i]; if (!alive(a)) continue;
      k = api.tag(a); seen[k] = 1;
      var st = api.buffState(a, KIN.buff), r = rec(k), q = api.pos(a);
      if (st === null) { once(api, "burn?", "kindle: the burn on " + k + " cannot be read (no check, no fallback)"); continue }
      if (st) {
        if (!r.on || r.fresh) { r.fire = ++S.fireSeq; r.had[r.fire] = 1 }   // a fire of its own: a hit set it, not a neighbour
        r.on = true; r.fresh = false;
        hot.push({ a: a, r: r, k: k, x: q.x, y: q.cy });
      } else {
        r.on = false; r.fresh = false;
        if (!api.guarded(a)) cold.push({ a: a, r: r, k: k, x: q.x, y: q.cy, fy: q.y });
      }
    }
    for (k in S.fire) if (!seen[k]) delete S.fire[k];
    for (i = 0; i < cold.length; i++) {
      var u = cold[i], best = null, bd = SPR.range;
      for (j = 0; j < hot.length; j++) {
        var b = hot[j]; if (u.r.had[b.r.fire]) continue;
        var d = Math.sqrt((b.x - u.x) * (b.x - u.x) + (b.y - u.y) * (b.y - u.y));
        if (d <= bd) { bd = d; best = b }
      }
      if (!best) continue;
      if (!api.burn(u.a, SPR.dur, SPR.dps)) { once(api, "spread burn", "spread: the script could not burn " + u.k); continue }
      u.r.on = true; u.r.fire = best.r.fire; u.r.had[best.r.fire] = 1;
      n++; S.spreads++;
      say(api, "spread " + best.k + " -> " + u.k + " (" + bd.toFixed(1) + " u)");
      flash(best, u, bd, api);
    }
    return n;
  }

  // ---- D6: the detonation
  function detonate(tg, api, how) {
    var who = api.tag(tg);
    if (!api.cd("fs detonate " + who, DET.cd)) return false;
    var q = mid(tg, api), b = api.launch(DET.action, q.x, q.y, 1, 0, null, null);
    if (!b) { api.log("detonate " + who + ": " + DET.action + " not launched"); return false }
    api.removeBuff(tg, KIN.buff);
    var still = api.buffState(tg, KIN.buff) === true, r = S.fire[who];
    if (r && !still) { r.on = false; r.fresh = false }
    if (!still) { delete S.hot[who]; delete S.hotPrev[who] }
    api.note("detonated " + who);                    // (the party group's chain fire: a burn missing now was not a miss)
    S.dets++;
    say(api, "detonate " + who + " at " + at(q.x, q.y) + how + ": " + api.near(q.x, q.y, DET.r + 0.5).length + " enemies in reach (" + DET.r +
             " u)" + (still ? "; its burn could NOT be taken off" : ""));
    return true;
  }
  // no projectile hit has been reported in this battle: a bolt that ended before its life ran out, next to a burning enemy
  function detonateAt(o, api) {
    if (!(o.age < DET.life - 0.05) || String(o.end || "gone") === "gone") return;
    var L = api.near(o.x, o.y, DET.reach, function (a) { return burnedBefore(a, String(o.action || ""), api) && !api.guarded(a) });
    if (!L.length) return;
    S.byPos++;
    detonate(L[0].a, api, " by position (no hit report: " + o.action + " ended " + L[0].d.toFixed(1) + " u from it)");
  }

  function reset() {
    var i;
    for (i = 0; i < S.chains.length; i++) S.chains[i].over = true;      // (timers still holding one do nothing)
    for (i = 0; i < S.links.length; i++) S.links[i].closed = true;
    S.chains = []; S.links = []; S.fire = {}; S.spreadT = 0; S.said = {}; S.hot = {}; S.hotPrev = {}; S.hotT = 0;
  }

  // ---- Potential Unleashed: how many the run's character holds (-1: not readable). It is no card of the 32, so the
  // core's has() / owned() never list it: api.unleashed() reads the run's own list
  function unleashed() { var api = P.potsApi; return api && typeof api.unleashed === "function" ? api.unleashed() : -1 }

  P.potsGroups.push({
    name: "fireshock", cards: ["D1", "D2", "D3", "D4", "D5", "D6", "U"],
    mods: function (m, has, api) {
      if (has("D1")) m.fs.action = BALL.big;
      if (has("D5")) m.recharge.ralsei *= QUICK.ralsei;
      if (api.owned().length) m.fs.guardAction = BALL.guard;      // the cards' properties sit on fs_burst*: the plain copy has none
    },
    onFire: function (f, api) { if (f.who === "ralsei") { S.casts++; if (f.action === BALL.big) S.big++ } },
    onImpact: function (o, api) {
      var act = String(o.action || "");
      if (o.who === "script" && act === CHN.ball) { leapEnded(o, api); return }
      if (o.who !== "script" || api.matches("chain", act)) {            // a command's own bolt, or a chain hop of Rude Buster
        if (api.has("D6") && api.matches("detonate", act) && noReports(api)) detonateAt(o, api);
      }
      if (o.who !== "ralsei" && !api.matches(BALLS, act) && act !== BALL.guard) return;
      var end = String(o.end || "");
      if (!isBurst(api, end) && !isPlain(end)) { say(api, "fireball " + act + " ended as " + end + ": no burst"); return }
      var x = o.x, y = o.y;
      try { if (alive(o.bullet)) { x = o.bullet.Position.x; y = o.bullet.Position.y } } catch (e) {}
      var r = end === BURST.big ? BURST.rBig : BURST.r, reach = r + 0.5;
      say(api, "burst " + end + " at " + at(x, y) + ": " + api.near(x, y, reach).length + " enemies in reach (" +
              reach.toFixed(1) + " u; box " + r + " u each way)");
      if (isPlain(end) || !noReports(api)) return;
      if (api.has("D2")) kindleAt(x, y, r, end, api);
      if (api.has("D3")) chainAt(o.bullet, x, y, r, api);
    },
    onHit: function (h, api) {
      if (h.kris) return;
      var act = h.action;
      if (!real(h.target, api)) { S.objects++; return }                // an object or a trap: the script adds nothing
      if (act === DET.action) { S.detHits++; return }                  // the detonation's own hits start nothing
      if (act === PIL.action) {
        S.pillarHits++;
        say(api, "aftershock hit " + api.tag(h.target));
        if (api.has("D2") && !h.guarded) kindle(h, api);
        return;
      }
      if (act === FLD.action) {                                        // the burning ground: counted; looked at once a second
        S.fieldHits++;
        if (!h.guarded && kindles(act, api) && api.cd("fs ground " + api.tag(h.target), 1)) kindle(h, api);
        return;
      }
      if (isPlain(act)) { S.plain++; once(api, "plain", "the plain Fireshock hit " + api.tag(h.target) + " (a guarding target: nothing a card adds)"); return }
      if (act === CHN.burst) { chainHit(h, api); return }
      if (isBurst(api, act)) {
        S.hits++;
        if (h.guarded) return;                       // a guarding enemy caught in somebody else's burst: the script adds nothing
        if (api.has("D2")) kindle(h, api);
        if (api.has("D4")) aftershock(h, api);
        if (api.has("D3")) struck(castOf(h.attacker, api) || newCast(h.attacker, api), h.target, api);
        return;
      }
      // D6: a Rude Buster bolt or chain hop hit an enemy that was burning (an explosion a bolt makes is no bolt: the
      // source set leaves it out, and DET.skip). A hop that carries fire itself (C2 + D2) needs the enemy to have burned
      // before it: the fire it has just lit is not detonated
      if (h.src && h.src.detonate && api.has("D6") && !h.guarded && !among(DET.skip, act)) {
        if (burnedBefore(h.target, act, api)) detonate(h.target, api, "");
        else if (carriesFire(act, api) && api.buffState(h.target, KIN.buff) === true) {
          S.ownFire++; say(api, "detonate: " + api.tag(h.target) + " burns from this hop's own fire (it was not burning before): no detonation");
        }
      }
    },
    onStage: function (p, why, api) { reset() },
    tick: function (p, bdt, api) {
      if (api.has("D6")) { S.hotT += bdt; if (S.hotT >= 0.1) { S.hotT = 0; lookHot(api) } }
      if (S.links.length) watchLinks(api);
      if (api.has("D3")) { S.spreadT += bdt; if (S.spreadT >= SPR.every) { S.spreadT = 0; pulse(api) } }
    },
    test: function (cmd, args, api) {
      if (cmd !== "ptest") return false;
      var sub = args[0], L, i, n = 0, a, q;
      if (sub === "unleashed") { api.log("unleashed held " + unleashed()); return true }
      if (sub === "fs") { api.log("state " + this.state()); return true }
      if (sub === "fsfallback") {
        var on = !(args[2] === "0" || args[2] === "off");
        if (args[1] === "kindle" || args[1] === "aftershock") FB[args[1]] = on;
        api.log("fallback kindle=" + onoff(FB.kindle) + " aftershock=" + onoff(FB.aftershock));
        return true;
      }
      if (sub === "pillar") {
        L = api.enemies();
        for (i = 0; i < L.length; i++) { q = api.pos(L[i]); if (api.launch(PIL.action, q.x, q.y, 1, 0, null, null)) n++ }
        api.log("pillar under " + n + " enemies (script)");
        return true;
      }
      if (sub === "fschain") {
        a = nearest(api);
        if (a) struck(newCast(null, api), a, api);
        api.log("test fire chain from " + (a ? api.tag(a) : "nobody"));
        return true;
      }
      if (sub === "fsburn") {
        var p = api.player(), want = Math.max(1, +args[1] || 1);
        q = p ? api.pos(p) : { x: 0, cy: 0 };
        L = api.near(q.x, q.cy, 60);
        for (i = 0; i < L.length && n < want; i++) if (api.burn(L[i].a, KIN.dur, KIN.dps)) n++;
        api.log("fsburn on " + n + " enemies (script)");
        return true;
      }
      if (sub === "fsspread") { api.log("spread pulse: " + pulse(api) + " caught fire"); return true }
      if (sub === "fsfield") {
        a = nearest(api);
        if (a) { q = api.pos(a); api.launch(FLD.action, q.x, q.y, 1, 0, null, null) }
        api.log("field under " + (a ? api.tag(a) : "nobody") + " (script)");
        return true;
      }
      if (sub === "fsdetonate") {
        L = api.enemies(); a = null;
        var pq = api.player() ? api.pos(api.player()) : { x: 0, cy: 0 }, bd = 1e9;
        for (i = 0; i < L.length; i++) {
          if (api.buffState(L[i], KIN.buff) !== true) continue;
          q = api.pos(L[i]);
          var d = Math.abs(q.x - pq.x) + Math.abs(q.cy - pq.cy);
          if (d < bd) { bd = d; a = L[i] }
        }
        if (a) detonate(a, api, " (test)");
        api.log("test detonate " + (a ? api.tag(a) : "nobody: no enemy burns"));
        return true;
      }
      return false;
    },
    state: function () {
      var m = P.mods || {}, fs = m.fs || {}, rc = m.recharge || {}, fl = 0;
      for (var i = 0; i < S.links.length; i++) if (!S.links[i].closed) fl++;
      return "fireshock fs=" + fs.action + "/" + fs.guardAction + " casts " + S.casts + " (big " + S.big + ") burst hits " + S.hits + " (plain " + S.plain +
             ") kindled " + S.kindled + " (script " + S.kindleFb + ", not burning " + S.notBurning + ") aftershocks " + S.shocks + " (pillars seen " +
             S.pillars + ", missing " + S.noPillar + ", script " + S.shockFb + ", hits " + S.pillarHits + ") chains " + S.seq + " (leaps " + S.leaps +
             ", flying " + fl + ", chain burst hits " + S.chainHits + ", ground hits " + S.fieldHits + ") spreads " + S.spreads + " detonations " + S.dets +
             " (hits " + S.detHits + ") ralsei recharge " + (+rc.ralsei || 0).toFixed(2) + " read by position " + S.byPos + " hits on objects " + S.objects +
             " fallback kindle=" + onoff(FB.kindle) +
             " aftershock=" + onoff(FB.aftershock) + " unleashed " + unleashed();
    }
  });
})(); } catch (e) {
  try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_fireshock.js: " + e) } catch (e2) {}
}
