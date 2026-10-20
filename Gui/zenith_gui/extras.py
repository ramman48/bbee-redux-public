"""What the window works out without a screen (0.5.0): plain words for an error, the files a report collects, the
health check, play time from the mods' own logs, the Steam library shortcut, and the small records the window keeps
in its own data folder (presets, install history, when a mod arrived).

Nothing here starts the game or changes a mod: the controller calls these and decides."""
import binascii
import glob
import hashlib
import json
import os
import re
import shutil
import struct
import time
import zipfile

MB = 1048576


# ---- an error, in plain words, with what to do next (improvement 7) ------------------------------------------------
# the first rule whose pattern is found in the loader's or the updater's own words wins
_PLAIN = [
    (r"No connection|URLError|getaddrinfo|timed out|Connection(?:Reset|Refused|Aborted)Error|Temporary failure|"
     r"Name or service not known|could not reach",
     "No connection to the update server. Check your internet, then press CHECK NOW in Options."),
    (r"is running\. Close the game|game is open|close it completely|Close the game completely",
     "The game is open. Close it completely (check the taskbar), then press the button again."),
    (r"No space left|WinError 112|Errno 28|disk is full|not enough space",
     "The disk is full. Free some space on it (a few GB), then press the button again."),
    (r"PermissionError|Access is denied|WinError 5\b|WinError 32\b|being used by another process|Errno 13",
     "Windows would not let the Terminal change a file. Close the game, and any folder or program that has the "
     "Terminal's files open, then press the button again."),
    (r"SHA256|sha256|integrity check",
     "A download arrived damaged. Press CHECK NOW in Options to download it again."),
    (r"CONFLICT",
     "Two of your mods change the same part of the game and cannot go in together. Switch one of them off in the "
     "Library, then press the button again."),
    (r"game data|game_build|tables_report|read the game's data|setup first",
     "The game's data has to be read again. Options > General > READ AGAIN, then press the button again."),
    (r"not found|No such file|FileNotFoundError|cannot find",
     "A file the Terminal needs is missing. Press CHECK NOW in Options to bring it back, or run the health check."),
    (r"Traceback|Error|ERROR|BUILD ABORTED|REFUSING",
     "Something went wrong inside the loader. Press MAKE REPORT (Options > Saves and reports) and send the report "
     "on Discord."),
]


def plain_error(text):
    """the sentence a person reads first when a job stops; '' when there is nothing to explain"""
    text = str(text or "")
    if not text.strip(): return ""
    for pattern, said in _PLAIN:
        if re.search(pattern, text): return said
    return "The job stopped. Press MAKE REPORT (Options > Saves and reports) and send the report on Discord."


# ---- the files a report collects (improvement 6) ---------------------------------------------------------------------
def _tail(path, cap):
    """the last `cap` bytes of a file (a log can be several MB)"""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        if size > cap: f.seek(size - cap)
        return f.read()


def report_files(launcher, terminal, data_dir, game_data):
    """[(path, name in the zip)]: every mod log there is, wherever a mod writes it. The loader's own report holds its
    F9 reports and its newest logs; these are added beside them under extra/."""
    out = []
    for pattern in ("modlog*.txt", "*.log"):
        for path in sorted(glob.glob(os.path.join(launcher, pattern))):
            out.append((path, "extra/launcher/" + os.path.basename(path)))
    if game_data and os.path.isdir(game_data):                   # the game's own folder: Player.log, mods' own logs
        for pattern in ("*.log", "modlog*.txt"):                 # logs only: mods' own state files stay out
            for path in sorted(glob.glob(os.path.join(game_data, pattern))):
                out.append((path, "extra/game/" + os.path.basename(path)))     # a big Player.log goes in by its newest part (add_to_newest_zip)
    for rel in (("Updater", "log.txt"), ("Updater", "last_run.json"), ("Updater", "check_run.json"),
                ("Updater", "version.txt"), ("Gui", "version.txt"), ("package", "EDITION.txt")):
        path = os.path.join(terminal, *rel)
        if os.path.isfile(path): out.append((path, "extra/terminal/" + "_".join(rel)))
    for name in ("last_run.log", "settings.json", "install_history.json"):
        path = os.path.join(data_dir or "", name)
        if data_dir and os.path.isfile(path): out.append((path, "extra/window/" + name))
    return out


