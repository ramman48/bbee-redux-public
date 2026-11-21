# Colour Maker: patch notes

## 0.2.13 (2026-11-21)
- Fixed: leaving the Colour Maker left you standing in Try Out with no maker and no controls. The way out depended on a piece of our own test tools that the released mods don't carry, so LEAVE closed the maker and went nowhere. The maker now takes you to the hub itself.
- Changed: if the way out ever fails again, you get your controls and the HUD back after 20 seconds instead of staying locked.

## 0.2.12 (2026-11-20)
- Fixed: the effect tint now replaces an attack's own colour instead of mixing with it. The particles of your hero's effects lose their own hue before your colour goes on, and each effect layer's grayscale switch is turned on, so a blue slash under an orange tint is orange, not murky. Taking the tint off gives every effect its own colours back.

## 0.2.11 (2026-11-20)
- Fixed: leaving the Colour Maker could end in your hero standing in Try Out with the maker coming back. LEAVE (or holding B or Backspace) now leaves once, locks the hero while the way out loads, and nothing (Start, Esc, TRY MOVES) can bring the maker back until you are out. If Try Out is still up after a few seconds, the way out is asked again.
- Fixed: pressing Esc to try your moves also counted as holding B, because the game binds Esc to both. Esc now only hides and shows the maker.
- Fixed: after you changed one palette's glow, the glow of the hero's other palettes could turn into the first one's colour. The hero's own glow is now read again whenever its palette changes.
- Changed: the hero is free to move again as soon as you are back in the hub.

## 0.2.9 (2026-11-14)
- Changed the hero cards of the added characters to match the base roster's: each shows the character's portrait at
  the same size and crop, on a card in the character's own colour instead of the shared gold one.
- Changed Izanami's card to her full portrait instead of her crest.
- Removed ICEY, The Prisoner and Reki from the hero choice. Their colours can't be changed in the Colour Maker yet,
  and picking them used to leave you in Try Out with no maker.

## 0.2.8 (2026-11-12)
- Fixed a made colour dropping back to the hero's own for a moment while the hero's pictures were still loading.

## 0.2.7 (2026-11-09)
- No more coloured squares with the effect tint. Some effects carry a see-through layer that bends or lights what is
  behind it (Jin's slashes and the effects made from them, Weiss's among them). The tint coloured those layers too, and
  each one showed as a solid square. They now keep their own look and only the effect itself takes your colour.
- New effects show your tint from their first frame. Before, they flashed their own colour for a moment.
- Taking the tint off gives every effect its own colours back, including effects the game keeps for the next move.
- Your hero stands in the middle again when the Colour Maker opens. Moving while it loaded could leave the hero off to
  one side, half behind a board. The controls now wait until the maker is up, and the hero is put back on the spot it
  arrived on each time the maker opens, also after you try your moves.
- Zoom in further: four more steps past the old closest view, so the hero can be shown about one and a half times as
  large as before.

## 0.2.6 (2026-11-07)
- Brighter, truer view. In Try Out the hero now stands in front of a flat grey backdrop, and the room's coloured lights
  turn neutral white, so the colours you pick look like themselves. VIEW (or L) switches between grey, light grey,
  dark grey and the room as the game draws it.
- Trying your moves works again. Start (Esc on a keyboard) did nothing while the Colour Maker was open; now it hides
  the maker so you can move and attack in the palette you are making, and brings it back. There is also a TRY MOVES
  button.
- Click a part of your hero (or point at it with the controller's cursor and press A) to pick the colour part that
  paints it.
- Type a colour: press the colour code under the big swatch (or H) and enter it as #RRGGBB.
- SIT STILL (or F) holds your hero in its idle pose while you colour, so it stops fidgeting. It lets go when you hide
  the maker to try moves.

## 0.2.5 (2026-11-06)
- Susanoo works in the Colour Maker. Before, his colours kept dropping back to normal, because his body switches between
  several sets of sprite sheets as he moves, even while standing still. Every set now gets your colours, and they stay
  on through every move, in Try Out, in runs and after a restart.
- His colour parts are now read from all of his sprite sheets, so every part of his body can be picked. If you opened
  him in an older version, the parts are read again the first time you open him.
- Susanoo's card in the hero choice now shows his face in the middle.

## 0.2.4 (2026-10-23)
- The glowing outline is now its own colour, "glow line", next to the main glow. Before, it always took the main glow's colour.
- Palette codes made before 0.2.4 look the same as before. Codes that change the glow line need 0.2.4 or later to open.

## 0.2.3 (2026-10-23)
- SAVE now puts your palette on as well, so it stays on your hero after you leave the Colour Maker.
- Leaving with unsaved changes asks whether to save and wear them.
- The preview camera starts closer to your hero. Zoom with the mouse wheel, + and -, Page Up and Page Down, or the right stick.
- Your own hero's custom palette is painted at a higher resolution, so it looks sharper when the camera is close.
