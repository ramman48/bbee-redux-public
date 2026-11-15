r"""redux-menus importer: the Entropy menu's swirl as a real-time effect (the lead, 2026-11-11: "i want the swirl in
the middle to be particle vfx instead of a physical drawn shap for the entropy menu"; then, of a first build made of
arms of dots: "I didn't want particles for vfx I mean I wanted particles as in using a particle vfx system for making
real time vfx ... not literal particles", mega rule 7).

bbmod runs it at build time as `import_swirl.py --out <build dir> --adds <json>`. It builds three effects out of the
game's own, from the player's install:

  UI/Common/ReduxEntropySwirlFlow      the swirl: the Entropy schedule's unlock swirl (ChaosScheduleUnlock_Hold: flowing
                                       streak meshes, turbulent smoke, a soft glow, all particle systems on the shared
                                       effect shader) made to loop and slowed to a third of its speed
  UI/Common/ReduxEntropySwirlFlowFast  the same at two thirds of its speed, played over the first from half the limit
  UI/Common/ReduxEntropySwirlBody      the spark layer: rim motes, fast embers at the face's edge, a faint haze

The stock swirl is a 2.3 s one-shot; here its systems loop, its hubs never end, and its two rings, its hexagon flash
and its middle glow emit nothing (the menu's own frame and face stand there). The spark layer is a clone of the Mind
Crystal frame (ConsciousEquip_501_loop) with its three particle systems rewritten; its dots draw with the game's plain
soft dot (glow_011_b). No game file is copied into the mod: each clone is made on the player's PC.

Units: the spark layers' UIParticle scale is 100, so 1 particle unit is 100 canvas units at effect scale 1.
References studied before building (mega rule 6) and the pass log: docs\redux\ui-desk\ENTROPY_SWIRL.md.
"""
import os, sys, json, io, contextlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next((p for p in (os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 8)) if os.path.exists(os.path.join(p, "bbmod.py"))), None)

DONOR = "effect/prefab/ui/common/consciousequip_501_loop"
DONOR_TOKEN = "ConsciousEquip_501_loop"
OLD_MAT = "effect/common/material/08_particles/particles_020_g"
RING_MAT = "effect/common/material/11_ring/ring_001_a"
DOT_MAT = "effect/common/material/02_glow/glow_011_b"
OFF = ["glow1", "bgglow"]

W = (1.0, 1.0, 1.0)


def layer(**k): return k



EFFECTS = {
    "ReduxEntropySwirlBody": {
        "liziu": layer(
            life=(2.6, 4.6), size=(0.035, 0.085), rate=42, maxp=260,
            color=((1, 1, 1, 0.3), (1, 1, 1, 0.8)),
            shape=dict(radius=3.25, thick=0.5, mode=0, speed=0, jitter=0.0),
            orbit=(0.3, 0.7), radial=(-0.16, -0.05),
            fade=[(0.0, 0.0), (0.15, 1.0), (0.45, 0.4), (0.7, 0.9), (1.0, 0.0)], grow=[(0.0, 0.6), (0.5, 1.0), (1.0, 0.4)],
            noise=dict(strength=0.06, freq=0.5, scroll=0.2)),
        "lizid": layer(
            life=(0.8, 1.5), size=(0.035, 0.06), rate=15, maxp=60,
            color=((1, 1, 1, 0.5), (1, 1, 1, 1.0)),
            shape=dict(radius=1.78, thick=0.2, mode=0, speed=0, jitter=0.0),
            orbit=(2.2, 3.4), radial=(-0.3, -0.12),
            fade=[(0.0, 0.0), (0.2, 1.0), (1.0, 0.0)], grow=[(0.0, 1.0), (1.0, 0.5)],
            stretch=dict(length=2.6, velocity=0.07)),
        "circle02": layer(
            life=(3.6, 5.2), size=(0.9, 1.5), rate=4.5, maxp=40,
            color=((1, 1, 1, 0.08), (1, 1, 1, 0.14)),
            shape=dict(radius=2.3, thick=0.5, mode=0, speed=0, jitter=0.0),
            orbit=(0.45, 0.8), radial=(-0.1, -0.04),
            fade=[(0.0, 0.0), (0.3, 1.0), (0.7, 1.0), (1.0, 0.0)], grow=[(0.0, 0.7), (1.0, 1.15)]),
    },
}



