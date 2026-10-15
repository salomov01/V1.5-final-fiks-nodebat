"""Criterion: Rekap Tunggakan, Pindai QR manual, dan Riwayat Aktivitas (API side).

- GET /payments/overdue returns a summary sorted by hari_telat descending.
- GET /tenants/by-nomor/{nomor_id} resolves the manual-QR-lookup path used by /scan-qr.
- GET /activities returns entries with a pengelola actor.
"""


def test_overdue_summary_sorted_desc(auth_client):
    resp = auth_client.get("/payments/overdue")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    for key in ("periode_hari_ini", "jumlah_penyewa", "total_tunggakan", "telat_terlama", "items"):
        assert key in body
    hari = [item["hari_telat"] for item in body["items"]]
    assert hari == sorted(hari, reverse=True), hari


def test_scan_qr_manual_lookup_by_nomor(auth_client):
    resp = auth_client.get("/tenants/by-nomor/LPK-JMB-001")
    assert resp.status_code == 200, resp.text
    tenant = resp.json()
    assert tenant["nomor_id"] == "LPK-JMB-001"
    assert tenant["nama_lengkap"]


def test_scan_qr_unknown_nomor_404(auth_client):
    resp = auth_client.get("/tenants/by-nomor/LPK-JMB-999")
    assert resp.status_code == 404, resp.text


def test_activities_list_has_pengelola_actor(auth_client):
    resp = auth_client.get("/activities", params={"limit": 200})
    assert resp.status_code == 200, resp.text
    activities = resp.json()
    assert isinstance(activities, list)
    if activities:
        assert all("actor" in a for a in activities)
