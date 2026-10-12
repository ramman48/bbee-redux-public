"""fxcompile_ruby.py -- Cross Effect V2: build Ruby's arc effects at BUILD TIME from the player's own BBTAG install.

docs/cross-effect/V2_REBUILD.md §2. For each effect in gen/fxplan.json (written by build_ruby.py):
  1. tools/bbtag/bbtag_fxcompile.py turns her BBTAG effect state into parts (ribbon meshes, timing, U scroll, fade);
  2. every BBTAG ribbon texture a part uses becomes a texture clone (the player's own pixels) and a material clone
     of BBEE's common effect shader (alpha or additive, HDR tint for the additive glow);
  3. the parts' meshes go into one mesh bundle for the effect (a clone of a stock mesh bundle, its meshes rewritten:
     position, normal, colour (BBTAG's alpha along the stroke), UV0);
  4. the kit's slash template (fxkit_cross rrb_arc: 40 single-particle mesh slots) is cloned for the effect and each
     slot filled with one part: mesh, material, origin, start delay, life, Custom1.x = BBTAG's U scroll (the game
     shader adds Custom1.xy to the main UV), colour and fade. Unused slots emit nothing.
     Extra BBEE layers from the plan: a hot "core" streak sweeping along each body part (official streak, additive
     HDR) and a refraction layer on heavy swings.
Nothing this writes is shipped: the output folder is the build, and gen/ is local.
"""
import hashlib, json, os, re, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path[:0] = [os.path.join(TOOLS, "tools", "bbtag"), TOOLS, ROOT]

TEMPLATE = "effect/prefab/role/rrb/rrb_arc"
SLOTS = 40
N_ALPHA, N_ADD = 4, 4                       # placeholder materials m0..m3 (alpha), m4..m7 (additive); m8 core, m9 refract
BODY_MAT, BODY_TEX = "effect/common/material/08_particles/particles_018_m", "effect/common/texture/08_particles/particles_018_4c"
ADD_MAT, ADD_TEX = "effect/common/material/02_glow/glow_205_b", "effect/common/texture/02_glow/glow_205_4c"
MESH_DONOR = "actor/mesh/hb/base"           # 572 meshes (tools/bbtag/bbtag_rig.py MESH_DONORS)
CACHE = os.path.join(ROOT, "local_only", "cache", "fxcompile")
# the look (V2_REBUILD §2): BBTAG's shapes, BBEE's light. Per role: particle colour (LDR, x the material tint), which
# material family, draw order (lower sorting fudge = on top), and the material HDR tint for the texture clones.
ROLE = {
    "edge":  dict(color=(0.30, 0.02, 0.06, 1.0), add=False, fudge=0.30),
    "body":  dict(color=(1.00, 0.06, 0.12, 1.0), add=False, fudge=0.20),
    "glow":  dict(color=(0.95, 0.30, 0.38, 0.40), add=True, fudge=0.10),
    # the hot core: an additive copy of the body's own silhouette; x the additive tint 2.4 its white inner tone passes
    # the game's bloom threshold (1.37) while the grey outer tone stays under it, and it fades over the part's life:
    # each swing flashes hot on its damaging ticks and cools to her red (BBEE's luminous smears, V2_PLAN P2)
    "core":  dict(color=(1.00, 0.30, 0.36, 1.0), add=True, fudge=0.00),
    "flash": dict(color=(1.00, 0.95, 0.90, 1.0), add=True, fudge=0.05),
}
# research/BBEE_REFERENCE_RAGNA_NAOTO.md: BBEE smears keep the body under the bloom threshold (tint ~0.7-0.85) and let
# only a thin hot core bloom (tint ~3); ours: body 0.9, additive layers 2.6 (the core's inner white tone ~2.6 red)
ALPHA_TINT, ADD_TINT = (0.9, 0.9, 0.9, 1.0), (2.6, 2.6, 2.6, 1.0)


def _cab(logical):
    return "CAB-" + hashlib.md5(logical.encode()).hexdigest()


def _curve(keys):
    """[(t 0..1, value)] -> a Unity AnimationCurve typetree (linear)."""
    ks = []
    for i, (t, v) in enumerate(keys):
        if i + 1 < len(keys):
            t1, v1 = keys[i + 1]; slope = (v1 - v) / max(1e-6, t1 - t)
        else:
            slope = 0.0
        prev = ks[-1]["outSlope"] if ks else slope
        ks.append({"serializedVersion": 3, "time": float(t), "value": float(v), "inSlope": float(prev), "outSlope": float(slope),
                   "tangentMode": 0, "weightedMode": 0, "inWeight": 0.333333, "outWeight": 0.333333})
    return {"serializedVersion": 2, "m_Curve": ks, "m_PreInfinity": 2, "m_PostInfinity": 2, "m_RotationOrder": 4}


def _texture_png(name):
    """A BBTAG texture from the player's install, as a PNG in the local cache."""
    import bbtag_mua as MU
    from PIL import Image
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, re.sub(r"[^a-z0-9_]", "_", name.lower()) + ".png")
    if not os.path.exists(p):
        base, _, mod = name.partition("#")
        a = MU.texture(base, "rrb")
        if mod == "trail": a = _trail_texture(a)
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA").save(p)
    return p


def _trail_texture(a, head=0.94):
    """A smooth trail's texture (ruby_blade.swing_ribbon, TRAIL_HEAD): BBTAG's stroke (U 0.5 -> 0.97 of the original)
    squeezed into U 0 -> `head`, transparent past it and fading in over the first 4 %: the stock textures clamp, so the
    trail's rows ahead of its head (and behind its tail) must sample nothing."""
    H, W = a.shape[:2]
    un = (np.arange(W) + 0.5) / W
    uo = 0.5 + 0.47 * np.clip(un / head, 0.0, 1.0)
    xo = np.clip(uo * W - 0.5, 0, W - 1)
    i0 = np.floor(xo).astype(int); i1 = np.minimum(i0 + 1, W - 1); f = (xo - i0)[None, :, None]
    out = a[:, i0, :] * (1 - f) + a[:, i1, :] * f
    w = np.clip(un / 0.04, 0.0, 1.0) * (un <= head)
    out[:, :, 3] *= w[None, :]
    return out


def _mesh_bytes(verts, uv, alpha, uv4=False):
    """Interleaved vertices, 36 bytes: position float3, normal float3, colour UNorm8 x4 (particle meshes read colour as
    8-bit: a float colour showed as dark blue in fxview, 2026-09-29), UV0 float2. uv4: also UV1-UV3 = UV0 (60 bytes):
    the stock Common shader samples its mask, sub-texture and dissolve on UV2-UV4 (VFX_RECIPE 2.2)."""
    n = len(verts)
    fields = [("p", "<f4", 3), ("n", "<f4", 3), ("c", "u1", 4), ("uv", "<f4", 2)] + ([("uv1", "<f4", 2), ("uv2", "<f4", 2), ("uv3", "<f4", 2)] if uv4 else [])
    rec = np.zeros(n, dtype=fields)
    rec["p"][:, 0:2] = verts                              # position (the fighting plane, z 0)
    rec["n"][:, 2] = -1.0                                 # normal toward the camera
    rec["c"][:, 0:3] = 255                                # colour: BBTAG's white with its alpha along the stroke
    rec["c"][:, 3] = np.clip(np.asarray(alpha) * 255 + 0.5, 0, 255).astype(np.uint8)
    rec["uv"] = uv                                        # UV0 (BBTAG's; the shader adds Custom1.xy)
    if uv4:
        rec["uv1"] = uv; rec["uv2"] = uv; rec["uv3"] = uv
    return rec


def _mesh_bytes_nocolor(verts, uv):
    """For the kit's rrb_slash layers: position, normal, UV0-UV3 (all = UV0), NO vertex colour (the kit, 2026-10-02: a
    mesh carrying colours, even all white, drew its layers near black). 56 bytes."""
    n = len(verts)
    rec = np.zeros(n, dtype=[("p", "<f4", 3), ("n", "<f4", 3), ("uv", "<f4", 2), ("uv1", "<f4", 2), ("uv2", "<f4", 2), ("uv3", "<f4", 2)])
    rec["p"][:, 0:2] = verts; rec["n"][:, 2] = -1.0
    rec["uv"] = uv; rec["uv1"] = uv; rec["uv2"] = uv; rec["uv3"] = uv
    return rec


