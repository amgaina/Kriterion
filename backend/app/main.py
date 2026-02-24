from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import uuid

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.logging import logger, set_request_id
from app.core.security import get_password_hash
from app.api.v1.api import api_router
from app.models import Language, DEFAULT_LANGUAGES, User, UserRole


def seed_languages():
    """Seed default programming languages to database"""
    db = SessionLocal()
    try:
        for lang_data in DEFAULT_LANGUAGES:
            existing = db.query(Language).filter(Language.name == lang_data.get("name")).first()
            if not existing:
                allowed_fields = {
                    "name", "display_name", "version", "file_extension",
                    "compile_command", "run_command", "docker_image",
                    "default_timeout_seconds", "default_memory_mb", "is_active"
                }
                filtered_data = {k: v for k, v in lang_data.items() if k in allowed_fields}
                lang = Language(**filtered_data)
                db.add(lang)
                logger.info(f"Added language: {lang_data.get('display_name')}")
        db.commit()
    except Exception as e:
        logger.error(f"Error seeding languages: {str(e)}")
        db.rollback()
    finally:
        db.close()


def seed_admin():
    """Create the initial admin account if it doesn't exist"""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.INITIAL_ADMIN_EMAIL).first()
        if not existing:
            admin = User(
                email=settings.INITIAL_ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.INITIAL_ADMIN_PASSWORD),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            db.commit()
            logger.info(f"Created initial admin: {settings.INITIAL_ADMIN_EMAIL}")
    except Exception as e:
        logger.error(f"Error seeding admin: {str(e)}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Kriterion API")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    
    # Seed programming languages
    logger.info("Ensuring programming languages are available...")
    seed_languages()

    # Seed initial admin
    seed_admin()
    
    yield
    
    # Shutdown
    logger.info("Shutting down Kriterion API")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Automated Grading System for Programming Assignments",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID and logging middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID to all requests"""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    set_request_id(request_id)
    
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)
    
    logger.info(
        f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "process_time": process_time
        }
    )
    
    return response


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": set_request_id()
        }
    )


# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.VERSION,
        "docs": "/api/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
