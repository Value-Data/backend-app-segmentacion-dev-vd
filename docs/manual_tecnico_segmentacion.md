# Manual Tecnico - Sistema de Segmentacion de Nuevas Especies v4.0

**Empresa:** Garces Fruit / Value Data

**Fecha:** Abril 2026

**Version del documento:** 4.0

**Clasificacion:** Documento interno - Uso exclusivo del equipo de desarrollo

---

## Tabla de Contenidos

1. Descripcion General del Sistema
2. Arquitectura del Sistema
3. Stack Tecnologico
4. Requisitos del Sistema
5. Instalacion y Configuracion
6. Estructura del Proyecto
7. Modulos Funcionales
8. API REST - Endpoints
9. Esquema de Base de Datos
10. Autenticacion y Autorizacion
11. Algoritmo de Clustering (Band-Sum)
12. Integracion con Azure OpenAI
13. CI/CD y Despliegue
14. Testing
15. Monitoreo y Observabilidad
16. Resolucion de Problemas
17. Glosario

---

## 1. Descripcion General del Sistema

### 1.1 Proposito

El Sistema de Segmentacion de Nuevas Especies es una plataforma integral desarrollada para Garces Fruit que permite gestionar el ciclo de vida completo de nuevas variedades frutales, desde su ingreso en vivero hasta su evaluacion en testblocks de campo. El sistema abarca la gestion de inventario, mediciones de laboratorio, clasificacion por calidad mediante algoritmos de clustering, planificacion de labores agricolas, alertas automatizadas y generacion de reportes con analisis asistido por inteligencia artificial.

### 1.2 Alcance

El sistema cubre las siguientes areas funcionales:

- **Mantenedores maestros:** Administracion de entidades base como especies, variedades, campos, cuarteles, portainjertos, viveros, entre otros
- **Inventario de vivero:** Control de stock de plantas, movimientos de entrada y salida, guias de despacho y generacion de codigos QR
- **Testblocks:** Gestion de bloques de prueba en campo, asignacion de posiciones, operaciones de alta, baja y replante de plantas
- **Laboratorio:** Registro de mediciones de calidad (Brix, acidez, firmeza, calibre), clasificacion automatica por clusters y analisis estadistico
- **Labores agricolas:** Planificacion y ejecucion de labores de campo, registro fenologico y ordenes de trabajo
- **Analisis y reportes:** Dashboards con KPIs, reportes en PDF y Excel, recomendaciones generadas por IA
- **Alertas:** Motor de reglas configurable para notificaciones automatizadas
- **Administracion:** Gestion de usuarios, roles, auditoria y configuracion del sistema

### 1.3 Usuarios del Sistema

| Rol | Descripcion | Permisos principales |
|-----|------------|----------------------|
| admin | Administrador del sistema | Acceso total, gestion de usuarios y configuracion |
| agronomo | Profesional agronomico | Testblocks, labores, analisis, reportes |
| laboratorio | Analista de laboratorio | Mediciones, clasificacion, muestras |
| operador | Operador de campo/vivero | Inventario, operaciones basicas de testblock |
| visualizador | Usuario de solo lectura | Consulta de dashboards y reportes |

---

## 2. Arquitectura del Sistema

### 2.1 Vision General

El sistema sigue una arquitectura cliente-servidor de tres capas desplegada sobre Microsoft Azure. El frontend es una Single Page Application (SPA) construida con React que se comunica con un backend API REST desarrollado en FastAPI. La persistencia de datos se realiza sobre Azure SQL Server.

### 2.2 Diagrama de Arquitectura

    +--------------------------------------------------+
    |                   CLIENTE                         |
    |  Navegador Web (Chrome, Firefox, Edge, Safari)    |
    +---------------------------+----------------------+
                                |
                          HTTPS / JWT
                                |
    +---------------------------v----------------------+
    |              AZURE APP SERVICE                    |
    |  +---------------------------------------------+ |
    |  |  Frontend (Nginx + React SPA)               | |
    |  |  Puerto 80                                  | |
    |  +---------------------------------------------+ |
    |                                                   |
    |  +---------------------------------------------+ |
    |  |  Backend (FastAPI + Uvicorn)                 | |
    |  |  Puerto 8000                                | |
    |  |  backendsegmentacion.azurewebsites.net       | |
    |  +---------------------------------------------+ |
    +---------------------------+----------------------+
                                |
                        pyodbc + ODBC 17
                                |
    +---------------------------v----------------------+
    |              AZURE SQL SERVER                     |
    |  Base de datos relacional                        |
    |  48+ tablas en 7 dominios                        |
    +--------------------------------------------------+
                                |
    +---------------------------v----------------------+
    |              AZURE OPENAI                         |
    |  GPT-4o para recomendaciones y analisis           |
    +--------------------------------------------------+

### 2.3 Diagrama de Flujo de Datos

    Usuario --> React SPA --> API REST (FastAPI)
                                   |
                    +--------------+--------------+
                    |              |              |
              Azure SQL      Azure OpenAI    Filesystem
              (datos)        (analisis IA)   (reportes)

### 2.4 Patron de Comunicacion

- El frontend realiza peticiones HTTP a la API REST bajo el prefijo `/api/v1`
- Todas las peticiones (excepto login y health) requieren un token JWT en el header `Authorization: Bearer <token>`
- Las respuestas siguen el formato JSON estandar
- El manejo de errores utiliza codigos HTTP semanticos (400, 401, 403, 404, 422, 500)
- CORS esta configurado mediante la variable de entorno `CORS_ORIGINS`

---

## 3. Stack Tecnologico

### 3.1 Frontend

| Tecnologia | Version | Proposito |
|-----------|---------|-----------|
| React | 18.3.1 | Framework de interfaz de usuario |
| TypeScript | 5.7.2 | Tipado estatico |
| Vite | 6.0.5 | Herramienta de build y servidor de desarrollo (puerto 3100) |
| Zustand | 5.0.0 | Gestion de estado global (autenticacion) |
| TanStack Query | 5.62.0 | Gestion de estado del servidor, cache y sincronizacion |
| TanStack Table | 8.20.0 | Tablas de datos con paginacion, filtrado y ordenamiento |
| shadcn/ui | - | Componentes de interfaz basados en Radix UI |
| Radix UI | - | Componentes accesibles sin estilo |
| TailwindCSS | 3.4.17 | Framework de utilidades CSS |
| Lucide React | 0.468.0 | Libreria de iconos |
| Recharts | 2.15.0 | Graficos y visualizaciones de datos |
| Leaflet | 1.9.4 | Mapas interactivos |
| react-leaflet | 4.2.1 | Integracion de Leaflet con React |
| xlsx | 0.18.5 | Importacion y exportacion de archivos Excel |
| Vitest | 2.1.8 | Framework de testing |
| Testing Library | - | Utilidades de testing para React |

### 3.2 Backend

| Tecnologia | Version | Proposito |
|-----------|---------|-----------|
| Python | 3.11 | Lenguaje de programacion |
| FastAPI | 0.109.0+ | Framework web asincrono |
| SQLModel | 0.0.22 | ORM (combina Pydantic + SQLAlchemy) |
| Uvicorn | - | Servidor ASGI |
| python-jose | - | Generacion y validacion de tokens JWT |
| bcrypt | - | Hash de contrasenas |
| pyodbc | - | Conexion con SQL Server via ODBC |
| reportlab | - | Generacion de reportes en PDF |
| openpyxl | - | Generacion de reportes en Excel |
| qrcode | - | Generacion de codigos QR para etiquetas |
| Azure OpenAI SDK | - | Integracion con GPT-4o |

### 3.3 Infraestructura

| Componente | Servicio |
|-----------|----------|
| Contenedores | Docker + docker-compose |
| Registro de contenedores | Azure Container Registry (garcesacr.azurecr.io) |
| Hosting | Azure App Service |
| Base de datos | Azure SQL Server |
| IA | Azure OpenAI (GPT-4o) |
| CI/CD | GitHub Actions |
| Control de versiones | GitHub |

---

## 4. Requisitos del Sistema

### 4.1 Requisitos para Desarrollo Local

**Hardware minimo:**

- Procesador: 4 nucleos
- Memoria RAM: 8 GB
- Almacenamiento: 20 GB libres

**Software requerido:**

- Node.js 18+ y npm 9+
- Python 3.11+
- Docker Desktop 4.x+ y Docker Compose
- Git 2.40+
- ODBC Driver 17 for SQL Server
- Editor de codigo (recomendado: Visual Studio Code)

### 4.2 Requisitos para Produccion

- Azure App Service Plan (B2 o superior)
- Azure SQL Database (S2 o superior)
- Azure Container Registry (Basic o superior)
- Azure OpenAI con despliegue de GPT-4o
- Certificado SSL/TLS

### 4.3 Navegadores Soportados

- Google Chrome 90+
- Mozilla Firefox 90+
- Microsoft Edge 90+
- Safari 15+

---

## 5. Instalacion y Configuracion

### 5.1 Configuracion del Entorno de Desarrollo Local

#### 5.1.1 Clonar los Repositorios

Se debe clonar el monorepo del frontend (que incluye tambien el backend en su estructura) y el repositorio independiente del backend:

    git clone https://github.com/[org]/frontend_app_segmentacion_vd.git
    git clone https://github.com/[org]/backend-app-segmentacion-dev-vd.git

#### 5.1.2 Configurar el Frontend

Navegar al directorio del frontend e instalar las dependencias:

    cd frontend_app_segmentacion_vd
    npm install

Crear el archivo `.env` en la raiz del proyecto frontend con las siguientes variables:

    VITE_API_URL=http://localhost:8000/api/v1
    VITE_APP_NAME=Segmentacion de Nuevas Especies
    VITE_APP_VERSION=4.0

Iniciar el servidor de desarrollo:

    npm run dev

El frontend estara disponible en `http://localhost:3100`.

#### 5.1.3 Configurar el Backend

Navegar al directorio del backend y crear un entorno virtual:

    cd backend-app-segmentacion-dev-vd
    python -m venv venv
    source venv/bin/activate        # Linux/macOS
    venv\Scripts\activate           # Windows

Instalar las dependencias:

    pip install -r requirements.txt

Crear el archivo `.env` en la raiz del proyecto backend con las siguientes variables:

    # Base de datos
    DB_SERVER=localhost
    DB_NAME=segmentacion_dev
    DB_USER=sa
    DB_PASSWORD=<password_seguro>
    DB_DRIVER=ODBC+Driver+17+for+SQL+Server

    # JWT
    JWT_SECRET_KEY=<clave_secreta_aleatoria_256_bits>
    JWT_ALGORITHM=HS256
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES=480

    # CORS
    CORS_ORIGINS=http://localhost:3100

    # Aplicacion
    APP_NAME=Segmentacion de Nuevas Especies
    APP_VERSION=4.0
    COMPANY_NAME=Garces Fruit
    CURRENT_SEASON=2025-2026
    DEBUG=true

    # Umbrales de calidad
    BRIX_MIN=10.0
    BRIX_MAX=22.0
    FIRMEZA_MIN=1.0
    FIRMEZA_MAX=12.0
    ACIDEZ_MIN=0.3
    ACIDEZ_MAX=2.5
    CALIBRE_OPTIMO=55

    # Azure OpenAI
    AZURE_OPENAI_API_KEY=<api_key>
    AZURE_OPENAI_ENDPOINT=<endpoint_url>
    AZURE_OPENAI_DEPLOYMENT=gpt-4o
    AZURE_OPENAI_API_VERSION=2024-02-15-preview

    # Alertas
    DAYS_WITHOUT_REGISTRY_WARNING=15
    LOW_STOCK_THRESHOLD_PCT=20

Iniciar el servidor de desarrollo:

    uvicorn app.main:app --reload --port 8000

El backend estara disponible en `http://localhost:8000`. La documentacion interactiva de la API se encuentra en `http://localhost:8000/docs` (Swagger UI) y `http://localhost:8000/redoc` (ReDoc).

#### 5.1.4 Instalar ODBC Driver 17

**Windows:**

Descargar e instalar desde el sitio oficial de Microsoft el "Microsoft ODBC Driver 17 for SQL Server".

**Linux (Ubuntu/Debian):**

    curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
    curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list > /etc/apt/sources.list.d/mssql-release.list
    apt-get update
    ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev

