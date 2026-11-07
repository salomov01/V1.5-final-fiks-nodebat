"""Ekspor laporan keuangan (Excel & PDF) — Pemasukan, Pengeluaran, Rekap Akhir (Saldo). Khusus Super Admin."""

import io
from datetime import datetime

from fastapi import APIRouter, Depends, Path, Query
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
from routers.pengeluaran import LABEL_KATEGORI, cari_pengeluaran

router = APIRouter(prefix="/laporan", tags=["laporan"], dependencies=[Depends(require_super)])

LABEL_PERIODE = {"harian": "Harian", "bulanan": "Bulanan", "tahunan": "Tahunan"}
H_MASUK = ["Nama", "ID", "Periode Sewa", "Harga/Jumlah (Rp)", "Penagih", "Tanggal", "Status", "Jenis"]
H_KELUAR = ["Tanggal", "Kategori", "Keterangan", "Penerima", "Jumlah (Rp)", "Dicatat oleh"]
H_REKAP = ["Tanggal", "Jenis", "Kategori", "Keterangan", "Pemasukan (Rp)", "Pengeluaran (Rp)"]
LEBAR = {"pembayaran": [28, 10, 40, 18, 20, 12, 10, 12], "pengeluaran": [12, 22, 50, 24, 18, 20], "rekap": [12, 14, 22, 55, 18, 18]}
JUDUL = {"pembayaran": "Laporan Pemasukan", "pengeluaran": "Laporan Pengeluaran", "rekap": "Rekapitulasi Akhir (Buku Besar)"}


def _aman(v):
    """Cegah formula injection di Excel."""
    return "'" + v if isinstance(v, str) and v and v[0] in "=+-@\t\r" else v


def _rp(n) -> str:
    return "Rp " + f"{n:,}".replace(",", ".") if isinstance(n, int) else n


def _masuk_rows(items):
    return [[p.nama, p.user_id, p.lapak_nama + " — " + p.periode, p.jumlah, p.penagih, p.tanggal, "Lunas",
             "Sewa Lapak" if p.jenis == "sewa" else "Iuran"] for p in items]


async def _data(kind: str, periode: str, tanggal: str, jenis: str | None):
    """-> (headers, rows, total_rows). Kolom angka berupa int, diformat Rp di PDF."""
    if kind == "pembayaran":
        items = await cari_pembayaran(periode, tanggal, jenis)
        ts = sum(p.jumlah for p in items if p.jenis == "sewa")
        ti = sum(p.jumlah for p in items if p.jenis == "iuran")
        return H_MASUK, _masuk_rows(items), [["", "", "Total Sewa Lapak", ts], ["", "", "Total Iuran", ti], ["", "", "Total Pemasukan", ts + ti]]
    keluar = await cari_pengeluaran(periode, tanggal)
    tk = sum(p.jumlah for p in keluar)
    if kind == "pengeluaran":
        rows = [[p.tanggal, LABEL_KATEGORI[p.kategori], p.keterangan, p.penerima or "-", p.jumlah, p.dicatat_oleh] for p in keluar]
        return H_KELUAR, rows, [["", "", "", "Total Pengeluaran", tk]]
    masuk = await cari_pembayaran(periode, tanggal, None)
    tp = sum(p.jumlah for p in masuk)
    rows = [[p.tanggal, "Pemasukan", "Sewa Lapak" if p.jenis == "sewa" else "Iuran",
             f"{p.nama} ({p.user_id}) — {p.lapak_nama}", p.jumlah, ""] for p in masuk]
    rows += [[p.tanggal, "Pengeluaran", LABEL_KATEGORI[p.kategori], p.keterangan, "", p.jumlah] for p in keluar]
    rows.sort(key=lambda r: r[0])
    return H_REKAP, rows, [["", "", "", "Total", tp, tk], ["", "", "", "Total Pemasukan", tp, ""],
                           ["", "", "", "Total Pengeluaran", "", tk], ["", "", "", "SALDO AKHIR (Pemasukan − Pengeluaran)", tp - tk, ""]]


def _xlsx(kind, judul, headers, rows, totals) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = kind.capitalize()
    for line in ([NAMA_PASAR], [judul], [f"Dicetak {datetime.now().strftime('%Y-%m-%d %H:%M')}"], [], headers):
        ws.append(line)
    ws["A1"].font = Font(bold=True, size=14)
    for c in ws[5]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="1E4E42")
    for r in rows:
        ws.append([_aman(v) for v in r])
    ws.append([])
    for t in totals:
        ws.append(t)
        for c in ws[ws.max_row]:
            c.font = Font(bold=True)
    for i, w in enumerate(LEBAR[kind]):
        ws.column_dimensions[chr(65 + i)].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return buf


def _pdf(kind, judul, headers, rows, totals) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
    st = getSampleStyleSheet()
    n = len(headers)
    body = [[_rp(v) for v in r] for r in rows] or [["Tidak ada data"] + [""] * (n - 1)]
    foot = [[_rp(v) for v in t] + [""] * (n - len(t)) for t in totals]
    scale = 786 / sum(LEBAR[kind])
    table = Table([headers] + body + foot, repeatRows=1, colWidths=[w * scale for w in LEBAR[kind]])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E4E42")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, len(body)), 0.4, colors.HexColor("#CBD5E1")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, -len(foot)), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -len(foot)), (-1, -len(foot)), 1, colors.HexColor("#1E4E42")),
    ] + ([("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EEF5F2"))] if kind == "rekap" else [])))
    doc.build([Paragraph(NAMA_PASAR, st["Title"]), Paragraph(judul, st["Heading3"]), Spacer(1, 8), table])
    return buf


MIME = {"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "pdf": "application/pdf"}


@router.get("/{kind}.{ext}")
async def export(
    kind: str = Path(pattern="^(pembayaran|pengeluaran|rekap)$"),
    ext: str = Path(pattern="^(xlsx|pdf)$"),
    periode: str = Query("bulanan", pattern="^(harian|bulanan|tahunan)$"),
    tanggal: str = Query(default_factory=today_iso, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    jenis: str | None = Query(None, pattern="^(iuran|sewa)$"),
):
    headers, rows, totals = await _data(kind, periode, tanggal, jenis)
    dari, sampai = rentang(periode, tanggal)
    judul = f"{JUDUL[kind]} {LABEL_PERIODE[periode]} ({dari} s/d {sampai})"
    buf = (_xlsx if ext == "xlsx" else _pdf)(kind, judul, headers, rows, totals)
    buf.seek(0)
    nama = f"{'pemasukan' if kind == 'pembayaran' else kind}-{periode}-{dari}.{ext}"
    return StreamingResponse(buf, media_type=MIME[ext], headers={"Content-Disposition": f'attachment; filename="{nama}"'})
