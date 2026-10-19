"""modsettings.py on made-up mods: what is chosen, what is laid over a mod's content, and what a bad entry does.

  python tools/modsettings_test.py
"""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modsettings as ms  # noqa: E402

results = []


def note(label, ok, detail=""):
    results.append((label, bool(ok)))
    print("%-5s %s%s" % ("ok" if ok else "FAIL", label, ("  [" + str(detail)[:300] + "]") if detail and not ok else "")); sys.stdout.flush()


def mod():
    return {"id": "char-test", "name": "Test", "version": "1.0.0",
            "content": {"tables": {"ActorConf": [{"Id": 1, "Hp": 100}]}, "locale": {"enu": {"Name": "Test", "Line": "Hello"}},
                        "js": [{"file": "a", "append": "one"}]},
            "settings": [
                {"id": "voice", "name": "Voice", "default": "jp", "options": [
                    {"value": "jp", "label": "JAPANESE"},
                    {"value": "en", "label": "ENGLISH", "content": {"tables": {"ActorConf": [{"Id": 1, "Bank": "en"}], "VoiceConf": [{"Id": 7}]},
                                                                   "locale": {"enu": {"Line": "Hi"}}, "js": [{"file": "a", "append": "two"}]}}]},
                {"id": "hard", "name": "Harder", "options": [{"value": False, "label": "OFF"}, {"value": True, "label": "ON", "content": {"locale": {"chs": {"Name": "T"}}}}]},
            ]}


tmp = tempfile.mkdtemp(prefix="zt_modsettings_")
try:
    said = []
    m = mod(); before = json.dumps(m["content"], sort_keys=True)
    used = ms.apply({"char-test": m}, {}, said.append)
    note("nothing chosen: the defaults (the named one, else the first option)", used == {"char-test": {"voice": "jp", "hard": False}}, used)
    note("options without content change nothing", json.dumps(m["content"], sort_keys=True) == before)
    note("the build log says what was used", said and "voice" in said[-1] and "char-test" in said[-1], said)

    m = mod(); used = ms.apply({"char-test": m}, {"char-test": {"voice": "en", "hard": True}}, None)
    c = m["content"]
    note("the chosen values are used", used == {"char-test": {"voice": "en", "hard": True}}, used)
    note("an option's table rows come after the mod's own, so they override the same row", c["tables"]["ActorConf"] == [{"Id": 1, "Hp": 100}, {"Id": 1, "Bank": "en"}], c["tables"])
    note("a table only the option names is added", c["tables"]["VoiceConf"] == [{"Id": 7}])
    note("a text key is replaced and the others are kept", c["locale"]["enu"] == {"Name": "Test", "Line": "Hi"}, c["locale"])
    note("a language only the option names is added", c["locale"]["chs"] == {"Name": "T"})
    note("js patches are added at the end", [j["append"] for j in c["js"]] == ["one", "two"])

    fresh = mod(); ms.apply({"char-test": mod()}, {"char-test": {"voice": "en"}}, None)
    note("a mod read again is as its file says (nothing is shared between two builds)", json.dumps(fresh) == json.dumps(mod()))

    used = ms.apply({"char-test": mod()}, {"char-test": {"voice": "de", "gone": 1}}, None)
    note("a value the mod does not offer falls back to the default; a setting it does not have is ignored", used == {"char-test": {"voice": "jp", "hard": False}}, used)
    used = ms.apply({"char-test": mod()}, {"char-test": "nonsense", "other": 3}, None)
    note("a damaged entry in the profile is the same as nothing chosen", used == {"char-test": {"voice": "jp", "hard": False}}, used)
    plain = {"id": "plain", "name": "Plain", "version": "1", "content": {}}
    note("a mod without settings is left alone and not listed", ms.apply({"plain": plain}, {"plain": {"x": 1}}, None) == {} and plain["content"] == {})

    # ---- a mod.json written wrongly ----------------------------------------------------------------------------
    for label, change, word in (
            ("one option", lambda s: s[0].update(options=s[0]["options"][:1]), "two options"),
            ("no id", lambda s: s[0].pop("id"), '"id"'),
            ("the same id twice", lambda s: s[1].update(id="voice"), "twice"),
            ("a default that is not an option", lambda s: s[0].update(default="fr"), "default"),
            ("the same value twice", lambda s: s[0]["options"][1].update(value="jp"), "same value"),
            ("an option without a value", lambda s: s[0]["options"][1].pop("value"), '"value"')):
        bad = mod(); change(bad["settings"]); before = json.dumps(bad["content"], sort_keys=True); said = []
        used = ms.apply({"char-test": bad}, {"char-test": {"voice": "en"}}, said.append)
        note("%s: said, the mod's settings are left out, the mod still builds as written" % label,
             word in " ".join(ms.problems(bad)) and used == {} and json.dumps(bad["content"], sort_keys=True) == before and "WARNING" in said[-1],
             (ms.problems(bad), used))
    note("a good mod has no problems", ms.problems(mod()) == [])

    # ---- the files ---------------------------------------------------------------------------------------------
    profile = os.path.join(tmp, "profile.json")
    note("no profile file: nothing chosen", ms.read(profile) == {})
    with open(profile, "w", encoding="utf-8") as f: json.dump({"enabled": ["char-test"], "settings": {"char-test": {"voice": "en"}}}, f)
    note("the choices are read from the game's profile.json", ms.read(profile) == {"char-test": {"voice": "en"}})
    with open(profile, "w", encoding="utf-8") as f: f.write("{ not json")
    note("an unreadable profile: nothing chosen", ms.read(profile) == {})
    installed = os.path.join(tmp, "installed.json")
    ms.record({"char-test": {"voice": "en"}, "off-mod": {"x": 1}}, installed, enabled=["char-test"])
    with open(os.path.join(tmp, "installed_settings.json"), encoding="utf-8") as f: went_in = json.load(f)
    note("after an install the values of the mods that went in are written beside installed.json", went_in == {"char-test": {"voice": "en"}}, went_in)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
bad = [l for l, ok in results if not ok]
print("\n%d of %d as expected%s" % (len(results) - len(bad), len(results), "" if not bad else "; NOT as expected: " + "; ".join(bad)))
sys.exit(1 if bad else 0)
