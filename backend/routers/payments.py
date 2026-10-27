"""Pencatatan & verifikasi pembayaran sewa lapak."""

from datetime import date
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from lib.activity import log_activity
from lib.config import (
    CATATAN_TAGIHAN_MASSAL,
    JATUH_TEMPO_TANGGAL_BULANAN,
    NAMA_BULAN_ID,
)
from lib.db import db
from lib.dates import today_iso
from lib.serialize import aware_utcnow, to_aware
from models.payment import (
    BulkBillResult,
    OverduePayment,
    OverdueSummary,
    Payment,
    PaymentCreate,
    ScanCollectInput,
)
from routers.auth import SUPER_ADMIN, Principal, get_principal, require_session, require_super

router = APIRouter(prefix="/payments", tags=["payments"], dependencies=[Depends(require_session)])


def _to_payment(doc: dict) -> Payment:
    return Payment(**to_aware(doc, "created_at", "confirmed_at"))


def _label(doc: dict) -> str:
    return f"{doc.get('nama_lengkap', '-')} ({doc.get('nomor_id', '-')})"


BULAN_ID = NAMA_BULAN_ID


def _days_between(iso_awal: str, iso_akhir: str) -> int:
    """Selisih hari antara dua tanggal ISO (YYYY-MM-DD)."""
    awal = date.fromisoformat(iso_awal)
    akhir = date.fromisoformat(iso_akhir)
    return (akhir - awal).days


# Rute statis didefinisikan sebelum rute ber-parameter agar tidak tertangkap /{id}.
@router.get("/overdue", response_model=OverdueSummary)
async def list_overdue(me: Principal = Depends(get_principal)):
    """Rekap tunggakan: tagihan `menunggu` yang jatuh temponya sudah lewat hari ini (WITA)."""
    hari_ini = today_iso()
    docs = await db.payments.find({"status": "menunggu"}).to_list(2000)

    items: list[OverduePayment] = []
    for d in docs:
        jatuh_tempo = (d.get("jatuh_tempo") or "").strip()
        if not jatuh_tempo or jatuh_tempo >= hari_ini:
            continue  # belum jatuh tempo / tanpa tanggal tempo
        tenant = await db.tenants.find_one({"id": d.get("tenant_id")}) or {}
        payment = Payment(**to_aware(d, "created_at", "confirmed_at"))
        items.append(
            OverduePayment(
                **payment.model_dump(),
                hari_telat=_days_between(jatuh_tempo, hari_ini),
                kategori=tenant.get("kategori", ""),
                blok=tenant.get("blok", ""),
                no_hp=tenant.get("no_hp", ""),
            )
        )

    items.sort(key=lambda x: x.hari_telat, reverse=True)
    return OverdueSummary(
        periode_hari_ini=hari_ini,
        jumlah_penyewa=len({i.tenant_id for i in items}),
        total_tunggakan=sum(i.jumlah for i in items) if me.role == SUPER_ADMIN else None,
        telat_terlama=items[0].hari_telat if items else 0,
        items=items,
    )


@router.post("/bulk-monthly", response_model=BulkBillResult)
async def bulk_monthly_bills(actor: str = Depends(require_session)):
    """Terbitkan tagihan bulan berjalan untuk semua penyewa BULANAN yang aktif.
    Idempotent: penyewa yang sudah punya tagihan periode ini dilewati."""
    hari_ini = today_iso()
    tahun, bulan = int(hari_ini[:4]), int(hari_ini[5:7])
    periode = f"{BULAN_ID[bulan - 1]} {tahun}"
    # Jatuh tempo: tanggal JATUH_TEMPO_TANGGAL_BULANAN (lib/config.py) bulan berjalan
    jatuh_tempo = f"{tahun:04d}-{bulan:02d}-{JATUH_TEMPO_TANGGAL_BULANAN:02d}"

    dibuat = 0
    dilewati = 0
    total = 0
    baru: list[dict] = []
    async for tenant in db.tenants.find({"kategori": "bulanan", "status": "aktif"}):
        sudah_ada = await db.payments.find_one({"tenant_id": tenant["id"], "periode": periode})
        if sudah_ada:
            dilewati += 1
            continue
        payment = Payment(
            tenant_id=tenant["id"],
            nomor_id=tenant["nomor_id"],
            nama_lengkap=tenant["nama_lengkap"],
            periode=periode,
            jumlah=int(tenant.get("tarif", 0)),
            metode="tunai",
            status="menunggu",
            jatuh_tempo=jatuh_tempo,
            catatan=CATATAN_TAGIHAN_MASSAL,
            created_at=aware_utcnow(),
        )
        baru.append(payment.model_dump())
        dibuat += 1
        total += payment.jumlah

    if baru:
        await db.payments.insert_many(baru)
        await log_activity(
            actor, "buat", "pembayaran", "bulk",
            f"Tagihan massal {periode}",
            f"{dibuat} tagihan diterbitkan, {dilewati} dilewati",
        )

    return BulkBillResult(periode=periode, dibuat=dibuat, dilewati=dilewati, total_nilai=total)


