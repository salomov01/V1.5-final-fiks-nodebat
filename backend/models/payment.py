"""Model pembayaran sewa lapak."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MetodeBayar = Literal["tunai", "qris", "transfer"]
StatusBayar = Literal["menunggu", "lunas", "ditolak"]


class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    nomor_id: str  # denormalisasi agar tabel tetap cepat dirender
    nama_lengkap: str
    periode: str  # label bebas, mis. "Desember 2025" / "Retribusi 12/07"
    jumlah: int
    metode: MetodeBayar = "tunai"
    status: StatusBayar = "menunggu"
    jatuh_tempo: str = ""  # YYYY-MM-DD, opsional
    catatan: str = ""
    penagih: str = ""  # nama penagih/juru pungut yang menagih pembayaran ini
    confirmed_at: datetime | None = None
    created_at: datetime


class PaymentCreate(BaseModel):
    tenant_id: str
    periode: str
    # Nominal wajib positif — mencegah tagihan nol/negatif yang merusak rekap.
    jumlah: int = Field(gt=0, le=1_000_000_000)
    metode: MetodeBayar = "tunai"
    jatuh_tempo: str = ""
    catatan: str = ""
    penagih: str = ""


class ScanCollectInput(BaseModel):
    """Penagihan dari hasil scan QR oleh penagih di lapangan."""
    tenant_id: str
    penagih: str = Field(min_length=1, max_length=120)
    sudah_bayar: bool


class OverduePayment(Payment):
    """Tagihan menunggu yang sudah melewati jatuh tempo (dihitung server, zona WITA)."""

    hari_telat: int
    kategori: str = ""
    blok: str = ""
    no_hp: str = ""


class OverdueSummary(BaseModel):
    periode_hari_ini: str          # YYYY-MM-DD (WITA)
    jumlah_penyewa: int
    total_tunggakan: int
    telat_terlama: int             # hari
    items: list[OverduePayment]


class BulkBillResult(BaseModel):
    periode: str
    dibuat: int
    dilewati: int                  # sudah punya tagihan periode ini
    total_nilai: int
