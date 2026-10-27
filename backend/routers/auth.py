"""Login multi-akun (Super Admin & Staff), sesi httpOnly cookie, ganti password — /api/auth/*.

Peran:
- super_admin (Admin Tingkat 2): akses penuh.
- staff (Admin Tingkat 1): boleh lihat & input baru; tidak boleh ubah/hapus, ekspor, atau melihat total uang.
Super Admin di-bootstrap dari backend/.env (ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD).
"""

import os
import secrets
import uuid
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
SUPER_ADMIN = "super_admin"
STAFF = "staff"


class Principal(BaseModel):
    """Identitas pengguna yang login — selalu dibaca ulang dari DB tiap request."""
    id: str
    nama: str
    username: str
    role: str


class LoginInput(BaseModel):
    username: str  # boleh username atau email
    password: str


class MeOutput(Principal):
    # true selama password Super Admin masih nilai bawaan dari .env.
    password_bawaan: bool = False


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


def _secure(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


async def ensure_super_admin() -> None:
    """Buat akun Super Admin dari .env bila belum ada satu pun."""
    if await db.users.find_one({"role": SUPER_ADMIN}):
        return
    salt, digest = hash_password(os.environ["ADMIN_PASSWORD"])
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "nama": os.environ.get("ADMIN_NAMA", "Super Admin"),
        "username": os.environ["ADMIN_USERNAME"].strip().lower(),
        "email": os.environ.get("ADMIN_EMAIL", "").strip().lower(),
        "role": SUPER_ADMIN,
        "aktif": True,
        "salt": salt,
        "password_hash": digest,
        "created_at": datetime.now(timezone.utc),
    })


def _pakai_password_bawaan(user: dict) -> bool:
    bawaan = os.environ.get("ADMIN_PASSWORD", "")
    return bool(bawaan) and user["role"] == SUPER_ADMIN and verify_password(bawaan, user["salt"], user["password_hash"])


def _principal(user: dict) -> Principal:
    return Principal(id=user["id"], nama=user["nama"], username=user["username"], role=user["role"])


async def _user_dari_token(token: str | None) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Sesi berakhir — silakan login kembali")
    session = await db.sessions.find_one({"token": token})
    user = await db.users.find_one({"id": session.get("user_id")}) if session else None
    if not user or not user.get("aktif", True):
        raise HTTPException(status_code=401, detail="Sesi tidak valid — silakan login kembali")
    return user


async def get_principal(session_token: str | None = Cookie(None, alias=COOKIE_NAME)) -> Principal:
    return _principal(await _user_dari_token(session_token))


async def require_session(principal: Principal = Depends(get_principal)) -> str:
    """Dependency proteksi -> username (dipakai sebagai actor log aktivitas)."""
    return principal.username


async def require_super(principal: Principal = Depends(get_principal)) -> str:
    """Hanya Super Admin (Admin Tingkat 2). Staff -> 403."""
    if principal.role != SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang boleh melakukan aksi ini")
    return principal.username


@router.post("/login", response_model=MeOutput)
async def login(input: LoginInput, request: Request, response: Response):
    ident = input.username.strip().lower()
    await guard("login", ident, request)  # anti brute-force
    await ensure_super_admin()

    user = await db.users.find_one({"$or": [{"username": ident}, {"email": ident}]}) if ident else None
    ok = bool(user) and user.get("aktif", True) and verify_password(input.password, user["salt"], user["password_hash"])
    if not ok:
        await catat_gagal("login", ident, request)
        raise HTTPException(status_code=401, detail="Username atau password salah")

    await bersihkan("login", ident, request)
    token = secrets.token_hex(32)
    await db.sessions.insert_one({
        "token": token, "user_id": user["id"], "username": user["username"], "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(
        key=COOKIE_NAME, value=token, max_age=SESSION_TTL_SECONDS, httponly=True,
        samesite="lax", secure=_secure(request), path="/",
    )
    return MeOutput(**_principal(user).model_dump(), password_bawaan=_pakai_password_bawaan(user))


@router.get("/me", response_model=MeOutput)
async def me(request: Request):
    user = await _user_dari_token(request.cookies.get(COOKIE_NAME))
    return MeOutput(**_principal(user).model_dump(), password_bawaan=_pakai_password_bawaan(user))


@router.post("/change-password")
async def change_password(input: ChangePasswordInput, request: Request, principal: Principal = Depends(get_principal)):
    await guard("ganti-password", principal.username, request)
    user = await db.users.find_one({"id": principal.id})
    if not verify_password(input.current_password, user["salt"], user["password_hash"]):
        await catat_gagal("ganti-password", principal.username, request)
        raise HTTPException(status_code=401, detail="Password saat ini salah")
    if input.current_password == input.new_password:
        raise HTTPException(status_code=422, detail="Password baru harus berbeda dari password lama")

    await bersihkan("ganti-password", principal.username, request)
    salt, digest = hash_password(input.new_password)
    await db.users.update_one({"id": principal.id}, {"$set": {"salt": salt, "password_hash": digest}})
    # Cabut sesi lain milik akun ini; sesi saat ini dipertahankan.
    current = request.cookies.get(COOKIE_NAME)
    await db.sessions.delete_many({"user_id": principal.id, "token": {"$ne": current}})
    await log_activity(principal.username, "ubah", "akun", principal.id, f"Password {principal.username}", "password diganti")
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"ok": True}
