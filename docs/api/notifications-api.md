# Contrato API del módulo de Notificaciones In-App — `EPC-NOTIFICATIONS-001`

> **Estado**: Vigente (nuevo módulo aprobado por el `chief-architect`).
> **Autoridad**: `api-contract-engineer` (única fuente de verdad sobre la forma de los payloads).
> **Fuentes**: `AGENTS.md` (§3, §4, §5, §8), `docs/api/courses-api.md` §0,
> `backend/src/realtime/socket.ts`, `backend/src/services/course-assignment.service.ts`.
> **Consumidores**: `database-engineer`, `backend-engineer`, `auth-security-engineer`,
> `frontend-engineer`, `realtime-notif-engineer`, `testing-engineer`, `quality-engineer`.
> **Última revisión**: 2026-09-15

Este documento **es la única especificación normativa** de los endpoints, tipos y eventos
Socket.IO del módulo de Notificaciones In-App. Las notificaciones son **solo lectura +
marca de leídas** para el cliente: no existen endpoints de creación ni eliminación
públicos, ya que nacen de eventos del servidor (asignación de cursos e inscripción de
estudiantes). Cualquier divergencia entre este contrato y el código se considera drift y
debe resolverse ajustando el código (no este documento) o, si el cambio es intencional,
actualizando este documento previa aprobación del `chief-architect`.

---

## 0. Convenciones generales

- Prefijo común de todos los endpoints del módulo: `/api/notifications`.
  Un solo router Express: `backend/src/routes/notification.routes.ts`.
- Autenticación: todos los endpoints exigen `authenticate` (JWT). El único `401`
  posible es el que devuelve el propio middleware de autenticación por sesión
  inválida o ausente. Un usuario autenticado sin `UserProfile` (p. ej. superadmin
  bootstrap) nunca recibe `401` por este módulo.
- Alcance: **siempre** filtrado al `userId` del caller (`req.auth.userId`). Nunca se
  exponen notificaciones de otros usuarios. Admin/Superadmin reciben sus propias
  copias administrativas como notificaciones independientes persistidas con su propio
  `recipientUser`; el evento realtime se emite a la sala privada de cada destinatario.
- Identificadores en path: siempre MongoId (`:id` debe ser `isMongoId()`).
- Strings de error y de mensaje en **español** (AGENTS.md §1).
- Errores de validación de `express-validator` (`handleInputErrors`) se devuelven como
  `400 { errors: [...] }` (array del `validationResult`). Errores de negocio devueltos por
  los controladores se devuelven como `4xx { message: "..." }`.
- Formato de fechas en respuestas: ISO 8601 con offset (`.toISOString()`). En schemas zod
  se validan como `z.string().datetime()`.
- Sin `any`. Sin exponer hashes, passwords ni stack traces (AGENTS.md §8).
- Soft-delete: el módulo de notificaciones **no implementa soft-delete**. Una
  notificación leída se representa con `readAt != null`; no se elimina del cliente.
- Query key de React Query para el listado/campanita: `["notifications"]` (alineado con
  la convención §0 de `docs/api/courses-api.md`).
- Realtime: evento Socket.IO `notifications:new` con payload
  `{ notification: Notification }`. No se usa `emitRealtimeInvalidation` aquí porque el
  backend emite directamente a las salas privadas de usuario `user:<userId>`.

---

## 1. Notificaciones — `Notification`

> Recurso_mongo: `Notification` (implementará `database-engineer` después de este contrato).
> Recurso API (plural, AGENTS.md §4): `notifications`.

### Shape de base — `Notification` (respuesta)

Todas las respuestas del módulo usan este shape serializado.

```jsonc
{
  "_id": "66f1...",
  "type": "course-assignment",   // string; hoy el único valor generado es "course-assignment"
  "title": "Nueva asignación de curso",
  "message": "Se te asignó el curso \"Fundamentos de la Fe\".",
  "link": "/my-courses",         // string | null
  "readAt": null,                // string ISO | null
  "createdAt": "2026-09-15T10:00:00.000Z",
  "updatedAt": "2026-09-15T10:00:00.000Z"
}
```

