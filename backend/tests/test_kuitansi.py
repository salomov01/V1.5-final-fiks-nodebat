"""Kuitansi Pembayaran: GET /api/payments/{id}/kuitansi (+ regression iuran 409 / RBAC).
Run: BACKEND_URL=$REACT_APP_BACKEND_URL pytest tests/test_kuitansi.py -n0 -p no:randomly
"""
import os
import random
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest

BASE = os.environ["BACKEND_URL"].rstrip("/") + "/api"
TODAY = datetime.now(ZoneInfo("Asia/Makassar")).date()


def login(u, p):
    c = httpx.Client(base_url=BASE, timeout=30)
    r = c.post("/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return c


def nik():
    return "51" + "".join(random.choice("0123456789") for _ in range(14))


@pytest.fixture(scope="module")
def sup():
    return login("pengelola", "jimbaran2026")


@pytest.fixture(scope="module")
def staff():
    return login("pemungut1", "pemungut123")


@pytest.fixture(scope="module")
def ctx(sup):
    c = {"pays": []}
    c["lid"] = sup.post("/lapak", json={"nama": f"TEST_KW {uuid.uuid4().hex[:5]}", "harga_sewa": 300000, "iuran": 4000}).json()["id"]
    c["lid2"] = sup.post("/lapak", json={"nama": f"TEST_KW2 {uuid.uuid4().hex[:5]}", "harga_sewa": 300000, "iuran": 4000}).json()["id"]
    c["p"] = sup.post("/pedagang", json={"nama": "TEST_KwHp", "nik": nik(), "no_hp": "0812-3456 7890", "alamat": "Jl. Uji 1"}).json()
    c["p2"] = sup.post("/pedagang", json={"nama": "TEST_KwNoHp", "nik": nik()}).json()
    end = (TODAY + timedelta(days=9)).isoformat()
    c["sid"] = sup.post("/sewa", json={"pedagang_id": c["p"]["id"], "lapak_id": c["lid"], "mulai": TODAY.isoformat(), "selesai": end}).json()["id"]
    c["sid2"] = sup.post("/sewa", json={"pedagang_id": c["p2"]["id"], "lapak_id": c["lid2"], "mulai": TODAY.isoformat(), "selesai": end}).json()["id"]
    yield c
    for pid in c["pays"]:
        sup.delete(f"/payments/{pid}")
    for s in (c["sid"], c["sid2"]):
        sup.delete(f"/sewa/{s}")
    for l in (c["lid"], c["lid2"]):
        sup.delete(f"/lapak/{l}")
    for p in (c["p"], c["p2"]):
        sup.delete(f"/pedagang/{p['id']}")


class TestKuitansi:
    def test_iuran_kuitansi_staff(self, staff, sup, ctx):
        r = staff.post("/payments/iuran", json={"sewa_id": ctx["sid"]})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        ctx["pays"].append(pid)
        for cl in (staff, sup):
            k = cl.get(f"/payments/{pid}/kuitansi")
            assert k.status_code == 200, k.text
            j = k.json()
            assert set(j) == {"payment", "no_hp", "alamat", "sisa_sewa"}
            assert j["payment"]["id"] == pid and j["payment"]["jenis"] == "iuran"
            assert j["payment"]["jumlah"] == 4000 and j["payment"]["nama"] == "TEST_KwHp"
            assert j["payment"]["penagih"] == "I Made Pemungut"
            assert j["no_hp"] == "0812-3456 7890" and j["alamat"] == "Jl. Uji 1"
            assert j["sisa_sewa"] is None
            assert "_id" not in j["payment"]
        # regression: duplicate iuran
        assert staff.post("/payments/iuran", json={"sewa_id": ctx["sid"]}).status_code == 409

    def test_sewa_kuitansi_sisa(self, sup, ctx):
        r = sup.post("/payments/sewa", json={"sewa_id": ctx["sid"], "jumlah": 40000})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        ctx["pays"].append(pid)
        j = sup.get(f"/payments/{pid}/kuitansi").json()
        assert j["payment"]["jenis"] == "sewa" and j["payment"]["jumlah"] == 40000
        assert j["sisa_sewa"] == 60000

    def test_no_hp_empty(self, staff, ctx):
        r = staff.post("/payments/iuran", json={"sewa_id": ctx["sid2"]})
        assert r.status_code == 201
        pid = r.json()["id"]
        ctx["pays"].append(pid)
        j = staff.get(f"/payments/{pid}/kuitansi").json()
        assert j["no_hp"] == "" and j["alamat"] == ""

    def test_404_401_rbac(self, sup, staff, ctx):
        assert sup.get(f"/payments/{uuid.uuid4()}/kuitansi").status_code == 404
        assert httpx.get(f"{BASE}/payments/{ctx['pays'][0]}/kuitansi").status_code == 401
        assert staff.delete(f"/payments/{ctx['pays'][0]}").status_code == 403
        assert staff.get("/laporan/pembayaran.xlsx").status_code == 403

    def test_delete_then_404(self, sup, ctx):
        pid = ctx["pays"].pop()
        assert sup.delete(f"/payments/{pid}").status_code == 200
        assert sup.get(f"/payments/{pid}/kuitansi").status_code == 404
