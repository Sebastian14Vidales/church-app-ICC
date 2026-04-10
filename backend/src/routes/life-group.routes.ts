import { Router } from "express";
import { body } from "express-validator";
import { LifeGroupController } from "../controller/life-group.controller";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware";
import { handleInputErrors } from "../middleware/validation";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(LifeGroupController.roles));

router.get("/", LifeGroupController.findMine);

router.post(
  "/",
  body("name").notEmpty().withMessage("El nombre del grupo es obligatorio"),
  body("neighborhood").notEmpty().withMessage("El barrio es obligatorio"),
  body("address").notEmpty().withMessage("La dirección es obligatoria"),
  handleInputErrors,
  LifeGroupController.create,
);

export default router;
