"""Criterion: Catat pembayaran, konfirmasi (PATCH), dan cegah konfirmasi ganda.

Creates its own tenant + payment fixtures, confirms once (happy path), then
proves the required negative case: confirming/rejecting an already-settled
payment returns 409 instead of silently succeeding again.
"""

import uuid


def _tenant_payload():
    return {
        "nama_lengkap": f"tscheck-pay-tenant-{uuid.uuid4().hex[:8]}",
        "no_hp": "0812-1111-2222",
        "kategori": "harian",
        "blok": "Blok Uji Pembayaran",
        "tarif": 25000,
        "mulai": "2026-09-01",
        "selesai": "2026-12-31",
        "status": "aktif",
        "catatan": "",
    }


def test_confirm_then_double_confirm_rejected(auth_client):
    tenant = auth_client.post("/tenants", json=_tenant_payload())
    assert tenant.status_code == 201, tenant.text
    tenant_id = tenant.json()["id"]

    payment = auth_client.post(
        "/payments",
        json={
            "tenant_id": tenant_id,
            "periode": "September 2026",
            "jumlah": 25000,
            "metode": "tunai",
            "jatuh_tempo": "",
            "catatan": "tscheck",
        },
    )
    assert payment.status_code == 201, payment.text
    payment_id = payment.json()["id"]
    assert payment.json()["status"] == "menunggu"

    confirmed = auth_client.patch(f"/payments/{payment_id}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "lunas"

    double_confirm = auth_client.patch(f"/payments/{payment_id}/confirm")
    assert double_confirm.status_code == 409, double_confirm.text

    reject_after_lunas = auth_client.patch(f"/payments/{payment_id}/reject")
    assert reject_after_lunas.status_code == 409, reject_after_lunas.text

    # cleanup
    auth_client.delete(f"/payments/{payment_id}")
    auth_client.delete(f"/tenants/{tenant_id}")


def test_reject_then_second_reject_rejected(auth_client):
    tenant = auth_client.post("/tenants", json=_tenant_payload())
    assert tenant.status_code == 201, tenant.text
    tenant_id = tenant.json()["id"]

    payment = auth_client.post(
        "/payments",
        json={
            "tenant_id": tenant_id,
            "periode": "September 2026",
            "jumlah": 25000,
            "metode": "tunai",
            "jatuh_tempo": "",
            "catatan": "tscheck",
        },
    )
    payment_id = payment.json()["id"]

    rejected = auth_client.patch(f"/payments/{payment_id}/reject")
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "ditolak"

    second_reject = auth_client.patch(f"/payments/{payment_id}/reject")
    assert second_reject.status_code == 409, second_reject.text

    auth_client.delete(f"/payments/{payment_id}")
    auth_client.delete(f"/tenants/{tenant_id}")


def test_invalid_payment_amount_rejected_422(auth_client):
    tenant = auth_client.post("/tenants", json=_tenant_payload())
    tenant_id = tenant.json()["id"]

    bad = auth_client.post(
        "/payments",
        json={
            "tenant_id": tenant_id,
            "periode": "September 2026",
            "jumlah": 0,
            "metode": "tunai",
            "jatuh_tempo": "",
            "catatan": "",
        },
    )
    assert bad.status_code == 422, bad.text

    auth_client.delete(f"/tenants/{tenant_id}")
