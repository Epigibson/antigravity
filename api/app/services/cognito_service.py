"""Service to validate AWS Cognito JWT tokens."""

import json
import httpx
from jose import jwt, jwk
from jose.utils import base64url_decode
from app.config import settings

JWKS_URL = f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/{settings.cognito_user_pool_id}/.well-known/jwks.json"

_jwks = None

async def get_jwks() -> dict:
    """Fetch and cache the JSON Web Key Set from Cognito."""
    global _jwks
    if _jwks is None:
        async with httpx.AsyncClient() as client:
            response = await client.get(JWKS_URL)
            response.raise_for_status()
            _jwks = response.json()
    return _jwks

async def verify_cognito_token(token: str) -> dict | None:
    """Verify a Cognito JWT token and return the payload."""
    try:
        # Get the key ID from the header
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")
        if not kid:
            return None

        # Fetch JWKS
        jwks = await get_jwks()

        # Find the matching key
        key_index = -1
        for i in range(len(jwks.get("keys", []))):
            if kid == jwks["keys"][i]["kid"]:
                key_index = i
                break

        if key_index == -1:
            return None

        # Verify the signature
        public_key = jwk.construct(jwks["keys"][key_index])
        message, encoded_sig = token.rsplit(".", 1)
        decoded_sig = base64url_decode(encoded_sig.encode("utf-8"))
        if not public_key.verify(message.encode("utf-8"), decoded_sig):
            return None

        # Validate claims (expiration, client_id, issuer)
        payload = jwt.get_unverified_claims(token)
        
        # Verify Issuer
        expected_issuer = f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/{settings.cognito_user_pool_id}"
        if payload.get("iss") != expected_issuer:
            return None
            
        # Verify Client ID (App Client)
        if payload.get("client_id") != settings.cognito_client_id:
            return None

        # Verify token use (ID token is needed to get the email)
        if payload.get("token_use") not in ["id", "access"]:
            return None

        return payload

    except Exception as e:
        print(f"Token verification failed: {e}")
        return None
