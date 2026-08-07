# Contrato API del módulo de Eventos — `EPC-EVENTS-001`

> **Estado**: Vigente (paso 3 del ADR-0008).
> **Autoridad**: `api-contract-engineer` (única fuente de verdad sobre la forma de los payloads).
> **Fuentes**: `AGENTS.md` (§3, §4, §5, §8), `docs/adr/0008-events-history-excel.md`,
> `backend/src/models/event.model.ts`, `frontend/src/api/EventAPI.ts`.
> **Consumidores**: `database-engineer`, `backend-engineer`, `auth-security-engineer`,
> `frontend-engineer`, `testing-engineer`, `quality-engineer`.
> **Última revisión**: 2026-08-04

Este documento **es la única especificación normativa** de los endpoints del módulo de Eventos
para el alcance del ADR-0008. Cualquier divergencia entre este contrato y el código se considera
drift y debe resolverse ajustando el código (no este documento) o, si el cambio es intencional,
actualizando este documento previa aprobación del `chief-architect`.

No se incluye OpenAPI YAML formal por ahora (no existe convención previa en el repo). Este
`events-api.md` es el artefacto de contrato de este módulo. Cuando existan al menos
tres módulos documentados, el `chief-architect` decidirá la convención final.

---

## 0. Convenciones generales

- Prefijo común de todos los endpoints del módulo: `/api/events`.
  Un solo router Express: `backend/src/routes/event.routes.ts`.
- Autenticación: todos los endpoints exigen `authenticate` (JWT).
  - Listados (`GET /api/events`, `/api/events/history`): cualquier rol autenticado.
  - Exportación Excel (`GET /api/events/:id/export/registrations`): `ADMIN_ROLES`
    (`["Admin", "Superadmin"]`). El endpoint respeta el mismo `authorizeRoles` que el resto
    del router de eventos (ADR-0008 §D5).
- Identificadores en path: siempre MongoId (`/api/events/:id`, `:id` debe ser `isMongoId()`).
- Strings de error y de mensaje en **español** (AGENTS.md §1).
- Errores de validación de `express-validator` (`handleInputErrors`) se devuelven como
  `400 { errors: [...] }` (array del `validationResult`). Errores de negocio devueltos por
  los controladores se devuelven como `4xx { message: "..." }`.
- Formato de fechas en respuestas: ISO 8601 con offset (`.toISOString()`). El campo `time`
  se transporta como `string` con el formato libre almacenado (hoy `"HH:mm"`).
- Sin `any`. Sin exponer hashes, passwords ni stack traces (AGENTS.md §8).
- Soft-delete: el modelo `Event` no implementa soft-delete en este ciclo; los eventos se
  eliminan físicamente si aplica (comportamiento heredado). Si se introduce `deletedAt` en
  una épica futura, todas las consultas deben filtrarlo.
- El campo `isPast` es **derivado** en el backend a partir de `date` + `time`; no se persiste
  en MongoDB (ADR-0008 §D1). El frontend lo consume tal cual llega.
- Realtime: no se añaden nuevas invalidaciones en este ciclo; el listado de eventos se
  actualiza por las mismas keys existentes del módulo (`events.changed` si existiera, o por
  re-fetch manual tras mutaciones).

---

## 1. Eventos — `Event`

> Recurso_mongo: `Event`. Recurso API (plural, AGENTS.md §4): `events`.

### Shape de base — `Event` (respuesta)

Todos los endpoints de lectura de eventos devuelven este shape. El único campo nuevo
respecto al contrato anterior es `isPast`.

