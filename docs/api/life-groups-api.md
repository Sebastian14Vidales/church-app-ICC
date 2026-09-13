# Contrato API del módulo de Grupos de Vida — `EPC-LIFE-GROUPS-001`

> **Estado**: Vigente (ADR-0011; asignación explícita de supervisor en POST según ADR-0015;
> endpoint de roster del líder según ADR-0018).
> **Autoridad**: `api-contract-engineer` (única fuente de verdad sobre la forma de los payloads).
> **Fuentes**: `AGENTS.md` (§3, §4, §5, §6, §8), `docs/adr/0011-life-groups-leader-remove-predicas-ui-tweaks.md`,
> `docs/adr/0015-life-groups-supervisor-assignment.md`,
> `docs/adr/0018-life-groups-attendees-leader-owned.md`,
> `backend/src/models/life-group.model.ts`, `frontend/src/api/LifeGroupAPI.ts`.
> **Consumidores**: `database-engineer`, `backend-engineer`, `auth-security-engineer`,
> `frontend-engineer`, `testing-engineer`, `quality-engineer`.
> **Última revisión**: 2026-09-12

Este documento **es la única especificación normativa** de los endpoints del módulo de Grupos de Vida
para el alcance del ADR-0011. Cualquier divergencia entre este contrato y el código se considera
drift y debe resolverse ajustando el código (no este documento) o, si el cambio es intencional,
actualizando este documento previa aprobación del `chief-architect`.

No se incluye OpenAPI YAML formal por ahora (no existe convención previa en el repo). Este
`life-groups-api.md` es el artefacto de contrato de este módulo.

---

## 0. Convenciones generales

- Prefijo común de todos los endpoints del módulo: `/api/life-groups`.
  Un solo router Express: `backend/src/routes/life-group.routes.ts`.
- Autenticación: todos los endpoints exigen `authenticate` (JWT).
- Identificadores en path: siempre MongoId (`:id` y `:sessionId` deben ser `isMongoId()`).
- Strings de error y de mensaje en **español** (AGENTS.md §1).
- Errores de validación de `express-validator` (`handleInputErrors`) se devuelven como
  `400 { errors: [...] }` (array del `validationResult`). Errores de negocio devueltos por
  los controladores se devuelven como `4xx { message: "..." }`.
- Formato de fechas en respuestas: ISO 8601 con offset (`.toISOString()`). El campo `date`
  de una sesión se transporta como `string` ISO.
- Sin `any`. Sin exponer hashes, passwords ni stack traces (AGENTS.md §8).
- Soft-delete: el modelo `LifeGroup` no implementa soft-delete en este ciclo.

---

## 1. Grupos de Vida — `LifeGroup`

> Recurso mongo: `LifeGroup`. Recurso API (plural, AGENTS.md §4): `life-groups`.

### Shape de base — `LifeGroup` (respuesta)

Todos los endpoints de lectura y mutación devuelven este shape poblado.

