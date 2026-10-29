import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, Globe, LayoutDashboard, LogOut, Menu, Newspaper,
  ReceiptText, ScanLine, Settings, Store, Users,
} from "lucide-react";
import logoDesa from "@/assets/logo-desa.svg";
import { apiGet } from "@/services/api";
import { BRANDING } from "@/config";
import { endSession } from "@/services/session";
import { ROLE_LABEL, useAuth } from "@/hooks/useAuth";
import { initials } from "@/utils/format";
import type { Sewa } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Menu sidebar admin (urutan baku). Info Pasar khusus Super Admin.
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/pedagang", label: "Data Pedagang", icon: Users },
  { to: "/dashboard/lapak", label: "Data Lapak dan Iuran", icon: Store },
  { to: "/dashboard/pendaftaran", label: "Pendaftaran Lapak", icon: ClipboardList, badge: "daftar" },
  { to: "/dashboard/pembayaran", label: "Pembayaran", icon: ReceiptText },
  { to: "/dashboard/scan-qr", label: "Pindai QR", icon: ScanLine },
  { to: "/dashboard/info-pasar", label: "Info Pasar", icon: Newspaper, superOnly: true },
  { to: "/dashboard/pengaturan", label: "Settings", icon: Settings },
];

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-3 px-5" data-testid="brand-desa">
      <img src={logoDesa} alt="" className="size-10 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight text-slate-900">{BRANDING.namaDesa}</span>
        <span className="text-xs text-slate-500">Lapak & Pembayaran</span>
      </span>
    </Link>
  );
}

function SidebarNav({ counts, onNavigate }: { counts: Record<string, number>; onNavigate?: () => void }) {
  const { isSuper } = useAuth();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.filter((i) => !i.superOnly || isSuper).map((item) => (
        <NavLink
          key={item.to} to={item.to} end={item.end} onClick={onNavigate}
          data-testid={`nav-${item.to.split("/").pop()}`}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
            isActive ? "bg-brand text-white" : "text-slate-700 hover:bg-brand-50 hover:text-brand"
          )}
        >
          <item.icon className="size-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {item.badge && counts[item.badge] > 0 && (
            <span data-testid="badge-pendaftaran-baru"
              className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-slate-900">
              {counts[item.badge]}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Jam pasar (tampilan saja). Zona waktu: src/config.ts */
function ClockWita() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { timeZone: BRANDING.zonaWaktu, ...o }).format(now);
  return (
    <div className="hidden text-right sm:block" data-testid="jam-wita">
      <div className="font-mono text-sm font-semibold tracking-wider text-slate-900">
        {fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" })} <span className="text-brand">{BRANDING.labelZonaWaktu}</span>
      </div>
      <div className="text-xs text-muted-foreground">{fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { me } = useAuth();
  const { data: menunggu } = useQuery({ queryKey: ["sewa", "menunggu"], queryFn: () => apiGet<Sewa[]>("/sewa?status=menunggu"), retry: false });
  const counts: Record<string, number> = { daftar: menunggu?.length ?? 0 };

  return (
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <div className="min-h-svh bg-slate-50">
        {/* Sidebar desktop */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex h-16 items-center border-b border-slate-200"><Brand /></div>
          <SidebarNav counts={counts} />
          <div className="mt-auto px-5 py-4 text-xs text-slate-500">{BRANDING.namaPasar} • {BRANDING.versi}</div>
        </aside>

        <div className="lg:pl-64">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
            <SheetTrigger data-testid="btn-menu-mobile"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted lg:hidden">
              <Menu className="size-5" />
            </SheetTrigger>
            <span className="text-sm font-bold tracking-tight text-slate-900 lg:hidden">{BRANDING.namaDesa}</span>
            <div className="ml-auto flex items-center gap-3">
              <ClockWita />
              <Link to="/" data-testid="topbar-btn-halaman-publik" title="Lihat halaman publik" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                <Globe className="size-4" />
              </Link>
              <Link to="/dashboard/scan-qr" data-testid="topbar-btn-scan-qr" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
                <ScanLine data-icon="inline-start" className="size-4" /> Pindai QR
              </Link>
              <Link to="/dashboard/scan-qr" data-testid="btn-scan-mobile" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "sm:hidden")}>
                <ScanLine className="size-4" />
              </Link>
              {/* Nama & peran akun yang login */}
              <div className="hidden text-right leading-tight md:block">
                <p className="text-sm font-semibold text-slate-900" data-testid="topbar-nama-user">{me?.nama}</p>
                <p className="text-xs text-brand" data-testid="topbar-role-user">{me && ROLE_LABEL[me.role]}</p>
              </div>
              <span data-testid="avatar-pengelola" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                {initials(me?.nama ?? "-")}
              </span>
              <Button variant="ghost" size="icon" onClick={() => void endSession()} data-testid="btn-logout" title="Keluar">
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
        </div>

        {/* Drawer mobile */}
        <SheetContent side="left" showCloseButton className="w-72 gap-0 bg-white p-0">
          <SheetHeader className="border-b border-slate-200 p-0">
            <div className="flex h-16 items-center"><Brand /></div>
            <SheetTitle className="sr-only">Navigasi</SheetTitle>
          </SheetHeader>
          <SidebarNav counts={counts} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </div>
    </Sheet>
  );
}
