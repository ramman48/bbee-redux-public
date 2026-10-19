# Making a mod that installs fast

An install builds every enabled mod from the player's own game files. Most of that work gives the same result every
time, so the loader keeps it and puts it back at the next install. This page is for mod authors: what the loader
already does for you, what you switch on, and how to see where the time goes.

## Where the time goes

Every build prints how long each step took. From a build of three character mods:

```
  107 clones took 1 s
  char-nine import_cf.py took 2 s
  char-ruby import_ruby.py took 54 s
  dr-party import_kris.py took 4 s
```

An importer that takes 10 seconds or more and keeps nothing gets a line starting with `NOTE` that points here.

## What costs nothing

- **Table rows, text and script patches** in `mod.json`. They are merged in well under a second.
- **Bundle clones** (`"clones"` in `mod.json`). About a hundredth of a second each.

Prefer these over an importer whenever they can do the job.

## Importers

An importer is a script of yours that the loader runs during the build. It is the slow part of most character mods,
because it reads art and sound and writes bundles. There are two ways to have its result kept between installs.

### 1. One line in mod.json

Use this when both are true:

- the importer has no check that must run at every install (it does not ask whether the player owns another game,
  for example);
- what it makes depends only on your mod's folder, the mods yours depends on, the loader and the game's build.

```json
"importers": [
  { "script": "fx/import_fx.py", "keep": true }
]
```

The loader then keeps everything the script wrote and what it handed back. At the next install it puts that back
without starting the script. It runs the script again when a file in your mod's folder changes, when the loader or
the game updates, or when the importer's entry in `mod.json` changes.

If the script writes a file into your own mod's folder as it runs (a generated list, a cache), name it so that it
does not count as a change:

```json
{ "script": "fx/import_fx.py", "keep": true, "keepSkip": ["fx/gen/list.json"] }
```

The path is the file's place inside your mod's folder, with forward slashes.

### 2. A few lines in the importer

Use this when the importer has a check that has to run every time, or reads something outside the mod, such as
another game's files. The script still starts at every install. It does its check first, then wraps the slow part:

```python
import os, sys
sys.path.insert(0, os.path.join(LOADER, "tools"))
import kept

check_the_player_owns_it()            # always first, always runs

def make():
    ...                               # writes bundles into `out`
    return adds                       # the manifest additions

adds = kept.work("my-mod import", out, make,
                 reads=[HERE, other_game_folder],      # every folder and file the work reads
                 says=[game_build, some_setting])       # anything else the result depends on
```

`reads` is compared by each file's path, size and time. `says` is compared by value. `skip=["gen/made.json"]` leaves
out a file the work itself writes inside a folder named in `reads`.

Name everything the work reads. A missing entry means a player keeps an old result after that thing changed. An
extra entry only costs a rebuild now and then.

## Rules the loader holds you to

- **A check that decides whether the mod may be built is never kept.** Ownership checks run before `kept.work` and at
  every install. Do not use `"keep": true` on an importer that has one: the loader would skip the script, and the
  check with it.
- **A result is kept only when it is safe to put back.** The loader does not keep work that failed, that removed a
  file from the build folder, or whose inputs changed while it ran. The log says which.
- **The same input has to give the same output.** If your importer puts a random id or the time of day into a file,
  a kept result is still correct, but two real builds differ and problems get harder to compare. Use fixed ids.

## Checking it works

Install twice without changing anything. The second build log shows, for each kept importer:

```
my-mod import: kept from 2026-10-11 10:59:58, 666 files put back in 1.6 s (it took 51 s to make)
```

To build everything from nothing once, set `BBMOD_NOKEEP=1` or delete the loader's `kept` folder. Deleting it is
always safe.

The `kept` folder sits next to `patch_out` and holds the same kind of files: bundles built on the player's PC from
their own games (47 MB for three character mods). Like `patch_out`, it is never part of a package and never shared.

## Other things that make an importer slow

Measured on the mods that ship today:

- **Reading the game's manifest for every bundle.** `bbchar.read_manifest()` hands back a copy you may change, and
  the copy takes about a tenth of a second. For looking things up use `bbchar.manifest_lookup()`, which is made once.
- **Decoding the same source file more than once.** Read it once and pass the result along.
- **Doing per-file work for files the mod does not use.** Build the list of what is used first.