```jsonc
{
  "_id": "65a1...",
  "name": "Grupo de vida Esperanza",
  "neighborhood": "Centro",
  "address": "Calle 10 # 20-30",
  "supervisor": {
    "_id": "65a1...",
    "firstName": "Carlos",
    "lastName": "Martínez",
    "documentID": "1234567890",
    "birthdate": "1985-03-10T00:00:00.000Z",
    "neighborhood": "Centro",
    "phoneNumber": "3001234567",
    "bloodType": "O+",
    "baptized": true,
    "servesInMinistry": true,
    "ministry": "Ministerio de Hombres",
    "ministryInterest": null,
    "spiritualGrowthStage": "Consolidación",
    "role": { "_id": "role1", "name": "Supervisor" },
    "user": {
      "_id": "user1",
      "email": "carlos@example.com",
      "name": "Carlos Martínez",
      "confirmed": true,
      "active": true,
      "roles": [
        { "_id": "role1", "name": "Supervisor" }
      ]
    }
  },
  "leader": {
    "_id": "65b2...",
    "firstName": "Ana",
    "lastName": "López",
    "documentID": "0987654321",
    "birthdate": "1990-07-22T00:00:00.000Z",
    "neighborhood": "Norte",
    "phoneNumber": "3109876543",
    "bloodType": "A+",
    "baptized": true,
    "servesInMinistry": false,
    "ministry": null,
    "ministryInterest": null,
    "spiritualGrowthStage": "Discipulado básico",
    "role": { "_id": "role2", "name": "Lider" },
    "user": {
      "_id": "user2",
      "email": "ana@example.com",
      "name": "Ana López",
      "confirmed": true,
      "active": true,
      "roles": [
        { "_id": "role2", "name": "Lider" }
      ]
    }
  },
  "type": "life-group",
  "attendees": [
    {
      "_id": "65c3...",
      "firstName": "Pedro",
      "lastName": "Gómez",
      "documentID": "1122334455",
      "birthdate": "1988-01-15T00:00:00.000Z",
      "neighborhood": "Sur",
      "phoneNumber": "3201112233",
      "bloodType": "B+",
      "baptized": true,
      "servesInMinistry": false,
      "ministry": null,
      "ministryInterest": null,
      "spiritualGrowthStage": "Consolidación",
      "role": { "_id": "role3", "name": "Miembro" },
      "user": null
    }
  ],
  "sessions": [
    {
      "_id": "session1",
      "date": "2026-08-10T19:00:00.000Z",
      "weekNumber": 1,
      "attendeesPresent": [
        {
          "_id": "65c3...",
          "firstName": "Pedro",
          "lastName": "Gómez",
          "documentID": "1122334455",
          "birthdate": "1988-01-15T00:00:00.000Z",
          "neighborhood": "Sur",
          "phoneNumber": "3201112233",
          "bloodType": "B+",
          "baptized": true,
          "servesInMinistry": false,
          "ministry": null,
          "ministryInterest": null,
          "spiritualGrowthStage": "Consolidación",
          "role": { "_id": "role3", "name": "Miembro" },
          "user": null
        }
      ],
      "offeringAmount": 50000,
      "notes": "Reunión de bienvenida y presentación."
    }
  ],
  "createdAt": "2026-08-01T10:00:00.000Z",
  "updatedAt": "2026-08-10T21:00:00.000Z"
}
```

> **Nota**: `supervisor`, `leader`, `attendees` y `sessions.attendeesPresent` usan el **mismo
> sub-shape de miembro** (el subset poblado que hoy usa `lifeGroupSchema.supervisor` en
> `frontend/src/types/index.ts`). No se exponen campos sensibles.
>
> **Nota sobre `spiritualGrowthStage`**: el perfil de miembro admite `"Ninguna"` además de
> las 7 etapas canónicas (ver ADR-0014). Los ejemplos JSON muestran etapas reales, pero el
> campo poblado puede contener `"Ninguna"`.

---

### 1.1 `GET /api/life-groups` — Listado role-aware

- **Roles**: `["Supervisor", "Admin", "Superadmin", "Lider"]`.
- **Comportamiento**:
  - `Admin` / `Superadmin`: devuelve **todos** los grupos, completamente poblados.
  - `Supervisor`: devuelve los grupos donde `supervisor == req.auth.profileId`.
  - `Lider`: devuelve un array de **0 o 1** grupo donde `leader == req.auth.profileId`.
- **Query params**: ninguno en este ciclo.
- **Orden**: por `name` ascendente (estable).
- **Respuesta 200** — `LifeGroup[]` (array plano).

```jsonc
[
  { /* LifeGroup shape */ },
  { /* LifeGroup shape */ }
]
```

- **Errores**:
  - `401 { message: "No autorizado" }` — token ausente o inválido.
  - `403 { message: "No tienes permisos para esta acción" }` — rol no incluido.
  - `500 { message: "Error al obtener grupos de vida" }`

---

### 1.2 `POST /api/life-groups` — Crear grupo

- **Roles**: `["Supervisor", "Admin", "Superadmin"]`.
- **Body**:

| Nombre         | Tipo                               | Requerido | Notas                                                                    |
| -------------- | ---------------------------------- | --------- | ------------------------------------------------------------------------ |
| `name`         | string                             | sí        | Nombre del grupo.                                                        |
| `neighborhood` | string                             | sí        | Barrio o sector.                                                         |
| `address`      | string                             | sí        | Dirección de reunión.                                                    |
| `leader`       | string (MongoId)                   | sí        | `profileId` del líder. Debe tener rol `Lider`.                           |
| `type`         | `"life-group"` \| `"couple-group"` | sí        | `life-group` = semanal; `couple-group` = mensual.                        |
| `attendees`    | string[] (MongoId[])               | opcional  | Lista de `profileId` de asistentes. Si se omite, el backend asume `[]`.  |
| `supervisor`   | string (MongoId)                   | obligatorio para `Admin`/`Superadmin`; omitido/auto-asignado para `Supervisor` | Solo `Admin`/`Superadmin` deben enviarlo; si falta: `400 { message: "Debes seleccionar el supervisor responsable" }`. Si el creador es `Supervisor`, el campo se ignora y se auto-asigna a sí mismo (ADR-0015 D1). |

