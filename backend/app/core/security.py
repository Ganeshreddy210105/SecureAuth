from datetime import datetime, timedelta
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.core.config import settings

ph = PasswordHasher()

def hash_password(password: str) -> str:
    """Hash a password using Argon2."""
    return ph.hash(password)

def verify_password(hashed_password: str, password: str) -> bool:
    """Verify a password against an Argon2 hash."""
    try:
        return ph.verify(hashed_password, password)
    except VerifyMismatchError:
        return False

def create_jwt_token(data: dict, expires_delta: timedelta, is_refresh: bool = False) -> str:
    """Create a signed JWT token (access or refresh)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({
        "exp": expire,
        "type": "refresh" if is_refresh else "access"
    })
    secret = settings.JWT_REFRESH_SECRET_KEY if is_refresh else settings.JWT_SECRET_KEY
    encoded_jwt = jwt.encode(to_encode, secret, algorithm="HS256")
    return encoded_jwt

def decode_jwt_token(token: str, is_refresh: bool = False) -> dict | None:
    """Decode and validate a JWT token."""
    secret = settings.JWT_REFRESH_SECRET_KEY if is_refresh else settings.JWT_SECRET_KEY
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        # Verify the type
        expected_type = "refresh" if is_refresh else "access"
        if payload.get("type") != expected_type:
            return None
        return payload
    except jwt.PyJWTError:
        return None
