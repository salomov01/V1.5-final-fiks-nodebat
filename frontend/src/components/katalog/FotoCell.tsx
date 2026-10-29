import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, Loader2, X } from "lucide-react";
import { fotoLapak } from "@/config";
import { apiDelete, apiUpload } from "@/services/api";
import { errDetail } from "@/utils/errors";
import type { LapakAdmin } from "@/types";

// Thumbnail foto lapak: klik untuk unggah/ganti, × untuk kembali ke foto ilustrasi (Super Admin).
export default function FotoCell({ lapak }: { lapak: LapakAdmin }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const done = (msg: string) => { void qc.invalidateQueries({ queryKey: ["lapak"] }); void qc.invalidateQueries({ queryKey: ["publik"] }); toast.success(msg); };
  const upload = useMutation({
    mutationFn: (f: File) => apiUpload(`/lapak/${lapak.id}/foto`, f),
    onSuccess: () => done(`Foto ${lapak.nama} diperbarui`),
    onError: (e) => toast.error(errDetail(e, "Gagal mengunggah foto")),
  });
  const hapus = useMutation({ mutationFn: () => apiDelete(`/lapak/${lapak.id}/foto`), onSuccess: () => done("Foto dihapus") });
  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Ukuran foto maksimal 5 MB");
    upload.mutate(f);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => input.current?.click()} title="Ganti foto" data-testid={`btn-foto-lapak-${lapak.id}`}
        className="group relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border">
        <img src={fotoLapak(lapak.foto_url, lapak.jenis)} alt="" className={`size-full object-cover ${lapak.foto_url ? "" : "opacity-50"}`} />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white transition-opacity ${upload.isPending ? "" : "opacity-0 group-hover:opacity-100"}`}>
          {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
        </span>
      </button>
      {lapak.foto_url && (
        <button type="button" onClick={() => hapus.mutate()} title="Hapus foto" data-testid={`btn-hapus-foto-${lapak.id}`} className="text-muted-foreground hover:text-red-600"><X className="size-4" /></button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid={`input-foto-lapak-${lapak.id}`}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
