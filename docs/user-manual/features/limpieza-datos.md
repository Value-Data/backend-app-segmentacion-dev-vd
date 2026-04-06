# Limpieza de Datos - Manual de Usuario

## 1. Fusionar Registros Duplicados

El sistema permite fusionar (merge) registros duplicados en:
- **Viveros**
- **Campos**
- **PMG** (Programas de Mejoramiento Genetico)

### 1.1 Como funciona la fusion

Cuando fusionas el registro **A** (origen) en el registro **B** (destino):
1. Todas las variedades, lotes, plantas y testblocks que referenciaban a A ahora apuntan a B
2. El registro A se desactiva (activo = false)
3. El registro B conserva sus datos originales
4. No se pierde informacion, solo se consolida

### 1.2 Fusionar desde la interfaz

1. Ir a **Catalogos** > seleccionar la entidad (Viveros, Campos, o PMG)
2. Click en el boton **"Fusionar"** en la esquina superior derecha
3. Seleccionar el **Origen** (el que se va a eliminar)
4. Seleccionar el **Destino** (el que se va a conservar)
5. Revisar el resumen y confirmar

> **Importante:** Esta accion no se puede deshacer facilmente. Verificar bien antes de confirmar.

---

## 2. PMGs Duplicados Conocidos

Estos PMGs han sido reportados como duplicados:

| Duplicado | Correcto | Accion |
|-----------|----------|--------|
| Peter Stoppel Cerasina | Cerasina - Peter Stoppel | Fusionar en el que tenga mas variedades |
| Zaiger 1, Zaiger Genetics, Zaiger... | Zaiger (el principal) | Fusionar todos en uno |
| Bradford 1, Bradford 2, Bradford... | Bradford (el principal) | Fusionar todos en uno |

### 2.1 Script automatico de limpieza

Para administradores con acceso al servidor:

```bash
cd backend

# Ver todos los PMGs actuales
python scripts/cleanup_pmg.py --list

# Buscar duplicados automaticamente
python scripts/cleanup_pmg.py --find

# Ver que haria la limpieza (sin ejecutar)
python scripts/cleanup_pmg.py --dry-run

# Ejecutar la limpieza
python scripts/cleanup_pmg.py --execute
```

El script:
- Identifica duplicados por nombre similar
- Busca patrones conocidos (Zaiger, Bradford, Cerasina/Peter Stoppel)
- Conserva el PMG con mas variedades asociadas
- Mueve todas las referencias (variedades, lotes, plantas) al PMG destino
- Desactiva los PMGs duplicados

---

## 3. Variedades con PMG Incorrecto

Si una variedad esta asociada al PMG equivocado:

1. Ir a **Catalogos > Variedades**
2. Filtrar por PMG para ver las variedades de cada programa
3. Click en la variedad > **Editar**
4. Cambiar el campo **PMG** al correcto
5. Guardar

### 3.1 Verificacion rapida

Para detectar variedades mal asociadas:
1. Ir a Variedades
2. Filtrar por cada PMG
3. Revisar que las variedades listadas pertenezcan realmente a ese programa
4. Corregir las que esten mal

---

## 4. Limpiar Inventario Antiguo

Para eliminar lotes de inventario que ya no son relevantes:

1. Ir a **Inventario Vivero**
2. Identificar los lotes a limpiar (por fecha, estado, etc.)
3. Click en el lote > **Eliminar** (soft delete: se desactiva, no se borra)

> **Nota:** Los lotes con plantas activas en testblocks NO se pueden eliminar. Primero dar de baja las plantas.

---

## 5. Limpiar Campos/Viveros Obsoletos

En la pagina de Campos se mezclan campos reales con ubicaciones de vivero (prefijo LOC-).

Para organizar:
1. Identificar cuales son campos de testblock reales (ej: Sta Margarita, Retorno)
2. Identificar cuales son ubicaciones de vivero (ej: LOC-PRODCTOR, LOC-REQUINOA)
3. Fusionar los duplicados usando el boton **"Fusionar"**
4. Desactivar los que ya no se usen
