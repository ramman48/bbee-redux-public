"""bbtag_mua.py -- Cross Tag Battle 3D effect models (.MUA): parser, animation, script driver and software renderer.

Research tool for the Cross Effect workstream. Reads the player's own BBTAG install (bbtag_read) and never writes
inside it; every render goes to the local folder's bbtag/_mua/ (imported art: never packaged, committed or shared).
Format notes (verified vs inferred): docs/cross-effect/research/MUA.md.

Where the models live: data/eff3d/eff3d_<code>.pac -> mdl.pac (FPAC) -> <name>.MUA; textures (DDS, DXT1/DXT5) in
data/eff3d/eff3d_<code>_img.pac. The effect script (data/char/char_<code>_scr.pac -> scr_<code>ea.bin) spawns a model
with command 4003 ("<name>.DIG" + 8 zero ints) and sets its scale, alpha, blend and palette colour.

usage:
  python tools/bbtag/bbtag_mua.py info    <model> [...]                    structure summary
  python tools/bbtag/bbtag_mua.py render  <model> [...] [options]          model alone, its own animation, white
  python tools/bbtag/bbtag_mua.py effect  <effect state> [...] [options]   script-driven: layers, timing, colours
  python tools/bbtag/bbtag_mua.py states  [code]                           which effect states spawn which models
options: --code rrb  --frames 0-19  --scale 3.8 (model units -> px; effect mode reads it from the script)
         --ppu 1.0 (output px per BBTAG px)  --pal 0 (palette number for effect colours)  --face-right (mirror)
         --cols 6  --bg 24,24,32  --out <file.png>
Output: contact sheets <local folder>/bbtag/_mua/<name>.png; `effect --frames-dir` also writes straight-alpha RGBA frames.
"""
import io, os, re, struct, sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bbtag_read as R
import bbscript_dump as BS

OUT = os.path.join(R.LOCAL, "_mua")


UNIT_PX = 2.2


MODEL_T0 = 1




SECTIONS = ("objects", "nodes", "meshes", "submeshes", "materials", "matmaps", "textures", "uvkeys", "tracks", "keys",
            "colourkeys", "sec11", "palettes", "vertices", "indices", "names", "strings")
RECORD = (32, 304, 192, 32, 80, 32, 16, 28, 16, 32, 32, 16, 32, 80, 2, 16, 1)


def _f(b, o, n):
    return np.frombuffer(b, "<f4", n, o).astype(np.float64)


def _i(b, o, n):
    return np.frombuffer(b, "<i4", n, o)


