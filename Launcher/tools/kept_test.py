"""kept.py on made-up folders: when work is made again, when it is put back, and what is never kept.

  python tools/kept_test.py
"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kept  # noqa: E402

results = []


def note(label, ok, detail=""):
    results.append((label, bool(ok)))
    print("%-5s %s%s" % ("ok" if ok else "FAIL", label, ("  [" + str(detail)[:300] + "]") if detail and not ok else "")); sys.stdout.flush()


def put(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f: f.write(text)


def read(path):
    with open(path, encoding="utf-8") as f: return f.read()


tmp = tempfile.mkdtemp(prefix="zt_kept_")
os.environ.pop("BBMOD_NOKEEP", None)
try:
    mod, other, home = os.path.join(tmp, "mod"), os.path.join(tmp, "other-game"), os.path.join(tmp, "kept")
    put(os.path.join(mod, "art", "a.png"), "picture 1"); put(os.path.join(mod, "mod.json"), "{}"); put(os.path.join(other, "data.pac"), "their file")
    runs, said = [], []

    def fresh_out():
        out = tempfile.mkdtemp(prefix="out_", dir=tmp)
        put(os.path.join(out, "clones", "base.ab"), "from the clone step")          # there before the importer runs
        return out

    def make_in(out, extra=""):
        def make():
            runs.append(1)
            put(os.path.join(out, "actor", "sheet.ab"), "sheet of " + read(os.path.join(mod, "art", "a.png")) + extra)
            put(os.path.join(out, "clones", "base.ab"), "changed by the importer")   # a file of an earlier step, rewritten
            return {"names": ["actor/sheet"], "entries": [], "guids": []}
        return make

    def go(out, says=("build 100",), extra="", reads=None):
        return kept.work("char-test", out, make_in(out, extra), reads=reads or [mod, other], says=list(says), home=home, tell=said.append)

    a = fresh_out(); first = go(a)
    note("the first time the work runs and is kept", runs == [1] and "kept for next time" in said[-1], said[-1:])
    b = fresh_out(); second = go(b)
    note("the second time it is put back without running", runs == [1] and "put back" in said[-1], said[-1:])
    note("what comes back is what the work returned", second == first == {"names": ["actor/sheet"], "entries": [], "guids": []})
    note("the files are the same as a run leaves them, the rewritten earlier file too",
         read(os.path.join(b, "actor", "sheet.ab")) == read(os.path.join(a, "actor", "sheet.ab")) and read(os.path.join(b, "clones", "base.ab")) == "changed by the importer")

    def again(label, change, **kw):
        before = len(runs); change(); out = fresh_out(); go(out, **kw)
        note(label, len(runs) == before + 1, said[-1:])
        return out

    time.sleep(0.02)
    c = again("a changed file of the mod: made again", lambda: put(os.path.join(mod, "art", "a.png"), "picture 2"))
    note("and the new result is the changed one", "picture 2" in read(os.path.join(c, "actor", "sheet.ab")))
    again("a new file in the mod: made again", lambda: put(os.path.join(mod, "art", "b.png"), "more"))
    again("a changed file of the other game: made again", lambda: put(os.path.join(other, "data.pac"), "their file, updated"))
    again("the other game gone: made again", lambda: shutil.rmtree(other))
    again("another game build: made again", lambda: None, says=("build 200",))
    before = len(runs); go(fresh_out(), says=("build 200",))
    note("unchanged after all that: put back", len(runs) == before)
    before = len(runs); put(os.path.join(mod, "__pycache__", "x.pyc"), "bytecode"); go(fresh_out(), says=("build 200",))
    note("Python's own cache files in the mod do not count as a change", len(runs) == before)

    # ---- what is never kept ------------------------------------------------------------------------------------
    def removes(out):
        def make(): os.remove(os.path.join(out, "clones", "base.ab")); return {}
        return make
    o = fresh_out(); kept.work("removes", o, removes(o), reads=[mod], home=home, tell=said.append)
    note("work that removes a file from the build folder is not kept", "not kept" in said[-1] and kept.look("removes", kept.signature([mod]), home) is None, said[-1:])

    def fails(): raise RuntimeError("the importer stopped")
    try: kept.work("fails", fresh_out(), fails, reads=[mod], home=home, tell=said.append); raised = False
    except RuntimeError: raised = True
    note("work that fails is not kept, and the error is the caller's", raised and kept.look("fails", kept.signature([mod]), home) is None)

    def writes_own_input(out):
        def make(): put(os.path.join(mod, "gen", "made.json"), str(time.time())); put(os.path.join(out, "x.ab"), "x"); return {}
        return make
    o = fresh_out(); kept.work("selfwrite", o, writes_own_input(o), reads=[mod], home=home, tell=said.append)
    note("work that changes what it reads is not kept, and says so", "changed while it ran" in said[-1], said[-1:])

    def writes_named(out):
        def make(): put(os.path.join(mod, "gen", "made.json"), str(time.time())); put(os.path.join(out, "x.ab"), "x"); return {}
        return make
    for _ in range(2): o = fresh_out(); kept.work("skips", o, writes_named(o), reads=[mod], home=home, tell=said.append, skip=["gen/made.json"])
    note("with that file named in skip it is kept, and put back the next time", "put back" in said[-1], said[-2:])

    o = fresh_out(); kept.work("notjson", o, lambda: {1, 2}, reads=[], home=home, tell=said.append)
    note("a result JSON cannot hold is not kept", "not kept" in said[-1])

    # ---- a damaged store, and the switch -----------------------------------------------------------------------
    go(fresh_out(), says=("build 300",)); before = len(runs)
    os.remove(os.path.join(home, "char-test", "files", "actor", "sheet.ab"))
    go(fresh_out(), says=("build 300",))
    note("a kept file that is gone: the work runs again instead of handing out half a result", len(runs) == before + 1)
    put(os.path.join(home, "char-test", "kept.json"), "{ not json")
    before = len(runs); go(fresh_out(), says=("build 300",))
    note("an unreadable record: the work runs again", len(runs) == before + 1)
    os.environ["BBMOD_NOKEEP"] = "1"; before = len(runs); go(fresh_out(), says=("build 300",)); os.environ.pop("BBMOD_NOKEEP")
    note("BBMOD_NOKEEP=1: the work always runs", len(runs) == before + 1)
    note("one result is kept per name, not one per change", sorted(os.listdir(home)) == ["char-test", "skips"], os.listdir(home))
    note("a name with characters a folder cannot have is made safe", kept._safe("char-x fx/import_fx.py") == "char-x_fx_import_fx.py")

    # ---- work that builds on a file an earlier step left in the build folder (Ruby's sounds on the party's list) ----
    home2 = os.path.join(tmp, "kept2"); made = []

    def adds_to_list(o):
        def make():
            p = os.path.join(o, "data", "list.ab")
            put(p, (read(p) if os.path.exists(p) else "") + "+ruby"); made.append(1)
            return {"names": []}
        return make

    def with_list(text):
        o = fresh_out()
        if text is not None: put(os.path.join(o, "data", "list.ab"), text)
        kept.work("builds-on", o, adds_to_list(o), reads=[mod], home=home2, tell=said.append)
        return read(os.path.join(o, "data", "list.ab"))

    with_list("party v1"); got = with_list("party v1")
    note("built on another step's file: put back while that file is the same", len(made) == 1 and got == "party v1+ruby", (made, got))
    got = with_list("party v2")
    note("built on another step's file: made again on the new version when it changed", len(made) == 2 and got == "party v2+ruby", (made, got))
    got = with_list(None)
    note("built on another step's file: made again when it is gone", len(made) == 3 and got == "+ruby", (made, got))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
bad = [l for l, ok in results if not ok]
print("\n%d of %d as expected%s" % (len(results) - len(bad), len(results), "" if not bad else "; NOT as expected: " + "; ".join(bad)))
sys.exit(1 if bad else 0)
