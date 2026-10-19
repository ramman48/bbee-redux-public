"""bbscript_dump.py -- dump BBTAG BBScript states.

bbscript_sizes.json maps command id -> byte size (id included): 1,165 ids. The sizes come from the community command
database (dantarion/bbtools static_db/bbcf/commandsDB.json) and were verified against BBTAG's own data: they tile
20,784 of the 20,785 functions in all 106 character scripts exactly. (Our own inference from the game data had
reached 326 ids, 304 of them matching.) Command NAMES are read from that database if a local copy exists (_DB:
bbtag/ref/commandsDB.json in the local folder; it is not redistributed here); otherwise only the 24 names in
bbscript_names.json (the ones the build matches on) are known and other ids print as numbers.

usage: python tools/bbtag/bbscript_dump.py <script.bin> [state ...]      (no state: list states with frame totals)
"""
import json, os, re, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = {int(k): v for k, v in json.load(open(os.path.join(HERE, "bbscript_sizes.json"))).items()}
NAMES = {0: "state", 1: "endState", 2: "sprite", 3: "loopRest", 15: "upon", 16: "endUpon"}


NAMES.update({int(k): v for k, v in json.load(open(os.path.join(HERE, "bbscript_names.json"))).items()})
_DB = os.path.join(os.path.dirname(os.path.dirname(HERE)), "local_only", "bbtag", "ref", "commandsDB.json")
if os.path.exists(_DB):
    for k, v in json.load(open(_DB)).items():
        if v.get("name"):
            NAMES.setdefault(int(k), v["name"])
TXT = re.compile(rb"[A-Za-z0-9_]{2,31}\x00")


def states(b):
    n = struct.unpack_from("<I", b, 0)[0]
    base = 4 + 0x24 * n
    ents = sorted((struct.unpack_from("<I", b, 4 + i * 0x24 + 32)[0] + base, b[4 + i * 0x24:4 + i * 0x24 + 32].split(b"\0")[0].decode("latin1")) for i in range(n))
    out = []
    for i, (a, name) in enumerate(ents):
        out.append((name, a, ents[i + 1][0] if i + 1 < len(ents) else len(b)))
    return out


def args(raw):
    """Render args: 32-byte text fields as strings, the rest as signed ints."""
    out, k = [], 0
    while k < len(raw):
        m = TXT.match(raw, k)
        if m and k + 32 <= len(raw) and not any(raw[m.end():k + 32]):
            out.append('"%s"' % m.group()[:-1].decode()); k += 32; continue
        if m and k + 16 <= len(raw) and not any(raw[m.end():k + 16]):
            out.append('"%s"' % m.group()[:-1].decode()); k += 16; continue
        out.append(struct.unpack_from("<i", raw, k)[0]); k += 4
    return out


def decode(b, a, z):
    """-> list of (offset, id, args); stops with ('?', id) at an id whose size is unknown."""
    ins, p = [], a
    while p < z:
        op = struct.unpack_from("<I", b, p)[0]
        if op not in SIZE:
            ins.append((p, "?", op, list(struct.unpack_from("<%di" % min(8, (z - p) // 4), b, p)))); break
        ins.append((p, op, args(b[p + 4:p + SIZE[op]])))
        p += SIZE[op]
    return ins


def frames(ins):
    return sum(x[2][1] for x in ins if x[1] == 2 and len(x[2]) > 1 and isinstance(x[2][1], int))


def main():
    b = open(sys.argv[1], "rb").read()
    want = sys.argv[2:]
    for name, a, z in states(b):
        if want and name not in want:
            continue
        ins = decode(b, a, z)
        if not want:
            ok = ins and ins[-1][1] != "?"
            print("%-32s %4d frames %s" % (name, frames(ins), "" if ok else "(partial)"))
            continue
        print("== %s (%d bytes)" % (name, z - a))
        for p, op, ar in ins:
            print("  %6s %s" % (NAMES.get(op, op), " ".join(str(x) for x in ar)))


if __name__ == "__main__":
    main()
