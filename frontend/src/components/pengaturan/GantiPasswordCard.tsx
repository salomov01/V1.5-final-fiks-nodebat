import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiPost } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Kartu ganti password untuk akun yang sedang login (Super Admin maupun Staff).
export default function GantiPasswordCard() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });

  const change = useMutation({
    mutationFn: () => apiPost("/auth/change-password", { current_password: form.current, new_password: form.next }),
    onSuccess: () => {
      setForm({ current: "", next: "", confirm: "" });
      void qc.invalidateQueries({ queryKey: ["auth"] });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Password berhasil diganti — sesi di perangkat lain telah dikeluarkan");
    },
    onError: (e) => toast.error(errDetail(e, "Gagal mengganti password")),
  });

  const submit = () => {
    if (!form.current || !form.next || !form.confirm) return toast.error("Lengkapi semua kolom password");
    if (form.next.length < 8) return toast.error("Password baru minimal 8 karakter");
    if (form.next !== form.confirm) return toast.error("Konfirmasi password baru tidak cocok");
    change.mutate();
  };

  const field = (key: keyof typeof form, label: string, testid: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`pw-${key}`}>{label}</Label>
      <Input id={`pw-${key}`} type="password" data-testid={testid} value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <Card data-testid="kartu-ganti-password">
      <CardHeader>
        <CardTitle>Ganti Password</CardTitle>
        <CardDescription>Minimal 8 karakter. Sesi di perangkat lain otomatis keluar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {field("current", "Password Saat Ini", "input-password-lama")}
          {field("next", "Password Baru", "input-password-baru")}
          {field("confirm", "Ulangi Password Baru", "input-password-konfirmasi")}
          <Button type="submit" disabled={change.isPending} data-testid="btn-simpan-password">
            <KeyRound data-icon="inline-start" className="size-4" />
            {change.isPending ? "Menyimpan..." : "Simpan Password Baru"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
