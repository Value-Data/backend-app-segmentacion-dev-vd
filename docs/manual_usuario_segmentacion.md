# Manual de Usuario - Sistema de Segmentacion de Nuevas Especies

**Garces Fruit / Value Data**

**Version:** 4.0.0
**Fecha:** Abril 2026
**Temporada Activa:** 2024-2025
**Clasificacion:** Uso Interno - Confidencial

---

## Tabla de Contenidos

1. Introduccion
2. Requisitos del Sistema
3. Acceso e Inicio de Sesion
4. Guia de Inicio Rapido
5. Panel Principal (Dashboard)
6. Mantenedores (Datos Maestros)
7. Inventario de Vivero
8. TestBlocks (Parcelas Experimentales)
9. Laboratorio (Mediciones de Calidad)
10. Labores (Tareas Agricolas)
11. Fenologia (Etapas Fenologicas)
12. Analisis e Informes
13. Alertas
14. Administracion del Sistema
15. Preguntas Frecuentes (FAQ)
16. Solucion de Problemas
17. Soporte y Contacto

---

## 1. Introduccion

### 1.1. Proposito del Sistema

El **Sistema de Segmentacion de Nuevas Especies** es una plataforma web desarrollada por Value Data para Garces Fruit, disenada para gestionar el ciclo completo de evaluacion y segmentacion de nuevas especies de carozo (frutas de hueso). El sistema abarca desde el inventario de vivero, la plantacion en parcelas experimentales, las mediciones de calidad en laboratorio, hasta el analisis de clustering y la generacion de paquetes tecnologicos.

### 1.2. Alcance

El sistema cubre las siguientes areas operacionales:

- **Inventario de vivero:** Control de lotes, stock y movimientos de material vegetal.
- **Parcelas experimentales (TestBlocks):** Seguimiento posicion por posicion de las plantas en evaluacion.
- **Laboratorio:** Medicion de parametros de calidad (Brix, firmeza, calibre, acidez) y clasificacion automatica.
- **Labores agricolas:** Planificacion y seguimiento de tareas de campo.
- **Fenologia:** Registro del desarrollo fenologico de las plantas.
- **Analisis:** Reportes, dashboards y resumen inteligente con IA.
- **Alertas:** Notificaciones automaticas por umbrales de calidad, stock bajo y registros pendientes.

### 1.3. Usuarios Objetivo

Este manual esta dirigido a los siguientes perfiles de usuario:

| Rol | Descripcion | Acceso Principal |
|-----|-------------|------------------|
| Administrador | Gestion completa del sistema, usuarios y configuracion | Todos los modulos |
| Agronomo | Gestion de TestBlocks, inventario, labores, fenologia y analisis | Inventario, TestBlocks, Labores, Fenologia, Analisis |
| Laboratorio | Mediciones de calidad y clustering | Laboratorio, Analisis |
| Operador | Ejecucion de tareas de campo | Labores, TestBlocks (lectura) |
| Visualizador | Consulta de informacion sin modificaciones | Todos los modulos (solo lectura) |

### 1.4. Convenciones del Manual

A lo largo de este manual se utilizan las siguientes convenciones:

> **Nota:** Informacion adicional relevante para el usuario.

> **Importante:** Advertencia sobre acciones que requieren especial atencion.

> **Consejo:** Recomendacion para optimizar el uso del sistema.

Los elementos de la interfaz (botones, menus, campos) se indican en **negrita**.

---

## 2. Requisitos del Sistema

### 2.1. Navegadores Compatibles

| Navegador | Version Minima | Recomendado |
|-----------|---------------|-------------|
| Google Chrome | 90+ | Si (recomendado) |
| Microsoft Edge | 90+ | Si |
| Mozilla Firefox | 88+ | Si |
| Safari | 14+ | Compatible |

> **Importante:** Se recomienda utilizar Google Chrome en su version mas reciente para una experiencia optima. El sistema no es compatible con Internet Explorer.

### 2.2. Requisitos de Hardware

- **Pantalla:** Resolucion minima de 1366 x 768 pixeles (se recomienda 1920 x 1080).
- **Conexion a internet:** Banda ancha estable (minimo 5 Mbps).
- **Dispositivos:** Compatible con computadores de escritorio, notebooks y tablets.

### 2.3. Requisitos Adicionales

- Lector de codigos QR (para funcionalidades de campo con QR).
- Camara (para captura de evidencias fotograficas en labores y fenologia).
- Acceso habilitado al dominio del sistema (consultar con el administrador).

---

## 3. Acceso e Inicio de Sesion

### 3.1. Acceder al Sistema

1. Abra su navegador web preferido.
2. Ingrese la URL del sistema proporcionada por su administrador.
3. El sistema mostrara la pantalla de inicio de sesion.

### 3.2. Iniciar Sesion

1. En el campo **Usuario**, ingrese su nombre de usuario asignado.
2. En el campo **Contrasena**, ingrese su contrasena.
3. Haga clic en el boton **Iniciar Sesion**.
4. Si las credenciales son correctas, sera redirigido al panel principal (Dashboard).

> **Nota:** Si es su primer acceso, el administrador le proporcionara credenciales temporales. Se recomienda cambiar la contrasena inmediatamente despues del primer inicio de sesion.

### 3.3. Recuperacion de Contrasena

Si olvido su contrasena, contacte al administrador del sistema para que le genere una nueva contrasena temporal.

### 3.4. Cerrar Sesion

1. Haga clic en el icono de usuario ubicado en la esquina superior derecha de la pantalla.
2. Seleccione la opcion **Cerrar Sesion**.
3. Sera redirigido a la pantalla de inicio de sesion.

> **Importante:** Siempre cierre sesion al terminar de usar el sistema, especialmente en equipos compartidos.

---

## 4. Guia de Inicio Rapido

Esta seccion describe los pasos esenciales para comenzar a utilizar el sistema de manera productiva.

### 4.1. Primer Uso - Flujo Recomendado

El sistema sigue un flujo de proceso tipo pipeline. Se recomienda seguir estos pasos en orden:

**Paso 1 - Configurar Datos Maestros (Mantenedores)**

Antes de operar, asegurese de que los datos maestros esten cargados:

1. Acceda al modulo **Mantenedores** desde el menu lateral.
2. Verifique que existan registros en: Especies, Variedades, Portainjertos, Campos, Viveros y PMG.
3. Si faltan datos, puede crearlos manualmente o importarlos desde Excel.

**Paso 2 - Registrar Inventario**

1. Acceda al modulo **Inventario**.
2. Cree lotes de material vegetal indicando variedad, portainjerto, vivero y cantidad.
3. Registre los movimientos de entrada de stock.

**Paso 3 - Crear TestBlocks**

1. Acceda al modulo **TestBlocks**.
2. Cree una parcela experimental definiendo campo, hileras y columnas.
3. Registre las plantas en las posiciones del bloque (Alta).

**Paso 4 - Registrar Mediciones de Calidad**

1. Acceda al modulo **Laboratorio**.
2. Seleccione el TestBlock y la planta a medir.
3. Ingrese los valores de Brix, firmeza, calibre y acidez.
4. El sistema calculara automaticamente la clasificacion de calidad.

**Paso 5 - Consultar Analisis**

1. Acceda al modulo **Analisis**.
2. Revise los dashboards de KPI y distribucion de clusters.
3. Consulte los paquetes tecnologicos generados.

