# Ruby Rose for BlazBlue Entropy Effect

Version 0.9.0, for game build **25627491**.

Ruby Rose, as she appears in BlazBlue Cross Tag Battle, as a playable character in BlazBlue Entropy Effect. She is part of Cross Effect, one of the Redux mods.

This is an unofficial fan-made mod. It isn't made, endorsed or supported by 91Act, Arc System Works or RWBY's rights holders. Use it at your own risk, and play single player only.

## How it works

This is an alpha package. **You don't need BlazBlue Cross Tag Battle.** The package carries the Cross Tag Battle files Ruby is built from, in its `bbtag_alpha` folder: her sprites, animations, effects, voice and sounds, as that game stores them. Besides those it holds scripts, our own effect and icon art, and these documents. It has no Entropy Effect files in it.

Ruby is built from those files on your PC, into your own Entropy Effect install. Please don't pass the `bbtag_alpha` folder on outside this package. A later release will read the same files from your own copy of Cross Tag Battle instead.

Don't share the files the setup makes (the `local_only`, `decoded`, `extracted_raw`, `inspect`, `patch_out` and `mods\char-ruby\gen` folders, and `mods\char-ruby\mod.json`). They are made from the games' files.

## What you need

- **Windows 10 or 11**, 64-bit.
- **BlazBlue Entropy Effect** on Steam, at build **25627491**. A newer build needs a newer package (see "After a game update").
- **Python 3.10 to 3.14**, 64-bit, from <https://www.python.org/downloads/>. Tick **"Add python.exe to PATH"** in its installer. The setup adds four Python packages (UnityPy, lz4, Pillow, numpy). A Python newer than 3.14 can be too new for those packages.
- **An internet connection** for the first setup (it downloads the Python packages).
- About **650 MB** of free disk space for the files made on your PC.

## Install

1. Unzip `RubyRose-0.9.0-alpha.zip` to a folder you will keep, for example `C:\RubyRose`. Don't put it inside the game's folder.
   - **Don't move, rename or delete this folder while the mod is installed.** The game loads Ruby's voice and sounds from it, and writes the mod's log there.
2. Run **`1_SETUP.bat`**.
   - It checks Python, finds the game, reads Entropy Effect's data and makes Ruby's moves from the Cross Tag Battle files in the package.
   - The game must be closed. This takes about a minute, plus the download of the Python packages the first time.
3. Keep the game closed and run **`2_INSTALL.bat`**.
   - It copies your save into `save_backups` first.
   - It reads your save. If the save holds a character from another package (Nine the Phantom, installed from her own folder), it stops before changing anything and says what to do. See Troubleshooting.
   - The first install makes her art and sounds. It took about five minutes on the PC it was measured on; allow more on a slower one. Later installs are quicker.
   - It ends with **"Installed."** If it ends with **PROBLEM**, the mod was not installed; see Troubleshooting.
4. Start the game from Steam. Ruby is at the end of the Prototype list.

If the setup can't find the game, open Command Prompt in the package folder and run `py ruby_dev.py setup "D:\SteamLibrary\steamapps\common\BlazblueEntropyEffect"` with your own path.

## Update from an older version of this mod

1. Close the game.
2. Delete the old `mods\char-ruby` folder inside your package folder. Keep everything else, above all `save_backups` and `local_only`.
3. Unzip the new package over the same folder and let it replace files.
4. Run `1_SETUP.bat`, then `2_INSTALL.bat`.

You don't need to uninstall first. Your save keeps Ruby's progress.

## After a game update

A Steam update puts the game's own files back, which switches the mod off. **The normal game can't load a save that still has Ruby in it.** It reports the save as corrupted.

After the game updates, before you play:

1. Close the game. Don't choose anything in the game that resets or deletes the save.
2. Then do one of these:
   - **Keep playing Ruby:** run `1_SETUP.bat`, then `2_INSTALL.bat`. If the setup says there is **no schema snapshot for game build ...**, the game is newer than this package. Get the updated package, or use the next option until there is one.
   - **Play without the mod for now:** run `REPAIR_SAVE.bat` (see "Your save").

If Steam updates games automatically, the update can arrive the moment you close the game.

## Turn the mod off

There is no switch that keeps Ruby in your save while the mod is off: the normal game can't load her data. Turning the mod off is the same as removing it.

Run **`UNINSTALL.bat`** with the game closed. Keep the package folder if you want to install again later with `2_INSTALL.bat`.

## Remove it completely

1. Close the game and run **`UNINSTALL.bat`**. In this order, it:
   1. copies your whole save into `save_backups`;
   2. takes mod-character data out of the save (see "Your save") and lists every entry it removes;
   3. puts the game's original files back.
2. Start the game and check that your save loads.
3. Move `save_backups` somewhere else if you want to keep the copies. Then delete the package folder. The `game` item inside it is only a link: deleting it doesn't touch your real game.
4. Optional: in Steam, right-click the game > Properties > Installed Files > **Verify integrity of game files**.

What stays on your PC after that: four small backup files next to the game's data (`merge.json.orig`, `manifest.orig` and their `.build` notes, in `BlazblueEntropyEffect_Data\StreamingAssets\ab`), which you can delete; and the Python packages.

## Your save

While the mod is installed, your save holds Ruby's Evotypes, records and runs. The normal game can't load a save that names a character it doesn't have.

