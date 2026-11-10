import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { apiGet } from "@/services/api";
import { formatDateID, formatRupiah } from "@/utils/format";
import type { RekapTunggakan } from "@/types";
import { KuitansiDialog } from "@/components/pembayaran/KuitansiDialog";
import { BayarTunggakanDialog, type PilihTunggakan } from "@/components/tunggakan/BayarTunggakanDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const cocok = (q: string, t: { nama: string; user_id: string | null; lapak_nama: string }) =>
  `${t.nama} ${t.user_id ?? ""} ${t.lapak_nama}`.toLowerCase().includes(q.toLowerCase());

// Rekap Tunggakan Iuran & Sewa Lapak + konfirmasi pembayaran langsung (Super Admin & Pemungut).
export default function Tunggakan() {
  const [q, setQ] = useState("");
  const [pilih, setPilih] = useState<PilihTunggakan | null>(null);
  const [kuitansi, setKuitansi] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["tunggakan"], queryFn: () => apiGet<RekapTunggakan>("/tunggakan") });
  const iuran = (data?.iuran ?? []).filter((t) => cocok(q, t));
  const sewa = (data?.sewa ?? []).filter((t) => cocok(q, t));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-tunggakan">Tunggakan</h1>
      <p className="mt-1 text-sm text-muted-foreground">Iuran dihitung sejak {data ? formatDateID(data.mulai_hitung) : "…"} sampai kemarin. Sewa dihitung sejak masa sewa dimulai.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Ringkas label="Tunggakan Iuran" nilai={data?.total_iuran ?? 0} jumlah={data?.iuran.length ?? 0} id="total-tunggakan-iuran" />
        <Ringkas label="Tunggakan Sewa Lapak" nilai={data?.total_sewa ?? 0} jumlah={data?.sewa.length ?? 0} id="total-tunggakan-sewa" />
      </div>
      <Tabs defaultValue="iuran" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="iuran" data-testid="tab-tunggakan-iuran">Tunggakan Iuran ({iuran.length})</TabsTrigger>
            <TabsTrigger value="sewa" data-testid="tab-tunggakan-sewa">Tunggakan Sewa Lapak ({sewa.length})</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama, User ID, lapak" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-cari-tunggakan" />
          </div>
        </div>
        <TabsContent value="iuran">
          <Tabel kolom={["Pedagang", "Lapak", "Hari", "Total", ""]} kosong={!iuran.length}>
            {iuran.map((t) => (
              <TableRow key={t.sewa_id} data-testid={`row-tunggakan-iuran-${t.sewa_id}`}>
                <TableCell><p className="font-medium">{t.nama}</p><p className="font-mono text-xs text-muted-foreground">{t.user_id}</p></TableCell>
                <TableCell>{t.lapak_nama}</TableCell>
                <TableCell>{t.tanggal.length} hari <span className="block text-xs text-muted-foreground">{formatDateID(t.tanggal[0])} – {formatDateID(t.tanggal[t.tanggal.length - 1])}</span></TableCell>
                <TableCell className="font-mono font-semibold text-red-700">{formatRupiah(t.total)}</TableCell>
                <TableCell><Button size="sm" onClick={() => setPilih({ jenis: "iuran", data: t })} data-testid={`btn-detail-tunggakan-iuran-${t.sewa_id}`}>Detail & Bayar</Button></TableCell>
              </TableRow>
            ))}
          </Tabel>
        </TabsContent>
        <TabsContent value="sewa">
          <Tabel kolom={["Pedagang", "Lapak", "Masa Sewa", "Terbayar", "Sisa", ""]} kosong={!sewa.length}>
            {sewa.map((t) => (
              <TableRow key={t.sewa_id} data-testid={`row-tunggakan-sewa-${t.sewa_id}`}>
                <TableCell><p className="font-medium">{t.nama}</p><p className="font-mono text-xs text-muted-foreground">{t.user_id}</p></TableCell>
                <TableCell>{t.lapak_nama}</TableCell>
                <TableCell className="text-xs">{formatDateID(t.mulai)} – {formatDateID(t.selesai)}</TableCell>
                <TableCell className="font-mono">{formatRupiah(t.terbayar)}</TableCell>
                <TableCell className="font-mono font-semibold text-red-700">{formatRupiah(t.sisa)}</TableCell>
                <TableCell><Button size="sm" onClick={() => setPilih({ jenis: "sewa", data: t })} data-testid={`btn-detail-tunggakan-sewa-${t.sewa_id}`}>Detail & Bayar</Button></TableCell>
              </TableRow>
            ))}
          </Tabel>
        </TabsContent>
      </Tabs>
      <BayarTunggakanDialog pilih={pilih} onClose={() => setPilih(null)} onPaid={(id) => { setPilih(null); setKuitansi(id); }} />
      <KuitansiDialog paymentId={kuitansi} onClose={() => setKuitansi(null)} />
    </div>
  );
}

function Ringkas({ label, nilai, jumlah, id }: { label: string; nilai: number; jumlah: number; id: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-red-700" data-testid={id}>{formatRupiah(nilai)}</p>
      <p className="text-xs text-muted-foreground">{jumlah} sewa</p>
    </div>
  );
}

function Tabel({ kolom, kosong, children }: { kolom: string[]; kosong: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow>{kolom.map((k, i) => <TableHead key={i}>{k}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {kosong && <TableRow><TableCell colSpan={kolom.length} className="py-8 text-center text-sm text-muted-foreground">Tidak ada tunggakan.</TableCell></TableRow>}
          {children}
        </TableBody>
      </Table>
    </div>
  );
}
