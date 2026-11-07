// Pengeluaran (Super Admin), Informasi Harga Barang, dan ekspor Pengeluaran & Rekap Akhir (Saldo).
import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { clean, db, HttpError, logActivity, newId, todayISO, wrap } from "./db.js";
import { requireSession, requireSuper } from "./auth.js";
import { rentang } from "./pembayaran.js";

export const keuanganRouter = Router();
const col = (n) => db.collection(n);
const SUPER = [requireSession, requireSuper];
const NAMA_PASAR = "Pasar Adat Jimbaran";
const KATEGORI = { barang: "Barang", jasa: "Jasa", daya: "Daya", operasional: "Operasional Lain-lain", gaji: "Gaji" };
const TGL = /^\d{4}-\d{2}-\d{2}$/;

async function cariRentang(name, { periode = "bulanan", tanggal = todayISO(), kategori }, extra = {}) {
  if (!["harian", "bulanan", "tahunan"].includes(periode) || !TGL.test(tanggal)) throw new HttpError(422, "Filter tidak valid");
  const [dari, sampai] = rentang(periode, tanggal);
  const q = { tanggal: { $gte: dari, $lte: sampai }, ...(kategori ? { kategori } : {}), ...extra };
  return { items: (await col(name).find(q).sort({ tanggal: -1, created_at: -1 }).toArray()).map((d) => clean(d)), dari, sampai, periode };
}

// ---------- Pengeluaran ----------
keuanganRouter.get("/pengeluaran", SUPER, wrap(async (req, res) => {
  const { items } = await cariRentang("pengeluaran", req.query);
  res.json({ items, total: items.reduce((a, p) => a + p.jumlah, 0) });
}));

keuanganRouter.post("/pengeluaran", SUPER, wrap(async (req, res) => {
  const { kategori, keterangan = "", catatan = "", jumlah = null, tanggal = todayISO(), pemungut_id = null, periode_gaji = null } = req.body;
  if (!KATEGORI[kategori] || !TGL.test(tanggal) || (jumlah !== null && !(Number.isInteger(jumlah) && jumlah >= 1))) throw new HttpError(422, "Data pengeluaran tidak valid");
  let extra;
  if (kategori === "gaji") {
    const u = pemungut_id && ((await col("users").findOne({ id: pemungut_id, role: "staff" })) || (await col("pegawai").findOne({ id: pemungut_id })));
    if (!u) throw new HttpError(422, "Pilih penerima gaji (Pemungut / Pegawai)");
    const nominal = jumlah || u.gaji_bulanan || 0;
    if (nominal <= 0) throw new HttpError(422, `Gaji dasar ${u.nama} belum diisi`);
    const periode = periode_gaji || tanggal.slice(0, 7);
    if (await col("pengeluaran").findOne({ kategori: "gaji", pemungut_id, periode_gaji: periode }))
      throw new HttpError(409, `Gaji ${u.nama} bulan ${periode} sudah dicatat`);
    extra = { jumlah: nominal, penerima: u.nama, periode_gaji: periode, pemungut_id, keterangan: keterangan.trim() || `Catu ${u.nama}` };
  } else {
    if (!jumlah) throw new HttpError(422, "Nilai wajib diisi");
    if (keterangan.trim().length < 2) throw new HttpError(422, "Kegiatan / barang wajib diisi");
    extra = { jumlah, penerima: "", periode_gaji: null, pemungut_id: null, keterangan: keterangan.trim() };
  }
  const p = { id: newId(), kategori, tanggal, catatan: String(catatan).trim().slice(0, 200), dicatat_oleh: req.user.nama, created_at: new Date(), ...extra };
  await col("pengeluaran").insertOne(p);
  await logActivity(req.user.username, "buat", "pengeluaran", p.id, KATEGORI[kategori], `Rp${p.jumlah}`);
  res.status(201).json(clean(p));
}));

