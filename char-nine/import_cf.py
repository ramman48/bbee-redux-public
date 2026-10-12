"""import_cf.py -- Nine's Centralfiction layer: a build-time importer (bbmod runs it through content.importers).

It always runs and always produces the same clip names (cf_clips.py), so her moves never change:
  CF layer   when the player owns BlazBlue Centralfiction (Steam app 586140, asked through BBEE's own Valve-signed
             Steamworks library, never BBCF's) and has it installed: her CF animations (Flame Punisher's UltimateShot)
             are built from that install onto her own role "ninx". The colours and the extra texture channels come
             from her BBEE frames per CF palette index, so the new frames match her BBEE ones exactly.
  fallback   otherwise: the same clips spliced from her BBEE boss rig (the player's own BBEE install), same length and
             phases; the "ninx" texture families are clones of her BBEE ones so the preload list stays valid.
Nothing it produces is stored in the mod folder: a package of this mod never carries CF or BBEE material.

usage (bbmod calls it):  python mods/char-nine/import_cf.py --out <build folder> --adds <json path>
    --mode auto|cf|fallback   (default auto; "cf" fails instead of falling back: for checking the CF path)
nine_cf.json      {"enabled": false} builds the fallback even when CF is owned (the player's choice)
The Centralfiction ownership check always runs: there is no switch to skip it.
"""
import argparse, hashlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
for p in (os.path.join(ROOT, "tools", "bbtag"), os.path.join(ROOT, "tools", "bbcf"), ROOT, HERE):
    if p not in sys.path:
        sys.path.insert(0, p)
import numpy as np
import cf_clips as K

BBCF_APPID = 586140
CACHE = os.path.join(ROOT, "local_only", "cache")
SCALE = 1.0 / 230
PAL_VERSION = "pal-v1"


def log(*a):
    print("Nine CF layer:", *a)


def _json(path):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def cf_available(mode):
    """-> (use CF, reason)."""
    if mode == "fallback":
        return False, "fallback requested"
    if _json(os.path.join(ROOT, "local_only", "nine_cf.json")).get("enabled") is False:
        return False, "turned off in local_only/nine_cf.json"
    import bbcf_read
    if not os.path.exists(bbcf_read.path("Char/char_ph_img.pac")):
        return False, "BlazBlue Centralfiction not found at %s (set BBCF_DIR)" % bbcf_read.BBCF
    import bbtag_owner
    try:
        owned = bbtag_owner.subscribed({BBCF_APPID: "BlazBlue Centralfiction"})[BBCF_APPID][1]
    except RuntimeError as e:
        return False, "the ownership check could not run (%s)" % e
    return (True, "BlazBlue Centralfiction is owned") if owned else (False, "BlazBlue Centralfiction is not owned on this Steam account")




IDX = np.zeros((256, 4), np.uint8); IDX[:, 0] = np.arange(256); IDX[:, 3] = 255; IDX[0, 3] = 0


def cf_index(ch, F, s):
    """CF sprite -> (index image RGBA with R = palette index, A = coverage; root (x, y)), layer 0, trimmed."""
    h = F.hip(ch.img[s + ".hip"]); j = F.jonbin(ch.col[s + ".jonbin"])
    chunks = [c for c in j["chunks"] if c["layer"] == 0]
    if any(c["src"][2] < 0 or c["dst"][2] < 0 for c in chunks):
        raise NotImplementedError(s + ": mirrored chunks")
    a, (ox, oy) = F.compose(h, dict(j, chunks=chunks), IDX)
    ys, xs = np.where(a[..., 3] > 0)
    if not len(ys):
        return None, None
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (ox - xs.min(), oy - ys.min())


