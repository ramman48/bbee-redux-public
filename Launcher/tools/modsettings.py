"""A mod's own settings: choices its author offers, which the player makes before installing.

A mod declares them in mod.json, beside "content":

    "settings": [
      { "id": "voice", "name": "Voice", "about": "The language of her voice lines.",
        "default": "jp",
        "options": [
          { "value": "jp", "label": "JAPANESE" },
          { "value": "en", "label": "ENGLISH",
            "content": { "tables": { "ActorVoiceConf": [ { "Id": 190001, "Bank": "en" } ] } } }
        ] }
    ]

Each option may carry "content", written exactly like the mod's own "content". At build time the chosen option's
content is laid over the mod's: lists (table rows, js patches, clones) get the option's entries added at the end,
so a row here overrides the same row of the mod, and named values (locale keys, whole js files) are replaced.

What the player chose is kept per game, in that game's profile.json:

    { "enabled": ["char-example"], "settings": { "char-example": { "voice": "en" } } }

A setting with nothing chosen, or with a value the mod no longer offers, uses its default (the first option when
no default is named). After an install the values that went in are written beside installed.json as
installed_settings.json, so a window can tell that a changed setting has not been applied yet.

    python tools/modsettings.py <mod.json>      checks one mod's settings and prints them
"""
import copy
import json
import os
import sys


def _read(path, default):
    try:
        with open(path, encoding="utf-8") as f: return json.load(f)
    except (OSError, ValueError):
        return default


def problems(mod):
    """what is wrong with a mod's "settings", as sentences for its author (an empty list: nothing)"""
    out, seen = [], set()
    listed = mod.get("settings", [])
    if not isinstance(listed, list): return ['"settings" has to be a list']
    for n, s in enumerate(listed):
        where = "setting %d" % (n + 1)
        if not isinstance(s, dict) or not isinstance(s.get("id"), str) or not s.get("id"):
            out.append('%s needs an "id"' % where); continue
        where = 'setting "%s"' % s["id"]
        if s["id"] in seen: out.append("%s is there twice" % where)
        seen.add(s["id"])
        options = s.get("options")
        if not isinstance(options, list) or len(options) < 2:
            out.append("%s needs at least two options" % where); continue
        values = []
        for o in options:
            if not isinstance(o, dict) or "value" not in o or isinstance(o["value"], (dict, list)):
                out.append('every option of %s needs a "value" (text, a number, true or false)' % where); break
            if "content" in o and not isinstance(o["content"], dict): out.append('an option\'s "content" in %s has to be written like the mod\'s own' % where)
            values.append(o["value"])
        else:
            if len(set(map(json.dumps, values))) != len(values): out.append("%s has the same value twice" % where)
            if "default" in s and s["default"] not in values: out.append("the default of %s is not one of its options" % where)
    return out


def chosen_for(mod, chosen):
    """{setting id: value} for one mod: what was chosen where the mod still offers it, else the default"""
    out = {}
    if problems(mod): return out
    mine = chosen.get(mod.get("id"), {}) if isinstance(chosen, dict) else {}
    if not isinstance(mine, dict): mine = {}
    for s in mod.get("settings", []):
        values = [o["value"] for o in s["options"]]
        want = mine.get(s["id"], s.get("default", values[0]))
        out[s["id"]] = want if want in values else s.get("default", values[0])
    return out


def _lay(over, under):
    """`over` laid on `under` in place: lists grow, named values are replaced, and so on down"""
    for key, value in over.items():
        if isinstance(value, dict) and isinstance(under.get(key), dict): _lay(value, under[key])
        elif isinstance(value, list) and isinstance(under.get(key), list): under[key].extend(copy.deepcopy(value))
        else: under[key] = copy.deepcopy(value)


def read(profile_path):
    """what the player chose, from a game's profile.json"""
    found = _read(profile_path, {})
    found = found.get("settings", {}) if isinstance(found, dict) else {}
    return found if isinstance(found, dict) else {}


def apply(mods, chosen, tell=print):
    """Lay each mod's chosen options over its content. `mods` is the loader's {id: mod.json}; it is changed in place.
    -> {mod id: {setting id: value}} for the mods that have settings."""
    used = {}
    for mid in sorted(mods):
        mod = mods[mid]
        if not mod.get("settings"): continue
        wrong = problems(mod)
        if wrong:
            if tell: tell("  WARNING %s: its settings are left out (%s)" % (mid, "; ".join(wrong)))
            continue
        used[mid] = chosen_for(mod, chosen)
        for s in mod["settings"]:
            option = next(o for o in s["options"] if o["value"] == used[mid][s["id"]])
            if option.get("content"): _lay(option["content"], mod.setdefault("content", {}))
        if tell: tell("  settings %s: %s" % (mid, ", ".join("%s = %s" % (k, json.dumps(v)) for k, v in used[mid].items())))
    return used


def record(used, installed_path, enabled=None):
    """after an install: the values that went into the game, beside installed.json"""
    path = os.path.join(os.path.dirname(installed_path), "installed_settings.json")
    kept = {mid: values for mid, values in used.items() if enabled is None or mid in enabled}
    with open(path, "w", encoding="utf-8") as f: json.dump(kept, f, indent=1)


if __name__ == "__main__":
    if len(sys.argv) != 2: sys.exit(__doc__)
    one = _read(sys.argv[1], None)
    if not isinstance(one, dict): sys.exit("not a mod.json: " + sys.argv[1])
    wrong = problems(one)
    for line in wrong: print("PROBLEM: " + line)
    for s in one.get("settings", []) if not wrong else []:
        print("%s (%s): %s; default %s" % (s.get("name", s["id"]), s["id"], ", ".join(str(o.get("label", o["value"])) for o in s["options"]),
                                         json.dumps(s.get("default", s["options"][0]["value"]))))
    if not one.get("settings"): print("no settings")
    sys.exit(1 if wrong else 0)
