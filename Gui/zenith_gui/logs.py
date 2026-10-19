"""The two logs the window shows on its LOG page, read into lines with the ones that need a look marked.

  the last job     what the loader printed the last time the window ran it (the window's own last_run.log)
  the last game    the game's Player.log from the last time it ran (Unity writes it; it is replaced at every start)

Nothing here writes a file. A line is {"text", "kind"} with kind "error", "warn" or "" (nothing to see).
"""
import os
import re
import time

MOST_LINES = 600
MOST_BYTES = 2 << 20             # only the end of a long game log is read
# lines about owning or having another game: left out of what the window shows (the file itself keeps them)
_OTHER_GAME = re.compile(r"(centralfiction|cross tag|bbtag)", re.I)

_JOB_ERROR = re.compile(r"^\s*(PROBLEM:|REFUSING|BUILD ABORTED|ERROR\b|CONFLICT\b|Traceback \(most recent call last\)|\w*(Error|Exception):)")
_JOB_WARN = re.compile(r"^\s*(WARNING\b|NOTE\b)|not kept\b")
# what goes wrong in a modded game, as the game itself writes it (the loader's `doctor` looks for the same things)
_GAME_ERROR = re.compile(r"SyntaxError|c# exception|Exception: |TypeError|ReferenceError|RangeError|unhandledRejection|\|Error\||"
                         r"NullReferenceException|MissingReferenceException|Crash!!!|表格.*没有找到", re.I)
_GAME_WARN = re.compile(r"Missing localization|Texture Original Size|\|Warn(ing)?\||could not be loaded|is missing", re.I)
_STACK = re.compile(r"^\s*(at |\(Filename: |UnityEngine\.|System\.|Puerts\.|\[ line \d+\])")


def _kind(text, error, warn):
    if error.search(text): return "error"
    if warn.search(text): return "warn"
    return ""


def _stamp(path):
    try: return time.strftime("%Y-%m-%d %H:%M", time.localtime(os.path.getmtime(path)))
    except OSError: return ""


def _result(lines, when, head, empty):
    problems = sum(1 for line in lines if line["kind"] == "error")
    warns = sum(1 for line in lines if line["kind"] == "warn")
    return {"lines": lines, "when": when, "head": head, "problems": problems, "warns": warns, "empty": "" if lines else empty}


def last_job(path):
    """the window's last_run.log: its first line is "<date time>  <what ran>  <ok or error>" """
    try:
        with open(path, encoding="utf-8", errors="replace") as f: raw = f.read().splitlines()
    except OSError:
        return _result([], "", "", "Nothing has been run from this window yet.")
    head = raw[0].split("  ") if raw else []
    when, what, how = (head + ["", "", ""])[:3]
    lines = [{"text": text.rstrip(), "kind": _kind(text, _JOB_ERROR, _JOB_WARN)} for text in raw[1:]
             if text.strip() and not _OTHER_GAME.search(text)]
    title = "%s%s" % (what.strip(), {"ok": ": finished", "error": ": stopped with a problem"}.get(how.strip(), ""))
    return _result(lines[-MOST_LINES:], when.strip()[:16], title, "That run printed nothing.")


def last_game(path, only_problems=False):
    """the game's Player.log. A stack of `at ...` lines under an error belongs to it and is marked with it."""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            if size > MOST_BYTES: f.seek(size - MOST_BYTES); f.readline()
            raw = f.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return _result([], "", "", "The game has not written a log yet. It writes one each time it runs.")
    lines, under = [], ""
    for text in raw:
        text = text.rstrip()
        if not text.strip(): under = ""; continue
        if _OTHER_GAME.search(text): continue
        kind = _kind(text, _GAME_ERROR, _GAME_WARN)
        if not kind and under and _STACK.search(text): kind = under        # the lines under an error are its trace
        else: under = kind if kind == "error" else ""
        if only_problems and not kind: continue
        lines.append({"text": text[:400], "kind": kind})
    empty = "No problems in the game's last run." if only_problems else "The game's log is empty."
    return _result(lines[-MOST_LINES:], _stamp(path), "The game's last run", empty)


def text_of(view):
    """a view as plain text, for the clipboard"""
    head = "%s  %s" % (view.get("when", ""), view.get("head", ""))
    return "\n".join([head.strip(), ""] + [line["text"] for line in view.get("lines", [])]).strip() + "\n"
