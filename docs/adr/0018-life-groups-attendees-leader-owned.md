# ADR-0018 — El roster de asistentes del grupo de vida lo gestiona el Líder

- **Estado**: Aceptado (implementado)
- **Fecha**: 2026-09-12
- **Custodio**: `chief-architect`
- **Tema**: Feature — separación de responsabilidades en grupos de vida: el
  supervisor/admin crea el grupo sin roster; el líder asignado administra sus
  asistentes desde "Mi grupo de vida".
- **Flujo**: Feature nueva end-to-end (AGENTS.md §7) + incidencias UX concurrentes.

## Contexto

Reporte del usuario:

> *"El supervisor, al crear el grupo de vida, no va a tener el campo de asistentes.
> Porque eso, el líder que será asignado al grupo debe hacerlo desde su panel, es
> decir, debe ingresar los asistentes."*

Estado actual (verificado en código y contrato):

1. `POST /api/life-groups` acepta `attendees` opcional (default `[]`) y
   `MyCoverage.tsx` (panel del supervisor/admin) expone un multi-select de
   asistentes tanto al crear como al editar.
2. `PATCH /api/life-groups/:id` permite reemplazar el roster completo, pero solo
   para `Admin`/`Superadmin` o el supervisor del grupo: **el líder recibe 403**.
3. `MyLifeGroup.tsx` (panel del líder) no tiene gestión de roster: solo registra
   sesiones, cuya asistencia se marca contra el roster vigente.

Consecuencia: quien debe cargar los asistentes (el líder, en su reunión semanal)
no puede hacerlo, y quien los carga hoy (el supervisor, de una vez al crear) no
es quien convive con el grupo. El roster "nace" incompleto o desactualizado.

## Decisión

### D1 — El formulario de cobertura pierde el campo "Asistentes"

`MyCoverage.tsx` elimina el multi-select de asistentes del formulario de crear
**y** editar. El supervisor/admin define únicamente metadatos: nombre, barrio,
dirección, tipo, líder (y supervisor si el creador es Admin). La tarjeta de
grupo sigue mostrando el conteo de asistentes (solo lectura).

### D2 — Endpoint dedicado para el roster: `PATCH /api/life-groups/:id/attendees`

Se crea un endpoint **dedicado** de roster con permiso explícito para el líder:

- Body: `{ "attendees": MongoId[] }` (requerido; puede ser vacío).
- Permiso: **líder del grupo**, supervisor del grupo, `Admin`/`Superadmin`.
- Respuesta: `200 { message, lifeGroup }` (mismo shape que el PATCH general).
- Errores contractuales: `404` grupo inexistente, `403` sin permiso, `400` ids
  inválidos / perfiles inexistentes. La restricción de rol elegible
  (`Asistente`/`Miembro`) queda a definición del contrato (ver "Pendientes").

El `PATCH` general (`/api/life-groups/:id`) **deja de aceptar `attendees`**: el
roster tiene una única vía canónica (menor superficie de permisos, sin doble
camino para el mismo dato). El `POST` conserva `attendees` opcional para no
romper seed/scripts; la UI simplemente deja de enviarlo.

### D3 — El panel del líder gana la sección "Asistentes del grupo"

`MyLifeGroup.tsx` añade una sección de gestión del roster: multi-select de
miembros con rol `Asistente`/`Miembro` (`getAllMembers` ya existe) + guardado
contra el endpoint D2. El roster vigente queda visible como lista con conteo.

### D4 — Sesiones históricas no se revalidan (sin cambio)

Como hoy: si el roster se reduce, las sesiones pasadas conservan sus
`attendeesPresent`; la UI ya muestra "X / roster.length presentes". El contrato
lo documenta explícitamente para el nuevo endpoint.

## Pendientes del contrato (`api-contract-engineer`) — RESUELTOS

1. ~~Formalizar shapes/zod/errores de D2 en `docs/api/life-groups-api.md`.~~
   **Resuelto**: §1.4 + §3.10 + §4 del contrato (endpoint, schemas, cliente).
2. ~~Decidir si se exige rol `Asistente`/`Miembro` en los ids del roster.~~
   **Resuelto**: se EXIGE en escrituras nuevas (`400 "Uno o más asistentes no
   tienen un rol elegible"`), sin revalidar rosters legacy (justificación en
   §5.1 del contrato: higiene de datos y prevención de inclusiones accidentales).
3. ~~Ajustar clientes/zod del frontend.~~
   **Resuelto**: `updateLifeGroupAttendeesSchema` en `frontend/src/types/index.ts`
   y `updateLifeGroupAttendees` en `frontend/src/api/LifeGroupAPI.ts`.

## Cambios esperados

- `backend/src/routes/life-group.routes.ts`: nueva ruta PATCH con validación
  `body("attendees")` (array de MongoId).
