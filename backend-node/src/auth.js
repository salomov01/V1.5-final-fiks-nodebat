// Login multi-akun (super_admin & staff), sesi cookie httpOnly, kelola akun.
// Hash password PBKDF2-SHA256 200.000 iterasi — kompatibel dengan backend Python.
import crypto from "node:crypto";
import { Router } from "express";
import { db, HttpError, logActivity, newId, wrap } from "./db.js";

export const COOKIE = "siplap_session";
const TTL_MS = 7 * 24 * 3600 * 1000;
const users = () => db.collection("users");
const sessions = () => db.collection("sessions");

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return { salt: salt.toString("hex"), password_hash: crypto.pbkdf2Sync(pw, salt, 200000, 32, "sha256").toString("hex") };
}
export function verifyPassword(pw, saltHex, hashHex) {
  const d = crypto.pbkdf2Sync(pw, Buffer.from(saltHex, "hex"), 200000, 32, "sha256");
  return crypto.timingSafeEqual(d, Buffer.from(hashHex, "hex"));
}

const principal = (u) => ({ id: u.id, nama: u.nama, username: u.username, role: u.role });
const pwBawaan = (u) => u.role === "super_admin" && verifyPassword("jimbaran2026", u.salt, u.password_hash);

async function ensureSuperAdmin() {
  if (await users().findOne({ role: "super_admin" })) return;
  await users().insertOne({
    id: newId(), nama: process.env.ADMIN_NAMA || "Super Admin", username: process.env.ADMIN_USERNAME.toLowerCase(),
    email: (process.env.ADMIN_EMAIL || "").toLowerCase(), role: "super_admin", aktif: true,
    ...hashPassword(process.env.ADMIN_PASSWORD), created_at: new Date(),
  });
}

// Middleware: wajib login. req.user = akun yang login (dibaca ulang tiap request).
export const requireSession = wrap(async (req, _res, next) => {
  const s = req.cookies[COOKIE] && (await sessions().findOne({ token: req.cookies[COOKIE] }));
  const u = s && (await users().findOne({ id: s.user_id }));
  if (!u || u.aktif === false) throw new HttpError(401, "Sesi tidak valid — silakan login kembali");
  req.user = principal(u);
  next();
});
// Middleware: khusus Super Admin (Admin Tingkat 2).
export const requireSuper = (req, _res, next) =>
  req.user?.role === "super_admin" ? next() : next(new HttpError(403, "Hanya Super Admin yang boleh melakukan aksi ini"));

export const authRouter = Router();
authRouter.post("/auth/login", wrap(async (req, res) => {
  await ensureSuperAdmin();
  const ident = String(req.body.username || "").trim().toLowerCase();
  const key = `login:${ident}`;
  const since = new Date(Date.now() - 15 * 60 * 1000);
  if ((await db.collection("login_attempts").countDocuments({ key, at: { $gte: since } })) >= 5)
    throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi nanti.");
  const u = ident && (await users().findOne({ $or: [{ username: ident }, { email: ident }] }));
  if (!u || u.aktif === false || !verifyPassword(String(req.body.password || ""), u.salt, u.password_hash)) {
    await db.collection("login_attempts").insertOne({ key, at: new Date() });
    throw new HttpError(401, "Username atau password salah");
  }
  await db.collection("login_attempts").deleteMany({ key });
  const token = crypto.randomBytes(32).toString("hex");
  await sessions().insertOne({ token, user_id: u.id, username: u.username, created_at: new Date() });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: TTL_MS, path: "/" });
  res.json({ ...principal(u), password_bawaan: pwBawaan(u) });
}));
authRouter.get("/auth/me", requireSession, wrap(async (req, res) => {
  const u = await users().findOne({ id: req.user.id });
  res.json({ ...principal(u), password_bawaan: pwBawaan(u) });
}));
authRouter.post("/auth/logout", wrap(async (req, res) => {
  if (req.cookies[COOKIE]) await sessions().deleteOne({ token: req.cookies[COOKIE] });
  res.clearCookie(COOKIE, { path: "/" }).json({ ok: true });
}));
authRouter.post("/auth/change-password", requireSession, wrap(async (req, res) => {
  const { current_password: cur, new_password: nw } = req.body;
  const u = await users().findOne({ id: req.user.id });
  if (!verifyPassword(String(cur || ""), u.salt, u.password_hash)) throw new HttpError(401, "Password saat ini salah");
  if (!nw || nw.length < 8 || nw === cur) throw new HttpError(422, "Password baru minimal 8 karakter & berbeda");
  await users().updateOne({ id: u.id }, { $set: hashPassword(nw) });
  await sessions().deleteMany({ user_id: u.id, token: { $ne: req.cookies[COOKIE] } });
  res.json({ ok: true });
}));

