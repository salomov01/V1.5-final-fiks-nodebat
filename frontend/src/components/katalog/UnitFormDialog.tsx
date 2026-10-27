import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TARIF_DEFAULT } from "@/config";
import { apiPost, apiPut } from "@/services/api";
import { KATEGORI_LABEL } from "@/utils/format";
import type { KategoriSewa, LapakUnit } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errDetail, invalidateKatalog } from "@/components/katalog/PendaftaranList";

const KOSONG = { blok: "", jenis: "", kategori: "bulanan" as KategoriSewa, tarif: String(TARIF_DEFAULT.bulanan), deskripsi: "" };

export default function UnitFormDialog({ open, unit, onClose }: { open: boolean; unit: LapakUnit | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(KOSONG);
  useEffect(() => {
    if (open) setForm(unit ? { ...unit, tarif: String(unit.tarif) } : KOSONG);
  }, [open, unit]);

  const simpan = useMutation({
    mutationFn: () => {
      const body = { ...form, tarif: Number(form.tarif) };
      return unit ? apiPut(`/lapak-unit/${unit.id}`, body) : apiPost("/lapak-unit", body);
    },
    onSuccess: () => { invalidateKatalog(qc); toast.success("Katalog lapak disimpan"); onClose(); },
    onError: (e) => toast.error(errDetail(e, "Periksa kembali isian lapak")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-form-unit">
        <DialogHeader><DialogTitle>{unit ? "Ubah Lapak" : "Tambah Lapak ke Katalog"}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }}>
          <div className="grid gap-2">
            <Label htmlFor="unit-blok">Nama / nomor lapak</Label>
            <Input id="unit-blok" required placeholder="Blok A Pangan A-20" value={form.blok} data-testid="input-unit-blok"
              onChange={(e) => setForm({ ...form, blok: e.target.value })} />
            <p className="text-xs text-muted-foreground">Harus sama persis dengan kolom Blok pada data penyewa.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit-jenis">Jenis lapak</Label>
            <Input id="unit-jenis" placeholder="Pangan, Sayur & Buah, ..." value={form.jenis} data-testid="input-unit-jenis"
              onChange={(e) => setForm({ ...form, jenis: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Kategori sewa</Label>
              <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v as KategoriSewa, tarif: String(TARIF_DEFAULT[v as string]) })}>
                <SelectTrigger className="w-full" data-testid="select-unit-kategori">
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
              <Label htmlFor="unit-tarif">Tarif (Rp)</Label>
              <Input id="unit-tarif" required inputMode="numeric" value={form.tarif} data-testid="input-unit-tarif"
                onChange={(e) => setForm({ ...form, tarif: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit-desk">Deskripsi (opsional)</Label>
            <Input id="unit-desk" value={form.deskripsi} data-testid="input-unit-deskripsi"
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={simpan.isPending} data-testid="btn-simpan-unit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