class Model:
    """A parsed MUA. Coordinates: model units, Y up, the camera looks down -Z at the XY plane (the fighting plane)."""

    def __init__(self, b, name=""):
        if b[:4] != b"MUA\0":
            raise ValueError("not a MUA file")
        self.name = name
        self.version, n = struct.unpack_from("<2I", b, 4)
        tab = [struct.unpack_from("<2I", b, 0x20 + 8 * i) for i in range(n)]
        self.sec = {SECTIONS[i]: tab[i] for i in range(min(n, len(SECTIONS)))}
        for i, (o, c) in enumerate(tab[:16]):
            end = tab[i + 1][0]
            if c and (end - o) != c * RECORD[i]:
                raise ValueError("section %s: %d bytes for %d records" % (SECTIONS[i], end - o, c))

        so = self.sec["strings"][0]
        no, nc = self.sec["names"]
        self.strings = []
        for k in range(nc):
            a, ln = struct.unpack_from("<2I", b, no + 16 * k)
            self.strings.append(b[so + a:so + a + ln].decode("latin1"))
        S = self.strings


        o, c = self.sec["objects"]
        self.objects = []
        for k in range(c):
            w = struct.unpack_from("<5i", b, o + 32 * k)
            self.objects.append(dict(root=w[0], count=w[1], blend_hint=w[3], flags=w[4] & 0xFFFFFFFF))




        o, c = self.sec["nodes"]
        self.nodes = []
        for k in range(c):
            p = o + 304 * k
            w = _i(b, p, 76); f = _f(b, p, 76)
            self.nodes.append(dict(
                name=S[w[0]] if w[0] < len(S) else "?", type=int(w[1]), T=f[2:5], E=f[5:8], S=f[8:11],
                id=int(w[14]), parent=int(w[15]), child=int(w[16]), sibling=int(w[17]),
                A=f[18:34].reshape(4, 4), B=f[34:50].reshape(4, 4), C=f[50:66].reshape(4, 4),
                anim=int(w[66]), tracks=[int(x) for x in w[67:71]]))

        o, c = self.sec["tracks"]
        self.tracks = [struct.unpack_from("<2I", b, o + 16 * k) for k in range(c)]
        o, c = self.sec["keys"]
        kv = _f(b, o, 8 * c).reshape(c, 8) if c else np.zeros((0, 8))
        kf = _i(b, o, 8 * c).reshape(c, 8)[:, 4] if c else np.zeros(0, int)
        self.keys = (kv[:, :4], kf.astype(np.float64))



        o, c = self.sec["meshes"]
        self.meshes = []
        for k in range(c):
            p = o + 192 * k
            w = _i(b, p, 48); f = _f(b, p, 48)
            self.meshes.append(dict(skeleton=int(round(f[0])), nsub=int(w[2]), sub0=int(w[3]), nvert=int(w[4]),
                                    vert0=int(w[5]), sphere=f[6:10], name=S[w[45]] if 0 <= w[45] < len(S) else "?",
                                    owner=int(w[46])))
        o, c = self.sec["submeshes"]
        self.submeshes = [dict(material=struct.unpack_from("<i", b, o + 32 * k)[0],
                               count=struct.unpack_from("<i", b, o + 32 * k + 4)[0],
                               start=struct.unpack_from("<i", b, o + 32 * k + 8)[0]) for k in range(c)]


        o, c = self.sec["materials"]
        mo, mc = self.sec["matmaps"]
        self.materials = []
        for k in range(c):
            w = _i(b, o + 80 * k, 20); f = _f(b, o + 80 * k, 20)
            m = dict(diffuse=f[7:10], ck_count=int(w[16]), ck_start=int(w[17]), texture=None, uv_count=0, uv_start=0)
            if k < mc:
                mm = struct.unpack_from("<4i", b, mo + 32 * k)
                m.update(texture=mm[1], uv_count=mm[2], uv_start=mm[3])
            self.materials.append(m)
        o, c = self.sec["textures"]
        self.textures = [S[struct.unpack_from("<i", b, o + 16 * k)[0]] for k in range(c)]

        o, c = self.sec["uvkeys"]
        self.uvkeys = [(_f(b, o + 28 * k, 4), float(struct.unpack_from("<i", b, o + 28 * k + 16)[0])) for k in range(c)]
        o, c = self.sec["colourkeys"]
        self.colourkeys = [(_f(b, o + 32 * k, 4), float(struct.unpack_from("<i", b, o + 32 * k + 16)[0]))
                           for k in range(c)]
        o, c = self.sec["palettes"]
        self.palettes = [struct.unpack_from("<8i", b, o + 32 * k) for k in range(c)]



        o, c = self.sec["vertices"]
        vf = _f(b, o, 20 * c).reshape(c, 20)
        vu = np.frombuffer(b, "<u4", 20 * c, o).reshape(c, 20)
        self.pos, self.normal, self.uv = vf[:, 0:3], vf[:, 3:6], vf[:, 9:11]
        col = vu[:, 13]
        self.colour = np.stack([(col >> 16) & 255, (col >> 8) & 255, col & 255, col >> 24], 1) / 255.0
        self.bone = vf[:, 14:17].round().astype(int)
        self.weight = vf[:, 17:20]
        o, c = self.sec["indices"]
        self.indices = np.frombuffer(b, "<u2", c, o).astype(np.int64)


        self._root = [self._find_root(i) for i in range(len(self.nodes))]
        self.bones = {}
        for i, nd in enumerate(self.nodes):
            self.bones[(self._root[i], nd["id"])] = i
        self.rest = [self._world(i, None) for i in range(len(self.nodes))]
        self.rest_inv = [np.linalg.inv(m) if abs(np.linalg.det(m[:3, :3])) > 1e-12 else np.linalg.pinv(m)
                         for m in self.rest]
        self.length = max([nd["anim"] for nd in self.nodes] + [int(k[1]) for k in self.uvkeys] + [1])


    def _find_root(self, i):
        seen = 0
        while self.nodes[i]["parent"] >= 0 and seen < 64:
            i = self.nodes[i]["parent"]; seen += 1
        return i

    def _track(self, t_index, t):
        ks, kc = self.tracks[t_index]
        vals, frames = self.keys[0][ks:ks + kc], self.keys[1][ks:ks + kc]
        return _sample(vals, frames, t, quat=False), vals, frames

    def local(self, i, t):
        nd = self.nodes[i]
        if t is None or not nd["anim"] or max(nd["tracks"]) >= len(self.tracks):
            return nd["A"]
        T = self._track(nd["tracks"][0], t)[0][:3]
        _, qv, qf = self._track(nd["tracks"][2], t)
        Q = _sample(qv, qf, t, quat=True)
        Sc = self._track(nd["tracks"][3], t)[0][:3]
        M = np.eye(4)
        M[:3, :3] = np.diag(Sc) @ _quat(Q)
        M[3, :3] = T
        return M

    def _world(self, i, t):
        M = self.local(i, t)
        p = self.nodes[i]["parent"]
        return M if p < 0 else M @ self._world(p, t)

    def uv_offset(self, material, t):
        m = self.materials[material]
        if not m["uv_count"]:
            return np.array([0.0, 0.0, 1.0, 1.0])
        ks = self.uvkeys[m["uv_start"]:m["uv_start"] + m["uv_count"]]
        return _sample(np.array([k[0] for k in ks]), np.array([k[1] for k in ks]), t)

    def material_colour(self, material, t):
        m = self.materials[material]
        if not m["ck_count"] or m["ck_start"] + m["ck_count"] > len(self.colourkeys):
            return np.ones(4)
        ks = self.colourkeys[m["ck_start"]:m["ck_start"] + m["ck_count"]]
        return _sample(np.array([k[0] for k in ks]), np.array([k[1] for k in ks]), t)

    def texture_name(self, material):
        ti = self.materials[material]["texture"]
        return self.textures[ti] if ti is not None and 0 <= ti < len(self.textures) else None

    def geometry(self, t):
        """-> list of batches at frame t: dict(xyz (n,3), uv (n,2), rgba (n,4), tris (m,3), texture, material)."""
        worlds = [self._world(i, t) for i in range(len(self.nodes))]
        skin = [self.rest_inv[i] @ worlds[i] for i in range(len(self.nodes))]
        out = []
        for m in self.meshes:
            v0, vn = m["vert0"], m["nvert"]
            P = np.c_[self.pos[v0:v0 + vn], np.ones(vn)]
            bi, bw = self.bone[v0:v0 + vn], self.weight[v0:v0 + vn]
            X = np.zeros((vn, 4))
            root = self.objects[m["skeleton"]]["root"] if 0 <= m["skeleton"] < len(self.objects) else None
            rigid = bi[:, 0] < 0
            if rigid.any():
                X[rigid] = P[rigid] @ skin[m["owner"]] if 0 <= m["owner"] < len(self.nodes) else P[rigid]
            for j in range(3):
                for bone in np.unique(bi[~rigid, j]):
                    if bone < 0:
                        continue
                    node = self.bones.get((root, int(bone)))
                    sel = (~rigid) & (bi[:, j] == bone)
                    wj = np.where(bw[sel, j] < 0, 1.0 if j == 0 else 0.0, bw[sel, j])
                    X[sel] += (P[sel] @ (skin[node] if node is not None else np.eye(4))) * wj[:, None]
            for s in range(m["sub0"], m["sub0"] + m["nsub"]):
                sm = self.submeshes[s]

                tris = _strip(self.indices[sm["start"]:sm["start"] + sm["count"]])
                tris = tris[(tris < vn).all(1)] if len(tris) else tris
                if not len(tris):
                    continue
                off = self.uv_offset(sm["material"], t)
                uv = self.uv[v0:v0 + vn].copy()
                uv[:, 0] = uv[:, 0] * off[2] - off[0]
                uv[:, 1] = uv[:, 1] * off[3] + off[1]
                rgba = self.colour[v0:v0 + vn] * self.material_colour(sm["material"], t)[None, :]
                out.append(dict(xyz=X[:, :3], uv=uv, rgba=rgba, tris=tris, texture=self.texture_name(sm["material"]),
                                material=sm["material"], mesh=m["name"]))
        return out

    def summary(self):
        L = ["%s  version 0x%X  length %d frames" % (self.name, self.version, self.length),
             "  sections: " + " ".join("%s=%d" % (k, v[1]) for k, v in self.sec.items() if v[1])]
        for k, ob in enumerate(self.objects):
            L.append("  object %d: root node %d (%s), %d nodes, blend hint %s, flags %08X" % (
                k, ob["root"], self.nodes[ob["root"]]["name"] if ob["root"] < len(self.nodes) else "?", ob["count"],
                "add" if ob["blend_hint"] == 2 else "-", ob["flags"]))
        for i, nd in enumerate(self.nodes):
            L.append("  node %d %-10s type %-4d id %d parent %d anim %d" % (i, nd["name"], nd["type"], nd["id"],
                                                                         nd["parent"], nd["anim"]))
        for k, m in enumerate(self.meshes):
            subs = self.submeshes[m["sub0"]:m["sub0"] + m["nsub"]]
            L.append("  mesh %d %-6s skeleton %d owner %d  %d verts, %s" % (
                k, m["name"], m["skeleton"], m["owner"], m["nvert"],
                ", ".join("%d strip indices -> %s (%d UV keys)" % (s["count"], self.texture_name(s["material"]),
                                                                 self.materials[s["material"]]["uv_count"]) for s in subs)))
        return "\n".join(L)


