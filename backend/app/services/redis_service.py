import logging
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.client = None
        # Try to connect to Redis
        try:
            self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            self.client.ping()
            logger.info("Successfully connected to Redis.")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Falling back to in-memory storage.")
            self.client = None
            self._in_memory_db = {}
            self._in_memory_expiry = {}

    def _clean_expired(self):
        if self.client:
            return
        import time
        now = time.time()
        expired_keys = [k for k, exp in self._in_memory_expiry.items() if exp < now]
        for k in expired_keys:
            self._in_memory_db.pop(k, None)
            self._in_memory_expiry.pop(k, None)

    def set(self, key: str, value: str, expire_seconds: int = 300) -> bool:
        if self.client:
            try:
                return bool(self.client.setex(key, expire_seconds, value))
            except Exception as e:
                logger.error(f"Redis set error: {e}")
        
        # In-memory fallback
        import time
        self._clean_expired()
        self._in_memory_db[key] = value
        self._in_memory_expiry[key] = time.time() + expire_seconds
        return True

    def get(self, key: str) -> str | None:
        if self.client:
            try:
                return self.client.get(key)
            except Exception as e:
                logger.error(f"Redis get error: {e}")
        
        # In-memory fallback
        import time
        self._clean_expired()
        if key in self._in_memory_db:
            if self._in_memory_expiry.get(key, 0) > time.time():
                return self._in_memory_db[key]
            else:
                self._in_memory_db.pop(key, None)
                self._in_memory_expiry.pop(key, None)
        return None

    def delete(self, key: str) -> bool:
        if self.client:
            try:
                return bool(self.client.delete(key))
            except Exception as e:
                logger.error(f"Redis delete error: {e}")
        
        # In-memory fallback
        self._in_memory_db.pop(key, None)
        self._in_memory_expiry.pop(key, None)
        return True

    def is_blacklisted(self, jti: str) -> bool:
        key = f"blacklist:{jti}"
        return self.get(key) is not None

    def blacklist_token(self, jti: str, expire_seconds: int) -> bool:
        key = f"blacklist:{jti}"
        return self.set(key, "true", expire_seconds)

    def check_rate_limit(self, key: str, limit: int, period: int) -> bool:
        """
        Check if the key has exceeded rate limits.
        Returns True if allowed, False if rate limited.
        """
        redis_key = f"rate_limit:{key}"
        if self.client:
            try:
                pipe = self.client.pipeline()
                pipe.incr(redis_key)
                pipe.expire(redis_key, period)
                res = pipe.execute()
                current_count = res[0]
                return current_count <= limit
            except Exception as e:
                logger.error(f"Redis rate limiting error: {e}")
                # Fallback to allow on error so we don't break login in case Redis breaks
                return True
        
        # In-memory fallback
        import time
        self._clean_expired()
        now = time.time()
        history_key = f"rl_history:{key}"
        
        if history_key not in self._in_memory_db:
            self._in_memory_db[history_key] = []
            
        history = self._in_memory_db[history_key]
        # Filter timestamps within the period
        history = [t for t in history if now - t < period]
        
        if len(history) >= limit:
            self._in_memory_db[history_key] = history
            return False
            
        history.append(now)
        self._in_memory_db[history_key] = history
        # Set expiry for this key
        self._in_memory_expiry[history_key] = now + period
        return True

# Singleton instance
redis_service = RedisService()
