# Sistema de Segmentacion de Nuevas Especies - Garces Fruit
## Documento de Migracion: Streamlit → React + FastAPI

**Version actual**: v3.4 (Streamlit/Python)
**Target**: React (Frontend) + FastAPI (Backend)
**Fecha**: 2026-03-20
**Base de datos**: SQL Server Azure (se mantiene)

---

## 1. ARQUITECTURA ACTUAL

```
┌─────────────────────────────────────────────────────────┐
│                    STREAMLIT APP                         │
│  app.py (entry point, routing, auth)                    │
│  ├── pages/ (41 archivos de UI)                         │
│  ├── components/ (crud, cards, tables, charts, nav)     │
│  ├── utils/ (auth, helpers, qr, maps, constants)        │
│  └── config/ (settings, styles)                         │
├─────────────────────────────────────────────────────────┤
│                   DATA LAYER                             │
│  database/                                               │
│  ├── db_manager.py (CRUD generico, queries raw)         │
│  ├── repositories.py (cached queries, business logic)   │
│  ├── engine.py (SQLAlchemy connection pool)             │
│  ├── schema.sql (DDL completo)                          │
│  └── models/                                             │
│      ├── entities.py (48 SQLModel classes)              │
│      └── base.py (TABLE_PK_MAP, TABLE_CLASS_MAP)        │
├─────────────────────────────────────────────────────────┤
│              SQL SERVER AZURE                            │
│  Server: tcp:valuedata.database.windows.net,1433        │
│  DB: valuedatadev_2026-01-29T01-40Z                     │
│  Driver: ODBC Driver 17 for SQL Server                  │
│  Pool: 5 base + 10 overflow, recycle 1800s              │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture (React + FastAPI)

```
┌──────────────────────┐     ┌──────────────────────────────┐
│   REACT FRONTEND     │     │      FASTAPI BACKEND         │
│                      │     │                              │
│  /                   │ ──→ │  /api/v1/                    │
│  /mantenedores/*     │     │  ├── /auth (login, logout)   │
│  /inventario         │     │  ├── /mantenedores/*         │
│  /testblock/*        │     │  ├── /inventario/*           │
│  /laboratorio        │     │  ├── /testblock/*            │
│  /labores/*          │     │  ├── /laboratorio/*          │
│  /analisis/*         │     │  ├── /labores/*              │
│  /sistema/*          │     │  ├── /analisis/*             │
│                      │     │  └── /sistema/*              │
│  State: Zustand/     │     │                              │
│  TanStack Query      │     │  ORM: SQLModel               │
│  UI: shadcn/ui       │     │  Auth: JWT + bcrypt          │
│  Charts: Recharts    │     │  Validation: Pydantic        │
└──────────────────────┘     └──────────────────────────────┘
                                        │
                              ┌─────────┴─────────┐
                              │  SQL SERVER AZURE  │
                              │  (misma BD actual) │
                              └───────────────────┘
```

---

## 2. BASE DE DATOS COMPLETA

### 2.1 Tablas Maestras (Lookup/Config)

#### `paises`
```sql
id_pais         INT IDENTITY PK
codigo          VARCHAR(10) UNIQUE NOT NULL  -- ISO 3-letter
nombre          NVARCHAR(100) NOT NULL
nombre_en       NVARCHAR(100)
orden           INT DEFAULT 0
activo          BIT DEFAULT 1
fecha_creacion  DATETIME DEFAULT GETDATE()
```

#### `campos`
```sql
id_campo            INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
ubicacion           NVARCHAR(200)
comuna              NVARCHAR(100)
region              NVARCHAR(100)
direccion           NVARCHAR(200)
hectareas           DECIMAL(10,2)
latitud             DECIMAL(10,7)
longitud            DECIMAL(10,7)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `cuarteles`
```sql
id_cuartel      INT IDENTITY PK
id_campo        INT FK → campos(id_campo)
codigo          VARCHAR(20)
nombre          NVARCHAR(100)
activo          BIT DEFAULT 1
fecha_creacion  DATETIME DEFAULT GETDATE()
```

#### `especies`
```sql
id_especie          INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
nombre_cientifico   NVARCHAR(200)
emoji               NVARCHAR(10)
color_hex           VARCHAR(7)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```
**Datos**: Cerezo, Ciruela, Durazno, Nectarina, Paraguayo, Platerina, Damasco Test

#### `portainjertos`
```sql
id_portainjerto     INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
vigor               NVARCHAR(20)     -- bajo, medio, alto
compatibilidad      NVARCHAR(MAX)    -- JSON
origen              NVARCHAR(100)
cruce               NVARCHAR(200)
especie             NVARCHAR(100)
tipo                NVARCHAR(50)
patron              NVARCHAR(100)
propagacion         NVARCHAR(100)
obtentor            NVARCHAR(100)
sensibilidad        NVARCHAR(200)
susceptibilidades   NVARCHAR(MAX)
ventajas            NVARCHAR(MAX)
notas               NVARCHAR(MAX)
imagen              VARBINARY(MAX)   -- base64 encoded
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```
**Datos**: Maxma 60, Maxma 14, Colt, Gisela 6, Gisela 12, Atlas, Nemaguard, Mariana 2624, Garnem

#### `pmg` (Programa Mejoramiento Genetico)
```sql
id_pmg              INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
licenciante         NVARCHAR(100)
pais_origen         NVARCHAR(50)
pais                NVARCHAR(50)
ciudad              NVARCHAR(100)
email               NVARCHAR(100)
telefono            NVARCHAR(50)
direccion           NVARCHAR(200)
contacto            NVARCHAR(100)
notas               NVARCHAR(MAX)
viveros_chile       NVARCHAR(200)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `pmg_especies`
```sql
id_pmg_especie  INT IDENTITY PK
id_pmg          INT FK → pmg
id_especie      INT FK → especies
activo          BIT DEFAULT 1
fecha_creacion  DATETIME DEFAULT GETDATE()
UNIQUE(id_pmg, id_especie)
```

#### `origenes`
```sql
id_origen           INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
pais                NVARCHAR(50)
tipo                NVARCHAR(50) DEFAULT 'licenciante'
contacto            NVARCHAR(200)
notas               NVARCHAR(MAX)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `viveros`
```sql
id_vivero           INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
id_pmg              INT FK → pmg
representante       NVARCHAR(100)
telefono            NVARCHAR(50)
email               NVARCHAR(100)
direccion           NVARCHAR(200)
comuna              NVARCHAR(100)
region              NVARCHAR(100)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `colores`
```sql
id_color        INT IDENTITY PK
codigo          VARCHAR(20)
nombre          NVARCHAR(50) NOT NULL
tipo            VARCHAR(20) NOT NULL  -- 'fruto', 'pulpa', 'cubrimiento'
aplica_especie  NVARCHAR(200)         -- comma-separated: "Cerezo,Ciruela"
color_hex       VARCHAR(7)
activo          BIT DEFAULT 1
fecha_creacion  DATETIME DEFAULT GETDATE()
UNIQUE(codigo, tipo)
```

#### `susceptibilidades`
```sql
id_suscept          INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
nombre_en           NVARCHAR(100)
descripcion         NVARCHAR(MAX)
categoria           NVARCHAR(50)
severidad           NVARCHAR(20) DEFAULT 'media'  -- baja, media, alta
orden               INT DEFAULT 0
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `variedades`
```sql
id_variedad             INT IDENTITY PK
id_especie              INT FK → especies
id_pmg                  INT FK → pmg
id_origen               INT FK → origenes
codigo                  VARCHAR(20) UNIQUE NOT NULL
nombre                  NVARCHAR(100) NOT NULL
nombre_corto            NVARCHAR(50)
nombre_comercial        NVARCHAR(100)
tipo                    NVARCHAR(20) DEFAULT 'plantada'
origen                  NVARCHAR(100)
anio_introduccion       INT
epoca_cosecha           NVARCHAR(50)    -- from catalogo
epoca                   NVARCHAR(50)
vigor                   NVARCHAR(20)
req_frio_horas          INT
req_frio                NVARCHAR(50)
color_fruto             NVARCHAR(50)    -- legacy text
color_pulpa             NVARCHAR(50)
id_color_fruto          INT FK → colores
id_color_pulpa          INT FK → colores
id_color_cubrimiento    INT FK → colores
calibre_esperado        DECIMAL(5,2)
firmeza_esperada        DECIMAL(5,2)
susceptibilidad         NVARCHAR(MAX)   -- legacy text
estado                  NVARCHAR(20) DEFAULT 'prospecto'
fecha_ultima_visita     DATE
proxima_accion          NVARCHAR(200)
observaciones           NVARCHAR(MAX)
imagen                  VARBINARY(MAX)
alelos                  NVARCHAR(200)
auto_fertil             BIT
activo                  BIT DEFAULT 1
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
usuario_creacion        NVARCHAR(50)
usuario_modificacion    NVARCHAR(50)
```
**65+ variedades** activas (Cerezo: Glen red, Lapins, Santina, Royal Dawn, etc.)

#### `variedad_susceptibilidades`
```sql
id_vs           INT IDENTITY PK
id_variedad     INT FK → variedades
id_suscept      INT FK → susceptibilidades
nivel           NVARCHAR(20) DEFAULT 'media'
notas           NVARCHAR(200)
UNIQUE(id_variedad, id_suscept)
```

#### `tipos_labor`
```sql
id_labor            INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
categoria           NVARCHAR(50)
nombre              NVARCHAR(100) NOT NULL
descripcion         NVARCHAR(MAX)
aplica_especies     NVARCHAR(200)
aplica_a            NVARCHAR(50)   -- planta, hilera, testblock
frecuencia          NVARCHAR(50)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `estados_fenologicos`
```sql
id_estado       INT IDENTITY PK
id_especie      INT FK → especies
codigo          VARCHAR(20)
nombre          NVARCHAR(100)
orden           INT
descripcion     NVARCHAR(MAX)
color_hex       VARCHAR(7)
activo          BIT DEFAULT 1
UNIQUE(id_especie, codigo)
```

#### `estados_planta`
```sql
id_estado           INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
descripcion         NVARCHAR(MAX)
color_hex           VARCHAR(7)
icono               NVARCHAR(10)
requiere_foto       BIT DEFAULT 0
es_final            BIT DEFAULT 0
orden               INT DEFAULT 0
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `temporadas`
```sql
id_temporada    INT IDENTITY PK
codigo          VARCHAR(20) UNIQUE NOT NULL
nombre          NVARCHAR(50) NOT NULL
fecha_inicio    DATE
fecha_fin       DATE
estado          NVARCHAR(20) DEFAULT 'activa'
notas           NVARCHAR(MAX)
activo          BIT DEFAULT 1
fecha_creacion  DATETIME DEFAULT GETDATE()
```

#### `bodegas`
```sql
id_bodega       INT IDENTITY PK
codigo          VARCHAR(20)
nombre          NVARCHAR(100)
ubicacion       NVARCHAR(200)
responsable     NVARCHAR(100)
activo          BIT DEFAULT 1
fecha_creacion  DATETIME DEFAULT GETDATE()
```

#### `catalogos`
```sql
id              INT IDENTITY PK
tipo            VARCHAR(50) NOT NULL
valor           NVARCHAR(100) NOT NULL
descripcion     NVARCHAR(200)
orden           INT DEFAULT 0
UNIQUE(tipo, valor)
```
**Tipos**: epoca_cosecha, estado_variedad, vigor, etc.

#### `correlativos`
```sql
id              INT IDENTITY PK
tipo            VARCHAR(50) UNIQUE NOT NULL
prefijo         VARCHAR(10)
ultimo_numero   INT DEFAULT 0
formato         VARCHAR(20)
fecha_modificacion DATETIME
```

---

### 2.2 Tablas de TestBlock e Infraestructura

#### `centros_costo`
```sql
id                  INT IDENTITY PK  -- NOTE: PK is 'id', not 'id_centro'
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100) NOT NULL
descripcion         NVARCHAR(MAX)
id_campo            INT FK → campos
responsable         NVARCHAR(100)
presupuesto         DECIMAL(12,2)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
fecha_modificacion  DATETIME
usuario_creacion    NVARCHAR(50)
usuario_modificacion NVARCHAR(50)
```

#### `marcos_plantacion`
```sql
id                      INT IDENTITY PK  -- NOTE: PK is 'id', not 'id_marco'
codigo                  VARCHAR(20) UNIQUE NOT NULL
nombre                  NVARCHAR(100) NOT NULL
distancia_hilera        NVARCHAR(20)
distancia_planta        NVARCHAR(20)
sistema_conduccion      NVARCHAR(50)
descripcion             NVARCHAR(MAX)
dist_entre_hileras      DECIMAL(5,2)
dist_entre_plantas      DECIMAL(5,2)
plantas_hectarea        INT
conduccion              NVARCHAR(50)
especie_recomendada     NVARCHAR(100)
activo                  BIT DEFAULT 1
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
usuario_creacion        NVARCHAR(50)
usuario_modificacion    NVARCHAR(50)
```

#### `testblocks`
```sql
id_testblock            INT IDENTITY PK
codigo                  VARCHAR(20) UNIQUE NOT NULL
nombre                  NVARCHAR(100) NOT NULL
id_campo                INT FK → campos (NOT NULL)
id_centro_costo         INT FK → centros_costo(id)
id_cuartel              INT FK → cuarteles
id_marco                INT FK → marcos_plantacion(id)
num_hileras             INT
posiciones_por_hilera   INT
total_posiciones        INT
latitud                 DECIMAL(10,7)
longitud                DECIMAL(10,7)
estado                  VARCHAR(20) DEFAULT 'activo'
fecha_creacion_tb       DATETIME
temporada_inicio        NVARCHAR(20)
notas                   NVARCHAR(MAX)
activo                  BIT DEFAULT 1
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
```
**Stats query** (computed on read):
- pos_alta, pos_baja, pos_replante, pos_vacia = COUNT by estado in posiciones_testblock

#### `testblock_hileras`
```sql
id_hilera               INT IDENTITY PK
id_cuartel              INT FK → cuarteles
numero_hilera           INT NOT NULL
total_posiciones        INT
portainjerto_default_id INT FK → portainjertos
conduccion              NVARCHAR(50)
marco_plantacion        NVARCHAR(50)
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
usuario_creacion        NVARCHAR(50)
```

---

### 2.3 Tablas de Inventario y Plantas

#### `inventario_vivero`
```sql
id_inventario           INT IDENTITY PK
codigo_lote             VARCHAR(50) UNIQUE NOT NULL
id_variedad             INT FK → variedades (NOT NULL)
id_portainjerto         INT FK → portainjertos
id_vivero               INT FK → viveros
id_especie              INT FK → especies
id_pmg                  INT FK → pmg
id_bodega               INT FK → bodegas
tipo_planta             NVARCHAR(50)
tipo_injertacion        NVARCHAR(50)
tipo_patron             NVARCHAR(50)
ubicacion               NVARCHAR(200)
cantidad_inicial        INT NOT NULL
cantidad_actual         INT NOT NULL
cantidad_minima         INT DEFAULT 0
cantidad_comprometida   INT DEFAULT 0
fecha_ingreso           DATE NOT NULL
ano_plantacion          INT
origen                  NVARCHAR(100)
estado                  VARCHAR(20) DEFAULT 'disponible'
observaciones           NVARCHAR(MAX)
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
```
**Estados**: disponible, comprometido, agotado, baja

#### `movimientos_inventario`
```sql
id_movimiento       INT IDENTITY PK
id_inventario       INT FK → inventario_vivero
id_planta           INT FK → plantas
tipo                VARCHAR(30) NOT NULL
    -- CHECK: ingreso, retiro, ajuste_positivo, ajuste_negativo, envio_testblock
cantidad            INT NOT NULL
saldo_anterior      INT
saldo_nuevo         INT
motivo              NVARCHAR(200)
referencia_destino  NVARCHAR(100)
usuario             NVARCHAR(50)
fecha_movimiento    DATETIME DEFAULT GETDATE()
```

#### `posiciones_testblock`
```sql
id_posicion             INT IDENTITY PK
codigo_unico            VARCHAR(30) UNIQUE NOT NULL  -- formato: CUARTEL-H01-P01
id_cuartel              INT FK → cuarteles
id_testblock            INT FK → testblocks
id_variedad             INT FK → variedades
id_portainjerto         INT FK → portainjertos
id_pmg                  INT FK → pmg
id_lote                 INT FK → inventario_vivero
hilera                  INT NOT NULL
posicion                INT NOT NULL
fecha_plantacion        DATETIME
fecha_alta              DATETIME
fecha_baja              DATETIME
estado                  VARCHAR(20) DEFAULT 'vacia'
    -- valores: vacia, alta, baja, replante
cluster_actual          INT
motivo_baja             NVARCHAR(200)
observaciones           NVARCHAR(MAX)
codigo_qr               NVARCHAR(MAX)  -- JSON
usuario_alta            NVARCHAR(50)
usuario_baja            NVARCHAR(50)
protegida               BIT DEFAULT 0
conduccion              NVARCHAR(50)
marco_plantacion        NVARCHAR(50)
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
UNIQUE(id_cuartel, hilera, posicion)
```

#### `plantas`
```sql
id_planta               INT IDENTITY PK
codigo                  VARCHAR(50) UNIQUE  -- formato: LOTE/P001 o CUARTEL-H01-P01
id_posicion             INT FK → posiciones_testblock
id_variedad             INT FK → variedades
id_portainjerto         INT FK → portainjertos
id_especie              INT FK → especies
id_pmg                  INT FK → pmg
id_lote_origen          INT FK → inventario_vivero
condicion               VARCHAR(30) DEFAULT 'EN_EVALUACION'
    -- valores: EN_EVALUACION, BUENA, REGULAR, MALA, MUERTA, DESCARTADA
activa                  BIT DEFAULT 1
ano_plantacion          INT
ano_injertacion         INT
metodo_injertacion      NVARCHAR(50)
tipo_patron             NVARCHAR(50)
conduccion              NVARCHAR(50)
marco_plantacion        NVARCHAR(50)
color_cubrimiento       NVARCHAR(50)
color_pulpa             NVARCHAR(50)
fecha_alta              DATETIME
fecha_baja              DATETIME
motivo_baja             NVARCHAR(200)
observaciones           NVARCHAR(MAX)
fecha_creacion          DATETIME DEFAULT GETDATE()
fecha_modificacion      DATETIME
usuario_creacion        NVARCHAR(50)
usuario_modificacion    NVARCHAR(50)
```
**~2291 plantas activas** distribuidas en 3 testblocks

#### `inventario_testblock` (despachos)
```sql
id_inventario_tb    INT IDENTITY PK
id_inventario       INT FK → inventario_vivero
id_cuartel          INT FK → cuarteles
cantidad_asignada   INT
cantidad_plantada   INT DEFAULT 0
estado              VARCHAR(20) DEFAULT 'pendiente'  -- pendiente, plantado
fecha_despacho      DATETIME
fecha_completado    DATETIME
observaciones       NVARCHAR(MAX)
usuario_creacion    NVARCHAR(50)
fecha_creacion      DATETIME DEFAULT GETDATE()
```

#### `guias_despacho`
```sql
id_guia                 INT IDENTITY PK
numero_guia             VARCHAR(20)  -- correlativo GD-00001
id_bodega_origen        INT FK → bodegas
id_testblock_destino    INT FK → testblocks
estado                  VARCHAR(20) DEFAULT 'pendiente'
total_plantas           INT
responsable             NVARCHAR(100)
motivo                  NVARCHAR(200)
usuario                 NVARCHAR(50)
fecha_creacion          DATETIME DEFAULT GETDATE()
```

#### `historial_posiciones` (V4 audit trail)
```sql
id_historial        INT IDENTITY PK
id_posicion         INT FK → posiciones_testblock
id_planta           INT FK → plantas
id_planta_anterior  INT
accion              VARCHAR(30)  -- alta, baja, replante, alta_masiva, baja_masiva
estado_anterior     VARCHAR(20)
estado_nuevo        VARCHAR(20)
motivo              NVARCHAR(200)
usuario             NVARCHAR(50)
fecha               DATETIME DEFAULT GETDATE()
```

---

### 2.4 Tablas de Laboratorio y Calidad

#### `mediciones_laboratorio`
```sql
id_medicion         INT IDENTITY PK
id_posicion         INT FK → posiciones_testblock
id_planta           INT FK → plantas
temporada           VARCHAR(50)     -- ej: "2024-2025"
fecha_medicion      DATE NOT NULL
fecha_cosecha       DATE
brix                DECIMAL(5,2)    -- contenido azucar, optimo > 18
acidez              DECIMAL(5,3)    -- acidez titulable, optimo 0.5-0.8
firmeza             DECIMAL(5,1)    -- firmeza fruto, optimo > 70
calibre             DECIMAL(5,2)    -- diametro ecuatorial mm, optimo > 28
peso                DECIMAL(6,2)    -- peso promedio gramos
color_pct           INT             -- % cobertura color 0-100
cracking_pct        INT             -- % grietas/partidura 0-100
observaciones       NVARCHAR(MAX)
usuario_registro    NVARCHAR(50)
fecha_creacion      DATETIME DEFAULT GETDATE()
```

#### `clasificacion_cluster`
```sql
id_clasificacion    INT IDENTITY PK
id_medicion         INT FK → mediciones_laboratorio
cluster             INT             -- 1-5 rating (5=best)
banda_brix          INT
banda_firmeza       INT
banda_acidez        INT
banda_calibre       INT
score_total         DECIMAL(5,2)
metodo              VARCHAR(20)     -- 'umbrales' or 'kmeans'
fecha_calculo       DATETIME DEFAULT GETDATE()
```

#### `umbrales_calidad`
```sql
id_umbral           INT IDENTITY PK
id_especie          INT FK → especies
metrica             VARCHAR(20)     -- brix, acidez, firmeza, calibre
banda               INT             -- 1-5
valor_min           DECIMAL(10,3)
valor_max           DECIMAL(10,3)
peso_ponderacion    DECIMAL(5,2)
UNIQUE(id_especie, metrica, banda)
```

#### `registros_fenologicos`
```sql
id_registro         INT IDENTITY PK
id_posicion         INT FK → posiciones_testblock
id_planta           INT FK → plantas
id_estado_fenol     INT FK → estados_fenologicos
temporada           VARCHAR(20)
fecha_registro      DATE NOT NULL
porcentaje          INT             -- % avance fenologico
observaciones       NVARCHAR(MAX)
foto_url            NVARCHAR(500)
usuario_registro    NVARCHAR(50)
fecha_creacion      DATETIME DEFAULT GETDATE()
```

#### `ejecucion_labores`
```sql
id_ejecucion        INT IDENTITY PK
id_posicion         INT FK → posiciones_testblock
id_planta           INT FK → plantas
id_labor            INT FK → tipos_labor
temporada           VARCHAR(20)
fecha_programada    DATE
fecha_ejecucion     DATE
estado              VARCHAR(20) DEFAULT 'ejecutada'
ejecutor            NVARCHAR(100)
duracion_min        INT
observaciones       NVARCHAR(MAX)
usuario_registro    NVARCHAR(50)
fecha_creacion      DATETIME DEFAULT GETDATE()
```

---

### 2.5 Tablas de Analisis y Alertas

#### `paquete_tecnologico`
```sql
id_paquete              INT IDENTITY PK
id_variedad             INT FK → variedades
temporada               VARCHAR(20)
total_posiciones        INT
posiciones_evaluadas    INT
cluster_predominante    INT
brix_promedio           DECIMAL(5,2)
brix_min                DECIMAL(5,2)
brix_max                DECIMAL(5,2)
firmeza_promedio        DECIMAL(5,2)
acidez_promedio         DECIMAL(5,3)
calibre_promedio        DECIMAL(5,2)
score_promedio          DECIMAL(5,2)
recomendacion           NVARCHAR(MAX)
decision                NVARCHAR(50)
fecha_creacion          DATETIME DEFAULT GETDATE()
UNIQUE(id_variedad, temporada)
```

#### `alertas`
```sql
id_alerta           INT IDENTITY PK
id_posicion         INT FK → posiciones_testblock
tipo_alerta         VARCHAR(50)
prioridad           VARCHAR(20)     -- baja, media, alta, critica
titulo              NVARCHAR(200)
descripcion         NVARCHAR(MAX)
valor_detectado     NVARCHAR(50)
umbral_violado      NVARCHAR(50)
estado              VARCHAR(20) DEFAULT 'activa'
usuario_resolucion  NVARCHAR(50)
fecha_resolucion    DATETIME
notas_resolucion    NVARCHAR(MAX)
fecha_creacion      DATETIME DEFAULT GETDATE()
```

#### `reglas_alerta`
```sql
id_regla            INT IDENTITY PK
codigo              VARCHAR(20) UNIQUE NOT NULL
nombre              NVARCHAR(100)
descripcion         NVARCHAR(MAX)
tipo                VARCHAR(50)
condicion           NVARCHAR(MAX)   -- JSON or expression
prioridad_resultado VARCHAR(20)
activo              BIT DEFAULT 1
fecha_creacion      DATETIME DEFAULT GETDATE()
```

---

### 2.6 Tablas de Sistema

#### `usuarios`
```sql
id_usuario          INT IDENTITY PK
username            VARCHAR(50) UNIQUE NOT NULL
nombre_completo     NVARCHAR(100)
email               NVARCHAR(100)
password_hash       VARCHAR(64)     -- bcrypt hash
rol                 VARCHAR(20)     -- admin, agronomo, laboratorio, operador, visualizador
campos_asignados    NVARCHAR(200)   -- comma-separated field IDs
activo              BIT DEFAULT 1
ultimo_acceso       DATETIME
fecha_creacion      DATETIME DEFAULT GETDATE()
```

#### `roles`
```sql
id_rol      INT IDENTITY PK
nombre      VARCHAR(50) UNIQUE NOT NULL
descripcion NVARCHAR(200)
permisos    NVARCHAR(MAX)  -- JSON array
activo      BIT DEFAULT 1
```

#### `audit_log`
```sql
id_log              INT IDENTITY PK
tabla               VARCHAR(50)
registro_id         INT
accion              VARCHAR(20)     -- INSERT, UPDATE, DELETE
datos_anteriores    NVARCHAR(MAX)   -- JSON
datos_nuevos        NVARCHAR(MAX)   -- JSON
usuario             NVARCHAR(50)
ip_address          VARCHAR(45)
fecha               DATETIME DEFAULT GETDATE()
```

---

## 3. RELACIONES (ER Diagram)

```
campos ─────────────── 1:N ──── cuarteles
  │                                 │
  └── 1:N ── testblocks ──────── 1:1 ──┘
                │
                ├── 1:N ── posiciones_testblock
                │              │
                │              ├── 1:1 ── plantas (via id_posicion)
                │              │              │
                │              │              ├── N:1 ── variedades
                │              │              ├── N:1 ── portainjertos
                │              │              ├── N:1 ── especies
                │              │              ├── N:1 ── inventario_vivero (id_lote_origen)
                │              │              │
                │              │              ├── 1:N ── mediciones_laboratorio
                │              │              ├── 1:N ── registros_fenologicos
                │              │              ├── 1:N ── ejecucion_labores
                │              │              └── 1:N ── historial_posiciones
                │              │
                │              ├── N:1 ── variedades
                │              ├── N:1 ── portainjertos
                │              └── N:1 ── inventario_vivero (id_lote)
                │
                └── N:1 ── marcos_plantacion

especies ──── 1:N ── variedades ──── N:1 ── pmg
                │                     │
                │                     └── N:1 ── origenes
                │
                └── 1:N ── estados_fenologicos

variedades ── N:M ── susceptibilidades (via variedad_susceptibilidades)

inventario_vivero ── 1:N ── movimientos_inventario
                  └── 1:N ── inventario_testblock (despachos)

mediciones_laboratorio ── 1:1 ── clasificacion_cluster

variedades ── 1:N ── paquete_tecnologico (por temporada)
           └── 1:N ── bitacora_variedades
```

---

## 4. API ENDPOINTS (Propuesta FastAPI)

### 4.1 Auth
```
POST   /api/v1/auth/login          {username, password} → {token, user}
POST   /api/v1/auth/logout         → {ok}
GET    /api/v1/auth/me             → {user}
```

### 4.2 Mantenedores (CRUD generico)
Para cada entidad: campos, especies, variedades, portainjertos, pmg, viveros,
colores, susceptibilidades, tipos_labor, estados_planta, paises, origenes,
temporadas, bodegas, catalogos

```
GET    /api/v1/{entidad}                → List[Entity]
GET    /api/v1/{entidad}/{id}           → Entity
POST   /api/v1/{entidad}               {data} → Entity
PUT    /api/v1/{entidad}/{id}          {data} → Entity
DELETE /api/v1/{entidad}/{id}           → {ok}  (soft delete)

# Especiales
GET    /api/v1/variedades?especie={id}  → filtrado por especie
GET    /api/v1/variedades/{id}/susceptibilidades → List[VarSuscept]
POST   /api/v1/variedades/bulk-import   {excel_file} → {created, errors}
GET    /api/v1/colores?tipo={tipo}&especie={nombre} → filtrado
GET    /api/v1/catalogos?tipo={tipo}    → valores por tipo
```

### 4.3 Inventario
```
GET    /api/v1/inventario                          → List[Lote] con relaciones
GET    /api/v1/inventario/{id}                     → Lote detalle
POST   /api/v1/inventario                         {data} → Lote
PUT    /api/v1/inventario/{id}                    {data} → Lote
GET    /api/v1/inventario/{id}/movimientos         → List[Movimiento]
POST   /api/v1/inventario/{id}/movimientos        {tipo, cantidad, motivo} → Movimiento
GET    /api/v1/inventario/disponible               → Lotes con stock > 0
GET    /api/v1/inventario/stats                    → {total_lotes, total_stock, etc.}

# Despacho
POST   /api/v1/inventario/despacho                {lote_id, destinos[]} → GuiaDespacho
GET    /api/v1/guias-despacho                      → List[Guia]
GET    /api/v1/guias-despacho/{id}                 → Guia + lineas
```

### 4.4 TestBlock
```
GET    /api/v1/testblocks                          → List[TB] con stats
GET    /api/v1/testblocks/{id}                     → TB detalle
POST   /api/v1/testblocks                         {data} → TB
PUT    /api/v1/testblocks/{id}                    {data} → TB
DELETE /api/v1/testblocks/{id}                     → soft delete
POST   /api/v1/testblocks/{id}/generar-posiciones  → {count}

# Posiciones y Grilla
GET    /api/v1/testblocks/{id}/posiciones          → List[Posicion] con plantas/variedades
GET    /api/v1/testblocks/{id}/grilla              → {hileras, max_pos, posiciones[]}
GET    /api/v1/testblocks/{id}/resumen-hileras     → List[{hilera, total, alta, vacia, baja}]
GET    /api/v1/testblocks/{id}/resumen-variedades  → List[{variedad, cantidad, pct}]

# Operaciones de planta
POST   /api/v1/testblocks/{id}/alta                {id_posicion, id_lote, obs} → Planta
POST   /api/v1/testblocks/{id}/alta-masiva         {h_desde, p_desde, h_hasta, p_hasta, id_lote}
POST   /api/v1/testblocks/{id}/baja                {id_posicion, motivo, obs}
POST   /api/v1/testblocks/{id}/baja-masiva         {ids_posiciones[], motivo, obs}
POST   /api/v1/testblocks/{id}/replante            {id_posicion, id_lote, motivo}

# Configuracion
POST   /api/v1/testblocks/{id}/agregar-hilera      {num_posiciones} → {count}
POST   /api/v1/testblocks/{id}/agregar-posiciones   {hilera, cantidad} → {count}

# Inventario vinculado
GET    /api/v1/testblocks/{id}/pendientes          → List[Despacho pendiente]
GET    /api/v1/testblocks/{id}/inventario-disponible → List[Lote con stock]

# Historial
GET    /api/v1/posiciones/{id}/historial           → List[Historial]

# QR
GET    /api/v1/posiciones/{id}/qr                  → PNG
GET    /api/v1/testblocks/{id}/qr-pdf              → PDF
GET    /api/v1/testblocks/{id}/qr-hilera/{h}       → PDF
```

### 4.5 Laboratorio
```
GET    /api/v1/laboratorio/plantas?testblock={id}&especie={id}  → List[Planta] filtradas
POST   /api/v1/laboratorio/mediciones              {data} → Medicion
GET    /api/v1/laboratorio/mediciones?testblock={id}&temporada={t} → List[Medicion]
GET    /api/v1/laboratorio/kpis?testblock={id}     → {total, brix_prom, firmeza_prom, etc.}
POST   /api/v1/laboratorio/bulk-import             {excel_file} → {created, errors}
```

### 4.6 Labores
```
GET    /api/v1/labores/planificacion?testblock={id} → List[Labor planificada]
POST   /api/v1/labores/planificacion               {data} → Labor
PUT    /api/v1/labores/ejecucion/{id}              {fecha_ejecucion, obs} → Labor ejecutada
GET    /api/v1/labores/ordenes-trabajo?testblock={id}&fecha={d} → List[Orden]
```

### 4.7 Analisis
```
GET    /api/v1/analisis/dashboard?temporada={t}     → {kpis, charts_data}
GET    /api/v1/analisis/paquetes?temporada={t}      → List[PaqueteTecnologico]
GET    /api/v1/analisis/clusters?testblock={id}     → List[ClasificacionCluster]
```

### 4.8 Alertas
```
GET    /api/v1/alertas?estado=activa                → List[Alerta]
PUT    /api/v1/alertas/{id}/resolver                {notas, usuario} → Alerta
GET    /api/v1/alertas/reglas                       → List[Regla]
POST   /api/v1/alertas/reglas                      {data} → Regla
```

### 4.9 Sistema
```
GET    /api/v1/usuarios                            → List[Usuario]
POST   /api/v1/usuarios                           {data} → Usuario
PUT    /api/v1/usuarios/{id}                      {data} → Usuario
PUT    /api/v1/usuarios/{id}/password              {new_password} → {ok}

GET    /api/v1/roles                               → List[Rol]
GET    /api/v1/audit-log?tabla={t}&fecha_desde={d}  → List[AuditLog]
```

---

## 5. PAGINAS Y COMPONENTES (React)

### 5.1 Estructura de Rutas

```
/                               → Home (dashboard resumido)
/login                          → Login page

/mantenedores                   → Hub con cards
/mantenedores/especies          → CRUD tabla
/mantenedores/variedades        → CRUD + tabs (listado, nueva, bitacora, historial, bulk)
/mantenedores/portainjertos     → CRUD tabla
/mantenedores/pmg               → CRUD tabla
/mantenedores/viveros           → CRUD tabla
/mantenedores/campos            → CRUD tabla + mapa
/mantenedores/colores           → CRUD tabla
/mantenedores/susceptibilidades → CRUD tabla
/mantenedores/tipos-labor       → CRUD tabla
/mantenedores/estados-planta    → CRUD tabla
/mantenedores/paises            → CRUD tabla
/mantenedores/origenes          → CRUD tabla
/mantenedores/temporadas        → CRUD tabla
/mantenedores/bodegas           → CRUD tabla

/inventario                     → Tabs: listado, nuevo, kardex, guias, resumen
/inventario/:id                 → Detalle lote + movimientos

/testblocks                     → Lista testblocks
/testblocks/nuevo               → Crear testblock
/testblocks/:id                 → Gestion (tabs: grilla, detalle, resumen, inventario, config)
/testblocks/:id/laboratorio     → Mediciones de calidad

/labores                        → Tabs: planificacion, ejecucion, ordenes
/analisis                       → Dashboard + charts
/alertas                        → Centro de alertas

/sistema/usuarios               → CRUD usuarios
/sistema/roles                  → CRUD roles
/sistema/audit-log              → Visor log auditoria
/sistema/catalogos              → Editor catalogos
```

### 5.2 Componentes Reutilizables

```
<CrudTable>           → Tabla generica con sorting, filtros, paginacion, acciones inline
<CrudForm>            → Formulario generico basado en schema de campos
<BulkImport>          → Upload Excel + preview + confirmacion
<KpiCard>             → Tarjeta de metrica con icono, valor, trend
<StatusBadge>         → Badge coloreado por estado (alta=verde, baja=rojo, etc.)
<ColorPicker>         → Selector de color hex
<SearchableSelect>    → Selectbox con busqueda
<FilterBar>           → Barra de filtros multi-campo
<DataGrid>            → Grilla interactiva de TestBlock (componente custom)
<PlantCard>           → Card de detalle de planta (variedad, PI, estado, codigos)
<InventoryLotCard>    → Card de lote de inventario con stock
<TimelineHistory>     → Timeline de historial de posicion
<QrViewer>            → Visualizador de QR con descarga
<ChartContainer>      → Wrapper para Recharts con responsive
```

### 5.3 Estado Global (Zustand stores)

```typescript
// authStore
{
  user: User | null,
  token: string | null,
  login(username, password): Promise<void>,
  logout(): void,
}

// testblockStore
{
  selectedTestblock: number | null,
  selectedPosition: number | null,
  colorMode: 'estado' | 'variedad',
  displayMode: 'variedad+id' | 'variedad+pi' | 'variedad' | 'id' | 'codigo',
  setSelectedPosition(id: number): void,
  clearSelection(): void,
}

// inventarioStore
{
  selectedLote: number | null,
}
```

---

## 6. REGLAS DE NEGOCIO CRITICAS

### 6.1 TestBlock
1. No plantar en posicion con planta activa — debe darse de baja primero
2. No plantar sin stock disponible — validar `cantidad_actual > 0`
3. Baja NO devuelve stock al inventario — la planta se pierde
4. Solo eliminar hileras/posiciones vacias — nunca con plantas activas
5. Cada movimiento de inventario debe quedar registrado
6. TestBlock pertenece a un cuartel/campo especifico
7. Baja masiva requiere confirmacion con resumen de plantas afectadas

### 6.2 Inventario
1. `cantidad_actual` no puede ser negativa
2. Cada ingreso/retiro/ajuste crea registro en `movimientos_inventario`
3. Despacho crea `inventario_testblock` + `guia_despacho`
4. Al plantar, se descuenta `cantidad_actual` del lote origen
5. Codigo de lote es unico y auto-generado

### 6.3 Laboratorio
1. Medicion requiere: temporada, fecha_medicion, id_posicion
2. Brix, firmeza, calibre, peso son opcionales pero recomendados
3. Al guardar medicion, auto-trigger clasificacion cluster
4. Umbrales de calidad son por especie

### 6.4 Usuarios
1. Password almacenado como bcrypt hash
2. Roles: admin (todo), agronomo (testblock+lab), laboratorio (solo lab), operador (ejecucion), visualizador (solo lectura)
3. `campos_asignados` filtra acceso por campo

### 6.5 Auditoria
1. Todo INSERT/UPDATE/DELETE se loguea en `audit_log`
2. Soft delete por defecto (`activo = 0`)
3. Datos anteriores y nuevos almacenados como JSON

---

## 7. VOLUMETRIA ACTUAL

| Tabla | Registros |
|-------|-----------|
| posiciones_testblock | ~2,400 |
| plantas (activas) | ~2,291 |
| variedades | ~65 |
| portainjertos | ~10 |
| especies | 7 |
| inventario_vivero | ~75 lotes |
| mediciones_laboratorio | (en crecimiento) |
| testblocks (activos) | 3 |
| campos | ~3 |
| usuarios | ~5 |

---

## 8. CONFIGURACION Y CONSTANTES

```python
# settings.py
APP_NAME = "Sistema Segmentacion Especies"
APP_VERSION = "3.4.0"
COMPANY_NAME = "Garces Fruit"
CURRENT_SEASON = "2024-2025"

# Umbrales calidad (defaults)
BRIX_MIN = 14.0, BRIX_MAX = 22.0
FIRMEZA_MIN = 60.0, FIRMEZA_MAX = 85.0
ACIDEZ_MIN = 0.4, ACIDEZ_MAX = 1.2
CALIBRE_OPTIMO = 28.0  # mm

# Alertas
DAYS_WITHOUT_REGISTRY_WARNING = 7
LOW_STOCK_THRESHOLD_PCT = 20.0

# Estados de posicion
ESTADOS_POSICION = ['vacia', 'alta', 'baja', 'replante']

# Condiciones de planta
CONDICIONES_PLANTA = ['EN_EVALUACION', 'BUENA', 'REGULAR', 'MALA', 'MUERTA', 'DESCARTADA']

# Motivos de baja
MOTIVOS_BAJA = [
    "Planta muerta", "Planta seca", "Enfermedad",
    "Dano mecanico", "Helada", "Replante programado",
    "Error de registro", "Otro"
]

# Tipos movimiento inventario
TIPOS_MOVIMIENTO = ['ingreso', 'retiro', 'ajuste_positivo', 'ajuste_negativo', 'envio_testblock']

# Roles de usuario
ROLES = ['admin', 'agronomo', 'laboratorio', 'operador', 'visualizador']
```

---

## 9. DEPENDENCIAS Y STACK

### Actual (Streamlit)
```
streamlit==1.40.1, sqlalchemy==2.0.25, sqlmodel==0.0.22
pyodbc==5.1.0, pandas==2.1.4, plotly==5.18.0
bcrypt==4.2.1, python-dotenv==1.0.0, openpyxl==3.1.2
qrcode==7.4.2, Pillow, reportlab (PDF)
```

### Propuesto (React + FastAPI)

**Backend (FastAPI)**:
```
fastapi, uvicorn, sqlmodel, sqlalchemy
pyodbc (SQL Server), python-jose[cryptography] (JWT)
bcrypt, python-dotenv, openpyxl
qrcode, Pillow, reportlab
pydantic (validacion), python-multipart (file upload)
```

**Frontend (React)**:
```
react 18+, react-router-dom
@tanstack/react-query (server state)
zustand (client state)
shadcn/ui + tailwindcss (UI components)
recharts (charts)
@tanstack/react-table (data tables)
lucide-react (icons)
react-hot-toast (notifications)
xlsx (Excel import/export)
```

---

## 10. ASSETS Y ARCHIVOS ESTATICOS

```
assets/
├── garces_data_analytics.png    # Logo empresa (topbar, login)
└── defectos/                    # 150+ imagenes de referencia
    ├── cherry_plum_*.jpg        # Defectos cerezo/ciruela
    └── nectarines_*.jpg         # Defectos nectarina
```

---

## 11. MIGRACION PASO A PASO

### Fase 1: Backend FastAPI
1. Crear proyecto FastAPI con estructura:
   ```
   backend/
   ├── app/
   │   ├── main.py
   │   ├── config.py
   │   ├── database/
   │   │   ├── engine.py
   │   │   ├── models.py (copiar SQLModel entities)
   │   │   └── repositories.py
   │   ├── api/
   │   │   ├── auth.py
   │   │   ├── mantenedores.py (CRUD generico)
   │   │   ├── inventario.py
   │   │   ├── testblock.py
   │   │   ├── laboratorio.py
   │   │   ├── labores.py
   │   │   ├── analisis.py
   │   │   └── sistema.py
   │   ├── schemas/ (Pydantic request/response)
   │   ├── services/ (business logic)
   │   └── middleware/ (auth, audit, cors)
   ```
2. Copiar modelos SQLModel tal cual (ya son Pydantic-compatible)
3. Implementar JWT auth (reemplazar session_state)
4. Migrar queries de db_manager.py a endpoints
5. Migrar logica de repositories.py a services/
6. Implementar audit middleware

### Fase 2: Frontend React
1. Crear proyecto con Vite + React + TypeScript
2. Configurar shadcn/ui + tailwindcss
3. Implementar rutas (react-router-dom)
4. Crear componentes genericos (CrudTable, CrudForm, etc.)
5. Implementar paginas en orden:
   - Auth (login/logout)
   - Home
   - Mantenedores (CRUD generico reutilizable)
   - Inventario
   - TestBlock (grilla interactiva es el mas complejo)
   - Laboratorio
   - Labores
   - Dashboard/Analisis
   - Sistema

### Fase 3: Integracion
1. Conectar frontend a API
2. Testing E2E
3. Deploy (Docker containers)

---

*Documento generado automaticamente desde el analisis del codigo fuente.*
*Para preguntas contactar al equipo de desarrollo.*
