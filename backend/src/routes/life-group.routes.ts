import { Router } from "express";
import { body, param } from "express-validator";
import { LifeGroupController } from "../controller/life-group.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

router.use(authenticate);

const lifeGroupTypeValidator = (path: string, optional = false) => {
  const chain = body(path);
  if (optional) chain.optional();
  return chain
    .isIn(["life-group", "couple-group"])
    .withMessage("El tipo de grupo no es válido");
};

router.get(
  "/",
  authorizeRoles(["Supervisor", "Admin", "Superadmin", "Lider"]),
  LifeGroupController.findMine,
);

router.post(
  "/",
  authorizeRoles(LifeGroupController.roles),
  body("name").notEmpty().withMessage("El nombre del grupo es obligatorio"),
  body("neighborhood").notEmpty().withMessage("El barrio es obligatorio"),
  body("address").notEmpty().withMessage("La dirección es obligatoria"),
  body("leader").isMongoId().withMessage("El líder no es válido"),
  lifeGroupTypeValidator("type"),
  body("attendees").optional().isArray().withMessage("Los asistentes deben ser un arreglo"),
  body("attendees.*").optional().isMongoId().withMessage("Uno o más asistentes no son válidos"),
  body("supervisor").optional().isMongoId().withMessage("El supervisor no es válido"),
  handleInputErrors,
  LifeGroupController.create,
);

router.patch(
  "/:id",
  authorizeRoles(LifeGroupController.roles),
  param("id").isMongoId().withMessage("El ID del grupo no es válido"),
  body("name").optional().notEmpty().withMessage("El nombre no puede estar vacío"),
  body("neighborhood").optional().notEmpty().withMessage("El barrio no puede estar vacío"),
  body("address").optional().notEmpty().withMessage("La dirección no puede estar vacía"),
  body("leader").optional().isMongoId().withMessage("El líder no es válido"),
  lifeGroupTypeValidator("type", true),
  body("supervisor").optional().isMongoId().withMessage("El supervisor no es válido"),
  handleInputErrors,
  LifeGroupController.update,
);

const attendeesAuthRoles = ["Lider", "Supervisor", "Admin", "Superadmin"];

router.patch(
  "/:id/attendees",
  authorizeRoles(attendeesAuthRoles),
  param("id").isMongoId().withMessage("El ID del grupo no es válido"),
  body("attendees").isArray().withMessage("Los asistentes deben ser un arreglo"),
  body("attendees.*").isMongoId().withMessage("Uno o más asistentes no son válidos"),
  handleInputErrors,
  LifeGroupController.updateAttendees,
);

const sessionAuthRoles = ["Lider", "Supervisor", "Admin", "Superadmin"];

const sessionValidators = [
  body("date")
    .notEmpty()
    .withMessage("La fecha de la sesión es obligatoria")
    .isISO8601()
    .withMessage("La fecha de la sesión no es válida"),
  body("attendeesPresent")
    .isArray()
    .withMessage("Los asistentes presentes deben ser un arreglo"),
  body("attendeesPresent.*")
    .isMongoId()
    .withMessage("Uno o más asistentes presentes no son válidos"),
  body("offeringAmount")
    .isFloat({ min: 0 })
    .withMessage("La ofrenda debe ser un número mayor o igual a 0"),
  body("notes").optional().isString().withMessage("Las notas deben ser texto"),
];

const sessionUpdateValidators = [
  body("date").optional().isISO8601().withMessage("La fecha de la sesión no es válida"),
  body("attendeesPresent")
    .optional()
    .isArray()
    .withMessage("Los asistentes presentes deben ser un arreglo"),
  body("attendeesPresent.*")
    .optional()
    .isMongoId()
    .withMessage("Uno o más asistentes presentes no son válidos"),
  body("offeringAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("La ofrenda debe ser un número mayor o igual a 0"),
  body("notes").optional().isString().withMessage("Las notas deben ser texto"),
];

router.post(
  "/:id/sessions",
  authorizeRoles(sessionAuthRoles),
  param("id").isMongoId().withMessage("El ID del grupo no es válido"),
  ...sessionValidators,
  handleInputErrors,
  LifeGroupController.addSession,
);

router.patch(
  "/:id/sessions/:sessionId",
  authorizeRoles(sessionAuthRoles),
  param("id").isMongoId().withMessage("El ID del grupo no es válido"),
  param("sessionId").isMongoId().withMessage("El ID de la sesión no es válido"),
  ...sessionUpdateValidators,
  handleInputErrors,
  LifeGroupController.updateSession,
);

router.delete(
  "/:id/sessions/:sessionId",
  authorizeRoles(sessionAuthRoles),
  param("id").isMongoId().withMessage("El ID del grupo no es válido"),
  param("sessionId").isMongoId().withMessage("El ID de la sesión no es válido"),
  handleInputErrors,
  LifeGroupController.deleteSession,
);

export default router;