### 4.2. Navegacion General

- **Menu lateral izquierdo:** Acceso a todos los modulos del sistema.
- **Barra superior:** Informacion del usuario activo, notificaciones y cierre de sesion.
- **Area de contenido central:** Muestra el modulo activo con sus funcionalidades.
- **Pipeline de proceso:** Visualizacion del flujo completo en el Dashboard.

---

## 5. Panel Principal (Dashboard)

### 5.1. Descripcion General

El Dashboard es la pantalla principal del sistema. Proporciona una vista consolidada del estado actual de las operaciones con indicadores clave de rendimiento (KPI) y accesos rapidos a los modulos.

### 5.2. Componentes del Dashboard

**Tarjetas de KPI**

El Dashboard presenta cuatro tarjetas principales con metricas resumidas:

| Tarjeta | Descripcion | Ejemplo |
|---------|-------------|---------|
| Plantas Activas | Cantidad total de plantas en estado activo en todos los TestBlocks | 1.247 plantas |
| Promedios de Calidad | Valores promedio de Brix, firmeza, calibre y acidez de la temporada | Brix: 16.4 |
| Labores Pendientes | Cantidad de tareas agricolas planificadas sin ejecutar | 23 labores |
| Alertas Activas | Numero de alertas sin resolver | 8 alertas |

**Visualizacion del Pipeline de Proceso**

El Dashboard incluye un diagrama visual del flujo operativo completo:

1. Mantenedores (datos base)
2. Inventario (stock de vivero)
3. TestBlocks (parcelas experimentales)
4. Laboratorio (mediciones)
5. Analisis (resultados y recomendaciones)

Cada etapa muestra un indicador de estado que permite identificar rapidamente donde hay actividad o pendientes.

**Accesos Rapidos**

Desde el Dashboard puede acceder directamente a cualquier modulo haciendo clic en los iconos o tarjetas correspondientes.

### 5.3. Actualizacion de Datos

Los datos del Dashboard se actualizan automaticamente al ingresar al sistema. Para forzar una actualizacion, recargue la pagina del navegador.

---

## 6. Mantenedores (Datos Maestros)

### 6.1. Descripcion General

Los Mantenedores son los catalogos de datos maestros que alimentan al resto del sistema. Contienen la informacion base necesaria para operar: especies, variedades, portainjertos, campos, viveros y mas.

> **Importante:** Los datos maestros deben estar correctamente cargados antes de utilizar los demas modulos. Errores en los mantenedores pueden afectar todo el sistema.

### 6.2. Catalogos Disponibles

El sistema cuenta con mas de 18 catalogos organizados en las siguientes categorias:

**Catalogos de Material Vegetal**

| Catalogo | Descripcion |
|----------|-------------|
| Especies | Tipos de fruta: Cerezo, Ciruela, Nectarina, Durazno, etc. Cada especie tiene un emoji y color asociado |
| Variedades | Cultivares especificos vinculados a una especie, con informacion de genetica, origen y portainjerto recomendado |
| Portainjertos | Patrones de injerto con vigor, compatibilidad y caracteristicas agronomicas |
| PMG | Obtentores y licenciatarios de material vegetal (Plant Material Growers) |

**Catalogos de Ubicacion**

| Catalogo | Descripcion |
|----------|-------------|
| Campos | Predios agricolas con coordenadas geograficas, responsable y superficie en hectareas |
| Regiones | Regiones geograficas |
| Comunas | Comunas dentro de cada region |
| Paises | Paises de origen del material vegetal |
| Bodegas | Almacenes fisicos para inventario |

**Catalogos Operacionales**

| Catalogo | Descripcion |
|----------|-------------|
| Viveros | Proveedores de plantas y material vegetal |
| Colores | Colores de fruta para clasificacion visual |
| Susceptibilidades | Sensibilidades a enfermedades o condiciones ambientales |
| Tipos de Labor | Categorias de tareas agricolas (poda, riego, cosecha, etc.) |
| Estados Fenologicos | Etapas del desarrollo de la planta |
| Estados de Planta | Estados posibles: activa, baja, replante, vacia |
| Temporadas | Periodos de evaluacion (ej. 2024-2025) |
| Origenes | Procedencia del material genetico |

### 6.3. Operaciones Comunes en Mantenedores

#### 6.3.1. Ver Registros

1. Acceda al modulo **Mantenedores** desde el menu lateral.
2. Seleccione el catalogo deseado (ej. **Especies**).
3. El sistema mostrara la lista de registros en formato tabla.
4. Use la barra de busqueda para filtrar registros por nombre u otro campo.

#### 6.3.2. Crear un Nuevo Registro

1. Dentro del catalogo deseado, haga clic en el boton **Nuevo** o **Agregar**.
2. Complete los campos del formulario. Los campos obligatorios estan marcados con asterisco (*).
3. Haga clic en **Guardar** para confirmar la creacion.
4. El nuevo registro aparecera en la lista.

> **Nota:** Algunos catalogos tienen campos que dependen de otros. Por ejemplo, al crear una Variedad, primero debe existir la Especie correspondiente.

#### 6.3.3. Editar un Registro

1. En la lista de registros, haga clic en el icono de **Editar** (lapiz) en la fila correspondiente.
2. Modifique los campos necesarios en el formulario.
3. Haga clic en **Guardar** para confirmar los cambios.

#### 6.3.4. Eliminar un Registro

1. En la lista de registros, haga clic en el icono de **Eliminar** (papelera) en la fila correspondiente.
2. Confirme la eliminacion en el dialogo de confirmacion.

> **Importante:** No es posible eliminar registros que estan siendo utilizados por otros modulos. Por ejemplo, no puede eliminar una Variedad que tiene plantas registradas en un TestBlock.

#### 6.3.5. Importacion Masiva desde Excel

El sistema permite cargar multiples registros simultaneamente desde archivos Excel:

1. Dentro del catalogo deseado, haga clic en el boton **Importar Excel**.
2. Descargue la plantilla Excel proporcionada haciendo clic en **Descargar Plantilla**.
3. Complete la plantilla con los datos a importar, respetando el formato de cada columna.
4. Haga clic en **Seleccionar Archivo** y elija el archivo Excel completado.
5. El sistema mostrara una vista previa de los datos a importar.
6. Revise que los datos sean correctos.
7. Haga clic en **Confirmar Importacion**.
8. El sistema procesara los datos e informara cuantos registros fueron creados exitosamente y si hubo errores.

> **Consejo:** Siempre descargue y utilice la plantilla oficial del sistema para evitar errores de formato en la importacion.

#### 6.3.6. Fusion de Duplicados

Si detecta registros duplicados en un catalogo:

1. Seleccione los registros duplicados marcando las casillas de verificacion correspondientes.
2. Haga clic en el boton **Fusionar**.
3. El sistema le pedira que seleccione cual registro sera el principal (el que se conservara).
4. Confirme la fusion. Todos los registros relacionados se actualizaran para apuntar al registro principal.

> **Importante:** La fusion de duplicados es una operacion irreversible. Verifique cuidadosamente antes de confirmar.

### 6.4. Detalle de Catalogos Clave

#### 6.4.1. Especies

Las especies representan los tipos de fruta de carozo evaluados. Cada especie incluye:

