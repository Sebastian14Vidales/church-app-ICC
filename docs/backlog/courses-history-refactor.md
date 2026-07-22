# Epica: Refactor del modulo de Cursos + Historial + Soft-delete

> ID: `EPC-COURSES-001`
> Sponsor: Superadmin (usuario)
> Owner funcional: `product-owner`
> Custodio arquitectura: `chief-architect`
> Estado: **Borrador en revision** — pendiente de descomposicion por el `chief-architect`.

---

## Resumen del Sponsor

El modulo de Cursos actual mezcla en una misma pantalla los cursos vigentes y
los cursos ya finalizados, tanto en la vista del Superadmin/Admin como en la del
Profesor. Esto genera ruido visual, hace dificil distinguir lo que esta en curso
de lo que ya termino, y obliga a los usuarios a moverse entre largas listas.

Adicionalmente, se identifica deuda tecnica relevante: el controlador de cursos
es un megarchivo de 711 lineas que mezcla catalogo, asignaciones y asistencia; el
borrado de asignaciones es fisico (se pierde el historial de asistencia); el
enum de estado incluye un valor `cancelled` que la iglesia no usa; y no existe
una vista de "Historial" que centralice lo ya finalizado.

La mejora propone refundar el modulo separando administracion (catalogo),
asignaciones vigentes e historial (finalizados), eliminando el estado
`cancelled`, implementando borrado logico (soft-delete) y reabriendo cursos solo
por Superadmin. El resultado debe ser una experiencia clara para pastores,
lideres y profesores, sin jerga tecnica, respetuosa con la audiencia eclesial.

---

## Usuarios impactados

- **Superadmin**: administra catalogo y asignaciones; reabre cursos; elimina (soft-delete).
- **Admin**: crea cursos y asignaciones; no edita/elimina asignaciones ajenas (permisos del backend actuales).
- **Profesor**: gestiona su curso activo (miembros y asistencia) y consulta su historial en solo lectura.
- **Miembro / Asistente**: visualiza su curso activo, sus trofeos (completados) y cursos faltantes.

---

## Reglas de negocio (Definition of Done funcional)

1. **Solo dos estados para una asignacion**: `active` y `completed`. El estado
   `cancelled` se elimina del dominio (Mongoose, rutas, validadores, schemas
   zod, constantes de UI).
2. **Historial**: una `CourseAssigned` con `status: completed` NO aparece en las
   vistas principales de "cursos vigentes". Se visualiza exclusivamente desde la
   vista/seccion de Historial, accesible por rol.
3. **Soft-delete**: tanto `Course` como `CourseAssigned` incorporan un campo
   `deletedAt: Date` (opcional). Las consultas por defecto excluyen los
   soft-deleted (`deletedAt: null`). No se realiza borrado fisico de
   `CourseAssigned` ni de `ClassSession` asociadas.
4. **Reabrir curso completado**: accion exclusiva del `Superadmin`, ejecutada
   desde la vista de Historial. Se ejecuta en transaccion Mongo; recalcula
   `endDate` si se ajusta `totalClasses`; rechaza (409) si el profesor ya tiene
   otra asignacion activa. Deja registro en auditoria.
5. **Permisos por accion** (alineado con backend):
   - Crear curso / asignacion: `Admin` y `Superadmin` (`ADMIN_ROLES`).
   - Editar o eliminar asignacion: `Superadmin` (`SUPERADMIN_ROLES`).
   - Cerrar curso activo: profesor dueno, `Admin`, `Superadmin` (`TEACHING_ROLES` + `Admin` + `Superadmin`).
   - Registrar miembros: profesor dueno, `Admin`, `Superadmin`.
   - Reabrir curso: `Superadmin` exclusivo.
   - Tomar asistencia: `Profesor` dueno (`TEACHING_ROLES`).
6. **Migracion de datos**: cualquier `CourseAssigned` existente con
   `status: "cancelled"` se migra a `status: "completed"`, `endedAt = updatedAt`,
   y se registra en la bitacora de migracion. No se admiten nuevos
   `cancelled` despues de la migracion.
