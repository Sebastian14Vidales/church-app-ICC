import { Router } from "express";
import { body, param } from "express-validator";
import { UserProfileController } from "../controller/user-profile.controller";
import { handleInputErrors } from "../middleware/validation";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
const MINISTRIES = [
  "Ministerio de Alabanza",
  "Ministerio de Danza (Niñas entre 7 y 14 años)",
  "Ministerio de Jóvenes",
  "Ministerio de Servidores",
  "Ministerio de Oración e Intercesión",
  "Ministerio de Hombres",
  "Ministerio de Mujeres",
  "Ministerio de Parejas y Familias",
  "Ministerio Iglesia Infantil",
  "Ministerio de Evangelismo y Consolidación G.V.E",
];
const SPIRITUAL_GROWTH_STAGES = [
  "Consolidación",
  "Discipulado básico",
  "Carácter cristiano",
  "Sanidad y propósito",
  "Cosmovisión bíblica",
  "Doctrina cristiana",
];

const router = Router();

router.get("/", UserProfileController.findAll);

router.post(
  "/",
  body("firstName").notEmpty().withMessage("El nombre es obligatorio"),
  body("lastName").notEmpty().withMessage("El apellido es obligatorio"),
  body("documentID")
    .notEmpty()
    .withMessage("El documento es obligatorio")
    .isLength({ min: 10, max: 10 })
    .withMessage("El documento debe tener exactamente 10 dígitos")
    .matches(/^\d{10}$/)
    .withMessage("El documento debe contener solo números"),
  body("birthdate")
    .notEmpty()
    .withMessage("La fecha de nacimiento es obligatoria"),
  body("neighborhood").notEmpty().withMessage("El barrio es obligatorio"),
  body("phoneNumber")
    .notEmpty()
    .withMessage("El número de teléfono es obligatorio")
    .isLength({ min: 10, max: 10 })
    .withMessage("El número de teléfono debe tener exactamente 10 dígitos")
    .matches(/^\d{10}$/)
    .withMessage("El número de teléfono debe contener solo números"),
  body("bloodType").notEmpty().withMessage("El tipo de sangre es obligatorio"),
  body("baptized")
    .isBoolean()
    .withMessage("El campo de bautizado debe ser sí o no"),
  body("servesInMinistry")
    .isBoolean()
    .withMessage("Debes indicar si sirve en algún ministerio"),
  body("ministry")
    .optional({ nullable: true })
    .isIn(MINISTRIES)
    .withMessage("El ministerio seleccionado no es válido"),
  body("ministryInterest")
    .optional({ nullable: true })
    .isIn(MINISTRIES)
    .withMessage("El ministerio de interés no es válido"),
  body("spiritualGrowthStage")
    .notEmpty()
    .withMessage("El crecimiento espiritual es obligatorio")
    .isIn(SPIRITUAL_GROWTH_STAGES)
    .withMessage("La etapa de crecimiento espiritual no es válida"),
  body("roleName").notEmpty().withMessage("El rol es obligatorio"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("El correo electrónico no es válido"),
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres"),
  body().custom((value) => {
    if (LOGIN_ENABLED_ROLES.includes(value.roleName) && !value.email) {
      throw new Error("El correo es obligatorio para roles con acceso al login");
    }
    if (value.servesInMinistry === true && !value.ministry) {
      throw new Error("Debes seleccionar el ministerio en el que sirve");
    }
    if (value.servesInMinistry === false && !value.ministryInterest) {
      throw new Error("Debes seleccionar el ministerio en el que está interesado");
    }
    return true;
  }),
  handleInputErrors,
  UserProfileController.create,
);

router.get(
  "/:id",
  param("id").isMongoId().withMessage("El id no es válido"),
  handleInputErrors,
  UserProfileController.findById,
);

router.put(
  "/:id",
  param("id").isMongoId().withMessage("El id no es válido"),
  body("firstName").optional().notEmpty().withMessage("El nombre es obligatorio"),
  body("lastName").optional().notEmpty().withMessage("El apellido es obligatorio"),
  body("documentID")
    .optional()
    .isLength({ min: 10, max: 10 })
    .withMessage("El documento debe tener exactamente 10 dígitos")
    .matches(/^\d{10}$/)
    .withMessage("El documento debe contener solo números"),
  body("phoneNumber")
    .optional()
    .isLength({ min: 10, max: 10 })
    .withMessage("El número de teléfono debe tener exactamente 10 dígitos")
    .matches(/^\d{10}$/)
    .withMessage("El número de teléfono debe contener solo números"),
  body("baptized")
    .optional()
    .isBoolean()
    .withMessage("El campo de bautizado debe ser sí o no"),
  body("servesInMinistry")
    .optional()
    .isBoolean()
    .withMessage("Debes indicar si sirve en algún ministerio"),
  body("ministry")
    .optional({ nullable: true })
    .isIn(MINISTRIES)
    .withMessage("El ministerio seleccionado no es válido"),
  body("ministryInterest")
    .optional({ nullable: true })
    .isIn(MINISTRIES)
    .withMessage("El ministerio de interés no es válido"),
  body("spiritualGrowthStage")
    .optional()
    .isIn(SPIRITUAL_GROWTH_STAGES)
    .withMessage("La etapa de crecimiento espiritual no es válida"),
  body("roleName").optional().notEmpty().withMessage("El rol es obligatorio"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("El correo electrónico no es válido"),
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres"),
  body().custom((value) => {
    if (value.servesInMinistry === true && !value.ministry) {
      throw new Error("Debes seleccionar el ministerio en el que sirve");
    }
    if (value.servesInMinistry === false && !value.ministryInterest) {
      throw new Error("Debes seleccionar el ministerio en el que está interesado");
    }
    return true;
  }),
  handleInputErrors,
  UserProfileController.update,
);

router.delete(
  "/:id",
  param("id").isMongoId().withMessage("El id no es válido"),
  handleInputErrors,
  UserProfileController.delete,
);

export default router;
