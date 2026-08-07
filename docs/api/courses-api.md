# Contrato API del módulo de Cursos — `EPC-COURSES-001`

> **Estado**: Vigente (paso 3 del Plan de ejecución del ADR-0001).
> **Autoridad**: `api-contract-engineer` (única fuente de verdad sobre la forma de los payloads).
> **Fuentes**: `AGENTS.md` (§3, §4, §5, §8), `docs/adr/0001-courses-history-refactor.md`,
> `docs/adr/0006-course-growth-mapping.md`, `docs/backlog/courses-history-refactor.md`
> **Consumidores**: `database-engineer`, `backend-engineer`, `auth-security-engineer`,
> `frontend-engineer`, `testing-engineer`, `quality-engineer`.
> **Última revisión**: 2026-07-29

Este documento **es la única especificación normativa** de los endpoints del módulo de Cursos
tras el refactor. Cualquier divergencia entre este contrato y el código se considera drift y
debe resolverse ajustando el código (no este documento) o, si el cambio es intencional,
actualizando este documento previa aprobación del `chief-architect`.

No se incluye OpenAPI YAML formal por ahora (no existe convención previa en el repo). Este
`courses-api.md` es el primer artefacto de la familia `docs/api/`. Cuando existan al menos
tres módulos documentados, el `chief-architect` decidirá la convención final (multifile YAML
vs. markdown). Los tests de contrato del `testing-engineer` deben validates contra los
shapes definidos aquí.

---

## 0. Convenciones generales

- Prefijo común de todos los endpoints del módulo: `/api/courses`.
  Se montan tres routers Express con el **mismo prefijo** (ADR §D1):
  - `backend/src/routes/course.routes.ts` → catálogo (`/api/courses`, `/api/courses/:id`).
  - `backend/src/routes/course-assignment.routes.ts` → asignaciones, miembros, close, reopen,
    `my-courses`, `my-courses/history`.
  - `backend/src/routes/attendance.routes.ts` → `my-attendance` (se conserva el prefijo
    `/api/courses` para no romper contrato público, ADR §D1).
  > En `server.ts`/`index.ts` los tres routers se montan todos bajo `/api/courses`. Es
  > responsabilidad del `backend-engineer` garantizar que **no haya colisión de rutas**.
  > **Orden de montaje (ratificado por el `chief-architect` tras el paso 5)**: los routers
  > estáticos van primero (`course-assignment.routes` → `attendance.routes`) y el de
  > **catálogo al final**. Razón técnica: Express evalúa `app.use` en orden y, dentro de
  > cada router, las rutas en el orden declarado; si el catálogo (que declara `GET /:id`)
  > se montara primero, su `GET /:id`interceptaría cualquier subrecurso no declarado en
  > los routers anteriores — capturaría `/assignments`, `/my-courses`, `/my-attendance`
  > como `id`. Montando catálogo último, las rutas estáticas ya despachadas por los otros
  > routers nunca llegan al `GET /:id` del catálogo, y un id Mongo real cae correctamente
  > ahí. Dentro de cada router, las rutas estáticas se declaran antes que las paramétricas
  > (`/assignments/history` antes que `/assignments/:id`; `/my-courses` antes que
  > `/my-courses/history`).
- Autenticación: todos los endpoints exigen `authenticate` (JWT). Los roles se enumeran por
  endpoint usando las constantes de `backend/src/utils/auth.utils.ts`:
  - `ADMIN_ROLES = ["Admin", "Superadmin"]`
  - `SUPERADMIN_ROLES = ["Superadmin"]`
  - `TEACHING_ROLES = ["Profesor"]`
  - Cualquier rol adicional se declara inline con `authorizeRoles([...])`.
- Identificadores en path: siempre MongoId (`/api/courses/:id`, `:id` debe ser `isMongoId()`).
- Strings de error y de mensaje en **español** (AGENTS.md §1).
- Formato de fechas en respuestas: ISO 8601 con offset (`.toISOString()`). En schemas zod
  se validan como `z.string().datetime()`.
- Sin `any`. Sin exponer hashes, passwords ni stack traces (AGENTS.md §8).
- Soft-delete: todas las consultas filtran `deletedAt: null` salvo que se indique lo
  contrario. Las respuestas públicas NO exponen documentos con `deletedAt` seteado.
- Realtime: tras mutaciones exitosas se emite invalidación vía
  `emitRealtimeInvalidation` (helper existente). Las keys contratadas son:
  - `courses.changed` → `[[["courses"]]]`
  - `courseAssignments.changed` → `[[["courseAssignments"], ["myCourses"], ["myAttendance"]]]`
  - `courseAssignments.members.changed` → idem `courseAssignments.changed`
  - `courseAssignments.closed` → idem
  - `courseHistory.changed` → `[[["courseHistory"]]]` **(nueva key en este refactor)**
  - `attendance.changed` → `[[["myAttendance"], ["courseAssignments"]]]`
  El `realtime-notif-engineer` materializa la nueva key. El cliente React Query invalida
  esas query keys (AC7.5, AC8.3).

---

## 1. Catálogo — `Course`

> Recurso_mongo: `Course`. Recurso API (plural, AGENTS.md §4): `courses`.

### 1.1 `GET /api/courses` — Listado del catálogo

- **Roles**: cualquier rol autenticado.
- **Query params**:

| Nombre      | Tipo    | Requerido | Default | Notas                                                              |
| ----------- | ------- | --------- | ------- | ------------------------------------------------------------------ |
| `name`      | string  | opcional  | —       | Búsqueda parcial case-insensitive sobre `Course.name`.              |
| `level`     | enum    | opcional  | —       | `basic` \| `intermediate` \| `advanced`.                           |
| `isActive`  | boolean | opcional  | —       | Filtra por el flag de catálogo (no confundir con `status`).        |
| `page`      | int ≥1  | opcional  | `1`     | Paginación. (Sin paginación hoy → el backend-engineer la añade.) |
| `limit`     | int 1-100 | opcional | `20`   | Tope máximo 100. Si llega >100, se trunca a 100.                   |

- **Filtro implícito**: `{ deletedAt: null }`.
- **Orden**: por `name` asc (consistente con comportamiento actual).
- **Respuesta 200** — `PaginatedResponse<Course>`:

```jsonc
{
  "items": [
    {
      "_id": "64ab...",
      "name": "Fundamentos de la Fe",
      "description": "Curso introductorio...",
      "level": "basic",
      "spiritualGrowthStage": "Consolidación",
      "isActive": true,
      "createdAt": "2026-01-04T10:00:00.000Z",
      "updatedAt": "2026-01-04T10:00:00.000Z"
    }
  ],
  "total": 17,
  "page": 1,
  "limit": 20
}
```
> **Decisión de contrato**: hoy el endpoint devuelve un array plano `Course[]` sin
> paginación. Para respetar AC4.8 (paginación de catálogo) el backend-engineer lo migra a
> `PaginatedResponse<Course>`. **El frontend-engineer debe actualizar `getAllCourses` a la
> nueva envoltura**; el contrato objetivo es la forma paginada.

