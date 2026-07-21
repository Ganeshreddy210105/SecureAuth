import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class OAuthService:
    def __init__(self):
        self.google_client_id = settings.GOOGLE_CLIENT_ID
        self.google_client_secret = settings.GOOGLE_CLIENT_SECRET
        self.github_client_id = settings.GITHUB_CLIENT_ID
        self.github_client_secret = settings.GITHUB_CLIENT_SECRET

    def get_google_auth_url(self, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self.google_client_id or "mock_google_client_id",
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        url = "https://accounts.google.com/o/oauth2/v2/auth"
        query_str = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{url}?{query_str}"

    async def get_google_user_info(self, code: str, redirect_uri: str) -> dict:
        # Mock behavior for testing if credentials are not configured
        if not self.google_client_id or not self.google_client_secret:
            logger.info("Google OAuth credentials missing. Returning mock profile.")
            return {
                "id": "mock_google_id_12345",
                "email": "google.user@example.com",
                "name": "Google User",
                "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
                "email_verified": True
            }

        # Token exchange
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": self.google_client_id,
                    "client_secret": self.google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"}
            )
            if token_res.status_code != 200:
                logger.error(f"Google token exchange failed: {token_res.text}")
                raise Exception("Failed to exchange authorization code for Google token.")
            
            tokens = token_res.json()
            access_token = tokens.get("access_token")
            
            # Fetch profile
            profile_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if profile_res.status_code != 200:
                logger.error(f"Failed to fetch Google profile: {profile_res.text}")
                raise Exception("Failed to fetch Google user profile.")
                
            profile = profile_res.json()
            return {
                "id": profile.get("sub"),
                "email": profile.get("email"),
                "name": profile.get("name"),
                "picture": profile.get("picture"),
                "email_verified": profile.get("email_verified", False)
            }

    def get_github_auth_url(self, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self.github_client_id or "mock_github_client_id",
            "redirect_uri": redirect_uri,
            "scope": "user:email",
            "state": state,
        }
        url = "https://github.com/login/oauth/authorize"
        query_str = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{url}?{query_str}"

    async def get_github_user_info(self, code: str, redirect_uri: str) -> dict:
        # Mock behavior for testing if credentials are not configured
        if not self.github_client_id or not self.github_client_secret:
            logger.info("GitHub OAuth credentials missing. Returning mock profile.")
            return {
                "id": "mock_github_id_12345",
                "email": "github.user@example.com",
                "name": "GitHub User",
                "picture": "https://avatars.githubusercontent.com/u/9919?v=4",
                "email_verified": True
            }

        # Token exchange
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "code": code,
                    "client_id": self.github_client_id,
                    "client_secret": self.github_client_secret,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"}
            )
            if token_res.status_code != 200:
                logger.error(f"GitHub token exchange failed: {token_res.text}")
                raise Exception("Failed to exchange authorization code for GitHub token.")
            
            tokens = token_res.json()
            access_token = tokens.get("access_token")
            if not access_token:
                logger.error(f"GitHub token exchange didn't return access_token: {tokens}")
                raise Exception("Failed to get GitHub access token.")
            
            # Fetch profile
            profile_res = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if profile_res.status_code != 200:
                logger.error(f"Failed to fetch GitHub profile: {profile_res.text}")
                raise Exception("Failed to fetch GitHub user profile.")
                
            profile = profile_res.json()
            
            # Fetch emails because primary email might be hidden
            email_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            email = None
            if email_res.status_code == 200:
                emails = email_res.json()
                # Find primary email
                for e in emails:
                    if e.get("primary"):
                        email = e.get("email")
                        break
            
            # Fallback if no email retrieved
            if not email:
                email = profile.get("email") or f"{profile.get('login')}@users.noreply.github.com"
                
            return {
                "id": str(profile.get("id")),
                "email": email,
                "name": profile.get("name") or profile.get("login"),
                "picture": profile.get("avatar_url"),
                "email_verified": True
            }

oauth_service = OAuthService()
