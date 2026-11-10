import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Trash2 } from "lucide-react";
import { ExportLaporan } from "@/components/laporan/ExportLaporan";
import { KuitansiDialog } from "@/components/pembayaran/KuitansiDialog";
import { apiDelete, apiGet } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah, todayISO } from "@/utils/format";
import { useAuth } from "@/hooks/useAuth";
import type { PaymentList } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PERIODE = [{ v: "harian", l: "Harian" }, { v: "bulanan", l: "Bulanan" }, { v: "tahunan", l: "Tahunan" }];

// Pembayaran: laporan pemasukan Sewa Lapak & Iuran, filter Harian/Bulanan/Tahunan, ekspor Excel & PDF (Super Admin).
export default function Pembayaran() {
  const qc = useQueryClient();
  const { isSuper } = useAuth();
  const [periode, setPeriode] = useState("bulanan");
  const [tanggal, setTanggal] = useState(todayISO());
  const [jenis, setJenis] = useState("");
  const [kuitansi, setKuitansi] = useState<string | null>(null);
  const qs = new URLSearchParams({ periode, tanggal, ...(jenis ? { jenis } : {}) }).toString();
  const { data } = useQuery({ queryKey: ["payments", qs], queryFn: () => apiGet<PaymentList>(`/payments?${qs}`) });
  const hapus = useMutation({
    mutationFn: (id: string) => apiDelete(`/payments/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payments"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Pembayaran dihapus"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menghapus")),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-pembayaran">Pemasukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Laporan pemasukan Sewa Lapak & Iuran harian.</p>
        </div>
        {isSuper && <ExportLaporan qs={qs} />}
      </div>

      {/* Filter laporan & ekspor */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODE.map((p) => (
          <button key={p.v} type="button" onClick={() => setPeriode(p.v)} data-testid={`filter-periode-${p.v}`}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", periode === p.v ? "border-brand bg-brand text-white" : "bg-white hover:border-brand")}>{p.l}</button>
        ))}
        <Input type="date" className="w-auto" value={tanggal} data-testid="filter-tanggal" onChange={(e) => setTanggal(e.target.value || todayISO())} />
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} data-testid="filter-jenis" className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="">Semua jenis</option><option value="sewa">Sewa Lapak</option><option value="iuran">Iuran</option>
        </select>
      </div>

      {data && data.total !== null && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="ringkasan-pembayaran">
          {[["Pemasukan Sewa Lapak", data.total_sewa, "total-sewa"], ["Pemasukan Iuran", data.total_iuran, "total-iuran"], ["Total Pemasukan", data.total, "total-semua"]].map(([l, v, id]) => (
            <div key={id as string} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p>
              <p className="font-mono text-xl font-bold text-brand" data-testid={id as string}>{formatRupiah(Number(v))}</p></div>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nama</TableHead><TableHead>ID</TableHead><TableHead>Periode Sewa</TableHead><TableHead>Harga/Jumlah</TableHead><TableHead>Penagih</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {data?.items.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Belum ada pembayaran pada periode ini.</TableCell></TableRow>}
            {data?.items.map((p) => (
              <TableRow key={p.id} data-testid={`row-bayar-${p.id}`}>
                <TableCell className="font-medium">{p.nama}</TableCell>
                <TableCell className="font-mono text-xs">{p.user_id}</TableCell>
                <TableCell className="text-xs"><span className={cn("mr-1 rounded px-1.5 py-0.5 font-semibold", p.jenis === "sewa" ? "bg-brand-50 text-brand" : "bg-slate-100")}>{p.jenis === "sewa" ? "Sewa" : "Iuran"}</span>{p.lapak_nama} — {p.periode}</TableCell>
                <TableCell className="font-mono">{formatRupiah(p.jumlah)}</TableCell>
                <TableCell>{p.penagih}</TableCell>
                <TableCell>{formatDateID(p.tanggal)}</TableCell>
                <TableCell><span className="text-xs font-semibold text-brand">Lunas</span></TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button size="icon-sm" variant="ghost" title="Kuitansi" onClick={() => setKuitansi(p.id)} data-testid={`btn-kuitansi-${p.id}`}><Receipt className="size-4 text-brand" /></Button>
                  {isSuper && <Button size="icon-sm" variant="ghost" onClick={() => confirm("Hapus pembayaran ini?") && hapus.mutate(p.id)} data-testid={`btn-hapus-bayar-${p.id}`}><Trash2 className="size-4 text-red-600" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <KuitansiDialog paymentId={kuitansi} onClose={() => setKuitansi(null)} />
    </div>
  );
}
