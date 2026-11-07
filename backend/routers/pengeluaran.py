"""Input Pengeluaran (khusus Super Admin). Gaji: penerima = akun Pemungut atau Pegawai (tanpa login)."""

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
    keterangan: str = Field(default="", max_length=300)  # Kegiatan / nama barang
    catatan: str = Field(default="", max_length=200)  # kolom "Keterangan" bebas di laporan (mis. nota)
    jumlah: int | None = Field(default=None, ge=1, le=1_000_000_000_000)
    tanggal: str = Field(default_factory=today_iso, pattern=r"^\d{4}-\d{2}-\d{2}$")
    pemungut_id: str | None = None  # id penerima gaji (akun Pemungut atau Pegawai) — wajib untuk Gaji
    periode_gaji: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}$")


class Pengeluaran(BaseModel):
    id: str
    kategori: Kategori
    keterangan: str
    catatan: str = ""
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


class PegawaiInput(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    jabatan: str = Field(default="", max_length=80)
    gaji_bulanan: int = Field(default=0, ge=0, le=1_000_000_000)


class Pegawai(PegawaiInput):
    id: str


class PenerimaGaji(BaseModel):
    id: str
    nama: str
    jabatan: str
    gaji_bulanan: int
    sumber: Literal["akun", "pegawai"]


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


# ---------- Penerima gaji: akun Pemungut + Pegawai tanpa login ----------
@router.get("/penerima-gaji", response_model=list[PenerimaGaji])
async def penerima_gaji():
    akun = [PenerimaGaji(id=u["id"], nama=u["nama"], jabatan="Pemungut", gaji_bulanan=u.get("gaji_bulanan", 0), sumber="akun")
            async for u in db.users.find({"role": "staff"}).sort("nama", 1)]
    pegawai = [PenerimaGaji(**d, sumber="pegawai") async for d in db.pegawai.find({}, {"_id": 0}).sort("nama", 1)]
    return pegawai + akun


@router.get("/pegawai", response_model=list[Pegawai])
async def list_pegawai():
    return [Pegawai(**d) async for d in db.pegawai.find({}, {"_id": 0}).sort("nama", 1)]


@router.post("/pegawai", response_model=Pegawai, status_code=201)
async def create_pegawai(input: PegawaiInput, actor: str = Depends(require_super)):
    p = Pegawai(id=str(uuid.uuid4()), **input.model_dump())
    await db.pegawai.insert_one(p.model_dump())
    await log_activity(actor, "buat", "pegawai", p.id, p.nama, f"Rp{p.gaji_bulanan}")
    return p


@router.put("/pegawai/{pid}", response_model=Pegawai)
async def update_pegawai(pid: str, input: PegawaiInput, actor: str = Depends(require_super)):
    res = await db.pegawai.update_one({"id": pid}, {"$set": input.model_dump()})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan")
    await log_activity(actor, "ubah", "pegawai", pid, input.nama, f"Rp{input.gaji_bulanan}")
    return Pegawai(id=pid, **input.model_dump())


@router.delete("/pegawai/{pid}")
async def delete_pegawai(pid: str, actor: str = Depends(require_super)):
    d = await db.pegawai.find_one_and_delete({"id": pid})
    if not d:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan")
    await log_activity(actor, "hapus", "pegawai", pid, d["nama"])
    return {"deleted": True}


async def _gaji(input: PengeluaranInput) -> dict:
    pid = input.pemungut_id
    r = pid and (await db.users.find_one({"id": pid, "role": "staff"}) or await db.pegawai.find_one({"id": pid}))
    if not r:
        raise HTTPException(status_code=422, detail="Pilih penerima gaji (Pemungut / Pegawai)")
    jumlah = input.jumlah or r.get("gaji_bulanan", 0)
    if jumlah <= 0:
        raise HTTPException(status_code=422, detail=f"Gaji dasar {r['nama']} belum diisi")
    periode = input.periode_gaji or input.tanggal[:7]
    return {"jumlah": jumlah, "penerima": r["nama"], "periode_gaji": periode,
            "keterangan": input.keterangan.strip() or f"Catu {r['nama']}"}


@router.post("", response_model=Pengeluaran, status_code=201)
async def create_pengeluaran(input: PengeluaranInput, me: Principal = Depends(get_principal)):
    if input.kategori == "gaji":
        extra = await _gaji(input)
    else:
        if not input.jumlah:
            raise HTTPException(status_code=422, detail="Nilai wajib diisi")
        if len(input.keterangan.strip()) < 2:
            raise HTTPException(status_code=422, detail="Kegiatan / barang wajib diisi")
        extra = {"jumlah": input.jumlah, "keterangan": input.keterangan.strip(), "penerima": "", "periode_gaji": None}
    p = Pengeluaran(id=str(uuid.uuid4()), kategori=input.kategori, tanggal=input.tanggal, catatan=input.catatan.strip(),
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
