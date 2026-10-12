"""ruby_audio.py -- Ruby's own sound effects and English voice, made at build time from the player's BBTAG install.

Route (docs/cross-effect/research/AUDIO.md, route b; KIT_V2.md §8):
  1. Her BBTAG banks are read from the player's own install (XACT, plain 16-bit PCM; tools/bbtag/bbtag_xact.py):
       serrb       her own sound effects (all 15)
       se00        BBTAG's common sounds: only the ones her script plays (dash, swings, cloth)
       sebrg       Ragna's bank: her back dash plays rgse_00
       vbtl_rrb_0  the ENGLISH battle voice (data/sound/voice_eng; the lead chose English): all 284 lines
  2. Each wave is levelled for BBEE's mix (LEVELS below: loudness matched to base heroes' sounds of its kind, a
     true-peak ceiling, the long tails of rapid-fire sounds shortened), then encoded to CRI HCA
     (tools/hca/HcaEncode.exe, VGAudio) and cached by content.
  3. Two memory ACBs are cloned from BBEE's own stock ones (tools/cri_acb.py clone_acb), which keeps their ACF hash,
     categories and selector:
       sfx_cx_ruby  from sfx_rg's sfx_rg_attackUp: one sequence -> one waveform per cue; sfx_role / SFX /
                    role_attack categories; cue limit 2
       vo_cx_ruby   from ES_voice's vo_es_attack1 (a base-game sheet; see VO_TEMPLATE): the voice_type switch ->
                    random-no-repeat per branch; the VOICE / BATTLE_VOICE / vo_role categories and a per-character
                    voice category (vo_es, limit 1: shared with ES, as it was shared with Bullet until 0.6.11),
                    so a new line cuts her previous one. One cue per line, plus one "_rnd" cue per variant group her
                    script plays (rrb201_0/1/2 -> vo_cx_ruby_rrb201_rnd), which rotates the variants like BBTAG.
  4. The ACBs are written, content-addressed, to local_only/cross_effect/audio/ and referenced by ABSOLUTE path:
     CRI loads a rooted path as-is (CriAtom.LoadAcbFile, Common.IsStreamingAssetsPath). They are not put in the
     build folder because bbmod's install packs every file of the build folder into ab/m_mod.m; content addressing
     means a later staging build can never replace the file an installed build points at.
  5. data/audiocollection is regenerated from the LIVE game's pristine bundle on every build (bbmod.find_entry reads the
     pristine index) and the two sheets are appended with the next free ids, a single "common" lingual, CriwareId =
     the ACB CueId and the real durations. The bundle is written to <build>/data/audiocollection.ab.

Nothing extracted is written to the mod folder: WAV/HCA/ACB live under local_only/, the collection bundle in the build
folder, and gen/audio_map.json (names only) in mods/char-ruby/gen/, which is never packaged.

HeroConfig: her row must list the sheets for preloading (ActorSettings.CueSheets): CueSheets ["sfx_no", SFX_SHEET,
VO_SHEET] (sfx_no stays while her hit sounds are Noel's).

usage:  python mods/char-ruby/ruby_audio.py map                 write gen/audio_map.json (no encoding; fast)
        python mods/char-ruby/ruby_audio.py build <build dir>   the whole step (what import_ruby calls)
"""
import hashlib, json, math, os, re, shutil, struct, subprocess, sys, time, types

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path.insert(0, os.path.join(TOOLS, "tools", "bbtag"))
sys.path.insert(0, os.path.join(TOOLS, "tools"))

SFX_SHEET, VO_SHEET = "sfx_cx_ruby", "vo_cx_ruby"
SFX_PREFIX, VO_PREFIX, GROUP_SUFFIX = "sfx_cx_ruby_", "vo_cx_ruby_", "_rnd"
SE_BANKS = [("serrb", "data/sound/se/serrb.pac", True),     # (name, logical path, take every entry)
            ("se00", "data/sound/se/se00.pac", False),
            ("sebrg", "data/sound/se/sebrg.pac", False)]
VO_BANK = ("vbtl_rrb_0", "data/sound/voice_eng/vbtl_rrb_0.pac")
SCRIPT = ("data/char/char_rrb_scr.pac", "scr_rrb.bin")
AUDIO_DIR = os.path.join(ROOT, "game", "BlazblueEntropyEffect_Data", "StreamingAssets", "Audio")
# Templates: BASE-GAME sheets only (a free character must not need a paid character's files to build). Until 0.6.11
# the voice template was Bullet's vo_role_bl / vo_bl_attack1 (paid DLC 3681910; INTEGRATION_AUDIT O2). ES's sheet
# gives the same object tree: vo_es_attack1 differs from vo_bl_attack1 only in the per-character voice category
# (vo_es instead of vo_bl; both are group 9, volume 1.0, limit 1 in the ACF) and in its number of variants, which
# clone_acb replaces anyway. Two header values are ES's own and are set here instead of inherited: AcbVolume (ES 0.9;
# hers 1.0, what Bullet's sheet had) and the ActionTrackTable (ES's action tracks; her sequences use none).
# (vo_role_pt, the other base "vo_role" sheet, does not fit: no cue of the switch shape, and an older ACF hash.)
SFX_TEMPLATE, VO_TEMPLATE = ("sfx_rg", "sfx_rg_attackUp"), ("ES_voice", "vo_es_attack1")
VO_VOLUME = 1.0   # her voice sheet's master volume (AcbVolume) before levelling; level_banks() sets LEVELS["vo_volume"]
STORE =os.path.join(ROOT, "local_only", "cross_effect", "audio")
HCA_CACHE = os.path.join(STORE, "hca_cache")
MAP = os.path.join(HERE, "gen", "audio_map.json")
ENCODER_DIR = os.path.join(ROOT, "tools", "hca")
ENCODER = os.path.join(ENCODER_DIR, "bin", "out", "HcaEncode.exe")
QUALITY = "high"
CACHE_TAG = b"hca-v1|vgaudio-2.2.1|" + QUALITY.encode()

# voice cue priority (the collection's Priority and the ACB's 0x0050 cue priority), on the scale BBEE's own heroes
# use (the stock vo_role sheets: jump 4, dash 5, standby 10, attack 20, skill 60, ultra 70, hit 80, born 90, dead 100),
# chosen by the BBTAG state that plays the line; lines her script never plays get DEFAULT_PRIORITY
PRIORITY_RULES = [(r"^CmnActEntry", 90), (r"^CmnActLose", 50), (r"^CmnActMatchWin", 50), (r"^AstralHeat", 70),
                  (r"^Ultimate", 70), (r"Throw", 60), (r"^CmnActCrushAttack", 60), (r"^CmnActInvincibleAttack", 60),
                  (r"SpDash", 60), (r"^AttackAndShot", 60), (r"^MultiAssault", 60), (r"^AirRolling", 60),
                  (r"^NmlAtk|^AN_NmlAtk", 20), (r"^CmnActStand", 10)]
DEFAULT_PRIORITY = 50

