"""rrb_text.py -- Ruby Rose V2: every player-facing text, in the game's 10 languages (plain data, no file reads).

Sources:
- English: docs/cross-effect/KIT_V2.md (approved 2026-09-28): §3 moves, §4 Gun Blast, §5 Dust, §9 Potentials and talent,
  §10 hidden effects. Approved English words are kept; only presentation was added (the stock highlight colour on
  referenced move names and on the Universal Enhancement names, glyph tokens, the stock " · " sequence separator).
- Stock texts copied word for word from the game's own localization (research/loc.py; key -> text in each language).
  STOCK below lists every copied entry and its source key. Every one of them is a base-game string.
- 2026-10-02: texts corrected against the built data (the integration audit's T2-T17 and smaller points). Where a text
  here differs from KIT_V2 §3 / §5 / §9, this file is the newer one.
- Game terms (statuses, resources, input labels, [Ground] / [Airborne], Hold, Summoning Tactic, Legacy, Elite, boss...)
  are the game's own words in each language, looked up in that language's table.

Conventions (match build_ruby.py):
- HI / c(): the stock highlight colour; glyphs <action=Attack|Skill|Summon|Dynamic|Dash|Jump|MoveX+|MoveX-|MoveY+|MoveY->.
- Input labels follow the stock layout per language ([Ground] / 【地面】 / 【地上】..., "Hold" before or after the glyph).
- Templates: [[key]] = NAMES[key] in that language, [[c:key]] = the same, highlighted, [[dmg]] = the Legacy damage
  placeholder. They're filled once at import (_fill); the exported dicts hold final strings only.

Translation status:
- Entries in STOCK are official game text.
- Every other text is a Redux translation written for this kit. Move and proper names that have no official source
  are marked "unverified translation" in NAMES (BBTAG's own localized move names aren't in the workspace; RWBY terms
  follow the common dub / fandom renderings: 尘晶 / ダスト / 더스트 / Прах, 外显 / Semblanza / Проявление...).
- "Staggered" has no stock status in BBEE. It is rendered with the word each language's stock text uses for "stun"
  (僵直 / 硬直 / 경직 / betäubt / aturdido / étourdi / atordoado / оглушенный: base-game wording, e.g. Kokonoe's
  ActorActionDesc_250341, Hibiki's _290491, Platinum's _180651).
- Nothing is taken from a paid-DLC character's strings (Rachel, Hazama, Bullet, Naoto): checked 2026-10-02 against every
  stock key of theirs in all 10 languages. Card 20723 used to carry Naoto's "Enhancer" (the name, and the first clause of
  its text, word for word); it is now "Recoil Rush" with a text of its own. What still equals a DLC-only string is input
  notation made of glyphs and the base-game [Airborne] label (Bullet's ActorActionInput_220903, Naoto's _310981).

Ids: ActorActionConf Type 1 move rows keep build_ruby.ROOTS ids; new moves use the same 1306xx-1307xx range, a
sub-row taking its parent's id + 1..9 (the stock pattern, e.g. Ragna 10051 -> 10061). New ones are marked "NEW id".
"""

import re

LANGS = ("enu", "chs", "cht", "deu", "esp", "fac", "jpn", "kor", "ptb", "rus")   # = build_ruby.LANGS (NAME_LOC order)
HI = "<color=#3AFDFFFF>"
def c(t): return HI + t + "</color>"
DMG = '{"v":"damage","Color":9}'        # Legacy damage placeholder (stock format)


def L(*v):
    """One text in LANGS order."""
    assert len(v) == len(LANGS), v[0]
    return dict(zip(LANGS, v))


def _per(x):
    return x if isinstance(x, dict) else {l: x for l in LANGS}


# ---------------------------------------------------------------- input labels (stock layout per language)
_GROUND = L("[Ground] ", "【地面】", "【地面】", "[Boden] ", "[En el suelo] ", "[Au sol] ", "【地上】", "【지상】", "[Terrestre] ", "[На земле] ")
_AIR = L("[Airborne] ", "【空中】", "【空中】", "[Luft] ", "[En el aire] ", "[Dans les airs] ", "【空中】", "【공중】", "[Aéreo] ", "[Воздух] ")
_HOLD = L("Hold {}", "长按{}", "長按{}", "Halte {}", "Mantén pulsado {}", "Maintenir {}", "{}を長押し", "{} 길게 누르기", "Segure {}", "Удерживай {}")
_SEP = L(" · ", " · ", " · ", " · ", " · ", " · ", "・", "・", " · ", " · ")
def G(x): x = _per(x); return {l: _GROUND[l] + x[l] for l in LANGS}
def A(x): x = _per(x); return {l: _AIR[l] + x[l] for l in LANGS}
def H(x): x = _per(x); return {l: _HOLD[l].format(x[l]) for l in LANGS}
def S(*parts):
    ps = [_per(p) for p in parts]
    return {l: _SEP[l].join(p[l] for p in ps) for l in LANGS}
SUMMON = "<action=Summon><action=Dynamic>"


# ---------------------------------------------------------------- names
NAMES = {
    # stock (official): ActorActionName_10011 / _10021 / _11211 / _108, ActorActionAffectedObject_10281
    "attack": L("Attack", "普攻", "普攻", "Angreifen", "Atacar", "Attaque", "攻撃", "공격", "Ataque", "Атака"),
    "airborne_attack": L("Airborne Attack", "空中普攻", "空中普攻", "Luftangriff", "Ataque aéreo", "Attaque aérienne", "空中攻撃", "공중 공격", "Ataque Aéreo", "Атака в воздухе"),
    "jump": L("Jump", "跳跃", "跳躍", "Springen", "Salto", "Saut", "ジャンプ", "점프", "Saltar", "Прыжок"),
    "universal": L("Universal Enhancement", "泛用强化", "泛用强化", "Universelle Verbesserung", "Mejora Universal", "Amélioration universelle", "汎用強化", "범용 강화", "Aprimoramento Universal", "Универсальное усиление"),
    "unleashed": L("Potential Unleashed", "潜能增幅", "潛能增幅", "Potenzial entfesselt", "Capacidad habilitada", "Potentiel déclenché", "ポテンシャル増幅", "포텐셜 증폭", "Potencial Liberado", "Потенциал раскрыт"),
    # stock term inside ActorActionDesc_110311 ("Universal Airborne Attacks"), in the case each sentence uses
    "universal_air": L("Universal Airborne Attacks", "泛空中普攻类招式", "泛空中普攻類招式", "Universellen Luftangriffe", "ataques aéreos universales", "attaques aériennes universelles", "通常の空中攻撃技", "통상 공중 공격 기술", "Ataques Aéreos Universais", "Универсальных атак в воздухе"),

    # Redux names: unverified translation (no official localized source for these in the workspace)
    "scythe_chain": L("Scythe Chain", "镰刃连锁", "鐮刃連鎖", "Sensenkette", "Cadena de Guadaña", "Chaîne de faux", "サイスチェイン", "사이드 체인", "Corrente da Foice", "Цепь косы"),              # unverified translation
    "rising_reap": L("Rising Reap", "升腾收割", "升騰收割", "Aufsteigende Ernte", "Siega Ascendente", "Moisson ascendante", "ライジングリープ", "라이징 리프", "Colheita Ascendente", "Восходящая жатва"),   # unverified translation
    "low_sweep": L("Low Sweep", "下段横扫", "下段橫掃", "Tiefer Feger", "Barrido Bajo", "Balayage bas", "ロースイープ", "로우 스윕", "Varredura Baixa", "Нижняя подсечка"),                      # unverified translation
    "rising_crescent": L("Rising Crescent", "升月斩", "升月斬", "Aufsteigender Halbmond", "Creciente Ascendente", "Croissant ascendant", "ライジングクレセント", "라이징 크레센트", "Crescente Ascendente", "Восходящий полумесяц"),  # unverified translation
    "clash_assault": L("Clash Assault", "冲撞突袭", "衝撞突襲", "Prallangriff", "Asalto Choque", "Assaut percutant", "クラッシュアサルト", "클래시 어설트", "Assalto Impactante", "Сокрушительный штурм"),  # unverified translation (jpn = BBTAG's system name)
    "clash_chase": L("Clash Assault [Chase]", "冲撞突袭【追击】", "衝撞突襲【追擊】", "Prallangriff [Verfolgung]", "Asalto Choque [Persecución]", "Assaut percutant [poursuite]", "クラッシュアサルト【追撃】", "클래시 어설트 【추격】", "Assalto Impactante [Perseguição]", "Сокрушительный штурм [Преследование]"),  # unverified translation
    "corkscrew": L("Corkscrew Slice", "螺旋斩", "螺旋斬", "Korkenzieherschnitt", "Tajo Sacacorchos", "Taillade en vrille", "コークスクリュースライス", "코르크스크류 슬라이스", "Corte Saca-Rolhas", "Штопорный разрез"),  # unverified translation
    "double_kick": L("Double Kick", "双重踢", "雙重踢", "Doppeltritt", "Doble Patada", "Double coup de pied", "ダブルキック", "더블 킥", "Chute Duplo", "Двойной удар ногой"),  # unverified translation
    "recoil_shot": L("Recoil Shot", "后坐射击", "後座射擊", "Rückschlagschuss", "Disparo de Retroceso", "Tir de recul", "リコイルショット", "리코일 샷", "Tiro de Recuo", "Выстрел с отдачей"),  # 0.9.0, unverified translation
    "rifle_shot": L("Rifle Shot", "步枪射击", "步槍射擊", "Gewehrschuss", "Disparo de Rifle", "Tir de fusil", "ライフルショット", "라이플 샷", "Tiro de Rifle", "Винтовочный выстрел"),  # unverified translation
    "sypod": L("Sy-Pod Shot", "镰架射击", "鐮架射擊", "Sy-Pod-Schuss", "Disparo Sy-Pod", "Tir Sy-Pod", "サイポッドショット", "사이포드 샷", "Tiro Sy-Pod", "Выстрел с упора"),  # unverified translation
    "guillotine": L("Guillotine", "断头台", "斷頭台", "Guillotine", "Guillotina", "Guillotine", "ギロチン", "길로틴", "Guilhotina", "Гильотина"),  # unverified translation
    "reapers_hook": L("Reaper's Hook", "死神之钩", "死神之鉤", "Schnitterhaken", "Gancho de la Parca", "Crochet de la Faucheuse", "リーパーズフック", "리퍼스 훅", "Gancho do Ceifador", "Крюк жнеца"),  # unverified translation
    "buzzsaw": L("Buzzsaw Blast", "圆锯冲击", "圓鋸衝擊", "Kreissägenschlag", "Sierra Explosiva", "Scie explosive", "バズソーブラスト", "버즈소 블래스트", "Serra Explosiva", "Удар циркулярной пилы"),  # unverified translation
    "buzzsaw_ex": L("Buzzsaw Blast EX", "圆锯冲击 EX", "圓鋸衝擊 EX", "Kreissägenschlag EX", "Sierra Explosiva EX", "Scie explosive EX", "バズソーブラストEX", "버즈소 블래스트 EX", "Serra Explosiva EX", "Удар циркулярной пилы EX"),  # unverified translation
    "gun_blast": L("Gun Blast", "枪爆冲刺", "槍爆衝刺", "Rückstoßschuss", "Disparo Propulsor", "Tir propulseur", "ガンブラスト", "건 블래스트", "Disparo Propulsor", "Выстрел-рывок"),  # unverified translation
    "dust": L("Dust", "尘晶", "塵晶", "Staub", "Polvo", "Poussière", "ダスト", "더스트", "Pó", "Прах"),  # unverified translation (RWBY dub / fandom terms)
    "fire_dust": L("Fire Dust", "火焰尘晶", "火焰塵晶", "Feuerstaub", "Polvo de Fuego", "Poussière de feu", "炎のダスト", "화염 더스트", "Pó de Fogo", "Огненный прах"),  # unverified translation
    "ice_dust": L("Ice Dust", "寒冰尘晶", "寒冰塵晶", "Eisstaub", "Polvo de Hielo", "Poussière de glace", "氷のダスト", "빙결 더스트", "Pó de Gelo", "Ледяной прах"),  # unverified translation
    "lightning_dust": L("Lightning Dust", "雷电尘晶", "雷電塵晶", "Blitzstaub", "Polvo de Relámpago", "Poussière de foudre", "雷のダスト", "라이트닝 더스트", "Pó de Raio", "Грозовой прах"),  # unverified translation
    "gravity_dust": L("Gravity Dust", "重力尘晶", "重力塵晶", "Gravitationsstaub", "Polvo Gravitatorio", "Poussière gravitationnelle", "重力のダスト", "중력 더스트", "Pó Gravitacional", "Гравитационный прах"),  # unverified translation
    "dust_round": L("Dust Round", "尘晶弹", "塵晶彈", "Staubpatrone", "Bala de Polvo", "Balle de poussière", "ダスト弾", "더스트 탄", "Bala de Pó", "Патрон праха"),  # unverified translation
    "petal_burst": L("Petal Burst", "花瓣爆发", "花瓣爆發", "Blütenstoß", "Estallido de Pétalos", "Rafale de pétales", "ペタルバースト", "페탈 버스트", "Explosão de Pétalas", "Взрыв лепестков"),  # unverified translation
    "red_reaper": L("Red Reaper", "赤红死神", "赤紅死神", "Roter Schnitter", "Parca Roja", "Faucheuse rouge", "レッドリーパー", "레드 리퍼", "Ceifadora Vermelha", "Красный жнец"),  # unverified translation
    "petal_dance": L("Petal Dance", "花瓣之舞", "花瓣之舞", "Blütentanz", "Danza de Pétalos", "Danse des pétales", "ペタルダンス", "페탈 댄스", "Dança das Pétalas", "Танец лепестков"),  # unverified translation
    "crescent_mastery": L("Crescent Mastery", "新月精通", "新月精通", "Halbmond-Meisterschaft", "Maestría Creciente", "Maîtrise du croissant", "クレセントマスタリー", "크레센트 마스터리", "Maestria Crescente", "Мастерство полумесяца"),  # unverified translation
    "high_caliber": L("High Caliber", "大口径", "大口徑", "Großkaliber", "Alto Calibre", "Gros calibre", "ハイキャリバー", "하이 캘리버", "Alto Calibre", "Крупный калибр"),  # unverified translation
    "semblance": L("Semblance", "外显", "外顯", "Semblance", "Semblanza", "Semblance", "センブランス", "셈블런스", "Semblante", "Проявление"),  # unverified translation (RWBY term)
    "silver_eyes": L("Silver Eyes", "银眼", "銀眼", "Silberaugen", "Ojos Plateados", "Yeux d'argent", "銀の眼", "은빛 눈", "Olhos Prateados", "Серебряные глаза"),  # unverified translation (RWBY term)
    "huntress_focus": L("Huntress Focus", "女猎人的专注", "女獵人的專注", "Jägerinnen-Fokus", "Concentración de Cazadora", "Concentration de chasseresse", "ハントレスフォーカス", "헌트리스 포커스", "Foco da Caçadora", "Сосредоточенность охотницы"),  # unverified translation
    "rose_lunge": L("Rose Lunge", "玫瑰突进", "玫瑰突進", "Rosenvorstoß", "Embestida de Rosa", "Fente de la rose", "ローズランジ", "로즈 런지", "Investida da Rosa", "Выпад розы"),  # unverified translation
    # card 20723. It was Naoto's stock "Enhancer" (paid DLC; not a base-game term in any language), renamed 2026-10-02
    "recoil_rush": L("Recoil Rush", "后坐强袭", "後座強襲", "Rückstoßansturm", "Impulso de Retroceso", "Élan de recul", "リコイルラッシュ", "리코일 러시", "Impulso do Recuo", "Натиск отдачи"),  # unverified translation
    # card 20744 (0.9.0, build 11): our own name
    "gunswing": L("Gunswing", "挥斩射击", "揮斬射擊", "Schwungschuss", "Tajo y Disparo", "Tir de fauchage", "ガンスイング", "건 스윙", "Golpe e Disparo", "Выстрел на взмахе"),  # unverified translation
}
UNVERIFIED_NAMES = tuple(k for k in NAMES if k not in ("attack", "airborne_attack", "jump", "universal", "unleashed", "universal_air"))


# ---------------------------------------------------------------- stock texts copied word for word
# (source key in the game's localization -> the same text in every language)
STOCK_TRIPLE_JUMP = L(   # ActorActionDesc_10231 (Ragna; identical in the 14 stock triple-jump cards)
    "You can jump thrice: When you get knocked away, you can press <action=Jump> to recover your stance. Recover to controllable state and become invincible for 1 second.",
    "可使用三段跳；被击飞时可按<action=Jump>受身：恢复到可控制状态并无敌1秒。",
    "可使用三段跳；被擊飛時可按<action=Jump>受身：恢復到可控制狀態並無敵1秒。",
    "Du kannst dreimal springen. Wirst du weggestoßen, kannst du <action=Jump> drücken, um deine Haltung wieder einzunehmen. Du kannst deinen Charakter dann wieder kontrollieren und wirst eine Sekunde lang unverwundbar.",
    "Puedes saltar tres veces. Cuando te derriben, puedes pulsar <action=Jump> para volver a tu posición. Recuperas el control y te vuelves invencible durante 1 segundo.",
    "Tu peux sauter 3\u00a0fois. Quand tu te fais repousser, appuie sur <action=Jump> pour reprendre l'équilibre. Tu peux alors contrôler à nouveau ton personnage et tu deviens invincible pendant 1\u00a0s.",
    "3段ジャンプを使用できる：飛ばされた際、<action=Jump>を押すと受け身が可能で、受け身後、1秒間無敵時間が付与される。",
    "3단 점프 사용 가능: 피격당해 날아가고 있을 때, <action=Jump>을 누르면 낙법을 시전한다. 낙법 후에는 1초 동안 무적 시간이 부여된다.",
    "Habilita o salto triplo; após ser derrubado, pressione <action=Jump> para recuperar sua postura. Recupere o controle e torne-se invencível por 1 segundo.",
    "Ты можешь совершить три прыжка. Когда тебя сбивают с ног, ты можешь нажать <action=Jump>, чтобы вернуться в стойку: восстанови контроль и получи неуязвимость на 1 секунду.")
STOCK_JUMP_RESET = L(    # ActorActionDesc_110311 (Hakumen) = ActorActionDesc_30432 (Noel): the Jump-only air-limit reset.
    # Ragna's 10241 also names Dash; Ruby's Dash is Gun Blast, whose reset is hidden effect 29, so the Jump-only card fits.
    "While airborne, " + c("Jumping") + " will reset the attack limit for your " + c("Universal Airborne Attacks") + ".",
    "在空中可用" + c("跳跃") + "重置" + c("泛空中普攻类招式") + "的段数限制计数。",
    "在空中可用" + c("跳躍") + "重置" + c("泛空中普攻類招式") + "的段數次數限制。",
    "Du kannst in der Luft " + c("springen") + ", um das Angriffslimit für deine " + c("Universellen Luftangriffe") + " zurückzusetzen.",
    "En el aire, se puede " + c("saltar") + " para reiniciar el límite de " + c("ataques aéreos universales") + ".",
    "Dans les airs, " + c("saute") + " pour réinitialiser le nombre d'" + c("attaques aériennes universelles") + " que tu peux lancer.",
    "空中の" + c("ジャンプ") + "で" + c("通常の空中攻撃技") + "の段数をリセットできる。",
    "공중에서 " + c("점프") + "하면 " + c("통상 공중 공격 기술") + "의 콤보 카운트를 초기화할 수 있다.",
    "Enquanto estiver no ar, " + c("Saltar") + " redefinirá o limite de ataque de seus " + c("Ataques Aéreos Universais") + ".",
    c("Прыжок") + ", совершенный в воздухе, обнуляет лимит атак для твоих " + c("Универсальных атак в воздухе") + ".")
STOCK_UNLEASHED_DESC = L(  # ActorActionDesc_108 (identical for all 17 stock characters' Potential Unleashed)
    "Attacks and Skill damage increased by 20%", "普攻和技能伤害提升20%", "普攻和技能傷害提升20%",
    "Angriffe und Fertigkeitsschaden um 20 Prozent erhöht", "El daño de ataques y habilidades aumenta un\u00a020\u00a0%.",
    "Les dégâts des attaques et des compétences augmentent de 20\u00a0%.", "通常攻撃とスキルのダメージが20％上昇する",
    "통상 공격과 스킬 대미지가 20% 증가한다.", "Ataques e dano de habilidades aumentados em 20%", "Сила атаки и урон от навыков увеличены на 20%")
