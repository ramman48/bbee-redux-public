// Four-player online mode: the lobby screen's v3 pass (the lead, 2026-10-20: "making all the buttons and text look
// amazing and cool making all the ui elements 3d and dynamic and animated"; on the mock-up: the rift "too pixelly and
// not smooth", the fire "isnt level to the ground", "the moving dynamic text looks really weird").
// The game's pipeline draws only its own cameras, so the screen stays a Screen Space Overlay canvas and every lobby
// shader projects with depth (uikit/Assets/FourPlayer/Shaders/BB3D.cginc). This file moves the screen's parts in 3D
// each frame (local rotation and depth on the prefab's own RectTransforms), adds the depth layers (card and button
// slabs, text extrusion) and drives the screen-wide moments through shader globals (rings, flash, fade, the eye).
// Called by fourlobbyui.js: built(S) once after the screen is made, frame(S) every tick while open, shot(k, name) on a
// card's moment, press(j) on a bar button, off() on close. Text never moves letter by letter: lines are solid, with
// depth behind them and a light passing over the titles.
(function () {
  var cs = CS, G = globalThis, B = G.BB4, UE = cs.UnityEngine, UI = UE.UI, T = puerts.$typeof;
  function log(m) { B.log("FOURUI", "3D " + m); }
  var D = G.BB4UI3D = G.BB4UI3D || {};
  var DEG = 180 / Math.PI, F = 1 / 60;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lin(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function time() { return UE.Time.unscaledTime; }
  function V3(x, y, z) { return new UE.Vector3(x, y, z); }
  function rot(rx, ry, rz) { return UE.Quaternion.Euler(rx * DEG, ry * DEG, (rz || 0) * DEG); }
  function setZ(tr, z) { var p = tr.localPosition; if (Math.abs(p.z - z) > 0.01) { p.z = z; tr.localPosition = p; } }
  // a stock particle effect (UIParticle) is not drawn through BB3D.cginc: it shows at its node's flat x, y while the tile
  // it sits on is projected. Put the node where the shader draws its home (local x, y under par) and scale it by the
  // same depth factor, so a cell's crest stays centred on the cell as the grid turns with the eye.
  // A canvas batch's unity_ObjectToWorld is the root canvas, so the shader works in the root canvas's own space (origin
  // at the screen centre, 1080-reference units), not in screen pixels: its centre _ScreenParams / 2 lies off the top
  // right of the screen. Measured 2026-11-03 on the four DLC tiles at two eye positions: within 2-5 px of the drawn frames
  function onProjected(fx, par, x, y, s, ex, ey) {
    if (!D.rootT || D.rootT.Equals(null)) D.rootT = par.GetComponentInParent(T(UE.Canvas)).rootCanvas.transform;
    var R = D.rootT, q = R.InverseTransformPoint(par.TransformPoint(V3(x, y, 0))), sc = UE.Screen.height / 1080, f = 1600 * sc;
    var cx = UE.Screen.width / 2 - ex * 34 * sc, cy = UE.Screen.height / 2 - ey * 20 * sc, k = f / Math.max(f + q.z, f * 0.05);
    fx.position = R.TransformPoint(V3(cx + (q.x - cx) * k, cy + (q.y - cy) * k, q.z)); fx.localScale = V3(s * k, s * k, 1);
  }

  // ---- materials ----
  var faceMats = {}, flatMats = {};
  function textMats(fontMat) {
    var key = fontMat.GetInstanceID();
    if (faceMats[key]) return [faceMats[key], flatMats[key]];
    function mk(flat) {
      var m = new UE.Material(D.text3d); m.name = "Lb_Text3D_" + (flat ? "flat" : "face");
      m.mainTexture = fontMat.mainTexture;
      ["_GradientScale", "_WeightNormal", "_WeightBold", "_ScaleRatioA", "_FaceDilate", "_OutlineWidth"].forEach(function (p) { if (fontMat.HasProperty(p)) m.SetFloat(p, fontMat.GetFloat(p)); });
      if (fontMat.HasProperty("_OutlineColor")) m.SetColor("_OutlineColor", fontMat.GetColor("_OutlineColor"));
      if (!fontMat.HasProperty("_OutlineWidth") || fontMat.GetFloat("_OutlineWidth") < 0.05) { m.SetFloat("_OutlineWidth", 0.16); m.SetColor("_OutlineColor", new UE.Color(0.06, 0.02, 0.05, 1)); }
      m.SetFloat("_Flat", flat ? 1 : 0); return m;
    }
    faceMats[key] = mk(false); flatMats[key] = mk(true);
    return [faceMats[key], flatMats[key]];
  }
  // a text line's own material when it needs its own settings (shine, extrusion colour)
  function ownMat(t, base, set) { var m = new UE.Material(base); set(m); t.fontSharedMaterial = m; return m; }
  function convertTexts(root) {
    var all = root.GetComponentsInChildren(T(cs.TMPro.TextMeshProUGUI), true), n = 0;
    for (var i = 0; i < all.Length; i++) {
      var t = all.get_Item(i), m = t.fontSharedMaterial; if (!m || m.Equals(null)) continue;
      if (m.shader && m.shader.name == "FourLobby/Text3D") continue;
      t.fontSharedMaterial = textMats(m)[0]; n++;
    }
    return n;
  }
  function plainMats(root) {   // a picture made by the script with Unity's default material joins the 3D pass
    var all = root.GetComponentsInChildren(T(UI.Graphic), true), n = 0;
    for (var i = 0; i < all.Length; i++) {
      var g = all.get_Item(i); if (g.GetType() == T(cs.TMPro.TextMeshProUGUI)) continue;
      var m = g.material; if (m && !m.Equals(null) && m.shader && m.shader.name.indexOf("FourLobby/") === 0) continue;
      if (m && !m.Equals(null) && m.name.indexOf("Default") < 0) continue;   // a material of its own: left alone
      g.material = D.ui3d; n++;
    }
    return n;
  }

  // ---- depth layers ----
  // a slab: the shape drawn again behind itself, flat and dark, a few px deeper each time (z grows away from the eye)
  function slab(parent, sprite, sliced, colour, depths, before) {
    var out = [];
    depths.forEach(function (d, j) {
      var g = new UE.GameObject("Slab" + j), rt = g.AddComponent(T(UE.RectTransform)); rt.SetParent(parent, false);
      rt.anchorMin = UE.Vector2.zero; rt.anchorMax = UE.Vector2.one; rt.sizeDelta = UE.Vector2.zero; rt.anchoredPosition = UE.Vector2.zero;
      var im = g.AddComponent(T(UI.Image)); im.sprite = sprite; im.raycastTarget = false; im.material = D.flat;
      if (sliced) im.type = UI.Image.Type.Sliced;
      var k = 0.55 + 0.45 * (1 - j / depths.length);
      im.color = new UE.Color(colour[0] * k, colour[1] * k, colour[2] * k, 1);
      setZ(rt, d); rt.SetSiblingIndex(before + j); out.push(im);
    });
    return out;
  }
  // extrusion: the line again behind itself in a flat colour, 3 px deeper per layer; synced to the line every frame
  function extrude(t, layers, colour, step) {
    if (!t || t.ex) return;
    var mats = textMats(t.fontSharedMaterial);
    if (t.fontSharedMaterial.shader.name != "FourLobby/Text3D") t.fontSharedMaterial = mats[0];
    var flat = new UE.Material(mats[1]); flat.SetColor("_FlatCol", new UE.Color(colour[0], colour[1], colour[2], 1));
    t.ex = [];
    var idx = t.transform.GetSiblingIndex();
    for (var j = layers; j >= 1; j--) {
      var g = UE.Object.Instantiate(t.gameObject, t.transform.parent, false); g.name = t.gameObject.name + "_x" + j;
      var c = g.GetComponent(T(cs.TMPro.TextMeshProUGUI)); c.fontSharedMaterial = flat; c.raycastTarget = false;
      var r = g.transform; r.SetSiblingIndex(idx); idx++;
      var p = t.transform.localPosition; r.localPosition = V3(p.x + j * 0.6, p.y - j * 0.9, p.z + j * (step || 3));
      t.ex.push(c);
    }
    t.transform.SetSiblingIndex(idx);
  }
  function syncEx(t) {
    if (!t || !t.ex) return;
    var s = t.text, on = t.gameObject.activeSelf, a = t.alpha;
    for (var i = 0; i < t.ex.length; i++) {
      var c = t.ex[i];
      if (c.gameObject.activeSelf != on) c.gameObject.SetActive(on);
      if (!on) continue;
      if (c.text != s) { c.text = s.replace(/<color=[^>]*>|<\/color>/g, ""); }
      if (c.fontSize != t.fontSize) c.fontSize = t.fontSize;
      if (c.enableAutoSizing != t.enableAutoSizing) { c.enableAutoSizing = t.enableAutoSizing; c.fontSizeMax = t.fontSizeMax; c.fontSizeMin = t.fontSizeMin; }
      if (c.alignment != t.alignment) c.alignment = t.alignment;
      var cr = c.rectTransform, tr = t.rectTransform;
      if (cr.sizeDelta.x != tr.sizeDelta.x || cr.sizeDelta.y != tr.sizeDelta.y) cr.sizeDelta = tr.sizeDelta;
      if (cr.pivot.x != tr.pivot.x) cr.pivot = tr.pivot;
      c.alpha = a;
    }
  }

  // ---- shader globals ----
  var rings = [], ringArr = null, ringSArr = null;
  function ring(x, y, R, w, push, split, dur) { rings.push({ x: x, y: y, R: R, w: w, k: push, c: split, t0: time(), d: dur * F }); }
  function screenOf(tr) {   // a transform's place in 1080-reference px from the bottom left
    var p = tr.position, sc = UE.Screen.height / 1080; return [p.x / sc, p.y / sc];
  }
  function pushGlobals(eye, flash, fade) {
    var S = UE.Shader;
    if (!ringArr) { ringArr = cs.System.Array.CreateInstance(T(UE.Vector4), 8); ringSArr = cs.System.Array.CreateInstance(T(UE.Vector4), 8); }
    var n = 0, now = time();
    rings = rings.filter(function (r) { return now - r.t0 < r.d; });
    for (var i = 0; i < 8; i++) {
      var r = rings[i];
      if (!r) { ringArr.SetValue(UE.Vector4.zero, i); ringSArr.SetValue(UE.Vector4.zero, i); continue; }
      var p = (now - r.t0) / r.d, fall = Math.pow(1 - p, 1.5);
      ringArr.SetValue(new UE.Vector4(r.x, r.y, r.R * outCubic(p), r.w * (0.6 + 0.4 * (1 - p))), i);
      ringSArr.SetValue(new UE.Vector4(r.k * fall, r.c * fall, 0, 0), i); n++;
    }
    S.SetGlobalVectorArray("_BB3D_Ring", ringArr); S.SetGlobalVectorArray("_BB3D_RingS", ringSArr);
    S.SetGlobalVector("_BB3D_Eye", new UE.Vector4(eye[0], eye[1], 0, 0));
    S.SetGlobalFloat("_BB3D_Flash", flash); S.SetGlobalFloat("_BB3D_Fade", fade); S.SetGlobalFloat("_BB3D_On", 1);
  }
  D.off = function () { try { UE.Shader.SetGlobalFloat("_BB3D_On", 0); UE.Shader.SetGlobalFloat("_BB3D_Flash", 0); UE.Shader.SetGlobalFloat("_BB3D_Fade", 1); } catch (e) {} };

  // ---- built: once, on the screen's own parts ----
  D.built = function (S) {
    var mats = S.ui.Find("Mats");
    D.text3d = mats ? mats.Find("Text3D").GetComponent(T(UI.Image)).material : null;
    D.ui3d = mats ? mats.Find("UI3D").GetComponent(T(UI.Image)).material : null;
    if (!D.text3d || !D.ui3d) { log("this bundle has no v3 materials: the screen stays flat"); D.ok = false; return; }
    D.flat = new UE.Material(D.ui3d); D.flat.SetFloat("_Flat", 1); D.flat.name = "Lb_UI3D_flat";
    D.glint = new UE.Material(D.ui3d); D.glint.SetFloat("_Glint", 0.35); D.glint.name = "Lb_UI3D_glint";
    D.ok = true;
    var tm = convertTexts(S.root), pm = plainMats(S.root);
    D.fontMat = S.title.fontSharedMaterial;
    // the backdrop far behind; the rift between it and the cards; the floor laid flat
    var bd = S.ui.Find("Backdrop");
    D.bg = bd.Find("Bg"); D.rift = bd.Find("Rift"); D.riftMat = D.rift ? D.rift.GetComponent(T(UI.RawImage)).material : null;
    D.sky = bd.Find("SkyLight"); D.motes = bd.Find("Motes"); D.fire = bd.Find("FloorFire"); D.seam = bd.Find("FloorSeam");
    if (D.riftMat) { D.riftMat = new UE.Material(D.riftMat); D.rift.GetComponent(T(UI.RawImage)).material = D.riftMat; }
    // a floor: the stage's fire bed again, laid flat from the front edge back into the screen
    D.floor = bd.Find("FloorPlane");
    if (D.fire && !D.floor) {
      var fl = UE.Object.Instantiate(D.fire.gameObject, bd, false); fl.name = "FloorPlane"; D.floor = fl.transform;
      var frt = fl.GetComponent(T(UE.RectTransform)); frt.sizeDelta = new UE.Vector2(0, 760); frt.pivot = new UE.Vector2(0.5, 0);
      var fri = fl.GetComponent(T(UI.RawImage)), fm = new UE.Material(fri.material); fm.SetFloat("_Intensity", 1.1); if (fm.HasProperty("_EdgeFade")) fm.SetFloat("_EdgeFade", 0.18); fm.SetFloat("_NoisePx", 260); fm.SetFloat("_Speed", 0.18); fm.SetFloat("_Occlude", 0.0); fri.material = fm; fri.color = new UE.Color(1, 1, 1, 0.8);
      fl.transform.SetSiblingIndex(D.fire.GetSiblingIndex());
      D.fire.gameObject.SetActive(false);   // the upright band gives way to the fire laid on the ground
    }
    // the top plates and their lines
    D.title = S.ui.Find("Title"); D.info = S.ui.Find("Info");
    extrude(S.title, 4, [0.32, 0.05, 0.09], 3); extrude(S.info, 4, [0.32, 0.05, 0.09], 3);
    ownMat(S.title, S.title.fontSharedMaterial, function (m) { m.SetFloat("_Shine", 0.55); });
    ownMat(S.info, S.info.fontSharedMaterial, function (m) { m.SetFloat("_Shine", 0.55); });
    slab(D.title, D.title.GetComponent(T(UI.Image)).sprite, false, [0.12, 0.03, 0.06], [6, 12], 0);
    // cards: a slab under the face and under the back, the hero name extruded
    S.cards.forEach(function (k) {
      var mask = k.face.Find("Mask").GetComponent(T(UI.Image)).sprite;
      k.slabs = slab(k.face, mask, false, [0.16, 0.05, 0.08], [4, 8, 12, 16], 0);
      var bs = new UE.GameObject("BackSlab"), brt = bs.AddComponent(T(UE.RectTransform)); brt.SetParent(k.rig, false);
      brt.anchorMin = UE.Vector2.zero; brt.anchorMax = UE.Vector2.one; brt.sizeDelta = UE.Vector2.zero; brt.SetSiblingIndex(k.back.GetSiblingIndex());
      k.backSlabT = brt; k.backSlabs = slab(brt, k.backImg.sprite, false, [0.06, 0.04, 0.08], [4, 8, 12, 16], 0);
      extrude(k.hero_t, 3, [0.22, 0.06, 0.1], 3);
      k.medalT = k.rig.Find("Medal");
      var ms = k.medalT.Find("Ring").GetComponent(T(UI.Image)).sprite;
      k.medalSlabs = slab(k.medalT, ms, false, [0.36, 0.25, 0.1], [3, 6], 0);
      k.m3 = { coinAt: -9, joinAt: -9, rd: null, id: null };
    });
    D.btnDone = {};
    D.rulesBoard = S.rulesT ? S.rulesT.Find("Board") : null;
    if (S.rulesTitle) extrude(S.rulesTitle, 4, [0.3, 0.05, 0.09], 3);
    // the board (Run settings, the Legacy list) is a thick plate; each row a thinner one
    if (D.rulesBoard) {
      var bb = D.rulesBoard.Find("Body"), bi = bb ? bb.GetComponent(T(UI.Image)) : null;
      if (bi) slab(D.rulesBoard, bi.sprite, bi.type == UI.Image.Type.Sliced, [0.1, 0.03, 0.06], [6, 12, 18], 0);
      (S.rrows || []).forEach(function (w) {
        var sl = w.tr.Find("Slide"), rb = sl ? sl.Find("Body") : null, ri = rb ? rb.GetComponent(T(UI.Image)) : null;
        if (ri) slab(sl, ri.sprite, ri.type == UI.Image.Type.Sliced, [0.12, 0.03, 0.07], [4, 8], 0);
      });
    }
    // the Legacy selector: its title in depth, each row and the panel a plate
    if (S.evo) {
      var Ev = S.evo;
      extrude(Ev.title, 4, [0.3, 0.05, 0.09], 3);
      Ev.rows.forEach(function (w) {
        var sl2 = w.tr.Find("Slide"), rb2 = sl2 ? sl2.Find("Body") : null, ri2 = rb2 ? rb2.GetComponent(T(UI.Image)) : null;
        if (ri2) slab(sl2, ri2.sprite, ri2.type == UI.Image.Type.Sliced, [0.12, 0.03, 0.07], [4, 8, 12], 0);
      });
      var pi = Ev.panelImg; if (pi) slab(Ev.panel, pi.sprite, pi.type == UI.Image.Type.Sliced, [0.1, 0.03, 0.06], [6, 12, 18], 0);
    }
    // the character select: its title and the large card's name stand out in depth
    if (S.sel) {
      extrude(S.sel.title, 4, [0.3, 0.05, 0.09], 3);
      var sk2 = S.sel.k, sm = sk2.face.Find("Mask").GetComponent(T(UI.Image)).sprite;
      sk2.slabs = slab(sk2.face, sm, false, [0.16, 0.05, 0.08], [5, 10, 15, 20], 0);
      extrude(sk2.hero_t, 3, [0.22, 0.06, 0.1], 3);
    }
    D.eye = [0, 0]; D.mouseAt = -99; D.lastMouse = null;
    log("built: " + tm + " text lines and " + pm + " pictures in 3D");
  };

  // a bar button gets its slab the first time it is seen
  function btn3d(b) {
    if (b.d3) return;
    var off = b.rt.Find("Off").GetComponent(T(UI.Image));
    b.slabs = slab(b.rt, off.sprite, true, [0.1, 0.03, 0.06], [4, 8, 12], 0);
    extrude(b.t, 3, [0.25, 0.05, 0.09], 2.5);
    b.d3 = { at: time(), press: -9 };
  }
  D.press = function (S, j) { var b = S.btns[j]; if (!b) return; btn3d(b); b.d3.press = time(); var p = screenOf(b.rt); ring(p[0], p[1], 240, 50, 10, 0.004, 20); };
  D.shot = function (S, k, name) {
    if (!D.ok || !k.m3) return;
    var p = screenOf(k.medalT);
    if (name == "Join") { k.m3.joinAt = time(); ring(p[0], p[1] + 40, 300, 70, 16, 0.003, 26); }
    if (name == "Ready" || name == "Unready") { k.m3.coinAt = time(); if (name == "Ready") ring(p[0], p[1], 380, 80, 26, 0.006, 26); }
  };

  D.tiltOn = function () { try { return !!(G.BB4 && G.BB4.opt && G.BB4.opt("tilt")); } catch (e) { return false; } };
  // ---- every frame ----
  D.frame = function (S) {
    if (!D.ok) return;
    var fc = UE.Time.frameCount; if (fc === D.fc) return; D.fc = fc;   // the lobby's timer runs several times a frame
    var now = time(), open = now - (S.openAt3 || now);
    if (!S.openAt3 || S.openAt3Src != S.openAt) { S.openAt3 = now; S.openAt3Src = S.openAt; open = 0; }
    // the eye: the mouse moves it; with the mouse still for 2.5 s it sways by itself. Only with the tilt setting on
    // (BB4.opt("tilt"), off by default): testers disliked the leaning windows, and on a pad the sway never stopped
    // (2026-11-07). Off, the eye stays at the centre and the idle sways below are held at zero
    var tilt = D.tiltOn(), sway = tilt ? 1 : 0;
    var mp = null; if (tilt) try { mp = UE.Input.mousePosition; } catch (e) {}
    var W = UE.Screen.width, H = UE.Screen.height, mx = 0, my = 0;
    if (mp) { mx = clamp(mp.x / W * 2 - 1, -1, 1); my = clamp(mp.y / H * 2 - 1, -1, 1); if (!D.lastMouse || Math.abs(D.lastMouse[0] - mp.x) + Math.abs(D.lastMouse[1] - mp.y) > 1) { D.mouseAt = now; D.lastMouse = [mp.x, mp.y]; } }
    if (tilt && now - D.mouseAt > 2.5) { mx =0.55 * Math.sin(now * 0.5); my = 0.35 * Math.sin(now * 0.37 + 1); }
    D.eye[0] += (mx - D.eye[0]) * 0.08; D.eye[1] += (my - D.eye[1]) * 0.08;
    var ex = D.eye[0], ey = D.eye[1];
    // Start: the cards fly at the eye, a flash, the screen fades (S.starting from fourlobbyui's start)
    if (S.starting && !D.startAt) { D.startAt = now; var c = screenOf(S.ui); ring(960, 540, 1500, 190, 60, 0.012, 44); }
    if (!S.starting) D.startAt = 0;
    var sk = D.startAt ? (now - D.startAt) / F : -1;
    var flash = sk >= 36 && sk < 38 ? 0.85 : (sk >= 38 ? 0.85 * Math.max(0, 1 - (sk - 38) / 10) : 0);
    var fade = sk >= 70 ? 1 - lin(sk, 70, 100) : 1;
    pushGlobals([-ex * 34, -ey * 20], flash, fade);
    // the backdrop: far planes, scaled up so they still fill the screen at their depth
    var kz = function (z) { return (1600 + z) / 1600; };
    if (D.bg) { setZ(D.bg, 700); var s = kz(700) * 1.3; D.bg.localScale = V3(s, s, 1); }   // 1.3: the far plane still reaches the edges of a 21:9 screen
    if (D.rift) {
      setZ(D.rift, 420); var s2 = kz(420); D.rift.localScale = V3(s2, s2, 1);
      if (D.riftMat) {
        var spin = 1 + (sk >= 0 ? outCubic(lin(sk, 0, 36)) * 9 : 0), coll = sk >= 0 ? lin(sk, 36, 90) : 0;
        D.riftMat.SetFloat("_Spin", spin); D.riftMat.SetFloat("_Collapse", coll); D.riftMat.SetFloat("_Int", 2.4 + (sk >= 0 ? 2.5 * lin(sk, 0, 36) * (1 - coll) : 0));
      }
    }
    if (D.sky) setZ(D.sky, 500);
    if (D.motes) setZ(D.motes, 200);
    if (D.floor) { D.floor.localRotation = rot(Math.PI / 2, 0, 0); var fp = D.floor.localPosition; }
    // the top plates swing in from their sides and lean with the eye
    [[D.title, -1, 2], [D.info, 1, 8]].forEach(function (h) {
      if (!h[0]) return;
      var e = lin(open / F, h[2], h[2] + 18), out = sk >= 40 ? lin(sk, 40, 58) : 0;
      var ry = (1 - outBack(e)) * 1.25 * h[1] + out * 1.4 * h[1] + ex * 0.09, rx = -ey * 0.06;
      h[0].localRotation = rot(rx, ry, 0);
      var cg = h[0].GetComponent(T(UE.CanvasGroup)) || h[0].gameObject.AddComponent(T(UE.CanvasGroup)); cg.alpha = clamp(e * 3, 0, 1) * (1 - out);
    });
    syncEx(S.title); syncEx(S.info);
    // cards
    S.cards.forEach(function (k, i) {
      if (!k.tr.gameObject.activeSelf || !k.m3) return;
      var sel = S.zone == "cards" && S.cur == i && !(S.menu && S.menu.activeSelf) && !S.rulesOpen;
      if (sel && !k.m3.sel) k.m3.selAt = now; k.m3.sel = sel;
      var ry = sway * 0.045 * Math.sin(now * 0.7 + i * 1.7), rx = 0, z = 0;
      if (sel) { var p = outBack(lin((now - k.m3.selAt) / F, 0, 14)); z = -70 * p; ry = ry * (1 - p) + ex * 0.2 * p; rx = -ey * 0.08 * p; }
      if (now - k.m3.joinAt < 16 * F) ry += 1.3 * (1 - outBack(lin((now - k.m3.joinAt) / F, 0, 16)));
      if (sk >= 30 && k.id) { var q = Math.pow(lin(sk, 36 + i * 3, 66 + i * 3), 2.2); z -= 1150 * q; ry += (i - 1.5) * 0.5 * q; rx -= 0.35 * q; }
      k.tr.localRotation = rot(rx, ry, 0); setZ(k.tr, z);
      // the slab follows the back's turn (Join and Leave scale the sides)
      if (k.backSlabT) { var bsx = k.back.localScale.x; k.backSlabT.localScale = V3(bsx, 1, 1); k.backSlabT.gameObject.SetActive(bsx > 0.01); }
      // the medal floats off the card and turns like a coin on Ready / Unready
      var cp = (now - k.m3.coinAt) / F, ang = 0;
      if (cp >= 0 && cp < 12) { var u = outCubic(cp / 12) * Math.PI; ang = u > Math.PI / 2 ? u - Math.PI : u; }
      k.medalT.localRotation = rot(0, ang + sway * 0.22 * Math.sin(now * 1.3 + i), 0); setZ(k.medalT, -40);
      // the name plate stands off the card; on join it swings down into place
      var jp = lin((now - k.m3.joinAt) / F, 8, 20);
      k.plate.localRotation = rot(now - k.m3.joinAt < 20 * F ? (1 - outBack(jp)) * -1.4 : 0, 0, 0); setZ(k.plate, -26);
      syncEx(k.hero_t);
    });
    // the bar: buttons rise in one after another, the focused one comes forward and leans with the eye; a press
    // pushes it in and it springs back
    (S.btns || []).forEach(function (b, j) {
      if (!b.rt.gameObject.activeSelf) return;
      btn3d(b);
      var e = lin(open / F, 24 + j * 4, 40 + j * 4), out = sk >= 40 ? lin(sk, 40 + j * 2, 56 + j * 2) : 0;
      var foc = S.zone == "bar" && S.cur == j && !S.rulesOpen;
      if (foc && !b.d3.foc) b.d3.focAt = now; b.d3.foc = foc;
      var rx = (1 - outBack(e)) * 1.4 + sway * 0.035 * Math.sin(now * 1.4 + j * 0.7) + out * 1.5, ry = 0, z = 0;
      if (foc) { var p = outBack(lin((now - b.d3.focAt) / F, 0, 12)); z = -42 * p; ry = ex * 0.28 * p; rx += -ey * 0.2 * p; }
      var pk = (now - b.d3.press) / F;
      if (pk >= 0 && pk < 3) z += 55 * (pk / 3); else if (pk >= 3 && pk < 30) z += 14 * Math.exp(-(pk - 3) / 4) * Math.cos((pk - 3) * 0.9);
      b.rt.localRotation = rot(rx, ry, 0); setZ(b.rt, z);
      syncEx(b.t);
    });
    // the character select: the large card turns in from the side and follows the eye; the grid is a panel angled
    // toward it; the head under the cursor stands forward and the rest lean back a little
    var Z = S.sel;
    if (Z && Z.root.gameObject.activeSelf) {
      var se = lin((now - (Z.openAt || now)) / F, 0, 20), sw = (now - (Z.swapAt || -9)) / F;
      var cry = (1 - outBack(se)) * -1.3 + ex * 0.16 + sway * 0.05 * Math.sin(now * 0.8), crx = -ey * 0.07;
      Z.k.tr.localRotation = rot(crx, cry, 0); setZ(Z.k.tr, (1 - outCubic(se)) * 500 - 30 - (sw >= 0 && sw < 14 ? 30 * Math.sin(sw / 14 * Math.PI) : 0));
      Z.grid.localRotation = rot(-ey * 0.05, -0.16 + ex * 0.07 + (1 - outBack(lin((now - (Z.openAt || now)) / F, 4, 24))) * 0.9, 0);
      setZ(Z.grid, (1 - outCubic(lin((now - (Z.openAt || now)) / F, 4, 24))) * 400);
      Z.cells.forEach(function (b, c) {
        if (!b.rt.gameObject.activeSelf) return;
        btn3d(b);
        var foc = S.pick && b.j == S.pick.i;
        if (foc && !b.d3.foc) b.d3.focAt = now; b.d3.foc = foc;
        var p = foc ? outBack(lin((now - b.d3.focAt) / F, 0, 10)) : 0;
        b.rt.localRotation = rot(-ey * 0.18 * p, ex * 0.22 * p, 0); setZ(b.rt, -38 * p + 6 * (1 - p));
        if (b.lockFx && b.lockHome) onProjected(b.lockFx, b.lockN, 0, b.lockHome[0], b.lockHome[1], ex, ey);
      });
      syncEx(Z.title); syncEx(Z.k.hero_t);
    }
    // the Legacy selector: the list and the detail plate face the eye at rest (the mockup is flat) and sway a little
    // with it; the row under the cursor stands forward; the detail plate swings in from the right; the tactic picker
    // drops in from behind
    var Ev2 = S.evo;
    if (Ev2 && Ev2.root.gameObject.activeSelf) {
      var oe = lin((now - (Ev2.openAt || now)) / F, 0, 20), pe = lin((now - (Ev2.panelAt || now)) / F, 0, 12);
      Ev2.rows.forEach(function (w, i) {
        if (!w.tr.gameObject.activeSelf) return;
        var f = Ev2.zone == "list" && !Ev2.picker && Ev2.cur == Ev2.top + i;
        if (f && !w.f3) w.f3At = now; w.f3 = f;
        var p = f ? outBack(lin((now - w.f3At) / F, 0, 10)) : 0;
        w.rt.localRotation = rot(-ey * 0.007 * p, ex * 0.01 + (1 - outBack(oe)) * 0.8, 0); setZ(w.rt, -30 * p + (1 - outCubic(oe)) * 300);
      });
      Ev2.panel.localRotation = rot(-ey * 0.007, ex * 0.01 + (1 - outBack(oe)) * -1.0 + (1 - outBack(pe)) * -0.12, 0);
      setZ(Ev2.panel, (1 - outCubic(oe)) * 400 + (1 - outCubic(pe)) * 40);
      var ke = lin((now - (Ev2.pickAt || now)) / F, 0, 14);
      if (Ev2.picker) { Ev2.pick.localRotation = rot(-ey * 0.05 + (1 - outBack(ke)) * 0.6, ex * 0.06, 0); setZ(Ev2.pick, -60 + (1 - outCubic(ke)) * 500); }
      Ev2.pkCells.forEach(function (c) { if (c.rt.gameObject.activeSelf) btn3d(c); });
      syncEx(Ev2.title);
    }
    // the run's rules board (Run settings and the Legacy list): it swings in, leans with the eye, the row under the
    // cursor stands forward
    if (D.rulesBoard) {
      if (S.rulesOpen && !D.rulesWas) D.rulesAt = now; D.rulesWas = S.rulesOpen;
      var re = lin((now - (D.rulesAt || 0)) / F, 0, 18);
      D.rulesBoard.localRotation = rot(-ey * 0.05 + (1 - outBack(re)) * 0.5, ex * 0.07 + (1 - outBack(re)) * -0.9, 0); setZ(D.rulesBoard, (1 - outCubic(re)) * 300);
      (S.rrows || []).forEach(function (w, i) {
        var f = S.rcur == i + (S.mtop || 0) && S.rulesOpen; if (f && !w.f3) w.f3At = now; w.f3 = f;
        var p = f ? outBack(lin((now - w.f3At) / F, 0, 10)) : 0;
        w.tr.localRotation = rot(0, p * ex * 0.12, 0); setZ(w.tr, -22 * p);
      });
      syncEx(S.rulesTitle);
    }
  };
  log("ready");
})();