def add_to_newest_zip(folder, files, cap=8 * MB):
    """adds the files to the newest zip in the folder, each at most its last `cap` bytes. -> (zip path, count)"""
    zips = sorted(glob.glob(os.path.join(folder, "*.zip")), key=os.path.getmtime)
    if not zips: return "", 0
    count = 0
    with zipfile.ZipFile(zips[-1], "a", zipfile.ZIP_DEFLATED) as z:
        have = set(z.namelist())
        for path, name in files:
            if name in have: continue
            try: z.writestr(name, _tail(path, cap))
            except OSError: continue
            count += 1
    return zips[-1], count


# ---- play time and runs from the mods' own logs (addition: play stats) ---------------------------------------------
_STAMP = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)")


def _seconds(stamp):
    return time.mktime(time.strptime(stamp, "%Y-%m-%dT%H:%M:%S"))


def play_stats(logs, gap=1800):
    """What the mod logs say about the player's games: {"sessions", "hours", "battles", "runs", "last", "mods"}.
    A game starts at each 'ZENITH LIVE ready' line and lasts until its last line (a quiet gap of half an hour or more
    ends it too). Battles and runs count the lines the mods write for them, once a second. mods: the tags that wrote
    the most lines, as [[tag, lines]]."""
    sessions, battles, runs, tags = [], set(), set(), {}
    start = last = None
    for path in logs:
        try:
            f = open(path, encoding="utf-8", errors="replace")
        except OSError:
            continue
        with f:
            for line in f:
                m = _STAMP.match(line)
                if not m: continue
                stamp = m.group(1)
                rest = line[25:]
                word = rest.split(" ", 1)[0].strip("[]")
                if word: tags[word] = tags.get(word, 0) + 1
                try: at = _seconds(stamp)
                except ValueError: continue
                if "ZENITH LIVE ready" in rest or (last is not None and at - last > gap):
                    if start is not None and last is not None: sessions.append((start, last))
                    start = at
                elif start is None:
                    start = at
                last = at
                if "battle start" in rest: battles.add(stamp)
                if "run start" in rest: runs.add(stamp)
    if start is not None and last is not None: sessions.append((start, last))
    total = sum(max(0, b - a) for a, b in sessions)
    top = sorted(((t, n) for t, n in tags.items() if t not in ("ZENITH",)), key=lambda kv: -kv[1])[:5]
    return {"sessions": len(sessions), "hours": round(total / 3600.0, 1), "battles": len(battles), "runs": len(runs),
            "last": time.strftime("%Y-%m-%d %H:%M", time.localtime(sessions[-1][1])) if sessions else "",
            "mods": [[t, n] for t, n in top]}


# ---- the health check (addition) -------------------------------------------------------------------------------------
def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""): h.update(block)
    return h.hexdigest()


def read_manifest(path):
    """an updater state file: '<sha256>  <path>' lines -> {path: sha}"""
    out = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(None, 1)
                if len(parts) == 2 and re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]): out[parts[1]] = parts[0].lower()
    except OSError:
        pass
    return out


def damaged_files(folder, manifest):
    """the files of a mod that are missing or differ from what the updater put there"""
    bad = []
    for rel, sha in manifest.items():
        path = os.path.join(folder, *rel.replace("\\", "/").split("/"))
        if not os.path.isfile(path): bad.append(rel)
        elif sha256(path) != sha: bad.append(rel)
    return bad


def free_gb(path):
    try: return shutil.disk_usage(path).free / 1e9
    except OSError: return -1.0


