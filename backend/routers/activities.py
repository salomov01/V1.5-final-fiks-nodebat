"""Riwayat aktivitas pengelola."""

from typing import Any, List

from fastapi import APIRouter, Depends, Query

from lib.db import db
from lib.serialize import to_aware
from models.activity import Activity
from routers.auth import require_session

router = APIRouter(prefix="/activities", tags=["activities"], dependencies=[Depends(require_session)])


@router.get("", response_model=List[Activity])
async def list_activities(
    entity: str | None = Query(None, description="penyewa | pembayaran | akun"),
    limit: int = Query(100, ge=1, le=500),
):
    query: dict[str, Any] = {}
    if entity:
        query["entity"] = entity
    docs = await db.activities.find(query).sort("created_at", -1).to_list(limit)
    return [Activity(**to_aware(d, "created_at")) for d in docs]
