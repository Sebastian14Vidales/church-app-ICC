# Indice de Decisiones de Arquitectura (ADRs)

Este directorio agrupa las Decisiones de Arquitectura (Architecture Decision Records)
ratificadas por el `chief-architect` para el proyecto ICC Casa de Dios.

Cada ADR documenta una decision importante de diseno, su contexto, las alternativas
consideradas y las consecuencias para el sistema.

| ADR | Titulo | Estado | Fecha |
| --- | ------ | ------ | ----- |
| [ADR-0001](0001-courses-history-refactor.md) | Refactor del modulo de Cursos: historial, soft-delete y eliminacion de `cancelled` | Aceptado | 2026-07-21 |
| [ADR-0002](0002-reconcile-models-drift.md) | Reconciliacion del drift de modelos entre `AGENTS.md §6` y `opencode.json` | Aceptado | 2026-07-21 |
| [ADR-0003](0003-security-hardening-deps.md) | Hardening de seguridad transversal (`helmet` + `express-rate-limit`) | Aceptado | 2026-07-21 |
| [ADR-0004](0004-thinking-orbs-loading-spinner.md) | Loading spinner unificado con `thinking-orbs` | Aceptado | 2026-07-21 |
| [ADR-0005](0005-session-storage-localStorage.md) | Sesion compartida entre pestanas con `localStorage` | Aceptado | 2026-07-21 |
| [ADR-0006](0006-course-growth-mapping.md) | Vinculacion de cursos con etapas de crecimiento espiritual y avance automatico | Aceptado | 2026-07-21 |
| [ADR-0007](0007-finanzas-gobierno-stage.md) | Nueva etapa de crecimiento espiritual: "Finanzas y Gobierno" | Aceptado | 2026-07-21 |
| [ADR-0008](0008-events-history-excel.md) | Historial de eventos y exportacion Excel de inscritos | Aceptado | 2026-08-04 |
| [ADR-0009](0009-course-cascade-hard-delete.md) | Borrado fisico en cascada para el catalogo de `Course` | Aceptado | 2026-08-07 |
| [ADR-0010](0010-members-bulk-import.md) | Bulk import de miembros/asistentes desde Excel | Aceptado | 2026-08-08 |
| [ADR-0011](0011-life-groups-leader-remove-predicas-ui-tweaks.md) | Grupos de vida con rol Lider, retirada de Predicas y ajustes de UI | Aceptado | 2026-08-17 |
| [ADR-0012](0012-bulk-import-duplicate-columns.md) | Tolerancia a columnas duplicadas por secciones condicionales de Google Forms en el bulk import | Aceptado | 2026-08-23 |
| [ADR-0013](0013-bulk-import-profession-date-formats.md) | Profesión opcional y tolerancia de formatos de fecha en el bulk import | Aceptado | 2026-09-07 |

---

*Para proponer un nuevo ADR, seguir el flujo canonico descrito en `AGENTS.md` §7 y
mantener el formato de los registros existentes.*
