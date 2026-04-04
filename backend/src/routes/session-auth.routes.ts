import { Router } from "express";
import { body } from "express-validator";
import { AuthController } from "../controller/session-auth.controller";
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
  body("token").notEmpty().withMessage("El token es obligatorio"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres"),
  handleInputErrors,
  AuthController.confirmAccount,
);

router.post(
  "/forgot-password",
  body("email").isEmail().withMessage("El correo electrónico no es válido"),
  handleInputErrors,
  AuthController.forgotPassword,
);

router.post(
  "/resend-confirmation",
  body("email").isEmail().withMessage("El correo electrÃ³nico no es vÃ¡lido"),
  handleInputErrors,
  AuthController.resendConfirmation,
);

router.post(
  "/reset-password",
  body("token").notEmpty().withMessage("El token es obligatorio"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres"),
  handleInputErrors,
  AuthController.resetPassword,
);

router.get("/me", authenticate, AuthController.getCurrentSession);

export default router;
