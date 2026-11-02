"""Regression: Pedagang / Lapak / Sewa / Pembayaran / Laporan / Users (Jimbaran market revision).
Run against PUBLIC URL: BACKEND_URL=$REACT_APP_BACKEND_URL pytest tests/test_pasar_flow.py -n0
Afterwards restore data: python seed.py
"""
import io
import os
import random
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest
from openpyxl import load_workbook

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"
TODAY = datetime.now(ZoneInfo("Asia/Makassar")).date()


def login(u, p):
    c = httpx.Client(base_url=BASE, timeout=30)
    r = c.post("/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture(scope="module")
def sup():
    return login("pengelola", "jimbaran2026")


@pytest.fixture(scope="module")
def staff():
    return login("pemungut1", "pemungut123")


@pytest.fixture(scope="module")
def pub():
    return httpx.Client(base_url=BASE, timeout=30)


def nik():
    return "51" + "".join(random.choice("0123456789") for _ in range(14))


def d(n):
    return (TODAY + timedelta(days=n)).isoformat()


# ---------- Pedagang ----------
class TestPedagang:
    def test_seeded(self, sup):
        r = sup.get("/pedagang")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 22
        ids = [p["user_id"] for p in data]
        assert "01-009" in ids
        for p in data[:22]:
            assert len(p["user_id"].split("-")[1]) == 3

    def test_create_next_id_dup_rbac(self, sup, staff):
        before = len(sup.get("/pedagang").json())
        n = nik()
        r = staff.post("/pedagang", json={"nama": "TEST_Pedagang", "nik": n, "no_hp": "081234567890"})
        assert r.status_code == 201, r.text
        p = r.json()
        seq, tail = p["user_id"].split("-")
        assert tail == n[-3:]
        assert int(seq) == before + 1, f"expected seq {before+1}, got {p['user_id']}"
        assert sup.post("/pedagang", json={"nama": "TEST_Dup", "nik": n}).status_code == 409
        assert staff.patch(f"/pedagang/{p['id']}", json={"nama": "TEST_x"}).status_code == 403
        assert staff.delete(f"/pedagang/{p['id']}").status_code == 403
        r = sup.patch(f"/pedagang/{p['id']}", json={"nama": "TEST_Pedagang Edit"})
        assert r.status_code == 200 and r.json()["nama"] == "TEST_Pedagang Edit"
        assert sup.delete(f"/pedagang/{p['id']}").status_code == 200
        assert all(x["id"] != p["id"] for x in sup.get("/pedagang").json())

    def test_public_search(self, pub):
        r = pub.get("/publik/pedagang", params={"q": "ngu"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for x in data:
            assert set(x.keys()) == {"id", "user_id", "nama"}
            assert "ngu" in x["nama"].lower()
        assert pub.get("/publik/pedagang", params={"q": "a"}).status_code == 422

    def test_unauth(self, pub):
        assert pub.get("/pedagang").status_code == 401


# ---------- Lapak ----------
class TestLapak:
    def test_list_and_crud_rbac(self, sup, staff, pub):
        r = sup.get("/lapak")
        assert r.status_code == 200 and len(r.json()) >= 21
        name = f"TEST_Lapak {uuid.uuid4().hex[:5]}"
        r = staff.post("/lapak", json={"nama": name, "jenis": "Kios", "harga_sewa": 300000, "iuran": 5000})
        assert r.status_code == 201, r.text
        lid = r.json()["id"]
        assert staff.post("/lapak", json={"nama": name, "harga_sewa": 1, "iuran": 0}).status_code == 409
        assert staff.patch(f"/lapak/{lid}", json={"harga_sewa": 1}).status_code == 403
        assert staff.delete(f"/lapak/{lid}").status_code == 403
        png = b"\x89PNG\r\n\x1a\n" + b"0" * 50
        assert staff.post(f"/lapak/{lid}/foto", files={"file": ("a.png", png, "image/png")}).status_code == 403
        r = sup.patch(f"/lapak/{lid}", json={"harga_sewa": 600000})
        assert r.status_code == 200 and r.json()["harga_sewa"] == 600000
        assert any(x["id"] == lid for x in pub.get("/publik/lapak-kosong").json())
        assert sup.delete(f"/lapak/{lid}").status_code == 200


# ---------- Sewa + Payments full flow ----------
@pytest.fixture(scope="module")
def ctx(sup):
    name = f"TEST_LapakFlow {uuid.uuid4().hex[:5]}"
    lid = sup.post("/lapak", json={"nama": name, "harga_sewa": 450000, "iuran": 3000}).json()["id"]
    p = sup.post("/pedagang", json={"nama": "TEST_Penyewa", "nik": nik(), "no_hp": "081234567891"}).json()
    yield {"lid": lid, "p": p}


class TestSewaFlow:
    def test_assign_total_and_overlap(self, sup, staff, pub, ctx):
        r = staff.post("/sewa", json={"pedagang_id": ctx["p"]["id"], "lapak_id": ctx["lid"], "mulai": d(0), "selesai": d(9)})
        assert r.status_code == 201, r.text
        s = r.json()
        assert s["status"] == "aktif" and s["hari"] == 10
        assert s["total_harga"] == round(450000 * 10 / 30) == 150000
        assert s["sisa"] == 150000
        ctx["sid"] = s["id"]
        r = sup.post("/sewa", json={"pedagang_id": ctx["p"]["id"], "lapak_id": ctx["lid"], "mulai": d(5), "selesai": d(20)})
        assert r.status_code == 409
        assert all(x["id"] != ctx["lid"] for x in pub.get("/publik/lapak-kosong").json())
        lap = [x for x in sup.get("/lapak").json() if x["id"] == ctx["lid"]][0]
        assert lap["status"] == "terisi" and lap["penyewa"] == "TEST_Penyewa"
        assert sup.delete(f"/lapak/{ctx['lid']}").status_code == 409

    def test_bad_dates(self, sup, ctx):
        r = sup.post("/sewa", json={"pedagang_id": ctx["p"]["id"], "lapak_id": ctx["lid"], "mulai": d(50), "selesai": d(40)})
        assert r.status_code == 422

    def test_scan(self, staff, ctx):
        r = staff.get(f"/scan/{ctx['p']['user_id']}")
        assert r.status_code == 200
        data = r.json()
        sw = [x for x in data["sewa"] if x["id"] == ctx["sid"]][0]
        assert sw["sisa"] == 150000 and sw["iuran_hari_ini_lunas"] is False
        assert staff.get("/scan/99-999").status_code == 404

    def test_iuran_once(self, staff, ctx):
        r = staff.post("/payments/iuran", json={"sewa_id": ctx["sid"]})
        assert r.status_code == 201, r.text
        pay = r.json()
        assert pay["jumlah"] == 3000 and pay["penagih"] == "I Made Pemungut" and pay["jenis"] == "iuran"
        ctx["iuran_pid"] = pay["id"]
        assert staff.post("/payments/iuran", json={"sewa_id": ctx["sid"]}).status_code == 409
        sw = [x for x in staff.get(f"/scan/{ctx['p']['user_id']}").json()["sewa"] if x["id"] == ctx["sid"]][0]
        assert sw["iuran_hari_ini_lunas"] is True

    def test_sewa_pay(self, sup, ctx):
        r = sup.post("/payments/sewa", json={"sewa_id": ctx["sid"]})
        assert r.status_code == 201
        assert r.json()["jumlah"] == 150000 and r.json()["penagih"] == "Super Admin" or r.json()["penagih"]
        assert sup.post("/payments/sewa", json={"sewa_id": ctx["sid"]}).status_code == 409
        sw = [x for x in sup.get(f"/scan/{ctx['p']['user_id']}").json()["sewa"] if x["id"] == ctx["sid"]][0]
        assert sw["sisa"] == 0

    def test_payment_list_rbac(self, sup, staff, ctx):
        for per in ("harian", "bulanan", "tahunan"):
            r = sup.get("/payments", params={"periode": per, "tanggal": d(0)})
            assert r.status_code == 200
            j = r.json()
            assert j["total"] == j["total_sewa"] + j["total_iuran"]
            assert j["total_iuran"] >= 3000 and j["total_sewa"] >= 150000
        r = sup.get("/payments", params={"periode": "harian", "tanggal": d(0), "jenis": "iuran"})
        assert all(x["jenis"] == "iuran" for x in r.json()["items"])
        j = staff.get("/payments", params={"periode": "harian"}).json()
        assert j["total"] is None and j["total_sewa"] is None and j["total_iuran"] is None
        assert len(j["items"]) >= 2
        assert sup.get("/payments", params={"periode": "mingguan"}).status_code == 422

    def test_exports(self, sup, staff):
        r = sup.get("/laporan/pembayaran.xlsx", params={"periode": "harian", "tanggal": d(0)})
        assert r.status_code == 200
        ws = load_workbook(io.BytesIO(r.content)).active
        hdr = [c.value for c in ws[5]]
        assert hdr == ["Nama", "ID", "Periode Sewa", "Harga/Jumlah (Rp)", "Penagih", "Tanggal", "Status", "Jenis"]
        assert ws.max_row > 6
        for per in ("harian", "bulanan", "tahunan"):
            r = sup.get("/laporan/pembayaran.pdf", params={"periode": per})
            assert r.status_code == 200 and r.content[:4] == b"%PDF"
        assert staff.get("/laporan/pembayaran.xlsx").status_code == 403
        assert staff.get("/laporan/pembayaran.pdf").status_code == 403

    def test_delete_payment_rbac(self, sup, staff, ctx):
        assert staff.delete(f"/payments/{ctx['iuran_pid']}").status_code == 403
        assert sup.delete(f"/payments/{ctx['iuran_pid']}").status_code == 200
        # lock released -> can pay again
        r = staff.post("/payments/iuran", json={"sewa_id": ctx["sid"]})
        assert r.status_code == 201

    def test_delete_sewa_rbac(self, sup, staff, ctx):
        assert staff.delete(f"/sewa/{ctx['sid']}").status_code == 403


# ---------- Public booking ----------
class TestPublikBooking:
    def test_booking_existing_and_new(self, sup, staff, pub):
        name = f"TEST_LapakPub {uuid.uuid4().hex[:5]}"
        lid = sup.post("/lapak", json={"nama": name, "harga_sewa": 300000, "iuran": 2000}).json()["id"]
        seed_p = [p for p in sup.get("/pedagang").json() if p["user_id"] == "01-009"][0]
        r = pub.post("/publik/sewa", json={"lapak_id": lid, "mulai": d(1), "selesai": d(30), "pedagang_id": seed_p["id"]})
        assert r.status_code == 201, r.text
        s1 = r.json()
        assert s1["status"] == "menunggu" and s1["total_harga"] == 300000 and "nik" not in s1
        n = nik()
        r = pub.post("/publik/sewa", json={"lapak_id": lid, "mulai": d(1), "selesai": d(5), "nama": "TEST_Baru", "nik": n, "no_hp": "081299998888"})
        assert r.status_code == 201
        s2 = r.json()
        assert s2["pedagang_id"] is None
        # validation
        assert pub.post("/publik/sewa", json={"lapak_id": lid, "mulai": d(-1), "selesai": d(3), "pedagang_id": seed_p["id"]}).status_code == 422
        assert pub.post("/publik/sewa", json={"lapak_id": lid, "mulai": d(1), "selesai": d(3), "nama": "X"}).status_code == 422
        # staff accepts new pedagang booking -> creates pedagang
        r = staff.post(f"/sewa/{s2['id']}/terima")
        assert r.status_code == 200, r.text
        acc = r.json()
        assert acc["status"] == "aktif" and acc["pedagang_id"] and acc["user_id"].endswith(n[-3:])
        assert any(p["user_id"] == acc["user_id"] for p in sup.get("/pedagang").json())
        # overlapping s1 auto-rejected
        st = [x for x in sup.get("/sewa").json() if x["id"] == s1["id"]][0]
        assert st["status"] == "ditolak"
        assert staff.post(f"/sewa/{s1['id']}/tolak").status_code == 409
        # new menunggu then tolak
        r = pub.post("/publik/sewa", json={"lapak_id": lid, "mulai": d(10), "selesai": d(12), "pedagang_id": seed_p["id"]})
        assert r.status_code == 201
        assert staff.post(f"/sewa/{r.json()['id']}/tolak").json()["status"] == "ditolak"
        assert len(sup.get("/sewa", params={"status": "menunggu"}).json()) >= 0
        # booking during active sewa -> 409
        assert pub.post("/publik/sewa", json={"lapak_id": lid, "mulai": d(2), "selesai": d(3), "pedagang_id": seed_p["id"]}).status_code == 409
        assert sup.delete(f"/sewa/{s2['id']}").status_code == 200


# ---------- Users ----------
class TestUsers:
    def test_delete_user(self, sup, staff):
        me = sup.get("/auth/me").json()
        assert sup.delete(f"/users/{me['id']}").status_code == 409
        u = f"test_{uuid.uuid4().hex[:6]}"
        r = sup.post("/users", json={"nama": "TEST User", "username": u, "password": "password123"})
        assert r.status_code == 201
        uid = r.json()["id"]
        assert staff.delete(f"/users/{uid}").status_code == 403
        assert sup.delete(f"/users/{uid}").status_code == 200
        assert all(x["id"] != uid for x in sup.get("/users").json())
        assert sup.delete(f"/users/{uid}").status_code == 404
