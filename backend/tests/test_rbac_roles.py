"""RBAC Super Admin vs Staff, Info Pasar/Berita, users mgmt, Excel header, scan penagih, deactivation."""
import io
import os
import uuid

import httpx
import pytest
from openpyxl import load_workbook

from tests.conftest import ADMIN_CREDENTIAL_LOCK, ADMIN_PASSWORD, ADMIN_USERNAME, API_URL

STAFF_U, STAFF_P = "pemungut1", "pemungut123"
J = {"Content-Type": "application/json"}


def _login(u, p):
    c = httpx.Client(base_url=API_URL, timeout=30)
    r = c.post("/auth/login", json={"username": u, "password": p}, headers=J)
    assert r.status_code == 200, r.text
    return c


@pytest.fixture(scope="module")
def admin():
    with ADMIN_CREDENTIAL_LOCK:
        c = _login(ADMIN_USERNAME, ADMIN_PASSWORD)
    yield c
    c.close()
    # Bersihkan akun uji "test_*" agar tidak menumpuk di daftar akun.
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]].users.delete_many({"username": {"$regex": "^test_"}})


@pytest.fixture(scope="module")
def staff():
    c = _login(STAFF_U, STAFF_P)
    yield c
    c.close()


@pytest.fixture(scope="module")
def tenant(admin):
    r = admin.post("/tenants", headers=J, json={
        "nama_lengkap": "TEST_RBAC Penyewa", "no_hp": "081200000" + str(uuid.uuid4().int % 1000).zfill(3),
        "kategori": "bulanan", "blok": "Z-99", "tarif": 150000, "status": "aktif", "mulai": "2026-01-01", "selesai": "2026-12-31",
    })
    assert r.status_code in (200, 201), r.text
    t = r.json()
    yield t
    admin.delete(f"/tenants/{t['id']}")


# --- auth / identity
def test_login_by_email():
    with ADMIN_CREDENTIAL_LOCK:
        c = _login(os.environ.get("ADMIN_EMAIL", "salomovbobo1@gmail.com"), ADMIN_PASSWORD)
    me = c.get("/auth/me").json()
    assert me["role"] == "super_admin" and me["username"] == ADMIN_USERNAME
    c.close()


def test_staff_me(staff):
    me = staff.get("/auth/me").json()
    assert me["role"] == "staff" and me["nama"] == "I Made Pemungut"


# --- staff forbidden
@pytest.mark.parametrize("method,path,body", [
    ("PUT", "/tenants/{tid}", {"nama_lengkap": "X"}),
    ("DELETE", "/tenants/{tid}", None),
    ("PATCH", "/payments/{pid}/confirm", None),
    ("PATCH", "/payments/{pid}/reject", None),
    ("DELETE", "/payments/{pid}", None),
    ("GET", "/laporan/pembayaran.xlsx", None),
    ("GET", "/users", None),
    ("POST", "/users", {"nama": "x y", "username": "zzz", "password": "12345678"}),
    ("PUT", "/info-pasar", {"jam_buka": "05:00", "jam_tutup": "12:00", "mode": "buka", "pengumuman": ""}),
    ("POST", "/berita", {"judul": "TEST_x", "isi": "abc", "tanggal": "2026-01-01"}),
    ("PUT", "/lapak-unit/xx", {"nama": "x"}),
    ("DELETE", "/lapak-unit/xx", None),
    ("POST", "/pendaftaran/xx/terima", {}),
    ("POST", "/pendaftaran/xx/tolak", None),
])
def test_staff_forbidden(staff, admin, tenant, method, path, body):
    pay = admin.post("/payments", headers=J, json={"tenant_id": tenant["id"], "periode": "TEST_P", "jumlah": 1000, "metode": "tunai"})
    pid = pay.json()["id"]
    url = path.format(tid=tenant["id"], pid=pid)
    r = staff.request(method, url, json=body, headers=J if body is not None else {})
    admin.delete(f"/payments/{pid}")
    assert r.status_code == 403, f"{method} {url} -> {r.status_code} {r.text[:200]}"


def test_staff_dashboard_money_null(staff):
    d = staff.get("/dashboard/stats").json()
    assert d["nilai_menunggu"] is None and d["pemasukan_bulan_ini"] is None
    assert d["pemasukan_bulan_lalu"] is None and d["revenue_6m"] is None


def test_admin_dashboard_money(admin):
    d = admin.get("/dashboard/stats").json()
    assert isinstance(d["pemasukan_bulan_ini"], int) and isinstance(d["revenue_6m"], list)


def test_overdue_total(staff, admin):
    assert staff.get("/payments/overdue").json()["total_tunggakan"] is None
    assert isinstance(admin.get("/payments/overdue").json()["total_tunggakan"], int)


