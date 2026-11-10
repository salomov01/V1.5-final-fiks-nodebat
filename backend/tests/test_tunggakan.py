# Tunggakan (iuran & sewa arrears) + pengaturan mulai hitung + scan integration tests.
# Relies on temp sewa 'tmp-sewa-tg' (pedagang 01-009, 2026-11-01..30, iuran 5000), app today 2026-11-10.
import os
from datetime import date, timedelta

import httpx
import pytest

BASE = os.environ["BACKEND_URL"].rstrip("/") + "/api"
SID = "tmp-sewa-tg"
UID = "01-009"


def _login(u, p):
    c = httpx.Client(base_url=BASE, timeout=30)
    r = c.post("/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture(scope="module")
def sa():
    c = _login("pengelola", "jimbaran2026")
    yield c
    c.close()


@pytest.fixture(scope="module")
def staff():
    c = _login("pemungut1", "pemungut123")
    yield c
    c.close()


@pytest.fixture(scope="module")
def created(sa):
    ids = []
    yield ids
    for pid in ids:
        sa.delete(f"/payments/{pid}")
    sa.put("/pengaturan/tunggakan", json={"mulai": "2026-11-05"})


def mine(c, key="iuran"):
    d = c.get("/tunggakan").json()
    return next((t for t in d[key] if t["sewa_id"] == SID), None), d


def today(c):
    return c.get("/scan/" + UID).json()["tanggal"]


# --- GET /tunggakan
def test_rekap_structure_and_staff(sa, staff):
    t, d = mine(sa)
    assert set(d) >= {"mulai_hitung", "iuran", "sewa", "total_iuran", "total_sewa"}
    assert t and t["iuran"] == 5000 and t["nama"] == "NGURAH WIJAYA" and t["user_id"] == UID
    assert t["total"] == 5000 * len(t["tanggal"])
    td = today(sa)
    assert all(x < td for x in t["tanggal"]), "today/future must not be counted"
    assert d["total_iuran"] == sum(x["total"] for x in d["iuran"])
    s = next(x for x in d["sewa"] if x["sewa_id"] == SID)
    assert s["sisa"] == s["total_harga"] - s["terbayar"] and s["sisa"] > 0
    assert d["total_sewa"] == sum(x["sisa"] for x in d["sewa"])
    r = staff.get("/tunggakan")
    assert r.status_code == 200 and r.json()["total_iuran"] == d["total_iuran"]


def test_rekap_filter_and_unauth(sa):
    pid = sa.get("/scan/" + UID).json()["pedagang"]["id"]
    d = sa.get("/tunggakan", params={"pedagang_id": pid}).json()
    assert all(x["pedagang_id"] == pid for x in d["iuran"] + d["sewa"]) and d["iuran"]
    d2 = sa.get("/tunggakan", params={"pedagang_id": "nope"}).json()
    assert d2["iuran"] == [] and d2["sewa"] == [] and d2["total_iuran"] == 0
    assert httpx.get(BASE + "/tunggakan").status_code == 401


# --- pengaturan
def test_pengaturan(sa, staff, created):
    assert sa.get("/pengaturan/tunggakan").json()["mulai"] == "2026-11-05"
    assert staff.get("/pengaturan/tunggakan").status_code == 200
    assert staff.put("/pengaturan/tunggakan", json={"mulai": "2026-11-03"}).status_code == 403
    fut = (date.fromisoformat(today(sa)) + timedelta(days=1)).isoformat()
    assert sa.put("/pengaturan/tunggakan", json={"mulai": fut}).status_code == 422
    assert sa.put("/pengaturan/tunggakan", json={"mulai": "11/03/2026"}).status_code == 422
    r = sa.put("/pengaturan/tunggakan", json={"mulai": "2026-11-03"})
    assert r.status_code == 200 and r.json()["mulai"] == "2026-11-03"
    t, d = mine(sa)
    assert d["mulai_hitung"] == "2026-11-03"
    assert t["tanggal"][:2] == ["2026-11-03", "2026-11-04"] and "2026-11-05" not in t["tanggal"]
    # mulai before sewa start: clipped to sewa.mulai
    sa.put("/pengaturan/tunggakan", json={"mulai": "2026-10-01"})
    t, _ = mine(sa)
    assert t["tanggal"][0] == "2026-11-01"
    assert sa.put("/pengaturan/tunggakan", json={"mulai": "2026-11-05"}).status_code == 200


# --- bayar tunggakan iuran
def test_bayar_tunggakan_iuran_flow(sa, staff, created):
    t, _ = mine(sa)
    assert t["tanggal"] == ["2026-11-07", "2026-11-08", "2026-11-09"]
    r = staff.post("/payments/tunggakan-iuran", json={"sewa_id": SID, "tanggal": ["2026-11-07"]})
    assert r.status_code == 201, r.text
    p = r.json(); created.append(p["id"])
    assert p["jumlah"] == 5000 and p["jenis"] == "iuran" and p["tanggal_iuran"] == ["2026-11-07"]
    assert p["periode"] == "Tunggakan 1 hari: 2026-11-07" and p["penagih"]
    t, _ = mine(sa)
    assert t["tanggal"] == ["2026-11-08", "2026-11-09"]
    # 409 cases
    for bad in (["2026-11-07"], ["2026-11-08", "2026-11-07"], [today(sa)], ["2026-11-11"], ["2026-11-04"], ["2026-10-30"]):
        rr = sa.post("/payments/tunggakan-iuran", json={"sewa_id": SID, "tanggal": bad})
        assert rr.status_code == 409, (bad, rr.status_code, rr.text)
    # failed attempt must not leave locks for valid dates
    t, _ = mine(sa)
    assert t["tanggal"] == ["2026-11-08", "2026-11-09"]
    assert sa.post("/payments/tunggakan-iuran", json={"sewa_id": SID, "tanggal": []}).status_code == 422
    assert sa.post("/payments/tunggakan-iuran", json={"sewa_id": "nope", "tanggal": ["2026-11-08"]}).status_code == 404
    # pay multiple (with duplicate in input) -> one payment
    r = sa.post("/payments/tunggakan-iuran", json={"sewa_id": SID, "tanggal": ["2026-11-09", "2026-11-08", "2026-11-09"]})
    assert r.status_code == 201, r.text
    p2 = r.json(); created.append(p2["id"])
    assert p2["jumlah"] == 10000 and p2["tanggal_iuran"] == ["2026-11-08", "2026-11-09"]
    assert p2["periode"] == "Tunggakan 2 hari: 2026-11-08, 2026-11-09"
    t, _ = mine(sa)
    assert t is None
    k = sa.get(f"/payments/{p2['id']}/kuitansi")
    assert k.status_code == 200 and k.json()["payment"]["jumlah"] == 10000
    # staff cannot delete
    assert staff.delete(f"/payments/{p2['id']}").status_code == 403
    # delete restores
    assert sa.delete(f"/payments/{p2['id']}").json()["deleted"] is True
    created.remove(p2["id"])
    t, _ = mine(sa)
    assert t["tanggal"] == ["2026-11-08", "2026-11-09"]
    assert sa.delete(f"/payments/{p['id']}").status_code == 200
    created.remove(p["id"])
    t, _ = mine(sa)
    assert t["tanggal"] == ["2026-11-07", "2026-11-08", "2026-11-09"]


# --- today's iuran vs tunggakan
def test_today_iuran_independent(sa, created):
    td = today(sa)
    pays = sa.get("/payments", params={"periode": "harian", "tanggal": td, "jenis": "iuran"}).json()["items"]
    todays = [x for x in pays if x["sewa_id"] == SID and x["tanggal_iuran"] == [td]]
    for x in todays:
        assert sa.delete(f"/payments/{x['id']}").status_code == 200
    scan = sa.get("/scan/" + UID).json()
    s = next(x for x in scan["sewa"] if x["id"] == SID)
    assert s["iuran_hari_ini_lunas"] is False
    t, _ = mine(sa)
    assert td not in t["tanggal"]
    r = sa.post("/payments/tunggakan-iuran", json={"sewa_id": SID, "tanggal": ["2026-11-07"]})
    assert r.status_code == 201; created.append(r.json()["id"])
    scan = sa.get("/scan/" + UID).json()
    assert next(x for x in scan["sewa"] if x["id"] == SID)["iuran_hari_ini_lunas"] is False
    assert scan["tunggakan"]["iuran"][0]["tanggal"] == ["2026-11-08", "2026-11-09"]
    r = sa.post("/payments/iuran", json={"sewa_id": SID})
    assert r.status_code == 201, r.text  # today's payment stays (recreates initial state)
    assert r.json()["tanggal_iuran"] == [td]
    scan = sa.get("/scan/" + UID).json()
    assert next(x for x in scan["sewa"] if x["id"] == SID)["iuran_hari_ini_lunas"] is True
    t, _ = mine(sa)
    assert td not in t["tanggal"]
    assert sa.post("/payments/iuran", json={"sewa_id": SID}).status_code == 409


# --- sewa tunggakan partial payment
def test_sewa_partial(staff, sa, created):
    s0, _ = mine(sa, "sewa")
    r = staff.post("/payments/sewa", json={"sewa_id": SID, "jumlah": 50000})
    assert r.status_code == 201, r.text
    created.append(r.json()["id"])
    assert r.json()["sisa_setelah"] == s0["sisa"] - 50000
    s1, _ = mine(sa, "sewa")
    assert s1["sisa"] == s0["sisa"] - 50000 and s1["terbayar"] == s0["terbayar"] + 50000
    scan = staff.get("/scan/" + UID).json()
    assert next(x for x in scan["tunggakan"]["sewa"] if x["sewa_id"] == SID)["sisa"] == s1["sisa"]
