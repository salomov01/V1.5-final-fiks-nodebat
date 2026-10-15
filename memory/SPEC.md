# SIPLAP — Sistem Informasi Pendataan Lapak & Pembayaran, Desa Adat Jimbaran

## Ringkasan
Aplikasi web admin panel (Bahasa Indonesia) untuk pengelola Pasar Adat Jimbaran:
pendataan penyewaan lapak pasar (kategori **Harian / Bulanan / Tahunan**) + manajemen
verifikasi & konfirmasi pembayaran, dengan QR Code per penyewa (generate + scan kamera).
UI mengikuti style admin panel modern ala digipanel (user request): sidebar gelap slate,
topbar putih dengan jam WITA, konten slate-50, aksen emas amber.

## Stack
- Backend: FastAPI (api_router prefix /api) + Motor/MongoDB (db `app`), Pydantic v2, `APP_TZ=Asia/Makassar` (WITA) di backend/.env
- Frontend: Vite + React 19 + TS strict + Tailwind v4 + shadcn/base-ui, TanStack Query, sonner
- QR: `qrcode` (generate → toDataURL + <img>, unduh PNG) & `html5-qrcode` (scan kamera) — keduanya client-side

## Data model (Mongo)
- `tenants` (Penyewa): `id` (uuid), `nomor_id` **LPK-JMB-### unik** (auto dari counter `counters.lapk_seq`, bisa diisi manual), `nama_lengkap`, `no_hp`, `kategori` (harian|bulanan|tahunan), `blok`, `tarif` (Rp/periode), `mulai`/`selesai` (YYYY-MM-DD), `status` (aktif|berhenti), `catatan`, `created_at`
- `payments` (Pembayaran): `id`, `tenant_id`, denormalisasi `nomor_id`+`nama_lengkap`, `periode` (label bebas), `jumlah`, `metode` (tunai|qris|transfer), `status` (**menunggu → lunas** via confirm; bisa `ditolak` via reject), `jatuh_tempo`, `catatan`, `confirmed_at`, `created_at`
- Indexes di `backend/lib/db.py` INDEXES (id/nomor_id unik, tenant_created, status_created)

## Keamanan (hasil security audit + perbaikannya)
- **Tidak ada endpoint anonim**: route starter `/api/status` (GET/POST) sudah DIHAPUS beserta index `status_checks`. Hanya `GET /api/` yang publik, dan hanya mengembalikan `{"status":"ok"}` (tanpa data) untuk readiness probe.
- **CSRF** (`server.py` middleware `csrf_dan_security_headers`): cookie diset `SameSite=Lax` tetapi ingress/CDN menulisnya ulang jadi `SameSite=None`, jadi SameSite TIDAK bisa diandalkan. Pertahanan yang dipakai: (a) tolak 403 bila `Sec-Fetch-Site: cross-site` (header diisi browser, tak bisa dipalsukan), (b) tolak 415 bila POST/PUT/PATCH/DELETE ber-body tapi `Content-Type` bukan `application/json` (menutup jalur form HTML lintas situs). **Jangan bandingkan Origin dengan header `Host`** — di balik ingress `Host` bukan domain publik, dan percobaan itu sempat memblokir seluruh permintaan sah.
- **CORS**: `allow_credentials` otomatis `False` bila `CORS_ORIGINS` masih `*`, sehingga wildcard tidak bisa dipakai memantulkan permintaan bercookie. Frontend tidak terpengaruh karena memanggil path relatif (same-origin).
- **Header pengerasan** pada semua respons: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- **Rate limit** (`lib/ratelimit.py`, koleksi `login_attempts` + TTL 1 jam): 5 kegagalan per 15 menit per (username+IP) → 429 dengan `Retry-After`. Berlaku untuk `/auth/login` dan `/auth/change-password`.
- **Peringatan password bawaan**: `/auth/me` & `/auth/login` mengembalikan `password_bawaan`, DIHITUNG ULANG dengan membandingkan password aktif terhadap `ADMIN_PASSWORD` di .env (bukan flag tersimpan — supaya tetap benar bila password diganti lalu dikembalikan ke nilai bawaan). Frontend menampilkan `DefaultPasswordAlert` di Dashboard & Pengaturan.
- **Integritas data**: `jumlah` pembayaran dan `tarif` penyewa wajib `> 0` dan `<= 1_000_000_000`; panjang teks dibatasi. `confirm`/`reject` hanya menerima pembayaran berstatus `menunggu` — selain itu 409 (mencegah konfirmasi ganda & menghidupkan pembayaran yang sudah ditolak).
- **Injeksi**: parameter pencarian `q` di-`re.escape()` dan dibatasi 80 karakter (cegah ReDoS/pola tak terduga). Ekspor Excel melewatkan nilai teks lewat `_aman_excel()` yang memberi awalan kutip tunggal pada `= + - @` (cegah formula injection).
- Sisa risiko yang disengaja: password bawaan masih nilai terdokumentasi — pengelola HARUS menggantinya lewat `/pengaturan`; UI sudah memperingatkan.