STOCK_MIDAIR = L(        # ActorActionDesc_10821 (Ragna; 7 of 9 stock "Can be activated while mid-air." cards)
    "Can be activated while mid-air.", "可在空中使用。", "可在空中使用。", "Kann in der Luft aktiviert werden.",
    "Se puede activar en el aire.", "Activation possible dans les airs.", "空中でも発動できる。", "공중에서도 발동할 수 있다.",
    "Pode ser ativado no ar.", "Можно активировать в воздухе.")
STOCK_EXPANDS = L(       # ActorActionDesc_10811 (Ragna hidden effect 1007)
    "Expands the attack area.", "攻击范围扩大。", "攻擊範圍擴大。", "Erweitert den Angriffsbereich.", "Amplía el área de ataque.",
    "Augmente la taille de la zone d'attaque.", "攻撃範囲が拡大する。", "공격 범위가 확대된다.", "Expande a área de ataque.",
    "Расширяет площадь атаки.")
STOCK_EVEN_LARGER = L(   # ActorActionDesc_10181 (Ragna hidden effect 1011)
    "Attacks in an even larger range.", "攻击范围进一步扩大。", "攻擊範圍進一步擴大。", "Angriffe haben eine noch größere Reichweite.",
    "Aumenta aún más el alcance del ataque.", "Augmente encore la portée de l'attaque.", "攻撃範囲がさらに拡大する。",
    "공격 범위가 더욱 확대된다.", "Ataca em um alcance ainda maior.", "Атакует с еще большим радиусом действия.")
STOCK_JUMP_DESC = L(     # ActorActionDesc_10021 (the stock Jump move row)
    "Jump. Has access to double jump in initial state.", "跳跃。初始可使用二段跳跃。", "跳躍。初始可使用二段跳躍。",
    "Sprung. Kann von Anfang an Doppelsprung ausführen.", "Salto con posibilidad de ejecutar un doble salto desde su estado inicial.",
    "Fais un saut. Le double saut est disponible dès le départ.", "ジャンプ。初期状態で2段ジャンプが使用可能。",
    "점프. 초기 상태에는 2단 점프를 사용할 수 있다.", "Salto. Tem acesso ao salto duplo no estado inicial.",
    "Прыжок. Двойной прыжок доступен с самого начала.")
STOCK_UNIVERSAL_DESC = L(  # ActorActionDesc_11211 (the stock Universal Enhancement move row)
    "Universal Enhancement affects multiple moves.", "泛用强化会对多个招式产生影响。", "泛用強化會對多個招式產生影響。",
    "Universelle Verbesserungen wirken sich auf mehrere Moves aus.", "La Mejora Universal influye en varios movimientos.",
    "L'amélioration universelle s'applique à plusieurs actions.", "汎用強化は複数の技に影響する。", "범용 강화가 다수의 기술에 영향을 끼친다.",
    "Aprimoramento Universal afeta várias técnicas.", "Универсальное усиление применяется к нескольким приемам.")
STOCK_LEVEL_UP = L(      # InheritSkillDescUpgrade_1029011 (Hibiki; = _1034012, Es). English: the spelling of Ragna's
    # _1001012 ("with level"; _1029011 has "with the level"). The other nine languages of _1001012 speak of a
    # damage-boost effect, which these Legacy skills are not, so they stay _1029011's.
    "The damage increases with level.", "随等级提升伤害。", "隨等級提升傷害。", "Der Schaden steigt mit der Stufe an.",
    "El daño aumenta con el nivel.", "Les dégâts augmentent en fonction du niveau.", "レベルアップに伴い、ダメージが増加する。",
    "레벨 상승에 따라 대미지가 증가한다.", "O dano aumenta com o nível.", "Урон растет с уровнем.")

STOCK = {   # entry -> source key (every other text in this file is a Redux translation)
    "NAMES.attack": "ActorActionName_10011", "NAMES.airborne_attack": "ActorActionAffectedObject_10281",
    "NAMES.jump": "ActorActionName_10021", "NAMES.universal": "ActorActionName_11211", "NAMES.unleashed": "ActorActionName_108",
    "NAMES.universal_air": "ActorActionDesc_110311 (term)",
    "POTENTIAL_TEXT[20705].desc": "ActorActionDesc_10821", "POTENTIAL_TEXT[20718].desc": "ActorActionDesc_10231",
    "POTENTIAL_TEXT[20719].desc": "ActorActionDesc_110311", "POTENTIAL_TEXT[20799].desc": "ActorActionDesc_108",
    "HIDDEN_TEXT[1].text": "ActorActionDesc_10811", "HIDDEN_TEXT[2].text": "ActorActionDesc_10181", "HIDDEN_TEXT[3].text": "ActorActionDesc_10181",
    "MOVE_TEXT[rrb_jump]": "ActorActionName_10021 / ActorActionInput_10021 / ActorActionDesc_10021",
    "MOVE_TEXT[rrb_universal]": "ActorActionName_11211 / ActorActionDesc_11211",
    "LEGACY_TEXT[*].up": "InheritSkillDescUpgrade_1029011; English as _1001012 ('The damage increases with level.')",
    # "[Airborne] Hold ...": put together from the two base labels. (The one stock string with both is Bullet's
    # ActorActionInput_220911, paid DLC; nothing is copied from it.)
    "input labels": "[Ground] ActorActionInput_10011, [Airborne] _10061, Hold _11081",
}


