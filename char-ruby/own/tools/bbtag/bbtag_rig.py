"""bbtag_rig.py -- build a BBEE native sprite rig (sheets + texture family + per-frame meshes + clips) from a BBTAG
character in the PLAYER'S OWN install, at build time. Nothing produced here may be committed or shipped: bundles go to
the build output folder, caches to the local folder's cache/.

BBEE's stock rig (verified on Ragna, docs/cross-effect/PIPELINE.md):
  actor/texturefamily/<role>_<skin>   MonoBehaviour {m_Name, textureRefs[{_guid0,_guid1}], Name2Range}; each GUID is a
                                      sheet bundle through the manifest's GUID map
  actor/sprite/<role>/<skin>/<page>   one BC7 Texture2D
  actor/mesh/<role>/<group>           Mesh objects, one per frame: position float3 + uv float4 (u, v, x/4.45+0.5, y/4.45)
  actor/animation/role/<clip>         MonoBehaviour {m_Name, TotalFrameCount, Frames[{mesh PPtr, textureIdx,
                                      mountPoints}], Indeces (last tick of each frame, 60/s), Context{AnimationRoleName,
                                      material = rendering/material/sprite/spritepalette}}; 2 externals: material, mesh

usage (research/verification):
  python tools/bbtag/bbtag_rig.py frames <sprite> [...]     write flattened frames to <local folder>/bbtag/_frames/
"""
import hashlib, io, json, os, re, struct, sys, uuid

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# (the loader's folder is the nearest one above that holds bbmod.py: a character packed for a mod loader carries its
#  own copy of this module inside its mod folder; in the workspace and a standalone package it is the folder it was)
ROOT = next((p for p in (os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 8)) if os.path.exists(os.path.join(p, "bbmod.py"))), os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE)
try:
    import bbtag_read as R
    import bbtag_formats as F
except ImportError:     # a package whose source isn't Cross Tag Battle (DELTARUNE: Party: dr_source.DRSource) ships
    R = F = None        # without the two readers; only the Cross Tag Battle Source class below uses them

LOCAL = os.path.join(ROOT, "local_only")
CACHE = os.path.join(LOCAL, "cache")
UV_CHAR = 4.45          # stock meshes: uv.zw = (x / 4.45 + 0.5, y / 4.45) (Ragna, verified on two meshes)
PAGE = 4096
FRAME_VERSION = "v7"   # bump whenever frame extraction/cleanup changes (frame caches key on it)
PAD = 2

DONOR_SHEET = "actor/sprite/rg/02/rg_atk_1_c"
# A character's art is THREE texture families, looked up by name from the logic's AnimationJsons (NOTES 2026-09-27):
#   <role>_<skin>   colour (stock: opaque, black background)
#   <role>_Extra    R: light-region mask, G: inner line-art, B: silhouette grown ~4 px (outline), A: the real alpha
#   <role>_Extra2   R: glow lines (blade glints); G/B 0, A opaque
# Without the two extras the game keeps whatever textures the material last had (Ruby 0.1.0 showed her in a box).
DONOR_EXTRA = "actor/sprite/rg/extra/rg_atk_1_c"
DONOR_EXTRA2 = "actor/sprite/rg/extra2/rg_atk_1_c"
DONOR_FAMILY_EXTRA = "actor/texturefamily/rg_extra"
FRAME_MARGIN = 6        # transparent px around every frame, so the outline ring (B, +4 px) stays inside the quad
OUTLINE_R = 4
DONOR_FAMILY = "actor/texturefamily/rg_02"
DONOR_MESH = "actor/mesh/rg/atk"
DONOR_CLIP = "actor/animation/role/rg_stand"


