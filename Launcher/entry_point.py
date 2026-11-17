r"""entry_point.py -- one-command setup / install / uninstall for the Mods package.

  python entry_point.py setup [<game folder>]   check Python + packages, link the game folder, read the game data
                                               (once, and again after each game update)
  python entry_point.py install                 build and install the mods (game must be closed); only the mods that
                                               changed are built again
  python entry_point.py install --full          the same, every mod built again
  python entry_point.py live                    add or update mods while the game is open (nothing switched off)
  python entry_point.py uninstall               SAFE uninstall: back up your save, remove mod-character data from it,
                                               then remove every mod and restore the original game files (game closed)
  python entry_point.py repair-save             only the save part (for a save that won't load in the normal game
                                               because it still has mod-character data); backs up first
  python entry_point.py backup-save             copy your save folder into save_backups\ (any time)
  python entry_point.py status                  what is installed
  python entry_point.py feedback                zip your latest F9 reports + a session report into feedback\ to send

The .bat files next to this script run these commands. Nothing here uploads anything anywhere.
"""
import os, sys, subprocess, shutil, glob, time, zipfile, re, json

ROOT = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(ROOT, "game")
AB = os.path.join(GAME, "BlazblueEntropyEffect_Data", "StreamingAssets", "ab")
BUILD_MARK = os.path.join(ROOT, "inspect", "game_build.txt")
EXE = "BlazblueEntropyEffect.exe"
FOLDER = "BlazblueEntropyEffect"
APPID = "2273430"
BBCF_FOLDER = "BlazBlue Centralfiction"
PKGS = [("UnityPy", "UnityPy"), ("lz4", "lz4"), ("PIL", "Pillow"), ("numpy", "numpy")]


def say(*a): print(*a); sys.stdout.flush()
def fail(msg):
    say(""); say("PROBLEM: " + msg); say("See docs\\TROUBLESHOOTING.md."); sys.exit(1)


def game_running():
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq " + EXE], capture_output=True, text=True).stdout
        return EXE.lower() in out.lower()
    except Exception:
        return False


def need_closed():
    if game_running(): fail("BlazBlue Entropy Effect is running. Close the game completely, then run this again.")


