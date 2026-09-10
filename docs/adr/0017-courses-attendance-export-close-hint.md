# ADR-0017 — Cursos: exportación Excel de asistencia y cierre sugerido

- **Estado**: Aceptado
- **Fecha**: 2026-09-09
- **Custodio**: `chief-architect`
- **Tema**: Quick wins pre-lanzamiento del módulo de cursos
- **Contrato**: especificado por `chief-architect` en este ADR (additivo y acotado);
  `doc-keeper` lo materializa en `docs/api/courses-api.md`.

## Contexto

Dos necesidades operativas inmediatas para el lanzamiento:

1. Los pastores/líderes necesitan **reportes imprimibles** de asistencia y resultados por
   curso (hoy solo Eventos exporta Excel, ADR-0008; el patrón técnico ya existe).
2. El **cierre de curso** (`status: completed`) es 100% manual y "invisible": ni el
   profesor ni el admin reciben ninguna señal de que un curso ya tiene todas sus clases
   registradas y debería finalizar (el cierre dispara el avance de etapa de quienes
   aprobaron, ADR-0006 D4/D5).

## Decisión

### D1 — Endpoint de exportación Excel de asistencia

`GET /api/courses/assignments/:id/attendance/export`

- **Auth**: `Admin`/`Superadmin` siempre; `Profesor` solo si es el profesor de ESA
  asignación (403 en caso contrario).
- **Respuesta 200**: binario `.xlsx` (`Content-Type:
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  `Content-Disposition: attachment; filename="asistencia-<curso>-<YYYYMMDD>.xlsx"`),
  siguiendo el patrón de `event.controller.ts` (ADR-0008; dependencia `xlsx` ya existe).
- **Hoja "Asistencia"**, una fila por miembro inscrito, con columnas:
  `Nombre | Apellidos | Documento | Etapa de crecimiento | Clases presentes | Clases
  registradas | % asistencia | Resultado` — donde `Resultado` = "Aprobó" si
  `attendanceRate >= 70` (regla ADR-0006 D4), "No alcanzó el 70%" en caso contrario.
  El cálculo de asistencia reutiliza la lógica del overview existente
  (`attendance.service`): clases no registradas cuentan como ausencia.
- Errores: 404 (asignación no existe), 403 (sin permiso). Una asignación sin miembros
  exporta solo la cabecera (200).

### D2 — `registeredSessions` en el payload canónico de `CourseAssigned`

Se añade el campo **`registeredSessions: number`** (int ≥ 0, sesiones de clase
registradas para la asignación) a TODAS las serializaciones canónicas de
`CourseAssigned` (listado admin, my-courses de profesor, detalle). Cambio **aditivo** y
retrocompatible; el frontend lo declara requerido en `courseAssignedCanonicalSchema`
(convergencia backend↔frontend en la misma tanda).

### D3 — UI: exportación y "Listo para finalizar"

- **Botón "Exportar Excel"**: en `AttendanceView` (profesor) y en la vista de
  asignaciones del admin (`Courses.tsx`). Descarga vía `responseType: "blob"` con el
  mismo mecanismo que ya usa el frontend de Eventos.
- **"Listo para finalizar"**: cuando `status === "active" && registeredSessions >=
  totalClasses`:
  - `Courses.tsx` (admin, asignaciones activas): badge "Listo para finalizar".
  - `MyCoursesProfessor` (curso actual): badge junto a la acción de finalizar existente.
  - `AttendanceView`: banner "Has registrado todas las clases (N/N). ¿Finalizar el
    curso?" destacando el botón de cierre **ya existente**.
- NO se crea lógica nueva de cierre: se reutilizan los endpoints/mutaciones existentes
  (`POST /assignments/:id/close` / `reopen`, ADR-0001).

## Cambios esperados

- Backend: `course-assignment.routes.ts` (+ruta export), `course-assignment.controller.ts`
  (+handler), `course-assignment.service.ts` (+export, +`registeredSessions` en
  serializaciones), reutilización de `attendance.service`.
- Frontend: `types/index.ts` (`registeredSessions`), `CourseAPI.ts` (+`exportAttendanceExcel`),
  `AttendanceView.tsx`, `Courses.tsx`, `MyCoursesProfessor.tsx`.
- Docs: `docs/api/courses-api.md` (endpoint D1 + campo D2), índice de ADRs.

## Consecuencias

### Positivas

- Reportes imprimibles para el ministerio sin trabajo manual (Excel).
- El cierre de cursos deja de depender de la memoria del admin/profesor: la señal
  aparece exactamente cuando el curso cumple sus clases.
- Cambio aditivo: cero breaking changes en el contrato.

### Negativas / trade-offs

- `registeredSessions` añade una consulta de conteo por asignación serializada
  (aceptable: listas paginadas pequeñas y volumen bajo de la iglesia).
- El Excel es un snapshot (no "en vivo"): suficiente para el caso de uso.

## Alternativas consideradas

- **Export CSV en lugar de XLSX**: descartada; el patrón XLSX ya existe (ADR-0008) y el
  ministerio usa Excel/Google Sheets con formato.
- **Auto-cierre del curso al registrar la última clase**: descartada por ahora; el
  cierre es una decisión administrativa (y dispara avance de etapas). Se sugiere, no se
  automatiza.

## Riesgos vigilados

- Permisos del export: un profesor no debe exportar cursos de otros (403).
- Consistencia del cálculo de `%` con el overview (misma fuente de verdad).
- `quality-engineer`/`testing-engineer` verifican ausencia de drift del campo
  `registeredSessions` entre capas.

## Referencias

- `docs/adr/0006-course-growth-mapping.md` (regla 70%), `docs/adr/0008-events-history-excel.md`
  (patrón de export), `docs/adr/0001-courses-history-refactor.md` (close/reopen).
- `backend/src/controller/event.controller.ts` (~líneas 540-590: patrón XLSX).
- `backend/src/services/course-assignment.service.ts`, `backend/src/services/attendance.service.ts`.
- `frontend/src/api/CourseAPI.ts`, `frontend/src/pages/courses/AttendanceView.tsx`,
  `frontend/src/pages/courses/Courses.tsx`, `frontend/src/pages/courses/MyCoursesProfessor.tsx`.