def _sample(vals, frames, t, quat=False):
    vals = np.asarray(vals, float)
    if not len(vals):
        return np.zeros(4)
    if t <= frames[0] or len(vals) == 1:
        return vals[0]
    if t >= frames[-1]:
        return vals[-1]
    k = int(np.searchsorted(frames, t, side="right")) - 1
    f0, f1 = frames[k], frames[k + 1]
    a = 0.0 if f1 <= f0 else (t - f0) / (f1 - f0)
    v0, v1 = vals[k], vals[k + 1]
    if quat:
        if np.dot(v0, v1) < 0:
            v1 = -v1
        q = v0 * (1 - a) + v1 * a
        return q / (np.linalg.norm(q) or 1.0)
    return v0 * (1 - a) + v1 * a


def _quat(q):
    """(x, y, z, w) -> 3x3 rotation for row vectors (v' = v.M). Verified: node rest matrices = diag(S).M(q) + T."""
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
                     [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
                     [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]])


def _strip(ix):
    """Triangle strip (with repeated indices joining strips) -> (m, 3) triangles, degenerates dropped."""
    if len(ix) < 3:
        return np.zeros((0, 3), np.int64)
    a, b, c = ix[:-2], ix[1:-1], ix[2:]
    odd = np.arange(len(a)) % 2 == 1
    t = np.stack([a, np.where(odd, c, b), np.where(odd, b, c)], 1)
    keep = (a != b) & (b != c) & (a != c)
    return t[keep]




