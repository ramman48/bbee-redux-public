"""bbtag_fxcompile.py -- compile a BBTAG effect state's 3D model layers into mesh-particle parts (Cross Effect, V2).

BBTAG draws Ruby's scythe arcs, spins, rings and muzzle cones as flat ribbon models (research/MUA.md): parts shown in
turn (bone visibility), U scrolling along the stroke, an object alpha that fades. BBEE's own slashes are the same
thing: single mesh particles on ribbon meshes, Custom Data scrolling U, colour over lifetime (docs/cross-effect/
V2_REBUILD.md §2). This module turns one effect state into a list of PARTS:

  part = {
    "key":    "<object state>/<model>/<mesh>/<material>",
    "layer":  object state suffix ("_1" red body, "_2" dark edge, "_3" soft wind glow, "_4" additive streak ...),
    "role":   body | edge | glow | core | flash (from the BBTAG texture: dageki/zangeki 01, 02, 03, 04, others),
    "blend":  alpha | add,
    "t0", "t1": first and last tick shown (60 per s, from the effect's spawn),
    "origin": [x, y] the object's origin, world units relative to her root, facing right, y up,
    "verts":  [[x, y] ...] the part's mesh relative to origin (world units, facing right, scale and rotation of t0),
    "uv":     [[u, v] ...] BBTAG's own UVs (U along the stroke),
    "alpha":  [a ...] per-vertex alpha (BBTAG fades along the stroke),
    "tris":   [[i, j, k] ...],
    "uscroll": [[tick, u_offset] ...] BBTAG's U offset per tick while shown (texture u = u - offset),
    "vscroll": [[tick, v_offset] ...] its V offset (texture v = v + offset; flipbook-cell models step both),
    (a constant UV tiling, e.g. 0.5 for a 2x2 cell model, is baked into "uv"),
    "fade":   [[tick, object alpha 0-1] ...],
    "scale":  [[tick, sx / sx(t0), sy / sy(t0)] ...] and "rot": [[tick, degrees - rot(t0)] ...] when they change,
    "tint":   [r, g, b] the palette colour BBTAG tints the layer with (0-1),
  }

Coordinates follow tools/bbtag/bbtag_fxport.py exactly (raw BBTAG faces left, y down; mirrored to face right), which the
move viewer checked against her sprite frames. Build time only: it reads the player's own install.

usage: python tools/bbtag/bbtag_fxcompile.py <state> [--png]     (summary; --png draws the parts per tick for review)
"""
import json, os, re, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bbtag_mua as MU

U_PER_PX = 1.95 / 419          # BBTAG sprite px -> BBEE world units (her rig scale; ruby_move_view.py uses the same)
K = MU.UNIT_PX * U_PER_PX      # model units -> world units


def role_of(texture):
    t = (texture or "").lower()
    if re.search(r"(zangeki|dageki)04|streak|line", t): return "core"
    if re.search(r"(zangeki|dageki)03|wind|glow", t): return "glow"
    if re.search(r"(zangeki|dageki)02", t): return "edge"
    if re.search(r"(zangeki|dageki)01", t): return "body"
    return "flash"


def _world(st, xyz):
    """Model vertices -> world units, facing right, y up, relative to the OBJECT origin (scale / rotation of st)."""
    x, y = xyz[:, 0] * st["sx"], xyz[:, 1] * st["sy"]
    if st["rot"]:
        a = np.radians(st["rot"])
        x, y = x * np.cos(a) - y * np.sin(a), x * np.sin(a) + y * np.cos(a)
    return np.stack([-x * K, y * K], 1)


