"""ruby_clashbg.py -- BBTAG's Clash Assault presentation for Ruby, built at install time from the player's own BBTAG install.

What BBTAG draws (research: local_only/agents/clashbg/CLASH_BG.md):
  - the Clash background: data/bg/cmn/bg_exultimate (the engine's BG_CUltimate). A 3D scene that replaces the stage: a
    black starfield, streams of white diamonds pouring along spiral ribbons around a bright cloud core, glass panels.
    Seen from the model's Camera_check node; the view rises to Camera_check_jump as the chase goes up.
  - the finish background: data/bg/cmn/bg_exultimatefinish (BG_CUltimateFinish): four colour sectors around a black
    centre, a ring bursting out of the centre, glass blocks exploding outward and spinning.
  - the start flash: common particle ef_crusha and its chain (ef_crusha_tubu01 -> _line01 -> _ring01) from
    ClashAssaultEff.
Nothing from BBTAG is in this file; everything is read from the player's install when the mod is built, into the build
folder only (never packaged).

How it is rebuilt (everything animates at the render rate, no flipbooks):
  - each BBTAG layer becomes a mesh (the BBTAG geometry itself) on its own MeshRenderer, its scrolling done by a looping
    _MainTex_ST tween (the stock way: 711 stock MaterialTinter uses), fades by _TintColor tweens (phase 0 in, phase 2
    out on stop), block spins and growth by TransformMotor tweens;
  - screen-locked layers: the stock donor's VFXEffectExtension is set to MidEffectBack + ScreenSpace. The battle camera
    rig (gameplay/logic/cameraroot) holds CameraMid (perspective, vertical FOV 21) and, beside it, FullScreenEffect /
    EffectRoot 32 u in front of the camera with a z scale of 3.16: screen-space effects are assumed to live there
    (verify with GRID_FX). The BBTAG scene is placed in that camera space so the game's perspective camera draws it as
    BBTAG's camera did: BBTAG camera space (x, y, z) -> (s k x, s k y, k z) with s = tan(21/2) / tan(45/2) (BBTAG's
    battle camera is 45 degrees: its debug default BTL_CameraFOV and the 0.785398 rad the exe passes to
    D3DXMatrixPerspectiveFovLH). k only scales depth (the picture is the same for any k); every material uses ZTest
    Always, so the stage's own depth never cuts the backdrop.
  - the rise: one TransformMotor moves the whole scene down by the BBTAG camera's climb (Camera_check -> _jump), in the
    same camera space, so near layers move more than far ones exactly as in BBTAG.

usage from the build:   adds = ruby_clashbg.build(out_dir, log)      (manifest additions, like ruby_fx.build_astral)
effect names (AddEffects NameEx): CLASH_FX, FINISH_FX, START_FX, GRID_FX (debug: a calibration grid, same placement)
viewer=True builds a variant for tools/fxview.py (no EffectRoot there: camera 25 u from the root, x squeezed by ASPECT
so a square frame holds the whole 2.39 : 1 view).
"""
import copy, hashlib, io, math, os, re, struct, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path[:0] = [os.path.join(TOOLS, "tools", "bbtag"), TOOLS, ROOT]

# ---------------------------------------------------------------------------------------------------- effect names
CLASH_FX = "Role/Rrb/rrb_clash_bg"          # the diamond vortex, screen-locked behind the characters (the chase until
                                            # 0.7; not built or placed since 0.8.0: one backdrop, rrb_power.clash_bg)
FINISH_FX = "Role/Rrb/rrb_clash_finbg"      # the colour burst, screen-locked: the whole move's backdrop since 0.8.0
                                            # (until 0.7 only the stage-4 finish / full-charge flurry)
START_FX = "Role/Rrb/rrb_clash_start"       # the start flash at Ruby (ef_crusha chain), in front of her
GRID_FX = "Role/Rrb/rrb_clash_bg_grid"      # debug: calibration grid in the same screen-locked placement
EFFECTS = (CLASH_FX, FINISH_FX, START_FX, GRID_FX)


def prefab_of(fx):
    return "effect/prefab/" + fx.lower()


# ---------------------------------------------------------------------------------------------------- stock donors
DONOR = "effect/prefab/scene/droprecover_pvpmap_1"   # 8 MeshRenderer layers, each with phase 0 / 2 MaterialTinters,
                                                       # 5 with their own TransformMotor, all under one motor ("transform")
MESH_DONOR = "actor/mesh/hb/base"                     # 572 meshes: rewritten (tools/bbtag/bbtag_rig.MESH_DONORS)
MAT_DONOR = "effect/common/material/08_particles/particles_018_v"
TEX_DONOR = "effect/common/texture/08_particles/particles_018_4c"
SHADER = "noah/rendering/shader/effect/common"
REF_TYPES_FROM = "effect/prefab/monster/ta/mit_assign_430_02"   # declares TransformScale / TransformRotationInterpolator
RIG = "transform"                                     # donor GameObject paths (below the root)
G = {"bg": "transform/VFX_01/bg", "outline": "transform/VFX_01/outline", "icon": "transform/VFX_01/TH_icon",
     "o1": "transform/VFX_01/l1/out_1", "o2": "transform/VFX_01/l2_1/out_1", "o3": "transform/VFX_01/l2_2/out_1",
     "o4": "transform/VFX_01/l3_1/out_1", "o5": "transform/VFX_01/l3_2/out_1"}
MOTOR_GOS = ("o1", "o2", "o3", "o4", "o5")             # the layers that carry their own TransformMotor

# ---------------------------------------------------------------------------------------------------- placement
FOV_BBTAG, FOV_BBEE = 45.0, 21.0
S_FOV = math.tan(math.radians(FOV_BBEE / 2)) / math.tan(math.radians(FOV_BBTAG / 2))
GAME = dict(depth=32.0, zscale=3.16, k=0.03, squeeze=1.0)        # EffectRoot: 32 u ahead of the camera, z scale 3.16
VIEWER = dict(depth=25.0, zscale=1.0, k=0.0032, squeeze=1.0 / 2.389)   # fxview: FXVIEW_PERSP=25, far clip 125 u
ZNEAR_TAG = 150.0             # BBTAG units: geometry nearer the BBTAG camera is clipped (in game: k x 150 = 4.5 u)
ASPECT = 2.389                # the lead's 1720 x 720
RIM = 1.8                     # the finish disc and ring reach 1.8 x BBTAG's radius (covers up to 32 : 9; see _rim)

# ---------------------------------------------------------------------------------------------------- timing (s)
FADE_IN, FADE_OUT = 0.15, 0.30
# the view climbs to BBTAG's jump camera over the chase: rrb_clash_chase1 (0.24 s) + rrb_clash_chase2 (0.245 s) in the
# build of 2026-10-02 20:32 (gen/rrb_tree.json); BBTAG climbs over Chase1st + Chase2nd. build(rise=(delay, duration))
# overrides it if the chase is retimed.
RISE_DELAY, RISE_DUR = 0.05, 0.45
FLASH_LIFE = 0.45                   # the start flash's hub life (its layers are 12-20 ticks)
UNIT = 2.2 * 1.95 / 419             # BBTAG particle / model unit -> BBEE u (tools/bbtag: UNIT_PX x U_PER_PX)


def _log(*a):
    print(*a)


# ================================================================================================ BBTAG data (read-only)
def _pac(logical):
    import bbtag_read as R
    return R.fpac_files(R.read(logical))