# ---- the voice pass (2026-10-03; the lead: "she sounds good but we should add more voicelines and attack lines and sounds
# for her"). Study: local_only/agents/voice (BBTAG's voice commands read from BBTAG.exe; the stock heroes' voice sheets).
# Variant groups the script reader does not list. A base name alone = every take of it in her voice bank.
#   rrb100-105  BBTAG's generic attack shouts (command 7009(n) through MatchInit's slot table): light A / B (rrb100, rrb101),
#               medium A / B (rrb102, rrb103), heavy A / B (rrb104, rrb105)
#   rrb209_v12  5AAAA's call-out, rrb212 Shot, rrb215 the Buzzsaw landing shot (command 7007: a line list like 7006)
#   hurt_* / tech_* / jump   the engine-event pools: BBTAG's damage cries by attack level, its recovery lines and its jump
#               efforts (the cast's shared voice slots)
EXTRA_GROUPS = {"rrb100": "rrb100", "rrb101": "rrb101", "rrb102": "rrb102", "rrb103": "rrb103", "rrb104": "rrb104", "rrb105": "rrb105",
                "rrb209_v12": ["rrb209_1", "rrb209_2"], "rrb212": "rrb212", "rrb215": "rrb215",
                "hurt_light": ["rrb015", "rrb016", "rrb017", "rrb018"], "hurt_heavy": ["rrb019", "rrb020", "rrb029"],
                "hurt_launch": ["rrb021", "rrb022", "rrb032"], "tech_ground": ["rrb044", "rrb045"],
                "tech_air": ["rrb046", "rrb047", "rrb048"], "jump": ["rrb002", "rrb003", "rrb007"]}
# cues the game asks for by exact name: vo_<ActionGroupID>_dead (BattleUtils.PlayerSelfPlayDeadAudio); vo_<actor id>_intro /
# _ready / _unlock (character select), _power (a Potential or strategy picked), _challenge (contract, event, HP shop),
# _prize / _sad (the gamble room); and two of her own (the Dust reload line, the revive line)
ACTOR_ID, ACTION_GROUP = 200701, "rrb"
ALIASES = {"vo_%s_dead" % ACTION_GROUP: ["rrb400_0", "rrb400_1"],
           "vo_%d_intro" % ACTOR_ID: ["rrb600"], "vo_%d_ready" % ACTOR_ID: ["rrb505"], "vo_%d_unlock" % ACTOR_ID: ["rrb503"],
           "vo_%d_power" % ACTOR_ID: ["rrb503", "rrb520"], "vo_%d_challenge" % ACTOR_ID: ["rrb504", "rrb502"],
           "vo_%d_prize" % ACTOR_ID: ["rrb525"], "vo_%d_sad" % ACTOR_ID: ["rrb403_0", "rrb403_1"],
           "vo_cx_ruby_reload": ["rrb505"], "vo_cx_ruby_revive": ["rrb500"],
           # 0.9.0: the Recoil Shot (the air backward gun-dash's call-out, sometimes)
           "vo_cx_ruby_recoil": ["rrb204_0", "rrb204_1", "rrb204_2"]}
# (priority, chance %) by group key, line or exact cue name, looked up before the state rules. One voice plays at a time
# (the voice category's limit is 1): a higher priority replaces the line playing, an equal or lower one is dropped. The
# scale is the stock heroes' (Ragna, Noel, Es): efforts 1-12, call-outs 19-20, spoken lines 50, Skill lines 55 and their
# follow-ups 56, supers 70, intro 90, hurt 98-100, death 101. Chance: BBTAG's own rates for its attack shouts (light 61 %,
# medium 76 %, heavy always), stock's for idles, stand-ups and room lines.
VOICE_CLASS = {"jump": (1, 40), "rrb000": (9, 30),
               "rrb100": (10, 60), "rrb101": (10, 60), "rrb102": (10, 75), "rrb103": (10, 75), "rrb104": (12, 100), "rrb105": (12, 100),
               "rrb200": (19, 100),
               "rrb201": (20, 100), "rrb202": (20, 100), "rrb203": (20, 100), "rrb204": (20, 100), "rrb205": (20, 100), "rrb206": (20, 100),
               "rrb209_v12": (50, 100), "rrb155": (50, 100), "rrb153": (51, 100), "rrb154": (52, 100),
               "tech_ground": (50, 60), "tech_air": (50, 70),
               "rrb157": (55, 100), "rrb159": (56, 100),
               "rrb207": (55, 100), "rrb207_v12": (55, 100), "rrb208": (56, 100), "rrb208_v12": (56, 100),
               "rrb210": (55, 100), "rrb211_v12": (56, 100), "rrb212": (55, 100), "rrb213": (55, 100), "rrb214": (55, 100), "rrb215": (56, 100),
               "vo_cx_ruby_reload": (58, 25),
               "vo_cx_ruby_recoil": (20, 35),     # a Skill she can repeat while MP lasts: the call-out one time in three
               "rrb520_521": (100, 100), "rrb522_523": (100, 100), "rrb524_525": (100, 100),
               "hurt_light": (98, 70), "hurt_heavy": (99, 100), "hurt_launch": (100, 100),
               "vo_%s_dead" % ACTION_GROUP: (101, 100), "vo_cx_ruby_revive": (102, 100),
               "vo_%d_intro" % ACTOR_ID: (90, 100), "vo_%d_ready" % ACTOR_ID: (91, 100), "vo_%d_unlock" % ACTOR_ID: (91, 100),
               "vo_%d_power" % ACTOR_ID: (50, 50), "vo_%d_challenge" % ACTOR_ID: (50, 40),
               "vo_%d_prize" % ACTOR_ID: (50, 50), "vo_%d_sad" % ACTOR_ID: (50, 60)}

# ---- levels (2026-10-02; measurements and method: local_only/agents/audio/AUDIO_FIX.md)
# BBTAG masters every sound near full scale and attenuates none in its sound banks (every XSB sound volume is 0 dB,
# pitch 0), so at BBEE's unity cue volume her sounds played 5-29 dB louder than base heroes' sounds of the same kind,
# summed past full scale on her busier moves (into BBEE's master limiter, CRIWARE/Limiter at -1 dBFS) and clipped on
# decode (the gunshot's source is clipped; most voice lines peak above 0 dBTP). Each imported wave is levelled before
# encoding. Levels are BS.1770 K-weighted momentary maxima ("M": the loudest 400 ms; a shorter sound counts its energy
# over 400 ms), effective = as BBEE plays them (waveform x AcbVolume x cue volume x category volumes).
# Targets: (median, upper quartile but at most median + 3 dB) of the effective M of base heroes' cues of the same kind
# (Noel, Ragna, Es, Jin, Hakumen; local_only/agents/audio/targets.py). A class keeps BBTAG's internal balance: it moves by the difference of
# its median to the stock median, never below the stock median (unless already below), never above the upper quartile,
# and never up.
LEVEL_TARGET = {"shot": (-20.0, -19.0),    # Noel's gun normals / gun skills (16 cues)
                "swing": (-19.3, -17.8),   # sword / blade / fist swings (41 cues)
                "move": (-28.2, -25.2),    # dashes, jumps, landings (39 cues; upper quartile -23.7 capped at +3 dB)
                "super": (-17.8, -14.9),   # supers / EX skills (16 cues)
                "foley": (-29.0, -29.0)}   # her casing clink: under the stock move median, 10 dB under her shot
