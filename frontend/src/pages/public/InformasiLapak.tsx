import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import PublicLayout from "@/components/layout/PublicLayout";
import { apiGet } from "@/services/api";
import type { LapakPublik } from "@/types";
import LapakCard from "@/components/lapak/LapakCard";
import SewaLapakDialog from "@/components/lapak/SewaLapakDialog";

// Halaman publik "Informasi Lapak": lapak kosong + tombol Sewa (lanjut WhatsApp admin).
export default function InformasiLapak() {
  const [dipilih, setDipilih] = useState<LapakPublik | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["publik", "lapak-kosong"],
    queryFn: () => apiGet<LapakPublik[]>("/publik/lapak-kosong"),
  });
  const list = data ?? [];

  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" id="katalog">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" data-testid="judul-informasi-lapak">Informasi Lapak</h1>
            <p className="mt-3 text-slate-700">
              <span className="font-semibold text-brand" data-testid="jumlah-lapak-kosong">{list.length}</span> lapak tersedia.
              Pilih lapak, tentukan tanggal sewa, lalu konfirmasi lewat WhatsApp.
            </p>
          </div>
          {/* Satu-satunya filter: Semua */}
          <span className="self-start rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-white sm:self-auto" data-testid="filter-semua">Semua</span>
        </div>

        <div className="mt-8">
          {isPending && <p className="text-sm text-slate-500" data-testid="katalog-loading">Memuat lapak...</p>}
          {isError && <p className="text-sm text-red-600" data-testid="katalog-error">Gagal memuat daftar lapak.</p>}
          {!isPending && !isError && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center" data-testid="katalog-kosong">
              <Store className="mx-auto size-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">Belum ada lapak kosong.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="katalog-grid">
            {list.map((l, i) => <LapakCard key={l.id} lapak={l} index={i} onSewa={() => setDipilih(l)} />)}
          </div>
        </div>
      </section>
      <SewaLapakDialog lapak={dipilih} mode="publik" onClose={() => setDipilih(null)} />
    </PublicLayout>
  );
}