# ---------------------------------------------------------------- 1. Potentials (KIT_V2 §9): 20701-20738 + Unleashed 20799
# name = the card name (the move's name, as approved); "input" only where the card adds a move; 20715 also has the SP line
# (stock shape: Ragna's Ultra card 5317 has the move row 11161 plus an "SP: ..." row 11162, Type 2, both in its RelationId).
# rrb_pots.content_v2 does not write the "sp" row yet; until it does the line is shown in ActorUltraDesc only (ACTOR_TEXT).
POTENTIAL_TEXT = {
    20701: {"name": "[[attack]]", "desc": L(
        "The third strike deals damage more times and drags airborne enemies to the ground.",
        "第3段攻击的伤害次数增加，并将空中的敌人拽至地面。",
        "第3段攻擊的傷害次數增加，並將空中的敵人拽至地面。",
        "Der dritte Schlag bewirkt öfter Schaden und zieht Gegner in der Luft zu Boden.",
        "El tercer golpe inflige daño más veces y arrastra al suelo a los enemigos que estén en el aire.",
        "Le troisième coup frappe plus de fois et plaque au sol les ennemis dans les airs.",
        "3段目のダメージ回数が増え、空中の敵を地面へ引きずり下ろす。",
        "3번째 공격의 공격 횟수가 늘어나며, 공중의 적을 지면으로 끌어내린다.",
        "O terceiro golpe causa dano mais vezes e arrasta inimigos no ar para o chão.",
        "Третий удар наносит урон большее число раз и сбивает врагов в воздухе на землю.")},
    20702: {"name": "[[scythe_chain]]",
            # "(pause)": KIT_V2's input; no stock input label has a pause, so its 9 renderings are an unverified translation
            "input": L("<action=Attack> · <action=Attack> (pause) <action=Attack>",
                       "<action=Attack> · <action=Attack>（停顿）<action=Attack>",
                       "<action=Attack> · <action=Attack>（停頓）<action=Attack>",
                       "<action=Attack> · <action=Attack> (Pause) <action=Attack>",
                       "<action=Attack> · <action=Attack> (pausa) <action=Attack>",
                       "<action=Attack> · <action=Attack> (pause) <action=Attack>",
                       "<action=Attack>・<action=Attack>（一拍置く）<action=Attack>",
                       "<action=Attack>・<action=Attack>(잠시 멈춤)<action=Attack>",
                       "<action=Attack> · <action=Attack> (pausa) <action=Attack>",
                       "<action=Attack> · <action=Attack> (пауза) <action=Attack>"),
            "desc": L(
        "Pause after the second strike to follow up with two wide scythe sweeps that also hit enemies behind.",
        "第2段攻击后稍作停顿，可衔接两记大范围镰刀横扫，同时攻击身后的敌人。",
        "第2段攻擊後稍作停頓，可銜接兩記大範圍鐮刀橫掃，同時攻擊身後的敵人。",
        "Lege nach dem zweiten Schlag eine kurze Pause ein, um zwei weite Sensenhiebe folgen zu lassen, die auch Gegner hinter dir treffen.",
        "Haz una pausa tras el segundo golpe para continuar con dos amplios barridos de guadaña que también alcanzan a los enemigos que tengas detrás.",
        "Marque une pause après le deuxième coup pour enchaîner avec deux larges balayages de faux qui touchent aussi les ennemis derrière toi.",
        "2段目の後に一拍置くと、背後の敵にもヒットする大振りの鎌の薙ぎ払いを2回繰り出す。",
        "2번째 공격 후 잠시 멈추면, 뒤에 있는 적까지 공격하는 넓은 낫 휘두르기를 2회 이어서 펼친다.",
        "Faça uma pausa após o segundo golpe para emendar dois amplos golpes de foice que também atingem inimigos atrás de você.",
        "Сделай паузу после второго удара, чтобы провести два широких взмаха косой, которые задевают и врагов позади.")},
    20703: {"name": "[[attack]]", "desc": L(
        "The final strike reaches further and deals more damage.",
        "最后一段攻击距离更远，伤害提升。",
        "最後一段攻擊距離更遠，傷害提升。",
        "Der letzte Schlag reicht weiter und bewirkt mehr Schaden.",
        "El golpe final llega más lejos e inflige más daño.",
        "Le dernier coup porte plus loin et inflige plus de dégâts.",
        "最終段のリーチが伸び、ダメージが増加する。",
        "마지막 공격의 사거리가 늘어나고 대미지가 증가한다.",
        "O golpe final alcança mais longe e causa mais dano.",
        "Финальный удар достает дальше и наносит больше урона.")},
    20704: {"name": "[[rising_reap]]", "desc": L(
        "Deals damage more times, hits enemies behind, and launches higher.",
        "伤害次数增加，可攻击身后的敌人，且挑飞得更高。",
        "傷害次數增加，可攻擊身後的敵人，且挑飛得更高。",
        "Bewirkt öfter Schaden, trifft auch Gegner hinter dir und schleudert sie höher in die Luft.",
        "Inflige daño más veces, alcanza a los enemigos que tengas detrás y los lanza más alto.",
        "Augmente le nombre de coups, touche les ennemis derrière toi et les projette plus haut.",
        "ダメージ回数が増え、背後の敵にもヒットし、より高く打ち上げる。",
        "공격 횟수가 늘어나고, 뒤에 있는 적도 공격하며, 더 높이 띄운다.",
        "Causa dano mais vezes, atinge inimigos atrás de você e os lança mais alto.",
        "Наносит урон большее число раз, задевает врагов позади и подбрасывает выше.")},
    # 0.9.0: the card also lifts her with what the ground version launches (the first sentence is the stock line)
    20705: {"name": "[[rising_reap]]", "desc": L(
        "Can be activated while mid-air. On the ground, a hit carries her up with the enemy.",
        "可在空中使用。在地面命中时，她会随敌人一同升空。",
        "可在空中使用。在地面命中時，她會隨敵人一同升空。",
        "Kann in der Luft aktiviert werden. Am Boden trägt ein Treffer sie mit dem Gegner nach oben.",
        "Se puede activar en el aire. En el suelo, un golpe la eleva junto con el enemigo.",
        "Activation possible dans les airs. Au sol, un coup qui touche l'emporte vers le haut avec l'ennemi.",
        "空中でも発動できる。地上で命中すると、敵と一緒に上昇する。",
        "공중에서도 발동할 수 있다. 지상에서 명중하면 적과 함께 솟아오른다.",
        "Pode ser ativado no ar. No chão, um acerto a leva para cima junto com o inimigo.",
        "Можно активировать в воздухе. На земле попадание поднимает ее вверх вместе с врагом.")},
    20706: {"name": "[[rising_reap]]", "desc": L(
        "Brief Invincibility at the start of the attack.",
        "出招时有短暂无敌。",
        "出招時有短暫無敵。",
        "Kurze Unverwundbarkeit zu Beginn des Angriffs.",
        "Invencibilidad momentánea al inicio del ataque.",
        "Rend brièvement invincible au début de l'attaque.",
        "攻撃の出始めに短時間の無敵状態となる。",
        "공격 시작 시 짧은 시간 동안 무적 상태가 된다.",
        "Breve Invencibilidade no início do ataque.",
        "Короткая неуязвимость в начале атаки.")},
    20707: {"name": "[[low_sweep]]", "desc": L(
        "Opens with a quick low slash, and the sweep can be followed by Skills.",
        "以一记快速下段斩起手，横扫后可衔接技能。",
        "以一記快速下段斬起手，橫掃後可銜接技能。",
        "Beginnt mit einem schnellen tiefen Hieb, und auf den Feger können Fertigkeiten folgen.",
        "Empieza con un tajo bajo rápido, y el barrido puede continuarse con habilidades.",
        "Commence par une taillade basse rapide, et le balayage peut être enchaîné avec des compétences.",
        "素早い下段斬りから始まり、薙ぎ払いからスキルに繋げられる。",
        "빠른 하단 베기로 시작하며, 휩쓸기 후 스킬로 연계할 수 있다.",
        "Começa com um corte baixo rápido, e a varredura pode ser seguida por Habilidades.",
        "Начинается с быстрого нижнего удара, а после подсечки можно применить навыки.")},
    20708: {"name": "[[rising_crescent]]",
            "input": G(S("<action=MoveY->+<action=Attack>", "<action=Attack>")),   # KIT's "›" written as the stock " · "
            "desc": L(
        # (0.8.0, a tester's suggestion: Double Kick comes with this card; the second sentence in each language)
        "After [[c:low_sweep]], slashes upwards with brief Invincibility, launching enemies. Also unlocks [[c:double_kick]] in the air.",
        "[[c:low_sweep]]后向上斩击，出招时有短暂无敌，将敌人挑飞。同时解锁空中的[[c:double_kick]]。",
        "[[c:low_sweep]]後向上斬擊，出招時有短暫無敵，將敵人挑飛。同時解鎖空中的[[c:double_kick]]。",
        "Schlägt nach [[c:low_sweep]] mit kurzer Unverwundbarkeit nach oben und schleudert Gegner in die Luft. Schaltet außerdem [[c:double_kick]] in der Luft frei.",
        "Tras [[c:low_sweep]], ejecuta un tajo hacia arriba con Invencibilidad momentánea que lanza a los enemigos por los aires. Además, desbloquea [[c:double_kick]] en el aire.",
        "Après [[c:low_sweep]], assène une taillade ascendante qui rend brièvement invincible et projette les ennemis en l'air. Débloque aussi [[c:double_kick]] dans les airs.",
        "[[c:low_sweep]]の後、短時間の無敵状態で上に斬り上げ、敵を打ち上げる。空中の[[c:double_kick]]も解放される。",
        "[[c:low_sweep]] 후 짧은 무적 상태로 위를 향해 베어 올려 적을 띄운다. 공중의 [[c:double_kick]]도 해금된다.",
        "Após [[c:low_sweep]], corta para cima com breve Invencibilidade, lançando inimigos ao ar. Também desbloqueia [[c:double_kick]] no ar.",
        "После приема [[c:low_sweep]] наносит режущий удар снизу вверх с короткой неуязвимостью, подбрасывая врагов. Также открывает [[c:double_kick]] в воздухе.")},
    20709: {"name": "[[clash_assault]]", "desc": L(
        "Super Armor during the attack. It breaks Super Armor and ends with a finishing flurry.",
        "攻击期间处于霸体状态。可破霸体，并以一连串终结斩击收尾。",
        "攻擊期間處於霸體狀態。可破霸體，並以一連串終結斬擊收尾。",
        "Superrüstung während des Angriffs. Durchbricht Superrüstung und endet mit einem abschließenden Hagel von Hieben.",
        "Superarmadura durante el ataque. Rompe la Superarmadura y termina con una ráfaga final de tajos.",
        "Super armure pendant l'attaque. Brise la super armure et se termine par une rafale de coups finale.",
        "攻撃中はスーパーアーマー状態になる。敵のスーパーアーマーを貫通し、とどめの連撃で締めくくる。",
        "공격 중 슈퍼 아머 상태가 된다. 적의 슈퍼 아머를 관통하며, 마무리 연격으로 끝낸다.",
        "Superarmadura durante o ataque. Quebra Superarmadura e termina com uma sequência final de golpes.",
        "Супер-броня во время атаки. Ломает супер-броню и завершается добивающим шквалом ударов.")},
    20710: {"name": "[[rifle_shot]]", "desc": L(
        "Fires a second round. Reduces MP cost.",
        "额外发射第2发子弹。MP消耗降低。",
        "額外發射第2發子彈。MP消耗降低。",
        "Feuert eine zweite Kugel ab. Verringert die MP-Kosten.",
        "Dispara una segunda bala. Reduce el coste de PM.",
        "Tire une deuxième balle. Réduit le coût en PM.",
        "2発目の弾丸を発射する。MP消費が少なくなる。",
        "2번째 탄환을 발사한다. MP 소모량이 감소한다.",
        "Dispara uma segunda bala. Reduz o custo de PM.",
        "Выпускает вторую пулю. Снижает расход ОД.")},
    # 0.9.0: Sy-Pod is one heavy round a pull, and more while Skill stays held (until 0.8 this card added a third round)
    20711: {"name": "[[sypod]]", "desc": L(
        "Rounds fired while holding cost less MP, and planting the rifle knocks enemies away.",
        "按住时追加射击的MP消耗降低，架枪的动作会将敌人击飞。",
        "按住時追加射擊的MP消耗降低，架槍的動作會將敵人擊飛。",
        "Beim Halten abgefeuerte Kugeln kosten weniger MP, und das Aufstellen des Gewehrs stößt Gegner weg.",
        "Las balas disparadas al mantener pulsado cuestan menos PM, y al apoyar el rifle se repele a los enemigos.",
        "Les balles tirées en maintenant le bouton coûtent moins de PM, et planter le fusil repousse les ennemis.",
        "押し続けて撃つ弾丸のMP消費が少なくなり、ライフルを突き立てる動作で敵を吹き飛ばす。",
        "누르고 있는 동안 발사하는 탄환의 MP 소모량이 감소하며, 라이플을 세우는 동작으로 적을 날려 보낸다.",
        "As balas disparadas ao manter pressionado custam menos PM, e fincar o rifle repele os inimigos.",
        "Пули, выпущенные при удержании, расходуют меньше ОД, а установка винтовки отбрасывает врагов.")},
    20712: {"name": "[[reapers_hook]]", "input": G("<action=MoveY->+<action=Skill>"),
            # only Back, relative to her facing, changes the throw (rrb_hook_back). No stock glyph or input label means
            # "back" (the direction glyphs are left / right), so it is a word: an unverified translation in nine languages
            "desc": L(
        "Hooks an enemy with the scythe and follows up with a flurry of slashes. Hold Back to throw the enemy behind her.",
        "用镰刀钩住敌人，并衔接一连串斩击。长按后方向可将敌人抛向身后。",
        "用鐮刀鉤住敵人，並銜接一連串斬擊。長按後方向可將敵人拋向身後。",
        "Hakt einen Gegner mit der Sense ein und lässt einen Hagel von Hieben folgen. Halte nach hinten, um den Gegner hinter dich zu werfen.",
        "Engancha a un enemigo con la guadaña y continúa con una ráfaga de tajos. Mantén pulsado hacia atrás para lanzar al enemigo a tu espalda.",
        "Accroche un ennemi avec la faux et enchaîne avec une rafale de taillades. Maintiens la direction arrière pour projeter l'ennemi derrière toi.",
        "鎌で敵を引っ掛け、連続斬りを繰り出す。後ろ方向を長押しすると、敵を背後へ投げ飛ばす。",
        "낫으로 적을 걸어 붙잡고 연속 베기를 펼친다. 뒤쪽 방향을 길게 누르면 적을 등 뒤로 던진다.",
        "Prende um inimigo com a foice e emenda uma sequência de cortes. Segure para trás para arremessar o inimigo para trás de você.",
        "Зацепляет врага косой и наносит серию режущих ударов. Удерживай направление назад, чтобы бросить врага себе за спину.")},
    20713: {"name": "[[guillotine]]", "desc": L(
        "Super Armor throughout, and the last strike launches.",
        "全程霸体，最后一击会将敌人挑飞。",
        "全程霸體，最後一擊會將敵人挑飛。",
        "Durchweg Superrüstung, und der letzte Schlag schleudert Gegner in die Luft.",
        "Superarmadura durante todo el ataque, y el último golpe lanza a los enemigos por los aires.",
        "Super armure pendant toute l'action, et le dernier coup projette les ennemis en l'air.",
        "発動中はスーパーアーマー状態になり、最後の一撃で敵を打ち上げる。",
        "발동 중 슈퍼 아머 상태가 되며, 마지막 일격이 적을 띄운다.",
        "Superarmadura durante todo o ataque, e o último golpe lança os inimigos ao ar.",
        "Постоянная супер-броня, а последний удар подбрасывает врагов.")},
    20714: {"name": "[[guillotine]]", "desc": L(
        "Hold <action=Skill> to keep spinning, dealing damage more times.",
        "长按<action=Skill>可持续旋转，伤害次数增加。",
        "長按<action=Skill>可持續旋轉，傷害次數增加。",
        "Halte <action=Skill>, um weiter zu wirbeln und öfter Schaden zu bewirken.",
        "Mantén pulsado <action=Skill> para seguir girando e infligir daño más veces.",
        "Maintiens <action=Skill> pour continuer à tournoyer et frapper plus de fois.",
        "<action=Skill>を長押しすると回転し続け、ダメージ回数が増える。",
        "<action=Skill>을 길게 누르면 계속 회전하며 공격 횟수가 늘어난다.",
        "Segure <action=Skill> para continuar girando, causando dano mais vezes.",
        "Удерживай <action=Skill>, чтобы продолжать вращение, нанося урон большее число раз.")},
    20715: {"name": "[[petal_burst]]", "input": "<action=Attack>+" + SUMMON, "desc": L(
        "Dashes through the enemy in a storm of petals. Invincible during the move.",
        "化作花瓣风暴冲过敌人，期间处于无敌状态。",
        "化作花瓣風暴衝過敵人，期間處於無敵狀態。",
        "Sprintet in einem Sturm aus Blütenblättern durch den Gegner und ist während der Aktion unverwundbar.",
        "Atraviesa al enemigo en una tormenta de pétalos. Invencible durante la acción.",
        "Traverse l'ennemi dans une tempête de pétales. Invincible pendant l'action.",
        "花びらの嵐となって敵を突き抜ける。発動中は無敵状態となる。",
        "꽃잎 폭풍이 되어 적을 돌파한다. 발동 중에는 무적 상태가 된다.",
        "Avança através do inimigo em uma tempestade de pétalas, invencível durante a ação.",
        "Проносится сквозь врага в вихре лепестков, получая неуязвимость на время действия."),
            # the SP line: true in the data (rrb_pots: an AddSPBall call, sp:0.04, on every Gun Blast hit). Stock shape of Mai's
            # ActorActionDesc_350472 ("SP: You earn SP when your Universal Skills hit an enemy.") and Taokaka's _50122
            # ("SP: Gained when hitting enemies..."); French stock omits the "PS :" prefix
            "sp": L(
        "SP: Gained when [[c:gun_blast]] hits an enemy.",
        "SP：[[c:gun_blast]]命中敌人时获得。",
        "SP：[[c:gun_blast]]命中敵人時獲得。",
        "SP: Erhältst du, wenn [[c:gun_blast]] einen Gegner trifft.",
        "PE: Se obtienen cuando [[c:gun_blast]] golpea a un enemigo.",
        "Tu gagnes des PS quand [[c:gun_blast]] touche un ennemi.",
        "SP：[[c:gun_blast]]が敵にヒットすると獲得する。",
        "SP: [[c:gun_blast]]를 적에게 적중시키면 얻는다.",
        "PE: você ganha PE quando [[c:gun_blast]] atinge um inimigo.",
        "ОЦ: ты получаешь ОЦ, когда прием [[c:gun_blast]] попадает во врага.")},
    20716: {"name": "[[petal_dance]]", "input": "<action=Skill>+" + SUMMON, "desc": L(
        "Spins into a storm of petals around one enemy, ending with a decisive strike.",
        "围绕一名敌人卷起花瓣风暴，并以决定性的一击收尾。",
        "圍繞一名敵人捲起花瓣風暴，並以決定性的一擊收尾。",
        "Wirbelt als Sturm aus Blütenblättern um einen Gegner und endet mit einem entscheidenden Schlag.",
        "Gira en una tormenta de pétalos alrededor de un enemigo y termina con un golpe decisivo.",
        "Tournoie en une tempête de pétales autour d'un ennemi et termine par un coup décisif.",
        "1体の敵の周囲で花びらの嵐となって回転し、決定的な一撃で締めくくる。",
        "적 하나의 주위를 꽃잎 폭풍이 되어 회전하며, 결정적인 일격으로 마무리한다.",
        "Gira em uma tempestade de pétalas ao redor de um inimigo, terminando com um golpe decisivo.",
        "Кружит вихрем лепестков вокруг одного врага и завершает решающим ударом.")},
    20717: {"name": "[[red_reaper]]", "desc": L(
        "[[c:petal_burst]] becomes [[c:red_reaper]] against Staggered enemies and bosses.",
        "对僵直的敌人和Boss使用时，[[c:petal_burst]]会变为[[c:red_reaper]]。",
        "對僵直的敵人和Boss使用時，[[c:petal_burst]]會變為[[c:red_reaper]]。",
        "[[c:petal_burst]] wird gegen betäubte Gegner und Bosse zu [[c:red_reaper]].",
        "[[c:petal_burst]] se convierte en [[c:red_reaper]] contra enemigos aturdidos y jefes.",
        "[[c:petal_burst]] devient [[c:red_reaper]] contre les ennemis étourdis et les boss.",
        "硬直状態の敵とボスに対して、[[c:petal_burst]]が[[c:red_reaper]]に変化する。",
        "경직 상태의 적과 보스에게 사용하면 [[c:petal_burst]]가 [[c:red_reaper]]로 변한다.",
        "[[c:petal_burst]] se torna [[c:red_reaper]] contra inimigos atordoados e chefes.",
        "Против оглушенных врагов и боссов прием [[c:petal_burst]] превращается в [[c:red_reaper]].")},
    20718: {"name": "[[jump]]", "desc": STOCK_TRIPLE_JUMP},
    20719: {"name": "[[jump]]", "desc": STOCK_JUMP_RESET},
    # card name as approved ("Buzzsaw Blast"); the move row it adds is "Buzzsaw Blast EX" (MOVE_TEXT rrb_buzzsaw_ex)
    20720: {"name": "[[buzzsaw]]", "input": A(H("<action=MoveY->+<action=Skill>")), "desc": L(
        "Spins longer with more hits, and the landing shot releases a larger blast.",
        "旋转时间更长、攻击次数更多，落地射击会释放更大的爆炸。",
        "旋轉時間更長、攻擊次數更多，落地射擊會釋放更大的爆炸。",
        "Wirbelt länger mit mehr Treffern, und der Landeschuss löst eine größere Explosion aus.",
        "Gira durante más tiempo con más impactos, y el disparo al aterrizar desata una explosión mayor.",
        "Tournoie plus longtemps avec plus de coups, et le tir à l'atterrissage déclenche une explosion plus grande.",
        "回転時間が延びてヒット数が増え、着地時の射撃がより大きな爆発を起こす。",
        "더 오래 회전하며 적중 횟수가 늘어나고, 착지 사격이 더 큰 폭발을 일으킨다.",
        "Gira por mais tempo com mais golpes, e o disparo ao aterrissar libera uma explosão maior.",
        "Вращается дольше и наносит больше ударов, а выстрел при приземлении вызывает более мощный взрыв.")},
    20721: {"name": "[[gun_blast]]", "desc": L(
        "Invincible while traveling.",
        "位移期间处于无敌状态。",
        "位移期間處於無敵狀態。",
        "Während der Bewegung unverwundbar.",
        "Invencible durante el desplazamiento.",
        "Invincible pendant le déplacement.",
        "移動中は無敵状態となる。",
        "이동 중 무적 상태가 된다.",
        "Invencível durante o deslocamento.",
        "Неуязвимость во время перемещения.")},
    # 0.9.0: the chain card (until 0.8 she chained three times from the start, and this card gave a fourth)
    20722: {"name": "[[gun_blast]]", "desc": L(
        "Can chain 3 times, in any order and direction.",
        "可按任意顺序和方向连续使用3次。",
        "可按任意順序和方向連續使用3次。",
        "Bis zu dreimal in beliebiger Reihenfolge und Richtung verkettbar.",
        "Se puede encadenar hasta 3 veces en cualquier orden y dirección.",
        "Peut être enchaîné jusqu'à 3 fois dans n'importe quel ordre et direction.",
        "順番や方向を問わず3回まで連続で使用できる。",
        "순서와 방향에 관계없이 3회까지 연속 사용할 수 있다.",
        "Pode ser encadeado até 3 vezes em qualquer ordem e direção.",
        "Можно применить до 3 раз подряд в любом порядке и направлении.")},
    # (2026-10-03) the two Gun Blast cards the lead asked for. Translations unverified
    20739: {"name": "[[gun_blast]]", "desc": L(
        "Travels farther.",
        "位移距离增加。",
        "位移距離增加。",
        "Legt eine größere Strecke zurück.",
        "Recorre una distancia mayor.",
        "Parcourt une plus grande distance.",
        "移動距離が伸びる。",
        "이동 거리가 늘어난다.",
        "Percorre uma distância maior.",
        "Увеличивает дальность перемещения.")},
    20740: {"name": "[[gun_blast]]", "desc": L(
        "Each blast also fires a [[c:sypod]] round from the muzzle.",
        "每次发射时，还会从枪口射出一发[[c:sypod]]的子弹。",
        "每次發射時，還會從槍口射出一發[[c:sypod]]的子彈。",
        "Jeder Schuss feuert zusätzlich eine Kugel von [[c:sypod]] aus der Mündung.",
        "Cada disparo lanza además una bala de [[c:sypod]] desde la boca del arma.",
        "Chaque tir projette aussi une balle de [[c:sypod]] depuis la bouche du canon.",
        "発射のたびに、銃口から[[c:sypod]]の弾丸を1発放つ。",
        "발사할 때마다 총구에서 [[c:sypod]] 탄환을 1발 발사한다.",
        "Cada disparo também lança uma bala de [[c:sypod]] pela boca da arma.",
        "Каждый выстрел дополнительно выпускает из дула пулю приема [[c:sypod]].")},
    # 0.8.0 (the lead, 2026-10-03: "a potential or hidden effect that makes her jump fire a bullet from the bottom of it any
    # time she jumps and have the same vfx for gundash"). The jump cards share the stock name "Jump"
    20741: {"name": "[[jump]]", "desc": L(
        "Every jump fires a round straight down, and the recoil carries the jump higher.",
        "每次跳跃都会向正下方开一枪，后坐力让跳跃更高。",
        "每次跳躍都會向正下方開一槍，後座力讓跳躍更高。",
        "Jeder Sprung feuert eine Kugel senkrecht nach unten, und der Rückstoß trägt den Sprung höher.",
        "Cada salto dispara una bala directamente hacia abajo, y el retroceso eleva más el salto.",
        "Chaque saut tire une balle droit vers le bas, et le recul porte le saut plus haut.",
        "ジャンプするたびに真下へ発砲し、その反動でより高く跳ぶ。",
        "점프할 때마다 바로 아래로 사격하며, 그 반동으로 더 높이 뛰어오른다.",
        "Cada pulo dispara uma bala direto para baixo, e o recuo leva o pulo mais alto.",
        "Каждый прыжок сопровождается выстрелом прямо вниз, а отдача поднимает прыжок выше.")},
    # Recoil Rush: the name and the text are our own (2026-10-02). They replace Naoto's stock Enhancer card (310791, paid
    # DLC), whose name and first clause this card used to copy. The hidden effects still say "Enhanced by Gun Blast".
    20723: {"name": "[[recoil_rush]]", "desc": L(
        "[[c:gun_blast]]'s recoil carries into the attack that follows, enhancing it.",
        "[[c:gun_blast]]的后坐力会带入紧接其后的攻击，使其得到强化。",
        "[[c:gun_blast]]的後座力會帶入緊接其後的攻擊，使其得到強化。",
        "Der Rückstoß von [[c:gun_blast]] überträgt sich auf den darauffolgenden Angriff und verstärkt ihn.",
        "El retroceso de [[c:gun_blast]] se transmite al ataque que le sigue y lo potencia.",
        "Le recul de [[c:gun_blast]] se transmet à l'attaque suivante et la renforce.",
        "[[c:gun_blast]]の反動を直後の攻撃に乗せ、その攻撃を強化する。",
        "[[c:gun_blast]]의 반동을 바로 다음 공격에 실어 그 공격을 강화한다.",
        "O recuo de [[c:gun_blast]] é transferido para o ataque seguinte, aprimorando-o.",
        "Отдача приема [[c:gun_blast]] передается следующей за ним атаке и усиливает ее.")},
    20724: {"name": "[[corkscrew]]", "desc": L(
        "Spins twice, dealing damage more times and pulling enemies in.",
        "旋转两圈，伤害次数增加，并将敌人牵引过来。",
        "旋轉兩圈，傷害次數增加，並將敵人牽引過來。",
        "Wirbelt zweimal, bewirkt öfter Schaden und zieht Gegner heran.",
        "Gira dos veces, inflige daño más veces y atrae a los enemigos.",
        "Tournoie deux fois, frappe plus de fois et attire les ennemis.",
        "2回転し、ダメージ回数が増え、敵を引き寄せる。",
        "2회 회전하며 공격 횟수가 늘어나고 적을 끌어들인다.",
        "Gira duas vezes, causando dano mais vezes e puxando inimigos.",
        "Вращается дважды, нанося урон большее число раз и притягивая врагов.")},
    20725: {"name": "[[corkscrew]]", "desc": L(
        "Can be used right after [[c:gun_blast]], with Invincibility during the spin.",
        "可在[[c:gun_blast]]后立即使用，旋转期间处于无敌状态。",
        "可在[[c:gun_blast]]後立即使用，旋轉期間處於無敵狀態。",
        "Kann direkt nach [[c:gun_blast]] eingesetzt werden und gewährt während der Drehung Unverwundbarkeit.",
        "Se puede usar justo después de [[c:gun_blast]] y otorga Invencibilidad durante el giro.",
        "Peut être utilisé juste après [[c:gun_blast]] et rend invincible pendant la rotation.",
        "[[c:gun_blast]]の直後に使用でき、回転中は無敵状態となる。",
        "[[c:gun_blast]] 직후에 사용할 수 있으며, 회전 중 무적 상태가 된다.",
        "Pode ser usado logo após [[c:gun_blast]], com Invencibilidade durante o giro.",
        "Можно применить сразу после приема [[c:gun_blast]], во время вращения действует неуязвимость.")},
    # Universal Enhancement: stock naming (card = "Universal Enhancement", the desc opens with the highlighted name and
    # the language's stock colon: "：" in chs / cht / jpn, " : " in French; Ragna 11221 / 11231)
    20726: {"name": "[[universal]]", "desc": L(
        "[[c:crescent_mastery]]: Scythe attacks are larger and deal more damage.",
        "[[c:crescent_mastery]]：镰刀攻击范围扩大，伤害提升。",
        "[[c:crescent_mastery]]：鐮刀攻擊範圍擴大，傷害提升。",
        "[[c:crescent_mastery]]: Sensenangriffe sind größer und bewirken mehr Schaden.",
        "[[c:crescent_mastery]]: Los ataques de guadaña son más grandes e infligen más daño.",
        "[[c:crescent_mastery]] : Les attaques de faux sont plus grandes et infligent plus de dégâts.",
        "[[c:crescent_mastery]]：鎌による攻撃の範囲が拡大し、ダメージが増加する。",
        "[[c:crescent_mastery]]: 낫 공격의 범위가 확대되고 대미지가 증가한다.",
        "[[c:crescent_mastery]]: ataques de foice ficam maiores e causam mais dano.",
        "[[c:crescent_mastery]]: атаки косой становятся больше и наносят больше урона.")},
    20727: {"name": "[[universal]]", "desc": L(
        "[[c:high_caliber]]: Shots are larger, hit harder and push enemies further.",
        "[[c:high_caliber]]：射击范围扩大，威力提升，并将敌人击退得更远。",
        "[[c:high_caliber]]：射擊範圍擴大，威力提升，並將敵人擊退得更遠。",
        "[[c:high_caliber]]: Schüsse sind größer, treffen härter und stoßen Gegner weiter zurück.",
        "[[c:high_caliber]]: Los disparos son más grandes, golpean con más fuerza y empujan más lejos a los enemigos.",
        "[[c:high_caliber]] : Les tirs sont plus gros, frappent plus fort et repoussent les ennemis plus loin.",
        "[[c:high_caliber]]：射撃が大きくなり、威力が上がり、敵をより遠くまで吹き飛ばす。",
        "[[c:high_caliber]]: 사격이 커지고 위력이 증가하며, 적을 더 멀리 밀어낸다.",
        "[[c:high_caliber]]: disparos ficam maiores, atingem com mais força e empurram inimigos para mais longe.",
        "[[c:high_caliber]]: выстрелы становятся больше, бьют сильнее и отбрасывают врагов дальше.")},
    20728: {"name": "[[universal]]", "desc": L(
        "[[c:semblance]]: Dashing moves leave rose petals that damage enemies.",
        "[[c:semblance]]：冲刺类招式会留下可伤害敌人的玫瑰花瓣。",
        "[[c:semblance]]：衝刺類招式會留下可傷害敵人的玫瑰花瓣。",
        "[[c:semblance]]: Sprintende Moves hinterlassen Rosenblätter, die Gegnern Schaden zufügen.",
        "[[c:semblance]]: Los movimientos de acelerón dejan pétalos de rosa que dañan a los enemigos.",
        "[[c:semblance]] : Les actions de ruée laissent des pétales de rose qui blessent les ennemis.",
        "[[c:semblance]]：ダッシュ系の技がバラの花びらを残し、敵にダメージを与える。",
        "[[c:semblance]]: 대시 계열 기술이 적에게 대미지를 주는 장미 꽃잎을 남긴다.",
        "[[c:semblance]]: movimentos de avanço deixam pétalas de rosa que causam dano aos inimigos.",
        "[[c:semblance]]: рывковые приемы оставляют лепестки роз, наносящие урон врагам.")},
    20729: {"name": "[[universal]]", "desc": L(
        "[[c:silver_eyes]]: Deals more damage to bosses, Elites and Staggered enemies.",
        "[[c:silver_eyes]]：对Boss、高阶敌人和僵直的敌人造成的伤害提升。",
        "[[c:silver_eyes]]：對Boss、高階敵人和僵直的敵人造成的傷害提升。",
        "[[c:silver_eyes]]: Bewirkt mehr Schaden gegen Bosse, Elitegegner und betäubte Gegner.",
        "[[c:silver_eyes]]: Inflige más daño a jefes, enemigos de élite y enemigos aturdidos.",
        "[[c:silver_eyes]] : Inflige plus de dégâts aux boss, aux ennemis d'élite et aux ennemis étourdis.",
        "[[c:silver_eyes]]：ボス、精鋭の敵、硬直状態の敵に与えるダメージが増加する。",
        "[[c:silver_eyes]]: 보스, 정예 적, 경직 상태의 적에게 주는 대미지가 증가한다.",
        "[[c:silver_eyes]]: causa mais dano a chefes, Inimigos de Elite e inimigos atordoados.",
        "[[c:silver_eyes]]: наносит больше урона боссам, элитным и оглушенным врагам.")},
    20730: {"name": "[[dust]]", "desc": L(
        "Dust lasts longer, and loading Dust restores MP.",
        "尘晶持续时间延长，装填尘晶时恢复MP。",
        "塵晶持續時間延長，裝填塵晶時恢復MP。",
        "Staub hält länger an, und das Laden von Staub regeneriert MP.",
        "El Polvo dura más, y cargar Polvo recupera PM.",
        "La Poussière dure plus longtemps, et charger de la Poussière rend des PM.",
        "ダストの持続時間が延び、ダストを装填するとMPが回復する。",
        "더스트의 지속 시간이 늘어나며, 더스트를 장전하면 MP가 회복된다.",
        "O Pó dura mais, e carregar Pó recupera PM.",
        "Прах действует дольше, а зарядка Праха восстанавливает ОД.")},
    20731: {"name": "[[dust]]", "desc": L(
        "Dust effects are stronger: Burn spreads, Frozen enemies shatter, Paralysis jumps to a nearby enemy, Gravity pulls harder.",
        "尘晶效果增强：燃烧会扩散，冰冻的敌人会碎裂，麻痹会跳跃至附近的敌人，重力的牵引更强。",
        "塵晶效果增強：燃燒會擴散，冰凍的敵人會碎裂，麻痺會跳躍至附近的敵人，重力的牽引更強。",
        "Staub-Effekte sind stärker: Verbrennung breitet sich aus, eingefrorene Gegner zerspringen, Lähmung springt auf einen Gegner in der Nähe über, Gravitation zieht stärker.",
        "Los efectos del Polvo son más fuertes: la Quemadura se propaga, los enemigos congelados se hacen añicos, la parálisis salta a un enemigo cercano y la gravedad atrae con más fuerza.",
        "Les effets de la Poussière sont renforcés : la Brûlure se propage, les ennemis gelés volent en éclats, la paralysie se transmet à un ennemi proche et la gravité attire plus fort.",
        "ダストの効果が強化される：バーニングが拡散し、凍結状態の敵が砕け散り、麻痺が近くの敵に連鎖し、重力の引き寄せが強くなる。",
        "더스트 효과가 강화된다: 화상이 확산되고, 동결 상태의 적이 산산조각 나며, 마비가 근처의 적에게 옮겨 가고, 중력이 더 강하게 끌어당긴다.",
        "Os efeitos do Pó ficam mais fortes: a Queimadura se espalha, inimigos Congelados se estilhaçam, a Paralisia salta para um inimigo próximo e a gravidade puxa com mais força.",
        "Эффекты Праха усиливаются: Горение распространяется, замороженные враги раскалываются, паралич перескакивает на ближайшего врага, гравитация притягивает сильнее.")},
    20732: {"name": "[[dust_round]]", "input": SUMMON, "desc": L(
        "Loading Dust also fires a round of that element.",
        "装填尘晶时，还会发射一发对应属性的子弹。",
        "裝填塵晶時，還會發射一發對應屬性的子彈。",
        "Beim Laden von Staub wird zusätzlich eine Kugel dieses Elements abgefeuert.",
        "Al cargar Polvo, también dispara una bala de ese elemento.",
        "Charger de la Poussière tire aussi une balle de cet élément.",
        "ダストを装填すると、その属性の弾丸も発射する。",
        "더스트를 장전하면 해당 속성의 탄환도 발사한다.",
        "Carregar Pó também dispara uma bala desse elemento.",
        "Зарядка Праха также выпускает пулю этой стихии.")},
    20733: {"name": "[[dust]]", "desc": L(
        "The spent cartridge explodes where it lands, in the element of the Dust it held.",
        "用完的弹壳落地时会爆炸，属性与其中装填的尘晶相同。",
        "用完的彈殼落地時會爆炸，屬性與其中裝填的塵晶相同。",
        "Die verbrauchte Patrone explodiert dort, wo sie landet, im Element des Staubs, den sie enthielt.",
        "El cartucho gastado explota donde cae, con el elemento del Polvo que contenía.",
        "La cartouche vide explose là où elle tombe, avec l'élément de la Poussière qu'elle contenait.",
        "使用済みのカートリッジが落下地点で爆発する。爆発の属性は装填されていたダストと同じ。",
        "다 쓴 카트리지가 떨어진 곳에서 폭발하며, 그 속성은 담겨 있던 더스트와 같다.",
        "O cartucho usado explode onde cai, no elemento do Pó que continha.",
        "Отработанный патрон взрывается там, где упадет, стихией Праха, который в нем был.")},
    20734: {"name": "[[dust]]", "desc": L(
        "Loading a new Dust keeps the previous one active for a few seconds, combining both.",
        "装填新的尘晶时，之前的尘晶会继续生效数秒，两者效果叠加。",
        "裝填新的塵晶時，之前的塵晶會繼續生效數秒，兩者效果疊加。",
        "Beim Laden eines neuen Staubs bleibt der vorherige einige Sekunden lang aktiv, und beide wirken zusammen.",
        "Al cargar un Polvo nuevo, el anterior sigue activo unos segundos y se combinan ambos.",
        "Charger une nouvelle Poussière garde la précédente active quelques secondes, en combinant les deux.",
        "新しいダストを装填すると、前のダストが数秒間有効なまま残り、両方の効果が組み合わさる。",
        "새 더스트를 장전하면 이전 더스트가 몇 초간 유지되어 두 효과가 합쳐진다.",
        "Carregar um novo Pó mantém o anterior ativo por alguns segundos, combinando os dois.",
        "При зарядке нового Праха предыдущий остается активным несколько секунд, и их эффекты сочетаются.")},
    20735: {"name": "[[fire_dust]]", "desc": L(
        "With Fire Dust, [[c:gun_blast]] leaves a trail of flames and [[c:buzzsaw]] lands in an eruption of fire.",
        "装填火焰尘晶时，[[c:gun_blast]]会留下火焰轨迹，[[c:buzzsaw]]落地时会引发火焰喷发。",
        "裝填火焰塵晶時，[[c:gun_blast]]會留下火焰軌跡，[[c:buzzsaw]]落地時會引發火焰噴發。",
        "Mit Feuerstaub hinterlässt [[c:gun_blast]] eine Flammenspur, und [[c:buzzsaw]] landet in einem Feuerausbruch.",
        "Con Polvo de Fuego, [[c:gun_blast]] deja un rastro de llamas y [[c:buzzsaw]] aterriza en una erupción de fuego.",
        "Avec la Poussière de feu, [[c:gun_blast]] laisse une traînée de flammes et [[c:buzzsaw]] atterrit dans une éruption de feu.",
        "炎のダスト装填中、[[c:gun_blast]]が炎の軌跡を残し、[[c:buzzsaw]]の着地時に炎が噴き上がる。",
        "화염 더스트 장전 시 [[c:gun_blast]]가 불꽃 궤적을 남기고, [[c:buzzsaw]]가 착지할 때 화염이 분출한다.",
        "Com Pó de Fogo, [[c:gun_blast]] deixa um rastro de chamas e [[c:buzzsaw]] aterrissa em uma erupção de fogo.",
        "С Огненным прахом прием [[c:gun_blast]] оставляет огненный след, а [[c:buzzsaw]] при приземлении вызывает извержение пламени.")},
    20736: {"name": "[[ice_dust]]", "desc": L(
        "With Ice Dust, shots leave ice spikes where they hit, and scythe attacks deal more damage to Frozen enemies.",
        "装填寒冰尘晶时，射击命中处会留下冰刺，镰刀攻击对冰冻的敌人造成的伤害提升。",
        "裝填寒冰塵晶時，射擊命中處會留下冰刺，鐮刀攻擊對冰凍的敵人造成的傷害提升。",
        "Mit Eisstaub hinterlassen Schüsse Eisstacheln, wo sie treffen, und Sensenangriffe bewirken mehr Schaden gegen eingefrorene Gegner.",
        "Con Polvo de Hielo, los disparos dejan púas de hielo donde impactan, y los ataques de guadaña infligen más daño a los enemigos congelados.",
        "Avec la Poussière de glace, les tirs laissent des pics de glace là où ils touchent, et les attaques de faux infligent plus de dégâts aux ennemis gelés.",
        "氷のダスト装填中、射撃の命中地点に氷の棘が残り、鎌による攻撃が凍結状態の敵に与えるダメージが増加する。",
        "빙결 더스트 장전 시 사격이 적중한 곳에 얼음 가시가 남고, 낫 공격이 동결 상태의 적에게 주는 대미지가 증가한다.",
        "Com Pó de Gelo, os disparos deixam espinhos de gelo onde acertam, e ataques de foice causam mais dano a inimigos Congelados.",
        "С Ледяным прахом выстрелы оставляют ледяные шипы в месте попадания, а атаки косой наносят больше урона замороженным врагам.")},
    20737: {"name": "[[lightning_dust]]", "desc": L(
        "With Lightning Dust, [[c:gun_blast]] strikes enemies along its path, and the third strike of [[c:attack]] calls down lightning.",
        "装填雷电尘晶时，[[c:gun_blast]]会电击路径上的敌人，[[c:attack]]的第3段攻击会召唤落雷。",
        "裝填雷電塵晶時，[[c:gun_blast]]會電擊路徑上的敵人，[[c:attack]]的第3段攻擊會召喚落雷。",
        "Mit Blitzstaub trifft [[c:gun_blast]] Gegner auf seinem Weg, und der dritte Schlag von [[c:attack]] ruft einen Blitz herab.",
        "Con Polvo de Relámpago, [[c:gun_blast]] golpea a los enemigos en su trayectoria, y el tercer golpe de [[c:attack]] invoca un rayo.",
        "Avec la Poussière de foudre, [[c:gun_blast]] frappe les ennemis sur sa trajectoire, et le troisième coup d'[[c:attack]] fait tomber la foudre.",
        "雷のダスト装填中、[[c:gun_blast]]が経路上の敵に電撃を与え、[[c:attack]]の3段目が落雷を呼ぶ。",
        "라이트닝 더스트 장전 시 [[c:gun_blast]]가 경로상의 적을 타격하고, [[c:attack]]의 3번째 공격이 낙뢰를 부른다.",
        "Com Pó de Raio, [[c:gun_blast]] atinge inimigos em seu caminho, e o terceiro golpe de [[c:attack]] invoca um raio.",
        "С Грозовым прахом прием [[c:gun_blast]] поражает врагов на своем пути, а третий удар приема [[c:attack]] призывает молнию.")},
    20738: {"name": "[[gravity_dust]]", "desc": L(
        "With Gravity Dust, [[c:rising_reap]] and [[c:guillotine]] open a gravity well that pulls enemies in.",
        "装填重力尘晶时，[[c:rising_reap]]和[[c:guillotine]]会打开吸引敌人的重力井。",
        "裝填重力塵晶時，[[c:rising_reap]]和[[c:guillotine]]會打開吸引敵人的重力井。",
        "Mit Gravitationsstaub öffnen [[c:rising_reap]] und [[c:guillotine]] einen Gravitationsschacht, der Gegner heranzieht.",
        "Con Polvo Gravitatorio, [[c:rising_reap]] y [[c:guillotine]] abren un pozo gravitatorio que atrae a los enemigos.",
        "Avec la Poussière gravitationnelle, [[c:rising_reap]] et [[c:guillotine]] ouvrent un puits gravitationnel qui attire les ennemis.",
        "重力のダスト装填中、[[c:rising_reap]]と[[c:guillotine]]が敵を引き寄せる重力井戸を生み出す。",
        "중력 더스트 장전 시 [[c:rising_reap]]과 [[c:guillotine]]이 적을 끌어당기는 중력장을 연다.",
        "Com Pó Gravitacional, [[c:rising_reap]] e [[c:guillotine]] abrem um poço gravitacional que puxa os inimigos.",
        "С Гравитационным прахом приемы [[c:rising_reap]] и [[c:guillotine]] создают гравитационный колодец, притягивающий врагов.")},
    20799: {"name": "[[unleashed]]", "desc": STOCK_UNLEASHED_DESC},
}


