import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import Beranda from "@/pages/Beranda";
import Dashboard from "@/pages/Dashboard";
import Lapak from "@/pages/Lapak";
import Login from "@/pages/Login";
import Pembayaran from "@/pages/Pembayaran";
import Pendaftaran from "@/pages/Pendaftaran";
import Pengaturan from "@/pages/Pengaturan";
import Riwayat from "@/pages/Riwayat";
import ScanQr from "@/pages/ScanQr";
import Tunggakan from "@/pages/Tunggakan";
import { Toaster } from "@/components/ui/sonner";

// "/" publik (katalog lapak kosong); semua fitur pengelola ada di /dashboard/* dan wajib login.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Beranda />} />
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
          <Route path="pengaturan" element={<Pengaturan />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}
