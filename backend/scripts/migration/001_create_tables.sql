-- =============================================================================
-- DDL Completo - Sistema Segmentacion Nuevas Especies - Garces Fruit
-- Destino: adinf.database.windows.net / adinf
-- 52 tablas en orden topologico (por dependencias FK)
-- =============================================================================

-- ===================== NIVEL 0 - Sin dependencias =====================

CREATE TABLE paises (
    id_pais          INT IDENTITY(1,1) PRIMARY KEY,
    codigo           VARCHAR(10) NOT NULL,
    nombre           NVARCHAR(100) NOT NULL,
    nombre_en        NVARCHAR(100) NULL,
    orden            INT DEFAULT 0,
    activo           BIT DEFAULT 1,
    fecha_creacion   DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_paises_codigo UNIQUE (codigo)
);

CREATE TABLE regiones (
    id_region        INT IDENTITY(1,1) PRIMARY KEY,
    codigo           VARCHAR(5) NOT NULL,
    nombre           NVARCHAR(100) NOT NULL,
    numero           INT NULL,
    orden            INT NULL,
    activo           BIT DEFAULT 1,
    fecha_creacion   DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_regiones_codigo UNIQUE (codigo)
);

CREATE TABLE campos (
    id_campo              INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    ubicacion             NVARCHAR(200) NULL,
    comuna                NVARCHAR(100) NULL,
    region                NVARCHAR(100) NULL,
    direccion             NVARCHAR(200) NULL,
    responsable           NVARCHAR(100) NULL,
    hectareas             DECIMAL(10,2) NULL,
    latitud               DECIMAL(10,7) NULL,
    longitud              DECIMAL(10,7) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    fecha_modificacion    DATETIME NULL,
    usuario_creacion      NVARCHAR(100) NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_campos_codigo UNIQUE (codigo)
);

CREATE TABLE especies (
    id_especie            INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(10) NOT NULL,
    nombre                NVARCHAR(50) NOT NULL,
    nombre_cientifico     NVARCHAR(100) NULL,
    emoji                 NVARCHAR(10) NULL,
    color_hex             VARCHAR(7) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_especies_codigo UNIQUE (codigo)
);

CREATE TABLE portainjertos (
    id_portainjerto       INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(50) NOT NULL,
    vigor                 VARCHAR(20) NULL,
    compatibilidad        NVARCHAR(MAX) NULL,
    origen                NVARCHAR(100) NULL,
    caracteristicas       NVARCHAR(MAX) NULL,
    cruce                 NVARCHAR(200) NULL,
    especie               NVARCHAR(50) NULL,
    tipo                  NVARCHAR(50) NULL,
    patron                NVARCHAR(100) NULL,
    propagacion           NVARCHAR(100) NULL,
    obtentor              NVARCHAR(100) NULL,
    sensibilidad          NVARCHAR(200) NULL,
    susceptibilidades     NVARCHAR(500) NULL,
    ventajas              NVARCHAR(500) NULL,
    notas                 NVARCHAR(MAX) NULL,
    imagen                VARBINARY(MAX) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_portainjertos_codigo UNIQUE (codigo)
);

CREATE TABLE pmg (
    id_pmg                INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    licenciante           NVARCHAR(100) NULL,
    pais_origen           VARCHAR(50) NULL,
    pais                  VARCHAR(50) NULL,
    ciudad                NVARCHAR(100) NULL,
    email                 NVARCHAR(100) NULL,
    telefono              VARCHAR(30) NULL,
    direccion             NVARCHAR(200) NULL,
    contacto              NVARCHAR(200) NULL,
    notas                 NVARCHAR(MAX) NULL,
    contacto_nombre       NVARCHAR(200) NULL,
    contacto_email        NVARCHAR(100) NULL,
    contacto_telefono     NVARCHAR(50) NULL,
    viveros_chile         NVARCHAR(500) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    CONSTRAINT UQ_pmg_codigo UNIQUE (codigo)
);

CREATE TABLE origenes (
    id_origen             INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    pais                  VARCHAR(50) NULL,
    tipo                  VARCHAR(30) NULL,
    contacto              NVARCHAR(200) NULL,
    notas                 NVARCHAR(MAX) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_origenes_codigo UNIQUE (codigo)
);

CREATE TABLE colores (
    id_color              INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(50) NOT NULL,
    tipo                  VARCHAR(20) NOT NULL,
    aplica_especie        NVARCHAR(100) NULL,
    color_hex             VARCHAR(7) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL
);

CREATE TABLE susceptibilidades (
    id_suscept            INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    nombre_en             NVARCHAR(100) NULL,
    descripcion           NVARCHAR(200) NULL,
    categoria             NVARCHAR(50) NULL,
    severidad             VARCHAR(20) DEFAULT 'media',
    orden                 INT DEFAULT 0,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_suscept_codigo UNIQUE (codigo)
);

CREATE TABLE tipos_labor (
    id_labor              INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    categoria             VARCHAR(50) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    descripcion           NVARCHAR(MAX) NULL,
    aplica_especies       NVARCHAR(200) NULL,
    aplica_a              NVARCHAR(100) NULL,
    frecuencia            NVARCHAR(50) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_tipos_labor_codigo UNIQUE (codigo)
);

