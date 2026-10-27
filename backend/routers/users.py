"""Kelola akun pengguna (Super Admin & Staff/penagih) — khusus Super Admin."""

import uuid
from datetime import datetime, timezone
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.activity import log_activity
from lib.db import db
from lib.security import hash_password
from routers.auth import SUPER_ADMIN, Principal, get_principal, require_super

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_super)])

Role = Literal["super_admin", "staff"]


class UserOut(BaseModel):
    id: str
    nama: str
    username: str
    role: Role
    aktif: bool


class UserCreate(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9._-]+$")
    password: str = Field(min_length=8, max_length=128)
    role: Role = "staff"


class UserUpdate(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=120)
    role: Role | None = None
    aktif: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


def _out(d: dict) -> UserOut:
    return UserOut(id=d["id"], nama=d["nama"], username=d["username"], role=d["role"], aktif=d.get("aktif", True))


@router.get("", response_model=List[UserOut])
async def list_users():
    return [_out(d) async for d in db.users.find().sort("created_at", 1)]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(input: UserCreate, actor: str = Depends(require_super)):
    username = input.username.strip().lower()
    if await db.users.find_one({"$or": [{"username": username}, {"email": username}]}):
        raise HTTPException(status_code=409, detail=f"Username {username} sudah dipakai")
    salt, digest = hash_password(input.password)
    doc = {
        "id": str(uuid.uuid4()), "nama": input.nama.strip(), "username": username, "email": "",
        "role": input.role, "aktif": True, "salt": salt, "password_hash": digest,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    await log_activity(actor, "buat", "akun", doc["id"], f"{doc['nama']} ({username})", input.role)
    return _out(doc)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, input: UserUpdate, me: Principal = Depends(get_principal)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
    changes = input.model_dump(exclude_none=True)
    if user_id == me.id and (changes.get("aktif") is False or changes.get("role", SUPER_ADMIN) != SUPER_ADMIN):
        raise HTTPException(status_code=409, detail="Tidak bisa menonaktifkan atau menurunkan peran akun sendiri")
    if password := changes.pop("password", None):
        changes["salt"], changes["password_hash"] = hash_password(password)
    if changes:
        await db.users.update_one({"id": user_id}, {"$set": changes})
    # Akun dinonaktifkan / password direset -> paksa login ulang.
    if changes.get("aktif") is False or "password_hash" in changes or "role" in changes:
        await db.sessions.delete_many({"user_id": user_id})
    await log_activity(me.username, "ubah", "akun", user_id, user["username"], ", ".join(k for k in changes if k != "salt"))
    return _out(await db.users.find_one({"id": user_id}))
