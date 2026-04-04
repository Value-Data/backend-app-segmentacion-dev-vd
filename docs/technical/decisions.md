# Decisiones de Arquitectura (ADR)

## Sistema de Segmentacion de Nuevas Especies - Garces Fruit

---

## ADR-001: Migrar de Streamlit a React + FastAPI

**Estado**: Aprobada
**Fecha**: 2026-03-20

### Contexto
El sistema v3.4 esta construido como una aplicacion monolitica en Streamlit. La aplicacion ha crecido a 41 paginas, 48 modelos SQLModel y multiples componentes custom, alcanzando los limites de lo que Streamlit puede ofrecer.

### Problemas con Streamlit
1. **Modelo de ejecucion**: Streamlit re-ejecuta todo el script en cada interaccion del usuario, causando latencia y re-renders innecesarios
2. **Interactividad limitada**: La grilla interactiva del TestBlock (seleccion de posiciones, colores por estado, zoom) requiere manipulacion DOM que Streamlit no soporta nativamente
3. **Autenticacion fragil**: La autenticacion actual usa `st.session_state`, sin soporte real para JWT, expiacion de sesiones ni control granular por roles
4. **Escalabilidad**: No es posible tener multiples instancias concurrentes de forma eficiente
5. **Mobile**: Streamlit no ofrece una experiencia mobile-first adecuada para uso en campo

### Decision
Migrar a una arquitectura desacoplada:
- **Frontend**: React 18 + TypeScript (SPA)
- **Backend**: FastAPI (API REST)

### Consecuencias
- (+) UX moderna con navegacion SPA fluida
- (+) Control total sobre la UI (grilla interactiva, formularios complejos)
- (+) Autenticacion robusta con JWT y RBAC
- (+) Frontend y backend pueden escalar independientemente
- (+) Posibilidad de aplicacion mobile futura consumiendo la misma API
- (-) Mayor complejidad de desarrollo y despliegue
- (-) Curva de aprendizaje del equipo en React

---

## ADR-002: Mantener SQL Server Azure como Base de Datos

**Estado**: Aprobada
**Fecha**: 2026-03-20

### Contexto
La base de datos actual en SQL Server Azure contiene datos de produccion: ~2,400 posiciones de testblock, ~2,291 plantas activas, 65+ variedades, 75+ lotes de inventario y 3 testblocks operativos.

### Alternativas consideradas
1. **Migrar a PostgreSQL**: Mayor compatibilidad con el ecosistema Python, pero requiere migracion de datos y cambio de DDL (IDENTITY → SERIAL, BIT → BOOLEAN, etc.)
2. **Migrar a PostgreSQL Azure**: Similar ventajas pero con riesgo de perdida de datos durante la migracion
3. **Mantener SQL Server Azure**: Sin migracion de datos, sin riesgo

### Decision
Mantener SQL Server Azure tal como esta. La migracion de tecnologia frontend/backend es suficientemente riesgosa; cambiar la base de datos agregaria riesgo innecesario sin beneficio tangible.

### Consecuencias
- (+) Cero riesgo de perdida de datos
- (+) Sin periodo de migracion ni downtime de base de datos
- (+) Los modelos SQLModel existentes funcionan sin cambios
- (+) El equipo ya conoce la estructura de la base de datos
- (-) Requiere ODBC Driver 17 en todos los entornos de desarrollo y produccion
- (-) Menor compatibilidad con herramientas del ecosistema Python que prefieren PostgreSQL
- (-) Costo de licencia de SQL Server Azure

---

## ADR-003: Usar SQLModel en lugar de SQLAlchemy puro

**Estado**: Aprobada
**Fecha**: 2026-03-20

### Contexto
El sistema Streamlit actual ya define 48 modelos usando SQLModel. FastAPI fue creado por el mismo autor de SQLModel (Sebastian Ramirez), lo que garantiza una integracion nativa.

### Alternativas consideradas
1. **SQLAlchemy puro**: ORM maduro y completo, pero requiere definir schemas Pydantic por separado
2. **SQLModel**: Combina SQLAlchemy + Pydantic en una sola clase
3. **Tortoise ORM**: Async-first, pero menos maduro y con menor comunidad

