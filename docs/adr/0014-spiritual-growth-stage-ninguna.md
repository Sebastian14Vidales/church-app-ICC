# ADR-0014 — Opción "Ninguna" en la ruta de crecimiento espiritual del perfil de miembro

- **Estado**: Aceptado
- **Fecha**: 2026-09-09
- **Custodio**: `chief-architect`
- **Tema**: Dominio de negocio — perfil de miembro (campo `spiritualGrowthStage`)
- **Solicitud**: Usuario (Sponsor) — agregar una opción "Ninguna" en "Ruta de crecimiento"
- **Contrato**: extensión del dominio de un enum existente, sin cambio de forma de payload.
  Especificado directamente por el `chief-architect` en este ADR; `doc-keeper` actualiza
  los contratos documentados (`docs/api/members-api.md`, `docs/api/members-bulk-import.md`).

## Contexto

`UserProfile.spiritualGrowthStage` ("Ruta de crecimiento espiritual") es hoy obligatorio y
solo admite las 7 etapas canónicas de ADR-0006/0007:

```ts
const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",           // 0
  "Discipulado básico",      // 1
  "Carácter cristiano",      // 2
  "Sanidad y propósito",     // 3
  "Cosmovisión bíblica",     // 4
  "Finanzas y Gobierno",     // 5
  "Doctrina cristiana",      // 6
];
```

El ministerio necesita registrar miembros que **aún no han iniciado** la ruta de crecimiento.
Hoy la única forma de "sin etapa" es `null` (mostrado como "Sin definir"), que no puede
elegirse explícitamente en el formulario, no tiene representación en el bulk import (la
columna es obligatoria) y convive de forma confusa con el estado "sin definir".

Existe precedente en el propio modelo: `encounterStage` incluye **"Ninguno"** como valor
explícito del enum.

Este cambio NO es trivial porque el enum tiene varios puntos de acoplamiento:

1. `Course.spiritualGrowthStage` usa el **mismo** array (todo curso pertenece a una etapa real).
2. Elegibilidad (ADR-0006 §D3): `getNextSpiritualGrowthStage` está duplicado en backend
   (`backend/src/services/course-assignment.service.ts`) y frontend
   (`frontend/src/pages/courses/MyCoursesProfessor.tsx`). Hoy: sin etapa → siguiente
   "Consolidación"; valor con `indexOf === -1` → `null` (no elegible).
3. Barra de progreso del miembro (`Members.tsx::getGrowthProgress`): `(índice+1)/longitud`.
4. Bulk import (ADR-0010/0012/0013): columna obligatoria validada contra el enum
   (`member-bulk-import.service.ts`).
5. Script de diagnóstico `backend/src/config/verify-stages.ts`: marca documentos fuera del enum.

## Decisión

### D1 — "Ninguna" como valor explícito y almacenado (solo en el perfil)

`UserProfile.spiritualGrowthStage` admite ahora 8 valores: **"Ninguna"** + las 7 etapas.
Se sigue el precedente de `encounterStage` ("Ninguno"). El campo sigue siendo **obligatorio**
en formulario, validadores y bulk import: "Ninguna" es una elección explícita del usuario,
no la ausencia de respuesta.

### D2 — La secuencia canónica NO cambia

`SPIRITUAL_GROWTH_STAGES` (7 etapas ordenadas) queda intacta y sigue siendo la fuente de
verdad de secuencia, progreso, elegibilidad y mapeo de cursos. **"Ninguna" no se inserta en
ese array** (no es una etapa). Nuevos exports:

- Backend (`backend/src/models/user-profile.model.ts`):
  `NO_SPIRITUAL_GROWTH_STAGE = "Ninguna"` y
  `SPIRITUAL_GROWTH_STAGE_CHOICES = [NO_SPIRITUAL_GROWTH_STAGE, ...SPIRITUAL_GROWTH_STAGES]`.
