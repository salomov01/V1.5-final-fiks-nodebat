import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Check, Clock, ScanLine, Store, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/lib/recharts";
import { apiGet, apiPatch } from "@/services/api";
import { METODE_LABEL, formatRupiah, initials } from "@/utils/format";
import type { DashboardStats, Payment } from "@/types";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/common/Badges";
import DefaultPasswordAlert from "@/components/common/DefaultPasswordAlert";
import { cn } from "@/lib/utils";
import { BRANDING } from "@/config";
import { useAuth } from "@/hooks/useAuth";

type IconType = typeof Store;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  testid,
}: {
  icon: IconType;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tone: string;
  testid: string;
}) {
  return (
    <Card data-testid={testid}>
      <CardContent className="flex items-start gap-4">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { isSuper } = useAuth(); // Staff: kartu total uang & grafik pemasukan disembunyikan
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardStats>("/dashboard/stats"),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => apiPatch<Payment>(`/payments/${id}/confirm`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pembayaran dikonfirmasi — status Lunas");
    },
    onError: () => toast.error("Gagal mengonfirmasi pembayaran"),
  });

  const byKategori = data?.by_kategori ?? {};
  const delta =
    data && data.pemasukan_bulan_ini !== null && data.pemasukan_bulan_lalu
      ? Math.round(
          ((data.pemasukan_bulan_ini - data.pemasukan_bulan_lalu) / data.pemasukan_bulan_lalu) * 100
        )
      : null;
  const berhenti = data ? data.total_penyewa - data.penyewa_aktif : 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-dashboard">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan pendataan lapak &amp; pembayaran — {BRANDING.namaPasar}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/dashboard/lapak"
            data-testid="btn-kelola-lapak"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Store data-icon="inline-start" className="size-4" />
            Kelola Lapak
          </Link>
          <Link
            to="/dashboard/scan-qr"
            data-testid="btn-dashboard-scan-qr"
            className={buttonVariants({ size: "sm" })}
          >
            <ScanLine data-icon="inline-start" className="size-4" />
            Pindai QR
          </Link>
        </div>
      </div>

      {isError && (
        <div
          className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="error-banner"
        >
          Gagal memuat data dari server.
          <button
            onClick={() => void refetch()}
            data-testid="btn-coba-lagi"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      {isPending ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" data-testid="skeleton-stat" />
          ))}
        </div>
      ) : (
        data && (
          <>
            <DefaultPasswordAlert />
            <div className={`mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isSuper ? "xl:grid-cols-4" : "xl:grid-cols-3"}`} data-testid="stat-cards">
              <StatCard
                icon={Store}
                label="Penyewa Aktif"
                value={data.penyewa_aktif}
                tone="bg-brand-50 text-brand"
                testid="stat-penyewa-aktif"
                sub={`Harian ${byKategori.harian ?? 0} • Bulanan ${byKategori.bulanan ?? 0} • Tahunan ${byKategori.tahunan ?? 0}`}
              />
              {data.pemasukan_bulan_ini !== null && <StatCard
                icon={Banknote}
                label="Pemasukan Bulan Ini"
                value={formatRupiah(data.pemasukan_bulan_ini)}
                tone="bg-emerald-100 text-emerald-600"
                testid="stat-pemasukan"
                sub={
                  delta === null
                    ? `Bulan lalu: ${formatRupiah(data.pemasukan_bulan_lalu ?? 0)}`
                    : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% dari bulan lalu (${formatRupiah(data.pemasukan_bulan_lalu ?? 0)})`
                }
              />}
              <StatCard
                icon={Clock}
                label="Tagihan Menunggu"
                value={
                  <span className="inline-flex items-center gap-2">
                    {data.tagihan_menunggu}
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-brand" />
                    </span>
                  </span>
                }
                tone="bg-brand-50 text-brand"
                testid="stat-tagihan-menunggu"
                sub={data.nilai_menunggu === null ? "Perlu ditindaklanjuti" : `Nilai tagihan: ${formatRupiah(data.nilai_menunggu)}`}
              />
              <StatCard
                icon={Users}
                label="Total Penyewa"
                value={data.total_penyewa}
                tone="bg-slate-100 text-slate-600"
                testid="stat-total-penyewa"
                sub={`Berhenti: ${berhenti} penyewa`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {data.revenue_6m && <Card className="lg:col-span-2" data-testid="kartu-grafik">
                <CardHeader>
                  <CardTitle>Tren Pemasukan Sewa</CardTitle>
                  <CardDescription>
                    Total pembayaran yang dikonfirmasi per bulan (6 bulan terakhir)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72" data-testid="grafik-pemasukan">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.revenue_6m}>
                        <CartesianGrid vertical={false} stroke="#E2E8F0" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          stroke="#94A3B8"
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          width={48}
                          stroke="#94A3B8"
                          tickFormatter={(v: number) =>
                            v >= 1_000_000 ? `${v / 1_000_000}jt` : `${v / 1000}rb`
                          }
                        />
                        <Tooltip
                          formatter={(value: number) => formatRupiah(value)}
                          cursor={{ fill: "#F1F5F9" }}
                        />
                        <Bar dataKey="total" fill="#1E4E42" radius={[6, 6, 0, 0]} maxBarSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>}

              <Card className={data.revenue_6m ? "" : "lg:col-span-3"} data-testid="kartu-transaksi-terbaru">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Pembayaran Terbaru</CardTitle>
                    <CardDescription>Entri pembayaran terakhir</CardDescription>
                  </div>
                  <Link
                    to="/dashboard/pembayaran"
                    data-testid="link-lihat-semua"
                    className="text-sm font-medium text-brand hover:text-brand-700"
                  >
                    Lihat semua
                  </Link>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {data.recent_payments.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada pembayaran tercatat.
                    </p>
                  )}
                  {data.recent_payments.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all duration-200 hover:bg-slate-50"
                      data-testid={`transaksi-${p.nomor_id.toLowerCase()}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {initials(p.nama_lengkap)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nama_lengkap}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.periode} • {METODE_LABEL[p.metode]}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="text-sm font-semibold">{formatRupiah(p.jumlah)}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      {isSuper && p.status === "menunggu" && (
                        <button
                          onClick={() => confirm.mutate(p.id)}
                          data-testid={`btn-verifikasi-cepat-${p.nomor_id.toLowerCase()}`}
                          title="Konfirmasi lunas"
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all duration-200 hover:bg-emerald-700"
                        >
                          <Check className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
