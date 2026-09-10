# ADR-0011 — Grupos de vida con rol Lider, retirada de Predicas y ajustes de UI

- **Estado**: Aceptado
- **Fecha**: 2026-08-17
- **Custodio**: `chief-architect`
- **Decision**: propuesta por el Sponsor (Admin/Superadmin usuario) y ratificada por el `chief-architect`.

## Contexto

El Sponsor del proyecto ICC Casa de Dios solicitó cuatro cambios sobre el estado actual del sistema:

1. **Badge de "Miembro" en la página de miembros**: cuando una persona está bautizada y además
   tiene el rol `Profesor`, `Supervisor` o `Pastor`, el sistema debe **omitir** el `<p>` con la
   etiqueta "Miembro". Negocio asume que bautizado + uno de esos tres roles implica miembro, por
   lo que la etiqueta es redundante. Para quienes **solo** están bautizados (sin ninguno de esos
   tres roles), la etiqueta "Miembro" se mantiene.
2. **Grupos de vida con líder**: el `Supervisor` debe registrar un grupo de vida dentro de su
    cobertura. El grupo está compuesto por un **líder**, que lidera sesiones semanales (grupo de
    vida) o mensuales (grupo de pareja), según lo que el líder programe. El grupo tiene asistentes
    y, para los grupos de vida, un espacio de ofrendas. El líder, al iniciar sesión, verá
    **únicamente** el item "Mi grupo de vida" en el sidebar y ahí llevará el registro de las
    semanas/sesiones, las personas que han asistido y las ofrendas recogidas cada semana/mes.
3. **Retirada de Predicas**: quitar la opción de predicas para el admin y para los pastores.
    Eliminar la implementación del sistema. Se mantiene un placeholder inhabilitado con la
    etiqueta "próximamente" para reactivar la feature más adelante.
4. **Dashboard de eventos**: mostrar en el dashboard los eventos **actuales** (no pasados). Si no
   hay eventos actuales, no mostrar la sección.

### Estado previo relevante

- El modelo `LifeGroup` solo tiene `name`, `neighborhood`, `address`, `supervisor`. No hay líder,
  asistentes, sesiones ni ofrendas.
- La ruta `frontend/src/pages/coverage/MyCoverage` **está referenciada en `router.tsx` pero el
  archivo no existe**: la página "Mi cobertura" del supervisor está rota (caída al navegar).
- El rol `Lider` no existe en el enum de `Role`, en `seed.ts` ni en el frontend (`memberRoleSchema`).
- Las predicas tienen implementación completa: backend (`sermon.model.ts`,
  `sermon.controller.ts`, `sermon.routes.ts` montado en `server.ts`, referenciado en `seed.ts`) y
  frontend (`pages/sermons/Sermons.tsx`, `pages/MySermons.tsx`, `api/SermonAPI.ts`, rutas en
  `router.tsx`, items en `Sidebar.tsx`, constantes en `routes.ts`). No existen pruebas de sermons.
- El `Sidebar.tsx` ya dispone del patrón de item inhabilitado con sub-etiqueta "próximamente..."
  (usado por "Ofrendas").
- El `Dashboard.tsx` lista todos los eventos ordenados por fecha asc, sin filtrar pasados, y
  siempre renderiza la sección (con fallback textual cuando está vacía).

## Decision

### D1 — Regla de visualización del badge "Miembro" (solo frontend)

En `frontend/src/pages/members/Members.tsx`, al renderizar los badges de rol de cada miembro, se
**filtra** el rol `"Miembro"` cuando se cumpla:

```
member.baptized === true
  AND (rolesTotales contiene "Profesor" OR "Supervisor" OR "Pastor")
```

donde `rolesTotales` = `[member.role.name, ...member.user?.roles.map(r => r.name)]`.

- Si la persona está bautizada y tiene uno de los tres roles elevados, **no** se renderiza el `<p>`
  "Miembro".
- Si está bautizada y **no** tiene ninguno de esos tres roles, el `<p>` "Miembro" se mantiene.
- Para no bautizados, se conserva el comportamiento actual (su rol primario se muestra).

