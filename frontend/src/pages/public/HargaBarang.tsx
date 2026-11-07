import PublicLayout from "@/components/layout/PublicLayout";
import HargaBarangSection from "@/components/home/HargaBarangSection";

// Halaman publik Informasi Harga Barang (dikelola Super Admin di /dashboard/harga-barang).
export default function HargaBarang() {
  return (
    <PublicLayout>
      <HargaBarangSection />
    </PublicLayout>
  );
}
