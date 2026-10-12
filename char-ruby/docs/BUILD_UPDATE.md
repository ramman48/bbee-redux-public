# When the game updates

The game patched on **2026-09-24**: Steam build **24904166 → 25478197**. This page records what that did to the
modding setup, what was checked, and the procedure for any future update.

## What a game update does to our install

Our loader installs mods by writing modded bundles into `StreamingAssets\ab\m_mod.m` and repointing entries in
`StreamingAssets\ab\merge.json`. Before the first install it copies the original `merge.json` and `manifest` to
`merge.json.orig` and `manifest.orig`, and treats those copies as "pristine" forever after.

When Steam patches the game it **replaces `merge.json` and `manifest` with the new build's stock copies**, but it
does not know about our `.orig` files, so it leaves them alone. After the 2026-09-24 patch:

| File | State | Consequence |
|---|---|---|
| `merge.json` | New build, stock. References `m_mod.m` **0 times** | **No mods are loaded.** The game runs pure stock 25478197 |
| `manifest` | New build, stock | — |
| `m_mod.m` | Our last install, from the old build | Orphaned; nothing points at it; harmless |
| `merge.json.orig`, `manifest.orig` | **Old build (2026-09-07)** | Dangerous — see below |

Every loader path that trusted those backups would have broken the game:

- `install` built the new index on top of the **old** entries and wrote it out.
- `uninstall` and `restore_manifest` copied the **old** indexes over the new ones.
- Every bundle read (`slice_bundle`) resolved offsets through the **old** index while reading the **new** container files.

## The guard (added 2026-09-27)

Backups are now stamped with the build they were taken from (`<file>.build`). In `make_patch.py` and `bbchar.py`:

- A backup with no stamp, or a stamp for a different build, is **stale**.
- `install`, `uninstall`, and any manifest write or restore **refuse** while a backup is stale, and print why.
- Reads use a backup only if it is stamped for the installed build; otherwise they use the live index, and only if
  that index is provably unmodded (nothing in it points at `m_mod.m`). Otherwise reads refuse too.

Verified against the current install: both backups detected as stale; `install` and `uninstall` refuse; reads
resolve to the live, unmodded `merge.json`.

## What changed in 25478197 (checked read-only, 2026-09-27)

**Boon system — unchanged.**
- Every table schema Boons Plus touches is byte-identical: `BlessConf`, `BlessQualityConf`,
  `PlayerBattleTriggerDetail`, `BlessScreenGridConf`, `BlessTree`, `SkillActivate`, `SkillDamage`,
  `BaseActorConf`, `ActorActionConf`, `BaseActorPotentialConf`, `ClientSkinConf`.
- Of 534 protobuf messages, 14 changed and none were added or removed. The changed ones are dungeon, challenge,
  sync and save structures (`STPlayerBase`, `SMHeatRecord`, `BreedDungeonMisc`, `DungeonActiveInfo`,
  `EliteMonsterStageBelongConf`, `BattleChallengeConf`, …).
- `EPlayerTriggerGroup` and `EBlessSeries` are byte-identical. No new trigger groups or elements, so the modded
  Attribute group (6) and future Water/Radiation series cannot collide with new stock content.
- Boon content: `BlessConf` 336 rows, `BlessQualityConf` 1,340, `BlessScreenGridConf` 486, `BlessTree` 35 —
  **zero rows added, removed or changed.** No new stock boons.
- `PlayerBattleTriggerDetail`: same 16,941 rows, **41 changed — stock balance tweaks** (e.g. a cooldown removed
  from triggers 50481–50485, a second value on 64391). None are ours.

**Code — changed.** `GameAssembly.dll` is dated 2026-09-24; our code dump `dump/dump.cs` is from 2026-09-07. JS
modules changed that our mods depend on: `PdAssistant`, `PlayerTriggerUtil`, `UIUtil`, `BattleJsExternCall`,
`pbdef`.

**Compatibility of existing mods** (`audit_build.py`):

