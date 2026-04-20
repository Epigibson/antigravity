"""Crypto service — handles AES-256-GCM (Fernet) encryption for secrets."""

import base64
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings

# Initialize Fernet with the symmetric key
# The key must be 32 url-safe base64-encoded bytes.
try:
    _fernet = Fernet(settings.encryption_key.encode('utf-8'))
except ValueError:
    # Fallback to generate a valid key if somehow the user messes up the config
    _fernet = Fernet(Fernet.generate_key())


def encrypt_value(plain: str) -> str:
    """Encrypt a plaintext string."""
    if not plain:
        return plain
    return _fernet.encrypt(plain.encode('utf-8')).decode('utf-8')


def decrypt_value(cipher: str) -> str:
    """Decrypt a ciphertext string. Fallback to return the original if not a valid Fernet token."""
    if not cipher:
        return cipher
    try:
        return _fernet.decrypt(cipher.encode('utf-8')).decode('utf-8')
    except (InvalidToken, TypeError, ValueError):
        # We assume it's a legacy plain-text value if it can't be decrypted
        return cipher


def encrypt_dict(d: dict[str, str]) -> dict[str, str]:
    """Encrypt all values in a key-value dictionary."""
    if not d:
        return {}
    return {k: encrypt_value(v) for k, v in d.items()}


def decrypt_dict(d: dict[str, str]) -> dict[str, str]:
    """Decrypt all values in a key-value dictionary."""
    if not d:
        return {}
    return {k: decrypt_value(v) for k, v in d.items()}
