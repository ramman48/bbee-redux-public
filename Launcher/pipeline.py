import os, sys, re, json, struct, collections, shutil
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(ROOT, "game")
AB = os.path.join(GAME, r"BlazblueEntropyEffect_Data\StreamingAssets\ab")
DUMP = os.path.join(ROOT, r"dump\dump.cs")
RAW = os.path.join(ROOT, "extracted_raw"); DEC = os.path.join(ROOT, "decoded")
INS = os.path.join(ROOT, "inspect"); TOUT = os.path.join(DEC, "tables")
for d in (RAW, DEC, INS, TOUT): os.makedirs(d, exist_ok=True)
import UnityPy, lz4.frame


man = lz4.frame.decompress(open(os.path.join(AB, "manifest"), "rb").read())
open(os.path.join(INS, "manifest_decoded.txt"), "wb").write(man)


_mlive = os.path.join(AB, "merge.json"); _morig = _mlive + ".orig"
_msrc = _mlive
if '"m_mod.m"' in open(_mlive, encoding="utf-8").read():
    _stamp = open(_morig + ".build").read().strip() if os.path.exists(_morig + ".build") else None
    _acf = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(GAME))), "appmanifest_2273430.acf"))
    _now = re.search(r'"buildid"\s+"(\d+)"', open(_acf, encoding="utf-8", errors="replace").read()).group(1) if os.path.exists(_acf) else None
    if os.path.exists(_morig) and _stamp and _stamp == _now:
        _msrc = _morig; print("mods are installed: decoding the pristine backup merge.json.orig (build %s)" % _stamp)
    else:
        sys.exit("merge.json is modded and there is no pristine backup for this game build. Run `python bbmod.py uninstall` "
                 "(or Steam 'Verify integrity'), then pipeline.py again. See docs/BUILD_UPDATE.md.")
merge = json.load(open(_msrc, encoding="utf-8"))
open(os.path.join(INS, "logical_bundles.txt"), "w", encoding="utf-8").write("\n".join(sorted(e["r"] for e in merge)))
by_file = collections.defaultdict(list)
for e in merge: by_file[e["m"]].append(e)
for m in by_file: by_file[m].sort(key=lambda e: e["s"])
def slice_bundle(entry):
    lst = by_file[entry["m"]]; i = lst.index(entry)
    p = os.path.join(AB, entry["m"]); end = lst[i+1]["s"] if i+1 < len(lst) else os.path.getsize(p)
    with open(p, "rb") as f: f.seek(entry["s"]); return f.read(end - entry["s"])
print("logical bundles:", len(merge))


count = 0
for e in merge:
    if not e["r"].startswith("data/"): continue
    try: env = UnityPy.load(slice_bundle(e))
    except Exception: continue
    for obj in env.objects:
        if obj.type.name != "TextAsset": continue
        d = obj.read(); s = d.m_Script
        raw = s.encode("utf-8", "surrogateescape") if isinstance(s, str) else bytes(s)
        rel = e["r"][:-3] if e["r"].endswith(".ab") else e["r"]
        outdir = os.path.join(RAW, *rel.split("/")[:-1]); os.makedirs(outdir, exist_ok=True)
        open(os.path.join(outdir, d.m_Name + ".bin"), "wb").write(raw); count += 1
print("raw text assets:", count)


def noah_xor(payload, key):
    k = key.to_bytes(4, "little"); out = bytearray(payload)
    for i in range(len(out)): out[i] ^= k[(i + (i >> 2)) & 3]
    return bytes(out)
js_ok = js_bad = 0; keys = {}
for dp, dn, fn in os.walk(RAW):
    for f in fn:
        p = os.path.join(dp, f); b = open(p, "rb").read()
        rel = os.path.relpath(p, RAW); base = os.path.join(DEC, rel[:-4]); os.makedirs(os.path.dirname(base), exist_ok=True)
        if b[:4] != b"NOAH":
            ext = ".json" if b[:1] in b"{[" else ".bin"
            open(base + ext, "wb").write(b); continue
        key = int.from_bytes(bytes(b[4+i] ^ b'"use'[i] for i in range(4)), "little")
        dec = noah_xor(b[4:], key)
        if dec[:12] == b'"use strict"':
            open(base + ".js", "wb").write(dec); keys[rel.replace("\\", "/")[:-4]] = key; js_ok += 1
        else:
            open(base + ".noah", "wb").write(b); js_bad += 1
