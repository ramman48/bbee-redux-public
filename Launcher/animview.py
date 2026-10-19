"""animview.py -- render the installed game's sprite animations (any character or boss) straight from its data.

A clip (actor/animation/role/<clip>.ab) is a list of frames {mesh, textureIdx, mountPoints} plus Indeces (the tick,
at 60 per second, where each frame ends). A frame is a textured mesh: its triangles map sprite-sheet UVs to world
units. The sheet comes from the character's texture family (actor/texturefamily/<role>_<skin>.ab), which lists
sprite-sheet GUIDs that the manifest resolves to bundles.
usage:
  python animview.py info  <clip>                          frame count, timing, mesh bundles, sheets
  python animview.py still <clip> [frame] --out f.png      one frame (default: the first)
  python animview.py gif   <clip> --out f.gif            the whole clip with its real frame timing
  python animview.py sheet <clip> --out f.png              every frame side by side with its index and time
options: --skin 02  --ppu 100 (pixels per world unit)  --mounts (draw attachment points)
ANIMVIEW_OVERLAY=<build folder>: bundles a mod build wrote there (e.g. an importer's clips, meshes and sheets) are read
from it first, and its _manifest_add.json guids resolve their sheets (the audits of importer-built clips use this)."""
import argparse, io, os, re, struct, sys, functools
ROOT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ROOT)
_a = sys.argv; sys.argv = ["x"]
import bbmod, bbchar, UnityPy
sys.argv = _a
from PIL import Image, ImageDraw, ImageFont
import numpy as np

BUNDLES = [l.strip()[:-3] for l in open(os.path.join(ROOT, "inspect", "logical_bundles.txt"), encoding="utf-8") if l.strip().endswith(".ab")]
OVERLAY = os.environ.get("ANIMVIEW_OVERLAY") or ""
_OVER_GUIDS = {}
if OVERLAY and os.path.isdir(OVERLAY):
    for d_, _, fs_ in os.walk(OVERLAY):
        for f_ in fs_:
            if f_.endswith(".ab") and os.path.relpath(d_, OVERLAY).replace("\\", "/").startswith("actor/"):
                b_ = os.path.relpath(os.path.join(d_, f_), OVERLAY).replace("\\", "/")[:-3]
                if b_ not in BUNDLES: BUNDLES.append(b_)
    _ma = os.path.join(OVERLAY, "_manifest_add.json")
    if os.path.exists(_ma):
        import json as _json
        _OVER_GUIDS = {g.lower(): b for b, g in _json.load(open(_ma, encoding="utf-8")).get("guids", [])}

def env_of(bundle):
    op = os.path.join(OVERLAY, *(bundle + ".ab").split("/")) if OVERLAY else ""
    if op and os.path.exists(op):
        e = UnityPy.load(op)
    else:
        e = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(bundle + ".ab")))
    e.typetree_generator = bbmod.typetree_gen(); return e

@functools.lru_cache(None)
def clip(name):
    for o in env_of("actor/animation/role/%s" % name.lower()).objects:
        if o.type.name == "MonoBehaviour":
            t = o.read_typetree()
            if "Frames" in t: return t
    raise SystemExit("no clip " + name)

@functools.lru_cache(None)
def meshes(role):
    """PathID -> (vertices Nx2, uvs Nx2, triangles Mx3) for every mesh of a role (actor/mesh/<role>/*)."""
    out = {}
    for b in [x for x in BUNDLES if x.startswith("actor/mesh/%s/" % role)]:
        for o in env_of(b).objects:
            if o.type.name != "Mesh": continue
            v, vt, f = [], [], []
            for line in o.read().export().splitlines():
                p = line.split()
                if not p: continue
                if p[0] == "v": v.append((float(p[1]), float(p[2])))
                elif p[0] == "vt": vt.append((float(p[1]), float(p[2])))
                elif p[0] == "f": f.append(tuple(int(x.split("/")[0]) - 1 for x in p[1:4]))
            out[o.path_id] = (np.array(v), np.array(vt), np.array(f, dtype=int))
    return out

