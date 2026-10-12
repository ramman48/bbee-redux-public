"""import_audio.py -- DELTARUNE: Party's sounds as CRI cue sheets, made at build time from the PLAYER'S OWN DELTARUNE
install (bbmod.py runs it through content.importers). Route: local_only/deltarune/party/audio/AUDIO_ROUTE.md.

  1. Each sound is read by its SOND name from Chapter 5 (dr_sfx.py): embedded 16-bit PCM WAVE in data.win or
     audiogroup1.dat. Never by index: a DELTARUNE update moves the indices.
  2. Each wave is encoded to CRI HCA (tools/hca/HcaEncode.exe, VGAudio, MIT; unencrypted) and cached by content in
     local_only/deltarune/audio/hca_cache/.
  3. Each sheet is a clone of one of BBEE's OWN cue sheets, read from the install (tools/cri_acb.clone_acb): the
     template keeps its ACF hash, categories and selectors; every cue copies the exemplar cue's object tree. Then each
     cue gets its own volume (0x0094) and, for hit sounds, the categories of a stock hit cue (0x0041).
  3b. The sheet's waveforms are then ENCRYPTED as every stock waveform is (hca_crypt.py: HCA cipher type 56, the
     game's key, the template sheet's own AWB subkey, masked header) and the subkey is written into the sheet's AWB
     header. The game's CRI runtime passes every HCA frame through its decryption table whatever the file's `ciph`
     field says, so an unencrypted HCA plays as full-scale noise (0.2.4 in game: "the sound is very corrupted").
  4. The ACB is written content-addressed to local_only/deltarune/audio/<sheet>_<sha1 12>.acb and referenced by
     ABSOLUTE path (CRI loads an absolute _acbPath as written). Never into the build folder (make_patch packs that
     into ab/m_mod.m, where CRI can't reach it) and never into the game folder.
  5. data/audiocollection is taken from the build folder if another importer (Ruby) already wrote it, else from the
     installed game's pristine bundle; our sheets are dropped by name, then appended with the next free ids; the
     result goes into the build folder.

Steps 4-5 and the encoder handling are copied from mods/char-ruby/ruby_audio.py (store_acb, _collection_env,
_refuse_asset_conflicts, patch_collection, ensure_encoder), not shared: a common tools module is DELTARUNE Core's call.
Step 3b (hca_crypt.py, encrypt_waves) is new here; Ruby's sheets need the same step (Cross Effect's call).

usage:  python mods/dr-party/audio/import_audio.py --out <build folder> --adds <json path>     (bbmod)
        python mods/dr-party/audio/import_audio.py --check [--no-decode]
            builds into local_only/deltarune/party/audio/check_out from the pristine collection and runs check_audio.py
Nothing made here is stored in the mod folder. The DELTARUNE waves, the HCA files and the ACBs never ship.
"""
import hashlib, json, os, shutil, struct, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))
MOD = os.path.dirname(HERE)
sys.path[:0] = [HERE, os.path.join(ROOT, "tools")]