class Source:
    """One BBTAG character's sprites, placement and palettes, read in memory from the install."""

    def __init__(self, code, palette="00_00", scale=1.95 / 419):
        self.code = code
        self.scale = scale   # world units per BBTAG pixel: BBTAG Ragna (419 px) = BBEE Ragna (1.95 u)
        self.img = R.fpac_files(R.read("data/char/char_%s_img.pac" % code))
        self.col = R.fpac_files(R.read("data/char/char_%s_col.pac" % code))
        pals = R.fpac_files(R.read("data/char/char_%s_pal.pac" % code))
        self.pal = F.hpl(pals["%s%s.hpl" % (code, palette)])
        self.palette = palette
        # effect sprites: the vri archive (smoke, muzzle, tornado...) and the rrbef* sprites use their EMBEDDED
        # palettes; sprites drawn for additive blending (glow on black) are converted to straight alpha
        self.vri = R.fpac_files(R.read("data/char/char_%s_vri.pac" % code))
        self.additive = set()
        # [(sprite name prefix, size multiplier)]: effect art BBTAG draws scaled up (e.g. a screen-wide petal wipe);
        # it changes only the mesh size, not the sheets
        self.scale_mul = []

    def mul(self, sprite):
        return next((m for pre, m in self.scale_mul if sprite.startswith(pre)), 1.0)

    def effect(self, sprite):
        """Effect sprite -> (RGBA, anchor) with its own palette; additive art becomes alpha (brightness = opacity)."""
        hipb = self.vri.get(sprite + ".hip") or self.img.get(sprite + ".hip")
        jb = self.col.get(sprite + ".jonbin") or self.col.get(sprite.replace("torande", "tornade") + ".jonbin")
        if hipb is None or jb is None:
            return None
        arr, (ox, oy) = F.compose(F.hip(hipb), F.jonbin(jb), None)
        a = arr[..., 3] > 0
        if not a.any():
            return np.zeros((2, 2, 4), np.uint8), (1, 1)
        # green chroma-key backgrounds (vrrrbef_smoke*, vrrrbef_ground*: (0, 252-255, 0)) with soft edges blended into
        # the green: unmix, alpha = 1 - (green excess over red/blue) / key, colour = the part that isn't key
        rgbf = arr[..., :3].astype(np.float32)
        excess = rgbf[..., 1] - np.maximum(rgbf[..., 0], rgbf[..., 2])
        if ((excess > 240) & a).mean() > 0.02:
            K = 252.0
            al = np.clip(1.0 - excess / K, 0, 1) * (arr[..., 3] / 255.0)
            safe = np.maximum(al, 1e-3)[..., None]
            un = rgbf.copy(); un[..., 1] = rgbf[..., 1] - (1.0 - np.clip(1.0 - excess / K, 0, 1)) * K
            un = np.clip(un / safe * (arr[..., 3:4] / 255.0), 0, 255)
            arr = arr.copy(); arr[..., :3] = np.where(al[..., None] > 0, un, 0).astype(np.uint8)
            arr[..., 3] = (al * 255).astype(np.uint8); a = arr[..., 3] > 3
        rgb = arr[..., :3].astype(np.float32)
        dark = (rgb.max(-1) < 24) & a
        if dark.sum() > 0.25 * a.sum():          # glow on black: additive art
            self.additive.add(sprite)
            al = rgb.max(-1)
            out = np.zeros_like(arr)
            nz = al > 0
            out[..., :3][nz] = np.clip(rgb[nz] * 255.0 / al[nz][:, None], 0, 255).astype(np.uint8)
            out[..., 3] = al.astype(np.uint8)
            arr = out; a = al > 3
        ys = np.where(a.any(1))[0]; xs = np.where(a.any(0))[0]
        y0, y1, x0, x1 = ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
        return mirror(arr[y0:y1, x0:x1], (ox - x0, oy - y0))

    def frame(self, sprite, strip=True):
        """-> (RGBA uint8 array cropped to content, (anchor_x, anchor_y) = the root inside it) or None if empty.
        strip: drop everything not connected to the pixels at or above the root + 8 px (artist notes below her feet).
        "null" (BBTAG's invisible sprite) becomes a transparent 2x2 frame."""
        if sprite == "null":
            return np.zeros((2, 2, 4), np.uint8), (1, 1)
        if sprite.startswith(("vr%sef" % self.code, "%sef" % self.code)) or sprite + ".hip" in self.vri:
            return self.effect(sprite)
        hip = sprite + ".hip"
        if hip not in self.img and sprite.endswith("ex") and sprite[:-2] + ".hip" in self.img:
            hip = sprite[:-2] + ".hip"   # "<name>ex": its own placement/boxes over the base image
        if hip not in self.img or sprite + ".jonbin" not in self.col:
            return None   # shared sprites (e.g. Action_327_00, the electrocuted skeleton) live in common archives
        img = F.hip(self.img[hip])
        jb = F.jonbin(self.col[sprite + ".jonbin"])
        arr, (ox, oy) = F.compose(img, jb, self.pal)
        a = arr[..., 3] > 0
        if strip:
            keep = clean_mask(a, oy)
            arr = arr.copy(); arr[~keep] = 0; a = keep
        ys = np.where(a.any(1))[0]; xs = np.where(a.any(0))[0]
        if not len(ys):
            return np.zeros((2, 2, 4), np.uint8), (1, 1)   # keep the frame (and the timing) as an invisible one
        y0, y1, x0, x1 = ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
        return mirror(arr[y0:y1, x0:x1], (ox - x0, oy - y0))


def mirror(arr, anchor):
    """BBTAG draws characters facing LEFT (her forward hits have negative x); BBEE's face right. Flip the frame and
    move the root to match. Boxes get x -> -x in bbtag_moves."""
    return arr[:, ::-1].copy(), (arr.shape[1] - anchor[0], anchor[1])


def _components(mask):
    """8-connected components of a bool mask -> (label image int32, [area per label]); label 0 = background.
    Uses PIL's flood fill (C) per component, so no scipy is needed."""
    from PIL import ImageDraw
    h, w = mask.shape
    lab = Image.fromarray(np.where(mask, 1, 0).astype(np.int32), "I")
    areas, nxt = [0], 2
    ys, xs = np.nonzero(mask)
    arr = None
    for y, x in zip(ys, xs):
        if lab.getpixel((int(x), int(y))) != 1:
            continue
        ImageDraw.floodfill(lab, (int(x), int(y)), nxt)
        nxt += 1
    arr = np.array(lab, np.int32)
    arr[arr > 0] -= 1
    areas = np.bincount(arr.ravel())
    return arr, areas


