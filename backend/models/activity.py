"""Model jejak aktivitas pengelola."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actor: str
    action: str   # buat | ubah | hapus | konfirmasi | tolak
    entity: str   # penyewa | pembayaran | akun
    entity_id: str
    label: str
    detail: str = ""
    created_at: datetime
