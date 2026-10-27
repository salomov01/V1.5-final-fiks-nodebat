import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { BRANDING, KONTAK_ADMIN } from "@/config";
import { ApiError, apiPost } from "@/services/api";
import { formatRupiah, KATEGORI_LABEL } from "@/utils/format";
import type { LapakPublik, Pendaftaran } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function waLink(p: Pendaftaran): string {
  const text = [
    `Om Swastiastu, saya ingin mendaftar sewa lapak di ${BRANDING.namaPasar}.`,
    `Nama: ${p.nama}`,
    `No. HP: ${p.no_hp}`,
    `Lapak: ${p.blok} (sewa ${KATEGORI_LABEL[p.kategori]}, ${formatRupiah(p.tarif)})`,
    p.catatan ? `Catatan: ${p.catatan}` : "",
    `Kode pendaftaran: ${p.id.slice(0, 8).toUpperCase()}`,
    `Konfirmasi di: ${window.location.origin}/dashboard/pendaftaran`,
  ].filter(Boolean).join("\n");
  return `https://wa.me/${KONTAK_ADMIN.whatsapp}?text=${encodeURIComponent(text)}`;
}

export default function DaftarLapakDialog({ lapak, onClose }: { lapak: LapakPublik | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nama: "", no_hp: "", catatan: "" });
  const [hasil, setHasil] = useState<Pendaftaran | null>(null);

  const daftar = useMutation({
    mutationFn: () => apiPost<Pendaftaran>("/publik/pendaftaran", { ...form, lapak_id: lapak?.id }),
    onSuccess: (p) => setHasil(p),
    onError: (e) => {
      const d = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
        ? (e.body as { detail: unknown }).detail : null;
      toast.error(typeof d === "string" ? d : "Periksa kembali nama & nomor HP (min. 8 angka)");
      if (e instanceof ApiError && e.status === 409) void qc.invalidateQueries({ queryKey: ["publik"] });
    },
  });

  const close = () => {
    setForm({ nama: "", no_hp: "", catatan: "" });
    setHasil(null);
    onClose();
  };

  return (
    <Dialog open={!!lapak} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-daftar-lapak">
        <DialogHeader>
          <DialogTitle>{hasil ? "Pendaftaran terkirim" : "Daftar sewa lapak"}</DialogTitle>
          <DialogDescription>
            {lapak?.blok} • {lapak && formatRupiah(lapak.tarif)} ({lapak && KATEGORI_LABEL[lapak.kategori]})
          </DialogDescription>
        </DialogHeader>
        {hasil ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center" data-testid="daftar-sukses">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Data Anda sudah tercatat. Kirim pesan WhatsApp ke admin agar pendaftaran segera dikonfirmasi.
            </p>
            <a href={waLink(hasil)} target="_blank" rel="noopener noreferrer" data-testid="btn-kirim-wa-admin"
              className={cn(buttonVariants(), "w-full !bg-emerald-600 !text-white hover:!bg-emerald-700")}>
              <MessageCircle data-icon="inline-start" className="size-4" /> Kirim ke WhatsApp Admin
            </a>
            <Button variant="ghost" onClick={close} data-testid="btn-tutup-daftar">Tutup</Button>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); daftar.mutate(); }}>
            <div className="grid gap-2">
              <Label htmlFor="daftar-nama">Nama lengkap</Label>
              <Input id="daftar-nama" data-testid="input-daftar-nama" required minLength={2} value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daftar-hp">Nomor WhatsApp</Label>
              <Input id="daftar-hp" data-testid="input-daftar-hp" required inputMode="tel" placeholder="0812xxxxxxxx"
                value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daftar-catatan">Jenis dagangan / catatan (opsional)</Label>
              <Textarea id="daftar-catatan" data-testid="input-daftar-catatan" value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
            </div>
            <Button type="submit" disabled={daftar.isPending} data-testid="btn-kirim-pendaftaran">
              {daftar.isPending ? "Mengirim..." : "Daftar & lanjut ke WhatsApp"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
