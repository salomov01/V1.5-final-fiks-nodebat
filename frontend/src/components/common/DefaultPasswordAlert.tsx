import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { apiGet } from "@/services/api";
import type { MeOutput } from "@/types";

/**
 * Peringatan keamanan: tampil selama pengelola masih memakai password bawaan
 * dari backend/.env. Hilang sendiri setelah password diganti di /pengaturan.
 */
export default function DefaultPasswordAlert() {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<MeOutput>("/auth/me"),
    retry: false,
  });

  if (!data?.password_bawaan) return null;

  return (
    <div
      data-testid="peringatan-password-bawaan"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
    >
      <ShieldAlert className="size-5 shrink-0 text-red-600" />
      <p className="flex-1 text-sm text-red-900">
        <span className="font-semibold">Risiko keamanan:</span> akun pengelola masih memakai
        password bawaan. Segera ganti agar data penyewa tidak bisa diakses orang lain.
      </p>
      <Link
        to="/dashboard/pengaturan"
        data-testid="link-ganti-password-sekarang"
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
      >
        Ganti Password
      </Link>
    </div>
  );
}
