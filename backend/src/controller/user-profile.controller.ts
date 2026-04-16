import { Request, Response } from "express";
import { Types, type PopulatedDoc, type Document } from "mongoose";
import UserProfile from "../models/user-profile.model";
import Role, { type IRole } from "../models/role.model";
import User from "../models/user.model";
import { sendConfirmationEmail } from "../services/access-email.service";
import { emitRealtimeInvalidation } from "../realtime/socket";
import { AuthenticatedRequest } from "../types/auth";
import {
  buildUserName,
  createConfirmationToken,
  deleteUserTokens,
  generateTemporaryPassword,
  hashPassword,
  isLoginEnabledRole,
  normalizeEmail,
} from "../utils/auth.utils";
import CourseAssigned from "../models/course-assigned.model";

type RoleReference = PopulatedDoc<IRole & Document>;

const getRoleName = (role: RoleReference) =>
  role instanceof Types.ObjectId ? "" : role.name;

const sendAccountConfirmation = async (email: string, name: string, userId: string) => {
  const confirmationToken = await createConfirmationToken(userId, email);

  await sendConfirmationEmail({
    email,
    name,
    token: confirmationToken,
  });
};

const MEMBER_QUERY_KEYS = [["members"], ["myCourses"], ["myAttendance"], ["courseAssignments"]];

