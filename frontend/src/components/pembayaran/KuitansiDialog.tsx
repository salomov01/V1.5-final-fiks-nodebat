import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Printer } from "lucide-react";
import { apiGet } from "@/services/api";
import { BRANDING } from "@/config";
import { formatDateID, formatDateTimeID, formatRupiah, nomorWA } from "@/utils/format";
import type { Kuitansi } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const noKuitansi = (k: Kuitansi) => `KW-${k.payment.tanggal.replaceAll("-", "")}-${k.payment.id.slice(0, 6).toUpperCase()}`;
const fmtPeriode = (p: string) => p.replace(/\d{4}-\d{2}-\d{2}/g, formatDateID);
const labelJenis = (j: string) => (j === "sewa" ? "Sewa Lapak" : "Iuran Harian");

function pesanWA(k: Kuitansi): string {
  const p = k.payment;
  return [
    `*KUITANSI PEMBAYARAN*`, `${BRANDING.namaPasar} — ${BRANDING.namaDesa}`, ``,
    `No: ${noKuitansi(k)}`, `Tanggal: ${formatDateID(p.tanggal)}`, `Nama: ${p.nama} (${p.user_id})`,
    `Lapak: ${p.lapak_nama}`, `Pembayaran: ${labelJenis(p.jenis)}`, `Periode: ${fmtPeriode(p.periode)}`,
    `Jumlah: *${formatRupiah(p.jumlah)}*`, `Status: LUNAS`, `Penagih: ${p.penagih}`,
    ...(p.jenis === "sewa" && k.sisa_sewa !== null ? [`Sisa sewa: ${formatRupiah(k.sisa_sewa)}`] : []),
    ``, `Terima kasih.`,
  ].join("\n");
}

function Baris({ l, v, id }: { l: string; v: string; id?: string }) {
  return <div className="flex justify-between gap-4 border-b border-dashed py-1.5 text-sm"><span className="text-slate-500">{l}</span><span className="text-right font-medium" data-testid={id}>{v}</span></div>;
}

function Lembar({ k }: { k: Kuitansi }) {
  const p = k.payment;
  return (
    <div id="kuitansi-print" className="print-area bg-white p-6 text-slate-900" data-testid="kuitansi-lembar">
      <div className="flex items-start justify-between border-b-2 border-brand pb-3">
        <div><p className="text-lg font-bold text-brand">{BRANDING.namaPasar}</p><p className="text-xs text-slate-500">{BRANDING.namaDesa}</p></div>
        <div className="text-right"><p className="text-sm font-bold tracking-widest">KUITANSI</p><p className="font-mono text-xs" data-testid="kuitansi-nomor">{noKuitansi(k)}</p></div>
      </div>
      <div className="mt-3">
        <Baris l="Tanggal" v={formatDateTimeID(p.created_at)} />
        <Baris l="Diterima dari" v={`${p.nama} (${p.user_id})`} id="kuitansi-nama" />
        <Baris l="Lapak" v={p.lapak_nama} />
        <Baris l="Untuk pembayaran" v={labelJenis(p.jenis)} id="kuitansi-jenis" />
        <Baris l="Periode" v={fmtPeriode(p.periode)} />
        {p.jenis === "sewa" && k.sisa_sewa !== null && <Baris l="Sisa sewa" v={formatRupiah(k.sisa_sewa)} />}
        <Baris l="Penagih" v={p.penagih} />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
        <span className="text-sm font-semibold">Jumlah</span><span className="font-mono text-xl font-bold text-brand" data-testid="kuitansi-jumlah">{formatRupiah(p.jumlah)}</span>
      </div>
      <div className="mt-6 flex items-end justify-between text-xs">
        <span className="rounded border-2 border-brand px-3 py-1 font-bold tracking-widest text-brand">LUNAS</span>
        <div className="text-center"><p>{BRANDING.jabatanPenandatangan}</p><div className="h-12" /><p className="border-t border-slate-400 px-6 pt-1 font-medium">{p.penagih}</p></div>
      </div>
    </div>
  );
}

// Kuitansi pembayaran: cetak (A4/setengah A4) atau buka WhatsApp dengan pesan siap kirim.
export function KuitansiDialog({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const { data: k } = useQuery({ queryKey: ["kuitansi", paymentId], queryFn: () => apiGet<Kuitansi>(`/payments/${paymentId}/kuitansi`), enabled: !!paymentId });
  const wa = k ? `https://wa.me/${nomorWA(k.no_hp)}?text=${encodeURIComponent(pesanWA(k))}` : "";
  return (
    <Dialog open={!!paymentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="kuitansi-dialog">
        <DialogHeader><DialogTitle>Kuitansi Pembayaran</DialogTitle></DialogHeader>
        {!k ? <p className="py-10 text-center text-sm text-muted-foreground">Memuat kuitansi…</p> : (
          <>
            <div className="rounded-xl border"><Lembar k={k} /></div>
            {!k.no_hp && <p className="text-xs text-amber-700" data-testid="kuitansi-tanpa-hp">Nomor HP pedagang belum diisi — pilih kontak penerima di WhatsApp.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => window.print()} data-testid="btn-cetak-kuitansi"><Printer data-icon="inline-start" className="size-4" /> Cetak</Button>
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })} data-testid="btn-wa-kuitansi"><MessageCircle className="size-4" /> Kirim WhatsApp</a>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
