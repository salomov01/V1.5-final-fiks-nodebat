import { ArrowRight, Store } from "lucide-react";
import { formatRupiah, KATEGORI_LABEL } from "@/lib/format";
import type { LapakPublik } from "@/lib/types";
import { Button } from "@/components/ui/button";

const SATUAN: Record<string, string> = { harian: "/ hari", bulanan: "/ bulan", tahunan: "/ tahun" };

export default function LapakCard({
  lapak,
  index,
  onDaftar,
}: {
  lapak: LapakPublik;
  index: number;
  onDaftar: () => void;
}) {
  return (
    <article
      data-testid={`lapak-card-${lapak.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Store className="size-5" />
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Kosong</span>
      </div>
      <h3 className="mt-4 text-base font-bold text-foreground" data-testid="lapak-card-blok">{lapak.blok}</h3>
      <p className="text-sm text-muted-foreground">
        {lapak.jenis || "Umum"} • Sewa {KATEGORI_LABEL[lapak.kategori]}
      </p>
      {lapak.deskripsi && <p className="mt-2 text-sm text-muted-foreground">{lapak.deskripsi}</p>}
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
        <p className="font-mono text-lg font-semibold text-foreground" data-testid="lapak-card-tarif">
          {formatRupiah(lapak.tarif)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{SATUAN[lapak.kategori]}</span>
        </p>
        <Button size="sm" onClick={onDaftar} data-testid={`btn-daftar-${lapak.id}`} className="rounded-full">
          Daftar
          <ArrowRight data-icon="inline-end" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </article>
  );
}
