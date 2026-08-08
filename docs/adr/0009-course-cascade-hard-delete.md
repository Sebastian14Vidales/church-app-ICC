# ADR-0009 — Borrado físico en cascada para el catálogo de `Course`

- **Estado**: Aceptado
- **Fecha**: 2026-08-07
- **Custodio**: `chief-architect`
- **Decisión**: aprobada por el Sponsor (Superadmin usuario) y ratificada por el `chief-architect`.
- **Deroga parcialmente**: `docs/adr/0001-courses-history-refactor.md` §D3 y §E-4 (solo para la operación de eliminación del catálogo de `Course`).

## Contexto

`AGENTS.md` §5 establece que el proyecto prefiere soft-delete mediante la marca `deletedAt` antes del borrado físico, "salvo decisión de arquitectura". El `ADR-0001` §D3 ratificó esa convención para el módulo de Cursos, definiendo que `remove` y `removeAssignment` debían hacer `deletedAt = new Date()` y conservar el historial de asistencia vinculado a asignaciones soft-deleted.

En la operación real, el Sponsor reportó un error recurrente: al intentar reasignar un profesor a un curso después de "eliminar" el curso anterior, el sistema respondía `409 { message: "Este profesor ya tiene un curso activo asignado" }`. La causa era que el catálogo de `Course` se soft-deleted (`deletedAt` seteado), pero la `CourseAssigned` activa vinculada a ese curso permanecía en la base de datos como un registro huérfano. El índice parcial unique por profesor activo encontraba esa asignación viva y bloqueaba la nueva asignación.

Tras evaluar el costo de mantener el soft-delete en el catálogo versus la necesidad de negocio de no dejar registros huérfanos, el Sponsor aprobó una excepción al patrón: la eliminación de un `Course` del catálogo será un **borrado físico en cascada** irreversible.

## Decisión

### D1 — Eliminación física en cascada de `Course`

El endpoint `DELETE /api/courses/:id` (`backend/src/controller/course.controller.ts`, método `CourseController.remove`) ejecuta ahora un borrado físico en cascada:

1. Verifica que el curso exista y no esté previamente soft-deleted (`deletedAt: null`). Si no existe → responde `404`.
2. Obtiene los `_id` de todas las `CourseAssigned` con `course = id`, sin importar su `status` ni `deletedAt`.
3. Si existe al menos una asignación, ejecuta `ClassSession.deleteMany({ courseAssigned: { $in: assignmentIds } })` — eliminación física de todas las sesiones de clase vinculadas.
4. Ejecuta `CourseAssigned.deleteMany({ course: id })` — eliminación física de todas las asignaciones del curso.
5. Ejecuta `Course.deleteOne({ _id: id })` — eliminación física del curso del catálogo.
6. Emite invalidación real-time:
   - `courses.changed`
   - `courseAssignments.changed`
   - `courseHistory.changed`

Esta secuencia se implementa en el controlador; la lógica de negocio puede extraerse a `course.service.ts` si el `backend-engineer` considera necesario mantener la capa de servicios coherente con `AGENTS.md` §3.

### D2 — Ámbito limitado de la excepción

La excepción al soft-delete aplica **única y exclusivamente** a la operación de eliminación de un `Course` del catálogo.

- `CourseAssigned` conserva su soft-delete (`softDeleteAssignment`) para la eliminación individual de una asignación.
- `ClassSession` conserva su comportamiento de ADR-0001 §AC7.6: el cierre/reapertura de una asignación no borra físicamente las sesiones.
- El campo `deletedAt` se conserva en el schema de `Course` por compatibilidad y para que lecturas filtradas (`deletedAt: null`) sigan siendo válidas; sin embargo, `remove` ya no lo setea.

### D3 — Fallback defensivo en `validateProfessorUniqueActive`

Además del borrado en cascada, se añade un fallback defensivo en `backend/src/services/course-assignment.service.ts`, función `validateProfessorUniqueActive`:

- Si la validación encuentra una `CourseAssigned` con `status: "active"` cuyo `Course` ya no existe en la base de datos (ya sea porque fue soft-deleted o porque fue eliminado físicamente), la asignación se elimina físicamente antes de continuar la validación.
- Este mecanismo actúa como purga automática de datos legacy y evita que el error 409 fantasma persista para registros huérfanos preexistentes.

### D4 — Requisito de transacción (recomendado)

