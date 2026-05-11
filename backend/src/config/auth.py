"""
API Key authentication for Paycrest Intelligence API.
Protects all /api/* endpoints except /health and /docs.
"""

from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from ..config.settings import settings

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(API_KEY_HEADER)) -> str:
    """
    Validates the X-API-Key header against configured keys.
    Returns the key if valid, raises 401 if not.
    """
    if not settings.api_keys:
        # No keys configured — open access (development mode)
        return "dev"

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Include X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if api_key not in settings.api_keys_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key.",
        )

    return api_key
