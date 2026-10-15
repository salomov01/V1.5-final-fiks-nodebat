// Mirror tangan dari model Pydantic di backend/models/ — jaga sinkron di edit yang sama.

// Mirror Activity di backend/models/activity.py
export interface Activity {
  id: string;
  actor: string;
  action: string; // buat | ubah | hapus | konfirmasi | tolak
  entity: string; // penyewa | pembayaran | akun
  entity_id: string;
  label: string;
  detail: string;
  created_at: string;
}

// Mirror MeOutput di backend/routers/auth.py
export interface MeOutput {
  username: string;
  /** true selama password masih nilai bawaan .env (belum pernah diganti). */
  password_bawaan: boolean;
}

export type KategoriSewa = "harian" | "bulanan" | "tahunan";
export type StatusPenyewa = "aktif" | "berhenti";
export type MetodeBayar = "tunai" | "qris" | "transfer";
export type StatusBayar = "menunggu" | "lunas" | "ditolak";

export interface Tenant {
  id: string;
  nomor_id: string;
  nama_lengkap: string;
  no_hp: string;
  kategori: KategoriSewa;
  blok: string;
  tarif: number;
  mulai: string;
  selesai: string;
  status: StatusPenyewa;
  catatan: string;
  created_at: string;
}

export interface TenantCreate {
  nomor_id?: string; // kosong -> digenerate otomatis backend
  nama_lengkap: string;
  no_hp?: string;
  kategori: KategoriSewa;
  blok: string;
  tarif: number;
  mulai: string;
  selesai: string;
  status?: StatusPenyewa;
  catatan?: string;
}

export interface TenantUpdate {
  nama_lengkap?: string;
  no_hp?: string;
  kategori?: KategoriSewa;
  blok?: string;
  tarif?: number;
  mulai?: string;
  selesai?: string;
  status?: StatusPenyewa;
  catatan?: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  nomor_id: string;
  nama_lengkap: string;
  periode: string;
  jumlah: number;
  metode: MetodeBayar;
  status: StatusBayar;
  jatuh_tempo: string;
  catatan: string;
  penagih: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface Penagih {
  id: string;
  nama: string;
  created_at: string;
}

export interface PaymentCreate {
  tenant_id: string;
  periode: string;
  jumlah: number;
  metode: MetodeBayar;
  jatuh_tempo?: string;
  catatan?: string;
  penagih?: string;
}

// Mirror OverduePayment / OverdueSummary / BulkBillResult di backend/models/payment.py
export interface OverduePayment extends Payment {
  hari_telat: number;
  kategori: string;
  blok: string;
  no_hp: string;
}

export interface OverdueSummary {
  periode_hari_ini: string;
  jumlah_penyewa: number;
  total_tunggakan: number;
  telat_terlama: number;
  items: OverduePayment[];
}

export interface BulkBillResult {
  periode: string;
  dibuat: number;
  dilewati: number;
  total_nilai: number;
}

export interface RevenuePoint {
  label: string;
  total: number;
}

export interface DashboardStats {
  total_penyewa: number;
  penyewa_aktif: number;
  tagihan_menunggu: number;
  nilai_menunggu: number;
  pemasukan_bulan_ini: number;
  pemasukan_bulan_lalu: number;
  by_kategori: Record<string, number>;
  revenue_6m: RevenuePoint[];
  recent_payments: Payment[];
  generated_at: string;
}

export interface LapakPublik {
  id: string;
  blok: string;
  jenis: string;
  kategori: KategoriSewa;
  tarif: number;
  deskripsi: string;
}

export interface LapakUnit extends LapakPublik {
  status: "kosong" | "terisi";
  terisi_sampai: string | null;
  created_at: string;
}

export interface Pendaftaran {
  id: string;
  nama: string;
  no_hp: string;
  lapak_id: string;
  blok: string;
  jenis: string;
  kategori: KategoriSewa;
  tarif: number;
  catatan: string;
  status: "baru" | "diterima" | "ditolak";
  tenant_nomor_id: string | null;
  created_at: string;
}
