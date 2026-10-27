import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, UserPlus, Users } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { ROLE_LABEL, useAuth } from "@/hooks/useAuth";
import type { Role, UserAccount } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const KOSONG = { nama: "", username: "", password: "", role: "staff" as Role };

// Kelola akun pengguna (khusus Super Admin). Nama akun dipakai otomatis sebagai "Nama Penagih".
export default function UserManager() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const [form, setForm] = useState(KOSONG);
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<UserAccount[]>("/users") });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["users"] });

  const tambah = useMutation({
    mutationFn: () => apiPost<UserAccount>("/users", form),
    onSuccess: (u) => { setForm(KOSONG); refresh(); toast.success(`Akun ${u.username} dibuat`); },
    onError: (e) => toast.error(errDetail(e, "Gagal membuat akun (password min. 8 karakter)")),
  });
  const ubah = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<UserAccount> & { password?: string } }) =>
      apiPatch<UserAccount>(`/users/${id}`, body),
    onSuccess: () => { refresh(); toast.success("Akun diperbarui"); },
    onError: (e) => toast.error(errDetail(e, "Gagal memperbarui akun")),
  });

  const resetPassword = (u: UserAccount) => {
    const pw = window.prompt(`Password baru untuk ${u.username} (min. 8 karakter):`);
    if (pw) ubah.mutate({ id: u.id, body: { password: pw } });
  };

  return (
    <Card className="lg:col-span-2" data-testid="kartu-kelola-akun">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-5 text-brand" /> Akun Pengguna &amp; Penagih</CardTitle>
        <CardDescription>
          Staff/Kasir (Admin Tingkat 1) bisa melihat & menginput data baru, tetapi tidak bisa mengubah/menghapus,
          mengekspor Excel, atau melihat total pembayaran. Nama akun otomatis tercatat sebagai penagih saat scan QR.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="grid gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); tambah.mutate(); }}>
          <Input placeholder="Nama lengkap" value={form.nama} data-testid="input-user-nama" onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          <Input placeholder="Username" value={form.username} data-testid="input-user-username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input placeholder="Password" type="password" value={form.password} data-testid="input-user-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select value={form.role} data-testid="select-user-role" onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="staff">Staff / Kasir</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <Button type="submit" disabled={tambah.isPending} data-testid="btn-tambah-user">
            <UserPlus data-icon="inline-start" className="size-4" /> Tambah
          </Button>
        </form>
        <div className="divide-y rounded-xl border" data-testid="daftar-akun">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-3" data-testid={`akun-${u.username}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{u.nama} {u.id === me?.id && <span className="text-xs text-muted-foreground">(Anda)</span>}</p>
                <p className="text-xs text-muted-foreground">@{u.username} • {ROLE_LABEL[u.role]}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => resetPassword(u)} data-testid={`btn-reset-pw-${u.username}`}>
                <KeyRound data-icon="inline-start" className="size-4" /> Reset password
              </Button>
              <Button size="sm" variant={u.aktif ? "outline" : "default"} disabled={u.id === me?.id}
                data-testid={`btn-toggle-aktif-${u.username}`} onClick={() => ubah.mutate({ id: u.id, body: { aktif: !u.aktif } })}>
                {u.aktif ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
