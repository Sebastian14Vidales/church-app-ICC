import { type CourseAssignedStatus, type CourseLevel } from "@/types/index"

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
    basic: "Basico",
    intermediate: "Intermedio",
    advanced: "Avanzado",
}

/**
 * Etiquetas de estado de CourseAssigned (contract §5.2, ADR-0001 §D2).
 * `cancelled` se eliminó del enum. Se usa `Partial<Record<...>>` para mantener
 * compatibilidad transitoria con tipos legacy (`CourseAssignedStatus` aún
 * incluye `cancelled` mientras `quality-engineer` no cierre la limpieza); el
 * consumidor hace fallback a `assignment.status`.
 */
export const COURSE_STATUS_LABELS: Partial<Record<CourseAssignedStatus, string>> = {
    active: "Activo",
    completed: "Finalizado",
}

/**
 * Chips de estado de CourseAssigned accesibles WCAG AA (ADR-0001 §AC4.7).
 * Se usan tonos `*-600/700` con texto blanco y borde del mismo tono:
 * el estado NO se comunica solo por color (el texto lo acompana) y el
 * contraste cumple >= 4.5:1 para texto normal/bold pequeno (>= 3:1 UI).
 */
export const COURSE_STATUS_BADGE_STYLES: Partial<Record<CourseAssignedStatus, string>> = {
    active: "bg-emerald-600 text-white border border-emerald-700",
    completed: "bg-slate-500 text-white border border-slate-600",
}

export const COURSE_LEVEL_OPTIONS: Array<{ value: CourseLevel; label: string }> = [
    { value: "basic", label: COURSE_LEVEL_LABELS.basic },
    { value: "intermediate", label: COURSE_LEVEL_LABELS.intermediate },
    { value: "advanced", label: COURSE_LEVEL_LABELS.advanced },
]

/**
 * Chips de nivel de curso accesibles WCAG AA (ADR-0001 §AC4.7).
 * Tonos `sky/amber/rose` en ``-600/-700`` con texto blanco y borde:
 * evita colores crudos (green-400/yellow-400/red-400) que con ``-800``
 * no alcanzaban contraste AA. El nivel tambien se lee en el texto del
 * chip (`COURSE_LEVEL_LABELS`), por lo que el color no es el unico canal.
 */
export const COURSE_LEVEL_BADGE_STYLES: Record<CourseLevel, string> = {
    basic: "bg-sky-600 text-white border border-sky-700",
    intermediate: "bg-amber-600 text-white border border-amber-700",
    advanced: "bg-rose-700 text-white border border-rose-800",
}
