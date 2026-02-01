import { Router } from "express";
import { body } from "express-validator";
import { UserController } from "../controller/user.controller";

const router = Router();

router.post(
  "/",
  body("email").isEmail(),
  body("roleName").notEmpty(),
  UserController.create
);

export default router;
