# ADR-0010 — Bulk import de miembros/asistentes desde Excel

- **Estado**: Aceptado
- **Fecha**: 2026-08-08
- **Custodio**: `chief-architect`
- **Decision**: aprobada por el Sponsor (Admin/Superadmin usuario) y ratificada por el `chief-architect`.

## Contexto

El Sponsor del proyecto ICC Casa de Dios recibe datos de personas que asisten a la iglesia a traves de un Google Form. El formulario se exporta como archivo `.xlsx` y el Sponsor necesita cargar esas personas masivamente en el sistema, en lugar de registrarlas una por una.

Las personas importadas por este medio son **asistentes**: no estan bautizadas, no tienen acceso al sistema, no requieren un login ni un correo de bienvenida. El Sponsor requiere, ademas, un reporte claro que indique cuantas filas se procesaron, cuantas se insertaron y cuales fallaron, con el numero de fila, el documento y el motivo del error. Los registros validos deben quedar en la base de datos inmediatamente.

Esta decision se alinea con `AGENTS.md` §3 (logica de negocio en `services/`, controladores por modulo, rutas REST coherentes), §4 (nomenclatura de rutas `/api/<recurso-plural>`), §5 (manejo de datos y auditoria) y §8 (seguridad: autorizacion por rol y validacion de entrada).

## Decision

### D1 — Endpoint `POST /api/members/bulk`

El backend expone un unico endpoint bajo el prefijo del modulo de miembros:

- **Ruta**: `POST /api/members/bulk`.
- **Autenticacion**: JWT requerido (`authenticate`).
- **Autorizacion**: `authorizeRoles(["Admin", "Superadmin"])`.
- **Content-Type**: `multipart/form-data`.
- **Campo archivo**: `file`, unico archivo `.xlsx`, limite **5 MB** (configurado por `multer`).

El backend parsea el Excel con la libreria `xlsx` ya instalada en backend (autorizada en ADR-0008). No se anaden nuevas dependencias. El parseo, la validacion y la deduplicacion se ejecutan en el servidor para mantener el contrato API como autoridad y evitar logica de negocio en el cliente.

### D2 — Rol "Asistente" fijo

El bulk import crea documentos `UserProfile` con las siguientes caracteristicas fijas:

- `role`: `"Asistente"`.
- `baptized`: `false` (implicito por el rol).
- **No** se crea documento `User`.
- **No** se genera login.
- **No** se envia correo electronico.
- Los campos `email`, `profession`, `roleNames` y `user` **no** forman parte del Excel.

Esto diferencia el bulk import del formulario individual `MemberForm`, que esta restringido a Profesor, Pastor o Supervisor y que si crea `User` cuando aplica.

### D3 — Deduplicacion por `documentID`

La deduplicacion se aplica en dos niveles, en este orden:

1. **Dentro del archivo**:
   - Se detectan duplicados por `documentID` entre las filas de datos.
   - La **primera ocurrencia** (fila mas baja) se conserva como candidata valida.
   - Las filas posteriores con el mismo `documentID` se reportan como error: `"Documento duplicado en el archivo"`.

2. **Contra la base de datos**:
   - Antes de insertar, se ejecuta una sola query:
     `UserProfile.find({ documentID: { $in: [...] } }).select("documentID")`.
   - Todo `documentID` que ya exista en la coleccion se reporta como error:
     `"Ya existe un miembro con este numero de documento"`.

### D4 — Insercion parcial con `insertMany({ ordered: false })`

Los documentos validados y no duplicados se insertan con:

```ts
UserProfile.insertMany(validDocs, { ordered: false })
```

Esto permite insercion parcial: si una fila valida falla al insertar, las demas filas validas se insertan igual. El resultado de la operacion se devuelve en el shape `BulkImportResult`:

- `total`: total de filas procesadas.
- `insertedCount`: filas insertadas exitosamente.
- `failedCount`: filas con error.
- `inserted`: array de registros insertados (fila, `documentID`, `firstName`, `lastName`).
- `errors`: array de errores (fila, `documentID`, `firstName`, `reason`).

La respuesta HTTP es **200 OK** siempre que el archivo sea un Excel valido y no este vacio, **incluso si algunas filas fallaron**. Los codigos `400` se reservan para problemas con el archivo mismo: no se adjunto archivo, no es un Excel valido, esta vacio o no tiene cabeceras. No se usa `207 Multi-Status` porque el exito/fracaso no es por recurso HTTP individual, sino por fila dentro de una misma operacion de importacion.

