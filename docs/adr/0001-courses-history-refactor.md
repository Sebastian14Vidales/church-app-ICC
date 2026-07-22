# ADR-0001 — Refactor del modulo de Cursos: historial, soft-delete y eliminacion de `cancelled`

- **Estado**: Aceptado
- **Fecha**: 2026-07-21
- **Custodio**: `chief-architect`
- **Epica asociada**: `EPC-COURSES-001` (`docs/backlog/courses-history-refactor.md`)
- **Decisiones**: tomadas por el Sponsor (Superadmin usuario) y ratificadas por el `chief-architect`.

## Contexto

El modulo de Cursos de ICC Casa de Dios mezcla hoy, en una misma pantalla, los
cursos vigentes y los cursos ya finalizados, tanto en la vista del
Superadmin/Admin (`frontend/src/pages/courses/Courses.tsx`) como en la del
Profesor (`frontend/src/pages/courses/MyCourses.tsx`). Adicionalmente se
identifica deuda tecnica:

- `backend/src/controller/course.controller.ts` es un megarchivo de 711 lineas
  que mezcla catalogo, asignaciones y asistencia (viola AGENTS.md §3).
- El borrado de `CourseAssigned` es fisico y ejecuta
  `ClassSession.deleteMany` (perdida de historial de asistencia).
- El enum `courseAssignedStatus` incluye el valor `cancelled` que la iglesia no
  usa y ensucia las vistas y los schemas.
- No existe vista de "Historial".
- Hay `console.log` de depuracion y un bloque `{false && isSuperadmin ? ...}`
  en `Courses.tsx`.

El Sponsor aprobo cinco decisiones:

1. Modelo de historial via `status` + indexacion (sin coleccion nueva).
2. Soft-delete en `Course` y `CourseAssigned`.
3. Permitir reabrir un `completed` solo a `Superadmin`, con transaccion.
4. Historial del Profesor en solo lectura.
5. Solo estados `active` y `completed`; eliminar `cancelled` del dominio.

## Decision

### D1 — Separacion del controlador y extraccion de services

`backend/src/controller/course.controller.ts` se divide en tres controladores:

- `course.controller.ts` — catalogo (findAll, findById, create, update, remove
  con soft-delete).
- `course-assignment.controller.ts` — asignaciones, miembros, cerrar y reabrir.
- `attendance.controller.ts` — sesiones y asistencia.

La logica de negocio se extrae a `backend/src/services/`:

- `course-assignment.service.ts` — transiciones de estado, validacion de
  profesor unico activo, calculo de `endDate`, reabrir.
- `attendance.service.ts` — generacion/validacion de sesiones y asistencia.

Los controladores solo orquestan y responden (AGENTS.md §3).

Las rutas se reorganizan en `backend/src/routes/`:

- `course.routes.ts` — `/api/courses` (catalogo).
- `course-assignment.routes.ts` — `/api/courses/assignments`,
  `/api/courses/assignments/history`, `/api/courses/assignments/:id/reopen`,
  `/api/courses/assignments/:id/close`, `/api/courses/assignments/:id/members`,
  `/api/courses/my-courses` y `/api/courses/my-courses/history`.
- `attendance.routes.ts` — `/api/courses/my-attendance` y
  `/api/courses/my-attendance/classes/:classNumber` (se conserva el prefijo
  `/api/courses` para no romper contrato publico).

### D2 — Eliminacion del estado `cancelled`

`CourseAssignedStatus` queda como `["active", "completed"]` en todos los
lugares:

- `backend/src/models/course-assigned.model.ts`
- `backend/src/routes/course.routes.ts` (validadores)
- `frontend/src/types/index.ts` (schema zod)
- `frontend/src/utils/constants/courses.ts` (`COURSE_STATUS_LABELS`)

Existe un script de migracion idempotente en `backend/src/config/` (carpeta de
migraciones acordada con `database-engineer`) que convierte cualquier
`CourseAssigned` con `status: "cancelled"` a `status: "completed"`, fijando
`endedAt = updatedAt`. El script deja log con titulo
`MIGRATION-COURSES-CANCELLED` y no lanza excepcion si ya fue ejecutado sobre
una base sin `cancelled`.

