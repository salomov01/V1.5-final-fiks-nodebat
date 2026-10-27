# Bindes2026 — Website & Aplikasi Lapak Pasar Desa Adat Jimbaran

Website publik (Home, Info Pasar, Informasi Lapak) + panel pengelola (lapak, pembayaran, scan QR,
tunggakan, ekspor Excel) dengan 2 tingkat admin.

Stack: **FastAPI + MongoDB** (backend) & **Vite + React + TypeScript + Tailwind** (frontend).

---

## 1. Cara Mengedit Konten Dashboard (Halaman Home publik)

Semua teks halaman Home dikumpulkan dalam **satu file**: `frontend/src/content/beranda.ts`

| Yang ingin diubah | Lokasi |
|---|---|
| Judul besar Hero ("Desa Adat Jimbaran") | `src/content/beranda.ts` baris **8** (`judul`) |
| Deskripsi di bawah judul Hero | `src/content/beranda.ts` baris **9** (`subjudul`) |
| Judul "Sejarah Desa Adat Jimbaran" | `src/content/beranda.ts` baris **14** |
| Paragraf sejarah desa | `src/content/beranda.ts` baris **16–20** (array `paragraf`, 1 string = 1 paragraf) |
| Judul "Sejarah Pasar Adat Jimbaran" | `src/content/beranda.ts` baris **24** |
| Paragraf sejarah pasar | `src/content/beranda.ts` baris **26–30** |
| Teks kecil "Om Swastiastu" & tombol Hero | `src/components/home/Hero.tsx` |
| Tata letak section sejarah (foto kiri/kanan) | `src/components/home/SejarahSection.tsx` (prop `terbalik` di `src/pages/public/Home.tsx`) |
| Menu Navbar (Home, Info Pasar, Informasi Lapak, Login) | `src/components/layout/Navbar.tsx` baris **8** (`MENU`) |
| Teks footer "© 2026 Bina desa adat jimbaran..." | `src/components/layout/PublicLayout.tsx` baris **8** |
| Nama desa/pasar, zona waktu, nomor WhatsApp admin | `src/config.ts` (`BRANDING`, `KONTAK_ADMIN`) |
| Warna aksen hijau `#1E4E42` | `src/index.css` baris **11–15** (`--color-brand…`) dan `--primary` di `:root` |

**Info Pasar & berita tidak perlu edit kode.** Login sebagai Super Admin, lalu buka menu
**Info Pasar** (`/dashboard/info-pasar`) untuk mengatur jam buka/tutup, status (otomatis / paksa buka / paksa tutup),
pengumuman, dan menambah/mengubah/menghapus berita.

---

## 2. Cara Mengganti Gambar/Foto

Semua gambar halaman publik ada di folder **`frontend/src/assets/`**:

| File | Dipakai di |
|---|---|
| `logo-desa.svg` | Logo di Navbar, sidebar admin, dan halaman login |
| `hero-desa.jpg` | Latar Hero halaman Home |
| `sejarah-desa.jpg` | Foto section Sejarah Desa |
| `sejarah-pasar.jpg` | Foto section Sejarah Pasar |

**Cara termudah (tanpa ubah kode):**
1. Siapkan foto baru (disarankan JPG, lebar ±1400px, < 500 KB).
2. Beri nama **persis sama** dengan file lama (mis. `sejarah-desa.jpg`).
3. Timpa file lama di `frontend/src/assets/`.
4. Build ulang frontend (`yarn build`) / tunggu hot-reload.

**Jika nama file berbeda** (mis. `pura-desa.png`):
1. Taruh file di `frontend/src/assets/`.
2. Buka `frontend/src/content/beranda.ts` baris **3–5**, ubah path import, contoh:
   `import sejarahDesaImg from "@/assets/pura-desa.png";`

**Logo:** ganti `src/assets/logo-desa.svg` dengan logo resmi (boleh `.png` — lalu ubah import
`logo-desa.svg` di `components/layout/Navbar.tsx`, `components/layout/AppShell.tsx`, dan `pages/Login.tsx`).

**Foto lapak:** diunggah langsung dari panel admin (Pendaftaran & Katalog → tab Katalog Lapak).
Foto contoh untuk lapak tanpa foto diatur di `src/config.ts` → `FOTO_CONTOH`.

---

## 3. Struktur Folder Proyek