AUDIO_DIR = os.path.join(ROOT, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Audio")   # templates (read-only)
STORE = os.path.join(ROOT, "local_only", "deltarune", "audio")
HCA_CACHE = os.path.join(STORE, "hca_cache")
MAP = os.path.join(STORE, "audio_map.json")          # what the last build made (names, ids, paths); local only
CHECK_OUT = os.path.join(ROOT, "local_only", "deltarune", "party", "audio", "check_out")
ENCODER_DIR = os.path.join(ROOT, "tools", "hca")
ENCODER = os.path.join(ENCODER_DIR, "bin", "out", "HcaEncode.exe")
QUALITY = "high"
CACHE_TAG = b"hca-v1|vgaudio-2.2.1|" + QUALITY.encode()
TAG = "DELTARUNE: Party audio:"

# Cue volumes (0x0094) from offline measurement as BBEE plays a cue (waveform x AcbVolume x cue volume x ACF category
# volumes; both templates' AcbVolume and every category volume are 1.0). Script and numbers:
# local_only/deltarune/party/audio/level_plan.py, stock_levels.py (2026-10-02). Rules:
#   target mode   DELTARUNE's own level, capped at the stock SFX_UI one-shots' upper quartile + 3 dB (-19.5 M LUFS);
#                 never louder than DELTARUNE. spearrise -6.3 dB, select -0.4 dB; move / move_fail unchanged.
#   combat        each on its stock base-hero class median (the Ruby audio agent's table): swing -19.3, hit -22.6,
#                 shot -20.0 M LUFS; never up.
SHEETS = {
    # the command's target mode (js/command.js, AudioUtil.PlaySoundUI). Template: SFX_UI's sfx_ui_02, the stock menu
    # cursor sound js/command.js used as the move stand-in: categories sfx_ui / SFX / SFX_1 / MASTER_OUT, cue limit 1
    "sfx_dr_pt_ui": {"template": ("SFX_UI", "sfx_ui_02"), "hit_like": None, "cues": [
        # (cue, DELTARUNE sound, volume, hit categories)
        ("sfx_dr_pt_spearrise", "snd_spearrise", 0.49, False),
        ("sfx_dr_pt_plat_act_move", "snd_plat_act_move", 1.00, False),
        ("sfx_dr_pt_plat_act_move_fail", "snd_plat_act_move_fail", 1.00, False),
        ("sfx_dr_pt_plat_act_select", "snd_plat_act_select", 0.95, False),
        # the Fun Gang's pose when Auto is switched (Pen of Hope, 0.4.0; js/pots_pen.js): the boost chime as Auto comes
        # on, the wing swish as it goes off. Same rule as above, measured 2026-10-03 with aud.measure: snd_boost
        # -15.3 M LUFS -> -4.2 dB; snd_wing -26.0 M LUFS, unchanged (never up). Design choice, not DELTARUNE's: its
        # own scene sets the pose sprites without a sound
        ("sfx_dr_pt_pose_on", "snd_boost", 0.62, False),
        ("sfx_dr_pt_pose_off", "snd_wing", 1.00, False),
        # the graze chime on a perfect dodge (Tension, 0.5.0): -27.4 M LUFS, unchanged (never up)
        ("sfx_dr_pt_graze", "snd_graze", 1.00, False),
        # 0.5.1 (measured 2026-10-03 with aud.measure, same rule: DELTARUNE's own level, capped at -19.5 M LUFS, never
        # up). DELTARUNE's item jingle when a Potential joins the run (js/potentials.js): snd_item -20.5, unchanged.
        # The SOUL's end (js/command.js drawSoul): snd_break1 -24.6 and snd_break2 -20.7, unchanged; the SOUL forming
        # again when Kris is brought back: snd_power -17.4 -> -2.1 dB
        ("sfx_dr_pt_pick", "snd_item", 1.00, False),
        ("sfx_dr_pt_break1", "snd_break1", 1.00, False),
        ("sfx_dr_pt_break2", "snd_break2", 1.00, False),
        ("sfx_dr_pt_revive", "snd_power", 0.79, False),
    ]},
    # the companions' moves (krisbullet actions' Audios / HitAudios). Template: Noel's sfx_no (base game; Kris's
    # HeroConfig already preloads it), exemplar sfx_no_attack3_p1 (the swing stand-in: sfx_role / SFX / role_attack,
    # cue limit 2, no action tracks). Hit cues take sfx_no_attackEX_hit's categories (monster_behit for role_attack)
    "sfx_dr_pt": {"template": ("sfx_no", "sfx_no_attack3_p1"), "hit_like": "sfx_no_attackEX_hit", "cues": [
        ("sfx_dr_pt_rudebuster_swing", "snd_rudebuster_swing", 0.67, False),   # Susie's swing (obj_plat_follower)
        ("sfx_dr_pt_rudebuster_hit", "snd_rudebuster_hit", 0.45, True),        # the bolt's hit (obj_rudebuster_bolt_plat)
        ("sfx_dr_pt_firespell", "snd_firespell", 0.68, False),                 # the fire spell landing (obj_firespell)
        ("sfx_dr_pt_power", "snd_power", 0.80, False),                         # Ralsei's release (obj_plat_follower)
        # 0.5.0 (the lead: "deltarune sounds for hitting and getting hit aswell"; the moves that had no sound). Kris's
        # three swings are obj_plat_player's own (snd_smallswing, snd_heavyswing, snd_ultraswing; DELTARUNE pitches the
        # last two x1.1 and the air slash x1.5: not done here). Volumes from aud.measure on 2026-10-03, same rules as
        # above (swing -19.3, hit -22.6, shot -20.0 M LUFS; never up): smallswing -24.4, heavyswing -21.2 and ultraswing
        # -19.6 stay at 1.0; damage -15.8 -> 0.46; hurt1 -18.0 -> 0.86; punchmed -20.4, impact -12.7 -> 0.43;
        # badexplosion -7.5 -> 0.24; jump -18.0 and noise -20.1 are movement sounds, set under the swings (0.5); wing 1.0
        ("sfx_dr_pt_swing1", "snd_smallswing", 1.00, False),                   # Kris's first swing and the air slash
        ("sfx_dr_pt_swing2", "snd_heavyswing", 1.00, False),                   # the second swing
        ("sfx_dr_pt_swing3", "snd_ultraswing", 1.00, False),                   # the third swing
        ("sfx_dr_pt_damage", "snd_damage", 0.46, True),                        # a hit of Kris's on an enemy
        ("sfx_dr_pt_hurt", "snd_hurt1", 0.86, False),                          # Kris is hit
        ("sfx_dr_pt_punch", "snd_punchmed", 1.00, False),                      # the Party Dash's wall crash (obj_plat_player)
        ("sfx_dr_pt_impact", "snd_impact", 0.43, False),                       # the Diving Spin's landing
        ("sfx_dr_pt_explosion", "snd_badexplosion", 0.24, False),              # the timed shock, Red Buster's end, the detonation
        ("sfx_dr_pt_jump", "snd_jump", 0.50, False),                           # the jump (obj_plat_player)
        ("sfx_dr_pt_wing", "snd_wing", 1.00, False),                           # the double jump (obj_plat_player)
        ("sfx_dr_pt_land", "snd_noise", 0.50, False),                          # the landing (obj_plat_player)
    ]},
}


SUBKEYS = {}          # sheet -> the AWB subkey its waveforms were encrypted with (filled by build_acbs)


def _log(log, *a):
    if log:
        log(TAG, *a)


# ---------------------------------------------------------------------------------------------------- DELTARUNE
def load_waves(log=None):
    """{DELTARUNE sound: (wav bytes, info)}; refuses anything but 16-bit PCM with samples."""
    import dr_sfx
    if MOD not in sys.path:
        sys.path.insert(0, MOD)
    import dr_pack
    if dr_pack.active():                 # 0.6.4: an alpha TEST package carries the sounds (dr_pack.py): no install is read
        meta = json.loads(dr_pack.path("audio", "info.json").read_text(encoding="utf-8"))
        out = {}
        for sheet in SHEETS.values():
            for _, snd, _, _ in sheet["cues"]:
                p = dr_pack.path("audio", snd + ".wav")
                if snd not in meta or not p.exists():
                    dr_pack.missing("the sound " + snd)
                data, info = p.read_bytes(), dict(meta[snd])
                w = dr_sfx.wav_info(data)
                if w["format"] != 1 or w["bits"] != 16 or w["samples"] <= 0 or w["channels"] not in (1, 2):
                    raise SystemExit("%s %s is not 16-bit PCM WAVE (%s)" % (TAG, snd, w))
                info.update(w)
                out[snd] = (data, info)
        _log(log, "%d sounds from the included asset pack" % len(out))
        return out
    try:
        S = dr_sfx.Sounds()
    except FileNotFoundError as e:
        raise SystemExit("%s DELTARUNE Chapter 5 not found (%s). The party's sounds are read from your own DELTARUNE "
                         "install at build time (set DELTARUNE_DIR to its folder)." % (TAG, e))
    out = {}
    for sheet in SHEETS.values():
        for _, snd, _, _ in sheet["cues"]:
            try:
                data, info = S.read(snd)
            except KeyError as e:
                raise SystemExit("%s %s (a DELTARUNE update may have renamed it)" % (TAG, e))
            w = dr_sfx.wav_info(data)
            if w["format"] != 1 or w["bits"] != 16 or w["samples"] <= 0 or w["channels"] not in (1, 2):
                raise SystemExit("%s %s is not 16-bit PCM WAVE (%s)" % (TAG, snd, w))
            info.update(w)
            out[snd] = (data, info)
    _log(log, "%d sounds from %s" % (len(out), S.path))
    return out


# ---------------------------------------------------------------------------------------------------- encoding
def ensure_encoder(log=None):   # from ruby_audio.py
    if os.path.exists(ENCODER):
        return ENCODER
    if not shutil.which("dotnet"):
        raise SystemExit("%s the HCA encoder is missing (%s) and the .NET SDK is not installed to build it "
                         "(https://dotnet.microsoft.com/download, free)." % (TAG, ENCODER))
    _log(log, "building the HCA encoder (tools/hca, VGAudio)")
    r = subprocess.run(["dotnet", "build", os.path.join(ENCODER_DIR, "HcaEncode.csproj"), "-c", "Release", "-o",
                        os.path.dirname(ENCODER)], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(ENCODER):
        raise SystemExit("%s building tools/hca failed:\n%s" % (TAG, (r.stdout + r.stderr)[-1500:]))
    return ENCODER


def encode(waves, log=None):   # from ruby_audio.encode
    """{name: wav bytes} -> {name: HCA bytes}; cached by PCM content."""
    os.makedirs(HCA_CACHE, exist_ok=True)
    out, todo = {}, {}
    for name, wav in waves.items():
        h = hashlib.sha1(CACHE_TAG + wav).hexdigest()
        p = os.path.join(HCA_CACHE, h + ".hca")
        if os.path.exists(p):
            out[name] = open(p, "rb").read()
        else:
            todo.setdefault(h, (wav, []))[1].append(name)
    if todo:
        enc = ensure_encoder(log)
        tmp = os.path.join(STORE, "_encode_%d" % os.getpid())
        wd, hd = os.path.join(tmp, "wav"), os.path.join(tmp, "hca")
        os.makedirs(wd, exist_ok=True)
        try:
            for h, (wav, _) in todo.items():
                open(os.path.join(wd, h + ".wav"), "wb").write(wav)
            r = subprocess.run([enc, "--batch", wd, hd, QUALITY], capture_output=True, text=True)
            if r.returncode != 0:
                raise SystemExit("%s HcaEncode failed: %s" % (TAG, (r.stderr or r.stdout)[-800:]))
            for h, (_, names) in todo.items():
                data = open(os.path.join(hd, h + ".hca"), "rb").read()
                os.replace(os.path.join(hd, h + ".hca"), os.path.join(HCA_CACHE, h + ".hca"))
                for n in names:
                    out[n] = data
            _log(log, "encoded %d waves to HCA" % len(todo))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return out


# ---------------------------------------------------------------------------------------------------- the sheets
def template(name):
    p = os.path.join(AUDIO_DIR, name + ".acb")
    if not os.path.exists(p):
        raise SystemExit("%s stock template %s not found (%s)" % (TAG, name, p))
    return open(p, "rb").read()


def _top_cmd(A, cue):
    T = A.t
    return T["SeqCommandTable"].rows[T["SequenceTable"].rows[T["CueTable"].rows[A.cue_names()[cue]]["ReferenceIndex"]]["CommandIndex"]]["Command"]


def retune(data, plan):
    """Per cue of a built ACB: the top sequence's volume (0x0094: f32 volume, then the template's random range) and,
    when given, its categories (0x0041, same length as the template's). plan: {cue: (volume, categories or None)}."""
    import cri_acb as C
    A = C.Acb(data)
    T = A.t
    names = A.cue_names()
    sc = T["SeqCommandTable"]
    rows = [dict(r) for r in sc.rows]
    for cue, (vol, cats) in plan.items():
        si = T["SequenceTable"].rows[T["CueTable"].rows[names[cue]]["ReferenceIndex"]]["CommandIndex"]
        blob = rows[si]["Command"]
        v = C.cmd_get(blob, C.OP_VOLUME)
        if v is None or len(v) < 4:
            raise SystemExit("%s %s: the exemplar has no volume command" % (TAG, cue))
        blob = C.cmd_set(blob, C.OP_VOLUME, struct.pack(">f", float(vol)) + v[4:])
        if cats is not None:
            old = C.cmd_get(blob, C.OP_CATEGORY)
            if old is None or len(old) != len(cats):
                raise SystemExit("%s %s: category payloads differ in length (%r / %r)" % (TAG, cue, old, cats))
            blob = C.cmd_set(blob, C.OP_CATEGORY, cats)
        rows[si]["Command"] = blob
    row = dict(A.row)
    row["SeqCommandTable"] = C.UTF(sc.name, sc.columns, rows, sc.version, sc.encoding).build()
    return C.UTF(A.head.name, A.head.columns, [row], A.head.version, A.head.encoding).build(top=True)


def template_subkey(template_bytes):
    """The subkey in a stock sheet's memory AWB header: the game reads that sheet's waveforms with key x subkey."""
    import cri_acb as C
    return C.afs2_read(C.Acb(template_bytes).row["AwbFile"])[0]["subkey"]


def encrypt_waves(data, subkey):
    """A built ACB whose memory AWB holds unencrypted HCA -> the same ACB with every waveform encrypted for the game's
    key and `subkey` (hca_crypt.encrypt: ciph 56, masked header) and `subkey` in the AWB header, as stock sheets are.
    Sizes, ids, order and alignment stay; the waveform rows (channels, rate, samples) are unaffected."""
    import cri_acb as C
    import hca_crypt
    A = C.Acb(data)
    hdr, files = C.afs2_read(A.row["AwbFile"])
    enc = [(i, hca_crypt.encrypt(h, hca_crypt.KEY, subkey)) for i, h in files]
    if any(len(e) != len(h) for (_, e), (_, h) in zip(enc, files)):
        raise SystemExit("%s encryption changed a waveform's size" % TAG)
    row = dict(A.row)
    row["AwbFile"] = C.afs2_build(enc, align=hdr["align"], version=hdr["version"], offset_size=hdr["offset_size"],
                                  id_size=hdr["id_size"], subkey=subkey)
    return C.UTF(A.head.name, A.head.columns, [row], A.head.version, A.head.encoding).build(top=True)


def refuse_action_tracks(sheet, data):   # from the Ruby staging copy's ruby_audio._refuse_action_tracks
    import cri_acb as C
    A = C.Acb(data)
    for tname in ("SequenceTable", "SynthTable"):
        bad = [i for i, r in enumerate(A.t[tname].rows) if r.get("NumActionTracks") or r.get("ActionTrackStartIndex", 0xFFFF) != 0xFFFF]
        if bad:
            raise SystemExit("%s %s: %d %s rows use action tracks; pick another exemplar cue" % (TAG, sheet, len(bad), tname))


def build_acbs(waves, log=None):
    """-> {sheet: (acb bytes, [cue dict])}; each cue dict: name, sound, volume, hit, cue_id, length_ms, wave info."""
    import cri_acb as C
    hca = encode({snd: waves[snd][0] for s in SHEETS.values() for _, snd, _, _ in s["cues"]}, log)
    out = {}
    for sheet, spec in SHEETS.items():
        tname, exemplar = spec["template"]
        tb = template(tname)
        hit_cats = C.cmd_get(_top_cmd(C.Acb(tb), spec["hit_like"]), C.OP_CATEGORY) if spec["hit_like"] else None
        cues = [{"name": n, "sound": snd, "volume": vol, "hit": hit, "waves": [i], "priority": None}
                for i, (n, snd, vol, hit) in enumerate(spec["cues"])]
        wv = [{"hca": hca[c["sound"]]} for c in cues]
        guid = hashlib.md5(("deltarune:" + sheet).encode()).digest()
        data = C.clone_acb(tb, exemplar, sheet, cues, wv, guid, voice=False)
        data = retune(data, {c["name"]: (c["volume"], hit_cats if c["hit"] else None) for c in cues})
        refuse_action_tracks(sheet, data)
        subkey = template_subkey(tb)
        data = encrypt_waves(data, subkey)       # clone_acb takes unencrypted HCA; the game needs them encrypted
        SUBKEYS[sheet] = subkey
        for c, w in zip(cues, wv):
            src = waves[c["sound"]][1]
            if (w["info"]["samples"], w["info"]["rate"], w["info"]["channels"]) != (src["samples"], src["rate"], src["channels"]):
                raise SystemExit("%s %s: HCA %d/%d Hz/%d ch differs from the source %d/%d/%d" % (
                    TAG, c["sound"], w["info"]["samples"], w["info"]["rate"], w["info"]["channels"], src["samples"], src["rate"], src["channels"]))
            c["wave"] = {k: w["info"][k] for k in ("samples", "rate", "channels")}
        out[sheet] = (data, cues)
        _log(log, "%s: %d cues from %s/%s, %d bytes; waveforms encrypted (ciph 56, AWB subkey %d)"
             % (sheet, len(cues), tname, exemplar, len(data), subkey))
    return out


def store_acb(sheet, data):   # from ruby_audio.py
    """Content-addressed: <STORE>/<sheet>_<sha1 12>.acb (written once, never replaced)."""
    os.makedirs(STORE, exist_ok=True)
    p = os.path.join(STORE, "%s_%s.acb" % (sheet, hashlib.sha1(data).hexdigest()[:12]))
    if not os.path.exists(p) or os.path.getsize(p) != len(data):
        tmp = p + ".tmp%d" % os.getpid()
        open(tmp, "wb").write(data)
        os.replace(tmp, p)
    return os.path.abspath(p)


# ---------------------------------------------------------------------------------------------------- the collection
def _unity():   # tools/bbtag/bbtag_rig._unity
    argv = sys.argv; sys.argv = ["x"]
    sys.path.insert(0, ROOT)
    try:
        import bbmod, UnityPy
    finally:
        sys.argv = argv
    return bbmod, UnityPy


def _collection_env(out_dir):   # from ruby_audio.py
    """The collection to patch: another importer's output in this build folder if present, else the pristine bundle
    of the installed game (bbmod.find_entry reads the pristine index, never our own m_mod.m)."""
    bbmod, UnityPy = _unity()
    built = os.path.join(out_dir, "data", "audiocollection.ab")
    if os.path.exists(built):
        env = UnityPy.load(open(built, "rb").read())
        src = "build folder"
    else:
        env = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry("data/audiocollection.ab")))
        src = "installed game (pristine)"
    env.typetree_generator = bbmod.typetree_gen()
    return env, src