## Pusat konfigurasi (WAJIB dipakai, jangan hardcode ulang)
Semua teks/angka yang mungkin diubah pengelola sudah dipusatkan — **tidak ada lagi nama desa, tarif, atau zona waktu yang ditulis langsung di komponen**:
- `frontend/src/config.ts` → `BRANDING` (namaDesa, namaPasar, versi, jabatanPenandatangan, zonaWaktu, labelZonaWaktu), `TARIF_DEFAULT` (acuan tarif per kategori), `PESAN_WA` (template sapaan/identitas/penutup dengan penanda `{nama}`, `{blok}`, `{nomorId}`, `{namaPasar}`, `{namaDesa}`)
- `backend/lib/config.py` → `NAMA_DESA`, `NAMA_PASAR`, `JUDUL_LAPORAN_EXCEL`, `LABEL_ZONA_WAKTU`, `TARIF_DEFAULT`, `JATUH_TEMPO_TANGGAL_BULANAN`, `TEMPO_HARI_HARIAN`, `CATATAN_TAGIHAN_MASSAL`, `NAMA_BULAN_ID`
- `TARIF_DEFAULT` ada di kedua sisi dan **harus dijaga sama**; zona waktu perhitungan tetap dari `APP_TZ` di backend/.env (config hanya label tampilan).
- Panduan pengelola berbahasa Indonesia: **`/app/PANDUAN.md`** (aturan emas, peta folder, tabel "mau ubah apa di mana", cara ganti database/backup/restore, migrasi ke SQL, troubleshooting, daftar endpoint). Perbarui file ini bila menambah pengaturan baru.

## Auth (login pengelola)
- Sesi = cookie **httpOnly `siplap_session`** (TTL 7 hari, koleksi `sessions` + TTL index). Tidak ada token di JSON.
- Kredensial tersimpan di koleksi **`admins`** (`_id: "admin"`) sebagai hash **PBKDF2-SHA256** (`lib/security.py`, 200k iterasi, salt per-akun), di-**bootstrap sekali** dari `ADMIN_USERNAME`/`ADMIN_PASSWORD` di backend/.env saat login pertama — sesudah itu sumber kebenaran adalah Mongo, bukan .env.
- `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` · `POST /auth/change-password` (butuh `current_password`; `new_password` min 8 char, harus beda; mencabut semua sesi lain tapi mempertahankan sesi saat ini; dicatat ke riwayat aktivitas)
- **Semua** router data (`/tenants`, `/payments`, `/dashboard`, `/laporan`, `/activities`) di-gate `Depends(require_session)` → 401 tanpa sesi.
- Frontend: `src/components/RequireAuth.tsx` (gerbang via `/auth/me`, redirect ke `/login`), `src/pages/Login.tsx` (`beginSession()` setelah sukses), `src/pages/Pengaturan.tsx` (`/pengaturan` — ganti password + info akun), tombol logout di topbar AppShell memakai `endSession()`.
- Kredensial: lihat memory/test_credentials.md.