- `2_INSTALL.bat`, `UNINSTALL.bat` and `REPAIR_SAVE.bat` copy your whole save into `save_backups\<date>_<time>_<reason>` before they change anything. `BACKUP_SAVE.bat` makes a copy at any time.
- `UNINSTALL.bat` and `REPAIR_SAVE.bat` remove these from the save: the Evotypes of mod characters, their entries in the character list, their run and Entropy records, a run in progress if it uses them, and the Legacy skills and Talents that your other characters' Evotypes inherited from them. Everything else stays as it was.
- `SAVE_REPORT.bat` only reads: it lists where the save mentions mod characters. If the uninstall or the repair says that "mod-character references would remain", nothing was changed; run it and send what it prints.
- They remove **every** Redux character, not only Ruby. If your save also has Nine the Phantom from her own package, read [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) first.
- `REPAIR_SAVE.bat` does only the save part. Use it when the normal game says the save is corrupted or won't load. It works whether the mod is installed or not.
- If Steam reports a cloud save conflict on the next launch, choose the **local** save. That's the cleaned one.

To restore a backup by hand: close the game, open `%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect`, and copy the `Steam` folder from `save_backups\<the backup you want>\` over the `Steam` folder there. A backup taken while the mod was installed still has Ruby in it.

## Troubleshooting

Once the setup has run, **`STATUS.bat`** shows your game build and what is installed.

| Message or symptom | What to do |
|---|---|
| `'python' is not recognized`, or the window closes at once | Install Python (3.10 to 3.14) with **"Add python.exe to PATH"** ticked, then run the `.bat` again. |
| `pip could not install ...` | Open Command Prompt and run `py -m pip install UnityPy lz4 Pillow numpy`, then run `1_SETUP.bat` again. If that fails too and your Python is newer than 3.14, install Python 3.14: the packages don't support a newer one yet. |
| **"Couldn't find BlazBlue Entropy Effect"** | Give the setup your game folder (see Install). In Steam: right-click the game > Manage > Browse local files. |
| **"This package's bbtag_alpha folder is incomplete"**, or **"BlazBlue Cross Tag Battle wasn't found"** | The `bbtag_alpha` folder, or a file in it, is missing or was changed. Unzip the package again, with every folder, then run `1_SETUP.bat` again. |
| **"Couldn't create the folder link"** | Move the package folder to a normal local drive (not a network drive or a USB stick), or run `1_SETUP.bat` as administrator once. |
| **"There is already a 'game' entry ..."** | Delete the `game` item inside the package folder. It's only a link. Run the setup again. |
| **"BlazBlue Entropy Effect is running"** | Close the game fully. Check Task Manager for `BlazblueEntropyEffect.exe`. |
| **"No ... schema snapshot for game build ..."** | The game is newer than this package. See "After a game update". |
| **"merge.json is modded and there is no pristine backup for this game build"** | In Steam: Properties > Installed Files > **Verify integrity of game files**. Then run `1_SETUP.bat` again. |
| **"Setup hasn't been run yet"** | Run `1_SETUP.bat` first. |
| **"The game data in this folder was read from ..."** | The game updated since the setup. Run `1_SETUP.bat` again, then `2_INSTALL.bat`. |
| **"The game is build ..., but its files still point at mod data from an older build"** | Use **Verify integrity of game files**, then `1_SETUP.bat` and `2_INSTALL.bat`. |
| **"Couldn't clean ... mod-character references would remain"** | The save holds mod-character data in a place the cleaner doesn't know. Nothing was changed, and the mod is still installed. Run `SAVE_REPORT.bat` and send what it prints: it reads only, and prints field numbers and counts, no names. |
| **"Your save has data for a mod character this package doesn't install"** | Another package's character (for example Nine the Phantom) is in your save. Installing from this folder would take that character out of the game, and the game would then report the save as corrupted. Nothing was changed. Either run that package's own `UNINSTALL.bat` first, or open Command Prompt in this folder and run `py ruby_dev.py install --drop-others`: it removes those characters from the save (the save was just copied into `save_backups`). |
| **BUILD ABORTED**, with **ERROR** or **CONFLICT** lines under it | Nothing in the game was changed. The `ERROR` line names the step that stopped. If the table doesn't cover it, send `install_log.txt` (see "Reporting a problem"). |
| `WARNING ... verified on builds [...]` | That part wasn't marked for your exact game build. If your build is 25627491, ignore it. |
| `WARNING js ... anchor matches 2 times and ALL are replaced` | Known and harmless. The build goes on. |
| Ruby has no voice or sound in the game | Her sounds are loaded from the package folder. If it was moved or deleted after the install, put it back, or run `2_INSTALL.bat` from where it is now. |
| The game says the save is corrupted, or won't load | Close the game without choosing anything that resets the save. Then see "After a game update". |
| Ruby isn't in the Prototype list | `STATUS.bat` should show `char-ruby` after `installed:`. If not, close the game and run `2_INSTALL.bat`. |
| Windows SmartScreen warns about a `.bat` file | Choose **More info > Run anyway**. Each `.bat` is one line that runs `ruby_dev.py`; open it in Notepad to see. |

Where things are:

| What | Where |
|---|---|
| Save backups | `save_backups\` in the package folder |
| The installer's log | `install_log.txt` in the package folder |
| The mod's own log (written while the game runs) | `modlog.txt` in the package folder |
| The game's log | `%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect\Player.log` |
| Your save | `%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect\Steam\<account>\Save` |
| The list of every file in this package, with checksums | `RELEASE_MANIFEST.txt` |

## Reporting a problem

Every `.bat` writes what it shows in its window to **`install_log.txt`** in the package folder as well. If a step stops, send that file with your report: it holds the messages, your Python and Windows versions and the folder paths of this PC, and nothing else. If the problem is in the game, send `modlog.txt` too, and a clip or a screenshot if you can.

## More

- [docs/CHANGELOG.md](docs/CHANGELOG.md): what changed in each version.
- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md): game builds, other mods, languages.
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md): what this version doesn't do.
