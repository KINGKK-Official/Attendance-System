"""
Task 6 — Biometric data encryption.

Encrypts face-embedding vectors at rest using Fernet (AES-128-CBC + HMAC).
The key is supplied via the BIOMETRIC_ENCRYPTION_KEY environment variable
(a 32-byte url-safe base64 Fernet key).

Generate a key once with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

If the key is missing the module degrades gracefully: it logs a warning and
encrypt/decrypt become identity-ish no-ops returning raw bytes, so the rest of
the system keeps running in a dev/demo environment. Production deployments MUST
set the key.
"""
from __future__ import annotations

import os
import json
import numpy as np

try:
    from cryptography.fernet import Fernet
    _CRYPTO_AVAILABLE = True
except Exception:  # pragma: no cover - cryptography not installed
    Fernet = None
    _CRYPTO_AVAILABLE = False

_KEY = os.environ.get("BIOMETRIC_ENCRYPTION_KEY")
_fernet = None

if _CRYPTO_AVAILABLE and _KEY:
    try:
        _fernet = Fernet(_KEY.encode() if isinstance(_KEY, str) else _KEY)
    except Exception as exc:  # invalid key format
        print(f"crypto_service WARNING: invalid BIOMETRIC_ENCRYPTION_KEY ({exc}). Encryption disabled.")
        _fernet = None
elif not _KEY:
    print("crypto_service WARNING: BIOMETRIC_ENCRYPTION_KEY not set. Embeddings will be stored unencrypted (dev mode).")


def is_enabled() -> bool:
    return _fernet is not None


def encrypt_embedding(vec) -> bytes:
    """Encrypt a 1-D float embedding into Fernet ciphertext bytes."""
    arr = np.asarray(vec, dtype=np.float32)
    raw = arr.tobytes()
    if _fernet is None:
        # Dev fallback: store an unencrypted, self-describing blob.
        return b"PLAIN:" + raw
    return _fernet.encrypt(raw)


def decrypt_embedding(blob: bytes) -> np.ndarray:
    """Decrypt Fernet ciphertext back into a float32 numpy array."""
    if blob is None:
        return None
    if isinstance(blob, str):
        blob = blob.encode()
    if blob.startswith(b"PLAIN:"):
        return np.frombuffer(blob[len(b"PLAIN:"):], dtype=np.float32)
    if _fernet is None:
        raise RuntimeError(
            "Encrypted embedding found but BIOMETRIC_ENCRYPTION_KEY is not configured."
        )
    return np.frombuffer(_fernet.decrypt(blob), dtype=np.float32)


def embedding_to_list(blob_or_json):
    """
    Convenience: return a python list embedding from either an encrypted blob
    (bytes/LargeBinary) or the legacy plaintext JSON/text column. Returns None
    if nothing usable is present.
    """
    if blob_or_json is None:
        return None
    # Encrypted bytes path
    if isinstance(blob_or_json, (bytes, bytearray, memoryview)):
        try:
            return decrypt_embedding(bytes(blob_or_json)).tolist()
        except Exception:
            return None
    # Legacy text/JSON path
    if isinstance(blob_or_json, str):
        try:
            val = json.loads(blob_or_json)
            if isinstance(val, str):
                val = json.loads(val)
            if isinstance(val, list):
                return val
        except Exception:
            return None
    if isinstance(blob_or_json, list):
        return blob_or_json
    return None


# ─── IT-Manager upgrade: camera credential (string) encryption ───────────────
_DEV_PREFIX = "dev$"


def encrypt_secret(plaintext: str) -> str:
    if plaintext is None:
        return None
    if not _fernet:
        return _DEV_PREFIX + plaintext
    return _fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    if token is None:
        return None
    if token.startswith(_DEV_PREFIX):
        return token[len(_DEV_PREFIX):]
    if not _fernet:
        return token
    try:
        return _fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except Exception:
        return None
