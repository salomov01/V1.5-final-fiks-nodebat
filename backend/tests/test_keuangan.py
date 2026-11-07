"""Keuangan: Pengeluaran (+Gaji), Harga Barang, Laporan export (xlsx/pdf), RBAC, gaji_bulanan users.
Run: BACKEND_URL=$REACT_APP_BACKEND_URL pytest tests/test_keuangan.py -n0 -p no:randomly
"""
import io
import os
import random
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest
from openpyxl import load_workbook

BASE = os.environ["BACKEND_URL"].rstrip("/") + "/api"
TODAY = datetime.now(ZoneInfo("Asia/Makassar")).date()
T = TODAY.isoformat()


def login(u, p):
    c = httpx.Client(base_url=BASE, timeout=60)
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
def ctx(sup):
    c = {"peng": [], "harga": [], "users": [], "pays": []}
    yield c
    for pid in c["peng"]:
        sup.delete(f"/pengeluaran/{pid}")
    for hid in c["harga"]:
        sup.delete(f"/harga-barang/{hid}")
    for uid in c["users"]:
        sup.delete(f"/users/{uid}")
    for pid in c["pays"]:
        sup.delete(f"/payments/{pid}")
    for k in ("sid",):
        if k in c:
            sup.delete(f"/sewa/{c[k]}")
    if "lid" in c:
        sup.delete(f"/lapak/{c['lid']}")
    if "ped" in c:
        sup.delete(f"/pedagang/{c['ped']}")


# --- Users gaji_bulanan
class TestUsersGaji:
    def test_create_staff_with_gaji_and_patch(self, sup, ctx):
        un = f"test_pm{uuid.uuid4().hex[:6]}"
        r = sup.post("/users", json={"nama": "TEST_Pemungut Gaji", "username": un, "password": "rahasia123", "role": "staff", "gaji_bulanan": 2500000})
        assert r.status_code == 201, r.text
        u = r.json()
        ctx["users"].append(u["id"]); ctx["uid"] = u["id"]
        assert u["gaji_bulanan"] == 2500000
        lst = sup.get("/users").json()
        assert any(x["id"] == u["id"] and x["gaji_bulanan"] == 2500000 for x in lst)
        r = sup.patch(f"/users/{u['id']}", json={"gaji_bulanan": 3000000})
        assert r.status_code == 200 and r.json()["gaji_bulanan"] == 3000000
        assert sup.patch(f"/users/{u['id']}", json={"gaji_bulanan": -1}).status_code == 422

    def test_create_staff_zero_gaji(self, sup, ctx):
        un = f"test_pz{uuid.uuid4().hex[:6]}"
        r = sup.post("/users", json={"nama": "TEST_Pemungut Nol", "username": un, "password": "rahasia123"})
        assert r.status_code == 201
        ctx["users"].append(r.json()["id"]); ctx["uid0"] = r.json()["id"]
        assert r.json()["gaji_bulanan"] == 0