**macOS:**

    brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
    brew update
    HOMEBREW_ACCEPT_EULA=Y brew install msodbcsql17

### 5.2 Instalacion con Docker

#### 5.2.1 Docker Compose para Desarrollo Local

El proyecto incluye un archivo `docker-compose.yml` que orquesta todos los servicios necesarios:

    docker-compose up --build

Este comando levanta los siguientes servicios:

| Servicio | Puerto | Descripcion |
|----------|--------|-------------|
| frontend | 80 | Aplicacion React servida por Nginx |
| backend | 8000 | API FastAPI con Uvicorn |

> **Nota:** La base de datos Azure SQL Server no se ejecuta localmente via Docker. Para desarrollo local se puede utilizar una instancia de SQL Server en Docker agregando el servicio correspondiente al archivo `docker-compose.yml`.

#### 5.2.2 Dockerfile del Frontend

El Dockerfile del frontend sigue un patron multi-stage:

- **Etapa 1 (build):** Utiliza una imagen de Node.js para compilar la aplicacion React con Vite, generando los archivos estaticos optimizados
- **Etapa 2 (produccion):** Utiliza una imagen de Nginx para servir los archivos estaticos compilados en el puerto 80

#### 5.2.3 Dockerfile del Backend

El Dockerfile del backend:

- Utiliza la imagen base `python:3.11-slim`
- Instala el ODBC Driver 17 for SQL Server y las dependencias del sistema
- Instala las dependencias de Python desde `requirements.txt`
- Copia el codigo de la aplicacion
- Expone el puerto 8000
- Ejecuta Uvicorn como servidor ASGI

### 5.3 Despliegue en Produccion (Azure)

#### 5.3.1 Prerequisitos

- Suscripcion de Azure activa
- Azure CLI instalado y autenticado
- Acceso al Azure Container Registry (`garcesacr.azurecr.io`)
- Azure App Service configurado

#### 5.3.2 Proceso de Despliegue

El despliegue a produccion se realiza de forma automatizada mediante GitHub Actions (ver seccion 13). El flujo general es:

1. Se hace push o merge a la rama principal del repositorio
2. GitHub Actions ejecuta el pipeline de CI (linting, tests)
3. Si CI es exitoso, se ejecuta el pipeline de CD
4. Se construye la imagen Docker
5. Se publica la imagen en Azure Container Registry
6. Se despliega la imagen en Azure App Service

#### 5.3.3 Variables de Entorno en Azure

Las variables de entorno de produccion se configuran en la seccion "Configuration" del Azure App Service. Deben configurarse todas las variables listadas en la seccion 5.1.3, ajustando los valores para el entorno de produccion:

- `DEBUG` debe ser `false`
- `CORS_ORIGINS` debe apuntar al dominio de produccion del frontend
- `DB_SERVER` debe apuntar al servidor Azure SQL de produccion
- `JWT_SECRET_KEY` debe ser una clave unica y segura generada para produccion

---

## 6. Estructura del Proyecto

### 6.1 Estructura del Frontend

    src/
    |
    +-- components/
    |   +-- ui/                     Componentes base de shadcn/ui
    |   |   +-- button.tsx
    |   |   +-- dialog.tsx
    |   |   +-- input.tsx
    |   |   +-- label.tsx
    |   |   +-- select.tsx
    |   |   +-- tabs.tsx
    |   |   +-- tooltip.tsx
    |   |
    |   +-- layout/                 Componentes de estructura
    |   |   +-- AppLayout.tsx       Layout principal de la aplicacion
    |   |   +-- Header.tsx          Barra superior con navegacion
    |   |   +-- Sidebar.tsx         Menu lateral de navegacion
    |   |
    |   +-- shared/                 Componentes reutilizables
    |   |   +-- CrudTable.tsx       Tabla generica con operaciones CRUD
    |   |   +-- CrudForm.tsx        Formulario generico para CRUD
    |   |   +-- DataGrid.tsx        Grilla de datos avanzada
    |   |   +-- KpiCard.tsx         Tarjeta de indicador clave
    |   |   +-- ChartContainer.tsx  Contenedor para graficos
    |   |   +-- StatusBadge.tsx     Insignia de estado visual
    |   |   +-- BulkImport.tsx      Componente de importacion masiva
    |   |   +-- PlantCard.tsx       Tarjeta de informacion de planta
    |   |   +-- MapView.tsx         Vista de mapa con Leaflet
    |   |   +-- TimelineHistory.tsx Linea de tiempo de historial
    |   |   +-- RelationshipChips.tsx Chips de relaciones entre entidades
    |   |
    |   +-- inventario/
    |   |   +-- PlantWizard.tsx     Asistente paso a paso para plantas
    |   |
    |   +-- labores/
    |       +-- LaborCalendar.tsx   Calendario de labores agricolas
    |
    +-- pages/                      39 paginas organizadas por modulo
    |   +-- mantenedores/           18 paginas de datos maestros
    |   |   +-- EspeciesPage.tsx
    |   |   +-- VariedadesPage.tsx
    |   |   +-- CamposPage.tsx
    |   |   +-- CuartelesPage.tsx
    |   |   +-- PortainjertosPage.tsx
    |   |   +-- ViverosPage.tsx
    |   |   +-- ColoresPage.tsx
    |   |   +-- OrigenesPage.tsx
    |   |   +-- PmgsPage.tsx
    |   |   +-- BodegasPage.tsx
    |   |   +-- CatalogosPage.tsx
    |   |   +-- TemporadasPage.tsx
    |   |   +-- TiposLaborPage.tsx
    |   |   +-- EstadosFenologicosPage.tsx
    |   |   +-- EstadosPlantaPage.tsx
    |   |   +-- SusceptibilidadesPage.tsx
    |   |   +-- CentrosCostoPage.tsx
    |   |   +-- MarcosPlantacionPage.tsx
    |   |
    |   +-- inventario/
    |   |   +-- InventarioPage.tsx
    |   |   +-- LoteDetailPage.tsx
    |   |
    |   +-- testblocks/
    |   |   +-- TestblocksListPage.tsx
    |   |   +-- TestblockNewPage.tsx
    |   |   +-- TestblockDetailPage.tsx
    |   |
    |   +-- laboratorio/
    |   |   +-- LaboratorioPage.tsx       (96 KB - modulo principal)
    |   |   +-- AnalisisLabPage.tsx
    |   |   +-- TomaDeMuestraTab.tsx
    |   |   +-- IngresoRapidoTab.tsx
    |   |
    |   +-- labores/
    |   |   +-- LaboresPage.tsx           (62 KB - modulo de labores)
    |   |
    |   +-- reportes/
    |   |   +-- ReportesPage.tsx          (59 KB - modulo de reportes)
    |   |
    |   +-- analisis/
    |   +-- alertas/
    |   +-- fenologia/
    |   +-- sistema/
    |
    +-- services/                   Servicios de comunicacion con API
    |   +-- api.ts                  Cliente HTTP base (Axios/Fetch)
    |   +-- auth.ts                 Servicio de autenticacion
    |   +-- mantenedores.ts         Servicios de datos maestros
    |   +-- inventario.ts           Servicio de inventario
    |   +-- testblock.ts            Servicio de testblocks
    |   +-- laboratorio.ts          Servicio de laboratorio
    |   +-- labores.ts              Servicio de labores
    |   +-- analisis.ts             Servicio de analisis
    |   +-- bulk.ts                 Servicio de carga masiva
    |   +-- sistema.ts              Servicio de administracion
    |   +-- reportes.ts             Servicio de reportes
    |   +-- relaciones.ts           Servicio de relaciones entre entidades
    |
    +-- stores/                     Stores de estado global (Zustand)
    |   +-- authStore.ts            Estado de autenticacion del usuario
    |   +-- inventarioStore.ts      Estado del modulo de inventario
    |   +-- testblockStore.ts       Estado del modulo de testblocks
    |
    +-- types/                      Definiciones de tipos TypeScript
    |   +-- auth.ts
    |   +-- maestras.ts
    |   +-- testblock.ts
    |   +-- inventario.ts
    |   +-- laboratorio.ts
    |   +-- sistema.ts
    |
    +-- config/
        +-- speciesFields.ts        Configuracion de campos por especie

### 6.2 Estructura del Backend

    app/
    |
    +-- core/                       Modulos centrales
    |   +-- config.py               Configuracion desde variables de entorno
    |   +-- database.py             Conexion y sesion de base de datos
    |   +-- security.py             Funciones de JWT y hash de passwords
    |   +-- deps.py                 Dependencias inyectables de FastAPI
    |   +-- utils.py                Funciones utilitarias compartidas
    |
    +-- models/                     Modelos de base de datos (SQLModel)
    |   +-- base.py                 Modelo base con campos comunes
    |   +-- maestras.py             Modelos de datos maestros (423 lineas)
    |   +-- variedades.py           Modelos de variedades
    |   +-- testblock.py            Modelos de testblocks
    |   +-- inventario.py           Modelos de inventario
    |   +-- laboratorio.py          Modelos de laboratorio
    |   +-- sistema.py              Modelos de sistema (usuarios, roles)
    |   +-- analisis.py             Modelos de analisis
    |   +-- bitacora.py             Modelo de bitacora de cambios
    |   +-- evidencia.py            Modelo de evidencias (fotos, archivos)
    |
    +-- schemas/                    Esquemas Pydantic (request/response)
    |   +-- auth.py
    |   +-- maestras.py
    |   +-- variedades.py
    |   +-- testblock.py
    |   +-- inventario.py
    |   +-- laboratorio.py
    |   +-- sistema.py
    |   +-- analisis.py
    |
    +-- routes/                     Rutas de la API (routers de FastAPI)
    |   +-- auth.py                 Autenticacion
    |   +-- mantenedores.py         CRUD generico de datos maestros
    |   +-- inventario.py           Operaciones de inventario
    |   +-- testblock.py            Operaciones de testblocks
    |   +-- laboratorio.py          Mediciones y clasificacion
    |   +-- labores.py              Labores agricolas
    |   +-- analisis.py             Dashboards y analisis
    |   +-- alertas.py              Gestion de alertas
    |   +-- reportes.py             Generacion de reportes
    |   +-- sistema.py              Administracion del sistema
    |   +-- bulk.py                 Carga masiva de datos
    |   +-- relaciones.py           Relaciones entre entidades
    |   +-- seed.py                 Datos semilla iniciales
    |   +-- seed_geo.py             Datos semilla geograficos
    |
    +-- services/                   Logica de negocio
    |   +-- crud.py                 Servicio CRUD generico
    |   +-- auth_service.py         Logica de autenticacion
    |   +-- clustering_service.py   Algoritmo de clustering Band-Sum
    |   +-- laboratorio_service.py  Logica de laboratorio
    |   +-- testblock_service.py    Logica de testblocks (28 KB)
    |   +-- inventario_service.py   Logica de inventario
    |   +-- alerta_service.py       Motor de alertas
    |   +-- ai_service.py           Integracion con Azure OpenAI
    |   +-- audit_service.py        Servicio de auditoria
    |
    +-- main.py                     Punto de entrada de la aplicacion

---

## 7. Modulos Funcionales

### 7.1 Modulo de Mantenedores (Datos Maestros)

#### 7.1.1 Descripcion

Este modulo gestiona todas las entidades base del sistema. Utiliza un patron CRUD generico tanto en el frontend (componentes `CrudTable` y `CrudForm`) como en el backend (servicio `crud.py` y ruta `mantenedores.py`) que permite administrar 15+ entidades con un codigo minimo por entidad.

#### 7.1.2 Entidades Gestionadas

| Entidad | Tabla | Descripcion |
|---------|-------|-------------|
| Pais | `pais` | Paises de origen de variedades |
| Region | `region` | Regiones geograficas |
| Comuna | `comuna` | Comunas dentro de regiones |
| Campo | `campo` | Predios o campos agricolas |
| Cuartel | `cuartel` | Subdivisiones dentro de un campo |
| Especie | `especie` | Especies frutales (Cerezo, Ciruela, Nectarina, etc.) |
| Variedad | `variedad` | Variedades dentro de una especie |
| Portainjerto | `portainjerto` | Portainjertos utilizados |
| PMG | `pmg` | Programas de mejoramiento genetico |
| Origen | `origen` | Origenes de las variedades |
| Vivero | `vivero` | Viveros proveedores |
| Color | `color` | Colores de fruta |
| Susceptibilidad | `susceptibilidad` | Susceptibilidades a enfermedades |
| Tipo Labor | `tipo_labor` | Tipos de labores agricolas |
| Estado Fenologico | `estado_fenologico` | Estados fenologicos de las plantas |
| Estado Planta | `estado_planta` | Estados de vida de las plantas |
| Temporada | `temporada` | Temporadas agricolas |
| Bodega | `bodega` | Bodegas de almacenamiento |
| Catalogo | `catalogo` | Catalogos de variedades |
| Centro Costo | `centro_costo` | Centros de costo contable |
| Marco Plantacion | `marco_plantacion` | Marcos de plantacion (distancias) |