> **Nota sobre `type`**: aunque hoy solo se genera `"course-assignment"`, el campo es un
> `string` abierto a futuros tipos (`event-reminder`, `life-group-session`, etc.). El
> schema zod acepta cualquier string para no romper cuando se añadan nuevos tipos.

---

### 1.1 `GET /api/notifications?limit=20` — Listado del caller

- **Roles**: cualquier rol autenticado.
- **Query params**:

| Nombre  | Tipo    | Requerido | Default | Notas                                      |
| ------- | ------- | --------- | ------- | ------------------------------------------ |
| `limit` | int 1-50 | opcional | `20`   | Tope máximo 50. Si llega >50, se trunca a 50. |

- **Filtro implícito**: `{ recipientUser: callerUserId }`.
- **Orden**: por `createdAt` descendente (más recientes primero).
- **Respuesta 200** — `NotificationsResponse` (incluso si el caller no tiene
  notificaciones, se devuelve `{ items: [], unreadCount: 0 }`; nunca `401` por no tener
  perfil):

```jsonc
{
  "items": [
    {
      "_id": "66f1...",
      "type": "course-assignment",
      "title": "Nueva asignación de curso",
      "message": "Se te asignó el curso \"Fundamentos de la Fe\".",
      "link": "/my-courses",
      "readAt": null,
      "createdAt": "2026-09-15T10:00:00.000Z",
      "updatedAt": "2026-09-15T10:00:00.000Z"
    }
  ],
  "unreadCount": 3
}
```

- **Errores**:
  - `400 { errors: [{ msg: "El límite debe estar entre 1 y 50", path: "limit", location: "query" }] }`
    cuando `limit` no es un entero válido entre 1 y 50 (shape estándar del middleware
    `handleInputErrors`).
  - `500 { message: "Error al obtener notificaciones" }`

---

### 1.2 `PATCH /api/notifications/:id/read` — Marcar una notificación como leída

- **Roles**: cualquier rol autenticado.
- **Path**: `id` MongoId.
- **Body**: ninguno.
- **Comportamiento**:
  - La notificación debe existir **y** pertenecer al `userId` del caller.
  - Si no existe o no pertenece → `404 { message: "Notificación no encontrada" }`.
  - Si ya está leída (`readAt != null`) → idempotente: devuelve `200` sin error.
  - Si no está leída → setea `readAt = new Date().toISOString()` y devuelve la
    notificación actualizada.
- **Respuesta 200** — `MarkNotificationReadResponse`:

```jsonc
{
  "message": "Notificación marcada como leída",
  "notification": { /* Notification shape con readAt seteado */ }
}
```

- **Errores**:
  - `400 { errors: [{ msg: "El id no es válido", path: "id", location: "params" }] }`
    cuando `:id` no es un MongoId válido (shape estándar del middleware `handleInputErrors`).
  - `404 { message: "Notificación no encontrada" }`
  - `500 { message: "Error al marcar la notificación como leída" }`

---

### 1.3 `PATCH /api/notifications/read-all` — Marcar todas como leídas

- **Roles**: cualquier rol autenticado.
- **Body**: ninguno.
- **Comportamiento**: marca como leídas (`readAt = now`) todas las notificaciones del
  caller (`recipientUser = callerUserId`) cuyo `readAt` sea `null`.
- **Respuesta 200** — `MarkAllNotificationsReadResponse`:

```jsonc
{
  "message": "Todas las notificaciones fueron marcadas como leídas",
  "updatedCount": 3
}
```

- **Errores**:
  - `500 { message: "Error al marcar las notificaciones como leídas" }`

---

## 2. Schemas zod (contrato formal)

> Definidos contractualmente aquí. El `frontend-engineer` los materializa en
> `frontend/src/types/index.ts` siguiendo este contrato (sin desviarse). El
> `backend-engineer` puede usarlos como referencia para validación si los centraliza;
> el modelo Mongoose lo define `database-engineer`.

### 2.1 `notificationSchema`

```ts
export const notificationSchema = z.object({
  _id: z.string(),
  type: z.string(),                  // abierto a futuros tipos
  title: z.string(),
  message: z.string(),
  link: z.string().nullable().default(null),
  readAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;
```