- **Nombre:** Nombre comun de la especie (ej. Cerezo, Ciruela, Nectarina).
- **Emoji:** Icono visual para identificacion rapida en la interfaz.
- **Color:** Color de referencia utilizado en graficos y visualizaciones.
- **Estado:** Activo o inactivo.

#### 6.4.2. Variedades

Las variedades son los cultivares especificos dentro de cada especie:

- **Nombre:** Nombre comercial de la variedad.
- **Especie:** Especie a la que pertenece (debe existir previamente).
- **Genetica:** Informacion sobre la genetica del cultivar.
- **Origen:** Procedencia del material genetico.
- **Portainjerto Recomendado:** Patron de injerto sugerido para la variedad.
- **Observaciones:** Notas adicionales sobre la variedad.

#### 6.4.3. Campos

Los campos representan los predios agricolas donde se ubican los TestBlocks:

- **Nombre:** Nombre identificador del campo.
- **Coordenadas:** Latitud y longitud para geolocalizacion.
- **Responsable:** Persona a cargo del campo.
- **Hectareas:** Superficie total del predio.
- **Region/Comuna:** Ubicacion administrativa.

---

## 7. Inventario de Vivero

### 7.1. Descripcion General

El modulo de Inventario permite gestionar el stock de material vegetal proveniente de viveros. Controla lotes, movimientos de entrada y salida, despachos a TestBlocks y genera codigos QR para etiquetas fisicas.

### 7.2. Gestion de Lotes

#### 7.2.1. Ver Lotes

1. Acceda al modulo **Inventario** desde el menu lateral.
2. El sistema mostrara la lista de lotes con la siguiente informacion:

| Columna | Descripcion |
|---------|-------------|
| Codigo de Lote | Identificador unico del lote |
| Variedad | Variedad del material vegetal |
| Portainjerto | Patron de injerto utilizado |
| PMG | Obtentor o licenciatario |
| Vivero | Vivero proveedor |
| Stock Inicial | Cantidad original recibida |
| Stock Actual | Cantidad disponible actualmente |
| Stock Comprometido | Cantidad reservada para despachos |
| Bodega | Almacen donde se encuentra |

3. Utilice los filtros superiores para buscar por variedad, vivero, PMG u otros criterios.

#### 7.2.2. Crear un Nuevo Lote

1. Haga clic en el boton **Nuevo Lote**.
2. Complete los campos del formulario:
   - **Variedad:** Seleccione la variedad del material vegetal.
   - **Portainjerto:** Seleccione el portainjerto.
   - **PMG:** Seleccione el obtentor o licenciatario.
   - **Vivero:** Seleccione el vivero proveedor.
   - **Bodega:** Seleccione el almacen de destino.
   - **Cantidad Inicial:** Ingrese la cantidad de plantas recibidas.
   - **Fecha de Recepcion:** Ingrese la fecha en que se recibio el lote.
   - **Observaciones:** Notas adicionales (opcional).
3. Haga clic en **Guardar**.

#### 7.2.3. Editar un Lote

1. Haga clic en el icono de **Editar** en la fila del lote.
2. Modifique los campos necesarios.
3. Haga clic en **Guardar**.

> **Nota:** No es posible modificar la cantidad inicial de un lote que ya tiene movimientos registrados.

### 7.3. Movimientos de Stock (Kardex)

El Kardex registra todos los movimientos que afectan el stock de un lote.

#### 7.3.1. Tipos de Movimiento

| Tipo | Descripcion | Efecto en Stock |
|------|-------------|-----------------|
| Entrada | Recepcion de material vegetal | Aumenta el stock actual |
| Salida | Despacho o descarte de material | Disminuye el stock actual |
| Transferencia | Movimiento entre bodegas | Ajusta stock en origen y destino |

#### 7.3.2. Registrar un Movimiento

1. Seleccione el lote en la lista de inventario.
2. Haga clic en la pestana **Movimientos** o **Kardex**.
3. Haga clic en **Nuevo Movimiento**.
4. Complete los campos:
   - **Tipo:** Seleccione Entrada, Salida o Transferencia.
   - **Cantidad:** Ingrese la cantidad de plantas del movimiento.
   - **Motivo:** Describa el motivo del movimiento.
   - **Bodega Destino:** Solo para transferencias, seleccione la bodega de destino.
5. Haga clic en **Confirmar**.

#### 7.3.3. Consultar el Historial de Movimientos

1. Seleccione el lote deseado.
2. Acceda a la pestana **Kardex** o **Historial**.
3. El sistema mostrara una tabla cronologica con todos los movimientos del lote, incluyendo fecha, tipo, cantidad, usuario que registro y stock resultante.

### 7.4. Despacho a TestBlocks (Guia de Despacho)

Para enviar material vegetal desde el inventario hacia una parcela experimental:

1. Seleccione el lote a despachar.
2. Haga clic en **Generar Despacho** o **Guia de Despacho**.
3. Complete los datos del despacho:
   - **TestBlock Destino:** Seleccione la parcela experimental de destino.
   - **Cantidad:** Ingrese la cantidad de plantas a despachar.
   - **Fecha de Despacho:** Ingrese la fecha del envio.
   - **Responsable:** Persona encargada del traslado.
4. Haga clic en **Confirmar Despacho**.
5. El sistema:
   - Descontara la cantidad del stock actual del lote.
   - Generara una guia de despacho con numero de folio.
   - Registrara el movimiento de salida en el Kardex.

> **Nota:** El stock comprometido se actualiza cuando se reserva material para un despacho futuro. El stock actual se actualiza cuando el despacho se confirma.

### 7.5. Organizacion por Bodega

El inventario puede organizarse por bodegas (almacenes fisicos):

1. Utilice el filtro **Bodega** en la lista de inventario para ver solo los lotes de un almacen especifico.
2. Para transferir material entre bodegas, use la funcion de movimiento tipo **Transferencia**.

### 7.6. Codigos QR

El sistema genera codigos QR para identificacion fisica de lotes:

1. Seleccione el lote en la lista de inventario.
2. Haga clic en el boton **Generar QR**.
3. El sistema generara un codigo QR con la informacion del lote.
4. Puede imprimir el QR para adherirlo como etiqueta fisica.
5. El QR puede escanearse desde dispositivos moviles para acceder rapidamente a la informacion del lote.

### 7.7. Alertas de Stock Bajo

El sistema genera alertas automaticas cuando el stock de un lote cae por debajo del 20% del stock inicial.

> **Consejo:** Revise periodicamente las alertas de stock bajo en el modulo de Alertas para programar reabastecimientos oportunos.

---

## 8. TestBlocks (Parcelas Experimentales)

### 8.1. Descripcion General

Los TestBlocks son las parcelas experimentales donde se plantan y evaluan las nuevas variedades de carozo. Cada TestBlock se organiza como una grilla (hileras x columnas) donde cada posicion puede contener una planta.

### 8.2. Crear un TestBlock

1. Acceda al modulo **TestBlocks** desde el menu lateral.
2. Haga clic en **Nuevo TestBlock**.
3. Complete los campos del formulario:
   - **Nombre:** Nombre identificador del bloque (ej. "TB-Cerezo-2024-Norte").
   - **Campo:** Seleccione el campo donde se ubicara.
   - **Hileras:** Numero de hileras de la grilla.
   - **Columnas:** Numero de columnas (posiciones por hilera).
   - **Temporada:** Temporada de evaluacion.
   - **Observaciones:** Notas adicionales (opcional).
