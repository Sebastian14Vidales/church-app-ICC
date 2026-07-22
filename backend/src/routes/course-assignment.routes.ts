import { Router } from "express";
import { body, param, query } from "express-validator";
import { CourseAssignmentController } from "../controller/course-assignment.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { ADMIN_ROLES, SUPERADMIN_ROLES, TEACHING_ROLES } from "../utils/auth.utils";

/**
 * Router de asignaciones, miembros, close, reopen, my-courses ( ADR-0001 §D1 ).
 * Montado en `/api/courses` (mismo prefijo que el catálogo, ver `server.ts`).
 *
 * Se monta PRIMERO en `server.ts` para que las rutas estáticas
 * (`/assignments`, `/my-courses`, ...) sean interceptadas antes que el
 * `GET /:id` del catálogo.
 */
const router = Router();

router.use(authenticate);

router.get(
  "/assignments",
  query("status")
    .optional()
    .isIn(["active", "completed"])
    .withMessage("El estado no es válido"),
  query("page").optional().isInt({ min: 1 }).withMessage("page debe ser un entero mayor a 0"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit debe ser un entero entre 1 y 100"),
  handleInputErrors,
  CourseAssignmentController.findAll,
);

router.get(
  "/assignments/history",
  query("professor")
    .optional()
    .isMongoId()
    .withMessage("El profesor seleccionado no es válido"),
  query("location").optional().isString(),
  query("page").optional().isInt({ min: 1 }).withMessage("page debe ser un entero mayor a 0"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit debe ser un entero entre 1 y 100"),
  handleInputErrors,
  CourseAssignmentController.findHistory,
);

router.get(
  "/assignments/:id",
  param("id").isMongoId().withMessage("La asignacion no es válida"),
  handleInputErrors,
  CourseAssignmentController.findById,
);

router.post(
  "/assignments",
  authorizeRoles(ADMIN_ROLES),
  body("course").isMongoId().withMessage("El curso seleccionado no es válido"),
  body("professor").isMongoId().withMessage("El profesor seleccionado no es válido"),
  body("startDate").isISO8601().withMessage("La fecha de inicio es obligatoria"),
  body("startTime").notEmpty().withMessage("La hora de inicio es obligatoria"),
  body("totalClasses")
    .isInt({ min: 1 })
    .withMessage("El total de clases debe ser mayor a 0"),
  body("location").notEmpty().withMessage("El salón es obligatorio"),
  body("status")
    .optional()
    .isIn(["active", "completed"])
    .withMessage("El estado no es válido"),
  handleInputErrors,
  CourseAssignmentController.create,
);

router.put(
  "/assignments/:id",
  authorizeRoles(SUPERADMIN_ROLES),
  param("id").isMongoId().withMessage("La asignacion no es válida"),
  body("course").isMongoId().withMessage("El curso seleccionado no es válido"),
  body("professor").isMongoId().withMessage("El profesor seleccionado no es válido"),
  body("startDate").isISO8601().withMessage("La fecha de inicio es obligatoria"),
  body("startTime").notEmpty().withMessage("La hora de inicio es obligatoria"),
  body("totalClasses")
    .isInt({ min: 1 })
    .withMessage("El total de clases debe ser mayor a 0"),
  body("location").notEmpty().withMessage("El salón es obligatorio"),
  body("status")
    .optional()
    .isIn(["active", "completed"])
    .withMessage("El estado no es válido"),
  handleInputErrors,
  CourseAssignmentController.update,
);

router.delete(
  "/assignments/:id",
  authorizeRoles(SUPERADMIN_ROLES),
  param("id").isMongoId().withMessage("La asignacion no es válida"),
  handleInputErrors,
  CourseAssignmentController.remove,
);

router.post(
  "/assignments/:id/members",
  authorizeRoles(["Profesor", "Admin", "Superadmin"]),
  param("id").isMongoId().withMessage("La asignacion no es válida"),
  body("memberIds").isArray().withMessage("Debes enviar un arreglo de miembros"),
  body("memberIds.*").isMongoId().withMessage("Todos los miembros deben ser válidos"),
  handleInputErrors,
  CourseAssignmentController.addMembers,
);

// TODO[RATELIMIT-PENDING] ( D-32, AGENTS.md §8, ADR-0003 §D4 ): endpoint sensible
// de mutación de estado que requiere rate-limit específico más restrictivo que
// el `generalLimiter` de `server.ts` (este último ya cubre /api/* con
// 100 req/min por IP vía commit 62eeeec, cerrando la parte trasversal de ET-2).
// La dep `express-rate-limit` YA está instalada en `backend/package.json`
// (`^8.6.0`, aprobada en ADR-0003 §D1). El siguiente paso (pendiente del
// `auth-security-engineer`, ADR-0003 "Cierre de ET-2 / tareas pendientes") es
// montar el limiter específico `assignmentStateLimiter` (max: 20/min) en
// `/assignments/:id/close` y `/assignments/:id/reopen`, ANTES de
// `authorizeRoles(...)` para short-circuitar 429 antes de procesar JWT/rol, y
// entonces retirar ambos bloques `TODO[RATELIMIT-PENDING]`. Patrón contratado:
//
//   import rateLimit from "express-rate-limit";
//   const assignmentStateLimiter = rateLimit({
//     windowMs: 60_000,
//     max: 20,
//     standardHeaders: true,
//     legacyHeaders: false,
//     message: { message: "Demasiadas solicitudes de cambio de estado. Intenta más tarde." },
//   });
//   router.post("/assignments/:id/close",  assignmentStateLimiter, authorizeRoles(...), ...);
//   router.post("/assignments/:id/reopen", assignmentStateLimiter, authorizeRoles(...), ...);
//
// `max: 20/min` se justifica: el cierre/reabertura es una acción
// administrativa rara (1 vez por curso al finalizar / eventual corrección); un
// mismo operador razonablemente no ejecuta más de 20 mutaciones/minuto ni bajo
// carga legítima. Más restrictivo que el limit general para reducir abuso de
// reaberturas (Superadmin-only pero defensa en profundidad).
router.post(
  "/assignments/:id/close",
  authorizeRoles([...TEACHING_ROLES, "Admin", "Superadmin"]),
  param("id").isMongoId().withMessage("La asignacion no es válida"),
  handleInputErrors,
  CourseAssignmentController.close,
);

// TODO[RATELIMIT-PENDING]: aplicar `assignmentStateLimiter` aquí también (ver
// el bloque de comentario anterior). Endpoints de mutación de estado sensibles
// (ADR-0003 §D4); pendiente del `auth-security-engineer`.
router.post(
  "/assignments/:id/reopen",
  authorizeRoles(SUPERADMIN_ROLES),
  param("id").isMongoId().withMessage("La asignacion no es válida"),
  body("totalClasses")
    .optional()
    .isInt({ min: 1 })
    .withMessage("El total de clases debe ser un entero mayor a 0"),
  handleInputErrors,
  CourseAssignmentController.reopen,
);

router.get("/my-courses", CourseAssignmentController.findMyAssignments);

router.get("/my-courses/history", CourseAssignmentController.findMyHistory);

export default router;