CHANNELS_NOCOLOR = [(0, 0, 0, 3), (0, 12, 0, 3), (0, 0, 0, 0), (0, 0, 0, 0), (0, 24, 0, 2), (0, 32, 0, 2), (0, 40, 0, 2), (0, 48, 0, 2)] + [(0, 0, 0, 0)] * 6
CHANNELS = [(0, 0, 0, 3), (0, 12, 0, 3), (0, 0, 0, 0), (0, 24, 2, 4), (0, 28, 0, 2)] + [(0, 0, 0, 0)] * 9
CHANNELS_UV4 = [(0, 0, 0, 3), (0, 12, 0, 3), (0, 0, 0, 0), (0, 24, 2, 4), (0, 28, 0, 2), (0, 36, 0, 2), (0, 44, 0, 2), (0, 52, 0, 2)] + [(0, 0, 0, 0)] * 6


def write_meshes(out, dst, parts, log=print):
    """One mesh bundle holding every part's mesh. -> {part index: path id}."""
    import UnityPy, bbmod
    import bbtag_rig as RG
    env = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(MESH_DONOR + ".ab"))); env.typetree_generator = bbmod.typetree_gen()
    sf, _ = RG._retarget(env, dst, None)
    meshes = [pid for pid, o in sf.objects.items() if o.type.name == "Mesh"]
    if len(meshes) < len(parts):
        raise SystemExit("fxcompile: %s needs %d meshes, donor has %d" % (dst, len(parts), len(meshes)))
    keep = meshes[:len(parts)]
    for pid in meshes[len(parts):]:
        del sf.objects[pid]
    out_pid = {}
    for i, (p, pid) in enumerate(zip(parts, keep)):
        o = sf.objects[pid]; t = o.read_typetree()
        verts = np.asarray(p["verts"], np.float32); uv = np.asarray(p["uv"], np.float32); a = np.asarray(p["alpha"], np.float32)
        if p.get("nocolor"):
            v = _mesh_bytes_nocolor(verts, uv); ch = CHANNELS_NOCOLOR
        else:
            v = _mesh_bytes(verts, uv, a, uv4=bool(p.get("uv4"))); ch = CHANNELS_UV4 if p.get("uv4") else CHANNELS
        tris = np.asarray(p["tris"], np.uint16).reshape(-1)
        vd = t["m_VertexData"]
        vd["m_VertexCount"] = int(len(v))
        vd["m_Channels"] = [{"stream": s, "offset": off, "format": f, "dimension": d} for s, off, f, d in ch]
        vd["m_DataSize"] = v.tobytes()
        t["m_Name"] = "arc_%02d" % i
        t["m_IndexFormat"] = 0
        t["m_IndexBuffer"] = list(tris.tobytes())
        lo = np.r_[verts.min(0), 0.0]; hi = np.r_[verts.max(0), 0.0]
        aabb = {"m_Center": dict(zip("xyz", map(float, (lo + hi) / 2))), "m_Extent": dict(zip("xyz", map(float, np.maximum((hi - lo) / 2, 1e-3))))}
        t["m_SubMeshes"] = [{"firstByte": 0, "indexCount": int(len(tris)), "topology": 0, "baseVertex": 0, "firstVertex": 0,
                             "vertexCount": int(len(v)), "localAABB": aabb}]
        t["m_LocalAABB"] = aabb
        t["m_IsReadable"] = True; t["m_KeepVertices"] = True; t["m_KeepIndices"] = True
        o.save_typetree(t)
        out_pid[i] = pid
    ab = RG._bundle_obj(sf); t = ab.read_typetree()
    rest = [pid for pid, o in sf.objects.items() if o.type.name != "AssetBundle"]
    t["m_PreloadTable"] = [{"m_FileID": 0, "m_PathID": pid} for pid in rest]
    asset = "Assets/AssetBundle/Effect/Common/Fbx/Rrb/%s.asset" % dst.rsplit("/", 1)[-1]
    t["m_Container"] = [[asset, {"preloadIndex": 0, "preloadSize": len(rest), "asset": {"m_FileID": 0, "m_PathID": pid}}] for pid in rest]
    t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
    ab.save_typetree(t)
    RG._save(env, out, dst)
    return out_pid


def rim_alpha(p, width=0.45):
    """The hot core rides the blade's OUTER edge only (BBEE's bright-edge layer): the ribbon side farther from the
    swing's pivot (a circle fitted to the part) keeps its alpha, fading to 0 by `width` of the way across (V)."""
    v = np.asarray(p["verts"], float); uv = np.asarray(p["uv"], float); a = np.asarray(p["alpha"], float)
    x, y = v[:, 0], v[:, 1]
    A = np.stack([x, y, np.ones_like(x)], 1)
    try:
        c = np.linalg.lstsq(A, x * x + y * y, rcond=None)[0]; cx, cy = c[0] / 2, c[1] / 2
    except np.linalg.LinAlgError:
        cx, cy = x.mean(), y.mean() - 1.0
    r = np.hypot(x - cx, y - cy)
    lo, hi = uv[:, 1] < 0.5, uv[:, 1] >= 0.5
    outer_is_high = (r[hi].mean() if hi.any() else 0) >= (r[lo].mean() if lo.any() else 0)
    d = (1.0 - uv[:, 1]) if outer_is_high else uv[:, 1]          # 0 at the outer edge, 1 at the inner
    w = np.clip(1.0 - d / width, 0.0, 1.0) ** 1.5
    return (a * w).round(3).tolist()


def _extent(p):
    import numpy as np
    v = np.asarray(p["verts"]); return float(max(v.max(0) - v.min(0)))


def drop_oversized(fxname, parts, log=print, factor=2.0):
    """BBTAG's soft wind layers are sometimes far larger than the blade (rrb320Eff_3, Corkscrew: 10.6 u across, a whole
    screen on BBEE's camera, where its texture reads as stray lines: Test 6's "thin white line more than 1,200 px"). A
    part more than `factor` times the effect's largest blade layer (body / edge) is left out and logged."""
    blade = [_extent(p) for p in parts if p["role"] in ("body", "edge")]
    if not blade: return parts
    lim = factor * max(blade)
    keep = [p for p in parts if _extent(p) <= lim]
    for p in parts:
        if _extent(p) > lim:
            log("  fxcompile: %s: left out %s (%s, %.1f u across; blade %.1f u)" % (fxname, p["key"], p["role"], _extent(p), max(blade)))
    return keep


def to_floor(fxname, parts, log=print, gap=0.0):
    """Lower every part so the blade's lowest point (body / edge, from her root) meets the floor. Only lowers: a stroke
    that already reaches it stays. BBTAG's downward strikes end 0.14-0.18 u above her floor (rrb404Eff, rrb409Eff) and
    hand the contact to a ground effect; in BBEE the blade itself should meet the floor where the impact is."""
    import numpy as np
    low = [float(np.asarray(p["verts"])[:, 1].min() + p["origin"][1]) for p in parts if p["role"] in ("body", "edge")]
    if not low or min(low) <= gap: return parts
    dy = gap - min(low)
    out = []
    for p in parts:
        q = dict(p); q["origin"] = (p["origin"][0], p["origin"][1] + dy); out.append(q)
    log("  fxcompile: %s: lowered %.2f u to meet the floor" % (fxname, -dy))
    return out


def _lerp_keys(keys, t, d):
    if not keys: return d
    if t <= keys[0][0]: return keys[0][1]
    for (x0, v0), (x1, v1) in zip(keys, keys[1:]):
        if x0 <= t <= x1: return v0 + (v1 - v0) * ((t - x0) / (x1 - x0) if x1 > x0 else 1.0)
    return keys[-1][1]


def _thin(keys, n):
    """at most n keys, keeping the first, the last and the largest changes"""
    if len(keys) <= n: return keys
    inner = sorted(range(1, len(keys) - 1), key=lambda i: -abs(keys[i][1] - keys[i - 1][1]) - abs(keys[i + 1][1] - keys[i][1]))[:n - 2]
    return [keys[0]] + [keys[i] for i in sorted(inner)] + [keys[-1]]


def revealed_area(parts, t):
    """blade area on screen at tick t: body / edge triangles the U scroll shows (the shader samples U - off), x fade"""
    import numpy as np
    s = 0.0
    for p in parts:
        if p["role"] not in ("body", "edge") or not (p["t0"] <= t <= p["t1"]): continue
        V = np.asarray(p["verts"]); UV = np.asarray(p["uv"]); off = _lerp_keys(p["uscroll"], t, 0.0)
        fa = max(0.0, min(1.0, _lerp_keys(p["fade"], t, 1.0)))
        for tri in p["tris"]:
            if -0.02 <= UV[list(tri), 0].mean() - off <= 1.02:
                a_, b_, c_ = V[tri[0]], V[tri[1]], V[tri[2]]
                s += 0.5 * abs((b_[0] - a_[0]) * (c_[1] - a_[1]) - (c_[0] - a_[0]) * (b_[1] - a_[1])) * fa
    return s


