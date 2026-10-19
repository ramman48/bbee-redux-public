"""portable_sounds_test.py: python tools/portable_sounds_test.py"""
import json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portable_sounds as ps

ok = bad = 0
def check(what, cond):
    global ok, bad
    if cond: ok += 1
    else: bad += 1; print("FAIL", what)

tmp = tempfile.mkdtemp()
store = os.path.join(tmp, "store"); os.makedirs(store)
other = os.path.join(tmp, "other"); os.makedirs(other)
def make(folder, name, data):
    p = os.path.join(folder, name); open(p, "wb").write(data); return p
ruby = make(store, "sfx_cx_ruby_ab12.acb", b"ruby")
party = make(store, "party.acb", b"party")
twin = make(other, "party.acb", b"another mod")
gone = os.path.join(store, "gone.acb")

def sheet(i, acb, awb=""):
    return {"Id": i, "Name": "s%d" % i, "Linguals": [{"LingualTag": "common", "_acbPath": acb, "_awbPath": awb}]}
sheets = [sheet(1, "Audio/bgm.acb", "Audio/bgm.awb"), sheet(2, "Audio/chs/voice.acb"), sheet(397, ruby), sheet(398, ruby),
          sheet(399, party), sheet(401, twin), sheet(402, gone)]
files, left = ps.relink(sheets)

check("the game's own sheets are untouched", sheets[0]["Linguals"][0] == {"LingualTag": "common", "_acbPath": "Audio/bgm.acb", "_awbPath": "Audio/bgm.awb"}
      and sheets[1]["Linguals"][0]["_acbPath"] == "Audio/chs/voice.acb")
check("a mod's sheet points into the game", sheets[2]["Linguals"][0]["_acbPath"] == "Audio/zenith/sfx_cx_ruby_ab12.acb")
check("two sheets, one file: one copy", sheets[3]["Linguals"][0]["_acbPath"] == "Audio/zenith/sfx_cx_ruby_ab12.acb" and files["sfx_cx_ruby_ab12.acb"] == ruby)
check("two mods, one file name: both kept", sheets[4]["Linguals"][0]["_acbPath"] == "Audio/zenith/party.acb"
      and sheets[5]["Linguals"][0]["_acbPath"] == "Audio/zenith/401_party.acb" and files["401_party.acb"] == twin)
check("a file that is not there keeps its path and is reported", sheets[6]["Linguals"][0]["_acbPath"] == gone and left == [gone])
check("an empty wave bank path stays empty", sheets[2]["Linguals"][0]["_awbPath"] == "")
check("three files listed", sorted(files) == ["401_party.acb", "party.acb", "sfx_cx_ruby_ab12.acb"])
check("a second pass changes nothing", ps.relink(sheets) == ({}, [gone]))
check("a Linux-style full path counts as full", ps._full("/home/deck/x.acb") and not ps._full("Audio/x.acb") and not ps._full(""))

out = os.path.join(tmp, "out"); os.makedirs(out)
dest = os.path.join(tmp, "game", "Audio", "zenith")
json.dump(files, open(os.path.join(out, ps.LIST), "w"))
quiet = lambda *a: None
check("place copies every file", ps.place(out, dest, quiet) == 3 and open(os.path.join(dest, "401_party.acb"), "rb").read() == b"another mod")
stamp = os.path.getmtime(os.path.join(dest, "party.acb"))
open(os.path.join(dest, "old_mod.acb"), "wb").write(b"x")
ps.place(out, dest, quiet)
check("a file no build uses is removed", not os.path.exists(os.path.join(dest, "old_mod.acb")))
check("an unchanged file is not copied again", os.path.getmtime(os.path.join(dest, "party.acb")) == stamp)
make(store, "party.acb", b"party, made again"); ps.place(out, dest, quiet)
check("a changed file is copied", open(os.path.join(dest, "party.acb"), "rb").read() == b"party, made again")
os.remove(os.path.join(out, ps.LIST)); ps.place(out, dest, quiet)
check("a build with no mod sounds empties the folder", not os.path.exists(dest))
ps.clear(dest)
check("clear on a missing folder is fine", not os.path.exists(dest))
check("the game folder is under StreamingAssets", ps.game_folder("R").replace("\\", "/") == "R/game/BlazblueEntropyEffect_Data/StreamingAssets/Audio/zenith")
check("rewrite without a built collection does nothing", ps.rewrite(out, None, quiet) == {})

print("%d/%d" % (ok, ok + bad)); sys.exit(1 if bad else 0)
