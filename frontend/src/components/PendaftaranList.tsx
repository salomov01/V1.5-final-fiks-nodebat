import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MessageCircle, X } from "lucide-react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { formatDateTimeID, formatRupiah, KATEGORI_LABEL } from "@/lib/format";
import { normalizePhoneID } from "@/lib/whatsapp";
import type { Pendaftaran, Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import TerimaDialog from "@/components/TerimaDialog";

const STATUS_STYLE: Record<string, string> = {
  baru: "bg-amber-100 text-amber-700",
  diterima: "bg-emerald-100 text-emerald-700",
  ditolak: "bg-red-100 text-red-700",
};

export function errDetail(e: unknown, fallback: string): string {
  const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
    ? (e.body as { detail: unknown }).detail : null;
  return typeof d === "string" ? d : fallback;
}

export function invalidateKatalog(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ["pendaftaran", "lapak-unit", "tenants", "dashboard", "publik"]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

export default function PendaftaranList() {
  const qc = useQueryClient();
  const [terima, setTerima] = useState<Pendaftaran | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ["pendaftaran", "semua"],
    queryFn: () => apiGet<Pendaftaran[]>("/pendaftaran"),
  });
  const tolak = useMutation({
    mutationFn: (id: string) => apiPost<Pendaftaran>(`/pendaftaran/${id}/tolak`),
    onSuccess: () => { invalidateKatalog(qc); toast.success("Pendaftaran ditolak"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menolak")),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!data?.length) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground" data-testid="pendaftaran-kosong">Belum ada pendaftaran.</p>;
  }

  return (
    <div className="grid gap-3" data-testid="pendaftaran-list">
      {data.map((p) => (
        <Card key={p.id} data-testid={`pendaftaran-${p.id}`}>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{p.nama}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.status]}`} data-testid="pendaftaran-status">
                  {p.status}{p.tenant_nomor_id ? ` • ${p.tenant_nomor_id}` : ""}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {p.blok} • {KATEGORI_LABEL[p.kategori]} • {formatRupiah(p.tarif)} • {p.no_hp}
              </p>
              {p.catatan && <p className="text-sm text-muted-foreground">“{p.catatan}”</p>}
              <p className="text-xs text-muted-foreground">{formatDateTimeID(p.created_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/${normalizePhoneID(p.no_hp)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-lg border hover:bg-muted" title="Chat pendaftar" data-testid={`btn-wa-pendaftar-${p.id}`}>
                <MessageCircle className="size-4" />
              </a>
              {p.status === "baru" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => tolak.mutate(p.id)} disabled={tolak.isPending} data-testid={`btn-tolak-${p.id}`}>
                    <X data-icon="inline-start" className="size-4" /> Tolak
                  </Button>
                  <Button size="sm" onClick={() => setTerima(p)} data-testid={`btn-terima-${p.id}`}>
                    <Check data-icon="inline-start" className="size-4" /> Terima
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      <TerimaDialog item={terima} onClose={() => setTerima(null)} onDone={(t: Tenant) => toast.success(`${t.nama_lengkap} kini penyewa ${t.nomor_id}`)} />
    </div>
  );
}