def steam_libraries():
    libs = []
    try:
        import winreg
        for hive, key in ((winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam"),
                          (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam")):
            try:
                with winreg.OpenKey(hive, key) as k:
                    for name in ("SteamPath", "InstallPath"):
                        try: libs.append(os.path.normpath(winreg.QueryValueEx(k, name)[0]))
                        except OSError: pass
            except OSError: pass
    except ImportError: pass
    libs.append(r"C:\Program Files (x86)\Steam")
    more = []
    for s in libs:
        vdf = os.path.join(s, "steamapps", "libraryfolders.vdf")
        if os.path.exists(vdf):
            for m in re.finditer(r'"path"\s+"([^"]+)"', open(vdf, encoding="utf-8", errors="replace").read()):
                more.append(os.path.normpath(m.group(1).replace("\\\\", "\\")))
    seen, out = set(), []
    for p in libs + more:
        if p.lower() not in seen: seen.add(p.lower()); out.append(p)
    return out


def linux_steam_libraries(drive=None):
    """Steam's libraries on a Linux PC, seen from Wine or Proton (the Linux disk is drive Z:): each user's Steam folder
    (native, the Debian link, Flatpak, Snap) and the libraries its list names, their Linux paths turned into Z: paths."""
    drive = drive or os.environ.get("ZENITH_LINUX_ROOT") or "Z:\\"
    home = os.path.join(drive, "home")
    if not os.path.isdir(home): return []
    out = []
    def add(p):
        if os.path.isdir(os.path.join(p, "steamapps")) and p.lower() not in [o.lower() for o in out]: out.append(p)
    try: users = os.listdir(home)
    except OSError: users = []
    for u in users:
        for rel in (".steam/steam", ".steam/root", ".local/share/Steam", ".steam/debian-installation",
                    ".var/app/com.valvesoftware.Steam/.local/share/Steam", ".var/app/com.valvesoftware.Steam/.steam/steam",
                    "snap/steam/common/.local/share/Steam"):
            p = os.path.join(home, u, *rel.split("/"))
            add(p)
            vdf = os.path.join(p, "steamapps", "libraryfolders.vdf")
            if os.path.exists(vdf):
                for m in re.finditer(r'"path"\s+"([^"]+)"', open(vdf, encoding="utf-8", errors="replace").read()):
                    lp = m.group(1)
                    if lp.startswith("/"): add(os.path.join(drive, *[x for x in lp.split("/") if x]))
    return out


def find_game():
    def has(g): return bool(g) and os.path.exists(os.path.join(g, EXE))
    libs = steam_libraries()
    for p in linux_steam_libraries():
        if p.lower() not in [l.lower() for l in libs]: libs.append(p)
    # the usual library folders on every drive (a library Steam's own list does not name: a moved or copied library,
    # a Steam the registry does not know)
    for d in "CDEFGHIJKLMNOPQRSTUVWXYZ":
        root = d + ":" + os.sep
        if not os.path.isdir(root): continue
        for rel in ("SteamLibrary", "Steam", "Games\\Steam", "Games\\SteamLibrary", "Program Files (x86)\\Steam", "Program Files\\Steam"):
            p = os.path.join(root, rel)
            if os.path.isdir(os.path.join(p, "steamapps")) and p.lower() not in [l.lower() for l in libs]: libs.append(p)
    for lib in libs:
        g = os.path.join(lib, "steamapps", "common", FOLDER)
        if has(g): return g
        # the folder name Steam itself recorded for the game
        try:
            acf = open(os.path.join(lib, "steamapps", "appmanifest_%s.acf" % APPID), encoding="utf-8", errors="replace").read()
            m = re.search(r'"installdir"\s+"([^"]+)"', acf)
            if m and has(os.path.join(lib, "steamapps", "common", m.group(1))): return os.path.join(lib, "steamapps", "common", m.group(1))
        except OSError: pass
    # Windows' own record of the Steam game
    try:
        import winreg
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for key in (r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App " + APPID,
                        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Steam App " + APPID):
                try:
                    with winreg.OpenKey(hive, key) as k:
                        g = os.path.normpath(winreg.QueryValueEx(k, "InstallLocation")[0])
                        if has(g): return g
                except OSError: pass
    except ImportError: pass
    return None


def find_bbcf():
    """the player's own BlazBlue Centralfiction, if installed (BBCF_DIR overrides the search). Optional."""
    if os.environ.get("BBCF_DIR"): return os.environ["BBCF_DIR"]
    for lib in steam_libraries():
        g = os.path.join(lib, "steamapps", "common", BBCF_FOLDER)
        if os.path.exists(os.path.join(g, "data", "Char", "char_ph_img.pac")): return g
    return None


def installed_build():
    """the Steam build id of the linked game: from Steam's app manifest next to it, else from its GameAssembly.dll
    (pipeline.build_from_files), else None"""
    try:
        acf = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(GAME))), "appmanifest_%s.acf" % APPID)
        return re.search(r'"buildid"\s+"(\d+)"', open(acf, encoding="utf-8", errors="replace").read()).group(1)
    except Exception:
        pass
    try:
        import hashlib
        digest = hashlib.sha1(open(os.path.join(os.path.realpath(GAME), "GameAssembly.dll"), "rb").read()).hexdigest()
        base = os.path.join(ROOT, "tools", "schema")
        for b in sorted(os.listdir(base), reverse=True):
            p = os.path.join(base, b, "gameassembly.sha1")
            if os.path.exists(p) and open(p, encoding="utf-8").read().strip() == digest: return b
    except Exception:
        pass
    return None


def setup(args):
    say("== The Zenith Terminal: setup ==")
    if sys.version_info < (3, 10): fail("Python 3.10 or newer is needed (you have %s)." % sys.version.split()[0])
    say("Python %s  ok" % sys.version.split()[0])
    missing = []
    for mod, pkg in PKGS:
        try: __import__(mod)
        except ImportError: missing.append(pkg)
    if missing:
        say("Installing Python packages: " + ", ".join(missing))
        r = subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade"] + missing)
        if r.returncode != 0:
            # "Microsoft Visual C++ 14.0 or greater is required" above means pip found no ready-made build of a package
            # for this Python (usually a Python newer than the package) and tried to compile it. No one needs the compiler.
            fail("pip could not install %s for your Python %s.\n"
                 "  If the lines above ask for \"Microsoft Visual C++\" or \"Build Tools\": this Python is too new for one of\n"
                 "  the packages. You do not need to install those tools. Do one of these:\n"
                 "   - use The Zenith Terminal's .exe or zip: it brings its own Python and needs nothing installed;\n"
                 "   - or install Python 3.14 from python.org and run this setup again.\n"
                 "  Anything else (no internet, antivirus): try  py -m pip install %s"
                 % (" ".join(missing), sys.version.split()[0], " ".join(missing)))
    say("Python packages  ok")
    if shutil.which("node") is None:
        say("Node.js not found  (optional: only used to double-check scripts; you can skip it)")

    if os.path.exists(os.path.join(GAME, EXE)):
        say("Game folder link  ok -> " + os.path.realpath(GAME))
    else:
        g = args[0] if args else find_game()
        if not g or not os.path.exists(os.path.join(g, EXE)):
            fail("Couldn't find the game. In the Terminal: Options > General > FIND THE GAME BY HAND, and choose the folder\n"
                 "that contains %s (in Steam: right-click the game > Manage > Browse local files).\n"
                 "Without the Terminal's window:  python entry_point.py setup \"<your game folder>\"" % EXE)
        if os.path.lexists(GAME): fail("There is already a 'game' entry in %s that doesn't point to the game. Delete it and run setup again." % ROOT)
        r = subprocess.run(["cmd", "/c", "mklink", "/J", GAME, g], capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(os.path.join(GAME, EXE)):
            fail("Couldn't create the folder link (%s). Put this folder on the same drive as your user folder, or run as administrator." % (r.stderr or r.stdout).strip())
        say("Game folder link  created -> " + g)
    if not os.path.exists(os.path.join(os.path.realpath(GAME), "..", "..", "appmanifest_%s.acf" % APPID)):
        say("Note: Steam's app manifest wasn't found next to the game; the build is read from the game's own files"
            + (" (build %s)." % installed_build() if installed_build() else ": they match no build the mods are made for."))
    else:
        say("Game build  " + str(installed_build()))
    need_closed()
    say(""); say("Reading the game data (takes a few minutes, only needed once and after each game update)...")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "pipeline.py")], cwd=ROOT)
    if r.returncode != 0: fail("Reading the game data failed (see the messages above).")
    if installed_build():
        open(BUILD_MARK, "w", encoding="utf-8").write(installed_build())
    say(""); say("Setup done. Next: close the game (if open) and run 2_INSTALL.bat  (or: python entry_point.py install)")