HOLD = "effect/prefab/ui/common/chaosscheduleunlock_hold"
HOLD_TOKEN = "ChaosScheduleUnlock_Hold"
MUTE = ["ring01", "ring02", "polygon", "glow01 (1)"]
FLOWS = {


    "ReduxEntropySwirlFlow": {"trail": dict(sim=0.3, rate=0.7, alpha=0.8), "smoke": dict(sim=0.3, rate=1.0, alpha=0.8),
                              "glow01": dict(sim=0.25, rate=1.0, alpha=0.22)},
    "ReduxEntropySwirlFlowFast": {"trail": dict(sim=0.6, rate=0.6, alpha=0.75), "smoke": dict(sim=0.55, rate=1.0, alpha=0.6),
                                  "glow01": dict(sim=0.45, rate=1.0, alpha=0.15)},
}


def apply_flow(t, f):
    """A one-shot layer made to loop: it keeps its own shape, motion and material, and runs slower."""
    t["looping"] = True; t["prewarm"] = True; t["simulationSpeed"] = float(f["sim"])
    em = t["EmissionModule"]; em["rateOverTime"]["scalar"] *= f["rate"]; em["rateOverTime"]["minScalar"] *= f["rate"]
    sc = t["InitialModule"]["startColor"]
    for k in ("minColor", "maxColor"): sc[k]["a"] = max(0.0, min(1.0, sc[k]["a"] * f["alpha"]))


def mute_layer(t):
    em = t["EmissionModule"]; mm(em["rateOverTime"], 0.0); em["m_BurstCount"] = 0; em["m_Bursts"] = []
    t["InitialModule"]["maxNumParticles"] = 0; t["looping"] = False; t["prewarm"] = False



def mm(node, v):
    """A MinMaxCurve: a number, a (low, high) pair, or a list of (time, value) keys over the particle's life."""
    if isinstance(v, list):
        node.update(minMaxState=1, scalar=1.0, minScalar=1.0)
        keys = []
        for i, (t, val) in enumerate(v):
            a, b = v[max(0, i - 1)], v[min(len(v) - 1, i + 1)]
            slope = (b[1] - a[1]) / (b[0] - a[0]) if b[0] > a[0] else 0.0
            keys.append({"time": float(t), "value": float(val), "inSlope": slope, "outSlope": slope, "weightedMode": 0,
                         "inWeight": 1 / 3, "outWeight": 1 / 3})
        node["maxCurve"]["m_Curve"] = keys; node["minCurve"]["m_Curve"] = [dict(k) for k in keys]
    elif isinstance(v, tuple): node.update(minMaxState=3, scalar=float(v[1]), minScalar=float(v[0]))
    else: node.update(minMaxState=0, scalar=float(v), minScalar=float(v))


def grad(node, rgb, alphas):
    """Colour over life: one colour, alpha keys [(time, alpha)]."""
    g = node["maxGradient"]
    for i in range(8):
        a = alphas[i] if i < len(alphas) else None
        g["key%d" % i] = {"r": rgb[0], "g": rgb[1], "b": rgb[2], "a": float(a[1]) if a else 0.0}
        g["ctime%d" % i] = 65535 if i == 1 else 0
        g["atime%d" % i] = int(round(a[0] * 65535)) if a else 65535
    g["m_NumColorKeys"] = 2; g["m_NumAlphaKeys"] = len(alphas); g["m_Mode"] = 0
    node["minMaxState"] = 1


def rgba(c): return {"r": float(c[0]), "g": float(c[1]), "b": float(c[2]), "a": float(c[3])}


