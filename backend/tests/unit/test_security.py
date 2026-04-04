"""Unit tests for app.core.security — password hashing and JWT tokens."""

from datetime import timedelta

import pytest

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

class TestPasswordHashing:
    """Tests for hash_password and verify_password."""

    def test_hash_password_produces_bcrypt_hash(self):
        """hash_password should return a string that looks like a bcrypt hash."""
        hashed = hash_password("mypassword")
        assert isinstance(hashed, str)
        # bcrypt hashes start with $2b$ (or $2a$/$2y$)
        assert hashed.startswith("$2")
        # bcrypt hash length is 60 characters
        assert len(hashed) == 60

    def test_hash_password_different_salts(self):
        """Two calls with the same password should produce different hashes."""
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2

    def test_verify_password_correct(self):
        """verify_password returns True when plain matches the hash."""
        plain = "CorrectHorse42!"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_password_wrong(self):
        """verify_password returns False when plain does not match."""
        hashed = hash_password("real_password")
        assert verify_password("wrong_password", hashed) is False

    def test_verify_password_empty_string(self):
        """verify_password handles empty vs non-empty correctly."""
        hashed = hash_password("notempty")
        assert verify_password("", hashed) is False


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

class TestJWT:
    """Tests for create_access_token and decode_access_token."""

    def test_create_access_token_returns_string(self):
        """create_access_token should return a non-empty JWT string."""
        token = create_access_token({"sub": "admin", "rol": "admin"})
        assert isinstance(token, str)
        assert len(token) > 0
        # JWT has 3 dot-separated parts
        assert token.count(".") == 2

    def test_decode_access_token_valid(self):
        """decode_access_token should return the original payload for a valid token."""
        data = {"sub": "testuser", "rol": "agronomo"}
        token = create_access_token(data)
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "testuser"
        assert payload["rol"] == "agronomo"
        assert "exp" in payload

    def test_decode_access_token_invalid_token(self):
        """decode_access_token should return None for a garbage token."""
        result = decode_access_token("not.a.valid.jwt.token")
        assert result is None

    def test_decode_access_token_tampered(self):
        """decode_access_token should return None if the token signature is wrong."""
        token = create_access_token({"sub": "user"})
        # Flip last character to break the signature
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        result = decode_access_token(tampered)
        assert result is None

    def test_decode_access_token_expired(self):
        """decode_access_token should return None for an expired token."""
        token = create_access_token(
            {"sub": "user"},
            expires_delta=timedelta(seconds=-1),
        )
        result = decode_access_token(token)
        assert result is None

    def test_create_access_token_custom_expiry(self):
        """create_access_token should respect a custom expires_delta."""
        token = create_access_token(
            {"sub": "user"},
            expires_delta=timedelta(hours=1),
        )
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user"
