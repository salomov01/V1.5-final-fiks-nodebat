import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock } from "lucide-react";
import { apiGet, apiPut } from "@/services/api";
import { errDetail } from "@/utils/errors";
import { todayISO } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Tanggal sistem mulai dipakai: iuran sebelum tanggal ini tidak dihitung sebagai tunggakan (Super Admin).
export function MulaiTunggakanCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pengaturan-tunggakan"], queryFn: () => apiGet<{ mulai: string }>("/pengaturan/tunggakan") });
  const [mulai, setMulai] = useState("");
  useEffect(() => { if (data) setMulai(data.mulai); }, [data]);
  const simpan = useMutation({
    mutationFn: () => apiPut("/pengaturan/tunggakan", { mulai }),
    onSuccess: () => { for (const k of ["pengaturan-tunggakan", "tunggakan"]) void qc.invalidateQueries({ queryKey: [k] }); toast.success("Tanggal mulai hitung tunggakan disimpan"); },
    onError: (e) => toast.error(errDetail(e, "Gagal menyimpan tanggal")),
  });
  return (
    <Card data-testid="kartu-mulai-tunggakan">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlarmClock className="size-5 text-brand" /> Mulai Hitung Tunggakan</CardTitle>
        <CardDescription>Iuran harian sebelum tanggal ini tidak dihitung sebagai tunggakan (tanggal sistem mulai dipakai).</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
          <Input type="date" max={todayISO()} value={mulai} onChange={(e) => setMulai(e.target.value)} data-testid="input-mulai-tunggakan" />
          <Button type="submit" disabled={!mulai || simpan.isPending} data-testid="btn-simpan-mulai-tunggakan">Simpan</Button>
        </form>
      </CardContent>
    </Card>
  );
}
