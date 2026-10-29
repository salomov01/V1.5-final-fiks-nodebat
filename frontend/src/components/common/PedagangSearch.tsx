import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiGet } from "@/services/api";
import type { PedagangRingkas } from "@/types";
import { Input } from "@/components/ui/input";

// Dropdown pencarian akun pedagang: ketik nama → pilih dari hasil.
// endpoint: "/publik/pedagang" (halaman publik) atau "/pedagang" (admin).
export default function PedagangSearch({ endpoint, value, onSelect }: {
  endpoint: string;
  value: PedagangRingkas | null;
  onSelect: (p: PedagangRingkas | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<PedagangRingkas[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return setHasil([]);
    const t = setTimeout(() => {
      apiGet<PedagangRingkas[]>(`${endpoint}?q=${encodeURIComponent(q.trim())}`)
        .then((d) => setHasil(d.slice(0, 10)))
        .catch(() => setHasil([]));
    }, 250); // debounce ketikan
    return () => clearTimeout(t);
  }, [q, endpoint]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm" data-testid="pedagang-terpilih">
        <span><b>{value.nama}</b> <span className="text-muted-foreground">({value.user_id})</span></span>
        <button type="button" className="text-xs text-brand underline" onClick={() => onSelect(null)} data-testid="btn-ganti-pedagang">Ganti</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Ketik nama pedagang..." value={q} data-testid="input-cari-pedagang"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && hasil.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-white shadow-lg" data-testid="hasil-cari-pedagang">
          {hasil.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
                data-testid={`opsi-pedagang-${p.user_id}`} onClick={() => { onSelect(p); setQ(""); setOpen(false); }}>
                <span>{p.nama}</span><span className="font-mono text-xs text-muted-foreground">{p.user_id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
