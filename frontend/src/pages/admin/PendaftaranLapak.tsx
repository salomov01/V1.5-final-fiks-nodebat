import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MessageCircle, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah } from "@/utils/format";
import { useAuth } from "@/hooks/useAuth";
import type { Sewa } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { v: "menunggu", l: "Menunggu Konfirmasi" }, { v: "aktif", l: "Aktif" }, { v: "ditolak", l: "Ditolak" }, { v: "", l: "Semua" },
];
const STATUS_STYLE: Record<string, string> = { menunggu: "bg-amber-100 text-amber-800", aktif: "bg-brand-50 text-brand", ditolak: "bg-red-100 text-red-700" };
const waNomor = (hp: string) => hp.replace(/\D/g, "").replace(/^0/, "62");

// Pendaftaran Lapak: daftar booking/sewa. Konfirmasi oleh Super Admin atau Staf Pemungut Iuran.
export default function PendaftaranLapak() {
  const qc = useQueryClient();
  const { isSuper } = useAuth();
  const [tab, setTab] = useState("menunggu");
  const { data } = useQuery({ queryKey: ["sewa", tab], queryFn: () => apiGet<Sewa[]>(`/sewa${tab ? `?status=${tab}` : ""}`) });
  const refresh = () => { for (const k of ["sewa", "lapak", "publik", "pedagang", "dashboard"]) void qc.invalidateQueries({ queryKey: [k] }); };
  const aksi = useMutation({
    mutationFn: ({ id, a }: { id: string; a: "terima" | "tolak" | "hapus" }) => a === "hapus" ? apiDelete(`/sewa/${id}`) : apiPost(`/sewa/${id}/${a}`),
    onSuccess: (_d, v) => { refresh(); toast.success(v.a === "terima" ? "Sewa dikonfirmasi — pedagang aktif di lapak" : v.a === "tolak" ? "Pendaftaran ditolak" : "Data sewa dihapus"); },
    onError: (e) => toast.error(errDetail(e, "Gagal memproses")),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-pendaftaran-lapak">Pendaftaran Lapak</h1>
      <p className="mt-1 text-sm text-muted-foreground">Daftar booking & sewa lapak. Pedagang baru otomatis dibuatkan User ID saat dikonfirmasi.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.v} type="button" onClick={() => setTab(t.v)} data-testid={`tab-sewa-${t.v || "semua"}`}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", tab === t.v ? "border-brand bg-brand text-white" : "bg-white hover:border-brand")}>{t.l}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-3" data-testid="daftar-sewa">
        {data?.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada data.</p>}
        {data?.map((s) => (
          <div key={s.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center" data-testid={`sewa-${s.id}`}>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.nama}</span>
                {s.user_id ? <span className="font-mono text-xs text-brand">{s.user_id}</span> : <span className="text-xs text-amber-700">pedagang baru</span>}
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[s.status])} data-testid="sewa-status">{s.status}</span>
              </div>
              <p className="text-sm">{s.lapak_nama} • {formatDateID(s.mulai)} – {formatDateID(s.selesai)} ({s.hari} hari)</p>
              <p className="text-xs text-muted-foreground">
                Total {formatRupiah(s.total_harga)} • Iuran {formatRupiah(s.iuran)}/hari
                {s.status === "aktif" && <> • {s.sisa > 0 ? `Sisa sewa ${formatRupiah(s.sisa)}` : "Sewa LUNAS"}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.no_hp && <a href={`https://wa.me/${waNomor(s.no_hp)}`} target="_blank" rel="noopener noreferrer" title="Chat" className="inline-flex size-8 items-center justify-center rounded-lg border hover:bg-muted"><MessageCircle className="size-4" /></a>}
              {s.status === "menunggu" && (<>
                <Button size="sm" variant="outline" onClick={() => aksi.mutate({ id: s.id, a: "tolak" })} data-testid={`btn-tolak-sewa-${s.id}`}><X data-icon="inline-start" className="size-4" /> Tolak</Button>
                <Button size="sm" onClick={() => aksi.mutate({ id: s.id, a: "terima" })} data-testid={`btn-terima-sewa-${s.id}`}><Check data-icon="inline-start" className="size-4" /> Konfirmasi</Button>
              </>)}
              {isSuper && <Button size="icon-sm" variant="ghost" onClick={() => confirm("Hapus data sewa ini?") && aksi.mutate({ id: s.id, a: "hapus" })} data-testid={`btn-hapus-sewa-${s.id}`}><Trash2 className="size-4 text-red-600" /></Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
