# PANDUAN PENGELOLAAN WEB
## Sistem Pendataan Lapak & Pembayaran — Desa Adat Jimbaran

Dokumen ini untuk **pengelola pasar** (bukan hanya programmer). Isinya: bagian mana
saja yang boleh diubah, cara mengubahnya, dan cara mengelola database.

- Alamat web: https://lapak-payment-hub.preview.emergentagent.com
- Login: **pengelola** / **jimbaran2026** (ganti lewat menu *Pengaturan*)

---

## 1. ATURAN EMAS (baca dulu)

| Boleh diubah bebas | Jangan diubah kalau tidak paham |
|---|---|
| `frontend/src/config.ts` — teks & angka tampilan | folder `frontend/src/components/ui/` |
| `backend/lib/config.py` — aturan server | `backend/server.py` baris paling bawah |
| `backend/.env` — database & zona waktu | `frontend/src/lib/api.ts` |
| `backend/seed.py` — data contoh | `backend/lib/db.py` bagian INDEXES |

**Prinsip:** ubah **nilainya** saja (teks di dalam tanda kutip atau angka),
jangan ubah **nama** yang ada di sebelah kirinya.

Contoh benar:
```ts
namaDesa: "Desa Adat Kuta",   // BENAR - hanya isi teks yang diubah
```
Contoh salah:
```ts
namaDesaBaru: "Desa Adat Kuta",   // SALAH - nama di kiri ikut diubah
```

---

## 2. PETA FOLDER (mana file apa)

```
/app
├── PANDUAN.md              <-- dokumen ini
│
├── frontend/               TAMPILAN WEB (yang dilihat pengguna)
│   ├── index.html          judul tab browser
│   └── src/
│       ├── config.ts       *** PUSAT PENGATURAN TAMPILAN ***
│       ├── index.css       warna & font
│       ├── App.tsx         daftar halaman (routing)
│       ├── pages/          satu file = satu halaman menu
│       │   ├── Dashboard.tsx    halaman Dashboard
│       │   ├── Lapak.tsx        halaman Pendataan Lapak
│       │   ├── Pembayaran.tsx   halaman Konfirmasi Pembayaran
│       │   ├── Tunggakan.tsx    halaman Rekap Tunggakan
│       │   ├── ScanQr.tsx       halaman Pindai QR
│       │   ├── Riwayat.tsx      halaman Riwayat Aktivitas
│       │   ├── Pengaturan.tsx   halaman Pengaturan (ganti password)
│       │   └── Login.tsx        halaman Login
│       ├── components/     bagian yang dipakai berulang
│       │   ├── AppShell.tsx         sidebar + topbar (menu)
│       │   ├── TenantFormDialog.tsx form tambah/ubah penyewa
│       │   ├── QrCardDialog.tsx     kartu QR + cetak
│       │   ├── ReceiptDialog.tsx    kuitansi resmi
│       │   ├── ExportDialog.tsx     dialog ekspor Excel
│       │   └── PaymentRecordDialog.tsx  form catat pembayaran
│       └── lib/            alat bantu
│           ├── format.ts   format Rupiah & tanggal
│           ├── whatsapp.ts isi pesan pengingat WhatsApp
│           ├── types.ts    bentuk data (harus sama dengan backend)
│           └── api.ts      penghubung ke server (jangan diubah)
│
└── backend/                SERVER & DATABASE
    ├── .env                *** DATABASE, ZONA WAKTU, PASSWORD AWAL ***
    ├── server.py           titik awal server
    ├── seed.py             pengisi data contoh
    ├── lib/
    │   ├── config.py       *** PUSAT PENGATURAN SERVER ***
    │   ├── db.py           koneksi database + index
    │   ├── dates.py        perhitungan "hari ini"
    │   ├── security.py     pengaman password
    │   └── activity.py     pencatat riwayat aktivitas
    ├── models/             bentuk data yang disimpan
    │   ├── tenant.py       data penyewa
    │   ├── payment.py      data pembayaran
    │   └── activity.py     data riwayat
    └── routers/            alamat API (fungsi server)
        ├── tenants.py      CRUD penyewa
        ├── payments.py     pembayaran, tunggakan, tagihan massal
        ├── dashboard.py    angka statistik
        ├── laporan.py      ekspor Excel
        ├── activities.py   riwayat aktivitas
        └── auth.py         login & ganti password
```

---

## 3. TABEL CEPAT: "SAYA MAU UBAH ..., DI MANA?"

