# Updating from 0.7.x or 0.8.x

About 10 minutes. The installer leaves Nine's Evotypes and records in your save.

## Steps

1. **Close the game** completely.
2. **Unzip the new package into a new, empty folder**, for example `C:\NineThePhantom`.
   - Don't unzip it over the old folder. The old folder holds game data read from an older game version and files this release no longer uses.
3. In the new folder, run **`1_SETUP.bat`**. It links your game and reads the current game data (a few minutes).
4. Run **`2_INSTALL.bat`**. It ends with **"Installed."**
5. Start the game from Steam.

Once the game loads your save and Nine is in the Prototype list, you can delete the old folder. If you want to keep your older save copies, move its `save_backups` folder somewhere first.

You don't need to uninstall the old version first.

## What the installer does for you when updating

- **Backs up your save** into `save_backups` inside the new folder, before it changes anything.
- **Removes Izanami's data from your save.** The 0.7.x packages installed Izanami as an unfinished preview. She isn't part of this release, and the game can't load a save that names a character it doesn't have. So her entries are taken out: her Evotypes, her records, her place in the character list, and a run in progress if she was in it. The installer lists what it removed. Nine's data and all your other progress are left as they are.
- **Sets aside old backups after a game update.** The game has been updated since 0.7.x. The old installer's copies of the game's index files are from the previous version, and the installer won't use them. They're renamed (not deleted) in the game folder, and fresh copies are taken from the current game.

## Things that changed since 0.7.x

- New moves, Magic Arts, two more SP moves, the Stock Slot and 11 more Potentials. See [NINE_GUIDE.md](NINE_GUIDE.md).
- A Weave with one element now casts a small spell instead of your Summon Tactic.
- At 3 elements, a new element pushes out the oldest instead of being lost.

## If something goes wrong

- **"The game data in this folder was read from …"**: run `1_SETUP.bat` again, then `2_INSTALL.bat`.
- **The game says your save is corrupted**: close the game without choosing anything that resets or deletes the save, then see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#the-game-says-the-save-is-corrupted-or-wont-load).
- **You'd rather go back**: every install leaves a full copy of your save in `save_backups`. [UNINSTALL.md](UNINSTALL.md) explains how to restore one.
