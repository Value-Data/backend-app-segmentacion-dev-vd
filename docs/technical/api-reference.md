# Referencia de API

## Sistema de Segmentacion de Nuevas Especies - Garces Fruit

**Base URL**: `/api/v1`
**Formato**: JSON
**Autenticacion**: JWT Bearer Token (excepto `/auth/login`)

---

## 1. Auth (`/api/v1/auth`)

### POST `/auth/login`
Autentica un usuario y retorna un token JWT.

**Request Body**:
```json
{
  "username": "admin",
  "password": "secreto123"
}
```

**Response** `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id_usuario": 1,
    "username": "admin",
    "nombre_completo": "Administrador",
    "rol": "admin",
    "campos_asignados": "1,2,3"
  }
}
```

**Errores**: `401 Unauthorized` (credenciales invalidas)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "secreto123"}'
```

### POST `/auth/logout`
Invalida la sesion del usuario.

**Headers**: `Authorization: Bearer <token>`
**Response** `200`: `{"ok": true}`

### GET `/auth/me`
Retorna los datos del usuario autenticado.

**Headers**: `Authorization: Bearer <token>`
**Response** `200`:
```json
{
  "id_usuario": 1,
  "username": "admin",
  "nombre_completo": "Administrador",
  "email": "admin@garcesfruit.cl",
  "rol": "admin",
  "campos_asignados": "1,2,3",
  "activo": true
}
```

---

## 2. Mantenedores (`/api/v1/{entidad}`)

CRUD generico para las siguientes entidades: `campos`, `especies`, `variedades`, `portainjertos`, `pmg`, `viveros`, `colores`, `susceptibilidades`, `tipos-labor`, `estados-planta`, `paises`, `origenes`, `temporadas`, `bodegas`, `catalogos`.

### GET `/{entidad}`
Lista todos los registros activos.

**Response** `200`: `List[Entity]`

```bash
curl http://localhost:8000/api/v1/especies \
  -H "Authorization: Bearer <token>"
```

### GET `/{entidad}/{id}`
Retorna un registro por su ID.

**Response** `200`: `Entity`
**Errores**: `404 Not Found`

```bash
curl http://localhost:8000/api/v1/especies/1 \
  -H "Authorization: Bearer <token>"
```

### POST `/{entidad}`
Crea un nuevo registro.

**Request Body**: Campos de la entidad (sin id, sin fecha_creacion)
**Response** `201`: `Entity` (con id generado)

```bash
curl -X POST http://localhost:8000/api/v1/especies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"codigo": "MAN", "nombre": "Manzana", "nombre_cientifico": "Malus domestica"}'
```

### PUT `/{entidad}/{id}`
Actualiza un registro existente.

**Request Body**: Campos a actualizar
**Response** `200`: `Entity` (actualizada)
**Errores**: `404 Not Found`

```bash
curl -X PUT http://localhost:8000/api/v1/especies/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Cerezo (actualizado)"}'
```

### DELETE `/{entidad}/{id}`
Soft delete: establece `activo = 0`.

**Response** `200`: `{"ok": true}`
**Errores**: `404 Not Found`

```bash
curl -X DELETE http://localhost:8000/api/v1/especies/8 \
  -H "Authorization: Bearer <token>"
```

### Endpoints Especiales de Mantenedores

#### GET `/variedades?especie={id}`
Filtra variedades por especie.

```bash
curl "http://localhost:8000/api/v1/variedades?especie=1" \
  -H "Authorization: Bearer <token>"
```

#### GET `/variedades/{id}/susceptibilidades`
Lista susceptibilidades de una variedad con nivel.

**Response** `200`:
```json
[
  {
    "id_vs": 1,
    "id_variedad": 5,
    "id_suscept": 3,
    "nivel": "alta",
    "nombre_susceptibilidad": "Cracking"
  }
]
```

#### POST `/variedades/bulk-import`
Importa variedades desde archivo Excel.

**Request**: `multipart/form-data` con campo `file` (xlsx)
**Response** `200`:
```json
{
  "created": 12,
  "errors": [
    {"row": 5, "error": "Codigo duplicado: VAR-001"}
  ]
}
```

#### GET `/colores?tipo={tipo}&especie={nombre}`
Filtra colores por tipo (fruto, pulpa, cubrimiento) y especie.

```bash
curl "http://localhost:8000/api/v1/colores?tipo=fruto&especie=Cerezo" \
  -H "Authorization: Bearer <token>"
