import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "@/services/api";
import { METODE_LABEL } from "@/utils/format";
import type { MetodeBayar, Payment, PaymentCreate, Tenant } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null; // prefill penyewa (mis. dari hasil scan QR)
}

export default function PaymentRecordDialog({ open, onOpenChange, tenant }: Props) {
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState("");
  const [periode, setPeriode] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [metode, setMetode] = useState<MetodeBayar>("tunai");
  const [jatuhTempo, setJatuhTempo] = useState("");
  const [catatan, setCatatan] = useState("");
  const { me } = useAuth(); // nama penagih otomatis = akun yang login

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiGet<Tenant[]>("/tenants"),
    enabled: open,
  });


  useEffect(() => {
    if (!open) return;
    setTenantId(tenant?.id ?? "");
    setJumlah(tenant ? String(tenant.tarif) : "");
    setPeriode("");
    setMetode("tunai");
    setJatuhTempo("");
    setCatatan("");
  }, [open, tenant]);

  const mutation = useMutation({
    mutationFn: (payload: PaymentCreate) => apiPost<Payment>("/payments", payload),
    onSuccess: (payment) => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Pembayaran ${payment.nama_lengkap} tercatat — menunggu konfirmasi`);
      onOpenChange(false);
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError &&
        error.body &&
        typeof error.body === "object" &&
        "detail" in error.body
          ? String((error.body as { detail: unknown }).detail)
          : "Gagal mencatat pembayaran";
      toast.error(detail);
    },
  });

  const submit = () => {
    const jumlahNum = Number(jumlah);
    if (!tenantId) {
      toast.error("Pilih penyewa terlebih dahulu");
      return;
    }
    if (!periode.trim()) {
      toast.error("Isi keterangan periode pembayaran");
      return;
    }
    if (!Number.isFinite(jumlahNum) || jumlahNum <= 0) {
      toast.error("Jumlah harus berupa angka (Rupiah)");
      return;
    }
    mutation.mutate({
      tenant_id: tenantId,
      periode: periode.trim(),
      jumlah: jumlahNum,
      metode,
      jatuh_tempo: jatuhTempo,
      catatan,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-catat-pembayaran">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>
            Pembayaran tercatat berstatus Menunggu — konfirmasi di halaman Pembayaran setelah
            dana diterima.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Penyewa</Label>
            <Select
              value={tenantId}
              onValueChange={(v) => {
                setTenantId(v);
                const t = tenants?.find((x) => x.id === v);
                if (t) setJumlah(String(t.tarif));
              }}
              disabled={!!tenant}
            >
              <SelectTrigger className="w-full" data-testid="select-penyewa-pembayaran">
                <SelectValue>
                  {(v) => {
                    const t = tenants?.find((x) => x.id === v);
                    return t ? `${t.nama_lengkap} — ${t.nomor_id}` : "Pilih penyewa";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nama_lengkap} — {t.nomor_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pembayaran-periode">Periode</Label>
              <Input
                id="pembayaran-periode"
                data-testid="input-periode"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                placeholder="mis. Desember 2025"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pembayaran-jumlah">Jumlah (Rp)</Label>
              <Input
                id="pembayaran-jumlah"
                data-testid="input-jumlah"
                type="number"
                min={0}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                placeholder="mis. 450000"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Metode</Label>
              <Select value={metode} onValueChange={(v) => setMetode(v as MetodeBayar)}>
                <SelectTrigger className="w-full" data-testid="select-metode">
                  <SelectValue>{(v) => METODE_LABEL[v as string]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tunai">Tunai</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pembayaran-jatuh-tempo">Jatuh Tempo (opsional)</Label>
              <Input
                id="pembayaran-jatuh-tempo"
                data-testid="input-jatuh-tempo"
                type="date"
                value={jatuhTempo}
                onChange={(e) => setJatuhTempo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pembayaran-penagih">Nama Penagih</Label>
            <Input id="pembayaran-penagih" readOnly value={me?.nama ?? ""} className="bg-muted" data-testid="input-penagih-pembayaran" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pembayaran-catatan">Catatan (opsional)</Label>
            <Textarea
              id="pembayaran-catatan"
              data-testid="input-catatan-pembayaran"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="mis. dibayar tunai via juru pungut Blok B"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-batal-pembayaran">
            Batal
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} data-testid="btn-simpan-pembayaran">
            {mutation.isPending ? "Menyimpan..." : "Catat Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