LINGER, HOLD = 8, 2      # ticks: how long the finished stroke stays, and how much of that at full strength


def animate(fxname, parts, o, log=print):
    """How her arcs play (the lead: animated nicely, good glow, long enough for oomph but not too long):
    - BBTAG's own build-up is kept (its segments and U scroll follow the blade: ruby_preview --ticks sheets);
    - the finished stroke (the segments still showing on its last tick) holds HOLD ticks, then fades out over the
      rest of LINGER, whole (BBTAG cut it in one tick: Test 6 / preview, j.A at 0.28 s);
    - the hot core follows ONE envelope for the whole effect: rising with the stroke, full when the stroke is
      complete, held, then gone slightly before the body (each core copy fading over its own short segment made the
      glow flicker: 2.1, 1.1, 2.8, 2.0, 1.3 peak over consecutive frames of rrb271Eff).
    Plan options: linger (ticks), hold (ticks)."""
    blade = [p for p in parts if p["role"] in ("body", "edge")]
    if not blade: return parts
    linger, hold = int(o.get("linger", LINGER)), int(o.get("hold", HOLD))
    end = max(p["t1"] for p in blade)
    start = min(p["t0"] for p in blade)
    area = {t: revealed_area(parts, t) for t in range(start, end + 1)}
    full = max(area, key=lambda t: area[t])
    if o.get("hero"):          # the impact accent over a scythe trail: from the complete stroke on (the trail builds up)
        parts = [p for p in parts if p["t1"] >= full]
        start = full
    out = []
    for p in parts:
        q = dict(p)
        if p["t1"] >= end - 1:                                   # the finished stroke: hold, then fade out
            t1 = p["t1"] + linger
            fk = [list(k) for k in (p["fade"] or [[p["t0"], 1.0]])]
            a_end = _lerp_keys(fk, p["t1"], 1.0)
            fk = [k for k in fk if k[0] <= p["t1"]] + [[p["t1"] + hold, a_end], [t1, 0.0]]
            # the stroke stays whole while it fades: its U scroll holds (carrying the scroll on split the ribbon's bands
            # into separate slivers, the look of Test 6's "split copies as they fade")
            uk = [list(k) for k in (p["uscroll"] or [[p["t0"], 0.0]])] + [[t1, _lerp_keys(p["uscroll"], p["t1"], 0.0)]]
            q.update(t1=t1, fade=fk, uscroll=uk)
        if p.get("_core"):                                       # one glow envelope for the whole stroke
            T1 = q["t1"]
            env = [[start, 0.35], [max(start + 1, full), 1.0], [full + hold + 1, 1.0], [end + linger - 2, 0.0]]
            q["fade"] = [[t, _lerp_keys(env, t, 0.0)] for t in sorted({p["t0"], T1} | {int(k[0]) for k in env if p["t0"] <= k[0] <= T1})]
        out.append(q)
    log("  fxcompile: %s: stroke full at tick %d, held %d, gone by %d (was %d)" % (fxname, full, hold, end + linger, end))
    return out


_FR = None
def _frames():
    global _FR
    if _FR is None:
        import ruby_blade as RB
        _FR = RB.Frames()
    return _FR


