// Pembayaran (Sewa Lapak & Iuran harian), Pindai QR, Dashboard, Ekspor Excel & PDF.
import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { clean, db, HttpError, logActivity, newId, todayISO, wrap } from "./db.js";
import { requireSession, requireSuper } from "./auth.js";
import { sewaOut } from "./pasar.js";

export const bayarRouter = Router();
const col = (n) => db.collection(n);
const S = [requireSession];
const SUPER = [requireSession, requireSuper];
const NAMA_PASAR = "Pasar Adat Jimbaran";

// Filter Harian / Bulanan / Tahunan -> [dari, sampai]
export function rentang(periode, t) {
  const [y, m] = t.split("-").map(Number);
  if (periode === "harian") return [t, t];
  if (periode === "bulanan") return [`${t.slice(0, 7)}-01`, `${t.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`];
  return [`${y}-01-01`, `${y}-12-31`];
}
async function cari({ periode = "bulanan", tanggal = todayISO(), jenis }) {
  if (!["harian", "bulanan", "tahunan"].includes(periode)) throw new HttpError(422, "periode tidak valid");
  const [dari, sampai] = rentang(periode, tanggal);
  const q = { tanggal: { $gte: dari, $lte: sampai }, ...(jenis ? { jenis } : {}) };
  return { items: (await col("payments").find(q).sort({ tanggal: -1, created_at: -1 }).toArray()).map((d) => clean(d)), dari, sampai, periode };
}
const sum = (items, j) => items.filter((p) => p.jenis === j).reduce((a, p) => a + p.jumlah, 0);

bayarRouter.get("/payments", S, wrap(async (req, res) => {
  const { items } = await cari(req.query);
  if (req.user.role !== "super_admin") return res.json({ items, total_sewa: null, total_iuran: null, total: null });
  const ts = sum(items, "sewa"), ti = sum(items, "iuran");
  res.json({ items, total_sewa: ts, total_iuran: ti, total: ts + ti });
}));

// Isi QR = User ID. Hasil: sewa berjalan + status iuran hari ini + sisa sewa.
bayarRouter.get("/scan/:userId", S, wrap(async (req, res) => {
  const p = await col("pedagang").findOne({ user_id: req.params.userId.trim() });
  if (!p) throw new HttpError(404, "Pedagang tidak ditemukan");
  const t = todayISO();
  const sewa = [];
  for (const d of await col("sewa").find({ pedagang_id: p.id, status: "aktif", mulai: { $lte: t }, selesai: { $gte: t } }).sort({ mulai: 1 }).toArray()) {
    sewa.push({ ...(await sewaOut(d)), iuran_hari_ini_lunas: !!(await col("payments").findOne({ sewa_id: d.id, jenis: "iuran", tanggal: t })) });
  }
  res.json({ pedagang: clean(p), sewa, tanggal: t });
}));

async function sewaAktif(id) {
  const d = await col("sewa").findOne({ id, status: "aktif" });
  if (!d) throw new HttpError(404, "Sewa aktif tidak ditemukan");
  return sewaOut(d);
}
async function simpan(jenis, s, jumlah, periode, user) {
  const p = { id: newId(), jenis, sewa_id: s.id, pedagang_id: s.pedagang_id || "", user_id: s.user_id || "", nama: s.nama, lapak_nama: s.lapak_nama,
    periode, jumlah, tanggal: todayISO(), penagih: user.nama, status: "lunas", created_at: new Date() }; // penagih = akun login
  await col("payments").insertOne(p);
  await logActivity(user.username, "buat", "pembayaran", p.id, `${jenis} ${s.nama}`, `Rp${jumlah}`);
  return clean(p);
}
bayarRouter.post("/payments/iuran", S, wrap(async (req, res) => {
  const s = await sewaAktif(req.body.sewa_id);
  const t = todayISO();
  if (!(s.mulai <= t && t <= s.selesai)) throw new HttpError(422, "Masa sewa belum dimulai atau sudah berakhir");
  try {
    await col("iuran_lock").insertOne({ _id: `${s.id}:${t}`, at: t }); // unik per sewa per hari
  } catch {
    throw new HttpError(409, `Iuran ${s.nama} hari ini sudah dibayar`);
  }
  res.status(201).json(await simpan("iuran", s, s.iuran, t, req.user));
}));
bayarRouter.post("/payments/sewa", S, wrap(async (req, res) => {
  const s = await sewaAktif(req.body.sewa_id);
  if (s.sisa <= 0) throw new HttpError(409, "Sewa lapak sudah lunas");
  res.status(201).json(await simpan("sewa", s, Math.min(req.body.jumlah || s.sisa, s.sisa), `${s.mulai} s/d ${s.selesai}`, req.user));
}));
bayarRouter.delete("/payments/:id", SUPER, wrap(async (req, res) => {
  const d = await col("payments").findOneAndDelete({ id: req.params.id });
  if (!d) throw new HttpError(404, "Pembayaran tidak ditemukan");
  if (d.jenis === "iuran") await col("iuran_lock").deleteOne({ _id: `${d.sewa_id}:${d.tanggal}` });
  res.json({ deleted: true });
}));

