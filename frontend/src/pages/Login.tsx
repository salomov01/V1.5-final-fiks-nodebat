import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Landmark, LogIn } from "lucide-react";
import { BRANDING } from "@/config";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { MeOutput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Sudah login? Langsung ke dashboard.
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<MeOutput>("/auth/me"),
    retry: false,
  });

  const login = useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      apiPost<MeOutput>("/auth/login", body),
    onSuccess: () => {
      beginSession(); // hapus cache react-query milik sesi sebelumnya
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.status === 401
          ? "Username atau password salah"
          : "Gagal masuk — coba lagi"
      );
    },
  });

  if (me) return <Navigate to="/dashboard" replace />;

  const submit = () => {
    if (!username.trim() || !password) {
      toast.error("Isi username dan password");
      return;
    }
    login.mutate({ username: username.trim(), password });
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="kartu-login">
        <CardContent className="flex flex-col items-center gap-6 py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500 text-slate-900">
              <Landmark className="size-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground" data-testid="judul-login">
                {BRANDING.namaDesa}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Masuk untuk mengelola lapak &amp; pembayaran pasar
              </p>
            </div>
          </div>

          <form
            className="flex w-full flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                data-testid="input-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="mis. pengelola"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={login.isPending} data-testid="btn-login">
              <LogIn data-icon="inline-start" className="size-4" />
              {login.isPending ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
