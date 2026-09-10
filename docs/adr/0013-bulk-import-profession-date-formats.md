# ADR-0013 — Profesión opcional y tolerancia de formatos de fecha en el bulk import de miembros

- **Estado**: Aceptado
- **Fecha**: 2026-09-07
- **Custodio**: `chief-architect`
- **Decisión**: propuesta por el `chief-architect` a partir de un pedido directo del Sponsor
  (captura de asistentes vía Google Form) y ratificada en este registro.
- **Supersedes**: nada (extiende ADR-0010 y ADR-0012).
- **Relacionados**: [ADR-0010](0010-members-bulk-import.md),
  [ADR-0012](0012-bulk-import-duplicate-columns.md).

## Contexto

El Sponsor registra asistentes en un **Google Form** y sube el export (.xlsx/.csv) al endpoint
`POST /api/members/bulk` (ADR-0010). Dos fricciones reales:

1. **Formato de `Fecha de nacimiento`.** `parseDateCell`
   (`backend/src/services/member-bulk-import.service.ts`) solo acepta hoy dos formas exactas:
   ISO `YYYY-MM-DD` y latino `DD/MM/YYYY` con día y mes de **exactamente dos dígitos**. Todo lo
   demás se rechaza con `"La fecha de nacimiento no es válida"`. Formatos que el Sponsor puede
   recibir o digitar legítimamente en el Form y que hoy **fallan**:
   - `19/8/1999` (día/mes de un dígito — Google Sheets con locale `es` suele exportar sin cero).
   - `31-12-2026` / `8-8-1999` (separador `-` en lugar de `/`; caso documentado como error en
     `docs/functional/members-bulk-import.md` y cubierto como error en los tests actuales).
   - **Serial numérico de Excel**: si el Sponsor descarga `.xlsx` desde Google (Formularios →
     hoja de respuestas → descargar .xlsx), la celda de fecha es una fecha real y SheetJS (con
     `raw: true`, configuración actual) la entrega como **número serial**, no como texto. Hoy
     `parseDateCell` lo stringifica ("36394") y lo rechaza.

2. **Profesión.** El campo `profession` **ya existe** en todo el stack: `UserProfile.profession`
   (`user-profile.model.ts`, string opcional), CRUD individual (`POST/PUT /api/members` con
   `normalizeProfession`), formulario manual (`MemberForm.tsx`), filtros y tarjetas
   (`MemberFilters.tsx`, `Members.tsx`). Sin embargo, el bulk import **no lo importa**:
   `HEADER_MAP` no contiene la cabecera y el contrato (`docs/api/members-bulk-import.md`)
   lo declara "fuera del alcance". El Google Form del Sponsor **ya incluye** la pregunta
   *Profesión* — duplicada en las dos ramas de las secciones condicionales (ver ADR-0012) —
   por lo que el export ya trae esa(s) columna(s).

El Sponsor pide: (a) que el formato de fecha que coloca en el Form sea aceptado, (b) que la
fecha se persista como **fecha** (no como texto) y (c) incorporar la profesión al import.

## Decisión

### D1 — Import de `Profesión` como columna opcional

- `HEADER_MAP` gana la entrada `"profesion": "profession"` (cabecera normalizada, sin tilde,
  conforme a `normalizeHeader`). El `HeaderKey` y `ParsedCandidate` ganan `profession`.
- La columna **es opcional**: las 12 cabeceras obligatorias de ADR-0010 se mantienen intactas.
  Un export sin columna *Profesión* sigue siendo válido (compatibilidad con exports previos y
  con el contrato vigente hasta hoy).
- Si la columna aparece (una o varias veces, ver ADR-0012), se consolida con la regla
  **primer valor no vacío** y se persiste en `UserProfile.profession` solo si el valor
  normalizado no es vacío; en caso contrario el campo queda `undefined` (no `""`).
- El valor es **texto libre**: `trim`, sin enum, igual que el CRUD individual. No se añade
  validación de formato más allá del trim (mismo criterio que `profession` en
  `POST /api/members`).

#### D1.1 — Normalización Unicode de cabeceras (enmienda posterior a la primera implementación)

