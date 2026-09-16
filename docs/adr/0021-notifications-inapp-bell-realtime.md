# ADR-0021 — Notificaciones in-app con campanita (módulo `Notification` + realtime)

- **Estado**: Aceptado (implementado)
- **Fecha**: 2026-09-15
- **Custodio**: `chief-architect`
- **Tema**: Feature nueva end-to-end — sistema de notificaciones in-app: cada usuario
  recibe notificación cuando se le asigna un curso (profesor o estudiante), y
  Admin/Superadmin reciben copia administrativa en la campanita del header.
- **Flujo**: Feature nueva end-to-end completa (AGENTS.md §7): contrato → modelo →
  realtime → backend → frontend → auditorías (seguridad + UI) → tests → docs.

## Contexto

Reporte del usuario:

> *"Quiero que me muestres una notificación para cada usuario cuando sea asignado
> algún curso, para el admin también tener una notificación en la campanita del
> header."*

Estado previo (verificado): no existía módulo de notificaciones en backend ni
frontend; la campanita de `AuthHeader` era decorativa. Sí existía infraestructura
Socket.IO con salas por perfil (`profile:<profileId>`) y por rol (`role:<rol>`), y un
puente socket↔React Query (`RealtimeBridge`).

## Decisión

### D1 — Modelo `Notification` (persistencia por destinatario)

`backend/src/models/notification.model.ts`: `recipientProfileId` (ref UserProfile),
`type` (string abierto; valor canónico inicial `"course-assignment"`), `title`,
`message`, `link` (ruta interna opcional), `readAt: Date | null` (**null = no leída**;
no boolean `read`), timestamps. Índices: `{ recipient, createdAt: -1 }` (listado) y
parcial `{ recipient, readAt: 1 }` donde `readAt: null` (conteo de no leídas).

### D2 — Endpoints REST self-scoped

`GET /api/notifications?limit=20` → `{ items, unreadCount }`; `PATCH
/api/notifications/:id/read` (idempotente, 404 si no es del caller); `PATCH
/api/notifications/read-all` → `{ updatedCount }`. Scope **siempre** al
`profileId` del caller (no existe vía de leer/marcar notificaciones ajenas). La ruta
`/read-all` se declara antes que `/:id/read` para evitar colisión de matching.

### D3 — Una notificación persistida por destinatario + emisión solo a `profile:<id>`

Aunque Socket.IO ofrece salas de rol, el flujo emite **únicamente** a la sala privada
del destinatario persistido. Razón: la campanita requiere persistencia por usuario
(cada quien marca sus leídas); emitir además a `role:Admin`/`role:Superadmin` haría
que cada admin recibiera el mismo evento dos veces (doble toast). La copia
administrativa se materializa como notificación independiente por perfil admin
(`notifyAdmins`: Role→User→UserProfile), con `link: "/courses"`.

### D4 — Disparadores tolerantes a fallos en asignación de cursos

En `course-assignment.service.ts`, envueltos en try/catch (un fallo de notificación
JAMÁS rompe la operación principal; `console.error` operacional, nunca secretos):
- `createAssignment` → notifica al profesor (`link: "/my-courses"`) + copia a admins
  (`link: "/courses"`).
- `addMembers` → notifica SOLO a miembros nuevos (diff contra el roster previo;
  `$set` reemplaza el array completo).
- `updateAssignment` → notifica al nuevo profesor SOLO si cambió el profesor.

### D5 — Frontend: `RealtimeBridge` como dueño de la suscripción; campanita = consumidor puro

La suscripción a `notifications:new` vive en `RealtimeBridge` (que posee el ciclo de
vida del socket; los efectos de componentes hijos montan antes que él y perderían
listeners). Al recibir el evento: invalida `["notifications"]` + `toast.info` en
vivo. `NotificationBell` (campanita en `AuthHeader`) es consumidor puro del query
(`useNotifications`: poll de respaldo 60 s + mutaciones de marca). Dropdown
accesible (aria, Escape, click-fuera, badge con cap "99+"), navegación al `link`
al hacer click en el ítem.

### D6 — Formato de errores de validación: estándar transversal del repo

Ante el hallazgo H-1 de la auditoría (contrato documentaba `400 { message }` pero el
middleware transversal responde `400 { errors: [...] }`), decisión del arquitecto:
**el estándar del repo prevalece**; no se modifica el middleware transversal. El
contrato `docs/api/notifications-api.md` se alineó (§0, §1.1, §1.2).

## Implementación

- Contrato: `docs/api/notifications-api.md` + `backend/src/types/notification.ts` +
  schemas zod en `frontend/src/types/index.ts` (api-contract-engineer).
- Modelo: `notification.model.ts` (database-engineer).
- Realtime: `emitRealtimeNotification(rooms, payload)` en `realtime/socket.ts`
  (realtime-notif-engineer).
- Backend: `notification.service.ts` / `notification.controller.ts` /
  `notification.routes.ts` + montaje en `server.ts` + disparadores
  (backend-engineer).
- Frontend: `NotificationAPI.ts`, `useNotifications.ts`, `NotificationBell.tsx`,
  `onRealtimeNotification` en `lib/realtime.ts`, integración en `RealtimeBridge` y
  `AuthHeader` (frontend-engineer) + pulido a11y/contraste (ui-design-engineer).