- **Errores**:
  - `400 { message: "Parámetros de consulta inválidos" }`
  - `500 { message: "Error al obtener cursos" }`

### 1.2 `GET /api/courses/:id` — Detalle

- **Roles**: cualquier rol autenticado.
- **Path**: `id` MongoId.
- **Filtro implícito**: `{ _id: id, deletedAt: null }`.
- **200** — `Course` (mismo shape que un item de `1.1`, sin envoltura).
- **Errores**:
  - `400 { message: "ID de curso inválido" }`
  - `404 { message: "Curso no encontrado" }` (incluye el caso soft-deleted).
  - `500 { message: "Error al obtener curso" }`

### 1.3 `POST /api/courses` — Crear curso

- **Roles**: `ADMIN_ROLES`.
- **Body** (`CourseCreateBody`):

```jsonc
{
  "name": "Fundamentos de la Fe",        // string, no vacío, trim
  "description": "...",                  // string, no vacío, trim
  "level": "basic",                      // enum: basic|intermediate|advanced
  "spiritualGrowthStage": "Consolidación", // enum: SPIRITUAL_GROWTH_STAGES (ver ADR-0006 §D1)
  "isActive": true                       // boolean, opcional, default true
}
```

- **201** — `MessageResponse`:

```jsonc
{ "message": "Curso creado exitosamente" }
```
> El contrato actual devuelve el body como **string literal** ("Curso creado exitosamente"),
> no como JSON. **Decisión del contrato**: se unifica a `MessageResponse` JSON para todos
> los endpoints mutadores. El `frontend-engineer` actualiza `createCourse` a `safeParse`
> sobre `messageResponseSchema` (que ya hace hoy) — el backend responde con JSON.

- **Errores**:
  - `400` con `errors[]` de express-validator (mensaje en español por cada campo).
  - `403 { message: "No tienes permisos para realizar esta acción" }`
  - `500 { message: "Error al crear curso" }`

### 1.4 `PUT /api/courses/:id` — Editar curso

- **Roles**: `ADMIN_ROLES`.
- **Path**: `id` MongoId.
- **Body** (`CourseUpdateBody`):

```jsonc
{
  "name": "Fundamentos de la Fe",
  "description": "...",
  "isActive": true,            // boolean requerido (validador actual lo exige)
  "level": "basic",             // enum, opcional en realidad; el backend-engineer decide si permite cambiarlo (lo deja opcional)
  "spiritualGrowthStage": "Consolidación"  // enum, opcional en realidad (ADR-0006 §D2)
}
```
> Se conservan las validaciones actuales: `name`, `description`, `isActive` requeridos;
> `level` se acepta opcional (el backend-engineer lo añade si hoy no lo valida).

- **200** — `Course` actualizado.
- **Errores**:
  - `400` validación / `404 { message: "Curso no encontrado" }` / `403` / `500`.

### 1.5 `DELETE /api/courses/:id` — Soft-delete

- **Roles**: `ADMIN_ROLES`.
- **Comportamiento**: `findByIdAndUpdate(id, { deletedAt: new Date() })`. No borra físicamente.
  **Validación previa (E-4)**: si existe al menos una `CourseAssigned` con
  `course = id`, `status: "active"`, `deletedAt: null` → `409 { message: "No puedes
  eliminar un curso con asignaciones activas" }`. Solo procede el soft-delete si no hay
  asignaciones activas vinculadas. Las asignaciones `completed` no bloquean el borrado
  (el `Course` queda soft-deleted y referencia histórica populada).
- **200** — `MessageResponse`: `{ "message": "Curso eliminado exitosamente" }`.
- **Errores**: `404 { message: "Curso no encontrado" }` / `409 { message: "No puedes eliminar un curso con asignaciones activas" }` / `403` / `500`.
- **Realtime**: `courses.changed`.

---

## 2. Asignaciones — `CourseAssigned`

> Recurso_mongo: `CourseAssigned`. Recurso API (plural, AGENTS.md §4): `courses/assignments`.
> El prefijo `courses/` se conserva por ADR §D1 (no romper contrato público).

### Shape de base — `CourseAssigned` (respuesta)

Todos los endpoints de asignación devuelven este shape (con populate completo de `course`,
`professor`, `members`):

```jsonc
{
  "_id": "65a1...",
  "course": { /* Course completa (con _id, name, description, level, isActive) */ },
  "professor": { /* courseParticipantSchema (perfil acotado) */ },
  "members": [ /* courseParticipantSchema[] */ ],
  "startDate": "2026-02-01T00:00:00.000Z",
  "startTime": "18:00",
  "totalClasses": 8,
  "endDate": "2026-03-22T00:00:00.000Z",   // fecha calendario calculada
  "endedAt": null,                          // NUEVO: instante real de cierre
  "location": "Sede Central - Salon 1",
  "status": "active",                       // enum: "active" | "completed"
  "deletedAt": null,                         // NUEVO: soft-delete
  "createdAt": "...",
  "updatedAt": "..."
}
```

El schema zod formal está en §5.2 (`courseAssignedSchema` ampliado).

### 2.1 `GET /api/courses/assignments` — Asignaciones vigentes

- **Roles**: cualquier rol autenticado (la UI filtra por rol; el backend devuelve todas las
  `active` no soft-deleted).
- **Query params**:

| Nombre   | Tipo                   | Requerido | Default    | Notas                                              |
| -------- | ---------------------- | --------- | ---------- | ------------------------------------------------- |
| `status` | enum `active`\|`completed` | opcional | `active`  | Alias REST de `/history` (ADR §D4). Por defecto,SOLO `active`. |
| `page`   | int ≥1                 | opcional  | `1`        |                                                     |
| `limit`  | int 1-100              | opcional  | `20`       |                                                     |

- **Filtro implícito**: `{ deletedAt: null }`. Si `status` ausente → `status: "active"`.
  Si `status=completed` → equivale a `/history` SIN filtros adicionales de `professor`/
  `location` (estos solo aplican en `/history`, ver §2.2).
- **Respuesta 200** — `PaginatedResponse<CourseAssigned>`.

> **Decisión de contrato**: hoy el endpoint devuelve array plano. Se migra a envoltura
> paginada para soportar AC4.8 y AC8.1. El frontend prefiere `/history` para el historial;
  este endpoint con `?status=completed` se mantiene solo por flexibilidad REST (ADR §D4).

- **Errores**: `400`, `500 { message: "Error al obtener asignaciones" }`.

### 2.2 `GET /api/courses/assignments/history` — Historial

- **Roles**: cualquier rol autenticado (la UI decide qué columnas/botones mostrar).
- **Query params**:

| Nombre      | Tipo      | Requerido | Default | Notas                                            |
| ----------- | --------- | --------- | ------- | ------------------------------------------------ |
| `professor` | MongoId   | opcional  | —       | Filtra por `professor` (id del `UserProfile`).   |
| `location`  | string    | opcional  | —       | Filtro exacto case-insensitive sobre `location`. |
| `page`      | int ≥1    | opcional  | `1`     |                                                  |
| `limit`     | int 1-100 | opcional  | `20`    | Tope máximo 100. >100 se trunca a 100.           |