Durante la regresión se detectó que `normalizeHeader` (trim + lowercase) **no elimina
tildes**, mientras que la pregunta del Form se llama *Profesión* (con tilde): el export real
traería la cabecera `Profesión` → normalizada `profesión` → **sin match** contra la clave
`profesion` de `HEADER_MAP`; la columna quedaría invisible y el campo no se importaría.

Decisión: `normalizeHeader` canoniza con **NFD + eliminación de diacríticos**
(`value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` antes de trim/lowercase). Así
`Profesión` → `profesion` (y `Teléfono` → `telefono`, `Ministerio de interés` →
`ministerio de interes`), blindando también variantes con tilde de las 12 cabeceras
históricas. No introduce ambigüedad: solo canoniza equivalencias Unicode, no acepta cabeceras
nuevas.

### D2 — `parseDateCell` tolerante a los formatos reales de Google Forms/Excel

`parseDateCell(value: unknown): Date | null` acepta, en este orden:

1. **`value instanceof Date`** (defensivo, por si en el futuro se activa `cellDates` en SheetJS):
   toma componentes UTC, valida el año y devuelve medianoche local `new Date(y, m - 1, d)`.
2. **`typeof value === "number"`** (serial de Excel, fracciones = hora): `days = Math.floor(value)`,
   fecha UTC = `1899-12-30 + days` (base estándar de Excel para fechas ≥ 1900-03-01), se extraen
   componentes UTC y se devuelve `new Date(y, m - 1, d)` local, descartando la hora.
3. **Texto** (tras `normalizeString`):
   - ISO relajado: `^(\d{4})-(\d{1,2})-(\d{1,2})$` → `y, m, d`.
   - Day-first con separador homogéneo `/` o `-`: `^(\d{1,2})([\/\-])(\d{1,2})\2(\d{4})$`
     → `d, m, y`. Acepta 1 o 2 dígitos en día/mes (cubre `19/8/1999`, `08-08-2026`).

En todos los casos se mantiene la **validación round-trip** existente (reconstruir
`new Date(y, m-1, d)` y verificar `getFullYear/getMonth/getDate` contra los componentes) y se
añade una **guarda de plausibilidad**: el año resultante debe estar en `[1900, 2100]`. Cualquier
otra forma (incluidas fechas en texto largo tipo `19 de agosto de 1999`, años de 2 dígitos y
formato US `MM/DD/YYYY`) sigue siendo **inválida**.

**Interpretación day-first**: para separadores `/` y `-` el primer componente es el **día**
(locale español del Sponsor). El sistema **no** adivina formato US; `8/19/1999` se rechaza
(el round-trip falla porque 19 no es mes). Esto evita corrupción silenciosa de datos.

### D3 — Persistencia como `Date`, sin cambios de esquema ni de endpoint

- `birthdate` sigue siendo `Schema.Types.Date` en `UserProfile` (ya lo es hoy); `parseDateCell`
  siempre devuelve un `Date` o `null`. **No** se persisten strings. Este ADR lo garantiza para
  los formatos nuevos, incluido el serial de Excel (número → `Date`).
- Sin cambios de endpoint, método, roles, límites ni shape de respuesta `BulkImportResult`.
  Sin migraciones: `profession` ya existía en la colección.
- Se construye siempre `new Date(y, m-1, d)` (medianoche **local** del servidor), igual que el
  comportamiento actual de los dos formatos ya soportados; no se introducen cambios de zona
  horaria.

### D4 — Mensajes de error sin cambios

Se conservan los mensajes existentes: `"La fecha de nacimiento es obligatoria"` (celda vacía) y
`"La fecha de nacimiento no es válida"` (formato no reconocible o fecha imposible). La profesión
no genera errores (es opcional y libre).

### D5 — Alcance

- `backend/src/services/member-bulk-import.service.ts` (única unidad de código afectada:
  `HEADER_MAP`, `HeaderKey`, `ParsedCandidate`, `validateRow`, `parseDateCell`, `toInsertDocs`).
- `docs/api/members-bulk-import.md` (contrato: nueva fila de mapeo + formatos de fecha).
- `docs/functional/members-bulk-import.md` (guía del Sponsor).
- `backend/tests/services/member-bulk-import.service.test.ts` (regresión).
- **Sin cambios** en: `user-profile.model.ts`, `user-profile.routes.ts`,
  `user-profile.controller.ts`, `upload.middleware.ts`, ni en ningún archivo del frontend.

