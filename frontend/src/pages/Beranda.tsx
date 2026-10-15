import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Landmark, LogIn, MapPin, Store } from "lucide-react";
import { BRANDING } from "@/config";
import { apiGet } from "@/lib/api";
import { KATEGORI_LABEL } from "@/lib/format";
import type { KategoriSewa, LapakPublik } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LapakCard from "@/components/LapakCard";
import DaftarLapakDialog from "@/components/DaftarLapakDialog";

const FILTERS: Array<KategoriSewa | "semua"> = ["semua", "harian", "bulanan", "tahunan"];

export default function Beranda() {
  const [filter, setFilter] = useState<KategoriSewa | "semua">("semua");
  const [dipilih, setDipilih] = useState<LapakPublik | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["publik", "lapak-kosong"],
    queryFn: () => apiGet<LapakPublik[]>("/publik/lapak-kosong"),
  });
  const list = useMemo(
    () => (data ?? []).filter((l) => filter === "semua" || l.kategori === filter),
    [data, filter]
  );

  return (
    <div className="min-h-svh bg-background">
      <PublicHeader />
      <Hero total={data?.length ?? 0} />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" id="katalog">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground md:text-lg">Lapak tersedia</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pilih lapak lalu isi formulir pendaftaran singkat.</p>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="filter-kategori">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                data-testid={`filter-${f}`}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                  filter === f
                    ? "border-slate-900 bg-slate-900 text-amber-400"
                    : "border-border bg-card text-foreground hover:border-slate-400"
                )}
              >
                {f === "semua" ? "Semua" : KATEGORI_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {isPending && <p className="text-sm text-muted-foreground" data-testid="katalog-loading">Memuat lapak...</p>}
          {isError && <p className="text-sm text-red-600" data-testid="katalog-error">Gagal memuat daftar lapak.</p>}
          {!isPending && !isError && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center" data-testid="katalog-kosong">
              <Store className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada lapak kosong untuk kategori ini.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="katalog-grid">
            {list.map((l, i) => (
              <LapakCard key={l.id} lapak={l} index={i} onDaftar={() => setDipilih(l)} />
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        {BRANDING.namaPasar} • {BRANDING.namaDesa}
      </footer>
      <DaftarLapakDialog lapak={dipilih} onClose={() => setDipilih(null)} />
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500 text-slate-900">
          <Landmark className="size-5" />
        </span>
        <span className="text-sm font-bold text-white" data-testid="publik-brand">{BRANDING.namaDesa}</span>
        <Link
          to="/login"
          data-testid="btn-masuk-pengelola"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white")}
        >
          <LogIn data-icon="inline-start" className="size-4" />
          Masuk Pengelola
        </Link>
      </div>
    </header>
  );
}

function Hero({ total }: { total: number }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #f59e0b 0 1px, transparent 1px 22px)" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <MapPin className="size-3.5" /> {BRANDING.namaPasar}
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-3 duration-700">
          Sewa lapak pasar, <span className="text-amber-400">tanpa antre.</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm text-slate-300 sm:text-base animate-in fade-in duration-1000">
          Lihat lapak yang sedang kosong beserta tarifnya, daftar online, lalu konfirmasi ke admin lewat WhatsApp.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#katalog" data-testid="btn-lihat-lapak" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
            Lihat lapak kosong
          </a>
          <span className="font-mono text-sm text-slate-400" data-testid="jumlah-lapak-kosong">
            <span className="text-2xl font-semibold text-white">{total}</span> lapak tersedia
          </span>
        </div>
      </div>
    </section>
  );
}
