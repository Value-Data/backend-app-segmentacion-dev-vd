# Revision OWASP Top 10 (2021)

**Proyecto**: Sistema Segmentacion Nuevas Especies - Garces Fruit
**Fecha**: 2026-03-20
**Auditor**: Equipo Cybersecurity ValueData
**Scope**: Backend completo (`backend/app/`)

---

## Resumen

| Categoria OWASP | Estado | Hallazgos |
|------------------|--------|-----------|
| A01: Broken Access Control | PARTIAL | 3 |
| A02: Cryptographic Failures | PARTIAL | 3 |
| A03: Injection | PASS | 0 |
| A04: Insecure Design | PARTIAL | 2 |
| A05: Security Misconfiguration | PARTIAL | 3 |
| A06: Vulnerable Components | FAIL | 3 |
| A07: Auth Failures | PARTIAL | 4 |
| A08: Data Integrity Failures | PARTIAL | 1 |
| A09: Logging & Monitoring | PARTIAL | 2 |
| A10: SSRF | PASS | 0 |

---

## A01: Broken Access Control

**Estado: PARTIAL**

### Hallazgo A01-1: RBAC Basico con Solo 2 Niveles Efectivos

**Severidad**: MEDIUM

El sistema implementa RBAC mediante `require_role()` en `core/deps.py`, pero en la practica solo distingue entre `admin` y `otros`. Los endpoints que requieren proteccion (sistema/usuarios, audit-log) usan `require_role("admin")`. Los demas endpoints solo verifican autenticacion (`get_current_user`) sin distincion de roles.

**Impacto**: Un usuario con rol `visualizador` puede crear, modificar y eliminar registros de inventario, testblocks, mediciones, etc., con las mismas capacidades que un `supervisor` o `jefe_campo`.

**Recomendacion**: Implementar granularidad de roles en todos los endpoints CRUD:
```python
# Ejemplo: solo admin y jefe_campo pueden eliminar
@router.delete("/{entidad}/{id}")
def delete_entity(..., user = Depends(require_role("admin", "jefe_campo"))):
    ...
```

### Hallazgo A01-2: Sin Control de Acceso por Campo/Cuartel

**Severidad**: MEDIUM

El modelo `Usuario` tiene un campo `campos_asignados` que sugiere control por campo, pero ningun endpoint filtra datos basandose en este campo. Un usuario asignado al Campo A puede ver y modificar datos del Campo B.

**Recomendacion**: Implementar filtrado por `campos_asignados` en las queries del ORM.

### Hallazgo A01-3: Posible IDOR en Endpoints por ID

**Severidad**: LOW

Los endpoints usan IDs secuenciales (`int`) en URLs como `/inventario/{id}`, `/testblocks/{id}`. No se verifica que el recurso pertenezca al ambito del usuario autenticado. Un usuario podria acceder a recursos de otros ambitos incrementando el ID.

**Recomendacion**: Para MVP es aceptable si todos los usuarios pertenecen a la misma organizacion. Para multi-tenant futuro, agregar filtro de tenant en cada query.

---

## A02: Cryptographic Failures

**Estado: PARTIAL**

### Hallazgo A02-1: JWT Secret por Defecto

**Severidad**: CRITICAL

Ya documentado en S01 del analisis estatico. El secreto JWT tiene valor por defecto `"change-me-in-production"`.

### Hallazgo A02-2: Algoritmo HS256 Aceptable pero Mejorable

**Severidad**: LOW

HS256 es seguro cuando el secreto es suficientemente largo (>= 256 bits). Es el algoritmo por defecto y mas simple para un MVP. Para produccion enterprise, RS256 (asimetrico) es preferible ya que el secreto de firma no necesita compartirse.

**Recomendacion**: Para MVP, mantener HS256 con secreto de al menos 32 bytes aleatorios. Para futuro, migrar a RS256.

### Hallazgo A02-3: Conexion a BD con Encrypt=yes pero Sin Validacion Completa

**Severidad**: INFO

