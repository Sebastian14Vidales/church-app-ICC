import { Request, Response } from "express";
import User from "../models/user.model";
import Role from "../models/role.model";
import bcrypt from "bcrypt";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];

export class UserController {
  static create = async (req: Request, res: Response) => {
    try {
      const { email, roleName, name } = req.body;

      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      if (!LOGIN_ENABLED_ROLES.includes(role.name)) {
        return res.status(400).json({
          message: "Solo Admin, Superadmin, Profesor y Pastor pueden tener acceso al login",
        });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "El correo ya está registrado" });
      }

      const user = await User.create({
        email,
        name,
        password: await bcrypt.hash("Temporal123*", 10),
        confirmed: false,
        active: true,
        roles: [role._id],
      });

      res.status(201).json({
        message: "Usuario creado correctamente",
        userId: user._id,
      });
    } catch (error) {
      res.status(500).json({ message: "Error al crear usuario", error });
    }
  };
}
