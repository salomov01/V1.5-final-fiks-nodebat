"""Model katalog lapak (publik) & pendaftaran calon penyewa."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, computed_field

KategoriSewa = Literal["harian", "bulanan", "tahunan"]
StatusLapak = Literal["kosong", "terisi"]
StatusPendaftaran = Literal["baru", "diterima", "ditolak"]


def aware_utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LapakUnit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    blok: str  # label unik lapak, dicocokkan dengan Tenant.blok
    jenis: str = ""  # mis. "Pangan", "Sayur & Buah"
    kategori: KategoriSewa
    tarif: int
    deskripsi: str = ""
    foto_path: str | None = Field(default=None, exclude=True)
    foto_versi: int = Field(default=0, exclude=True)
    created_at: datetime = Field(default_factory=aware_utcnow)

    @computed_field
    @property
    def foto_url(self) -> str | None:
        return f"/api/publik/foto/{self.id}?v={self.foto_versi}" if self.foto_path else None


class LapakUnitOut(LapakUnit):
    status: StatusLapak = "kosong"
    terisi_sampai: str | None = None


class LapakPublik(BaseModel):
    """Hanya data yang aman tampil publik — tanpa nama/HP penyewa."""
    id: str
    blok: str
    jenis: str
    kategori: KategoriSewa
    tarif: int
    deskripsi: str
    foto_url: str | None = None


class LapakUnitCreate(BaseModel):
    blok: str = Field(min_length=1, max_length=120)
    jenis: str = Field(default="", max_length=60)
    kategori: KategoriSewa
    tarif: int = Field(gt=0, le=1_000_000_000)
    deskripsi: str = Field(default="", max_length=300)


class LapakUnitUpdate(BaseModel):
    blok: str | None = Field(default=None, min_length=1, max_length=120)
    jenis: str | None = Field(default=None, max_length=60)
    kategori: KategoriSewa | None = None
    tarif: int | None = Field(default=None, gt=0, le=1_000_000_000)
    deskripsi: str | None = Field(default=None, max_length=300)


class Pendaftaran(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nama: str
    no_hp: str
    lapak_id: str
    blok: str
    jenis: str = ""
    kategori: KategoriSewa
    tarif: int
    catatan: str = ""
    status: StatusPendaftaran = "baru"
    tenant_nomor_id: str | None = None
    created_at: datetime = Field(default_factory=aware_utcnow)


class PendaftaranCreate(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    no_hp: str = Field(min_length=8, max_length=20, pattern=r"^[0-9+\-\s]+$")
    lapak_id: str = Field(min_length=1, max_length=60)
    catatan: str = Field(default="", max_length=500)


class TerimaInput(BaseModel):
    mulai: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    selesai: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
