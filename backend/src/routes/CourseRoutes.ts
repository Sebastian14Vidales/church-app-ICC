import { Router } from 'express';
import { body, param } from 'express-validator';
import { CourseController } from '../controller/CourseController';
import { handleInputErrors } from '../middleware/validation';

const router = Router();

// Route to post a new course with validation
router.post('/', 
    body('name').notEmpty().withMessage('El nombre del curso es obligatorio'),
    body('description').notEmpty().withMessage('La descripción del curso es obligatoria'),
    handleInputErrors,
    CourseController.createCourse);

// Route to get all courses
router.get('/', CourseController.getAllCourses);

//Route to get a course by ID with validation
router.get('/:id',
    param('id').isMongoId().withMessage('ID de curso inválido'),
    handleInputErrors,
    CourseController.getCourseById);

// Route to update a course by ID
router.put('/:id', 
    param('id').isMongoId().withMessage('ID de curso inválido'),
    body('name').notEmpty().withMessage('El nombre del curso es obligatorio'),
    body('description').notEmpty().withMessage('La descripción del curso es obligatoria'),
    handleInputErrors,
    CourseController.updateCourse);

// Route to delete a course
router.delete('/:id',
    param('id').isMongoId().withMessage('ID de curso inválido'),
    handleInputErrors,
    CourseController.deleteCourse);

export default router;