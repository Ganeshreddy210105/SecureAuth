import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status, UploadFile, File
import os
import shutil
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.security import hash_password, verify_password
from app.database.session import get_db
from app.models.user import User
from app.models.token import RefreshToken
from app.schemas.user import UserResponse, UserUpdate, PasswordChange
from app.api.deps import get_current_user
from app.services.email_service import email_service
from app.services.redis_service import redis_service
import secrets

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If updating full name
    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name
        
    # If updating avatar URL
    if profile_data.avatar_url is not None:
        current_user.avatar_url = profile_data.avatar_url

    # If updating phone number
    if profile_data.phone_number is not None:
        current_user.phone_number = profile_data.phone_number

    # If updating city/place
    if profile_data.city is not None:
        current_user.city = profile_data.city
        
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    os.makedirs("static/avatars", exist_ok=True)
    
    ext = os.path.splitext(file.filename)[1]
    if ext.lower() not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: PNG, JPG, JPEG, WEBP."
        )
        
    file_path = f"static/avatars/{current_user.id}{ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Dynamically resolve host for production deployment
    relative_url = f"/static/avatars/{current_user.id}{ext}"
    base_url = str(request.base_url).rstrip("/")
    backend_url = f"{base_url}{relative_url}"
    current_user.avatar_url = backend_url
    
    db.commit()
    db.refresh(current_user)
    
    return {"avatar_url": backend_url}

@router.put("/change-password")
def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Accounts registered via Social Login cannot change their password this way."
        )
        
    if not verify_password(current_user.hashed_password, data.old_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password."
        )
        
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"detail": "Password changed successfully."}

@router.get("/sessions")
def get_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_refresh_token = request.cookies.get("refresh_token")
    sessions = db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).all()
    
    result = []
    for s in sessions:
        result.append({
            "id": str(s.id),
            "user_agent": s.user_agent or "Unknown",
            "ip_address": s.ip_address or "Unknown",
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "is_current": s.token == current_refresh_token
        })
    # Sort sessions so current is first
    result.sort(key=lambda x: not x["is_current"])
    return result

@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        uuid_sess_id = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format.")
        
    session = db.query(RefreshToken).filter(
        RefreshToken.id == uuid_sess_id,
        RefreshToken.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
        
    db.delete(session)
    db.commit()
    return {"detail": "Session successfully revoked."}

@router.delete("/sessions")
def revoke_all_sessions(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Revoke all sessions for user
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).delete()
    db.commit()
    
    # Clear the current refresh token cookie
    response.delete_cookie(key="refresh_token", samesite="strict", secure=True, path="/")
    return {"detail": "All sessions successfully revoked."}

@router.delete("/me")
def delete_account(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Delete the user account (cascades to delete refresh tokens)
    db.delete(current_user)
    db.commit()
    
    # Clear the refresh token cookie
    response.delete_cookie(key="refresh_token", samesite="strict", secure=True, path="/")
    return {"detail": "Account successfully deleted."}