| Mod | Patch points still matching | Problem on 25478197 |
|---|---|---|
| `bbee-devtools` | 3 / 3 | **Whole-file replacements of `PdAssistant` and `PlayerTriggerUtil`, both changed by the update.** Installing it would overwrite new game code with old. Must be re-derived. |
| `attribute-category` | 12 / 13 | `this._triggerGroupFactionMap.size<5` in `Bless` now matches more than once |
| `bbee-sdk` | 3 / 3 | `UIUtil` changed; anchors survive |
| `attack-speed-boon` | 1 / 1 | Tables fine; rows untouched by the update |
| `example-new-tactic`, `example-attribute-crit` | table only | Fine |
| `example-ragna-potential` | table only | Its tables changed in the update; re-check |
| `unlock-all` | 1 / 1 | Fine |

## 2026-09-29: 25478197 → 25598842 (re-baselined by the Characters session)

**Steam:** the game patched at 10:00:45 on 2026-09-29.
- `appmanifest_2273430.acf` shows `buildid` = `TargetBuildID` = 25598842, `StateFlags` 4 (fully installed), `UpdateResult` 0, and every byte downloaded and staged. Nothing more is pending.
- Steam replaced `merge.json` and `manifest`, so no mods were loaded until the next install.

**Re-baseline done** (the procedure below, in order):
1. Backups retired: `merge.json.orig`, `manifest.orig` and their `.build` stamps → `*.b25478197`.
2. Old data kept: `decoded`, `extracted_raw`, `inspect`, `dump` → `*_b25478197`.
3. Re-dumped with `Il2CppDumper` (the metadata is plain, v31), then `extract_dump.ps1`.
   - **The C# code is unchanged:** the new `dump.cs` differs from the old one only in one compiler-generated class name (`__JobReflectionRegistrationOutput__…`), and every method offset matches. Type trees, so the loader's asset writes, are unaffected.
4. `pipeline.py`: 60,410 logical bundles, 1,011 JS, 188 tables (1 failure, the same 189-file set as before).
5. `audit_build.py`: every mod's anchors resolve.
   - No module any mod patches changed.
   - Five anchors are AMBIGUOUS (four in `bbee-actors`, one in `entropy-grim`). Their modules are byte-identical to the working 25478197 install, so this predates the update.

**What the update changed:**

| Area | Change | Who it reaches |
|---|---|---|
| Tables | `SkillActivate`: Ragna's `attack2` Timeout 0.65 → 0.85 and `summonEXAir` mute 0.5 → 0.9. Hakumen's Skill rows renumbered: his neutral `skill0` row (which shared order 1 with the gated Down + `skill0` row) is now order 2, and every later Skill row moved down one (29 rows before and after; none added). | builds copying Ragna / Hakumen rows (Ruby, EX Ragna, EX Hakumen, Nine's economy donor) |
| Tables | `SkillDamage`: +2 rows for monster 10010101; no existing row changed. `MultiPlayerConf`: version bump. | — |
| JS | `BattleTeamBreed`, `BattleChallenge` changed; the other 1,009 modules are identical | no mod patches them |
| Bundles | 48 containers rewritten (4,316 bundles repacked, most unchanged), 1 added (`effect/prefab/monster/ph/ph_dead_01`) | — |
| The Phantom boss (`ph`, `phbullet2/3`) | a new death sequence (`dead_2` / `dead_3`); Overdrive: buff `3012_revert` removed from `ODOD_chuxian` / `ODOD_pre`, invincibility level 9 on `ODOD_atk_end`, one effect unbound in `OD`; the tag `ph_pushback_destroy` added to six more spell roots (most already had it); the giant arm's hitbox 1.35 → 1.40 wide | Nine (regenerated) |
| Repacked donors | `rg`, `ha`, `habullet`, `pt`, `ptbullet`, `ph*`, `hb`, `no`, `iconpotential101801`, `ph` meshes and more. Repacked isn't necessarily changed. | each character mod regenerates and diffs its output (the reliable test: that's how the Phantom changes were found) |

