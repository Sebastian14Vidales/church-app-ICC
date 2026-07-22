import { Router } from "express";
import { body, param } from "express-validator";
import { AttendanceController } from "../controller/attendance.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { TEACHING_ROLES } from "../utils/auth.utils";

/**
 * Router de asistencia ( ADR-0001 §D1 ).
 * Montado en `/api/courses` (mismo prefijo; se conserva por contrato público).
 *
 * Se monta DESPUÉS de `course-assignment.routes.ts` y ANTES del catálogo.
 */
const router = Router();

router.use(authenticate);

router.get(
  "/my-attendance",
  authorizeRoles(TEACHING_ROLES),
  AttendanceController.getOverview,
);

router.put(
  "/my-attendance/classes/:classNumber",
  authorizeRoles(TEACHING_ROLES),
  param("classNumber")
    .isInt({ min: 1 })
    .withMessage("El número de clase no es válido"),
  body("attendance").isArray().withMessage("Debes enviar un arreglo de asistencia"),
  body("attendance.*.studentId")
    .isMongoId()
    .withMessage("Cada estudiante debe ser válido"),
  body("attendance.*.present")
    .isBoolean()
    .withMessage("El estado de asistencia debe ser booleano"),
  body("attendance.*.notes")
    .optional()
    .isString()
    .withMessage("La nota de asistencia debe ser texto"),
  body("topic").optional().isString().withMessage("El tema debe ser texto"),
  body("observations")
    .optional()
    .isString()
    .withMessage("Las observaciones deben ser texto"),
  handleInputErrors,
  AttendanceController.saveClassAttendance,
);

export default router;