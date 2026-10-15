import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, CheckCircle2, Coins, MessageCircle, Users } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { KATEGORI_LABEL, formatDateID, formatRupiah, initials } from "@/lib/format";
import type { OverduePayment, OverdueSummary, Payment, Tenant } from "@/lib/types";
import { waReminderLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function TelatBadge({ hari }: { hari: number }) {
  const tone =
    hari >= 30
      ? "bg-red-100 text-red-700"
      : hari >= 7
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}
      data-testid={`badge-telat-${hari}`}
    >
      {hari} hari
    </span>
  );
}

export default function Tunggakan() {
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["payments", "overdue"],
    queryFn: () => apiGet<OverdueSummary>("/payments/overdue"),
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiGet<Tenant[]>("/tenants"),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => apiPatch<Payment>(`/payments/${id}/confirm`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Pembayaran dikonfirmasi — tunggakan terselesaikan");
    },
    onError: () => toast.error("Gagal mengonfirmasi pembayaran"),
  });

  const kirimPengingat = (o: OverduePayment) => {
    const tenant = tenants?.find((t) => t.id === o.tenant_id);
    if (!tenant) {
      toast.error("Data penyewa tidak ditemukan");
      return;
    }
    const link = waReminderLink(tenant, o);
    if (!link) {
      toast.error(`Nomor HP ${o.nama_lengkap} belum diisi`);
      return;
    }
    window.open(link, "_blank", "noopener");
  };

  const items = data?.items ?? [];

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-tunggakan">
          Rekap Tunggakan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Penyewa yang telat membayar beserta lama keterlambatannya
          {data ? ` — per ${formatDateID(data.periode_hari_ini)} (WITA)` : ""}
        </p>
      </div>

      {isError && (
        <div
          className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="error-banner-tunggakan"
        >
          Gagal memuat rekap tunggakan dari server.
          <button
            onClick={() => void refetch()}
            data-testid="btn-coba-lagi-tunggakan"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      {data && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="stat-tunggakan">
          <Card data-testid="stat-total-tunggakan">
            <CardContent className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Coins className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Total Tunggakan</p>
                <p className="mt-0.5 truncate text-2xl font-bold tracking-tight">
                  {formatRupiah(data.total_tunggakan)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{items.length} tagihan lewat tempo</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-penyewa-telat">
            <CardContent className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Users className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Penyewa Telat</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight">{data.jumlah_penyewa}</p>
                <p className="mt-1 text-xs text-muted-foreground">perlu ditindaklanjuti</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-telat-terlama">
            <CardContent className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <AlarmClock className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Keterlambatan Terlama</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight">{data.telat_terlama} hari</p>
                <p className="mt-1 text-xs text-muted-foreground">sejak jatuh tempo</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-3 py-6" data-testid="skeleton-tunggakan">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="empty-state-tunggakan">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-7" />
              </span>
              <p className="font-medium">Tidak ada tunggakan</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Semua tagihan penyewa masih dalam masa jatuh tempo atau sudah lunas.
              </p>
            </div>
          ) : (
            <Table data-testid="tabel-tunggakan">
              <TableHeader>
                <TableRow>
                  <TableHead>Penyewa</TableHead>
                  <TableHead>Lapak / Kategori</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Telat</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((o, idx) => (
                  <TableRow key={o.id} data-testid={`baris-tunggakan-${idx}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-600">
                          {initials(o.nama_lengkap)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.nama_lengkap}</p>
                          <p className="font-mono text-xs text-muted-foreground">{o.nomor_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{o.blok || "-"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {KATEGORI_LABEL[o.kategori] ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{o.periode}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{formatDateID(o.jatuh_tempo)}</span>
                    </TableCell>
                    <TableCell>
                      <TelatBadge hari={o.hari_telat} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold">{formatRupiah(o.jumlah)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="xs"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => confirm.mutate(o.id)}
                          disabled={confirm.isPending}
                          data-testid={`btn-konfirmasi-tunggakan-${idx}`}
                        >
                          Konfirmasi
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => kirimPengingat(o)}
                          data-testid={`btn-wa-tunggakan-${idx}`}
                          title="Kirim pengingat WhatsApp"
                        >
                          <MessageCircle className="size-4 text-emerald-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
