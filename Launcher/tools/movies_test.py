r"""movies_test.py -- the loader's movie step (bbmod.py: movie_specs, install_movies, remove_movies) against a copy
of the game's own MovieData.d in a temporary folder. Nothing in the game folder is touched.

  python tools\movies_test.py [path to the game's StreamingAssets\Movie\MovieData.d]

Without a path it uses Launcher\game\...\Movie\MovieData.d.
"""
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
LAUNCHER = os.path.dirname(HERE)
src = open(os.path.join(LAUNCHER, "bbmod.py"), encoding="utf-8").read()
code = src[src.index("MOVIE = os.path.join("):src.index("def game_running():")]
stock = sys.argv[1] if len(sys.argv) > 1 else os.path.join(LAUNCHER, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Movie", "MovieData.d")

root = tempfile.mkdtemp(prefix="movies_test_")
movie = os.path.join(root, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Movie")
os.makedirs(movie); os.makedirs(os.path.join(root, "mods", "a", "files")); os.makedirs(os.path.join(root, "mods", "b", "files"))
shutil.copyfile(stock, os.path.join(movie, "MovieData.d"))
for m in ("a", "b"):
    with open(os.path.join(root, "mods", m, "files", "x.e.usm"), "wb") as f: f.write(b"CRID" + m.encode() * 100)
ns = {"os": os, "json": json, "re": re, "shutil": shutil, "ROOT": root, "MODS": os.path.join(root, "mods"),
      "mdir": lambda mid: os.path.join(root, "mods", mid)}
exec(code, ns)
sha = lambda: hashlib.sha256(open(os.path.join(movie, "MovieData.d"), "rb").read()).hexdigest()
before, results = sha(), []


def check(what, ok):
    results.append(ok); print("PASS" if ok else "FAIL", what)


good = {"name": "TestMod/intro", "file": "files/x.e.usm", "size": 4096, "duration": 5.0, "w": 2560, "h": 1440}
mods = {"a": {"content": {"movies": [good]}}, "b": {"content": {}}}
report = []
specs = ns["movie_specs"](["a", "b"], mods, report)
check("a good movie is accepted with no report", len(specs) == 1 and not report)
ns["install_movies"](specs)
placed = os.path.join(movie, "TestMod", "intro.e.usm")
listed = [e for e in json.loads(open(os.path.join(movie, "MovieData.d"), "rb").read().decode("utf-8-sig"))["list"] if e["name"] == "TestMod/intro"]
check("install places the file and lists it once", os.path.isfile(placed) and len(listed) == 1 and listed[0]["linguals"][0]["path"] == "TestMod/intro")
check("the ledger names it", json.load(open(os.path.join(root, "mods", "installed_movies.json"))) == ["TestMod/intro"])
report = []
ns["install_movies"](ns["movie_specs"](["a", "b"], mods, report))
listed = [e for e in json.loads(open(os.path.join(movie, "MovieData.d"), "rb").read().decode("utf-8-sig"))["list"] if e["name"] == "TestMod/intro"]
check("a second install does not list it twice and does not call it the game's own", len(listed) == 1 and not report)
ns["install_movies"]([])
check("an install without the mod takes the file, its folder and its line out", not os.path.exists(os.path.dirname(placed)) and sha() == before)
ns["install_movies"](specs); ns["remove_movies"]()
check("uninstall leaves MovieData.d byte for byte as shipped", sha() == before and not os.path.exists(os.path.dirname(placed)))
check("uninstall removes the ledger, and a second uninstall is quiet", not os.path.exists(os.path.join(root, "mods", "installed_movies.json")) and ns["remove_movies"]() is None)
first_stock = json.loads(open(stock, "rb").read().decode("utf-8-sig"))["list"][0]["name"]
for what, bad, word in (("a name of the game's own is refused", dict(good, name=first_stock), "game's own"),
                        ("a name without a folder is refused", dict(good, name="intro"), "Folder/name"),
                        ("a name that climbs out of the folder is refused", dict(good, name="../x/intro"), "Folder/name"),
                        ("a missing file is refused", dict(good, file="files/none.usm"), "missing"),
                        ("a missing number is refused", {k: v for k, v in good.items() if k != "size"}, "numbers")):
    report = []
    got = ns["movie_specs"](["a"], {"a": {"content": {"movies": [bad]}}}, report)
    check(what, not got and len(report) == 1 and word in report[0] and report[0].startswith("ERROR"))
report = []
got = ns["movie_specs"](["a", "b"], {"a": {"content": {"movies": [good]}}, "b": {"content": {"movies": [dict(good)]}}}, report)
check("two mods with one name is a conflict", len(got) == 1 and len(report) == 1 and report[0].startswith("CONFLICT"))
check("the game's file was never changed by a refusal", sha() == before)
shutil.rmtree(root, ignore_errors=True)
print("%d of %d" % (sum(results), len(results)))
sys.exit(0 if all(results) else 1)
