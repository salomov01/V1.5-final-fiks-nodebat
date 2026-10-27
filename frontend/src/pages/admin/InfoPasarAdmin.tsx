import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID } from "@/utils/format";
import type { Berita, InfoPasar } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Halaman admin "Info Pasar" (khusus Super Admin): jam buka/tutup, status, pengumuman & berita.
export default function InfoPasarAdmin() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-info-pasar-admin">Info Pasar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Isi halaman publik "Info Pasar": status buka/tutup dan berita.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StatusPasarForm />
        <BeritaManager />
      </div>
    </div>
  );
}

function StatusPasarForm() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["publik", "info-pasar"], queryFn: () => apiGet<InfoPasar>("/publik/info-pasar") });
  const [form, setForm] = useState<Omit<InfoPasar, "buka_sekarang">>({ jam_buka: "05:00", jam_tutup: "12:00", mode: "otomatis", pengumuman: "" });
  useEffect(() => { if (data) setForm({ jam_buka: data.jam_buka, jam_tutup: data.jam_tutup, mode: data.mode, pengumuman: data.pengumuman }); }, [data]);
  const simpan = useMutation({
    mutationFn: () => apiPut<InfoPasar>("/info-pasar", form),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["publik"] }); toast.success("Info pasar disimpan"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menyimpan info pasar")),
  });

  return (
    <Card data-testid="kartu-status-pasar">
      <CardHeader>
        <CardTitle>Status &amp; Jam Pasar</CardTitle>
        <CardDescription>Saat ini: <b data-testid="status-pasar-admin">{data?.buka_sekarang ? "BUKA" : "TUTUP"}</b></CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="jam-buka">Jam buka</Label>
              <Input id="jam-buka" type="time" value={form.jam_buka} data-testid="input-jam-buka" onChange={(e) => setForm({ ...form, jam_buka: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="jam-tutup">Jam tutup</Label>
              <Input id="jam-tutup" type="time" value={form.jam_tutup} data-testid="input-jam-tutup" onChange={(e) => setForm({ ...form, jam_tutup: e.target.value })} /></div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mode-pasar">Status</Label>
            <select id="mode-pasar" value={form.mode} data-testid="select-mode-pasar" className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              onChange={(e) => setForm({ ...form, mode: e.target.value as InfoPasar["mode"] })}>
              <option value="otomatis">Otomatis (ikut jam buka/tutup)</option>
              <option value="buka">Paksa BUKA</option>
              <option value="tutup">Paksa TUTUP (mis. hari raya)</option>
            </select>
          </div>
          <div className="grid gap-2"><Label htmlFor="pengumuman">Pengumuman singkat</Label>
            <Input id="pengumuman" value={form.pengumuman} data-testid="input-pengumuman" onChange={(e) => setForm({ ...form, pengumuman: e.target.value })} /></div>
          <Button type="submit" disabled={simpan.isPending} data-testid="btn-simpan-info-pasar">Simpan</Button>
        </form>
      </CardContent>
    </Card>
  );
}

const BERITA_KOSONG = { judul: "", isi: "", tanggal: new Date().toISOString().slice(0, 10) };

function BeritaManager() {
  const qc = useQueryClient();
  const [form, setForm] = useState(BERITA_KOSONG);
  const [editId, setEditId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["publik", "berita"], queryFn: () => apiGet<Berita[]>("/publik/berita") });
  const done = (msg: string) => { void qc.invalidateQueries({ queryKey: ["publik"] }); setForm(BERITA_KOSONG); setEditId(null); toast.success(msg); };
  const simpan = useMutation({
    mutationFn: () => (editId ? apiPut(`/berita/${editId}`, form) : apiPost("/berita", form)),
    onSuccess: () => done("Berita disimpan"),
    onError: (e) => toast.error(errDetail(e, "Judul & isi minimal 3 karakter")),
  });
  const hapus = useMutation({ mutationFn: (id: string) => apiDelete(`/berita/${id}`), onSuccess: () => done("Berita dihapus") });

  return (
    <Card data-testid="kartu-berita">
      <CardHeader><CardTitle>Berita Pasar</CardTitle><CardDescription>Tampil di halaman publik Info Pasar.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
          <Input placeholder="Judul berita" value={form.judul} data-testid="input-berita-judul" onChange={(e) => setForm({ ...form, judul: e.target.value })} />
          <Textarea placeholder="Isi berita" value={form.isi} data-testid="input-berita-isi" onChange={(e) => setForm({ ...form, isi: e.target.value })} />
          <div className="flex gap-2">
            <Input type="date" value={form.tanggal} data-testid="input-berita-tanggal" onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            <Button type="submit" disabled={simpan.isPending} data-testid="btn-simpan-berita">
              <Plus data-icon="inline-start" className="size-4" /> {editId ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </form>
        <div className="divide-y rounded-xl border" data-testid="daftar-berita-admin">
          {(data ?? []).map((b) => (
            <div key={b.id} className="flex items-start gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{b.judul}</p>
                <p className="text-xs text-muted-foreground">{formatDateID(b.tanggal)}</p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => { setEditId(b.id); setForm({ judul: b.judul, isi: b.isi, tanggal: b.tanggal }); }} data-testid={`btn-edit-berita-${b.id}`}><Pencil className="size-4" /></Button>
              <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Hapus berita "${b.judul}"?`) && hapus.mutate(b.id)} data-testid={`btn-hapus-berita-${b.id}`}><Trash2 className="size-4 text-red-600" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