def build(out, plan, tdeps, log=print):
    """plan: {effect name (Role/Rrb/<name>): {"state": BBTAG state, "stop": tick or None, "core": bool, "refract": bool,
    "floor": bool (lower the blade to the floor), "speed": playback speed (1 = BBTAG's)}}
    tdeps: the template's manifest dependencies (from the kit import). -> manifest additions."""
    import UnityPy, bbmod, bbchar
    import bbtag_fxcompile as FC
    adds = {"names": [], "entries": [], "guids": []}
    tpath = os.path.join(out, *(TEMPLATE + ".ab").split("/"))
    raw = open(tpath, "rb").read()
    tenv = UnityPy.load(raw); tenv.typetree_generator = bbmod.typetree_gen()
    tcab = list(tenv.file.files.keys())[0]; tsf = tenv.file.files[tcab]
    ext = [e.path for e in tsf.externals]
    # the template's slot i uses placeholder material i % 10 (fxkit_cross RubyVFX.ArcSlot): read their PPtrs
    gos = {o.path_id: o.read_typetree()["m_Name"] for o in tenv.objects if o.type.name == "GameObject"}
    slot_rend = {}
    for o in tenv.objects:
        if o.type.name == "ParticleSystemRenderer":
            t = o.read_typetree(); slot_rend[gos[t["m_GameObject"]["m_PathID"]]] = t
    mat_ptr = [dict(slot_rend["s%02d" % i]["m_Materials"][0]) for i in range(10)]
    mesh_ptr = dict(slot_rend["s00"]["m_Mesh"])
    tex_done, mat_done = {}, {}
    slash_tpl = os.path.exists(os.path.join(out, *(SLASH_TEMPLATE + ".ab").split("/")))
    for fxname, o in plan.items():
        if o.get("slash") or o.get("wave2"): continue       # (on the kit's templates: build_slashes, build_waves2)
        if o.get("wave"):                                 # a stage slash thrown off a swing (ruby_blade.wave_parts)
            import ruby_blade as RB
            arc = FC.compile_state(o["wave"]["state"])["parts"] if o["wave"].get("state") else None
            parts = [p for p in RB.wave_from_plan(_frames(), o["wave"], arc) if p["role"] in ROLE]
            if not parts:
                log("  fxcompile: %s: no wave (the swing gives no readable stroke); left out" % fxname); continue
            if slash_tpl and wave_on_template(o["wave"]) and all(p.get("smooth") for p in parts):
                continue                                    # (drawn on the kit's rrb_slash: build_slashes)
        elif o.get("trail"):                                # a scythe trail swept by her blade (tools/bbtag/ruby_blade.py)
            import ruby_blade as RB
            parts = [p for p in RB.parts_from_plan(_frames(), o["trail"]) if p["role"] in ROLE]
        else:
            res = FC.compile_state(o["state"], stop=o.get("stop"))
            parts = [p for p in res["parts"] if p["role"] in ROLE]
        if not o.get("wave"): parts = drop_oversized(fxname, parts, log)
        if o.get("floor"):
            parts = to_floor(fxname, parts, log)
        extra = []
        smooth = any(p.get("smooth") for p in parts)      # a smooth trail carries its own core, scroll and fade
        if o.get("core") and not o.get("wave") and not smooth:
            for p in parts:
                if p["role"] == "body":
                    q = dict(p); q["role"] = "core"; q["blend"] = "add"; q["_core"] = True
                    q["alpha"] = rim_alpha(p)
                    extra.append(q)
        parts = parts + extra
        if not o.get("wave") and not smooth: parts = animate(fxname, parts, o, log)   # (a wave carries its own flight, fade and wake)
        if len(parts) > SLOTS:
            log("  fxcompile: %s has %d parts, keeping the first %d" % (fxname, len(parts), SLOTS))
            parts = parts[:SLOTS]
        name = fxname.rsplit("/", 1)[-1].lower()
        dst = "effect/prefab/role/rrb/" + name
        mesh_dst = "effect/common/fbx/rrb/" + name
        # textures / materials the parts need (BBTAG ribbons); core parts use the kit's m8
        families = {"alpha": [], "add": []}
        pmat = []
        for p in parts:
            fam = "add" if (ROLE[p["role"]]["add"] or p["blend"] == "add") else "alpha"
            key = (p["texture"], fam)
            if key not in families[fam]:
                families[fam].append(key)
            pmat.append((fam, key))
        for fam, lim in (("alpha", N_ALPHA), ("add", N_ADD)):
            if len(families[fam]) > lim:
                raise SystemExit("fxcompile: %s uses %d %s textures (template has %d)" % (fxname, len(families[fam]), fam, lim))
        remap, subst = {}, {}
        for fam, base in (("alpha", 0), ("add", N_ALPHA)):
            for k, key in enumerate(families[fam]):
                texname = key[0]
                slug = re.sub(r"[^a-z0-9]", "_", (texname or "none").lower().replace(".dds", ""))
                tdst = "effect/common/texture/rrb/arc/" + slug
                mdst = "effect/common/material/rrb/arc/%s_%s" % (slug, fam)
                if tdst not in tex_done:
                    a = bbchar.clone_bundle(ADD_TEX if fam == "add" else BODY_TEX, tdst, out, image=_texture_png(texname))
                    for kk in adds: adds[kk] += a[kk]
                    tex_done[tdst] = True
                if mdst not in mat_done:
                    a = bbchar.clone_bundle(ADD_MAT if fam == "add" else BODY_MAT, mdst, out,
                                            material_props={"colors": {"_TintColor": list(ADD_TINT if fam == "add" else ALPHA_TINT)}, "floats": {"_ZTest": 8.0}},   # (the lead: never cut by a ledge)
                                            remap_deps={(ADD_TEX if fam == "add" else BODY_TEX): tdst})
                    for kk in adds: adds[kk] += a[kk]
                    mat_done[mdst] = True
                ph = base + k                                       # placeholder material index
                old = ext[mat_ptr[ph]["m_FileID"] - 1].split("/")[-1]
                remap[old.lower()] = _cab(mdst)
                subst[ph] = mdst
        pids = write_meshes(out, mesh_dst, parts, log)
        remap[ext[mesh_ptr["m_FileID"] - 1].split("/")[-1].lower()] = _cab(mesh_dst)
        # the prefab
        env = UnityPy.load(raw); env.typetree_generator = bbmod.typetree_gen()
        sf = env.file.files[tcab]; env.file.files = {_cab(dst): sf}
        for e in sf.externals:
            cab = e.path.split("/")[-1].lower()
            e.path = re.sub(re.escape(tcab), _cab(dst), e.path, flags=re.I)
            if cab in remap:
                e.path = re.sub(re.escape(cab), remap[cab], e.path, flags=re.I)
        gos = {x.path_id: x.read_typetree()["m_Name"] for x in env.objects if x.type.name == "GameObject"}
        slot_of = {}
        for i in range(len(parts)):
            slot_of["s%02d" % i] = i
        dur = 0.0
        for x in env.objects:
            tn = x.type.name
            if tn not in ("ParticleSystem", "ParticleSystemRenderer", "Transform", "GameObject", "AssetBundle", "MonoBehaviour"):
                continue
            t = x.read_typetree()
            if tn == "AssetBundle":
                t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
                t["m_Container"] = [[k.replace("rrb_arc.prefab", name + ".prefab"), v] for k, v in t["m_Container"]]
            elif tn == "GameObject":
                if t["m_Name"] != "rrb_arc": continue
                t["m_Name"] = name
            elif tn == "MonoBehaviour":
                if "m_duration" not in t: continue
                t["_hub"] = True
            else:
                go = gos.get(t["m_GameObject"]["m_PathID"])
                if go not in slot_of and go and go.startswith("s") and tn == "ParticleSystem":
                    t["EmissionModule"]["m_Bursts"][0]["countCurve"]["scalar"] = 0.0
                    t["EmissionModule"]["m_Bursts"][0]["countCurve"]["minScalar"] = 0.0
                    x.save_typetree(t); continue
                if go not in slot_of:
                    continue
                i = slot_of[go]; p = parts[i]; fam, key = pmat[i]
                sp = float(o.get("speed", 1.0))    # a move played faster than its BBTAG clip plays its arcs as fast
                t0, t1 = p["t0"] / 60.0 / sp, (p["t1"] + 1) / 60.0 / sp
                life = max(1 / 60.0, t1 - t0)
                if tn == "Transform":
                    t["m_LocalPosition"] = {"x": float(p["origin"][0]), "y": float(p["origin"][1]), "z": 0.0}
                elif tn == "ParticleSystemRenderer":
                    ph = (0 if fam == "alpha" else N_ALPHA) + families[fam].index(key)
                    t["m_Materials"] = [dict(mat_ptr[ph])]
                    t["m_Mesh"] = {"m_FileID": mesh_ptr["m_FileID"], "m_PathID": pids[i]}
                    t["m_SortingFudge"] = float(ROLE[p["role"]]["fudge"] + i * 0.001)
                else:   # ParticleSystem
                    im = t["InitialModule"]
                    t["startDelay"]["scalar"] = t["startDelay"]["minScalar"] = float(t0)
                    im["startLifetime"]["scalar"] = im["startLifetime"]["minScalar"] = float(life)
                    c = ROLE[p["role"]]["color"]
                    tint = p.get("tint") or [1, 1, 1]
                    col = [c[0], c[1], c[2], c[3]] if p["role"] in ("body", "edge", "glow", "core") else [tint[0], tint[1], tint[2], 1.0]
                    im["startColor"]["minMaxState"] = 0
                    for k2 in ("maxColor", "minColor"):
                        im["startColor"][k2] = {"r": float(col[0]), "g": float(col[1]), "b": float(col[2]), "a": float(col[3])}
                    t["lengthInSec"] = float(max(0.05, t1 + 0.02))
                    # U scroll: texture u = u - offset (BBTAG) -> Custom1.x = -offset; the core sweeps a highlight along
                    cd = t["CustomDataModule"]
                    span = max(1, p["t1"] - p["t0"] + 1)
                    keys = [((tk - p["t0"]) / span, -off) for tk, off in (p["uscroll"] or [[p["t0"], 0.0]])]
                    if len(keys) == 1: keys = [(0.0, keys[0][1]), (1.0, keys[0][1])]
                    v0 = cd["vector0_0"]
                    v0["minMaxState"] = 1; v0["scalar"] = 1.0
                    v0["maxCurve"] = _curve(keys); v0["minCurve"] = _curve(keys)
                    # fade: BBTAG's object alpha per tick (the part's own alpha rides in the vertex colour)
                    fade = [((tk - p["t0"]) / span, a) for tk, a in (p["fade"] or [[p["t0"], 1.0]])]
                    if len(fade) == 1: fade = [(0.0, fade[0][1]), (1.0, fade[0][1])]
                    fade = _thin(fade, 8)
                    g = t["ColorModule"]["gradient"]["maxGradient"]
                    for k3 in range(8):
                        tt, aa = fade[min(k3, len(fade) - 1)]
                        g["key%d" % k3] = {"r": 1.0, "g": 1.0, "b": 1.0, "a": float(aa)}
                        g["atime%d" % k3] = int(round(min(1.0, tt) * 65535)); g["ctime%d" % k3] = int(round(min(1.0, tt) * 65535))
                    g["m_NumAlphaKeys"] = min(8, len(fade)); g["m_NumColorKeys"] = 2
                    # scale keys [[tick, sx, sy]] about the part's origin (the particle sits there): size over lifetime,
                    # per axis (a stage wave gliding outward from the swing's pivot: ruby_blade.wave_parts)
                    if p.get("scale"):
                        sm = t["SizeModule"]; sm["enabled"] = True; sm["separateAxes"] = True
                        for axis, col_ in (("curve", 1), ("y", 2)):
                            ks = [(min(1.0, max(0.0, (k_[0] - p["t0"]) / span)), float(k_[col_])) for k_ in p["scale"]]
                            if ks[0][0] > 0: ks = [(0.0, ks[0][1])] + ks
                            if ks[-1][0] < 1: ks = ks + [(1.0, ks[-1][1])]
                            top = max(v for _, v in ks) or 1.0
                            sm[axis]["minMaxState"] = 1; sm[axis]["scalar"] = float(top); sm[axis]["minScalar"] = float(top)
                            sm[axis]["maxCurve"] = _curve([(a_, v / top) for a_, v in ks]); sm[axis]["minCurve"] = _curve([(a_, v / top) for a_, v in ks])
                        sm["z"]["minMaxState"] = 0; sm["z"]["scalar"] = 1.0; sm["z"]["minScalar"] = 1.0
                    g["key1"]["r"] = g["key1"]["g"] = g["key1"]["b"] = 1.0
                    g["ctime0"] = 0; g["ctime1"] = 65535
                    dur = max(dur, t1)
            x.save_typetree(t) if not t.pop("_hub", False) else None
        for x in env.objects:                                     # the hub: duration covers every part
            if x.type.name == "MonoBehaviour":
                t = x.read_typetree()
                if "m_duration" in t:
                    t["m_duration"] = float(dur + 0.05); t["m_maxParticleLifetime"] = float(dur)
                    # her smears run on HER clock (the effects study, 2026-10-02: hubs with m_alwaysUpdate 0 take the
                    # actor's action time scale, so they hold through hit-stop and speed up with attack speed as her
                    # sprite does; the kit template has 1, which let a trail run ahead of a frozen or sped-up swing)
                    t["m_alwaysUpdate"] = 0
                    x.save_typetree(t)
        p = os.path.join(out, *(dst + ".ab").split("/"))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(env.file.save(packer="lz4"))
        deps = []
        for d in (tdeps or []):
            m = re.search(r"__rrbarc(\d)$", d)
            if m and int(m.group(1)) in subst: d = subst[int(m.group(1))]
            if d == "effect/common/fbx/plane_001": d = mesh_dst
            if d not in deps: deps.append(d)
        if mesh_dst not in deps: deps.append(mesh_dst)
        for d in subst.values():
            if d not in deps: deps.append(d)
        adds["names"] += [mesh_dst, dst]; adds["entries"] += [(mesh_dst, []), (dst, deps)]
        log("  arc %s: %d parts (%d body, %d core), %s textures" % (name, len(parts), sum(1 for q in parts if q["role"] == "body"),
                                                                    sum(1 for q in parts if q.get("_core")), sum(len(v) for v in families.values())))
    return adds


