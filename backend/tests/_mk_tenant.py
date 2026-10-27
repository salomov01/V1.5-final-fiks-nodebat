"""Helper (manual): create/delete TEST_ tenant for UI scan test. usage: python _mk_tenant.py create|delete <id>"""
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
c = httpx.Client(base_url="http://localhost:8001/api", timeout=30)
c.post("/auth/login", json={"username": os.environ["ADMIN_USERNAME"], "password": os.environ["ADMIN_PASSWORD"]})
if sys.argv[1] == "create":
    r = c.post("/tenants", json={"nama_lengkap": "TEST_Scan UI", "no_hp": "081277788899", "kategori": "bulanan",
                                 "blok": "Z-77", "tarif": 123000, "mulai": "2026-01-01", "selesai": "2026-12-31"})
    print(r.json()["id"], r.json()["nomor_id"])
else:
    tid = sys.argv[2]
    for p in c.get("/payments", params={"tenant_id": tid}).json():
        print("payment", p["penagih"], p["status"], p["jumlah"])
        c.delete(f"/payments/{p['id']}")
    print(c.delete(f"/tenants/{tid}").status_code)