7. **Refactor backend**: el archivo `backend/src/controller/course.controller.ts`
   se divide en `course.controller.ts` (catalogo), `course-assignment.controller.ts`
   (asignaciones + miembros) y `attendance.controller.ts` (sesiones + asistencia).
   La logica de negocio se extrae a `services/` (`course-assignment.service.ts`,
   `attendance.service.ts`). Los controladores solo orquestan y responden.
8. **Frontend separado por rol**: `MyCourses.tsx` se divide en
   `MyCoursesProfessor.tsx` y `MyCoursesStudent.tsx`; `Courses.tsx` se
   reestructura con tabs/secciones: Catalogo, Asignaciones vigentes, Historial.
9. **Calidad**: sin `console.log` de depuracion, sin bloques de codigo muerto
   (p. ej. `{false && isSuperadmin ? ...}` en `Courses.tsx`), sin `any`, con
   schemas zod actualizados y cobertura de tests >= 80% en el modulo cursos.
10. **Listado de asignaciones**: el backend retorna por defecto solo asignaciones
    `active` (sin `completed` mezclados). El historial es un endpoint o query
    param explicito (`?status=completed` o ruta `/history`). El cliente NO filtra
    la lista; consume endpoints distintos.

---

## Historias de usuario

### HU-01 — Refactor del controlador y services de cursos

**Como** `chief-architect`
**Quiero** separar el controlador de cursos en tres controladores y extraer la
logica a services
**Para** cumplir la convencion "un controlador por modulo" del `AGENTS.md` y
reducir el acoplamiento.

#### Criterios de aceptacion

- AC1.1: Existe `backend/src/controller/course.controller.ts` solo con metodos
  de catalogo (findAll, findById, create, update, remove — con soft-delete).
- AC1.2: Existe `backend/src/controller/course-assignment.controller.ts` con
  asignaciones, miembros, cerrar y reabrir.
- AC1.3: Existe `backend/src/controller/attendance.controller.ts` con sesiones
  y asistencia.
- AC1.4: Existe `backend/src/services/course-assignment.service.ts` y
  `backend/src/services/attendance.service.ts` con la logica de negocio.
- AC1.5: Las rutas en `backend/src/routes/` se reorganizan manteniendo el
  prefijo `/api/courses` y no rompen el contrato publico excepto los cambios
  documentados (eliminacion de `cancelled`, nuevos endpoints `/history` y
  `/reopen`).
- AC1.6: `npm run lint` y `npm run typecheck` pasan en backend.

---

### HU-02 — Eliminacion del estado `cancelled`

**Como** Superadmin
**Quiero** que el dominio solo contenga cursos `active` o `completed`
**Para** reflejar el modelo real de la iglesia y evitar ruido en las vistas.

#### Criterios de aceptacion

- AC2.1: El enum `courseAssignedStatus` en `course-assigned.model.ts` solo
  contiene `ACTIVE` y `COMPLETED`.
- AC2.2: Los validadores `express-validator` en las rutas no aceptan
  `cancelled` (ni en `body` ni en query).
- AC2.3: El schema zod `CourseAssignedStatus` en `frontend/src/types/index.ts`
  es `z.enum(["active", "completed"])`.
- AC2.4: `COURSE_STATUS_LABELS` en `frontend/src/utils/constants/courses.ts`
  solo mapea `active` y `completed`.
- AC2.5: Existe un script de migracion (`backend/src/config/` o carpeta de
  migraciones acordada) que convierte cualquier `CourseAssigned` con
  `status: "cancelled"` a `status: "completed"` y registra `endedAt = updatedAt`.
  Deja log imprimible en consola (titulo `MIGRATION-COURSES-CANCELLED`).
- AC2.6: El script de migracion es idempotente.

---

### HU-03 — Soft-delete en Course y CourseAssigned

**Como** Superadmin
**Quiero** que al eliminar un curso o una asignacion no se borre fisicamente
**Para** conservar el historial y permitir recuperacion futura.

#### Criterios de aceptacion

- AC3.1: El esquema `Course` incluye `deletedAt: Date` (opcional, default null).
- AC3.2: El esquema `CourseAssigned` incluye `deletedAt: Date` (opcional, default null).
- AC3.3: Todas las consultas del controlador filtran `deletedAt: null` salvo
  endpoints explicitos de administracion (fuera de esta epica).
