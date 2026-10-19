"""Start The Zenith Terminal's window.

  python run_gui.py                              the window, on the loader found beside this folder (..\\Launcher),
                                                 or the one named by --launcher or the ZENITH_LAUNCHER variable
  python run_gui.py --launcher <folder>          another Launcher folder (the one holding entry_point.py)
  python run_gui.py --profile-root <folder>      tests: the loader's child processes see this as the user's profile
                                                 folder, and the game is never started
  python run_gui.py --demo                       nothing is started at all: the screens only
  python run_gui.py --capture <folder> [--frames 300] [--fps 60] [--script "150:page=library;300:select=1"]
                                                 no window on screen: the frames are written to the folder, each one
                                                 exactly one animation tick after the last, with the scripted cues at
                                                 their frames. Cues: page=home|library|options|support, select=<row>,
                                                 feature=<card>, cat=general|saves|interface|about, toggle=<mod id>,
                                                 set=<setting>:<value>, install, close, ask, cancel
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def settings():
    """zenith_gui.json beside this file, when there is one: {"launcher": folder, "profileRoot": folder}. It is how a
    preview is pointed at a test copy of the loader; a release has no such file and finds the loader beside itself."""
    try:
        with open(os.path.join(HERE, "zenith_gui.json"), encoding="utf-8") as f: return json.load(f)
    except (OSError, ValueError):
        return {}


def find_launcher(named):
    for folder in (named, os.environ.get("ZENITH_LAUNCHER"), settings().get("launcher"), os.path.join(HERE, "..", "Launcher"),
                   os.path.join(HERE, "..", "..", "Launcher")):
        if folder and os.path.isfile(os.path.join(folder, "entry_point.py")): return os.path.abspath(folder)
    return None


def main():
    ap = argparse.ArgumentParser(description="The Zenith Terminal")
    ap.add_argument("--launcher"); ap.add_argument("--profile-root"); ap.add_argument("--demo", action="store_true")
    ap.add_argument("--capture"); ap.add_argument("--frames", type=int, default=300); ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--script", default=""); ap.add_argument("--every", type=int, default=1)
    ap.add_argument("--probe", default=""); ap.add_argument("--size", default="")
    a = ap.parse_args()
    if a.capture:
        # one thread, so a frame is drawn when it is asked for; and every animation tick moves time on by the same
        # 16 ms however long the frame took to write, so the frames are evenly spaced (62.5 a second)
        os.environ.setdefault("QSG_RENDER_LOOP", "basic")
        os.environ.setdefault("QSG_FIXED_ANIMATION_STEP", "yes")
        os.environ.setdefault("QT_FORCE_STDERR_LOGGING", "1")      # what the screens complain about is printed
    elif sys.platform == "win32":
        # the taskbar shows the Terminal's own icon and groups its window under its own name, not Python's
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Redux.ZenithTerminal")
        except (AttributeError, OSError):
            pass

    import time

    from PySide6.QtCore import QUrl
    from PySide6.QtGui import QFontDatabase, QIcon
    from PySide6.QtQml import QQmlApplicationEngine
    from PySide6.QtQuickControls2 import QQuickStyle
    # QApplication, not QGuiApplication: the tray's menu is drawn by Qt Widgets on Windows (Qt.labs.platform).
    # A Terminal first installed before 0.5.0 has an Interpreter without Qt Widgets or Qt.labs.platform, and the
    # updater brings new window files but not a new Interpreter: there the window opens without the tray.
    try:
        from PySide6.QtWidgets import QApplication
        import PySide6
        tray_ok = os.path.isdir(os.path.join(os.path.dirname(PySide6.__file__), "qml", "Qt", "labs", "platform"))
    except ImportError:
        from PySide6.QtGui import QGuiApplication as QApplication
        tray_ok = False

    from zenith_gui import lang
    from zenith_gui.controller import Controller
    from zenith_gui.pad import Pad
    from zenith_gui.shell import Shell

    launcher = find_launcher(a.launcher)
    if not launcher:
        print("The loader was not found: no entry_point.py beside this folder. Name its Launcher folder with --launcher.")
        return 2

    # graphics OFF (Options > Looks): drawn without the graphics card, for PCs and Proton setups where the window
    # stays black or flickers (improvement 17)
    try:
        with open(os.path.join(HERE, "user", "settings.json"), encoding="utf-8") as f: looks = json.load(f).get("graphics")
    except (OSError, ValueError, AttributeError):
        looks = None
    if looks == "off" and not a.capture:
        from PySide6.QtQuick import QQuickWindow, QSGRendererInterface
        QQuickWindow.setGraphicsApi(QSGRendererInterface.GraphicsApi.Software)

    app = QApplication(sys.argv[:1])
    app.setApplicationName("The Zenith Terminal")
    app.setQuitOnLastWindowClosed(not tray_ok)    # closed to the tray: the Terminal stays; QUIT ends it
    words = lang.Words(app)                       # the window's words in the chosen language (improvement 18)
    app.installTranslator(words)
    icon = os.path.join(HERE, "art", "logo", "zenith.ico")
    if os.path.isfile(icon): app.setWindowIcon(QIcon(icon))
    fonts = os.path.join(HERE, "zenith_gui", "fonts")
    for name in sorted(os.listdir(fonts)):
        if name.lower().endswith(".ttf"): QFontDatabase.addApplicationFont(os.path.join(fonts, name))
    QQuickStyle.setStyle("Basic")

    profile_root = a.profile_root or (settings().get("profileRoot") if not a.launcher else None)
    controller = Controller(launcher, profile_root, demo=a.demo or bool(a.capture), data_dir=os.path.join(HERE, "user"),
                            defer=not a.capture)
    pad = Pad(app) if not a.capture else None        # a game controller (improvement 15)
    engine = QQmlApplicationEngine()
    engine.rootContext().setContextProperty("controller", controller)
    engine.rootContext().setContextProperty("pad", pad)
    engine.rootContext().setContextProperty("trayAvailable", tray_ok)
    size = tuple(int(v) for v in a.size.lower().split("x")) if a.size else None
    shell = Shell(data_dir=os.path.join(HERE, "user"), capture=bool(a.capture), size=size, keep=not a.demo)
    engine.rootContext().setContextProperty("shell", shell)
    lang.load(controller.settings.get("language") if not a.capture else "en")

    def language():
        if lang.load(controller.settings.get("language")): engine.retranslate()
    controller.settingsChanged.connect(language)
    engine.load(QUrl.fromLocalFile(os.path.join(HERE, "zenith_gui", "qml", "Main.qml")))
    if not engine.rootObjects(): return 1
    window = engine.rootObjects()[0]
    if not a.capture:
        code = app.exec()
        del window; del engine     # the window goes before shell and controller: its bindings never read them gone
        if controller.reopen_pending:      # the updater brought this window's files: the new window opens on them
            import subprocess
            flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP) if os.name == "nt" else 0
            subprocess.Popen([sys.executable, os.path.abspath(__file__)] + sys.argv[1:], cwd=os.getcwd(),
                             creationflags=flags, close_fds=True)
        return code

    os.makedirs(a.capture, exist_ok=True)
    actions = {}
    for part in filter(None, a.script.split(";")):
        frame, what = part.split(":", 1)
        actions.setdefault(int(frame), []).append(what)
    cues = 0
    for _ in range(6): app.processEvents()
    for i in range(a.frames):
        for what in actions.get(i, []):
            if what.startswith("toggle="):
                mod = next((m for m in controller.mods if m["id"] == what.split("=", 1)[1]), None)
                if mod: controller.setEnabled(mod["id"], not mod["enabled"])
            elif what.startswith("set="):
                key, value = what.split("=", 1)[1].split(":", 1)
                controller.setSetting(key, {"true": True, "false": False}.get(value, value))
            elif what == "close": controller.dismiss()
            else:
                cues += 1
                window.setProperty("cue", "%d|%s" % (cues, what))
        if a.probe:                # how far the animation clock has got at each frame
            time.sleep(0.019); app.processEvents(); window.grabWindow()
            print(i, round(float(window.property("clock"))), controller.step, controller.result or "-")
            continue
        time.sleep(0.019)          # the animation timer is due again
        app.processEvents()
        if i % a.every == 0:
            window.grabWindow().save(os.path.join(a.capture, "f_%04d.jpg" % (i // a.every)), "JPG", 93)
    print("wrote %d frames to %s" % ((a.frames + a.every - 1) // a.every, a.capture))
    del window; del engine
    return 0


if __name__ == "__main__":
    sys.exit(main())