# ---------------------------------------------------------------- her slashes on the kit's rrb_slash template (0.6.13)
# The lead, 2026-10-02: the saw and the gun, rebuilt from BBEE's own effect parts, are "perfect"; "all the slashes need a
# rework". fxkit_cross RubyVFX builds rrb_slash:
#   - a hub with m_alwaysUpdate 0;
#   - body and core: mesh particles on an external placeholder mesh, with stock Common streak materials (a wipe on
#     Custom1.x, a glint on Custom1.z, dissolve on Custom2.x);
#   - glow, smoke and petals.
# Each run of each swing gets a copy: her blade's crescent as the mesh (ruby_blade.swing_crescent), the wipe keyed to her
# poses, the layers placed on the arc. Contract: the kit agent's report of 2026-10-02 (local_only\agents\vfxkit\).
SLASH_TEMPLATE = "effect/prefab/role/rrb/rrb_slash"
SLASH_MESH_PH = "gameplay/map/element/fbx/plane_001"     # body / core only (glow and smoke keep effect/common/fbx/plane_001)
# the texture head's mesh U is H - Custom1.x (the materials' own ST). Look C (the kit, 2026-10-02): her BBTAG stroke on
# the body (head at u 0.94 of the texture, tiled 1.2: 0.783); the dark rim, the same stroke a hair out (Custom1.y
# fixed in the template), 0.798; the hot edge 0.83
SLASH_H = {"body": 0.783, "core": 0.83, "rim": 0.798}
SLASH_MAT = "effect/common/material/rrb/streak_701a_a__rrbslash"     # the body's material (a clone of stock streak_701a_a)
SLASH_MAT_FROM, SLASH_TEX_FROM = "effect/common/material/15_streak/streak_701a_a", "effect/common/texture/15_streak/streak_701c_4c"
SLASH_TEX = "effect/common/texture/rrb/slash_zangeki01"              # her stroke, from the player's BBTAG install
SLASH_STROKE = "rrbef_zangeki01.DDS#trail"
SLASH_REST = {"quick": 0.10, "sweep": 0.15, "heavy": 0.22, "spin": 0.15, "air": 0.13, "thrust": 0.10, "wave": 0.3, "ring": 0.18}   # s after the draw
SLASH_DRIFT = {"quick": 0.15, "sweep": 0.25, "heavy": 0.35, "spin": 0.25, "air": 0.2, "thrust": 0.15, "wave": 0.08, "ring": 0.08}   # U the head runs on
# (ring: Buzzsaw's turn, five a second over her saw's own glow: the stroke and a few petals only)
SLASH_LAYERS = {"quick": (False, False, 3), "sweep": (True, False, 5), "heavy": (True, True, 8), "spin": (True, False, 4),
                "air": (True, False, 4), "thrust": (False, False, 2), "wave": (True, True, 6), "ring": (False, False, 3)}    # kind: (glow, smoke, petals)


def _set_curve(mm, keys, scalar=1.0):
    mm["minMaxState"] = 1; mm["scalar"] = float(scalar); mm["minScalar"] = float(scalar)
    mm["maxCurve"] = _curve(keys); mm["minCurve"] = _curve(keys)


def _slash_template(out):
    """(raw bundle, template CAB, the body / core placeholder mesh's CAB) or None when the kit pack has no rrb_slash"""
    import UnityPy, bbmod
    tpath = os.path.join(out, *(SLASH_TEMPLATE + ".ab").split("/"))
    if not os.path.exists(tpath): return None
    raw = open(tpath, "rb").read()
    tenv = UnityPy.load(raw); tenv.typetree_generator = bbmod.typetree_gen()
    tcab = list(tenv.file.files.keys())[0]
    # the body / core placeholder mesh: whatever external the body renderer points at (a stock bundle's CAB is not the
    # md5 of its name, so it is found by reference, not by name)
    tgos = {o.path_id: o.read_typetree()["m_Name"] for o in tenv.objects if o.type.name == "GameObject"}
    body_fid = next(o.read_typetree()["m_Mesh"]["m_FileID"] for o in tenv.objects if o.type.name == "ParticleSystemRenderer"
                    and tgos.get(o.read_typetree()["m_GameObject"]["m_PathID"]) == "body")
    return raw, tcab, tenv.file.files[tcab].externals[body_fid - 1].path.split("/")[-1].lower()