- AC3.4: `remove` (Course) y `removeAssignment` (CourseAssigned) hacen
  `deletedAt = new Date()` en vez de `findByIdAndDelete`.
- AC3.5: `removeAssignment` ya NO ejecuta `ClassSession.deleteMany`; las
  sesiones quedan vinculadas a la asignacion soft-deleted.
- AC3.6: El indice parcial unique de `CourseAssigned` por profesor activo
  sigue funcionando con soft-delete (no hay bloqueo por asignaciones eliminadas).
- AC3.7: La UI confirma con SweetAlert antes de eliminar; tras exito, el
  elemento desaparece de la lista (sin rerollar la pagina).

---

### HU-04 — Vista del Superadmin/Admin refundada

**Como** Superadmin/Admin
**Quiero** ver el Catalogo, Asignaciones vigentes e Historial en secciones
claramente separadas
**Para** no confundir cursos activos con finalizados.

#### Criterios de aceptacion

- AC4.1: `frontend/src/pages/courses/Courses.tsx` muestra tres
  tabs/secciones: "Catalogo", "Asignaciones vigentes" e "Historial".
- AC4.2: La seccion "Catalogo" lista cursos con:
  - Busqueda por nombre.
  - Filtro por `level`.
  - Filtro por `isActive` (Activos / Inactivos).
  - Botones "Crear", "Editar", "Eliminar" (con guards de rol realigned con
    backend: Admin + Superadmin pueden crear; eliminar con confirmacion);
    ademas badge de nivel visible.
- AC4.3: La seccion "Asignaciones vigentes" lista unicamente
  `CourseAssigned` con `status: active` y `deletedAt: null`.
  - Boton "Asignar curso" (visible para `ADMIN_ROLES`).
  - Botones "Editar" y "Eliminar" visibles solo para `Superadmin` (no para `Admin`).
  - Card muestra: curso, profesor, periodo, sede, hora, total de clases,
    miembros registrados, progreso de sesiones (registradas/total).
- AC4.4: La seccion "Historial" lista unicamente `CourseAssigned` con
  `status: completed` y `deletedAt: null`, ordenados por `endDate` desc.
  - Filtro por profesor y por sede.
  - Acciones solo lectura para Admin; `Superadmin` ademas ve boton "Reabrir".
- AC4.5: No se mezclan estados en una misma lista.
- AC4.6: Se elimina el `console.log(assignments)` y el bloque
  `{false && isSuperadmin ? ...}` existentes.
- AC4.7: Las cards usan chips de nivel (basic/intermediate/advanced) y de
  estado activo/finalizado, con estilos accesibles (WCAG AA).
- AC4.8: Paginacion cliente (o servidor si el backend lo expone) para
  Historial y Catalogo.

---

### HU-05 — Vista del Profesor separada

**Como** Profesor
**Quiero** ver solo mi curso activo en la pantalla principal y un Historial en
solo lectura
**Para** concentrarme en la gestion actual sin ruido.

#### Criterios de aceptacion

- AC5.1: Se crea `frontend/src/pages/courses/MyCoursesProfessor.tsx` y se
  elimina la rama `!isProfessor` de `MyCourses.tsx`.
- AC5.2: La pantalla principal muestra unicamente la `CourseAssigned` con
  `status: active` del profesor logueado (si no tiene, estado vacio claro).
  - Encabezado con curso, periodo, sede, hora, nivel.
  - Indicador de progreso: sesiones registradas / `totalClasses`.
  - Boton "Registrar miembros" (deshabilitado si no hay curso activo).
  - Acceso a `AttendanceView` para tomar asistencia.
  - Accion "Cerrar curso" (cuando todas las sesiones esten registradas).
- AC5.3: Una seccion/tab "Historial" lista `CourseAssigned` con
  `status: completed` pertenecientes al profesor (solo lectura).
- AC5.4: Cada item del historial permite expandir para ver sesiones y
  asistencia consolidada por estudiante (% asistencia, clases presentes).
- AC5.5: El profesor no puede editar asignaciones `completed`; no aparecen
  botones de mutacion en esta vista.
- AC5.6: `router.tsx` registra rutas nuevas con guards de rol (`TEACHING_ROLES`
  para profesor, `ADMIN_ROLES`/`SUPERADMIN_ROLES` segun corresponda).