GUID_CACHE = os.path.join(ROOT, "inspect", "guid_index.json")
@functools.lru_cache(None)
def guid_index():
    """GUID -> bundle, cached in inspect/guid_index.json (built once in a separate process: the manifest is large)."""
    if not os.path.exists(GUID_CACHE):
        import subprocess
        subprocess.run([sys.executable, "-c", "import sys,json;sys.argv=['x'];import bbmod,bbchar;n,e,g=bbchar.read_manifest();"
                        "json.dump({x.lower():n[int(i,16)] for i,gs in g for x in gs},open(r'%s','w'))" % GUID_CACHE], cwd=ROOT, check=True)
    import json
    g = json.load(open(GUID_CACHE, encoding="utf-8"))
    g.update(_OVER_GUIDS)
    return g

@functools.lru_cache(None)
def sheets(role, skin):
    fam = None
    for o in env_of("actor/texturefamily/%s_%s" % (role, skin)).objects:
        if o.type.name == "MonoBehaviour":
            t = o.read_typetree()
            if "textureRefs" in t: fam = t
    if fam is None: raise SystemExit("no texture family %s_%s" % (role, skin))
    gi, out = guid_index(), []
    for ref in fam["textureRefs"]:
        hexg = struct.pack("<QQ", ref["_guid0"], ref["_guid1"]).hex()
        b = gi.get(hexg)
        img = None
        if b:
            for o in env_of(b[:-3] if b.endswith(".ab") else b).objects:
                if o.type.name == "Texture2D": img = o.read().image.convert("RGBA"); break
        out.append(img)
    return out

def role_of(name):
    """Clip name -> animation role (the AnimationJsons name): the longest known mesh role that prefixes it."""
    roles = sorted({b.split("/")[2] for b in BUNDLES if b.startswith("actor/mesh/")}, key=len, reverse=True)
    try:
        own = (clip(name).get("Context") or {}).get("AnimationRoleName")
        if own and any(r.lower() == own.lower() for r in roles): return next(r for r in roles if r.lower() == own.lower())
    except SystemExit:
        pass
    return next(r for r in roles if name.lower().startswith(r.lower() + "_"))

def render(name, idx, skin="02", ppu=100, mounts=False):
    c = clip(name); role = role_of(name); fr = c["Frames"][idx]
    mesh = meshes(role).get(fr["mesh"]["m_PathID"])
    tex = sheets(role, skin)[fr["textureIdx"]]
    if mesh is None or tex is None: return None, "missing %s" % ("mesh" if mesh is None else "sheet %d" % fr["textureIdx"])
    v, vt, f = mesh; W, H = tex.size
    xy = v * ppu; xy[:, 1] = -xy[:, 1]
    uv = np.column_stack([vt[:, 0] * W, (1 - vt[:, 1]) * H])
    lo = np.floor(xy.min(0)) - 2; hi = np.ceil(xy.max(0)) + 2
    size = (int(hi[0] - lo[0]), int(hi[1] - lo[1])); xy = xy - lo
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    for tri in f:
        d, s = xy[tri], uv[tri]
        x0, y0 = np.floor(d.min(0)).astype(int); x1, y1 = np.ceil(d.max(0)).astype(int)
        if x1 <= x0 or y1 <= y0: continue
        A = np.column_stack([d - [x0, y0], np.ones(3)])
        try: cx = np.linalg.solve(A, s[:, 0]); cy = np.linalg.solve(A, s[:, 1])
        except np.linalg.LinAlgError: continue
        patch = tex.transform((x1 - x0, y1 - y0), Image.AFFINE, (cx[0], cx[1], cx[2], cy[0], cy[1], cy[2]), resample=Image.BILINEAR)
        mask = Image.new("L", patch.size, 0); ImageDraw.Draw(mask).polygon([tuple(p) for p in (d - [x0, y0])], fill=255)
        out.alpha_composite(Image.composite(patch, Image.new("RGBA", patch.size), mask), (x0, y0))
    origin = (-lo).astype(int)
    if mounts:
        dr = ImageDraw.Draw(out)
        for m in fr.get("mountPoints") or []:
            p = m.get("position") or m.get("pos") or {}
            if "x" in p:
                px, py = origin[0] + p["x"] * ppu, origin[1] - p["y"] * ppu
                dr.ellipse([px - 4, py - 4, px + 4, py + 4], outline=(0, 255, 255, 255)); dr.text((px + 5, py - 5), str(m.get("name", "")), fill=(0, 255, 255, 255))
        dr.line([origin[0] - 8, origin[1], origin[0] + 8, origin[1]], fill=(255, 0, 0, 255)); dr.line([origin[0], origin[1] - 8, origin[0], origin[1] + 8], fill=(255, 0, 0, 255))
    return (out, origin), None

