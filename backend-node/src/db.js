// Koneksi MongoDB + helper umum (tanggal zona pasar, id, error HTTP).
import crypto from "node:crypto";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URL);
export const db = client.db(process.env.DB_NAME);
export const connect = () => client.connect();

export const newId = () => crypto.randomUUID();

// "Hari ini" selalu dihitung di server memakai APP_TZ (YYYY-MM-DD).
export const todayISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TZ || "UTC" }).format(new Date());

export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// Bungkus handler async agar error otomatis diteruskan ke error handler Express.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Buang _id Mongo & field internal sebelum dikirim ke klien.
export const clean = (doc, hide = []) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  for (const k of hide) delete rest[k];
  return rest;
};

export async function logActivity(actor, action, entity, entityId, label, detail = "") {
  try {
    await db.collection("activities").insertOne({ id: newId(), actor, action, entity, entity_id: entityId, label, detail, created_at: new Date() });
  } catch {
    // best-effort: kegagalan log tidak menggagalkan aksi utama
  }
}

// IP klien asli dari X-Forwarded-For (lewati proxy tepercaya).
export function clientIp(req) {
  const hops = String(req.headers["x-forwarded-for"] || "").split(",").map((h) => h.trim()).filter(Boolean);
  const skip = Number(process.env.TRUSTED_PROXY_HOPS || 1);
  return hops.length > skip ? hops[hops.length - 1 - skip] : req.socket.remoteAddress || "";
}
