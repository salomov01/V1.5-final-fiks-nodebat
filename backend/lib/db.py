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
    "pedagang": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("nik", ASCENDING)], name="nik", unique=True),
    ],
    "lapak": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("nama", ASCENDING)], name="nama", unique=True),
    ],
    "sewa": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("lapak_id", ASCENDING), ("status", ASCENDING)], name="lapak_status"),
        IndexModel([("pedagang_id", ASCENDING), ("status", ASCENDING)], name="pedagang_status"),
        IndexModel([("ip", ASCENDING), ("created_at", DESCENDING)], name="ip_created"),
    ],
    "payments": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tanggal", DESCENDING), ("jenis", ASCENDING)], name="tanggal_jenis"),
        IndexModel([("sewa_id", ASCENDING), ("jenis", ASCENDING)], name="sewa_jenis"),
    ],
    "counters": [IndexModel([("_id", ASCENDING)], name="_id")],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("username", ASCENDING)], name="username", unique=True),
    ],
    "berita": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "pengeluaran": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tanggal", DESCENDING), ("kategori", ASCENDING)], name="tanggal_kategori"),
        IndexModel([("pemungut_id", ASCENDING), ("periode_gaji", ASCENDING)], name="gaji_unik", unique=True,
                   partialFilterExpression={"kategori": "gaji"}),
    ],
    "harga_barang": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "pegawai": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
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
