# Labores y Fenologia - Manual de Usuario

## 1. Modulo de Labores

El modulo de **Labores** permite planificar, ejecutar y dar seguimiento a todas las actividades agricolas en los TestBlocks.

### 1.1 Acceder a Labores

- Ir a **Labores** en el menu lateral (seccion "Operaciones")
- El badge rojo indica labores atrasadas

### 1.2 Pestanas disponibles

El modulo tiene 6 pestanas:

| Pestana | Funcion |
|---------|---------|
| **Hoy** | Labores pendientes para hoy + atrasadas. Ejecucion rapida con 1 click |
| **Semana** | Vista semanal de labores planificadas |
| **Pauta por Especie** | Cronograma fenologico + labores por especie. Herramienta de planificacion |
| **Plan** | Tabla completa de todas las labores (planificadas + ejecutadas) |
| **Calendario** | Vista mensual con barras por tipo de labor |
| **Atrasadas** | Solo labores vencidas sin ejecutar |

### 1.3 Dashboard KPIs

En la parte superior siempre se muestran:
- **Hoy**: Labores pendientes para hoy
- **Esta semana**: Labores de la semana
- **Atrasadas**: Labores vencidas
- **Cumplimiento**: Porcentaje de labores ejecutadas vs total

---

## 2. Tipos de Labor

Los tipos de labor disponibles son (configurables en Catalogos > Tipos de Labor):

| Tipo | Categoria | Aplica a |
|------|-----------|----------|
| Formacion | Manejo | Planta |
| Plantacion | Manejo | Planta |
| Injertacion | Manejo | Planta |
| Incisiones | Manejo | Planta (Cerezo) |
| Ortopedia | Manejo | Planta (Cerezo, Ciruela) |
| Raleo | Manejo | Planta (Carozo, Ciruela) |
| Cosecha | Cosecha | Planta |
| Riego | Riego | TestBlock |
| Malezas | Fitosanidad | TestBlock |
| Carteles | Manejo | TestBlock |
| Registro fenologico | Fenologia | Planta |

Cada tipo tiene **instrucciones/checklist** detalladas por especie. Para verlas: en Catalogos > Tipos de Labor, click en una labor para expandir sus instrucciones.

---

## 3. Planificar Labores

### 3.1 Planificar para una posicion

1. Ir a pestana **"Plan"** o **"Hoy"**
2. Click en **"+ Planificar"**
3. Seleccionar: Posicion, Tipo de labor, Fecha programada, Temporada
4. Confirmar

### 3.2 Planificar para todo un TestBlock

1. Click en **"Planificar TestBlock"**
2. Seleccionar: TestBlock, Tipo de labor, Fecha
3. El sistema crea una labor para CADA posicion activa del testblock

### 3.3 Planificar desde la Pauta por Especie

1. Ir a pestana **"Pauta por Especie"**
2. Seleccionar la especie
3. Se muestra la pauta completa: estados fenologicos + labores
4. Click en una labor para ver sus instrucciones detalladas
5. Marcar/desmarcar items con los checkboxes
6. Click en **"Aplicar pauta a TestBlock"** para planificar las labores seleccionadas

---

## 4. Ejecutar Labores

### 4.1 Ejecucion rapida (1 click)

En la pestana **"Hoy"** o **"Semana"**:
- Cada labor tiene un boton verde de ejecucion rapida
- Click para marcar como ejecutada con la fecha de hoy

### 4.2 Ejecucion con detalle

1. Click en una labor planificada
2. Completar: Fecha ejecucion, Ejecutor, Duracion (min), Observaciones
3. Confirmar

### 4.3 Ejecucion masiva

1. Seleccionar multiples labores con los checkboxes
2. Click en **"Ejecutar seleccionadas"**
3. Todas se marcan como ejecutadas

### 4.4 Evidencias (fotos)

Despues de ejecutar una labor:
1. Click en el icono de camara
2. Agregar foto (base64 o URL), descripcion, coordenadas GPS
3. Las evidencias quedan vinculadas a la ejecucion

### 4.5 Codigo QR

Cada labor ejecutada tiene un codigo QR que contiene:
- ID de la labor, tipo, posicion, fecha, estado
- Click en el icono QR para generar y descargar

---

## 5. Fenologia

### 5.1 Que es la fenologia?

Los **estados fenologicos** son las etapas del ciclo de vida de la planta:
yema hinchada -> puntas verdes -> flor -> cuaja -> fruto -> viraje -> cosecha -> caida hoja

Cada especie tiene sus propios estados y tiempos.

### 5.2 Ver el ciclo fenologico

1. Ir a **Fenologia** en el menu lateral
2. Seleccionar una especie (Cerezo, Ciruela, Carozo, etc.)
3. Se muestra la lista de estados ordenados con:
   - Color identificador
   - Nombre del estado
   - Mes orientativo (rango amplio para cubrir variedades tempranas y tardias)

### 5.3 Registrar un estado fenologico

**Desde Fenologia:**
1. Seleccionar especie
2. Hover sobre un estado > click **"Registrar"**
3. Seleccionar TestBlock
4. Indicar porcentaje (ej: 50% de las plantas en este estado)
5. Agregar observaciones
6. Confirmar -> Se registra para TODAS las posiciones activas del TB

**Desde Labores > Pauta por Especie:**
1. Los estados fenologicos aparecen con dot de color en la pauta
2. Registrar como parte del flujo de labores

### 5.4 Historial fenologico

En la pagina de Fenologia, seccion inferior:
- Seleccionar TestBlock con el dropdown
- Se muestran los ultimos registros fenologicos con fecha, estado, porcentaje

### 5.5 Mantenedor de estados fenologicos

Para agregar, editar o eliminar estados fenologicos:
1. Ir a **Catalogos > Estados Fenologicos**
2. Filtrar por especie
3. Editar campos: nombre, codigo, orden, color, mes orientativo
4. Los meses ya vienen con rangos amplios (ej: "Mar-Jun") para cubrir variedades tempranas/tardias

---

## 6. Calendario de Labores

La pestana **"Calendario"** muestra una vista mensual:
- Barras de color por tipo de labor
- Verde: ejecutadas, Amarillo: planificadas, Rojo: atrasadas
- Navegar por meses con las flechas
- Click en una celda para ver el detalle de ese dia