def _dilate(m, r):
    g = m.copy()
    for _ in range(r):
        g[1:] |= g[:-1]; g[:-1] |= g[1:]; g[:, 1:] |= g[:, :-1]; g[:, :-1] |= g[:, 1:]
    return g


def clean_mask(a, root_y, big=300, near=14):
    """Keep what belongs to the character. Artist notes (Japanese text, guide lines, frame labels) are small
    disconnected clusters away from the body, or anything entirely below her feet.
    Keeps: the largest component; every component of >= `big` px or >= 2% of the largest that is not wholly below
    the root + 8 px; small components only within `near` px of what is kept."""
    if not a.any():
        return a
    lab, areas = _components(a)
    if areas[1:].max() < 500:       # nothing but notes (e.g. a "drawing needed" placeholder frame)
        return np.zeros_like(a)
    if len(areas) <= 2:
        keep = a.copy()
    else:
        order = np.argsort(areas[1:])[::-1] + 1
        top_rows = np.full(len(areas), 1 << 30)
        ys = np.nonzero(a)[0]; ls = lab[a]
        np.minimum.at(top_rows, ls, ys)
        biggest = order[0]
        keepset = {biggest}
        for l in order[1:]:
            if (areas[l] >= big or areas[l] >= 0.02 * areas[biggest]) and top_rows[l] <= root_y + 8:
                keepset.add(l)
        keep = np.isin(lab, list(keepset))
        zone = _dilate(keep, near)
        for l in order[1:]:
            if l in keepset or top_rows[l] > root_y + 8:
                continue
            m = lab == l
            if (m & zone).any():
                keep |= m
    return keep


def normalize(seq):
    """BBTAG sequences -> clip frames: "keep" extends the previous frame; ticks are at least 1."""
    out = []
    for s, t in seq:
        if s == "keep":
            if out:
                out[-1] = (out[-1][0], out[-1][1] + max(1, int(t)))
            continue
        out.append((s, max(1, int(t))))
    return out


def pack(sizes):
    """Shelf packer. sizes: {key: (w, h)} -> ({key: (page, x, y)}, page count). Tallest first, PAD between items."""
    order = sorted(sizes, key=lambda k: (-sizes[k][1], -sizes[k][0]))
    place, page, x, y, shelf = {}, 0, PAD, PAD, 0
    for k in order:
        w, h = sizes[k]
        if w + 2 * PAD > PAGE or h + 2 * PAD > PAGE:
            raise ValueError("frame %s too large (%dx%d)" % (k, w, h))
        if x + w + PAD > PAGE:
            x, y, shelf = PAD, y + shelf + PAD, 0
        if y + h + PAD > PAGE:
            page, x, y, shelf = page + 1, PAD, PAD, 0
        place[k] = (page, x, y)
        x += w + PAD; shelf = max(shelf, h)
    return place, page + 1


def quad_mesh(anchor, size, place, scale):
    """Vertices (4 x 7 floats) and indices for one frame quad. Image y goes down; world y goes up; the root is (0, 0)."""
    (ax, ay), (w, h), (_, px, py) = anchor, size, place
    xl, xr = -ax * scale, (w - ax) * scale
    yt, yb = ay * scale, (ay - h) * scale
    ul, ur = px / PAGE, (px + w) / PAGE
    vt, vb = 1 - py / PAGE, 1 - (py + h) / PAGE
    pts = [(xl, yt, ul, vt), (xr, yt, ur, vt), (xr, yb, ur, vb), (xl, yb, ul, vb)]
    v = np.array([[x, y, 0.0, u, vv, x / UV_CHAR + 0.5, y / UV_CHAR] for x, y, u, vv in pts], np.float32)
    return v, [0, 1, 2, 0, 2, 3]


def build_frames(src, sprites):
    """Flatten, strip, trim and pack. Cached under the local folder's cache/ by content (sprite list + palette + code)."""
    key = hashlib.sha1(json.dumps([src.code, src.palette, sorted(sprites), PAGE, PAD, FRAME_VERSION]).encode()).hexdigest()[:16]
    cdir = os.path.join(CACHE, "rig_%s_%s" % (src.code, key))
    meta_p = os.path.join(cdir, "frames.json")
    if os.path.exists(meta_p):
        return cdir, json.load(open(meta_p))
    os.makedirs(cdir, exist_ok=True)
    frames = {}
    for s in sorted(sprites):
        r = src.frame(s)
        if r is None:
            continue
        a, (ax, ay) = r
        m = FRAME_MARGIN
        frames[s] = (np.pad(a, ((m, m), (m, m), (0, 0))), (ax + m, ay + m))
    place, npages = pack({s: (a.shape[1], a.shape[0]) for s, (a, _) in frames.items()})
    pages = [Image.new("RGBA", (PAGE, PAGE), (0, 0, 0, 0)) for _ in range(npages)]
    for s, (a, _) in frames.items():
        p, x, y = place[s]
        pages[p].paste(Image.fromarray(a, "RGBA"), (x, y))
    for i, pg in enumerate(pages):
        pg.save(os.path.join(cdir, "page_%02d.png" % i))
    meta = {"pages": npages, "frames": {s: {"anchor": list(map(int, anc)), "size": [int(a.shape[1]), int(a.shape[0])], "place": list(place[s])}
                                        for s, (a, anc) in frames.items()}}
    json.dump(meta, open(meta_p, "w"))
    return cdir, meta


