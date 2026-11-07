"""Input Pengeluaran (khusus Super Admin). Kategori Gaji terhubung ke akun Pemungut (gaji_bulanan)."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from lib.activity import log_activity
from lib.dates import today_iso
from lib.db import db
from lib.serialize import to_aware
from routers.auth import Principal, get_principal, require_super
from routers.payments import rentang

router = APIRouter(prefix="/pengeluaran", tags=["pengeluaran"], dependencies=[Depends(require_super)])

Kategori = Literal["barang", "jasa", "daya", "operasional", "gaji"]
LABEL_KATEGORI = {"barang": "Barang", "jasa": "Jasa", "daya": "Daya", "operasional": "Operasional Lain-lain", "gaji": "Gaji"}


class PengeluaranInput(BaseModel):
    kategori: Kategori
    keterangan: str = Field(default="", max_length=300)
    jumlah: int | None = Field(default=None, ge=1, le=1_000_000_000_000)
    tanggal: str = Field(default_factory=today_iso, pattern=r"^\d{4}-\d{2}-\d{2}$")
    pemungut_id: str | None = None  # wajib untuk kategori Gaji
    periode_gaji: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}$")


class Pengeluaran(BaseModel):
    id: str
    kategori: Kategori
    keterangan: str
    jumlah: int
    tanggal: str
    pemungut_id: str | None = None
    penerima: str = ""
    periode_gaji: str | None = None
    dicatat_oleh: str
    created_at: datetime


class PengeluaranList(BaseModel):
    items: list[Pengeluaran]
    total: int


async def cari_pengeluaran(periode: str, tanggal: str, kategori: str | None = None) -> list[Pengeluaran]:
    dari, sampai = rentang(periode, tanggal)
    q: dict = {"tanggal": {"$gte": dari, "$lte": sampai}}
    if kategori:
        q["kategori"] = kategori
    docs = await db.pengeluaran.find(q, {"_id": 0}).sort([("tanggal", -1), ("created_at", -1)]).to_list(20000)
    return [Pengeluaran(**to_aware(d, "created_at")) for d in docs]


@router.get("", response_model=PengeluaranList)
async def list_pengeluaran(
    periode: str = Query("bulanan", pattern="^(harian|bulanan|tahunan)$"),
    tanggal: str = Query(default_factory=today_iso, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    kategori: Kategori | None = None,
):
    items = await cari_pengeluaran(periode, tanggal, kategori)
    return PengeluaranList(items=items, total=sum(p.jumlah for p in items))


async def _gaji(input: PengeluaranInput) -> dict:
    u = input.pemungut_id and await db.users.find_one({"id": input.pemungut_id, "role": "staff"})
    if not u:
        raise HTTPException(status_code=422, detail="Pilih akun Pemungut untuk kategori Gaji")
    jumlah = input.jumlah or u.get("gaji_bulanan", 0)
    if jumlah <= 0:
        raise HTTPException(status_code=422, detail=f"Gaji dasar {u['nama']} belum diisi — atur di Settings › Akun")
    periode = input.periode_gaji or input.tanggal[:7]
    return {"jumlah": jumlah, "penerima": u["nama"], "periode_gaji": periode,
            "keterangan": input.keterangan.strip() or f"Gaji {u['nama']} bulan {periode}"}


@router.post("", response_model=Pengeluaran, status_code=201)
async def create_pengeluaran(input: PengeluaranInput, me: Principal = Depends(get_principal)):
    if input.kategori == "gaji":
        extra = await _gaji(input)
    else:
        if not input.jumlah:
            raise HTTPException(status_code=422, detail="Jumlah wajib diisi")
        if len(input.keterangan.strip()) < 3:
            raise HTTPException(status_code=422, detail="Keterangan minimal 3 karakter")
        extra = {"jumlah": input.jumlah, "keterangan": input.keterangan.strip(), "penerima": "", "periode_gaji": None}
    p = Pengeluaran(id=str(uuid.uuid4()), kategori=input.kategori, tanggal=input.tanggal,
                    pemungut_id=input.pemungut_id if input.kategori == "gaji" else None,
                    dicatat_oleh=me.nama, created_at=datetime.now(timezone.utc), **extra)
    try:
        await db.pengeluaran.insert_one(p.model_dump())
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail=f"Gaji {p.penerima} bulan {p.periode_gaji} sudah dicatat")
    await log_activity(me.username, "buat", "pengeluaran", p.id, LABEL_KATEGORI[p.kategori], f"Rp{p.jumlah}")
    return p


@router.delete("/{pid}")
async def delete_pengeluaran(pid: str, actor: str = Depends(require_super)):
    d = await db.pengeluaran.find_one_and_delete({"id": pid})
    if not d:
        raise HTTPException(status_code=404, detail="Pengeluaran tidak ditemukan")
    await log_activity(actor, "hapus", "pengeluaran", pid, d["keterangan"], f"Rp{d['jumlah']}")
    return {"deleted": True}