### D3 — Soft-delete en `Course` y `CourseAssigned`

Se anade `deletedAt: Date` (opcional, default `null`) en `Course` y
`CourseAssigned`. Todas las consultas del modulo filtran `deletedAt: null` por
defecto.

El borrado deja de ser fisico: `remove` y `removeAssignment` hacen
`deletedAt = new Date()` usando `findByIdAndUpdate`. La eliminacion en cascada
de `ClassSession` se **elimina**; las sesiones quedan vinculadas a la
asignacion soft-deleted para conservar el historial de asistencia.

El indice parcial unique de `CourseAssigned` por profesor activo se actualiza
para incluir `deletedAt: null` en el `partialFilterExpression`, de modo que un
profesor con una asignacion soft-deleted pueda recibir una nueva asignacion
activa sin invadir el constraint.

`Course` filtra `deletedAt: null` en `findAll` / `findById`.

### D4 — Historial via `status` + indexacion (sin coleccion nueva)

No se crea una coleccion nueva. El historial son las `CourseAssigned` con
`status: "completed"` (y `deletedAt: null`).

Endpoints:

- `GET /api/courses/assignments` — por defecto solo `active`, `deletedAt: null`.
  Soporta query param `?status=completed` como alias de `history` para
  flexibilidad REST, pero el frontend consume preferentemente `/history`.
- `GET /api/courses/assignments/history` — solo `completed`, `deletedAt: null`,
  ordenado por `endDate` desc. Acepta filtros `?professor=` y `?location=` y
  paginacion `?page=` / `?limit=` (limites maximos acordados con
  `api-contract-engineer`).
- `GET /api/courses/my-courses` — solo `active` del profesor/miembro logueado.
- `GET /api/courses/my-courses/history` — solo `completed` del profesor logueado
  (orden desc por `endDate`). Para Miembros/Asistentes se expone tambien un
  historial (sus trofeos).

Indices en `CourseAssigned`:

- `{ status: 1, professor: 1 }` — listados por profesor.
- `{ status: 1, endDate: -1 }` — historial ordenado.
- `{ deletedAt: 1 }` (sparse) en `Course` y `CourseAssigned`.
- Indice parcial unique revisado: `{ professor: 1 }` con
  `partialFilterExpression: { status: "active", deletedAt: null }`.

El realtime reutiliza `emitRealtimeInvalidation` con keys existentes y anade
`courseHistory.changed` (asignable a las query keys `[["courseHistory"]]`).

### D5 — Reabrir curso completado (Superadmin, transaccion)

Nuevo endpoint `POST /api/courses/assignments/:id/reopen` con
`authorizeRoles(["Superadmin"])`.

Reglas:

- La asignacion debe existir, tener `status: "completed"` y `deletedAt: null`.
- Antes de mutar, validar que el `professor` no tenga otra `status: "active"` con
  `deletedAt: null`; si la tiene, 409 con mensaje claro en espanol.
- Recalcular `endDate` a partir de `startDate` y el `totalClasses` recibido en
  body (opcional; si no viene, se conserva el actual).
- Transaccion `session.withTransaction`: actualiza `status: "active"`, limpia
  `endedAt` (queda `null`), recalcula `endDate`.
- **ClassSession sobrantes**: si el nuevo `totalClasses` es menor que el
  anterior, las `ClassSession` con `classNumber > totalClasses` se **conservan
  sin borrar**, marcadas con `deletedAt` en la propia `ClassSession` (soft-delete
  anadido tambien a `ClassSession`). La vista las excluye del progreso pero el
  historial de asistencia queda disponible. Si el nuevo `totalClasses` es mayor,
  se generan sesiones vacias como ya hace el overview actual.
- Emite invalidacion realtime `courseHistory.changed` y
  `courseAssignments.changed`.
- Registra auditoria: accion `course.reopen`, contexto
  `{ assignmentId, oldStatus: "completed", newStatus: "active", totalClasses }`.

El boton ("Reabrir") aparece en la seccion Historial de `Courses.tsx` (Superadmin),
con confirmacion SweetAlert y posterior invalidacion de queries.

### D6 — `endedAt` como campo nuevo

