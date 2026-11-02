// Entry Express: semua route di bawah /api (sama persis dengan backend Python).
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { connect, HttpError } from "./db.js";
import { authRouter } from "./auth.js";
import { pasarRouter } from "./pasar.js";
import { bayarRouter } from "./pembayaran.js";

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// CORS sederhana (hanya bila frontend beda domain). Isi CORS_ORIGINS dipisah koma.
const origins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && origins.includes(o)) {
    res.set({ "Access-Control-Allow-Origin": o, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});

const api = express.Router();
api.get("/health", (_req, res) => res.json({ ok: true }));
api.use(authRouter, pasarRouter, bayarRouter);
app.use("/api", api);

// Format error sama dengan FastAPI: { detail: "..." }
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ detail: err.detail });
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ detail: "Ukuran foto maksimal 5 MB" });
  console.error(err);
  res.status(500).json({ detail: "Terjadi kesalahan server" });
});

const port = Number(process.env.PORT || 8001);
await connect();
// Vercel: ekspor app (serverless). Render/Railway/VPS: jalankan server biasa.
if (!process.env.VERCEL) app.listen(port, () => console.log(`API Node.js berjalan di port ${port}`));
export default app;
