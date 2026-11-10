import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah } from "@/utils/format";
import type { Payment, TunggakanIuran, TunggakanSewa } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PilihTunggakan = { jenis: "iuran"; data: TunggakanIuran } | { jenis: "sewa"; data: TunggakanSewa };

function useBayar(onPaid: (paymentId: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { url: string; body: object }) => apiPost<Payment>(v.url, v.body),
    onSuccess: (p) => {
      toast.success("Pembayaran tunggakan dikonfirmasi");
      for (const k of ["tunggakan", "payments", "dashboard", "sewa"]) void qc.invalidateQueries({ queryKey: [k] });
      onPaid(p.id);
    },
    onError: (e) => toast.error(errDetail(e, "Gagal mengonfirmasi pembayaran")),
  });
}

// Detail & konfirmasi pembayaran tunggakan (iuran: pilih hari, bawaan semua; sewa: nominal bawaan = sisa).
export function BayarTunggakanDialog({ pilih, onClose, onPaid }: { pilih: PilihTunggakan | null; onClose: () => void; onPaid: (paymentId: string) => void }) {
  return (
    <Dialog open={!!pilih} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-tunggakan">
        {pilih && (
          <DialogHeader>
            <DialogTitle>{pilih.jenis === "iuran" ? "Tunggakan Iuran" : "Tunggakan Sewa Lapak"}</DialogTitle>
            <DialogDescription>{pilih.data.nama} ({pilih.data.user_id ?? "-"}) • {pilih.data.lapak_nama}</DialogDescription>
          </DialogHeader>
        )}
        {pilih?.jenis === "iuran" && <FormIuran key={pilih.data.sewa_id} t={pilih.data} onPaid={onPaid} />}
        {pilih?.jenis === "sewa" && <FormSewa key={pilih.data.sewa_id} t={pilih.data} onPaid={onPaid} />}
      </DialogContent>
    </Dialog>
  );
}

function FormIuran({ t, onPaid }: { t: TunggakanIuran; onPaid: (id: string) => void }) {
  const [dipilih, setDipilih] = useState<string[]>(t.tanggal);
  useEffect(() => setDipilih(t.tanggal), [t.tanggal]);
  const bayar = useBayar(onPaid);
  const semua = dipilih.length === t.tanggal.length;
  const toggle = (d: string) => setDipilih((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span>{t.tanggal.length} hari belum bayar • {formatRupiah(t.iuran)}/hari</span>
        <button type="button" className="text-xs font-semibold text-brand hover:underline" data-testid="btn-pilih-semua-hari"
          onClick={() => setDipilih(semua ? [] : t.tanggal)}>{semua ? "Kosongkan" : "Pilih semua"}</button>
      </div>
      <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-xl border p-2" data-testid="daftar-hari-tunggakan">
        {t.tanggal.map((d) => (
          <label key={d} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
            <Checkbox checked={dipilih.includes(d)} onCheckedChange={() => toggle(d)} data-testid={`cek-hari-${d}`} /> {formatDateID(d)}
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
        <span className="text-sm font-semibold">{dipilih.length} hari</span>
        <span className="font-mono text-lg font-bold text-brand" data-testid="total-bayar-tunggakan">{formatRupiah(dipilih.length * t.iuran)}</span>
      </div>
      <Button disabled={!dipilih.length || bayar.isPending} data-testid="btn-konfirmasi-tunggakan"
        onClick={() => bayar.mutate({ url: "/payments/tunggakan-iuran", body: { sewa_id: t.sewa_id, tanggal: dipilih } })}>
        <CheckCircle2 data-icon="inline-start" className="size-4" /> Konfirmasi Pembayaran
      </Button>
    </div>
  );
}

function FormSewa({ t, onPaid }: { t: TunggakanSewa; onPaid: (id: string) => void }) {
  const [jumlah, setJumlah] = useState(String(t.sisa));
  const bayar = useBayar(onPaid);
  const n = Math.min(Number(jumlah) || 0, t.sisa);
  const baris = [["Masa sewa", `${formatDateID(t.mulai)} – ${formatDateID(t.selesai)}`], ["Total sewa", formatRupiah(t.total_harga)], ["Sudah dibayar", formatRupiah(t.terbayar)]];
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border p-3 text-sm">
        {baris.map(([l, v]) => <div key={l} className="flex justify-between py-1"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>)}
        <div className="flex justify-between border-t pt-2 font-semibold"><span>Sisa tunggakan</span><span className="font-mono text-red-700" data-testid="sisa-tunggakan-sewa">{formatRupiah(t.sisa)}</span></div>
      </div>
      <label className="grid gap-1 text-sm font-medium">Jumlah dibayar (Rp)
        <Input type="number" min={1} max={t.sisa} value={jumlah} onChange={(e) => setJumlah(e.target.value)} data-testid="input-jumlah-tunggakan-sewa" />
      </label>
      <Button disabled={n <= 0 || bayar.isPending} data-testid="btn-konfirmasi-tunggakan"
        onClick={() => bayar.mutate({ url: "/payments/sewa", body: { sewa_id: t.sewa_id, jumlah: n } })}>
        <CheckCircle2 data-icon="inline-start" className="size-4" /> Konfirmasi Pembayaran {formatRupiah(n)}
      </Button>
    </div>
  );
}