def health(facts):
    """facts: {"game": folder or "", "build", "mark", "launcher", "terminal", "saves": folder, "mods": [mod dicts],
    "running": bool}. -> [{"name", "state": "ok" | "warn" | "bad", "text", "fix": action or ""}], in reading order."""
    out = []

    def row(name, state, text, fix=""):
        out.append({"name": name, "state": state, "text": text, "fix": fix})

    game = facts.get("game") or ""
    if not game: row("GAME FILES", "bad", "The game was not found. Press SET UP AND INSTALL and the Terminal looks for it.", "setup")
    elif not os.path.isfile(os.path.join(game, "BlazblueEntropyEffect.exe")):
        row("GAME FILES", "bad", "The game's program is missing from its folder. Verify the game's files in Steam.", "steamverify")
    else:
        data = os.path.join(game, "BlazblueEntropyEffect_Data", "StreamingAssets", "ab")
        ok = os.path.isfile(os.path.join(data, "merge.json"))
        row("GAME FILES", "ok" if ok else "bad", "Found, build %s." % (facts.get("build") or "?") if ok else
            "Part of the game's data is missing. Verify the game's files in Steam.", "" if ok else "steamverify")
    if game:
        same = facts.get("mark") == facts.get("build")
        row("GAME DATA READ", "ok" if same else "warn", "Read for this build of the game." if same else
            "Not read for this build yet. Read it again (a few minutes).", "" if same else "setup")
    for label, where in (("SPACE ON THE TERMINAL'S DISK", facts.get("terminal")), ("SPACE ON THE GAME'S DISK", game)):
        if not where: continue
        gb = free_gb(where)
        if gb < 0: continue
        state = "ok" if gb >= 5 else ("warn" if gb >= 2 else "bad")
        row(label, state, "%.1f GB free." % gb + ("" if state == "ok" else " An install needs about 2 GB; free some space."))
    mods = [m for m in facts.get("mods", []) if not m.get("locked")]
    missing = sorted({d for m in mods if m.get("enabled") for d in m.get("missing", [])})
    row("WHAT YOUR MODS NEED", "ok" if not missing else "bad",
        "Everything your mods need is here." if not missing else "Missing: %s. CHECK NOW brings them." % ", ".join(missing),
        "" if not missing else "checkupdates")
    state_dir = os.path.join(facts.get("terminal") or "", "Updater", "state")
    checked, damaged = 0, []
    for m in mods:
        manifest = read_manifest(os.path.join(state_dir, re.sub(r"[^\w\-]", "_", m["id"]) + ".files.txt"))
        if not manifest: continue
        checked += 1
        bad = damaged_files(m["folder"], manifest)
        if bad: damaged.append("%s (%d file%s)" % (m["title"], len(bad), "" if len(bad) == 1 else "s"))
    if checked:
        row("MOD FILES", "ok" if not damaged else "bad",
            "%d mod%s checked file by file: all as downloaded." % (checked, "" if checked == 1 else "s") if not damaged else
            "Changed or missing files: %s. CHECK NOW downloads them again." % ", ".join(damaged), "" if not damaged else "checkupdates")
    old = [m["title"] for m in mods if m.get("enabled") and not m.get("compatible", True)]
    if old: row("MADE FOR THIS GAME BUILD", "warn", "Checked on an older build of the game: %s. They may still work." % ", ".join(old))
    saves = facts.get("saves") or ""
    if saves:
        found = os.path.isdir(saves)
        row("YOUR SAVE", "ok" if found else "warn", "Found." if found else
            "No save folder yet. Start the game once, then come back.")
    row("THE GAME IS", "warn" if facts.get("running") else "ok",
        "Open. Close it before an install." if facts.get("running") else "Closed.")
    return out


# ---- the Steam library: the Terminal as a non-Steam game (addition: Steam) -----------------------------------------
def steam_folder():
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as k:
            return os.path.normpath(winreg.QueryValueEx(k, "SteamPath")[0])
    except (ImportError, OSError):
        for guess in (r"C:\Program Files (x86)\Steam", os.path.expanduser("~/.steam/steam"), os.path.expanduser("~/.local/share/Steam")):
            if os.path.isdir(guess): return guess
    return ""


def steam_user(steam):
    """the userdata folder of the account that signed in last (loginusers.vdf MostRecent), else the newest one"""
    users = os.path.join(steam, "userdata")
    if not os.path.isdir(users): return ""
    try:
        text = open(os.path.join(steam, "config", "loginusers.vdf"), encoding="utf-8", errors="replace").read()
        for sid, body in re.findall(r'"(\d{17})"\s*\{([^}]*)\}', text):
            if re.search(r'"MostRecent"\s+"1"', body):
                folder = os.path.join(users, str(int(sid) - 76561197960265728))
                if os.path.isdir(folder): return folder
    except OSError:
        pass
    found = [os.path.join(users, n) for n in os.listdir(users) if n.isdigit() and n != "0"]
    return max(found, key=os.path.getmtime) if found else ""


def _vdf_read(data, at=0):
    """binary VDF (shortcuts.vdf): a map of maps, strings and 32-bit numbers -> (dict, position after it)"""
    out = {}
    while at < len(data):
        kind = data[at]; at += 1
        if kind == 8: return out, at
        end = data.index(b"\x00", at); key = data[at:end].decode("utf-8", "replace"); at = end + 1
        if kind == 0: out[key], at = _vdf_read(data, at)
        elif kind == 1:
            end = data.index(b"\x00", at); out[key] = data[at:end].decode("utf-8", "replace"); at = end + 1
        elif kind == 2: out[key] = struct.unpack_from("<i", data, at)[0]; at += 4
        else: raise ValueError("unknown kind %d in shortcuts.vdf" % kind)
    return out, at


