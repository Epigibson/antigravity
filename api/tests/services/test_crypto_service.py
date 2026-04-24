import pytest
from app.services.crypto_service import encrypt_value, decrypt_value, encrypt_dict, decrypt_dict

def test_encrypt_decrypt_value():
    original = "my-secret-value-123"
    encrypted = encrypt_value(original)
    assert encrypted != original
    assert type(encrypted) == str

    decrypted = decrypt_value(encrypted)
    assert decrypted == original

def test_encrypt_decrypt_empty():
    assert encrypt_value("") == ""
    assert decrypt_value("") == ""
    assert encrypt_value(None) is None
    assert decrypt_value(None) is None

def test_decrypt_invalid_cipher():
    original = "not-a-valid-fernet-token"
    assert decrypt_value(original) == original

def test_encrypt_decrypt_dict():
    original = {
        "key1": "val1",
        "key2": "val2",
        "empty": ""
    }

    encrypted = encrypt_dict(original)
    assert encrypted != original
    assert "key1" in encrypted
    assert encrypted["key1"] != "val1"
    assert encrypted["key2"] != "val2"
    assert encrypted["empty"] == ""

    decrypted = decrypt_dict(encrypted)
    assert decrypted == original

def test_encrypt_decrypt_dict_empty():
    assert encrypt_dict({}) == {}
    assert decrypt_dict({}) == {}
    assert encrypt_dict(None) == {}
    assert decrypt_dict(None) == {}