def bbmod(cmd, *extra):
    return subprocess.run([sys.executable, os.path.join(ROOT, "bbmod.py"), cmd] + list(extra), cwd=ROOT).returncode


def retire_stale_backups():
    """After a game update Steam replaces the game's index files (merge.json, manifest) but leaves the installer's
    backups of the OLD ones next to them, and the installer refuses to work with a backup from another build.
    When the live index is the game's own (no mod entries in it), those old backups are set aside -- renamed, never
    deleted -- so the next install takes a fresh pair from the current game. (docs/BUILD_UPDATE.md, step 1.)"""
    build = installed_build()
    if not build or not os.path.exists(os.path.join(AB, "merge.json")): return
    stale = []
    for name in ("merge.json", "manifest"):
        bak = os.path.join(AB, name + ".orig")
        if not os.path.exists(bak): continue
        st = bak + ".build"
        stamp = open(st, encoding="utf-8").read().strip() if os.path.exists(st) else ""
        if stamp != build: stale.append((bak, stamp or "old"))
    if not stale: return
    if '"m_mod.m"' in open(os.path.join(AB, "merge.json"), encoding="utf-8", errors="replace").read():
        fail("The game is build %s, but its files still point at mod data from an older build.\n"
             "In Steam: right-click the game > Properties > Installed Files > Verify integrity of game files.\n"
             "Then run 1_SETUP.bat and this step again." % build)
    for bak, stamp in stale:
        for p in (bak, bak + ".build"):
            if not os.path.exists(p): continue
            dst = p + ".b" + stamp; n = 1
            while os.path.exists(dst): n += 1; dst = "%s.b%s_%d" % (p, stamp, n)
            os.rename(p, dst)
    say("The game was updated since the last install (now build %s): the installer's old backups were set aside." % build)


# ZENITH_SAVE_ROOT: the game's save area when it is not under this user's profile (Proton, Bottles)
WIN_SAVE_ROOT = os.path.expandvars(r"%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect")
PROTON_SAVES = ("steamapps", "compatdata", "2273430", "pfx", "drive_c", "users", "steamuser", "AppData", "LocalLow", "91Act",
                "BlazblueEntropyEffect")