Esta lógica es **de presentación**: el backend sigue devolviendo todos los roles; el frontend
decide qué mostrar. No hay cambio de contrato ni de persistencia.

### D2 — Nuevo rol `Lider`

Se añade el rol `"Lider"` al enum de roles en tres sitios:

- `backend/src/models/role.model.ts` (enum `name`).
- `backend/src/config/seed.ts` (`CURRENT_ROLES`).
- `frontend/src/types/index.ts` (`memberRoleSchema`).

También se añade la entrada en `frontend/src/utils/constants/roleColors.ts` (`roleColors` y
`roleLabels`) y en `frontend/src/components/dashboard/MemberForm.tsx`:

- `Lider` pasa a ser un **rol con acceso al login** (`LOGIN_ENABLED_ROLES`), seleccionable en el
  formulario por `Admin`/`Superadmin` (no por Profesor/Pastor/Supervisor, que siguen restringidos).
- Como los demás roles con acceso, requiere `email` y dispara el flujo de activación de cuenta.

El rol `Lider` es otorgado por **Admin/Superadmin** al crear/editar un miembro. El `Supervisor`
no crea líderes; selecciona líderes **existentes** al armar un grupo de vida.

### D3 — Modelo extendido de `LifeGroup`

`backend/src/models/life-group.model.ts` se extiende con:

```ts
{
  name: string,
  neighborhood: string,
  address: string,
  supervisor: ObjectId ref UserProfile,   // existente
  leader: ObjectId ref UserProfile,        // NUEVO, required
  type: "life-group" | "couple-group",     // NUEVO, required (semanal | mensual)
  attendees: [ObjectId ref UserProfile],   // NUEVO — roster del grupo
  sessions: [                               // NUEVO — subdocumentos embebidos
    {
      date: Date,
      weekNumber: number,           // secuencial por grupo
      attendeesPresent: [ObjectId ref UserProfile],
      offeringAmount: number,       // >= 0; aplica a todo tipo de sesion
      notes?: string,
    }
  ],
  timestamps
}
```

**Subdocumentos embebidos** para `sessions`: a esta escala (~52 sesiones/año por grupo, un grupo
por líder) el embebido es performante, evita una colección extra y simplifica la query del líder
(un solo documento poblado). Si el volumen crece, se evaluará una colección `LifeGroupSession`
separada en un ADR posterior.

Índices: `{ supervisor: 1 }`, `{ leader: 1 }` (¿únicos? no necesariamente únicos: un supervisor
puede tener varios grupos; un líder lidera un único grupo — se aplicará índice en `leader` y se
validará unicidad a nivel aplicación: un perfil solo puede ser líder de un grupo).

### D4 — Contrato API de grupos de vida

Autoridad: `api-contract-engineer` (contrato detallado en `docs/api/life-groups-api.md`). Resumen:

- `GET /api/life-groups` — role-aware: `Admin`/`Superadmin` ven todos; `Supervisor` ve los de su
  cargo; `Lider` ve el grupo donde es `leader`. Respuesta: array de `LifeGroup` populado
  (`supervisor`, `leader`, `attendees`, `sessions.attendeesPresent`).
- `POST /api/life-groups` — `Supervisor`/`Admin`/`Superadmin` crean. Body: `name`, `neighborhood`,
  `address`, `leader` (ObjectId), `type`, `attendees` ([] ObjectId). El `supervisor` se asigna al
  perfil del solicitante (salvo admin, que puede indicar `supervisor`).
- `PATCH /api/life-groups/:id` — `Supervisor`/`Admin` editan metadatos y roster (`attendees`);
  restringido al propio supervisor.
- `POST /api/life-groups/:id/sessions` — `Lider` (del grupo) o `Supervisor`/`Admin` registran una
  sesión: `date`, `attendeesPresent` ([] ObjectId subset de `attendees`), `offeringAmount`, `notes`.