def apply_layer(t, L):
    t.update(lengthInSec=5.0, looping=True, prewarm=True, simulationSpeed=1.0, moveWithTransform=0)
    if isinstance(t["startDelay"], dict): mm(t["startDelay"], 0.0)
    else: t["startDelay"] = 0.0
    im = t["InitialModule"]
    mm(im["startLifetime"], L["life"]); mm(im["startSpeed"], 0.0); mm(im["startSize"], L["size"]); mm(im["startRotation"], 0.0)
    mm(im["gravityModifier"], 0.0); im["size3D"] = False; im["rotation3D"] = False; im["maxNumParticles"] = int(L["maxp"])
    im["startColor"].update(minMaxState=2, minColor=rgba(L["color"][0]), maxColor=rgba(L["color"][1]))
    em = t["EmissionModule"]; em["enabled"] = True; mm(em["rateOverTime"], L["rate"]); mm(em["rateOverDistance"], 0.0)
    em["m_BurstCount"] = 0; em["m_Bursts"] = []
    sh = t["ShapeModule"]; s = L["shape"]
    sh.update(enabled=True, type=10, angle=0.0, length=0.0, radiusThickness=float(s["thick"]), alignToDirection=False,
              randomDirectionAmount=0.0, sphericalDirectionAmount=0.0, randomPositionAmount=float(s["jitter"]))
    sh["m_Position"] = {"x": 0.0, "y": 0.0, "z": 0.0}; sh["m_Rotation"] = {"x": 0.0, "y": 0.0, "z": 0.0}; sh["m_Scale"] = {"x": 1.0, "y": 1.0, "z": 1.0}
    sh["radius"].update(value=float(s["radius"]), mode=0, spread=0.0)
    sh["arc"].update(value=360.0, mode=int(s["mode"]), spread=0.0); mm(sh["arc"]["speed"], float(s["speed"]) or 1.0)
    ve = t["VelocityModule"]; ve["enabled"] = True; ve["inWorldSpace"] = False
    for k in ("x", "y", "z", "orbitalOffsetX", "orbitalOffsetY", "orbitalOffsetZ"): mm(ve[k], 0.0)
    orb = L["orbit"]
    for k in ("orbitalX", "orbitalY"):
        mm(ve[k], [(0.0, 0.0), (1.0, 0.0)] if isinstance(orb, list) else (0.0, 0.0) if isinstance(orb, tuple) else 0.0)
    mm(ve["orbitalZ"], orb); mm(ve["radial"], L["radial"]); mm(ve["speedModifier"], 1.0)
    co = t["ColorModule"]; co["enabled"] = True; grad(co["gradient"], W, L["fade"])
    sz = t["SizeModule"]; sz["enabled"] = True; sz["separateAxes"] = False; mm(sz["curve"], L["grow"])
    for k in ("RotationModule", "UVModule", "InheritVelocityModule", "LifetimeByEmitterSpeedModule", "ForceModule", "ExternalForcesModule",
              "ClampVelocityModule", "SizeBySpeedModule", "RotationBySpeedModule", "ColorBySpeedModule", "CollisionModule", "TriggerModule",
              "SubModule", "LightsModule", "TrailModule", "CustomDataModule"):
        if k in t and isinstance(t[k], dict) and "enabled" in t[k]: t[k]["enabled"] = False
    no = t["NoiseModule"]; n = L.get("noise")
    no["enabled"] = bool(n)
    if n:
        no["separateAxes"] = False; mm(no["strength"], n["strength"]); no["frequency"] = float(n["freq"]); mm(no["scrollSpeed"], n["scroll"])
        no["damping"] = True; no["octaves"] = 1; no["quality"] = 1; no["remapEnabled"] = False
        mm(no["positionAmount"], 1.0); mm(no["rotationAmount"], 0.0); mm(no["sizeAmount"], 0.0)


def swap_refs(v, table):
    """Every object reference in a tree that points at an old material now points at the dot material."""
    if isinstance(v, dict):
        if set(v) == {"m_FileID", "m_PathID"}:
            hit = table.get((v["m_FileID"], v["m_PathID"]))
            if hit: v["m_FileID"], v["m_PathID"] = hit; return 1
            return 0
        return sum(swap_refs(x, table) for x in v.values())
    if isinstance(v, list): return sum(swap_refs(x, table) for x in v)
    return 0


