import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  History,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDateTimeID } from "@/lib/format";
import type { Activity } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "pembayaran", label: "Pembayaran" },
  { key: "penyewa", label: "Penyewa" },
  { key: "akun", label: "Akun" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const AKSI_META: Record<string, { label: string; icon: typeof Check; tone: string }> = {
  buat: { label: "Dibuat", icon: Plus, tone: "bg-blue-100 text-blue-600" },
  ubah: { label: "Diubah", icon: Pencil, tone: "bg-amber-100 text-amber-600" },
  hapus: { label: "Dihapus", icon: Trash2, tone: "bg-red-100 text-red-600" },
  konfirmasi: { label: "Dikonfirmasi", icon: Check, tone: "bg-emerald-100 text-emerald-600" },
  tolak: { label: "Ditolak", icon: X, tone: "bg-red-100 text-red-600" },
};

const ENTITY_LABEL: Record<string, string> = {
  penyewa: "Penyewa",
  pembayaran: "Pembayaran",
  akun: "Akun",
};

export default function Riwayat() {
  const [tab, setTab] = useState<TabKey>("semua");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["activities"],
    queryFn: () => apiGet<Activity[]>("/activities?limit=200"),
  });

  const filtered = useMemo(
    () => (data ?? []).filter((a) => tab === "semua" || a.entity === tab),
    [data, tab]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-riwayat">
            Riwayat Aktivitas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jejak siapa mengubah atau mengonfirmasi setiap catatan, beserta tanggal &amp; waktunya
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-riwayat-${t.key}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
              tab === t.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isError && (
        <div
          className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="error-banner-riwayat"
        >
          Gagal memuat riwayat aktivitas dari server.
          <button
            onClick={() => void refetch()}
            data-testid="btn-coba-lagi-riwayat"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      <Card className="mt-4">
        <CardContent>
          {isPending ? (
            <div className="flex flex-col gap-3 py-6" data-testid="skeleton-riwayat">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="empty-state-riwayat">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <History className="size-7" />
              </span>
              <p className="font-medium">Belum ada aktivitas tercatat</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Setiap penambahan penyewa, perubahan data, dan konfirmasi pembayaran akan muncul di
                sini.
              </p>
            </div>
          ) : (
            <ol className="flex flex-col" data-testid="daftar-riwayat">
              {filtered.map((a, idx) => {
                const meta = AKSI_META[a.action] ?? {
                  label: a.action,
                  icon: KeyRound,
                  tone: "bg-slate-100 text-slate-600",
                };
                const Icon = meta.icon;
                return (
                  <li
                    key={a.id}
                    className="flex gap-4 border-b border-border py-4 last:border-0"
                    data-testid={`riwayat-${idx}`}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        meta.tone
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{meta.label}</span>{" "}
                        <span className="text-muted-foreground">
                          {ENTITY_LABEL[a.entity] ?? a.entity} —
                        </span>{" "}
                        <span className="font-medium text-foreground">{a.label}</span>
                      </p>
                      {a.detail && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.detail}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        oleh{" "}
                        <span className="font-medium text-amber-600" data-testid={`riwayat-actor-${idx}`}>
                          {a.actor}
                        </span>{" "}
                        • {formatDateTimeID(a.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
