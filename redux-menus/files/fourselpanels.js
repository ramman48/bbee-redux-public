// The new character select's own panels (the lead, 2026-10-20: "can you properly redesign and add tag mode to this menu
// and make a new color selector and a new menu for mind crystals"):
// - Partner: Tag Mode in the select. LT / I turns the grid into the partner pick; the partner's badge sits beside the
//   card. Tag Mode's own settings (BBTAG) are written; nothing here runs a fight. Without the tag-mode mod the button
//   is not offered.
// - Colours: the game's wardrobe runs underneath (camera, the hero in the room, every palette, the palette maker's
//   colours, the save) and this panel replaces its strip: a list of colours with their swatch, owned or how to get them.
// - Mind Crystals: the six slots and every crystal of the game's pool, equip, unequip, level up and unlock through the
//   game's own requests, the condition of a locked one in the game's words.
// Built by fourlobbyui.js with its helpers (BB4PAN.ensure), driven from its input. Log tag FOURUI (the screen's own).
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof;
  var P = G.BB4PAN = G.BB4PAN || {};
  function log(m) { B.log("FOURUI", "panels: " + m); }
  var es = B.es, H = null, S = null;

  // ---- building ----
  P.ensure = function (s, h) {
    S = s; H = h;
    if (P.ui && !P.ui.Equals(null) && P.ui.parent && P.ui.parent.Equals(S.ui)) return;
    var ui = H.node(S.ui, "Panels"); ui.anchorMin = UE.Vector2.zero; ui.anchorMax = UE.Vector2.one; ui.sizeDelta = UE.Vector2.zero; P.ui = ui;
    P.kind = null; P.col = null; P.cr = null; P.badge = null;
    buildColours(ui); buildCrystals(ui);
    P.colRoot.gameObject.SetActive(false); P.crRoot.gameObject.SetActive(false);
    log("built");
  };
  function T_(parent, name, size, c, align, style) { H.node(parent, name); return H.txt(parent, name, size, c, align, style); }
  function img(parent, name, sprite, c) { var rt = H.node(parent, name), im = rt.gameObject.AddComponent(T(UI.Image)); im.raycastTarget = false; if (sprite) im.sprite = sprite; im.color = c || new UE.Color(1, 1, 1, 1); im.preserveAspect = true; return im; }
  function at(rt, x, y, w, h) { rt.anchorMin = rt.anchorMax = new UE.Vector2(0.5, 0.5); rt.anchoredPosition = new UE.Vector2(x, y); if (w) rt.sizeDelta = new UE.Vector2(w, h); return rt; }
  function veil(parent, a) { var v = H.node(parent, "Veil"); v.anchorMin = UE.Vector2.zero; v.anchorMax = UE.Vector2.one; v.sizeDelta = new UE.Vector2(600, 600); var vi = v.gameObject.AddComponent(T(UI.RawImage)); vi.raycastTarget = false; vi.texture = UE.Texture2D.whiteTexture; vi.color = new UE.Color(0.02, 0.01, 0.035, a); return vi; }
  function offSprite(b) { try { return b.rt.Find("Off").GetComponent(T(UI.Image)).sprite; } catch (e) { return null; } }
  var GOLD = [1, 0.82, 0.48], DIM = [0.62, 0.6, 0.7], RED = [1, 0.42, 0.4];
  function hex(c) { return c.map(function (v) { var h = Math.round(v * 255).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }   // used before the panels are built (the card's colour line)
  function unhex(s) { s = String(s || "").replace("#", ""); return [0, 2, 4].map(function (i) { return (parseInt(s.substr(i, 2), 16) || 0) / 255; }); }
  function raw(parent, name, c, x, y, w, h) { var rt = H.node(parent, name), r = rt.gameObject.AddComponent(T(UI.RawImage)); r.raycastTarget = false; r.texture = UE.Texture2D.whiteTexture; r.color = c; at(rt, x, y, w, h); return r; }

  // ---- motion: time-based, advanced every frame from P.draw (the screen's timer runs each frame) ----
  var TW = [];
  function now() { return UE.Time.unscaledTime; }
  function easeOut(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) { t = Math.max(0, Math.min(1, t)) - 1; return 1 + 2.4 * t * t * t + 1.4 * t * t; }   // fast in, a small overshoot, settles
  function anim(key, delay, dur, fn) {
    for (var i = TW.length - 1; i >= 0; i--) if (TW[i].key === key) TW.splice(i, 1);
    TW.push({ key: key, t0: now() + delay, dur: dur, fn: fn }); try { fn(0); } catch (e) {}
  }
  function runAnims() {
    var t = now();
    for (var i = TW.length - 1; i >= 0; i--) { var a = TW[i], k = Math.max(0, Math.min(1, (t - a.t0) / a.dur)); try { a.fn(k); } catch (e) { k = 1; } if (k >= 1) TW.splice(i, 1); }
  }
  function scl(rt, s) { rt.localScale = new UE.Vector3(s, s, 1); }
  function group(rt) { var g = rt.GetComponent(T(UE.CanvasGroup)); if (!g || g.Equals(null)) g = rt.gameObject.AddComponent(T(UE.CanvasGroup)); return g; }
  // an official effect on a target of this size (UI effects fit the rect they are played on), gone after life seconds
  function hideParts(f, names) {
    if (!f) return;
    anim(f, 0, 0.3, function () {
      try { var ts = f.GetComponentsInChildren(T(UE.Transform), true); for (var i = 0; i < ts.Length; i++) { var t = ts.get_Item(i); if (names.indexOf(String(t.name)) >= 0 && t.gameObject.activeSelf) t.gameObject.SetActive(false); } } catch (e) {}
    });
  }
  function fxAt(parent, name, x, y, s, w, h, life) {
    var X = G.BB4SEL, f = X.fx(parent, name, x, y, s, !!(life < 0)); if (!f) return null;
    if (w) f.sizeDelta = new UE.Vector2(w, h);
    if (life > 0) setTimeout(function () { X.kill(f); }, life * 1000);
    return f;
  }

  // ---- Partner: the badge beside the card and the grid's partner mode ----
  P.tagOn = function () { return !!(G.BBTAG && G.BBTAG.opts); };
  function tagOpts() { try { return G.BBTAG.opts(); } catch (e) { return null; } }
  P.partnerOk = function (id) { try { return !!G.BBTAG.canPartner(id); } catch (e) { return false; } };
  P.partnerId = function () { var o = tagOpts(); return o && o.on ? (o.partner | 0) : 0; };
  function buildBadge(Z) {
    var rt = H.node(Z.root, "PartnerBadge"); at(rt, -222, -318, 300, 96);
    var b = H.button(rt, "Plate"); at(b.rt, 0, 0, 300, 96); b.t.text = "";
    var hd = img(b.rt, "Head", null); at(hd.rectTransform, -104, 0, 76, 76);
    var t1 = T_(b.rt, "T_Lbl", 18, GOLD, null, 3); at(t1.rectTransform, 46, 20, 180, 26);
    var t2 = T_(b.rt, "T_Name", 26, [1, 1, 1], null, 3); at(t2.rectTransform, 46, -12, 180, 34);
    t2.enableAutoSizing = true; t2.fontSizeMax = 26; t2.fontSizeMin = 14; t2.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
    P.badge = { rt: rt, b: b, head: hd, lbl: t1, name: t2, key: null };
  }
  function drawBadge(Z) {
    if (!P.tagOn()) { if (P.badge) P.badge.rt.gameObject.SetActive(false); return; }
    if (!P.badge || P.badge.rt.Equals(null)) buildBadge(Z);
    var bd = P.badge, p = S.pick, o = tagOpts() || {}, hero = p && p.list ? p.list[p.i] : 0, picking = !!(p && p.partner);
    var pid = picking ? hero : (o.on ? o.partner | 0 : 0), key = (picking ? "p" : "") + pid + "|" + (o.on ? 1 : 0) + "|" + hero;
    bd.rt.gameObject.SetActive(true);
    H.lightBtn(bd.b, picking, true);
    if (bd.key == key) return; bd.key = key;
    var sp = pid ? H.headSprite(pid) : null; bd.head.sprite = sp; bd.head.gameObject.SetActive(!!sp);
    bd.lbl.text = picking ? "CHOOSING PARTNER" : "TAG PARTNER";
    if (!pid) { bd.name.text = "<color=#" + hex(DIM) + ">Tag Mode off</color>"; return; }
    bd.name.text = H.heroLabelOf(pid) + (!picking && pid == hero ? "  <color=#" + hex(DIM) + ">(same hero: solo)</color>" : "");
    bd.name.color = picking ? new UE.Color(0.08, 0.06, 0.1, 1) : new UE.Color(1, 1, 1, 1);
  }
  P.partnerStart = function () {
    var p = S.pick; if (!p || p.step != "hero" || !P.tagOn()) return false;
    p.partner = true; p.partnerFrom = p.i; P.sfx("sfx_ui_53");
    var cur = P.partnerId(), j = cur ? p.list.indexOf(cur) : -1; if (j >= 0) p.i = j;
    log("partner pick open (partner " + (cur || "none") + ")"); return true;
  };
  P.partnerEnd = function () { var p = S.pick; if (!p) return; p.partner = false; if (p.partnerFrom != null && p.partnerFrom < p.list.length) p.i = p.partnerFrom; p.partnerFrom = null; P.sfx("sfx_ui_36"); };
  // A on a hero: it becomes the partner and Tag Mode is on; A on the partner it already is: Tag Mode off
  P.partnerChoose = function (id) {
    var T2 = G.BBTAG; if (!T2) return;
    if (!P.partnerOk(id)) { P.sfx("sfx_ui_13"); H.toast(H.heroLabelOf(id) + " can't be a partner: not unlocked"); return; }
    var o = tagOpts() || {};
    if (o.on && (o.partner | 0) == id) { T2.set("on", false); P.sfx("sfx_ui_41"); H.toast("Tag Mode off"); log("Tag Mode off"); }
    else { T2.set("partner", id); T2.set("on", true); P.sfx("sfx_ui_55"); H.toast(H.heroLabelOf(id) + " is your partner. Tag in a fight with " + (H.padNow() ? T2.opts().pad : T2.keyName ? T2.keyName(T2.opts().key) : T2.opts().key));
      log("partner " + id + ", Tag Mode on");
      if (G.BB4SEL && P.badge) { var f = G.BB4SEL.fx(P.badge.rt, "UI/Common/chaosscheduleunlock_complete", 0, 0, 0.7, false); if (f) setTimeout(function () { G.BB4SEL.kill(f); }, 1800); } }
    P.partnerEnd();
  };
  P.partnerOff = function () { var T2 = G.BBTAG; if (!T2) return; T2.set("on", false); P.sfx("sfx_ui_41"); H.toast("Tag Mode off"); P.partnerEnd(); };
  // the grid in partner mode: the select's title and lines say so
  P.drawPartner = function (Z, id) {
    drawBadge(Z);
    var p = S.pick; if (!p || !p.partner) return false;
    var o = tagOpts() || {}, ok = P.partnerOk(id);
    Z.title.text = "CHOOSE YOUR PARTNER";
    Z.why.text = ok ? (o.on && (o.partner | 0) == id ? "This hero is your partner now. Choose it again to turn Tag Mode off." : "This hero fights beside you on its own. You can tag in and out in any single-player fight.")
      : "<color=#" + hex(RED) + ">A partner must be a hero you own, and this one is not unlocked.</color>";
    Z.k.name_t.text = o.on && (o.partner | 0) == id ? "<color=#ffd27a>Partner now</color>" : ok ? "Choose as partner" : "<color=#ffd27a>Not unlocked</color>";
    return true;
  };
  P.cellDim = function (id) { var p = S.pick; return !!(p && p.partner && !P.partnerOk(id)); };

  // ---- Colours ----
  // each row: its number and name, then the colour's own main colours as chips (read from the game's sprite sheets:
  // fourchips.js; the palette maker's colours from the palette itself), as the palette maker's rows show them
  // the layout of the approved mockup (local_only/redux/v4shots/gpt/mock_colours): a dark slab leaning in from the right,
  // the title large on its banner, five large swatches, nine wide slanted rows, a footer bar with the colour's state
  var CROWS = 9, CROW_H = 60, NCHIP = 5, CARD_Y = 316, CARD_X = 719, ROW_Y = 222, ROW_X = 706, ROW_W = 847, COL_L = 367, INK = [0.05, 0.04, 0.07];
  function buildColours(ui) {
    var rt = H.node(ui, "Colours"); rt.anchorMin = UE.Vector2.zero; rt.anchorMax = UE.Vector2.one; rt.sizeDelta = UE.Vector2.zero; P.colRoot = rt;
    var side = H.node(rt, "Side"); at(side, 1000, 0, 1560, 1700); side.localEulerAngles = new UE.Vector3(0, 0, -14);
    var sv = side.gameObject.AddComponent(T(UI.RawImage)); sv.texture = UE.Texture2D.whiteTexture; sv.raycastTarget = false; sv.color = new UE.Color(0.016, 0.018, 0.04, 0.9);
    var C = { rt: rt, rows: [], card: [] };
    C.fx = H.node(rt, "Fx"); at(C.fx, 700, 440, 10, 10);
    C.title = T_(rt, "T_ColTitle", 80, [1, 1, 1], null, 3); at(C.title.rectTransform, COL_L + 450, 461, 900, 100); C.title.text = "COLOURS";
    C.title.alignment = cs.TMPro.TextAlignmentOptions.Left;
    C.sub = T_(rt, "T_ColSub", 30, [0.9, 0.88, 0.95], null, 1); at(C.sub.rectTransform, COL_L + 350, 386, 700, 40);
    C.sub.alignment = cs.TMPro.TextAlignmentOptions.Left;
    // the focused colour's card: its main colours large, each popping in when the cursor moves
    C.cardRt = H.node(rt, "Card"); at(C.cardRt, CARD_X, CARD_Y, 760, 66);
    for (var j = 0; j < NCHIP; j++) {
      var fr = raw(C.cardRt, "Chip" + j, H.col(INK), -310 + j * 155, 0, 141, 65);
      var inner = raw(fr.rectTransform, "C", new UE.Color(1, 1, 1, 1), 0, 0, 133, 57);
      C.card.push({ fr: fr, c: inner });
    }
    C.cardFx = H.node(C.cardRt, "Fx"); at(C.cardFx, 0, 0, 760, 66);
    for (var i = 0; i < CROWS; i++) {
      var b = H.button(rt, "Row" + i); at(b.rt, ROW_X, ROW_Y - i * CROW_H, ROW_W, CROW_H - 10);
      b.t.alignment = cs.TMPro.TextAlignmentOptions.Left; b.t.fontSize = 29; b.t.rectTransform.anchorMin = UE.Vector2.zero; b.t.rectTransform.anchorMax = UE.Vector2.one;
      b.t.rectTransform.offsetMin = new UE.Vector2(40, 0); b.t.rectTransform.offsetMax = new UE.Vector2(-262, 0); b.t.enableAutoSizing = true; b.t.fontSizeMax = 29; b.t.fontSizeMin = 22;
      b.t.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
      var chips = [];
      for (var q = 0; q < NCHIP; q++) { var cf = raw(b.rt, "Chip" + q, H.col(INK), 191 + q * 36, 0, 34, 34); chips.push({ fr: cf, c: raw(cf.rectTransform, "C", new UE.Color(1, 1, 1, 1), 0, 0, 28, 28) }); }
      C.rows.push({ b: b, chips: chips, off: 0, tgt: 0, ix: 0, g: group(b.rt) });
    }
    C.more = T_(rt, "T_ColMore", 26, [1, 1, 1], cs.TMPro.TextAlignmentOptions.Center, 0); at(C.more.rectTransform, ROW_X, ROW_Y - CROWS * CROW_H + 20, 300, 34);
    C.info = T_(rt, "T_ColInfo", 29, [1, 1, 1], null, 1); at(C.info.rectTransform, COL_L + 470, -351, 940, 56);
    C.info.alignment = cs.TMPro.TextAlignmentOptions.Left; C.info.enableAutoSizing = true; C.info.fontSizeMax = 29; C.info.fontSizeMin = 20;
    P.col = C;
    if (G.BB4LIT && G.BB4LIT.coBuild) G.BB4LIT.coBuild(C, S);   // the mockup's light (fourlight.js)
  }
  // a colour's chips: the palette maker's lit colours, the game's sprite-sheet colours, or the colour's one swatch
  function chipsOf(j) {
    var n = P.c.n[j]; if (n.__bbchips) return n.__bbchips;
    var cfg = n.cfg, out = [];
    try {
      if (cfg.__pal && G.BBPAL) { var p = G.BBPAL.decode(cfg.__pal.code); if (p) out = p.parts.filter(function (q) { return q.on; }).map(function (q) { return q.lit; }).slice(0, NCHIP); }
      if (!out.length && G.BB4CHIPS && G.BB4CHIPS[cfg.id]) out = G.BB4CHIPS[cfg.id].slice(0, NCHIP).map(unhex);
    } catch (e) {}
    if (!out.length) out = [colInfo(j).col];
    return (n.__bbchips = out);
  }
  function paintChips(list, cols, dim) {
    list.forEach(function (ch, k) {
      var c = cols[k], on = !!c; if (ch.fr.gameObject.activeSelf != on) ch.fr.gameObject.SetActive(on); if (!on) return;
      ch.c.color = new UE.Color(c[0], c[1], c[2], dim ? 0.4 : 1);
    });
  }
  // the card: each chip pops in, one after another (2 frames apart), fast in with a small overshoot
  function cardPop(cols) {
    var C = P.col; paintChips(C.card, cols, false);
    C.card.forEach(function (ch, k) { var r = ch.fr.rectTransform; anim("card" + k, k * 0.033, 0.2, function (t) { scl(r, 0.6 + 0.4 * easeBack(t)); }); });
  }
  // opening: the card and the rows slide in from the right one after another
  function colIntro() {
    var C = P.col;
    anim("cardIn", 0, 0.24, function (t) { group(C.cardRt).alpha = easeOut(t); });
    C.rows.forEach(function (r, k) { anim("rowIn" + k, 0.06 + k * 0.03, 0.22, function (t) { r.ix = 70 * (1 - easeOut(t)); r.g.alpha = easeOut(t); }); });
  }
  P.coloursOpen = async function (id) {
    var X = G.BB4SEL, p = S.pick; if (!X || !p || P.kind) return;
    P.kind = "colours-wait"; p.step = "colours"; P.col.top = 0; P.col.hero = id;
    var c = null; try { c = await X.colours(id); } catch (e) { log("colours: " + es(e)); }
    if (!c || P.kind != "colours-wait") { if (P.kind == "colours-wait") { P.kind = null; p.step = "hero"; P.sfx("sfx_ui_13"); H.toast("The wardrobe did not open"); } return; }
    // the wardrobe hands the same node objects to every hero: what was read for the last hero (chips, state, effect
    // tint) is dropped, or the next hero's colours showed the last one's chips
    c.n.forEach(function (x) { x.__bbchips = undefined; x.__bbi = undefined; x.__bbfx = undefined; });
    P.kind = "colours"; P.c = c; P.col.rows.forEach(function (r) { r.key = null; r.off = r.tgt = 0; }); P.col.lastI = -1; backdrop(false);
    // the v5 screen (fourcol5.js) draws the step when the v5 select is on; the older panel below stays as the fallback
    P.col5 = false; try { var C5 = G.BB4C5; if (C5 && C5.on(S) && C5.open(S, P, c)) P.col5 = true; } catch (e5) { log("colours v5: " + es(e5)); }
    if (P.col5) { P.colRoot.gameObject.SetActive(false); log("colours open (v5): " + c.n.length + " for " + id); return; }
    P.col.info.text = ""; P.col.openAt = UE.Time.unscaledTime; P.colRoot.gameObject.SetActive(true); P.colRoot.SetAsLastSibling(); colIntro();
    var f = X.fx(P.col.fx, "UI/Common/choosediff_intro_501w", 0, 0, 0.42, false); if (f) setTimeout(function () { X.kill(f); }, 1500);
    log("colours open: " + c.n.length + " for " + id);
  };
  // the worn colour on the card's line (the game has one portrait a hero, not one a colour): its swatch and name
  var WORN = {};
  P.wornTag = function (id) {
    var sk = 0; try { sk = require("GamePlay/AvatarUtil").SkinUtil.GetCurrentSkinId(id) | 0; } catch (e) {}
    if (!sk) return ""; if (WORN[id] && WORN[id].sk == sk) return WORN[id].s;
    var s = ""; try { var cfg = require("Gen/Xlsx").Xlsx.ClientSkinConf.Get(sk), inf = cfg ? G.BB4SEL.colourInfo(cfg) : null;
      if (inf && inf.name) s = "   <color=#" + hex(inf.col) + ">◆</color> " + inf.name; } catch (e) {}
    if (s) WORN[id] = { sk: sk, s: s }; return s;
  };
  // the lobby screen's own backdrop covers the room: off while the hero stands there in each colour
  function backdrop(on) { try { var b = S.ui.Find("Backdrop"); if (b && !b.Equals(null)) b.gameObject.SetActive(on); } catch (e) {} }
  P.backdrop = backdrop;
  function colInfo(i) { var c = P.c, n = c.n[i]; if (!n.__bbi) n.__bbi = G.BB4SEL.colourInfo(n.cfg); return n.__bbi; }
  // a colour that changes the hero's effects (testers, 2026-11-07: "easy to spot"): its own effect line
  // (ClientSkinConf.EffectSubPath, the effects rebuilt in its colours, as the stock 07 and 13 colours have) or an effect tint
  // (VfxTintColor, which the game's VFXMaterialMatchSkinColor lays over the effects that carry it; white changes nothing).
  // The palette maker's colours carry their tint in the palette (fx). line: true for an effect line; col: the tint
  function fxOf(i) {
    var n = P.c.n[i]; if (n.__bbfx !== undefined) return n.__bbfx;
    var cfg = n.cfg, r = null;
    try {
      if (cfg.__pal && G.BBPAL) { var pl = G.BBPAL.decode(cfg.__pal.code); if (pl && pl.fx) r = { line: false, col: pl.fx.slice(0, 3) }; }
      else {
        var line = !!String(cfg.effectSubPath || ""), h = String(cfg.vfxTintColor || "").replace("#", ""), col = null;
        if (h.length >= 6) { col = [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; if (col[0] + col[1] + col[2] > 2.95) col = null; }
        if (line || col) r = { line: line, col: col || [1, 1, 1] };
      }
    } catch (e) { r = null; }
    return (n.__bbfx = r);
  }
  // the mark after the name: a diamond in the effect colour, with FX beside it for a colour with its own effect line
  function fxMark(fx, foc) {
    if (!fx) return "";
    var c = fx.col, lit = [Math.max(c[0], 0.35), Math.max(c[1], 0.35), Math.max(c[2], 0.35)];
    return "   <size=24><color=#" + hex(foc ? [0.1, 0.08, 0.12] : lit) + ">" + (fx.line ? "◆ FX" : "◆") + "</color></size>";
  }
  var API5 = null;
  function api5() { return API5 || (API5 = { colInfo: colInfo, chipsOf: chipsOf, fxOf: fxOf, heroLabel: function () { return H.heroLabelOf(P.col.hero); }, toast: function (m) { H.toast(m); } }); }
  function drawColours() {
    if (P.col5) { G.BB4C5.frame(S, P, api5()); return; }
    var C = P.col, c = P.c, n = c.n.length, i = c.i, LT = G.BB4LIT && G.BB4LIT.coFrame ? G.BB4LIT : null, t = UE.Time.unscaledTime;
    if (LT) LT.coFrame(C, t);
    if (i < C.top) C.top = i; if (i > C.top + CROWS - 1) C.top = i - CROWS + 1; C.top = H.clamp(C.top, 0, Math.max(0, n - CROWS));
    C.sub.text = H.heroLabelOf(C.hero) + "  ·  " + (i + 1) + " / " + n;
    if (C.lastI != i) { C.lastI = i; C.popAt = t; cardPop(chipsOf(i)); }
    C.rows.forEach(function (r, k) {
      var j = C.top + k, show = j < n; if (r.b.rt.gameObject.activeSelf != show) r.b.rt.gameObject.SetActive(show); if (!show) return;
      var inf = colInfo(j), foc = j == i;
      H.lightBtn(r.b, foc, true);
      // the focused row stands out to the left (8 frames, fast in, slow out); the one it left goes back
      var tg = foc ? 1 : 0; if (r.tgt != tg) { var from = r.off; r.tgt = tg; anim("rowOff" + k, 0, 0.14, function (t) { r.off = from + (tg - from) * easeOut(t); }); }
      r.b.rt.anchoredPosition = new UE.Vector2(ROW_X - 12 * r.off + r.ix, ROW_Y - k * CROW_H);
      if (LT) LT.coRow(C, r, foc, t);
      var key = j + "|" + foc; if (r.key == key) return; r.key = key;
      var nm = inf.name || "Colour " + (j + 1), tag = !inf.owned ? (inf.dlc ? "DLC" : "LOCKED") : "";
      r.b.t.text = "<color=#" + hex(foc ? [0.1, 0.08, 0.12] : [0.72, 0.72, 0.78]) + ">" + (j + 1 < 10 ? "0" : "") + (j + 1) + "</color><pos=104>" + nm + fxMark(fxOf(j), foc) +
        (tag ? "      <size=22><color=#" + hex(foc ? [0.6, 0.3, 0.04] : inf.dlc ? GOLD : RED) + ">" + tag + "</color></size>" : "");
      paintChips(r.chips, chipsOf(j), !inf.owned);
    });
    C.more.text = n > CROWS ? (C.top + CROWS < n ? "▼" : "▲") : "";
    var inf2 = colInfo(i);
    var fx2 = fxOf(i), fxs = fx2 ? "   <color=#" + hex(GOLD) + ">" + (fx2.line ? "◆ This colour has its own effects." : "◆ This colour tints the effects.") + "</color>" : "";
    C.info.text = (inf2.owned ? "<color=#" + hex(GOLD) + ">You own this colour.</color> Choose it to wear it." : inf2.why) + fxs;
  }
  function colMove(dy) { var c = P.c, n = c.n.length; if (!dy) return; var j = (c.i + (dy > 0 ? -1 : 1) + n) % n; G.BB4SEL.colourPick(c, j); }
  async function colEnd(wear) {
    var c = P.c, p = S.pick; if (!c) return;
    if (P.col5) { try { G.BB4C5.close(); } catch (e5) { } P.col5 = false; }
    P.kind = "colours-closing"; P.colRoot.gameObject.SetActive(false); backdrop(true);
    await G.BB4SEL.coloursEnd(c, wear);
    P.kind = null; P.c = null; if (p) p.step = "hero"; S.sel.backKey = null;
    if (S.solo) S.soloBack(true);
  }
  function colPress() {
    if (P.col5 && G.BB4C5.pressFirst(P)) { P.sfx("sfx_ui_36"); return; }   // the worn colour was being shown: back to the pick
    var c = P.c, inf = colInfo(c.i), cfg = c.n[c.i].cfg;
    if (P.col5) { if (inf.owned) G.BB4C5.flash(); else G.BB4C5.shake(); }
    if (inf.owned) {                                      // worn: the row and the card flash, then the panel closes
      log("colours: wear " + cfg.id); P.kind = "colours-wearing";
      var r = P.col.rows[c.i - P.col.top]; if (r) fxAt(r.b.rt, "UI/Common/chaosscheduleunlock_complete", 0, 0, 0.7, 0, 0, 1.6);
      fxAt(P.col.cardFx, "UI/Common/choosediff_intro_501w", 0, 0, 0.45, 0, 0, 1.4); P.sfx("sfx_ui_55");
      P.col.card.forEach(function (ch, k) { var rr = ch.fr.rectTransform; anim("card" + k, k * 0.025, 0.22, function (t) { scl(rr, 1.18 - 0.18 * easeOut(t)); }); });
      setTimeout(function () { if (P.kind == "colours-wearing") { P.kind = "colours"; colEnd(true); } }, 420);
      return;
    }
    if (inf.dlc && G.BB4SEL.colourDlc(cfg)) return;
    var rl = P.col.rows[c.i - P.col.top]; if (rl) anim("rowShake" + (c.i - P.col.top), 0, 0.3, function (t) { rl.ix = 12 * Math.sin(t * 28) * (1 - t); });   // refused: a short shake that dies out
    P.sfx("sfx_ui_13"); H.toast(inf.why);
  }

  // ---- Mind Crystals ----
  // the layout of the approved mockup (local_only/redux/v4shots/gpt/mock_crystals): six slanted rows on the left, a 7 x 6 grid
  // on the right, the focused crystal in a hex inside a slanted panel under the grid
  var CR_TINT = [0.2, 0.34, 1, 0.42], CR_COLS = 7, CR_ROWS = 6, CR_DX = 119, CR_DY = 90, CR_TOP = 278, CR_X = 413, SL_X = -610, SL_Y = 272, SL_DY = 102;
  function buildCrystals(ui) {
    var rt = H.node(ui, "Crystals"); rt.anchorMin = UE.Vector2.zero; rt.anchorMax = UE.Vector2.one; rt.sizeDelta = UE.Vector2.zero; P.crRoot = rt;
    var R = { rt: rt, slots: [], cells: [] };
    R.veil = veil(rt, 0.92); R.veil.color = new UE.Color(0.012, 0.018, 0.06, 0.92);
    R.bg = H.node(rt, "BgFx"); at(R.bg, -560, -20, 10, 10);
    H.stencilClear(rt, "StencilClear");   // the slab masks with a stencil it never clears
    R.fx = H.node(rt, "Fx"); at(R.fx, -560, 400, 10, 10);
    R.title = T_(rt, "T_CrTitle", 72, [1, 1, 1], null, 3); at(R.title.rectTransform, -487, 462, 900, 90); R.title.text = "MIND CRYSTALS";
    R.sub = T_(rt, "T_CrSub", 26, [0.84, 0.82, 0.9], null, 0); at(R.sub.rectTransform, -465, 398, 900, 36);
    var sh = T_(rt, "T_SlotHead", 22, GOLD, null, 3); at(sh.rectTransform, -660, 341, 500, 30); R.slotHead = sh; sh.text = "EQUIPPED";
    for (var i = 0; i < 6; i++) {
      var b = H.button(rt, "Slot" + i); at(b.rt, SL_X, SL_Y - i * SL_DY, 720, 88); b.t.text = "";
      var ic = img(b.rt, "Icon", null); at(ic.rectTransform, -226, 0, 70, 70);
      var nm = T_(b.rt, "T_Name", 28, [1, 1, 1], null, 3); at(nm.rectTransform, 74, 15, 460, 38);
      nm.enableAutoSizing = true; nm.fontSizeMax = 28; nm.fontSizeMin = 16; nm.overflowMode = cs.TMPro.TextOverflowModes.Ellipsis;
      var lv = T_(b.rt, "T_Lv", 20, DIM, null, 0); at(lv.rectTransform, 74, -20, 460, 28);
      var no = T_(b.rt, "T_No", 28, [1, 1, 1], cs.TMPro.TextAlignmentOptions.Center, 3); at(no.rectTransform, -316, 0, 70, 40);
      R.slots.push({ b: b, ic: ic, nm: nm, lv: lv, no: no });
    }
    var lh = T_(rt, "T_ListHead", 22, GOLD, null, 3); at(lh.rectTransform, 350, 345, 700, 30); R.listHead = lh;
    var grid = H.node(rt, "Grid"); at(grid, CR_X, CR_TOP - (CR_ROWS - 1) * CR_DY / 2, 10, 10); R.grid = grid;
    for (var c = 0; c < CR_COLS * CR_ROWS; c++) {
      var cb = H.button(grid, "Cr" + c); cb.t.text = "";
      at(cb.rt, (c % CR_COLS - (CR_COLS - 1) / 2) * CR_DX, ((CR_ROWS - 1) / 2 - Math.floor(c / CR_COLS)) * CR_DY, 98, 82);
      var ci = img(cb.rt, "Icon", null); at(ci.rectTransform, 0, 7, 60, 60);
      var tg = T_(cb.rt, "T_Tag", 16, GOLD, cs.TMPro.TextAlignmentOptions.Center, 3); at(tg.rectTransform, 0, -29, 90, 20);
      R.cells.push({ b: cb, ic: ci, tg: tg });
    }
    R.rail = H.rail(grid, "Rail", (CR_COLS - 1) / 2 * CR_DX + 49 + 24, 0, (CR_ROWS - 1) * CR_DY + 82);
    // the focused crystal large, inside the crystal screen's own hex loop; level-ups and unlocks play here
    R.big = H.node(rt, "Big"); at(R.big, -64, -330, 150, 150);
    R.bigLoop = H.node(R.big, "Loop"); at(R.bigLoop, 0, 0, 150, 150);
    R.bigIc = img(R.big, "Icon", null); at(R.bigIc.rectTransform, 0, 0, 116, 116);
    R.bigFx = H.node(R.big, "Fx"); at(R.bigFx, 0, 0, 150, 150);
    R.stars = T_(rt, "T_Stars", 26, GOLD, cs.TMPro.TextAlignmentOptions.Center, 0); at(R.stars.rectTransform, -64, -424, 130, 30);
    R.riseBar = raw(rt, "RiseBar", new UE.Color(0.03, 0.02, 0.05, 0), -64, -330, 230, 42); R.riseBarG = group(R.riseBar.rectTransform);
    R.rise = T_(rt, "T_Rise", 34, GOLD, cs.TMPro.TextAlignmentOptions.Center, 3); at(R.rise.rectTransform, -64, -330, 360, 44); R.rise.text = "";
    R.dname = T_(rt, "T_DName", 38, [1, 1, 1], null, 3); at(R.dname.rectTransform, 441, -272, 680, 48);
    R.desc = T_(rt, "T_Desc", 22, [0.88, 0.86, 0.94], null, 0); at(R.desc.rectTransform, 441, -338, 680, 70); R.desc.enableWordWrapping = true;
    R.cost = T_(rt, "T_Cost", 21, DIM, null, 0); at(R.cost.rectTransform, 441, -400, 680, 44); R.cost.enableWordWrapping = true;
    R.slotG = R.slots.map(function (s) { return group(s.b.rt); }); R.gridG = group(grid);
    P.cr = R;
    if (G.BB4LIT && G.BB4LIT.crBuild) G.BB4LIT.crBuild(R, S);   // the mockup's light (fourlight.js)
  }
  function crLoad() { var R = P.cr; R.d = G.BB4SEL.crystals(); R.byId = {}; R.d.list.forEach(function (c) { R.byId[c.Id] = c; }); R.key = null; }
  P.crystalsOpen = function () {
    var X = G.BB4SEL, p = S.pick; if (!X || !p || P.kind) return;
    if (!X.crystalOpen()) { P.sfx("sfx_ui_13"); H.toast("Mind Crystals open later in the story"); return; }
    P.kind = "crystals"; p.step = "crystals"; backdrop(false); var R = P.cr; crLoad(); R.zone = "slots"; R.si = 0; R.ci = 0; R.top = 0; R.busy = false;
    var first = R.d.slots.findIndex(function (s) { return s.open && s.id; }); if (first >= 0) R.si = first;
    P.crRoot.gameObject.SetActive(true); P.crRoot.SetAsLastSibling(); R.slots.forEach(function (s) { s.key = null; }); R.cells.forEach(function (c) { c.key = null; });
    // the opening burst in the crystals' blue: untinted it plays red; its parts come in a frame or two after the play, so tinted each frame for 0.6 s
    var f = X.fx(R.fx, "UI/Common/choosediff_intro_501b", 0, 0, 0.6, false);
    if (f) { var tEnd = UE.Time.unscaledTime + 0.6, ti = setInterval(function () { X.tint(f, [0.32, 0.45, 1], 0.85); if (UE.Time.unscaledTime > tEnd) clearInterval(ti); }, 0); setTimeout(function () { clearInterval(ti); X.kill(f); }, 1500); }
    // the room and the large crystal's hex are fourlight.js's light now; the stock band behind the rows and the hex loop
    // (its grey arms reach out of the hex) only when that light is missing
    R.loop = X.kill(R.loop); R.ring = X.kill(R.ring);
    if (!R.lit) { R.loop = X.fx(R.bg, "UI/Common/role_selection_004", 0, 0, 1.0, true); R.loopTill = UE.Time.unscaledTime + 0.7; R.ring = fxAt(R.bigLoop, "UI/Common/consciousequip_501_loop", 0, 0, 1, 130, 130, -1); }
    R.dkey = null; R.bigKey = null; R.rise.text = ""; R.hold = false; R.seq = false; R.openAt = UE.Time.unscaledTime;
    // in: the slots from the left one after another, the grid and the large crystal after them
    R.slots.forEach(function (s, k) { var g = R.slotG[k]; anim("slotIn" + k, 0.05 + k * 0.035, 0.24, function (t) { g.alpha = easeOut(t); s.b.rt.anchoredPosition = new UE.Vector2(SL_X - 80 * (1 - easeOut(t)), SL_Y - k * SL_DY); }); });
    anim("gridIn", 0.12, 0.3, function (t) { R.gridG.alpha = easeOut(t); scl(R.grid, 0.94 + 0.06 * easeOut(t)); });
    anim("bigIn", 0.22, 0.3, function (t) { scl(R.big, 0.6 + 0.4 * easeBack(t)); });
    P.sfx("sfx_ui_53"); log("Mind Crystals open: level " + R.d.level + ", " + R.d.list.length + " crystals");
  };
  function crClose() { var p = S.pick; P.cr.loop = G.BB4SEL.kill(P.cr.loop); P.cr.ring = G.BB4SEL.kill(P.cr.ring); P.crRoot.gameObject.SetActive(false); backdrop(true); P.kind = null; if (p) p.step = "hero"; S.sel.backKey = null; P.sfx("sfx_ui_36"); if (S.sel) S.refx && S.refx(S.sel); }
  function crFocus() { var R = P.cr; if (R.zone == "slots") { var s = R.d.slots[R.si]; return s && s.id ? R.byId[s.id] || null : null; } return R.d.list[R.ci] || null; }
  function stars(lv) { var s = ""; for (var i = 0; i < 3; i++) s += i < lv ? "<color=#" + hex(GOLD) + ">◆</color>" : "<color=#4a4658>◆</color>"; return s; }
  function drawCrystals() {
    var R = P.cr, d = R.d, X = G.BB4SEL, LT = G.BB4LIT && G.BB4LIT.crFrame ? G.BB4LIT : null, t = UE.Time.unscaledTime, settled = t - (R.openAt || 0) > 0.5;
    if (LT) LT.crFrame(R, t);
    if (R.loop && R.loopTill && UE.Time.unscaledTime < R.loopTill) X.tint(R.loop, CR_TINT, CR_TINT[3]);   // its parts arrive over a few frames
    R.sub.text = "Mind Crystal level " + d.level + (d.attr ? "   ·   " + d.attr : "");
    R.slots.forEach(function (s, k) {
      var sl = d.slots[k]; if (!sl) { s.b.rt.gameObject.SetActive(false); return; }
      var foc = R.zone == "slots" && k == R.si, tgt = R.zone == "list" && k == R.si;
      H.lightBtn(s.b, foc || tgt, true); if (tgt) H.setA(s.b.on, 0.45);
      if (LT) LT.crRow(R, s, foc ? 1 : tgt ? 0.6 : 0, t, settled);
      var c = sl.id ? R.byId[sl.id] : null, key = sl.id + "|" + sl.open + "|" + (c ? c.Level : 0) + "|" + (foc || tgt);
      if (s.key == key) return; s.key = key;
      s.no.text = ["I", "II", "III", "IV", "V", "VI"][k];
      var ink = foc || tgt ? new UE.Color(0.08, 0.06, 0.1, 1) : new UE.Color(1, 1, 1, 1);
      if (!sl.open) { s.ic.gameObject.SetActive(false); s.nm.text = "Locked"; s.nm.color = foc ? ink : H.col(DIM); s.lv.text = "Opens at Mind Crystal level " + sl.at; return; }
      var sp = sl.id ? X.crystalIcon(sl.id) : null; s.ic.sprite = sp; s.ic.gameObject.SetActive(!!sp); s.ic.color = foc || tgt ? ink : new UE.Color(1, 1, 1, 1);
      s.nm.text = sl.id ? X.crystalName(sl.id) : "Empty"; s.nm.color = sl.id ? ink : (foc || tgt ? ink : H.col(DIM));
      s.lv.text = sl.id && c ? stars(c.Level) + "   Level " + c.Level + " / 3" : "Choose a crystal for this slot";
    });
    var n = d.list.length, rows = Math.ceil(n / CR_COLS), r = Math.floor(R.ci / CR_COLS);
    if (r < R.top) R.top = r; if (r > R.top + CR_ROWS - 1) R.top = r - CR_ROWS + 1; R.top = H.clamp(R.top, 0, Math.max(0, rows - CR_ROWS));
    H.railSet(R.rail, R.top, rows, CR_ROWS);
    var slotId = {}; d.slots.forEach(function (s) { if (s.id) slotId[s.id] = s.n; });
    R.cells.forEach(function (cl, k) {
      var j = R.top * CR_COLS + k, show = j < n; if (cl.b.rt.gameObject.activeSelf != show) cl.b.rt.gameObject.SetActive(show); if (!show) return;
      var c = d.list[j], foc = R.zone == "list" && j == R.ci;
      H.lightBtn(cl.b, foc, true); if (LT) LT.crCell(R, cl, foc, t);
      var key = c.Id + "|" + c.Level + "|" + !!slotId[c.Id] + "|" + foc; if (cl.key == key) return; cl.key = key;
      var sp = X.crystalIcon(c.Id); cl.ic.sprite = sp; cl.ic.gameObject.SetActive(!!sp);
      cl.ic.color = foc ? new UE.Color(0.08, 0.06, 0.1, 1) : c.Lock ? new UE.Color(0.32, 0.3, 0.38, 1) : new UE.Color(1, 1, 1, 1);
      cl.tg.text = c.Lock ? (c.TaskFinsh ? "READY" : "LOCKED") : slotId[c.Id] ? "IN " + ["I", "II", "III", "IV", "V", "VI"][(slotId[c.Id] | 0) - 1] : stars(c.Level);
      cl.tg.color = foc ? new UE.Color(0.25, 0.12, 0.05, 1) : H.col(c.Lock ? (c.TaskFinsh ? [0.56, 0.89, 0.6] : DIM) : GOLD);
    });
    R.listHead.text = R.zone == "list" ? "CHOOSE FOR SLOT " + ["I", "II", "III", "IV", "V", "VI"][R.si] : "EVERY CRYSTAL";
    var f = crFocus(), fk = f ? f.Id + "|" + f.Level + "|" + f.Lock : "none";
    // the large crystal follows the focus: a new crystal pops in with the screen's select light
    var bk = f ? f.Id : 0;
    if (R.bigKey !== bk) {
      R.bigKey = bk; var sp = f ? X.crystalIcon(f.Id) : null; R.bigIc.sprite = sp; R.bigIc.gameObject.SetActive(!!sp);
      if (sp) anim("bigPop", 0, 0.18, function (t) { scl(R.bigIc.rectTransform, 0.7 + 0.3 * easeBack(t)); });
    }
    if (!R.seq) {
      R.bigIc.color = f && f.Lock ? new UE.Color(0.3, 0.28, 0.36, 1) : new UE.Color(1, 1, 1, 1);
      R.stars.text = f && !f.Lock ? stars(f.Level) : f ? "<color=#" + hex(DIM) + ">LOCKED</color>" : "";
    }
    if (R.dkey != fk && !R.hold) {
      R.dkey = fk;
      if (!f) { var sl = d.slots[R.si]; R.dname.text = sl && !sl.open ? "Locked slot" : "Empty slot"; R.desc.text = sl && !sl.open ? "Raise your Mind Crystal level to " + sl.at + " in the Mind Training room to open it." : "Choose this slot, then a crystal."; R.cost.text = ""; }
      else {
        R.dname.text = X.crystalName(f.Id) + (f.Lock ? "" : "   <size=24>" + stars(f.Level) + "</size>");
        try { R.desc.text = String(f.Lock || f.MaxLevel ? f.GetDesc() : f.GetDescWithNextLevel()); } catch (e) { R.desc.text = ""; }
        if (f.Lock) R.cost.text = "<color=#" + hex(GOLD) + ">To unlock:</color> " + X.crystalCond(f) + "   ·   " + X.costText(f.Conf.cost);
        else if (f.MaxLevel) R.cost.text = "<color=#" + hex(GOLD) + ">Highest level</color>";
        else { var nx = null; try { nx = require("Gen/Xlsx").Xlsx.ConsciousCrystalConf.Get(f.Id, f.Level + 1, require("DataBinding").DB.PlatformXlsxVal.Value); } catch (e) {} R.cost.text = nx ? "<color=#" + hex(GOLD) + ">Next level:</color> " + X.costText(nx.cost) : ""; }
      }
    }
  }
  function crMove(dx, dy) {
    var R = P.cr, d = R.d;
    if (R.zone == "slots") { if (dy) R.si = (R.si + (dy > 0 ? -1 : 1) + d.slots.length) % d.slots.length; else if (dx > 0) { R.zone = "list"; R.pickFor = -1; } P.sfx("sfx_ui_51"); return; }
    var n = d.list.length;
    if (dx < 0 && R.ci % CR_COLS == 0 && R.pickFor < 0) { R.zone = "slots"; P.sfx("sfx_ui_51"); return; }
    if (dy) R.ci = H.clamp(R.ci + (dy > 0 ? -CR_COLS : CR_COLS), 0, n - 1); else R.ci = (R.ci + dx + n) % n;
    P.sfx("sfx_ui_51");
  }
  function flash(rt) { var X = G.BB4SEL, f = X.fx(rt, "UI/Common/chaosscheduleunlock_complete", 0, 0, 0.7, false); if (f) setTimeout(function () { X.kill(f); }, 1800); }
  // equipped: the confirm flash on the slot, the crystal screen's small unlock hex on its crystal, the crystal pops in
  function equipFx(slotK) {
    var R = P.cr, s = R.slots[slotK]; if (!s) return;
    flash(s.b.rt); fxAt(s.ic.rectTransform, "UI/Common/consciousequip_unlock_small", 0, 0, 0.8, 76, 76, 1.2);
    anim("slotPop" + slotK, 0, 0.22, function (t) { scl(s.ic.rectTransform, 1.4 - 0.4 * easeOut(t)); });
  }
  // a level gained: the burst on the crystal (frame 0), the crystal screen's hex flash on the large one as the climax
  // (its peak about frame 30, the crystal punches in under it), the new star with its glint and the title's new stars
  // (frame 33), the new level rises over the large crystal (frame 36) and fades by 1.5 s
  function levelSeq(cellRt, lv) {
    var R = P.cr; R.seq = true; R.hold = true;
    G.BB4SEL.sfx("sfx_ui_levelup1--02");
    if (cellRt) hideParts(fxAt(cellRt, "UI/Common/consciousequip_levelup", 0, 6, 1, 88, 88, 1.6), ["sweep", "delay_hp++ (1)"]);   // its sweep spans the phone screen's whole list
    fxAt(R.bigFx, "UI/Common/consciouslevelup_501", 0, 0, 0.22, 0, 0, 1.6);
    anim("bigPop", 0.45, 0.3, function (t) { scl(R.bigIc.rectTransform, 1.3 - 0.3 * easeOut(t)); });
    setTimeout(function () {
      R.stars.text = stars(lv); R.dkey = null; R.hold = false;                // the title's stars and level line change with the star
      fxAt(R.stars.rectTransform, "UI/Common/consciouslevelup_starappear_501", (lv - 2) * 26, 0, 0.6, 0, 0, 1.2);
      anim("starPop", 0, 0.24, function (t) { scl(R.stars.rectTransform, 1.6 - 0.6 * easeOut(t)); });
    }, 550);
    riseText("LEVEL " + lv, 0.6);
    setTimeout(function () { R.seq = false; }, 1500);
  }
  // unlocked: the screen's unlock on the crystal, its second level-up light on the large one, the crystal lights up from dark
  function unlockSeq(cellRt) {
    var R = P.cr; R.seq = true; G.BB4SEL.sfx("sfx_ui_12");
    if (cellRt) fxAt(cellRt, "UI/Common/consciousequip_unlock_501", 0, 6, 1, 88, 88, 1.8);
    var f2 = fxAt(R.bigFx, "UI/Common/consciouslevelup_502", 0, 0, 0.3, 0, 0, 1.8);
    if (f2) anim("unlockTint", 0, 0.5, function () { G.BB4SEL.tint(f2, CR_TINT, 0.5); });       // the screen's pink taken half way to the panel's blue
    anim("bigLight", 0.08, 0.4, function (t) { var v = 0.3 + 0.7 * easeOut(t); R.bigIc.color = new UE.Color(v, v, v + 0.06 * (1 - t), 1); scl(R.bigIc.rectTransform, 1.25 - 0.25 * easeOut(t)); });
    riseText("UNLOCKED", 0.35);
    setTimeout(function () { R.stars.text = stars(1); R.seq = false; }, 600);
  }
  function riseText(s, delay) {
    var R = P.cr, t0 = R.rise.rectTransform, br = R.riseBar.rectTransform; R.rise.text = s; R.riseBar.color = new UE.Color(0.03, 0.02, 0.05, 0.82);
    anim("riseBar", delay, 0.95, function (t) {                    // opens sideways in 6 frames, rides with the words, fades with them
      br.localScale = new UE.Vector3(easeOut(Math.min(1, t * 10)), 1, 1); br.anchoredPosition = new UE.Vector2(40, -420 + 30 * easeOut(t));
      R.riseBarG.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    });
    anim("rise", delay, 0.95, function (t) { t0.anchoredPosition = new UE.Vector2(40, -420 + 30 * easeOut(t)); R.rise.alpha = t < 0.6 ? Math.min(1, t * 8) : 1 - (t - 0.6) / 0.4; scl(t0, 1.25 - 0.25 * easeOut(Math.min(1, t * 4))); });
  }
  async function crSend(map, what, slotK) {
    var R = P.cr, old = {}, cur = R.d.slots; cur.forEach(function (s) { old[s.n] = s.id; });
    R.busy = true; var ok = await G.BB4SEL.crystalSlots(map); R.busy = false;
    if (!ok) { P.sfx("sfx_ui_13"); H.toast("The game did not take that change"); crLoad(); return; }
    G.BB4SEL.crystalEquipFlags(old, map); crLoad(); P.sfx(what == "off" ? "sfx_ui_41" : "sfx_ui_09"); if (slotK != null && slotK >= 0 && what != "off") equipFx(slotK);
    log("Mind Crystals " + what + ": " + JSON.stringify(map));
  }
  function mapNow() { var m = {}; P.cr.d.slots.forEach(function (s) { if (s.open && s.id) m[s.n] = s.id; }); return m; }
  function crPress() {
    var R = P.cr, d = R.d; if (R.busy) return;
    if (R.zone == "slots") {
      var sl = d.slots[R.si]; if (!sl.open) { P.sfx("sfx_ui_13"); H.toast("Opens at Mind Crystal level " + sl.at); return; }
      R.zone = "list"; R.pickFor = R.si; var j = sl.id ? d.list.findIndex(function (c) { return c.Id == sl.id; }) : -1; if (j >= 0) R.ci = j; P.sfx("sfx_ui_53"); return;
    }
    var c = d.list[R.ci]; if (!c) return;
    if (c.Lock) { P.sfx("sfx_ui_13"); H.toast(c.TaskFinsh ? "Unlock it first with X" : "Locked. " + G.BB4SEL.crystalCond(c)); return; }
    var m = mapNow(), target = R.pickFor >= 0 ? d.slots[R.pickFor] : null, inSlot = null;
    for (var k in m) if (m[k] == c.Id) inSlot = k;
    if (!target) {                                                 // straight from the list: off if it is in, else the first free open slot
      if (inSlot) { delete m[inSlot]; crSend(m, "off"); return; }
      var free = d.slots.filter(function (s) { return s.open && !m[s.n]; })[0];
      if (!free) { P.sfx("sfx_ui_13"); H.toast("Every open slot is taken: choose a slot first"); return; }
      m[free.n] = c.Id; crSend(m, "on", d.slots.indexOf(free)); return;
    }
    if (inSlot == target.n) { delete m[inSlot]; crSend(m, "off"); R.zone = "slots"; return; }
    if (inSlot) { if (m[target.n]) m[inSlot] = m[target.n]; else delete m[inSlot]; }   // from another slot: the two trade places
    m[target.n] = c.Id; crSend(m, "on", R.pickFor); R.zone = "slots";
  }
  async function crUpgrade() {
    var R = P.cr, c = crFocus(), X = G.BB4SEL; if (!c || R.busy) return;
    if (c.MaxLevel) { P.sfx("sfx_ui_13"); H.toast("Already at its highest level"); return; }
    if (c.Lock && !c.TaskFinsh) { P.sfx("sfx_ui_13"); H.toast("Locked: " + X.crystalCond(c)); return; }
    if (!c.ResEnough) { P.sfx("sfx_ui_13"); H.toast("Not enough to " + (c.Lock ? "unlock" : "level up")); return; }
    R.busy = true; var ok = c.Lock ? await X.crystalUnlock(c) : await X.crystalLevelUp(c); R.busy = false;
    if (!ok) { P.sfx("sfx_ui_13"); H.toast("The game did not take that"); return; }
    log("Mind Crystal " + c.Id + (c.Lock ? " unlocked" : " to level " + (c.Level + 1)));
    H.toast(X.crystalName(c.Id) + (c.Lock ? " unlocked" : " is level " + (c.Level + 1)));
    var was = c.Lock, lv = c.Level + 1, cell = R.zone == "list" ? R.cells[R.ci - R.top * CR_COLS] : null, rt = cell ? cell.b.rt : R.slots[R.si].b.rt;
    crLoad(); if (was) unlockSeq(rt); else levelSeq(rt, lv);
  }

  // ---- what the screen calls ----
  P.sfx = function (id) { if (G.BB4SEL) G.BB4SEL.sfx(id); };
  P.active = function () { return !!P.kind; };
  P.draw = function () {
    if (!S || !P.ui || P.ui.Equals(null)) return;
    P.ui.SetAsLastSibling(); if (S.promptT) S.promptT.SetAsLastSibling(); if (S.toast) S.toast.transform.SetAsLastSibling();
    runAnims();
    if (P.kind == "colours" && P.c) drawColours();
    if (P.kind == "crystals") drawCrystals();
  };
  P.move = function (dx, dy) { if (P.kind == "colours") { if (P.col5) G.BB4C5.move(P, api5(), dx, dy); else colMove(dy || -dx); } else if (P.kind == "crystals") crMove(dx, dy); };
  P.press = function () { if (P.kind == "colours") colPress(); else if (P.kind == "crystals") crPress(); };
  P.back = function () {
    if (P.kind == "colours") { log("colours: back"); colEnd(false); return; }
    if (P.kind == "crystals") { var R = P.cr; if (R.zone == "list" && R.pickFor >= 0) { R.zone = "slots"; P.sfx("sfx_ui_36"); return; } crClose(); return; }
  };
  P.act = function (a) {
    if (P.kind == "colours" && P.col5 && a == "movie") { G.BB4C5.peek(P, api5()); return true; }   // X (30): what is worn now, and back
    if (P.kind == "crystals" && a == "movie") { crUpgrade(); return true; }        // X (30) in the panel
    if (P.kind == "crystals" && a == "crystals") { crClose(); return true; }
    return !!P.kind;                                               // other buttons wait while a panel is open
  };
  P.page = function (d) { if (P.kind == "colours" && P.col5) { G.BB4C5.tab(P, api5(), d < 0 ? -1 : 1); return; } if (P.kind == "crystals") { var R = P.cr; R.zone = R.zone == "slots" ? "list" : "slots"; R.pickFor = -1; P.sfx("sfx_ui_51"); } };
  P.prompts = function () {
    if (P.kind == "colours" && P.c && P.col5) return G.BB4C5.prompts(P, api5());
    if (P.kind == "colours" && P.c) { var inf = colInfo(P.c.i); return [[9, inf.owned ? "Wear" : inf.dlc ? "DLC" : "Locked"], [10, "Back"]]; }
    if (P.kind == "crystals") {
      var R = P.cr, f = crFocus(), it = [[9, R.zone == "slots" ? "Choose slot" : R.pickFor >= 0 ? "Put in slot" : "Equip / remove"], [10, "Back"], [16, "", 17, R.zone == "slots" ? "Crystals" : "Slots"]];
      if (f && !f.MaxLevel && (!f.Lock || f.TaskFinsh)) it.push([30, f.Lock ? "Unlock" : "Level up"]);   // 30 is the Video button of the select, pad X / key X
      return it;
    }
    return [[10, "Back"]];
  };
  P.mouse = function (mp, click, wheel, moved, over) {
    if (P.kind == "colours" && P.c && P.col5) { G.BB4C5.mouse(P, api5(), mp, click, wheel, moved, over); return; }
    if (P.kind == "colours" && P.c) {
      if (wheel) colMove(wheel > 0 ? 1 : -1);
      if (!moved && !click) return;
      P.col.rows.forEach(function (r, k) { if (r.b.rt.gameObject.activeSelf && over(r.b.rt, mp)) { var j = P.col.top + k; if (j != P.c.i) G.BB4SEL.colourPick(P.c, j); if (click) colPress(); } });
      return;
    }
    if (P.kind == "crystals") {
      var R = P.cr;
      if (wheel) crMove(0, wheel > 0 ? -1 : 1);   // the wheel steps the slot list or the grid a row, as the pad does
      if (!moved && !click) return;
      R.slots.forEach(function (s, k) { if (s.b.rt.gameObject.activeSelf && over(s.b.rt, mp)) { if (R.zone != "slots" || R.si != k) { R.zone = "slots"; R.si = k; } if (click) crPress(); } });
      R.cells.forEach(function (cl, k) { if (cl.b.rt.gameObject.activeSelf && over(cl.b.rt, mp)) { var j = R.top * CR_COLS + k; if (R.zone != "list") { R.zone = "list"; R.pickFor = -1; } R.ci = j; if (click) crPress(); } });
    }
  };
  // a scripted check plays the sequences on the focused crystal without asking the game (no change to the save)
  P.fxTest = function (what) {
    var R = P.cr; if (P.kind != "crystals") return "crystals not open";
    var cell = R.zone == "list" ? R.cells[R.ci - R.top * CR_COLS] : null, rt = cell ? cell.b.rt : R.slots[R.si].b.rt;
    if (what.indexOf("block") == 0) return P.blockout(what == "block" ? "level" : what.slice(5));
    if (what == "unlock") unlockSeq(rt); else if (what == "equip") equipFx(R.si); else levelSeq(rt, 2);
    return "played " + (what || "level");
  };
  // the grey block-out of the chained level-up, unlock and equip (HERO_SELECT_V4.md 9.10, direction A, the lead
  // 2026-11-02): white stand-in shapes on the timing sheet, frames at 60 from the press, nothing asked of the game.
  // Art (consciouslevelup_501/502, consciousslotlevelup_501, consciousslotequip_501, consciousequip_unlock_501) waits
  // for the lead's yes on the rhythm.
  //   cell glow 0/2/6 · cell burst 2/4/14 · streak 4/8/12 · big flare 12/13/15, glow creeps and goes by 40
  //   pips 14, 17, 20 held · numbers 14 to 22 held · "LEVEL n" 16/20/60 · unlock beat by frame 3 · rest loop after 60
  function boNodes() {
    var R = P.cr; if (R.bo) return R.bo;
    var W = new UE.Color(1, 1, 1, 0), b = { rt: H.node(R.rt, "BlockOut") };
    at(b.rt, 0, 0, 10, 10);
    b.glow = raw(b.rt, "Glow", W, 0, 0, 92, 92); b.burst = raw(b.rt, "Burst", W, 0, 0, 92, 92);
    b.streak = raw(b.rt, "Streak", W, 0, 0, 10, 8); b.streak.rectTransform.pivot = new UE.Vector2(0, 0.5);
    b.flash = raw(b.rt, "Flash", W, 0, 0, 130, 130); b.flare = raw(b.rt, "Flare", W, 0, 0, 130, 130); b.rest = raw(b.rt, "Rest", W, 0, 0, 150, 150);
    b.pips = [0, 1, 2].map(function (i) { return raw(b.rt, "Pip" + i, W, 0, 0, 16, 16); });
    b.num = T_(b.rt, "T_BoNum", 30, [1, 1, 1], cs.TMPro.TextAlignmentOptions.Center, 3); at(b.num.rectTransform, 400, -500, 300, 40);
    b.lvl = T_(b.rt, "T_BoLvl", 24, [1, 1, 1], cs.TMPro.TextAlignmentOptions.Center, 3); at(b.lvl.rectTransform, 0, 0, 150, 32);
    return (R.bo = b);
  }
  function boA(r, a) { var c = r.color; c.a = Math.max(0, Math.min(1, a)); r.color = c; }
  function boRamp(f, a, b) { return Math.max(0, Math.min(1, (f - a) / (b - a))); }   // 0 at frame a, 1 at frame b
  P.blockout = function (kind, lv) {
    var R = P.cr; if (P.kind != "crystals") return "crystals not open";
    kind = kind || "level"; lv = lv || 3;
    var b = boNodes(), cell = R.zone == "list" ? R.cells[R.ci - R.top * CR_COLS] : null, src = kind == "equip" ? R.slots[R.si].ic.rectTransform : cell ? cell.b.rt : R.slots[R.si].b.rt;
    b.rt.gameObject.SetActive(true); b.rt.SetAsLastSibling();
    var p0 = R.rt.InverseTransformPoint(src.position), p1 = R.rt.InverseTransformPoint(R.big.position), dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.sqrt(dx * dx + dy * dy);
    function put(r, p, s) { r.rectTransform.localPosition = new UE.Vector3(p.x, p.y, 0); scl(r.rectTransform, s); }
    var lead = kind == "unlock" ? 1 : 0;                                   // the unlock's impact lands by frame 3
    var flareAt = kind == "equip" ? 4 : 12, stars0 = R.stars.rectTransform.anchoredPosition;
    b.lvl.fontSize = 24; b.lvl.rectTransform.sizeDelta = new UE.Vector2(150, 32);   // under the big crystal's pips, inside its width
    b.lvl.rectTransform.localPosition = new UE.Vector3(p1.x, p1.y - 122, 0);
    b.lvl.text = kind == "unlock" ? "UNLOCKED" : kind == "equip" ? "" : "LEVEL " + lv;
    log("block-out " + kind + " from " + src.name);
    anim("blockout", 0, 4.0, function (k) {
      var f = k * 240;                                                     // frames at 60 fps from the press
      // cell glow: the lead, up in 2 frames, gone by 6
      put(b.glow, p0, 0.7 + 0.3 * boRamp(f, 0, 2) + 0.15 * boRamp(f, 2, 6)); boA(b.glow, f < 2 ? boRamp(f, 0, 2) : 1 - boRamp(f, 2, 6));
      // cell burst: the impact, peak at 4 (3 for an unlock), creeps out and is gone by 14
      var bp = 4 - lead; put(b.burst, p0, 0.8 + 0.5 * boRamp(f, 2 - lead, bp) + 0.5 * boRamp(f, bp, 14)); boA(b.burst, f < 2 - lead ? 0 : f < bp ? 0.9 * boRamp(f, 2 - lead, bp) : 0.9 * (1 - boRamp(f, bp, 14)));
      // streak to the big crystal: head arrives at 8, tail follows, gone by 12 (not for an equip: the slot is the target)
      var on = kind != "equip" && f >= 4 && f < 12, hd = easeOut(boRamp(f, 4, 8)), tl = boRamp(f, 6, 12);
      b.streak.gameObject.SetActive(on);
      if (on) { var sr = b.streak.rectTransform; sr.localPosition = new UE.Vector3(p0.x + dx * tl, p0.y + dy * tl, 0); sr.localEulerAngles = new UE.Vector3(0, 0, Math.atan2(dy, dx) * 180 / Math.PI); sr.sizeDelta = new UE.Vector2(Math.max(2, len * (hd - tl)), 8); boA(b.streak, 1); }
      // big flare: a 2-3 frame flash, then a glow that creeps larger and goes by 40
      var fp = kind == "equip" ? p0 : p1, fl = flareAt;
      put(b.flash, fp, 1.0 + 0.1 * boRamp(f, fl, fl + 1)); boA(b.flash, f < fl ? 0 : f < fl + 1 ? boRamp(f, fl, fl + 1) : 1 - boRamp(f, fl + 1, fl + 3));
      put(b.flare, fp, 1.0 + 0.6 * easeOut(boRamp(f, fl + 1, 40))); boA(b.flare, f < fl + 1 ? 0 : 0.6 * (1 - boRamp(f, fl + 1, 40)));
      // pips: one every 3 frames from 14, held
      b.pips.forEach(function (pp, i) {
        var at0 = 14 + i * 3, on2 = kind != "equip" && i < lv; pp.gameObject.SetActive(on2); if (!on2) return;
        var pr = pp.rectTransform; pr.anchoredPosition = new UE.Vector2(stars0.x + (i - 1) * 26, stars0.y); scl(pr, f < at0 ? 1 : 1.5 - 0.5 * easeOut(boRamp(f, at0, at0 + 4)));
        boA(pp, f < at0 ? 0.25 : 1);
      });
      // numbers count up from 14 to 22, held
      b.num.text = kind == "level" ? "+" + Math.round(12 * easeOut(boRamp(f, 14, 22))) + "%" : ""; b.num.alpha = f < 14 ? 0 : 1;
      // "LEVEL n": in at 16, full at 20, gone by 60
      b.lvl.alpha = f < 16 ? 0 : f < 20 ? boRamp(f, 16, 20) : 1 - boRamp(f, 50, 60); scl(b.lvl.rectTransform, 1.25 - 0.25 * easeOut(boRamp(f, 16, 20)));
      // rest: after 60 a slow breath on the large crystal
      put(b.rest, p1, 1.05); boA(b.rest, f < 60 ? 0 : 0.12 + 0.08 * Math.sin((f - 60) / 60 * Math.PI));
      if (k >= 1) b.rt.gameObject.SetActive(false);
    });
    return "block-out " + kind + " playing";
  };
  P.reset = function () { P.kind = null; P.c = null; try { if (S) backdrop(true); if (P.colRoot) P.colRoot.gameObject.SetActive(false); if (P.crRoot) P.crRoot.gameObject.SetActive(false); } catch (e) {} };
  return "BB4PAN ready";
})();
