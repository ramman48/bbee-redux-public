# Ruby Rose: changelog

The newest version is at the top. Versions before 0.7.0 were development builds and were not released.

## 0.9.0 (the testers' feedback)

This version is built from what the alpha testers wrote about 0.7.0 and 0.7.1, over three rounds of feedback. 0.8.0
was the first of those passes and was never released; its changes are in here. What is still open is under "Known
in this version".

Her starting kit
- She starts with less, and her Potentials add more, as with the game's own characters.
- **Gun Blast fires once.** The chain of three is now its card ("Can chain 3 times, in any order and direction"; it
  used to add a fourth blast). The fourth blast stays with Gravity Dust.
- **Rising Reap** (Up + Attack) is a new Potential. Its three cards are offered once you hold it. It cannot be
  started again for 1.2 seconds.
- **Buzzsaw Blast** is a new Potential, on Down + Skill in the air. Buzzsaw Blast EX is offered once you hold it.
- **The air Skill is the Recoil Shot**, a new move: a rifle round forward for 30 MP. The recoil carries her back and
  holds her height, and it can be repeated while MP lasts.
- Double Kick (Down + Attack in the air) comes with the Rising Crescent card. A Double Kick that misses is spent
  until she lands, as before.

Gun Blast
- In the air, Down + Dash is the dive and Forward + Dash is the forward blast. (The dive was on Forward + Dash, and
  several testers read the inputs as swapped.) The backward gun-dash stays on Down + Dash on the ground.
- A chained blast starts when the one before it has finished its travel, so a chain no longer loses distance, and
  there is a short pause between blasts. A press that comes early is kept and fires then. Holding both Gun Blast
  cards removes the pause (a hidden effect).
- In the air, what is left of the chain can be used until she lands; it used to be lost after 0.6 seconds. Landing
  gives the chain back.
- A straight blast covers the same ground as a diagonal one, and the backward blast travels as far as the forward
  one, has its own recovery and no longer pulls her forward at its end.
- The effects of a blast fired while she faces left point the right way, and the upward blast in the air no longer
  shows the ground version's dust.

Shots
- **Rifle Shot deals less**: a shot about a quarter less, the stage 3 burst about half.
- **An enemy flinches from her rounds at most once every 1.5 seconds.** The damage always lands. Before, rifle fire
  interrupted nearly every boss attack.
- Pressing Skill again while she is still aiming fires again from that pose, without unfolding the rifle each time.
- **Sy-Pod Shot fires one heavy round** in place of two or three. Keep Skill held and she stays planted and fires
  again at a steady pace, 30 MP a round, until you let go or MP runs out. Gun Blast leaves the plant at any time.
  Its card now makes the held rounds cheaper and the plant knock enemies away.
- **The third air attack fires three rounds** with recoil, and she no longer hangs in the air after it: Jump, Gun
  Blast and the air Skill are open as soon as the last round is out.
- With Gravity Dust loaded, her rounds open a gravity well where they hit: it pulls enemies in for two seconds, then
  collapses and launches them. One well per enemy every 2.3 seconds.
- A new card, **Jump**: every jump fires a round straight down, with Gun Blast's flash under her, and the recoil
  carries the jump higher.
- A new card, **Gunswing**: during a scythe attack, Skill fires a round from the muzzle without ending the attack.
  Each shot costs 8 MP, one shot a swing. It works in the ground string, the low string, Rising Reap and the air
  string. A tester's idea.

Moves
- **Reaper's Hook and Guillotine open with a cinematic start.** As she winds up, the camera pushes in, time holds for
  a moment and the enemies on screen are held in place until her first strike lands. Bosses aren't held.
- Guillotine's last hit has a run-up. She pulls the scythe back and steps into the spin, covering 1.6 units; she used
  to spin on the spot.
- Rising Reap in the air has a start of its own: the scythe drops behind her before the swing. It used the ground
  move's crouch, with the blade on a floor that wasn't there.
- Recoil Rush shows. After a Gun Blast, petals trail her while the stronger strike waits, and that strike lands with
  a flash and a ring.
- Reaper's Hook no longer runs or slides in. She swings from where she stands, the blade reaches 2.8 units, and the
  hooked enemy is pulled in front of her and held there through the flurry. Before, with nobody in reach, she ran
  on the spot.
- Rising Reap's air card also lifts her with the enemy when the ground version hits, so the air string follows.
- Buzzsaw Blast cuts sooner, is invincible for its first 0.2 seconds, has Super Armor through the dive, and Jump
  cancels it once it has hit. Hold Down to drop faster, or Up to rise a little first.