Se anade `endedAt: Date` (opcional) a `CourseAssigned` para distinguirlo de
`endDate` (fecha calendario calculada). `endedAt` registra el instante real en
que se cerro el curso (timeline). Se llena en `closeMyAssignment` y se limpia
al reabrir. En la migracion `cancelled -> completed`, `endedAt = updatedAt`.

### D7 — Vistas por rol en el frontend

- `frontend/src/pages/courses/Courses.tsx` se reestructura con **tabs internos**
  en una misma ruta (`/courses`): "Catalogo", "Asignaciones vigentes" e
  "Historial". Esto reduce fricción de navegacion y mantiene un unico punto de
  entrada. El guard sigue siendo `ADMIN_ROLES`.
- Se separan:
  - `frontend/src/pages/courses/MyCoursesProfessor.tsx` (ruta `/my-courses`,
    guard `TEACHING_ROLES`, pero internamente diferencia "tengo mi activa" y
    "veo historial" via tab interno).
  - `frontend/src/pages/courses/MyCoursesStudent.tsx` (ruta `/my-courses`
    tambien?))). **Decision**: rutas distintas:
    - `/my-courses` para Profesor (guard `TEACHING_ROLES` con verificacion
      contra el rol "Profesor" del perfil autenticado).
    - `/my-courses/student` para Miembro/Asistente (guard que excluye `Profesor`,
      o se decide con roles `["Asistente", "Miembro"]`).
  - `router.tsx` se actualiza con los nuevos lazy imports y guards.

### D8 — Permisos UI sincronizados con backend

Los botones de la UI respetan 1:1 los `authorizeRoles` del backend:

- "Crear curso" / "Asignar curso" → roles `ADMIN_ROLES`.
- "Editar / Eliminar asignacion" → solo `Superadmin`.
- "Cerrar curso" → profesor dueno, Admin, Superadmin.
- "Registrar miembros" → profesor dueno, Admin, Superadmin.
- "Reabrir" → `Superadmin` exclusivo.
- "Tomar asistencia" → `Profesor` dueno (`TEACHING_ROLES`).

El guard por UI usa `user.roles` del `useAuth()`. El backend sigue siendo la
autoridad real; la UI solo controla visibilidad.

### D9 — Cliente API

`frontend/src/api/CourseAPI.ts` se refactoriza a funciones semanticamente
nombradas:

- `getActiveCourseAssignments()`
- `getCourseAssignmentHistory({ professor?, location?, page?, limit? })`
- `getMyActiveCourseAssignments()`
- `getMyCourseAssignmentHistory()`

Las funciones legacy (`getCourseAssignments`, `getMyCourseAssignments`) se
endenten a las nuevas para no romper usos transitorios y se marcan `@deprecated`
hasta que `quality-engineer` limpie el codigo. Las vistas nuevas solo usan las
nuevas.

### D10 — Schemas zod

`api-contract-engineer` define formalmente:

- `courseAssignedStatusSchema = z.enum(["active", "completed"])`.
- `courseAssignedSchema` (existente) con `endedAt` y `deletedAt` opcionales.
- `courseAssignedHistoryItemSchema` (variante con sesiones consolidadas para
  el detalle).
- `attendanceOverviewSchema` (existente) se mantiene.
- Query params schemas para `history` (filtros y paginacion).

## Alternativas consideradas

- **Coleccion `CourseHistory` separada**: descartada. Implica duplicacion,
  sincronizacion entre colecciones y perdida de relaciones. La solucion
  `status + deletedAt` es mas simple y cumple el objetivo.
- **Borrado fisico conservado**: descartado por exigencia del Sponsor y por
  perdida de historial de asistencia.
- **Mantener `cancelled` pero ocultarlo en UI**: descartado por el Sponsor
  (la iglesia no usa el estado; limpiar el dominio reduce complejidad).
- **Tres rutas de pagina distintas para Admin**: descartado. Tabs internos en
  `/courses` son suficientes y reducen refactor del menu lateral.
- **Endpoint unico con `?status=` y sin `/history`**: descartado. Los endpoints
  semanticos (`/history`, `/my-courses/history`) son mas claros y autodocumentables;
  se mantiene `?status=completed` como alias por flexibilidad REST.

