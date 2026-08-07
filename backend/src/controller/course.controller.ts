import { Request, Response } from "express";
import Course from "../models/course.model";
import CourseAssigned from "../models/course-assigned.model";
import { emitRealtimeInvalidation } from "../realtime/socket";
import { handleControllerError } from "../services/app-error";

const COURSE_QUERY_KEYS = [["courses"]];

/**
 * Controller del catálogo de `Course` ( ADR-0001 §D1 ).
 * Sólo orquesta y responde; la lógica de negocio vive en `services/`.
 * Lecturas (`findAll`, `findById`) filtran `deletedAt: null`.
 * Mutaciones ( `create`, `update`, `remove` ) roles `ADMIN_ROLES` (en ruta).
 */
export class CourseController {
  /**
   * GET /api/courses — paginado con filtros name/level/isActive.
   * Respuesta `PaginatedResponse<Course>`.
   */
  static findAll = async (req: Request, res: Response) => {
    try {
      const rawPage = Number(req.query.page ?? 1);
      const rawLimit = Number(req.query.limit ?? 20);
      const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
      const limit = Math.min(Number.isInteger(rawLimit) && rawLimit >= 1 ? rawLimit : 20, 100);

      const filter: Record<string, unknown> = { deletedAt: null };

      if (typeof req.query.name === "string" && req.query.name.trim()) {
        filter.name = { $regex: req.query.name.trim(), $options: "i" };
      }
      if (typeof req.query.level === "string" && req.query.level) {
        filter.level = req.query.level;
      }
      if (typeof req.query.isActive === "string") {
        if (req.query.isActive === "true") filter.isActive = true;
        else if (req.query.isActive === "false") filter.isActive = false;
      }

      const [total, items] = await Promise.all([
        Course.countDocuments(filter),
        Course.find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      res.status(200).json({ items, total, page, limit });
    } catch (error) {
      handleControllerError(res, error, "Error al obtener cursos");
    }
  };

  /**
   * GET /api/courses/:id — detalle, 404 si no existe o está soft-deleted.
   */
  static findById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const course = await Course.findOne({ _id: id, deletedAt: null });
      if (!course) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }
      return res.status(200).json(course);
    } catch (error) {
      return handleControllerError(res, error, "Error al obtener curso");
    }
  };

  /**
   * POST /api/courses — crear curso. Devuelve `MessageResponse` JSON
   * ( contrato §1.3, era string literal previamente ).
   */
  static create = async (req: Request, res: Response) => {
    const { name, description, level, spiritualGrowthStage, isActive } = req.body;
    try {
      const course = new Course({ name, description, level, spiritualGrowthStage, isActive });
      await course.save();
      emitRealtimeInvalidation("courses.changed", COURSE_QUERY_KEYS);
      res.status(201).json({ message: "Curso creado exitosamente" });
    } catch (error) {
      handleControllerError(res, error, "Error al crear curso");
    }
  };

  /**
   * PUT /api/courses/:id — editar curso. Whitelist explícita de campos.
   */
  static update = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, level, spiritualGrowthStage, isActive } = req.body;
    try {
      const course = await Course.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { name, description, level, spiritualGrowthStage, isActive },
        { new: true },
      );
      if (!course) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }
      emitRealtimeInvalidation("courses.changed", COURSE_QUERY_KEYS);
      return res.status(200).json(course);
    } catch (error) {
      return handleControllerError(res, error, "Error al actualizar curso");
    }
  };

  /**
   * DELETE /api/courses/:id — soft-delete con validación E-4.
   * Si existe `CourseAssigned` con `course = id`, `status: "active"`,
   * `deletedAt: null` → 409 "No puedes eliminar un curso con asignaciones activas".
   */
  static remove = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const activeAssignment = await CourseAssigned.findOne({
        course: id,
        status: "active",
        deletedAt: null,
      });
      if (activeAssignment) {
        return res
          .status(409)
          .json({ message: "No puedes eliminar un curso con asignaciones activas" });
      }

      const course = await Course.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
      );
      if (!course) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }
      emitRealtimeInvalidation("courses.changed", COURSE_QUERY_KEYS);
      return res.status(200).json({ message: "Curso eliminado exitosamente" });
    } catch (error) {
      return handleControllerError(res, error, "Error al eliminar curso");
    }
  };
}