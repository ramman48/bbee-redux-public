"""import_ruby.py -- Cross Effect's build-time importer (run by bbmod.py through content.importers).

Reads BlazBlue Cross Tag Battle's files and writes Ruby's art straight into the build folder: the rig (sprite sheets,
texture family, meshes, clips) and every UI texture / icon / HUD atlas. Nothing it makes is stored in the mod folder.
Where the files come from (tools/bbtag/bbtag_read.py):
  - a final release: the PLAYER'S OWN install. It refuses to run unless the player owns BBTAG and all of its DLC
    (docs/cross-effect/DECISIONS.md, 2026-09-28): require_ownership() is the first thing it does, and the first thing
    build_ruby.py and ruby_audio.py do, before anything is read from the install;
  - an alpha package: the files the package carries in bbtag_alpha/ (DECISIONS.md, 2026-10-03). No install, no check.

usage (bbmod calls it):  python mods/char-ruby/import_ruby.py all --out <build folder> --adds <json path>
                         (rig / ui / audio build one part)
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path.insert(0, os.path.join(TOOLS, "tools", "bbtag"))
sys.path.insert(0, TOOLS)
sys.path.insert(0, HERE)


def _development_checkout():
    """The development workspace's own settings (local_only/cross_effect_dev.json), or None. A released copy has no
    local_only folder (the packager refuses to package one), so this is always None there."""
    p = os.path.join(ROOT, "local_only", "cross_effect_dev.json")
    if not os.path.isfile(p):
        return None
    try:
        d = json.load(open(p, encoding="utf-8"))
    except ValueError as e:
        sys.exit("Cross Effect: %s is not valid JSON (%s)" % (p, e))
    return d if isinstance(d, dict) else None


def require_ownership(out=None):
    """Stop unless Steam says this player owns BlazBlue Cross Tag Battle and all of its DLC (tools/bbtag/bbtag_owner.py;
    Steam must be running). Called before anything is read from the Cross Tag Battle install, by every entry point:
    this importer, build_ruby.py (her moves and data) and ruby_audio.py (her sounds).
    `out` is the build folder when a build is running. There is no command-line or environment switch: the check is
    off only in the development workspace (its own settings, which no released copy has) and in an alpha package that
    carries her Cross Tag Battle files itself (see below)."""
    dev = _development_checkout()
    if dev is not None:
        staging = out is None or (bool(os.environ.get("BBMOD_OUT")) and
                                  os.path.normcase(os.path.abspath(out)) != os.path.normcase(os.path.join(ROOT, "patch_out")))
        if dev.get("skip_ownership") is True:
            print("Cross Effect: ownership check skipped (development workspace)")
            return False
        if os.environ.get("CROSS_EFFECT_DEV_SKIP_OWNERSHIP") == "1" and staging:   # a staging build is never installed
            print("Cross Effect: ownership check skipped (development workspace, staging build)")
            return False
    # an ALPHA package carries the Cross Tag Battle files she is built from (<package>/bbtag_alpha, tools/bbtag/
    # bbtag_read.py): nothing is read from an install, so there is nothing to own (the lead, 2026-10-03: "for alpha
    # release they don't need ownership or to have it installed that's only for final release"). A package without that
    # folder, the final release, checks as before
    import bbtag_read
    if bbtag_read.BUNDLED:
        print("Cross Effect: alpha package: Ruby's Cross Tag Battle files are in this package (bbtag_alpha); no ownership check")
        return False
    import bbtag_owner
    try:
        ok, details = bbtag_owner.check()
    except RuntimeError as e:
        sys.exit("Cross Effect: the ownership check could not run (%s). Start Steam and try again." % e)
    if not ok:
        missing = [n for n, o in details.values() if not o]
        sys.exit("Cross Effect needs BlazBlue Cross Tag Battle and all of its DLC. Not owned: " + ", ".join(missing))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["all", "rig", "ui", "audio"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--adds", required=True)
    a = ap.parse_args()
    require_ownership(a.out)   # first: nothing below runs for a player who doesn't own Cross Tag Battle and its DLC

    import bbtag_clips, bbtag_rig, bbtag_read, ruby_clips
    if not os.path.isdir(os.path.join(bbtag_read.INSTALL, "asset")):
        sys.exit("Cross Effect: BlazBlue Cross Tag Battle not found at %s (set BBTAG_DIR)." % bbtag_read.INSTALL)
    src = bbtag_rig.Source("rrb")
    src.scale_mul = ruby_clips.EFFECT_SCALE
    scr = bbtag_read.fpac_files(bbtag_read.read("data/char/char_rrb_scr.pac"))
    os.makedirs(bbtag_rig.CACHE, exist_ok=True)
    cats = []
    for fn in ("scr_rrb.bin", "scr_rrbea.bin"):
        tmp = os.path.join(bbtag_rig.CACHE, fn); open(tmp, "wb").write(scr[fn]); cats.append(bbtag_clips.catalog(tmp))
    clips = ruby_clips.sequences(cats[0], bbtag_rig.normalize, cats[1])
    adds = {"names": [], "entries": [], "guids": []}
    if a.what in ("all", "rig"):
        r = bbtag_rig.build_rig(src, clips, a.out, ruby_clips.ROLE, ruby_clips.SKIN)
        for k in adds: adds[k] += r[k]
        import ruby_fx   # Red Reaper's astral sky: her BBTAG background art in a clone of BBEE's Astral Heat backdrop
        r = ruby_fx.build_astral(a.out)
        for k in adds: adds[k] += r[k]
        import ruby_clashbg   # Clash Assault's backdrop (the colour burst) and start flash: BBTAG's own, from the player's install
        # (0.8.0: the diamond vortex, CLASH_FX, is no longer built: one backdrop for the whole move; rrb_power.clash_bg)
        r = ruby_clashbg.build(a.out, which=(ruby_clashbg.FINISH_FX, ruby_clashbg.START_FX))
        for k in adds: adds[k] += r[k]
        # (her rose afterimage, ruby_fx.build_afterimage, is no longer built: no action names Role/Rrb/rrb_afterimage
        #  since the effects pass of 2026-09-30, "no afterimage copies"; INTEGRATION_AUDIT D5)
        # her attack VFX (smears, hit sparks with rose petals), authored in fxkit_cross from BBEE's own effects: point
        # them at the player's own game materials and meshes (tools/bbvfx.py, the Boons Plus kit's importer)
        fx = os.path.join(HERE, "fx")
        if not os.path.exists(os.path.join(fx, "fxmap.json")):
            # (until 0.6.11 a copy without fx/ built with no effects and no message; her actions name them)
            sys.exit("Cross Effect: her effect pack is missing (%s). The mod folder is incomplete." % os.path.join(fx, "fxmap.json"))
        sys.path.insert(0, os.path.join(TOOLS, "tools"))
        import bbvfx
        tmp = a.adds + ".fx.json"
        bbvfx.do_import(fx, a.out, tmp)
        r = json.load(open(tmp))
        for k in adds: adds[k] += r[k]
        os.remove(tmp)
        # the slash projectile's class templates (kit, 2026-10-03: fx_wave); fxcompile_ruby fills one per move below
        fxw = os.path.join(HERE, "fx_wave"); wdeps = {}
        if not os.path.exists(os.path.join(fxw, "fxmap.json")):
            sys.exit("Cross Effect: her projectile pack is missing (%s). The mod folder is incomplete." % os.path.join(fxw, "fxmap.json"))
        bbvfx.do_import(fxw, a.out, tmp)
        rw = json.load(open(tmp)); os.remove(tmp)
        have = set(adds["names"])
        adds["names"] += [n for n in rw["names"] if n not in have]
        adds["entries"] += [e for e in rw["entries"] if e[0] not in have]
        adds["guids"] += [g for g in rw["guids"] if g[0] not in have]
        wdeps = {n: d for n, d in rw["entries"]}
        try: import rrb_preview            # (dev only, RRB_PREVIEW=1: the lab packs of the stage 2 / 3 looks and the projectile)
        except ImportError: rrb_preview = None   # a release package has no preview module
        if rrb_preview is not None and rrb_preview.ON:
            for pk in rrb_preview.PACKS:
                bbvfx.do_import(pk, a.out, tmp)
                rp = json.load(open(tmp)); os.remove(tmp)
                have = set(adds["names"])           # (clones both packs carry, e.g. the glow's: once)
                adds["names"] += [n for n in rp["names"] if n not in have]
                adds["entries"] += [e for e in rp["entries"] if e[0] not in have]
                adds["guids"] += [g for g in rp["guids"] if g[0] not in have]
                print("preview pack %s: %d bundles (%d new)" % (os.path.basename(pk), len(rp["names"]), len([n for n in rp["names"] if n not in have])))
        # V2: her scythe arcs, compiled from this install's BBTAG arc models into mesh particles on the kit's
        # rrb_arc template (fxcompile_ruby.py; build_ruby.py writes gen/fxplan.json: which arcs, with what options)
        plan = os.path.join(HERE, "gen", "fxplan.json")
        if not os.path.exists(plan):
            sys.exit("Cross Effect: %s is missing. Run build_ruby.py first (it writes her moves and this plan)." % plan)
        import fxcompile_ruby
        deps = next(d for n, d in r["entries"] if n == fxcompile_ruby.TEMPLATE)
        sdeps = next((d for n, d in r["entries"] if n == fxcompile_ruby.SLASH_TEMPLATE), None)   # the kit's slash template
        pl = json.load(open(plan))
        r = fxcompile_ruby.build(a.out, pl, deps)
        for k in adds: adds[k] += r[k]
        print("Ruby arcs: %d bundles" % len(r["names"]))
        r3 = fxcompile_ruby.slash_texture(a.out, adds)          # look C: her stroke on the slash body (kit, 2026-10-02)
        for k in adds: adds[k] += r3[k]
        r2 = fxcompile_ruby.build_slashes(a.out, pl, sdeps)
        for k in adds: adds[k] += r2[k]
        print("Ruby slashes: %d bundles" % len(r2["names"]))
        fxcompile_ruby.wave2_textures(a.out, adds, fxw)          # the projectile's blade in her own stroke
        r5 = fxcompile_ruby.build_waves2(a.out, pl, wdeps)
        for k in adds: adds[k] += r5[k]
        print("Ruby projectiles: %d bundles" % len(r5["names"]))
    if a.what in ("all", "ui"):
        import ruby_ui, rrb_pots
        pids = list(rrb_pots.ICON_CARDS)   # the 38 V2 cards (the list build_ruby.write_mod makes rows, aliases and metrics from)
        icons = ruby_ui.load_icons()
        r = ruby_ui.build(a.out, icons, pids, rrb_pots.UNLEASHED, ruby_ui.stock_icon("ui/texture/iconpotential/potential_5000"))
        for k in adds: adds[k] += r[k]
    if a.what in ("all", "audio"):   # her sounds and voice as CRI cue sheets (ruby_audio.py)
        import ruby_audio
        r = ruby_audio.build(a.out)
        for k in adds: adds[k] += r[k]
    json.dump(adds, open(a.adds, "w"), indent=1)
    print("Ruby art: %d bundles" % len(adds["names"]))


if __name__ == "__main__":
    main()
