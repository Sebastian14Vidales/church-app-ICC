import { Request, Response } from 'express';
import Course from '../models/Course';

export class CourseController {

    //get all courses
    static getAllCourses = async (req: Request, res: Response) => {
        try {
            const courses = await Course.find({});
            res.status(200).json(courses);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener cursos', error });
        }
    }

    //create a new course
    static createCourse = async (req: Request, res: Response) => {
        const course = new Course(req.body);
        try {
            await course.save();
            res.send("Curso creado exitosamente");
            console.log("Curso creado exitosamente");
        } catch (error) {
            res.status(500).json({ message: 'Error al crear curso', error });
        }
    }

    //get course by id
    static getCourseById = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const course = await Course.findById(id);
            if (!course) {
                return res.status(404).json({ message: 'Curso no encontrado' });
            }
            res.status(200).json(course);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener curso', error });
        }
    }

    //update course by id
    static updateCourse = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const course = await Course.findByIdAndUpdate(id, req.body, { new: true });
            if (!course) {
                return res.status(404).json({ message: 'Curso no encontrado' });
            }
            res.status(200).json(course);
        } catch (error) {
            res.status(500).json({ message: 'Error al actualizar curso', error });
        }
    }

    // delete course by id
    static deleteCourse = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const course = await Course.findByIdAndDelete(id);
            if (!course) {
                return res.status(404).json({ message: 'Curso no encontrado' });
            }
            res.status(200).json({ message: 'Curso eliminado exitosamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error al eliminar curso', error });
        }
    }
}