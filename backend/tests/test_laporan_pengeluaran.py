"""Iteration 8: Pegawai CRUD, penerima-gaji, gaji via pegawai, catatan, template export Pengeluaran (xlsx/pdf).
Run: BACKEND_URL=$REACT_APP_BACKEND_URL pytest tests/test_laporan_pengeluaran.py -n0 -p no:randomly
Uses isolated far-future month 2031-03 so exported rows are deterministic.
"""
import io
import os
import re
import uuid
from datetime import date

import httpx
import pytest
from openpyxl import load_workbook

BASE = os.environ["BACKEND_URL"].rstrip("/") + "/api"
M = "2031-03"
SHEETS = ["Barang", "Jasa", "Daya", "Operasional lain-lain", "Gaji"]


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
    c = {"peng": [], "peg": [], "users": []}
    yield c
    for pid in c["peng"]:
        sup.delete(f"/pengeluaran/{pid}")
    for pid in c["peg"]:
        sup.delete(f"/pengeluaran/pegawai/{pid}")
    for uid in c["users"]:
        sup.delete(f"/users/{uid}")


# --- Pegawai CRUD + RBAC
class TestPegawai:
    def test_crud(self, sup, ctx):
        r = sup.post("/pengeluaran/pegawai", json={"nama": "TEST_Wayan Kader", "jabatan": "Mangku Pasar", "gaji_bulanan": 750000})
        assert r.status_code == 201, r.text
        p = r.json(); ctx["peg"].append(p["id"]); ctx["peg_id"] = p["id"]
        assert p["nama"] == "TEST_Wayan Kader" and p["gaji_bulanan"] == 750000 and p["jabatan"] == "Mangku Pasar"
        assert "_id" not in p
        lst = sup.get("/pengeluaran/pegawai").json()
        assert any(x["id"] == p["id"] for x in lst)
        r = sup.put(f"/pengeluaran/pegawai/{p['id']}", json={"nama": "TEST_Wayan Kader", "jabatan": "Mangku", "gaji_bulanan": 800000})
        assert r.status_code == 200 and r.json()["gaji_bulanan"] == 800000
        assert any(x["id"] == p["id"] and x["gaji_bulanan"] == 800000 and x["jabatan"] == "Mangku" for x in sup.get("/pengeluaran/pegawai").json())
        assert sup.put(f"/pengeluaran/pegawai/{uuid.uuid4()}", json={"nama": "TEST_x", "gaji_bulanan": 1}).status_code == 404
        assert sup.post("/pengeluaran/pegawai", json={"nama": "T"}).status_code == 422
        assert sup.post("/pengeluaran/pegawai", json={"nama": "TEST_neg", "gaji_bulanan": -5}).status_code == 422
        # delete
        d = sup.post("/pengeluaran/pegawai", json={"nama": "TEST_Hapus Peg"}).json()
        assert sup.delete(f"/pengeluaran/pegawai/{d['id']}").status_code == 200
        assert sup.delete(f"/pengeluaran/pegawai/{d['id']}").status_code == 404
        assert all(x["id"] != d["id"] for x in sup.get("/pengeluaran/pegawai").json())

    def test_staff_forbidden(self, staff):
        assert staff.get("/pengeluaran/pegawai").status_code == 403
        assert staff.post("/pengeluaran/pegawai", json={"nama": "TEST_x"}).status_code == 403
        assert staff.put(f"/pengeluaran/pegawai/{uuid.uuid4()}", json={"nama": "TEST_x"}).status_code == 403
        assert staff.delete(f"/pengeluaran/pegawai/{uuid.uuid4()}").status_code == 403
        assert staff.get("/pengeluaran/penerima-gaji").status_code == 403

    def test_penerima_gaji(self, sup, ctx):
        un = f"test_pg{uuid.uuid4().hex[:6]}"
        r = sup.post("/users", json={"nama": "TEST_Akun Pemungut", "username": un, "password": "rahasia123", "role": "staff", "gaji_bulanan": 1500000})
        assert r.status_code == 201, r.text
        ctx["users"].append(r.json()["id"]); ctx["uid"] = r.json()["id"]
        lst = sup.get("/pengeluaran/penerima-gaji").json()
        peg = [x for x in lst if x["id"] == ctx["peg_id"]]
        akun = [x for x in lst if x["id"] == ctx["uid"]]
        assert peg and peg[0]["sumber"] == "pegawai" and peg[0]["gaji_bulanan"] == 800000
        assert akun and akun[0]["sumber"] == "akun" and akun[0]["jabatan"] == "Pemungut"
        assert not any(x["sumber"] == "akun" and x["nama"] == "pengelola" for x in lst)


