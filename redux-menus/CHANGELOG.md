# Redux Menus: patch notes

## 0.1.26 (2026-11-16, development)
- Fixed: on the Legacy menu, choosing Legacy I moves on to Legacy II by itself. After Legacy II, or at once when no second Legacy is left to pick, the cursor goes to Start Dive.
- Fixed: the Triple Dash & Jump switch on the Legacy menu did nothing for heroes whose dash and jump wait on their own Triple Dash and Triple Jump cards, such as Reki. It now gives them the same effect as holding those cards.
- Fixed: the Extreme tab of the Entropy menu listed the rewards of Grim of the Abyss next to Extreme's own. Each tab now lists only its own rewards.
- Fixed: The Prisoner could not be unlocked on the character select after Clear the Infection, although his Avatar Analyzer was owned. Hold to unlock works for him now, as on the game's own select.
- Fixed: the entries of the pause menu now show their icons the first time the menu opens.

## 0.1.23 (2026-11-14)
- Fixed: opening the Entropy menu at the hub console showed the game's old panels for a moment and then stalled before the new menu appeared. The new menu now opens straight away.
- Fixed: the old pause menu's numbers showed behind the new pause menu.
- Fixed: on the character select, the Legacy skill and talent icons of the added characters were empty boxes.
- Fixed: Swift Master had no head icon in the roster, in either the diamond or the square shape.
- Fixed: the new Mind Crystals showed an empty hexagon instead of an icon.
- Removed: the Endless tab of the Entropy menu, with Endless out of Entropy Overhaul for now.

## 0.1.22 (2026-11-14)
- Fixed: on the Legacy menu a controller can now reach every button above the list. Down from Legacy I or Legacy II goes to Triple Dash & Jump and Free Choice, then Order, Heroes and Elements, then Any tactic and Any skill, and only then to No Legacy. Up goes back the same way, and left and right move along a row. Before, down from Legacy I jumped straight to No Legacy.
- Fixed: on the pause menu, moving up or down with a controller or the keyboard lit up a second entry for a moment before the selection settled. Each press now moves the selection one entry, straight to the next one, and holding a direction still scrolls.

## 0.1.21 (2026-11-12)
- Changed: Free Choice on the Legacy menu offers every Tactic the game's Tactics screen has, not only the ones your Evotypes hold. The pop-up has a chip for each element; a two-element Tactic (the red ones) is listed under both of its elements instead of in a category of its own. Still up to four, and the Legacy skill and talent still come from your Legacies.
- Changed: on the Legacy menu, choosing a Legacy moves the cursor to Start Dive by itself, as the game's own menu does. Left or up goes back to the list.
- Fixed: on the pause menu, moving down to the bottom row lit up End Trial for a moment before the selection landed on Settings. The selection now goes straight to the right entry.

## 0.1.20 (2026-11-12)
- Fixed: with Redux Menus 0.1.19 an install through the Zenith Terminal could stop while it built the Entropy menu's swirl. The swirl now builds with every version of the loader.

## 0.1.19 (2026-11-11)
- Changed: Starting Tactics on the Legacy menu is now Free Choice. Pick up to four tactics your Evotypes hold, and the run starts with them in place of the tactics your Legacies hand down. Legacy I and II stay set and still give their Legacy skill and talent, so you choose the skill by choosing the Evotype that has it. Before, picking tactics took your Legacies away.
- Changed: with no tactics picked the menu plays Classic, where the tactics come from your Legacies. The lines under the list say which of the two is on.

## 0.1.18 (2026-11-11)
- Changed: the swirl in the middle of the Entropy menu is a real-time effect. Streaks of energy and smoke flow round the Entropy number in the colour of the difficulty, with sparks at the edge. The swirl grows as your Entropy rises, and from half the limit a second, faster swirl runs over it. The still vortex picture it replaces is removed.
- Fixed: the Entropy menu's button prompts were drawn twice, one row over the other, unless the pause menu had been opened earlier.
- Fixed: the pause menu's mod box showed one mod name and then only version numbers. It lists every mod again, and a name too long for the box ends in "...".
- Fixed: clicking a difficulty tab on the Entropy menu with the mouse did nothing.
- Fixed: on Grim of the Abyss the Entropy menu showed no rewards. It now shows the next reward and how many you have reached.

