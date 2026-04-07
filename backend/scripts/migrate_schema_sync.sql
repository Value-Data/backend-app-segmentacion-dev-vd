-- =============================================================================
-- Migration: sync models with real DB schema
-- Date: 2026-04-07
-- =============================================================================

-- ─── 1. ADD MISSING COLUMNS TO pmg ─────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pmg') AND name = 'contacto_nombre')
    ALTER TABLE pmg ADD contacto_nombre NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pmg') AND name = 'contacto_email')
    ALTER TABLE pmg ADD contacto_email NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pmg') AND name = 'contacto_telefono')
    ALTER TABLE pmg ADD contacto_telefono NVARCHAR(50) NULL;
GO

-- ─── 2. ADD MISSING COLUMNS TO variedades ──────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'color')
    ALTER TABLE variedades ADD color NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'familia_genetica')
    ALTER TABLE variedades ADD familia_genetica NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'fecha_cosecha_ref')
    ALTER TABLE variedades ADD fecha_cosecha_ref NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'fertilidad')
    ALTER TABLE variedades ADD fertilidad NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'polinizantes')
    ALTER TABLE variedades ADD polinizantes NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'portainjertos_recomendados')
    ALTER TABLE variedades ADD portainjertos_recomendados NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('variedades') AND name = 'recomendaciones')
    ALTER TABLE variedades ADD recomendaciones NVARCHAR(MAX) NULL;
GO

-- ─── 3. CREATE detalles_labor TABLE ────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'detalles_labor')
BEGIN
    CREATE TABLE detalles_labor (
        id_detalle INT IDENTITY(1,1) PRIMARY KEY,
        id_labor INT NOT NULL REFERENCES tipos_labor(id_labor),
        descripcion NVARCHAR(500) NOT NULL,
        aplica_especie NVARCHAR(100) NULL,
        orden INT DEFAULT 0,
        es_checklist BIT DEFAULT 1,
        activo BIT DEFAULT 1,
        fecha_creacion DATETIME DEFAULT GETUTCDATE(),
        usuario_creacion NVARCHAR(100) NULL,
        fecha_modificacion DATETIME NULL,
        usuario_modificacion NVARCHAR(100) NULL
    );
END
GO

PRINT 'Migration completed successfully';
GO