### 2.2 `notificationsResponseSchema`

```ts
export const notificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
```

### 2.3 `markNotificationReadResponseSchema`

```ts
export const markNotificationReadResponseSchema = z.object({
  message: z.string(),
  notification: notificationSchema,
});
export type MarkNotificationReadResponse = z.infer<typeof markNotificationReadResponseSchema>;
```

### 2.4 `markAllNotificationsReadResponseSchema`

```ts
export const markAllNotificationsReadResponseSchema = z.object({
  message: z.string(),
  updatedCount: z.number().int().nonnegative(),
});
export type MarkAllNotificationsReadResponse = z.infer<typeof markAllNotificationsReadResponseSchema>;
```

### 2.5 `notificationListQuerySchema`

```ts
export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
```

---

## 3. Cliente API esperado — `frontend/src/api/NotificationAPI.ts`

El `frontend-engineer` debe exponer estas funciones semánticas. Ninguna función crea ni
elimina notificaciones desde el cliente.

| Función                              | Método + Ruta                              | Return schema                        |
| ------------------------------------ | ------------------------------------------ | ------------------------------------ |
| `getNotifications(query?)`           | `GET /api/notifications?limit=`            | `NotificationsResponse`              |
| `markNotificationAsRead(id)`         | `PATCH /api/notifications/:id/read`        | `MarkNotificationReadResponse`       |
| `markAllNotificationsAsRead()`       | `PATCH /api/notifications/read-all`        | `MarkAllNotificationsReadResponse`   |

---

## 4. Fuentes de creación (disparadores del servidor)

Las notificaciones se crean **únicamente** como reacción a eventos de negocio. El
`backend-engineer` instrumenta cada disparador en el service correspondiente, siguiendo
las salas destinatarias definidas en §5.

### 4.1 `createAssignment` — curso asignado a profesor

- **Destinatario directo**: el profesor asignado. Se resuelve `professor.user._id`
  (cuenta `User` vinculada al perfil). Si el perfil no tiene usuario vinculado, la
  notificación in-app se omite.
  - `recipientUser`: `professor.user._id`
  - `type`: `"course-assignment"`
  - `title`: `"Nueva asignación de curso"`
  - `message`: `"Se te asignó el curso \"<nombre del curso>\" como profesor."`
  - `link`: `"/my-courses"`
  - Evento `notifications:new` a `user:<professor.user._id>`.
- **Copia administrativa (`notifyAdmins`)**: se resuelven directamente los `User` con
  rol `Admin` o `Superadmin` (sin hop por `UserProfile`). Para cada uno se persiste una
  notificación independiente.
  - `recipientUser`: `userIdDelAdmin`
  - `type`: `"course-assignment"`
  - `title`: `"Nueva asignación de curso"`
  - `message`: `"Se asignó el curso \"<nombre del curso>\" al profesor <nombre>."`
  - `link`: `"/courses"`
  - Evento `notifications:new` a `user:<userIdDelAdmin>`.

### 4.2 `addMembers` — estudiantes inscritos en una asignación

- **Destinatario directo**: cada estudiante recién inscrito (uno por `memberId`). Se
  resuelve `member.user._id`; si el perfil no tiene usuario vinculado, la notificación
  in-app para ese miembro se omite.
  - `recipientUser`: `member.user._id`
  - `type`: `"course-assignment"`
  - `title`: `"Inscripción en curso"`
  - `message`: `"Fuiste inscrito en el curso \"<nombre del curso>\"."`
  - `link`: `"/my-courses/student"`
  - Evento `notifications:new` a `user:<member.user._id>`.
- **Copia administrativa**: no requerida en este disparador (el Admin/Superadmin ya es
  quien usualmente ejecuta la acción).

### 4.3 `updateAssignment` — cambio de profesor en una asignación

