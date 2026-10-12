"""bbtag_xact.py -- read BBTAG's XACT 3 sound banks (Cross Effect audio; research/AUDIO.md).

BBTAG keeps each bank as an FPAC archive of <name>.xsb (sound bank: cue names -> sounds -> wave indices) and <name>.xwb
(wave bank: format + PCM). Every bank Ruby needs is plain 16-bit PCM (checked for serrb, se00, sebrg and the English
vbtl_rrb_0: format tag 0), so no decoder is needed; ADPCM / xWMA entries are refused with a clear error.

Formats (XACT 3, version 46; offsets checked against the files):
  XWB  "WBND", u32 version, u32 header version, 5 x (u32 offset, u32 length) segments: bank data, entry metadata,
       seek tables, entry names, wave data. Bank data: u32 flags, u32 count, name[64], u32 metadata size, u32 name size,
       u32 alignment, u32 compact format, FILETIME. Entry (24 bytes): u32 flags|duration<<4, u32 MINIWAVEFORMAT
       (tag:2 channels:3 rate:18 block align:8 bits:1), play region (u32 offset in the wave data, u32 length), loop region.
  XSB  "SDBK", u16 version, u16 header version, u16 crc, FILETIME, u8 platform, s16 simple cues, s16 complex cues,
       s16 ?, s16 total, u8 wave banks, s16 sounds, u16 names size, u16 ?, s32 simple cue offset, s32 complex cue
       offset, s32 cue names offset, s32 ?, s32 variation tables, s32 ?, s32 wave bank names, s32 name hash table,
       s32 name hash values, s32 sounds offset, name[64]. Simple cue: u8 flags, u32 sound offset. Simple sound:
       u8 flags, u16 category, u8 volume, s16 pitch, u8 priority, u16 size, u16 wave index, u8 wave bank index.
       Cue names: NUL-terminated strings in cue order.

Read-only: the caller passes bytes read from the player's own install (bbtag_read.read / read_fast).
"""
import hashlib, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def read_fast(logical):
    """bbtag_read.read with a numpy XOR (the voice bank is 47 MB)."""
    import numpy as np
    import bbtag_read as R
    name = R.asset_name(logical)
    p = os.path.join(R.INSTALL, "asset", name)
    R.note_read(logical)
    if not os.path.exists(p):
        raise FileNotFoundError(R.missing(logical))
    raw = np.fromfile(p, dtype=np.uint8)
    s = hashlib.md5(name.encode()).digest()[7] % 43
    k = np.frombuffer((R.KEY * (len(raw) // 43 + 2))[s:s + len(raw)], dtype=np.uint8)
    return (raw ^ k).tobytes()


def xwb(b):
    """-> (bank name, [entry dict]) with entry: index, tag (0 PCM, 1 XMA, 2 ADPCM, 3 xWMA), channels, rate, bits,
    block_align, samples, data (the raw wave bytes)."""
    if b[:4] != b"WBND":
        raise ValueError("not an XACT wave bank")
    segs = [struct.unpack_from("<II", b, 12 + 8 * i) for i in range(5)]
    bd = segs[0][0]
    flags, count = struct.unpack_from("<II", b, bd)
    name = b[bd + 8:bd + 72].split(b"\0")[0].decode("latin1")
    esz = struct.unpack_from("<I", b, bd + 72)[0]
    out = []
    for i in range(count):
        o = segs[1][0] + i * esz
        fd, fmt, po, pl = struct.unpack_from("<4I", b, o)
        e = dict(index=i, tag=fmt & 3, channels=(fmt >> 2) & 7, rate=(fmt >> 5) & 0x3FFFF, block_align=(fmt >> 23) & 0xFF,
                 bits=16 if fmt >> 31 else 8, duration=fd >> 4)
        e["data"] = b[segs[4][0] + po:segs[4][0] + po + pl]
        if e["tag"] == 0:
            e["samples"] = len(e["data"]) // (e["channels"] * e["bits"] // 8)
        out.append(e)
    return name, out


def xsb(b):
    """-> {cue name: (wave bank index, wave index)} for simple cues whose sound plays one wave (all of Ruby's)."""
    if b[:4] != b"SDBK":
        raise ValueError("not an XACT sound bank")
    ver = struct.unpack_from("<H", b, 4)[0]
    if ver != 46:
        raise ValueError("XSB version %d (only XACT 3 version 46 is known)" % ver)
    nsimple, ncomplex = struct.unpack_from("<hh", b, 0x13)
    so_simple, so_complex, so_names = struct.unpack_from("<iii", b, 0x22)
    names, o = [], so_names
    for _ in range(nsimple + ncomplex):
        e = b.index(b"\0", o); names.append(b[o:e].decode("latin1")); o = e + 1
    out = {}
    for i in range(nsimple):
        fl, so = struct.unpack_from("<BI", b, so_simple + 5 * i)
        sfl = b[so]
        if sfl & 1:
            raise ValueError("cue %s: complex sound (not handled)" % names[i])
        wi, wb = struct.unpack_from("<HB", b, so + 9)
        out[names[i]] = (wb, wi)
    if ncomplex:
        raise ValueError("%d complex cues (not handled)" % ncomplex)
    return out


def bank(logical):
    """An FPAC'd XACT bank from the install -> {cue name: wave entry}."""
    import bbtag_read as R
    files = R.fpac_files(read_fast(logical))
    sb = next(v for k, v in files.items() if k.endswith(".xsb"))
    wb = next(v for k, v in files.items() if k.endswith(".xwb"))
    _, waves = xwb(wb)
    return {n: waves[wi] for n, (bi, wi) in xsb(sb).items()}


def wav_bytes(e):
    """A RIFF WAVE file for a PCM entry."""
    if e["tag"] != 0:
        raise ValueError("wave %d is not PCM (format tag %d): a decoder such as vgmstream is needed" % (e["index"], e["tag"]))
    ch, rate, bits = e["channels"], e["rate"], e["bits"]
    ba = ch * bits // 8
    d = e["data"][:e["samples"] * ba]
    return (b"RIFF" + struct.pack("<I", 36 + len(d)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, ch, rate, rate * ba, ba, bits)
            + b"data" + struct.pack("<I", len(d)) + d)