# --- Pengeluaran
class TestPengeluaran:
    def test_non_gaji_validation(self, sup):
        assert sup.post("/pengeluaran", json={"kategori": "barang", "keterangan": "TEST_x"}).status_code == 422
        assert sup.post("/pengeluaran", json={"kategori": "barang", "keterangan": "a", "jumlah": 1000}).status_code == 422
        assert sup.post("/pengeluaran", json={"kategori": "xyz", "keterangan": "TEST_abc", "jumlah": 1000}).status_code == 422

    def test_create_list_delete(self, sup, ctx):
        before = sup.get("/pengeluaran", params={"periode": "harian", "tanggal": T}).json()["total"]
        ids = []
        for k, j in (("barang", 150000), ("daya", 50000), ("operasional", 25000), ("jasa", 10000)):
            r = sup.post("/pengeluaran", json={"kategori": k, "keterangan": f"TEST_{k} uji", "jumlah": j, "tanggal": T})
            assert r.status_code == 201, r.text
            assert r.json()["jumlah"] == j and r.json()["kategori"] == k and r.json()["dicatat_oleh"]
            ids.append(r.json()["id"])
        ctx["peng"] += ids
        d = sup.get("/pengeluaran", params={"periode": "harian", "tanggal": T}).json()
        assert d["total"] == before + 235000
        assert set(ids) <= {x["id"] for x in d["items"]}
        # filter kategori
        d2 = sup.get("/pengeluaran", params={"periode": "harian", "tanggal": T, "kategori": "daya"}).json()
        assert all(x["kategori"] == "daya" for x in d2["items"])
        # delete one
        assert sup.delete(f"/pengeluaran/{ids[-1]}").status_code == 200
        ctx["peng"].remove(ids[-1])
        assert sup.delete(f"/pengeluaran/{ids[-1]}").status_code == 404
        assert sup.get("/pengeluaran", params={"periode": "harian", "tanggal": T}).json()["total"] == before + 225000

    def test_gaji_flow(self, sup, ctx):
        uid = ctx["uid"]
        r = sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": uid, "tanggal": T})
        assert r.status_code == 201, r.text
        g = r.json(); ctx["peng"].append(g["id"])
        assert g["jumlah"] == 3000000
        assert g["penerima"] == "TEST_Pemungut Gaji"
        assert g["periode_gaji"] == T[:7]
        assert g["keterangan"] == "Catu TEST_Pemungut Gaji"
        r2 = sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": uid, "tanggal": T, "jumlah": 100})
        assert r2.status_code == 409, r2.text
        # gaji 0 & no jumlah -> 422; with jumlah -> ok
        assert sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": ctx["uid0"], "tanggal": T}).status_code == 422
        assert sup.post("/pengeluaran", json={"kategori": "gaji", "tanggal": T, "jumlah": 1000}).status_code == 422
        r3 = sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": ctx["uid0"], "tanggal": T, "jumlah": 1200000})
        assert r3.status_code == 201 and r3.json()["jumlah"] == 1200000
        ctx["peng"].append(r3.json()["id"])


# --- Harga Barang
class TestHargaBarang:
    def test_crud_public(self, sup, ctx):
        r = sup.post("/harga-barang", json={"nama": "TEST_Beras Premium", "satuan": "kg", "harga": 15000})
        assert r.status_code == 201, r.text
        h = r.json(); ctx["harga"].append(h["id"])
        pub = httpx.get(f"{BASE}/publik/harga-barang").json()
        assert any(x["id"] == h["id"] and x["harga"] == 15000 for x in pub)
        r = sup.put(f"/harga-barang/{h['id']}", json={"nama": "TEST_Beras Premium", "satuan": "kg", "harga": 16500})
        assert r.status_code == 200 and r.json()["harga"] == 16500
        pub = httpx.get(f"{BASE}/publik/harga-barang").json()
        assert any(x["id"] == h["id"] and x["harga"] == 16500 for x in pub)
        assert sup.put(f"/harga-barang/{uuid.uuid4()}", json={"nama": "TEST_x", "satuan": "kg", "harga": 1}).status_code == 404
        assert sup.post("/harga-barang", json={"nama": "T", "satuan": "kg", "harga": 1}).status_code == 422
        assert sup.post("/harga-barang", json={"nama": "TEST_neg", "satuan": "kg", "harga": -1}).status_code == 422
        h2 = sup.post("/harga-barang", json={"nama": "TEST_Hapus", "satuan": "ikat", "harga": 3000}).json()
        assert sup.delete(f"/harga-barang/{h2['id']}").status_code == 200
        assert all(x["id"] != h2["id"] for x in httpx.get(f"{BASE}/publik/harga-barang").json())


# --- RBAC
class TestRBAC:
    def test_staff_forbidden(self, staff):
        assert staff.get("/pengeluaran").status_code == 403
        assert staff.post("/pengeluaran", json={"kategori": "barang", "keterangan": "TEST_x", "jumlah": 1}).status_code == 403
        assert staff.post("/harga-barang", json={"nama": "TEST_x", "satuan": "kg", "harga": 1}).status_code == 403
        assert staff.put(f"/harga-barang/{uuid.uuid4()}", json={"nama": "TEST_x", "satuan": "kg", "harga": 1}).status_code == 403
        assert staff.delete(f"/harga-barang/{uuid.uuid4()}").status_code == 403
        for k in ("pembayaran", "pengeluaran", "rekap"):
            for e in ("xlsx", "pdf"):
                assert staff.get(f"/laporan/{k}.{e}").status_code == 403
        assert staff.get("/users").status_code == 403

    def test_anon(self):
        assert httpx.get(f"{BASE}/pengeluaran").status_code == 401
        assert httpx.get(f"{BASE}/laporan/rekap.xlsx").status_code == 401
        assert httpx.get(f"{BASE}/publik/harga-barang").status_code == 200