def _save_dirs(root):
    """every <...>/Save folder with numbered slot files at or below root (up to 3 levels: the save area, its Steam
    folder, an account folder, or the Save folder itself)"""
    out = []
    if not root or not os.path.isdir(root): return out
    def has_slots(d): return any(f.isdigit() and os.path.isfile(os.path.join(d, f)) for f in os.listdir(d))
    if os.path.basename(os.path.normpath(root)).lower() == "save" and has_slots(root): return [root]
    for pat in ("Save", os.path.join("*", "Save"), os.path.join("*", "*", "Save")):
        for d in glob.glob(os.path.join(root, pat)):
            if os.path.isdir(d) and has_slots(d) and d not in out: out.append(d)
    return out


def find_save_root():
    """the save area: the folder chosen in the Terminal (any level down to a Save folder), else the usual Windows place
    when it holds saves, else Steam's Proton prefix for the game on a Linux library (2026-11-16)"""
    chosen = os.environ.get("ZENITH_SAVE_ROOT")
    if chosen: return chosen
    if _save_dirs(WIN_SAVE_ROOT): return WIN_SAVE_ROOT
    try:
        for lib in linux_steam_libraries():
            p = os.path.join(lib, *PROTON_SAVES)
            if _save_dirs(p): return p
    except Exception: pass
    return WIN_SAVE_ROOT


SAVE_ROOT = None   # set on first use (find_save_root needs the Steam library search below)


def _root():
    global SAVE_ROOT
    if SAVE_ROOT is None: SAVE_ROOT = find_save_root()
    return SAVE_ROOT


def backup_save(tag):
    """copy the save area (every account, its Save, Backup and ColdBackup) into save_backups/<time>_<tag>; a folder
    chosen below the save area (an account or a Save folder) is copied as it is"""
    import shutil
    root = _root()
    if not os.path.isdir(root): say("No save folder found yet (%s); nothing to back up." % root); return None
    dst = os.path.join(ROOT, "save_backups", time.strftime("%Y%m%d_%H%M%S") + "_" + tag)
    subs = [sub for sub in ("Steam", "XBoxPc", "Global") if os.path.isdir(os.path.join(root, sub))]
    if subs:
        for sub in subs: shutil.copytree(os.path.join(root, sub), os.path.join(dst, sub))
    else:
        shutil.copytree(root, os.path.join(dst, os.path.basename(os.path.normpath(root)) or "saves"))
    say("Save backed up to: " + dst)
    return dst


def save_files():
    """the files the game loads your progress from: each Save/<slot> and Save/Backup/<slot> under the save area"""
    out = []
    for d in _save_dirs(_root()):
        for f in glob.glob(os.path.join(d, "*")) + glob.glob(os.path.join(d, "Backup", "*")):
            if os.path.isfile(f) and os.path.basename(f).isdigit(): out.append(f)
    return out


def repair_save(args, backup=True):
    """remove every mod-added character from the save, so the normal game can
    load it. Everything else in the save stays exactly as it was."""
    need_closed()
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import savefile
    files = save_files()
    if not files: say("No save files found under " + _root()); return
    if backup and not backup_save("before_repair"): fail("Couldn't back up the save; nothing was changed.")
    changed = 0
    for f in files:
        try: rep_ = savefile.clean_file(f, grim=True)   # every mod goes: Grim of the Abyss's Entropy ids too
        except Exception as e: fail("Couldn't clean %s (%s). Your save is unchanged; the backup is in the save_backups folder." % (f, e))
        if rep_:
            changed += 1; say(""); say("Cleaned " + f + ":")
            for line in rep_: say("  - " + line)
    say("")
    say("Save repaired: %d file(s) cleaned." % changed if changed else "Your save has no mod-character data; nothing to change.")
    say("If Steam asks about a cloud save conflict on the next launch, choose the LOCAL save (the repaired one).")


def enabled_mods():
    """ids of the mods switched on (shared/profile.json, mods/profile.json)"""
    enabled = set()
    for p in (os.path.join(ROOT, "shared", "profile.json"), os.path.join(ROOT, "mods", "profile.json")):
        if os.path.exists(p):
            try: enabled |= set(json.load(open(p, encoding="utf-8")).get("enabled", []))
            except Exception: pass
    return enabled