- The fourth strike of Attack has a recovery: a new string can start 0.75 seconds after it (it was 0.35). The step
  from the third strike into the fourth has frames of its own.
- Holding Guillotine: each held spin and the finish have their slash (they had none).
- Scythe Chain shows when it is ready: a glint on her blade, like Jin's.
- Clash Assault shows its backdrop only with its Potential's full-charge finish, and only one. Without the card
  there is none. It showed two inside 1.5 seconds on every use.
- The red slashes of the power stages no longer come off Double Kick or the third air attack's shots, and they leave
  the fast Attack moves a little sooner.
- **The red slashes pass through walls and ledges.** They used to break on them.
- The red slashes are slimmer, with a lighter trail, and their break is over in under half a second. It lasted about
  a second, after every swing of a fast string.
- **Each red slash lies the way its swing cuts.** A level cut throws a flat crescent: Scythe Chain's first hit, Low
  Sweep, Corkscrew Slice, Guillotine, the first air attack and Clash Assault's finish. The two overhead chops (the
  third strike of Attack and the second air attack) throw an upright crescent that leans with the chop, and Reaper's
  Hook's two strikes throw an upright one. Before, the level cuts threw the same tall rising hook as the rising
  swings.
- **Buzzsaw Blast draws a red ring round her on every turn of the saw** at power stages 2 and 3, wider at stage 3.
  Its landing no longer throws a slash. The landing shot and its burst are unchanged.

Fixed
- Jump works during and after the third air attack.
- Three effects that promised MP back never paid it: Sy-Pod Shot's card, the Dust card ("loading Dust restores MP")
  and the refund after Low Sweep into Guillotine. They do now.
- The Lightning card's bolt on the third strike and the rose gust of the fourth strike came once a battle. They come
  on every use.
- The Buzzsaw landing no longer draws a flat pale wedge across the saw wheel.
- Her Evotype Talent's icon fits its frame in Training Details.

Shown on screen
- Her SP has a badge above the MP badge, and the Dust row of the move list says how SP comes back.
- The Rising Reap, Buzzsaw Blast and Gunswing cards have icons of their own.

Known in this version
- Petal Burst, Petal Dance and Red Reaper are still out of the kit while they are reworked.
- A tester found Jin's slowdown harder to trigger with Gun Blast. The cause is not established.

## 0.7.1 (install fixes)

Nothing in the game changes in this version: Ruby is the same as in 0.7.0. It is about getting her installed.

- **The .NET SDK is no longer needed.** Her sounds and voice lines come already converted in the package. In 0.7.0 the
  first install built a small converter with the .NET SDK and downloaded one package for it; on a PC without the SDK
  the install stopped with BUILD ABORTED.
- **`install_log.txt`.** Everything a `.bat` shows in its window is also written to this file in the package folder,
  with the Python and Windows versions. If something stops, send that file.
- **Uninstall and save repair.** A save in which another character's Evotype inherited a mod character's Legacy skills
  or Talent can now be cleaned: those inherited entries go with the character. Before, the uninstall stopped with
  "mod-character references would remain" and changed nothing. `SAVE_REPORT.bat` is new: it lists, without changing
  anything, where the save mentions mod characters, for a report when the cleaner still stops.
- **Windows in other languages.** The steps that read another program's messages (the folder link, the game check,
  the build's own helper programs) no longer depend on the PC's language or code page. In 0.7.0 the setup could stop
  on, for example, a German or Polish Windows while it made the folder link.

## 0.7.0 (first public alpha)

The early game
- She starts stronger: 1060 HP (was 980) and 180 Attack (was 160).
- Stage 2 comes at 4 Potentials (was 8).
- Rifle Shot costs 30 MP (was 40): three shots from a full bar. Reaper's Hook still costs 40.
- Her heavy hits break Strong armor, as the base cast's string finishers do: 5AAAA, 5BB, Rising Reap, Rising Crescent,
  Clash Assault and its finish, j.C, Guillotine's last cut, Buzzsaw Blast's landing slash and Reaper's Hook's last strike.
  Before, an armored enemy walked through her whole string.

Power stages
- Stage 2 can be seen. Each scythe attack throws a small crescent a short way, to the end of its longer reach, where it
  breaks into petals. 5A and 2A, which thrust, draw their line that far. Before, the longer reach hit with nothing drawn.
