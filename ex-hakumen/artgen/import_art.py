"""EX character art importer: makes the pictures that come from the game (head icons, menu portraits, HUD icons)
from the player's own install at build time, as recipes.json says. See mods/ex-common/exart.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..", "ex-common")))
import exart
a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
exart.run(os.path.join(HERE, "recipes.json"), kw["--out"], kw["--adds"])
