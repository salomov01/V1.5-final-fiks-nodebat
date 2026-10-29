import { ArrowRight } from "lucide-react";
import { fotoLapak } from "@/config";
import { formatRupiah } from "@/utils/format";
import type { LapakPublik } from "@/types";
import { Button } from "@/components/ui/button";

// Kartu lapak di halaman publik: foto, nama, harga sewa/bulan & iuran/hari.
export default function LapakCard({ lapak, index, onSewa }: { lapak: LapakPublik; index: number; onSewa: () => void }) {
  return (
    <article data-testid={`lapak-card-${lapak.id}`} style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img src={fotoLapak(lapak.foto_url, lapak.jenis)} alt={`Foto ${lapak.nama}`} loading="lazy" data-testid="lapak-foto"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-brand">Kosong</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold" data-testid="lapak-nama">{lapak.nama}</h3>
        {lapak.deskripsi && <p className="mt-1 text-sm text-muted-foreground">{lapak.deskripsi}</p>}
        <div className="min-h-4 flex-1" />
        <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="font-mono text-lg font-semibold" data-testid="lapak-harga">{formatRupiah(lapak.harga_sewa)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ bulan</span></p>
            <p className="text-xs text-muted-foreground" data-testid="lapak-iuran">Iuran {formatRupiah(lapak.iuran)} / hari</p>
          </div>
          <Button size="sm" onClick={onSewa} data-testid={`btn-sewa-${lapak.id}`} className="rounded-full">
            Sewa <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
