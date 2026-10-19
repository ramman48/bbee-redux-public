# Translating the Zenith Terminal's window

The Zenith Terminal is a mod manager window for the game BlazBlue Entropy Effect (a 2D action roguelite). Players use
it to switch mods on and off, install them into the game, update them, and back up their save. The window's words are
short, plain and direct, like a game's own menus.

Each language file (`<code>.json`) has `"words"`: every English line of the window as a key, with its translation as
the value. A value left empty shows in English.

## Rules

1. Translate every value. Keep every key exactly as it is.
2. Lines in CAPITALS stay in capitals in languages that have them (French, German, Spanish, Russian, Portuguese).
   Chinese, Japanese and Korean have no capitals: translate normally.
3. Keep spaces at the start and end of a line exactly. Many lines are pieces joined to other text: `" MODS"` follows a
   number, `"GET "` comes before one. A translation of `" MODS"` starts with a space too.
4. Keep `%s`, `%d` and `%1$s` placeholders: the same number of each. When the language needs the values in another
   order, number them: `%2$s ... %1$s`. Keep `\n` line breaks.
5. Do not translate names: The Zenith Terminal, Redux, BlazBlue, Entropy Effect, Steam, Steam Deck, Big Picture,
   Discord, GitHub, Ko-fi, Proton, Bottles, Linux, Windows, Krita, Python, the mods' and characters' names (Nine the
   Phantom, Izanami, Ruby Rose, Tactics Plus Ultra, Grim of the Abyss, DELTARUNE, Cross Effect), KittySkin, Soulve.
   Keep "Prototype" (the game's own list) as it is.
6. A sentence that names a button in capitals ("Press APPLY CHANGES") uses the same words as that button's own line.
7. Plain words, the length of the English where possible: buttons are narrow. No exclamation marks.
8. Simplified Chinese (zh-Hans), Traditional Chinese as used in Taiwan (zh-Hant), Japanese (ja), Korean (ko),
   French (fr), German (de), Spanish (es, neutral), Russian (ru), Brazilian Portuguese (pt-BR).
