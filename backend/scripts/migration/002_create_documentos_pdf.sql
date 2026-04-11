-- =============================================================================
-- Migration: Tabla documentos_pdf
-- Almacena PDFs generados en base64 indexados por RUT
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'documentos_pdf')
BEGIN
    CREATE TABLE documentos_pdf (
        id_documento      INT IDENTITY(1,1) PRIMARY KEY,
        rut               VARCHAR(20) NOT NULL,
        tipo_reporte      VARCHAR(50) NOT NULL,
        nombre_archivo    NVARCHAR(200) NOT NULL,
        descripcion       NVARCHAR(500) NULL,
        pdf_base64        NVARCHAR(MAX) NOT NULL,
        tamano_bytes      INT NULL,
        id_entidad        INT NULL,
        usuario_creacion  NVARCHAR(100) NULL,
        fecha_creacion    DATETIME DEFAULT GETDATE(),
        activo            BIT DEFAULT 1
    );

    CREATE INDEX IX_documentos_pdf_rut ON documentos_pdf (rut);
    CREATE INDEX IX_documentos_pdf_tipo ON documentos_pdf (tipo_reporte);
    CREATE INDEX IX_documentos_pdf_fecha ON documentos_pdf (fecha_creacion DESC);
END;
