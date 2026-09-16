# Contrato API — Bulk import de miembros/asistentes desde Excel o CSV

> **Estado**: Vigente.
> **Autoridad**: `api-contract-engineer` (única fuente de verdad sobre la forma de los payloads).
> **Fuentes**: `AGENTS.md` (§3, §4, §5, §8), `ADR-0012` (tolerancia a cabeceras duplicadas),
> `ADR-0013` (profesión opcional y formatos de fecha), `backend/src/models/user-profile.model.ts`,
> `backend/src/routes/user-profile.routes.ts`.
> **Consumidores**: `backend-engineer`, `frontend-engineer`, `testing-engineer`, `quality-engineer`.
> **Última revisión**: 2026-09-07

Este documento define el contrato del endpoint que permite a un `Admin` o `Superadmin`
cargar un archivo `.xlsx` o `.csv` (proveniente de un Google Form) para crear masivamente perfiles
de `UserProfile` con rol fijo **"Asistente"**. El backend parsea el archivo, valida cada
fila, deduplica por `documentID`, inserta los registros válidos y devuelve un reporte
detallado con insertados y errores.

Cualquier divergencia entre este contrato y el código se considera drift y debe resolverse
ajustando el código (no este documento) o, si el cambio es intencional, actualizando este
documento previa aprobación del `chief-architect`.

---

## 0. Convenciones generales

- **Prefijo del módulo**: `/api/members`.
- **Autenticación**: JWT requerido (`authenticate`).
- **Autorización**: `authorizeRoles(["Admin", "Superadmin"])`.
- **Content-Type de request**: `multipart/form-data`.
- **Respuesta**: JSON; strings de error y mensajes en **español**.
- Sin `any`. Sin exponer hashes, passwords ni stack traces.
- **Rol fijo**: el bulk import crea siempre `UserProfile` con rol **"Asistente"**.
  - `baptized` queda implícito como `false`.
  - **No** se crea documento `User`, **no** se genera login y **no** se envía correo.
  - Los campos `email`, `roleNames` y `user` **no** forman parte del Excel (.xlsx) o CSV (.csv).
    La columna `Profesión` es **opcional** y, si aparece, se importa como `profession`.

---

## 1. `POST /api/members/bulk` — Bulk import desde Excel o CSV

### 1.1 Request

- **Roles**: `["Admin", "Superadmin"]`.
- **Content-Type**: `multipart/form-data`.
- **Campo file**:
  - Nombre: `file`.
  - Tipo: un único archivo `.xlsx` o `.csv`.
  - Límite: **5 MB** (configurado por backend en multer).
  - **Mimetypes aceptados**:
    - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)
    - `text/csv` (.csv)
    - `application/csv` (.csv)
    - `application/vnd.ms-excel` (.csv)
  - **Nota sobre `text/plain`**: se excluye deliberadamente del filtro por mimetype porque es demasiado genérico y aceptaría cualquier archivo `.txt` sin más validación, violando `AGENTS.md` §8. Si un navegador entrega un CSV real como `text/plain`, el contrato lo rescata mediante la validación por extensión `.csv` del `originalname`.
  - El backend valida también por extensión de `originalname` (`.xlsx` o `.csv`).
- **Cabeceras del Excel/CSV**: primera fila (fila 1) debe contener las **12 cabeceras
  obligatorias** listadas en la tabla de mapeo. La columna `Profesión` es **opcional** y no
  cuenta dentro de las 12 obligatorias. Las cabeceras esperadas son **las mismas** para CSV y
  XLSX. El cuerpo de datos comienza en la fila 2. Ver sección 1.2 para la regla de cabeceras
  duplicadas.

### 1.2 Mapeo de cabeceras del archivo (Excel o CSV) a campos de `UserProfile`

