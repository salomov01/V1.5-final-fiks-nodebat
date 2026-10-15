"""Criterion: Tagihan Massal bersifat idempotent.

Calls POST /payments/bulk-monthly twice back-to-back. The first call may
create bills for whichever active monthly tenants don't have one yet for the
current period; the second call, run immediately after, must create zero new
bills for that same set (idempotent-by-period-and-tenant).
"""


def test_bulk_monthly_is_idempotent(auth_client):
    first = auth_client.post("/payments/bulk-monthly")
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert "dibuat" in first_body and "dilewati" in first_body and "periode" in first_body

    second = auth_client.post("/payments/bulk-monthly")
    assert second.status_code == 200, second.text
    second_body = second.json()

    # Whatever got created on the first call must be skipped (not duplicated) on the second.
    assert second_body["dibuat"] == 0, second_body
    assert second_body["dilewati"] >= first_body["dibuat"], (first_body, second_body)
    assert second_body["periode"] == first_body["periode"]