bayarRouter.get("/dashboard/stats", S, wrap(async (req, res) => {
  const t = todayISO();
  const aktif = { status: "aktif", selesai: { $gte: t } };
  const base = {
    jumlah_pedagang: await col("pedagang").countDocuments({ aktif: true }), jumlah_lapak: await col("lapak").countDocuments(),
    lapak_terisi: (await col("sewa").distinct("lapak_id", aktif)).length, sewa_menunggu: await col("sewa").countDocuments({ status: "menunggu" }),
    iuran_hari_ini: await col("payments").countDocuments({ jenis: "iuran", tanggal: t }), sewa_aktif: await col("sewa").countDocuments(aktif),
  };
  if (req.user.role !== "super_admin") return res.json({ ...base, pemasukan_hari_ini: null, pemasukan_bulan_ini: null, grafik_6_bulan: null });
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [y0, m0] = t.split("-").map(Number);
  const grafik = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y0, m0 - 1 - i, 1);
    const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const items = await col("payments").find({ tanggal: { $regex: `^${pre}` } }).toArray();
    grafik.push({ label: `${BULAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, sewa: sum(items, "sewa"), iuran: sum(items, "iuran") });
  }
  const hari = await col("payments").find({ tanggal: t }).toArray();
  res.json({ ...base, pemasukan_hari_ini: hari.reduce((a, p) => a + p.jumlah, 0), pemasukan_bulan_ini: grafik[5].sewa + grafik[5].iuran, grafik_6_bulan: grafik });
}));

// ---------- Ekspor (Super Admin) — urutan kolom baku ----------
const HEADERS = ["Nama", "ID", "Periode Sewa", "Harga/Jumlah (Rp)", "Penagih", "Tanggal", "Status", "Jenis"];
const baris = (p) => [p.nama, p.user_id, `${p.lapak_nama} — ${p.periode}`, p.jumlah, p.penagih, p.tanggal, "Lunas", p.jenis === "sewa" ? "Sewa Lapak" : "Iuran"];
const aman = (v) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v); // cegah formula injection
const rp = (n) => `Rp ${n.toLocaleString("id-ID")}`;

bayarRouter.get("/laporan/pembayaran.xlsx", SUPER, wrap(async (req, res) => {
  const { items, dari, sampai, periode } = await cari(req.query);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pembayaran");
  ws.addRows([[NAMA_PASAR], [`Laporan Pembayaran ${periode} (${dari} s/d ${sampai})`], [`Dicetak ${new Date().toISOString().slice(0, 16)}`], [], HEADERS]);
  ws.getRow(5).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E4E42" } }; });
  items.forEach((p) => ws.addRow(baris(p).map(aman)));
  const ts = sum(items, "sewa"), ti = sum(items, "iuran");
  ws.addRows([[], ["", "", "Total Sewa Lapak", ts], ["", "", "Total Iuran", ti], ["", "", "Total Pemasukan", ts + ti]]);
  [28, 10, 40, 18, 20, 12, 10, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="laporan-${periode}-${dari}.xlsx"` });
  await wb.xlsx.write(res);
  res.end();
}));

bayarRouter.get("/laporan/pembayaran.pdf", SUPER, wrap(async (req, res) => {
  const { items, dari, sampai, periode } = await cari(req.query);
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="laporan-${periode}-${dari}.pdf"` });
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  doc.pipe(res);
  doc.fontSize(16).text(NAMA_PASAR).fontSize(11).text(`Laporan Pembayaran ${periode} (${dari} s/d ${sampai})`).moveDown();
  const W = [130, 50, 210, 85, 95, 65, 45, 60];
  const row = (cells, bold = false) => {
    const y = doc.y;
    let x = 28;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    cells.forEach((c, i) => { doc.text(String(c), x, y, { width: W[i] - 4 }); x += W[i]; });
    doc.moveDown(0.6);
    if (doc.y > 540) doc.addPage();
  };
  row(HEADERS, true);
  items.forEach((p) => { const b = baris(p); b[3] = rp(b[3]); row(b); });
  const ts = sum(items, "sewa"), ti = sum(items, "iuran");
  doc.moveDown();
  row(["", "", "Total Sewa Lapak", rp(ts)], true);
  row(["", "", "Total Iuran", rp(ti)], true);
  row(["", "", "Total Pemasukan", rp(ts + ti)], true);
  doc.end();
}));
