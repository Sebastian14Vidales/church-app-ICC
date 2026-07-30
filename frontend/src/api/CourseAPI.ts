import axios from "axios";

import api from "@/lib/axios";
import {
    assignmentMembersBodySchema,
    assignmentMutationResponseSchema,
    attendanceOverviewSchema,
    courseAssignedArraySchema,
    courseAssignedHistoryItemSchema,
    courseAssignmentCreateBodySchema,
    courseAssignmentUpdateBodySchema,
    courseCatalogSchema,
    assignedCoursesSchema,
    paginatedCourseAssignedSchema,
    paginatedCoursesSchema,
    reopenAssignmentBodySchema,
    messageResponseSchema,
    type AttendanceOverview,
    type CourseAssigned,
    type CourseAssignedCanonical,
    type CourseAssignedHistoryItem,
    type CourseAssignmentCreateBody,
    type CourseAssignmentHistoryQuery,
    type CourseAssignmentListQuery,
    type CourseCatalog,
    type CourseFormData,
    type CourseListQuery,
    type PaginatedCourseAssignments,
    type PaginatedCourses,
    type ReopenAssignmentBody,
} from "@/types/index";

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
            | { message?: string; errors?: Array<{ msg?: string }> }
            | undefined;

        if (responseData?.message) {
            return responseData.message;
        }

        const firstValidationError = responseData?.errors?.[0]?.msg;
        if (firstValidationError) {
            return firstValidationError;
        }
    }

    return fallbackMessage;
};

/**
 * Normaliza la envoltura de la respuesta del backend: si llega un array plano
 * (formato transitorio) lo envuelve en `PaginatedResponse`; si ya viene
 * paginado, lo pasa por el schema del contrato formal.
 */
const wrapIfArray = (data: unknown) =>
    Array.isArray(data)
        ? { items: data, total: data.length, page: 1, limit: data.length }
        : data;

const parseCoursesPagination = (data: unknown): PaginatedCourses => {
    const parsed = paginatedCoursesSchema.safeParse(wrapIfArray(data));
    if (parsed.success) return parsed.data;
    throw new Error("Respuesta de cursos invalida");
};

const parseAssignmentsPagination = (data: unknown): PaginatedCourseAssignments => {
    const parsed = paginatedCourseAssignedSchema.safeParse(wrapIfArray(data));
    if (parsed.success) return parsed.data;
    throw new Error("Respuesta de asignaciones invalida");
};

const buildCourseListQueryParams = (query?: Partial<CourseListQuery>): Record<string, string> => {
    const params: Record<string, string> = {};
    if (query?.name) params.name = query.name;
    if (query?.level) params.level = query.level;
    if (typeof query?.isActive === "boolean") params.isActive = String(query.isActive);
    if (query?.page) params.page = String(query.page);
    if (query?.limit) params.limit = String(query.limit);
    return params;
};

const buildAssignmentListQueryParams = (
    query?: Partial<CourseAssignmentListQuery>,
): Record<string, string> => {
    const params: Record<string, string> = {};
    if (query?.status) params.status = query.status;
    if (query?.page) params.page = String(query.page);
    if (query?.limit) params.limit = String(query.limit);
    return params;
};

const buildHistoryQueryParams = (
    query?: Partial<CourseAssignmentHistoryQuery>,
): Record<string, string> => {
    const params: Record<string, string> = {};
    if (query?.professor) params.professor = query.professor;
    if (query?.location) params.location = query.location;
    if (query?.page) params.page = String(query.page);
    if (query?.limit) params.limit = String(query.limit);
    return params;
};

// ---------------------------------------------------------------------------
// Catalogo - Course
// ---------------------------------------------------------------------------

export const createCourse = async (formData: CourseFormData): Promise<string> => {
    try {
        const body = {
            name: formData.name,
            description: formData.description,
            level: formData.level,
            spiritualGrowthStage: formData.spiritualGrowthStage,
            isActive: true,
        };
        const { data } = await api.post("/courses", body);
        const parsed = messageResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        if (typeof data === "string") return data;
        throw new Error("Respuesta de creacion de curso invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo crear el curso"));
    }
};

