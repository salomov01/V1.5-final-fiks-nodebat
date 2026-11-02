"""Lapak & Iuran (satu paket), foto lapak, dan Sewa / Pendaftaran Lapak."""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile

from lib.activity import log_activity
from lib.dates import today_iso
from lib.db import db
from lib.ratelimit import client_ip
from lib.serialize import to_aware
from lib.storage import APP_NAME, get_object, put_object
from models.pasar import (
    Lapak, LapakAdmin, LapakInput, LapakPublik, LapakUpdate, PedagangInput,
    Sewa, SewaAdminInput, SewaOut, SewaPublikInput,
)
from routers.auth import require_session, require_super
from routers.pedagang import buat_pedagang, get_pedagang

public_router = APIRouter(prefix="/publik", tags=["publik"])
admin_router = APIRouter(tags=["lapak"], dependencies=[Depends(require_session)])

MAX_BOOKING_PER_JAM = 5
FOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
FOTO_MAX = 5 * 1024 * 1024


def hitung_sewa(harga_bulanan: int, mulai: str, selesai: str) -> tuple[int, int]:
    """Total sewa per hari: harga per bulan ÷ 30 × jumlah hari (inklusif)."""
    try:
        hari = (date.fromisoformat(selesai) - date.fromisoformat(mulai)).days + 1
    except ValueError:
        raise HTTPException(status_code=422, detail="Tanggal tidak valid")
    if hari < 1:
        raise HTTPException(status_code=422, detail="Tanggal akhir harus sama atau setelah tanggal awal")
    return hari, round(harga_bulanan * hari / 30)


async def _lapak(lid: str) -> Lapak:
    doc = await db.lapak.find_one({"id": lid})
    if not doc:
        raise HTTPException(status_code=404, detail="Lapak tidak ditemukan")
    return Lapak(**to_aware(doc, "created_at"))


async def _terisi() -> dict[str, dict]:
    """lapak_id -> sewa aktif yang sedang berjalan hari ini (booking masa depan tidak menandai terisi)."""
    hasil: dict[str, dict] = {}
    today = today_iso()
    async for s in db.sewa.find({"status": "aktif", "mulai": {"$lte": today}, "selesai": {"$gte": today}}):
        if s["selesai"] > hasil.get(s["lapak_id"], {}).get("selesai", ""):
            hasil[s["lapak_id"]] = s
    return hasil


async def _cek_kosong(lapak_id: str, mulai: str, selesai: str, kecuali: str | None = None) -> None:
    bentrok = await db.sewa.find_one({
        "lapak_id": lapak_id, "status": "aktif", "id": {"$ne": kecuali},
        "mulai": {"$lte": selesai}, "selesai": {"$gte": mulai},
    })
    if bentrok:
        raise HTTPException(status_code=409, detail=f"Lapak sudah disewa {bentrok['nama']} s/d {bentrok['selesai']}")


async def _list_lapak() -> list[Lapak]:
    return [Lapak(**to_aware(d, "created_at")) for d in await db.lapak.find().sort("created_at", 1).to_list(2000)]


async def sewa_out(doc: dict) -> SewaOut:
    s = SewaOut(**to_aware(doc, "created_at"))
    agg = await db.payments.aggregate([
        {"$match": {"sewa_id": s.id, "jenis": "sewa"}}, {"$group": {"_id": None, "t": {"$sum": "$jumlah"}}},
    ]).to_list(1)
    s.terbayar = agg[0]["t"] if agg else 0
    s.sisa = max(0, s.total_harga - s.terbayar)
    return s


def _sewa_baru(lapak: Lapak, mulai: str, selesai: str, **kw) -> Sewa:
    hari, total = hitung_sewa(lapak.harga_sewa, mulai, selesai)
    return Sewa(lapak_id=lapak.id, lapak_nama=lapak.nama, mulai=mulai, selesai=selesai, hari=hari,
                harga_sewa=lapak.harga_sewa, iuran=lapak.iuran, total_harga=total, **kw)


# ---------- Publik ----------
@public_router.get("/lapak-kosong", response_model=List[LapakPublik])
async def lapak_kosong():
    terisi = await _terisi()
    return [LapakPublik(**l.model_dump()) for l in await _list_lapak() if l.id not in terisi]


