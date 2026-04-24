"""Tests for the crypto service."""

import pytest
from app.services.crypto_service import encrypt_dict, decrypt_dict, encrypt_value, decrypt_value


def test_encrypt_dict_edge_cases():
    """Test encrypt_dict with None and empty dict."""
    assert encrypt_dict(None) == {}
    assert encrypt_dict({}) == {}


def test_decrypt_dict_edge_cases():
    """Test decrypt_dict with None and empty dict."""
    assert decrypt_dict(None) == {}
    assert decrypt_dict({}) == {}


def test_encrypt_decrypt_dict_standard():
    """Test encrypting and decrypting a standard dictionary."""
    original_dict = {"key1": "value1", "key2": "value2"}

    # Encrypt
    encrypted_dict = encrypt_dict(original_dict)
    assert encrypted_dict != original_dict
    assert "key1" in encrypted_dict
    assert "key2" in encrypted_dict
    assert encrypted_dict["key1"] != "value1"
    assert encrypted_dict["key2"] != "value2"

    # Decrypt
    decrypted_dict = decrypt_dict(encrypted_dict)
    assert decrypted_dict == original_dict


def test_encrypt_decrypt_value_standard():
    """Test encrypting and decrypting a single value."""
    original_value = "my_secret_string"

    # Encrypt
    encrypted_value = encrypt_value(original_value)
    assert encrypted_value != original_value
    assert isinstance(encrypted_value, str)

    # Decrypt
    decrypted_value = decrypt_value(encrypted_value)
    assert decrypted_value == original_value


def test_encrypt_value_edge_cases():
    """Test encrypt_value with empty strings."""
    assert encrypt_value("") == ""
    assert encrypt_value(None) is None


def test_decrypt_value_edge_cases():
    """Test decrypt_value with empty strings and invalid tokens."""
    assert decrypt_value("") == ""
    assert decrypt_value(None) is None
    # Invalid token fallback should return original string
    assert decrypt_value("invalid_token") == "invalid_token"