def _fill_slash(out, tpl, fxname, mesh, t_beg, draw, kind, centroid, head, extent, sdeps, scale=None, rest=None, log=print,
                wipe=None, drift=None):
    """One copy of rrb_slash: `mesh` {verts, uv (U 0 tail -> 1 head, V 0 inner -> 1 outer), tris} on body / core, its
    wipe drawn over `draw` s from `t_beg` (s from the spawn), then the kind's rest; glow / smoke / petals placed on the
    arc. scale: [(s, sx, sy)] size keys (a thrown crescent flying out), applied to body / core. -> manifest additions"""
    import UnityPy, bbmod
    raw, tcab, ph_cab = tpl
    adds = {"names": [], "entries": [], "guids": []}
    name = fxname.rsplit("/", 1)[-1].lower()
    dst = "effect/prefab/role/rrb/" + name; mesh_dst = "effect/common/fbx/rrb/" + name
    part = dict(verts=mesh["verts"], uv=mesh["uv"], tris=mesh["tris"], alpha=[1.0] * len(mesh["verts"]), nocolor=True)
    pids = write_meshes(out, mesh_dst, [part], log)
    rest = SLASH_REST.get(kind, 0.15) if rest is None else rest
    drift = SLASH_DRIFT.get(kind, 0.25) if drift is None else drift
    life = {"body": draw + rest, "core": draw + rest + 0.06, "rim": draw + rest}
    glow_on, smoke_on, n_petals = SLASH_LAYERS.get(kind, (True, False, 5))
    cx, cy = centroid; hx, hy = head; t_end = t_beg + draw
    env = UnityPy.load(raw); env.typetree_generator = bbmod.typetree_gen()
    sf = env.file.files[tcab]; env.file.files = {_cab(dst): sf}
    ph_fid = None
    for i_, e in enumerate(sf.externals):
        cab = e.path.split("/")[-1].lower()
        e.path = re.sub(re.escape(tcab), _cab(dst), e.path, flags=re.I)
        if cab == ph_cab:
            e.path = re.sub(re.escape(cab), _cab(mesh_dst), e.path, flags=re.I); ph_fid = i_ + 1
    if ph_fid is None:
        raise SystemExit("fxcompile: %s: no body / core placeholder mesh external" % SLASH_TEMPLATE)
    gos = {x.path_id: x.read_typetree()["m_Name"] for x in env.objects if x.type.name == "GameObject"}
    dur = 0.0
    for x in env.objects:
        tn = x.type.name
        if tn not in ("ParticleSystem", "ParticleSystemRenderer", "Transform", "GameObject", "AssetBundle"): continue
        t = x.read_typetree()
        if tn == "AssetBundle":
            t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
            t["m_Container"] = [[k.replace("rrb_slash.prefab", name + ".prefab"), v] for k, v in t["m_Container"]]
            x.save_typetree(t); continue
        if tn == "GameObject":
            if t["m_Name"] == "rrb_slash":
                t["m_Name"] = name; x.save_typetree(t)
            continue
        go = gos.get(t["m_GameObject"]["m_PathID"])
        if tn == "Transform":
            if go in ("glow", "smoke"): t["m_LocalPosition"] = {"x": float(cx), "y": float(cy), "z": 0.0}
            elif go == "petals": t["m_LocalPosition"] = {"x": float(hx), "y": float(hy), "z": 0.0}
            else: continue
            x.save_typetree(t); continue
        if tn == "ParticleSystemRenderer":
            if go in ("body", "core", "rim"):
                t["m_Mesh"] = {"m_FileID": ph_fid, "m_PathID": pids[0]}; x.save_typetree(t)
            continue
        im = t["InitialModule"]; burst = t["EmissionModule"]["m_Bursts"]
        def set_life(delay, lf):
            t["startDelay"]["scalar"] = t["startDelay"]["minScalar"] = float(delay)
            im["startLifetime"]["scalar"] = im["startLifetime"]["minScalar"] = float(lf)
            t["lengthInSec"] = float(max(0.05, lf + 0.02))
        if go in ("mist", "petals_arc"):                    # shed off the arc: they emit from its mesh (the shape module)
            sh = t.get("ShapeModule")
            if sh is not None and "m_Mesh" in sh: sh["m_Mesh"] = {"m_FileID": ph_fid, "m_PathID": pids[0]}
            dl = t_beg + (0.6 if go == "mist" else 0.5) * draw
            t["startDelay"]["scalar"] = t["startDelay"]["minScalar"] = float(dl)
            if kind in ("quick", "thrust") and go == "mist" and burst:
                burst[0]["countCurve"]["scalar"] = burst[0]["countCurve"]["minScalar"] = 2.0
            lmax = float(im["startLifetime"]["scalar"]); dur = max(dur, dl + lmax)
            x.save_typetree(t); continue
        if go in ("body", "core", "rim"):
            H = SLASH_H[go]; lf = life[go]
            set_life(t_beg, lf)
            if wipe:      # look D: the head follows her blade (ruby_arcband: w 0 -> 1 draws, 1 -> 2 erases), ticks from the start
                cv = lambda w: (H + 0.02 - 1.02 * w) if w <= 1.0 else (H - 1.0 - drift * (w - 1.0))
                k1 = [(min(0.999, max(0.0, tk / 60.0 / lf)), cv(w)) for tk, w in wipe if tk / 60.0 < lf] + [(1.0, H - 1.0 - drift)]
                k1 = [k_ for i_, k_ in enumerate(k1) if i_ == 0 or k_[0] > k1[i_ - 1][0]]
            else:
                k1 = [(0.0, H + 0.02), (draw / lf, H - 1.0), (min(0.999, (draw + 0.4 * rest) / lf), H - 1.0 - 0.65 * drift), (1.0, H - 1.0 - drift)]
            cd = t["CustomDataModule"]
            _set_curve(cd["vector0_0"], k1)
            if go in ("body", "rim"):
                k2 = [(0.0, 0.0), (min(0.99, (draw + 0.1 * rest) / lf), 0.0), (min(0.995, (draw + 0.65 * rest) / lf), 0.21), (1.0, 1.0)]
            else:
                rc = lf - draw
                k2 = [(0.0, 0.0), (min(0.99, (draw + 0.05) / lf), 0.0), (min(0.995, (draw + 0.6 * rc) / lf), 0.33), (1.0, 1.0)]
            _set_curve(cd["vector1_0"], k2)
            if scale:                                            # a thrown crescent: grows to its full flight size
                sm = t["SizeModule"]; sm["enabled"] = True; sm["separateAxes"] = True
                for axis, col_ in (("curve", 1), ("y", 2)):
                    ks = [(min(1.0, max(0.0, (s_ - t_beg) / lf)), float(k_[col_])) for k_ in scale for s_ in (k_[0],)]
                    if ks[0][0] > 0: ks = [(0.0, ks[0][1])] + ks
                    if ks[-1][0] < 1: ks = ks + [(1.0, ks[-1][1])]
                    top = max(v for _, v in ks) or 1.0
                    sm[axis]["minMaxState"] = 1; sm[axis]["scalar"] = float(top); sm[axis]["minScalar"] = float(top)
                    sm[axis]["maxCurve"] = _curve([(a_, v / top) for a_, v in ks]); sm[axis]["minCurve"] = _curve([(a_, v / top) for a_, v in ks])
                sm["z"]["minMaxState"] = 0; sm["z"]["scalar"] = 1.0; sm["z"]["minScalar"] = 1.0
            dur = max(dur, t_beg + lf)
        elif go == "glow":
            if not glow_on and burst: burst[0]["countCurve"]["scalar"] = burst[0]["countCurve"]["minScalar"] = 0.0
            size = min(5.5, max(1.5, 1.5 * max(extent)))
            im["startSize"]["scalar"] = im["startSize"]["minScalar"] = float(size)
            set_life(t_beg + 0.6 * draw, float(im["startLifetime"]["scalar"]))
            dur = max(dur, t_beg + 0.6 * draw + float(im["startLifetime"]["scalar"]))
        elif go == "smoke":
            if not smoke_on and burst: burst[0]["countCurve"]["scalar"] = burst[0]["countCurve"]["minScalar"] = 0.0
            t["startDelay"]["scalar"] = t["startDelay"]["minScalar"] = float(t_end + 0.03)
            dur = max(dur, t_end + 0.03 + float(im["startLifetime"]["scalar"]))
        elif go == "petals":
            if burst: burst[0]["countCurve"]["scalar"] = burst[0]["countCurve"]["minScalar"] = float(n_petals)
            t["startDelay"]["scalar"] = t["startDelay"]["minScalar"] = float(t_beg + 0.8 * draw)
            dur = max(dur, t_beg + 0.8 * draw + float(im["startLifetime"]["scalar"]))
        x.save_typetree(t)
    for x in env.objects:                                     # the hub: duration covers every layer
        if x.type.name == "MonoBehaviour":
            try: t = x.read_typetree()
            except Exception: continue
            if "m_duration" in t:
                t["m_duration"] = float(dur + 0.05); t["m_maxParticleLifetime"] = float(max(max(life.values()), 0.5))
                x.save_typetree(t)
    p = os.path.join(out, *(dst + ".ab").split("/"))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(env.file.save(packer="lz4"))
    deps = [mesh_dst if d == SLASH_MESH_PH else d for d in (sdeps or [])]
    if mesh_dst not in deps: deps.append(mesh_dst)
    adds["names"] += [mesh_dst, dst]; adds["entries"] += [(mesh_dst, []), (dst, deps)]
    return adds


def _wave_mesh(parts):
    """a smooth stage wave's body part (ruby_blade._wave_smooth) as an rrb_slash mesh: U 0..1 along the stroke (its UV was
    laid on the trail clones' 0..0.94), V 0 inner -> 1 outer as it is"""
    p = next(q for q in parts if q["role"] == "body")
    uv = [[min(1.0, max(0.0, u / 0.94)), v] for u, v in p["uv"]]
    V = np.asarray(p["verts"], float) + np.asarray(p["origin"], float)
    return p, dict(verts=[[float(a), float(b)] for a, b in V], uv=uv, tris=p["tris"])


def slash_texture(out, adds_all, log=print):
    """Look C's body texture: her BBTAG stroke (SLASH_STROKE) in a clone of the stock texture the kit's material uses,
    clamped; then the kit's material clone SLASH_MAT is made again (same colours) pointing at it. adds_all: the import's
    manifest additions so far (the material's entry is switched in place). -> manifest additions for the texture"""
    import UnityPy, bbmod, bbchar, json as _json
    cl = os.path.join(HERE, "fx", "clones.json")
    props = next((c.get("props") for c in _json.load(open(cl, encoding="utf-8")) if c["to"] == SLASH_MAT), None)
    if props is None:
        log("  fxcompile: %s is not a kit clone: the slashes keep the stock stroke" % SLASH_MAT); return {"names": [], "entries": [], "guids": []}
    a = bbchar.clone_bundle(SLASH_TEX_FROM, SLASH_TEX, out, image=_texture_png(SLASH_STROKE))
    p = os.path.join(out, *(SLASH_TEX + ".ab").split("/"))
    env = UnityPy.load(open(p, "rb").read()); env.typetree_generator = bbmod.typetree_gen()
    for o in env.objects:
        if o.type.name == "Texture2D":
            t = o.read_typetree(); ts = t["m_TextureSettings"]
            for k in ("m_WrapMode", "m_WrapU", "m_WrapV", "m_WrapW"):
                if k in ts: ts[k] = 1                          # clamp
            o.save_typetree(t)
    open(p, "wb").write(env.file.save(packer="lz4"))
    m = bbchar.clone_bundle(SLASH_MAT_FROM, SLASH_MAT, out, material_props=props, remap_deps={SLASH_TEX_FROM: SLASH_TEX})
    new_deps = dict(m["entries"])[SLASH_MAT]
    adds_all["entries"] = [(n, new_deps if n == SLASH_MAT else d) for n, d in adds_all["entries"]]
    log("  slashes: her stroke %s on %s" % (SLASH_STROKE, SLASH_MAT))
    return a


