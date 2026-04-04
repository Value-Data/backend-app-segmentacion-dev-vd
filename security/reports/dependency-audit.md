# Auditoria de Dependencias - Backend Python

**Proyecto**: Sistema Segmentacion Nuevas Especies - Garces Fruit
**Fecha**: 2026-03-20
**Auditor**: Equipo Cybersecurity ValueData
**Archivo evaluado**: `backend/requirements.txt`

---

## Resumen Ejecutivo

Se analizaron **15 dependencias** declaradas en `requirements.txt`. El proyecto usa versiones minimas (`>=`) sin fijar versiones maximas, lo cual permite instalaciones con versiones potencialmente incompatibles o con vulnerabilidades recien descubiertas.

| Severidad | Hallazgos |
|-----------|-----------|
| CRITICAL  | 1         |
| HIGH      | 3         |
| MEDIUM    | 2         |
| LOW       | 2         |
| INFO      | 3         |

---

## Analisis Detallado de Dependencias

### 1. python-jose[cryptography] >= 3.3.0

| Campo | Valor |
|-------|-------|
| **Severidad** | CRITICAL |
| **CWE** | CWE-327 (Use of a Broken or Risky Cryptographic Algorithm) |

**Hallazgo**: `python-jose` esta en estado de mantenimiento minimo. Se han reportado CVEs historicos en versiones antiguas relacionados con validacion de algoritmos JWT (CVE-2024-33664 - algorithm confusion en ECDSA). Ademas, la libreria no tiene releases activos frecuentes.

**Recomendacion**: Migrar a **PyJWT** (`pyjwt[crypto]>=2.8.0`) que es la libreria JWT mas mantenida activamente para Python. Alternativamente, usar `authlib` o `joserfc`.

```
# Reemplazar:
# python-jose[cryptography]>=3.3.0
# Por:
pyjwt[crypto]>=2.8.0
```

---

### 2. bcrypt >= 4.2.0

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Estado** | ACEPTABLE |

**Hallazgo**: Version actual es adecuada. bcrypt 4.x usa la implementacion Rust de bcrypt. No se conocen CVEs activos. El numero de rondas por defecto (12) es aceptable para 2026.

**Recomendacion**: Mantener. Considerar fijar version maxima: `bcrypt>=4.2.0,<5.0.0`.

---

### 3. fastapi >= 0.109.0

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **CWE** | CWE-1104 (Use of Unmaintained Third Party Components) |

**Hallazgo**: FastAPI 0.109.0 fue lanzado en enero 2024. Desde entonces se han publicado multiples versiones con correcciones de seguridad y bugs. Las versiones actuales (0.115+) incluyen mejoras en validacion de headers y manejo de errores.

**Recomendacion**: Actualizar a `fastapi>=0.115.0,<1.0.0` y fijar version minima mas reciente.

---

### 4. sqlalchemy >= 2.0.25

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Estado** | ACEPTABLE |

**Hallazgo**: SQLAlchemy 2.0.25 es una version estable. El ORM protege contra inyeccion SQL cuando se usa correctamente con parametros bind. No se detectaron CVEs criticos para esta version.

**Recomendacion**: Actualizar a `>=2.0.35` para obtener correcciones de bugs. Fijar: `sqlalchemy>=2.0.35,<3.0.0`.

---

### 5. pyodbc >= 5.1.0

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-89 (SQL Injection) |

**Hallazgo**: pyodbc es un wrapper sobre ODBC que permite ejecucion de SQL crudo. Si bien el proyecto usa SQLAlchemy ORM (que parametriza queries), la presencia de pyodbc habilita la posibilidad de queries crudos directos. No se detectaron queries crudos en el codigo actual, pero la dependencia abre la superficie de ataque.

**Recomendacion**: Mantener (necesaria para SQL Server), pero documentar que NUNCA se debe usar `cursor.execute()` con string formatting directo. Fijar: `pyodbc>=5.1.0,<6.0.0`.

---

### 6. python-dotenv >= 1.0.0

| Campo | Valor |
|-------|-------|
| **Severidad** | INFO |
| **Estado** | ACEPTABLE |

**Hallazgo**: Libreria estable para manejo de archivos `.env`. No se conocen CVEs. Asegurar que `.env` esta en `.gitignore`.

**Recomendacion**: Mantener. Fijar: `python-dotenv>=1.0.0,<2.0.0`.

---

### 7. python-multipart >= 0.0.6

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-400 (Uncontrolled Resource Consumption) |

**Hallazgo**: python-multipart 0.0.6 tuvo un CVE historico (CVE-2024-24762) de denegacion de servicio via multipart parsing con payloads malformados. Versiones >= 0.0.7 corrigen esto.

**Recomendacion**: **Actualizar urgente** a `python-multipart>=0.0.7`. El endpoint `POST /laboratorio/bulk-import` acepta uploads de archivos y es directamente afectado.

```
# Reemplazar:
# python-multipart>=0.0.6
# Por:
python-multipart>=0.0.7
```

---

### 8. openpyxl >= 3.1.2

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-611 (XML External Entity - XXE) |

**Hallazgo**: openpyxl procesa archivos XLSX (que son archivos ZIP con XML internamente). Versiones antiguas de openpyxl son susceptibles a ataques XXE si no se deshabilitan entidades externas. El endpoint `POST /laboratorio/bulk-import` procesa archivos Excel subidos por usuarios.