def bbee_palette(ch, F):
    """{index: (r, g, b, extraR, extraG)} read from her BBEE frames that are the same drawing as a CF sprite (PAIRS).
    Interior pixels (all 8 neighbours share the index) are exact; indices only seen at edges use their median."""
    import bbmod
    key = hashlib.sha1(json.dumps([PAL_VERSION, bbmod.game_build(), K.PAIRS]).encode()).hexdigest()[:16]
    cp = os.path.join(CACHE, "nine_cf_palette_%s.json" % key)
    if os.path.exists(cp):
        return {int(k): v for k, v in json.load(open(cp)).items()}
    from PIL import Image, ImageDraw
    import animview as A
    mesh = A.meshes("ph"); ex = A.sheets("ph", "extra"); co = A.sheets("ph", "02")
    acc_i, acc_e = {}, {}
    for clip, fi, s in K.PAIRS:
        fr = A.clip(clip)["Frames"][fi]; v, vt, f = mesh[fr["mesh"]["m_PathID"]]
        E = np.array(ex[fr["textureIdx"]]); C_ = np.array(co[fr["textureIdx"]]); H, W = E.shape[:2]
        uv = np.column_stack([vt[:, 0] * W, (1 - vt[:, 1]) * H])
        flip = np.polyfit(uv[:, 0], v[:, 0], 1)[0] < 0
        x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
        mk = Image.new("L", (x1 - x0, y1 - y0), 0); dr = ImageDraw.Draw(mk)
        for tri in f:
            dr.polygon([tuple(p) for p in uv[tri] - [x0, y0]], fill=255)
        mk = np.array(mk)[..., None] > 0
        e = E[y0:y1, x0:x1] * mk; c = C_[y0:y1, x0:x1] * mk
        if flip:
            e = e[:, ::-1]; c = c[:, ::-1]
        a, _ = cf_index(ch, F, s)
        cm = a[..., 3] > 0; ci = a[..., 0].astype(int)
        ey, exx = np.where(e[..., 3] > 128)
        e = e[ey.min():, exx.min():]; c = c[ey.min():, exx.min():]
        h_, w_ = min(e.shape[0], cm.shape[0]), min(e.shape[1], cm.shape[1])
        e, c, cm, ci = e[:h_, :w_], c[:h_, :w_], cm[:h_, :w_], ci[:h_, :w_]
        agree = ((e[..., 3] > 128) == cm).mean()
        if agree < 0.999:
            raise RuntimeError("%s frame %d is not %s (pixel agreement %.4f): has BBEE's rig changed?" % (clip, fi, s, agree))
        same = np.ones_like(cm)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                same &= np.roll(np.roll(ci, dy, 0), dx, 1) == ci
        solid = cm & (e[..., 3] == 255)
        for sel, acc in ((solid & same, acc_i), (solid, acc_e)):
            vals = np.concatenate([c[..., :3][sel], e[..., :2][sel]], 1).astype(int)
            for i, row in zip(ci[sel], vals):
                acc.setdefault(int(i), []).append(row)
    pal = {}
    for i in set(acc_i) | set(acc_e):
        rows = np.array(acc_i.get(i) or acc_e[i])
        pal[i] = [int(x) for x in np.median(rows, 0)]
    os.makedirs(CACHE, exist_ok=True)
    json.dump(pal, open(cp, "w"))
    log("her BBEE palette: %d indices (%d exact, %d from edges)" % (len(pal), len(acc_i), len(pal) - len(acc_i)))
    return pal


class CFSource:
    """bbtag_rig.build_rig's sprite source for her CF sprites: coloured with her BBEE palette, placed like her BBEE
    frames (1/230 u a pixel, the art 5 px higher) and mirrored (CF draws her facing left, BBEE's world faces right;
    her BBEE sheets hold the mirrored drawings, checked pixel for pixel on ph000_00)."""

    def __init__(self, ch, F, pal):
        self.ch, self.F = ch, F
        cfpal = F.hpl(ch_pal(ch))
        full = {}
        for i in range(1, 256):
            if i in pal:
                full[i] = list(pal[i])
            else:
                j = min(pal, key=lambda k: int(np.abs(cfpal[k, :3].astype(int) - cfpal[i, :3].astype(int)).sum()))
                full[i] = list(pal[j])

        seen = {}
        for i in sorted(full):
            r, g, b = full[i][:3]
            while (r, g, b) in seen and seen[(r, g, b)] != tuple(full[i][3:]):
                b = b + 1 if b < 255 else b - 1
            seen[(r, g, b)] = tuple(full[i][3:]); full[i][:3] = [r, g, b]
        self.lut = np.zeros((256, 4), np.uint8)
        for i, v in full.items():
            self.lut[i] = (v[0], v[1], v[2], 255)
        self.lut[0] = 0
        keys = np.array([(r << 16) | (g << 8) | b for (r, g, b) in seen], np.int64)
        order = np.argsort(keys)
        self.keys = keys[order]; self.ext = np.array(list(seen.values()), np.uint8)[order]
        self.code = "ph_cf"
        self.palette = "bbee02m-" + hashlib.sha1(self.lut.tobytes()).hexdigest()[:10]
        self.scale = SCALE

    def mul(self, sprite):
        return 1.0

    def frame(self, sprite):
        if sprite == "null":
            return np.zeros((2, 2, 4), np.uint8), (1, 1)
        try:
            a, (ax, ay) = cf_index(self.ch, self.F, sprite)
        except (KeyError, NotImplementedError) as e:
            log("sprite %s unavailable (%s): an invisible frame" % (sprite, e))
            return None
        if a is None:
            return np.zeros((2, 2, 4), np.uint8), (1, 1)
        rgba = self.lut[a[..., 0]]
        rgba[..., 3] = np.where(a[..., 3] > 0, 255, 0)

        return rgba[:, ::-1].copy(), (rgba.shape[1] - ax, ay + K.ROOT_LIFT_PX)

    def extra_page(self, page):
        """Her BBEE Extra channels for a packed page: R light mask and G line art per palette index, B = the silhouette
        grown by a 5 px disc, A = alpha."""
        a = page[..., 3] > 0
        key = (page[..., 0].astype(np.int64) << 16) | (page[..., 1].astype(np.int64) << 8) | page[..., 2].astype(np.int64)
        pos = np.clip(np.searchsorted(self.keys, key), 0, len(self.keys) - 1)
        hit = a & (self.keys[pos] == key)
        out = np.zeros_like(page)
        out[..., 0] = np.where(hit, self.ext[pos, 0], 0)
        out[..., 1] = np.where(hit, self.ext[pos, 1], 0)
        out[..., 2] = np.where(disc_grow(a, K.OUTLINE_R), 255, 0)
        out[..., 3] = page[..., 3]
        miss = int((a & ~hit).sum())
        if miss:
            log("extra page: %d pixels with a colour outside her palette" % miss)
        return out


