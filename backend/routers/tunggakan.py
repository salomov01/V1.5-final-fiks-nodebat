"""Tunggakan: iuran harian yang belum dibayar (sejak tanggal mulai hitung s/d kemarin) & sisa sewa lapak."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.activity import log_activity
from lib.dates import today_iso
from lib.db import db
from models.pasar import Payment
from routers.auth import Principal, get_principal, require_session, require_super
from routers.katalog import sewa_out
from routers.payments import _sewa_aktif, _simpan

router = APIRouter(tags=["tunggakan"], dependencies=[Depends(require_session)])


class TunggakanIuran(BaseModel):
    sewa_id: str
    pedagang_id: str | None
    user_id: str | None
    nama: str
    lapak_nama: str
    iuran: int
    tanggal: list[str]
    total: int


class TunggakanSewa(BaseModel):
    sewa_id: str
    pedagang_id: str | None
    user_id: str | None
    nama: str
    lapak_nama: str
    mulai: str
    selesai: str
    total_harga: int
    terbayar: int
    sisa: int


class RekapTunggakan(BaseModel):
    mulai_hitung: str
    iuran: list[TunggakanIuran]
    sewa: list[TunggakanSewa]
    total_iuran: int
    total_sewa: int


class PengaturanTunggakan(BaseModel):
    mulai: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


async def mulai_hitung() -> str:
    """Tanggal sistem mulai dipakai (disimpan saat pertama diakses, bisa diubah Super Admin)."""
    d = await db.pengaturan.find_one_and_update(
        {"_id": "tunggakan"}, {"$setOnInsert": {"mulai": today_iso()}}, upsert=True, return_document=True)
    return d["mulai"]


async def hari_belum_bayar(s: dict, mulai: str, kemarin: str) -> list[str]:
    if s.get("iuran", 0) <= 0:
        return []
    dari, sampai = max(s["mulai"], mulai), min(s["selesai"], kemarin)
    if dari > sampai:
        return []
    lunas = {d["_id"].split(":", 1)[1] async for d in db.iuran_lock.find({"_id": {"$regex": f"^{s['id']}:"}}, {"_id": 1})}
    a, b = date.fromisoformat(dari), date.fromisoformat(sampai)
    return [t for i in range((b - a).days + 1) if (t := (a + timedelta(days=i)).isoformat()) not in lunas]


async def rekap(pedagang_id: str | None = None) -> RekapTunggakan:
    mulai, today = await mulai_hitung(), today_iso()
    kemarin = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    q: dict = {"status": "aktif", "mulai": {"$lte": today}}
    if pedagang_id:
        q["pedagang_id"] = pedagang_id
    iuran, sewa = [], []
    async for d in db.sewa.find(q).sort([("nama", 1), ("mulai", 1)]):
        base = {"sewa_id": d["id"], "pedagang_id": d.get("pedagang_id"), "user_id": d.get("user_id"),
                "nama": d["nama"], "lapak_nama": d["lapak_nama"]}
        if hari := await hari_belum_bayar(d, mulai, kemarin):
            iuran.append(TunggakanIuran(**base, iuran=d["iuran"], tanggal=hari, total=d["iuran"] * len(hari)))
        s = await sewa_out(d)
        if s.sisa > 0:
            sewa.append(TunggakanSewa(**base, mulai=s.mulai, selesai=s.selesai, total_harga=s.total_harga, terbayar=s.terbayar, sisa=s.sisa))
    return RekapTunggakan(mulai_hitung=mulai, iuran=iuran, sewa=sewa,
                          total_iuran=sum(t.total for t in iuran), total_sewa=sum(t.sisa for t in sewa))


@router.get("/tunggakan", response_model=RekapTunggakan)
async def list_tunggakan(pedagang_id: str | None = None):
    return await rekap(pedagang_id)


class BayarTunggakanIuran(BaseModel):
    sewa_id: str
    tanggal: list[str] = Field(min_length=1, max_length=3660)


@router.post("/payments/tunggakan-iuran", response_model=Payment, status_code=201)
async def bayar_tunggakan_iuran(input: BayarTunggakanIuran, me: Principal = Depends(get_principal)):
    s = await _sewa_aktif(input.sewa_id)
    kemarin = (date.fromisoformat(today_iso()) - timedelta(days=1)).isoformat()
    belum = set(await hari_belum_bayar(s.model_dump(), await mulai_hitung(), kemarin))
    pilih = sorted(set(input.tanggal))
    if not set(pilih) <= belum:
        raise HTTPException(status_code=409, detail="Sebagian tanggal sudah dibayar atau bukan tunggakan — muat ulang data")
    terkunci = []
    for t in pilih:
        res = await db.iuran_lock.update_one({"_id": f"{s.id}:{t}"}, {"$setOnInsert": {"at": t}}, upsert=True)
        if res.upserted_id is None:
            await db.iuran_lock.delete_many({"_id": {"$in": [f"{s.id}:{x}" for x in terkunci]}})
            raise HTTPException(status_code=409, detail="Tunggakan sedang/sudah dibayar petugas lain — muat ulang data")
        terkunci.append(t)
    periode = f"Tunggakan {len(pilih)} hari: " + ", ".join(pilih)
    return await _simpan("iuran", s, s.iuran * len(pilih), periode, me, tanggal_iuran=pilih)


@router.get("/pengaturan/tunggakan", response_model=PengaturanTunggakan)
async def get_pengaturan():
    return PengaturanTunggakan(mulai=await mulai_hitung())


@router.put("/pengaturan/tunggakan", response_model=PengaturanTunggakan)
async def set_pengaturan(input: PengaturanTunggakan, actor: str = Depends(require_super)):
    if input.mulai > today_iso():
        raise HTTPException(status_code=422, detail="Tanggal mulai tidak boleh setelah hari ini")
    await db.pengaturan.update_one({"_id": "tunggakan"}, {"$set": {"mulai": input.mulai}}, upsert=True)
    await log_activity(actor, "ubah", "pengaturan", "tunggakan", "Mulai hitung tunggakan", input.mulai)
    return input
