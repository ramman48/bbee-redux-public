"""A mod list: which mods a person has switched on, with their versions, as a small file to send to someone else.

The file holds names and versions only. It carries no mod, no link and nothing that runs: using a list switches on
the mods the other person already has, and says which ones they still need. Written as JSON:

    { "zenithList": 1, "made": "2026-10-11 11:20", "gameBuild": "25627491", "terminal": "0.3.0",
      "mods": [ { "id": "char-nine", "title": "Nine the Phantom", "version": "0.9.0", "settings": { "voice": "en" } } ] }
"""
import json
import os
import re
import time

KEY = "zenithList"
ENDING = ".zenith.json"
MOST_BYTES = 256 << 10
# a list comes from someone else: its words are shown to the person, so nothing that could be read as markup or
# that cannot be seen is kept (the window also shows them as plain text)
_NOT_WORDS = re.compile(r"[<>&\x00-\x1f\x7f\u2028\u2029\u202a-\u202e\u2066-\u2069]")


def _words(value, most):
    return _NOT_WORDS.sub("", str(value)).strip()[:most]


def make(mods, game_build, terminal, chosen=None):
    """the list for the mods switched on now (core files are left out: they go in with any mod)"""
    out = []
    for mod in mods:
        if not mod["enabled"] or mod["locked"]: continue
        entry = {"id": mod["id"], "title": mod["title"], "version": mod["version"]}
        mine = (chosen or {}).get(mod["id"])
        if mine: entry["settings"] = dict(mine)
        out.append(entry)
    return {KEY: 1, "made": time.strftime("%Y-%m-%d %H:%M"), "gameBuild": game_build, "terminal": terminal, "mods": out}


def read(path):
    """-> the list's mods as [{"id", "title", "version", "settings"}], or None when the file is not a mod list"""
    try:
        if os.path.getsize(path) > MOST_BYTES: return None
        with open(path, encoding="utf-8") as f: data = json.load(f)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or data.get(KEY) != 1 or not isinstance(data.get("mods"), list): return None
    out = []
    for entry in data["mods"][:200]:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or not entry["id"]: continue
        settings = entry.get("settings") if isinstance(entry.get("settings"), dict) else {}
        mod_id = entry["id"][:80]
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", mod_id): continue           # not a mod's id
        out.append({"id": mod_id, "title": _words(entry.get("title") or mod_id, 80) or mod_id, "version": _words(entry.get("version") or "", 24),
                    "settings": {str(k)[:40]: v for k, v in settings.items() if not isinstance(v, (dict, list))}})
    return out


def compare(listed, mods):
    """What using the list would do, against the Library as it is.
    -> {"on": mods it switches on, "off": mods it switches off, "missing": listed mods not in the Library,
        "other": listed mods here in another version (each with "have")}; every entry has "title" and "version"."""
    have = {mod["id"]: mod for mod in mods if not mod["locked"]}
    wanted = {entry["id"] for entry in listed}
    on = [dict(entry, title=have[entry["id"]]["title"]) for entry in listed if entry["id"] in have]
    return {
        "on": on,
        "off": [{"id": mod["id"], "title": mod["title"], "version": mod["version"]} for mod in mods
                if mod["enabled"] and not mod["locked"] and mod["id"] not in wanted],
        "missing": [entry for entry in listed if entry["id"] not in have],
        "other": [dict(entry, title=have[entry["id"]]["title"], have=have[entry["id"]]["version"]) for entry in listed
                  if entry["id"] in have and entry["version"] and have[entry["id"]]["version"] != entry["version"]],
    }


def _names(entries, version=True):
    return ", ".join(("%s %s" % (e["title"], e["version"])).strip() if version else e["title"] for e in entries)


def question(found):
    """the words of the question before a list is used"""
    parts = []
    if found["on"]: parts.append("It switches on: %s." % _names(found["on"], False))
    else: parts.append("None of its mods are in your Library.")
    if found["off"]: parts.append("It switches off: %s." % _names(found["off"], False))
    if found["missing"]: parts.append(("Not in your Library: %s. Ask whoever sent the list where to get it."
                                       if len(found["missing"]) == 1 else
                                       "Not in your Library: %s. Ask whoever sent the list where to get them.")
                                      % _names(found["missing"]))
    if found["other"]: parts.append("A different version here: %s." % ", ".join(
        "%s (yours %s, the list's %s)" % (e["title"], e["have"], e["version"]) for e in found["other"]))
    parts.append("Nothing is downloaded and nothing goes into your game until you install.")
    return " ".join(parts)
