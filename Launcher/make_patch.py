r"""
make_patch.py  -- rebuild game bundles from edited data and stage them for the patch folder.

  python make_patch.py table <TableName> [<TableName> ...]     encode decoded\tables\<Name>.json -> bundle
  python make_patch.py js <data/js/path/Name> [...]              re-encode decoded\data\js\...\Name.js -> bundle
  python make_patch.py install <PatchAssetBundleDir>             copy everything in patch_out into the game's patch folder (non-merge builds)
  python make_patch.py install-steam                              Steam/merged-AB build: write patch_out bundles into ab\m_mod.m + repoint merge.json
  python make_patch.py uninstall-steam                            restore merge.json.orig and delete m_mod.m

Outputs go to C:\BBEE_Steam\patch_out\<logical bundle path>  (e.g. patch_out\data\xlsx\playerbattletriggerdetail.ab)
"""
import os, sys, json, struct, re, shutil, collections


ROOT = os.path.dirname(os.path.abspath(globals().get("__file__") or getattr(sys.modules["__main__"], "__file__", None)
                                       or os.path.join(os.getcwd(), "make_patch.py")))
while not os.path.exists(os.path.join(ROOT, "make_patch.py")) and os.path.dirname(ROOT) != ROOT:
    ROOT = os.path.dirname(ROOT)
AB = os.path.join(ROOT, r"game\BlazblueEntropyEffect_Data\StreamingAssets\ab")
DEC = os.path.join(ROOT, "decoded"); OUT = os.environ.get("BBMOD_OUT") or os.path.join(ROOT, "patch_out")
SCHEMA = json.load(open(os.path.join(ROOT, r"inspect\proto_schema.json"))) if os.path.exists(os.path.join(ROOT, r"inspect\proto_schema.json")) else {}
JSKEYS = json.load(open(os.path.join(ROOT, r"inspect\js_keys.json"))) if os.path.exists(os.path.join(ROOT, r"inspect\js_keys.json")) else {}
import UnityPy

def _steam_manifest(root):
    """<library>/steamapps/common/<game>  ->  <library>/steamapps/appmanifest_2273430.acf (any Steam library)"""
    try:
        g = os.path.realpath(os.path.join(root, "game"))
        cand = os.path.join(os.path.dirname(os.path.dirname(g)), "appmanifest_2273430.acf")
        if os.path.exists(cand): return cand
    except Exception: pass
    return r"C:\Program Files (x86)\Steam\steamapps\appmanifest_2273430.acf"
STEAM_MANIFEST = _steam_manifest(ROOT)
def current_build():
    try:
        m = re.search(r'"buildid"\s+"(\d+)"', open(STEAM_MANIFEST, encoding="utf-8").read()); return m.group(1) if m else None
    except OSError: return None
def backup_state(bak):
    """None = no backup; True = stamped for the installed build; False = stale (unstamped or another build)"""
    if not os.path.exists(bak): return None
    st = bak + ".build"
    return os.path.exists(st) and open(st, encoding="utf-8").read().strip() == (current_build() or "?")
def require_usable_backup(bak, what):
    if backup_state(bak) is False:
        stamp = open(bak + ".build", encoding="utf-8").read().strip() if os.path.exists(bak + ".build") else "unstamped (pre-guard)"
        raise SystemExit(
            f"REFUSING to {what}: {bak} is from game build {stamp}, but the installed game is build {current_build()}.\n"
            f"  Steam replaced the live index when it patched the game; this backup would write the OLD index back.\n"
            f"  Retire the stale backup (rename it, e.g. add .b<oldbuild>) so a fresh one is taken from the current game,\n"
            f"  then re-extract data for the new build before building mods. See docs/BUILD_UPDATE.md.")
def make_backup(src, bak):
    shutil.copy2(src, bak); open(bak + ".build", "w", encoding="utf-8").write(current_build() or "?")
def pristine_merge_path():
    live = os.path.join(AB, "merge.json"); bak = live + ".orig"
    if backup_state(bak): return bak
    if os.path.exists(live):
        if '"m_mod.m"' in open(live, encoding="utf-8").read():
            raise SystemExit("REFUSING to read bundles: merge.json contains modded entries and there is no backup for build "
                             f"{current_build()} to read pristine data from.")
        return live
    return None
_mp = pristine_merge_path()
merge = json.load(open(_mp, encoding="utf-8")) if _mp and os.path.exists(_mp) else []
by_file = collections.defaultdict(list)
for e in merge: by_file[e["m"]].append(e)
for m in by_file: by_file[m].sort(key=lambda e: e["s"])
def slice_bundle(entry):
    lst = by_file[entry["m"]]; i = lst.index(entry)
    p = os.path.join(AB, entry["m"]); end = lst[i+1]["s"] if i+1 < len(lst) else os.path.getsize(p)
    with open(p, "rb") as f: f.seek(entry["s"]); return f.read(end - entry["s"])
