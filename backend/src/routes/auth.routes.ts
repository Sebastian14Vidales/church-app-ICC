import { Router } from "express";
import { body, param } from "express-validator";
import { AuthController } from "../controller/auth.controller";

const router = Router();

router.post(
  "/login",
  body("email").isEmail().withMessage("El correo electrónico no es válido"),
  body("password").notEmpty().withMessage("La contraseña es obligatoria"),
  AuthController.loginUser,
);

export default router;
