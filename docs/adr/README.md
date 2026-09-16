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
| [ADR-0014](0014-spiritual-growth-stage-ninguna.md) | Opción "Ninguna" en la ruta de crecimiento espiritual del perfil de miembro | Aceptado | 2026-09-09 |
| [ADR-0015](0015-life-groups-supervisor-assignment.md) | Asignación explícita de supervisor en grupos de vida (fix de cobertura invisible) | Aceptado | 2026-09-09 |
| [ADR-0016](0016-seed-non-destructive-roles.md) | Seed no destructivo para roles y bootstrap de superadmin sin credenciales hardcodeadas | Aceptado | 2026-09-09 |
| [ADR-0017](0017-courses-attendance-export-close-hint.md) | Cursos: exportación Excel de asistencia y cierre sugerido | Aceptado | 2026-09-09 |
| [ADR-0018](0018-life-groups-attendees-leader-owned.md) | El roster de asistentes del grupo de vida lo gestiona el Líder | Aceptado (implementado) | 2026-09-12 |
| [ADR-0019](0019-frontend-render-hardening.md) | Hardening de render frontend: selección estable, defaults de React Query y scroll único | Aceptado | 2026-09-12 |
| [ADR-0020](0020-dashboard-admin-only-role-landing.md) | Dashboard exclusivo para Admin/Superadmin y rutas de aterrizaje por rol | Aceptado (implementado) | 2026-09-15 |
| [ADR-0021](0021-notifications-inapp-bell-realtime.md) | Notificaciones in-app con campanita (módulo `Notification` + realtime) | Aceptado (implementado) | 2026-09-15 |
| [ADR-0022](0022-ministries-catalog-2026-single-source.md) | Nuevo catálogo oficial de ministerios (14) con fuente única y migración | Aceptado (implementado) | 2026-09-15 |

---

*Para proponer un nuevo ADR, seguir el flujo canonico descrito en `AGENTS.md` §7 y
mantener el formato de los registros existentes.*