def find_entry(logical):
    return next(e for e in merge if e["r"] == logical)


VARINT = {"int","uint","long","ulong","bool","int32","uint32","int64","uint64","sbyte","byte","short","ushort"}
def wv(v):
    v &= (1 << 64) - 1; out = bytearray()
    while True:
        b = v & 0x7f; v >>= 7
        if v: out.append(b | 0x80)
        else: out.append(b); return bytes(out)
def tag(fnum, wt): return wv((fnum << 3) | wt)
def classify(pt):
    mp = re.match(r"MapField<(.+),\s*(.+)>", pt)
    if mp: return "map", (mp.group(1).strip(), mp.group(2).strip())
    rep = False; t = pt
    mm = re.match(r"RepeatedField<(.+)>", pt)
    if mm: rep = True; t = mm.group(1)
    t = t.strip()
    kind = "float" if t == "float" else "double" if t == "double" else "string" if t == "string" else "bytes" if t in ("ByteString","byte[]") else "msg" if t in SCHEMA else "varint"
    return ("rep_" if rep else "") + kind, t
def enc_scalar(kind, base, v):
    if kind == "float": return 5, struct.pack("<f", float(v))
    if kind == "double": return 1, struct.pack("<d", float(v))
    if kind == "string": b = str(v).encode("utf-8"); return 2, wv(len(b)) + b
    if kind == "bytes": b = bytes.fromhex(v); return 2, wv(len(b)) + b
    if kind == "msg": b = encode(v, base); return 2, wv(len(b)) + b
    if isinstance(v, str) and len(v) % 2 == 0 and re.fullmatch(r"[0-9a-f]+", v):





        hb = bytes.fromhex(v)
        try: hb.decode("utf-8")
        except UnicodeDecodeError: return 2, wv(len(hb)) + hb
    if isinstance(v, str) and not re.fullmatch(r"-?\d+", v):


        b = v.encode("utf-8", "surrogateescape"); return 2, wv(len(b)) + b
    return 0, wv(int(v) if not isinstance(v, bool) else int(v))
def encode(obj, cls):
    fields = SCHEMA.get(cls, {}); byname = {v[0]: (int(n), v[1]) for n, v in fields.items()}
    out = bytearray()
    for name, val in obj.items():
        if name not in byname:
            m = re.match(r"f(\d+)$", name)
            if not m: raise KeyError(f"{cls}.{name} not in schema")
            fnum, pt = int(m.group(1)), "?"
        else: fnum, pt = byname[name]
        kind, base = classify(pt)
        if kind == "map":
            kt, vt = base
            for k, v in val.items():
                kk, kb = classify(kt); vk, vb = classify(vt)
                kwt, kbytes = enc_scalar(kk.replace("rep_",""), kb, int(k) if kk == "varint" else k)
                vwt, vbytes = enc_scalar(vk.replace("rep_",""), vb, v)
                entry = tag(1, kwt) + kbytes + tag(2, vwt) + vbytes
                out += tag(fnum, 2) + wv(len(entry)) + entry
        elif kind == "rep_varint" and ".Types." in base and base.split(".Types.")[-1] in SCHEMA:





            raw = b"".join(wv(int(x)) for x in val)
            msgs, cur, i, last = [], bytearray(), 0, 0
            while i < len(raw):
                start = i; t, i = read_varint(raw, i); f, w = t >> 3, t & 7
                if w == 0: _, i = read_varint(raw, i)
                elif w == 2: ln, i = read_varint(raw, i); i += ln
                elif w == 5: i += 4
                elif w == 1: i += 8
                if cur and f <= last: msgs.append(bytes(cur)); cur = bytearray()
                cur += raw[start:i]; last = f
            if cur: msgs.append(bytes(cur))
            for m in msgs: out += tag(fnum, 2) + wv(len(m)) + m
        elif kind.startswith("rep_"):
            sk = kind[4:]
            if sk in ("varint", "float", "double"):
                body = b"".join(enc_scalar(sk, base, v)[1] for v in val)
                out += tag(fnum, 2) + wv(len(body)) + body
            else:
                for v in val:
                    wt, b = enc_scalar(sk, base, v); out += tag(fnum, wt) + b
        else:
            wt, b = enc_scalar(kind, base, val); out += tag(fnum, wt) + b
    return bytes(out)

def encode_table(name):
    rows = json.load(open(os.path.join(DEC, "tables", name + ".json"), encoding="utf-8"))
    cls = name if name in SCHEMA else None
    if cls is None: raise SystemExit(f"no schema for {name}")
    return b"".join(struct.pack("<I", len(b := encode(r, cls))) + b for r in rows)


