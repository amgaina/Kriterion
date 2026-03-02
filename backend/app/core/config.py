import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Kriterion"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://kriterion.vercel.app"]
    
    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_SUBMIT: str = "10/minute"
    RATE_LIMIT_API: str = "100/minute"
    
    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: str = ".py,.java,.cpp,.c,.js,.ts,.txt,.md,.pdf"
    UPLOAD_DIR: str = "/tmp/kriterion/uploads"
    SUBMISSIONS_DIR: str = "/tmp/kriterion/submissions"
    TEMP_DIR: str = "/tmp/kriterion/temp"
    
    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET_NAME: str = "kriterion-submissions"
    USE_S3_STORAGE: bool = True  # Set to False to use local storage
    
    # Sandbox
    SANDBOX_TIMEOUT_SECONDS: int = 30
    SANDBOX_MEMORY_LIMIT_MB: int = 512
    SANDBOX_CPU_LIMIT: float = 1.0
    SANDBOX_IMAGE: str = "kriterion-sandbox:latest"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"
    
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@kriterion.edu"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Admin
    INITIAL_ADMIN_EMAIL: str = "admin@ulm.edu"
    INITIAL_ADMIN_PASSWORD: str = "Admin@123456"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Create required directories
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.SUBMISSIONS_DIR, exist_ok=True)
os.makedirs(settings.TEMP_DIR, exist_ok=True)
