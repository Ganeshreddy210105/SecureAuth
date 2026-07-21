import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_jwt_token
from app.database.session import get_db
from app.models.user import User
from app.models.token import RefreshToken
from app.auth.oauth import oauth_service

router = APIRouter(prefix="/auth", tags=["OAuth2"])

def get_backend_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto", "http")
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}"
    return str(request.base_url).rstrip("/")

def get_frontend_url() -> str:
    frontend_url = "http://localhost:3000"
    if settings.BACKEND_CORS_ORIGINS:
        frontend_url = settings.BACKEND_CORS_ORIGINS[0]
    return frontend_url.rstrip("/")

@router.get("/google/login")
def google_login(request: Request):
    base_url = get_backend_base_url(request)
    redirect_uri = f"{base_url}/api/v1/auth/google/callback"
    
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET or settings.GOOGLE_CLIENT_ID == "mock_google_client_id":
        return RedirectResponse(f"{redirect_uri}?code=mock_code&state=mock_state")
        
    state = str(uuid.uuid4())
    auth_url = oauth_service.get_google_auth_url(redirect_uri=redirect_uri, state=state)
    return RedirectResponse(auth_url)

@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is missing.")
        
    base_url = get_backend_base_url(request)
    redirect_uri = f"{base_url}/api/v1/auth/google/callback"
    
    try:
        user_info = await oauth_service.get_google_user_info(code=code, redirect_uri=redirect_uri)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    email = user_info.get("email")
    oauth_id = user_info.get("id")
    full_name = user_info.get("name")
    avatar_url = user_info.get("picture")
    
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.oauth_provider = "google"
        user.oauth_id = oauth_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        if full_name and not user.full_name:
            user.full_name = full_name
        user.is_verified = True
    else:
        user = User(
            email=email,
            full_name=full_name,
            avatar_url=avatar_url,
            is_verified=True,
            oauth_provider="google",
            oauth_id=oauth_id,
        )
        db.add(user)
    
    db.commit()
    db.refresh(user)
    
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
    
    db_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address
    )
    db.add(db_refresh_token)
    db.commit()
    
    frontend_url = get_frontend_url()
    redirect_url = f"{frontend_url}/auth/callback?access_token={access_token}"
    
    response = RedirectResponse(url=redirect_url)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=True,
        path="/",
    )
    return response

@router.get("/github/login")
def github_login(request: Request):
    base_url = get_backend_base_url(request)
    redirect_uri = f"{base_url}/api/v1/auth/github/callback"
    
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET or settings.GITHUB_CLIENT_ID == "mock_github_client_id":
        return RedirectResponse(f"{redirect_uri}?code=mock_code&state=mock_state")
        
    state = str(uuid.uuid4())
    auth_url = oauth_service.get_github_auth_url(redirect_uri=redirect_uri, state=state)
    return RedirectResponse(auth_url)

@router.get("/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is missing.")
        
    base_url = get_backend_base_url(request)
    redirect_uri = f"{base_url}/api/v1/auth/github/callback"
    
    try:
        user_info = await oauth_service.get_github_user_info(code=code, redirect_uri=redirect_uri)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    email = user_info.get("email")
    oauth_id = user_info.get("id")
    full_name = user_info.get("name")
    avatar_url = user_info.get("picture")
    
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.oauth_provider = "github"
        user.oauth_id = oauth_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        if full_name and not user.full_name:
            user.full_name = full_name
        user.is_verified = True
    else:
        user = User(
            email=email,
            full_name=full_name,
            avatar_url=avatar_url,
            is_verified=True,
            oauth_provider="github",
            oauth_id=oauth_id,
        )
        db.add(user)
        
    db.commit()
    db.refresh(user)
    
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
    
    db_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address
    )
    db.add(db_refresh_token)
    db.commit()
    
    frontend_url = get_frontend_url()
    redirect_url = f"{frontend_url}/auth/callback?access_token={access_token}"
    
    response = RedirectResponse(url=redirect_url)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=True,
        path="/",
    )
    return response
