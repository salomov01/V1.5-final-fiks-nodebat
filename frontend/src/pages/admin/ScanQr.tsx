import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { Camera, HandCoins, MessageCircle, ScanLine, SquarePen } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/services/api";
import {
  KATEGORI_LABEL,
  METODE_LABEL,
  STATUS_PENYEWA_LABEL,
  formatDateID,
  formatRupiah,
  initials,
} from "@/utils/format";
import type { KategoriSewa, Payment, Tenant } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KategoriBadge, StatusBadge } from "@/components/common/Badges";
import PaymentRecordDialog from "@/components/pembayaran/PaymentRecordDialog";
import { waReminderLink } from "@/utils/whatsapp";

export default function ScanQr() {
  const qc = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [manualId, setManualId] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const { me, isSuper } = useAuth();
  const penagih = me?.nama ?? ""; // otomatis dari akun yang login (readonly)

  const { data: bills } = useQuery({
    queryKey: ["payments", "tenant", tenant?.id],
    queryFn: () => apiGet<Payment[]>(`/payments?tenant_id=${tenant?.id ?? ""}`),
    enabled: !!tenant,
  });

  // Sudah Bayar / Belum Bayar — server mencatat nama penagih dari akun yang login.
  const collect = useMutation({
    mutationFn: (sudahBayar: boolean) =>
      apiPost<Payment>("/payments/scan-collect", {
        tenant_id: tenant?.id,
        sudah_bayar: sudahBayar,
      }),
    onSuccess: (_p, sudahBayar) => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success(
        sudahBayar
          ? `Pembayaran LUNAS dicatat oleh penagih ${penagih}`
          : `Ditandai belum bayar — kunjungan ${penagih} tercatat`
      );
    },
    onError: () => toast.error("Gagal menyimpan penagihan"),
  });

  const submitCollect = (sudahBayar: boolean) => {
    collect.mutate(sudahBayar);
  };

  const confirm = useMutation({
    mutationFn: (id: string) => apiPatch<Payment>(`/payments/${id}/confirm`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pembayaran dikonfirmasi — status Lunas");
    },
    onError: () => toast.error("Gagal mengonfirmasi pembayaran"),
  });

  const stopScan = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch (err) {
      // Wajar bila scanner belum sempat start penuh; dicatat untuk debugging.
      console.debug("[scan-qr] stop scanner:", err);
    }
  };

  useEffect(() => {
    return () => {
      void stopScan();
    };
  }, []);

  const handleDecode = async (raw: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      let nomor = raw.trim();
      try {
        const parsed = JSON.parse(raw) as { nomor_id?: unknown };
        if (typeof parsed?.nomor_id === "string") nomor = parsed.nomor_id;
      } catch {
        nomor = raw.trim(); // bukan JSON — pakai teks mentah
      }
      const found = await apiGet<Tenant>(`/tenants/by-nomor/${encodeURIComponent(nomor)}`);
      await stopScan();
      setTenant(found);
      toast.success(`Penyewa ditemukan: ${found.nama_lengkap}`);
    } catch {
      toast.error("QR tidak dikenali atau penyewa tidak ditemukan");
    } finally {
      busyRef.current = false;
    }
  };

  const startScan = async () => {
    if (scannerRef.current) return;
    try {
      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => void handleDecode(decodedText),
        () => {
          // frame tanpa QR — abaikan
        }
      );
      setScanning(true);
    } catch {
      scannerRef.current = null;
      setCameraError(true);
      toast.error("Kamera tidak dapat diakses — gunakan input manual di samping");
    }
  };

  const manualLookup = async () => {
    if (!manualId.trim()) {
      toast.error("Masukkan nomor ID penyewa");
      return;
    }
    await handleDecode(manualId);
    setManualId("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-scan-qr">
            Pindai QR Code
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pindai QR pada kartu penyewa untuk membuka data &amp; status tagihannya
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card data-testid="kartu-scanner">
          <CardHeader>
            <CardTitle>Kamera Pemindai</CardTitle>
            <CardDescription>
              Arahkan kamera perangkat (HP/laptop) ke QR Code pada kartu penyewa lapak.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900"
              data-testid="qr-scanner-box"
            >
              <div
                id="qr-reader"
                className="[&_canvas]:hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
              />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <ScanLine className="size-10" />
                  <p className="text-sm">
                    {cameraError ? "Kamera tidak tersedia — pakai input manual" : "Kamera belum aktif"}
                  </p>
                </div>
              )}
              {scanning && (
                <>
                  <div className="pointer-events-none absolute inset-x-8 top-1/4 bottom-1/4 rounded-xl border-2 border-white/30" />
                  <div
                    className="scanner-beam pointer-events-none absolute inset-x-10 h-1 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                    data-testid="scanner-beam"
                  />
                </>
              )}
            </div>

            <div className="flex gap-2">
              {!scanning ? (
                <Button onClick={() => void startScan()} className="flex-1" data-testid="btn-aktifkan-kamera">
                  <Camera data-icon="inline-start" className="size-4" />
                  Aktifkan Kamera
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => void stopScan()} className="flex-1" data-testid="btn-stop-kamera">
                  Berhenti
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Kamera tidak tersedia? Masukkan Nomor ID secara manual:
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  data-testid="input-manual-nomor-id"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void manualLookup()}
                  placeholder="mis. LPK-JMB-001"
                  className="font-mono"
                />
                <Button variant="secondary" onClick={() => void manualLookup()} data-testid="btn-cari-manual">
                  Cari
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kartu-hasil-scan">
          <CardHeader>
            <CardTitle>Hasil Pindai</CardTitle>
            <CardDescription>Data penyewa dan tagihan pembayarannya</CardDescription>
          </CardHeader>
          <CardContent>
            {!tenant ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center" data-testid="hasil-kosong">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">
                  <ScanLine className="size-7" />
                </span>
                <p className="font-medium">Belum ada hasil pindai</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Aktifkan kamera dan pindai QR pada kartu penyewa, atau masukkan Nomor ID secara
                  manual.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4" data-testid="detail-penyewa">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-sm font-semibold text-white">
                    {initials(tenant.nama_lengkap)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold" data-testid="hasil-nama">
                      {tenant.nama_lengkap}
                    </p>
                    <p className="font-mono text-sm text-brand" data-testid="hasil-nomor-id">
                      {tenant.nomor_id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Blok Lapak</p>
                    <p className="mt-0.5 font-mono text-xs font-semibold">{tenant.blok}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kategori Sewa</p>
                    <p className="mt-0.5">
                      <KategoriBadge kategori={tenant.kategori as KategoriSewa} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tarif Sewa</p>
                    <p className="mt-0.5 font-semibold">{formatRupiah(tenant.tarif)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Periode Sewa</p>
                    <p className="mt-0.5 text-xs">
                      {formatDateID(tenant.mulai)} — {formatDateID(tenant.selesai)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status Sewa</p>
                    <p className="mt-0.5 font-medium">{STATUS_PENYEWA_LABEL[tenant.status]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">No. HP</p>
                    <p className="mt-0.5 font-medium">{tenant.no_hp || "-"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4" data-testid="panel-penagihan">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
                      <HandCoins className="size-4" />
                    </span>
                    <p className="text-sm font-bold text-brand-700">Konfirmasi Penagihan</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <p className="text-xs text-brand">Nama Pedagang</p>
                      <p className="font-semibold text-slate-900" data-testid="penagihan-nama-pedagang">
                        {tenant.nama_lengkap}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-brand">Jenis Lapak</p>
                      <p className="font-medium text-slate-900" data-testid="penagihan-jenis-lapak">
                        {tenant.blok}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-brand">Jenis Iuran</p>
                      <p className="font-medium text-slate-900" data-testid="penagihan-jenis-iuran">
                        {KATEGORI_LABEL[tenant.kategori]} • {formatRupiah(tenant.tarif)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label htmlFor="scan-penagih" className="text-xs font-medium text-brand">Nama Penagih</label>
                    <Input id="scan-penagih" readOnly value={penagih} className="mt-1 bg-white" data-testid="input-penagih-scan" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={collect.isPending}
                      onClick={() => submitCollect(true)}
                      data-testid="btn-sudah-bayar"
                    >
                      Sudah Bayar
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      disabled={collect.isPending}
                      onClick={() => submitCollect(false)}
                      data-testid="btn-belum-bayar"
                    >
                      Belum Bayar
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold" data-testid="judul-tagihan">
                    Tagihan &amp; Riwayat
                  </p>
                  <div className="mt-2 flex flex-col gap-2" data-testid="daftar-tagihan">
                    {(bills ?? []).length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Belum ada data pembayaran.
                      </p>
                    )}
                    {(bills ?? []).slice(0, 5).map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all duration-200 hover:bg-slate-50"
                        data-testid={`tagihan-${i}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.periode}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRupiah(p.jumlah)} • {METODE_LABEL[p.metode]}
                          </p>
                        </div>
                        <StatusBadge status={p.status} />
                        {isSuper && p.status === "menunggu" && (
                          <Button
                            size="xs"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => confirm.mutate(p.id)}
                            data-testid={`btn-konfirmasi-scan-${i}`}
                          >
                            Konfirmasi
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const pending = (bills ?? []).find((b) => b.status === "menunggu");
                      const link = waReminderLink(tenant, pending);
                      if (!link) {
                        toast.error(`Nomor HP ${tenant.nama_lengkap} belum diisi`);
                        return;
                      }
                      window.open(link, "_blank", "noopener");
                    }}
                    data-testid="btn-wa-scan"
                  >
                    <MessageCircle data-icon="inline-start" className="size-4 text-emerald-600" />
                    Pengingat WA
                  </Button>
                  <Button onClick={() => setRecordOpen(true)} data-testid="btn-catat-dari-scan">
                    <SquarePen data-icon="inline-start" className="size-4" />
                    Catat Pembayaran
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentRecordDialog open={recordOpen} onOpenChange={setRecordOpen} tenant={tenant} />
    </div>
  );
}
