# Laboratorio y Mediciones - Manual de Usuario

## 1. Modulo de Mediciones de Calidad

El modulo de **Mediciones Lab** permite registrar, consultar y analizar datos de calidad de los frutos: brix, firmeza, calibre, acidez, color, y mas.

### 1.1 Acceder

- Ir a **Mediciones Lab** en el menu lateral (seccion "Calidad")

### 1.2 Pestanas disponibles

| Pestana | Funcion |
|---------|---------|
| **Laboratorio (Cosecha)** | Mediciones de calidad al momento de cosecha |
| **Poscosecha** | Mediciones despues de almacenaje (40 dias, 40+3, etc.) |
| **Ambiente (+N dias)** | Mediciones en condiciones ambiente |
| **Externos** | Mediciones de laboratorios externos |
| **Ingreso Rapido** | Formulario simplificado para ingreso rapido en campo |
| **Toma de Muestra** | Registro de muestras para enviar a laboratorio |

---

## 2. KPIs de Calidad

En la parte superior se muestran los promedios globales:
- **Total Mediciones**: Cantidad total de registros
- **Brix Prom.**: Promedio de solidos solubles
- **Firmeza Prom.**: Promedio de firmeza
- **Acidez Prom.**: Promedio de acidez
- **Calibre Prom.**: Promedio de diametro

---

## 3. Filtros

### 3.1 Filtros disponibles

Todos los filtros se aplican al presionar el boton **"Aplicar"**:

| Filtro | Descripcion |
|--------|-------------|
| **Temporada** | Ej: 2023-2024, 2024-2025 |
| **Especie** | Cerezo, Ciruela, Carozo, etc. Al seleccionar especie, las variedades se filtran automaticamente |
| **Campo** | Campo/fundo donde se tomaron las muestras |
| **Variedad** | Variedad especifica. Se filtra por la especie seleccionada |
| **PMG** | Programa de Mejoramiento Genetico. Filtra las mediciones de variedades de ese programa |
| **Color** | Color de pulpa: Amarilla, Blanca, Roja, Morada-Roja, Anaranjada, Damasco |
| **Fecha cosecha** | Rango de fechas (desde - hasta). Filtra por la fecha de cosecha del fruto |

### 3.2 Como usar los filtros

1. Seleccionar los valores deseados en los dropdowns
2. Para fecha cosecha, usar los campos de fecha "Desde" y "Hasta"
3. Click en **"Aplicar"** para ejecutar la busqueda
4. Click en **"Limpiar"** para resetear todos los filtros

> **Tip:** Seleccionar primero la Especie hace que Variedad muestre solo las opciones relevantes.

---

## 4. Pestana Laboratorio (Cosecha)

Muestra mediciones de calidad al momento de cosecha (periodo_almacenaje = 0 o null).

### 4.1 Columnas de la tabla

- Variedad, Especie, Temporada, Fecha
- Frutos, Peso(g), Diam(mm), SS(%) = Brix
- Firmeza, Acidez
- Cluster (clasificacion automatica de calidad)

### 4.2 Clasificacion por Clusters

Cada medicion se clasifica automaticamente en clusters de calidad:
- **Cluster 1** (verde): Calidad premium
- **Cluster 2** (azul): Buena calidad
- **Cluster 3** (amarillo): Calidad media
- **Cluster 4** (rojo): Bajo estandar

La clasificacion usa el metodo Band-Sum basado en umbrales por especie.

---

## 5. Pestana Poscosecha

Muestra mediciones realizadas despues de un periodo de almacenaje en frio.

### 5.1 Filtros adicionales

Ademas de los filtros estandar:
- **Dias minimo**: Filtrar por periodo minimo de almacenaje
- **Dias maximo**: Filtrar por periodo maximo

Ejemplos comunes:
- **40 dias**: Poner min=38, max=42
- **40+3 dias**: Poner min=41, max=45
- **60 dias**: Poner min=58, max=62

### 5.2 Columnas adicionales

- **Periodo**: Dias de almacenaje
- **Pardeamiento**, **Traslucidez**, **Gelificacion**, **Harinosidad**: Defectos de postcosecha

---

## 6. Registrar una Medicion

### 6.1 Formulario completo

1. Click en **"+ Nueva Medicion"**
2. **Paso 1**: Seleccionar Especie, Variedad, Campo, Testblock, Posicion/Planta
3. **Paso 2**: Ingresar datos de calidad:
   - Brix (SS%), Firmeza, Calibre (mm), Peso (g), Acidez
   - Firmeza detallada: punta, quilla, hombro, mejilla 1, mejilla 2
   - Color de cubrimiento: % en rangos 0-30, 30-50, 50-75, 75-100
   - Color de pulpa
4. Confirmar -> El sistema auto-clasifica en cluster

### 6.2 Ingreso Rapido

La pestana **"Ingreso Rapido"** permite registrar mediciones con menos campos para uso en campo.

### 6.3 Importar desde Excel

1. Click en **"Template Excel"** para descargar la plantilla
2. Completar la plantilla con los datos
3. Click en **"Importar Excel"** para cargar las mediciones masivamente

---

## 7. Analisis de Calidad

Acceder desde **Analisis** en el menu lateral o desde el enlace "Ver Analisis de Calidad" al pie de Mediciones Lab.

Incluye:
- Graficos de distribucion por variedad
- Comparacion entre temporadas
- Scatterplots de brix vs firmeza
- Rankings de variedades por cluster

---

## 8. Reportes

Acceder desde **Reportes** en el menu lateral o desde "Ver Reportes" al pie de Mediciones Lab.

- Descarga rapida de informes en PDF/Excel
- Filtros por temporada, especie, campo
