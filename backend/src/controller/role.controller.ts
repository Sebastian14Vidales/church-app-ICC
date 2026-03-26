import { Request, Response } from "express";
import Role from "../models/role.model";

export class RoleController {
  static getAll = async (_req: Request, res: Response) => {
    try {
      const roles = await Role.find().sort({ name: 1 });
      res.status(200).json(roles);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener roles", error });
    }
  };
}
