# Project: Sistema de Segmentacion de Nuevas Especies — Garces Fruit

## App Size Classification

> **Clasificacion: LARGE** — React + FastAPI, JWT auth, 48+ entidades SQL Server, API REST compleja, roles de usuario, sistema agroindustrial.

---

## Project Context

### Descripcion
Sistema de **Segmentacion de Nuevas Especies** para **Garces Fruit**. Gestiona el ciclo completo de evaluacion de variedades fruticolas: desde el ingreso de material vegetal en viveros, pasando por la plantacion en testblocks experimentales, mediciones de laboratorio (brix, firmeza, calibre, acidez), hasta la clasificacion por clusters de calidad y generacion de paquetes tecnologicos.

Actualmente existe como app Streamlit v3.4. Se migra a React + FastAPI manteniendo la misma base de datos SQL Server Azure existente. El documento `MIGRATION_GUIDE_REACT_FASTAPI.md` contiene el DDL completo, endpoints propuestos, componentes y reglas de negocio.

### Usuarios del sistema
- **Admin**: Gestiona usuarios, roles, catalogos, configuracion general. Acceso total.
- **Agronomo**: Gestiona testblocks, inventario, labores. Ve dashboards y analisis.
- **Laboratorio**: Registra mediciones de calidad. Ve resultados y clusters.
- **Operador**: Ejecuta labores en campo. Registra altas/bajas de plantas.
- **Visualizador**: Solo lectura en todo el sistema.

### Entidades principales (48+ tablas en SQL Server Azure)
| Entidad | Descripcion | Relaciones clave |
|---------|-------------|------------------|
| campos | Campo/fundo agricola | 1:N cuarteles, 1:N testblocks |
| cuarteles | Subdivision de campo | N:1 campo, 1:N posiciones |
| especies | Especie frutal (Cerezo, Ciruela, etc.) | 1:N variedades, 1:N estados_fenologicos |
| variedades | Variedad frutal con atributos | N:1 especie, N:1 pmg, N:1 origen |
| portainjertos | Patron de injerto | Usado por posiciones y plantas |
| pmg | Programa Mejoramiento Genetico | 1:N variedades, N:M especies |
| testblocks | Bloque experimental | N:1 campo, 1:N posiciones_testblock |
| posiciones_testblock | Posicion fisica en grilla | 1:1 planta, N:1 testblock |
| plantas | Planta individual en evaluacion | N:1 posicion, 1:N mediciones |
| inventario_vivero | Lotes de material vegetal | 1:N movimientos, 1:N despachos |
| mediciones_laboratorio | Datos de calidad (brix, firmeza, etc.) | N:1 planta, 1:1 clasificacion_cluster |
| usuarios | Usuarios del sistema con roles | Autenticacion JWT + bcrypt |

### Reglas de negocio clave
- No plantar en posicion con planta activa — debe darse de baja primero
- No plantar sin stock disponible — validar `cantidad_actual > 0`
- Baja NO devuelve stock al inventario — la planta se pierde
- `cantidad_actual` no puede ser negativa
- Cada movimiento de inventario queda registrado en `movimientos_inventario`
- Solo eliminar hileras/posiciones vacias — nunca con plantas activas
- Al guardar medicion, auto-trigger clasificacion cluster
- Umbrales de calidad son por especie
- Password almacenado como bcrypt hash
- Todo INSERT/UPDATE/DELETE se loguea en `audit_log`
- Soft delete por defecto (`activo = 0`)

### Flujos principales
1. **Inventario**: Ingreso lotes → registro movimientos → despacho a testblocks → guias de despacho
2. **TestBlock**: Crear testblock → generar posiciones/grilla → alta de plantas desde lote → evaluacion
3. **Laboratorio**: Seleccionar plantas → registrar mediciones → clasificacion cluster automatica
4. **Labores**: Planificar labores → ejecutar en campo → registrar en sistema
5. **Analisis**: Dashboard KPIs → paquetes tecnologicos por variedad/temporada → alertas

---

## Stack

### LARGE App (React + FastAPI)
- **Frontend**: React 18 + TypeScript + TailwindCSS + shadcn/ui + Recharts + @tanstack/react-table + @tanstack/react-query + Zustand
- **Backend**: FastAPI + SQLModel + SQLAlchemy + pyodbc (SQL Server Azure) + python-jose (JWT) + bcrypt
- **Database**: SQL Server Azure (existente, se mantiene tal cual) — Driver: ODBC Driver 17 for SQL Server
- **Testing**: pytest + pytest-cov + httpx (backend) | Vitest + Testing Library (frontend)
- **Security**: bandit + safety + pip-audit + npm audit
- **Docs**: Markdown + Mermaid diagrams
- **Deployment**: Azure App Service + ACR

---

## Project Structure

