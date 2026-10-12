"""dr_sfx.py -- DELTARUNE's sound effects by name, read from the PLAYER'S OWN install at build time (read-only).

GameMaker keeps a sound's row in the SOND chunk of data.win: name, flags, file name, volume, pitch, audio group and
audio id. An embedded sound (flag 0x1, audio id >= 0) is entry <audio id> of the AUDO chunk of its audio group's file:
data.win for group 0, audiogroup<N>.dat (next to it) for group N. A streamed sound (no 0x1) is a loose .ogg next to
data.win. Every sound the party uses is embedded 16-bit PCM WAVE (local_only/deltarune/party/audio/AUDIO_ROUTE.md 1).
Nothing read here is stored in the mod folder.
"""
import mmap, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))
DEFAULT_CH5 = os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), "Steam", "steamapps", "common",
                           "DELTARUNE", "chapter5_windows", "data.win")   # Steam's default library (0.6.4: was this project's own drive)


def chapter5_data():
    """Chapter 5's data.win: $DELTARUNE_DIR (the install folder) if set, else the path the party's other importers read
    (tools/deltarune/research_scratch/gmdata.CH5, as import_kris.py), else Steam's default library."""
    d = os.environ.get("DELTARUNE_DIR")
    if d:
        return os.path.join(d, "chapter5_windows", "data.win")
    scratch = os.path.join(ROOT, "tools", "deltarune", "research_scratch")
    if os.path.exists(os.path.join(scratch, "gmdata.py")):
        sys.path.insert(0, scratch)
        try:
            import gmdata
            return gmdata.CH5
        except Exception:
            pass
        finally:
            sys.path.remove(scratch)
    return DEFAULT_CH5


def _chunks(mm):
    if mm[0:4] != b"FORM":
        raise ValueError("not a GameMaker data file")
    total = struct.unpack_from("<I", mm, 4)[0]
    pos, out = 8, {}
    while pos < 8 + total:
        name = bytes(mm[pos:pos + 4]).decode("ascii"); size = struct.unpack_from("<I", mm, pos + 4)[0]
        out[name] = (pos + 8, size)
        pos += 8 + size
    return out


def _plist(mm, off):
    n = struct.unpack_from("<I", mm, off)[0]
    return struct.unpack_from("<%dI" % n, mm, off + 4) if n else ()


def _str(mm, ptr):
    if not ptr:
        return None
    n = struct.unpack_from("<I", mm, ptr - 4)[0]
    return bytes(mm[ptr:ptr + n]).decode("utf-8", "replace")


def wav_info(b):
    """RIFF WAVE bytes -> {"format", "channels", "rate", "bits", "samples"} (samples per channel)."""
    if b[:4] != b"RIFF" or b[8:12] != b"WAVE":
        raise ValueError("not RIFF WAVE")
    p, fmt, data = 12, None, None
    while p + 8 <= len(b):
        cid = b[p:p + 4]; n = struct.unpack_from("<I", b, p + 4)[0]
        if cid == b"fmt ":
            fmt = struct.unpack_from("<HHIIHH", b, p + 8)
        elif cid == b"data":
            data = n
        p += 8 + n + (n & 1)
    if fmt is None or data is None:
        raise ValueError("WAVE without fmt / data")
    tag, ch, rate, _, align, bits = fmt
    return {"format": tag, "channels": ch, "rate": rate, "bits": bits, "samples": data // align}


class Sounds:
    """The SOND rows of one data.win and the bytes of its embedded sounds (memory-mapped, read-only)."""

    def __init__(self, data_win=None):
        self.path = data_win or chapter5_data()
        if not os.path.exists(self.path):
            raise FileNotFoundError(self.path)
        self.dir = os.path.dirname(self.path)
        self._f = open(self.path, "rb")
        self.mm = mmap.mmap(self._f.fileno(), 0, access=mmap.ACCESS_READ)
        ch = _chunks(self.mm)
        self.groups = [_str(self.mm, struct.unpack_from("<I", self.mm, p)[0]) for p in _plist(self.mm, ch["AGRP"][0])] if "AGRP" in ch else []
        self.rows = {}
        for i, e in enumerate(_plist(self.mm, ch["SOND"][0])):
            name, flags, typ, fil, eff, vol, pitch, grp, aid = struct.unpack_from("<5Iffii", self.mm, e)
            self.rows[_str(self.mm, name)] = {"id": i, "flags": flags, "file": _str(self.mm, fil), "volume": vol,
                                              "pitch": pitch, "group": grp, "audio_id": aid}
        self._audo = {}

    def _audo_of(self, group):
        if group not in self._audo:
            p = self.path if group == 0 else os.path.join(self.dir, "audiogroup%d.dat" % group)
            f = open(p, "rb"); mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
            self._audo[group] = (p, mm, _plist(mm, _chunks(mm)["AUDO"][0]))
        return self._audo[group]

    def read(self, name):
        """-> (bytes, info): the sound's file as GameMaker stores it, with where it came from."""
        r = self.rows.get(name)
        if r is None:
            raise KeyError("DELTARUNE sound %s is not in %s" % (name, self.path))
        if r["flags"] & 1 and r["audio_id"] >= 0:
            p, mm, ptrs = self._audo_of(r["group"])
            if r["audio_id"] >= len(ptrs):
                raise KeyError("%s: audio id %d past the %d entries of %s" % (name, r["audio_id"], len(ptrs), p))
            o = ptrs[r["audio_id"]]
            n = struct.unpack_from("<I", mm, o)[0]
            data = bytes(mm[o + 4:o + 4 + n])
        else:
            p = os.path.join(self.dir, r["file"])
            data = open(p, "rb").read()
        return data, dict(r, source=os.path.basename(p))