## 0.1.17 (2026-11-11)
- Changed: the Legacy menu's list is as narrow as the character select's roster, so the middle of the screen has more room.
- Changed: a Legacy you have set stands in the background of the Legacy menu. Legacy I takes the left half and Legacy II the right half, and each fades out at its edges. The Evotype under the cursor stands in front as before.
- Changed: on the Legacy menu LB / RB (Q / E) go from Legacy I to Legacy II and back. The list's order is on its own Order button.
- Added: the Legacy menu says what is equipped. Under the list there is one line each for Legacy I, Legacy II and the Starting Tactics, with the Legacy skill and the handed-down tactics.
- Fixed: after you switched an Evotype's Legacy skill, the skill shown on the right of the Legacy menu stayed the old one.

## 0.1.16 (2026-11-11)
- Fixed: with a mouse the Entropy menu jumped between the modifiers and the mutations. The mouse now picks the modifier or the mutation under the pointer.
- Fixed: on a pad the Entropy menu had the same jumping when you moved onto the mutations.
- Fixed: pushing the stick right on a modifier sometimes picked the modifier above or below. A push that drifts up or down a little now counts as a push to the side.
- Added: on the Entropy menu a left click on a modifier raises its rank and a right click lowers it. A line at the bottom says so while you use the mouse. You can also click a mutation, LOWER, RAISE and the difficulty tabs.
- Added: a key that swaps between the modifiers and the mutations on the Entropy menu: RT on a pad, M on a keyboard.
- Added: the Entropy menu lists the rewards of the difficulty under the mutations, each with the Entropy it needs, and counts how many you have reached.
- Changed: the pause menu's mod list is a box in the top right corner. A long list scrolls by itself.
- Changed: on the character select the hero's picture stands behind the platform and a little lower, so its top is no longer cut.
- Fixed: long Legacy skill names on the character select ran past their place or broke one letter onto a second line. They now shrink to fit.

## 0.1.15 (2026-11-11)
- Fixed: on a 16:9 screen the button prompts on the character select lay over the bottom edge of the Evotypes panel. The panel now sits above them.
- Fixed: the Legacy menu's build panel left empty places for tactics that an older saved Evotype holds and the game no longer has. It now counts the tactics it shows and says how many are no longer in the game.

## 0.1.14 (2026-11-11)
- Fixed: on a 16:9 screen the Legacy menu's STARTING TACTICS title was wider than the middle of the screen and was cut at both ends.
- Fixed: on a 16:9 screen the longer colour names on the Colours tiles were cut. They now shrink to fit.
- Changed: the Starting Tactics row on the Legacy menu shows how many tactics are picked in its second line, so the IN USE mark has room.
- Fixed: the build panel said "1 tactics".

## 0.1.13 (2026-11-11)
- Added: each tile on the Colours screen shows the hero's head and chest in that colour, with the colour's five main colours as a strip under the picture.
- Added: a curtain covers the room for about a second when you open the Colours screen, while the camera moves to the hero and the pictures are taken. Opening the same hero's colours again skips the pictures.
- Fixed: a hero with fewer colours than the hero you looked at before showed one extra colour at the end of the list.
- Known: the hero cannot play moves on this screen yet, and the room does not take the colour. These changes were checked in a test window and are not in an installed build yet.

## 0.1.12 (2026-11-11)
- Changed: the Colours screen is rebuilt in the style of the new character select. Every colour is a tile on the left showing its five main colours, with a tag when you are wearing it, when it comes with a DLC or when it is locked.
- Changed: the camera moves closer to the hero while the Colours screen is open, so the hero stands about three times as tall as before.
- Added: the right side shows the colour's name, its palette, whether it changes the hero's effects, and its colours beside the ones you wear now.
- Added: four filter tabs (All, Owned, Effects, Made), stepped with LB / RB or Q / E.
- Added: X shows the hero in the colour you wear now, and a second press goes back to the colour you were looking at.
- Fixed: after you looked at one hero's colours, the next hero's tiles could show the first hero's colours.
- Known: the tiles do not show the hero in each colour yet, the hero cannot play moves on this screen yet, and the room does not take the colour. These changes were checked in a test window and are not in an installed build yet.