# ---------------------------------------------------------------- 2. hidden effects (KIT_V2 §10): 38 PotentialComboConf rows
# Each row: "needs" = the Potential ids, "move" = the MOVE_TEXT keys whose move list shows the line (always a tuple: stock
# rows carry one text on several moves, e.g. Ragna's 1001 on seven), "text" = the line.
# Row 27 is a LIST of four variants: one combo row (needs 20731) whose four RelationIds are Type-2 rows on four different
# moves, each with its own element text (stock shape: one PotentialComboConf, several relations). Keeping them as a list
# under 27 keeps the 1-38 numbering of KIT_V2 / V2_COVERAGE H1-H38.
_CM, _HC, _SEM, _SE = 20726, 20727, 20728, 20729
_SCYTHE_MOVES = ("rrb_a1", "rrb_5b", "rrb_launcher", "rrb_sweep", "rrb_2b", "rrb_clash", "rrb_corkscrew", "rrb_guillotine")   # KIT: "every scythe move (8)"; this list is a proposal
# KIT: "every shot (6)". Hidden effect 5 lists only the four moves whose rounds High Caliber enlarges: Gun Blast (a hit
# box on the action) and Airborne Attack (no round) were removed 2026-10-02. This renumbers the hidden rows after it
# (rrb_pots.content_v2 counts them from 140001): the old 140014 (Gun Blast) and 140016 (Airborne Attack) are gone, the
# old 140015 (Buzzsaw Blast) is now 140014, and every id from the old 140017 on is 2 lower (55 rows -> 53).
_SHOT_MOVES = ("rrb_rifleshot", "rrb_sypod", "rrb_buzzsaw", "rrb_dustround")
HIDDEN_TEXT = {
    1: {"needs": (_CM,), "move": _SCYTHE_MOVES, "text": STOCK_EXPANDS},
    2: {"needs": (_CM, 20701), "move": ("rrb_a1",), "text": STOCK_EVEN_LARGER},
    3: {"needs": (_CM, 20704), "move": ("rrb_launcher",), "text": STOCK_EVEN_LARGER},
    4: {"needs": (_CM, 20724), "move": ("rrb_corkscrew",), "text": L(
        "Spins in an even larger range.", "旋转范围进一步扩大。", "旋轉範圍進一步擴大。", "Wirbelt mit einer noch größeren Reichweite.",
        "Gira con un alcance aún mayor.", "Tournoie avec une portée encore plus grande.", "回転の範囲がさらに拡大する。",
        "회전 범위가 더욱 확대된다.", "Gira em um alcance ainda maior.", "Вращается с еще большим радиусом действия.")},
    5: {"needs": (_HC,), "move": _SHOT_MOVES, "text": L(
        "Rounds are larger.", "子弹变大。", "子彈變大。", "Kugeln sind größer.", "Las balas son más grandes.",
        "Les balles sont plus grosses.", "弾丸が大きくなる。", "탄환이 커진다.", "As balas ficam maiores.", "Пули становятся больше.")},
    6: {"needs": (_HC, 20710), "move": ("rrb_rifleshot",), "text": L(
        "Rounds pierce enemies.", "子弹可贯穿敌人。", "子彈可貫穿敵人。", "Kugeln durchschlagen Gegner.", "Las balas atraviesan a los enemigos.",
        "Les balles transpercent les ennemis.", "弾丸が敵を貫通する。", "탄환이 적을 관통한다.", "As balas perfuram inimigos.",
        "Пули пробивают врагов насквозь.")},
    7: {"needs": (_HC, 20711), "move": ("rrb_sypod",), "text": L(
        "Rounds explode on impact.", "子弹命中时会爆炸。", "子彈命中時會爆炸。", "Kugeln explodieren beim Aufprall.",
        "Las balas explotan al impactar.", "Les balles explosent à l'impact.", "弾丸が着弾時に爆発する。", "탄환이 명중 시 폭발한다.",
        "As balas explodem no impacto.", "Пули взрываются при попадании.")},
    8: {"needs": (_SEM,), "move": ("rrb_blast", "rrb_petalburst", "rrb_corkscrew"), "text": L(
        "Leaves rose petals that damage enemies.", "会留下可伤害敌人的玫瑰花瓣。", "會留下可傷害敵人的玫瑰花瓣。",
        "Hinterlässt Rosenblätter, die Gegnern Schaden zufügen.", "Deja pétalos de rosa que dañan a los enemigos.",
        "Laisse des pétales de rose qui blessent les ennemis.", "敵にダメージを与えるバラの花びらを残す。",
        "적에게 대미지를 주는 장미 꽃잎을 남긴다.", "Deixa pétalas de rosa que causam dano aos inimigos.",
        "Оставляет лепестки роз, наносящие урон врагам.")},
    9: {"needs": (_SEM, 20721), "move": ("rrb_blast",), "text": L(
        "Petals left by [[gun_blast]] deal more damage and linger.",
        "[[gun_blast]]留下的花瓣伤害提升，且停留时间更长。",
        "[[gun_blast]]留下的花瓣傷害提升，且停留時間更長。",
        "Von [[gun_blast]] hinterlassene Blütenblätter bewirken mehr Schaden und bleiben länger bestehen.",
        "Los pétalos que deja [[gun_blast]] infligen más daño y permanecen más tiempo.",
        "Les pétales laissés par [[gun_blast]] infligent plus de dégâts et persistent plus longtemps.",
        "[[gun_blast]]が残す花びらのダメージが増加し、より長く残る。",
        "[[gun_blast]]가 남긴 꽃잎의 대미지가 증가하고 더 오래 남는다.",
        "As pétalas deixadas por [[gun_blast]] causam mais dano e permanecem por mais tempo.",
        "Лепестки, оставленные приемом [[gun_blast]], наносят больше урона и держатся дольше.")},
    10: {"needs": (_SE, 20717), "move": ("rrb_petalburst",), "text": L(
        "[[c:red_reaper]] can also be triggered against Elites.",
        "对高阶敌人也可触发[[c:red_reaper]]。",
        "對高階敵人也可觸發[[c:red_reaper]]。",
        "[[c:red_reaper]] kann auch gegen Elitegegner ausgelöst werden.",
        "[[c:red_reaper]] también se puede activar contra enemigos de élite.",
        "[[c:red_reaper]] peut aussi se déclencher contre les ennemis d'élite.",
        "精鋭の敵に対しても[[c:red_reaper]]が発動できる。",
        "정예 적에게도 [[c:red_reaper]]를 발동할 수 있다.",
        "[[c:red_reaper]] também pode ser ativada contra Inimigos de Elite.",
        "[[c:red_reaper]] может срабатывать и против элитных врагов.")},
    11: {"needs": (_SE, 20709), "move": ("rrb_clash",), "text": L(
        "Also Staggers bosses.", "还会使Boss陷入僵直。", "還會使Boss陷入僵直。", "Betäubt auch Bosse.", "También aturde a los jefes.",
        "Étourdit aussi les boss.", "ボスも硬直させる。", "보스도 경직시킨다.", "Também atordoa chefes.", "Также оглушает боссов.")},
    12: {"needs": (20702, 20704), "move": ("rrb_5b",), "text": L(
        "The second sweep flows into [[c:rising_reap]].",
        "第2记横扫可直接衔接[[c:rising_reap]]。",
        "第2記橫掃可直接銜接[[c:rising_reap]]。",
        "Der zweite Hieb geht in [[c:rising_reap]] über.",
        "El segundo barrido enlaza con [[c:rising_reap]].",
        "Le deuxième balayage s'enchaîne sur [[c:rising_reap]].",
        "2回目の薙ぎ払いから[[c:rising_reap]]に繋がる。",
        "2번째 휘두르기가 [[c:rising_reap]]으로 이어진다.",
        "O segundo golpe emenda em [[c:rising_reap]].",
        "Второй взмах переходит в прием [[c:rising_reap]].")},
    13: {"needs": (20703, 20721), "move": ("rrb_a1",), "text": L(
        "The final strike is Invincible while passing through.",
        "最后一段攻击穿过敌人时处于无敌状态。",
        "最後一段攻擊穿過敵人時處於無敵狀態。",
        "Beim letzten Schlag bist du unverwundbar, während du hindurchstößt.",
        "El golpe final es invencible mientras atraviesa.",
        "Le dernier coup rend invincible pendant la traversée.",
        "最終段で敵を突き抜ける間、無敵状態となる。",
        "마지막 공격으로 적을 관통하는 동안 무적 상태가 된다.",
        "O golpe final é Invencível enquanto atravessa.",
        "Во время финального удара, проходя сквозь врага, действует неуязвимость.")},
    14: {"needs": (20707, 20713), "move": ("rrb_sweep",), "text": L(
        "Can be followed by [[c:guillotine]] at a reduced MP cost.",
        "可衔接[[c:guillotine]]，且MP消耗降低。",
        "可銜接[[c:guillotine]]，且MP消耗降低。",
        "Du kannst [[c:guillotine]] mit verringerten MP-Kosten folgen lassen.",
        "Puede continuarse con [[c:guillotine]] a un coste de PM reducido.",
        "Peut être enchaîné avec [[c:guillotine]] pour un coût en PM réduit.",
        "[[c:guillotine]]に繋げられ、MP消費が少なくなる。",
        "[[c:guillotine]]으로 연계할 수 있으며, MP 소모량이 감소한다.",
        "Pode ser seguido por [[c:guillotine]] com custo de PM reduzido.",
        "После него можно применить прием [[c:guillotine]] со сниженным расходом ОД.")},
    15: {"needs": (20707, 20716), "move": ("rrb_sweep",), "text": L(
        "Can be followed by [[c:petal_dance]].",
        "可衔接[[c:petal_dance]]。",
        "可銜接[[c:petal_dance]]。",
        "Du kannst [[c:petal_dance]] folgen lassen.",
        "Puede continuarse con [[c:petal_dance]].",
        "Peut être enchaîné avec [[c:petal_dance]].",
        "[[c:petal_dance]]に繋げられる。",
        "[[c:petal_dance]]로 연계할 수 있다.",
        "Pode ser seguido por [[c:petal_dance]].",
        "После него можно применить прием [[c:petal_dance]].")},
    16: {"needs": (20708, 20705), "move": ("rrb_2b",), "text": L(
        "Follows up with an airborne [[c:rising_reap]].",
        "衔接空中的[[c:rising_reap]]。",
        "銜接空中的[[c:rising_reap]]。",
        "Lässt eine [[c:rising_reap]] in der Luft folgen.",
        "Continúa con [[c:rising_reap]] en el aire.",
        "Enchaîne avec [[c:rising_reap]] dans les airs.",
        "空中で[[c:rising_reap]]に繋げる。",
        "공중에서 [[c:rising_reap]]으로 이어진다.",
        "Emenda com [[c:rising_reap]] no ar.",
        "Продолжается приемом [[c:rising_reap]] в воздухе.")},
    17: {"needs": (20712, 20713), "move": ("rrb_throw",), "text": L(
        "Follows up with [[c:guillotine]].",
        "衔接[[c:guillotine]]。",
        "銜接[[c:guillotine]]。",
        "Lässt [[c:guillotine]] folgen.",
        "Continúa con [[c:guillotine]].",
        "Enchaîne avec [[c:guillotine]].",
        "[[c:guillotine]]に繋げる。",
        "[[c:guillotine]]으로 이어진다.",
        "Emenda com [[c:guillotine]].",
        "Продолжается приемом [[c:guillotine]].")},
    18: {"needs": (20723, 20710), "move": ("rrb_rifleshot",), "text": L(
        "Enhanced by [[c:gun_blast]]: fires a high-caliber round.",
        "受[[c:gun_blast]]强化时：发射大口径子弹。",
        "受[[c:gun_blast]]強化時：發射大口徑子彈。",
        "Durch [[c:gun_blast]] verstärkt: Feuert eine großkalibrige Kugel ab.",
        "Potenciado por [[c:gun_blast]]: dispara una bala de alto calibre.",
        "Renforcé par [[c:gun_blast]] : tire une balle de gros calibre.",
        "[[c:gun_blast]]による強化時：大口径の弾丸を発射する。",
        "[[c:gun_blast]] 강화 버전: 대구경 탄환을 발사한다.",
        "Aprimorado por [[c:gun_blast]]: dispara uma bala de alto calibre.",
        "При усилении приемом [[c:gun_blast]]: выпускает крупнокалиберную пулю.")},
    19: {"needs": (20723, 20704), "move": ("rrb_launcher",), "text": L(
        "Enhanced by [[c:gun_blast]]: gains Super Armor and launches higher.",
        "受[[c:gun_blast]]强化时：获得霸体，且挑飞得更高。",
        "受[[c:gun_blast]]強化時：獲得霸體，且挑飛得更高。",
        "Durch [[c:gun_blast]] verstärkt: Erhält Superrüstung und schleudert höher in die Luft.",
        "Potenciado por [[c:gun_blast]]: obtiene Superarmadura y lanza más alto.",
        "Renforcé par [[c:gun_blast]] : confère une super armure et projette plus haut.",
        "[[c:gun_blast]]による強化時：スーパーアーマー状態になり、より高く打ち上げる。",
        "[[c:gun_blast]] 강화 버전: 슈퍼 아머 상태가 되며 더 높이 띄운다.",
        "Aprimorado por [[c:gun_blast]]: recebe Superarmadura e lança mais alto.",
        "При усилении приемом [[c:gun_blast]]: дает супер-броню и подбрасывает выше.")},
    20: {"needs": (20723, 20713), "move": ("rrb_guillotine",), "text": L(
        "Enhanced by [[c:gun_blast]]: reduces MP cost.",
        "受[[c:gun_blast]]强化时：MP消耗降低。",
        "受[[c:gun_blast]]強化時：MP消耗降低。",
        "Durch [[c:gun_blast]] verstärkt: Verringert die MP-Kosten.",
        "Potenciado por [[c:gun_blast]]: reduce el coste de PM.",
        "Renforcé par [[c:gun_blast]] : réduit le coût en PM.",
        "[[c:gun_blast]]による強化時：MP消費が少なくなる。",
        "[[c:gun_blast]] 강화 버전: MP 소모량이 감소한다.",
        "Aprimorado por [[c:gun_blast]]: reduz o custo de PM.",
        "При усилении приемом [[c:gun_blast]]: снижает расход ОД.")},
    21: {"needs": (20723, 20722), "move": ("rrb_blast",), "text": L(
        "Attacks enhanced after a fourth [[gun_blast]] deal more damage.",
        "第4次[[gun_blast]]后被强化的攻击伤害提升。",
        "第4次[[gun_blast]]後被強化的攻擊傷害提升。",
        "Nach dem vierten [[gun_blast]] verstärkte Angriffe bewirken mehr Schaden.",
        "Los ataques potenciados tras un cuarto [[gun_blast]] infligen más daño.",
        "Les attaques renforcées après un quatrième [[gun_blast]] infligent plus de dégâts.",
        "4回目の[[gun_blast]]後に強化された攻撃のダメージが増加する。",
        "4번째 [[gun_blast]] 후 강화된 공격의 대미지가 증가한다.",
        "Ataques aprimorados após um quarto [[gun_blast]] causam mais dano.",
        "Атаки, усиленные после четвертого приема [[gun_blast]], наносят больше урона.")},
    22: {"needs": (20720, 20721), "move": ("rrb_buzzsaw",), "text": L(
        "Can be followed by [[c:gun_blast]] even without hitting.",
        "即使未命中也可衔接[[c:gun_blast]]。",
        "即使未命中也可銜接[[c:gun_blast]]。",
        "Du kannst [[c:gun_blast]] auch ohne Treffer folgen lassen.",
        "Puede continuarse con [[c:gun_blast]] aunque no impacte.",
        "Peut être enchaîné avec [[c:gun_blast]] même sans toucher.",
        "ヒットしなくても[[c:gun_blast]]に繋げられる。",
        "적중하지 않아도 [[c:gun_blast]]로 연계할 수 있다.",
        "Pode ser seguido por [[c:gun_blast]] mesmo sem acertar.",
        "После него можно применить прием [[c:gun_blast]] даже без попадания.")},
    23: {"needs": (20720, 20715), "move": ("rrb_buzzsaw",), "text": L(
        "Can be followed by [[c:petal_burst]].",
        "可衔接[[c:petal_burst]]。",
        "可銜接[[c:petal_burst]]。",
        "Du kannst [[c:petal_burst]] folgen lassen.",
        "Puede continuarse con [[c:petal_burst]].",
        "Peut être enchaîné avec [[c:petal_burst]].",
        "[[c:petal_burst]]に繋げられる。",
        "[[c:petal_burst]]로 연계할 수 있다.",
        "Pode ser seguido por [[c:petal_burst]].",
        "После него можно применить прием [[c:petal_burst]].")},
    24: {"needs": (20715, 20716), "move": ("rrb_petaldance",), "text": L(
        "Costs less SP right after [[c:petal_burst]].",
        "在[[c:petal_burst]]后立即使用时，SP消耗降低。",
        "在[[c:petal_burst]]後立即使用時，SP消耗降低。",
        "Kostet direkt nach [[c:petal_burst]] weniger SP.",
        "Cuesta menos PE justo después de [[c:petal_burst]].",
        "Coûte moins de PS juste après [[c:petal_burst]].",
        "[[c:petal_burst]]の直後はSP消費が少なくなる。",
        "[[c:petal_burst]] 직후에는 SP 소모량이 감소한다.",
        "Custa menos PE logo após [[c:petal_burst]].",
        "Сразу после приема [[c:petal_burst]] расходует меньше ОЦ.")},
    25: {"needs": (20724, _SEM), "move": ("rrb_corkscrew",), "text": L(
        "Each spin leaves a ring of petals.", "每次旋转都会留下一圈花瓣。", "每次旋轉都會留下一圈花瓣。",
        "Jede Drehung hinterlässt einen Ring aus Blütenblättern.", "Cada giro deja un anillo de pétalos.",
        "Chaque rotation laisse un anneau de pétales.", "回転するたびに花びらの輪を残す。", "회전할 때마다 꽃잎 고리를 남긴다.",
        "Cada giro deixa um anel de pétalas.", "Каждый оборот оставляет кольцо лепестков.")},
    26: {"needs": (20725, 20721), "move": ("rrb_corkscrew",), "text": L(
        "Can be used during [[c:gun_blast]]'s travel.",
        "可在[[c:gun_blast]]位移期间使用。",
        "可在[[c:gun_blast]]位移期間使用。",
        "Kann während der Bewegung von [[c:gun_blast]] eingesetzt werden.",
        "Se puede usar durante el desplazamiento de [[c:gun_blast]].",
        "Peut être utilisé pendant le déplacement de [[c:gun_blast]].",
        "[[c:gun_blast]]の移動中に使用できる。",
        "[[c:gun_blast]]의 이동 중에 사용할 수 있다.",
        "Pode ser usado durante o deslocamento de [[c:gun_blast]].",
        "Можно применить во время перемещения приема [[c:gun_blast]].")},
    27: [   # one combo row (needs 20731), four element variants on four moves; see the note above
        {"element": "fire", "needs": (20731,), "move": ("rrb_buzzsaw",), "text": L(
            "With Fire Dust, the landing leaves a burning ring.",
            "装填火焰尘晶时，落地会留下燃烧的火环。",
            "裝填火焰塵晶時，落地會留下燃燒的火環。",
            "Mit Feuerstaub hinterlässt die Landung einen brennenden Ring.",
            "Con Polvo de Fuego, el aterrizaje deja un anillo ardiente.",
            "Avec la Poussière de feu, l'atterrissage laisse un anneau de flammes.",
            "炎のダスト装填中、着地地点に燃える輪を残す。",
            "화염 더스트 장전 시 착지 지점에 불타는 고리를 남긴다.",
            "Com Pó de Fogo, a aterrissagem deixa um anel em chamas.",
            "С Огненным прахом приземление оставляет горящее кольцо.")},
        {"element": "ice", "needs": (20731,), "move": ("rrb_sypod",), "text": L(
            "With Ice Dust, rounds Freeze on hit.",
            "装填寒冰尘晶时，子弹命中会使敌人冰冻。",
            "裝填寒冰塵晶時，子彈命中會使敵人冰凍。",
            "Mit Eisstaub frieren Kugeln Gegner bei einem Treffer ein.",
            "Con Polvo de Hielo, las balas congelan al impactar.",
            "Avec la Poussière de glace, les balles gèlent les ennemis touchés.",
            "氷のダスト装填中、弾丸がヒットした敵を凍結させる。",
            "빙결 더스트 장전 시 탄환이 적중한 적을 동결시킨다.",
            "Com Pó de Gelo, as balas Congelam ao acertar.",
            "С Ледяным прахом пули замораживают врагов при попадании.")},
        {"element": "lightning", "needs": (20731,), "move": ("rrb_blast",), "text": L(
            "With Lightning Dust, each blast releases a discharge.",
            "装填雷电尘晶时，每次射击都会释放一道电击。",
            "裝填雷電塵晶時，每次射擊都會釋放一道電擊。",
            "Mit Blitzstaub löst jeder Schuss eine Entladung aus.",
            "Con Polvo de Relámpago, cada disparo libera una descarga.",
            "Avec la Poussière de foudre, chaque tir libère une décharge.",
            "雷のダスト装填中、射撃のたびに放電する。",
            "라이트닝 더스트 장전 시 사격할 때마다 방전을 일으킨다.",
            "Com Pó de Raio, cada disparo libera uma descarga.",
            "С Грозовым прахом каждый выстрел высвобождает разряд.")},
        {"element": "gravity", "needs": (20731,), "move": ("rrb_petalburst",), "text": L(
            "With Gravity Dust, pulls enemies into the path.",
            "装填重力尘晶时，会将敌人吸引至路径上。",
            "裝填重力塵晶時，會將敵人吸引至路徑上。",
            "Mit Gravitationsstaub werden Gegner in die Bahn gezogen.",
            "Con Polvo Gravitatorio, atrae a los enemigos hacia la trayectoria.",
            "Avec la Poussière gravitationnelle, attire les ennemis sur la trajectoire.",
            "重力のダスト装填中、敵を経路上に引き寄せる。",
            "중력 더스트 장전 시 적을 경로로 끌어당긴다.",
            "Com Pó Gravitacional, puxa os inimigos para o caminho.",
            "С Гравитационным прахом притягивает врагов на траекторию.")},
    ],
    28: {"needs": (20732, 20722), "move": ("rrb_dustround",), "text": L(
        "Loading Dust also restores a [[c:gun_blast]].",
        "装填尘晶时，还会恢复1次[[c:gun_blast]]。",
        "裝填塵晶時，還會恢復1次[[c:gun_blast]]。",
        "Das Laden von Staub stellt außerdem einen [[c:gun_blast]] wieder her.",
        "Cargar Polvo también restaura un [[c:gun_blast]].",
        "Charger de la Poussière restaure aussi un [[c:gun_blast]].",
        "ダストを装填すると、[[c:gun_blast]]の使用回数も1回回復する。",
        "더스트를 장전하면 [[c:gun_blast]] 사용 횟수도 1회 회복된다.",
        "Carregar Pó também restaura um [[c:gun_blast]].",
        "Зарядка Праха также восстанавливает один [[c:gun_blast]].")},
    29: {"needs": (20719, 20721), "move": ("rrb_blast",), "text": L(   # the stock term from 110311
        "Airborne [[gun_blast]] also resets the attack limit for [[c:universal_air]].",
        "在空中使用[[gun_blast]]时，也会重置[[c:universal_air]]的段数限制计数。",
        "在空中使用[[gun_blast]]時，也會重置[[c:universal_air]]的段數次數限制。",
        "[[gun_blast]] in der Luft setzt auch das Angriffslimit für deine [[c:universal_air]] zurück.",
        "[[gun_blast]] en el aire también reinicia el límite de [[c:universal_air]].",
        "[[gun_blast]] dans les airs réinitialise aussi le nombre d'[[c:universal_air]] que tu peux lancer.",
        "空中の[[gun_blast]]でも[[c:universal_air]]の段数をリセットできる。",
        "공중에서 [[gun_blast]]를 사용해도 [[c:universal_air]]의 콤보 카운트가 초기화된다.",
        "[[gun_blast]] no ar também redefine o limite de ataque dos seus [[c:universal_air]].",
        "[[gun_blast]] в воздухе также обнуляет лимит атак для твоих [[c:universal_air]].")},
    30: {"needs": (20717, _SE), "move": ("rrb_redreaper",), "text": L(
        "Deals more damage to bosses.", "对Boss造成的伤害提升。", "對Boss造成的傷害提升。", "Bewirkt mehr Schaden gegen Bosse.",
        "Inflige más daño a los jefes.", "Inflige plus de dégâts aux boss.", "ボスに与えるダメージが増加する。",
        "보스에게 주는 대미지가 증가한다.", "Causa mais dano a chefes.", "Наносит больше урона боссам.")},
    31: {"needs": (20701, 20702, 20703), "move": ("rrb_a1",), "text": L(
        "Both strings can be followed by [[c:gun_blast]] at any strike.",
        "两套连击的任意一段攻击后都可衔接[[c:gun_blast]]。",
        "兩套連擊的任意一段攻擊後都可銜接[[c:gun_blast]]。",
        "Auf jeden Schlag beider Kombos kann [[c:gun_blast]] folgen.",
        "Ambas cadenas pueden continuarse con [[c:gun_blast]] en cualquier golpe.",
        "Les deux enchaînements peuvent être suivis de [[c:gun_blast]] à n'importe quel coup.",
        "両方の連撃のどの段からでも[[c:gun_blast]]に繋げられる。",
        "두 연격 모두 어느 공격에서든 [[c:gun_blast]]로 연계할 수 있다.",
        "Ambas as sequências podem ser seguidas por [[c:gun_blast]] em qualquer golpe.",
        "После любого удара обеих серий можно применить прием [[c:gun_blast]].")},
    32: {"needs": (20730, 20731, 20732), "move": ("rrb_dust",), "text": L(
        "Loading Dust releases a burst of that element around you.",
        "装填尘晶时，会在自身周围释放该属性的爆发。",
        "裝填塵晶時，會在自身周圍釋放該屬性的爆發。",
        "Das Laden von Staub löst um dich herum einen Ausbruch dieses Elements aus.",
        "Cargar Polvo libera una explosión de ese elemento a tu alrededor.",
        "Charger de la Poussière libère une explosion de cet élément autour de toi.",
        "ダストを装填すると、自身の周囲にその属性の爆発を起こす。",
        "더스트를 장전하면 자신의 주위에 해당 속성의 폭발을 일으킨다.",
        "Carregar Pó libera uma explosão desse elemento ao seu redor.",
        "Зарядка Праха вызывает вокруг тебя всплеск этой стихии.")},
    33: {"needs": (20733, 20735), "move": ("rrb_dust",), "text": L(
        "A spent Fire cartridge leaves a pool of flames.",
        "用完的火焰弹壳会留下一片火海。",
        "用完的火焰彈殼會留下一片火海。",
        "Eine verbrauchte Feuerpatrone hinterlässt eine Flammenlache.",
        "Un cartucho de Fuego gastado deja un charco de llamas.",
        "Une cartouche de feu vide laisse une flaque de flammes.",
        "使用済みの炎のカートリッジが炎の溜まりを残す。",
        "다 쓴 화염 카트리지가 불바다를 남긴다.",
        "Um cartucho de Fogo usado deixa uma poça de chamas.",
        "Отработанный огненный патрон оставляет лужу пламени.")},
    34: {"needs": (20733, 20736), "move": ("rrb_dust",), "text": L(
        "A spent Ice cartridge freezes enemies around it.",
        "用完的寒冰弹壳会冰冻周围的敌人。",
        "用完的寒冰彈殼會冰凍周圍的敵人。",
        "Eine verbrauchte Eispatrone friert Gegner in ihrer Nähe ein.",
        "Un cartucho de Hielo gastado congela a los enemigos cercanos.",
        "Une cartouche de glace vide gèle les ennemis autour d'elle.",
        "使用済みの氷のカートリッジが周囲の敵を凍結させる。",
        "다 쓴 빙결 카트리지가 주위의 적을 동결시킨다.",
        "Um cartucho de Gelo usado congela os inimigos ao redor.",
        "Отработанный ледяной патрон замораживает врагов вокруг.")},
    35: {"needs": (20734, 20737), "move": ("rrb_blast",), "text": L(
        "With Lightning Dust combined with another Dust, each blast also carries the other element.",
        "雷电尘晶与另一种尘晶同时生效时，每次射击也会附带另一种属性。",
        "雷電塵晶與另一種塵晶同時生效時，每次射擊也會附帶另一種屬性。",
        "Wirkt Blitzstaub zusammen mit einem anderen Staub, trägt jeder Schuss auch das andere Element.",
        "Con Polvo de Relámpago combinado con otro Polvo, cada disparo también lleva el otro elemento.",
        "Quand la Poussière de foudre est combinée à une autre Poussière, chaque tir porte aussi l'autre élément.",
        "雷のダストが別のダストと組み合わさっている間、射撃のたびにもう一方の属性も帯びる。",
        "라이트닝 더스트가 다른 더스트와 함께 적용 중일 때, 사격마다 다른 속성도 함께 띤다.",
        "Com Pó de Raio combinado com outro Pó, cada disparo também carrega o outro elemento.",
        "Когда Грозовой прах сочетается с другим Прахом, каждый выстрел несет и другую стихию.")},
    36: {"needs": (20738, 20715), "move": ("rrb_petalburst",), "text": L(
        "With Gravity Dust, drags every enemy on the path along to the end of the dash.",
        "装填重力尘晶时，会将路径上的所有敌人一起拖至冲刺终点。",
        "裝填重力塵晶時，會將路徑上的所有敵人一起拖至衝刺終點。",
        "Mit Gravitationsstaub werden alle Gegner auf der Bahn bis zum Ende des Sprints mitgerissen.",
        "Con Polvo Gravitatorio, arrastra a todos los enemigos de la trayectoria hasta el final del acelerón.",
        "Avec la Poussière gravitationnelle, entraîne tous les ennemis sur la trajectoire jusqu'à la fin de la ruée.",
        "重力のダスト装填中、経路上のすべての敵をダッシュの終点まで引きずっていく。",
        "중력 더스트 장전 시 경로상의 모든 적을 대시 종료 지점까지 끌고 간다.",
        "Com Pó Gravitacional, arrasta todos os inimigos no caminho até o fim do avanço.",
        "С Гравитационным прахом увлекает всех врагов на пути до конца рывка.")},
    37: {"needs": (20735, 20723), "move": ("rrb_rifleshot",), "text": L(
        "With Fire Dust, enhanced by [[c:gun_blast]]: fires an incendiary round that explodes.",
        "装填火焰尘晶并受[[c:gun_blast]]强化时：发射会爆炸的燃烧弹。",
        "裝填火焰塵晶並受[[c:gun_blast]]強化時：發射會爆炸的燃燒彈。",
        "Mit Feuerstaub, durch [[c:gun_blast]] verstärkt: Feuert eine Brandkugel ab, die explodiert.",
        "Con Polvo de Fuego y potenciado por [[c:gun_blast]]: dispara una bala incendiaria que explota.",
        "Avec la Poussière de feu, renforcé par [[c:gun_blast]] : tire une balle incendiaire qui explose.",
        "炎のダスト装填中に[[c:gun_blast]]で強化されている時：爆発する焼夷弾を発射する。",
        "화염 더스트 장전 중 [[c:gun_blast]] 강화 버전: 폭발하는 소이탄을 발사한다.",
        "Com Pó de Fogo, aprimorado por [[c:gun_blast]]: dispara uma bala incendiária que explode.",
        "С Огненным прахом при усилении приемом [[c:gun_blast]]: выпускает взрывающуюся зажигательную пулю.")},
    38: {"needs": (20736, 20720), "move": ("rrb_buzzsaw",), "text": L(
        "With Ice Dust, the landing shot leaves a ring of ice spikes.",
        "装填寒冰尘晶时，落地射击会留下一圈冰刺。",
        "裝填寒冰塵晶時，落地射擊會留下一圈冰刺。",
        "Mit Eisstaub hinterlässt der Landeschuss einen Ring aus Eisstacheln.",
        "Con Polvo de Hielo, el disparo al aterrizar deja un anillo de púas de hielo.",
        "Avec la Poussière de glace, le tir à l'atterrissage laisse un anneau de pics de glace.",
        "氷のダスト装填中、着地時の射撃が氷の棘の輪を残す。",
        "빙결 더스트 장전 시 착지 사격이 얼음 가시 고리를 남긴다.",
        "Com Pó de Gelo, o disparo ao aterrissar deixa um anel de espinhos de gelo.",
        "С Ледяным прахом выстрел при приземлении оставляет кольцо ледяных шипов.")},
    39: {"needs": (20703, _SEM), "move": ("rrb_a1",), "text": L(
        "The final strike whips up a gust of rose petals that draws nearby enemies in and damages them.",
        "最后一段攻击会掀起玫瑰花瓣之风，将附近的敌人卷过来并造成伤害。",
        "最後一段攻擊會掀起玫瑰花瓣之風，將附近的敵人捲過來並造成傷害。",
        "Der letzte Schlag entfacht einen Wind aus Rosenblättern, der Gegner in der Nähe heranzieht und ihnen Schaden zufügt.",
        "El golpe final levanta una ráfaga de pétalos de rosa que atrae a los enemigos cercanos y les inflige daño.",
        "Le dernier coup soulève une rafale de pétales de rose qui attire les ennemis proches et leur inflige des dégâts.",
        "最終段がバラの花びらの風を巻き起こし、近くの敵を引き寄せてダメージを与える。",
        "마지막 공격이 장미 꽃잎 바람을 일으켜 주위의 적을 끌어당기고 대미지를 준다.",
        "O golpe final levanta uma rajada de pétalas de rosa que puxa os inimigos próximos e causa dano a eles.",
        "Финальный удар поднимает вихрь лепестков роз, который притягивает ближайших врагов и наносит им урон.")},
}


