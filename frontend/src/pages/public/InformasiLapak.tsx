import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import PublicLayout from "@/components/layout/PublicLayout";
import { apiGet } from "@/services/api";
import { KATEGORI_LABEL } from "@/utils/format";
import type { KategoriSewa, LapakPublik } from "@/types";
import { cn } from "@/lib/utils";
import LapakCard from "@/components/lapak/LapakCard";
import DaftarLapakDialog from "@/components/lapak/DaftarLapakDialog";

const FILTERS: Array<KategoriSewa | "semua"> = ["semua", "harian", "bulanan", "tahunan"];

// Halaman publik "Informasi Lapak": daftar lapak kosong + pendaftaran (lanjut WhatsApp admin).
export default function InformasiLapak() {
  const [filter, setFilter] = useState<KategoriSewa | "semua">("semua");
  const [dipilih, setDipilih] = useState<LapakPublik | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["publik", "lapak-kosong"],
    queryFn: () => apiGet<LapakPublik[]>("/publik/lapak-kosong"),
  });
  const list = useMemo(() => (data ?? []).filter((l) => filter === "semua" || l.kategori === filter), [data, filter]);

  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" id="katalog">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" data-testid="judul-informasi-lapak">Informasi Lapak</h1>
            <p className="mt-3 text-slate-700">
              <span className="font-semibold text-brand" data-testid="jumlah-lapak-kosong">{data?.length ?? 0}</span> lapak tersedia.
              Pilih lapak lalu isi formulir pendaftaran singkat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="filter-kategori">
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} data-testid={`filter-${f}`}
                className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                  filter === f ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-900 hover:border-brand")}>
                {f === "semua" ? "Semua" : KATEGORI_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {isPending && <p className="text-sm text-slate-500" data-testid="katalog-loading">Memuat lapak...</p>}
          {isError && <p className="text-sm text-red-600" data-testid="katalog-error">Gagal memuat daftar lapak.</p>}
          {!isPending && !isError && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center" data-testid="katalog-kosong">
              <Store className="mx-auto size-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">Belum ada lapak kosong untuk kategori ini.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="katalog-grid">
            {list.map((l, i) => <LapakCard key={l.id} lapak={l} index={i} onDaftar={() => setDipilih(l)} />)}
          </div>
        </div>
      </section>
      <DaftarLapakDialog lapak={dipilih} onClose={() => setDipilih(null)} />
    </PublicLayout>
  );
}
