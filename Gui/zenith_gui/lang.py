"""The Terminal in other languages (improvement 18).

The window's words go through Qt's qsTr; this translator answers from zenith_gui/lang/<code>.json, a plain map of the
English words to the language's own. Lines the Python side fills in ("%s is back on %s.") are found by their template
after they are filled: the values go into the translated template, and a value that is itself a known line is
translated too. An English plural ending ("%d mod%s" filled with "s") is dropped in languages that do not
make plurals that way. A line missing from a file stays in English. Switching language takes effect at once (the engine
re-reads every qsTr). The files are machine-drafted and are checked by players who speak the language;
tools/lang_extract.py lists every line the window says and keeps the files in step with it."""

import json
import os
import re

from PySide6.QtCore import QTranslator

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = os.path.join(HERE, "lang")
_table = {}
_templates = []          # [(strict regex, loose regex, its translation, its plural slots)], longest English first
S_PLURALS = {"fr", "es", "pt-BR", "de"}     # languages whose translations keep the English "s" ending
_code = "en"
_SLOT = re.compile(r"%(?:(\d)\$)?([sd])")


def _pattern(english, known=None):
    """the English template as a regex. With `known` (the plain lines, as one alternation), a %s straight after
    another value is first tried as one of those lines, an "s" or nothing ("back on %s%s." filled with "0.7.1" and
    " and in your game"), so the value before it is not swallowed"""
    out, at, last = [], 0, -1
    for m in _SLOT.finditer(english):
        out.append(re.escape(english[at:m.start()]))
        if m.group(2) == "d": out.append(r"(\d+)")
        elif known and m.start() == last: out.append("(" + known + "|s|)")
        else: out.append(r"(.*?)")
        at = last = m.end()
    out.append(re.escape(english[at:]))
    return re.compile("".join(out) + r"\Z", re.S)


def _plurals(english):
    """which of the template's values are an English plural ending: a %s straight after a letter ("mod%s")"""
    slots = list(_SLOT.finditer(english))
    return {i for i, m in enumerate(slots)
            if m.group(2) == "s" and english[m.start() - 1:m.start()].isalpha() and (i == 0 or slots[i - 1].end() != m.start())}


def load(code):
    """the lines of one language ("en" or a missing file: English); True when the language changed"""
    global _code
    code = str(code or "en")
    if code == _code: return False
    words = {}
    if code != "en":
        try:
            with open(os.path.join(FOLDER, code + ".json"), encoding="utf-8") as f: found = json.load(f)
            words = {str(k): str(v) for k, v in (found.get("words") or {}).items() if isinstance(v, str) and v}
        except (OSError, ValueError, AttributeError):
            words = {}
    _table.clear()
    _table.update(words)
    known = "|".join(re.escape(k) for k in sorted((k for k in words if not _SLOT.search(k)), key=len, reverse=True))
    _templates[:] = [(_pattern(k, known), _pattern(k), v, _plurals(k))
                     for k, v in sorted(((k, v) for k, v in words.items() if _SLOT.search(k)), key=lambda kv: -len(kv[0]))]
    _code = code
    return True


def code(): return _code


def _fill(template, values):
    """the values into a translated template: %s / %d in order, or %1$s / %2$s by number"""
    order = iter(range(len(values)))

    def one(m):
        i = int(m.group(1)) - 1 if m.group(1) else next(order, None)
        return values[i] if i is not None and 0 <= i < len(values) else ""
    return _SLOT.sub(one, template)


def find(text):
    """the line in the chosen language, or None when it has none"""
    if not _table or not text: return None
    got = _table.get(text)
    if got is not None: return got
    for strict, loose, translated, plurals in _templates:
        m = strict.match(text) or loose.match(text)
        if m:
            keep = _code in S_PLURALS
            # a value may itself be a line or a filled line ("2 mods" in "%s ready to install"): translated too
            return _fill(translated, ["" if i in plurals and v in ("s", "") and not keep
                                      else (find(v) or v) if len(v) < len(text) else v
                                      for i, v in enumerate(m.groups())])
    return None


def t(text):
    """one line in the chosen language (English when it has none)"""
    got = find(text)
    return text if got is None else got


class Words(QTranslator):
    """Qt asks this for every qsTr; None leaves the English words"""
    def translate(self, context, source, disambiguation=None, n=-1):  # noqa: ARG002
        return find(source)

    def isEmpty(self): return False