- Stage 3: Buzzsaw Blast's landing slash and Reaper's Hook's strikes also throw a slash projectile. That makes 23 moves.
- A projectile that breaks on a wall hits what is standing in it. Before, an enemy cornered against a wall took nothing
  from it. The heavy crescents (5AAAA, Rising Reap, Clash Assault) shake the screen when they break on a wall.
- Reaching stage 2 or stage 3 is marked: a crescent flashes on her and scatters into rose petals.

Potentials
- The two Gun Blast cards added in 0.6.13 have their own icons.
- The cards of Petal Burst, Petal Dance and Red Reaper aren't offered while those moves are switched off.
- Reaper's Hook's back throw works as its card says. Hold Back as the hook connects: she flashes through the hooked
  enemy in a burst of petals and throws it the other way. Before, she turned and struck where nobody stood.

Legacy
- Her two Legacy skills (Rifle Shot and Rose Lunge) work when another character uses them. Ruby appears behind the
  character in rose petals, fires her round or lunges through with the scythe, and leaves. They have Rifle Shot's and
  5AAAA's effects, sounds and screen shake.

Install
- This alpha package carries the Cross Tag Battle files Ruby is built from. You don't need Cross Tag Battle, and the
  install doesn't check anything through Steam. A later release is planned to read your own copy instead.
- `2_INSTALL.bat` reads your save first. If it holds a character from another package (Nine the Phantom), it stops
  before changing anything and says what to do. See the README's Troubleshooting.

## 0.6.13

Effects (rebuilt the way BBEE builds its own)
- Her scythe slashes are rebuilt from her Cross Tag arcs: the same circular strokes at the same size, drawn in her own
  stroke texture with a white-hot edge, red mist and petals. Each one follows her blade frame by frame and is gone
  before she recovers. Every slash is one clean arc: the dents and wobbles of earlier builds are gone.
- Her effects move on every frame the game draws, not only when her sprite changes, and fade out instead of cutting
  off. They run on her own clock: they hold during hit-stop and keep pace with attack speed.
- Her gun is rebuilt: muzzle flashes, tracers, impacts and casings in the game's own style, larger for heavy rounds.
- Power stages: her scythe slashes keep their Cross Tag size at every stage. At stage 3, twenty of her attacks also
  throw a slash projectile: a white-hot crescent with a red rim and a body of black thorned flame that pours off its
  back as it flies. Each move throws its own shape: Low Sweep's hugs the floor, Rising Reap's stands tall. It hits
  every enemy in its path once.
- The projectile ends properly. At a wall, or at the end of its range, it flashes, its blade tears away toward the
  tip, and the crescent scatters into rose petals. It no longer stays burning against a wall.
- Clash Assault plays Cross Tag's own clash backdrop across the whole screen (the diamond vortex during the chase, the
  colour burst on its stage 4 finish). Like her other Cross Tag art, it is made on your PC at install.

Sound
- Her sounds and voice no longer play as loud noise. Her sound files are now stored the way the game stores its own.
- She speaks more. Attack shouts on 5AA, 5B, 5BB, 2B, Low Sweep, Rising Reap and her air attacks, a call-out on 5AAAA,
  and her own lines on Rifle Shot, Buzzsaw Blast EX and its landing shot, the back blasts, Corkscrew Slice, Clash
  Assault and Reaper's Hook. Each move uses the line Cross Tag plays on it. 5A, 2A and 5AAA stay quiet.
- She reacts: cries when she is hit, knocked away or launched, a line when she recovers or gets up, a cry when she
  falls and a line when she revives, an idle line, and lines on the character select screen and in rooms.
- New sounds on the Dust reload, Guillotine's hold and last cut, and Reaper's Hook. Her jumps, landings, crouches,
  knockdowns and recoveries have their body sounds back.

Potentials
- New card, Gun Blast: travels farther. Every Gun Blast, in every direction, goes one and a half times as far.
- New card, Gun Blast: each blast also fires a Sy-Pod Shot round out of the muzzle, along the blast: behind her on a
  forward blast, ahead of her on a back blast, under her when she blasts upward. It pierces, carries the loaded Dust
  and grows with her power stages like any Sy-Pod round.

Moves
- Petal Burst, Petal Dance and Red Reaper are out of this version: their inputs are switched off while they are
  reworked. They come back in a later version. Their Potentials can still be offered, and do nothing for now.