| Cabecera Excel (fila 1)        | Campo `UserProfile`       | Tipo / restricciones                                                                 |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------ |
| `Nombre`                       | `firstName`               | string, no vacío, trim                                                               |
| `Apellidos`                    | `lastName`                | string, no vacío, trim                                                               |
| `Documento`                    | `documentID`              | string, solo dígitos, 6–10 caracteres                                                |
| `Fecha de nacimiento`          | `birthdate`               | fecha real válida. Acepta ISO `YYYY-MM-DD` (mes/día 1–2 dígitos), day-first `DD/MM/YYYY`, `D/M/YYYY`, `DD-MM-YYYY`, `D-M-YYYY` (1–2 dígitos día/mes; locale español; **no** `MM/DD/YYYY`) y celdas de fecha reales de `.xlsx` (número serial de Excel, fracción = hora descartada). Se persiste siempre como `Date` con año en `[1900, 2100]`. |
| `Barrio`                       | `neighborhood`            | string, no vacío, trim                                                               |
| `Telefono`                     | `phoneNumber`             | string, solo dígitos, exactamente 10 caracteres                                      |
| `Tipo de sangre`               | `bloodType`               | enum: `O+`, `O-`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`                               |
| `Sirve en un ministerio`       | `servesInMinistry`        | boolean normalizado: acepta `Si`/`No`, `Sí`/`No`, `true`/`false`, `1`/`0`            |
| `Ministerio en el que sirve`   | `ministry`                | enum `MINISTRIES` (ver abajo); obligatorio si `servesInMinistry = true/Si`           |
| `Ministerio de interes`        | `ministryInterest`        | enum `MINISTRIES` (ver abajo); obligatorio si `servesInMinistry = false/No`          |
| `Ruta de crecimiento espiritual` | `spiritualGrowthStage`  | enum `SPIRITUAL_GROWTH_STAGE_CHOICES` (ver abajo; incluye `"Ninguna"`)              |
| `Encuentro y Reencuentro`      | `encounterStage`          | enum: `Ninguno`, `Encuentro`, `Reencuentro`                                          |
| `Profesión`                    | `profession`              | string opcional, libre, trim; puede aparecer duplicada por secciones condicionales (ver 1.2.1) |

> **Nota**: la columna `Profesión` es **opcional**; las 12 cabeceras originales siguen siendo
> obligatorias y un archivo que no incluya la columna `Profesión` sigue siendo válido.

**Campos del Excel que NO se importan / NO se solicitan**:

- `baptized` → siempre `false` (implícito por rol Asistente).
- `email` → no se crea `User`, por tanto no aplica.
- `roleNames` / `role` → fijo "Asistente".

**Enums de negocio** (copia de `backend/src/models/user-profile.model.ts`):

```text
MINISTRIES (catálogo oficial de 14 ministerios):
  "Ministerio de Alabanza"
  "Ministerio de Danza"
  "Ministerio de Audiovisuales"
  "Ministerio de Varones"
  "Ministerio de Jóvenes"
  "Ministerio de Parejas y Familia"
  "Ministerio de Mujeres"
  "Ministerio de Evangelismo y Consolidación"
  "Funda Esperanza"
  "Ministerio de Servidores"
  "Ministerio Infantil"
  "Ministerio de Oración e Intercesión"
  "Ministerio de Liberación"
  "Ministerio de Misericordia"
```

> **Nota sobre valores legacy**: para facilitar la importación de archivos antiguos del
> Google Form, el servicio de bulk import acepta también los siguientes alias históricos,
> normalizándolos automáticamente al nombre oficial antes de validar:
>
> | Alias legacy aceptado | Nombre oficial |
> | --- | --- |
> | `Ministerio de Danza (Niñas entre 7 y 14 años)` | `Ministerio de Danza` |
> | `Ministerio de Hombres` | `Ministerio de Varones` |
> | `Ministerio de Parejas y Familias` | `Ministerio de Parejas y Familia` |
> | `Ministerio Iglesia Infantil` | `Ministerio Infantil` |
> | `Ministerio de Evangelismo y Consolidación G.V.E` | `Ministerio de Evangelismo y Consolidación` |
>
> Los perfiles ya existentes en base de datos con valores legacy pueden alinearse al
> catálogo oficial ejecutando:
>
> ```bash
> npm run migrate:ministries-rename
> ```
>
> (backend). Ver `backend/src/config/migrations/20260915-ministries-rename.ts`.

```text
SPIRITUAL_GROWTH_STAGE_CHOICES (perfil de miembro):
  "Ninguna"
  "Consolidación"
  "Discipulado básico"
  "Carácter cristiano"
  "Sanidad y propósito"
  "Cosmovisión bíblica"
  "Finanzas y Gobierno"
  "Doctrina cristiana"