#### 7.1.3 Operaciones Disponibles

Cada entidad soporta las siguientes operaciones:

- **Listar:** Obtener todos los registros con paginacion y filtros
- **Crear:** Agregar un nuevo registro
- **Editar:** Modificar un registro existente
- **Eliminar:** Eliminar un registro (con validacion de dependencias)
- **Merge:** Fusionar dos registros, reasignando todas las relaciones del registro origen al destino

#### 7.1.4 Funcionalidad de Merge

La operacion de merge es una funcionalidad avanzada que permite fusionar registros duplicados. Al ejecutar un merge:

1. Se selecciona el registro destino (el que permanece)
2. Se selecciona el registro origen (el que sera eliminado)
3. El sistema reasigna todas las relaciones del registro origen al destino
4. Se elimina el registro origen
5. Se registra la operacion en el log de auditoria

### 7.2 Modulo de Variedades

#### 7.2.1 Descripcion

Gestiona la informacion detallada de cada variedad frutal, incluyendo sus susceptibilidades a enfermedades, defectos conocidos, historial de cambios y asignaciones a testblocks.

#### 7.2.2 Tablas Asociadas

| Tabla | Descripcion |
|-------|-------------|
| `variedad` | Registro principal de la variedad con nombre, especie, color, origen, PMG y atributos |
| `variedad_susceptibilidad` | Relacion N:M entre variedades y susceptibilidades |
| `variedad_log` | Historial de cambios realizados a la variedad |
| `defecto` | Catalogo de defectos posibles |
| `defecto_variedad` | Relacion N:M entre defectos y variedades |
| `asignacion_test_block` | Asignaciones de la variedad a testblocks |
| `bitacora_variedad` | Bitacora de observaciones sobre la variedad |

#### 7.2.3 Funcionalidades

- Registro completo de variedades con todos sus atributos
- Asignacion y gestion de susceptibilidades a enfermedades
- Registro de defectos conocidos por variedad
- Historial de todos los cambios realizados (timeline)
- Chips visuales de relaciones entre entidades

### 7.3 Modulo de Inventario

#### 7.3.1 Descripcion

Controla el stock de plantas en vivero, registra movimientos de entrada y salida, gestiona guias de despacho y permite la generacion masiva de codigos QR para etiquetado.

#### 7.3.2 Tablas Asociadas

| Tabla | Descripcion |
|-------|-------------|
| `inventario_vivero` | Stock actual por variedad, portainjerto y bodega |
| `movimiento_inventario` | Registro de cada movimiento (entrada, salida, ajuste) |
| `inventario_test_block` | Stock asignado a testblocks |
| `guia_despacho` | Guias de despacho para traslados |

#### 7.3.3 Funcionalidades

- **Kardex:** Vista completa de movimientos por producto con saldos
- **Movimientos:** Registro de entradas, salidas, traspasos y ajustes
- **Guias de despacho:** Emision y seguimiento de guias para traslados entre bodegas o hacia campo
- **Codigos QR:** Generacion de codigos QR en lote para etiquetado de plantas
- **Vista por bodega:** Estado del inventario agrupado por bodega
- **Estadisticas:** KPIs de stock total, movimientos del periodo, niveles criticos
- **Importacion masiva:** Carga de inventario desde archivos Excel

### 7.4 Modulo de TestBlocks

#### 7.4.1 Descripcion

Los testblocks son bloques de prueba en campo donde se plantan nuevas variedades para su evaluacion. Este modulo gestiona la creacion de testblocks, la asignacion de posiciones, la grilla visual de plantas y las operaciones de manejo de plantas (alta, baja, replante).

#### 7.4.2 Tablas Asociadas

| Tabla | Descripcion |
|-------|-------------|
| `test_block` | Definicion del testblock (campo, cuartel, temporada, dimensiones) |
| `test_block_hilera` | Hileras dentro del testblock |
| `posicion_test_block` | Posiciones individuales dentro de una hilera |
| `planta` | Plantas asignadas a posiciones |
| `historial_posicion` | Historial de cambios de planta en cada posicion |

#### 7.4.3 Funcionalidades

- **Creacion de testblocks:** Definicion con campo, cuartel, temporada y dimensiones
- **Generacion de posiciones:** Creacion automatica de la grilla de posiciones basada en hileras y cantidad de plantas por hilera
- **Grilla visual:** Representacion visual interactiva del testblock mostrando cada posicion y su estado
- **Alta de planta:** Asignacion de una planta a una posicion disponible, individual o masiva
- **Baja de planta:** Registro de muerte o retiro de una planta con motivo
- **Replante:** Sustitucion de una planta en una posicion existente
- **Agregar hilera:** Incorporacion de nuevas hileras a un testblock existente
- **Codigos QR:** Generacion de etiquetas QR para cada posicion
- **Historial de posiciones:** Trazabilidad completa de todas las plantas que han ocupado cada posicion

#### 7.4.4 Operaciones Masivas

El modulo soporta operaciones masivas para alta, baja y replante, permitiendo procesar multiples posiciones en una sola transaccion. Esto es esencial para operaciones de campo donde se trabaja con centenas de plantas simultaneamente.

### 7.5 Modulo de Laboratorio

#### 7.5.1 Descripcion

Este es uno de los modulos mas complejos del sistema (la pagina principal tiene 96 KB). Gestiona las mediciones de calidad de fruta, la clasificacion automatica por clusters y el analisis estadistico de los resultados.

#### 7.5.2 Tablas Asociadas

| Tabla | Descripcion |
|-------|-------------|
| `medicion_laboratorio` | Registro de cada medicion con valores de calidad |
| `clasificacion_cluster` | Resultado de la clasificacion por cluster |
| `umbral_calidad` | Umbrales de calidad por especie y metrica |
| `registro_fenologico` | Registros fenologicos asociados |
| `detalle_labor` | Detalles de labores de muestreo |
| `ejecucion_labor` | Ejecucion de labores de laboratorio |

#### 7.5.3 Metricas de Calidad

Las mediciones de calidad capturan las siguientes metricas:

| Metrica | Unidad | Rango tipico | Descripcion |
|---------|--------|-------------|-------------|
| Brix | grados Brix | 10.0 - 22.0 | Contenido de azucar en la fruta |
| Acidez | g/L | 0.3 - 2.5 | Nivel de acidez |
| Firmeza mejillas | kg/cm2 | 1.0 - 12.0 | Firmeza medida en las mejillas de la fruta |
| Firmeza punto debil | kg/cm2 | 1.0 - 12.0 | Firmeza medida en el punto mas debil |
| Calibre | mm | Variable | Diametro ecuatorial de la fruta |

#### 7.5.4 Funcionalidades

- **Toma de muestra:** Registro de muestras con identificacion de testblock, posicion y planta
- **Ingreso rapido:** Interfaz optimizada para ingreso veloz de mediciones en laboratorio
- **Medicion individual:** Registro detallado de una medicion con todas las metricas
- **Medicion por lote (batch):** Registro de multiples mediciones simultaneamente
- **Clasificacion automatica:** Ejecucion del algoritmo de clustering Band-Sum sobre las mediciones
- **Reglas de clustering:** Visualizacion y gestion de las reglas por variedad
- **KPIs:** Indicadores clave del laboratorio (mediciones del dia, pendientes, promedio por cluster)
- **Importacion masiva:** Carga de mediciones desde archivos Excel
- **Analisis estadistico:** Estadisticas descriptivas y comparativas por variedad, testblock y temporada

### 7.6 Modulo de Labores

#### 7.6.1 Descripcion

Gestiona la planificacion, ejecucion y seguimiento de labores agricolas en campo. Incluye un calendario visual, ordenes de trabajo, registro fenologico y gestion de evidencias.

#### 7.6.2 Funcionalidades

- **Tipos de labor:** Catalogo configurable de labores (poda, riego, fertilizacion, control fitosanitario, etc.)
- **Planificacion:** Programacion de labores con fecha, testblock, tipo de labor y responsable
- **Calendario visual:** Vista de calendario (componente `LaborCalendar`) con labores planificadas y ejecutadas
- **Ejecucion:** Registro de la ejecucion real de labores con fecha, duracion y observaciones
- **Evidencias:** Adjuntar fotografias y archivos como evidencia de las labores realizadas
- **Registro fenologico:** Seguimiento del estado fenologico de las plantas a lo largo del tiempo
- **Ordenes de trabajo:** Generacion y seguimiento de ordenes de trabajo para cuadrillas
- **Dashboard:** Panel con indicadores de labores realizadas, pendientes y en atraso

### 7.7 Modulo de Analisis

#### 7.7.1 Descripcion

Proporciona dashboards analiticos, paquetes tecnologicos por variedad y clasificacion por clusters para la toma de decisiones agronomicas.

#### 7.7.2 Funcionalidades

- **Dashboard principal:** Visualizacion consolidada de KPIs del sistema
- **Paquetes tecnologicos:** Definicion de protocolos de manejo por variedad y condicion
- **Clusters:** Visualizacion de la distribucion de variedades por cluster de calidad
- **Graficos:** Graficos de barras, lineas, dispersiones y radar usando Recharts

### 7.8 Modulo de Alertas

#### 7.8.1 Descripcion

Motor de alertas configurable que genera notificaciones automatizadas basadas en reglas predefinidas.

#### 7.8.2 Funcionalidades

- **Reglas de alerta:** Configuracion de condiciones que disparan alertas
- **Tipos de alerta:** Dias sin registro, stock bajo, umbrales de calidad superados, labores atrasadas
- **Listado de alertas:** Vista de todas las alertas activas con filtros por prioridad y tipo
- **Resolucion:** Marcar alertas como resueltas con comentario del responsable

#### 7.8.3 Reglas Predeterminadas

| Regla | Parametro | Descripcion |
|-------|-----------|-------------|
| Dias sin registro | `DAYS_WITHOUT_REGISTRY_WARNING` (15) | Alerta cuando un testblock no tiene mediciones en N dias |
| Stock bajo | `LOW_STOCK_THRESHOLD_PCT` (20%) | Alerta cuando el inventario cae bajo un porcentaje del stock inicial |

### 7.9 Modulo de Reportes

#### 7.9.1 Descripcion

Generacion de reportes profesionales en formatos PDF y Excel, con analisis asistido por inteligencia artificial.

#### 7.9.2 Tipos de Reportes

| Reporte | Formato | Contenido |
|---------|---------|-----------|
| Reporte de variedad | PDF | Ficha completa de la variedad con historial, mediciones y graficos |
| Reporte de lote | PDF | Estado del lote con inventario, movimientos y trazabilidad |
| Reporte de testblock | PDF | Estado del testblock con grilla, mediciones y analisis por cluster |
| Reporte de planta | PDF | Historial individual de la planta con mediciones y labores |
| Analisis IA | PDF | Recomendaciones generadas por GPT-4o basadas en los datos |

#### 7.9.3 Generacion de Reportes

Los reportes PDF se generan en el backend utilizando la libreria `reportlab`. Los reportes Excel utilizan `openpyxl`. Los codigos QR se generan con la libreria `qrcode`.

La generacion de analisis por IA utiliza Azure OpenAI (GPT-4o) para producir recomendaciones agronomicas basadas en los datos de mediciones, clasificacion por clusters y condiciones del testblock.

### 7.10 Modulo de Sistema

#### 7.10.1 Descripcion

Administracion del sistema, gestion de usuarios y roles, y auditoria de operaciones.

#### 7.10.2 Funcionalidades

- **Usuarios:** CRUD de usuarios con asignacion de rol y campos autorizados
- **Roles:** Gestion de los 5 roles del sistema con permisos asociados
- **Log de auditoria:** Registro automatico de todas las operaciones criticas del sistema
- **Datos semilla:** Carga inicial de datos maestros y datos geograficos de Chile