def build(out, adds_path):
    sys.path.insert(0, ROOT)
    argv = list(sys.argv); sys.argv = ["x"]
    with contextlib.redirect_stdout(io.StringIO()):
        import bbmod, bbchar
        import UnityPy
    sys.argv = argv

    def load(n): return UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(n + ".ab")))
    def cab(env): return list(env.file.files.keys())[0]
    dot_env = load(DOT_MAT); dot_cab = cab(dot_env)
    dot_id = next(o.path_id for o in dot_env.objects if o.type.name == "Material")
    old_cab, ring_cab = cab(load(OLD_MAT)), cab(load(RING_MAT))
    old_id = next(o.path_id for o in load(OLD_MAT).objects if o.type.name == "Material")
    ring_id = next(o.path_id for o in load(RING_MAT).objects if o.type.name == "Material")
    names, name_idx, deps_of = bbchar.manifest_lookup()
    dot_deps = [names[int(d, 16)] for d in deps_of[name_idx[DOT_MAT]]]

    total = {"names": [], "entries": [], "guids": []}
    for fx_name, layers in FLOWS.items():
        dst = "effect/prefab/ui/common/" + fx_name.lower()
        adds = bbchar.clone_bundle(HOLD, dst, out, rename=[(HOLD_TOKEN, fx_name)])
        dstp = os.path.join(out, *(dst + ".ab").split("/"))
        env = UnityPy.load(dstp); env.typetree_generator = bbmod.typetree_gen()
        gos = {o.path_id: o.read_typetree()["m_Name"] for o in env.objects if o.type.name == "GameObject"}
        done = set(); muted = 0; hubs = 0
        for o in env.objects:
            if o.type.name == "ParticleSystem":
                t = o.read_typetree(); nm = gos.get(t["m_GameObject"]["m_PathID"])
                if nm in layers: apply_flow(t, layers[nm]); o.save_typetree(t); done.add(nm)
                elif nm in MUTE: mute_layer(t); o.save_typetree(t); muted += 1
            elif o.type.name == "MonoBehaviour":
                try: t = o.read_typetree()
                except Exception: continue
                if "m_subEffectHubs" in t and "m_duration" in t:
                    t["m_overrideDuration"] = 1; t["m_duration"] = -1.0; t["m_maxParticleLifetime"] = 4.0; o.save_typetree(t); hubs += 1
        missing = sorted(set(layers) - done)
        if missing: raise SystemExit("import_swirl: %s has no layer %s; the game's effect changed" % (HOLD, ", ".join(missing)))
        open(dstp, "wb").write(env.file.save(packer="lz4"))
        total["names"] += adds["names"]; total["entries"] += adds["entries"]; total["guids"] += adds.get("guids", [])
        print("  swirl effect %s: %d layers loop, %d emit nothing, %d hubs without an end -> %s" % (fx_name, len(done), muted, hubs, dstp))
    for fx_name, layers in EFFECTS.items():
        dst = "effect/prefab/ui/common/" + fx_name.lower()



        adds = bbchar.clone_bundle(DONOR, dst, out, rename=[(DONOR_TOKEN, fx_name)])
        dstp = os.path.join(out, *(dst + ".ab").split("/"))
        env = UnityPy.load(dstp); env.typetree_generator = bbmod.typetree_gen()
        sf = list(env.file.files.values())[0]
        fid_old = fid_ring = None
        for i, e in enumerate(sf.externals):
            if old_cab.lower() in e.path.lower(): fid_old = i + 1; e.path = "archive:/%s/%s" % (dot_cab, dot_cab)
            elif ring_cab.lower() in e.path.lower(): fid_ring = i + 1
        if fid_old is None: raise SystemExit("import_swirl: the donor no longer uses %s; the game's effect changed" % OLD_MAT)
        table = {(fid_old, old_id): (fid_old, dot_id)}
        if fid_ring is not None: table[(fid_ring, ring_id)] = (fid_old, dot_id)

        gos = {o.path_id: o.read_typetree()["m_Name"] for o in env.objects if o.type.name == "GameObject"}
        done = set(); swapped = 0; tinters = set()
        for o in env.objects:
            kind = o.type.name
            if kind == "ParticleSystem":
                t = o.read_typetree(); nm = gos.get(t["m_GameObject"]["m_PathID"])
                if nm in layers: apply_layer(t, layers[nm]); o.save_typetree(t); done.add(nm)
            elif kind == "ParticleSystemRenderer":
                t = o.read_typetree(); nm = gos.get(t["m_GameObject"]["m_PathID"])
                if nm not in layers: continue
                st = layers[nm].get("stretch")
                t["m_RenderMode"] = 1 if st else 0; t["m_RenderAlignment"] = 0; t["m_CameraVelocityScale"] = 0.0
                t["m_LengthScale"] = float(st["length"]) if st else 2.0; t["m_VelocityScale"] = float(st["velocity"]) if st else 0.0
                t["m_MinParticleSize"] = 0.0; t["m_MaxParticleSize"] = 100.0
                swapped += swap_refs(t, table); o.save_typetree(t)
            elif kind in ("Transform", "RectTransform"):
                t = o.read_typetree(); nm = gos.get(t["m_GameObject"]["m_PathID"])
                if nm in layers:
                    t["m_LocalRotation"] = {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}; t["m_LocalScale"] = {"x": 1.0, "y": 1.0, "z": 1.0}
                    t["m_LocalPosition"] = {"x": 0.0, "y": 0.0, "z": 0.0}; o.save_typetree(t)
                elif nm == "VFX_BG":
                    t["m_LocalScale"] = {"x": 1.0, "y": 1.0, "z": 1.0}; o.save_typetree(t)
                elif nm in OFF:
                    t["m_LocalScale"] = {"x": 0.0, "y": 0.0, "z": 0.0}; o.save_typetree(t)
            elif kind == "MonoBehaviour":
                try: t = o.read_typetree()
                except Exception: continue
                changed = swap_refs(t, table)
                if "m_ParticleSystem" in t and "m_Scale" in t and gos.get(t["m_GameObject"]["m_PathID"]) in layers and t["m_Scale"] != 100.0:
                    t["m_Scale"] = 100.0; changed += 1
                if "MaterialInterpolators" in t and gos.get(t["m_GameObject"]["m_PathID"]) in layers:


                    t["m_Enabled"] = 0
                    if "m_autoPlay" in t: t["m_autoPlay"] = 0
                    tinters.add(o.path_id); changed += 1
                if changed: o.save_typetree(t); swapped += changed
        for o in env.objects:
            if o.type.name != "MonoBehaviour" or not tinters: continue
            try: t = o.read_typetree()
            except Exception: continue
            fx = t.get("m_vfxEffects")
            if isinstance(fx, list) and any(e.get("m_PathID") in tinters for e in fx):
                t["m_vfxEffects"] = [e for e in fx if e.get("m_PathID") not in tinters]; o.save_typetree(t)
        missing = sorted(set(layers) - done)
        if missing: raise SystemExit("import_swirl: %s has no layer %s; the game's effect changed" % (DONOR, ", ".join(missing)))
        open(dstp, "wb").write(env.file.save(packer="lz4"))
        for name, deps in adds["entries"]:
            deps = [d for d in deps if d not in (OLD_MAT, RING_MAT)]
            for d in [DOT_MAT] + dot_deps:
                if d not in deps: deps.append(d)
            total["entries"].append((name, deps))
        total["names"] += adds["names"]; total["guids"] += adds.get("guids", [])
        print("  swirl effect %s: %d layers rewritten, %d references moved to %s -> %s" % (fx_name, len(done), swapped, DOT_MAT.rsplit("/", 1)[-1], dstp))
    json.dump(total, open(adds_path, "w"), indent=1)


if __name__ == "__main__":
    a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
    if "--out" not in kw or "--adds" not in kw: raise SystemExit(__doc__)
    build(kw["--out"], kw["--adds"])
