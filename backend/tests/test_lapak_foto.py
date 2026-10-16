"""Lapak photo upload / public serve / delete (object storage) + 401/415 guards."""

import io
import uuid

import httpx
import pytest

from tests.conftest import API_URL


def _jpg() -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 120, 40)).save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture
def unit(auth_client):
    r = auth_client.post("/lapak-unit", json={"blok": f"TEST_Foto {uuid.uuid4().hex[:6]}", "jenis": "Uji",
                                              "kategori": "bulanan", "tarif": 1000})
    assert r.status_code == 201, r.text
    u = r.json()
    yield u
    auth_client.delete(f"/lapak-unit/{u['id']}/foto")
    auth_client.delete(f"/lapak-unit/{u['id']}")


def _csrf_headers(auth_client):
    return {k: v for k, v in auth_client.headers.items() if k.lower() != "content-type"}


def test_upload_serve_delete(auth_client, unit):
    files = {"file": ("a.jpg", _jpg(), "image/jpeg")}
    r = auth_client.post(f"/lapak-unit/{unit['id']}/foto", files=files, headers=_csrf_headers(auth_client))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["foto_url"] and f"/api/publik/foto/{unit['id']}" in body["foto_url"]
    with httpx.Client(base_url=API_URL, timeout=60) as c:
        pub = {x["id"]: x for x in c.get("/publik/lapak-kosong").json()}
        assert pub[unit["id"]]["foto_url"] == body["foto_url"]
        img = c.get(f"/publik/foto/{unit['id']}")
        assert img.status_code == 200 and img.headers["content-type"].startswith("image/jpeg")
        assert img.content[:2] == b"\xff\xd8"
    d = auth_client.delete(f"/lapak-unit/{unit['id']}/foto")
    assert d.status_code == 200 and not d.json()["foto_url"]
    with httpx.Client(base_url=API_URL, timeout=60) as c:
        assert c.get(f"/publik/foto/{unit['id']}").status_code == 404


def test_upload_requires_login(unit):
    with httpx.Client(base_url=API_URL, timeout=30) as c:
        r = c.post(f"/lapak-unit/{unit['id']}/foto", files={"file": ("a.jpg", _jpg(), "image/jpeg")})
    assert r.status_code in (401, 403), r.text


def test_upload_non_image_415(auth_client, unit):
    r = auth_client.post(f"/lapak-unit/{unit['id']}/foto", files={"file": ("a.txt", b"hello", "text/plain")},
                         headers=_csrf_headers(auth_client))
    assert r.status_code == 415, r.text
