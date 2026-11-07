import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Tags } from "lucide-react";
import { apiGet } from "@/services/api";
import { formatRupiah } from "@/utils/format";
import type { HargaBarang } from "@/types";

const RINGKAS_MAKS = 8;

// Papan "Informasi Harga Barang" publik. Diperbarui otomatis tiap 30 detik.
export default function HargaBarangSection({ ringkas = false }: { ringkas?: boolean }) {
  const { data } = useQuery({
    queryKey: ["publik", "harga-barang"], queryFn: () => apiGet<HargaBarang[]>("/publik/harga-barang"), refetchInterval: 30_000,
  });
  if (ringkas && !data?.length) return null;
  const items = ringkas ? (data ?? []).slice(0, RINGKAS_MAKS) : data ?? [];

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" id="harga-barang" data-testid="section-harga-barang">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand"><Tags className="size-4" /> Papan Harga Terkini</p>
          {ringkas ? <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Informasi Harga Barang</h2>
            : <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl" data-testid="judul-harga-barang">Informasi Harga Barang</h1>}
        </div>
        {ringkas && (data?.length ?? 0) > RINGKAS_MAKS && (
          <Link to="/harga-barang" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline" data-testid="link-semua-harga">Lihat semua <ArrowRight className="size-4" /></Link>
        )}
      </div>
      {data?.length === 0 && <p className="mt-6 text-sm text-slate-500" data-testid="harga-kosong">Belum ada informasi harga.</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="daftar-harga-publik">
        {items.map((h) => (
          <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow duration-200 hover:shadow-md" data-testid={`harga-publik-${h.id}`}>
            <p className="font-semibold text-slate-900">{h.nama}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-brand">{formatRupiah(h.harga)}</p>
            <p className="text-xs text-slate-500">per {h.satuan}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
