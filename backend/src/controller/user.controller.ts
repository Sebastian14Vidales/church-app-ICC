import { Request, Response } from "express";
import User from "../models/user.model";
import Role from "../models/role.model";
import { sendConfirmationEmail } from "../services/access-email.service";
import {
  createConfirmationToken,
  deleteUserTokens,
  generateTemporaryPassword,
  hashPassword,
  isLoginEnabledRole,
  normalizeEmail,
} from "../utils/auth.utils";

export class UserController {
  static create = async (req: Request, res: Response) => {
    let createdUserId: string | null = null;

    try {
      const { email, roleName, name } = req.body;
      const normalizedEmail = normalizeEmail(email);

      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      if (!isLoginEnabledRole(role.name)) {
        return res.status(400).json({
          message: "Solo Admin, Superadmin, Profesor y Pastor pueden tener acceso al login",
        });
      }

      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({ message: "El correo ya está registrado" });
      }

      const temporaryPassword = generateTemporaryPassword();
      const user = await User.create({
        email: normalizedEmail,
        name,
        password: await hashPassword(temporaryPassword),
        confirmed: false,
        active: true,
        roles: [role._id],
      });
      createdUserId = String(user._id);

      const confirmationToken = await createConfirmationToken(String(user._id), user.email);
      await sendConfirmationEmail({
        email: user.email,
        name: user.name,
        token: confirmationToken,
      });

      res.status(201).json({
        message: "Usuario creado correctamente. Se envió un código de confirmación al correo.",
        userId: user._id,
      });
    } catch (error) {
      if (createdUserId) {
        await deleteUserTokens(createdUserId);
        await User.findByIdAndDelete(createdUserId);
      }

      res.status(500).json({ message: "Error al crear usuario", error });
    }
  };
}