### Decision
Usar SQLModel porque:
- Los 48 modelos existentes ya estan escritos en SQLModel
- Un solo modelo sirve como tabla SQL, schema de validacion y schema de respuesta API
- Integracion nativa con FastAPI para documentacion automatica

### Consecuencias
- (+) Reutilizacion directa de los modelos existentes
- (+) Menos codigo: un modelo = tabla + validacion + schema API
- (+) Documentacion Swagger/OpenAPI generada automaticamente desde los modelos
- (-) SQLModel es menos maduro que SQLAlchemy puro para queries complejas
- (-) Para queries muy especificas puede requerirse caer a SQLAlchemy directo

---

## ADR-004: Zustand + TanStack Query para Manejo de Estado

**Estado**: Aprobada
**Fecha**: 2026-03-20

### Contexto
La aplicacion React necesita manejar dos tipos de estado:
1. **Estado del servidor**: Datos de la API (testblocks, variedades, mediciones)
2. **Estado del cliente**: Selecciones UI (testblock activo, posicion seleccionada, modo de color)

### Alternativas consideradas
1. **Redux + RTK Query**: Completo pero con mucho boilerplate
2. **Zustand + TanStack Query**: Minimalista y enfocado
3. **Jotai + TanStack Query**: Atomico, bueno para estados granulares
4. **Context API + fetch manual**: Simple pero sin cache ni invalidacion

### Decision
- **Zustand** para estado global del cliente (authStore, testblockStore, inventarioStore)
- **TanStack Query** para todo el estado del servidor (cache, invalidacion, refetch, loading/error states)

### Consecuencias
- (+) Zustand: API minimalista, sin boilerplate, <1KB
- (+) TanStack Query: cache inteligente, invalidacion automatica, deduplicacion de requests
- (+) Separacion clara entre estado del servidor y del cliente
- (+) DevTools disponibles para ambas librerias
- (-) Dos librerias de estado en lugar de una solucion unificada
- (-) El equipo debe entender la distincion servidor vs cliente

### Ejemplo de uso
```typescript
// Estado del cliente (Zustand)
const useTestblockStore = create((set) => ({
  selectedTestblock: null,
  colorMode: 'estado',
  setColorMode: (mode) => set({ colorMode: mode }),
}));

// Estado del servidor (TanStack Query)
const { data: testblocks, isLoading } = useQuery({
  queryKey: ['testblocks'],
  queryFn: () => api.get('/testblocks'),
});
```

---

## ADR-005: shadcn/ui como Libreria de Componentes

**Estado**: Aprobada
**Fecha**: 2026-03-20

### Contexto
El sistema necesita componentes UI consistentes y accesibles: tablas de datos, formularios, modales, selectores, badges de estado, cards, etc. La aplicacion tiene ~15 entidades CRUD con interfaces similares.

### Alternativas consideradas
1. **Material UI (MUI)**: Completo pero pesado, dificil de customizar, opinionado en diseno
2. **Ant Design**: Muy completo para enterprise pero con estetica fija y bundle grande
3. **shadcn/ui**: Componentes copiados al proyecto, basados en Radix UI + TailwindCSS
4. **Headless UI + Tailwind**: Totalmente headless, mas trabajo de implementacion
5. **Chakra UI**: Buen DX pero menos flexible que shadcn/ui

### Decision
Usar **shadcn/ui** porque:
- Los componentes se copian al proyecto (no son una dependencia externa)
- Total control sobre el codigo fuente de cada componente
- Basado en Radix UI (accesibilidad WCAG nativa)
- Estilos con TailwindCSS (ya seleccionado para el proyecto)
- Comunidad activa y amplia coleccion de componentes

### Consecuencias
- (+) Customizacion total: colores corporativos (#1B4F72, #2E86C1), tipografia (Plus Jakarta Sans)
- (+) Sin dependencia de version de libreria UI
- (+) Componentes accesibles por defecto (Radix UI)
- (+) Bundle optimizado: solo se incluyen los componentes usados
- (+) Integra naturalmente con @tanstack/react-table para DataTables avanzados
- (-) Requiere mas configuracion inicial que usar MUI o Ant Design
- (-) Menos componentes "listos para usar" que librerias enterprise completas
- (-) El equipo debe mantener los componentes copiados
