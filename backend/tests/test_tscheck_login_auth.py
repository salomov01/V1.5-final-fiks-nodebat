"""Criterion: Login pengelola dan gerbang autentikasi.

Happy path (correct credentials -> session cookie -> /auth/me works) plus the
required failure case (wrong credentials -> 401, no-session -> 401). Uses the
real seeded admin credentials via `auth_client`, and a throwaway username for
the negative case so it never risks tripping the rate limiter on the real
account.
"""

import os

import httpx

API_URL = f"{os.environ.get('BACKEND_URL', 'http://localhost:8001')}/api"


def test_login_success_then_me_then_logout(auth_client):
    me = auth_client.get("/auth/me")
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["username"] == "pengelola"
    assert "password_bawaan" in body

    logout = auth_client.post("/auth/logout", headers={"Content-Type": "application/json"})
    assert logout.status_code == 200, logout.text

    me_after = auth_client.get("/auth/me")
    assert me_after.status_code == 401


def test_login_wrong_password_rejected():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        resp = c.post(
            "/auth/login",
            json={"username": "tscheck-login-nobody", "password": "salah-sekali"},
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 401, resp.text


def test_me_without_session_is_401():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        resp = c.get("/auth/me")
        assert resp.status_code == 401, resp.text