def build_slashes(out, plan, sdeps, log=print):
    """plan entries {"slash": {"frames", "kind", "lead", "until", "max_turn", "run", "speed"}} (a swing's crescent) and
    smooth stage waves {"wave": ...} (the thrown crescents; the lead, 2026-10-02: "all stages will get the new vfx") ->
    manifest additions. Waves that fly apart in steps (spins, Guillotine's finish) stay on build()'s ribbons."""
    import ruby_blade as RB
    adds = {"names": [], "entries": [], "guids": []}
    tpl = _slash_template(out)
    todo = {k: v for k, v in plan.items() if v.get("slash") or v.get("wave")}
    if not todo: return adds
    if tpl is None:
        log("  fxcompile: %s is not in the build: slashes left out" % SLASH_TEMPLATE); return adds
    made = waves = 0
    for fxname, o in todo.items():
        if o.get("slash") and o["slash"].get("band"):     # look D (rrb_fx.look_d): spawned at its t_beg, drawn by its wipe
            b = o["slash"]["band"]
            a = _fill_slash(out, tpl, fxname, b, 0.0, max(1 / 60.0, (b["t_end"] - b["t_beg"]) / 60.0), o["slash"].get("kind", "sweep"),
                            b["centroid"], b["head"], b["extent"], sdeps, rest=max(0.05, (b["t_out"] - b["t_end"]) / 60.0), log=log,
                            wipe=b["wipe"], drift=b["drift"])
            made += 1
        elif o.get("slash"):
            s = o["slash"]
            sw = []
            for t, sp in s["frames"]:
                b = RB.blade(_frames(), sp)
                if b is not None: sw.append((t, b[0]))
            sw = RB.oriented(sw)
            cres = RB.swing_crescent(sw, s.get("kind", "sweep"), s.get("max_turn"), s.get("lead", 0.0), s.get("until")) if len(sw) >= 2 else []
            if s.get("run", 0) >= len(cres):
                log("  fxcompile: %s: run %d not drawn (%d runs)" % (fxname, s.get("run", 0), len(cres))); continue
            c = cres[s.get("run", 0)]; sp_ = float(s.get("speed", 1.0))
            t_beg, t_end = c["t_beg"] / 60.0 / sp_, c["t_end"] / 60.0 / sp_
            a = _fill_slash(out, tpl, fxname, c, t_beg, max(1 / 60.0, t_end - t_beg), s.get("kind", "sweep"),
                            c["centroid"], c["head"], c["extent"], sdeps, log=log)
            made += 1
        else:
            w = dict(o["wave"])
            if not wave_on_template(w): continue
            import bbtag_fxcompile as FC
            arc = FC.compile_state(w["state"])["parts"] if w.get("state") else None
            parts = [p for p in RB.wave_from_plan(_frames(), w, arc) if p["role"] in ROLE]
            if not parts or not all(p.get("smooth") for p in parts): continue
            p, mesh = _wave_mesh(parts)
            V = np.asarray(mesh["verts"], float)
            T = int(w.get("ticks", 8)) / 60.0
            scale = [(k_[0] / 60.0, k_[1], k_[2]) for k_ in p["scale"]]
            # (the lead, 2026-10-02: stage 3 "way full screen and bigger like it was in previous tests") the whole crescent
            # shows quickly and stays through its flight: a short draw, little drift, the dissolve after the flight
            # a travelling one (stage 3's slash projectile: its bullet flies it) fades out over its flight
            rest = (T * 0.85) if w.get("travel") else (T + 0.22)
            draw = max(0.04, 0.22 * T) if not w.get("travel") else 0.05
            if w.get("rest") is not None: rest = float(w["rest"])          # (a made stroke with its own timing: Buzzsaw's ring)
            if w.get("draw") is not None: draw = float(w["draw"])
            a = _fill_slash(out, tpl, fxname, mesh, p["t0"] / 60.0, draw, w.get("kind", "wave"),
                            [float(x) for x in V.mean(0)], [float(x) for x in V[-1]], [float(x) for x in V.max(0) - V.min(0)],
                            sdeps, scale=scale or None, rest=rest, log=log)
            waves += 1
        for k in adds: adds[k] += a[k]
    log("  slashes: %d swing crescents and %d thrown crescents on rrb_slash" % (made, waves))
    return adds


# ---- the slash projectile (2026-10-03): the kit's class templates rrb_slashwave2_q / _s / _h (fx_wave) filled per move.
# Their layers sit on placeholder meshes: the crescent (blade, rim, flow, core; petals leave it), the flame mesh (mass),
# the thorn strip (fangs), the emitter strip (puffs, darts, sparks leave it). One mesh bundle per move holds the four
# (tools/bbtag/ruby_crescent.wave_meshes); the template's crescent placeholder is re-pointed at it.
WAVE2_TEMPLATE = "effect/prefab/role/rrb/rrb_slashwave2%s_%s"
# One move's projectile is three effects on the same crescent (the kit's templates rrb_slashwave2 / 2k / 2x; the break,
# 2026-10-03: "the projectiles need to dissaper when they hit a wall and not linger ... a cooler fade out animation"):
#   ""   the body (flame mass, fangs, rim, blade, flow, core, glow, pulse). Its hub stops at once, so it is cut on the
#        frame the bullet's action changes: a wall, or the end of its flight
#   "k"  the wake (puffs, darts, sparks, petals, floor spikes): a soft stop, what was already shed plays out
#   "x"  the break, started by the bullet's end action on that same frame
# Each kind: the layers drawn on a mesh, the layers that emit from one, the layers placed on the crescent's centre.
WAVE2_KINDS = {
    "": dict(render={"blade": "mesh", "rim": "mesh", "flow": "mesh", "core": "mesh", "mass": "flame", "fangs": "fang"}, shape={}, centre=("glow", "pulse")),
    "k": dict(render={}, shape={"puffs": "emit", "darts": "emit", "sparks": "emit", "petals": "mesh"}, centre=()),
    "x": dict(render={"flash": "mesh", "blade": "mesh", "rim": "mesh", "core": "mesh", "echo": "mesh", "mass": "flame", "fangs": "fang"},
              shape={"thorns": "emit", "petals": "mesh"}, centre=("glow", "sparks"))}
WAVE2_ORDER = ("mesh", "flame", "fang", "emit")
# 0.9.0 (a tester, 2026-10-07: "too dense and cluttered"; the break's petals fell for a second after every swing of a
# fast string): per kind and layer (emission x, most particles x, lifetime x). The break is over in about 0.4 s
WAVE2_TUNE = {"k": {"puffs": (0.6, 0.6, 0.85), "darts": (0.65, 0.65, 1.0), "petals": (0.45, 0.45, 0.8), "sparks": (0.6, 0.6, 1.0)},
              "x": {"petals": (0.42, 0.42, 0.40), "sparks": (0.6, 0.6, 0.8), "thorns": (0.7, 0.7, 0.9)}}


def _tune_ps(t, rate, most, life):
    """a particle layer thinned: emission and bursts x rate, its particle cap x most, lifetimes x life"""
    E, I = t["EmissionModule"], t["InitialModule"]
    def mul(c, k):
        for key in ("scalar", "minScalar"):
            if key in c: c[key] = float(c[key]) * k
    mul(E["rateOverTime"], rate)
    for b in E.get("m_Bursts") or []: mul(b["countCurve"], rate)
    I["maxNumParticles"] = max(1, int(round(I["maxNumParticles"] * most)))
    mul(I["startLifetime"], life)


def wave2_names(fxname):
    """the three effects of one move's projectile, by kind"""
    return {"": fxname, "k": fxname + "k", "x": fxname + "x"}