### D5 — Renuncia al soft-delete en bulk

`AGENTS.md` §5 prefiere soft-delete mediante `deletedAt` antes del borrado fisico, "salvo decision de arquitectura". La operacion de bulk import es **exclusivamente de creacion** de nuevos `UserProfile` validados; no modifica ni elimina documentos existentes. Por tanto, la convencion de `deletedAt` no aplica a este endpoint.

### D6 — Auditoria `[AUDIT-PENDING]`

La accion `members.bulkImport` con contexto `{ total, insertedCount, failedCount }` se registrara cuando exista el modulo de auditoria transversal. Mientras tanto, se deja un comentario `TODO[AUDIT-PENDING]` en el servicio correspondiente, siguiendo el patron establecido en ADR-0001 §ET-1. No se implementa un modulo de auditoria ad-hoc para esta feature.

### D7 — Frontend

En `frontend/src/pages/members/Members.tsx` se anade un boton "Cargar miembros" visible unicamente para usuarios con rol `Admin` o `Superadmin`. Al pulsarlo se abre un modal que permite seleccionar el archivo `.xlsx` y disparar la importacion.

El cliente API centralizado en `frontend/src/api/MemberAPI.ts` expone:

```ts
bulkImportMembers(file: File): Promise<BulkImportResult>
```

El frontend construye un `FormData` con el campo `file` y envia la peticion con `Content-Type: multipart/form-data`. El frontend no parsea el Excel; solo sube el archivo.

Tras la respuesta, el modal muestra el reporte: total de filas, insertados y errores (con numero de fila, documento y motivo). No se anade libreria de parseo de Excel en el frontend.

## Consecuencias

### Positivas

- El Sponsor ahorra tiempo al registrar asistentes de forma masiva.
- El reporte detallado da visibilidad inmediata de insertados y errores.
- Los registros validos quedan en la base de datos de inmediato.
- No se crean cuentas ni correos indeseados para personas que aun no tienen acceso al sistema.
- Se reutilizan dependencias existentes (`xlsx`, `multer`), sin anadir nuevas librerias.
- El parseo en backend mantiene la validacion y la autoridad del contrato API.

### Negativas / trade-offs

- El bulk import **solo** soporta el rol "Asistente". Si el Sponsor requiere importar miembros bautizados con login, sera necesaria una segunda iteracion que maneje correo, confirmacion y creacion de `User`.
- La deduplicacion solo considera `documentID`. Si el Google Form captura otros campos duplicables (telefono, email), el sistema no los deduplicara por ellos.
- El Excel debe respetar exactamente las cabeceras del contrato; cualquier desviacion de cabeceras rechaza el archivo.
- Importar datos personales en lote requiere que el rol admin sea confiable. Esto ya esta mitigado porque el endpoint se restringe a `Admin` y `Superadmin`.
- La respuesta `200 OK` con errores de fila puede confundir a consumidores API tradicionales; se documenta explicitamente en el contrato API.

## Alternativas consideradas

- **(a) Bulk insert generico con roles variables (rol por fila del Excel)**.
  - **Rechazado**: complica el flujo (manejo de email, confirmacion por correo y creacion de `User`). El Sponsor pidio especificamente importar asistentes.

- **(b) Parsear Excel en frontend y enviar un array JSON al backend**.
  - **Rechazado**: anadiria `xlsx` al frontend (nueva dependencia) y exposdria la validacion al cliente. El parseo en backend es mas seguro y consistente con `AGENTS.md` §3.

- **(c) Endpoint que crea `User` para los asistentes y envia correo de confirmacion**.
  - **Rechazado**: los asistentes no tienen login; el bulk import es de `UserProfile` puro.

- **(d) Usar `207 Multi-Status` como respuesta**.
  - **Rechazado**: el exito/fracaso no es por recurso HTTP, sino por fila dentro de un mismo recurso (el archivo). Se devuelve `200 OK` con el reporte interno `BulkImportResult`.

## Excepción temporal (declarada por el Chief Architect)

