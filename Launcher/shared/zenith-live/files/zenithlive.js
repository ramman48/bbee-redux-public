/* ===== zenith-live (The Zenith Terminal): mods added or updated while the game is open =====
   When a mod changes while the game runs (a lobby needs a character this PC lacks, or has in another version), the
   Terminal builds only what changed and writes it into a file of its own plus a list for this game:
   @ROOT@/live/<process id>.json. This reads that list once a second and loads it:
     - changed scripts are run and merged into the modules the game holds (a class keeps its identity, so objects
       that exist run the new methods; data a module keeps stays);
     - the game's bundle index is pointed at the new bundles; tables it holds are filled again from the new rows;
       the text is read again; effects, sprites and rigs it loaded from the old bundles are let go, and the next use
       reads the new ones; a bundle new to the game gets a line in the game's bundle list.
   What is already on screen keeps what it was made from. The answer goes to @ROOT@/live/<process id>.done.json,
   where the Terminal reads it, and to @ROOT@/modlog.txt (lines "ZENITH LIVE").
   It reads nothing but that list and the files the list names, which the Terminal wrote from this PC's own build. */
(function () {
  if (globalThis.ZENITH_LIVE) return;
  var cs = require("csharp"), F = cs.System.IO.File, ROOT = "@ROOT@";
  var Z = globalThis.ZENITH_LIVE = { loadedAb: {}, doneJs: {}, log: [], loads: 0 };
  globalThis.ZENITH_LIVE_HOOKS = globalThis.ZENITH_LIVE_HOOKS || [];   // function (list, answer), run after each load
  var PID = 0, STARTED = null;
  try { var me = cs.System.Diagnostics.Process.GetCurrentProcess(); PID = me.Id; STARTED = me.StartTime.ToUniversalTime(); } catch (e) {}
  function log(s) {
    Z.log.unshift(s); if (Z.log.length > 20) Z.log.length = 20;
    try { F.AppendAllText(ROOT + "/modlog.txt", new Date().toISOString() + " ZENITH LIVE " + s + "\n"); } catch (e) {}
  }
  function es(e) { return String(e && e.stack || e).slice(0, 400); }

  // ---- scripts: the new text is run with fresh exports, then merged into the exports the game already holds ----
  function copyFns(from, to, skip) {
    var n = 0;
    Object.getOwnPropertyNames(from).forEach(function (k) {
      if (skip[k]) return;
      var d = Object.getOwnPropertyDescriptor(from, k), fn = typeof d.value == "function" || d.get || d.set;
      if (!fn && k in to) return;                     // data that exists stays (singletons, counters)
      try { Object.defineProperty(to, k, d); n++; } catch (e) {}
    });
    return n;
  }
  function isClass(f) {
    if (typeof f != "function" || !f.prototype) return false;
    if (Object.getOwnPropertyNames(f.prototype).length > 1) return true;
    return Object.getOwnPropertyNames(f).some(function (k) { return ["length", "name", "prototype", "caller", "arguments"].indexOf(k) < 0; });
  }
  function merge(live, fresh) {
    var n = { classes: 0, fns: 0, values: 0 };
    Object.keys(fresh).forEach(function (k) {
      if (k == "__esModule") return;
      var a = live[k], b = fresh[k];
      if (k == "ModRegistry" && a && b && typeof a == "object") {
        // the list of mods, the Terminal's release and the alias tables: replaced whole, in the same object
        Object.keys(a).forEach(function (kk) { if (!(kk in b) && kk != "live") delete a[kk]; });
        Object.keys(b).forEach(function (kk) { a[kk] = b[kk]; }); n.values++;
      } else if (isClass(a) && isClass(b)) {
        copyFns(b.prototype, a.prototype, { constructor: 1 }); copyFns(b, a, { prototype: 1, length: 1, name: 1, caller: 1, arguments: 1 }); n.classes++;
      } else if (a && b && typeof a == "object" && typeof b == "object" && !Array.isArray(b) && a.constructor === Object) {
        Object.keys(b).forEach(function (kk) { var v = b[kk]; if (typeof v == "function" || !(kk in a) || typeof v != "object") { try { a[kk] = v; } catch (e) {} } }); n.values++;
      } else { try { live[k] = b; if (typeof b == "function") n.fns++; else n.values++; } catch (e) {} }
    });
    return n;
  }
  function reqFor(name) {      // a module's own require: "../DataBinding" inside Core/ActorUtil means DataBinding
    var dir = name.split("/").slice(0, -1);
    return function (id) {
      if (id.charAt(0) != ".") return require(id);
      var parts = dir.slice();
      id.split("/").forEach(function (p) { if (p == "." || p == "") return; if (p == "..") parts.pop(); else parts.push(p); });
      return require(parts.join("/"));
    };
  }
  function script(m) {
    var live; try { live = require(m.name); } catch (e) { return "not loaded in this game yet: it is read from the new bundle when first used"; }
    var mod = { exports: {} };
    var fn = (0, eval)("(function(exports,require,module,__filename,__dirname){" + F.ReadAllText(m.file) + String.fromCharCode(10) + "})");
    fn(mod.exports, reqFor(m.name), mod, m.name, "");
    var n = merge(live, mod.exports);
    Z.doneJs[m.logical] = m.hash;
    return n.classes + " classes, " + n.fns + " functions, " + n.values + " values";
  }

  // ---- bundles: the game finds one through an index it keeps in memory (name -> file and offset, full paths allowed) ----
  var BF = cs.System.Reflection.BindingFlags, ANY = BF.Instance | BF.NonPublic | BF.Public | BF.Static;
  function fld(o, n) { var ty = o.GetType(); while (ty) { var f = ty.GetField(n, ANY); if (f) return f; ty = ty.BaseType; } return null; }
  function val(o, n) { var f = fld(o, n); return f ? f.GetValue(o) : undefined; }
  function provider() { return val(cs.NOAH.Asset.AssetManager.Instance, "m_assetProvider"); }
  function point(L, rows) {
    var mi = val(provider(), "m_mergeAssetInfo"), made = 0;
    rows.forEach(function (r) {
      var e = new cs.NOAH.Asset.AssetMergeAbManifest(); e.r = r.r; e.m = L.file; e.s = String(r.s);
      if (mi.ContainsKey(r.r)) mi.Remove(r.r); else made++;
      mi.Add(r.r, e);
    });
    return made;
  }
  function tables(rows) {
    var XC = puer.$typeof(cs.XlsxReader.XlsxLoaderCenter), cache = XC.GetField("s_XlsxCache", ANY).GetValue(null);
    var live = {}, e = cache.GetEnumerator(), done = [], later = [];
    while (e.MoveNext()) live[e.Current.Key.Name] = e.Current.Value.Target;
    rows.forEach(function (r) {
      if (!r.loader || !r.raw) return;
      var tg = live[r.loader];
      if (!tg) { later.push(r.table); return; }
      var ms = new cs.System.IO.MemoryStream(F.ReadAllBytes(r.raw));
      try { tg.Clear(); tg.Load(ms); done.push(r.table); } finally { ms.Dispose(); }
    });
    if (done.some(function (n) { return n.indexOf("PlayerBattleTriggerDetail") == 0; })) {
      try { cs.GamePlay.PlayerTriggerConf.Instance.Reload(); } catch (er) { log("trigger numbers not worked out again: " + es(er)); }
    }
    return { filled: done, later: later };
  }
  // scripts keep their own copy of a table, built from its bundle the first time they read it (Gen/Xlsx: a getter
  // replaced by the built class); one built already is emptied and built again once the old bundle is let go
  function jsBuilt(r) {
    if (!r.js) return false;
    try { var d = Object.getOwnPropertyDescriptor(require("Gen/Xlsx").Xlsx, r.js.cls); return !!(d && !d.get && d.value); } catch (e) { return false; }
  }
  function jsTables(rows) {
    var X = require("Gen/Xlsx").Xlsx, PT = require("ProtobufTools"), done = [];
    rows.forEach(function (r) {
      if (!jsBuilt(r)) return;
      var t = X[r.js.cls], pb = PT.GetPBTypeByName(r.js.pb);
      if (!pb) return;
      t.All.length = 0; t.Indexes.clear();
      PT.BuildXlsx(t, pb, r.js.keys); done.push(r.js.cls + " " + t.All.length);
    });
    return done;
  }
  function text() { try { return !!cs.Localization.LocalizationManager.Instance.Reload(); } catch (er) { log("text not read again: " + es(er)); return false; } }
  function effects(rows) {
    var vm = null, gone = 0;
    try { vm = require("Core/Util").U.GetSingleton(cs.NOAH.VFX.VFXManager); } catch (e) { return 0; }
    if (!vm) return 0;
    var groups = val(vm, "m_groups");
    rows.forEach(function (r) {
      var m = /^effect\/prefab\/(.+)\.ab$/.exec(r.r); if (!m) return;
      var keys = [], e = groups.GetEnumerator();
      while (e.MoveNext()) if (String(e.Current.Key).toLowerCase() == m[1]) keys.push(e.Current.Key);
      keys.forEach(function (k) { try { groups.get_Item(k).ReleaseCache(); } catch (er) {} groups.Remove(k); gone++; });
    });
    return gone;
  }
  function unload(rows) {
    // the cache holds a bundle under its name without ".ab", and again under each object loaded from it: those
    // entries are taken out and the bundle closed; what is already on screen from it stays alive (Unload(false))
    var db = val(provider(), "m_assetDB"), idx = val(db, "m_indices"), set = val(db, "m_db"), c2r = val(db, "m_c2r");
    var want = [], n = 0, paths = {}, keys = [];
    rows.forEach(function (r) { try { var c = db.GetCtx(r.r.replace(/\.ab$/, "")); if (c) want.push(c); } catch (er) {} });
    if (!want.length) return 0;
    want.forEach(function (c) { paths[c.m_refPath] = 1; });
    var e = idx.GetEnumerator();
    while (e.MoveNext()) if (paths[e.Current.Value.m_refPath]) keys.push(e.Current.Key);
    keys.forEach(function (k) { try { idx.Remove(k); } catch (er) {} });
    want.forEach(function (c) {
      try { set.Remove(c); } catch (er) {}
      try { if (c2r) c2r.Remove(c); } catch (er) {}
      try { if (c.m_bundle) c.m_bundle.Unload(false); n++; } catch (er) {}
    });
    return n;
  }
  function dependents(rows) {
    var pv = provider(), man = val(pv, "m_manifest"), idx = val(val(pv, "m_assetDB"), "m_indices");
    var changed = {}, mine = {}, out = [], keys = [], e = idx.GetEnumerator();
    rows.forEach(function (r) { changed[r.r] = 1; changed[r.r.replace(/\.ab$/, "")] = 1; mine[r.r.replace(/\.ab$/, "")] = 1; });
    while (e.MoveNext()) { var k = e.Current.Key; if (typeof k == "string" && !mine[k]) keys.push(k); }
    keys.forEach(function (k) {
      try {
        var ref = puer.$ref(), ok = man.GetDependencies(k, ref) || man.GetDependencies(k + ".ab", ref), deps = puer.$unref(ref);
        if (!ok || !deps) return;
        for (var i = 0; i < deps.Length; i++) if (changed[String(deps.get_Item(i)).toLowerCase()]) { out.push({ r: k + ".ab", kind: "asset" }); return; }
      } catch (er) {}
    });
    return out;
  }
  function announce(L, rows) {
    var man = val(provider(), "m_manifest"), ix = val(man, "m_caseInsensitiveIndex"), n = 0, bad = [];
    var VT = ix.GetType().GetGenericArguments().get_Item(1), S = puer.$typeof(cs.System.String), deps = {};
    ((L.manifestAdd && L.manifestAdd.entries) || []).forEach(function (e) { deps[e[0]] = e[1]; });
    rows.forEach(function (r) {
      var key = r.r.replace(/\.ab$/, "");
      try {
        if (ix.ContainsKey(key)) return;
        var d = deps[key] || [], arr = cs.System.Array.CreateInstance(S, d.length);
        for (var i = 0; i < d.length; i++) arr.set_Item(i, d[i]);
        var box = cs.System.Activator.CreateInstance(VT);     // (dependencies, name), filled field by field
        box.Item1 = arr; box.Item2 = key;
        if (String(box.Item2) != key) throw new Error("the entry kept its blank fields");
        ix.Add(key, box); n++;
      } catch (er) { bad.push(key); }
    });
    return { announced: n, failed: bad };
  }

  Z.apply = function (L) {
    var a = { id: L.id, pid: PID, at: new Date().toISOString(), scripts: [], failed: [] };
    (L.scripts || []).forEach(function (m) {
      if (Z.doneJs[m.logical] == m.hash) return;
      try { a.scripts.push(m.name + ": " + script(m)); } catch (e) { a.failed.push(m.name + ": " + es(e)); }
    });
    var rows = (L.rows || []).filter(function (r) { return Z.loadedAb[r.r] != r.hash; });
    try {
      if (rows.length) {
        a.added = point(L, rows);
        var tb = tables(rows.filter(function (r) { return r.kind == "table"; }));
        a.tables = tb.filled.length; a.tablesLater = tb.later.length;
        // a table filled from its rows keeps its bundle, unless scripts built their own copy from it (read again below)
        var rest = rows.filter(function (r) { return r.kind != "table" || tb.filled.indexOf(r.table) < 0 || jsBuilt(r); });
        var fresh = rows.filter(function (r) { return r.new; });
        if (fresh.length) { var an = announce(L, fresh); a.announced = an.announced; if (an.failed.length) a.failed.push("new to the game, not announced: " + an.failed.join(", ")); }
        var dep = []; try { dep = dependents(rest); } catch (er) { a.failed.push("bundles built on the changed ones: " + es(er)); }
        rest = rest.concat(dep); a.dependents = dep.length;
        a.effects = effects(rest); a.unloaded = rest.length ? unload(rest) : 0;
        try { var jt = jsTables(rows.filter(function (r) { return r.kind == "table"; })); a.jsTables = jt; a.tables += jt.length; }
        catch (er) { a.failed.push("tables the scripts hold: " + es(er)); }
        if (rows.some(function (r) { return r.kind == "locale"; })) a.text = text();
        rows.forEach(function (r) { Z.loadedAb[r.r] = r.hash; });
      }
      a.bundles = rows.length;
    } catch (er) { a.failed.push(es(er)); }
    try {
      var R = require("Example").ModRegistry;
      if (R) R.live = { loads: ++Z.loads, at: a.at, mods: L.mods || [], file: L.file };
    } catch (e) {}
    a.ok = !a.failed.length;
    globalThis.ZENITH_LIVE_HOOKS.forEach(function (f) { try { f(L, a); } catch (e) { log("a hook failed: " + es(e)); } });
    log((a.ok ? "loaded " : "loaded with problems ") + (L.mods || []).join(", ") + ": " + a.scripts.length + " script(s), " + (a.bundles || 0) +
        " bundle(s), " + (a.tables || 0) + " table(s) filled again" + (a.failed.length ? "; problems: " + a.failed.join(" | ") : ""));
    return a;
  };
  Z.poll = function () {
    if (Z.busy || !PID) return;
    var f = ROOT + "/live/" + PID + ".json";
    if (!F.Exists(f)) return;
    if (STARTED && F.GetLastWriteTimeUtc(f).Ticks < STARTED.Ticks) return;   // written for an earlier game that had this process id
    var L = JSON.parse(F.ReadAllText(f));
    if (!L || L.id == Z.last) return;
    Z.last = L.id; Z.busy = true;
    try { F.WriteAllText(ROOT + "/live/" + PID + ".done.json", JSON.stringify(Z.apply(L))); }
    finally { Z.busy = false; }
  };
  if (typeof setInterval == "function") Z.timer = setInterval(function () { try { Z.poll(); } catch (e) { Z.busy = false; log("FAILED " + es(e)); } }, 1000);
  log("ready (process " + PID + ")");
})();
