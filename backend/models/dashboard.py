"""Model agregat untuk dashboard."""

from datetime import datetime

from pydantic import BaseModel

from models.payment import Payment


class RevenuePoint(BaseModel):
    label: str  # "Jul", "Agu", ...
    total: int


class DashboardStats(BaseModel):
    total_penyewa: int
    penyewa_aktif: int
    tagihan_menunggu: int
    # Field uang bernilai None untuk Staff (Admin Tingkat 1) — total disembunyikan di server.
    nilai_menunggu: int | None
    pemasukan_bulan_ini: int | None
    pemasukan_bulan_lalu: int | None
    by_kategori: dict[str, int]  # penyewa aktif per kategori
    revenue_6m: list[RevenuePoint] | None
    recent_payments: list[Payment]
    generated_at: datetime
