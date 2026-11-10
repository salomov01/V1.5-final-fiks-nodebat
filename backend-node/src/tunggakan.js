// Tunggakan: iuran harian belum dibayar (sejak tanggal mulai hitung s/d kemarin) & sisa sewa lapak.
import { Router } from "express";
import { db, HttpError, logActivity, todayISO, wrap } from "./db.js";
import { requireSession, requireSuper } from "./auth.js";
import { sewaOut } from "./pasar.js";
import { sewaAktif, simpan } from "./pembayaran.js";

export const tunggakanRouter = Router();
const col = (n) => db.collection(n);
const S = [requireSession];
const TGL = /^\d{4}-\d{2}-\d{2}$/;
const geser = (t, n) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function mulaiHitung() {
  const d = await col("pengaturan").findOneAndUpdate({ _id: "tunggakan" }, { $setOnInsert: { mulai: todayISO() } }, { upsert: true, returnDocument: "after" });
  return (d.value ?? d).mulai;
}

async function hariBelumBayar(s, mulai, kemarin) {
  if (!(s.iuran > 0)) return [];
  const dari = s.mulai > mulai ? s.mulai : mulai, sampai = s.selesai < kemarin ? s.selesai : kemarin;
  if (dari > sampai) return [];
  const lunas = new Set((await col("iuran_lock").find({ _id: { $regex: `^${s.id}:` } }).toArray()).map((d) => d._id.split(":")[1]));
  const out = [];
  for (let t = dari; t <= sampai; t = geser(t, 1)) if (!lunas.has(t)) out.push(t);
  return out;
}

export async function rekapTunggakan(pedagangId = null) {
  const mulai = await mulaiHitung(), today = todayISO(), kemarin = geser(today, -1);
  const iuran = [], sewa = [];
  for (const d of await col("sewa").find({ status: "aktif", mulai: { $lte: today }, ...(pedagangId ? { pedagang_id: pedagangId } : {}) }).sort({ nama: 1, mulai: 1 }).toArray()) {
    const base = { sewa_id: d.id, pedagang_id: d.pedagang_id ?? null, user_id: d.user_id ?? null, nama: d.nama, lapak_nama: d.lapak_nama };
    const hari = await hariBelumBayar(d, mulai, kemarin);
    if (hari.length) iuran.push({ ...base, iuran: d.iuran, tanggal: hari, total: d.iuran * hari.length });
    const s = await sewaOut(d);
    if (s.sisa > 0) sewa.push({ ...base, mulai: s.mulai, selesai: s.selesai, total_harga: s.total_harga, terbayar: s.terbayar, sisa: s.sisa });
  }
  return { mulai_hitung: mulai, iuran, sewa, total_iuran: iuran.reduce((a, t) => a + t.total, 0), total_sewa: sewa.reduce((a, t) => a + t.sisa, 0) };
}

tunggakanRouter.get("/tunggakan", S, wrap(async (req, res) => res.json(await rekapTunggakan(req.query.pedagang_id || null))));

tunggakanRouter.post("/payments/tunggakan-iuran", S, wrap(async (req, res) => {
  const s = await sewaAktif(req.body.sewa_id);
  const pilih = [...new Set(Array.isArray(req.body.tanggal) ? req.body.tanggal : [])].sort();
  if (!pilih.length) throw new HttpError(422, "Pilih minimal satu hari");
  const belum = new Set(await hariBelumBayar(s, await mulaiHitung(), geser(todayISO(), -1)));
  if (!pilih.every((t) => belum.has(t))) throw new HttpError(409, "Sebagian tanggal sudah dibayar atau bukan tunggakan — muat ulang data");
  const terkunci = [];
  for (const t of pilih) {
    try { await col("iuran_lock").insertOne({ _id: `${s.id}:${t}`, at: t }); terkunci.push(t); } catch {
      await col("iuran_lock").deleteMany({ _id: { $in: terkunci.map((x) => `${s.id}:${x}`) } });
      throw new HttpError(409, "Tunggakan sedang/sudah dibayar petugas lain — muat ulang data");
    }
  }
  res.status(201).json(await simpan("iuran", s, s.iuran * pilih.length, `Tunggakan ${pilih.length} hari: ${pilih.join(", ")}`, req.user, pilih));
}));

tunggakanRouter.get("/pengaturan/tunggakan", S, wrap(async (_req, res) => res.json({ mulai: await mulaiHitung() })));
tunggakanRouter.put("/pengaturan/tunggakan", S, requireSuper, wrap(async (req, res) => {
  const { mulai } = req.body;
  if (!TGL.test(mulai || "") || mulai > todayISO()) throw new HttpError(422, "Tanggal mulai tidak valid");
  await col("pengaturan").updateOne({ _id: "tunggakan" }, { $set: { mulai } }, { upsert: true });
  await logActivity(req.user.username, "ubah", "pengaturan", "tunggakan", "Mulai hitung tunggakan", mulai);
  res.json({ mulai });
}));