def _save(env, out_dir):   # tools/bbtag/bbtag_rig._save
    p = os.path.join(out_dir, "data", "audiocollection.ab")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(env.file.save(packer="lz4"))
    return p


def _refuse_asset_conflicts():   # from ruby_audio.py
    """bbmod's `assets` step runs after the importers and would silently replace our collection (enabled mods only,
    from the profile bbmod builds with)."""
    prof = os.environ.get("BBMOD_PROFILE") or os.path.join(ROOT, "mods", "profile.json")
    try:
        enabled = json.load(open(prof, encoding="utf-8")).get("enabled", [])
    except (OSError, ValueError):
        return
    dirs = [os.path.join(ROOT, "mods")] + [d for d in (os.environ.get("BBMOD_MODS_EXTRA") or "").split(os.pathsep) if d]
    for mj in enabled:
        p = next((os.path.join(d, mj, "mod.json") for d in dirs if os.path.exists(os.path.join(d, mj, "mod.json"))), None)
        if not p or os.path.normcase(os.path.dirname(os.path.abspath(p))) == os.path.normcase(MOD):
            continue
        try:
            m = json.load(open(p, encoding="utf-8"))
        except ValueError:
            continue
        for a in (m.get("content") or {}).get("assets") or []:
            if "audiocollection" in json.dumps(a).lower():
                raise SystemExit("%s mod %s patches data/audiocollection through `assets`; that step runs after the "
                                 "importers and would drop the party's sheets. Move it to an importer." % (TAG, mj))