```jsonc
{
  "_id": "65a1...",
  "name": "Retiro de jóvenes",
  "capacity": 120,
  "date": "2026-08-15T00:00:00.000Z",
  "time": "09:00",
  "place": "Sede Central - Salón principal",
  "price": 25000,
  "description": "Retiro de un día...",
  "registrationDeadline": "2026-08-10T00:00:00.000Z",
  "registrationClosed": false,
  "registrationWindowClosed": false,      // derivado
  "daysUntilRegistrationDeadline": 5,      // derivado
  "isPast": false,                         // NUEVO (derivado de date + time)
  "createdAt": "2026-01-04T10:00:00.000Z",
  "updatedAt": "2026-01-04T10:00:00.000Z",
  "registrations": [
    {
      "_id": "66b2...",
      "status": "registered",
      "paymentStatus": "paid",
      "amountPaid": 25000,
      "balance": 0,
      "notes": "",
      "createdAt": "2026-01-04T10:00:00.000Z",
      "updatedAt": "2026-01-04T10:00:00.000Z",
      "profile": {
        "_id": "65a1...",
        "firstName": "María",
        "lastName": "Gómez",
        "documentID": "1234567890",
        "phoneNumber": "3001234567",
        "neighborhood": "Centro",
        "role": { "_id": "role1", "name": "Miembro" },
        "user": null
      }
    }
  ],
  "summary": {
    "registeredCount": 45,
    "paidInFullCount": 30,
    "partialPaymentCount": 5,
    "debtCount": 10,
    "cancelledCount": 2,
    "paidTotal": 875000,
    "pendingTotal": 250000,
    "availableSpots": 75,
    "occupancyRate": 37.5
  }
}
```

> **Nota**: `registrationWindowClosed` y `daysUntilRegistrationDeadline` son campos
> derivados ya existentes en el schema zod. No se modifican en este contrato.

### 1.1 `GET /api/events` — Listado de eventos

- **Roles**: cualquier rol autenticado.
- **Query params**:

| Nombre   | Tipo                | Requerido | Default | Notas                                                                |
| -------- | ------------------- | --------- | ------- | -------------------------------------------------------------------- |
| `status` | enum                | opcional  | —       | `upcoming` \| `past`. Sin filtro se devuelven todos los eventos.     |
| `page`   | int ≥1              | opcional  | `1`     | Paginación reservada para iteración futura; hoy el endpoint devuelve un array plano. |
| `limit`  | int 1-100           | opcional  | `20`    | Reservado para iteración futura.                                     |

- **Orden**:
  - Sin `status` o `status=upcoming`: `date` asc, `time` asc.
  - `status=past`: `date` desc, `time` desc.
- **Respuesta 200** — `Event[]` (array plano). El contrato se mantiene como array plano
  en este ciclo para no romper el cliente existente; si el volumen de eventos crece, se
  migrará a `PaginatedResponse<Event>` acordado con el `chief-architect`.

```jsonc
[
  { /* Event shape, isPast: false */ },
  { /* Event shape, isPast: true */ }
]
```

- **Errores**:
  - `400 { message: "Parámetros de consulta inválidos" }`
  - `500 { message: "Error al obtener eventos" }`

### 1.2 `GET /api/events?status=upcoming` — Próximos eventos

- **Roles**: cualquier rol autenticado.
- **Comportamiento**: filtra eventos donde `isPast === false`.
- **Orden**: `date` asc, `time` asc.
- **Respuesta 200** — `Event[]`.
- **Errores**: mismos que `1.1`.

### 1.3 `GET /api/events?status=past` — Eventos pasados

- **Roles**: cualquier rol autenticado.
- **Comportamiento**: filtra eventos donde `isPast === true`.
- **Orden**: `date` desc, `time` desc.
- **Respuesta 200** — `Event[]`.
- **Errores**: mismos que `1.1`.

### 1.4 `GET /api/events/history` — Alias semántico del historial

- **Roles**: cualquier rol autenticado.
- **Comportamiento**: **equivalente** a `GET /api/events?status=past`. Se mantiene como
  alias REST para facilitar la navegación del frontend sin lógica de negocio en cliente
  (AGENTS.md §3).
- **Orden**: `date` desc, `time` desc.
- **Respuesta 200** — `Event[]`.
- **Errores**: mismos que `1.1`.

### 1.5 `GET /api/events/:id/export/registrations` — Exportar Excel de inscritos

