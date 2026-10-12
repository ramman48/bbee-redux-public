"""bbtag_read.py -- read-only access to the player's own BlazBlue Cross Tag Battle install (Cross Effect research).

Never writes inside the install. Anything extracted goes under the local folder (never packaged, committed or shared).

BBTAG PC stores every asset as <install>/asset/<md5 of the logical path>, e.g. md5("data/char/char_rrb_img.pac").
Each file is XORed with a fixed 43-byte key; the key index for byte 0 is md5(<the hex file name>)[7] % 43.
Almost every file is an FPAC archive (see fpac_entries).

usage:
  python tools/bbtag/bbtag_read.py list    <logical path>              entries of an FPAC archive
  python tools/bbtag/bbtag_read.py extract <logical path> [subdir]     decrypt + unpack to <local folder>/bbtag/<subdir>/
  python tools/bbtag/bbtag_read.py ruby                                list Ruby's known archives and sizes
"""
import hashlib, os, re, struct, sys

# (the loader's folder is the nearest one above that holds bbmod.py: a character packed for a mod loader carries its
#  own copy of this module inside its mod folder; in the workspace and a standalone package it is the folder it was)
_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next((p for p in (os.path.abspath(os.path.join(_HERE, *([".."] * k))) for k in range(1, 8)) if os.path.exists(os.path.join(p, "bbmod.py"))), os.path.dirname(os.path.dirname(_HERE)))


# An ALPHA package carries the Cross Tag Battle files Ruby is built from, in <package>/bbtag_alpha/asset/ under the
# game's own file names (the lead, 2026-10-03: for an alpha release players need neither to own Cross Tag Battle nor to
# have it installed; a final release reads the player's own install and checks ownership). When that folder is there it
# is the source, whatever else is installed, so every alpha tester builds from the same files.
# (2026-10-09: packed for a mod loader, the folder sits inside her mod folder, so deleting the mod removes it too)
BUNDLED_DIR = next((p for p in (os.path.join(ROOT, "bbtag_alpha"), os.path.join(ROOT, "mods", "char-ruby", "bbtag_alpha"))
                    if os.path.isdir(os.path.join(p, "asset"))), os.path.join(ROOT, "bbtag_alpha"))


def find_install():
    """The files an alpha package carries (BUNDLED_DIR), when this is one; else BBTAG_DIR if set; else the Steam library
    that holds app 702890 (its appmanifest names the folder, "BBTAG")."""
    if os.path.isdir(os.path.join(BUNDLED_DIR, "asset")):
        return BUNDLED_DIR
    if os.environ.get("BBTAG_DIR"):
        return os.environ["BBTAG_DIR"]
    roots = []
    try:
        import winreg
        for hive, key in ((winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam"), (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam")):
            try:
                with winreg.OpenKey(hive, key) as k:
                    for name in ("SteamPath", "InstallPath"):
                        try: roots.append(os.path.normpath(winreg.QueryValueEx(k, name)[0]))
                        except OSError: pass
            except OSError: pass
    except ImportError: pass
    libs = list(roots)
    for r in roots:
        vdf = os.path.join(r, "steamapps", "libraryfolders.vdf")
        if os.path.exists(vdf):
            libs += [os.path.normpath(m.replace("\\\\", "\\")) for m in re.findall(r'"path"\s+"([^"]+)"', open(vdf, encoding="utf-8", errors="replace").read())]
    for lib in libs:
        acf = os.path.join(lib, "steamapps", "appmanifest_702890.acf")
        if os.path.exists(acf):
            m = re.search(r'"installdir"\s+"([^"]+)"', open(acf, encoding="utf-8", errors="replace").read())
            d = os.path.join(lib, "steamapps", "common", m.group(1) if m else "BBTAG")
            if os.path.isdir(os.path.join(d, "asset")):
                return d
    return ""   # not found: the setup says so and names BBTAG_DIR (a fixed development path stood here until 2026-10-03)


INSTALL = find_install()
BUNDLED = os.path.normcase(os.path.abspath(INSTALL)) == os.path.normcase(os.path.abspath(BUNDLED_DIR)) if INSTALL else False
LOCAL = os.path.join(ROOT, "local_only", "bbtag")
KEY = bytes.fromhex("F55C842AAD6154E70AFC996BD5A4D3D8482669CB0742135E1023D26D36C7C166DFA1ADF144447EC98E2499")

