"""bbtag_owner.py -- does this Steam user own BlazBlue Cross Tag Battle and every one of its DLC?

The project rule (docs/cross-effect/DECISIONS.md, 2026-09-28): Cross Effect keeps DLC material in, and the player must
own ALL of BBTAG's DLC. BBTAG installs every DLC's data for everyone (one depot, 702891), so files on disk prove
nothing; ownership has to come from Steam.

How: load the Steamworks library that ships with the player's BBEE (read-only), after checking it is Valve-signed
(a DLC-unlocker proxy DLL would lie), initialise as BBEE (app 2273430, which the player runs anyway), and ask
ISteamApps::BIsSubscribedApp for BBTAG and each DLC. Needs the Steam client running and logged in. Read-only:
nothing is written anywhere. Steam may briefly show the user as "playing" BBEE while the check runs.

usage: python tools/bbtag/bbtag_owner.py          exit code 0 = owns everything, 1 = missing something, 2 = check failed
"""
import ctypes, os, subprocess, sys

# (the loader's folder is the nearest one above that holds bbmod.py: a character packed for a mod loader carries its
#  own copy of this module inside its mod folder; in the workspace and a standalone package it is the folder it was)
_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next((p for p in (os.path.abspath(os.path.join(_HERE, *([".."] * k))) for k in range(1, 8)) if os.path.exists(os.path.join(p, "bbmod.py"))), os.path.dirname(os.path.dirname(_HERE)))
DLL = os.path.join(ROOT, "game", "BlazblueEntropyEffect_Data", "Plugins", "x86_64", "steam_api64.dll")
BBEE_APPID = 2273430
BBTAG_APPID = 702890
# Steam store DLC list for app 702890 (store.steampowered.com/dlc/702890, read 2026-09-28)
BBTAG_DLC = {
    804640: "DLC Character - Blake",
    804641: "DLC Character - Yang",
    804642: "Character Pack Vol.1 - Platinum/Kanji/Orie",
    804643: "Character Pack Vol.2 - Jubei/Aegis/Carmine",
    804644: "Character Pack Vol.3 - Hakumen/Naoto Shirogane/Vatista",
    804645: "Character Pack Vol.4 - Izayoi/Mitsuru/Merkava",
    804646: "Character Pack Vol.5 - Mai/Akihiko/Yuzuriha",
    804647: "Character Pack Vol.6 - Nine/Labrys/Mika",
    1074980: "Character Pack Vol.7 - Heart/Naoto Kurogane/Teddie/Seth",
    824380: "Color Pack 1",
    824381: "Color Pack 2",
    824382: "Color Pack 3",
    1175090: "Ver 2.0 Expansion Pack",
}


def valve_signed(path):
    ps = "(Get-AuthenticodeSignature -LiteralPath '%s') | ForEach-Object { $_.Status.ToString() + '|' + $_.SignerCertificate.Subject }" % path
    out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, encoding="oem", errors="replace").stdout.strip()
    status, _, subject = out.partition("|")
    return status == "Valid" and "O=Valve Corp." in subject


def subscribed(apps):
    """{appid: name} -> {appid: (name, owned)}, asked through BBEE's Valve-signed Steamworks library (never another
    game's own DLL: a DLC unlocker could answer for it). Raises RuntimeError if the check cannot run."""
    if not os.path.exists(DLL):
        raise RuntimeError("BBEE's steam_api64.dll not found: " + DLL)
    if not valve_signed(DLL):
        raise RuntimeError("steam_api64.dll is not Valve-signed; refusing to trust an ownership answer from it")
    os.environ["SteamAppId"] = str(BBEE_APPID)
    os.environ["SteamGameId"] = str(BBEE_APPID)
    api = ctypes.CDLL(DLL)
    api.SteamAPI_Init.restype = ctypes.c_bool
    if not api.SteamAPI_Init():
        raise RuntimeError("SteamAPI_Init failed (is Steam running and logged in?)")
    try:
        api.SteamAPI_SteamApps_v008.restype = ctypes.c_void_p
        handle = api.SteamAPI_SteamApps_v008()
        if not handle:
            raise RuntimeError("ISteamApps unavailable")
        sub = api.SteamAPI_ISteamApps_BIsSubscribedApp
        sub.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        sub.restype = ctypes.c_bool
        return {appid: (name, bool(sub(handle, appid))) for appid, name in apps.items()}
    finally:
        api.SteamAPI_Shutdown()


def check():
    """-> (ok, details) where details = {appid: (name, owned)}; raises RuntimeError if the check cannot run."""
    details = subscribed(dict([(BBTAG_APPID, "BlazBlue Cross Tag Battle")] + list(BBTAG_DLC.items())))
    return all(owned for _, owned in details.values()), details


def main():
    try:
        ok, details = check()
    except RuntimeError as e:
        print("ownership check failed:", e)
        sys.exit(2)
    for appid, (name, owned) in details.items():
        print("%-8s %-58s %s" % (appid, name, "owned" if owned else "NOT OWNED"))
    print("all owned" if ok else "missing: %d" % sum(1 for _, o in details.values() if not o))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
