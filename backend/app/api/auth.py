import uuid
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session
import secrets

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_jwt_token,
    decode_jwt_token,
)
from app.database.session import get_db
from app.models.user import User
from app.models.token import RefreshToken
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    TokenRefreshRequest,
    OTPRequest,
    OTPLoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    EmailVerificationRequest,
    ResendVerificationRequest,
)
from app.schemas.user import UserCreate, UserResponse
from app.services.email_service import email_service
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

def set_refresh_cookie(response: Response, refresh_token: str):
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=True,
        path="/",
    )

def clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key="refresh_token",
        samesite="strict",
        secure=True,
        path="/",
    )

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )
        
    # Hash password using Argon2
    hashed_pwd = hash_password(user_in.password)
    
    # Create new user
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        is_verified=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate 6-digit email verification code
    verification_code = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    # Save code to Redis with 15 minutes TTL
    redis_service.set(f"verify_email:{new_user.email}", verification_code, expire_seconds=900)
    
    # Send verification email
    await email_service.send_verification_email(new_user.email, verification_code)
    
    return new_user

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    # Rate Limiting: 5 attempts per minute
    rate_limit_key = f"login_attempts:{login_data.email}"
    if not redis_service.check_rate_limit(rate_limit_key, limit=settings.RATE_LIMIT_LIMIT, period=settings.RATE_LIMIT_PERIOD):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in 1 minute."
        )

    # Fetch user
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
        
    # Verify password
    if not verify_password(user.hashed_password, login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated."
        )
        
    # Generate JWT Tokens
    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    
    access_token = create_jwt_token(
        data={"sub": str(user.id), "jti": access_jti},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_jwt_token(
        data={"sub": str(user.id), "jti": refresh_jti},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_refresh=True
    )
    
    user_agent = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None

    # Save Refresh Token in DB
    db_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Set Refresh Token in HttpOnly cookie
    set_refresh_cookie(response, refresh_token)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    # Extract access token from headers to blacklist it
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        access_token = auth_header.split(" ")[1]
        payload = decode_jwt_token(access_token, is_refresh=False)
        if payload:
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                # Blacklist in Redis until it expires
                now = datetime.utcnow().timestamp()
                ttl = int(exp - now)
                if ttl > 0:
                    redis_service.blacklist_token(jti, ttl)
                    
    # Revoke Refresh Token from DB
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
        if db_token:
            db.delete(db_token)
            db.commit()
            
    # Clear cookie
    clear_refresh_cookie(response)
    
    return {"detail": "Successfully logged out."}

@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    body: TokenRefreshRequest | None = None
):
    # Extract refresh token from cookie or body
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token and body:
        refresh_token = body.refresh_token
        
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing."
        )
        
    # Decode and validate signature
    payload = decode_jwt_token(refresh_token, is_refresh=True)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token."
        )
        
    user_id = payload.get("sub")
    
    # Query database for the refresh token
    db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
    if not db_token or db_token.is_revoked or db_token.expires_at < datetime.utcnow():
        # Security measure: If token is valid but not in DB (or revoked), user might have had their token stolen.
        # Revoke all active refresh tokens for this user!
        if user_id:
            try:
                uuid_user_id = uuid.UUID(user_id)
                db.query(RefreshToken).filter(RefreshToken.user_id == uuid_user_id).delete()
                db.commit()
            except ValueError:
                pass
        clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please sign in again."
        )
        
    # Rotate Refresh Token: delete the old one, issue new ones
    db.delete(db_token)
    db.commit()
    
    # Generate new tokens
    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    
    new_access_token = create_jwt_token(
        data={"sub": user_id, "jti": access_jti},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    new_refresh_token = create_jwt_token(
        data={"sub": user_id, "jti": refresh_jti},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_refresh=True
    )
    
    user_agent = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None

    # Save new refresh token in DB
    new_db_token = RefreshToken(
        token=new_refresh_token,
        user_id=db_token.user_id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address
    )
    db.add(new_db_token)
    db.commit()
    
    # Set Refresh Token in HttpOnly cookie
    set_refresh_cookie(response, new_refresh_token)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.post("/verify-email")
def verify_email(data: EmailVerificationRequest, db: Session = Depends(get_db)):
    # Verify the code from Redis
    saved_code = redis_service.get(f"verify_email:{data.email}")
    if not saved_code or saved_code != data.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired email verification code."
        )
        
    # Mark user as verified
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    user.is_verified = True
    db.commit()
    
    # Delete the verification code from Redis
    redis_service.delete(f"verify_email:{data.email}")
    
    return {"detail": "Email address successfully verified."}

@router.post("/resend-verification")
async def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    if user.is_verified:
        return {"detail": "Email is already verified."}
        
    # Cooldown check: prevent sending more than once per minute
    cooldown_key = f"resend_cooldown:{data.email}"
    if redis_service.get(cooldown_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait 1 minute before requesting another code."
        )
        
    # Generate new verification code
    verification_code = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    redis_service.set(f"verify_email:{data.email}", verification_code, expire_seconds=900)
    # Set 60 seconds cooldown
    redis_service.set(cooldown_key, "true", expire_seconds=60)
    
    # Send verification email
    await email_service.send_verification_email(data.email, verification_code)
    
    return {"detail": "Verification code resent."}

@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    # Security: If user is not found, return success response to prevent email enumeration attacks
    if not user:
        return {"detail": "If the email is registered, a password reset link has been sent."}
        
    # Generate unique reset token
    reset_token = str(uuid.uuid4())
    user.reset_token = reset_token
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db.commit()
    
    # Send password reset email
    await email_service.send_password_reset_email(user.email, reset_token)
    
    return {"detail": "If the email is registered, a password reset link has been sent."}

@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.reset_token == data.token,
        User.reset_token_expires_at > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )
        
    # Hash and save new password
    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    
    return {"detail": "Password has been reset successfully."}

@router.post("/send-otp")
async def send_otp(data: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account associated with this email address."
        )
        
    # Cooldown check
    cooldown_key = f"otp_cooldown:{data.email}"
    if redis_service.get(cooldown_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait 1 minute before requesting another OTP."
        )
        
    # Generate 6-digit OTP code
    otp_code = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    redis_service.set(f"otp:{data.email}", otp_code, expire_seconds=300) # 5 mins TTL
    redis_service.set(cooldown_key, "true", expire_seconds=60) # 1 min cooldown
    
    # Send OTP email
    await email_service.send_otp_email(data.email, otp_code)
    
    return {"detail": "OTP sent successfully."}

@router.post("/login-otp", response_model=TokenResponse)
def login_otp(data: OTPLoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    # Verify OTP
    saved_otp = redis_service.get(f"otp:{data.email}")
    if not saved_otp or saved_otp != data.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code."
        )
        
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated."
        )
        
    # If OTP login is used, automatically mark user as verified
    if not user.is_verified:
        user.is_verified = True
        db.commit()
        
    # Generate JWT Tokens
    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    
    access_token = create_jwt_token(
        data={"sub": str(user.id), "jti": access_jti},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_jwt_token(
        data={"sub": str(user.id), "jti": refresh_jti},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_refresh=True
    )
    
    user_agent = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None

    # Save Refresh Token in DB
    db_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Set Refresh Token in HttpOnly cookie
    set_refresh_cookie(response, refresh_token)
    
    # Delete OTP from Redis
    redis_service.delete(f"otp:{data.email}")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
