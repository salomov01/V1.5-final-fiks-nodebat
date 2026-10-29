import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Banknote, ClipboardList, HandCoins, Store, Users } from "lucide-react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BRANDING } from "@/config";
import { apiGet } from "@/services/api";
import { formatRupiah } from "@/utils/format";
import type { DashboardStats } from "@/types";
import DefaultPasswordAlert from "@/components/common/DefaultPasswordAlert";

function Stat({ icon: Icon, label, value, to, testid }: { icon: typeof Users; label: string; value: string | number; to?: string; testid: string }) {
  const body = (
    <div className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md" data-testid={testid}>
      <Icon className="size-5 text-brand" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-bold">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

// Dashboard: ringkasan pedagang, lapak, pendaftaran & pemasukan (uang hanya untuk Super Admin).
export default function Dashboard() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<DashboardStats>("/dashboard/stats") });
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="judul-dashboard">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ringkasan {BRANDING.namaPasar}</p>
      <div className="mt-4"><DefaultPasswordAlert /></div>
      {data && (<>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={Users} label="Pedagang aktif" value={data.jumlah_pedagang} to="/dashboard/pedagang" testid="stat-pedagang" />
          <Stat icon={Store} label="Lapak terisi / total" value={`${data.lapak_terisi} / ${data.jumlah_lapak}`} to="/dashboard/lapak" testid="stat-lapak" />
          <Stat icon={ClipboardList} label="Menunggu konfirmasi" value={data.sewa_menunggu} to="/dashboard/pendaftaran" testid="stat-menunggu" />
          <Stat icon={HandCoins} label={`Iuran dibayar hari ini (dari ${data.sewa_aktif} sewa aktif)`} value={data.iuran_hari_ini} to="/dashboard/scan-qr" testid="stat-iuran-hari-ini" />
          {data.pemasukan_hari_ini !== null && <Stat icon={Banknote} label="Pemasukan hari ini" value={formatRupiah(data.pemasukan_hari_ini)} to="/dashboard/pembayaran" testid="stat-pemasukan-hari" />}
          {data.pemasukan_bulan_ini !== null && <Stat icon={Banknote} label="Pemasukan bulan ini" value={formatRupiah(data.pemasukan_bulan_ini)} to="/dashboard/pembayaran" testid="stat-pemasukan-bulan" />}
        </div>
        {data.grafik_6_bulan && (
          <div className="mt-6 rounded-2xl border bg-card p-5" data-testid="kartu-grafik">
            <p className="font-semibold">Pemasukan 6 bulan terakhir</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.grafik_6_bulan}>
                  <XAxis dataKey="label" fontSize={12} /><YAxis fontSize={11} tickFormatter={(v: number) => `${v / 1000}rb`} />
                  <Tooltip formatter={(v) => formatRupiah(Number(v))} /><Legend />
                  <Bar dataKey="sewa" name="Sewa Lapak" stackId="a" fill="#1E4E42" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="iuran" name="Iuran" stackId="a" fill="#A9CDBF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