# --- staff allowed
def test_staff_create_tenant_and_payment(staff, admin):
    r = staff.post("/tenants", headers=J, json={
        "nama_lengkap": "TEST_Staff Penyewa", "no_hp": "081299999111", "kategori": "harian",
        "blok": "Z-98", "tarif": 5000, "status": "aktif", "mulai": "2026-01-01", "selesai": "2026-12-31"})
    assert r.status_code in (200, 201), r.text
    tid = r.json()["id"]
    p = staff.post("/payments", headers=J, json={"tenant_id": tid, "periode": "TEST_Staff", "jumlah": 5000, "metode": "tunai", "penagih": "Hacker"})
    assert p.status_code == 201, p.text
    assert p.json()["penagih"] == "I Made Pemungut"
    admin.delete(f"/payments/{p.json()['id']}")
    admin.delete(f"/tenants/{tid}")


def test_scan_collect_penagih_forced(staff, admin, tenant):
    r = staff.post("/payments/scan-collect", headers=J, json={"tenant_id": tenant["id"], "sudah_bayar": True, "penagih": "Orang Lain"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["penagih"] == "I Made Pemungut" and body["status"] == "lunas"
    admin.delete(f"/payments/{body['id']}")


# --- excel header
def test_excel_header(admin):
    r = admin.get("/laporan/pembayaran.xlsx")
    assert r.status_code == 200
    ws = load_workbook(io.BytesIO(r.content)).active
    hdr = [ws.cell(row=5, column=i).value for i in range(1, 8)]
    assert hdr == ["Nama", "ID", "Periode Sewa", "Harga/Jumlah (Rp)", "Penagih", "Tanggal", "Status"]
    assert ws.cell(row=5, column=8).value is None


# --- info pasar & berita
def test_info_pasar_and_berita(admin):
    orig = httpx.get(f"{API_URL}/publik/info-pasar").json()
    try:
        r = admin.put("/info-pasar", headers=J, json={"jam_buka": "06:00", "jam_tutup": "11:00", "mode": "tutup", "pengumuman": "TEST_tutup"})
        assert r.status_code == 200 and r.json()["buka_sekarang"] is False
        pub = httpx.get(f"{API_URL}/publik/info-pasar").json()
        assert pub["mode"] == "tutup" and pub["jam_buka"] == "06:00" and pub["pengumuman"] == "TEST_tutup"
        r = admin.put("/info-pasar", headers=J, json={"jam_buka": "06:00", "jam_tutup": "11:00", "mode": "buka", "pengumuman": ""})
        assert r.json()["buka_sekarang"] is True
        bad = admin.put("/info-pasar", headers=J, json={"jam_buka": "12:00", "jam_tutup": "11:00", "mode": "buka", "pengumuman": ""})
        assert bad.status_code == 422
    finally:
        admin.put("/info-pasar", headers=J, json={k: orig[k] for k in ("jam_buka", "jam_tutup", "mode", "pengumuman")})

    b = admin.post("/berita", headers=J, json={"judul": "TEST_Berita", "isi": "isi berita", "tanggal": "2026-01-15"})
    assert b.status_code == 201
    bid = b.json()["id"]
    assert any(x["id"] == bid for x in httpx.get(f"{API_URL}/publik/berita").json())
    u = admin.put(f"/berita/{bid}", headers=J, json={"judul": "TEST_Berita2", "isi": "isi", "tanggal": "2026-01-15"})
    assert u.status_code == 200
    assert [x for x in httpx.get(f"{API_URL}/publik/berita").json() if x["id"] == bid][0]["judul"] == "TEST_Berita2"
    assert admin.delete(f"/berita/{bid}").status_code == 200
    assert not any(x["id"] == bid for x in httpx.get(f"{API_URL}/publik/berita").json())
    assert admin.delete(f"/berita/{bid}").status_code == 404


# --- users mgmt + deactivation
def test_user_lifecycle(admin):
    uname = f"test_{uuid.uuid4().hex[:6]}"
    r = admin.post("/users", headers=J, json={"nama": "TEST Staff", "username": uname, "password": "rahasia123", "role": "staff"})
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    assert admin.post("/users", headers=J, json={"nama": "TEST Staff", "username": uname, "password": "rahasia123"}).status_code == 409
    s = _login(uname, "rahasia123")
    assert s.get("/auth/me").status_code == 200
    # deactivate -> session 401, login 401
    r = admin.patch(f"/users/{uid}", headers=J, json={"aktif": False})
    assert r.status_code == 200 and r.json()["aktif"] is False
    assert s.get("/auth/me").status_code == 401
    assert s.get("/tenants").status_code == 401
    r2 = httpx.post(f"{API_URL}/auth/login", json={"username": uname, "password": "rahasia123"})
    assert r2.status_code == 401
    # reactivate + reset password
    admin.patch(f"/users/{uid}", headers=J, json={"aktif": True, "password": "baru12345"})
    _login(uname, "baru12345").close()
    # self-deactivate blocked
    me = admin.get("/auth/me").json()
    assert admin.patch(f"/users/{me['id']}", headers=J, json={"aktif": False}).status_code == 409
    # cleanup: deactivate (no delete endpoint)
    admin.patch(f"/users/{uid}", headers=J, json={"aktif": False})
