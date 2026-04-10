import { Router } from "express";
import { body, param } from "express-validator";
import { CourseController } from "../controller/course.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { ADMIN_ROLES, MY_COURSES_ROLES, SUPERADMIN_ROLES } from "../utils/auth.utils";

const router = Router();

router.use(authenticate);

// Route to post a new course with validation
router.post(
  "/",
  authorizeRoles(ADMIN_ROLES),
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

router.get(
  "/my-courses",
  authorizeRoles(MY_COURSES_ROLES),
  CourseController.findMyAssignments,
);

router.get(
  "/my-attendance",
  authorizeRoles(MY_COURSES_ROLES),
  CourseController.findMyAttendanceOverview,
);

router.post(
  "/assignments",
  authorizeRoles(ADMIN_ROLES),
  body("course").isMongoId().withMessage("El curso seleccionado no es válido"),
  body("professor").isMongoId().withMessage("El profesor seleccionado no es válido"),
  body("startDate")
    .isISO8601()
    .withMessage("La fecha de inicio es obligatoria"),
  body("startTime")
    .notEmpty()
    .withMessage("La hora de inicio es obligatoria"),
  body("totalClasses")
    .isInt({ min: 1 })
    .withMessage("El total de clases debe ser mayor a 0"),
  body("location").notEmpty().withMessage("El salón es obligatorio"),
  body("status")
    .optional()
    .isIn(["active", "completed", "cancelled"])
    .withMessage("El estado no es válido"),
  handleInputErrors,
  CourseController.assignCourse,
);

router.put(
  "/assignments/:id",
  authorizeRoles(SUPERADMIN_ROLES),
  param("id").isMongoId().withMessage("La asignacion no es valida"),
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
  CourseController.updateAssignment,
);

router.delete(
  "/assignments/:id",
  authorizeRoles(SUPERADMIN_ROLES),
  param("id").isMongoId().withMessage("La asignacion no es valida"),
  handleInputErrors,
  CourseController.removeAssignment,
);

router.patch(
  "/assignments/:id/members",
  authorizeRoles(["Profesor", "Admin", "Superadmin"]),
  param("id").isMongoId().withMessage("La asignacion no es valida"),
  body("memberIds")
    .isArray()
    .withMessage("Debes enviar un arreglo de miembros"),
  body("memberIds.*")
    .isMongoId()
    .withMessage("Todos los miembros deben ser validos"),
  handleInputErrors,
  CourseController.updateAssignmentMembers,
);

router.patch(
  "/my-courses/:id/close",
  authorizeRoles(["Profesor", "Admin", "Superadmin"]),
  param("id").isMongoId().withMessage("La asignacion no es valida"),
  handleInputErrors,
  CourseController.closeMyAssignment,
);

router.put(
  "/my-attendance/classes/:classNumber",
  authorizeRoles(MY_COURSES_ROLES),
  param("classNumber")
    .isInt({ min: 1 })
    .withMessage("El numero de clase no es valido"),
  body("attendance")
    .isArray()
    .withMessage("Debes enviar un arreglo de asistencia"),
  body("attendance.*.studentId")
    .isMongoId()
    .withMessage("Cada estudiante debe ser valido"),
  body("attendance.*.present")
    .isBoolean()
    .withMessage("El estado de asistencia debe ser booleano"),
  body("attendance.*.notes")
    .optional()
    .isString()
    .withMessage("La nota de asistencia debe ser texto"),
  body("topic")
    .optional()
    .isString()
    .withMessage("El tema debe ser texto"),
  body("observations")
    .optional()
    .isString()
    .withMessage("Las observaciones deben ser texto"),
  handleInputErrors,
  CourseController.saveMyAttendance,
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
  authorizeRoles(ADMIN_ROLES),
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
  authorizeRoles(ADMIN_ROLES),
  param("id").isMongoId().withMessage("ID de curso inválido"),
  handleInputErrors,
  CourseController.remove,
);

export default router;