def _scene(pac, img):
    """-> (bbtag_mua.Model, {texture name lower: PIL RGBA}, [evb scripts]) of a BBTAG BG archive pair."""
    import bbtag_read as R, bbtag_mua as MU
    f = _pac(pac)
    (name, data), = R.fpac_files(f["mdl.pac"]).items()
    model = MU.Model(data, name.rsplit(".", 1)[0])
    tex = {n.lower(): Image.open(io.BytesIO(d)).convert("RGBA") for n, d in _pac(img).items()}
    evb = []
    if "scr.pac" in f and f["scr.pac"][:4] == b"FPAC":
        for n, d in R.fpac_files(f["scr.pac"]).items():
            evb.append(_evb(n, d))
    return model, tex, evb


def _evb(name, d):
    """A BG .evb event script (inferred reading of its 32-byte records): 3 n = at frame n; 18 v d = ramp the object's
    value (alpha, /1000) to v over d frames; 15 n = loop back to frame n. -> (name, [(frame, value, frames)], loop)."""
    keys, loop, at = [], None, 0
    for p in range(0x30, len(d) - 31, 32):
        r = struct.unpack_from("<8i", d, p)
        if r[0] == 3: at = r[1]
        elif r[0] == 18: keys.append((at, r[1] / 1000.0, r[2]))
        elif r[0] == 15: loop = (at, r[1])
    return name, keys, loop


def _evb_curve(script, period):
    """value over one loop period [(t 0..1, value)] (the script is read from its loop-back frame)."""
    _, keys, loop = script
    start = loop[1] if loop else 0
    end = loop[0] if loop else period
    span = max(1, end - start)
    pts, v = [], keys[0][1] if keys else 1.0
    for at, target, dur in keys:
        if at < start: v = target; continue
        pts.append(((at - start) / span, v))
        v = target
        pts.append((min(1.0, (at + max(dur, 0) - start) / span), v))
    pts.append((1.0, v))
    out = []
    for t, val in sorted(pts):
        if out and abs(out[-1][0] - t) < 1e-6: out[-1] = (t, val)
        else: out.append((t, val))
    return out, span


def _object_hint(model, mesh):
    """MUA blend: a mesh is additive when its own object or its skeleton's object has blend hint 2."""
    for ob in model.objects:
        if ob["root"] == mesh["owner"] and ob["blend_hint"] == 2:
            return "add"
    sk = mesh["skeleton"]
    if 0 <= sk < len(model.objects) and model.objects[sk]["blend_hint"] == 2:
        return "add"
    return "alpha"


def _uv_speed(model, material):
    """BBTAG UV keys -> Unity UV scroll per second (u, v). BBTAG samples u*tile - off_u and v*tile + off_v (DirectX v
    down); our meshes store v' = 1 - v, so the v scroll changes sign."""
    m = model.materials[material]
    if not m["uv_count"]:
        return 0.0, 0.0
    ks = model.uvkeys[m["uv_start"]:m["uv_start"] + m["uv_count"]]
    (v0, f0), (v1, f1) = ks[0], ks[-1]
    if f1 <= f0:
        return 0.0, 0.0
    du = (v1[0] - v0[0]) / (f1 - f0) * 60.0
    dv = (v1[1] - v0[1]) / (f1 - f0) * 60.0
    return -du, -dv


# ================================================================================================ geometry
def _clip_tris(P, A, tris, znear):
    """Clip triangles against z >= znear (camera space). P (n,3), A (n,k) attributes. -> P2, A2, tris2."""
    P, A = list(P), list(A)
    out = []
    for t in tris:
        z = [P[i][2] for i in t]
        if min(z) >= znear:
            out.append(list(t)); continue
        if max(z) < znear:
            continue
        poly = []
        for j in range(3):
            a, b = t[j], t[(j + 1) % 3]
            ina, inb = P[a][2] >= znear, P[b][2] >= znear
            if ina: poly.append(a)
            if ina != inb:
                f = (znear - P[a][2]) / (P[b][2] - P[a][2])
                P.append(P[a] + (P[b] - P[a]) * f); A.append(A[a] + (A[b] - A[a]) * f); poly.append(len(P) - 1)
        for j in range(1, len(poly) - 1):
            out.append([poly[0], poly[j], poly[j + 1]])
    return np.array(P), np.array(A), np.array(out, np.int64).reshape(-1, 3)


def _camera_local(Pc, place):
    """BBTAG camera-space points (BBTAG units) -> the effect's local space (u)."""
    k = place["k"]
    X = S_FOV * k * Pc[:, 0]
    Y = S_FOV * k * Pc[:, 1]
    Z = (k * Pc[:, 2] - place["depth"]) / place["zscale"]
    return np.stack([X, Y, Z], 1)


def _rim(Pc, inner=0.55, reach=RIM):
    """Widescreen rim: BBTAG framed its flat finish discs for 16:9. Past `inner` of the disc's radius (seen from the
    camera axis) the geometry is pushed outward so the rim lands at `reach` x the radius: the centre composition is
    BBTAG's, and the faded edge stays outside a 2.39 : 1 (and 32 : 9) screen. UVs are unchanged."""
    r = np.hypot(Pc[:, 0], Pc[:, 1])
    R = r.max()
    r0 = inner * R
    k = (reach * R - r0) / max(1e-6, R - r0)
    r2 = np.where(r > r0, r0 + (r - r0) * k, r)
    f = np.where(r > 1e-6, r2 / np.maximum(r, 1e-6), 1.0)
    out = Pc.copy(); out[:, 0] *= f; out[:, 1] *= f
    return out


def _part(g, cam, place, colour_mul=None, pivot=None, warp=None):
    """One BBTAG mesh batch -> {verts (local u), uv (Unity), rgba, tris}, clipped at ZNEAR_TAG in BBTAG camera space.
    pivot (BBTAG world) puts the part's origin there (for layers that scale / spin about it); warp(camera-space points)
    reshapes the geometry first (the finish disc's widescreen rim)."""
    used = np.unique(g["tris"])
    remap = {int(v): i for i, v in enumerate(used)}
    tris = np.vectorize(remap.get)(g["tris"]) if len(g["tris"]) else np.zeros((0, 3), np.int64)
    Pc = g["xyz"][used] - np.asarray(cam)
    if warp is not None:
        Pc = warp(Pc)
    rgba = g["rgba"][used].copy()
    if colour_mul is not None:
        rgba[:, :3] *= np.asarray(colour_mul)[:3]
    uv = g["uv"][used]
    A = np.c_[uv, rgba]
    Pc, A, tris = _clip_tris(Pc, A, tris, ZNEAR_TAG)
    if not len(tris):
        return None
    verts = _camera_local(Pc, place)
    if pivot is not None:
        verts = verts - _camera_local((np.asarray(pivot) - np.asarray(cam))[None, :], place)[0]
    uvu = np.c_[A[:, 0], 1.0 - A[:, 1]]
    return {"verts": verts, "uv": uvu, "rgba": np.clip(A[:, 2:6], 0, 1), "tris": tris}


def _backing(place, z_t, climb=0.0, aspect=3.556, margin=1.3):
    """An opaque black quad behind a BBTAG scene, in BBTAG camera space at depth z_t: the screen at `aspect` (32 : 9)
    with `margin`, extended upward by the camera's climb. BBTAG drew its BG over a black clear, and its sky leaves gaps
    (from the jump camera only 86 % of a 2.39 : 1 screen; local_only/agents/clashbg/coverage.py); here a gap would
    show the stage. Its UVs sit on the texture's black corner and its vertex colour is black."""
    hh = z_t * math.tan(math.radians(FOV_BBTAG / 2)) * margin
    hw = hh * aspect
    P = np.array([[-hw, -hh, z_t], [hw, -hh, z_t], [hw, hh + climb, z_t], [-hw, hh + climb, z_t]])
    return {"verts": _camera_local(P, place), "uv": np.full((4, 2), 0.002), "rgba": np.tile([0.0, 0.0, 0.0, 1.0], (4, 1)),
            "tris": np.array([[0, 1, 2], [0, 2, 3]])}