# ---------------------------------------------------------------- Unity bundles

MESH_DONORS = [("actor/mesh/hb/base", 572), ("actor/mesh/arboss20/ace", 383), ("actor/mesh/ma/attack", 302)]
BODY_CAP = 560


def _unity():
    sys.argv, argv = ["x"], sys.argv
    sys.path.insert(0, ROOT)
    import bbmod, UnityPy
    sys.argv = argv
    return bbmod, UnityPy


def _env(bbmod, UnityPy, logical):
    e = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(logical + ".ab")))
    e.typetree_generator = bbmod.typetree_gen()
    return e


def _cab(logical):
    return "CAB-" + hashlib.md5(logical.encode()).hexdigest()


def _guid(logical):
    return hashlib.md5(("guid:" + logical).encode()).hexdigest()


def _retarget(env, dst, container_path, ext_map=None):
    """New CAB id for dst, externals remapped (old CAB lower -> new CAB), AssetBundle renamed; returns the SerializedFile."""
    cab = list(env.file.files.keys())[0]; sf = env.file.files[cab]; new = _cab(dst)
    env.file.files = {new: sf}
    ext_map = dict(ext_map or {}); ext_map[cab.lower()] = new
    for e in sf.externals:
        for oc, nc in ext_map.items():
            e.path = re.sub(re.escape(oc), nc, e.path, flags=re.I)
    return sf, new


def _save(env, out_dir, dst):
    data = env.file.save(packer="lz4")
    p = os.path.join(out_dir, *(dst + ".ab").split("/")); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(data)
    return p


def _bundle_obj(sf):
    return next(o for o in sf.objects.values() if o.type.name == "AssetBundle")


def _grow(mask, r):
    """Binary dilation by r px (square), separable, numpy only."""
    out = mask.copy()
    for axis in (0, 1):
        acc = out.copy()
        for d in range(1, r + 1):
            acc[tuple(slice(d, None) if i == axis else slice(None) for i in range(2))] |= out[tuple(slice(None, -d) if i == axis else slice(None) for i in range(2))]
            acc[tuple(slice(None, -d) if i == axis else slice(None) for i in range(2))] |= out[tuple(slice(d, None) if i == axis else slice(None) for i in range(2))]
        out = acc
    return out


def extra_page(rgba):
    """The <role>_Extra texture for one colour page (see DONOR_EXTRA). R marks the light regions (like Noel's: the
    brightest colours), G (inner line-art) is left empty, B is the silhouette grown by OUTLINE_R, A is the alpha."""
    a = rgba[..., 3]
    out = np.zeros_like(rgba)
    mx = rgba[..., :3].max(-1).astype(np.float32)
    out[..., 0] = (np.clip((mx - 160.0) / 64.0, 0, 1) * 255 * (a > 0)).astype(np.uint8)
    out[..., 2] = np.where(_grow(a > 0, OUTLINE_R), 255, 0).astype(np.uint8)
    out[..., 3] = a
    return out


def _sheet(bbmod, UnityPy, donor, dst, image, container, tag, out_dir, log):
    """One texture bundle: donor cloned to dst with its Texture2D replaced (format and settings kept). Cached by content."""
    buf = io.BytesIO(); image.save(buf, "PNG")
    h = hashlib.sha1(buf.getvalue() + dst.encode() + tag.encode()).hexdigest()[:20]
    cached = os.path.join(CACHE, "bundles", h + ".ab")
    outp = os.path.join(out_dir, *(dst + ".ab").split("/")); os.makedirs(os.path.dirname(outp), exist_ok=True)
    if os.path.exists(cached):
        import shutil; shutil.copyfile(cached, outp); return
    env = _env(bbmod, UnityPy, donor); sf, _ = _retarget(env, dst, None)
    leaf = dst.rsplit("/", 1)[1]
    for o in list(sf.objects.values()):
        if o.type.name == "Texture2D":
            d = o.read(); d.m_Name = leaf
            d.set_image(image.convert("RGBA"), target_format=d.m_TextureFormat); d.save()
        elif o.type.name == "AssetBundle":
            t = o.read_typetree(); t["m_Name"] = dst + ".ab"; t["m_AssetBundleName"] = dst + ".ab"
            t["m_Container"] = [[container, v] for _, v in t["m_Container"]]
            o.save_typetree(t)
    p = _save(env, out_dir, dst)
    os.makedirs(os.path.dirname(cached), exist_ok=True); import shutil; shutil.copyfile(p, cached)
    log("  sheet %s encoded" % dst)


