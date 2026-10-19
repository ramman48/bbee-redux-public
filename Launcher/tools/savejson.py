r"""savejson.py -- a BlazBlue Entropy Effect save as JSON, and back. Standalone: needs only lz4.

  python savejson.py export   <save file> <out.json>     the save written out as JSON (the save is only read)
  python savejson.py build    <in.json> <new save file>  a save file made from the JSON
  python savejson.py evotypes <save file or .json>       the saved Evotypes and the Tactics each one holds

A save (...\LocalLow\91Act\BlazblueEntropyEffect\Steam\<account>\Save\1 and its Backup copies) is an LZ4 frame
holding one protobuf message, DataSave, whose Messages each carry one of the game's models.

The JSON keeps every field in the order the save has it, so nothing is lost: `export` builds the save again from
the JSON it is about to write and stops if a single byte differs. Fields are named from the loader's schema
snapshot where the snapshot knows the type (tools/schema/<game build>/proto_schema_snapshot.json, or --schema);
the rest are shown by number. A message is {"type", "fields": [...]}; a field is {"n": number, "name"} and one of
  "varint": 12        a whole number (also a true/false as 1/0 and an enum by its number)
  "double" / "float"  a number with a fraction
  "string": "..."     text
  "message": {...}    a message inside this one
  "packed": [..]      a list of whole numbers ("packed_double", "packed_float": of fractions)
  "bytes" / "fixed32" / "fixed64" / "raw": hex, for what has no better reading
Change a value, keep the shape, and `build` writes it back. To swap a Tactic on a saved Evotype: run `evotypes`
for the list, then in the JSON find the Evotype by its "Uid" and change the "Id" inside one of its "Blesses".

Safety: `build` never writes into the game's own save folder and never over a file that exists. Close the game,
keep a copy of your save, and put the new file in place yourself.
"""
import hashlib
import json
import os
import re
import struct
import sys

import lz4.frame

MASK = (1 << 64) - 1
FORMAT = "zenith-save-json"
LIVE = os.path.join("91Act", "BlazblueEntropyEffect").lower()      # part of every path inside the game's save folder
SIGNED = ("int", "long")
MODEL_OF = "ModelPlayerNew"     # a model named ModelPlayerNewX is stored as the snapshot's STPlayerNewX; others have no sure match


