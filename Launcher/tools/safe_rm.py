"""safe_rm.py: remove a folder the loader made, whatever holds it for a moment.

Players unzip the Terminal into Downloads or a synced folder, where files and folders can come out read-only and
antivirus, a cloud sync or Explorer can hold a folder for a moment. A plain shutil.rmtree then stops the install with
"[WinError 5] Access is denied" (IluzryMage, 2026-11-16 at 50% on patch_out, 2026-11-17 on kept\\quick\\char-swiftmaster:
Ruby, Weiss and Swift Master's ready-made stages). rmtree() clears read-only flags on the way, retries for a few
seconds, and when the folder still can't go it is renamed aside (<name>.old-<time>) and removed by a later run, so the
caller always gets the path free."""
import glob
import os
import shutil
import stat
import time


def _unlock(func, path, exc):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def rmtree(path, tries=6):
    """remove path (a folder or a file) if it exists; never stops on a held or read-only one"""
    if not os.path.lexists(path):
        _sweep(path)
        return
    if os.path.isfile(path) or os.path.islink(path):
        for i in range(tries):
            try:
                os.chmod(path, stat.S_IWRITE)
                os.remove(path)
                return
            except FileNotFoundError:
                return
            except OSError:
                time.sleep(0.3 * (i + 1))
        raise PermissionError("%s is held by another program; close it and try again" % path)
    for i in range(tries):
        try:
            shutil.rmtree(path, onexc=_unlock)
        except Exception:
            pass
        if not os.path.exists(path):
            break
        time.sleep(0.5 * (i + 1))
    if os.path.exists(path):
        aside = "%s.old-%s" % (path.rstrip("\\/"), time.strftime("%Y%m%d%H%M%S"))
        try:
            os.replace(path, aside)
        except OSError as e:
            raise PermissionError("%s is held by another program (%s). Close File Explorer windows and cloud sync "
                                  "on that folder, or move the Terminal out of Downloads / OneDrive, then try "
                                  "again." % (path, e))
        print("note: %s was held by another program; it was moved aside to %s" % (path, aside))
    _sweep(path)


def _sweep(path):
    """remove folders an earlier run moved aside"""
    parent, name = os.path.split(path.rstrip("\\/"))
    for old in glob.glob(os.path.join(parent, glob.escape(name) + ".old-*")):
        try:
            shutil.rmtree(old, onexc=_unlock)
        except Exception:
            pass                                 # still held: a later run takes it