- **Destinatario directo**: solo si cambió el campo `professor` respecto al valor previo.
  Se resuelve `professor.user._id`; si el perfil no tiene usuario vinculado, la
  notificación in-app se omite.
  - `recipientUser`: `professor.user._id`
  - `type`: `"course-assignment"`
  - `title`: `"Nueva asignación de curso"`
  - `message`: `"Se te asignó el curso \"<nombre del curso>\" como profesor."`
  - `link`: `"/my-courses"`
  - Evento `notifications:new` a `user:<professor.user._id>`.
- **Copia administrativa**: no requerida en este disparador (la notificación original ya
  se envió en `createAssignment`; un cambio no necesita copia adicional, salvo decisión
  futura del `product-owner`).

---

## 5. Eventos Socket.IO

### 5.1 Conexión y salas

El servidor ya suscribe automáticamente a cada socket autenticado a:

- `user:<userId>` (canal privado del usuario; disponible para **todos** los usuarios
  autenticados, incluso sin `UserProfile`).
- `profile:<profileId>` (canal privado del perfil, si existe).
- `role:<rol>` para cada rol del usuario (por ejemplo, `role:Admin`, `role:Superadmin`).

Ver `backend/src/realtime/socket.ts`.

> **Nota para notificaciones**: la sala canónica es `user:<userId>`. El módulo de
> Notificaciones NO depende de `profile:<profileId>` porque el destinatario es la
> cuenta `User` (el JWT subject) y no todos los usuarios tienen perfil.

### 5.2 Evento `notifications:new`

Cuando el servidor crea una notificación, la persiste una vez por destinatario `User` y
emite el evento **únicamente** a la sala privada del usuario destinatario:

- `user:<recipientUserId>`

No se emite a salas `role:*` ni `profile:*`. Aunque Socket.IO suscribe a los usuarios
autenticados a salas de rol y de perfil (ver §5.1), el flujo actual de notificaciones usa
solo salas de usuario, porque cada destinatario —incluidos Admin/Superadmin con copia
administrativa— recibe una notificación propia persistida con su `recipientUser`.

El payload se mantiene igual:

```jsonc
{
  "notification": { /* Notification shape */ }
}
```

Ejemplo de emisión para una sola notificación:

```ts
io.to(`user:${recipientUserId}`)
  .emit("notifications:new", { notification: serializedNotification });
```

> **Nota**: cada destinatario recibe **su propia** notificación persistida. El Admin no
> ve la notificación del profesor; ve una copia con el mismo `type`/`title`/`message`
> adaptado y su propio `_id`, `link` y `recipientUser` interno. El frontend solo escucha
> el evento y, al recibirlo, invalida la query key `["notifications"]`.

---

## 6. Decisiones de naming y denominación

- ✅ Recurso API plural: `notifications` (`/api/notifications`), conforme a AGENTS.md §4.
- ✅ Verbos REST:
  - `GET` para listado.
  - `PATCH /:id/read` para marca parcial (campo `readAt`).
  - `PATCH /read-all` para acción masiva.
- ✅ No hay `POST`, `PUT` ni `DELETE` públicos: las notificaciones son reactivas al dominio.
- ✅ Campos en español de negocio (`title`, `message`, `link`, `readAt`).
- ✅ Query key React Query: `["notifications"]` (coincide con convención §0 de courses-api.md).
- ✅ Evento Socket.IO: `notifications:new` (kebab-case, namespace semántico).

---

## 7. Drift detectado entre contrato y código actual

Este módulo es nuevo, por lo que el drift inicial es el conjunto completo de tareas de
implementación. Los dueños de área deben resolverlos en orden canónico:

### 7.1 `database-engineer`

- **D-01** Crear `backend/src/models/notification.model.ts` con el shape acordado:
  - `recipientUser: ObjectId (ref: "User", required)` — destinatario de la notificación.
  - `type: String (required)`
  - `title: String (required)`
  - `message: String (required)`
  - `link: String | null`
  - `readAt: Date | null` (default `null`)
  - `createdAt`, `updatedAt` via `timestamps: true`
  - Índice `{ recipientUser: 1, createdAt: -1 }` para soportar `GET /api/notifications` ordenado.
  - Índice `{ recipientUser: 1, readAt: 1 }` para soportar el conteo de no leídas.

### 7.2 `backend-engineer`

