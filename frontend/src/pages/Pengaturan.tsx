import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { BRANDING } from "@/config";
import DefaultPasswordAlert from "@/components/DefaultPasswordAlert";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import type { MeOutput, Penagih } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Pengaturan() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [namaPenagih, setNamaPenagih] = useState("");

  const { data: penagihList } = useQuery({
    queryKey: ["penagih"],
    queryFn: () => apiGet<Penagih[]>("/penagih"),
  });

  const tambahPenagih = useMutation({
    mutationFn: (nama: string) => apiPost<Penagih>("/penagih", { nama }),
    onSuccess: () => {
      setNamaPenagih("");
      void qc.invalidateQueries({ queryKey: ["penagih"] });
      toast.success("Penagih ditambahkan");
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError && error.body && typeof error.body === "object" && "detail" in error.body
          ? String((error.body as { detail: unknown }).detail)
          : "Gagal menambah penagih";
      toast.error(detail);
    },
  });

  const hapusPenagih = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/penagih/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["penagih"] });
      toast.success("Penagih dihapus");
    },
    onError: () => toast.error("Gagal menghapus penagih"),
  });

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<MeOutput>("/auth/me"),
    retry: false,
  });

  const change = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiPost<{ ok: boolean }>("/auth/change-password", body),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirmPw("");
      void qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Password berhasil diganti — sesi di perangkat lain telah dikeluarkan");
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError &&
        error.body &&
        typeof error.body === "object" &&
        "detail" in error.body
          ? String((error.body as { detail: unknown }).detail)
          : "Gagal mengganti password";
      toast.error(detail);
    },
  });

  const submit = () => {
    if (!current || !next || !confirmPw) {
      toast.error("Lengkapi semua kolom password");
      return;
    }
    if (next.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }
    if (next !== confirmPw) {
      toast.error("Konfirmasi password baru tidak cocok");
      return;
    }
    change.mutate({ current_password: current, new_password: next });
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-pengaturan">
          Pengaturan Akun
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola kredensial pengelola {BRANDING.namaPasar}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DefaultPasswordAlert />
        <Card data-testid="kartu-ganti-password">
          <CardHeader>
            <CardTitle>Ganti Password</CardTitle>
            <CardDescription>
              Password baru minimal 8 karakter. Setelah diganti, sesi di perangkat lain otomatis
              keluar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="pw-current">Password Saat Ini</Label>
                <Input
                  id="pw-current"
                  data-testid="input-password-lama"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pw-new">Password Baru</Label>
                <Input
                  id="pw-new"
                  data-testid="input-password-baru"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="minimal 8 karakter"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pw-confirm">Ulangi Password Baru</Label>
                <Input
                  id="pw-confirm"
                  data-testid="input-password-konfirmasi"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={change.isPending} data-testid="btn-simpan-password">
                <KeyRound data-icon="inline-start" className="size-4" />
                {change.isPending ? "Menyimpan..." : "Simpan Password Baru"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card data-testid="kartu-kelola-penagih">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-amber-600" />
              Daftar Penagih (Juru Pungut)
            </CardTitle>
            <CardDescription>
              Nama-nama di sini muncul sebagai pilihan saat penagih scan QR untuk konfirmasi
              pembayaran.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!namaPenagih.trim()) {
                  toast.error("Isi nama penagih");
                  return;
                }
                tambahPenagih.mutate(namaPenagih.trim());
              }}
            >
              <Input
                data-testid="input-nama-penagih"
                value={namaPenagih}
                onChange={(e) => setNamaPenagih(e.target.value)}
                placeholder="mis. I Wayan Juru Pungut"
              />
              <Button type="submit" disabled={tambahPenagih.isPending} data-testid="btn-tambah-penagih">
                <UserPlus data-icon="inline-start" className="size-4" />
                Tambah
              </Button>
            </form>

            <div className="flex flex-col gap-2" data-testid="daftar-penagih">
              {(penagihList ?? []).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada penagih terdaftar.
                </p>
              )}
              {(penagihList ?? []).map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  data-testid={`penagih-${i}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-amber-400">
                      {p.nama.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{p.nama}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => hapusPenagih.mutate(p.id)}
                    data-testid={`btn-hapus-penagih-${i}`}
                    title="Hapus penagih"
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kartu-info-akun">
          <CardHeader>
            <CardTitle>Informasi Akun</CardTitle>
            <CardDescription>Akun pengelola yang sedang masuk</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-border p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-amber-400">
                PA
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="truncate font-semibold" data-testid="info-username">
                  {me?.username ?? "-"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <p className="text-xs text-emerald-800">
                Sesi diamankan dengan cookie httpOnly dan berlaku 7 hari. Password disimpan dalam
                bentuk hash (PBKDF2-SHA256), tidak pernah disimpan sebagai teks biasa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
