# Inventario y TestBlocks - Manual de Usuario

## 1. Inventario de Plantas

El modulo de **Inventario** gestiona los lotes de material vegetal disponible para plantar en los TestBlocks experimentales.

### 1.1 Ver inventario

- Ir a **Inventario Vivero** en el menu lateral
- Se muestra una tabla con todos los lotes activos
- Columnas: Codigo lote, Variedad, Portainjerto, Especie, Tipo Planta, Ano, Stock, Estado
- Usar los filtros de **Especie** y **Tipo Planta** para acotar la busqueda
- Click en un lote para ver su detalle completo

### 1.2 Crear nuevo lote (Wizard)

Click en **"+ Nuevo Lote"** para abrir el asistente de 3 pasos:

**Paso 1 - Define la planta:**
- **Especie** (requerido): Cerezo, Ciruela, Carozo, etc.
- **Variedad** (opcional si hay portainjerto): Se filtra automaticamente por especie y PMG seleccionado
- **Portainjerto** (opcional si hay variedad): Al menos uno de los dos es requerido
- **PMG** (opcional): Si seleccionas PMG primero, las variedades se filtran para mostrar solo las de ese programa

**Paso 2 - Datos del lote:**
- **Codigo lote** (requerido): Identificador unico del lote
- **Cantidad inicial** (requerido): Numero de plantas en el lote
- **Tipo Planta**: "Planta terminada raiz desnuda", "Planta en bolsa o maceta", o "Ramillas"
- **Tipo Injerto**: "Ojo vivo", "Ojo dormido", "Invierno (pua)"
- **Vivero Origen**: De donde viene el material
- **Fecha ingreso**: Cuando llego el material

**Paso 3 - Confirmar:**
- Revisa los datos y confirma

### 1.3 Movimientos de inventario

Cada vez que se planta (alta) una planta del inventario:
- El stock del lote se reduce en 1
- Se registra un movimiento de tipo "PLANTACION"
- Si el stock llega a 0, el lote pasa a estado "agotado"

> **Importante:** La baja de una planta NO devuelve stock al inventario. La planta se pierde.

---

## 2. TestBlocks

Los **TestBlocks** son bloques experimentales donde se plantan las variedades para evaluacion.

### 2.1 Ver TestBlocks

- Ir a **TestBlocks** en el menu lateral
- Se muestra la lista de todos los TestBlocks con sus KPIs
- Click en uno para ver su detalle (grilla, plantas, mediciones)

### 2.2 Crear un TestBlock

1. Click en **"+ Nuevo TestBlock"**
2. Completar: Codigo, Nombre, Campo, Hileras, Posiciones por hilera
3. El sistema crea la grilla de posiciones automaticamente

### 2.3 Agregar hileras y posiciones

- En el detalle del TestBlock, pestana **"Estructura"** o usar los botones:
  - **Agregar Hilera**: Agrega una hilera completa al final con N posiciones
  - **Agregar Posiciones**: Agrega posiciones adicionales a una hilera existente

### 2.4 La Grilla

La grilla muestra visualmente todas las posiciones del TestBlock:
- **Verde**: Posicion con planta activa (alta)
- **Gris claro**: Posicion vacia
- **Rojo**: Posicion con planta dada de baja
- Click en cualquier celda para ver el detalle de la posicion

En el panel de detalle de cada posicion se muestra:
- Variedad, Portainjerto, Tipo planta, Ano plantacion, Tipo injerto
- Conduccion, Marco plantacion
- Estado actual
- Lote de origen

---

## 3. Alta de Plantas (Plantar)

### 3.1 Alta individual

1. En la grilla del TestBlock, click en una **posicion vacia**
2. En el panel lateral, click en **"Alta"**
3. Seleccionar el **lote de inventario** del cual proviene la planta
4. Confirmar

El sistema:
- Crea la planta en la posicion
- Descuenta 1 del stock del lote
- Registra el movimiento de inventario
- Actualiza el estado de la posicion a "alta"

### 3.2 Alta masiva

1. En el detalle del TestBlock, click en **"Alta Masiva"**
2. Seleccionar el lote de origen
3. Seleccionar las posiciones donde plantar (o "todas las vacias")
4. Confirmar

### 3.3 Que necesito para dar alta?

- El lote debe tener **stock disponible** (cantidad_actual > 0)
- La posicion debe estar **vacia** (no puede tener otra planta activa)
- Si la posicion tiene una planta activa, primero debes darla de **baja**

---

## 4. Baja de Plantas

### 4.1 Baja individual

1. En la grilla, click en una **posicion con planta** (verde)
2. En el panel lateral, click en **"Baja"**
3. Seleccionar el **motivo de baja**: muerte, enfermedad, descarte, error, otro
4. Opcionalmente agregar observaciones
5. Confirmar

El sistema:
- Desactiva la planta (activa = false)
- Actualiza la posicion a estado "baja"
- Registra en el historial
- **NO devuelve stock al inventario**

### 4.2 Baja masiva

Seleccionar multiples posiciones y usar "Baja Masiva" con un motivo comun.

---

## 5. Replante

El replante permite poner una nueva planta en una posicion que tuvo una baja.

1. En la grilla, click en una **posicion con baja** (roja)
2. Click en **"Replante"**
3. Seleccionar el nuevo lote de origen
4. Confirmar

El sistema:
- Crea una nueva planta en la posicion
- La posicion vuelve a estado "alta" (o "replante")
- Se mantiene el historial de la planta anterior

---

## 6. Deshacer errores

### Si me equivoque en un alta:
- Dar **baja** a la planta con motivo "error"
- El stock NO se recupera automaticamente (por diseno: la planta salio del vivero)
- Si necesitas ajustar el stock, edita manualmente el lote en Inventario

### Si me equivoque en una baja:
- Usar **Replante** con el mismo lote para volver a colocar la planta
- El historial registrara ambos movimientos

### Si me equivoque en los datos de un lote:
- Ir a **Inventario** > click en el lote > editar los campos necesarios

### Si me equivoque en una medicion:
- Las mediciones individuales se pueden editar desde el detalle de la planta

> **Nota:** El sistema registra TODAS las acciones en el historial y audit log. No se pierde informacion.
