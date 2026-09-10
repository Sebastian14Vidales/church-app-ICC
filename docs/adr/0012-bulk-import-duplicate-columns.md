# ADR-0012 — Tolerancia a columnas duplicadas por secciones condicionales de Google Forms en el bulk import de miembros

- **Estado**: Aceptado
- **Fecha**: 2026-08-23
- **Custodio**: `chief-architect`
- **Decisión**: propuesta por el `chief-architect` tras diagnosticar una incidencia real del Sponsor y ratificada como mejora de robustez.
- **Supersedes**: nada (extiende ADR-0010).
- **Relacionados**: [ADR-0010](0010-members-bulk-import.md).

## Contexto

El bulk import de miembros/asistentes (ADR-0010) exige que la primera fila del archivo contenga
**exactamente** las 12 cabeceras definidas en el contrato, sin repeticiones. La función
`buildHeaderIndex` (`backend/src/services/member-bulk-import.service.ts`) construye un
`Map<HeaderKey, number>` que asocia cada cabecera al **índice de su columna**. Cuando una
cabecera aparece más de una vez, la implementación actual **se queda con la primera columna y
descarta las siguientes**:

```ts
if (!header || seenHeaders.has(header)) return; // salta la 2ª aparición
```

El Sponsor registra a los asistentes mediante un **Google Form** que utiliza la lógica de
**"Ir a la sección según la respuesta"** para la pregunta *"Sirve en un ministerio"*:

- Si el respondiente contesta **"Sí"** → el formulario lo dirige a una sección que contiene sus
  propias copias de *Ruta de crecimiento espiritual*, *Encuentro y Reencuentro* y *Profesión*.
- Si contesta **"No"** → lo dirige a **otra sección** con **otras copias** de esas mismas
  preguntas.

Al exportar las respuestas a `.xlsx`/`.csv`, Google Forms vuelca **todas** las columnas de
**todas** las secciones, aunque cada respondiente solo haya recorrido una rama. El resultado es
que las cabeceras *Ruta de crecimiento espiritual*, *Encuentro y Reencuentro* y *Profesión*
aparecen **dos veces** en columnas distintas.

### Incidencia real

Para una respondiente que contestó **"No"** (fila 2 del export):

- La columna de la rama "Sí" para *Ruta de crecimiento espiritual* quedó **vacía**.
- La columna de la rama "No" para *Ruta de crecimiento espiritual* contenía el valor válido
  (`Carácter cristiano`).

El sistema leyó la **primera** columna (la de la rama "Sí", vacía) e ignoró la segunda, por lo
que reportó:

```
[members.bulkImport] fila_invalida {
  rowNumber: 2,
  documentID: '111563828',
  firstName: 'Anyil',
  reason: 'La ruta de crecimiento espiritual es obligatoria'
}
```

El valor existía, pero en una columna que el sistema nunca consultó. Solo fallan las filas de
quienes tomaron la rama cuya columna no es la primera para cada cabecera duplicada.

### Estado previo relevante

- `HEADER_MAP` mapea el texto normalizado de la cabecera al `HeaderKey`.
- `buildHeaderIndex` devuelve `Map<HeaderKey, number>` (un solo índice por clave).
- `getCellValue` devuelve `row[index]` (o `""` si no hay índice).
- El chequeo de cabeceras faltantes usa `indexByKey.has(HEADER_MAP[header])`.

## Decisión

### D1 — Consolidación de columnas duplicadas (primer valor no vacío)

`buildHeaderIndex` pasará a recolectar **todos** los índices de columna que mapean a un mismo
`HeaderKey`, preservando el orden de aparición (leftmost first). El tipo de retorno cambia de
`Map<HeaderKey, number>` a `Map<HeaderKey, number[]>`.

`getCellValue` recorrerá los índices asociados a la clave y devolverá el **primer valor no
vacío**. Si todos están vacíos, devolverá `""` (comportamiento equivalente al actual para una
celda vacía).

### D2 — Definición de "celda vacía"

Una celda se considera vacía cuando `normalizeString(cell) === ""`. Las celdas numéricas
(`documentID`, `phoneNumber` pueden llegar como número desde Excel) se stringifican vía
`String(value ?? "")`, igual que hoy. No se introduce noción de "blanco-vs-undefined": ambos se
tratan como vacío.

### D3 — Regla de desempate (conflicto)

