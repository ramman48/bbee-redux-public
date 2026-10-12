"""ruby_ui.py -- Ruby's UI art: every BBEE slot a playable character can appear in (docs/cross-effect/research/UI_ART.md).

Two halves:
  static data (slot paths, sizes, sprite aliases, HUD atlas sprite names)  -> written into mod.json by build_ruby.py
  build(out_dir)  -> composes each image from the PLAYER'S OWN BBTAG install and writes the bundles (importer, build time)
No image made from BBTAG art is stored in the mod folder. The icons (Potential, Legacy, Skill, talent, Dust) are the
project's own Krita art in art/icons (load_icons); the select portrait's layout and rows are in rrb_portrait.py.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = next(p for p in [os.path.abspath(os.path.join(HERE, *([".."] * k))) for k in range(1, 7)] if os.path.exists(os.path.join(p, "bbmod.py")))   # the workspace (mods/<id> or a staging copy deeper down)
TOOLS = next(p for p in (os.path.join(HERE, "own"), ROOT) if os.path.isdir(os.path.join(p, "tools", "bbtag")))   # her tools: in a loader pack, her own copies (own/); else the root's
sys.path[:0] = [TOOLS, os.path.join(TOOLS, "tools", "bbtag"), HERE, ROOT]
import rrb_portrait   # her select portrait: composition + HeroPortraitOffsetConfigUI rows (sized against Hibiki)

ACTOR = 200701
ICEY = 103701
TALENT = 5098
ICON_DIR = os.path.join(HERE, "art", "icons")   # the Krita icons (art/kr_ruby.py): icons.json + one PNG per slot
# Potential Unleashed (IconId = rrb_pots.UNLEASHED) on its card and in her battle HUD atlas: True = the stock
# Potential_5000 hexagon every stock character shares (read from the install at build time); False = her own Krita
# icon (icons.json p20799). The lead decides.
USE_STOCK_UNLEASHED = True
# The battle HUD atlas's container. The C# HUD builds UI/Atlas/IconPotential<ActorId> itself and asks it for
# Potential_<IconId>, so every card needs a sprite in this ONE atlas (a second atlas can't be reached). She needs 46
# sprites (40 cards, Unleashed, Skill on / off, 2 Legacy, the talent). The donor until 0.6.11, Cells' IconPotential103801,
# has 40 Sprite objects on 35 cells: too few, which is why 0.x built 16 cards only. IconSkillMB is a base-game shared
# atlas with 62 cells of the same kind as every stock IconPotential<actor> atlas (120 x 120, 100 px per unit, centre
# pivot, full-rect quads, no SpriteAtlas object; compared with Ragna's IconPotential100101 on 2026-10-02). Only its
# container is used: the page is redrawn blank and the Sprite objects she doesn't need are removed.
HUD_ATLAS_SRC = "ui/atlas/iconskillmb/iconskillmb"
HUD_CELL = (120, 120)
HUD_ATLAS = "ui/atlas/iconpotential%d/iconpotential%d" % (ACTOR, ACTOR)
HUD_ATLAS_PATH = "UI/Atlas/IconPotential%d/IconPotential%d" % (ACTOR, ACTOR)

# textures: key -> (donor bundle, our bundle, [(old, new) renames], UI texture path (for metrics / tex: aliases) or None,
#                   metrics (w, h) or None, texture size (w, h))
T = {
    # the select portrait: her whole figure 1:1 (1664 x 1940), shown at that size; her rows (rrb_portrait.offset_rows)
    # place it like Hibiki's on every screen
    "full":      ("ui/texture/heroportraitfull/heroportraitfull_%d" % ICEY, "ui/texture/heroportraitfull/heroportraitfull_%d" % ACTOR,
                  [(str(ICEY), str(ACTOR))], "UI/Texture/HeroPortraitFull/HeroPortraitFull_%d" % ACTOR,
                  rrb_portrait.FULL_METRICS, rrb_portrait.FULL_SIZE),
    "lmb":       ("ui/texture/heroportraitlmb/heroportraitfull_%d" % ICEY, "ui/texture/heroportraitlmb/heroportraitfull_%d" % ACTOR,
                  [(str(ICEY), str(ACTOR))], "UI/Texture/HeroPortraitLMB/HeroPortraitFull_%d" % ACTOR, (1080, 1049), (1024, 1024)),
    "mb":        ("ui/texture/heroportraitfullmb/heroportraitfull_%d" % ICEY, "ui/texture/heroportraitfullmb/heroportraitfull_%d" % ACTOR,
                  [(str(ICEY), str(ACTOR))], "UI/Texture/HeroPortraitFullMB/HeroPortraitFull_%d" % ACTOR, (1881, 2067), (2048, 2048)),
    "coatarms":  ("ui/texture/heroportraitcoatarms/heroportraitfull_%d" % ICEY, "ui/texture/heroportraitcoatarms/heroportraitfull_%d" % ACTOR,
                  [(str(ICEY), str(ACTOR))], "UI/Texture/HeroPortraitCoatArms/HeroPortraitFull_%d" % ACTOR, (1000, 1000), (1024, 1024)),
    "inherit":   ("dynamiceffectres/textures/inherit_%d_4c" % ICEY, "dynamiceffectres/textures/inherit_%d_4c" % ACTOR,
                  [(str(ICEY), str(ACTOR))], None, None, (1024, 1024)),
}
for i in (0, 1, 2):   # mobile hero-select strips: 0 locked, 1 normal, 2 selected
    T["select%d" % i] = ("ui/texture/heroheadselcetmb/heroheadselect_%d_%d" % (i, ICEY), "ui/texture/heroheadselcetmb/heroheadselect_%d_%d" % (i, ACTOR),
                         [(str(ICEY), str(ACTOR))], "UI/Texture/HeroHeadSelcetMB/HeroHeadSelect_%d_%d" % (i, ACTOR), (444, 148), (512, 128))
_CA = "ui/texture/heroportraitcoatarms/heroportraitfull_%d" % ICEY   # donor for textures at new paths
def _new(folder, name, size, metrics=True):
    return (_CA, "ui/texture/%s/%s" % (folder.lower(), name.lower()), [("HeroPortraitCoatArms", folder), ("HeroPortraitFull_%d" % ICEY, name)],
            "UI/Texture/%s/%s" % (folder, name), size if metrics else None, size)
T.update({
    "head":       _new("HeroHeadIcon", "HeroHeadIcon_%d" % ACTOR, (256, 256)),
    "evohead":    _new("HeroHeadIcon", "HeroEvoHead_%d" % ACTOR, (189, 184)),
    "evohead_off": _new("HeroHeadIcon", "HeroEvoHead_Off_%d" % ACTOR, (189, 184)),
    "smallhead":  _new("HeroHeadIcon", "HeroSmallHead_%d" % ACTOR, (128, 128)),
    "finalbattle": _new("HeroHeadIcon", "HeroFinalBattle_%d" % ACTOR, (258, 237)),
    "pvpfinish":  _new("HeroHeadIcon", "HeroPvPFinish_%d" % ACTOR, (827, 221)),
    "pda":        _new("HeroHeadIcon", "HeroPDA_%d" % ACTOR, (287, 477)),
    "skill":      _new("IconPotential", "IconSkill_%d" % ACTOR, (256, 256)),
    # the talent at the stock talent frame, 130 x 150, drawn at 2x (as Nine's)
    "talent":     (_CA, "ui/texture/iconpotential/potential_rubytalent", [("HeroPortraitCoatArms", "IconPotential"), ("HeroPortraitFull_%d" % ICEY, "Potential_RubyTalent")],
                   "UI/Texture/IconPotential/Potential_RubyTalent", (130, 150), (260, 300)),
})
tex = lambda k: "tex:" + T[k][3]
# sprite name -> texture (the SDK's LoadSprite alias; JS-side screens)
ALIASES = {
    "HeroHead_%d" % ACTOR: tex("evohead"), "HeroHead_%d_Off" % ACTOR: tex("evohead_off"),
    "HeroPortraitFull_%d_S" % ACTOR: tex("head"), "PVE_HeroPortraitFull_%d_H" % ACTOR: tex("smallhead"),
    "HeroPortraitFull_%d" % ACTOR: tex("finalbattle"), "PVP_HeroPortraitFull_%d" % ACTOR: tex("smallhead"),
    "PvPFinish_HeroPortraitFull_%d" % ACTOR: tex("pvpfinish"), "PDA_HeroPortraitFull_%d" % ACTOR: tex("pda"),
    "BaseActor_%d" % ACTOR: tex("smallhead"), "BaseActor_%d_S" % ACTOR: tex("smallhead"),
    "FesActor_%dk" % ACTOR: tex("smallhead"), "FesActor_%dk_S" % ACTOR: tex("smallhead"),
    "IconSkill_%d" % ACTOR: tex("skill"), "Talent_%d" % TALENT: tex("talent"),
}


LEGACY_IDS = (2007011, 2007012)   # her two Legacy skills (10 x ActorId + order)


def card_ids(potential_ids, unleashed):
    """Every Potential id that shows a card icon: the cards (rrb_pots.CARDS) and Potential Unleashed. Each gets a
    card texture, a metrics row, a sprite alias and a HUD atlas sprite; pass this list to potential_slots /
    metrics_rows / aliases (build_ruby.write_mod and build() both do)."""
    ids = list(potential_ids)
    return ids + [unleashed] if unleashed not in ids else ids


def potential_slots(potential_ids):
    """Potential and Legacy icon textures (256 px, the path the cards and move list load)."""
    out = {}
    for pid in list(potential_ids) + list(LEGACY_IDS):
        out["pot%d" % pid] = ("ui/texture/iconpotential/potential_5303", "ui/texture/iconpotential/potential_%d" % pid,
                              [("Potential_5303", "Potential_%d" % pid)], "UI/Texture/IconPotential/Potential_%d" % pid, (256, 256), (256, 256))
    return out


def metrics_rows(potential_ids):
    rows = []
    for key, (_, _, _, path, m, _) in list(T.items()) + list(potential_slots(potential_ids).items()):
        if path and m:
            rows.append({"list": "_entries", "key": "path", "value": {"path": path, "width": m[0], "height": m[1]}})
    return rows


def aliases(potential_ids):
    a = dict(ALIASES)
    for pid in potential_ids:
        a["Potential_%d" % pid] = "tex:UI/Texture/IconPotential/Potential_%d" % pid
    for lid in LEGACY_IDS:
        a["IconSkill_%d" % lid] = "tex:UI/Texture/IconPotential/Potential_%d" % lid
    return a


def hud_sprites(potential_ids, unleashed):
    """The battle HUD atlas's sprite names (C# loads Potential_<IconId> and the Skill button from real atlases)."""
    return (["Potential_%d" % p for p in potential_ids] + ["Potential_%d" % unleashed, "IconSkill_%d" % ACTOR, "IconSkill_%dOFF" % ACTOR]
            + ["IconSkill_%d" % lid for lid in LEGACY_IDS] + ["Talent_%d" % TALENT])


