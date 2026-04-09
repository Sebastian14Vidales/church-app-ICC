import { Request, Response } from "express";
import { Types, type PopulatedDoc, type Document } from "mongoose";
import bcrypt from "bcrypt";
import User, { type IUser } from "../models/user.model";
import UserProfile from "../models/user-profile.model";
import { type IRole } from "../models/role.model";
import { sendConfirmationEmail, sendPasswordResetEmail } from "../services/access-email.service";
import { AuthenticatedRequest } from "../types/auth";
import {
  createConfirmationToken,
  createPasswordResetToken,
  createSessionToken,
  hashPassword,
  LOGIN_ENABLED_ROLES,
  normalizeEmail,
  verifyActionToken,
  consumeActionToken,
} from "../utils/auth.utils";

type RoleReference = PopulatedDoc<IRole & Document>;

const getRoleName = (role: RoleReference) =>
  role instanceof Types.ObjectId ? "" : role.name;

const buildAuthUser = async (user: IUser) => {
  const profile = await UserProfile.findOne({ user: user._id }).select("_id");
  const roles = user.roles.map((role) => getRoleName(role)).filter(Boolean);

  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    roles,
    profileId: profile ? String(profile._id) : null,
  };
};

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

      const authUser = await buildAuthUser(user);
      const token = await createSessionToken({
        userId: authUser.id,
        email: authUser.email,
        name: authUser.name,
        roles: authUser.roles,
        profileId: authUser.profileId,
      });

      return res.status(200).json({
        message: "Inicio de sesión exitoso",
        token,
        user: authUser,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al iniciar sesión", error });
    }
  };

  static confirmAccount = async (req: Request, res: Response) => {
    const { token, password } = req.body;

    try {
      const verifiedToken = await verifyActionToken(token, "confirmation");
      const user = await User.findById(verifiedToken.userId);

      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (!user.active) {
        return res.status(403).json({ message: "Cuenta inactiva" });
      }

      if (user.confirmed) {
        return res.status(409).json({ message: "La cuenta ya fue confirmada" });
      }

      user.password = await hashPassword(password);
      user.confirmed = true;

      await user.save();
      await consumeActionToken(String(user._id), "confirmation");

      return res.status(200).json({
        message: "Cuenta confirmada correctamente",
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("token")) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: "Error al confirmar la cuenta", error });
    }
  };

  static forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
      const normalizedEmail = normalizeEmail(email);
      const user = await User.findOne({ email: normalizedEmail }).populate("roles");

      if (user && user.active && user.confirmed) {
        const hasAllowedRole = user.roles.some((role) =>
          LOGIN_ENABLED_ROLES.includes(getRoleName(role)),
        );

        if (hasAllowedRole) {
          const resetToken = await createPasswordResetToken(String(user._id), user.email);
          await sendPasswordResetEmail({
            email: user.email,
            name: user.name,
            token: resetToken,
          });
        }
      }

      return res.status(200).json({
        message: "Si el correo existe, enviaremos instrucciones para restablecer la contraseña.",
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al procesar la recuperación", error });
    }
  };

  static resendConfirmation = async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
      const normalizedEmail = normalizeEmail(email);
      const user = await User.findOne({ email: normalizedEmail }).populate("roles");

      if (user && user.active && !user.confirmed) {
        const hasAllowedRole = user.roles.some((role) =>
          LOGIN_ENABLED_ROLES.includes(getRoleName(role)),
        );

        if (hasAllowedRole) {
          const confirmationToken = await createConfirmationToken(String(user._id), user.email);
          await sendConfirmationEmail({
            email: user.email,
            name: user.name,
            token: confirmationToken,
          });
        }
      }

      return res.status(200).json({
        message: "Si la cuenta existe y aun no ha sido confirmada, enviaremos un nuevo enlace.",
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al reenviar la confirmacion", error });
    }
  };

  static resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body;

    try {
      const verifiedToken = await verifyActionToken(token, "password-reset");
      const user = await User.findById(verifiedToken.userId);

      if (!user || !user.active) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      user.password = await hashPassword(password);

      await user.save();
      await consumeActionToken(String(user._id), "password-reset");

      return res.status(200).json({
        message: "Contraseña actualizada correctamente",
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("token")) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: "Error al restablecer la contraseña", error });
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

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "La contraseña actual es incorrecta" });
      }

      user.password = await hashPassword(newPassword);
      await user.save();

      return res.status(200).json({
        message: "Contraseña cambiada exitosamente",
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al cambiar la contraseña", error });
    }
  };

  static getCurrentSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const user = await User.findById(req.auth.userId).populate("roles");

      if (!user || !user.active) {
        return res.status(401).json({ message: "La sesión es inválida o expiró" });
      }

      const authUser = await buildAuthUser(user);

      return res.status(200).json({ user: authUser });
    } catch (error) {
      return res.status(500).json({ message: "Error al obtener la sesión", error });
    }
  };
}