- **Validaciones**:
  - `name`, `neighborhood`, `address`: no vacíos.
  - `leader`: MongoId válido; el `UserProfile` referenciado debe existir y su usuario debe tener el rol `Lider`.
  - `attendees`: opcional. Si se envía, cada id debe ser MongoId válido y existir como `UserProfile`; si se omite, el backend asume `[]`.
  - `type`: valor en enum `["life-group", "couple-group"]`.
  - `supervisor`: obligatorio para creadores `Admin`/`Superadmin`; si falta, `400 { message: "Debes seleccionar el supervisor responsable" }`. Si se envía, MongoId válido y solo permitido para `Admin`/`Superadmin`. Para creadores `Supervisor` el campo se ignora y se auto-asignan (ADR-0015 D1).
  - Un perfil solo puede ser líder de **un** grupo (unicidad a nivel aplicación).

- **Respuesta 201** — `{ message: string, lifeGroup: LifeGroup }`.

```jsonc
{
  "message": "Grupo de vida creado correctamente",
  "lifeGroup": { /* LifeGroup shape */ }
}
```

- **Errores**:
  - `400 { errors: [...] }` — errores de `express-validator` (campos faltantes o mal formados).
  - `400 { message: "El líder seleccionado no tiene el rol Lider" }`
  - `400 { message: "El líder ya dirige otro grupo de vida" }`
  - `400 { message: "Uno o más asistentes no existen" }`
  - `400 { message: "Tipo de grupo inválido" }`
  - `400 { message: "Debes seleccionar el supervisor responsable" }` — creador `Admin`/`Superadmin` no envió `supervisor`.
  - `401 { message: "No autorizado" }`
  - `403 { message: "No tienes permisos para esta acción" }`
  - `500 { message: "Error al crear el grupo de vida" }`

> **Nota operativa (post-deploy)**: ejecutar el script de solo lectura
> `backend/src/config/verify-life-groups.ts` para diagnosticar cobertura por supervisor,
> asignaciones sospechosas (supervisor sin rol `Supervisor`), líderes sin rol `Lider` y grupos
> huérfanos antes de entregar credenciales a los supervisores (ADR-0015 D3).

---

### 1.3 `PATCH /api/life-groups/:id` — Editar metadatos

- **Roles / pertenencia**:
  - `Admin` / `Superadmin`.
  - `Supervisor` del grupo (`group.supervisor == req.auth.profileId`).
  - El rol `Lider` **no** puede usar este endpoint.
- **Path**: `id` MongoId.
- **Body** (todos opcionales):

| Nombre         | Tipo                               | Requerido | Notas                                                  |
| -------------- | ---------------------------------- | --------- | ------------------------------------------------------ |
| `name`         | string                             | opcional  |                                                        |
| `neighborhood` | string                             | opcional  |                                                        |
| `address`      | string                             | opcional  |                                                        |
| `type`         | `"life-group"` \| `"couple-group"` | opcional  |                                                        |
| `leader`       | string (MongoId)                   | opcional  | Debe cumplir las mismas reglas que en creación.        |
| `supervisor`   | string (MongoId)                   | opcional  | Solo `Admin`/`Superadmin`; se usa para reasignar cobertura y reparar datos mal asignados (ADR-0015 D3). |

> ⚠️ **Breaking change menor pre-lanzamiento (ADR-0018 D2)**: este endpoint ya no acepta
> `attendees`. El roster tiene una única vía canónica: `PATCH /api/life-groups/:id/attendees`.
> El `POST /api/life-groups` conserva `attendees` opcional para seed/scripts; la UI de cobertura
> deja de enviarlo.

- **Validaciones**:
  - Mismas reglas de `leader`, `type` y `supervisor` que en creación.

- **Respuesta 200** — `{ message: string, lifeGroup: LifeGroup }`.

```jsonc
{
  "message": "Grupo de vida actualizado correctamente",
  "lifeGroup": { /* LifeGroup shape */ }
}
```