def portrait_rows(actor=ACTOR):
    """Her HeroPortraitOffsetConfigUI rows, all 12 screen keys (rrb_portrait): the table edit list for write_mod."""
    return rrb_portrait.offset_rows(actor)


# ---------------------------------------------------------------- icons: the Krita art (final; never code-drawn)
ICON_SIZES = {"potential": (256, 256), "legacy": (256, 256), "skill": (256, 256), "talent": (260, 300), "dust": (260, 236)}
HUD_SIZES = {"talent": (130, 150), "dust": (65, 59)}


def load_icons(icon_dir=ICON_DIR):
    """Every icon from art/icons/icons.json (the Krita exports shipped with the mod: our own art, no game or BBTAG pixels):
      {potential_id: PIL 256, legacy_id: PIL 256, "skill": PIL 256, "skill_off": PIL 256 (IconSkill_<actor>OFF),
       "talent": PIL 260x300 (texture), "talent_hud": PIL 130x150 (HUD atlas), "dust": {name: {"png", "hud", "tint"}}}
    Refuses a missing file or a wrong size (each kind has its stock slot size)."""
    from PIL import Image
    man = json.load(open(os.path.join(icon_dir, "icons.json"), encoding="utf-8"))
    def img(rel, size, what):
        p = os.path.join(icon_dir, rel)
        if not os.path.exists(p): raise SystemExit("Ruby icons: %s missing (%s)" % (p, what))
        im = Image.open(p).convert("RGBA")
        if im.size != tuple(size): raise SystemExit("Ruby icons: %s is %dx%d, expected %dx%d" % ((rel,) + im.size + tuple(size)))
        return im
    out = {"dust": {}}
    for e in man["icons"]:
        kind, size = e["kind"], ICON_SIZES.get(e["kind"])
        if size is None: raise SystemExit("Ruby icons: unknown kind %r (%s)" % (kind, e["name"]))
        if kind == "potential": out[int(e["potential_id"])] = img(e["png"], size, e["name"])
        elif kind == "legacy": out[int(e["legacy_id"])] = img(e["png"], size, e["name"])
        elif kind == "skill":
            out["skill"] = img(e["png"], size, e["name"])
            out["skill_off"] = img(e["off"]["png"], size, e["off"]["sprite"])
        elif kind == "talent":
            out["talent"] = img(e["png"], size, e["name"])
            out["talent_hud"] = img(e["hud_png"], HUD_SIZES["talent"], e["name"] + " hud")
        elif kind == "dust":
            out["dust"][e["dust"]] = {"png": img(e["png"], size, e["name"]), "hud": img(e["hud_png"], HUD_SIZES["dust"], e["name"] + " hud"),
                                      "tint": e["tint"]}
    for need in ("skill", "skill_off", "talent", "talent_hud") + LEGACY_IDS:
        if need not in out: raise SystemExit("Ruby icons: icons.json has no %r" % (need,))
    return out


