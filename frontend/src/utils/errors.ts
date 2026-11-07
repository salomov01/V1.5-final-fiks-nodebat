// Helper: ambil pesan error `detail` dari respons FastAPI agar aman ditampilkan di toast.
import { ApiError } from "@/services/api";

export function errDetail(e: unknown, fallback: string): string {
  const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
    ? (e.body as { detail: unknown }).detail : null;
  if (typeof d === "string") return d;
  // Validasi pydantic (array, teks Inggris) -> pakai pesan Indonesia dari pemanggil.
  return fallback;
}
