"""ruby_fx.py -- Red Reaper's astral sky, made at build time from the player's own BBTAG install.

BBTAG draws Red Reaper in front of Remnant's shattered moon (data/bg/astral/bg_exastralrrb: a 3D sky model with three
DDS layers: bg_moon, cloud, stars). BBEE's own Astral Heat (Izanami's) darkens the stage with a backdrop effect,
`Monster/Suboss/su_heidi_01`: a 50 x 40 u plane 1.44 u behind the characters whose tint fades in over 0.4 s and out
over 0.3 s. Ruby's sky is a clone of that effect: the same plane, screen coverage and fades, showing her moon, stars
and clouds (composed flat; the BBTAG layout is approximated) at full colour instead of 61 % black.

Four bundles, all written into the build folder only (the sky holds BBTAG art; never shipped):
  effect/common/texture/rrb/rrb_astral_bg    the composed sky (BC7, 4096 x 2048)
  effect/common/material/rrb/rrb_astral_bg   clone of particles_018_v pointing at it (tint 1, 1, 1, 1)
  effect/prefab/role/rrb/rrb_astral_01       clone of su_heidi_01 using it; played by name ASTRAL_FX
  effect/prefab/role/rrb/rrb_astral_flash    clone of su_heidi_01 in front of the characters, white: the white-out
"""
import io, os, re, sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path.insert(0, os.path.join(TOOLS, "tools", "bbtag"))

ASTRAL_FX = "Role/Rrb/rrb_astral_01"            # the effect name her action plays (effect/prefab/<lowercased>.ab)
FLASH_FX, FLASH_DST = "Role/Rrb/rrb_astral_flash", "effect/prefab/role/rrb/rrb_astral_flash"   # the white-out
FX_SRC, FX_DST = "effect/prefab/monster/suboss/su_heidi_01", "effect/prefab/role/rrb/rrb_astral_01"
MAT_SRC, MAT_DST = "effect/common/material/08_particles/particles_018_v", "effect/common/material/rrb/rrb_astral_bg"
TEX_SRC, TEX_DST = "effect/common/texture/08_particles/particles_018_4c", "effect/common/texture/rrb/rrb_astral_bg"

# SCREEN-LOCKED (proposal, 2026-10-02; local_only/agents/clashbg/CLASH_BG.md): the sky plane was world-anchored at her
# feet and 80 x 28 u, so the camera only ever saw a window of it (about 29 % x 35 %; 41 % of the height with the earlier
# 36 x 24 plane: 9.8 u of view / 24 u), wherever the camera happened to be relative to her. With the stock
# VFXEffectExtension.ScreenSpace = 1 the effect follows the camera (INFERRED: the battle camera rig
# gameplay/logic/cameraroot holds FullScreenEffect/EffectRoot 32 u ahead of the camera, z scale 3.16; verify with
# ruby_clashbg's rrb_clash_bg_grid first), so the plane is sized to the view and the composition is the screen.
EFFECT_ROOT = (32.0, 3.16)      # EffectRoot: u ahead of the camera, its z scale
SKY_DEPTH = 26.44               # u from the camera: 1.44 behind the play plane (the stock backdrop's depth)
FLASH_DEPTH = 20.0              # in front of the characters
PLANE = (37.0, 10.6)            # the view at 26.44 u is 9.80 u tall; 37 u covers 32 : 9 (34.9 u), 23.4 u at 2.39 : 1
FLASH_PLANE = (40.0, 12.0)      # (the view at 20 u: 7.4 u tall)
CENTER = (0.0, 0.0)             # the screen centre
TEX = (4096, 1176)              # the plane's own aspect (37 : 10.6)
PPU = 110                       # compose resolution, px per u
MOON = (3.5, 1.3, 15.0)         # moon picture: disc centre x, y (u from the SCREEN centre) and the picture's width
CLOUD_LOW = (-4.4, -3.4)        # the low cloud band (screen y): along the bottom edge, below her feet
CLOUD_HIGH = (2.6, 4.2)         # the few smaller clouds (screen y)


def z_local(depth):
    """local z under EffectRoot for a plane `depth` u from the camera"""
    return (depth - EFFECT_ROOT[0]) / EFFECT_ROOT[1]


