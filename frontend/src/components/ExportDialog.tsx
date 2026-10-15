import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import { KATEGORI_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KATEGORI_OPSI: Record<string, string> = { semua: "Semua kategori", ...KATEGORI_LABEL };
const STATUS_OPSI: Record<string, string> = {
  semua: "Semua status",
  menunggu: "Menunggu",
  lunas: "Lunas",
  ditolak: "Ditolak",
};

export default function ExportDialog({ open, onOpenChange }: Props) {
  const [bulan, setBulan] = useState("");
  const [kategori, setKategori] = useState("semua");
  const [status, setStatus] = useState("semua");

  const unduh = () => {
    const params = new URLSearchParams();
    if (bulan) params.set("bulan", bulan);
    if (kategori !== "semua") params.set("kategori", kategori);
    if (status !== "semua") params.set("status", status);
    const qs = params.toString();
    // Anchor same-origin: cookie sesi httpOnly ikut terkirim pada unduhan file.
    const anchor = document.createElement("a");
    anchor.href = `/api/laporan/pembayaran.xlsx${qs ? `?${qs}` : ""}`;
    anchor.download = "";
    anchor.click();
    toast.success("Laporan Excel sedang diunduh");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-ekspor">
        <DialogHeader>
          <DialogTitle>Ekspor Laporan Excel</DialogTitle>
          <DialogDescription>
            Batasi rekap pada bulan, kategori sewa, atau status tertentu. Biarkan kosong untuk
            mengekspor seluruh data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ekspor-bulan">Bulan (opsional)</Label>
            <Input
              id="ekspor-bulan"
              data-testid="input-ekspor-bulan"
              type="month"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Kategori Sewa</Label>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger className="w-full" data-testid="select-ekspor-kategori">
                <SelectValue>{(v) => KATEGORI_OPSI[v as string]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua kategori</SelectItem>
                <SelectItem value="harian">Harian</SelectItem>
                <SelectItem value="bulanan">Bulanan</SelectItem>
                <SelectItem value="tahunan">Tahunan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Status Pembayaran</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full" data-testid="select-ekspor-status">
                <SelectValue>{(v) => STATUS_OPSI[v as string]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua status</SelectItem>
                <SelectItem value="menunggu">Menunggu</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
                <SelectItem value="ditolak">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-batal-ekspor">
            Batal
          </Button>
          <Button onClick={unduh} data-testid="btn-unduh-ekspor">
            <FileSpreadsheet data-icon="inline-start" className="size-4" />
            Unduh Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
