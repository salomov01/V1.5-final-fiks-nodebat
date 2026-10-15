"""Model data penyewa lapak — Desa Adat Jimbaran."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

KategoriSewa = Literal["harian", "bulanan", "tahunan"]
StatusPenyewa = Literal["aktif", "berhenti"]


def aware_utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Tenant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nomor_id: str  # LPK-JMB-001 — ini + nama_lengkap yang dienkode ke QR
    nama_lengkap: str
    no_hp: str = ""
    kategori: KategoriSewa
    blok: str
    tarif: int  # Rupiah per periode sewa
    mulai: str  # YYYY-MM-DD
    selesai: str  # YYYY-MM-DD
    status: StatusPenyewa = "aktif"
    catatan: str = ""
    created_at: datetime = Field(default_factory=aware_utcnow)


class TenantCreate(BaseModel):
    nomor_id: str = ""  # kosongkan -> digenerate otomatis
    nama_lengkap: str = Field(min_length=1, max_length=120)
    no_hp: str = Field(default="", max_length=30)
    kategori: KategoriSewa
    blok: str = Field(min_length=1, max_length=120)
    # Tarif wajib positif dan dalam batas wajar.
    tarif: int = Field(gt=0, le=1_000_000_000)
    mulai: str
    selesai: str
    status: StatusPenyewa = "aktif"
    catatan: str = Field(default="", max_length=500)


class TenantUpdate(BaseModel):
    nama_lengkap: str | None = Field(default=None, min_length=1, max_length=120)
    no_hp: str | None = Field(default=None, max_length=30)
    kategori: KategoriSewa | None = None
    blok: str | None = Field(default=None, min_length=1, max_length=120)
    tarif: int | None = Field(default=None, gt=0, le=1_000_000_000)
    mulai: str | None = None
    selesai: str | None = None
    status: StatusPenyewa | None = None
    catatan: str | None = Field(default=None, max_length=500)
