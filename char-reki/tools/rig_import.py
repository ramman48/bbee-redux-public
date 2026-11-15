"""Reki's rig at build time: the leiji Spine skeleton from the player's own install, with the 14 clips the hero
cinematics play by name (Evotype, appear, co-op select) added as copies of her own animations (rig_anims.json beside this script, so the Terminal's package carries it).
A Spine skeleton keeps its animations last, each a [name][body] block of indices only, so a copy under a new name is a
new animation and nothing else in the file moves. The rewritten skeleton replaces the stock TextAsset in the build
folder; no game bytes live in the mod. Refuses a skeleton that is not the one the byte ranges were read from.
bbmod importer: rig_import.py --out <build folder> --adds <json path>"""
import argparse, hashlib, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--adds", required=True)
args = ap.parse_args()
os.environ["BBMOD_OUT"] = args.out
sys.path.insert(0, ROOT)
_argv = sys.argv; sys.argv = ["x"]
import make_patch
sys.argv = _argv
import UnityPy

spec = json.load(io.open(os.path.join(HERE, "rig_anims.json"), encoding="utf-8"))
env = UnityPy.load(make_patch.slice_bundle(make_patch.find_entry(spec["bundle"])))
raw = None
for o in env.objects:
    if o.type.name == "TextAsset":
        d = o.read()
        if d.m_Name.lower() == spec["asset"].lower():
            s = d.m_Script
            raw = s.encode("utf-8", "surrogateescape") if isinstance(s, str) else bytes(s)
if raw is None:
    raise SystemExit("rig_import: %s has no TextAsset %s" % (spec["bundle"], spec["asset"]))
sha = hashlib.sha1(raw).hexdigest()
if len(raw) != spec["size"] or sha != spec["sha1"]:
    raise SystemExit("rig_import: %s is %d bytes, sha1 %s; the byte ranges are for %d bytes, sha1 %s (a game update?): "
                     "read them again with research/characters/reki/skel_offsets.mjs" % (spec["asset"], len(raw), sha, spec["size"], spec["sha1"]))


def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F; n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n: return bytes(out)


def read_varint(buf, at):
    n = shift = 0
    while True:
        b = buf[at]; at += 1; n |= (b & 0x7F) << shift; shift += 7
        if not b & 0x80: return n, at


def spine_string(s):
    b = s.encode("utf-8")
    return varint(len(b) + 1) + b


count, first = read_varint(raw, spec["count_at"])
if count != spec["count"]:
    raise SystemExit("rig_import: %d animations at %d, expected %d" % (count, spec["count_at"], spec["count"]))
extra = []
for new, src in spec["add"].items():
    a, b = spec["sources"][src]
    old_len, body = read_varint(raw, a)
    body += old_len - 1
    extra.append(spine_string(new) + raw[body:b])


made_dir = os.path.join(HERE, "anims")
made = json.load(io.open(os.path.join(made_dir, "anims.json"), encoding="utf-8")) if os.path.exists(os.path.join(made_dir, "anims.json")) else None
if made:
    if made["skeleton"]["sha1"] != sha:
        raise SystemExit("rig_import: tools/anims was made for a skeleton with sha1 %s, this one is %s: run skel_anim.mjs again"
                         % (made["skeleton"]["sha1"], sha))
    for name, a in made["anims"].items():
        body = open(os.path.join(made_dir, a["file"]), "rb").read()
        if hashlib.sha1(body).hexdigest() != a["sha1"]:
            raise SystemExit("rig_import: tools/anims/%s does not match anims.json" % a["file"])
        extra.append(spine_string(name) + body)
out = raw[:spec["count_at"]] + varint(count + len(extra)) + raw[first:] + b"".join(extra)
make_patch.rebuild_bundle(spec["bundle"], spec["asset"], out)
json.dump({"names": [], "entries": [], "guids": []}, open(args.adds, "w"))
print("rig_import: %s %d -> %d animations (+%s)" % (spec["asset"], count, count + len(extra), ", ".join(list(spec["add"]) + (list(made["anims"]) if made else []))))
