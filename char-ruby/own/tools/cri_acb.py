"""cri_acb.py -- read and write CriWare @UTF tables, AFS2 archives and ACB cue sheets; read HCA headers.

BBEE plays every sound through CriWare ADX2 (docs/cross-effect/research/AUDIO.md): a cue name is looked up in
data/audiocollection, which names the cue sheet (an .acb file) and the cue's CRI id inside it. This module lets a build
step make a NEW cue sheet from a stock one (clone_acb): the stock ACB's structure, categories and ACF hash are kept, its
cues are replaced by ours (one waveform per cue), and the waveforms are embedded as an AFS2 archive (memory playback).

Formats (big-endian; reverse-engineered by the community, e.g. vgmstream's cri_utf.c and PyCriCodecs):
  @UTF   "@UTF", u32 size, u16 version, u16 rows_off, u32 strings_off, u32 data_off, u32 name_off, u16 ncols,
         u16 row_width, u32 nrows; then the schema (u8 flags|type, u32 name [, constant value]); offsets from +8.
         flags: 0x10 named, 0x20 constant (value in the schema), 0x40 per row.  types: 0 u8, 1 s8, 2 u16, 3 s16,
         4 u32, 5 s32, 6 u64, 7 s64, 8 f32, 9 f64, 0xA string (u32 into the string pool), 0xB data (u32 off, u32 size).
  AFS2   "AFS2", u8 version, u8 offset size, u16 id size, u32 count, u16 alignment, u16 subkey; ids; offsets (+end).
  HCA    "HCA\\0" (top bits may be set when masked), "fmt\\0" channels, rate, frames, "comp"/"dec" frame size, ...

No game or third-party data lives here; the caller reads the player's own files.
"""
import struct

_FMT = {0: ">B", 1: ">b", 2: ">H", 3: ">h", 4: ">I", 5: ">i", 6: ">Q", 7: ">q", 8: ">f", 9: ">d"}
_SIZE = {0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 8, 7: 8, 8: 4, 9: 8, 0xA: 4, 0xB: 8}
T_U8, T_S8, T_U16, T_S16, T_U32, T_S32, T_U64, T_S64, T_F32, T_F64, T_STR, T_DATA = range(12)


class Column:
    __slots__ = ("name", "flags", "type", "const")

    def __init__(self, name, flags, typ, const=None):
        self.name, self.flags, self.type, self.const = name, flags, typ, const

    @property
    def per_row(self):
        return bool(self.flags & 0x40)

    @property
    def constant(self):
        return bool(self.flags & 0x20)

    def __repr__(self):
        return "Column(%s, %#x, %d%s)" % (self.name, self.flags, self.type, ", const=%r" % (self.const,) if self.constant else "")


