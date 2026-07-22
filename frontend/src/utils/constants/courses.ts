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

export const COURSE_STATUS_BADGE_STYLES: Partial<Record<CourseAssignedStatus, string>> = {
    active: "bg-emerald-100 text-emerald-800",
    completed: "bg-slate-200 text-slate-800",
}

export const COURSE_LEVEL_OPTIONS: Array<{ value: CourseLevel; label: string }> = [
    { value: "basic", label: COURSE_LEVEL_LABELS.basic },
    { value: "intermediate", label: COURSE_LEVEL_LABELS.intermediate },
    { value: "advanced", label: COURSE_LEVEL_LABELS.advanced },
]

export const COURSE_LEVEL_BADGE_STYLES: Record<CourseLevel, string> = {
    basic: "bg-green-400 text-green-800",
    intermediate: "bg-yellow-400 text-yellow-800",
    advanced: "bg-red-400 text-red-800",
}
