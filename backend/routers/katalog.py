"""Katalog lapak publik, pendaftaran calon penyewa, dan pengelolaannya oleh admin."""

from datetime import date, datetime, timedelta, timezone
from typing import List

from dateutil.relativedelta import relativedelta
import asyncio
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile

from lib.activity import log_activity
from lib.dates import today_iso
from lib.db import db
from lib.ratelimit import client_ip
from lib.serialize import to_aware
from lib.storage import APP_NAME, get_object, put_object
from models.katalog import (
    LapakPublik, LapakUnit, LapakUnitCreate, LapakUnitOut, LapakUnitUpdate,
    Pendaftaran, PendaftaranCreate, TerimaInput,
)
from models.tenant import Tenant
from routers.auth import require_session
from routers.tenants import next_nomor_id

public_router = APIRouter(prefix="/publik", tags=["publik"])
admin_router = APIRouter(tags=["katalog"], dependencies=[Depends(require_session)])

MAX_DAFTAR_PER_JAM = 5


async def _terisi_map() -> dict[str, str]:
    """blok -> tanggal selesai sewa terjauh dari penyewa aktif yang belum habis."""
    today = today_iso()
    cursor = db.tenants.find({"status": "aktif", "selesai": {"$gte": today}}, {"blok": 1, "selesai": 1})
    hasil: dict[str, str] = {}
    async for t in cursor:
        if t["selesai"] > hasil.get(t["blok"], ""):
            hasil[t["blok"]] = t["selesai"]
    return hasil


async def _units() -> list[LapakUnit]:
    docs = await db.lapak_units.find().sort("blok", 1).to_list(2000)
    return [LapakUnit(**to_aware(d, "created_at")) for d in docs]


async def _cek_kosong(unit: LapakUnit) -> None:
    if unit.blok in await _terisi_map():
        raise HTTPException(status_code=409, detail=f"Lapak {unit.blok} sudah terisi")


