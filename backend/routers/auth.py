"""Login pengelola, sesi httpOnly cookie & ganti password — semua di /api/auth/*.

Tidak ada token di JSON: cookie httpOnly `siplap_session` satu-satunya bukti sesi.
Kredensial tersimpan di koleksi `admins` (hash pbkdf2), di-bootstrap sekali dari
backend/.env (ADMIN_USERNAME / ADMIN_PASSWORD) agar password bisa diganti dari UI.
"""

import os
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from lib.activity import log_activity
from lib.db import db
from lib.ratelimit import bersihkan, catat_gagal, guard
from lib.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "siplap_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600  # 7 hari
ADMIN_DOC_ID = "admin"


class LoginInput(BaseModel):
    username: str
    password: str


class MeOutput(BaseModel):
    username: str
    # true selama password masih nilai bawaan dari .env (belum pernah diganti).
    # Dipakai frontend untuk menampilkan peringatan keamanan.
    password_bawaan: bool = False


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


def _secure(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


async def _get_admin() -> dict:
    """Ambil dokumen admin; bootstrap dari .env pada pemakaian pertama."""
    admin = await db.admins.find_one({"_id": ADMIN_DOC_ID})
    if admin:
        return admin
    username = os.environ.get("ADMIN_USERNAME", "pengelola")
    password = os.environ.get("ADMIN_PASSWORD", "")
    salt, digest = hash_password(password)
    admin = {
        "_id": ADMIN_DOC_ID,
        "username": username,
        "salt": salt,
        "password_hash": digest,
        "updated_at": datetime.now(timezone.utc),
    }
    await db.admins.insert_one(admin)
    return admin


def _pakai_password_bawaan(admin: dict) -> bool:
    """True bila password aktif masih sama dengan ADMIN_PASSWORD di .env.

    Dihitung ulang setiap kali (bukan flag tersimpan) supaya tetap benar walau
    password pernah diganti lalu dikembalikan ke nilai bawaan.
    """
    bawaan = os.environ.get("ADMIN_PASSWORD", "")
    if not bawaan:
        return False
    return verify_password(bawaan, admin["salt"], admin["password_hash"])


async def require_session(session_token: str | None = Cookie(None, alias=COOKIE_NAME)) -> str:
    """Dependency proteksi -> username pengelola (dipakai sebagai actor log aktivitas)."""
    if not session_token:
        raise HTTPException(status_code=401, detail="Sesi berakhir — silakan login kembali")
    session = await db.sessions.find_one({"token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesi tidak valid — silakan login kembali")
    return session["username"]


@router.post("/login", response_model=MeOutput)
async def login(input: LoginInput, request: Request, response: Response):
    username_input = input.username.strip()
    # Anti brute-force: tolak lebih awal bila sudah terlalu banyak gagal.
    await guard("login", username_input, request)

    admin = await _get_admin()
    user_ok = secrets.compare_digest(username_input, admin["username"])
    pass_ok = verify_password(input.password, admin["salt"], admin["password_hash"])
    if not (user_ok and pass_ok):
        await catat_gagal("login", username_input, request)
        raise HTTPException(status_code=401, detail="Username atau password salah")

    await bersihkan("login", username_input, request)
    token = secrets.token_hex(32)
    await db.sessions.insert_one({
        "token": token,
        "username": admin["username"],
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_secure(request),
        path="/",
    )
    return MeOutput(
        username=admin["username"],
        password_bawaan=_pakai_password_bawaan(admin),
    )


@router.get("/me", response_model=MeOutput)
async def me(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesi tidak valid — silakan login kembali")
    admin = await _get_admin()
    return MeOutput(
        username=session["username"],
        password_bawaan=_pakai_password_bawaan(admin),
    )


@router.post("/change-password")
async def change_password(
    input: ChangePasswordInput,
    request: Request,
    actor: str = Depends(require_session),
):
    # Anti brute-force juga untuk percobaan menebak password saat ini.
    await guard("ganti-password", actor, request)

    admin = await _get_admin()
    if not verify_password(input.current_password, admin["salt"], admin["password_hash"]):
        await catat_gagal("ganti-password", actor, request)
        raise HTTPException(status_code=401, detail="Password saat ini salah")
    if input.current_password == input.new_password:
        raise HTTPException(status_code=422, detail="Password baru harus berbeda dari password lama")

    await bersihkan("ganti-password", actor, request)
    salt, digest = hash_password(input.new_password)
    await db.admins.update_one(
        {"_id": ADMIN_DOC_ID},
        {"$set": {
            "salt": salt,
            "password_hash": digest,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    # Cabut semua sesi lain; sesi saat ini dipertahankan agar pengelola tidak terlempar keluar.
    current = request.cookies.get(COOKIE_NAME)
    await db.sessions.delete_many({"token": {"$ne": current}})
    await log_activity(actor, "ubah", "akun", ADMIN_DOC_ID, f"Password {actor}", "password diganti")
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}