4. Haga clic en **Guardar**.
5. El sistema creara el TestBlock con todas las posiciones en estado **vacia**.

> **Nota:** Una vez creado el TestBlock, la dimension de la grilla no puede modificarse. Planifique cuidadosamente el tamano antes de crear el bloque.

### 8.3. Visualizacion de la Grilla

El TestBlock se muestra como una grilla interactiva donde cada celda representa una posicion. Los colores indican el estado:

| Color | Estado | Descripcion |
|-------|--------|-------------|
| Verde | Alta (Activa) | Posicion con planta activa |
| Rojo | Baja | Posicion con planta removida |
| Amarillo | Replante | Posicion donde se reemplazo una planta |
| Gris | Vacia | Posicion sin planta asignada |

Para ver el detalle de una posicion, haga clic en la celda correspondiente de la grilla.

### 8.4. Registro de Plantas (Alta)

#### 8.4.1. Alta Individual

Para registrar una planta en una posicion especifica:

1. Abra el TestBlock deseado.
2. Haga clic en una posicion **vacia** (gris) de la grilla.
3. En el formulario de alta, complete:
   - **Variedad:** Seleccione la variedad de la planta.
   - **Portainjerto:** Seleccione el portainjerto.
   - **Fecha de Plantacion:** Ingrese la fecha en que se planto.
   - **Origen (Lote):** Opcionalmente, vincule con un lote de inventario.
4. Haga clic en **Confirmar Alta**.
5. La posicion cambiara a color verde (activa).

#### 8.4.2. Alta Masiva

Para registrar multiples plantas simultaneamente:

1. Abra el TestBlock deseado.
2. Haga clic en **Alta Masiva**.
3. Defina el rango de posiciones:
   - **Hilera Inicio / Hilera Fin:** Rango de hileras.
   - **Columna Inicio / Columna Fin:** Rango de columnas.
4. Complete los datos comunes para todas las plantas (variedad, portainjerto, fecha).
5. Haga clic en **Confirmar Alta Masiva**.
6. El sistema registrara todas las plantas en el rango definido.

> **Consejo:** Use la alta masiva cuando plante hileras completas con la misma variedad y portainjerto. Esto ahorra tiempo significativamente.

### 8.5. Baja de Plantas

Cuando una planta es removida o muere:

#### 8.5.1. Baja Individual

1. Abra el TestBlock deseado.
2. Haga clic en una posicion **activa** (verde).
3. Haga clic en **Dar de Baja**.
4. Ingrese el motivo de la baja.
5. Confirme la operacion.
6. La posicion cambiara a color rojo.

#### 8.5.2. Baja Masiva

1. Haga clic en **Baja Masiva**.
2. Seleccione el rango de posiciones a dar de baja.
3. Ingrese el motivo comun.
4. Confirme la operacion.

### 8.6. Replante

Para reemplazar una planta en una posicion que fue dada de baja:

1. Haga clic en una posicion en estado **baja** (rojo).
2. Haga clic en **Replante**.
3. Complete los datos de la nueva planta (variedad, portainjerto, fecha).
4. Confirme la operacion.
5. La posicion cambiara a color amarillo (replante).

### 8.7. Historial de Estados

Cada posicion mantiene un historial completo de cambios de estado:

1. Haga clic en una posicion de la grilla.
2. Acceda a la pestana **Historial**.
3. El sistema mostrara una linea de tiempo con todos los cambios: fecha, estado anterior, estado nuevo, usuario responsable y motivo.

### 8.8. Estadisticas del TestBlock

Cada TestBlock muestra un resumen estadistico:

| Metrica | Descripcion |
|---------|-------------|
| Posiciones Activas | Cantidad y porcentaje de plantas activas |
| Posiciones Inactivas (Baja) | Cantidad y porcentaje de plantas removidas |
| Posiciones con Replante | Cantidad y porcentaje de reemplazos |
| Posiciones Vacias | Cantidad y porcentaje de posiciones sin planta |
| Total de Posiciones | Hileras x Columnas |

### 8.9. Codigos QR para TestBlocks

El sistema genera codigos QR para identificacion en campo:

1. Seleccione el TestBlock.
2. Haga clic en **Generar QR**.
3. Puede generar QR a nivel de bloque completo o por posicion individual.
4. Imprima los codigos y coloquelos en las estacas de campo.
5. Al escanear un QR, se accede directamente a la informacion de la posicion.

---

## 9. Laboratorio (Mediciones de Calidad)

### 9.1. Descripcion General

El modulo de Laboratorio permite registrar mediciones de calidad de la fruta y clasificar automaticamente las variedades en categorias de excelencia mediante el algoritmo Band-Sum.

### 9.2. Parametros de Calidad

El sistema mide cuatro parametros fundamentales de calidad:

| Parametro | Unidad | Rango Tipico | Descripcion |
|-----------|--------|-------------|-------------|
| Brix | Grados Brix | 14 - 22 | Contenido de azucar de la fruta. Mayor Brix indica mayor dulzor |
| Firmeza | gf (gramo fuerza) | 60 - 85 | Resistencia de la pulpa a la presion. Indica madurez y vida postcosecha |
| Calibre | mm | Optimo: 28 mm | Diametro ecuatorial de la fruta. Indica tamano comercial |
| Acidez | % acido malico | 0.4 - 1.2 | Contenido acido de la fruta. Balancea el sabor con el dulzor |

### 9.3. Ingresar Mediciones

#### 9.3.1. Ingreso Individual

1. Acceda al modulo **Laboratorio** desde el menu lateral.
2. Haga clic en **Nueva Medicion**.
3. Seleccione el **TestBlock** y la **Posicion** (planta) a medir.
4. Complete los valores de calidad:
   - **Brix:** Ingrese el valor en grados Brix.
   - **Firmeza:** Ingrese el valor en gramo fuerza.
   - **Calibre:** Ingrese el diametro en milimetros.
   - **Acidez:** Ingrese el porcentaje de acidez.
5. Opcionalmente, ingrese la **Fecha de Medicion** (por defecto es la fecha actual).
6. Haga clic en **Guardar**.

#### 9.3.2. Firmeza Detallada (5 Puntos)

Para una evaluacion mas precisa de la firmeza, el sistema permite registrar mediciones en 5 puntos especificos de la fruta:

| Punto | Ubicacion |
|-------|-----------|
| Punta | Extremo apical de la fruta |
| Quilla | Linea central inferior |
| Hombro | Zona superior lateral |
| Mejilla 1 | Cara lateral izquierda |
| Mejilla 2 | Cara lateral derecha |

Para ingresar firmeza detallada:

1. En el formulario de medicion, haga clic en **Firmeza Detallada**.
2. Ingrese los 5 valores individuales.
3. El sistema calculara automaticamente el promedio.

#### 9.3.3. Ingreso Rapido

El modo de Ingreso Rapido permite registrar multiples mediciones de forma agil:

1. Haga clic en **Ingreso Rapido** en la barra superior del modulo.
2. Seleccione el **TestBlock**.
3. El sistema mostrara una tabla con todas las posiciones activas.
4. Ingrese los valores directamente en las celdas de la tabla.
5. Use la tecla **Tab** para moverse entre campos y **Enter** para pasar a la siguiente fila.
6. Al finalizar, haga clic en **Guardar Todo**.