## 0.1.11 (2026-11-11)
- Changed: the pause menu's mod list shows one mod on each line, with its name on the left and its version on the right. Mods that are only for development are listed under their own heading.
- Changed: the pause menu leaves the ID line out when the game has no ID to show.
- Fixed: on the Legacy menu the button prompts lay over the third row of build icons. The build panel now ends above the prompts.
- Fixed: on the character select and the Legacy menu the last button prompt lay over the mark in the corner of the right panel.
- Changed: with No Legacy picked, the two lines in the middle of the Legacy menu stand on a dark plate so they can be read against the background.
- Changed: text is reworded in the Legacy menu, the Partner, Colours and Mind Crystals panels, the lobby rules, the online page and the Redux settings tab.
- Known: three of the 14 tactics of one saved build show no icon in the build panel. These changes were checked in a test window and are not in an installed build yet.

## 0.1.10 (2026-11-10)
- Changed: the character select is rebuilt. The roster is a panel on the left (heads or a list), the hero stands on a stage in the middle with an effect of its group, and the hero's sheet is on the right: the moveset video playing, Health, Attack and MP, the Legacy skills and talent.
- New: heroes on the roadmap show in their group as coming soon, with their picture. Kris, Susie and Ralsei are one entry.
- Changed: every mod hero's icon shows the face, and Izanami, Nine and Reki stand on their own full pictures.
- Changed: the Legacy menu is rebuilt in the same style. Choosing an Evotype only sets it; the run starts from the START DIVE button alone. Legacy I and II are two buttons at the top.
- New: Order, Heroes and Elements open small pop-ups: strongest or weakest first, hero icons you switch on and off, element switches.
- New: Starting Tactics is its own menu. Pick up to four tactics your Evotypes hold; while any are picked, the run starts with them and with no Legacy skill or talent.
- New: Settings has a Redux tab: hero icons as diamonds or squares, and menu effects Full or Calm.
- Fixed: after leaving the character select it opens again, and the hero can move.
- Fixed: mouse clicks on the select and the Legacy menu choose what is under the pointer.
- Known: the coming-soon pictures load from the development folder; the button prompts do not show on the Legacy menu; the tactic filter still opens the older picker.

## 0.1.9 (2026-11-10)
- Changed: the pause menu is rebuilt. The entries are a list down the left side of the screen, with larger text. Your name, ID and money sit together on one plate under the centre. The mod list fills the right side.
- New: the centre of the pause menu is a live core with its own effect, drawn sharp at any screen size. It opens in three beats, and the entry you move onto lights up with a sweep and an underline.
- New: a mod list too long for the screen scrolls by itself, down and back, with a mark showing where it is.
- Changed: money is shown in full with separators (1,689,522) and no longer cut off.
- Checked at 3440 x 1440 and 1920 x 1080.

## 0.1.8 (2026-11-10)
- Changed: the Entropy menu is remade. Every modifier is now a row in a list with its full sentence, its rank as pips and the Entropy it adds. Up and down pick a modifier, left and right lower and raise its rank. The picked modifier's ranks, with what each one does and costs, are listed on the right.
- New: the centre of the Entropy menu is a live core that shows your total against your limit, with a mark for every perk. It gains effects as your Entropy rises and turns amber near the limit.
- New: a strip under the core shows every modifier's rank at once.
- New: raising a rank, reaching a perk and changing difficulty each play their own effect.
- Changed: a locked difficulty shows a lock on its tab and what unlocks it, and takes no rank changes.
- Changed: Raise and Lower grey out when a modifier is at its highest or lowest rank, or when the next rank costs more Entropy than you have to spare.
- Fixed: the pause menu's cards stayed visible behind any screen opened from it (Training Details, the codexes, Settings). They now step aside while another screen is open and come back when it closes.
- New: move onto a Mutation, or hold the mouse over it, and its name and what it does are shown on the right, with whether it is on, off or locked.
- Changed: the whole Entropy menu takes the colour of the difficulty: the panels, the rows of modifiers that are on, the picked row, the tabs, the rank you are on and the Raise and Lower buttons.
- Changed: on a wide screen the space beside the panels shows falling glyphs in the difficulty's colour.
- The stock list is still one press away: Y (pad) or L (keyboard).

## 0.1.7 (2026-11-10)
- New: the Entropy menu has a list view. Press Y (pad) or L (keyboard) in the Entropy menu to switch between the dial and the list, which shows every modifier's full sentence, its rank and its Entropy cost in one column. The game remembers which one you used. The dial is still where a new player starts.
- New: the Legacy page can sort weakest first. Press LB / RB (Q / E) to step from Power to Weakest, or press the Power chip again. The page now remembers the order you picked, and starred Evotypes stay at the top in every order.
- Fixed: starting a run with No Legacy played the hero's entrance twice. It now plays once, as in the base game.
- Fixed: one push of the analog stick in the pause menu and the Entropy menu could move the selection two places. A push now moves one place, and holding it still repeats.
- Fixed: the Confirm and Cancel buttons were missing on the prompt that asks before you leave from the pause menu. They show again.
- Fixed: opening Colours right after moving to another hero could show the hero you had picked before. Colours now waits until the new hero is standing in the room.