La connection string incluye `Encrypt=yes;TrustServerCertificate=no;`, lo cual es correcto. La conexion a Azure SQL esta cifrada y valida el certificado del servidor.

---

## A03: Injection

**Estado: PASS**

### Analisis

El proyecto usa **SQLAlchemy ORM** y **SQLModel** para todas las operaciones de base de datos. No se encontraron queries SQL crudos (`text()`, `execute()` con strings formateados, ni uso directo de `pyodbc`).

Todas las queries usan el ORM con parametros bind:
```python
db.query(Model).filter(Model.campo == valor).all()
```

Los inputs de usuario pasan por validacion Pydantic antes de llegar al ORM.

**Conclusion**: No se detectaron riesgos de SQL injection en el codigo actual.

**Advertencia**: La dependencia `pyodbc` esta disponible para uso directo. Documentar que su uso directo queda prohibido fuera del engine de SQLAlchemy.

---

## A04: Insecure Design

**Estado: PARTIAL**

### Hallazgo A04-1: Sin Mecanismo de Refresh Token

**Severidad**: MEDIUM

El sistema usa un unico access token con expiracion de 8 horas. No hay refresh tokens. Esto obliga a elegir entre seguridad (tokens cortos que requieren re-login frecuente) y usabilidad (tokens largos que exponen mas si son robados).

**Recomendacion**: Implementar flujo de refresh tokens con access token de 15-60 minutos y refresh token de 8 horas almacenado en httpOnly cookie.

### Hallazgo A04-2: Operaciones Masivas sin Confirmacion

**Severidad**: LOW

Los endpoints de `alta-masiva`, `baja-masiva`, y `bulk-import` ejecutan operaciones sobre multiples registros sin mecanismo de confirmacion, preview, o rollback parcial. Una llamada erronea podria afectar cientos de registros.

**Recomendacion**: Para operaciones masivas, implementar un flujo de dos pasos: preview (muestra que se va a hacer) y confirm (ejecuta).

---

## A05: Security Misconfiguration

**Estado: PARTIAL**

### Hallazgo A05-1: CORS Permisivo en Metodos y Headers

**Severidad**: MEDIUM

`main.py` configura CORS con `allow_methods=["*"]` y `allow_headers=["*"]`. Esto permite todos los metodos HTTP y todos los headers, lo cual es mas permisivo de lo necesario.

**Codigo**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],    # Deberia ser explicito
    allow_headers=["*"],    # Deberia ser explicito
)
```

**Recomendacion**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Hallazgo A05-2: Documentacion API Expuesta en Produccion

**Severidad**: MEDIUM

Los endpoints `/api/docs` (Swagger) y `/api/redoc` estan disponibles siempre. En produccion, esto expone toda la superficie de la API a atacantes.

**Recomendacion**:
```python
app = FastAPI(
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)
```

### Hallazgo A05-3: Falta de Security Headers

**Severidad**: MEDIUM

No se configuran headers de seguridad HTTP como:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

**Recomendacion**: Agregar middleware de security headers:
```python
from starlette.middleware import Middleware
from starlette.responses import Response

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

---

## A06: Vulnerable and Outdated Components

**Estado: FAIL**

Ver reporte detallado en `dependency-audit.md`.

### Hallazgo A06-1: python-jose en Mantenimiento Minimo

**Severidad**: CRITICAL
Migrar a PyJWT.

### Hallazgo A06-2: python-multipart con CVE Conocido

**Severidad**: HIGH
Actualizar a >= 0.0.7.

### Hallazgo A06-3: Dependencias sin Fijar

**Severidad**: HIGH
Agregar rangos de versiones.

---

## A07: Identification and Authentication Failures

**Estado: PARTIAL**

### Hallazgo A07-1: Sin Rate Limiting en Login

**Severidad**: HIGH
Ya documentado en S05.

### Hallazgo A07-2: Logout No Funcional

**Severidad**: HIGH
Ya documentado en S04.

### Hallazgo A07-3: Sin Politica de Complejidad de Password

**Severidad**: MEDIUM
Ya documentado en S11. Las contrasenas pueden ser de cualquier longitud y complejidad.