- Clash Assault is her gun strike, as in Cross Tag. Holding Attack goes straight into a quick low bound forward that
  strikes on contact and fires a heavy round down at the end. It goes about twice as far as before and no longer
  draws a scythe slash. Its charged version has no charge-up any more, and it also comes out while she runs.
- Clash Assault's follow-up is a faster chase that carries her across the screen. At full power its last attacks are
  a fourth stage: bigger and stronger, they break armour and knock bosses back, and the final hit cuts every enemy on
  screen five times.
- Rifle Shot and Sy-Pod: every round of a burst hits the enemy it is fired at, grounded enemies included, and the
  enemy no longer drops out between rounds. Sy-Pod's rounds pierce and shake the screen when they hit.
- Loaded Dust applies on tapped Rifle Shot and Sy-Pod rounds.
- From stage 2, j.C (the last hit of the air string) fires a large piercing round diagonally down. It always applies
  the loaded Dust's full effect.
- Dust inputs: Up + Summon loads Ice, Down + Summon Lightning, Forward or neutral + Summon Fire, and holding Summon
  loads Gravity.
- Buzzsaw Blast: the saw is larger, shakes the screen on every cut, cuts more often when held, and drags the enemy
  down with her. At stage 3 it is much bigger, a tap gives the full held version, and she descends more slowly, so
  the saw cuts more times. Its landing slash stays close to its stage 1 size.
- 5AAAA's last strike carries the enemy up to her height, so she can jump and continue in the air. With the
  Semblance card it also raises Petal Burst's wind and petals (a hidden Potential).
- 2A > Low Sweep > Rising Crescent lifts the enemy to her height, so the air string connects after it.
- j.2A (Double Kick) works once per jump, and again after each kick that hits.
- Guillotine holds every enemy it cuts in the spin until its last cut, which launches them.

## 0.6.12

Inputs
- A string step can only be continued while its move is still playing. A press after the move has ended starts a new
  string (it used to continue for up to 0.45 s more).
- Scythe Chain: the pause that leads into the two wide sweeps is 0.5 to 0.8 s after the second strike.
- Guillotine, its held spins and its finish can no longer be cut by another Attack, Skill, Summon or Jump before the
  last strike. Gun Blast still leaves it.
- Clash Assault's chase can no longer be cut by a stray press. Gun Blast leaves it after each strike.
- A slow tap of Skill stays Rifle Shot. Sy-Pod Shot needs Skill held for about 0.15 s.
- Petal Burst and Petal Dance also come out when both buttons are pressed during another move.
- Summon during a Gun Blast loads Dust (it used to trigger the Summon Tactic alone).
- Red Reaper can't be cancelled. After a Petal Dance that hits nothing at full power, she can act as soon as it ends.
- Sy-Pod Shot and the multi-round Rifle Shot fire all their rounds before another move can start.

Moves and Potentials
- The third strike of Attack hits three times.
- Sy-Pod Shot's planting chop hits enemies in front of and above her.
- Clash Assault's full charge keeps its damage with Crescent Mastery and Silver Eyes.
- Crescent Mastery also enlarges Clash Assault without its charge Potential, and Rising Reap further with its
  two-hit Potential.
- Knocked away, Jump recovers her stance (with the triple-jump Potential).
- Petal Dance right after Petal Burst gives 20 SP back.
- Sy-Pod's rounds and the Ice cartridge Freeze as described (the Freeze used to end at once).
- Semblance's petals follow Petal Burst's dash. The lingering petals after an invincible Gun Blast hit harder.
- The spent Dust cartridge bursts on the floor behind her, not on her.
- The gravity well opens at the strike, not on her.
- Potential cards that unlock a move show that move's name and input.

Effects
- The long-reach slashes of her developed build are thin crescents thrown off each swing, different for quick cuts,
  sweeps, spins and heavy finishers. They replace the large flat arcs.
- Guillotine's finishing slash at full power is two tall crescents racing across the screen. The white flash is gone.
- Buzzsaw Blast has its own saw, and its EX landing has the landing's flash, ground hit and shot in time.
- Red Reaper has its own cuts on the enemy and trails on the blade.
- Rifle rounds no longer hang in the air at the end of their range.
- The night sky behind Petal Dance's finale and Red Reaper covers ultrawide screens.
- Dust: the aura, and the Gravity well in her own violet.

Text
- Move and Potential descriptions corrected in all ten languages. "Enhancer" is now "Recoil Rush".
- The skill summary explains how her power grows with her Potentials.

Icons
- All 38 Potential cards have their icon (22 were missing).

## 0.6.11 (2026-09-30)

