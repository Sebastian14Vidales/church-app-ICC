# ADR-0015 — Asignación explícita de supervisor en grupos de vida (fix de cobertura invisible)

- **Estado**: Aceptado
- **Fecha**: 2026-09-09
- **Custodio**: `chief-architect`
- **Tema**: Incidencia — el rol `Supervisor` no visualiza los grupos de vida de su cobertura
- **Flujo**: Incidencia / bug (AGENTS.md §7). Diagnóstico de causa raíz por `chief-architect`;
  corrección delegada a los dueños de área.

## Contexto

Reporte del usuario: *"Al supervisor no le están saliendo los grupos de vida"*.

Cadena de causa raíz (verificada en código y contrato):

1. La visibilidad del Supervisor es `GET /api/life-groups` → `findMine` → filtra
   `supervisor == req.auth.profileId` (su cobertura). El menú "Mi cobertura" existe y el
   login emite el `profileId` correcto (UserProfile del usuario).
2. El formulario de "Mi cobertura" (`frontend/src/pages/coverage/MyCoverage.tsx`) **no
   expone el campo `supervisor`** al crear ni al editar.
3. El backend (`life-group.service.ts::createLifeGroup`) asigna por defecto el supervisor
   **al creador** cuando no se envía el campo — y el contrato lo documenta
   (`docs/api/life-groups-api.md`: "si no, se asigna al solicitante").
4. Consecuencia: todo grupo creado por `Admin`/`Superadmin` desde la UI queda con el
   **admin como supervisor**. El Supervisor real recibe una lista **vacía**.
5. El `PATCH` ya soporta reasignar `supervisor` (solo Admin), pero la UI tampoco lo expone,
   por lo que no hay forma de reparar los datos existentes desde la aplicación.

## Decisión

### D1 — Backend: supervisor obligatorio para creadores Admin

`createLifeGroup`: si el creador es `Admin`/`Superadmin`, el campo `supervisor` pasa a ser
**obligatorio** → `400 "Debes seleccionar el supervisor responsable"` si falta (fin del
auto- asignado silencioso, que era el footgun). Si el creador es `Supervisor`, se mantiene
la auto-asignación a sí mismo (sin cambio). Los no-admin siguen sin poder fijar el campo
(sin cambio). El validador de ruta mantiene `supervisor` opcional a nivel schema; la regla
condicional vive en el servicio (donde ya existe el patrón `AppError` + contexto de roles).

### D2 — Frontend: selector de supervisor y transparencia

En `MyCoverage.tsx`:

- Formulario de crear/editar: campo **"Supervisor responsable"** (Select con miembros con
  rol `Supervisor`), **requerido y visible solo para `Admin`/`Superadmin`**; se envía en el
  payload de create y update (reasignación). Los Supervisores no lo ven (backend los
  auto-asigna).
- Tarjeta de grupo: muestra el supervisor actual (`Supervisor: nombre`), para que el admin
  detecte asignaciones incorrectas de un vistazo.
- `LifeGroupFormData` gana `supervisor?: string` (el schema zod del body ya lo soporta).

### D3 — Reparación de datos guiada (sin migración ciega)

El mapeo grupo → supervisor correcto es **dato de negocio** que no se puede inferir; no se
escribe una migración automática. La reparación se hace por UI (D2: el admin reasigna).
Para guiarla, se añade el script de diagnóstico `backend/src/config/verify-life-groups.ts`
(mismo estilo que `verify-stages.ts`): agrupa grupos por supervisor y marca los grupos cuyo
supervisor **no tiene rol Supervisor** (los creados con el bug) y líderes sin rol Lider.

### D4 — El modelo de cobertura NO cambia

Se mantiene: `Supervisor` ve los grupos donde `supervisor == él`; `Admin`/`Superadmin` ven
todos; `Lider` ve el grupo que dirige. **No** se pasa a "supervisor ve todos los grupos":
rompería el modelo de cobertura y la jerarquía Líder → Supervisor.

## Cambios esperados

- `backend/src/services/life-group.service.ts`: regla D1 (create). Update sin cambios.
- `backend/tests/routers/life-group.routes.smoke.test.ts`: ajustes mínimos de mocks/esperas
  (el coverage nuevo lo añade `testing-engineer`).
- `frontend/src/types/index.ts`: `LifeGroupFormData.supervisor?: string`.
- `frontend/src/pages/coverage/MyCoverage.tsx`: D2.
- `backend/src/config/verify-life-groups.ts`: nuevo script de diagnóstico (D3).
- `docs/api/life-groups-api.md`: `supervisor` obligatorio para Admin/Superadmin en POST
  (400 si falta), nota de reasignación en PATCH, actualización de checks D-02/D-03.

## Consecuencias

### Positivas

- Se elimina la clase completa del bug (no solo el síntoma): ninguna vía (UI o API) puede
  crear grupos "huérfanos" de supervisor real.
- El admin puede reparar los datos existentes desde la UI, guiado por el script.
- Cambio de contrato realizado **antes del lanzamiento** (el mejor momento para breaking
  changes menores).

### Negativas / trade-offs

- Breaking change menor del API: `POST /api/life-groups` sin `supervisor` por parte de un
  Admin ahora devuelve 400 (antes 201 con auto-asignación). Consumidores externos (si los
  hubiere) deben ajustarse; en el repo el único consumidor es el frontend, que se adapta en
  el mismo cambio.
- Los grupos legacy mal asignados siguen invisibles para su supervisor real hasta que el
  admin los reasigne (tarea de arranque post-deploy, ver checklist de lanzamiento).

## Alternativas consideradas

- **Solo fix de frontend (enviar siempre supervisor desde la UI)**: descartada. El API
  conservaría el default silencioso y el bug reaparecería por cualquier otra vía (scripts,
  llamadas directas).
- **Supervisor ve todos los grupos**: descartada (D4). No resuelve la propiedad de los
  datos y rompe el modelo de cobertura.
- **Migración automática de datos**: descartada (D3). No se puede inferir el supervisor
  correcto por grupo.

## Riesgos vigilados

- Datos legacy: ejecutar `verify-life-groups.ts` tras el deploy y reasignar antes de
  entregar credenciales a los supervisores.
- Smoke tests de rutas que creen grupos como admin sin `supervisor`: deben actualizarse en
  el mismo cambio.
- `quality-engineer` verifica ausencia de drift al cierre (bug flow §7).

## Referencias

- `docs/adr/0011-life-groups-leader-remove-predicas-ui-tweaks.md` (diseño del módulo).
- `docs/api/life-groups-api.md` (contrato afectado).
- `backend/src/services/life-group.service.ts`, `backend/src/controller/life-group.controller.ts`,
  `backend/src/routes/life-group.routes.ts`.
- `frontend/src/pages/coverage/MyCoverage.tsx`, `frontend/src/api/LifeGroupAPI.ts`,
  `frontend/src/types/index.ts`.
- `backend/src/config/verify-stages.ts` (patrón del script de diagnóstico).
