"""safe_rm_test.py: safe_rm.rmtree removes read-only files and read-only folders (the attribute that made Windows refuse
RemoveDirectory on kept\\quick\\...\\role for IluzryMage, 2026-11-17), and a missing path is no error."""
import os, stat, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import safe_rm

root = tempfile.mkdtemp(prefix="safe_rm_")
deep = os.path.join(root, "out", "actor", "animation", "role")
os.makedirs(deep)
f = os.path.join(deep, "clip.ab")
open(f, "wb").write(b"x")
os.chmod(f, stat.S_IREAD)
for d in (deep, os.path.dirname(deep)):
    subprocess.run(["attrib", "+R", d], capture_output=True)   # read-only folders, as some unzippers leave them
safe_rm.rmtree(os.path.join(root, "out"))
ok1 = not os.path.exists(os.path.join(root, "out"))
safe_rm.rmtree(os.path.join(root, "never-made"))
f2 = os.path.join(root, "single.txt"); open(f2, "w").write("x"); os.chmod(f2, stat.S_IREAD)
safe_rm.rmtree(f2)
ok2 = not os.path.exists(f2)
os.rmdir(root)
print("read-only tree removed:", ok1, "| read-only file removed:", ok2)
sys.exit(0 if ok1 and ok2 else 1)
