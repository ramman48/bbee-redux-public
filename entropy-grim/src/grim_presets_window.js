/* Entropy Overhaul: Grim of the Abyss 1.0.2 -- Entropy presets, the window (appended to window/conscious/ConsciousGroup;
   module scope: RefConsciousGroup, ConsciousGroupData, ConsciousGroup, UIUtil_1, Util_1, WindowUtil_1,
   UniversalTextInput_1, Misc_1, csharp_1).
   Tester request 2026-11-13 (Fury): "Having a way to save pre-sets similar to mind crystals would be great". The presets
   use the game's own Mind Crystal set window (Crystal Group Backup) as it is: the same rows, numbers, names, "In Use"
   mark, selection, and the same buttons (Use, Save, Clear Group, Copy Group / Confirm Copy, Rename Group, Back). The
   Entropy menu opens it in preset mode (src/grim_presets.js sets __GRIM_PRESETS.pending first); in that mode:
   - the title reads "Entropy Presets" and each row shows its name, then its tab and Entropy, with the crystal slots hidden;
   - Use loads the preset into the Entropy menu (on its tab), Save writes the menu's current selection into the row,
     Clear empties it, Copy / Confirm Copy copies one row's selection onto another, Rename names it (28 characters,
     the stock limit); Use, Save and Clear ask first with the stock yes / no dialog, as the crystal window does;
   - presets are kept in the account folder, in redux_grim_presets.json (the way Endless keeps redux_endless.json),
     never in the save and never on the game's server: the crystal window's server calls are not made in this mode.
   Opened any other way (the Mind Crystal screen), the window is the stock one: every change below checks the mode. */
