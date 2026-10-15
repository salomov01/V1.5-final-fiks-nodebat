"""Seed data pasar Desa Adat Jimbaran — idempotent (reset & insert ulang).

Jalankan: cd /app/backend && python seed.py
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import os

from lib.db import db, ensure_indexes

ZONE = ZoneInfo(os.environ.get("APP_TZ", "Asia/Makassar"))
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

# nama, no_hp, kategori, blok, tarif, status
TENANTS = [
    ("I Wayan Sudira", "0812-3456-7801", "tahunan", "Blok A Pangan A-01", 5_000_000, "aktif"),
    ("Ni Made Rai", "0812-3456-7802", "bulanan", "Blok B Sayur & Buah B-07", 450_000, "aktif"),
    ("I Ketut Arnawa", "0812-3456-7803", "harian", "Blok C Daging & Ikan C-03", 25_000, "aktif"),
    ("Ni Luh Putu Sari", "0812-3456-7804", "harian", "Blok D Pakaian & Canang D-11", 20_000, "aktif"),
    ("I Gusti Ngurah Bagus", "0812-3456-7805", "tahunan", "Blok A Pangan A-05", 6_500_000, "aktif"),
    ("Ni Ketut Ayu Wulandari", "0812-3456-7806", "bulanan", "Blok B Sayur & Buah B-12", 600_000, "aktif"),
    ("I Made Suardika", "0812-3456-7807", "harian", "Blok C Daging & Ikan C-08", 30_000, "aktif"),
    ("Ni Wayan Eka Purwati", "0812-3456-7808", "bulanan", "Blok D Pakaian & Canang D-02", 350_000, "aktif"),
    ("I Nyoman Gede Ardana", "0812-3456-7809", "tahunan", "Blok A Pangan A-09", 4_200_000, "aktif"),
    ("Ni Putu Ratna Dewi", "0812-3456-7810", "bulanan", "Blok B Sayur & Buah B-15", 500_000, "aktif"),
    ("I Dewa Made Prabawa", "0812-3456-7811", "harian", "Blok C Daging & Ikan C-14", 15_000, "berhenti"),
    ("Ni Sagung Ayu Lestari", "0812-3456-7812", "tahunan", "Blok D Pakaian & Canang D-06", 7_500_000, "aktif"),
    ("I Komang Tri Susila", "0812-3456-7813", "bulanan", "Blok A Pangan A-14", 400_000, "aktif"),
    ("Ni Made Sari Murni", "0812-3456-7814", "harian", "Blok B Sayur & Buah B-03", 15_000, "aktif"),
]


# Lapak tambahan yang belum disewa (tampil di halaman publik).
EXTRA_UNITS = [
    ("Blok A Pangan A-02", "tahunan", 5_000_000), ("Blok A Pangan A-03", "bulanan", 450_000),
    ("Blok B Sayur & Buah B-01", "bulanan", 450_000), ("Blok B Sayur & Buah B-02", "harian", 20_000),
    ("Blok C Daging & Ikan C-01", "harian", 25_000), ("Blok D Pakaian & Canang D-01", "bulanan", 350_000),
]


def jenis_dari_blok(blok: str) -> str:
    return " ".join(blok.split(" ")[2:-1])


async def seed_units() -> None:
    rows = [(b, k, t) for _, _, k, b, t, _ in TENANTS] + EXTRA_UNITS
    await db.lapak_units.insert_many([{
        "id": str(uuid.uuid4()), "blok": b, "jenis": jenis_dari_blok(b), "kategori": k, "tarif": t,
        "deskripsi": "", "created_at": datetime.now(timezone.utc),
    } for b, k, t in rows])


def month_start(now: datetime, months_back: int) -> datetime:
    y, m = now.year, now.month - months_back
    while m <= 0:
        m += 12
        y -= 1
    return datetime(y, m, 1, tzinfo=ZONE)


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


async def main() -> None:
    await db.tenants.delete_many({})
    await db.payments.delete_many({})
    await db.counters.delete_many({})
    await db.penagih.delete_many({})
    await db.lapak_units.delete_many({})
    await db.pendaftaran.delete_many({})

    for nama in ["I Wayan Juru Pungut", "Ni Made Penagih", "I Ketut Kolektor"]:
        await db.penagih.insert_one({
            "id": str(uuid.uuid4()),
            "nama": nama,
            "created_at": datetime.now(timezone.utc),
        })

    now_local = datetime.now(ZONE)
    today = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    tenants_docs = []
    for idx, (nama, no_hp, kategori, blok, tarif, status) in enumerate(TENANTS, start=1):
        if kategori == "tahunan":
            mulai = iso(today.replace(month=1, day=1))
            selesai = iso(today.replace(month=12, day=31))
        elif kategori == "bulanan":
            mulai = iso(month_start(now_local, 6))
            selesai = iso(today)
        else:  # harian
            mulai = iso(today)
            selesai = iso(today)
        tenants_docs.append({
            "id": str(uuid.uuid4()),
            "nomor_id": f"LPK-JMB-{idx:03d}",
            "nama_lengkap": nama,
            "no_hp": no_hp,
            "kategori": kategori,
            "blok": blok,
            "tarif": tarif,
            "mulai": mulai,
            "selesai": selesai,
            "status": status,
            "catatan": "",
            "created_at": datetime.now(timezone.utc) - timedelta(days=idx),
        })

    payments_docs = []
    for idx, t in enumerate(tenants_docs):
        tarif = t["tarif"]
        i = idx + 1
        if t["kategori"] == "bulanan" and t["status"] == "aktif":
            for back in range(5, 0, -1):  # 5 bulan lalu s.d. bulan lalu: lunas
                confirmed = month_start(now_local, back) + timedelta(days=(i * 3) % 27, hours=9)
                payments_docs.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": t["id"],
                    "nomor_id": t["nomor_id"],
                    "nama_lengkap": t["nama_lengkap"],
                    "periode": f"{BULAN[confirmed.month - 1]} {confirmed.year}",
                    "jumlah": tarif,
                    "metode": ("tunai", "qris", "transfer")[i % 3],
                    "status": "lunas",
                    "jatuh_tempo": "",
                    "catatan": "",
                    "confirmed_at": confirmed.astimezone(timezone.utc),
                    "created_at": confirmed.astimezone(timezone.utc),
                })
            payments_docs.append({  # tagihan bulan berjalan: menunggu
                "id": str(uuid.uuid4()),
                "tenant_id": t["id"],
                "nomor_id": t["nomor_id"],
                "nama_lengkap": t["nama_lengkap"],
                "periode": f"{BULAN[now_local.month - 1]} {now_local.year}",
                "jumlah": tarif,
                "metode": "tunai",
                "status": "menunggu",
                "jatuh_tempo": iso(today + timedelta(days=7)),
                "catatan": "",
                "confirmed_at": None,
                "created_at": datetime.now(timezone.utc),
            })
        elif t["kategori"] == "tahunan" and t["status"] == "aktif":
            confirmed = month_start(now_local, (i % 4) + 2) + timedelta(days=(i * 5) % 27, hours=10)
            payments_docs.append({
                "id": str(uuid.uuid4()),
                "tenant_id": t["id"],
                "nomor_id": t["nomor_id"],
                "nama_lengkap": t["nama_lengkap"],
                "periode": f"Sewa Tahunan {confirmed.year}",
                "jumlah": tarif,
                "metode": "transfer",
                "status": "lunas",
                "jatuh_tempo": "",
                "catatan": "",
                "confirmed_at": confirmed.astimezone(timezone.utc),
                "created_at": confirmed.astimezone(timezone.utc),
            })
            payments_docs.append({
                "id": str(uuid.uuid4()),
                "tenant_id": t["id"],
                "nomor_id": t["nomor_id"],
                "nama_lengkap": t["nama_lengkap"],
                "periode": f"Sewa Tahunan {confirmed.year + 1}",
                "jumlah": tarif,
                "metode": "transfer",
                "status": "menunggu",
                "jatuh_tempo": iso(today + timedelta(days=20)),
                "catatan": "",
                "confirmed_at": None,
                "created_at": datetime.now(timezone.utc),
            })
        else:  # harian (atau penyewa berhenti)
            kemarin = today - timedelta(days=1)
            if t["status"] == "aktif":
                payments_docs.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": t["id"],
                    "nomor_id": t["nomor_id"],
                    "nama_lengkap": t["nama_lengkap"],
                    "periode": f"Retribusi {kemarin.strftime('%d/%m')}",
                    "jumlah": tarif,
                    "metode": "tunai",
                    "status": "lunas",
                    "jatuh_tempo": "",
                    "catatan": "",
                    "confirmed_at": kemarin + timedelta(hours=8),
                    "created_at": kemarin + timedelta(hours=8),
                })
                payments_docs.append({
                    "id": str(uuid.uuid4()),
                    "tenant_id": t["id"],
                    "nomor_id": t["nomor_id"],
                    "nama_lengkap": t["nama_lengkap"],
                    "periode": f"Retribusi {today.strftime('%d/%m')}",
                    "jumlah": tarif,
                    "metode": "tunai",
                    "status": "menunggu",
                    "jatuh_tempo": iso(today),
                    "catatan": "",
                    "confirmed_at": None,
                    "created_at": datetime.now(timezone.utc),
                })

    if tenants_docs:
        await db.tenants.insert_many(tenants_docs)
    # Tunggakan: beberapa tagihan lampau yang belum dibayar (jatuh tempo sudah lewat),
    # agar halaman Rekap Tunggakan punya data nyata dengan lama keterlambatan berbeda.
    bulanan = [t for t in tenants_docs if t["kategori"] == "bulanan" and t["status"] == "aktif"]
    for n, t in enumerate(bulanan[:3]):
        back = n + 1  # 1, 2, 3 bulan lalu -> makin lama makin telat
        awal_bulan = month_start(now_local, back)
        tempo = awal_bulan + timedelta(days=9)  # jatuh tempo tanggal 10
        payments_docs.append({
            "id": str(uuid.uuid4()),
            "tenant_id": t["id"],
            "nomor_id": t["nomor_id"],
            "nama_lengkap": t["nama_lengkap"],
            "periode": f"{BULAN[awal_bulan.month - 1]} {awal_bulan.year} (tunggakan)",
            "jumlah": t["tarif"],
            "metode": "tunai",
            "status": "menunggu",
            "jatuh_tempo": iso(tempo),
            "catatan": "Belum dibayar sampai jatuh tempo",
            "confirmed_at": None,
            "created_at": awal_bulan.astimezone(timezone.utc),
        })

    if payments_docs:
        await db.payments.insert_many(payments_docs)
    await db.counters.find_one_and_update(
        {"_id": "lapak_seq"}, {"$set": {"seq": len(TENANTS)}}, upsert=True
    )
    await seed_units()
    await ensure_indexes()

    print(f"Seed selesai: {len(tenants_docs)} penyewa, {len(payments_docs)} pembayaran.")


if __name__ == "__main__":
    asyncio.run(main())
