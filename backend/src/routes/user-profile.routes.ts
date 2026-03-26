import { Router } from "express";
import { body, param } from "express-validator";
import { UserProfileController } from "../controller/user-profile.controller";
import { handleInputErrors } from "../middleware/validation";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
const router = Router();

router.get("/", UserProfileController.findAll);

router.post(
  "/",
  body("firstName").notEmpty().withMessage("El nombre es obligatorio"),
  body("lastName").notEmpty().withMessage("El apellido es obligatorio"),
  body("documentID").notEmpty().withMessage("El documento es obligatorio"),
  body("birthdate")
    .notEmpty()
    .withMessage("La fecha de nacimiento es obligatoria"),
  body("neighborhood").notEmpty().withMessage("El barrio es obligatorio"),
  body("phoneNumber")
    .notEmpty()
    .withMessage("El número de teléfono es obligatorio"),
  body("bloodType").notEmpty().withMessage("El tipo de sangre es obligatorio"),
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
  body("documentID").optional().notEmpty().withMessage("El documento es obligatorio"),
  body("roleName").optional().notEmpty().withMessage("El rol es obligatorio"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("El correo electrónico no es válido"),
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres"),
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