class UTF:
    """An @UTF table: name, version, columns [Column] and rows [dict name -> value]. Data columns hold bytes, string
    columns str. Constant columns keep their schema value (rows also show it, read-only)."""

    def __init__(self, name="", columns=None, rows=None, version=1, encoding="utf-8"):
        self.name, self.columns, self.rows, self.version, self.encoding = name, columns or [], rows or [], version, encoding

    # ------------------------------------------------------------------ read
    @classmethod
    def parse(cls, b, off=0, encoding=None):
        if b[off:off + 4] != b"@UTF":
            raise ValueError("not an @UTF table at %#x" % off)
        size = struct.unpack_from(">I", b, off + 4)[0]
        base = off + 8
        version, rows_off, str_off, data_off, name_off, ncols, row_w, nrows = struct.unpack_from(">HHIIIHHI", b, base)
        strs = b[base + str_off:base + data_off]
        enc = encoding or ("utf-8" if version >= 1 else "shift_jis")

        def s(o):
            e = strs.index(b"\0", o)
            return strs[o:e].decode(enc, "replace")

        def value(typ, p):
            if typ == T_STR:
                return s(struct.unpack_from(">I", b, p)[0])
            if typ == T_DATA:
                o, n = struct.unpack_from(">II", b, p)
                return bytes(b[base + data_off + o:base + data_off + o + n])
            return struct.unpack_from(_FMT[typ], b, p)[0]

        t = cls(s(name_off), [], [], version, enc)
        p = base + 0x18
        for _ in range(ncols):
            ft = b[p]; nm = struct.unpack_from(">I", b, p + 1)[0]; p += 5
            col = Column(s(nm) if ft & 0x10 else "", ft & 0xF0, ft & 0x0F)
            if col.constant:
                col.const = value(col.type, p); p += _SIZE[col.type]
            t.columns.append(col)
        for r in range(nrows):
            p = base + rows_off + r * row_w
            row = {}
            for c in t.columns:
                if c.per_row:
                    row[c.name] = value(c.type, p); p += _SIZE[c.type]
                elif c.constant:
                    row[c.name] = c.const
                else:
                    row[c.name] = None
            t.rows.append(row)
        t.size = size + 8
        return t

    def col(self, name):
        return next(c for c in self.columns if c.name == name)

    def has(self, name):
        return any(c.name == name for c in self.columns)

    # ------------------------------------------------------------------ write
    def build(self, top=False):
        """Serialize with the layout CRI's own ACB writer uses (checked byte-for-byte against stock BBEE ACBs):
        the string pool is the table name, the column names, then every string value in row order, never pooled;
        nested tables pack their data blobs back to back and pad the table to 4 bytes; the ACB header (top=True)
        starts its data area on a 32-byte boundary and follows every blob, and the last one, with 32 - (end % 32)
        bytes of padding (1..32)."""
        pool = bytearray()

        def sref(v):
            o = len(pool); pool.extend((v or "").encode(self.encoding) + b"\0")
            return o

        name_ref = sref(self.name)
        data = bytearray()

        def dref(v):
            if not v:
                return 0, 0
            o = len(data); data.extend(v)
            if top:
                data.extend(b"\0" * (32 - len(data) % 32))
            return o, len(v)

        def enc(typ, v):
            if typ == T_STR:
                return struct.pack(">I", sref(v))
            if typ == T_DATA:
                return struct.pack(">II", *dref(v))
            return struct.pack(_FMT[typ], v)

        schema = bytearray()
        for c in self.columns:
            schema.append(c.flags | c.type)
            schema += struct.pack(">I", sref(c.name) if c.flags & 0x10 else 0)
            if c.constant:
                schema += enc(c.type, c.const)
        row_w = sum(_SIZE[c.type] for c in self.columns if c.per_row)
        rows = bytearray()
        for r in self.rows:
            for c in self.columns:
                if c.per_row:
                    rows += enc(c.type, r.get(c.name))
        rows_off = 0x18 + len(schema)
        str_off = rows_off + len(rows)
        data_off = str_off + len(pool)
        if top:
            pad = (-(data_off + 8)) % 32
            pool.extend(b"\0" * pad); data_off += pad
        body = struct.pack(">HHIIIHHI", self.version, rows_off, str_off, data_off, name_ref, len(self.columns), row_w,
                           len(self.rows)) + bytes(schema) + bytes(rows) + bytes(pool) + bytes(data)
        if not top:
            body += b"\0" * ((-(8 + len(body))) % 4)
        return b"@UTF" + struct.pack(">I", len(body)) + body


# ---------------------------------------------------------------------- AFS2
def afs2_read(b):
    """-> (header dict, [(id, bytes)])"""
    if b[:4] != b"AFS2":
        raise ValueError("not AFS2")
    ver, osz, idsz, count, align, subkey = b[4], b[5], struct.unpack_from("<H", b, 6)[0], *struct.unpack_from("<IHH", b, 8)
    p = 0x10
    ids = [struct.unpack_from("<H" if idsz == 2 else "<I", b, p + i * idsz)[0] for i in range(count)]
    p += count * idsz
    fmt = {2: "<H", 4: "<I"}[osz]
    offs = [struct.unpack_from(fmt, b, p + i * osz)[0] for i in range(count + 1)]
    out = []
    for i in range(count):
        s = offs[i]; s += (-s) % align
        out.append((ids[i], bytes(b[s:offs[i + 1]])))
    return {"version": ver, "offset_size": osz, "id_size": idsz, "align": align, "subkey": subkey}, out


