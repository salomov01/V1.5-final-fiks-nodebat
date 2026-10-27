import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileSpreadsheet, Layers, MessageCircle, Plus, ReceiptText, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import { METODE_LABEL, formatDateTimeID, formatRupiah, initials } from "@/utils/format";
import type { BulkBillResult, Payment, Tenant } from "@/types";
import { waReminderLink } from "@/utils/whatsapp";
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
import { StatusBadge } from "@/components/common/Badges";
import PaymentRecordDialog from "@/components/pembayaran/PaymentRecordDialog";
import ReceiptDialog from "@/components/pembayaran/ReceiptDialog";
import ExportDialog from "@/components/pembayaran/ExportDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { key: "menunggu", label: "Menunggu Konfirmasi" },
  { key: "lunas", label: "Lunas" },
  { key: "semua", label: "Semua" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Pembayaran() {
  const qc = useQueryClient();
  const { isSuper } = useAuth(); // Staff: tanpa konfirmasi/tolak/hapus, ekspor & total
  const [tab, setTab] = useState<TabKey>("menunggu");
  const [recordOpen, setRecordOpen] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Daftar penyewa untuk mengambil no. HP saat mengirim pengingat WhatsApp.
  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiGet<Tenant[]>("/tenants"),
  });

  // Tagihan massal: hanya penyewa bulanan yang masih aktif.
  const bulkPenyewa = useMemo(
    () => (tenants ?? []).filter((t) => t.kategori === "bulanan" && t.status === "aktif"),
    [tenants]
  );

  const bulk = useMutation({
    mutationFn: () => apiPost<BulkBillResult>("/payments/bulk-monthly"),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      setBulkOpen(false);
      if (r.dibuat === 0) {
        toast.info(`Semua penyewa bulanan sudah punya tagihan ${r.periode}`);
      } else {
        toast.success(
          `${r.dibuat} tagihan ${r.periode} diterbitkan${isSuper ? ` (${formatRupiah(r.total_nilai)})` : ""}${
            r.dilewati ? ` • ${r.dilewati} dilewati` : ""
          }`
        );
      }
    },
    onError: () => toast.error("Gagal menerbitkan tagihan massal"),
  });

  const kirimPengingat = (p: Payment) => {
    const tenant = tenants?.find((t) => t.id === p.tenant_id);
    if (!tenant) {
      toast.error("Data penyewa tidak ditemukan");
      return;
    }
    const link = waReminderLink(tenant, p);
    if (!link) {
      toast.error(`Nomor HP ${p.nama_lengkap} belum diisi`);
      return;
    }
    window.open(link, "_blank", "noopener");
  };

  const { data: payments, isPending, isError, refetch } = useQuery({
    queryKey: ["payments"],
    queryFn: () => apiGet<Payment[]>("/payments"),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["payments"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const confirm = useMutation({
    mutationFn: (id: string) => apiPatch<Payment>(`/payments/${id}/confirm`),
    onSuccess: () => {
      invalidate();
      toast.success("Pembayaran dikonfirmasi — status Lunas");
    },
    onError: () => toast.error("Gagal mengonfirmasi pembayaran"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => apiPatch<Payment>(`/payments/${id}/reject`),
    onSuccess: () => {
      invalidate();
      toast.info("Pembayaran ditolak");
    },
    onError: () => toast.error("Gagal menolak pembayaran"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/payments/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Data pembayaran dihapus");
    },
    onError: () => toast.error("Gagal menghapus pembayaran"),
  });

  const counts = useMemo(() => {
    const c = { menunggu: 0, lunas: 0, ditolak: 0 };
    for (const p of payments ?? []) c[p.status] += 1;
    return c;
  }, [payments]);

  const totalMenunggu = useMemo(
    () => (payments ?? []).filter((p) => p.status === "menunggu").reduce((s, p) => s + p.jumlah, 0),
    [payments]
  );

  const filtered = useMemo(
    () => (payments ?? []).filter((p) => tab === "semua" || p.status === tab),
    [payments, tab]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-pembayaran">
            Konfirmasi Pembayaran
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifikasi dan konfirmasi pembayaran sewa lapak dari penyewa
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="btn-tagihan-massal">
            <Layers data-icon="inline-start" className="size-4" />
            Tagihan Massal
          </Button>
          {isSuper && (
            <Button variant="outline" onClick={() => setExportOpen(true)} data-testid="btn-ekspor-excel">
              <FileSpreadsheet data-icon="inline-start" className="size-4" />
              Ekspor Excel
            </Button>
          )}
          <Button onClick={() => setRecordOpen(true)} data-testid="btn-buka-catat-pembayaran">
            <Plus data-icon="inline-start" className="size-4" />
            Catat Pembayaran
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-pembayaran-${t.key}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
              tab === t.key
                ? "border-brand bg-brand text-white"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
            {t.key !== "semua" && (
              <span className="ml-1.5 text-xs opacity-75">({counts[t.key as keyof typeof counts]})</span>
            )}
          </button>
        ))}
        {isSuper && tab === "menunggu" && totalMenunggu > 0 && (
          <span
            className="ml-auto rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand"
            data-testid="info-nilai-menunggu"
          >
            Perlu dikonfirmasi: {formatRupiah(totalMenunggu)}
          </span>
        )}
      </div>

      {isError && (
        <div
          className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="error-banner-pembayaran"
        >
          Gagal memuat data pembayaran dari server.
          <button
            onClick={() => void refetch()}
            data-testid="btn-coba-lagi-pembayaran"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      <Card className="mt-4">
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-3 py-6" data-testid="skeleton-tabel-pembayaran">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="empty-state-pembayaran">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Check className="size-7" />
              </span>
              <p className="font-medium">Tidak ada pembayaran pada daftar ini</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Semua tagihan pada filter ini sudah beres atau belum ada data yang tercatat.
              </p>
            </div>
          ) : (
            <Table data-testid="tabel-pembayaran">
              <TableHeader>
                <TableRow>
                  <TableHead>Penyewa</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Penagih</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, idx) => (
                  <TableRow key={p.id} data-testid={`baris-pembayaran-${idx}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initials(p.nama_lengkap)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.nama_lengkap}</p>
                          <p className="font-mono text-xs text-muted-foreground">{p.nomor_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{p.periode}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold">{formatRupiah(p.jumlah)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                        {METODE_LABEL[p.metode]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-brand" data-testid={`penagih-bayar-${idx}`}>
                        {p.penagih || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDateTimeID(p.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {p.status === "menunggu" && (
                          <>
                            {isSuper && <Button
                              size="xs"
                              onClick={() => confirm.mutate(p.id)}
                              disabled={confirm.isPending}
                              data-testid={`btn-konfirmasi-${idx}`}
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <Check data-icon="inline-start" className="size-3.5" />
                              Konfirmasi
                            </Button>}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => kirimPengingat(p)}
                              data-testid={`btn-wa-bayar-${idx}`}
                              title="Kirim pengingat WhatsApp"
                            >
                              <MessageCircle className="size-4 text-emerald-600" />
                            </Button>
                            {isSuper && <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => reject.mutate(p.id)}
                              data-testid={`btn-tolak-${idx}`}
                              title="Tolak pembayaran"
                            >
                              <X className="size-4 text-red-600" />
                            </Button>}
                          </>
                        )}
                        {p.status === "lunas" && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setReceipt(p)}
                            data-testid={`btn-kuitansi-${idx}`}
                          >
                            <ReceiptText data-icon="inline-start" className="size-3.5" />
                            Kuitansi
                          </Button>
                        )}
                        {isSuper && <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove.mutate(p.id)}
                          data-testid={`btn-hapus-bayar-${idx}`}
                          title="Hapus"
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaymentRecordDialog open={recordOpen} onOpenChange={setRecordOpen} tenant={null} />
      <ReceiptDialog
        payment={receipt}
        open={!!receipt}
        onOpenChange={(v) => !v && setReceipt(null)}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-tagihan-massal">
          <DialogHeader>
            <DialogTitle>Terbitkan Tagihan Massal</DialogTitle>
            <DialogDescription>
              Membuat tagihan bulan berjalan untuk semua penyewa berkategori <b>Bulanan</b> yang
              masih aktif, dengan jatuh tempo tanggal 10. Penyewa yang sudah punya tagihan bulan ini
              otomatis dilewati.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border p-4 text-sm" data-testid="ringkasan-massal">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Penyewa bulanan aktif</span>
              <span className="font-semibold" data-testid="massal-jumlah-penyewa">
                {bulkPenyewa.length} penyewa
              </span>
            </div>
            {isSuper && <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">Estimasi total tagihan</span>
              <span className="font-semibold" data-testid="massal-estimasi">
                {formatRupiah(bulkPenyewa.reduce((s, t) => s + t.tarif, 0))}
              </span>
            </div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} data-testid="btn-batal-massal">
              Batal
            </Button>
            <Button
              onClick={() => bulk.mutate()}
              disabled={bulk.isPending}
              data-testid="btn-konfirmasi-massal"
            >
              {bulk.isPending ? "Menerbitkan..." : "Terbitkan Tagihan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
