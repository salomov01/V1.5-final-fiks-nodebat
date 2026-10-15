import { toast } from "sonner";
import { Printer } from "lucide-react";
import { BRANDING } from "@/config";
import { METODE_LABEL, formatDateTimeID, formatRupiah, terbilangIDR } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Kuitansi resmi desa — elemen .print-area tunggal dipakai untuk pratinjau layar
 * sekaligus target cetak (lihat @media print di index.css). */
export default function ReceiptDialog({ payment, open, onOpenChange }: Props) {
  return (
    <Dialog open={open && !!payment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-kuitansi">
        <DialogHeader>
          <DialogTitle>Kuitansi Pembayaran</DialogTitle>
          <DialogDescription>
            Pratinjau kuitansi resmi — cetak untuk arsip desa atau serahkan kepada penyewa.
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <>
            <div className="print-area rounded-2xl border border-border p-5" data-testid="kuitansi-preview">
              <div className="border-b border-slate-300 pb-3 text-center">
                <p className="text-sm font-bold tracking-wide text-slate-900 uppercase">{BRANDING.namaDesa}</p>
                <p className="text-xs text-slate-500">{BRANDING.namaPasar} — Kuitansi Resmi</p>
                <p className="mt-1 font-mono text-xs text-slate-700" data-testid="kuitansi-nomor">
                  No. KW-{payment.id.replace(/-/g, "").slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Diterima dari</span>
                  <span className="text-right font-medium text-slate-900" data-testid="kuitansi-nama">
                    {payment.nama_lengkap} ({payment.nomor_id})
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Untuk pembayaran</span>
                  <span className="text-right font-medium text-slate-900">{payment.periode}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Metode</span>
                  <span className="text-right font-medium text-slate-900">{METODE_LABEL[payment.metode]}</span>
                </div>
                {payment.penagih && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Penagih</span>
                    <span className="text-right font-medium text-slate-900" data-testid="kuitansi-penagih">
                      {payment.penagih}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Tanggal konfirmasi</span>
                  <span className="text-right font-medium text-slate-900">
                    {formatDateTimeID(payment.confirmed_at)}
                  </span>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">Jumlah dibayar</p>
                <p className="text-2xl font-bold tracking-tight text-slate-900" data-testid="kuitansi-jumlah">
                  {formatRupiah(payment.jumlah)}
                </p>
                <p className="mt-1 text-xs italic text-slate-600">Terbilang: {terbilangIDR(payment.jumlah)}</p>
              </div>

              <div className="mt-3 flex items-end justify-between text-xs">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-700">
                  LUNAS
                </span>
                <span className="text-right text-slate-500">
                  {BRANDING.jabatanPenandatangan}
                  <br />
                  {BRANDING.namaDesa}
                </span>
              </div>
            </div>

            <Button onClick={() => window.print()} className="w-full" data-testid="btn-cetak-kuitansi">
              <Printer data-icon="inline-start" className="size-4" />
              Cetak Kuitansi
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
