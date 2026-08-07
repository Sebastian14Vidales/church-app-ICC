import { Router } from "express";
import { body, param, query } from "express-validator";
import { CourseController } from "../controller/course.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { ADMIN_ROLES } from "../utils/auth.utils";
import { SPIRITUAL_GROWTH_STAGES } from "../models/user-profile.model";

/**
 * Router del catálogo de `Course` ( ADR-0001 §D1 ).
 * Montado en `/api/courses`.
 *
 * Orden: las rutas estáticas (`/`) van primero; `GET /:id` y `PUT/DELETE /:id`
 * al final. Este router se monta DESPUÉS de `course-assignment.routes.ts` y
 * `attendance.routes.ts` ( ver `server.ts` ) para que `GET /:id` no haga sombra
 * a `/assignments`, `/my-courses`, `/my-attendance`.
 */
const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorizeRoles(ADMIN_ROLES),
  body("name").notEmpty().trim().withMessage("El nombre del curso es obligatorio"),
  body("description")
    .notEmpty()
    .trim()
    .withMessage("La descripción del curso es obligatoria"),
  body("level")
    .isIn(["basic", "intermediate", "advanced"])
    .withMessage("El nivel del curso debe ser 'basic', 'intermediate' o 'advanced'"),
  body("spiritualGrowthStage")
    .isIn(SPIRITUAL_GROWTH_STAGES)
    .withMessage("La etapa de crecimiento espiritual es obligatoria y debe ser una válida"),
  body("isActive").optional().isBoolean().withMessage("El estado debe ser true o false"),
  handleInputErrors,
  CourseController.create,
);

router.get(
  "/",
  query("name").optional().isString(),
  query("level")
    .optional()
    .isIn(["basic", "intermediate", "advanced"])
    .withMessage("El nivel del curso debe ser 'basic', 'intermediate' o 'advanced'"),
  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isActive debe ser 'true' o 'false'"),
  query("page").optional().isInt({ min: 1 }).withMessage("page debe ser un entero mayor a 0"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit debe ser un entero entre 1 y 100"),
  handleInputErrors,
  CourseController.findAll,
);

router.get(
  "/:id",
  param("id").isMongoId().withMessage("ID de curso inválido"),
  handleInputErrors,
  CourseController.findById,
);

router.put(
  "/:id",
  authorizeRoles(ADMIN_ROLES),
  param("id").isMongoId().withMessage("ID de curso inválido"),
  body("name").notEmpty().trim().withMessage("El nombre del curso es obligatorio"),
  body("description")
    .notEmpty()
    .trim()
    .withMessage("La descripción del curso es obligatoria"),
  body("level")
    .optional()
    .isIn(["basic", "intermediate", "advanced"])
    .withMessage("El nivel del curso debe ser 'basic', 'intermediate' o 'advanced'"),
  body("spiritualGrowthStage")
    .optional()
    .isIn(SPIRITUAL_GROWTH_STAGES)
    .withMessage("La etapa de crecimiento espiritual debe ser una válida"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("El estado debe ser true o false"),
  handleInputErrors,
  CourseController.update,
);

router.delete(
  "/:id",
  authorizeRoles(ADMIN_ROLES),
  param("id").isMongoId().withMessage("ID de curso inválido"),
  handleInputErrors,
  CourseController.remove,
);

export default router;