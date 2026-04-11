"""Configuracion de conexiones origen y destino."""
import os

# ORIGEN: SQL Server Azure (produccion actual)
SOURCE_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=tcp:valuedata.database.windows.net,1433;"
    "DATABASE=valuedatadev_2026-01-29T01-40Z;"
    f"UID={os.environ.get('DB_SOURCE_USER', '')};"
    f"PWD={os.environ.get('DB_SOURCE_PASS', '')};"
    "Encrypt=yes;TrustServerCertificate=no;"
    "Connection Timeout=30;"
)

# DESTINO: SQL Server Azure (adinf) via Entra ID
DEST_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=tcp:adinf.database.windows.net,1433;"
    "DATABASE=adinf;"
    "UID=administrador;"
    f"PWD={os.environ.get('DB_DEST_PASS', '')};"
    "Encrypt=yes;TrustServerCertificate=no;"
    "Connection Timeout=30;"
)

BATCH_SIZE = 500  # Filas por INSERT batch

# Orden topologico de carga respetando foreign keys
MIGRATION_ORDER = [
    # Nivel 0 - Sin dependencias
    "paises", "regiones", "campos", "especies",
    "portainjertos", "pmg", "origenes", "colores",
    "susceptibilidades", "tipos_labor", "estados_planta",
    "temporadas", "bodegas", "catalogos", "correlativos",
    "marcos_plantacion", "reglas_alerta", "roles", "defectos",
    # Nivel 1 - Dependen de nivel 0
    "comunas", "cuarteles", "pmg_especies",
    "portainjerto_especies", "viveros",
    "estados_fenologicos", "centros_costo",
    "usuarios", "variedades",
    # Nivel 2 - Dependen de nivel 0-1
    "vivero_pmg", "variedad_susceptibilidades",
    "testblocks", "inventario_vivero",
    "detalles_labor", "variedades_log",
    "defectos_variedades",
    # Nivel 3 - Dependen de nivel 0-2
    "testblock_hileras", "posiciones_testblock",
    "plantas", "inventario_testblock",
    "guias_despacho", "paquete_tecnologico",
    "bitacora_variedades", "asignaciones_testblock",
    # Nivel 4 - Dependen de nivel 0-3
    "movimientos_inventario", "historial_posicion",
    "mediciones_laboratorio", "ejecucion_labores",
    "registros_fenologicos", "alertas",
    # Nivel 5 - Dependen de nivel 0-4
    "clasificacion_cluster", "umbrales_calidad",
    "evidencia_labores", "audit_log",
]

# Mapa tabla -> PK para IDENTITY_INSERT
TABLE_PK = {
    "paises": "id_pais", "regiones": "id_region",
    "comunas": "id_comuna", "campos": "id_campo",
    "cuarteles": "id_cuartel", "especies": "id_especie",
    "portainjertos": "id_portainjerto", "pmg": "id_pmg",
    "pmg_especies": "id_pmg_especie",
    "portainjerto_especies": "id_pe",
    "vivero_pmg": "id_vp", "origenes": "id_origen",
    "viveros": "id_vivero", "colores": "id_color",
    "susceptibilidades": "id_suscept",
    "variedades": "id_variedad",
    "variedad_susceptibilidades": "id_vs",
    "tipos_labor": "id_labor",
    "estados_fenologicos": "id_estado",
    "estados_planta": "id_estado",
    "temporadas": "id_temporada",
    "bodegas": "id_bodega",
    "catalogos": "id", "correlativos": "id",
    "centros_costo": "id", "marcos_plantacion": "id",
    "testblocks": "id_testblock",
    "testblock_hileras": "id_hilera",
    "inventario_vivero": "id_inventario",
    "movimientos_inventario": "id_movimiento",
    "posiciones_testblock": "id_posicion",
    "plantas": "id_planta",
    "inventario_testblock": "id_inventario_tb",
    "guias_despacho": "id_guia",
    "historial_posicion": "id_historial",
    "mediciones_laboratorio": "id_medicion",
    "clasificacion_cluster": "id_clasificacion",
    "umbrales_calidad": "id_umbral",
    "registros_fenologicos": "id_registro",
    "detalles_labor": "id_detalle",
    "ejecucion_labores": "id_ejecucion",
    "paquete_tecnologico": "id_paquete",
    "alertas": "id_alerta",
    "reglas_alerta": "id_regla",
    "bitacora_variedades": "id_entrada",
    "usuarios": "id_usuario",
    "roles": "id_rol",
    "audit_log": "id_log",
    "evidencia_labores": "id_evidencia",
    "variedades_log": "id_log",
    "defectos": "id", "defectos_variedades": "id",
    "asignaciones_testblock": "id_asignacion",
}
