/* palette-maker: the colour maker's core (appended to core/ActorUtil, so it loads with the game).

   A player palette is the hero's own palette, repainted on the graphics card: every page of the worn palette's sprite
   sheets goes through the PalRecolour shader (the colour parts' ramps, tools/palette.py's maths) into a texture of our
   own, and the hero's renderer is given a copy of its texture family that holds those pages. Nothing changes in the
   save, the tables or what the game sends to 91Act: the hero still wears the palette the player owns.

   A palette travels as a code ("BBP1-" + base64url of a small binary record): the hero, the palette it was made on,
   its name and every colour part (centre, lit value, ramp). Saved palettes, the worn one and the ones seen on other
   players live beside the save, in <account>/Redux/palettes. Any failure puts the base palette back. Log tag PALMAKER. */
(function () {
  var G = globalThis, cs = CS, UE = cs.UnityEngine, SIO = cs.System.IO;
  var PT = require("puerts"), T = function (t) { return PT.$typeof(t); };
  var OLD = G.BBPAL;
  if (OLD && OLD.timer) { try { clearInterval(OLD.timer); } catch (e) {} }
  if (OLD && OLD.preRender) { try { cs.UnityEngine.Canvas.remove_willRenderCanvases(OLD.preRender); } catch (e) {} }
  if (OLD && OLD.releaseAll) { try { OLD.releaseAll(); } catch (e) {} }
  var M = G.BBPAL = { VER: "0.2.12", worn: {}, remote: {}, states: [], partsCache: {}, ui: OLD ? OLD.ui : null };
  var MAXP = 16, TAU = 0.003, SCALE = 2, OWN_MB = 512;   // other players' pages at half size: the same memory as the stock BC7 page

  // the game's log (the play-session report reads it by the tag), the test room's log when it is there, and our own file
  function log(s) {
    s = "PALMAKER " + s;
    try { UE.Debug.Log(s); } catch (e) {}
    try { if (G.BBTR && G.BBTR.x && G.BBTR.x.log) G.BBTR.x.log(s); } catch (e) {}
    try { if (M._dir) SIO.File.AppendAllText(M._dir + "/PaletteMaker.log", new Date().toISOString() + " " + s + "\n"); } catch (e) {}
  }
  M.log = log;
  function isNull(o) { try { return !o || o.Equals(null); } catch (e) { return !o; } }
  function es(e) { return String(e && e.stack || e).split("\n").slice(0, 3).join(" / "); }

  // ------------------------------------------------------------------ files beside the save
  M.dir = function () {
    if (M._dir) return M._dir;
    var root = UE.Application.persistentDataPath + "/Steam", acct = "";
    try { acct = String(cs.Steamworks.SteamUser.GetSteamID().GetAccountID().m_AccountID); } catch (e) {}
    if (!acct || !SIO.Directory.Exists(root + "/" + acct + "/Save")) {
      try { var ds = SIO.Directory.GetDirectories(root); for (var i = 0; i < ds.Length; i++) if (SIO.Directory.Exists(ds.get_Item(i) + "/Save")) { acct = SIO.Path.GetFileName(ds.get_Item(i)); break; } } catch (e) {}
    }
    var d = root + "/" + (acct || "local") + "/Redux/palettes";
    try { SIO.Directory.CreateDirectory(d); } catch (e) { log("folder " + d + ": " + es(e)); }
    return (M._dir = d);
  };
  function readJ(p, dflt) { try { return SIO.File.Exists(p) ? JSON.parse(String(SIO.File.ReadAllText(p))) : dflt; } catch (e) { log("read " + p + ": " + es(e)); return dflt; } }
  function writeJ(p, o) { try { SIO.Directory.CreateDirectory(SIO.Path.GetDirectoryName(p)); SIO.File.WriteAllText(p, JSON.stringify(o, null, 1)); return true; } catch (e) { log("write " + p + ": " + es(e)); return false; } }
  function safe(n) { return String(n || "palette").replace(/[^A-Za-z0-9 _\-]/g, "").trim().slice(0, 24) || "palette"; }

  // ------------------------------------------------------------------ the code
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function b64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0), k = Math.min(3, bytes.length - i);
      s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (k > 1 ? B64[n >> 6 & 63] : "") + (k > 2 ? B64[n & 63] : "");
    }
    return s;
  }
  function unb64(s) {
    var out = [], acc = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var v = B64.indexOf(s[i]); if (v < 0) return null;
      acc = (acc << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    return out;
  }
  function utf8(s) { var o = []; s = unescape(encodeURIComponent(s)); for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i)); return o; }
  function unutf8(a) { try { return decodeURIComponent(escape(String.fromCharCode.apply(null, a))); } catch (e) { return ""; } }
  function c8(v) { return Math.max(0, Math.min(255, Math.round(v * 255))); }
  function q16(v, lo, hi) { return Math.max(0, Math.min(65535, Math.round((v - lo) / (hi - lo) * 65535))); }
  function u16(v, lo, hi) { return lo + v / 65535 * (hi - lo); }

  // pal: { hero, skin, name, fx: [r,g,b]|null, parts: [{ c: [x,y,z], vref, on, lit: [r,g,b], sh: [r,g,b]|null, dk: [r,g,b] }],
  //        glow: { X|Y|Z|A|W: [r,g,b] }|null }  (W: the line mask, plain _Emission; colours 0-1; the hero's own glow strength is kept when worn)
  var GLOW_CH = ["X", "Y", "Z", "A", "W"];
  function emProp(ch) { return "_Emission" + (ch == "W" ? "" : ch); }
  M.encode = function (pal) {
    var b = [1], nm = utf8(safe(pal.name)).slice(0, 40);
    b.push(pal.hero >>> 24 & 255, pal.hero >>> 16 & 255, pal.hero >>> 8 & 255, pal.hero & 255);
    b.push((pal.skin >> 8) & 255, pal.skin & 255, nm.length); b = b.concat(nm);
    b.push(pal.fx ? 1 : 0); if (pal.fx) b.push(c8(pal.fx[0]), c8(pal.fx[1]), c8(pal.fx[2]));
    var ps = pal.parts.slice(0, MAXP); b.push(ps.length);
    ps.forEach(function (p) {
      [q16(p.c[0], -1, 1), q16(p.c[1], -1, 1), q16(p.c[2], 0, 0.35)].forEach(function (q) { b.push(q >> 8, q & 255); });
      var dk = p.dk && (p.dk[0] || p.dk[1] || p.dk[2]);
      b.push(c8(p.vref), (p.on ? 1 : 0) | (p.on && p.sh ? 2 : 0) | (p.on && dk ? 4 : 0));
      if (p.on) { b.push(c8(p.lit[0]), c8(p.lit[1]), c8(p.lit[2])); if (p.sh) b.push(c8(p.sh[0]), c8(p.sh[1]), c8(p.sh[2])); if (dk) b.push(c8(p.dk[0]), c8(p.dk[1]), c8(p.dk[2])); }
    });
    // the glow: a bit per emission channel, then its colour (codes made before the glow end at the parts)
    var gm = 0, gl = pal.glow || {}; GLOW_CH.forEach(function (ch, i) { if (gl[ch]) gm |= 1 << i; }); if (pal.glow && pal.glow2) gm |= 32;
    b.push(gm); GLOW_CH.forEach(function (ch) { if (gl[ch]) b.push(c8(gl[ch][0]), c8(gl[ch][1]), c8(gl[ch][2])); });
    var sum = 0; b.forEach(function (x) { sum = (sum + x) & 255; }); b.push(sum);
    return "BBP1-" + b64(b);
  };
  M.decode = function (code) {
    try {
      code = String(code || "").replace(/\s+/g, "");
      var m = /BBP1-([A-Za-z0-9_\-]+)/.exec(code); if (!m) return null;
      var b = unb64(m[1]); if (!b || b.length < 12) return null;
      var sum = 0; for (var i = 0; i < b.length - 1; i++) sum = (sum + b[i]) & 255;
      if (sum != b[b.length - 1] || b[0] != 1) return null;
      var at = 1; function u8() { if (at >= b.length - 1) throw "short"; return b[at++]; }
      function rgb() { return [u8() / 255, u8() / 255, u8() / 255]; }
      var pal = { hero: ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0 };
      pal.skin = (u8() << 8) | u8();
      var nl = u8(), nm = []; for (var k = 0; k < nl; k++) nm.push(u8()); pal.name = safe(unutf8(nm));
      pal.fx = u8() & 1 ? rgb() : null;
      var n = u8(); if (n < 1 || n > MAXP) return null;
      pal.parts = [];
      for (var j = 0; j < n; j++) {
        var c = [u16((u8() << 8) | u8(), -1, 1), u16((u8() << 8) | u8(), -1, 1), u16((u8() << 8) | u8(), 0, 0.35)];
        var vref = u8() / 255, f = u8(), p = { c: c, vref: vref, on: !!(f & 1), lit: null, sh: null, dk: [0, 0, 0] };
        if (p.on) { p.lit = rgb(); if (f & 2) p.sh = rgb(); if (f & 4) p.dk = rgb(); }
        pal.parts.push(p);
      }
      pal.glow = null;
      if (at < b.length - 1) { var gm = u8(); GLOW_CH.forEach(function (ch, i) { if (gm & 1 << i) (pal.glow = pal.glow || {})[ch] = rgb(); }); if (gm & 32) pal.glow2 = true; }
      if (at != b.length - 1) return null;
      return pal;
    } catch (e) { return null; }
  };

  // ------------------------------------------------------------------ the painter
  M.mat = function () {
    if (M._mat && !isNull(M._mat)) return M._mat;
    // the material rides on a prefab: the asset manager returned null for a material loaded by path
    var m = null, go = null;
    try { go = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(UE.GameObject), "Palette/PalRecolour"); } catch (e) {}
    if (isNull(go) && G.BBPAL_DEV_BUNDLE) {       // a test window: the bundle straight from the uikit build
      try {
        if (!G.BBPAL_AB || isNull(G.BBPAL_AB)) G.BBPAL_AB = UE.AssetBundle.LoadFromFile(G.BBPAL_DEV_BUNDLE, 0, 0);
        var all = G.BBPAL_AB.LoadAllAssets(T(UE.GameObject)); if (all.Length) go = all.get_Item(0);
      } catch (e) { log("dev bundle: " + es(e)); }
    }
    try { if (!isNull(go)) m = go.GetComponent(T(UE.MeshRenderer)).sharedMaterial; } catch (e) {}
    if (isNull(m)) { log("the painter's material did not load"); return null; }
    M._mat = new UE.Material(m); M._mat.name = "PalRecolour (palette-maker)";
    return M._mat;
  };
  function v4arr(list) {
    var a = cs.System.Array.CreateInstance(T(UE.Vector4), MAXP);
    for (var i = 0; i < MAXP; i++) { var v = list[i] || [0, 0, 0, 0]; a.SetValue(new UE.Vector4(v[0], v[1], v[2], v[3]), i); }
    return a;
  }
  function setPal(mat, pal) {
    var ps = pal.parts;
    mat.SetFloat("_N", ps.length); mat.SetFloat("_Tau", TAU);
    mat.SetFloat("_IsLinear", UE.QualitySettings.activeColorSpace == UE.ColorSpace.Linear ? 1 : 0);
    mat.SetVectorArray("_PartC", v4arr(ps.map(function (p) { return [p.c[0], p.c[1], p.c[2], Math.max(p.vref, 0.02)]; })));
    mat.SetVectorArray("_Lit", v4arr(ps.map(function (p) { return p.on ? [p.lit[0], p.lit[1], p.lit[2], 1] : [0, 0, 0, 0]; })));
    mat.SetVectorArray("_Shadow", v4arr(ps.map(function (p) { return p.on && p.sh ? [p.sh[0], p.sh[1], p.sh[2], 1] : [0, 0, 0, 0]; })));
    mat.SetVectorArray("_Dark", v4arr(ps.map(function (p) { return p.on ? [p.dk[0], p.dk[1], p.dk[2], 1] : [0, 0, 0, 0]; })));
  }
  // sub: one texture family of the hero and our painted copy of it (a hero can draw from several: below)
  function paintPage(st, sub, i) {
    if (i >= sub.exN) return false;
    var src = sub.base.get_Item(i), ex = sub.extra ? sub.extra.get_Item(i) : null;
    if (isNull(src) || isNull(ex)) return false;
    var sc = st.scale || SCALE, w = Math.max(64, src.width / sc | 0), h = Math.max(64, src.height / sc | 0), mat = M.mat(); if (!mat) throw "no painter";
    setPal(mat, st.pal); mat.SetTexture("_ExtraTex", ex);
    var rt = UE.RenderTexture.GetTemporary(w, h, 0, UE.RenderTextureFormat.ARGB32, UE.RenderTextureReadWrite.Linear);
    try {
      UE.Graphics.Blit(src, rt, mat);
      var old = sub.mine[i];
      if (old && !isNull(old) && old.width == w && old.height == h && M.copyOk) {   // a repaint while editing: same texture
        UE.Graphics.CopyTexture(rt, 0, 0, old, 0, 0); sub.arr.SetValue(old, i); return true;
      }
      var dst = new UE.Texture2D(w, h, UE.TextureFormat.RGBA32, false, true);
      dst.name = src.name + "_pm"; dst.filterMode = src.filterMode; dst.wrapMode = src.wrapMode;
      if (M.copyOk !== false) {
        // the two-argument CopyTexture is stripped from the game's build; the element and mip one is there
        try { dst.Apply(false, true); UE.Graphics.CopyTexture(rt, 0, 0, dst, 0, 0); M.copyOk = true; }
        catch (e) { M.copyOk = false; log("copy on the card failed, reading back instead: " + es(e)); UE.Object.Destroy(dst); dst = new UE.Texture2D(w, h, UE.TextureFormat.RGBA32, false, true); dst.name = src.name + "_pm"; }
      }
      if (M.copyOk === false) { var prev = UE.RenderTexture.active; UE.RenderTexture.active = rt; dst.ReadPixels(new UE.Rect(0, 0, w, h), 0, 0); dst.Apply(false, true); UE.RenderTexture.active = prev; }
      if (sub.mine[i] && !isNull(sub.mine[i])) UE.Object.Destroy(sub.mine[i]);
      sub.mine[i] = dst; sub.arr.SetValue(dst, i);
      return true;
    } finally { UE.RenderTexture.ReleaseTemporary(rt); }
  }

  // ------------------------------------------------------------------ colour parts of a palette, found in game
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function feat(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, s = mx > 1e-6 ? d / mx : 0, h = 0;
    if (d > 1e-6) h = mx == r ? ((g - b) / d + 6) % 6 : mx == g ? (b - r) / d + 2 : (r - g) / d + 4;
    var a = h * Math.PI / 3, c = s * Math.min(mx * 2.5, 1);
    return [c * Math.cos(a), c * Math.sin(a), mx * 0.35, mx];
  }
  function bytesOf(tex) {
    var raw = null; try { raw = tex.GetRawTextureData(); } catch (e) {}
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    var px = tex.GetPixels32(), out = new Uint8Array(px.Length * 4);
    for (var i = 0; i < px.Length; i++) { var c = px.get_Item(i); out[i * 4] = c.r; out[i * 4 + 1] = c.g; out[i * 4 + 2] = c.b; out[i * 4 + 3] = c.a; }
    return out;
  }
  function sample(tex, n) {
    var rt = UE.RenderTexture.GetTemporary(n, n, 0, UE.RenderTextureFormat.ARGB32, UE.RenderTextureReadWrite.Linear), prev = UE.RenderTexture.active;
    var t = new UE.Texture2D(n, n, UE.TextureFormat.RGBA32, false, true);
    try { UE.Graphics.Blit(tex, rt); UE.RenderTexture.active = rt; t.ReadPixels(new UE.Rect(0, 0, n, n), 0, 0); t.Apply(false, false); return bytesOf(t); }
    finally { UE.RenderTexture.active = prev; UE.RenderTexture.ReleaseTemporary(rt); UE.Object.Destroy(t); }
  }
  var HUES = [[15, "red"], [40, "orange"], [65, "gold"], [160, "green"], [200, "teal"], [255, "blue"], [290, "purple"], [345, "pink"], [361, "red"]];
  function partName(c) {
    var ch = Math.hypot(c[0], c[1]), v = c[2] / 0.35, hue = (Math.atan2(c[1], c[0]) * 180 / Math.PI + 360) % 360;
    if (ch < 0.08) return v < 0.22 ? "dark" : v < 0.68 ? "grey" : "white";
    if ((hue < 45 || hue > 330) && ch < 0.45 && v > 0.45) return "skin";
    var nm = "red"; for (var i = 0; i < HUES.length; i++) if (hue < HUES[i][0]) { nm = HUES[i][1]; break; }
    return v < 0.35 ? "deep " + nm : nm;
  }
  // the same steps as palette.py find_parts: k-means++ in the feature space, close centres merged, small parts folded in
  function famLen(f) { var n = 0; try { n = f._textures.Length; } catch (e) {} if (!n) try { n = f.textureRefs.Length; } catch (e) {} return n; }
  // fams: [{ base, extra }], one per texture family the hero draws from. One family: 8 pages spread over it, as
  // always; several (Susanoo, EX Hakumen: ha, su and su01): pages from each in proportion, at least 2 from each
  M.findParts = function (fams) {
    var pick = [], tot = 0;
    fams.forEach(function (fm) { fm.n = Math.min(famLen(fm.base), famLen(fm.extra) || famLen(fm.base)); tot += fm.n; });
    fams.forEach(function (fm) {
      var want = fams.length == 1 ? 8 : Math.max(2, Math.round(12 * fm.n / Math.max(1, tot))), step = Math.max(1, fm.n / want), k = 0;
      for (var f = 0; f < fm.n && k < want; f += step, k++) pick.push([fm, f | 0]);
    });
    var X = [], V = [], C = [], R = 160;
    pick.forEach(function (pk) {
      var i = pk[1], s = pk[0].base.get_Item(i), e = pk[0].extra.get_Item(i); if (isNull(s) || isNull(e)) return;
      var a = sample(s, R), al = sample(e, R);
      for (var k = 0; k < R * R; k++) {
        var aa = al[k * 4 + 3] / 255; if (aa < 0.95) continue;
        var r = Math.min(1, a[k * 4] / 255 / aa), g = Math.min(1, a[k * 4 + 1] / 255 / aa), b = Math.min(1, a[k * 4 + 2] / 255 / aa), ft = feat(r, g, b);
        X.push([ft[0], ft[1], ft[2]]); V.push(ft[3]); C.push([r, g, b]);
      }
    });
    if (X.length < 200) throw "too few visible pixels (" + X.length + ")";
    var rnd = rng(7);
    if (X.length > 30000) { var keep = []; for (var q = 0; q < 30000; q++) keep.push(Math.floor(rnd() * X.length)); X = keep.map(function (i) { return X[i]; }); V = keep.map(function (i) { return V[i]; }); C = keep.map(function (i) { return C[i]; }); }
    function d2(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }
    var K = 12, cen = [X[Math.floor(rnd() * X.length)]];
    while (cen.length < K) {
      var ds = X.map(function (x) { var m = 9; cen.forEach(function (c) { m = Math.min(m, d2(x, c)); }); return m; }), tot = ds.reduce(function (s, v) { return s + v; }, 0), r = rnd() * tot, j = 0;
      while (j < ds.length - 1 && (r -= ds[j]) > 0) j++;
      cen.push(X[j]);
    }
    var lab = new Int32Array(X.length);
    function assign() { for (var i = 0; i < X.length; i++) { var b = 0, bd = 9; for (var c = 0; c < cen.length; c++) { var dd = d2(X[i], cen[c]); if (dd < bd) { bd = dd; b = c; } } lab[i] = b; } }
    function means() { var s = cen.map(function () { return [0, 0, 0, 0]; }); for (var i = 0; i < X.length; i++) { var t = s[lab[i]]; t[0] += X[i][0]; t[1] += X[i][1]; t[2] += X[i][2]; t[3]++; } cen = cen.map(function (c, k) { var t = s[k]; return t[3] ? [t[0] / t[3], t[1] / t[3], t[2] / t[3]] : c; }); return s.map(function (t) { return t[3]; }); }
    for (var it = 0; it < 20; it++) { assign(); means(); }
    for (var guard = 0; guard < 40; guard++) {
      var cnt = means(), bi = -1, bj = -1, bd = 9, small = 0;
      for (var a1 = 0; a1 < cen.length; a1++) { if (cnt[a1] < cnt[small]) small = a1; for (var a2 = a1 + 1; a2 < cen.length; a2++) { var dd = Math.sqrt(d2(cen[a1], cen[a2])); if (dd < bd) { bd = dd; bi = a1; bj = a2; } } }
      var from = -1, to = -1;
      if (bd < 0.07) { from = bj; to = bi; }
      else if (cnt[small] / X.length < 0.012) { from = small; var nd = 9; cen.forEach(function (c, k) { if (k != small) { var dd = d2(c, cen[small]); if (dd < nd) { nd = dd; to = k; } } }); }
      if (from < 0 || cen.length < 3) break;
      for (var i2 = 0; i2 < X.length; i2++) { if (lab[i2] == from) lab[i2] = to; if (lab[i2] > from) lab[i2]--; }
      cen.splice(from, 1); means();
    }
    var cnt2 = means(), order = cen.map(function (c, k) { return k; }).sort(function (a, b) { return cnt2[b] - cnt2[a]; }), seen = {};
    return order.map(function (k) {
      var vs = [], cols = [];
      for (var i = 0; i < X.length; i++) if (lab[i] == k) { vs.push(V[i]); cols.push(C[i]); }
      var sorted = vs.slice().sort(function (a, b) { return a - b; }), vref = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 0.5;
      var top = cols.filter(function (c, i) { return vs[i] >= vref * 0.8; }); if (!top.length) top = cols;
      var med = [0, 1, 2].map(function (ch) { var a = top.map(function (c) { return c[ch]; }).sort(function (x, y) { return x - y; }); return a[a.length >> 1] || 0; });
      var nm = partName(cen[k]); seen[nm] = (seen[nm] || 0) + 1; if (seen[nm] > 1) nm += " " + seen[nm];
      return { name: nm, c: cen[k].map(function (v) { return Math.round(v * 10000) / 10000; }), vref: Math.round(vref * 1000) / 1000, share: Math.round(cnt2[k] / X.length * 1000) / 1000, base: med };
    });
  };
  // a hero's parts for the palette it wears, kept in a file so they are found once
  // (a file made before 0.2.5 for a hero of several families holds the parts of one of them only: found again)
  M.parts = function (actor) {
    var v = actor.ActorModel.Renderer, hero = actor.BaseID, skin = String(v.Skin), key = hero + "_" + skin;
    if (M.partsCache[key]) return M.partsCache[key];
    var fams = M.families(actor), names = fams.map(function (fm) { return String(fm.base.name); });
    var f = M.dir() + "/parts/" + key + ".json", got = readJ(f, null);
    if (got && got.v == 1 && (fams.length == 1 || String(got.families) == String(names))) return (M.partsCache[key] = got.parts);
    var t0 = Date.now(), ps = M.findParts(fams);
    var rec = { v: 1, hero: hero, skin: skin, family: names[0], parts: ps }; if (fams.length > 1) rec.families = names;
    writeJ(f, rec);
    log("found " + ps.length + " colour parts of hero " + hero + " palette " + skin + " (" + names.join(", ") + ") in " + (Date.now() - t0) + " ms");
    return (M.partsCache[key] = ps);
  };
  // a fresh palette from the parts: every part kept as it is
  M.blank = function (actor, name) {
    var ps = M.parts(actor);
    return { hero: actor.BaseID, skin: parseInt(String(actor.ActorModel.Renderer.Skin)) || 0, name: name || "My palette", fx: null,
      parts: ps.slice(0, MAXP).map(function (p) { return { c: p.c.slice(), vref: p.vref, on: false, lit: p.base.slice(), sh: null, dk: [0, 0, 0], name: p.name, base: p.base.slice(), share: p.share }; }) };
  };

  // The texture families a hero draws from. Most heroes have one. A hero whose clips come from several animation roles
  // (Susanoo and EX Hakumen: ha, su, su01) has one per role: the renderer changes to the role's family "<role>_<skin>"
  // whenever a clip of another role starts (PaletteFrameVisual.UpdateTextureFamily), even while standing. Each gets its
  // own painted copy, so the palette stays on through every change. Extra pages are per role ("<role>_Extra").
  var FAM = "Actor/TextureFamily/";
  function loadFam(name) {
    try { var f = require("Core/Util").U.GetSingleton(cs.NOAH.Asset.AssetManagerBase).LoadAssetByType(T(cs.NOAH.Animation2DEditor.PaletteTextureFamily), FAM + name); return isNull(f) ? null : f; } catch (e) { return null; }
  }
  function rolesOf(actor) {
    var out = [];
    try { var j = actor.ActionMgr.ActionGroup.AnimationJsons; for (var i = 0; i < j.Length; i++) { var r = String(j.get_Item(i) || ""); if (r && out.indexOf(r) < 0) out.push(r); } } catch (e) {}
    return out;
  }
  // the role of a family name and the skin part after it ("su01_90" -> su01, 90); the longest role that fits
  function splitFam(roles, name) {
    var best = null; name = String(name);
    roles.forEach(function (r) { if (name.indexOf(r + "_") == 0 && (!best || r.length > best.length)) best = r; });
    return best ? { role: best, skin: name.slice(best.length + 1) } : null;
  }
  // [{ base, extra }]: the family on the renderer first (the original, when one of our copies is on it)
  M.families = function (actor) {
    var v = actor.ActorModel.Renderer, st = stateOf(actor), cur = v.MainTextrues, sub = st && subOf(st, cur);
    var base = sub ? sub.base : cur, out = [{ base: base, extra: v.ExtraTextures }];
    var roles = rolesOf(actor), sp = base && !isNull(base) ? splitFam(roles, base.name) : null;
    if (!sp || roles.length < 2) return out;
    out[0].extra = loadFam(sp.role + "_Extra") || v.ExtraTextures;
    roles.forEach(function (r) {
      if (r == sp.role) return;
      var b = loadFam(r + "_" + sp.skin), x = b && loadFam(r + "_Extra");
      if (b && x) out.push({ base: b, extra: x });
    });
    return out;
  };

  // ------------------------------------------------------------------ wearing a palette
  function stateOf(actor) { for (var i = 0; i < M.states.length; i++) if (M.states[i].actor === actor || (M.states[i].actor && M.states[i].actor.Equals && M.states[i].actor.Equals(actor))) return M.states[i]; return null; }
  // the sub of a family on the renderer: our copy, or the original it was made from (by name: the game may hand back
  // another object of the same family)
  function subOf(st, f) {
    if (!f || isNull(f)) return null;
    var nm = String(f.name);
    for (var i = 0; i < st.subs.length; i++) { var s = st.subs[i]; if (f.Equals(s.cp) || f.Equals(s.base) || nm == s.name) return s; }
    return null;
  }
  function newSub(st, base, extra) {
    var n = famLen(base), cp = UE.Object.Instantiate(base); cp.name = String(base.name) + "_pm";
    var arr = cs.System.Array.CreateInstance(T(UE.Texture2D), n); cp._textures = arr;
    var sub = { name: String(base.name), base: base, extra: extra, exN: extra ? famLen(extra) : 0, cp: cp, arr: arr, n: n, mine: [] };
    st.subs.push(sub); return sub;
  }
  // every page the game has loaded, painted now; the others as they load
  function paintAll(st, sub) {
    var have = sub.base._textures, painted = 0;
    for (var i = 0; i < sub.n; i++) {
      var t = have && have.get_Item(i);
      if (t && !isNull(t) && paintPage(st, sub, i)) painted++;
      else if (sub.mine[i]) { UE.Object.Destroy(sub.mine[i]); sub.mine[i] = null; sub.arr.SetValue(null, i); }
    }
    return painted;
  }
  // a family the renderer changed to: one of this hero's roles on the same skin, or not
  function sameSkin(st, f) {
    if (!st.skinPart) return false;
    var sp = splitFam(st.roles, f.name); return !!sp && sp.skin == st.skinPart;
  }
  function release(st, why) {
    try { glowBack(st); fxBack(st); } catch (e) {}
    try {
      if (!isNull(st.v)) { var cur = st.v.MainTextrues, s = subOf(st, cur); if (s && !isNull(s.base)) st.v.MainTextrues = s.base; }
    } catch (e) {}
    st.subs.forEach(function (s) {
      s.mine.forEach(function (t) { try { if (t) UE.Object.Destroy(t); } catch (e) {} });
      try { if (s.cp) UE.Object.Destroy(s.cp); } catch (e) {}
    });
    var i = M.states.indexOf(st); if (i >= 0) M.states.splice(i, 1);
    if (why) log("base palette back on hero " + st.hero + ": " + why);
  }
  M.releaseAll = function () { M.states.slice().forEach(function (s) { release(s); }); };
  // paint pal onto actor; returns true when worn. Anything wrong: the base palette, and the reason in the log
  M.wear = function (actor, pal, quiet) {
    var st = stateOf(actor);
    try {
      if (!actor || isNull(actor) || !pal) { if (st) release(st, "nothing to wear"); return false; }
      var v = actor.ActorModel.Renderer, skin = parseInt(String(v.Skin)) || 0;
      if (pal.hero != actor.BaseID) { if (st) release(st, "palette is for hero " + pal.hero); return false; }
      if (pal.skin != skin) { if (st) release(st, "palette was made on palette " + pal.skin + ", the hero wears " + skin); if (!quiet) log("palette " + pal.name + " is made on palette " + pal.skin + "; hero " + actor.BaseID + " wears " + skin + ": base kept"); return false; }
      if (!st) {
        if (isNull(v.MainTextrues)) return false;
        var fams = M.families(actor), roles = rolesOf(actor), sp = splitFam(roles, fams[0].base.name);
        // the player's own hero at full size: cutscene cameras close in on it (blurry at half size, Aneubys 10-21)
        var own = false; try { var me = M.me(); own = !!me && me.Equals(actor); } catch (e) {}
        // ...within OWN_MB of video memory (Hakumen EX: 28 pages, 852 MB at full size, so about 0.78 of it); a hero
        // of several families within twice that over all of them (Susanoo: 64 pages, half size)
        var px = 0, k = 0, n = 0;
        fams.forEach(function (fm) {
          // famLen falls back on textureRefs while _textures is still empty (a hero reloading, as after a full hot load),
          // so the pages read here stop at what _textures holds ("wearing failed: array.get ... Index", window 3, 11-12)
          var ln = famLen(fm.base), tl = 0; n += ln; try { tl = fm.base._textures ? fm.base._textures.Length : 0; } catch (e) {}
          for (var j = 0; j < Math.min(ln, tl); j++) { var t = fm.base._textures.get_Item(j); if (t && !isNull(t)) { px += t.width * t.height; k++; } }
        });
        var full = k ? px / k * n * 4 / 1048576 : 0, sc = own ? Math.max(1, Math.sqrt(full / (OWN_MB * Math.min(2, fams.length)))) : SCALE;
        st = { actor: actor, hero: actor.BaseID, v: v, subs: [], roles: roles, skinPart: fams.length > 1 && sp ? sp.skin : null, pal: pal, fxAt: 0, scale: sc };
        fams.forEach(function (fm) { newSub(st, fm.base, fm.extra); });
        M.states.push(st);
      }
      st.pal = pal;
      var painted = 0;
      st.subs.forEach(function (s) { painted += paintAll(st, s); });
      var on = subOf(st, st.v.MainTextrues) || st.subs[0]; st.v.MainTextrues = on.cp;
      var m0 = on.mine.filter(function (t) { return t; })[0];
      if (!quiet) log("wearing " + pal.name + " on hero " + st.hero + " (palette " + pal.skin + "): " + painted + " page(s) painted now" + (st.subs.length > 1 ? " over " + st.subs.length + " families" : "") + ", the rest as they load" + (m0 ? ", " + m0.width + "x" + m0.height + " each" : ""));
      return true;
    } catch (e) {
      log("wearing failed: " + es(e)); if (st) release(st, "error"); return false;
    }
  };
  // The worn palette is put back on the player's hero by itself (M.sync, every half second, through a hero reload too),
  // and since 0.2.7 says so in the log. unwear(actor, true) takes it off and keeps it off for that hero until a palette
  // is worn again; M.hold(true) keeps every worn palette off the player's hero (test windows, captures). The game's
  // palette selector and the maker call unwear() plain: their own close puts the worn palette back.
  M.held = {}; M.holdAll = false;
  M.unwear = function (actor, hold) {
    var st = stateOf(actor); if (st) release(st, "taken off" + (hold ? ", held off" : ""));
    try { if (hold && actor && !isNull(actor)) M.held[actor.BaseID] = M.wornCode(actor.BaseID) || "-"; } catch (e) {}
  };
  M.hold = function (on) {
    M.holdAll = !!on; log(on ? "worn palettes held off the player's hero" : "worn palettes back on");
    if (on) { var a = M.me(); if (a) { var st = stateOf(a); if (st) release(st, "held off"); } }
  };
  M.stateOf = stateOf;

  // the page the hero draws now: its material's main texture is one of ours
  function curPage(st, sub) {
    try {
      if (!st.mr || isNull(st.mr)) { var rs = st.v.gameObject.GetComponentsInChildren(T(UE.Renderer), true); for (var i = 0; i < rs.Length; i++) { var m = rs.get_Item(i).sharedMaterial; if (m && m.HasProperty("_MainTex")) { st.mr = rs.get_Item(i); break; } } }
      var t = st.mr && st.mr.sharedMaterial && st.mr.sharedMaterial.mainTexture;
      if (t) for (var k = 0; k < sub.n; k++) if (sub.mine[k] && t.Equals(sub.mine[k])) return k;
    } catch (e) {}
    return -1;
  }
  // live preview while editing: the page on screen at once, the others a few a frame once the edits pause
  M.preview = function (actor, pal) {
    var st = stateOf(actor);
    if (!st) return M.wear(actor, pal, true);
    st.pal = pal; st.editAt = Date.now();
    st.subs.forEach(function (s) { s.dirty = {}; for (var i = 0; i < s.n; i++) if (s.mine[i]) s.dirty[i] = 1; });
    var on = subOf(st, st.v.MainTextrues);
    if (on) { var c = curPage(st, on); if (c >= 0) { try { paintPage(st, on, c); } catch (e) { log("preview: " + es(e)); } delete on.dirty[c]; } }
    return true;
  };

  // ------------------------------------------------------------------ the colour part under the pointer
  // The hero is drawn as one mesh per frame (PaletteFrameVisual.MeshFilter) textured from one page of its family. The
  // pointer's ray meets the mesh's plane, the triangle under it gives the page's uv, and the hero's own page (the base,
  // before our painting) and its extra page's alpha are read there. The colour goes to the nearest part centre in the
  // feature space findParts and the shader use, so the part picked is the one that paints that pixel.
  function texel(tex, u, v) {
    var w = tex.width, h = tex.height, prev = UE.RenderTexture.active;
    var rt = UE.RenderTexture.GetTemporary(1, 1, 0, UE.RenderTextureFormat.ARGB32, UE.RenderTextureReadWrite.Linear), t = new UE.Texture2D(1, 1, UE.TextureFormat.RGBA32, false, true);
    try {
      UE.Graphics.Blit(tex, rt, new UE.Vector2(1 / w, 1 / h), new UE.Vector2(u - 0.5 / w, v - 0.5 / h));
      UE.RenderTexture.active = rt; t.ReadPixels(new UE.Rect(0, 0, 1, 1), 0, 0); t.Apply(false, false);
      var b = bytesOf(t); return [b[0], b[1], b[2], b[3]];
    } finally { UE.RenderTexture.active = prev; UE.RenderTexture.ReleaseTemporary(rt); UE.Object.Destroy(t); }
  }
  // the page on screen now and its extra page: through our copy when one is worn, else the hero's own family
  function drawnPage(actor) {
    var v = actor.ActorModel.Renderer, mr = v.MeshRenderer, t = mr && mr.sharedMaterial && mr.sharedMaterial.mainTexture; if (!t) return null;
    var st = stateOf(actor), on = st && subOf(st, v.MainTextrues);
    if (on) { var k = curPage(st, on); if (k >= 0) return { base: on.base.get_Item(k), extra: on.extra ? on.extra.get_Item(k) : null }; }
    var f = v.MainTextrues, have = f && f._textures, n = have ? have.Length : 0;
    for (var i = 0; i < n; i++) { var p = have.get_Item(i); if (p && !isNull(p) && t.Equals(p)) return { base: p, extra: v.ExtraTextures ? v.ExtraTextures.get_Item(i) : null }; }
    return null;
  }
  // { part: index in pal.parts (-1: none near), rgb } for the screen point (sx, sy), or null when the hero is not there
  M.partAt = function (actor, pal, sx, sy) {
    var v = actor.ActorModel.Renderer, mr = v.MeshRenderer, mf = v.MeshFilter, mesh = mf && !isNull(mf) ? mf.sharedMesh : null, cam = UE.Camera.main;
    if (!mesh || isNull(mesh) || !cam || isNull(cam) || !pal) return null;
    var ray = cam.ScreenPointToRay(new UE.Vector3(sx, sy, 0)), o = ray.origin, d = ray.direction, tr = mr.transform;
    var p1 = tr.InverseTransformPoint(o), p2 = tr.InverseTransformPoint(new UE.Vector3(o.x + d.x * 100, o.y + d.y * 100, o.z + d.z * 100));
    var vs = mesh.vertices, uvs = mesh.uv, tri = mesh.triangles; if (!vs.Length || uvs.Length != vs.Length) return null;
    var z0 = vs.get_Item(0).z, dz = p2.z - p1.z; if (Math.abs(dz) < 1e-6) return null;
    var k = (z0 - p1.z) / dz, x = p1.x + (p2.x - p1.x) * k, y = p1.y + (p2.y - p1.y) * k;
    var pg = null;
    // the last triangle drawn under the point that is not see-through there
    for (var i = tri.Length - 3; i >= 0; i -= 3) {
      var ia = tri.get_Item(i), ib = tri.get_Item(i + 1), ic = tri.get_Item(i + 2), A = vs.get_Item(ia), B = vs.get_Item(ib), Cc = vs.get_Item(ic);
      var x0 = B.x - A.x, y0 = B.y - A.y, x1 = Cc.x - A.x, y1 = Cc.y - A.y, x2 = x - A.x, y2 = y - A.y, den = x0 * y1 - x1 * y0;
      if (Math.abs(den) < 1e-12) continue;
      var wb = (x2 * y1 - x1 * y2) / den, wc = (x0 * y2 - x2 * y0) / den, wa = 1 - wb - wc;
      if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) continue;
      if (!pg) { pg = drawnPage(actor); if (!pg || isNull(pg.base)) return null; }
      var ua = uvs.get_Item(ia), ub = uvs.get_Item(ib), uc = uvs.get_Item(ic);
      var u = ua.x * wa + ub.x * wb + uc.x * wc, w = ua.y * wa + ub.y * wb + uc.y * wc;
      var col = texel(pg.base, u, w), al = (pg.extra && !isNull(pg.extra) ? texel(pg.extra, u, w)[3] : col[3]) / 255;
      if (al < 0.3) continue;
      var rgb = [Math.min(1, col[0] / 255 / al), Math.min(1, col[1] / 255 / al), Math.min(1, col[2] / 255 / al)], ft = feat(rgb[0], rgb[1], rgb[2]);
      var best = -1, bd = 9;
      pal.parts.forEach(function (p, j) { var a0 = ft[0] - p.c[0], a1 = ft[1] - p.c[1], a2 = ft[2] - p.c[2], dd = a0 * a0 + a1 * a1 + a2 * a2; if (dd < bd) { bd = dd; best = j; } });
      return { part: best, rgb: rgb, dist: Math.sqrt(bd) };
    }
    return null;
  };

  // ------------------------------------------------------------------ the glow
  // A hero's glow is its sprite material's emission (Mai's pink: _EmissionX and _EmissionY at 1.27, 0.38, 1.5), drawn
  // through masks in its extra pages, so the colour parts never reach it. Channels of one colour make one glow entry.
  function heroRenderer(v) {
    var rs = v.gameObject.GetComponentsInChildren(T(UE.Renderer), true);
    for (var i = 0; i < rs.Length; i++) { var m = rs.get_Item(i).sharedMaterial; if (m && !isNull(m) && m.HasProperty("_EmissionX")) return rs.get_Item(i); }
    return null;
  }
  function cArr(c) { return [c.r, c.g, c.b, c.a]; }
  M.glowParts = function (actor) {
    var out = [];
    try {
      var r = heroRenderer(actor.ActorModel.Renderer); if (!r) return out; var m = r.sharedMaterial;
      GLOW_CH.forEach(function (ch) {
        var c = cArr(m.GetColor(emProp(ch))), mx = Math.max(c[0], c[1], c[2]); if (mx < 0.03) return;
        var base = [c[0] / mx, c[1] / mx, c[2] / mx];
        var same = out.filter(function (g) { return Math.abs(g.max - mx) < 0.01 && [0, 1, 2].every(function (k) { return Math.abs(g.base[k] - base[k]) < 0.01; }); })[0];
        if (same) same.chs.push(ch); else out.push({ chs: [ch], base: base, max: mx });
      });
    } catch (e) { log("glow: " + es(e)); }
    return out;
  };
  // worn: each changed channel at its own strength in the new colour, through the renderer's property block (read,
  // changed, written back, so what the game puts there stays)
  function glowApply(st) {
    var r = st.gr && !isNull(st.gr) ? st.gr : (st.gr = heroRenderer(st.v)); if (!r) return;
    var m = r.sharedMaterial, blk = M._gblk || (M._gblk = new UE.MaterialPropertyBlock()), g = st.pal.glow;
    // 0.2.11: the hero's own glow is read from the material it draws with NOW. Each palette of a hero has its own material, and
    // the glow read for the first palette worn stayed in st.glowOrig, so every other palette's channels were written back in
    // that palette's colour (j!, Jin: "all the other palettes' glow effects changed to the edited one's original colour")
    var mid = m.GetInstanceID();
    if (!st.glowOrig || st.glowMat !== mid) { st.glowOrig = {}; st.glowMat = mid; GLOW_CH.forEach(function (ch) { st.glowOrig[ch] = m.GetColor(emProp(ch)); }); }
    r.GetPropertyBlock(blk);
    // codes made before 0.2.4 have no W: the line followed X then, and still does for them
    var old = !st.pal.glow2 && !g.W && g.X;
    GLOW_CH.forEach(function (ch) {
      var o = st.glowOrig[ch], src = ch == "W" && old ? st.glowOrig.X : o, mx = Math.max(src.r, src.g, src.b), c = ch == "W" && old ? g.X : g[ch];
      blk.SetColor(emProp(ch), c && mx >= 0.03 ? new UE.Color(c[0] * mx, c[1] * mx, c[2] * mx, o.a) : o);
    });
    r.SetPropertyBlock(blk); st.glowOn = true;
  }
  function glowBack(st) {
    if (!st.glowOn || !st.gr || isNull(st.gr) || !st.glowOrig) return;
    var blk = M._gblk || (M._gblk = new UE.MaterialPropertyBlock()); st.gr.GetPropertyBlock(blk);
    var cm = null; try { cm = st.gr.sharedMaterial; } catch (e) {}
    GLOW_CH.forEach(function (ch) {
      // the colour of the material the renderer draws with now; the saved one only while it is still the same material
      var c = cm && !isNull(cm) ? cm.GetColor(emProp(ch)) : st.glowOrig[ch];
      blk.SetColor(emProp(ch), c);
    });
    st.gr.SetPropertyBlock(blk); st.glowOn = false;
  }

  // ------------------------------------------------------------------ the effect tint
  // Every live effect from the hero's own effect folder (hubs are named Role.<Hero>.<effect>): action, hit and bullet
  // effects alike. The colour multiplies each layer's own tint, keeping its brightness (Mai's are 3x) and the shading
  // its textures carry.
  // Left out (0.2.7; testers' "squares", measured on Weiss's Jin clones 2026-11-09): layers that draw no shape of their
  // own. Refraction meshes (NOAH/Effect/Variant/Refract, objects Rafract* / Refrac*) bend the screen behind them and light
  // pools (Custom/LightMap, objects linhting*) light it; tinted, each one coloured its whole quad, a rotated square.
  var FX_COL = ["_TintColor", "_BrightColor", "_AmbientColor"];
  var FX_SKIP_SHADER = /Refract|LightMap/i, FX_SKIP_NAME = /^(Rafract|Refrac|linhting|lighting)/i;
  M.fxSkips = function (r, m) {
    try { if (m.shader && FX_SKIP_SHADER.test(String(m.shader.name))) return true; } catch (e) {}
    try { return FX_SKIP_NAME.test(String(r.name)); } catch (e) { return false; }
  };
  function fxPrefix(st) {
    if (st.fxPre) return st.fxPre;
    try { var L = st.actor.EffectMgr.ActionEffectList; for (var i = 0; i < L.Count; i++) { var s = String(L.get_Item(i).Name).split("/"); if (s.length > 2 && s[0] == "Role") return (st.fxPre = "Role." + s[1] + "."); } } catch (e) {}
    return null;
  }
  // tint (col) or put back (null) the layers of one hub. Its record holds the renderers it tinted and whether each had a
  // property block of the game's before: one that had none is cleared when the tint comes off, so a pooled effect keeps
  // nothing of ours (a block holding the material's own colour stayed on it and froze its colour animation).
  // 0.2.12 (catfih, 2026-11: the tint "merges both the base colour of the attack and the new one"): the colour a layer draws is
  // its material tint times its particles' own start colour times its texture. The tint replaced the first only, so a red
  // particle under a blue tint drew dark. Now the effect's own hue is taken out first, on the clones the game plays:
  //   1. each particle system's start colour becomes the grey of the same brightness (the original struct is kept and put back);
  //   2. the layer's material grayscale switch (_EnableGrayscale / _GrayscaleLerp of NOAH/Effect/Variant/Common) is turned on
  //      through the same property block, so a textured colour goes too.
  // Colour over lifetime is not reachable from the scripts' binding; it keeps whatever hue it carries.
  function psGrey(rec, on) {
    if (!rec.ps) {
      rec.ps = []; rec.psDone = false;
      try {
        var ps = rec.hub.GetComponentsInChildren(T(UE.ParticleSystem), true);
        for (var i = 0; i < ps.Length; i++) rec.ps.push({ p: ps.get_Item(i), orig: null });
      } catch (e) { return; }
    }
    var MM = UE.ParticleSystem.MinMaxGradient;
    rec.ps.forEach(function (q) {
      try {
        if (isNull(q.p)) return;
        var m = q.p.main;
        if (on) {
          if (!q.orig) q.orig = m.startColor;
          var c = q.orig.color, mx = Math.max(c.r, c.g, c.b);
          m.startColor = new MM(new UE.Color(mx, mx, mx, c.a));
        } else if (q.orig) { m.startColor = q.orig; q.orig = null; }
      } catch (e) { if (!M.e7) { M.e7 = 1; log("particle colours: " + es(e)); } }
    });
  }
  function tintHub(rec, col) {
    var blk = M._blk || (M._blk = new UE.MaterialPropertyBlock());
    try { if (!M.noGrey) psGrey(rec, !!col); } catch (e) {}
    rec.list.forEach(function (it) {
      var r = it.r; if (isNull(r)) return;
      var m = r.sharedMaterial; if (!m || isNull(m)) return;
      if (!col && !it.had) { r.SetPropertyBlock(null); return; }
      r.GetPropertyBlock(blk);
      it.props.forEach(function (p) {
        var o = m.GetColor(p);
        if (!col) { blk.SetColor(p, o); return; }
        var mx = Math.max(o.r, o.g, o.b, 0.001); blk.SetColor(p, new UE.Color(col[0] * mx, col[1] * mx, col[2] * mx, o.a));
      });
      try {
        if (!M.noGrey && m.HasProperty("_GrayscaleLerp")) { blk.SetFloat("_EnableGrayscale", col ? 1 : m.GetFloat("_EnableGrayscale")); blk.SetFloat("_GrayscaleLerp", col ? 1 : m.GetFloat("_GrayscaleLerp")); }
      } catch (e) {}
      r.SetPropertyBlock(blk);
    });
  }
  function hubRecord(hub) {
    var rs = hub.GetComponentsInChildren(T(UE.Renderer), true), list = [];
    for (var i = 0; i < rs.Length; i++) {
      var r = rs.get_Item(i), m = r.sharedMaterial; if (!m || isNull(m)) continue;
      var props = FX_COL.filter(function (p) { return m.HasProperty(p); }); if (!props.length || M.fxSkips(r, m)) continue;
      var had = true; try { had = r.HasPropertyBlock(); } catch (e) {}
      list.push({ r: r, props: props, had: had });
    }
    return { list: list, key: null, hub: hub };
  }
  // Run just before the frame is drawn (M.pin). Every frame: the hero's action effects (its effect list, cheap), so a
  // move's own effect is drawn tinted from its first frame; every 3rd frame: every live effect hub (hit and bullet
  // effects too; the search costs about 0.8 ms, so not every frame). A hub keeps its tint while pooled, so a reused one
  // is right at once; 0.2.6 looked every 5th frame only, and new effects flashed their own colour first. A hub is looked
  // at once: not the hero's, or a cut-in (its portrait art is drawn by the effect, so it stays as drawn), it is skipped.
  function fxHub(st, hub, pre, key) {
    var id = hub.GetInstanceID(), rec = st.fxHubs[id];
    if (rec ? rec.key == key : st.fxSkip[id]) return;
    if (!rec) {
      var n = String(hub.name);
      if (n.indexOf(pre) != 0 || /cut_?in/i.test(n)) { st.fxSkip[id] = 1; return; }
      rec = st.fxHubs[id] = hubRecord(hub);
    }
    tintHub(rec, st.pal.fx); rec.key = key;
  }
  function fxTint(st) {
    var pre = fxPrefix(st); if (!pre) return;
    var key = st.pal.fx.join(",");
    st.fxHubs = st.fxHubs || {}; st.fxSkip = st.fxSkip || {};
    try {
      var L = st.actor.EffectMgr.ActionEffectList;
      for (var i = 0; i < L.Count; i++) { var o = L.get_Item(i).FXObj; if (o && !isNull(o)) fxHub(st, o, pre, key); }
    } catch (e) {}
    st.fxN = (st.fxN || 0) + 1; if (st.fxN % 3) return;
    var hubs = UE.Object.FindObjectsOfType(T(cs.NOAH.VFX.VFXEffectHub));
    for (var h = 0; h < hubs.Length; h++) fxHub(st, hubs.get_Item(h), pre, key);
  }
  // tint off: the layers tinted so far get their own colours back, pooled hubs too (they come back for the next move)
  function fxBack(st) {
    if (!st.fxHubs) return;
    Object.keys(st.fxHubs).forEach(function (id) { try { tintHub(st.fxHubs[id], null); } catch (e) {} });
    st.fxHubs = null;
  }

  // every frame: keep the copy on the renderer, paint pages the hero loads, its glow and effect tint; a gone actor lets go
  M.frame = 0;
  M.keep = function () {
    M.frame++;
    for (var s = M.states.length - 1; s >= 0; s--) {
      var st = M.states[s];
      try {
        if (isNull(st.actor) || isNull(st.v)) { release(st); continue; }
        // the renderer's family: our copy stays on it. The original back (the game set it again): our copy over it. Another
        // family of the hero's own roles on the same skin (a clip of another role): its own copy, painted at once
        var cur = st.v.MainTextrues, on = subOf(st, cur);
        if (!on && cur && !isNull(cur) && sameSkin(st, cur)) {
          var ex = splitFam(st.roles, cur.name); on = newSub(st, cur, loadFam(ex.role + "_Extra") || st.v.ExtraTextures); paintAll(st, on);
          log("hero " + st.hero + " drew from " + on.name + ": painted too");
        }
        if (!on) { release(st, "the hero changed palette"); continue; }
        if (!cur.Equals(on.cp)) st.v.MainTextrues = on.cp;
        // The game loads a group's pages into the set as originals when an animation needs them and empties them after;
        // a page painted once goes straight back, every pass and with no repaint. Waiting for a repaint left a few
        // frames in the original colours that afterimages copied (Susanoo moving, a tester, 2026-10-18).
        // The family on the renderer every pass; the hero's other families every 15th.
        var budget = 3;
        for (var si = 0; si < st.subs.length; si++) {
          var sub = st.subs[si]; if (sub !== on && M.frame % 15) continue;
          for (var i = 0; i < sub.n; i++) {
            var t = sub.arr.GetValue(i), mine = sub.mine[i];
            if (mine && !isNull(mine)) { if (!t || isNull(t) || !t.Equals(mine)) sub.arr.SetValue(mine, i); }
            else if (t && !isNull(t) && budget > 0) { paintPage(st, sub, i); if (sub.dirty) delete sub.dirty[i]; budget--; }
          }
        }
        if (on.dirty) { var c = curPage(st, on); if (c >= 0 && on.dirty[c]) { paintPage(st, on, c); delete on.dirty[c]; budget--; } }
        if (Date.now() - st.editAt > 250) {
          for (var sj = 0; sj < st.subs.length && budget > 0; sj++) {
            var sd = st.subs[(st.subs.indexOf(on) + sj) % st.subs.length]; if (!sd.dirty) continue;    // the one on screen first
            for (var d in sd.dirty) { if (budget-- <= 0) break; paintPage(st, sd, +d); delete sd.dirty[d]; }
            if (!Object.keys(sd.dirty).length) sd.dirty = null;
          }
        }
        if (st.pal.glow) { if (M.frame % 2 == 0) glowApply(st); } else if (st.glowOn) glowBack(st);
        if (st.pal.fx) { if (!M.preRender) fxTint(st); } else if (st.fxHubs) fxBack(st);   // with the pre-render hook, M.pin tints
      } catch (e) { release(st, "error " + es(e)); }
    }
  };

  // ------------------------------------------------------------------ saved, worn and seen palettes
  M.mine = function (hero) {
    var d = M.dir() + "/mine/" + hero, out = [];
    try { if (SIO.Directory.Exists(d)) { var fs = SIO.Directory.GetFiles(d, "*.json"); for (var i = 0; i < fs.Length; i++) { var o = readJ(fs.get_Item(i), null); if (o && M.decode(o.code)) out.push(o); } } } catch (e) { log("list: " + es(e)); }
    return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  };
  M.save = function (pal) {
    var code = M.encode(pal), f = M.dir() + "/mine/" + pal.hero + "/" + safe(pal.name) + ".json";
    var ok = writeJ(f, { name: safe(pal.name), hero: pal.hero, skin: pal.skin, code: code, saved: new Date().toISOString() });
    log((ok ? "saved " : "not saved ") + safe(pal.name) + " for hero " + pal.hero); return ok ? code : null;
  };
  M.remove = function (hero, name) { try { SIO.File.Delete(M.dir() + "/mine/" + hero + "/" + safe(name) + ".json"); log("deleted " + safe(name)); return true; } catch (e) { return false; } };
  M.wornCode = function (hero) { var w = readJ(M.dir() + "/worn.json", {}); return w[hero] || ""; };
  M.setWorn = function (hero, code) { var w = readJ(M.dir() + "/worn.json", {}); if (code) w[hero] = code; else delete w[hero]; writeJ(M.dir() + "/worn.json", w); delete M.held[hero]; M.pushNet(); };
  M.seen = function () { return readJ(M.dir() + "/seen.json", []); };
  M.addSeen = function (code, from) {
    var pal = M.decode(code); if (!pal) return;
    var list = M.seen().filter(function (s) { return s.code != code; });
    list.unshift({ code: code, name: pal.name, hero: pal.hero, skin: pal.skin, from: String(from || ""), at: new Date().toISOString() });
    writeJ(M.dir() + "/seen.json", list.slice(0, 40)); log("seen " + pal.name + " (hero " + pal.hero + ") on " + from);
  };
  // export: a .bbpal text file in <palettes>/export holding the code; import reads every .bbpal in <palettes>/import
  M.exportFile = function (pal) {
    var code = M.encode(pal), f = M.dir() + "/export/" + safe(pal.name) + ".bbpal";
    try { SIO.Directory.CreateDirectory(M.dir() + "/export"); SIO.File.WriteAllText(f, code + "\n"); log("exported " + f); return f; } catch (e) { log("export: " + es(e)); return null; }
  };
  M.importFiles = function () {
    var d = M.dir() + "/import", out = [];
    try { SIO.Directory.CreateDirectory(d); var fs = SIO.Directory.GetFiles(d, "*.bbpal"); for (var i = 0; i < fs.Length; i++) { var p = M.decode(SIO.File.ReadAllText(fs.get_Item(i))); if (p) out.push(p); } } catch (e) { log("import: " + es(e)); }
    return out;
  };
  M.toClipboard = function (s) { try { UE.GUIUtility.systemCopyBuffer = s; return true; } catch (e) { log("clipboard: " + es(e)); return false; } };
  M.fromClipboard = function () { try { return String(UE.GUIUtility.systemCopyBuffer || ""); } catch (e) { return ""; } };

  // ------------------------------------------------------------------ the player's own hero and the others in a fight
  function battle() { try { return require("GamePlay/Battle/BattleJs").default.Instance.Battle; } catch (e) { return null; } }
  M.me = function () { var b = battle(); try { return b && b.PlayerSelf; } catch (e) { return null; } };
  // a hero drawn from palette pages (the lobby avatar is a Spine figure without them)
  M.paintable = function (a) { try { var v = a.ActorModel.Renderer, f = v && v.MainTextrues; return !!f && !isNull(f); } catch (e) { return false; } };
  M.myPal = function () { var a = M.me(); return a ? M.decode(M.wornCode(a.BaseID)) : null; };
  // four-player lobbies carry the worn code under the member key "pal" (Steam lobby data; 91Act's servers never see it)
  M.pushNet = function () {
    var L = G.BB4L; if (!L || L.local || !L.lobby || L.state != "in") return;
    var hero = L.me && L.me.hero, code = hero ? M.wornCode(hero) : "";   // each game checks the palette against the hero it sees
    try { cs.Steamworks.SteamMatchmaking.SetLobbyMemberData(L.lobby, "pal", code || ""); } catch (e) { log("lobby: " + es(e)); }
  };
  M.readNet = function () {
    var L = G.BB4L; if (!L || L.local || !L.lobby) return;
    var MM = cs.Steamworks.SteamMatchmaking, n = MM.GetNumLobbyMembers(L.lobby), me = "";
    try { me = String(cs.Steamworks.SteamUser.GetSteamID().m_SteamID); } catch (e) {}
    for (var i = 0; i < n; i++) {
      var m = MM.GetLobbyMemberByIndex(L.lobby, i), id = String(m.m_SteamID); if (id == me) continue;
      var code = String(MM.GetLobbyMemberData(L.lobby, m, "pal") || ""), had = M.remote[id];
      if (!code) { delete M.remote[id]; continue; }
      if (had && had.code == code) continue;
      var pal = M.decode(code); if (!pal) continue;
      var who = ""; try { who = String(cs.Steamworks.SteamFriends.GetFriendPersonaName(m)); } catch (e) {}
      M.remote[id] = { code: code, pal: pal, name: who }; M.addSeen(code, who);
    }
  };
  function hookLobby() {
    var L = G.BB4L; if (!L || L.__palHook === L.pushMe) return;
    var push = L.pushMe, read = L.readSteam;
    L.pushMe = function () { var r = push.apply(this, arguments); try { M.pushNet(); } catch (e) {} return r; };
    L.readSteam = function () { var r = read.apply(this, arguments); try { M.readNet(); } catch (e) {} return r; };
    L.__palHook = L.pushMe; log("four-player lobby carries palettes");
  }
  // who wears what: my hero my worn palette; other players in a four-player fight their lobby code
  M.sync = function () {
    var b = battle(); if (!b) return;
    var me = null; try { me = b.PlayerSelf; } catch (e) {}
    var want = [];
    if (me && !isNull(me)) want.push([me, M.myPal()]);
    if (G.BB4F && G.BB4F.inFight || (G.BB4L && G.BB4L.state == "in")) {
      try {
        var all = b.GetAllMainPlayers();
        for (var i = 0; i < all.Count; i++) { var p = all.get_Item(i); if (me && p.Equals(me)) continue; var r = M.remote[String(p.PlayerIDForFS64)]; want.push([p, r ? r.pal : null]); }
      } catch (e) {}
    }
    want.forEach(function (w) {
      var st = stateOf(w[0]);
      if (!w[1]) { if (st) release(st, "no palette"); return; }
      if (st && st.pal === w[1]) return;
      if (st && M.encode(st.pal) == M.encode(w[1])) { st.pal = w[1]; return; }
      if (w[1].__failedOn === w[0]) return;
      if (!st && w[0] === me && (M.holdAll || M.held[w[1].hero] && M.held[w[1].hero] == (M.wornCode(w[1].hero) || "-"))) return;   // held off
      if (!M.wear(w[0], w[1], true)) w[1].__failedOn = w[0];
      else log("worn palette " + w[1].name + " put on hero " + w[1].hero + (w[0] === me ? "" : " (another player)"));
    });
  };
  // the game's palette selector is showing a slot on the hero (palsel.js): what it shows stays until it closes
  function selectorOpen() {
    var w = M.selecting; if (!w) return false;
    try { if (w.Root && !isNull(w.Root) && w.Root.gameObject.activeInHierarchy) return true; } catch (e) {}
    M.selecting = null; return false;
  }
  M.tick = function () {
    try { hookLobby(); } catch (e) {}
    try { hookPause(); } catch (e) { if (!M.e4) { M.e4 = 1; log("pause hook: " + es(e)); } }
    try { if (M.frame % 30 == 0 && !M.editing && !selectorOpen()) M.sync(); } catch (e) { if (!M.e1) { M.e1 = 1; log("sync: " + es(e)); } }
    try { M.keep(); } catch (e) { if (!M.e2) { M.e2 = 1; log("keep: " + es(e)); } }
    try { if (M.ui && M.ui.tick) M.ui.tick(); } catch (e) { if (!M.e3) { M.e3 = 1; log("window: " + es(e)); } }
    try { openWhenReady(); } catch (e) { M.pendingOpen = null; log("reopen: " + es(e)); }
    try { if (M.studio && M.frame % 20 == 0) keepStageEmpty(); } catch (e) { M.studio = null; log("studio: " + es(e)); }
  };
  // Try Out entered for the maker is a dressing room: its training dummy goes, and stays gone while the hero is there
  // (the lead, 2026-10-17: "make sure theres no enemy spawns"). Only in Try Out, and only for a visit the maker started.
  // the battle HUD fades out under the maker through a CanvasGroup on its root, as the test room's trailer mode does it
  M.hideHud = function (on) {
    try {
      var bj = require("GamePlay/Battle/BattleJs").default.Instance; if (!bj) return;
      [bj.UIMain, bj.BreedUI].forEach(function (ui) {
        if (!ui || !ui.CsObj) return;
        var CG = cs.UnityEngine.CanvasGroup, U = require("Core/Util").U;
        var g = U.GetComponent(ui.CsObj, CG) || (on ? U.AddComponent(ui.CsObj, CG) : null);
        if (g) { g.alpha = on ? 0 : 1; g.blocksRaycasts = !on; }
      });
    } catch (e) { log("hud: " + es(e)); }
  };
  function tryoutBattle() { var B = require("GamePlay/Battle/BattleJs").default.Instance; return B && B.BattleClassName == "BattleTryout" ? B.Battle : null; }
  // In the dressing room Start (and Esc) shows and hides the maker instead of Try Out's pause window, and the way out is
  // holding B in the maker (the lead, 2026-10-18: "start and pause should only open and re open the menu"; "you should only
  // be able to leave by holding b"). Try Out registers its pause handler when it starts, so the prototype is wrapped
  // before the first visit.
  function hookPause() {
    if (M.pauseHooked) return;
    var BT = require("GamePlay/Battle/BattleTryout").default, P = BT && BT.prototype; if (!P || !P.OnEventPause) return;
    if (!P.OnEventPause.__pal) {
      var orig = P.OnEventPause;
      P.OnEventPause = function () {
        var N = G.BBPAL;     // the core of now, after a hot reload too
        if (N && N.leavingAt) return;     // on its way out: the pause key does nothing
        if (N && N.studio && N.ui && N.ui.studioToggle) { try { N.ui.studioToggle(); } catch (e) { N.log("start: " + es(e)); } return; }
        return orig.apply(this, arguments);
      };
      P.OnEventPause.__pal = orig;
    }
    M.pauseHooked = true;
  }
  // 0.2.11: the way out is asked once and watched. Until the dressing room is really gone nothing may bring the maker back
  // (testers 11-19: LEAVE and Backspace ended in "try moves" and the maker again). If Try Out is still there after 6 s the
  // quit is asked again, straight through the game's own QuitToLobby.
  M.leaveStudio = function () {
    if (M.leavingAt) return;
    M.leavingAt = Date.now(); M.pendingOpen = null;
    log("leaving Try Out to the lobby");
    var T = null; try { T = require("GamePlay/BattleTryout/BattleTryoutRun").default; } catch (e) { log("leave: " + es(e)); }
    var b0 = null; try { b0 = tryoutBattle(); } catch (e) {}
    try { T.Instance.QuitAsync(); } catch (e) { log("leave: " + es(e)); }
    setTimeout(function () {
      try {
        if (!M.leavingAt) return;
        var b = tryoutBattle();
        if (b && b0 && (b === b0 || b.Equals(b0))) { log("leave: Try Out is still up after 6 s, asking again"); T.ReturnType = 99; T.QuitToLobby(); }
      } catch (e) { log("leave again: " + es(e)); }
    }, 6000);
    setTimeout(function () { if (M.leavingAt) { M.leavingAt = 0; log("leave: the guard is lifted after 30 s"); } }, 30000);
  };
  function keepStageEmpty() {
    var a = M.me(), b = tryoutBattle();
    if (!b || !a || isNull(a) || a.BaseID != M.studio.hero) {
      if (M.pendingOpen) return;
      M.studio = null; M.leavingAt = 0; log("left the dressing room");
      try { if (M.ui && M.ui.leftStudio) M.ui.leftStudio(); } catch (e) { log("after Try Out: " + es(e)); }
      return;
    }
    if (b.PlayerObjMgr.FindPlayersByTag("Monster").Count > 0) { b.KillAllEnemyPlayersQuiet(true); if (!M.studio.cleared) { M.studio.cleared = 1; log("training dummy removed"); } }
  }
  // the hero chosen in the lobby has arrived in Try Out: open the maker once the stage has settled
  function openWhenReady() {
    var w = M.pendingOpen; if (!w) return;
    if (Date.now() > w.until) {
      M.pendingOpen = null; log("Try Out did not start; the maker stays closed");
      if (w.locked) try { require("Core/Util").U.SetAllActionLock(false, cs.NOAH.Input.LockFlag.SpecialLogic); } catch (e) {}
      return;
    }
    var a = M.me(); if (!a || isNull(a) || a.BaseID != w.hero || !M.paintable(a)) { w.seen = 0; return; }
    var tb = tryoutBattle(); if (w.from && tb === w.from) return;     // still the Try Out it was started from
    if (!M.studio && tb) { M.studio = { hero: w.hero }; keepStageEmpty(); }
    if (w.seen && w.actor && !w.actor.Equals(a)) w.seen = 0;
    // The spot the hero arrives on, and the controls held from then until the maker is up: moving while it loaded left
    // the hero off centre (Aneubys, 10-23 and 11-07: "my instinct is to mash left and right while waiting"). The maker
    // puts the hero back on this spot each time it opens (palui.js, W.open).
    if (!w.seen) {
      w.seen = Date.now(); w.actor = a;
      if (M.studio) { try { var p = a.Position; M.studio.spot = [p.x, p.y]; } catch (e) {} }
      try { require("Core/Util").U.SetAllActionLock(true, cs.NOAH.Input.LockFlag.SpecialLogic); w.locked = true; } catch (e) { log("input hold: " + es(e)); }
      return;
    }
    if (Date.now() - w.seen < 1500 || !M.ui) return;
    M.pendingOpen = null; M.ui.open();
  }
  M.timer = setInterval(M.tick, 1);
  // Just before the frame is drawn (after every Update and LateUpdate, so after the animations): our copies back on any
  // renderer the game changed this frame. The scripts' timer can run before the hero's clip changes, which showed one
  // frame of the original family each time Susanoo's clips changed role.
  M.pin = function () {
    for (var s = 0; s < M.states.length; s++) {
      var st = M.states[s];
      try {
        var cur = st.v.MainTextrues, on = subOf(st, cur); if (!on) continue;
        if (!cur.Equals(on.cp)) st.v.MainTextrues = on.cp;
        for (var i = 0; i < on.n; i++) { var mine = on.mine[i]; if (mine) { var t = on.arr.GetValue(i); if (!t || !t.Equals(mine)) on.arr.SetValue(mine, i); } }
      } catch (e) {}
      try { if (st.pal && st.pal.fx) fxTint(st); } catch (e) { if (!M.e5) { M.e5 = 1; log("effect tint: " + es(e)); } }
    }
  };
  try { M.preRender = new UE.Canvas.WillRenderCanvases(function () { var N = G.BBPAL; if (N && N.pin) N.pin(); }); UE.Canvas.add_willRenderCanvases(M.preRender); }
  catch (e) { M.preRender = null; log("no pre-render hook, the timer alone keeps the copies on: " + es(e)); }
  log("core " + M.VER + " loaded; palettes in " + M.dir());
})();
