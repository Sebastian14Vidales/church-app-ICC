import { type CourseAssignedStatus, type CourseLevel } from "@/types/index"

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
    basic: "Basico",
    intermediate: "Intermedio",
    advanced: "Avanzado",
}

export const COURSE_STATUS_LABELS: Record<CourseAssignedStatus, string> = {
    active: "Activo",
    completed: "Completado",
    cancelled: "Cancelado",
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
