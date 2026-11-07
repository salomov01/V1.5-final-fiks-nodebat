import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateTimeID, formatRupiah } from "@/utils/format";
import type { HargaBarang } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const KOSONG = { nama: "", satuan: "kg", harga: "" };

// Kelola papan Informasi Harga Barang (khusus Super Admin) — langsung tampil di halaman publik.
export default function HargaBarangAdmin() {
  const qc = useQueryClient();
  const [f, setF] = useState(KOSONG);
  const [editId, setEditId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["publik", "harga-barang"], queryFn: () => apiGet<HargaBarang[]>("/publik/harga-barang") });
  const done = (msg: string) => { void qc.invalidateQueries({ queryKey: ["publik", "harga-barang"] }); setF(KOSONG); setEditId(null); toast.success(msg); };
  const simpan = useMutation({
    mutationFn: () => {
      const body = { nama: f.nama.trim(), satuan: f.satuan.trim(), harga: Number(f.harga) };
      return editId ? apiPut(`/harga-barang/${editId}`, body) : apiPost("/harga-barang", body);
    },
    onSuccess: () => done(editId ? "Harga diperbarui" : "Barang ditambahkan"),
    onError: (e) => toast.error(errDetail(e, "Lengkapi nama, satuan & harga")),
  });
  const hapus = useMutation({ mutationFn: (id: string) => apiDelete(`/harga-barang/${id}`), onSuccess: () => done("Barang dihapus") });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-harga-barang-admin">Harga Barang</h1>
      <p className="mt-1 text-sm text-muted-foreground">Papan harga terkini di halaman publik. Perubahan langsung tampil.</p>
      <form className="mt-6 grid gap-2 rounded-2xl border bg-card p-5 sm:grid-cols-[2fr_1fr_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
        <Input placeholder="Nama barang, mis. Beras Medium" value={f.nama} data-testid="input-harga-nama" onChange={(e) => setF({ ...f, nama: e.target.value })} />
        <Input placeholder="Satuan (kg, liter, ikat)" value={f.satuan} data-testid="input-harga-satuan" onChange={(e) => setF({ ...f, satuan: e.target.value })} />
        <Input type="number" min={0} placeholder="Harga (Rp)" value={f.harga} data-testid="input-harga-nilai" onChange={(e) => setF({ ...f, harga: e.target.value })} />
        <Button type="submit" disabled={simpan.isPending} data-testid="btn-simpan-harga">{editId ? <Pencil data-icon="inline-start" className="size-4" /> : <Plus data-icon="inline-start" className="size-4" />} {editId ? "Simpan" : "Tambah"}</Button>
        {editId && <Button type="button" variant="ghost" onClick={() => { setEditId(null); setF(KOSONG); }} data-testid="btn-batal-edit-harga"><X className="size-4" /></Button>}
      </form>
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Barang</TableHead><TableHead>Satuan</TableHead><TableHead>Harga</TableHead><TableHead>Diperbarui</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Belum ada data harga.</TableCell></TableRow>}
            {data?.map((h) => (
              <TableRow key={h.id} data-testid={`row-harga-${h.id}`}>
                <TableCell className="font-medium">{h.nama}</TableCell>
                <TableCell>{h.satuan}</TableCell>
                <TableCell className="font-mono">{formatRupiah(h.harga)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTimeID(h.updated_at)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button size="icon-sm" variant="ghost" onClick={() => { setEditId(h.id); setF({ nama: h.nama, satuan: h.satuan, harga: String(h.harga) }); }} data-testid={`btn-edit-harga-${h.id}`}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Hapus ${h.nama}?`) && hapus.mutate(h.id)} data-testid={`btn-hapus-harga-${h.id}`}><Trash2 className="size-4 text-red-600" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