export const getAllCourses = async (
    query?: Partial<CourseListQuery>,
): Promise<PaginatedCourses> => {
    try {
        const { data } = await api.get("/courses", { params: buildCourseListQueryParams(query) });
        return parseCoursesPagination(data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener los cursos"));
    }
};

export const updateCourse = async (
    courseId: CourseCatalog["_id"],
    formData: CourseFormData,
): Promise<CourseCatalog> => {
    try {
        const body = {
            name: formData.name,
            description: formData.description,
            level: formData.level,
            spiritualGrowthStage: formData.spiritualGrowthStage,
            isActive: true,
        };
        const { data } = await api.put(`/courses/${courseId}`, body);
        const parsed = courseCatalogSchema.safeParse(data);
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de actualizacion de curso invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar el curso"));
    }
};

export const softDeleteCourse = async (courseId: CourseCatalog["_id"]): Promise<string> => {
    try {
        const { data } = await api.delete(`/courses/${courseId}`);
        const parsed = messageResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        throw new Error("Respuesta de eliminacion de curso invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo eliminar el curso"));
    }
};

/** @deprecated Usa `softDeleteCourse`. Alias transitorio para no romper consumidores legacy. */
export const deleteCourse = (courseId: CourseCatalog["_id"]) => softDeleteCourse(courseId);

// ---------------------------------------------------------------------------
// Asignaciones - CourseAssigned
// ---------------------------------------------------------------------------

export const getActiveCourseAssignments = async (
    query?: Partial<CourseAssignmentListQuery>,
): Promise<PaginatedCourseAssignments> => {
    try {
        const params = buildAssignmentListQueryParams({ status: "active", ...query });
        const { data } = await api.get("/courses/assignments", { params });
        return parseAssignmentsPagination(data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener las asignaciones"));
    }
};

export const getCourseAssignmentHistory = async (
    query?: Partial<CourseAssignmentHistoryQuery>,
): Promise<PaginatedCourseAssignments> => {
    try {
        const { data } = await api.get("/courses/assignments/history", {
            params: buildHistoryQueryParams(query),
        });
        return parseAssignmentsPagination(data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo obtener el historial de cursos"));
    }
};

export const getCourseAssignmentById = async (
    id: CourseAssignedCanonical["_id"],
): Promise<CourseAssignedHistoryItem> => {
    try {
        const { data } = await api.get(`/courses/assignments/${id}`);
        const parsed = courseAssignedHistoryItemSchema.safeParse(data);
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de detalle de asignacion invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo obtener la asignacion"));
    }
};

export const assignCourse = async (body: CourseAssignmentCreateBody): Promise<string> => {
    try {
        const valid = courseAssignmentCreateBodySchema.safeParse(body);
        if (!valid.success) {
            throw new Error("Datos de asignacion invalidos");
        }
        const { data } = await api.post("/courses/assignments", valid.data);
        const parsed = assignmentMutationResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        // Compat transitorio con respuestas que solo devuelven `{ message }`.
        const fallback = messageResponseSchema.safeParse(data);
        if (fallback.success) return fallback.data.message;
        throw new Error("Respuesta de asignacion de curso invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo asignar el curso"));
    }
};

export const updateCourseAssignment = async (
    assignmentId: CourseAssignedCanonical["_id"],
    body: Partial<CourseAssignmentCreateBody>,
): Promise<string> => {
    try {
        const valid = courseAssignmentUpdateBodySchema.safeParse(body);
        if (!valid.success) {
            throw new Error("Datos de actualizacion de asignacion invalidos");
        }
        const { data } = await api.put(`/courses/assignments/${assignmentId}`, valid.data);
        const parsed = assignmentMutationResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        const fallback = messageResponseSchema.safeParse(data);
        if (fallback.success) return fallback.data.message;
        throw new Error("Respuesta de actualizacion de asignacion invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar la asignacion"));
    }
};

export const softDeleteCourseAssignment = async (
    assignmentId: CourseAssignedCanonical["_id"],
): Promise<string> => {
    try {
        const { data } = await api.delete(`/courses/assignments/${assignmentId}`);
        const parsed = messageResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        throw new Error("Respuesta de eliminacion de asignacion invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo eliminar la asignacion"));
    }
};

export const updateCourseMembers = async (
    assignmentId: CourseAssignedCanonical["_id"],
    memberIds: string[],
): Promise<string> => {
    try {
        const valid = assignmentMembersBodySchema.safeParse({ memberIds });
        if (!valid.success) {
            throw new Error("Lista de miembros invalida");
        }
        // PATCH -> POST per contract section 7 (drift D-28).
        const { data } = await api.post(
            `/courses/assignments/${assignmentId}/members`,
            valid.data,
        );
        const parsed = assignmentMutationResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        const fallback = messageResponseSchema.safeParse(data);
        if (fallback.success) return fallback.data.message;
        throw new Error("Respuesta de actualizacion de miembros invalida");
    } catch (error) {
        throw new Error(
            getApiErrorMessage(error, "No se pudieron actualizar los miembros del curso"),
        );
    }
};

