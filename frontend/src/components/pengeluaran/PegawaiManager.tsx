import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserCog, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatRupiah } from "@/utils/format";
import type { Pegawai } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KOSONG = { nama: "", jabatan: "", gaji_bulanan: "" };

// Pegawai Penerima Gaji tanpa akun login (mis. Mangku Pasar, Plt. Kepala Pasar). Pemungut diatur di Settings.
export function PegawaiManager() {
  const qc = useQueryClient();
  const [f, setF] = useState(KOSONG);
  const [editId, setEditId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["pegawai"], queryFn: () => apiGet<Pegawai[]>("/pengeluaran/pegawai") });
  const done = (msg: string) => {
    for (const k of ["pegawai", "penerima-gaji"]) void qc.invalidateQueries({ queryKey: [k] });
    setF(KOSONG); setEditId(null); toast.success(msg);
  };
  const simpan = useMutation({
    mutationFn: () => {
      const body = { nama: f.nama.trim(), jabatan: f.jabatan.trim(), gaji_bulanan: Number(f.gaji_bulanan) || 0 };
      return editId ? apiPut(`/pengeluaran/pegawai/${editId}`, body) : apiPost("/pengeluaran/pegawai", body);
    },
    onSuccess: () => done(editId ? "Pegawai diperbarui" : "Pegawai ditambahkan"),
    onError: (e) => toast.error(errDetail(e, "Nama pegawai minimal 2 karakter")),
  });
  const hapus = useMutation({ mutationFn: (id: string) => apiDelete(`/pengeluaran/pegawai/${id}`), onSuccess: () => done("Pegawai dihapus") });

  return (
    <div className="mt-8 rounded-2xl border bg-card p-5" data-testid="kartu-pegawai">
      <h2 className="flex items-center gap-2 text-base font-bold md:text-lg"><UserCog className="size-5 text-brand" /> Pegawai Penerima Gaji</h2>
      <p className="mt-1 text-sm text-muted-foreground">Penerima catu/gaji tanpa akun login. Gaji Pemungut diatur di Settings › Akun.</p>
      <form className="mt-4 grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
        <Input placeholder="Nama, mis. Wayan Kader" value={f.nama} data-testid="input-pegawai-nama" onChange={(e) => setF({ ...f, nama: e.target.value })} />
        <Input placeholder="Jabatan, mis. Mangku Pasar" value={f.jabatan} data-testid="input-pegawai-jabatan" onChange={(e) => setF({ ...f, jabatan: e.target.value })} />
        <Input type="number" min={0} placeholder="Gaji / bulan" value={f.gaji_bulanan} data-testid="input-pegawai-gaji" onChange={(e) => setF({ ...f, gaji_bulanan: e.target.value })} />
        <Button type="submit" disabled={simpan.isPending} data-testid="btn-simpan-pegawai">{editId ? <Pencil data-icon="inline-start" className="size-4" /> : <Plus data-icon="inline-start" className="size-4" />} {editId ? "Simpan" : "Tambah"}</Button>
        {editId && <Button type="button" variant="ghost" onClick={() => { setEditId(null); setF(KOSONG); }} data-testid="btn-batal-pegawai"><X className="size-4" /></Button>}
      </form>
      <div className="mt-4 divide-y rounded-xl border" data-testid="daftar-pegawai">
        {data?.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Belum ada pegawai.</p>}
        {data?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3" data-testid={`pegawai-${p.id}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{p.nama}</p>
              <p className="text-xs text-muted-foreground">{p.jabatan || "Pegawai"} • {formatRupiah(p.gaji_bulanan)}/bulan</p>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => { setEditId(p.id); setF({ nama: p.nama, jabatan: p.jabatan, gaji_bulanan: String(p.gaji_bulanan) }); }} data-testid={`btn-edit-pegawai-${p.id}`}><Pencil className="size-4" /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Hapus ${p.nama}?`) && hapus.mutate(p.id)} data-testid={`btn-hapus-pegawai-${p.id}`}><Trash2 className="size-4 text-red-600" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
