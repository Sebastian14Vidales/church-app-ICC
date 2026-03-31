import { Router } from "express";
import { body, param } from "express-validator";
import { CourseController } from "../controller/course.controller";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

// Route to post a new course with validation
router.post(
  "/",
  body("name").notEmpty().withMessage("El nombre del curso es obligatorio"),
  body("description")
    .notEmpty()
    .withMessage("La descripción del curso es obligatoria"),
  body("level")
    .isIn(["basic", "intermediate", "advanced"])
    .withMessage("El nivel del curso debe ser 'basic', 'intermediate' o 'advanced'"),
  handleInputErrors,
  CourseController.create,
);

router.get("/assignments", CourseController.findAssignments);

router.post(
  "/assignments",
  body("course").isMongoId().withMessage("El curso seleccionado no es valido"),
  body("professor").isMongoId().withMessage("El profesor seleccionado no es valido"),
  body("startDate")
    .isISO8601()
    .withMessage("La fecha de inicio es obligatoria"),
  body("startTime")
    .notEmpty()
    .withMessage("La hora de inicio es obligatoria"),
  body("totalClasses")
    .isInt({ min: 1 })
    .withMessage("El total de clases debe ser mayor a 0"),
  body("location").notEmpty().withMessage("El salon es obligatorio"),
  body("status")
    .optional()
    .isIn(["active", "completed", "cancelled"])
    .withMessage("El estado no es valido"),
  handleInputErrors,
  CourseController.assignCourse,
);

// Route to get all courses
router.get("/", CourseController.findAll);
//Route to get a course by ID with validation
router.get(
  "/:id",
  param("id").isMongoId().withMessage("ID de curso inválido"),
  handleInputErrors,
  CourseController.findById,
);

// Route to update a course by ID
router.put(
  "/:id",
  param("id").isMongoId().withMessage("ID de curso inválido"),
  body("name").notEmpty().withMessage("El nombre del curso es obligatorio"),
  body("description")
    .notEmpty()
    .withMessage("La descripción del curso es obligatoria"),
  body("isActive").isBoolean().withMessage("El estado debe ser true o false"),
  handleInputErrors,
  CourseController.update,
);

// Route to delete a course
router.delete(
  "/:id",
  param("id").isMongoId().withMessage("ID de curso inválido"),
  handleInputErrors,
  CourseController.remove,
);

export default router;

