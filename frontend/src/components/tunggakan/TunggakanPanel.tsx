import { AlertTriangle } from "lucide-react";
import { formatRupiah } from "@/utils/format";
import type { RekapTunggakan } from "@/types";
import { Button } from "@/components/ui/button";
import type { PilihTunggakan } from "./BayarTunggakanDialog";

// Peringatan tunggakan pedagang di hasil Pindai QR + tombol konfirmasi pembayaran.
export function TunggakanPanel({ rekap, onPilih }: { rekap: RekapTunggakan; onPilih: (p: PilihTunggakan) => void }) {
  if (!rekap.iuran.length && !rekap.sewa.length) {
    return <p className="rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand" data-testid="scan-tanpa-tunggakan">Tidak ada tunggakan.</p>;
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4" data-testid="scan-tunggakan">
      <p className="flex items-center gap-2 font-semibold text-red-800"><AlertTriangle className="size-4" /> Pedagang memiliki tunggakan {formatRupiah(rekap.total_iuran + rekap.total_sewa)}</p>
      <div className="mt-3 flex flex-col gap-2">
        {rekap.iuran.map((t) => (
          <div key={`i-${t.sewa_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
            <span>Iuran {t.lapak_nama}: <b>{t.tanggal.length} hari</b> • {formatRupiah(t.total)}</span>
            <Button size="sm" onClick={() => onPilih({ jenis: "iuran", data: t })} data-testid={`btn-scan-tunggakan-iuran-${t.sewa_id}`}>Konfirmasi Pembayaran</Button>
          </div>
        ))}
        {rekap.sewa.map((t) => (
          <div key={`s-${t.sewa_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
            <span>Sewa {t.lapak_nama}: sisa <b>{formatRupiah(t.sisa)}</b></span>
            <Button size="sm" variant="outline" onClick={() => onPilih({ jenis: "sewa", data: t })} data-testid={`btn-scan-tunggakan-sewa-${t.sewa_id}`}>Konfirmasi Pembayaran</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