> **Consejo:** El modo Ingreso Rapido es ideal para jornadas de medicion intensiva. Permite registrar decenas de mediciones en minutos.

#### 9.3.4. Importacion desde Excel

Para cargas masivas de mediciones:

1. Haga clic en **Importar Excel**.
2. Descargue la **Plantilla de Mediciones** haciendo clic en el enlace correspondiente.
3. Complete la plantilla con los datos de las mediciones.
4. Cargue el archivo y revise la vista previa.
5. Confirme la importacion.

> **Importante:** La plantilla Excel debe contener las columnas: TestBlock, Posicion (Hilera, Columna), Brix, Firmeza, Calibre, Acidez y Fecha. Respete los formatos numericos indicados en la plantilla.

### 9.4. Clustering Automatico (Clasificacion de Calidad)

#### 9.4.1. Algoritmo Band-Sum

El sistema clasifica automaticamente la calidad de cada medicion utilizando el algoritmo Band-Sum. Este proceso funciona de la siguiente manera:

**Paso 1 - Asignacion de Bandas**

Cada parametro de calidad (Brix, acidez, firmeza) se clasifica en una banda del 1 al 4 segun umbrales especificos por variedad y especie:

| Banda | Significado |
|-------|-------------|
| Banda 1 | Valor optimo (mejor rango) |
| Banda 2 | Valor bueno |
| Banda 3 | Valor aceptable |
| Banda 4 | Valor deficiente |

**Paso 2 - Suma de Bandas**

Se suman las bandas de los tres parametros para obtener un puntaje total:

- Puntaje = Banda Brix + Banda Acidez + Banda Firmeza
- Rango posible: 3 (mejor caso) a 12 (peor caso)

**Paso 3 - Clasificacion Final**

| Cluster | Rango de Puntaje | Clasificacion | Descripcion |
|---------|-------------------|---------------|-------------|
| C1 | 3 a 5 | Excelente | Fruta de calidad superior en todos los parametros |
| C2 | 6 a 8 | Bueno | Fruta de buena calidad con parametros aceptables |
| C3 | 9 a 11 | Regular | Fruta que necesita mejoras en uno o mas parametros |
| C4 | 12 | Deficiente | Fruta por debajo de los estandares en la mayoria de parametros |

> **Nota:** Los umbrales de clasificacion varian segun la variedad y especie. El sistema contiene mas de 40 reglas especificas para combinaciones como Ciruela Candy, Nectarina Temprana, Cerezo Tardia, entre otras.

#### 9.4.2. Visualizacion de Clusters

Los resultados de clustering se presentan de varias formas:

**Graficos de Distribucion**

- **Grafico Circular (Pie):** Muestra el porcentaje de mediciones en cada cluster (C1, C2, C3, C4).
- **Grafico de Barras:** Muestra la cantidad de mediciones por cluster.

**Tabla de Resultados**

Cada medicion muestra su clasificacion final junto a los valores individuales y las bandas asignadas.

**Filtrado por Cluster**

Puede filtrar las mediciones por cluster para enfocarse en un grupo especifico:

1. Use el filtro **Cluster** en la barra superior.
2. Seleccione C1, C2, C3 o C4.
3. La tabla y graficos se actualizaran mostrando solo las mediciones del cluster seleccionado.

### 9.5. Dashboard de KPI de Laboratorio

El modulo incluye un panel de indicadores clave:

| KPI | Descripcion |
|-----|-------------|
| Brix Promedio | Promedio de todos los valores de Brix de la temporada |
| Firmeza Promedio | Promedio de todos los valores de firmeza |
| Calibre Promedio | Promedio de todos los valores de calibre |
| Acidez Promedio | Promedio de todos los valores de acidez |
| Total Mediciones | Cantidad total de mediciones registradas |
| Distribucion C1/C2/C3/C4 | Porcentaje de mediciones en cada cluster |

---

## 10. Labores (Tareas Agricolas)

### 10.1. Descripcion General

El modulo de Labores permite planificar, asignar y dar seguimiento a las tareas agricolas que se ejecutan en los TestBlocks. Incluye visualizacion de calendario, asignacion de trabajadores y captura de evidencia fotografica.

### 10.2. Tipos de Labor

El sistema soporta los siguientes tipos de tareas agricolas:

| Tipo de Labor | Descripcion |
|---------------|-------------|
| Plantacion | Instalacion de plantas en el TestBlock |
| Poda | Corte y formacion de plantas |
| Cosecha | Recoleccion de fruta |
| Riego | Aplicacion de agua |
| Fertilizacion | Aplicacion de nutrientes |
| Control de Plagas | Aplicacion de fitosanitarios |
| Monitoreo | Revision y evaluacion visual |
| Muestreo | Toma de muestras para laboratorio |

> **Nota:** Los tipos de labor se administran desde el modulo Mantenedores. El administrador puede agregar nuevos tipos segun las necesidades operacionales.

### 10.3. Planificar una Labor

1. Acceda al modulo **Labores** desde el menu lateral.
2. Haga clic en **Nueva Labor**.
3. Complete los campos del formulario:
   - **Tipo de Labor:** Seleccione el tipo de tarea.
   - **TestBlock:** Seleccione el bloque donde se ejecutara.
   - **Hilera/Planta:** Especifique las hileras o plantas afectadas (opcional).
   - **Fecha Planificada:** Fecha en que se debe ejecutar la tarea.
   - **Trabajador Asignado:** Persona responsable de ejecutar la tarea.
   - **Descripcion:** Detalle de la labor a realizar.
   - **Prioridad:** Nivel de prioridad (alta, media, baja).
4. Haga clic en **Guardar**.
5. La labor se creara con estado **Planificada**.

### 10.4. Vista de Calendario

El modulo ofrece una vista de calendario para visualizar todas las labores planificadas:

1. Haga clic en la pestana **Calendario** en la parte superior del modulo.
2. El calendario mostrara las labores codificadas por color segun su tipo.
3. Puede navegar entre meses usando las flechas.
4. Haga clic en una labor del calendario para ver su detalle.

> **Consejo:** Utilice la vista de calendario para identificar periodos con alta carga de trabajo y redistribuir tareas si es necesario.

### 10.5. Ejecutar una Labor

Cuando una tarea ha sido completada en campo:

1. Busque la labor en la lista o calendario.
2. Haga clic en la labor para abrir su detalle.
3. Haga clic en **Registrar Ejecucion**.
4. Complete los datos de ejecucion:
   - **Fecha de Ejecucion:** Fecha en que se completo la tarea.
   - **Observaciones:** Comentarios sobre la ejecucion.
   - **Evidencia Fotografica:** Adjunte fotos tomadas en campo (opcional).
5. Haga clic en **Confirmar Ejecucion**.
6. El estado de la labor cambiara a **Ejecutada**.

### 10.6. Captura de Evidencia

El sistema permite adjuntar fotografias como evidencia de las labores ejecutadas:

1. En el formulario de ejecucion, haga clic en **Adjuntar Foto**.
2. Seleccione una imagen desde su dispositivo o tome una foto con la camara.
3. La foto se almacenara asociada a la labor.
4. Si el dispositivo tiene GPS, la geolocalizacion se registrara automaticamente con la foto.

