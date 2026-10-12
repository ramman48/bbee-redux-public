"""bbtag_moves.py -- a BBTAG move in BBEE terms: hit windows with boxes in world units, timed cues, movement, invulnerability.

For one or more states (their sprite sequence as played, i.e. linear through labels/loops; holds count one frame):
  frames   [(sprite, start tick, ticks)]
  hits     [{"start": s, "end": s, "box": [xmin, ymin, xmax, ymax] (u, y up, facing right), "sprites": [...]}]
           one entry per contiguous run of sprites that carry hit boxes; boxes are the union over the run
  hurt     the union hurtbox over the move (u) -- BBEE uses one body box, this is only a reference
  cues     [(t, kind, value)] kind: sfx / voice / gfx / invincible / impulse_x / impulse_y
  attack   the (property, value) pairs of the attack block, by command name (AttackLevel_, Damage, ...)
  total    seconds (60 ticks per second)

usage: python tools/bbtag/bbtag_moves.py <state> [...]       (reads Ruby's data from the install)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bbscript_dump as S
import bbtag_formats as F

HOLD = 30000


class Moves:
    def __init__(self, src, script_bytes, scale):
        self.src, self.b, self.scale = src, script_bytes, scale
        self.st = {n: (a, z) for n, a, z in S.states(script_bytes)}
        self._jb = {}

    def jonbin(self, sprite):
        if sprite not in self._jb:
            raw = self.src.col.get(sprite + ".jonbin")
            self._jb[sprite] = F.jonbin(raw) if raw else None
        return self._jb[sprite]

    def box_u(self, b):
        s = self.scale   # BBTAG y points down and characters face LEFT; BBEE y points up and characters face right
        return [-(b["x"] + b["w"]) * s, -(b["y"] + b["h"]) * s, -b["x"] * s, -b["y"] * s]

    def move(self, *states):
        # BBScript timing: `sprite(name, n)` shows a sprite for n ticks, and the commands listed AFTER it run on that
        # sprite's first tick (e.g. NmlAtk5A: `Recovery()` follows rrb200_03, the first sprite after the hit). So a cue
        # takes the start time of the sprite before it (cur), not the end. Handlers (`upon X ... endUpon`) aren't on
        # the timeline: IMMEDIATE (0) runs at the start of the state; the others react to events and are skipped.
        frames, cues, attack, t = [], [], {}, 0
        for state in states:
            cur, upon = t, None
            for x in S.decode(self.b, *self.st[state]):
                op, ar = x[1], x[-1]
                name = S.NAMES.get(op, str(op))
                strs = [v.strip('"') for v in ar if isinstance(v, str)]
                if name == "upon":
                    upon = ar[0] if ar else 0; continue
                if name == "endUpon":
                    upon = None; continue
                if upon not in (None, 0):
                    continue
                at = (t if upon == 0 else cur) / 60
                if op == 2 and strs:
                    d = ar[1] if len(ar) > 1 else 1
                    d = 1 if d >= HOLD else max(1, d)
                    if strs[0] == "keep" and frames:
                        s0, t0, d0 = frames[-1]; frames[-1] = (s0, t0, d0 + d)
                    else:
                        frames.append((strs[0], t, d))
                    cur = t; t += d
                elif name.startswith("SFX"):
                    cues.append((at, "sfx", strs[0] if strs else ar))
                elif op == 7006 or name == "tag_voice":
                    cues.append((at, "voice", [s for s in strs]))
                elif name.startswith("GFX") or op == 21012:
                    cues.append((at, "gfx", strs[0] if strs else ar))
                elif name == "RefreshMultihit":
                    cues.append((at, "refresh", 1))
                elif name == "setInvincible":
                    cues.append((at, "invincible", ar[0] if ar else 1))
                elif name in ("physicsXImpulse", "physicsYImpulse"):
                    cues.append((at, "impulse_" + name[7].lower(), ar[0] / 1000.0 * self.scale if ar else 0))
                elif 9000 <= (op if isinstance(op, int) else 0) < 12000 and ar and not strs:
                    attack.setdefault(name, ar[0])
        hits, hurt = [], None
        for sprite, t0, d in frames:
            jb = self.jonbin(sprite)
            if not jb:
                continue
            for hb in jb["boxes"]["hurt"]:
                u = self.box_u(hb)
                hurt = u if hurt is None else [min(hurt[0], u[0]), min(hurt[1], u[1]), max(hurt[2], u[2]), max(hurt[3], u[3])]
            hb = jb["boxes"]["hit"]
            if not hb:
                continue
            u = [self.box_u(b) for b in hb]
            box = [min(v[0] for v in u), min(v[1] for v in u), max(v[2] for v in u), max(v[3] for v in u)]
            if hits and abs(hits[-1]["end"] - t0 / 60) < 1e-6:
                h = hits[-1]; h["end"] = (t0 + d) / 60; h["sprites"].append(sprite)
                h["box"] = [min(h["box"][0], box[0]), min(h["box"][1], box[1]), max(h["box"][2], box[2]), max(h["box"][3], box[3])]
            else:
                hits.append({"start": t0 / 60, "end": (t0 + d) / 60, "box": box, "sprites": [sprite]})
        # BBTAG re-arms a move's hit inside one window with RefreshMultihit: split the window there (one hit each)
        refresh = sorted({ct for ct, k, _ in cues if k == "refresh"})
        split = []
        for h in hits:
            cuts = [r for r in refresh if h["start"] + 1e-6 < r < h["end"] - 1e-6]
            edges = [h["start"]] + cuts + [h["end"]]
            for a0, a1 in zip(edges, edges[1:]):
                split.append(dict(h, start=a0, end=a1))
        hits = split
        return {"states": list(states), "frames": frames, "hits": hits, "hurt": hurt, "cues": cues, "attack": attack, "total": t / 60}


def ruby():
    import bbtag_read as R, bbtag_rig as RG
    src = RG.Source("rrb")
    scr = R.fpac_files(R.read("data/char/char_rrb_scr.pac"))["scr_rrb.bin"]
    return Moves(src, scr, src.scale)


def main():
    m = ruby()
    for st in sys.argv[1:]:
        mv = m.move(st)
        print("== %s  total %.3fs  attack %s" % (st, mv["total"], mv["attack"]))
        for h in mv["hits"]:
            print("   hit %.3f-%.3fs box x %.2f..%.2f y %.2f..%.2f" % (h["start"], h["end"], h["box"][0], h["box"][2], h["box"][1], h["box"][3]))
        print("   hurt", [round(v, 2) for v in mv["hurt"]] if mv["hurt"] else None)
        print("   cues", [(round(t, 3), k, v) for t, k, v in mv["cues"]][:10])


if __name__ == "__main__":
    main()