def stock_icon(bundle):
    """A stock UI texture from the game install, read-only (e.g. Potential Unleashed's icon)."""
    sys.argv, a = ["x"], sys.argv
    import bbmod, UnityPy
    sys.argv = a
    env = UnityPy.load(bbmod.slice_bundle(bbmod.find_entry(bundle + ".ab")))
    return next(o.read().image.convert("RGBA") for o in env.objects if o.type.name == "Texture2D")


# ---------------------------------------------------------------- build time: compose from the player's BBTAG install
UI_ENTRIES = {   # what we need from her BBTAG UI art (entry leaf names, docs/cross-effect/research/UI_ART.md part B)
    "figure": "art_main_36rrb.hip", "bust": "vs_chara_rrb.hip", "crest": "cmn_bl_c_rrb.hip", "strip": "cmn15_ch_e_rrb.hip",
    "roster": "0037_char_rrb.hip", "rose": "0520_symbol_rrb.hip", "face": "rrb0face_normal.hip", "cutin": "cutin_L_RRB.hip",
    "tall": "cmn_ch_b_rrb.hip",
}


def ui_images():
    """{key: PIL image} decoded from the install; the scan is cached per install in local_only/cache.
    An alpha package carries these nine images by themselves (bbtag_alpha/ui/<entry name>, each as the game stores it):
    in the game most of them sit in archives with every other character's art, one of them 229 MB."""
    import bbtag_ui_dump as U, bbtag_rig as RG, bbtag_read as R
    if R.BUNDLED:
        out = {}
        for key, leaf in UI_ENTRIES.items():
            p = os.path.join(R.INSTALL, "ui", leaf)
            if not os.path.exists(p):
                raise SystemExit("Cross Effect: %s is missing from this package's bbtag_alpha/ui folder" % leaf)
            out[key] = U.hip(open(p, "rb").read())[0]
        return out
    cache = os.path.join(RG.CACHE, "ui_hits_rrb.json")
    if os.path.exists(cache):
        hits = json.load(open(cache))
    else:
        hits = U.scan("rrb"); os.makedirs(RG.CACHE, exist_ok=True); json.dump(hits, open(cache, "w"))
    out = {}
    for key, leaf in UI_ENTRIES.items():
        h = next((x for x in hits if x[1].rsplit("/", 1)[-1] == leaf), None)
        if h is None:
            raise SystemExit("Cross Effect: %s not found in the BBTAG install" % leaf)
        name, p, o, s = h
        out[key] = U.hip(U.rd(name, o, s))[0]
    return out