def _merge(parts):
    parts = [p for p in parts if p]
    if not parts:
        return None
    out = {"verts": [], "uv": [], "rgba": [], "tris": []}
    n = 0
    for p in parts:
        for k in ("verts", "uv", "rgba"):
            out[k].append(p[k])
        out["tris"].append(p["tris"] + n); n += len(p["verts"])
    return {k: np.concatenate(v) for k, v in out.items()}


def _quad(w, h, cx=0.0, cy=0.0, ang=0.0, uv=(0, 0, 1, 1), rgba=(1, 1, 1, 1)):
    """A w x h quad centred (cx, cy), its local +y turned to `ang` radians from +y (counter-clockwise)."""
    loc = np.array([[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]])
    c, s = math.cos(ang), math.sin(ang)
    rot = loc @ np.array([[c, s], [-s, c]])
    v = np.c_[rot + [cx, cy], np.zeros(4)]
    u0, v0, u1, v1 = uv
    return {"verts": v, "uv": np.array([[u0, v1], [u1, v1], [u1, v0], [u0, v0]], float),
            "rgba": np.tile(np.asarray(rgba, float), (4, 1)), "tris": np.array([[0, 1, 2], [0, 2, 3]])}


# ================================================================================================ Unity bundles
def _unity():
    import bbtag_rig as RG
    return RG._unity()


def _env(logical):
    import bbtag_rig as RG
    bbmod, UnityPy = _unity()
    return RG._env(bbmod, UnityPy, logical)


def _cab(logical):
    return "CAB-" + hashlib.md5(logical.encode()).hexdigest()


def _cab_of(logical):
    return list(_env(logical).file.files.keys())[0]


def _save(env, out, dst):
    import bbtag_rig as RG
    return RG._save(env, out, dst)


def _ab_rename(sf, dst, asset_path, deps=None):
    import bbtag_rig as RG
    o = RG._bundle_obj(sf); t = o.read_typetree()
    t["m_Name"] = dst + ".ab"
    if "m_AssetBundleName" in t: t["m_AssetBundleName"] = dst + ".ab"
    if t["m_Container"]:
        t["m_Container"] = [[asset_path, t["m_Container"][0][1]]]
    if deps is not None and "m_Dependencies" in t:
        t["m_Dependencies"] = deps
    o.save_typetree(t)


def _texture(out, dst, img, log, repeat=True):
    """A texture bundle (clone of the stock particles texture, BC7) holding `img`, with mipmaps and wrap Repeat."""
    import bbtag_rig as RG
    env = _env(TEX_DONOR)
    sf, _ = RG._retarget(env, dst, None)
    name = dst.rsplit("/", 1)[-1]
    for o in list(sf.objects.values()):
        if o.type.name == "Texture2D":
            d = o.read()
            d.m_Name = name
            n = int(math.log2(max(img.width, img.height))) - 1 if max(img.width, img.height) >= 8 else 1
            d.set_image(img.convert("RGBA"), target_format=d.m_TextureFormat, mipmap_count=max(1, n))
            ts = d.m_TextureSettings
            if repeat:
                ts.m_WrapU = ts.m_WrapV = ts.m_WrapW = 0
            ts.m_FilterMode = max(1, ts.m_FilterMode)
            d.save()
    _ab_rename(sf, dst, "Assets/AssetBundle/Effect/Common/Texture/Rrb/%s.png" % name)
    _save(env, out, dst)
    log("  clashbg texture %s %dx%d" % (dst, img.width, img.height))
    return {"names": [dst], "entries": [(dst, [])], "guids": []}