- Ice Dust: a frozen enemy stays frozen until her next attack. Her secondary effects (ice spikes, petals, flames, gravity wells) no longer end the Freeze early.

## 0.6.10 (2026-09-30)

- Guillotine after Reaper's Hook: the same press no longer starts Rifle Shot as well.
- Buzzsaw's landing can't be cancelled before its hop finishes.
- Ice: the shatter and the Ice card's bonus now see the Freeze before the hit breaks it.

## 0.6.9 (2026-09-30)

- Input locks during the Hook flurry, the Buzzsaw dive and its landing now hold for the whole move.
- Ice Dust's Freeze starts a moment after the hit, so the hit reaction doesn't end it at once.
- Red Reaper works again in the current kit.
- The air Rising Reap can be jump-cancelled.

## 0.6.8 (2026-09-30)

- Reaper's Hook: no other move can start during the flurry.
- Buzzsaw: the dive is committed; Gun Blast follows only on hit.
- Attack + Summon during Buzzsaw gives Petal Burst (a hidden effect).
- The air Rising Reap comes out from the air attacks and from Up + Attack early in a jump.
- Air jumps also reset the air Rising Reap (with its Potential).

## 0.6.7 (2026-09-30)

- Reaper's Hook: a Skill press during the flurry gives Guillotine, not Rifle Shot.
- Rebuilt for game build 25627491.

## 0.6.6 (2026-09-30)

- Air Gun Blasts chain.
- Sy-Pod fires its three rounds when held from Rifle Shot.
- Reaper's Hook into Guillotine needs a press.
- After a Gun Blast, Up or Down + Attack gives Rising Reap or Low Sweep.
- Dust: Burn spreads, Ice shatters, Paralysis jumps; the Ice card's scythe bonus.
- Silver Eyes against Staggered enemies.

## 0.6.5 (2026-09-30)

- Clash Assault's leap and overhead play.
- Gun Blast into Attack gives Corkscrew.
- Two effect glitches removed: a violet floor spark, and a flat star on the saw.

## 0.6.4 (2026-09-30)

- The stage 3 Rifle burst reaches Sy-Pod's five rounds when the button is held.

## 0.6.3 (2026-09-30)

- Looping element effects (the Ice card's crystals, the Fire cartridge's fire pool) end, and stand on the floor.
- A round's glow ends when the round stops.
- Sy-Pod from the stage 3 Rifle burst fires five rounds.
- The Petal Dance finale and Guillotine show the Red Reaper sky and flash.
- A quick Attack + Summon goes straight to Petal Burst.

## 0.6.2 (2026-09-30)

- The effects pass: new gunfire, hit, attack-string and dash effects.

## 0.6.1 (2026-09-30)

- Guillotine is reachable at power stage 3.
- The SP moves work with Summon pressed first.
- Buzzsaw EX's landings at each stage.

## 0.6.0 (2026-09-30)

- One press gives one step of a string; a dropped string starts again.
- SP moves are button chords.
- Tap or hold Skill: Rifle Shot or Sy-Pod. Down + Skill: Reaper's Hook.
- Stage 3 guns: the Rifle burst and Sy-Pod's five rounds.
- Finishers for Petal Dance and Guillotine.

## 0.5.0 (2026-09-30)

- Dust (Fire, Ice, Lightning, Gravity) and the three power stages.
- Scythe Chain after a pause in the string.

## 0.4.0 (2026-09-29)

- The second version of her kit (V2): new moves and 38 Potentials with their own icons and text.
- Her own sounds and English voice, made from Cross Tag Battle at build time.
- Her select portrait is sized like the other characters'.

## 0.3.0 (2026-09-29)

- A first pass on weight and rhythm: hitstop, camera shake, cancels, movement and where effects appear.
- Her rose afterimage.

## 0.2.1 (2026-09-29)

- Rifle Shot plays her rifle animation and fires a round.
- Hit petals are back; leftover smoke on her rounds is gone.

## 0.2.0 (2026-09-29)

- Her Cross Tag Battle effects (slash arcs, muzzle flashes, smoke, casings, petals, rounds) play in game, made on your PC at build time.

## 0.1.2 (2026-09-28)

- Gun Blast replaces her dash, chains three times, and works up and down.
- First attack effects.

## 0.1.1 (2026-09-28)

- The rectangle around her sprite is gone.

## 0.1.0 (2026-09-28)

- First playable build: her Cross Tag Battle sprites and moves on Entropy Effect's controls, with stock sounds.