Dado que la operación afecta múltiples colecciones (`CourseAssigned`, `ClassSession`, `Course`), se recomienda envolverla en `session.withTransaction` cuando el volumen de asignaciones/sesiones lo justifique. Hoy la implementación puede ejecutar las operaciones sin transacción explícita, pero el `database-engineer` debe evaluar si el escenario de producción requiere garantía atómica.

## Consecuencias

### Positivas

- Elimina el error `409` "Este profesor ya tiene un curso activo asignado" causado por asignaciones activas huérfanas.
- No quedan registros huérfanos de `CourseAssigned` ni `ClassSession` al eliminar un curso del catálogo.
- El catálogo de `Course` refleja fielmente los cursos que realmente existen; no hay cursos "ocultos" por soft-delete que sigan generando constraints.
- El fallback defensivo purga automáticamente datos legacy inconsistentes.

### Negativas / trade-offs

- La eliminación de un curso es **irreversible**. No existe "restore" posible para un `Course` eliminado.
- Se pierde todo el historial de asignaciones y sesiones de clase vinculadas a ese curso, incluida la asistencia registrada en `ClassSession`.
- Si en el futuro el negocio requiere conservar el historial de cursos descontinuados, esta decisión deberá revisarse o introducirse un mecanismo de archivado separado.
- La operación es destructiva: un error de UI o un usuario con permisos elevados puede borrar datos valiosos sin posibilidad de recuperación directa desde la aplicación.

### Deriva del ADR-0001 §D3

Este ADR **deroga parcialmente** `ADR-0001` §D3 en lo referente al borrado de `Course`:

- El soft-delete de `Course` queda sin efecto práctico para la operación `DELETE /api/courses/:id`.
- El campo `deletedAt` permanece en el schema por compatibilidad, pero `remove` ya no lo utiliza.
- El soft-delete de `CourseAssigned` y `ClassSession` se mantiene vigente para sus respectivas operaciones de eliminación individual.
- La excepción §E-4 del ADR-0001 (que bloqueaba el soft-delete de un `Course` con asignaciones activas) queda obsoleta en su intención original, ya que ahora el `Course` se elimina físicamente junto con sus asignaciones.

### Impacto en auditoría

El `ADR-0001` dejó como `[AUDIT-PENDING]` la acción `course.assignment.delete`. La eliminación física en cascada hace aún más necesario registrar la acción `course.delete` con contexto mínimo:

```ts
{
  courseId: ObjectId,
  deletedAssignmentIds: ObjectId[],
  deletedSessionCount: number
}
```

Hoy el módulo de auditoría transversal **no existe** en `backend/src/`, por lo que esta acción no se registra. Se mantiene el compromiso del ADR-0001: cuando el módulo de auditoría esté disponible, se añade el registro de `course.delete` en el mismo PR que introduce la auditoría.

## Alternativas consideradas

- **(a) Mantener soft-delete y auto-purgar asignaciones huérfanas únicamente en `validateProfessorUniqueActive`**, sin modificar `remove`.
  - **Rechazada**: el Sponsor pidió explícitamente que la eliminación del catálogo se refleje como eliminación real en la base de datos, no solo como limpieza defensiva.

- **(b) Soft-delete en cascada**: propagar `deletedAt` a `Course`, `CourseAssigned` y `ClassSession`, filtrando todas las lecturas.
  - **Rechazada**: añade complejidad transversal (todos los queries deben respetar el filtro en cascada) y conserva datos que, según el Sponsor, no aportan valor de negocio una vez descontinuado el curso.

- **(c) Borrado físico del `Course` pero conservar `CourseAssigned` y `ClassSession` con `course = null`** (desnormalización).
  - **Rechazada**: dejaría registros huérfanos sin referencia válida, lo cual es precisamente el problema que se busca resolver.

## Referencias

- `AGENTS.md` §5 (soft-delete preferido, salvo decisión de arquitectura).
- `AGENTS.md` §10 (coherencia entre ADRs y contratos).
- `docs/adr/0001-courses-history-refactor.md` §D3 (soft-delete original de `Course` y `CourseAssigned`).
- `docs/adr/0001-courses-history-refactor.md` §E-4 (bloqueo de soft-delete con asignaciones activas).
- `docs/adr/0001-courses-history-refactor.md` §ET-1 (auditoría `[AUDIT-PENDING]`).
- `backend/src/controller/course.controller.ts` (`CourseController.remove`).
- `backend/src/services/course-assignment.service.ts` (`validateProfessorUniqueActive`).
