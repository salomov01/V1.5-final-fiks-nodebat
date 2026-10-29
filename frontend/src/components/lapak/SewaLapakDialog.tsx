import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { BRANDING, KONTAK_ADMIN } from "@/config";
import { apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah, hariSewa, hitungSewa, todayISO } from "@/utils/format";
import type { LapakPublik, PedagangRingkas, Sewa } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PedagangSearch from "@/components/common/PedagangSearch";
import { cn } from "@/lib/utils";

// Pesan WhatsApp konfirmasi sewa → nomor admin di src/config.ts (KONTAK_ADMIN.whatsapp)
function waLink(s: Sewa): string {
  const text = [
    `Om Swastiastu, saya ingin menyewa lapak di ${BRANDING.namaPasar}.`,
    `Nama: ${s.nama}${s.user_id ? ` (ID ${s.user_id})` : ""}`,
    `Lapak: ${s.lapak_nama}`,
    `Durasi: ${formatDateID(s.mulai)} s/d ${formatDateID(s.selesai)} (${s.hari} hari)`,
    `Total sewa: ${formatRupiah(s.total_harga)} • Iuran ${formatRupiah(s.iuran)}/hari`,
    `Kode booking: ${s.id.slice(0, 8).toUpperCase()}`,
    `Konfirmasi di: ${window.location.origin}/dashboard/pendaftaran`,
  ].join("\n");
  return `https://wa.me/${KONTAK_ADMIN.whatsapp}?text=${encodeURIComponent(text)}`;
}

// Form sewa lapak. mode "publik" = booking pengunjung (menunggu konfirmasi);
// mode "admin" = Admin menetapkan (assign) pedagang ke lapak, langsung aktif.
export default function SewaLapakDialog({ lapak, mode, onClose }: { lapak: LapakPublik | null; mode: "publik" | "admin"; onClose: () => void }) {
  const qc = useQueryClient();
  const [pedagang, setPedagang] = useState<PedagangRingkas | null>(null);
  const [baru, setBaru] = useState(false);
  const [form, setForm] = useState({ nama: "", nik: "", no_hp: "", mulai: todayISO(), selesai: "" });
  const [hasil, setHasil] = useState<Sewa | null>(null);
  const hari = hariSewa(form.mulai, form.selesai);
  const total = lapak ? hitungSewa(lapak.harga_sewa, hari) : 0;

  const kirim = useMutation({
    mutationFn: () => mode === "admin"
      ? apiPost<Sewa>("/sewa", { pedagang_id: pedagang?.id, lapak_id: lapak?.id, mulai: form.mulai, selesai: form.selesai })
      : apiPost<Sewa>("/publik/sewa", { lapak_id: lapak?.id, mulai: form.mulai, selesai: form.selesai,
          ...(baru ? { nama: form.nama, nik: form.nik, no_hp: form.no_hp } : { pedagang_id: pedagang?.id }) }),
    onSuccess: (s) => {
      for (const k of ["sewa", "lapak", "publik", "dashboard"]) void qc.invalidateQueries({ queryKey: [k] });
      if (mode === "admin") { toast.success(`${s.nama} ditetapkan ke ${s.lapak_nama}`); close(); } else setHasil(s);
    },
    onError: (e) => toast.error(errDetail(e, "Periksa kembali isian")),
  });

  const close = () => { setPedagang(null); setBaru(false); setHasil(null); setForm({ nama: "", nik: "", no_hp: "", mulai: todayISO(), selesai: "" }); onClose(); };
  const siap = hari > 0 && (baru ? form.nama && form.nik && form.no_hp : pedagang);

  return (
    <Dialog open={!!lapak} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-sewa-lapak">
        <DialogHeader>
          <DialogTitle>{hasil ? "Pendaftaran terkirim" : mode === "admin" ? "Tetapkan Pedagang ke Lapak" : "Sewa Lapak"}</DialogTitle>
          <DialogDescription>{lapak?.nama}</DialogDescription>
        </DialogHeader>
        {hasil ? (
          <div className="flex flex-col items-center gap-4 text-center" data-testid="sewa-sukses">
            <CheckCircle2 className="size-12 text-brand" />
            <p className="text-sm text-muted-foreground">Booking tercatat & menunggu konfirmasi. Kirim WhatsApp ke admin agar segera diproses.</p>
            <a href={waLink(hasil)} target="_blank" rel="noopener noreferrer" data-testid="btn-kirim-wa-admin" className={cn(buttonVariants(), "w-full")}>
              <MessageCircle data-icon="inline-start" className="size-4" /> Kirim ke WhatsApp Admin
            </a>
          </div>
        ) : lapak && (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); kirim.mutate(); }}>
            {/* Harga sewa & iuran satu paket — tampil langsung */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-brand-50 p-3"><p className="text-xs text-brand-700">Harga Lapak / bulan</p>
                <p className="font-mono text-lg font-bold text-brand" data-testid="sewa-harga-bulanan">{formatRupiah(lapak.harga_sewa)}</p></div>
              <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs text-slate-600">Iuran Lapak / hari</p>
                <p className="font-mono text-lg font-bold" data-testid="sewa-iuran-harian">{formatRupiah(lapak.iuran)}</p></div>
            </div>
            <div className="grid gap-2">
              <Label>Akun pedagang</Label>
              {!baru && <PedagangSearch endpoint={mode === "admin" ? "/pedagang" : "/publik/pedagang"} value={pedagang} onSelect={setPedagang} />}
              {mode === "publik" && (
                <button type="button" className="justify-self-start text-xs text-brand underline" data-testid="btn-pedagang-baru"
                  onClick={() => { setBaru(!baru); setPedagang(null); }}>
                  {baru ? "Pilih dari akun pedagang terdaftar" : "Belum terdaftar? Isi data pedagang baru"}
                </button>
              )}
              {baru && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Nama lengkap" value={form.nama} data-testid="input-sewa-nama" onChange={(e) => setForm({ ...form, nama: e.target.value })} />
                  <Input placeholder="NIK / No. KTP" inputMode="numeric" value={form.nik} data-testid="input-sewa-nik" onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, "") })} />
                  <Input placeholder="No. WhatsApp" value={form.no_hp} data-testid="input-sewa-hp" onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label htmlFor="sewa-mulai">Tanggal awal sewa</Label>
                <Input id="sewa-mulai" type="date" value={form.mulai} data-testid="input-sewa-mulai" onChange={(e) => setForm({ ...form, mulai: e.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="sewa-selesai">Tanggal akhir sewa</Label>
                <Input id="sewa-selesai" type="date" min={form.mulai} value={form.selesai} data-testid="input-sewa-selesai" onChange={(e) => setForm({ ...form, selesai: e.target.value })} /></div>
            </div>
            {/* Total dihitung per hari: harga per bulan ÷ 30 × jumlah hari */}
            <div className="flex items-center justify-between rounded-xl border-2 border-brand p-4">
              <span className="text-sm">Total Harga Sewa {hari > 0 && <span className="text-muted-foreground">({hari} hari)</span>}</span>
              <span className="font-mono text-xl font-bold text-brand" data-testid="sewa-total">{formatRupiah(total)}</span>
            </div>
            <Button type="submit" disabled={!siap || kirim.isPending} data-testid="btn-kirim-sewa">
              {kirim.isPending ? "Menyimpan..." : mode === "admin" ? "Tetapkan & Aktifkan Sewa" : "Daftar & lanjut ke WhatsApp"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