- `PATCH /api/life-groups/:id/sessions/:sessionId` — edita una sesión existente.
- `DELETE /api/life-groups/:id/sessions/:sessionId` — elimina una sesión.

Validación: `attendeesPresent` debe ser subset de `attendees`; `offeringAmount >= 0`; `type` en
`["life-group","couple-group"]`; `leader` debe ser un perfil con rol `Lider` activo.

### D5 — Permisos y autorización

- Crear/editar grupo: `Supervisor` (su cobertura), `Admin`, `Superadmin`.
- Registrar/editar/eliminar sesiones: el `Lider` del grupo (verificando `group.leader ==
  req.auth.profileId`), `Supervisor` del grupo, `Admin`, `Superadmin`.
- Ver: `Supervisor` (los suyos), `Lider` (el suyo), `Admin`/`Superadmin` (todos).
- El `Lider` no puede mutar metadatos del grupo ni el roster; solo sesiones/ofrendas/asistencia.

El middleware `authorizeRoles` existente cubre el rol; la verificación de pertenencia
(líder del grupo) se añade en el controlador/servicio.

### D6 — Frontend del líder y del supervisor

- **Supervisor**: se crea `frontend/src/pages/coverage/MyCoverage.tsx` (hoy inexistente — fix de
  la ruta rota). Lista sus grupos y permite crear/editar un grupo seleccionando líder (de los
  perfiles con rol `Lider`), tipo y asistentes (de los `Asistente`/`Miembro` de su cobertura).
- **Líder**: se crea `frontend/src/pages/life-groups/MyLifeGroup.tsx` (ruta `PATHS.myLifeGroup`,
  p. ej. `/mi-grupo-de-vida`). Muestra su grupo, las sesiones (semanas pasadas), los asistentes y
  las ofrendas por semana/mes, y permite registrar una sesión nueva (fecha, asistentes presentes,
  ofrenda, notas).
- **Sidebar**: si el usuario es `Lider` y **no** tiene ningún otro rol con navegación
  (`Admin`/`Superadmin`/`Profesor`/`Pastor`/`Supervisor`), el menú de navegación queda **únicamente**
  con `[{ name: "Mi grupo de vida", href: PATHS.myLifeGroup, icon: Heart }]`. Si tiene `Lider`
  además de otro rol, se añade "Mi grupo de vida" a su menú existente.
- **Landing**: cuando el usuario es `Lider`-only, la ruta índice (`/`) redirige a
  `PATHS.myLifeGroup` para que el dashboard no renderice contenido de admin. Se implementa con un
  `<Navigate>` en `Dashboard.tsx` (o guard role-aware) para no abrir más superficie del sistema al
  líder de lo necesaria.
- **Router**: nueva ruta `/mi-grupo-de-vida` con `RequireAuth allowedRoles={["Lider", "Admin",
  "Superadmin", "Supervisor"]}` (admin/supervisor pueden inspeccionar; el líder gestiona).
- **API cliente**: `frontend/src/api/LifeGroupAPI.ts` se extiende con las operaciones de sesión.
- **Tipos**: `frontend/src/types/index.ts` (`lifeGroupSchema` + sub-esquemas de sesión).

### D7 — Retirada de Predicas

Se **elimina** la implementación funcional de predicas:

- Backend: borrar `backend/src/models/sermon.model.ts`,
  `backend/src/controller/sermon.controller.ts`, `backend/src/routes/sermon.routes.ts`; remover el
  import y el montaje `app.use("/api/sermons", sermonRoutes)` en `backend/src/server.ts`; remover
  en `backend/src/config/seed.ts` el import de `Sermon` y el bloque que sincroniza roles `Pastor`
  a partir de `Sermon.distinct("pastor")` (la sincronización de `Profesor` desde `CourseAssigned`
  se conserva).
- Frontend: borrar `frontend/src/pages/sermons/Sermons.tsx`,
  `frontend/src/pages/MySermons.tsx`, `frontend/src/api/SermonAPI.ts`; remover las rutas
  `PATHS.sermons` y `PATHS.mySermons` de `router.tsx` y de `routes.ts`; remover el item
  "Mis predicas" del pastor en `Sidebar.tsx`.
