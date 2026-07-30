# ADR-0006 — Vinculación de cursos con etapas de crecimiento espiritual y avance automático

- **Estado**: Aceptado
- **Fecha**: 2026-07-29
- **Custodio**: `chief-architect`
- **Tema**: Dominio de negocio — cursos y crecimiento espiritual
- **Apertura delegada por**: `chief-architect` (solicitud directa de negocio)
- **Redacción técnica**: `chief-architect`

## Contexto

El sistema gestiona cursos bíblicos y el crecimiento espiritual de los miembros. Hoy
existe un campo `spiritualGrowthStage` en el perfil del miembro, pero no existe una
relación formal entre los cursos del catálogo y las etapas de crecimiento. Esto
permite asignar cualquier miembro a cualquier curso, sin respetar la secuencia
pedagógica declarada por el negocio.

El usuario solicitó:

> Los asistentes o miembros que tenga un crecimiento espiritual hasta "cosmovision"
> no podrán cursar los anteriores como por ej: "consolidacion, discipulado, character
> cristiano, sanidad". En ese mismo orden, ellos unicamente estarán actos para el
> siguiente, que en este ejemplo sería doctrina cristiana. Cuando el miembro o
> asistente finaliza un curso, se actualiza automaticamente en su perfil. Es decir,
> avanza en su crecimiento automaticamente. Cabe resaltar que debe cumplir con el %
> de asistencias que ya esta establecido para pasar.

## Decisión

### D1 — Secuencia canónica de crecimiento espiritual

Se adopta la siguiente secuencia inmutable, ya presente en el modelo de datos:

```ts
const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",           // índice 0
  "Discipulado básico",      // índice 1
  "Carácter cristiano",      // índice 2
  "Sanidad y propósito",     // índice 3
  "Cosmovisión bíblica",     // índice 4
  "Doctrina cristiana",      // índice 5
];
```

Fuente de verdad:

- Backend: `backend/src/models/user-profile.model.ts`.
- Frontend: `frontend/src/types/index.ts` (`spiritualGrowthStageSchema`).

Cualquier cambio a esta secuencia requiere modificar ambos archivos y revisar la
lógica de avance automático.

### D2 — Cada curso pertenece a exactamente una etapa

Se añade el campo `spiritualGrowthStage` al modelo `Course`
(`backend/src/models/course.model.ts`) como obligatorio y con el mismo enum de
etapas:

```ts
spiritualGrowthStage: {
  type: String,
  enum: SPIRITUAL_GROWTH_STAGES,
  required: true,
}
```

En el frontend se añade el campo a:

- `courseCatalogSchema` y `createCourseSchema` (`frontend/src/types/index.ts`).
- Formulario de curso (`frontend/src/pages/courses/Courses.tsx` o componente de
  formulario asociado).

Esto significa que **el nivel del curso (`basic`/`intermediate`/`advanced`) es
independiente de la etapa de crecimiento**. Una etapa puede tener varios cursos, pero
un curso solo representa una etapa.

### D3 — Regla de elegibilidad

Un miembro puede ser inscrito en un curso si y solo si la etapa del curso es la
**siguiente etapa** en la secuencia respecto a la etapa actual del miembro.

```ts
const currentIndex = member.spiritualGrowthStage
  ? SPIRITUAL_GROWTH_STAGES.indexOf(member.spiritualGrowthStage)
  : -1;
const nextStage = SPIRITUAL_GROWTH_STAGES[currentIndex + 1];
const isEligible = nextStage === course.spiritualGrowthStage;
```

Casos límite:

- Si el miembro **no tiene etapa definida**, su siguiente etapa es
  `"Consolidación"` (índice 0).
- Si el miembro está en la última etapa (`"Doctrina cristiana"`), no puede tomar
  ningún curso de avance (no hay siguiente etapa). Podrá repetir cursos de su
  misma etapa si el negocio lo decide en el futuro, pero hoy no se permite.
- Si el miembro ya superó la etapa del curso (etapa actual > etapa del curso),
  tampoco puede inscribirse.

### D4 — Umbral de aprobación

El porcentaje de asistencia mínimo para aprobar un curso y avanzar de etapa es
**70%**. Este valor ya estaba hardcodeado en el frontend
(`frontend/src/utils/attendanceInsights.ts`) como umbral de "estudiantes en
riesgo". Este ADR lo eleva a **regla de negocio formal** y lo utiliza también en
el backend.

La asistencia de un miembro en un curso se calcula como:

```ts
const attendanceRate = totalClasses
  ? Math.round((presentCount / totalClasses) * 100)
  : 0;
const passed = attendanceRate >= 70;
```

Se usa `totalClasses` de la asignación (no solo las clases registradas) para evitar
avanzar a alguien que faltó a clases no registradas. Si una clase no se registró,
cuenta como falta para el cálculo de aprobación.

### D5 — Avance automático al cerrar el curso

