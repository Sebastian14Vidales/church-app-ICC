import { Router } from "express";
import { body } from "express-validator";
import { AuthController } from "../controller/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

router.post(
  "/login",
  body("email").isEmail().withMessage("El correo electrónico no es válido"),
  body("password").notEmpty().withMessage("La contraseña es obligatoria"),
  handleInputErrors,
  AuthController.loginUser,
);

router.post(
  "/confirm-account",
  body("email").isEmail().withMessage("El correo electrónico no es válido"),
  body("token")
    .isLength({ min: 6, max: 6 })
    .withMessage("El token debe tener exactamente 6 dígitos")
    .matches(/^\d{6}$/)
    .withMessage("El token debe contener solo números"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres"),
  handleInputErrors,
  AuthController.confirmAccount,
);

router.post(
  "/change-password",
  authenticate,
  body("currentPassword").notEmpty().withMessage("La contraseña actual es obligatoria"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("La nueva contraseña debe tener al menos 8 caracteres"),
  handleInputErrors,
  AuthController.changePassword,
);

export default router;