def afs2_build(files, align=32, version=2, offset_size=4, id_size=2, subkey=0):
    """files: [(id, bytes)] in id order. Offsets point at each file's unaligned start (the reader aligns them)."""
    count = len(files)
    head = 0x10 + count * id_size + (count + 1) * offset_size
    offs, body, pos = [], bytearray(), head
    for _, d in files:
        offs.append(pos)
        pad = (-pos) % align
        body += b"\0" * pad; body += d; pos += pad + len(d)
    offs.append(pos)
    out = bytearray(b"AFS2") + bytes([version, offset_size]) + struct.pack("<HIHH", id_size, count, align, subkey)
    for i, _ in files:
        out += struct.pack("<H" if id_size == 2 else "<I", i)
    for o in offs:
        out += struct.pack("<H" if offset_size == 2 else "<I", o)
    return bytes(out + body)


# ---------------------------------------------------------------------- HCA
def hca_info(b):
    """channels, sample rate, frame count, samples (without the encoder delay / padding), encryption type."""
    if (b[0] & 0x7F, b[1] & 0x7F, b[2] & 0x7F) != (ord("H"), ord("C"), ord("A")):
        raise ValueError("not HCA")
    hsize = struct.unpack_from(">H", b, 6)[0]
    info = {"header_size": hsize, "ciph": 0, "version": struct.unpack_from(">H", b, 4)[0]}
    p = 8
    while p < hsize - 2:
        tag = bytes(c & 0x7F for c in b[p:p + 4])
        if tag == b"fmt\0":
            ch = b[p + 4]; rate = int.from_bytes(b[p + 5:p + 8], "big")
            frames, delay, pad = struct.unpack_from(">IHH", b, p + 8)
            info.update(channels=ch, rate=rate, frames=frames, delay=delay, padding=pad)
            p += 16
        elif tag == b"comp":
            info["frame_size"] = struct.unpack_from(">H", b, p + 4)[0]; p += 16
        elif tag == b"dec\0":
            info["frame_size"] = struct.unpack_from(">H", b, p + 4)[0]; p += 12
        elif tag == b"loop":
            info["loop"] = struct.unpack_from(">II", b, p + 4); p += 16
        elif tag == b"ciph":
            info["ciph"] = struct.unpack_from(">H", b, p + 4)[0]; p += 6
        elif tag == b"rva\0":
            p += 8
        elif tag == b"vbr\0":
            p += 8
        elif tag == b"ath\0":
            p += 6
        elif tag == b"comm":
            p = hsize
        elif tag == b"pad\0":
            p = hsize
        else:
            break
    info["samples"] = info["frames"] * 1024 - info.get("delay", 0) - info.get("padding", 0)
    return info


# ---------------------------------------------------------------------- commands
def cmd_ops(blob):
    """A command blob (u16 op, u8 size, payload)* -> [(op, payload)]; an event list's (0, b"") terminator is kept."""
    out, p = [], 0
    while p + 3 <= len(blob):
        op, n = struct.unpack_from(">HB", blob, p)
        out.append((op, bytes(blob[p + 3:p + 3 + n]))); p += 3 + n
    return out


def cmd_blob(ops):
    return b"".join(struct.pack(">HB", op, len(d)) + d for op, d in ops)


def cmd_get(blob, op):
    return next((d for o, d in cmd_ops(blob) if o == op), None)


def cmd_set(blob, op, payload):
    ops = cmd_ops(blob)
    if not any(o == op for o, _ in ops):
        raise KeyError("command %#06x not in blob" % op)
    return cmd_blob([(o, payload if o == op else d) for o, d in ops])


OP_NOTE_ON, OP_DELAY, OP_CUE_LIMIT, OP_CUE_PRIORITY, OP_CATEGORY, OP_VOLUME = 0x07D0, 0x07D1, 0x004F, 0x0050, 0x0041, 0x0094
OP_PROBABILITY = 0x002B   # u8 percent a cue plays when triggered (stock: 100; vo_bl_attack1 50, vo_bl_standby1 20)
REF_WAVEFORM, REF_SYNTH, REF_SEQUENCE = 1, 2, 3


