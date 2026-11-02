# Bindes2026 — Website & Aplikasi Lapak Pasar Desa Adat Jimbaran

Website publik (Home, Info Pasar, Informasi Lapak) + panel pengelola (pedagang, lapak & iuran, sewa,
pembayaran, scan QR) dengan 2 tingkat admin.

- **Frontend**: Vite + React + TypeScript + Tailwind (`frontend/`)
- **Backend utama**: FastAPI + MongoDB (`backend/`) — dipakai di platform ini (preview & publish)
- **Backend salinan Node.js**: Express + MongoDB (`backend-node/`) — API identik, untuk Vercel / Render / VPS

---

## 1. ⭐ Cara Mengganti Nomor HP / WhatsApp Konfirmasi Sewa Lapak

Saat pengunjung menekan **Sewa** di halaman *Informasi Lapak*, setelah formulir dikirim muncul tombol
**"Kirim ke WhatsApp Admin"**. Nomor tujuannya diatur di **satu tempat saja**:

| File | Baris | Isi |
|---|---|---|
| `frontend/src/config.ts` | **37** | `whatsapp: "6281234567890",` |

Langkah:
1. Buka `frontend/src/config.ts`, cari bagian **"2. NOMOR HP / WHATSAPP ADMIN UNTUK KONFIRMASI SEWA LAPAK"** (baris 32–38).
2. Ganti `6281234567890` dengan nomor admin, format internasional **tanpa `+`, spasi, atau tanda hubung**.
   Contoh: `0812-3456-7890` → `6281234567890`.
3. Simpan, lalu build ulang frontend (`yarn build`) / tunggu hot-reload.

Isi pesan WhatsApp (nama, lapak, durasi, total sewa, kode booking, tautan konfirmasi) dapat diubah di
`frontend/src/components/lapak/SewaLapakDialog.tsx` fungsi `waLink` (baris **18–29**).

---

## 2. Alur Sistem

1. **Data Pedagang** — tambah manual (nama, NIK, HP, alamat). User ID otomatis `[NO_URUT]-[3 digit akhir KTP]`,
   mis. `01-009`. Setiap pedagang punya **QR Code permanen** (isi QR = User ID) — tombol QR di tabel untuk unduh/cetak.
2. **Data Lapak dan Iuran** — satu paket: nama lapak + harga sewa/bulan + iuran/hari (+ foto). Tombol **Tetapkan**
   = admin meng-assign pedagang ke lapak (langsung aktif). Edit langsung di tabel (ikon pensil, Super Admin).
3. **Sewa / Pendaftaran Lapak** — form sewa menampilkan harga/bulan & iuran, pencarian akun pedagang (ketik nama),
   tanggal awal–akhir, dan **total = harga per bulan ÷ 30 × jumlah hari**. Booking publik berstatus *menunggu*
   dan dikonfirmasi Super Admin / Staf Pemungut Iuran di menu **Pendaftaran Lapak**.
4. **Pindai QR** — muncul tombol **Bayar Iuran** (sekali per hari per lapak) dan **Bayar Sewa Lapak**
   (otomatis disembunyikan bila sewa sudah lunas). Nama penagih = akun yang login (readonly).
5. **Pembayaran** — laporan pemasukan Sewa & Iuran, filter **Harian / Bulanan / Tahunan** + tanggal + jenis,
   **Export Excel** & **Export PDF** (Super Admin). Kolom: Nama, ID, Periode Sewa, Harga/Jumlah, Penagih, Tanggal, Status, Jenis.

Menu admin: Dashboard → Data Pedagang → Data Lapak dan Iuran → Pendaftaran Lapak → Pembayaran → Pindai QR → Info Pasar → Settings.

## 3. Peran Admin

| Fitur | Super Admin (Tingkat 2) | Staf Pemungut Iuran (Tingkat 1) |
|---|---|---|
| Tambah pedagang / lapak, assign sewa, scan & terima bayar | ✅ | ✅ |
| Konfirmasi / tolak pendaftaran lapak | ✅ | ✅ |
| Edit / hapus data yang sudah ada, foto lapak | ✅ | ❌ |
| Total pemasukan, Export Excel/PDF | ✅ | ❌ |
| Info Pasar, kelola & **hapus akun** (Settings) | ✅ | ❌ |

Login default Super Admin dari `backend/.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`). Akun staf dibuat di **Settings**.

---

## 4. Cara Mengedit Konten Halaman Publik