- **Errores**:
  - `400 { errors: [...] }` — `id` no es MongoId válido o body inválido.
  - `400 { message: "El líder seleccionado no tiene el rol Lider" }`
  - `400 { message: "El líder ya dirige otro grupo de vida" }`
  - `403 { message: "No tienes permisos para esta acción" }`
  - `404 { message: "Grupo de vida no encontrado" }`
  - `500 { message: "Error al actualizar el grupo de vida" }`

---

### 1.4 `PATCH /api/life-groups/:id/attendees` — Actualizar roster de asistentes (ADR-0018)

- **Roles / pertenencia**:
  - **Líder del grupo** (`group.leader == req.auth.profileId`). **Novedad**: el líder ahora es
    el gestor natural del roster de su propio grupo.
  - `Supervisor` del grupo (`group.supervisor == req.auth.profileId`).
  - `Admin` / `Superadmin`.
- **Path**: `id` MongoId.
- **Body** (requerido):

| Nombre      | Tipo                 | Requerido | Notas                                                                 |
| ----------- | -------------------- | --------- | --------------------------------------------------------------------- |
| `attendees` | string[] (MongoId[]) | sí        | Reemplaza la lista completa de asistentes del grupo. Puede ser vacío. |

```jsonc
{
  "attendees": ["65c3...", "65d4..."]
}
```

- **Validaciones**:
  - `attendees` debe ser un array (puede estar vacío).
  - Cada id debe ser MongoId válido.
  - Cada id debe existir como `UserProfile`.
  - **Rol elegible**: cada perfil debe tener `role.name` igual a `"Asistente"` o `"Miembro"`.
    Si algún id no cumple, `400 { message: "Uno o más asistentes no tienen un rol elegible" }`.
  - La regla de rol elegible aplica **solo a escrituras nuevas**; no se migra ni revalida
    roster legacy existente (decisión ADR-0018, ver §5.1).
  - Si el roster se reduce, las sesiones históricas **no** se revalidan; los `attendeesPresent`
    de sesiones pasadas se conservan tal cual. El frontend muestra la asistencia histórica
    con el roster vigente como denominador.

- **Respuesta 200** — `{ message: string, lifeGroup: LifeGroup }` (mismo shape que §1.3).

```jsonc
{
  "message": "Asistentes del grupo actualizados correctamente",
  "lifeGroup": { /* LifeGroup shape */ }
}
```

- **Errores**:
  - `400 { errors: [...] }` — `id` no es MongoId válido o `attendees` no es un array de MongoId.
  - `400 { message: "Uno o más asistentes no existen" }`
  - `400 { message: "Uno o más asistentes no tienen un rol elegible" }`
  - `403 { message: "No tienes permisos para esta acción" }`
  - `404 { message: "Grupo de vida no encontrado" }`
  - `500 { message: "Error al actualizar los asistentes del grupo" }`

---

## 2. Sesiones de grupo — `Session`

> Subdocumento embebido dentro de `LifeGroup.sessions` (ADR-0011 §D3).

### Shape de base — `Session` (respuesta)

```jsonc
{
  "_id": "session1",
  "date": "2026-08-10T19:00:00.000Z",
  "weekNumber": 1,
  "attendeesPresent": [
    { /* lifeGroupMember subset */ }
  ],
  "offeringAmount": 50000,
  "notes": "Reunión de bienvenida y presentación."
}
```

---

### 2.1 `POST /api/life-groups/:id/sessions` — Registrar sesión

- **Roles / pertenencia**:
  - El `Lider` del grupo (`group.leader == req.auth.profileId`).
  - `Supervisor` del grupo.
  - `Admin` / `Superadmin`.
- **Path**: `id` MongoId.
- **Body**:

| Nombre            | Tipo                 | Requerido | Notas                                                         |
| ----------------- | -------------------- | --------- | ------------------------------------------------------------- |
| `date`            | string (ISO 8601)    | sí        | Fecha/hora de la sesión.                                      |
| `attendeesPresent`| string[] (MongoId[]) | sí        | Debe ser subconjunto de `LifeGroup.attendees` (por `_id`).    |
| `offeringAmount`  | number (≥ 0)         | sí        | Ofrenda recogida. Permite `0`.                                |
| `notes`           | string               | opcional  | Observaciones de la sesión.                                   |

- **Validaciones**:
  - `date`: ISO 8601 válido.
  - `attendeesPresent`: cada id debe ser MongoId válido y pertenecer al roster actual del grupo.
  - `offeringAmount`: número mayor o igual a `0`.
  - `weekNumber`: se calcula automáticamente como `max(sessions.weekNumber) + 1`, o `1` si es la primera sesión.

