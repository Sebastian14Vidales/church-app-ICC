import { Request, Response } from "express";
import UserProfile from "../models/user-profile.model";

export class UserProfileController {

    // create a new user profile
    static create = async (req: Request, res: Response) => {
        const profile = new UserProfile(req.body);
        try {
            await profile.save();
            res.status(201).json({ message: "Perfil creado correctamente" });
        } catch (error) {
            res.status(500).json({
                message: "Error al crear el perfil",
                error,
            });
        }
    };

    // get all profiles
    static findAll = async (req: Request, res: Response) => {
        try {
            const profiles = await UserProfile.find().populate("user");
            res.status(200).json(profiles);
        } catch (error) {
            res.status(500).json({
                message: "Error al obtener perfiles",
                error,
            });
        }
    };

    // get profile by userId
    static findById = async (req: Request, res: Response) => {
        const { userId } = req.params;

        try {
            const profile = await UserProfile
                .findOne({ user: userId })
                .populate("user");

            if (!profile) {
                return res.status(404).json({ message: "Perfil no encontrado" });
            }

            res.status(200).json(profile);
        } catch (error) {
            res.status(500).json({
                message: "Error al obtener perfil",
                error,
            });
        }
    };

    // update profile by userId
    static update = async (req: Request, res: Response) => {
        const { userId } = req.params;

        try {
            const profile = await UserProfile.findOneAndUpdate(
                { user: userId },
                req.body,
                { new: true }
            );

            if (!profile) {
                return res.status(404).json({ message: "Perfil no encontrado" });
            }

            res.status(200).json(profile);
        } catch (error) {
            res.status(500).json({
                message: "Error al actualizar perfil",
                error,
            });
        }
    };

    // delete profile by userId
    static delete = async (req: Request, res: Response) => {
        const { userId } = req.params;

        try {
            const profile = await UserProfile.findOneAndDelete({ user: userId });

            if (!profile) {
                return res.status(404).json({ message: "Perfil no encontrado" });
            }
            res.status(200).json({ message: "Perfil eliminado correctamente" });
        } catch (error) {
            res.status(500).json({
                message: "Error al eliminar perfil",
                error,
            });
        }
    };
}