;(() => {
  try {
  var GP = globalThis.__GRIM_PRESETS = globalThis.__GRIM_PRESETS || {};
  var CS = csharp_1, U = Util_1.U, FILE = "redux_grim_presets.json", TITLE_STOCK = "Conscious_GroupFunctionName";
  var logged = {};
  function log(k, m) {
    if (k && logged[k]) return; if (k) logged[k] = 1;
    try { CS.System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM presets " + m + "\n") } catch (x) {}
  }
  function loc() { try { return U.GetLocale.apply(U, arguments) } catch (x) { return String(arguments[0]) } }

  /* ---- the file (account folder, outside the save) ---- */
  function path() { try { return require("Archive/ArchiveEnv").default.GetAccountWritablePath(FILE) } catch (x) { log("path", "path EXC " + x); return null } }
  function readStore() {
    var st = null;
    try { var p = path(), F = CS.System.IO.File; if (p && F.Exists(p)) st = JSON.parse(F.ReadAllText(p)) } catch (x) { log("read", "read EXC " + x) }
    if (!st || typeof st !== "object") st = {};
    st.v = 1; if (!st.slots || typeof st.slots !== "object") st.slots = {};
    return st;
  }
  function writeStore(st) {
    try { var p = path(); if (!p) return false; CS.System.IO.File.WriteAllText(p, JSON.stringify(st)); return true }
    catch (x) { log(null, "write EXC " + x); return false }
  }
  GP.readStore = readStore;

  /* ---- the rows ---- */
  function on(w) { return !!(w && w.__gp) }
  function menu() { return GP.ctx && GP.ctx.menu }
  function api() { return GP.api }
  function count() { var n = 10; try { n = Misc_1.Misc.consciousMisc.maxRecordCount || 10 } catch (x) {} return Math.max(3, Math.min(20, n)) }
  function dataFor(id, rec) {
    var d = new ConsciousGroupData();
    d.Id = id; d.Base = { name: rec && rec.name || "", slotCrystalMap: {}, preset: rec && rec.loadout || null };
    d.InUse = false; try { d.InUse = !!(d.Base.preset && api() && api().same(menu(), d.Base.preset)) } catch (x) {}
    d.Save = function () {};   /* the stock Save writes the crystal groups' cache: never in preset mode */
    return d;
  }
  function rowRef(w, i) { try { return w.mapGroupRef.FindVal((t, e) => e.ContentIndex == i) } catch (x) { return null } }
  function redraw(w, i) { var r = rowRef(w, i); if (r) r.SetData(i, w.listData[i]) }
  function refreshInUse(w) {
    for (var d of w.listData) { try { d.InUse = !!(d.Base.preset && api().same(menu(), d.Base.preset)) } catch (x) { d.InUse = false } }
    try { for (var [k, r] of w.mapGroupRef) if (r.ContentIndex >= 0) r.SetInUseUI(w.listData[r.ContentIndex].InUse) } catch (x) {}
  }
  /* write one row (rec null or with neither name nor selection: the row is removed from the file) */
  function store(w, i, rec) {
    var st = readStore(), id = w.listData[i].Id;
    if (rec && (rec.name || rec.loadout)) st.slots[id] = rec; else delete st.slots[id];
    if (!writeStore(st)) { WindowUtil_1.default.QueueMessages(loc("GRIM_PRESET_WRITEFAIL")); return false }
    w.listData[i] = dataFor(id, st.slots[id]); redraw(w, i);
    return true;
  }
  function sel(w) { var i = RefConsciousGroup.SelectIndex; return i >= 0 && w.listData && i < w.listData.length ? i : -1 }

  /* ---- the window's look: the title, and the crystal slots of each row ---- */
  function look(w, presets) {
    try {
      var L = U.GetComponentsInChildren(w.CsObj, CS.NOAH.UI.UILocale, true);
      for (var i = 0; L && i < L.Length; i++) {
        var c = L.get_Item(i), k = String(c.m_localeKey || "");
        if (k !== TITLE_STOCK && k !== "GRIM_PRESET_TITLE") continue;
        var want = presets ? "GRIM_PRESET_TITLE" : TITLE_STOCK;
        if (k === want) continue;
        c.m_localeKey = want;
        var tx = U.GetComponent(c.gameObject, CS.TMPro.TMP_Text); if (tx) tx.text = loc(want);
      }
    } catch (x) { log("look", "title EXC " + x) }
  }
  var RP = RefConsciousGroup.prototype, oSetData = RP.SetData;
  RP.SetData = function (t, e) {
    var r = oSetData.apply(this, arguments);
    try {
      var w = GP.win, pm = on(w) && !!e && !!e.Base && "preset" in e.Base;
      if (pm || this.__gpHid) { this.R.ListSlot.gameObject.SetActive(!pm); this.__gpHid = pm }
      if (pm) {
        var p = e.Base.preset;
        this.R.TextGroupName.TextAuto(e.ShowName + "  <size=80%><color=#8FD8FF>" + (p ? api().summary(p) : loc("GRIM_PRESET_EMPTY")) + "</color></size>");
      }
    } catch (x) { log("row", "row EXC " + x) }
    return r;
  };

  /* ---- the window ---- */
  var P = ConsciousGroup.prototype;
  var oInit = P.InitWindow;
  P.InitWindow = async function () {
    var ctx = GP.pending; GP.pending = null;
    if (!ctx || Date.now() - (ctx.at || 0) > 10000 || !GP.api) {
      this.__gp = null; if (GP.win === this) GP.win = null; look(this, false);
      return oInit.apply(this, arguments);
    }
    this.__gp = ctx; GP.ctx = ctx; GP.win = this;
    try {
      look(this, true);
      this.currentEquipedSet = [];
      var st = readStore(), n = count();
      this.listData = [];
      for (var i = 0; i < n; i++) this.listData.push(dataFor(i + 1, st.slots[i + 1]));
      this.initSelectIndex(); this.toggleCopyMode(false);
      this.R.ContentGroup.SetSize(n); this.R.ContentGroup.JumpToItem(0);
      log(null, "window open: " + n + " rows, " + Object.keys(st.slots).length + " saved (" + (path() || "no path") + ")");
    } catch (x) { log("init", "InitWindow EXC " + x) }
  };
  var oUninit = P.UninitWindow;
  P.UninitWindow = function () {
    if (on(this)) {
      this.__gp = null; if (GP.win === this) GP.win = null; GP.ctx = null;
      for (var [k, r] of this.mapGroupRef || []) { try { if (r.__gpHid) { r.R.ListSlot.gameObject.SetActive(true); r.__gpHid = false } } catch (x) {} }
      look(this, false);
      log(null, "window closed");
      return;   /* the stock one tells the crystal screen its slots changed: nothing to tell */
    }
    return oUninit.apply(this, arguments);
  };
  function wrap(name, fn) {
    var o = P[name];
    P[name] = function () { if (!on(this)) return o.apply(this, arguments); try { return fn.apply(this, arguments) } catch (x) { log(name, name + " EXC " + x) } };
  }
  /* Use: load the row into the Entropy menu */
  wrap("OnBtnUseClick", async function () {
    var i = sel(this); if (i < 0) return;
    var a = this.listData[i], w = this;
    if (!a.Base.preset) { WindowUtil_1.default.QueueMessages(loc("GRIM_PRESET_EMPTY_TIP")); return }
    if (a.InUse) return;
    WindowUtil_1.default.ShowDialogYesNo(loc("GRIM_PRESET_USE_TIP", a.ShowName), async t => {
      if ("YES" != t) return;
      var res = { ok: false }; try { res = api().apply(menu(), a.Base.preset) } catch (x) { log(null, "apply EXC " + x) }
      if (!res.ok) { WindowUtil_1.default.QueueMessages(loc("GRIM_PRESET_LOADFAIL")); return }
      WindowUtil_1.default.QueueMessages(loc(res.skipped ? "GRIM_PRESET_PARTIAL" : "GRIM_PRESET_LOADED", a.ShowName));
      log(null, "loaded row " + a.Id + (res.skipped ? " (" + res.skipped + " left off)" : ""));
      refreshInUse(w);
    });
  });
  /* Save: the menu's current selection into the row */
  wrap("OnBtnSaveClick", async function () {
    var i = sel(this); if (i < 0) return;
    var e = this.listData[i], w = this;
    if (e.InUse) return;
    WindowUtil_1.default.ShowDialogYesNo(loc("GRIM_PRESET_SAVE_TIP", e.ShowName), async t => {
      if ("YES" != t) return;
      var snap = null; try { snap = api().snapshot(menu()) } catch (x) { log(null, "snapshot EXC " + x) }
      if (!snap) return;
      if (store(w, i, { name: e.Base.name, loadout: snap, saved: (new Date()).toISOString() })) { refreshInUse(w); log(null, "saved row " + e.Id + ": " + JSON.stringify(snap)) }
    });
  });
  /* Clear: the selection goes, the name stays (as the crystal window keeps it) */
  wrap("OnBtnClearClick", async function () {
    var i = sel(this); if (i < 0) return;
    var e = this.listData[i], w = this;
    WindowUtil_1.default.ShowDialogYesNo(loc("Conscious_ClearGroupTip", e.ShowName), async t => {
      if ("YES" != t) return;
      if (store(w, i, { name: e.Base.name, loadout: null })) refreshInUse(w);
    });
  });
  wrap("OnBtnModifyNameClick", async function () {
    var i = sel(this); if (i < 0) return;
    var e = this.listData[i], win = await UIUtil_1.default.AcquireWindowAsync(UniversalTextInput_1.default);
    win.Init(loc("Conscious_GroupRenameTitle"), e.ShowName); win.SetInputLimit(28);
    var name = await win.CloseAsync();
    if (name == null || name == e.ShowName) return;
    store(this, i, { name: String(name), loadout: e.Base.preset });
  });
  wrap("OnBtnPasteClick", async function () {
    var i = sel(this), c = RefConsciousGroup.CopyIndex; if (i < 0 || c < 0 || c == i) return;
    var from = this.listData[c], to = this.listData[i];
    if (store(this, i, { name: to.Base.name, loadout: from.Base.preset ? JSON.parse(JSON.stringify(from.Base.preset)) : null })) { refreshInUse(this); this.toggleCopyMode(false) }
  });
  log("loaded", "window module loaded");
  } catch (e) { try { require("csharp").System.IO.File.AppendAllText(globalThis.__GRIM_LOGF || "modlog.txt", (new Date()).toISOString() + " GRIM presets window LOAD EXC " + e + "\n") } catch (x) {} }
})();