**Recomendacion**: Actualizar a `openpyxl>=3.1.5` y validar que el archivo subido tiene extension `.xlsx` antes de procesarlo. Limitar tamano maximo del archivo subido.

---

### 9. qrcode >= 7.4.2

| Campo | Valor |
|-------|-------|
| **Severidad** | INFO |
| **Estado** | ACEPTABLE |

**Hallazgo**: Libreria para generacion de QR codes. No se conocen CVEs. La entrada que recibe (`pos.codigo_unico`) es un string generado por el sistema, no controlado por el usuario.

**Recomendacion**: Mantener. Fijar: `qrcode>=7.4.2,<8.0.0`.

---

### 10. Pillow >= 10.2.0

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **CWE** | CWE-120 (Buffer Copy without Checking Size of Input) |

**Hallazgo**: Pillow es una libreria de procesamiento de imagenes con historial de CVEs frecuentes (buffer overflows en parsers de formatos). La version 10.2.0 tiene correcciones pero versiones posteriores (10.3+, 10.4+, 11.x) corrigen vulnerabilidades adicionales.

**Recomendacion**: Actualizar a `Pillow>=11.0.0` (ultima major). Fijar: `Pillow>=11.0.0,<12.0.0`.

---

### 11. reportlab >= 4.1.0

| Campo | Valor |
|-------|-------|
| **Severidad** | INFO |
| **Estado** | ACEPTABLE |

**Hallazgo**: Se usa para generacion de PDFs con QR codes. No procesa entrada de usuario directamente (los codigos QR son generados por el sistema). No se conocen CVEs criticos recientes.

**Recomendacion**: Mantener. Fijar: `reportlab>=4.1.0,<5.0.0`.

---

### 12. pydantic >= 2.5.0

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Estado** | ACEPTABLE |

**Hallazgo**: Pydantic 2.5+ es estable. Proporciona validacion de datos que ayuda a prevenir inyecciones. No se conocen CVEs criticos.

**Recomendacion**: Actualizar a `pydantic>=2.10.0`. Fijar: `pydantic>=2.10.0,<3.0.0`.

---

### 13. pydantic-settings >= 2.1.0

| Campo | Valor |
|-------|-------|
| **Severidad** | INFO (uso interno) |
| **Estado** | ACEPTABLE |

**Recomendacion**: Fijar: `pydantic-settings>=2.1.0,<3.0.0`.

---

### 14. sqlmodel >= 0.0.22

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Estado** | ACEPTABLE |

**Hallazgo**: SQLModel depende de SQLAlchemy y Pydantic. Es un wrapper que facilita la definicion de modelos. No introduce superficie de ataque adicional.

**Recomendacion**: Fijar: `sqlmodel>=0.0.22,<1.0.0`.

---

### 15. uvicorn[standard] >= 0.27.0

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Estado** | ACEPTABLE |

**Hallazgo**: Servidor ASGI. Versiones recientes incluyen mejoras de seguridad en manejo de HTTP headers. No se conocen CVEs criticos activos.

**Recomendacion**: Actualizar a `uvicorn[standard]>=0.30.0`. Fijar: `uvicorn[standard]>=0.30.0,<1.0.0`.

---

## Hallazgo General: Versiones sin Fijar

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **CWE** | CWE-1104 (Use of Unmaintained Third Party Components) |

**Hallazgo**: Todas las dependencias usan `>=` sin limite superior. Esto significa que `pip install` podria instalar versiones futuras con breaking changes o nuevas vulnerabilidades.

**Recomendacion**: Usar `requirements.txt` con versiones fijadas exactas generado desde `pip freeze`, o al menos usar rangos: `>=X.Y.Z,<(X+1).0.0`. Considerar usar `pip-compile` (pip-tools) o Poetry para lock files.

---

## requirements.txt Recomendado

```txt
fastapi>=0.115.0,<1.0.0
uvicorn[standard]>=0.30.0,<1.0.0
sqlmodel>=0.0.22,<1.0.0
sqlalchemy>=2.0.35,<3.0.0
pyodbc>=5.1.0,<6.0.0
pyjwt[crypto]>=2.8.0,<3.0.0       # reemplaza python-jose
bcrypt>=4.2.0,<5.0.0
python-dotenv>=1.0.0,<2.0.0
python-multipart>=0.0.7            # CRITICO: corrige CVE DoS
openpyxl>=3.1.5,<4.0.0
qrcode>=7.4.2,<8.0.0
Pillow>=11.0.0,<12.0.0
reportlab>=4.1.0,<5.0.0
pydantic>=2.10.0,<3.0.0
pydantic-settings>=2.1.0,<3.0.0
```

---

## Acciones Requeridas (Priorizadas)

1. **CRITICO**: Migrar de `python-jose` a `pyjwt[crypto]` - cambios en `core/security.py`
2. **HIGH**: Actualizar `python-multipart>=0.0.7` - corrige CVE DoS en file uploads
3. **HIGH**: Actualizar `openpyxl>=3.1.5` - mitiga riesgo XXE en bulk import
4. **HIGH**: Fijar versiones con rangos maximos en `requirements.txt`
5. **MEDIUM**: Actualizar FastAPI, Pillow a versiones recientes
6. **LOW**: Generar lockfile con `pip-compile` para builds reproducibles