| Yang ingin diubah | File | Nama pengaturan |
|---|---|---|
| Nama desa di sidebar/login/kuitansi | `frontend/src/config.ts` | `namaDesa` |
| Nama pasar | `frontend/src/config.ts` | `namaPasar` |
| Versi aplikasi di sidebar | `frontend/src/config.ts` | `versi` |
| Jabatan penanda tangan kuitansi | `frontend/src/config.ts` | `jabatanPenandatangan` |
| Zona waktu tampilan jam | `frontend/src/config.ts` | `zonaWaktu`, `labelZonaWaktu` |
| Tarif otomatis per kategori | `frontend/src/config.ts` **dan** `backend/lib/config.py` | `TARIF_DEFAULT` |
| Isi pesan pengingat WhatsApp | `frontend/src/config.ts` | `PESAN_WA` |
| Tanggal jatuh tempo tagihan bulanan | `backend/lib/config.py` | `JATUH_TEMPO_TANGGAL_BULANAN` |
| Judul di file Excel | `backend/lib/config.py` | `JUDUL_LAPORAN_EXCEL` |
| Zona waktu perhitungan tanggal | `backend/.env` | `APP_TZ` |
| Alamat database | `backend/.env` | `MONGO_URL`, `DB_NAME` |
| Password login | lewat web: menu **Pengaturan** | — |
| Judul tab browser | `frontend/index.html` | `<title>` |
| Warna tema | `frontend/src/index.css` | `--primary` dll |
| Nama & urutan menu sidebar | `frontend/src/components/AppShell.tsx` | daftar `NAV` |

---

## 4. CARA MENGUBAH (langkah demi langkah)

### 4.1 Ganti nama desa / pasar / penanda tangan
1. Buka `frontend/src/config.ts`
2. Ubah isi tanda kutip pada `namaDesa`, `namaPasar`, `jabatanPenandatangan`
3. Simpan. Web berubah sendiri dalam ± 2 detik (tidak perlu restart)

### 4.2 Ganti tarif acuan sewa
Tarif ada di **dua** tempat dan **harus sama**:
1. `frontend/src/config.ts` -> `TARIF_DEFAULT`
2. `backend/lib/config.py` -> `TARIF_DEFAULT`

```ts
export const TARIF_DEFAULT = {
  harian: 30_000,      // dari 25.000 menjadi 30.000
  bulanan: 500_000,
  tahunan: 6_000_000,
};
```
Catatan: mengubah tarif **tidak** mengubah data penyewa lama. Tarif lama tetap,
kecuali diubah manual lewat tombol *Ubah* pada baris penyewa.

### 4.3 Ganti tanggal jatuh tempo tagihan bulanan
`backend/lib/config.py`:
```python
JATUH_TEMPO_TANGGAL_BULANAN = 10   # ubah ke 5, 15, 20, dst (1-28)
```
Berlaku untuk tagihan baru dari tombol **Tagihan Massal**.

### 4.4 Ganti isi pesan WhatsApp
`frontend/src/config.ts` bagian `PESAN_WA`. Penanda berikut otomatis diganti:

| Penanda | Menjadi |
|---|---|
| `{nama}` | Nama lengkap penyewa |
| `{blok}` | Blok / nomor lapak |
| `{nomorId}` | Nomor ID penyewa |
| `{namaPasar}` | Isi `namaPasar` |
| `{namaDesa}` | Isi `namaDesa` |

### 4.5 Ganti password login
Cara benar: buka web -> menu **Pengaturan** -> isi password lama & baru -> Simpan.
Password tersimpan dalam bentuk terenkripsi di database.

> Penting: setelah pertama kali login, mengubah `ADMIN_PASSWORD` di `.env`
> **tidak lagi** berpengaruh. Kalau password lupa, lihat bagian 6.4.

### 4.6 Ganti zona waktu
Ubah di **dua** tempat agar seragam:
1. `backend/.env` -> `APP_TZ="Asia/Makassar"` (ini yang dipakai menghitung tanggal)
2. `frontend/src/config.ts` -> `zonaWaktu` & `labelZonaWaktu` (tampilan jam)

| Wilayah | APP_TZ | Label |
|---|---|---|
| Bali, NTB, Kalsel | `Asia/Makassar` | WITA |
| Jawa, Sumatra | `Asia/Jakarta` | WIB |
| Papua, Maluku | `Asia/Jayapura` | WIT |

