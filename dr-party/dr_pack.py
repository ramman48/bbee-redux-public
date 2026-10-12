"""dr_pack.py -- the DELTARUNE files an alpha TEST package carries (the lead, 2026-10-03; docs/deltarune/party/DECISIONS.md).

The importers read DELTARUNE's sprites, sounds and font from a DELTARUNE install on the machine that builds the mod.
A public alpha TEST package may carry the files the build uses instead, so a tester needs no DELTARUNE install. They
sit in <mod>/pack (made by make_pack.py on the developer's machine, from the developer's install):

  pack.json    {"stamp": [...], "made": "...", "version": "...", "files": {relative path: sha1}}
  frames/      dr_source.Frames' cache for the sprites the build uses (<sprite>_<i>.png, meta.json), the fonts
               (font_<name>.png / .json) and the target-mode labels (ui_labels.json)
  audio/       <sound>.wav for every cue, and info.json
  art/         the portrait art

When the folder is there the importers use it and never look for a DELTARUNE install. Without it nothing changes: the
install is read, as before (the default, and what a final release goes back to). Everything in a pack belongs to
DELTARUNE's owners; it is there for the test only.

  DRPARTY_PACK=<folder>   a pack somewhere else (the developer's check of a pack before it is packaged)
  DRPARTY_PACK=off        ignore an included pack
"""
import json, os, pathlib

HERE = pathlib.Path(__file__).resolve().parent


def folder():
    e = os.environ.get("DRPARTY_PACK", "")
    if e.lower() == "off":
        return None
    p = pathlib.Path(e) if e else HERE / "pack"
    return p if (p / "pack.json").exists() else None


def active():
    return folder() is not None


def manifest():
    return json.loads((folder() / "pack.json").read_text(encoding="utf-8"))


def stamp():
    """What dr_source / party_ui stamp their cached files with (the developer's data.win: size, mtime)."""
    return manifest()["stamp"]


def path(*parts):
    return folder().joinpath(*parts)


def missing(what):
    raise SystemExit("DELTARUNE: Party: %s is not in the included asset pack (%s): the package is incomplete."
                     % (what, folder()))