def enabled_actor_ids():
    """ids of the characters the enabled mods add (the same rule tools/savefile.py uses for mods/*/mod.json)"""
    ids = set()
    for mid in enabled_mods():
        for folder in (os.path.join(ROOT, "shared", mid), os.path.join(ROOT, "mods", mid)):
            try: txt = open(os.path.join(folder, "mod.json"), encoding="utf-8").read()
            except OSError: continue
            ids |= {int(n) for n in re.findall(r'"ActorId":\s*(\d{6})', txt) if int(n) >= 190000}
    return ids


def clean_missing(savefile, data, gone):
    """-> (new save data, report lines) with every reference to the characters in `gone` removed, or (None, []) when
    the save has none. Characters outside `gone` are left exactly as they are."""
    keep = savefile.MOD_ACTORS; savefile.MOD_ACTORS = set(gone)
    try:
        structural = savefile.scan_custom(data)
        if not (structural or savefile.pattern_hits(data)): return None, []
        try: new, rep_ = savefile.clean(data)
        except RuntimeError:
            if structural: raise
            return None, []
        return (new, rep_) if rep_ else (None, [])
    finally:
        savefile.MOD_ACTORS = keep


def drop_grim(savefile):
    """Grim of the Abyss is off in this install: its Abyss ranks, perks and Mutations come out of the Entropy loadout
    (the normal game wipes a loadout that holds one), and a run in progress that uses its rules is ended. The save has
    just been backed up; everything else in it stays as it was."""
    for f in save_files():
        try:
            new, rep_ = savefile.clean_grim(savefile.load(f))
            if not rep_: continue
            blob = savefile.compress(new)
            tmp = f + ".tmp"; open(tmp, "wb").write(blob); os.replace(tmp, f)
        except Exception as e:
            fail("Your save has Grim of the Abyss data, and it couldn't be removed (%s: %s).\n"
                 "Nothing in the game was changed, and your save is backed up in the save_backups folder." % (f, e))
        say(""); say("Grim of the Abyss is off, so its Entropy settings were taken out of your save.")
        say("Removed from " + f + ":")
        for line in rep_: say("  - " + line)


def drop_missing_characters():
    """A save can hold a character that an earlier package installed and this one doesn't, for example (Izanami, the
    unfinished preview in 0.7.x). The game can't load a save that names a character it doesn't have, so before
    installing, those entries are removed. The save has just been backed up; everything else in it, Nine included,
    stays as it was."""
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import savefile
    if "entropy-grim" not in enabled_mods(): drop_grim(savefile)
    gone = set(savefile.MOD_ACTORS) - enabled_actor_ids()
    if not gone: return
    for f in save_files():
        try:
            new, rep_ = clean_missing(savefile, savefile.load(f), gone)
            if new is None: continue
            blob = savefile.compress(new)
            tmp = f + ".tmp"; open(tmp, "wb").write(blob); os.replace(tmp, f)
        except Exception as e:
            fail("Your save has data for a character this package doesn't install, and it couldn't be removed (%s: %s).\n"
                 "Nothing in the game was changed, and your save is backed up in the save_backups folder." % (f, e))
        say(""); say("This package doesn't include a character your save has data for.")
        say("Removed from " + f + ":")
        for line in rep_: say("  - " + line)


def retired_ids():
    """The mods the channel's list retires: its '#retired: <id>' lines (Updater/repositories.txt)."""
    ids = set()
    try:
        for line in open(os.path.join(os.path.dirname(ROOT), "Updater", "repositories.txt"), encoding="utf-8"):
            line = line.strip()
            if line.lower().startswith("#retired:"): ids.update(line[len("#retired:"):].replace(",", " ").split())
    except Exception: pass
    return ids