def _vdf_write(node):
    out = b""
    for key, value in node.items():
        k = key.encode("utf-8") + b"\x00"
        if isinstance(value, dict): out += b"\x00" + k + _vdf_write(value) + b"\x08"
        elif isinstance(value, int): out += b"\x02" + k + struct.pack("<i", value)
        else: out += b"\x01" + k + str(value).encode("utf-8") + b"\x00"
    return out


def shortcut_id(exe, name):
    """the id Steam gives a non-Steam game (the same formula Steam uses, as a signed 32-bit number)"""
    crc = binascii.crc32((exe + name).encode("utf-8")) | 0x80000000
    return struct.unpack("<i", struct.pack("<I", crc))[0]


def add_steam_shortcut(user, exe, name, icon=""):
    """Adds the Terminal to Steam's library as a non-Steam game (or updates the entry it added before). Steam must be
    closed: it writes the file back when it exits. The file is copied to shortcuts.vdf.zenith.bak first.
    -> "added" | "updated" """
    path = os.path.join(user, "config", "shortcuts.vdf")
    root = {"shortcuts": {}}
    if os.path.isfile(path):
        data = open(path, "rb").read()
        if data:
            root, _ = _vdf_read(data)
            shutil.copy2(path, path + ".zenith.bak")
    items = root.setdefault("shortcuts", {})
    quoted = '"%s"' % exe
    entry = {"appid": shortcut_id(quoted, name), "AppName": name, "Exe": quoted,
             "StartDir": '"%s"' % os.path.dirname(exe), "icon": icon, "ShortcutPath": "", "LaunchOptions": "",
             "IsHidden": 0, "AllowDesktopConfig": 1, "AllowOverlay": 1, "OpenVR": 0, "Devkit": 0, "DevkitGameID": "",
             "DevkitOverrideAppID": 0, "LastPlayTime": 0, "FlatpakAppID": "", "tags": {}}
    for key, item in items.items():
        if isinstance(item, dict) and str(item.get("AppName", item.get("appname", ""))) == name:
            item.update(entry)
            said = "updated"
            break
    else:
        items[str(len(items))] = entry
        said = "added"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f: f.write(b"\x00shortcuts\x00" + _vdf_write(items) + b"\x08\x08")
    return said


def in_steam(user, name):
    path = os.path.join(user, "config", "shortcuts.vdf")
    try:
        root, _ = _vdf_read(open(path, "rb").read())
    except (OSError, ValueError, IndexError, struct.error):
        return False
    return any(isinstance(i, dict) and str(i.get("AppName", i.get("appname", ""))) == name for i in root.get("shortcuts", {}).values())


# ---- the window's small records ---------------------------------------------------------------------------------------
def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f: return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: json.dump(value, f, indent=1)
    os.replace(tmp, path)


def save_backups(folder):
    """the save copies in save_backups, newest first: [{"id", "when", "why"}] (the folder names are
    <yyyymmdd>_<hhmmss>_<reason>)"""
    out = []
    for name in sorted(os.listdir(folder), reverse=True) if os.path.isdir(folder) else []:
        m = re.match(r"^(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)(\d\d)_?(.*)$", name)
        if not m or not os.path.isdir(os.path.join(folder, name)): continue
        why = {"before_install": "before an install", "before_uninstall": "before an uninstall", "before_repair": "before a repair",
               "manual": "made by you", "before_restore": "before a restore"}.get(m.group(7), m.group(7).replace("_", " ") or "a copy")
        out.append({"id": name, "when": "%s-%s-%s %s:%s" % m.groups()[:5], "why": why})
    return out


def restore_save(backup, save_root):
    """Puts a save copy back: each account folder in the copy (Steam, XBoxPc, Global) replaces the one in the game's
    save area. The caller has made a fresh copy of the current save first. -> how many folders went back"""
    count = 0
    for sub in ("Steam", "XBoxPc", "Global"):
        src = os.path.join(backup, sub)
        if not os.path.isdir(src): continue
        dst = os.path.join(save_root, sub)
        if os.path.isdir(dst): shutil.rmtree(dst)
        shutil.copytree(src, dst)
        count += 1
    return count
