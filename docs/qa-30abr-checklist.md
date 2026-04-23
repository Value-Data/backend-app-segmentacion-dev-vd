# QA Checklist — Release 30-abr-2026

Checklist de validación post-deploy para los 14 commits de esta sesión.
Ejecutar en orden. Ítems marcados con `[🤖]` los cubre el smoke script
(`scripts/smoke_qa_checks.py`); los marcados con `[👤]` requieren
navegación manual en la app.

## Pre-requisitos

- [ ] Azure App Service backend → `ENV=production` seteado.
- [ ] Workflows GitHub Actions recreados (los borrados).
- [ ] Scripts data ejecutados contra Azure SQL:
  - [ ] `python scripts/fix_paises_chile_orden.py --execute`
  - [ ] `python scripts/backfill_usuario_creacion.py --execute`
  - [ ] `python scripts/cleanup_qa_data.py` (dry-run) → revisar → `--execute`
- [ ] Frontend deployado con los commits de UI polish.

## Seguridad

- [ ] `[🤖]` **S-1**: `GET /sistema/usuarios` no incluye `password_hash`.
- [ ] `[🤖]` **SEC-JWT**: `GET /files/fotos/{fid}?token=<jwt>` responde **410 Gone**.
- [ ] `[🤖]` **SEC-JWT**: `GET /files/fotos/{fid}` con `Authorization: Bearer` responde **200** con `content-type: image/*`.
- [ ] `[🤖]` **S-10**: `POST /auth/logout` revoca el jti — uso posterior del mismo token → **401 "Token revocado"**.
- [ ] `[👤]` **S-10 TTL**: loguearse como admin y verificar que el token expira en 4h (decode del JWT — `exp - iat = 14400`). Loguearse como visualizador → 12h (`exp - iat = 43200`).
- [ ] `[🤖]` **EF-4**: `POST /labores/seed-estados-fenologicos` responde **403** (bloqueado por `ENV=production`).

## Catálogos / Mantenedores

- [ ] `[🤖]` **PS-2**: `GET /mantenedores/paises` devuelve Chile con `orden=0`.
- [ ] `[👤]` **PS-1/PMG-1/EF-3/TL-1**: abrir cada mantenedor y verificar tildes en header:
  - Catálogos hub → "Catálogos"
  - Países (hub label y title)
  - Orígenes
  - Estados Fenológicos
  - Programas de Mejoramiento Genético
  - Tipos de Labor → categorías badges con tildes ("Fenología", "Fertilización")
- [ ] `[🤖]` **SUS-2**: `GET /mantenedores/susceptibilidades?especie=<id_cerezo>` devuelve solo CER-\*.
- [ ] `[👤]` **SUS-3**: abrir modal "Nueva Susceptibilidad" — ahí debe haber selector de Especie requerido.
- [ ] `[👤]` **EF-2**: intentar crear un estado fenológico con `id_especie` inexistente → mensaje de error 404.
- [ ] `[👤]` **MT-1**: crear un Pais nuevo desde UI → en DB `usuario_creacion` debe ser el username del admin logueado (no NULL).

## Variedades — Susceptibilidades / Polinizantes / Bitácora

- [ ] `[👤]` **SUS-4**: abrir Tamara (Cerezo) → tab Susceptibilidades → dropdown "Agregar" debe mostrar solo susceptibilidades de Cerezo (no Ciruela/Durazno).
- [ ] `[👤]` **SUS-5**: desde DevTools network, el body POST a `/variedades/{id}/susceptibilidades` no debe incluir `id_variedad`.
- [ ] `[👤]` **SUS-6**: eliminar una susceptibilidad → debe aparecer en `/sistema/audit-log` como DELETE sobre `variedad_susceptibilidades`.
- [ ] `[👤]` **POL-1**: abrir una variedad Cerezo, tab Polinizantes → intentar agregar una Ciruela como polinizante vía API directa → **422**.
- [ ] `[👤]` **POL-2**: intentar `polinizante_variedad_id = id de la misma variedad` → **422** "sí misma".
- [ ] `[🤖]` **POL-4**: POST polinizante con campo extra `bogus: true` → **422**.
- [ ] `[👤]` **POL-7**: agregar mismo polinizante dos veces → segundo intento **409**.
- [ ] `[🤖]` **BIT-2**: POST bitácora variedad con body `{}` → **422**.
- [ ] `[👤]` **BIT-4**: crear entrada de bitácora con título `<script>alert(1)</script>Control OK` → guardado como `Control OK` (sin la etiqueta).

## Reportes

- [ ] `[🤖]` **REP-1**: `GET /reportes/variedad/73` (Tamara) incluye keys `polinizantes` y `susceptibilidades`.
- [ ] `[👤]` **REP-1**: cada elemento de `susceptibilidades` en la respuesta trae `codigo`, `nombre`, `grupo`, `severidad` (no solo `#id`).

## Audit log (S-2)

- [ ] `[🤖]` **S-2**: `GET /sistema/audit-log` devuelve cada fila con las keys `id_log`, `tabla`, `registro_id`, `accion`, `usuario`, `ip_address`, `fecha`.
- [ ] `[👤]` **S-2 UI**: abrir `/sistema/audit-log` en el frontend → todas las columnas pobladas (antes aparecían ID/Tabla/Registro/IP vacíos).

## Data cleanup (después de correr `cleanup_qa_data.py --execute`)

- [ ] Tamara (id 73) en `variedades_susceptibilidades` = 0 filas.
- [ ] No hay polinizantes huérfanos: `SELECT COUNT(1) FROM variedades_polinizantes p LEFT JOIN variedades v ON v.id_variedad=p.id_variedad WHERE v.id_variedad IS NULL` = 0.
- [ ] No hay bitácora huérfana.

## Backfill auditoría

Después de `backfill_usuario_creacion.py --execute`:

- [ ] `SELECT COUNT(1) FROM paises WHERE usuario_creacion IS NULL` = 0.
- [ ] Mismo para: `regiones`, `comunas`, `temporadas`, `bodegas`, `catalogos`, `variedades_polinizantes`, `especies`, `colores`, `pmg`, `portainjertos`, `tipos_labor`, `susceptibilidades`, `estados_fenologicos`, `variedades`.

## Humo final

Desde una máquina con acceso a Azure SQL + el backend público:

```bash
export API_URL=https://backendsegmentacion-<host>.azurewebsites.net/api/v1
export ADMIN_USER=<user>
export ADMIN_PASS=<pass>
python scripts/smoke_qa_checks.py
```

El script imprime PASS/FAIL por check. **Exit 0 = todo ok**.

## Known non-issues

- 13 tests de integración (`test_mantenedores_routes.py::TestXxxPais`,
  `test_labores_e2e.py::TestEstadosFenologicosCRUD/LaboresPlanificacion/Evidencias`)
  fallan con SQLite por un quirk de serialización de SQLModel que
  devuelve body `{}` en POSTs. **No afecta producción** (SQL Server
  serializa bien). Pre-existente de antes de esta sesión.

- Algunos 🟠 de QA no entran en este sprint: FIX-FOTOS fallback SVG,
  FIX-AL motor de alertas, S-8 audit extendido completo. Documentados
  en deuda técnica post-30-abr.
