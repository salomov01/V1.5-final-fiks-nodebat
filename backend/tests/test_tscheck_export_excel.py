"""Criterion: Ekspor Excel berfilter — the file download endpoint itself.

Kuitansi (receipt) is rendered purely client-side from payment data already
covered by the payment-confirm test, so this file only proves the download
endpoint returns a real .xlsx payload for a filtered query.
"""


def test_export_excel_returns_xlsx(auth_client):
    resp = auth_client.get("/laporan/pembayaran.xlsx", params={"status": "lunas"})
    assert resp.status_code == 200, resp.text
    ctype = resp.headers.get("content-type", "")
    assert "spreadsheet" in ctype or "octet-stream" in ctype, ctype
    # An .xlsx file is a zip archive -> starts with the PK magic bytes.
    assert resp.content[:2] == b"PK", resp.content[:16]


def test_export_excel_with_bulan_and_kategori_filter(auth_client):
    resp = auth_client.get(
        "/laporan/pembayaran.xlsx", params={"bulan": "2026-09", "kategori": "bulanan"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.content[:2] == b"PK"