json.dump({k: f"0x{v:08x}" for k, v in keys.items()}, open(os.path.join(INS, "js_keys.json"), "w"), indent=1)
print(f"JS decoded: {js_ok}, unresolved: {js_bad}  (keys saved to inspect\\js_keys.json)")




def _steam_manifest(root):
    """<library>/steamapps/common/<game>  ->  <library>/steamapps/appmanifest_2273430.acf (any Steam library)"""
    try:
        g = os.path.realpath(os.path.join(root, "game"))
        cand = os.path.join(os.path.dirname(os.path.dirname(g)), "appmanifest_2273430.acf")
        if os.path.exists(cand): return cand
    except Exception: pass
    return r"C:\Program Files (x86)\Steam\steamapps\appmanifest_2273430.acf"
def _build_id():
    try:
        acf = open(_steam_manifest(ROOT), encoding="utf-8", errors="replace").read()
        return re.search(r'"buildid"\s+"(\d+)"', acf).group(1)
    except Exception: return "unknown"
SNAP = os.path.join(ROOT, "tools", "schema", _build_id())
if os.path.exists(DUMP):
    text = open(DUMP, encoding="utf-8", errors="replace").read()
    blocks = re.split(r"(?m)^(?=// Namespace: )", text)
    schema = {}; enums = set()
    for b in blocks:
        m = re.search(r"(?m)^[^\n]*?(class|struct|enum|interface)\s+([\w\.]+)[^\n]*// TypeDefIndex: (\d+)", b)
        if not m: continue
        if m.group(1) == "enum": enums.add(m.group(2).split(".")[-1]); continue
        nums = dict(re.findall(r"public const int (\w+)FieldNumber = (\d+);", b))
        if not nums: continue
        props = {pm.group(2): pm.group(1) for pm in re.finditer(r"public ([\w\.<>, `]+?) (\w+) \{ get;", b)}
        schema[m.group(2).split(".")[-1]] = {int(n): (fn, props.get(fn, "?")) for fn, n in nums.items()}
    os.makedirs(SNAP, exist_ok=True)
    json.dump({"schema": {k: {str(n): v for n, v in f.items()} for k, f in schema.items()}, "enums": sorted(enums)},
              open(os.path.join(SNAP, "proto_schema_snapshot.json"), "w"))
else:
    _sp = os.path.join(SNAP, "proto_schema_snapshot.json")
    if not os.path.exists(_sp):
        sys.exit("No dump/dump.cs and no schema snapshot for game build %s. See docs/BUILD_UPDATE.md." % os.path.basename(SNAP))
    _snap = json.load(open(_sp)); enums = set(_snap["enums"])
    schema = {k: {int(n): tuple(v) for n, v in f.items()} for k, f in _snap["schema"].items()}
    print("proto schema: using snapshot", _sp)
json.dump({k: {str(n): v for n, v in f.items()} for k, f in schema.items()}, open(os.path.join(INS, "proto_schema.json"), "w"), indent=1)
print("proto types:", len(schema))

