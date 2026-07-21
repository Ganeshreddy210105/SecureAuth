import uuid
from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt

from app.core.config import settings
from app.core.security import decode_jwt_token
from app.database.session import get_db
from app.models.user import User
from app.services.redis_service import redis_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    # Check if access token is blacklisted in Redis
    # We can use the token itself (or its signature) to blacklist
    # Let's extract the token's payload to see if it's expired or blacklisted
    payload = decode_jwt_token(token, is_refresh=False)
    if not payload:
        raise credentials_exception
        
    jti = payload.get("jti")
    if jti and redis_service.is_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been blacklisted or is invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception
        
    try:
        uuid_user_id = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == uuid_user_id).first()
    if not user:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive"
        )
        
    return user

def get_current_verified_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified"
        )
    return current_user