def _slot(src, tex_size, box, metrics, by_height, cx_frac=0.5):
    """Compose at the UI's metrics size (how the screen shows it), then squeeze into the texture (NOTES 2026-09-28)."""
    from PIL import Image
    import portraits
    kx, ky = metrics[0] / tex_size[0], metrics[1] / tex_size[1]
    mb = (box[0] * kx, box[1] * ky, box[2] * kx, box[3] * ky)
    canvas = Image.new("RGBA", metrics, (0, 0, 0, 0))
    if by_height:
        h = int(mb[3] - mb[1]); w = round(src.width * h / src.height)
        im = src.resize((w, h), Image.LANCZOS); cx = (mb[0] + mb[2]) / 2
        canvas.paste(im, (int(cx - w * cx_frac), int(mb[3] - h)), im)
    else:
        canvas = portraits.fit(src, metrics, tuple(int(v) for v in mb))
    return canvas.resize(tex_size, Image.LANCZOS)


def compose(img, icons):
    """Every texture image. icons: load_icons() ({"skill", "talent", pid / legacy id: PIL, ...})."""
    from PIL import Image, ImageDraw, ImageOps, ImageEnhance
    import portraits
    op = portraits._opaque
    bust, face = img["bust"], op(img["face"])
    out = {
        # 2026-09-29 (the lead: as tall as Hibiki): the whole figure 1:1 (was squeezed into ICEY's box at 88 % of the
        # height, the scythe blade cut at the right edge, and shown at 58 % of Hibiki's height with Ragna's rows)
        "full": rrb_portrait.compose_full(img["figure"]),
        "mb": rrb_portrait.compose_mb(img["figure"]),   # the whole figure fills the height (body 88 % of Hibiki's MB; was 73 %)
        "lmb": _slot(op(bust), (1024, 1024), (0, 150, 947, 1024), (1080, 1049), False),
    }
    crest = op(img["crest"])
    out["coatarms"] = _slot(crest, (1024, 1024), (25, 54, 998, 969), (1000, 1000), False)
    blue = Image.new("RGBA", crest.size, (150, 200, 255, 255)); blue.putalpha(crest.getchannel("A"))
    out["inherit"] = portraits.fit(Image.blend(crest, blue, 0.35), (1024, 1024), (40, 40, 984, 984))
    strip = img["strip"].resize((512, 128), Image.LANCZOS)
    grey = ImageOps.grayscale(strip.convert("RGB")).convert("RGBA"); grey.putalpha(strip.getchannel("A"))
    out["select0"] = ImageEnhance.Brightness(grey).enhance(0.6)
    out["select1"] = strip
    out["select2"] = ImageEnhance.Brightness(strip).enhance(1.15)
    sq = face.resize((256, 256), Image.LANCZOS)
    out["head"] = sq
    W, H = 189, 184
    f2 = face.resize((W, W), Image.LANCZOS).crop((0, (W - H) // 2, W, (W - H) // 2 + H))
    mask = Image.new("L", (W, H), 0); ImageDraw.Draw(mask).polygon([(W / 2, 0), (W - 1, H / 2), (W / 2, H - 1), (0, H / 2)], fill=255)
    evo = Image.new("RGBA", (W, H), (0, 0, 0, 0)); evo.paste(f2, (0, 0), Image.composite(f2.getchannel("A"), mask, mask))
    out["evohead"] = evo
    g = ImageOps.grayscale(evo.convert("RGB")).convert("RGBA"); g.putalpha(evo.getchannel("A")); out["evohead_off"] = g
    out["smallhead"] = img["roster"].resize((128, 128), Image.LANCZOS)
    out["finalbattle"] = portraits.fit(face, (258, 237), (0, 0, 258, 237))
    cut = img["cutin"]; ch = int(cut.width * 221 / 827)
    out["pvpfinish"] = cut.crop((0, (cut.height - ch) // 2, cut.width, (cut.height - ch) // 2 + ch)).resize((827, 221), Image.LANCZOS)
    tall = op(img["tall"]); tw = int(tall.height * 287 / 477)
    out["pda"] = tall.crop((max(0, (tall.width - tw) // 2), 0, max(0, (tall.width - tw) // 2) + tw, tall.height)).resize((287, 477), Image.LANCZOS)
    out["talent"] = icons["talent"]   # 260 x 300, shown 130 x 150; white like the stock talents (tinted by quality)
    out["skill"] = icons["skill"]
    for pid, im in icons.items():
        if isinstance(pid, int):
            out["pot%d" % pid] = im
    return out


def unleashed_image(icons, unleashed, unleashed_icon=None):
    """Potential Unleashed's icon: the stock hexagon read from the install (USE_STOCK_UNLEASHED) or her own Krita one."""
    if USE_STOCK_UNLEASHED and unleashed_icon is not None:
        return unleashed_icon
    if unleashed in icons:
        return icons[unleashed]
    raise SystemExit("Ruby icons: no Potential Unleashed icon (USE_STOCK_UNLEASHED=%s, icons.json p%d)" % (USE_STOCK_UNLEASHED, unleashed))


def hud_atlas_sprites(icons, potential_ids, unleashed, unleashed_icon=None):
    """[(sprite name, PIL)] for her battle HUD atlas, in hud_sprites() order: one 120 x 120 cell each."""
    un = unleashed_image(icons, unleashed, unleashed_icon)
    missing = [p for p in potential_ids if p not in icons]
    if missing: raise SystemExit("Ruby icons: icons.json has no icon for Potential %s" % missing)
    sprites = [("Potential_%d" % p, icons[p]) for p in potential_ids] + [("Potential_%d" % unleashed, un),
                                                                          ("IconSkill_%d" % ACTOR, icons["skill"]), ("IconSkill_%dOFF" % ACTOR, icons["skill_off"])]
    sprites += [("IconSkill_%d" % lid, icons[lid]) for lid in LEGACY_IDS]
    # the talent for the battle HUD's talent list (stock frame 130 x 150; the SDK preloads it from this atlas when
    # build_ruby registers BB_HUD_SPRITES["Talent_5098"] = "IconPotential200701", as Nine does)
    sprites.append(("Talent_%d" % TALENT, icons["talent_hud"]))
    assert [n for n, _ in sprites] == hud_sprites(potential_ids, unleashed)
    return sprites


def clone_hud_atlas(sprites, out_dir, log=print):
    """Her battle HUD atlas: IconPotential200701, in the container of the base game's IconSkillMB (HUD_ATLAS_SRC).
    The donor page is redrawn blank; each of our sprites takes one donor cell, in reading order (top row first), with
    the icon copied straight (no mask: pasting an icon with itself as the mask squared its alpha, 2026-09-29); every
    donor Sprite object we don't use is REMOVED from the bundle with its container and preload entries, so the built
    atlas holds exactly our sprites and no donor name survives on a blank cell.
    Not the shared bbtag_rig.clone_atlas: that one maps sprites to objects, not to cells (two objects on one rect
    shared a cell in Cells' atlas, the donor until 0.6.11), masks the paste and keeps unused donor sprites.
    Refuses a donor whose cells are not all HUD_CELL full-rect quads, or with fewer cells than sprites.
    Returns manifest additions."""
    import re
    from PIL import Image
    import bbtag_rig as RG
    bbmod, UnityPy = RG._unity()
    env = RG._env(bbmod, UnityPy, HUD_ATLAS_SRC); sf, _ = RG._retarget(env, HUD_ATLAS, None)
    donor, ours_name = HUD_ATLAS_SRC.rsplit("/", 1)[-1], "IconPotential%d" % ACTOR
    ren = lambda v: re.sub(re.escape(donor), ours_name, v, flags=re.I)
    if len({n for n, _ in sprites}) != len(sprites):
        raise SystemExit("Ruby HUD atlas: duplicate sprite names requested")
    sprs = [o for o in sf.objects.values() if o.type.name == "Sprite"]
    cells, seen = [], set()
    for o in sprs:   # the donor must be a plain grid of full cells (what every stock IconPotential<actor> atlas is)
        t = o.read_typetree(); r, rd = t["m_Rect"], t["m_RD"]
        k = (round(r["x"]), round(r["y"]), round(r["width"]), round(r["height"]))
        tr = rd["textureRect"]
        if k[2:] != HUD_CELL or (round(tr["x"]), round(tr["y"]), round(tr["width"]), round(tr["height"])) != k \
                or rd["settingsRaw"] & 0x7f or rd["m_VertexData"]["m_VertexCount"] != 4:
            raise SystemExit("atlas %s: sprite %s is not a full %dx%d cell (rect %s, settings %d, %d vertices)"
                             % (HUD_ATLAS_SRC, t["m_Name"], HUD_CELL[0], HUD_CELL[1], k, rd["settingsRaw"], rd["m_VertexData"]["m_VertexCount"]))
        if k not in seen: seen.add(k); cells.append((k, o.path_id))
    cells.sort(key=lambda c: (-c[0][1], c[0][0], c[1]))
    if len(sprites) > len(cells):
        raise SystemExit("atlas %s has %d cells, %d sprites requested" % (HUD_ATLAS_SRC, len(cells), len(sprites)))
    tex = next(o for o in sf.objects.values() if o.type.name == "Texture2D").read()
    page = Image.new("RGBA", (tex.m_Width, tex.m_Height), (0, 0, 0, 0)); names = {}
    for ((x, y, w, hh), pid), (nm, im) in zip(cells, sprites):
        page.paste(im.convert("RGBA").resize((w, hh), Image.LANCZOS), (x, tex.m_Height - y - hh))   # straight copy, no mask
        names[pid] = nm
    drop = {o.path_id for o in sprs if o.path_id not in names}
    for o in list(sf.objects.values()):
        if o.type.name == "Texture2D":
            d = o.read(); d.m_Name = ren(d.m_Name); d.set_image(page, target_format=d.m_TextureFormat); d.save()
        elif o.type.name == "Sprite" and o.path_id in names:
            d = o.read(); d.m_Name = names[o.path_id]; d.save()
        elif o.type.name == "AssetBundle":
            t = o.read_typetree(); t["m_Name"] = HUD_ATLAS + ".ab"
            if t.get("m_AssetBundleName"): t["m_AssetBundleName"] = HUD_ATLAS + ".ab"
            n0 = len(t["m_PreloadTable"])
            if any((v["preloadIndex"], v["preloadSize"]) != (0, n0) for _, v in t["m_Container"]):
                raise SystemExit("atlas %s: its container entries don't share one preload range; removing sprites is not safe" % HUD_ATLAS_SRC)
            t["m_PreloadTable"] = [p for p in t["m_PreloadTable"] if not (p["m_FileID"] == 0 and p["m_PathID"] in drop)]
            keep = []
            for k, v in t["m_Container"]:
                if v["asset"]["m_FileID"] == 0 and v["asset"]["m_PathID"] in drop: continue
                v = dict(v, preloadIndex=0, preloadSize=len(t["m_PreloadTable"])); keep.append([ren(k), v])
            t["m_Container"] = keep
            o.save_typetree(t)
    for pid in drop:
        del sf.objects[pid]
    RG._save(env, out_dir, HUD_ATLAS)
    log("  atlas %s (%d sprites; donor %s: %d cells, %d unused sprite objects removed)" % (HUD_ATLAS, len(sprites), donor, len(cells), len(drop)))
    return {"names": [HUD_ATLAS], "entries": [(HUD_ATLAS, RG._deps(HUD_ATLAS_SRC))], "guids": []}


def build(out_dir, icons, potential_ids, unleashed, unleashed_icon=None):
    """Write every UI bundle into out_dir; returns manifest additions. icons = load_icons(); potential_ids = the cards
    (rrb_pots.CARDS); unleashed_icon = the stock Potential_5000 (stock_icon(...)), used while USE_STOCK_UNLEASHED is
    True. Every card AND Potential Unleashed get a card texture (card_ids) and a HUD atlas sprite."""
    from PIL import Image
    import bbtag_rig as RG
    img = ui_images()
    images = compose(img, icons)
    ids = card_ids(potential_ids, unleashed)
    slots = dict(T); slots.update(potential_slots(ids))
    un = unleashed_image(icons, unleashed, unleashed_icon).convert("RGBA")   # the card texture shows what the HUD shows
    size = slots["pot%d" % unleashed][5]
    images["pot%d" % unleashed] = un if un.size == size else un.resize(size, Image.LANCZOS)
    missing = [k for k in slots if k not in images]
    if missing: raise SystemExit("Ruby UI: no image for %s (art/icons/icons.json)" % missing)
    adds = {"names": [], "entries": [], "guids": []}
    for key, (src, dst, ren, _, _, size) in slots.items():
        if images[key].size != size:
            raise SystemExit("Ruby UI: %s is %dx%d, its slot %dx%d (compose the slot at its size; no stretching here)" % ((key,) + images[key].size + size))
        a = RG.clone_texture(src, dst, ren, images[key], out_dir)
        for k in adds: adds[k] += a[k]
    sprites = hud_atlas_sprites(icons, potential_ids, unleashed, unleashed_icon)
    a = clone_hud_atlas(sprites, out_dir)
    for k in adds: adds[k] += a[k]
    return adds