- **Respuesta 201** — `{ message: string, session: Session, lifeGroup: LifeGroup }`.

```jsonc
{
  "message": "Sesión registrada correctamente",
  "session": { /* Session shape, weekNumber: 2 */ },
  "lifeGroup": { /* LifeGroup shape actualizado */ }
}
```

- **Errores**:
  - `400 { errors: [...] }` — campos faltantes o mal formados.
  - `400 { message: "La fecha de la sesión es inválida" }`
  - `400 { message: "Los asistentes presentes deben pertenecer al grupo" }`
  - `400 { message: "La ofrenda no puede ser negativa" }`
  - `403 { message: "No tienes permisos para esta acción" }`
  - `404 { message: "Grupo de vida no encontrado" }`
  - `500 { message: "Error al registrar la sesión" }`

---

### 2.2 `PATCH /api/life-groups/:id/sessions/:sessionId` — Editar sesión

- **Roles / pertenencia**: mismos que `2.1`.
- **Path**: `id` y `sessionId` MongoId.
- **Body** (todos opcionales):

| Nombre            | Tipo                 | Requerido | Notas                                                      |
| ----------------- | -------------------- | --------- | ---------------------------------------------------------- |
| `date`            | string (ISO 8601)    | opcional  |                                                            |
| `attendeesPresent`| string[] (MongoId[]) | opcional  | Subconjunto de `LifeGroup.attendees`.                      |
| `offeringAmount`  | number (≥ 0)         | opcional  |                                                            |
| `notes`           | string               | opcional  |                                                            |

- **Validaciones**: mismas que `2.1` para los campos enviados. `weekNumber` **no** se modifica.

- **Respuesta 200** — `{ message: string, session: Session, lifeGroup: LifeGroup }`.

```jsonc
{
  "message": "Sesión actualizada correctamente",
  "session": { /* Session shape */ },
  "lifeGroup": { /* LifeGroup shape actualizado */ }
}
```

- **Errores**:
  - `400 { errors: [...] }`
  - `400 { message: "Los asistentes presentes deben pertenecer al grupo" }`
  - `400 { message: "La ofrenda no puede ser negativa" }`
  - `403 { message: "No tienes permisos para esta acción" }`
  - `404 { message: "Grupo de vida no encontrado" }`
  - `404 { message: "Sesión no encontrada" }`
  - `500 { message: "Error al actualizar la sesión" }`

---

### 2.3 `DELETE /api/life-groups/:id/sessions/:sessionId` — Eliminar sesión

- **Roles / pertenencia**: mismos que `2.1`.
- **Path**: `id` y `sessionId` MongoId.
- **Body**: ninguno.
- **Respuesta 200** — `{ message: string, lifeGroup: LifeGroup }`.

```jsonc
{
  "message": "Sesión eliminada correctamente",
  "lifeGroup": { /* LifeGroup shape actualizado */ }
}
```

- **Errores**:
  - `400 { errors: [...] }` — `id` o `sessionId` no son MongoId válidos.
  - `403 { message: "No tienes permisos para esta acción" }`
  - `404 { message: "Grupo de vida no encontrado" }`
  - `404 { message: "Sesión no encontrada" }`
  - `500 { message: "Error al eliminar la sesión" }`

---

## 3. Schemas zod (contrato formal)

> Definidos contractualmente aquí. El `frontend-engineer` los materializa en
> `frontend/src/types/index.ts` y `frontend/src/api/LifeGroupAPI.ts`. Los schemas nuevos
> se añaden sin romper los existentes.

### 3.1 Helper `lifeGroupMemberSchema`

Sub-shape poblado compartido por `supervisor`, `leader`, `attendees` y
`sessions.attendeesPresent`. Es el mismo subset que usa `lifeGroupSchema.supervisor` hoy.

```ts
export const lifeGroupMemberSchema = memberSchema.pick({
  _id: true,
  firstName: true,
  lastName: true,
  documentID: true,
  birthdate: true,
  neighborhood: true,
  phoneNumber: true,
  bloodType: true,
  baptized: true,
  servesInMinistry: true,
  ministry: true,
  ministryInterest: true,
  spiritualGrowthStage: true,
  role: true,
  user: true,
});

export type LifeGroupMember = z.infer<typeof lifeGroupMemberSchema>;
```

### 3.2 `lifeGroupTypeSchema`

```ts
export const lifeGroupTypeSchema = z.enum(["life-group", "couple-group"]);
export type LifeGroupType = z.infer<typeof lifeGroupTypeSchema>;
```