## Alternativas consideradas

- **A1 — Rediseñar el Google Form para forzar un único formato (pregunta tipo Fecha).**
  Útil como recomendación (queda en la doc funcional) pero insuficiente: el export `.xlsx`
  entrega seriales aunque la pregunta sea tipo Fecha, y no se puede exigir al Sponsor que
  nunca edite el archivo en Excel.
- **A2 — Aceptar "cualquier cosa" con `new Date(texto)` / `Date.parse`.** Rechazada: acepta
  `MM/DD/YYYY` (ambigüedad con inversión día/mes → corrupción silenciosa), dependencia de zona
  horaria del runtime y textos largos en español con resultados impredecibles.
- **A3 — Normalizar en el frontend antes de subir.** Rechazada por `AGENTS.md` §3 (no lógica de
  negocio en el cliente) y por duplicar esfuerzo (misma regla en cada pantalla de carga).
- **A4 — Hacer obligatoria la columna Profesión.** Rechazada: rompería exports previos y el
  Form permite responderla vacía; el modelo ya la trata como opcional.
- **A5 — Soportar años de 2 dígitos (`19/08/99`).** Rechazada por ambigüedad (¿1899 o 1999?);
  el error con mensaje claro es más seguro que adivinar.
- **A6 — Mapear solo la variante con tilde (`"profesión"`) en `HEADER_MAP`.** Rechazada: no
  generaliza (dejaría de matchear exports con `Profesion` sin tilde) y no blinda el mismo
  problema en otras cabeceras. Se prefiere la canonización Unicode de D1.1.

## Consecuencias

- **+** El Sponsor puede subir exports de Google Forms con los formatos de fecha que realmente
  entrega la herramienta (texto day-first con o sin ceros, guiones, y `.xlsx` con celdas de
  fecha reales) sin errores de validación espurios.
- **+** La profesión capturada en el Form queda persistida en el perfil del asistente desde el
  import, sin trabajo manual posterior; visible en tarjetas, edición y filtros existentes.
- **+** `birthdate` sigue siendo un `Date` real en Mongo para todos los caminos.
- **−** Un número "cualquiera" en la columna de fecha se interpreta como serial de Excel; la
  guarda de año `[1900, 2100]` mitiga los absurdos, pero sigue siendo una suposición documentada.
- **−** El test actual `CASO-5c` ('31-12-2026' → error) queda **obsoleto** y debe invertirse a
  caso positivo (el formato pasa a ser válido); es un cambio intencional de contrato.
- **−** Mantener dos sistemas de fecha (texto + serial) añade complejidad moderada a
  `parseDateCell`, compensada por la cobertura de pruebas.

## Cumplimiento

- `AGENTS.md` §3: la lógica vive en `services/`; nada de esto se calcula en el cliente.
- `AGENTS.md` §5: `birthdate` es `Date`; `profession` ya existía en el esquema (sin drift).
- `AGENTS.md` §8: la validación sigue siendo whitelist explícita de formatos; no se aceptan
  entradas ambiguas.
- `AGENTS.md` §9: se exigen pruebas de regresión (formatos positivos/negativos, profesión
  presente/ausente/duplicada/evitando `""`).

## Dueños de implementación

- `api-contract-engineer`: `docs/api/members-bulk-import.md` (mapeo de `Profesión` como
  opcional, formatos de fecha aceptados, nota de compatibilidad).
- `backend-engineer`: `backend/src/services/member-bulk-import.service.ts`.
- `testing-engineer`: `backend/tests/services/member-bulk-import.service.test.ts`.
- `doc-keeper`: `docs/functional/members-bulk-import.md`.
- `chief-architect`: este ADR y el índice `docs/adr/README.md`.

## Referencias

- `backend/src/services/member-bulk-import.service.ts` — `parseDateCell`, `HEADER_MAP`,
  `validateRow`, `toInsertDocs`.
- `backend/src/models/user-profile.model.ts` — `birthdate: Date`, `profession?: string`.
- `docs/api/members-bulk-import.md` — contrato del endpoint.
- `docs/adr/0012-bulk-import-duplicate-columns.md` — consolidación de columnas duplicadas
  (reutilizada por la columna Profesión del Form con secciones condicionales).
