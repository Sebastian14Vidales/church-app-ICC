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
  handleInputErrors,
  CourseController.create,
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
