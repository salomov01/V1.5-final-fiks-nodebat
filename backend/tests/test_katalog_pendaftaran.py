"""Katalog lapak publik, pendaftaran calon penyewa, konfirmasi admin, kedaluwarsa sewa.

Run against public URL:  BACKEND_URL=$REACT_APP_BACKEND_URL pytest tests/test_katalog_pendaftaran.py
The 5/hour/IP rate limit keys on the real client IP (spoofed X-Forwarded-For is ignored),
so TEST_ registrations are wiped from Mongo before each test.
"""

import secrets
import uuid
from datetime import date, timedelta

import os

import httpx
import pytest
from dotenv import load_dotenv
from pymongo import MongoClient

from tests.conftest import API_URL


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
_db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def _bersihkan_pendaftaran():
    _db.pendaftaran.delete_many({"nama": {"$regex": "^TEST_"}})
    yield
    _db.pendaftaran.delete_many({"nama": {"$regex": "^TEST_"}})


def _hp():
    return f"0812{secrets.randbelow(10**8):08d}"


def _pub():
    return httpx.Client(base_url=API_URL, timeout=30.0)


@pytest.fixture
def unit(auth_client):
    """TEST_ stall created in the catalog, deleted afterwards (plus any tenant created on it)."""
    blok = f"TEST_Blok {uuid.uuid4().hex[:6]}"
    r = auth_client.post("/lapak-unit", json={"blok": blok, "jenis": "Uji", "kategori": "bulanan", "tarif": 123000})
    assert r.status_code == 201, r.text
    u = r.json()
    yield u
    for t in auth_client.get("/tenants").json():
        if t["blok"] == blok:
            auth_client.delete(f"/tenants/{t['id']}")
    auth_client.delete(f"/lapak-unit/{u['id']}")


def _daftar(lapak_id, nama="TEST_Pendaftar", no_hp=None):
    with _pub() as c:
        return c.post("/publik/pendaftaran", json={"nama": nama, "no_hp": no_hp or _hp(), "lapak_id": lapak_id,
                                                    "catatan": "uji"})


# --- Public access & privacy ---
def test_public_lapak_kosong_no_auth_no_pii():
    with _pub() as c:
        r = c.get("/publik/lapak-kosong")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for item in data:
        assert set(item.keys()) == {"id", "blok", "jenis", "kategori", "tarif", "deskripsi", "foto_url"}


@pytest.mark.parametrize("path", ["/lapak-unit", "/pendaftaran", "/tenants", "/payments"])
def test_admin_endpoints_require_session(path):
    with _pub() as c:
        assert c.get(path).status_code == 401


# --- Unit CRUD ---
def test_unit_create_appears_public_update_delete(auth_client, unit):
    with _pub() as c:
        ids = [x["id"] for x in c.get("/publik/lapak-kosong").json()]
    assert unit["id"] in ids
    lst = {x["id"]: x for x in auth_client.get("/lapak-unit").json()}
    assert lst[unit["id"]]["status"] == "kosong"
    r = auth_client.put(f"/lapak-unit/{unit['id']}", json={"tarif": 150000})
    assert r.status_code == 200 and r.json()["tarif"] == 150000
    dup = auth_client.post("/lapak-unit", json={"blok": unit["blok"], "kategori": "harian", "tarif": 1})
    assert dup.status_code == 409


