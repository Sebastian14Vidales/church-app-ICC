import { dashboardCourseSchema, type CourseFormData } from '@/types/index';
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

