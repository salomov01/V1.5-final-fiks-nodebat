"""Model data pasar: Pedagang, Lapak (+iuran, satu paket), Sewa lapak, Pembayaran."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, computed_field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


TGL = r"^\d{4}-\d{2}-\d{2}$"


# ---------- Pedagang ----------
class PedagangInput(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    nik: str = Field(min_length=3, max_length=20, pattern=r"^\d+$")
    no_hp: str = Field(default="", max_length=20)
    alamat: str = Field(default="", max_length=300)


class PedagangUpdate(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=120)
    no_hp: str | None = Field(default=None, max_length=20)
    alamat: str | None = Field(default=None, max_length=300)
    aktif: bool | None = None


class Pedagang(PedagangInput):
    id: str = Field(default_factory=new_id)
    user_id: str  # format [NO_URUT]-[3 digit akhir KTP], mis. 01-123 — isi QR permanen
    aktif: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class PedagangRingkas(BaseModel):
    """Aman untuk publik (pencarian saat sewa): tanpa NIK/HP/alamat."""
    id: str
    user_id: str
    nama: str


# ---------- Lapak & Iuran (satu paket) ----------
class LapakInput(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    jenis: str = Field(default="", max_length=60)
    harga_sewa: int = Field(gt=0, le=1_000_000_000)  # per bulan
    iuran: int = Field(ge=0, le=100_000_000)  # per hari
    deskripsi: str = Field(default="", max_length=300)


class LapakUpdate(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=120)
    jenis: str | None = Field(default=None, max_length=60)
    harga_sewa: int | None = Field(default=None, gt=0, le=1_000_000_000)
    iuran: int | None = Field(default=None, ge=0, le=100_000_000)
    deskripsi: str | None = Field(default=None, max_length=300)


class Lapak(LapakInput):
    id: str = Field(default_factory=new_id)
    foto_path: str | None = Field(default=None, exclude=True)
    foto_versi: int = Field(default=0, exclude=True)
    created_at: datetime = Field(default_factory=utcnow)

    @computed_field
    @property
    def foto_url(self) -> str | None:
        return f"/api/publik/foto/{self.id}?v={self.foto_versi}" if self.foto_path else None


class LapakPublik(BaseModel):
    id: str
    nama: str
    jenis: str
    harga_sewa: int
    iuran: int
    deskripsi: str
    foto_url: str | None = None


class LapakAdmin(LapakPublik):
    status: Literal["kosong", "terisi"]
    penyewa: str | None = None
    terisi_sampai: str | None = None


# ---------- Sewa lapak ----------
StatusSewa = Literal["menunggu", "aktif", "ditolak"]


class SewaAdminInput(BaseModel):
    """Admin assign pedagang ke lapak (langsung aktif)."""
    pedagang_id: str
    lapak_id: str
    mulai: str = Field(pattern=TGL)
    selesai: str = Field(pattern=TGL)


class SewaPublikInput(BaseModel):
    """Booking dari halaman publik: pilih akun pedagang, atau isi data pedagang baru."""
    lapak_id: str
    mulai: str = Field(pattern=TGL)
    selesai: str = Field(pattern=TGL)
    pedagang_id: str | None = None
    nama: str = Field(default="", max_length=120)
    nik: str = Field(default="", max_length=20, pattern=r"^\d*$")
    no_hp: str = Field(default="", max_length=20)
    catatan: str = Field(default="", max_length=300)


class Sewa(BaseModel):
    id: str = Field(default_factory=new_id)
    pedagang_id: str | None = None  # None = pedagang baru (dibuat saat dikonfirmasi)
    user_id: str | None = None
    nama: str
    nik: str = Field(default="", exclude=True)
    no_hp: str = ""
    lapak_id: str
    lapak_nama: str
    mulai: str
    selesai: str
    hari: int
    harga_sewa: int
    iuran: int
    total_harga: int
    status: StatusSewa = "menunggu"
    sumber: Literal["publik", "admin"] = "publik"
    catatan: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class SewaOut(Sewa):
    terbayar: int = 0
    sisa: int = 0


# ---------- Pembayaran ----------
JenisBayar = Literal["iuran", "sewa"]


class BayarInput(BaseModel):
    sewa_id: str
    jumlah: int | None = Field(default=None, gt=0)  # sewa: default = sisa tagihan


class Payment(BaseModel):
    id: str = Field(default_factory=new_id)
    jenis: JenisBayar
    sewa_id: str
    pedagang_id: str
    user_id: str
    nama: str
    lapak_nama: str
    periode: str  # sewa: "2026-06-01 s/d 2026-06-30"; iuran: tanggal
    jumlah: int
    tanggal: str  # tanggal bayar (zona APP_TZ)
    penagih: str
    sisa_setelah: int | None = None  # sisa sewa tepat setelah pembayaran (kuitansi)
    tanggal_iuran: list[str] = Field(default_factory=list)  # hari iuran yang dilunasi (pembayaran tunggakan)
    status: Literal["lunas"] = "lunas"
    created_at: datetime = Field(default_factory=utcnow)


class PaymentList(BaseModel):
    items: list[Payment]
    # None untuk Staf Pemungut Iuran — total uang disembunyikan server.
    total_sewa: int | None
    total_iuran: int | None
    total: int | None
