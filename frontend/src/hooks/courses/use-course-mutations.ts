import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import {
    courseAssignmentKeys,
    courseKeys,
    myAttendanceKeys,
    myCourseKeys,
} from "@/hooks/courses/query-keys";
import {
    assignCourse,
    closeCourseAssignment,
    createCourse,
    reopenCourseAssignment,
    softDeleteCourse,
    softDeleteCourseAssignment,
    updateCourse,
    updateCourseAssignment,
    updateCourseMembers,
} from "@/api/CourseAPI";
import { useAuth } from "@/lib/auth";
import type {
    CourseAssignedCanonical,
    CourseAssignmentCreateBody,
    CourseFormData,
    ReopenAssignmentBody,
} from "@/types/index";

const ASSIGNMENT_RELATED_KEYS = [
    courseAssignmentKeys.all,
    myCourseKeys.all,
    myAttendanceKeys.all,
] as const;

const HISTORY_AND_ACTIVE_KEYS = [
    ["courseHistory"] as const,
    ["courseAssignments"] as const,
] as const;

export const useCreateCourse = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: CourseFormData) => createCourse(body),
        onSuccess: (message) => {
            toast.success(message);
            queryClient.invalidateQueries({ queryKey: courseKeys.all });
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useUpdateCourse = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ courseId, formData }: { courseId: string; formData: CourseFormData }) =>
            updateCourse(courseId, formData),
        onSuccess: () => {
            toast.success("Curso actualizado");
            queryClient.invalidateQueries({ queryKey: courseKeys.all });
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useSoftDeleteCourse = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (courseId: string) => softDeleteCourse(courseId),
        onSuccess: (message) => {
            toast.success(message);
            queryClient.invalidateQueries({ queryKey: courseKeys.all });
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useAssignCourse = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: CourseAssignmentCreateBody) => assignCourse(body),
        onSuccess: (message) => {
            toast.success(message);
            ASSIGNMENT_RELATED_KEYS.forEach((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            );
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useUpdateCourseAssignment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            assignmentId,
            body,
        }: {
            assignmentId: CourseAssignedCanonical["_id"];
            body: Partial<CourseAssignmentCreateBody>;
        }) => updateCourseAssignment(assignmentId, body),
        onSuccess: (message) => {
            toast.success(message);
            ASSIGNMENT_RELATED_KEYS.forEach((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            );
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useSoftDeleteCourseAssignment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (assignmentId: CourseAssignedCanonical["_id"]) =>
            softDeleteCourseAssignment(assignmentId),
        onSuccess: (message) => {
            toast.success(message);
            HISTORY_AND_ACTIVE_KEYS.forEach((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            );
            queryClient.invalidateQueries({ queryKey: myCourseKeys.all });
            queryClient.invalidateQueries({ queryKey: myAttendanceKeys.all });
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useUpdateCourseMembers = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            assignmentId,
            memberIds,
        }: {
            assignmentId: CourseAssignedCanonical["_id"];
            memberIds: string[];
        }) => updateCourseMembers(assignmentId, memberIds),
        onSuccess: (message) => {
            toast.success(message);
            ASSIGNMENT_RELATED_KEYS.forEach((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            );
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

export const useCloseCourseAssignment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (assignmentId: CourseAssignedCanonical["_id"]) =>
            closeCourseAssignment(assignmentId),
        onSuccess: (message) => {
            toast.success(message);
            // Backend emite `courseAssignments.closed` y `courseHistory.changed`.
            HISTORY_AND_ACTIVE_KEYS.forEach((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            );
            queryClient.invalidateQueries({ queryKey: myCourseKeys.all });
            queryClient.invalidateQueries({ queryKey: myAttendanceKeys.all });
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};

/**
 * Reapertura de un curso completado. Solo disponible para Superadmin
 * (contract section 2.9). El `useAuth()` queda como doble validacion frente al
 * guard de ruta: si un componente lanza la mutacion sin permiso, el backend
 * responde 403 y el `onError` lo muestra; ademas no deberia poder hacerlo la UI
 * (boton visible solo para Superadmin en el tab Historial).
 */
export const useReopenCourseAssignment = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    return useMutation({
        mutationFn: ({
            assignmentId,
            body,
        }: {
            assignmentId: CourseAssignedCanonical["_id"];
            body?: ReopenAssignmentBody;
        }) => {
            if (!user?.roles.includes("Superadmin")) {
                throw new Error("No tienes permisos para reabrir el curso");
            }
            return reopenCourseAssignment(assignmentId, body);
        },
        onSuccess: (message) => {
            toast.success(message);
            // Backend emite `courseHistory.changed` Y `courseAssignments.changed`.
            HISTORY_AND_ACTIVE_KEYS.forEach((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            );
            queryClient.invalidateQueries({ queryKey: myCourseKeys.all });
        },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error"),
    });
};