export const closeCourseAssignment = async (
    assignmentId: CourseAssignedCanonical["_id"],
): Promise<string> => {
    try {
        // PATCH /my-courses/:id/close -> POST /assignments/:id/close per contract section 7 (D-12, D-29).
        const { data } = await api.post(`/courses/assignments/${assignmentId}/close`);
        const parsed = messageResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        throw new Error("Respuesta de cierre de curso invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo cerrar el curso"));
    }
};

export const reopenCourseAssignment = async (
    assignmentId: CourseAssignedCanonical["_id"],
    body?: ReopenAssignmentBody,
): Promise<string> => {
    try {
        const valid = reopenAssignmentBodySchema.safeParse(body ?? {});
        if (!valid.success) {
            throw new Error("Datos de reapertura invalidos");
        }
        const { data } = await api.post(`/courses/assignments/${assignmentId}/reopen`, valid.data);
        const parsed = assignmentMutationResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        const fallback = messageResponseSchema.safeParse(data);
        if (fallback.success) return fallback.data.message;
        throw new Error("Respuesta de reapertura de curso invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo reabrir el curso"));
    }
};

// ---------------------------------------------------------------------------
// "my-courses" - datos del usuario autenticado
// ---------------------------------------------------------------------------

export const getMyActiveCourseAssignments = async (): Promise<CourseAssignedCanonical[]> => {
    try {
        const { data } = await api.get("/courses/my-courses");
        const parsed = courseAssignedArraySchema.safeParse(
            Array.isArray(data) ? data : data?.assignments ?? data,
        );
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de mis cursos invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener tus cursos"));
    }
};

export const getMyCourseAssignmentHistory = async (): Promise<CourseAssignedCanonical[]> => {
    try {
        const { data } = await api.get("/courses/my-courses/history");
        const parsed = courseAssignedArraySchema.safeParse(
            Array.isArray(data) ? data : data?.assignments ?? data,
        );
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de mi historial de cursos invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo obtener tu historial de cursos"));
    }
};

// ---------------------------------------------------------------------------
// Asistencia - attendance.routes.ts (se conserva)
// ---------------------------------------------------------------------------

export const getMyAttendanceOverview = async (): Promise<AttendanceOverview> => {
    try {
        const { data } = await api.get("/courses/my-attendance");
        const parsed = attendanceOverviewSchema.safeParse(data);
        if (parsed.success) return parsed.data;
        throw new Error("Respuesta de asistencias invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo obtener la asistencia"));
    }
};

export const saveMyClassAttendance = async (
    classNumber: number,
    attendance: Array<{ studentId: string; present: boolean; notes?: string }>,
): Promise<string> => {
    try {
        const { data } = await api.put(`/courses/my-attendance/classes/${classNumber}`, {
            attendance,
        });
        const parsed = messageResponseSchema.safeParse(data);
        if (parsed.success) return parsed.data.message;
        throw new Error("Respuesta de guardado de asistencia invalida");
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo guardar la asistencia"));
    }
};

// ---------------------------------------------------------------------------
// Aliases @deprecated (eliminados por `quality-engineer` al cierre de la epica)
// ---------------------------------------------------------------------------

/** @deprecated Usa `getActiveCourseAssignments`. Mantiene shape legacy `CourseAssigned[]`. */
export const getCourseAssignments = async (): Promise<CourseAssigned[]> => {
    const paginated = await getActiveCourseAssignments();
    // Re-parseada con el schema legacy (`assignedCourseSchema`) para strippear
    // `endedAt`/`deletedAt` y mantener el tipo historico que consumen Dashboard
    // y Reports hasta que `quality-engineer` los migre.
    const parsed = assignedCoursesSchema.safeParse(paginated.items);
    if (parsed.success) return parsed.data;
    return paginated.items as unknown as CourseAssigned[];
};

/** @deprecated Usa `getMyActiveCourseAssignments` (solo activas, E-1) o `getMyCourseAssignmentHistory`. */
export const getMyCourseAssignments = getMyActiveCourseAssignments;

/** @deprecated Usa `softDeleteCourseAssignment`. */
export const deleteCourseAssignment = (assignmentId: CourseAssigned["_id"]) =>
    softDeleteCourseAssignment(assignmentId as CourseAssignedCanonical["_id"]);

/** @deprecated Usa `closeCourseAssignment` (nueva ruta `POST /assignments/:id/close`). */
export const closeMyCourseAssignment = (assignmentId: CourseAssigned["_id"]) =>
    closeCourseAssignment(assignmentId as CourseAssignedCanonical["_id"]);