async def _get_unit(unit_id: str) -> LapakUnit:
    doc = await db.lapak_units.find_one({"id": unit_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lapak tidak ditemukan")
    return LapakUnit(**to_aware(doc, "created_at"))


def _unit_dump(u: LapakUnit) -> dict:
    """Dump termasuk field internal foto (dibutuhkan untuk menyusun model turunan)."""
    return {**u.model_dump(exclude={"foto_url"}), "foto_path": u.foto_path, "foto_versi": u.foto_versi}


# ---------- Publik (tanpa login) ----------

@public_router.get("/lapak-kosong", response_model=List[LapakPublik])
async def lapak_kosong():
    terisi = await _terisi_map()
    return [LapakPublik(**u.model_dump()) for u in await _units() if u.blok not in terisi]


@public_router.get("/foto/{unit_id}")
async def foto_lapak(unit_id: str):
    unit = await _get_unit(unit_id)
    if not unit.foto_path:
        raise HTTPException(status_code=404, detail="Lapak belum punya foto")
    data, ctype = await asyncio.to_thread(get_object, unit.foto_path)
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@public_router.post("/pendaftaran", response_model=Pendaftaran, status_code=201)
async def daftar(input: PendaftaranCreate, request: Request):
    ip = client_ip(request)
    sejak = datetime.now(timezone.utc) - timedelta(hours=1)
    if await db.pendaftaran.count_documents({"ip": ip, "created_at": {"$gte": sejak}}) >= MAX_DAFTAR_PER_JAM:
        raise HTTPException(status_code=429, detail="Terlalu banyak pendaftaran. Coba lagi dalam 1 jam.")
    unit = await _get_unit(input.lapak_id)
    await _cek_kosong(unit)
    if await db.pendaftaran.find_one({"lapak_id": unit.id, "no_hp": input.no_hp.strip(), "status": "baru"}):
        raise HTTPException(status_code=409, detail="Nomor ini sudah mendaftar lapak tersebut — tunggu konfirmasi admin")
    item = Pendaftaran(
        nama=input.nama.strip(), no_hp=input.no_hp.strip(), lapak_id=unit.id, blok=unit.blok,
        jenis=unit.jenis, kategori=unit.kategori, tarif=unit.tarif, catatan=input.catatan.strip(),
    )
    await db.pendaftaran.insert_one({**item.model_dump(), "ip": ip})
    return item


# ---------- Admin: unit lapak ----------

@admin_router.get("/lapak-unit", response_model=List[LapakUnitOut])
async def list_units():
    terisi = await _terisi_map()
    return [
        LapakUnitOut(**_unit_dump(u), status="terisi" if u.blok in terisi else "kosong",
                     terisi_sampai=terisi.get(u.blok))
        for u in await _units()
    ]


@admin_router.post("/lapak-unit", response_model=LapakUnit, status_code=201)
async def create_unit(input: LapakUnitCreate, actor: str = Depends(require_session)):
    blok = input.blok.strip()
    if await db.lapak_units.find_one({"blok": blok}):
        raise HTTPException(status_code=409, detail=f"Lapak {blok} sudah ada di katalog")
    unit = LapakUnit(**{**input.model_dump(), "blok": blok})
    await db.lapak_units.insert_one(unit.model_dump())
    await log_activity(actor, "buat", "lapak", unit.id, unit.blok, f"{unit.kategori} — {unit.tarif}")
    return unit


@admin_router.put("/lapak-unit/{unit_id}", response_model=LapakUnit)
async def update_unit(unit_id: str, input: LapakUnitUpdate, actor: str = Depends(require_session)):
    unit = await _get_unit(unit_id)
    changes = input.model_dump(exclude_none=True)
    if "blok" in changes:
        changes["blok"] = changes["blok"].strip()
        if changes["blok"] != unit.blok:
            if await db.lapak_units.find_one({"blok": changes["blok"]}):
                raise HTTPException(status_code=409, detail=f"Lapak {changes['blok']} sudah ada di katalog")
            if unit.blok in await _terisi_map():
                raise HTTPException(status_code=409, detail="Nama lapak tidak bisa diubah selama masih disewa")
    if changes:
        await db.lapak_units.update_one({"id": unit_id}, {"$set": changes})
        await log_activity(actor, "ubah", "lapak", unit_id, changes.get("blok", unit.blok))
    return await _get_unit(unit_id)


FOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
FOTO_MAX = 5 * 1024 * 1024


def _cek_magic(data: bytes, ext: str) -> bool:
    if ext == "jpg":
        return data[:3] == b"\xff\xd8\xff"
    if ext == "png":
        return data[:8] == b"\x89PNG\r\n\x1a\n"
    return data[:4] == b"RIFF" and data[8:12] == b"WEBP"


@admin_router.post("/lapak-unit/{unit_id}/foto", response_model=LapakUnit)
async def upload_foto(unit_id: str, file: UploadFile = File(...), actor: str = Depends(require_session)):
    unit = await _get_unit(unit_id)
    ext = FOTO_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=415, detail="Foto harus JPG, PNG, atau WEBP")
    data = await file.read()
    if len(data) > FOTO_MAX:
        raise HTTPException(status_code=413, detail="Ukuran foto maksimal 5 MB")
    if not _cek_magic(data, ext):
        raise HTTPException(status_code=415, detail="Isi file bukan gambar JPG, PNG, atau WEBP yang valid")
    path = f"{APP_NAME}/lapak/{unit_id}/{uuid.uuid4()}.{ext}"
    result = await asyncio.to_thread(put_object, path, data, file.content_type)
    await db.lapak_units.update_one(
        {"id": unit_id}, {"$set": {"foto_path": result["path"]}, "$inc": {"foto_versi": 1}}
    )
    await log_activity(actor, "ubah", "lapak", unit_id, unit.blok, "foto diperbarui")
    return await _get_unit(unit_id)


@admin_router.delete("/lapak-unit/{unit_id}/foto", response_model=LapakUnit)
async def hapus_foto(unit_id: str, actor: str = Depends(require_session)):
    unit = await _get_unit(unit_id)
    await db.lapak_units.update_one({"id": unit_id}, {"$set": {"foto_path": None}})
    await log_activity(actor, "ubah", "lapak", unit_id, unit.blok, "foto dihapus")
    return await _get_unit(unit_id)


@admin_router.delete("/lapak-unit/{unit_id}")
async def delete_unit(unit_id: str, actor: str = Depends(require_session)):
    unit = await _get_unit(unit_id)
    if unit.blok in await _terisi_map():
        raise HTTPException(status_code=409, detail="Lapak masih disewa — tidak bisa dihapus")
    await db.lapak_units.delete_one({"id": unit_id})
    await db.pendaftaran.update_many({"lapak_id": unit_id, "status": "baru"}, {"$set": {"status": "ditolak"}})
    await log_activity(actor, "hapus", "lapak", unit_id, unit.blok)
    return {"deleted": True}


# ---------- Admin: pendaftaran ----------

@admin_router.get("/pendaftaran", response_model=List[Pendaftaran])
async def list_pendaftaran(status: str | None = Query(None, pattern="^(baru|diterima|ditolak)$")):
    query = {"status": status} if status else {}
    docs = await db.pendaftaran.find(query, {"ip": 0}).sort("created_at", -1).to_list(1000)
    return [Pendaftaran(**to_aware(d, "created_at")) for d in docs]


async def _get_baru(pid: str) -> Pendaftaran:
    doc = await db.pendaftaran.find_one({"id": pid}, {"ip": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pendaftaran tidak ditemukan")
    item = Pendaftaran(**to_aware(doc, "created_at"))
    if item.status != "baru":
        raise HTTPException(status_code=409, detail=f"Pendaftaran sudah {item.status}")
    return item


def _selesai_default(kategori: str, mulai: str) -> str:
    start = date.fromisoformat(mulai)
    end = start + (relativedelta(years=1) if kategori == "tahunan" else relativedelta(months=1)) - timedelta(days=1)
    return end.isoformat()


@admin_router.post("/pendaftaran/{pid}/terima", response_model=Tenant)
async def terima(pid: str, input: TerimaInput, actor: str = Depends(require_session)):
    item = await _get_baru(pid)
    unit = await _get_unit(item.lapak_id)
    mulai = input.mulai or today_iso()
    selesai = input.selesai or _selesai_default(unit.kategori, mulai)
    if selesai < mulai:
        raise HTTPException(status_code=422, detail="Tanggal selesai harus setelah tanggal mulai")
    # Kunci atomik per lapak agar dua penerimaan bersamaan tidak membuat dua penyewa.
    if not await db.lapak_units.find_one_and_update({"id": unit.id, "lock": {"$ne": True}}, {"$set": {"lock": True}}):
        raise HTTPException(status_code=409, detail="Lapak sedang diproses, coba lagi")
    try:
        await _cek_kosong(unit)
        if not await db.pendaftaran.find_one({"id": pid, "status": "baru"}):
            raise HTTPException(status_code=409, detail="Pendaftaran sudah diproses")
        return await _buat_penyewa(pid, item, unit, mulai, selesai, actor)
    finally:
        await db.lapak_units.update_one({"id": unit.id}, {"$unset": {"lock": ""}})


async def _buat_penyewa(pid: str, item: Pendaftaran, unit: LapakUnit, mulai: str, selesai: str, actor: str) -> Tenant:
    tenant = Tenant(
        nomor_id=await next_nomor_id(), nama_lengkap=item.nama, no_hp=item.no_hp,
        kategori=unit.kategori, blok=unit.blok, tarif=unit.tarif, mulai=mulai, selesai=selesai,
        catatan=f"Dari pendaftaran online. {item.catatan}".strip(),
    )
    await db.tenants.insert_one(tenant.model_dump())
    await db.pendaftaran.update_one({"id": pid}, {"$set": {"status": "diterima", "tenant_nomor_id": tenant.nomor_id}})
    # Pendaftar lain untuk lapak yang sama otomatis ditolak.
    await db.pendaftaran.update_many({"lapak_id": unit.id, "status": "baru"}, {"$set": {"status": "ditolak"}})
    await log_activity(actor, "konfirmasi", "pendaftaran", pid, f"{tenant.nama_lengkap} ({tenant.nomor_id})", unit.blok)
    return tenant


@admin_router.post("/pendaftaran/{pid}/tolak", response_model=Pendaftaran)
async def tolak(pid: str, actor: str = Depends(require_session)):
    item = await _get_baru(pid)
    await db.pendaftaran.update_one({"id": pid}, {"$set": {"status": "ditolak"}})
    await log_activity(actor, "tolak", "pendaftaran", pid, item.nama, item.blok)
    item.status = "ditolak"
    return item
