r"""movies_takeover_test.py -- a movie another install folder placed (the workspace, an older or moved Terminal) is
listed in MovieData.d but not in this folder's ledger. The movie step takes it over instead of aborting, and never
takes over a game movie. Runs in a temporary folder; nothing in the game folder is touched.

  python tools\movies_takeover_test.py [path to the game's StreamingAssets\Movie\MovieData.d]

Without a path it uses Launcher\game\...\Movie\MovieData.d; the last check is skipped when that file is missing.
"""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bbmod

GAME_LIST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(bbmod.MOVIE, "MovieData.d")
tmp = tempfile.mkdtemp(prefix="movtakeover_")
movie, modsd = os.path.join(tmp, "Movie"), os.path.join(tmp, "mods")
os.makedirs(os.path.join(movie, "ExRagna")); os.makedirs(os.path.join(modsd, "ex-ragna"))
open(os.path.join(modsd, "ex-ragna", "rgx.e.usm"), "wb").write(b"new movie")
open(os.path.join(movie, "ExRagna", "rgx4000.e.usm"), "wb").write(b"old movie")     # placed by another install folder
ent = lambda n: {"name": n, "linguals": [{"lingualTag": "common", "path": n, "size": 1, "duration": 1, "w": 1, "h": 1}]}
lst = {"list": [ent("HeroSelect/Ragna"), ent("HeroSelect/Jin"), ent("ExRagna/rgx4000")]}
open(os.path.join(movie, "MovieData.d"), "wb").write(json.dumps(lst).encode())
bbmod.MOVIE, bbmod.MOVIE_LEDGER, bbmod.mdir = movie, os.path.join(modsd, "installed_movies.json"), lambda mid: os.path.join(modsd, mid)
spec = {"name": "ExRagna/rgx4000", "file": "rgx.e.usm", "size": 9, "duration": 5, "w": 1920, "h": 1080}
ok = True


def note(what, cond):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + what)


def listed():
    return [e["name"] for e in json.loads(open(os.path.join(movie, "MovieData.d"), "rb").read().decode("utf-8-sig"))["list"]]


try:
    report = []
    specs = bbmod.movie_specs(["ex-ragna"], {"ex-ragna": {"content": {"movies": [spec]}}}, report)
    note("no error for a movie another install folder placed", not report)
    note("it is marked to be taken over", specs and specs[0].get("adopt"))
    bbmod.install_movies(specs)
    note("listed once after install", listed().count("ExRagna/rgx4000") == 1)
    note("the game's own lines kept", listed()[:2] == ["HeroSelect/Ragna", "HeroSelect/Jin"])
    note("the file is the mod's new one", open(os.path.join(movie, "ExRagna", "rgx4000.e.usm"), "rb").read() == b"new movie")
    note("the ledger holds it", json.load(open(bbmod.MOVIE_LEDGER)) == ["ExRagna/rgx4000"])
    bbmod.remove_movies()
    note("uninstall leaves only the game's own", listed() == ["HeroSelect/Ragna", "HeroSelect/Jin"] and not os.path.isdir(os.path.join(movie, "ExRagna")))

    report = []
    bbmod.movie_specs(["ex-ragna"], {"ex-ragna": {"content": {"movies": [dict(spec, name="HeroSelect/Jin")]}}}, report)
    note("a game movie's name is still refused", any("one of the game's own" in r for r in report))
    report = []
    bbmod.movie_specs(["ex-ragna"], {"ex-ragna": {"content": {"movies": [dict(spec, name="HeroSelect/Ragna"), dict(spec, name="HeroSelect/Jin")]}}}, report)
    note("a mod claiming every name of a game folder is still refused", sum("one of the game's own" in r for r in report) == 2)

    # 2026-10-23, build 44 on the Dev Terminal: the workspace had placed these four, the Terminal had no ledger
    if os.path.isfile(GAME_LIST):
        shutil.copyfile(GAME_LIST, os.path.join(movie, "MovieData.d"))
        if os.path.exists(bbmod.MOVIE_LEDGER): os.remove(bbmod.MOVIE_LEDGER)
        four = {"ex-ragna": "ExRagna/rgx4000", "ex-hakumen": "ExHakumen/hax4000", "char-arcueid": "Arcueid/arc4000",
                "char-swiftmaster": "SwiftMaster/swm4000"}
        present = {m: n for m, n in four.items() if n in listed()}
        for mid in present:
            os.makedirs(os.path.join(modsd, mid), exist_ok=True)
            open(os.path.join(modsd, mid, "rgx.e.usm"), "wb").write(b"x")
        report = []
        specs = bbmod.movie_specs(list(present), {m: {"content": {"movies": [dict(spec, name=n)]}} for m, n in present.items()}, report)
        note("the game's real list: our movies listed with no ledger pass (%d found)" % len(present),
             not report and all(s.get("adopt") for s in specs))
    else:
        print("SKIP the game's real list: %s not found" % GAME_LIST)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print("ALL PASS" if ok else "FAILED")
sys.exit(0 if ok else 1)