> **Nota:** Las fotos con geolocalizacion permiten verificar que la labor se ejecuto en la ubicacion correcta.

### 10.7. Estados de una Labor

| Estado | Descripcion |
|--------|-------------|
| Planificada | Labor creada y pendiente de ejecucion |
| Ejecutada | Labor completada con fecha de ejecucion registrada |
| Cancelada | Labor que no se ejecutara (requiere motivo de cancelacion) |

### 10.8. Cancelar una Labor

1. Abra el detalle de la labor planificada.
2. Haga clic en **Cancelar Labor**.
3. Ingrese el motivo de la cancelacion.
4. Confirme la operacion.

### 10.9. Ordenes de Trabajo

Las ordenes de trabajo agrupan multiples labores relacionadas:

1. Haga clic en **Nueva Orden de Trabajo**.
2. Defina un nombre y descripcion para la orden.
3. Agregue las labores que componen la orden.
4. Asigne un responsable general.
5. La orden se completa cuando todas sus labores estan ejecutadas o canceladas.

---

## 11. Fenologia (Etapas Fenologicas)

### 11.1. Descripcion General

El modulo de Fenologia permite registrar y dar seguimiento al desarrollo fenologico de las plantas en los TestBlocks. La fenologia estudia las etapas de crecimiento y desarrollo de las plantas en relacion con las condiciones ambientales.

### 11.2. Registrar un Estado Fenologico

1. Acceda al modulo **Fenologia** desde el menu lateral.
2. Haga clic en **Nuevo Registro Fenologico**.
3. Complete los campos:
   - **TestBlock:** Seleccione la parcela experimental.
   - **Planta/Posicion:** Seleccione la planta o posicion especifica.
   - **Estado Fenologico:** Seleccione la etapa de desarrollo actual de la lista predefinida.
   - **Fecha de Observacion:** Fecha en que se realizo la observacion.
   - **Foto:** Adjunte una fotografia del estado fenologico (recomendado).
   - **Observaciones:** Notas adicionales sobre la observacion.
4. Haga clic en **Guardar**.

### 11.3. Etapas Fenologicas

Las etapas fenologicas varian segun la especie. Algunos ejemplos comunes para carozos:

| Etapa | Descripcion |
|-------|-------------|
| Dormancia | Planta en reposo invernal |
| Hinchamiento de Yemas | Yemas comienzan a expandirse |
| Floracion | Apertura de flores |
| Cuaje | Formacion inicial del fruto |
| Crecimiento de Fruto | Fruto en desarrollo |
| Envero | Cambio de color del fruto |
| Madurez | Fruto listo para cosecha |
| Postcosecha | Periodo posterior a la recoleccion |

> **Nota:** Las etapas fenologicas se administran desde el modulo Mantenedores y pueden personalizarse segun las necesidades del equipo agronomico.

### 11.4. Seguimiento de Progresion

El sistema permite visualizar la progresion fenologica:

1. Seleccione un TestBlock.
2. Acceda a la vista **Timeline Fenologico**.
3. El sistema mostrara una linea de tiempo con las etapas registradas para cada planta.
4. Las fotografias adjuntas se muestran como miniaturas en la linea de tiempo.

### 11.5. Historial por TestBlock

Para consultar el historial fenologico completo:

1. Seleccione el TestBlock deseado.
2. Haga clic en la pestana **Historial Fenologico**.
3. El sistema mostrara todos los registros fenologicos ordenados cronologicamente.
4. Puede filtrar por planta, etapa o rango de fechas.

---

## 12. Analisis e Informes

### 12.1. Descripcion General

El modulo de Analisis proporciona dashboards interactivos, reportes cruzados, paquetes tecnologicos y resumenes inteligentes generados con inteligencia artificial. Es la herramienta principal para la toma de decisiones sobre las variedades en evaluacion.

### 12.2. Dashboard de KPI

El dashboard presenta los indicadores clave de rendimiento de la temporada:

| KPI | Descripcion |
|-----|-------------|
| Brix Promedio | Promedio general de contenido de azucar |
| Firmeza Promedio | Promedio general de firmeza de la fruta |
| Calibre Promedio | Promedio general del tamano de la fruta |
| Acidez Promedio | Promedio general de acidez |

Los KPI se actualizan en tiempo real conforme se registran nuevas mediciones en el modulo de Laboratorio.

### 12.3. Distribucion de Clusters

El analisis de clustering muestra la distribucion de calidad:

1. Acceda al modulo **Analisis**.
2. Seleccione la seccion **Distribucion de Clusters**.
3. El sistema mostrara graficos con la proporcion de mediciones clasificadas como C1 (Excelente), C2 (Bueno), C3 (Regular) y C4 (Deficiente).
4. Puede filtrar por:
   - Especie
   - Variedad
   - TestBlock
   - Temporada
   - Rango de fechas

### 12.4. Paquetes Tecnologicos

Los paquetes tecnologicos son recomendaciones tecnicas generadas por variedad y temporada:

1. Acceda a la seccion **Paquetes Tecnologicos**.
2. Seleccione la variedad y temporada de interes.
3. El sistema mostrara un resumen con:
   - Rendimiento de calidad por cluster.
   - Recomendaciones de manejo agronomico.
   - Comparativa con temporadas anteriores.
   - Comportamiento fenologico observado.

### 12.5. Reportes Cruzados

El sistema permite generar reportes que cruzan informacion de multiples entidades:

**Niveles de Reporte**

| Nivel | Descripcion |
|-------|-------------|
| Por Variedad | Analisis agrupado por variedad evaluada |
| Por Lote | Analisis agrupado por lote de inventario |
| Por TestBlock | Analisis agrupado por parcela experimental |
| Por Planta | Analisis detallado a nivel de planta individual |

**Generar un Reporte**

1. Acceda a la seccion **Reportes**.
2. Seleccione el nivel de agrupacion deseado.
3. Aplique los filtros necesarios (especie, variedad, temporada, campo).
4. Haga clic en **Generar Reporte**.
5. El sistema mostrara el reporte en pantalla.
6. Para descargar el reporte, haga clic en **Exportar PDF**.

### 12.6. Resumenes con Inteligencia Artificial

El sistema incluye la capacidad de generar resumenes inteligentes utilizando Azure OpenAI:

1. Acceda a la seccion **Resumen IA**.
2. Seleccione el contexto del resumen (variedad, TestBlock, temporada).
3. Haga clic en **Generar Resumen**.
4. El sistema procesara la informacion y generara un resumen narrativo que incluye:
   - Analisis de la calidad general de la variedad.
   - Tendencias observadas en los parametros de calidad.
   - Comparaciones con otras variedades de la misma especie.
   - Recomendaciones basadas en los datos registrados.

> **Nota:** La generacion de resumenes con IA puede tomar algunos segundos. El contenido generado es una herramienta de apoyo y debe ser validado por el equipo agronomico.

### 12.7. Exportacion de Reportes

Todos los reportes pueden exportarse en formato PDF:

1. Con el reporte generado en pantalla, haga clic en **Exportar PDF**.
2. Seleccione las secciones a incluir en el documento.
3. El sistema generara el PDF y lo descargara automaticamente.

---

## 13. Alertas

### 13.1. Descripcion General

