import { Router } from "express";
import { body } from "express-validator";
import { UserController } from "../controller/user.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";
import { ADMIN_ROLES } from "../utils/auth.utils";

const router = Router();

router.post(
  "/",
  authenticate,
  authorizeRoles(ADMIN_ROLES),
  body("email").isEmail().withMessage("El correo electrónico no es válido"),
  body("name").notEmpty().withMessage("El nombre es obligatorio"),
  body("roleName").notEmpty().withMessage("El rol es obligatorio"),
  handleInputErrors,
  UserController.create,
);

export default router;
