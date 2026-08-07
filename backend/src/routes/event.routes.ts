import { Router } from "express";
import { body, param } from "express-validator";
import { EventController } from "../controller/event.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { ADMIN_ROLES } from "../utils/auth.utils";

const router = Router();

router.use(authenticate);

// Listados: cualquier rol autenticado (ADR-0008 §2.1).
router.get("/", EventController.findAll);
router.get("/history", EventController.findHistory);

// Mutaciones y exportación: requieren rol administrativo.
router.use(authorizeRoles(ADMIN_ROLES));

router.post(
  "/",
  body("name").notEmpty().withMessage("El nombre del evento es obligatorio"),
  body("capacity").isInt({ min: 1 }).withMessage("La capacidad debe ser mayor a 0"),
  body("date").isISO8601().withMessage("La fecha es obligatoria"),
  body("time").notEmpty().withMessage("La hora es obligatoria"),
  body("place").notEmpty().withMessage("El lugar es obligatorio"),
  body("price").isFloat({ min: 0 }).withMessage("El precio debe ser un numero valido"),
  body("registrationDeadline")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("La fecha limite de inscripcion debe ser valida"),
  body("registrationClosed")
    .optional()
    .isBoolean()
    .withMessage("El cierre de inscripciones debe ser booleano"),
  handleInputErrors,
  EventController.create,
);

router.put(
  "/:id",
  param("id").isMongoId().withMessage("El evento no es valido"),
  body("name").notEmpty().withMessage("El nombre del evento es obligatorio"),
  body("capacity").isInt({ min: 1 }).withMessage("La capacidad debe ser mayor a 0"),
  body("date").isISO8601().withMessage("La fecha es obligatoria"),
  body("time").notEmpty().withMessage("La hora es obligatoria"),
  body("place").notEmpty().withMessage("El lugar es obligatorio"),
  body("price").isFloat({ min: 0 }).withMessage("El precio debe ser un numero valido"),
  body("registrationDeadline")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("La fecha limite de inscripcion debe ser valida"),
  body("registrationClosed")
    .optional()
    .isBoolean()
    .withMessage("El cierre de inscripciones debe ser booleano"),
  handleInputErrors,
  EventController.update,
);

router.get(
  "/:id/export/registrations",
  param("id").isMongoId().withMessage("El evento no es valido"),
  handleInputErrors,
  EventController.exportRegistrations,
);

router.post(
  "/:id/registrations",
  param("id").isMongoId().withMessage("El evento no es valido"),
  body("profileId").isMongoId().withMessage("El perfil seleccionado no es valido"),
  body("status")
    .optional()
    .isIn(["registered", "cancelled"])
    .withMessage("El estado de la inscripcion no es valido"),
  body("amountPaid")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("El valor pagado debe ser un numero valido"),
  body("notes")
    .optional()
    .isString()
    .withMessage("Las observaciones deben ser texto"),
  handleInputErrors,
  EventController.upsertRegistration,
);

router.put(
  "/:id/registrations/:registrationId",
  param("id").isMongoId().withMessage("El evento no es valido"),
  param("registrationId").isMongoId().withMessage("La inscripcion no es valida"),
  body("status")
    .optional()
    .isIn(["registered", "cancelled"])
    .withMessage("El estado de la inscripcion no es valido"),
  body("amountPaid")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("El valor pagado debe ser un numero valido"),
  body("notes")
    .optional()
    .isString()
    .withMessage("Las observaciones deben ser texto"),
  handleInputErrors,
  EventController.updateRegistration,
);

router.delete(
  "/:id/registrations/:registrationId",
  param("id").isMongoId().withMessage("El evento no es valido"),
  param("registrationId").isMongoId().withMessage("La inscripcion no es valida"),
  handleInputErrors,
  EventController.removeRegistration,
);

router.delete(
  "/:id",
  param("id").isMongoId().withMessage("El evento no es valido"),
  handleInputErrors,
  EventController.remove,
);

export default router;