def _material(out, dst, tex_dst, add, scroll_st=False, log=_log, ztest=8, queue=None):
    """A material bundle: the stock effect material (NOAH/Effect/Variant/Common) on our texture. Alpha or additive
    (SrcAlpha / One), ZTest Always for the backdrop layers, tint 1 (the tinters set it)."""
    import bbtag_rig as RG
    tex_cab = _cab_of(TEX_DONOR)
    env = _env(MAT_DONOR)
    sf, _ = RG._retarget(env, dst, None, {tex_cab.lower(): _cab(tex_dst)})
    name = dst.rsplit("/", 1)[-1]
    for o in sf.objects.values():
        if o.type.name == "Material":
            t = o.read_typetree(); t["m_Name"] = name
            sp = t["m_SavedProperties"]
            fl = dict(sp["m_Floats"])
            fl.update({"_BlendSrc": 5.0, "_BlendDst": 1.0 if add else 10.0, "_ZTest": float(ztest), "_ZWrite": 0.0, "_Cull": 0.0})
            sp["m_Floats"] = [[k, float(v)] for k, v in fl.items()]
            sp["m_Colors"] = [[k, ({"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0} if k == "_TintColor" else
                                   {"r": 0.0, "g": 0.0, "b": 0.0, "a": 0.0} if k in ("_MainUVFlowSpeed", "_AddColor") else v)]
                              for k, v in sp["m_Colors"]]
            if queue is not None and "m_CustomRenderQueue" in t:
                t["m_CustomRenderQueue"] = int(queue)
            o.save_typetree(t)
    _ab_rename(sf, dst, "Assets/AssetBundle/Effect/Common/Material/Rrb/%s.mat" % name,
               [d if d != tex_cab.lower() else _cab(tex_dst).lower() for d in (RG._bundle_obj(sf).read_typetree().get("m_Dependencies") or [])])
    _save(env, out, dst)
    shader = [d for d in RG._deps(MAT_DONOR) if d != TEX_DONOR]
    return {"names": [dst], "entries": [(dst, [tex_dst] + shader)], "guids": []}


_MAT_PID = None


def _material_pid():
    global _MAT_PID
    if _MAT_PID is None:
        _MAT_PID = next(o.path_id for o in _env(MAT_DONOR).objects if o.type.name == "Material")
    return _MAT_PID


def _mesh_bytes(verts, uv, rgba):
    """Interleaved 60-byte vertices: position, normal, colour UNorm8 x4, UV0, then UV1-UV3 = 0. The common effect
    shader's main texture reads UV0 + TEXCOORD2.xy (a particle's Custom1; on a MeshRenderer it is the mesh's UV2), so
    UV2 must be zero here or every texture repeats twice (fxview check, 2026-10-02)."""
    n = len(verts)
    rec = np.zeros(n, dtype=[("p", "<f4", 3), ("n", "<f4", 3), ("c", "u1", 4), ("uv", "<f4", 2), ("uv1", "<f4", 2),
                             ("uv2", "<f4", 2), ("uv3", "<f4", 2)])
    rec["p"] = verts; rec["n"][:, 2] = -1.0
    rec["c"] = np.clip(np.asarray(rgba) * 255 + 0.5, 0, 255).astype(np.uint8)
    rec["uv"] = uv
    return rec


CHANNELS = [(0, 0, 0, 3), (0, 12, 0, 3), (0, 0, 0, 0), (0, 24, 2, 4), (0, 28, 0, 2), (0, 36, 0, 2), (0, 44, 0, 2),
            (0, 52, 0, 2)] + [(0, 0, 0, 0)] * 6


def _meshes(out, dst, parts, log):
    """One mesh bundle holding one Mesh per part (a stock mesh bundle, its meshes rewritten). -> [path id]."""
    import bbtag_rig as RG
    env = _env(MESH_DONOR)
    sf, _ = RG._retarget(env, dst, None)
    meshes = [pid for pid, o in sf.objects.items() if o.type.name == "Mesh"]
    keep = meshes[:len(parts)]
    for pid in meshes[len(parts):]:
        del sf.objects[pid]
    for i, (p, pid) in enumerate(zip(parts, keep)):
        o = sf.objects[pid]; t = o.read_typetree()
        if len(p["verts"]) > 65535:
            raise SystemExit("clashbg: mesh %d of %s has %d vertices (16-bit indices)" % (i, dst, len(p["verts"])))
        v = _mesh_bytes(np.asarray(p["verts"], np.float32), np.asarray(p["uv"], np.float32), p["rgba"])
        tris = np.asarray(p["tris"], np.uint16).reshape(-1)
        vd = t["m_VertexData"]
        vd["m_VertexCount"] = int(len(v))
        vd["m_Channels"] = [{"stream": s, "offset": off, "format": f, "dimension": d} for s, off, f, d in CHANNELS]
        vd["m_DataSize"] = v.tobytes()
        t["m_Name"] = "%s_%02d" % (dst.rsplit("/", 1)[-1], i)
        t["m_IndexFormat"] = 0
        t["m_IndexBuffer"] = list(tris.tobytes())
        lo, hi = np.asarray(p["verts"]).min(0), np.asarray(p["verts"]).max(0)
        aabb = {"m_Center": dict(zip("xyz", map(float, (lo + hi) / 2))), "m_Extent": dict(zip("xyz", map(float, np.maximum((hi - lo) / 2, 1e-3))))}
        t["m_SubMeshes"] = [{"firstByte": 0, "indexCount": int(len(tris)), "topology": 0, "baseVertex": 0, "firstVertex": 0,
                             "vertexCount": int(len(v)), "localAABB": aabb}]
        t["m_LocalAABB"] = aabb
        if "m_MeshCompression" in t: t["m_MeshCompression"] = 0
        t["m_IsReadable"] = True; t["m_KeepVertices"] = True; t["m_KeepIndices"] = True
        o.save_typetree(t)
    ab = RG._bundle_obj(sf); t = ab.read_typetree()
    rest = [pid for pid, o in sf.objects.items() if o.type.name != "AssetBundle"]
    t["m_PreloadTable"] = [{"m_FileID": 0, "m_PathID": pid} for pid in rest]
    asset = "Assets/AssetBundle/Effect/Common/Fbx/Rrb/%s.asset" % dst.rsplit("/", 1)[-1]
    t["m_Container"] = [[asset, {"preloadIndex": 0, "preloadSize": len(rest), "asset": {"m_FileID": 0, "m_PathID": pid}}] for pid in rest]
    t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
    t["m_Dependencies"] = []
    ab.save_typetree(t)
    _save(env, out, dst)
    log("  clashbg meshes %s: %s vertices" % (dst, [len(p["verts"]) for p in parts]))
    return keep, {"names": [dst], "entries": [(dst, [])], "guids": []}


# ------------------------------------------------------------------------------------------------ interpolators
def _key(t, v, slope=0.0):
    return {"time": float(t), "value": float(v), "inSlope": float(slope), "outSlope": float(slope), "weightedMode": 0,
            "inWeight": 0.0, "outWeight": 0.0}


def _curve(pts=None, smooth=False):
    """[(t, v)] -> AnimationCurve (linear slopes, or smoothstep-like flat ends when smooth)."""
    ks = []
    pts = list(pts or [])
    for i, (t, v) in enumerate(pts):
        if smooth:
            sl = 0.0
        else:
            sl_in = (v - pts[i - 1][1]) / max(1e-6, t - pts[i - 1][0]) if i > 0 else None
            sl_out = (pts[i + 1][1] - v) / max(1e-6, pts[i + 1][0] - t) if i + 1 < len(pts) else None
            k = _key(t, v); k["inSlope"] = float(sl_in if sl_in is not None else (sl_out or 0.0))
            k["outSlope"] = float(sl_out if sl_out is not None else (sl_in or 0.0)); ks.append(k); continue
        ks.append(_key(t, v, sl))
    return {"m_Curve": ks, "m_PreInfinity": 2, "m_PostInfinity": 2, "m_RotationOrder": 4}


LINEAR = [(0.0, 0.0), (1.0, 1.0)]


def _base(duration, delay=0.0, loops=0):
    return {"priority": 0, "loops": int(loops), "loopType": 0, "duration": float(duration), "delay": float(delay),
            "m_enabled": 1, "restore": 0, "ignoreTimeScale": 0}


def _rgba(c):
    return dict(zip("rgba", map(float, c)))


def _xyz(c):
    return dict(zip("xyz", map(float, c)))


def tint(start, end, duration, curve=LINEAR, delay=0.0, loops=0, from_source=False, channels=None):
    """MaterialColorInterpolator on _TintColor. channels: 4 per-channel curves (splitter mode) instead of `curve`."""
    d = _base(duration, delay, loops)
    d.update(startValue=_rgba(start), endValue=_rgba(end), fromSource=[int(from_source)] * 4, absoluteCurve=[0, 0, 0, 0])
    if channels:
        d.update(easeType=[1, 1, 1, 1], curve=[_curve(c) for c in channels], enabledFields=[1, 1, 1, 1], splitterMode=1)
    else:
        d.update(easeType=[1, 0, 0, 0], curve=[_curve(curve)] + [_curve() for _ in range(3)], enabledFields=[0, 0, 0, 0], splitterMode=0)
    d.update(propName="_TintColor", toggles=[])
    return ("MaterialColorInterpolator", d)


def scroll(speed_u, speed_v):
    """A looping _MainTex_ST tween: the texture offset runs one full repeat per period (seamless, wrap Repeat)."""
    sp = max(abs(speed_u), abs(speed_v))
    if sp < 1e-6:
        return None
    period = 1.0 / sp
    d = _base(period, 0.0, -1)
    d.update(startValue={"x": 1.0, "y": 1.0, "z": 0.0, "w": 0.0},
             endValue={"x": 1.0, "y": 1.0, "z": float(speed_u * period), "w": float(speed_v * period)},
             fromSource=[0, 0, 0, 0], absoluteCurve=[0, 0, 0, 0], easeType=[0, 0, 1, 1],
             curve=[_curve(), _curve(), _curve(LINEAR), _curve(LINEAR)], enabledFields=[1, 1, 1, 1], splitterMode=1,
             propName="_MainTex_ST", toggles=[])
    return ("MaterialVector4Interpolator", d)


def move(start, end, duration, delay=0.0, curve=None):
    """TransformPositionInterpolator on y (x / z held), built as stock does (splitter mode, Curve ease on y)."""
    d = _base(duration, delay)
    d.update(startValue=_xyz(start), endValue=_xyz(end), fromSource=[0, 0, 0], absoluteCurve=[0, 0, 0], easeType=[0, 1, 0],
             curve=[_curve(), _curve(curve or LINEAR), _curve()], enabledFields=[0, 1, 0], splitterMode=1)
    return ("TransformPositionInterpolator", d)


def grow(start, end, duration, curve=LINEAR, delay=0.0, loops=0):
    d = _base(duration, delay, loops)
    d.update(startValue=_xyz(start), endValue=_xyz(end), fromSource=[0, 0, 0], absoluteCurve=[0, 0, 0], easeType=[1, 0, 0],
             curve=[_curve(curve), _curve(), _curve()], enabledFields=[1, 1, 1], splitterMode=0)
    return ("TransformScaleInterpolator", d)


def spin(degrees, duration, curve=LINEAR, delay=0.0, loops=0):
    d = _base(duration, delay, loops)
    d.update(startValue=_xyz((0, 0, 0)), endValue=_xyz((0, 0, degrees)), fromSource=[0, 0, 0], absoluteCurve=[0, 0, 0],
             easeType=[0, 0, 1], curve=[_curve(), _curve(), _curve(curve)], enabledFields=[1, 1, 1], splitterMode=1)
    return ("TransformRotationInterpolator", d)


def _refs(interps):
    interps = [x for x in interps if x]
    return ([{"rid": i} for i in range(len(interps))],
            {"version": 2, "RefIds": [{"rid": i, "type": {"class": c, "ns": "NOAH.VFXInterpolator", "asm": "VFX.Interpolator"}, "data": d}
                                      for i, (c, d) in enumerate(interps)]})


# ------------------------------------------------------------------------------------------------ the prefab
def _prefab(out, fx, layers, mesh_dst, mesh_pids, opt, screen, phase_end, duration, rig=None, log=_log, rig_scale=(1, 1, 1)):
    """Clone the donor into effect `fx`. layers: {donor layer key (G): dict(mesh=index into mesh_pids, mat=material
    bundle, pos, rot (deg z), scale, tint0=[interps], tint2=[interps], motor=[interps], order)}; rig: motor interps for
    the "transform" GameObject (moves every layer). opt: VFXEffectExtension option (2 MidEffectBack, 3 MidEffectFront)."""
    import bbtag_rig as RG
    dst = prefab_of(fx)
    name = dst.rsplit("/", 1)[-1]
    env = _env(DONOR)
    sf, newcab = RG._retarget(env, dst, None)
    objs = dict(sf.objects)

    def scrub(v):
        """drop every reference into the donor's own externals (we replace the external list)"""
        if isinstance(v, dict):
            if set(v.keys()) == {"m_FileID", "m_PathID"} and v["m_FileID"] > 0:
                return {"m_FileID": 0, "m_PathID": 0}
            return {k: scrub(x) for k, x in v.items()}
        if isinstance(v, list):
            return [scrub(x) for x in v]
        return v
    T = {pid: scrub(o.read_typetree()) for pid, o in objs.items() if o.type.name in (
        "Transform", "GameObject", "MonoBehaviour", "MeshRenderer", "MeshFilter", "ParticleSystemRenderer", "ParticleSystem")}
    go_of = {pid: t["m_GameObject"]["m_PathID"] for pid, t in T.items() if "m_GameObject" in t}
    # GameObject paths
    tr_of_go = {g: pid for pid, g in go_of.items() if objs[pid].type.name == "Transform"}
    path = {}
    def walk(tpid, prefix):
        t = T[tpid]; g = t["m_GameObject"]["m_PathID"]
        p = (prefix + "/" if prefix else "") + T[g]["m_Name"]
        path[g] = p
        for c in t["m_Children"]:
            walk(c["m_PathID"], p)
    root_tr = next(pid for pid, t in T.items() if objs[pid].type.name == "Transform" and t["m_Father"]["m_PathID"] == 0)
    walk(root_tr, "")
    root_go = T[root_tr]["m_GameObject"]["m_PathID"]
    rootname = T[root_go]["m_Name"]
    go_by_path = {p.split("/", 1)[1] if "/" in p else "": g for g, p in path.items()}
    want = {key: go_by_path[G[key]] for key in layers}
    active = set(want.values()) | {root_go}
    rig_go = go_by_path[RIG]
    for g in list(active):
        tp = T[tr_of_go[g]]["m_Father"]["m_PathID"]
        while tp:
            active.add(T[tp]["m_GameObject"]["m_PathID"]); tp = T[tp]["m_Father"]["m_PathID"]
    # externals: our mesh bundle, then one material bundle per layer
    mats = []
    for key, L in layers.items():
        if L["mat"] not in mats: mats.append(L["mat"])
    proto = sf.externals[0]
    ext = []
    for b in [mesh_dst] + mats:
        fi = copy.copy(proto); fi.path = "archive:/%s/%s" % (_cab(b), _cab(b)); ext.append(fi)
    sf.externals = ext
    ext_index = {b: i + 1 for i, b in enumerate([mesh_dst] + mats)}
    # components per GameObject
    comps = {}
    for pid, g in go_of.items():
        comps.setdefault(g, []).append(pid)
    hub_pid = ext_pid = None
    vfx, rends = [], []
    layer_of_go = {g: key for key, g in want.items()}
    for pid, t in T.items():
        tn = objs[pid].type.name
        g = go_of.get(pid)
        L = layers.get(layer_of_go.get(g)) if g is not None else None
        if tn == "GameObject":
            if pid == root_go: t["m_Name"] = name
            t["m_IsActive"] = pid in active
        elif tn == "Transform":
            if g in active and g != root_go:
                t["m_LocalPosition"] = _xyz(L["pos"] if L else (0, 0, 0))
                ang = math.radians((L or {}).get("rot", 0.0)) / 2
                t["m_LocalRotation"] = {"x": 0.0, "y": 0.0, "z": math.sin(ang), "w": math.cos(ang)}
                t["m_LocalScale"] = _xyz(rig_scale if g == rig_go else (L or {}).get("scale", (1, 1, 1)))
            elif g == root_go:
                t["m_LocalPosition"] = _xyz((0, 0, 0)); t["m_LocalScale"] = _xyz((1, 1, 1))
        elif tn == "MeshFilter":
            t["m_Mesh"] = {"m_FileID": 1, "m_PathID": mesh_pids[L["mesh"]]} if L else {"m_FileID": 0, "m_PathID": 0}
        elif tn == "MeshRenderer":
            if L:
                t["m_Materials"] = [{"m_FileID": ext_index[L["mat"]], "m_PathID": _material_pid()}]
                t["m_Enabled"] = True; t["m_SortingOrder"] = int(L.get("order", 0))
                t["m_CastShadows"] = 0; t["m_ReceiveShadows"] = 0; t["m_MotionVectors"] = 2
                rends.append(pid)
            else:
                t["m_Materials"] = []; t["m_Enabled"] = False
        elif tn in ("ParticleSystemRenderer",):
            t["m_Materials"] = []; t["m_Enabled"] = False
            if "m_Mesh" in t: t["m_Mesh"] = {"m_FileID": 0, "m_PathID": 0}
            for k in ("m_Mesh1", "m_Mesh2", "m_Mesh3"):
                if k in t: t[k] = {"m_FileID": 0, "m_PathID": 0}
        elif tn == "MonoBehaviour":
            if "ScreenSpace" in t:
                t["m_option"] = int(opt); t["ScreenSpace"] = int(screen); ext_pid = pid
            elif "m_vfxEffects" in t:
                hub_pid = pid
            elif "MaterialInterpolators" in t and "MaterialMask" in t:
                ips = (L or {}).get("tint0" if t["Phase"] <= 1 else "tint2") or []
                if L and ips:
                    t["MaterialInterpolators"], t["references"] = _refs(ips); t["m_Enabled"] = 1; t["MaterialMask"] = 4294967295
                    vfx.append(pid)
                else:
                    t["MaterialInterpolators"], t["references"] = _refs([]); t["m_Enabled"] = 0
            elif "TransformInterpolators" in t:
                ips = rig if g == rig_go else (L or {}).get("motor")
                if ips:
                    t["TransformInterpolators"], t["references"] = _refs(ips); t["m_Enabled"] = 1
                    t["m_target"] = {"m_FileID": 0, "m_PathID": tr_of_go[g]}
                    vfx.append(pid)
                else:
                    t["TransformInterpolators"], t["references"] = _refs([]); t["m_Enabled"] = 0
            elif "instantiateMaterial" in t:
                t["m_Enabled"] = 1 if L else 0
    h = T[hub_pid]
    h["m_vfxEffects"] = [{"m_FileID": 0, "m_PathID": p} for p in vfx]
    h["m_renderers"] = [{"m_FileID": 0, "m_PathID": p} for p in rends]
    for k in ("m_particles", "m_particleRenderers", "m_animations", "m_animators", "m_subEffectHubs"):
        if k in h: h[k] = []
    h["m_overrideDuration"] = 1; h["m_duration"] = float(duration); h["m_phaseEndTime"] = float(phase_end)
    h["m_maxParticleLifetime"] = 0.0; h["m_alwaysUpdate"] = 1; h["m_instantStop"] = 0
    # SerializeReference type declarations for the scale / rotation interpolators
    oenv = _env(REF_TYPES_FROM); of = list(oenv.file.files.values())[0]
    have = {(t_.m_NameSpace, t_.m_ClassName) for t_ in sf.ref_types}
    for t_ in of.ref_types:
        if (t_.m_NameSpace, t_.m_ClassName) not in have:
            sf.ref_types.append(t_); have.add((t_.m_NameSpace, t_.m_ClassName))
    for pid, t in T.items():
        objs[pid].save_typetree(t)
    # the AssetBundle: name, container, preload table, dependencies
    ab = RG._bundle_obj(sf); t = ab.read_typetree()
    local = [p for p, o in sf.objects.items() if o.type.name != "AssetBundle"]
    extern = [{"m_FileID": 1, "m_PathID": p} for p in sorted(set(mesh_pids[L["mesh"]] for L in layers.values()))] + \
             [{"m_FileID": ext_index[m], "m_PathID": _material_pid()} for m in mats]
    t["m_PreloadTable"] = [{"m_FileID": 0, "m_PathID": p} for p in local] + extern
    t["m_Container"] = [["Assets/AssetBundle/Effect/Prefab/Role/Rrb/%s.prefab" % name,
                         {"preloadIndex": 0, "preloadSize": len(t["m_PreloadTable"]), "asset": {"m_FileID": 0, "m_PathID": root_go}}]]
    t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
    t["m_Dependencies"] = [_cab(b).lower() for b in [mesh_dst] + mats]
    ab.save_typetree(t)
    _save(env, out, dst)
    log("  clashbg prefab %s: %d layers, option %d, screen %d" % (dst, len(layers), opt, screen))
    return {"names": [dst], "entries": [(dst, [mesh_dst] + mats)], "guids": []}


def _add(adds, a):
    for k in adds:
        adds[k] += a[k]


# ================================================================================================ the effects
def _layer_set(out, fx, specs, place_name, log):
    """specs: [(layer key, part, texture name, PIL image, add, extra dict)] -> (mesh bundle, pids, layers, adds)"""
    adds = {"names": [], "entries": [], "guids": []}
    slug = fx.rsplit("/", 1)[-1].lower()
    mesh_dst = "effect/common/fbx/rrb/" + slug
    pids, a = _meshes(out, mesh_dst, [s[1] for s in specs], log); _add(adds, a)
    layers, done = {}, {}
    for i, (key, part, texname, img, add, extra) in enumerate(specs):
        tslug = re.sub(r"[^a-z0-9]", "_", texname.lower().replace(".dds", ""))
        tdst = "effect/common/texture/rrb/clashbg/%s_%s" % (slug, tslug)
        mdst = "effect/common/material/rrb/clashbg/%s_%s_%s" % (slug, tslug, "add" if add else "alpha")
        if tdst not in done:
            _add(adds, _texture(out, tdst, img, log)); done[tdst] = 1
        if mdst not in done:
            _add(adds, _material(out, mdst, tdst, add, log=log, ztest=extra.get("ztest", 8),
                                 queue=extra.get("queue"))); done[mdst] = 1
        L = dict(mesh=i, mat=mdst); L.update({k: v for k, v in extra.items() if k not in ("ztest", "queue")})
        layers[key] = L
    return mesh_dst, pids, layers, adds


def _clash(out, place, log, rise=None):
    """The Clash background (bg_exultimate scene A) as six screen-locked layers, one per BBTAG material."""
    rise_delay, rise_dur = rise or (RISE_DELAY, RISE_DUR)
    model, tex, _ = _scene("data/bg/cmn/bg_exultimate.pac", "data/bg/cmn/bg_exultimate_img.pac")
    nodes = {nd["name"]: i for i, nd in enumerate(model.nodes)}
    cam = model._world(nodes["Camera_check"], None)[3, :3]
    jump = model._world(nodes["Camera_check_jump"], None)[3, :3]
    batches = model.geometry(0)
    mesh_by = {m["name"]: m for m in model.meshes}
    groups = {}
    for g in batches:
        if np.unique(g["tris"]).size == 0: continue
        if g["xyz"][np.unique(g["tris"])][:, 0].mean() > 30000:      # scene B (the smoke sky) is another set
            continue
        tn = (g["texture"] or "").lower()
        mul = None
        if tn == "tenmetsu.dds":                                   # one texel of the blink texture: bake it, use white
            t = np.asarray(tex["tenmetsu.dds"], float) / 255.0
            u, v = g["uv"][np.unique(g["tris"])][0]
            mul = t[int(np.clip(v, 0, 0.999) * t.shape[0]), int(np.clip(u, 0, 0.999) * t.shape[1])]
            tn = "white.dds"
        blend = _object_hint(model, mesh_by[g["mesh"]])
        speed = _uv_speed(model, g["material"]) if tn != "white.dds" else (0.0, 0.0)
        key = (tn, blend, round(speed[0], 4), round(speed[1], 4))
        groups.setdefault(key, []).append(_part(g, cam, place, colour_mul=mul))
    order = sorted(groups, key=lambda k: (k[1] != "alpha", -abs(k[2]) - abs(k[3])))
    slots = ["bg", "outline", "icon", "o1", "o2", "o3", "o4", "o5"]
    specs = []
    for slot, key in zip(slots, order):
        tn, blend, su, sv = key
        back = [_backing(place, 36000.0, climb=float(jump[1] - cam[1]))] if slot == "bg" else []   # first: drawn first
        part = _merge(back + groups[key])
        L = {"pos": (0, 0, 0), "tint0": [tint((1, 1, 1, 0), (1, 1, 1, 1), FADE_IN), scroll(su, sv)],
             "tint2": [tint((1, 1, 1, 1), (1, 1, 1, 0), FADE_OUT, from_source=True)],
             "queue": 2990 if blend == "alpha" else 3000}
        specs.append((slot, part, tn, tex[tn], blend == "add", L))
        log("  clashbg vortex layer %-8s %-16s %-5s scroll (%.2f, %.2f)/s, %d vertices" % (slot, tn, blend, su, sv, len(part["verts"])))
    mesh_dst, pids, layers, adds = _layer_set(out, CLASH_FX, specs, "game", log)
    dy = S_FOV * place["k"] * float(jump[1] - cam[1])
    rig = [move((0, 0, 0), (0, -dy, 0), rise_dur, rise_delay)]
    rig[0][1]["curve"][1] = _curve([(0, 0), (1, 1)], smooth=True)          # ease in and out
    _add(adds, _prefab(out, CLASH_FX, layers, mesh_dst, pids, opt=2, screen=1, phase_end=FADE_OUT, duration=-1.0, rig=rig, log=log,
                       rig_scale=(place["squeeze"], 1, 1)))
    log("  clashbg vortex: BBTAG camera FOV %.0f, rise %.2f u from %.2f s over %.2f s" % (FOV_BBTAG, dy, rise_delay, rise_dur))
    return adds


def _block_motion(model, mesh, t0, period=80):
    """A finish block's own motion from its skinned geometry: [(t 0..1, scale)], [(t, degrees)] over one loop from
    tick t0 (the block bones loop every 80 ticks)."""
    sc, rot, prev, acc = [], [], None, 0.0
    ref = None
    for k in range(0, period + 1, 2):
        f = t0 + k
        if f > period: f -= period                        # the bone track runs 0..80 and loops
        g = next(x for x in model.geometry(f) if x["mesh"] == mesh)
        P = g["xyz"][np.unique(g["tris"])]
        c = P.mean(0); ext = float(np.ptp(P[:, 0])); ang = math.degrees(math.atan2(P[0][1] - c[1], P[0][0] - c[0]))
        if ref is None: ref = (ext, ang); prev = ang
        d = ang - prev
        while d > 180: d -= 360
        while d < -180: d += 360
        acc += d; prev = ang
        sc.append((k / period, ext / ref[0])); rot.append((k / period, acc))
    return sc, rot


def _finish(out, place, log):
    """The finish background (bg_exultimatefinish): disc, ring, two block rings."""
    model, tex, evb = _scene("data/bg/cmn/bg_exultimatefinish.pac", "data/bg/cmn/bg_exultimatefinish_img.pac")
    nodes = {nd["name"]: i for i, nd in enumerate(model.nodes)}
    cam = model._world(nodes["Camera_check"], None)[3, :3]
    by = {g["mesh"]: g for g in model.geometry(0)}
    by10 = {g["mesh"]: g for g in model.geometry(10)}
    mesh_by = {m["name"]: m for m in model.meshes}
    period = 80
    specs = []
    for slot, mesh in (("bg", "bg"), ("outline", "flash")):
        g = by[mesh]; su, sv = _uv_speed(model, g["material"])
        blend = _object_hint(model, mesh_by[mesh])
        L = {"pos": (0, 0, 0), "order": 0 if mesh == "bg" else 1, "queue": 2990 if blend == "alpha" else 3000,
             "tint0": [tint((1, 1, 1, 0), (1, 1, 1, 1), FADE_IN), scroll(su, sv)],
             "tint2": [tint((1, 1, 1, 1), (1, 1, 1, 0), FADE_OUT, from_source=True)]}
        part = _part(g, cam, place, warp=_rim)
        if mesh == "bg":                                   # an opaque black back first (BBTAG's clear colour)
            part = _merge([_backing(place, 27500.0), part])
        specs.append((slot, part, g["texture"].lower(), tex[g["texture"].lower()], blend == "add", L))
        log("  clashbg finish layer %s (%s, %s) scroll (%.2f, %.2f)/s, widescreen rim x%.1f" % (slot, mesh, blend, su, sv, RIM))
    # the blocks: ring meshes at the bone pivot; scale and spin from the bones, alpha from the .evb scripts
    ev = {s[0].lower(): s for s in evb}
    for slot, mesh, t0, script in (("o1", "block_1", 0, "block.evb"), ("o2", "block_2", 10, "block2.evb")):
        g = (by if t0 == 0 else by10)[mesh]
        P = g["xyz"][np.unique(g["tris"])]
        pivot = P.mean(0)
        part = _part(g, cam, place, pivot=pivot)
        sc, rot = _block_motion(model, mesh, t0, period)
        smax = max(v for _, v in sc)
        acurve, aspan = _evb_curve(ev[script], period)
        apeak = max(v for _, v in acurve) or 1.0
        su, sv = _uv_speed(model, g["material"])
        pv = _camera_local((pivot - cam)[None, :], place)[0]
        L = {"pos": tuple(pv), "order": 2,
             "motor": [grow((1, 1, 1), (smax, smax, 1), period / 60.0, [(t, (v - 1) / (smax - 1)) for t, v in sc], delay=t0 / 60.0, loops=-1),
                       spin(rot[-1][1], period / 60.0, [(t, v / rot[-1][1]) for t, v in rot], delay=t0 / 60.0, loops=-1)],
             "tint0": [tint((1, 1, 1, 0), (1, 1, 1, apeak), aspan / 60.0, [(t, v / apeak) for t, v in acurve],
                            delay=(ev[script][2][1] if ev[script][2] else 0) / 60.0, loops=-1), scroll(su, sv)],
             "tint2": [tint((1, 1, 1, 1), (1, 1, 1, 0), FADE_OUT, from_source=True)]}
        specs.append((slot, part, g["texture"].lower(), tex[g["texture"].lower()], True, L))
        log("  clashbg finish %s: scale x%.2f, spin %.0f deg per %d ticks, alpha peak %.2f over %d ticks" % (mesh, smax, rot[-1][1], period, apeak, aspan))
    mesh_dst, pids, layers, adds = _layer_set(out, FINISH_FX, specs, "game", log)
    _add(adds, _prefab(out, FINISH_FX, layers, mesh_dst, pids, opt=2, screen=1, phase_end=FADE_OUT, duration=-1.0, log=log,
                       rig_scale=(place["squeeze"], 1, 1)))
    return adds


def _atlas_cells():
    """The common particle atlas (data/particle/particle_img_e0, 32-bit BGRA DDS) -> PIL crops of the flash cells."""
    f = _pac("data/particle/particle_img_e0.pac")
    b = f["particle.dds"]
    h, w = struct.unpack_from("<II", b, 12)
    a = np.frombuffer(b, np.uint8, count=w * h * 4, offset=128).reshape(h, w, 4)[..., [2, 1, 0, 3]]
    cell = lambda x0, y0, x1, y1: Image.fromarray(np.ascontiguousarray(a[y0:y1, x0:x1]), "RGBA")
    return {"crusha": cell(3072, 2048, 3584, 2560), "ring": cell(1024, 2048, 1536, 2560),
            "tubu": cell(3584, 2560, 3840, 2816), "line": cell(3968, 2944, 4096, 3072)}


def _start(out, log):
    """The start flash: ef_crusha (glow, 90 -> x2.8 -> x3, 14 ticks), ef_crusha_ring01 (70 -> x2.5 -> x3, 14 ticks),
    ef_crusha_tubu01 (30 streaks flung out from a 40-unit circle) and ef_crusha_line01 (8 long thin lines). Each BBTAG
    emitter is one layer; the particles' flight is a scale tween of the layer (approximation: all streaks of a layer
    move together), sizes and colours as the emitters define them. Colours: white -> cyan (0.5, 1, 1) at 30 % ->
    blue, alpha out."""
    cells = _atlas_cells()
    rng = np.random.default_rng(80808)
    tick = 1.0 / 60
    W = lambda u: u * UNIT
    crusha = _quad(W(90), W(90))
    ring = _quad(W(70), W(70))
    streaks = []
    for i in range(30):                                   # spread evenly with BBTAG's 0.87 rad random arc
        a = 2 * math.pi * i / 30 + rng.uniform(-0.435, 0.435)
        streaks.append(_quad(W(20), W(20), math.cos(a) * W(40), math.sin(a) * W(40), a - math.pi / 2))
    lines = []
    for i in range(8):
        a = 2 * math.pi * i / 8 + rng.uniform(-0.2, 0.2)
        lines.append(_quad(W(16), W(110), math.cos(a) * W(60), math.sin(a) * W(60), a - math.pi / 2))
    cyan = [[(0, 1), (0.3, 0.5), (1, 0)], [(0, 1), (0.3, 1), (1, 0)], [(0, 1), (1, 1)]]
    specs = [
        ("o1", crusha, "ef_crusha", cells["crusha"], True,
         {"pos": (0, 0, 0), "order": 3, "ztest": 4,
          "motor": [grow((1, 1, 1), (3, 3, 1), 14 * tick, [(0, 0), (0.5, 0.9), (1, 1)])],
          "tint0": [tint((0, 0, 0, 0), (1, 1, 1, 1), 14 * tick, channels=cyan + [[(0, 1), (0.3, 0.59), (1, 0)]])]}),
        ("o2", ring, "ef_crusha_ring01", cells["ring"], True,
         {"pos": (0, 0, 0), "order": 3, "ztest": 4,
          "motor": [grow((1, 1, 1), (3, 3, 1), 14 * tick, [(0, 0), (0.5, 0.75), (1, 1)])],
          "tint0": [tint((0, 0, 0, 0), (1, 1, 1, 1), 14 * tick, channels=cyan + [[(0, 1), (0.3, 1), (1, 0)]])]}),
        ("o3", _merge(streaks), "ef_crusha_tubu01", cells["tubu"], True,
         {"pos": (0, 0, 0), "order": 3, "ztest": 4,       # flight: 4-8 units a tick, drag 0.9 -> 40-80 units out
          "motor": [grow((1, 1, 1), (2.5, 2.5, 1), 18 * tick, [(t, (1 - 0.9 ** (18 * t)) / (1 - 0.9 ** 18)) for t in np.linspace(0, 1, 7)])],
          "tint0": [tint((0, 0, 0, 0), (1, 1, 1, 1), 18 * tick, channels=cyan + [[(0, 1), (0.5, 1), (1, 0)]])]}),
        ("o4", _merge(lines), "ef_crusha_line01", cells["line"], True,
         {"pos": (0, 0, 0), "order": 3, "ztest": 4,       # 12 units a tick, drag 0.9; long and thin by the end
          "motor": [grow((0.15, 0.15, 1), (1.3, 1.3, 1), 16 * tick, [(t, (1 - 0.9 ** (16 * t)) / (1 - 0.9 ** 16)) for t in np.linspace(0, 1, 7)])],
          "tint0": [tint((0, 0, 0, 0), (1, 1, 1, 1), 16 * tick, channels=[[(0, 1), (0.8, 0), (1, 0)], [(0, 1), (0.8, 0.5), (1, 0)], [(0, 1), (1, 1)], [(0, 1), (0.8, 1), (1, 0)]])]}),
    ]
    for s in specs:
        s[5]["tint2"] = [tint((1, 1, 1, 1), (1, 1, 1, 0), 0.08, from_source=True)]
    mesh_dst, pids, layers, adds = _layer_set(out, START_FX, specs, "world", log)
    _add(adds, _prefab(out, START_FX, layers, mesh_dst, pids, opt=3, screen=0, phase_end=0.08, duration=FLASH_LIFE, log=log))
    return adds


def grid_image(w_u=25.0, h_u=10.5, ppu=80):
    """Calibration grid: 1 u cells, numbered columns / rows from the centre, the expected 2.39 : 1 view at the grid's
    depth (red), a 16 : 9 view (yellow), the centre cross (green). Debug only."""
    W, H = int(w_u * ppu), int(h_u * ppu)
    im = Image.new("RGBA", (W, H), (20, 24, 40, 200)); d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("arial.ttf", 22)
    except OSError: font = ImageFont.load_default()
    cx, cy = W / 2, H / 2
    for i in range(-13, 14):
        x = cx + i * ppu; d.line([(x, 0), (x, H)], fill=(255, 255, 255, 120), width=1)
        d.text((x + 3, cy + 3), "%d" % i, fill=(255, 255, 255, 255), font=font)
    for j in range(-6, 7):
        y = cy - j * ppu; d.line([(0, y), (W, y)], fill=(255, 255, 255, 120), width=1)
        d.text((cx + 3, y + 3), "%d" % j, fill=(255, 255, 255, 255), font=font)
    vh = 2 * 26.5 * math.tan(math.radians(FOV_BBEE / 2))
    for asp, col in ((ASPECT, (255, 60, 60, 255)), (16 / 9, (255, 220, 40, 255))):
        vw = vh * asp
        d.rectangle([cx - vw / 2 * ppu, cy - vh / 2 * ppu, cx + vw / 2 * ppu, cy + vh / 2 * ppu], outline=col, width=6)
    d.line([(cx - 40, cy), (cx + 40, cy)], fill=(60, 255, 60, 255), width=5)
    d.line([(cx, cy - 40), (cx, cy + 40)], fill=(60, 255, 60, 255), width=5)
    d.text((12, 10), "rrb_clash_bg_grid: red = 1720x720 view at 1.5 u behind the play plane, yellow = 16:9, green = centre",
           fill=(255, 255, 255, 255), font=font)
    return im.resize((2048, 1024), Image.LANCZOS)          # power-of-two sides for BC7 mipmaps


def _grid(out, place, log):
    """Debug: a 25 x 10.5 u grid 1.5 u behind the play plane (26.5 u from the camera), in the clash background's
    placement. In game the red frame should sit just outside the screen edges and stay put while the camera moves."""
    D = 26.5
    k = place["k"]
    z = (D - place["depth"]) / place["zscale"]
    q = _quad(25.0, 10.5)
    q["verts"][:, 2] = z
    img = grid_image()
    specs = [("bg", q, "grid", img, False, {"pos": (0, 0, 0), "queue": 2990,
                                            "tint0": [tint((1, 1, 1, 0), (1, 1, 1, 1), FADE_IN)],
                                            "tint2": [tint((1, 1, 1, 1), (1, 1, 1, 0), FADE_OUT, from_source=True)]})]
    mesh_dst, pids, layers, adds = _layer_set(out, GRID_FX, specs, "game", log)
    _add(adds, _prefab(out, GRID_FX, layers, mesh_dst, pids, opt=2, screen=1, phase_end=FADE_OUT, duration=-1.0, log=log,
                       rig_scale=(place["squeeze"], 1, 1)))
    return adds


def build(out_dir, log=print, viewer=False, which=EFFECTS, rise=None):
    """Writes every bundle into out_dir; returns manifest additions {"names", "entries", "guids"} like ruby_fx's.
    viewer=True: the fxview variant of the screen-locked effects (see the module notes). rise=(delay, duration) in
    seconds from the backdrop's spawn: when the view climbs (default RISE_DELAY, RISE_DUR)."""
    place = VIEWER if viewer else GAME
    adds = {"names": [], "entries": [], "guids": []}
    if CLASH_FX in which: _add(adds, _clash(out_dir, place, log, rise))
    if FINISH_FX in which: _add(adds, _finish(out_dir, place, log))
    if START_FX in which: _add(adds, _start(out_dir, log))
    if GRID_FX in which: _add(adds, _grid(out_dir, place, log))
    seen, names, entries = set(), [], []
    for n in adds["names"]:
        if n not in seen: seen.add(n); names.append(n)
    seen = set()
    for n, d in adds["entries"]:
        if n not in seen: seen.add(n); entries.append((n, d))
    log("  Clash Assault presentation: %s" % ", ".join(x.rsplit("/", 1)[-1] for x in names if x.startswith("effect/prefab")))
    return {"names": names, "entries": entries, "guids": []}