Cuando una asignación pasa a `status: "completed"` (cierre de curso), el backend
recorre cada miembro inscrito y, si aprobó (`attendanceRate >= 70%`), actualiza su
`spiritualGrowthStage` a la etapa del curso.

El avance se ejecuta en el service/controller de cierre
(`backend/src/services/course-assignment.service.ts` → `closeAssignment`) dentro de
la misma lógica transaccional si es posible, o inmediatamente después del cierre.

Si un miembro no aprueba, su etapa **no cambia** y puede volver a inscribirse en
el mismo curso (misma etapa) en una próxima asignación, según D3.

### D6 — Restricciones de rol para registro de miembros

Se mantiene la lógica existente:

- `Admin` y `Superadmin`: pueden registrar/editar miembros con cualquier campo,
  incluido `baptized`.
- `Profesor`, `Pastor` y `Supervisor`: al registrar un miembro, el campo
  `baptized` no se muestra en el formulario y se guarda automáticamente como
  `false` (no bautizado → rol `Asistente`). Ver ADR-0006bis / tarea 6 del sprint.

## Consecuencias

### Positivas

- Se respeta la secuencia pedagógica del negocio; no se pueden saltar etapas.
- Se reduce el error humano al asignar miembros a cursos inadecuados.
- El cierre de curso actualiza automáticamente el perfil, manteniendo el
  crecimiento espiritual sincronizado.

### Negativas / trade-offs

- Se añade una validación más en la asignación de miembros a cursos. Los
  administradores deben asegurar que cada curso del catálogo tenga la etapa
  correcta; si no, nadie podrá inscribirse.
- Cursos existentes en la base de datos requerirán una migración para asignarles
  `spiritualGrowthStage`. Hasta tanto, la validación podría rechazar asignaciones.
  Ver "Decisiones que requieren ratificación".
- El umbral 70% es global; no permite curso con umbral diferente sin nuevo ADR.

## Cambios esperados

### Backend

- `backend/src/models/user-profile.model.ts`: añadir `profession` (tarea 5, se
  documenta aquí porque afecta el mismo modelo).
- `backend/src/models/course.model.ts`: añadir `spiritualGrowthStage` requerido.
- `backend/src/services/course-assignment.service.ts`:
  - Helper `getNextSpiritualGrowthStage(currentStage)`.
  - Validación de elegibilidad en `addMembers`.
  - Avance automático en `closeAssignment`.
- `backend/src/controller/course-assignment.controller.ts`:
  - Devolver error 400/409 si se intenta inscribir un miembro no elegible.
- `backend/src/controller/user-profile.controller.ts`:
  - Persistir `profession` en `create` y `update`.

### Frontend

- `frontend/src/types/index.ts`:
  - Añadir `profession` a `courseParticipantSchema` (si aún no está).
  - Añadir `spiritualGrowthStage` a `courseCatalogSchema` y `createCourseSchema`.
- `frontend/src/api/CourseAPI.ts` / `MemberAPI.ts`: enviar nuevos campos.
- `frontend/src/pages/members/Members.tsx`:
  - Mostrar `profession` en la tarjeta.
  - Filtrar por `profession`.
- `frontend/src/components/dashboard/MemberFilters.tsx`: input de filtro por profesión.
- `frontend/src/components/dashboard/MemberForm.tsx`:
  - Ocultar `baptized` para `Profesor`/`Pastor`/`Supervisor`.
  - Ajustar espaciado de dos columnas para `Admin`/`Superadmin`.
- `frontend/src/pages/courses/Courses.tsx`:
  - Añadir campo "Etapa de crecimiento espiritual" al crear/editar curso.
- `frontend/src/pages/courses/MyCoursesProfessor.tsx` y modal de registro:
  - Filtrar miembros elegibles según la etapa del curso activo.

## Decisiones que requieren ratificación del `chief-architect`

1. **Migración de cursos existentes**: ¿quién y cómo asignará `spiritualGrowthStage`
   a los cursos ya creados? Opciones: (a) script de migración en `backend/config/`,
   (b) hacer el campo opcional transitoriamente, (c) carga manual por admin.
   Recomendación: (a) con valores por defecto basados en `level` o en mapeo
   manual, ejecutado por `database-engineer`.
2. **70% como umbral global**: ¿se acepta como regla de negocio fija por ahora?
3. **Repetición de cursos**: ¿un miembro que no aprueba puede repetir el mismo
   curso? Según D3, sí, porque su etapa actual no avanzó y el curso sigue siendo
   su "siguiente etapa". ¿Ratificar?

## Referencias

- `backend/src/models/user-profile.model.ts` (`SPIRITUAL_GROWTH_STAGES`).
- `backend/src/models/course.model.ts`.
- `backend/src/services/course-assignment.service.ts`.
- `frontend/src/types/index.ts` (`spiritualGrowthStageSchema`, `courseCatalogSchema`).
- `frontend/src/utils/attendanceInsights.ts` (umbral 70%).
- `frontend/src/pages/courses/MyCoursesProfessor.tsx`.
- `frontend/src/pages/members/Members.tsx`.