def _wave2_template(out, kind, tag):
    """(raw bundle, template CAB, the crescent placeholder's CAB) of rrb_slashwave2<kind>_<tag>, or None. The placeholder
    is the bundle the kind's first crescent layer takes its mesh from (a renderer's mesh, else an emitter's shape)"""
    import UnityPy, bbmod
    tpath = os.path.join(out, *((WAVE2_TEMPLATE % (kind, tag)) + ".ab").split("/"))
    if not os.path.exists(tpath): return None
    raw = open(tpath, "rb").read()
    tenv = UnityPy.load(raw); tenv.typetree_generator = bbmod.typetree_gen()
    tcab = list(tenv.file.files.keys())[0]
    K = WAVE2_KINDS[kind]
    tgos = {o.path_id: o.read_typetree()["m_Name"] for o in tenv.objects if o.type.name == "GameObject"}
    fid = None
    for o in tenv.objects:
        if o.type.name not in ("ParticleSystemRenderer", "ParticleSystem"): continue
        t = o.read_typetree(); go = tgos.get(t["m_GameObject"]["m_PathID"])
        if o.type.name == "ParticleSystemRenderer" and K["render"].get(go) == "mesh": fid = t["m_Mesh"]["m_FileID"]; break
        if o.type.name == "ParticleSystem" and not K["render"] and K["shape"].get(go) == "mesh": fid = t["ShapeModule"]["m_Mesh"]["m_FileID"]; break
    if not fid:
        raise SystemExit("fxcompile: %s: no layer on the crescent placeholder" % (WAVE2_TEMPLATE % (kind, tag)))
    return raw, tcab, tenv.file.files[tcab].externals[fid - 1].path.split("/")[-1].lower()


def _fill_wave2(out, tpl, kind, tag, fxname, spec, pid, mesh_dst, wdeps, log=print):
    """One copy of rrb_slashwave2<kind>_<tag> on this move's meshes (pid: {mesh key: path id} in the bundle mesh_dst);
    glow, pulse and the break's sparks on the crescent's centre; the floor spikes at its floor point (heavy ground moves)
    or switched off. -> manifest additions"""
    import UnityPy, bbmod
    raw, tcab, ph = tpl
    K = WAVE2_KINDS[kind]
    tname = (WAVE2_TEMPLATE % (kind, tag)).rsplit("/", 1)[-1]
    name = fxname.rsplit("/", 1)[-1].lower()
    dst = "effect/prefab/role/rrb/" + name
    env = UnityPy.load(raw); env.typetree_generator = bbmod.typetree_gen()
    sf = env.file.files[tcab]; env.file.files = {_cab(dst): sf}
    fid = None
    for i_, e in enumerate(sf.externals):
        cab = e.path.split("/")[-1].lower()
        e.path = re.sub(re.escape(tcab), _cab(dst), e.path, flags=re.I)
        if cab == ph:
            e.path = re.sub(re.escape(cab), _cab(mesh_dst), e.path, flags=re.I); fid = i_ + 1
    if fid is None:
        raise SystemExit("fxcompile: %s: no crescent placeholder mesh external" % tname)
    gos = {x.path_id: x.read_typetree()["m_Name"] for x in env.objects if x.type.name == "GameObject"}
    cx, cy = spec["centre"]
    spikes = bool(spec.get("floor")) and spec["cls"] == "heavy"
    done = set()
    for x in env.objects:
        tn = x.type.name
        if tn not in ("ParticleSystem", "ParticleSystemRenderer", "Transform", "GameObject", "AssetBundle"): continue
        t = x.read_typetree()
        if tn == "AssetBundle":
            t["m_Name"] = t["m_AssetBundleName"] = dst + ".ab"
            t["m_Container"] = [[k.replace(tname + ".prefab", name + ".prefab"), v] for k, v in t["m_Container"]]
            x.save_typetree(t); continue
        if tn == "GameObject":
            if t["m_Name"] == tname:
                t["m_Name"] = name; x.save_typetree(t)
            continue
        go = gos.get(t["m_GameObject"]["m_PathID"])
        if tn == "Transform":
            if go in K["centre"]: t["m_LocalPosition"] = {"x": float(cx), "y": float(cy), "z": 0.0}
            elif go == "ground" and spikes: t["m_LocalPosition"] = {"x": float(spec["floor"][0] - 0.2), "y": 0.0, "z": 0.0}
            else: continue
            x.save_typetree(t); continue
        if tn == "ParticleSystemRenderer":
            if go in K["render"]:
                t["m_Mesh"] = {"m_FileID": fid, "m_PathID": pid[K["render"][go]]}; x.save_typetree(t); done.add(go)
            continue
        if go in WAVE2_TUNE.get(kind, {}):
            _tune_ps(t, *WAVE2_TUNE[kind][go]); x.save_typetree(t)
        if go in K["shape"]:
            sh = t.get("ShapeModule")
            if sh is not None and "m_Mesh" in sh:
                sh["m_Mesh"] = {"m_FileID": fid, "m_PathID": pid[K["shape"][go]]}; x.save_typetree(t); done.add("shape:" + go)
        elif go == "ground" and not spikes:
            t["EmissionModule"]["enabled"] = False; x.save_typetree(t)
    miss = [g for g in K["render"] if g not in done] + [g for g in K["shape"] if "shape:" + g not in done]
    if miss:
        raise SystemExit("fxcompile: %s: layers not found in the template: %s" % (tname, miss))
    p = os.path.join(out, *(dst + ".ab").split("/"))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(env.file.save(packer="lz4"))
    deps = [mesh_dst if d == SLASH_MESH_PH else d for d in (wdeps or [])]
    if mesh_dst not in deps: deps.append(mesh_dst)
    return {"names": [dst], "entries": [(dst, deps)], "guids": []}


def wave2_textures(out, adds_all, pack_dir, log=print):
    """the projectile's blade materials (clones of the slash body's stock material in the template pack) made again
    pointing at her own stroke (slash_texture's texture: run after it)"""
    import bbchar, json as _json
    cp = os.path.join(pack_dir, "clones.json")
    if not os.path.exists(cp) or not os.path.exists(os.path.join(out, *(SLASH_TEX + ".ab").split("/"))): return 0
    n = 0
    for c in _json.load(open(cp, encoding="utf-8")):
        if c.get("from") != SLASH_MAT_FROM: continue
        m = bbchar.clone_bundle(SLASH_MAT_FROM, c["to"], out, material_props=c.get("props"), remap_deps={SLASH_TEX_FROM: SLASH_TEX})
        new_deps = dict(m["entries"])[c["to"]]
        adds_all["entries"] = [(nm, new_deps if nm == c["to"] else d) for nm, d in adds_all["entries"]]
        n += 1
    log("  projectiles: her stroke on %d blade materials" % n)
    return n


def build_waves2(out, plan, wdeps, log=print):
    """plan entries {"wave2": ruby_crescent.wave_spec} -> per move one mesh bundle (the crescent, its flame mesh, thorn
    strip and emitter strip) and a filled copy of each of the class's three templates (WAVE2_KINDS). wdeps: {template
    bundle name: its dependencies} from the template pack's import. -> manifest additions"""
    import ruby_crescent as RC
    adds = {"names": [], "entries": [], "guids": []}
    todo = {k: v["wave2"] for k, v in plan.items() if isinstance(v, dict) and v.get("wave2")}
    tpls, n = {}, 0
    for fxname, spec in sorted(todo.items()):
        tag = spec["tag"]
        meshes = RC.wave_meshes(spec)
        mesh_dst = "effect/common/fbx/rrb/" + fxname.rsplit("/", 1)[-1].lower()
        parts = [dict(verts=meshes[k]["verts"], uv=meshes[k]["uv"], tris=meshes[k]["tris"], alpha=[1.0] * len(meshes[k]["verts"]), nocolor=True) for k in WAVE2_ORDER]
        pids = write_meshes(out, mesh_dst, parts, log)
        pid = {k: pids[i] for i, k in enumerate(WAVE2_ORDER)}
        adds["names"].append(mesh_dst); adds["entries"].append((mesh_dst, []))
        for kind, fx in wave2_names(fxname).items():
            if (kind, tag) not in tpls: tpls[(kind, tag)] = _wave2_template(out, kind, tag)
            if tpls[(kind, tag)] is None:
                raise SystemExit("fxcompile: %s is not in the build (the mod's fx_wave pack is missing or older than the break)" % (WAVE2_TEMPLATE % (kind, tag)))
            a = _fill_wave2(out, tpls[(kind, tag)], kind, tag, fx, spec, pid, mesh_dst, wdeps.get(WAVE2_TEMPLATE % (kind, tag)), log)
            for k in adds: adds[k] += a[k]
        n += 1
    log("  projectiles: %d slash projectiles (body, wake and break) on rrb_slashwave2" % n)
    return adds


def wave_on_template(w):
    """the stage waves that rrb_slash draws (one smooth ribbon each): not the stepped flying ends of a spin or Guillotine's
    standing pair, nor the cuts flurry (hit effects)"""
    return w.get("shape") not in ("stand", "cuts") and not w.get("fly")