- No existen pruebas de sermons que remover.

**Placeholder inhabilitado (interpretación del Sponsor)**: el Sponsor indicó "en los reportes,
dejámelo como próximamente e inhabilitado también para más tarde seguir haciendo modificaciones".
Dado que el `Sidebar.tsx` ya dispone del patrón de item inhabilitado con sub-etiqueta
"próximamente..." (usado por "Ofrendas"), se reinterpreta como: en el menú del **admin**, el item
"Predicas" se **conserva** pero como item **inhabilitado** con la sub-etiqueta "próximamente..."
(reutilizando el mismo patrón), de modo que la feature quede apuntada para reactivarse más
adelante sin reconstruir la entrada del menú. Para el pastor, "Mis predicas" se **elimina** sin
placeholder (su vista era subordinada de la feature principal).

> **Nota de ambigüedad**: la frase "en los reportes" del Sponsor es ambigua (las predicas no
> existen hoy en la página de Reportes). El `chief-architect` resolvió ubicando el placeholder en
> el menú lateral del admin, que es donde ya existe el patrón "próximamente". Si el Sponsor
> refuta esta interpretación, se ajusta el destino del placeholder en una corrección menor.

### D8 — Dashboard: eventos actuales

En `frontend/src/pages/Dashboard.tsx`, el bloque de eventos del dashboard filtra a **eventos
actuales/no pasados** (`event.date >= hoy`, incluyendo el día en curso) antes de poblar el
carrusel y las tarjetas de recaudo/ocupación. Si el resultado es vacío, **no se renderiza** la
sección de eventos (ni el artículo, ni el fallback textual actual). Las stat-cards generales del
dashboard no se ven afectadas.

### D9 — Jerarquía y exclusión mutua Líder ↔ Supervisor

El Sponsor estableció la jerarquía de roles de cobertura: **Líder está por debajo de Supervisor**
("líder y después supervisor"). En consecuencia, **un mismo usuario no puede ser Líder y
Supervisor a la vez**: los dos roles son **mutuamente excluyentes**.

Esto no generaliza a otras combinaciones (Profesor+Pastor, Pastor+Supervisor, etc. siguen
siendo combinables como hoy). La restricción es únicamente entre `Lider` y `Supervisor`.

Implementación:

- **Backend** (`backend/src/routes/user-profile.routes.ts`): el validador `body().custom(...)`
  de `POST /` y `PUT /:id` rechaza con `400` si `roleNames` contiene simultáneamente `"Lider"`
  y `"Supervisor"`. Mensaje: "Un usuario no puede ser Líder y Supervisor al mismo tiempo
  (jerarquía: Líder luego Supervisor)".
- **Frontend** (`frontend/src/components/dashboard/MemberForm.tsx`): el `Select` de roles
  (multi-selección) hace la exclusión visualmente — al marcar `Lider` se desmarca
  `Supervisor` y viceversa — más una nota de ayuda explicando la jerarquía. El envío al backend
  nunca contiene ambos.
- **`PRIMARY_ROLE_PRIORITY`** (`backend/src/controller/user-profile.controller.ts`): se añade
  `"Lider"` a la lista de prioridad (entre `Profesor` y `Miembro`) para que `resolvePrimaryRole`
  sea determinista cuando un perfil tiene solo el rol `Lider`. Al ser mutuamente excluyentes con
  `Supervisor`, el orden relativo entre ambos no genera ambigüedad.

Esta regla **deroga el hallazgo N4** del informe del `quality-engineer` (el caso "Supervisor +
Lider" no puede ocurrir por construcción; la lógica `isLiderOnly`/`isSupervisorOnly` del
`Dashboard.tsx` y `Sidebar.tsx` ya es correcta bajo esta premisa).

## Consecuencias

### Positivas