SFX_CLASS = {"rrbse_02": "shot", "rrbse_08": "shot",                     # rifle shot (every round), Gun Blast boom
             "rrbse_01": "foley",                                           # casing, after every shot
             "000_airdash_0": "move", "019_cloth_b": "move", "rgse_00": "move",   # stage pass, intro cloth, back dash
             "rrbse_07": "super", "rrbse_09": "super", "rrbse_10": "super", "rrbse_11": "super", "rrbse_14": "super",
             "rrbse_15": "super"}                                           # Petal Burst / Dance, Red Reaper
DEFAULT_CLASS = "swing"   # scythe swings, and the whooshes her supers / throws use as strikes (000_airdash_1...)
SFX_STAGE_DB = 0.0        # her sound cue path: AcbVolume 1.0 x cue 1.0 (sfx_rg_attackUp) x categories 1.0
VO_STAGE_DB = 20 * math.log10(0.8 * 0.5)   # her voice cue path: cue 0.8 (vo_es_attack1) x the vo_role category 0.5
VO_TARGET_I = -17.6       # median integrated loudness of base heroes' battle voice cues (Noel, Ragna, Es; 151 cues)
TP_CEILING_DB = -1.5      # true-peak ceiling of the levelled PCM (HCA decoding adds up to ~0.5 dB of overshoot)
# rapid-fire sounds: the tail fades out (start s, length s), so repeats overlap less and the cue limit never cuts a
# loud part. The gunshot plays on every round (3 rounds 0.13 s apart in the stage 3 burst, 5 rounds 0.26 s apart);
# its source decays for 1.46 s (-10 dB at 0.45 s).
TAIL = {"rrbse_02": (0.45, 0.40), "rrbse_15": (0.55, 0.30), "000_airdash_1": (0.50, 0.30)}
# per-cue instance limits (the template's is 2): enough that the repeats above are never cut while audible
CUE_LIMIT = {"rrbse_02": 3, "rrbse_15": 3, "000_airdash_1": 5,
             "rrbse_05": 3}   # Petal Dance's slashes 0.11-0.12 s apart (0.67 s each)
LEVELS = {}   # what level_banks() did: {"sfx": {name: {...}}, "voice": {...}, "vo_volume": x}


def _log(log, *a):
    (log or print)(" ".join(str(x) for x in a))


# ---------------------------------------------------------------------------------------------------- BBTAG side
def script_cues():
    """{"sfx": {name: [states]}, "voice": {(names...): [states]}, "other": {repr: [states]}} from her script, with the
    same cue reader build_ruby uses for timing (bbtag_moves)."""
    import bbtag_moves as M, bbtag_read as R, bbtag_xact as X
    scr = R.fpac_files(X.read_fast(SCRIPT[0]))[SCRIPT[1]]
    mv = M.Moves(types.SimpleNamespace(col={}), scr, 1.0)   # no sprite boxes needed: cues only
    out = {"sfx": {}, "voice": {}, "other": {}}
    for st in mv.st:
        for _, kind, v in mv.move(st)["cues"]:
            if kind == "sfx":
                key, bucket = (v, "sfx") if isinstance(v, str) else (repr(v), "other")
                out[bucket].setdefault(key, set()).add(st)
            elif kind == "voice":
                out["voice"].setdefault(tuple(v), set()).add(st)
    return {k: {n: sorted(s) for n, s in d.items()} for k, d in out.items()}


def load_banks(raw=False, log=None, cues=None):
    """{bank name: {cue name: wave entry (with PCM)}} for the SE banks and the English voice bank. Every wave she
    imports comes back levelled for BBEE (level_banks) unless raw=True; the rest of a bank stays as read."""
    import bbtag_xact as X
    banks = {n: X.bank(p) for n, p, _ in SE_BANKS}
    banks[VO_BANK[0]] = X.bank(VO_BANK[1])
    return banks if raw else level_banks(banks, cues, log=log)


# ---------------------------------------------------------------------------------------------------- levelling
def _pcm(e):
    import numpy as np
    ch = e["channels"]
    a = np.frombuffer(e["data"][:e["samples"] * ch * 2], "<i2").astype(np.float64) / 32768.0
    return a.reshape(-1, ch).T.copy(), e["rate"]


def _entry(e, x):
    """A copy of wave entry e holding the PCM x (ch, n) as 16-bit."""
    import numpy as np
    y = np.clip(np.round(x.T * 32768.0), -32768, 32767).astype("<i2")
    d = dict(e)
    d["data"] = y.tobytes(); d["samples"] = y.shape[0]
    return d


def _kweighted(x, sr):
    """BS.1770 K-weighting (pre-filter shelf + RLB high-pass) applied in the frequency domain (exact magnitude)."""
    import numpy as np

    def biquad(b, a, z):
        return (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    A = 10 ** (4.0 / 40.0); w0 = 2 * math.pi * 1500.0 / sr; al = math.sin(w0) / (2 * (1 / math.sqrt(2)))
    sh_b = [A * ((A + 1) + (A - 1) * math.cos(w0) + 2 * math.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * math.cos(w0)),
            A * ((A + 1) + (A - 1) * math.cos(w0) - 2 * math.sqrt(A) * al)]
    sh_a = [(A + 1) - (A - 1) * math.cos(w0) + 2 * math.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * math.cos(w0)),
            (A + 1) - (A - 1) * math.cos(w0) - 2 * math.sqrt(A) * al]
    w1 = 2 * math.pi * 38.0 / sr; al1 = math.sin(w1) / (2 * 0.5)
    hp_b = [(1 + math.cos(w1)) / 2, -(1 + math.cos(w1)), (1 + math.cos(w1)) / 2]
    hp_a = [1 + al1, -2 * math.cos(w1), 1 - al1]
    n = x.shape[1]
    N = 1 << (n + 4096 - 1).bit_length()
    z = np.exp(-1j * 2 * math.pi * np.fft.rfftfreq(N, 1.0 / sr) / sr)
    g = np.abs(biquad(sh_b, sh_a, z)) * np.abs(biquad(hp_b, hp_a, z))
    return np.fft.irfft(np.fft.rfft(x, N, axis=1) * g[None, :], N, axis=1)[:, :n]


