r"""savefile.py -- read (and, for the safe uninstall, clean) a BlazBlue Entropy Effect save. Standalone: needs only lz4.

A save file (…\LocalLow\91Act\BlazblueEntropyEffect\Steam\<account>\Save\1, and its Backup / ColdBackup copies) is an
LZ4 frame holding a protobuf DataSave:
  DataSave { 1 Id: string, 2 Messages: repeated Message {1 Type: string, 2 Data: bytes}, 5 Summary, 6 SavedTimes, ... }
Each Message.Data is one JS model (ModelPlayer, ModelBreedDungeon, …) serialized by the game's own protobuf types.

  python tools\savefile.py info <save file>            message types and where custom character ids appear
"""
import sys, os, lz4.frame

CUSTOM_MIN = 190000


def rv(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if not c & 0x80: return r, i


def wv(n):
    out = bytearray()
    while True:
        x = n & 0x7f; n >>= 7
        if n: out.append(x | 0x80)
        else: out.append(x); return bytes(out)


def fields(b):
    """[(field number, wire type, value bytes or int, raw slice)] for one protobuf message"""
    out = []; i = 0
    while i < len(b):
        start = i; t, i = rv(b, i); f, w = t >> 3, t & 7
        if w == 0: v, i = rv(b, i)
        elif w == 2: ln, i = rv(b, i); v = b[i:i + ln]; i += ln
        elif w == 5: v = b[i:i + 4]; i += 4
        elif w == 1: v = b[i:i + 8]; i += 8
        else: raise ValueError("wire type %d at %d" % (w, start))
        out.append((f, w, v, b[start:i]))
    return out


def load(path):
    return lz4.frame.decompress(open(path, "rb").read())


def messages(data):
    """[(type, data bytes)] of a DataSave"""
    out = []
    for f, w, v, _ in fields(data):
        if f == 2 and w == 2:
            t = d = None
            for f2, w2, v2, _ in fields(v):
                if f2 == 1: t = v2.decode("utf-8", "replace")
                elif f2 == 2: d = v2
            out.append((t, d))
    return out


def info(path):
    data = load(path)
    top = fields(data)
    print("file %s: %d bytes -> %d decompressed, %d top-level fields" % (path, os.path.getsize(path), len(data), len(top)))
    for t, d in messages(data):
        d = d or b""; hits = sum(d.count(wv(x)) for x in (200401, 200301, 200701))
        print("  %-28s %7d bytes%s" % (t, len(d), ("   custom-character ids: %d" % hits) if hits else ""))
    for f, w, v, raw in top:
        if f != 2:
            hits = sum(raw.count(wv(x)) for x in (200401, 200301, 200701))
            print("  field %-3d wire %d  %6d bytes%s" % (f, w, len(raw), ("   custom-character ids: %d" % hits) if hits else ""))












def _mod_actor_ids():
    """actor ids that mods add (from mods/* /mod.json and shared/* /mod.json next to this tool), plus every one this project has shipped.
    NOT a numeric range: a save also holds stock numbers in 190000+ (enemy ids 35xxxx / 90xxxx in the kill records)."""
    import re, glob
    ids = {190101, 200101, 200201, 200301, 200401, 200701, 200801}   # 200701: Ruby Rose (Cross Effect); 200801: Kris (DELTARUNE: Party)
    launcher_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    for d in ("shared", "mods"):
        for p in glob.glob(os.path.join(launcher_root, d, "*", "mod.json")):
            try: txt = open(p, encoding="utf-8").read()
            except OSError: continue
            for m in re.finditer(r'"ActorId":\s*(\d{6})', txt):
                n = int(m.group(1))
                if n >= 190000: ids.add(n)
    return ids
MOD_ACTORS = _mod_actor_ids()
def custom(n): return n in MOD_ACTORS


def key_of(entry):
    for f, w, v, _ in fields(entry):
        if f == 1 and w == 0: return v
    return None


def fes_id(entry):
    for f, w, v, _ in fields(entry):
        if f == 2 and w == 2:
            for f2, w2, v2, _ in fields(v):
                if f2 == 2 and w2 == 0: return v2
    return None


def fes_score(entry):
    import struct
    for f, w, v, _ in fields(entry):
        if f == 2 and w == 2:
            for f2, w2, v2, _ in fields(v):
                if f2 == 16 and w2 == 1: return struct.unpack("<d", v2)[0]
    return 0.0


def prune(msg, field_set, pred, removed, label):
    out = bytearray()
    for f, w, v, raw in fields(msg):
        if f in field_set and w == 2 and pred(v): removed.append((label, f, key_of(v))); continue
        out += raw
    return bytes(out)


def unpacked(v):
    """a length-delimited value read as packed varints, or None if it isn't one"""
    out, i = [], 0
    try:
        while i < len(v): x, i = rv(v, i); out.append(x)
    except IndexError: return None
    return out


def prune_packed(msg, field, removed, label):
    """remove mod-character ids from a packed repeated uint field (e.g. STPlayerDungeon.AllHiddenActor)"""
    out = bytearray()
    for f, w, v, raw in fields(msg):
        if f == field and w == 2:
            vals = unpacked(v)
            if vals is not None and any(custom(x) for x in vals):
                keep = [x for x in vals if not custom(x)]
                removed += [(label, f, x) for x in vals if custom(x)]
                if keep:
                    body = b"".join(wv(x) for x in keep); out += wv((f << 3) | 2) + wv(len(body)) + body
                continue
        out += raw
    return bytes(out)


def strip_inherited(entry, removed):
    """A kept Evotype (map entry {1 uid, 2 STFesActor}) without what it inherited from a mod character:
      STFesActor.17  Talents        {1 talent id, 2 level, 3 = 0 for its own | 4 = the character it came from}
      STFesActor.26  Legacy skills  {1 skill id, 2 level, 3 = the character it came from}
    The unmodded game has neither that skill nor its owner. Everything else in the Evotype stays byte for byte.
    Found 2026-10-03: a tester's uninstall of Nine stopped with "3 mod-character references would remain" (an Evotype of
    another character had taken Nine's Legacy skills and Talent); only the mod characters' OWN Evotypes were removed."""
    def fes(b):
        out = bytearray(); owner = None
        for f, w, v, raw in fields(b):
            if f == 2 and w == 0: owner = v
            if w == 2 and f in (17, 26):
                try: nums = {f2: v2 for f2, w2, v2, _ in fields(v) if w2 == 0}
                except Exception: nums = {}
                src = nums.get(4 if f == 17 else 3, 0)
                if custom(src):
                    removed.append(("inherited Talent" if f == 17 else "inherited Legacy skill", f,
                                    "%s, from character %s, on an Evotype of %s" % (nums.get(1), src, owner)))
                    continue
            out += raw
        return bytes(out)
    return edit(entry, 2, fes)


def strip_pack(pack, removed):
    """FesActorPack with strip_inherited applied to every Evotype left in it (field 1: map<uid, STFesActor>)"""
    out = bytearray()
    for f, w, v, raw in fields(pack):
        if f == 1 and w == 2:
            nv = strip_inherited(v, removed)
            out += raw if nv == v else wv((1 << 3) | 2) + wv(len(nv)) + nv
        else: out += raw
    return bytes(out)


def pattern_hits(b):
    """how often a mod-character id appears as a varint byte pattern anywhere (the strict final check)"""
    return sum(b.count(wv(x)) for x in MOD_ACTORS)


def edit(msg, field, fn):
    out = bytearray(); done = False
    for f, w, v, raw in fields(msg):
        if f == field and w == 2 and not done:
            nv = fn(v); out += wv((f << 3) | 2) + wv(len(nv)) + nv; done = True
        else: out += raw
    return bytes(out)


def each(msg, field, fn):
    """like edit, for every length-delimited occurrence of a repeated field"""
    out = bytearray()
    for f, w, v, raw in fields(msg):
        if f == field and w == 2:
            nv = fn(v); out += wv((f << 3) | 2) + wv(len(nv)) + nv
        else: out += raw
    return bytes(out)


def scan_custom(b, depth=0):
    """count of varint fields holding a custom-character id anywhere in b (nested messages parsed where they parse)"""
    n = 0
    try: fs = fields(b)
    except Exception: return 0
    for f, w, v, _ in fs:
        if w == 0 and custom(v): n += 1
        elif w == 2 and v and depth < 10: n += scan_custom(v, depth + 1)
    return n


def clean(data):
    """-> (new decompressed DataSave, report lines). Raises if a custom id would remain."""
    removed, notes = [], []
    msgs = dict(messages(data)); new = {}
    fp = msgs.get("ModelPlayerNewFesActorPack")
    if fp:
        new["ModelPlayerNewFesActorPack"] = edit(fp, 1, lambda pack: strip_pack(
            prune(prune(pack, {1}, lambda e: custom(fes_id(e) or 0), removed, "Evotype"),
                  {4}, lambda e: custom(key_of(e) or 0), removed, "Evotype slot"), removed))
    bp = msgs.get("ModelPlayerNewBaseActorPack")
    if bp: new["ModelPlayerNewBaseActorPack"] = edit(bp, 1, lambda pack: prune(pack, {1}, lambda e: custom(key_of(e) or 0), removed, "character"))
    di = msgs.get("ModelPlayerNewDungeonInfo")
    if di: new["ModelPlayerNewDungeonInfo"] = edit(di, 1, lambda dg: prune_packed(edit(dg, 5, lambda rec:
            prune(rec, {3, 8}, lambda e: custom(key_of(e) or 0), removed, "run record")), 8, removed, "hidden-character entry"))
    hr = msgs.get("ModelPlayerNewHeatRecord")
    if hr: new["ModelPlayerNewHeatRecord"] = edit(hr, 1, lambda h: prune(h, {3, 5, 7}, lambda e: custom(key_of(e) or 0), removed, "heat record"))
    # Found 2026-10-11: a tester who had played Trials and Boss Rush as a mod character could not uninstall
    # ("6 mod-character references would remain"). Four more places hold a character's id:
    cr = msgs.get("ModelPlayerNewRecord")            # .1 record > 3: per-character Trial record, keyed by character
    if cr: new["ModelPlayerNewRecord"] = edit(cr, 1, lambda r: prune(r, {2, 3}, lambda e: custom(key_of(e) or 0), removed, "Trial record"))
    br = msgs.get("ModelPlayerNewBossRushRecord")    # .1 > 1 > 2: per-character Boss Rush record, keyed by character
    if br: new["ModelPlayerNewBossRushRecord"] = edit(br, 1, lambda a: edit(a, 1, lambda r:
            prune(r, {2}, lambda e: custom(key_of(e) or 0), removed, "Boss Rush record")))
    bc = msgs.get("ModelBattleChallenge")            # .2 info > 1 records[id] > 2 BattleChallengeRecord: 1 finishActorId, 3 perfectFinishActorId
    if bc and pattern_hits(bc):                      # the Trial stays finished (2 finishTimes); only the character leaves its lists
        new["ModelBattleChallenge"] = edit(bc, 2, lambda info: each(info, 1, lambda rec: edit(rec, 2, lambda r:
            prune_packed(prune_packed(r, 1, removed, "Trial clear"), 3, removed, "Trial perfect clear"))))
    rush = msgs.get("ModelBattleBossRush")           # 11: packed list of characters
    if rush and pattern_hits(rush): new["ModelBattleBossRush"] = prune_packed(rush, 11, removed, "Boss Rush character")
    bd = msgs.get("ModelBreedDungeon")
    if bd and scan_custom(bd): new["ModelBreedDungeon"] = b""; notes.append("the run in progress used a mod character or Evotype: it was ended")

    best = (0, 0.0)
    pack = new.get("ModelPlayerNewFesActorPack")
    if pack:
        for f, w, v, _ in fields(pack):
            if f == 1 and w == 2:
                for f2, w2, e, _ in fields(v):
                    if f2 == 1 and w2 == 2:
                        s = fes_score(e)
                        if s > best[1]: best = (fes_id(e) or 0, s)
    out = bytearray()
    for f, w, v, raw in fields(data):
        if f == 2 and w == 2:
            t = next((v2.decode("utf-8", "replace") for f2, w2, v2, _ in fields(v) if f2 == 1), None)
            if t in new:
                body = bytearray()
                for f2, w2, v2, raw2 in fields(v):
                    if f2 == 2: body += wv((2 << 3) | 2) + wv(len(new[t])) + new[t]
                    else: body += raw2
                if not any(f2 == 2 for f2, _, _, _ in fields(v)):
                    body += wv((2 << 3) | 2) + wv(len(new[t])) + new[t]
                out += wv((2 << 3) | 2) + wv(len(body)) + body; continue
        if f == 5 and w == 2 and scan_custom(v):
            sm = bytearray()
            for f2, w2, v2, raw2 in fields(v):
                if f2 == 7: sm += wv(7 << 3) + wv(best[0])
                elif f2 == 8: sm += wv(8 << 3) + wv(int(best[1]))
                else: sm += raw2
            notes.append("save summary: best Evotype set to %s (score %d)" % (best[0] or "none", int(best[1])))
            out += wv((5 << 3) | 2) + wv(len(sm)) + bytes(sm); continue
        out += raw
    left = scan_custom(bytes(out)) + pattern_hits(bytes(out))
    if left: raise RuntimeError("%d mod-character references would remain; save NOT changed" % left)
    rep = ["removed %s (id %s)" % (lab, k) for lab, f, k in removed] + notes
    return bytes(out), rep







GRIM_HEAT = range(24, 41)
GRIM_PERK = range(30, 46)
GRIM_MUT_MIN = 6
GRIM_FN = range(17000000, 17001000)


def _prune_map(msg, fset, keys, removed, label):
    return prune(msg, fset, lambda e: (key_of(e) or 0) in keys, removed, label)


def _prune_packed_pred(msg, field, pred, removed, label):
    out = bytearray()
    for f, w, v, raw in fields(msg):
        if f == field and w == 2:
            vals = unpacked(v)
            if vals is not None and any(pred(x) for x in vals):
                keep = [x for x in vals if not pred(x)]; removed += [(label, f, x) for x in vals if pred(x)]
                if keep: body = b"".join(wv(x) for x in keep); out += wv((f << 3) | 2) + wv(len(body)) + body
                continue
        if f == field and w == 0 and pred(v): removed.append((label, f, v)); continue
        out += raw
    return bytes(out)


def _scan_range(b, rng, depth=0):
    n = 0
    try: fs = fields(b)
    except Exception: return 0
    for f, w, v, _ in fs:
        if w == 0 and v in rng: n += 1
        elif w == 2 and v and depth < 12: n += _scan_range(v, rng, depth + 1)
    return n


def clean_grim(data):
    """-> (new decompressed DataSave, report lines): the save without any entropy-grim id (Abyss ranks, Grim perks, Grim
    Mutations); a run in progress that uses Grim dungeon functions is ended. Every other byte stays identical."""
    removed, notes = [], []
    msgs = dict(messages(data)); new = {}
    hr = msgs.get("ModelPlayerNewHeatRecord")
    if hr:
        def heat(h):
            h = edit(h, 1, lambda sel: _prune_map(sel, {1, 2}, GRIM_HEAT, removed, "Abyss rank"))
            h = edit(h, 2, lambda eff: _prune_map(eff, {1, 2}, GRIM_PERK, removed, "Grim perk switch"))
            h = _prune_packed_pred(h, 10, lambda x: x >= GRIM_MUT_MIN, removed, "Grim Mutation (on)")
            return _prune_packed_pred(h, 9, lambda x: x >= GRIM_MUT_MIN, removed, "Grim Mutation (unlocked)")
        new["ModelPlayerNewHeatRecord"] = edit(hr, 1, heat)
    bd = msgs.get("ModelBreedDungeon")
    if bd and _scan_range(bd, GRIM_FN): new["ModelBreedDungeon"] = b""; notes.append("the run in progress used Grim functions: it was ended")
    out = bytearray()
    for f, w, v, raw in fields(data):
        if f == 2 and w == 2:
            t = next((v2.decode("utf-8", "replace") for f2, w2, v2, _ in fields(v) if f2 == 1), None)
            if t in new:
                body = bytearray()
                for f2, w2, v2, raw2 in fields(v):
                    body += (wv((2 << 3) | 2) + wv(len(new[t])) + new[t]) if f2 == 2 else raw2
                if not any(f2 == 2 for f2, _, _, _ in fields(v)): body += wv((2 << 3) | 2) + wv(len(new[t])) + new[t]
                out += wv((2 << 3) | 2) + wv(len(body)) + body; continue
        out += raw
    return bytes(out), ["removed %s (id %s)" % (lab, k) for lab, f, k in removed] + notes


def compress(data):
    return lz4.frame.compress(data, block_size=lz4.frame.BLOCKSIZE_MAX64KB, block_linked=False,
                              content_checksum=False, store_size=True)


def clean_file(path):
    """clean one save file in place (caller backs up first). Returns report lines, or [] if it had nothing to clean."""
    data = load(path)
    if not (scan_custom(data) or pattern_hits(data)): return []
    newdata, rep = clean(data)
    blob = compress(newdata)
    assert lz4.frame.decompress(blob) == newdata
    tmp = path + ".tmp"; open(tmp, "wb").write(blob); os.replace(tmp, path)
    return rep


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "info": info(sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == "clean-copy":
        nd, rep = clean(load(sys.argv[2])); open(sys.argv[3], "wb").write(compress(nd)); print("\n".join(rep))
    elif len(sys.argv) >= 3 and sys.argv[1] == "grim-info":
        _, rep = clean_grim(load(sys.argv[2])); print("\n".join(rep) or "no entropy-grim ids")
    elif len(sys.argv) >= 4 and sys.argv[1] == "clean-grim-copy":
        nd, rep = clean_grim(load(sys.argv[2])); open(sys.argv[3], "wb").write(compress(nd)); print("\n".join(rep) or "no entropy-grim ids")
    else: print(__doc__)