`AGENTS.md` §9 exige que `npm run lint` y `npm run typecheck` pasen en backend y frontend antes de merge. La feature de bulk import cumple **en todos los archivos que tocó**:
- backend: `tsc` limpio, `eslint` 0 errores (sólo warnings preexistentes en `sermon.controller.ts`, `user-profile.controller.ts`, `index.ts`, `server.ts`).
- frontend: `tsc -b --noEmit` limpio; `eslint` limpio en los archivos editados por la feature.

No obstante, `npm run lint` en frontend sigue fallando por **drifts preexistentes** fuera del alcance de esta feature, identificados por el `quality-engineer`:

- `frontend/src/components/layout/Sidebar.tsx:31` — uso de `any`.
- `frontend/src/lib/auth.tsx` — violaciones de `react-refresh/only-export-components` y `react-hooks/rules-of-hooks`.
- `frontend/src/pages/Profile.tsx` — uso de `any` y warning de `react-hooks/incompatible-library`.
- `backend/src/controller/user-profile.controller.ts` (métodos `create`/`update` preexistentes) — `console.error` y `error.message` devuelto al cliente en respuestas 500 (posible filtración).

Se declara **excepción temporal** para permitir el merge de la feature bulk import **sin** que se exija resolver esos drifts como bloqueante. Condiciones:

- **Caducidad**: la excepción expira cuando se cierre la deuda técnica frontend (`any` + reglas de hooks) en `Sidebar.tsx`, `auth.tsx` y `Profile.tsx`, o cuando el `chief-architect` lo declare cerrado. Pendiente de un PR de limpieza dirigido por el `frontend-engineer` y validado por el `quality-engineer`.
- **Seguimiento**: registrar la tarea en `docs/backlog/` (si existe) o como `ET-XXX` en `ADR-0001` siguiendo el patrón de `ET-2`/`ET-3`.
- **No aplica al código nuevo**: cualquier archivo introducido por la feature bulk import cumple `lint` y `tsc`; esta excepción no cubre regresiones futuras en esos archivos.

El `chief-architect` no aprueba esta excepción como normalización del drift, sino como permiso puntual para no bloquear la entrega de valor al Sponsor mientras se acomete la limpieza transversal separadamente.

## Revisión 2026-08-18 — Aceptar CSV además de XLSX

### Contexto de la revisión

La premisa original del ADR-0010 (sección Contexto) decía: *"El formulario se exporta
como archivo `.xlsx`"*. Esta premisa era **incorrecta**: Google Forms entrega por defecto
las respuestas descargadas como archivo `.csv`, no `.xlsx`. El Sponsor descarga el CSV
directo del Google Form y al subirlo al sistema recibía el error
`"El archivo no es un Excel válido"` porque el middleware de multer rechazaba el mimetype
`text/csv`.

### Decisión

Se amplía el endpoint `POST /api/members/bulk` para aceptar **dos** formatos de archivo:

1. `.xlsx` (formato original, sin cambios).
2. `.csv` (formato por defecto de Google Forms).

Lo demás **no cambia**:

- Mismas cabeceras esperadas (sección 1.2 del contrato API).
- Mismas validaciones por fila.
- Misma deduplicación por `documentID` (archivo + BD).
- Misma inserción parcial con `insertMany({ ordered: false })`.
- Mismo shape de respuesta `BulkImportResult`.
- Mismo límite de **5 MB**.
- Mismos roles autorizados (`Admin`, `Superadmin`).

### Cambios técnicos

- **`backend/src/middleware/upload.middleware.ts`**: `fileFilter` amplía los mimetypes
  válidos para incluir CSV (`text/csv`, `application/csv`, `application/vnd.ms-excel`)
  además del mimetype de `.xlsx`. Se valida también por extensión de `originalname`
  (`.xlsx` o `.csv`) para robustez frente a mimetypes inconsistentes según navegador/OS.
  El mimetype `text/plain` **se excluye** deliberadamente por ser demasiado genérico (un
  `.txt` cualquiera se aceptaría por mimetype solo); si un navegador entrega un CSV real
  con mimetype `text/plain`, la extensión `.csv` del `originalname` lo rescata vía la
  validación por extensión. Esto alinea con `AGENTS.md` §8 (validación de entrada estricta).
