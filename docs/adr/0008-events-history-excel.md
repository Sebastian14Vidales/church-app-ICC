# ADR-0008 — Historial de eventos y exportación Excel de inscritos

- **Estado**: Aceptado
- **Fecha**: 2026-08-04
- **Custodio**: `chief-architect`
- **Tema**: Dominio de negocio — eventos, inscripciones y reportes
- **Apertura delegada por**: `chief-architect` (solicitud directa del Sponsor)
- **Redacción técnica**: `chief-architect`

## Contexto

El usuario solicitó tres funcionalidades para el módulo de Eventos:

1. **Historial de eventos**: una vez que un evento cumpla su fecha y hora de realización, debe pasar automáticamente a un historial.
2. **Descarga Excel**: poder descargar un archivo Excel con las personas inscritas y toda la trazabilidad del evento.
3. **Disponibilidad de la exportación**: la descarga debe funcionar tanto cuando el evento está abierto (inscripciones abiertas) como cuando ya cerró (pasado).

Actualmente el modelo `Event` (`backend/src/models/event.model.ts`) guarda `date` (fecha), `time` (hora como string), `registrationDeadline` y `registrationClosed`. No existe separación conceptual entre eventos próximos y eventos pasados; todos se listan juntos.

## Decisión

### D1 — Evento pasado = derivado de `date` + `time`

No se añade un campo persistente `status` o `isPast` en el modelo. El estado "pasado" se deriva en cada consulta comparando el momento actual (`new Date()`) contra la combinación de `date` y `time` del evento.

```ts
const eventDateTime = new Date(`${datePart}T${timePart}`);
const isPast = eventDateTime.getTime() < Date.now();
```

Donde `datePart` es la fecha almacenada en formato ISO (sin zona) y `timePart` es el string `HH:mm` (o similar) guardado en `time`.

**Razón**: evitar datos derivados que requieran sincronización mediante cron jobs o triggers; el volumen de eventos es bajo y el cálculo es barato.

### D2 — Endpoints de eventos

Se mantienen los endpoints existentes y se añaden variantes semánticas:

- `GET /api/events` — retorna todos los eventos ordenados por fecha/hora (`date` asc, `time` asc). Cada evento incluye el campo derivado `isPast: boolean`.
- `GET /api/events?status=upcoming` — retorna solo eventos no pasados (`isPast === false`).
- `GET /api/events?status=past` — retorna solo eventos pasados (`isPast === true`), ordenados por fecha/hora descendente.
- `GET /api/events/history` — alias semántico de `GET /api/events?status=past`.

El frontend puede consumir `GET /api/events` y filtrar localmente para la vista, pero las rutas semánticas (`/history`, `?status=`) se ofrecen para evitar lógica de negocio en el cliente (AGENTS.md §3).

### D3 — Exportación Excel de inscritos

Se añade el endpoint:

```
GET /api/events/:id/export/registrations
```

