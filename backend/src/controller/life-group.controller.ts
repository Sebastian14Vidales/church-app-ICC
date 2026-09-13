import { Response } from "express";
import { AuthenticatedRequest } from "../types/auth";
import { handleControllerError } from "../services/app-error";
import {
  createLifeGroup,
  updateLifeGroup,
  updateAttendees,
  addSession,
  updateSession,
  deleteSession,
  findMine,
  type CreateLifeGroupBody,
  type UpdateLifeGroupBody,
  type UpdateAttendeesBody,
  type SessionBody,
} from "../services/life-group.service";

const MANAGER_ROLES = ["Supervisor", "Admin", "Superadmin"];

export class LifeGroupController {
  static findMine = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lifeGroups = await findMine({
        profileId: req.auth?.profileId,
        roles: req.auth?.roles ?? [],
      });
      return res.status(200).json(lifeGroups);
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener grupos de vida");
    }
  };

  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lifeGroup = await createLifeGroup(req.body as CreateLifeGroupBody, {
        profileId: req.auth?.profileId,
        roles: req.auth?.roles ?? [],
      });
      return res.status(201).json({
        message: "Grupo de vida creado correctamente",
        lifeGroup,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al crear el grupo de vida");
    }
  };

  static update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lifeGroup = await updateLifeGroup(req.params.id, req.body as UpdateLifeGroupBody, {
        profileId: req.auth?.profileId,
        roles: req.auth?.roles ?? [],
      });
      return res.status(200).json({
        message: "Grupo de vida actualizado correctamente",
        lifeGroup,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al actualizar el grupo de vida");
    }
  };

  static updateAttendees = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lifeGroup = await updateAttendees(
        req.params.id,
        req.body as UpdateAttendeesBody,
        {
          profileId: req.auth?.profileId,
          roles: req.auth?.roles ?? [],
        },
      );
      return res.status(200).json({
        message: "Asistentes del grupo actualizados correctamente",
        lifeGroup,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al actualizar los asistentes del grupo");
    }
  };

  static addSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { session, lifeGroup } = await addSession(
        req.params.id,
        req.body as SessionBody,
        {
          profileId: req.auth?.profileId,
          roles: req.auth?.roles ?? [],
        },
      );
      return res.status(201).json({
        message: "Sesión registrada correctamente",
        session,
        lifeGroup,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al registrar la sesión");
    }
  };

  static updateSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { session, lifeGroup } = await updateSession(
        req.params.id,
        req.params.sessionId,
        req.body as Partial<SessionBody>,
        {
          profileId: req.auth?.profileId,
          roles: req.auth?.roles ?? [],
        },
      );
      return res.status(200).json({
        message: "Sesión actualizada correctamente",
        session,
        lifeGroup,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al actualizar la sesión");
    }
  };

  static deleteSession = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lifeGroup = await deleteSession(req.params.id, req.params.sessionId, {
        profileId: req.auth?.profileId,
        roles: req.auth?.roles ?? [],
      });
      return res.status(200).json({
        message: "Sesión eliminada correctamente",
        lifeGroup,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al eliminar la sesión");
    }
  };

  static roles = MANAGER_ROLES;
}