@public_router.get("/foto/{lapak_id}")
async def foto_lapak(lapak_id: str):
    l = await _lapak(lapak_id)
    if not l.foto_path:
        raise HTTPException(status_code=404, detail="Lapak belum punya foto")
    data, ctype = await asyncio.to_thread(get_object, l.foto_path)
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@public_router.post("/sewa", response_model=Sewa, status_code=201)
async def booking_publik(input: SewaPublikInput, request: Request):
    ip = client_ip(request)
    sejak = datetime.now(timezone.utc) - timedelta(hours=1)
    if await db.sewa.count_documents({"ip": ip, "created_at": {"$gte": sejak}}) >= MAX_BOOKING_PER_JAM:
        raise HTTPException(status_code=429, detail="Terlalu banyak pendaftaran. Coba lagi dalam 1 jam.")
    lapak = await _lapak(input.lapak_id)
    if input.mulai < today_iso():
        raise HTTPException(status_code=422, detail="Tanggal awal tidak boleh sebelum hari ini")
    await _cek_kosong(lapak.id, input.mulai, input.selesai)
    if input.pedagang_id:
        p = await get_pedagang({"id": input.pedagang_id, "aktif": True})
        data = {"pedagang_id": p.id, "user_id": p.user_id, "nama": p.nama, "no_hp": p.no_hp}
    else:
        if len(input.nama.strip()) < 2 or len(input.nik) < 3 or len(input.no_hp.strip()) < 8:
            raise HTTPException(status_code=422, detail="Pedagang baru wajib isi nama, NIK, dan nomor HP")
        data = {"nama": input.nama.strip(), "nik": input.nik, "no_hp": input.no_hp.strip()}
    s = _sewa_baru(lapak, input.mulai, input.selesai, catatan=input.catatan.strip(), **data)
    await db.sewa.insert_one({**s.model_dump(), "nik": s.nik, "ip": ip})
    return s


# ---------- Admin: Lapak & Iuran ----------
@admin_router.get("/lapak", response_model=List[LapakAdmin])
async def list_lapak():
    terisi = await _terisi()
    return [LapakAdmin(**l.model_dump(), status="terisi" if l.id in terisi else "kosong",
                       penyewa=terisi.get(l.id, {}).get("nama"), terisi_sampai=terisi.get(l.id, {}).get("selesai"))
            for l in await _list_lapak()]


@admin_router.post("/lapak", response_model=Lapak, status_code=201)
async def create_lapak(input: LapakInput, actor: str = Depends(require_session)):
    if await db.lapak.find_one({"nama": input.nama.strip()}):
        raise HTTPException(status_code=409, detail="Nama lapak sudah ada")
    l = Lapak(**{**input.model_dump(), "nama": input.nama.strip()})
    await db.lapak.insert_one({**l.model_dump(), "foto_path": None, "foto_versi": 0})
    await log_activity(actor, "buat", "lapak", l.id, l.nama)
    return l


@admin_router.patch("/lapak/{lid}", response_model=Lapak)
async def update_lapak(lid: str, input: LapakUpdate, actor: str = Depends(require_super)):
    l = await _lapak(lid)
    changes = input.model_dump(exclude_none=True)
    if "nama" in changes and changes["nama"] != l.nama and await db.lapak.find_one({"nama": changes["nama"]}):
        raise HTTPException(status_code=409, detail="Nama lapak sudah ada")
    if changes:
        await db.lapak.update_one({"id": lid}, {"$set": changes})
        await log_activity(actor, "ubah", "lapak", lid, l.nama, ", ".join(changes))
    return await _lapak(lid)


@admin_router.delete("/lapak/{lid}")
async def delete_lapak(lid: str, actor: str = Depends(require_super)):
    l = await _lapak(lid)
    if lid in await _terisi():
        raise HTTPException(status_code=409, detail="Lapak masih disewa — tidak bisa dihapus")
    await db.lapak.delete_one({"id": lid})
    await db.sewa.update_many({"lapak_id": lid, "status": "menunggu"}, {"$set": {"status": "ditolak"}})
    await log_activity(actor, "hapus", "lapak", lid, l.nama)
    return {"deleted": True}


def _cek_magic(data: bytes, ext: str) -> bool:
    if ext == "jpg":
        return data[:3] == b"\xff\xd8\xff"
    if ext == "png":
        return data[:8] == b"\x89PNG\r\n\x1a\n"
    return data[:4] == b"RIFF" and data[8:12] == b"WEBP"


@admin_router.post("/lapak/{lid}/foto", response_model=Lapak)
async def upload_foto(lid: str, file: UploadFile = File(...), actor: str = Depends(require_super)):
    l = await _lapak(lid)
    ext = FOTO_TYPES.get(file.content_type or "")
    data = await file.read()
    if not ext or not _cek_magic(data, ext):
        raise HTTPException(status_code=415, detail="Foto harus JPG, PNG, atau WEBP yang valid")
    if len(data) > FOTO_MAX:
        raise HTTPException(status_code=413, detail="Ukuran foto maksimal 5 MB")
    res = await asyncio.to_thread(put_object, f"{APP_NAME}/lapak/{lid}/{uuid.uuid4()}.{ext}", data, file.content_type)
    await db.lapak.update_one({"id": lid}, {"$set": {"foto_path": res["path"]}, "$inc": {"foto_versi": 1}})
    await log_activity(actor, "ubah", "lapak", lid, l.nama, "foto diperbarui")
    return await _lapak(lid)


