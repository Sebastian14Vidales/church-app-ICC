/**
 * Query keys del modulo Cursos (contract section 0).
 * Centralizadas para que hooks y mutaciones invaliden las mismas llaves que
 * emite el backend via realtime (ver `lib/realtime.ts`/`RealtimeBridge`).
 */

export const courseKeys = {
    all: ["courses"] as const,
    catalog: (query: Record<string, unknown> = {}) => ["courses", "list", query] as const,
    detail: (id: string) => ["courses", "detail", id] as const,
};

export const courseAssignmentKeys = {
    all: ["courseAssignments"] as const,
    active: (query: Record<string, unknown> = {}) => ["courseAssignments", "active", query] as const,
    history: (query: Record<string, unknown> = {}) => ["courseHistory", query] as const,
    detail: (id: string) => ["courseAssignment", "detail", id] as const,
};

export const myCourseKeys = {
    all: ["myCourses"] as const,
    active: () => ["myCourses", "active"] as const,
    history: () => ["myCourses", "history"] as const,
};

export const myAttendanceKeys = {
    all: ["myAttendance"] as const,
    overview: () => ["myAttendance", "overview"] as const,
};