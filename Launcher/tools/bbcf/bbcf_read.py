r"""bbcf_read.py -- read-only reader for BlazBlue Centralfiction's .pac archives (the player's own install).

Local import only (the project's assets rule): nothing read here is committed, packaged or shared; output goes to
the local folder at most. Format notes: NOTES.md "2026-09-28 (late night) [Characters]".

  DFASFPAC   16-byte header (magic, uncompressed size, compressed size, pad) + zlib of an FPAC. Voice/SE archives are
             plain FPAC. No md5 names, no XOR key (unlike BBTAG).
  FPAC       like BBTAG's, but the entry stride must come from the header: (data_start - 0x20) // count
             (name length 20 -> 48-byte entries). Some archives have 0 entries.
  sprites    Char\char_<id>_img.pac (HIP), _col.pac (JONBIN), _pal.pac (HPL). The palette inside each HIP is a
             false-colour work palette: pass the character palette (e.g. ph00_00.hpl). JONBIN chunk layers 1-2 are
             face-expression overlays (closed eye, open mouth); BBEE's Phantom frames match layer 0 alone.
             36 of Nine's JONBINs have negative-width (mirrored) chunks: frame() refuses them until the placement
             rule is verified against BBEE's own renders of the same sprites.
  UI HIPs    palette-less truecolour RLE (5-byte BGRA + run): tools\bbtag\bbtag_ui_dump.hip() decodes them.

usage: python tools/bbcf/bbcf_read.py <archive under data\, e.g. Char/char_ph_img.pac> [count]
"""
import os, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "bbtag"))
BBCF = os.environ.get("BBCF_DIR", r"B:\SteamLibrary\steamapps\common\BlazBlue Centralfiction")


def unwrap(b):
    """DFASFPAC -> the FPAC inside it; anything else unchanged."""
    if b[:8] == b"DFASFPAC":
        usize, csize = struct.unpack_from("<2I", b, 8)
        d = zlib.decompress(b[16:16 + csize])
        if len(d) != usize:
            raise ValueError("DFASFPAC: %d bytes, header says %d" % (len(d), usize))
        return d
    return b


def fpac_entries(b):
    """[(name, absolute offset, size)] of an FPAC."""
    if b[:4] != b"FPAC":
        raise ValueError("not an FPAC: %r" % b[:8])
    ds, tot, cnt, flags, nl = struct.unpack_from("<5I", b, 4)
    if cnt == 0:
        return []
    es = (ds - 0x20) // cnt
    out = []
    for i in range(cnt):
        o = 0x20 + i * es
        n = b[o:o + nl].split(b"\x00")[0].decode("latin1")
        idx, off, size = struct.unpack_from("<3I", b, o + nl)
        out.append((n, ds + off, size))
    return out


def path(rel):
    return rel if os.path.isabs(rel) else os.path.join(BBCF, "data", rel)


def files(rel):
    """{name: bytes} of one archive (one level)."""
    b = unwrap(open(path(rel), "rb").read())
    return {n: b[o:o + s] for n, o, s in fpac_entries(b)}


def leaves(b, prefix=""):
    """Walk nested archives: yields (path, bytes) of every non-archive file."""
    b = unwrap(b)
    if b[:4] == b"FPAC":
        for n, o, s in fpac_entries(b):
            yield from leaves(b[o:o + s], prefix + "/" + n)
    else:
        yield prefix, b


class Character:
    """One character's sprites: Character("ph").frame("ph000_00") -> (RGBA numpy array, origin (x, y))."""
    def __init__(self, cid, palette=None):
        import bbtag_formats as F
        self.F = F
        self.img = files("Char/char_%s_img.pac" % cid)
        self.col = files("Char/char_%s_col.pac" % cid)
        pal = files("Char/char_%s_pal.pac" % cid)
        self.pal = F.hpl(pal[palette or "%s00_00.hpl" % cid])

    def frame(self, name, layers=(0,)):
        F = self.F
        h = F.hip(self.img[name + ".hip"]); j = F.jonbin(self.col[name + ".jonbin"])
        ch = [c for c in j["chunks"] if c["layer"] in layers]
        bad = [c for c in ch if c["src"][2] < 0 or c["dst"][2] < 0]
        if bad:
            raise NotImplementedError("%s: %d mirrored (negative-width) chunks; placement rule not verified yet" % (name, len(bad)))
        return F.compose(h, dict(j, chunks=ch), self.pal)


if __name__ == "__main__":
    b = unwrap(open(path(sys.argv[1]), "rb").read())
    ents = fpac_entries(b)
    print(len(ents), "entries")
    for n, o, s in ents[:int(sys.argv[2]) if len(sys.argv) > 2 else 10]:
        print("%-40s %10d %8d" % (n, o, s))