| Yang diubah | Lokasi |
|---|---|
| Judul & deskripsi Hero, sejarah desa & pasar | `frontend/src/content/beranda.ts` |
| Menu Navbar | `frontend/src/components/layout/Navbar.tsx` (`MENU`) |
| Teks footer | `frontend/src/components/layout/PublicLayout.tsx` |
| Nama desa/pasar, zona waktu | `frontend/src/config.ts` (`BRANDING`) |
| Warna aksen `#1E4E42` | `frontend/src/index.css` (`--color-brand…`, `--primary`) |
| Info Pasar & berita | Panel admin → **Info Pasar** (tanpa edit kode) |

## 5. Cara Mengganti Gambar/Foto

Gambar publik ada di `frontend/src/assets/`: `logo-desa.svg`, `hero-desa.jpg`, `sejarah-desa.jpg`, `sejarah-pasar.jpg`.
Timpa file dengan nama yang sama, atau ubah path import di `frontend/src/content/beranda.ts` baris 3–5.
Foto lapak diunggah dari menu **Data Lapak dan Iuran** (klik thumbnail). Foto contoh: `frontend/src/config.ts` → `FOTO_CONTOH`.

## 6. Data Awal dari Excel

File sumber: `backend/data/pedagang.xlsx` (NAMA, NIK, NO. TELEPON, Alamat) dan `backend/data/lapak.xlsx`
(No, Nama lapak, Harga per bulan, Iuran). Untuk mengisi ulang database (menghapus pedagang/lapak/sewa/pembayaran lama,
akun login tetap):
```bash
cd backend && python seed.py
```

---

## 7. Struktur Folder

```
backend/                 # FastAPI (dipakai platform ini)
├── server.py            # Entry, semua route /api
├── seed.py, data/       # Import data Excel
├── lib/                 # db, keamanan password, rate limit, storage foto, tanggal, config
├── models/pasar.py      # Model Pedagang, Lapak, Sewa, Pembayaran
└── routers/             # auth, users, pedagang, katalog (lapak & sewa), payments (scan & bayar),
                         # laporan (Excel/PDF), dashboard, info_pasar
backend-node/            # Salinan Node.js (Express) — API & database sama
├── src/index.js         # Entry Express (+ export untuk Vercel)
├── src/db.js            # Koneksi Mongo & helper
├── src/auth.js          # Login, sesi, akun
├── src/pasar.js         # Pedagang, lapak, sewa, foto, info pasar
├── src/pembayaran.js    # Bayar iuran/sewa, scan, dashboard, ekspor Excel & PDF
├── src/storage.js       # Simpan foto lapak
└── .env.example, vercel.json
frontend/src/
├── assets/              # Logo & foto
├── content/beranda.ts   # Teks Home
├── config.ts            # Nama desa, NOMOR WA ADMIN, foto contoh
├── components/          # layout/, home/, lapak/ (LapakCard, SewaLapakDialog, QrCardDialog),
│                        # katalog/FotoCell, common/ (PedagangSearch, DefaultPasswordAlert), pengaturan/, ui/
├── pages/public/        # Home, InfoPasar, InformasiLapak
├── pages/admin/         # Dashboard, DataPedagang, DataLapak, PendaftaranLapak, Pembayaran, ScanQr,
│                        # InfoPasarAdmin, Pengaturan (Settings)
├── services/            # api.ts, session.ts, queryClient.ts
├── hooks/useAuth.ts     # Akun login & peran
├── utils/               # format.ts (Rupiah, tanggal, hitung sewa), errors.ts
└── types/index.ts
```

## 8. Menjalankan & Deploy

**Backend Python** (`backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `APP_TZ`, `ADMIN_USERNAME`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TRUSTED_PROXY_HOPS`, `EMERGENT_LLM_KEY`):
```bash
cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8001
```

**Backend Node.js** (salin `backend-node/.env.example` → `.env`, isi nilainya):
```bash
cd backend-node && npm install && npm start        # Render / Railway / VPS (port dari PORT)
```
- **Render**: New → Web Service → root `backend-node`, build `npm install`, start `npm start`, isi Environment.
- **Vercel**: import folder `backend-node` (sudah ada `vercel.json`), isi Environment Variables.
- Database: MongoDB Atlas (isi `MONGO_URL`). Hash password kompatibel dengan backend Python, jadi akun tetap bisa login.

**Frontend**: `cd frontend && yarn install && yarn build` (hasil di `dist/`). Frontend memanggil `/api/...` —
arahkan `/api` ke backend (proxy/rewrite) atau sajikan di domain yang sama.