def _family(bbmod, UnityPy, donor, fam, name, sheets, out_dir):
    env = _env(bbmod, UnityPy, donor); sf, _ = _retarget(env, fam, None)
    for o in list(sf.objects.values()):
        if o.type.name == "MonoBehaviour":
            t = o.read_typetree(); t["m_Name"] = name
            t["textureRefs"] = [dict(zip(("_guid0", "_guid1"), struct.unpack("<QQ", bytes.fromhex(_guid(s))))) for s in sheets]
            t["Name2Range"] = []   # only used to warm up / unload groups by name; lookups are by index
            o.save_typetree(t)
        elif o.type.name == "AssetBundle":
            t = o.read_typetree(); t["m_Name"] = fam + ".ab"; t["m_AssetBundleName"] = fam + ".ab"
            t["m_Container"] = [["Assets/AssetBundle/Actor/TextureFamily/%s.asset" % fam.rsplit("/", 1)[1], v] for _, v in t["m_Container"]]
            o.save_typetree(t)
    _save(env, out_dir, fam)


def build_rig(src, clips, out_dir, role, skin="01", log=print):
    """clips: {clip name: [(sprite, ticks), ...]}. Writes every bundle into out_dir and returns manifest additions
    {names, entries: [(bundle, [dep bundles])], guids: [(bundle, guidhex)]}."""
    bbmod, UnityPy = _unity()
    sprites = sorted({s for seq in clips.values() for s, _ in seq} | {"null"})
    cdir, meta = build_frames(src, sprites)
    fr = meta["frames"]
    missing = [s for s in sprites if s not in fr]
    if missing:   # sprites that aren't in the character's archives play as invisible frames, so timing is kept
        log("  %d sprites not found, shown as invisible frames: %s" % (len(missing), missing[:6]))
    clips = {n: [(s if s in fr else "null", t) for s, t in seq] for n, seq in clips.items()}
    adds = {"names": [], "entries": [], "guids": []}
    scale = src.scale

    # sheets: BC7 pages, encoded once per page image (cache in local_only, never in tools/)
    sheet_names = []
    extra_names = []
    for i in range(meta["pages"]):
        dst = "actor/sprite/%s/%s/%s_page_%02d" % (role, skin, role, i)
        page = Image.open(os.path.join(cdir, "page_%02d.png" % i)).convert("RGBA")
        leaf = dst.rsplit("/", 1)[1]
        # the sprite material blends premultiplied (SpritePalette: _BlendSrc One, _BlendDst OneMinusSrcAlpha) with the
        # alpha from _Extra, so the colour must be premultiplied too (stock sheets are black where transparent)
        pa = np.array(page).astype(np.uint16)
        pa[..., :3] = pa[..., :3] * pa[..., 3:4] // 255
        colour = Image.fromarray(pa.astype(np.uint8), "RGBA")
        _sheet(bbmod, UnityPy, DONOR_SHEET, dst, colour, "Assets/AssetBundle/Actor/Sprite/%s/%s/%s.png" % (role, skin, leaf), "sheet-v2-premul", out_dir, log)
        sheet_names.append(dst)
        adds["names"].append(dst); adds["entries"].append((dst, [])); adds["guids"].append((dst, _guid(dst)))
        xd = "actor/sprite/%s/extra/%s_page_%02d" % (role, role, i)
        # a source may derive its own Extra (Nine's CF layer: her BBEE channels per palette index); default: extra_page
        _sheet(bbmod, UnityPy, DONOR_EXTRA, xd, Image.fromarray((getattr(src, "extra_page", None) or extra_page)(np.array(page))),
               "Assets/AssetBundle/Actor/Sprite/%s/Extra/%s_page_%02d.png" % (role, role, i), "extra-v1", out_dir, log)
        extra_names.append(xd)
        adds["names"].append(xd); adds["entries"].append((xd, [])); adds["guids"].append((xd, _guid(xd)))
    # Extra2 (glow lines): none of her art glows, so one small blank texture serves every page
    x2 = "actor/sprite/%s/extra2/%s_blank" % (role, role)
    _sheet(bbmod, UnityPy, DONOR_EXTRA2, x2, Image.new("RGBA", (64, 64), (0, 0, 0, 255)),
           "Assets/AssetBundle/Actor/Sprite/%s/Extra2/%s_blank.png" % (role, role), "extra2-v1", out_dir, log)
    adds["names"].append(x2); adds["entries"].append((x2, [])); adds["guids"].append((x2, _guid(x2)))
    for fam, name, sheets in (("actor/texturefamily/%s_extra" % role, "%s_Extra" % role, extra_names),
                              ("actor/texturefamily/%s_extra2" % role, "%s_Extra2" % role, [x2] * len(extra_names))):
        _family(bbmod, UnityPy, DONOR_FAMILY_EXTRA, fam, name, sheets, out_dir)
        adds["names"].append(fam); adds["entries"].append((fam, []))

    # texture family
    fam = "actor/texturefamily/%s_%s" % (role, skin)
    env = _env(bbmod, UnityPy, DONOR_FAMILY); sf, _ = _retarget(env, fam, None)
    for o in list(sf.objects.values()):
        if o.type.name == "MonoBehaviour":
            t = o.read_typetree(); t["m_Name"] = "%s_%s" % (role, skin)
            t["textureRefs"] = [dict(zip(("_guid0", "_guid1"), struct.unpack("<QQ", bytes.fromhex(_guid(s))))) for s in sheet_names]
            o.save_typetree(t)
        elif o.type.name == "AssetBundle":
            t = o.read_typetree(); t["m_Name"] = fam + ".ab"; t["m_AssetBundleName"] = fam + ".ab"
            t["m_Container"] = [["Assets/AssetBundle/Actor/TextureFamily/%s_%s.asset" % (role, skin), v] for _, v in t["m_Container"]]
            o.save_typetree(t)
    _save(env, out_dir, fam); adds["names"].append(fam); adds["entries"].append((fam, []))

    # mesh groups: every clip's frames live in ONE mesh bundle (stock clips have exactly one mesh external)
    groups = []   # [(set of sprites, [clip names])]
    for name, seq in clips.items():
        need = {s for s, _ in seq if s in fr}
        for g in groups:
            if len(g[0] | need) <= BODY_CAP:
                g[0].update(need); g[1].append(name); break
        else:
            groups.append((set(need), [name]))
    mesh_pid = {}   # (group bundle, sprite) -> path id
    clip_group = {}
    for gi, (need, names) in enumerate(groups):
        dst = "actor/mesh/%s/g%d" % (role, gi)
        donor = next(d for d, cap in MESH_DONORS if cap >= len(need))
        env = _env(bbmod, UnityPy, donor); sf, _ = _retarget(env, dst, None)
        meshes = [pid for pid, o in sf.objects.items() if o.type.name == "Mesh"]
        keep = dict(zip(sorted(need), meshes))
        for pid in meshes[len(keep):]:
            del sf.objects[pid]
        for s, pid in keep.items():
            o = sf.objects[pid]; t = o.read_typetree()
            f = fr[s]
            v, idx = quad_mesh(f["anchor"], f["size"], f["place"], scale * src.mul(s))
            ch = [(c["offset"], c["format"], c["dimension"]) for c in t["m_VertexData"]["m_Channels"] if c["dimension"]]
            assert ch == [(0, 0, 3), (12, 0, 4)], ch
            t["m_Name"] = s
            t["m_VertexData"]["m_VertexCount"] = 4
            t["m_VertexData"]["m_DataSize"] = v.tobytes()
            t["m_IndexFormat"] = 0
            t["m_IndexBuffer"] = list(np.array(idx, np.uint16).tobytes())
            lo, hi = v[:, :3].min(0), v[:, :3].max(0)
            aabb = {"m_Center": dict(zip("xyz", map(float, (lo + hi) / 2))), "m_Extent": dict(zip("xyz", map(float, (hi - lo) / 2)))}
            t["m_SubMeshes"] = [{"firstByte": 0, "indexCount": 6, "topology": 0, "baseVertex": 0, "firstVertex": 0, "vertexCount": 4, "localAABB": aabb}]
            t["m_LocalAABB"] = aabb
            o.save_typetree(t)
            mesh_pid[(dst, s)] = pid
        ab = _bundle_obj(sf); t = ab.read_typetree()
        rest = [pid for pid, o in sf.objects.items() if o.type.name != "AssetBundle"]
        t["m_PreloadTable"] = [{"m_FileID": 0, "m_PathID": pid} for pid in rest]
        asset = "Assets/AssetBundle/Actor/Mesh/%s/g%d.asset" % (role, gi)
        t["m_Container"] = [[asset, {"preloadIndex": 0, "preloadSize": len(rest), "asset": {"m_FileID": 0, "m_PathID": pid}}] for pid in rest]
        t["m_Name"] = dst + ".ab"; t["m_AssetBundleName"] = dst + ".ab"
        ab.save_typetree(t)
        for o in sf.objects.values():
            if o.type.name == "MonoBehaviour":
                mt = o.read_typetree(); mt["m_Name"] = "g%d" % gi; o.save_typetree(mt)
        _save(env, out_dir, dst); adds["names"].append(dst); adds["entries"].append((dst, []))
        for n in names:
            clip_group[n] = dst
        log("  mesh bundle %s: %d frames (donor %s)" % (dst, len(keep), donor))

    # clips
    names_m, entries_m, _ = __import__("bbchar").read_manifest()
    ni = {n: i for i, n in enumerate(names_m)}
    donor_deps = [names_m[int(d, 16)] for d in next(d for i, d in entries_m if int(i, 16) == ni[DONOR_CLIP])]
    for name, seq in clips.items():
        if not seq:
            continue
        dst = "actor/animation/role/%s" % name.lower()
        mg = clip_group[name]
        env = _env(bbmod, UnityPy, DONOR_CLIP)
        cab = list(env.file.files.keys())[0]; sf0 = env.file.files[cab]
        mb = next(o for o in sf0.objects.values() if o.type.name == "MonoBehaviour")
        t0 = mb.read_typetree(); mfid = t0["Frames"][0]["mesh"]["m_FileID"]
        old_mesh_cab = sf0.externals[mfid - 1].path.split("/")[-1]
        sf, _ = _retarget(env, dst, None, {old_mesh_cab.lower(): _cab(mg)})
        t = t0
        t["m_Name"] = name
        frames, ends, tick = [], [], 0
        for s, ticks in seq:
            frames.append({"mesh": {"m_FileID": mfid, "m_PathID": mesh_pid[(mg, s)]}, "textureIdx": fr[s]["place"][0], "mountPoints": []})
            tick += max(1, int(ticks)); ends.append(tick - 1)
        t["Frames"] = frames; t["Indeces"] = ends; t["TotalFrameCount"] = tick
        t["Context"]["AnimationRoleName"] = role
        mb.save_typetree(t)
        ab = _bundle_obj(sf); at = ab.read_typetree()
        script_pid = t["m_Script"]["m_PathID"]
        pre = [{"m_FileID": 0, "m_PathID": script_pid}, {"m_FileID": 0, "m_PathID": mb.path_id}]
        pre += [p for p in at["m_PreloadTable"] if p["m_FileID"] not in (0, mfid)]              # the material
        pre += [{"m_FileID": mfid, "m_PathID": pid} for pid in sorted({f["mesh"]["m_PathID"] for f in frames})]
        at["m_PreloadTable"] = pre
        at["m_Container"] = [["Assets/AssetBundle/Actor/Animation/Role/%s.asset" % name, {"preloadIndex": 0, "preloadSize": len(pre), "asset": {"m_FileID": 0, "m_PathID": mb.path_id}}]]
        at["m_Name"] = dst + ".ab"; at["m_AssetBundleName"] = dst + ".ab"
        at["m_Dependencies"] = [d if d.lower() != old_mesh_cab.lower() else _cab(mg).lower() for d in at["m_Dependencies"]]
        ab.save_typetree(at)
        _save(env, out_dir, dst)
        adds["names"].append(dst)
        adds["entries"].append((dst, [mg if d.startswith("actor/mesh/") else d for d in donor_deps]))
    log("  %d clips, %d sheets, %d mesh bundles" % (len(clips), len(sheet_names), len(groups)))
    return adds