# ---------------------------------------------------------------------- ACB
class Acb:
    """An ACB's header table and its nested tables."""

    def __init__(self, data):
        self.head = UTF.parse(data)
        self.row = self.head.rows[0]
        self.t = {k: UTF.parse(v) for k, v in self.row.items() if isinstance(v, bytes) and v[:4] == b"@UTF"}

    def cue_names(self):
        return {r["CueName"]: r["CueIndex"] for r in self.t["CueNameTable"].rows}

    def seq_tracks(self, i):
        ti = self.t["SequenceTable"].rows[i]["TrackIndex"]
        return [struct.unpack_from(">H", ti, k)[0] for k in range(0, len(ti), 2)]

    def track_notes(self, i):
        ev = self.t["TrackTable"].rows[i]["EventIndex"]
        if ev == 0xFFFF:
            return []
        return [struct.unpack(">HH", d[:4]) for o, d in cmd_ops(self.t["TrackEventTable"].rows[ev]["Command"]) if o == OP_NOTE_ON]

    def synth_items(self, i):
        ri = self.t["SynthTable"].rows[i]["ReferenceItems"]
        return [struct.unpack_from(">HH", ri, k) for k in range(0, len(ri), 4)]

    def cue_waveforms(self, cue_index):
        """Every waveform row a cue can reach (Cue -> Sequence -> Track -> note-on -> Synth / Sequence -> Waveform)."""
        c = self.t["CueTable"].rows[cue_index]
        out, seen = [], set()

        def walk(kind, i):
            if (kind, i) in seen:
                return
            seen.add((kind, i))
            if kind == REF_WAVEFORM:
                out.append(i)
            elif kind == REF_SYNTH:
                for k, j in self.synth_items(i):
                    walk(k, j)
            elif kind == REF_SEQUENCE:
                for tr in self.seq_tracks(i):
                    for k, j in self.track_notes(tr):
                        walk(k, j)
        walk(c["ReferenceType"], c["ReferenceIndex"])
        return out

    def memory_awb(self):
        return afs2_read(self.row["AwbFile"])[1] if self.row.get("AwbFile") else []


