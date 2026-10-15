// Tautan pengingat WhatsApp — wa.me tanpa integrasi/API key, cukup tautan pra-isi.
// Isi pesan & nama pasar diatur di src/config.ts (PESAN_WA & BRANDING).
import type { Payment, Tenant } from "@/lib/types";
import { formatDateID, formatRupiah } from "@/lib/format";
import { BRANDING, PESAN_WA } from "@/config";

/** 0812-3456-7801 -> 6281234567801 (format E.164 tanpa tanda '+'). */
export function normalizePhoneID(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

/** Ganti penanda {nama}, {blok}, {nomorId}, {namaPasar} dengan data sebenarnya. */
function isiTemplate(template: string, tenant: Tenant): string {
  return template
    .replaceAll("{nama}", tenant.nama_lengkap)
    .replaceAll("{blok}", tenant.blok)
    .replaceAll("{nomorId}", tenant.nomor_id)
    .replaceAll("{namaPasar}", BRANDING.namaPasar)
    .replaceAll("{namaDesa}", BRANDING.namaDesa);
}

export function reminderText(tenant: Tenant, payment?: Payment | null): string {
  const sapaan = isiTemplate(PESAN_WA.sapaan, tenant);
  const identitas = isiTemplate(PESAN_WA.identitas, tenant);
  const tagihan = payment
    ? `Mohon informasi pembayaran sewa untuk ${payment.periode} sebesar ${formatRupiah(payment.jumlah)}${
        payment.jatuh_tempo ? ` yang jatuh tempo pada ${formatDateID(payment.jatuh_tempo)}` : ""
      }, saat ini masih menunggu konfirmasi.`
    : `Mohon informasi pembayaran sewa lapak sebesar ${formatRupiah(tenant.tarif)} untuk periode berjalan (masa sewa s.d. ${formatDateID(tenant.selesai)}).`;
  return [sapaan, identitas, tagihan, PESAN_WA.penutup].join("\n\n");
}

/** Tautan wa.me siap buka, atau null bila nomor HP penyewa belum diisi. */
export function waReminderLink(tenant: Tenant, payment?: Payment | null): string | null {
  const phone = normalizePhoneID(tenant.no_hp);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(reminderText(tenant, payment))}`;
}