def frame_times(c):
    """(start, end) seconds of each frame from Indeces (tick where each frame ends, 60 ticks/s)."""
    ends = c["Indeces"]; out = []; prev = 0
    for e in ends: out.append((prev / 60.0, e / 60.0)); prev = e
    return out

def aligned(name, skin, ppu, mounts):
    """Every frame rendered on one canvas with a shared origin (so movement / pivot drift is visible)."""
    c = clip(name); imgs = []
    for i in range(len(c["Frames"])):
        r, err = render(name, i, skin, ppu, mounts); imgs.append(r if r else (Image.new("RGBA", (40, 40), (255, 0, 0, 120)), (20, 20)))
    left = max(o[0] for _, o in imgs); top = max(o[1] for _, o in imgs)
    right = max(im.size[0] - o[0] for im, o in imgs); bottom = max(im.size[1] - o[1] for im, o in imgs)
    frames = []
    for im, o in imgs:
        can = Image.new("RGBA", (left + right, top + bottom), (0, 0, 0, 0)); can.alpha_composite(im, (left - o[0], top - o[1])); frames.append(can)
    return frames, (left, top)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("clip"); ap.add_argument("frame", nargs="?", type=int, default=0)
    ap.add_argument("--out"); ap.add_argument("--skin", default="02"); ap.add_argument("--ppu", type=float, default=100); ap.add_argument("--mounts", action="store_true")
    ap.add_argument("--bg", default="30,30,36")
    a = ap.parse_args(); bg = tuple(int(x) for x in a.bg.split(",")) + (255,)
    guid_index()
    c = clip(a.clip)
    if a.cmd == "info":
        role = role_of(a.clip); t = frame_times(c)
        print("%s: role %s, %d frames, %.3fs; frame ends (s): %s" % (a.clip, role, len(c["Frames"]), t[-1][1] if t else 0, [round(e, 3) for s, e in t]))
        print("sheets:", ["%dx%d" % im.size if im else "MISSING" for im in sheets(role, a.skin)])
        miss = [i for i, fr in enumerate(c["Frames"]) if fr["mesh"]["m_PathID"] not in meshes(role)]
        print("frames with a missing mesh:", miss or "none")
        return
    if a.cmd == "still":
        r, err = render(a.clip, a.frame, a.skin, a.ppu, a.mounts)
        if not r: raise SystemExit(err)
        im = Image.new("RGBA", r[0].size, bg); im.alpha_composite(r[0]); im.save(a.out); print(a.out, im.size); return
    frames, origin = aligned(a.clip, a.skin, a.ppu, a.mounts)
    if a.cmd == "gif":
        durs = [max(20, int(round((e - s) * 1000))) for s, e in frame_times(c)]
        fl = []
        for fr in frames:
            im = Image.new("RGBA", fr.size, bg); im.alpha_composite(fr); fl.append(im.convert("RGB"))
        fl[0].save(a.out, save_all=True, append_images=fl[1:], duration=durs, loop=0); print(a.out, len(fl), "frames"); return
    if a.cmd == "sheet":
        t = frame_times(c); w, h = frames[0].size; cols = min(8, len(frames)); rows = (len(frames) + cols - 1) // cols
        sh = Image.new("RGBA", (w * cols, (h + 16) * rows), bg); dr = ImageDraw.Draw(sh)
        for i, fr in enumerate(frames):
            x, y = (i % cols) * w, (i // cols) * (h + 16); sh.alpha_composite(fr, (x, y + 16))
            dr.text((x + 3, y + 2), "#%d %.2f-%.2fs" % (i, t[i][0], t[i][1]), fill=(255, 255, 0, 255))
            dr.line([x + origin[0] - 6, y + 16 + origin[1], x + origin[0] + 6, y + 16 + origin[1]], fill=(255, 60, 60, 255))
        sh.save(a.out); print(a.out, sh.size); return
    raise SystemExit("unknown command " + a.cmd)

if __name__ == "__main__":
    main()