_CACHE = {}


def models(code):
    key = ("mdl", code)
    if key not in _CACHE:
        pac = R.fpac_files(R.read("data/eff3d/eff3d_%s.pac" % code))
        mdl = pac.get("mdl.pac", b"")
        _CACHE[key] = {n[:-4].lower(): d for n, d in R.fpac_files(mdl).items()} if mdl[:4] == b"FPAC" else {}
    return _CACHE[key]


def model(name, code="rrb"):
    key = ("model", code, name.lower())
    if key not in _CACHE:
        n = name.lower().replace(".dig", "").replace(".mua", "")
        _CACHE[key] = Model(models(code)[n], n)
    return _CACHE[key]


def texture(name, code="rrb"):
    """-> float32 (h, w, 4) in 0..1 (RGBA as stored; DXT1 art is opaque grey-on-black, meant for additive blending)."""
    key = ("tex", code, (name or "").lower())
    if key not in _CACHE:
        if ("texs", code) not in _CACHE:
            try:
                pac = R.fpac_files(R.read("data/eff3d/eff3d_%s_img.pac" % code))
            except FileNotFoundError:
                pac = {}
            _CACHE[("texs", code)] = {n.lower(): d for n, d in pac.items()}
        d = _CACHE[("texs", code)].get((name or "").lower())
        if d is None:
            img = np.ones((4, 4, 4), np.float32)
        else:
            img = np.asarray(Image.open(io.BytesIO(d)).convert("RGBA"), np.float32) / 255.0
        _CACHE[key] = img
    return _CACHE[key]


def palette_colour(code, pal, sub, index):
    """Effect colour: sub-palette `sub` (script 4061) entry `index` (script 21004) of palette `pal` (0 = default)."""
    import bbtag_formats as F
    key = ("pal", code)
    if key not in _CACHE:
        _CACHE[key] = R.fpac_files(R.read("data/char/char_%s_pal.pac" % code))
    b = _CACHE[key].get("%s%02d_%02d.hpl" % (code, pal, sub))
    if b is None:
        return np.ones(3)
    P = F.hpl(b)
    return P[index, :3] / 255.0 if 0 <= index < len(P) else np.ones(3)


def effect_tint(code, pal, st):
    """Script parameters -> RGB multiplier. 21004 without 4061 (15 of 236 uses, all characters) reads sub-palette 00."""
    if st.get("idx") is None:
        return np.ones(3)
    return palette_colour(code, pal, st.get("sub") or 0, st["idx"])