def patch_collection(out_dir, sheets, log=None):   # from ruby_audio.patch_collection
    """Append our sheets to the live collection; returns {sheet: id}. sheets: {sheet: (acb path, cues)}."""
    env, src = _collection_env(out_dir)
    mb = next(o for o in env.objects if o.type.name == "MonoBehaviour")
    t = mb.read_typetree()
    ours = set(sheets)
    t["ListCueSheet"] = [s for s in t["ListCueSheet"] if s["Name"] not in ours]
    taken_sheets = {s["Name"].lower() for s in t["ListCueSheet"]}
    taken_cues = {c["Name"] for s in t["ListCueSheet"] for l in s["Linguals"] for c in l["Cues"]}
    next_id = max(s["Id"] for s in t["ListCueSheet"]) + 1
    ids = {}
    for sheet, (path, cues) in sheets.items():
        if sheet.lower() in taken_sheets:
            raise SystemExit("%s cue sheet name %s already exists in the collection" % (TAG, sheet))
        clash = [c["name"] for c in cues if c["name"] in taken_cues]
        if clash:
            raise SystemExit("%s cue names already used in the collection: %s" % (TAG, clash[:5]))
        if next_id >= 1000 or len(cues) >= 1000:
            raise SystemExit("%s sheet id %d (the runtime cue id is sheet * 1000 + cue)" % (TAG, next_id))
        t["ListCueSheet"].append({"Name": sheet, "Id": next_id, "Linguals": [{
            "LingualTag": "common", "_acbPath": path, "_awbPath": "",
            "Cues": [{"Name": c["name"], "Duration": float(c["length_ms"]) / 1000.0, "CriwareId": c["cue_id"],
                      "Blocks": [], "Priority": -1, "PreFirst": 0} for c in cues]}]})
        ids[sheet] = next_id
        taken_cues.update(c["name"] for c in cues)
        next_id += 1
    mb.save_typetree(t)
    _save(env, out_dir)
    _log(log, "audio collection (from the %s): +%s" % (src, ", ".join("%s id %d" % kv for kv in ids.items())))
    return ids


