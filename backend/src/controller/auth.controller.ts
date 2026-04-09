import { Request, Response } from "express";
import { Types, type PopulatedDoc, type Document } from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/user.model";
import Token from "../models/token.model";
import { type IRole } from "../models/role.model";
import { AuthenticatedRequest } from "../types/auth";
import { hashPassword, LOGIN_ENABLED_ROLES, normalizeEmail } from "../utils/auth.utils";

type RoleReference = PopulatedDoc<IRole & Document>;

const getRoleName = (role: RoleReference) =>
  role instanceof Types.ObjectId ? "" : role.name;

export class AuthController {
  static loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const normalizedEmail = normalizeEmail(email);
      const user = await User.findOne({ email: normalizedEmail }).populate("roles");
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (!user.active) {
        return res.status(403).json({ message: "Cuenta inactiva" });
      }

      const hasAllowedRole = user.roles.some((role) =>
        LOGIN_ENABLED_ROLES.includes(getRoleName(role)),
      );
      if (!hasAllowedRole) {
        return res.status(403).json({
          message: "Este usuario no tiene permisos para iniciar sesión",
        });
      }

      if (!user.confirmed) {
        return res.status(403).json({ message: "Cuenta no confirmada" });
      }

      if (!user.password) {
        return res.status(403).json({ message: "La cuenta no tiene acceso configurado" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Contraseña incorrecta" });
      }

      res.json({
        message: "Inicio de sesión exitoso",
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Error al iniciar sesión", error });
    }
  };

  static confirmAccount = async (req: Request, res: Response) => {
    const { email, token, password } = req.body;

    try {
      const normalizedEmail = normalizeEmail(email);
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (!user.active) {
        return res.status(403).json({ message: "Cuenta inactiva" });
      }

      if (user.confirmed) {
        return res.status(409).json({ message: "La cuenta ya fue confirmada" });
      }

      const confirmationToken = await Token.findOne({
        user: user._id,
        type: "confirmation",
        token,
      });

      if (!confirmationToken) {
        return res.status(400).json({ message: "El token es inválido o ya expiró" });
      }

      user.password = await hashPassword(password);
      user.confirmed = true;

      await user.save();
      await Token.deleteMany({ user: user._id, type: "confirmation" });

      return res.status(200).json({
        message: "Cuenta confirmada correctamente",
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al confirmar la cuenta", error });
    }
  };

  static changePassword = async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.auth?.userId;

    try {
      if (!userId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (!user.password) {
        return res.status(400).json({ message: "La cuenta no tiene contraseña configurada" });
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "La contraseña actual es incorrecta" });
      }

      // Hash de la nueva contraseña
      const hashedNewPassword = await hashPassword(newPassword);

      // Actualizar contraseña
      user.password = hashedNewPassword;
      await user.save();

      return res.status(200).json({
        message: "Contraseña cambiada exitosamente",
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al cambiar la contraseña", error });
    }
  };
}