```
/
├── frontend/                # React app
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   ├── layout/        # Layout (Sidebar, Header, Topbar)
│   │   │   └── shared/        # CrudTable, CrudForm, KpiCard, StatusBadge, etc.
│   │   ├── pages/             # Page components por modulo
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client calls
│   │   ├── stores/            # Zustand stores (auth, testblock, inventario)
│   │   ├── types/             # TypeScript interfaces
│   │   ├── lib/               # Utilities
│   │   └── App.tsx
│   ├── __tests__/
│   │   ├── components/
│   │   └── hooks/
│   ├── package.json
│   └── vite.config.ts
├── backend/                 # FastAPI app
│   ├── app/
│   │   ├── models/            # SQLModel models (48+ entities)
│   │   ├── schemas/           # Pydantic schemas request/response
│   │   ├── routes/            # API endpoints por modulo
│   │   ├── services/          # Business logic
│   │   ├── core/              # Config, security, deps, database engine
│   │   └── main.py
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── conftest.py
│   ├── requirements.txt
│   └── Dockerfile
├── security/
│   ├── reports/
│   ├── .bandit.yml
│   └── security-checklist.md
├── docs/
│   ├── technical/
│   └── user-manual/
│       └── features/
├── infra/
│   ├── azure/
│   ├── .env.template
│   └── deploy.sh
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── docker-compose.yml
├── CLAUDE.md
├── CLAUDE-TEMPLATE.md
└── MIGRATION_GUIDE_REACT_FASTAPI.md
```

---

## Key Reference

El archivo `MIGRATION_GUIDE_REACT_FASTAPI.md` contiene:
- DDL completo de las 48+ tablas (secciones 2.1 a 2.6)
- Diagrama ER y relaciones (seccion 3)
- Endpoints API propuestos (seccion 4)
- Rutas y componentes React (seccion 5)
- Reglas de negocio criticas (seccion 6)
- Volumetria actual (seccion 7)
- Constantes y configuracion (seccion 8)
- Dependencias propuestas (seccion 9)

**IMPORTANTE**: Todos los agentes deben leer este archivo antes de comenzar su trabajo.

---

## Agent Team Configuration

### Team: garces-segmentacion (LARGE mode)

**8 teammates**: backend, frontend, tech-docs, user-docs, cybersecurity, qa, testing, deployment

---

### Teammate L1: frontend
- **Role**: Frontend Developer — React + TypeScript
- **Scope**: SOLO archivos dentro de `/frontend`
- **Responsibilities**:
  - Crear componentes React funcionales con hooks
  - Implementar paginas y routing con React Router (estructura de rutas en MIGRATION_GUIDE seccion 5.1)
  - Crear servicios API client en `/frontend/src/services/` usando fetch
  - Definir types/interfaces TypeScript que mapeen a los schemas del backend
  - Implementar componentes reutilizables (seccion 5.2 del MIGRATION_GUIDE): CrudTable, CrudForm, DataGrid, KpiCard, StatusBadge, etc.
  - Usar TailwindCSS + shadcn/ui para estilos
  - Integrar Recharts para dashboards y analisis
  - Integrar @tanstack/react-table para tablas de datos
  - Manejar estado servidor con @tanstack/react-query, estado cliente con Zustand (stores seccion 5.3)
  - Tema: colores agricolas, profesional, logo Garces Fruit
- **Conventions**:
  - Componentes: PascalCase, un componente por archivo
  - Hooks custom: `use` prefix, en `/hooks`
  - API calls: centralizar en `/services/api.ts` con tipos de respuesta
  - Usar variables de entorno para API_BASE_URL
- **Restrictions**:
  - NO modificar nada fuera de `/frontend`

---

### Teammate L2: backend
- **Role**: Backend Developer — FastAPI + SQLModel + SQL Server
- **Scope**: SOLO archivos dentro de `/backend` y `docker-compose.yml`
- **Responsibilities**:
  - Implementar modelos SQLModel basados en el DDL de MIGRATION_GUIDE seccion 2 (48+ tablas)
  - Crear schemas Pydantic para request/response (schemas/)
  - Implementar todos los endpoints de MIGRATION_GUIDE seccion 4 (auth, mantenedores, inventario, testblock, laboratorio, labores, analisis, alertas, sistema)
  - Separar logica de negocio en services/ (reglas seccion 6)
  - Configurar conexion a SQL Server Azure con pyodbc + SQLAlchemy
  - Implementar autenticacion JWT con bcrypt en core/
  - Implementar audit middleware para logging automatico
  - Crear CRUD generico reutilizable para mantenedores
  - docker-compose.yml para desarrollo local