# ---------------------------------------------------------------- 3. move list (ActorActionConf Type 1): KIT_V2 §3, §4, §5
# key -> id, parent (sub-row of that move, or None), potential (the card that adds it; its text is shared with the card),
# name / input / desc. Sub-rows carry a name too; stock often leaves sub-row names empty, so the builder may drop them.
def _card(pid, **kw):
    p = POTENTIAL_TEXT[pid]
    d = {"name": p["name"], "input": p.get("input", ""), "desc": p["desc"], "potential": pid}
    d.update(kw)
    return d

_FWD_BLAST = L(
    "Fires behind and dashes forward through enemies as rose petals.",
    "向身后开枪，化作玫瑰花瓣向前穿过敌人。",
    "向身後開槍，化作玫瑰花瓣向前穿過敵人。",
    "Feuert nach hinten und sprintet als Rosenblätter durch Gegner nach vorn.",
    "Dispara hacia atrás y se lanza hacia delante atravesando a los enemigos como pétalos de rosa.",
    "Tire vers l'arrière et fonce vers l'avant à travers les ennemis sous forme de pétales de rose.",
    "後方に発砲し、バラの花びらとなって前方の敵を突き抜ける。",
    "뒤쪽으로 사격하고 장미 꽃잎이 되어 앞쪽의 적을 관통한다.",
    "Dispara para trás e avança através dos inimigos como pétalas de rosa.",
    "Стреляет назад и проносится вперед сквозь врагов в виде лепестков роз.")

