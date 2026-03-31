import { Request, Response } from "express";
import { Types, type PopulatedDoc, type Document } from "mongoose";
import bcrypt from "bcrypt";
import UserProfile from "../models/user-profile.model";
import Role, { type IRole } from "../models/role.model";
import User from "../models/user.model";

const LOGIN_ENABLED_ROLES = ["Admin", "Superadmin", "Profesor", "Pastor"];
const TEMPORARY_PASSWORD = "Temporal123*";

type RoleReference = PopulatedDoc<IRole & Document>;

const getRoleName = (role: RoleReference) =>
  role instanceof Types.ObjectId ? "" : role.name;

export class UserProfileController {
  static create = async (req: Request, res: Response) => {
    let createdUserId: string | null = null;

    try {
      const {
        roleName,
        email,
        password,
        firstName,
        lastName,
        baptized,
        servesInMinistry,
        ministry,
        ministryInterest,
        spiritualGrowthStage,
        ...profileData
      } = req.body;

      const role = await Role.findOne({ name: roleName });
      if (!role) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      const requiresAccess = LOGIN_ENABLED_ROLES.includes(role.name);
      let userId = undefined;
      let temporaryPassword: string | undefined;

      if (requiresAccess) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ message: "El correo ya está registrado" });
        }

        temporaryPassword = password || TEMPORARY_PASSWORD;
        const createdUser = await User.create({
          email,
          name: `${firstName} ${lastName}`.trim(),
          password: await bcrypt.hash(temporaryPassword, 10),
          confirmed: false,
          active: true,
          roles: [role._id],
        });

        userId = createdUser._id;
        createdUserId = String(createdUser._id);
      }

      const profilePayload = {
        ...profileData,
        firstName,
        lastName,
        role: role._id,
        user: userId,
        ...(typeof baptized === "boolean" ? { baptized } : {}),
        ...(typeof servesInMinistry === "boolean" ? { servesInMinistry } : {}),
        ...(servesInMinistry === true && ministry ? { ministry } : {}),
        ...(servesInMinistry === false && ministryInterest ? { ministryInterest } : {}),
        ...(spiritualGrowthStage ? { spiritualGrowthStage } : {}),
      };

      const profile = new UserProfile(profilePayload);

      await profile.save();

      const createdProfile = await UserProfile.findById(profile._id)
        .populate("user")
        .populate("role");

      res.status(201).json({
        message: "Perfil creado correctamente",
        profile: createdProfile,
        accessUserCreated: requiresAccess,
        temporaryPassword: requiresAccess ? temporaryPassword : undefined,
      });
    } catch (error) {
      if (createdUserId) {
        await User.findByIdAndDelete(createdUserId);
      }

      res.status(500).json({
        message: "Error al crear el perfil",
        error,
      });
    }
  };

  static findAll = async (_req: Request, res: Response) => {
    try {
      const profiles = await UserProfile.find()
        .populate("user")
        .populate("role");
      res.status(200).json(profiles);
    } catch (error) {
      res.status(500).json({
        message: "Error al obtener perfiles",
        error,
      });
    }
  };

  static findById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const profile = await UserProfile.findById(id)
        .populate("user")
        .populate("role");

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

  static update = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const profile = await UserProfile.findById(id).populate("user").populate("role");
      if (!profile) {
        return res.status(404).json({ message: "Perfil no encontrado" });
      }

      const {
        roleName,
        email,
        password,
        firstName = profile.firstName,
        lastName = profile.lastName,
        baptized,
        servesInMinistry,
        ministry,
        ministryInterest,
        spiritualGrowthStage,
        ...updateData
      } = req.body;

      const normalizedUpdateData = {
        ...updateData,
        ...(typeof baptized === "boolean" ? { baptized } : {}),
        ...(typeof servesInMinistry === "boolean" ? { servesInMinistry } : {}),
        ...(servesInMinistry === true && ministry ? { ministry } : {}),
        ...(servesInMinistry === false && ministryInterest ? { ministryInterest } : {}),
        ...(spiritualGrowthStage ? { spiritualGrowthStage } : {}),
      } as Record<string, unknown>;

      let role = profile.role;
      if (roleName) {
        const nextRole = await Role.findOne({ name: roleName });
        if (!nextRole) {
          return res.status(400).json({ message: "Rol inválido" });
        }
        role = nextRole;
        normalizedUpdateData.role = nextRole._id;
      }

      const requiresAccess = LOGIN_ENABLED_ROLES.includes(getRoleName(role));

      if (requiresAccess) {
        if (!profile.user && !email) {
          return res.status(400).json({
            message: "El correo es obligatorio para roles con acceso al login",
          });
        }

        if (profile.user) {
          const duplicatedUser = email
            ? await User.findOne({
                email,
                _id: { $ne: profile.user._id },
              })
            : null;

          if (duplicatedUser) {
            return res.status(409).json({ message: "El correo ya está registrado" });
          }

          await User.findByIdAndUpdate(profile.user._id, {
            ...(email ? { email } : {}),
            name: `${firstName} ${lastName}`.trim(),
            ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
            active: true,
            roles: [role._id],
          });
        } else {
          const duplicatedUser = await User.findOne({ email });
          if (duplicatedUser) {
            return res.status(409).json({ message: "El correo ya está registrado" });
          }

          const tempPassword = password || TEMPORARY_PASSWORD;
          const createdUser = await User.create({
            email,
            name: `${firstName} ${lastName}`.trim(),
            password: await bcrypt.hash(tempPassword, 10),
            confirmed: false,
            active: true,
            roles: [role._id],
          });

          normalizedUpdateData.user = createdUser._id;
        }
      } else if (profile.user) {
        await User.findByIdAndDelete(profile.user._id);
        normalizedUpdateData.user = undefined;
      }

      normalizedUpdateData.firstName = firstName;
      normalizedUpdateData.lastName = lastName;

      const updatedProfile = await UserProfile.findByIdAndUpdate(id, normalizedUpdateData, {
        new: true,
      })
        .populate("user")
        .populate("role");

      res.status(200).json(updatedProfile);
    } catch (error) {
      res.status(500).json({
        message: "Error al actualizar perfil",
        error,
      });
    }
  };

  static delete = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const profile = await UserProfile.findById(id);

      if (!profile) {
        return res.status(404).json({ message: "Perfil no encontrado" });
      }

      await UserProfile.findByIdAndDelete(id);

      if (profile.user) {
        await User.findByIdAndDelete(profile.user);
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
