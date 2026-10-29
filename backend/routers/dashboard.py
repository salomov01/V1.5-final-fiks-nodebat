"""Ringkasan Dashboard. Angka uang = None untuk Staf Pemungut Iuran."""

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from lib.dates import today_iso
from lib.db import db
from routers.auth import SUPER_ADMIN, Principal, get_principal

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


class Titik(BaseModel):
    label: str
    sewa: int
    iuran: int


class Stats(BaseModel):
    jumlah_pedagang: int
    jumlah_lapak: int
    lapak_terisi: int
    sewa_menunggu: int
    iuran_hari_ini: int  # jumlah transaksi iuran hari ini
    sewa_aktif: int
    pemasukan_hari_ini: int | None
    pemasukan_bulan_ini: int | None
    grafik_6_bulan: list[Titik] | None


async def _sum(match: dict) -> dict[str, int]:
    rows = await db.payments.aggregate([{"$match": match}, {"$group": {"_id": "$jenis", "t": {"$sum": "$jumlah"}}}]).to_list(5)
    return {r["_id"]: r["t"] for r in rows}


@router.get("/stats", response_model=Stats)
async def stats(me: Principal = Depends(get_principal)):
    today = today_iso()
    aktif = {"status": "aktif", "selesai": {"$gte": today}}
    base = dict(
        jumlah_pedagang=await db.pedagang.count_documents({"aktif": True}),
        jumlah_lapak=await db.lapak.count_documents({}),
        lapak_terisi=len(await db.sewa.distinct("lapak_id", aktif)),
        sewa_menunggu=await db.sewa.count_documents({"status": "menunggu"}),
        iuran_hari_ini=await db.payments.count_documents({"jenis": "iuran", "tanggal": today}),
        sewa_aktif=await db.sewa.count_documents(aktif),
    )
    if me.role != SUPER_ADMIN:
        return Stats(**base, pemasukan_hari_ini=None, pemasukan_bulan_ini=None, grafik_6_bulan=None)
    d = date.fromisoformat(today)
    grafik = []
    for i in range(5, -1, -1):
        y, m = (d.year * 12 + d.month - 1 - i) // 12, (d.month - 1 - i) % 12 + 1
        s = await _sum({"tanggal": {"$regex": f"^{y}-{m:02d}"}})
        grafik.append(Titik(label=f"{BULAN[m - 1]} {str(y)[2:]}", sewa=s.get("sewa", 0), iuran=s.get("iuran", 0)))
    hari = await _sum({"tanggal": today})
    return Stats(**base, pemasukan_hari_ini=sum(hari.values()),
                 pemasukan_bulan_ini=grafik[-1].sewa + grafik[-1].iuran, grafik_6_bulan=grafik)