### Hallazgo A07-4: Token No Incluye Campos de Seguridad Avanzados

**Severidad**: LOW

El payload del JWT solo contiene `sub` (username) y `rol`. No incluye:
- `jti` (JWT ID) para revocacion individual
- `aud` (audience) para validar destinatario
- `iss` (issuer) para validar emisor

**Recomendacion**:
```python
import uuid

def create_access_token(data: dict, ...):
    to_encode = data.copy()
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "iss": "garces-fruit-api",
        "aud": "garces-fruit-web",
    })
    ...
```

---

## A08: Software and Data Integrity Failures

**Estado: PARTIAL**

### Hallazgo A08-1: Sin Verificacion de Integridad en Pipeline de Dependencias

**Severidad**: MEDIUM

No existe un lockfile (`requirements.lock` o `poetry.lock`) que garantice que las dependencias instaladas son exactamente las mismas que fueron auditadas. Un ataque de supply chain podria inyectar codigo malicioso en una dependencia transitiva.

**Recomendacion**: Generar lockfile con hashes:
```bash
pip install pip-tools
pip-compile --generate-hashes requirements.txt -o requirements.lock
```

---

## A09: Security Logging and Monitoring Failures

**Estado: PARTIAL**

### Hallazgo A09-1: Modelo AuditLog Existe pero No Se Usa Automaticamente

**Severidad**: HIGH

El modelo `AuditLog` esta definido en `models/sistema.py` con campos para tabla, accion, datos anteriores/nuevos, usuario, IP. Sin embargo, **ningun servicio escribe automaticamente en audit_log**. Las operaciones CRUD en `services/crud.py` no registran auditorias. Solo el endpoint `GET /sistema/audit-log` existe para lectura.

**Recomendacion**: Agregar logging automatico en `crud.py`:
```python
def _log_audit(db, tabla, registro_id, accion, datos_ant, datos_new, usuario):
    log = AuditLog(
        tabla=tabla,
        registro_id=registro_id,
        accion=accion,
        datos_anteriores=json.dumps(datos_ant) if datos_ant else None,
        datos_nuevos=json.dumps(datos_new) if datos_new else None,
        usuario=usuario,
    )
    db.add(log)
```

### Hallazgo A09-2: Sin Logging de Eventos de Seguridad

**Severidad**: MEDIUM

No se registran eventos de seguridad criticos:
- Intentos de login fallidos
- Cambios de password
- Creacion/desactivacion de usuarios
- Intentos de acceso no autorizado (403)

**Recomendacion**: Usar el modulo `logging` de Python para emitir eventos de seguridad:
```python
import logging
security_logger = logging.getLogger("security")

# En auth_service.py:
security_logger.warning(f"Login fallido para usuario: {req.username}")
security_logger.info(f"Login exitoso: {user.username}")
```

---

## A10: Server-Side Request Forgery (SSRF)

**Estado: PASS**

### Analisis

El backend no realiza requests HTTP salientes a URLs proporcionadas por usuarios. No existen endpoints que acepten URLs como parametros ni que hagan fetch de recursos externos.

**Conclusion**: No se detectaron riesgos de SSRF.

---

## Resumen de Acciones Prioritarias

| # | Categoria | Severidad | Accion |
|---|-----------|-----------|--------|
| 1 | A02/A07 | CRITICAL | Eliminar JWT secret por defecto |
| 2 | A06 | CRITICAL | Migrar python-jose a PyJWT |
| 3 | A07 | HIGH | Implementar rate limiting en login |
| 4 | A07 | HIGH | Implementar logout real con blocklist |
| 5 | A06 | HIGH | Actualizar python-multipart >= 0.0.7 |
| 6 | A09 | HIGH | Activar escritura automatica en audit_log |
| 7 | A01 | MEDIUM | Implementar RBAC granular por endpoint |
| 8 | A05 | MEDIUM | Restringir CORS, ocultar docs en prod |
| 9 | A05 | MEDIUM | Agregar security headers |
| 10 | A04 | MEDIUM | Implementar refresh tokens |
