import { Router } from "express";
import { RoleController } from "../controller/role.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, RoleController.getAll);

export default router;