El sistema de Alertas notifica automaticamente sobre situaciones que requieren atencion. Las alertas se generan de forma automatica y se muestran tanto en el Dashboard como en el modulo dedicado.

### 13.2. Tipos de Alertas

| Tipo de Alerta | Condicion | Descripcion |
|----------------|-----------|-------------|
| Umbral de Calidad | Medicion fuera de rango optimo | Se activa cuando un parametro de calidad (Brix, firmeza, acidez) excede los umbrales definidos para la variedad |
| Stock Bajo | Stock < 20% del inicial | Se activa cuando un lote de inventario tiene menos del 20% de su stock original |
| Sin Registro | Mas de 7 dias sin actividad | Se activa cuando un TestBlock no registra mediciones ni labores por mas de 7 dias |
| Estado de Planta | Cambio de estado critico | Se activa cuando una planta cambia a estado de baja o presenta condiciones anomalas |

### 13.3. Visualizar Alertas

1. Acceda al modulo **Alertas** desde el menu lateral.
2. El sistema mostrara la lista de alertas activas con la siguiente informacion:
   - **Tipo:** Icono y nombre del tipo de alerta.
   - **Fecha:** Fecha y hora en que se genero la alerta.
   - **Entidad Afectada:** TestBlock, lote o planta relacionada.
   - **Detalle:** Descripcion especifica de la condicion detectada.
   - **Estado:** Activa o Resuelta.

3. Puede filtrar alertas por tipo, fecha o estado usando los filtros superiores.

### 13.4. Resolver una Alerta

Cuando la situacion que origino la alerta ha sido atendida:

1. Haga clic en la alerta que desea resolver.
2. Revise el detalle de la alerta.
3. Haga clic en **Marcar como Resuelta**.
4. Opcionalmente, ingrese una nota sobre la accion correctiva tomada.
5. La alerta cambiara a estado **Resuelta** y dejara de aparecer en la lista de alertas activas.

> **Consejo:** Revise las alertas diariamente al inicio de la jornada laboral. Las alertas sin resolver se acumulan y pueden indicar problemas sistematicos que requieren atencion.

### 13.5. Notificaciones en el Dashboard

El Dashboard muestra un contador de alertas activas en la tarjeta correspondiente. Haga clic en la tarjeta para acceder directamente al modulo de Alertas.

---

## 14. Administracion del Sistema

### 14.1. Descripcion General

El modulo de Administracion (Sistema) esta disponible unicamente para usuarios con rol **Administrador**. Permite gestionar usuarios, asignar roles y campos, y consultar el registro de auditoria.

### 14.2. Gestion de Usuarios

#### 14.2.1. Ver Usuarios

1. Acceda al modulo **Sistema** desde el menu lateral.
2. Seleccione la seccion **Usuarios**.
3. El sistema mostrara la lista de usuarios registrados con su nombre, rol y estado.

#### 14.2.2. Crear un Nuevo Usuario

1. Haga clic en **Nuevo Usuario**.
2. Complete los campos:
   - **Nombre de Usuario:** Identificador unico para inicio de sesion.
   - **Nombre Completo:** Nombre y apellido del usuario.
   - **Correo Electronico:** Email de contacto.
   - **Rol:** Seleccione el rol del usuario (Administrador, Agronomo, Laboratorio, Operador, Visualizador).
   - **Contrasena:** Ingrese una contrasena temporal.
   - **Campos Asignados:** Seleccione los campos a los que el usuario tendra acceso.
3. Haga clic en **Guardar**.

> **Importante:** Comunique la contrasena temporal de forma segura al nuevo usuario e indiquele que debe cambiarla en su primer inicio de sesion.

#### 14.2.3. Editar un Usuario

1. Haga clic en el icono de **Editar** del usuario.
2. Modifique los campos necesarios (rol, campos asignados, estado).
3. Haga clic en **Guardar**.

#### 14.2.4. Desactivar un Usuario

1. Haga clic en el icono de **Editar** del usuario.
2. Cambie el estado a **Inactivo**.
3. Haga clic en **Guardar**.

> **Nota:** Los usuarios inactivos no pueden iniciar sesion pero sus datos historicos se conservan en el sistema.

### 14.3. Restriccion de Acceso por Campo

El sistema permite limitar el acceso de cada usuario a campos especificos:

1. Edite el usuario deseado.
2. En la seccion **Campos Asignados**, marque los campos a los que el usuario debe tener acceso.
3. El usuario solo podra ver y operar en los TestBlocks, inventarios y labores de los campos asignados.

> **Nota:** Los usuarios con rol Administrador tienen acceso a todos los campos independientemente de esta configuracion.

### 14.4. Gestion de Contrasenas

**Restablecer la contrasena de un usuario:**

1. Acceda a la seccion **Usuarios**.
2. Busque el usuario.
3. Haga clic en **Restablecer Contrasena**.
4. Ingrese la nueva contrasena temporal.
5. Confirme la operacion.
6. Comunique la nueva contrasena al usuario.

**Cambiar su propia contrasena:**

1. Haga clic en el icono de usuario en la esquina superior derecha.
2. Seleccione **Cambiar Contrasena**.
3. Ingrese su contrasena actual.
4. Ingrese la nueva contrasena (dos veces para confirmar).
5. Haga clic en **Guardar**.

### 14.5. Registro de Auditoria

El sistema registra automaticamente todas las operaciones de insercion, actualizacion y eliminacion realizadas por los usuarios:

1. Acceda a la seccion **Auditoria** dentro del modulo Sistema.
2. El registro muestra:

| Columna | Descripcion |
|---------|-------------|
| Fecha y Hora | Momento exacto de la operacion |
| Usuario | Quien realizo la operacion |
| Operacion | INSERT, UPDATE o DELETE |
| Entidad | Tabla o modulo afectado |
| Detalle | Valores anteriores y nuevos (para actualizaciones) |

3. Utilice los filtros para buscar por usuario, fecha, tipo de operacion o entidad.

> **Consejo:** Revise periodicamente el registro de auditoria para detectar operaciones inusuales o errores que necesiten correccion.

---

## 15. Preguntas Frecuentes (FAQ)

### Acceso y Sesion

**P: No puedo iniciar sesion. Que debo hacer?**

R: Verifique que su nombre de usuario y contrasena esten correctamente escritos (respetando mayusculas y minusculas). Si el problema persiste, contacte al administrador para verificar que su cuenta este activa y para restablecer su contrasena.

**P: Mi sesion se cerro inesperadamente. Es normal?**

R: Si. Por seguridad, el sistema cierra automaticamente las sesiones inactivas despues de un periodo determinado. Vuelva a iniciar sesion con sus credenciales.

**P: Puedo tener multiples sesiones abiertas?**

R: Se recomienda mantener una unica sesion activa para evitar conflictos de datos.

### Inventario

**P: Como saber si un lote tiene stock disponible para despacho?**

R: Revise la columna **Stock Actual** en la lista de inventario. El stock disponible real es: Stock Actual - Stock Comprometido. Si hay stock comprometido, significa que ya esta reservado para despachos pendientes.

**P: Puedo deshacer un movimiento de stock?**

R: No es posible deshacer movimientos directamente. Debe registrar un movimiento inverso (entrada si fue salida, o salida si fue entrada) con la justificacion correspondiente.

**P: Que significa la alerta de stock bajo?**

