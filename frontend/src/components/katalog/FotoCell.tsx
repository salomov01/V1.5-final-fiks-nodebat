import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, Loader2, X } from "lucide-react";
import { fotoLapak } from "@/config";
import { apiDelete, apiUpload } from "@/services/api";
import type { LapakUnit } from "@/types";
import { errDetail, invalidateKatalog } from "@/components/katalog/PendaftaranList";

export default function FotoCell({ unit }: { unit: LapakUnit }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const done = (msg: string) => { invalidateKatalog(qc); toast.success(msg); };
  const upload = useMutation({
    mutationFn: (f: File) => apiUpload<LapakUnit>(`/lapak-unit/${unit.id}/foto`, f),
    onSuccess: () => done(`Foto ${unit.blok} diperbarui`),
    onError: (e) => toast.error(errDetail(e, "Gagal mengunggah foto")),
  });
  const hapus = useMutation({
    mutationFn: () => apiDelete(`/lapak-unit/${unit.id}/foto`),
    onSuccess: () => done("Foto dihapus, kembali ke foto ilustrasi"),
  });
  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Ukuran foto maksimal 5 MB");
    upload.mutate(f);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => input.current?.click()} title="Ganti foto" data-testid={`btn-foto-unit-${unit.id}`}
        className="group relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border">
        <img src={fotoLapak(unit.foto_url, unit.jenis)} alt="" className={`size-full object-cover ${unit.foto_url ? "" : "opacity-50"}`} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
        </span>
        {upload.isPending && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Loader2 className="size-4 animate-spin" /></span>}
      </button>
      {unit.foto_url ? (
        <button type="button" onClick={() => hapus.mutate()} title="Hapus foto" data-testid={`btn-hapus-foto-${unit.id}`}
          className="text-muted-foreground hover:text-red-600"><X className="size-4" /></button>
      ) : (
        <span className="text-[10px] leading-tight text-muted-foreground" data-testid={`label-foto-contoh-${unit.id}`}>contoh</span>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid={`input-foto-unit-${unit.id}`}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