# Ruby Rose's code is "rrb" (BGM 3000_btl_rrb.pac). Paths confirmed by hashing against the install.
RUBY = {
    "img": "data/char/char_rrb_img.pac",        # 735 HIP sprites (body + effect sprites)
    "col": "data/char/char_rrb_col.pac",        # 790 JONBIN: per-sprite chunk placement + boxes
    "scr": "data/char/char_rrb_scr.pac",        # scr_rrb.bin (character script) + scr_rrbea.bin (effects)
    "pal": "data/char/char_rrb_pal.pac",        # 160 HPL palettes
    "vri": "data/char/char_rrb_vri.pac",        # 41 HIP: extra effect sprites (vrrrbef_*)
    "eff3d": "data/eff3d/eff3d_rrb.pac",        # mdl.pac / mot.pac / scr.pac: 3D effect meshes
    "eff3d_img": "data/eff3d/eff3d_rrb_img.pac",  # DDS textures for the 3D effects
    "pdat": "data/particle/particle_dat_rrb.pac",
    "pimg": "data/particle/particle_img_rrb.pac",
    "se": "data/sound/se/serrb.pac",             # XACT sound bank (xsb) + wave bank (xwb)
    "voice0": "data/sound/voice/vbtl_rrb_0.pac",
}


def asset_name(logical):
    return hashlib.md5(logical.encode()).hexdigest()


def decrypt(name, data, offset=0):
    s = (hashlib.md5(name.encode()).digest()[7] + offset) % 43
    k = (KEY * (len(data) // 43 + 2))[s:s + len(data)]
    return bytes(a ^ b for a, b in zip(data, k))


def note_read(logical):
    """A packaging aid: with BBTAG_READ_LOG set, every Cross Tag Battle file a build reads is appended to that file, by its
    logical path. The list of files an alpha package carries is made from such a log (tools/make_ruby_release.py)."""
    p = os.environ.get("BBTAG_READ_LOG")
    if p:
        with open(p, "a", encoding="utf-8") as f:
            f.write(logical + "\n")


def missing(logical):
    """what to say about a Cross Tag Battle file that isn't there"""
    if BUNDLED:
        return "%s (bbtag_alpha/asset/%s) isn't in this package: unzip the package again, with every folder" % (logical, asset_name(logical))
    return logical


def read(logical):
    name = asset_name(logical)
    p = os.path.join(INSTALL, "asset", name)
    note_read(logical)
    if not os.path.exists(p):
        raise FileNotFoundError(missing(logical))
    with open(p, "rb") as f:
        return decrypt(name, f.read())


def fpac_entries(b):
    """FPAC: 'FPAC', data_start, total_size, count, flags, name_len, 8 pad; entries of (name[name_len], index, offset,
    size) padded to 16 bytes; offsets are relative to data_start."""
    if b[:4] != b"FPAC":
        raise ValueError("not FPAC")
    ds, tot, cnt, flags, nl = struct.unpack_from("<5I", b, 4)
    # entry stride: the table fills the header up to data_start. (nl + 12) rounded to 16 is 16 short for name
    # lengths 20 / 36 (found by the BBTAG catalogue: 4,973 of 11,393 archives); keep it only as a fallback
    es = (ds - 0x20) // cnt if cnt and (ds - 0x20) // cnt >= nl + 12 else (nl + 12 + 15) // 16 * 16
    out = []
    for i in range(cnt):
        o = 0x20 + i * es
        n = b[o:o + nl].split(b"\0")[0].decode("latin1")
        idx, off, size = struct.unpack_from("<3I", b, o + nl)
        out.append((n, ds + off, size))
    return out


def fpac_files(b):
    return {n: b[o:o + s] for n, o, s in fpac_entries(b)}


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); return
    if a[0] == "ruby":
        for k, v in RUBY.items():
            p = os.path.join(INSTALL, "asset", asset_name(v))
            print("%-9s %-40s %s %s" % (k, v, asset_name(v), os.path.getsize(p) if os.path.exists(p) else "MISSING"))
        return
    logical = RUBY.get(a[1], a[1])
    b = read(logical)
    if a[0] == "list":
        for n, o, s in fpac_entries(b):
            print("%-40s %10d %10d" % (n, o, s))
    elif a[0] == "extract":
        out = os.path.join(LOCAL, a[2] if len(a) > 2 else os.path.basename(logical).replace(".pac", ""))
        os.makedirs(out, exist_ok=True)
        files = fpac_files(b)
        for n, data in files.items():
            with open(os.path.join(out, n), "wb") as f:
                f.write(data)
        print(out, len(files), "files")


if __name__ == "__main__":
    main()
