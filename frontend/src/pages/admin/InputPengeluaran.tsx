import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah, todayISO } from "@/utils/format";
import type { KategoriPengeluaran, Pengeluaran, UserAccount } from "@/types";
import { ExportLaporan } from "@/components/laporan/ExportLaporan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const KATEGORI: { v: KategoriPengeluaran; l: string }[] = [
  { v: "barang", l: "Barang" }, { v: "jasa", l: "Jasa" }, { v: "daya", l: "Daya" },
  { v: "operasional", l: "Operasional Lain-lain" }, { v: "gaji", l: "Gaji" },
];
const LABEL = Object.fromEntries(KATEGORI.map((k) => [k.v, k.l]));
const PERIODE = [{ v: "harian", l: "Harian" }, { v: "bulanan", l: "Bulanan" }, { v: "tahunan", l: "Tahunan" }];
const SELECT = "h-9 rounded-lg border border-input bg-background px-2 text-sm";

// Input Pengeluaran (khusus Super Admin). Kategori Gaji: pilih Pemungut → nominal dari gaji dasar akunnya.
export default function InputPengeluaran() {
  const [periode, setPeriode] = useState("bulanan");
  const [tanggal, setTanggal] = useState(todayISO());
  const qs = new URLSearchParams({ periode, tanggal }).toString();
  const { data } = useQuery({ queryKey: ["pengeluaran", qs], queryFn: () => apiGet<{ items: Pengeluaran[]; total: number }>(`/pengeluaran?${qs}`) });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-pengeluaran">Input Pengeluaran</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catat pengeluaran pasar: barang, jasa, daya, operasional, dan gaji pemungut.</p>
        </div>
        <ExportLaporan qs={qs} />
      </div>
      <FormPengeluaran />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODE.map((p) => (
          <button key={p.v} type="button" onClick={() => setPeriode(p.v)} data-testid={`filter-periode-${p.v}`}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", periode === p.v ? "border-brand bg-brand text-white" : "bg-white hover:border-brand")}>{p.l}</button>
        ))}
        <Input type="date" className="w-auto" value={tanggal} data-testid="filter-tanggal" onChange={(e) => setTanggal(e.target.value || todayISO())} />
        <div className="ml-auto rounded-xl border bg-card px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
          <p className="font-mono text-lg font-bold text-red-700" data-testid="total-pengeluaran">{formatRupiah(data?.total ?? 0)}</p>
        </div>
      </div>
      <TabelPengeluaran items={data?.items ?? []} />
    </div>
  );
}

const KOSONG = { kategori: "barang" as KategoriPengeluaran, keterangan: "", jumlah: "", tanggal: todayISO(), pemungut_id: "" };

function FormPengeluaran() {
  const qc = useQueryClient();
  const [f, setF] = useState(KOSONG);
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<UserAccount[]>("/users") });
  const pemungut = (users ?? []).filter((u) => u.role === "staff");
  const gaji = f.kategori === "gaji";
  const pilihPemungut = (id: string) => {
    const u = pemungut.find((x) => x.id === id);
    setF({ ...f, pemungut_id: id, jumlah: u?.gaji_bulanan ? String(u.gaji_bulanan) : "" });
  };
  const simpan = useMutation({
    mutationFn: () => apiPost<Pengeluaran>("/pengeluaran", {
      kategori: f.kategori, keterangan: f.keterangan, tanggal: f.tanggal, jumlah: Number(f.jumlah) || null,
      ...(gaji ? { pemungut_id: f.pemungut_id || null } : {}),
    }),
    onSuccess: () => { setF({ ...KOSONG, kategori: f.kategori }); void qc.invalidateQueries({ queryKey: ["pengeluaran"] }); toast.success("Pengeluaran dicatat"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menyimpan pengeluaran")),
  });

  return (
    <form className="mt-6 grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-6" data-testid="form-pengeluaran"
      onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
      <div className="grid gap-1.5"><Label htmlFor="kategori">Kategori</Label>
        <select id="kategori" className={SELECT} value={f.kategori} data-testid="select-kategori"
          onChange={(e) => setF({ ...KOSONG, tanggal: f.tanggal, kategori: e.target.value as KategoriPengeluaran })}>
          {KATEGORI.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
        </select></div>
      {gaji && (
        <div className="grid gap-1.5"><Label htmlFor="pemungut">Pemungut</Label>
          <select id="pemungut" className={SELECT} value={f.pemungut_id} data-testid="select-pemungut" onChange={(e) => pilihPemungut(e.target.value)}>
            <option value="">— pilih pemungut —</option>
            {pemungut.map((u) => <option key={u.id} value={u.id}>{u.nama} ({formatRupiah(u.gaji_bulanan)}/bln)</option>)}
          </select></div>
      )}
      <div className={cn("grid gap-1.5", gaji ? "lg:col-span-1" : "lg:col-span-2")}><Label htmlFor="keterangan">Keterangan</Label>
        <Input id="keterangan" value={f.keterangan} placeholder={gaji ? "Otomatis: Gaji [nama] bulan [YYYY-MM]" : "mis. Sapu & tempat sampah"}
          data-testid="input-keterangan" onChange={(e) => setF({ ...f, keterangan: e.target.value })} /></div>
      <div className="grid gap-1.5"><Label htmlFor="jumlah">Jumlah (Rp)</Label>
        <Input id="jumlah" type="number" min={1} value={f.jumlah} data-testid="input-jumlah" onChange={(e) => setF({ ...f, jumlah: e.target.value })} /></div>
      <div className="grid gap-1.5"><Label htmlFor="tgl">Tanggal</Label>
        <Input id="tgl" type="date" value={f.tanggal} data-testid="input-tanggal-pengeluaran" onChange={(e) => setF({ ...f, tanggal: e.target.value || todayISO() })} /></div>
      <Button type="submit" className="self-end" disabled={simpan.isPending} data-testid="btn-simpan-pengeluaran"><Plus data-icon="inline-start" className="size-4" /> Simpan</Button>
      {gaji && <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-6">Nominal terisi dari gaji dasar akun Pemungut (atur di Settings › Akun). Satu catatan gaji per pemungut per bulan.</p>}
    </form>
  );
}

function TabelPengeluaran({ items }: { items: Pengeluaran[] }) {
  const qc = useQueryClient();
  const hapus = useMutation({
    mutationFn: (id: string) => apiDelete(`/pengeluaran/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pengeluaran"] }); toast.success("Pengeluaran dihapus"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menghapus")),
  });
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Kategori</TableHead><TableHead>Keterangan</TableHead><TableHead>Penerima</TableHead><TableHead>Jumlah</TableHead><TableHead>Dicatat oleh</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Belum ada pengeluaran pada periode ini.</TableCell></TableRow>}
          {items.map((p) => (
            <TableRow key={p.id} data-testid={`row-pengeluaran-${p.id}`}>
              <TableCell>{formatDateID(p.tanggal)}</TableCell>
              <TableCell><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">{LABEL[p.kategori]}</span></TableCell>
              <TableCell>{p.keterangan}</TableCell>
              <TableCell>{p.penerima || "-"}</TableCell>
              <TableCell className="font-mono">{formatRupiah(p.jumlah)}</TableCell>
              <TableCell>{p.dicatat_oleh}</TableCell>
              <TableCell><Button size="icon-sm" variant="ghost" onClick={() => confirm("Hapus pengeluaran ini?") && hapus.mutate(p.id)} data-testid={`btn-hapus-pengeluaran-${p.id}`}><Trash2 className="size-4 text-red-600" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
