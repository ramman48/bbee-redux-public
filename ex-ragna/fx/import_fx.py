"""EX Ragna importer: re-points the effects remade in the EX effect kit (fx/bundles, docs/ex/VFX_EX_RAGNA.md) at the
game's own materials, meshes and textures, read from the player's install at build time. See tools/bbvfx.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import bbvfx
a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
bbvfx.do_import(HERE, kw["--out"], kw["--adds"])