- Frontend (`frontend/src/types/index.ts`):
  `NO_SPIRITUAL_GROWTH_STAGE` y `spiritualGrowthStageChoiceSchema`
  (+ tipo `SpiritualGrowthStageChoice`). `spiritualGrowthStageSchema` (cursos) queda intacto.

`Course.spiritualGrowthStage` **NO admite "Ninguna"**: todo curso del catálogo pertenece a
una etapa real de la secuencia (ADR-0006 §D2).

### D3 — Elegibilidad: "Ninguna" ≡ sin etapa

`getNextSpiritualGrowthStage("Ninguna")` → `"Consolidación"` (idéntico a `null`/`undefined`).
Se actualiza la implementación backend y su espejo frontend. Un miembro con "Ninguna" es
elegible para inscribirse en el curso de "Consolidación".

### D4 — Progreso: "Ninguna" → 0 %

`getGrowthProgress("Ninguna")` → `0`. La tarjeta de miembro muestra "Ninguna" literal
(no "Sin definir": fue una elección explícita, distinguible del dato heredado vacío).

### D5 — Filtro "Ruta espiritual": "Ninguna" agrupa también a los "Sin definir"

En `MemberFilters`, la opción "Ninguna" muestra miembros con etapa "Ninguna" **o sin etapa
definida** (`null`/`undefined`). Para el usuario final (pastor/líder) ambas poblaciones
responden a la misma pregunta: "¿quién no ha iniciado la ruta?".

### D6 — Bulk import acepta "Ninguna"

La columna "Ruta de crecimiento espiritual" sigue siendo obligatoria, pero admite "Ninguna"
como valor válido. Mensajes de error existentes sin cambios.

### D7 — Sin migración de datos

Los perfiles existentes con `null`/`undefined` conservan su estado ("Sin definir"). No se
fuerza su conversión a "Ninguna"; si el negocio lo pide, se hará como migración puntual
separada (ver Consecuencias).

## Cambios esperados

### Backend

- `backend/src/models/user-profile.model.ts`: nuevas constantes exportadas + campo
  `spiritualGrowthStage` con `enum: SPIRITUAL_GROWTH_STAGE_CHOICES`. **No tocar**
  `SPIRITUAL_GROWTH_STAGES` ni `course.model.ts`.
- `backend/src/config/verify-stages.ts`: perfiles se validan contra
  `SPIRITUAL_GROWTH_STAGE_CHOICES`; cursos contra `SPIRITUAL_GROWTH_STAGES`.
- `backend/src/routes/user-profile.routes.ts`: validadores create/update usan
  `SPIRITUAL_GROWTH_STAGE_CHOICES` (create mantiene `notEmpty`).
- `backend/src/services/member-bulk-import.service.ts`: validación de la columna acepta
  "Ninguna" (usa `SPIRITUAL_GROWTH_STAGE_CHOICES`).
- `backend/src/services/course-assignment.service.ts`: `getNextSpiritualGrowthStage`
  trata "Ninguna" como sin etapa (D3).
- `backend/src/controller/user-profile.controller.ts`: **sin cambios** ("Ninguna" es truthy
  y fluye por los spreads existentes); solo verificación.

### Frontend

- `frontend/src/types/index.ts`: `NO_SPIRITUAL_GROWTH_STAGE`,
  `spiritualGrowthStageChoiceSchema`, `SpiritualGrowthStageChoice`; `memberSchema` y
  `MemberFormData` usan el schema ampliado. `createCourseSchema`/`courseCatalogSchema`
  **sin cambios**.
- `frontend/src/components/dashboard/MemberForm.tsx`: select ofrece "Ninguna" (primera
  opción) + 7 etapas; sigue siendo requerido.
- `frontend/src/components/dashboard/MemberFilters.tsx`: filtro "Ruta espiritual" incluye
  "Ninguna" (primera opción).