- **Filtro implícito**: `{ status: "completed", deletedAt: null }`.
- **Orden**: `endDate` desc (índice `{ status: 1, endDate: -1 }`, AC9.2).
- **Respuesta 200** — `PaginatedResponse<CourseAssigned>` (aún SIN `sessions` consolidadas;
  las sesiones se obtienen en el detalle §2.4 ó en `/my-courses/history` para el profesor).
- **Errores**: `400`, `500`.

### 2.3 `POST /api/courses/assignments` — Crear asignación

- **Roles**: `ADMIN_ROLES`.
- **Body** (`CourseAssignmentCreateBody`):

```jsonc
{
  "course": "64ab...",          // MongoId, debe existir y NO estar soft-deleted
  "professor": "65a1...",        // MongoId, perfil con rol "Profesor" asociado
  "startDate": "2026-02-01",     // ISO date (YYYY-MM-DD aceptado; backend lo normaliza)
  "startTime": "18:00",          // string no vacío (formato libre, hoy "HH:mm")
  "totalClasses": 8,             // int ≥1
  "location": "Sede Central",    // string no vacío
  "status": "active"             // opcional, default "active". enum: active|completed (NUNCA cancelled)
}
```

- **Validaciones de negocio** (anticipan el índice unique parcial):
  - El `professor` debe tener rol "Profesor"; si no → `400 { message: "El miembro seleccionado no tiene rol de profesor" }`.
  - El `professor` no debe tener otra `status: "active"`, `deletedAt: null` → `409 { message: "Este profesor ya tiene un curso activo asignado" }`.
- **201** — `{ message: "Curso asignado correctamente", assignment: CourseAssigned }`.
- **Errores**:
  - `400` validación / `404 { message: "Curso no encontrado" }` / `404 { message: "Profesor no encontrado" }` / `409` / `500 { message: "Error al asignar curso" }`.
- **Realtime**: `courseAssignments.changed`.

### 2.4 `GET /api/courses/assignments/:id` — Detalle (con sesiones consolidadas)

- **Roles**: cualquier rol autenticado.
- **Path**: `id` MongoId.
- **Filtro implícito**: `deletedAt: null`. (Devuelve 404 si está soft-deleted.)
- **Respuesta 200** — `CourseAssignedHistoryItem` (ver §5.3):

```jsonc
{
  /* ...todos los campos de CourseAssigned... */
  "sessions": [
    {
      "classNumber": 1,
      "date": "2026-02-01T00:00:00.000Z",
      "completedAt": "2026-02-01T22:30:00.000Z",   // = ClassSession.updatedAt de la sesión guardada; null si la sesión aún no se tomó
      "topic": "Introducción",
      "observations": "...",
      "attendance": [
        { "member": { /* courseParticipantSchema */ }, "present": true },
        { "member": { /* ... */ }, "present": false }
      ]
    }
    /* ...una entrada por cada classNumber en 1..totalClasses (las soft-deleted
        en reopen se OMITEN de esta lista — solo se conservan en BD, no en la vista) */
  ]
}
```
> `completedAt` refleja el instante en que el profesor guardó la asistencia. Para sesiones
> aún no tomadas, `completedAt` es `null` y `attendance: []`.
> Las `ClassSession` marcadas `deletedAt` (caso reopen con `totalClasses` reducido) **no**
> aparecen aquí (la vista no las muestra), pero se conservan en BD (AC7.6).

- **Errores**: `400`, `404 { message: "Asignación no encontrada" }`, `500`.
- Nota de denominación: acentos en mensajes ("Asignación", "Creación") son aceptables en
  español; el código base actual los usa sin tilde por costumbre. El `backend-engineer`
  decide maintain sin tilde para messages ya existentes — solo los **nuevos** mensajes
> (reopen) deben usar tilde correcta. Coherencia interna por módulo.

### 2.5 `PUT /api/courses/assignments/:id` — Editar asignación

- **Roles**: `SUPERADMIN_ROLES`.
- **Body** (`CourseAssignmentUpdateBody`): mismo shape que `2.3`, todos los campos son
  requeridos salvo `status` (default = status actual). El `status` admitido es
  `active` | `completed` (NUNCA `cancelled`).
- **Validaciones de negocio**: mismas que en `2.3` + el profesor único activo se valida
  excluyendo `_id: id`.
- **200** — `{ message: "Asignación actualizada correctamente", assignment: CourseAssigned }`.
- **Errores**: `400` / `404` (asignación o curso no encontrado) / `409` / `403` / `500`.
- **Realtime**: `courseAssignments.changed`.

### 2.6 `DELETE /api/courses/assignments/:id` — Soft-delete

- **Roles**: `SUPERADMIN_ROLES`.
- **Comportamiento (ADR §D3, AC3.4, AC3.5)**:
  - `findByIdAndUpdate(id, { deletedAt: new Date() })`. **NO** `findByIdAndDelete`.
  - **NO** ejecuta `ClassSession.deleteMany`. Las sesiones quedan vinculadas a la
    asignación soft-deleted para conservar el historial de asistencia.
  - El índice unique parcial por `professor` activo ignora esta asignación a partir de ahora
    (porque su `deletedAt` deja de ser `null` → fuera del `partialFilterExpression`).
- **200** — `{ message: "Asignación eliminada correctamente" }`.
- **Errores**: `404 { message: "Asignación no encontrada" }` / `403` / `500`.
- **Realtime**: `courseAssignments.changed`.
- **Auditoría**: acción `course.assignment.delete`, contexto `{ assignmentId }`.

### 2.7 `POST /api/courses/assignments/:id/members` — Registrar miembros

- **Roles**: `["Profesor", "Admin", "Superadmin"]`.
  - El `Profesor` solo puede mutar la asignación donde él es `professor` (verificación de
    Dueño en service; `403 { message: "No tienes permisos para actualizar esta asignación" }` si no lo es).
  - `Admin` y `Superadmin` pueden mutar cualquier asignación `active`.
- **Path**: `id` MongoId.
- **Body**:

```jsonc
{ "memberIds": ["65a1...", "65a2..."] }   // Array<MongoId>. Solo perfiles con rol "Asistente"|"Miembro".
```

- **Validaciones**:
  - La asignación debe tener `status: "active"` y `deletedAt: null` → `400 { message: "Solo puedes registrar miembros en cursos activos" }`.
  - Todos los `memberIds` deben existir y tener `role.name ∈ {"Asistente", "Miembro"}` → `400 { message: "Solo puedes registrar perfiles con rol Asistente o Miembro" }`.
  - Elegibilidad por etapa de crecimiento espiritual (ADR-0006 §D3): la etapa del curso (`course.spiritualGrowthStage`) debe ser la **siguiente etapa** inmediata respecto a la etapa actual del miembro. Si el miembro no tiene etapa definida, su siguiente etapa es `"Consolidación"`. Si el miembro ya alcanzó o superó la etapa del curso, no es elegible.
  - Si algún `memberId` no es elegible → `409 { message: "El miembro <nombre> no está en la etapa requerida para este curso" }` (o `400` si se prefiere agrupar; el backend normaliza a `409` por conflicto de regla de negocio).