class Canvas:
    def __init__(self, w, h, bg=(24, 24, 32)):
        self.w, self.h = w, h
        self.disp = np.ones((h, w, 3), np.float32) * (np.array(bg, np.float32) / 255.0)
        self.C = np.zeros((h, w, 3), np.float32)
        self.A = np.zeros((h, w), np.float32)

    def draw(self, xy, uv, rgba, tris, tex, blend="alpha", tint=(1, 1, 1), alpha=1.0):
        th, tw = tex.shape[:2]
        tint = np.asarray(tint, np.float32)
        for tri in tris:
            p = xy[tri]
            x0, y0 = np.floor(p.min(0)).astype(int)
            x1, y1 = np.ceil(p.max(0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1 + 1, self.w), min(y1 + 1, self.h)
            if x1 <= x0 or y1 <= y0:
                continue
            (ax, ay), (bx, by), (cx, cy) = p
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            l0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            l1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            l2 = 1 - l0 - l1
            m = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
            if not m.any():
                continue
            L = np.stack([l0[m], l1[m], l2[m]], 1)
            u, v = (L @ uv[tri]).T
            col = L @ rgba[tri]
            s = _bilinear(tex, u, v, tw, th)
            src = s[:, :3] * col[:, :3] * tint
            a = np.clip(s[:, 3] * col[:, 3] * alpha, 0, 1)
            yy, xx = gy[m].astype(int), gx[m].astype(int)
            if blend == "add":
                add = src * a[:, None]
                self.disp[yy, xx] += add
                self.C[yy, xx] += add
                self.A[yy, xx] = np.clip(self.A[yy, xx] + add.max(1), 0, 1)
            else:
                self.disp[yy, xx] = src * a[:, None] + self.disp[yy, xx] * (1 - a[:, None])
                self.C[yy, xx] = src * a[:, None] + self.C[yy, xx] * (1 - a[:, None])
                self.A[yy, xx] = a + self.A[yy, xx] * (1 - a)

    def image(self):
        return Image.fromarray((np.clip(self.disp, 0, 1) * 255).astype(np.uint8))

    def rgba(self):
        a = np.clip(self.A, 0, 1)
        rgb = np.where(a[..., None] > 1e-4, self.C / np.maximum(a[..., None], 1e-4), 0)
        return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a]) * 255).astype(np.uint8))


def _bilinear(tex, u, v, tw, th):
    x = u * tw - 0.5
    y = v * th - 0.5
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    x0 %= tw; y0 %= th
    x1 = (x0 + 1) % tw; y1 = (y0 + 1) % th
    return (tex[y0, x0] * (1 - fx) * (1 - fy) + tex[y0, x1] * fx * (1 - fy) +
            tex[y1, x0] * (1 - fx) * fy + tex[y1, x1] * fx * fy)
















HANDLED = {0, 1, 2, 6, 7, 8, 9, 10, 15, 16, 26, 1002, 1006, 1007, 1056, 1059, 1064, 1067, 1072, 1073, 1096, 1099,
           3001, 3004, 3032, 3033, 4000, 4003, 4061, 21004}
_TXT = re.compile(rb"[A-Za-z0-9_.\-]{1,31}\x00")


def _args(raw):
    out, k = [], 0
    while k < len(raw):
        m = _TXT.match(raw, k)
        if m and k + 32 <= len(raw) and not any(raw[m.end():k + 32]):
            out.append(m.group()[:-1].decode()); k += 32; continue
        out.append(struct.unpack_from("<i", raw, k)[0]); k += 4
    return out


class Script:
    def __init__(self, code):
        self.code = code
        scr = R.fpac_files(R.read("data/char/char_%s_scr.pac" % code))
        self.b = scr["scr_%sea.bin" % code]
        self.states = {n: (a, z) for n, a, z in BS.states(self.b)}
        self.subs = {}
        for n, (a, z) in self.states.items():
            cur = None
            for op, ar in self.decode(n, raw=True):
                if op == 8:
                    cur = ar[0]; self.subs[cur] = []
                elif op == 9:
                    cur = None
                elif cur is not None:
                    self.subs[cur].append((op, ar))

    def decode(self, state, raw=False):
        a, z = self.states[state]
        out, p, b = [], a, self.b
        while p < z:
            op = struct.unpack_from("<I", b, p)[0]
            if op not in BS.SIZE:
                break
            out.append((op, _args(b[p + 4:p + BS.SIZE[op]])))
            p += BS.SIZE[op]
        if raw:
            return out

        res = []
        for op, ar in out:
            res.append((op, ar))
            if op == 1:
                break
        return res

    def models_of(self, state):
        return [ar[0] for op, ar in self.decode(state) if op == 4003]


class EffectObject:
    """One spawned effect state: its events [(tick, op, args)] and lifetime [t0, end)."""

    def __init__(self, state, t0, parent=None):
        self.state, self.t0, self.parent, self.end, self.dead = state, t0, parent, t0, None
        self.events, self.unhandled = [], set()
        self.sprites = []


def _flatten(script, state):
    out = []
    for op, ar in script.decode(state):
        if op == 10 and ar and ar[0] in script.subs:
            out.extend(script.subs[ar[0]])
        else:
            out.append((op, ar))
    return out


