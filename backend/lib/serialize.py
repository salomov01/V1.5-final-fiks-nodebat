"""Normalisasi dokumen Mongo sebelum masuk model Pydantic."""

from datetime import datetime, timezone


def aware_utcnow() -> datetime:
    """Waktu sekarang, aware UTC (BSON menyimpan UTC)."""
    return datetime.now(timezone.utc)


def to_aware(doc: dict, *fields: str) -> dict:
    """Motor mengembalikan datetime naive — jadikan aware UTC agar serialisasi
    Pydantic membawa offset (dan `new Date(...)` di JS mem-parse dengan benar)."""
    for field in fields:
        value = doc.get(field)
        if isinstance(value, datetime) and value.tzinfo is None:
            doc[field] = value.replace(tzinfo=timezone.utc)
    return doc