- **`backend/src/services/member-bulk-import.service.ts`**: la librería `xlsx` (SheetJS)
  ya instalada en backend parsea CSV nativamente vía
  `XLSX.read(buffer, { type: "buffer", codepage: 65001 })`, que detecta el formato por
  contenido. Se añadió `codepage: 65001` para forzar UTF-8 tras detectar que un CSV sin BOM
  producía valores acentuados mal codificados (p. ej. `"PÃ©rez"` en lugar de `"Pérez"`); esta
  opción es segura para `.xlsx` porque SheetJS la ignora para ese formato. No se añade ninguna
  dependencia nueva. No cambia `HEADER_MAP`, `validateRow`, ni la lógica de dedup/inserción.
- **`backend/src/controller/user-profile.controller.ts`**: el mensaje
  `"Debes adjuntar un archivo .xlsx"` se actualiza a
  `"Debes adjuntar un archivo .xlsx o .csv"`.
- **`frontend/src/pages/members/Members.tsx`**: el atributo `accept` del `<input type="file">`
  añade `.csv` y sus mimetypes; los textos del modal y el `aria-label` mencionan CSV.
- **Contrato API** (`docs/api/members-bulk-import.md`): sección 1.1 y mensajes de error 400
  actualizados para reflejar ambos formatos.
- **Doc funcional** (`docs/functional/members-bulk-import.md`): menciona que puede subirse
  un `.csv` (proveniente directo de Google Forms) o un `.xlsx`.

### Mensajes de error actualizados

| Caso | Mensaje anterior | Mensaje nuevo |
| ---- | ---------------- | ------------- |
| No se adjuntó archivo | `"Debes adjuntar un archivo .xlsx"` | `"Debes adjuntar un archivo .xlsx o .csv"` |
| Archivo no válido / vacío / sin cabeceras | `"El archivo no es un Excel válido"` | `"El archivo no es un archivo válido"` |

### Consideraciones sobre el CSV de Google Forms

- **Separador**: coma (estándar RFC 4180); SheetJS lo maneja correctamente, incluyendo
  valores entre comillas y escaping.
- **Encoding**: Google Forms entrega UTF-8 (con o sin BOM). Se añadió `codepage: 65001` a
  `XLSX.read` para forzar UTF-8 tras detectar que un CSV sin BOM producía valores acentuados
  mal codificados; SheetJS ignora esta opción para `.xlsx`, por lo que es segura en ambos
  formatos.
- **Columna "Marca temporal"**: Google Forms la añade como primera columna tanto en CSV
  como en XLSX. El backend ignora cabeceras no reconocidas y solo exige que estén las 12
  esperadas; por tanto no rompe.
- **Fechas**: se mantiene el requisito de formato `DD/MM/YYYY` o `YYYY-MM-DD` como texto.
  Si el Sponsor usa el tipo "Fecha" nativo de Google Forms, el CSV puede entregar la fecha
  en otro formato según la configuración regional; se recomienda usar "Respuesta corta" con
  validación de texto `DD/MM/YYYY` (ver doc funcional).

### Sin nueva dependencia

La librería `xlsx` ya está autorizada en backend (ADR-0008). SheetJS soporta CSV
nativamente. No se introduce ninguna dependencia nueva; por tanto esta revisión no requiere
un ADR de dependencia separado.

### No se reabre el resto del ADR

Las decisiones D1 (endpoint), D2 (rol Asistente fijo), D3 (dedup), D4 (insertMany parcial),
D5 (renuncia a soft-delete), D6 (auditoría pendiente) y D7 (frontend) siguen vigentes sin
modificación. La excepción temporal declarada previamente tampoco se ve afectada.

## Referencias

- `AGENTS.md` §3 (estructura del repositorio: controladores, servicios, rutas y cliente API).
- `AGENTS.md` §4 (nomenclatura: rutas `/api/<recurso-plural>`, colecciones, hooks).
- `AGENTS.md` §5 (manejo de datos: soft-delete, auditoria transversal).
- `AGENTS.md` §8 (seguridad: autorizacion por rol, validacion de entrada, no exponer datos sensibles).
- `docs/api/members-bulk-import.md` — contrato API (autoridad del `api-contract-engineer`).
- `backend/src/services/member-bulk-import.service.ts`.
- `backend/src/routes/user-profile.routes.ts`.
- `frontend/src/pages/members/Members.tsx`.
- `frontend/src/types/index.ts` (`bulkImportResultSchema`).
