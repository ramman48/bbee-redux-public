"""bbtag_clips.py -- split BBTAG character states into animation segments for BBEE clips.

A state's sprite commands are cut into segments at control-flow markers:
  label N      starts a new segment (loop targets)
  loopRest     ends a looping block
  gotoLabel N  ends the state's linear read
  a "hold" sprite (duration >= 30000: held until an event such as landing) is its own one-frame segment
Each segment: {"frames": [[sprite, ticks], ...], "hold": bool, "loop": bool, "label": N or None}.

usage: python tools/bbtag/bbtag_clips.py <script.bin> [state ...]      prints segments (frames count, total ticks)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bbscript_dump as S

HOLD = 30000


def segments(b, a, z):
    segs, cur, label = [], [], None

    def close(loop=False):
        nonlocal cur
        if cur:
            segs.append({"frames": cur, "hold": False, "loop": loop, "label": label})
        cur = []

    for x in S.decode(b, a, z):
        op, ar = x[1], x[-1]
        name = S.NAMES.get(op, str(op))
        if op == 2 and ar and isinstance(ar[0], str):
            s, d = ar[0].strip('"'), ar[1]
            if d >= HOLD:
                close(); segs.append({"frames": [[s, 1]], "hold": True, "loop": False, "label": label})
            else:
                cur.append([s, d])
        elif name == "label":
            close(); label = ar[0] if ar else None
        elif name == "loopRest":
            close(loop=True)
        elif name in ("gotoLabel", "endState"):
            close()
    close()
    return segs


def catalog(path):
    b = open(path, "rb").read()
    return {name: segments(b, a, z) for name, a, z in S.states(b)}


def main():
    cat = catalog(sys.argv[1])
    for name, segs in cat.items():
        if len(sys.argv) > 2 and name not in sys.argv[2:]:
            continue
        desc = []
        for i, sg in enumerate(segs):
            fl = sg["frames"]
            desc.append("%d:%s%d/%df%s" % (i, "H" if sg["hold"] else ("L" if sg["loop"] else ""), len(fl), sum(t for _, t in fl), "@" + fl[0][0][3:] if fl else ""))
        print("%-30s %s" % (name, " ".join(desc)))


if __name__ == "__main__":
    main()
