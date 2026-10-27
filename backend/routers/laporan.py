"""Ekspor rekap pembayaran sewa lapak ke Excel (openpyxl), dengan filter bulan & kategori."""

import io
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from lib.config import JUDUL_LAPORAN_EXCEL, LABEL_ZONA_WAKTU
from lib.db import db
from lib.dates import today_iso
from lib.serialize import to_aware
from models.payment import Payment
from routers.auth import require_super

router = APIRouter(prefix="/laporan", tags=["laporan"], dependencies=[Depends(require_super)])

STATUS_LABEL = {"menunggu": "Menunggu", "lunas": "Lunas", "ditolak": "Ditolak"}
KATEGORI_LABEL = {"harian": "Harian", "bulanan": "Bulanan", "tahunan": "Tahunan"}
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
         "Agustus", "September", "Oktober", "November", "Desember"]


def _aman_excel(nilai: str) -> str:
    """Cegah formula injection: nilai yang diawali = + - @ diberi kutip tunggal
    agar Excel/LibreOffice membacanya sebagai teks, bukan rumus."""
    teks = "" if nilai is None else str(nilai)
    return f"'{teks}" if teks[:1] in ("=", "+", "-", "@") else teks


def _fmt_dt(value) -> str:
    if not value:
        return "-"
    return value.strftime("%d/%m/%Y %H:%M")


@router.get("/pembayaran.xlsx")
async def export_pembayaran_xlsx(
    bulan: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="YYYY-MM (waktu WITA)"),
    kategori: str | None = Query(None, description="harian | bulanan | tahunan"),
    status: str | None = Query(None, description="menunggu | lunas | ditolak"),
):
    if kategori and kategori not in KATEGORI_LABEL:
        raise HTTPException(status_code=422, detail="Kategori tidak dikenal")
    if status and status not in STATUS_LABEL:
        raise HTTPException(status_code=422, detail="Status tidak dikenal")

    query: dict = {}
    if status:
        query["status"] = status

    # Filter kategori: ambil tenant_id penyewa pada kategori tersebut.
    if kategori:
        tenant_ids = [t["id"] async for t in db.tenants.find({"kategori": kategori}, {"id": 1})]
        query["tenant_id"] = {"$in": tenant_ids}

    docs = await db.payments.find(query).sort("created_at", -1).to_list(2000)
    payments = [Payment(**to_aware(d, "created_at", "confirmed_at")) for d in docs]

    # Filter bulan dihitung pada zona WITA (created_at disimpan UTC).
    zone = ZoneInfo(os.environ.get("APP_TZ", "UTC"))
    if bulan:
        year, month = int(bulan[:4]), int(bulan[5:7])
        if not 1 <= month <= 12:
            raise HTTPException(status_code=422, detail="Bulan tidak valid")

        def in_month(p: Payment) -> bool:
            dt = p.created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            local = dt.astimezone(zone)
            return local.year == year and local.month == month

        payments = [p for p in payments if in_month(p)]

    filters: list[str] = []
    if bulan:
        filters.append(f"Bulan {BULAN[int(bulan[5:7]) - 1]} {bulan[:4]}")
    if kategori:
        filters.append(f"Kategori {KATEGORI_LABEL[kategori]}")
    if status:
        filters.append(f"Status {STATUS_LABEL[status]}")
    filter_text = " • ".join(filters) if filters else "Semua data"

    wb = Workbook()
    ws = wb.active
    ws.title = "Rekap Pembayaran"

    ws.merge_cells("A1:G1")
    ws["A1"] = JUDUL_LAPORAN_EXCEL
    ws["A1"].font = Font(bold=True, size=13)
    ws.merge_cells("A2:G2")
    ws["A2"] = f"Filter: {filter_text}"
    ws["A2"].font = Font(size=10, bold=True, color="B45309")
    ws.merge_cells("A3:G3")
    ws["A3"] = f"Diekspor: {today_iso()} ({LABEL_ZONA_WAKTU}) • {len(payments)} transaksi"
    ws["A3"].font = Font(size=10, color="64748B")

    # Urutan kolom sesuai permintaan: Nama, ID, Periode Sewa, Harga/Jumlah, Penagih, Tanggal, Status
    headers = ["Nama", "ID", "Periode Sewa", "Harga/Jumlah (Rp)", "Penagih", "Tanggal", "Status"]
    header_fill = PatternFill("solid", fgColor="1E4E42")
    for col, title in enumerate(headers, start=1):
        cell = ws.cell(row=5, column=col, value=title)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill

    total_lunas = 0
    total_menunggu = 0
    row_num = 6
    for p in payments:
        tanggal = p.confirmed_at if p.status == "lunas" and p.confirmed_at else p.created_at
        row = [
            _aman_excel(p.nama_lengkap), _aman_excel(p.nomor_id), _aman_excel(p.periode), p.jumlah,
            _aman_excel(p.penagih) or "-", _fmt_dt(tanggal), STATUS_LABEL.get(p.status, p.status),
        ]
        for col, value in enumerate(row, start=1):
            ws.cell(row=row_num, column=col, value=value)
        if p.status == "lunas":
            total_lunas += p.jumlah
        elif p.status == "menunggu":
            total_menunggu += p.jumlah
        row_num += 1

    if not payments:
        ws.cell(row=row_num, column=1, value="Tidak ada transaksi pada filter ini").font = Font(italic=True)
        row_num += 1

    ws.cell(row=row_num + 1, column=3, value="Total Lunas").font = Font(bold=True)
    ws.cell(row=row_num + 1, column=4, value=total_lunas).font = Font(bold=True)
    ws.cell(row=row_num + 2, column=3, value="Total Menunggu Konfirmasi").font = Font(bold=True)
    ws.cell(row=row_num + 2, column=4, value=total_menunggu).font = Font(bold=True)

    for col, width in enumerate([28, 14, 24, 18, 20, 18, 12], start=1):
        ws.column_dimensions[chr(64 + col)].width = width

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    suffix = "-".join(x for x in [bulan, kategori, status] if x)
    filename = f"rekap-pembayaran{'-' + suffix if suffix else ''}-{today_iso()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
