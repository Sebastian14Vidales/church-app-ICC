import { Response } from "express";
import { AuthenticatedRequest } from "../types/auth";
import {
  getMyActiveAssignmentOverview,
  saveAttendance,
  type AttendanceEntry,
} from "../services/attendance.service";
import { handleControllerError } from "../services/app-error";

/**
 * Controller de asistencia ( ADR-0001 §D1 ).
 * Sólo orquesta y responde; la lógica de negocio vive en `attendance.service.ts`.
 * Roles `TEACHING_ROLES` (Profesor) en ambas rutas ( ver `attendance.routes.ts` ).
 */
export class AttendanceController {
  /**
   * GET /api/courses/my-attendance — overview de la asignación activa del profesor.
   * Respuesta `AttendanceOverview`.
   */
  static getOverview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profileId = req.auth?.profileId;
      if (!profileId) {
        return res.status(200).json({ assignment: null, sessions: [] });
      }

      const overview = await getMyActiveAssignmentOverview(profileId);
      return res.status(200).json(overview);
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Error al obtener la asistencia del curso activo",
      );
    }
  };

  /**
   * PUT /api/courses/my-attendance/classes/:classNumber — guarda asistencia.
   * Service: `saveAttendance`. Devuelve `{ message, session }`.
   */
  static saveClassAttendance = async (req: AuthenticatedRequest, res: Response) => {
    const { classNumber } = req.params;
    const body = (req.body ?? {}) as {
      attendance?: AttendanceEntry[];
      topic?: string;
      observations?: string;
    };
    try {
      const profileId = req.auth?.profileId;
      if (!profileId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const session = await saveAttendance(profileId, classNumber, body);
      return res.status(200).json({
        message: "Asistencia guardada correctamente",
        session,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al guardar la asistencia");
    }
  };
}