MOVE_TEXT = {
    # -- Attack string (base) and its branches
    "rrb_a1": {"id": 130610, "parent": None, "name": "[[attack]]", "input": G("<action=Attack>"), "desc": L(
        "A scythe combo that attacks 4 times. The third strike hits several times, and the last knocks the enemy away.",
        "镰刀连击，共4段。第3段为多段攻击，最后一段会将敌人击飞。",
        "鐮刀連擊，共4段。第3段為多段攻擊，最後一段會將敵人擊飛。",
        "Eine Sensenkombo, die viermal trifft. Der dritte Schlag trifft mehrfach, der letzte stößt den Gegner weg.",
        "Un combo de guadaña que ataca hasta 4 veces. El tercer golpe impacta varias veces y el último repele al enemigo.",
        "Enchaînement de faux qui attaque 4 fois. Le troisième coup frappe plusieurs fois et le dernier repousse l'ennemi.",
        "大鎌による連撃、全4段。3段目は多段攻撃で、最終段は敵を吹き飛ばす。",
        "낫 연격, 총 4단. 3번째 공격은 다단 공격이며, 마지막 공격은 적을 날려 보낸다.",
        "Um combo de foice que ataca 4 vezes. O terceiro golpe acerta várias vezes, e o último repele o inimigo.",
        "Комбо из 4 ударов косой. Третий удар попадает несколько раз, а последний отбрасывает врага.")},
    "rrb_5b": dict(_card(20702), id=130611, parent="rrb_a1"),                                   # NEW id (Scythe Chain, 5B -> 5BB)
    "rrb_launcher": {"id": 130620, "parent": None, "potential": 20742, "name": "[[rising_reap]]", "input": G("<action=MoveY+>+<action=Attack>"), "desc": L(
        "Sweeps the scythe upward to launch enemies. Can also be used from any strike of [[c:attack]], and can be followed by a jump.",
        "向上挥动镰刀将敌人挑飞。也可在[[c:attack]]的任意一段后使用，并可衔接跳跃。",
        "向上揮動鐮刀將敵人挑飛。也可在[[c:attack]]的任意一段後使用，並可銜接跳躍。",
        "Schwingt die Sense nach oben und schleudert Gegner in die Luft. Kann auch nach jedem Schlag von [[c:attack]] eingesetzt werden, und du kannst einen Sprung folgen lassen.",
        "Barre hacia arriba con la guadaña y lanza a los enemigos por los aires. También se puede usar desde cualquier golpe de [[c:attack]] y puede continuarse con un salto.",
        "Balaie vers le haut avec la faux pour projeter les ennemis en l'air. Peut aussi être utilisé après n'importe quel coup d'[[c:attack]] et enchaîné avec un saut.",
        "大鎌を振り上げて敵を打ち上げる。[[c:attack]]のどの段からでも使用でき、ジャンプに繋げられる。",
        "낫을 위로 휘둘러 적을 띄운다. [[c:attack]]의 어느 공격 후에도 사용할 수 있으며, 점프로 연계할 수 있다.",
        "Golpeia com a foice para cima, lançando inimigos ao ar. Também pode ser usado a partir de qualquer golpe de [[c:attack]] e seguido por um salto.",
        "Взмахивает косой вверх, подбрасывая врагов. Можно применить и после любого удара приема [[c:attack]], а затем совершить прыжок.")},
    "rrb_sweep": {"id": 130630, "parent": None, "name": "[[low_sweep]]", "input": G("<action=MoveY->+<action=Attack>"), "desc": L(
        "A low scythe sweep that pops enemies up. Can be followed by [[c:gun_blast]].",
        "低位横扫镰刀，将敌人挑起。可衔接[[c:gun_blast]]。",
        "低位橫掃鐮刀，將敵人挑起。可銜接[[c:gun_blast]]。",
        "Ein tiefer Sensenfeger, der Gegner hochhebelt. Du kannst [[c:gun_blast]] folgen lassen.",
        "Un barrido bajo de guadaña que eleva a los enemigos. Puede continuarse con [[c:gun_blast]].",
        "Un balayage bas de la faux qui soulève les ennemis. Peut être enchaîné avec [[c:gun_blast]].",
        "低い姿勢から大鎌で薙ぎ払い、敵を浮かせる。[[c:gun_blast]]に繋げられる。",
        "낮게 낫을 휘둘러 적을 띄워 올린다. [[c:gun_blast]]로 연계할 수 있다.",
        "Uma varredura baixa de foice que ergue os inimigos. Pode ser seguida por [[c:gun_blast]].",
        "Низкий взмах косой, подбрасывающий врагов. После него можно применить прием [[c:gun_blast]].")},
    "rrb_2b": dict(_card(20708), id=130631, parent="rrb_sweep"),                              # NEW id (Rising Crescent, 2B)
    "rrb_clash": {"id": 130640, "parent": None, "name": "[[clash_assault]]", "input": G(H("<action=Attack>")), "desc": L(
        "Bounds forward and fires a heavy round downward, striking everything in her path.",
        "向前跃出，向下射出一发重弹，击中前进路线上的所有敌人。",
        "向前躍出，向下射出一發重彈，擊中前進路線上的所有敵人。",
        "Springt nach vorn und feuert eine schwere Kugel nach unten, die alles auf ihrem Weg trifft.",
        "Salta hacia delante y dispara una bala pesada hacia abajo que golpea todo a su paso.",
        "Bondit en avant et tire une lourde balle vers le bas, qui frappe tout sur son passage.",
        "前方へ跳び、下方へ重い弾丸を撃ち込む。進路上の敵すべてに命中する。",
        "앞으로 도약해 아래로 묵직한 탄환을 발사하며, 진로상의 모든 적을 공격한다.",
        "Salta para a frente e dispara uma bala pesada para baixo, atingindo tudo em seu caminho.",
        "Рывком прыгает вперёд и стреляет тяжёлым патроном вниз, поражая всех на пути.")},
    "rrb_clash_chase": {"id": 130641, "parent": "rrb_clash", "name": "[[clash_chase]]", "input": G(H("<action=Attack>")), "desc": L(   # NEW id
        "On a grounded hit, chases the enemy with two slashes and ends with a finishing spin.",
        "命中地面上的敌人时，会以两记斩击追击，并以终结回旋收尾。",
        "命中地面上的敵人時，會以兩記斬擊追擊，並以終結迴旋收尾。",
        "Trifft der Schlag einen Gegner am Boden, setzt du ihm mit zwei Hieben nach und schließt mit einer abschließenden Drehung ab.",
        "Al impactar a un enemigo en el suelo, lo persigue con dos tajos y termina con un giro final.",
        "Si le coup touche un ennemi au sol, le poursuit avec deux taillades et termine par une rotation finale.",
        "地上の敵にヒットすると、2回の斬撃で追撃し、とどめの回転斬りで締めくくる。",
        "지상의 적에게 적중하면 2회 베기로 추격하고, 마무리 회전 베기로 끝낸다.",
        "Ao acertar um inimigo no chão, persegue-o com dois cortes e termina com um giro final.",
        "При попадании по врагу на земле преследует его двумя режущими ударами и завершает добивающим вращением.")},
    "rrb_corkscrew": {"id": 130650, "parent": None, "name": "[[corkscrew]]", "input": G(S("<action=Dash>", "<action=Attack>")), "desc": L(
        "A spinning slash in place with a short carry.",
        "原地旋转斩击，伴随少量位移。",
        "原地旋轉斬擊，伴隨少量位移。",
        "Ein wirbelnder Hieb auf der Stelle mit kurzer Vorwärtsbewegung.",
        "Un tajo giratorio en el sitio con un breve avance.",
        "Taillade tournoyante sur place avec un léger déplacement.",
        "その場で回転斬りを放ち、わずかに前進する。",
        "제자리에서 회전 베기를 펼치며 조금 전진한다.",
        "Um corte giratório no lugar com um pequeno avanço.",
        "Вращающийся режущий удар на месте с небольшим смещением.")},
    # -- air (stock: the air string row inherits Jump, build_ruby.ROOT_PARENT)
    "rrb_ja": {"id": 130660, "parent": "rrb_jump", "name": "[[airborne_attack]]", "input": A("<action=Attack>"), "desc": L(
        "Three strikes in the air. The third fires three rounds down and ahead, and the last one knocks enemies down.",
        "空中三段攻击。第3段向斜下方连射3发子弹，最后一发可将敌人击倒。",
        "空中三段攻擊。第3段向斜下方連射3發子彈，最後一發可將敵人擊倒。",
        "Drei Schläge in der Luft. Der dritte feuert drei Kugeln schräg nach unten, und die letzte wirft Gegner nieder.",
        "Tres golpes en el aire. El tercero dispara tres balas en diagonal hacia abajo, y la última derriba a los enemigos.",
        "Trois coups dans les airs. Le troisième tire trois balles en diagonale vers le bas, et la dernière renverse les ennemis.",
        "空中で3回攻撃する。3段目は斜め下に弾丸を3連射し、最後の1発が敵をダウンさせる。",
        "공중에서 3회 공격한다. 3번째 공격은 대각선 아래로 탄환을 3연사하며, 마지막 한 발이 적을 쓰러뜨린다.",
        "Três golpes no ar. O terceiro dispara três balas na diagonal para baixo, e a última derruba os inimigos.",
        "Три удара в воздухе. Третий выпускает три пули по диагонали вниз, и последняя сбивает врагов с ног.")},
    "rrb_j2a": {"id": 130661, "parent": "rrb_ja", "potential": 20708, "name": "[[double_kick]]", "input": A("<action=MoveY->+<action=Attack>"), "desc": L(   # NEW id
        "A quick double kick in the air.",
        "空中快速二连踢。",
        "空中快速二連踢。",
        "Ein schneller Doppeltritt in der Luft.",
        "Una rápida doble patada en el aire.",
        "Un double coup de pied rapide dans les airs.",
        "空中で素早く2回蹴る。",
        "공중에서 빠르게 2회 발차기를 한다.",
        "Um chute duplo rápido no ar.",
        "Быстрый двойной удар ногой в воздухе.")},
    # -- Skills
    "rrb_rifleshot": {"id": 130670, "parent": None, "name": "[[rifle_shot]]", "input": G("<action=Skill>"), "desc": L(
        "Fires a very fast rifle round with recoil.",
        "发射一发极快的步枪子弹，伴随后坐力。",
        "發射一發極快的步槍子彈，伴隨後座力。",
        "Feuert eine sehr schnelle Gewehrkugel mit Rückstoß ab.",
        "Dispara una bala de rifle muy rápida con retroceso.",
        "Tire une balle de fusil très rapide avec du recul.",
        "反動を伴う超高速のライフル弾を発射する。",
        "반동과 함께 매우 빠른 라이플 탄환을 발사한다.",
        "Dispara uma bala de rifle muito rápida com recuo.",
        "Выпускает очень быструю винтовочную пулю с отдачей.")},
    "rrb_sypod": {"id": 130690, "parent": None, "name": "[[sypod]]", "input": G(H("<action=Skill>")), "desc": L(
        "Plants the rifle, hitting enemies above, then fires a heavy round. Keep <action=Skill> held to keep firing; each further round costs MP.",
        "架起步枪，架枪动作可攻击上方的敌人，随后发射一发重型子弹。持续按住<action=Skill>可继续射击，每发追加子弹消耗MP。",
        "架起步槍，架槍動作可攻擊上方的敵人，隨後發射一發重型子彈。持續按住<action=Skill>可繼續射擊，每發追加子彈消耗MP。",
        "Stellt das Gewehr auf, trifft dabei Gegner über dir und feuert dann eine schwere Kugel ab. Halte <action=Skill> weiter gedrückt, um weiterzufeuern; jede weitere Kugel kostet MP.",
        "Apoya el rifle, golpeando a los enemigos de arriba, y luego dispara una bala pesada. Mantén pulsado <action=Skill> para seguir disparando; cada bala adicional cuesta PM.",
        "Plante le fusil, ce qui touche les ennemis au-dessus, puis tire une balle lourde. Garde <action=Skill> maintenu pour continuer à tirer ; chaque balle supplémentaire coûte des PM.",
        "ライフルを突き立てる動作で上方の敵を攻撃し、重い弾丸を1発発射する。<action=Skill>を押し続けると撃ち続け、追加の1発ごとにMPを消費する。",
        "라이플을 세우는 동작으로 위쪽의 적을 공격한 뒤, 묵직한 탄환을 1발 발사한다. <action=Skill>을 계속 누르고 있으면 계속 발사하며, 추가 탄환마다 MP를 소모한다.",
        "Finca o rifle, atingindo inimigos acima, e dispara uma bala pesada. Mantenha <action=Skill> pressionado para continuar atirando; cada bala adicional custa PM.",
        "Устанавливает винтовку, поражая врагов сверху, затем выпускает тяжелую пулю. Удерживай <action=Skill>, чтобы стрелять дальше; каждая следующая пуля расходует ОД.")},
    "rrb_guillotine": {"id": 130680, "parent": None, "name": "[[guillotine]]", "input": G("<action=MoveY+>+<action=Skill>"), "desc": L(
        "A multi-hit vertical scythe spin charged with energy, ending in the air.",
        "注入能量的镰刀纵向回旋，造成多段伤害，最后停留在空中。",
        "注入能量的鐮刀縱向迴旋，造成多段傷害，最後停留在空中。",
        "Eine mehrfach treffende, energiegeladene vertikale Sensendrehung, die in der Luft endet.",
        "Un giro vertical de guadaña cargado de energía que golpea varias veces y termina en el aire.",
        "Une rotation verticale de la faux chargée d'énergie, qui frappe plusieurs fois et se termine dans les airs.",
        "エネルギーを纏った大鎌で縦に回転する多段攻撃。空中で終わる。",
        "에너지를 두른 낫으로 세로 회전하는 다단 공격. 공중에서 끝난다.",
        "Um giro vertical de foice carregado de energia que acerta várias vezes e termina no ar.",
        "Многоударное вертикальное вращение косы, заряженное энергией, которое завершается в воздухе.")},
    "rrb_throw": dict(_card(20712), id=130770, parent=None),                                  # NEW id (Reaper's Hook, a root)
    # 0.9.0: the air Skill. NEW id
    "rrb_recoilshot": {"id": 130780, "parent": None, "name": "[[recoil_shot]]", "input": A("<action=Skill>"), "desc": L(
        "Fires a rifle round forward; the recoil carries her back and holds her in the air. Can be repeated while MP lasts.",
        "向前方射出一发步枪弹，后坐力使她后退并滞空。只要MP足够即可连续使用。",
        "向前方射出一發步槍彈，後座力使她後退並滯空。只要MP足夠即可連續使用。",
        "Feuert eine Gewehrkugel nach vorn; der Rückstoß trägt sie zurück und hält sie in der Luft. Wiederholbar, solange die MP reichen.",
        "Dispara una bala de rifle hacia delante; el retroceso la lleva hacia atrás y la mantiene en el aire. Se puede repetir mientras quede MP.",
        "Tire une balle de fusil vers l'avant ; le recul la porte en arrière et la maintient en l'air. Peut être répété tant qu'il reste des MP.",
        "前方にライフル弾を撃ち、反動で後退しつつ滞空する。MPが続く限り繰り返し使用できる。",
        "앞쪽으로 라이플 탄을 쏘고, 반동으로 뒤로 물러나며 체공한다. MP가 남아 있는 한 반복해서 사용할 수 있다.",
        "Dispara uma bala de rifle para frente; o recuo a leva para trás e a mantém no ar. Pode ser repetido enquanto houver MP.",
        "Стреляет винтовочной пулей вперед; отдача относит ее назад и удерживает в воздухе. Можно повторять, пока хватает MP.")},
    # (0.9.0: on air Down + Skill, with its own card, 20743; the air Skill is the Recoil Shot)
    "rrb_buzzsaw": {"id": 130700, "parent": None, "potential": 20743, "name": "[[buzzsaw]]", "input": A("<action=MoveY->+<action=Skill>"), "desc": L(
        "Dives in a spinning buzzsaw. Hold Down to drop faster, or Up to rise a little before the dive. The landing shot sends enemies flying.",
        "化作旋转的圆锯俯冲。长按下方向可更快下坠，长按上方向则先小幅上升再俯冲。落地射击会将敌人击飞。",
        "化作旋轉的圓鋸俯衝。長按下方向可更快下墜，長按上方向則先小幅上升再俯衝。落地射擊會將敵人擊飛。",
        "Stürzt als wirbelnde Kreissäge herab. Halte nach unten, um schneller zu fallen, oder nach oben, um vor dem Sturz kurz aufzusteigen. Der Landeschuss schleudert Gegner davon.",
        "Se lanza en picado como una sierra giratoria. Mantén pulsado hacia abajo para caer más rápido, o hacia arriba para elevarte un poco antes del picado. El disparo al aterrizar lanza lejos a los enemigos.",
        "Plonge comme une scie circulaire tournoyante. Maintiens la direction bas pour tomber plus vite, ou haut pour monter un peu avant le plongeon. Le tir à l'atterrissage projette les ennemis au loin.",
        "回転する丸ノコとなって急降下する。下方向を長押しするとより速く落下し、上方向を長押しすると少し上昇してから降下する。着地時の射撃で敵を吹き飛ばす。",
        "회전하는 원형 톱이 되어 급강하한다. 아래쪽 방향을 길게 누르면 더 빠르게 낙하하고, 위쪽 방향을 길게 누르면 살짝 상승한 뒤 강하한다. 착지 사격이 적을 날려 보낸다.",
        "Mergulha como uma serra giratória. Segure para baixo para cair mais rápido, ou para cima para subir um pouco antes do mergulho. O disparo ao aterrissar arremessa os inimigos para longe.",
        "Пикирует вращающейся циркулярной пилой. Удерживай направление вниз, чтобы падать быстрее, или вверх, чтобы немного подняться перед пикированием. Выстрел при приземлении отбрасывает врагов далеко.")},
    "rrb_buzzsaw_ex": dict(_card(20720), id=130701, parent="rrb_buzzsaw", name="[[buzzsaw_ex]]"),   # NEW id (j.236C)
    # -- Gun Blast v3 (§4): the root and the six blasts. Ground Down + Dash is the backward blast (214A; decided
    # 2026-09-29, V2_COVERAGE C2); the air has no back-blast input (C3 open), so there is no row for it.
    "rrb_blast": {"id": 130740, "parent": None, "name": "[[gun_blast]]", "input": "<action=Dash>", "desc": L(
        "Fires one way and rides the recoil the other. In the air, it comes back on landing.",
        "向一个方向开枪，并借后坐力向反方向移动。空中使用后，落地即可再次使用。",
        "向一個方向開槍，並借後座力向反方向移動。空中使用後，落地即可再次使用。",
        "Feuert in eine Richtung und lässt sich vom Rückstoß in die andere tragen. In der Luft ist er nach der Landung wieder verfügbar.",
        "Dispara en una dirección y aprovecha el retroceso para desplazarse en la contraria. En el aire, vuelve a estar disponible al aterrizar.",
        "Tire dans une direction et se laisse porter par le recul dans l'autre. Dans les airs, il redevient disponible à l'atterrissage.",
        "一方向に発砲し、その反動で逆方向へ移動する。空中で使うと、着地するまで再使用できない。",
        "한 방향으로 사격하고, 그 반동으로 반대 방향으로 이동한다. 공중에서 사용하면 착지해야 다시 사용할 수 있다.",
        "Dispara em uma direção e usa o recuo para se mover na outra. No ar, volta a ficar disponível ao aterrissar.",
        "Стреляет в одну сторону и перемещается отдачей в другую. В воздухе снова доступен после приземления.")},
    "rrb_blast_fwd": {"id": 130741, "parent": "rrb_blast", "name": "[[gun_blast]]", "input": G("<action=Dash>"), "desc": _FWD_BLAST},        # NEW id (214B)
    "rrb_blast_air_fwd": {"id": 130742, "parent": "rrb_blast", "name": "[[gun_blast]]", "input": A("<action=Dash>"), "desc": _FWD_BLAST},    # NEW id (j.214B)
    "rrb_blast_back": {"id": 130743, "parent": "rrb_blast", "name": "[[gun_blast]]", "input": G("<action=MoveY->+<action=Dash>"), "desc": L(   # NEW id (214A / j.214A: ground and air, the lead 2026-09-29)
        "Fires forward and flies backward on the recoil.",
        "向前方开枪，借后坐力向后飞退。",
        "向前方開槍，借後座力向後飛退。",
        "Feuert nach vorn und fliegt durch den Rückstoß nach hinten.",
        "Dispara hacia delante y se desplaza hacia atrás con el retroceso.",
        "Tire vers l'avant et s'envole vers l'arrière grâce au recul.",
        "前方に発砲し、反動で後方へ飛び退く。",
        "앞쪽으로 사격하고 반동으로 뒤로 날아간다.",
        "Dispara para frente e voa para trás com o recuo.",
        "Стреляет вперед и отлетает назад за счет отдачи.")},
    "rrb_blast_up": {"id": 130744, "parent": "rrb_blast", "name": "[[gun_blast]]", "input": G("<action=MoveY+>+<action=Dash>"), "desc": L(   # NEW id (214C)
        "Fires down behind and rises diagonally forward.",
        "向后下方开枪，斜向前上方升起。",
        "向後下方開槍，斜向前上方升起。",
        "Feuert schräg nach hinten unten und steigt diagonal nach vorn auf.",
        "Dispara hacia abajo y atrás y se eleva en diagonal hacia delante.",
        "Tire vers le bas et l'arrière, puis s'élève en diagonale vers l'avant.",
        "後方下に発砲し、斜め前方に上昇する。",
        "뒤쪽 아래로 사격하고 대각선 앞쪽으로 상승한다.",
        "Dispara para baixo e para trás e sobe na diagonal para frente.",
        "Стреляет вниз и назад и поднимается по диагонали вперед.")},
    "rrb_blast_air_up": {"id": 130745, "parent": "rrb_blast", "name": "[[gun_blast]]", "input": A("<action=MoveY+>+<action=Dash>"), "desc": L(   # NEW id (her own addition)
        "Fires straight down and rises.",
        "向正下方开枪并升起。",
        "向正下方開槍並升起。",
        "Feuert senkrecht nach unten und steigt auf.",
        "Dispara hacia abajo y se eleva.",
        "Tire droit vers le bas et s'élève.",
        "真下に発砲して上昇する。",
        "바로 아래로 사격하고 상승한다.",
        "Dispara para baixo e sobe.",
        "Стреляет вниз и поднимается.")},
    "rrb_blast_down": {"id": 130746, "parent": "rrb_blast", "name": "[[gun_blast]]", "input": A("<action=MoveY->+<action=Dash>"), "desc": L(   # j.214C (air Forward + Dash: the lead 2026-09-30)
        "Fires up and behind, then drops diagonally forward and lands at once.",
        "向后上方开枪，随后斜向前方落下并立即着地。",
        "向後上方開槍，隨後斜向前方落下並立即著地。",
        "Feuert schräg nach hinten oben, stürzt dann diagonal nach vorn und landet sofort.",
        "Dispara hacia arriba y atrás, luego cae en diagonal hacia delante y aterriza al instante.",
        "Tire vers le haut et l'arrière, puis plonge en diagonale vers l'avant et atterrit aussitôt.",
        "後ろ上方へ発砲し、斜め前方へ降下してすぐに着地する。",
        "뒤쪽 위로 사격한 뒤 대각선 앞으로 낙하해 곧바로 착지한다.",
        "Dispara para cima e para trás, depois desce na diagonal para a frente e aterrissa na hora.",
        "Стреляет вверх и назад, затем падает по диагонали вперёд и сразу приземляется.")},
    "rrb_dust": {"id": 130760, "parent": None, "name": "[[dust]]", "input": SUMMON, "desc": L(   # NEW id
        "Reloads with a Dust cartridge: for 10 seconds, attacks carry its element. Costs 25 SP. The equipped Summoning Tactic still triggers. SP is gained when [[c:gun_blast]] hits an enemy.",
        "装填尘晶弹药：10秒内，攻击附带该属性。消耗25SP。已装备的召唤策略仍会触发。[[c:gun_blast]]命中敌人时获得SP。",
        "裝填塵晶彈藥：10秒內，攻擊附帶該屬性。消耗25SP。已裝備的召喚策略仍會觸發。[[c:gun_blast]]命中敵人時獲得SP。",
        "Lädt eine Staubpatrone nach: 10 Sekunden lang tragen Angriffe ihr Element. Kostet 25 SP. Die ausgerüstete Beschwörungstaktik wird weiterhin ausgelöst. SP erhältst du, wenn [[c:gun_blast]] einen Gegner trifft.",
        "Recarga con un cartucho de Polvo: durante 10 segundos, los ataques llevan su elemento. Cuesta 25 PE. La táctica de invocación equipada se sigue activando. Los PE se obtienen cuando [[c:gun_blast]] golpea a un enemigo.",
        "Recharge avec une cartouche de Poussière : pendant 10 s, les attaques portent son élément. Coûte 25 PS. La tactique d'invocation équipée se déclenche toujours. Tu gagnes des PS quand [[c:gun_blast]] touche un ennemi.",
        "ダストのカートリッジを装填する：10秒間、攻撃がその属性を帯びる。SPを25消費する。装備中の召喚戦術も発動する。SPは[[c:gun_blast]]が敵にヒットすると獲得する。",
        "더스트 카트리지를 장전한다: 10초간 공격이 해당 속성을 띤다. SP 25 소모. 장착한 소환 전술도 발동한다. SP는 [[c:gun_blast]]를 적에게 적중시키면 얻는다.",
        "Recarrega com um cartucho de Pó: por 10 segundos, os ataques carregam seu elemento. Custa 25 PE. A Tática de Invocação equipada ainda é ativada. Você ganha PE quando [[c:gun_blast]] atinge um inimigo.",
        "Заряжает патрон Праха: в течение 10 секунд атаки несут его стихию. Стоит 25 ОЦ. Экипированная тактика призыва по-прежнему срабатывает. ОЦ ты получаешь, когда прием [[c:gun_blast]] попадает во врага.")},
    "rrb_dust_fire": {"id": 130761, "parent": "rrb_dust", "name": "[[fire_dust]]", "input": SUMMON, "desc": L(   # NEW id
        "Hits inflict Burn, which stacks.",
        "攻击命中时施加可叠加的燃烧。",
        "攻擊命中時施加可疊加的燃燒。",
        "Treffer belegen mit Verbrennung, die sich stapelt.",
        "Los golpes infligen Quemadura, que se acumula.",
        "Les coups infligent une Brûlure cumulable.",
        "ヒット時に累積するバーニングを付与する。",
        "적중 시 중첩되는 화상을 부여한다.",
        "Os golpes infligem Queimadura, que acumula.",
        "Попадания накладывают Горение, которое суммируется.")},
    "rrb_dust_ice": {"id": 130762, "parent": "rrb_dust", "name": "[[ice_dust]]", "input": "<action=MoveY+>+" + SUMMON, "desc": L(   # NEW id
        "Hits inflict Cold; the fifth stack leaves the enemy Frozen. Bosses only receive Cold.",
        "攻击命中时施加寒冷，叠加至第5层时使敌人冰冻。Boss仅会受到寒冷效果。",
        "攻擊命中時施加寒冷，疊加至第5層時使敵人冰凍。Boss僅會受到寒冷效果。",
        "Treffer belegen mit Kälte; ab der fünften Stapelung ist der Gegner eingefroren. Bosse erhalten nur Kälte.",
        "Los golpes infligen Frío; la quinta acumulación deja congelado al enemigo. Los jefes solo reciben Frío.",
        "Les coups infligent le Froid ; la cinquième accumulation gèle l'ennemi. Les boss ne subissent que le Froid.",
        "ヒット時にコールドを付与し、5層目で敵を凍結状態にする。ボスにはコールドのみ付与される。",
        "적중 시 한기를 부여하며, 5중첩 시 적을 동결 상태로 만든다. 보스에게는 한기만 부여된다.",
        "Os golpes infligem Frio; o quinto acúmulo deixa o inimigo Congelado. Chefes recebem apenas Frio.",
        "Попадания накладывают Холод; на пятом накоплении враг замораживается. Боссы получают только Холод.")},
    "rrb_dust_lightning": {"id": 130763, "parent": "rrb_dust", "name": "[[lightning_dust]]", "input": "<action=MoveY->+" + SUMMON, "desc": L(   # NEW id
        "Every third hit inflicts Paralysis.",
        "每第3次命中施加麻痹。",
        "每第3次命中施加麻痺。",
        "Jeder dritte Treffer belegt mit Lähmung.",
        "Cada tercer golpe inflige parálisis.",
        "Un coup sur trois inflige la paralysie.",
        "3回ヒットするごとに麻痺を付与する。",
        "3회 적중할 때마다 마비를 부여한다.",
        "A cada três golpes, inflige Paralisia.",
        "Каждое третье попадание накладывает паралич.")},
    "rrb_dust_gravity": {"id": 130764, "parent": "rrb_dust", "name": "[[gravity_dust]]", "input": H(SUMMON), "desc": L(   # NEW id (Umbra element); held Summon (2026-10-02)
        "Umbra hits pull enemies in, her rounds open a gravity well where they hit, and [[c:gun_blast]] chains once more.",
        "攻击附带暗属性，命中时牵引敌人；子弹命中处会打开重力井；[[c:gun_blast]]可多连续使用1次。",
        "攻擊附帶暗屬性，命中時牽引敵人；子彈命中處會打開重力井；[[c:gun_blast]]可多連續使用1次。",
        "Umbra-Treffer ziehen Gegner heran, ihre Kugeln öffnen am Einschlag einen Gravitationsschacht, und [[c:gun_blast]] kann einmal mehr verkettet werden.",
        "Los golpes de Umbra atraen a los enemigos, sus balas abren un pozo gravitatorio donde impactan, y [[c:gun_blast]] se puede encadenar una vez más.",
        "Les coups de Ténèbres attirent les ennemis, ses balles ouvrent un puits gravitationnel à l'impact, et [[c:gun_blast]] peut être enchaîné une fois de plus.",
        "闇属性のヒットが敵を引き寄せ、弾丸は着弾点に重力井戸を生み出す。[[c:gun_blast]]の連続使用回数が1回増える。",
        "어둠 속성 공격이 적을 끌어당기고, 탄환은 명중한 곳에 중력장을 연다. [[c:gun_blast]]의 연속 사용 횟수가 1회 늘어난다.",
        "Golpes de Umbra puxam os inimigos, suas balas abrem um poço gravitacional onde acertam, e [[c:gun_blast]] pode ser encadeado mais uma vez.",
        "Удары Тени притягивают врагов, ее пули создают гравитационный колодец в месте попадания, а прием [[c:gun_blast]] можно применить в цепочке еще один раз.")},
    "rrb_dustround": dict(_card(20732), id=130765, parent="rrb_dust"),                         # NEW id (Dust Round)
    # -- SP moves (§3): the Ultra's row is the card (Ragna's 5317 -> 11161 shape); "sp" is its second row
    "rrb_petalburst": dict(_card(20715), id=130710, parent=None, sp=POTENTIAL_TEXT[20715]["sp"]),   # input changes from 0.x's Up + Summon
    "rrb_redreaper": {"id": 130711, "parent": "rrb_petalburst", "name": "[[red_reaper]]", "input": "<action=Attack>+" + SUMMON, "desc": L(   # NEW id
        "Against a Staggered enemy or a boss, [[c:petal_burst]] becomes [[red_reaper]]: a moment of stillness, then a single crimson slash.",
        "对僵直的敌人或Boss使用[[c:petal_burst]]时，会变为[[red_reaper]]：一瞬的静止之后，挥出一记赤红的斩击。",
        "對僵直的敵人或Boss使用[[c:petal_burst]]時，會變為[[red_reaper]]：一瞬的靜止之後，揮出一記赤紅的斬擊。",
        "Gegen einen betäubten Gegner oder einen Boss wird [[c:petal_burst]] zu [[red_reaper]]: ein Moment der Stille, dann ein einziger purpurroter Hieb.",
        "Contra un enemigo aturdido o un jefe, [[c:petal_burst]] se convierte en [[red_reaper]]: un instante de quietud y luego un único tajo carmesí.",
        "Contre un ennemi étourdi ou un boss, [[c:petal_burst]] devient [[red_reaper]] : un instant d'immobilité, puis une unique taillade écarlate.",
        "硬直状態の敵またはボスに対して、[[c:petal_burst]]が[[red_reaper]]に変化する。一瞬の静寂の後、深紅の一閃を放つ。",
        "경직 상태의 적이나 보스에게 사용하면 [[c:petal_burst]]가 [[red_reaper]]로 변한다. 한순간의 정적 후 진홍색 일격을 날린다.",
        "Contra um inimigo atordoado ou um chefe, [[c:petal_burst]] se torna [[red_reaper]]: um instante de quietude e, então, um único corte carmesim.",
        "Против оглушенного врага или босса прием [[c:petal_burst]] превращается в Красного жнеца: миг неподвижности, затем единственный багровый удар.")},
    "rrb_petaldance": dict(_card(20716), id=130720, parent=None),                              # input changes from 0.x's Down + Summon
    # -- stock rows
    "rrb_jump": {"id": 130730, "parent": None, "name": "[[jump]]", "input": "<action=Jump>", "desc": STOCK_JUMP_DESC},
    "rrb_universal": {"id": 130750, "parent": None, "name": "[[universal]]", "input": "", "desc": STOCK_UNIVERSAL_DESC},
}