## Consecuencias

### Positivas

- Claridad funcional: vigentes e historial separados.
- Reduccion de deuda tecnica en backend: tres controladores y services.
- Conservacion de datos via soft-delete.
- Dominio mas simple (dos estados).
- Indices eficientes para activos e historial.
- Reapertura segura para corregir errores administrativos.
- Contratos API mas expresivos.

### Negativas / trade-offs

- Aumenta el numero de archivos en backend (3 controladores + 2 services + 3
  routes) → mitigado con estructura clara por modulo.
- Migracion `cancelled -> completed` obligatoria; requiere backup previo.
- Soft-delete duplica indices (uno sparse por `deletedAt`) → aceptable por
  volumen actual.
- `endedAt` introduce un campo nuevo que `doc-keeper` debe reflejar en la
  documentacion funcional.
- Rutas `/my-courses/student` nuevas requieren guard especifico; `router.tsx`
  se complica levemente.

### Riesgos vigilados

- Drift permisos UI/backend → `quality-engineer` audita.
- Indice unique conflictivo al reabrir → validacion anticipada en service.
- Perdida de datos en migracion → backup + script idempotente + log.
- Confusion de usuario por vistas separadas → titulos claros, breadcrumbs,
  chips de estado accesibles (`ui-design-engineer`).

## Plan de ejecucion (resumen)

1. **Este ADR** — `chief-architect` (listo).
2. Historia — `product-owner` (ya en `docs/backlog/courses-history-refactor.md`).
3. **Contratos API** — `api-contract-engineer` (siguiente paso): define
   payloads, schemas zod, OpenAPI y nombres de endpoint. Entrega en sus
   archivos de contrato habituales.
4. Migraciones Mongoose + indices — `database-engineer`.
5. Refactor backend (controllers + services + rutas + soft-delete) —
   `backend-engineer`.
6. Revision auth/perms — `auth-security-engineer`.
7. Cliente API + tipos + hooks — `frontend-engineer`.
8. Vistas (Courses tabs, MyCoursesProfessor, MyCoursesStudent, AttendanceView)
   — `frontend-engineer`.
9. Tailwind/accesibilidad — `ui-design-engineer`.
10. Tests + regresion ≥ 80% — `testing-engineer`.
11. Auditoria cross-dominio + cleanup — `quality-engineer`.
12. Docs — `doc-keeper`.
13. Validacion final contra AC — `product-owner` + `chief-architect`.

## Excepciones ratificadas por el `chief-architect` tras el paso 3 (contrato API)

Tras el reporte del `api-contract-engineer` (ver `docs/api/courses-api.md` §9), se ratifican
las siguientes excepciones/decisiones:

- **E-1 (Aceptada, menor)** — `GET /api/courses/my-courses` y
  `GET /api/courses/my-courses/history` se mantienen como array plano (sin
  `PaginatedResponse`) por baja cardinalidad (un profesor tiene a lo sumo una asignación
  activa por el índice unique; pocos cursos históricos). Excepción menor al patrón general
  del módulo. **Revisión**: si la cardinalidad histórica supera ~50 ítems por profesor, se
  introducirá paginación en una iteración futura sin breaking (envoltura compatible).
- **E-2 (Rechazada)** — No se mantiene `PATCH /api/courses/assignments/:id/members` en
  paralelo a `POST`. El contrato objetivo es **únicamente POST**. El `backend-engineer`
  elimina la ruta PATCH y el `frontend-engineer` cambia `updateCourseMembers` de
  `api.patch` a `api.post` en sus respectivos pasos (cambio atómico, sin deuda transitoria).
  Razón: el monorepo end-to-end está bajo control del ecosistema; no hay clientes externos
  que justifiquen una ventana de compatibilidad.
- **E-3 (Aceptada)** — `GET /api/courses` migra a envoltura `PaginatedResponse<Course>`.
  Es un breaking change interno respaldado por AC4.8. El `frontend-engineer` actualiza
  `getAllCourses` en el mismo ciclo. No hay API pública externa; el cambio es visible solo
  dentro del monorepo.