Respuesta: archivo `.xlsx` con Content-Type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition: attachment; filename="inscritos-<evento>-<fecha>.xlsx"`.

El archivo contiene dos hojas:

1. **Inscritos**: una fila por inscripción con las columnas:
   - Nombre completo
   - Documento
   - Teléfono
   - Barrio
   - Rol
   - Estado de inscripción (Registrado / Cancelado)
   - Estado de pago (Pagado / Abono / Pendiente / Cancelado)
   - Valor pagado
   - Saldo
   - Observaciones
   - Fecha de inscripción (createdAt)
   - Última actualización (updatedAt)

2. **Resumen**: totales del evento:
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

La exportación funciona independientemente de si el evento está abierto o pasado.

### D4 — Librería para generar Excel

Se autoriza la dependencia `xlsx` (SheetJS) en el backend para generar archivos `.xlsx`. Se prefiere sobre `exceljs` por simplicidad para este caso de uso (datos tabulares sin estilos complejos) y menor tamaño de bundle.

**Justificación**: `AGENTS.md` §2 prohíbe introducir librerías sin ADR; este ADR ratifica la excepción. No se requiere librería en el frontend; la descarga se hace vía navegador a partir del archivo generado por el backend.

### D5 — UI de historial y descarga

En `frontend/src/pages/Events.tsx` se añade:

- Una sección o tab "Historial" que liste eventos pasados (`isPast === true`).
- Un botón "Descargar Excel" visible en el detalle de cualquier evento (activo o pasado) para obtener la lista de inscritos.
- La descarga se realiza mediante una petición `GET` al endpoint de exportación; el frontend no procesa el archivo, solo dispara la descarga (por ejemplo, creando un objeto URL o usando `window.location`).

## Cambios esperados

### Backend

- `backend/src/models/event.model.ts`: no se añade campo nuevo; se mantiene `date` y `time`.
- `backend/src/controller/event.controller.ts`:
  - Helper `isPastEvent(date, time)`.
  - Actualizar `findAll` para soportar `?status=upcoming|past` y devolver `isPast` en cada evento.
  - Nuevo método `exportRegistrations` para generar el Excel.
- `backend/src/routes/event.routes.ts`: añadir `GET /:id/export/registrations` con validación de `id` MongoId.
- `backend/package.json`: añadir dependencia `xlsx`.
- `backend/src/types/` (si aplica): tipos para `EventExport`.

### Frontend

- `frontend/src/api/EventAPI.ts`:
  - Añadir `getEventsByStatus(status: 'upcoming' | 'past')` o similar.
  - Añadir `exportEventRegistrations(eventId: string)` que dispare la descarga del archivo.
- `frontend/src/types/index.ts` (o `EventAPI.ts`): añadir `isPast: boolean` al schema `eventSchema`.
- `frontend/src/pages/Events.tsx`:
  - Tab/sección "Próximos eventos" y "Historial".
  - Botón "Descargar Excel" en el detalle.

## Consecuencias

### Positivas

- Separación clara entre eventos activos y pasados sin duplicar datos.
- Exportación portable y reusable para administración.
- La generación en backend mantiene el contrato API como fuente de verdad.

### Negativas / trade-offs

- Se introduce una nueva dependencia (`xlsx`) en el backend. Debe incluirse en `backend/package.json` y en la imagen Docker (si aplica).
- El cálculo de `isPast` se hace en cada consulta; el rendimiento es aceptable dado el bajo volumen de eventos.
- El campo `time` se almacena como string; se asume formato `HH:mm` o compatible con `new Date(`${date}T${time}`)`. Si el formato cambia, hay que ajustar el helper.

## Alternativas consideradas

- **Persistir `status` en el modelo y actualizarlo con un cron job**: descartada. Añade complejidad de infraestructura y riesgo de desincronización para un estado derivado.
- **Generar el Excel en el frontend**: descartada. Requeriría librería frontend adicional y duplicaría la lógica de resumen que ya existe en el backend.
- **Exportar CSV en lugar de Excel**: descartada. El usuario pidió explícitamente Excel; CSV con BOM puede abrirse en Excel pero no cumple la solicitud literal.

## Riesgos vigilados

- **Formato de `time`**: si los eventos existentes tienen `time` en formatos inconsistentes, el helper `isPastEvent` puede fallar. `database-engineer` debe verificar o sanitizar datos existentes.
- **Drift contrato API**: `api-contract-engineer` debe actualizar `docs/api/events-api.md` (o crearlo si no existe) con los nuevos endpoints y el campo `isPast`.
- **Seguridad**: el endpoint de exportación respeta el mismo `authorizeRoles(ADMIN_ROLES)` que el resto del router de eventos.

## Referencias

- `AGENTS.md` §2 (stack y prohibición de dependencias sin ADR).
- `AGENTS.md` §3 (lógica de negocio en backend, no en frontend).
- `AGENTS.md` §4 (rutas API `/api/<recurso-plural>`).
- `backend/src/models/event.model.ts`.
- `backend/src/controller/event.controller.ts`.
- `frontend/src/pages/Events.tsx`.
- `frontend/src/api/EventAPI.ts`.
