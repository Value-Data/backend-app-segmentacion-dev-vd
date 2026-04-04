# Guia de Deploy en Azure App Service

## Arquitectura

```
Frontend (Node 20 LTS)          Backend (Python 3.11)
appsegmentacion.azurewebsites.net  backendsegmentacion-xxx.azurewebsites.net
        |                                  |
        |  VITE_API_BASE_URL ───────────>  |
        |                                  |
     serve -s dist (estatico)         uvicorn app.main:app
                                           |
                                    SQL Server Azure
```

---

## Backend (FastAPI + Python)

### Repositorio
`https://github.com/Value-Data/backend-app-segmentacion-dev-vd`

### Estructura del repo
```
/
├── app/
│   ├── core/        # config, database, security, deps
│   ├── models/      # SQLModel (48+ tablas)
│   ├── routes/      # Endpoints API
│   ├── schemas/     # Pydantic request/response
│   ├── services/    # Logica de negocio
│   └── main.py      # FastAPI app
├── tests/
├── requirements.txt
├── Dockerfile
└── .env.example
```

### Configuracion App Service

| Campo | Valor |
|-------|-------|
| **Stack** | Python |
| **Version** | Python 3.11 |
| **Startup Command** | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |

### Application Settings (Variables de entorno)

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `DB_SERVER` | `tcp:tu-server.database.windows.net,1433` | Servidor SQL Azure |
| `DB_NAME` | `nombre_base_datos` | Nombre de la BD |
| `DB_USER` | `usuario_bd` | Usuario SQL |
| `DB_PASSWORD` | `password_bd` | Password SQL |
| `DB_DRIVER` | `ODBC Driver 17 for SQL Server` | Driver ODBC (ya incluido en Azure Linux) |
| `JWT_SECRET_KEY` | `(string aleatorio de 64 chars)` | Generar con: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ALGORITHM` | `HS256` | Algoritmo JWT |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | 8 horas de sesion |
| `CORS_ORIGINS` | `https://tu-frontend.azurewebsites.net,http://localhost:3100` | URLs del frontend permitidas |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` | Azure ejecuta `pip install -r requirements.txt` automaticamente |
| `CURRENT_SEASON` | `2024-2025` | Temporada activa |

### Deploy
1. Azure Portal → App Service → **Deployment Center**
2. Source: **GitHub**
3. Organization: `Value-Data`
4. Repository: `backend-app-segmentacion-dev-vd`
5. Branch: `main`
6. Guardar

Azure crea un GitHub Actions workflow automaticamente que hace deploy en cada push a main.

### Verificacion
- URL base: `https://tu-backend.azurewebsites.net/`
- Swagger docs: `https://tu-backend.azurewebsites.net/api/docs`
- Health check: debe retornar `{"app": "Garces Fruit - Segmentacion", ...}`

### Notas importantes
- El puerto DEBE ser **8000** — Azure redirige trafico externo (443) al 8000 interno
- ODBC Driver 17 ya viene instalado en las imagenes Linux de Azure
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true` hace que Oryx instale dependencias automaticamente
- La BD SQL Server Azure debe tener el firewall abierto para las IPs de Azure App Service

---

## Frontend (React + Vite)

### Repositorio
`https://github.com/Value-Data/frontend_app_segmentacion_vd`

### Estructura del repo
```
/
├── src/
│   ├── components/    # UI components (shadcn/ui, shared, layout)
│   ├── pages/         # Paginas por modulo
│   ├── hooks/         # Custom React hooks
│   ├── services/      # API client (fetch)
│   ├── stores/        # Zustand state
│   ├── types/         # TypeScript interfaces
│   ├── config/        # Species config, etc
│   └── App.tsx
├── dist/              # Build compilado (se genera en CI)
├── package.json
├── vite.config.ts
└── .github/workflows/main_appsegmentacion.yml
```

### Configuracion App Service

| Campo | Valor |
|-------|-------|
| **Stack** | Node |
| **Version** | Node 20 LTS |
| **Startup Command** | `npx serve -s dist -l 8080` |

### Application Settings (Variables de entorno)

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `VITE_API_BASE_URL` | `https://tu-backend.azurewebsites.net/api/v1` | URL completa del backend API |

**IMPORTANTE:** `VITE_API_BASE_URL` se inyecta en **compile time** (no runtime). Debe estar configurada como variable de entorno en el workflow de GitHub Actions, NO solo en App Service.

### GitHub Actions Workflow

El workflow `.github/workflows/main_appsegmentacion.yml` debe incluir:

```yaml
env:
  VITE_API_BASE_URL: https://tu-backend.azurewebsites.net/api/v1

jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      - run: |
          npm install --legacy-peer-deps
          npm run build
```

- `--legacy-peer-deps` es necesario porque `react-leaflet@5` requiere React 19 pero usamos React 18
- El build genera la carpeta `dist/` con archivos estaticos
- Solo `dist/` se despliega a Azure (no node_modules ni src)

### Deploy
1. Azure Portal → App Service → **Deployment Center**
2. Source: **GitHub**
3. Organization: `Value-Data`
4. Repository: `frontend_app_segmentacion_vd`
5. Branch: `main`
6. Azure genera automaticamente el workflow de GitHub Actions
7. **Editar el workflow** para agregar `VITE_API_BASE_URL` como env variable y `--legacy-peer-deps`

### Verificacion
- Abrir la URL del frontend
- Debe mostrar la pagina de login
- Al hacer login, debe conectar al backend y mostrar el dashboard

### Notas importantes
- El startup command `npx serve -s dist -l 8080` sirve archivos estaticos
- Puerto **8080** — Azure Node apps usan 8080 por defecto
- `serve -s` maneja SPA routing (redirige todas las rutas a index.html)
- Si `npx serve` no esta instalado, se descarga automaticamente (~5 segundos la primera vez)

---

## CORS: Conexion Frontend ↔ Backend

El backend debe permitir requests del frontend. Verificar:

1. **Backend** → Application Settings → `CORS_ORIGINS` debe incluir la URL exacta del frontend (sin trailing slash)
2. **Azure Portal** → Backend App Service → **CORS** blade → agregar la URL del frontend como allowed origin
3. El backend ya configura CORS en `app/main.py` usando la variable `CORS_ORIGINS`

Ejemplo:
```
CORS_ORIGINS=https://appsegmentacion.azurewebsites.net,http://localhost:3100,http://localhost:5173
```

---

## Troubleshooting

### Backend no conecta a SQL Server
- Verificar que el firewall de SQL Server permite IPs de Azure ("Allow Azure services")
- Verificar credenciales en Application Settings
- Log: `create_tables skipped: (pyodbc.OperationalError)` = problema de conexion

### Frontend muestra 401 en login
- `VITE_API_BASE_URL` no configurado → requests van al mismo dominio del frontend
- Solucion: agregar la variable al workflow de GitHub Actions y re-deployar

### Frontend muestra pagina en blanco
- Startup command incorrecto → verificar que sea `npx serve -s dist -l 8080`
- `dist/` no existe → el build fallo en GitHub Actions

### npm install falla con "idealTree already exists"
- Cache corrupto de npm en Azure
- Fix: cambiar startup a `rm -rf /root/.npm && npx serve -s dist -l 8080`
- Solo necesario una vez

### npm install falla con ERESOLVE peer dependency
- Agregar `--legacy-peer-deps` al `npm install` en el workflow
