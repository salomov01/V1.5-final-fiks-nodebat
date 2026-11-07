import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAPORAN = [
  { kind: "pembayaran", label: "Pemasukan" },
  { kind: "pengeluaran", label: "Pengeluaran" },
  { kind: "rekap", label: "Rekap Akhir (Saldo)" },
];

// Unduh file laporan (Excel/PDF) memakai cookie sesi — filter periode sama dengan tabel.
async function unduh(kind: string, ext: "xlsx" | "pdf", qs: string) {
  const res = await fetch(`/api/laporan/${kind}.${ext}?${qs}`);
  if (!res.ok) return toast.error("Gagal mengekspor laporan");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? `laporan.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// 3 jenis laporan × 2 format (Super Admin). Rekap Akhir: Saldo = Total Pemasukan − Total Pengeluaran.
export function ExportLaporan({ qs }: { qs: string }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="export-laporan">
      {LAPORAN.map((l) => (
        <div key={l.kind} className="flex items-center gap-1 rounded-xl border bg-card p-1 pl-3">
          <span className="mr-1 text-xs font-semibold text-brand">{l.label}</span>
          <Button size="sm" variant="ghost" onClick={() => void unduh(l.kind, "xlsx", qs)} data-testid={`btn-ekspor-${l.kind}-excel`}>
            <FileSpreadsheet data-icon="inline-start" className="size-4" /> Excel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void unduh(l.kind, "pdf", qs)} data-testid={`btn-ekspor-${l.kind}-pdf`}>
            <FileText data-icon="inline-start" className="size-4" /> PDF
          </Button>
        </div>
      ))}
    </div>
  );
}