- Se corrige la ruta rota `/life-groups` (página `MyCoverage` inexistente).
- El líder gana un espacio dedicado y simple para llevar asistencia y ofrendas de su grupo.
- Se elimina deuda técnica (predicas) que el Sponsor no quiere mantener aún, conservando un
  apuntador visual para reactivarla.
- El dashboard deja de mostrar eventos pasados irrelevantes.
- El badge de "Miembro" deja de ser redundante para pastores/profesores/supervisores bautizados.

### Negativas / trade-offs

- El rol `Lider` es un rol más para gestionar (creación por admin, activación por correo).
- Las sesiones embebidas en `LifeGroup` limitan el volumen por documento; si un grupo acumula
  cientos de sesiones habrá que migrar a colección separada (ADR futuro).
- La retirada de predicas es destructiva: si se reactiva, habrá que reconstruir backend y
  frontend. El placeholder solo conserva la entrada del menú, no el código.
- La interpretación del placeholder "en los reportes" puede requerir ajuste si el Sponsor refuta.

## Alternativas consideradas

- **(a) Crear al líder on-the-fly al registrar el grupo (sin rol previo)**.
  Rechazado: rompe el patrón existente de asignación de roles con acceso (email + activación) y
  mezcla responsabilidades del supervisor con las del admin. Se conserva el flujo: admin crea el
  líder, supervisor lo asigna.
- **(b) Colección separada `LifeGroupSession`**.
  Rechazado por ahora (ver D3): a esta escala el embebido es más simple. Queda como ADR futuro si
  crece el volumen.
- **(c) Eliminar predicas sin placeholder**.
  Rechazado: el Sponsor pidió dejarlo inhabilitado para retomarlo más adelante.
- **(d) Filtrar eventos pasados en backend**.
  Rechazado: el backend de eventos ya se usa para historial/reportes anuales; el filtro de
  "actuales" es una necesidad del dashboard (presentación), no de la API. Se filtra en frontend.

## Excepción temporal (declarada por el Chief Architect)

`AGENTS.md` §9 exige `npm run lint` y `npm run typecheck` verdes. La presente feature cumple en
los archivos que toque. Subsiste la **excepción temporal heredada de ADR-0010** sobre drifts
preexistentes en `Sidebar.tsx` (uso de `any`), `auth.tsx`, `Profile.tsx` y
`user-profile.controller.ts`. Esta feature añade items a `Sidebar.tsx`; el agente editor debe
preservar el estilo existente sin agravar el drift, y la excepción sigue caducando cuando se
cierre esa deuda transversal.

## Estado de implementación (cierre)

La implementación de ADR-0011 se completó y verificó con `typecheck`, `lint` y `tests` verdes
en backend y frontend. Hitos por ola:

- **Ola 1**: badge de Miembros (D1), Dashboard con eventos actuales (D8), retirada de Predicas
  en backend y frontend (D7), y contrato de life-groups redactado por `api-contract-engineer`
  (D4, en `docs/api/life-groups-api.md`).
- **Ola 2**: rol `Lider` + modelo `LifeGroup` extendido (D2/D3), controller/routes/services de
  sesiones y ofrendas (D4/D5), páginas `MyCoverage` y `MyLifeGroup` + sidebar/router/tipos (D6),
  fix del contrato `session.attendeesPresent` (devolver sesión populada desde el grupo),
  revisión de estilos/a11y (`ui-design-engineer`), y fix crítico de `LOGIN_ENABLED_ROLES`
  backend para `Lider` (auditado por `auth-security-engineer`; el rol no estaba en las listas
  backend y bloqueaba el login del líder).
- **Ola 3**: pruebas y regresiones (`testing-engineer`), auditoría de coherencia
  (`quality-engineer`), documentación funcional (`doc-keeper`).

### Pruebas

- Backend: 260 tests pasan (13 archivos); cobertura global ~99%. Incluye
  `tests/routers/life-group.routes.smoke.test.ts` (39 tests) y
  `tests/routers/sermon-removal.test.ts`.