def _deps(logical):
    names, entries, _ = __import__("bbchar").read_manifest()
    ni = {n: i for i, n in enumerate(names)}
    return [names[int(d, 16)] for d in next(d for i, d in entries if int(i, 16) == ni[logical])]


def clone_texture(src, dst, renames, image, out_dir, log=print):
    """One UI texture bundle: a stock donor (src) cloned to dst with its Texture2D replaced by `image` (PIL RGBA, any
    size; the donor's format is kept) and names / container renamed by `renames` [(old, new)]. The encoded bundle is
    cached in the local folder's cache/bundles (it holds imported art). Returns manifest additions."""
    bbmod, UnityPy = _unity()
    buf = io.BytesIO(); image.save(buf, "PNG")
    h = hashlib.sha1(buf.getvalue() + repr((src, dst, renames, "tex-v1")).encode()).hexdigest()[:20]
    cached = os.path.join(CACHE, "bundles", h + ".ab")
    outp = os.path.join(out_dir, *(dst + ".ab").split("/")); os.makedirs(os.path.dirname(outp), exist_ok=True)
    def ren(v):
        for a, b in renames: v = re.sub(re.escape(a), b, v, flags=re.I)
        return v
    if os.path.exists(cached):
        import shutil; shutil.copyfile(cached, outp)
    else:
        env = _env(bbmod, UnityPy, src); sf, _ = _retarget(env, dst, None)
        for o in list(sf.objects.values()):
            if o.type.name == "Texture2D":
                d = o.read(); d.m_Name = ren(d.m_Name); d.set_image(image.convert("RGBA"), target_format=d.m_TextureFormat); d.save()
            elif o.type.name == "Sprite":
                d = o.read(); d.m_Name = ren(d.m_Name); d.save()
            elif o.type.name == "AssetBundle":
                t = o.read_typetree(); t["m_Name"] = dst + ".ab"
                if t.get("m_AssetBundleName"): t["m_AssetBundleName"] = dst + ".ab"
                t["m_Container"] = [[ren(k), v] for k, v in t["m_Container"]]
                o.save_typetree(t)
        p = _save(env, out_dir, dst)
        os.makedirs(os.path.dirname(cached), exist_ok=True); import shutil; shutil.copyfile(p, cached)
        log("  texture %s (%dx%d)" % (dst, image.width, image.height))
    return {"names": [dst], "entries": [(dst, _deps(src))], "guids": []}