# --- Registration + approval flow ---
def test_register_approve_creates_tenant_and_autorejects_others(auth_client, unit):
    r1 = _daftar(unit["id"], nama="TEST_Satu")
    r2 = _daftar(unit["id"], nama="TEST_Dua")
    assert r1.status_code == 201 and r2.status_code == 201, (r1.text, r2.text)
    p1, p2 = r1.json(), r2.json()
    assert p1["status"] == "baru" and p1["blok"] == unit["blok"] and p1["tarif"] == unit["tarif"]
    listed = {x["id"]: x for x in auth_client.get("/pendaftaran?status=baru").json()}
    assert p1["id"] in listed and "ip" not in listed[p1["id"]]

    t = auth_client.post(f"/pendaftaran/{p1['id']}/terima", json={})
    assert t.status_code == 200, t.text
    tenant = t.json()
    assert tenant["nomor_id"].startswith("LPK-JMB-") and tenant["blok"] == unit["blok"]
    assert tenant["nama_lengkap"] == "TEST_Satu"

    all_p = {x["id"]: x for x in auth_client.get("/pendaftaran").json()}
    assert all_p[p1["id"]]["status"] == "diterima"
    assert all_p[p1["id"]]["tenant_nomor_id"] == tenant["nomor_id"]
    assert all_p[p2["id"]]["status"] == "ditolak"

    with _pub() as c:
        assert unit["id"] not in [x["id"] for x in c.get("/publik/lapak-kosong").json()]
    st = {x["id"]: x for x in auth_client.get("/lapak-unit").json()}[unit["id"]]
    assert st["status"] == "terisi" and st["terisi_sampai"] == tenant["selesai"]

    # occupied -> 409 for new public registration
    assert _daftar(unit["id"]).status_code == 409
    # re-accepting -> 409
    assert auth_client.post(f"/pendaftaran/{p1['id']}/terima", json={}).status_code == 409

    # Expiry: selesai yesterday -> stall back on public page
    yesterday = (date.today() - timedelta(days=2)).isoformat()
    mulai = (date.today() - timedelta(days=40)).isoformat()
    u = auth_client.put(f"/tenants/{tenant['id']}", json={"mulai": mulai, "selesai": yesterday})
    assert u.status_code == 200, u.text
    with _pub() as c:
        assert unit["id"] in [x["id"] for x in c.get("/publik/lapak-kosong").json()]

    # status berhenti also frees it
    auth_client.put(f"/tenants/{tenant['id']}", json={"selesai": "2099-01-01"})
    with _pub() as c:
        assert unit["id"] not in [x["id"] for x in c.get("/publik/lapak-kosong").json()]
    auth_client.put(f"/tenants/{tenant['id']}", json={"status": "berhenti"})
    with _pub() as c:
        assert unit["id"] in [x["id"] for x in c.get("/publik/lapak-kosong").json()]


def test_tolak(auth_client, unit):
    p = _daftar(unit["id"]).json()
    r = auth_client.post(f"/pendaftaran/{p['id']}/tolak", json={})
    assert r.status_code == 200 and r.json()["status"] == "ditolak"
    assert auth_client.post(f"/pendaftaran/{p['id']}/tolak", json={}).status_code == 409


def test_terima_invalid_dates_422(auth_client, unit):
    p = _daftar(unit["id"]).json()
    r = auth_client.post(f"/pendaftaran/{p['id']}/terima", json={"mulai": "2026-05-10", "selesai": "2026-05-01"})
    assert r.status_code == 422


def test_validation_errors():
    assert _daftar(str(uuid.uuid4())).status_code == 404
    with _pub() as c:
        r = c.post("/publik/pendaftaran", json={"nama": "A", "no_hp": "abc", "lapak_id": "x"})
    assert r.status_code == 422


def test_duplicate_phone_same_stall_409(unit):
    hp = _hp()
    assert _daftar(unit["id"], no_hp=hp).status_code == 201
    assert _daftar(unit["id"], no_hp=hp).status_code == 409


@pytest.mark.skipif("localhost" in API_URL, reason="uvicorn --proxy-headers trusts 127.0.0.1; run against the public URL")
def test_spoofed_xff_does_not_bypass_rate_limit(unit):
    codes = []
    with _pub() as c:
        for i in range(6):
            codes.append(c.post("/publik/pendaftaran", json={"nama": "TEST_Spoof", "no_hp": _hp(), "lapak_id": unit["id"]},
                                headers={"X-Forwarded-For": f"10.0.0.{i + 1}"}).status_code)
    assert codes[:5] == [201] * 5 and codes[5] == 429, codes