// ---------- Pegawai penerima gaji (tanpa login) ----------
function pegawaiBody(b) {
  const nama = String(b.nama || "").trim(), jabatan = String(b.jabatan || "").trim(), gaji_bulanan = b.gaji_bulanan ?? 0;
  if (nama.length < 2 || nama.length > 120 || jabatan.length > 80 || !Number.isInteger(gaji_bulanan) || gaji_bulanan < 0) throw new HttpError(422, "Data pegawai tidak valid");
  return { nama, jabatan, gaji_bulanan };
}
keuanganRouter.get("/pengeluaran/penerima-gaji", SUPER, wrap(async (_req, res) => {
  const pegawai = (await col("pegawai").find().sort({ nama: 1 }).toArray()).map((d) => ({ ...clean(d), sumber: "pegawai" }));
  const akun = (await col("users").find({ role: "staff" }).sort({ nama: 1 }).toArray())
    .map((u) => ({ id: u.id, nama: u.nama, jabatan: "Pemungut", gaji_bulanan: u.gaji_bulanan || 0, sumber: "akun" }));
  res.json([...pegawai, ...akun]);
}));
keuanganRouter.get("/pengeluaran/pegawai", SUPER, wrap(async (_req, res) => {
  res.json((await col("pegawai").find().sort({ nama: 1 }).toArray()).map((d) => clean(d)));
}));
keuanganRouter.post("/pengeluaran/pegawai", SUPER, wrap(async (req, res) => {
  const p = { id: newId(), ...pegawaiBody(req.body) };
  await col("pegawai").insertOne(p);
  res.status(201).json(clean(p));
}));
keuanganRouter.put("/pengeluaran/pegawai/:id", SUPER, wrap(async (req, res) => {
  const body = pegawaiBody(req.body);
  const r = await col("pegawai").updateOne({ id: req.params.id }, { $set: body });
  if (!r.matchedCount) throw new HttpError(404, "Pegawai tidak ditemukan");
  res.json({ id: req.params.id, ...body });
}));
keuanganRouter.delete("/pengeluaran/pegawai/:id", SUPER, wrap(async (req, res) => {
  const d = await col("pegawai").findOneAndDelete({ id: req.params.id });
  if (!d) throw new HttpError(404, "Pegawai tidak ditemukan");
  res.json({ deleted: true });
}));

keuanganRouter.delete("/pengeluaran/:id", SUPER, wrap(async (req, res) => {
  const d = await col("pengeluaran").findOneAndDelete({ id: req.params.id });
  if (!d) throw new HttpError(404, "Pengeluaran tidak ditemukan");
  res.json({ deleted: true });
}));

// ---------- Informasi Harga Barang ----------
function hargaBody(b) {
  const nama = String(b.nama || "").trim(), satuan = String(b.satuan || "").trim(), harga = b.harga;
  if (nama.length < 2 || nama.length > 80 || !satuan || satuan.length > 20 || !Number.isInteger(harga) || harga < 0) throw new HttpError(422, "Lengkapi nama, satuan & harga");
  return { nama, satuan, harga, updated_at: new Date() };
}
keuanganRouter.get("/publik/harga-barang", wrap(async (_req, res) => {
  res.json((await col("harga_barang").find().sort({ nama: 1 }).toArray()).map((d) => clean(d)));
}));
keuanganRouter.post("/harga-barang", SUPER, wrap(async (req, res) => {
  const h = { id: newId(), ...hargaBody(req.body) };
  await col("harga_barang").insertOne(h);
  res.status(201).json(clean(h));
}));
keuanganRouter.put("/harga-barang/:id", SUPER, wrap(async (req, res) => {
  const body = hargaBody(req.body);
  const r = await col("harga_barang").updateOne({ id: req.params.id }, { $set: body });
  if (!r.matchedCount) throw new HttpError(404, "Barang tidak ditemukan");
  res.json({ id: req.params.id, ...body });
}));
keuanganRouter.delete("/harga-barang/:id", SUPER, wrap(async (req, res) => {
  const d = await col("harga_barang").findOneAndDelete({ id: req.params.id });
  if (!d) throw new HttpError(404, "Barang tidak ditemukan");
  res.json({ deleted: true });
}));

