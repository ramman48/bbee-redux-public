/* dr-party: Kris's Potentials at runtime, group "party": E1 Dual Command, E2 Rally, E3 Heal Prayer, E4 X Slash (Kris's
   charged attack), H1 Party of Three, H2 Marked, the talent Second Wind, and the hidden pairs HP1 (C2 + C6), HP2 (C2 + D2)
   and HP10 (C2 + H2). kp_party.py builds the data; its numbers arrive in globalThis.__bbDRPotsCFG.party (the defaults
   below are the same values). Appended to data/js/window/battle/BattleUI after js/potentials.js (module scope: csharp_1,
   CSharpDefine_1). PLAN.md: the lead's updates 1, 6, 7, 8, then section 4 E / H.

   What the script does:
     E1   mods.dual: js/command.js sends Susie, then Ralsei, on the same target.
     E2   a hit of Kris's own swings (trigger 208901, source set "rally") cuts both recharges by 0.15 s.
          Fallback (PLAN.md R1): the swings add the buff dr_pt_rally to Kris when they hit (data); while the trigger has
          reported NO hit of Kris's in this battle, each marker counts as one hit. Once it has, the marker is only taken off.
     E3   when Ralsei's projectile leaves: Kris is healed 4 % of max HP, at most once in 8 s (not spent at full HP).
     E4   hold Attack through the first swing (kris_a1*): from 0.12 s of hold the script takes the Attack button (the
          string would go on by itself: the game repeats a held Attack); at the swing's hit end, held 0.25 s or more, Kris
          goes to kris_charge. Full after 0.7 s. Let go at full: kris_xslash, and the X's two lines (xslash_a, xslash_b)
          are launched at Kris's centre on the two swings, whatever Kris does next (committed at the release). Let go
          early: back to standing, nothing spent. Held 1.5 s past full: it fires by itself. A hit, a dash or a jump ends
          the charge; target mode does not (the charge goes on while Kris commands, at the battle's slowed time, and the
          script takes the button again each frame because the command gives every button back when it closes). 5 s
          cooldown from the release (a new room clears it); while it runs, holding Attack does what it always did. The
          Attack button is read raw (GamePlay.GameInputManager.GetCommandHoldTime, as the command reads Skill); if that
          cannot be read, the player's own input state is used and the button is not taken.
     H1   while Susie and Ralsei are both ready: the buff dr_pt_trio on Kris (final damage +20 %).
     H2   data only (dr_pt_mark on the victims of a command's projectiles). HP10: the same on the chain's hops.
     HP2  data (Burn on the victims of the chain's hops); the script confirms it 0.1 s after a hop's hit and burns from the
          script if the data did not (as Kindle does).
     HP1  Kris holds C2 and C6: when the chain's own hops have landed, the chain goes on with red hops (rb_chain_red) to
          every enemy on screen not hit in the last 4 s, up to 8 hops in all. Targets only from api.near (the command's
          filtered enemies: never an object or a trap).
     Second Wind (the talent, trigger 208961 -> onTalent): at 30 % HP or less, once per room, Kris is healed 15 % of max
          HP (+5 % per quality) and both recharges end. Fallback: the script looks at Kris's HP every 0.1 s.
          An Evotype heir who holds the talent gets the heal too (the trigger is forwarded for any hero; the core hands
          over a per-room key): no recharges to end, no fallback look (this file only ticks for Kris).
     Objects and traps: a hit the core flags as no real enemy (h.enemy false) cuts no recharge, is not remembered and
          lights nothing; a hop that ended on one is over, and the chain goes on from there.
   Log lines ("[DR-PARTY] POTS ..."): cut both 0.15 (rally) | rally: ... | heal prayer +77 HP ... | x slash: charging |
     x slash: fully charged | x slash at x,y ... | x slash: line 1/2 ... | x slash: released early ... | x slash: charge
     ended: ... | x slash: recharging ... | party of three on / off | chain fire ... | chain+ n -> enemy | chain+ done ... |
     second wind (trigger|poll): +288 HP ...
   Test lines (drparty_test.txt; dev only): ptest atk 1|0 (hold / let go of Attack for the script) ; ptest xslash (the X
     now, no charge) ; ptest heal (a Heal Prayer now) ; ptest hp <share> (Kris's HP to that share of max) ; ptest wind
     [reset] (Second Wind's check now / forget this room's use) ; ptest talent on|off|real (the script's view of holding
     the talent) ; ptest partyfb <rally|wind|fire> <on|off> (the fallbacks) ; ptest party (this group's state).
   The whole file is wrapped: nothing thrown while it loads may reach the battle HUD's module. */