def clone_atlas(src, dst, renames, sprites, out_dir, log=print):
    """A HUD atlas (one Texture2D page + quad Sprites, like ui/atlas/iconpotential<actor>): the donor page is redrawn
    blank, each (sprite name, PIL image) is fitted into one donor sprite rect (in rect order) and takes that name.
    The C# battle HUD loads sprites from real atlases only. Returns manifest additions."""
    bbmod, UnityPy = _unity()
    env = _env(bbmod, UnityPy, src); sf, _ = _retarget(env, dst, None)
    sprs = [o for o in sf.objects.values() if o.type.name == "Sprite"]
    rects = sorted(((o.read().m_Rect, o.path_id) for o in sprs), key=lambda rp: (-rp[0].y, rp[0].x))
    if len(sprites) > len(rects): raise SystemExit("atlas %s has %d sprites, %d requested" % (src, len(rects), len(sprites)))
    tex = next(o for o in sf.objects.values() if o.type.name == "Texture2D").read()
    page = Image.new("RGBA", (tex.m_Width, tex.m_Height), (0, 0, 0, 0)); names = {}
    for (r, pid), (nm, im) in zip(rects, sprites):
        w, hh = int(round(r.width)), int(round(r.height))
        ic = im.convert("RGBA").resize((w, hh), Image.LANCZOS)
        page.paste(ic, (int(round(r.x)), tex.m_Height - int(round(r.y)) - hh), ic); names[pid] = nm
    def ren(v):
        for a, b in renames: v = re.sub(re.escape(a), b, v, flags=re.I)
        return v
    for o in list(sf.objects.values()):
        if o.type.name == "Texture2D":
            d = o.read(); d.m_Name = ren(d.m_Name); d.set_image(page, target_format=d.m_TextureFormat); d.save()
        elif o.type.name == "Sprite":
            d = o.read(); d.m_Name = names.get(o.path_id) or ren(d.m_Name); d.save()
        elif o.type.name == "AssetBundle":
            t = o.read_typetree(); t["m_Name"] = dst + ".ab"
            if t.get("m_AssetBundleName"): t["m_AssetBundleName"] = dst + ".ab"
            t["m_Container"] = [[ren(k), v] for k, v in t["m_Container"]]
            o.save_typetree(t)
    _save(env, out_dir, dst)
    log("  atlas %s (%d sprites)" % (dst, len(sprites)))
    return {"names": [dst], "entries": [(dst, _deps(src))], "guids": []}


