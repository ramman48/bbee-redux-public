"""What the screens talk to: one object that reads the loader's folders and runs the loader's own commands.

The loader is KittySkin's (`Launcher\\entry_point.py` and the files beside it) and is used as it is: this module
starts `entry_point.py setup | install | uninstall | backup-save | repair-save | feedback` as child processes and
reads what they print. It changes two things itself, both of which the loader's own `bbmod.py enable / disable`
would change the same way: the list of enabled mods (`mods\\profile.json`) and, when a mod is added or deleted, the
`mods` folder.

One thing a mod may bring that the loader itself knows nothing of (0.3.0): `terminal.json` in its folder, with its
name, version and words, and `prepare`, scripts this window runs from the loader's folder before the loader's
install. A character whose data is made on the player's PC has no mod.json until then and is listed from this file;
everything such a mod needs is inside its own folder, so adding it never replaces a file of the loader.

What a person reads about a mod is prepared here too: `known_mods.json` holds the words, pictures and placement for
the mods the Terminal knows, and any other mod's own description is shown with its developer details and
requirement sentences left out (`player_text`).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import zipfile

from PySide6.QtCore import Property, QFile, QObject, QProcess, QProcessEnvironment, QTimer, QUrl, Signal, Slot
from PySide6.QtGui import QDesktopServices, QGuiApplication, QImage

from . import extras, fetch, logs, modlist

VERSION = "0.5.1"
HERE = os.path.dirname(os.path.abspath(__file__))
APPID = "2273430"
EXE = "BlazblueEntropyEffect.exe"
ART_DETAIL = ("art/terminal.png", "art/portrait_full.png", "art/portrait_mb.png", "art/portrait.png", "portrait.png",
              "art/card.png", "card.png")
SETTINGS = {"motion": ("full", "calm"), "startPage": ("home", "library"), "showCore": (False, True),
            "applyUpdates": (True, False), "graphics": ("full", "light", "off"), "sound": ("on", "off"),
            "volume": (30, 100, 70, 50, 15, 5),   # 30 since 0.4.1: 70 was "loud af" (a tester, 2026-10-18)
            # 0.5.0
            "checkEvery": (15, 60, 0),             # minutes between quiet update checks while the window is open; 0: off
            "tray": ("on", "off"),                 # closing the window keeps the Terminal in the tray
            "quietWhilePlaying": (True, False),    # no update check or download while the game is open
            "firstInstall": (True, False),         # a first open with mods switched on installs them at once
            "language": ("en", "zh-Hans", "zh-Hant", "ja", "ko", "fr", "de", "es", "ru", "pt-BR")}
LANGUAGES = [("en", "English"), ("zh-Hans", "简体中文"), ("zh-Hant", "繁體中文"), ("ja", "日本語"), ("ko", "한국어"),
             ("fr", "Français"), ("de", "Deutsch"), ("es", "Español"), ("ru", "Русский"), ("pt-BR", "Português (Brasil)")]
# what the updater prints while it downloads (Updater 1.3.0)
_DOWNLOADED = re.compile(r"Downloaded (\d+)/(\d+) files, ([\d.]+) MB, ([\d.]+) MB/s, about (\d+:\d\d) left")
STALL_SECONDS = 120                  # no new line from a job for this long: the panel offers to stop it
OFFICIAL_HEROES = [("Ragna", 100101), ("Jin", 100201), ("Noel", 100301), ("Rachel", 100401), ("Taokaka", 100501),
                   ("Hakumen", 101101), ("Hazama", 101401), ("Platinum", 101801), ("Bullet", 102201),
                   ("Kokonoe", 102501), ("Lambda-No.11-", 102801), ("Hibiki", 102901), ("Naoto", 103101), ("Es", 103401),
                   ("Mai", 103501), ("ICEY", 103701), ("The Prisoner", 103801)]   # docs\characters\ROSTER_MAP.md
RUN_MODES = [("NORMAL", 1001, 4), ("ADVANCED", 1002, 5), ("EXTREME", 1003, 6)]     # dev-testroom's RUN_MODES
GRIM_MODE = ("GRIM OF THE ABYSS", 1700, 6)                                          # entropy-grim's mode row
DEV_LISTS = "https://raw.githubusercontent.com/ramman48/bbee-redux-dev/main/lists"
DEV_REPO_API = "https://api.github.com/repos/ramman48/bbee-redux-dev"
STEAM_NAME = "The Zenith Terminal"
PLAYERS_API = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=2273430"

INSTALL_STEPS = ["Find the game", "Read the game's data", "Back up your save", "Build your mods", "Install"]
# what the loader prints -> the step that line belongs to (the first match wins, steps only move forward)
INSTALL_MARKS = [("Game folder link", 0), ("Reading the game data", 1), ("tables decoded", 1), ("Save backed up", 2),
                 ("Removed from", 2), ("game build ", 3), ("tables:", 3), ("js:", 3), ("NEW bundle entry", 4),
                 ("installed ", 4)]
REBUILD_STEPS = ["Back up your save", "Build your mods", "Install"]
REBUILD_MARKS = [("Save backed up", 0), ("Removed from", 0), ("game build ", 1), ("tables:", 1), ("js:", 1),
                 ("NEW bundle entry", 2), ("installed ", 2)]
TAKE_OUT_STEPS = ["Back up your save", "Take it out of your save", "Rebuild your game without it"]
TAKE_OUT_MARKS = [("Save backed up", 0), ("Removed from", 1), ("game build ", 2), ("tables:", 2), ("js:", 2),
                  ("NEW bundle entry", 2), ("installed ", 2)]
UPDATE_TITLE = "CHECKING FOR UPDATES"
UPDATE_STEPS = ["Check for updates", "Download what changed", "Put the updates in your game"]
UPDATE_MARKS = [("Checking", 0), ("Downloading", 1), ("successfully updated", 1), ("Installing", 1),
                ("Save backed up", 2), ("game build ", 2), ("tables:", 2), ("installed ", 2)]
REMOVE_STEPS = ["Back up and clean your save", "Remove the mods"]
REMOVE_MARKS = [("Save backed up", 0), ("Save repaired", 0), ("merge.json restored", 1), ("uninstalled", 1)]
SETUP_STEPS = ["Find the game", "Read the game's data"]
SETUP_MARKS = [("Game folder link", 0), ("Reading the game data", 1), ("tables decoded", 1)]
BACKUP_STEPS = ["Copy your save"]
BACKUP_MARKS = [("Save backed up", 0)]
REPAIR_STEPS = ["Back up your save", "Clean your save"]
REPAIR_MARKS = [("Save backed up", 0), ("Cleaned ", 1), ("Save repaired", 1), ("nothing to change", 1)]
REPORT_STEPS = ["Collect the files"]
REPORT_MARKS = [("F9 reports included", 0)]
PROBLEM = ("PROBLEM:", "REFUSING", "BUILD ABORTED")
PREPARE_STEP = "Prepare your mods"       # mods with a `prepare` list in terminal.json: made here before the install
ADD_STEPS = ["Unpack the files"]
LINK_STEPS = ["Download the zip", "Unpack the files"]
# files that are run, not read. Only for the wording of the question: every mod is asked about, because what the
# loader runs is named in the mod's own card (any file name) and a card can claim any mod's id.
_RUNS = re.compile(r"\.(?:py|pyw|bat|cmd|ps1|exe|dll|com|vbs)$", re.I)
TRUST = "Add it only if you trust where it came from."

PLAY_TEXT = "Start the game from Steam. New characters are at the end of the Prototype list."
COPY_PLAY_TEXT = "Start this copy with PLAY. New characters are at the end of the Prototype list."
COPY_STEPS = ["Copy the game's files"]
COPY_MARKS = [(" files", 0)]
COPY_TOOL = "tools/gamecopy.py"
MOST_COPIES = 3
PLAIN_NAME = "No mods"                   # the copy PLAY WITHOUT MODS starts: it never takes mods and is not one of the three
SETTINGS_TOOL = "tools/modsettings.py"   # a loader with this file builds a mod with the options its player chose
STOCK_PRODUCT = "BlazblueEntropyEffect"
def stop_cause(log):
    """What stopped the loader, from its own lines: the error of a Python traceback with the place it came from,
    else its ERROR / CONFLICT lines. '' when the log has neither. (2026-10-12: a player's panel said only
    "The install stopped with an error (see above)".)"""
    start = max((i for i, line in enumerate(log) if line.startswith("Traceback (most recent call last)")), default=-1)
    if start >= 0:
        where, error = "", ""
        for line in log[start + 1:]:
            found = re.match(r'\s+File "(.+?)", line (\d+)', line)
            if found: where = "%s, line %s" % (os.path.basename(found.group(1).replace("\\", "/")), found.group(2))
            elif line[:1] not in (" ", "\t") and not error: error = line.strip()
        if error: return error + (" (%s)" % where if where else "")
    errors = [line.strip() for line in log if line.lstrip().startswith(("ERROR", "CONFLICT"))]
    return "\n".join(errors[-3:])


_MADE = re.compile(r"^made '.*' \(([a-z0-9-]+)\)")
# sentences a mod's own description may hold that the window does not show: what another game or file it wants, and
# developer details. During the alpha no character's text says that it requires anything (the lead, 2026-10-09).
_REQUIRES = re.compile(r"\brequire[sd]?\b|\bneeds? (?:bbee-|the |a |an |your )?[\w .-]{0,40}(?:sdk|dlc|install|copy|game)"
                       r"|\byour own\b.{0,60}\binstall|\bbuilt on your machine\b|\bownership\b|\bmust (?:own|have|be installed)\b",
                       re.I)
_DEV = re.compile(r"\s*\((?:actor ?id)[^)]*\)", re.I)
# loader lines about owning or having another game: not shown in the window's short log (the full log keeps them)
_OTHER_GAME = re.compile(r"(centralfiction|cross tag|bbtag)", re.I)


def _read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f: return json.load(f)
    except (OSError, ValueError):
        return default


def _version_newer(a, b):
    """version a is higher than b, compared number by number ("0.3.14" > "0.3.12")"""
    key = lambda v: [int(n) for n in re.findall(r"\d+", str(v))]
    return key(a) > key(b)


def _game_open():
    """the game is running (Windows: tasklist). An install would be refused then, so nothing starts by itself."""
    if os.name != "nt": return False
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq " + EXE, "/NH"], capture_output=True, text=True, timeout=10,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
    except (OSError, subprocess.SubprocessError):
        return True                    # not known: do not start an install on a guess
    return EXE.lower() in out.lower()


def _changelog_head(folder, lines=4):
    """the newest section of a mod's CHANGELOG.md: its first few list lines, in plain words"""
    for name in ("CHANGELOG.md", "CHANGES.md"):
        path = os.path.join(folder, name)
        if not os.path.isfile(path): continue
        out, inside = [], False
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                for line in f:
                    if line.startswith("## "):
                        if inside: break
                        inside = True
                        continue
                    text = line.strip()
                    if inside and text.startswith(("- ", "* ")):
                        out.append(player_text(re.sub(r"[`*_]", "", text[2:]))[:140])
                        if len(out) >= lines: break
        except OSError:
            return []
        return out
    return []


def player_text(text):
    """A mod's own description as the window shows it: without developer details in brackets and without the
    sentences that state what else it requires."""
    text = _DEV.sub("", str(text or "")).strip()
    kept = [part for part in re.split(r"(?<=[.!?])\s+", text) if part and not _REQUIRES.search(part)]
    return " ".join(kept)


