# ADR-0022 — Nuevo catálogo oficial de ministerios (14) con fuente única y migración

- **Estado**: Aceptado (implementado)
- **Fecha**: 2026-09-15
- **Custodio**: `chief-architect`
- **Tema**: Actualización de datos maestros — reemplazo del catálogo de ministerios
  (10 → 14 valores), eliminación de duplicación (5 fuentes), migración de valores
  legacy en `UserProfile` y tolerancia de alias en el bulk import desde Google Forms.
- **Flujo**: Feature end-to-end abreviada + auditorías. Sin cambios de forma de
  payloads (solo valores de enum).

## Contexto

Reporte del usuario (lista de 14 ministerios, transcripción literal):

> Ministerio de alabanza, Ministerio de danza, Ministerio de audiovisuales,
> Ministerio de varones, Ministerio de jóvenes, Ministerio de parejas y familia,
> Ministerio de mujeres, Ministerio de evangelismo y consolidación, Funda Esperanza,
> Ministerio de servidores, Ministerio infantil, Ministerio de oración e
> intercesión, Ministerio de liberación, Ministerio de misericordia —
> *"Para asímismo actualizar mi google form"*.

Estado previo (verificado): la lista de 10 ministerios estaba **duplicada en 5
lugares** (`user-profile.model.ts`, `user-profile.routes.ts`,
`member-bulk-import.service.ts`, `types/index.ts` del frontend, `MemberForm.tsx`) y
había datos legacy en Mongo con los valores antiguos.

## Decisión

### D1 — Lista oficial normalizada (14, Title Case)

