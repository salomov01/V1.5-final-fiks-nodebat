import { ShieldCheck } from "lucide-react";
import { BRANDING } from "@/config";
import DefaultPasswordAlert from "@/components/common/DefaultPasswordAlert";
import GantiPasswordCard from "@/components/pengaturan/GantiPasswordCard";
import UserManager from "@/components/pengaturan/UserManager";
import { MulaiTunggakanCard } from "@/components/pengaturan/MulaiTunggakanCard";
import { ROLE_LABEL, useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initials } from "@/utils/format";

export default function Pengaturan() {
  const { me, isSuper } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="judul-pengaturan">
        Pengaturan Akun
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Kelola akun pengelola {BRANDING.namaPasar}</p>

      <div className="mt-6"><DefaultPasswordAlert /></div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <GantiPasswordCard />
        <Card data-testid="kartu-info-akun">
          <CardHeader>
            <CardTitle>Informasi Akun</CardTitle>
            <CardDescription>Akun yang sedang masuk</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-border p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white">
                {initials(me?.nama ?? "-")}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold" data-testid="info-nama">{me?.nama ?? "-"}</p>
                <p className="text-xs text-muted-foreground" data-testid="info-username">@{me?.username} • {me && ROLE_LABEL[me.role]}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
              <p className="text-xs text-brand-700">
                Sesi diamankan dengan cookie httpOnly (7 hari). Password disimpan sebagai hash PBKDF2-SHA256.
              </p>
            </div>
          </CardContent>
        </Card>
        {isSuper && <MulaiTunggakanCard />}
        {/* Kelola akun hanya tampil untuk Super Admin */}
        {isSuper && <UserManager />}
      </div>
    </div>
  );
}
