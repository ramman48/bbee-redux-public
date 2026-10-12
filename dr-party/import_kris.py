"""import_kris.py -- DELTARUNE: Party's build-time importer (bbmod.py runs it through content.importers).

Reads the PLAYER'S OWN DELTARUNE install (Chapter 5) and writes the party's rig straight into the build folder: sprite
sheets, the three texture families (kris_02, kris_Extra, kris_Extra2), one mesh per frame and one clip per name in
kris_clips.py (Kris, Susie, Ralsei and the effect strips, role "kris"). Nothing it makes is stored in the mod folder;
decoded frames are cached under local_only/ (dr_source.Frames), encoded sheets under local_only/cache/.

The rig builder is Cross Effect's tools/bbtag/bbtag_rig.build_rig, used unchanged (no monkeypatching): dr_source.
DRSource gives it whole-number nearest-neighbour frames rooted at the feet, already facing right.

usage (bbmod calls it):  python mods/dr-party/import_kris.py all --out <build folder> --adds <json path>
                         ("rig" builds only the rig; "all" adds the UI textures (party_ui.py) and Kris's portraits
                         (kris_portraits.py, from the official art in local_only/deltarune/party/art: optional))
It fails, with a message, only when the DELTARUNE sprites can't be read (the reader or the install is missing).
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))
sys.path[:0] = [HERE, os.path.join(ROOT, "tools", "bbtag")]

K_SCALE = 8          # DELTARUNE pixel -> 8 x 8 sheet texels (large visible pixels; PARTY_TECH.md 6.2)


def check_sources():
    """The research reader and the DELTARUNE install must both be there: fail with a clear message, never half-build."""
    import dr_pack, dr_source
    if dr_pack.active():                 # 0.6.4: an alpha TEST package carries the files (dr_pack.py): no install is read
        return "the included asset pack (%s)" % dr_pack.folder()
    reader = dr_source.SCRATCH / "gmdata.py"
    if not reader.exists():
        sys.exit("DELTARUNE: Party: the DELTARUNE reader is missing (%s). It belongs to the DELTARUNE: Core session's "
                 "tools\\deltarune\\research_scratch until the reader library ships." % reader)
    sys.path.insert(0, str(dr_source.SCRATCH))
    import gmdata
    if not os.path.exists(gmdata.CH5):
        sys.exit("DELTARUNE: Party: DELTARUNE Chapter 5 not found at %s. The party's art is read from your own "
                 "DELTARUNE install at build time." % gmdata.CH5)
    return gmdata.CH5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["all", "rig"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--adds", required=True)
    a = ap.parse_args()
    data = check_sources()
    import bbtag_rig, dr_source, kris_clips
    clips = kris_clips.sequences()
    src = dr_source.DRSource(K_SCALE)
    print("DELTARUNE: Party: %d clips from %s, %dx frames, %.5f u per DELTARUNE pixel" % (len(clips), data, K_SCALE, dr_source.UNIT_PER_PX))
    log = lambda *m: print("DELTARUNE: Party:", *m)
    adds = bbtag_rig.build_rig(src, clips, a.out, kris_clips.ROLE, kris_clips.SKIN, log=log)
    if a.what == "all":
        # the command's SOUL / reticles and the HUD heads (party_ui.py), then Kris's portraits (kris_portraits.py). The
        # official art (local_only/deltarune/party/art) is optional: without it both skip their art, never fail
        import party_ui, kris_portraits
        r, sizes = party_ui.build(a.out, src.frames, log=log)
        for k in adds: adds[k] += r[k]
        log("UI textures: %d (%s)" % (len(sizes), ", ".join(sorted(sizes))))
        r = kris_portraits.build(a.out, log=log, frames=src.frames)
        for k in adds: adds[k] += r[k]
    json.dump(adds, open(a.adds, "w"), indent=1)
    print("DELTARUNE: Party rig: %d bundles" % len(adds["names"]))


if __name__ == "__main__":
    main()
