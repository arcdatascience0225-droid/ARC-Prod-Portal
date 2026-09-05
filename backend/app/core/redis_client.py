"""Redis is used only for the JWT access-token blacklist on logout. If no
Redis server is reachable (e.g. running without Docker and without a local
Redis install), this module fails soft: logout won't immediately revoke a
token before it naturally expires, but the app keeps working normally
instead of crashing every request that touches auth."""
import logging

import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    redis_client.ping()
    REDIS_AVAILABLE = True
except Exception as e:  # noqa: BLE001
    logger.warning("Redis unavailable (%s) - token blacklist disabled, app will still run.", e)
    redis_client = None
    REDIS_AVAILABLE = False


def blacklist_token(jti: str, expire_seconds: int):
    if not REDIS_AVAILABLE or expire_seconds <= 0:
        return
    try:
        redis_client.setex(f"blacklist:{jti}", expire_seconds, "1")
    except Exception:  # noqa: BLE001
        pass


def is_token_blacklisted(jti: str) -> bool:
    if not REDIS_AVAILABLE:
        return False
    try:
        return redis_client.exists(f"blacklist:{jti}") == 1
    except Exception:  # noqa: BLE001
        return False