### 7.11 Modulo de Carga Masiva (Bulk)

#### 7.11.1 Descripcion

Permite la importacion y exportacion masiva de datos mediante archivos Excel.

#### 7.11.2 Funcionalidades

- **Plantillas:** Descarga de plantillas Excel pre-formateadas para cada entidad
- **Importacion:** Carga masiva de datos desde archivos Excel con validacion
- **Exportacion:** Descarga de datos en formato Excel
- **Validacion:** Verificacion de tipos de datos, campos obligatorios y relaciones antes de persistir

---

## 8. API REST - Endpoints

Todos los endpoints se encuentran bajo el prefijo `/api/v1`. Excepto donde se indica lo contrario, todos requieren autenticacion via token JWT.

### 8.1 Autenticacion

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/login` | Iniciar sesion | No |
| POST | `/api/v1/auth/logout` | Cerrar sesion | Si |
| GET | `/api/v1/auth/me` | Obtener datos del usuario actual | Si |

**POST /api/v1/auth/login**

Request body:

    {
      "username": "admin",
      "password": "password123"
    }

Response (200):

    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer",
      "user": {
        "id": 1,
        "username": "admin",
        "nombre": "Administrador",
        "rol": "admin",
        "campos_asignados": []
      }
    }

**GET /api/v1/auth/me**

Headers: `Authorization: Bearer <token>`

Response (200):

    {
      "id": 1,
      "username": "admin",
      "nombre": "Administrador",
      "email": "admin@garcesfruit.cl",
      "rol": "admin",
      "campos_asignados": [],
      "activo": true
    }

### 8.2 Mantenedores (CRUD Generico)

Los mantenedores utilizan un patron de rutas generico donde `{entidad}` se reemplaza por el nombre de la entidad en singular (por ejemplo: `especie`, `variedad`, `campo`, `cuartel`, `portainjerto`, `vivero`, `color`, `origen`, `pmg`, `bodega`, `catalogo`, `temporada`, `tipo-labor`, `estado-fenologico`, `estado-planta`, `susceptibilidad`, `centro-costo`, `marco-plantacion`).

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/mantenedores/{entidad}` | Listar registros con paginacion |
| POST | `/api/v1/mantenedores/{entidad}` | Crear nuevo registro |
| PUT | `/api/v1/mantenedores/{entidad}/{id}` | Actualizar registro |
| DELETE | `/api/v1/mantenedores/{entidad}/{id}` | Eliminar registro |
| POST | `/api/v1/mantenedores/{entidad}/merge` | Fusionar dos registros |

**GET /api/v1/mantenedores/especie**

Response (200):

    {
      "items": [
        {
          "id": 1,
          "nombre": "Cerezo",
          "nombre_cientifico": "Prunus avium",
          "activo": true
        },
        {
          "id": 2,
          "nombre": "Ciruela",
          "nombre_cientifico": "Prunus domestica",
          "activo": true
        }
      ],
      "total": 2,
      "page": 1,
      "page_size": 50
    }

**POST /api/v1/mantenedores/especie**

Request body:

    {
      "nombre": "Nectarina",
      "nombre_cientifico": "Prunus persica var. nucipersica",
      "activo": true
    }

**POST /api/v1/mantenedores/especie/merge**

Request body:

    {
      "origen_id": 5,
      "destino_id": 2
    }

### 8.3 Inventario

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/inventario` | Listar inventario con filtros |
| POST | `/api/v1/inventario` | Crear registro de inventario |
| GET | `/api/v1/inventario/movements` | Listar movimientos |
| POST | `/api/v1/inventario/movements` | Registrar movimiento |
| GET | `/api/v1/inventario/dispatch` | Listar guias de despacho |
| POST | `/api/v1/inventario/dispatch` | Crear guia de despacho |
| POST | `/api/v1/inventario/qr-batch` | Generar QR en lote |
| GET | `/api/v1/inventario/kardex` | Obtener kardex por producto |
| GET | `/api/v1/inventario/por-bodega` | Inventario agrupado por bodega |
| GET | `/api/v1/inventario/stats` | Estadisticas de inventario |

**POST /api/v1/inventario/movements**

Request body:

    {
      "inventario_id": 1,
      "tipo": "entrada",
      "cantidad": 500,
      "motivo": "Recepcion de vivero Agrichile",
      "bodega_destino_id": 1,
      "guia_despacho_id": null
    }

**GET /api/v1/inventario/kardex?inventario_id=1**

Response (200):

    {
      "producto": "Cerezo - Royal Dawn / Maxma14",
      "movimientos": [
        {
          "fecha": "2026-03-15T10:30:00",
          "tipo": "entrada",
          "cantidad": 500,
          "saldo": 500,
          "motivo": "Recepcion de vivero"
        },
        {
          "fecha": "2026-03-20T14:00:00",
          "tipo": "salida",
          "cantidad": 50,
          "saldo": 450,
          "motivo": "Asignacion a TB-001"
        }
      ],
      "saldo_actual": 450
    }

### 8.4 TestBlocks

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/testblocks` | Listar testblocks |
| POST | `/api/v1/testblocks` | Crear testblock |
| GET | `/api/v1/testblocks/{id}` | Obtener detalle de testblock |
| PUT | `/api/v1/testblocks/{id}` | Actualizar testblock |
| DELETE | `/api/v1/testblocks/{id}` | Eliminar testblock |
| POST | `/api/v1/testblocks/{id}/generar-posiciones` | Generar grilla de posiciones |
| GET | `/api/v1/testblocks/{id}/grilla` | Obtener grilla visual |
| POST | `/api/v1/testblocks/{id}/alta` | Alta de planta individual |
| POST | `/api/v1/testblocks/{id}/alta-masiva` | Alta masiva de plantas |
| POST | `/api/v1/testblocks/{id}/baja` | Baja de planta individual |
| POST | `/api/v1/testblocks/{id}/baja-masiva` | Baja masiva de plantas |
| POST | `/api/v1/testblocks/{id}/replante` | Replante individual |
| POST | `/api/v1/testblocks/{id}/replante-masiva` | Replante masivo |
| POST | `/api/v1/testblocks/{id}/agregar-hilera` | Agregar hilera al testblock |
| GET | `/api/v1/testblocks/{id}/qr` | Generar QR del testblock |

**POST /api/v1/testblocks**

Request body:

    {
      "nombre": "TB-CEREZO-2026-001",
      "campo_id": 1,
      "cuartel_id": 3,
      "temporada_id": 1,
      "especie_id": 1,
      "num_hileras": 10,
      "plantas_por_hilera": 20,
      "marco_plantacion_id": 1,
      "observaciones": "Testblock de evaluacion de cerezos"
    }

**POST /api/v1/testblocks/{id}/alta**

Request body:

    {
      "hilera": 1,
      "posicion": 5,
      "variedad_id": 12,
      "portainjerto_id": 3,
      "inventario_id": 1,
      "fecha_plantacion": "2026-04-01"
    }

**POST /api/v1/testblocks/{id}/alta-masiva**

Request body:

    {
      "plantas": [
        {
          "hilera": 1,
          "posicion": 1,
          "variedad_id": 12,
          "portainjerto_id": 3
        },
        {
          "hilera": 1,
          "posicion": 2,
          "variedad_id": 12,
          "portainjerto_id": 3
        }
      ],
      "inventario_id": 1,
      "fecha_plantacion": "2026-04-01"
    }

**GET /api/v1/testblocks/{id}/grilla**

Response (200):

    {
      "testblock_id": 1,
      "nombre": "TB-CEREZO-2026-001",
      "hileras": [
        {
          "numero": 1,
          "posiciones": [
            {
              "posicion": 1,
              "planta_id": 101,
              "variedad": "Royal Dawn",
              "portainjerto": "Maxma14",
              "estado": "activa",
              "cluster": "C1"
            },
            {
              "posicion": 2,
              "planta_id": null,
              "estado": "disponible"
            }
          ]
        }
      ]
    }

### 8.5 Laboratorio

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/laboratorio/mediciones` | Listar mediciones |
| POST | `/api/v1/laboratorio/mediciones` | Registrar medicion individual |
| POST | `/api/v1/laboratorio/mediciones/batch` | Registrar mediciones en lote |
| POST | `/api/v1/laboratorio/clasificar` | Ejecutar clasificacion por clusters |
| GET | `/api/v1/laboratorio/clustering-rules` | Obtener reglas de clustering |
| GET | `/api/v1/laboratorio/kpis` | KPIs del laboratorio |
| POST | `/api/v1/laboratorio/bulk-import` | Importacion masiva desde Excel |
| GET | `/api/v1/laboratorio/analisis` | Obtener analisis estadistico |

**POST /api/v1/laboratorio/mediciones**

Request body:

    {
      "planta_id": 101,
      "testblock_id": 1,
      "fecha_medicion": "2026-03-25",
      "brix": 16.5,
      "acidez": 0.8,
      "firmeza_mejilla": 6.2,
      "firmeza_punto_debil": 4.8,
      "calibre": 28,
      "peso": 12.5,
      "observaciones": "Fruta en buen estado"
    }

**POST /api/v1/laboratorio/mediciones/batch**

Request body:

    {
      "mediciones": [
        {
          "planta_id": 101,
          "testblock_id": 1,
          "fecha_medicion": "2026-03-25",
          "brix": 16.5,
          "acidez": 0.8,
          "firmeza_mejilla": 6.2,
          "firmeza_punto_debil": 4.8,
          "calibre": 28
        },
        {
          "planta_id": 102,
          "testblock_id": 1,
          "fecha_medicion": "2026-03-25",
          "brix": 14.2,
          "acidez": 1.1,
          "firmeza_mejilla": 7.5,
          "firmeza_punto_debil": 5.9,
          "calibre": 30
        }
      ]
    }

**POST /api/v1/laboratorio/clasificar**

Request body:

    {
      "testblock_id": 1,
      "temporada_id": 1
    }

Response (200):

    {
      "total_mediciones": 150,
      "clasificadas": 150,
      "distribucion": {
        "C1": 25,
        "C2": 60,
        "C3": 45,
        "C4": 20
      },
      "detalle": [
        {
          "planta_id": 101,
          "variedad": "Royal Dawn",
          "brix_band": 3,
          "acidez_band": 2,
          "firmeza_band": 3,
          "score": 8,
          "cluster": "C2"
        }
      ]
    }

**GET /api/v1/laboratorio/kpis**

Response (200):

    {
      "mediciones_hoy": 45,
      "mediciones_temporada": 1250,
      "pendientes": 30,
      "promedio_brix": 15.8,
      "promedio_firmeza": 6.4,
      "distribucion_clusters": {
        "C1": 180,
        "C2": 520,
        "C3": 380,
        "C4": 170
      }
    }

### 8.6 Labores

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/labores/tipos-labor` | Listar tipos de labor |
| GET | `/api/v1/labores/planificacion` | Listar labores planificadas |
| POST | `/api/v1/labores/planificacion` | Crear planificacion de labor |
| GET | `/api/v1/labores/ejecucion` | Listar ejecuciones |
| POST | `/api/v1/labores/ejecucion` | Registrar ejecucion |
| GET | `/api/v1/labores/evidencias` | Listar evidencias |
| POST | `/api/v1/labores/evidencias` | Subir evidencia |
| GET | `/api/v1/labores/registro-fenologico` | Listar registros fenologicos |
| POST | `/api/v1/labores/registro-fenologico` | Crear registro fenologico |
| GET | `/api/v1/labores/ordenes-trabajo` | Listar ordenes de trabajo |
| POST | `/api/v1/labores/ordenes-trabajo` | Crear orden de trabajo |
| GET | `/api/v1/labores/dashboard` | Dashboard de labores |

**POST /api/v1/labores/planificacion**

Request body:

    {
      "tipo_labor_id": 1,
      "testblock_id": 1,
      "fecha_programada": "2026-04-15",
      "responsable": "Juan Perez",
      "descripcion": "Poda de formacion en hileras 1-5",
      "prioridad": "alta"
    }

**POST /api/v1/labores/ejecucion**

Request body:

    {
      "planificacion_id": 1,
      "fecha_ejecucion": "2026-04-15",
      "duracion_horas": 4.5,
      "ejecutor": "Juan Perez",
      "observaciones": "Completada sin novedades",
      "estado": "completada"
    }

