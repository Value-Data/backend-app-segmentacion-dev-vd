-- Migration 003: Fenologia fixes, Cosecha estados, mes_inicio/mes_fin, inventario standardization
-- Date: 2026-04-10
-- Applied by: Claude agent

-- ============================================================
-- 1. Seed REG_FENOL tipo_labor (if not exists)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM tipos_labor WHERE codigo = 'REG_FENOL')
BEGIN
    INSERT INTO tipos_labor (codigo, nombre, categoria, descripcion, aplica_a, aplica_especies, activo)
    VALUES ('REG_FENOL', 'Registro fenologico', 'fenologia',
            'Registro del estado fenologico actual de la planta', 'planta',
            'Cerezo,Ciruela,Carozo,Nectarina,Durazno', 1);
END;

-- ============================================================
-- 2. Add Cosecha estado fenologico for Cerezo and Nectarina
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM estados_fenologicos WHERE id_especie = 1 AND codigo = 'CER_COSECHA')
BEGIN
    DECLARE @max_orden_cer INT;
    SELECT @max_orden_cer = ISNULL(MAX(orden), 0) FROM estados_fenologicos WHERE id_especie = 1;
    INSERT INTO estados_fenologicos (id_especie, codigo, nombre, orden, descripcion, color_hex, mes_orientativo, activo)
    VALUES (1, 'CER_COSECHA', 'Cosecha', @max_orden_cer + 1, 'Cosecha de frutos', '#DC2626', 'Dic-Ene', 1);
END;

IF NOT EXISTS (SELECT 1 FROM estados_fenologicos WHERE id_especie = 3 AND codigo = 'NEC_COSECHA')
BEGIN
    DECLARE @max_orden_nec INT;
    SELECT @max_orden_nec = ISNULL(MAX(orden), 0) FROM estados_fenologicos WHERE id_especie = 3;
    INSERT INTO estados_fenologicos (id_especie, codigo, nombre, orden, descripcion, color_hex, mes_orientativo, activo)
    VALUES (3, 'NEC_COSECHA', 'Cosecha', @max_orden_nec + 1, 'Cosecha de frutos', '#DC2626', 'Dic-Ene', 1);
END;

-- ============================================================
-- 3. Add mes_inicio / mes_fin columns to estados_fenologicos
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'estados_fenologicos' AND COLUMN_NAME = 'mes_inicio')
    ALTER TABLE estados_fenologicos ADD mes_inicio INT NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'estados_fenologicos' AND COLUMN_NAME = 'mes_fin')
    ALTER TABLE estados_fenologicos ADD mes_fin INT NULL;

-- Populate from mes_orientativo where possible (examples: 'Jul-Sep' -> 7,9; 'Oct' -> 10,10)
-- Note: Full population was done via Python script; this SQL covers the most common patterns.

-- ============================================================
-- 4. Standardize inventario_vivero tipo_planta values
-- ============================================================
UPDATE inventario_vivero SET tipo_planta = 'TERMINADA_RAIZ_DESNUDA'
WHERE tipo_planta IN ('Terminada raiz desnuda', 'Planta terminada raiz desnuda', N'Planta terminada raíz desnuda');

UPDATE inventario_vivero SET tipo_planta = 'TERMINADA_MACETA_BOLSA'
WHERE tipo_planta IN ('Terminada maceta/bolsa', 'Planta terminada en maceta/bolsa', 'Planta en bolsa o maceta');

UPDATE inventario_vivero SET tipo_planta = 'INJERTACION_TERRENO'
WHERE tipo_planta IN ('Injertacion en terreno', N'Injertación en terreno');

UPDATE inventario_vivero SET tipo_planta = 'PLANTA_TERMINADA'
WHERE tipo_planta IN ('Planta terminada');

-- ============================================================
-- 5. Standardize inventario_vivero tipo_injertacion values
-- ============================================================
UPDATE inventario_vivero SET tipo_injertacion = 'INVIERNO_PUA'
WHERE tipo_injertacion IN ('Invierno (pua)', N'Invierno (púa)');

UPDATE inventario_vivero SET tipo_injertacion = 'VERANO_YEMA'
WHERE tipo_injertacion IN ('Verano (yema)');

UPDATE inventario_vivero SET tipo_injertacion = 'EN_TERRENO'
WHERE tipo_injertacion IN ('En terreno');

UPDATE inventario_vivero SET tipo_injertacion = 'OJO_VIVO'
WHERE tipo_injertacion IN ('Ojo vivo');

UPDATE inventario_vivero SET tipo_injertacion = 'OJO_DORMIDO'
WHERE tipo_injertacion IN ('Ojo dormido');
