import { Request, Response } from "express";
import User from "../models/user.model";
import bcrypt from "bcrypt"

export class AuthController {
  static loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      if (!user.confirmed) {
        return res.status(403).json({ message: "Cuenta no confirmada" });
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
      })

    } catch (error) {
      res.status(500).json({ message: "Error al iniciar sesión", error });
    }
  };
}