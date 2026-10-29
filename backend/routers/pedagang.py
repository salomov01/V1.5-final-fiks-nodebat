"""Data Pedagang: CRUD + User ID otomatis [NO_URUT]-[3 digit akhir KTP]."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from lib.activity import log_activity
from lib.db import db
from lib.serialize import to_aware
from models.pasar import Pedagang, PedagangInput, PedagangRingkas, PedagangUpdate
from routers.auth import require_session, require_super

router = APIRouter(prefix="/pedagang", tags=["pedagang"], dependencies=[Depends(require_session)])
public_router = APIRouter(prefix="/publik", tags=["publik"])


async def buat_user_id(nik: str) -> str:
    # Nomor urut atomik (counter) + 3 digit terakhir NIK, contoh 01-123.
    doc = await db.counters.find_one_and_update(
        {"_id": "pedagang_seq"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"{doc['seq']:02d}-{nik[-3:].rjust(3, '0')}"


async def buat_pedagang(data: PedagangInput, actor: str) -> Pedagang:
    if await db.pedagang.find_one({"nik": data.nik}):
        raise HTTPException(status_code=409, detail="NIK sudah terdaftar")
    p = Pedagang(**data.model_dump(), user_id=await buat_user_id(data.nik))
    await db.pedagang.insert_one(p.model_dump())
    await log_activity(actor, "buat", "pedagang", p.id, f"{p.nama} ({p.user_id})")
    return p


async def get_pedagang(query: dict) -> Pedagang:
    doc = await db.pedagang.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Pedagang tidak ditemukan")
    return Pedagang(**to_aware(doc, "created_at"))


@router.get("", response_model=List[Pedagang])
async def list_pedagang(q: str = ""):
    query = {"$or": [{"nama": {"$regex": q, "$options": "i"}}, {"user_id": {"$regex": q}}]} if q else {}
    docs = await db.pedagang.find(query).sort("created_at", 1).to_list(5000)
    return [Pedagang(**to_aware(d, "created_at")) for d in docs]


@router.post("", response_model=Pedagang, status_code=201)
async def create_pedagang(input: PedagangInput, actor: str = Depends(require_session)):
    return await buat_pedagang(input, actor)


@router.patch("/{pid}", response_model=Pedagang)
async def update_pedagang(pid: str, input: PedagangUpdate, actor: str = Depends(require_super)):
    p = await get_pedagang({"id": pid})
    changes = input.model_dump(exclude_none=True)
    if changes:
        await db.pedagang.update_one({"id": pid}, {"$set": changes})
        await log_activity(actor, "ubah", "pedagang", pid, p.nama, ", ".join(changes))
    return await get_pedagang({"id": pid})


@router.delete("/{pid}")
async def delete_pedagang(pid: str, actor: str = Depends(require_super)):
    p = await get_pedagang({"id": pid})
    if await db.sewa.find_one({"pedagang_id": pid, "status": "aktif"}):
        raise HTTPException(status_code=409, detail="Pedagang masih menyewa lapak — akhiri sewanya dulu")
    await db.pedagang.delete_one({"id": pid})
    await log_activity(actor, "hapus", "pedagang", pid, p.nama)
    return {"deleted": True}


@public_router.get("/pedagang", response_model=List[PedagangRingkas])
async def cari_pedagang_publik(q: str = Query(min_length=2, max_length=60)):
    """Pencarian akun pedagang untuk form sewa — hanya nama & User ID."""
    import re
    docs = await db.pedagang.find(
        {"aktif": True, "nama": {"$regex": re.escape(q), "$options": "i"}}, {"id": 1, "user_id": 1, "nama": 1}
    ).limit(10).to_list(10)
    return [PedagangRingkas(**d) for d in docs]
