import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiPost, apiPut } from "@/lib/api";
import { KATEGORI_LABEL, STATUS_PENYEWA_LABEL, formatRupiah } from "@/lib/format";
import { TARIF_DEFAULT, BRANDING } from "@/config";
import type { KategoriSewa, StatusPenyewa, Tenant, TenantCreate } from "@/lib/types";
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

interface FormState {
  nama_lengkap: string;
  no_hp: string;
  kategori: KategoriSewa;
  blok: string;
  mulai: string;
  selesai: string;
  status: StatusPenyewa;
  catatan: string;
}

const EMPTY: FormState = {
  nama_lengkap: "",
  no_hp: "",
  kategori: "harian",
  blok: "",
  mulai: "",
  selesai: "",
  status: "aktif",
  catatan: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null; // null = mode tambah
}

export default function TenantFormDialog({ open, onOpenChange, tenant }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [tarif, setTarif] = useState("");

  useEffect(() => {
    if (!open) return;
    if (tenant) {
      setForm({
        nama_lengkap: tenant.nama_lengkap,
        no_hp: tenant.no_hp,
        kategori: tenant.kategori,
        blok: tenant.blok,
        mulai: tenant.mulai,
        selesai: tenant.selesai,
        status: tenant.status,
        catatan: tenant.catatan,
      });
      setTarif(String(tenant.tarif));
    } else {
      setForm(EMPTY);
      setTarif("");
    }
  }, [open, tenant]);

  const mutation = useMutation({
    mutationFn: (payload: TenantCreate) =>
      tenant
        ? apiPut<Tenant>(`/tenants/${tenant.id}`, payload)
        : apiPost<Tenant>("/tenants", payload),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        tenant
          ? "Data penyewa berhasil diperbarui"
          : `Penyewa terdaftar — Nomor ID ${saved.nomor_id} & QR Code siap`
      );
      onOpenChange(false);
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError &&
        error.body &&
        typeof error.body === "object" &&
        "detail" in error.body
          ? String((error.body as { detail: unknown }).detail)
          : "Gagal menyimpan data penyewa";
      toast.error(detail);
    },
  });

  const submit = () => {
    if (!form.nama_lengkap.trim() || !form.blok.trim()) {
      toast.error("Nama lengkap dan blok lapak wajib diisi");
      return;
    }
    if (!form.mulai || !form.selesai) {
      toast.error("Tanggal mulai dan selesai sewa wajib diisi");
      return;
    }
    const tarifNum = Number(tarif);
    if (!Number.isFinite(tarifNum) || tarifNum <= 0) {
      toast.error("Tarif sewa harus berupa angka (Rupiah)");
      return;
    }
    mutation.mutate({ ...form, tarif: tarifNum });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="dialog-form-penyewa">
        <DialogHeader>
          <DialogTitle>{tenant ? "Ubah Data Penyewa" : "Tambah Penyewa Lapak"}</DialogTitle>
          <DialogDescription>
            {tenant
              ? `Perbarui data penyewa lapak ${BRANDING.namaPasar}.`
              : "Isi data penyewa baru. Nomor ID dan QR Code dibuat otomatis setelah tersimpan."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="penyewa-nama">Nama Lengkap</Label>
            <Input
              id="penyewa-nama"
              data-testid="input-nama-penyewa"
              value={form.nama_lengkap}
              onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
              placeholder="mis. I Wayan Sudira"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="penyewa-nohp">No. HP / WhatsApp</Label>
              <Input
                id="penyewa-nohp"
                data-testid="input-nohp-penyewa"
                value={form.no_hp}
                onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                placeholder="mis. 0812-3456-7890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="penyewa-blok">Blok / Nomor Lapak</Label>
              <Input
                id="penyewa-blok"
                data-testid="input-blok-penyewa"
                value={form.blok}
                onChange={(e) => setForm({ ...form, blok: e.target.value })}
                placeholder="mis. Blok C Daging & Ikan C-03"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Kategori Sewa</Label>
              <Select
                value={form.kategori}
                onValueChange={(v) => {
                  const kategori = v as KategoriSewa;
                  setForm({ ...form, kategori });
                  // Tarif otomatis: isi acuan kategori bila kolom masih kosong atau
                  // masih memakai acuan kategori sebelumnya (input manual dipertahankan).
                  const acuanLama = String(TARIF_DEFAULT[form.kategori] ?? "");
                  if (!tarif || tarif === acuanLama) {
                    setTarif(String(TARIF_DEFAULT[kategori] ?? ""));
                  }
                }}
              >
                <SelectTrigger className="w-full" data-testid="select-kategori">
                  <SelectValue>{(v) => KATEGORI_LABEL[v as string]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harian">Harian</SelectItem>
                  <SelectItem value="bulanan">Bulanan</SelectItem>
                  <SelectItem value="tahunan">Tahunan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="penyewa-tarif">Tarif Sewa (Rp)</Label>
              <Input
                id="penyewa-tarif"
                data-testid="input-tarif-penyewa"
                type="number"
                min={0}
                value={tarif}
                onChange={(e) => setTarif(e.target.value)}
                placeholder="mis. 450000"
              />
              <p className="text-xs text-muted-foreground" data-testid="hint-tarif-acuan">
                Acuan {KATEGORI_LABEL[form.kategori].toLowerCase()}:{" "}
                {formatRupiah(TARIF_DEFAULT[form.kategori] ?? 0)}
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as StatusPenyewa })}
              >
                <SelectTrigger className="w-full" data-testid="select-status-penyewa">
                  <SelectValue>{(v) => STATUS_PENYEWA_LABEL[v as string]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="berhenti">Berhenti</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="penyewa-mulai">Mulai Sewa</Label>
              <Input
                id="penyewa-mulai"
                data-testid="input-mulai-penyewa"
                type="date"
                value={form.mulai}
                onChange={(e) => setForm({ ...form, mulai: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="penyewa-selesai">Selesai Sewa</Label>
              <Input
                id="penyewa-selesai"
                data-testid="input-selesai-penyewa"
                type="date"
                value={form.selesai}
                onChange={(e) => setForm({ ...form, selesai: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="penyewa-catatan">Catatan (opsional)</Label>
            <Textarea
              id="penyewa-catatan"
              data-testid="input-catatan-penyewa"
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder="mis. menjual ikan bakar & sambal matah"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-batal-penyewa">
            Batal
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} data-testid="btn-simpan-penyewa">
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