// ---------- Ekspor Pengeluaran sesuai template: 1 sheet / bagian per kategori + Total + penanda tangan ----------
// Ganti nama/jabatan penanda tangan di sini (samakan dengan backend/lib/config.py).
const PENANDATANGAN_NAMA = "I Wayan Mushadi";
const PENANDATANGAN_JABATAN = "";
const BULAN = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
const SHEET = {
  barang: ["Barang", "BIAYA BARANG", "Barang", "Harga"], jasa: ["Jasa", "JASA", "Kegiatan", "Nilai"], daya: ["Daya", "DAYA", "Kegiatan", "Nilai"],
  operasional: ["Operasional lain-lain", "OPERASIONAL LAIN", "Kegiatan", "Nilai"], gaji: ["Gaji", "GAJI", "Kegiatan", "Nilai"],
};
function teksPeriode(periode, t) {
  const [y, m, d] = t.split("-").map(Number);
  if (periode === "harian") return `TANGGAL ${String(d).padStart(2, "0")} ${BULAN[m - 1]} ${y}`;
  return periode === "bulanan" ? `BULAN ${BULAN[m - 1]} ${y}` : `TAHUN ${y}`;
}
const tglID = (t) => t.split("-").reverse().join("/");

async function templatePengeluaran(query, ext, res) {
  const { items, periode, dari } = await cariRentang("pengeluaran", { ...query, kategori: undefined });
  const urut = [...items].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const per = Object.keys(SHEET).map((k) => [k, urut.filter((p) => p.kategori === k)]);
  const tPeriode = teksPeriode(periode, query.tanggal || todayISO());
  const file = `pengeluaran-${periode}-${dari}.${ext}`;
  if (ext === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const tipis = { style: "thin" };
    for (const [k, rows] of per) {
      const [nama, judul, lKeg, lNilai] = SHEET[k];
      const ws = wb.addWorksheet(nama);
      ws.addRows([["LAPORAN"], [`PENGELUARAN ${judul} ${tPeriode}`], [], ["No.", "Tanggal", lKeg, lNilai, "Keterangan"]]);
      [1, 2].forEach((r) => { ws.mergeCells(r, 1, r, 5); ws.getCell(r, 1).font = { bold: true, size: 12 }; ws.getCell(r, 1).alignment = { horizontal: "center" }; });
      rows.forEach((p, i) => ws.addRow([i + 1, new Date(`${p.tanggal}T00:00:00Z`), aman(p.keterangan), p.jumlah, aman(p.catatan || "")]));
      const last = ws.rowCount;
      for (let r = 4; r <= last; r++) for (let c = 1; c <= 5; c++) ws.getCell(r, c).border = { top: tipis, left: tipis, bottom: tipis, right: tipis };
      ws.getRow(4).font = { bold: true };
      ws.getColumn(2).numFmt = "DD/MM/YYYY";
      ws.getColumn(4).numFmt = "#,##0";
      ws.addRow([]);
      const tot = ws.addRow(["", "", "Total", rows.length ? { formula: `SUM(D5:D${last})`, result: rows.reduce((a, p) => a + p.jumlah, 0) } : 0]);
      tot.font = { bold: true };
      ws.getCell(tot.number + 2, 4).value = PENANDATANGAN_JABATAN;
      ws.getCell(tot.number + 6, 4).value = PENANDATANGAN_NAMA;
      ws.getCell(tot.number + 6, 4).font = { bold: true, underline: true };
      [6, 12, 32, 18, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    }
    res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}"` });
    await wb.xlsx.write(res);
    return res.end();
  }
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"` });
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  doc.pipe(res);
  const W = [30, 70, 200, 100, 120];
  const row = (cells, bold = false) => {
    const y = doc.y;
    let x = 36;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    cells.forEach((c, i) => { doc.text(String(c), x, y, { width: W[i] - 4, align: i === 3 ? "right" : "left" }); x += W[i]; });
    doc.moveDown(0.5);
  };
  per.forEach(([k, rows], idx) => {
    const [, judul, lKeg, lNilai] = SHEET[k];
    if (idx) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(12).text("LAPORAN", 36, 36, { align: "center", width: 523 }).text(`PENGELUARAN ${judul} ${tPeriode}`, { align: "center", width: 523 }).moveDown();
    row(["No.", "Tanggal", lKeg, lNilai, "Keterangan"], true);
    rows.forEach((p, i) => row([i + 1, tglID(p.tanggal), p.keterangan, rp(p.jumlah), p.catatan || ""]));
    if (!rows.length) row(["", "", "Tidak ada pengeluaran", "", ""]);
    row(["", "", "Total", rp(rows.reduce((a, p) => a + p.jumlah, 0)), ""], true);
    doc.moveDown(2).font("Helvetica").text(PENANDATANGAN_JABATAN, 360, doc.y, { width: 180, align: "center" }).moveDown(4)
      .font("Helvetica-Bold").text(PENANDATANGAN_NAMA, 360, doc.y, { width: 180, align: "center", underline: true });
  });
  doc.end();
}

