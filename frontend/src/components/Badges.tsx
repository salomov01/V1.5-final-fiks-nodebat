import type { KategoriSewa, StatusBayar } from "@/lib/types";
import { KATEGORI_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: StatusBayar }) {
  if (status === "lunas") {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700" data-testid="badge-status-lunas">
        Lunas
      </Badge>
    );
  }
  if (status === "ditolak") {
    return (
      <Badge className="border-red-200 bg-red-100 text-red-700" data-testid="badge-status-ditolak">
        Ditolak
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-200 bg-amber-100 text-amber-700" data-testid="badge-status-menunggu">
      <span className="relative flex size-2" data-icon="inline-start">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-amber-600" />
      </span>
      Menunggu
    </Badge>
  );
}

export function KategoriBadge({ kategori }: { kategori: KategoriSewa }) {
  const styles: Record<string, string> = {
    harian: "border-sky-200 bg-sky-100 text-sky-700",
    bulanan: "border-blue-200 bg-blue-100 text-blue-700",
    tahunan: "border-emerald-200 bg-emerald-100 text-emerald-700",
  };
  return (
    <Badge className={styles[kategori]} data-testid={`badge-kategori-${kategori}`}>
      {KATEGORI_LABEL[kategori]}
    </Badge>
  );
}