- **E-4 (Decisión de arquitectura)** — El soft-delete de un `Course` que tiene
  `CourseAssigned` con `status: "active"` y `deletedAt: null` se **bloquea** con
  `409 { message: "No puedes eliminar un curso con asignaciones activas" }`. El
  `backend-engineer` añade la validación en `course.controller.ts` / `course.service.ts`
  (ver `docs/api/courses-api.md` §1.5 actualizado). Esto evita referencias colgantes que
  confunden al usuario. El soft-delete de un `Course` sin asignaciones activas procede
  normalmente. La recoverabilidad de cursos con solo asignaciones `completed` queda
  fuera de alcance de esta épica (se evalúa en backlog de reportes).
- **E-5 (Aceptada)** — La vista "Cursos faltantes" del Miembro/Asistente (AC6.4) se
  calcula en el cliente a partir de `GET /api/courses` + `GET /my-courses` +
  `GET /my-courses/history` (resta de catálogos). Es lógica de presentación menor, no
  viola `AGENTS.md §3` (que prohíbe lógica de _negocio_ en el cliente). Si en el futuro
  se requiera filtra por sede/periodo, se introduce `GET /api/courses/my-missing` con
  backlog aparte (no en esta épica).

Estas ratificaciones se incorporan al contrato `docs/api/courses-api.md` como parte del
mismo cambio del paso 3.

## Apertura de excepciones temporales

### ET-1 — Auditoría ausente (`[AUDIT-PENDING]` temporal)

- **Vigencia**: desde el paso 5 del Plan de ejecución del ADR-0001 hasta que se
  implemente el módulo de auditoría transversal (épica aparte, por definir).
- **Alcance**: tres mutaciones sensibles del módulo de Cursos requieren registro de
  auditoría (AC7.4 y EAC-9):
  - `course.assignment.delete` (ctx `{ assignmentId }`) en
    `backend/src/services/course-assignment.service.ts :: softDeleteAssignment`.
  - `course.assignment.close` (ctx `{ assignmentId, professorId }`) en
    `closeAssignment`.
  - `course.reopen` (ctx `{ assignmentId, oldStatus, newStatus, totalClasses }`) en
    `reopenAssignment`.
- **Estado actual**: el `backend-engineer` hace `grep` exhaustivo y confirma que **no
  existe módulo de auditoría** en `backend/src/` (ni `service`, ni `util`, ni
  `middleware`). Por `AGENTS.md §5` ("Auditoría... via el módulo de auditoría; no
  reimplementar") no se introduce un módulo de auditoría ad-hoc en esta épica.
- **Mitigación**: cada uno de los 3 sitios marca con comentario `TODO[AUDIT-PENDING]`
  indicando acción + contexto a persistir. La auditoría entra cuando el `chief-architect`
  abra la épica de auditoría (p. ej. `EPC-AUDIT-001`) y designe un dueño (probablemente
  un nuevo agent `audit-engineer`, o iteración de `backend-engineer` con scope acotado).
- **Compromiso**: cuando el módulo exista, se eliminan los 3 `TODO[AUDIT-PENDING]` en
  el mismo PR que introduce el módulo, completando así HU-07 AC7.4 y EAC-9. Mientras
  tanto, **las acciones sensibles se ejecutan funcionalmente** (sin registro), pero el
  código deja rastro de dónde auditar.

### Otras excepciones ya ratificadas

E-1, E-3, E-4 y E-5 son aceptadas (ver sección anterior "Excepciones ratificadas por el
`chief-architect` tras el paso 3"). E-2 fue rechazada (no aplica). Ninguna adicional
	temporal con caducidad, salvo la ET-1 anterior y la revisión futura de E-1 cuando la
cardinalidad histórica crezca.

## Referencias

- `AGENTS.md` §3 (un controlador por modulo, logica en services).
- `AGENTS.md` §5 (soft-delete preferido, transacciones para multi-documento).
- `AGENTS.md` §7 (flujo canonico feature nueva end-to-end).
- `AGENTS.md` §9 (calidad minima: no merge rojo, sin `console.log`, sin `any`).
- `docs/backlog/courses-history-refactor.md` (epica fuente).