- **Roles**: `ADMIN_ROLES`.
- **Path**: `id` MongoId.
- **Respuesta 200** — Archivo `.xlsx` binario.
  - `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition`: `attachment; filename="inscritos-<slug-evento>-<fecha>.xlsx"`
    (p. ej. `inscritos-retiro-jovenes-20260815.xlsx`).
  - El frontend **no parsea JSON**; recibe el buffer/blob y dispara la descarga del navegador.
- **Hojas del archivo**:
  1. **Inscritos** — una fila por inscripción con columnas:
     - Nombre completo
     - Documento
     - Teléfono
     - Barrio
     - Rol
     - Estado de inscripción (`Registrado` / `Cancelado`)
     - Estado de pago (`Pagado` / `Abono` / `Pendiente` / `Cancelado`)
     - Valor pagado
     - Saldo
     - Observaciones
     - Fecha de inscripción (`createdAt`)
     - Última actualización (`updatedAt`)
  2. **Resumen** — datos del evento y totales:
     - Nombre del evento
     - Fecha y hora
     - Lugar
     - Capacidad
     - Inscritos activos
     - Pagados
     - Abonos
     - Pendientes
     - Cancelados
     - Total recaudado
     - Total pendiente
     - Cupos disponibles
     - % ocupación
- **Errores**:
  - `400 { errors: [...] }` — `id` no es un MongoId válido (respuesta de `handleInputErrors`
    / `express-validator`).
  - `403 { message: "No tienes permisos para esta acción" }`
  - `404 { message: "Evento no encontrado" }`
  - `500 { message: "Error al generar el archivo de inscritos" }`

> **Decisión de contrato**: la exportación funciona tanto para eventos abiertos como para
> eventos pasados (ADR-0008 §D3). No se añade query param de formato; siempre es `.xlsx`.
> **Decisión de contrato sobre errores de validación**: se adopta el patrón real del
> repositorio (`handleInputErrors` devuelve `400 { errors: [...] }` para parámetros de path
> inválidos). Los mensajes de negocio siguen usando `4xx { message: "..." }`.

---

## 2. Schemas zod (contrato formal)

> Definidos contractualmente aquí. El `frontend-engineer` los materializa en
> `frontend/src/api/EventAPI.ts` y `frontend/src/types/index.ts` (donde se compartan con
> otros módulos). Los schemas nuevos se añaden sin romper los existentes.

### 2.1 `eventStatusSchema` y `eventListQuerySchema`

```ts
export const eventStatusSchema = z.enum(["upcoming", "past"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventListQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  // page/limit reservados para paginación futura
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
```

### 2.2 `eventSchema` (incluye `isPast`)

```ts
export const eventSchema = z.object({
  _id: z.string(),
  name: z.string(),
  capacity: z.number(),
  date: z.string(),
  time: z.string(),
  place: z.string(),
  price: z.number(),
  description: z.string().default(""),
  registrationDeadline: z.string().nullable().default(null),
  registrationClosed: z.boolean().default(false),
  registrationWindowClosed: z.boolean().default(false),
  daysUntilRegistrationDeadline: z.number().nullable().default(null),
  isPast: z.boolean(),                        // NUEVO
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  registrations: z.array(eventRegistrationSchema).default([]),
  summary: z.object({
    registeredCount: z.number(),
    paidInFullCount: z.number(),
    partialPaymentCount: z.number(),
    debtCount: z.number(),
    cancelledCount: z.number(),
    paidTotal: z.number(),
    pendingTotal: z.number(),
    availableSpots: z.number(),
    occupancyRate: z.number(),
  }),
});
export type Event = z.infer<typeof eventSchema>;

export const eventsSchema = z.array(eventSchema);
```

### 2.3 `eventRegistrationSchema` (sin cambios estructurales)

Se conserva el schema existente. La hoja "Inscritos" del Excel se alimenta de los campos
populados de `profile` y de los campos propios de la inscripción.

