"""Hash password pengelola — pbkdf2_hmac stdlib (tanpa dependensi tambahan)."""

import hashlib
import secrets

ITERATIONS = 200_000


def hash_password(password: str) -> tuple[str, str]:
    """-> (salt_hex, hash_hex)"""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return secrets.compare_digest(digest.hex(), hash_hex)