class Controller(QObject):
    changed = Signal()
    busyChanged = Signal()
    logChanged = Signal()
    settingsChanged = Signal()
    said = Signal(str)            # one line for the person, shown above the foot of the window
    _packed = Signal(bool, str)   # a pack was unpacked on its own thread: back on the window's thread
    _fetched = Signal(bool, str)  # a zip was downloaded on its own thread (the file, or what went wrong)
    _arrived = Signal(str)        # how much of it has arrived, as a line for the log
    loaded = Signal()             # the first read of the folders is done (0.5.0: the window shows before it)
    popup = Signal(str, str)      # a title and a line for the tray's pop-up (an update arrived)
    reopenWanted = Signal()       # CHECK NOW brought the window's own files: it closes and opens again on them
    healthChanged = Signal()
    statsChanged = Signal()
    statusChanged = Signal()
    _worked = Signal(str, bool, str)      # a job step that ran on a thread of its own: its name, ok, what it said
    _checked = Signal(list)               # the health check's rows, from its thread
    _counted = Signal(dict)               # play stats, from their thread
    _players = Signal(int)                # the game's players on Steam now, from a thread (-1: not known)
    _keyed = Signal(bool, str)            # a playtester key was tried against the dev channel
    _sent = Signal(bool, str)             # a report went to Discord, or why not

    def __init__(self, launcher, profile_root=None, demo=False, data_dir=None, parent=None, defer=False):
        super().__init__(parent)
        self.launcher = os.path.abspath(launcher)
        self.profile_root = profile_root          # a stand-in for the user's profile folder (tests only)
        self.demo = demo                          # nothing is started: the screens are driven by hand
        self.data_dir = data_dir                  # where the window keeps its own settings and its last log
        self._known = _read_json(os.path.join(HERE, "known_mods.json"), {})
        self._links = _read_json(os.path.join(HERE, "links.json"), {})
        self._settings = {key: allowed[0] for key, allowed in SETTINGS.items()}
        saved = _read_json(self._data("settings.json"), {}) if data_dir else {}
        self._settings.update({k: v for k, v in saved.items() if k in SETTINGS and v in SETTINGS[k]})
        self._copy = str(saved.get("gameCopy") or "")      # the game copy the window sets up ("": the Steam game)
        self._demo_off = None
        self._demo_chosen = None
        self._made_copy = ""
        self._measured = {}
        self._demo_enabled = None
        self._demo_disk = None
        self._mods, self._state, self._build = [], "setup", ""
        self._installed, self._installed_at = set(), ""
        self._recorded = False
        self._busy = self._running = False
        self._updater_running = False             # the job's process now is the Terminal's updater
        self._offered = set()                     # deleted mods asked about in this session (nextOffer)
        self._redux_file = os.path.join(HERE, "redux.json")   # the Redux set this window shows, when it has one
        self._title, self._steps, self._step = "", [], -1
        self._log, self._result, self._result_text = [], "", ""
        self._queue, self._proc, self._marks, self._problem = [], None, [], []
        self._done_text, self._after = "", ""
        self._problem_open = False
        self._prep_step = 0
        self._packed.connect(self._pack_done)
        self._fetched.connect(self._fetch_done)
        self._arrived.connect(self._line)
        self._fetch_file = ""
        self.fetch_with = fetch.download          # tests put a stand-in here: nothing is asked of the internet
        # 0.5.0
        self._loaded = False
        self._character_cache = {}                # mod.json -> (its time, whether it adds a character)
        self._download = {}                       # the updater's last download line, read
        self._quiet_since = time.time()           # when the running job last printed a line
        self._result_help = ""                    # the plain words for a stopped job (extras.plain_error)
        self._cancelled = False
        self._health, self._health_running = [], False
        self._stats = {}
        self._players_now = -2                    # -2: not asked yet, -1: not known
        self._available = []                      # what the last quiet check found newer on the channel
        self._check_proc = None
        self._check_stamp = ""                    # when the last quiet check ran (HH:MM)
        self._check_ok = None                     # it reached the update server
        self._told = ""                           # the updates the pop-up last told about
        self._test_file = ""                      # testauto.txt written for a launch into a test
        self._test_started = 0.0
        self._test_timer = QTimer(self)
        self._test_timer.timeout.connect(self._test_tick)
        self._job_kind = ""                       # "install", "fetch", "report", "check" or "" (what CANCEL may stop)
        self.reopen_pending = False               # set when the window's files changed under it; run_gui.py starts it again
        self._touched_game = False
        self._undoing = False
        self._last_report = ""
        self._repo_cache = None
        self._actor_cache = {}
        self._game_running = False
        self._save_root_set = str(saved.get("saveRoot") or "")    # Proton / Bottles: the game's save area, by hand
        self._worked.connect(self._work_done)
        self._checked.connect(self._health_done)
        self._counted.connect(self._stats_done)
        self._players.connect(self._players_done)
        self._keyed.connect(self._key_done)
        self._sent.connect(self._sent_done)
        self._checker = QTimer(self)              # the quiet update check (improvement 2)
        self._checker.timeout.connect(self.quietCheck)
        self._set_check_timer()
        # defer (the window, run_gui.py): the window shows first and the mods come in behind it. Everything else
        # (tests, recordings) reads the folders here
        if defer and not demo: QTimer.singleShot(0, self._first_load)
        else: self._first_load()

    # ---- what the folders say -------------------------------------------------------------------------------
    def _p(self, *parts):
        return os.path.join(self.launcher, *parts)

    def _data(self, *parts):
        return os.path.join(self.data_dir or "", *parts)

    def _work(self, *parts):
        """a folder or file the loader makes while it works (the game link, the data it read, save backups): under
        `temp` when the loader keeps it there, else beside the loader"""
        inside = self._p("temp", *parts)
        return inside if os.path.exists(inside) else self._p(*parts)

    # ---- which game: the Steam game, or a copy of it with its own mods and saves (the loader's tools\gamecopy.py)
    def _copy_dir(self, copy_id=None):
        copy_id = self._copy if copy_id is None else copy_id
        return self._p("copies", copy_id) if copy_id else ""

    def _copy_info(self, copy_id=None):
        folder = self._copy_dir(copy_id)
        info = _read_json(os.path.join(folder, "copy.json"), None) if folder else None
        return info if isinstance(info, dict) and "exe" in info else None

    def _home(self, *parts):
        """a file that belongs to the game being set up: the copy's own, or the loader's for the Steam game"""
        return os.path.join(self._copy_dir(), *parts) if self._copy else self._p("mods", *parts)

    def _mod_file(self):
        info = self._copy_info()
        data = os.path.join(self._copy_dir(), "game", info["data"]) if info else os.path.join(self._work("game"), "BlazblueEntropyEffect_Data")
        return os.path.join(data, "StreamingAssets", "ab", "m_mod.m")

    def _save_settings(self):
        if not self.data_dir or self.demo: return
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            with open(self._data("settings.json"), "w", encoding="utf-8") as f: json.dump(dict(self._settings, gameCopy=self._copy, saveRoot=self._save_root_set), f, indent=1)
        except OSError:
            pass

    # ---- the shared mods: they go in with any mod; one that says it is optional (the intro) can be switched off
    def _off(self):
        if self.demo and self._demo_off is not None: return list(self._demo_off)
        return [str(m) for m in _read_json(self._home("profile.json"), {}).get("off", [])]

    def _optional(self, mod_id):
        return _read_json(self._p("shared", mod_id, "mod.json"), {}).get("optional") is True

    def _core_on(self):
        off = set(self._off())
        return [m for m in _read_json(self._p("shared", "profile.json"), {}).get("enabled", []) if not (m in off and self._optional(m))]

    # ---- a mod's own settings (mod.json "settings"; the loader's tools\modsettings.py lays the chosen option in)
    def _chosen(self):
        if self.demo and self._demo_chosen is not None: return self._demo_chosen
        found = _read_json(self._home("profile.json"), {}).get("settings", {})
        return found if isinstance(found, dict) else {}

    @staticmethod
    def _declared(meta, mine):
        """a mod's settings as the window shows them, each with the value in use. Nothing when one of them is
        written wrongly: the loader leaves all of that mod's settings out then, and so does the window."""
        listed, out, seen = meta.get("settings"), [], set()
        if not isinstance(listed, list): return []
        if not isinstance(mine, dict): mine = {}
        for s in listed:
            options = s.get("options") if isinstance(s, dict) else None
            if not isinstance(s.get("id") if isinstance(s, dict) else None, str) or not s["id"] or s["id"] in seen: return []
            if not isinstance(options, list) or not 2 <= len(options) <= 4: return []
            if any(not isinstance(o, dict) or "value" not in o or isinstance(o["value"], (dict, list)) for o in options): return []
            values = [o["value"] for o in options]
            if len({json.dumps(v) for v in values}) != len(values) or ("default" in s and s["default"] not in values): return []
            seen.add(s["id"])
            default = s.get("default", values[0])
            want = mine.get(s["id"], default)
            out.append({"id": s["id"], "name": str(s.get("name") or s["id"]), "about": str(s.get("about") or ""),
                        "options": [{"value": o["value"], "label": str(o.get("label") or o["value"]).upper()[:12]} for o in options],
                        "value": want if want in values else default, "default": default})
        return out

    def _game_build(self):
        game = self._work("game")
        if not os.path.exists(os.path.join(game, EXE)): return ""
        manifest = os.path.join(os.path.realpath(game), "..", "..", "appmanifest_%s.acf" % APPID)
        try:
            with open(manifest, encoding="utf-8", errors="replace") as f:
                for line in f:
                    if '"buildid"' in line: return line.split('"')[3]
        except OSError:
            pass
        return "?"

    def _enabled(self):
        if self.demo and self._demo_enabled is not None: return list(self._demo_enabled)
        return list(_read_json(self._home("profile.json"), {}).get("enabled", []))

    def _write_enabled(self, enabled):
        if self.demo:                             # a recording switches mods on screen only: no file is written
            self._demo_enabled = list(enabled)
            return
        path = self._home("profile.json")
        profile = _read_json(path, {"enabled": []})
        profile["enabled"] = list(enabled)
        with open(path, "w", encoding="utf-8") as f: json.dump(profile, f, indent=1)

    def _read_mods(self, build):
        enabled = set(self._enabled())
        core_on = set(self._core_on())
        chosen = self._chosen() if self.settingsAvailable else None
        out, present = [], set()
        for folder, core in (("mods", False), ("shared", True)):
            base = self._p(folder)
            for name in sorted(os.listdir(base)) if os.path.isdir(base) else []:
                meta = _read_json(os.path.join(base, name, "mod.json"), None)
                card = None if core else _read_json(os.path.join(base, name, "terminal.json"), None)
                if not isinstance(card, dict): card = {}
                built = isinstance(meta, dict) and "id" in meta
                if not built:                     # made on this PC by its `prepare` scripts: listed from its card
                    if "id" not in card: continue
                    meta = card
                mod_id, known = str(meta["id"]), self._known.get(str(meta["id"]), {})
                full = str(meta.get("name") or mod_id)
                m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", full)
                title, note = (m.group(1), m.group(2)) if m else (full, "")
                builds = [str(b) for b in meta.get("gameBuilds") or ["*"]]
                arts = self._arts(os.path.join(base, name), known.get("art"))
                adds_character = mod_id.startswith("char-") or self._adds_character_cached(os.path.join(base, name, "mod.json"))
                present.add(mod_id)
                out.append({
                    "id": mod_id, "title": str(known.get("title") or title), "note": str(known.get("note") or note),
                    "version": str(meta.get("version", "")), "author": str(meta.get("author", "")),
                    "about": str(known.get("about") or player_text(meta.get("description"))),
                    "credit": str(known.get("credit", "")), "accent": str(known.get("accent", "")),
                    "kind": "CORE" if core else "CHARACTER" if adds_character else "MOD", "locked": core,
                    # a set of mods that belong together (Redux) and the part of it this mod is: the Library lists a
                    # set under its own name with one switch for all of it. A core file is never part of one
                    "set": "" if core else str(card.get("set") or meta.get("set") or known.get("set") or ""),
                    "part": "" if core else str(card.get("part") or meta.get("part") or known.get("part") or ""),
                    "enabled": mod_id in (core_on if core else enabled), "installed": mod_id in self._installed,
                    "compatible": not build or build == "?" or "*" in builds or build in builds,
                    "checkedOn": builds[-1] if builds else "", "needs": [str(d) for d in meta.get("dependencies") or []],
                    "art": arts[0]["src"] if arts else "", "arts": arts, "folder": os.path.join(base, name),
                    "prepare": [str(p) for p in card.get("prepare") or []], "built": built,
                    "settings": [] if core or chosen is None or not built else self._declared(meta, chosen.get(mod_id)),
                    "monogram": (str(known.get("title") or title).strip()[:1] or "?").upper(),
                })
                folder_now = os.path.join(base, name)
                out[-1].update(self._mod_extras(mod_id, folder_now, core))
        for mod in out: mod["missing"] = [d for d in mod["needs"] if d not in present]
        titles = {m["id"]: m["title"] for m in out}
        for mod in out:                           # what stops when this one is switched off (improvement 19)
            mod["neededBy"] = [titles[o["id"]] for o in out if o["enabled"] and not o["locked"] and mod["id"] in o["needs"]]
            mod["neededByIds"] = [o["id"] for o in out if o["enabled"] and not o["locked"] and mod["id"] in o["needs"]]
            mod["needTitles"] = [titles.get(d, d) for d in mod["needs"]]
        order = {"CHARACTER": 0, "MOD": 1, "CORE": 2}
        # sets first, each under its own name, then the rest by kind
        out.sort(key=lambda mod: (0 if mod["set"] else 1, mod["set"].lower(), order[mod["kind"]], mod["title"].lower()))
        return out

    # ---- a mod's pictures -----------------------------------------------------------------------------------
    @staticmethod
    def _pictures(folder):
        """a mod's own pictures when it has no single portrait: up to three from art/ or pack/art/ whose names say
        artwork or portrait, in name order (the first is shown in front)"""
        found = []
        for sub in ("art", os.path.join("pack", "art")):
            d = os.path.join(folder, sub)
            for n in sorted(os.listdir(d)) if os.path.isdir(d) else []:
                if n.lower().endswith(".png") and ("artwork" in n.lower() or "portrait" in n.lower()):
                    found.append(os.path.join(d, n))
        return found[:3]

    def _measure(self, path):
        """(width, height, left, top, right, bottom): the picture's size and the box its figure fills, as shares of
        the picture. Read once per file from a small copy of its transparency."""
        try: key = (path, os.path.getmtime(path))
        except OSError: return None
        if key not in self._measured:
            image = QImage(path)
            w, h, box = image.width(), image.height(), (0.0, 0.0, 1.0, 1.0)
            if w and h and image.hasAlphaChannel():
                small = image.scaled(96, 96).convertToFormat(QImage.Format.Format_Alpha8)
                line, bits = small.bytesPerLine(), bytes(small.constBits())
                rows = [y for y in range(96) if any(v > 8 for v in bits[y * line:y * line + 96])]
                cols = [x for x in range(96) if any(bits[y * line + x] > 8 for y in range(96))]
                if rows and cols:
                    box = (cols[0] / 96, rows[0] / 96, (cols[-1] + 1) / 96, (rows[-1] + 1) / 96)
            self._measured[key] = (w, h) + box if w and h else None
        return self._measured[key]

    def _arts(self, folder, listed):
        """The pictures the window shows for a mod, each with where it stands. `listed` is the mod's entry in
        known_mods.json when it has one: [{"file", "focus": [x, y], "tall", "dx", "dy", "z", "dim"}]; without one the
        mod's own portrait is found (or up to three artworks) and placed by rule.
          tall     the figure's height as a share of the window's
          fx, fy   where the face is, as shares of the picture (the small cards are cut around it)
          card     the figure's height on a small card, in pixels (500: head and shoulders)
          stand    false: one figure, its face (ax, ay) put dx, dy window heights from the stage's focus point;
                   true: one of a party, the foot of its box (ax, ay) put dx window heights beside the focus
                   point and dy window heights above the stage's ground line"""
        if listed:
            files = [(os.path.join(folder, *str(entry.get("file", "")).split("/")), entry) for entry in listed]
        else:
            one = next((os.path.join(folder, *rel.split("/")) for rel in ART_DETAIL
                        if os.path.isfile(os.path.join(folder, *rel.split("/")))), "")
            files = [(path, {}) for path in ([one] if one else self._pictures(folder))]
        files = [(path, entry, self._measure(path)) for path, entry in files if os.path.isfile(path)]
        files = [f for f in files if f[2]]
        party = len(files) > 1
        slots = [(0.0, 0.0, 0.60, 3, 1.0), (-0.27, 0.04, 0.50, 1, 0.9), (0.24, 0.012, 0.70, 2, 0.94)]
        out = []
        for i, (path, entry, (w, h, l, t, r, b)) in enumerate(files):
            shape = ((r - l) * w) / max(1.0, (b - t) * h)
            fx, fy = entry.get("focus") or ((l + r) / 2, t + 0.2 * (b - t))
            dx, dy, tall, z, dim = slots[min(i, 2)] if party else (0.0, 0.0, 1.34 if shape < 0.62 else 1.12 if shape < 0.9 else 1.0, 1, 1.0)
            ax, ay = ((l + r) / 2, b) if party else (fx, fy)
            out.append({"src": QUrl.fromLocalFile(path).toString(), "w": w, "h": h, "l": l, "t": t, "r": r, "b": b,
                        "fx": float(fx), "fy": float(fy), "ax": float(entry.get("ax", ax)), "ay": float(entry.get("ay", ay)),
                        "tall": float(entry.get("tall", tall)), "dx": float(entry.get("dx", dx)),
                        "dy": float(entry.get("dy", dy)), "z": int(entry.get("z", z)), "dim": float(entry.get("dim", dim)),
                        "stand": party, "card": float(entry.get("card", 500))})
        return out

    def _adds_character_cached(self, mod_json):
        """_adds_character, read again only when the file changed (a large mod.json is slow to search)"""
        try: stamp = os.path.getmtime(mod_json)
        except OSError: return False
        had = self._character_cache.get(mod_json)
        if had and had[0] == stamp: return had[1]
        found = self._adds_character(mod_json)
        self._character_cache[mod_json] = (stamp, found)
        return found

    @staticmethod
    def _adds_character(mod_json):
        """a mod whose data names a new playable character (the ids added characters use start at 190000)"""
        try:
            with open(mod_json, encoding="utf-8") as f: text = f.read()
        except OSError:
            return False
        return any(int(n) >= 190000 for n in re.findall(r'"ActorId":\s*(\d{6})', text))

    @Slot()
    def refresh(self):
        build = self._game_build()
        if self._copy and not self._copy_info(): self._copy = ""; self._save_settings()     # the copy is gone
        mark = ""
        try:
            with open(self._work("inspect", "game_build.txt"), encoding="utf-8") as f: mark = f.read().strip()
        except OSError:
            pass
        done = _read_json(self._home("installed.json"), None)
        has_mod_file = os.path.exists(self._mod_file())
        if self.demo:                             # a recording reads the folders once and keeps that picture
            if self._demo_disk is None: self._demo_disk = (build, mark, done, has_mod_file)
            build, mark, done, has_mod_file = self._demo_disk
        self._recorded = bool(done and done.get("enabled"))
        in_game = bool(done and has_mod_file and build)
        self._installed = set(done.get("enabled", [])) if in_game else set()
        self._installed_at = str(done.get("installed", "")) if in_game else ""
        if not build: state = "no-game"
        elif mark != build: state = "setup"
        elif self._copy and str(self._copy_info().get("build")) != build: state = "behind"   # the game was updated since
        elif not in_game: state = "ready"
        else:
            want = set(self._enabled()) | set(self._core_on())
            state = "installed" if self._installed == want else "changes"
        self._build, self._mods = build, self._read_mods(build)
        # a newer copy of a mod that is in the game (the loader records the versions it installed; an older loader
        # recorded none, and then nothing is said)
        went_in = done.get("versions") if in_game and isinstance(done.get("versions"), dict) else {}
        for mod in self._mods:
            mod["installedVersion"] = str(went_in.get(mod["id"], "")) if mod["installed"] else ""
            mod["newer"] = bool(mod["installedVersion"]) and mod["installedVersion"] != mod["version"]
        if state == "installed" and any(mod["newer"] for mod in self._mods): state = "changes"
        went = _read_json(self._home("installed_settings.json"), {}) if in_game else {}
        for mod in self._mods:
            now = {s["id"]: s["value"] for s in mod["settings"]}
            before = went.get(mod["id"]) if isinstance(went, dict) and isinstance(went.get(mod["id"]), dict) else {s["id"]: s["default"] for s in mod["settings"]}
            for s in mod["settings"]: s["waiting"] = bool(mod["installed"] and mod["enabled"] and s["value"] != before.get(s["id"], s["default"]))
            mod["settingsWaiting"] = any(s["waiting"] for s in mod["settings"])
        if state == "installed" and any(mod["settingsWaiting"] for mod in self._mods): state = "changes"
        self._state = state
        self.changed.emit()

    def _mod(self, mod_id):
        return next((mod for mod in self._mods if mod["id"] == mod_id), None)

    def _wanted(self):
        """the mods a person switched on (core files are not counted: they go in with any mod)"""
        return [mod for mod in self._mods if mod["enabled"] and not mod["locked"]]

    @Property("QVariantList", notify=changed)
    def mods(self): return self._mods

    @Property(str, notify=changed)
    def state(self): return self._state

    @Property(str, notify=changed)
    def gameBuild(self): return self._build

    @Property(str, notify=changed)
    def gamePath(self):
        game = self._p("game")
        return os.path.realpath(game) if os.path.exists(os.path.join(game, EXE)) else ""

    @Property(str, notify=changed)
    def installedAt(self): return self._installed_at

    @Property(int, notify=changed)
    def backups(self):
        folder = os.path.join(self._copy_dir(), "save_backups") if self._copy else self._p("save_backups")
        return len([n for n in os.listdir(folder) if os.path.isdir(os.path.join(folder, n))]) if os.path.isdir(folder) else 0

    @Property(str, notify=changed)
    def stateText(self):
        on = len(self._wanted())
        # whole lines for one and for many, so a translation can make the words agree with the number
        text = {"no-game": "The game has not been found yet", "setup": "The game's data has to be read first",
                "behind": "The game was updated after this copy was made",
                "ready": ("1 mod ready to install" if on == 1 else "%d mods ready to install" % on) if on else "Nothing switched on",
                "changes": "A newer version is waiting" if self._only_newer() else "Changes not applied yet",
                "installed": "1 mod installed" if on == 1 else "%d mods installed" % on}[self._state]
        return "%s: %s" % (self.copyName, text[:1].lower() + text[1:]) if self._copy else text

    def _only_newer(self):
        """nothing was switched: the game holds what is switched on, and a mod in it has a newer copy in the Library"""
        want = {mod["id"] for mod in self._mods if mod["enabled"]}
        return self._installed == want and any(mod["newer"] for mod in self._mods)

    @Property(str, notify=changed)
    def actionLabel(self):
        if self._plays_plain(): return "PLAY"
        return {"no-game": "SET UP AND INSTALL", "setup": "SET UP AND INSTALL", "ready": "INSTALL", "behind": "UPDATE COPY",
                "changes": "APPLY CHANGES", "installed": "PLAY"}[self._state]

    def _plays_plain(self):
        """nothing is in the game and nothing is switched on: the big button starts the game as it is"""
        return self._state == "ready" and not self._wanted()

    @Property(bool, notify=changed)
    def canAct(self):
        """the big button has something to do: install, apply, or start the game"""
        return self._state in ("changes", "installed", "ready", "behind") or bool(self._wanted())

    @Property(str, notify=changed)
    def playLabel(self):
        """the second button beside INSTALL or APPLY CHANGES: start the game as it stands now. Empty when the big
        button already plays, when the game is not found, and when a game update left mods recorded as installed
        (their characters are still in the save, and the game without them calls that save damaged)."""
        if self._state == "changes": return "PLAY AS INSTALLED"
        if self.plainWanted: return "PLAY WITHOUT MODS"
        if self._state == "ready" and self._wanted(): return "PLAY WITHOUT MODS"
        if self._state == "setup" and not self._recorded: return "PLAY WITHOUT MODS"
        return ""

    # ---- the window's own settings, links and facts -----------------------------------------------------------
    @Property("QVariantMap", notify=settingsChanged)
    def settings(self):
        out = dict(self._settings, intro=self.introOn)
        for mod in self._mods:                    # a mod's own settings, under "mod:<its id>:<the setting>"
            for s in mod["settings"]: out["mod:%s:%s" % (mod["id"], s["id"])] = s["value"]
        return out

    @Slot(str, "QVariant")
    def setSetting(self, key, value):
        if key == "intro": self._set_intro(bool(value)); return
        if key.startswith("mod:"): self._set_mod_setting(*key.split(":", 2)[1:], value); return
        if key not in SETTINGS or value not in SETTINGS[key] or self._settings.get(key) == value: return
        self._settings[key] = value
        self._save_settings()
        if key == "checkEvery": self._set_check_timer()
        self.settingsChanged.emit()

    @Property(bool, constant=True)
    def settingsAvailable(self):
        """the loader beside this window builds a mod with the options its player chose (an older one does not, and
        the rows are left out: a choice that changes nothing is not offered)"""
        return os.path.isfile(self._p(*SETTINGS_TOOL.split("/")))

    def _set_mod_setting(self, mod_id, setting, value):
        """kept in the list of the game being set up, beside its switched-on mods; it goes in with the next install"""
        mod = self._mod(mod_id)
        one = next((s for s in mod["settings"] if s["id"] == setting), None) if mod else None
        if self._busy or not one or value not in [o["value"] for o in one["options"]] or value == one["value"]: return
        chosen = json.loads(json.dumps(self._chosen()))
        chosen.setdefault(mod_id, {})[setting] = value
        self._write_chosen(chosen)
        self.refresh(); self.settingsChanged.emit()

    def _write_chosen(self, chosen):
        if self.demo: self._demo_chosen = chosen; return
        path = self._home("profile.json")
        profile = _read_json(path, {"enabled": []})
        profile["settings"] = chosen
        with open(path, "w", encoding="utf-8") as f: json.dump(profile, f, indent=1)

    INTRO = "zenith-intro"

    @Property(bool, constant=True)
    def introAvailable(self):
        """the loader carries the Sector Zenith intro and lets it be switched off"""
        return self._optional(self.INTRO) and self.INTRO in _read_json(self._p("shared", "profile.json"), {}).get("enabled", [])

    @Property(bool, notify=settingsChanged)
    def introOn(self): return self.INTRO not in self._off()

    def _set_intro(self, on):
        """kept in the list of the game being set up (the Steam game's, or a copy's own); it takes effect with the
        next install, so the state turns to changes when mods are in the game"""
        if on == self.introOn or self._busy: return
        off = [m for m in self._off() if m != self.INTRO] + ([] if on else [self.INTRO])
        if self.demo: self._demo_off = off
        else:
            path = self._home("profile.json")
            profile = _read_json(path, {"enabled": []})
            profile["off"] = off
            if not off: profile.pop("off")
            with open(path, "w", encoding="utf-8") as f: json.dump(profile, f, indent=1)
        self.refresh(); self.settingsChanged.emit()

    @Property("QVariantList", constant=True)
    def supporters(self): return list(self._links.get("support", []))

    @Property(str, constant=True)
    def version(self): return VERSION

    @Slot(str)
    def openLink(self, url):
        """opens one of the Terminal's own links in the person's browser (no other address is ever opened)"""
        if url not in [str(entry.get("url")) for entry in self.supporters]: return
        if self.demo: self.said.emit("Preview: the link is not opened from a recording."); return
        QDesktopServices.openUrl(QUrl(url))

    @Slot(str)
    def copyLink(self, url):
        app = QGuiApplication.instance()
        if isinstance(app, QGuiApplication) and not self.demo: app.clipboard().setText(url)
        self.said.emit("Link copied.")

    # ---- the running job ------------------------------------------------------------------------------------
    @Property(bool, notify=busyChanged)
    def busy(self): return self._busy

    @Property(bool, notify=busyChanged)
    def running(self): return self._running

    @Property(str, notify=busyChanged)
    def title(self): return self._title

    @Property("QVariantList", notify=busyChanged)
    def steps(self): return self._steps

    @Property(int, notify=busyChanged)
    def step(self): return self._step

    @Property(str, notify=busyChanged)
    def result(self): return self._result

    @Property(str, notify=busyChanged)
    def resultText(self): return self._result_text

    @Property(str, notify=busyChanged)
    def resultAction(self):
        """what the finished job offers next: "play", "folder" (open what it made) or nothing"""
        return self._after if self._result == "ok" else ""

    @Property("QVariantList", notify=logChanged)
    def logTail(self):
        return [line for line in self._log if not _OTHER_GAME.search(line)][-7:]

    def _begin(self, title, steps, marks, done="", after=""):
        self._busy = self._running = True
        self._title, self._steps, self._step, self._marks = title, list(steps), 0, marks
        self._log, self._result, self._result_text, self._problem = [], "", "", []
        self._done_text, self._after, self._problem_open = done, after, False
        self._download, self._result_help, self._cancelled = {}, "", False
        self._quiet_since, self._touched_game, self._job_kind = time.time(), False, ""
        self._pause_file(False)
        try: os.remove(self._terminal("Updater", "_work", "stop"))
        except OSError: pass
        self.busyChanged.emit(); self.logChanged.emit()

    def _line(self, text):
        text = text.rstrip()
        if not text:
            self._problem_open = False
            return
        self._quiet_since = time.time()
        got = _DOWNLOADED.search(text)
        if got:                                   # the updater's download, file by file (Updater 1.3.0)
            done, total, mb, speed, left = got.groups()
            self._download = {"done": int(done), "total": int(total), "mb": float(mb), "speed": float(speed), "left": left,
                              "paused": self._download.get("paused", False)}
            self.busyChanged.emit()
            if self._log and _DOWNLOADED.search(self._log[-1]): self._log[-1] = text; self.logChanged.emit(); return
        elif text.strip() in ("[*] Paused", "[*] Resumed"):
            self._download = dict(self._download, paused=text.strip() == "[*] Paused"); self.busyChanged.emit()
        self._log.append(text)
        del self._log[:-600]
        if text.startswith(PROBLEM) or self._problem_open:
            self._problem_open = True
            self._problem.append(text.replace("PROBLEM: ", ""))
        made = _MADE.match(text)
        if made: self._made_copy = made.group(1)
        for mark, step in self._marks:
            if mark in text:
                if step > self._step: self._step = step; self.busyChanged.emit()
                break
        self.logChanged.emit()

    def _finish(self, ok, text=""):
        self._running, self._result = False, "ok" if ok else "error"
        if ok: self._step = len(self._steps)
        if ok and self._made_copy and (self._copy_info(self._made_copy) or {}).get("name") != PLAIN_NAME:
            self._copy = self._made_copy; self._save_settings()                           # a new copy is the one in use
        self._made_copy = ""
        if self.reopen_pending and not self.demo: text = (text + "\n" if text else "") + "The window opens again on its new version in a moment."
        self._result_text = text
        self._result_help = "" if ok else extras.plain_error(text + "\n" + "\n".join(self._log[-12:]))
        self._pause_file(False)
        if ok: self._after_job()
        if self.data_dir and not self.demo:
            try:
                os.makedirs(self.data_dir, exist_ok=True)
                with open(self._data("last_run.log"), "w", encoding="utf-8") as f:
                    f.write("%s  %s  %s\n\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), self._title, self._result))
                    f.write("\n".join(self._log) + "\n")
            except OSError:
                pass
        self.refresh(); self.busyChanged.emit()
        if self.reopen_pending and not self.demo:        # the result is read for a moment, then the new window opens
            QTimer.singleShot(2500, self.reopenWanted.emit)

    def _python(self):
        bundled = os.path.join(self.launcher, "..", "Interpreter", "pythoncore-3.14-64", "python.exe")
        if os.path.exists(bundled): return os.path.abspath(bundled)
        exe = sys.executable
        console = os.path.join(os.path.dirname(exe), "python.exe")
        return console if os.path.basename(exe).lower() == "pythonw.exe" and os.path.exists(console) else exe

    def _next(self):
        if not self._queue:
            self._finish(True, self._done_text)
            return
        if self._queue[0][0] == "@call":          # a step done here, on a thread of its own (0.5.0)
            _, name, work = self._queue.pop(0)
            self._line(name + "...")

            def run():
                try:
                    said = work() or ""
                    self._worked.emit(name, True, str(said))
                except Exception as error:        # a thread always answers, or the panel never closes
                    self._worked.emit(name, False, "%s: %s" % (type(error).__name__, error))

            threading.Thread(target=run, daemon=True).start()
            return
        proc = QProcess(self)
        item = self._queue.pop(0)
        if item[0] in ("install", "uninstall"): self._touched_game = True     # the shared install record is written after
        env = QProcessEnvironment.systemEnvironment()
        env.insert("PYTHONIOENCODING", "utf-8"); env.insert("PYTHONUNBUFFERED", "1")
        if self.profile_root: env.insert("USERPROFILE", self.profile_root)
        if self._save_root_set: env.insert("ZENITH_SAVE_ROOT", self._save_root_set)
        if os.name != "nt": env.insert("HOME", self.profile_root or os.path.expanduser("~"))
        # the loader works on the chosen copy; reading the game's data is always the Steam game's
        if self._copy and item[0] not in ("setup", "@tool"): env.insert("BBMOD_TARGET", self._copy_dir())
        else: env.remove("BBMOD_TARGET")
        proc.setProcessEnvironment(env)
        proc.setWorkingDirectory(self.launcher)
        proc.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        proc.readyReadStandardOutput.connect(lambda: [self._line(l) for l in
                                                      bytes(proc.readAllStandardOutput()).decode("utf-8", "replace").splitlines()])
        proc.finished.connect(self._ended)
        proc.errorOccurred.connect(lambda error: self._finish(False, "The loader could not be started (%s)." % error.name)
                                   if error == QProcess.ProcessError.FailedToStart else None)
        self._proc = proc
        if item[0] in ("@updater", "@updaterplain"):   # the Terminal's updater (Updater\main.py beside Launcher\)
            self._updater_running = item[0] == "@updater"
            proc.setProperty("updater", True)
            proc.setWorkingDirectory(self._terminal("Updater"))
            proc.start(self._python(), ["-u", self._terminal("Updater", "main.py")] + list(item[1:]))
        elif item[0] == "@tool":                  # one of the loader's own tools, by its path under the loader
            proc.start(self._python(), ["-u", os.path.join(self.launcher, *item[1].split("/"))] + item[2:])
        elif item[0] == "@prepare":                 # a mod's own script, from the loader's folder (terminal.json)
            self._line("Preparing %s..." % item[1])
            if self._prep_step > self._step: self._step = self._prep_step; self.busyChanged.emit()
            proc.start(self._python(), ["-u", os.path.join(self.launcher, *item[2].split("/"))])
        else:
            proc.start(self._python(), ["-u", "entry_point.py"] + item)

    @Slot(str, bool, str)
    def _work_done(self, name, ok, said):
        if not self._running or self._cancelled: return
        for line in said.splitlines(): self._line(line)
        if ok: self._next()
        else:
            self._queue = []
            self._finish(False, said or "%s did not finish." % name)

    def _ended(self, code, _status):
        if not self._running: return
        if self._cancelled:                       # stopped by the person (CANCEL)
            self._updater_running = False
            self._queue = []
            self._finish(False, self._cancel_text())
            return
        if self._updater_running:
            self._updater_running = False
            self._updater_ended(code)
            return
        if code != 0:
            self._queue = []
            said = "\n".join(self._problem) or "\n".join(self._log[-3:])
            # the loader's "stopped with an error (see above)" says nothing on this panel: put what is above first
            if not self._problem or "see above" in said:
                cause = stop_cause(self._log)
                if cause and cause not in said: said = cause + "\n" + said
            self._finish(False, said)
        else:
            self._next()

    def _run(self, title, steps, marks, queue, done, after=""):
        if self._busy or self.demo: return
        self._begin(title, steps, marks, done, after)
        self._queue = list(queue)
        self._next()

    def _install_job(self, title, done, after="play", steps=REBUILD_STEPS, marks=REBUILD_MARKS):
        """build and install what is switched on; the game's data is read first when that has not been done for
        this build of the game"""
        if self._busy or self.demo: return
        first = self._state in ("no-game", "setup")
        steps, marks = (INSTALL_STEPS, INSTALL_MARKS) if first else (steps, marks)
        self._remember_install_before()
        prepare = [["@prepare", mod["title"], script] for mod in self._wanted() if self._needs_prepare(mod, first)
                   for script in mod["prepare"]]
        if prepare:                               # its own step, after the game's data is read and before the save
            at = 2 if first else 0
            steps = list(steps[:at]) + [PREPARE_STEP] + list(steps[at:])
            marks = [(mark, step + 1 if step >= at else step) for mark, step in marks]
            self._prep_step = at
        self._run(title, steps, marks, ([["setup"]] if first else []) + prepare + [["install"]], done, after)
        self._job_kind = "install"

    def _needs_prepare(self, mod, first):
        """a mod with `prepare` scripts is made again when it was never made, when the game's data is about to be
        read again, or when one of its own files or that data is newer than what was made"""
        if not mod.get("prepare"): return False
        made = os.path.join(mod["folder"], "mod.json")
        if first or not os.path.isfile(made): return True
        stamp = os.path.getmtime(made)
        newer = [self._work("inspect", "game_build.txt")]
        for name in os.listdir(mod["folder"]):
            if name.endswith((".py", ".json")) and name != "mod.json": newer.append(os.path.join(mod["folder"], name))
        return any(os.path.isfile(p) and os.path.getmtime(p) > stamp for p in newer)

    # ---- after the updater: the Terminal folder's Updater\ ran before this window (ZenithUpdater.exe) -------------
    def _terminal(self, *parts):
        """the Terminal folder this window is part of (beside Launcher\\, Gui\\, Updater\\, package\\)"""
        return os.path.join(os.path.dirname(self.launcher), *parts)

    @Property(str, constant=True)
    def edition(self):
        """"dev" for The Zenith Terminal Dev (package\\EDITION.txt, make_release.py --edition dev), else "" """
        try:
            with open(self._terminal("package", "EDITION.txt"), encoding="utf-8") as f: return f.read().strip().lower()
        except OSError: return ""

    @Slot(result=bool)
    def applyArrivedUpdates(self):
        """Called once when the window opens. When the updater has just brought newer files of mods that are in the
        game, nothing else was switched, and the game is closed, they go in at once (the same job as APPLY CHANGES).
        Each updater run is acted on once (Updater\\last_run.json, its start time). -> True when the job started"""
        if self._busy or self.demo or self._copy or self._settings.get("applyUpdates") is False: return False
        run = _read_json(self._terminal("Updater", "last_run.json"), None)
        if not isinstance(run, dict) or run.get("check_only"): return False
        brought = [name for name, entry in (run.get("components") or {}).items()
                   if isinstance(entry, dict) and entry.get("status") in ("updated", "installed")]
        stamp = str(run.get("started") or "")
        seen = self._data("update_seen.txt") if self.data_dir else ""
        if not brought or not stamp or not seen: return False
        try:
            with open(seen, encoding="utf-8") as f:
                if f.read().strip() == stamp: return False
        except OSError: pass
        os.makedirs(os.path.dirname(seen), exist_ok=True)
        with open(seen, "w", encoding="utf-8") as f: f.write(stamp)
        self._note_arrivals(run)
        new = self._switch_on_arrivals(run)
        if not self._can_apply_updates(new): return False
        self._install_job("APPLYING UPDATES", COPY_PLAY_TEXT if self._copy else PLAY_TEXT)
        return True

    def _switch_on_arrivals(self, run):
        """Mods the updater installed new (a mod new on the channel, or one an installed mod needs) are switched on,
        as the mods the Terminal came with are. Called once per updater run. -> their ids"""
        new = [name for name, entry in (run.get("components") or {}).items()
               if isinstance(entry, dict) and entry.get("status") == "installed"
               and os.path.isfile(self._p("mods", name, "mod.json"))]
        enabled = self._enabled()
        add = [name for name in new if name not in enabled]
        if add:
            self._write_enabled(enabled + add)
            self.refresh()
        return new

    def _can_apply_updates(self, new=()):
        """only what the updater brought is waiting (newer copies of mods in the game, mods it just installed), the
        game is closed, and Options allow it"""
        return (self._settings.get("applyUpdates") is not False and self._state == "changes" and self._only_arrived(new)
                and not self.otherInstall() and not _game_open())

    def _only_arrived(self, new=()):
        """nothing was switched by hand: the game holds what is switched on, apart from mods the updater just
        installed, and something newer or new is waiting"""
        want = {mod["id"] for mod in self._mods if mod["enabled"]}
        extra = want - self._installed
        return self._installed <= want and extra <= set(new) and (bool(extra) or any(mod["newer"] for mod in self._mods))

    @Property(bool, constant=True)
    def canUpdate(self):
        """this Terminal has its updater (Updater\\main.py beside Launcher\\)"""
        return os.path.isfile(self._terminal("Updater", "main.py"))

    @Slot()
    def checkUpdates(self):
        """Run the updater now (the same check the Terminal makes when it opens). When it brings newer builds of
        mods in the game and they can go in (_can_apply_updates), the same job goes on and puts them in."""
        if self._busy: return
        if not self.canUpdate: self.said.emit("This Terminal has no updater."); return
        if self.demo: self.said.emit("Preview: nothing is checked."); return
        self._run(UPDATE_TITLE, UPDATE_STEPS, UPDATE_MARKS, [["@updater"]], "")
        self._job_kind = "check"

    def _updater_ended(self, code):
        """the updater of a CHECK FOR UPDATES job is done: say what it found, and go on to put the updates in"""
        run = _read_json(self._terminal("Updater", "last_run.json"), {}) or {}
        if self.data_dir and run.get("started"):           # acted on here: not again when the window opens
            try:
                with open(self._data("update_seen.txt"), "w", encoding="utf-8") as f: f.write(str(run["started"]))
            except OSError: pass
        brought = [n for n, e in (run.get("components") or {}).items() if isinstance(e, dict) and e.get("status") in ("updated", "installed")]
        self._check_ok, self._check_stamp = code != 2, time.strftime("%H:%M")
        if code == 2: self._finish(False, "No connection: the check could not reach the update server. Nothing changed."); return
        self._note_arrivals(run)
        self._available = [a for a in self._available if a["id"] not in brought]
        self.statusChanged.emit()
        if "Gui" in brought and code in (0, 1): self.reopen_pending = True     # this window's own files are newer
        if code not in (0, 1):
            self._finish(False, "\n".join(self._log[-3:]) or "The updater stopped."); return
        self.refresh()
        new = self._switch_on_arrivals(run)
        if not brought:
            self._finish(code == 0, "Everything is up to date." if code == 0 else "Some updates could not be read:\n" + "\n".join(self._log[-3:]))
            return
        names = ", ".join(self._title_of(n) for n in brought)
        if not any(self._mod(n) for n in brought):          # the window or the loader only: nothing to put in the game
            self._finish(True, "Updated: %s." % names); return
        if self._can_apply_updates(new):
            self._done_text = "Updated and in your game: %s." % names
            self._queue = [["install"]]
            self._next()
            return
        why = ("the game is open: close it, then press APPLY CHANGES" if _game_open() else
               "press APPLY CHANGES to put them in your game" if self._state == "changes" else "they are in the Library")
        self._finish(True, "Downloaded: %s. %s." % (names, why[:1].upper() + why[1:]))

    def _title_of(self, mod_id):
        mod = self._mod(mod_id)
        return mod["title"] if mod else {"Gui": "the Terminal's window", "Launcher": "the mod loader"}.get(mod_id, mod_id)

    @Property("QVariantList", notify=changed)
    def whatsNew(self):
        """What the last updater run brought, for the Home page: [{id, title, from, to, notes}] until it is put
        away (whatsnew_seen.txt). notes: the first section of the mod's CHANGELOG.md, a few lines."""
        run = _read_json(self._terminal("Updater", "last_run.json"), None) if not self.demo else None
        if not isinstance(run, dict) or run.get("check_only"): return []
        stamp = str(run.get("started") or "")
        try:
            with open(self._data("whatsnew_seen.txt"), encoding="utf-8") as f:
                if f.read().strip() == stamp: return []
        except OSError: pass
        out = []
        for name, entry in (run.get("components") or {}).items():
            if not isinstance(entry, dict) or entry.get("status") not in ("updated", "installed"): continue
            mod = self._mod(name)
            out.append({"id": name, "title": self._title_of(name), "from": str(entry.get("local") or ""),
                        "to": str(entry.get("remote") or ""), "notes": _changelog_head(mod["folder"]) if mod else []})
        return out

    @Slot()
    def putAwayWhatsNew(self):
        run = _read_json(self._terminal("Updater", "last_run.json"), {}) or {}
        if self.data_dir and run.get("started") and not self.demo:
            try:
                os.makedirs(self.data_dir, exist_ok=True)
                with open(self._data("whatsnew_seen.txt"), "w", encoding="utf-8") as f: f.write(str(run["started"]))
            except OSError: pass
        self.changed.emit()

    @Slot()
    def primary(self):
        """the one big button: set up if needed and install, apply what was switched, or start the game"""
        if self._busy: return
        if self._state == "behind": self.updateCopy(); return
        if self._state == "installed" or self._plays_plain(): self.play(); return
        if self._state == "changes" and not self._wanted():        # everything was switched off: take it all out
            self.uninstall(); return
        if not self._wanted(): self.said.emit("Switch a mod on in the Library first."); return
        self._install_job("APPLYING CHANGES" if self._state == "changes" else "INSTALLING", COPY_PLAY_TEXT if self._copy else PLAY_TEXT)

    @Slot()
    def uninstall(self):
        if self._busy or self.demo: return
        self._remember_install_before()
        self._run("UNINSTALLING EVERY MOD", REMOVE_STEPS, REMOVE_MARKS, [["uninstall"]],
                  "Your game and your save are back to normal. Your mods stay in the Library.")
        self._job_kind = "install"

    @Slot(str)
    def uninstallMod(self, mod_id):
        """Take one mod out of the game. It is switched off, then the game is rebuilt with what is left (the loader
        backs the save up and takes the character out of it); with nothing left, everything is removed."""
        mod = self._mod(mod_id)
        if self._busy or self.demo or not mod or mod["locked"]: return
        self._write_enabled([i for i in self._enabled() if i != mod_id])
        self.refresh()
        title = "UNINSTALLING " + mod["title"].upper()
        if self._wanted():
            self._install_job(title, "%s is out of your game. Its files stay in the Library." % mod["title"], after="",
                              steps=TAKE_OUT_STEPS, marks=TAKE_OUT_MARKS)
        else:
            self._run(title, REMOVE_STEPS, REMOVE_MARKS, [["uninstall"]],
                      "%s is out of your game, and your save is ready for the normal game." % mod["title"])

    @Slot(str, result=str)
    def deleteMod(self, mod_id):
        """Move a mod's folder to the Recycle Bin. Only a mod that is not in the game: uninstall comes first."""
        mod = self._mod(mod_id)
        if self._busy or not mod or mod["locked"]: return ""
        if mod["installed"]: return "Uninstall %s first, then its files can go." % mod["title"]
        if self.demo: return "Preview: nothing is deleted."
        moved = QFile.moveToTrash(mod["folder"])
        if not (moved[0] if isinstance(moved, tuple) else moved):
            return "%s could not be moved to the Recycle Bin." % mod["title"]
        self._write_enabled([i for i in self._enabled() if i != mod_id])
        self._decline(mod_id)
        self._remember_deleted(mod_id, mod["version"], mod["title"])
        self.refresh()
        return "%s is in the Recycle Bin." % mod["title"]

    # ---- a mod the player deleted, back when the channel has a newer one: asked, never brought back unasked --------
    def _remember_deleted(self, mod_id, version, title=""):
        """deleted.json in the window's data: the version the player deleted, or last said no to (nextOffer)"""
        if not self.data_dir: return
        seen = _read_json(self._data("deleted.json"), {})
        if not isinstance(seen, dict): seen = {}
        entry = seen.get(mod_id) if isinstance(seen.get(mod_id), dict) else {}
        seen[mod_id] = {"version": str(version or ""), "title": str(title or entry.get("title") or "")}
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            with open(self._data("deleted.json"), "w", encoding="utf-8") as f: json.dump(seen, f, indent=1)
        except OSError: pass

    def _declined_ids(self):
        try:
            with open(self._terminal("Updater", "declined.txt"), encoding="utf-8") as f:
                return {line.strip() for line in f if line.strip() and not line.startswith("#")}
        except OSError:
            return set()

    @Slot(result="QVariantMap")
    def nextOffer(self):
        """A deleted mod the last updater run found newer on the channel than the version the player deleted (or
        last said no to; a deletion with no version noted counts as older): {id, title, version}, else {}. Each mod
        is asked about once a session."""
        if self.demo or self._busy or not self.data_dir: return {}
        run = _read_json(self._terminal("Updater", "last_run.json"), {}) or {}
        seen = _read_json(self._data("deleted.json"), {})
        if not isinstance(seen, dict): seen = {}
        declined = self._declined_ids()
        for name, entry in (run.get("components") or {}).items():
            if not isinstance(entry, dict) or entry.get("status") != "declined" or not entry.get("remote"): continue
            if name not in declined or name in self._offered: continue
            had = seen.get(name) if isinstance(seen.get(name), dict) else {}
            remote = str(entry["remote"])
            if had.get("version") and not _version_newer(remote, had["version"]): continue
            self._offered.add(name)
            title = had.get("title") or self._known.get(name, {}).get("title") or name.replace("-", " ").title()
            return {"id": name, "title": str(title), "version": remote}
        return {}

    @Slot(str)
    def bringBack(self, mod_id):
        """Yes to nextOffer: off the deleted list, then the update check installs it, switches it on and puts it in"""
        path = self._terminal("Updater", "declined.txt")
        try:
            with open(path, encoding="utf-8") as f: lines = f.read().splitlines()
            with open(path, "w", encoding="utf-8") as f:
                f.write("".join(line + "\n" for line in lines if line.strip() != mod_id))
        except OSError:
            self.said.emit("The Terminal could not change its list of deleted mods."); return
        self.checkUpdates()

    @Slot(str)
    def keepDeleted(self, mod_id):
        """No to nextOffer: not asked again until the channel has a newer version than this one"""
        run = _read_json(self._terminal("Updater", "last_run.json"), {}) or {}
        entry = (run.get("components") or {}).get(mod_id) or {}
        if isinstance(entry, dict) and entry.get("remote"):
            self._remember_deleted(mod_id, entry["remote"])

    def _decline(self, mod_id):
        """the updater does not install a mod the player deleted again (Updater\\declined.txt), unless a mod they
        keep needs it"""
        folder = self._terminal("Updater")
        if not os.path.isdir(folder): return
        path = os.path.join(folder, "declined.txt")
        try:
            with open(path, encoding="utf-8") as f: have = {line.strip() for line in f}
        except OSError:
            have = set()
        if mod_id in have: return
        try:
            with open(path, "a", encoding="utf-8") as f: f.write(mod_id + "\n")
        except OSError:
            pass

    @Slot()
    def runSetup(self):
        self._run("READING THE GAME'S DATA", SETUP_STEPS, SETUP_MARKS, [["setup"]], "The game's data is read.")

    @Slot()
    def backupSave(self):
        self._run("BACKING UP YOUR SAVE", BACKUP_STEPS, BACKUP_MARKS, [["backup-save"]],
                  "A full copy of your save is in the Terminal's save_backups folder.", after="backups")

    @Slot()
    def repairSave(self):
        self._run("REPAIRING YOUR SAVE", REPAIR_STEPS, REPAIR_MARKS, [["repair-save"]],
                  "Your save is ready for the normal game. If Steam asks about a cloud save conflict, choose the local save.")

    @Slot()
    def makeReport(self):
        """the loader's report, then every mod log there is added to it (improvement 6)"""
        done = ("The report is a zip in the Terminal's feedback folder, with every mod log, the game's log and the "
                "updater's log in it. Send it with your notes.")
        self._run("MAKING A REPORT", REPORT_STEPS + ["Add every mod log"], REPORT_MARKS + [("Mod logs added", 1)],
                  [["feedback"], ["@call", "Adding every mod log", self._collect_logs]], done,
                  after="report" if self.canSendReport else "feedback")
        self._job_kind = "report"

    def _collect_logs(self):
        files = extras.report_files(self.launcher, self._terminal(), self.data_dir, self._game_data_dir())
        where, count = extras.add_to_newest_zip(self._p("feedback"), files)
        if not where: raise RuntimeError("The loader made no report zip to add the logs to.")
        self._last_report = where
        return "Mod logs added: %d file%s (%s)" % (count, "" if count == 1 else "s", os.path.basename(where))

    def _game_data_dir(self):
        """the game's own data folder (Player.log, logs mods write there)"""
        info = self._copy_info()
        home = self.profile_root or os.path.expanduser("~")
        return os.path.join(home, "AppData", "LocalLow", "91Act", str(info.get("product") or STOCK_PRODUCT) if info else STOCK_PRODUCT)

    @Slot()
    def dismiss(self):
        if self._running: return
        self._busy = False
        self.busyChanged.emit()

    @Property(bool, constant=True)
    def preview(self):
        """the loader in use is a test copy with a stand-in profile folder: nothing real is installed or started"""
        return bool(self.profile_root) or self.demo

    @Slot()
    def play(self):
        if self.demo or self.profile_root:                   # a test never starts the real game
            self.said.emit("Preview: this installs into a test copy, so the game is not started from here.")
            return
        if self._state == "no-game":
            self.said.emit("The game has not been found yet. Press Set up and install first.")
            return
        info = self._copy_info()
        if not info: QDesktopServices.openUrl(QUrl("steam://rungameid/" + APPID)); return
        self._start_copy(self._copy, self.copyName)

    def _start_copy(self, copy_id, name):
        exe = os.path.join(self._copy_dir(copy_id), "game", self._copy_info(copy_id)["exe"])
        try:                                      # a copy is started by its own program; Steam has to be running for it
            subprocess.Popen([exe], cwd=os.path.dirname(exe), env=dict(os.environ, SteamAppId=APPID, SteamGameId=APPID))
            self.said.emit("Starting %s. Steam has to be running." % name)
        except OSError as e:
            self.said.emit("%s could not be started (%s)." % (name, e.strerror or e))

    # ---- the game without mods: a copy that never takes any, started beside a modded game ---------------------
    def _plain(self):
        folder = self._p("copies")
        for name in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            if (self._copy_info(name) or {}).get("name") == PLAIN_NAME: return name
        return ""

    @Property(bool, notify=changed)
    def plainWanted(self):
        """mods are in the game, so the quiet button offers the game without them (where copies can be made)"""
        return self._state == "installed" and self.copiesAvailable

    @Property(bool, notify=changed)
    def plainMade(self): return bool(self._plain())

    @Property(str, notify=changed)
    def plainBuild(self): return str((self._copy_info(self._plain()) or {}).get("build", "")) if self._plain() else ""

    @Slot()
    def playQuiet(self):
        """the quiet button beside the big one"""
        if self.plainWanted: self.playPlain()
        else: self.play()

    @Slot()
    def playPlain(self):
        """start the game without mods; it is made first when there is none, and brought up to date after a game update"""
        if self._busy: return
        if self.demo: self.said.emit("Preview: the game is not started from a recording."); return
        plain = self._plain()
        if not plain:
            self._run("MAKING A GAME WITHOUT MODS", COPY_STEPS, COPY_MARKS, [["@tool", COPY_TOOL, "create", PLAIN_NAME]],
                      "The game without mods is ready. It has its own saves and starts as a new player. Your modded game and its saves are as they were.",
                      after="playplain")
            return
        if self._build and self._build != "?" and str(self._copy_info(plain).get("build")) != self._build:
            self._run("UPDATING THE GAME WITHOUT MODS", ["Bring the copy up to date"], [(" files", 0), ("refreshed", 0)],
                      [["@tool", COPY_TOOL, "refresh", plain]], "The game without mods is on the game's new build.", after="playplain")
            return
        if self.profile_root: self.said.emit("Preview: this is a test copy, so the game is not started from here."); return
        self._start_copy(plain, "the game without mods")

    @Property(bool, constant=True)
    def plainSavesAvailable(self):
        """the loader's copy tool can bring the Steam game's saves into a copy (an older one cannot)"""
        try: return self.copiesAvailable and "def bring_saves" in open(self._p(*COPY_TOOL.split("/")), encoding="utf-8").read()
        except OSError: return False

    @Slot()
    def bringPlainSaves(self):
        """the Steam game's saves, copied into the game without mods with every mod character taken out of the copy"""
        plain = self._plain()
        if not plain or self._busy: return
        self._run("BRINGING YOUR SAVE", ["Copy and clean the saves"], [("left out", 0), ("brought", 0)],
                  [["@tool", COPY_TOOL, "saves", plain, "--replace"]],
                  "Your save is in the game without mods, with mod characters taken out of that copy. The save of your Steam game was only read.")

    @Slot()
    def deletePlain(self):
        plain = self._plain()
        if not plain: return
        self._run("DELETING THE GAME WITHOUT MODS", ["Remove the copy"], [("deleted", 0)], [["@tool", COPY_TOOL, "delete", plain]],
                  "The game without mods is gone. Its saves stay on this PC.")

    def _open(self, *parts):
        path = self._p(*parts)
        if self.demo: self.said.emit("Preview: folders are not opened from a recording."); return
        if not os.path.exists(path): self.said.emit("That folder does not exist yet."); return
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    @Slot()
    def openModsFolder(self): self._open("mods")

    @Slot()
    def openGameFolder(self): self._open(os.path.relpath(os.path.join(self._copy_dir(), "game") if self._copy else self._work("game"), self.launcher))

    @Slot()
    def openBackups(self):
        self._open(os.path.relpath(os.path.join(self._copy_dir(), "save_backups") if self._copy else self._work("save_backups"), self.launcher))

    @Slot()
    def openFeedback(self): self._open("feedback")

    @Slot()
    def openLog(self):
        path = self._data("last_run.log")
        if self.demo or not os.path.isfile(path): self.said.emit("There is no log yet."); return
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    @Slot()
    def openNotices(self):
        path = os.path.join(os.path.dirname(HERE), "NOTICES.md")
        if self.demo or not os.path.isfile(path): return
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    # ---- game copies ----------------------------------------------------------------------------------------
    @Property(bool, constant=True)
    def copiesAvailable(self):
        """the loader beside this window can make game copies (an older loader cannot, and the page is left out).
        Windows only for now: how a copy is started under Proton is not worked out."""
        return os.name == "nt" and os.path.isfile(self._p(*COPY_TOOL.split("/")))

    @Property("QVariantList", notify=changed)
    def copies(self):
        folder, out = self._p("copies"), []
        for name in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            info = self._copy_info(name)
            if info and info.get("name") == PLAIN_NAME: continue          # the game without mods is not one to set up
            if info: out.append({"id": name, "name": str(info.get("name") or name), "build": str(info.get("build", "")),
                                 "behind": bool(self._build) and self._build != "?" and str(info.get("build")) != self._build,
                                 "inUse": name == self._copy})
        return out

    @Property(str, notify=changed)
    def gameCopy(self): return self._copy

    @Property(str, notify=changed)
    def copyName(self):
        info = self._copy_info()
        return str(info.get("name") or self._copy) if info else ""

    @Property(int, constant=True)
    def mostCopies(self): return MOST_COPIES

    @Slot(str)
    def useCopy(self, copy_id):
        """the game the window sets up from now on: a copy, or the Steam game ("")"""
        if self._busy or copy_id == self._copy or (copy_id and not self._copy_info(copy_id)): return
        if copy_id and copy_id == self._plain(): return
        self._copy = copy_id
        self._save_settings(); self.refresh()
        self.settingsChanged.emit()               # the intro's switch is each game's own
        self.said.emit("The Terminal now sets up %s." % (self.copyName or "your Steam game"))

    @Slot()
    def makeCopy(self):
        taken = {c["name"] for c in self.copies}
        if len(taken) >= MOST_COPIES: self.said.emit("%d copies is the most for now. Delete one first." % MOST_COPIES); return
        if self._state == "no-game": self.said.emit("The game has not been found yet. Press Set up and install first."); return
        name = next("Copy %d" % n for n in range(1, MOST_COPIES + 2) if "Copy %d" % n not in taken)
        self._run("MAKING A COPY OF THE GAME", COPY_STEPS, COPY_MARKS, [["@tool", COPY_TOOL, "create", name]],
                  "%s is ready and in use. It starts with no mods and as a new player: switch its mods on in the Library, then install." % name)

    @Slot()
    def updateCopy(self):
        """after a game update: the copy takes the files that changed, then its mods go in again"""
        if not self._copy: return
        again = bool(self._wanted())
        steps = ["Bring the copy up to date"] + (REBUILD_STEPS if again else [])
        marks = [(" files", 0), ("refreshed", 0)] + [(mark, step + 1) for mark, step in REBUILD_MARKS]
        self._run("UPDATING " + self.copyName.upper(), steps, marks, [["@tool", COPY_TOOL, "refresh", self._copy]] + ([["install"]] if again else []),
                  "%s is on the game's new build%s." % (self.copyName, ", with its mods back in" if again else ""), after="play" if again else "")

    @Slot()
    def deleteCopy(self):
        if not self._copy: return
        name = self.copyName
        self._run("DELETING " + name.upper(), ["Remove the copy"], [("deleted", 0)], [["@tool", COPY_TOOL, "delete", self._copy]],
                  "%s is gone. Its saves stay on this PC. The Terminal is back on your Steam game." % name)

    # ---- the LOG page: the last job the window ran, and the game's own log of its last run -------------------
    def _game_log(self):
        info = self._copy_info()
        home = self.profile_root or os.path.expanduser("~")
        return os.path.join(home, "AppData", "LocalLow", "91Act", str(info.get("product") or STOCK_PRODUCT) if info else STOCK_PRODUCT, "Player.log")

    @Slot(str, bool, result="QVariantMap")
    def logView(self, which, only_problems):
        """{"lines": [{"text", "kind"}], "when", "head", "problems", "warns", "empty"} for "job" or "game" """
        if which == "game": return logs.last_game(self._game_log(), only_problems)
        view = logs.last_job(self._data("last_run.log") if self.data_dir else "")
        if only_problems:
            view["lines"] = [line for line in view["lines"] if line["kind"]]
            if not view["lines"] and not view["empty"]: view["empty"] = "No problems in the last run."
        return view

    @Slot(str, bool)
    def copyLog(self, which, only_problems):
        view = self.logView(which, only_problems)
        if not view["lines"]: self.said.emit("There is nothing to copy yet."); return
        app = QGuiApplication.instance()
        if isinstance(app, QGuiApplication) and not self.demo: app.clipboard().setText(logs.text_of(view))
        self.said.emit("%d lines copied." % len(view["lines"]))

    @Slot(str)
    def openLogFile(self, which):
        path = self._game_log() if which == "game" else self._data("last_run.log") if self.data_dir else ""
        if self.demo or not os.path.isfile(path): self.said.emit("There is no log yet."); return
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    # ---- a mod list: what is switched on, with versions, as a small file to send (modlist.py) ----------------
    @staticmethod
    def _local(url):
        return QUrl(url).toLocalFile() if url.startswith("file:") else url

    @Slot(str, result=bool)
    def isList(self, url):
        path = self._local(url)
        return os.path.isfile(path) and not zipfile.is_zipfile(path) and modlist.read(path) is not None

    @Slot(str, result=str)
    def saveList(self, url):
        on = self._wanted()
        if not on: return "Switch a mod on first: a list holds the mods that are switched on."
        if self.demo: return "Preview: nothing is saved."
        path = self._local(url)
        if not path.lower().endswith(".json"): path += modlist.ENDING
        chosen = {mod["id"]: {s["id"]: s["value"] for s in mod["settings"]} for mod in on if mod["settings"]}
        try:
            with open(path, "w", encoding="utf-8") as f: json.dump(modlist.make(self._mods, self._build, VERSION, chosen), f, indent=1)
        except OSError as error:
            return "The list could not be saved (%s)." % (error.strerror or error)
        return "%s saved: %d mod%s, names and versions only. Send that file." % (os.path.basename(path), len(on), "" if len(on) == 1 else "s")

    @Slot(str, result=str)
    def listQuestion(self, url):
        """what to ask before useList(url); nothing when the file is not a list (useList then says so)"""
        listed = modlist.read(self._local(url))
        return "" if listed is None or self._busy else modlist.question(modlist.compare(listed, self._mods))

    @Slot(str, result=str)
    def useList(self, url):
        if self._busy: return "Wait for the current job to finish first."
        listed = modlist.read(self._local(url))
        if listed is None: return "That file is not a mod list."
        found = modlist.compare(listed, self._mods)
        self._write_enabled([entry["id"] for entry in found["on"]])
        if self.settingsAvailable and any(entry["settings"] for entry in found["on"]):
            chosen = json.loads(json.dumps(self._chosen()))
            for entry in found["on"]:
                offered = {s["id"]: [o["value"] for o in s["options"]] for s in self._mod(entry["id"])["settings"]}
                for key, value in entry["settings"].items():
                    if value in offered.get(key, []): chosen.setdefault(entry["id"], {})[key] = value
            self._write_chosen(chosen)
        self.refresh(); self.settingsChanged.emit()
        count = len(found["on"])
        said = "%d mod%s switched on from the list." % (count, "" if count == 1 else "s") if count else "None of the list's mods are in your Library."
        if found["missing"]: said += " Not in your Library: %s." % ", ".join(("%s %s" % (e["title"], e["version"])).strip() for e in found["missing"])
        return said

    # ---- the list of mods ------------------------------------------------------------------------------------
    @Slot(str, bool)
    def setEnabled(self, mod_id, on):
        self._write_enabled([i for i in self._enabled() if i != mod_id] + ([mod_id] if on else []))
        self.refresh()

    @Slot(str, bool)
    def setSetEnabled(self, name, on):
        """every mod of a set (Redux) on, or every one off, in one go"""
        ids = [m["id"] for m in self._mods if m["set"] == name and not m["locked"]]
        if not name or not ids: return
        self._write_enabled([i for i in self._enabled() if i not in ids] + (ids if on else []))
        self.refresh()

    @Slot("QVariantList", bool)
    def setManyEnabled(self, ids, on):
        """several mods on, or off, in one write: a part of Redux (the Redux page). Mods this Terminal does not have
        and core files are left out; switched on, they keep the order redux.json gives them."""
        have = {m["id"] for m in self._mods if not m["locked"]}
        ids = [str(i) for i in ids if str(i) in have]
        if not ids: return
        self._write_enabled([i for i in self._enabled() if i not in ids] + (ids if on else []))
        self.refresh()

    @Property("QVariantMap", notify=changed)
    def redux(self):
        """zenith_gui\\redux.json, published with the window on the dev channel (tools\\redux_bundle.py --gui): the
        set's name, version and build and its parts in order, each with its mods. Empty when the window has none
        (the public edition), and then the Redux page is not offered."""
        data = _read_json(self._redux_file, {})
        return data if isinstance(data, dict) and data.get("parts") else {}

    @Slot(str, result=str)
    def addMod(self, url):
        """A mod's folder, or a zip of one, chosen or dropped on the window -> copied into mods and switched on.
        The folder holds mod.json, or terminal.json when the mod is made on this PC before it is installed.
        Answers what happened, in words for the person (nothing when the progress panel has taken over)."""
        if re.match(r"https?:", url, re.I): return self.addLink(url)       # an address dropped from a browser
        src = QUrl(url).toLocalFile() if url.startswith("file:") else url
        if self._busy: return "Wait for the current job to finish first."
        try:
            if os.path.isdir(src):
                root = self._find_mod_root(src)
                if not root: return "That folder has no mod in it."
                meta = _read_json(os.path.join(root, "terminal.json"), None) or _read_json(os.path.join(root, "mod.json"), {})
                return self._add(str(meta.get("id") or ""), str(meta.get("name") or meta.get("id") or ""), folder=root)
            if zipfile.is_zipfile(src):
                meta, prefix = self._zip_mod(src)
                if meta is None: return prefix
                return self._add(str(meta.get("id") or ""), str(meta.get("name") or meta.get("id") or ""), zip_path=src, prefix=prefix)
            return "Choose a mod's zip, or drop its folder here."
        except (OSError, ValueError, zipfile.BadZipFile) as error:
            return "That mod could not be added (%s)." % error

    @staticmethod
    def _zip_mod(src):
        """-> (the mod's own card, the folder inside the zip that holds it), or (None, why not)"""
        with zipfile.ZipFile(src) as z:
            names = z.namelist()
            hits = [n for n in names if n.rsplit("/", 1)[-1] in ("mod.json", "terminal.json") and n.count("/") <= 2]
            roots = sorted({n[:len(n) - len(n.rsplit("/", 1)[-1])] for n in hits})
            if len(roots) != 1: return None, "That zip does not hold exactly one mod."
            card = roots[0] + ("terminal.json" if roots[0] + "terminal.json" in names else "mod.json")
            return json.loads(z.read(card).decode("utf-8")), roots[0]

    def _may_add(self, mod_id, name):
        """-> (the mod's title, why it cannot be added or "")"""
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{1,60}", mod_id): return "", "That mod does not say which mod it is."
        title = str(self._known.get(mod_id, {}).get("title") or re.sub(r"\s*\([^()]*\)\s*$", "", name) or mod_id)
        have = self._mod(mod_id)
        if have and have["locked"]: return title, "%s is one of the Terminal's own files." % title
        if have and have["installed"]: return title, "%s is in your game. Uninstall it first, then add the new copy." % title
        return title, ""

    @Slot(result=str)
    def copiedLink(self):
        """the GitHub address the person copied, or nothing when what they copied is not one"""
        app = QGuiApplication.instance()
        return fetch.address(app.clipboard().text()) if isinstance(app, QGuiApplication) else ""

    @Slot(str, result=str)
    def addQuestion(self, url):
        """What to ask before addMod(url); nothing only when there is no mod to add (addMod then says why). Every
        mod is asked about, from a link or from the disk, whatever it says it is: the loader runs a mod's scripts
        on this PC when it installs the mod, and nothing here can tell a mod from a copy that claims its name."""
        if self._busy or self.demo: return ""
        try:
            if re.match(r"https?:", url, re.I):
                link = fetch.address(url)
                if not link: return ""
                owner, repo = link.split("/")[3:5]
                return ("This downloads %s from %s/%s on GitHub and adds it to your Library. A mod can bring scripts "
                        "that run on your PC when you install it. %s" % (fetch.file_name(link), owner, repo, TRUST))
            src = QUrl(url).toLocalFile() if url.startswith("file:") else url
            if os.path.isdir(src):
                root = self._find_mod_root(src)
                if not root: return ""
                meta = _read_json(os.path.join(root, "terminal.json"), None) or _read_json(os.path.join(root, "mod.json"), {})
                runs = any(_RUNS.search(n) for _, _, files in os.walk(root) for n in files)
            elif zipfile.is_zipfile(src):
                meta, prefix = self._zip_mod(src)
                if meta is None: return ""
                with zipfile.ZipFile(src) as z: runs = any(n.startswith(prefix) and _RUNS.search(n) for n in z.namelist())
            else:
                return ""
            content = meta.get("content") if isinstance(meta.get("content"), dict) else {}
            runs = runs or bool(content.get("importers")) or bool(meta.get("prepare"))
            name = re.sub(r"\s*\([^()]*\)\s*$", "", str(meta.get("name") or meta.get("id") or "")) or "This mod"
            if runs: return "%s brings its own scripts. They run on your PC when you install it. %s" % (name, TRUST)
            return "%s changes your game's files, and a mod can bring scripts that run on your PC when you install it. %s" % (name, TRUST)
        except (OSError, ValueError, zipfile.BadZipFile):
            return ""                                         # addMod says what is wrong with it

    @Slot(str, result=str)
    def addLink(self, text):
        """A mod's zip from a GitHub address: the one given, or the one the person copied. Downloaded to a
        temporary file, then added as a zip from the disk is. Answers as addMod does."""
        if self._busy: return "Wait for the current job to finish first."
        if not text:
            app = QGuiApplication.instance()
            text = app.clipboard().text() if isinstance(app, QGuiApplication) else ""
        url = fetch.address(text)
        if not url:
            return ("Copy the link of a mod's zip on GitHub first, then press this." if not str(text or "").strip()
                    else "That is not the link of a zip on GitHub (a release file or a repository's archive).")
        if self.demo: return "Preview: nothing is downloaded."
        handle, self._fetch_file = tempfile.mkstemp(prefix="zenith_mod_", suffix=".zip"); os.close(handle)
        self._begin("GETTING " + fetch.file_name(url).upper(), LINK_STEPS, [])
        self._job_kind = "fetch"
        self._line("from " + url)
        dest, get, steps = self._fetch_file, self.fetch_with, [0]

        def progress(done, total):
            step = done * 10 // total if total else done >> 23             # a line each tenth, or each 8 MB
            if step == steps[0]: return
            steps[0] = step
            self._arrived.emit("%.1f MB%s" % (done / 1048576, " of %.1f" % (total / 1048576) if total else ""))

        def work():
            try:
                self._fetched.emit(True, "%d" % get(url, dest, progress))
            except fetch.FetchError as error:
                self._fetched.emit(False, "That mod could not be downloaded: %s." % error)
            except Exception as error:                       # a thread must always answer, or the panel never closes
                self._fetched.emit(False, "That mod could not be downloaded (%s)." % error)

        threading.Thread(target=work, daemon=True).start()
        return ""

    def _drop_fetched(self):
        if self._fetch_file:
            try: os.remove(self._fetch_file)
            except OSError: pass
        self._fetch_file = ""

    @Slot(bool, str)
    def _fetch_done(self, ok, text):
        if self._cancelled: self._drop_fetched(); return
        if not ok:
            self._drop_fetched(); self._finish(False, text); return
        self._line("%.1f MB downloaded" % (int(text) / 1048576))
        why = ""
        try:
            if not zipfile.is_zipfile(self._fetch_file): why = "That file is not a zip."
            else:
                meta, prefix = self._zip_mod(self._fetch_file)
                if meta is None: why = prefix
                else:
                    mod_id = str(meta.get("id") or "")
                    title, why = self._may_add(mod_id, str(meta.get("name") or mod_id))
        except (OSError, ValueError, zipfile.BadZipFile) as error:
            why = "That mod could not be added (%s)." % error
        if why:
            self._drop_fetched(); self._finish(False, why); return
        self._title, self._step = "ADDING " + title.upper(), 1
        self._done_text = "%s is in your Library and switched on. Press Install to put it in your game." % title
        self.busyChanged.emit()
        self._unpack(mod_id, zip_path=self._fetch_file, prefix=prefix)

    def _add(self, mod_id, name, folder="", zip_path="", prefix=""):
        """copy a mod into mods\\<id> on a thread of its own, behind the progress panel"""
        title, why = self._may_add(mod_id, name)
        if why: return why
        if self.demo: return "Preview: nothing is added."
        self._begin("ADDING " + title.upper(), ADD_STEPS, [],
                    "%s is in your Library and switched on. Press Install to put it in your game." % title)
        self._unpack(mod_id, folder, zip_path, prefix)
        return ""

    def _unpack(self, mod_id, folder="", zip_path="", prefix=""):
        dest = self._p("mods", mod_id)

        def work():
            try:
                if os.path.exists(dest):                     # an older copy: to the Recycle Bin, never merged into
                    moved = QFile.moveToTrash(dest)
                    if not (moved[0] if isinstance(moved, tuple) else moved): shutil.rmtree(dest)
                count = 0
                if folder:
                    shutil.copytree(folder, dest, ignore=shutil.ignore_patterns("__pycache__"))
                    count = sum(len(files) for _, _, files in os.walk(dest))
                else:
                    with zipfile.ZipFile(zip_path) as z:
                        for info in z.infolist():
                            if info.is_dir() or not info.filename.startswith(prefix): continue
                            rel = os.path.normpath(info.filename[len(prefix):])
                            if rel.startswith("..") or os.path.isabs(rel) or ":" in rel: raise ValueError("a file path that is not allowed")
                            out = os.path.join(dest, rel)
                            os.makedirs(os.path.dirname(out), exist_ok=True)
                            with z.open(info) as fin, open(out, "wb") as fout: shutil.copyfileobj(fin, fout, 1 << 20)
                            count += 1
                self._packed.emit(True, "%s|%d" % (mod_id, count))
            except (OSError, ValueError, zipfile.BadZipFile) as error:
                shutil.rmtree(dest, ignore_errors=True)      # never half a mod
                self._packed.emit(False, "That mod could not be added (%s)." % error)

        threading.Thread(target=work, daemon=True).start()

    @Slot(bool, str)
    def _pack_done(self, ok, text):
        self._drop_fetched()
        if self._cancelled: return
        if ok:
            mod_id, count = text.split("|")
            self._line("%s files copied into mods\\%s" % (count, mod_id))
            self._write_enabled([i for i in self._enabled() if i != mod_id] + [mod_id])
            self._finish(True, self._done_text)
        else:
            self._finish(False, text)

    @staticmethod
    def _find_mod_root(folder):
        is_mod = lambda d: os.path.isfile(os.path.join(d, "mod.json")) or os.path.isfile(os.path.join(d, "terminal.json"))
        if is_mod(folder): return folder
        inner = [os.path.join(folder, n) for n in os.listdir(folder) if is_mod(os.path.join(folder, n))]
        return inner[0] if len(inner) == 1 else ""

    # ---- driving the screens by hand (a recording of the install screen without running an install) ----------
    @Slot(str)
    def demoBegin(self, title):
        self._begin(title, INSTALL_STEPS, INSTALL_MARKS, PLAY_TEXT, "play")

    @Slot(int, str)
    def demoStep(self, step, line):
        self._step = step
        if line: self._log.append(line)
        self.busyChanged.emit(); self.logChanged.emit()

    @Slot()
    def demoFinish(self):
        self._running, self._result, self._step = False, "ok", len(self._steps)
        self._result_text = self._done_text
        self._state = "installed"
        self._installed = {mod["id"] for mod in self._mods if mod["enabled"]}
        for mod in self._mods: mod["installed"] = mod["id"] in self._installed
        self.changed.emit(); self.busyChanged.emit()

    # ==== 0.5.0 ==================================================================================================
    # ---- the first read of the folders, after the window is on screen (improvement 13) ----------------------------
    def _first_load(self):
        self.refresh()
        self._loaded = True
        self.loaded.emit(); self.changed.emit()

    @Property(bool, notify=changed)
    def hasLoaded(self): return self._loaded

    # ---- a mod's channel, freshness, changelog and earlier version (improvements 9, 10; roll back) ---------------
    def _repositories(self):
        """Updater\\repositories.txt -> {mod id: "DEV" | "PUBLIC"}, read again only when the file changed"""
        path = self._terminal("Updater", "repositories.txt")
        try: stamp = os.path.getmtime(path)
        except OSError: return {}
        if self._repo_cache and self._repo_cache[0] == (path, stamp): return self._repo_cache[1]
        out = {}
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    name, _, url = line.partition(":")
                    if url.strip() and not line.startswith("#"):
                        out[name.strip()] = "DEV" if "bbee-redux-dev" in url else "PUBLIC"
        except OSError:
            pass
        self._repo_cache = ((path, stamp), out)
        return out

    def _names_in(self, *parts):
        try:
            with open(self._terminal(*parts), encoding="utf-8") as f:
                return {line.strip() for line in f if line.strip() and not line.startswith("#")}
        except OSError:
            return set()

    def _mod_extras(self, mod_id, folder, core):
        if core: return {"channel": "", "fresh": False, "hasChangelog": False, "rollbackTo": "", "held": False}
        arrivals = self._arrivals()
        came = arrivals.get(mod_id) if isinstance(arrivals.get(mod_id), dict) else {}
        back = _read_json(self._terminal("Updater", "rollback", re.sub(r"[^\w\-]", "_", mod_id), "rollback.json"), None)
        return {"channel": self._repositories().get(mod_id, "LOCAL"),
                "fresh": bool(came) and time.time() - float(came.get("at") or 0) < 86400,
                "hasChangelog": any(os.path.isfile(os.path.join(folder, n)) for n in ("CHANGELOG.md", "CHANGES.md")),
                "rollbackTo": str(back.get("version") or "") if isinstance(back, dict) else "",
                "held": mod_id in self._held()}

    def _held(self): return self._names_in("Updater", "held.txt")

    def _arrivals(self):
        if not self.data_dir: return {}
        found = _read_json(self._data("arrivals.json"), {})
        return found if isinstance(found, dict) else {}

    def _note_arrivals(self, run):
        """the mods an updater run brought, with when: the Library marks them NEW for a day (improvement 9)"""
        if not self.data_dir or self.demo or not isinstance(run, dict): return
        came = self._arrivals()
        now = time.time()
        for name, entry in (run.get("components") or {}).items():
            if isinstance(entry, dict) and entry.get("status") in ("updated", "installed"):
                came[name] = {"at": now, "version": str(entry.get("remote") or "")}
        came = {k: v for k, v in came.items() if isinstance(v, dict) and now - float(v.get("at") or 0) < 7 * 86400}
        try: extras.write_json(self._data("arrivals.json"), came)
        except OSError: pass

    @Slot(str, result=str)
    def changelog(self, mod_id):
        """a mod's whole CHANGELOG.md, for the changelog panel (the newest part first, as the file has it)"""
        mod = self._mod(mod_id)
        for name in ("CHANGELOG.md", "CHANGES.md") if mod else ():
            try:
                with open(os.path.join(mod["folder"], name), encoding="utf-8", errors="replace") as f: text = f.read(20000)
            except OSError:
                continue
            return re.sub(r"[`*_]{1,2}", "", text).strip()
        return ""

    @Slot(str)
    def rollBack(self, mod_id):
        """the version a mod had before its last update goes back (the updater keeps it), then into the game when it
        is in the game; the mod is held there until RESUME UPDATES"""
        mod = self._mod(mod_id)
        if self._busy or self.demo or not mod or not mod.get("rollbackTo"): return
        again = mod["installed"] and not _game_open()
        steps = ["Put the earlier version back"] + (REBUILD_STEPS if again else [])
        marks = [("rolled back", 0)] + [(mark, step + 1) for mark, step in REBUILD_MARKS]
        report = self._terminal("Updater", "rollback_run.json")
        if again: self._remember_install_before()
        self._run("ROLLING BACK " + mod["title"].upper(), steps, marks,
                  [["@updaterplain", "--rollback", mod_id, "--report", report]] + ([["install"]] if again else []),
                  "%s is back on %s%s. It stays there until you press RESUME UPDATES." % (
                      mod["title"], mod["rollbackTo"], " and in your game" if again else
                      "; APPLY CHANGES puts it in your game" if mod["installed"] else ""),
                  after="play" if again else "")

    @Slot(str)
    def resumeUpdates(self, mod_id):
        """a rolled-back mod takes updates again (off Updater\\held.txt), and the check runs now"""
        path = self._terminal("Updater", "held.txt")
        try:
            with open(path, encoding="utf-8") as f: lines = f.read().splitlines()
            with open(path, "w", encoding="utf-8") as f: f.write("".join(l + "\n" for l in lines if l.strip() != mod_id))
        except OSError:
            self.said.emit("The Terminal could not change its list of held mods."); return
        self.refresh()
        self.checkUpdates()

    # ---- deleted mods, with ADD BACK (improvement 4) -------------------------------------------------------------
    @Property("QVariantList", notify=changed)
    def deleted(self):
        seen = _read_json(self._data("deleted.json"), {}) if self.data_dir else {}
        if not isinstance(seen, dict): seen = {}
        have = {m["id"] for m in self._mods}
        out = []
        for mod_id in sorted(self._declined_ids()):
            if mod_id in have: continue
            had = seen.get(mod_id) if isinstance(seen.get(mod_id), dict) else {}
            title = had.get("title") or self._known.get(mod_id, {}).get("title") or mod_id.replace("-", " ").title()
            out.append({"id": mod_id, "title": str(title), "version": str(had.get("version") or "")})
        return out

    @Slot(str)
    def addBack(self, mod_id): self.bringBack(mod_id)

    # ---- the job's progress: download, pause, cancel, plain words (improvements 3, 7, 11, 12) --------------------
    @Property("QVariantMap", notify=busyChanged)
    def download(self): return dict(self._download)

    @Property(str, notify=busyChanged)
    def resultHelp(self): return self._result_help

    @Property(int, constant=True)
    def stallSeconds(self): return STALL_SECONDS

    @Property(bool, notify=busyChanged)
    def canPause(self): return self._running and self._updater_job() and bool(self._download.get("total"))

    @Property(bool, notify=busyChanged)
    def cancelSafe(self):
        """stopping now leaves nothing half done: the updater (it rolls back what it was putting in), a download, a
        report. The loader's own install is offered a stop only when it has gone quiet (the panel's STALL line)."""
        return self._running and (self._updater_job() or self._job_kind in ("fetch", "report", "check"))

    def _updater_job(self):
        return self._updater_running or bool(self._proc and self._proc.property("updater"))

    def _pause_file(self, on):
        path = self._terminal("Updater", "_work", "pause")
        try:
            if on:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                open(path, "w").close()
            elif os.path.exists(path): os.remove(path)
        except OSError:
            pass

    @Slot(bool)
    def pauseDownload(self, on):
        if not self.canPause: return
        self._pause_file(on)
        self._download = dict(self._download, paused=on)
        self.busyChanged.emit()

    @Slot()
    def cancel(self):
        if not self._running: return
        self._cancelled = True
        self._queue = []
        self._pause_file(False)
        proc = self._proc
        if proc is not None and proc.state() != QProcess.ProcessState.NotRunning:
            if self._updater_job():               # asked first: it stops after the file it is on and rolls back
                try:
                    os.makedirs(self._terminal("Updater", "_work"), exist_ok=True)
                    open(self._terminal("Updater", "_work", "stop"), "w").close()
                except OSError:
                    pass
                QTimer.singleShot(8000, lambda: proc.kill() if proc.state() != QProcess.ProcessState.NotRunning else None)
            else:
                proc.kill()
            return
        self._finish(False, self._cancel_text())   # a thread's step or a download: its answer is not waited for

    def _cancel_text(self):
        if self._updater_job() or self._job_kind == "check":
            return "Stopped. What had downloaded is kept for the next check; nothing half done went into your mods."
        if self._touched_game:
            return ("Stopped during the install. Your save was backed up first. Press APPLY CHANGES to install again, "
                    "or UNINSTALL ALL in Options to take every mod out.")
        return "Stopped."

    # ---- undo the last install (improvement 20) -------------------------------------------------------------------
    def _remember_install_before(self):
        """what was in the game before this install, for UNDO LAST INSTALL (data\\install_history.json, the last 10)"""
        if self.demo or not self.data_dir or self._undoing: return
        went = _read_json(self._home("installed_settings.json"), {}) if self._installed else {}
        entry = {"when": time.strftime("%Y-%m-%d %H:%M"), "copy": self._copy, "installed": sorted(self._installed),
                 "settings": went if isinstance(went, dict) else {},
                 "titles": [m["title"] for m in self._mods if m["id"] in self._installed and not m["locked"]]}
        history = _read_json(self._data("install_history.json"), [])
        history = ([entry] + [h for h in history if isinstance(h, dict)])[:10]
        try: extras.write_json(self._data("install_history.json"), history)
        except OSError: pass

    @Property("QVariantMap", notify=changed)
    def lastInstall(self):
        """{when, titles, empty} of what the game held before the last install, or {} when there is nothing to undo"""
        history = _read_json(self._data("install_history.json"), []) if self.data_dir else []
        top = history[0] if history and isinstance(history[0], dict) else None
        if not top or top.get("copy", "") != self._copy: return {}
        return {"when": str(top.get("when", "")), "titles": list(top.get("titles") or []), "empty": not top.get("installed")}

    @Slot()
    def undoInstall(self):
        """the mods (and their settings) the game held before the last install go back in; nothing held: all out"""
        if self._busy or self.demo: return
        history = _read_json(self._data("install_history.json"), []) if self.data_dir else []
        top = history[0] if history and isinstance(history[0], dict) else None
        if not top or top.get("copy", "") != self._copy: self.said.emit("There is no install to undo."); return
        if _game_open(): self.said.emit("Close the game first, then undo."); return
        have = {m["id"] for m in self._mods if not m["locked"]}
        back = [i for i in top.get("installed") or [] if i in have]
        self._write_enabled(back)
        if isinstance(top.get("settings"), dict) and self.settingsAvailable: self._write_chosen(top["settings"])
        try: extras.write_json(self._data("install_history.json"), history[1:])
        except OSError: pass
        self.refresh()
        self._undoing = True
        try:
            if back: self._install_job("UNDOING THE LAST INSTALL", "Your game holds what it held before the last install.")
            else: self._run("UNDOING THE LAST INSTALL", REMOVE_STEPS, REMOVE_MARKS, [["uninstall"]],
                            "No mods are in your game, as before the last install.")
        finally:
            self._undoing = False

    # ---- the other Terminal (public or dev) installed last (improvement 8) -----------------------------------------
    @staticmethod
    def _marker():
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "ZenithTerminal", "last_install.json")

    def _after_job(self):
        """an install or uninstall into the Steam game is noted where every Terminal on this PC reads it"""
        if not self._touched_game or self._copy or self.demo or self.profile_root: return
        try:
            extras.write_json(self._marker(), {"terminal": os.path.normcase(os.path.abspath(self._terminal())),
                                               "edition": self.edition or "public", "when": time.strftime("%Y-%m-%d %H:%M"),
                                               "mods": sorted(self._enabled()) if self._job_kind == "install" else []})
        except OSError:
            pass

    @Slot(result="QVariantMap")
    def otherInstall(self):
        """{edition, when, count} when the mods in the Steam game were put there by another Terminal, else {}"""
        if self._copy or self.demo or self.profile_root: return {}
        mark = _read_json(self._marker(), None)
        if not isinstance(mark, dict) or not mark.get("mods"): return {}
        if mark.get("terminal") == os.path.normcase(os.path.abspath(self._terminal())): return {}
        return {"edition": "Dev" if mark.get("edition") == "dev" else "public", "when": str(mark.get("when", "")),
                "count": len(mark.get("mods") or [])}

    # ---- the first open: what is switched on goes in at once (improvement 1) ---------------------------------------
    @Slot(result=bool)
    def firstOpen(self):
        if self.demo or self._busy or not self.data_dir or os.path.exists(self._data("first_install.txt")): return False
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            with open(self._data("first_install.txt"), "w", encoding="utf-8") as f: f.write(time.strftime("%Y-%m-%d %H:%M"))
        except OSError:
            return False
        if self._settings.get("firstInstall") is False or self._copy or self.otherInstall(): return False
        if self._state not in ("no-game", "setup", "ready") or not self._wanted() or _game_open(): return False
        self._install_job("INSTALLING", PLAY_TEXT)
        return True

    # ---- the quiet update check while the window is open (improvement 2; tray) -------------------------------------
    def _set_check_timer(self):
        minutes = int(self._settings.get("checkEvery") or 0)
        if self.demo or not minutes or not self.canUpdate: self._checker.stop(); return
        self._checker.start(minutes * 60000)

    def _updater_version(self):
        try:
            with open(self._terminal("Updater", "version.txt"), encoding="utf-8") as f: return f.read().strip()
        except OSError:
            return ""

    @Slot()
    def quietCheck(self):
        """asks the channel what is newer, changes nothing; a newer mod is told in the window and the tray"""
        if self.demo or self._busy or not self.canUpdate or self._check_proc is not None: return
        if _version_newer("1.3.0", self._updater_version() or "0"): return      # an older updater has no --report
        if self._settings.get("quietWhilePlaying") is not False and _game_open(): return
        proc = QProcess(self)
        env = QProcessEnvironment.systemEnvironment()
        env.insert("PYTHONIOENCODING", "utf-8")
        proc.setProcessEnvironment(env)
        proc.setWorkingDirectory(self._terminal("Updater"))
        proc.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
        proc.readyReadStandardOutput.connect(lambda: proc.readAllStandardOutput())     # read and let go
        proc.finished.connect(lambda code, _s: self._quiet_done(code))
        self._check_proc = proc
        proc.start(self._python(), ["-u", self._terminal("Updater", "main.py"), "--check", "--report",
                                    self._terminal("Updater", "check_run.json")])

    def _quiet_done(self, code):
        self._check_proc = None
        self._check_stamp = time.strftime("%H:%M")
        self._check_ok = code != 2
        run = _read_json(self._terminal("Updater", "check_run.json"), {}) or {}
        held, declined = self._held(), self._declined_ids()
        self._available = [{"id": n, "title": self._title_of(n), "from": str(e.get("local") or ""), "to": str(e.get("remote") or "")}
                           for n, e in (run.get("components") or {}).items()
                           if isinstance(e, dict) and e.get("status") == "available" and n not in held and n not in declined]
        told = ",".join("%s=%s" % (a["id"], a["to"]) for a in self._available)
        if self._available and told != self._told:
            names = ", ".join(a["title"] for a in self._available[:3]) + (" and more" if len(self._available) > 3 else "")
            self.popup.emit("Updates are ready", "%s. Open the Terminal and press GET UPDATES." % names)
        self._told = told
        self.statusChanged.emit()

    @Property("QVariantList", notify=statusChanged)
    def available(self): return list(self._available)

    @Property(str, notify=statusChanged)
    def lastCheck(self): return self._check_stamp

    # ---- status lights and the online version check (additions) ---------------------------------------------------
    @Slot()
    def refreshStatus(self):
        """the players on Steam now and whether Steam and the game are open (a thread), then a quiet check"""
        if self.demo: return

        def work():
            players = -1
            try:
                import urllib.request
                with urllib.request.urlopen(PLAYERS_API, timeout=8) as r:
                    players = int(json.loads(r.read().decode("utf-8")).get("response", {}).get("player_count", -1))
            except Exception:
                pass
            self._players.emit(players)

        threading.Thread(target=work, daemon=True).start()
        self._game_running = _game_open()
        self.quietCheck()

    @Slot(int)
    def _players_done(self, count):
        self._players_now = count
        self.statusChanged.emit()

    @Property("QVariantList", notify=statusChanged)
    def statusLights(self):
        """[{name, state: ok | warn | bad | off, text}] for the Home page's STATUS tab"""
        out = []
        ok = self._check_ok
        out.append({"name": "UPDATE SERVER", "state": "off" if ok is None else "ok" if ok else "bad",
                    "text": "Not checked yet." if ok is None else ("Reached at %s." % self._check_stamp) if ok else
                    "Not reached at %s. Check your connection." % self._check_stamp})
        n = len(self._available)
        out.append({"name": "YOUR MODS", "state": "off" if ok is None else "warn" if n else "ok",
                    "text": "Not checked yet." if ok is None else "Up to date." if not n else
                    "%d update%s ready: %s." % (n, "" if n == 1 else "s", ", ".join(a["title"] for a in self._available[:4]))})
        online = self._mod("four-player")
        if online and online["enabled"]:
            newer = next((a for a in self._available if a["id"] == "four-player"), None)
            mine = online["installedVersion"] or online["version"]
            out.append({"name": "ONLINE PLAY", "state": "warn" if newer or not online["installed"] else "ok",
                        "text": ("Version %s. A newer one (%s) is out: players in a lobby need the same version, so update "
                                 "before you join." % (mine, newer["to"])) if newer else
                        ("Version %s is switched on but not in your game yet: APPLY CHANGES." % online["version"])
                        if not online["installed"] else
                        "Version %s, the newest on your channel. Everyone in a lobby needs this same version." % mine})
        p = self._players_now
        out.append({"name": "PLAYERS ON STEAM", "state": "off" if p < 0 else "ok",
                    "text": "Not known." if p < 0 else "%d playing Entropy Effect now (all players, not only modded)." % p})
        out.append({"name": "THE GAME", "state": "warn" if self._game_running else "ok",
                    "text": "Open. Installs wait until it is closed." if self._game_running else "Closed."})
        return out

    # ---- the health check (addition) ---------------------------------------------------------------------------
    def _save_root(self):
        return self._save_root_set or self._game_data_dir()

    @Slot()
    def runHealth(self):
        if self._health_running: return
        if self.demo:
            self._health = [{"name": "GAME FILES", "state": "ok", "text": "Preview.", "fix": ""}]
            self.healthChanged.emit(); return
        mark = ""
        try:
            with open(self._work("inspect", "game_build.txt"), encoding="utf-8") as f: mark = f.read().strip()
        except OSError:
            pass
        info = self._copy_info()
        facts = {"game": os.path.realpath(os.path.join(self._copy_dir(), "game") if info else self._work("game"))
                 if (info or os.path.exists(os.path.join(self._work("game"), EXE))) else "",
                 "build": self._build, "mark": mark, "launcher": self.launcher, "terminal": self._terminal(),
                 "saves": self._save_root(), "mods": [dict(m) for m in self._mods]}
        self._health_running = True
        self.healthChanged.emit()

        def work():
            try:
                facts["running"] = _game_open()
                rows = extras.health(facts)
            except Exception as error:
                rows = [{"name": "HEALTH CHECK", "state": "bad", "text": "The check stopped (%s)." % error, "fix": ""}]
            self._checked.emit(rows)

        threading.Thread(target=work, daemon=True).start()

    @Slot(list)
    def _health_done(self, rows):
        self._health, self._health_running = rows, False
        self.healthChanged.emit()

    @Property("QVariantList", notify=healthChanged)
    def health(self): return list(self._health)

    @Property(bool, notify=healthChanged)
    def healthRunning(self): return self._health_running

    @Slot(str)
    def healthFix(self, action):
        if action == "setup": self.runSetup()
        elif action == "checkupdates": self.checkUpdates()
        elif action == "steamverify" and not self.demo: QDesktopServices.openUrl(QUrl("steam://validate/" + APPID))

    # ---- play time and runs (addition) -------------------------------------------------------------------------
    @Slot()
    def loadStats(self):
        logs_now = [self._p("modlog.txt"), os.path.join(self._game_data_dir(), "modlog.txt")]

        def work():
            try: self._counted.emit(extras.play_stats([p for p in logs_now if os.path.isfile(p)]))
            except Exception: self._counted.emit({})

        threading.Thread(target=work, daemon=True).start()

    @Slot(dict)
    def _stats_done(self, stats):
        self._stats = stats
        self.statsChanged.emit()

    @Property("QVariantMap", notify=statsChanged)
    def stats(self): return dict(self._stats)

    # ---- mod presets (addition) --------------------------------------------------------------------------------
    def _presets(self):
        found = _read_json(self._data("presets.json"), {}) if self.data_dir else {}
        return found if isinstance(found, dict) else {}

    @Property("QVariantList", notify=changed)
    def presets(self):
        titles = {m["id"]: m["title"] for m in self._mods}
        return [{"name": name, "count": len(p.get("enabled") or []),
                 "titles": [titles.get(i, i) for i in p.get("enabled") or []][:6]}
                for name, p in sorted(self._presets().items()) if isinstance(p, dict)]

    @Slot(str, result=str)
    def savePreset(self, name):
        name = re.sub(r"\s+", " ", str(name or "")).strip()[:32]
        if not name: return "Give the preset a name."
        on = [m["id"] for m in self._wanted()]
        if not on: return "Switch a mod on first: a preset holds the mods that are switched on."
        if self.demo: return "Preview: nothing is saved."
        presets = self._presets()
        presets[name] = {"enabled": on, "settings": {i: v for i, v in self._chosen().items() if i in on}}
        try: extras.write_json(self._data("presets.json"), presets)
        except OSError as error: return "The preset could not be saved (%s)." % (error.strerror or error)
        self.changed.emit()
        return "Preset %s saved: %d mod%s." % (name, len(on), "" if len(on) == 1 else "s")

    @Slot(str, result=str)
    def usePreset(self, name):
        if self._busy: return "Wait for the current job to finish first."
        preset = self._presets().get(name)
        if not isinstance(preset, dict): return "That preset is gone."
        have = {m["id"] for m in self._mods if not m["locked"]}
        on = [i for i in preset.get("enabled") or [] if i in have]
        self._write_enabled(on)
        if self.settingsAvailable and isinstance(preset.get("settings"), dict):
            chosen = json.loads(json.dumps(self._chosen()))
            chosen.update({i: v for i, v in preset["settings"].items() if i in have and isinstance(v, dict)})
            self._write_chosen(chosen)
        self.refresh(); self.settingsChanged.emit()
        gone = len(preset.get("enabled") or []) - len(on)
        return "Preset %s switched on: %d mod%s.%s Press APPLY CHANGES to put it in your game." % (
            name, len(on), "" if len(on) == 1 else "s", " %d of its mods are not in your Library." % gone if gone else "")

    @Slot(str)
    def deletePreset(self, name):
        presets = self._presets()
        if name in presets and not self.demo:
            presets.pop(name)
            try: extras.write_json(self._data("presets.json"), presets)
            except OSError: pass
        self.changed.emit()

    # ---- the save timeline with RESTORE (addition) -------------------------------------------------------------
    @Property("QVariantList", notify=changed)
    def saveBackups(self):
        if self._copy: return []
        return extras.save_backups(self._work("save_backups"))[:40]

    @Slot(str)
    def restoreSave(self, backup_id):
        """a save copy goes back in place of the save now; the save now is copied first (before_restore)"""
        if self._busy or self.demo: return
        if self._copy: self.said.emit("Switch the Terminal to your Steam game first: copies keep their own saves."); return
        folder = os.path.join(self._work("save_backups"), backup_id)
        if not re.fullmatch(r"[\w-]+", backup_id or "") or not os.path.isdir(folder): self.said.emit("That save copy is gone."); return
        if _game_open(): self.said.emit("Close the game first, then put the save back."); return
        root = self._save_root()

        def put_back():
            if _game_open(): raise RuntimeError("The game was opened. Close it, then try again.")
            count = extras.restore_save(folder, root)
            if not count: raise RuntimeError("That copy holds no save folders.")
            return "Save restored: %d folder%s from %s" % (count, "" if count == 1 else "s", backup_id)

        self._run("PUTTING YOUR SAVE BACK", ["Copy your save as it is now", "Put the earlier save back"],
                  [("Save backed up", 0), ("Save restored", 1)],
                  [["backup-save", "before_restore"], ["@call", "Putting the save back", put_back]],
                  "Your save is the one from %s. The save you had a moment ago is in the timeline too (before a restore). "
                  "If Steam asks about a cloud save conflict, choose the local save." % backup_id[:15].replace("_", " "))

    # ---- launch straight into a test (addition; dev-testroom reads Launcher\\testauto.txt at login) -----------------
    def _testroom_js(self):
        return self._p("mods", "dev-testroom", "files", "testroom.js")

    @Property(bool, notify=changed)
    def testAvailable(self):
        mod = self._mod("dev-testroom")
        return bool(mod and mod["installed"]) and not self._copy

    @Property(bool, notify=changed)
    def testRunsAvailable(self):
        """the dev-testroom in the game starts a run from testauto.txt (0.2.4 on)"""
        try:
            with open(self._testroom_js(), encoding="utf-8") as f: return 'aw[0] == "run"' in f.read()
        except OSError:
            return False

    def _actor_id(self, mod):
        """the first added character's actor id a mod's data names (190000 and up), 0 when none"""
        path = os.path.join(mod["folder"], "mod.json")
        try: stamp = os.path.getmtime(path)
        except OSError: return 0
        had = self._actor_cache.get(path)
        if had and had[0] == stamp: return had[1]
        found = 0
        try:
            with open(path, encoding="utf-8") as f:
                found = next((int(n) for n in re.findall(r'"ActorId":\s*(\d{6})', f.read()) if int(n) >= 190000), 0)
        except OSError:
            pass
        self._actor_cache[path] = (stamp, found)
        return found

    @Property("QVariantList", notify=changed)
    def testHeroes(self):
        out = [{"name": name, "id": i} for name, i in OFFICIAL_HEROES]
        for mod in self._mods:
            if mod["kind"] == "CHARACTER" and mod["installed"]:
                i = self._actor_id(mod)
                if i: out.append({"name": mod["title"], "id": i})
        return out

    @Property("QVariantList", notify=changed)
    def testModes(self):
        out = [{"name": "TEST ROOM", "id": 0, "stages": 0}]
        if self.testRunsAvailable:
            out += [{"name": n, "id": i, "stages": s} for n, i, s in RUN_MODES]
            grim = self._mod("entropy-grim")
            if grim and grim["installed"]: out.append({"name": GRIM_MODE[0], "id": GRIM_MODE[1], "stages": GRIM_MODE[2]})
        return out

    @Slot(int, int, int, result=str)
    def launchTest(self, hero, mode, stage):
        if self.demo or self.profile_root: return "Preview: the game is not started from here."
        if not self.testAvailable: return "The test room mod is not in your game."
        if _game_open(): return "Close the game first: the test is chosen when the game starts."
        line = "%d" % hero if not mode else "run %d %d %d" % (mode, max(1, stage), hero)
        self._test_file = self._p("testauto.txt")
        try:
            with open(self._test_file, "w", encoding="utf-8") as f: f.write(line + "\n")
        except OSError as error:
            return "The test could not be set up (%s)." % (error.strerror or error)
        self._test_started = time.time()
        self._test_timer.start(3000)
        self.play()
        return "Starting the game straight into the test. Pick your save slot when it asks."

    def _test_tick(self):
        """testauto.txt is taken away once the game has read it (its log says so) or after five minutes, so the next
        normal start is a normal start"""
        seen = False
        try:
            with open(self._p("modlog.txt"), "rb") as f:
                f.seek(0, 2); f.seek(max(0, f.tell() - 65536))
                seen = b"login: testauto" in f.read() and os.path.getmtime(self._p("modlog.txt")) >= self._test_started
        except OSError:
            pass
        if seen or time.time() - self._test_started > 300:
            self._test_timer.stop()
            try: os.remove(self._test_file)
            except OSError: pass

    # ---- the playtester key (addition): a key from the team opens the dev channel ---------------------------------
    @Property(str, notify=changed)
    def keyState(self):
        """"built-in" (the Dev Terminal has its own), "signed-in" (a key the player entered), or "" """
        channel = self._channel()
        if self.edition == "dev" and not os.path.isfile(self._terminal("Updater", "channel.public.txt")): return "built-in"
        return "signed-in" if channel.get("channel") == "dev" and os.path.isfile(self._terminal("Updater", "dev_key.txt")) else ""

    def _channel(self):
        out = {}
        try:
            with open(self._terminal("Updater", "channel.txt"), encoding="utf-8") as f:
                for line in f:
                    k, _, v = line.partition(":")
                    if v: out[k.strip()] = v.strip()
        except OSError:
            pass
        return out

    @Slot(str)
    def useKey(self, key):
        key = str(key or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9_]{20,255}", key): self._keyed.emit(False, "That is not a playtester key."); return
        if self.demo: self._keyed.emit(False, "Preview: nothing is checked."); return

        def work():
            try:
                import urllib.request, urllib.error
                req = urllib.request.Request(DEV_REPO_API, headers={"Authorization": "Bearer " + key,
                                                                    "User-Agent": "ZenithTerminal/" + VERSION})
                with urllib.request.urlopen(req, timeout=10) as r: ok = r.status == 200
            except urllib.error.HTTPError as error:
                self._keyed.emit(False, "The key was not accepted (%d). Ask the team for a new one." % error.code); return
            except Exception as error:
                self._keyed.emit(False, "The key could not be checked: no connection (%s)." % type(error).__name__); return
            if not ok: self._keyed.emit(False, "The key was not accepted."); return
            try:
                updater = self._terminal("Updater")
                path = os.path.join(updater, "dev_key.txt")
                if os.path.isfile(path): os.remove(path)            # made new, so the owner-only mode below applies
                # owner-only on Linux (Proton, Bottles); on Windows the folder's own user permissions hold
                with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as f:
                    f.write(key + "\n")
                public = os.path.join(updater, "channel.public.txt")
                if not os.path.isfile(public) and os.path.isfile(os.path.join(updater, "channel.txt")):
                    shutil.copy2(os.path.join(updater, "channel.txt"), public)
                with open(os.path.join(updater, "channel.txt"), "w", encoding="utf-8") as f:
                    f.write("channel: dev\nexact: yes\ninstall-new: yes\nlists: %s\ntoken-file: dev_key.txt\n" % DEV_LISTS)
            except OSError as error:
                self._keyed.emit(False, "The key works, but it could not be kept (%s)." % (error.strerror or error)); return
            self._keyed.emit(True, "Signed in as a playtester. CHECK NOW brings the test builds.")

        threading.Thread(target=work, daemon=True).start()

    @Slot(bool, str)
    def _key_done(self, ok, text):
        self.said.emit(text)
        self.changed.emit()
        if ok: self.checkUpdates()

    @Slot()
    def signOut(self):
        """back to the public channel: the key is removed; the test builds stay until the next check replaces them"""
        updater = self._terminal("Updater")
        public = os.path.join(updater, "channel.public.txt")
        if self.demo or not os.path.isfile(public): return
        try:
            os.replace(public, os.path.join(updater, "channel.txt"))
            if os.path.isfile(os.path.join(updater, "dev_key.txt")): os.remove(os.path.join(updater, "dev_key.txt"))
        except OSError as error:
            self.said.emit("The Terminal could not sign out (%s)." % (error.strerror or error)); return
        self.said.emit("Signed out. CHECK NOW brings the public builds back.")
        self.changed.emit()

    # ---- a report to Discord, with the player's OK (addition) ------------------------------------------------------
    @Property(bool, constant=True)
    def canSendReport(self): return bool(str(self._links.get("reportWebhook") or "").startswith("https://discord.com/api/webhooks/"))

    @Slot(str)
    def sendReport(self, note):
        """the report just made goes to the team's Discord channel, with the player's note (the panel asks first)"""
        if not self.canSendReport or self.demo: return
        path = self._last_report
        if not path or not os.path.isfile(path): self._sent.emit(False, "Make a report first."); return
        if os.path.getsize(path) > 10 * 1048576: self._sent.emit(False, "The report is over 10 MB: send it by hand from the feedback folder."); return
        url, text = str(self._links["reportWebhook"]), ("Report from the Zenith Terminal %s%s: %s" % (
            VERSION, " Dev" if self.edition == "dev" else "", str(note or "").strip() or "(no note)"))[:1900]

        def work():
            try:
                import urllib.request, uuid
                cut = uuid.uuid4().hex
                body = b"".join([
                    b"--%s\r\nContent-Disposition: form-data; name=\"payload_json\"\r\nContent-Type: application/json\r\n\r\n" % cut.encode(),
                    json.dumps({"content": text, "allowed_mentions": {"parse": []}}).encode("utf-8"), b"\r\n",
                    b"--%s\r\nContent-Disposition: form-data; name=\"files[0]\"; filename=\"%s\"\r\nContent-Type: application/zip\r\n\r\n"
                    % (cut.encode(), os.path.basename(path).encode("utf-8")),
                    open(path, "rb").read(), b"\r\n--%s--\r\n" % cut.encode()])
                req = urllib.request.Request(url, data=body, method="POST", headers={
                    "Content-Type": "multipart/form-data; boundary=" + cut, "User-Agent": "ZenithTerminal/" + VERSION})
                with urllib.request.urlopen(req, timeout=60) as r: ok = r.status in (200, 204)
                self._sent.emit(ok, "Sent to the team's Discord. Thank you." if ok else "Discord did not take the report.")
            except Exception as error:
                self._sent.emit(False, "The report could not be sent (%s). It is in the feedback folder." % type(error).__name__)

        threading.Thread(target=work, daemon=True).start()

    @Slot(bool, str)
    def _sent_done(self, ok, text): self.said.emit(text)

    # ---- the Terminal in Steam's library (addition) ----------------------------------------------------------------
    def _steam_name(self): return STEAM_NAME + (" Dev" if self.edition == "dev" else "")

    @Property(str, notify=changed)
    def steamState(self):
        """"added", "can-add", or "" (no Steam found, or no ZenithTerminal.exe beside the window)"""
        if self.demo: return "can-add"
        steam = extras.steam_folder()
        user = extras.steam_user(steam) if steam else ""
        if not user or not os.path.isfile(self._terminal("ZenithTerminal.exe")): return ""
        return "added" if extras.in_steam(user, self._steam_name()) else "can-add"

    @Slot(result=str)
    def addToSteam(self):
        if self.demo: return "Preview: Steam is not changed."
        steam = extras.steam_folder()
        user = extras.steam_user(steam) if steam else ""
        exe = self._terminal("ZenithTerminal.exe")
        if not user: return "Steam was not found on this PC."
        if not os.path.isfile(exe): return "ZenithTerminal.exe is not beside this window."
        try:
            out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq steam.exe", "/NH"], capture_output=True, text=True,
                                 timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
            if "steam.exe" in out.lower(): return "Close Steam first (Steam > Exit), then press this again: Steam rewrites its library when it closes."
        except (OSError, subprocess.SubprocessError):
            pass
        try:
            said = extras.add_steam_shortcut(user, exe, self._steam_name(), self._terminal("Gui", "art", "logo", "zenith.ico"))
        except (OSError, ValueError) as error:
            return "Steam's library could not be changed (%s)." % error
        self.changed.emit()
        return ("%s is in your Steam library. Start Steam: it is listed under your games, and works in Big Picture and "
                "on a Steam Deck." if said == "added" else "%s in your Steam library is up to date.") % self._steam_name()

    # ---- Linux, Proton and Bottles: where the game and its saves are (improvement 16) ------------------------------
    @Slot(str)
    def setGameFolder(self, url):
        """the game's folder chosen by hand (Bottles or a Proton prefix the Terminal could not find): read from there"""
        folder = self._local(url)
        if not os.path.isfile(os.path.join(folder, EXE)):
            self.said.emit("That folder does not hold %s. Choose the folder the game's program is in." % EXE); return
        self._run("FINDING THE GAME", SETUP_STEPS, SETUP_MARKS, [["setup", folder]], "The game's data is read.")

    @Property(str, notify=settingsChanged)
    def saveFolder(self): return self._save_root_set

    @Slot(str)
    def setSaveFolder(self, url):
        """the game's save area chosen by hand ("" goes back to the usual place); every job is told (ZENITH_SAVE_ROOT)"""
        folder = self._local(url) if url else ""
        if folder and not os.path.isdir(folder): self.said.emit("That folder does not exist."); return
        self._save_root_set = folder
        self._save_settings(); self.settingsChanged.emit()
        self.said.emit("Saves are read from %s." % folder if folder else "Saves are read from the usual place.")

    @Property("QVariantList", constant=True)
    def languages(self): return [{"code": c, "name": n} for c, n in LANGUAGES]

    # ---- news on Home and the roadmap page: shipped with the window (zenith_gui\news.json, roadmap.json) ----------
    def _staged(self, item, key):
        """a news post or roadmap line made ready for the window's stage: its pictures measured as a mod's are
        ("art": files under zenith_gui\\, or {"file", "focus", "tall", ...} as in known_mods.json), with an id, a
        monogram for the crest when it has none, and the kind the Library leaves alone"""
        art = item.get("art") or []
        entries = [a if isinstance(a, dict) else {"file": str(a)} for a in (art if isinstance(art, list) else [art])]
        title = str(item.get("title") or "")
        return dict(item, id=key, kind="ROADMAP", enabled=True, monogram=(title[:1] or "?").upper(),
                    arts=self._arts(HERE, entries) if entries else [])

    @Property("QVariantList", constant=True)
    def news(self):
        data = _read_json(os.path.join(HERE, "news.json"), {})
        items = data.get("items") if isinstance(data, dict) else None
        return [self._staged(i, "news:%d" % n) for n, i in enumerate(i for i in items or [] if isinstance(i, dict) and i.get("title"))][:12]

    @Property("QVariantMap", constant=True)
    def roadmap(self):
        data = _read_json(os.path.join(HERE, "roadmap.json"), {})
        if not (isinstance(data, dict) and data.get("columns")): return {}
        columns = [dict(c, items=[self._staged(i, "road:%d:%d" % (n, m)) for m, i in enumerate(c.get("items") or []) if isinstance(i, dict)])
                   for n, c in enumerate(data["columns"]) if isinstance(c, dict)]
        return dict(data, columns=columns)
