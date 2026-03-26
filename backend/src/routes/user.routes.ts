import { Router } from "express";
import { body } from "express-validator";
import { UserController } from "../controller/user.controller";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

router.post(
  "/",
  body("email").isEmail().withMessage("El correo electrónico no es válido"),
  body("name").notEmpty().withMessage("El nombre es obligatorio"),
  body("roleName").notEmpty().withMessage("El rol es obligatorio"),
  handleInputErrors,
  UserController.create,
);

export default router;
