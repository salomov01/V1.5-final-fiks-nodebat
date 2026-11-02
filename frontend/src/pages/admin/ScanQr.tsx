import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { Camera, HandCoins, Search, Store } from "lucide-react";
import { apiGet, apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { formatDateID, formatRupiah } from "@/utils/format";
import { useAuth } from "@/hooks/useAuth";
import type { Payment, ScanResult } from "@/types";
import { KuitansiDialog } from "@/components/pembayaran/KuitansiDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Pindai QR pedagang → pilih "Bayar Iuran" atau "Bayar Sewa Lapak".
// "Bayar Sewa Lapak" disembunyikan bila sewa sudah lunas (tinggal iuran harian).
export default function ScanQr() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busy = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [hasil, setHasil] = useState<ScanResult | null>(null);
  const [kuitansi, setKuitansi] = useState<string | null>(null);

  const stop = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!s) return;
    try { await s.stop(); s.clear(); } catch (err) { console.debug("[scan-qr] stop:", err); }
  };
  useEffect(() => () => { void stop(); }, []);

  const cari = async (raw: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await apiGet<ScanResult>(`/scan/${encodeURIComponent(raw.trim())}`);
      await stop();
      setHasil(r);
    } catch {
      toast.error("QR / User ID tidak dikenali");
    } finally { busy.current = false; }
  };

  const start = async () => {
    if (scannerRef.current) return;
    try {
      const s = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = s;
      await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, (t) => void cari(t), () => undefined);
      setScanning(true);
    } catch {
      scannerRef.current = null;
      toast.error("Kamera tidak dapat diakses — gunakan input User ID");
    }
  };

  const bayar = useMutation({
    mutationFn: ({ jenis, sewa_id }: { jenis: "iuran" | "sewa"; sewa_id: string }) => apiPost<Payment>(`/payments/${jenis}`, { sewa_id }),
    onSuccess: async (d, v) => {
      toast.success(v.jenis === "iuran" ? "Iuran hari ini LUNAS" : "Sewa lapak LUNAS");
      setKuitansi(d.id);
      for (const k of ["payments", "dashboard", "sewa"]) void qc.invalidateQueries({ queryKey: [k] });
      if (hasil) setHasil(await apiGet<ScanResult>(`/scan/${hasil.pedagang.user_id}`));
    },
    onError: (e) => toast.error(errDetail(e, "Gagal menyimpan pembayaran")),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-scan-qr">Pindai QR</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pindai QR pedagang atau ketik User ID-nya (mis. 01-123).</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900" data-testid="qr-scanner-box">
            <div id="qr-reader" className="[&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {!scanning && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Kamera belum aktif</div>}
          </div>
          <Button onClick={() => void (scanning ? stop() : start())} data-testid="btn-toggle-kamera"><Camera data-icon="inline-start" className="size-4" /> {scanning ? "Matikan Kamera" : "Aktifkan Kamera"}</Button>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) void cari(manual); }}>
            <Input placeholder="User ID, mis. 01-009" value={manual} data-testid="input-manual-id" onChange={(e) => setManual(e.target.value)} />
            <Button type="submit" variant="outline" data-testid="btn-cari-manual"><Search className="size-4" /></Button>
          </form>
        </div>

        <div className="rounded-2xl border bg-card p-5" data-testid="hasil-scan">
          {!hasil ? <p className="py-16 text-center text-sm text-muted-foreground">Belum ada QR yang dipindai.</p> : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-sm font-bold text-brand" data-testid="scan-user-id">{hasil.pedagang.user_id}</p>
                <p className="text-xl font-bold" data-testid="scan-nama">{hasil.pedagang.nama}</p>
                <p className="text-xs text-muted-foreground">{[hasil.pedagang.no_hp, hasil.pedagang.alamat].filter(Boolean).join(" • ")}</p>
              </div>
              {/* Nama penagih otomatis dari akun login (readonly) */}
              <div className="grid gap-1">
                <label htmlFor="scan-penagih" className="text-xs font-medium text-brand">Nama Penagih</label>
                <Input id="scan-penagih" readOnly value={me?.nama ?? ""} className="cursor-not-allowed bg-slate-100 font-semibold" data-testid="input-penagih-scan" />
              </div>
              {hasil.sewa.length === 0 && <p className="rounded-xl bg-slate-100 p-4 text-sm" data-testid="scan-tanpa-sewa">Pedagang ini belum punya sewa lapak aktif.</p>}
              {hasil.sewa.map((s) => (
                <div key={s.id} className="rounded-xl border p-4" data-testid={`scan-sewa-${s.id}`}>
                  <p className="flex items-center gap-2 font-semibold"><Store className="size-4 text-brand" /> {s.lapak_nama}</p>
                  <p className="text-xs text-muted-foreground">Sewa {formatDateID(s.mulai)} – {formatDateID(s.selesai)} • {s.sisa > 0 ? `sisa ${formatRupiah(s.sisa)}` : "sewa lunas"}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button disabled={s.iuran_hari_ini_lunas || bayar.isPending} onClick={() => bayar.mutate({ jenis: "iuran", sewa_id: s.id })} data-testid={`btn-bayar-iuran-${s.id}`}>
                      <HandCoins data-icon="inline-start" className="size-4" /> {s.iuran_hari_ini_lunas ? "Iuran hari ini lunas" : `Bayar Iuran ${formatRupiah(s.iuran)}`}
                    </Button>
                    {s.sisa > 0 && (
                      <Button variant="outline" disabled={bayar.isPending} onClick={() => bayar.mutate({ jenis: "sewa", sewa_id: s.id })} data-testid={`btn-bayar-sewa-${s.id}`}>
                        Bayar Sewa Lapak {formatRupiah(s.sisa)}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <KuitansiDialog paymentId={kuitansi} onClose={() => setKuitansi(null)} />
    </div>
  );
}