Setelah mengubah `.env` wajib restart: `sudo supervisorctl restart backend`

### 4.7 Menambah / mengubah menu sidebar
`frontend/src/components/AppShell.tsx`, cari daftar `NAV` di bagian atas:
```tsx
{ to: "/tunggakan", label: "Rekap Tunggakan", icon: AlarmClock },
```
`label` = tulisan menu, `to` = alamat halaman. Halaman baru juga harus
didaftarkan di `frontend/src/App.tsx`.

---

## 5. DATABASE (bagian terpenting)

### 5.1 Database apa yang dipakai sekarang?
**MongoDB**, berjalan di dalam server yang sama (dalam satu "pod"). Tidak perlu
instalasi terpisah. Pengaturannya ada di `backend/.env`:

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="app"       # nama database, lihat backend/.env
```

### 5.2 Isi database (daftar tabel / "collection")

| Collection | Isi | Field penting |
|---|---|---|
| `tenants` | Data penyewa lapak | `nomor_id`, `nama_lengkap`, `no_hp`, `kategori`, `blok`, `tarif`, `mulai`, `selesai`, `status` |
| `payments` | Data pembayaran/tagihan | `tenant_id`, `nama_lengkap`, `periode`, `jumlah`, `metode`, `status`, `jatuh_tempo`, `confirmed_at` |
| `activities` | Riwayat aktivitas | `actor`, `action`, `entity`, `label`, `created_at` |
| `admins` | Akun pengelola (password terenkripsi) | `username`, `password_hash` |
| `sessions` | Sesi login aktif (hapus sendiri setelah 7 hari) | `token`, `username` |
| `counters` | Penomoran otomatis `LPK-JMB-###` | `lapak_seq` |

Arti `status` pada `payments`: `menunggu` (belum dikonfirmasi), `lunas` (sudah), `ditolak`.
Arti `kategori` pada `tenants`: `harian`, `bulanan`, `tahunan`.

### 5.3 Melihat isi database
```bash
mongosh app                      # masuk ke database
db.tenants.find().limit(5)                   # lihat 5 penyewa
db.payments.countDocuments({status:"menunggu"})   # hitung tagihan menunggu
db.tenants.find({kategori:"bulanan"})        # cari penyewa bulanan
exit
```

### 5.4 Mencadangkan (backup) & memulihkan (restore)
```bash
# Backup ke folder /app/backup
mongodump --db app --out /app/backup

# Restore dari cadangan
mongorestore --db app /app/backup/app
```
Lakukan backup **sebelum** melakukan perubahan besar.

### 5.5 Mengganti ke database MongoDB lain (mis. MongoDB Atlas / server desa)
1. Siapkan alamat koneksi dari penyedia, bentuknya:
   `mongodb+srv://pengguna:sandi@alamat-server/`
2. Buka `backend/.env`, ganti dua baris ini:
   ```
   MONGO_URL="mongodb+srv://pengguna:sandi@alamat-server/"
   DB_NAME="app"       # nama database, lihat backend/.env
   ```
3. Restart server:
   ```bash
   sudo supervisorctl restart backend
   ```
4. Isi data awal bila database masih kosong:
   ```bash
   cd /app/backend && python seed.py
   ```
> Tidak ada kode yang perlu diubah — cukup dua baris di `.env`.

### 5.6 Kalau ingin pindah ke MySQL / PostgreSQL
Jujur saja: ini **bukan** pekerjaan satu baris. Aplikasi ini memakai MongoDB
(motor). Pindah ke MySQL/PostgreSQL berarti:

1. Mengganti `backend/lib/db.py` (koneksi) ke SQLAlchemy/`asyncpg`
2. Membuat tabel SQL sesuai daftar di bagian 5.2
3. Mengganti perintah database di `backend/routers/*.py`
   (`find_one` -> `SELECT`, `insert_one` -> `INSERT`, dst)
4. Menulis ulang `seed.py`

Yang **tidak** perlu diubah: seluruh `frontend/` dan bentuk data di `models/`.
Karena tampilan hanya berbicara dengan alamat `/api/...`, database di belakang
boleh apa saja selama jawaban API-nya sama. Sampaikan saja kalau ingin dibantu
melakukan migrasi ini.

### 5.7 Data contoh & mengosongkan data
```bash
cd /app/backend && python seed.py
```
Perintah ini **menghapus** data penyewa & pembayaran lama, lalu mengisi ulang
14 penyewa + 49 pembayaran contoh (termasuk 3 tunggakan untuk demo).