# --- Laporan
def _rows(content):
    ws = load_workbook(io.BytesIO(content)).active
    return [list(r) for r in ws.iter_rows(values_only=True)]


class TestLaporan:
    def test_setup_payment(self, sup, ctx):
        ctx["lid"] = sup.post("/lapak", json={"nama": f"TEST_KEU {uuid.uuid4().hex[:5]}", "harga_sewa": 300000, "iuran": 4000}).json()["id"]
        nik = "51" + "".join(random.choice("0123456789") for _ in range(14))
        ctx["ped"] = sup.post("/pedagang", json={"nama": "TEST_KeuPed", "nik": nik}).json()["id"]
        end = (TODAY + timedelta(days=9)).isoformat()
        ctx["sid"] = sup.post("/sewa", json={"pedagang_id": ctx["ped"], "lapak_id": ctx["lid"], "mulai": T, "selesai": end}).json()["id"]
        r = sup.post("/payments/iuran", json={"sewa_id": ctx["sid"]})
        assert r.status_code == 201, r.text
        ctx["pays"].append(r.json()["id"])
        r = sup.post("/payments/sewa", json={"sewa_id": ctx["sid"], "jumlah": 50000})
        assert r.status_code == 201, r.text
        ctx["pays"].append(r.json()["id"])

    @pytest.mark.parametrize("kind", ["pembayaran", "pengeluaran", "rekap"])
    @pytest.mark.parametrize("periode", ["harian", "bulanan", "tahunan"])
    def test_files(self, sup, kind, periode):
        for ext, sig in (("xlsx", b"PK"), ("pdf", b"%PDF")):
            r = sup.get(f"/laporan/{kind}.{ext}", params={"periode": periode, "tanggal": T})
            assert r.status_code == 200, r.text
            assert r.content[:len(sig)] == sig
            assert "attachment" in r.headers.get("content-disposition", "")

    def test_bad_params(self, sup):
        assert sup.get("/laporan/xyz.xlsx").status_code in (404, 422)
        assert sup.get("/laporan/rekap.csv").status_code in (404, 422)
        assert sup.get("/laporan/rekap.xlsx", params={"periode": "mingguan"}).status_code == 422

    def test_xlsx_contents(self, sup):
        p = {"periode": "harian", "tanggal": T}
        masuk = sup.get("/payments", params=p).json()
        keluar = sup.get("/pengeluaran", params=p).json()
        tp = sum(x["jumlah"] for x in masuk["items"])
        tk = keluar["total"]
        wb = load_workbook(io.BytesIO(sup.get("/laporan/pengeluaran.xlsx", params=p).content))
        n = sum(1 for ws in wb for r in ws.iter_rows(min_row=5, values_only=True) if isinstance(r[0], int))
        assert n == len(keluar["items"])  # template per-kategori (iteration 8)
        rows = _rows(sup.get("/laporan/rekap.xlsx", params=p).content)
        data = [r for r in rows if r[1] in ("Pemasukan", "Pengeluaran")]
        assert len([r for r in data if r[1] == "Pemasukan"]) == len(masuk["items"])
        assert len([r for r in data if r[1] == "Pengeluaran"]) == len(keluar["items"])
        last = [r for r in rows if any(v is not None for v in r)][-1]
        assert "SALDO AKHIR" in str(last[3])
        assert last[4] == tp - tk
        rows = _rows(sup.get("/laporan/pembayaran.xlsx", params=p).content)
        tm = [r for r in rows if "Total Pemasukan" in r]
        assert tm and tm[-1][3] == tp