```ts
export const eventRegistrationSchema = z.object({
  _id: z.string(),
  status: z.enum(["registered", "cancelled"]),
  paymentStatus: z.enum(["paid", "partial", "pending", "cancelled"]),
  amountPaid: z.number(),
  balance: z.number(),
  notes: z.string().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  profile: z.object({
    _id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    documentID: z.string(),
    phoneNumber: z.string(),
    neighborhood: z.string(),
    role: z.object({
      _id: z.string(),
      name: z.string(),
    }),
    user: z
      .object({
        _id: z.string(),
        email: z.string().email(),
        name: z.string(),
      })
      .nullable()
      .default(null),
  }).nullable(),
});
export type EventRegistration = z.infer<typeof eventRegistrationSchema>;
```

### 2.4 Tipado de la exportación Excel

La respuesta HTTP es binaria (`Blob`/`ArrayBuffer`). El cliente API expone una función pura
que devuelve `Promise<EventRegistrationsExport>` y deja a la UI la decisión de descargar.
La UI recibe el `Blob`, construye un nombre de archivo local y dispara la descarga del
navegador. No se añade un schema zod para la respuesta del Excel.

```ts
export type EventRegistrationsExport = Blob;
```

---

## 3. Cliente API esperado — `frontend/src/api/EventAPI.ts`

El `frontend-engineer` debe exponer estas funciones semánticas. Las funciones legacy se
conservan sin cambios.

| Función (nueva)                        | Método + Ruta                                              | Return schema                       | Estado |
| -------------------------------------- | ---------------------------------------------------------- | ----------------------------------- | ------ |
| `getEventsByStatus(status)`            | `GET /api/events?status=upcoming\|past`                    | `Event[]`                           | Nuevo  |
| `getEventHistory()`                    | `GET /api/events/history`                                  | `Event[]`                           | Nuevo  |
| `exportEventRegistrations(eventId)`      | `GET /api/events/:id/export/registrations`               | `Promise<EventRegistrationsExport>` | Nuevo  |
| `getAllEvents()`                       | `GET /api/events`                                          | `Event[]`                           | Conserva (sin cambio de firma; la respuesta ahora incluye `isPast`) |
| `createEvent(body)`                    | `POST /api/events`                                         | `Event`                             | Conserva |
| `updateEvent(id, body)`                | `PUT /api/events/:id`                                      | `Event`                             | Conserva |
| `deleteEvent(id)`                      | `DELETE /api/events/:id`                                   | `string`                            | Conserva |
| `upsertEventRegistration(...)`         | `POST /api/events/:id/registrations`                       | `Event`                             | Conserva |
| `updateEventRegistration(...)`         | `PUT /api/events/:id/registrations/:registrationId`      | `Event`                             | Conserva |
| `deleteEventRegistration(...)`         | `DELETE /api/events/:id/registrations/:registrationId`     | `Event`                             | Conserva |

> La descarga se dispara con `responseType: "blob"` en Axios. El cliente devuelve el
> `Blob` (`EventRegistrationsExport`) y la UI inicia la descarga del navegador.

---

## 4. Decisiones de naming y denominación

- ✅ Recurso API plural: `events` (`/api/events`), conforme a AGENTS.md §4.
- ✅ `isPast` es un campo derivado; no se persiste en `Event` (ADR-0008 §D1).
- ✅ `/api/events/history` es alias semántico de `GET /api/events?status=past`
  (ADR-0008 §D2).
- ✅ El endpoint de exportación usa subrecurso `/:id/export/registrations` bajo `/api/events`;
  el verbo `GET` es el idiomático para descarga de un recurso representado.
- ✅ El Excel tiene dos hojas: `"Inscritos"` y `"Resumen"` (nombres en español de negocio).

---

## 5. Drift detectado entre contrato actual y contrato objetivo

Inventario puntual. Los ítems resueltos se marcan con ✅; los pendientes con ❌.

### 5.1 Backend — `event.controller.ts` / `event.routes.ts`