**Checked and installed:**
- The full enabled set (14 mods) builds on the new baseline with 0 errors.
- Nine: `verify_character` 0 failures, Evotype 63/63.
- Ruby: `check_ruby_build` 0 failures.
- Installed 2026-09-29 12:07:09: 937 bundles. Fresh backups are stamped 25598842. Save backup `save_rescue\20260929_120507_pre_b25598842`.
- Each workstream then regenerated its own data from the new build and diffed it: the Characters session messaged every active session with the findings that concern it.
- All four reported ready: Ruby and Grim regenerated byte-identical; Boons Plus verified; EX carries Ragna / Hakumen's changes and fixed the null-reference pitfall below.
- **Combined install 12:32:04:** 937 bundles, 14 mods.

## 2026-09-30: 25598842 → 25621352 (re-baselined by the Entropy Overhaul session)

**Steam:** the patch was pending while the game ran and applied the moment the game closed (02:52, through
`gamecheck.py close` for an install). `appmanifest_2273430.acf`: `buildid` = `TargetBuildID` = 25621352, `StateFlags` 4,
`UpdateResult` 0, 7.8 MB downloaded. Steam replaced `merge.json` and `manifest` (0 `m_mod.m` entries): no mods loaded.
The loader refused the install, correctly, because the backups were stamped 25598842.

**Lesson:** closing the game can apply a pending update. After any `close`, check `bbmod.py status` (the game build)
before installing, and warn every session not to launch until the combined reinstall. Saves that reference mod
content must not meet the unmodded game.

**Re-baseline done** (the procedure below):
1. Backups retired: `merge.json.orig`, `manifest.orig` and their `.build` stamps → `*.b25598842`.
2. Old data kept: `decoded`, `extracted_raw`, `inspect`, `dump` → `*_b25598842`.
3. Il2CppDumper re-dump, then `extract_dump.ps1`. **The C# code is unchanged**: `dump.cs` differs only in one
   compiler-generated class name (`__JobReflectionRegistrationOutput__…`), as on 25598842.
4. `pipeline.py`: 60,410 logical bundles, 1,011 JS, 188 tables (the usual 1 failure). It wrote
   `tools/schema/25621352`.
5. `audit_build.py`: every mod's anchors OK, apart from the ambiguous anchors already known. No JS module or table
   any mod patches changed.
6. `dump_assets.py` for the 77 reference assets. `actor/buff/_tags.ab`'s file name holds a double underscore, so map
   names back through `merge.json`, not by splitting on `__`. **All 77 byte-identical** to the old baseline.

**What the update changed:**
- **Tables:** only `MultiPlayerConf` (the version bump).
- **JS:** no module.
- **Bundles:** 235 repacked in 5 containers (17 container files rewritten).
  - Mostly `gameplay/map/scenelogics` (98), `map/element` (33) and `map/scenes` (18).
  - 21 `effect/prefab/role` bundles: `rg_rush_02`, `rgskin_06/rg_buff_02`, `su01_attack4_02`, `noskin_13/no_call_boom_007`,
    and `hz`, `bl`, `jn`, `rc`, `tk`, `icey` skins.
  - Also 4 `ui/texture/iconpotential` and `data/xlsx/consciouscrystalpool`.
- Each workstream regenerates and diffs its own mods (step 6); then one combined install.

## 2026-09-30 (07:32): 25621352 → 25627491 (re-baselined by the Cross Effect session)

**Steam:** again applied on close (`gamecheck.py close`, 07:32:46). `appmanifest_2273430.acf`: `buildid` =
`TargetBuildID` = 25627491, `StateFlags` 4, 7.8 MB. The loader refused the install (backups stamped 25621352).

**An install started seconds after the close failed in its rig and asset steps** (`EndianBinaryReader_Memoryview has no
attribute files`): Steam was still rewriting the containers. Wait for the manifest to settle before reading the game.

**Re-baseline done** (the procedure below):
1. Backups retired to `*.b25621352`; old data kept as `*_b25621352`.
2. Il2CppDumper (working directory = its folder, stdin from an empty file), then `extract_dump.ps1`. **The C# code is
   unchanged** (one generated class name).
