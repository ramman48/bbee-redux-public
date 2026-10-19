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

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def find_install():
    """BBTAG_DIR if set; else the Steam library that holds app 702890 (its appmanifest names the folder, "BBTAG")."""
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
    return r"B:\SteamLibrary\steamapps\common\BBTAG"


INSTALL = find_install()
LOCAL = os.path.join(ROOT, "local_only", "bbtag")
KEY = bytes.fromhex("F55C842AAD6154E70AFC996BD5A4D3D8482669CB0742135E1023D26D36C7C166DFA1ADF144447EC98E2499")


RUBY = {
    "img": "data/char/char_rrb_img.pac",
    "col": "data/char/char_rrb_col.pac",
    "scr": "data/char/char_rrb_scr.pac",
    "pal": "data/char/char_rrb_pal.pac",
    "vri": "data/char/char_rrb_vri.pac",
    "eff3d": "data/eff3d/eff3d_rrb.pac",
    "eff3d_img": "data/eff3d/eff3d_rrb_img.pac",
    "pdat": "data/particle/particle_dat_rrb.pac",
    "pimg": "data/particle/particle_img_rrb.pac",
    "se": "data/sound/se/serrb.pac",
    "voice0": "data/sound/voice/vbtl_rrb_0.pac",
}


def asset_name(logical):
    return hashlib.md5(logical.encode()).hexdigest()


def decrypt(name, data, offset=0):
    s = (hashlib.md5(name.encode()).digest()[7] + offset) % 43
    k = (KEY * (len(data) // 43 + 2))[s:s + len(data)]
    return bytes(a ^ b for a, b in zip(data, k))


def read(logical):
    name = asset_name(logical)
    p = os.path.join(INSTALL, "asset", name)
    if not os.path.exists(p):
        raise FileNotFoundError(logical)
    with open(p, "rb") as f:
        return decrypt(name, f.read())


def fpac_entries(b):
    """FPAC: 'FPAC', data_start, total_size, count, flags, name_len, 8 pad; entries of (name[name_len], index, offset,
    size) padded to 16 bytes; offsets are relative to data_start."""
    if b[:4] != b"FPAC":
        raise ValueError("not FPAC")
    ds, tot, cnt, flags, nl = struct.unpack_from("<5I", b, 4)


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
