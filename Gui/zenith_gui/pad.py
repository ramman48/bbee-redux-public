"""A game controller in the window (improvement 15): an Xbox-style pad through XInput, which Windows has built in and
which Proton gives a Steam Deck's controls too. Read 60 times a second:

  D-pad / left stick   up and down: the Library's list, else the previous / next control; left and right: the
                       previous / next control
  A                    Return to the control the focus is on (press it)       B      back: close, cancel
  X                    Space to that control (switch the chosen mod)          Y      the big button
  LB / RB              the previous / next page            Start  the big button;  Back  Options

A and X go to the focused control as key presses; the rest are `action` names the window acts on, because a key
press made in code does not reach the window's shortcuts. No pad, or no XInput (another system): nothing happens."""
import ctypes
import os

from PySide6.QtCore import QEvent, QObject, Qt, QTimer, Signal
from PySide6.QtGui import QGuiApplication, QKeyEvent


class _Gamepad(ctypes.Structure):
    _fields_ = [("buttons", ctypes.c_ushort), ("lt", ctypes.c_ubyte), ("rt", ctypes.c_ubyte),
                ("lx", ctypes.c_short), ("ly", ctypes.c_short), ("rx", ctypes.c_short), ("ry", ctypes.c_short)]


class _State(ctypes.Structure):
    _fields_ = [("packet", ctypes.c_uint), ("pad", _Gamepad)]


UP, DOWN, LEFT, RIGHT, START, BACK = 0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020
LB, RB, A, B, X, Y = 0x0100, 0x0200, 0x1000, 0x2000, 0x4000, 0x8000
STICK = 16000            # how far the stick goes before it counts as a press
REPEAT_AFTER, REPEAT_EVERY = 24, 6     # frames: a held direction repeats, as a held key does


def _xinput():
    if os.name != "nt": return None
    for name in ("xinput1_4", "xinput1_3", "xinput9_1_0"):
        try:
            lib = getattr(ctypes.windll, name)
            lib.XInputGetState.argtypes = [ctypes.c_uint, ctypes.POINTER(_State)]
            lib.XInputGetState.restype = ctypes.c_uint
            return lib
        except (OSError, AttributeError):
            continue
    return None


class Pad(QObject):
    """`action` names: "up", "down", "left", "right", "back", "primary", "pageNext", "pagePrev", "options", and
    "accept" / "switch" when no control has the focus. `used` is emitted at each press (the focus is shown then).
    read: tests give their own reader, () -> the buttons held (the bits above) or None for no pad."""
    action = Signal(str)
    used = Signal()
    KEYS = {A: (Qt.Key.Key_Return, "accept"), X: (Qt.Key.Key_Space, "switch")}
    ACTIONS = {UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right", B: "back", Y: "primary", START: "primary",
               RB: "pageNext", LB: "pagePrev", BACK: "options"}

    def __init__(self, parent=None, read=None):
        super().__init__(parent)
        self._lib = None if read else _xinput()
        self._read = read or self._read_xinput
        self._held, self._frames, self._which, self._quiet = 0, {}, 0, 0
        self._timer = QTimer(self)
        self._timer.setInterval(16)
        self._timer.timeout.connect(self.poll)
        if self._lib is not None or read: self._timer.start()

    @property
    def available(self): return self._lib is not None

    def _read_xinput(self):
        """the buttons of the first connected pad, with the left stick as the D-pad; None when there is none"""
        lib = self._lib
        if lib is None: return None
        state = _State()
        for i in (self._which, 0, 1, 2, 3):
            if lib.XInputGetState(i, ctypes.byref(state)) == 0:
                self._which = i
                g = state.pad
                b = g.buttons
                if g.ly > STICK: b |= UP
                if g.ly < -STICK: b |= DOWN
                if g.lx < -STICK: b |= LEFT
                if g.lx > STICK: b |= RIGHT
                return b
        return None

    def poll(self):
        if self._quiet > 0:          # no pad: look again once a second, not 60 times
            self._quiet -= 1
            return
        buttons = self._read()
        if buttons is None:
            self._held, self._quiet = 0, 60
            return
        pressed = buttons & ~self._held
        for bit in list(self.KEYS) + list(self.ACTIONS):
            if buttons & bit:
                n = self._frames.get(bit, 0) + 1
                self._frames[bit] = n
                repeat = bit in (UP, DOWN, LEFT, RIGHT) and n > REPEAT_AFTER and (n - REPEAT_AFTER) % REPEAT_EVERY == 0
                if pressed & bit or repeat: self._press(bit)
            else:
                self._frames.pop(bit, None)
        self._held = buttons

    def _press(self, bit):
        self.used.emit()
        if bit in self.ACTIONS: self.action.emit(self.ACTIONS[bit]); return
        key, fallback = self.KEYS[bit]
        app = QGuiApplication.instance()
        target = app.focusObject() if isinstance(app, QGuiApplication) else None
        if target is None or (isinstance(app, QGuiApplication) and target is app.focusWindow()):
            self.action.emit(fallback); return
        text = "\r" if key == Qt.Key.Key_Return else " "
        none = Qt.KeyboardModifier.NoModifier
        QGuiApplication.sendEvent(target, QKeyEvent(QEvent.Type.KeyPress, key, none, text))
        QGuiApplication.sendEvent(target, QKeyEvent(QEvent.Type.KeyRelease, key, none, text))
