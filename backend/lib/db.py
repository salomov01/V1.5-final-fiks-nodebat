"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "tenants": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("nomor_id", ASCENDING)], name="nomor_id", unique=True),
        IndexModel([("kategori", ASCENDING), ("status", ASCENDING)], name="kategori_status"),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "payments": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tenant_id", ASCENDING), ("created_at", DESCENDING)], name="tenant_created"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
    ],
    "counters": [IndexModel([("_id", ASCENDING)], name="_id")],
    "penagih": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("nama", ASCENDING)], name="nama", unique=True),
    ],
    "lapak_units": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("blok", ASCENDING)], name="blok", unique=True),
    ],
    "pendaftaran": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("ip", ASCENDING), ("created_at", DESCENDING)], name="ip_created"),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("created_at", ASCENDING)], name="created_ttl", expireAfterSeconds=604800),
    ],
    "activities": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
        IndexModel([("entity", ASCENDING), ("created_at", DESCENDING)], name="entity_created"),
    ],
    "login_attempts": [
        IndexModel([("key", ASCENDING), ("at", DESCENDING)], name="key_at"),
        # Catatan kegagalan hapus sendiri setelah 1 jam.
        IndexModel([("at", ASCENDING)], name="at_ttl", expireAfterSeconds=3600),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