### 8.7 Analisis

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/analisis/dashboard` | Dashboard analitico principal |
| GET | `/api/v1/analisis/paquetes` | Listar paquetes tecnologicos |
| POST | `/api/v1/analisis/paquetes` | Crear paquete tecnologico |
| GET | `/api/v1/analisis/clusters` | Analisis de distribucion por clusters |

### 8.8 Alertas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/alertas` | Listar alertas activas |
| POST | `/api/v1/alertas/{id}/resolver` | Resolver una alerta |
| GET | `/api/v1/alertas/reglas` | Listar reglas de alerta |
| POST | `/api/v1/alertas/reglas` | Crear regla de alerta |
| PUT | `/api/v1/alertas/reglas/{id}` | Actualizar regla de alerta |

**POST /api/v1/alertas/{id}/resolver**

Request body:

    {
      "comentario": "Se realizaron mediciones pendientes en TB-001"
    }

### 8.9 Reportes

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/reportes/variedad/{id}` | Reporte PDF de variedad |
| GET | `/api/v1/reportes/lote/{id}` | Reporte PDF de lote |
| GET | `/api/v1/reportes/testblock/{id}` | Reporte PDF de testblock |
| GET | `/api/v1/reportes/planta/{id}` | Reporte PDF de planta |
| POST | `/api/v1/reportes/analisis-ia` | Analisis con recomendaciones de IA |

**POST /api/v1/reportes/analisis-ia**

Request body:

    {
      "testblock_id": 1,
      "temporada_id": 1,
      "incluir_recomendaciones": true
    }

Response (200):

    {
      "analisis": "Basado en los datos recopilados...",
      "recomendaciones": [
        "Considerar ajustar el riego en las hileras 3-5 donde se observa mayor variabilidad en Brix",
        "Las variedades C1 presentan potencial para expansion comercial"
      ],
      "url_pdf": "/api/v1/reportes/download/analisis_tb1_2026.pdf"
    }

### 8.10 Sistema

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/sistema/usuarios` | Listar usuarios |
| POST | `/api/v1/sistema/usuarios` | Crear usuario |
| PUT | `/api/v1/sistema/usuarios/{id}` | Actualizar usuario |
| DELETE | `/api/v1/sistema/usuarios/{id}` | Eliminar usuario |
| GET | `/api/v1/sistema/roles` | Listar roles |
| GET | `/api/v1/sistema/audit-log` | Consultar log de auditoria |

**POST /api/v1/sistema/usuarios**

Request body:

    {
      "username": "jperez",
      "password": "SecurePass123!",
      "nombre": "Juan Perez",
      "email": "jperez@garcesfruit.cl",
      "rol": "agronomo",
      "campos_asignados": [1, 3, 5],
      "activo": true
    }

### 8.11 Carga Masiva (Bulk)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/bulk/template/{entidad}` | Descargar plantilla Excel |
| POST | `/api/v1/bulk/import/{entidad}` | Importar datos desde Excel |
| GET | `/api/v1/bulk/export/{entidad}` | Exportar datos a Excel |

### 8.12 Relaciones

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/relaciones/{entidad}/{id}` | Obtener relaciones de una entidad |

### 8.13 Datos Semilla

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/seed` | Cargar datos semilla iniciales |
| POST | `/api/v1/seed/geo` | Cargar datos geograficos de Chile |

> **Nota:** Los endpoints de seed solo deben ejecutarse una vez durante la configuracion inicial del sistema.

