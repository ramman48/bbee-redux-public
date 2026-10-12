"""terminal_art.py -- Ruby's picture for a mod loader's window (The Zenith Terminal's Library and Home pages).

  python mods/char-ruby/terminal_art.py        -> mods/char-ruby/art/portrait_full.png

Made on the player's machine, like the rest of her art: her whole Cross Tag Battle figure (art_main_36rrb, from an
alpha package's own files or from the player's Cross Tag Battle install), cropped the way her character-select
portrait is. The picture is never part of a package. A loader's window that knows `terminal.json` runs this as one
of her `prepare` steps, after build_ruby.py; nothing in the game uses the file.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path[:0] = [TOOLS, os.path.join(TOOLS, "tools", "bbtag"), HERE, ROOT]


def main():
    import ruby_ui
    import rrb_portrait
    figure = ruby_ui.ui_images()["figure"]
    full = rrb_portrait.compose_full(figure)
    out = os.path.join(HERE, "art", "portrait_full.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    full.save(out)
    print("Ruby's Library picture: %s (%d x %d)" % (os.path.relpath(out, ROOT), full.size[0], full.size[1]))


if __name__ == "__main__":
    main()
