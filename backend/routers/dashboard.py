"""Agregat statistik dashboard — semua hitungan "hari ini" berbasis jam server (WITA)."""

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from lib.db import db
from lib.serialize import to_aware
from models.dashboard import DashboardStats, RevenuePoint
from models.payment import Payment
from routers.auth import require_session

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_session)])

BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats():
    zone = ZoneInfo(os.environ.get("APP_TZ", "UTC"))
    now_local = datetime.now(zone)

    total_penyewa = await db.tenants.count_documents({})
    penyewa_aktif = await db.tenants.count_documents({"status": "aktif"})

    by_kategori = {"harian": 0, "bulanan": 0, "tahunan": 0}
    async for t in db.tenants.find({"status": "aktif"}, {"kategori": 1}):
        kategori = t.get("kategori")
        if kategori in by_kategori:
            by_kategori[kategori] += 1

    pending = await db.payments.find({"status": "menunggu"}).to_list(1000)
    tagihan_menunggu = len(pending)
    nilai_menunggu = sum(int(p.get("jumlah", 0)) for p in pending)

    # Pendapatan (pembayaran yang sudah dikonfirmasi) dibucket per bulan lokal WITA.
    lunas = await db.payments.find({"status": "lunas"}).to_list(1000)
    bucket: dict[tuple[int, int], int] = {}
    for p in lunas:
        dt = p.get("confirmed_at")
        if not isinstance(dt, datetime):
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        local = dt.astimezone(zone)
        key = (local.year, local.month)
        bucket[key] = bucket.get(key, 0) + int(p.get("jumlah", 0))

    year, month = now_local.year, now_local.month
    last_year, last_month = (year - 1, 12) if month == 1 else (year, month - 1)
    pemasukan_bulan_ini = bucket.get((year, month), 0)
    pemasukan_bulan_lalu = bucket.get((last_year, last_month), 0)

    revenue_6m: list[RevenuePoint] = []
    for i in range(5, -1, -1):
        y, m = year, month - i
        while m <= 0:
            m += 12
            y -= 1
        revenue_6m.append(RevenuePoint(label=BULAN[m - 1], total=bucket.get((y, m), 0)))

    recent_docs = await db.payments.find().sort("created_at", -1).limit(6).to_list(6)
    recent = [Payment(**to_aware(d, "created_at", "confirmed_at")) for d in recent_docs]

    return DashboardStats(
        total_penyewa=total_penyewa,
        penyewa_aktif=penyewa_aktif,
        tagihan_menunggu=tagihan_menunggu,
        nilai_menunggu=nilai_menunggu,
        pemasukan_bulan_ini=pemasukan_bulan_ini,
        pemasukan_bulan_lalu=pemasukan_bulan_lalu,
        by_kategori=by_kategori,
        revenue_6m=revenue_6m,
        recent_payments=recent,
        generated_at=datetime.now(timezone.utc),
    )