- Auditoría de seguridad: 9/9 ítems ✅, sin fixes requeridos (auth-security-engineer).
- Tests: +43 backend / +56 frontend. Estado final: **backend 406 passed**,
  **frontend 176 passed**, lint y typecheck limpios en ambos.

## Consecuencias

### Positivas

- El profesor y cada estudiante saben al instante (toast + campanita) que fueron
  asignados a un curso; el admin tiene visibilidad en su campanita.
- Persistencia por destinatario: la campanita funciona incluso para usuarios que
  estaban desconectados (ven el badge al reconectar).
- Módulo reutilizable: `type` abierto + `createNotification` genérico permiten
  futuras fuentes (eventos, grupos de vida, etc.) sin rediseño.

### Negativas / trade-offs

- `notifyAdmins` crea N documentos por asignación (N = nº de admins): aceptable por
  el count pequeño de admins; si crece, evaluar notificación "fan-out" diferida.
- Sin paginación real (limit 1–50 sin cursor) ni limpieza por antigüedad/TTL:
  deuda menor vigilada.
- Sin email (Nodemailer existe): el sponsor no lo pidió; queda como extensión
  natural.

## Alternativas consideradas

- **Broadcast a salas de rol sin persistencia**: descartada — la campanita (badge
  acumulado, marcar leídas) exige persistencia por usuario.
- **Una única notificación admin compartida**: descartada — no permite marca de
  leída individual ni scoped access.
- **Email en lugar de in-app**: descartada — el pedido explícito fue campanita/toast.

## Riesgos vigilados

- Crecimiento de la colección `Notification` → evaluar TTL/limpieza en iteración
  futura.
- Recomendaciones a11y pendientes (backlog): navegación por flechas en el dropdown,
  focus trap, botón reintentar en estado de error, auditoría z-index frente a
  modales HeroUI.
- Rate-limit específico para mutaciones masivas (sugerido por auth-security, no
  bloqueante).

## Referencias

- `docs/api/notifications-api.md` (contrato EPC-NOTIFICATIONS-001).
- `backend/src/services/notification.service.ts`, `course-assignment.service.ts`
  (disparadores), `realtime/socket.ts`.
- `frontend/src/components/notifications/NotificationBell.tsx`,
  `hooks/useNotifications.ts`, `components/auth/RealtimeBridge.tsx`.
- `docs/adr/0003-security-hardening-deps.md` (hardening transversal aplicado).

---

## Addendum (2026-09-15) — Incidencia 001: el 401 de notificaciones expulsaba al superadmin

### Síntoma

Al iniciar sesión como superadmin, el frontend mostraba
`GET /api/notifications?limit=20 401 (Unauthorized)` y la sesión se cerraba de
inmediato, impidiendo el acceso.

### Cadena de causa raíz

1. El bootstrap de superadmin crea `User` **sin `UserProfile`** (ADR-0016), por lo
   que su session token lleva `profileId: null` (`session-auth.controller.ts`).
2. D1/D2 originales scopeaban el módulo a `profileId` y el controller respondía
   **401 "No autorizado" cuando `profileId` era null** — aunque la sesión fuera
   válida.
3. El interceptor global de axios (`frontend/src/lib/axios.ts`) aplica la política
   "cualquier 401 → logout" (correcta para sesiones expiradas) → logout automático.

### Corrección (supera D1, D2, D3 y parte de D4)

- **El destinatario de una notificación in-app es el `User`** (`req.auth.userId`,
  subject del JWT, SIEMPRE presente), no el `UserProfile` (opcional en la sesión).
  Modelo: `recipientProfileId` → **`recipientUser`** (ref User) + migración
  `20260915-notifications-recipient-user.ts`.
- Socket: sala canónica **`user:<userId>`** (todos los autenticados se suscriben,
  con o sin perfil); el connection handler la une siempre.
- Controller: **ningún endpoint responde 401 por falta de perfil**; el 401 queda
  reservado EXCLUSIVAMENTE a sesión inválida (middleware `authenticate`). List
  devuelve 200 vacío si no hay notificaciones.
- Disparadores: destinatario = `profile.user._id`; si el perfil no tiene cuenta,
  la notificación in-app se omite (no podría verla).
- `notifyAdmins`: Role→User directo (sin hop por UserProfile).
- Frontend: sin cambios (mismos endpoints/shapes/evento).

### Prevención (lecciones)

- **Semántica HTTP**: 401 = "no autenticado", nunca "autenticado sin dato
  adicional". En este repo además cualquier 401 dispara logout global: cada
  endpoint nuevo debe considerar usuarios sin `profileId` (superadmin es el caso
  canónico).
- Regresión añadida (`notification.routes.smoke.test.ts`): sesión con
  `profileId: null` → 200 en los tres endpoints; y en disparadores, skip silencioso
  de perfiles sin cuenta. Estado tras el fix: **backend 411 passed, frontend 176
  passed**, lint/typecheck limpios.

### Operación

Tras desplegar el fix: reiniciar backend y, si se crearon notificaciones durante la
ventana del bug, ejecutar `npm run migrate:notifications-recipient-user` (idempotente;
elimina notificaciones huérfanas de perfiles sin cuenta).
