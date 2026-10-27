import type { ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";

// Footer publik — teks hak cipta rata tengah.
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-900" data-testid="footer">
      © 2026 Bina desa adat jimbaran. All rights reserved.
    </footer>
  );
}

// Kerangka semua halaman publik: Navbar (sticky) + isi + Footer.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