def ch_pal(ch):
    import bbcf_read
    return bbcf_read.files("Char/char_ph_pal.pac")["ph00_00.hpl"]


def disc_grow(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r or (dx == 0 and dy == 0):
                continue
            sh = np.zeros_like(m)
            ys = slice(max(dy, 0), m.shape[0] + min(dy, 0)); yd = slice(max(-dy, 0), m.shape[0] + min(-dy, 0))
            xs = slice(max(dx, 0), m.shape[1] + min(dx, 0)); xd = slice(max(-dx, 0), m.shape[1] + min(-dx, 0))
            sh[ys, xs] = m[yd, xd]
            out |= sh
    return out


def build_cf(out):
    import bbcf_read, bbtag_formats as F, bbtag_rig
    ch = bbcf_read.Character("ph")
    pal = bbee_palette(ch, F)
    src = CFSource(ch, F, pal)
    return bbtag_rig.build_rig(src, K.CF, out, K.ROLE, K.SKIN, log=lambda *a: log(*a))




def build_fallback(out):
    import bbtag_rig as R, bbchar
    bbmod, UnityPy = R._unity()
    import animview as A
    adds = {"names": [], "entries": [], "guids": []}
    names_m, entries_m, _ = bbchar.read_manifest()
    ni = {n: i for i, n in enumerate(names_m)}

    def deps(logical):
        return [names_m[int(d, 16)] for d in next(d for i, d in entries_m if int(i, 16) == ni[logical])]

    def mesh_cab(clip):
        e = A.env_of("actor/animation/role/%s" % clip.lower()); sf = list(e.file.files.values())[0]
        fid = A.clip(clip)["Frames"][0]["mesh"]["m_FileID"]
        return sf.externals[fid - 1].path.split("/")[-1].lower()

    want = R._cab(K.FALLBACK_MESH).lower()
    for name, seq in K.FALLBACK.items():
        dclip = getattr(K, "FALLBACK_DONORS", {}).get(name, K.FALLBACK_DONOR)
        donor = "actor/animation/role/%s" % dclip.lower()
        env = R._env(bbmod, UnityPy, donor)
        sf, _ = R._retarget(env, "actor/animation/role/%s" % name, None)
        mb = next(o for o in sf.objects.values() if o.type.name == "MonoBehaviour")
        t = mb.read_typetree()
        mfid = t["Frames"][0]["mesh"]["m_FileID"]
        frames, ends, tick = [], [], 0
        for clip, i, ticks in seq:
            cab = mesh_cab(clip)
            if cab != mesh_cab(dclip):
                raise SystemExit("fallback %s: %s uses mesh bundle %s, not the donor's" % (name, clip, cab))
            fr = dict(A.clip(clip)["Frames"][i]); fr["mesh"] = {"m_FileID": mfid, "m_PathID": fr["mesh"]["m_PathID"]}
            frames.append(fr); tick += ticks; ends.append(tick - 1)
        t["m_Name"] = name; t["Frames"] = frames; t["Indeces"] = ends; t["TotalFrameCount"] = tick
        mb.save_typetree(t)
        ab = R._bundle_obj(sf); at = ab.read_typetree()
        pre = [{"m_FileID": 0, "m_PathID": t["m_Script"]["m_PathID"]}, {"m_FileID": 0, "m_PathID": mb.path_id}]
        pre += [p for p in at["m_PreloadTable"] if p["m_FileID"] not in (0, mfid)]
        pre += [{"m_FileID": mfid, "m_PathID": pid} for pid in sorted({f["mesh"]["m_PathID"] for f in frames})]
        dst = "actor/animation/role/%s" % name
        at["m_PreloadTable"] = pre
        at["m_Container"] = [["Assets/AssetBundle/Actor/Animation/Role/%s.asset" % name,
                              {"preloadIndex": 0, "preloadSize": len(pre), "asset": {"m_FileID": 0, "m_PathID": mb.path_id}}]]
        at["m_Name"] = dst + ".ab"; at["m_AssetBundleName"] = dst + ".ab"
        ab.save_typetree(at)
        R._save(env, out, dst)
        adds["names"].append(dst); adds["entries"].append((dst, deps(donor)))
        log("fallback clip %s: %d frames, %d ticks, from her BBEE rig (donor %s)" % (name, len(frames), tick, dclip))

    for src_, dst_, nm in (("ph_02", "ninx_02", "ninx_02"), ("ph_extra", "ninx_extra", "ninx_Extra"), ("ph_extra2", "ninx_extra2", "ninx_Extra2")):
        fam = "actor/texturefamily/" + dst_
        env = R._env(bbmod, UnityPy, "actor/texturefamily/" + src_); sf, _ = R._retarget(env, fam, None)
        for o in list(sf.objects.values()):
            if o.type.name == "MonoBehaviour":
                tt = o.read_typetree(); tt["m_Name"] = nm; o.save_typetree(tt)
            elif o.type.name == "AssetBundle":
                tt = o.read_typetree(); tt["m_Name"] = fam + ".ab"; tt["m_AssetBundleName"] = fam + ".ab"
                tt["m_Container"] = [["Assets/AssetBundle/Actor/TextureFamily/%s.asset" % dst_, v] for _, v in tt["m_Container"]]
                o.save_typetree(tt)
        R._save(env, out, fam); adds["names"].append(fam); adds["entries"].append((fam, deps("actor/texturefamily/" + src_)))
    return adds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--adds", required=True)
    ap.add_argument("--mode", choices=["auto", "cf", "fallback"], default="auto")
    a = ap.parse_args()
    K.check()
    use, why = cf_available(a.mode)
    adds = None
    if use:
        log("building from Centralfiction (%s)" % why)
        try:
            adds = build_cf(a.out)
        except Exception as e:
            if a.mode == "cf":
                raise
            log("the CF build failed (%s: %s); using her BBEE frames instead" % (type(e).__name__, e))
    else:
        if a.mode == "cf":
            sys.exit("Nine CF layer: " + why)
        log("using her BBEE frames (%s)" % why)
    if adds is None:
        adds = build_fallback(a.out)
        use = False

    import cf_fx
    fx = None
    if not cf_fx.CF_FLIPBOOKS:
        fx = {"names": [], "entries": [], "guids": []}
    elif use:
        try:
            import bbvfx
            tmp = a.adds + ".fx.json"
            bbvfx.do_import(cf_fx.FX_DIR, a.out, tmp)
            fx = json.load(open(tmp)); os.remove(tmp)
            deps = next(d for n, d in fx["entries"] if n == cf_fx.TEMPLATE["prefab"])
            r = cf_fx.build(a.out, deps)
            for k in fx: fx[k] += r[k]
            log("CF effects: %d bundles (Mauvette Roar from vr_ph401 + ph401_cutin)" % len(fx["names"]))
        except Exception as e:
            if a.mode == "cf":
                raise
            log("the CF effects failed (%s: %s); her BBEE fire instead" % (type(e).__name__, e)); fx = None
    if fx is None and cf_fx.CF_FLIPBOOKS:
        fx = cf_fx.build_fallback(a.out)
        log("fallback effects: Mauvette Roar plays her BBEE fire rush eruption")
    for k in adds: adds[k] += fx[k]
    json.dump(adds, open(a.adds, "w"), indent=1)
    log("done: %d bundles" % len(adds["names"]))


if __name__ == "__main__":
    main()
