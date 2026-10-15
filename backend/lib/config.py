"""PUSAT PENGATURAN SERVER (BACKEND).

=============================================================================
 Semua nilai yang boleh diubah pengelola ADA DI FILE INI.
 Ubah nilainya saja (teks di dalam tanda kutip / angka), jangan ubah nama
 variabel di sebelah kiri tanda '='.

 Setelah menyimpan file ini, server otomatis memuat ulang (± 3 detik).
 Panduan lengkap: /app/PANDUAN.md
=============================================================================
"""

# ---------------------------------------------------------------------------
# 1. IDENTITAS DESA / PASAR
#    Dipakai pada judul file laporan Excel.
# ---------------------------------------------------------------------------
NAMA_DESA = "Desa Adat Jimbaran"
NAMA_PASAR = "Pasar Adat Jimbaran"

# Judul yang tercetak di baris pertama file Excel hasil "Ekspor Excel".
JUDUL_LAPORAN_EXCEL = "REKAP PEMBAYARAN SEWA LAPAK — PASAR ADAT DESA ADAT JIMBARAN"

# ---------------------------------------------------------------------------
# 2. ZONA WAKTU
#    Menentukan perhitungan "hari ini" untuk tunggakan, dashboard & laporan.
#    Pilihan: "Asia/Makassar" (WITA/Bali), "Asia/Jakarta" (WIB),
#             "Asia/Jayapura" (WIT).
#    CATATAN: zona waktu utama diatur di backend/.env pada baris APP_TZ.
#             Nilai di bawah ini hanya LABEL yang ditampilkan/ditulis.
# ---------------------------------------------------------------------------
LABEL_ZONA_WAKTU = "WITA"

# ---------------------------------------------------------------------------
# 3. TARIF ACUAN PER KATEGORI SEWA (Rupiah)
#    Dipakai sebagai angka awal saat menambah penyewa baru.
#    Harus sama dengan nilai TARIF_DEFAULT di frontend/src/config.ts.
# ---------------------------------------------------------------------------
TARIF_DEFAULT = {
    "harian": 25_000,
    "bulanan": 450_000,
    "tahunan": 5_000_000,
}

# ---------------------------------------------------------------------------
# 4. ATURAN JATUH TEMPO
# ---------------------------------------------------------------------------
# Tanggal jatuh tempo tagihan bulanan (1-28). Contoh: 10 = tanggal 10.
JATUH_TEMPO_TANGGAL_BULANAN = 10

# Lama tempo tagihan harian, dihitung dari tanggal tagihan dibuat.
TEMPO_HARI_HARIAN = 7

# Catatan yang otomatis ditempel pada tagihan hasil "Tagihan Massal".
CATATAN_TAGIHAN_MASSAL = "Tagihan massal bulanan"

# ---------------------------------------------------------------------------
# 5. NAMA BULAN (Bahasa Indonesia)
#    Dipakai untuk menamai periode tagihan, mis. "September 2026".
# ---------------------------------------------------------------------------
NAMA_BULAN_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
