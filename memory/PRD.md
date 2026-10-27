# PRD — Bindes2026 (Iuran Lapak Desa Adat Jimbaran)

## Problem statement
Aplikasi pendataan lapak & iuran pasar. (1) Penagih memindai QR penyewa → lihat info, pilih penagih, tombol Sudah Bayar / Belum Bayar; nama penagih tampil di rekap Excel & kuitansi. (2) Halaman awal publik: siapa saja bisa melihat lapak kosong (blok, nomor, jenis, tarif) dan mendaftar → data tersimpan + pesan WhatsApp ke admin → admin konfirmasi di web → otomatis jadi penyewa baru. Lapak otomatis tampil kosong lagi bila sewa habis. Semua fitur admin wajib login.

## Architecture
- Frontend: Vite + React 19, Tailwind v4, shadcn (Base UI), react-query. Routing: `/` publik (Beranda), `/login`, `/dashboard/*` dilindungi (RequireAuth + AppShell). Path lama (/lapak dll) dialihkan ke /dashboard/...
- Backend: FastAPI + Motor. Router `katalog.py`: publik `/api/publik/lapak-kosong`, `/api/publik/pendaftaran` (rate limit 5/IP/jam, dedupe); admin `/api/lapak-unit` CRUD, `/api/pendaftaran`, `/terima`, `/tolak`.
- Okupansi: `lapak_units.blok` dicocokkan dengan `tenants.blok` (status aktif & selesai >= hari ini).
- Nomor WA admin (dummy): `frontend/src/config.ts` → `KONTAK_ADMIN.whatsapp`.
- `TRUSTED_PROXY_HOPS=2` di backend/.env untuk IP klien asli.

## Implemented
- 2026: Manajemen penagih, alur scan QR Sudah/Belum Bayar, nama penagih di pembayaran/Excel/kuitansi.
- 2026-06: Halaman publik katalog lapak kosong + filter kategori, formulir daftar + tautan wa.me ke admin; menu admin "Pendaftaran & Katalog" (terima → penyewa baru otomatis + pendaftar lain ditolak, tolak, CRUD katalog lapak, status Kosong/Terisi); semua admin di /dashboard/*; perbaikan keamanan (rate limit anti-spoof XFF, kunci atomik terima, larang hapus/ganti nama lapak yang masih disewa). Diuji testing agent (iteration_2) + verifikasi ulang perbaikan.

- 2026-06: Foto lapak — admin unggah 1 foto per lapak (Emergent Object Storage, JPG/PNG/WEBP maks 5 MB) di tab Katalog Lapak; publik melihat via `/api/publik/foto/{id}`; tanpa foto → foto ilustrasi per jenis (`FOTO_CONTOH` di frontend/src/config.ts). Diuji via curl + screenshot.

- 2026-06: Perbaikan dari code review — storage `_call` aman, catch kosong di ScanQr ditangani, `secrets` di tes, rate limit fallback anti-spoof, validasi magic-byte foto, tes katalog diperbarui. Diuji testing agent (iteration_3) + pytest 33 lulus.

- 2026-06: Super Admin login `pengelola` / `jimbaran2026`; peran staff berganti nama "Staf Pemungut Iuran" (akun contoh `pemungut1`); staf dibuat Super Admin di Pengaturan.
## Backlog
- 2026-06: Pembaruan besar — tema putih + aksen #1E4E42; halaman publik Home (hero, sejarah desa & pasar), Info Pasar (status buka/tutup + berita, dikelola Super Admin), Informasi Lapak; Navbar & Footer; RBAC Super Admin/Staff (server-side 403 + total uang null untuk Staff); akun pengguna menggantikan daftar penagih (nama penagih = akun login, readonly); urutan kolom Excel baru; struktur folder (assets, content, services, utils, hooks, types, pages/public|admin, components/layout|home|…); README panduan. Scan QR menolak LUNAS ganda (409). Diuji testing agent iteration_4 (57 tes backend + alur frontend).
- P1: Notifikasi otomatis (WA API) ke pendaftar saat diterima/ditolak
- P2: Denah pasar interaktif