def _layers():
    import bbtag_read as R
    f = R.fpac_files(R.read("data/bg/astral/bg_exastralrrb_img.pac"))
    return {k[:-4]: Image.open(io.BytesIO(f[k])).convert("RGBA") for k in ("bg_moon.dds", "cloud.dds", "stars.dds")}


def _clouds(img, n=14):
    """The cloud sheet's separate puffs (connected alpha components), largest first."""
    import bbtag_rig as RG
    full = np.array(img)
    k = 4   # label a quarter-size mask (fast), then cut each puff from the full-size sheet
    small = np.array(img.resize((img.width // k, img.height // k), Image.BILINEAR))[..., 3] > 16
    lab, areas = RG._components(small)
    lab_full = np.kron(lab, np.ones((k, k), np.int32))[:full.shape[0], :full.shape[1]]
    out = []
    for i in range(1, len(areas)):
        if areas[i] * k * k < 60 * 60:
            continue
        ys, xs = np.nonzero(lab == i)
        sl = (slice(ys.min() * k, (ys.max() + 1) * k), slice(xs.min() * k, (xs.max() + 1) * k))
        crop = full[sl].copy(); crop[..., 3] = np.where(lab_full[sl] == i, crop[..., 3], 0)
        out.append(Image.fromarray(crop))
    out.sort(key=lambda im: -im.width * im.height)
    return out[:n]


def compose():
    """-> the sky as PIL RGB at TEX size (world-uniform composition, squeezed to the texture; the plane stretches it back)."""
    L = _layers()
    W, H = int(PLANE[0] * PPU), int(PLANE[1] * PPU)
    X = lambda x: (x - (CENTER[0] - PLANE[0] / 2)) * PPU
    Y = lambda y: ((CENTER[1] + PLANE[1] / 2) - y) * PPU
    moon = L["bg_moon"]
    m = np.array(moon.convert("RGB")).astype(np.float32)
    edge = np.concatenate([m[0], m[-1], m[:, 0], m[:, -1]]).mean(0)          # the sky's own dark teal at its rim
    # base: that rim colour, a little lighter towards the horizon (her feet) like the moonlit haze
    yy = np.linspace(0, 1, H)[:, None, None]
    base = np.clip(edge * (0.75 + 0.45 * yy ** 2), 0, 255) * np.ones((1, W, 1))
    sky = Image.fromarray(base.astype(np.uint8), "RGB").convert("RGBA")
    # stars: tiled, added (they're white dots on black), about 10 u per tile
    st = L["stars"].convert("RGB").resize((int(10 * PPU), int(10 * PPU)), Image.BICUBIC)
    stars = Image.new("RGB", (W, H))
    for ty in range(0, H, st.height):
        for tx in range(0, W, st.width):
            stars.paste(st, (tx, ty))
    s = np.array(sky).astype(np.float32); s[..., :3] = np.clip(s[..., :3] + 0.85 * np.array(stars, np.float32), 0, 255)
    sky = Image.fromarray(s.astype(np.uint8), "RGBA")
    # the moon picture (its disc sits at 0.47, 0.40 of it), feathered into the sky at its square edges
    size = int(MOON[2] * PPU)
    mp = moon.resize((size, size), Image.BICUBIC)
    r = np.hypot(*np.meshgrid(np.linspace(-1, 1, size), np.linspace(-1, 1, size)))
    feather = np.clip((1.0 - r) / 0.35, 0, 1) ** 1.5
    arr = np.array(mp); arr[..., 3] = (feather * 255).astype(np.uint8); mp = Image.fromarray(arr)
    ox, oy = int(X(MOON[0]) - 0.47 * size), int(Y(MOON[1]) - 0.40 * size)
    sky.alpha_composite(mp, (ox, oy))
    # clouds: a low band just below her feet (never behind her body, where they'd hide her dark outfit) and a few
    # higher, smaller ones (seeded, so every build is the same)
    rng = np.random.default_rng(20070)
    puffs = _clouds(L["cloud"])
    x, i = -PLANE[0] / 2 - 1, 0
    while x < PLANE[0] / 2 + 1 and puffs:
        c = puffs[i % len(puffs)]; i += 1
        w = rng.uniform(4.5, 6.5); h = w * c.height / c.width
        cy = rng.uniform(*CLOUD_LOW)
        im = c.resize((int(w * PPU), max(1, int(h * PPU))), Image.BICUBIC)
        sky.alpha_composite(im, (int(X(x)), int(Y(cy + h / 2))))
        x += w * rng.uniform(0.55, 0.8)
    for _ in range(int(5 * PLANE[0] / 36.0)):
        c = puffs[int(rng.integers(len(puffs)))]
        w = rng.uniform(2.0, 3.2); h = w * c.height / c.width
        cx, cy = rng.uniform(-PLANE[0] / 2 + 2, PLANE[0] / 2 - 2), rng.uniform(*CLOUD_HIGH)
        im = c.resize((int(w * PPU), max(1, int(h * PPU))), Image.BICUBIC)
        a = np.array(im); a[..., 3] = (a[..., 3] * 0.7).astype(np.uint8)
        sky.alpha_composite(Image.fromarray(a), (int(X(cx)), int(Y(cy + h / 2))))
    # a soft vignette so the plane's far edges stay quiet
    vx, vy = np.meshgrid(np.linspace(-1, 1, W), np.linspace(-1, 1, H))
    vig = np.clip(1.0 - 0.35 * np.clip(np.hypot(vx, vy) - 0.6, 0, 1), 0, 1)[..., None]
    out = (np.array(sky.convert("RGB")).astype(np.float32) * vig).astype(np.uint8)
    return Image.fromarray(out, "RGB").resize(TEX, Image.LANCZOS)


def _cab_of(env):
    return list(env.file.files.keys())[0]


def _rename_bundle(sf, dst, renames, deps_map):
    import bbtag_rig as RG
    o = RG._bundle_obj(sf); t = o.read_typetree()
    t["m_Name"] = dst + ".ab"
    if t.get("m_AssetBundleName"): t["m_AssetBundleName"] = dst + ".ab"
    def ren(v):
        for a, b in renames: v = re.sub(re.escape(a), b, v, flags=re.I)
        return v
    t["m_Container"] = [[ren(k), v] for k, v in t["m_Container"]]
    if "m_Dependencies" in t:
        t["m_Dependencies"] = [deps_map.get(d.lower(), d) for d in t["m_Dependencies"]]
    o.save_typetree(t)


def build_astral(out_dir, log=print):
    """Writes the three bundles into out_dir; returns manifest additions like the rig's."""
    import bbtag_rig as RG
    bbmod, UnityPy = RG._unity()
    cache = os.path.join(RG.CACHE, "astral_sky_v3_screen_%dx%d.png" % (int(PLANE[0]), int(PLANE[1] * 10)))
    if os.path.exists(cache):
        img = Image.open(cache).convert("RGB")
    else:
        img = compose(); img.save(cache)
        log("  astral sky composed (%dx%d)" % img.size)
    adds = RG.clone_texture(TEX_SRC, TEX_DST, [("particles_018_4c", "rrb_astral_bg"), ("08_Particles", "Rrb")],
                            img.convert("RGBA"), out_dir, log)
    tex_cab = _cab_of(RG._env(bbmod, UnityPy, TEX_SRC))
    mat_cab = _cab_of(RG._env(bbmod, UnityPy, MAT_SRC))

    # material: points at the new texture; full-colour tint (the prefab's fades drive it anyway)
    env = RG._env(bbmod, UnityPy, MAT_SRC)
    sf, _ = RG._retarget(env, MAT_DST, None, {tex_cab.lower(): RG._cab(TEX_DST)})
    for o in sf.objects.values():
        if o.type.name == "Material":
            t = o.read_typetree(); t["m_Name"] = "rrb_astral_bg"
            t["m_SavedProperties"]["m_Colors"] = [[k, ({"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0} if k == "_TintColor" else v)]
                                                  for k, v in t["m_SavedProperties"]["m_Colors"]]
            # ZTest Always: the stage's own geometry nearer than the sky (floors, pillars) no longer cuts through it
            t["m_SavedProperties"]["m_Floats"] = [[k, (8.0 if k == "_ZTest" else v)] for k, v in t["m_SavedProperties"]["m_Floats"]]
            o.save_typetree(t)
    _rename_bundle(sf, MAT_DST, [("particles_018_v", "rrb_astral_bg"), ("08_Particles", "Rrb")],
                   {tex_cab.lower(): RG._cab(TEX_DST).lower()})
    RG._save(env, out_dir, MAT_DST)

    # prefab: the stock backdrop's plane and fades, on her material, at her plane size, fading to full colour
    env = RG._env(bbmod, UnityPy, FX_SRC)
    sf, _ = RG._retarget(env, FX_DST, None, {mat_cab.lower(): RG._cab(MAT_DST)})
    for o in sf.objects.values():
        n = o.type.name
        if n == "GameObject":
            t = o.read_typetree(); t["m_Name"] = t["m_Name"].replace("su_heidi_01", "rrb_astral_01"); o.save_typetree(t)
        elif n == "Transform":
            t = o.read_typetree()
            if abs(t["m_LocalScale"]["x"] - 1.0) > 1e-3:   # the plane (the root is unscaled)
                t["m_LocalScale"] = {"x": PLANE[0], "y": PLANE[1], "z": 1.0}
                t["m_LocalPosition"] = {"x": CENTER[0], "y": CENTER[1], "z": z_local(SKY_DEPTH)}
                o.save_typetree(t)
        elif n == "MonoBehaviour":
            t = o.read_typetree()
            if "ScreenSpace" in t:                          # VFXEffectExtension: behind the characters, on the camera
                t["m_option"] = 2; t["ScreenSpace"] = 1; o.save_typetree(t); continue
            refs = (t.get("references") or {}).get("RefIds") or []
            hit = False
            for r in refs:
                d = r.get("data") or {}
                if d.get("propName") == "_TintColor":
                    d["startValue"] = {"r": 1.0, "g": 1.0, "b": 1.0, "a": 0.0}
                    d["endValue"] = {"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0}; hit = True
            if hit:
                o.save_typetree(t)
    _rename_bundle(sf, FX_DST, [("Monster/Suboss/su_heidi_01", "Role/Rrb/rrb_astral_01")],
                   {mat_cab.lower(): RG._cab(MAT_DST).lower()})
    RG._save(env, out_dir, FX_DST)

    # the white-out that covers the switch to the sky (BBTAG rrb450_WhiteOut): the stock plane and its plain white
    # material, in FRONT of the characters, fading in fast (0.1 s) and out when stopped (0.35 s)
    env = RG._env(bbmod, UnityPy, FX_SRC)
    sf, _ = RG._retarget(env, FLASH_DST, None)
    for o in sf.objects.values():
        n = o.type.name
        if n == "GameObject":
            t = o.read_typetree(); t["m_Name"] = t["m_Name"].replace("su_heidi_01", "rrb_astral_flash"); o.save_typetree(t)
        elif n == "Transform":
            t = o.read_typetree()
            if abs(t["m_LocalScale"]["x"] - 1.0) > 1e-3:
                t["m_LocalScale"] = {"x": FLASH_PLANE[0], "y": FLASH_PLANE[1], "z": 1.0}
                t["m_LocalPosition"] = {"x": 0.0, "y": 0.0, "z": z_local(FLASH_DEPTH)}; o.save_typetree(t)
        elif n == "MonoBehaviour":
            t = o.read_typetree(); hit = False
            if "ScreenSpace" in t:                          # over the characters (NearFullScreenEffect), on the camera
                t["m_option"] = 6; t["ScreenSpace"] = 1; o.save_typetree(t); continue
            for r in (t.get("references") or {}).get("RefIds") or []:
                d = r.get("data") or {}
                if d.get("propName") == "_TintColor":
                    d["startValue"] = {"r": 1.0, "g": 1.0, "b": 1.0, "a": 0.0}
                    d["endValue"] = {"r": 1.0, "g": 1.0, "b": 1.0, "a": 0.7}
                    d["duration"] = 0.08 if t.get("Phase") == 0 else 0.15; hit = True
            if hit:
                o.save_typetree(t)
    _rename_bundle(sf, FLASH_DST, [("Monster/Suboss/su_heidi_01", "Role/Rrb/rrb_astral_flash")], {})
    RG._save(env, out_dir, FLASH_DST)

    shader = [d for d in RG._deps(MAT_SRC) if d != TEX_SRC]
    fx_deps = [{MAT_SRC: MAT_DST, TEX_SRC: TEX_DST}.get(d, d) for d in RG._deps(FX_SRC)]
    if TEX_DST not in fx_deps: fx_deps.append(TEX_DST)
    adds["names"] += [MAT_DST, FX_DST, FLASH_DST]
    adds["entries"] += [(MAT_DST, [TEX_DST] + shader), (FX_DST, fx_deps), (FLASH_DST, RG._deps(FX_SRC))]
    log("  Red Reaper sky: %s" % ", ".join(adds["names"]))
    return adds


# ---------------------------------------------------------------- her afterimage (V2_PLAN §4: 5AAAA and Gun Blast)
# BBEE draws afterimages with ActorTrailProxy: while the effect plays it copies the actor's own sprite every
# m_trailDeltaTime seconds and fades each copy with its material interpolators (research/osol_findings.md; Ruby is a
# PaletteFrameVisual actor like Ragna, so the copies get her real textures). The only stock carrier without a hit
# of its own is the speed boon's benediction_speed_01 (light blue). Her copy: rose, a short emission window so a
# long action doesn't keep dropping copies where she stands, and its sparkle particles off.
AFTER_FX = "Role/Rrb/rrb_afterimage"
AFTER_SRC, AFTER_DST = "effect/prefab/benediction/common/benediction_speed_01", "effect/prefab/role/rrb/rrb_afterimage"
AFTER_EMIT, AFTER_STEP, AFTER_FADE = 0.3, 0.025, 0.25   # s: emission window, one copy every, each copy fades over
AFTER_TINT = ({"r": 0.55, "g": 0.0, "b": 0.08, "a": 1.0}, {"r": 1.1, "g": 0.18, "b": 0.3, "a": 1.0})   # start, end


def build_afterimage(out_dir, log=print):
    import bbtag_rig as RG
    bbmod, UnityPy = RG._unity()
    env = RG._env(bbmod, UnityPy, AFTER_SRC)
    sf, _ = RG._retarget(env, AFTER_DST, None)
    n_proxy = 0
    for o in sf.objects.values():
        n = o.type.name
        if n == "GameObject":
            t = o.read_typetree(); t["m_Name"] = t["m_Name"].replace("benediction_speed_01", "rrb_afterimage"); o.save_typetree(t)
        elif n == "ParticleSystem":   # the boon's blue sparkles
            t = o.read_typetree(); t["EmissionModule"]["enabled"] = 0; o.save_typetree(t)
        elif n == "MonoBehaviour":
            t = o.read_typetree()
            if "m_trailDeltaTime" not in t:
                continue
            t["m_lifeTime"] = AFTER_EMIT; t["m_trailDeltaTime"] = AFTER_STEP; t["m_tag"] = "rrb_afterimage"
            t["m_keepFadingOnStop"] = 1   # stopped by a cancel: the copies already made still fade out
            for r in (t.get("references") or {}).get("RefIds") or []:
                d = r.get("data") or {}
                if "duration" in d: d["duration"] = AFTER_FADE
                if d.get("propName") == "_TintColor":
                    d["startValue"], d["endValue"] = dict(AFTER_TINT[0]), dict(AFTER_TINT[1])
            o.save_typetree(t); n_proxy += 1
    if n_proxy != 1:
        raise SystemExit("afterimage: expected one ActorTrailProxy in %s, found %d" % (AFTER_SRC, n_proxy))
    _rename_bundle(sf, AFTER_DST, [("Benediction/Common/benediction_speed_01", "Role/Rrb/rrb_afterimage")], {})
    RG._save(env, out_dir, AFTER_DST)
    log("  afterimage: %s" % AFTER_DST)
    return {"names": [AFTER_DST], "entries": [(AFTER_DST, RG._deps(AFTER_SRC))], "guids": []}
