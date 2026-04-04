# Security Checklist - Pre-Deployment

**Proyecto**: Sistema Segmentacion Nuevas Especies - Garces Fruit
**Fecha**: 2026-03-20
**Estado**: EN PROGRESO

---

## Instrucciones

Marcar cada item antes del despliegue a produccion. Items marcados con `[!]` son **bloqueantes** - el despliegue NO debe proceder sin completarlos.

---

## 1. Autenticacion y Sesiones

- [ ] `[!]` JWT_SECRET_KEY configurado con valor aleatorio de al menos 32 bytes en produccion
- [ ] `[!]` JWT_SECRET_KEY NO es `"change-me-in-production"`
- [ ] `[!]` Password hash column soporta al menos 128 caracteres (actualmente 64 - INSUFICIENTE)
- [ ] Rate limiting implementado en endpoint `/api/v1/auth/login` (max 5 intentos/minuto)
- [ ] Endpoint de logout invalida efectivamente el token (blocklist)
- [ ] Tokens JWT incluyen campo `jti` para revocacion individual
- [ ] Token de acceso expira en maximo 60 minutos (actualmente 480 - EXCESIVO)
- [ ] Refresh token implementado para renovacion transparente
- [ ] Bloqueo automatico de cuenta tras 10 intentos fallidos consecutivos

---

## 2. Control de Acceso

- [ ] `[!]` Todos los endpoints CRUD requieren autenticacion (`get_current_user`)
- [x] Endpoints de administracion protegidos con `require_role("admin")`
- [ ] Roles implementados con granularidad suficiente (admin/supervisor/visualizador)
- [ ] Filtrado por `campos_asignados` implementado en queries de datos
- [ ] Operaciones destructivas (DELETE, baja-masiva) restringidas por rol
- [ ] Endpoints de creacion de reglas de alerta protegidos por rol admin

---

## 3. Validacion de Input

- [ ] `[!]` Validacion de complejidad de contrasena (minimo 8 chars, mayuscula, numero)
- [ ] Validacion de tipo y tamano de archivo en bulk-import (max 10MB, solo .xlsx)
- [ ] Limites de paginacion enforced (max limit=1000 es aceptable para MVP)
- [ ] Schemas Pydantic validan todos los campos de entrada
- [x] IDs de ruta son enteros (prevencion de injection via path params)

---

## 4. Proteccion de Datos

- [x] Passwords almacenados como hash bcrypt (no plaintext)
- [x] Conexion a BD cifrada (Encrypt=yes, TrustServerCertificate=no)
- [ ] `[!]` Archivo `.env` NO esta en control de versiones
- [ ] `[!]` `.env` esta en `.gitignore`
- [ ] Datos sensibles (password_hash) no se retornan en responses (verificar serialization)
- [ ] Backups de BD cifrados en reposo

---

## 5. Headers y Transporte

- [ ] HTTPS enforced en produccion (redirect HTTP -> HTTPS)
- [ ] Header `Strict-Transport-Security` configurado
- [ ] Header `X-Content-Type-Options: nosniff` configurado
- [ ] Header `X-Frame-Options: DENY` configurado
- [ ] CORS origins configurados solo con dominios de produccion (no localhost)
- [ ] `allow_methods` y `allow_headers` en CORS restringidos a los necesarios

---

## 6. Dependencias

- [ ] `[!]` `python-jose` reemplazado por `pyjwt[crypto]`
- [ ] `[!]` `python-multipart >= 0.0.7` (corrige CVE-2024-24762)
- [ ] `openpyxl >= 3.1.5`
- [ ] `Pillow >= 11.0.0`
- [ ] Todas las dependencias con rangos de version fijados (min y max)
- [ ] Lockfile generado (`pip-compile --generate-hashes`)
- [ ] Auditoria de dependencias ejecutada sin hallazgos CRITICAL/HIGH: `pip-audit`

---

## 7. Gestion de Secretos

- [ ] `[!]` DB_SERVER y DB_NAME sin valores por defecto que expongan infraestructura real
- [ ] Secretos almacenados en Azure Key Vault (o equivalente)
- [ ] Variables de entorno documentadas en `.env.example` sin valores reales
- [ ] No hay secretos hardcodeados en el codigo fuente
- [x] `.env.example` usa valores placeholder (`your_db_user`, `your_db_password`)

---

## 8. Logging y Monitoreo

- [ ] AuditLog se escribe automaticamente en operaciones CRUD
- [ ] Intentos de login fallidos se registran con IP y timestamp
- [ ] Eventos de seguridad (cambio de password, creacion de usuario) se loguean
- [ ] Errores 500 se registran sin exponer stacktrace al usuario
- [ ] Alertas configuradas para patrones anomalos (multiples 401, 403)

---

## 9. Dockerfile y Deployment

- [ ] Imagen base sin vulnerabilidades conocidas (`python:3.12-slim`)
- [ ] Container no corre como root (agregar `USER appuser`)
- [ ] Health check configurado (`/health`)
- [x] No se copian archivos `.env` al container
- [ ] Variables de entorno inyectadas por el orquestador (Azure App Service)
- [ ] `DEBUG=false` en produccion
- [ ] `docs_url` y `redoc_url` deshabilitados en produccion

---

## 10. Base de Datos

- [x] Soft delete implementado (campo `activo`)
- [x] Timestamps de creacion y modificacion en todas las tablas principales
- [ ] Indices creados para queries frecuentes (filtros por estado, testblock, temporada)
- [ ] Conexion pooling configurado correctamente (pool_size=5, max_overflow=10)
- [x] Pool pre-ping habilitado para detectar conexiones muertas

---

## Estado General

**Items bloqueantes sin resolver**: 7
**Veredicto**: **NO LISTO PARA PRODUCCION**

Los items marcados con `[!]` deben completarse antes del despliegue. Los items restantes son recomendaciones de hardening que deberian abordarse en un sprint de seguridad post-MVP.
