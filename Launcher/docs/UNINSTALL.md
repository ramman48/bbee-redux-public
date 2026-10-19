# Uninstalling, and repairing a save

**Always remove the mod with `UNINSTALL.bat`.** While the mod is installed, your save holds Nine's Evotypes, records and runs. The normal game can't load a save that names a character it doesn't have: it reports the save as corrupted. `UNINSTALL.bat` takes that data out first, then removes the mod.

## Uninstall

1. **Close the game** completely.
2. Run **`UNINSTALL.bat`**. It does three things, in this order:
   1. copies your whole save into the `save_backups` folder;
   2. removes mod-character data from the save: Nine's Evotypes and records (and Izanami's, if an older package left any), and a run in progress if it uses them. It lists every entry it removes. Everything else stays exactly as it was;
   3. restores the game's original files.
3. Start the game and check that your save loads.
4. Keep the package folder until then. It holds your `save_backups`.

Optional: in Steam, right-click the game > Properties > Installed Files > **Verify integrity of game files**.

If Steam reports a **cloud save conflict** on the next launch, choose the **local** save. That's the cleaned one.

## Repair a save without uninstalling: `REPAIR_SAVE.bat`

Use it when the normal game says the save is corrupted or won't load. That happens when the mod stopped being loaded but the save still has Nine in it:
- a **Steam game update** switched the mod off (see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#after-a-steam-game-update));
- **Verify integrity of game files** was run while the mod was installed;
- the mod's files were deleted by hand.

Steps:
1. Close the game. Don't pick any option in the game that resets or deletes the save.
2. Run **`REPAIR_SAVE.bat`**. It backs the save up, then does step 2 of the uninstall above. It works whether the mod is installed or not.
3. Start the game.

If you'd rather keep playing Nine, install the mod again instead (`1_SETUP.bat`, then `2_INSTALL.bat`). With the mod back, the save loads as it was.

## What is removed, and what isn't

| Removed from the save | Kept |
|---|---|
| Nine's (and Izanami's) Evotypes | every other character's Evotypes |
| their entries in the character list and run records | all other records, unlocks and currencies |
| their Entropy records | your settings |
| a run in progress, if it uses them | a run in progress with a stock character and stock Evotypes |

The save's "best Evotype" summary is set to your best remaining one.

## Your save backups

- `2_INSTALL.bat` and `UNINSTALL.bat` copy your whole save into `save_backups\<date>_<time>_<reason>` before changing anything. `BACKUP_SAVE.bat` makes a copy at any time.
- The copy named `before_install` from your very first install is from before the mod touched the save.

### Restoring a backup by hand

1. Close the game.
2. Open `%USERPROFILE%\AppData\LocalLow\91Act\BlazblueEntropyEffect` (paste it into the Explorer address bar).
3. Copy the `Steam` folder from `save_backups\<the backup you want>\` over the `Steam` folder there.
4. A backup taken while the mod was installed still has Nine in it. Run `REPAIR_SAVE.bat` afterwards if you want to play without the mod.

### Rolling back in the game

The game keeps its own save history and can roll back to an earlier snapshot. That works if you pick a snapshot from before you first installed the mod. It discards everything since then, including progress with other characters, and the game drops old snapshots as you play. `UNINSTALL.bat` keeps your other progress, so prefer it.

## Removing the package folder

After the uninstall, and once the game has loaded your save, delete the package folder. The `game` item inside it is only a link: deleting it doesn't touch your real game. Nothing else was installed on your PC apart from the Python packages setup added (UnityPy, lz4, Pillow, numpy).
