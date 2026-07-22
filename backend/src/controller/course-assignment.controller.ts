import { Response } from "express";
import CourseAssigned from "../models/course-assigned.model";
import ClassSession from "../models/class-session.model";
import { AuthenticatedRequest } from "../types/auth";
import {
  addMembers as addMembersService,
  buildAssignmentQuery,
  buildMyProfessorAssignmentQuery,
  buildMyStudentAssignmentQuery,
  closeAssignment as closeAssignmentService,
  createAssignment,
  reopenAssignment as reopenAssignmentService,
  softDeleteAssignment,
  updateAssignment,
  attendancePopulate,
  memberPopulate,
  professorPopulate,
  type CreateAssignmentBody,
  type UpdateAssignmentBody,
} from "../services/course-assignment.service";
import { handleControllerError } from "../services/app-error";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePagination = (query: {
  page?: unknown;
  limit?: unknown;
}) => {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? DEFAULT_LIMIT);
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = Math.min(
    Number.isInteger(rawLimit) && rawLimit >= 1 ? rawLimit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  return { page, limit };
};

/**
 * Controller de asignaciones / miembros / close / reopen / my-courses.
 * Sólo orquesta; la lógica de negocio vive en `course-assignment.service.ts`.
 */
export class CourseAssignmentController {
  /**
   * GET /api/courses/assignments — listado de asignaciones paginado.
   * Por defecto `status: "active"` y `deletedAt: null`.
   * Query opcional `status=active|completed`.
   */
  static findAll = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, limit } = parsePagination(req.query);
      const status =
        req.query.status === "completed" ? "completed" : "active";

      const filter: Record<string, unknown> = { status, deletedAt: null };

      const sort: Record<string, 1 | -1> =
        status === "completed" ? { endDate: -1 } : { createdAt: -1 };

      const [total, items] = await Promise.all([
        CourseAssigned.countDocuments(filter),
        buildAssignmentQuery(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      return res.status(200).json({ items, total, page, limit });
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener asignaciones");
    }
  };

  /**
   * GET /api/courses/assignments/history — historial: status=completed,
   * deletedAt null, orden endDate desc. Filtros professor (MongoId) y location.
   */
  static findHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page, limit } = parsePagination(req.query);

      const filter: Record<string, unknown> = {
        status: "completed",
        deletedAt: null,
      };

      if (typeof req.query.professor === "string" && req.query.professor) {
        filter.professor = req.query.professor;
      }
      if (typeof req.query.location === "string" && req.query.location.trim()) {
        filter.location = { $regex: req.query.location.trim(), $options: "i" };
      }

      const [total, items] = await Promise.all([
        CourseAssigned.countDocuments(filter),
        buildAssignmentQuery(filter)
          .sort({ endDate: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      return res.status(200).json({ items, total, page, limit });
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener el historial de asignaciones");
    }
  };

  /**
   * GET /api/courses/assignments/:id — detalle con sesiones consolidadas
   * ( `CourseAssignedHistoryItem` ). Omite `ClassSession` con `deletedAt` seteado.
   */
  static findById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
      const assignment = await CourseAssigned.findOne({ _id: id, deletedAt: null })
        .populate("course")
        .populate(memberPopulate)
        .populate(professorPopulate);

      if (!assignment) {
        return res.status(404).json({ message: "Asignacion no encontrada" });
      }

      const sessions = await ClassSession.find({
        courseAssigned: assignment._id,
        deletedAt: null,
      })
        .sort({ classNumber: 1 })
        .populate(attendancePopulate);

      const sessionsByClassNumber = new Map(
        sessions.map((session) => [session.classNumber, session]),
      );

      const consolidatedSessions = Array.from(
        { length: assignment.totalClasses },
        (_, index) => {
          const classNumber = index + 1;
          const storedSession = sessionsByClassNumber.get(classNumber);
          const startDate = new Date(assignment.startDate);
          const classDate = new Date(startDate);
          classDate.setDate(startDate.getDate() + (classNumber - 1) * 7);

          const storedUpdatedAt = storedSession
            ? (storedSession as unknown as { updatedAt?: Date }).updatedAt
            : null;

          return {
            classNumber,
            date: (storedSession?.date ?? classDate).toISOString(),
            completedAt: storedUpdatedAt ? storedUpdatedAt.toISOString() : null,
            topic: storedSession?.topic ?? "",
            observations: storedSession?.observations ?? "",
            attendance:
              storedSession?.attendance.map((entry) => ({
                member: entry.student,
                present: entry.present,
                notes: entry.notes ?? "",
              })) ?? [],
          };
        },
      );

      return res.status(200).json({
        ...assignment.toObject(),
        sessions: consolidatedSessions,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener la asignación");
    }
  };

  /**
   * POST /api/courses/assignments — crear asignación. Roles ADMIN_ROLES (en ruta).
   * Service: `createAssignment`. Devuelve 201 `{ message, assignment }`.
   */
  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as CreateAssignmentBody;
      const assignment = await createAssignment(body);
      return res.status(201).json({
        message: "Curso asignado correctamente",
        assignment,
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Error al asignar curso",
        "Este profesor ya tiene un curso activo asignado",
      );
    }
  };

  /**
   * PUT /api/courses/assignments/:id — editar asignación. Roles SUPERADMIN_ROLES (en ruta).
   * Service: `updateAssignment`.
   */
  static update = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
      const assignment = await updateAssignment(id, req.body as UpdateAssignmentBody);
      return res.status(200).json({
        message: "Asignacion actualizada correctamente",
        assignment,
      });
    } catch (error) {
      return handleControllerError(
        res,
        error,
        "Error al actualizar la asignacion",
        "Este profesor ya tiene un curso activo asignado",
      );
    }
  };

  /**
   * DELETE /api/courses/assignments/:id — soft-delete. Roles SUPERADMIN_ROLES (en ruta).
   * Service: `softDeleteAssignment`.
   */
  static remove = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
      await softDeleteAssignment(id);
      return res.status(200).json({ message: "Asignacion eliminada correctamente" });
    } catch (error) {
      return handleControllerError(res, error, "Error al eliminar la asignacion");
    }
  };

  /**
   * POST /api/courses/assignments/:id/members — registrar miembros.
   * Roles ["Profesor","Admin","Superadmin"] (en ruta) + verificación de dueño en service.
   */
  static addMembers = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { memberIds } = req.body as { memberIds?: string[] };
    try {
      const assignment = await addMembersService(id, memberIds ?? [], {
        callerProfileId: req.auth?.profileId,
        callerRoles: req.auth?.roles ?? [],
      });
      return res.status(200).json({
        message: "Miembros registrados correctamente en el curso",
        assignment,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al actualizar los miembros del curso");
    }
  };

  /**
   * POST /api/courses/assignments/:id/close — cerrar curso.
   * Roles [TEACHING_ROLES, Admin, Superadmin] (en ruta) + verificación de dueño en service.
   */
  static close = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
      await closeAssignmentService(id, {
        callerProfileId: req.auth?.profileId,
        callerRoles: req.auth?.roles ?? [],
      });
      return res.status(200).json({ message: "Curso cerrado correctamente" });
    } catch (error) {
      return handleControllerError(res, error, "Error al cerrar el curso");
    }
  };

  /**
   * POST /api/courses/assignments/:id/reopen — reabrir curso completado.
   * Roles SUPERADMIN_ROLES (en ruta).
   */
  static reopen = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const body = (req.body ?? {}) as { totalClasses?: number };
    try {
      const assignment = await reopenAssignmentService(id, body);
      return res.status(200).json({
        message: "Curso reabierto correctamente",
        assignment,
      });
    } catch (error) {
      return handleControllerError(res, error, "Error al reabrir el curso");
    }
  };

  /**
   * GET /api/courses/my-courses — mis asignaciones activas.
   * Array plano (E-1, baja cardinalidad). Dispatch por rol del `req.auth`.
   */
  static findMyAssignments = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profileId = req.auth?.profileId;
      if (!profileId) {
        return res.status(200).json([]);
      }

      const isProfessor = req.auth?.roles.includes("Profesor");
      const filter = { status: "active", deletedAt: null };
      const assignments = isProfessor
        ? await buildMyProfessorAssignmentQuery(profileId, filter)
        : await buildMyStudentAssignmentQuery(profileId, filter);

      return res.status(200).json(assignments);
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener tus cursos");
    }
  };

  /**
   * GET /api/courses/my-courses/history — mi historial (status=completed).
   * Array plano (E-1). Orden `endDate desc`. Dispatch por rol del `req.auth`.
   */
  static findMyHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profileId = req.auth?.profileId;
      if (!profileId) {
        return res.status(200).json([]);
      }

      const isProfessor = req.auth?.roles.includes("Profesor");
      const filter = { status: "completed", deletedAt: null };
      const query = isProfessor
        ? buildMyProfessorAssignmentQuery(profileId, filter)
        : buildMyStudentAssignmentQuery(profileId, filter);

      const assignments = await query.sort({ endDate: -1 });
      return res.status(200).json(assignments);
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener tu historial de cursos");
    }
  };
}