ENCOUNTER_STAGES:
  "Ninguno"
  "Encuentro"
  "Reencuentro"
```

### 1.2.1 Cabeceras duplicadas y consolidación

El archivo debe incluir las 12 cabeceras obligatorias listadas en la tabla de mapeo
(la columna `Profesión` es opcional). Una misma cabecera
**puede aparecer más de una vez** en la fila 1; esto es habitual en exports de Google Forms
que usan la lógica **"Ir a la sección según la respuesta"** (secciones condicionales), donde
preguntas como *Ruta de crecimiento espiritual*, *Encuentro y Reencuentro* o *Profesión*
pueden repetirse en ramas distintas.

Cuando una cabecera está duplicada, el backend **consolida** las columnas correspondientes
tomando el **primer valor no vacío** en orden de aparición de izquierda a derecha
(_leftmost first_). Si todas las columnas duplicadas están vacías para una fila, el valor se
considera vacío. Si varias columnas duplicadas tuvieran valor para una misma fila, gana la
columna más a la izquierda.

Una celda se considera vacía cuando su texto normalizado y recortado es `""`. Los valores
numéricos (por ejemplo, `documentID` o `phoneNumber` entregados como número por Excel) se
convierten a cadena antes de evaluar el vacío.

> **Ver también**: decisión arquitectónica en `docs/adr/0012-bulk-import-duplicate-columns.md`.

### 1.3 Validaciones por fila

Cada fila de datos se valida con las mismas reglas que `POST /api/members` para creación
individual, adaptadas al contexto de Asistente:

1. `firstName` no vacío.
2. `lastName` no vacío.
3. `documentID` no vacío, solo dígitos, longitud 6–10.
4. `birthdate` fecha real válida. Acepta ISO `YYYY-MM-DD` (mes/día 1–2 dígitos), day-first `DD/MM/YYYY`, `D/M/YYYY`, `DD-MM-YYYY`, `D-M-YYYY` (1–2 dígitos día/mes; primer componente es el día; **no** `MM/DD/YYYY`) y celdas de fecha reales de `.xlsx` (número serial de Excel, fracción = hora descartada). Se persiste como `Date` con año en `[1900, 2100]`.
5. `neighborhood` no vacío.
6. `phoneNumber` no vacío, solo dígitos, exactamente 10.
7. `bloodType` debe pertenecer al enum de tipos de sangre.
8. `servesInMinistry` debe poder normalizarse a booleano.
9. Si `servesInMinistry === true` → `ministry` obligatorio y válido en `MINISTRIES`.
10. Si `servesInMinistry === false` → `ministryInterest` obligatorio y válido en `MINISTRIES`.
11. `spiritualGrowthStage` obligatorio y válido en `SPIRITUAL_GROWTH_STAGE_CHOICES`
    (incluye `"Ninguna"` como elección explícita; ver ADR-0014 D6).
12. `encounterStage` obligatorio y válido en `ENCOUNTER_STAGES`.

Si una fila incumple alguna validación, se incluye en `errors` con un `reason` en español,
legible para el Sponsor.

### 1.4 Deduplicación por `documentID`

Se aplica en dos niveles, en este orden:

1. **Dentro del archivo**:
   - Se detectan duplicados por `documentID` entre las filas de datos.
   - La **primera ocurrencia** (fila más baja) se conserva como candidata válida.
   - Las filas subsiguientes con el mismo `documentID` se marcan como error:
     `"Documento duplicado en el archivo"`.
2. **Contra la base de datos**:
   - Antes de insertar, se ejecuta una sola query:
     `UserProfile.find({ documentID: { $in: [...] } }).select("documentID")`.
   - Todo `documentID` que ya exista en la colección se reporta como error:
     `"Ya existe un miembro con este número de documento"`.

### 1.5 Inserción

- Los documentos validados y no duplicados se insertan con:
  `UserProfile.insertMany(validDocs, { ordered: false })`.
- Esto permite inserción parcial: si una fila válida falla al insertar (por ejemplo, por
  validación de enum de Mongoose), las demás filas válidas se insertan igual.
- Cada fila que falle en la inserción se reporta en `errors` con el motivo devuelto.

### 1.6 Respuesta exitosa — `200 OK`

Siempre que el archivo sea un Excel o CSV válido y no esté vacío, se devuelve **200 OK** con el
reporte, **incluso si algunas filas fallaron**.

Shape: `BulkImportResult`

```jsonc
{
  "total": 3,
  "insertedCount": 1,
  "failedCount": 2,
  "inserted": [
    {
      "row": 2,
      "documentID": "12345678",
      "firstName": "Juan",
      "lastName": "Pérez"
    }
  ],
  "errors": [
    {
      "row": 3,
      "documentID": "12345678",
      "firstName": "María",
      "reason": "Documento duplicado en el archivo"
    },
    {
      "row": 4,
      "documentID": "87654321",
      "firstName": "Carlos",
      "reason": "Ya existe un miembro con este número de documento"
    }
  ]
}
```

### 1.7 Respuestas de error

- **400** — No se adjuntó archivo:
  ```jsonc
  { "message": "Debes adjuntar un archivo .xlsx o .csv" }
  ```
- **400** — El archivo no es un archivo válido, está vacío o no tiene cabeceras:
  ```jsonc
  { "message": "El archivo no es un archivo válido" }
  ```
- **401** — No autenticado (middleware `authenticate`).
- **403** — Rol no autorizado (middleware `authorizeRoles`).
- **413** — Archivo excede el límite de 5 MB (devuelto por multer, mensaje depende de
  configuración; el frontend debe manejarlo).

> **Nota importante**: filas con errores de validación o duplicados **no** convierten la
> respuesta en `400`. El verbo devuelve `200 OK` con el reporte `BulkImportResult`. Los
> códigos `400` se reservan para problemas con el archivo mismo.

---

## 2. Schemas zod (contrato formal)

Definidos en `frontend/src/types/index.ts`:

```ts
export const bulkImportErrorSchema = z.object({
  row: z.number().int(),
  documentID: z.string().nullable(),
  firstName: z.string().nullable().optional(),
  reason: z.string(),
});
export type BulkImportErrorItem = z.infer<typeof bulkImportErrorSchema>;

