import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
    courseAssignmentKeys,
    courseKeys,
    myAttendanceKeys,
    myCourseKeys,
} from "@/hooks/courses/query-keys";
import { useAuth } from "@/lib/auth";
import {
    getActiveCourseAssignments,
    getAllCourses,
    getCourseAssignmentById,
    getCourseAssignmentHistory,
    getMyActiveCourseAssignments,
    getMyAttendanceOverview,
    getMyCourseAssignmentHistory,
} from "@/api/CourseAPI";
import type {
    CourseAssignedCanonical,
    CourseAssignedHistoryItem,
    AttendanceOverview,
    PaginatedCourses,
    CourseListQuery,
    CourseAssignmentListQuery,
    CourseAssignmentHistoryQuery,
} from "@/types/index";

const isSuperadmin = (roles: readonly string[] | undefined) =>
    Boolean(roles?.includes("Superadmin"));

export const useAllCourses = (
    query: Partial<CourseListQuery> = {},
    options?: Omit<UseQueryOptions<PaginatedCourses>, "queryKey" | "queryFn">,
) =>
    useQuery({
        queryKey: courseKeys.catalog(query),
        queryFn: () => getAllCourses(query),
        ...options,
    });

export const useActiveCourseAssignments = (
    query: Partial<CourseAssignmentListQuery> = {},
) =>
    useQuery({
        queryKey: courseAssignmentKeys.active(query),
        queryFn: () => getActiveCourseAssignments(query),
    });

export const useCourseAssignmentHistory = (
    query: Partial<CourseAssignmentHistoryQuery> = {},
) =>
    useQuery({
        queryKey: courseAssignmentKeys.history(query),
        queryFn: () => getCourseAssignmentHistory(query),
    });

export const useCourseAssignmentDetail = (
    id: string | null | undefined,
    enabled = true,
) =>
    useQuery({
        queryKey: courseAssignmentKeys.detail(id ?? "unknown"),
        queryFn: () => getCourseAssignmentById(id as string),
        enabled: Boolean(id) && enabled,
    });

/**
 * Asignaciones activas del usuario autenticado (profesor o miembro/asistente).
 * El backend deriva la query segun el rol (E-1, contract section 3.1).
 */
export const useMyActiveCourseAssignments = () =>
    useQuery<CourseAssignedCanonical[]>({
        queryKey: myCourseKeys.active(),
        queryFn: getMyActiveCourseAssignments,
    });

/**
 * Historial de asignaciones del usuario autenticado (E-1, contract section 3.2).
 */
export const useMyCourseAssignmentHistory = () =>
    useQuery<CourseAssignedCanonical[]>({
        queryKey: myCourseKeys.history(),
        queryFn: getMyCourseAssignmentHistory,
    });

/**
 * Overview de asistencia del profesor autenticado (contract section 4.1).
 * Solo para TEACHING_ROLES.
 */
export const useMyAttendanceOverview = (
    options?: Omit<UseQueryOptions<AttendanceOverview>, "queryKey" | "queryFn">,
) =>
    useQuery({
        queryKey: myAttendanceKeys.overview(),
        queryFn: getMyAttendanceOverview,
        ...options,
    });

/**
 * Detalle de una asignacion para el tab "Historial" del profesor. El Superadmin
 * puede reabrir, por lo que el detalle queda habilitado para ambos roles.
 */
export const useReopenableAssignmentDetail = (
    id: string | null | undefined,
    enabled = true,
) => {
    const { user } = useAuth();
    return useQuery<CourseAssignedHistoryItem>({
        queryKey: courseAssignmentKeys.detail(id ?? "unknown"),
        queryFn: () => getCourseAssignmentById(id as string),
        enabled: Boolean(id) && enabled && isSuperadmin(user?.roles),
    });
};