def noah_xor(payload, key):
    k = key.to_bytes(4, "little"); out = bytearray(payload)
    for i in range(len(out)): out[i] ^= k[(i + (i >> 2)) & 3]
    return bytes(out)

def rebuild_bundle(logical, asset_name, new_bytes):
    entry = find_entry(logical)
    env = UnityPy.load(slice_bundle(entry))
    hit = False
    for obj in env.objects:
        if obj.type.name != "TextAsset": continue
        d = obj.read()
        if d.m_Name.lower() != asset_name.lower(): continue
        d.m_Script = new_bytes.decode("utf-8", "surrogateescape")
        d.save(); hit = True
    if not hit: raise SystemExit(f"TextAsset {asset_name} not found in {logical}")
    data = env.file.save(packer="lz4")
    outp = os.path.join(OUT, *logical.split("/"))
    os.makedirs(os.path.dirname(outp), exist_ok=True)
    open(outp, "wb").write(data)
    print(f"wrote {outp}  ({len(data)} bytes, original {entry['m']}@{entry['s']})")

def verify_table(name, raw):

    n = 0; i = 0
    while i + 4 <= len(raw):
        ln = struct.unpack_from("<I", raw, i)[0]; i += 4 + ln; n += 1
    print(f"  {name}: {n} rows, {len(raw)} bytes")



RAW = os.path.join(ROOT, "extracted_raw")
def to_fixed_row(r, cls):
    """convert float fields of a row to Fp longs according to the FixedPoint schema"""
    fields = SCHEMA[cls]; byname = {v[0]: v[1] for v in fields.values()}
    out = {}
    for k, v in r.items():
        pt = byname.get(k, "")
        base = pt[len("RepeatedField<"):-1] if pt.startswith("RepeatedField<") else pt
        if base not in SCHEMA and ".Types." in base: base = base.split(".Types.")[-1]
        if pt in ("long", "int64"): out[k] = int(round(float(v) * (1 << 32)))
        elif pt in ("RepeatedField<long>", "RepeatedField<int64>"): out[k] = [int(round(float(x) * (1 << 32))) for x in v]



        elif base in SCHEMA and isinstance(v, list): out[k] = [to_fixed_row(x, base) if isinstance(x, dict) else x for x in v]
        elif base in SCHEMA and isinstance(v, dict): out[k] = to_fixed_row(v, base)
        else: out[k] = v
    return out
def read_varint(b, i):
    s = 0; r = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if not c & 0x80: return r, i
def row_key(b, keys):
    """extract key field values (field numbers) from a protobuf row (varints only)"""
    i = 0; got = {}
    while i < len(b):
        t, i = read_varint(b, i); f, wt = t >> 3, t & 7
        if wt == 0: v, i = read_varint(b, i); got[f] = v
        elif wt == 2: ln, i = read_varint(b, i); i += ln
        elif wt == 5: i += 4
        elif wt == 1: i += 8
        else: raise ValueError(wt)
    return tuple(got.get(k, 0) for k in keys)
def encode_fixed_table(name, keyfields=None):
    """splice edited rows (JSON vs JSON.orig) into the original fixed-point binary, leaving other rows byte-identical"""
    fcls = name + "FixedPoint"
    if fcls not in SCHEMA: raise SystemExit(f"no FixedPoint schema for {name}")
    fields = SCHEMA[fcls]; fnum = {v[0]: int(n) for n, v in fields.items()}
    cur = json.load(open(os.path.join(DEC, "tables", name + ".json"), encoding="utf-8"))
    orig = json.load(open(os.path.join(DEC, "tables", name + ".json.orig"), encoding="utf-8"))
    if keyfields is None:
        keyfields = tuple(k for k in (("Idx",) if "Idx" in fnum else ("Id",)) + tuple(x for x in ("Lvl", "Quality") if x in fnum))
    keys = [fnum[k] for k in keyfields]
    kf = lambda r: tuple(int(r.get(k, 0)) for k in keyfields)
    oi = {kf(r): r for r in orig}; changed = {}; new_rows = []
    if len(oi) != len(orig):
        assert cur[:len(orig)] == orig, f"{name}: key fields {keyfields} are not unique; only appending rows is supported for this table"
        raw = open(os.path.join(RAW, "data", "xlsxfixed", name + "FixedPointWrap.bin"), "rb").read(); out = bytearray(raw)
        for a in cur[len(orig):]: body = encode(to_fixed_row(a, fcls), fcls); out += struct.pack("<I", len(body)) + body
        print(f"  {name}FixedPoint: positional mode, {len(cur) - len(orig)} rows appended"); return bytes(out)
    for a in cur:
        k = kf(a); b = oi.get(k)
        if b is None: new_rows.append(encode(to_fixed_row(a, fcls), fcls))
        elif a != b: changed[k] = encode(to_fixed_row(a, fcls), fcls)
    deleted = set(oi) - {kf(a) for a in cur}
    raw = open(os.path.join(RAW, "data", "xlsxfixed", name + "FixedPointWrap.bin"), "rb").read()
    out = bytearray(); i = 0; hits = 0; dropped = 0
    while i + 4 <= len(raw):
        ln = struct.unpack_from("<I", raw, i)[0]; body = raw[i+4:i+4+ln]; i += 4 + ln
        k = row_key(body, keys)
        if k in deleted: dropped += 1; continue
        if k in changed: body = changed[k]; hits += 1
        out += struct.pack("<I", len(body)) + body
    for body in new_rows: out += struct.pack("<I", len(body)) + body
    print(f"  {name}FixedPoint: {len(changed)} changed rows, {hits} spliced, {len(new_rows)} added, {dropped} deleted")
    return bytes(out)






