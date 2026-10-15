"""Criterion: Peringatan password bawaan dan alur ganti password.

Changes the password then immediately changes it back to the seeded default
within the same test, so the shared admin credential used by every other
test/browser-check file is left exactly as it started. Also covers the
required negative case: wrong current-password is rejected 401.
"""

import os

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "jimbaran2026")
NEW_PASSWORD_TMP = "tscheck-temp-pw-12345"


def test_change_password_roundtrip(auth_client):
    changed = auth_client.post(
        "/auth/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": NEW_PASSWORD_TMP},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["ok"] is True

    # /auth/me should now report password_bawaan = False (no longer the .env default).
    me = auth_client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["password_bawaan"] is False

    # Revert immediately so every other test keeps working with the seeded password.
    reverted = auth_client.post(
        "/auth/change-password",
        json={"current_password": NEW_PASSWORD_TMP, "new_password": ADMIN_PASSWORD},
    )
    assert reverted.status_code == 200, reverted.text

    me_after = auth_client.get("/auth/me")
    assert me_after.json()["password_bawaan"] is True


def test_change_password_wrong_current_rejected(auth_client):
    resp = auth_client.post(
        "/auth/change-password",
        json={"current_password": "password-salah-total", "new_password": "sesuatu-baru-1234"},
    )
    assert resp.status_code == 401, resp.text
