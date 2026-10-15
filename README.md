# Bindes2026 — Aplikasi Iuran / Sewa Lapak Pasar (Desa Adat Jimbaran)

Aplikasi web untuk mengelola penyewa lapak, menagih & mengonfirmasi pembayaran iuran,
cetak kartu QR, scan QR untuk penagihan di lapangan, rekap tunggakan, dan ekspor Excel.

Stack: **FastAPI + MongoDB** (backend) & **Vite + React + TypeScript + Tailwind** (frontend).

---

## 1. Struktur & Letak File Penting (untuk Deploy)

### Backend (`/app/backend/`)
| File / Folder | Fungsi |
|---|---|
| `server.py` | Entry FastAPI. Semua route di-prefix `/api`. Jalankan dgn uvicorn `server:app`. |
| `.env` | **WAJIB diisi saat deploy.** Berisi `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `APP_TZ`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. |
| `requirements.txt` | Dependensi Python (`pip install -r requirements.txt`). |
| `seed.py` | Isi data contoh: `python seed.py`. Opsional untuk produksi. |
| `lib/config.py` | Pusat setting backend (nama desa/pasar, tarif acuan, jatuh tempo, judul Excel). |
| `lib/db.py` | Koneksi Mongo + definisi index. |
| `models/` | Model data: `tenant.py`, `payment.py`, `penagih.py`, `activity.py`, `dashboard.py`. |
| `routers/` | Endpoint API: `auth.py`, `tenants.py`, `payments.py`, **`penagih.py`**, `dashboard.py`, `laporan.py`, `activities.py`. |

### Frontend (`/app/frontend/`)
| File / Folder | Fungsi |
|---|---|
| `src/config.ts` | **Pusat tampilan** (nama desa/pasar, tarif, zona waktu, pesan WhatsApp). |
| `.env` | `REACT_APP_BACKEND_URL` (URL publik backend). Build frontend memakai path relatif `/api`. |
| `vite.config.ts` | Konfigurasi Vite. `base: "/"` (ganti jika di-host pada sub-path). Proxy `/api` → backend. |
| `package.json` | Dependensi & script (`yarn install`, `yarn build`, `yarn start`). |
| `src/pages/` | Halaman: `Dashboard`, `Lapak`, `Pembayaran`, `Tunggakan`, **`ScanQr`**, `Riwayat`, **`Pengaturan`**, `Login`. |
| `src/components/` | Komponen: `QrCardDialog`, `PaymentRecordDialog`, `ReceiptDialog`, `AppShell`, dll. |

---

## 2. Variabel Lingkungan (ENV) saat Deploy

**backend/.env**
```
MONGO_URL="mongodb://<host>:27017"   # atau URI MongoDB Atlas
DB_NAME="bindes2026"
CORS_ORIGINS="*"                      # atau daftar origin dipisah koma
APP_TZ="Asia/Makassar"               # WITA. Opsi: Asia/Jakarta (WIB), Asia/Jayapura (WIT)
ADMIN_USERNAME="pengelola"
ADMIN_PASSWORD="<password-kuat>"     # dipakai sekali untuk bootstrap akun admin
```

**frontend/.env**
```
REACT_APP_BACKEND_URL="https://domain-backend-anda"
```

---

## 3. Cara Menjalankan (lokal / server)

```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py            # opsional (data contoh + daftar penagih)
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn install
yarn build               # hasil build ada di folder dist/  -> deploy sebagai static
# atau pengembangan: yarn start
```

Login awal: username `pengelola`, password sesuai `ADMIN_PASSWORD` di `.env`.

---

## 4. Fitur QR Penagihan (baru)

- **Kartu QR** (`QrCardDialog`) berisi Nomor ID + nama penyewa.
- **Scan QR** (`/scan-qr`): saat dipindai penagih, tampil **Nama Pedagang, Jenis Lapak (blok),
  Jenis Iuran (kategori + tarif)**, dropdown **pilih Penagih**, dan tombol **Sudah Bayar / Belum Bayar**.
  - *Sudah Bayar* → pembayaran periode berjalan langsung **LUNAS** + nama penagih tersimpan.
  - *Belum Bayar* → dicatat sebagai **tunggakan/menunggu** + nama penagih & tanggal kunjungan.
- **Daftar Penagih** dikelola di **Pengaturan** (tambah/hapus).
- Nama penagih tampil di tabel **Pembayaran**, **Riwayat Aktivitas**, **Kuitansi**, dan **Ekspor Excel**.
