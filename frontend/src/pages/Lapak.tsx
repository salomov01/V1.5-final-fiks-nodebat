import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Pencil, Plus, QrCode, Search, Store, Trash2 } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import {
  KATEGORI_LABEL,
  STATUS_PENYEWA_LABEL,
  formatDateID,
  formatRupiah,
  initials,
} from "@/lib/format";
import type { KategoriSewa, Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { KategoriBadge } from "@/components/Badges";
import { waReminderLink } from "@/lib/whatsapp";
import TenantFormDialog from "@/components/TenantFormDialog";
import QrCardDialog from "@/components/QrCardDialog";
import { cn } from "@/lib/utils";

type FilterKategori = "semua" | KategoriSewa;

export default function Lapak() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState<FilterKategori>("semua");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [qrTenant, setQrTenant] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState<Tenant | null>(null);

  const { data: tenants, isPending, isError, refetch } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiGet<Tenant[]>("/tenants"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/tenants/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Data penyewa dihapus");
      setDeleting(null);
    },
    onError: () => toast.error("Gagal menghapus penyewa"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tenants ?? []).filter((t) => {
      if (kategori !== "semua" && t.kategori !== kategori) return false;
      if (!q) return true;
      return (
        t.nama_lengkap.toLowerCase().includes(q) ||
        t.nomor_id.toLowerCase().includes(q) ||
        t.blok.toLowerCase().includes(q)
      );
    });
  }, [tenants, search, kategori]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: Tenant) => {
    setEditing(t);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-lapak">
            Pendataan Lapak
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola data penyewa lapak pasar — kategori Harian, Bulanan &amp; Tahunan
          </p>
        </div>
        <Button onClick={openCreate} data-testid="btn-tambah-penyewa">
          <Plus data-icon="inline-start" className="size-4" />
          Tambah Penyewa
        </Button>
      </div>

      {isError && (
        <div
          className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="error-banner-lapak"
        >
          Gagal memuat data penyewa dari server.
          <button
            onClick={() => void refetch()}
            data-testid="btn-coba-lagi-lapak"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["semua", "harian", "bulanan", "tahunan"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKategori(k)}
              data-testid={`filter-kategori-${k}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                kategori === k
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {k === "semua" ? "Semua" : KATEGORI_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-penyewa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor ID, atau blok..."
            className="pl-9"
          />
        </div>
      </div>

      <Card className="mt-4">
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-3 py-6" data-testid="skeleton-tabel">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="empty-state-lapak">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <Store className="size-7" />
              </span>
              <p className="font-medium">Belum ada data penyewa</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Tambahkan penyewa lapak pertama untuk mulai mendata penyewaan pasar.
              </p>
              <Button variant="outline" size="sm" onClick={openCreate} data-testid="btn-tambah-kosong">
                <Plus data-icon="inline-start" className="size-4" />
                Tambah Penyewa
              </Button>
            </div>
          ) : (
            <Table data-testid="tabel-penyewa">
              <TableHeader>
                <TableRow>
                  <TableHead>Penyewa</TableHead>
                  <TableHead>Lapak / Blok</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tarif Sewa</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t, idx) => (
                  <TableRow
                    key={t.id}
                    data-testid={`baris-penyewa-${t.nomor_id.toLowerCase()}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initials(t.nama_lengkap)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.nama_lengkap}</p>
                          <p className="font-mono text-xs text-muted-foreground" data-testid={`nomor-id-${idx}`}>
                            {t.nomor_id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{t.blok}</span>
                    </TableCell>
                    <TableCell>
                      <KategoriBadge kategori={t.kategori} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold">{formatRupiah(t.tarif)}</span>
                      <span className="block text-xs text-muted-foreground">
                        per {KATEGORI_LABEL[t.kategori].toLowerCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {formatDateID(t.mulai)} — {formatDateID(t.selesai)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          t.status === "aktif"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                        data-testid={`status-penyewa-${t.nomor_id.toLowerCase()}`}
                      >
                        {STATUS_PENYEWA_LABEL[t.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setQrTenant(t)}
                          data-testid={`btn-qr-${idx}`}
                          title="Lihat QR Code"
                        >
                          <QrCode className="size-4 text-amber-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            const link = waReminderLink(t);
                            if (!link) {
                              toast.error(`Nomor HP ${t.nama_lengkap} belum diisi`);
                              return;
                            }
                            window.open(link, "_blank", "noopener");
                          }}
                          data-testid={`btn-wa-${idx}`}
                          title="Kirim pengingat WhatsApp"
                        >
                          <MessageCircle className="size-4 text-emerald-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(t)}
                          data-testid={`btn-edit-${idx}`}
                          title="Ubah data"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(t)}
                          data-testid={`btn-hapus-${idx}`}
                          title="Hapus"
                        >
                          <Trash2 className="size-4 text-red-600" />
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

      <TenantFormDialog open={formOpen} onOpenChange={setFormOpen} tenant={editing} />
      <QrCardDialog open={!!qrTenant} onOpenChange={(v) => !v && setQrTenant(null)} tenant={qrTenant} />

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-hapus-penyewa">
          <DialogHeader>
            <DialogTitle>Hapus Data Penyewa?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${deleting.nama_lengkap} (${deleting.nomor_id}) beserta seluruh riwayat pembayarannya akan dihapus permanen.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="btn-batal-hapus">
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting.id)}
              disabled={remove.isPending}
              data-testid="btn-konfirmasi-hapus"
            >
              {remove.isPending ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