- **200** — `{ message: "Miembros registrados correctamente en el curso", assignment: CourseAssigned }`.
- **Errores**: `400` / `403` / `404 { message: "Asignación no encontrada" }` / `500`.
- **Realtime**: `courseAssignments.members.changed`.

> **Decisión de contrato (importante — drift a corregir)**: el endpoint actual usa
> **PATCH** `/api/courses/assignments/:id/members`. El ADR-0001 y AGENTS.md §4 usan verbos
> REST; `POST` sobre subrecurso collection-item es el patrón semántico correcto para
> "establecer los miembros" (no es una operación parcial de campos de CourseAssigned).
> El contrato objetivo es **POST`. El `backend-engineer` debe cambiar el verbo y el
> `frontend-engineer` debe cambiar `updateCourseMembers` de `api.patch` a `api.post`. Se
> deja transitoriamente ambos verbos habilitados (PATCH + POST) durante una iteración para
> no romper clientes en caches; al cierre de la épica, PATCH se elimina.

### 2.8 `POST /api/courses/assignments/:id/close` — Cerrar curso

- **Roles**: profesor dueño (verificación de dueño en service), `Admin`, `Superadmin`
  → `authorizeRoles([...TEACHING_ROLES, "Admin", "Superadmin"])` + verificación de dueño.
- **Path**: `id` MongoId.
- **Body**: vacío (no requiere).
- **Validaciones de negocio**:
  - La asignación debe existir y `deletedAt: null` → `404`.
  - `status === "active"` → sino `400 { message: "Este curso ya no está activo" }`.
  - Deben existir `ClassSession.countDocuments({ courseAssigned: id }) >= totalClasses` →
    `400 { message: "Debes registrar todas las clases antes de cerrar el curso" }`.
- **Comportamiento**:
  - `status = "completed"`; `endedAt = new Date()` (NUEVO, ADR §D6).
  - Para cada miembro inscrito se calcula el porcentaje de asistencia: `attendanceRate = totalClasses ? Math.round((presentCount / totalClasses) * 100) : 0`. Las clases no registradas cuentan como falta. Si `attendanceRate >= 70%`, el `spiritualGrowthStage` del miembro se actualiza a la etapa del curso (`course.spiritualGrowthStage`) (ADR-0006 §D4, §D5). Miembros con asistencia inferior a 70% mantienen su etapa actual y pueden volver a inscribirse en el mismo curso en una asignación futura.
  - Se ejecuta con `session.withTransaction` (AC7.3 no obliga para cierre, pero se
    recomienda por consistencia con auditoría y avance de etapas).
- **200** — `{ message: "Curso cerrado correctamente" }`.
- **Errores**: `400` / `403 { message: "No tienes permisos para cerrar este curso" }` / `404` / `500`.
- **Realtime**: `courseAssignments.closed` y `courseHistory.changed`.
- **Auditoría**: acción `course.assignment.close`, contexto `{ assignmentId, professorId }`.

> **Decisión de contrato (drift a corregir)**: el endpoint actual vive en
> `PATCH /api/courses/my-courses/:id/close`. El contrato objetivo lo mueve a
> `POST /api/courses/assignments/:id/close` porque:
> 1. Pertenece al subrecurso `assignments/:id` (dueño: `course-assignment.controller`,
>    ADR §D1), no a `my-courses`.
> 2. Los roles autorizados incluyen a `Admin`/`Superadmin` que no son "mi profesor"
>    — la ruta `/my-courses/...` es engañosa.
> 3. POST es semánticamente correcto para "realizar la acción de cerrar".
> El `backend-engineer` elimina `PATCH /my-courses/:id/close` y crea
> `POST /assignments/:id/close`.

### 2.9 `POST /api/courses/assignments/:id/reopen` — Reabrir curso completado (NUEVO)

- **Roles**: `SUPERADMIN_ROLES`.
- **Path**: `id` MongoId.
- **Body** (`ReopenAssignmentBody`):

```jsonc
{ "totalClasses": 6 }   // opcional, int ≥1. Si no viene, se conserva el actual.
```

- **Validaciones de negocio** (ADR §D5, AC7.1–AC7.4):
  - La asignación debe existir, `status === "completed"` y `deletedAt: null` → si no,
    `404 { message: "Asignación no encontrada" }` o
    `409 { message: "Solo se puede reabrir una asignación completada" }`.
  - El `professor` NO debe tener otra `CourseAssigned` con `status: "active"`,
    `deletedAt: null` → `409 { message: "El profesor ya tiene otro curso activo asignado" }`.
  - Si `totalClasses` viene, debe ser `int ≥1`.
- **Comportamiento (transacción Mongo)**:
  - `status = "active"`; `endedAt = null`.
  - Si `totalClasses` cambia: recalcular `endDate = startDate + (totalClasses-1)*7 días`.
  - Si `totalClasses` nuevo < anterior: marcar `deletedAt` (soft-delete) en las
    `ClassSession` con `classNumber > totalClasses` (AC7.6). Si es > anterior: las
    sesiones faltantes se generan _on-demand_ por el overview (no se persisten vacías).
  - Emitir realtime `courseHistory.changed` y `courseAssignments.changed`.
  - Registrar auditoría: acción `course.reopen`, contexto
    `{ assignmentId, oldStatus: "completed", newStatus: "active", totalClasses }`.
- **200** — `{ message: "Curso reabierto correctamente", assignment: CourseAssigned }`.
- **Errores**:
  - `400 { message: "El total de clases debe ser un entero mayor a 0" }`
  - `403 { message: "No tienes permisos para realizar esta acción" }`
  - `404 { message: "Asignación no encontrada" }`
  - `409 { message: "Solo se puede reabrir una asignación completada" }`
  - `409 { message: "El profesor ya tiene otro curso activo asignado" }`
  - `500 { message: "Error al reabrir el curso" }`.

> El botón UI "Reabrir" (solo en Historial del `Superadmin`) confirma con SweetAlert.

---

## 3. Endpoints "my-courses" (datos del usuario autenticado)

### 3.1 `GET /api/courses/my-courses` — Mis asignaciones activas

- **Roles**: cualquier rol autenticado. El backend deriva la query según el rol:
  - Si `req.auth.roles.includes("Profesor")` → `professor: profileId`.
  - Si no (Asistente / Miembro) → `members: profileId`.
- **Filtro implícito**: `{ status: "active", deletedAt: null }`.
- **Respuesta 200** — `CourseAssigned[]` (array plano, sin paginación: un profesor puede
  tener a lo sumo una asignación activa por el índice unique; un miembro, baja cardinalidad).
  - Para mantener compatibilidad transitoria, este endpoint sigue devolviendo **array
    plano** (no `PaginatedResponse`). Es la excepción documentada y justificada.
- **Errores**: `500 { message: "Error al obtener tus cursos" }`.

> **Decisión de contrato**: el contrato **actual** (`/courses/my-courses`) devuelve TODAS las
> asignaciones (activas y completadas) mezcladas. El contrato **objetivo** restringe a
> `status: "active"`. El historial se mueve a §3.2. **El frontend-engineer debe dejar de
> filtrar `completed` manualmente en cliente** — el backend deja de enviarlos (cumple
> AGENTS.md §3 y AC8.4).

### 3.2 `GET /api/courses/my-courses/history` — Mi historial

- **Roles**: cualquier rol autenticado. La query se deriva igual que §3.1:
  - Profesor → `professor: profileId`.
  - Miembro / Asistente → `members: profileId` (sus "trofeos", AC6.3).
- **Filtro implícito**: `{ status: "completed", deletedAt: null }`.
- **Orden**: `endDate: -1`.
- **Respuesta 200** — `CourseAssigned[]` (array plano, sin paginación por ahora; si crece
  se introduce `PaginatedResponse` en iteración futura acordada con el arquitecto).
- **Errores**: `500 { message: "Error al obtener tu historial de cursos" }`.

### 3.3 `GET /api/courses/my-courses/student/missing` — Cursos faltantes (opcional; AC6.4)

> **Nota de contrato**: AC6.4 pide una vista "Cursos faltantes" para el Miembro/Asistente
> (cursos del catálogo que el miembro no tiene en ninguna asignación activa o completada).
> Esta vista puede calcularla el **cliente** a partir de `GET /api/courses` + §3.1 + §3.2
> (resta de catálogos). **Para esta épica NO se crea endpoint backend dedicado**: no hay
> una regla de negocio que justifique persistir/negociar nuevos estados.
> El `frontend-engineer` implementa la resta en el cliente usando los endpoints ya
> contratados. Si en el futuro se necesita historia por sede/periodo, se discute un
> nuevo endpoint con ADR. **No hay payload de contrato nuevo aquí.**

---

## 4. Asistencia — `attendance.routes.ts` (se conserva)

> Prefijo común: `/api/courses` (ADR §D1). Solo se **mueve de controlador**, no se
> rediseña el flujo. Documento el contrato actual.

### 4.1 `GET /api/courses/my-attendance` — Overview de mi curso activo

- **Roles**: `TEACHING_ROLES`.
- **Comportamiento**: devuelve la `CourseAssigned` activa del profesor autenticado, junto
  con el array generado de sesiones (1..`totalClasses`). Las sesiones NO guardadas se
  devuelven con `_id: null`, `topic: ""`, `observations: ""`, `attendance: []` y `date`
  calculada como `startDate + (classNumber-1)*7 días`. Las guardadas se devuelven con su
  `_id`, datos persistidos y `attendance` populada.
- **Respuesta 200** — `AttendanceOverview`:

```jsonc
{
  "assignment": { /* CourseAssigned, null si no tiene activa */ } | null,
  "sessions": [
    {
      "_id": "65b2..." | null,
      "classNumber": 1,
      "date": "2026-02-01T00:00:00.000Z",
      "topic": "Introducción",
      "observations": "...",
      "attendance": [
        { "student": { /* courseParticipantSchema */ }, "present": true, "notes": "..." }
      ]
    }
  ]
}
```

- **Errores**: `500 { message: "Error al obtener la asistencia del curso activo" }`.
- Schema zod: `attendanceOverviewSchema` (existente).

### 4.2 `PUT /api/courses/my-attendance/classes/:classNumber` — Guardar asistencia

- **Roles**: `TEACHING_ROLES` (el profesor dueño implícito por `findMyActiveAssignment`).
- **Path**: `classNumber` int ≥1, ≤ `totalClasses` de la asignación activa del profesor.
- **Body** (`SaveAttendanceBody`):

```jsonc
{
  "attendance": [
    { "studentId": "65a1...", "present": true, "notes": "llegó puntual" }
  ],
  "topic": "Introducción",          // opcional, string trim
  "observations": "..."             // opcional, string trim
}
```

- **Validaciones**:
  - El profesor autenticado debe tener una `CourseAssigned` activa; si no →
    `404 { message: "No tienes un curso activo asignado" }`.
  - `classNumber` int ≥1, ≤ `totalClasses` → `400 { message: "El número de clase no es válido" }`
    o `400 { message: "La clase seleccionada no existe en este curso" }`.
  - `attendance[]` debe contener exactamente los `members` de la asignación, sin repetidos:
    - Repetidos → `400 { message: "No puedes repetir estudiantes en la asistencia" }`.
    - Estudiantes no miembros → `400 { message: "Solo puedes registrar asistencia de miembros de tu curso" }`.
    - Cantidad != members → `400 { message: "Debes registrar la asistencia de todos los miembros inscritos en la clase" }`.
- **Comportamiento**: `ClassSession.findOneAndUpdate({ courseAssigned, classNumber }, {...}, { upsert: true, new: true })`.
- **200** — `{ message: "Asistencia guardada correctamente", session: ClassSession }`.
- **Errores**: `400` / `401 { message: "No autorizado" }` / `404` / `500 { message: "Error al guardar la asistencia" }`.
- **Realtime**: `attendance.changed`.

> **Decisión de denominación**: el verbo `PUT` con upsert se mantiene (es el patrón
> idempotente correcto para "guardar la asistencia de la clase N"). No hay drift aquí.

---

## 5. Schemas zod (contrato formal)

> Definidos contractualmente aquí. El `frontend-engineer` los materializa en
> `frontend/src/types/index.ts` siguiendo este contrato (sin desviarse). Los schemas
> nuevos se añaden sin romper los existentes (ver §7 sobre desactivación de `cancelled`).

### 5.1 `courseSchema` (catálogo; alias de `createCourseSchema` existente)

```ts
export const courseLevelSchema = z.enum(["basic", "intermediate", "advanced"]);

