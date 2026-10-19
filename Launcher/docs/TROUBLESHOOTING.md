# Troubleshooting

Run **`STATUS.bat`** first. Its first line shows your game build and whether the mod is installed.

## After a Steam game update

A Steam update replaces the game's index files, which switches the mod off. The game then runs without Nine, **and it can't load a save that still has Nine in it**: it reports the save as corrupted.

After the game updates, before you play:

1. Check the build: `STATUS.bat` shows it on its first line. This package was made for the build named in [README.md](../README.md).
2. Then do one of these:
   - **Keep playing Nine:** run `1_SETUP.bat`, then `2_INSTALL.bat`. Setup reads the new game data. If setup says there is **no schema snapshot for game build …**, the game is newer than this package: get the updated package, or use the next option until there is one.
   - **Play without the mod for now:** run `REPAIR_SAVE.bat`. It takes Nine's data out of the save so the normal game can load it (see [UNINSTALL.md](UNINSTALL.md)).

If Steam is set to update automatically, the update can arrive the moment you close the game.

## The game says the save is corrupted, or won't load

Your progress is still there. The game has met a save that names a character it doesn't have.

1. **Close the game.** Don't choose anything that resets, deletes or overwrites the save.
2. Either install the mod again (`1_SETUP.bat`, then `2_INSTALL.bat`), or run `REPAIR_SAVE.bat` to play without it.
3. If that doesn't help, restore a backup from `save_backups` ([UNINSTALL.md](UNINSTALL.md#restoring-a-backup-by-hand)).

## Setup problems

| Message or symptom | What to do |
|---|---|
| `'python' is not recognized`, or the window closes at once | Python isn't installed or isn't on PATH. Install Python 3.10 or newer from <https://www.python.org/downloads/> with **"Add python.exe to PATH"** ticked, then run the `.bat` again. To check: open Command Prompt and type `python --version` or `py --version`. |
| **"Python 3.10 or newer is needed"** | An older Python is first on PATH. Install a current one. |
| `pip could not install ...` | Open Command Prompt and run `py -m pip install UnityPy lz4 Pillow numpy`, then run `1_SETUP.bat` again. Antivirus or a company network may need to allow Python online once. |
| **"Couldn't find the game"** | In Steam: right-click the game > Manage > **Browse local files**, and copy that folder's path. In Command Prompt: `cd C:\NineThePhantom`, then `py nine_alpha.py setup "D:\SteamLibrary\steamapps\common\BlazblueEntropyEffect"` (your path). |
| **"Couldn't create the folder link"** | Move the package folder to a normal local drive (not a network drive, not a FAT32 USB stick), or run `1_SETUP.bat` as administrator once. |
| **"There is already a 'game' entry ..."** | Delete the `game` item inside the package folder. It's only a link, so your real game isn't touched. Run setup again. |
| **"No ... schema snapshot for game build ..."** | The game is newer than this package. See [After a Steam game update](#after-a-steam-game-update). |
| **"merge.json is modded and there is no pristine backup for this game build"** | In Steam: Properties > Installed Files > **Verify integrity of game files**. Then run `1_SETUP.bat` again. |
| Windows SmartScreen warns about a `.bat` file | Choose **More info > Run anyway**. Each `.bat` is one line that runs `nine_alpha.py`; open it in Notepad to see. |
| Antivirus quarantined a file | The package is Python scripts and data. Restore the file, add the folder as an exception, and run setup again. |

## Install problems

| Message or symptom | What to do |
|---|---|
| **"BlazBlue Entropy Effect is running"** | Close the game fully. Check Task Manager for `BlazblueEntropyEffect.exe`. |
| **"Setup hasn't been run yet"** / **"The game data hasn't been read yet"** | Run `1_SETUP.bat` first. |
| **"The game data in this folder was read from ..."** | The game updated since setup. Run `1_SETUP.bat` again, then `2_INSTALL.bat`. |
| **"REFUSING to install: ... is from game build ..."** | The game updated since the last install. Run `2_INSTALL.bat` again: it sets the old backups aside first. If the message stays, use Steam's **Verify integrity of game files**, then `1_SETUP.bat` and `2_INSTALL.bat`. |
| **"The game is build ..., but its files still point at mod data from an older build"** | Use Steam's **Verify integrity of game files**, then `1_SETUP.bat` and `2_INSTALL.bat`. |
| `WARNING ... verified on builds [...]` | That part wasn't marked as checked on your exact game build. If your build is the one in the README, ignore it. |
| `WARNING js ... anchor matches 2 times and ALL are replaced` | Known and harmless. The build goes on. |
| **BUILD ABORTED**, **ERROR** or **CONFLICT** lines | Nothing in the game was changed. Run `MAKE_FEEDBACK_ZIP.bat` and send the zip with a screenshot of the window. |
| **"The install did not finish"** | A line above it starting with REFUSING or BUILD ABORTED says why. |
| "Nine CF layer: using her BBEE frames (...)" | Not an error. See [Centralfiction animations](#centralfiction-animations). |

## In the game

| Symptom | What to do |
|---|---|
| Nine isn't in the Prototype list | `STATUS.bat` should show `installed:` with `char-nine`. If not, close the game and run `2_INSTALL.bat`. If the game updated, see the top of this page. |
| The game won't start or hangs at the splash screen | Run `UNINSTALL.bat` and check that the game starts. If it still doesn't, use **Verify integrity of game files**. Then send a feedback zip. |
| Her portrait, icons or text are missing, or text shows raw keys like `InheritSkill_...` | Take a screenshot and send it with a feedback zip. |
| Something odd happened in a fight | Press **F9** right after it. That saves a report of the last few seconds (inputs, moves, hits). |
| Online or co-op | Play **single player only**. Don't take a modded game into multiplayer. |

## Centralfiction animations

Flame Punisher and Magic Arts can use Nine's animations from **BlazBlue Centralfiction**. This is optional. The installer uses them only when:
- BlazBlue Centralfiction is installed through Steam on this PC,
- the Steam account that is logged in owns it, and
- Steam is running while `2_INSTALL.bat` works.

The frames are read from your own copy while the mod is built. Nothing from Centralfiction is in this package. Otherwise the same moves are built from her Entropy Effect frames, with the same timing and the same damage. The install window says which one it used ("Nine CF layer: ...").

If Centralfiction is in an unusual place, set the `BBCF_DIR` environment variable to its folder before installing.

## Where things are

| What | Where |
|---|---|
| Your game build and what's installed | `STATUS.bat` |
| F9 reports | `diag\` in the package folder |
| The mod's own log | `modlog.txt` in the package folder |
| The game's log | `%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect\Player.log` |
| Save backups | `save_backups\` in the package folder |
| Your save | `%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect\Steam\<account>\Save` |
| A feedback zip | `MAKE_FEEDBACK_ZIP.bat` writes it to `feedback\` |

## Reporting a problem

1. Press **F9** in the fight right after the problem, if it happens in a fight.
2. Run **`MAKE_FEEDBACK_ZIP.bat`**. It packs your latest F9 reports, a short session log and the installed versions into `feedback\TheZenithTerminal_<date>.zip`. It collects files from the package folder and the game's log. It uploads nothing.
3. Send that zip with a short description: what you did, what you expected, what happened. A 10 to 30 second clip helps a lot.