## 0.1.6 (2026-11-07)
- Changed: Colours on the character select has its own button, RT on a pad and Space or C on a keyboard. It shared a button with Video before, so only Video answered. Y now switches the hero list (below); on the Legacy page Y still opens the filters.
- New: the hero list. Press Y (pad) or L (keyboard) on the character select to see every hero from every group in one list, eight rows at a time, with each hero's group and lock or DLC state. LB / RB (Q / E) sorts it by group, by name or owned first. Press Y or L again for the grid. The game remembers which one you used.
- New: colours that change the hero's effects are marked in the Colours panel: ◆ for tinted effects, ◆ FX for a colour with its own effects. The diamond is drawn in the effect colour.
- New: switch an Evotype's Legacy skill on the Legacy page with X (pad and keyboard). It uses the game's own switch, so the same rule applies: the hero's Boss Rush must be finished.
- New: star your favourite Evotypes with R3 (pad) or R (keyboard) on the Legacy page. Starred ones stay at the top of the list in every sort, and the stars are kept between sessions.
- New: a Triple Dash & Jump switch on the Legacy page, beside Starting Tactics. With it on, your runs start with three dashes and three jumps, the same ones the heroes' own cards give. It is off by default and does nothing in a Four Player lobby.
- Changed: the screens no longer tilt with the mouse or sway on their own, so on a controller nothing moves while you choose. The tilt can come back with `"tilt": true` in ReduxMenus.json (the game's data folder).
- Every DLC ownership check stays as it is.

## 0.1.5 (2026-11-07)
- New: the lobby's rules board has a Netcode row. The host picks Lockstep (the default) or the experimental Rollback, which Four Player 0.3.39 uses for the fight. Rollback shows in the rules summary line when it is on. With six rules the rows sit a little closer and smaller so they all fit above the description.

## 0.1.4 (2026-11-06)
- New: the Entropy menu is rebuilt as the Entropy Dial: one screen coloured per difficulty, with moving light, animated text, controller and keyboard navigation, and support for ultrawide screens. The stock menu stays underneath it, and every number on the dial is read from the stock menu.

## 0.1.3 (2026-11-05)
- New: the pause menu in the Redux look. Its choices are tiles in a grid with Settings and End Trial under them, the mod list sits on the right, and the light moves across it.
- New: the dev menu in the Redux look, in gold. Each row is a card, switches show an ON / OFF lamp, a Potential shows its icon, and the page title, the path you are on and the status line are easier to read. Every page, key and command works as before.
- Fixed: in the pause menu, moving the cursor could land on a hidden button, skip the Settings and End Trial buttons, or jump two rows. Every direction now goes to the tile or button next to it.
- Fixed: the CROSS EFFECT tab name ran past the edges of its tab, and a small group tag sat across the corner of the hero card.

## 0.1.2 (2026-11-03)
- Fixed: after you picked a hero, the Legacy page could show only its backdrop and a white box. Two of its pictures were missing from the 0.1.1 package; they are in now.
- If one of the Legacy page's pictures is ever missing again, the page falls back to the plain Legacy list instead of a half-drawn screen.

## 0.1.1 (2026-11-03)
- The character select is rebuilt: the hero stands in a neon-lit room with drifting fog and embers, and the light keeps moving while you choose.
- Colours, Mind Crystals and Legacy each have a new layout. Y previews a colour, X plays the hero's video, and X levels up the Mind Crystal under the cursor.
- Hero groups and the Switch tab work on the new select as they did before.
- The lobby screen gets the same light, with slow moving colour across the plates at the top.
- A list longer than the screen shows a scroll bar.
- Button prompts are bigger and easier to read from the couch.
- A game window in the background no longer reacts to the keyboard or the pad.
- Every DLC ownership check stays as it is.

## 0.1.0 (2026-10-25)
- New mod. The screens that used to come with Four Player now live here: the character select with its Colours, Mind Crystals and Partner panels, the Legacy selector, and the lobby screen.
- Switch it off and the stock screens are back. Four Player needs it on; the loader says so when it is not.
- Every DLC ownership check stays as it is.