@router.get("", response_model=List[Payment])
async def list_payments(
    status: str | None = Query(None),
    tenant_id: str | None = Query(None),
):
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if tenant_id:
        query["tenant_id"] = tenant_id
    docs = await db.payments.find(query).sort("created_at", -1).to_list(1000)
    return [_to_payment(d) for d in docs]


@router.post("", response_model=Payment, status_code=201)
async def create_payment(input: PaymentCreate, me: Principal = Depends(get_principal)):
    actor = me.username
    tenant = await db.tenants.find_one({"id": input.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Penyewa tidak ditemukan")
    payment = Payment(
        tenant_id=input.tenant_id,
        nomor_id=tenant["nomor_id"],
        nama_lengkap=tenant["nama_lengkap"],
        periode=input.periode,
        jumlah=input.jumlah,
        metode=input.metode,
        status="menunggu",
        jatuh_tempo=input.jatuh_tempo,
        catatan=input.catatan,
        penagih=me.nama,  # otomatis = akun yang login
        created_at=aware_utcnow(),
    )
    await db.payments.insert_one(payment.model_dump())
    await log_activity(
        actor, "buat", "pembayaran", payment.id,
        f"{payment.nama_lengkap} ({payment.nomor_id})",
        f"{payment.periode} — Rp {payment.jumlah:,}".replace(",", ".")
        + (f" • Penagih: {payment.penagih}" if payment.penagih else ""),
    )
    return payment


def _periode_untuk(tenant: dict) -> str:
    """Label periode berjalan sesuai kategori penyewa (zona WITA)."""
    hari_ini = today_iso()
    tahun, bulan = int(hari_ini[:4]), int(hari_ini[5:7])
    kategori = tenant.get("kategori")
    if kategori == "tahunan":
        return f"Sewa Tahunan {tahun}"
    if kategori == "harian":
        return f"Retribusi {hari_ini[8:10]}/{hari_ini[5:7]}"
    return f"{BULAN_ID[bulan - 1]} {tahun}"


@router.post("/scan-collect", response_model=Payment, status_code=201)
async def scan_collect(input: ScanCollectInput, me: Principal = Depends(get_principal)):
    """Penagihan dari hasil scan QR oleh penagih di lapangan.

    - Sudah bayar  -> pembayaran periode berjalan langsung LUNAS (confirmed).
    - Belum bayar  -> dicatat sebagai tunggakan/menunggu + nama penagih.
    Idempotent per periode: jika tagihan periode ini sudah ada & masih menunggu,
    status/penagih-nya diperbarui alih-alih membuat duplikat.
    """
    tenant = await db.tenants.find_one({"id": input.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Penyewa tidak ditemukan")

    # Nama penagih selalu = akun yang sedang login (tidak bisa diisi dari klien).
    penagih = me.nama
    actor = me.username
    periode = _periode_untuk(tenant)
    hari_ini = today_iso()
    now = aware_utcnow()
    jumlah = int(tenant.get("tarif", 0))

    status = "lunas" if input.sudah_bayar else "menunggu"
    catatan = (
        f"Ditagih via scan QR oleh {penagih} pada {hari_ini}"
        if input.sudah_bayar
        else f"Kunjungan penagihan {hari_ini} oleh {penagih} — belum bayar"
    )

    existing = await db.payments.find_one(
        {"tenant_id": tenant["id"], "periode": periode, "status": {"$in": ["menunggu", "lunas"]}},
        sort=[("status", -1)],  # "menunggu" > "lunas" secara abjad -> tagihan menunggu didahulukan
    )
    # Periode ini sudah LUNAS -> tolak agar pemasukan tidak tercatat ganda.
    if existing and existing["status"] == "lunas":
        raise HTTPException(status_code=409, detail=f"{tenant['nama_lengkap']} sudah LUNAS untuk periode {periode}")
    if existing:
        updates = {"penagih": penagih, "catatan": catatan}
        if input.sudah_bayar:
            updates["status"] = "lunas"
            updates["confirmed_at"] = now
        doc = await db.payments.find_one_and_update(
            {"id": existing["id"]}, {"$set": updates}, return_document=ReturnDocument.AFTER
        )
        payment = _to_payment(doc)
    else:
        payment = Payment(
            tenant_id=tenant["id"],
            nomor_id=tenant["nomor_id"],
            nama_lengkap=tenant["nama_lengkap"],
            periode=periode,
            jumlah=jumlah,
            metode="tunai",
            status=status,
            jatuh_tempo="" if input.sudah_bayar else hari_ini,
            catatan=catatan,
            penagih=penagih,
            confirmed_at=now if input.sudah_bayar else None,
            created_at=now,
        )
        await db.payments.insert_one(payment.model_dump())

    aksi = "konfirmasi" if input.sudah_bayar else "buat"
    await log_activity(
        actor, aksi, "pembayaran", payment.id,
        f"{payment.nama_lengkap} ({payment.nomor_id})",
        f"{periode} — {'LUNAS' if input.sudah_bayar else 'Belum bayar'} • Penagih: {penagih}",
    )
    return payment


@router.patch("/{id}/confirm", response_model=Payment)
async def confirm_payment(id: str, actor: str = Depends(require_super)):
    # Hanya tagihan berstatus `menunggu` yang boleh dikonfirmasi — mencegah
    # konfirmasi ganda dan menghidupkan kembali pembayaran yang sudah ditolak.
    doc = await db.payments.find_one_and_update(
        {"id": id, "status": "menunggu"},
        {"$set": {"status": "lunas", "confirmed_at": aware_utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        ada = await db.payments.find_one({"id": id})
        if not ada:
            raise HTTPException(status_code=404, detail="Pembayaran tidak ditemukan")
        raise HTTPException(
            status_code=409,
            detail=f"Pembayaran ini sudah berstatus {ada.get('status')} — tidak bisa dikonfirmasi lagi",
        )
    await log_activity(
        actor, "konfirmasi", "pembayaran", id, _label(doc),
        f"{doc.get('periode', '')} — Rp {int(doc.get('jumlah', 0)):,}".replace(",", "."),
    )
    return _to_payment(doc)


@router.patch("/{id}/reject", response_model=Payment)
async def reject_payment(id: str, actor: str = Depends(require_super)):
    # Hanya tagihan `menunggu` yang boleh ditolak.
    doc = await db.payments.find_one_and_update(
        {"id": id, "status": "menunggu"},
        {"$set": {"status": "ditolak"}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        ada = await db.payments.find_one({"id": id})
        if not ada:
            raise HTTPException(status_code=404, detail="Pembayaran tidak ditemukan")
        raise HTTPException(
            status_code=409,
            detail=f"Pembayaran ini sudah berstatus {ada.get('status')} — tidak bisa ditolak",
        )
    await log_activity(actor, "tolak", "pembayaran", id, _label(doc), doc.get("periode", ""))
    return _to_payment(doc)


@router.delete("/{id}")
async def delete_payment(id: str, actor: str = Depends(require_super)):
    doc = await db.payments.find_one({"id": id})
    result = await db.payments.delete_one({"id": id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pembayaran tidak ditemukan")
    if doc:
        await log_activity(actor, "hapus", "pembayaran", id, _label(doc), doc.get("periode", ""))
    return {"deleted": True}
