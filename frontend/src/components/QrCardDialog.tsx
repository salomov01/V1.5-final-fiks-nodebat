import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { BRANDING } from "@/config";
import type { Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KategoriBadge } from "@/components/Badges";

interface Props {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QrCardDialog({ tenant, open, onOpenChange }: Props) {
  const [qrUrl, setQrUrl] = useState("");
  const payload = tenant
    ? JSON.stringify({ nomor_id: tenant.nomor_id, nama: tenant.nama_lengkap })
    : "";

  // Isi QR hanya: Nama Lengkap + Nomor ID (sesuai spesifikasi).
  // toDataURL + <img>: tidak ada ketergantungan pada ref canvas / timing mount dialog.
  useEffect(() => {
    if (!open || !payload) return;
    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 460,
      margin: 1,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrUrl(dataUrl);
      })
      .catch(() => toast.error("Gagal membuat QR Code"));
    return () => {
      cancelled = true;
    };
  }, [open, payload]);

  useEffect(() => {
    if (!open) setQrUrl("");
  }, [open]);

  const download = () => {
    if (!qrUrl || !tenant) return;
    const anchor = document.createElement("a");
    anchor.href = qrUrl;
    anchor.download = `QR-${tenant.nomor_id}.png`;
    anchor.click();
    toast.success("QR Code berhasil diunduh");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-qr-penyewa">
        <DialogHeader>
          <DialogTitle>QR Code Penyewa</DialogTitle>
          <DialogDescription>
            Pindai QR ini untuk membuka data penyewa dan tagihannya. Isi QR: Nama Lengkap + Nomor ID.
          </DialogDescription>
        </DialogHeader>

        {tenant && (
          <div className="print-area rounded-2xl bg-slate-900 p-6 text-white" data-testid="kartu-qr">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-xs font-bold text-slate-900">
                  JMB
                </span>
                <span className="text-xs font-medium text-slate-300">{BRANDING.namaDesa}</span>
              </div>
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-slate-900">
                ID Lapak
              </span>
            </div>

            <div className="mx-auto mt-5 w-fit rounded-xl bg-white p-3">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR Code ${tenant.nomor_id}`}
                  data-testid="qr-image"
                  className="h-56 w-56"
                />
              ) : (
                <div className="size-56 animate-pulse rounded-lg bg-slate-200" data-testid="qr-loading" />
              )}
            </div>

            <div className="mt-5 text-center">
              <p className="text-lg font-bold" data-testid="qr-nama">
                {tenant.nama_lengkap}
              </p>
              <p
                className="mt-1 font-mono text-sm font-semibold tracking-widest text-amber-400"
                data-testid="qr-nomor-id"
              >
                {tenant.nomor_id}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <KategoriBadge kategori={tenant.kategori} />
                <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
                  {tenant.blok}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={download}
            disabled={!qrUrl}
            data-testid="btn-download-qr"
          >
            <Download data-icon="inline-start" className="size-4" />
            Unduh PNG
          </Button>
          <Button onClick={() => window.print()} disabled={!qrUrl} data-testid="btn-cetak-kartu">
            <Printer data-icon="inline-start" className="size-4" />
            Cetak Kartu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