def rv(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if not c & 0x80: return r, i
        if s > 63: raise ValueError("a varint longer than 10 bytes")


def wv(n):
    out = bytearray()
    while True:
        x = n & 0x7f; n >>= 7
        if n: out.append(x | 0x80)
        else: out.append(x); return bytes(out)


def split(b):
    """[(field number, wire type, value, the field's own bytes)] of one message; ValueError when b is not one"""
    out, i = [], 0
    try:
        while i < len(b):
            start = i; t, i = rv(b, i); n, w = t >> 3, t & 7
            if n < 1: raise ValueError("field number 0")
            if w == 0: v, i = rv(b, i)
            elif w == 2:
                ln, i = rv(b, i); v = b[i:i + ln]; i += ln
                if len(v) != ln: raise ValueError("a field runs past the end")
            elif w == 5: v = b[i:i + 4]; i += 4
            elif w == 1: v = b[i:i + 8]; i += 8
            else: raise ValueError("wire type %d" % w)
            if i > len(b): raise ValueError("a field runs past the end")
            out.append((n, w, v, b[start:i]))
    except IndexError:
        raise ValueError("a field runs past the end") from None
    return out


class Schema:
    """the loader's snapshot of the game's protobuf types: {type: {field number: [name, type]}}"""

    def __init__(self, path=None):
        self.types, self.build = {}, ""
        if path:
            with open(path, encoding="utf-8") as f: self.types = json.load(f).get("schema", {})
            self.build = os.path.basename(os.path.dirname(os.path.abspath(path)))

    def name(self, t):
        """the snapshot's own name for a type (it keeps Outer.Types.Inner as Inner), or None"""
        t = (t or "").strip()
        if t in self.types: return t
        short = t.split(".Types.")[-1]
        return short if short in self.types else None

    def table(self, t):
        return {int(n): (f[0], f[1]) for n, f in self.types.get(t, {}).items()}


def find_schema(given=None):
    if given: return Schema(given)
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (os.path.join(here, "schema"), os.path.join(here, "tools", "schema")):
        builds = sorted(d for d in os.listdir(base) if os.path.isfile(os.path.join(base, d, "proto_schema_snapshot.json"))) if os.path.isdir(base) else []
        if builds: return Schema(os.path.join(base, builds[-1], "proto_schema_snapshot.json"))
    return Schema()


# ---------------------------------------------------------------------------------------------------- JSON -> bytes
def enc_field(node):
    n = node["n"]
    if "raw" in node: return bytes.fromhex(node["raw"])
    if "varint" in node: return wv(n << 3) + wv(int(node["varint"]) & MASK)
    if "double" in node: return wv(n << 3 | 1) + struct.pack("<d", node["double"])
    if "fixed64" in node: return wv(n << 3 | 1) + bytes.fromhex(node["fixed64"])
    if "float" in node: return wv(n << 3 | 5) + struct.pack("<f", node["float"])
    if "fixed32" in node: return wv(n << 3 | 5) + bytes.fromhex(node["fixed32"])
    if "string" in node: body = node["string"].encode("utf-8")
    elif "message" in node: body = enc_message(node["message"])
    elif "packed" in node: body = b"".join(wv(int(x) & MASK) for x in node["packed"])
    elif "packed_double" in node: body = b"".join(struct.pack("<d", x) for x in node["packed_double"])
    elif "packed_float" in node: body = b"".join(struct.pack("<f", x) for x in node["packed_float"])
    elif "bytes" in node: body = bytes.fromhex(node["bytes"])
    else: raise ValueError("field %s has no value this tool knows: %s" % (n, sorted(node)))
    return wv(n << 3 | 2) + wv(len(body)) + body


def enc_message(message):
    return b"".join(enc_field(f) for f in message["fields"])


# ---------------------------------------------------------------------------------------------------- bytes -> JSON
def _text(v):
    """v as text when it reads as text: UTF-8 with no control characters"""
    try: s = v.decode("utf-8")
    except UnicodeDecodeError: return None
    return s if s and all(ch >= " " or ch in "\t\n\r" for ch in s) else None


def _number(fmt, v):
    """a fraction that JSON can hold and that packs back to the same bytes, or None"""
    x = struct.unpack(fmt, v)[0]
    return x if x == x and abs(x) != float("inf") and struct.pack(fmt, x) == v else None


class Reader:
    def __init__(self, schema): self.schema = schema

    def message(self, b, type_name=None, table=None, depth=0):
        if depth > 60: raise ValueError("nested too deep")
        table = table if table is not None else self.schema.table(type_name)
        parts = split(b)
        fields, model = [], None
        for n, w, v, raw in parts:
            name, ty = table.get(n, (None, None))
            node = {"n": n}
            if name: node["name"] = name
            if type_name == "Message" and n == 1 and w == 2: model = _text(v)
            value = self.value(w, v, ty, depth, model if type_name == "Message" and n == 2 else None)
            node.update(value)
            if enc_field(node) != raw:            # anything this reading would not write back exactly is kept as it is
                node = {k: node[k] for k in ("n", "name") if k in node}; node["raw"] = raw.hex()
            fields.append(node)
        return {"type": type_name, "fields": fields}

    def value(self, w, v, ty, depth, model):
        repeated = re.match(r"RepeatedField<(.+)>$", ty or "")
        mapped = re.match(r"MapField<([^,]+),\s*(.+)>$", ty or "")
        one = repeated.group(1).strip() if repeated else ty
        if w == 0: return {"varint": v - (1 << 64) if one in SIGNED and v >> 63 else v}
        if w == 1:
            x = _number("<d", v) if one == "double" else None
            return {"double": x} if x is not None else {"fixed64": v.hex()}
        if w == 5:
            x = _number("<f", v) if one == "float" else None
            return {"float": x} if x is not None else {"fixed32": v.hex()}
        try:
            if model is not None:                 # DataSave.Message.Data: one of the game's models
                known = self.schema.name("ST" + model[5:]) if model.startswith(MODEL_OF) else None
                return {"message": self.message(v, known, None if known else {}, depth + 1)}
            if mapped:
                key, val = mapped.group(1).strip(), mapped.group(2).strip()
                return {"message": self.message(v, "map<%s, %s>" % (key, val), {1: ("key", key), 2: ("value", val)}, depth + 1)}
            if repeated and one == "double" and len(v) % 8 == 0:
                xs = [_number("<d", v[i:i + 8]) for i in range(0, len(v), 8)]
                if None not in xs: return {"packed_double": xs}
            if repeated and one == "float" and len(v) % 4 == 0:
                xs = [_number("<f", v[i:i + 4]) for i in range(0, len(v), 4)]
                if None not in xs: return {"packed_float": xs}
            if repeated and one not in ("string", "ByteString") and not self.schema.name(one):
                xs, i = [], 0
                while i < len(v):
                    x, i = rv(v, i); xs.append(x - (1 << 64) if one in SIGNED and x >> 63 else x)
                return {"packed": xs}
            if one == "string":
                s = _text(v) if v else ""
                return {"string": s} if s is not None else {"bytes": v.hex()}
            if self.schema.name(one):
                return {"message": self.message(v, self.schema.name(one), None, depth + 1)}
            if one is None and v:                 # a type the snapshot does not know: text, then a message, then bytes
                s = _text(v)
                if s is not None: return {"string": s}
                return {"message": self.message(v, None, {}, depth + 1)}
        except (ValueError, IndexError):
            pass
        return {"bytes": v.hex()}


# ---------------------------------------------------------------------------------------------------- files
def compress(data):
    """the frame the game's own saves use (and the loader's save cleaner writes)"""
    return lz4.frame.compress(data, block_size=lz4.frame.BLOCKSIZE_MAX64KB, block_linked=False, content_checksum=False, store_size=True)


def read_save(path, schema):
    with open(path, "rb") as f: data = lz4.frame.decompress(f.read())
    save = Reader(schema).message(data, schema.name("DataSave") or "DataSave")
    if enc_message(save) != data:
        raise SystemExit("STOPPED: the JSON would not build this save again byte for byte. Nothing was written. Please report it.")
    return data, {"format": FORMAT, "version": 1, "schema": schema.build, "bytes": len(data),
                  "sha256": hashlib.sha256(data).hexdigest(), "save": save}


def load_doc(path, schema):
    """the save as a document, from a save file or from a JSON made by export"""
    with open(path, "rb") as f: head = f.read(1)
    if head in (b"{", b"\xef"):
        with open(path, encoding="utf-8-sig") as f: doc = json.load(f)
        if doc.get("format") != FORMAT: raise SystemExit("STOPPED: %s is not a JSON made by this tool's export." % path)
        return doc
    return read_save(path, schema)[1]


def export(save_path, json_path, schema):
    data, doc = read_save(save_path, schema)
    with open(json_path, "w", encoding="utf-8", newline="\n") as f: json.dump(doc, f, indent=1, ensure_ascii=False)
    count = [0, 0, 0]

    def walk(m):
        for node in m["fields"]:
            count[0] += 1; count[1] += "name" in node; count[2] += "raw" in node
            if "message" in node: walk(node["message"])
    walk(doc["save"])
    print("wrote %s: %d bytes of save, %d fields, %d of them named, %d kept as raw bytes" % (json_path, len(data), count[0], count[1], count[2]))
    print("checked: the JSON builds the same %d bytes again" % len(data))


def build(json_path, save_path, schema):
    target = os.path.abspath(save_path)
    if LIVE in os.path.realpath(target).lower():
        raise SystemExit("STOPPED: this tool does not write into the game's own save folder. Build the file somewhere else, "
                         "close the game, keep a copy of your save, then put the new file in place yourself.")
    if os.path.exists(target):
        raise SystemExit("STOPPED: %s exists already. Name a file that does not, so nothing is written over." % target)
    doc = load_doc(json_path, schema)
    data = enc_message(doc["save"])
    try: split(data)
    except ValueError as e: raise SystemExit("STOPPED: the JSON does not make a readable save (%s). Nothing was written." % e) from None
    blob = compress(data)
    assert lz4.frame.decompress(blob) == data
    with open(target, "wb") as f: f.write(blob)
    same = hashlib.sha256(data).hexdigest() == doc.get("sha256")
    print("wrote %s: %d bytes of save (%d in the file). %s" % (target, len(data), len(blob),
          "The same save as the one exported." if same else "It differs from the exported save (%d bytes then)." % doc.get("bytes", 0)))


def pick(message, n):
    return [f for f in message["fields"] if f["n"] == n]


def num(message, n, default: float = 0):
    return next((f.get("varint", f.get("double", default)) for f in pick(message, n)), default)


def evotypes(path, schema):
    doc = load_doc(path, schema)
    rows = []
    for field in pick(doc["save"], 2):
        entry = field.get("message")
        if not entry or next((f.get("string") for f in pick(entry, 1)), "") != "ModelPlayerNewFesActorPack": continue
        for model in pick(entry, 2):
            for pack in pick(model.get("message", {"fields": []}), 1):
                for item in pick(pack.get("message", {"fields": []}), 1):
                    for value in pick(item.get("message", {"fields": []}), 2):
                        actor = value.get("message")
                        if not actor: continue
                        tactics = [(num(b["message"], 1), num(b["message"], 2), num(b["message"], 3)) for b in pick(actor, 8) if "message" in b]
                        rows.append((num(actor, 1), num(actor, 2), num(actor, 16, 0.0), tactics))
    print("%d saved Evotype%s" % (len(rows), "" if len(rows) == 1 else "s"))
    for uid, actor_id, score, tactics in rows:
        print("  Uid %-5s character %-7s score %-9.1f Tactics (Id/Quality%s): %s" % (uid, actor_id, score, ", * = active",
              "  ".join("%s/%s%s" % (i, q, "*" if a else "") for i, q, a in tactics) or "none"))


def main(argv):
    schema_path = argv.pop(argv.index("--schema") + 1) if "--schema" in argv else None
    argv = [a for a in argv if a != "--schema"]
    if len(argv) < 2 or argv[0] not in ("export", "build", "evotypes") or (argv[0] != "evotypes" and len(argv) != 3):
        print(__doc__); return 2
    schema = find_schema(schema_path)
    if not schema.types: print("no schema snapshot found (--schema <proto_schema_snapshot.json>): fields are shown by number only")
    if argv[0] == "export": export(argv[1], argv[2], schema)
    elif argv[0] == "build": build(argv[1], argv[2], schema)
    else: evotypes(argv[1], schema)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
