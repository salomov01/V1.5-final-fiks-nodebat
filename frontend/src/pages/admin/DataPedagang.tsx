import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, QrCode, Search, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { useAuth } from "@/hooks/useAuth";
import type { Pedagang } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import QrCardDialog from "@/components/lapak/QrCardDialog";

const KOSONG = { nama: "", nik: "", no_hp: "", alamat: "" };

// Halaman Data Pedagang: daftar + QR tiap pedagang, tambah manual, edit langsung di tabel (Super Admin).
export default function DataPedagang() {
  const qc = useQueryClient();
  const { isSuper } = useAuth();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(KOSONG);
  const [edit, setEdit] = useState<Pedagang | null>(null);
  const [qr, setQr] = useState<Pedagang | null>(null);
  const { data } = useQuery({ queryKey: ["pedagang"], queryFn: () => apiGet<Pedagang[]>("/pedagang") });
  const list = (data ?? []).filter((p) => !q || `${p.nama} ${p.user_id}`.toLowerCase().includes(q.toLowerCase()));
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["pedagang"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); };

  const tambah = useMutation({
    mutationFn: () => apiPost<Pedagang>("/pedagang", form),
    onSuccess: (p) => { setForm(KOSONG); refresh(); toast.success(`${p.nama} ditambahkan — User ID ${p.user_id}`); setQr(p); },
    onError: (e) => toast.error(errDetail(e, "Isi nama & NIK (angka) dengan benar")),
  });
  const simpan = useMutation({
    mutationFn: (p: Pedagang) => apiPatch(`/pedagang/${p.id}`, { nama: p.nama, no_hp: p.no_hp, alamat: p.alamat, aktif: p.aktif }),
    onSuccess: () => { setEdit(null); refresh(); toast.success("Data pedagang disimpan"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menyimpan")),
  });
  const hapus = useMutation({
    mutationFn: (id: string) => apiDelete(`/pedagang/${id}`),
    onSuccess: () => { refresh(); toast.success("Pedagang dihapus"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menghapus")),
  });

  const cell = (key: "nama" | "no_hp" | "alamat", p: Pedagang) =>
    edit?.id === p.id
      ? <Input value={edit[key]} data-testid={`inline-${key}-${p.id}`} onChange={(e) => setEdit({ ...edit, [key]: e.target.value })} />
      : p[key] || "-";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-data-pedagang">Data Pedagang</h1>
      <p className="mt-1 text-sm text-muted-foreground">User ID otomatis: [No. urut]-[3 digit akhir KTP]. QR Code tiap pedagang permanen.</p>

      {/* Tambah pedagang manual */}
      <form className="mt-6 grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); tambah.mutate(); }} data-testid="form-tambah-pedagang">
        <Input placeholder="Nama lengkap" value={form.nama} data-testid="input-pedagang-nama" onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        <Input placeholder="NIK / No. KTP" inputMode="numeric" value={form.nik} data-testid="input-pedagang-nik" onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, "") })} />
        <Input placeholder="No. HP" value={form.no_hp} data-testid="input-pedagang-hp" onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
        <Input placeholder="Alamat" value={form.alamat} data-testid="input-pedagang-alamat" onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
        <Button type="submit" disabled={tambah.isPending} data-testid="btn-tambah-pedagang"><Plus data-icon="inline-start" className="size-4" /> Tambah</Button>
      </form>

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama / User ID" value={q} data-testid="input-cari-data-pedagang" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>User ID</TableHead><TableHead>Nama</TableHead><TableHead>NIK</TableHead><TableHead>No. HP</TableHead><TableHead>Alamat</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id} data-testid={`row-pedagang-${p.user_id}`}>
                <TableCell className="font-mono font-semibold text-brand">{p.user_id}</TableCell>
                <TableCell className="font-medium">{cell("nama", p)}</TableCell>
                <TableCell className="font-mono text-xs">{p.nik}</TableCell>
                <TableCell>{cell("no_hp", p)}</TableCell>
                <TableCell className="max-w-64 truncate text-xs">{cell("alamat", p)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="icon-sm" variant="ghost" title="QR Code" onClick={() => setQr(p)} data-testid={`btn-qr-${p.user_id}`}><QrCode className="size-4" /></Button>
                  {isSuper && (edit?.id === p.id ? (<>
                    <Button size="icon-sm" variant="ghost" onClick={() => simpan.mutate(edit)} data-testid={`btn-simpan-inline-${p.user_id}`}><Check className="size-4 text-brand" /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEdit(null)}><X className="size-4" /></Button>
                  </>) : (<>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEdit(p)} data-testid={`btn-edit-inline-${p.user_id}`}><Pencil className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Hapus ${p.nama}?`) && hapus.mutate(p.id)} data-testid={`btn-hapus-pedagang-${p.user_id}`}><Trash2 className="size-4 text-red-600" /></Button>
                  </>))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <QrCardDialog pedagang={qr} onClose={() => setQr(null)} />
    </div>
  );
}
