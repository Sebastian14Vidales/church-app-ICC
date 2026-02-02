import { type CourseFormData } from '@/types/index';
import api from '@/lib/axios';

export const createCourse = async (formData: CourseFormData) => {
    try {
        const { data } = await api.post('/courses', formData);
        console.log("Course created:", data);
        return data;
    } catch (error) {
        console.error("Error creating course:", error);
    }
}

