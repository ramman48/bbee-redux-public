# Nine the Phantom, playable: version 0.9.0

A fan-made mod for **BlazBlue Entropy Effect** (Steam) that adds **Nine the Phantom** as a playable Prototype.

**This is an unofficial fan project.** It is not made, endorsed or supported by 91Act or Arc System Works. It unlocks no paid content and contains no game files.

Version 0.9.0 is an **alpha**: she is playable from start to finish, and still being tested and tuned. If something is wrong, [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#reporting-a-problem) says how to report it.

## What she is

Nine is a caster built from the Phantom boss's own moves, animations, effects and voice.

- **Fire, wind and ice spells** on Attack and Skill. Every cast leaves its element with her.
- **Weaving:** Summon turns the elements she holds into a combination spell. There are 19, one for every combination of one, two or three elements.
- **Magic Arts:** Attack + Skill switches her Attack to her close-range strikes from BlazBlue Centralfiction, and back.
- **Three SP moves:** Navy Pressure, Colorless Void and Flame Punisher.
- **Her blink** instead of a dash.
- **37 Potentials**, 27 hidden two-Potential bonuses, her own talent and two Legacy skills for her Evotype.
- Her text in all 10 game languages.

How she plays: **[docs/NINE_GUIDE.md](docs/NINE_GUIDE.md)**.

## What you need

- **Windows 10 or 11.**
- **BlazBlue Entropy Effect on Steam**, up to date. This package was made for Steam build **25627491**. `STATUS.bat` shows your build.
- **Python 3.10 or newer**, free from <https://www.python.org/downloads/>. Tick **"Add python.exe to PATH"** in its installer.
- About **300 MB** of free disk space where you unzip the package.
- Optional: **BlazBlue Centralfiction** installed through Steam on the same account. If you have it, two of her moves use her Centralfiction animations, read from your own copy. Without it, nothing is missing: the same moves use her Entropy Effect animations.

## Quick start

1. Install Python (see above).
2. Unzip this folder somewhere simple, for example `C:\NineThePhantom`. **Close the game.**
3. Run **`1_SETUP.bat`**, then **`2_INSTALL.bat`**.
4. Start the game from Steam. **Nine the Phantom** is at the end of the Prototype list.

Play **single player only**. Don't take a modded game into multiplayer.

## Documents

| File | Read it for |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | a first install, step by step |
| [docs/UPDATE.md](docs/UPDATE.md) | updating from 0.7.x or 0.8.x |
| [docs/UNINSTALL.md](docs/UNINSTALL.md) | removing the mod safely, repairing a save, save backups |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | game updates, a refused install, missing Python, where the logs are, reporting a problem |
| [docs/NINE_GUIDE.md](docs/NINE_GUIDE.md) | her moves, elements, every Weave, Magic Arts, SP moves, Potentials |
| [CHANGELOG.md](CHANGELOG.md) | what changed since 0.7.2 |

## The buttons

| File | What it does |
|---|---|
| `1_SETUP.bat` | checks Python, links your game folder, reads the game data. Run it once, and again after each game update |
| `2_INSTALL.bat` | backs up your save, builds the mod from your own game files and installs it (game closed) |
| `UNINSTALL.bat` | **safe uninstall**: backs up your save, removes Nine's data from it, then removes the mod (game closed) |
| `REPAIR_SAVE.bat` | fixes a save the normal game won't load because it still has Nine in it |
| `BACKUP_SAVE.bat` | copies your save into `save_backups` |
| `STATUS.bat` | shows your game build and what's installed |
| `MAKE_FEEDBACK_ZIP.bat` | packs your F9 reports and a session log into one zip to send |

## What's in the package

| Part | What it is |
|---|---|
| `mods/char-nine` | Nine: her moves, texts, icons and effect layouts |
| `shared/bbee-sdk`, `shared/bbee-actors` | shared plumbing that an added character needs (portraits, unlocks, HUD) |
| `shared/bbee-inspector` | the F9 report recorder, for sending feedback |
| `bbmod.py` and the other `.py` files | the mod loader. It reads your game, builds the mod on your PC and installs it |
| the `.bat` files | one line each: they run `nine_alpha.py` |

The package has **no game files**. Her animations, effects, sounds and voice are read from your own copy of the game when the mod is built.

Izanami, the unfinished preview in the 0.7.x packages, is not part of this release.

## Three things to know before you start

- **Only remove the mod with `UNINSTALL.bat`.** While the mod is installed, your save holds Nine's Evotypes and records. The normal game can't load a save that names a character it doesn't have. `UNINSTALL.bat` takes that data out first and backs up your save before it does.
- **A Steam game update switches the mod off.** Before you play again, run `1_SETUP.bat` and `2_INSTALL.bat`, or run `REPAIR_SAVE.bat` to play without the mod. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#after-a-steam-game-update).
- **Your save is copied before every install and uninstall**, into `save_backups` in this folder.

## Known issues

This is an alpha. Her whole kit was tested in the game's training room on build 25627491: every attack, Skill, Weave, Magic Arts chain and Potential. What is listed here was not, or is a known limit.

**Not yet confirmed in a full run**
- A complete run from character select to the final boss was not replayed on this version: room changes, boss fights, death and restart, the Potential cards and the Legacy screens were checked in the data and worked in earlier versions, but were not re-tested here.
- Phantom Ambush turns her to face the enemy she appears behind. The turn was added last and not re-tested.
- Menu texts in languages other than English were checked for missing lines, not read by native speakers. Corrections are welcome.

**Known limits**
- Meteor Heel: the heel itself rarely hits on the way down. Its meteor and the landing blast do the damage.
- Eightfold Blink and Phantom Ambush start with one frame of the normal blink before they change direction.
- Twin Globe's second globe does not hit an enemy the first one already hit.
- Large enemies standing still can be hit by Uvarovite's tornado up to twenty times per cast; that is its cap.
- With no element held, Summon casts your equipped Summon Tactic, as before.

If something else looks wrong, `MAKE_FEEDBACK_ZIP.bat` packs a report you can send (see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)).

## Credits and legal

BlazBlue Entropy Effect © 91Act. BlazBlue, Nine the Phantom and all related characters © Arc System Works. This is an unofficial, non-commercial fan project. It is not affiliated with, endorsed by or supported by either company.

Her animations, effects, sounds and voice are read from your own copy of the game at install time; this package contains none of them. Her portraits and icons are the image files in `mods/char-nine/art`.

The mod changes only your own installed copy of the game. It does not unlock DLC or any other paid content.
