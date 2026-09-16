import { Response } from "express";
import { AuthenticatedRequest } from "../types/auth";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notification.service";
import { handleControllerError } from "../services/app-error";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class NotificationController {
  static list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const rawLimit = Number(req.query.limit ?? DEFAULT_LIMIT);
      const limit = Math.min(
        Number.isInteger(rawLimit) && rawLimit >= 1 ? rawLimit : DEFAULT_LIMIT,
        MAX_LIMIT,
      );

      const result = await listNotifications(userId, limit);
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener notificaciones");
    }
  };

  static markRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const { id } = req.params;
      const result = await markNotificationRead(id, userId);
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Error al marcar la notificación como leída",
      );
    }
  };

  static markAllRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const result = await markAllNotificationsRead(userId);
      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Error al marcar las notificaciones como leídas",
      );
    }
  };
}