CREATE TABLE estados_planta (
    id_estado             INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(50) NOT NULL,
    descripcion           NVARCHAR(200) NULL,
    color_hex             VARCHAR(7) NOT NULL,
    icono                 VARCHAR(50) NULL,
    requiere_foto         BIT DEFAULT 0,
    es_final              BIT DEFAULT 0,
    orden                 INT DEFAULT 0,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_estados_planta_codigo UNIQUE (codigo)
);

CREATE TABLE temporadas (
    id_temporada          INT IDENTITY(1,1) PRIMARY KEY,
    codigo                NVARCHAR(20) NOT NULL,
    nombre                NVARCHAR(50) NOT NULL,
    fecha_inicio          DATE NULL,
    fecha_fin             DATE NULL,
    estado                NVARCHAR(20) DEFAULT 'activa',
    notas                 NVARCHAR(MAX) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_temporadas_codigo UNIQUE (codigo)
);

CREATE TABLE bodegas (
    id_bodega             INT IDENTITY(1,1) PRIMARY KEY,
    codigo                NVARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    ubicacion             NVARCHAR(200) NULL,
    responsable           NVARCHAR(100) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE catalogos (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    tipo                  NVARCHAR(100) NOT NULL,
    valor                 NVARCHAR(200) NOT NULL,
    descripcion           NVARCHAR(500) NULL,
    orden                 INT DEFAULT 0,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE correlativos (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    tipo                  VARCHAR(30) NOT NULL,
    prefijo               VARCHAR(10) NOT NULL,
    ultimo_numero         INT DEFAULT 0,
    formato               VARCHAR(50) NULL,
    fecha_modificacion    DATETIME NULL,
    CONSTRAINT UQ_correlativos_tipo UNIQUE (tipo)
);

CREATE TABLE marcos_plantacion (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    codigo                NVARCHAR(50) NOT NULL,
    nombre                NVARCHAR(200) NOT NULL,
    distancia_hilera      DECIMAL(5,2) NULL,
    distancia_planta      DECIMAL(5,2) NULL,
    sistema_conduccion    NVARCHAR(100) NULL,
    descripcion           NVARCHAR(500) NULL,
    dist_entre_hileras    DECIMAL(10,2) NULL,
    dist_entre_plantas    DECIMAL(10,2) NULL,
    plantas_hectarea      INT NULL,
    conduccion            NVARCHAR(100) NULL,
    especie_recomendada   NVARCHAR(100) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    id_marco              INT NULL,
    predeterminado        BIT NULL,
    notas                 NVARCHAR(MAX) NULL,
    CONSTRAINT UQ_marcos_codigo UNIQUE (codigo)
);

CREATE TABLE reglas_alerta (
    id_regla              INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NULL,
    descripcion           NVARCHAR(MAX) NULL,
    tipo                  VARCHAR(50) NULL,
    condicion             NVARCHAR(MAX) NULL,
    prioridad_resultado   VARCHAR(20) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_reglas_alerta_codigo UNIQUE (codigo)
);

CREATE TABLE roles (
    id_rol                INT IDENTITY(1,1) PRIMARY KEY,
    nombre                VARCHAR(50) NOT NULL,
    descripcion           NVARCHAR(200) NULL,
    permisos              NVARCHAR(MAX) NULL,
    activo                BIT DEFAULT 1,
    CONSTRAINT UQ_roles_nombre UNIQUE (nombre)
);

CREATE TABLE defectos (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NULL,
    nombre                VARCHAR(100) NOT NULL,
    nombre_en             VARCHAR(100) NULL,
    categoria             VARCHAR(50) NULL,
    activo                BIT DEFAULT 1,
    orden                 INT NULL,
    created_at            DATETIME NULL,
    updated_at            DATETIME NULL,
    imagen_url            NVARCHAR(500) NULL,
    imagen                VARBINARY(MAX) NULL
);

-- ===================== NIVEL 1 - Dependen de nivel 0 =====================

CREATE TABLE comunas (
    id_comuna             INT IDENTITY(1,1) PRIMARY KEY,
    nombre                NVARCHAR(100) NOT NULL,
    id_region             INT NOT NULL
        CONSTRAINT FK_comunas_region FOREIGN KEY
        REFERENCES regiones(id_region),
    codigo_postal         VARCHAR(10) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE cuarteles (
    id_cuartel            INT IDENTITY(1,1) PRIMARY KEY,
    id_campo              INT NOT NULL
        CONSTRAINT FK_cuarteles_campo FOREIGN KEY
        REFERENCES campos(id_campo),
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    num_hileras           INT NULL,
    pos_por_hilera        INT NULL,
    es_testblock          BIT NULL,
    centro_costo          VARCHAR(50) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    hileras               INT NULL,
    posiciones_por_hilera INT NULL,
    sistema               NVARCHAR(100) NULL,
    notas                 NVARCHAR(MAX) NULL,
    id_centro_costo       INT NULL,
    id_marco              INT NULL,
    latitud               DECIMAL(10,6) NULL,
    longitud              DECIMAL(10,6) NULL,
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    superficie            DECIMAL(10,2) NULL,
    id_especie            INT NULL,
    especies_ids          NVARCHAR(MAX) NULL,
    layout_configurado    BIT NULL
);

CREATE TABLE usuarios (
    id_usuario            INT IDENTITY(1,1) PRIMARY KEY,
    username              VARCHAR(50) NOT NULL,
    nombre_completo       NVARCHAR(100) NOT NULL,
    email                 NVARCHAR(100) NULL,
    password_hash         VARCHAR(64) NULL,
    rol                   VARCHAR(30) NOT NULL,
    campos_asignados      NVARCHAR(MAX) NULL,
    activo                BIT DEFAULT 1,
    ultimo_acceso         DATETIME NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_usuarios_username UNIQUE (username)
);

CREATE TABLE estados_fenologicos (
    id_estado             INT IDENTITY(1,1) PRIMARY KEY,
    id_especie            INT NOT NULL
        CONSTRAINT FK_estadosfenol_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(50) NOT NULL,
    orden                 INT DEFAULT 0,
    descripcion           NVARCHAR(200) NULL,
    color_hex             VARCHAR(7) NULL,
    mes_orientativo       NVARCHAR(20) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL
);

CREATE TABLE centros_costo (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    codigo                NVARCHAR(50) NOT NULL,
    nombre                NVARCHAR(200) NOT NULL,
    descripcion           NVARCHAR(500) NULL,
    id_campo              INT NULL
        CONSTRAINT FK_centroscosto_campo FOREIGN KEY
        REFERENCES campos(id_campo),
    responsable           NVARCHAR(200) NULL,
    presupuesto           DECIMAL(18,2) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_centros_costo_codigo UNIQUE (codigo)
);

CREATE TABLE variedades (
    id_variedad           INT IDENTITY(1,1) PRIMARY KEY,
    id_especie            INT NOT NULL
        CONSTRAINT FK_variedades_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    id_pmg                INT NULL
        CONSTRAINT FK_variedades_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    id_origen             INT NULL
        CONSTRAINT FK_variedades_origen FOREIGN KEY
        REFERENCES origenes(id_origen),
    codigo                VARCHAR(30) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    nombre_corto          VARCHAR(10) NULL,
    nombre_comercial      NVARCHAR(100) NULL,
    tipo                  VARCHAR(20) NULL,
    origen                NVARCHAR(100) NULL,
    anio_introduccion     INT NULL,
    epoca_cosecha         VARCHAR(20) NULL,
    epoca                 VARCHAR(20) NULL,
    vigor                 VARCHAR(20) NULL,
    req_frio_horas        INT NULL,
    req_frio              NVARCHAR(50) NULL,
    color_fruto           NVARCHAR(50) NULL,
    color_pulpa           NVARCHAR(50) NULL,
    id_color_fruto        INT NULL
        CONSTRAINT FK_variedades_colorfruto FOREIGN KEY
        REFERENCES colores(id_color),
    id_color_pulpa        INT NULL
        CONSTRAINT FK_variedades_colorpulpa FOREIGN KEY
        REFERENCES colores(id_color),
    id_color_cubrimiento  INT NULL
        CONSTRAINT FK_variedades_colorcubr FOREIGN KEY
        REFERENCES colores(id_color),
    calibre_esperado      VARCHAR(20) NULL,
    firmeza_esperada      VARCHAR(20) NULL,
    susceptibilidad       NVARCHAR(200) NULL,
    estado                VARCHAR(20) NULL,
    fecha_ultima_visita   DATE NULL,
    proxima_accion        NVARCHAR(200) NULL,
    observaciones         NVARCHAR(MAX) NULL,
    imagen                VARBINARY(MAX) NULL,
    color                 NVARCHAR(50) NULL,
    fertilidad            NVARCHAR(50) NULL,
    alelos                NVARCHAR(200) NULL,
    polinizantes          NVARCHAR(MAX) NULL,
    portainjertos_recomendados NVARCHAR(MAX) NULL,
    familia_genetica      NVARCHAR(100) NULL,
    recomendaciones       NVARCHAR(MAX) NULL,
    fecha_cosecha_ref     NVARCHAR(50) NULL,
    auto_fertil           BIT NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    fecha_modificacion    DATETIME NULL,
    usuario_creacion      NVARCHAR(100) NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_variedades_codigo UNIQUE (codigo)
);

CREATE TABLE pmg_especies (
    id_pmg_especie        INT IDENTITY(1,1) PRIMARY KEY,
    id_pmg                INT NULL
        CONSTRAINT FK_pmgespecies_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    id_especie            INT NULL
        CONSTRAINT FK_pmgespecies_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_pmg_especies UNIQUE (id_pmg, id_especie)
);

CREATE TABLE portainjerto_especies (
    id_pe                 INT IDENTITY(1,1) PRIMARY KEY,
    id_portainjerto       INT NOT NULL
        CONSTRAINT FK_portesp_portainjerto FOREIGN KEY
        REFERENCES portainjertos(id_portainjerto),
    id_especie            INT NOT NULL
        CONSTRAINT FK_portesp_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE viveros (
    id_vivero             INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    id_pmg                INT NULL
        CONSTRAINT FK_viveros_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    representante         NVARCHAR(100) NULL,
    telefono              VARCHAR(30) NULL,
    email                 NVARCHAR(100) NULL,
    direccion             NVARCHAR(200) NULL,
    comuna                NVARCHAR(100) NULL,
    region                NVARCHAR(100) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT UQ_viveros_codigo UNIQUE (codigo)
);

-- ===================== NIVEL 2 - Dependen de nivel 0-1 =====================

CREATE TABLE vivero_pmg (
    id_vp                 INT IDENTITY(1,1) PRIMARY KEY,
    id_vivero             INT NOT NULL
        CONSTRAINT FK_viveropmg_vivero FOREIGN KEY
        REFERENCES viveros(id_vivero),
    id_pmg                INT NOT NULL
        CONSTRAINT FK_viveropmg_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE variedad_susceptibilidades (
    id_vs                 INT IDENTITY(1,1) PRIMARY KEY,
    id_variedad           INT NOT NULL
        CONSTRAINT FK_varsuscept_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_suscept            INT NOT NULL
        CONSTRAINT FK_varsuscept_suscept FOREIGN KEY
        REFERENCES susceptibilidades(id_suscept),
    nivel                 VARCHAR(20) NULL,
    notas                 NVARCHAR(200) NULL,
    CONSTRAINT UQ_variedad_suscept UNIQUE (id_variedad, id_suscept)
);

CREATE TABLE testblocks (
    id_testblock          INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(20) NOT NULL,
    nombre                NVARCHAR(100) NOT NULL,
    id_campo              INT NOT NULL
        CONSTRAINT FK_testblocks_campo FOREIGN KEY
        REFERENCES campos(id_campo),
    id_centro_costo       INT NULL
        CONSTRAINT FK_testblocks_centrocosto FOREIGN KEY
        REFERENCES centros_costo(id),
    id_cuartel            INT NULL
        CONSTRAINT FK_testblocks_cuartel FOREIGN KEY
        REFERENCES cuarteles(id_cuartel),
    id_marco              INT NULL
        CONSTRAINT FK_testblocks_marco FOREIGN KEY
        REFERENCES marcos_plantacion(id),
    num_hileras           INT NULL,
    posiciones_por_hilera INT NULL,
    total_posiciones      INT NULL,
    latitud               DECIMAL(10,7) NULL,
    longitud              DECIMAL(10,7) NULL,
    estado                VARCHAR(20) DEFAULT 'activo',
    fecha_creacion_tb     DATETIME NULL,
    temporada_inicio      VARCHAR(10) NULL,
    notas                 NVARCHAR(MAX) NULL,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    fecha_modificacion    DATETIME NULL,
    CONSTRAINT UQ_testblocks_codigo UNIQUE (codigo)
);

CREATE TABLE inventario_vivero (
    id_inventario          INT IDENTITY(1,1) PRIMARY KEY,
    codigo_lote            VARCHAR(50) NOT NULL,
    id_variedad            INT NULL
        CONSTRAINT FK_invvivero_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_portainjerto        INT NULL
        CONSTRAINT FK_invvivero_portainjerto FOREIGN KEY
        REFERENCES portainjertos(id_portainjerto),
    id_vivero              INT NULL
        CONSTRAINT FK_invvivero_vivero FOREIGN KEY
        REFERENCES viveros(id_vivero),
    id_especie             INT NULL
        CONSTRAINT FK_invvivero_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    id_pmg                 INT NULL
        CONSTRAINT FK_invvivero_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    id_bodega              INT NULL
        CONSTRAINT FK_invvivero_bodega FOREIGN KEY
        REFERENCES bodegas(id_bodega),
    tipo_planta            NVARCHAR(50) NULL,
    tipo_injertacion       NVARCHAR(50) NULL,
    tipo_patron            NVARCHAR(50) NULL,
    ubicacion              NVARCHAR(200) NULL,
    cantidad_inicial       INT NOT NULL,
    cantidad_actual        INT NOT NULL,
    cantidad_minima        INT DEFAULT 0,
    cantidad_comprometida  INT DEFAULT 0,
    fecha_ingreso          DATE NOT NULL,
    ano_plantacion         INT NULL,
    origen                 NVARCHAR(100) NULL,
    estado                 VARCHAR(20) DEFAULT 'disponible',
    observaciones          NVARCHAR(MAX) NULL,
    fecha_creacion         DATETIME DEFAULT GETDATE(),
    fecha_modificacion     DATETIME NULL,
    CONSTRAINT UQ_invvivero_lote UNIQUE (codigo_lote)
);

CREATE TABLE detalles_labor (
    id_detalle            INT IDENTITY(1,1) PRIMARY KEY,
    id_labor              INT NOT NULL
        CONSTRAINT FK_detalleslabor_labor FOREIGN KEY
        REFERENCES tipos_labor(id_labor),
    descripcion           NVARCHAR(500) NOT NULL,
    aplica_especie        NVARCHAR(100) NULL,
    orden                 INT DEFAULT 0,
    es_checklist          BIT DEFAULT 1,
    activo                BIT DEFAULT 1,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    usuario_creacion      NVARCHAR(100) NULL,
    fecha_modificacion    DATETIME NULL,
    usuario_modificacion  NVARCHAR(100) NULL
);

CREATE TABLE variedades_log (
    id_log                INT IDENTITY(1,1) PRIMARY KEY,
    id_variedad           INT NOT NULL
        CONSTRAINT FK_varlog_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    accion                VARCHAR(50) NOT NULL,
    campo_modificado      VARCHAR(100) NULL,
    valor_anterior        NVARCHAR(500) NULL,
    valor_nuevo           NVARCHAR(500) NULL,
    usuario               VARCHAR(50) NULL,
    fecha                 DATETIME NULL,
    notas                 NVARCHAR(500) NULL
);

CREATE TABLE defectos_variedades (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    id_variedad           INT NOT NULL
        CONSTRAINT FK_defvar_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_defecto            INT NOT NULL
        CONSTRAINT FK_defvar_defecto FOREIGN KEY
        REFERENCES defectos(id),
    created_at            DATETIME NULL
);

-- ===================== NIVEL 3 - Dependen de nivel 0-2 =====================

CREATE TABLE testblock_hileras (
    id_hilera                INT IDENTITY(1,1) PRIMARY KEY,
    id_cuartel               INT NOT NULL
        CONSTRAINT FK_tbhileras_cuartel FOREIGN KEY
        REFERENCES cuarteles(id_cuartel),
    numero_hilera            INT NOT NULL,
    total_posiciones         INT NOT NULL,
    portainjerto_default_id  INT NULL
        CONSTRAINT FK_tbhileras_portainjerto FOREIGN KEY
        REFERENCES portainjertos(id_portainjerto),
    conduccion               NVARCHAR(50) NULL,
    marco_plantacion         VARCHAR(20) NULL,
    activo                   BIT DEFAULT 1,
    fecha_creacion           DATETIME DEFAULT GETDATE(),
    usuario_creacion         NVARCHAR(50) NULL
);

CREATE TABLE posiciones_testblock (
    id_posicion           INT IDENTITY(1,1) PRIMARY KEY,
    codigo_unico          VARCHAR(30) NOT NULL,
    id_cuartel            INT NULL
        CONSTRAINT FK_postb_cuartel FOREIGN KEY
        REFERENCES cuarteles(id_cuartel),
    id_testblock          INT NULL
        CONSTRAINT FK_postb_testblock FOREIGN KEY
        REFERENCES testblocks(id_testblock),
    id_variedad           INT NULL
        CONSTRAINT FK_postb_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_portainjerto       INT NULL
        CONSTRAINT FK_postb_portainjerto FOREIGN KEY
        REFERENCES portainjertos(id_portainjerto),
    id_pmg                INT NULL
        CONSTRAINT FK_postb_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    id_lote               INT NULL
        CONSTRAINT FK_postb_lote FOREIGN KEY
        REFERENCES inventario_vivero(id_inventario),
    hilera                INT NOT NULL,
    posicion              INT NOT NULL,
    fecha_plantacion      DATE NULL,
    fecha_alta            DATE NULL,
    fecha_baja            DATE NULL,
    estado                VARCHAR(20) DEFAULT 'vacia',
    cluster_actual        INT NULL,
    motivo_baja           NVARCHAR(200) NULL,
    observaciones         NVARCHAR(MAX) NULL,
    codigo_qr             NVARCHAR(MAX) NULL,
    usuario_alta          NVARCHAR(50) NULL,
    usuario_baja          NVARCHAR(50) NULL,
    protegida             BIT DEFAULT 0,
    conduccion            NVARCHAR(50) NULL,
    marco_plantacion      VARCHAR(20) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    fecha_modificacion    DATETIME NULL,
    CONSTRAINT UQ_postb_codigo UNIQUE (codigo_unico),
    CONSTRAINT UQ_postb_cuartel_hilera_pos
        UNIQUE (id_cuartel, hilera, posicion)
);

CREATE TABLE plantas (
    id_planta             INT IDENTITY(1,1) PRIMARY KEY,
    codigo                VARCHAR(50) NULL,
    id_posicion           INT NULL
        CONSTRAINT FK_plantas_posicion FOREIGN KEY
        REFERENCES posiciones_testblock(id_posicion),
    id_variedad           INT NULL
        CONSTRAINT FK_plantas_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_portainjerto       INT NULL
        CONSTRAINT FK_plantas_portainjerto FOREIGN KEY
        REFERENCES portainjertos(id_portainjerto),
    id_especie            INT NULL
        CONSTRAINT FK_plantas_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    id_pmg                INT NULL
        CONSTRAINT FK_plantas_pmg FOREIGN KEY
        REFERENCES pmg(id_pmg),
    id_lote_origen        INT NULL
        CONSTRAINT FK_plantas_lote FOREIGN KEY
        REFERENCES inventario_vivero(id_inventario),
    condicion             VARCHAR(30) DEFAULT 'EN_EVALUACION',
    activa                BIT DEFAULT 1,
    ano_plantacion        INT NULL,
    ano_injertacion       INT NULL,
    metodo_injertacion    NVARCHAR(50) NULL,
    tipo_patron           NVARCHAR(50) NULL,
    conduccion            NVARCHAR(50) NULL,
    marco_plantacion      VARCHAR(20) NULL,
    color_cubrimiento     NVARCHAR(50) NULL,
    color_pulpa           NVARCHAR(50) NULL,
    fecha_alta            DATE NULL,
    fecha_baja            DATE NULL,
    motivo_baja           NVARCHAR(200) NULL,
    observaciones         NVARCHAR(MAX) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    fecha_modificacion    DATETIME NULL,
    usuario_creacion      NVARCHAR(50) NULL,
    usuario_modificacion  NVARCHAR(50) NULL,
    CONSTRAINT UQ_plantas_codigo UNIQUE (codigo)
);

CREATE TABLE inventario_testblock (
    id_inventario_tb      INT IDENTITY(1,1) PRIMARY KEY,
    id_inventario         INT NULL
        CONSTRAINT FK_invtb_inventario FOREIGN KEY
        REFERENCES inventario_vivero(id_inventario),
    id_cuartel            INT NULL
        CONSTRAINT FK_invtb_cuartel FOREIGN KEY
        REFERENCES cuarteles(id_cuartel),
    cantidad_asignada     INT NULL,
    cantidad_plantada     INT DEFAULT 0,
    estado                VARCHAR(20) DEFAULT 'pendiente',
    fecha_despacho        DATE NULL,
    fecha_completado      DATE NULL,
    observaciones         NVARCHAR(MAX) NULL,
    usuario_creacion      NVARCHAR(50) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE guias_despacho (
    id_guia               INT IDENTITY(1,1) PRIMARY KEY,
    numero_guia           VARCHAR(20) NOT NULL,
    id_bodega_origen      INT NOT NULL
        CONSTRAINT FK_guias_bodega FOREIGN KEY
        REFERENCES bodegas(id_bodega),
    id_testblock_destino  INT NOT NULL
        CONSTRAINT FK_guias_testblock FOREIGN KEY
        REFERENCES testblocks(id_testblock),
    estado                VARCHAR(20) DEFAULT 'pendiente',
    total_plantas         INT NOT NULL,
    responsable           NVARCHAR(100) NULL,
    motivo                NVARCHAR(500) NULL,
    usuario               NVARCHAR(50) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE(),
    fecha_despacho        DATETIME NULL,
    fecha_recepcion       DATETIME NULL,
    notas                 NVARCHAR(MAX) NULL,
    activo                BIT DEFAULT 1
);

CREATE TABLE paquete_tecnologico (
    id_paquete            INT IDENTITY(1,1) PRIMARY KEY,
    id_variedad           INT NOT NULL
        CONSTRAINT FK_paqtec_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    temporada             VARCHAR(50) NOT NULL,
    total_posiciones      INT NULL,
    posiciones_evaluadas  INT NULL,
    cluster_predominante  INT NULL,
    brix_promedio         DECIMAL(5,2) NULL,
    brix_min              DECIMAL(5,2) NULL,
    brix_max              DECIMAL(5,2) NULL,
    firmeza_promedio      DECIMAL(5,2) NULL,
    acidez_promedio       DECIMAL(5,3) NULL,
    calibre_promedio      DECIMAL(5,2) NULL,
    score_promedio        DECIMAL(5,2) NULL,
    recomendacion         NVARCHAR(MAX) NULL,
    decision              VARCHAR(20) NULL,
    fecha_generacion      DATETIME NULL,
    CONSTRAINT UQ_paqtec_variedad_temp
        UNIQUE (id_variedad, temporada)
);

CREATE TABLE bitacora_variedades (
    id_entrada            INT IDENTITY(1,1) PRIMARY KEY,
    id_variedad           INT NOT NULL
        CONSTRAINT FK_bitacora_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    tipo_entrada          VARCHAR(50) NULL,
    fecha                 DATE NULL,
    titulo                NVARCHAR(200) NULL,
    contenido             NVARCHAR(MAX) NULL,
    resultado             VARCHAR(50) NULL,
    id_testblock          INT NULL
        CONSTRAINT FK_bitacora_testblock FOREIGN KEY
        REFERENCES testblocks(id_testblock),
    ubicacion             NVARCHAR(200) NULL,
    usuario               NVARCHAR(50) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE asignaciones_testblock (
    id_asignacion         INT IDENTITY(1,1) PRIMARY KEY,
    id_variedad           INT NOT NULL
        CONSTRAINT FK_asigntb_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_cuartel            INT NOT NULL
        CONSTRAINT FK_asigntb_cuartel FOREIGN KEY
        REFERENCES cuarteles(id_cuartel),
    cantidad_posiciones   INT NULL,
    fecha_asignacion      DATE NULL,
    estado                VARCHAR(20) NULL,
    observaciones         NVARCHAR(MAX) NULL,
    fecha_creacion        DATETIME NULL
);

-- ===================== NIVEL 4 - Dependen de nivel 0-3 =====================

CREATE TABLE movimientos_inventario (
    id_movimiento         INT IDENTITY(1,1) PRIMARY KEY,
    id_inventario         INT NULL
        CONSTRAINT FK_movinv_inventario FOREIGN KEY
        REFERENCES inventario_vivero(id_inventario),
    id_planta             INT NULL
        CONSTRAINT FK_movinv_planta FOREIGN KEY
        REFERENCES plantas(id_planta),
    tipo                  VARCHAR(30) NOT NULL,
    cantidad              INT NOT NULL,
    saldo_anterior        INT NULL,
    saldo_nuevo           INT NULL,
    motivo                NVARCHAR(200) NULL,
    referencia_destino    VARCHAR(50) NULL,
    usuario               NVARCHAR(50) NULL,
    fecha_movimiento      DATETIME DEFAULT GETDATE()
);

CREATE TABLE historial_posicion (
    id_historial          INT IDENTITY(1,1) PRIMARY KEY,
    id_posicion           INT NOT NULL
        CONSTRAINT FK_histpos_posicion FOREIGN KEY
        REFERENCES posiciones_testblock(id_posicion),
    id_planta             INT NULL
        CONSTRAINT FK_histpos_planta FOREIGN KEY
        REFERENCES plantas(id_planta),
    id_planta_anterior    INT NULL
        CONSTRAINT FK_histpos_planta_ant FOREIGN KEY
        REFERENCES plantas(id_planta),
    accion                VARCHAR(20) NOT NULL,
    estado_anterior       VARCHAR(20) NULL,
    estado_nuevo          VARCHAR(20) NULL,
    motivo                NVARCHAR(200) NULL,
    usuario               NVARCHAR(50) NULL,
    fecha                 DATETIME DEFAULT GETDATE()
);

CREATE TABLE mediciones_laboratorio (
    id_medicion             INT IDENTITY(1,1) PRIMARY KEY,
    id_posicion             INT NULL
        CONSTRAINT FK_medlab_posicion FOREIGN KEY
        REFERENCES posiciones_testblock(id_posicion),
    id_planta               INT NULL
        CONSTRAINT FK_medlab_planta FOREIGN KEY
        REFERENCES plantas(id_planta),
    temporada               VARCHAR(50) NULL,
    fecha_medicion          DATE NOT NULL,
    fecha_cosecha           DATE NULL,
    brix                    DECIMAL(5,2) NULL,
    acidez                  DECIMAL(5,3) NULL,
    firmeza                 DECIMAL(5,1) NULL,
    calibre                 DECIMAL(5,2) NULL,
    peso                    DECIMAL(6,2) NULL,
    color_pct               INT NULL,
    cracking_pct            INT NULL,
    observaciones           NVARCHAR(MAX) NULL,
    usuario_registro        NVARCHAR(50) NULL,
    fecha_creacion          DATETIME DEFAULT GETDATE(),
    firmeza_punta           DECIMAL(8,2) NULL,
    firmeza_quilla          DECIMAL(8,2) NULL,
    firmeza_hombro          DECIMAL(8,2) NULL,
    firmeza_mejilla_1       DECIMAL(8,2) NULL,
    firmeza_mejilla_2       DECIMAL(8,2) NULL,
    n_muestra               INT NULL,
    periodo_almacenaje      INT NULL,
    perimetro               DECIMAL(8,2) NULL,
    pardeamiento            DECIMAL(5,2) NULL,
    traslucidez             DECIMAL(5,2) NULL,
    gelificacion            DECIMAL(5,2) NULL,
    harinosidad             DECIMAL(5,2) NULL,
    color_pulpa             NVARCHAR(50) NULL,
    raleo_frutos            INT NULL,
    rendimiento             DECIMAL(10,2) NULL,
    repeticion              INT NULL,
    color_0_30              INT NULL,
    color_30_50             INT NULL,
    color_50_75             INT NULL,
    color_75_100            INT NULL,
    color_total             INT NULL,
    color_verde             INT NULL,
    color_crema             INT NULL,
    color_amarillo          INT NULL,
    color_full              INT NULL,
    color_dist_total        INT NULL,
    total_frutos_pardeamiento  INT NULL,
    total_frutos_traslucidez   INT NULL,
    total_frutos_gelificacion  INT NULL,
    total_frutos_harinosidad   INT NULL,
    id_campo                INT NULL
        CONSTRAINT FK_medlab_campo FOREIGN KEY
        REFERENCES campos(id_campo),
    id_variedad             INT NULL
        CONSTRAINT FK_medlab_variedad FOREIGN KEY
        REFERENCES variedades(id_variedad),
    id_especie              INT NULL
        CONSTRAINT FK_medlab_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    id_portainjerto         INT NULL
        CONSTRAINT FK_medlab_portainjerto FOREIGN KEY
        REFERENCES portainjertos(id_portainjerto)
);

CREATE TABLE ejecucion_labores (
    id_ejecucion          INT IDENTITY(1,1) PRIMARY KEY,
    id_posicion           INT NULL
        CONSTRAINT FK_ejeclabor_posicion FOREIGN KEY
        REFERENCES posiciones_testblock(id_posicion),
    id_planta             INT NULL
        CONSTRAINT FK_ejeclabor_planta FOREIGN KEY
        REFERENCES plantas(id_planta),
    id_labor              INT NULL
        CONSTRAINT FK_ejeclabor_labor FOREIGN KEY
        REFERENCES tipos_labor(id_labor),
    temporada             VARCHAR(20) NULL,
    fecha_programada      DATE NULL,
    fecha_ejecucion       DATE NULL,
    estado                VARCHAR(20) DEFAULT 'ejecutada',
    ejecutor              NVARCHAR(100) NULL,
    duracion_min          INT NULL,
    observaciones         NVARCHAR(MAX) NULL,
    usuario_registro      NVARCHAR(50) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE registros_fenologicos (
    id_registro           INT IDENTITY(1,1) PRIMARY KEY,
    id_posicion           INT NULL
        CONSTRAINT FK_regfenol_posicion FOREIGN KEY
        REFERENCES posiciones_testblock(id_posicion),
    id_planta             INT NULL
        CONSTRAINT FK_regfenol_planta FOREIGN KEY
        REFERENCES plantas(id_planta),
    id_estado_fenol       INT NULL
        CONSTRAINT FK_regfenol_estado FOREIGN KEY
        REFERENCES estados_fenologicos(id_estado),
    temporada             VARCHAR(20) NULL,
    fecha_registro        DATE NOT NULL,
    porcentaje            INT NULL,
    observaciones         NVARCHAR(MAX) NULL,
    foto_url              NVARCHAR(500) NULL,
    usuario_registro      NVARCHAR(50) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE alertas (
    id_alerta             INT IDENTITY(1,1) PRIMARY KEY,
    id_posicion           INT NULL
        CONSTRAINT FK_alertas_posicion FOREIGN KEY
        REFERENCES posiciones_testblock(id_posicion),
    tipo_alerta           VARCHAR(50) NULL,
    prioridad             VARCHAR(20) NULL,
    titulo                NVARCHAR(200) NULL,
    descripcion           NVARCHAR(MAX) NULL,
    valor_detectado       NVARCHAR(50) NULL,
    umbral_violado        NVARCHAR(50) NULL,
    estado                VARCHAR(20) DEFAULT 'activa',
    usuario_resolucion    NVARCHAR(50) NULL,
    fecha_resolucion      DATETIME NULL,
    notas_resolucion      NVARCHAR(MAX) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

-- ===================== NIVEL 5 - Dependen de nivel 0-4 =====================

CREATE TABLE clasificacion_cluster (
    id_clasificacion      INT IDENTITY(1,1) PRIMARY KEY,
    id_medicion           INT NULL
        CONSTRAINT FK_clascluster_medicion FOREIGN KEY
        REFERENCES mediciones_laboratorio(id_medicion),
    cluster               INT NULL,
    banda_brix            INT NULL,
    banda_firmeza         INT NULL,
    banda_acidez          INT NULL,
    banda_calibre         INT NULL,
    score_total           DECIMAL(5,2) NULL,
    metodo                VARCHAR(20) NULL,
    fecha_calculo         DATETIME DEFAULT GETDATE()
);

CREATE TABLE umbrales_calidad (
    id_umbral             INT IDENTITY(1,1) PRIMARY KEY,
    id_especie            INT NOT NULL
        CONSTRAINT FK_umbrales_especie FOREIGN KEY
        REFERENCES especies(id_especie),
    metrica               VARCHAR(30) NOT NULL,
    banda                 INT NOT NULL,
    valor_min             DECIMAL(10,3) NULL,
    valor_max             DECIMAL(10,3) NULL,
    peso_ponderacion      DECIMAL(5,2) NULL,
    activo                BIT DEFAULT 1,
    fecha_modificacion    DATETIME NULL,
    CONSTRAINT UQ_umbrales UNIQUE (id_especie, metrica, banda)
);

CREATE TABLE evidencia_labores (
    id_evidencia          INT IDENTITY(1,1) PRIMARY KEY,
    id_ejecucion          INT NOT NULL
        CONSTRAINT FK_evidencia_ejecucion FOREIGN KEY
        REFERENCES ejecucion_labores(id_ejecucion),
    tipo                  VARCHAR(20) DEFAULT 'foto',
    descripcion           NVARCHAR(200) NULL,
    imagen_base64         NVARCHAR(MAX) NULL,
    url                   NVARCHAR(500) NULL,
    lat                   FLOAT NULL,
    lng                   FLOAT NULL,
    usuario               NVARCHAR(50) NULL,
    fecha_creacion        DATETIME DEFAULT GETDATE()
);

CREATE TABLE audit_log (
    id_log                INT IDENTITY(1,1) PRIMARY KEY,
    tabla                 NVARCHAR(100) NULL,
    registro_id           INT NULL,
    accion                VARCHAR(20) NULL,
    datos_anteriores      NVARCHAR(MAX) NULL,
    datos_nuevos          NVARCHAR(MAX) NULL,
    usuario               NVARCHAR(50) NULL,
    ip_address            NVARCHAR(50) NULL,
    fecha                 DATETIME DEFAULT GETDATE()
);
