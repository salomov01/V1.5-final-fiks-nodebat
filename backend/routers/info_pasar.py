"""Info Pasar: jam buka & status buka/tutup + berita. Publik membaca, Super Admin mengubah."""

import os
import uuid
from datetime import datetime, timezone
from typing import List, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.activity import log_activity
from lib.db import db
from routers.auth import require_super

public_router = APIRouter(prefix="/publik", tags=["publik"])
admin_router = APIRouter(tags=["info-pasar"], dependencies=[Depends(require_super)])

JAM = r"^([01]\d|2[0-3]):[0-5]\d$"
DEFAULT_INFO = {"jam_buka": "05:00", "jam_tutup": "12:00", "mode": "otomatis", "pengumuman": ""}


class InfoPasar(BaseModel):
    jam_buka: str = Field(pattern=JAM)
    jam_tutup: str = Field(pattern=JAM)
    mode: Literal["otomatis", "buka", "tutup"]  # otomatis = ikut jam buka/tutup
    pengumuman: str = Field(default="", max_length=300)


class InfoPasarOut(InfoPasar):
    buka_sekarang: bool


class BeritaInput(BaseModel):
    judul: str = Field(min_length=3, max_length=150)
    isi: str = Field(min_length=3, max_length=5000)
    tanggal: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class Berita(BeritaInput):
    id: str


async def _info() -> InfoPasar:
    doc = await db.info_pasar.find_one({"_id": "info"}, {"_id": 0})
    return InfoPasar(**(doc or DEFAULT_INFO))


def _buka(info: InfoPasar) -> bool:
    if info.mode != "otomatis":
        return info.mode == "buka"
    jam = datetime.now(ZoneInfo(os.environ.get("APP_TZ", "UTC"))).strftime("%H:%M")
    return info.jam_buka <= jam < info.jam_tutup


def _berita(d: dict) -> Berita:
    return Berita(id=d["id"], judul=d["judul"], isi=d["isi"], tanggal=d["tanggal"])


@public_router.get("/info-pasar", response_model=InfoPasarOut)
async def get_info():
    info = await _info()
    return InfoPasarOut(**info.model_dump(), buka_sekarang=_buka(info))


@public_router.get("/berita", response_model=List[Berita])
async def list_berita():
    return [_berita(d) async for d in db.berita.find().sort([("tanggal", -1), ("created_at", -1)]).limit(50)]


@admin_router.put("/info-pasar", response_model=InfoPasarOut)
async def update_info(input: InfoPasar, actor: str = Depends(require_super)):
    if input.jam_buka >= input.jam_tutup:
        raise HTTPException(status_code=422, detail="Jam tutup harus setelah jam buka")
    await db.info_pasar.update_one({"_id": "info"}, {"$set": input.model_dump()}, upsert=True)
    await log_activity(actor, "ubah", "info-pasar", "info", "Info Pasar", f"{input.mode} {input.jam_buka}-{input.jam_tutup}")
    return InfoPasarOut(**input.model_dump(), buka_sekarang=_buka(input))


@admin_router.post("/berita", response_model=Berita, status_code=201)
async def create_berita(input: BeritaInput, actor: str = Depends(require_super)):
    doc = {"id": str(uuid.uuid4()), **input.model_dump(), "created_at": datetime.now(timezone.utc)}
    await db.berita.insert_one(doc)
    await log_activity(actor, "buat", "berita", doc["id"], input.judul)
    return _berita(doc)


@admin_router.put("/berita/{bid}", response_model=Berita)
async def update_berita(bid: str, input: BeritaInput, actor: str = Depends(require_super)):
    res = await db.berita.update_one({"id": bid}, {"$set": input.model_dump()})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")
    await log_activity(actor, "ubah", "berita", bid, input.judul)
    return Berita(id=bid, **input.model_dump())


@admin_router.delete("/berita/{bid}")
async def delete_berita(bid: str, actor: str = Depends(require_super)):
    doc = await db.berita.find_one_and_delete({"id": bid})
    if not doc:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan")
    await log_activity(actor, "hapus", "berita", bid, doc["judul"])
    return {"deleted": True}
