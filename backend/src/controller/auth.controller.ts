import { Request, Response } from "express";
import { Types, type PopulatedDoc, type Document } from "mongoose";
import User from "../models/user.model";
import bcrypt from "bcrypt";
import { type IRole } from "../models/role.model";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];

type RoleReference = PopulatedDoc<IRole & Document>;

const getRoleName = (role: RoleReference) =>
  role instanceof Types.ObjectId ? "" : role.name;

export class AuthController {
  static loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email }).populate("roles");
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
}