# --- Pengeluaran gaji + catatan
class TestPengeluaranV2:
    def test_gaji_pegawai(self, sup, ctx):
        r = sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": ctx["peg_id"], "tanggal": f"{M}-25", "catatan": "TEST_transfer"})
        assert r.status_code == 201, r.text
        g = r.json(); ctx["peng"].append(g["id"])
        assert g["jumlah"] == 800000 and g["keterangan"] == "Catu TEST_Wayan Kader" and g["periode_gaji"] == M
        assert g["catatan"] == "TEST_transfer" and g["penerima"] == "TEST_Wayan Kader"
        assert sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": ctx["peg_id"], "tanggal": f"{M}-26"}).status_code == 409

    def test_gaji_akun(self, sup, ctx):
        r = sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": ctx["uid"], "tanggal": f"{M}-05"})
        assert r.status_code == 201, r.text
        ctx["peng"].append(r.json()["id"])
        assert r.json()["jumlah"] == 1500000 and r.json()["keterangan"] == "Catu TEST_Akun Pemungut"
        assert sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": ctx["uid"], "tanggal": f"{M}-28"}).status_code == 409
        assert sup.post("/pengeluaran", json={"kategori": "gaji", "pemungut_id": str(uuid.uuid4()), "tanggal": f"{M}-05", "jumlah": 5}).status_code == 422

    def test_non_gaji(self, sup, ctx):
        assert sup.post("/pengeluaran", json={"kategori": "jasa", "keterangan": "x", "jumlah": 1000, "tanggal": f"{M}-01"}).status_code == 422
        assert sup.post("/pengeluaran", json={"kategori": "jasa", "keterangan": "TEST_ok"}).status_code == 422
        # inserted out of order to verify sort by tanggal
        for k, ket, j, t, cat in (("barang", "TEST_Plastik sampah", 45000, "20", "nota 12"), ("barang", "TEST_Sapu lidi", 30000, "03", ""),
                                  ("jasa", "TEST_Tk sapu 7hr", 700000, "10", "=HYPERLINK(1)"), ("daya", "TEST_Listrik PLN", 250000, "15", "token"),
                                  ("operasional", "TEST_A & B <x>", 12000, "12", "R&D <b>")):
            r = sup.post("/pengeluaran", json={"kategori": k, "keterangan": ket, "jumlah": j, "tanggal": f"{M}-{t}", "catatan": cat})
            assert r.status_code == 201, r.text
            assert r.json()["catatan"] == cat
            ctx["peng"].append(r.json()["id"])
        lst = sup.get("/pengeluaran", params={"periode": "bulanan", "tanggal": f"{M}-01"}).json()
        assert {x["id"] for x in lst["items"]} >= set(ctx["peng"])
        assert any(x["catatan"] == "nota 12" for x in lst["items"])


