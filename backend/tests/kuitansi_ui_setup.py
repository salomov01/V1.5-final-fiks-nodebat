"""Setup helper for UI test: creates TEST_ lapak/pedagang/sewa, prints user_ids & sewa ids. Use --cleanup to remove."""
import json, os, random, sys, uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import httpx

BASE = os.environ["BACKEND_URL"].rstrip("/") + "/api"
c = httpx.Client(base_url=BASE, timeout=30)
c.post("/auth/login", json={"username": "pengelola", "password": "jimbaran2026"})
F = "/tmp/kw_ui.json"
if "--cleanup" in sys.argv:
    d = json.load(open(F))
    for p in c.get("/payments", params={"periode": "tahunan"}).json()["items"]:
        if p["nama"].startswith("TEST_"):
            c.delete(f"/payments/{p['id']}")
    for k in ("sid", "sid2"):
        c.delete(f"/sewa/{d[k]}")
    for k in ("lid", "lid2"):
        c.delete(f"/lapak/{d[k]}")
    for k in ("pid", "pid2"):
        c.delete(f"/pedagang/{d[k]}")
    print("cleaned")
    sys.exit()
T = datetime.now(ZoneInfo("Asia/Makassar")).date()
nik = lambda: "51" + "".join(random.choice("0123456789") for _ in range(14))
lid = c.post("/lapak", json={"nama": f"TEST_UI {uuid.uuid4().hex[:4]}", "harga_sewa": 300000, "iuran": 4000}).json()["id"]
lid2 = c.post("/lapak", json={"nama": f"TEST_UI2 {uuid.uuid4().hex[:4]}", "harga_sewa": 300000, "iuran": 4000}).json()["id"]
p = c.post("/pedagang", json={"nama": "TEST_UiHp", "nik": nik(), "no_hp": "081234567890"}).json()
p2 = c.post("/pedagang", json={"nama": "TEST_UiNoHp", "nik": nik()}).json()
e = (T + timedelta(days=9)).isoformat()
s = c.post("/sewa", json={"pedagang_id": p["id"], "lapak_id": lid, "mulai": T.isoformat(), "selesai": e}).json()
s2 = c.post("/sewa", json={"pedagang_id": p2["id"], "lapak_id": lid2, "mulai": T.isoformat(), "selesai": e}).json()
d = dict(lid=lid, lid2=lid2, pid=p["id"], pid2=p2["id"], uid=p["user_id"], uid2=p2["user_id"], sid=s["id"], sid2=s2["id"])
json.dump(d, open(F, "w"))
print(json.dumps(d))
