"""Model penagih (juru pungut) — daftar nama yang bisa dipilih saat scan QR."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


def aware_utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Penagih(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nama: str
    created_at: datetime = Field(default_factory=aware_utcnow)


class PenagihCreate(BaseModel):
    nama: str = Field(min_length=1, max_length=120)
