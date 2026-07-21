import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import uuid

# Override Database URL to SQLite for testing
os.environ["DATABASE_URL"] = "sqlite:///./test_api.db"
os.environ["REDIS_URL"] = "redis://mock:6379/0"

from app.main import app
from app.database.session import get_db
from app.database.base import Base
from app.services.redis_service import redis_service
from app.models import User, RefreshToken

# Create test DB engine
engine = create_engine("sqlite:///./test_api.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("./test_api.db"):
        try:
            os.remove("./test_api.db")
        except Exception:
            pass

@pytest.fixture
def client():
    return TestClient(app)

def test_register_weak_password(client):
    payload = {
        "email": "weak@secureauth.dev",
        "password": "weak",  # missing upper, digit, special, len < 8
        "full_name": "Weak User"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422  # validation error

def test_register_success(client):
    payload = {
        "email": "test_user@secureauth.dev",
        "password": "Password123!",
        "full_name": "Test User"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["is_verified"] is False
    assert "id" in data

def test_verify_email(client):
    email = "test_user@secureauth.dev"
    code = redis_service.get(f"verify_email:{email}")
    assert code is not None
    
    # Try invalid code
    res = client.post("/api/v1/auth/verify-email", json={"email": email, "code": "000000"})
    assert res.status_code == 400
    
    # Try valid code
    res = client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    assert res.status_code == 200
    assert res.json()["detail"] == "Email address successfully verified."

def test_login(client):
    payload = {
        "email": "test_user@secureauth.dev",
        "password": "Password123!"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_refresh_token_rotation(client):
    # Perform login first
    payload = {
        "email": "test_user@secureauth.dev",
        "password": "Password123!"
    }
    res_login = client.post("/api/v1/auth/login", json=payload)
    tokens = res_login.json()
    refresh_token = tokens["refresh_token"]
    
    # Refresh
    res_refresh = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})
    assert res_refresh.status_code == 200
    data = res_refresh.json()
    assert "access_token" in data
    assert "refresh_token" in data
    
    # Reuse old token (should fail)
    res_reuse = client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_token})
    assert res_reuse.status_code == 401

def test_otp_login(client):
    email = "test_user@secureauth.dev"
    # Send OTP
    res_send = client.post("/api/v1/auth/send-otp", json={"email": email})
    assert res_send.status_code == 200
    
    otp_code = redis_service.get(f"otp:{email}")
    assert otp_code is not None
    
    # Login OTP
    res_login = client.post("/api/v1/auth/login-otp", json={"email": email, "code": otp_code})
    assert res_login.status_code == 200
    tokens = res_login.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

def test_forgot_password_reset(client):
    email = "test_user@secureauth.dev"
    # Trigger forgot password
    res_forgot = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res_forgot.status_code == 200
    
    # Access reset token from DB
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == email).first()
    reset_token = user.reset_token
    db.close()
    
    assert reset_token is not None
    
    # Reset password
    res_reset = client.post("/api/v1/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewPassword123!"
    })
    assert res_reset.status_code == 200
    
    # Verify we can login with the new password
    res_login = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "NewPassword123!"
    })
    assert res_login.status_code == 200