3. `pipeline.py`: 60,410 bundles, 1,011 JS, 188 tables (the usual 1 failure). `audit_build.py`: all anchors OK apart
   from the five known ambiguous ones.
4. The 77 reference assets re-dumped: **all byte-identical**.

**What the update changed:**
- **Tables:** none.
- **JS:** `BattleBreedRunVirtualStage2`, `BattleCoopBreedRunVirtualStage2` (minifier renames in the run-restore path;
  no mod patches them).
- **Bundles:** 361 repacked in 10 containers: map scenes and scene logic (126), role / monster effects (100: `rg`, `no`,
  `rc`, `tk`, `icey`, `hb`, `ma`, `nt`, `es`, `hzm` and skins), common effect materials and textures (77), UI
  textures (21). No `actor/` bundle.
- Ruby regenerated identical. The other generated mods read only tables, reference assets and `actor/` bundles, all
  unchanged: no regeneration needed; add 25627491 to `gameBuilds` when a mod is next touched.
- **Combined install 07:47:** 1,226 bundles, 15 mods, backups stamped 25627491.

## The hidden data regression

Table builds start from `decoded/tables/<Name>.json.orig`, the stock data **decoded from the old build**. Building
`PlayerBattleTriggerDetail` from it would silently ship the **old values for all 41 rows the update rebalanced**.
So re-extracting the decoded data is required before any build — not optional housekeeping.

## Re-baseline procedure (for this and every future update)

1. **Retire the stale backups** — rename, do not delete:
   `merge.json.orig → merge.json.orig.b24904166`, `manifest.orig → manifest.orig.b24904166`
   (in `game\BlazblueEntropyEffect_Data\StreamingAssets\ab\`). The next install takes fresh, stamped backups.
2. **Preserve the old decoded data**: rename `decoded`, `extracted_raw` and `inspect` to `*_b24904166`.
3. **Re-extract**: `python pipeline.py` (re-derives JS keys from the `"use strict"` plaintext; they are not
   build-specific).
4. **Re-dump the code** with Il2CppDumper against the new `GameAssembly.dll` if anything relies on RVAs or new
   schemas. Not needed for the boon tables above, whose definitions are unchanged.
5. **Audit**: `python audit_build.py` must show every anchor OK and no whole-file replacement over a changed module.
6. **Fix** each failing mod against the new sources, then build and install.
   - Each workstream regenerates its generated data (e.g. `build_nine.py`, `build_ruby.py`, `build_exragna.py`) and diffs
     it against its pre-update copy.
   - Then a staged build of the **full** enabled set, not just its own mods.
7. **Re-dump the reference assets** (added 2026-09-29): `pipeline.py` does not write `decoded\assets`, which generators and
   tools read (logic trees, AI trees, the buff table, action tags).
   - Regenerate every file the old baseline had with `dump_assets.py <logical bundle> ...`, one bundle per old
     `decoded_*\assets\<bundle with _ for />__<asset>.json`.
   - Run it with `PYTHONIOENCODING=utf-8`: it prints a buff sample that the Windows console can't encode.
   - `dump_assets.py` reads the pristine index (`make_patch.pristine_merge_path`, fixed 2026-09-29 by Boons Plus). Before
     that fix it read the live `merge.json`, so after an install it dumped modded buffs as "stock".

**Pitfall found on 25598842 (EX):** a re-extracted logic tree can list a null-reference entry in `references.RefIds`
(`rid` -2, class "", no `data`). UnityPy can't write it back (`KeyError: 'data'` in `TypeTreeHelper.write_value`).
- Generators that copy a donor's whole reference list must drop such entries; a `{"rid": -2}` pointer still means null.
- `bossport.assemble` already drops class-less entries, and `build_exragna.py` now does too.

Tools: `audit_build.py` (mod compatibility), `livetables.py` (decode any table straight from the installed build
and diff it against the old decode; valid only for tables whose schema is unchanged).
