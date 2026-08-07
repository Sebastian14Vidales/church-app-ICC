# ADR-0007 — Nueva etapa de crecimiento espiritual: "Finanzas y Gobierno"

- **Estado**: Aceptado
- **Fecha**: 2026-08-04
- **Custodio**: `chief-architect`
- **Tema**: Dominio de negocio — secuencia pedagógica de cursos
- **Apertura delegada por**: `chief-architect` (solicitud directa del Sponsor)
- **Redacción técnica**: `chief-architect`

## Contexto

El usuario solicitó agregar un nuevo curso llamado **"Finanzas y Gobierno"** al catálogo de cursos de ICC Casa de Dios. El requisito clave es que este curso aparezca **jerárquicamente antes de la etapa "Doctrina cristiana"** en la secuencia de crecimiento espiritual actual.

La secuencia canónica establecida en el ADR-0006 es:

```ts
const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",           // 0
  "Discipulado básico",      // 1
  "Carácter cristiano",      // 2
  "Sanidad y propósito",     // 3
  "Cosmovisión bíblica",     // 4
  "Doctrina cristiana",      // 5
];
```

La etapa "Doctrina cristiana" es la última y actúa como tope: un miembro en esa etapa no puede inscribirse en nuevos cursos de avance (ADR-0006 §D3). Insertar "Finanzas y Gobierno" antes de "Doctrina cristiana" altera la lógica de elegibilidad y el avance automático.

## Decisión

### D1 — Nueva secuencia canónica

Se inserta la etapa **"Finanzas y Gobierno"** entre "Cosmovisión bíblica" y "Doctrina cristiana":

```ts
const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",           // 0
  "Discipulado básico",      // 1
  "Carácter cristiano",      // 2
  "Sanidad y propósito",     // 3
  "Cosmovisión bíblica",     // 4
  "Finanzas y Gobierno",     // 5  ← NUEVA
  "Doctrina cristiana",      // 6
];
```

Fuente de verdad:

- Backend: `backend/src/models/user-profile.model.ts` (`SPIRITUAL_GROWTH_STAGES`).
- Frontend: `frontend/src/types/index.ts` (`spiritualGrowthStageSchema`).

### D2 — Regla de elegibilidad actualizada

Se mantiene la regla de ADR-0006 §D3: un miembro puede inscribirse solo en el curso de su **siguiente etapa**.

Ejemplo actualizado:

- Un miembro en "Cosmovisión bíblica" (índice 4) ahora su siguiente etapa es "Finanzas y Gobierno" (índice 5), no "Doctrina cristiana".
- Un miembro en "Finanzas y Gobierno" (índice 5) puede avanzar a "Doctrina cristiana" (índice 6).
- Un miembro en "Doctrina cristiana" (índice 6) sigue siendo la etapa final; no puede inscribirse en cursos de avance.

### D3 — Curso del catálogo

El usuario se refirió al nuevo elemento como "curso". En el dominio actual, cada curso del catálogo pertenece a exactamente una etapa (ADR-0006 §D2). Por tanto, se creará un curso en el catálogo con:

- `name`: "Finanzas y Gobierno" (o el nombre que decida el administrador).
- `spiritualGrowthStage`: "Finanzas y Gobierno".
- `level`: valor acordado con el administrador (ej. `advanced`).

La creación del curso en el catálogo se realiza a través de la UI de administración (tab Catálogo en `Courses.tsx`), no mediante migración de datos.

### D4 — Migración de datos

No se requiere migración masiva de perfiles de miembros. La secuencia es un enum de referencia; los perfiles existentes conservan su etapa actual. Sin embargo, se debe asegurar que ningún perfil o curso tenga la etapa "Doctrina cristiana" como índice 5 en lógica interna que dependa de posiciones fijas (por ejemplo, cálculos que usen `SPIRITUAL_GROWTH_STAGES.length - 1` son correctos por diseño).

Si existen cursos en el catálogo con `spiritualGrowthStage: "Doctrina cristiana"`, permanecen válidos (ahora índice 6). El nuevo curso "Finanzas y Gobierno" se crea manualmente.

## Cambios esperados

### Backend

- `backend/src/models/user-profile.model.ts`: actualizar `SPIRITUAL_GROWTH_STAGES`.
- `backend/src/routes/user-profile.routes.ts`: actualizar el enum de validadores si está duplicado.
- `backend/src/services/course-assignment.service.ts`: `getNextSpiritualGrowthStage` usa el array, por lo que no requiere cambios estructurales (solo se ve afectado por el orden del array).

### Frontend

- `frontend/src/types/index.ts`: actualizar `spiritualGrowthStageSchema`.
- `frontend/src/components/dashboard/MemberForm.tsx`: actualizar opciones del select de etapa.
- `frontend/src/components/dashboard/MemberFilters.tsx`: actualizar filtros si los enum están replicados.
- `frontend/src/pages/courses/MyCoursesProfessor.tsx`: actualizar el enum si está replicado.
- `frontend/src/pages/courses/Courses.tsx`: el formulario de curso ya consume el schema central; no requiere cambio si el schema se actualiza.
- `docs/api/courses-api.md`: actualizar la lista de etapas en el contrato.
- `docs/adr/0006-course-growth-mapping.md`: actualizar la secuencia de ejemplo (manteniendo la nota histórica de la fecha original).

### Nota de migración de BD

- Verificar que no existan documentos en `UserProfile` ni `Course` con valores fuera del nuevo enum. MongoDB no impone el enum a nivel de base de datos; los validadores de Mongoose y los schemas Zod lo hacen en la aplicación.

## Consecuencias

### Positivas

- La secuencia pedagógica refleja la nueva realidad del ministerio.
- El avance automático y la elegibilidad se adaptan sin cambios de lógica (solo datos).

### Negativas / trade-offs

- Cambiar el orden de un enum de crecimiento puede alterar la percepción de progreso de los miembros. Se comunicará como "nueva etapa intermedia".
- Cualquier lugar que tenga la lista hardcodeada debe actualizarse; se debe hacer `grep` exhaustivo para evitar drift.

## Alternativas consideradas

- **Agregar "Finanzas y Gobierno" como curso de la etapa "Doctrina cristiana"**: descartada. El usuario fue explícito en que debe estar **antes** de Doctrina.
- **Crear una etapa separada del enum y dejar el curso suelto**: descartada. El sistema vincula curso ↔ etapa 1:1; romper esa invariante requeriría un rediseño mayor del ADR-0006.

## Riesgos vigilados

- **Drift enum backend/frontend**: `quality-engineer` debe auditar que todos los archivos con la lista hardcodeada estén sincronizados.
- **Miembro en la última etapa**: al pasar "Doctrina cristiana" del índice 5 al 6, la lógica de tope (`SPIRITUAL_GROWTH_STAGES.length - 1`) sigue funcionando correctamente.

## Referencias

- `AGENTS.md` §3 (un solo esquema Mongoose por colección, convenciones de enum).
- `AGENTS.md` §4 (nomenclatura en español para dominio de negocio).
- `docs/adr/0006-course-growth-mapping.md` (secuencia anterior y reglas de elegibilidad).
- `backend/src/models/user-profile.model.ts`.
- `frontend/src/types/index.ts`.