try { (function () {
  var G = globalThis, DR = G.__bbDR, P = DR && DR.party;
  if (!P || !P.potsGroups) return;                  // js/potentials.js is not loaded
  for (var gi = 0; gi < P.potsGroups.length; gi++) if (P.potsGroups[gi] && P.potsGroups[gi].name === "party") return;
  var CS = csharp_1, IsNull = CSharpDefine_1.IsNull;
  var C = (G.__bbDRPotsCFG || {}).party || {};          // the build's values (kp_party.content)
  function num(v, d) { return typeof v === "number" && !isNaN(v) ? v : d }
  function sub(k) { return C[k] || {} }
  var c0 = sub("rally"), c1 = sub("heal"), c2 = sub("xslash"), c3 = sub("trio"), c4 = sub("wind"), c5 = sub("hp1"), c6 = sub("hp2");
  var RALLY = { cut: num(c0.cut, 0.15), buff: c0.buff || "dr_pt_rally" };
  var HEAL = { frac: num(c1.frac, 0.04), cd: num(c1.cd, 8), buff: c1.buff || "dr_pt_heal", show: num(c1.show, 1) };
  var XS = { charge: c2.charge || "kris_charge", slash: c2.slash || "kris_xslash", first: c2.first || "kris_a1", from: c2.from || {},
             arm: num(c2.arm, 0.12), hold: num(c2.hold, 0.25), full: num(c2.full, 0.7), max: num(c2.max, 1.5), cd: num(c2.cd, 5),
             release: num(c2.release, 1),   // 0.5.1: let go after this share of the charge, the X still comes
             cy: num(c2.cy, 0.6), lock: num(c2.lock, 0.33), book: c2.book || "kris_a1",
             zones: c2.zones && c2.zones.length ? c2.zones : [{ action: "xslash_a", at: 0.05, dx: 0.8192, dy: 0.5736 },
                                                              { action: "xslash_b", at: 0.23, dx: 0.8192, dy: -0.5736 }] };
  var TRIO = { buff: c3.buff || "dr_pt_trio", add: num(c3.add, 0.2), glow: c3.glow || null };
  var WIND = { trigger: num(c4.trigger, 208961), at: num(c4.at, 0.3), base: num(c4.base, 0.15), step: num(c4.step, 0.05), poll: num(c4.poll, 0.1) };
  var HP1 = { action: c5.action || "rb_chain_red", max: num(c5.max, 6), after: num(c5.after, 2), range: num(c5.range, 30), delay: num(c5.delay, 0.06),
              offset: num(c5.offset, 0.8), reach: num(c5.reach, 1.6), tag: c5.tag || "dr_pt_chained_x", memory: num(c5.memory, 4),
              life: num(c5.life, 6), flight: num(c5.flight, 1.5), end: c5.end || "rb_bolt_end" };
  var HP2 = { buff: c6.buff || "1116", dur: num(c6.dur, 5), dps: num(c6.dps, 150), check: num(c6.check, 0.1) };
  var FB = { rally: c0.fallback !== false, wind: true, fire: c6.fallback !== false };
  var X = { st: "idle", hold: 0, a1: -1, prev: "", t: 0, full: false, grace: 0, readyAt: -1e9, blocked: false, raw: null,
            told: false, at: null, zones: [] };
  var H = { hits: {}, tags: {}, rb: 0, n: 0, active: false, t0: 0, link: null };
  var S = { rally: 0, rallyFb: 0, markers: 0, heals: 0, healAt: -1e9, trio: false, trioN: 0, trioT: 0, glow: {}, winds: 0, windKey: null, windHeir: null, windT: 0,
            fired: 0, early: 0, ended: 0, lines: 0, chainFire: 0, chainFireFb: 0, hops: 0, runs: 0, atk: false, talent: null, said: {},
            x: X, h: H };
  P.potsParty = S;

  // ---------------------------------------------------------------- basics
  function verbose() { return !P.potsState || P.potsState.hitlog !== false }
  function say(api, s) { if (verbose()) api.log(s) }
  function once(api, key, s) { if (!S.said[key]) { S.said[key] = 1; api.log(s) } }
  function alive(a) { try { return !!a && !IsNull(a) && !a.IsDead } catch (e) { return false } }
  function onoff(b) { return b ? "on" : "off" }
  function aiming() { try { return !!P.state && P.state.state === "aim" } catch (e) { return false } }
  function noKrisReports(api) { var r = typeof api.reports === "function" ? api.reports() : null; return !r || !(r.kris > 0) }
  function noShotReports(api) { var r = typeof api.reports === "function" ? api.reports() : null; return !r || !(r.shot > 0) }
  function roomKey() { return "room " + (P.potsState ? P.potsState.room : 0) }

  // ---------------------------------------------------------------- healing (E3, Second Wind)
  function hpOf(p, api) {
    var hp = NaN, mx = NaN, dead = false;
    try { hp = api.f(p.Attr.HP); mx = api.f(p.Attr.MaxHp) } catch (e) {}
    try { dead = !!p.Attr.IsHPZero } catch (e2) {}
    return { hp: hp, max: mx, ok: mx > 0 && hp > 0 && !dead };
  }
  function heal(p, frac, api) {                     // -> HP restored (0: nothing to restore, or it cannot be read)
    var q = hpOf(p, api); if (!q.ok) return 0;
    var n = Math.min(q.max, q.hp + frac * q.max), d = n - q.hp;
    if (!(d >= 0.5)) return 0;
    try { p.Attr.SetHP(api.fp(n)) } catch (e) { once(api, "sethp", "heal: Kris's HP cannot be set (" + e + ")"); return 0 }
    // the number over Kris, as the game shows a heal (the element enum sits in the game's global namespace)
    try { p.BuffMgr.ShowHPChangeOnNumberUI(d, CS.EAttrElementType.None) } catch (e2) { once(api, "hpnum", "heal: the number cannot be shown (" + e2 + ")") }
    api.addBuff(p, HEAL.buff, HEAL.show, 1, 1, p);  // the sparkle (a buff's effect: it rides Kris)
    return d;
  }
  function healPrayer(p, api, forced) {
    var q = hpOf(p, api), t = api.now();
    if (!(q.max > 0)) { once(api, "hp?", "heal prayer: Kris's HP cannot be read"); return false }
    if (!forced && t - S.healAt < HEAL.cd) { say(api, "heal prayer: recharging (" + (HEAL.cd - (t - S.healAt)).toFixed(1) + " s)"); return false }
    var d = heal(p, HEAL.frac, api);
    if (!(d > 0)) { say(api, "heal prayer: HP is full (not spent)"); return false }
    S.healAt = t; S.heals++;
    api.log("heal prayer +" + d.toFixed(0) + " HP (" + Math.round(HEAL.frac * 100) + "% of " + q.max.toFixed(0) + "; again in " + HEAL.cd + " s)");
    return true;
  }

  // ---------------------------------------------------------------- the talent: Second Wind
  function talentNode(p, api) {                     // the talent's trigger at its quality: idx + (quality - 1), as the cards' gates read levels
    for (var q = 0; q < 4; q++) {
      var n = null;
      try { n = p.TriggerMgr.FindTrigger(WIND.trigger + q) } catch (e) {}
      if (!n) continue;
      try { var lv = Math.round(api.f(n.Lvl)); if (lv >= 1 && lv <= 5) q = Math.max(q, lv - 1) } catch (e2) {}   // (if the node keeps the row's id, its level says)
      return { n: n, q: q };
    }
    return null;
  }
  function windShare(t, api) {                      // the trigger's own value at its level, else the build's figures
    var v = NaN;
    try { v = api.f(t.n.ParamSet.GetFp("v0")) } catch (e) {}
    return v > 0 && v <= 1 ? v : WIND.base + WIND.step * t.q;
  }
  // ctx (from the core, for the trigger): { heir, room }. An Evotype heir of Kris's holds the talent too: the trigger
  // reaches this file for that hero as well (no cards, no party, no tick of this file: only the heal, once per ctx.room)
  function secondWind(p, how, api, ctx) {
    var q = hpOf(p, api); if (!q.ok || q.hp / q.max > WIND.at + 1e-6) return false;
    var heir = !!(ctx && ctx.heir), key = ctx && ctx.room ? ctx.room : roomKey(), slot = heir ? "windHeir" : "windKey";
    if (S[slot] === key) return false;
    if (S.talent === false) return false;           // (dev: the script's view says the talent is not held)
    var t = talentNode(p, api);
    if (!t) {                                       // the script's own look: only for a Kris who holds the talent
      if (how !== "trigger" && S.talent !== true) return false;
      t = { n: null, q: 0 };
    }
    S[slot] = key; S.winds++;
    var share = windShare(t, api), d = heal(p, share, api);
    if (!heir) api.cut("both", 99, "second wind");
    api.log("second wind (" + how + (heir ? ", an heir" : "") + "): +" + d.toFixed(0) + " HP (" + Math.round(share * 100) + "% of max, at " +
            Math.round(q.hp / q.max * 100) + "% HP)" + (heir ? "" : "; Susie and Ralsei are ready") + "; once per room");
    return true;
  }

  // ---------------------------------------------------------------- H1: Party of Three
  function glow(api, on) {                          // the followers' glow: only when the build has the effect (kris_trio)
    if (!TRIO.glow) return;
    var F = P.followers || {};
    for (var w in { susie: 1, ralsei: 1 }) {
      var b = on && F[w] ? F[w].b : null, had = S.glow[w];
      if (had && had !== b) { api.removeBuff(had, TRIO.glow); S.glow[w] = null }
      if (b && had !== b && alive(b) && api.addBuff(b, TRIO.glow, 9999, 1, 1, api.player())) S.glow[w] = b;
    }
  }
  function trio(p, bdt, api) {
    var want = api.has("H1") && api.ready("susie") && api.ready("ralsei") && alive(p);
    if (want && !S.trio) {
      if (api.addBuff(p, TRIO.buff, 9999, TRIO.add, 1, p)) { S.trio = true; S.trioN++; S.trioT = 0; say(api, "party of three on (+" + Math.round(TRIO.add * 100) + "% damage)") }
    } else if (!want && S.trio) {
      api.removeBuff(p, TRIO.buff); S.trio = false; say(api, "party of three off");
    } else if (want && (S.trioT += bdt) > 1) {      // still there? (a cleanse, a revive)
      S.trioT = 0; if (api.buffState(p, TRIO.buff) === false) S.trio = false;
    }
    glow(api, S.trio);
  }

  // ---------------------------------------------------------------- E2: Rally's fallback marker
  function rallyMarker(p, api) {
    if (api.buffState(p, RALLY.buff) !== true) return;
    api.removeBuff(p, RALLY.buff); S.markers++;
    if (!api.has("E2")) return;
    if (FB.rally && noKrisReports(api)) { S.rallyFb++; api.cut("both", RALLY.cut, "rally: the swing's own marker, no hit report") }
    else say(api, "rally: marker seen (" + (FB.rally ? "the trigger reports Kris's hits: not counted" : "fallback off") + ")");
  }

  // ---------------------------------------------------------------- E4: X Slash, the charged attack
  function rawHold(cmd) {                           // seconds held (0 = up); -1 = the raw button cannot be read
    try { var g = CS.GamePlay.GameInputManager.Instance; if (g) { var v = +g.GetCommandHoldTime(cmd); return v > 0 ? v : 0 } } catch (e) {}
    return -1;
  }
  function attackHeld(p) {
    if (S.atk) return true;
    var r = rawHold(CS.GamePlay.InputCmd.Attack);
    X.raw = r >= 0;
    if (X.raw) return r > 0;
    try { return !!p.Input.GetCmdStatus(CS.GamePlay.InputCmd.Attack).Pressing } catch (e) { return false }
  }
  function block(p, on, api) {                      // the Attack button is the script's: the string does not go on by itself
    if (on && !X.raw && !S.atk) return;             // (it could not be read any more once blocked)
    try {
      var c = CS.GamePlay.InputCmd.Attack, src = CS.GamePlay.InputCmdBlockSource.Script;
      if (on) p.Input.AddInputCmdBlock(c, src); else p.Input.RemoveInputCmdBlock(c, src);
      X.blocked = on;
    } catch (e) { X.blocked = false; once(api, "block", "x slash: the Attack button cannot be taken (" + e + ")") }
  }
  function unblock(p, api) {
    if (!X.blocked) return;
    if (aiming()) { X.blocked = false; return }     // target mode holds every button now and gives them all back itself
    block(p, false, api);
  }
  function change(p, name, api) {
    try { return p.ActionMgr.ChangeAction(name) !== false }
    catch (e) { once(api, "act " + name, "x slash: Kris cannot go to " + name + " (" + e + ")"); return false }
  }
  function isFirst(n) { return !!n && n.indexOf(XS.first) === 0 }
  function hitEnd(n) { var v = XS.from[n]; return typeof v === "number" ? v : num(XS.from[XS.first], 0.167) }
  function idle(p, api) { unblock(p, api); X.st = "idle" }
  function endCharge(p, api, why, stand, early) {
    if (stand && api.actionOf(p) === XS.charge) change(p, "stand", api);
    idle(p, api);
    if (early) { S.early++; say(api, "x slash: released early (" + X.t.toFixed(2) + " of " + XS.full + " s): nothing spent") }
    else { S.ended++; say(api, "x slash: charge ended: " + why) }
  }
  // one line of the X, booked to Kris's Attack row (the core's api.launchAs: the row of XS.book; the command's row
  // stands in if it cannot be found). The core watches it to its end like every projectile a script makes
  function shoot(action, x, y, dx, dy, api) { return api.launchAs(XS.book, action, x, y, dx, dy) }
  function fire(p, api, how) {
    var q = api.pos(p);
    if (!change(p, XS.slash, api)) { endCharge(p, api, "Kris could not start " + XS.slash, true, false); return false }
    X.st = "slash"; X.t = 0; X.readyAt = api.now() + XS.cd; X.at = { x: q.x, y: q.y + XS.cy }; X.zones = [];
    for (var i = 0; i < XS.zones.length; i++) X.zones.push({ z: XS.zones[i], done: false });
    S.fired++;
    api.log("x slash at " + X.at.x.toFixed(2) + "," + X.at.y.toFixed(2) + " (" + how + "; ready again in " + XS.cd + " s)");
    return true;
  }
  function slashTick(p, bdt, api) {
    X.t += bdt;
    var left = 0;
    for (var i = 0; i < X.zones.length; i++) {
      var o = X.zones[i];
      if (o.done) continue;
      if (X.t < o.z.at) { left++; continue }
      o.done = true;                                // committed at the release: the line comes whatever Kris does now
      var b = alive(p) ? shoot(o.z.action, X.at.x, X.at.y, o.z.dx, o.z.dy, api) : null;
      if (b) S.lines++;
      say(api, "x slash: line " + (i + 1) + "/" + X.zones.length + " " + o.z.action + (b ? "" : " NOT launched"));
    }
    if ((!left && X.t >= XS.lock) || X.t > 3 || !alive(p)) { X.zones = []; idle(p, api) }
  }
  function xslash(p, bdt, api) {
    var has = api.has("E4"), act = api.actionOf(p), first = isFirst(act);
    var held = (has || X.st !== "idle") ? attackHeld(p) : false;
    X.hold = held ? X.hold + bdt : 0;
    if (!held) X.told = false;
    X.a1 = first ? (isFirst(X.prev) ? X.a1 + bdt : 0) : -1;
    X.prev = act;
    if (X.st === "slash") { block(p, true, api); slashTick(p, bdt, api); return }
    if (!has) { if (X.st !== "idle") endCharge(p, api, "the card is gone", true, false); return }
    if (X.st === "idle") {
      if (!first || !held || X.hold < XS.arm) return;
      var wait = X.readyAt - api.now();
      if (wait > 0) { if (!X.told) { X.told = true; say(api, "x slash: recharging (" + wait.toFixed(1) + " s): the string goes on") } return }
      X.st = "arm"; block(p, true, api);
      return;
    }
    if (X.st === "arm") {                           // the button is ours; the first swing plays on
      if (!held || !first) { idle(p, api); return }
      block(p, true, api);                          // every frame: the command gives every button back when target mode closes
      if (X.hold >= XS.hold && X.a1 >= hitEnd(act)) {
        if (!change(p, XS.charge, api)) { idle(p, api); return }
        X.st = "charge"; X.t = 0; X.full = false; X.grace = 3;
        say(api, "x slash: charging (" + XS.full + " s to full)");
      }
      return;
    }
    if (X.st === "charge") {
      X.t += bdt;
      if (act !== XS.charge) {                      // (the new action may only show a frame later)
        if (X.grace-- > 0) return;
        endCharge(p, api, "Kris went to " + (act || "?"), false, false); return;
      }
      X.grace = 0;
      if (!X.full && X.t >= XS.full) { X.full = true; say(api, "x slash: fully charged") }
      // 0.5.1: a release late in the charge counts (the lead's session of 2026-10-03: let go at 0.43 of 0.45 s, and
      // nothing came). Earlier than that share it is still a release: nothing spent
      if (!held) {
        if (X.full || X.t >= XS.full * XS.release) fire(p, api, (X.full ? "charged " : "let go late in the charge, ") + X.t.toFixed(2) + " s");
        else endCharge(p, api, "", true, true);
        return;
      }
      if (X.t >= XS.full + XS.max) { fire(p, api, "held to the end"); return }
      block(p, true, api);
    }
  }
  function resetX(p, api) {
    if (p) unblock(p, api);                         // (not while target mode holds the buttons: it gives them back itself)
    X.st = "idle"; X.hold = 0; X.a1 = -1; X.prev = ""; X.zones = []; X.blocked = false; X.readyAt = -1e9; X.told = false;
  }

  // ---------------------------------------------------------------- HP2: the chain carries fire (the data's burn, confirmed)
  function chainFire(h, api) {
    var tg = h.target, who = api.tag(tg);
    api.after(HP2.check, function () {
      if (!alive(tg)) return;
      var st = api.buffState(tg, HP2.buff);
      if (st === true) { S.chainFire++; say(api, "chain fire " + who + " burning"); return }
      if (st === null) { once(api, "burn?", "chain fire: the burn on " + who + " cannot be read (no check, no fallback)"); return }
      // Detonate (D6, the fireshock group) took the burn off with its explosion: the hop still leaves its fire (the
      // pair's line: "The chain carries fire to each enemy it reaches"). No miss of the data's burn: not the fallback
      if (api.noted("detonated " + who, HP2.check + 0.3)) {
        var lit = api.burn(tg, HP2.dur, HP2.dps); S.chainFire++;
        say(api, "chain fire " + who + (lit ? " burning again after its detonation" : " detonated; the script could not light it again"));
        return;
      }
      if (!FB.fire) { say(api, "chain fire " + who + " NOT burning"); return }
      var ok = api.burn(tg, HP2.dur, HP2.dps); S.chainFireFb++;
      say(api, "chain fire fallback " + who + (ok ? " burning (script)" : " NOT burning: the script could not add it"));
    });
  }

  // ---------------------------------------------------------------- HP1: the chain goes on to every enemy on screen
  function pairOn(api) { return api.has("C2") && api.has("C6") }
  function centre(a, api) { var q = api.pos(a); return { x: q.x, y: q.cy } }
  function noteHit(a, api) { if (a) H.hits[api.tag(a)] = { a: a, t: api.now() } }
  function recent(a, api) { var r = H.hits[api.tag(a)]; return !!r && api.now() - r.t < HP1.memory }
  function tagAll(api) {                            // a red hop flies through every enemy the chain has hit (its hit skips the tag)
    for (var k in H.hits) {
      var r = H.hits[k];
      if (H.tags[k] || !alive(r.a) || api.now() - r.t >= HP1.memory) continue;
      if (api.addTag(r.a, HP1.tag)) H.tags[k] = r.a;
    }
  }
  function untagAll(api) { for (var k in H.tags) { if (alive(H.tags[k])) api.removeTag(H.tags[k], HP1.tag) } H.tags = {} }
  function finishRun(api, why) {
    if (!H.active) return;
    H.active = false; H.link = null; untagAll(api);
    say(api, "chain+ done: " + H.n + " more hop" + (H.n === 1 ? "" : "s") + " (" + why + ")");
  }
  function hop(from, api) {
    if (!H.active) return;
    if (!pairOn(api)) { finishRun(api, "the cards are gone"); return }
    if (H.n >= HP1.max) { finishRun(api, "the cap"); return }
    // anywhere on screen, however far (api.chase; within HP1.range when off it); only the command's real enemies
    var L = api.chase(from.x, from.y, HP1.range, function (a) { return alive(a) && !recent(a, api) && !api.guarded(a) });
    if (!L.length) { finishRun(api, "no enemy left on screen"); return }
    var q = L[0], dx = q.x - from.x, dy = q.y - from.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) { dx = 1; dy = 0; d = 1 }
    var off = Math.min(HP1.offset, d * 0.5);
    tagAll(api);
    var b = api.launch(HP1.action, from.x + dx / d * off, from.y + dy / d * off, dx / d, dy / d, q.a, null);
    if (!b) { finishRun(api, "the hop was not launched"); return }
    H.n++; S.hops++; H.link = { b: b, tgt: q.a, done: false };
    say(api, "chain+ " + H.n + " -> " + api.tag(q.a) + " (" + d.toFixed(1) + " u, " + HP1.action + ")");
  }
  function landed(target, api, from) {
    if (H.link) H.link.done = true;
    if (target) noteHit(target, api);
    var at = target ? centre(target, api) : from;
    api.after(HP1.delay, function () { hop(at, api) });
  }
  function startRun(target, api, from) {            // the chain's own hops are over: go on from the last enemy
    if (H.active || !pairOn(api) || HP1.max <= 0) return;
    H.active = true; H.n = 0; H.t0 = api.now(); H.link = null; S.runs++;
    var at = target ? centre(target, api) : from;
    api.after(HP1.delay + 0.08, function () { hop(at, api) });   // (after the chain has finished and taken its own tags off)
  }
  function victimAt(x, y, api) {                    // no hit report: whoever stands where the hop ended
    var L = api.near(x, y, HP1.reach, function (a) { return alive(a) && !recent(a, api) });
    return L.length ? L[0].a : null;
  }
  function resetH(api) { untagAll(api); H.hits = {}; H.rb = 0; H.n = 0; H.active = false; H.link = null }

  P.potsGroups.push({
    name: "party", cards: ["E1", "E2", "E3", "E4", "H1", "H2"],
    mods: function (m, has, api) { if (has("E1")) m.dual = true },
    onFire: function (f, api) { if (f.who === "ralsei" && api.has("E3")) healPrayer(api.player(), api, false) },
    onHit: function (h, api) {
      // (h.enemy false: the trigger reported a pot or a trap. Nothing is cut, remembered or lit for it; a hop that
      // ended on one is still over, and the chain goes on from where it stood)
      var real = h.enemy !== false;
      if (h.kris) {
        if (h.src.rally && api.has("E2") && real) { S.rally++; api.cut("both", RALLY.cut, "rally") }
        return;
      }
      var hopHit = api.matches("chain", h.action);
      // Rude Buster itself (the source set "bolt": the command's bolt and its explosion): what it hit is remembered
      if (api.matches("bolt", h.action)) { if (real) noteHit(h.target, api); H.rb = 0; return }
      if (!hopHit) return;
      if (real) {
        noteHit(h.target, api);
        if (!h.guarded && api.has("C2") && api.has("D2")) chainFire(h, api);
      }
      var from = centre(h.target, api);
      if (h.action === HP1.action) { if (H.link && !H.link.done) landed(real ? h.target : null, api, from); return }
      if (++H.rb >= HP1.after) { H.rb = 0; startRun(real ? h.target : null, api, from) }
    },
    onImpact: function (o, api) {
      // a projectile ended. Only read while the hit trigger has reported no projectile hit in this battle (PLAN.md R1):
      // where a bolt or a hop ended early, on its end action, stands in for its hit
      var mine = H.link && H.link.b === o.bullet && !H.link.done;
      if (!mine && !noShotReports(api)) return;
      var hopEnd = o.who === "script" && api.matches("chain", o.action), prim = o.who === "susie" && api.matches("primary", o.action);
      if (!hopEnd && !prim) return;
      var hit = noShotReports(api) && String(o.end || "") === HP1.end && o.age < HP1.flight - 0.05, v = hit ? victimAt(o.x, o.y, api) : null;
      if (mine) {
        if (v) { say(api, "chain+ " + H.n + " landed on " + api.tag(v) + " (no hit report: read from where it ended)"); landed(v, api, { x: o.x, y: o.y }) }
        else finishRun(api, "the hop missed");
        return;
      }
      if (!v) return;
      noteHit(v, api);
      if (prim) { H.rb = 0; return }
      if (o.action !== HP1.action && ++H.rb >= HP1.after) { H.rb = 0; startRun(v, api, { x: o.x, y: o.y }) }
    },
    onTalent: function (p, a, api, ctx) { secondWind(p, "trigger", api, ctx) },
    onStage: function (p, why, api) {
      resetX(p, api); resetH(api);
      if (p && S.trio) api.removeBuff(p, TRIO.buff);
      S.trio = false; glow(api, false); S.said = {};
    },
    tick: function (p, bdt, api) {
      xslash(p, bdt, api);
      trio(p, bdt, api);
      rallyMarker(p, api);
      if (FB.wind && (S.windT += bdt) >= WIND.poll) { S.windT = 0; secondWind(p, "poll", api) }
      if (H.active && api.now() - H.t0 > HP1.life) finishRun(api, "it took too long");
    },
    test: function (cmd, args, api) {
      if (cmd !== "ptest") return false;
      var sub2 = args[0], p = api.player(), on = !(args[1] === "0" || args[1] === "off");
      if (sub2 === "atk") { S.atk = args[1] === "1" || args[1] === "on"; api.log("atk " + (S.atk ? "held" : "let go") + " (script)"); return true }
      if (sub2 === "xslash") {
        if (!p) { api.log("x slash: no player"); return true }
        if (X.st !== "idle") idle(p, api);
        if (fire(p, api, "test line")) block(p, true, api);
        return true;
      }
      if (sub2 === "heal") { if (p) healPrayer(p, api, true); return true }
      if (sub2 === "hp") {
        var q = p ? hpOf(p, api) : { max: NaN }, share = Math.max(0.001, Math.min(1, +args[1] || 0.5));
        if (q.max > 0) { try { p.Attr.SetHP(api.fp(Math.max(1, Math.round(q.max * share)))) } catch (e) {} }
        api.log("hp set to " + (q.max > 0 ? Math.round(q.max * share) + " / " + Math.round(q.max) : "? (it cannot be read)"));
        return true;
      }
      if (sub2 === "wind") {
        if (args[1] === "reset") { S.windKey = null; api.log("second wind: this room's use forgotten"); return true }
        if (p && !secondWind(p, "trigger", api)) api.log("second wind: nothing (HP above " + Math.round(WIND.at * 100) + "%, or used in this room)");
        return true;
      }
      if (sub2 === "talent") {
        S.talent = args[1] === "real" || args[1] === undefined ? null : on;
        api.log("talent " + (S.talent === null ? "as held" : S.talent ? "held (script's view)" : "not held (script's view)")); return true;
      }
      if (sub2 === "partyfb") {
        if (args[1] === "rally" || args[1] === "wind" || args[1] === "fire") FB[args[1]] = !(args[2] === "0" || args[2] === "off");
        api.log("fallback rally=" + onoff(FB.rally) + " wind=" + onoff(FB.wind) + " fire=" + onoff(FB.fire)); return true;
      }
      if (sub2 === "party") { api.log("state " + this.state()); return true }
      return false;
    },
    state: function () {
      var api = P.potsApi, t = api ? api.now() : 0;
      return "party dual=" + !!(P.mods && P.mods.dual) + " rally " + S.rally + " (marker " + S.rallyFb + " of " + S.markers + " seen) heals " + S.heals +
             " trio " + onoff(S.trio) + " (" + S.trioN + ") x slash " + X.st + " fired " + S.fired + " lines " + S.lines + " early " + S.early +
             " ended " + S.ended + " ready " + (X.readyAt > t ? "in " + (X.readyAt - t).toFixed(1) + " s" : "now") + " raw " + (X.raw === null ? "?" : X.raw) +
             " second wind " + S.winds + " chain+ runs " + S.runs + " hops " + S.hops + " chain fire " + S.chainFire + " (script " + S.chainFireFb +
             ") fallback rally=" + onoff(FB.rally) + " wind=" + onoff(FB.wind) + " fire=" + onoff(FB.fire);
    }
  });
})(); } catch (e) {
  try { (globalThis.__bbDRPotsLoadErr = globalThis.__bbDRPotsLoadErr || []).push("pots_party.js: " + e) } catch (e2) {}
}
