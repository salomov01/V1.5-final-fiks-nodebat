import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/services/api";
import type { Pendaftaran, Tenant } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errDetail, invalidateKatalog } from "@/components/katalog/PendaftaranList";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultSelesai(kategori: string, mulai: string): string {
  const d = new Date(`${mulai}T00:00:00`);
  if (kategori === "tahunan") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return iso(d);
}

export default function TerimaDialog({ item, onClose, onDone }: {
  item: Pendaftaran | null; onClose: () => void; onDone: (t: Tenant) => void;
}) {
  const qc = useQueryClient();
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  useEffect(() => {
    if (!item) return;
    const m = iso(new Date());
    setMulai(m);
    setSelesai(defaultSelesai(item.kategori, m));
  }, [item]);

  const terima = useMutation({
    mutationFn: () => apiPost<Tenant>(`/pendaftaran/${item?.id}/terima`, { mulai, selesai }),
    onSuccess: (t) => { invalidateKatalog(qc); onDone(t); onClose(); },
    onError: (e) => toast.error(errDetail(e, "Gagal menerima pendaftaran")),
  });

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-terima">
        <DialogHeader>
          <DialogTitle>Terima pendaftaran</DialogTitle>
          <DialogDescription>{item?.nama} akan otomatis menjadi penyewa {item?.blok}.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="terima-mulai">Mulai sewa</Label>
            <Input id="terima-mulai" type="date" value={mulai} data-testid="input-terima-mulai"
              onChange={(e) => { setMulai(e.target.value); if (item) setSelesai(defaultSelesai(item.kategori, e.target.value)); }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="terima-selesai">Selesai sewa</Label>
            <Input id="terima-selesai" type="date" value={selesai} data-testid="input-terima-selesai" onChange={(e) => setSelesai(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={() => terima.mutate()} disabled={terima.isPending || !mulai || !selesai} data-testid="btn-konfirmasi-terima">
            {terima.isPending ? "Memproses..." : "Jadikan penyewa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