### 8.14 Health Check

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/health` | Verificar estado del servicio | No |

Response (200):

    {
      "status": "healthy",
      "version": "4.0",
      "database": "connected",
      "timestamp": "2026-04-07T10:30:00Z"
    }

---

## 9. Esquema de Base de Datos

### 9.1 Vision General

La base de datos esta compuesta por 48+ tablas organizadas en 7 dominios funcionales. Se utiliza Azure SQL Server como motor de base de datos. La conexion se realiza mediante pyodbc con el ODBC Driver 17, configurando un pool de conexiones con 5 conexiones base y 10 de overflow.

### 9.2 Dominio: Datos Maestros (23 tablas)

#### 9.2.1 Tablas Geograficas

**pais**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL, UNIQUE | Nombre del pais |
| codigo | NVARCHAR(10) | | Codigo ISO del pais |
| activo | BIT | DEFAULT 1 | Estado del registro |

**region**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre de la region |
| pais_id | INT | FK -> pais.id | Pais al que pertenece |
| activo | BIT | DEFAULT 1 | Estado del registro |

**comuna**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre de la comuna |
| region_id | INT | FK -> region.id | Region a la que pertenece |
| activo | BIT | DEFAULT 1 | Estado del registro |

#### 9.2.2 Tablas de Campo

**campo**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del campo |
| comuna_id | INT | FK -> comuna.id | Comuna donde se ubica |
| latitud | FLOAT | | Coordenada de latitud |
| longitud | FLOAT | | Coordenada de longitud |
| superficie_ha | FLOAT | | Superficie en hectareas |
| activo | BIT | DEFAULT 1 | Estado del registro |

**cuartel**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del cuartel |
| campo_id | INT | FK -> campo.id | Campo al que pertenece |
| superficie_ha | FLOAT | | Superficie en hectareas |
| activo | BIT | DEFAULT 1 | Estado del registro |

#### 9.2.3 Tablas de Especies y Programas

**especie**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL, UNIQUE | Nombre de la especie |
| nombre_cientifico | NVARCHAR(200) | | Nombre cientifico |
| activo | BIT | DEFAULT 1 | Estado del registro |

**portainjerto**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del portainjerto |
| especie_id | INT | FK -> especie.id | Especie compatible |
| activo | BIT | DEFAULT 1 | Estado del registro |

**pmg**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del programa de mejoramiento |
| pais_id | INT | FK -> pais.id | Pais de origen del programa |
| activo | BIT | DEFAULT 1 | Estado del registro |

**pmg_especie**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| pmg_id | INT | FK -> pmg.id | Programa de mejoramiento |
| especie_id | INT | FK -> especie.id | Especie asociada |

#### 9.2.4 Tablas de Proveedores

**origen**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del origen |
| pais_id | INT | FK -> pais.id | Pais de origen |
| activo | BIT | DEFAULT 1 | Estado del registro |

**vivero**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del vivero |
| contacto | NVARCHAR(200) | | Informacion de contacto |
| activo | BIT | DEFAULT 1 | Estado del registro |

**vivero_pmg**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| vivero_id | INT | FK -> vivero.id | Vivero |
| pmg_id | INT | FK -> pmg.id | Programa de mejoramiento |

#### 9.2.5 Tablas de Clasificacion

**color**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(50) | NOT NULL, UNIQUE | Nombre del color |
| codigo_hex | NVARCHAR(7) | | Codigo hexadecimal del color |

**susceptibilidad**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre de la susceptibilidad |
| descripcion | NVARCHAR(500) | | Descripcion detallada |
| activo | BIT | DEFAULT 1 | Estado del registro |

#### 9.2.6 Tablas Operativas

**tipo_labor**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del tipo de labor |
| categoria | NVARCHAR(50) | | Categoria de la labor |
| activo | BIT | DEFAULT 1 | Estado del registro |

**estado_fenologico**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del estado fenologico |
| orden | INT | | Orden secuencial del estado |
| especie_id | INT | FK -> especie.id | Especie asociada |

**estado_planta**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(50) | NOT NULL | Nombre del estado (activa, muerta, retirada) |

**temporada**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(20) | NOT NULL, UNIQUE | Nombre de la temporada (ej: 2025-2026) |
| fecha_inicio | DATE | | Fecha de inicio |
| fecha_fin | DATE | | Fecha de fin |
| activa | BIT | DEFAULT 0 | Indica si es la temporada actual |

**bodega**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre de la bodega |
| ubicacion | NVARCHAR(200) | | Ubicacion fisica |
| campo_id | INT | FK -> campo.id | Campo donde se ubica |
| activo | BIT | DEFAULT 1 | Estado del registro |

**catalogo**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del catalogo |
| descripcion | NVARCHAR(500) | | Descripcion del catalogo |

**correlativo**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| prefijo | NVARCHAR(10) | NOT NULL | Prefijo del correlativo |
| ultimo_numero | INT | DEFAULT 0 | Ultimo numero generado |

**centro_costo**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| codigo | NVARCHAR(20) | NOT NULL, UNIQUE | Codigo del centro de costo |
| nombre | NVARCHAR(100) | NOT NULL | Nombre descriptivo |
| activo | BIT | DEFAULT 1 | Estado del registro |

**marco_plantacion**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(50) | NOT NULL | Nombre descriptivo |
| distancia_hilera | FLOAT | NOT NULL | Distancia entre hileras en metros |
| distancia_planta | FLOAT | NOT NULL | Distancia entre plantas en metros |

### 9.3 Dominio: Variedades (7 tablas)

**variedad**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre de la variedad |
| codigo | NVARCHAR(50) | UNIQUE | Codigo interno |
| especie_id | INT | FK -> especie.id, NOT NULL | Especie a la que pertenece |
| color_id | INT | FK -> color.id | Color de la fruta |
| origen_id | INT | FK -> origen.id | Origen de la variedad |
| pmg_id | INT | FK -> pmg.id | Programa de mejoramiento |
| catalogo_id | INT | FK -> catalogo.id | Catalogo asociado |
| fecha_ingreso | DATE | | Fecha de ingreso al sistema |
| descripcion | NVARCHAR(1000) | | Descripcion de la variedad |
| activo | BIT | DEFAULT 1 | Estado del registro |

**variedad_susceptibilidad**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| variedad_id | INT | FK -> variedad.id | Variedad |
| susceptibilidad_id | INT | FK -> susceptibilidad.id | Susceptibilidad |
| nivel | NVARCHAR(20) | | Nivel (bajo, medio, alto) |

**variedad_log**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| variedad_id | INT | FK -> variedad.id | Variedad modificada |
| campo_modificado | NVARCHAR(100) | | Campo que fue cambiado |
| valor_anterior | NVARCHAR(500) | | Valor antes del cambio |
| valor_nuevo | NVARCHAR(500) | | Valor despues del cambio |
| usuario_id | INT | FK -> usuario.id | Usuario que realizo el cambio |
| fecha | DATETIME | DEFAULT GETDATE() | Fecha del cambio |

**defecto**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del defecto |
| descripcion | NVARCHAR(500) | | Descripcion del defecto |
| activo | BIT | DEFAULT 1 | Estado del registro |

**defecto_variedad**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| defecto_id | INT | FK -> defecto.id | Defecto |
| variedad_id | INT | FK -> variedad.id | Variedad |
| severidad | NVARCHAR(20) | | Severidad del defecto |

**asignacion_test_block**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| variedad_id | INT | FK -> variedad.id | Variedad asignada |
| test_block_id | INT | FK -> test_block.id | TestBlock destino |
| cantidad | INT | NOT NULL | Cantidad de plantas asignadas |
| fecha_asignacion | DATE | | Fecha de la asignacion |

**bitacora_variedad**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| variedad_id | INT | FK -> variedad.id | Variedad |
| fecha | DATETIME | DEFAULT GETDATE() | Fecha de la entrada |
| tipo | NVARCHAR(50) | | Tipo de entrada |
| descripcion | NVARCHAR(2000) | | Contenido de la bitacora |
| usuario_id | INT | FK -> usuario.id | Usuario autor |

### 9.4 Dominio: TestBlocks (5 tablas)

**test_block**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL, UNIQUE | Nombre del testblock |
| campo_id | INT | FK -> campo.id, NOT NULL | Campo donde se ubica |
| cuartel_id | INT | FK -> cuartel.id | Cuartel especifico |
| temporada_id | INT | FK -> temporada.id, NOT NULL | Temporada de creacion |
| especie_id | INT | FK -> especie.id | Especie principal |
| num_hileras | INT | NOT NULL | Numero de hileras |
| plantas_por_hilera | INT | NOT NULL | Plantas por hilera |
| marco_plantacion_id | INT | FK -> marco_plantacion.id | Marco de plantacion |
| observaciones | NVARCHAR(2000) | | Observaciones generales |
| fecha_creacion | DATETIME | DEFAULT GETDATE() | Fecha de creacion |
| activo | BIT | DEFAULT 1 | Estado del registro |

**test_block_hilera**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| test_block_id | INT | FK -> test_block.id | TestBlock al que pertenece |
| numero | INT | NOT NULL | Numero de hilera |
| num_posiciones | INT | NOT NULL | Cantidad de posiciones |

**posicion_test_block**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| hilera_id | INT | FK -> test_block_hilera.id | Hilera a la que pertenece |
| posicion | INT | NOT NULL | Numero de posicion |
| planta_id | INT | FK -> planta.id, NULLABLE | Planta actual en la posicion |
| estado | NVARCHAR(20) | DEFAULT 'disponible' | Estado (disponible, ocupada, baja) |

**planta**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| codigo_qr | NVARCHAR(100) | UNIQUE | Codigo QR de la planta |
| variedad_id | INT | FK -> variedad.id, NOT NULL | Variedad de la planta |
| portainjerto_id | INT | FK -> portainjerto.id | Portainjerto utilizado |
| fecha_plantacion | DATE | | Fecha de plantacion |
| estado_planta_id | INT | FK -> estado_planta.id | Estado actual |
| inventario_origen_id | INT | FK -> inventario_vivero.id | Inventario de origen |
| observaciones | NVARCHAR(1000) | | Observaciones |

**historial_posicion**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| posicion_id | INT | FK -> posicion_test_block.id | Posicion |
| planta_id | INT | FK -> planta.id | Planta |
| accion | NVARCHAR(20) | NOT NULL | Accion (alta, baja, replante) |
| fecha | DATETIME | DEFAULT GETDATE() | Fecha de la accion |
| motivo | NVARCHAR(500) | | Motivo de la accion |
| usuario_id | INT | FK -> usuario.id | Usuario que realizo la accion |

### 9.5 Dominio: Inventario (4 tablas)

**inventario_vivero**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| variedad_id | INT | FK -> variedad.id, NOT NULL | Variedad |
| portainjerto_id | INT | FK -> portainjerto.id | Portainjerto |
| bodega_id | INT | FK -> bodega.id | Bodega actual |
| vivero_id | INT | FK -> vivero.id | Vivero proveedor |
| cantidad_inicial | INT | NOT NULL | Cantidad recibida inicialmente |
| cantidad_actual | INT | NOT NULL | Cantidad disponible actual |
| lote | NVARCHAR(50) | | Identificador de lote |
| fecha_recepcion | DATE | | Fecha de recepcion |
| temporada_id | INT | FK -> temporada.id | Temporada |
| activo | BIT | DEFAULT 1 | Estado del registro |

**movimiento_inventario**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| inventario_id | INT | FK -> inventario_vivero.id | Inventario afectado |
| tipo | NVARCHAR(20) | NOT NULL | Tipo (entrada, salida, ajuste, traspaso) |
| cantidad | INT | NOT NULL | Cantidad del movimiento |
| motivo | NVARCHAR(500) | | Motivo del movimiento |
| bodega_origen_id | INT | FK -> bodega.id | Bodega de origen (traspasos) |
| bodega_destino_id | INT | FK -> bodega.id | Bodega de destino (traspasos) |
| guia_despacho_id | INT | FK -> guia_despacho.id | Guia de despacho asociada |
| fecha | DATETIME | DEFAULT GETDATE() | Fecha del movimiento |
| usuario_id | INT | FK -> usuario.id | Usuario que realizo el movimiento |

**inventario_test_block**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| inventario_id | INT | FK -> inventario_vivero.id | Inventario de origen |
| test_block_id | INT | FK -> test_block.id | TestBlock destino |
| cantidad_asignada | INT | NOT NULL | Cantidad asignada |
| fecha_asignacion | DATE | | Fecha de asignacion |

**guia_despacho**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| numero | NVARCHAR(50) | NOT NULL, UNIQUE | Numero de guia |
| fecha | DATE | NOT NULL | Fecha de emision |
| origen | NVARCHAR(200) | | Lugar de origen |
| destino | NVARCHAR(200) | | Lugar de destino |
| responsable | NVARCHAR(100) | | Responsable del despacho |
| estado | NVARCHAR(20) | DEFAULT 'emitida' | Estado (emitida, en_transito, recibida) |
| observaciones | NVARCHAR(1000) | | Observaciones |

### 9.6 Dominio: Laboratorio (6 tablas)

**medicion_laboratorio**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| planta_id | INT | FK -> planta.id, NOT NULL | Planta medida |
| test_block_id | INT | FK -> test_block.id | TestBlock de la medicion |
| temporada_id | INT | FK -> temporada.id | Temporada |
| fecha_medicion | DATE | NOT NULL | Fecha de la medicion |
| brix | FLOAT | | Grados Brix |
| acidez | FLOAT | | Acidez (g/L) |
| firmeza_mejilla | FLOAT | | Firmeza en mejillas (kg/cm2) |
| firmeza_punto_debil | FLOAT | | Firmeza en punto debil (kg/cm2) |
| calibre | FLOAT | | Calibre en mm |
| peso | FLOAT | | Peso en gramos |
| color_cobertura | FLOAT | | Porcentaje de cobertura de color |
| observaciones | NVARCHAR(1000) | | Observaciones |
| usuario_id | INT | FK -> usuario.id | Analista que realizo la medicion |
| fecha_registro | DATETIME | DEFAULT GETDATE() | Fecha de registro en el sistema |

**clasificacion_cluster**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| medicion_id | INT | FK -> medicion_laboratorio.id | Medicion clasificada |
| brix_band | INT | | Banda de Brix (1-4) |
| acidez_band | INT | | Banda de acidez (1-4) |
| firmeza_band | INT | | Banda de firmeza (1-4) |
| score | INT | | Puntaje total (4-16) |
| cluster | NVARCHAR(5) | | Cluster asignado (C1, C2, C3, C4) |
| regla_aplicada | NVARCHAR(100) | | Nombre de la regla de clustering utilizada |
| fecha_clasificacion | DATETIME | DEFAULT GETDATE() | Fecha de clasificacion |

**umbral_calidad**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| especie_id | INT | FK -> especie.id | Especie |
| variedad_grupo | NVARCHAR(100) | | Grupo de variedad (ej: Ciruela Candy) |
| metrica | NVARCHAR(50) | NOT NULL | Nombre de la metrica |
| banda_1_min | FLOAT | | Limite inferior de banda 1 |
| banda_1_max | FLOAT | | Limite superior de banda 1 |
| banda_2_min | FLOAT | | Limite inferior de banda 2 |
| banda_2_max | FLOAT | | Limite superior de banda 2 |
| banda_3_min | FLOAT | | Limite inferior de banda 3 |
| banda_3_max | FLOAT | | Limite superior de banda 3 |
| banda_4_min | FLOAT | | Limite inferior de banda 4 |
| banda_4_max | FLOAT | | Limite superior de banda 4 |

**registro_fenologico**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| planta_id | INT | FK -> planta.id | Planta observada |
| estado_fenologico_id | INT | FK -> estado_fenologico.id | Estado fenologico registrado |
| fecha | DATE | NOT NULL | Fecha de observacion |
| observaciones | NVARCHAR(1000) | | Observaciones |
| usuario_id | INT | FK -> usuario.id | Observador |

**detalle_labor**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| ejecucion_id | INT | FK -> ejecucion_labor.id | Ejecucion asociada |
| planta_id | INT | FK -> planta.id | Planta afectada |
| observaciones | NVARCHAR(1000) | | Observaciones del detalle |

**ejecucion_labor**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| tipo_labor_id | INT | FK -> tipo_labor.id | Tipo de labor ejecutada |
| test_block_id | INT | FK -> test_block.id | TestBlock afectado |
| fecha_ejecucion | DATE | NOT NULL | Fecha de ejecucion |
| duracion_horas | FLOAT | | Duracion en horas |
| ejecutor | NVARCHAR(100) | | Persona que ejecuto |
| estado | NVARCHAR(20) | DEFAULT 'completada' | Estado de la ejecucion |
| observaciones | NVARCHAR(2000) | | Observaciones |
| usuario_id | INT | FK -> usuario.id | Usuario que registro |

### 9.7 Dominio: Sistema (3 tablas)

**usuario**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| username | NVARCHAR(50) | NOT NULL, UNIQUE | Nombre de usuario |
| hashed_password | NVARCHAR(200) | NOT NULL | Password hasheado con bcrypt |
| nombre | NVARCHAR(100) | NOT NULL | Nombre completo |
| email | NVARCHAR(100) | UNIQUE | Correo electronico |
| rol_id | INT | FK -> rol.id | Rol asignado |
| campos_asignados | NVARCHAR(500) | | IDs de campos autorizados (JSON array) |
| activo | BIT | DEFAULT 1 | Estado del usuario |
| fecha_creacion | DATETIME | DEFAULT GETDATE() | Fecha de creacion |
| ultimo_acceso | DATETIME | | Fecha del ultimo acceso |

**rol**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(50) | NOT NULL, UNIQUE | Nombre del rol |
| descripcion | NVARCHAR(200) | | Descripcion del rol |
| permisos | NVARCHAR(2000) | | Permisos en formato JSON |

**audit_log**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| usuario_id | INT | FK -> usuario.id | Usuario que realizo la accion |
| accion | NVARCHAR(50) | NOT NULL | Tipo de accion (CREATE, UPDATE, DELETE) |
| entidad | NVARCHAR(100) | NOT NULL | Entidad afectada |
| entidad_id | INT | | ID del registro afectado |
| datos_anteriores | NVARCHAR(MAX) | | Datos antes del cambio (JSON) |
| datos_nuevos | NVARCHAR(MAX) | | Datos despues del cambio (JSON) |
| ip_address | NVARCHAR(45) | | Direccion IP del cliente |
| fecha | DATETIME | DEFAULT GETDATE() | Fecha de la accion |

### 9.8 Dominio: Analisis (3 tablas)

**paquete_tecnologico**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre del paquete |
| variedad_id | INT | FK -> variedad.id | Variedad asociada |
| especie_id | INT | FK -> especie.id | Especie |
| descripcion | NVARCHAR(2000) | | Descripcion del protocolo |
| recomendaciones | NVARCHAR(MAX) | | Recomendaciones tecnicas |
| temporada_id | INT | FK -> temporada.id | Temporada de aplicacion |

**alerta**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| tipo | NVARCHAR(50) | NOT NULL | Tipo de alerta |
| mensaje | NVARCHAR(500) | NOT NULL | Mensaje descriptivo |
| prioridad | NVARCHAR(20) | DEFAULT 'media' | Prioridad (baja, media, alta, critica) |
| entidad | NVARCHAR(100) | | Entidad relacionada |
| entidad_id | INT | | ID de la entidad relacionada |
| resuelta | BIT | DEFAULT 0 | Indica si fue resuelta |
| comentario_resolucion | NVARCHAR(500) | | Comentario al resolver |
| fecha_creacion | DATETIME | DEFAULT GETDATE() | Fecha de creacion |
| fecha_resolucion | DATETIME | | Fecha de resolucion |
| usuario_resolucion_id | INT | FK -> usuario.id | Usuario que resolvio |

**regla_alerta**

| Columna | Tipo | Restricciones | Descripcion |
|---------|------|---------------|-------------|
| id | INT | PK, IDENTITY | Identificador unico |
| nombre | NVARCHAR(100) | NOT NULL | Nombre de la regla |
| tipo | NVARCHAR(50) | NOT NULL | Tipo de alerta que genera |
| condicion | NVARCHAR(1000) | | Condicion de disparo (JSON) |
| prioridad | NVARCHAR(20) | DEFAULT 'media' | Prioridad de las alertas generadas |
| activa | BIT | DEFAULT 1 | Estado de la regla |

### 9.9 Diagrama de Relaciones Principales

    pais --> region --> comuna --> campo --> cuartel
                                    |          |
                                  bodega    test_block --> test_block_hilera --> posicion_test_block
                                    |                                                |
                              inventario_vivero                                    planta
                                    |                                      /     |      \
                          movimiento_inventario              medicion_lab  registro_fen  historial_pos
                                                                 |
                                                         clasificacion_cluster

    especie --> variedad --> variedad_susceptibilidad
                   |
            defecto_variedad
                   |
            asignacion_test_block

    usuario --> audit_log
       |
      rol

### 9.10 Configuracion de la Base de Datos

La conexion a la base de datos se configura en `app/core/database.py` mediante las siguientes variables de entorno:

- `DB_SERVER`: Servidor de base de datos
- `DB_NAME`: Nombre de la base de datos
- `DB_USER`: Usuario de conexion
- `DB_PASSWORD`: Contrasena del usuario
- `DB_DRIVER`: Driver ODBC (por defecto `ODBC+Driver+17+for+SQL+Server`)

La cadena de conexion resultante tiene el formato:

    mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}/{DB_NAME}?driver={DB_DRIVER}

El pool de conexiones se configura con:

- `pool_size=5`: Numero base de conexiones mantenidas
- `max_overflow=10`: Conexiones adicionales permitidas bajo carga
- `pool_pre_ping=True`: Verificacion de conexion antes de usar

---

## 10. Autenticacion y Autorizacion

### 10.1 Flujo de Autenticacion

El sistema utiliza JSON Web Tokens (JWT) para la autenticacion. El flujo completo es:

1. El usuario envia sus credenciales (username/password) al endpoint `POST /api/v1/auth/login`
2. El backend verifica las credenciales contra la base de datos:
   - Busca el usuario por username
   - Verifica el password usando bcrypt contra el hash almacenado
   - Valida que el usuario este activo
3. Si las credenciales son validas, se genera un token JWT con:
   - Algoritmo: HS256
   - Clave secreta: configurada en `JWT_SECRET_KEY`
   - Expiracion: 480 minutos (8 horas) configurado en `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
   - Payload: `sub` (username), `exp` (expiracion), `rol`, `campos_asignados`
