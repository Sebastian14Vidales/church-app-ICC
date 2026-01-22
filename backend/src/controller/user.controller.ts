import { Request, Response } from "express";
import User from "../models/user.model";

export class UserController {
  //get all users
  static findAll = async (req: Request, res: Response) => {
    try {
      const users = await User.find({}).populate("roles");
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener usuarios", error });
    }
  };
  //create a new user
  static create = async (req: Request, res: Response) => {
    const user = new User(req.body);
    try {
      await user.save();
      res.send("Usuario creado exitosamente");
    } catch (error) {
      res.status(500).json({ message: "Error al crear usuario", error });
    }
  };
  //get user by id
  static findById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const user = await User.findById(id).populate("roles");
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener usuario", error });
    }
  };
  //update user by id
  static update = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const user = await User.findByIdAndUpdate(id, req.body, { new: true });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar usuario", error });
    }
  };
  // delete user by id
  static remove = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.status(200).json({ message: "Usuario eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar usuario", error });
    }
  };
}
