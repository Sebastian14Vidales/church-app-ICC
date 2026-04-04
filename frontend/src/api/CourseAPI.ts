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
        throw error;
    }
}

export const getAllCourses = async () => {
    try {
        const { data } = await api.get('/courses');
        const response = dashboardCourseSchema.safeParse(data);
        if(response.success) {
            return response.data;
        }
        throw new Error("Respuesta de cursos inválida");
    } catch (error) {
        console.error("Error retrieving courses:", error);
        throw error;
    }
}

export const getCourseAssignments = async (): Promise<CourseAssigned[]> => {
    try {
        const { data } = await api.get('/courses/assignments');
        const response = assignedCoursesSchema.safeParse(data);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de asignaciones de cursos invalida");
    } catch (error) {
        console.error("Error retrieving course assignments:", error);
        throw error;
    }
}

export const getMyCourseAssignments = async (): Promise<CourseAssigned[]> => {
    try {
        const { data } = await api.get('/courses/my-courses');
        const response = assignedCoursesSchema.safeParse(data);

        if (response.success) {
            return response.data;
        }

        throw new Error("Respuesta de mis cursos invalida");
    } catch (error) {
        console.error("Error retrieving my course assignments:", error);
        throw error;
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
        throw error;
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
        throw error;
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
        throw error;
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
        throw error;
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
        throw error
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
        throw error
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
        throw error
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
        throw error
    }
}
