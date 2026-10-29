"""Ekspor laporan keuangan (Excel & PDF) dengan filter Harian / Bulanan / Tahunan — khusus Super Admin."""

import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from lib.config import NAMA_PASAR
from lib.dates import today_iso
from routers.auth import require_super
from routers.payments import cari_pembayaran, rentang

router = APIRouter(prefix="/laporan", tags=["laporan"], dependencies=[Depends(require_super)])

# Urutan kolom baku: Nama, ID, Periode Sewa, Harga/Jumlah, Penagih, Tanggal, Status (+ Jenis)
HEADERS = ["Nama", "ID", "Periode Sewa", "Harga/Jumlah (Rp)", "Penagih", "Tanggal", "Status", "Jenis"]
LABEL_PERIODE = {"harian": "Harian", "bulanan": "Bulanan", "tahunan": "Tahunan"}


def _aman(v: str) -> str:
    """Cegah formula injection di Excel."""
    return "'" + v if v and v[0] in "=+-@\t\r" else v


async def _data(periode: str, tanggal: str, jenis: str | None):
    items = await cari_pembayaran(periode, tanggal, jenis)
    rows = [[p.nama, p.user_id, p.lapak_nama + " — " + p.periode, p.jumlah, p.penagih, p.tanggal, "Lunas",
             "Sewa Lapak" if p.jenis == "sewa" else "Iuran"] for p in items]
    ts = sum(p.jumlah for p in items if p.jenis == "sewa")
    ti = sum(p.jumlah for p in items if p.jenis == "iuran")
    dari, sampai = rentang(periode, tanggal)
    judul = f"Laporan Pembayaran {LABEL_PERIODE[periode]} ({dari} s/d {sampai})"
    return rows, ts, ti, judul, f"laporan-{periode}-{dari}"


Q_PERIODE = Query("bulanan", pattern="^(harian|bulanan|tahunan)$")
Q_TANGGAL = Query(default_factory=today_iso, pattern=r"^\d{4}-\d{2}-\d{2}$")
Q_JENIS = Query(None, pattern="^(iuran|sewa)$")


@router.get("/pembayaran.xlsx")
async def export_xlsx(periode: str = Q_PERIODE, tanggal: str = Q_TANGGAL, jenis: str | None = Q_JENIS):
    rows, ts, ti, judul, nama = await _data(periode, tanggal, jenis)
    wb = Workbook()
    ws = wb.active
    ws.title = "Pembayaran"
    ws.append([NAMA_PASAR])
    ws.append([judul])
    ws.append([f"Dicetak {datetime.now().strftime('%Y-%m-%d %H:%M')}"])
    ws.append([])
    ws.append(HEADERS)
    ws["A1"].font = Font(bold=True, size=14)
    for c in ws[5]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="1E4E42")
    for r in rows:
        ws.append([_aman(str(v)) if isinstance(v, str) else v for v in r])
    ws.append([])
    for label, val in (("Total Sewa Lapak", ts), ("Total Iuran", ti), ("Total Pemasukan", ts + ti)):
        ws.append(["", "", label, val])
        ws.cell(ws.max_row, 3).font = ws.cell(ws.max_row, 4).font = Font(bold=True)
    for col, w in zip("ABCDEFGH", [28, 10, 40, 18, 20, 12, 10, 12]):
        ws.column_dimensions[col].width = w
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{nama}.xlsx"'})


def _rp(n: int) -> str:
    return "Rp " + f"{n:,}".replace(",", ".")


@router.get("/pembayaran.pdf")
async def export_pdf(periode: str = Q_PERIODE, tanggal: str = Q_TANGGAL, jenis: str | None = Q_JENIS):
    rows, ts, ti, judul, nama = await _data(periode, tanggal, jenis)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
    st = getSampleStyleSheet()
    body = [[r[0], r[1], r[2], _rp(r[3]), r[4], r[5], r[6], r[7]] for r in rows] or [["Tidak ada data"] + [""] * 7]
    table = Table([HEADERS] + body + [["", "", "Total Sewa Lapak", _rp(ts)], ["", "", "Total Iuran", _rp(ti)],
                                      ["", "", "Total Pemasukan", _rp(ts + ti)]], repeatRows=1,
                  colWidths=[130, 50, 210, 85, 95, 65, 45, 60])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E4E42")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, len(body)), 0.4, colors.HexColor("#CBD5E1")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (2, -3), (3, -1), "Helvetica-Bold"),
        ("ALIGN", (3, 1), (3, -1), "RIGHT"),
    ]))
    doc.build([Paragraph(NAMA_PASAR, st["Title"]), Paragraph(judul, st["Heading3"]), Spacer(1, 8), table])
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{nama}.pdf"'})
