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
    nilai_menunggu: int
    pemasukan_bulan_ini: int
    pemasukan_bulan_lalu: int
    by_kategori: dict[str, int]  # penyewa aktif per kategori
    revenue_6m: list[RevenuePoint]
    recent_payments: list[Payment]
    generated_at: datetime