```
backend/
├── server.py              # Entry FastAPI, semua route diawali /api
├── .env                   # MONGO_URL, DB_NAME, ADMIN_USERNAME/EMAIL/PASSWORD, APP_TZ, ...
├── seed.py                # Isi data contoh (opsional)
├── lib/                   # Helper: db, keamanan password, rate limit, storage foto, tanggal
├── models/                # Model data (tenant, payment, katalog, dashboard, activity)
├── routers/
│   ├── auth.py            # Login, sesi, peran (super_admin / staff), ganti password
│   ├── users.py           # Kelola akun Staff/Super Admin (khusus Super Admin)
│   ├── info_pasar.py      # Status pasar & berita (publik baca, Super Admin ubah)
│   ├── katalog.py         # Lapak kosong publik, pendaftaran, katalog & foto lapak
│   ├── tenants.py         # Data penyewa
│   ├── payments.py        # Pembayaran & scan QR (penagih = akun login)
│   ├── laporan.py         # Ekspor Excel (khusus Super Admin)
│   └── dashboard.py, activities.py
└── tests/                 # Tes otomatis (pytest)

frontend/src/
├── assets/                # Gambar & logo (lihat bagian 2)
├── content/beranda.ts     # Teks Home: hero, sejarah desa, sejarah pasar
├── config.ts              # Nama desa, tarif acuan, WA admin, foto contoh lapak
├── components/
│   ├── ui/                # Komponen dasar (tombol, input, dialog — shadcn)
│   ├── layout/            # Navbar, PublicLayout (+Footer), AppShell (sidebar admin), RequireAuth
│   ├── home/              # Hero, SejarahSection
│   ├── lapak/             # LapakCard, DaftarLapakDialog, TenantFormDialog, QrCardDialog
│   ├── pembayaran/        # PaymentRecordDialog, ReceiptDialog, ExportDialog
│   ├── katalog/           # Katalog lapak, foto, daftar pendaftar
│   ├── pengaturan/        # GantiPasswordCard, UserManager
│   └── common/            # Badges, DefaultPasswordAlert
├── pages/
│   ├── public/            # Home, InfoPasar, InformasiLapak (tanpa login)
│   ├── admin/             # Dashboard, Lapak, Pembayaran, ScanQr, Tunggakan, Riwayat,
│   │                      # Pendaftaran, InfoPasarAdmin, Pengaturan (wajib login)
│   └── Login.tsx
├── services/              # api.ts (pemanggilan backend), session.ts, queryClient.ts
├── hooks/useAuth.ts       # Akun yang login + cek peran (isSuper)
├── utils/                 # format.ts (Rupiah/tanggal), whatsapp.ts, errors.ts
├── types/index.ts         # Tipe data TypeScript
└── lib/                   # utils.ts (helper shadcn) & shim ikon/grafik
```

---

## 4. Peran Admin

| Fitur | Super Admin (Tingkat 2) | Staff / Kasir (Tingkat 1) |
|---|---|---|
| Lihat semua halaman sistem | ✅ | ✅ (kecuali Info Pasar admin & kelola akun) |
| Input data baru (penyewa, tagihan, scan QR, lapak) | ✅ | ✅ |
| Ubah/hapus data yang sudah diinput | ✅ | ❌ (tombol disembunyikan + ditolak server) |
| Konfirmasi/tolak/hapus pembayaran, terima/tolak pendaftar | ✅ | ❌ |
| Ekspor Excel | ✅ | ❌ |
| Total pembayaran (pemasukan, nilai tagihan, total tunggakan) | ✅ | ❌ (disembunyikan server) |
| Kelola akun & Info Pasar | ✅ | ❌ |

Akun Super Admin dibuat otomatis dari `backend/.env` (`ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
Login bisa memakai username **atau** email. Akun Staff dibuat Super Admin di **Pengaturan → Akun Pengguna & Penagih**.

**Scan QR:** kolom "Nama Penagih" otomatis terisi nama akun yang login (readonly) dan disimpan server.

**Ekspor Excel** (menu Pembayaran → Ekspor Excel) dengan urutan kolom:
`Nama | ID | Periode Sewa | Harga/Jumlah | Penagih | Tanggal | Status`.

---

## 5. Deploy & Menjalankan

**backend/.env**
```
MONGO_URL="mongodb://<host>:27017"
DB_NAME="bindes2026"
CORS_ORIGINS="*"
APP_TZ="Asia/Makassar"
ADMIN_USERNAME="pengelola"
ADMIN_EMAIL="email-admin@domain.com"
ADMIN_PASSWORD="<password-kuat>"
TRUSTED_PROXY_HOPS=2
EMERGENT_LLM_KEY="<kunci penyimpanan foto>"
```
**frontend/.env**: `REACT_APP_BACKEND_URL="https://domain-backend-anda"`

```bash
cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8001
cd frontend && yarn install && yarn build   # hasil di dist/
```