### 3.3 `lifeGroupSessionSchema`

```ts
export const lifeGroupSessionSchema = z.object({
  _id: z.string(),
  date: z.string(),
  weekNumber: z.number().int().positive(),
  attendeesPresent: z.array(lifeGroupMemberSchema).default([]),
  offeringAmount: z.number().nonnegative(),
  notes: z.string().optional(),
});

export type LifeGroupSession = z.infer<typeof lifeGroupSessionSchema>;
```

### 3.4 `lifeGroupSchema` (extendido)

```ts
export const lifeGroupSchema = z.object({
  _id: z.string(),
  name: z.string(),
  neighborhood: z.string(),
  address: z.string(),
  supervisor: lifeGroupMemberSchema,
  leader: lifeGroupMemberSchema,
  type: lifeGroupTypeSchema,
  attendees: z.array(lifeGroupMemberSchema).default([]),
  sessions: z.array(lifeGroupSessionSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type LifeGroup = z.infer<typeof lifeGroupSchema>;
```

### 3.5 `lifeGroupsSchema`

```ts
export const lifeGroupsSchema = z.array(lifeGroupSchema);
```

### 3.6 `createLifeGroupResponseSchema`

```ts
export const createLifeGroupResponseSchema = z.object({
  message: z.string(),
  lifeGroup: lifeGroupSchema,
});
```

### 3.7 `createLifeGroupFormDataSchema`

Body de `POST /api/life-groups`. Incluye `supervisor` opcional a nivel de schema (Zod), pero el backend lo exige para creadores `Admin`/`Superadmin` y devuelve `400 { message: "Debes seleccionar el supervisor responsable" }` si falta; para creadores `Supervisor` el campo se ignora y se auto-asignan (ADR-0015 D1).

```ts
const objectIdStringSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const createLifeGroupFormDataSchema = z.object({
  name: z.string().min(1),
  neighborhood: z.string().min(1),
  address: z.string().min(1),
  leader: objectIdStringSchema,
  type: lifeGroupTypeSchema,
  attendees: z.array(objectIdStringSchema).default([]),
  supervisor: objectIdStringSchema.optional(),
});

export type CreateLifeGroupFormData = z.infer<typeof createLifeGroupFormDataSchema>;
```

### 3.8 `sessionFormDataSchema`

Body de `POST /api/life-groups/:id/sessions`. Para `PATCH` se usa `.partial()`.

```ts
export const sessionFormDataSchema = z.object({
  date: z.string().datetime(),
  attendeesPresent: z.array(objectIdStringSchema).default([]),
  offeringAmount: z.number().nonnegative(),
  notes: z.string().optional(),
});

export type SessionFormData = z.infer<typeof sessionFormDataSchema>;
```

### 3.9 `LifeGroupFormData` (actualización)

El tipo usado por el formulario de creación/edición de metadatos del grupo en el frontend.
Incluye `leader`, `type` y `supervisor` opcional; **no incluye `attendees`** (ADR-0018 D1).

```ts
export type LifeGroupFormData = {
  name: string;
  neighborhood: string;
  address: string;
  leader: string;
  supervisor?: string;
  type: LifeGroupType;
};
```

> **Nota**: el roster se gestiona exclusivamente vía `updateLifeGroupAttendees` contra
> `PATCH /api/life-groups/:id/attendees` (ADR-0018 D1/D2). La edición de metadatos puede
> tiparse como `Partial<LifeGroupFormData>`.

### 3.10 `updateLifeGroupAttendeesSchema`

Body de `PATCH /api/life-groups/:id/attendees` (ADR-0018 D2).

```ts
export const updateLifeGroupAttendeesSchema = z.object({
  attendees: z.array(objectIdStringSchema),
});

export type UpdateLifeGroupAttendeesInput = z.infer<typeof updateLifeGroupAttendeesSchema>;
```

La respuesta se valida con `createLifeGroupResponseSchema` (§3.6).

---

## 4. Cliente API esperado — `frontend/src/api/LifeGroupAPI.ts`

El `frontend-engineer` debe exponer estas funciones semánticas. Las funciones legacy se
conservan sin cambios de firma.

