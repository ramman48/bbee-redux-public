"""hca_crypt.py -- CRI HCA keyed encryption (cipher type 56), in plain Python.

Why: BBEE's CRI runtime (cri_ware_unity.dll) passes EVERY HCA frame through its decryption table, whatever the
file's own `ciph` field says. The table comes from the decrypter the game creates with its key (type 56), mixed with
the AWB's subkey. An unencrypted HCA is therefore "decrypted" into full-scale noise in game (the lead, 2026-10-02:
"the sound is very corrupted"). Every stock waveform is HCA with ciph 56; ours must be too. Evidence and the
disassembly: local_only/deltarune/party/audio/AUDIO_ROUTE.md, section 7.

The format (reverse-engineered by the community: vgmstream's clHCA.c, which this follows):
  key      an AWB with a non-zero subkey uses key * ((subkey << 16) | (u16)(~subkey + 2)), 64-bit wrap
  table    256-byte substitution built from the low 56 bits of (key - 1); 0x00 and 0xFF map to themselves, so a
           frame's 0xFFFF sync word stays readable
  frame    every byte of the frame goes through the table; the frame's last two bytes are a CRC16 (poly 0x8005) of
           the ENCRYPTED bytes before them
  header   `ciph` holds the type (0 none, 56 keyed); an encrypted file's chunk names have bit 7 set ("masked");
           the header's last two bytes are its CRC16
The key itself is the game's (KEY below), as published in vgmstream's hca_keys.h. It only makes our own sounds
readable by the game; nothing of the game's is decrypted or shipped by this module.
"""
import struct

KEY = 0x0069EC457894661F      # vgmstream hca_keys.h: "BlazBlue Entropy Effect (Early Access) (PC)"
_CHUNK = {b"fmt\0": 16, b"comp": 16, b"dec\0": 12, b"loop": 16, b"ciph": 6, b"rva\0": 8, b"vbr\0": 8, b"ath\0": 6}

_CRC = []
for _i in range(256):
    _c = _i << 8
    for _ in range(8):
        _c = ((_c << 1) ^ 0x8005) & 0xFFFF if _c & 0x8000 else (_c << 1) & 0xFFFF
    _CRC.append(_c)


def crc16(b):
    c = 0
    for x in b:
        c = ((c << 8) & 0xFFFF) ^ _CRC[(c >> 8) ^ x]
    return c


def derive(key, subkey):
    """The key an AWB with this subkey is read with."""
    if subkey:
        key = (key * ((subkey << 16) | ((~subkey + 2) & 0xFFFF))) & 0xFFFFFFFFFFFFFFFF
    return key


def _row(k):
    mul, add = ((k & 1) << 3) | 5, (k & 0xE) | 1
    k >>= 4
    out = []
    for _ in range(16):
        k = (k * mul + add) & 0xF
        out.append(k)
    return out


def table56(key):
    """The decryption table (plain = table[stored]) of a type-56 key."""
    if key:
        key -= 1
    kc = [(key >> (8 * i)) & 0xFF for i in range(7)]
    seed = [kc[1], kc[1] ^ kc[6], kc[2] ^ kc[3], kc[2], kc[2] ^ kc[1], kc[3] ^ kc[4], kc[3], kc[3] ^ kc[2],
            kc[4] ^ kc[5], kc[4], kc[4] ^ kc[3], kc[5] ^ kc[6], kc[5], kc[5] ^ kc[4], kc[6] ^ kc[1], kc[6]]
    base_r = _row(kc[0])
    base = []
    for r in range(16):
        nb = base_r[r] << 4
        base += [nb | c for c in _row(seed[r])]
    table, x = [0], 0
    for _ in range(256):
        x = (x + 17) & 0xFF
        if base[x] not in (0, 0xFF):
            table.append(base[x])
    table.append(0xFF)
    if len(table) != 256 or sorted(table) != list(range(256)):
        raise ValueError("HCA key %#x does not give a permutation" % key)
    return bytes(table)


def parse(h):
    """-> (header size, frame size, frame count, ciph type, offset of the ciph type)"""
    if bytes(c & 0x7F for c in h[:4]) != b"HCA\0":
        raise ValueError("not HCA")
    hs = struct.unpack_from(">H", h, 6)[0]
    p, frame, frames, ciph, ciph_at = 8, None, None, 0, None
    while p < hs - 2:
        tag = bytes(c & 0x7F for c in h[p:p + 4])
        if tag == b"fmt\0":
            frames = struct.unpack_from(">I", h, p + 8)[0]
        elif tag in (b"comp", b"dec\0"):
            frame = struct.unpack_from(">H", h, p + 4)[0]
        elif tag == b"ciph":
            ciph, ciph_at = struct.unpack_from(">H", h, p + 4)[0], p + 4
        if tag not in _CHUNK:
            break                                  # comm / pad: the rest of the header
        p += _CHUNK[tag]
    if frame is None or frames is None or ciph_at is None:
        raise ValueError("HCA header without fmt / comp / ciph")
    if len(h) < hs + frame * frames:
        raise ValueError("HCA shorter than its %d frames" % frames)
    return hs, frame, frames, ciph, ciph_at


def _header(h, hs, ciph_at, typ, masked):
    b = bytearray(h[:hs])
    struct.pack_into(">H", b, ciph_at, typ)
    p = 0
    while p < hs - 2:                                  # chunk names: bit 7 on every non-zero character when masked
        tag = bytes(c & 0x7F for c in b[p:p + 4])
        for i in range(4):
            b[p + i] = (tag[i] | 0x80) if (masked and tag[i]) else tag[i]
        if p == 0:
            p = 8
        elif tag in _CHUNK:
            p += _CHUNK[tag]
        else:
            break
    struct.pack_into(">H", b, hs - 2, crc16(bytes(b[:hs - 2])))
    return bytes(b)


def encrypt(h, key=KEY, subkey=0):
    """An unencrypted HCA -> the same audio stored as stock stores it: ciph 56, masked header, frames encrypted for
    (key, subkey). The frames' audio data is unchanged."""
    hs, frame, frames, ciph, ciph_at = parse(h)
    if ciph != 0:
        raise ValueError("HCA is already encrypted (ciph %d)" % ciph)
    t = table56(derive(key, subkey))
    inv = bytearray(256)
    for stored, plain in enumerate(t):
        inv[plain] = stored
    inv = bytes(inv)
    out = [_header(h, hs, ciph_at, 56, True)]
    for i in range(frames):
        f = h[hs + i * frame:hs + (i + 1) * frame]
        if f[:2] != b"\xff\xff" or crc16(f):
            raise ValueError("HCA frame %d: bad sync or CRC" % i)
        e = f[:-2].translate(inv)
        out.append(e + struct.pack(">H", crc16(e)))
    out.append(h[hs + frames * frame:])
    return b"".join(out)


def decrypt(h, key=KEY, subkey=0):
    """The reverse (for checks): a ciph 56 HCA -> unencrypted, unmasked."""
    hs, frame, frames, ciph, ciph_at = parse(h)
    if ciph != 56:
        raise ValueError("HCA ciph %d, expected 56" % ciph)
    t = table56(derive(key, subkey))
    out = [_header(h, hs, ciph_at, 0, False)]
    for i in range(frames):
        f = h[hs + i * frame:hs + (i + 1) * frame]
        if f[:2] != b"\xff\xff" or crc16(f):
            raise ValueError("HCA frame %d: bad sync or CRC" % i)
        d = f[:-2].translate(t)
        out.append(d + struct.pack(">H", crc16(d)))
    out.append(h[hs + frames * frame:])
    return b"".join(out)
