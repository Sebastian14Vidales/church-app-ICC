import {
    attendanceOverviewSchema,
    assignedCoursesSchema,
    dashboardCourseSchema,
    messageResponseSchema,
    type AttendanceOverview,
    type CourseAssigned,
    type CourseAssignedFormData,
    type CourseFormData,
    type Course,
} from '@/types/index';
import api from '@/lib/axios';
import axios from "axios";

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

export const createCourse = async (formData: CourseFormData): Promise<string> => {
    try {
        const { data } = await api.post('/courses', formData);
        const response = messageResponseSchema.safeParse(data);

        if (response.success) {
            return response.data.message;
        }

        if (typeof data === "string") {
            return data;
        }

        throw new Error("Respuesta de creacion de curso invalida");
    } catch (error) {
        console.error("Error creating course:", error);
        throw new Error(getApiErrorMessage(error, "No se pudo crear el curso"));
    }
}

export const getAllCourses = async () => {
    try {
        const { data } = await api.get('/courses');
        const normalizedData = Array.isArray(data)
            ? data
            : Array.isArray(data?.courses)
                ? data.courses
                : data;
        const response = dashboardCourseSchema.safeParse(normalizedData);
        if(response.success) {
            return response.data;
        }
        throw new Error("Respuesta de cursos inválida");
    } catch (error) {
        console.error("Error retrieving courses:", error);
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener los cursos"));
    }
}

export const getCourseAssignments = async (): Promise<CourseAssigned[]> => {
    try {
        const { data } = await api.get('/courses/assignments');
        const normalizedData = Array.isArray(data)
            ? data
            : Array.isArray(data?.assignments)
                ? data.assignments
                : data;
        const response = assignedCoursesSchema.safeParse(normalizedData);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de asignaciones de cursos invalida");
    } catch (error) {
        console.error("Error retrieving course assignments:", error);
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener las asignaciones"));
    }
}

export const getMyCourseAssignments = async (): Promise<CourseAssigned[]> => {
    try {
        const { data } = await api.get('/courses/my-courses');
        const normalizedData = Array.isArray(data)
            ? data
            : Array.isArray(data?.assignments)
                ? data.assignments
                : data;
        const response = assignedCoursesSchema.safeParse(normalizedData);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de mis cursos invalida");
    } catch (error) {
        console.error("Error retrieving my course assignments:", error);
        throw new Error(getApiErrorMessage(error, "No se pudieron obtener tus cursos"));
    }
}

export const getMyAttendanceOverview = async (): Promise<AttendanceOverview> => {
    try {
        const { data } = await api.get('/courses/my-attendance');
        const response = attendanceOverviewSchema.safeParse(data);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de asistencias invalida");
    } catch (error) {
        console.error("Error retrieving attendance overview:", error);
        throw new Error(getApiErrorMessage(error, "No se pudo obtener la asistencia"));
    }
}

export const updateCourse = async (courseId: Course['_id'], formData: CourseFormData): Promise<string> => {
    try {
        const { data } = await api.put(`/courses/${courseId}`, {
            ...formData,
            isActive: true,
        });
        const response = messageResponseSchema.safeParse(data);

        if (response.success) {
            return response.data.message;
        }

        throw new Error("Respuesta de actualizacion de curso invalida");
    } catch (error) {
        console.error("Error updating course:", error);
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar el curso"));
    }
}

export const deleteCourse = async (courseId: Course['_id']): Promise<string> => {
    try {
        const { data } = await api.delete(`/courses/${courseId}`);
        const response = messageResponseSchema.safeParse(data);

        if (response.success) {
            return response.data.message;
        }

        throw new Error("Respuesta de eliminacion de curso invalida");
    } catch (error) {
        console.error("Error deleting course:", error);
        throw new Error(getApiErrorMessage(error, "No se pudo eliminar el curso"));
    }
}

export const assignCourse = async (formData: CourseAssignedFormData) => {
    try {
        const { data } = await api.post('/courses/assignments', formData);
        const response = messageResponseSchema.safeParse(data);

        if (response.success) {
            return response.data.message;
        }

        throw new Error("Respuesta de asignacion de curso invalida");
    } catch (error) {
        console.error("Error assigning course:", error);
        throw new Error(getApiErrorMessage(error, "No se pudo asignar el curso"));
    }
}

export const updateCourseAssignment = async (
    assignmentId: CourseAssigned["_id"],
    formData: CourseAssignedFormData,
) => {
    try {
        const { data } = await api.put(`/courses/assignments/${assignmentId}`, formData)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de actualizacion de asignacion invalida")
    } catch (error) {
        console.error("Error updating course assignment:", error)
        throw new Error(getApiErrorMessage(error, "No se pudo actualizar la asignacion"))
    }
}

export const deleteCourseAssignment = async (assignmentId: CourseAssigned["_id"]) => {
    try {
        const { data } = await api.delete(`/courses/assignments/${assignmentId}`)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de eliminacion de asignacion invalida")
    } catch (error) {
        console.error("Error deleting course assignment:", error)
        throw new Error(getApiErrorMessage(error, "No se pudo eliminar la asignacion"))
    }
}

export const updateCourseMembers = async (
    assignmentId: CourseAssigned["_id"],
    memberIds: string[],
) => {
    try {
        const { data } = await api.patch(`/courses/assignments/${assignmentId}/members`, { memberIds })
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de actualizacion de miembros invalida")
    } catch (error) {
        console.error("Error updating course members:", error)
        throw new Error(getApiErrorMessage(error, "No se pudieron actualizar los miembros del curso"))
    }
}

export const closeMyCourseAssignment = async (assignmentId: CourseAssigned["_id"]) => {
    try {
        const { data } = await api.patch(`/courses/my-courses/${assignmentId}/close`)
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de cierre de curso invalida")
    } catch (error) {
        console.error("Error closing my course assignment:", error)
        throw new Error(getApiErrorMessage(error, "No se pudo cerrar el curso"))
    }
}

export const saveMyClassAttendance = async (
    classNumber: number,
    attendance: Array<{ studentId: string; present: boolean; notes?: string }>,
) => {
    try {
        const { data } = await api.put(`/courses/my-attendance/classes/${classNumber}`, { attendance })
        const response = messageResponseSchema.safeParse(data)

        if (response.success) {
            return response.data.message
        }

        throw new Error("Respuesta de guardado de asistencia invalida")
    } catch (error) {
        console.error("Error saving class attendance:", error)
        throw new Error(getApiErrorMessage(error, "No se pudo guardar la asistencia"))
    }
}
