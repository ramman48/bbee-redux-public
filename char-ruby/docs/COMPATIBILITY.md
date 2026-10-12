# Ruby Rose 0.9.0: compatibility

## Game builds

This package is for **BlazBlue Entropy Effect build 25627491** (Steam, Windows).

- `STATUS.bat` shows your build once the setup has run. In Steam it is under the game's Properties > Updates.
- Every other build is refused by the setup, with "no schema snapshot for game build ...". Nothing in the game is changed in that case.
- During development she also ran on builds 25478197, 25598842 and 25621352. This package can't be installed on them.

A Steam update of the game switches the mod off. Read "After a game update" in [README.md](../README.md) before you play again.

## BlazBlue Cross Tag Battle

You don't need Cross Tag Battle for this alpha. The package carries the Cross Tag Battle files Ruby is built from (the `bbtag_alpha` folder), and the install doesn't look for the game or ask Steam about it. If Cross Tag Battle is installed, it isn't touched or read.

A later release is planned to read those files from your own copy of Cross Tag Battle instead, and to check through Steam that you own it.

## Other mods

**One package folder controls the game's mods.** Installing from a package folder replaces whatever another package folder installed. Two folders can't both be installed at once.

- **Nine the Phantom (her own package).** Installing Ruby from this folder while Nine is installed from hers would remove Nine from the game while she stays in your save, and the game would then report the save as corrupted. So `2_INSTALL.bat` reads the save first and stops, before changing anything, if it holds a character this package doesn't install. Then either run `UNINSTALL.bat` in Nine's folder (it takes Nine's data out of the save; her folder's `save_backups` keeps a copy), or run `py ruby_dev.py install --drop-others` in this folder, which removes those characters from the save after backing it up.
- **This package installs three parts:** `char-ruby`, and the two shared parts she needs, `bbee-sdk` and `bbee-actors`.
- **In development** she ran in one set with Nine the Phantom, Izanami, EX Ragna, EX Hakumen, Boons Plus and Entropy Overhaul's Grim mode. Those aren't in this package.
- **This package's own three-part set hasn't been run in the game by itself.** Its setup and build were run from a clean copy of the package on 2026-10-03 (game build 25627491); the install step was not. In the game, Ruby has been run and tested inside the development set, which holds the same three parts, last on 2026-10-03 on build 25627491. If the three parts alone behave differently for you, that is worth reporting.
- **Mods from other authors** that change the same game files haven't been tried.

## Languages

- **Text:** Ruby's names and descriptions are in all ten of the game's languages: English, Simplified Chinese, Traditional Chinese, German, Spanish, French, Japanese, Korean, Brazilian Portuguese and Russian. A few short names stay in English in every language.
- **Voice:** English only. Her lines come from Cross Tag Battle's English voice files.

## Play modes

Play single player only. Don't take a modded game into online or co-op play.

## System

- Windows 10 or 11, 64-bit. The setup uses Windows tools (folder links, the registry, Task Manager's process list). Linux and Steam Deck haven't been tried.
- Python 3.10 to 3.14, 64-bit. The package was built and checked with Python 3.14, and its scripts also compile under 3.10. Python 3.15 isn't supported until the packages the setup installs are built for it.
- Nothing else: her sounds come already converted in this alpha package (versions before 0.7.1 needed the .NET SDK).
