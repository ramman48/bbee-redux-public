r"""gameslot.py -- one job at a time owns the game: installs, launching / closing it, and in-game tests.

Development-side tool: several build and test jobs can run on the same PC, and this keeps their installs and game runs
from overlapping. A job takes the slot, does its install -> launch -> test, and releases it; the others wait in a
first-come queue. A lease ends by itself (default 30 min) if a job stops without releasing. bbmod.py install /
uninstall and tools\ingame\gamecheck.py refuse while ANOTHER job holds the slot (set BBEE_SLOT=<your name> so they
know who you are).

    python tools\gameslot.py status
    python tools\gameslot.py acquire <name> "<purpose>" [--minutes 30] [--wait 5400]   waits for its turn, then holds it
    python tools\gameslot.py renew <name> [--minutes 30]
    python tools\gameslot.py release <name>

<name> is the workstream, e.g. Characters, "Boons Plus", "BlazBlue EX", "Entropy Overhaul", "Cross Effect", QA."""
import json, os, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
STATE = os.path.join(ROOT, "mods", ".gameslot.json")
MUTEX = os.path.join(ROOT, "mods", ".gameslot.mutex")


def now():
    return time.time()


def hm(t):
    return time.strftime("%H:%M", time.localtime(t))


class Mutex:
    """Atomic read-modify-write across processes (an exclusive create; a mutex left by a crash is cleared after 30 s)."""
    def __enter__(self):
        t0 = now()
        while True:
            try:
                self.fd = os.open(MUTEX, os.O_CREAT | os.O_EXCL | os.O_WRONLY); return self
            except FileExistsError:
                try:
                    if now() - os.path.getmtime(MUTEX) > 30: os.remove(MUTEX); continue
                except OSError:
                    pass
                if now() - t0 > 60: raise SystemExit("gameslot: could not lock %s" % MUTEX)
                time.sleep(0.1)
    def __exit__(self, *a):
        os.close(self.fd)
        try: os.remove(MUTEX)
        except OSError: pass


def load():
    try:
        s = json.load(open(STATE, encoding="utf-8"))
    except (OSError, ValueError):
        s = {}
    s.setdefault("holder", None); s.setdefault("queue", [])
    if s["holder"] and s["holder"]["expires"] < now():   # an expired lease frees the slot
        s["holder"] = None
    s["queue"] = [q for q in s["queue"] if now() - q.get("seen", q["joined"]) < 600]   # waiters that stopped polling
    return s


def save(s):
    tmp = STATE + ".tmp"
    json.dump(s, open(tmp, "w", encoding="utf-8"), indent=1)
    os.replace(tmp, STATE)


def holder():
    """The job holding the slot now, or None (used by bbmod.py and gamecheck.py)."""
    with Mutex():
        return load()["holder"]


def check(me):
    """None if `me` may use the game now, else the reason (another job holds the slot)."""
    h = holder()
    if not h or (me and h["name"].lower() == me.lower()): return None
    return "the game slot is held by %s (%s) until %s; queue with: python tools\\gameslot.py acquire <you> \"<purpose>\"" % (
        h["name"], h["purpose"], hm(h["expires"]))


def status():
    with Mutex():
        s = load()
    h = s["holder"]
    print("holder:", "%s - %s (since %s, until %s)" % (h["name"], h["purpose"], hm(h["since"]), hm(h["expires"])) if h else "free")
    for i, q in enumerate(s["queue"]):
        print("queue %d: %s - %s (waiting since %s)" % (i + 1, q["name"], q["purpose"], hm(q["joined"])))


def acquire(name, purpose, minutes=30, wait=5400):
    t0 = now(); said = None
    while True:
        with Mutex():
            s = load()
            h = s["holder"]
            if h and h["name"].lower() == name.lower():   # already ours: extend
                h["expires"] = now() + minutes * 60; h["purpose"] = purpose; save(s)
                print("gameslot: %s holds the slot until %s" % (name, hm(h["expires"]))); return 0
            mine = [q for q in s["queue"] if q["name"].lower() == name.lower()]
            if not mine:
                s["queue"].append({"name": name, "purpose": purpose, "joined": now(), "seen": now()})
            else:
                mine[0]["seen"] = now(); mine[0]["purpose"] = purpose
            first = s["queue"][0]["name"].lower() == name.lower()
            if not h and first:
                s["queue"].pop(0)
                s["holder"] = {"name": name, "purpose": purpose, "since": now(), "expires": now() + minutes * 60}
                save(s); print("gameslot: %s holds the slot until %s" % (name, hm(s["holder"]["expires"]))); return 0
            save(s)
            pos = [q["name"].lower() for q in s["queue"]].index(name.lower()) + 1
            msg = "waiting: %s" % ("held by %s (%s) until %s" % (h["name"], h["purpose"], hm(h["expires"])) if h else "free, but %d ahead" % (pos - 1))
        if msg != said: print("gameslot:", msg, "- position", pos); said = msg
        if now() - t0 > wait:
            print("gameslot: gave up after %d min" % (wait // 60)); return 1
        time.sleep(5)


def renew(name, minutes=30):
    with Mutex():
        s = load(); h = s["holder"]
        if not h or h["name"].lower() != name.lower(): print("gameslot: %s does not hold the slot" % name); return 1
        h["expires"] = now() + minutes * 60; save(s)
    print("gameslot: renewed until %s" % hm(h["expires"])); return 0


def release(name):
    with Mutex():
        s = load(); h = s["holder"]
        s["queue"] = [q for q in s["queue"] if q["name"].lower() != name.lower()]
        if h and h["name"].lower() == name.lower(): s["holder"] = None
        save(s)
    print("gameslot: released by %s" % name); return 0


if __name__ == "__main__":
    a = sys.argv[1:]
    opt = lambda k, d: int(a[a.index(k) + 1]) if k in a else d
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and (i == 0 or not a[i - 1].startswith("--"))]
    if not pos or pos[0] == "status": status(); sys.exit(0)
    if pos[0] == "acquire" and len(pos) >= 3: sys.exit(acquire(pos[1], pos[2], opt("--minutes", 30), opt("--wait", 5400)))
    if pos[0] == "renew" and len(pos) >= 2: sys.exit(renew(pos[1], opt("--minutes", 30)))
    if pos[0] == "release" and len(pos) >= 2: sys.exit(release(pos[1]))
    print(__doc__); sys.exit(1)
