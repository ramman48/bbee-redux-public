/* palette-maker: the player's own palettes as slots in the game's palette selector (appended to window/WidgetChangeSkin,
   the selector before a run; the lead, 2026-10-18: "add new slots to the games palette selector ... for all the custom
   colors you make").

   Each saved palette of the hero is a slot after the stock ones. A slot is its base palette's own row, so the base's lock,
   price and DLC gate stay exactly as they are: a palette made on a palette the player does not own stays locked. Picking
   it shows the base palette with the colours painted over it; confirming saves the base palette as the stock selector
   does, and wears the colours (beside the save, as WEAR in the maker does). Picking a stock palette takes them off. */
(function () {
  var G = globalThis, W = WidgetChangeSkin, P = W && W.prototype; if (!P || P.__palSel) return;
  P.__palSel = true;
  function M() { return G.BBPAL; }
  function log(s) { try { M().log("selector: " + s); } catch (e) {} }
  var MAXC = 8;
  // the hero's saved palettes as selector rows: { ...the base row, __pal: { code, name, swatch } }
  function customs(widget, stock) {
    var m = M(); if (!m || widget.IsSecondHeroSkinSetting) return [];
    var out = [];
    try {
      m.mine(widget.HeroId).slice(0, MAXC).forEach(function (o) {
        var p = m.decode(o.code); if (!p) return;
        var base = stock.filter(function (c) { return (parseInt(c.skinName) || 0) == p.skin; })[0]; if (!base) return;
        var on = p.parts.filter(function (q) { return q.on; }), sw = on.length ? on[0].lit : null;
        out.push(Object.assign(Object.create(Object.getPrototypeOf(base)), base, { __pal: { code: o.code, name: p.name, swatch: sw } }));
      });
    } catch (e) { log("rows: " + e); }
    return out;
  }
  function owner(widget) { try { var am = require("Core/Util").U.GetComponentInParent(widget.Actor, CS.GamePlay.ActorModel); return am && am.Owner; } catch (e) { return null; } }
  function selected(widget) { return widget.colorNodes.filter(function (n) { return n.IsSelected(); })[0]; }

  // a custom slot draws as the numbered stock frame in its palette's main colour, with its own name when picked
  function hookNode(node) {
    var NP = Object.getPrototypeOf(node); if (NP.__palSel) return; NP.__palSel = true;
    var upd = NP.UpdateInfo, sel = NP.SetSelected;
    NP.UpdateInfo = function (cfg) {
      var r = upd.apply(this, arguments);
      try {
        var c = cfg && cfg.__pal, im = this.R.Image;
        if (c) {
          im.sprite = this.bevRoot.LoadSprite("UI/Atlas/Skin/Skin", "ImgPC_Skin01"); im.SetNativeSize();
          var s = c.swatch || [1, 1, 1]; im.color = new CS.UnityEngine.Color(s[0], s[1], s[2], 1);
          this.R.Text.text = "✦";
        } else im.color = new CS.UnityEngine.Color(1, 1, 1, 1);
      } catch (e) { log("slot: " + e); }
      return r;
    };
    NP.SetSelected = function (on) {
      var r = sel.apply(this, arguments);
      try { if (on && this.cfg && this.cfg.__pal) this.bevRoot.R.SkinName.TextAuto(this.cfg.__pal.name); } catch (e) {}
      return r;
    };
  }

  var upd = P.UpdateInfo;
  P.UpdateInfo = function () {
    var m = M();
    try {
      var stock = (this.confList || []).filter(function (c) { return !c.__pal; });
      this.confList = stock.concat(customs(this, stock));
      if (m) m.selecting = this;
    } catch (e) { log("list: " + e); }
    var r = upd.apply(this, arguments), self = this;
    try { if (this.colorNodes[0]) hookNode(this.colorNodes[0]); this.colorNodes.forEach(function (n) { if (n.cfg) n.UpdateInfo(n.cfg); }); } catch (e) { log("nodes: " + e); }
    // the stock opening selects every slot on the worn base palette: one is meant, the custom palette worn on it if any
    setTimeout(function () {
      try {
        var mm = M(), worn = mm ? mm.wornCode(self.HeroId) : "", s = AvatarUtil_1.SkinUtil.GetCurrentSkinName(self.HeroId);
        var k = self.colorNodes.findIndex(function (n) { return n.cfg && n.cfg.__pal && n.cfg.__pal.code == worn && n.cfg.skinName == s; });
        if (k < 0) k = self.colorNodes.findIndex(function (n) { return n.cfg && !n.cfg.__pal && n.cfg.skinName == s; });
        self.colorNodes.forEach(function (n, i) { try { if (n.cfg) n.R.Active.gameObject.SetActive(i == k); } catch (e) {} });
        if (k >= 0) self.changeSelection_imp(k);
      } catch (e) { log("select: " + e); }
    }, 120);
    return r;
  };

  // shown: the base palette goes on (stock), then the colours of a custom slot are painted over it
  var apply = P.ApplySkin;
  P.ApplySkin = function () {
    var r = apply.apply(this, arguments);
    try {
      var m = M(), a = owner(this), cfg = this.CurrentSelectedCfg; if (!m || !a) return r;
      var p = cfg && cfg.__pal ? m.decode(cfg.__pal.code) : null;
      if (p) m.preview(a, p); else m.unwear(a);
    } catch (e) { log("show: " + e); }
    return r;
  };
  // confirmed: the stock save keeps the base palette; the colours are worn beside the save
  var save = P.ApplySkinAndSave;
  P.ApplySkinAndSave = async function () {
    var cfg = this.CurrentSelectedCfg, hero = this.HeroId, second = this.IsSecondHeroSkinSetting;
    var r = await save.apply(this, arguments);
    try {
      var m = M(); if (m && !second && cfg && AvatarUtil_1.AvatarUtil.IsSkinUnlocked(cfg.id)) {
        m.setWorn(hero, cfg.__pal ? cfg.__pal.code : ""); log((cfg.__pal ? "wearing " + cfg.__pal.name : "stock palette " + cfg.skinName) + " on hero " + hero);
      }
    } catch (e) { log("save: " + e); }
    return r;
  };
  // closed either way: the worn palette is put back by the core's sync
  var close = P.Close;
  P.Close = async function () { try { var m = M(); if (m) m.selecting = false; } catch (e) {} return close.apply(this, arguments); };
})();