- ✅ **D-01** `findAll` ya soporta `?status=upcoming|past` y devuelve `isPast` en cada evento.
- ✅ **D-02** `GET /api/events/history` existe y actúa como alias de `GET /api/events?status=past`.
- ✅ **D-03** `GET /api/events/:id/export/registrations` y `EventController.exportRegistrations`
  están implementados.
- ✅ **D-04** Existe el helper `isPastEvent(date, time)` (y `buildEventDateTime`/`parseTime`).
- ✅ **D-05** `backend/package.json` incluye `xlsx` v0.18.5.

### 5.2 Frontend — `EventAPI.ts` / `Events.tsx`

- ✅ **D-06** `eventSchema` en `frontend/src/api/EventAPI.ts` incluye `isPast: z.boolean()`.
- ✅ **D-07** Existen `getEventsByStatus(status)`, `getEventHistory()` y
  `exportEventRegistrations(eventId)`.
- ✅ **D-08** `frontend/src/pages/Events.tsx` muestra las tabs "Próximos eventos" / "Historial"
  y el botón "Descargar Excel" en el detalle.
- ✅ **D-11** `exportEventRegistrations` en `frontend/src/api/EventAPI.ts` retorna
  `Promise<EventRegistrationsExport>` (`Promise<Blob>`) y la UI (`Events.tsx`) dispara
  la descarga del navegador con el `Blob` recibido.

### 5.3 Documentación

- ✅ **D-09** `docs/api/events-api.md` existe y describe el contrato del ADR-0008.
- ✅ **D-10** `docs/api/courses-api.md` refleja la etapa "Finanzas y Gobierno" del
  ADR-0007 en el enum de `spiritualGrowthStage`.
- ✅ **D-12** (resuelto en esta revisión) El ejemplo de error `400` para `id` inválido en
  `§1.5` se ajustó al patrón real del repositorio (`handleInputErrors` devuelve
  `400 { errors: [...] }`). El mensaje `403` se ajustó a `"No tienes permisos para esta acción"`.

---

## 6. Excepciones a AGENTS.md y temas a escalar al `Chief AI Architect`

1. **(E-1)** `GET /api/events` se mantiene como **array plano** (`Event[]`) en este ciclo,
   sin envoltura paginada. El volumen de eventos de una iglesia es bajo y el cliente actual
   espera un array. Si el `chief-architect` decide estandarizar `PaginatedResponse` en todos
   los listados, se migrará en una iteración futura sin breaking (se puede envolver bajo
   feature flag o versión). **No se aplica paginación sin aprobación en este ciclo.**

2. **(E-2)** La librería `xlsx` (SheetJS) se autoriza en el backend por ADR-0008 §D4. No se
   añade librería en el frontend. La descarga se dispara desde el navegador con el blob
   devuelto por el backend.

> **Bloqueantes detectados**: ninguno. Todos los drifts documentados están resueltos.

---

## 7. Verificación de autosuficiencia del artefacto

Lista de comprobación para los implementadores:

- ✅ Cada endpoint tiene método, ruta, roles autorizados, query params con tipo/default,
  shape del body, shape del 200, códigos 4xx con mensajes en español.
- ✅ Schemas zod están definidos textualmente en §2 (todo lo necesario para los TS types
  del frontend).
- ✅ Cliente API esperado en §3 con tabla nombre → ruta → schema return.
- ✅ Drift actual → objetivo en §5 — lista puntual numerada que cada dueño resuelve.
- ✅ Excepciones reportadas en §6. No se aplican excepciones sin ratificación.
- ✅ Mensajes de error en español, sin `any`, sin exponer hashes ni secretos.
- ✅ Campo derivado `isPast` documentado; no se persiste en BD.

---

_Fin del artefacto. Custodia: `api-contract-engineer`. Cualquier divergencia detectada
durante la implementación debe abrirse como nuevo drift en §5 (actualizando este documento)
y notificarse al `chief-architect`._
