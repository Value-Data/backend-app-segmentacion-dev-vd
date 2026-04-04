# Guia de Instalacion y Configuracion

## Sistema de Segmentacion de Nuevas Especies - Garces Fruit

---

## 1. Prerequisitos

### Software requerido

| Software | Version minima | Proposito |
|----------|---------------|-----------|
| Python | 3.11+ | Backend FastAPI |
| Node.js | 20+ | Frontend React |
| npm | 10+ | Gestor de paquetes frontend |
| ODBC Driver 17 for SQL Server | 17.x | Conexion a SQL Server Azure |
| Docker + Docker Compose | 24+ / 2.x | Despliegue containerizado (opcional) |
| Git | 2.x | Control de versiones |

### Instalacion de ODBC Driver 17

**Windows**:
Descargar desde [Microsoft ODBC Driver](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server) e instalar el .msi.

**Linux (Ubuntu/Debian)**:
```bash
curl https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc
sudo add-apt-repository "$(curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list)"
sudo apt-get update
sudo apt-get install -y msodbcsql17 unixodbc-dev
```

**macOS**:
```bash
brew install microsoft/mssql-release/msodbcsql17
```

---

## 2. Variables de Entorno

Crear archivo `.env` en la raiz del proyecto backend:

```env
# Base de datos
DB_SERVER=tcp:valuedata.database.windows.net,1433
DB_NAME=valuedatadev_2026-01-29T01-40Z
DB_USER=<usuario_db>
DB_PASSWORD=<password_db>
DB_DRIVER=ODBC Driver 17 for SQL Server

# JWT
JWT_SECRET_KEY=<clave_secreta_larga_y_aleatoria>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=480

# App
APP_NAME=Sistema Segmentacion Especies
APP_VERSION=3.4.0
CURRENT_SEASON=2024-2025
DEBUG=false

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Connection Pool
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_RECYCLE=1800
```

Para el frontend, crear `.env` en `/frontend`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

**IMPORTANTE**: Nunca commitear archivos `.env` al repositorio. Agregar `.env` al `.gitignore`.

---

## 3. Setup del Backend

### 3.1 Clonar el repositorio
```bash
git clone <repo_url>
cd agente-segmentacion
```

### 3.2 Crear entorno virtual
```bash
cd backend
python -m venv venv
```

### 3.3 Activar entorno virtual

**Windows**:
```bash
venv\Scripts\activate
```

**Linux/macOS**:
```bash
source venv/bin/activate
```

### 3.4 Instalar dependencias
```bash
pip install -r requirements.txt
```

### 3.5 Verificar conexion a base de datos
```bash
python -c "from app.database.engine import engine; print('Conexion OK')"
```

### 3.6 Ejecutar el servidor
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estara disponible en `http://localhost:8000`.
La documentacion interactiva de la API en `http://localhost:8000/docs` (Swagger UI).

---

## 4. Setup del Frontend

### 4.1 Instalar dependencias
```bash
cd frontend
npm install
```

### 4.2 Ejecutar en modo desarrollo
```bash
npm run dev
```

El frontend estara disponible en `http://localhost:5173`.

### 4.3 Build de produccion
```bash
npm run build
```

Los archivos estaticos se generan en `frontend/dist/`.

---

## 5. Setup con Docker

### 5.1 Construir y levantar todos los servicios
```bash
docker-compose up --build
```

Esto levanta:
- **backend**: FastAPI en puerto 8000
- **frontend**: React (servido por nginx) en puerto 80

### 5.2 Solo backend
```bash
docker-compose up backend
```

### 5.3 Solo frontend
```bash
docker-compose up frontend
```

### 5.4 Detener servicios
```bash
docker-compose down
```

---

## 6. Conexion a Base de Datos

El sistema se conecta a una base de datos SQL Server Azure existente. No se requiere crear la base de datos ni ejecutar migraciones para el esquema actual.

### Connection string
El engine de SQLAlchemy se configura automaticamente desde las variables de entorno:

```
mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}/{DB_NAME}?driver={DB_DRIVER}&TrustServerCertificate=yes
```

### Pool de conexiones
- **pool_size**: 5 conexiones base
- **max_overflow**: 10 conexiones adicionales bajo demanda
- **pool_recycle**: 1800 segundos (30 minutos) - reconecta conexiones viejas
- **pool_pre_ping**: true - verifica la conexion antes de usarla

### Verificar acceso
```bash
# Desde la maquina local
sqlcmd -S tcp:valuedata.database.windows.net,1433 -U <usuario> -P <password> -d <database> -Q "SELECT COUNT(*) FROM variedades"
```

---

## 7. Estructura de Directorios

```
agente-segmentacion/
├── backend/
│   ├── app/
│   │   ├── main.py              # Entry point FastAPI
│   │   ├── config.py            # Configuracion desde .env
│   │   ├── database/
│   │   │   ├── engine.py        # SQLAlchemy engine + session
│   │   │   ├── models.py        # SQLModel entities (~48 clases)
│   │   │   └── repositories.py  # Queries cacheadas
│   │   ├── api/                 # Endpoints por modulo
│   │   │   ├── auth.py
│   │   │   ├── mantenedores.py
│   │   │   ├── inventario.py
│   │   │   ├── testblock.py
│   │   │   ├── laboratorio.py
│   │   │   ├── labores.py
│   │   │   ├── analisis.py
│   │   │   └── sistema.py
│   │   ├── schemas/             # Pydantic request/response
│   │   ├── services/            # Logica de negocio
│   │   └── middleware/          # Auth, audit, CORS
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── lib/
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── .env
├── docs/
│   └── technical/
├── docker-compose.yml
└── CLAUDE.md
```

---

## 8. Comandos Utiles

### Backend
```bash
# Ejecutar servidor de desarrollo
uvicorn app.main:app --reload --port 8000

# Ejecutar tests
pytest

# Ejecutar tests con cobertura
pytest --cov=app --cov-report=html

# Ver documentacion API
# Abrir http://localhost:8000/docs
```

### Frontend
```bash
# Desarrollo
npm run dev

# Build produccion
npm run build

# Preview build local
npm run preview

# Ejecutar tests
npm run test

# Lint
npm run lint
```

### Docker
```bash
# Construir imagenes
docker-compose build

# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f backend

# Detener
docker-compose down
```
