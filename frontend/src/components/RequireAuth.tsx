import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Landmark } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { MeOutput } from "@/lib/types";

/** Gerbang sesi: /api/auth/me menentukan pengelola boleh masuk atau dialihkan ke /login. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isPending, isError } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<MeOutput>("/auth/me"),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background" data-testid="auth-splash">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500 text-slate-900">
          <Landmark className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">Memeriksa sesi...</p>
      </div>
    );
  }

  if (isError) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