---

### HU-06 — Vista del Miembro/Asistente separada

**Como** Miembro/Asistente
**Quiero** ver mi curso activo, mis trofeos (historial) y los cursos que me
faltan
**Para** acompanar mi proceso formativo.

#### Criterios de aceptacion

- AC6.1: Se crea `frontend/src/pages/courses/MyCoursesStudent.tsx` y se elimina
  la rama `isProfessor` de `MyCourses.tsx` anterior.
- AC6.2: La seccion "Curso actual" muestra la asignacion con `status: active`
  donde el miembro esta en `members[]`.
- AC6.3: La seccion "Trofeos" lista asignaciones con `status: completed`
  (historial del alumno). Se alimenta del backend; el frontend no inventa el
  listado.
- AC6.4: La seccion "Cursos faltantes" calcula cursos del catalogo no
  presentes en las asignaciones (activas o completadas) del miembro.
- AC6.5: Sin botones de mutacion (rol estrictamente de lectura).

---

### HU-07 — Reabrir curso completado (Superadmin)

**Como** Superadmin
**Quiero** reabrir un curso finalizado desde el Historial
**Para** corregir errores o continuar un curso cerrado prematuramente.

#### Criterios de aceptacion

- AC7.1: El endpoint `POST /api/courses/assignments/:id/reopen` existe, esta
  protegido por `SUPERADMIN_ROLES`, y valida que la asignacion exista y tenga
  `status: completed` y `deletedAt: null`.
- AC7.2: Antes de reabrir, valida que el profesor no tenga otra asignacion
  `status: active`; si la tiene, responde 409 con mensaje claro.
- AC7.3: La accion se ejecuta dentro de `session.withTransaction`; actualiza
  `status` a `active`, recalcula `endDate` si `totalClasses` cambio, y emite
  invalidacion realtime.
- AC7.4: La accion queda registrada en auditoria (no reimplementar el
  modulo de auditoria; usar el existente).
- AC7.5: En la UI, el boton "Reabrir" del Historial abre confirmacion
  SweetAlert; en exito invalida queries `courseHistory` y `courseAssignments`.
- AC7.6: Si `totalClasses` se ajusta, las `ClassSession` sobrantes (con
  classNumber > totalClasses) se conservan (no se borran) pero se marcan
  como "fuera de nuevo programa" en la vista (detalle de implementacion a
  acordar con `database-engineer`).

---

### HU-08 — Endpoints / filters para vigentes vs historial

**Como** frontend
**Quiero** consumir endpoints distintos para asignaciones vigentes e
historial
**Para** no filtrar en el cliente (cumple AGENTS.md §3).

#### Criterios de aceptacion

- AC8.1: `GET /api/courses/assignments` retorna por defecto solo `status: active`
  y `deletedAt: null`.
- AC8.2: `GET /api/courses/assignments?status=completed` retorna historial.
- AC8.3: `GET /api/courses/assignments/history` retorna historial (alias
  semantico), ordenado por `endDate` desc, con filtros por `professor` y
  `location` (query params).
- AC8.4: `GET /api/courses/my-courses` retorna solo `active`.
- AC8.5: `GET /api/courses/my-courses/history` retorna del profesor logueado
  sus asignaciones `completed`.
- AC8.6: Los esquemas zod del frontend reflejan los nuevos contratos (lo
  define `api-contract-engineer`).
- AC8.7: El cliente API `frontend/src/api/CourseAPI.ts` expone
  `getActiveCourseAssignments`, `getCourseAssignmentHistory`,
  `getMyActiveCourseAssignments`, `getMyCourseAssignmentHistory`.

---

### HU-09 — Indiced y migraciones Mongoose

**Como** `database-engineer`
**Quiero** indices optimizados para activos/historial y soft-delete
**Para** mejorar performance y consistencia.

#### Criterios de aceptacion

- AC9.1: Indice `{ status: 1, professor: 1 }` en `CourseAssigned`.
- AC9.2: Indice `{ status: 1, endDate: -1 }` en `CourseAssigned`.
- AC9.3: Indice `{ deletedAt: 1 }` (sparse) en `Course` y `CourseAssigned`.
- AC9.4: El indice parcial unique por profesor activo se mantiene
  funcional con `deletedAt: null` incluido en `partialFilterExpression`.