- Frontend: 43 tests pasan (5 archivos). Incluye regresión del badge "Miembro" en
  `Members.test.tsx` (3 casos: bautizado con rol elevado sin badge, bautizado solo-Miembro con
  badge, no bautizado sin cambio).

### Gaps de cobertura (backlog de `testing-engineer`)

Se intentaron y se descartaron por complejidad de mocking sin romper la suite; quedan como deuda
de pruebas futuras:

- `frontend/src/pages/Dashboard.test.tsx` — regresión de eventos actuales (requiere mock de
  router context para `Link`/`Navigate`).
- `frontend/src/api/LifeGroupAPI.test.ts` — parsing Zod de las funciones de sesión.
- `frontend/src/api/SermonRemoval.test.ts` — guard de ausencia de `SermonAPI` (la retirada queda
  cubierta por el backend `sermon-removal.test.ts`).
- `backend/tests/services/life-group.service.test.ts` — unit test profundo del servicio (la
  lógica queda ejercida vía el smoke test de rutas, pero sin aserciones unitarias aisladas).

### Hallazgos no bloqueantes (backlog, del `quality-engineer`)

- **N1** (mayor): `LOGIN_ENABLED_ROLES` duplicado en `backend/src/utils/auth.utils.ts` y
  `backend/src/routes/user-profile.routes.ts`. Deben mantenerse sincronizados; idealmente
  centralizar. Análogo frontend: `MemberForm.LOGIN_ENABLED_ROLES` y `Members.rolesWithAccess`.
- **N2** (resuelto): mensaje stale en `user.controller.ts` corregido a
  "Este usuario no tiene un rol con acceso al login".
- **N3** (menor): `Sidebar.tsx` `icon: any` — drift heredado (excepción ADR-0010/0011).
- **N4** (invalidado por D9): un usuario con ambos roles `Supervisor` + `Lider` ya no puede
  existir por construcción (exclusión mutua D9). La lógica `isLiderOnly`/`isSupervisorOnly` del
  `Dashboard.tsx` y `Sidebar.tsx` es correcta bajo esa premisa.
- **N5** (menor): `leader`/`type` opcionales en la interfaz TS de `life-group.model.ts` (patrón
  transición). Ahora que el controller siempre los provee, pueden restringirse a required.
- **N6** (nit): los subdocumentos de sesión tienen `timestamps: true` y devuelven
  `createdAt`/`updatedAt` que el `lifeGroupSessionSchema` del frontend no declara (Zod los
  descarta; alinear el contrato evita datos ocultos).
- **Hardening (audit D-auth)**: rate-limit específico para mutaciones de life-groups (hoy cubierto
  por el limiter global 100/min de `/api/*`); sanitización de texto libre
  (`name`/`neighborhood`/`address`/`notes`); validación de que `supervisor` body (admin) sea un
  perfil con rol `Supervisor`.

### Ambigüedad pendiente de validación

La frase del Sponsor "en los reportes, dejámelo como próximamente e inhabilitado" se interpretó
como placeholder en el menú lateral del admin (patrón existente de "Ofrendas"). Pendiente de
confirmación por el Sponsor; si refuta, se ajusta el destino del placeholder en una corrección
menor.

## Referencias

- `AGENTS.md` §3 (estructura: controladores, servicios, rutas, cliente API por módulo).
- `AGENTS.md` §4 (nomenclatura: rutas `/api/<recurso-plural>`, roles).
- `AGENTS.md` §5 (manejo de datos, soft-delete, auditoría `[AUDIT-PENDING]`).
- `AGENTS.md` §6 (roles y permisos del ecosistema; `api-contract-engineer` autoridad de contrato).
- `AGENTS.md` §7 (flujo canónico de feature end-to-end).
- `docs/api/life-groups-api.md` — contrato API vigente del módulo.
- `backend/src/models/life-group.model.ts`, `backend/src/models/role.model.ts`,
  `backend/src/config/seed.ts`.
- `frontend/src/pages/members/Members.tsx`, `frontend/src/pages/Dashboard.tsx`,
  `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/router.tsx`.
