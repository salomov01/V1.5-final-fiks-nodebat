import { BRANDING } from "@/config";

// Helper format tampilan (IDR, tanggal Indonesia, inisial) + hitung sewa per hari.

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/** "2025-07-14" -> "14/07/2025" */
export function formatDateID(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d ? `${d}/${m}/${y}` : iso;
}

export function formatDateTimeID(iso: string | null): string {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: BRANDING.zonaWaktu });
}

export function initials(name: string): string {
  const letters = name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  return letters || "P";
}

/** Tanggal hari ini (zona pasar) format YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BRANDING.zonaWaktu }).format(new Date());
}

/** Jumlah hari sewa inklusif (0 bila tanggal belum lengkap / terbalik). */
export function hariSewa(mulai: string, selesai: string): number {
  if (!mulai || !selesai) return 0;
  const hari = Math.round((Date.parse(selesai) - Date.parse(mulai)) / 86_400_000) + 1;
  return hari > 0 ? hari : 0;
}

/** Sama dengan server: harga per bulan ÷ 30 × jumlah hari. */
export function hitungSewa(hargaBulanan: number, hari: number): number {
  return Math.round((hargaBulanan * hari) / 30);
}
