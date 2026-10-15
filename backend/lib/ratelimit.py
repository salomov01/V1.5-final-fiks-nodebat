"""Pembatas laju percobaan login (anti brute-force).

Hitungan kegagalan disimpan di koleksi `login_attempts` (TTL index), dikunci
per kombinasi username + alamat IP. Tidak memakai memori proses agar tetap
bekerja setelah server reload.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from lib.db import db

MAX_GAGAL = 5             # jumlah kegagalan sebelum dikunci
JENDELA_MENIT = 15        # kegagalan dihitung dalam rentang ini
KUNCI_MENIT = 15          # lama penguncian setelah melewati batas


def client_ip(request: Request) -> str:
    """Alamat IP pemanggil, menghormati header proxy/ingress."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _key(scope: str, ident: str, ip: str) -> str:
    return f"{scope}:{ident.lower()}:{ip}"


async def guard(scope: str, ident: str, request: Request) -> None:
    """Tolak permintaan (429) bila percobaan gagal sudah melewati batas."""
    key = _key(scope, ident, client_ip(request))
    sejak = datetime.now(timezone.utc) - timedelta(minutes=JENDELA_MENIT)
    gagal = await db.login_attempts.count_documents({"key": key, "at": {"$gte": sejak}})
    if gagal >= MAX_GAGAL:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Terlalu banyak percobaan gagal. Coba lagi dalam {KUNCI_MENIT} menit."
            ),
            headers={"Retry-After": str(KUNCI_MENIT * 60)},
        )


async def catat_gagal(scope: str, ident: str, request: Request) -> None:
    """Catat satu percobaan gagal."""
    await db.login_attempts.insert_one({
        "key": _key(scope, ident, client_ip(request)),
        "at": datetime.now(timezone.utc),
    })


async def bersihkan(scope: str, ident: str, request: Request) -> None:
    """Hapus catatan kegagalan setelah berhasil."""
    await db.login_attempts.delete_many({"key": _key(scope, ident, client_ip(request))})
