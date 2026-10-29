import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { BRANDING } from "@/config";
import type { Pedagang } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Kartu QR permanen pedagang. Isi QR = User ID (mis. 01-123) — tidak berubah selamanya.
export default function QrCardDialog({ pedagang, onClose }: { pedagang: Pedagang | null; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState("");
  useEffect(() => {
    if (!pedagang) return;
    let batal = false;
    QRCode.toDataURL(pedagang.user_id, { width: 460, margin: 1, color: { dark: "#1E4E42", light: "#FFFFFF" } })
      .then((url) => { if (!batal) setQrUrl(url); })
      .catch(() => setQrUrl(""));
    return () => { batal = true; };
  }, [pedagang]);

  const unduh = () => {
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `QR-${pedagang?.user_id}.png`;
    a.click();
  };

  return (
    <Dialog open={!!pedagang} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" data-testid="dialog-qr-pedagang">
        <DialogHeader>
          <DialogTitle>QR Code Pedagang</DialogTitle>
          <DialogDescription>Cetak & tempel di lapak. QR ini permanen.</DialogDescription>
        </DialogHeader>
        {pedagang && (
          <div className="print-area flex flex-col items-center gap-2 rounded-2xl border-2 border-brand p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">{BRANDING.namaPasar}</p>
            {qrUrl && <img src={qrUrl} alt={`QR ${pedagang.user_id}`} className="size-52" data-testid="qr-image" />}
            <p className="text-lg font-bold" data-testid="qr-nama">{pedagang.nama}</p>
            <p className="font-mono text-2xl font-bold text-brand" data-testid="qr-user-id">{pedagang.user_id}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={unduh} disabled={!qrUrl} data-testid="btn-unduh-qr"><Download data-icon="inline-start" className="size-4" /> Unduh</Button>
          <Button onClick={() => window.print()} data-testid="btn-cetak-qr"><Printer data-icon="inline-start" className="size-4" /> Cetak</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