```

#### GET `/catalogos?tipo={tipo}`
Filtra valores de catalogo por tipo.

```bash
curl "http://localhost:8000/api/v1/catalogos?tipo=epoca_cosecha" \
  -H "Authorization: Bearer <token>"
```

---

## 3. Inventario (`/api/v1/inventario`)

### GET `/inventario`
Lista todos los lotes de inventario con relaciones (variedad, portainjerto, vivero, especie).

**Response** `200`: `List[Lote]`

### GET `/inventario/{id}`
Detalle de un lote con todos sus datos.

**Response** `200`: `Lote`

### POST `/inventario`
Crea un nuevo lote de inventario.

**Request Body**:
```json
{
  "id_variedad": 5,
  "id_portainjerto": 1,
  "id_vivero": 2,
  "id_especie": 1,
  "id_bodega": 1,
  "tipo_planta": "Planta terminada",
  "cantidad_inicial": 100,
  "cantidad_actual": 100,
  "fecha_ingreso": "2025-06-15",
  "observaciones": "Lote ingresado para testeo"
}
```

**Response** `201`: `Lote` (con codigo_lote auto-generado)

```bash
curl -X POST http://localhost:8000/api/v1/inventario \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"id_variedad": 5, "id_portainjerto": 1, "cantidad_inicial": 100, "cantidad_actual": 100, "fecha_ingreso": "2025-06-15"}'
```

### PUT `/inventario/{id}`
Actualiza datos de un lote.

### GET `/inventario/{id}/movimientos`
Lista movimientos (kardex) de un lote.

**Response** `200`:
```json
[
  {
    "id_movimiento": 1,
    "tipo": "ingreso",
    "cantidad": 100,
    "saldo_anterior": 0,
    "saldo_nuevo": 100,
    "motivo": "Ingreso inicial",
    "usuario": "admin",
    "fecha_movimiento": "2025-06-15T10:00:00"
  }
]
```

### POST `/inventario/{id}/movimientos`
Registra un movimiento de inventario.

**Request Body**:
```json
{
  "tipo": "retiro",
  "cantidad": 10,
  "motivo": "Retiro por calidad insuficiente"
}
```

**Response** `201`: `Movimiento`

### GET `/inventario/disponible`
Lista lotes con stock disponible (`cantidad_actual > 0`).

### GET `/inventario/stats`
Estadisticas de inventario.

**Response** `200`:
```json
{
  "total_lotes": 75,
  "total_stock": 3500,
  "lotes_disponibles": 60,
  "lotes_agotados": 15,
  "por_especie": [
    {"especie": "Cerezo", "lotes": 30, "stock": 1500}
  ]
}
```

### POST `/inventario/despacho`
Crea un despacho de inventario hacia un testblock.

**Request Body**:
```json
{
  "lote_id": 5,
  "destinos": [
    {"id_testblock": 1, "cantidad": 20}
  ]
}
```

**Response** `201`: `GuiaDespacho`

### GET `/guias-despacho`
Lista todas las guias de despacho.

### GET `/guias-despacho/{id}`
Detalle de una guia con sus lineas.

---

## 4. TestBlock (`/api/v1/testblocks`)

### GET `/testblocks`
Lista testblocks con estadisticas calculadas (pos_alta, pos_baja, pos_replante, pos_vacia).

**Response** `200`:
```json
[
  {
    "id_testblock": 1,
    "codigo": "TB-001",
    "nombre": "TestBlock Principal",
    "campo": "Campo 1",
    "num_hileras": 20,
    "total_posiciones": 800,
    "pos_alta": 720,
    "pos_baja": 30,
    "pos_replante": 10,
    "pos_vacia": 40,
    "estado": "activo"
  }
]
```

### GET `/testblocks/{id}`
Detalle completo del testblock.

### POST `/testblocks`
Crea un nuevo testblock.

**Request Body**:
```json
{
  "codigo": "TB-004",
  "nombre": "TestBlock Nuevo",
  "id_campo": 1,
  "id_cuartel": 3,
  "id_marco": 1,
  "num_hileras": 10,
  "posiciones_por_hilera": 40
}
```

### PUT `/testblocks/{id}`
Actualiza datos del testblock.

### DELETE `/testblocks/{id}`
Soft delete del testblock.

### POST `/testblocks/{id}/generar-posiciones`
Genera la grilla de posiciones segun hileras y posiciones configuradas.

**Response** `200`: `{"count": 400}`

### GET `/testblocks/{id}/posiciones`
Lista todas las posiciones con datos de planta y variedad.

### GET `/testblocks/{id}/grilla`
Retorna la grilla estructurada para renderizar.

**Response** `200`:
```json
{
  "hileras": 20,
  "max_pos": 40,
  "posiciones": [
    {
      "id_posicion": 1,
      "hilera": 1,
      "posicion": 1,
      "estado": "alta",
      "variedad": "Lapins",
      "portainjerto": "Maxma 60",
      "codigo_unico": "C01-H01-P01"
    }
  ]
}
```

### GET `/testblocks/{id}/resumen-hileras`
Resumen de ocupacion por hilera.

**Response** `200`:
```json
[
  {"hilera": 1, "total": 40, "alta": 38, "vacia": 1, "baja": 1, "replante": 0}
]
```

### GET `/testblocks/{id}/resumen-variedades`
Distribucion de variedades en el testblock.

**Response** `200`:
```json
[
  {"variedad": "Lapins", "cantidad": 120, "porcentaje": 15.0}
]
```

### POST `/testblocks/{id}/alta`
Da de alta una planta en una posicion.

**Request Body**:
```json
{
  "id_posicion": 150,
  "id_lote": 5,
  "observaciones": "Planta en buen estado"
}
```

**Response** `201`: `Planta`

**Reglas**: La posicion debe estar vacia. El lote debe tener stock disponible.

### POST `/testblocks/{id}/alta-masiva`
Alta masiva de plantas en un rango de posiciones.

**Request Body**:
```json
{
  "h_desde": 1, "p_desde": 1,
  "h_hasta": 1, "p_hasta": 40,
  "id_lote": 5
}
```

### POST `/testblocks/{id}/baja`
Da de baja una planta (la planta se pierde, NO devuelve stock).

**Request Body**:
```json
{
  "id_posicion": 150,
  "motivo": "Planta muerta",
  "observaciones": "Dano por helada"
}
```

### POST `/testblocks/{id}/baja-masiva`
Baja masiva de multiples posiciones.

**Request Body**:
```json
{
  "ids_posiciones": [150, 151, 152],
  "motivo": "Helada",
  "observaciones": "Dano generalizado en hilera 5"
}
```

### POST `/testblocks/{id}/replante`
Replanta en una posicion con baja.

**Request Body**:
```json
{
  "id_posicion": 150,
  "id_lote": 8,
  "motivo": "Replante programado"
}
```

### POST `/testblocks/{id}/agregar-hilera`
Agrega una hilera nueva al testblock.

**Request Body**: `{"num_posiciones": 40}`
**Response** `200`: `{"count": 40}`

### POST `/testblocks/{id}/agregar-posiciones`
Agrega posiciones a una hilera existente.

**Request Body**: `{"hilera": 5, "cantidad": 10}`
**Response** `200`: `{"count": 10}`

### GET `/testblocks/{id}/pendientes`
Lista despachos pendientes hacia este testblock.

### GET `/testblocks/{id}/inventario-disponible`
Lista lotes con stock disponible para plantar en este testblock.

### GET `/posiciones/{id}/historial`
Historial de cambios de una posicion.

**Response** `200`:
```json
[
  {
    "accion": "alta",
    "estado_anterior": "vacia",
    "estado_nuevo": "alta",
    "motivo": null,
    "usuario": "agronomo1",
    "fecha": "2025-07-01T08:30:00"
  }
]
```

### GET `/posiciones/{id}/qr`
Genera codigo QR como imagen PNG para una posicion.

**Response**: `image/png`

### GET `/testblocks/{id}/qr-pdf`
Genera PDF con todos los QR del testblock.

**Response**: `application/pdf`

### GET `/testblocks/{id}/qr-hilera/{h}`
Genera PDF con QR de una hilera especifica.

**Response**: `application/pdf`

---

## 5. Laboratorio (`/api/v1/laboratorio`)

### GET `/laboratorio/plantas?testblock={id}&especie={id}`
Lista plantas filtrables para seleccionar antes de medir.

### POST `/laboratorio/mediciones`
Registra una medicion de calidad. Auto-genera clasificacion cluster.

**Request Body**:
```json
{
  "id_posicion": 150,
  "id_planta": 200,
  "temporada": "2024-2025",
  "fecha_medicion": "2025-01-15",
  "brix": 18.5,
  "acidez": 0.65,
  "firmeza": 72.0,
  "calibre": 30.2,
  "peso": 12.5,
  "color_pct": 85,
  "cracking_pct": 5,
  "observaciones": "Fruto en buen estado"
}
```

**Response** `201`: `Medicion` (con clasificacion_cluster auto-generada)

```bash
curl -X POST http://localhost:8000/api/v1/laboratorio/mediciones \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"id_posicion": 150, "id_planta": 200, "temporada": "2024-2025", "fecha_medicion": "2025-01-15", "brix": 18.5, "firmeza": 72.0}'
```

### GET `/laboratorio/mediciones?testblock={id}&temporada={t}`
Lista mediciones filtradas por testblock y temporada.

### GET `/laboratorio/kpis?testblock={id}`
KPIs de calidad del testblock.

**Response** `200`:
```json
{
  "total_mediciones": 150,
  "brix_promedio": 17.8,
  "firmeza_promedio": 68.5,
  "acidez_promedio": 0.72,
  "calibre_promedio": 28.1,
  "cluster_distribucion": {
    "1": 10, "2": 25, "3": 45, "4": 50, "5": 20
  }
}
```

### POST `/laboratorio/bulk-import`
Importa mediciones desde archivo Excel.

**Request**: `multipart/form-data` con campo `file` (xlsx)
**Response** `200`: `{"created": 50, "errors": [...]}`

---

## 6. Labores (`/api/v1/labores`)

### GET `/labores/planificacion?testblock={id}`
Lista labores planificadas para un testblock.

### POST `/labores/planificacion`
Crea una labor planificada.

**Request Body**:
```json
{
  "id_posicion": 150,
  "id_planta": 200,
  "id_labor": 3,
  "temporada": "2024-2025",
  "fecha_programada": "2025-02-01"
}
```

### PUT `/labores/ejecucion/{id}`
Marca una labor como ejecutada.

**Request Body**:
```json
{
  "fecha_ejecucion": "2025-02-03",
  "ejecutor": "Juan Perez",
  "duracion_min": 30,
  "observaciones": "Poda completada sin novedad"
}
```

### GET `/labores/ordenes-trabajo?testblock={id}&fecha={d}`
Lista ordenes de trabajo para un dia y testblock.

---

## 7. Analisis (`/api/v1/analisis`)

### GET `/analisis/dashboard?temporada={t}`
Datos agregados para el dashboard de analisis.

**Response** `200`:
```json
{
  "kpis": {
    "total_variedades_evaluadas": 45,
    "cluster_5_count": 12,
    "brix_promedio_general": 17.5
  },
  "charts_data": {
    "por_especie": [...],
    "por_cluster": [...],
    "tendencia_temporal": [...]
  }
}
```

### GET `/analisis/paquetes?temporada={t}`
Lista paquetes tecnologicos (resumen por variedad/temporada).

**Response** `200`:
```json
[
  {
    "id_paquete": 1,
    "variedad": "Lapins",
    "temporada": "2024-2025",
    "total_posiciones": 120,
    "posiciones_evaluadas": 85,
    "cluster_predominante": 4,
    "brix_promedio": 18.2,
    "score_promedio": 78.5,
    "decision": "plantar"
  }
]
```

### GET `/analisis/clusters?testblock={id}`
Lista clasificaciones de cluster por testblock.

---

## 8. Alertas (`/api/v1/alertas`)

### GET `/alertas?estado=activa`
Lista alertas filtradas por estado.

**Response** `200`:
```json
[
  {
    "id_alerta": 1,
    "tipo_alerta": "calidad_baja",
    "prioridad": "alta",
    "titulo": "Brix bajo en posicion C01-H03-P12",
    "descripcion": "Brix medido: 12.5, umbral minimo: 14.0",
    "valor_detectado": "12.5",
    "umbral_violado": "14.0",
    "estado": "activa",
    "fecha_creacion": "2025-01-20T15:30:00"
  }
]
```

### PUT `/alertas/{id}/resolver`
Marca una alerta como resuelta.

**Request Body**:
```json
{
  "notas": "Se verifico en terreno, planta en recuperacion",
  "usuario": "agronomo1"
}
```

### GET `/alertas/reglas`
Lista reglas de alerta configuradas.

### POST `/alertas/reglas`
Crea una nueva regla de alerta.

**Request Body**:
```json
{
  "codigo": "BRIX_BAJO",
  "nombre": "Brix bajo",
  "tipo": "calidad",
  "condicion": "{\"metrica\": \"brix\", \"operador\": \"<\", \"valor\": 14.0}",
  "prioridad_resultado": "alta"
}
```

---

## 9. Sistema (`/api/v1/sistema`)

### GET `/usuarios`
Lista todos los usuarios. **Requiere rol**: admin.

### POST `/usuarios`
Crea un nuevo usuario.

**Request Body**:
```json
{
  "username": "agronomo2",
  "nombre_completo": "Maria Lopez",
  "email": "mlopez@garcesfruit.cl",
  "password": "temporal123",
  "rol": "agronomo",
  "campos_asignados": "1,2"
}
```

### PUT `/usuarios/{id}`
Actualiza datos de un usuario.

### PUT `/usuarios/{id}/password`
Cambia la contrasena de un usuario.

**Request Body**: `{"new_password": "nueva_clave_456"}`
**Response** `200`: `{"ok": true}`

### GET `/roles`
Lista roles disponibles con sus permisos.

### GET `/audit-log?tabla={t}&fecha_desde={d}`
Consulta el log de auditoria.

**Response** `200`:
```json
[
  {
    "id_log": 1,
    "tabla": "variedades",
    "registro_id": 5,
    "accion": "UPDATE",
    "datos_anteriores": "{\"nombre\": \"Lapins\"}",
    "datos_nuevos": "{\"nombre\": \"Lapins (actualizado)\"}",
    "usuario": "admin",
    "ip_address": "192.168.1.100",
    "fecha": "2025-01-20T10:00:00"
  }
]
```

```bash
curl "http://localhost:8000/api/v1/audit-log?tabla=variedades&fecha_desde=2025-01-01" \
  -H "Authorization: Bearer <token>"
```

---

## Codigos de Estado HTTP

| Codigo | Significado |
|--------|------------|
| `200` | Operacion exitosa |
| `201` | Recurso creado |
| `400` | Request invalido (validacion Pydantic) |
| `401` | No autenticado (token faltante o expirado) |
| `403` | No autorizado (rol insuficiente) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: codigo duplicado) |
| `422` | Error de validacion (Pydantic) |
| `500` | Error interno del servidor |