4. El token se retorna al frontend junto con los datos basicos del usuario
5. El frontend almacena el token en el store de Zustand (`authStore`)
6. En cada peticion subsiguiente, el frontend incluye el token en el header `Authorization: Bearer <token>`
7. El backend valida el token en cada peticion protegida mediante la dependencia `get_current_user`

### 10.2 Diagrama del Flujo de Autenticacion

    Cliente                          Backend                        Base de Datos
      |                                |                                |
      |--- POST /auth/login ---------->|                                |
      |    {username, password}        |--- SELECT usuario ------------>|
      |                                |<-- datos del usuario ----------|
      |                                |                                |
      |                                |-- bcrypt.verify(pwd, hash) --> |
      |                                |                                |
      |                                |-- genera JWT (HS256, 480min)   |
      |                                |                                |
      |<-- {access_token, user} -------|                                |
      |                                |                                |
      |--- GET /api/v1/recurso ------->|                                |
      |    Authorization: Bearer xxx   |-- valida JWT                   |
      |                                |-- extrae usuario               |
      |                                |-- verifica rol                 |
      |                                |--- query con filtros ---------->|
      |<-- datos ----------------------|<-- resultados ----------------|

### 10.3 Hash de Contrasenas

Las contrasenas se almacenan hasheadas utilizando bcrypt con salt automatico. El proceso es:

- **Registro:** `hashed_password = bcrypt.hash(plain_password)`
- **Verificacion:** `bcrypt.verify(plain_password, hashed_password)`
- El salt se genera automaticamente y se almacena como parte del hash
- No se almacena ni transmite la contrasena en texto plano en ningun momento

### 10.4 Roles y Permisos (RBAC)

El sistema implementa Control de Acceso Basado en Roles (RBAC) con 5 roles predefinidos:

| Rol | Mantenedores | Inventario | TestBlocks | Laboratorio | Labores | Analisis | Reportes | Sistema |
|-----|-------------|-----------|-----------|------------|---------|---------|---------|---------|
| admin | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD |
| agronomo | Lectura | Lectura | CRUD | Lectura | CRUD | CRUD | Lectura | - |
| laboratorio | Lectura | - | Lectura | CRUD | - | Lectura | Lectura | - |
| operador | Lectura | CRUD | CRU | - | CRU | - | - | - |
| visualizador | Lectura | Lectura | Lectura | Lectura | Lectura | Lectura | Lectura | - |

### 10.5 Control de Acceso por Campo

Ademas del rol, cada usuario puede tener asignados campos especificos mediante el campo `campos_asignados`. Cuando este campo tiene valores, el usuario solo puede acceder a datos relacionados con esos campos:

- TestBlocks ubicados en los campos asignados
- Inventario en bodegas de los campos asignados
- Mediciones de testblocks en los campos asignados

Si `campos_asignados` esta vacio, el usuario tiene acceso a todos los campos (comportamiento para administradores).

### 10.6 Implementacion Tecnica

La verificacion de roles se implementa mediante la dependencia `require_role()` de FastAPI:

    @router.get("/recurso-protegido")
    async def obtener_recurso(
        current_user = Depends(require_role(["admin", "agronomo"]))
    ):
        ...

La dependencia:

1. Extrae el token JWT del header Authorization
2. Decodifica y valida el token
3. Obtiene el usuario de la base de datos
4. Verifica que el rol del usuario este en la lista de roles permitidos
5. Retorna el usuario actual si la validacion es exitosa
6. Retorna HTTP 403 Forbidden si el rol no esta permitido

---

## 11. Algoritmo de Clustering (Band-Sum)

### 11.1 Descripcion General

El algoritmo de clustering Band-Sum es el nucleo del sistema de segmentacion de calidad. Clasifica las mediciones de fruta en 4 clusters de calidad (C1 a C4) basandose en metricas fisicoquimicas. El algoritmo es especifico por especie, con umbrales diferentes para cada grupo de variedades.

### 11.2 Metricas de Entrada

El algoritmo utiliza las siguientes metricas como entrada:

| Metrica | Descripcion | Unidad | Rango general |
|---------|------------|--------|---------------|
| Brix | Contenido de azucar | grados Brix | 10.0 - 22.0 |
| Acidez | Nivel de acidez titulable | g/L | 0.3 - 2.5 |
| Firmeza mejillas | Firmeza medida en las mejillas | kg/cm2 | 1.0 - 12.0 |
| Firmeza punto debil | Firmeza en el punto mas debil | kg/cm2 | 1.0 - 12.0 |

### 11.3 Proceso del Algoritmo

#### Paso 1: Seleccion de Regla

Se selecciona la regla de clustering apropiada segun la especie y el grupo de variedad de la medicion. Existen 40+ reglas definidas para diferentes combinaciones:

| Especie | Grupos de Variedad |
|---------|-------------------|
| Ciruela | Candy, Cherry |
| Nectarina | Amarilla, Blanca |
| Cerezo | (grupo unico) |

> **Nota:** Cada grupo de variedad tiene umbrales especificos para cada metrica, definidos en la tabla `umbral_calidad`.

#### Paso 2: Banding (Asignacion de Bandas)

Cada metrica se clasifica en una banda de 1 a 4 segun los umbrales definidos para la regla seleccionada:

| Banda | Significado | Valor numerico |
|-------|------------|---------------|
| Banda 1 | Bajo / Deficiente | 1 |
| Banda 2 | Regular / Aceptable | 2 |
| Banda 3 | Bueno | 3 |
| Banda 4 | Excelente / Superior | 4 |

Ejemplo para Ciruela Candy - metrica Brix:

| Banda | Rango Brix |
|-------|-----------|
| 1 | < 12.0 |
| 2 | 12.0 - 14.9 |
| 3 | 15.0 - 17.9 |
| 4 | >= 18.0 |

El proceso se repite para cada metrica (Brix, acidez, firmeza mejillas, firmeza punto debil), resultando en 4 valores de banda (uno por metrica).

#### Paso 3: Sum (Suma de Bandas)

Se suman los valores de banda de todas las metricas para obtener un puntaje total:

    score = brix_band + acidez_band + firmeza_mejilla_band + firmeza_punto_debil_band

El rango posible del score es de 4 (todas las metricas en banda 1) a 16 (todas en banda 4).

#### Paso 4: Clasificacion por Cluster

El score total se mapea a uno de los 4 clusters de calidad:

| Cluster | Rango de Score | Calidad | Descripcion |
|---------|---------------|---------|-------------|
| C1 | 4 - 5 | Baja | Fruta que no cumple estandares minimos |
| C2 | 6 - 8 | Regular | Fruta con potencial de mejora |
| C3 | 9 - 11 | Buena | Fruta que cumple estandares comerciales |
| C4 | 12 - 16 | Premium | Fruta de calidad superior |

### 11.4 Ejemplo Completo

Considere una medicion de una Ciruela variedad Candy:

    Brix = 16.5
    Acidez = 0.8
    Firmeza mejillas = 6.2
    Firmeza punto debil = 4.8

Paso 1: Se selecciona la regla "Ciruela Candy"

Paso 2: Banding

    Brix 16.5 -> Banda 3
    Acidez 0.8 -> Banda 2
    Firmeza mejillas 6.2 -> Banda 3
    Firmeza punto debil 4.8 -> Banda 2

Paso 3: Sum

    Score = 3 + 2 + 3 + 2 = 10

Paso 4: Clasificacion

    Score 10 -> Rango 9-11 -> Cluster C3 (Buena)

### 11.5 Implementacion Tecnica

El algoritmo esta implementado en `app/services/clustering_service.py`. La funcion principal recibe una lista de mediciones y retorna la clasificacion de cada una:

1. Obtiene las reglas de clustering para la especie/variedad de cada medicion
2. Para cada medicion, aplica el proceso de banding a cada metrica
3. Calcula el score sumando las bandas
4. Asigna el cluster correspondiente
5. Almacena el resultado en la tabla `clasificacion_cluster`
6. Retorna las estadisticas de distribucion

### 11.6 Reglas Definidas

El sistema incluye 40+ reglas de clustering predefinidas. Las reglas se almacenan en la tabla `umbral_calidad` y se pueden consultar y modificar a traves del endpoint `GET /api/v1/laboratorio/clustering-rules`.

Las reglas cubren las siguientes combinaciones de especie y grupo de variedad:

- Ciruela Candy (multiples variedades)
- Ciruela Cherry (multiples variedades)
- Nectarina Amarilla
- Nectarina Blanca
- Cerezo (regla general)
- Y otras combinaciones adicionales

---

## 12. Integracion con Azure OpenAI

### 12.1 Proposito

El sistema integra Azure OpenAI con el modelo GPT-4o para generar recomendaciones agronomicas basadas en los datos de mediciones, clasificacion por clusters y condiciones del testblock. Esta funcionalidad esta implementada en `app/services/ai_service.py`.

### 12.2 Configuracion

La integracion requiere las siguientes variables de entorno:

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `AZURE_OPENAI_API_KEY` | Clave de API del servicio | `sk-...` |
| `AZURE_OPENAI_ENDPOINT` | URL del endpoint de Azure OpenAI | `https://mi-recurso.openai.azure.com/` |
| `AZURE_OPENAI_DEPLOYMENT` | Nombre del despliegue del modelo | `gpt-4o` |
| `AZURE_OPENAI_API_VERSION` | Version de la API | `2024-02-15-preview` |

### 12.3 Funcionalidades

- **Analisis de testblock:** Genera un analisis detallado del estado de un testblock basado en sus mediciones y distribucion de clusters
- **Recomendaciones agronomicas:** Proporciona recomendaciones de manejo basadas en los resultados de calidad
- **Reportes con IA:** Los reportes PDF pueden incluir una seccion de analisis generado por IA

### 12.4 Flujo de Integracion

1. El usuario solicita un analisis con IA desde el modulo de reportes
2. El backend recopila los datos relevantes: mediciones, clusters, labores realizadas, estado fenologico
3. Se construye un prompt contextualizado con los datos del testblock
4. Se envia la solicitud a Azure OpenAI (GPT-4o)
5. La respuesta se procesa, formatea y se incluye en el reporte

### 12.5 Consideraciones

- Las llamadas a Azure OpenAI son asincronas y pueden tomar varios segundos
- Se implementa manejo de errores para timeout y errores de la API
- Los costos de uso de la API se deben monitorear periodicamente
- La calidad de las recomendaciones depende de la cantidad y calidad de los datos disponibles

---

## 13. CI/CD y Despliegue

### 13.1 Repositorios

| Repositorio | Contenido | Workflows |
|------------|-----------|-----------|
| `frontend_app_segmentacion_vd` | Frontend React + Backend (monorepo) | `ci.yml`, `cd.yml` |
| `backend-app-segmentacion-dev-vd` | Backend FastAPI | `main_backendsegmentacion.yml` |