def compile_state(state, code="rrb", stop=None, max_ticks=240):
    sc = MU.Script(code)
    objs, tl = MU.run_effect(sc, state, frames=max_ticks)
    if stop is not None:
        tl = [(t, d) for t, d in tl if t < stop]
    parts = {}
    for t, draw in tl:
        for ob, st, mt in draw:
            mdl = MU.model(st["model"], code)
            tint = MU.effect_tint(code, 0, st)
            blend = st["blend"] or MU._default_blend(mdl, code)
            for g in mdl.geometry(mt):
                if not len(g["tris"]):
                    continue
                used = np.unique(g["tris"])
                if np.ptp(g["xyz"][used, 0]) * st["sx"] * K < 0.01 and np.ptp(g["xyz"][used, 1]) * st["sy"] * K < 0.01:
                    continue                                      # hidden (bone scale 0.0001)
                key = "%s/%s/%s/%s" % (ob.state, st["model"].split(".")[0], g["mesh"], g["material"])
                p = parts.get(key)
                off = mdl.uv_offset(g["material"], mt)
                if p is None:
                    remap = {int(v): i for i, v in enumerate(used)}
                    tris = np.vectorize(remap.get)(g["tris"])
                    # BBTAG's own UVs: undo this tick's scroll (geometry() applied u*tile - offset, v*tile + offset)
                    base_uv = np.stack([(g["uv"][used, 0] + off[0]) / (off[2] or 1.0), (g["uv"][used, 1] - off[1]) / (off[3] or 1.0)], 1)
                    base_uv = base_uv * np.array([off[2] or 1.0, off[3] or 1.0])      # bake the (constant) tiling
                    p = parts[key] = {
                        "key": key, "state": ob.state, "layer": ob.state[len(state):] or "_0",
                        "texture": g["texture"], "role": role_of(g["texture"]),
                        "blend": "add" if role_of(g["texture"]) == "core" else blend,
                        "t0": t, "t1": t, "origin": [round(float(st["x"] * U_PER_PX), 4), round(float(st["y"] * U_PER_PX), 4)],
                        "verts": np.round(_world(st, g["xyz"][used]), 4).tolist(),
                        "uv": np.round(base_uv, 4).tolist(),
                        "alpha": np.round(g["rgba"][used, 3], 3).tolist(),
                        "tris": tris.tolist(), "uscroll": [], "vscroll": [], "fade": [], "scale": [], "rot": [],
                        "tint": [round(float(c), 3) for c in (tint if tint is not None else (1, 1, 1))],
                        "_s0": (st["sx"], st["sy"], st["rot"]),
                    }
                p["t1"] = t
                p["uscroll"].append([t, round(float(off[0]), 4)])
                p["vscroll"].append([t, round(float(off[1]), 4)])
                p["fade"].append([t, round(float(st["alpha"]) / 255.0, 3)])
                s0 = p["_s0"]
                if (st["sx"], st["sy"]) != s0[:2]:
                    p["scale"].append([t, round(st["sx"] / s0[0], 4), round(st["sy"] / s0[1], 4)])
                if st["rot"] != s0[2]:
                    p["rot"].append([t, round(-(st["rot"] - s0[2]), 3)])    # mirrored: rotation sense flips
    out = []
    for p in parts.values():
        p.pop("_s0", None)
        for k in ("uscroll", "vscroll", "fade"):          # drop constant tracks
            if len({v for _, v in p[k]}) == 1:
                p[k] = [p[k][0]] if p[k] else []
        out.append(p)
    out.sort(key=lambda p: (p["t0"], p["layer"], p["key"]))
    sprites = sum(1 for ob in objs for s in ob.sprites if s[2] != "null")
    placed = []
    for o in objs:                         # each object's placement at its spawn (world units, facing right, degrees)
        st = MU.obj_params(o, o.t0)
        placed.append({"state": o.state, "t0": o.t0, "t1": o.end if o.dead is None else min(o.end, o.dead),
                       "x": round(float(st["x"] * U_PER_PX), 4), "y": round(float(st["y"] * U_PER_PX), 4),
                       "rot": round(float(-st["rot"]), 3), "model": (st["model"] or "").split(".")[0],
                       "sprites": [s[2] for s in o.sprites if s[2] != "null"][:4]})
    return {"state": state, "parts": out, "ticks": len(tl), "sprite_frames": sprites, "objects": placed}


def draw_png(res, path, scale=160):
    from PIL import Image, ImageDraw
    pts = [np.array(p["verts"]) + np.array(p["origin"]) for p in res["parts"]]
    if not pts: return
    allp = np.concatenate(pts)
    x0, x1 = min(allp[:, 0].min(), 0) - 0.3, max(allp[:, 0].max(), 0) + 0.3
    y0, y1 = min(allp[:, 1].min(), 0) - 0.3, max(allp[:, 1].max(), 0) + 0.3
    W, H = int((x1 - x0) * scale), int((y1 - y0) * scale)
    cols = {"body": (220, 30, 40), "edge": (90, 60, 60), "glow": (255, 170, 190), "core": (255, 255, 255), "flash": (120, 200, 255)}
    ticks = sorted({p["t0"] for p in res["parts"]} | {p["t1"] for p in res["parts"]})
    frames = []
    for t in range(res["ticks"]):
        im = Image.new("RGB", (W, H), (24, 26, 34)); d = ImageDraw.Draw(im, "RGBA")
        tp = lambda x, y: ((x - x0) * scale, (y1 - y) * scale)
        gx, gy = tp(0, 0); d.line([(0, gy), (W, gy)], fill=(60, 64, 80)); d.line([(gx, gy - 10), (gx, gy + 10)], fill=(255, 255, 255))
        for p, P in zip(res["parts"], pts):
            if not (p["t0"] <= t <= p["t1"]): continue
            c = cols[p["role"]]
            for tri in p["tris"]:
                d.polygon([tp(*P[i]) for i in tri], fill=c + (110,))
        d.text((4, 4), "%s t=%d" % (res["state"], t), fill=(255, 255, 0))
        frames.append(im)
    cols_n = 5
    w, h = frames[0].size
    k = min(1.0, 1800 / (cols_n * w))
    sheet = Image.new("RGB", (int(cols_n * w * k), int(((len(frames) + cols_n - 1) // cols_n) * h * k)))
    for i, f in enumerate(frames):
        sheet.paste(f.resize((int(w * k), int(h * k))), (int((i % cols_n) * w * k), int((i // cols_n) * h * k)))
    sheet.save(path)


def main():
    a = sys.argv[1:]
    for st in [x for x in a if not x.startswith("--")]:
        r = compile_state(st)
        print("%s: %d ticks, %d parts, %d sprite frames (not compiled)" % (st, r["ticks"], len(r["parts"]), r["sprite_frames"]))
        for p in r["parts"]:
            print("  %-44s %-5s %-5s t %2d-%-2d verts %4d origin %s uscroll %s fade %s scale %s rot %s" % (
                p["key"][:44], p["role"], p["blend"], p["t0"], p["t1"], len(p["verts"]), p["origin"],
                "%s->%s" % (p["uscroll"][0][1], p["uscroll"][-1][1]) if p["uscroll"] else "-",
                "%s->%s" % (p["fade"][0][1], p["fade"][-1][1]) if p["fade"] else "-", len(p["scale"]), len(p["rot"])))
        if "--png" in a:
            out = os.path.join(os.path.dirname(os.path.dirname(HERE)), "local_only", "bbtag", "_compile")
            os.makedirs(out, exist_ok=True)
            draw_png(r, os.path.join(out, st + ".png"))


if __name__ == "__main__":
    main()