Untuk memakai data asli desa: kosongkan dulu, lalu input lewat web.
```bash
mongosh app --eval 'db.tenants.deleteMany({}); db.payments.deleteMany({}); db.counters.updateOne({_id:"lapak_seq"},{$set:{seq:0}},{upsert:true})'
```
Setelah itu nomor ID akan dimulai kembali dari `LPK-JMB-001`.

Mengubah daftar data contoh: `backend/seed.py`, bagian `TENANTS` di atas berisi
baris `("Nama", "No HP", "kategori", "Blok", tarif, "status")`.

---

## 6. MENJALANKAN & MENGATASI MASALAH

### 6.1 Perintah harian
```bash
sudo supervisorctl status                     # lihat semua layanan
sudo supervisorctl restart backend            # restart server saja
sudo supervisorctl restart frontend backend   # restart semuanya
tail -50 /var/log/supervisor/backend.err.log  # lihat pesan error server
```
Kapan perlu restart?
- Ubah `backend/.env` -> **perlu** restart backend
- Ubah file `.py` atau `.ts`/`.tsx` -> **tidak perlu**, otomatis

### 6.2 Web tidak bisa dibuka / halaman kosong
1. `sudo supervisorctl status` — pastikan semua `RUNNING`
2. `tail -50 /var/log/supervisor/backend.err.log` — baca baris paling bawah
3. Biasanya karena salah tulis di `config.py` atau `config.ts`
   (tanda kutip kurang, koma hilang). Perbaiki lalu restart.

### 6.3 Data tidak muncul / selalu "memuat"
Cek server menjawab:
```bash
curl http://localhost:8001/api/
```
Kalau tidak menjawab, restart backend dan periksa `MONGO_URL` di `.env`.

### 6.4 Lupa password pengelola
Hapus akun tersimpan, lalu sistem membuatnya lagi dari `.env`:
```bash
mongosh app --eval 'db.admins.deleteMany({}); db.sessions.deleteMany({})'
```
Setelah itu login memakai `ADMIN_USERNAME` / `ADMIN_PASSWORD` yang ada di
`backend/.env` (bawaan: `pengelola` / `jimbaran2026`).

### 6.5 Kamera pemindai QR tidak jalan
Kamera hanya diizinkan browser pada alamat **https** atau `localhost`.
Pastikan membuka alamat https, dan izinkan akses kamera saat diminta.
Kalau tetap tidak bisa, gunakan kolom **input manual Nomor ID** di halaman Pindai QR.

---

## 7. DAFTAR ALAMAT API (untuk developer)

Semua diawali `/api` dan **wajib login** (kecuali login itu sendiri).

| Metode | Alamat | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | Masuk |
| GET | `/api/auth/me` | Cek sesi |
| POST | `/api/auth/logout` | Keluar |
| POST | `/api/auth/change-password` | Ganti password |
| GET | `/api/tenants` | Daftar penyewa (`?q=` cari, `?kategori=`) |
| POST | `/api/tenants` | Tambah penyewa (Nomor ID otomatis) |
| PUT | `/api/tenants/{id}` | Ubah penyewa |
| DELETE | `/api/tenants/{id}` | Hapus penyewa + pembayarannya |
| GET | `/api/tenants/by-nomor/{nomor_id}` | Cari untuk hasil pindai QR |
| GET | `/api/payments` | Daftar pembayaran (`?status=`, `?tenant_id=`) |
| POST | `/api/payments` | Catat pembayaran |
| PATCH | `/api/payments/{id}/confirm` | Konfirmasi (jadi lunas) |
| PATCH | `/api/payments/{id}/reject` | Tolak |
| DELETE | `/api/payments/{id}` | Hapus |
| GET | `/api/payments/overdue` | Rekap tunggakan + lama telat |
| POST | `/api/payments/bulk-monthly` | Tagihan massal bulanan |
| GET | `/api/dashboard/stats` | Angka dashboard |
| GET | `/api/laporan/pembayaran.xlsx` | Ekspor Excel (`?bulan=`, `?kategori=`, `?status=`) |
| GET | `/api/activities` | Riwayat aktivitas |

Aturan saat menambah fitur baru:
1. Model data baru -> `backend/models/`
2. Alamat API baru -> `backend/routers/`, lalu daftarkan di `server.py`
   **di atas** baris `app.include_router(api_router)`