- **D-02** Crear `backend/src/routes/notification.routes.ts` con los tres endpoints contratados.
- **D-03** Crear `backend/src/controller/notification.controller.ts` que orqueste llamadas al service.
- **D-04** Crear `backend/src/services/notification.service.ts` con:
  - `getNotifications(userId, limit)`
  - `markAsRead(userId, id)`
  - `markAllAsRead(userId)`
  - `createNotification(input)` (llamado desde `course-assignment.service.ts`)
  - `notifyAdmins(inputBase)` para generar copias administrativas resolviendo `User`
    con rol Admin/Superadmin.
- **D-05** Instrumentar los disparadores en `course-assignment.service.ts`:
  - `createAssignment` → notificación al profesor + copia Admin/Superadmin.
  - `addMembers` → una notificación por estudiante inscrito.
  - `updateAssignment` → solo si cambió el profesor.
- **D-06** Emitir `notifications:new` vía `io.to(\`user:${recipientUserId}\`)` por cada
  notificación persistida. No emitir a salas `role:*` ni `profile:*`; cada Admin/Superadmin
  recibe su propia notificación persistida y su propio evento a su sala de usuario. El
  `realtime-notif-engineer` valida la integridad del canal.

### 7.3 `frontend-engineer`

- **D-07** Añadir los schemas zod de §2 a `frontend/src/types/index.ts`.
- **D-08** Crear `frontend/src/api/NotificationAPI.ts` con las funciones de §3.
- **D-09** Crear hook `useNotifications()` con query key `["notifications"]`.
- **D-10** Escuchar evento `notifications:new` en el hook/layout apropiado e invalidar
  la query key `["notifications"]`.
- **D-11** Implementar dropdown/campanita en el header usando `getNotifications` y
  `markNotificationAsRead` / `markAllNotificationsAsRead`.

### 7.4 `auth-security-engineer`

- **D-12** Validar que todos los endpoints exijan `authenticate` y que el alcance sea
  estrictamente `recipientUser === req.auth.userId`. El `401` solo debe provenir del
  middleware `authenticate`; un usuario autenticado sin `UserProfile` debe poder llamar a
  los endpoints y recibir `200 { items: [], unreadCount: 0 }` cuando no tenga
  notificaciones.
- **D-13** Verificar que el `Socket.IO middleware` mantenga la autenticación antes de
  unir a las salas privadas.

### 7.5 `testing-engineer`

- **D-14** Tests de contrato para los tres endpoints (happy path + 404 + scope).
- **D-15** Tests de integración para los disparadores `createAssignment`, `addMembers` y
  `updateAssignment`.

---

## 8. Excepciones a AGENTS.md y temas a escalar al `Chief AI Architect`

1. **(E-1)** El listado `GET /api/notifications` devuelve `NotificationsResponse`
   (items + `unreadCount`) sin paginación completa por ahora. El volumen esperado por
   perfil es bajo. Si en el futuro crece, se evaluará `PaginatedResponse` en una
   iteración acordada con el arquitecto.

> **Bloqueantes detectados**: ninguno.

---

## 9. Verificación de autosuficiencia del artefacto

Lista de comprobación para los implementadores:

- ✅ Cada endpoint tiene método, ruta, roles autorizados, query/body params con
  tipo/default, shape del 200, códigos 4xx con mensajes en español.
- ✅ Schemas zod están definidos textualmente en §2 (todo lo necesario para los TS types
  del frontend).
- ✅ Cliente API esperado en §3 con tabla nombre → ruta → schema return.
- ✅ Fuentes de creación documentadas en §4.
- ✅ Evento Socket.IO documentado en §5 con salas y payload.
- ✅ Drift inicial → objetivo en §7 — lista puntual numerada que cada dueño resuelve.
- ✅ Excepciones reportadas en §8. No se aplican excepciones sin ratificación.
- ✅ Mensajes de error en español, sin `any`, sin exponer hashes ni secretos.

---

_Fin del artefacto. Custodia: `api-contract-engineer`. Cualquier divergencia detectada
durante la implementación debe abrirse como nuevo drift en §7 (actualizando este documento)
y notificarse al `chief-architect`._
