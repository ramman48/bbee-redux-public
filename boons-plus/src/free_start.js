/* Tactics Plus Ultra: free choice of up to 4 starting Tactics. While any are picked they replace the Evotypes'
   Legacy Tactics at run start; Heat's Legacy limits and the stock merge rules still apply. */
globalThis.BPFREE = (function () {
  const KEY = "BPFreeStart", RUN = "BPFreeRun", MAX = 4, SLOTS = 2, PER_SLOT = 2;
  // Picks start at the lowest quality, so an Evotype's earned Legacy keeps its worth.
  const Q = 1;
  const X = () => require("Gen/Xlsx").Xlsx;
  const U = () => require("Core/Util").U;
  const prefs = () => CS.UnityEngine.PlayerPrefs;
  function log(m) { try { console.log("[BP2] free start: " + m) } catch (x) {} }
  function read(k) {
    try { const v = JSON.parse(prefs().GetString(k, "") || "null"); return Array.isArray(v) ? v : null } catch (x) { return null }
  }
  function write(k, v) {
    try { prefs().SetString(k, v == null ? "" : JSON.stringify(v)); prefs().Save() } catch (x) { log("save failed " + x) }
  }
  function valid(id) { const c = typeof id == "number" && X().BlessConf.Get(id); return !!c && !c.invalid }
  let picks = null;
  function list() { return picks || (picks = (read(KEY) || []).filter(valid).slice(0, MAX)) }
  function name(id) { try { return require("Core/ActorUtil").default.GetBlessName(id) } catch (x) { return String(id) } }
  function selected(win) { return win.strategyTreeNodeWidgets.find(w => w.strategyTreeBlessData.Index == win.selectBlessIndex) }

  const api = {
    picking: false, opening: false, scene: null,
    on() { return list().length > 0 },
    count() { return list().length },
    has(id) { return list().includes(id) },
    max: MAX,
    picks() { return list().slice() },
    // Set from another menu (Redux Menus' Starting Tactics screen): valid ids only, at most MAX.
    set(l) { picks = (l || []).filter(valid).slice(0, MAX); write(KEY, picks); log("picks " + JSON.stringify(picks)); try { api.label() } catch (x) {} return picks.slice() },
    status() {
      const l = list();
      return U().GetLocale("BPFree_Status", l.length, MAX) + (l.length ? ": " + l.map(name).join(", ") : "");
    },
    // Called for every tree node while the tree is built.
    mark(d) { d.Collect = d.Gain = api.has(d.BlessID); d.Quality = d.Gain ? Q : -1; d.MainBless = false },

    inherit(dg, P) {
      if (!api.on()) { write(RUN, null); return null }
      const lim = dg.dungeonFunctions(P.EBreedDungeonFunction.MasterLimit);
      let slots = 0;
      for (let n = 0; n < SLOTS; n++) lim.some(e => e.masterLimit.index == n && e.masterLimit.type == P.EInheritType.Bless) || slots++;
      const out = list().slice(0, slots * PER_SLOT);
      write(RUN, out.map(id => ({ id: id, quality: Q })));
      log("run start with " + JSON.stringify(out) + " (" + slots + " Legacy slots open)");
      return out.map(id => P.STBless.create({ id: id, quality: Q }));
    },
    runList() { return read(RUN) },

    bindHelp(scene) {
      api.scene = scene;
      const b = scene.R.ButtonHelp;
      if (!b) return;
      b.gameObject.SetActive(true);
      if (!scene.__bpfree) {
        scene.__bpfree = true;
        require("Core/UIUtil").default.BindButtonEvent(b, () => api.open());
        const ia = U().GetComponent(b, CS.GamePlay.InputAction);
        log("button bound, action " + (ia && ia.ActionId));
      }
      api.label();
    },
    label() {
      const b = api.scene && api.scene.R.ButtonHelp;
      const ia = b && U().GetComponent(b, CS.GamePlay.InputAction);
      if (!ia) return;
      const n = list().length;
      ia.InputName = n ? U().GetLocale("BPFree_ButtonOn", n, MAX) : U().GetLocale("BPFree_Button");
    },
    open() {
      const all = X().BlessTree.All.slice().sort((a, b) => a.blessTreeSeries - b.blessTreeSeries || a.id - b.id);
      if (!all.length) return;
      let start = -1;
      const first = list()[0];
      if (first != null) {
        const f = X().BlessConf.Get(first).faction;
        const t = all.find(r => { const c = X().BlessConf.Get(r.blessId); return c && c.faction == f });
        if (t) start = t.id;
      }
      api.opening = true;
      require("Core/UIUtil").default.AcquireWindow(require("Window/StrategyTree").default).ShowStrategyTree(all.map(r => r.id), null, start);
    },

    // StrategyTree hooks while picking.
    button(win) {
      const w = selected(win);
      win.R.BtnSummon.gameObject.SetActive(!!w);
      if (w) win.R.BtnSummon.InputName = U().GetLocale(api.has(w.strategyTreeBlessData.BlessID) ? "BPFree_Remove" : "BPFree_Pick");
    },
    detail(win) {
      win.R.NotGaintext.gameObject.SetActive(false);
      win.R.TriggerTypeTip.TextAuto(api.status());
    },
    toggle(win) {
      const w = selected(win);
      if (!w) return;
      const id = w.strategyTreeBlessData.BlessID, l = list().slice();
      const WU = require("Core/WindowUtil").default;
      if (l.includes(id)) l.splice(l.indexOf(id), 1);
      else {
        if (l.length >= MAX) return WU.QueueMessages(U().GetLocale("BPFree_Full", MAX));
        const BU = require("GamePlay/BattleBreedPrepare/BattlePrepareBlessUtil").default;
        const clash = l.find(o => BU.CheckBlessMutualExclusion({ id: o }, { id: id }));
        if (clash != null) return WU.QueueMessages(U().GetLocale("BlessMutexExclusion", name(clash)));
        l.push(id);
      }
      picks = l;
      write(KEY, l);
      log("picks " + JSON.stringify(l));
      for (const n of win.strategyTreeNodeWidgets) {
        api.mark(n.strategyTreeBlessData);
        n.ShowDetail();
        n.SetSelectStatus(n === w);
      }
      win.RefreshBlessDetail(w.strategyTreeBlessData);
      api.button(win);
    },
    closed() {
      api.picking = false;
      const s = api.scene;
      try {
        if (s && s.refFactorL && s.refFactorL.factor) s.refFactorL.RefreshUI();
        if (s && s.refFactorR && s.refFactorR.factor) s.refFactorR.RefreshUI();
        api.label();
      } catch (x) { log("refresh failed " + x) }
    },
  };
  return api;
})();