def _loudness(x, sr):
    """-> (M, I) in LUFS: M = the loudest 400 ms window (10 ms hop; a shorter sound zero-padded to 400 ms), I = gated
    integrated loudness (BS.1770: 400 ms blocks, 75 % overlap, -70 LUFS absolute and -10 LU relative gates; the
    whole sound when shorter than 400 ms). A mono wave counts once (BBEE centres it at constant power)."""
    import numpy as np
    p = _kweighted(x, sr) ** 2
    w = int(0.4 * sr)
    q = np.pad(p, ((0, 0), (0, max(0, w - p.shape[1]))))
    cs = np.cumsum(np.pad(q, ((0, 0), (1, 0))), axis=1)
    idx = np.arange(0, q.shape[1] - w + 1, max(1, int(0.01 * sr)))
    M = -0.691 + 10 * math.log10(max(float(((cs[:, idx + w] - cs[:, idx]) / w).sum(axis=0).max()), 1e-12))
    if p.shape[1] < w:
        I = -0.691 + 10 * math.log10(max(float(p.mean(axis=1).sum()), 1e-12))
    else:
        st = np.arange(0, p.shape[1] - w + 1, w // 4)
        bl = ((cs[:, st + w] - cs[:, st]) / w).sum(axis=0)
        L = -0.691 + 10 * np.log10(np.maximum(bl, 1e-12))
        g = bl[L > -70]
        I = -70.0
        if len(g):
            rel = -0.691 + 10 * math.log10(g.mean()) - 10
            g2 = bl[(L > -70) & (L > rel)]
            I = -0.691 + 10 * math.log10(g2.mean())
    return M, I


def _oversampled(x, k=4):
    """x (ch, n) band-limited to k x the rate (FFT zero-padding, edges padded so they don't ring)."""
    import numpy as np
    pad = 64
    y = np.pad(x, ((0, 0), (pad, pad)))
    n = y.shape[1]
    Y = np.fft.rfft(y, axis=1)
    Z = np.zeros((y.shape[0], n * k // 2 + 1), complex)
    Z[:, :Y.shape[1]] = Y
    if n % 2 == 0:
        Z[:, Y.shape[1] - 1] *= 0.5
    return np.fft.irfft(Z, n * k, axis=1)[:, pad * k:(n - pad) * k] * k


def _true_peak(x):
    import numpy as np
    return float(np.abs(_oversampled(x)).max()) if x.shape[1] else 0.0


def _minfilter(a, w):
    """Centred running minimum over w (odd) samples, O(n) (van Herk / Gil-Werman)."""
    import numpy as np
    h = w // 2
    p = np.pad(a, (h, h + w), constant_values=1.0)
    m = len(p) // w * w
    b = p[:m].reshape(-1, w)
    pre = np.minimum.accumulate(b, axis=1).ravel()
    suf = np.minimum.accumulate(b[:, ::-1], axis=1)[:, ::-1].ravel()
    return np.minimum(suf[:len(a)], pre[w - 1:w - 1 + len(a)])


def _limit(x, sr, ceiling_db, ramp=0.01):
    """True-peak limiter (offline, look-ahead, zero-phase): the gain dips only around inter-sample peaks above the
    ceiling, ramping over `ramp` s on both sides (no clicks); channels are linked. -> (x, peak gain reduction dB)"""
    import numpy as np
    c = 10 ** (ceiling_db / 20.0)
    n = x.shape[1]
    if n == 0:
        return x, 0.0
    env = np.abs(_oversampled(x)).max(axis=0)
    env = env[:n * 4].reshape(n, 4).max(axis=1)
    need = np.minimum(1.0, c / np.maximum(env, 1e-12))
    if need.min() >= 1.0:
        return x, 0.0
    r = max(1, int(ramp * sr)) | 1
    g = _minfilter(need, 2 * r + 1)
    cs = np.cumsum(np.concatenate([[0.0], np.pad(g, (r // 2, r // 2), mode="edge")]))
    g = (cs[r:] - cs[:-r])[:n] / r                     # moving average over r: stays under need at every peak
    y = x * g[None, :]
    tp = _true_peak(y)
    if tp > c:                                         # residual overshoot from the smoothing: a static trim
        y = y * (c / tp)
    return y, round(20 * math.log10(max(float(g.min()), 1e-9)), 2)


def _tail(x, sr, start, length):
    """Raised-cosine fade-out from `start` s over `length` s; the wave ends with the fade."""
    import numpy as np
    a, b = int(start * sr), int((start + length) * sr)
    if x.shape[1] <= a:
        return x
    b = min(b, x.shape[1])
    y = x[:, :b].copy()
    y[:, a:b] *= (0.5 + 0.5 * np.cos(np.linspace(0.0, math.pi, b - a)))[None, :]
    return y


def _edges(x, sr):
    """A wave that starts or ends away from zero clicks: 1 ms raised-cosine fade-in / 5 ms fade-out when the first /
    last sample is above -60 dBFS."""
    import numpy as np
    y = x
    for side, ms in ((0, 0.001), (-1, 0.005)):
        if y.shape[1] and float(np.abs(y[:, side]).max()) > 1e-3:
            k = min(y.shape[1], max(2, int(ms * sr)))
            ramp = 0.5 - 0.5 * np.cos(np.linspace(0.0, math.pi, k))
            y = y.copy()
            if side == 0:
                y[:, :k] *= ramp[None, :]
            else:
                y[:, -k:] *= ramp[::-1][None, :]
    return y


def level_banks(banks, cues=None, log=None):
    """Level every wave she imports (in place of the bank entries; the rest of a bank stays as read):
      sound effects  tail fade (TAIL), loudness to the stock level of its class (LEVEL_TARGET), true-peak ceiling;
      voice          true-peak ceiling, then the sheet's AcbVolume puts the median line on the stock median
                     (VO_TARGET_I); BBTAG's balance between lines is kept.
    Records what it did in LEVELS. -> banks"""
    import statistics
    cues = cues or script_cues()
    se_used = cues["sfx"]
    sfx = {}
    for bname, _, take_all in SE_BANKS:
        for n, e in banks[bname].items():
            if (take_all or n in se_used) and n not in sfx:
                sfx[n] = bname
    meas = {}
    for n, bname in sfx.items():
        x, sr = _pcm(banks[bname][n])
        if n in TAIL:
            x = _tail(x, sr, *TAIL[n])
        M, _ = _loudness(x, sr)
        meas[n] = (x, sr, M + SFX_STAGE_DB, SFX_CLASS.get(n, DEFAULT_CLASS))
    hers = {}
    for n, (_, _, M, cls) in meas.items():
        hers.setdefault(cls, []).append(M)
    rep = {"sfx": {}, "voice": {}}
    for n, (x, sr, M, cls) in sorted(meas.items()):
        med, hi = LEVEL_TARGET[cls]
        off = med - statistics.median(hers[cls])
        target = min(max(M + off, min(M, med)), hi)
        gain = min(0.0, target - M)
        y, gr = _limit(x * 10 ** (gain / 20.0), sr, TP_CEILING_DB)
        y = _edges(y, sr)
        bname = sfx[n]
        src_n = banks[bname][n]["samples"]
        banks[bname][n] = _entry(banks[bname][n], y)
        rep["sfx"][n] = {"class": cls, "M_before": round(M, 2), "gain_db": round(gain, 2), "M_after": round(M + gain, 2),
                         "limiter_db": gr, "samples": [src_n, banks[bname][n]["samples"]], "cue_limit": CUE_LIMIT.get(n)}
    # voice: one static gain for every line (the median line to the stock median; BBTAG's balance between lines is
    # kept), then the true-peak ceiling; the sheet's AcbVolume takes up what the ceiling cost the median line
    vb = banks[VO_BANK[0]]
    raw = {n: _pcm(vb[n]) for n in sorted(vb)}
    med_raw = statistics.median(_loudness(x, sr)[1] for x, sr in raw.values()) + VO_STAGE_DB
    vgain = min(0.0, VO_TARGET_I - med_raw)
    Is, grs = [], []
    for n, (x, sr) in raw.items():
        y, gr = _limit(x * 10 ** (vgain / 20.0), sr, TP_CEILING_DB)
        y = _edges(y, sr)
        vb[n] = _entry(vb[n], y)
        Is.append(_loudness(y, sr)[1]); grs.append(gr)
    med_I = statistics.median(Is) + VO_STAGE_DB          # at AcbVolume 1.0
    vol = max(0.5, min(1.0, round(10 ** ((VO_TARGET_I - med_I) / 20.0), 3)))
    LEVELS.clear()
    LEVELS.update(rep)
    LEVELS["voice"] = {"lines": len(Is), "median_I_before": round(med_raw, 2), "gain_db": round(vgain, 2),
                       "median_I_at_1.0": round(med_I, 2), "target_I": VO_TARGET_I,
                       "limited_lines": sum(1 for g in grs if g < 0), "max_limiter_db": min(grs) if grs else 0.0,
                       "median_limiter_db": statistics.median(grs) if grs else 0.0}
    LEVELS["vo_volume"] = vol
    _log(log, "  levels: %d sounds (gain %s dB), %d voice lines (%d limited), voice AcbVolume %.3f" % (
        len(rep["sfx"]), "/".join("%+.1f" % v["gain_db"] for v in rep["sfx"].values()), len(Is), LEVELS["voice"]["limited_lines"], vol))
    return banks


def _priority(states):
    best = None
    for st in states:
        for pat, p in PRIORITY_RULES:
            if re.search(pat, st):
                best = p if best is None else max(best, p); break
    return DEFAULT_PRIORITY if best is None else best


def _class(key, states):
    """(priority, chance %) of a voice cue: its class if it has one, else the state rules and 100 %"""
    pr, ch = VOICE_CLASS.get(key, (None, 100))
    return (_priority(states) if pr is None else pr), ch


def _takes(spec, voice_bank):
    """an EXTRA_GROUPS value -> the lines in the bank: a base name = every take of it"""
    if isinstance(spec, str):
        return sorted(n for n in voice_bank if re.match(r"^%s_\d+$" % spec, n))
    return [n for n in spec if n in voice_bank]


def _group_key(names, voice_bank):
    m = [re.match(r"^(rrb\d+)_(\d+)$", n) for n in names]
    if all(m) and len({x.group(1) for x in m}) == 1:
        base = m[0].group(1)
        every = sorted(n for n in voice_bank if re.match(r"^%s_\d+$" % base, n))
        if sorted(names) == every:
            return base
        return base + "_v" + "".join(sorted(x.group(2) for x in m))
    s = sorted(names)
    return s[0] + "".join("_" + (n[3:] if n.startswith("rrb") else n) for n in s[1:])


def plan(banks=None, cues=None):
    """The deterministic mapping (no encoding): which BBTAG waves go into which sheet under which cue name and id.
    Returns {"sfx": [cue], "voice": [cue], "map": audio_map dict}; a cue is {"name", "bbtag": [names], "bank",
    "waves": [(bank, name)], "priority", "duration", "states"}."""
    cues = cues or script_cues()
    banks = banks or load_banks(cues=cues)
    vb = banks[VO_BANK[0]]
    se_used = cues["sfx"]
    amap = {"sfx": {}, "voice": {}, "groups": {}, "not_imported": {}}

    def dur(e):
        return round(e["samples"] / float(e["rate"]), 4)

    # ---- sound effects: every serrb entry + the se00 / sebrg entries her script plays
    sfx = {}
    for bname, _, take_all in SE_BANKS:
        for n, e in banks[bname].items():
            if (take_all or n in se_used) and n not in sfx:
                sfx[n] = (bname, e)
    sfx_cues = []
    for n in sorted(sfx):
        bname, e = sfx[n]
        c = {"name": SFX_PREFIX + n, "bbtag": [n], "bank": bname, "waves": [(bname, n)], "priority": None,
             "duration": dur(e), "states": se_used.get(n, [])}
        sfx_cues.append(c)
        amap["sfx"][n] = {"cue": c["name"], "sheet": SFX_SHEET, "bank": bname, "duration": c["duration"], "states": c["states"]}

    # ---- voice: every line of her English battle voice bank, one cue each
    states_of = {}
    for n, sts in se_used.items():          # lines her script plays through a sound command (intro, idle, win)
        if n in vb:
            states_of.setdefault(n, set()).update(sts)
    for names, sts in cues["voice"].items():
        for n in names:
            if n in vb:
                states_of.setdefault(n, set()).update(sts)
    vo_cues = []
    for n in sorted(vb):
        sts = sorted(states_of.get(n, ()))
        pr, ch = _class(n, sts)
        c = {"name": VO_PREFIX + n, "bbtag": [n], "bank": VO_BANK[0], "waves": [(VO_BANK[0], n)],
             "priority": pr, "probability": ch, "duration": dur(vb[n]), "states": sts}
        vo_cues.append(c)
        amap["voice"][n] = {"cue": c["name"], "sheet": VO_SHEET, "bank": VO_BANK[0], "duration": c["duration"],
                            "priority": c["priority"], "probability": ch, "states": sts, "groups": []}
    # ---- one random-no-repeat cue per variant list her script plays
    groups = {}
    for names, sts in sorted(cues["voice"].items()):
        have = [n for n in names if n in vb]
        for n in names:
            if n not in vb:
                amap["not_imported"][n] = "voice line not in %s (a tag-partner line from another bank)" % VO_BANK[0]
        if not have:
            continue
        key = _group_key(have, vb)
        g = groups.setdefault(key, {"names": have, "states": set()})
        g["states"].update(sts)
    for key, spec in EXTRA_GROUPS.items():           # the groups the reader does not list (see EXTRA_GROUPS)
        have = _takes(spec, vb)
        if key in groups:
            raise SystemExit("ruby_audio: extra voice group %s is already a script group" % key)
        if len(have) != (len(spec) if not isinstance(spec, str) else max(1, len(have))) or not have:
            raise SystemExit("ruby_audio: voice group %s: lines missing from %s (%s)" % (key, VO_BANK[0], spec))
        groups[key] = {"names": have, "states": set()}
    for key in sorted(groups):
        g = groups[key]; sts = sorted(g["states"])
        pr, ch = _class(key, sts)
        c = {"name": VO_PREFIX + key + GROUP_SUFFIX, "bbtag": list(g["names"]), "bank": VO_BANK[0],
             "waves": [(VO_BANK[0], n) for n in g["names"]], "priority": pr, "probability": ch,
             "duration": max(dur(vb[n]) for n in g["names"]), "states": sts}
        vo_cues.append(c)
        amap["groups"][key] = {"cue": c["name"], "sheet": VO_SHEET, "bbtag": list(g["names"]),
                               "variants": [VO_PREFIX + n for n in g["names"]], "priority": c["priority"], "probability": ch,
                               "duration": c["duration"], "states": sts,
                               "note": "plays one variant at random, never the same twice running (as BBTAG)"}
        for n in g["names"]:
            amap["voice"][n]["groups"].append(key)
    # ---- cues the game asks for by exact name (see ALIASES): built like groups, named exactly
    amap["aliases"] = {}
    for name in sorted(ALIASES):
        have = [n for n in ALIASES[name] if n in vb]
        if len(have) != len(ALIASES[name]):
            raise SystemExit("ruby_audio: %s: lines missing from %s (%s)" % (name, VO_BANK[0], ALIASES[name]))
        if name.endswith("_loop"):
            raise SystemExit("ruby_audio: cue name %s ends in _loop (the game loops such cues)" % name)
        pr, ch = _class(name, [])
        c = {"name": name, "bbtag": have, "bank": VO_BANK[0], "waves": [(VO_BANK[0], n) for n in have], "priority": pr,
             "probability": ch, "duration": max(dur(vb[n]) for n in have), "states": []}
        vo_cues.append(c)
        amap["aliases"][name] = {"cue": name, "sheet": VO_SHEET, "bbtag": have, "priority": pr, "probability": ch, "duration": c["duration"]}
    # ---- names her script plays that are in none of the banks
    for n, sts in se_used.items():
        if n not in sfx and n not in vb:
            amap["not_imported"][n] = "not in serrb / se00 / sebrg / %s (a tag-partner line from another bank)" % VO_BANK[0]
    for k in cues["other"]:
        amap["not_imported"][k] = "not a sound name (a numeric sound command: footsteps)"
    for sheet, cl in ((SFX_SHEET, sfx_cues), (VO_SHEET, vo_cues)):
        if len(cl) >= 1000:
            raise SystemExit("ruby_audio: %s has %d cues; AudioCollection ids are sheet*1000 + cue id" % (sheet, len(cl)))
    amap["cue_ids"] = {SFX_SHEET: {c["name"]: i for i, c in enumerate(sfx_cues)},
                       VO_SHEET: {c["name"]: i for i, c in enumerate(vo_cues)}}
    if LEVELS:
        amap["levels"] = json.loads(json.dumps(LEVELS))   # what level_banks did (durations above are levelled)
    return {"sfx": sfx_cues, "voice": vo_cues, "map": amap}


def write_map(p, sheets=None, path=MAP):
    m = dict(p["map"])
    m = {"generated": time.strftime("%Y-%m-%d %H:%M:%S"),
         "about": "Ruby's BBTAG sound and voice names -> the BBEE cue to put in Audios[].Cue (mods/char-ruby/ruby_audio.py). "
                  "sfx / voice: one cue per BBTAG name; groups: one cue per variant list her BBTAG script plays, "
                  "rotating its variants. Local and generated: names only, never packaged.",
         "sheets": sheets or {SFX_SHEET: {"template": "%s/%s" % SFX_TEMPLATE}, VO_SHEET: {"template": "%s/%s" % VO_TEMPLATE}},
         "hero_config_cue_sheets": ["sfx_no", SFX_SHEET, VO_SHEET], **m}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(m, open(path, "w", encoding="utf-8"), indent=1)
    return path


def cue_for(kind, value, amap=None):
    """The BBEE cue for one BBTAG script cue as bbtag_moves reports it: ("sfx", "rrbse_06") -> "sfx_cx_ruby_rrbse_06";
    ("sfx", "rrb600") -> "vo_cx_ruby_rrb600" (a voice line played by a sound command); ("voice", ["rrb201_1",
    "rrb201_2", "rrb201_0"]) -> "vo_cx_ruby_rrb201_rnd". None when the sound isn't imported (tag-partner lines).
    amap: gen/audio_map.json's content (read if not given; `python mods/char-ruby/ruby_audio.py map` writes it)."""
    if amap is None:
        amap = json.load(open(MAP, encoding="utf-8"))
    if kind == "sfx" and isinstance(value, str):
        e = amap["sfx"].get(value) or amap["voice"].get(value)
        return e["cue"] if e else None
    if kind == "voice":
        have = sorted(n for n in value if n in amap["voice"])
        for g in amap["groups"].values():
            if sorted(g["bbtag"]) == have and have:
                return g["cue"]
    return None


# ---------------------------------------------------------------------------------------------------- encoding
def _run(cmd):
    """A program's output as text whatever the PC's language: the .NET tools answer in UTF-8 or in the console's code
    page, and a strict decode of the wrong one stops the build on a non-English Windows."""
    r = subprocess.run(cmd, capture_output=True)
    dec = lambda b: (b or b"").decode("utf-8", "replace")
    return r.returncode, dec(r.stdout), dec(r.stderr)


def ensure_encoder(log=None):
    if os.path.exists(ENCODER):
        return ENCODER
    get = "Install the .NET SDK, version 8 or newer (https://dotnet.microsoft.com/download, free), then run the install again."
    if not shutil.which("dotnet"):
        raise SystemExit("ruby_audio: the HCA encoder is missing (%s) and the .NET SDK is not installed to build it. %s" % (ENCODER, get))
    try: sdks = _run(["dotnet", "--list-sdks"])[1].strip()
    except OSError: sdks = ""
    if not sdks:   # `dotnet` alone can be a .NET runtime, which runs programs and builds none
        raise SystemExit("ruby_audio: the HCA encoder is missing (%s) and this PC has a .NET runtime but no .NET SDK to build it "
                         "(`dotnet --list-sdks` lists none). %s" % (ENCODER, get))
    _log(log, "  building the HCA encoder (tools/hca, VGAudio)")
    rc, so, se = _run(["dotnet", "build", os.path.join(ENCODER_DIR, "HcaEncode.csproj"), "-c", "Release", "-o", os.path.dirname(ENCODER)])
    if rc != 0 or not os.path.exists(ENCODER):
        raise SystemExit("ruby_audio: building tools/hca failed (the .NET SDK downloads one package, VGAudio, the first time: "
                         "check the internet connection):\n" + (so + se)[-1500:])
    return ENCODER


def prebuilt_name(key):
    """where one encoded wave sits in an alpha package, under bbtag_alpha/hca: <bank>/<wave>.hca"""
    bank, name = str(key[0]), str(key[1])
    if not (re.fullmatch(r"[A-Za-z0-9_]+", bank) and re.fullmatch(r"[A-Za-z0-9_.\-]+", name)):
        raise SystemExit("ruby_audio: a wave name that can't be a file name: %r" % (key,))
    return "%s/%s.hca" % (bank, name)


def _prebuilt_dir():
    """An alpha package carries her sounds already encoded (bbtag_alpha/hca; tools/make_ruby_release.py --bundle-bbtag),
    so a tester's PC needs neither the encoder nor the .NET SDK. Any other copy (the workspace, a package that reads the
    player's own Cross Tag Battle) has no such folder and encodes."""
    import bbtag_read
    d = os.path.join(bbtag_read.BUNDLED_DIR, "hca")
    return d if bbtag_read.BUNDLED and os.path.isdir(d) else None


def encoded_waves(log=None):
    """{(bank, wave): HCA bytes} for every wave of her two sheets, encoded as build() encodes them. The packager stores
    them in an alpha package (prebuilt_name)."""
    cues = script_cues()
    banks = load_banks(log=log, cues=cues)
    p = plan(banks, cues)
    keys = []
    for part in ("sfx", "voice"):
        for c in p[part]:
            for w in c["waves"]:
                if w not in keys: keys.append(w)
    return encode([(k, banks[k[0]][k[1]]) for k in keys], log)


def encode(entries, log=None):
    """[(key, wave entry)] -> {key: HCA bytes}; cached in local_only/cross_effect/audio/hca_cache by PCM content. An
    alpha package's own encoded waves (_prebuilt_dir) are taken as they are."""
    import bbtag_xact as X
    os.makedirs(HCA_CACHE, exist_ok=True)
    out, todo = {}, {}
    pre = _prebuilt_dir(); taken = 0
    for key, e in entries:
        if pre:
            pp = os.path.join(pre, *prebuilt_name(key).split("/"))
            if os.path.exists(pp):
                out[key] = open(pp, "rb").read(); taken += 1
                continue
        wav = X.wav_bytes(e)
        h = hashlib.sha1(CACHE_TAG + wav).hexdigest()
        p = os.path.join(HCA_CACHE, h + ".hca")
        if os.path.exists(p):
            out[key] = open(p, "rb").read()
        else:
            todo.setdefault(h, (wav, []))[1].append(key)
    if todo:
        enc = ensure_encoder(log)
        tmp = os.path.join(STORE, "_encode_%d" % os.getpid())
        wd, hd = os.path.join(tmp, "wav"), os.path.join(tmp, "hca")
        os.makedirs(wd, exist_ok=True)
        try:
            for h, (wav, _) in todo.items():
                open(os.path.join(wd, h + ".wav"), "wb").write(wav)
            t0 = time.time()
            rc, so, se = _run([enc, "--batch", wd, hd, QUALITY])
            if rc != 0:
                raise SystemExit("ruby_audio: HcaEncode failed: " + (se or so)[-800:])
            for h, (_, keys) in todo.items():
                src = os.path.join(hd, h + ".hca")
                data = open(src, "rb").read()
                os.replace(src, os.path.join(HCA_CACHE, h + ".hca"))
                for k in keys:
                    out[k] = data
            _log(log, "  encoded %d waves to HCA in %.1fs" % (len(todo), time.time() - t0))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    if taken: _log(log, "  %d waves already encoded in this package (bbtag_alpha/hca)%s" % (taken, "" if not todo else "; %d encoded here" % len(todo)))
    return out


# ---------------------------------------------------------------------------------------------------- BBEE side
def _template(name):
    p = os.path.join(AUDIO_DIR, name + ".acb")
    if not os.path.exists(p):
        raise SystemExit("ruby_audio: stock template %s not found (%s)" % (name, p))
    return open(p, "rb").read()


def _voice_template():
    """The voice template (VO_TEMPLATE's stock sheet) with the two header values that are the donor's own replaced:
    her master volume, and no action tracks. cri_acb re-serialises a stock header byte for byte (checked on
    vo_role_bl, ES_voice, rg_voice, sfx_rg), so nothing else changes."""
    import cri_acb as C
    A = C.Acb(_template(VO_TEMPLATE[0]))
    row = dict(A.row)
    for k in ("AcbVolume", "ActionTrackTable"):
        if k not in row:
            raise SystemExit("ruby_audio: voice template %s has no %s" % (VO_TEMPLATE[0], k))
    row["AcbVolume"] = float(LEVELS.get("vo_volume", VO_VOLUME))
    row["ActionTrackTable"] = b""
    return C.UTF(A.head.name, A.head.columns, [row], A.head.version, A.head.encoding).build(top=True)


def _set_cue_limits(data, limits):
    """The cue limit (0x004F: u16 limit, u16 slot, u8 mode) of the named cues of a built ACB, and the cue-limit work
    table resized as CRI sizes it (48 x limited cues + 16 x the sum of their limits + 8 bytes; clone_acb's rule).
    limits: {cue name: instances}. -> ACB bytes"""
    import cri_acb as C
    A = C.Acb(data)
    T = A.t
    names = A.cue_names()
    sc = T["SeqCommandTable"]
    rows = [dict(r) for r in sc.rows]
    for cue, n in limits.items():
        if cue not in names:
            continue
        si = T["SequenceTable"].rows[T["CueTable"].rows[names[cue]]["ReferenceIndex"]]["CommandIndex"]
        lim = C.cmd_get(rows[si]["Command"], C.OP_CUE_LIMIT)
        if lim is None:
            raise SystemExit("ruby_audio: %s has no cue limit to change" % cue)
        _, slot, mode = struct.unpack(">HHB", lim[:5])
        rows[si]["Command"] = C.cmd_set(rows[si]["Command"], C.OP_CUE_LIMIT, struct.pack(">HHB", int(n), slot, mode) + lim[5:])
    n_lim = n_nodes = 0
    for r in rows:
        lim = C.cmd_get(r["Command"], C.OP_CUE_LIMIT)
        if lim is not None:
            n_lim += 1; n_nodes += struct.unpack(">H", lim[:2])[0]
    row = dict(A.row)
    row["SeqCommandTable"] = C.UTF(sc.name, sc.columns, rows, sc.version, sc.encoding).build()
    row["NumCueLimitListWorks"], row["NumCueLimitNodeWorks"] = n_lim, n_nodes
    row["CueLimitWorkTable"] = bytes(48 * n_lim + 16 * n_nodes + 8) if n_lim else b""
    return C.UTF(A.head.name, A.head.columns, [row], A.head.version, A.head.encoding).build(top=True)


def _refuse_action_tracks(sheet, data):
    """Her sheets are built without the template's action tracks: no sequence or synth of hers may point at one."""
    import cri_acb as C
    A = C.Acb(data)
    for tname in ("SequenceTable", "SynthTable"):
        bad = [i for i, r in enumerate(A.t[tname].rows) if r.get("NumActionTracks") or r.get("ActionTrackStartIndex", 0xFFFF) != 0xFFFF]
        if bad:
            raise SystemExit("ruby_audio: %s: %d %s rows use action tracks (template %s); pick another exemplar cue"
                             % (sheet, len(bad), tname, VO_TEMPLATE[0]))


def _template_subkey(template_bytes):
    """The subkey in a stock sheet's memory AWB header: the game reads that sheet's waveforms with key x subkey."""
    import cri_acb as C
    return C.afs2_read(C.Acb(template_bytes).row["AwbFile"])[0]["subkey"]


def _encrypt_waves(data, subkey):
    """A built ACB whose memory AWB holds unencrypted HCA -> the same ACB with every waveform encrypted for the game's key
    and `subkey` (hca_crypt.encrypt: cipher type 56, masked header) and `subkey` in the AWB header, as every stock sheet
    is stored. (2026-10-02, found by the DELTARUNE Party session in cri_ware_unity.dll and confirmed in game by the lead:
    the game's CRI runtime runs EVERY HCA frame through its decryption table whatever the file's `ciph` field says, so an
    unencrypted waveform plays as full-scale noise: Ruby's "loud ... broken" audio.) Sizes, ids, order and alignment
    stay; the waveform rows (channels, rate, samples) are unaffected."""
    import cri_acb as C
    import hca_crypt
    A = C.Acb(data)
    hdr, files = C.afs2_read(A.row["AwbFile"])
    enc = [(i, hca_crypt.encrypt(h, hca_crypt.KEY, subkey)) for i, h in files]
    if any(len(e) != len(h) for (_, e), (_, h) in zip(enc, files)):
        raise SystemExit("ruby_audio: encryption changed a waveform's size")
    row = dict(A.row)
    row["AwbFile"] = C.afs2_build(enc, align=hdr["align"], version=hdr["version"], offset_size=hdr["offset_size"],
                                  id_size=hdr["id_size"], subkey=subkey)
    return C.UTF(A.head.name, A.head.columns, [row], A.head.version, A.head.encoding).build(top=True)


SUBKEYS = {}          # sheet -> the AWB subkey its waveforms were encrypted with (build_acbs)


def build_acbs(p, banks, log=None):
    """-> {sheet: (acb bytes, cues)}; each cue gets "cue_id" / "length_ms"; every wave's HCA sample count is checked
    against its source."""
    import cri_acb as C
    out = {}
    for sheet, (tname, exemplar), cues, voice in ((SFX_SHEET, SFX_TEMPLATE, p["sfx"], False),
                                                  (VO_SHEET, VO_TEMPLATE, p["voice"], True)):
        keys = []
        for c in cues:
            for w in c["waves"]:
                if w not in keys:
                    keys.append(w)
        hca = encode([(k, banks[k[0]][k[1]]) for k in keys], log)
        waves = [{"hca": hca[k], "key": k} for k in keys]
        index = {k: i for i, k in enumerate(keys)}
        acb_cues = [{"name": c["name"], "waves": [index[w] for w in c["waves"]], "priority": c["priority"],
                     "probability": c.get("probability", 100)} for c in cues]
        guid = hashlib.md5(("cross-effect:" + sheet).encode()).digest()
        data = C.clone_acb(_voice_template() if voice else _template(tname), exemplar, sheet, acb_cues, waves, guid, voice=voice)
        if voice: _refuse_action_tracks(sheet, data)
        else: data = _set_cue_limits(data, {SFX_PREFIX + n: v for n, v in CUE_LIMIT.items()})
        for w in waves:
            src = banks[w["key"][0]][w["key"][1]]
            if w["info"]["samples"] != src["samples"] or w["info"]["rate"] != src["rate"] or w["info"]["channels"] != src["channels"]:
                raise SystemExit("ruby_audio: %s: HCA %s/%d Hz/%d ch differs from the source %d/%d/%d" % (
                    w["key"], w["info"]["samples"], w["info"]["rate"], w["info"]["channels"], src["samples"], src["rate"], src["channels"]))
        for c, a in zip(cues, acb_cues):
            c["cue_id"], c["length_ms"] = a["cue_id"], a["length_ms"]
        # clone_acb takes unencrypted HCA; the game needs them encrypted like the template's own (see _encrypt_waves)
        subkey = _template_subkey(_template(VO_TEMPLATE[0] if voice else tname))
        data = _encrypt_waves(data, subkey); SUBKEYS[sheet] = subkey
        out[sheet] = (data, cues)
        _log(log, "  %s: %d cues, %d waveforms, %.1f MB; waveforms encrypted (ciph 56, AWB subkey %d)" % (
            sheet, len(cues), len(waves), len(data) / 1e6, subkey))
    return out


def store_acb(sheet, data):
    """Content-addressed: <STORE>/<sheet>_<sha1 12>.acb (written once, never replaced)."""
    os.makedirs(STORE, exist_ok=True)
    p = os.path.join(STORE, "%s_%s.acb" % (sheet, hashlib.sha1(data).hexdigest()[:12]))
    if not os.path.exists(p) or os.path.getsize(p) != len(data):
        tmp = p + ".tmp%d" % os.getpid()
        open(tmp, "wb").write(data)
        os.replace(tmp, p)
    return os.path.abspath(p)


def _collection_env(out_dir):
    """The collection to patch: another importer's output in this build folder if present, else the pristine bundle
    of the installed game (bbmod.find_entry reads the pristine index, never our own m_mod.m)."""
    import bbtag_rig as RG
    bbmod, UnityPy = RG._unity()
    built = os.path.join(out_dir, "data", "audiocollection.ab")
    if os.path.exists(built):
        env = UnityPy.load(open(built, "rb").read())
        env.typetree_generator = bbmod.typetree_gen()
        return env, "build folder"
    return RG._env(bbmod, UnityPy, "data/audiocollection"), "installed game (pristine)"


def _refuse_asset_conflicts():
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
        if not p or os.path.normcase(os.path.dirname(os.path.abspath(p))) == os.path.normcase(HERE):
            continue
        try:
            m = json.load(open(p, encoding="utf-8"))
        except ValueError:
            continue
        for a in (m.get("content") or {}).get("assets") or []:
            if "audiocollection" in json.dumps(a).lower():
                raise SystemExit("ruby_audio: mod %s patches data/audiocollection through `assets`; that step runs "
                                 "after importers and would drop Ruby's sheets. Move it to an importer." % mj)


def patch_collection(out_dir, sheets, log=None):
    """Append our sheets to the live collection; returns {sheet: id}."""
    import bbtag_rig as RG
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
            raise SystemExit("ruby_audio: cue sheet name %s already exists in the collection" % sheet)
        clash = [c["name"] for c in cues if c["name"] in taken_cues]
        if clash:
            raise SystemExit("ruby_audio: cue names already used in the collection: %s" % clash[:5])
        if next_id >= 1000:
            raise SystemExit("ruby_audio: sheet id %d (the runtime cue id is sheet * 1000 + cue)" % next_id)
        voice = sheet == VO_SHEET
        t["ListCueSheet"].append({"Name": sheet, "Id": next_id, "Linguals": [{
            "LingualTag": "common", "_acbPath": path, "_awbPath": "",
            "Cues": [{"Name": c["name"], "Duration": float(c["length_ms"]) / 1000.0, "CriwareId": c["cue_id"],
                      "Blocks": [], "Priority": c["priority"] if voice else -1, "PreFirst": 1 if voice else 0}
                     for c in cues]}]})
        ids[sheet] = next_id
        taken_cues.update(c["name"] for c in cues)
        next_id += 1
    mb.save_typetree(t)
    RG._save(env, out_dir, "data/audiocollection")
    _log(log, "  audio collection (from the %s): +%s" % (src, ", ".join("%s id %d" % kv for kv in ids.items())))
    return ids


def build(out_dir, log=print):
    """The importer step: returns manifest additions ({"names", "entries", "guids"}; empty: data/audiocollection.ab
    replaces a bundle the manifest already has)."""
    t0 = time.time()
    _refuse_asset_conflicts()
    cues = script_cues()
    banks = load_banks(log=log, cues=cues)
    p = plan(banks, cues)
    acbs = build_acbs(p, banks, log)
    paths = {sheet: store_acb(sheet, data) for sheet, (data, _) in acbs.items()}
    ids = patch_collection(out_dir, {s: (paths[s], acbs[s][1]) for s in acbs}, log)
    for s, (data, cues) in acbs.items():
        for c in cues:
            p["map"]["cue_ids"][s][c["name"]] = c["cue_id"]
    write_map(p, {s: {"id": ids[s], "acb": paths[s], "cues": len(acbs[s][1]),
                      "template": "%s/%s" % (SFX_TEMPLATE if s == SFX_SHEET else VO_TEMPLATE),
                      "bytes": len(acbs[s][0])} for s in acbs})
    _log(log, "  Ruby audio: %d sound + %d voice cues, %s in %.1fs" % (len(p["sfx"]), len(p["voice"]),
                                                                      os.path.relpath(MAP, ROOT), time.time() - t0))
    return {"names": [], "entries": [], "guids": []}


def main():
    a = sys.argv[1:]
    if a[:1] in (["map"], ["build"]):   # both read her Cross Tag Battle banks: the ownership check first
        import import_ruby
        import_ruby.require_ownership(a[1] if a[:1] == ["build"] and len(a) == 2 else None)
    if a[:1] == ["map"]:
        print("wrote", write_map(plan()))
    elif a[:1] == ["build"] and len(a) == 2:
        os.makedirs(a[1], exist_ok=True)
        print(json.dumps(build(a[1])))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