// ---- Kelola akun (Super Admin) ----
const gajiValid = (g) => Number.isInteger(g) && g >= 0 && g <= 1e9;
const out = (u) => ({ id: u.id, nama: u.nama, username: u.username, role: u.role, aktif: u.aktif !== false, gaji_bulanan: u.gaji_bulanan || 0 });
authRouter.get("/users", requireSession, requireSuper, wrap(async (_req, res) => {
  res.json((await users().find().sort({ created_at: 1 }).toArray()).map(out));
}));
authRouter.post("/users", requireSession, requireSuper, wrap(async (req, res) => {
  const { nama = "", username = "", password = "", role = "staff", gaji_bulanan = 0 } = req.body;
  const uname = username.trim().toLowerCase();
  if (nama.trim().length < 2 || !/^[a-z0-9._-]{3,40}$/.test(uname) || password.length < 8 || !["staff", "super_admin"].includes(role) || !gajiValid(gaji_bulanan))
    throw new HttpError(422, "Isi nama, username (min 3) & password (min 8)");
  if (await users().findOne({ $or: [{ username: uname }, { email: uname }] })) throw new HttpError(409, `Username ${uname} sudah dipakai`);
  const doc = { id: newId(), nama: nama.trim(), username: uname, email: "", role, aktif: true, gaji_bulanan, ...hashPassword(password), created_at: new Date() };
  await users().insertOne(doc);
  await logActivity(req.user.username, "buat", "akun", doc.id, uname, role);
  res.status(201).json(out(doc));
}));
authRouter.patch("/users/:id", requireSession, requireSuper, wrap(async (req, res) => {
  const u = await users().findOne({ id: req.params.id });
  if (!u) throw new HttpError(404, "Akun tidak ditemukan");
  const { nama, role, aktif, password, gaji_bulanan } = req.body;
  if (u.id === req.user.id && (aktif === false || (role && role !== "super_admin")))
    throw new HttpError(409, "Tidak bisa menonaktifkan atau menurunkan peran akun sendiri");
  const set = {};
  if (gaji_bulanan !== undefined) {
    if (!gajiValid(gaji_bulanan)) throw new HttpError(422, "Gaji tidak valid");
    set.gaji_bulanan = gaji_bulanan;
  }
  if (nama) set.nama = nama;
  if (role) set.role = role;
  if (typeof aktif === "boolean") set.aktif = aktif;
  if (password) Object.assign(set, hashPassword(password));
  await users().updateOne({ id: u.id }, { $set: set });
  if (aktif === false || password || role) await sessions().deleteMany({ user_id: u.id });
  res.json(out(await users().findOne({ id: u.id })));
}));
authRouter.delete("/users/:id", requireSession, requireSuper, wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(409, "Tidak bisa menghapus akun sendiri");
  const r = await users().findOneAndDelete({ id: req.params.id });
  if (!r) throw new HttpError(404, "Akun tidak ditemukan");
  await sessions().deleteMany({ user_id: req.params.id });
  res.json({ deleted: true });
}));
