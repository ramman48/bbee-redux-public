/* dr-party: Kris's Potentials, group C "Rude Buster" at runtime (local_only/deltarune/party/potentials/PLAN.md: the top
   block "UPDATES FROM THE LEAD" items 6-8, then section 4 C). C1 Big Buster, C2 Chain Buster, C3 Armor Buster (its data
   side), C4 Push Buster, C5 Timed Buster, C6 Red Buster (reworked), C7 Quick Susie.
   A group file of js/potentials.js (its registry and api are described there); the actions are built by kp_rudebuster.py,
   whose numbers arrive in globalThis.__bbDRPotsCFG.rb (the defaults below are the same values).
   Appended to data/js/window/battle/BattleUI after js/potentials.js (module scope: csharp_1, CSharpDefine_1).
   EVERY ENEMY THIS FILE PICKS (a hop's target, the red bolt's next target, the boss push) comes from the core's
   api.enemies() / api.near() / api.chase(), which is js/command.js's own list: real enemies only (MonsterConfig tagged
   Monster or Boss, never a TargetIgnore object or a trap). The raw actor list is never read here. The same list decides
   what a HIT counts for (the core's api.isEnemy): the trigger also reports pots and traps a bolt passes through; a hit
   on a kind that list has not held in this room starts nothing here (no chain, no red count, no shock, no push watch).
   "The next enemy" of a hop or a red bolt is taken with api.chase: anywhere on screen, however far, and within 30 u of
   the bolt when off screen (the lead: "after it hits one enemy it chases the next from anywhere on screen").

   What it does:
     mods      which bolt Susie throws: rb_bolt_home, _b (C1), _k (C4), _bk; with C6 rb_red, _b (C1), _k (C4), _bk; on a
               guarding target rb_bolt_home_red, or with C6 the red bolt without the knock; C3 sets guard.ignore; C5 sets
               rb.timed; C7 makes Susie's recharge 0.7 of the default.
     C6 red    Red Buster does not end on a hit. This file keeps one record per red bolt in flight and takes the bolt off
               the command's own re-target list (that list knows nothing of who was hit). After each enemy the bolt hits
               (each counted once) it gives the bolt the nearest enemy within 30 u (a screen) that this bolt has NOT hit:
               the bolt's homing motion turns to it. On its third enemy the bolt becomes rb_red_boom (the explosion: the
               bolt's own action is changed, as a wall or the floor does in the action data). With nobody left to chase
               nothing is set: the bolt arrives at its last enemy, its motion ends there, and it flies on straight to a
               wall (boom) or the end of its life. If its target dies in flight it gets the nearest enemy it has not hit.
               Each frame the bolt's target is read back and put right if something else changed it. A safety: nobody left
               to chase and the bolt still on its last enemy 0.5 s after hitting it (it is circling): it explodes there.
     C2 chain  a command's own bolt hits an enemy that is not guarding: 0.06 s later a smaller bolt (rb_chain) leaves the
               impact, 0.8 u toward the nearest enemy within 30 u that this chain has not hit and that is not guarding; when
               it lands, a second one (rb_chain2) does the same. One chain per command. Hop bolts start nothing else. Every
               enemy a chain has hit carries the tag dr_pt_chained until the chain is over: the hops' hits exclude it, so a
               hop flies through the enemy it leaves (and any other already hit) instead of ending on it. A hop is not
               tracked by the command: if a hop's target dies in flight, this file gives it the nearest enemy its chain has
               NOT hit, or lets it fly on.
     C6 + C2   a Red Buster's chain leaves 0.12 s after the bolt is over: from its explosion, or from the last enemy it hit
               when it just ended; every enemy the bolt or its explosion hit is already marked, so the hops go to the others.
     C5 timed  the Skill press is never taken. When a command's own bolt hits an enemy (not a guarding one) and a press
               fell 0.12 s before that hit, or comes within 0.15 s after it (battle time), rb_shock is launched where the
               bolt hit. One shock per bolt and per press. A hop's hit and the explosion are not such hits.
     C4 push   normal enemies are knocked by the bolt's own data. A boss that carries the stock "can't be knocked back"
               buff gets dr_pt_bossknock only while a push bolt flies (so the knock moves it at 0.4 x; the buff is taken
               off 0.3 s after the bolt hit it or ended); 0.3 s after the hit a boss that moved less than 1 u is slid the rest of the
               way to 1.2 u (collision-aware AddMove), but only if it was in a hit reaction 0.12 s after the hit (an
               invincible, grabbing or armoured boss is left alone), at most once per boss in 3 s, and never an enemy that
               opted out (its BaseID in the build's skipIds, or the tag dr_pt_nopush on it).
   All of it reads the hit from Kris's hit trigger (js/potentials.js onHit). Whether that trigger reports projectile hits
   at all is not known (PLAN.md R1). WHILE NO PROJECTILE HIT HAS BEEN REPORTED IN THIS BATTLE, places stand in: a bolt that
   went to its end action before its life ran out, within 1.6 u of an enemy, is taken to have hit that enemy; a red bolt
   in flight is taken to have hit an enemy whose centre is within its half box + 0.5 u. Once one report has come, a bolt
   without a report missed (a wall next to an enemy starts nothing).
   Known limits: the "already hit" tag is one tag for every chain (two chains alive at once could make the first chain's
   hop pass through an enemy the second has just hit). A red bolt that crosses an enemy again later than 0.4 s after
   hitting it damages it again (the data's hit record is that short, so the next command's bolt can hit); it is not
   counted twice. Read from the bolt's place (no reports), a re-target may come after the bolt has arrived: it then flies
   on straight through whoever stands on its line, as 0.3.2's bolt did.
   Log ("[DR-PARTY] POTS ...", while the hit log is on): red <n>/3 <enemy> -> <next> (<d> u); red <n>/3 <enemy>: no other
   enemy ...; red 3/3 <enemy>: it explodes; red boom at <x>,<y> after <n> enemies (<why>); red over at ...;
   timed shock at <x>,<y> (the press <ms> ms before | after the hit); chain 1/2 -> <enemy>; push armed on <enemy>;
   push <enemy> moved <d> u ...
   Test lines (drparty_test.txt): rbtest react 0|1 (log each bolt target's action 0.12 s after the hit);
   rbtest place <dx> [dy] (every enemy to that offset from Kris); rbtest chain (a chain from the nearest enemy, as if a
   bolt had just hit it); rbtest push (the boss push check on the nearest enemy, without a bolt or a hit reaction);
   rbtest timed <ms> (the next bolt hit gets a scripted press <ms> after it; off: rbtest timed off);
   rbtest boom / rbtest shock (the explosion / the shockwave on the nearest enemy, to look at them);
   rbtest route switch|launch (how the third-enemy explosion is made: see explode()).
   Names of js/command.js this file reads besides the agreed interface (each guarded): __bbDR.party.state.flying (the
   command's re-target list: a red bolt is taken off it).
   The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis, IsNull = CSharpDefine_1.IsNull;
  var DR = (G.__bbDR = G.__bbDR || {}), P = (DR.party = DR.party || {});
  P.potsGroups = P.potsGroups || [];
  for (var gi = 0; gi < P.potsGroups.length; gi++) if (P.potsGroups[gi] && P.potsGroups[gi].name === "rudebuster") return;
  var B = (G.__bbDRPotsCFG && G.__bbDRPotsCFG.rb) || {}, A0 = B.actions || {}, C0 = B.chain || {}, K0 = B.push || {}, R0 = B.red || {}, T0 = B.timed || {};
  function num(v, d) { return typeof v === "number" && !isNaN(v) ? v : d }
  var ACT = { big: A0.big || "rb_bolt_home_b", knock: A0.knock || "rb_bolt_home_k", bigKnock: A0.bigKnock || "rb_bolt_home_bk",
              red: A0.red || "rb_red", redBig: A0.redBig || "rb_red_b", redKnock: A0.redKnock || "rb_red_k", redBigKnock: A0.redBigKnock || "rb_red_bk",
              boom: A0.boom || "rb_red_boom", shock: A0.shock || "rb_shock", end: A0.end || "rb_bolt_end",
              chain: A0.chain && A0.chain.length ? A0.chain : ["rb_chain", "rb_chain2"] };
  var KNOCK = B.knock || [ACT.knock, ACT.bigKnock, ACT.redKnock, ACT.redBigKnock];
  var REDS = B.redBolts || [ACT.red, ACT.redBig, ACT.redKnock, ACT.redBigKnock];
  var CH = { hops: num(C0.hops, 2), range: num(C0.range, 30), delay: num(C0.delay, 0.06), offset: num(C0.offset, 0.8),
             reach: num(C0.reach, 1.6), life: num(C0.life, 2), flight: num(C0.flight, 1.5), tag: C0.tag || "dr_pt_chained" };
  var RD = { max: num(R0.max, 3), range: num(R0.range, 30), life: num(R0.life, 3), reach: num(R0.reach, 1.375), boomR: num(R0.boomR, 3),
             chainAfter: num(R0.chainAfter, 0.12), reaim: num(R0.reaim, 5), circle: num(R0.circle, 0.5) };
  var TM = { action: T0.action || ACT.shock, before: num(T0.before, 0.12), after: num(T0.after, 0.15) };
  var QUICK = num(B.quick, 0.7);
  var PU = { buff: K0.buff || "dr_pt_bossknock", hard: K0.hard || ["3029"], soft: K0.soft || ["3021_move"], tag: K0.tag || "Boss",
             k: num(K0.k, 0.4), arm: num(K0.arm, 1.8), armPierce: num(K0.armPierce, 3.3), grace: num(K0.grace, 0.3),
             check: num(K0.check, 0.3), min: num(K0.min, 1), total: num(K0.total, 1.2), slide: num(K0.slide, 0.15),
             react: num(K0.react, 0.12), cd: num(K0.cd, 3), skipIds: K0.skipIds || [], skipTag: K0.skipTag || "dr_pt_nopush",
             report: num(K0.report, 0.8) };
  var REACT = /behit|push_|knock|hit_|fall|down|float|stun/i;
  try { if (K0.reactRx) REACT = new RegExp(K0.reactRx, "i") } catch (e0) {}
  var S = { chains: [], links: [], told: [], watches: [], slides: [], reds: [], redsOver: [], armed: [], impacts: [], shocked: [], left: [], tags: {}, tagged: 0,
            kinds: {}, seq: 0, redSeq: 0, react: false, route: R0.route === "launch" ? "launch" : "switch", auto: null, pressUsed: null,
            reports: 0, fallbacks: 0, hops: 0, slid: 0, pierced: 0, booms: 0, shocks: 0, reaims: 0, errs: {} };
  P.potsRudeBuster = S;

  // ---------------------------------------------------------------- basics
  function uid(a) { try { return a.UniqueId } catch (e) { return undefined } }
  function same(a, b) {                              // one actor: the same object, or the same (real) id
    if (!a || !b) return false;
    if (a === b) return true;
    var x = uid(a);
    return typeof x === "number" && x !== 0 && x === uid(b);
  }
  function gone(a) { try { return !a || IsNull(a) || !!a.IsDead } catch (e) { return true } }
  function actionOf(a) { try { return String(a.ActionMgr.CurrentActionName || "") } catch (e) { return "" } }
  function among(L, n) { for (var i = 0; i < L.length; i++) if (L[i] === n) return true; return false }
  function once(api, key, s) { if (!S.errs[key]) { S.errs[key] = 1; api.log(s) } }
  function verbose() { return !P.potsState || P.potsState.hitlog !== false }
  function say(api, s) { if (verbose()) api.log(s) }
  function at(x, y) { return (+x).toFixed(2) + "," + (+y).toFixed(2) }
  function ms(s) { return Math.round(s * 1000) }
  function where(b, d) { try { var x = b.Position.x, y = b.Position.y; if (isFinite(x) && isFinite(y)) return { x: x, y: y } } catch (e) {} return d }
  function facing(b) { var d = 0; try { d = +b.Dir } catch (e) {} return d < 0 ? -1 : 1 }
  // Is what a bolt hit a real enemy? The hit trigger also reports pots, traps and other objects of another faction. The
  // rule is the core's (api.isEnemy; the hit's own h.enemy): a kind the command's list has held in this room is an
  // enemy, also one this very hit killed; any other kind is an object, and nothing starts on it here (no chain, no
  // count, no shock, no push watch). A pot the hit destroyed is no enemy either. Said once per kind.
  function real(a, api) {
    if (api.isEnemy(a)) return true;
    var id; try { id = a.BaseID } catch (e) { return false }
    if (!S.kinds[id]) { S.kinds[id] = 1; say(api, "a bolt hit " + api.tag(a) + ": not an enemy (an object or a trap), nothing starts on its kind") }
    return false;
  }
  // has the hit trigger reported no projectile hit yet in this battle? Only then may a place stand in for a hit
  function noReports(api) {
    var r = typeof api.reports === "function" ? api.reports() : null;
    return !r || !(r.shot > 0);
  }

  // ---------------------------------------------------------------- C2: the chain
  function chainOf(b) { if (b) for (var i = 0; i < S.chains.length; i++) if (same(S.chains[i].src, b)) return S.chains[i]; return null }
  function linkOf(b) { if (b) for (var i = 0; i < S.links.length; i++) if (same(S.links[i].b, b)) return S.links[i]; return null }
  function centre(a, api) { var q = api.pos(a); return { x: q.x, y: q.cy } }
  // An enemy a chain has hit carries the tag its hops' hits exclude (HitData.ExcludeTags, kp_rudebuster.py), so a hop
  // passes through it and lands on an enemy the chain has not hit: enemies stand in clumps, and a hop starts inside the
  // enemy it leaves. c.hit: 1 = a hop is on its way to it, 2 = hit (tagged). The tag goes when the chain is over.
  function mark(c, a, api) {
    var k = api.tag(a);
    if (c.hit[k] === 2) return;
    c.hit[k] = 2;
    if (S.tags[k]) { S.tags[k].n++; return }
    try { a.TagMgr.AppendTag(CH.tag); S.tags[k] = { a: a, n: 1, t: api.now() }; S.tagged++ }
    catch (e) { once(api, "tag", "chain: an enemy can't be tagged as hit (a hop may land on it again)") }
  }
  function untag(k) {
    var t = S.tags[k]; if (!t) return;
    delete S.tags[k]; S.tagged--;
    try { if (!gone(t.a)) t.a.TagMgr.RemoveTag(CH.tag) } catch (e) {}
  }
  function sweepTags(api) {                          // no enemy keeps the tag past a chain's longest life
    var now = api.now();
    for (var k in S.tags) if (now - S.tags[k].t > 2 * CH.life) untag(k);
  }
  function finish(c) {
    if (c.over) return;
    c.over = true;
    for (var k in c.hit) if (c.hit[k] === 2 && S.tags[k] && --S.tags[k].n <= 0) untag(k);
  }
  function startChain(bullet, target, api, from) {          // from: where the hop leaves when there is no target to read (it died)
    var c = chainOf(bullet);
    if (c) { if (target && !c.over) mark(c, target, api); return c }   // the same bolt again: one chain per command
    c = { id: ++S.seq, src: bullet, hit: {}, n: 0, t: api.now(), over: false, first: target ? api.tag(target) : null };
    if (target) mark(c, target, api);
    S.chains.push(c);
    var from0 = target ? centre(target, api) : from;
    api.after(CH.delay, function () { hop(c, from0, api) });
    return c;
  }
  function justChained(a, api) {                     // a chain began on this enemy within the last half second (never two for one hit)
    var k = api.tag(a), t = api.now();
    for (var i = 0; i < S.chains.length; i++) if (S.chains[i].first === k && t - S.chains[i].t < 0.5) return true;
    return false;
  }
  function free(c, api) { return function (a) { return !c.hit[api.tag(a)] && !gone(a) && !api.guarded(a) } }   // a hop may go there
  function hop(c, from, api) {
    if (c.n >= CH.hops) { finish(c); say(api, "chain " + c.id + " done: " + c.n + " hops"); return }
    var L = api.chase(from.x, from.y, CH.range, free(c, api));       // anywhere on screen (and within CH.range off it)
    if (!L.length) { finish(c); say(api, "chain " + c.id + " ends after " + c.n + " of " + CH.hops + " hops: no other enemy on screen or within " + CH.range + " u"); return }
    var q = L[0], dx = q.x - from.x, dy = q.y - from.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) { dx = 1; dy = 0; d = 1 }
    var off = Math.min(CH.offset, d * 0.5), sx = from.x + dx / d * off, sy = from.y + dy / d * off;
    var name = ACT.chain[Math.min(c.n, ACT.chain.length - 1)];
    // not tracked by the command: its re-targeting takes the nearest enemy, which may be one this chain has hit (the
    // hop's hit skips those); watchLinks below re-targets it among the enemies the chain has not hit
    var b = api.launch(name, sx, sy, dx / d, dy / d, q.a, null);
    if (!b) { finish(c); api.log("chain " + (c.n + 1) + "/" + CH.hops + " not launched"); return }
    c.n++; c.hit[api.tag(q.a)] = 1; S.hops++;
    S.links.push({ b: b, tgt: q.a, c: c, hop: c.n, name: name, age: 0, x: sx, y: sy, seen: false, frames: 0, done: false, lost: false });
    say(api, "chain " + c.n + "/" + CH.hops + " -> " + api.tag(q.a) + " (" + d.toFixed(1) + " u, " + name + ")");
  }
  function landed(lk, target, api, reported, from) {
    if (lk.done) return;
    lk.done = true;
    var c = lk.c, from0 = target ? centre(target, api) : from;
    if (target) mark(c, target, api);
    if (!reported) { S.fallbacks++; say(api, "chain " + lk.hop + "/" + CH.hops + " landed on " + (target ? api.tag(target) : "its target (gone)") + " (no hit report: read from where it ended)") }
    api.after(CH.delay, function () { hop(c, from0 || { x: lk.x, y: lk.y }, api) });
  }
  function victimAt(x, y, api, c) {                  // whoever stands there (for a hop: not an enemy its chain has hit, it can't hit those)
    var L = api.near(x, y, CH.reach, c ? function (a) { return c.hit[api.tag(a)] !== 2 } : null);
    return L.length ? L[0].a : null;
  }
  function retargetLink(lk, api) {                   // the hop's target died in flight: the nearest enemy its chain has not hit
    var L = api.chase(lk.x, lk.y, CH.range, free(lk.c, api));
    if (!L.length) { lk.lost = true; return }        // nobody: it flies on straight (the motion ends without a target)
    if (!api.setTarget(lk.b, L[0].a)) { lk.lost = true; return }
    lk.tgt = L[0].a; lk.c.hit[api.tag(L[0].a)] = 1;
    say(api, "chain " + lk.hop + "/" + CH.hops + " re-targets " + api.tag(L[0].a));
  }
  function watchLinks(bdt, api) {
    for (var i = S.links.length - 1; i >= 0; i--) {
      var lk = S.links[i], live = false, name = "";
      try { live = !IsNull(lk.b) && !lk.b.IsDead; if (live) name = actionOf(lk.b) } catch (e) { live = false }
      lk.age += bdt;
      if (live && name === lk.name) {
        lk.seen = true; try { lk.x = lk.b.Position.x; lk.y = lk.b.Position.y } catch (e2) {}
        if (lk.age < CH.life) { if (!lk.done && !lk.lost && gone(lk.tgt)) retargetLink(lk, api); continue }
      }
      else if (live && !lk.seen && lk.frames++ < 3) continue;       // just created: its action may only show next frame
      S.links.splice(i, 1);
      if (lk.done) continue;                                        // its hit was reported
      // no report. While the trigger has reported no projectile hit at all: it hit whoever stands where it ended (before
      // its life ran out); nobody there and its target gone: it killed it. Otherwise it missed
      var read = noReports(api), early = lk.age < CH.flight - 0.05, v = read && early ? victimAt(lk.x, lk.y, api, lk.c) : null;
      if (read && (v || (early && gone(lk.tgt)))) landed(lk, v, api, false, { x: lk.x, y: lk.y });
      else { lk.done = true; finish(lk.c); say(api, "chain " + lk.hop + "/" + CH.hops + " missed (ended at " + at(lk.x, lk.y) + ")") }
    }
  }

  // ---------------------------------------------------------------- C6: Red Buster (pierces 3, chases, explodes)
  // One record per red bolt in flight: r.hit / r.v = the enemies it has hit (each counted once), r.tgt = the enemy this
  // file last gave it, r.bv = the enemies its explosion hit. A record that is over stays 2 s in S.redsOver (the
  // explosion's hits are reported after the bolt changed).
  function redOf(b) { if (b) for (var i = 0; i < S.reds.length; i++) if (same(S.reds[i].b, b)) return S.reds[i]; return null }
  function redAny(b) {                               // ... or one that is over, or whose launched explosion this is
    if (!b) return null;
    var i;
    for (i = S.reds.length - 1; i >= 0; i--) if (same(S.reds[i].b, b) || same(S.reds[i].boomB, b)) return S.reds[i];
    for (i = S.redsOver.length - 1; i >= 0; i--) if (same(S.redsOver[i].b, b) || same(S.redsOver[i].boomB, b)) return S.redsOver[i];
    return null;
  }
  // the command re-targets a tracked bolt whose target died at the nearest enemy, hit or not: a red bolt is steered
  // here, so it comes off that list (as the chain's hops are launched untracked)
  function unlist(b, api) {
    try {
      var F = P.state && P.state.flying;
      if (!F || typeof F.length !== "number") { once(api, "flying", "red: js/command.js publishes no state.flying (the bolt's aim is put back each frame instead)"); return false }
      for (var i = F.length - 1; i >= 0; i--) if (F[i] && F[i].b === b) { F.splice(i, 1); return true }
    } catch (e) {}
    return false;
  }
  function redNew(b, tgt, action, api) {
    var i;
    for (i = S.reds.length - 1; i >= 0; i--) if (same(S.reds[i].b, b)) S.reds.splice(i, 1);          // the pool handed the object back
    for (i = S.redsOver.length - 1; i >= 0; i--) if (same(S.redsOver[i].b, b)) S.redsOver.splice(i, 1);
    var q = where(b, { x: 0, y: 0 });
    var r = { id: ++S.redSeq, b: b, action: action, hit: {}, v: [], bhit: {}, bv: [], tgt: tgt || null, free: false, last: null, lx: q.x, ly: q.y,
              lastT: 0, x: q.x, y: q.y, age: 0, frames: 0, seen: false, boom: false, why: "", exploded: 0, launched: false, boomB: null, over: false,
              end: "", chain: null, reaims: 0, unlisted: false };
    r.unlisted = unlist(b, api);
    S.reds.push(r);
    return r;
  }
  function setAim(r, a, api) {
    var tm = null;
    try { tm = r.b.TargetMgr } catch (e) {}
    if (!tm || typeof tm.SetTarget !== "function") { once(api, "aim", "red: this bolt has no target to set (it flies as it is)"); r.tgt = null; return false }
    try { tm.SetTarget(a) } catch (e2) { once(api, "aim2", "red: the bolt's target was not set (" + e2 + ")"); r.tgt = null; return false }
    r.tgt = a; r.reaims = 0;
    return true;
  }
  // the nearest enemy this bolt has not hit, anywhere on screen (the lead: "after it hits one enemy it chases the next
  // from anywhere on screen"; api.chase: on screen however far, or within RD.range of the bolt when off it)
  function aim(r, api, what) {
    var p = where(r.b, { x: r.x, y: r.y });
    var L = api.chase(p.x, p.y, RD.range, function (a) { return !r.hit[api.tag(a)] && !gone(a) });
    var head = "red " + r.v.length + "/" + RD.max + " " + what;
    if (!L.length) { r.tgt = null; r.free = true; say(api, head + ": no other enemy on screen or within " + RD.range + " u, it flies on"); return false }
    if (!setAim(r, L[0].a, api)) return false;
    say(api, head + " -> " + api.tag(L[0].a) + " (" + L[0].d.toFixed(1) + " u)");
    return true;
  }
  // the bolt hit `target`. -> false when this bolt had hit it already (not counted)
  function redHit(r, target, api, reported) {
    var k = api.tag(target), t = api.now();
    if (r.hit[k] !== undefined) {
      // (the same hit told twice, by the trigger and by the bolt's place, is silent)
      if (t - r.hit[k] > 0.5) { r.hit[k] = t; say(api, "red crossed " + k + " again (not counted)") }
      return false;
    }
    var q = centre(target, api);
    r.hit[k] = t; r.v.push({ k: k, a: target }); r.last = target; r.lastT = t; r.lx = q.x; r.ly = q.y; S.pierced++;
    if (r.boom) return true;                         // it is exploding already (a hit in the frame before the bolt changed)
    if (r.v.length >= RD.max) {
      r.boom = true; r.why = RD.max + " enemies";
      say(api, "red " + r.v.length + "/" + RD.max + " " + k + ": it explodes" + (reported ? "" : " (no hit report: read from the bolt's place)"));
      return true;
    }
    aim(r, api, k);
    return true;
  }
  // everything a red bolt's hit starts (the count and the chase; on a target that is not guarding: the push watch, the
  // timed press's impact)
  function struck(r, target, api, reported, guarded) {
    if (!redHit(r, target, api, reported)) return;
    if (guarded) return;
    if (among(KNOCK, r.action)) { watch(target, pushDir(r.b, target, api), api); if (reported) disarm(r.b, api, target) }
    impact(r.b, target, api);
  }
  // The explosion on its third enemy. Route "switch" (active): the bolt itself becomes rb_red_boom
  // (ActionMgr.ChangeAction, the call js/command.js drives the followers with): what a wall does in the action data, and
  // the explosion stays booked to the command's Skill row. Route "launch" (the plan's text; the fallback when
  // ChangeAction throws or does not take within 3 frames, or forced with `rbtest route launch`): a new rb_red_boom is
  // launched at the bolt and the bolt is sent to its end action.
  function launchBoom(r, api) {
    r.launched = true;
    r.boomB = api.launch(ACT.boom, r.x, r.y, facing(r.b), 0, null, null);
    try { r.b.ActionMgr.ChangeAction(ACT.end) } catch (e) {}
    say(api, "red boom at " + at(r.x, r.y) + " after " + r.v.length + " enemies (" + r.why + "; launched" + (r.boomB ? "" : ": FAILED") + ")");
  }
  function explode(r, api) {
    r.exploded = 1; S.booms++;
    if (S.route === "switch") {
      var am = null;
      try { am = r.b.ActionMgr } catch (e0) {}
      if (am && typeof am.ChangeAction === "function") {
        try {
          am.ChangeAction(ACT.boom);
          say(api, "red boom at " + at(r.x, r.y) + " after " + r.v.length + " enemies (" + r.why + ")");
          return;
        } catch (e) { once(api, "switch", "red: the bolt cannot be turned into " + ACT.boom + " (" + e + "): it is launched instead") }
      }
      else once(api, "switch0", "red: this bolt's action cannot be changed: " + ACT.boom + " is launched instead");
    }
    launchBoom(r, api);
  }
  function keepAim(r, api) {
    if (r.v.length >= RD.max || r.free) return;
    if (r.tgt && gone(r.tgt)) { r.tgt = null; aim(r, api, "its target is gone"); return }
    if (!r.tgt || r.reaims >= RD.reaim) return;
    var cur;
    try { cur = r.b.TargetMgr.GetDefaultTarget() } catch (e) { return }      // it cannot be read: the aim stands as set
    if (cur === undefined || same(cur, r.tgt)) return;
    try { r.b.TargetMgr.SetTarget(r.tgt) } catch (e2) { return }
    S.reaims++;
    if (++r.reaims === 1) say(api, "red: its target was changed, put back on " + api.tag(r.tgt));
  }
  // A safety, not the plan: with nobody left to chase the bolt should arrive at its last enemy, lose its motion and fly
  // on. If it is still on that enemy RD.circle after hitting it, its motion did not end (it is circling, and would hit
  // that enemy again every 0.4 s for the rest of its life): it explodes there instead.
  function circling(r, api) {
    if (!r.free || !r.last || gone(r.last) || api.now() - r.lastT < RD.circle) return;
    var q = centre(r.last, api), dx = q.x - r.x, dy = q.y - r.y;
    if (dx * dx + dy * dy > RD.reach * RD.reach) return;
    r.boom = true; r.why = "nobody left to chase and it stayed on its last enemy";
    say(api, "red " + r.v.length + "/" + RD.max + ": still on " + api.tag(r.last) + " " + ms(api.now() - r.lastT) + " ms after hitting it: it explodes");
  }
  function feel(r, api) {                            // no hit reports at all: an enemy within the bolt's reach is taken as hit
    var L = api.near(r.x, r.y, RD.reach, function (a) { return r.hit[api.tag(a)] === undefined && !gone(a) });
    if (!L.length) return;
    S.fallbacks++;
    say(api, "no hit report for " + r.action + ": it is on " + api.tag(L[0].a) + ", taken as its hit");
    struck(r, L[0].a, api, false, api.guarded(L[0].a));
  }
  function redChain(r, api) {                        // C2: once the bolt is over, from its explosion or its last enemy
    if (r.chain || !r.v.length || !api.has("C2")) return;
    var boomed = r.end === ACT.boom || r.launched, last = !boomed && !gone(r.last) ? r.last : null, i;
    var c = startChain(null, last, api, boomed ? { x: r.x, y: r.y } : { x: r.lx, y: r.ly });
    for (i = 0; i < r.v.length; i++) if (!gone(r.v[i].a)) mark(c, r.v[i].a, api);
    for (i = 0; i < r.bv.length; i++) if (!gone(r.bv[i].a)) mark(c, r.bv[i].a, api);
    if (boomed && noReports(api)) {                  // the explosion's hits were not reported: whoever stands in it
      var L = api.near(r.x, r.y, RD.boomR);
      for (i = 0; i < L.length; i++) mark(c, L[i].a, api);
    }
    r.chain = c;
  }
  function redEnd(r, end, api) {                     // the bolt is no longer a flying red bolt
    r.over = true; r.end = end; r.t1 = api.now();
    var boomed = end === ACT.boom || r.launched;
    if (boomed && !r.exploded) { S.booms++; r.why = "a wall or the floor"; say(api, "red boom at " + at(r.x, r.y) + " after " + r.v.length + " enemies (" + r.why + ")") }
    else if (!boomed) say(api, "red over at " + at(r.x, r.y) + " after " + r.v.length + " enemies (" + (end === ACT.end ? "its life ran out" : end) + ")");
    untell(r.b); disarm(r.b, api);
    S.redsOver.push(r);
    if (r.v.length && api.has("C2")) api.after(RD.chainAfter, function () { redChain(r, api) });
  }
  function watchReds(bdt, api) {
    for (var i = S.reds.length - 1; i >= 0; i--) {
      var r = S.reds[i], live = !gone(r.b), name = live ? actionOf(r.b) : "";
      r.age += bdt;
      if (live && name === r.action) {
        r.seen = true;
        var q = where(r.b, null); if (q) { r.x = q.x; r.y = q.y }
        if (r.boom) {
          if (!r.exploded) explode(r, api);
          else if (!r.launched && ++r.exploded > 4) { once(api, "took", "red: ChangeAction did not turn the bolt into " + ACT.boom + ": it is launched instead"); launchBoom(r, api) }
        } else {
          if (noReports(api)) feel(r, api);
          if (!r.boom) keepAim(r, api);
          if (!r.boom) circling(r, api);
        }
        if (r.age < RD.life + 1) continue;
      }
      else if (live && !r.seen && r.frames++ < 3) continue;         // just created: its action may only show next frame
      S.reds.splice(i, 1);
      redEnd(r, live ? name : "gone", api);
    }
  }
  function boomHit(h, api) {                         // the explosion's own hits: they start nothing; a later chain skips them
    var r = redAny(h.attacker);
    if (!r) return;
    var k = api.tag(h.target);
    if (r.bhit[k]) return;
    r.bhit[k] = 1; r.bv.push({ k: k, a: h.target });
    if (r.chain && !r.chain.over && r.chain.hit[k] !== 1) mark(r.chain, h.target, api);
  }

  // ---------------------------------------------------------------- C5: the timed press
  // An "impact" is a command's own bolt hitting an enemy that is not guarding. The press may fall TM.before earlier
  // (then the shock leaves at the hit) or TM.after later (then at the press). One shock per bolt, one per press. A press
  // made before the bolt had left (the very press that commanded it, on an enemy at arm's length) is no timed press.
  function shocked(b) { for (var i = 0; i < S.shocked.length; i++) if (same(S.shocked[i].b, b)) return true; return false }
  function forget(b) {
    var i;
    for (i = S.shocked.length - 1; i >= 0; i--) if (same(S.shocked[i].b, b)) S.shocked.splice(i, 1);
    for (i = S.left.length - 1; i >= 0; i--) if (same(S.left[i].b, b)) S.left.splice(i, 1);
  }
  function leftAt(b) { for (var i = S.left.length - 1; i >= 0; i--) if (same(S.left[i].b, b)) return S.left[i].t; return null }
  function shock(rec, api, dt, before) {
    rec.done = true; S.pressUsed = api.press.bt; S.shocked.push({ b: rec.b, t: api.now() }); S.shocks++;
    var b = api.launch(TM.action, rec.x, rec.y, facing(rec.b), 0, null, null);
    say(api, "timed shock at " + at(rec.x, rec.y) + " (the press " + ms(dt) + " ms " + (before ? "before" : "after") + " the hit)" + (b ? "" : ": NOT launched"));
  }
  function impact(bolt, target, api) {
    if (!api.has("C5")) return;
    var t = api.now(), q = centre(target, api);
    if (S.auto !== null) {                           // rbtest timed <ms>: a scripted press that long after this hit
      var wait = S.auto; S.auto = null;
      api.after(wait, function () { api.press.bt = api.now(); pressed(api) });
    }
    if (shocked(bolt)) return;
    var pt = api.press.bt, t0 = leftAt(bolt), ago = t0 !== null && pt < t0 ? 1e9 : t - pt, rec = { t: t, x: q.x, y: q.y, b: bolt, done: false };
    if (ago >= 0 && ago <= TM.before && pt !== S.pressUsed) { shock(rec, api, ago, true); return }
    if (ago >= 0 && ago < 1) say(api, "timed: the bolt hit " + ms(ago) + " ms after the press (at most " + ms(TM.before) + " ms): no shock yet");
    S.impacts.push(rec);
  }
  function pressed(api) {                            // the Skill press edge (the core has recorded its time: api.press)
    if (!api.has("C5")) return;
    var t = api.now(), best = null, late = null;
    for (var i = 0; i < S.impacts.length; i++) {
      var q = S.impacts[i];
      if (q.done || shocked(q.b)) continue;
      if (t - q.t <= TM.after) { if (!best || q.t > best.t) best = q }
      else if (!late || q.t > late.t) late = q;
    }
    if (best) shock(best, api, t - best.t, false);
    else if (late && t - late.t < 1) say(api, "timed: the press came " + ms(t - late.t) + " ms after the hit (at most " + ms(TM.after) + " ms): no shock");
  }
  function pruneTimed(api) {
    var t = api.now(), i;
    for (i = S.impacts.length - 1; i >= 0; i--) if (S.impacts[i].done || t - S.impacts[i].t > 1.2) S.impacts.splice(i, 1);
    for (i = S.shocked.length - 1; i >= 0; i--) if (t - S.shocked[i].t > 5) S.shocked.splice(i, 1);
    for (i = S.left.length - 1; i >= 0; i--) if (t - S.left[i].t > 5) S.left.splice(i, 1);
    for (i = S.redsOver.length - 1; i >= 0; i--) if (t - S.redsOver[i].t1 > 2) S.redsOver.splice(i, 1);
  }

  // ---------------------------------------------------------------- C4: the push
  function hasAny(a, L, api) { for (var i = 0; i < L.length; i++) if (api.hasBuff(a, L[i])) return L[i]; return null }
  function isBoss(a, api) { return api.isBoss(a) || api.hasTag(a, PU.tag) }      // the core's boss tags (Boss, boss, EliteBoss, FinalBoss)
  function heavy(a, api) { return isBoss(a, api) || !!hasAny(a, PU.hard, api) || !!hasAny(a, PU.soft, api) }
  function optedOut(a, api) {                                       // set pieces, a boss made of anchored parts
    if (api.hasTag(a, PU.skipTag)) return true;
    var id; try { id = +a.BaseID } catch (e) { return false }
    for (var i = 0; i < PU.skipIds.length; i++) if (+PU.skipIds[i] === id) return true;
    return false;
  }
  function armedStill(a) { for (var i = 0; i < S.armed.length; i++) if (S.armed[i].a === a) return true; return false }
  function arm(a, api, bullet, dur) {                               // the knock can move an enemy that resists it outright
    if (optedOut(a, api)) return false;
    var r = hasAny(a, PU.hard, api);
    if (!r || !api.addBuff(a, PU.buff, dur, PU.k, 1, api.player())) return false;
    S.armed.push({ a: a, key: bullet || null, t: api.now(), dur: dur });
    say(api, "push armed on " + api.tag(a) + " (it carries " + r + ": knock-back +" + PU.k + " while the bolt flies, " + dur + " s at most)");
    return true;
  }
  function disarm(bullet, api, only) {                              // the bolt is over (or has hit `only`): the offset goes shortly after
    if (!bullet) return;
    for (var i = S.armed.length - 1; i >= 0; i--) {
      var q = S.armed[i];
      if (!same(q.key, bullet) || (only && q.a !== only)) continue;
      S.armed.splice(i, 1);
      (function (a) { api.after(PU.grace, function () { if (!gone(a) && !armedStill(a)) api.removeBuff(a, PU.buff) }) })(q.a);
    }
  }
  function pruneArmed(api) {                                        // (a bolt whose end nobody saw: the buff ran out by itself)
    var t = api.now();
    for (var i = S.armed.length - 1; i >= 0; i--) if (t - S.armed[i].t > S.armed[i].dur + 0.5) S.armed.splice(i, 1);
  }
  function pushDir(bullet, target, api) {                           // the data knock goes by the bolt's facing
    var d = 0; try { d = +bullet.Dir } catch (e) {}
    if (d > 0) return 1;
    if (d < 0) return -1;
    try { return api.pos(target).x >= api.pos(api.player()).x ? 1 : -1 } catch (e2) { return 1 }
  }
  function watch(a, dir, api, forced) {
    var tg = api.tag(a);
    for (var i = S.watches.length - 1; i >= 0; i--) if (S.watches[i].tag === tg) S.watches.splice(i, 1);
    S.watches.push({ a: a, tag: tg, x0: api.pos(a).x, dir: dir || 1, t: 0, heavy: heavy(a, api), checked: false, slid: 0,
                     forced: !!forced, seen: false, react: false, act: "", why: "" });
  }
  function move(a, dx, api) {                                       // collision-aware (the core's api.move: ActorPosition.AddMove)
    if (api.move(a, dx, 0)) return true;
    once(api, "move", "push: the slide failed"); return false;
  }
  function watchPushes(bdt, api) {
    var i;
    for (i = S.slides.length - 1; i >= 0; i--) {
      var s = S.slides[i];
      if (gone(s.a)) { S.slides.splice(i, 1); continue }
      if (bdt <= 0) continue;
      var step = Math.min(s.left, s.rate * bdt);
      if (!move(s.a, s.dir * step, api)) { S.slides.splice(i, 1); continue }
      s.left -= step;
      if (s.left <= 1e-4) S.slides.splice(i, 1);
    }
    for (i = S.watches.length - 1; i >= 0; i--) {
      var w = S.watches[i]; w.t += bdt;
      if (gone(w.a)) { S.watches.splice(i, 1); continue }
      var moved = (api.pos(w.a).x - w.x0) * w.dir;
      if (!w.seen && w.t >= PU.react) { w.seen = true; w.act = actionOf(w.a); w.react = w.forced || REACT.test(w.act) }
      if (w.heavy && !w.checked && w.t >= PU.check) {
        w.checked = true;
        if (moved < PU.min) {
          // the script moves a boss only when the hit visibly landed on it, not too often, and never one that opted out
          if (optedOut(w.a, api)) w.why = "it opted out";
          else if (!w.react) w.why = "no hit reaction (" + (w.act || "?") + ")";
          else if (!api.cd("push " + w.tag, PU.cd)) w.why = "slid within the last " + PU.cd + " s";
          else { w.slid = PU.total - Math.max(0, moved); S.slides.push({ a: w.a, dir: w.dir, left: w.slid, rate: PU.total / PU.slide }); S.slid++ }
        }
      }
      if (w.t >= PU.report) {
        S.watches.splice(i, 1);
        say(api, "push " + w.tag + " moved " + moved.toFixed(2) + " u" + (w.heavy ? " (boss: " +
            (w.slid ? w.slid.toFixed(2) + " u of it by the script" : w.why ? "not slid: " + w.why : "by the knock") + ")" : ""));
      }
    }
  }

  // ---------------------------------------------------------------- which bolts' hits were reported by the trigger
  function tell(b, api) { if (b && !told(b)) S.told.push({ b: b, t: api.now() }) }
  function told(b) { for (var i = 0; i < S.told.length; i++) if (same(S.told[i].b, b)) return true; return false }
  function untell(b) { for (var i = S.told.length - 1; i >= 0; i--) if (same(S.told[i].b, b)) { S.told.splice(i, 1); return true } return false }
  function prune(api) {
    var t = api.now(), i;
    for (i = S.told.length - 1; i >= 0; i--) if (t - S.told[i].t > 6) S.told.splice(i, 1);
    for (i = S.chains.length - 1; i >= 0; i--) if (t - S.chains[i].t > 8) { finish(S.chains[i]); S.chains.splice(i, 1) }
  }
  function react(target, api) {                                     // dev: what the target does right after the hit (armour broken?)
    var tg = api.tag(target);
    api.after(0.12, function () { api.log("react " + tg + " " + (gone(target) ? "gone" : actionOf(target) || "?")) });
  }
  function nearest(api) {
    var p = api.player(); if (!p) return null;
    var q = api.pos(p), L = api.near(q.x, q.cy, 60);
    return L.length ? L[0].a : null;
  }
  function reset() {
    for (var k in S.tags) untag(k);
    S.chains = []; S.links = []; S.told = []; S.watches = []; S.slides = []; S.reds = []; S.redsOver = []; S.armed = []; S.impacts = []; S.shocked = []; S.left = [];
    S.auto = null; S.pressUsed = null; S.kinds = {};
  }

  P.potsGroups.push({
    name: "rudebuster", cards: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"],
    mods: function (m, has, api) {
      var big = has("C1"), knock = has("C4");
      if (has("C6")) {
        m.rb.action = big ? (knock ? ACT.redBigKnock : ACT.redBig) : (knock ? ACT.redKnock : ACT.red);
        m.rb.guardAction = big ? ACT.redBig : ACT.red;              // a guarding target: the red bolt without the knock
        m.rb.steered = REDS;                         // bolts this file steers (for a command that leaves them off its own
      }                                              // re-target list; today's command does not read it: unlist() does it)
      else if (big || knock) m.rb.action = big && knock ? ACT.bigKnock : big ? ACT.big : ACT.knock;
      if (has("C3")) m.guard.ignore = true;
      if (has("C5")) m.rb.timed = true;
      // C7: Susie's recharge x QUICK. Scaled, as the core asks of what several cards may share (another card's change
      // to the same recharge then counts too); this group is the only one that answers C7
      if (has("C7")) m.recharge.susie *= QUICK;
    },
    onFire: function (f, api) {
      if (f.who !== "susie") return;
      if (f.tgt) real(f.tgt, api);                   // (every kind on the command's list now is known as an enemy from here on)
      forget(f.bullet);                              // (projectiles are pooled: this object is a new bolt now)
      if (api.has("C5")) S.left.push({ b: f.bullet, t: api.now() });
      var red = among(REDS, f.action);
      if (red) redNew(f.bullet, f.tgt, f.action, api);
      if (!among(KNOCK, f.action)) return;
      var L = red ? api.enemies() : (f.tgt ? [f.tgt] : []);
      for (var i = 0; i < L.length; i++) arm(L[i], api, f.bullet, red ? PU.armPierce : PU.arm);
    },
    onHit: function (h, api) {
      if (h.kris) return;
      var lk = linkOf(h.attacker), enemy = real(h.target, api);
      if (lk) {                                      // (a hop that ended on an object: the chain goes on from there)
        S.reports++; if (S.react) react(h.target, api);
        landed(lk, enemy ? h.target : null, api, true, where(h.attacker, { x: lk.x, y: lk.y }));
        return;
      }
      if (!enemy) return;
      if (h.action === ACT.boom) { boomHit(h, api); return }        // (its name reads as a primary bolt's: it is none)
      if (!h.primary) return;
      S.reports++; tell(h.attacker, api);
      if (S.react) react(h.target, api);
      if (among(REDS, h.action)) {                   // counted and steered whoever it hit; its chain starts when it is over
        struck(redOf(h.attacker) || redNew(h.attacker, null, h.action, api), h.target, api, true, h.guarded);
        return;
      }
      if (h.guarded) return;                         // a guarding target takes the plain bolt: no added properties
      if (among(KNOCK, h.action)) { watch(h.target, pushDir(h.attacker, h.target, api), api); disarm(h.attacker, api, h.target) }
      impact(h.attacker, h.target, api);
      if (api.has("C2") && h.src.chain) startChain(h.attacker, h.target, api, null);
    },
    onImpact: function (f, api) {
      // the bolt is over. Projectiles are pooled: the next bolt may be this very object, so nothing keeps pointing at
      // one that ended
      var reported = untell(f.bullet), c0 = chainOf(f.bullet);
      if (c0) c0.src = null;
      if (f.who !== "susie" || !api.matches("primary", f.action)) return;
      if (among(REDS, f.action)) return;             // a Red Buster: its own record sees it end (watchReds)
      disarm(f.bullet, api);
      // what follows is the fallback for a hit the trigger did not report: only while it has reported no projectile hit
      // at all in this battle. Once it has, a bolt without a report missed
      if (reported || !noReports(api)) return;
      if (f.end !== ACT.end) return;
      if (f.age >= CH.flight - 0.05) return;         // its life ran out: it hit nobody
      var v = victimAt(f.x, f.y, api, null);         // it hit whoever stands where it ended
      if (!v && !gone(f.tgt)) return;                // nobody there and its target lives: a wall, or the end of its life
      if (v && api.guarded(v)) return;
      var knock = !!v && among(KNOCK, f.action), chain = api.has("C2"), timed = !!v && api.has("C5");
      if (!knock && !chain && !timed) return;
      S.fallbacks++;
      say(api, "no hit report for " + f.action + ": it ended on " + (v ? api.tag(v) : "its target (gone)") + ", taken as its hit");
      if (knock) watch(v, pushDir(f.bullet, v, api), api);
      if (timed) impact(f.bullet, v, api);
      if (chain && !c0 && !(v && justChained(v, api))) startChain(null, v, api, { x: f.x, y: f.y });
    },
    skillPress: function (p, stick, now, api) { pressed(api); return false },   // never taken: the command goes on as always
    onStage: function (p, why, api) { reset() },
    tick: function (p, bdt, api) {
      if (S.links.length) watchLinks(bdt, api);
      if (S.reds.length) watchReds(bdt, api);
      if (S.watches.length || S.slides.length) watchPushes(bdt, api);
      if (S.armed.length) pruneArmed(api);
      if (S.told.length > 8 || S.chains.length > 8) prune(api);
      if (S.impacts.length || S.shocked.length || S.redsOver.length || S.left.length) pruneTimed(api);
      if (S.tagged > 0 && !S.links.length && !S.reds.length) sweepTags(api);
    },
    test: function (cmd, args, api) {
      if (cmd !== "rbtest") return false;
      var sub = args[0], p = api.player(), a, q;
      if (sub === "react") { S.react = !(args[1] === "0" || args[1] === "off"); api.log("react " + (S.react ? "on" : "off")); return true }
      if (sub === "place") {
        var L = api.enemies(), dx = +args[1] || 0, dy = +args[2] || 0, n = 0;
        if (p) for (var i = 0; i < L.length; i++) if (api.place(L[i], p.Position.x + dx, p.Position.y + dy)) n++;
        api.log("place " + n + " enemies at " + dx + "," + dy + " from Kris"); return true;
      }
      if (sub === "chain") { a = nearest(api); if (a) startChain(null, a, api, null); api.log("test chain from " + (a ? api.tag(a) : "nobody")); return true }
      if (sub === "push") {
        a = nearest(api);
        if (a) { arm(a, api, null, PU.arm); watch(a, pushDir(p, a, api), api, true) }
        api.log("test push on " + (a ? api.tag(a) + (heavy(a, api) ? " (boss)" : "") : "nobody")); return true;
      }
      if (sub === "timed") {
        S.auto = args[1] === undefined || args[1] === "off" ? null : Math.max(0, +args[1] || 0) / 1000;
        api.log("timed: " + (S.auto === null ? "no scripted press" : "the next bolt hit gets a scripted press " + ms(S.auto) + " ms after it")); return true;
      }
      if (sub === "boom" || sub === "shock") {
        a = nearest(api); q = a ? centre(a, api) : null;
        var made = q ? api.launch(sub === "boom" ? ACT.boom : TM.action, q.x, q.y, 1, 0, null, null) : null;
        api.log("test " + sub + " on " + (a ? api.tag(a) : "nobody") + (q && !made ? ": NOT launched" : "")); return true;
      }
      if (sub === "route") {
        if (args[1] === "switch" || args[1] === "launch") S.route = args[1];
        api.log("route " + S.route + " (the third-enemy explosion: " + (S.route === "switch" ? "the bolt becomes " + ACT.boom : ACT.boom + " is launched at the bolt") + ")"); return true;
      }
      return false;
    },
    state: function () {
      return "rudebuster: bolt " + (P.mods ? P.mods.rb.action + " / guard " + P.mods.rb.guardAction : "?") + "; chains " + S.seq + " (" + S.hops + " hops, " +
             S.links.length + " flying, " + S.tagged + " enemies tagged); red bolts " + S.redSeq + " (" + S.reds.length + " flying, " + S.pierced + " enemies pierced, " +
             S.booms + " explosions, route " + S.route + ", aim put back " + S.reaims + "); timed shocks " + S.shocks + "; pushes watched " + S.watches.length +
             ", slid " + S.slid + ", armed " + S.armed.length + "; hit reports " + S.reports + ", read from a bolt's place " + S.fallbacks;
    }
  });
})(); } catch (e) {
  try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_rudebuster.js: " + e) } catch (e2) {}
}
