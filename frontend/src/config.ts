/* ===========================================================================
 * PUSAT PENGATURAN TAMPILAN (FRONTEND)
 * ---------------------------------------------------------------------------
 * Semua teks & angka yang boleh diubah pengelola ADA DI FILE INI.
 * Ubah nilainya saja (teks di dalam tanda kutip / angka), jangan ubah nama
 * di sebelah kiri tanda ':'.
 *
 * Setelah disimpan, halaman web otomatis ikut berubah (± 2 detik).
 * Panduan lengkap: /app/PANDUAN.md
 * =========================================================================== */

/** 1. IDENTITAS DESA & PASAR — tampil di sidebar, login, kartu QR, kuitansi. */
export const BRANDING = {
  /** Nama desa adat (sidebar, halaman login, kartu QR, kuitansi). */
  namaDesa: "Desa Adat Jimbaran",
  /** Nama pasar (subjudul dashboard, kuitansi, form penyewa). */
  namaPasar: "Pasar Adat Jimbaran",
  /** Versi aplikasi yang tampil di bawah sidebar. */
  versi: "v1.0",
  /** Jabatan penanda tangan pada kuitansi resmi. */
  jabatanPenandatangan: "Bendahara Pasar Adat",
  /**
   * Zona waktu tampilan jam & tanggal.
   * Pilihan: "Asia/Makassar" (WITA/Bali), "Asia/Jakarta" (WIB), "Asia/Jayapura" (WIT).
   * Penting: samakan dengan APP_TZ di backend/.env.
   */
  zonaWaktu: "Asia/Makassar",
  /** Label singkat zona waktu di samping jam. Mis. "WITA", "WIB", "WIT". */
  labelZonaWaktu: "WITA",
};

/**
 * 2. NOMOR HP / WHATSAPP ADMIN UNTUK KONFIRMASI SEWA LAPAK (halaman publik)
 * Ganti `whatsapp` dengan nomor WA admin asli, format 62xxxxxxxxxx (tanpa + / spasi).
 */
export const KONTAK_ADMIN = {
  whatsapp: "6281337514654",
};

/**
 * 3. FOTO CONTOH LAPAK (dipakai bila pengelola belum mengunggah foto)
 * Kunci = jenis lapak (huruf kecil). Ganti URL-nya dengan foto lain bila perlu,
 * atau unggah foto asli tiap lapak di menu Data Lapak dan Iuran.
 */
export const FOTO_CONTOH: Record<string, string> = {
  pangan: "https://images.unsplash.com/photo-1628575005417-6560070073f6?auto=format&fit=crop&w=800&q=70",
  "sayur & buah": "https://images.unsplash.com/photo-1663154438428-60cdc204f99b?auto=format&fit=crop&w=800&q=70",
  "daging & ikan": "https://images.unsplash.com/photo-1599033183537-54ff77f58f75?auto=format&fit=crop&w=800&q=70",
  "pakaian & canang": "https://images.pexels.com/photos/40231849/pexels-photo-40231849.jpeg?auto=compress&cs=tinysrgb&w=800",
  lainnya: "https://images.pexels.com/photos/37813600/pexels-photo-37813600.jpeg?auto=compress&cs=tinysrgb&w=800",
};

export function fotoLapak(foto_url: string | null | undefined, jenis: string): string {
  return foto_url || FOTO_CONTOH[jenis.trim().toLowerCase()] || FOTO_CONTOH.lainnya;
}
