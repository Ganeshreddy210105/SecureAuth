import os
import sys
import unittest
from datetime import datetime, timedelta

# Add parent directory to sys.path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

# Set environment variables for testing (SQLite fallback + Mock Redis)
os.environ["DATABASE_URL"] = "sqlite:///./test_phase1.db"
os.environ["REDIS_URL"] = "redis://mock:6379/0"
os.environ["JWT_SECRET_KEY"] = "testsecretkeyforaccess12345!"
os.environ["JWT_REFRESH_SECRET_KEY"] = "testsecretkeyforrefresh12345!"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.session import get_db
from app.database.base import Base
from app.services.redis_service import redis_service
from app.models import User, RefreshToken

# Create testing engine and database
test_engine = create_engine("sqlite:///./test_phase1.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Dependency override
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestSecureAuthCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Clean up database file
        cls.client = None
        test_engine.dispose()
        if os.path.exists("./test_phase1.db"):
            try:
                os.remove("./test_phase1.db")
            except Exception as e:
                print(f"Error removing db file: {e}")

    def test_end_to_end_auth_flow(self):
        print("\n--- STARTING SECUREAUTH CORE VERIFICATION ---")
        
        # 1. Register User
        print("\nStep 1: Registering user...")
        reg_payload = {
            "email": "test@secureauth.dev",
            "password": "Password123!",  # Passes strength validation (len >= 8, upper, lower, digit, special)
            "full_name": "Test User",
            "avatar_url": "https://avatar.png"
        }
        res_reg = self.client.post("/api/v1/auth/register", json=reg_payload)
        print(f"Register status: {res_reg.status_code}")
        self.assertEqual(res_reg.status_code, 201)
        reg_data = res_reg.json()
        print(f"Register Response: {reg_data}")
        self.assertEqual(reg_data["email"], reg_payload["email"])
        self.assertFalse(reg_data["is_verified"])

        # 2. Get Verification Code from Redis (mocked / in-memory)
        print("\nStep 2: Retrieving email verification code from Redis...")
        verify_code = redis_service.get(f"verify_email:{reg_payload['email']}")
        print(f"Verification Code: {verify_code}")
        self.assertIsNotNone(verify_code)
        self.assertEqual(len(verify_code), 6)

        # 3. Verify Email
        print("\nStep 3: Verifying email address...")
        verify_payload = {
            "email": reg_payload["email"],
            "code": verify_code
        }
        res_verify = self.client.post("/api/v1/auth/verify-email", json=verify_payload)
        print(f"Verify Email status: {res_verify.status_code}")
        self.assertEqual(res_verify.status_code, 200)
        print(f"Verify Email Response: {res_verify.json()}")

        # 4. Login
        print("\nStep 4: Logging in...")
        login_payload = {
            "email": reg_payload["email"],
            "password": reg_payload["password"]
        }
        res_login = self.client.post("/api/v1/auth/login", json=login_payload)
        print(f"Login status: {res_login.status_code}")
        self.assertEqual(res_login.status_code, 200)
        tokens = res_login.json()
        print(f"Login Response Tokens: {tokens.keys()}")
        self.assertIn("access_token", tokens)
        self.assertIn("refresh_token", tokens)
        
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        # 5. Access Protected Route (/users/me)
        print("\nStep 5: Accessing protected route (/users/me)...")
        headers = {"Authorization": f"Bearer {access_token}"}
        res_me = self.client.get("/api/v1/users/me", headers=headers)
        print(f"Get Me status: {res_me.status_code}")
        self.assertEqual(res_me.status_code, 200)
        me_data = res_me.json()
        print(f"Get Me Response User: {me_data}")
        self.assertTrue(me_data["is_verified"])

        # 6. Refresh Token Rotation
        print("\nStep 6: Performing Token Refresh Rotation...")
        # Put refresh token in cookies
        cookies = {"refresh_token": refresh_token}
        res_refresh = self.client.post("/api/v1/auth/refresh", cookies=cookies)
        print(f"Refresh status: {res_refresh.status_code}")
        self.assertEqual(res_refresh.status_code, 200)
        new_tokens = res_refresh.json()
        print(f"Refresh Response Tokens: {new_tokens.keys()}")
        self.assertIn("access_token", new_tokens)
        self.assertIn("refresh_token", new_tokens)
        
        new_access_token = new_tokens["access_token"]
        new_refresh_token = new_tokens["refresh_token"]
        
        # 7. Access /users/me with new Access Token
        print("\nStep 7: Accessing protected route with new Access Token...")
        new_headers = {"Authorization": f"Bearer {new_access_token}"}
        res_me_new = self.client.get("/api/v1/users/me", headers=new_headers)
        print(f"Get Me with new token status: {res_me_new.status_code}")
        self.assertEqual(res_me_new.status_code, 200)

        # 8. Get Active Sessions
        print("\nStep 8: Getting active sessions...")
        new_cookies = {"refresh_token": new_refresh_token}
        res_sessions = self.client.get("/api/v1/users/sessions", headers=new_headers, cookies=new_cookies)
        print(f"Sessions status: {res_sessions.status_code}")
        self.assertEqual(res_sessions.status_code, 200)
        sessions_list = res_sessions.json()
        print(f"Sessions: {sessions_list}")
        self.assertEqual(len(sessions_list), 1)
        self.assertTrue(sessions_list[0]["is_current"])

        # 9. Verify the old refresh token reuse detection (should invalidate all sessions!)
        print("\nStep 9: Verifying old refresh token reuse detection...")
        res_refresh_fail = self.client.post("/api/v1/auth/refresh", cookies=cookies)
        print(f"Subsequent refresh with old token status (should fail): {res_refresh_fail.status_code}")
        self.assertEqual(res_refresh_fail.status_code, 401)

        # 10. Verify sessions are wiped out after reuse detection
        print("\nStep 10: Verifying sessions are wiped out after reuse detection...")
        res_sessions_after_reuse = self.client.get("/api/v1/users/sessions", headers=new_headers, cookies=new_cookies)
        print(f"Sessions after reuse status: {res_sessions_after_reuse.status_code}")
        self.assertEqual(res_sessions_after_reuse.status_code, 200)
        sessions_after_reuse_list = res_sessions_after_reuse.json()
        print(f"Sessions after reuse: {sessions_after_reuse_list}")
        self.assertEqual(len(sessions_after_reuse_list), 0)

        # 11. Logout
        print("\nStep 11: Logging out...")
        res_logout = self.client.post("/api/v1/auth/logout", headers=new_headers, cookies=new_cookies)
        print(f"Logout status: {res_logout.status_code}")
        self.assertEqual(res_logout.status_code, 200)

        # 12. Access Protected Route after Logout
        print("\nStep 12: Accessing protected route after logout (should fail)...")
        res_me_logout = self.client.get("/api/v1/users/me", headers=new_headers)
        print(f"Get Me post-logout status (should fail): {res_me_logout.status_code}")
        self.assertEqual(res_me_logout.status_code, 401)
        print("\n--- CORE VERIFICATION COMPLETED SUCCESSFULLY ---")

if __name__ == "__main__":
    unittest.main()