3. Bentuk data di `frontend/src/lib/types.ts` harus disamakan dengan model Python
4. Halaman baru -> `frontend/src/pages/`, daftarkan di `App.tsx` dan `AppShell.tsx`

---

## 8. CATATAN PENTING

- **QR Code** hanya menyimpan `Nama Lengkap` dan `Nomor ID` (sesuai permintaan),
  tidak menyimpan data uang/pembayaran.
- **Pengingat WhatsApp** memakai tautan `wa.me` biasa — tidak ada biaya, tidak perlu
  API key. Pesan terbuka di aplikasi WhatsApp pengelola untuk dikirim manual.
- **Tagihan Massal** aman ditekan berulang: penyewa yang sudah punya tagihan bulan
  itu otomatis dilewati (tidak dobel).
- **Riwayat Aktivitas** mencatat semua perubahan beserta pelaku dan waktunya —
  berguna untuk pertanggungjawaban ke prajuru desa.
- Perhitungan "hari ini" selalu memakai **jam server** sesuai `APP_TZ`, bukan jam
  HP/laptop pengguna, supaya tunggakan tidak salah hitung.

| Dokumen lain | Isi |
|---|---|
| `memory/SPEC.md` | Ringkasan teknis sistem (untuk developer) |
| `memory/test_credentials.md` | Catatan kredensial login |
| `README.md`, `TEMPLATE.md` | Dokumen teknis kerangka aplikasi |

---

## 9. KEAMANAN (hasil audit & apa yang harus Anda lakukan)

### 9.1 WAJIB DILAKUKAN SEKARANG: ganti password
Selama password masih nilai bawaan, aplikasi menampilkan **peringatan merah** di
Dashboard dan halaman Pengaturan. Siapa pun yang membaca dokumen ini bisa masuk
dan melihat seluruh data penyewa (termasuk nomor HP) serta data pembayaran.

Langkah: buka web -> menu **Pengaturan** -> isi password lama & password baru
(minimal 8 karakter) -> Simpan. Peringatan merah akan hilang sendiri.

Gunakan password yang: minimal 12 karakter, gabungan huruf-angka, dan **tidak**
dipakai di layanan lain. Setelah diganti, sesi di perangkat lain otomatis dicabut.

### 9.2 Perlindungan yang sudah aktif

| Perlindungan | Keterangan |
|---|---|
| Password disimpan ter-enkripsi | PBKDF2-SHA256 200.000 iterasi + salt per akun. Password asli tidak pernah disimpan |
| Sesi aman | Cookie `HttpOnly` + `Secure`, berlaku 7 hari, dicabut di server saat logout |
| Semua data terkunci | Seluruh alamat `/api/...` menolak (401) tanpa sesi login |
| Anti tebak password | 5 kali gagal login dalam 15 menit -> terkunci 15 menit (429) |
| Anti serangan lintas situs (CSRF) | Permintaan dari situs lain ditolak (403); body wajib JSON (415) |
| Anti rumus jahat di Excel | Nama yang diawali `= + - @` ditulis sebagai teks, bukan rumus |
| Batas nilai | Tarif & nominal pembayaran wajib lebih dari 0 |
| Anti konfirmasi ganda | Pembayaran yang sudah lunas/ditolak tidak bisa dikonfirmasi lagi (409) |
| Header pengerasan | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Catatan audit | Semua perubahan tercatat di Riwayat Aktivitas beserta pelaku & waktu |

### 9.3 Kebiasaan aman untuk pengelola
1. Ganti password secara berkala, jangan dibagikan lewat grup WhatsApp.
2. Selalu tekan **Keluar** bila memakai komputer bersama/warnet.
3. Lakukan `mongodump` (bagian 5.4) secara berkala dan simpan salinannya.
4. Jangan menaruh screenshot berisi nomor HP penyewa di grup terbuka.
5. Bila merasa ada akses tidak sah: ganti password (otomatis mencabut semua sesi
   lain), lalu periksa menu **Riwayat Aktivitas**.

### 9.4 Jika ingin membuka API dari domain lain
Bawaan `CORS_ORIGINS="*"` sengaja **tidak** mengizinkan pengiriman cookie, demi
keamanan. Bila perlu memanggil API dari domain lain, isi daftar domain secara
eksplisit di `backend/.env` (dipisah koma), lalu restart backend:
```
CORS_ORIGINS="https://domain-anda.id,https://admin.domain-anda.id"
```