def clone_acb(template, exemplar, name, cues, waves, guid, voice=False, probability=100):
    """A new memory ACB with the template's header, categories, selectors, ACF hash and aux tables, whose cues all
    copy the object tree of one stock cue (`exemplar`, by name):

      voice=False  Sequence (1 track) -> Track -> Synth -> Waveform         e.g. sfx_rg's sfx_rg_attackUp
      voice=True   Switch sequence (the voice_type selector, 2 tracks) -> per branch a random-no-repeat Sequence ->
                   one Track -> Synth -> Waveform per variant               e.g. vo_role_bl's vo_bl_attack1
                   (both branches play the same variants, as stock attack voices do)

    cues:  [{"name", "waves": [indices into waves], "priority": int or None}] (voice: the SeqCommand's 0x0050 cue
           priority, which mirrors the collection's Priority); the CueId is the position in this list, i.e. the
           CriwareId the audio collection must carry. Sets c["cue_id"] and c["length_ms"].
    waves: [{"hca": bytes}]; channels, rate and samples come from each HCA header (sets w["info"]). They are stored
           in memory (AFS2 AwbFile, ids 0..n-1, subkey 0: the HCA files are unencrypted).
    guid:  16 bytes (AcbGuid).
    probability: the top sequence's play probability in percent (0x002B), replacing the exemplar's (a move decides
           when she speaks; the cue must not drop lines at random). A cue dict's own "probability" overrides it for
           that cue (stock voice cues carry their own chance: grunts 60-75 %, idles 25-40 %).
    The template's cue-limit command (0x004F: u16 limit, u16 slot, u8 mode) keeps its limit and mode; each cue gets
    its own slot, and the work table is sized as CRI sizes it (48 x lists + 16 x nodes + 8 zero bytes: fitted
    exactly on 137 stock ACBs; lists = limited cues, nodes = sum of their limits)."""
    A = Acb(template)
    T = A.t
    names = A.cue_names()
    if exemplar not in names:
        raise KeyError("exemplar cue %s not in the template" % exemplar)
    ex = T["CueTable"].rows[names[exemplar]]
    if ex["ReferenceType"] != REF_SEQUENCE:
        raise ValueError("exemplar %s does not start with a sequence" % exemplar)
    SEQ, TRK, EV, SYN = T["SequenceTable"].rows, T["TrackTable"].rows, T["TrackEventTable"].rows, T["SynthTable"].rows
    SC, TC, YC, WAV = T["SeqCommandTable"].rows, T["TrackCommandTable"].rows, T["SynthCommandTable"].rows, T["WaveformTable"].rows

    def leaf(track_i):
        """exemplar Track -> (track row, event blob, track command, synth row, synth command, waveform row)"""
        notes = A.track_notes(track_i)
        if len(notes) != 1 or notes[0][0] != REF_SYNTH:
            raise ValueError("exemplar track %d is not a single synth note" % track_i)
        sy = notes[0][1]; items = A.synth_items(sy)
        if len(items) != 1 or items[0][0] != REF_WAVEFORM:
            raise ValueError("exemplar synth %d is not a single waveform" % sy)
        tr = TRK[track_i]
        return (tr, EV[tr["EventIndex"]]["Command"], TC[tr["CommandIndex"]]["Command"], SYN[sy],
                YC[SYN[sy]["CommandIndex"]]["Command"], WAV[items[0][1]])

    top = SEQ[ex["ReferenceIndex"]]
    top_tracks = A.seq_tracks(ex["ReferenceIndex"])
    if voice:
        if top["Type"] != 7 or len(top_tracks) != 2:
            raise ValueError("voice exemplar %s is not a two-branch switch" % exemplar)
        branches = []
        for bt in top_tracks:
            notes = A.track_notes(bt)
            if len(notes) != 1 or notes[0][0] != REF_SEQUENCE:
                raise ValueError("voice exemplar branch track %d is not a sub-sequence" % bt)
            sub = notes[0][1]; sub_tracks = A.seq_tracks(sub)
            if not sub_tracks:
                raise ValueError("voice exemplar branch %d is empty" % bt)
            branches.append((TRK[bt], EV[TRK[bt]["EventIndex"]]["Command"], TC[TRK[bt]["CommandIndex"]]["Command"],
                             SEQ[sub], SC[SEQ[sub]["CommandIndex"]]["Command"], leaf(sub_tracks[0])))
        wave_t = branches[0][5][5]
    else:
        if len(top_tracks) != 1:
            raise ValueError("sfx exemplar %s has %d tracks" % (exemplar, len(top_tracks)))
        simple = leaf(top_tracks[0])
        wave_t = simple[5]
    top_cmd = SC[top["CommandIndex"]]["Command"]
    limit = cmd_get(top_cmd, OP_CUE_LIMIT)

    out = {k: [] for k in ("CueTable", "SequenceTable", "SeqCommandTable", "TrackTable", "TrackCommandTable",
                           "TrackEventTable", "SynthTable", "SynthCommandTable", "WaveformTable")}

    def add(table, row):
        out[table].append(row)
        return len(out[table]) - 1

    def note(ev_blob, kind, index):
        ops = []
        for o, d in cmd_ops(ev_blob):
            if o == OP_DELAY:
                d = bytes(len(d))
            elif o == OP_NOTE_ON:
                d = struct.pack(">HH", kind, index) + d[4:]
            ops.append((o, d))
        return cmd_blob(ops)

    def add_seq(row_t, cmd, tracks, values=None):
        i = len(out["SequenceTable"])
        r = dict(row_t)
        r["NumTracks"] = len(tracks)
        r["TrackIndex"] = b"".join(struct.pack(">H", x) for x in tracks)
        if values is not None:
            r["TrackValues"] = values
        r["CommandIndex"] = add("SeqCommandTable", {"Command": cmd})
        r["ControlWorkArea1"] = i
        if r.get("NumPlaybackTrackNoHistories"):
            # random-no-repeat sequences: the blob starts with the sequence's own index (true for all 219 such
            # sequences in vo_role_bl and sfx_no), optionally followed by seeded history entries; ours keep none
            r["NumPlaybackTrackNoHistories"] = struct.pack(">H", i)
        return add("SequenceTable", r)

    def add_track(row_t, ev_blob, cmd, kind, index):
        r = dict(row_t)
        r["EventIndex"] = add("TrackEventTable", {"Command": note(ev_blob, kind, index)})
        r["CommandIndex"] = add("TrackCommandTable", {"Command": cmd})
        return add("TrackTable", r)

    def add_leaf(lf, wave_row):
        tr, ev_b, tc, syn_t, yc, _ = lf
        si = len(out["SynthTable"])
        s = dict(syn_t)
        s["ReferenceItems"] = struct.pack(">HH", REF_WAVEFORM, wave_row)
        s["CommandIndex"] = add("SynthCommandTable", {"Command": yc})
        s["ControlWorkArea1"] = s["ControlWorkArea2"] = si
        add("SynthTable", s)
        return add_track(tr, ev_b, tc, REF_SYNTH, si)

    awb = []
    for wi, w in enumerate(waves):
        h = hca_info(w["hca"])
        if h["ciph"] != 0:
            raise ValueError("wave %d: encrypted HCA" % wi)
        r = dict(wave_t)
        r.update(MemoryAwbId=wi, EncodeType=2, Streaming=0, NumChannels=h["channels"], SamplingRate=h["rate"],
                 NumSamples=h["samples"])
        add("WaveformTable", r)
        awb.append((wi, w["hca"]))
        w["info"] = h

    n_lim = n_nodes = 0
    for ci, c in enumerate(cues):
        if not c["waves"]:
            raise ValueError("cue %s has no waveform" % c["name"])
        cmd = top_cmd
        if limit is not None:
            lim_n, _, mode = struct.unpack(">HHB", limit[:5])
            cmd = cmd_set(cmd, OP_CUE_LIMIT, struct.pack(">HHB", lim_n, n_lim, mode) + limit[5:])
            n_lim += 1; n_nodes += lim_n
        prob = c.get("probability", probability)       # a cue's own chance (its "probability"), else the sheet's
        if prob is not None and cmd_get(cmd, OP_PROBABILITY) is not None:
            cmd = cmd_set(cmd, OP_PROBABILITY, bytes([max(0, min(100, int(prob)))]))
        if c.get("priority") is not None and cmd_get(cmd, OP_CUE_PRIORITY) is not None:
            pr = cmd_get(cmd, OP_CUE_PRIORITY)
            cmd = cmd_set(cmd, OP_CUE_PRIORITY, bytes([pr[0] or 1, max(0, min(255, int(c["priority"])))]))
        if voice:
            btracks = []
            for (bt, bev, btc, sub_t, subc, lf) in branches:
                leaves = [add_leaf(lf, w) for w in c["waves"]]
                vals = struct.pack(">H", 100) * len(leaves) if sub_t["Type"] in (2, 3, 4) else None
                sub = add_seq(sub_t, subc, leaves, vals)
                btracks.append(add_track(bt, bev, btc, REF_SEQUENCE, sub))
            seq_i = add_seq(top, cmd, btracks)
        else:
            if len(c["waves"]) != 1:
                raise ValueError("sfx cue %s: one waveform per cue" % c["name"])
            seq_i = add_seq(top, cmd, [add_leaf(simple, c["waves"][0])])
        length = max(waves[w]["info"]["samples"] * 1000 // waves[w]["info"]["rate"] for w in c["waves"])
        r = dict(ex)
        r.update(CueId=ci, ReferenceType=REF_SEQUENCE, ReferenceIndex=seq_i, Length=length,
                 NumRelatedWaveforms=len(set(c["waves"])))
        add("CueTable", r)
        c["cue_id"], c["length_ms"] = ci, length

    row = dict(A.row)
    for k, rows in out.items():
        tb = T[k]
        row[k] = UTF(tb.name, tb.columns, rows, tb.version, tb.encoding).build()
    cn = T["CueNameTable"]
    order = sorted(range(len(cues)), key=lambda i: cues[i]["name"].encode("utf-8"))
    row["CueNameTable"] = UTF(cn.name, cn.columns, [{"CueName": cues[i]["name"], "CueIndex": i} for i in order],
                              cn.version, cn.encoding).build()
    h, _ = afs2_read(A.row["AwbFile"])
    row["AwbFile"] = afs2_build(awb, align=h["align"], version=h["version"], offset_size=h["offset_size"],
                                id_size=h["id_size"], subkey=0)
    row["NumCueLimitListWorks"], row["NumCueLimitNodeWorks"] = n_lim, n_nodes
    row["CueLimitWorkTable"] = bytes(48 * n_lim + 16 * n_nodes + 8) if n_lim else b""
    row["Name"] = name
    row["AcbGuid"] = guid
    return UTF(A.head.name, A.head.columns, [row], A.head.version, A.head.encoding).build(top=True)