def tidy_profile():
    """The switched-on list, before the loader reads it: retired mods are switched off (their files stay); a mod whose
    files are missing is set aside, and switched back on in its old place once its files are there."""
    mods = os.path.join(ROOT, "mods"); prof = os.path.join(mods, "profile.json"); aside = os.path.join(mods, "set_aside.json")
    try: data = json.load(open(prof, encoding="utf-8"))
    except Exception: return
    enabled = [m for m in data.get("enabled", []) if isinstance(m, str)]
    def there(m): return any(os.path.isfile(os.path.join(ROOT, d, m, "mod.json")) for d in ("mods", "shared"))
    try: was = json.load(open(aside, encoding="utf-8"))
    except Exception: was = {}
    order, waiting = was.get("order", []), [m for m in was.get("waiting", []) if m not in enabled]
    back = [m for m in waiting if there(m)]
    if back:
        ranked = [m for m in order if m in enabled or m in back]
        enabled = ranked + [m for m in enabled if m not in ranked]
        waiting = [m for m in waiting if m not in back]
        for m in back: say("'%s' has its files again: switched back on." % m)
    retired = retired_ids(); new = []
    for m in enabled:
        if m in retired: say("'%s' is not part of this release any more: switched off (its files are kept)." % m)
        elif not there(m):
            say("'%s' is switched on but its files are missing: left out of this install. Press CHECK NOW in Options to download it again, then apply." % m)
            waiting.append(m)
        else: new.append(m)
    if waiting and not order: order = list(data.get("enabled", []))
    if new != data.get("enabled", []):
        data["enabled"] = new
        with open(prof + ".new", "w", encoding="utf-8") as f: json.dump(data, f, indent=1)
        os.replace(prof + ".new", prof)
    if waiting:
        with open(aside, "w", encoding="utf-8") as f: json.dump({"order": order, "waiting": waiting}, f, indent=1)
    elif os.path.exists(aside): os.remove(aside)


def install(args):
    if not os.path.exists(os.path.join(GAME, EXE)): fail("Setup hasn't been run yet (no game folder link). Run 1_SETUP.bat first.")
    if not os.path.isdir(os.path.join(ROOT, "decoded", "tables")): fail("The game data hasn't been read yet. Run 1_SETUP.bat first.")
    need_closed()
    now = installed_build(); read = open(BUILD_MARK, encoding="utf-8").read().strip() if os.path.exists(BUILD_MARK) else None
    if now and read != now:
        fail("The game data in this folder was read from %s, and the game is now build %s.\n"
             "Run 1_SETUP.bat again, then 2_INSTALL.bat." % ("game build " + read if read else "an earlier setup", now))
    tidy_profile()
    retire_stale_backups()
    backup_save("before_install")
    drop_missing_characters()
    cf = find_bbcf()
    if cf:
        os.environ["BBCF_DIR"] = cf
        say("BlazBlue Centralfiction found: " + cf + "  (used for her Centralfiction animations if this Steam account owns it)")
    else:
        say("BlazBlue Centralfiction not found: her moves use her Entropy Effect animations (nothing is missing).")
    full = "--full" in args
    say("== building and installing (%s) ==" % ("everything made again here: a few minutes" if full else
                                                "the channel's ready-made build where it fits, only what changed otherwise"))
    t0 = time.time(); done = os.path.join(ROOT, "mods", "installed.json")
    if bbmod("install", *(["--full"] if full else [])) != 0: fail("The install stopped with an error (see above).")
    if not os.path.exists(done) or os.path.getmtime(done) < t0 - 2:
        fail("The install did not finish (see the messages above; a line starting with REFUSING or BUILD ABORTED says why).")
    say(""); say("Installed. Start the game normally from Steam. Yhe new characters are at the end of the Prototype list.")


def live(args):
    """Add or update mods while the game is open (an online lobby needs a character this PC lacks). The save is not
    touched: the game holds it while it runs. Switching a mod off still needs the game closed."""
    if not os.path.exists(os.path.join(GAME, EXE)): fail("Setup hasn't been run yet (no game folder link). Run 1_SETUP.bat first.")
    now = installed_build(); read = open(BUILD_MARK, encoding="utf-8").read().strip() if os.path.exists(BUILD_MARK) else None
    if now and read != now:
        fail("The game was updated since its data was read (build %s, now %s). Close the game, run 1_SETUP.bat, then 2_INSTALL.bat."
             % (read or "?", now))
    say("== updating the mods while the game is open ==")
    rc = bbmod("live", *args)
    if rc == 2: fail("This change needs the game closed (see the line starting with LIVE REFUSED). Close the game, then install.")
    if rc == 1: fail("The update stopped with an error (see above). The game was not changed.")
    if rc == 3: say(""); say("Restart the game to finish (the line starting with \"LIVE: restart\" says why). Everything is in place.")
    else: say(""); say("Done. In an open game, pick the character again (or go back to the lobby) to see the new version; "
                       "a game started later has it from the start.")


