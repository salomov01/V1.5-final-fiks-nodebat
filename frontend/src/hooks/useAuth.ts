// Hook sesi login: data akun yang sedang masuk + helper peran (Super Admin / Staff).
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/services/api";
import type { MeOutput } from "@/types";

export function useAuth() {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<MeOutput>("/auth/me"),
    retry: false,
  });
  const me = query.data;
  // Super Admin (Admin Tingkat 2) = akses penuh; Staf Pemungut Iuran (Tingkat 1) = tanpa edit/hapus, ekspor, & total uang.
  return { ...query, me, isSuper: me?.role === "super_admin" };
}

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  staff: "Staf Pemungut Iuran",
};
