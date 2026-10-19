"""What the window asks about the PC it is on: whether it is being recorded, where and how large it opens, and the
size and place it was left at (`window.json` in the window's own `user` folder)."""
import json
import os

from PySide6.QtCore import Property, QCoreApplication, QEvent, QObject, Qt, Signal, Slot

BASE = (1280, 720)           # the size the screens are drawn for
SMALLEST = (960, 540)        # below this the smallest words can no longer be read
OFF_SCREEN = (-6000, 60)     # where a recording's window is put: it is drawn, and nobody sees it


def _whole(value):
    """a whole number that was written as one (true and false are not sizes)"""
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def fit_opening(saved, screens, primary=0):
    """Where and how large the window opens.

    saved    what the last run left: {"x", "y", "width", "height", "maximized"}, or anything else for a first run
    screens  the usable area of each screen: [(x, y, width, height)]; primary: which of them is the main one

    The window is never larger than the screen it opens on and never hangs over its edge. A place that is on no
    screen any more (a second screen that was unplugged) becomes the middle of the main one."""
    width = height = x = y = None
    if isinstance(saved, dict):
        width, height, x, y = (_whole(saved.get(k)) for k in ("width", "height", "x", "y"))
    if not width or not height or width < 1 or height < 1:
        width, height, x, y, saved = BASE[0], BASE[1], None, None, None
    at = None
    if x is not None and y is not None:
        cx, cy = x + width / 2, y + height / 2
        at = next((s for s in screens if s[0] <= cx < s[0] + s[2] and s[1] <= cy < s[1] + s[3]), None)
    placed = at is not None
    sx, sy, sw, sh = at or screens[primary]
    width = min(max(width, min(SMALLEST[0], sw)), sw)
    height = min(max(height, min(SMALLEST[1], sh)), sh)
    if placed:
        x = min(max(x, sx), sx + sw - width)
        y = min(max(y, sy), sy + sh - height)
    else:
        x, y = sx + (sw - width) // 2, sy + (sh - height) // 2
    return {"x": x, "y": y, "width": width, "height": height, "maximized": bool(saved and saved.get("maximized") is True)}


def _qt_screens():
    """the usable area of each screen Qt knows, and which is the main one"""
    from PySide6.QtGui import QGuiApplication
    screens = QGuiApplication.screens()
    areas = [(a.x(), a.y(), a.width(), a.height()) for a in (s.availableGeometry() for s in screens)]
    main = QGuiApplication.primaryScreen()
    return areas or [(0, 0) + BASE], (screens.index(main) if main in screens else 0)


class Shell(QObject):
    """data_dir  where window.json is kept (none: nothing is remembered)
    capture   a recording or a test: the window is off the screen at `size` and remembers nothing
    keep      false for a window that only shows the screens (--demo): it opens where it was left and writes nothing
    screens   tests name their own screens: a function returning ([(x, y, width, height)], main)"""

    def __init__(self, data_dir=None, capture=False, size=None, keep=True, screens=None, parent=None):
        super().__init__(parent)
        self._path = os.path.join(data_dir, "window.json") if data_dir else None
        self._capture = bool(capture)
        self._size = tuple(size) if size else BASE
        self._keep = bool(keep) and not self._capture
        self._screens = screens or _qt_screens
        self._keys = False
        app = QCoreApplication.instance()
        if app is not None: app.installEventFilter(self)

    keysChanged = Signal()

    @Property(bool, constant=True)
    def capture(self): return self._capture

    @Property(bool, notify=keysChanged)
    def keys(self):
        """the keyboard is being used to move between controls: true from a Tab until the next press of the mouse"""
        return self._keys

    def eventFilter(self, watched, event):
        kind = event.type()
        if kind == QEvent.Type.KeyPress and event.key() in (Qt.Key.Key_Tab, Qt.Key.Key_Backtab): now = True
        elif kind == QEvent.Type.MouseButtonPress: now = False
        else: return False
        if now != self._keys:
            self._keys = now
            self.keysChanged.emit()
        return False

    @Slot(result="QVariantMap")
    def opening(self):
        if self._capture:
            return {"x": OFF_SCREEN[0] - self._size[0], "y": OFF_SCREEN[1], "width": self._size[0], "height": self._size[1],
                    "maximized": False}
        saved = None
        if self._path:
            try:
                with open(self._path, encoding="utf-8") as f: saved = json.load(f)
            except (OSError, ValueError):
                saved = None
        areas, main = self._screens()
        return fit_opening(saved, areas, main)

    @Slot(int, int, int, int, bool)
    def remember(self, x, y, width, height, maximized):
        """the size and place the window has as a plain window, and whether it fills the screen now"""
        if not self._keep or not self._path or width < 1 or height < 1: return
        try:
            os.makedirs(os.path.dirname(self._path), exist_ok=True)
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump({"x": int(x), "y": int(y), "width": int(width), "height": int(height), "maximized": bool(maximized)}, f)
        except OSError:
            pass                 # a folder that cannot be written: the window opens at its first size next time
