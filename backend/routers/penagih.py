"""Kelola daftar penagih (juru pungut) — dipilih dari dropdown saat scan QR."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.activity import log_activity
from lib.db import db
from models.penagih import Penagih, PenagihCreate
from routers.auth import require_session

router = APIRouter(prefix="/penagih", tags=["penagih"], dependencies=[Depends(require_session)])


def _to_penagih(doc: dict) -> Penagih:
    return Penagih(**doc)


@router.get("", response_model=List[Penagih])
async def list_penagih():
    docs = await db.penagih.find().sort("nama", 1).to_list(500)
    return [_to_penagih(d) for d in docs]


@router.post("", response_model=Penagih, status_code=201)
async def create_penagih(input: PenagihCreate, actor: str = Depends(require_session)):
    nama = input.nama.strip()
    existing = await db.penagih.find_one({"nama": nama})
    if existing:
        raise HTTPException(status_code=409, detail=f"Penagih '{nama}' sudah terdaftar")
    penagih = Penagih(nama=nama)
    await db.penagih.insert_one(penagih.model_dump())
    await log_activity(actor, "buat", "penagih", penagih.id, penagih.nama, "ditambahkan ke daftar penagih")
    return penagih


@router.delete("/{id}")
async def delete_penagih(id: str, actor: str = Depends(require_session)):
    doc = await db.penagih.find_one({"id": id})
    result = await db.penagih.delete_one({"id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Penagih tidak ditemukan")
    if doc:
        await log_activity(actor, "hapus", "penagih", id, doc.get("nama", "-"), "dihapus dari daftar penagih")
    return {"deleted": True}
