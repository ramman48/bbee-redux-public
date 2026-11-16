# Reki: patch notes

## 0.5.10 (2026-11-15)
- Fixed Up + Summon without enough SP, and Down + Summon at any time, leaving her able only to walk. A Summon press now holds back only Summon, for half a second, as it does for the other heroes.
- Fixed Overcharge changing the rhythm of Sword Wave, Mirror Point and Raijin Ring when you press Skill again. With the card they come out at the same pace as without it, and can still be used past 0 MP.
- Fixed Thunder God Step missing every cut when the enemy stood against her back. She turns to the nearest enemy before the blink and again after it.
- Fixed Rising Dragon dropping her back to the floor at its end, and leaving her stuck in mid-air when used in the air. She now stays at the top of the rise for a moment, then falls.
- Fixed Rising Dragon in the air giving back her double jump and air dash.
- Fixed Crossfire coming only from Raimei. The hits of your shadow's moves and projectiles now count, and your own projectiles no longer count as your shadow's.
- Fixed Crossfire sometimes failing, or coming from a single hit, on enemies in later fights.
- Fixed your shadow having no run animation while it follows you after Mirror Recall.
- Fixed your shadow's attacks missing their slashes and bursts, Final Chapter's last two strikes among them.
- Changed Heavy Shadow's text to say what it does: it doubles your shadow's damage.

## 0.5.8 (2026-11-14)
- Changed the wording of the Potential and move texts to read like the game's own. No move works differently.
- Added her move and Potential descriptions in the nine other languages. They were English in every language before.

## 0.5.7 (2026-11-13)
- Added the Potential Mirror Passes (Lightning Charge, after Mirror Charge): your shadow's Lightning Charge crosses three times.
- Added the Potential Shadow Raimei (Raimei): your shadow's Raimei restores 5 MP.
- Changed her Attack from 170 to 237.
- Changed your shadow's damage: its sword hits and its projectiles deal 20% of yours, 40% with Heavy Shadow.
- Changed Afterimage's name to Shadow Burst; its text says it bursts where your shadow stood.
- Fixed your shadow's Sword Wave coming out half a second after yours. It fires with yours now, on the ground and in the air, and it hits an enemy your own wave has just hit.
- Fixed Crossing Waves striking in the wrong place. It strikes where your waves and your shadow's meet, in any direction and with Three Waves' fan.
- Fixed your shadow's air wave staying small with Breaker Wave and Heavy Shadow, and its ground wave pausing in flight when it grows.
- Fixed Plunge drawing the air attack's diagonal streak and dust while she falls. The landing keeps its effects.

## 0.5.6 (2026-11-12)
- Seen in game on 2026-11-12 (window 2, hot loads): Rising Dragon three times in a row on the ground, again right after a landing, once and twice per jump; the far dive and the near dive; Plunge; the rings bursting where they meet (from about 10 u; 5 u apart her ring has passed the shadow before its own exists); Final Chapter and Thunderhead with the shadow's lightning; the three jumps. Not seen: sounds, the Thunderhead clock, how it looks.
- Plunge falls at 30 u/s. The boss's own 100 u/s put her on the floor two frames after the press and its pose never showed.
- Rising Dragon can be used again as soon as she stands on the ground. It stayed shut after a use until she ran, crouched or jumped.
- Rising Dragon is once per jump with Dragon Climb and twice per jump with Triple Jump: each air jump gives it back.
- She hangs for a moment at the top of Rising Dragon before she falls.
- The two Raijin Rings burst where they meet. The check could miss rings that passed each other between two looks, and a shadow's ring listed under her.
- Final Chapter ends with its lightning on your shadow too: a bolt and the ground lightning each way, as hers. Its last move is also invincible and starts the Lightning Field in a long fight; those depended on a 3 second timer that a fight with many hits outran.
- Thunderhead on your shadow is the same lightning as hers.
- Thunderhead shows its 3 second cooldown as a clock on its Potential icon.
- With no enemy in reach the air attack dives ahead at 45 degrees and slides twice as far on landing. It dropped straight down.
- With Twin Dragons, Rising Dragon's fourth hidden effect also strikes below a shadow that rises in mid-air.
- Plunge (air Down + Attack) plays the plunge of her boss fight, its fall and its landing, without the charge.
- Her jump, air jumps and landing have sound.
- Heavy Strike is named Raimei.
- Card texts reworded from tester notes: Rising Dragon's, Sword Wave's, Mirror Point's and Plunge's groups.