def uninstall(args):
    """SAFE uninstall. The normal game can't load a save that still has Modded Characters in it (their Evotypes, records,
    a run with them), so the save is backed up and cleaned FIRST, then the mods are removed."""
    need_closed()
    say("== safe uninstall ==")
    say("The Evotypes and records will be removed from your save (the normal game can't load them).")
    say("Everything else stays. A full copy of your save goes to the save_backups folder first.")
    repair_save(args)
    if os.path.exists(os.path.join(GAME, EXE)): retire_stale_backups()
    if bbmod("uninstall") != 0: fail("Removing the mod stopped with an error (see above). Your save was already repaired.")
    say(""); say("All mods removed and your save is ready for the normal game.")
    say("If anything still looks modded, use Steam > Verify integrity of game files.")


def backup_only(args):
    tag = args[0] if args and args[0].replace("_", "").isalnum() else "manual"
    need_closed(); backup_save(tag)


def status(args):
    bbmod("status")


def feedback(args):
    say("== collecting feedback files ==")
    bbmod("report")
    os.makedirs(os.path.join(ROOT, "feedback"), exist_ok=True)
    out = os.path.join(ROOT, "feedback", "TheZenithTerminal%s.zip" % time.strftime("%Y%m%d_%H%M%S"))
    diag = sorted(glob.glob(os.path.join(ROOT, "diag", "report_*")), key=os.path.getmtime)[-20:]
    reps = sorted(glob.glob(os.path.join(ROOT, "reports", "*.md")), key=os.path.getmtime)[-1:]
    extra = [p for p in (os.path.join(ROOT, "mods", "installed.json"), os.path.join(ROOT, "modlog.txt"),
                         os.path.join(ROOT, "inspect", "tables_report.txt")) if os.path.exists(p)]
    extra += sorted(glob.glob(os.path.join(ROOT, "logs", "*.log")), key=os.path.getmtime)[-5:]
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in diag + reps + extra: z.write(p, os.path.relpath(p, ROOT))
        z.writestr("versions.txt", "\n".join("%s %s" % (json.load(open(m, encoding="utf-8")).get("id"), json.load(open(m, encoding="utf-8")).get("version"))
                                             for m in glob.glob(os.path.join(ROOT, "mods", "*", "mod.json"))))
    say("F9 reports included: %d" % len(diag))
    if not diag: say("(No F9 reports yet. Press F9 in battle right after something goes wrong, then run this again.)")
    say(""); say("Send this file with your notes:"); say("  " + out)


CMDS = {"setup": setup, "install": install, "uninstall": uninstall, "status": status, "feedback": feedback,
        "repair-save": repair_save, "backup-save": backup_only, "live": live}
LOGS = os.path.join(ROOT, "logs")
def logged(argv):
    """Run this same command as a child and copy everything it and its own children print into
    logs\\<command>_<time>.log as well as onto the console. The 20 newest logs are kept."""
    os.makedirs(LOGS, exist_ok=True)
    path = os.path.join(LOGS, "%s_%s.log" % (argv[0], time.strftime("%Y%m%d_%H%M%S")))
    env = dict(os.environ, ZENITH_LOGGED="1", PYTHONUNBUFFERED="1")
    out = getattr(sys.stdout, "buffer", None)
    with open(path, "wb") as log:
        log.write(("The Zenith Terminal: %s, started %s\r\n" % (" ".join(argv), time.strftime("%Y-%m-%d %H:%M:%S"))).encode("utf-8"))
        p = subprocess.Popen([sys.executable, os.path.abspath(__file__)] + argv, cwd=os.getcwd(), env=env,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for line in p.stdout:
            log.write(line); log.flush()
            if out: out.write(line); out.flush()
            else: sys.stdout.write(line.decode("utf-8", "replace")); sys.stdout.flush()
        code = p.wait()
        log.write(("exit code %d, ended %s\r\n" % (code, time.strftime("%Y-%m-%d %H:%M:%S"))).encode("utf-8"))
    for old in sorted(glob.glob(os.path.join(LOGS, "*.log")), key=os.path.getmtime)[:-20]:
        try: os.remove(old)
        except OSError: pass
    return code


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in CMDS: say(__doc__); sys.exit(2)
    if sys.argv[1] != "status" and not os.environ.get("ZENITH_LOGGED"): sys.exit(logged(sys.argv[1:]))
    CMDS[sys.argv[1]](sys.argv[2:])
