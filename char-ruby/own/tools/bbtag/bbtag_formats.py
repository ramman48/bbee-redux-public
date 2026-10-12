"""bbtag_formats.py -- decoders for Cross Tag Battle's character formats (research; read-only on the install).

HIP (sprites), HPL (palettes), JONBIN (per-sprite chunk placement and boxes). See docs/cross-effect/PIPELINE.md.
"""
import struct

import numpy as np


def hip(b):
    """HIP v0x125: 'HIP\\0', version, file size, palette count (256), canvas w, h, flags 01 01 01 20, header ext 0x20;
    image w, h, offset x, y (where the trimmed image sits on the canvas); 16 bytes pad; 256 BGRA palette entries;
    then (index, run) byte pairs covering w*h pixels. Returns dict with an index plane (h, w) uint8."""
    if b[:4] != b"HIP\0":
        raise ValueError("not HIP")
    ver, size, npal, cw, ch = struct.unpack_from("<5I", b, 4)
    flags = b[0x18:0x1C]
    ext = struct.unpack_from("<I", b, 0x1C)[0]
    w, h, ox, oy = struct.unpack_from("<4I", b, 0x20)
    po = 0x20 + ext
    pal = np.frombuffer(b, np.uint8, npal * 4, po).reshape(npal, 4)[:, [2, 1, 0, 3]].copy()   # BGRA -> RGBA
    d = np.frombuffer(b, np.uint8, len(b) - (po + npal * 4), po + npal * 4)
    vals, runs = d[0::2], d[1::2].astype(np.int64)
    idx = np.repeat(vals[:len(runs)], runs)
    if idx.size != w * h:
        raise ValueError("RLE covers %d of %d pixels" % (idx.size, w * h))
    return {"version": ver, "canvas": (cw, ch), "size": (w, h), "offset": (ox, oy), "flags": flags.hex(),
            "palette": pal, "index": idx.reshape(h, w)}


def hpl(b):
    """HPL: 'HPAL', ?, file size, count, ... 0x20 header, then count BGRA entries. Returns (count, 4) RGBA."""
    if b[:4] != b"HPAL":
        raise ValueError("not HPAL")
    n = struct.unpack_from("<I", b, 0x0C)[0]
    return np.frombuffer(b, np.uint8, n * 4, 0x20).reshape(n, 4)[:, [2, 1, 0, 3]].copy()


BOX_KINDS = ("hurt", "hit", "box3", "box4")


def jonbin(b):
    """JONBIN (BBTAG uses the BBCP-era layout, cf. dantarion/bbtools jonbin_parser.py):
    'JONB', uint16 name count, names[32]; 3 bytes; uint32 chunk count, int16 x4 box counts (hurt, hit, 3rd, 4th);
    39 uint16 (unknown); chunks of 80 bytes = src x,y,w,h + dst x,y,w,h (floats, canvas px) + 8 ints + layer + 3 ints;
    then boxes of 20 bytes = id + x,y,w,h (floats), grouped by kind in count order."""
    if b[:4] != b"JONB":
        raise ValueError("not JONB")
    nn = struct.unpack_from("<H", b, 4)[0]
    names = [b[6 + 32 * i:6 + 32 * (i + 1)].split(b"\0")[0].decode("latin1") for i in range(nn)]
    o = 6 + 32 * nn + 3
    nchunk, *nbox = struct.unpack_from("<I4h", b, o)
    o += 12
    extra = struct.unpack_from("<39H", b, o)   # counts for box types 4..42 (verified: they size the tail exactly)
    o += 78
    nbox = list(nbox) + list(extra)
    chunks = []
    for i in range(nchunk):
        f = struct.unpack_from("<8f", b, o)
        ints = struct.unpack_from("<8I", b, o + 32)
        layer = struct.unpack_from("<I", b, o + 64)[0]
        tail = struct.unpack_from("<3I", b, o + 68)
        chunks.append({"src": f[:4], "dst": f[4:], "ints": ints, "layer": layer, "tail": tail})
        o += 80
    boxes = {}
    for kind, n in zip(BOX_KINDS + tuple("type%d" % i for i in range(4, 43)), nbox):
        boxes[kind] = []
        for i in range(max(n, 0)):
            bid, x, y, w, h = struct.unpack_from("<I4f", b, o)
            boxes[kind].append({"id": bid, "x": x, "y": y, "w": w, "h": h})
            o += 20
    return {"names": names, "chunks": chunks, "boxes": boxes, "extra": extra, "end": o, "size": len(b)}


def rgba(img, palette=None):
    pal = img["palette"] if palette is None else palette
    return pal[img["index"]]


def compose(img, jb, palette=None):
    """Assemble one frame: each chunk copies canvas[src] to dst (canvas px, origin = the character's root, y down),
    drawn in layer order. Returns (RGBA uint8 array, (origin_x, origin_y)) where origin is the root inside the array.
    Palette index 0 is transparent."""
    ox, oy = img["offset"]
    w, h = img["size"]
    pal = (img["palette"] if palette is None else palette).copy()
    pal[0, 3] = 0
    chunks = sorted(jb["chunks"], key=lambda c: c["layer"])
    if not chunks:
        return np.zeros((1, 1, 4), np.uint8), (0, 0)
    x0 = int(min(c["dst"][0] for c in chunks)); y0 = int(min(c["dst"][1] for c in chunks))
    x1 = int(max(c["dst"][0] + c["dst"][2] for c in chunks)); y1 = int(max(c["dst"][1] + c["dst"][3] for c in chunks))
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    for c in chunks:
        sx, sy, sw, sh = (int(v) for v in c["src"])
        dx, dy = int(c["dst"][0]) - x0, int(c["dst"][1]) - y0
        # canvas region -> trimmed image region
        ix0, iy0 = max(sx, ox), max(sy, oy)
        ix1, iy1 = min(sx + sw, ox + w), min(sy + sh, oy + h)
        if ix1 <= ix0 or iy1 <= iy0:
            continue
        part = pal[img["index"][iy0 - oy:iy1 - oy, ix0 - ox:ix1 - ox]]
        tx, ty = dx + (ix0 - sx), dy + (iy0 - sy)
        region = out[ty:ty + part.shape[0], tx:tx + part.shape[1]]
        m = part[..., 3:4] > 0
        region[:] = np.where(m, part, region)
    return out, (-x0, -y0)