def render_clip(out_dir, role, skin, clip, ppu=150):
    """Render a BUILT clip from out_dir (reads our own bundles back) -> list of (RGBA image, origin)."""
    bbmod, UnityPy = _unity()
    load = lambda logical: UnityPy.load(open(os.path.join(out_dir, *(logical + ".ab").split("/")), "rb").read())
    e = load("actor/animation/role/" + clip.lower())
    mb = next(o for o in e.objects if o.type.name == "MonoBehaviour").read_typetree()
    sf = list(e.file.files.values())[0]
    fam = next(o for o in load("actor/texturefamily/%s_%s" % (role, skin)).objects if o.type.name == "MonoBehaviour").read_typetree()
    pages = []
    for r in fam["textureRefs"]:
        g = struct.pack("<QQ", r["_guid0"], r["_guid1"]).hex()
        i = next(k for k in range(64) if _guid("actor/sprite/%s/%s/%s_page_%02d" % (role, skin, role, k)) == g)
        te = load("actor/sprite/%s/%s/%s_page_%02d" % (role, skin, role, i))
        pages.append(next(o for o in te.objects if o.type.name == "Texture2D").read().image.convert("RGBA"))
    cabs = {}
    for f in mb["Frames"]:
        cab = sf.externals[f["mesh"]["m_FileID"] - 1].path.split("/")[-1]
        cabs.setdefault(cab, None)
    meshes = {}
    for root, _, files in os.walk(os.path.join(out_dir, "actor", "mesh", role)):
        for fn in files:
            me = UnityPy.load(open(os.path.join(root, fn), "rb").read())
            for o in me.objects:
                if o.type.name == "Mesh":
                    t = o.read_typetree()
                    meshes[o.path_id] = np.frombuffer(bytes(t["m_VertexData"]["m_DataSize"]), np.float32).reshape(-1, 7)
    out = []
    for f in mb["Frames"]:
        v = meshes[f["mesh"]["m_PathID"]]; pg = pages[f["textureIdx"]]; W, H = pg.size
        u0, u1 = v[:, 3].min() * W, v[:, 3].max() * W
        t0, t1 = (1 - v[:, 4].max()) * H, (1 - v[:, 4].min()) * H
        crop = pg.crop((int(round(u0)), int(round(t0)), int(round(u1)), int(round(t1))))
        x0, x1, y0, y1 = v[:, 0].min(), v[:, 0].max(), v[:, 1].min(), v[:, 1].max()
        img = crop.resize((max(1, int(round((x1 - x0) * ppu))), max(1, int(round((y1 - y0) * ppu)))))
        out.append((img, (int(round(-x0 * ppu)), int(round(y1 * ppu)))))
    return out, mb


def main():
    a = sys.argv[1:]
    if a and a[0] == "frames":
        src = Source("rrb")
        out = os.path.join(LOCAL, "bbtag", "_frames"); os.makedirs(out, exist_ok=True)
        for s in a[1:]:
            arr, anc = src.frame(s)
            Image.fromarray(arr, "RGBA").save(os.path.join(out, s + ".png")); print(s, arr.shape, "anchor", anc)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
