import { BRANDING } from "@/config";

// Helper format tampilan (IDR, tanggal Indonesia, inisial). Hanya untuk tampilan —
// tanggal bisnis ("hari ini") selalu dihitung server-side.

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** "2025-07-14" -> "14/07/2025" */
export function formatDateID(iso: string): string {
  if (!iso) return "-";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeID(iso: string | null): string {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BRANDING.zonaWaktu,
  });
}

export function initials(name: string): string {
  const letters = name
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "P";
}

const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas",
];

/** Angka -> kata untuk kuitansi resmi, mis. 450000 -> "empat ratus lima puluh ribu rupiah". */
function terbilang(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh ${terbilang(n % 10)}`.trim();
  if (n < 200) return `seratus ${terbilang(n - 100)}`.trim();
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus ${terbilang(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilang(n - 1000)}`.trim();
  if (n < 1_000_000) return `${terbilang(Math.floor(n / 1000))} ribu ${terbilang(n % 1000)}`.trim();
  if (n < 1_000_000_000)
    return `${terbilang(Math.floor(n / 1_000_000))} juta ${terbilang(n % 1_000_000)}`.trim();
  return `${terbilang(Math.floor(n / 1_000_000_000))} miliar ${terbilang(n % 1_000_000_000)}`.trim();
}

export function terbilangIDR(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "nol rupiah";
  const words = terbilang(Math.floor(n)).replace(/\s+/g, " ").trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`;
}

export const KATEGORI_LABEL: Record<string, string> = {
  harian: "Harian",
  bulanan: "Bulanan",
  tahunan: "Tahunan",
};

export const METODE_LABEL: Record<string, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

export const STATUS_PENYEWA_LABEL: Record<string, string> = {
  aktif: "Aktif",
  berhenti: "Berhenti",
};