VARINT = {"int","uint","long","ulong","bool","int32","uint32","int64","uint64","sbyte","byte","short","ushort"}
def rv(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if not c & 0x80: return r, i
# The schema keeps a nested message under its short name (Pair) while a field names it in full
# (AnalyticEventConf.Types.Pair). Left unresolved, such a field decodes as raw varints, and make_patch.py and the
# mods' row overrides are written against that raw form, so it stays the default. NESTED is switched on only to
# read a table again that the raw form cannot read at all (a nested message that holds strings).
NESTED = False
def classify(pt):
    mp = re.match(r"MapField<(.+),\s*(.+)>", pt)
    if mp: return "map", (mp.group(1).strip(), mp.group(2).strip())
    rep = False; t = pt
    mm = re.match(r"RepeatedField<(.+)>", pt)
    if mm: rep = True; t = mm.group(1)
    t = t.strip()
    if NESTED and t not in schema and t.split(".Types.")[-1] in schema: t = t.split(".Types.")[-1]
    kind = "float" if t == "float" else "double" if t == "double" else "string" if t == "string" else "bytes" if t in ("ByteString","byte[]") else "msg" if t in schema else "varint"
    return ("rep_" if rep else "") + kind, t
def dmsg(b, cls):
    fields = schema.get(cls, {}); out = {}; i = 0
    while i < len(b):
        tag, i = rv(b, i); fnum, wt = tag >> 3, tag & 7
        fname, pt = fields.get(fnum, (f"f{fnum}", "?")); kind, base = classify(pt)
        if wt == 0:
            v, i = rv(b, i)
            if base == "bool": v = bool(v)
            elif base in ("int","int32") and v >= 1<<31: v -= 1<<32
            elif base in ("long","int64") and v >= 1<<63: v -= 1<<64
            val = v
        elif wt == 1: val = struct.unpack_from("<d" if "double" in kind else "<Q", b, i)[0]; i += 8
        elif wt == 5: val = struct.unpack_from("<f" if "float" in kind else "<I", b, i)[0]; i += 4
        elif wt == 2:
            ln, i = rv(b, i); ch = b[i:i+ln]; i += ln
            if kind == "map":
                kt, vt = base; k = v = None; j = 0
                while j < len(ch):
                    t2, j = rv(ch, j); f2, w2 = t2 >> 3, t2 & 7; tt = kt if f2 == 1 else vt
                    if w2 == 0: x, j = rv(ch, j)
                    elif w2 == 5: x = struct.unpack_from("<f" if tt == "float" else "<I", ch, j)[0]; j += 4
                    elif w2 == 1: x = struct.unpack_from("<d", ch, j)[0]; j += 8
                    else:
                        l2, j = rv(ch, j); c2 = ch[j:j+l2]; j += l2
                        x = dmsg(c2, tt) if tt in schema else c2.decode("utf-8", "replace")
                    if f2 == 1: k = x
                    else: v = x
                out.setdefault(fname, {})[str(k)] = v; continue
            elif kind.endswith("msg"): val = dmsg(ch, base)
            elif kind.endswith("string"): val = ch.decode("utf-8", "replace")
            elif kind.endswith("bytes"): val = ch.hex()
            elif kind.startswith("rep_"):
                vals = []; j = 0
                while j < len(ch):
                    if base == "float": vals.append(struct.unpack_from("<f", ch, j)[0]); j += 4
                    elif base == "double": vals.append(struct.unpack_from("<d", ch, j)[0]); j += 8
                    else:
                        x, j = rv(ch, j)
                        if base in ("int","int32") and x >= 1<<31: x -= 1<<32
                        vals.append(x)
                out.setdefault(fname, []).extend(vals); continue
            else:
                try: val = ch.decode("utf-8")
                except Exception: val = ch.hex()
        else: raise ValueError(f"wire {wt}")
        if kind.startswith("rep_"): out.setdefault(fname, []).append(val)
        else: out[fname] = val
    return out

def table_rows(b, cls):
    rows = []; i = 0
    while i + 4 <= len(b):
        ln = struct.unpack_from("<I", b, i)[0]; i += 4; rows.append(dmsg(b[i:i+ln], cls or "?")); i += ln
    return rows

TB = os.path.join(DEC, "data", "xlsx"); ok = bad = 0; report = []
for f in sorted(os.listdir(TB)):
    if not f.endswith(".bin"): continue
    name = f[:-4]; cls = name if name in schema else None
    b = open(os.path.join(TB, f), "rb").read(); rows = []
    try: rows = table_rows(b, cls); ok += 1
    except Exception as ex:
        first = "%s: %s" % (type(ex).__name__, ex)
        try:
            NESTED = True; rows = table_rows(b, cls); ok += 1
            report.append("%s: read with its nested message types (the raw form gave %s)" % (name, first))
        except Exception as ex2:
            rows = []; bad += 1
            report.append("%s: NOT DECODED, written empty (%s; with nested types %s: %s)" % (name, first, type(ex2).__name__, ex2))
        finally: NESTED = False
    json.dump(rows, open(os.path.join(TOUT, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(os.path.join(INS, "tables_report.txt"), "w", encoding="utf-8").write(
    "tables decoded: %d, failed: %d\n" % (ok, bad) + "".join(line + "\n" for line in report))
print(f"tables decoded: {ok}, failed: {bad}")
for line in report: print("  " + line)

