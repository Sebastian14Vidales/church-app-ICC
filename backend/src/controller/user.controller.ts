import { Request, Response } from "express";
import User from "../models/user.model";
import Role from "../models/role.model";
import bcrypt from "bcrypt";

export class UserController {
  static create = async (req: Request, res: Response) => {
    try {
      const { email, roleName } = req.body;

      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      const requiresEmail = ["Pastor", "Profesor"].includes(role.name);

      const password = requiresEmail
        ? undefined
        : await bcrypt.hash("Temporal123*", 10);

      const user = await User.create({
        email,
        password,
        confirmed: !requiresEmail,
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