export const courseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  level: courseLevelSchema,
  spiritualGrowthStage: z.enum(["Consolidación", "Discipulado básico", "Carácter cristiano", "Sanidad y propósito", "Cosmovisión bíblica", "Finanzas y Gobierno", "Doctrina cristiana"]),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Course = z.infer<typeof courseSchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  });

export const paginatedCoursesSchema = paginatedResponseSchema(courseSchema);
export type PaginatedCourses = z.infer<typeof paginatedCoursesSchema>;
```

### 5.2 `courseAssignedStatusSchema` + `courseAssignedSchema` ampliado

```ts
export const courseAssignedStatusSchema = z.enum(["active", "completed"]);
export type CourseAssignedStatus = z.infer<typeof courseAssignedStatusSchema>;

export const courseAssignedSchema = z.object({
  _id: z.string(),
  course: courseSchema,
  professor: courseParticipantSchema,
  members: z.array(courseParticipantSchema).default([]),
  startDate: z.string().datetime(),
  startTime: z.string(),
  totalClasses: z.number().int().nonnegative(),
  endDate: z.string().datetime(),
  endedAt: z.string().datetime().nullable().default(null),     // NUEVO (ADR §D6)
  location: z.string(),
  status: courseAssignedStatusSchema,
  deletedAt: z.string().datetime().nullable().default(null),   // NUEVO (ADR §D3)
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type CourseAssigned = z.infer<typeof courseAssignedSchema>;

export const courseAssignedArraySchema = z.array(courseAssignedSchema);
export const paginatedCourseAssignedSchema =
  paginatedResponseSchema(courseAssignedSchema);
export type PaginatedCourseAssignments = z.infer<typeof paginatedCourseAssignedSchema>;
```

### 5.3 `courseAssignedHistoryItemSchema` (detalle con sesiones consolidadas)

```ts
export const courseAssignedHistoryAttendanceSchema = z.object({
  member: courseParticipantSchema,
  present: z.boolean(),
  notes: z.string().default(""),
});

export const courseAssignedHistorySessionSchema = z.object({
  classNumber: z.number().int().positive(),
  date: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),   // = ClassSession.updatedAt; null si no se tomó
  topic: z.string().default(""),
  observations: z.string().default(""),
  attendance: z.array(courseAssignedHistoryAttendanceSchema).default([]),
});

export const courseAssignedHistoryItemSchema = courseAssignedSchema.extend({
  sessions: z.array(courseAssignedHistorySessionSchema),
});
export type CourseAssignedHistoryItem = z.infer<typeof courseAssignedHistoryItemSchema>;
```

### 5.4 Query schemas

```ts
export const courseAssignmentHistoryQuerySchema = z.object({
  professor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),   // MongoId
  location: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CourseAssignmentHistoryQuery = z.infer<typeof courseAssignmentHistoryQuerySchema>;

export const courseListQuerySchema = z.object({
  name: z.string().optional(),
  level: courseLevelSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const courseAssignmentListQuerySchema = z.object({
  status: z.enum(["active", "completed"]).optional().default("active"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

### 5.5 Body schemas

```ts
export const courseAssignmentCreateBodySchema = z.object({
  course: z.string().regex(/^[0-9a-fA-F]{24}$/),
  professor: z.string().regex(/^[0-9a-fA-F]{24}$/),
  startDate: z.string(),          // backend valida ISO date; el frontend envía YYYY-MM-DD
  startTime: z.string().min(1),
  totalClasses: z.number().int().min(1),
  location: z.string().min(1),
  status: courseAssignedStatusSchema.optional().default("active"),
});
export type CourseAssignedFormData = z.infer<typeof courseAssignmentCreateBodySchema>;

export const courseAssignmentUpdateBodySchema = courseAssignmentCreateBodySchema.partial();
export type CourseAssignmentUpdateBody = z.infer<typeof courseAssignmentUpdateBodySchema>;

export const reopenAssignmentBodySchema = z.object({
  totalClasses: z.number().int().min(1).optional(),
});
export type ReopenAssignmentBody = z.infer<typeof reopenAssignmentBodySchema>;

export const saveAttendanceBodySchema = z.object({
  attendance: z.array(z.object({
    studentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    present: z.boolean(),
    notes: z.string().optional(),
  })),
  topic: z.string().optional(),
  observations: z.string().optional(),
});

export const assignmentMembersBodySchema = z.object({
  memberIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)),
});
```

### 5.6 Auxiliares

```ts
export const messageResponseSchema = z.object({ message: z.string() });
export const assignmentMutationResponseSchema = z.object({
  message: z.string(),
  assignment: courseAssignedSchema,
});
export const attendanceOverviewSchema = z.object({
  assignment: courseAssignedSchema.nullable(),
  sessions: z.array(classSessionSchema),
});
```

---

## 6. Cliente API esperado — `frontend/src/api/CourseAPI.ts`

El `frontend-engineer` debe exponer estas funciones semánticas (AC8.7, ADR §D9). La
columna "Estado" indica el destino de las funciones legacy.

| Función (nueva)                             | Método + Ruta                                                       | Return schema                                | Estado / alias legacy |
| ------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- | --------------------- |
| `getActiveCourseAssignments()`              | `GET /api/courses/assignments?status=active` (o sin param)          | `PaginatedCourseAssignments`                 | Reemplaza `getCourseAssignments` (legacy `@deprecated` alias) |
| `getCourseAssignmentHistory(query)`        | `GET /api/courses/assignments/history?professor=&location=&page=&limit=` | `PaginatedCourseAssignments`           | Nuevo |
| `getCourseAssignmentById(id)`              | `GET /api/courses/assignments/:id`                                  | `CourseAssignedHistoryItem`                  | Nuevo |
| `getMyActiveCourseAssignments()`            | `GET /api/courses/my-courses`                                       | `CourseAssigned[]`                           | Reemplaza `getMyCourseAssignments` para activos |
| `getMyCourseAssignmentHistory()`            | `GET /api/courses/my-courses/history`                               | `CourseAssigned[]`                           | Nuevo |
| `getMyAttendanceOverview()`                | `GET /api/courses/my-attendance`                                   | `AttendanceOverview`                         | Conserva |
| `saveMyClassAttendance(classNumber, body)`  | `PUT /api/courses/my-attendance/classes/:classNumber`              | `{ message, session }`                       | Conserva (rename from `saveMyClassAttendance`) |
| `createCourse(body)`                        | `POST /api/courses`                                                 | `MessageResponse`                            | Conserva |
| `updateCourse(id, body)`                    | `PUT /api/courses/:id`                                              | `Course`                                     | Conserva |
| `softDeleteCourse(id)`                      | `DELETE /api/courses/:id`                                           | `MessageResponse`                            | **Renombra `deleteCourse`** (matiene alias `deleteCourse` `@deprecated`) |
| `getAllCourses(query)`                      | `GET /api/courses?name=&level=&isActive=&page=&limit=`              | `PaginatedCourses`                           | Conserva el nombre `getAllCourses` (la envoltura paginada es nueva) |
| `assignCourse(body)`                        | `POST /api/courses/assignments`                                     | `AssignmentMutationResponse`                | Conserva |
| `updateCourseAssignment(id, body)`           | `PUT /api/courses/assignments/:id`                                  | `AssignmentMutationResponse`                | Conserva |
| `softDeleteCourseAssignment(id)`             | `DELETE /api/courses/assignments/:id`                               | `MessageResponse`                            | **Renombra `deleteCourseAssignment`** (alias `@deprecated`) |
| `updateCourseMembers(id, memberIds)`         | `POST /api/courses/assignments/:id/members`                         | `AssignmentMutationResponse`                 | Cambia verbo `patch`→`post`. Conserva nombre |
| `closeCourseAssignment(id)`                  | `POST /api/courses/assignments/:id/close`                           | `MessageResponse`                            | **Renombra `closeMyCourseAssignment`; ruta cambia de `/my-courses/:id/close`** |
| `reopenCourseAssignment(id, body?)`          | `POST /api/courses/assignments/:id/reopen`                          | `AssignmentMutationResponse`                | **NUEVO** |

> Aliases `@deprecated` se conservan durante una iteración para no romper usos
> transitorios; el `quality-engineer` los elimina al final de la épica (ADR §D9).
> Las vistas nuevas (HU-04, HU-05, HU-06) solo usan las funciones nuevas.

---

## 7. Decisiones de naming y denominación

### Confirmaciones al ADR-0001 §D1

- ✅ Tres routers, mismo prefijo `/api/courses`,
  archivos `course.routes.ts` / `course-assignment.routes.ts` / `attendance.routes.ts`.
- ✅ Recurso API plural `courses` y subrecurso `courses/assignments` (cumple AGENTS.md §4).
- ✅ `my-courses` y `my-courses/history` bajo el mismo prefijo `courses` (no `course`).
- ✅ `my-attendance` bajo `/api/courses` (se conserva el prefijo, ADR §D1).

### Cambios de nombre respecto al contrato actual (drift nominativo)

| Ruta actual                                            | Ruta objetivo                                           | Verbo actual → objetivo | Razón |
| ------------------------------------------------------ | ------------------------------------------------------ | -------------------- | ----- |
| `PATCH /api/courses/assignments/:id/members`           | `POST /api/courses/assignments/:id/members`            | PATCH → POST         | Semántica: establecer subrecurso, no patch parcial. |
| `PATCH /api/courses/my-courses/:id/close`              | `POST /api/courses/assignments/:id/close`              | PATCH → POST         | Pertenece al subrecurso `assignments`; los roles incluyen Admin/Superadmin (no "mi"). |
| `PUT /api/courses/my-attendance/classes/:classNumber`  | `PUT /api/courses/my-attendance/classes/:classNumber` | (sin cambio)         | Idempotente, ya correcto. |
| `GET /api/courses/assignments` (array)                 | `GET /api/courses/assignments` (paginado)             | (sin cambio)         | AC4.8 / AC8.1; needs envoltura paginada. |
| `GET /api/courses` (array)                             | `GET /api/courses` (paginado)                         | (sin cambio)         | AC4.8. |

### Hooks/Componentes sugeridos (lo define el `frontend-engineer`, se cita para coherencia)

- `useActiveCourseAssignments()`, `useCourseAssignmentHistory(query)`,
  `useMyActiveCourseAssignments()`, `useMyCourseAssignmentHistory()`,
  `useReopenCourseAssignment()`, `useCourseAssignmentDetail(id)`.
  (Nomenclatura `use<Recurso>` conforme a AGENTS.md §4.)
- Componentes `MemberForm`, `EventModal` style: `CourseAssignmentForm`,
  `CourseAssignmentMembersModal`, `CourseHistoryDetail`, `ReopenCourseConfirmation`.
  (Nomenclatura `<RecursoAccion>` conforme a AGENTS.md §4.)

---

## 8. Drift detectado entre contrato actual y contrato objetivo

Inventario puntual que el `backend-engineer`, `database-engineer`, `frontend-engineer`,
`auth-security-engineer` y `quality-engineer` deben resolver:

### 8.1 Backend — `course.controller.ts` / `course.routes.ts`

- **D-01** Endpoint actual `findAssignments` no filtra por `status` ni `deletedAt: null` —
  devuelve todas las asignaciones mezcladas (violación AC8.1).
- **D-02** No existe `GET /api/courses/assignments/history` (AC8.3HU-08).
- **D-03** `removeAssignment` hace `findByIdAndDelete` + `ClassSession.deleteMany`
  (AC3.4, AC3.5 violados). Debe migrar a `findByIdAndUpdate({ deletedAt: new Date() })`.
- **D-04** `remove` (Course) hace `findByIdAndDelete` (AC3.1, D3 violados). Debe migrar a
  soft-delete.
- **D-05** Validadores `body("status")` aceptan `cancelled` (AC2.2 violado): rutas
  POST/PUT `/assignments` y `/assignments/:id` deben restringir a `["active","completed"]`.
- **D-06** No existe `POST /api/courses/assignments/:id/reopen` (AC7.1).
- **D-07** No existe `GET /api/courses/assignments/:id` (detalle con sesiones consolidadas).
- **D-08** `closeMyAssignment` no setea `endedAt` (ADR §D6).
- **D-09** No se registra auditoría en `closeMyAssignment`, `removeAssignment`, `remove`,
  ni existirá en `reopen` (AC EAC-9 — responsabilidad del `backend-engineer` con el
  módulo de auditoría existente, no reimplementarlo).
- **D-10** `findMyAssignments` devuelve todas las asignaciones del profesor (no filtra
  `active`); no existe `/my-courses/history` (AC8.4, AC8.5).
- **D-11** El verbo de `/assignments/:id/members` es PATCH; debe ser POST (ver §7).
- **D-12** La ruta de cierre es `/my-courses/:id/close`; debe ser `/assignments/:id/close`
  con POST (ver §7).
- **D-13** `findAll` y `findAssignments` no soportan paginación (`page`, `limit`) ni
  filtros (`name`, `level`, `isActive`, `professor`, `location`) (AC4.8, AC8.3).
- **D-14** `create`/`update` de `Course` no emiten realtime con mensaje estandarizado
  ({ message } JSON); hoy `create` devuelve un **string** — debe devolver
  `MessageResponse` JSON (ver §1.3).
- **D-15** La response de `assignCourse`/`updateAssignment` ya envuelve `{ message,
  assignment }` — **correcto**, se mantiene.

### 8.2 Modelos Mongoose (responsabilidad de `database-engineer`)

- **D-16** `course-assigned.model.ts` enum `courseAssignedStatus` incluye `CANCELLED`
  (AC2.1, D2 violados).
- **D-17** `course-assigned.model.ts` no tiene `endedAt`, ni `deletedAt`, ni `timestamps`
  ... ya tiene `timestamps: true` ✅; falta `endedAt` y `deletedAt` (D3, D6).
- **D-18** Índice unique parcial `{ professor: 1 }` no incluye `deletedAt: null` en
  `partialFilterExpression` (AC9.4 violado).
- **D-19** Faltan índices `{ status: 1, professor: 1 }` y `{ status: 1, endDate: -1 }`
  (AC9.1, AC9.2).
- **D-20** Falta índice `{ deletedAt: 1 }` sparse en `Course` y `CourseAssigned` (AC9.3).
- **D-21** `course.model.ts` no tiene `deletedAt` (AC3.1).
- **D-22** `class-session.model.ts` no tiene `deletedAt` (necesario para reopen con
  `totalClasses` reducido, AC7.6).

### 8.3 Frontend — `CourseAPI.ts` / `types/index.ts` / `constants/courses.ts`

- **D-23** `CourseAssignedStatus` zod enum incluye `cancelled` (AC2.3 violado).
- **D-24** `CourseAssignedSchema` (declarado como `assignedCourseSchema` en uso) no tiene
  `endedAt` ni `deletedAt` (D10).
- **D-25** `COURSE_STATUS_LABELS` incluye `cancelled` (AC2.4 violado).
- **D-26** No existen las funciones `getActiveCourseAssignments`,
  `getCourseAssignmentHistory`, `getMyActiveCourseAssignments`,
  `getMyCourseAssignmentHistory`, `reopenCourseAssignment`, `closeCourseAssignment` (con
  la nueva ruta), `softDeleteCourseAssignment`, `softDeleteCourse` (AC8.7, D9).
- **D-27** `getMyCourseAssignments`mezcla profesor/estudiante y mezcla estados; debe
  reemplazarse por `getMyActiveCourseAssignments` (AC8.4).
- **D-28** `updateCourseMembers` usa `api.patch`; debe usar `api.post` (ver §7).
- **D-29** `closeMyCourseAssignment` llama a `/my-courses/:id/close`; debe llamarse
  `closeCourseAssignment` y apuntar a `/assignments/:id/close` con POST (ver §7).
- **D-30** `getCourseAssignments` y `getMyCourseAssignments` deben quedar como
  `@deprecated` alias de las nuevas.
- **D-34 (ADR-0006)** `createCourseSchema` en `frontend/src/types/index.ts` marca
  `spiritualGrowthStage` como `.optional()` para no romper el build mientras el
  `frontend-engineer` añade el campo al formulario. El contrato objetivo lo tiene
  **requerido** (ver §1.3, §5.1 y `backend/src/models/course.model.ts`). Una vez el
  formulario de curso (`Courses.tsx` / `CourseForm.tsx`) capture la etapa, el campo
  debe volverse requerido en el schema.
- **D-35 (ADR-0006)** `frontend/src/api/CourseAPI.ts` (`createCourse` y `updateCourse`)
  no envían aún `spiritualGrowthStage` en el body. El `frontend-engineer` debe
  incluirlo cuando el formulario lo capture.
- **D-36 (ADR-0006)** Los formularios de curso (`Courses.tsx`, `CourseForm.tsx`) no
  muestran ni validan el campo `spiritualGrowthStage`. Requiere trabajo del
  `frontend-engineer` conforme a ADR-0006 §D2.

### 8.4 Auth/Security (responsabilidad del `auth-security-engineer`)

- **D-31** Validar que el índice unique parcial sea efectivo tras el cambio de
  `partialFilterExpression` (no bloquear soft-deletes al reasignar profesor).
- **D-32** Confirmar rate-limiting en endpoints `/reopen` y `/close` (mutaciones
  sensibles).
- **D-33** Confirmar que `POST /reopen` no filtre por dueño (`Superadmin` solo) en
  middleware y en service (defensa en profundidad).

---

## 9. Excepciones a AGENTS.md y temas a escalar al `Chief AI Architect`

Ninguna bloqueante hasta el momento. Items a confirmar (sin requerir pausa):

1. **(E-1)** `GET /api/courses/my-courses` y `/my-courses/history` se mantienen como
   **array plano** (sin envoltura paginada) por baja cardinalidad (un profesor tiene a
   lo sumo 1 activa; pocos cursos históricos). **Esto es una excepción menor al patrón
   `PaginatedResponse` general del módulo**. Se eleva al `chief-architect` para
   ratificación; si la rechaza, se introducirá paginación en una iteración futura sin
   breaking (envoltura opcional con feature flag).
2. **(E-2)** `POST /api/courses/assignments/:id/members` se habilita en paralelo a
   `PATCH` durante una iteración transitoria para no romper caches de clientes HTTP.
   `quality-engineer` elimina `PATCH` al cierre de la épica. **Excepción temporal**
   a la regla "un solo verbo por acción". Se eleva a ratificación.
3. **(E-3)** `GET /api/courses` se migra a envoltura paginada. Esto es un
   **breaking change** del contrato actual. El ADR-0001 lo respalda explícitamente
   (AC4.8). El `frontend-engineer` actualiza `getAllCourses` en la misma iteración.
   No requiere excepción pero **sí se reporta como breaking** para el `chief-architect`.
4. **(E-4)** Cuando el `Superadmin` soft-deleta un `Course` del catálogo que ya tiene
   `CourseAssigned` activas, **no se ocultan** las asignaciones en
   `/api/courses/assignments` (siguen devolviendo el `Course` populado histórico).
   Esto puede confundir; fuera de alcance de esta épica. Se escalá al
   `chief-architect` decidir si se bloquea el soft-delete de un `Course` con
   asignaciones activas, o se marca visualmente en UI. **No se aplica ninguna de las dos
   en este ciclo sin aprobación.**
5. **(E-5)** AC6.4 "Cursos faltantes" para Miembro/Asistente se calcula en el cliente a
   partir de los endpoints ya contratados (ver §3.3). Esto pone lógica de presentación
   menor en el frontend (resta de catálogos) — **no** es lógica de negocio. Si el
   `chief-architect` lo considera violación de AGENTS.md §3 ("no lógica de negocio en
   el cliente"), se introducirá un endpoint `GET /api/courses/my-missing` con backlog
   aparte. Para esta épica, se aplica la solución de cliente.

> **Bloqueantes detectados**: ninguno. Se puede continuar con el paso 4 (Mongoose +
> migraciones) y siguientes sin necesidad de esclarecimiento adicional.

---

## 10. Verificación de autosuficiencia del artefacto

Lista de comprobación para `database-engineer`, `backend-engineer`, `auth-security-
engineer`, `frontend-engineer`, `testing-engineer`:

- ✅ Cada endpoint tiene método, ruta, roles autorizados, query params con tipo/default/
  máximo, shape del body, shape del 200, códigos 4xx con mensajes en español.
- ✅ Schemas zod están definidos textualmente en §5 (todo lo necesario para los TS types
  del frontend). El `frontend-engineer` los materializa en `frontend/src/types/index.ts`
  sin desviarse.
- ✅ Cliente API esperado en §6 con tabla nombre → ruta → schema return → alias legacy.
- ✅ Drift actual objetivo en §8 — lista puntual numerada que cada dueño resuelve.
- ✅ Excepciones reportadas en §9. No se aplican excepciones sin ratificación.
- ✅ Mensajes de error en español, sin `any`, sin exponer hashes ni secretos.
- ✅ Soft-delete (`deletedAt`), transacciones para reopen, realtime keys, auditoría
  acciones — todos descritos contractualmente.

El siguiente paso es el `database-engineer` (paso 4 del ADR-0001): aplicar los cambios
de modelo ( schemas, índices, `deletedAt`, `endedAt`, script de migración
`cancelled → completed`) usando este contrato como referencia de los campos y sus tipos.

---_Fin del artefacto. Custodia: `api-contract-engineer`. Cualquier divergencia detectada
durante la implementación debe abrirse como nuevo drift en §8 (actualizando este
documento) y notificarse al `chief-architect`._