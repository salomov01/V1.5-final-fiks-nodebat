"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os

import httpx
import pytest
import pytest_asyncio
from filelock import FileLock

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"


def api_url(path: str = "") -> str:
    """Absolute URL for an /api route: api_url("/status") -> http://localhost:8001/api/status."""
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


@pytest.fixture
def client():
    """Sync httpx client rooted at /api — the default for endpoint tests.

    Example:
        def test_status(client):
            assert client.get("/status").status_code == 200
    """
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        yield c


@pytest_asyncio.fixture
async def aclient():
    """Async variant, for tests that also await motor/backend helpers directly."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as c:
        yield c


# --- app-specific fixtures below this line ---

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "pengelola")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "jimbaran2026")

# Serializes access to the single shared admin credential across xdist workers.
# test_tscheck_change_password.py holds this for its whole change->verify->revert
# roundtrip so no other module's auth_client can race a login against a
# momentarily-swapped password (which would also burn login-rate-limit budget).
ADMIN_CREDENTIAL_LOCK = FileLock("/tmp/tscheck_admin_credential.lock")


@pytest.fixture
def admin_credential_lock():
    return ADMIN_CREDENTIAL_LOCK


@pytest.fixture
def auth_client():
    """Sync httpx client rooted at /api, logged in as the seeded admin.

    Session cookie persists across requests via httpx's cookie jar. Uses the
    real admin credentials — do NOT use this fixture to test failed-login /
    rate-limit scenarios (use a throwaway username for that instead).
    """
    with ADMIN_CREDENTIAL_LOCK:
        with httpx.Client(base_url=API_URL, timeout=30.0) as c:
            resp = c.post(
                "/auth/login",
                json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
                headers={"Content-Type": "application/json"},
            )
            assert resp.status_code == 200, f"login setup failed: {resp.status_code} {resp.text}"
            yield c
