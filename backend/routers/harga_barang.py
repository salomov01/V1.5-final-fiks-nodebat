"""Informasi Harga Barang: publik membaca, Super Admin mengelola (papan harga terkini)."""

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.activity import log_activity
from lib.db import db
from lib.serialize import to_aware
from routers.auth import require_super

public_router = APIRouter(prefix="/publik", tags=["publik"])
admin_router = APIRouter(prefix="/harga-barang", tags=["harga-barang"], dependencies=[Depends(require_super)])


class HargaInput(BaseModel):
    nama: str = Field(min_length=2, max_length=80)
    satuan: str = Field(min_length=1, max_length=20)
    harga: int = Field(ge=0, le=1_000_000_000)


class HargaBarang(HargaInput):
    id: str
    updated_at: datetime


@public_router.get("/harga-barang", response_model=List[HargaBarang])
async def list_harga():
    return [HargaBarang(**to_aware(d, "updated_at")) async for d in db.harga_barang.find({}, {"_id": 0}).sort("nama", 1)]


@admin_router.post("", response_model=HargaBarang, status_code=201)
async def create_harga(input: HargaInput, actor: str = Depends(require_super)):
    h = HargaBarang(id=str(uuid.uuid4()), updated_at=datetime.now(timezone.utc), **input.model_dump())
    await db.harga_barang.insert_one(h.model_dump())
    await log_activity(actor, "buat", "harga-barang", h.id, h.nama, f"Rp{h.harga}/{h.satuan}")
    return h


@admin_router.put("/{hid}", response_model=HargaBarang)
async def update_harga(hid: str, input: HargaInput, actor: str = Depends(require_super)):
    h = HargaBarang(id=hid, updated_at=datetime.now(timezone.utc), **input.model_dump())
    res = await db.harga_barang.update_one({"id": hid}, {"$set": h.model_dump()})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    await log_activity(actor, "ubah", "harga-barang", hid, h.nama, f"Rp{h.harga}/{h.satuan}")
    return h


@admin_router.delete("/{hid}")
async def delete_harga(hid: str, actor: str = Depends(require_super)):
    d = await db.harga_barang.find_one_and_delete({"id": hid})
    if not d:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    await log_activity(actor, "hapus", "harga-barang", hid, d["nama"])
    return {"deleted": True}
