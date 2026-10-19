"""savefile_test.py -- the save cleaner on a made-up save (no player's file is needed or kept here).

    python tools\\savefile_test.py

The made-up save holds a mod character in the places a tester's save held one on 2026-10-11 after Trials and Boss
Rush had been played as that character: the cleaner stopped with "mod-character references would remain"."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import savefile as S

MOD = sorted(S.MOD_ACTORS)[0]
STOCK, STOCK2 = 100101, 100201
ok = bad = 0


def check(name, cond):
    global ok, bad
    if cond: ok += 1
    else: bad += 1; print("FAILED:", name)


def vi(f, n): return S.wv(f << 3) + S.wv(n)
def ld(f, b): return S.wv((f << 3) | 2) + S.wv(len(b)) + b
def packed(f, ns): return ld(f, b"".join(S.wv(n) for n in ns))
def message(t, body): return ld(2, ld(1, t.encode()) + ld(2, body))


def trial_record(done, perfect, times): return (packed(1, done) if done else b"") + vi(2, times) + (packed(3, perfect) if perfect else b"")


def build():
    per_char = lambda a: ld(3, vi(1, a) + ld(2, vi(1, 1) + vi(2, 1) + vi(3, 34)))
    new_record = ld(1, ld(2, vi(1, STOCK) + vi(2, 369)) + per_char(STOCK) + per_char(MOD))
    rush_char = lambda a: ld(2, vi(1, a) + ld(2, vi(1, 469) + vi(2, 2)))
    rush_record = ld(1, ld(1, ld(1, vi(1, 101) + ld(2, vi(1, 0))) + rush_char(STOCK) + rush_char(MOD)))
    challenge = ld(1, b"playerid") + ld(2,
        ld(1, vi(1, 1) + ld(2, trial_record([STOCK], [STOCK], 2))) +
        ld(1, vi(1, 2) + ld(2, trial_record([MOD], [], 1))) +
        ld(1, vi(1, 3) + ld(2, trial_record([STOCK, MOD], [MOD, STOCK2], 3))))
    rush = packed(11, [STOCK, MOD])
    return (ld(1, b"save") + message("ModelPlayerNewRecord", new_record) + message("ModelPlayerNewBossRushRecord", rush_record)
            + message("ModelBattleChallenge", challenge) + message("ModelBattleBossRush", rush) + message("ModelTask", vi(1, 7)))


data = build()
check("the made-up save holds the mod character", S.scan_custom(data) + S.pattern_hits(data) >= 6)
new, report = S.clean(data)
check("nothing of the mod character is left", S.scan_custom(new) + S.pattern_hits(new) == 0)
msgs = dict(S.messages(new)); old = dict(S.messages(data))
check("an untouched message is the same bytes", msgs["ModelTask"] == old["ModelTask"])
check("every message is still there", list(msgs) == list(old))
for label in ("Trial record", "Boss Rush record", "Trial clear", "Trial perfect clear", "Boss Rush character"):
    check("the report names: " + label, any(label + " (" in line for line in report))

rec = [v for f, w, v, _ in S.fields(msgs["ModelPlayerNewRecord"]) if f == 1][0]
check("Trial records: the stock character's stays", [S.key_of(v) for f, w, v, _ in S.fields(rec) if f == 3] == [STOCK])
check("Trial records: the other field is untouched", [S.key_of(v) for f, w, v, _ in S.fields(rec) if f == 2] == [STOCK])

info = [v for f, w, v, _ in S.fields(msgs["ModelBattleChallenge"]) if f == 2][0]
trials = {}
for f, w, v, _ in S.fields(info):
    r = [v2 for f2, w2, v2, _ in S.fields(v) if f2 == 2][0]
    got = {f2: (v2 if w2 == 0 else S.unpacked(v2)) for f2, w2, v2, _ in S.fields(r)}
    trials[S.key_of(v)] = got
check("Trial 1 (stock only) is unchanged", trials[1] == {1: [STOCK], 2: 2, 3: [STOCK]})
check("Trial 2 stays finished with no character listed", trials[2] == {2: 1})
check("Trial 3 keeps the stock characters and its count", trials[3] == {1: [STOCK], 2: 3, 3: [STOCK2]})
check("the player id of the Trial message is untouched",
      [v for f, w, v, _ in S.fields(msgs["ModelBattleChallenge"]) if f == 1] == [b"playerid"])
check("Boss Rush list keeps the stock character", S.unpacked([v for f, w, v, _ in S.fields(msgs["ModelBattleBossRush"]) if f == 11][0]) == [STOCK])

again, report2 = S.clean(new)
check("a clean save is left byte for byte as it is", again == new and report2 == [])
stock_only = ld(1, b"save") + message("ModelBattleBossRush", packed(11, [STOCK, STOCK2])) + message("ModelBattleChallenge",
    ld(2, ld(1, vi(1, 1) + ld(2, trial_record([STOCK], [STOCK], 2)))))
check("a save with no mod character is left byte for byte as it is", S.clean(stock_only)[0] == stock_only)

print("%d of %d" % (ok, ok + bad))
sys.exit(1 if bad else 0)