| Función                                   | Método + Ruta                                          | Return schema                         | Estado |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------- | ------ |
| `getLifeGroups()`                         | `GET /api/life-groups`                                 | `LifeGroup[]`                         | Extiende |
| `createLifeGroup(body)`                   | `POST /api/life-groups`                                | `{ message, lifeGroup: LifeGroup }`   | Extiende |
| `updateLifeGroup(id, body)`               | `PATCH /api/life-groups/:id`                           | `{ message, lifeGroup: LifeGroup }`   | Nuevo  |
| `updateLifeGroupAttendees(id, attendees)` | `PATCH /api/life-groups/:id/attendees`                 | `{ message, lifeGroup: LifeGroup }`   | Nuevo  |
| `addSession(lifeGroupId, data)`           | `POST /api/life-groups/:id/sessions`                   | `{ message, session, lifeGroup }`     | Nuevo  |
| `updateSession(id, sessionId, body)`      | `PATCH /api/life-groups/:id/sessions/:sessionId`       | `{ message, session, lifeGroup }`     | Nuevo  |
| `deleteSession(id, sessionId)`            | `DELETE /api/life-groups/:id/sessions/:sessionId`      | `{ message, lifeGroup: LifeGroup }`   | Nuevo  |

---

## 5. Decisiones de naming y denominación

- ✅ Recurso API plural: `life-groups` (`/api/life-groups`), conforme a AGENTS.md §4.
- ✅ `type` usa valores kebab-case en inglés técnico (`life-group`, `couple-group`) para
  mantener consistencia con rutas y convenciones de código; las etiquetas de UI se traducen
  en el frontend ("Grupo de vida" / "Grupo de pareja").
- ✅ `weekNumber` es secuencial por grupo y se calcula en el backend; no se envía desde el cliente.
- ✅ `attendeesPresent` siempre se valida como subconjunto de `attendees` del grupo.
- ✅ `offeringAmount` aplica a cualquier tipo de sesión (semanal o mensual); no hay campo separado.
- ✅ Las sesiones son subdocumentos embebidos en `LifeGroup` (ADR-0011 §D3).

### 5.1 Decisión ADR-0018: rol elegible del roster

**Decisión**: SÍ se exige que cada id del roster tenga `role.name` igual a `"Asistente"` o
`"Miembro"` en escrituras nuevas de `PATCH /api/life-groups/:id/attendees`.

**Justificación**:
- Higiene de datos: el roster representa a las personas que asisten al grupo de vida como
  asistentes/miembros, no a líderes, supervisores, pastores ni administradores.
- Previene inclusiones accidentales de perfiles con otros roles que no deberían figurar como
  asistentes contables del grupo.
- Alinea el contrato con el dominio sin migrar datos legacy: los grupos existentes conservan
  su roster actual (incluso si contuviera perfiles no elegibles), pero toda escritura nueva
  debe cumplir la regla. Esto evita una migración riesgosa pre-lanzamiento y aplica la regla
  de forma progresiva.

---

## 6. Drift detectado entre contrato actual y contrato objetivo

Inventario puntual. Los ítems resueltos se marcan con ✅; los pendientes con ❌.

### 6.1 Backend — `life-group.model.ts` / `life-group.controller.ts` / `life-group.routes.ts`

- ✅ **D-01** El modelo `LifeGroup` debe extenderse con `leader`, `type`, `attendees` y `sessions` (ver `backend/src/models/life-group.model.ts`).
- ✅ **D-02** `GET /api/life-groups` debe filtrar por rol (`Admin`/`Superadmin`/`Supervisor`/`Lider`) (ver `backend/src/services/life-group.service.ts` `findMine`).
- ✅ **D-03** `POST /api/life-groups` debe aceptar `leader`, `type`, `attendees` y, para creadores `Admin`/`Superadmin`, exigir `supervisor`; para creadores `Supervisor`, auto-asignarse a sí mismo (ADR-0015 D1) (ver `backend/src/routes/life-group.routes.ts` POST `/` y `backend/src/services/life-group.service.ts` `createLifeGroup`).
- ✅ **D-04** `PATCH /api/life-groups/:id` debe permitir editar **solo metadatos**;
  ya no acepta `attendees` (breaking change menor ADR-0018 D2) (ver `backend/src/routes/life-group.routes.ts` PATCH `/:id` y `backend/src/services/life-group.service.ts` `UpdateLifeGroupBody`).
- ✅ **D-04b** Nuevo `PATCH /api/life-groups/:id/attendees` para reemplazo canónico del roster,
  con permiso para líder, supervisor y Admin/Superadmin, validación de ids y rol elegible
  (`Asistente`/`Miembro`) (ADR-0018 D2) (ver `backend/src/routes/life-group.routes.ts` PATCH `/:id/attendees` y `backend/src/services/life-group.service.ts` `updateAttendees`).
