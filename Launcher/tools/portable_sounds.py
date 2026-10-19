"""portable_sounds.py: a mod's sound files go into the game folder, addressed the way the game's own are.

A mod's importer adds its cue sheets to data/audiocollection with the full path of the .acb it wrote on this PC
(`C:\\ZenithTerminal\\local_only\\...`). The game opens that path as written, so it only works while the game sees
the loader's folder under the same name. Under Proton it often does not: the Terminal started as its own program
unpacks into its own prefix, the game runs in another, and the mod has no sound (reported on a Steam Deck,
2026-10-11: no voice from the .exe, voice when the folder sat beside the game).

The game's own sheets are addressed from StreamingAssets (`Audio/bgm.acb`, `Audio/chs/voice.acb`). So after the
importers have run, `rewrite` turns every full path in the built collection into `Audio/zenith/<file>` and lists
where each file came from; `place` copies them into `<game>\\StreamingAssets\\Audio\\zenith` at install and takes
out what is no longer used; `clear` removes the folder at uninstall. Importers stay as they are.
"""
import json, os, shutil

FOLDER = "zenith"                  # under StreamingAssets/Audio
LIST = "_sounds.json"              # in the build folder; make_patch skips names that start with "_"
KEYS = ("_acbPath", "_awbPath")


def game_folder(root):
    return os.path.join(root, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Audio", FOLDER)


def _full(p):
    """A path of this PC, not one the game resolves from StreamingAssets."""
    return bool(p) and (os.path.isabs(p) or (len(p) > 1 and p[1] == ":") or p.startswith(("/", "\\")))


def relink(sheets, exists=os.path.exists):
    """Rewrites the full paths in a ListCueSheet in place. Returns ({file name: source path}, [paths left alone])."""
    files, left = {}, []
    for sheet in sheets:
        for lingual in sheet.get("Linguals", []):
            for key in KEYS:
                src = lingual.get(key, "")
                if not _full(src): continue
                if not exists(src): left.append(src); continue
                name = os.path.basename(src.replace("\\", "/"))
                if os.path.normcase(files.get(name, src)) != os.path.normcase(src):
                    name = "%s_%s" % (sheet.get("Id", len(files)), name)     # two mods, one file name
                files[name] = src
                lingual[key] = "Audio/%s/%s" % (FOLDER, name)
    return files, left


def rewrite(out_dir, typetree_gen, say=print):
    """The built data/audiocollection.ab, if a mod made one: full paths become game paths. Writes LIST."""
    built = os.path.join(out_dir, "data", "audiocollection.ab")
    if not os.path.exists(built): return {}
    import UnityPy
    env = UnityPy.load(open(built, "rb").read())
    env.typetree_generator = typetree_gen
    files = {}
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour": continue
        tree = obj.read_typetree()
        if "ListCueSheet" not in tree: continue
        files, left = relink(tree["ListCueSheet"])
        for p in left: say("  sounds: %s is not on this PC; its path is left as the mod wrote it" % p)
        if files: obj.save_typetree(tree)
    if files:
        open(built, "wb").write(env.file.save(packer="lz4"))
        json.dump(files, open(os.path.join(out_dir, LIST), "w"), indent=1)
        say("  sounds: %d file(s) will sit in the game's Audio\\%s folder" % (len(files), FOLDER))
    return files


def place(out_dir, dest, say=print):
    """Copies the listed files into the game folder and removes the ones no build uses any more."""
    lst = os.path.join(out_dir, LIST)
    files = json.load(open(lst)) if os.path.exists(lst) else {}
    if not files: clear(dest); return 0
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(dest):
        if name not in files: os.remove(os.path.join(dest, name))
    for name, src in files.items():
        to = os.path.join(dest, name)
        st = os.stat(src)
        if os.path.exists(to) and os.path.getsize(to) == st.st_size and int(os.path.getmtime(to)) == int(st.st_mtime): continue
        shutil.copy2(src, to)
    say("sounds: %d file(s) in %s" % (len(files), dest))
    return len(files)


def clear(dest):
    if os.path.isdir(dest): shutil.rmtree(dest)