## 0.5.5 (2026-11-11, dev build 90)
- Triple Dash works with Rage Step and Lightning Charge held. Their rows sat ahead of the second and third dash and blocked them.
- Your shadow's Rage Step shows its slash. The shadow copy draws no effect of its own for that move, so the slash is played at its spot.
- In Final Chapter, Thunderhead's lightning also falls on your shadow without needing Afterimage.
- Her Attack string is named Kaminari, and the cards say the shadow "echoes" a move instead of "repeats" it.

## 0.5.4 (2026-11-11, dev build 89)
- Your shadow stays where you plant it. It follows you only after Mirror Recall (with Long Mirror), until you plant it again. It used to follow from the moment it was planted once you held Long Mirror and Mirror Strings, which made a Crossfire nearly impossible.
- A Crossfire now counts whenever you and your shadow both hit the same enemy within half a second, from any side. Two of your own hits from opposite sides still count.
- Rising Dragon in the air is once per jump, and twice with Triple Jump, as the cards say. It could be repeated without limit by waiting for it to end, and the second use had nothing behind it.
- Triple Jump stops at three jumps. It had no limit.
- Thunder Leap's lightning strikes the ground below her instead of the air under her feet.
- An over-exhausted Raijin Ring strikes lightning where the ring turns back, and the two rings burst where they actually meet.
- Cancelling Lightning Charge stops its later bursts.
- Starting a run moves her legs at once, and stopping no longer makes her idle jump.

## 0.5.3 (2026-11-10, dev build 88)
- Her jump, air jumps, dash, dash stop and air dash have their own animations, made from her own drawings: each drawing is held and cut to the next as in her official animations, with a short gather before a change and a settle after it.
- The end of her dash and air dash breathes instead of holding one still pose.
- Her hair no longer shoots straight up during the air jumps.
- Crouching has its own animation: she steps down into the crouch, breathes while she holds it, and rises back out, instead of snapping to one landing pose. Made on her own skeleton without an editor (research/characters/reki/skel_anim.mjs), from her landing and idle animations.

## 0.5.2 (2026-11-10)
- Crouching no longer makes her hair stand straight up: she drops into the crouch with her hair already down.
- Her idle plays its whole loop, so it no longer jumps back partway through.
- Her Evotype tile is the size of the other heroes' tiles instead of filling the whole square.

## 0.5.1 (2026-11-10)
- Each family of Potentials shows one icon, the way the stock heroes' cards do.
- Potential Unleashed is no longer offered among her first picks; like every hero's, it comes once the other Potentials run out.
- Lightning Field is only offered once you have Final Chapter.
- She holds one idle pose instead of snapping between two.
- Her air attack no longer leaps 4 meters up before the dive: a small hitch, the dive comes sooner, the stick steers her through it, and Skill or Dash can cut it short.

## 0.5.0 (2026-10-23)
- Her trailing shadow (Long Mirror with Mirror Strings) now copies her moves and their animations half a second behind her, instead of standing still.
- Raijin Ring's and Lightning Charge's follow-up Potentials only appear once you have the Potential they build on.
- Thunderhead's lightning now strikes around Reki instead of at fixed points of the room.
- Air attacks can be used once per jump again, so Down + Attack no longer carries her across the stage.
- Heavy Strike and her third ground cut stop at a platform's edge.
- Her third ground cut hops lower and no longer lands her on the platform above.
- Lightning Charge is now Dash then Skill on the ground, and works whether or not a shadow is out.
- Thunder Drop is now an upgrade to her Plunge: lightning strikes where she lands. Its follow-ups add strikes on both sides and farther out.
- Final Chapter plants a shadow for 4 seconds when none is out; the shadow strikes from the enemy's far side. Its input is now shown as Dynamic.
- Mirror Recall costs 20 MP, and its hold now lines up with the moment the recall starts.
- Rapid Ring makes the ring hit faster while you hold it.
- A quick third dash press is no longer lost.
- Armored Draw's armour lasts longer and covers the end of the draw.
- Rage Step's input is now shown as Dash · Attack, on the ground.
- Eight Potentials renamed: Split Shockwave, Breaker Wave, Air Mirror Point, Mirror Recall, Rapid Ring, Bolt Swap, Breaking Strike, Armored Draw. Their texts and the hidden effects' texts are clearer, and say when a hit breaks Super Armor.
- She turns with your input like the other heroes, instead of snapping to face the nearest enemy.
- Her hidden effects now show in the move list.
- New character select and Prototype portraits drawn from her full illustration, her own crest, and her own skill, Ultra, talent and Legacy icons.
- Her own Potential icons on the cards, in Training Details and on the battle HUD.