- ✅ **D-05** `POST /api/life-groups/:id/sessions` debe crear sesiones con `weekNumber` auto-computado (ver `backend/src/services/life-group.service.ts` `addSession`).
- ✅ **D-06** `PATCH /api/life-groups/:id/sessions/:sessionId` debe editar sesiones (ver `backend/src/routes/life-group.routes.ts` PATCH `/:id/sessions/:sessionId` y `backend/src/services/life-group.service.ts` `updateSession`).
- ✅ **D-07** `DELETE /api/life-groups/:id/sessions/:sessionId` debe eliminar sesiones (ver `backend/src/routes/life-group.routes.ts` DELETE `/:id/sessions/:sessionId` y `backend/src/services/life-group.service.ts` `deleteSession`).
- ✅ **D-08** Validar que `leader` tenga rol `Lider` y que `attendeesPresent` sea subconjunto de `attendees` (ver `backend/src/services/life-group.service.ts` `validateLeader` y `validateSessionBody`).

### 6.2 Frontend — `frontend/src/types/index.ts` / `LifeGroupAPI.ts`

- ✅ **D-09** Extender `lifeGroupSchema` con `leader`, `type`, `attendees`, `sessions` (ver `frontend/src/types/index.ts`).
- ✅ **D-10** Añadir `lifeGroupSessionSchema`, `lifeGroupTypeSchema`, `lifeGroupMemberSchema` (ver `frontend/src/types/index.ts`).
- ✅ **D-11** Actualizar `LifeGroupFormData` con `leader`, `type` (sin `attendees`; el roster se gestiona vía `PATCH /api/life-groups/:id/attendees` por ADR-0018 D1/D2) (ver `frontend/src/types/index.ts`).
- ✅ **D-12** Añadir `sessionFormDataSchema` y `createLifeGroupFormDataSchema` (ver `frontend/src/types/index.ts`).
- ✅ **D-13** Extender `LifeGroupAPI.ts` con `updateLifeGroup`, `updateLifeGroupAttendees`, `addSession`, `updateSession`, `deleteSession` (ver `frontend/src/api/LifeGroupAPI.ts`).

### 6.3 Roles

- ✅ **D-14** Añadir `Lider` al enum de roles en backend, seed y frontend (ADR-0011 §D2) (ver `backend/src/models/role.model.ts`, `backend/src/config/seed.ts`, `frontend/src/types/index.ts` y `frontend/src/utils/constants/roleColors.ts`).

### 6.4 Documentación

- ✅ **D-15** `docs/api/life-groups-api.md` existe y describe el contrato extendido.

---

## 7. Excepciones a AGENTS.md y temas a escalar al `Chief AI Architect`

1. **(E-1)** `GET /api/life-groups` se mantiene como **array plano** (`LifeGroup[]`) en este ciclo,
   sin envoltura paginada. El volumen esperado es bajo (un supervisor tiene pocos grupos; un líder
   solo uno). Si el volumen crece, se evaluará `PaginatedResponse` en una iteración futura.

2. **(E-2)** Las sesiones se modelan como **subdocumentos embebidos** en `LifeGroup` por decisión
   del ADR-0011 §D3. Si el volumen de sesiones crece, se migrará a una colección separada con un
   ADR posterior.

> **Bloqueantes detectados**: ninguno. Los drifts D-01..D-14 quedan resueltos en el árbol de trabajo actual.

---

## 8. Verificación de autosuficiencia del artefacto

Lista de comprobación para los implementadores:

- ✅ Cada endpoint tiene método, ruta, roles autorizados, body params con tipo/default,
  shape del 200, códigos 4xx con mensajes en español.
- ✅ Schemas zod están definidos textualmente en §3 (todo lo necesario para los TS types
  del frontend).
- ✅ Cliente API esperado en §4 con tabla nombre → ruta → schema return.
- ✅ Drift actual → objetivo en §6 — lista puntual numerada que cada dueño resuelve.
- ✅ Excepciones reportadas en §7. No se aplican excepciones sin ratificación.
- ✅ Mensajes de error en español, sin `any`, sin exponer hashes ni secretos.

---

_Fin del artefacto. Custodia: `api-contract-engineer`. Cualquier divergencia detectada
durante la implementación debe abrirse como nuevo drift en §6 (actualizando este documento)
y notificarse al `chief-architect`._
