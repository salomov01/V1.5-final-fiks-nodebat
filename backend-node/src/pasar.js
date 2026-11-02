// Pedagang, Lapak & Iuran (satu paket), Sewa/Pendaftaran Lapak, foto lapak, Info Pasar & berita.
import { Router } from "express";
import multer from "multer";
import { clean, clientIp, db, HttpError, logActivity, newId, todayISO, wrap } from "./db.js";
import { requireSession, requireSuper } from "./auth.js";
import { getObject, putObject } from "./storage.js";

export const pasarRouter = Router();
const col = (n) => db.collection(n);
const S = [requireSession];
const SUPER = [requireSession, requireSuper];
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- Pedagang ----------
async function buatUserId(nik) {
  // [NO_URUT]-[3 digit akhir KTP], contoh 01-123
  const c = await col("counters").findOneAndUpdate({ _id: "pedagang_seq" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return `${String(c.seq).padStart(2, "0")}-${nik.slice(-3).padStart(3, "0")}`;
}
export async function buatPedagang({ nama, nik, no_hp = "", alamat = "" }, actor) {
  if (!nama || nama.trim().length < 2 || !/^\d{3,20}$/.test(nik || "")) throw new HttpError(422, "Isi nama & NIK (angka)");
  if (await col("pedagang").findOne({ nik })) throw new HttpError(409, "NIK sudah terdaftar");
  const p = { id: newId(), user_id: await buatUserId(nik), nama: nama.trim(), nik, no_hp, alamat, aktif: true, created_at: new Date() };
  await col("pedagang").insertOne(p);
  await logActivity(actor, "buat", "pedagang", p.id, `${p.nama} (${p.user_id})`);
  return clean(p);
}
async function getPedagang(q) {
  const p = await col("pedagang").findOne(q);
  if (!p) throw new HttpError(404, "Pedagang tidak ditemukan");
  return clean(p);
}
pasarRouter.get("/pedagang", S, wrap(async (req, res) => {
  const rx = escapeRx(String(req.query.q || ""));
  const q = rx ? { $or: [{ nama: { $regex: rx, $options: "i" } }, { user_id: { $regex: rx } }] } : {};
  res.json((await col("pedagang").find(q).sort({ created_at: 1 }).toArray()).map((d) => clean(d)));
}));
pasarRouter.post("/pedagang", S, wrap(async (req, res) => res.status(201).json(await buatPedagang(req.body, req.user.username))));
pasarRouter.patch("/pedagang/:id", SUPER, wrap(async (req, res) => {
  await getPedagang({ id: req.params.id });
  const set = Object.fromEntries(["nama", "no_hp", "alamat", "aktif"].filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
  await col("pedagang").updateOne({ id: req.params.id }, { $set: set });
  res.json(await getPedagang({ id: req.params.id }));
}));
pasarRouter.delete("/pedagang/:id", SUPER, wrap(async (req, res) => {
  await getPedagang({ id: req.params.id });
  if (await col("sewa").findOne({ pedagang_id: req.params.id, status: "aktif" })) throw new HttpError(409, "Pedagang masih menyewa lapak");
  await col("pedagang").deleteOne({ id: req.params.id });
  res.json({ deleted: true });
}));
pasarRouter.get("/publik/pedagang", wrap(async (req, res) => {
  const q = String(req.query.q || "");
  if (q.length < 2) throw new HttpError(422, "Minimal 2 huruf");
  const docs = await col("pedagang").find({ aktif: true, nama: { $regex: escapeRx(q), $options: "i" } }).limit(10).toArray();
  res.json(docs.map(({ id, user_id, nama }) => ({ id, user_id, nama })));
}));

// ---------- Lapak & Iuran ----------
const fotoUrl = (l) => (l.foto_path ? `/api/publik/foto/${l.id}?v=${l.foto_versi || 0}` : null);
const lapakOut = (l) => ({ ...clean(l, ["foto_path", "foto_versi"]), foto_url: fotoUrl(l) });
async function getLapak(id) {
  const l = await col("lapak").findOne({ id });
  if (!l) throw new HttpError(404, "Lapak tidak ditemukan");
  return l;
}
// lapak_id -> sewa aktif yang sedang berjalan hari ini
async function terisi() {
  const t = todayISO();
  const map = {};
  for (const s of await col("sewa").find({ status: "aktif", mulai: { $lte: t }, selesai: { $gte: t } }).toArray()) map[s.lapak_id] = s;
  return map;
}
async function cekKosong(lapakId, mulai, selesai) {
  const b = await col("sewa").findOne({ lapak_id: lapakId, status: "aktif", mulai: { $lte: selesai }, selesai: { $gte: mulai } });
  if (b) throw new HttpError(409, `Lapak sudah disewa ${b.nama} s/d ${b.selesai}`);
}
// Total sewa per hari: harga per bulan ÷ 30 × jumlah hari (inklusif)
export function hitungSewa(harga, mulai, selesai) {
  const hari = Math.round((Date.parse(selesai) - Date.parse(mulai)) / 86400000) + 1;
  if (!(hari >= 1)) throw new HttpError(422, "Tanggal akhir harus sama atau setelah tanggal awal");
  return { hari, total_harga: Math.round((harga * hari) / 30) };
}
pasarRouter.get("/publik/lapak-kosong", wrap(async (_req, res) => {
  const t = await terisi();
  res.json((await col("lapak").find().sort({ created_at: 1 }).toArray()).filter((l) => !t[l.id]).map(lapakOut));
}));
pasarRouter.get("/lapak", S, wrap(async (_req, res) => {
  const t = await terisi();
  res.json((await col("lapak").find().sort({ created_at: 1 }).toArray()).map((l) => ({
    ...lapakOut(l), status: t[l.id] ? "terisi" : "kosong", penyewa: t[l.id]?.nama ?? null, terisi_sampai: t[l.id]?.selesai ?? null,
  })));
}));
pasarRouter.post("/lapak", S, wrap(async (req, res) => {
  const { nama = "", jenis = "", harga_sewa, iuran, deskripsi = "" } = req.body;
  if (nama.trim().length < 2 || !(harga_sewa > 0) || !(iuran >= 0)) throw new HttpError(422, "Isi nama, harga sewa & iuran");
  if (await col("lapak").findOne({ nama: nama.trim() })) throw new HttpError(409, "Nama lapak sudah ada");
  const l = { id: newId(), nama: nama.trim(), jenis, harga_sewa, iuran, deskripsi, foto_path: null, foto_versi: 0, created_at: new Date() };
  await col("lapak").insertOne(l);
  res.status(201).json(lapakOut(l));
}));
pasarRouter.patch("/lapak/:id", SUPER, wrap(async (req, res) => {
  await getLapak(req.params.id);
  const set = Object.fromEntries(["nama", "jenis", "harga_sewa", "iuran", "deskripsi"].filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
  await col("lapak").updateOne({ id: req.params.id }, { $set: set });
  res.json(lapakOut(await getLapak(req.params.id)));
}));
pasarRouter.delete("/lapak/:id", SUPER, wrap(async (req, res) => {
  await getLapak(req.params.id);
  if ((await terisi())[req.params.id]) throw new HttpError(409, "Lapak masih disewa — tidak bisa dihapus");
  await col("lapak").deleteOne({ id: req.params.id });
  res.json({ deleted: true });
}));
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
pasarRouter.post("/lapak/:id/foto", SUPER, upload.single("file"), wrap(async (req, res) => {
  await getLapak(req.params.id);
  const ext = TYPES[req.file?.mimetype];
  if (!ext) throw new HttpError(415, "Foto harus JPG, PNG, atau WEBP");
  const r = await putObject(`bindes2026/lapak/${req.params.id}/${newId()}.${ext}`, req.file.buffer, req.file.mimetype);
  await col("lapak").updateOne({ id: req.params.id }, { $set: { foto_path: r.path }, $inc: { foto_versi: 1 } });
  res.json(lapakOut(await getLapak(req.params.id)));
}));
pasarRouter.delete("/lapak/:id/foto", SUPER, wrap(async (req, res) => {
  await col("lapak").updateOne({ id: req.params.id }, { $set: { foto_path: null } });
  res.json(lapakOut(await getLapak(req.params.id)));
}));
pasarRouter.get("/publik/foto/:id", wrap(async (req, res) => {
  const l = await getLapak(req.params.id);
  if (!l.foto_path) throw new HttpError(404, "Lapak belum punya foto");
  const { data, type } = await getObject(l.foto_path);
  res.set({ "Content-Type": type, "Cache-Control": "public, max-age=86400" }).send(data);
}));

// ---------- Sewa / Pendaftaran Lapak ----------
export async function sewaOut(s) {
  const agg = await col("payments").aggregate([{ $match: { sewa_id: s.id, jenis: "sewa" } }, { $group: { _id: null, t: { $sum: "$jumlah" } } }]).toArray();
  const terbayar = agg[0]?.t || 0;
  return { ...clean(s, ["nik", "ip"]), terbayar, sisa: Math.max(0, s.total_harga - terbayar) };
}
function sewaBaru(l, mulai, selesai, extra) {
  return { id: newId(), lapak_id: l.id, lapak_nama: l.nama, mulai, selesai, harga_sewa: l.harga_sewa, iuran: l.iuran,
    ...hitungSewa(l.harga_sewa, mulai, selesai), status: "menunggu", sumber: "publik", catatan: "", pedagang_id: null, user_id: null,
    no_hp: "", created_at: new Date(), ...extra };
}
pasarRouter.post("/publik/sewa", wrap(async (req, res) => {
  const ip = clientIp(req);
  if ((await col("sewa").countDocuments({ ip, created_at: { $gte: new Date(Date.now() - 3600000) } })) >= 5)
    throw new HttpError(429, "Terlalu banyak pendaftaran. Coba lagi dalam 1 jam.");
  const { lapak_id, mulai, selesai, pedagang_id, nama = "", nik = "", no_hp = "", catatan = "" } = req.body;
  const l = await getLapak(lapak_id);
  if (mulai < todayISO()) throw new HttpError(422, "Tanggal awal tidak boleh sebelum hari ini");
  await cekKosong(l.id, mulai, selesai);
  let data;
  if (pedagang_id) {
    const p = await getPedagang({ id: pedagang_id, aktif: true });
    data = { pedagang_id: p.id, user_id: p.user_id, nama: p.nama, no_hp: p.no_hp };
  } else {
    if (nama.trim().length < 2 || !/^\d{3,}$/.test(nik) || no_hp.trim().length < 8) throw new HttpError(422, "Pedagang baru wajib isi nama, NIK, dan nomor HP");
    data = { nama: nama.trim(), nik, no_hp: no_hp.trim() };
  }
  const s = sewaBaru(l, mulai, selesai, { ...data, catatan, ip });
  await col("sewa").insertOne(s);
  res.status(201).json(clean(s, ["nik", "ip"]));
}));
pasarRouter.get("/sewa", S, wrap(async (req, res) => {
  const docs = await col("sewa").find(req.query.status ? { status: req.query.status } : {}).sort({ created_at: -1 }).toArray();
  res.json(await Promise.all(docs.map(sewaOut)));
}));
pasarRouter.post("/sewa", S, wrap(async (req, res) => {
  // Admin assign pedagang ke lapak — langsung aktif
  const { pedagang_id, lapak_id, mulai, selesai } = req.body;
  const l = await getLapak(lapak_id);
  const p = await getPedagang({ id: pedagang_id });
  await cekKosong(l.id, mulai, selesai);
  const s = sewaBaru(l, mulai, selesai, { pedagang_id: p.id, user_id: p.user_id, nama: p.nama, no_hp: p.no_hp, status: "aktif", sumber: "admin" });
  await col("sewa").insertOne(s);
  res.status(201).json(await sewaOut(s));
}));
pasarRouter.post("/sewa/:id/terima", S, wrap(async (req, res) => {
  const d = await col("sewa").findOne({ id: req.params.id });
  if (!d) throw new HttpError(404, "Pendaftaran tidak ditemukan");
  if (d.status !== "menunggu") throw new HttpError(409, `Pendaftaran sudah ${d.status}`);
  await cekKosong(d.lapak_id, d.mulai, d.selesai);
  const r = await col("sewa").updateOne({ id: d.id, status: "menunggu" }, { $set: { status: "aktif" } });
  if (!r.modifiedCount) throw new HttpError(409, "Pendaftaran sudah diproses");
  if (!d.pedagang_id) {
    try {
      const p = await buatPedagang({ nama: d.nama, nik: d.nik || "000", no_hp: d.no_hp }, req.user.username);
      await col("sewa").updateOne({ id: d.id }, { $set: { pedagang_id: p.id, user_id: p.user_id } });
    } catch (e) {
      await col("sewa").updateOne({ id: d.id }, { $set: { status: "menunggu" } });
      throw e;
    }
  }
  await col("sewa").updateMany({ lapak_id: d.lapak_id, status: "menunggu", mulai: { $lte: d.selesai }, selesai: { $gte: d.mulai } }, { $set: { status: "ditolak" } });
  res.json(await sewaOut(await col("sewa").findOne({ id: d.id })));
}));
pasarRouter.post("/sewa/:id/tolak", S, wrap(async (req, res) => {
  const r = await col("sewa").findOneAndUpdate({ id: req.params.id, status: "menunggu" }, { $set: { status: "ditolak" } }, { returnDocument: "after" });
  if (!r) throw new HttpError(409, "Pendaftaran tidak ditemukan / sudah diproses");
  res.json(await sewaOut(r));
}));
pasarRouter.delete("/sewa/:id", SUPER, wrap(async (req, res) => {
  if (!(await col("sewa").findOneAndDelete({ id: req.params.id }))) throw new HttpError(404, "Sewa tidak ditemukan");
  res.json({ deleted: true });
}));

// ---------- Info Pasar & Berita ----------
const DEF_INFO = { jam_buka: "05:00", jam_tutup: "12:00", mode: "otomatis", pengumuman: "" };
function buka(i) {
  if (i.mode !== "otomatis") return i.mode === "buka";
  const jam = new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TZ || "UTC", hour: "2-digit", minute: "2-digit" }).format(new Date());
  return i.jam_buka <= jam && jam < i.jam_tutup;
}
pasarRouter.get("/publik/info-pasar", wrap(async (_req, res) => {
  const i = { ...DEF_INFO, ...clean(await col("info_pasar").findOne({ _id: "info" })) };
  res.json({ ...i, buka_sekarang: buka(i) });
}));
pasarRouter.put("/info-pasar", SUPER, wrap(async (req, res) => {
  const { jam_buka, jam_tutup, mode, pengumuman = "" } = req.body;
  if (!(jam_buka < jam_tutup) || !["otomatis", "buka", "tutup"].includes(mode)) throw new HttpError(422, "Jam tutup harus setelah jam buka");
  const i = { jam_buka, jam_tutup, mode, pengumuman };
  await col("info_pasar").updateOne({ _id: "info" }, { $set: i }, { upsert: true });
  res.json({ ...i, buka_sekarang: buka(i) });
}));
const beritaOut = ({ id, judul, isi, tanggal }) => ({ id, judul, isi, tanggal });
pasarRouter.get("/publik/berita", wrap(async (_req, res) => {
  res.json((await col("berita").find().sort({ tanggal: -1, created_at: -1 }).limit(50).toArray()).map(beritaOut));
}));
pasarRouter.post("/berita", SUPER, wrap(async (req, res) => {
  const { judul = "", isi = "", tanggal = todayISO() } = req.body;
  if (judul.length < 3 || isi.length < 3) throw new HttpError(422, "Judul & isi minimal 3 karakter");
  const b = { id: newId(), judul, isi, tanggal, created_at: new Date() };
  await col("berita").insertOne(b);
  res.status(201).json(beritaOut(b));
}));
pasarRouter.put("/berita/:id", SUPER, wrap(async (req, res) => {
  const { judul, isi, tanggal } = req.body;
  const r = await col("berita").findOneAndUpdate({ id: req.params.id }, { $set: { judul, isi, tanggal } }, { returnDocument: "after" });
  if (!r) throw new HttpError(404, "Berita tidak ditemukan");
  res.json(beritaOut(r));
}));
pasarRouter.delete("/berita/:id", SUPER, wrap(async (req, res) => {
  if (!(await col("berita").findOneAndDelete({ id: req.params.id }))) throw new HttpError(404, "Berita tidak ditemukan");
  res.json({ deleted: true });
}));