## Endpoints /api
- `GET /tenants` (query: q, kategori, status) · `POST /tenants` (201, auto nomor_id) · `GET/PUT/DELETE /tenants/{id}` (delete = kaskade hapus payments penyewa) · `GET /tenants/by-nomor/{nomor_id}` (dipakai scanner QR)
- `GET /payments` (query: status, tenant_id) · `POST /payments` (status awal menunggu) · `PATCH /payments/{id}/confirm` · `PATCH /payments/{id}/reject` · `DELETE /payments/{id}`
- `GET /dashboard/stats` — total/aktif penyewa, tagihan menunggu + nilai, pemasukan bulan ini vs lalu, by_kategori, revenue_6m (bucket WITA), recent_payments
- `GET /payments/overdue` → **OverdueSummary** (rekap tunggakan): tagihan `menunggu` yang `jatuh_tempo` < hari ini (WITA, `today_iso()`), diperkaya `hari_telat` + kategori/blok/no_hp penyewa, **urut telat terlama dulu**, plus agregat `jumlah_penyewa` / `total_tunggakan` / `telat_terlama`. Tagihan tanpa `jatuh_tempo` tidak dihitung menunggak.
- `POST /payments/bulk-monthly` → **BulkBillResult**: menerbitkan tagihan bulan berjalan untuk semua penyewa **bulanan berstatus aktif** (jatuh tempo tanggal 10, catatan "Tagihan massal bulanan"). **Idempotent** — penyewa yang sudah punya tagihan `periode` tersebut dilewati (`dilewati`); dicatat ke riwayat aktivitas dengan `entity_id="bulk"`.
  Kedua rute statis ini didefinisikan **sebelum** rute `/{id}` agar tidak tertangkap path-param.
- `GET /laporan/pembayaran.xlsx` — rekap pembayaran Excel (openpyxl: header desa, baris Filter, 9 kolom, total lunas & menunggu). **Filter opsional**: `bulan=YYYY-MM` (dihitung pada zona WITA), `kategori=harian|bulanan|tahunan` (lewat tenant_id penyewa kategori itu), `status=menunggu|lunas|ditolak`; kategori/status tak dikenal → 422. Nama file memuat filter aktif. Diunduh dari frontend via anchor same-origin agar cookie sesi terkirim
- `GET /activities` (query: entity, limit≤500) — riwayat aktivitas terbaru lebih dulu

## Riwayat aktivitas (audit trail)
- Koleksi `activities`: `actor` (username pengelola), `action` (buat|ubah|hapus|konfirmasi|tolak), `entity` (penyewa|pembayaran|akun), `entity_id`, `label` siap tampil, `detail`, `created_at`
- Ditulis oleh `lib/activity.py::log_activity` (best-effort — kegagalan log tidak menggagalkan aksi utama) dari: tenants create/update/delete, payments create/confirm/reject/delete, dan ganti password
- `require_session` mengembalikan **username** sehingga handler memakai `actor: str = Depends(require_session)`
- Frontend: `src/pages/Riwayat.tsx` (`/riwayat`) — timeline berikon, filter tab Semua/Pembayaran/Penyewa/Akun

## Pengingat WhatsApp
`src/lib/whatsapp.ts` — murni tautan `wa.me` pra-isi (TANPA integrasi/API key): `normalizePhoneID` (0812… → 62812…), `reminderText` (sapaan "Om Swastiastu", identitas lapak, nominal & jatuh tempo, opsi pembayaran), `waReminderLink` → `null` bila no_hp kosong (UI menampilkan toast error). Tombol ada di: baris tabel Lapak, baris pembayaran berstatus menunggu, dan hasil Pindai QR.

## Cetak (print)
`@media print` di `src/index.css` hanya menampilkan elemen berkelas **`.print-area`**:
- Kartu ID penyewa ber-QR (`QrCardDialog`, tombol "Cetak Kartu" + "Unduh PNG")
- Kuitansi resmi desa (`ReceiptDialog`, tombol "Kuitansi" muncul hanya untuk pembayaran `lunas`) — nomor KW-xxxxxxxx, jumlah + **terbilang** (`terbilangIDR` di `src/lib/format.ts`), tanda tangan Bendahara Pasar Adat

