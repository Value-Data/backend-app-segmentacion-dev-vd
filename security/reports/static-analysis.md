# Analisis Estatico de Seguridad - Backend Python

**Proyecto**: Sistema Segmentacion Nuevas Especies - Garces Fruit
**Fecha**: 2026-03-20
**Auditor**: Equipo Cybersecurity ValueData
**Scope**: `backend/app/` (todos los archivos Python)

---

## Resumen Ejecutivo

Se realizo revision manual de codigo estatico sobre todo el backend, enfocandose en las categorias OWASP mas relevantes. Se encontraron **12 hallazgos** de seguridad.

| Severidad | Hallazgos |
|-----------|-----------|
| CRITICAL  | 2         |
| HIGH      | 4         |
| MEDIUM    | 3         |
| LOW       | 3         |

---

## Hallazgos

### S01 - Secret por Defecto en JWT_SECRET_KEY

| Campo | Valor |
|-------|-------|
| **Severidad** | CRITICAL |
| **CWE** | CWE-798 (Use of Hard-coded Credentials) |
| **Archivo** | `backend/app/core/config.py:23` |
| **CVSS** | 9.1 |

**Descripcion**: El valor por defecto de `JWT_SECRET_KEY` es el string `"change-me-in-production"`. Si el despliegue no configura esta variable de entorno, todos los tokens JWT seran firmados con un secreto conocido publicamente, permitiendo a cualquier atacante generar tokens validos.

**Codigo afectado**:
```python
JWT_SECRET_KEY: str = "change-me-in-production"
```

**Remediacion**:
```python
JWT_SECRET_KEY: str  # Sin valor por defecto - forzar configuracion

# O alternativamente, generar uno aleatorio con advertencia:
import secrets
JWT_SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
```

Ademas, agregar validacion en el startup de la aplicacion:
```python
@app.on_event("startup")
def validate_settings():
    if settings.JWT_SECRET_KEY == "change-me-in-production":
        raise RuntimeError("JWT_SECRET_KEY must be set to a secure value in production")
```

---

### S02 - Credenciales de Base de Datos en Configuracion por Defecto

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-798 (Use of Hard-coded Credentials) |
| **Archivo** | `backend/app/core/config.py:16-17` |

**Descripcion**: `DB_SERVER` tiene como valor por defecto un servidor Azure real (`tcp:valuedata.database.windows.net,1433`) y `DB_NAME` contiene un nombre de base de datos especifico (`valuedatadev_2026-01-29T01-40Z`). Esto expone informacion del entorno de desarrollo.

**Codigo afectado**:
```python
DB_SERVER: str = "tcp:valuedata.database.windows.net,1433"
DB_NAME: str = "valuedatadev_2026-01-29T01-40Z"
```

**Remediacion**:
```python
DB_SERVER: str = ""
DB_NAME: str = ""
```

---

### S03 - Token JWT con Expiracion Excesiva

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **CWE** | CWE-613 (Insufficient Session Expiration) |
| **Archivo** | `backend/app/core/config.py:25` |

**Descripcion**: El token de acceso JWT expira en 480 minutos (8 horas). Para un sistema que maneja datos de inventario y operaciones criticas de negocio, esto es excesivo. Si un token es robado, el atacante tiene una ventana de 8 horas para operar.

**Codigo afectado**:
```python
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
```

**Remediacion**: Reducir a 60 minutos e implementar refresh tokens:
```python
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60   # 1 hora
JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas - solo para refresh
```

---

### S04 - Endpoint de Logout No Invalida Token

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-613 (Insufficient Session Expiration) |
| **Archivo** | `backend/app/routes/auth.py:21-22` |

**Descripcion**: El endpoint `/api/v1/auth/logout` retorna `{"ok": True}` sin hacer nada. No invalida el token JWT. No usa autenticacion siquiera. Un token sigue siendo valido despues del "logout" hasta que expira naturalmente (8 horas).

**Codigo afectado**:
```python
@router.post("/logout")
def logout():
    return {"ok": True}
```

