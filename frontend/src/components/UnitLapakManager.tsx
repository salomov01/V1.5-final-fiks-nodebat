import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import { formatDateID, formatRupiah, KATEGORI_LABEL } from "@/lib/format";
import type { LapakUnit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errDetail, invalidateKatalog } from "@/components/PendaftaranList";
import UnitFormDialog from "@/components/UnitFormDialog";

export default function UnitLapakManager() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<LapakUnit | null | "baru">(null);
  const { data } = useQuery({ queryKey: ["lapak-unit"], queryFn: () => apiGet<LapakUnit[]>("/lapak-unit") });
  const hapus = useMutation({
    mutationFn: (id: string) => apiDelete(`/lapak-unit/${id}`),
    onSuccess: () => { invalidateKatalog(qc); toast.success("Lapak dihapus dari katalog"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menghapus")),
  });
  const kosong = data?.filter((u) => u.status === "kosong").length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-testid="ringkasan-katalog">
          {data?.length ?? 0} lapak • <span className="font-semibold text-emerald-700">{kosong} kosong</span> (tampil di halaman publik).
          Lapak otomatis kosong bila masa sewa penyewa habis atau berhenti.
        </p>
        <Button size="sm" onClick={() => setEdit("baru")} data-testid="btn-tambah-unit">
          <Plus data-icon="inline-start" className="size-4" /> Tambah Lapak
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lapak</TableHead><TableHead>Jenis</TableHead><TableHead>Kategori</TableHead>
              <TableHead>Tarif</TableHead><TableHead>Status</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((u) => (
              <TableRow key={u.id} data-testid={`unit-row-${u.id}`}>
                <TableCell className="font-medium">{u.blok}</TableCell>
                <TableCell>{u.jenis || "-"}</TableCell>
                <TableCell>{KATEGORI_LABEL[u.kategori]}</TableCell>
                <TableCell className="font-mono">{formatRupiah(u.tarif)}</TableCell>
                <TableCell data-testid="unit-status">
                  {u.status === "kosong"
                    ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Kosong</span>
                    : <span className="text-xs text-muted-foreground">Terisi s.d. {u.terisi_sampai && formatDateID(u.terisi_sampai)}</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(u)} data-testid={`btn-edit-unit-${u.id}`}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm(`Hapus ${u.blok} dari katalog?`) && hapus.mutate(u.id)} data-testid={`btn-hapus-unit-${u.id}`}>
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <UnitFormDialog open={edit !== null} unit={edit === "baru" ? null : edit} onClose={() => setEdit(null)} />
    </div>
  );
}
