import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { fotoLapak } from "@/config";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah } from "@/utils/format";
import { useAuth } from "@/hooks/useAuth";
import type { LapakAdmin } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FotoCell from "@/components/katalog/FotoCell";
import SewaLapakDialog from "@/components/lapak/SewaLapakDialog";

const KOSONG = { nama: "", jenis: "", harga_sewa: "", iuran: "", deskripsi: "" };
const angka = (v: string) => v.replace(/\D/g, "");

// Halaman Data Lapak & Iuran (satu paket): tambah manual, foto, edit langsung di tabel, assign pedagang.
export default function DataLapak() {
  const qc = useQueryClient();
  const { isSuper } = useAuth();
  const [form, setForm] = useState(KOSONG);
  const [edit, setEdit] = useState<LapakAdmin | null>(null);
  const [assign, setAssign] = useState<LapakAdmin | null>(null);
  const { data } = useQuery({ queryKey: ["lapak"], queryFn: () => apiGet<LapakAdmin[]>("/lapak") });
  const refresh = () => { for (const k of ["lapak", "publik", "dashboard"]) void qc.invalidateQueries({ queryKey: [k] }); };

  const tambah = useMutation({
    mutationFn: () => apiPost("/lapak", { ...form, harga_sewa: Number(form.harga_sewa), iuran: Number(form.iuran) }),
    onSuccess: () => { setForm(KOSONG); refresh(); toast.success("Lapak & iuran ditambahkan"); },
    onError: (e) => toast.error(errDetail(e, "Isi nama, harga sewa & iuran")),
  });
  const simpan = useMutation({
    mutationFn: (l: LapakAdmin) => apiPatch(`/lapak/${l.id}`, { nama: l.nama, jenis: l.jenis, harga_sewa: l.harga_sewa, iuran: l.iuran, deskripsi: l.deskripsi }),
    onSuccess: () => { setEdit(null); refresh(); toast.success("Lapak disimpan"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menyimpan")),
  });
  const hapus = useMutation({
    mutationFn: (id: string) => apiDelete(`/lapak/${id}`),
    onSuccess: () => { refresh(); toast.success("Lapak dihapus"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menghapus")),
  });

  const teks = (key: "nama" | "jenis", l: LapakAdmin) => edit?.id === l.id
    ? <Input value={edit[key]} data-testid={`inline-lapak-${key}-${l.id}`} onChange={(e) => setEdit({ ...edit, [key]: e.target.value })} /> : l[key] || "-";
  const uang = (key: "harga_sewa" | "iuran", l: LapakAdmin) => edit?.id === l.id
    ? <Input value={String(edit[key])} inputMode="numeric" data-testid={`inline-lapak-${key}-${l.id}`} onChange={(e) => setEdit({ ...edit, [key]: Number(angka(e.target.value)) })} />
    : <span className="font-mono">{formatRupiah(l[key])}</span>;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-data-lapak">Data Lapak dan Iuran</h1>
      <p className="mt-1 text-sm text-muted-foreground">Setiap lapak satu paket dengan iuran hariannya. Lapak kosong tampil di halaman publik.</p>

      <form className="mt-6 grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); tambah.mutate(); }} data-testid="form-tambah-lapak">
        <Input className="sm:col-span-2" placeholder="Nama lapak" value={form.nama} data-testid="input-lapak-nama" onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        <Input placeholder="Jenis (opsional)" value={form.jenis} data-testid="input-lapak-jenis" onChange={(e) => setForm({ ...form, jenis: e.target.value })} />
        <Input placeholder="Harga sewa / bulan" inputMode="numeric" value={form.harga_sewa} data-testid="input-lapak-harga" onChange={(e) => setForm({ ...form, harga_sewa: angka(e.target.value) })} />
        <Input placeholder="Iuran / hari" inputMode="numeric" value={form.iuran} data-testid="input-lapak-iuran" onChange={(e) => setForm({ ...form, iuran: angka(e.target.value) })} />
        <Button type="submit" disabled={tambah.isPending} data-testid="btn-tambah-lapak"><Plus data-icon="inline-start" className="size-4" /> Tambah</Button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Foto</TableHead><TableHead>Nama Lapak</TableHead><TableHead>Jenis</TableHead><TableHead>Sewa / bulan</TableHead><TableHead>Iuran / hari</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {data?.map((l) => (
              <TableRow key={l.id} data-testid={`row-lapak-${l.id}`}>
                <TableCell>{isSuper ? <FotoCell lapak={l} /> : <img src={fotoLapak(l.foto_url, l.jenis)} alt="" className="h-12 w-16 rounded-lg border object-cover" />}</TableCell>
                <TableCell className="font-medium">{teks("nama", l)}</TableCell>
                <TableCell>{teks("jenis", l)}</TableCell>
                <TableCell>{uang("harga_sewa", l)}</TableCell>
                <TableCell>{uang("iuran", l)}</TableCell>
                <TableCell data-testid={`status-lapak-${l.id}`}>
                  {l.status === "kosong"
                    ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">Kosong</span>
                    : <span className="text-xs">{l.penyewa} <span className="text-muted-foreground">s.d. {formatDateID(l.terisi_sampai ?? "")}</span></span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {l.status === "kosong" && (
                    <Button size="sm" variant="outline" onClick={() => setAssign(l)} data-testid={`btn-assign-${l.id}`}><UserPlus data-icon="inline-start" className="size-4" /> Tetapkan</Button>
                  )}
                  {isSuper && (edit?.id === l.id ? (<>
                    <Button size="icon-sm" variant="ghost" onClick={() => simpan.mutate(edit)} data-testid={`btn-simpan-lapak-${l.id}`}><Check className="size-4 text-brand" /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEdit(null)}><X className="size-4" /></Button>
                  </>) : (<>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEdit(l)} data-testid={`btn-edit-lapak-${l.id}`}><Pencil className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Hapus ${l.nama}?`) && hapus.mutate(l.id)} data-testid={`btn-hapus-lapak-${l.id}`}><Trash2 className="size-4 text-red-600" /></Button>
                  </>))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <SewaLapakDialog lapak={assign} mode="admin" onClose={() => setAssign(null)} />
    </div>
  );
}