def run_effect(script, top, frames=240):
    """Simulate effect state `top` from tick 0.
    Timing rule: `upon 0` runs at spawn; commands after sprite(name, n) run on that sprite's first tick; the object
    lives until the end of its last sprite (endState). -> (objects, [(tick, [(object, params, model_time)])])."""
    objs = []

    def spawn(state, t0, parent):
        if state not in script.states:
            return
        ob = EffectObject(state, t0, parent)
        objs.append(ob)
        flat = _flatten(script, state)
        labels = {ar[0]: k for k, (op, ar) in enumerate(flat) if op == 6 and ar}
        cur = nxt = t0
        i = guard = 0
        while i < len(flat) and guard < 5000:
            guard += 1
            op, ar = flat[i]
            if op == 15:
                if not (ar and ar[0] == 0):
                    while i < len(flat) and flat[i][0] != 16:
                        i += 1
                i += 1; continue
            if op == 16:
                i += 1; continue
            if op == 1:
                break
            if op == 7 and ar and ar[0] in labels:
                if nxt - t0 > frames:
                    break
                i = labels[ar[0]] + 1; continue
            if op == 2:
                cur = nxt
                nxt = cur + max(ar[1] if len(ar) > 1 and isinstance(ar[1], int) else 1, 0)
                if ar and isinstance(ar[0], str):
                    ob.sprites.append((cur, nxt, ar[0]))
                i += 1; continue
            ob.events.append((cur, op, ar))
            i += 1
        ob.end = nxt
        for te, op, ar in list(ob.events):
            if op == 4000 and ar:
                spawn(ar[0], te, ob)
        return ob

    spawn(top, 0, None)
    for ob in objs:
        for te, op, ar in ob.events:
            if op == 26 and ar:
                for o2 in objs:
                    if o2.state == ar[0] and o2.t0 <= te and (o2.dead is None or o2.dead > te):
                        o2.dead = te

    t_end = min(frames, max(ob.end if ob.dead is None else min(ob.end, ob.dead) for ob in objs))
    timeline = []
    for t in range(int(t_end)):
        draw = []
        for ob in objs:
            end = ob.end if ob.dead is None else min(ob.end, ob.dead)
            if ob.t0 <= t < end:
                st = obj_params(ob, t)
                if st["model"] and st["model"].lower().replace(".dig", "") in models(script.code):
                    draw.append((ob, st, t - st["mt0"] + MODEL_T0))
        timeline.append((t, draw))
    return objs, timeline


def obj_params(ob, t):
    """An effect object's placement at tick t: model, offset (px), scale, rotation, alpha, blend, palette entry."""
    st = dict(model=None, mt0=ob.t0, x=0.0, y=0.0, sx=1.0, sy=1.0, rot=0.0, alpha=255.0, blend=None, sub=None,
              idx=None)
    base = None
    if ob.parent is not None:
        base = obj_params(ob.parent, ob.t0)
        st.update({k: base[k] for k in ("x", "y", "sx", "sy", "rot")})

    def offset(dx, dy):
        """A child's own offsets turn with its spawner (inferred 2026-09-29: one shared muzzle effect, rrbMuzzleEff,
        is aimed by each gun move's parent: Gun Blast's parent turns it -100 degrees, so the flash points behind her,
        where her shot goes). Raw orientation: forward (+x) is screen-left; rotation is counter-clockwise, y up."""
        if base is None or not base["rot"]:
            return dx, dy
        a = np.radians(base["rot"])
        sx_, sy_ = -dx, dy
        rx, ry = sx_ * np.cos(a) - sy_ * np.sin(a), sx_ * np.sin(a) + sy_ * np.cos(a)
        return -rx, ry
    vel = dict(s=0.0, sx=0.0, sy=0.0, rot=0.0, alpha=0.0)
    last = ob.t0
    for te, op, ar in ob.events:
        if te > t:
            break
        _integrate(st, vel, te - last)
        last = te
        v = ar[0] if ar else 0
        if op == 4003: st["model"], st["mt0"] = v, te
        elif op == 1002:
            dx, dy = offset(v / 1000.0, 0.0); st["x"] += dx; st["y"] += dy
        elif op in (1006, 1007):
            dx, dy = offset(0.0, v / 1000.0); st["x"] += dx; st["y"] += dy
        elif op == 1096: st["sx"] = st["sy"] = v / 1000.0 * (base["sx"] if base else 1.0)
        elif op == 1056: st["sx"] = v / 1000.0 * (base["sx"] if base else 1.0)
        elif op == 1064: st["sy"] = v / 1000.0 * (base["sy"] if base else 1.0)
        elif op == 1099: vel["s"] = v / 1000.0
        elif op == 1059: vel["sx"] = v / 1000.0
        elif op == 1067: vel["sy"] = v / 1000.0
        elif op == 1072: st["rot"] = v / 1000.0 + (base["rot"] if base else 0.0)
        elif op == 1073: vel["rot"] = v / 1000.0
        elif op == 3001: st["alpha"] = float(v)
        elif op == 3004: vel["alpha"] = float(v)
        elif op == 3032: st["blend"] = "alpha"
        elif op == 3033: st["blend"] = "add"
        elif op == 4061: st["sub"] = v
        elif op == 21004: st["idx"] = v
        elif op not in HANDLED: ob.unhandled.add(op)
    _integrate(st, vel, t - last)
    return st


