# Giving a mod its own settings

A mod can offer the player choices: a voice language, a costume colour, a harder version of a fight. The player picks
before installing, and the loader builds the mod with what was picked. This page is for mod authors.

## Declaring a setting

In `mod.json`, beside `"content"`:

```json
"settings": [
  {
    "id": "voice",
    "name": "Voice",
    "about": "The language of her voice lines.",
    "default": "jp",
    "options": [
      { "value": "jp", "label": "JAPANESE" },
      { "value": "en", "label": "ENGLISH",
        "content": { "tables": { "ActorVoiceConf": [ { "Id": 190001, "Bank": "en" } ] } } }
    ]
  }
]
```

- `id`: a short name that never changes. The player's choice is stored under it.
- `name` and `about`: what the Terminal shows. Keep `about` to one sentence.
- `options`: two or three. Each has a `value` (text, a number, `true` or `false`) and a `label` of one or two short
  words, which the Terminal shows in capitals.
- `default`: the value used until the player chooses. Without it, the first option.

## What an option changes

An option may carry `"content"`, written exactly like the mod's own `"content"`. When the option is chosen, the
loader lays it over the mod's content before building:

- **Table rows, script patches, clones** (lists): the option's entries are added after the mod's own. A row with the
  same key as one of the mod's rows overrides the fields it names.
- **Text keys, whole script files** (named values): the option's value replaces the mod's.

An option without `"content"` changes nothing: it is the mod as written. Make the default one of those, so the mod
is complete without any setting.

## Where the choice is kept

Per game, in that game's `profile.json`, next to the list of mods that are switched on:

```json
{ "enabled": ["char-example"], "settings": { "char-example": { "voice": "en" } } }
```

The Terminal writes it when the player picks. By hand it can be edited the same way. A value the mod no longer
offers falls back to the default.

A setting takes effect at the next install. The build log has one line per mod:

```
  settings char-example: voice = "en"
```

After an install the loader writes the values that went in to `installed_settings.json`, beside `installed.json`.

## Checking a mod

```
python tools/modsettings.py mods/char-example/mod.json
```

It prints the settings, or what is wrong with them. A mod whose settings are written wrongly still builds, as
written and without its settings, and the build log says why.

## What settings are not for

- **Anything that decides whether the mod may be built.** An ownership check stays in the importer and is not a
  setting.
- **Things the player changes while playing.** Those belong in the game's own menus.
