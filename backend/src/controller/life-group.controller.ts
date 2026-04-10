import { Response } from "express";
import LifeGroup from "../models/life-group.model";
import { AuthenticatedRequest } from "../types/auth";

const LIFE_GROUP_MANAGER_ROLES = ["Supervisor", "Admin", "Superadmin"];

export class LifeGroupController {
  static findMine = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isAdmin = req.auth?.roles.some((role) => ["Admin", "Superadmin"].includes(role));
      const profileId = req.auth?.profileId;

      if (!isAdmin && !profileId) {
        return res.status(200).json([]);
      }

      const lifeGroups = await LifeGroup.find(
        isAdmin ? {} : { supervisor: profileId },
      ).populate({
        path: "supervisor",
        populate: [
          "role",
          {
            path: "user",
            populate: {
              path: "roles",
            },
          },
        ],
      });

      return res.status(200).json(lifeGroups);
    } catch (error) {
      return res.status(500).json({ message: "Error al obtener la cobertura", error });
    }
  };

  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, neighborhood, address, supervisor } = req.body as {
        name?: string;
        neighborhood?: string;
        address?: string;
        supervisor?: string;
      };

      const isAdmin = req.auth?.roles.some((role) => ["Admin", "Superadmin"].includes(role));
      const supervisorProfileId = isAdmin ? supervisor ?? req.auth?.profileId : req.auth?.profileId;

      if (!supervisorProfileId) {
        return res.status(400).json({ message: "No se pudo determinar el supervisor responsable" });
      }

      const lifeGroup = await LifeGroup.create({
        name,
        neighborhood,
        address,
        supervisor: supervisorProfileId,
      });

      const hydratedLifeGroup = await LifeGroup.findById(lifeGroup._id).populate({
        path: "supervisor",
        populate: [
          "role",
          {
            path: "user",
            populate: {
              path: "roles",
            },
          },
        ],
      });

      return res.status(201).json({
        message: "Grupo de vida creado correctamente",
        lifeGroup: hydratedLifeGroup,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al crear el grupo de vida", error });
    }
  };

  static roles = LIFE_GROUP_MANAGER_ROLES;
}
