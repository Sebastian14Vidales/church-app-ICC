import { Router } from 'express';
import { body, param } from 'express-validator';
import { UserController } from "../controller/user.controller";

const router = Router();

// Route to get all users
router.get("/", UserController.getAllUsers);
router.post("/",
    body('email').isEmail().withMessage('El correo electrónico no es válido'),
    body('name').notEmpty().withMessage('El nombre de usuario es obligatorio'),
    body('roles').notEmpty().withMessage('El rol es obligatorio'),
    UserController.createUser);

export default router;
