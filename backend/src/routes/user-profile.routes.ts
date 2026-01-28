import { Router } from "express";
import { UserProfileController } from "../controller/user-profile.controller";
import { body, param } from "express-validator";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

router.post(
  "/",
  body("firstName").notEmpty().withMessage("El nombre es obligatorio"),
  body("lastName").notEmpty().withMessage("El apellido es obligatorio"),
  body("documentID").notEmpty().withMessage("El documento es obligatorio"),
  body("birthdate")
    .notEmpty()
    .withMessage("La fecha de nacimiento es obligatoria"),
  body("neighborhood").notEmpty().withMessage("El barrio es obligatoria"),
  body("phoneNumber")
    .notEmpty()
    .withMessage("El número de teléfono es obligatorio"),
  body("bloodType").notEmpty().withMessage("El tipo de sangre es obligatorio"),
  handleInputErrors,
  UserProfileController.create,
);

// Obtener un perfil de usuario por ID
router.get("/:id", param("id").isMongoId(), UserProfileController.findById);

// Actualizar un perfil de usuario existente
router.put(
  "/:id",
  param("id").isMongoId(),
  body("firstName").notEmpty().withMessage("El nombre es obligatorio"),
  body("lastName").notEmpty().withMessage("El apellido es obligatorio"),
  body("documentID").notEmpty().withMessage("El documento es obligatorio"),
  handleInputErrors,
  UserProfileController.update,
);

// Eliminar un perfil de usuario
router.delete(
  "/:id",
  param("id").isMongoId(),
  handleInputErrors,
  UserProfileController.delete,
);
export default router;