# ---------------------------------------------------------------- 4. talent, Dust, Legacy, character screen
# The buff is a clone of Ragna's 50491 (Skill and SP-move damage only), so the text says "Skill damage" in the words of
# his TriggerDesc_50491 and of TriggerDesc_83471 ("... your Skill damage is increased by X for Y sec.") in each language.
# 0.9.0: the cards that add Rising Reap and Buzzsaw Blast point at the move's own row (rrb_pots.UNLOCKS)
# 0.9.0, build 11: Gunswing (a tester's idea, 2026-10-07: "activating a skill during scythe attacks ... triggering an
# additional attack via a gunshot ... at the cost of extra MP"). Translations unverified. The 8 is rrb_pots.GSW["mp"]
POTENTIAL_TEXT[20744] = {"name": "[[gunswing]]", "input": S("<action=Attack>", "<action=Skill>"), "desc": L(
    "During a scythe attack, <action=Skill> fires a round from the muzzle without ending the attack. Each shot costs 8 MP.",
    "镰刀攻击期间按<action=Skill>，会从枪口射出一发子弹，且不中断攻击。每发消耗8点MP。",
    "鐮刀攻擊期間按<action=Skill>，會從槍口射出一發子彈，且不中斷攻擊。每發消耗8點MP。",
    "Während eines Sensenangriffs feuert <action=Skill> eine Kugel aus der Mündung, ohne den Angriff zu beenden. Jeder Schuss kostet 8 MP.",
    "Durante un ataque de guadaña, <action=Skill> dispara una bala desde la boca del arma sin interrumpir el ataque. Cada disparo cuesta 8 MP.",
    "Pendant une attaque de faux, <action=Skill> tire une balle depuis la bouche du canon sans interrompre l'attaque. Chaque tir coûte 8 MP.",
    "大鎌の攻撃中に<action=Skill>で、攻撃を止めずに銃口から弾丸を1発放つ。1発につきMPを8消費する。",
    "낫 공격 중 <action=Skill>을 누르면 공격을 끊지 않고 총구에서 탄환을 1발 발사한다. 1발당 MP를 8 소모한다.",
    "Durante um ataque de foice, <action=Skill> dispara uma bala pela boca da arma sem interromper o ataque. Cada disparo custa 8 MP.",
    "Во время атаки косой <action=Skill> выпускает пулю из дула, не прерывая атаку. Каждый выстрел стоит 8 MP.")}