@admin_router.delete("/lapak/{lid}/foto", response_model=Lapak)
async def hapus_foto(lid: str, actor: str = Depends(require_super)):
    await _lapak(lid)
    await db.lapak.update_one({"id": lid}, {"$set": {"foto_path": None}})
    return await _lapak(lid)


# ---------- Admin: Sewa / Pendaftaran Lapak ----------
@admin_router.get("/sewa", response_model=List[SewaOut])
async def list_sewa(status: str | None = None):
    docs = await db.sewa.find({"status": status} if status else {}).sort("created_at", -1).to_list(2000)
    return [await sewa_out(d) for d in docs]


@admin_router.post("/sewa", response_model=SewaOut, status_code=201)
async def assign_sewa(input: SewaAdminInput, actor: str = Depends(require_session)):
    """Admin menetapkan pedagang ke lapak — langsung aktif."""
    lapak = await _lapak(input.lapak_id)
    p = await get_pedagang({"id": input.pedagang_id})
    await _cek_kosong(lapak.id, input.mulai, input.selesai)
    s = _sewa_baru(lapak, input.mulai, input.selesai, pedagang_id=p.id, user_id=p.user_id, nama=p.nama,
                   no_hp=p.no_hp, status="aktif", sumber="admin")
    await db.sewa.insert_one(s.model_dump())
    await log_activity(actor, "buat", "sewa", s.id, f"{p.nama} → {lapak.nama}", f"{s.mulai} s/d {s.selesai}")
    return await sewa_out(s.model_dump())


async def _sewa_menunggu(sid: str) -> dict:
    doc = await db.sewa.find_one({"id": sid})
    if not doc:
        raise HTTPException(status_code=404, detail="Pendaftaran tidak ditemukan")
    if doc["status"] != "menunggu":
        raise HTTPException(status_code=409, detail=f"Pendaftaran sudah {doc['status']}")
    return doc


@admin_router.post("/sewa/{sid}/terima", response_model=SewaOut)
async def terima_sewa(sid: str, actor: str = Depends(require_session)):
    """Konfirmasi oleh Super Admin / Staf Pemungut Iuran."""
    doc = await _sewa_menunggu(sid)
    await _cek_kosong(doc["lapak_id"], doc["mulai"], doc["selesai"])
    # Ambil alih status dulu (atomik) agar pedagang tidak dibuat ganda saat klik bersamaan.
    res = await db.sewa.update_one({"id": sid, "status": "menunggu"}, {"$set": {"status": "aktif"}})
    if not res.modified_count:
        raise HTTPException(status_code=409, detail="Pendaftaran sudah diproses")
    if not doc.get("pedagang_id"):
        try:
            p = await buat_pedagang(PedagangInput(nama=doc["nama"], nik=doc.get("nik") or "000", no_hp=doc.get("no_hp", "")), actor)
        except HTTPException:
            await db.sewa.update_one({"id": sid}, {"$set": {"status": "menunggu"}})  # batalkan
            raise
        await db.sewa.update_one({"id": sid}, {"$set": {"pedagang_id": p.id, "user_id": p.user_id}})
    # Booking lain yang bentrok di lapak yang sama otomatis ditolak.
    await db.sewa.update_many({"lapak_id": doc["lapak_id"], "status": "menunggu", "mulai": {"$lte": doc["selesai"]},
                               "selesai": {"$gte": doc["mulai"]}}, {"$set": {"status": "ditolak"}})
    await log_activity(actor, "konfirmasi", "sewa", sid, f"{doc['nama']} → {doc['lapak_nama']}")
    return await sewa_out(await db.sewa.find_one({"id": sid}))


@admin_router.post("/sewa/{sid}/tolak", response_model=SewaOut)
async def tolak_sewa(sid: str, actor: str = Depends(require_session)):
    doc = await _sewa_menunggu(sid)
    await db.sewa.update_one({"id": sid}, {"$set": {"status": "ditolak"}})
    await log_activity(actor, "tolak", "sewa", sid, doc["nama"], doc["lapak_nama"])
    return await sewa_out({**doc, "status": "ditolak"})


@admin_router.delete("/sewa/{sid}")
async def delete_sewa(sid: str, actor: str = Depends(require_super)):
    doc = await db.sewa.find_one_and_delete({"id": sid})
    if not doc:
        raise HTTPException(status_code=404, detail="Sewa tidak ditemukan")
    await log_activity(actor, "hapus", "sewa", sid, doc["nama"], doc["lapak_nama"])
    return {"deleted": True}
