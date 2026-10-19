# The Zenith Terminal: notices

The Zenith Terminal is an unofficial, fan-made mod loader for BlazBlue Entropy Effect. It is not made, endorsed or
supported by 91Act or Arc System Works. BlazBlue Entropy Effect and BlazBlue belong to their owners, and so do the
characters that mods add.

## People

- Redux, its characters, and this window's design and direction: Soulve.
- The mod loader the window runs: KittySkin.

## Open-source parts the window uses

| Part | Licence | Where its licence text is |
|---|---|---|
| Qt for Python (PySide6) and Qt 6, used unmodified as separate libraries | GNU Lesser General Public License v3 | `licences\LGPL-3.0.txt`, with the GNU General Public License v3 it builds on in `licences\GPL-3.0.txt` |
| Aldrich (typeface; copyright 2011 Matthew Desmond, MADType) | SIL Open Font License 1.1 | `zenith_gui\fonts\OFL-aldrich.txt` |
| Chakra Petch (typeface; copyright 2018 The Chakra Petch Project Authors) | SIL Open Font License 1.1 | `zenith_gui\fonts\OFL-chakrapetch.txt` |
| Share Tech Mono (typeface; copyright 2012 Carrois Type Design, Ralph du Carrois) | SIL Open Font License 1.1 | `zenith_gui\fonts\OFL-sharetechmono.txt` |

Qt and PySide6 are used as they are published. You can replace them with your own build: they are ordinary
packages in the Terminal's Python. Their source code is published by The Qt Company at <https://download.qt.io/>.

## Pictures

The window shows each mod's own pictures from that mod's folder. It carries none of its own, apart from the
Terminal's mark (`art\logo\`, made for the Terminal).
