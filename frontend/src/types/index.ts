// Mirror tangan dari model Pydantic di backend/models/pasar.py — jaga sinkron di edit yang sama.

export type Role = "super_admin" | "staff";

export interface MeOutput {
  id: string;
  nama: string;
  username: string;
  role: Role;
  password_bawaan: boolean; // true selama password masih password contoh lama
}

export interface UserAccount {
  id: string;
  nama: string;
  username: string;
  role: Role;
  aktif: boolean;
  gaji_bulanan: number;
}

export type KategoriPengeluaran = "barang" | "jasa" | "daya" | "operasional" | "gaji";

export interface Pengeluaran {
  id: string;
  kategori: KategoriPengeluaran;
  keterangan: string;
  jumlah: number;
  tanggal: string;
  pemungut_id: string | null;
  penerima: string;
  periode_gaji: string | null;
  dicatat_oleh: string;
  created_at: string;
}

export interface HargaBarang {
  id: string;
  nama: string;
  satuan: string;
  harga: number;
  updated_at: string;
}

export interface Pedagang {
  id: string;
  user_id: string; // [NO_URUT]-[3 digit akhir KTP], isi QR permanen
  nama: string;
  nik: string;
  no_hp: string;
  alamat: string;
  aktif: boolean;
  created_at: string;
}

export interface PedagangRingkas {
  id: string;
  user_id: string;
  nama: string;
}

export interface LapakPublik {
  id: string;
  nama: string;
  jenis: string;
  harga_sewa: number; // per bulan
  iuran: number; // per hari
  deskripsi: string;
  foto_url: string | null;
}

export interface LapakAdmin extends LapakPublik {
  status: "kosong" | "terisi";
  penyewa: string | null;
  terisi_sampai: string | null;
}

export interface Sewa {
  id: string;
  pedagang_id: string | null;
  user_id: string | null;
  nama: string;
  no_hp: string;
  lapak_id: string;
  lapak_nama: string;
  mulai: string;
  selesai: string;
  hari: number;
  harga_sewa: number;
  iuran: number;
  total_harga: number;
  status: "menunggu" | "aktif" | "ditolak";
  sumber: "publik" | "admin";
  catatan: string;
  terbayar: number;
  sisa: number;
  created_at: string;
}

export interface Payment {
  id: string;
  jenis: "iuran" | "sewa";
  sewa_id: string;
  pedagang_id: string;
  user_id: string;
  nama: string;
  lapak_nama: string;
  periode: string;
  jumlah: number;
  tanggal: string;
  penagih: string;
  status: "lunas";
  created_at: string;
}

export interface Kuitansi {
  payment: Payment;
  no_hp: string;
  alamat: string;
  sisa_sewa: number | null;
}

export interface PaymentList {
  items: Payment[];
  total_sewa: number | null; // null untuk Staf Pemungut Iuran
  total_iuran: number | null;
  total: number | null;
}

export interface ScanResult {
  pedagang: Pedagang;
  sewa: (Sewa & { iuran_hari_ini_lunas: boolean })[];
  tanggal: string;
}

export interface DashboardStats {
  jumlah_pedagang: number;
  jumlah_lapak: number;
  lapak_terisi: number;
  sewa_menunggu: number;
  iuran_hari_ini: number;
  sewa_aktif: number;
  pemasukan_hari_ini: number | null;
  pemasukan_bulan_ini: number | null;
  grafik_6_bulan: { label: string; sewa: number; iuran: number }[] | null;
}

export interface InfoPasar {
  jam_buka: string;
  jam_tutup: string;
  mode: "otomatis" | "buka" | "tutup";
  pengumuman: string;
  buka_sekarang: boolean;
}

export interface Berita {
  id: string;
  judul: string;
  isi: string;
  tanggal: string;
}
