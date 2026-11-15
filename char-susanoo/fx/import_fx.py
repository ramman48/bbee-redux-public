"""char-susanoo importer: points his beam effects (fx/bundles, copied from EX Hakumen's kit build on 2026-11-05 by
donor/snapshot_runtime.py) at the game's own materials, read from the player's install at build time. See tools/bbvfx.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import bbvfx
a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
bbvfx.do_import(HERE, kw["--out"], kw["--adds"])
