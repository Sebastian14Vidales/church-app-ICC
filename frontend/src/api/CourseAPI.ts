import { dashboardCourseSchema, type CourseFormData, type Course } from '@/types/index';
import api from '@/lib/axios';

export const createCourse = async (formData: CourseFormData) => {
    try {
        
        const { data } = await api.post('/courses', formData);
        console.log("Course created:", data);
        return data;
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

export const updateCourse = async (courseId: Course['_id'], formData: CourseFormData) => {
    try {
        const { data } = await api.put(`/courses/${courseId}`, {
            ...formData,
            isActive: true,
        });
        return data;
    } catch (error) {
        console.error("Error updating course:", error);
        throw error;
    }
}

export const deleteCourse = async (courseId: Course['_id']) => {
    try {
        const { data } = await api.delete(`/courses/${courseId}`);
        return data;
    } catch (error) {
        console.error("Error deleting course:", error);
        throw error;
    }
}

