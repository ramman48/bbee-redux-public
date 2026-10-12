"""bbtag_ui_dump.py -- find and render one character's UI art in the player's own BBTAG install (research; read-only).

Nothing here writes inside the install. Output goes to local_only/bbtag/ui/ (never packaged, committed or shared).

  python tools/bbtag/bbtag_ui_dump.py scan   rrb      list every entry (first level + nested FPAC, depth 3) whose name contains "rrb"
  python tools/bbtag/bbtag_ui_dump.py render rrb      decode the HIP/DDS hits to PNG (local_only/bbtag/ui/<asset8>__<entry>.png)

Why a second HIP decoder: bbtag_formats.hip() only knows the 256-colour HIP. The FHD UI images (cmn_ch_*, vs_chara_*, cmn_nm_*,
0037_char_*, ...) are truecolor: header palette count 0, image data at 0x20 + header-ext, RLE of 5-byte units (B, G, R, A, run).
Paletted HIPs whose palette count is 256 are the old format (index 0 = transparent).
Only the headers are read while scanning, so a full scan of the install takes seconds.
"""
import hashlib, io, json, os, struct, sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bbtag_read as R

KEY = np.frombuffer(R.KEY, np.uint8)
ASSETS = os.path.join(R.INSTALL, "asset")
OUT = os.path.join(R.LOCAL, "ui")


def rd(name, off, n):
    """n decrypted bytes at file offset off of asset\\<name> (XOR key index = (md5(name)[7] + position) % 43)."""
    with open(os.path.join(ASSETS, name), "rb") as f:
        f.seek(off)
        b = f.read(n)
    s = hashlib.md5(name.encode()).digest()[7]
    k = KEY[(s + off + np.arange(len(b))) % 43]
    return (np.frombuffer(b, np.uint8) ^ k).tobytes()


def table(name, base):
    """FPAC entries at absolute offset base -> [(entry name, absolute offset, size)] or None."""
    h = rd(name, base, 0x20)
    if h[:4] != b"FPAC":
        return None
    ds, tot, cnt, flags, nl = struct.unpack_from("<5I", h, 4)
    # entry stride: the table fills the header up to data_start. (nl + 12) rounded to 16 is 16 short for name
    # lengths 20 / 36 (found by the BBTAG catalogue: 4,973 of 11,393 archives); keep it only as a fallback
    es = (ds - 0x20) // cnt if cnt and (ds - 0x20) // cnt >= nl + 12 else (nl + 12 + 15) // 16 * 16
    t = rd(name, base + 0x20, es * cnt)
    out = []
    for i in range(cnt):
        o = i * es
        n = t[o:o + nl].split(b"\0")[0].decode("latin1")
        _, off, size = struct.unpack_from("<3I", t, o + nl)
        out.append((n, base + ds + off, size))
    return out


def walk(name, base=0, path="", depth=0):
    es = table(name, base)
    for n, o, s in es or []:
        p = path + "/" + n if path else n
        yield p, o, s
        if depth < 3 and s >= 0x20 and rd(name, o, 4) == b"FPAC":
            yield from walk(name, o, p, depth + 1)


def scan(code):
    code = code.lower()
    hits = []
    for name in sorted(os.listdir(ASSETS)):
        try:
            for p, o, s in walk(name):
                if code in p.lower():
                    hits.append((name, p, o, s))
        except Exception:
            pass
    return hits


def hip(b):
    """Any HIP -> (PIL RGBA image of the stored (trimmed) rectangle, info dict)."""
    ver, size, npal, cw, ch = struct.unpack_from("<5I", b, 4)
    ext = struct.unpack_from("<I", b, 0x1C)[0]
    w, h, ox, oy = (struct.unpack_from("<4I", b, 0x20) if ext >= 0x10 else (cw, ch, 0, 0))
    po = 0x20 + ext
    if npal == 0:
        d = np.frombuffer(b, np.uint8, len(b) - po, po)
        u = d[:len(d) // 5 * 5].reshape(-1, 5)
        px = np.repeat(u[:, :4], u[:, 4].astype(np.int64), axis=0)
        rgba = px[:, [2, 1, 0, 3]].reshape(h, w, 4)
    else:
        pal = np.frombuffer(b, np.uint8, npal * 4, po).reshape(npal, 4)[:, [2, 1, 0, 3]].copy()
        pal[0, 3] = 0
        d = np.frombuffer(b, np.uint8, len(b) - (po + npal * 4), po + npal * 4)
        rgba = pal[np.repeat(d[0::2], d[1::2].astype(np.int64)).reshape(h, w)]
    return Image.fromarray(np.ascontiguousarray(rgba), "RGBA"), dict(canvas=(cw, ch), offset=(ox, oy), palette=npal)


def render(hits):
    os.makedirs(OUT, exist_ok=True)
    done = []
    for name, p, o, s in hits:
        leaf = p.rsplit("/", 1)[-1]
        if not leaf.lower().endswith((".hip", ".dds")):
            continue
        b = rd(name, o, s)
        im = Image.open(io.BytesIO(b)).convert("RGBA") if leaf.lower().endswith(".dds") else hip(b)[0]
        fn = os.path.join(OUT, "%s__%s.png" % (name[:8], leaf.rsplit(".", 1)[0]))
        im.save(fn)
        done.append(fn)
    return done


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("scan", "render"):
        print(__doc__)
        sys.exit(1)
    hits = scan(sys.argv[2])
    if sys.argv[1] == "scan":
        for name, p, o, s in hits:
            print("%s  %-46s %9d" % (name[:8], p, s))
        print(len(hits), "entries")
    else:
        print(len(render(hits)), "images ->", OUT)