POTENTIAL_TEXT[20742] = {"name": MOVE_TEXT["rrb_launcher"]["name"], "input": MOVE_TEXT["rrb_launcher"]["input"], "desc": MOVE_TEXT["rrb_launcher"]["desc"]}
POTENTIAL_TEXT[20743] = {"name": MOVE_TEXT["rrb_buzzsaw"]["name"], "input": MOVE_TEXT["rrb_buzzsaw"]["input"], "desc": MOVE_TEXT["rrb_buzzsaw"]["desc"]}
# hidden effect 40 (20722 + 20721; a tester, 2026-10-07: no delay between dashes "should be a Potential upgrade, ideally a secret one")
HIDDEN_TEXT[40] = {"needs": (20722, 20721), "move": ("rrb_blast",), "text": L(
    "Chained blasts fire with no pause between them.",
    "连续使用时不再有间隔。",
    "連續使用時不再有間隔。",
    "Verkettete Schüsse folgen ohne Pause aufeinander.",
    "Los disparos encadenados se suceden sin pausa.",
    "Les tirs enchaînés se succèdent sans pause.",
    "連続使用時の間隔がなくなる。",
    "연속 사용 시 간격이 사라진다.",
    "Os disparos encadeados se sucedem sem pausa.",
    "Выстрелы в цепочке следуют без паузы.")}
TALENT_TEXT = {"id": 50981, "name": "[[huntress_focus]]", "desc": L(   # TriggerName_ / TriggerDesc_50981 (build_ruby.TALENT_EFFECT)
    "After using a Legacy skill or a Summoning Tactic, Skill damage increases by 25% for 8 seconds. Loading Dust counts as a Summoning Tactic.",
    "使用传承技或召唤策略后，技能伤害提升25%，持续8秒。装填尘晶也视为使用召唤策略。",
    "使用傳承技或召喚策略後，技能傷害提升25%，持續8秒。裝填塵晶也視為使用召喚策略。",
    "Nach dem Einsatz einer Vermächtnisfertigkeit oder einer Beschwörungstaktik erhöht sich der Fertigkeitsschaden 8 Sekunden lang um 25 %. Das Laden von Staub zählt als Beschwörungstaktik.",
    "Tras usar una habilidad de Legado o una táctica de invocación, el daño de habilidad aumenta un 25 % durante 8 segundos. Cargar Polvo cuenta como una táctica de invocación.",
    "Après avoir utilisé une compétence héritée ou une tactique d'invocation, les dégâts des compétences augmentent de 25 % pendant 8 s. Charger de la Poussière compte comme une tactique d'invocation.",
    "継承固有スキルまたは召喚戦術の使用後、8秒間スキルダメージが25％上昇する。ダストの装填も召喚戦術の使用として扱われる。",
    "계승 고유 스킬 또는 소환 전술을 사용하면 8초간 스킬 대미지가 25% 증가한다. 더스트 장전도 소환 전술 사용으로 간주된다.",
    "Após usar uma Habilidade de Legado ou uma Tática de Invocação, o dano de Habilidades aumenta em 25% por 8 segundos. Carregar Pó conta como uma Tática de Invocação.",
    "После применения навыка наследия или тактики призыва урон, наносимый навыками, возрастает на 25% на 8 секунд. Зарядка Праха считается применением тактики призыва.")}

DUST_TEXT = {   # names and effect lines (the same dicts as the move-list rows); the HUD shows the loaded element's name
    "name": "[[dust]]",
    "elements": {el: {"name": MOVE_TEXT["rrb_dust_" + el]["name"], "desc": MOVE_TEXT["rrb_dust_" + el]["desc"]}
                 for el in ("fire", "ice", "lightning", "gravity")},
}

LEGACY_TEXT = {   # InheritSkill_ / InheritSkillDesc_ / InheritSkillDescUpgrade_<id> (build_ruby.LEGACY ids); replaces Rifle Volley / Rose Barrage
    2007011: {"order": 1, "name": "[[rifle_shot]]", "up": STOCK_LEVEL_UP, "desc": L(   # partner skill 6P
        "Fires a very fast rifle round straight ahead, dealing [[dmg]] damage.",
        "向正前方发射一发极快的步枪子弹，可造成[[dmg]]点伤害。",
        "向正前方發射一發極快的步槍子彈，可造成[[dmg]]點傷害。",
        "Feuert eine sehr schnelle Gewehrkugel geradeaus ab, die [[dmg]] Punkte Schaden bewirkt.",
        "Dispara al frente una bala de rifle muy rápida que inflige [[dmg]] de daño.",
        "Tire droit devant une balle de fusil très rapide qui inflige [[dmg]] points de dégâts.",
        "正面に超高速のライフル弾を発射し、[[dmg]]ポイントのダメージを与える。",
        "정면으로 매우 빠른 라이플 탄환을 발사해 [[dmg]] 포인트의 대미지를 준다.",
        "Dispara à frente uma bala de rifle muito rápida, causando [[dmg]] de dano.",
        "Выпускает прямо вперед очень быструю винтовочную пулю, нанося [[dmg]] ед. урона.")},
    2007012: {"order": 2, "name": "[[rose_lunge]]", "up": STOCK_LEVEL_UP, "desc": L(   # partner skill 5P
        "Lunges forward with the scythe, dealing [[dmg]] damage and launching enemies.",
        "挥舞镰刀向前突进，可造成[[dmg]]点伤害并将敌人挑飞。",
        "揮舞鐮刀向前突進，可造成[[dmg]]點傷害並將敵人挑飛。",
        "Stürmt mit der Sense vor, bewirkt [[dmg]] Punkte Schaden und schleudert Gegner in die Luft.",
        "Embiste con la guadaña, inflige [[dmg]] de daño y lanza a los enemigos por los aires.",
        "Bondit en avant avec la faux, inflige [[dmg]] points de dégâts et projette les ennemis en l'air.",
        "大鎌を構えて突進し、[[dmg]]ポイントのダメージを与え、敵を打ち上げる。",
        "낫을 들고 돌진해 [[dmg]] 포인트의 대미지를 주고 적을 띄운다.",
        "Avança com a foice, causando [[dmg]] de dano e lançando os inimigos ao ar.",
        "Совершает выпад косой, нанося [[dmg]] ед. урона и подбрасывая врагов.")},
}

# The skill summary (ActorSkillDesc_<actor>): the text on the character's detail page (PageActorBase), in two paragraphs
# joined by the stock <br> (Hakumen's ActorSkillDesc_101101).
# 1. What the Skill button does: tap / hold / Up / Down / in the air. Down + Skill is Reaper's Hook once card 20712 is held.
_SKILL_SUMMARY = L(
    "Fires a very fast rifle round. Hold <action=Skill> for [[c:sypod]]. With <action=MoveY+>, [[c:guillotine]]; with <action=MoveY->, [[c:sypod]], or [[c:reapers_hook]] once its Potential is held; in the air, [[c:recoil_shot]].",
    "发射一发极快的步枪子弹。长按<action=Skill>为[[c:sypod]]，配合<action=MoveY+>为[[c:guillotine]]，配合<action=MoveY->为[[c:sypod]]（持有对应潜能后为[[c:reapers_hook]]），在空中为[[c:recoil_shot]]。",
    "發射一發極快的步槍子彈。長按<action=Skill>為[[c:sypod]]，配合<action=MoveY+>為[[c:guillotine]]，配合<action=MoveY->為[[c:sypod]]（持有對應潛能後為[[c:reapers_hook]]），在空中為[[c:recoil_shot]]。",
    "Feuert eine sehr schnelle Gewehrkugel ab. Halte <action=Skill> für [[c:sypod]]. Mit <action=MoveY+> wird daraus [[c:guillotine]], mit <action=MoveY-> [[c:sypod]] oder, sobald du das zugehörige Potenzial besitzt, [[c:reapers_hook]], in der Luft [[c:recoil_shot]].",
    "Dispara una bala de rifle muy rápida. Mantén pulsado <action=Skill> para [[c:sypod]]. Con <action=MoveY+> se convierte en [[c:guillotine]]; con <action=MoveY->, en [[c:sypod]] o, cuando tengas su capacidad, en [[c:reapers_hook]]; en el aire, en [[c:recoil_shot]].",
    "Tire une balle de fusil très rapide. Maintiens <action=Skill> pour [[c:sypod]]. Avec <action=MoveY+>, devient [[c:guillotine]] ; avec <action=MoveY->, [[c:sypod]] ou, une fois son potentiel obtenu, [[c:reapers_hook]] ; dans les airs, [[c:recoil_shot]].",
    "超高速のライフル弾を発射する。<action=Skill>を長押しすると[[c:sypod]]、<action=MoveY+>で[[c:guillotine]]、<action=MoveY->で[[c:sypod]]（対応するポテンシャルの所持時は[[c:reapers_hook]]）、空中では[[c:recoil_shot]]になる。",
    "매우 빠른 라이플 탄환을 발사한다. <action=Skill>을 길게 누르면 [[c:sypod]], <action=MoveY+>와 함께 누르면 [[c:guillotine]], <action=MoveY->와 함께 누르면 [[c:sypod]](해당 포텐셜 보유 시 [[c:reapers_hook]]), 공중에서는 [[c:recoil_shot]]가 된다.",
    "Dispara uma bala de rifle muito rápida. Segure <action=Skill> para [[c:sypod]]. Com <action=MoveY+>, torna-se [[c:guillotine]]; com <action=MoveY->, [[c:sypod]] ou, quando você tiver o Potencial dele, [[c:reapers_hook]]; no ar, [[c:recoil_shot]].",
    "Выпускает очень быструю винтовочную пулю. Удерживай <action=Skill> — [[c:sypod]]. С <action=MoveY+> — прием [[c:guillotine]], с <action=MoveY-> — [[c:sypod]] или, когда получен его потенциал, [[c:reapers_hook]], в воздухе — [[c:recoil_shot]].")
# 2. The power stages (docs/cross-effect/POWER_STAGES.md): stage 2 at 4 Potentials (rrb_power.STAGE2; 8 until 2026-10-03); stage 3 at 24 Potentials plus the four
# Universal Enhancement cards (Rifle Shot then fires three rounds, Sy-Pod five). No other text mentions them. Stock puts a
# character's core mechanic in this key too (Platinum's ActorSkillDesc_101801).
# LENGTH: paragraph 1 alone is as long as the longest stock ActorSkillDesc (Platinum's); with paragraph 2 the text is about
# twice that in every language. Whether the detail page's box holds it is AWAITING a look in game. If it doesn't, set
# POWER_STAGES_IN_SKILL_DESC to False and give this paragraph a move-list row of its own (the stock shape of the
# "Universal Enhancement" row: a Type 1 row with a name, no input and this text).
POWER_STAGES_IN_SKILL_DESC = True
_POWER_STAGES = L(
    "Her power grows with her Potentials: with 4, her scythe attacks throw crescents and her moves reach further; with 24 and all four Universal Enhancements, they reach across the screen and her rifle fires bursts.",
    "她的力量随潜能数量成长：持有4个潜能时，镰刀攻击会放出新月斩击，招式的攻击距离增加；持有24个潜能及全部4个泛用强化时，招式可横穿屏幕，步枪射击变为连射。",
    "她的力量隨潛能數量成長：持有4個潛能時，鐮刀攻擊會放出新月斬擊，招式的攻擊距離增加；持有24個潛能及全部4個泛用強化時，招式可橫穿螢幕，步槍射擊變為連射。",
    "Ihre Kraft wächst mit ihren Potenzialen: Mit 4 schleudern ihre Sensenangriffe Halbmonde und ihre Moves reichen weiter; mit 24 und allen vier Universellen Verbesserungen reichen sie über den ganzen Bildschirm und ihr Gewehr feuert Salven.",
    "Su poder crece con sus capacidades: con 4, sus ataques de guadaña lanzan medias lunas y sus movimientos llegan más lejos; con 24 y las cuatro Mejoras Universales, cruzan la pantalla y su rifle dispara ráfagas.",
    "Sa puissance grandit avec ses potentiels : avec 4, ses attaques de faux projettent des croissants et ses actions portent plus loin ; avec 24 et les quatre améliorations universelles, elles traversent l'écran et son fusil tire en rafale.",
    "ポテンシャルの数に応じて力が増す：4個所持で鎌の攻撃が三日月の斬撃を飛ばし、技のリーチが伸びる。24個かつ汎用強化を4つすべて所持すると、技が画面を横切るほどになり、ライフルが連射になる。",
    "포텐셜의 수에 따라 힘이 강해진다: 4개를 보유하면 낫 공격이 초승달 참격을 날리고 기술의 사거리가 늘어난다. 24개와 범용 강화 4개를 모두 보유하면 기술이 화면을 가로지를 만큼 커지고 라이플은 연사로 발사된다.",
    "O poder dela cresce com seus Potenciais: com 4, os ataques de foice lançam meias-luas e suas técnicas alcançam mais longe; com 24 e os quatro Aprimoramentos Universais, elas atravessam a tela e o rifle dispara rajadas.",
    "Ее сила растет вместе с потенциалами: с 4 атаки косой выпускают полумесяцы, а приемы достают дальше; с 24 и всеми четырьмя Универсальными усилениями они достают через весь экран, а винтовка стреляет очередями.")

ACTOR_TEXT = {   # character screen: ActorSkill_ / ActorSkillDesc_ / ActorUltra_ / ActorUltraDesc_<actor> (write_mod's enu keys)
    "skill": "[[rifle_shot]]",
    "skill_desc": {l: _SKILL_SUMMARY[l] + ("<br>" + _POWER_STAGES[l] if POWER_STAGES_IN_SKILL_DESC else "") for l in LANGS},
    "ultra": "[[petal_burst]]",
    # stock shape (Noel's ActorUltraDesc_100301: "... SP: You earn SP when ..."): the move's text, then its SP line in the
    # same string; no space after the full stop in chs / cht / jpn
    "ultra_desc": {l: POTENTIAL_TEXT[20715]["desc"][l] + ("" if l in ("chs", "cht", "jpn") else " ") + POTENTIAL_TEXT[20715]["sp"][l]
                   for l in LANGS},
}


# ---------------------------------------------------------------- fill the templates (once, at import)
def _typo(s, lang):
    """The stock typography: French puts a non-breaking space before : ; ! ? % and between a number and its unit;
    Spanish before %. (Stock copies already carry theirs, so this changes nothing in them.)"""
    if lang == "fac":
        s = re.sub(r" ([:;!?%])", "\u00a0\\1", s)
        s = re.sub(r"(\d) (s|fois|PS|PM)\b", "\\1\u00a0\\2", s)
    elif lang == "esp":
        s = s.replace(" %", "\u00a0%")
    return s


def _sub(s, lang):
    return _typo(_sub0(s, lang), lang)


def _sub0(s, lang):
    out, i = [], 0
    while True:
        j = s.find("[[", i)
        if j < 0:
            out.append(s[i:]); return "".join(out)
        k = s.index("]]", j)
        out.append(s[i:j]); key = s[j + 2:k]
        if key == "dmg":
            out.append(DMG)
        elif key.startswith("c:"):
            out.append(c(NAMES[key[2:]][lang]))
        else:
            out.append(NAMES[key][lang])
        i = k + 2


def _fill(x, memo, text=False):
    """Text fields become {lang: text} with their templates filled (a plain string is a name / input used for every
    language); containers are walked. Shared dicts stay shared (memo), so a card and its move row keep one text object."""
    if isinstance(x, str):
        return {l: _sub(x, l) for l in LANGS} if text else x
    if id(x) in memo:
        return memo[id(x)]
    if isinstance(x, dict) and set(x) == set(LANGS):
        r = {l: _sub(x[l], l) for l in LANGS}
    elif isinstance(x, dict):
        r = {k: (_fill(v, memo, k in _TEXT_FIELDS) if k in _TEXT_FIELDS or isinstance(v, (dict, list)) else v)
             for k, v in x.items()}
    elif isinstance(x, list):
        r = [_fill(v, memo, text) for v in x]
    else:
        return x
    memo[id(x)] = r
    return r

_TEXT_FIELDS = {"name", "input", "desc", "sp", "text", "up", "skill", "skill_desc", "ultra", "ultra_desc"}
_src = (POTENTIAL_TEXT, HIDDEN_TEXT, MOVE_TEXT, TALENT_TEXT, DUST_TEXT, LEGACY_TEXT, ACTOR_TEXT)   # alive while filling (memo keys are ids)
_memo = {}
(POTENTIAL_TEXT, HIDDEN_TEXT, MOVE_TEXT, TALENT_TEXT, DUST_TEXT, LEGACY_TEXT, ACTOR_TEXT) = [_fill(x, _memo) for x in _src]
del _memo, _src


# ---------------------------------------------------------------- self-check (not run at import)
ACTION_NAMES = {"Attack", "Skill", "Summon", "Dynamic", "Dash", "Jump", "MoveX+", "MoveX-", "MoveY+", "MoveY-"}

def texts():
    """Every (where, {lang: text}) in the module."""
    out = []
    def walk(where, x):
        if isinstance(x, dict) and set(x) == set(LANGS):
            out.append((where, x))
        elif isinstance(x, dict):
            for k, v in x.items():
                if k in _TEXT_FIELDS or isinstance(v, (dict, list)):
                    walk("%s.%s" % (where, k), v)
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk("%s[%d]" % (where, i), v)
    for name in ("POTENTIAL_TEXT", "HIDDEN_TEXT", "MOVE_TEXT", "TALENT_TEXT", "DUST_TEXT", "LEGACY_TEXT", "ACTOR_TEXT"):
        walk(name, globals()[name])
    return out


def check():
    """Problems: missing ids / rows, empty strings, unbalanced or changed markup, unknown glyphs, leftover templates."""
    import re
    probs = []
    import rrb_power                      # the character screen names the stage thresholds: they follow rrb_power
    for l in LANGS:
        for n_ in (rrb_power.STAGE2, rrb_power.STAGE3):
            if not re.search(r"(?<!\d)%d(?!\d)" % n_, _POWER_STAGES[l]): probs.append("power stage text (%s): %d is not named" % (l, n_))
    for pid in list(range(20701, 20741)) + [20799]:
        p = POTENTIAL_TEXT.get(pid)
        if not p or "name" not in p or "desc" not in p:
            probs.append("Potential %d: missing" % pid)
    for n in range(1, 40):
        if n not in HIDDEN_TEXT:
            probs.append("hidden %d: missing" % n)
    for m in MOVE_TEXT.values():
        if m.get("parent") and m["parent"] not in MOVE_TEXT:
            probs.append("move %s: unknown parent %s" % (m["id"], m["parent"]))
    for n, h in HIDDEN_TEXT.items():
        for row in (h if isinstance(h, list) else [h]):
            for mk in row["move"]:
                if mk not in MOVE_TEXT:
                    probs.append("hidden %d: unknown move %s" % (n, mk))
    ids = [m["id"] for m in MOVE_TEXT.values()]
    if len(ids) != len(set(ids)):
        probs.append("duplicate move ids")
    tag = lambda s: (sorted(re.findall(r"<action=([^>]*)>", s)), s.count("<color="), s.count("</color>"),
                     sorted(re.findall(r'\{"v":[^}]*\}', s)))
    for where, t in texts():
        for l in LANGS:
            s = t.get(l)
            if not isinstance(s, str) or (not s.strip() and not where.endswith(".input")):
                probs.append("%s [%s]: empty" % (where, l)); continue
            if "[[" in s or "]]" in s:
                probs.append("%s [%s]: template left" % (where, l))
            if s.count("<color=") != s.count("</color>"):
                probs.append("%s [%s]: unbalanced <color>" % (where, l))
            if re.search(r"<color=(?!#3AFDFFFF>)", s):
                probs.append("%s [%s]: unexpected colour" % (where, l))
            bad = set(re.findall(r"<action=([^>]*)>", s)) - ACTION_NAMES
            if bad:
                probs.append("%s [%s]: unknown glyph %s" % (where, l, bad))
            if s.count("<") != s.count(">"):
                probs.append("%s [%s]: unbalanced <>" % (where, l))
            if tag(s) != tag(t["enu"]):
                probs.append("%s [%s]: markup differs from English" % (where, l))
    return probs


if __name__ == "__main__":
    p = check()
    n = len(texts())
    print("rrb_text: %d Potentials, %d hidden rows (row 27: %d variants), %d move rows, %d texts x %d languages; %d problems"
          % (len(POTENTIAL_TEXT), len(HIDDEN_TEXT), len(HIDDEN_TEXT[27]), len(MOVE_TEXT), n, len(LANGS), len(p)))
    for x in p[:40]:
        print("  ", x)
