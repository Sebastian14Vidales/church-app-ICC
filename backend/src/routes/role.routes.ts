import { Router } from "express";
import { RoleController } from "../controller/role.controller";

const router = Router();

router.get("/", RoleController.getAll);

export default router;