- AC9.5: Script de migracion `cancelled -> completed` disenado y probado
  contra base de pruebas.

---

### HU-10 — Testing y regresion

**Como** `testing-engineer`
**Quiero** suites que cubran el nuevo flujo y bloqueen regresiones
**Para** garantizar calidad ≥ 80%.

#### Criterios de aceptacion

- AC10.1: Tests backend cubren: soft-delete, reabrir (con transaccion),
  validacion de profesor unico activo, eliminacion de `cancelled`, endpoints
  de historial, autorizacion por rol.
- AC10.2: Tests frontend cubren `Courses.tsx` (tabs), `MyCoursesProfessor.tsx`
  e `MyCoursesStudent.tsx` (renders y mutaciones deshabilitadas segun rol).
- AC10.3: Cobertura >= 80% en archivos modificados del modulo cursos
  (backend y frontend).
- AC10.4: `npm test` verde antes de merge.

---

## Supuestos y dependencias

- Existe un modulo de auditoria utilizable (no se reimplementa).
- El realtime (`backend/src/realtime/socket.ts`) ya tiene el helper
  `emitRealtimeInvalidation`; se reutilizan las keys existentes y se anaden
  `courseHistory.changed`.
- El sistema de SweetAlert y react-toastify ya en uso se mantienen.
- Se reutiliza el constraint de "profesor unico activo" existente (indice
  parcial).
- El ADR `docs/adr/0001-courses-history-refactor.md` sera creado por el
  `chief-architect` antes de iniciar la implementacion.
- La migracion `cancelled -> completed` asume que no hay cursos cancelados
  con intencion de permanencia; el Sponsor confirma convertirlos a
  `completed`.

## Fuera de alcance (en esta epica)

- Exportar historial a PDF/Excel (queda para epica de Reportes).
- Recuperar cursos/asignaciones soft-deleted desde la UI (futuro endpoint
  admin).
- Modificar el flujo de toma de asistencia (solo se mueve de controlador).
- Redesenar el modelo de catologo (categorias, prerequisitos, etc.).
- Internacionalizacion (los strings siguen en espanol).

## Riesgos

- **Perdida de datos en la migracion cancelled -> completed**: mitigar con
  backup previo y script idempotente + log.
- **Drift permisos UI/backend**: el guard de botones debe alinearse 1:1 con
  `authorizeRoles` del backend; el `quality-engineer` audita.
- **Indice unique conflictivo al reabrir**: si una asignacion `completed` se
  reabre y el profesor ya tiene activa, el control debe devolver 409 antes
  de tocar el indice (validacion anticipada).
- **Refactor del megarchivo**: riesgo de romper contratos existentes;
  mitigar con suite de tests de regresion actual ejecutada antes/despues.
- **Aceptacion UX**: las vistas separadas pueden desorientar al usuario;
  mitigar con titulos claros, breadcrumbs y senales visuales por estado.

## Criterios de aceptacion a nivel epica

- EAC-1: El estado `cancelled` no aparece en ningun lugar del codigo
  (backend, frontend, schemas, constantes).
- EAC-2: La vista principal del Superadmin/Admin y del Profesor NO muestra
  cursos `completed` mezclados con `active`.
- EAC-3: Existe un Historial accesible por rol (Superadmin/Admin, Profesor,
  Miembro) que lista los `completed`.
- EAC-4: `Course` y `CourseAssigned` soportan soft-delete y no se borran
  fisicamente.
- EAC-5: El Superadmin puede reabrir un curso `completed` desde el
  Historial, respetando la unicidad de profesor activo.
- EAC-6: El controlador `course.controller.ts` queda dividido en tres
  controladores y la logica de negocio en services.
- EAC-7: `npm run lint`, `npm run typecheck` y `npm test` pasan; cobertura
  >= 80% en modulo cursos.
- EAC-8: No quedan `console.log` ni codigo muerto en archivos modificados
  del modulo.
- EAC-9: Auditoria documenta las acciones sensibles (cerrar, reabrir,
  eliminar).
- EAC-10: Documentacion funcional y ADR actualizados por `doc-keeper`.