// ---------- Ekspor Pengeluaran & Rekap Akhir ----------
const aman = (v) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const rp = (v) => (typeof v === "number" ? `Rp ${v.toLocaleString("id-ID")}` : v);
const LEBAR = { pengeluaran: [12, 22, 50, 24, 18, 20], rekap: [12, 14, 22, 55, 18, 18] };

async function dataLaporan(kind, query) {
  const { items: keluar, dari, sampai, periode } = await cariRentang("pengeluaran", { ...query, kategori: undefined });
  const tk = keluar.reduce((a, p) => a + p.jumlah, 0);
  if (kind === "pengeluaran") {
    return { dari, sampai, periode, judul: "Laporan Pengeluaran", headers: ["Tanggal", "Kategori", "Keterangan", "Penerima", "Jumlah (Rp)", "Dicatat oleh"],
      rows: keluar.map((p) => [p.tanggal, KATEGORI[p.kategori], p.keterangan, p.penerima || "-", p.jumlah, p.dicatat_oleh]),
      totals: [["", "", "", "Total Pengeluaran", tk]] };
  }
  const { items: masuk } = await cariRentang("payments", { ...query, kategori: undefined });
  const tp = masuk.reduce((a, p) => a + p.jumlah, 0);
  const rows = [
    ...masuk.map((p) => [p.tanggal, "Pemasukan", p.jenis === "sewa" ? "Sewa Lapak" : "Iuran", `${p.nama} (${p.user_id}) — ${p.lapak_nama}`, p.jumlah, ""]),
    ...keluar.map((p) => [p.tanggal, "Pengeluaran", KATEGORI[p.kategori], p.keterangan, "", p.jumlah]),
  ].sort((a, b) => a[0].localeCompare(b[0]));
  return { dari, sampai, periode, judul: "Rekapitulasi Akhir (Buku Besar)", headers: ["Tanggal", "Jenis", "Kategori", "Keterangan", "Pemasukan (Rp)", "Pengeluaran (Rp)"], rows,
    totals: [["", "", "", "Total", tp, tk], ["", "", "", "Total Pemasukan", tp, ""], ["", "", "", "Total Pengeluaran", "", tk], ["", "", "", "SALDO AKHIR (Pemasukan − Pengeluaran)", tp - tk, ""]] };
}

keuanganRouter.get("/laporan/:kind(pengeluaran|rekap).:ext(xlsx|pdf)", SUPER, wrap(async (req, res) => {
  const { kind, ext } = req.params;
  if (kind === "pengeluaran") return templatePengeluaran(req.query, ext, res);
  const d = await dataLaporan(kind, req.query);
  const judul = `${d.judul} ${d.periode} (${d.dari} s/d ${d.sampai})`;
  const file = `${kind}-${d.periode}-${d.dari}.${ext}`;
  if (ext === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(kind);
    ws.addRows([[NAMA_PASAR], [judul], [`Dicetak ${new Date().toISOString().slice(0, 16)}`], [], d.headers]);
    ws.getRow(5).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E4E42" } }; });
    d.rows.forEach((r) => ws.addRow(r.map(aman)));
    ws.addRow([]);
    d.totals.forEach((t) => { ws.addRow(t).font = { bold: true }; });
    LEBAR[kind].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}"` });
    await wb.xlsx.write(res);
    return res.end();
  }
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"` });
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  doc.pipe(res);
  doc.fontSize(16).text(NAMA_PASAR).fontSize(11).text(judul).moveDown();
  const scale = 786 / LEBAR[kind].reduce((a, b) => a + b, 0);
  const row = (cells, bold = false) => {
    const y = doc.y;
    let x = 28;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    cells.forEach((c, i) => { doc.text(String(rp(c)), x, y, { width: LEBAR[kind][i] * scale - 4 }); x += LEBAR[kind][i] * scale; });
    doc.moveDown(0.6);
    if (doc.y > 540) doc.addPage();
  };
  row(d.headers, true);
  d.rows.forEach((r) => row(r));
  doc.moveDown();
  d.totals.forEach((t) => row(t, true));
  doc.end();
}));