MERGE = os.path.join(AB, "merge.json"); MERGE_BAK = MERGE + ".orig"; MODFILE = "m_mod.m"
def install_steam():
    require_usable_backup(MERGE_BAK, "install")
    if not os.path.exists(MERGE_BAK): make_backup(MERGE, MERGE_BAK)
    entries = json.load(open(MERGE_BAK, encoding="utf-8"))
    idx = {e["r"]: e for e in entries}
    blob = bytearray(); n = 0
    for dp, dn, fn in os.walk(OUT):
        for f in fn:
            if f.startswith("_"): continue
            p = os.path.join(dp, f); logical = os.path.relpath(p, OUT).replace("\\", "/")
            if logical not in idx:
                e = {"r": logical, "m": MODFILE, "s": 0}; entries.append(e); idx[logical] = e; print("NEW bundle entry:", logical)
            data = open(p, "rb").read()
            e = idx[logical]; e["m"] = MODFILE; e["s"] = type(e["s"])(len(blob)) if not isinstance(e["s"], str) else str(len(blob))
            blob += data; n += 1; print(f"  {logical} -> {MODFILE}@{len(blob)-len(data)} ({len(data)} bytes)")


    tmp_m, tmp_j = os.path.join(AB, MODFILE + ".new"), MERGE + ".new"
    with open(tmp_m, "wb") as f: f.write(blob)
    with open(tmp_j, "w", encoding="utf-8") as f: json.dump(entries, f, separators=(",", ":"), ensure_ascii=False)
    os.replace(tmp_m, os.path.join(AB, MODFILE)); os.replace(tmp_j, MERGE)
    print(f"installed {n} bundles into {os.path.join(AB, MODFILE)}; merge.json updated (backup: merge.json.orig)")
def uninstall_steam():
    require_usable_backup(MERGE_BAK, "uninstall")
    if os.path.exists(MERGE_BAK): shutil.copy2(MERGE_BAK, MERGE); print("merge.json restored")
    p = os.path.join(AB, MODFILE)
    if os.path.exists(p): os.remove(p); print("removed", p)

cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "table":
    for name in sys.argv[2:]:
        raw = encode_table(name); verify_table(name, raw)
        rebuild_bundle(f"data/xlsx/{name.lower()}.ab", name, raw)
        if name + "FixedPoint" in SCHEMA and os.path.exists(os.path.join(RAW, "data", "xlsxfixed", name + "FixedPointWrap.bin")):
            fraw = encode_fixed_table(name); verify_table(name + "FixedPointWrap", fraw)
            rebuild_bundle(f"data/xlsxfixed/{name.lower()}fixedpointwrap.ab", name + "FixedPointWrap", fraw)
elif cmd == "js":
    for lp in sys.argv[2:]:
        src = open(os.path.join(DEC, *lp.split("/")) + ".js", "rb").read()
        key = JSKEYS.get(lp)
        payload = b"NOAH" + noah_xor(src, int(key, 16)) if key else src
        rebuild_bundle(lp.lower() + ".ab", lp.split("/")[-1], payload)
elif cmd == "install":
    dest = sys.argv[2]
    n = 0
    for dp, dn, fn in os.walk(OUT):
        for f in fn:
            src = os.path.join(dp, f); rel = os.path.relpath(src, OUT)
            dst = os.path.join(dest, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst); n += 1; print("installed", dst)
    print(n, "files installed")
elif cmd == "install-steam": install_steam()
elif cmd == "uninstall-steam": uninstall_steam()
else:
    print(__doc__)
