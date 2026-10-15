"""CRUD penyewa lapak."""

import re
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from lib.activity import log_activity
from lib.db import db
from lib.serialize import to_aware
from models.tenant import Tenant, TenantCreate, TenantUpdate
from routers.auth import require_session

router = APIRouter(prefix="/tenants", tags=["tenants"], dependencies=[Depends(require_session)])


def _to_tenant(doc: dict) -> Tenant:
    return Tenant(**to_aware(doc, "created_at"))


async def next_nomor_id() -> str:
    """Counter atomik — LPK-JMB-001, 002, ..."""
    doc = await db.counters.find_one_and_update(
        {"_id": "lapak_seq"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"LPK-JMB-{int(doc.get('seq', 0)):03d}"


@router.get("", response_model=List[Tenant])
async def list_tenants(
    q: str | None = Query(None, max_length=80, description="cari nama / nomor ID / blok"),
    kategori: str | None = Query(None),
    status: str | None = Query(None),
):
    query: dict[str, Any] = {}
    if q:
        # Escape agar input pengguna diperlakukan sebagai teks biasa, bukan pola
        # regex (mencegah ReDoS & pencarian tak terduga seperti ".*").
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"nama_lengkap": rx}, {"nomor_id": rx}, {"blok": rx}]
    if kategori:
        query["kategori"] = kategori
    if status:
        query["status"] = status
    docs = await db.tenants.find(query).sort("created_at", -1).to_list(1000)
    return [_to_tenant(d) for d in docs]


@router.post("", response_model=Tenant, status_code=201)
async def create_tenant(input: TenantCreate, actor: str = Depends(require_session)):
    nomor_id = input.nomor_id.strip()
    if nomor_id:
        existing = await db.tenants.find_one({"nomor_id": nomor_id})
        if existing:
            raise HTTPException(status_code=409, detail=f"Nomor ID {nomor_id} sudah dipakai penyewa lain")
    else:
        nomor_id = await next_nomor_id()
    payload = input.model_dump()
    payload["nomor_id"] = nomor_id
    tenant = Tenant(**payload)
    await db.tenants.insert_one(tenant.model_dump())
    await log_activity(
        actor, "buat", "penyewa", tenant.id,
        f"{tenant.nama_lengkap} ({tenant.nomor_id})",
        f"{tenant.kategori} — {tenant.blok}",
    )
    return tenant


@router.get("/by-nomor/{nomor_id}", response_model=Tenant)
async def get_tenant_by_nomor(nomor_id: str):
    """Endpoint yang dipakai pemindai QR setelah payload QR terbaca."""
    doc = await db.tenants.find_one({"nomor_id": nomor_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Penyewa dengan nomor ID {nomor_id} tidak ditemukan")
    return _to_tenant(doc)


@router.get("/{id}", response_model=Tenant)
async def get_tenant(id: str):
    doc = await db.tenants.find_one({"id": id})
    if not doc:
        raise HTTPException(status_code=404, detail="Penyewa tidak ditemukan")
    return _to_tenant(doc)


@router.put("/{id}", response_model=Tenant)
async def update_tenant(id: str, input: TenantUpdate, actor: str = Depends(require_session)):
    updates = input.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Tidak ada perubahan yang dikirim")
    doc = await db.tenants.find_one_and_update(
        {"id": id}, {"$set": updates}, return_document=ReturnDocument.AFTER
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Penyewa tidak ditemukan")
    await log_activity(
        actor, "ubah", "penyewa", id,
        f"{doc.get('nama_lengkap', '-')} ({doc.get('nomor_id', '-')})",
        "Ubah: " + ", ".join(sorted(updates.keys())),
    )
    return _to_tenant(doc)


@router.delete("/{id}")
async def delete_tenant(id: str, actor: str = Depends(require_session)):
    doc = await db.tenants.find_one({"id": id})
    result = await db.tenants.delete_one({"id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Penyewa tidak ditemukan")
    await db.payments.delete_many({"tenant_id": id})
    if doc:
        await log_activity(
            actor, "hapus", "penyewa", id,
            f"{doc.get('nama_lengkap', '-')} ({doc.get('nomor_id', '-')})",
            "beserta riwayat pembayarannya",
        )
    return {"deleted": True}