def _integrate(st, vel, dt):
    if dt <= 0:
        return
    st["sx"] += (vel["s"] + vel["sx"]) * dt
    st["sy"] += (vel["s"] + vel["sy"]) * dt
    st["rot"] += vel["rot"] * dt
    st["alpha"] = float(np.clip(st["alpha"] + vel["alpha"] * dt, 0, 255))





def project(xyz, ox, oy, k, sx=1.0, sy=1.0, rot=0.0):
    """Model units -> canvas px (y down). (ox, oy) = the object's origin on the canvas; k = canvas px per unit."""
    x, y = xyz[:, 0] * sx, xyz[:, 1] * sy
    if rot:
        a = np.radians(rot)
        x, y = x * np.cos(a) - y * np.sin(a), x * np.sin(a) + y * np.cos(a)
    return np.stack([ox + x * k, oy - y * k], 1)


def _default_blend(mdl, code):
    """No script value: the file's object hint (2 = additive), else additive for opaque (DXT1, glow-on-black) art."""
    if any(o["blend_hint"] == 2 for o in mdl.objects):
        return "add"
    names = [mdl.texture_name(s["material"]) for s in mdl.submeshes]
    return "add" if names and all(texture(n, code)[..., 3].min() > 0.99 for n in names) else "alpha"


def _frame_box(items):
    pts = [p for p in items if len(p)]
    if not pts:
        return None
    P = np.concatenate(pts)
    P = P[np.abs(P).max(1) < 1e5]
    return np.minimum(P.min(0), 0), np.maximum(P.max(0), 0)


