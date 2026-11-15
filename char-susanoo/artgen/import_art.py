"""Susanoo's pictures, made from the game's own Susanoo portrait at build time (the loader's importer contract:
--out <bundle folder> --adds <manifest additions file>). See susart.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import susart
a = sys.argv[1:]; kw = dict(zip(a[0::2], a[1::2]))
susart.run(kw["--out"], kw["--adds"])
