"""DELTARUNE: Party importer: re-points the party's effects built in the party effect kit (fxkit_party, PartyVFX.cs;
Role/Kris/*) at the game's own materials, meshes and textures, read from the player's install at build time.
Nothing from the game ships in this folder. See tools/bbvfx.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import bbvfx
a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
bbvfx.do_import(HERE, kw["--out"], kw["--adds"])