def _finish(cv, W, H, ss, flip):
    img, rgba = cv.image(), cv.rgba()
    if ss > 1:
        img = img.resize((W // ss, H // ss), Image.LANCZOS)
        rgba = rgba.resize((W // ss, H // ss), Image.LANCZOS)
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT); rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)
    return img, rgba


def render_model(name, code="rrb", frames=None, scale=1.0, ppu=1.0, blend=None, tint=(1, 1, 1), bg=(24, 24, 32),
                 flip=False, ss=2):
    """Model alone (its node + UV animation, no script values) -> [(frame, image, origin)], common framing."""
    mdl = model(name, code)
    frames = list(range(mdl.length + 1)) if frames is None else frames
    geo = {t: mdl.geometry(t) for t in frames}
    box = _frame_box([project(g["xyz"][np.unique(g["tris"])], 0, 0, scale) for t in frames for g in geo[t]])
    lo, hi = box if box else (np.array([-10.0, -10.0]), np.array([10.0, 10.0]))
    k, pad = ppu * ss, 8 * ss
    W, H = int((hi[0] - lo[0]) * k) + 2 * pad, int((hi[1] - lo[1]) * k) + 2 * pad
    ox, oy = pad - lo[0] * k, pad - lo[1] * k
    blend = blend or _default_blend(mdl, code)
    out = []
    for t in frames:
        cv = Canvas(W, H, bg)
        for g in geo[t]:
            cv.draw(project(g["xyz"], ox, oy, k * scale), g["uv"], g["rgba"], g["tris"], texture(g["texture"], code),
                    blend, tint)
        img, _ = _finish(cv, W, H, ss, flip)
        out.append((t, img, ((W - ox) / ss if flip else ox / ss, oy / ss)))
    return out


def render_effect(script, top, frames=None, ppu=1.0, pal=0, bg=(24, 24, 32), flip=False, ss=2, frames_dir=None):
    """Script-driven render of effect state `top` -> ([(tick, image, origin)], objects). origin = the spawner's root."""
    code = script.code
    objs, tl = run_effect(script, top, frames=max(frames) + 1 if frames else 240)
    if frames is not None:
        tl = [x for x in tl if x[0] in set(frames)]
    placed = []
    for t, draw in tl:
        for ob, st, mt in draw:
            for g in model(st["model"], code).geometry(mt):
                placed.append(project(g["xyz"][np.unique(g["tris"])], -st["x"], -st["y"], UNIT_PX,
                                      st["sx"], st["sy"], st["rot"]))
    box = _frame_box(placed)
    if box is None:
        return [], objs
    lo, hi = box
    k, pad = ppu * ss, 10 * ss
    W, H = int((hi[0] - lo[0]) * k) + 2 * pad, int((hi[1] - lo[1]) * k) + 2 * pad
    ox, oy = pad - lo[0] * k, pad - lo[1] * k
    out = []
    for t, draw in tl:
        cv = Canvas(W, H, bg)
        for ob, st, mt in draw:
            mdl = model(st["model"], code)
            tint = effect_tint(code, pal, st)
            blend = st["blend"] or _default_blend(mdl, code)
            cx, cy = ox - st["x"] * k, oy - st["y"] * k
            for g in mdl.geometry(mt):
                cv.draw(project(g["xyz"], cx, cy, k * UNIT_PX, st["sx"], st["sy"], st["rot"]), g["uv"], g["rgba"],
                        g["tris"], texture(g["texture"], code), blend, tint, st["alpha"] / 255.0)
        img, rgba = _finish(cv, W, H, ss, flip)
        if frames_dir:
            os.makedirs(frames_dir, exist_ok=True)
            rgba.save(os.path.join(frames_dir, "%s_%03d.png" % (top, t)))
        out.append((t, img, ((W - ox) / ss if flip else ox / ss, oy / ss)))
    return out, objs


def sheet(frames, cols=6, label=""):
    """Contact sheet: every frame with its number and the origin cross."""
    if not frames:
        return None
    w = max(im.width for _, im, _ in frames); h = max(im.height for _, im, _ in frames)
    cols = min(cols, len(frames))
    rows = (len(frames) + cols - 1) // cols
    top = 16 if label else 0
    S = Image.new("RGB", (cols * (w + 4), rows * (h + 16) + top), (8, 8, 10))
    d = ImageDraw.Draw(S)
    if label:
        d.text((4, 2), label, fill=(230, 230, 230))
    for n, (t, im, (ox, oy)) in enumerate(frames):
        X = (n % cols) * (w + 4); Y = top + (n // cols) * (h + 16)
        S.paste(im, (X, Y + 14))
        d.text((X + 2, Y + 1), "f%d" % t, fill=(200, 200, 120))
        d.line([(X + ox - 4, Y + 14 + oy), (X + ox + 4, Y + 14 + oy)], fill=(0, 200, 255))
        d.line([(X + ox, Y + 14 + oy - 4), (X + ox, Y + 14 + oy + 4)], fill=(0, 200, 255))
    return S



def _opts(argv):
    o = dict(code="rrb", frames=None, scale=None, ppu=1.0, pal=0, flip=False, cols=6, bg=(24, 24, 32), out=None,
             frames_dir=None)
    rest = []
    it = iter(argv)
    for a in it:
        if a == "--code": o["code"] = next(it)
        elif a == "--frames":
            v = next(it)
            o["frames"] = list(range(int(v.split("-")[0]), int(v.split("-")[1]) + 1)) if "-" in v else \
                [int(x) for x in v.split(",")]
        elif a == "--scale": o["scale"] = float(next(it))
        elif a == "--ppu": o["ppu"] = float(next(it))
        elif a == "--pal": o["pal"] = int(next(it))
        elif a == "--face-right": o["flip"] = True
        elif a == "--cols": o["cols"] = int(next(it))
        elif a == "--bg": o["bg"] = tuple(int(x) for x in next(it).split(","))
        elif a == "--out": o["out"] = next(it)
        elif a == "--frames-dir": o["frames_dir"] = next(it)
        else: rest.append(a)
    return o, rest


def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    cmd = sys.argv[1]
    o, names = _opts(sys.argv[2:])
    os.makedirs(OUT, exist_ok=True)
    if cmd == "info":
        for n in names:
            print(model(n, o["code"]).summary())
    elif cmd == "states":
        sc = Script(names[0] if names else o["code"])
        for st in sc.states:
            ms = sc.models_of(st)
            if ms:
                print("%-28s %s" % (st, " ".join(m.replace(".DIG", "") for m in ms)))
    elif cmd == "render":
        for n in names:
            mdl = model(n, o["code"])
            fr = render_model(n, o["code"], o["frames"], o["scale"] or 1.0, o["ppu"], flip=o["flip"], bg=o["bg"])
            S = sheet(fr, o["cols"], "%s  (model units x%.2f, own animation, white, %s)" % (
                n, o["scale"] or 1.0, "add" if any(x["blend_hint"] == 2 for x in mdl.objects) else "alpha"))
            p = o["out"] or os.path.join(OUT, "%s.png" % n)
            S.save(p); print(p, S.size)
    elif cmd == "effect":
        sc = Script(o["code"])
        for n in names:
            fr, objs = render_effect(sc, n, o["frames"], o["ppu"], o["pal"], o["bg"], o["flip"],
                                     frames_dir=o["frames_dir"])
            un = sorted(set().union(*[ob.unhandled for ob in objs])) if objs else []
            S = sheet(fr, o["cols"], "%s  (script-driven, palette %d, %s)" % (
                n, o["pal"], "facing right" if o["flip"] else "raw BBTAG orientation: facing left"))
            if S is None:
                print(n, "draws no model"); continue
            p = o["out"] or os.path.join(OUT, "effect_%s.png" % n)
            S.save(p)
            print(p, S.size, "objects:", ", ".join("%s@%d-%d" % (ob.state, ob.t0, ob.end) for ob in objs),
                  "| ignored ops:", un)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