El sponsor escribió los nombres en minúscula; se normalizan a **Title Case**
siguiendo la convención visual existente del catálogo anterior ("Ministerio de
Alabanza"):

1. Ministerio de Alabanza
2. Ministerio de Danza
3. Ministerio de Audiovisuales
4. Ministerio de Varones
5. Ministerio de Jóvenes
6. Ministerio de Parejas y Familia
7. Ministerio de Mujeres
8. Ministerio de Evangelismo y Consolidación
9. Funda Esperanza
10. Ministerio de Servidores
11. Ministerio Infantil
12. Ministerio de Oración e Intercesión
13. Ministerio de Liberación
14. Ministerio de Misericordia

### D2 — Fuente única por capa (fin de la duplicación)

- **Backend**: `export const MINISTRIES` en `user-profile.model.ts` (enums del
  esquema, validadores `isIn` de `user-profile.routes.ts` y el bulk import la
  importan).
- **Frontend**: `ministrySchema` (zod) en `types/index.ts` + `export const
  MINISTRIES = ministrySchema.options` (derivado — `MemberForm.ts` importa).

### D3 — Migración idempotente y no destructiva de valores legacy

`backend/src/config/migrations/20260915-ministries-rename.ts`
(`npm run migrate:ministries-rename`): renombra en `ministry` y `ministryInterest`
de `UserProfile` los 5 valores cuyo nombre cambió (los otros 5 se mantienen):

| Legacy | Oficial |
| --- | --- |
| Ministerio de Danza (Niñas entre 7 y 14 años) | Ministerio de Danza |
| Ministerio de Hombres | Ministerio de Varones |
| Ministerio de Parejas y Familias | Ministerio de Parejas y Familia |
| Ministerio Iglesia Infantil | Ministerio Infantil |
| Ministerio de Evangelismo y Consolidación G.V.E | Ministerio de Evangelismo y Consolidación |

Idempotente (re-ejecutar no rompe), no destructiva (no toca valores válidos/null),
reporta conteos por mapeo.

### D4 — Alias legacy en el bulk import (transición del Google Form)

`LEGACY_MINISTRY_ALIASES` en `member-bulk-import.service.ts`: antes de validar,
los valores de las columnas "Ministerio en el que sirve" / "Ministerio de interes"
se normalizan (trim + alias). Así los **exports viejos del Google Form del sponsor**
siguen importando correctamente mientras actualiza las opciones de su formulario a
la lista nueva. Valores realmente inválidos siguen produciendo el error existente.

### D5 — Orden de despliegue recomendado

Desplegar código nuevo → ejecutar la migración de inmediato. Motivo: el enum nuevo
de Mongoose valida en **escritura**: entre deploy y migración, un update de perfil
con valor legacy fallaría; la lectura no se ve afectada. La ventana debe ser mínima.

## Implementación

- Modelo/fuente única + migración + 2 tests de migración (database-engineer).
- Rutas validadoras + bulk import con alias + fixtures de mocks (backend-engineer).
- `ministrySchema` + `MINISTRIES` + `MemberForm` (frontend-engineer).
- Docs: `docs/api/members-bulk-import.md`, `docs/functional/members-bulk-import.md`,
  ejemplo corregido en `docs/api/life-groups-api.md` (doc-keeper).
- Tests: +casos de alias legacy en bulk import y sanity del catálogo (14 únicos,
  sin legacy). Estado final: **backend 406 passed, frontend 176 passed**, lint y
  typecheck limpios.

## Consecuencias

### Positivas

- El catálogo refleja la organización real de la iglesia (14 ministerios, incluidos
  Audiovisuales, Funda Esperanza, Liberación y Misericordia).
- Una sola fuente por capa: próximos cambios de catálogo = 1 archivo por lado.
- El histórico del Google Form no se pierde: los alias cubren la transición.

### Negativas / trade-offs

- El sponsor debe actualizar las opciones de su Google Form a la lista nueva
  (mientras tanto, los alias mantienen la compatibilidad de importación).
- Renombres de nombre propio ("Hombres"→"Varones"): son visibles en UI para
  miembros existentes tras la migración (comunicar en la iglesia si aplica).

## Alternativas consideradas

- **Mantener los 10 valores viejos como válidos adicionales**: descartada — catálogo
  sucio y contradice el pedido explícito de "actualizar la lista".
- **Migración destructiva / reemplazo masivo**: descartada — se exige idempotencia y
  no destructividad (patrón del repo en migraciones previas).

## Riesgos vigilados

- Ejecutar la migración tarde (ventana deploy→migración con writes legacy
  bloqueados) — mitigado por D5 y por los alias del bulk import.
- El bulk import acepta alias SOLO en importación; los endpoints REST de
  user-profile exigen valores oficiales (correcto: escritura canónica).

## Referencias

- `backend/src/models/user-profile.model.ts` (`MINISTRIES`),
  `config/migrations/20260915-ministries-rename.ts`.
- `backend/src/services/member-bulk-import.service.ts` (`LEGACY_MINISTRY_ALIASES`).
- `frontend/src/types/index.ts` (`ministrySchema`, `MINISTRIES`).
- `docs/api/members-bulk-import.md`, `docs/functional/members-bulk-import.md`.

---

## Addendum (2026-09-16) — Incidencia 002: ventana deploy→migración abierta causó "todo en 0"

### Síntoma

Tras desplegar el nuevo catálogo, el admin entraba y el Dashboard mostraba todos
los contadores en 0 ("como si no hubiera registro de nada"), con la BD aparentemente
"sin cargar".

### Cadena de causa raíz

1. El despliegue actualizó `ministrySchema` (zod, frontend) a los 14 ministerios
   oficiales, pero **no se ejecutó la migración** dentro de la ventana (riesgo D5).
2. Los perfiles existentes conservaban valores legacy (2 × "Ministerio de
   Evangelismo y Consolidación G.V.E", 1 × "Ministerio de Hombres").
3. El backend sirve los valores sin validar enum en **lectura** (Mongoose solo
   valida en escritura) → las respuestas llegaban con valores legacy.
4. El frontend valida cada respuesta con zod → `ministrySchema` rechazó los
   valores legacy → las queries de miembros (y asignaciones, que poblán miembros)
   fallaron **silenciosamente** → el Dashboard cayó a sus defaults `[]` → todo en 0.

Diagnóstico del arquitecto: sondeo directo del backend (todos los endpoints 200 con
datos reales) descartó BD/servidor y localizó el fallo en la capa de validación
cliente. Verificación en BD: 3 de 4 perfiles con valores legacy.

### Resolución

- Ejecutada `npm run migrate:ministries-rename`: 3 documentos renombrados
  (2 `ministry`, 1 `ministryInterest`). Re-verificado: 0 valores legacy.
- `migrate:notifications-recipient-user` ejecutada como no-op (colección vacía).
- Re-sondeo: todos los endpoints 200 con datos. Sin cambios de código.

### Lecciones

- **D5 es operativo, no opcional**: desplegar catálogos/contratos exige ejecutar la
  migración en la misma ventana. Checklist de despliegue pendiente (backlog
  devops-engineer).
- **Backlog de resiliencia frontend**: una query fallida no debe parecer "sin datos".
  Candidatos: superficie de errores en el Dashboard (toast/banner "no pudimos cargar
  X") o schema de lectura tolerante con normalización de alias legacy en cliente
  (decisión de contrato: `api-contract-engineer`).