## Halaman frontend (src/pages)
- `/` Dashboard: 4 kartu statistik, grafik tren pemasukan (recharts), daftar pembayaran terbaru + tombol verifikasi cepat
- `/lapak` Pendataan Lapak: CRUD penyewa (dialog form, **tarif otomatis** terisi dari acuan kategori — `TARIF_DEFAULT` di `src/lib/format.ts`: harian 25rb / bulanan 450rb / tahunan 5jt; nilai yang diketik manual TIDAK ditimpa saat kategori diubah, dan teks acuan tampil di bawah kolom tarif), filter kategori (pill), pencarian, tombol QR per baris (dialog kartu QR + unduh PNG + cetak kartu), pengingat WA, hapus dengan konfirmasi
- `/pembayaran` Konfirmasi Pembayaran: tab Menunggu/Lunas/Semua, konfirmasi 1-klik (lunas), tolak, hapus, catat pembayaran baru (dialog, tarif prefill), kuitansi (status lunas), Ekspor Excel berfilter, **Tagihan Massal** (dialog ringkasan jumlah penyewa bulanan + estimasi nilai sebelum diterbitkan), pengingat WA pada tagihan menunggu
- `/tunggakan` Rekap Tunggakan: 3 kartu agregat (total tunggakan, penyewa telat, keterlambatan terlama) + tabel urut telat terlama dengan badge warna (≥30 hari merah, ≥7 hari amber, sisanya netral), konfirmasi cepat & pengingat WA per baris
- `/scan-qr` Pindai QR: kamera html5-qrcode (tombol Aktifkan Kamera; HTTPS/localhost saja), fallback input manual Nomor ID; hasil = dossier penyewa + tagihan/riwayat + konfirmasi + catat pembayaran + pengingat WA
- `/riwayat` Riwayat Aktivitas: timeline siapa/apa/kapan, filter per entitas
- `/pengaturan` Pengaturan Akun: ganti password + info akun & keamanan
- `/login` Login pengelola (di luar shell)
- Shell: `src/components/AppShell.tsx` (sidebar gelap + drawer mobile + topbar jam WITA + badge jumlah menunggu)

## QR payload
JSON `{"nomor_id":"LPK-JMB-001","nama":"I Wayan Sudira"}` — hanya Nama Lengkap & Nomor ID. Scanner mem-parse JSON (fallback: teks mentah sebagai nomor_id) lalu GET `/tenants/by-nomor/...`.

## Seed
`cd /app/backend && python seed.py` — idempotent (reset & insert ulang): 14 penyewa (nama Bali, Blok A Pangan/B Sayur/C Daging & Ikan/D Pakaian & Canang), 49 pembayaran: lunas 6 bulan terakhir (untuk grafik & kuitansi), tagihan menunggu bulan berjalan, plus **3 tunggakan sengaja lewat tempo** (1/2/3 bulan lalu pada 3 penyewa bulanan) agar Rekap Tunggakan punya data nyata. Counter `counters.lapak_seq` diset = jumlah penyewa sehingga nomor berikutnya LPK-JMB-015. Penyewa berhenti: LPK-JMB-011.
`cd /app/backend && python seed.py` — idempotent (reset & insert ulang): 14 penyewa (nama Bali, Blok A Pangan/B Sayur/C Daging & Ikan/D Pakaian & Canang), 46 pembayaran (lunas 6 bulan terakhir untuk grafik, tagihan menunggu untuk alur konfirmasi). Penyewa berhenti: LPK-JMB-011.

## Catatan verifikasi
- Tier-1 lolos: curl smoke 9/9 (stat, list, create auto-ID, update, payment+confirm, 404 by-nomor, 422 kategori invalid, delete, public URL), `yarn typecheck` bersih, alur browser penuh (create→QR→delete→confirm→scan manual) tanpa console error.
- Bug terverifikasi & diperbaiki: QR canvas kosong (node-qrcode `toCanvas` + timing ref dialog) → diganti `toDataURL` + `<img>`.
