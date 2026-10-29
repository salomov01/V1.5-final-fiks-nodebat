"""Pembayaran Sewa Lapak & Iuran harian, alur Pindai QR, dan daftar laporan keuangan."""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from lib.activity import log_activity
from lib.dates import today_iso
from lib.db import db
from lib.serialize import to_aware
from models.pasar import BayarInput, Payment, PaymentList, Pedagang, SewaOut
from routers.auth import SUPER_ADMIN, Principal, get_principal, require_session, require_super
from routers.katalog import sewa_out
from routers.pedagang import get_pedagang

router = APIRouter(tags=["pembayaran"], dependencies=[Depends(require_session)])


def rentang(periode: str, tanggal: str) -> tuple[str, str]:
    """Filter Harian / Bulanan / Tahunan -> (dari, sampai) inklusif, format YYYY-MM-DD."""
    d = date.fromisoformat(tanggal)
    if periode == "harian":
        return tanggal, tanggal
    if periode == "bulanan":
        nxt = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
        return d.replace(day=1).isoformat(), date.fromordinal(nxt.toordinal() - 1).isoformat()
    return f"{d.year}-01-01", f"{d.year}-12-31"


async def cari_pembayaran(periode: str, tanggal: str, jenis: str | None) -> list[Payment]:
    dari, sampai = rentang(periode, tanggal)
    q: dict = {"tanggal": {"$gte": dari, "$lte": sampai}}
    if jenis:
        q["jenis"] = jenis
    docs = await db.payments.find(q).sort([("tanggal", -1), ("created_at", -1)]).to_list(20000)
    return [Payment(**to_aware(d, "created_at")) for d in docs]


@router.get("/payments", response_model=PaymentList)
async def list_payments(
    periode: str = Query("bulanan", pattern="^(harian|bulanan|tahunan)$"),
    tanggal: str = Query(default_factory=today_iso, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    jenis: str | None = Query(None, pattern="^(iuran|sewa)$"),
    me: Principal = Depends(get_principal),
):
    items = await cari_pembayaran(periode, tanggal, jenis)
    if me.role != SUPER_ADMIN:
        return PaymentList(items=items, total_sewa=None, total_iuran=None, total=None)
    ts = sum(p.jumlah for p in items if p.jenis == "sewa")
    ti = sum(p.jumlah for p in items if p.jenis == "iuran")
    return PaymentList(items=items, total_sewa=ts, total_iuran=ti, total=ts + ti)


class ScanSewa(SewaOut):
    iuran_hari_ini_lunas: bool


class ScanResult(BaseModel):
    pedagang: Pedagang
    sewa: list[ScanSewa]
    tanggal: str


@router.get("/scan/{user_id}", response_model=ScanResult)
async def scan(user_id: str):
    """Isi QR = User ID pedagang. Hasil: sewa aktif + status iuran hari ini + sisa sewa."""
    p = await get_pedagang({"user_id": user_id.strip()})
    today = today_iso()
    hasil = []
    async for d in db.sewa.find({"pedagang_id": p.id, "status": "aktif", "selesai": {"$gte": today}}).sort("mulai", 1):
        s = await sewa_out(d)
        lunas = bool(await db.payments.find_one({"sewa_id": s.id, "jenis": "iuran", "tanggal": today}))
        hasil.append(ScanSewa(**s.model_dump(), iuran_hari_ini_lunas=lunas))
    return ScanResult(pedagang=p, sewa=hasil, tanggal=today)


async def _sewa_aktif(sid: str) -> SewaOut:
    d = await db.sewa.find_one({"id": sid, "status": "aktif"})
    if not d:
        raise HTTPException(status_code=404, detail="Sewa aktif tidak ditemukan")
    return await sewa_out(d)


async def _simpan(jenis: str, s: SewaOut, jumlah: int, periode: str, me: Principal) -> Payment:
    p = Payment(jenis=jenis, sewa_id=s.id, pedagang_id=s.pedagang_id or "", user_id=s.user_id or "", nama=s.nama,
                lapak_nama=s.lapak_nama, periode=periode, jumlah=jumlah, tanggal=today_iso(),
                penagih=me.nama)  # penagih = akun yang login (readonly di UI)
    await db.payments.insert_one(p.model_dump())
    await log_activity(me.username, "buat", "pembayaran", p.id, f"{jenis} {s.nama}", f"Rp{jumlah}")
    return p


@router.post("/payments/iuran", response_model=Payment, status_code=201)
async def bayar_iuran(input: BayarInput, me: Principal = Depends(get_principal)):
    s = await _sewa_aktif(input.sewa_id)
    today = today_iso()
    if s.iuran <= 0:
        raise HTTPException(status_code=422, detail="Lapak ini tidak dikenai iuran")
    # Unik per sewa per hari: kunci atomik via upsert penanda.
    res = await db.iuran_lock.update_one({"_id": f"{s.id}:{today}"}, {"$setOnInsert": {"at": today}}, upsert=True)
    if res.upserted_id is None:
        raise HTTPException(status_code=409, detail=f"Iuran {s.nama} hari ini sudah dibayar")
    return await _simpan("iuran", s, s.iuran, today, me)


@router.post("/payments/sewa", response_model=Payment, status_code=201)
async def bayar_sewa(input: BayarInput, me: Principal = Depends(get_principal)):
    s = await _sewa_aktif(input.sewa_id)
    if s.sisa <= 0:
        raise HTTPException(status_code=409, detail="Sewa lapak sudah lunas")
    jumlah = min(input.jumlah or s.sisa, s.sisa)
    return await _simpan("sewa", s, jumlah, f"{s.mulai} s/d {s.selesai}", me)


@router.delete("/payments/{pid}")
async def delete_payment(pid: str, actor: str = Depends(require_super)):
    d = await db.payments.find_one_and_delete({"id": pid})
    if not d:
        raise HTTPException(status_code=404, detail="Pembayaran tidak ditemukan")
    if d["jenis"] == "iuran":
        await db.iuran_lock.delete_one({"_id": f"{d['sewa_id']}:{d['tanggal']}"})
    await log_activity(actor, "hapus", "pembayaran", pid, d["nama"], f"{d['jenis']} Rp{d['jumlah']}")
    return {"deleted": True}


@router.get("/pedagang/{pid}/sewa", response_model=List[SewaOut])
async def sewa_pedagang(pid: str):
    return [await sewa_out(d) async for d in db.sewa.find({"pedagang_id": pid}).sort("mulai", -1)]