R: Indica que el lote tiene menos del 20% de su stock inicial. Es una senal para programar el reabastecimiento con el vivero proveedor.

### TestBlocks

**P: Puedo cambiar el tamano de un TestBlock despues de crearlo?**

R: No. La dimension de la grilla (hileras x columnas) se define al crear el TestBlock y no puede modificarse posteriormente. Planifique cuidadosamente el tamano antes de la creacion.

**P: Que pasa si doy de baja una planta por error?**

R: Puede registrar un replante en esa posicion con los mismos datos de la planta original. El historial conservara el registro de la baja y el replante.

**P: Puedo asignar mas de una variedad en un mismo TestBlock?**

R: Si. Cada posicion del TestBlock es independiente y puede contener una variedad diferente.

### Laboratorio

**P: Que significan los clusters C1, C2, C3 y C4?**

R: Son clasificaciones de calidad basadas en el algoritmo Band-Sum. C1 (Excelente) indica la mejor calidad, mientras que C4 (Deficiente) indica que la fruta esta por debajo de los estandares. Consulte la seccion 9.4 de este manual para mas detalles.

**P: Puedo modificar una medicion ya registrada?**

R: Si, puede editar una medicion existente. Haga clic en el icono de editar en la fila de la medicion. El sistema recalculara automaticamente el cluster.

**P: Los umbrales de clasificacion son los mismos para todas las variedades?**

R: No. El sistema cuenta con mas de 40 reglas de umbrales especificas por variedad y tipo de fruta. Cada variedad tiene rangos optimos diferentes.

**P: Cual es la diferencia entre firmeza simple y firmeza detallada?**

R: La firmeza simple registra un unico valor promedio. La firmeza detallada permite ingresar mediciones en 5 puntos especificos de la fruta (punta, quilla, hombro, mejilla 1, mejilla 2) y calcula el promedio automaticamente, lo que proporciona mayor precision.

### Labores

**P: Puedo modificar una labor ya ejecutada?**

R: No. Una vez marcada como ejecutada, la labor no puede modificarse. Si es necesario registrar una correccion, cree una nueva labor con las observaciones correspondientes.

**P: Es obligatorio adjuntar fotos a las labores?**

R: No es obligatorio, pero se recomienda especialmente para labores criticas como poda, control de plagas y cosecha, ya que las evidencias fotograficas facilitan la trazabilidad.

### General

**P: Que temporada debo seleccionar?**

R: La temporada activa actual es 2024-2025. Consulte con su supervisor si necesita trabajar con temporadas anteriores.

**P: Puedo exportar datos del sistema?**

R: Si. Los reportes pueden exportarse en formato PDF desde el modulo de Analisis. Los datos de mediciones y mantenedores pueden exportarse a Excel desde sus respectivos modulos.

---

## 16. Solucion de Problemas

### 16.1. Problemas de Acceso

| Problema | Posible Causa | Solucion |
|----------|--------------|----------|
| No carga la pagina de inicio de sesion | Sin conexion a internet o URL incorrecta | Verifique su conexion a internet y confirme la URL con el administrador |
| Credenciales rechazadas | Contrasena incorrecta o cuenta inactiva | Contacte al administrador para restablecer la contrasena o verificar el estado de la cuenta |
| Pagina en blanco despues del login | Cache del navegador corrupta | Borre la cache del navegador (Ctrl + Shift + Delete) y vuelva a intentar |
| Error de permisos al acceder a un modulo | Rol insuficiente o campos no asignados | Contacte al administrador para verificar su rol y campos asignados |

### 16.2. Problemas de Datos

| Problema | Posible Causa | Solucion |
|----------|--------------|----------|
| No aparecen opciones en listas desplegables | Datos maestros no cargados | Verifique que el catalogo correspondiente en Mantenedores tenga registros |
| Error al importar Excel | Formato incorrecto en el archivo | Descargue la plantilla oficial y verifique que los datos respeten el formato indicado |
| Mediciones no generan cluster | Faltan umbrales para la variedad | Contacte al administrador para verificar que la variedad tenga umbrales de clasificacion definidos |
| Datos no se actualizan en pantalla | Cache del navegador | Recargue la pagina con Ctrl + F5 o cierre y abra el navegador |

### 16.3. Problemas de Rendimiento

| Problema | Posible Causa | Solucion |
|----------|--------------|----------|
| El sistema responde lento | Conexion a internet lenta o muchos datos en pantalla | Verifique su conexion. Use filtros para limitar la cantidad de datos mostrados |
| Graficos no cargan | Navegador desactualizado | Actualice su navegador a la ultima version |
| Errores intermitentes | Servidor en mantenimiento | Espere unos minutos y vuelva a intentar. Si persiste, contacte soporte |

### 16.4. Problemas con Codigos QR

| Problema | Posible Causa | Solucion |
|----------|--------------|----------|
| QR no se genera | Datos incompletos en el registro | Verifique que todos los campos obligatorios esten completos |
| QR no se escanea correctamente | Impresion borrosa o danada | Reimprima el QR con mayor resolucion y calidad |
| QR escaneado no abre el sistema | Sin conexion a internet en campo | Asegurese de tener cobertura de datos moviles al escanear |

### 16.5. Limpieza de Cache del Navegador

Si experimenta problemas persistentes, siga estos pasos para limpiar la cache:

**Google Chrome:**

1. Presione Ctrl + Shift + Delete.
2. Seleccione **Todo el tiempo** en el rango temporal.
3. Marque **Imagenes y archivos almacenados en cache**.
4. Haga clic en **Borrar datos**.
5. Cierre y abra nuevamente el navegador.

**Microsoft Edge:**

1. Presione Ctrl + Shift + Delete.
2. Seleccione **Todo el tiempo** en el rango temporal.
3. Marque **Imagenes y archivos en cache**.
4. Haga clic en **Borrar ahora**.
5. Cierre y abra nuevamente el navegador.

---

## 17. Soporte y Contacto

### 17.1. Canales de Soporte

Para solicitar asistencia tecnica o reportar problemas con el sistema, utilice los siguientes canales:

| Canal | Detalle | Horario |
|-------|---------|---------|
| Correo electronico | soporte@valuedata.cl | Lunes a viernes, 9:00 a 18:00 hrs |
| Administrador interno | Contacte al administrador del sistema de su organizacion | Horario laboral |

### 17.2. Informacion para Reportar un Problema

Al contactar soporte, proporcione la siguiente informacion para una resolucion mas rapida:

- **Nombre de usuario** con el que accede al sistema.
- **Modulo** donde ocurre el problema (ej. Laboratorio, TestBlocks).
- **Descripcion detallada** de lo que intenta hacer y que error obtiene.
- **Captura de pantalla** del error (si es posible).
- **Navegador y version** que esta utilizando.
- **Fecha y hora** aproximada en que ocurrio el problema.

### 17.3. Actualizaciones del Sistema

El sistema se actualiza periodicamente para incorporar mejoras y correcciones. Las actualizaciones se realizan de forma centralizada y no requieren accion por parte de los usuarios. Cuando se implementen cambios relevantes, se notificara a los usuarios a traves del administrador del sistema.

---

**Sistema de Segmentacion de Nuevas Especies v4.0.0**
**Garces Fruit / Value Data**
**Abril 2026**
**Todos los derechos reservados.**
