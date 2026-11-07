"""Ekspor Laporan Pengeluaran sesuai template pengelola: 1 sheet / bagian per kategori, Total, penanda tangan."""

import io
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from lib.config import PENANDATANGAN_JABATAN, PENANDATANGAN_NAMA
from routers.pengeluaran import Pengeluaran

BULAN = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"]
# kategori -> (nama sheet, judul, label kolom kegiatan, label kolom nilai)
SHEET = {
    "barang": ("Barang", "BIAYA BARANG", "Barang", "Harga"),
    "jasa": ("Jasa", "JASA", "Kegiatan", "Nilai"),
    "daya": ("Daya", "DAYA", "Kegiatan", "Nilai"),
    "operasional": ("Operasional lain-lain", "OPERASIONAL LAIN", "Kegiatan", "Nilai"),
    "gaji": ("Gaji", "GAJI", "Kegiatan", "Nilai"),
}
TIPIS = Side(style="thin", color="000000")
KOTAK = Border(left=TIPIS, right=TIPIS, top=TIPIS, bottom=TIPIS)


def teks_periode(periode: str, tanggal: str) -> str:
    d = date.fromisoformat(tanggal)
    if periode == "harian":
        return f"TANGGAL {d.day:02d} {BULAN[d.month - 1]} {d.year}"
    if periode == "bulanan":
        return f"BULAN {BULAN[d.month - 1]} {d.year}"
    return f"TAHUN {d.year}"


def _per_kategori(items: list[Pengeluaran]) -> dict[str, list[Pengeluaran]]:
    urut = sorted(items, key=lambda p: (p.tanggal, p.created_at))
    return {k: [p for p in urut if p.kategori == k] for k in SHEET}


def _aman(v: str) -> str:
    return "'" + v if v and v[0] in "=+-@\t\r" else v


def xlsx_pengeluaran(items: list[Pengeluaran], periode: str, tanggal: str) -> io.BytesIO:
    wb = Workbook()
    wb.remove(wb.active)
    for kat, rows in _per_kategori(items).items():
        nama, judul, l_keg, l_nilai = SHEET[kat]
        ws = wb.create_sheet(nama)
        ws.append(["LAPORAN"])
        ws.append([f"PENGELUARAN {judul} {teks_periode(periode, tanggal)}"])
        ws.append([])
        ws.append(["No.", "Tanggal", l_keg, l_nilai, "Keterangan"])
        for r in (1, 2):
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
            ws.cell(r, 1).font = Font(bold=True, size=12)
            ws.cell(r, 1).alignment = Alignment(horizontal="center")
        for i, p in enumerate(rows, 1):
            ws.append([i, date.fromisoformat(p.tanggal), _aman(p.keterangan), p.jumlah, _aman(p.catatan)])
            ws.cell(ws.max_row, 2).number_format = "DD/MM/YYYY"
            ws.cell(ws.max_row, 4).number_format = "#,##0"
        last = ws.max_row
        for row in ws.iter_rows(min_row=4, max_row=last, max_col=5):
            for c in row:
                c.border = KOTAK
        for c in ws[4]:
            c.font, c.alignment = Font(bold=True), Alignment(horizontal="center")
        ws.append([])
        ws.append(["", "", "Total", f"=SUM(D5:D{last})" if rows else 0])
        tot = ws.max_row
        ws.cell(tot, 3).font = ws.cell(tot, 4).font = Font(bold=True)
        ws.cell(tot, 4).number_format = "#,##0"
        ws.cell(tot + 2, 4, PENANDATANGAN_JABATAN)
        ws.cell(tot + 6, 4, PENANDATANGAN_NAMA).font = Font(bold=True, underline="single")
        for col, w in zip("ABCDE", [6, 12, 32, 18, 20]):
            ws.column_dimensions[col].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return buf


def _rp(n: int) -> str:
    return "Rp " + f"{n:,}".replace(",", ".")


def pdf_pengeluaran(items: list[Pengeluaran], periode: str, tanggal: str) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    st = getSampleStyleSheet()
    tengah = ParagraphStyle("tengah", parent=st["Heading3"], alignment=1, spaceAfter=2)
    ttd = ParagraphStyle("ttd", parent=st["Normal"], alignment=1)
    story = []
    for kat, rows in _per_kategori(items).items():
        _, judul, l_keg, l_nilai = SHEET[kat]
        if story:
            story.append(PageBreak())
        story += [Paragraph("LAPORAN", tengah), Paragraph(f"PENGELUARAN {judul} {teks_periode(periode, tanggal)}", tengah), Spacer(1, 10)]
        body = [[str(i), date.fromisoformat(p.tanggal).strftime("%d/%m/%Y"), Paragraph(p.keterangan, st["Normal"]), _rp(p.jumlah), p.catatan]
                for i, p in enumerate(rows, 1)] or [["", "", "Tidak ada pengeluaran", "", ""]]
        total = sum(p.jumlah for p in rows)
        t = Table([["No.", "Tanggal", l_keg, l_nilai, "Keterangan"]] + body + [["", "", "Total", _rp(total), ""]],
                  colWidths=[30, 70, 200, 100, 120], repeatRows=1)
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -2), 0.5, colors.black), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("ALIGN", (3, 1), (3, -1), "RIGHT"), ("FONTSIZE", (0, 0), (-1, -1), 9), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        sign = Table([[Paragraph(PENANDATANGAN_JABATAN, ttd)], [Spacer(1, 50)], [Paragraph(f"<b><u>{PENANDATANGAN_NAMA}</u></b>", ttd)]],
                     colWidths=[180], hAlign="RIGHT")
        story += [t, Spacer(1, 24), sign]
    doc.build(story)
    return buf
