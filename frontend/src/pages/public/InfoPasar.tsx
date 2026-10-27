import { useQuery } from "@tanstack/react-query";
import { Clock, Megaphone, Newspaper } from "lucide-react";
import PublicLayout from "@/components/layout/PublicLayout";
import { apiGet } from "@/services/api";
import { formatDateID } from "@/utils/format";
import type { Berita, InfoPasar as InfoPasarData } from "@/types";
import { cn } from "@/lib/utils";

// Halaman publik Info Pasar: status buka/tutup + berita. Isinya diatur Super Admin di /dashboard/info-pasar.
export default function InfoPasar() {
  const { data: info } = useQuery({ queryKey: ["publik", "info-pasar"], queryFn: () => apiGet<InfoPasarData>("/publik/info-pasar") });
  const { data: berita } = useQuery({ queryKey: ["publik", "berita"], queryFn: () => apiGet<Berita[]>("/publik/berita") });

  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" data-testid="judul-info-pasar">Info Pasar</h1>
        <p className="mt-3 text-slate-700">Status operasional dan kabar terbaru Pasar Adat Jimbaran.</p>

        {info && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2" data-testid="kartu-status-publik">
            <div className={cn("rounded-3xl p-6 text-white", info.buka_sekarang ? "bg-brand" : "bg-slate-900")}>
              <p className="text-sm opacity-80">Status saat ini</p>
              <p className="mt-1 flex items-center gap-3 text-4xl font-bold" data-testid="status-pasar-publik">
                <span className={cn("size-3 rounded-full", info.buka_sekarang ? "bg-emerald-300 animate-pulse" : "bg-red-400")} />
                {info.buka_sekarang ? "BUKA" : "TUTUP"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="flex items-center gap-2 text-sm text-slate-500"><Clock className="size-4 text-brand" /> Jam operasional</p>
              <p className="mt-1 font-mono text-3xl font-semibold" data-testid="jam-pasar-publik">{info.jam_buka} – {info.jam_tutup} WITA</p>
            </div>
            {info.pengumuman && (
              <p className="flex items-start gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 sm:col-span-2" data-testid="pengumuman-publik">
                <Megaphone className="mt-0.5 size-4 shrink-0" /> {info.pengumuman}
              </p>
            )}
          </div>
        )}

        <h2 className="mt-14 flex items-center gap-2 text-lg font-bold"><Newspaper className="size-5 text-brand" /> Berita Pasar</h2>
        <div className="mt-4 flex flex-col gap-4" data-testid="daftar-berita-publik">
          {berita?.length === 0 && <p className="text-sm text-slate-500">Belum ada berita.</p>}
          {berita?.map((b) => (
            <article key={b.id} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md" data-testid={`berita-${b.id}`}>
              <p className="text-xs font-medium text-brand">{formatDateID(b.tanggal)}</p>
              <h3 className="mt-1 text-lg font-semibold">{b.judul}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{b.isi}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