**Remediacion**: Implementar una blocklist de tokens (usando Redis o tabla en BD):
```python
@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if payload:
        jti = payload.get("jti")
        exp = payload.get("exp")
        # Agregar a blocklist hasta que expire
        token_blocklist.add(jti, ttl=exp - time.time())
    return {"ok": True}
```

---

### S05 - Falta Limite de Intentos de Login (Brute Force)

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |
| **Archivo** | `backend/app/services/auth_service.py:13-24` |

**Descripcion**: El endpoint de login no tiene rate limiting ni bloqueo por intentos fallidos. Un atacante puede realizar ataques de fuerza bruta sin restriccion.

**Remediacion**: Implementar rate limiting con slowapi o similar:
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    ...
```

Tambien considerar bloqueo de cuenta tras N intentos fallidos.

---

### S06 - Hash de Password con Longitud Insuficiente en BD

| Campo | Valor |
|-------|-------|
| **Severidad** | CRITICAL |
| **CWE** | CWE-916 (Use of Password Hash With Insufficient Computational Effort) |
| **Archivo** | `backend/app/models/sistema.py:15` |

**Descripcion**: El campo `password_hash` esta definido como `sa.String(64)`. Un hash bcrypt tiene **60 caracteres** tipicamente (formato `$2b$12$...`), pero bajo ciertas configuraciones puede llegar a 72+. Con 64 caracteres, el hash podria truncarse silenciosamente, haciendo que la verificacion de password falle o que se almacene un hash incompleto.

**Codigo afectado**:
```python
password_hash: Optional[str] = Field(default=None, sa_column=Column(sa.String(64)))
```

**Remediacion**: Aumentar a 128 caracteres para soportar todos los formatos de hash:
```python
password_hash: Optional[str] = Field(default=None, sa_column=Column(sa.String(128)))
```

---

### S07 - Falta de Validacion de Tipo de Archivo en Bulk Import

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-434 (Unrestricted Upload of File with Dangerous Type) |
| **Archivo** | `backend/app/routes/laboratorio.py:72-113` |

**Descripcion**: El endpoint `POST /laboratorio/bulk-import` acepta cualquier archivo sin validar tipo ni tamano. Un atacante podria subir archivos maliciosos (ZIP bombs, archivos XML malformados disfrazados de XLSX, archivos extremadamente grandes).

**Codigo afectado**:
```python
@router.post("/bulk-import")
async def bulk_import(
    file: UploadFile = File(...),
    ...
):
    content = await file.read()  # Lee TODO el archivo en memoria
    wb = openpyxl.load_workbook(BytesIO(content))
```

**Remediacion**:
```python
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/bulk-import")
async def bulk_import(file: UploadFile = File(...), ...):
    # Validar extension
    if not file.filename or not file.filename.endswith('.xlsx'):
        raise HTTPException(400, "Solo se aceptan archivos .xlsx")

    # Validar tamano
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(400, f"Archivo excede tamano maximo ({MAX_UPLOAD_SIZE // 1024 // 1024} MB)")

    wb = openpyxl.load_workbook(BytesIO(content), read_only=True)
```

---

### S08 - Errores de Bulk Import Exponen Informacion Interna

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **CWE** | CWE-209 (Generation of Error Message Containing Sensitive Information) |
| **Archivo** | `backend/app/routes/laboratorio.py:111` |

**Descripcion**: Los errores capturados durante la importacion masiva se retornan al usuario como `str(e)`, lo cual puede incluir stacktraces, nombres de tablas internas, y detalles de la base de datos.

**Codigo afectado**:
```python
except Exception as e:
    errors.append({"row": row_idx, "error": str(e)})
```

**Remediacion**:
```python
except ValueError as e:
    errors.append({"row": row_idx, "error": str(e)})
except Exception:
    errors.append({"row": row_idx, "error": "Error interno al procesar fila"})