# ---------------------------------------------------------------------------------------------------- main
def build(out_dir, log=print):
    """The importer step: returns manifest additions (empty: data/audiocollection.ab replaces a bundle the manifest
    already has)."""
    t0 = time.time()
    _refuse_asset_conflicts()
    waves = load_waves(log)
    acbs = build_acbs(waves, log)
    paths = {sheet: store_acb(sheet, data) for sheet, (data, _) in acbs.items()}
    ids = patch_collection(out_dir, {s: (paths[s], acbs[s][1]) for s in acbs}, log)
    m = {"sheets": {}, "cues": {}}
    for s, (data, cues) in acbs.items():
        m["sheets"][s] = {"id": ids[s], "acb": paths[s], "bytes": len(data), "template": "%s/%s" % SHEETS[s]["template"],
                          "hca": "ciph 56", "awb_subkey": SUBKEYS[s]}
        for c in cues:
            src = waves[c["sound"]][1]
            m["cues"][c["name"]] = {"sheet": s, "cue_id": c["cue_id"], "length_ms": c["length_ms"], "volume": c["volume"],
                                    "hit_categories": c["hit"], "sound": c["sound"], "source": src["source"],
                                    "sond_id": src["id"], "audio_id": src["audio_id"], "wave": c["wave"]}
    os.makedirs(STORE, exist_ok=True)
    json.dump(m, open(MAP, "w", encoding="utf-8"), indent=1)
    _log(log, "%d cues in %d sheets in %.1fs; map %s" % (len(m["cues"]), len(acbs), time.time() - t0, os.path.relpath(MAP, ROOT)))
    return {"names": [], "entries": [], "guids": []}


def main():
    a = sys.argv[1:]
    if "--check" in a:
        shutil.rmtree(CHECK_OUT, ignore_errors=True)
        os.makedirs(CHECK_OUT)
        build(CHECK_OUT)
        import check_audio
        sys.exit(check_audio.main([CHECK_OUT] + (["--no-decode"] if "--no-decode" in a else [])))
    kw = dict(zip(a[0::2], a[1::2]))
    if "--out" not in kw:
        print(__doc__); sys.exit(2)
    adds = build(kw["--out"])
    if "--adds" in kw:
        json.dump(adds, open(kw["--adds"], "w"), indent=1)


if __name__ == "__main__":
    main()
