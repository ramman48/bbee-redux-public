# Installing Nine the Phantom 0.9.0

About 10 minutes the first time. Updating from an older version? Read [UPDATE.md](UPDATE.md) instead.

## What you need

- **Windows 10 or 11** and **BlazBlue Entropy Effect on Steam**, up to date. This package was made for Steam build **26263712**.
- **Python 3.10 or newer**, free from <https://www.python.org/downloads/>.
  - In the installer, tick **"Add python.exe to PATH"**.
  - To check it's installed, open Command Prompt and type `python --version` (or `py --version`).
- About **300 MB** of free disk space where you unzip the package.
- An internet connection the first time, so setup can download four Python packages (UnityPy, lz4, Pillow, numpy).
- Node.js is **not** needed. Setup mentions it; ignore that line.

The package contains **no game files**. Setup reads your own copy of the game, and the installer builds the mod on your PC.

## Install

1. **Unzip** `NineThePhantom-0.9.0-alpha.zip` somewhere simple, for example `C:\NineThePhantom`.
   - Avoid OneDrive and other synced folders, and folders that need administrator rights such as `Program Files`.
   - If Windows marks the zip as downloaded: right-click it > Properties > tick **Unblock** > OK, before unzipping.
2. **Close the game** completely.
3. Double-click **`1_SETUP.bat`**. It:
   - checks Python and installs the Python packages it needs;
   - finds your game through Steam and links it into the folder as `game`;
   - reads the game's data (under a minute on most PCs).

   It ends with **"Setup done."** If it can't find the game, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#setup-problems).
4. Double-click **`2_INSTALL.bat`**. It:
   - copies your whole save into `save_backups`;
   - builds the mod from your game files (1 to 5 minutes);
   - installs it into the game.

   It ends with **"Installed."**
5. Start the game from Steam as usual. **Nine the Phantom** is at the end of the Prototype list.

If Windows SmartScreen warns about a `.bat` file, choose **More info > Run anyway**. Each `.bat` is one line that runs `nine_alpha.py`; you can open it in Notepad to see.

## What gets installed

| Mod | What it is |
|---|---|
| **char-nine** | Nine the Phantom |
| bbee-sdk, bbee-actors | shared plumbing that an added character needs (portraits, unlocks, HUD icons) |
| bbee-inspector | the **F9 report recorder**: press F9 in a fight to save a report of the last few seconds |

The installer writes one file into the game's `StreamingAssets\ab` folder (`m_mod.m`), changes the game's two index files there, and keeps a copy of the originals next to them. `UNINSTALL.bat` puts the originals back.

Nothing else in your game is changed. Other characters and your progress are untouched.

## Centralfiction animations (optional)

If **BlazBlue Centralfiction** is installed through Steam and the logged-in Steam account owns it, Flame Punisher and Magic Arts use Nine's animations from it. They are read from your own copy while the mod is built. Keep Steam running during `2_INSTALL.bat` so the installer can check.

Without Centralfiction the same moves use her Entropy Effect animations, with the same timing and damage. The install window says which one it used.

## Your save

- **Before every install**, `2_INSTALL.bat` copies your whole save into the `save_backups` folder inside the package folder. `BACKUP_SAVE.bat` makes another copy at any time.
- While the mod is installed, Nine's Evotypes, records and runs are saved like any other progress.
- **The normal game can't load a save that still has Nine in it.** It reports the save as corrupted. So:
  - remove the mod only with **`UNINSTALL.bat`**, which cleans the save first ([UNINSTALL.md](UNINSTALL.md));
  - after a **Steam game update**, reinstall or repair the save before you play ([TROUBLESHOOTING.md](TROUBLESHOOTING.md#after-a-steam-game-update)).

## Playing

- Play **single player only**. Don't take a modded game into multiplayer.
- Her moves, elements, Weaves and Potentials: [NINE_GUIDE.md](NINE_GUIDE.md).
- Something odd in a fight: press **F9** right after it, then see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#reporting-a-problem).

## Installing again

Run `2_INSTALL.bat` again at any time with the game closed. It rebuilds and reinstalls the same version. Run `1_SETUP.bat` first if the game has updated since.
