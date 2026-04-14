"""FastAPI application entry point."""

import base64
import logging
from contextlib import asynccontextmanager
from decimal import Decimal
from datetime import date, datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware
import json

from app.core.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class AppJSONEncoder(json.JSONEncoder):
    """Handle Decimal, bytes, date/datetime for JSON serialization."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode("ascii")
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)
from app.routes.auth import router as auth_router
from app.routes.mantenedores import router as mantenedores_router
from app.routes.inventario import router as inventario_router, guias_router
from app.routes.testblock import router as testblock_router, posiciones_router
from app.routes.laboratorio import router as laboratorio_router
from app.routes.labores import router as labores_router
from app.routes.analisis import router as analisis_router
from app.routes.alertas import router as alertas_router
from app.routes.sistema import router as sistema_router
from app.routes.bulk import router as bulk_router
from app.routes.reportes import router as reportes_router
from app.routes.seed import router as seed_router
from app.routes.seed_geo import router as seed_geo_router
from app.routes.relaciones import router as relaciones_router
from app.routes.variedades_extra import router as variedades_extra_router
from app.routes.testblock_grupo import router as testblock_grupo_router

settings = get_settings()

class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, cls=AppJSONEncoder, ensure_ascii=False).encode("utf-8")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create missing tables. Shutdown: no-op."""
    try:
        from sqlmodel import SQLModel as _SQLModel
        from app.core.database import engine
        import app.models  # noqa: F401
        _SQLModel.metadata.create_all(engine, checkfirst=True)
        logger.info("Database tables verified")
        # Add new columns to existing tables (safe: IF NOT EXISTS / try-except)
        from sqlalchemy import text
        with engine.connect() as conn:
            for stmt in [
                "IF COL_LENGTH('variedades_fotos', 'es_principal') IS NULL ALTER TABLE variedades_fotos ADD es_principal BIT DEFAULT 0",
                "IF COL_LENGTH('variedades_fotos', 'content_type') IS NULL ALTER TABLE variedades_fotos ADD content_type NVARCHAR(100) DEFAULT 'image/jpeg'",
                "IF COL_LENGTH('variedades_fotos', 'data') IS NULL ALTER TABLE variedades_fotos ADD data VARBINARY(MAX) NULL",
                "IF COL_LENGTH('plantas', 'etapa') IS NULL ALTER TABLE plantas ADD etapa VARCHAR(20) DEFAULT 'formacion'",
            ]:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    conn.rollback()
    except Exception as e:
        logger.warning(f"create_tables skipped: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=f"{settings.COMPANY_NAME} - Sistema de Segmentacion de Nuevas Especies",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    default_response_class=CustomJSONResponse,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https://server.arcgisonline.com https://*.tile.openstreetmap.org; "
            "connect-src 'self'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# GZip compression for responses >= 1KB
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount all routers under /api/v1
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(mantenedores_router, prefix=API_PREFIX)
app.include_router(inventario_router, prefix=API_PREFIX)
app.include_router(guias_router, prefix=API_PREFIX)
app.include_router(testblock_router, prefix=API_PREFIX)
app.include_router(posiciones_router, prefix=API_PREFIX)
app.include_router(laboratorio_router, prefix=API_PREFIX)
app.include_router(labores_router, prefix=API_PREFIX)
app.include_router(analisis_router, prefix=API_PREFIX)
app.include_router(alertas_router, prefix=API_PREFIX)
app.include_router(sistema_router, prefix=API_PREFIX)
app.include_router(bulk_router, prefix=API_PREFIX)
app.include_router(reportes_router, prefix=API_PREFIX)
app.include_router(seed_router, prefix=API_PREFIX)
app.include_router(seed_geo_router, prefix=API_PREFIX)
app.include_router(relaciones_router, prefix=API_PREFIX)
app.include_router(variedades_extra_router, prefix=API_PREFIX)
app.include_router(testblock_grupo_router, prefix=API_PREFIX)


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(l) for l in err.get("loc", []))
        errors.append(f"{field}: {err.get('msg', 'invalid')}")
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(errors)},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.error(f"IntegrityError on {request.method} {request.url.path}: {exc}")
    msg = "Violacion de restriccion de base de datos"
    if exc.orig:
        orig_str = str(exc.orig)
        if "UNIQUE" in orig_str or "duplicate" in orig_str.lower():
            msg = "Ya existe un registro con esos datos (valor duplicado)"
        elif "FOREIGN KEY" in orig_str:
            msg = "Referencia a un registro que no existe o no se puede eliminar"
    return JSONResponse(status_code=409, content={"detail": msg})


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"SQLAlchemyError on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Error de base de datos. Intente nuevamente."},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
    )


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "company": settings.COMPANY_NAME,
        "docs": "/api/docs",
    }


@app.get("/health")
@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