- `frontend/src/pages/members/Members.tsx`: `getGrowthProgress` devuelve 0 para "Ninguna"
  (D4); semántica del filtro por etapa (D5).
- `frontend/src/pages/courses/MyCoursesProfessor.tsx`: espejo de
  `getNextSpiritualGrowthStage` con el caso "Ninguna" (D3).
- `frontend/src/api/MemberAPI.ts`: sin cambio de comportamiento (`|| undefined` conserva
  "Ninguna"); ajustes de tipos si el typecheck los exige.

### Documentación

- `docs/api/members-api.md` §2: dominio del campo ampliado (perfil) vs. cursos (7 etapas).
- `docs/api/members-bulk-import.md`: lista de valores válidos de la columna + regla 11.
- `docs/functional/members-bulk-import.md`: tabla de valores válidos (línea ~69) y nota
  del desplegable (línea ~132).
- Nota opcional en `docs/api/life-groups-api.md` si lista el dominio del campo embebido.

## Consecuencias

### Positivas

- El pastor puede registrar explícitamente miembros que no han iniciado la ruta
  (formulario, edición y bulk import).
- "Eligió Ninguna" y "Sin definir" quedan distinguibles, y el filtro los agrupa (D5).
- Cero impacto en cursos, avance automático, migraciones y elegibilidad existente
  (la secuencia canónica no cambia).

### Negativas / trade-offs

- Conviven dos representaciones de "sin ruta" ("Ninguna" almacenada y `null` heredado).
  Mientras coexistan, toda lógica nueva debe tratarlas como equivalentes (D3/D5); una
  futura migración opcional de `null` → "Ninguna" eliminaría la dualidad (decisión de
  negocio pendiente, propuesta al `product-owner`).
- Un enum más duplicado backend↔frontend que mantener (drift vigilado por `quality-engineer`).

## Alternativas consideradas

- **Mapear "Ninguna" a `null` solo en la UI**: descartada. En el update, `undefined` hoy
  significa "no cambiar" (no "limpiar") y no habría forma de volver a "sin ruta"; el bulk
  import seguiría sin poder expresarlo; y contradiría el precedente "Ninguno" de
  `encounterStage`.
- **Insertar "Ninguna" como `SPIRITUAL_GROWTH_STAGES[0]`**: descartada. Haría que `Course`
  admita "Ninguna", desplazaría todos los índices de progreso/elegibilidad, obligaría a
  revisar migraciones y alteraría los ADR-0006/0007 sin necesidad.

## Riesgos vigilados

- **Drift de `getNextSpiritualGrowthStage`** (dos implementaciones): verificar ambas (D3).
- **`verify-stages.ts`** debe usar conjuntos distintos para perfiles (8 valores) y cursos (7).
- **Mocks de tests** que replican el enum del modelo (`member-bulk-import.service.test.ts`)
  deben exportar las nuevas constantes para que el suite no rompa.
- `quality-engineer` audita al cierre que ningún consumidor del enum quede sin el caso "Ninguna".

## Referencias

- `docs/adr/0006-course-growth-mapping.md`, `docs/adr/0007-finanzas-gobierno-stage.md`
  (secuencia canónica y elegibilidad).
- `docs/adr/0010-members-bulk-import.md`, `docs/adr/0012-bulk-import-duplicate-columns.md`,
  `docs/adr/0013-bulk-import-profession-date-formats.md` (bulk import).
- `backend/src/models/user-profile.model.ts`, `backend/src/services/course-assignment.service.ts`,
  `backend/src/services/member-bulk-import.service.ts`, `backend/src/routes/user-profile.routes.ts`,
  `backend/src/config/verify-stages.ts`.
- `frontend/src/types/index.ts`, `frontend/src/components/dashboard/MemberForm.tsx`,
  `frontend/src/components/dashboard/MemberFilters.tsx`, `frontend/src/pages/members/Members.tsx`,
  `frontend/src/pages/courses/MyCoursesProfessor.tsx`.