Si dos columnas duplicadas estuvieran **ambas** llenas para una misma fila, gana la **columna
más a la izquierda** (la primera en orden de aparición). Con las secciones condicionales de
Google Forms este conflicto **no ocurre** en la práctica, porque cada respondiente solo llena
las columnas de la rama que recorrió; la regla es determinística por seguridad.

### D4 — Chequeo de cabeceras faltantes (sin cambio de comportamiento)

Un `HeaderKey` se considera presente si existe **al menos una** columna que mapee a él
(`indexByKey.has(key)` con un arreglo no vacío). Si **ninguna** columna mapea a una cabecera
obligatoria, se mantiene el error global `El archivo no es un archivo válido` (línea actual del
servicio). Es decir: el archivo sigue necesitando las 12 cabeceras, pero ahora admite que alguna
aparezca repetida.

### D5 — Alcance

Solo `backend/src/services/member-bulk-import.service.ts` (funciones `buildHeaderIndex` y
`getCellValue`, y el chequeo de `missingHeaders` que ya opera sobre el `Map`). No hay cambios de
esquema Mongoose, ni de endpoints, ni de rutas, ni de dependencias. El contrato
`docs/api/members-bulk-import.md` se actualiza para declarar la tolerancia a cabeceras
duplicadas y la regla de consolidación.

### D6 — Compatibilidad hacia atrás

Archivos con **una sola columna** por cabecera (el caso hasta hoy) se comportan **idénticamente**:
el `Map` contendrá arreglos de un solo elemento y `getCellValue` devolverá esa única celda. No
hay riesgo de regresión para los exports existentes sin secciones condicionales.

## Alternativas consideradas

- **A1 — Rediseñar el Google Form del Sponsor a una sola sección sin saltos condicionales.**
  Útil como **recomendación** (se incluye en la doc funcional) pero insuficiente como única
  solución: traslada la carga al Sponsor y cualquier formulario futuro con secciones
  condicionales volvería a romper. El backend debe ser robusto ante un patrón legítimo y
  habitual de Google Forms.
- **A2 — Consolidar columnas en el frontend antes de subir.** Rechazada: viola `AGENTS.md` §3
  (no lógica de negocio en el cliente) y el contrato API es la autoridad. Además duplicaría
  esfuerzo en cada pantalla de carga.
- **A3 — Rechazar el archivo con un error más claro cuando detecte cabeceras duplicadas.**
  Rechazada: rompe un patrón de Google Forms perfectamente válido y frustra al Sponsor, que
  debería consolidar a mano en cada export.

## Consecuencias

- **+** El Sponsor puede subir exports de Google Forms con secciones condicionales sin
  consolidación manual.
- **+** El sistema es robusto ante un patrón real y frecuente de la herramienta de captura.
- **−** Aumento menor de complejidad en `buildHeaderIndex`/`getCellValue` (despreciable).
- **−** Suposición implícita: las columnas duplicadas contienen datos **semánticamente
  equivalentes** entre ramas. Es válido para secciones condicionales de Google Forms; si un
  formulario futuro reutilizara una etiqueta de cabecera para un concepto genuinamente distinto,
  la consolidación podría enmascarar un error. Mitigación: el contrato sigue exigiendo el set
  exacto de etiquetas; la consolidación solo aplica a **repeticiones** de la misma etiqueta.

## Cumplimiento

- `AGENTS.md` §3: la lógica vive en `services/`, sin lógica de negocio en el cliente.
- `AGENTS.md` §8: la validación de los **valores** contra los enums se conserva íntegra; solo
  cambia de qué columna se lee el valor.
- `AGENTS.md` §9: se exigen pruebas de regresión (caso de la fila "No" con columnas duplicadas).

## Dueños de implementación

- `backend-engineer`: `backend/src/services/member-bulk-import.service.ts`.
- `api-contract-engineer`: `docs/api/members-bulk-import.md` (declarar tolerancia a duplicados y
  regla de consolidación).
- `testing-engineer`: pruebas de regresión en
  `backend/tests/services/member-bulk-import.service.test.ts`.
- `doc-keeper`: `docs/functional/members-bulk-import.md` (recomendar una sola sección en Google
  Forms, pero aclarar que el sistema ya tolera secciones condicionales).
- `chief-architect`: este ADR y el índice `docs/adr/README.md`.

## Referencias

- `backend/src/services/member-bulk-import.service.ts` — `buildHeaderIndex`, `getCellValue`,
  `validateRow`.
- `docs/api/members-bulk-import.md` — contrato del endpoint.
- `docs/functional/members-bulk-import.md` — guía del Sponsor.