```

---

### S09 - Endpoint Mantenedores Acepta `dict` sin Tipado

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **CWE** | CWE-20 (Improper Input Validation) |
| **Archivo** | `backend/app/routes/mantenedores.py:114,131` |

**Descripcion**: Los endpoints POST y PUT de mantenedores reciben `data: dict` en lugar de un schema Pydantic tipado. Aunque la validacion se hace despues con el schema del registry, el body llega sin ningun tipo de validacion de FastAPI, evadiendo la generacion automatica de OpenAPI y la validacion de tipos.

**Codigo afectado**:
```python
@router.post("/{entidad}", status_code=201)
def create_entity(entidad: str, data: dict, ...):
    validated = create_schema(**data)  # Validacion posterior
```

**Remediacion**: Si bien es funcional, se recomienda documentar claramente en OpenAPI que el body es dinamico, y agregar validacion de tamano del dict:
```python
from fastapi import Body

def create_entity(entidad: str, data: dict = Body(..., max_length=50), ...):
    if len(data) > 50:
        raise HTTPException(400, "Demasiados campos")
    ...
```

---

### S10 - Cambio de Password sin Verificar Password Actual

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **CWE** | CWE-620 (Unverified Password Change) |
| **Archivo** | `backend/app/routes/sistema.py:64-74` |

**Descripcion**: El endpoint `PUT /sistema/usuarios/{id}/password` permite cambiar la contrasena de cualquier usuario sin solicitar la contrasena actual. Solo requiere rol `admin`. Si bien esto es aceptable para un reset administrativo, deberia existir un endpoint separado para que los usuarios cambien su propia contrasena verificando la actual.

**Codigo afectado**:
```python
class PasswordChange(BaseModel):
    new_password: str  # No incluye current_password
```

**Remediacion**: Agregar endpoint `/auth/change-password` para self-service:
```python
class SelfPasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.put("/auth/change-password")
def self_change_password(data: SelfPasswordChange, user = Depends(get_current_user), db = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(401, "Contrasena actual incorrecta")
    user.password_hash = hash_password(data.new_password)
    db.commit()
```

---

### S11 - Sin Validacion de Complejidad de Password

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **CWE** | CWE-521 (Weak Password Requirements) |
| **Archivo** | `backend/app/schemas/auth.py:30`, `backend/app/schemas/sistema.py:11` |

**Descripcion**: No se valida complejidad de contrasena en `PasswordChange.new_password` ni en `UsuarioCreate.password`. Un usuario podria tener contrasena "1" o vacia.

**Remediacion**:
```python
from pydantic import field_validator

class UsuarioCreate(BaseModel):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('La contrasena debe tener al menos 8 caracteres')
        if not any(c.isupper() for c in v):
            raise ValueError('Debe contener al menos una mayuscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('Debe contener al menos un numero')
        return v
```

---

### S12 - Uso de `datetime.utcnow()` (Deprecado)

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **CWE** | N/A (Best Practice) |
| **Archivos** | Multiples archivos en `services/` y `models/` |

**Descripcion**: El proyecto usa extensivamente `datetime.utcnow()` que esta deprecado desde Python 3.12. Deberia usar `datetime.now(timezone.utc)` para obtener timestamps timezone-aware.

**Remediacion**: Reemplazar todas las ocurrencias:
```python
# Antes:
from datetime import datetime
datetime.utcnow()

# Despues:
from datetime import datetime, timezone
datetime.now(timezone.utc)
```

---

## Resumen de Acciones

| Prioridad | Hallazgo | Accion |
|-----------|----------|--------|
| 1 | S01 | Eliminar valor por defecto de JWT_SECRET_KEY, agregar validacion startup |
| 2 | S06 | Aumentar largo de password_hash a 128 en modelo Usuario |
| 3 | S04 | Implementar invalidacion real de tokens en logout |
| 4 | S05 | Agregar rate limiting al endpoint de login |
| 5 | S07 | Validar tipo y tamano de archivo en bulk-import |
| 6 | S02 | Eliminar servidor y BD por defecto en config |
| 7 | S03 | Reducir expiracion de token a 60 minutos |
| 8 | S08 | Sanitizar mensajes de error en bulk-import |
| 9 | S09 | Mejorar validacion de input en mantenedores |
| 10 | S10 | Agregar endpoint self-service de cambio de password |
| 11 | S11 | Agregar validacion de complejidad de password |
| 12 | S12 | Migrar a datetime.now(timezone.utc) |