- **Conventions**:
  - Models: SQLModel classes, PK como INT IDENTITY (no UUID — BD existente)
  - Tables: nombres tal cual en la BD existente (paises, campos, especies, etc.)
  - Endpoints: RESTful — GET/POST/PUT/DELETE con prefijo `/api/v1/`
  - Soft delete con campo `activo` (BIT)
  - Campos de auditoria: fecha_creacion, fecha_modificacion, usuario_creacion, usuario_modificacion
- **Restrictions**:
  - NO modificar nada fuera de `/backend` y `docker-compose.yml`
  - NO crear migraciones Alembic — la BD ya existe en SQL Server Azure
  - Usar pyodbc para la conexion, NO psycopg2

---

### Teammate C1: tech-docs
- **Role**: Technical Documentation Writer
- **Scope**: SOLO archivos dentro de `/docs/technical`
- **Output files**:
  - `docs/technical/architecture.md`
  - `docs/technical/database.md`
  - `docs/technical/api-reference.md`
  - `docs/technical/setup.md`
  - `docs/technical/auth.md`
  - `docs/technical/decisions.md`
  - `docs/technical/security.md`
  - `docs/technical/testing.md`
  - `docs/technical/deployment.md`

---

### Teammate C2: user-docs
- **Role**: User Documentation / Manual Writer
- **Scope**: SOLO archivos dentro de `/docs/user-manual`
- **Output files**:
  - `docs/user-manual/README.md`
  - `docs/user-manual/getting-started.md`
  - `docs/user-manual/features/` (un archivo por modulo)
  - `docs/user-manual/faq.md`
  - `docs/user-manual/troubleshooting.md`

---

### Teammate C3: cybersecurity
- **Role**: Security Engineer — AppSec, Dependency Audit, Hardening
- **Scope**: Lectura de TODOS los archivos + escritura en `/security`
- **Output files**:
  - `security/reports/dependency-audit.md`
  - `security/reports/static-analysis.md`
  - `security/reports/owasp-review.md`
  - `security/security-checklist.md`
  - `security/.bandit.yml`

---

### Teammate C4: qa
- **Role**: QA Engineer — Test Planning & Test Design
- **Scope**: Lectura de TODO + escritura en `/backend/tests/` y `/frontend/__tests__/`
- **Conventions**:
  - Naming: `test_<modulo>_<escenario>_<resultado_esperado>`
  - AAA pattern: Arrange -> Act -> Assert
  - Minimo 80% cobertura en services/ y routes/
  - Minimo 70% cobertura en componentes React

---

### Teammate C5: testing
- **Role**: Test Runner & Quality Gate
- **Scope**: Ejecucion de tests + escritura en `/security/reports/`
- **Output files**:
  - `security/reports/test-results-backend.md`
  - `security/reports/test-results-frontend.md`
  - `security/reports/quality-gate.md`

---

### Teammate C6: deployment
- **Role**: DevOps / Cloud Engineer — Azure Deployment
- **Scope**: `/infra/`, `/.github/workflows/`, `docker-compose.yml`, Dockerfiles
- **Output files**:
  - `infra/azure/main.bicep`
  - `infra/azure/parameters.dev.json`
  - `infra/azure/parameters.prod.json`
  - `infra/.env.template`
  - `infra/deploy.sh`
  - `infra/README.md`
  - `.github/workflows/ci.yml`
  - `.github/workflows/cd.yml`
  - `backend/Dockerfile`
  - `frontend/Dockerfile`
  - `docker-compose.yml`
  - `.dockerignore`

---

## Task Dependencies (LARGE App)

### Fases de ejecucion

**Fase 1 — Fundacion (paralelo)**:
1. backend define models, schemas y endpoints basados en MIGRATION_GUIDE
2. cybersecurity audita dependencias y config inicial
3. tech-docs documenta arquitectura general

**Fase 2 — Desarrollo (paralelo)**:
4. frontend consume endpoints y crea UI
5. cybersecurity revisa codigo backend
6. tech-docs documenta endpoints y auth

**Fase 3 — Calidad (secuencial con retroalimentacion)**:
7. qa disena tests
8. testing ejecuta y reporta
9. backend/frontend corrigen bugs
10. testing re-ejecuta hasta quality gate PASS

**Fase 4 — Deployment files**:
11. cybersecurity aprueba security checklist
12. testing confirma quality gate PASS
13. deployment genera Dockerfiles, CI/CD, Bicep
14. user-docs documenta flujos finales

---

## General Rules (all teammates)
- Escribir codigo limpio, con type hints y docstrings
- Commits semanticos: feat:, fix:, docs:, refactor:, test:, security:, ci:
- NO modificar archivos fuera de tu scope asignado
- Comunicar via task list cuando completes algo que otro teammate necesita
- NUNCA hardcodear secrets, tokens, passwords o connection strings en codigo
- Idioma principal: Espanol
- LEER `MIGRATION_GUIDE_REACT_FASTAPI.md` como referencia principal