export const bulkImportResultSchema = z.object({
  total: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  inserted: z.array(z.object({
    row: z.number().int(),
    documentID: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  })),
  errors: z.array(bulkImportErrorSchema),
});
export type BulkImportResult = z.infer<typeof bulkImportResultSchema>;
```

---

## 3. Cliente API esperado — `frontend/src/api/MemberAPI.ts`

| Función                | Método + Ruta          | Body                         | Return schema       |
| ---------------------- | ---------------------- | ---------------------------- | ------------------- |
| `bulkImportMembers(file)` | `POST /api/members/bulk` | `FormData` con campo `file` | `BulkImportResult`  |

El frontend debe construir un `FormData`, adjuntar el archivo con el campo `file` y enviarlo
con `Content-Type: multipart/form-data`. No se añade librería de parseo de Excel o CSV en el
frontend; solo se sube el archivo.

---

## 4. Ejemplos

### 4.1 Request (multipart)

```http
POST /api/members/bulk HTTP/1.1
Host: api.ejemplo.com
Authorization: Bearer <jwt>
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="asistentes-ago-2026.xlsx"
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

<binary excel content>
------WebKitFormBoundary--
```

> **Nota**: el `filename` también puede ser `.csv` con `Content-Type: text/csv`.

### 4.2 Respuesta 200 con mix de insertados y errores

```jsonc
{
  "total": 5,
  "insertedCount": 2,
  "failedCount": 3,
  "inserted": [
    {
      "row": 2,
      "documentID": "11111111",
      "firstName": "Ana",
      "lastName": "García"
    },
    {
      "row": 5,
      "documentID": "44444444",
      "firstName": "Luis",
      "lastName": "Martínez"
    }
  ],
  "errors": [
    {
      "row": 3,
      "documentID": "11111111",
      "firstName": "Pedro",
      "reason": "Documento duplicado en el archivo"
    },
    {
      "row": 4,
      "documentID": "22222222",
      "firstName": "Sofía",
      "reason": "El número de teléfono debe tener exactamente 10 dígitos"
    },
    {
      "row": 6,
      "documentID": null,
      "firstName": "",
      "reason": "El documento es obligatorio"
    }
  ]
}
```

### 4.3 Error 400 — archivo no válido

```jsonc
{
  "message": "El archivo no es un archivo válido"
}
```

---

## 5. Decisiones de naming y denominación

- ✅ Recurso API plural: `members` (`/api/members`), conforme a `AGENTS.md` §4.
- ✅ Subrecurso de acción: `/api/members/bulk` (verbo `POST`).
- ✅ Cabeceras del Excel en español de negocio, tal como salen del Google Form.
- ✅ Identificadores TypeScript en inglés (`bulkImportResultSchema`, `BulkImportResult`).
- ✅ Mensajes de error en español, legibles para el Sponsor.
- ✅ No se expone `_id` de Mongo en el reporte de insertados; solo `row`, `documentID`,
  `firstName`, `lastName`.
- ✅ Formatos aceptados: `.xlsx` y `.csv`; ambos con las mismas cabeceras y validaciones.

---

## 6. Auditoría

- **[AUDIT-PENDING]**: la acción `members.bulkImport` con contexto
  `{ total, insertedCount, failedCount }` quedará registrada cuando el módulo de auditoría
  exista. Sigue el patrón documentado en ADR-0001 §ET-1.
- El `backend-engineer` debe invocar al servicio de auditoría existente tras una importación
  exitosa (archivo válido), sin bloquear la respuesta al usuario.

---

## 7. Excepciones a `AGENTS.md` y temas a escalar

Ninguna excepción bloqueante. Items a confirmar:

1. **(E-1)** El endpoint devuelve `200 OK` aunque haya errores de fila. Esto es una decisión
   de negocio del Sponsor (ver el reporte completo). No se usa `207 Multi-Status` porque el
   éxito/fracaso no es por recurso individual sino por operación de importación.
2. **(E-2)** El límite de 5 MB se documenta como configuración de multer en backend. Si el
   Sponsor requiere un límite diferente, se actualizará este contrato.

---

## 8. Verificación de autosuficiencia del artefacto

- ✅ Endpoint con método, ruta, roles, content-type, campo file (`.xlsx` o `.csv`), mimetypes aceptados y límite.
- ✅ Cabeceras del Excel/CSV y mapeo a campos de `UserProfile`.
- ✅ Validaciones por fila y reglas de negocio (`ministry` vs `ministryInterest`).
- ✅ Criterio de deduplicación (archivo + BD).
- ✅ Estrategia de inserción parcial (`insertMany` con `ordered: false`).
- ✅ Shape de respuesta `200 OK` y códigos de error `400`, `401`, `403`, `413`.
- ✅ Schemas zod formales en `frontend/src/types/index.ts`.
- ✅ Cliente API esperado en `frontend/src/api/MemberAPI.ts`.
- ✅ Ejemplos de request, respuesta 200 y error 400.
- ✅ Nota de auditoría pendiente.

---

_Fin del artefacto. Custodia: `api-contract-engineer`. Cualquier divergencia detectada
durante la implementación debe abrirse como nuevo drift en este documento y notificarse
al `chief-architect`._
