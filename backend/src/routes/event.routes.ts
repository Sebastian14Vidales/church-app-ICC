import { Router } from "express";
import { body, param } from "express-validator";
import { EventController } from "../controller/event.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { ADMIN_ROLES } from "../utils/auth.utils";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ADMIN_ROLES));

router.get("/", EventController.findAll);

router.post(
  "/",
  body("name").notEmpty().withMessage("El nombre del evento es obligatorio"),
  body("capacity").isInt({ min: 1 }).withMessage("La capacidad debe ser mayor a 0"),
  body("date").isISO8601().withMessage("La fecha es obligatoria"),
  body("time").notEmpty().withMessage("La hora es obligatoria"),
  body("place").notEmpty().withMessage("El lugar es obligatorio"),
  body("price").isFloat({ min: 0 }).withMessage("El precio debe ser un número válido"),
  body("registrationDeadline").optional({ values: "falsy" }).isISO8601().withMessage("La fecha límite de inscripción debe ser válida"),
  body("registrationClosed").optional().isBoolean().withMessage("El cierre de inscripciones debe ser booleano"),
  handleInputErrors,
  EventController.create,
);

router.put(
  "/:id",
  param("id").isMongoId().withMessage("El evento no es válido"),
  body("name").notEmpty().withMessage("El nombre del evento es obligatorio"),
  body("capacity").isInt({ min: 1 }).withMessage("La capacidad debe ser mayor a 0"),
  body("date").isISO8601().withMessage("La fecha es obligatoria"),
  body("time").notEmpty().withMessage("La hora es obligatoria"),
  body("place").notEmpty().withMessage("El lugar es obligatorio"),
  body("price").isFloat({ min: 0 }).withMessage("El precio debe ser un número válido"),
  body("registrationDeadline").optional({ values: "falsy" }).isISO8601().withMessage("La fecha límite de inscripción debe ser válida"),
  body("registrationClosed").optional().isBoolean().withMessage("El cierre de inscripciones debe ser booleano"),
  handleInputErrors,
  EventController.update,
);

router.delete(
  "/:id",
  param("id").isMongoId().withMessage("El evento no es válido"),
  handleInputErrors,
  EventController.remove,
);

router.post(
  "/:id/registrations",
  param("id").isMongoId().withMessage("El evento no es válido"),
  body("profileId").isMongoId().withMessage("Debes seleccionar un inscrito válido"),
  body("status").isIn(["registered", "cancelled"]).withMessage("El estado de inscripción no es válido"),
  body("amountPaid").optional().isFloat({ min: 0 }).withMessage("El valor pagado debe ser válido"),
  body("notes").optional().isString().withMessage("Las observaciones deben ser texto"),
  handleInputErrors,
  EventController.upsertRegistration,
);

router.patch(
  "/:id/registrations/:registrationId",
  param("id").isMongoId().withMessage("El evento no es válido"),
  param("registrationId").isMongoId().withMessage("La inscripción no es válida"),
  body("status").isIn(["registered", "cancelled"]).withMessage("El estado de inscripción no es válido"),
  body("amountPaid").optional().isFloat({ min: 0 }).withMessage("El valor pagado debe ser válido"),
  body("notes").optional().isString().withMessage("Las observaciones deben ser texto"),
  handleInputErrors,
  EventController.updateRegistration,
);

router.delete(
  "/:id/registrations/:registrationId",
  param("id").isMongoId().withMessage("El evento no es válido"),
  param("registrationId").isMongoId().withMessage("La inscripción no es válida"),
  handleInputErrors,
  EventController.removeRegistration,
);

export default router;
