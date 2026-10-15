"""Criterion: Tambah/ubah/hapus penyewa lapak lewat browser (POST/PUT/DELETE).

Main risk from the security audit: the new CSRF/content-type middleware could
block legitimate same-origin JSON requests. This file proves:
  - a legit JSON request (no Sec-Fetch-Site, or same-origin) succeeds (happy path)
  - a request carrying `Sec-Fetch-Site: cross-site` is rejected 403 (required negative case)
  - a write with a non-JSON Content-Type is rejected 415 (required negative case)
  - full tenant lifecycle (create -> auto nomor_id -> update -> delete) works
"""

import uuid

import pytest


TENANT_PAYLOAD = {
    "nama_lengkap": "",
    "no_hp": "0812-0000-0000",
    "kategori": "harian",
    "blok": "Blok Uji Coba",
    "tarif": 25000,
    "mulai": "2026-09-01",
    "selesai": "2026-12-31",
    "status": "aktif",
    "catatan": "fixture testing",
}


def _payload():
    p = dict(TENANT_PAYLOAD)
    p["nama_lengkap"] = f"tscheck-tenant-{uuid.uuid4().hex[:8]}"
    return p


def test_create_update_delete_tenant_happy_path(auth_client):
    payload = _payload()
    created = auth_client.post("/tenants", json=payload)
    assert created.status_code == 201, created.text
    tenant = created.json()
    assert tenant["nomor_id"].startswith("LPK-JMB-")
    assert tenant["nama_lengkap"] == payload["nama_lengkap"]

    updated = auth_client.put(f"/tenants/{tenant['id']}", json={"blok": "Blok Uji Coba Diubah"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["blok"] == "Blok Uji Coba Diubah"

    deleted = auth_client.delete(f"/tenants/{tenant['id']}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["deleted"] is True

    gone = auth_client.get(f"/tenants/{tenant['id']}")
    assert gone.status_code == 404


def test_cross_site_write_is_rejected(auth_client):
    payload = _payload()
    resp = auth_client.post(
        "/tenants",
        json=payload,
        headers={"Sec-Fetch-Site": "cross-site"},
    )
    assert resp.status_code == 403, resp.text
    assert "CSRF" in resp.text or "csrf" in resp.text.lower() or "lintas situs" in resp.text.lower()


def test_non_json_content_type_write_is_rejected(auth_client):
    resp = auth_client.post(
        "/tenants",
        content=b"nama_lengkap=hax&kategori=harian",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 415, resp.text


def test_invalid_tarif_rejected_422(auth_client):
    payload = _payload()
    payload["tarif"] = 0
    resp = auth_client.post("/tenants", json=payload)
    assert resp.status_code == 422, resp.text