- `backend/src/services/life-group.service.ts`: caso de uso
  `updateAttendees(id, attendeeIds, context)` con permiso líder/supervisor/admin.
- `backend/src/controller/life-group.controller.ts`: handler que orquesta.
- `frontend/src/pages/coverage/MyCoverage.tsx`: D1.
- `frontend/src/pages/life-groups/MyLifeGroup.tsx`: D3.
- `docs/api/life-groups-api.md`: contrato D2 + remoción de `attendees` del PATCH.

## Implementación

Implementado al 100 % sin drift. Archivos reales tocados:

### Backend

- `backend/src/routes/life-group.routes.ts`: ruta `PATCH /:id/attendees` con validación de array de MongoId; `POST` conserva `attendees` opcional; `PATCH /:id` ya no acepta `attendees`.
- `backend/src/services/life-group.service.ts`: caso de uso `updateAttendees` con permiso para líder, supervisor, `Admin`/`Superadmin` y validación de rol elegible (`Asistente`/`Miembro`).
- `backend/src/controller/life-group.controller.ts`: handler `updateAttendees`.
- `backend/tests/routers/life-group.routes.smoke.test.ts` y `backend/tests/services/life-group.service.test.ts`: cobertura del endpoint, permisos y reglas de rol elegible.

### Frontend

- `frontend/src/pages/coverage/MyCoverage.tsx`: eliminado el campo de asistentes en crear/editar; muestra conteo en solo lectura y una nota explicativa.
- `frontend/src/pages/life-groups/MyLifeGroup.tsx`: nueva sección "Roster del grupo" con edición inline; el botón de edición se muestra para `Admin`, dueño del grupo (líder/supervisor con `profileId`) y, como fallback defensivo, para líderes/supervisores sin `profileId` poblado. El backend es la autoridad: si el usuario no pertenece al grupo responde `403`.
- `frontend/src/api/LifeGroupAPI.ts` y `frontend/src/types/index.ts`: cliente y tipos/zod para `PATCH /:id/attendees`.
- `frontend/src/utils/array.ts` (nuevo): `areArraysEqual` para comparar el roster actual contra el editado antes de mutar.
- `docs/api/life-groups-api.md`: contrato actualizado por `api-contract-engineer`.

### Nota sobre el fallback de permisos

El frontend mantiene un fallback permisivo para líderes/supervisores cuya sesión no tenga `profileId` poblado: se les muestra el botón de edición y el backend resuelve la autorización. Si el usuario no es dueño del grupo, el backend devuelve `403 { message: "No tienes permisos para esta acción" }`. Decisión del arquitecto: conservar el fallback en el cliente para no bloquear sesiones legacy, manteniendo la autoridad final en el backend.

## Consecuencias

### Positivas

- El responsable operativo del roster (líder) tiene la herramienta en su panel.
- Una sola vía canónica para mutar el roster (endpoint dedicado, least privilege).
- El flujo del supervisor se simplifica (menos campos, menos errores de carga).

### Negativas / trade-offs

- Breaking change menor del API: `PATCH /api/life-groups/:id` con `attendees`
  pasa a no aceptar el campo (pre-lanzamiento, mismo criterio que ADR-0015).
- El líder pasa a tener una capacidad de mutación nueva (acotada a SU grupo y
  solo al roster); requiere revisión de `auth-security-engineer`.

## Alternativas consideradas

- **Ampliar el PATCH general para que el líder edite solo `attendees`**:
  descartada. Sobrecarga semántica del endpoint y riesgo de escalar permisos
  por accidente (el líder recibiría un 403 "a medias" según el campo enviado).
- **Mantener el roster en manos del supervisor**: descartada. Es el reporte
  explícito del usuario y contradice la operación real del grupo.
- **Crear asistentes desde el panel del líder (alta de miembros)**: fuera de
  alcance; el alta de miembros ya existe en el módulo correspondiente.

## Riesgos vigilados

- Grupos sin roster recién creados: el líder debe poder tomar asistencia solo
  con roster cargado (la validación de sesiones ya exige subconjunto del roster).
- Permisos: `auth-security-engineer` revisa el endpoint D2 antes del cierre.
- Drift frontend↔backend: `quality-engineer` verifica contrato/UI al cierre.

## Referencias

- `docs/adr/0011-life-groups-leader-remove-predicas-ui-tweaks.md` (diseño del módulo).
- `docs/adr/0015-life-groups-supervisor-assignment.md` (asignación de supervisor).
- `docs/api/life-groups-api.md` (contrato afectado).
- `backend/src/services/life-group.service.ts` (`updateLifeGroup`,
  `validateAttendeesExist`, `canManageSessions` como patrones de permiso).
- `frontend/src/pages/coverage/MyCoverage.tsx`, `frontend/src/pages/life-groups/MyLifeGroup.tsx`.
