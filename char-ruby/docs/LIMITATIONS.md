# Ruby Rose 0.9.0: limitations

What this version doesn't do, or does in a way you should know about.

## Setting it up

- **This alpha carries Ruby's Cross Tag Battle files itself**, so you don't need that game. A later release is planned to read them from your own copy and to check that you own it.
- **You need Python.** There is no installer program: the `.bat` files run Python scripts. Her sounds come already converted in this alpha package, so nothing else has to be installed.
- **The first install takes time.** The setup took about a minute and the first install about five minutes on the PC this was measured on. Most of that is making her sprite sheets and sounds. Later installs reuse that work and took under two minutes.
- **It needs about 650 MB of disk space** in the package folder, for the data made on your PC and your save backups.
- **It needs the internet once**, for the Python packages.
- **Windows only.**

## While it is installed

- **Don't move, rename or delete the package folder.** The game loads Ruby's voice and sounds from `local_only\cross_effect\audio` inside it, and writes the mod's log (`modlog.txt`) there. The rest of the mod is inside the game's own data.
- **Don't share what the setup made.** The generated files are made from the games' files.
- **Only one package folder can be installed at a time.** See "Other mods" in [COMPATIBILITY.md](COMPATIBILITY.md).
- **Single player only.**
- **Her voice is English only.**

## Game updates

- **Every game update switches the mod off**, because Steam puts the game's own files back.
- **Until you reinstall the mod or repair the save, the game can't load your save.** It reports it as corrupted. Your progress isn't lost: see "After a game update" in [README.md](../README.md).
- **This package works with build 25627491 only.** After an update you need a newer package. Until there is one, `REPAIR_SAVE.bat` lets you play without the mod.
- **Steam's "Verify integrity of game files" also switches the mod off.** Run `2_INSTALL.bat` again afterwards.

## Removing it

- **Removing the mod takes Ruby out of your save**: her Evotypes, her records, a run in progress with her, and the Legacy skills and Talent other characters' Evotypes inherited from her. A full copy of the save is kept in `save_backups`.
- **`UNINSTALL.bat` and `REPAIR_SAVE.bat` remove every Redux character from the save**, not only Ruby.
- **Four small backup files stay next to the game's data** after the uninstall. They are harmless, and the README says where they are.

## Gameplay and presentation

- **Petal Burst, Petal Dance and Red Reaper can't be used in this version.** Their inputs are off while they are
  reworked, and their three Potentials aren't offered in a run. Her Ultra slot stays empty.
- **Stage 2 and stage 3 swings keep their stage 1 look.** What changes with the stages is what the swings throw: a small
  crescent at stage 2, the full slash projectile at stage 3. Swing effects of their own for the two stages are planned.
- **Ice Dust and the down chain.** With Ice loaded, 2A > Low Sweep > Rising Crescent can Freeze the enemy at Rising
  Crescent. A Frozen enemy stops rising with her, so the air string after it misses.
- **Rising Crescent's airborne Rising Reap follow-up** (a hidden Potential) needs Rising Crescent on the ground. Rising
  Crescent now rises with its target, so Attack after it gives her air string.
- **Bosses** can't be held by Guillotine; the hits still land.
- **Clash Assault's backdrop** covers the stage during its Potential's full-charge finish, as in Cross Tag. Without
  that card Clash Assault shows none (0.9.0).
- **Buzzsaw Blast's red ring has no hit of its own.** It shows the saw's turns at power stages 2 and 3; the saw's own
  cuts are what hit.
- **Guillotine's last hit at stage 3 still throws its two standing crescents**, one to each side, as in 0.7. Its
  other slashes lie level with the swing (0.9.0).
- **The cinematic start** (camera in, enemies held, time held for a moment) is on Reaper's Hook and Guillotine.
  Bosses aren't held. Its dark backdrop has not been checked on every stage: tell us where it looks wrong.
- **Guillotine's run-up and the air Rising Reap's new start** are cut from her existing frames; no new drawings.
