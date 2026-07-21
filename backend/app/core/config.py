import os
from typing import List, Union
from pydantic import AnyHttpUrl, BeforeValidator, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated

def parse_cors(v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, (list, str)):
        return v
    raise ValueError(v)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )
    
    PROJECT_NAME: str = "SecureAuth"
    
    # Database Settings
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/secureauth"
    
    # Redis Settings
    REDIS_URL: str = "redis://redis:6379/0"
    
    # JWT Settings
    JWT_SECRET_KEY: str = "supersecretaccesskeyforsecureauthplatform12345!"
    JWT_REFRESH_SECRET_KEY: str = "supersecretrefreshkeyforsecureauthplatform12345!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: Annotated[
        List[str], BeforeValidator(parse_cors)
    ] = ["http://localhost:3000"]
    
    # Email Settings (FastAPI-Mail)
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@secureauth.dev"
    MAIL_PORT: int = 1025  # Mailhog default
    MAIL_SERVER: str = "mailhog"
    MAIL_FROM_NAME: str = "SecureAuth Support"
    MAIL_STARTTLS: bool = False
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = False
    
    # OAuth Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    
    # Rate Limiting
    RATE_LIMIT_LIMIT: int = 5
    RATE_LIMIT_PERIOD: int = 60

settings = Settings()