### 13.2 Pipeline de CI (Integracion Continua)

El workflow de CI se ejecuta en cada push y pull request. Realiza las siguientes etapas:

**Frontend (ci.yml):**

1. Checkout del codigo
2. Configuracion de Node.js
3. Instalacion de dependencias (`npm ci`)
4. Linting (`npm run lint`)
5. Ejecucion de tests (`npm run test`)
6. Build de produccion (`npm run build`)

**Backend (main_backendsegmentacion.yml):**

1. Checkout del codigo
2. Configuracion de Python 3.11
3. Instalacion de dependencias
4. Linting
5. Ejecucion de tests
6. Build de imagen Docker

### 13.3 Pipeline de CD (Despliegue Continuo)

El workflow de CD se ejecuta cuando CI es exitoso en la rama principal.

**Etapas del despliegue:**

1. Build de la imagen Docker
2. Login en Azure Container Registry (`garcesacr.azurecr.io`)
3. Tag de la imagen con el hash del commit
4. Push de la imagen al ACR
5. Despliegue en Azure App Service

### 13.4 Secretos de GitHub Requeridos

Los siguientes secretos deben estar configurados en los repositorios de GitHub:

| Secreto | Descripcion |
|---------|-------------|
| `AZURE_CREDENTIALS` | Credenciales de servicio principal de Azure (JSON) |
| `ACR_LOGIN_SERVER` | Servidor de ACR (`garcesacr.azurecr.io`) |
| `ACR_USERNAME` | Usuario del ACR |
| `ACR_PASSWORD` | Contrasena del ACR |
| `AZURE_RESOURCE_GROUP` | Grupo de recursos de Azure |
| `APP_NAMES` | Nombres de los Azure App Services |

### 13.5 Diagrama del Pipeline

    Push a main
        |
        v
    GitHub Actions CI
        |
        +-- Lint
        +-- Test
        +-- Build
        |
        v (si CI exitoso)
    GitHub Actions CD
        |
        +-- Docker Build
        +-- Push a ACR (garcesacr.azurecr.io)
        +-- Deploy a Azure App Service
        |
        v
    Aplicacion en Produccion

### 13.6 Despliegue Manual

En caso de necesitar un despliegue manual, se pueden seguir estos pasos:

**Frontend:**

    docker build -t garcesacr.azurecr.io/frontend-segmentacion:latest .
    docker push garcesacr.azurecr.io/frontend-segmentacion:latest
    az webapp restart --name <app-name> --resource-group <resource-group>

**Backend:**

    docker build -t garcesacr.azurecr.io/backend-segmentacion:latest .
    docker push garcesacr.azurecr.io/backend-segmentacion:latest
    az webapp restart --name backendsegmentacion --resource-group <resource-group>

---

## 14. Testing

### 14.1 Testing del Frontend

El frontend utiliza Vitest como framework de testing junto con Testing Library para pruebas de componentes React.

**Configuracion:**

El archivo de configuracion de Vitest se encuentra integrado en la configuracion de Vite (`vite.config.ts`).

**Ejecucion de tests:**

    npm run test           # Ejecutar tests una vez
    npm run test:watch     # Ejecutar tests en modo watch
    npm run test:coverage  # Ejecutar tests con cobertura

**Tipos de tests:**

- **Tests unitarios:** Verificacion de logica de componentes, hooks y utilidades
- **Tests de integracion:** Verificacion de flujos completos de usuario con componentes renderizados
- **Tests de renderizado:** Verificacion de que los componentes se renderizan correctamente con diferentes props

**Herramientas:**

| Herramienta | Proposito |
|------------|-----------|
| Vitest | Runner de tests y assertions |
| @testing-library/react | Renderizado de componentes |
| @testing-library/jest-dom | Matchers adicionales para DOM |
| @testing-library/user-event | Simulacion de interacciones de usuario |

### 14.2 Testing del Backend

**Ejecucion de tests:**

    pytest                          # Ejecutar todos los tests
    pytest -v                       # Modo verbose
    pytest --cov=app                # Con cobertura
    pytest tests/test_auth.py       # Test especifico

**Tipos de tests:**

- **Tests unitarios:** Verificacion de servicios y logica de negocio
- **Tests de API:** Verificacion de endpoints usando TestClient de FastAPI
- **Tests de integracion:** Verificacion de flujos completos con base de datos de prueba

### 14.3 Estrategia de Testing

| Nivel | Cobertura objetivo | Enfoque |
|-------|-------------------|---------|
| Unitario | > 70% | Logica de negocio, servicios, utilidades |
| Integracion | > 50% | Flujos CRUD, autenticacion, clustering |
| E2E | Flujos criticos | Login, alta de planta, medicion, clasificacion |

---

## 15. Monitoreo y Observabilidad

### 15.1 Health Check

El endpoint `GET /api/v1/health` proporciona informacion sobre el estado del servicio:

- Estado general del servicio
- Conectividad con la base de datos
- Version de la aplicacion
- Timestamp actual

### 15.2 Log de Auditoria

El sistema registra automaticamente las operaciones criticas en la tabla `audit_log`:

- Creacion, modificacion y eliminacion de registros
- Operaciones de alta, baja y replante de plantas
- Generacion de reportes
- Cambios en configuracion del sistema
- Intentos de acceso

### 15.3 Azure App Service Monitoring

En el entorno de produccion, Azure App Service proporciona:

- **Metricas:** CPU, memoria, peticiones HTTP, tiempos de respuesta
- **Logs:** Logs de aplicacion y logs del servidor web
- **Alertas:** Configuracion de alertas basadas en metricas
- **Diagnosticos:** Herramientas de diagnostico para problemas de rendimiento

### 15.4 Logs de Aplicacion

El backend genera logs en los siguientes niveles:

| Nivel | Uso |
|-------|-----|
| DEBUG | Informacion detallada para depuracion (solo en desarrollo) |
| INFO | Operaciones normales del sistema |
| WARNING | Situaciones anormales que no impiden la operacion |
| ERROR | Errores que requieren atencion |
| CRITICAL | Errores criticos que impiden la operacion del sistema |

---

## 16. Resolucion de Problemas

### 16.1 Problemas Comunes del Frontend

**Problema:** La aplicacion no carga o muestra pantalla en blanco

- Verificar que el servidor de desarrollo esta corriendo (`npm run dev`)
- Verificar la consola del navegador para errores de JavaScript
- Verificar que la variable `VITE_API_URL` esta configurada correctamente
- Limpiar cache del navegador y archivos de build: `npm run clean && npm run dev`

**Problema:** Error de CORS al hacer peticiones a la API

- Verificar que `CORS_ORIGINS` en el backend incluye el origen del frontend
- En desarrollo local, asegurar que incluya `http://localhost:3100`
- Verificar que no haya diferencias entre `http` y `https`

**Problema:** Los datos no se actualizan en la interfaz

- Verificar que TanStack Query esta invalidando las queries correctamente
- Revisar la configuracion de `staleTime` y `refetchOnWindowFocus`
- Forzar recarga con `queryClient.invalidateQueries()`

### 16.2 Problemas Comunes del Backend

**Problema:** Error de conexion a la base de datos

- Verificar las variables `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Verificar que el ODBC Driver 17 esta instalado correctamente
- Probar la conexion directamente con `pyodbc`:

      import pyodbc
      conn = pyodbc.connect("DRIVER={ODBC Driver 17 for SQL Server};SERVER=<server>;DATABASE=<db>;UID=<user>;PWD=<pwd>")

- En Azure, verificar que la IP del App Service esta en la whitelist del firewall de SQL Server

**Problema:** Error "JWT token expired"

- El token expira despues de 480 minutos (8 horas)
- El frontend debe redirigir al login cuando recibe un 401
- Verificar que el reloj del servidor esta sincronizado

**Problema:** Error al generar reportes PDF

- Verificar que `reportlab` esta instalado correctamente
- Verificar permisos de escritura en el directorio temporal
- Revisar los logs del backend para errores especificos de la libreria

**Problema:** Error de Azure OpenAI

- Verificar que las variables de entorno de Azure OpenAI estan configuradas
- Verificar que el deployment del modelo existe y esta activo
- Verificar cuotas y limites de tasa del servicio
- Revisar el timeout de la peticion (puede ser necesario aumentarlo)

### 16.3 Problemas de Docker

**Problema:** El contenedor del backend no inicia

- Revisar los logs del contenedor: `docker logs <container_id>`
- Verificar que el ODBC Driver se instalo correctamente en el Dockerfile
- Verificar que las variables de entorno estan pasadas al contenedor

**Problema:** Error de build del frontend

- Limpiar los modulos de Node: `rm -rf node_modules && npm install`
- Verificar compatibilidad de versiones de Node.js
- Revisar errores de TypeScript: `npm run type-check`

**Problema:** docker-compose no levanta todos los servicios

- Verificar que los puertos 80 y 8000 no estan en uso
- Revisar el archivo `docker-compose.yml` por errores de sintaxis
- Ejecutar con logs visibles: `docker-compose up --build` (sin `-d`)

### 16.4 Problemas de Despliegue

**Problema:** El pipeline de CD falla

- Verificar que los secretos de GitHub estan configurados correctamente
- Verificar que las credenciales de Azure no han expirado
- Revisar los logs del workflow en la pestana Actions de GitHub

**Problema:** La aplicacion desplegada no responde

- Verificar el estado del App Service en el portal de Azure
- Revisar los logs del App Service en "Log stream"
- Verificar que la imagen Docker se desplego correctamente
- Reiniciar el App Service: `az webapp restart`

### 16.5 Problemas del Algoritmo de Clustering

**Problema:** Las clasificaciones no coinciden con lo esperado

- Verificar que las reglas de clustering estan correctamente definidas en `umbral_calidad`
- Verificar que la especie y grupo de variedad de la medicion coincide con una regla existente
- Revisar los valores de las bandas intermedias para identificar donde difiere
- Ejecutar la clasificacion manualmente para comparar

**Problema:** Mediciones sin clasificar

- Verificar que existe una regla de clustering para la especie/variedad
- Verificar que las metricas obligatorias (Brix, acidez, firmeza) estan completas
- Revisar los logs del servicio de clustering para errores

---

## 17. Glosario

| Termino | Definicion |
|---------|-----------|
| **ACR** | Azure Container Registry - Registro de imagenes Docker en Azure |
| **API** | Application Programming Interface - Interfaz de programacion de aplicaciones |
| **ASGI** | Asynchronous Server Gateway Interface - Interfaz asincrona del servidor |
| **Band-Sum** | Algoritmo de clustering que suma bandas de calidad para clasificar fruta |
| **Brix** | Medida del contenido de azucar en la fruta expresada en grados |
| **CI/CD** | Continuous Integration / Continuous Deployment - Integracion y despliegue continuo |
| **Cluster** | Grupo de clasificacion de calidad de fruta (C1 a C4) |
| **CORS** | Cross-Origin Resource Sharing - Comparticion de recursos entre origenes |
| **CRUD** | Create, Read, Update, Delete - Operaciones basicas de datos |
| **FastAPI** | Framework web moderno de Python para construir APIs |
| **JWT** | JSON Web Token - Token de autenticacion basado en JSON |
| **Kardex** | Registro historico de movimientos de inventario |
| **KPI** | Key Performance Indicator - Indicador clave de rendimiento |
| **Merge** | Operacion de fusion de dos registros duplicados |
| **ODBC** | Open Database Connectivity - Estandar de conexion a bases de datos |
| **ORM** | Object-Relational Mapping - Mapeo objeto-relacional |
| **PMG** | Programa de Mejoramiento Genetico |
| **QR** | Quick Response - Codigo de respuesta rapida para etiquetado |
| **RBAC** | Role-Based Access Control - Control de acceso basado en roles |
| **SPA** | Single Page Application - Aplicacion de pagina unica |
| **SQLModel** | Libreria de Python que combina Pydantic y SQLAlchemy |
| **TestBlock** | Bloque de prueba en campo para evaluacion de nuevas variedades |
| **Uvicorn** | Servidor ASGI de alto rendimiento para Python |
| **Zustand** | Libreria ligera de gestion de estado para React |

---

**Fin del documento**

*Sistema de Segmentacion de Nuevas Especies v4.0 - Manual Tecnico*

*Garces Fruit / Value Data - Abril 2026*

*Documento generado para uso interno del equipo de desarrollo.*
