import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoDesa from "@/assets/logo-desa.svg";
import { cn } from "@/lib/utils";

// Menu navigasi publik (urutan sesuai permintaan). Ubah label/tujuan di sini.
const MENU = [
  { to: "/", label: "Home", end: true, testid: "nav-home" },
  { to: "/info-pasar", label: "Info Pasar", testid: "nav-info-pasar" },
  { to: "/informasi-lapak", label: "Informasi Lapak", testid: "nav-informasi-lapak" },
  { to: "/harga-barang", label: "Harga Barang", testid: "nav-harga-barang" },
  { to: "/login", label: "Login", testid: "nav-login" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
      isActive ? "bg-brand text-white" : "text-slate-900 hover:bg-brand-50 hover:text-brand");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md" data-testid="navbar">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Kiri: logo + nama desa */}
        <Link to="/" className="flex items-center gap-3" data-testid="navbar-brand">
          <img src={logoDesa} alt="Logo Desa Adat Jimbaran" className="size-10" />
          <span className="text-base font-bold tracking-tight text-slate-900">Desa Adat Jimbaran</span>
        </Link>
        {/* Kanan: menu desktop */}
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={linkClass} data-testid={m.testid}>{m.label}</NavLink>
          ))}
        </nav>
        <button type="button" className="ml-auto rounded-lg p-2 text-slate-900 md:hidden" onClick={() => setOpen(!open)}
          aria-label="Menu" data-testid="navbar-toggle">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {/* Menu mobile */}
      {open && (
        <nav className="flex flex-col gap-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden" data-testid="navbar-mobile">
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={linkClass} onClick={() => setOpen(false)}>{m.label}</NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