export class UserProfileController {
  static create = async (req: AuthenticatedRequest, res: Response) => {
    let createdUserId: string | null = null;
    let createdProfileId: string | null = null;

    try {
      const {
        roleName,
        roleNames,
        email,
        firstName,
        lastName,
        baptized,
        servesInMinistry,
        ministry,
        ministryInterest,
        spiritualGrowthStage,
        ...profileData
      } = req.body;

      const selectedRoleNames = Array.isArray(roleNames)
        ? roleNames
        : roleName
          ? [roleName]
          : [];

      if (!selectedRoleNames.length) {
        return res.status(400).json({ message: "Debe seleccionar al menos un rol" });
      }

      const isSupervisorOnly = Boolean(
        req.auth?.roles.includes("Supervisor") &&
          !req.auth.roles.some((role) => ["Admin", "Superadmin", "Profesor", "Pastor"].includes(role)),
      );

      if (isSupervisorOnly && selectedRoleNames.some((roleName: string) => !["Asistente", "Miembro"].includes(roleName))) {
        return res.status(403).json({
          message: "El supervisor solo puede registrar personas con rol Asistente o Miembro",
        });
      }

      const selectedRoleDocs = await Role.find({ name: { $in: selectedRoleNames } });
      const roleMap = new Map(selectedRoleDocs.map((roleDoc) => [roleDoc.name, roleDoc]));
      const selectedRoles = selectedRoleNames
        .map((name: string) => roleMap.get(name))
        .filter((role): role is NonNullable<typeof selectedRoleDocs[number]> => role != null);

      if (selectedRoles.length !== selectedRoleNames.length) {
        return res.status(400).json({ message: "Uno o varios roles seleccionados son inválidos" });
      }

      const primaryRole = roleName ? roleMap.get(roleName) ?? selectedRoles[0] : selectedRoles[0];
      const selectedRoleIds = selectedRoles.map((role) => role._id);
      const requiresAccess = selectedRoles.some((role) => isLoginEnabledRole(role.name));
      let userId = undefined;
      let normalizedEmail: string | undefined;
      let createdUserName: string | undefined;

      if (requiresAccess) {
        normalizedEmail = normalizeEmail(email);
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          return res.status(409).json({ message: "El correo ya está registrado" });
        }

        const temporaryPassword = generateTemporaryPassword();
        createdUserName = buildUserName(firstName, lastName);
        const createdUser = await User.create({
          email: normalizedEmail,
          name: createdUserName,
          password: await hashPassword(temporaryPassword),
          confirmed: false,
          active: true,
          roles: selectedRoleIds,
        });

        userId = createdUser._id;
        createdUserId = String(createdUser._id);
      }

      const profilePayload = {
        ...profileData,
        firstName,
        lastName,
        role: primaryRole._id,
        user: userId,
        ...(typeof baptized === "boolean" ? { baptized } : {}),
        ...(typeof servesInMinistry === "boolean" ? { servesInMinistry } : {}),
        ...(servesInMinistry === true && ministry ? { ministry } : {}),
        ...(servesInMinistry === false && ministryInterest ? { ministryInterest } : {}),
        ...(spiritualGrowthStage ? { spiritualGrowthStage } : {}),
      };

      const profile = new UserProfile(profilePayload);

      await profile.save();
      createdProfileId = String(profile._id);

      if (requiresAccess && normalizedEmail && createdUserName && createdUserId) {
        await sendAccountConfirmation(normalizedEmail, createdUserName, createdUserId);
      }

      const createdProfile = await UserProfile.findById(profile._id)
        .populate({ path: "user", populate: { path: "roles" } })
        .populate("role");

      emitRealtimeInvalidation("members.changed", MEMBER_QUERY_KEYS);
      res.status(201).json({
        message: requiresAccess
          ? "Perfil creado correctamente. Se envió un código de confirmación al correo."
          : "Perfil creado correctamente",
        profile: createdProfile,
        accessUserCreated: requiresAccess,
        confirmationEmailSent: requiresAccess,
      });
    } catch (error) {
      console.error("Error al crear el perfil:", error);

      if (createdProfileId) {
        await UserProfile.findByIdAndDelete(createdProfileId);
      }

      if (createdUserId) {
        await deleteUserTokens(createdUserId);
        await User.findByIdAndDelete(createdUserId);
      }

      res.status(500).json({
        message: "Error al crear el perfil",
        error: error instanceof Error ? error.message : error,
      });
    }
  };

  static findAll = async (_req: Request, res: Response) => {
    try {
      const profiles = await UserProfile.find()
        .populate({ path: "user", populate: { path: "roles" } })
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
        .populate({ path: "user", populate: { path: "roles" } })
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

  static update = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    let createdUserId: string | null = null;

    try {
      const profile = await UserProfile.findById(id).populate("user").populate("role");
      if (!profile) {
        return res.status(404).json({ message: "Perfil no encontrado" });
      }

      const {
        roleName,
        roleNames,
        email,
        firstName = profile.firstName,
        lastName = profile.lastName,
        baptized,
        servesInMinistry,
        ministry,
        ministryInterest,
        spiritualGrowthStage,
        ...updateData
      } = req.body;
      const selectedRoleNames = Array.isArray(roleNames)
        ? roleNames
        : roleName
          ? [roleName]
          : [];

      const isSupervisorOnly = Boolean(
        req.auth?.roles.includes("Supervisor") &&
          !req.auth.roles.some((role) => ["Admin", "Superadmin", "Profesor", "Pastor"].includes(role)),
      );

      if (selectedRoleNames.length > 0 && isSupervisorOnly && selectedRoleNames.some((selectedRoleName: string) => !["Asistente", "Miembro"].includes(selectedRoleName))) {
        return res.status(403).json({
          message: "El supervisor solo puede registrar personas con rol Asistente o Miembro",
        });
      }
      const normalizedEmail = email ? normalizeEmail(email) : undefined;
      const nextUserName = buildUserName(firstName, lastName);
      let confirmationEmailSent = false;

      const normalizedUpdateData = {
        ...updateData,
        ...(typeof baptized === "boolean" ? { baptized } : {}),
        ...(typeof servesInMinistry === "boolean" ? { servesInMinistry } : {}),
        ...(spiritualGrowthStage ? { spiritualGrowthStage } : {}),
      } as Record<string, unknown>;
      const unsetFields: Record<string, "" | 1> = {};

      if (servesInMinistry === true) {
        normalizedUpdateData.ministry = ministry;
        unsetFields.ministryInterest = "";
      }

      if (servesInMinistry === false) {
        normalizedUpdateData.ministryInterest = ministryInterest;
        unsetFields.ministry = "";
      }

      let role = profile.role;
      let selectedRoles = [role] as IRole[];

      if (selectedRoleNames.length > 0) {
        const selectedRoleDocs = await Role.find({ name: { $in: selectedRoleNames } });
        const roleMap = new Map(selectedRoleDocs.map((roleDoc) => [roleDoc.name, roleDoc]));
        selectedRoles = selectedRoleNames
          .map((name: string) => roleMap.get(name))
          .filter((role): role is NonNullable<typeof selectedRoleDocs[number]> => role != null);

        if (selectedRoles.length !== selectedRoleNames.length) {
          return res.status(400).json({ message: "Uno o varios roles seleccionados son inválidos" });
        }

        const primaryRole = roleName ? roleMap.get(roleName) ?? selectedRoles[0] : selectedRoles[0];
        role = primaryRole;
        normalizedUpdateData.role = primaryRole._id;
      }

      const selectedRoleIds = selectedRoles.map((selectedRole) => selectedRole._id);
      const requiresAccess = selectedRoles.some((roleItem) => isLoginEnabledRole(roleItem.name));

      if (requiresAccess) {
        if (!profile.user && !normalizedEmail) {
          return res.status(400).json({
            message: "El correo es obligatorio para roles con acceso al login",
          });
        }

        if (profile.user) {
          const duplicatedUser = normalizedEmail
            ? await User.findOne({
                email: normalizedEmail,
                _id: { $ne: profile.user._id },
              })
            : null;

          if (duplicatedUser) {
            return res.status(409).json({ message: "El correo ya está registrado" });
          }

          const currentUserEmail = String((profile.user as { email?: string }).email ?? "");
          const shouldRefreshConfirmation =
            Boolean(normalizedEmail) && normalizedEmail !== currentUserEmail;
          const userUpdatePayload: Record<string, unknown> = {
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
            name: nextUserName,
            active: true,
            roles: selectedRoleIds,
          };

          if (shouldRefreshConfirmation) {
            userUpdatePayload.password = await hashPassword(generateTemporaryPassword());
            userUpdatePayload.confirmed = false;
          }

          const updatedUser = await User.findByIdAndUpdate(profile.user._id, userUpdatePayload, {
            new: true,
          });

          if (shouldRefreshConfirmation && updatedUser) {
            await sendAccountConfirmation(updatedUser.email, updatedUser.name, String(updatedUser._id));
            confirmationEmailSent = true;
          }
        } else {
          const duplicatedUser = await User.findOne({ email: normalizedEmail });
          if (duplicatedUser) {
            return res.status(409).json({ message: "El correo ya está registrado" });
          }

          const createdUser = await User.create({
            email: normalizedEmail,
            name: nextUserName,
            password: await hashPassword(generateTemporaryPassword()),
            confirmed: false,
            active: true,
            roles: selectedRoleIds,
          });
          createdUserId = String(createdUser._id);

          normalizedUpdateData.user = createdUser._id;
          await sendAccountConfirmation(createdUser.email, createdUser.name, createdUserId);
          confirmationEmailSent = true;
        }
      } else if (profile.user) {
        await deleteUserTokens(String(profile.user._id));
        await User.findByIdAndDelete(profile.user._id);
        unsetFields.user = "";
      }

      normalizedUpdateData.firstName = firstName;
      normalizedUpdateData.lastName = lastName;

      const updatedProfile = await UserProfile.findByIdAndUpdate(
        id,
        {
          ...normalizedUpdateData,
          ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
        },
        {
          new: true,
        },
      )
        .populate({ path: "user", populate: { path: "roles" } })
        .populate("role");

      emitRealtimeInvalidation("members.changed", MEMBER_QUERY_KEYS);
      res.status(200).json(updatedProfile);
    } catch (error) {
      console.error("Error al actualizar perfil:", error);

      if (createdUserId) {
        await deleteUserTokens(createdUserId);
        await User.findByIdAndDelete(createdUserId);
      }

      res.status(500).json({
        message: "Error al actualizar perfil",
        error: error instanceof Error ? error.message : error,
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

      // Verificar si el perfil es profesor y tiene cursos activos asignados
      const activeCourses = await CourseAssigned.countDocuments({
        professor: profile._id,
        status: "active",
      });

      if (activeCourses > 0) {
        return res.status(400).json({
          message: `No se puede eliminar: tiene ${activeCourses} curso(s) activo(s). Complete o cancele los cursos primero.`,
        });
      }

      await UserProfile.findByIdAndDelete(id);

      if (profile.user) {
        await deleteUserTokens(String(profile.user));
        await User.findByIdAndDelete(profile.user);
      }

      emitRealtimeInvalidation("members.changed", MEMBER_QUERY_KEYS);
      res.status(200).json({ message: "Perfil eliminado correctamente" });
    } catch (error) {
      res.status(500).json({
        message: "Error al eliminar perfil",
        error,
      });
    }
  };
}
