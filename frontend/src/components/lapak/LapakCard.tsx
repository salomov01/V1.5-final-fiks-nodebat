import { ArrowRight } from "lucide-react";
import { fotoLapak } from "@/config";
import { formatRupiah, KATEGORI_LABEL } from "@/utils/format";
import type { LapakPublik } from "@/types";
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={fotoLapak(lapak.foto_url, lapak.jenis)}
          alt={`Foto ${lapak.blok}`}
          loading="lazy"
          data-testid="lapak-foto"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Kosong</span>
        {!lapak.foto_url && (
          <span className="absolute bottom-2 left-3 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white" data-testid="lapak-foto-contoh">Foto ilustrasi</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
      <h3 className=" text-base font-bold text-foreground" data-testid="lapak-blok">{lapak.blok}</h3>
      <p className="text-sm text-muted-foreground">
        {lapak.jenis || "Umum"} • Sewa {KATEGORI_LABEL[lapak.kategori]}
      </p>
      {lapak.deskripsi && <p className="mt-2 text-sm text-muted-foreground">{lapak.deskripsi}</p>}
      <div className="min-h-5 flex-1" />
      <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
        <p className="font-mono text-lg font-semibold text-foreground" data-testid="lapak-tarif">
          {formatRupiah(lapak.tarif)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{SATUAN[lapak.kategori]}</span>
        </p>
        <Button size="sm" onClick={onDaftar} data-testid={`btn-daftar-${lapak.id}`} className="rounded-full">
          Daftar
          <ArrowRight data-icon="inline-end" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
      </div>
    </article>
  );
}