# --- Template export
class TestExport:
    def _wb(self, sup, periode, tgl):
        r = sup.get("/laporan/pengeluaran.xlsx", params={"periode": periode, "tanggal": tgl})
        assert r.status_code == 200, r.text
        return load_workbook(io.BytesIO(r.content))

    def test_xlsx_bulanan(self, sup):
        wb = self._wb(sup, "bulanan", f"{M}-14")
        assert wb.sheetnames == SHEETS
        exp_title = {"Barang": "BIAYA BARANG", "Jasa": "JASA", "Daya": "DAYA", "Operasional lain-lain": "OPERASIONAL LAIN", "Gaji": "GAJI"}
        for name in SHEETS:
            ws = wb[name]
            assert ws["A1"].value == "LAPORAN"
            assert ws["A2"].value == f"PENGELUARAN {exp_title[name]} BULAN MARET 2031", ws["A2"].value
            hdr = [c.value for c in ws[4]][:5]
            assert hdr[0] == "No." and hdr[1] == "Tanggal" and hdr[4] == "Keterangan"
            assert hdr[2] == ("Barang" if name == "Barang" else "Kegiatan")
            assert hdr[3] == ("Harga" if name == "Barang" else "Nilai")
            vals = [v for r in ws.iter_rows(values_only=True) for v in r if v is not None]
            assert "I Wayan Mushadi" in vals
            assert any(isinstance(v, str) and v.startswith("=SUM(D5:D") for v in vals) or name not in ("Barang",)
        b = wb["Barang"]
        rows = [r for r in b.iter_rows(min_row=5, values_only=True) if isinstance(r[0], int)]
        assert [r[0] for r in rows] == [1, 2]
        assert rows[0][2] == "TEST_Sapu lidi" and rows[1][2] == "TEST_Plastik sampah"  # sorted by tanggal
        assert rows[1][4] == "nota 12" and rows[1][3] == 45000
        assert rows[0][1].date() == date(2031, 3, 3)
        tot = [r for r in b.iter_rows(values_only=True) if r[2] == "Total"]
        assert tot and tot[0][3] == "=SUM(D5:D6)"
        j = wb["Jasa"]
        jr = [r for r in j.iter_rows(min_row=5, values_only=True) if isinstance(r[0], int)]
        assert jr[0][4] == "'=HYPERLINK(1)"  # formula injection escaped
        g = [r for r in wb["Gaji"].iter_rows(min_row=5, values_only=True) if isinstance(r[0], int)]
        assert [r[2] for r in g] == ["Catu TEST_Akun Pemungut", "Catu TEST_Wayan Kader"]
        assert g[1][4] == "TEST_transfer"

    def test_xlsx_harian_tahunan(self, sup):
        wb = self._wb(sup, "harian", f"{M}-03")
        assert wb["Barang"]["A2"].value == "PENGELUARAN BIAYA BARANG TANGGAL 03 MARET 2031"
        assert len([r for r in wb["Barang"].iter_rows(min_row=5, values_only=True) if isinstance(r[0], int)]) == 1
        # empty sheet total 0
        assert any(r[2] == "Total" and r[3] == 0 for r in wb["Gaji"].iter_rows(values_only=True))
        wb = self._wb(sup, "tahunan", f"{M}-03")
        assert wb["Daya"]["A2"].value == "PENGELUARAN DAYA TAHUN 2031"

    @pytest.mark.parametrize("periode", ["harian", "bulanan", "tahunan"])
    def test_pdf(self, sup, periode):
        r = sup.get("/laporan/pengeluaran.pdf", params={"periode": periode, "tanggal": f"{M}-12"})
        assert r.status_code == 200, r.text[:300]
        assert r.content[:4] == b"%PDF"
        pages = len(re.findall(rb"/Type\s*/Page[^s]", r.content))
        assert pages == 5, pages

    def test_regression_others(self, sup):
        for k in ("pembayaran", "rekap"):
            for e in ("xlsx", "pdf"):
                r = sup.get(f"/laporan/{k}.{e}", params={"periode": "bulanan", "tanggal": f"{M}-12"})
                assert r.status_code == 200
        ws = load_workbook(io.BytesIO(sup.get("/laporan/rekap.xlsx", params={"periode": "bulanan", "tanggal": f"{M}-12"}).content)).active
        rows = [r for r in ws.iter_rows(values_only=True) if any(v is not None for v in r)]
        assert "SALDO AKHIR" in str(rows[-1][3])
        assert rows[-1][4] == 0 - (800000 + 1500000 + 45000 + 30000 + 700000 + 250000 + 12000)
