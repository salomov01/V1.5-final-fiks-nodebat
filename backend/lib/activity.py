"""Catat jejak aktivitas pengelola — siapa mengubah/mengonfirmasi apa, kapan."""

import uuid

from lib.db import db
from lib.serialize import aware_utcnow


async def log_activity(
    actor: str,
    action: str,
    entity: str,
    entity_id: str,
    label: str,
    detail: str = "",
) -> None:
    """Best-effort: kegagalan pencatatan tidak boleh menggagalkan aksi utama."""
    try:
        await db.activities.insert_one({
            "id": str(uuid.uuid4()),
            "actor": actor,
            "action": action,       # buat | ubah | hapus | konfirmasi | tolak
            "entity": entity,       # penyewa | pembayaran | akun
            "entity_id": entity_id,
            "label": label,         # teks siap tampil, mis. "I Wayan Sudira (LPK-JMB-001)"
            "detail": detail,
            "created_at": aware_utcnow(),
        })
    except Exception:  # noqa: BLE001 — log aktivitas bersifat sekunder
        pass
