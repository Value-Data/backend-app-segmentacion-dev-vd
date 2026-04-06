# Manual de Usuario - Garces Fruit: Segmentacion de Nuevas Especies

## Modulos del Sistema

### Catalogos (Mantenedores)
Tablas maestras: Especies, Variedades, Portainjertos, PMG, Viveros, Campos, Colores, Tipos de Labor, Estados Fenologicos, Estados Planta, etc.

### Operaciones

- **[Inventario y TestBlocks](features/inventario-testblocks.md)**: Gestion de lotes de plantas, testblocks experimentales, alta/baja/replante
- **[Labores y Fenologia](features/labores-fenologia.md)**: Planificacion y ejecucion de labores agricolas, registro fenologico, calendario

### Calidad

- **[Laboratorio y Mediciones](features/laboratorio-mediciones.md)**: Registro de mediciones de calidad (brix, firmeza, calibre), poscosecha, analisis por clusters

### Administracion

- **[Limpieza de Datos](features/limpieza-datos.md)**: Fusionar registros duplicados (PMGs, Viveros, Campos), corregir asociaciones incorrectas

## Roles de Usuario

| Rol | Acceso |
|-----|--------|
| **Admin** | Acceso total: catalogos, inventario, testblocks, labores, laboratorio, sistema |
| **Agronomo** | Testblocks, inventario, labores, fenologia, dashboards |
| **Laboratorio** | Mediciones de calidad, analisis, reportes |
| **Operador** | Ejecutar labores en campo, registrar altas/bajas |
| **Visualizador** | Solo lectura en todo el sistema |
