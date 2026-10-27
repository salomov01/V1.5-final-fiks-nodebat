import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import RequireAuth from "@/components/layout/RequireAuth";
import AppShell from "@/components/layout/AppShell";
import Home from "@/pages/public/Home";
import InfoPasar from "@/pages/public/InfoPasar";
import InformasiLapak from "@/pages/public/InformasiLapak";
import Login from "@/pages/Login";
import Dashboard from "@/pages/admin/Dashboard";
import Lapak from "@/pages/admin/Lapak";
import Pembayaran from "@/pages/admin/Pembayaran";
import Pendaftaran from "@/pages/admin/Pendaftaran";
import Pengaturan from "@/pages/admin/Pengaturan";
import Riwayat from "@/pages/admin/Riwayat";
import ScanQr from "@/pages/admin/ScanQr";
import Tunggakan from "@/pages/admin/Tunggakan";
import InfoPasarAdmin from "@/pages/admin/InfoPasarAdmin";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";

// Rute publik: /, /info-pasar, /informasi-lapak, /login. Semua /dashboard/* wajib login.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/info-pasar" element={<InfoPasar />} />
        <Route path="/informasi-lapak" element={<InformasiLapak />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={<Protected />} />
        <Route path="*" element={<LegacyRedirect />} />
      </Routes>
      <Toaster />
    </>
  );
}

// Tautan lama (/lapak, /scan-qr, ...) diarahkan ke /dashboard/...
function LegacyRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/dashboard${pathname}${search}`} replace />;
}

// Halaman khusus Super Admin: Staff diarahkan kembali ke dashboard.
function SuperOnly({ children }: { children: React.ReactElement }) {
  const { isSuper } = useAuth();
  return isSuper ? children : <Navigate to="/dashboard" replace />;
}

function Protected() {
  return (
    <RequireAuth>
      <AppShell>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="lapak" element={<Lapak />} />
          <Route path="pendaftaran" element={<Pendaftaran />} />
          <Route path="pembayaran" element={<Pembayaran />} />
          <Route path="tunggakan" element={<Tunggakan />} />
          <Route path="scan-qr" element={<ScanQr />} />
          <Route path="riwayat" element={<Riwayat />} />
          <Route path="info-pasar" element={<SuperOnly><InfoPasarAdmin /></SuperOnly>} />
          <Route path="pengaturan" element={<Pengaturan />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}
