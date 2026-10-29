"""Isi database dari file Excel pedagang & lapak (data/*.xlsx).

Jalankan: cd backend && python seed.py
Menghapus data pedagang, lapak, sewa, pembayaran lama. Akun login, info pasar & berita TIDAK dihapus.
"""

import asyncio
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook

from lib.db import db, ensure_indexes

DATA = Path(__file__).parent / "data"


def rupiah(v) -> int:
    return int(re.sub(r"\D", "", str(v or "0")) or 0)


def baca_pedagang() -> list[dict]:
    ws = load_workbook(DATA / "pedagang.xlsx", data_only=True).active
    out = []
    for nama, nik, hp, alamat in ws.iter_rows(min_row=2, max_col=4, values_only=True):
        if nama and nik:
            out.append({"nama": str(nama).strip(), "nik": re.sub(r"\D", "", str(nik)), "no_hp": str(hp or "").strip(),
                        "alamat": str(alamat or "").strip()})
    return out


def baca_lapak() -> list[dict]:
    ws = load_workbook(DATA / "lapak.xlsx", data_only=True).active
    out = []
    for no, nama, harga, iuran, *_ in ws.iter_rows(min_row=5, values_only=True):
        if isinstance(no, (int, float)) and nama:
            out.append({"nama": str(nama).strip(), "harga_sewa": rupiah(harga), "iuran": rupiah(iuran)})
    return out


async def main() -> None:
    for col in ("pedagang", "lapak", "sewa", "payments", "iuran_lock"):
        await db[col].delete_many({})
    await db.counters.delete_one({"_id": "pedagang_seq"})
    now = datetime.now(timezone.utc)

    pedagang = baca_pedagang()
    for i, p in enumerate(pedagang, start=1):
        p |= {"id": str(uuid.uuid4()), "user_id": f"{i:02d}-{p['nik'][-3:]}", "aktif": True, "created_at": now}
    if pedagang:
        await db.pedagang.insert_many(pedagang)
    await db.counters.update_one({"_id": "pedagang_seq"}, {"$set": {"seq": len(pedagang)}}, upsert=True)

    lapak = [{"id": str(uuid.uuid4()), "jenis": "", "deskripsi": "", "foto_path": None, "foto_versi": 0,
              "created_at": now, **l} for l in baca_lapak()]
    if lapak:
        await db.lapak.insert_many(lapak)
    await ensure_indexes()
    print(f"Selesai: {len(pedagang)} pedagang, {len(lapak)} lapak.")


if __name__ == "__main__":
    asyncio.run(main())
