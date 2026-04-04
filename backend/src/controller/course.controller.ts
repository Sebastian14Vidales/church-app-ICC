import { Request, Response } from "express";
import Course from "../models/course.model";
import CourseAssigned from "../models/course-assigned.model";
import ClassSession from "../models/class-session.model";
import UserProfile from "../models/user-profile.model";
import { AuthenticatedRequest } from "../types/auth";

const calculateEndDate = (startDateValue: string, totalClasses: number) => {
  const startDate = new Date(startDateValue);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (totalClasses - 1) * 7);
  return endDate;
};

export class CourseController {
  private static memberPopulate = {
    path: "members",
    populate: ["role", "user"],
  };

  private static buildAssignmentQuery = () =>
    CourseAssigned.find({})
      .populate("course")
      .populate(CourseController.memberPopulate)
      .populate({
        path: "professor",
        populate: ["role", "user"],
      });

  //get all courses
  static findAll = async (req: Request, res: Response) => {
    try {
      const courses = await Course.find({});
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener cursos", error });
    }
  };

  //create a new course
  static create = async (req: Request, res: Response) => {
    const course = new Course(req.body);
    try {
      await course.save();
      res.send("Curso creado exitosamente");
    } catch (error) {
      res.status(500).json({ message: "Error al crear curso", error });
    }
  };

  //get course by id
  static findById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }
      res.status(200).json(course);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener curso", error });
    }
  };

  //update course by id
  static update = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const course = await Course.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (!course) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }
      res.status(200).json(course);
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar curso", error });
    }
  };

  // delete course by id
  static remove = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const course = await Course.findByIdAndDelete(id);
      if (!course) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }
      res.status(200).json({ message: "Curso eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar curso", error });
    }
  };

  static findAssignments = async (_req: Request, res: Response) => {
    try {
      const assignments = await CourseController.buildAssignmentQuery();

      res.status(200).json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener asignaciones", error });
    }
  };

  static findMyAssignments = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profileId = req.auth?.profileId;

      if (!profileId) {
        return res.status(200).json([]);
      }

      const assignments = await CourseAssigned.find({ professor: profileId })
        .populate("course")
        .populate(CourseController.memberPopulate)
        .populate({
          path: "professor",
          populate: ["role", "user"],
        });

      return res.status(200).json(assignments);
    } catch (error) {
      return res.status(500).json({ message: "Error al obtener tus cursos", error });
    }
  };

  static assignCourse = async (req: Request, res: Response) => {
    try {
      const {
        course,
        professor,
        startDate,
        startTime,
        totalClasses,
        location,
        status = "active",
      } = req.body;

      const existingCourse = await Course.findById(course);
      if (!existingCourse) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }

      const professorProfile = await UserProfile.findById(professor).populate("role");
      if (!professorProfile) {
        return res.status(404).json({ message: "Profesor no encontrado" });
      }

      if ("name" in professorProfile.role && professorProfile.role.name !== "Profesor") {
        return res.status(400).json({ message: "El miembro seleccionado no tiene rol de profesor" });
      }

      const activeAssignment = await CourseAssigned.findOne({
        professor,
        status: "active",
      });

      if (activeAssignment) {
        return res.status(409).json({
          message: "Este profesor ya tiene un curso activo asignado",
        });
      }

      const computedEndDate = calculateEndDate(startDate, Number(totalClasses));

      const assignment = await CourseAssigned.create({
        course,
        professor,
        members: [],
        startDate,
        startTime,
        totalClasses,
        endDate: computedEndDate,
        location,
        status,
      });

      const createdAssignment = await CourseAssigned.findById(assignment._id)
        .populate("course")
        .populate(CourseController.memberPopulate)
        .populate({
          path: "professor",
          populate: ["role", "user"],
        });

      res.status(201).json({
        message: "Curso asignado correctamente",
        assignment: createdAssignment,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        return res.status(409).json({
          message: "Este profesor ya tiene un curso activo asignado",
        });
      }

      res.status(500).json({ message: "Error al asignar curso", error });
    }
  };

  static updateAssignment = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const existingAssignment = await CourseAssigned.findById(id);

      if (!existingAssignment) {
        return res.status(404).json({ message: "Asignacion no encontrada" });
      }

      const {
        course,
        professor,
        startDate,
        startTime,
        totalClasses,
        location,
        status = existingAssignment.status,
      } = req.body;

      const existingCourse = await Course.findById(course);
      if (!existingCourse) {
        return res.status(404).json({ message: "Curso no encontrado" });
      }

      const professorProfile = await UserProfile.findById(professor).populate("role");
      if (!professorProfile) {
        return res.status(404).json({ message: "Profesor no encontrado" });
      }

      if ("name" in professorProfile.role && professorProfile.role.name !== "Profesor") {
        return res.status(400).json({ message: "El miembro seleccionado no tiene rol de profesor" });
      }

      const activeAssignment = await CourseAssigned.findOne({
        professor,
        status: "active",
        _id: { $ne: id },
      });

      if (activeAssignment) {
        return res.status(409).json({
          message: "Este profesor ya tiene un curso activo asignado",
        });
      }

      const computedEndDate = calculateEndDate(startDate, Number(totalClasses));

      const updatedAssignment = await CourseAssigned.findByIdAndUpdate(
        id,
        {
          course,
          professor,
          startDate,
          startTime,
          totalClasses,
          endDate: computedEndDate,
          location,
          status,
        },
        { new: true },
      )
        .populate("course")
        .populate(CourseController.memberPopulate)
        .populate({
          path: "professor",
          populate: ["role", "user"],
        });

      return res.status(200).json({
        message: "Asignacion actualizada correctamente",
        assignment: updatedAssignment,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        return res.status(409).json({
          message: "Este profesor ya tiene un curso activo asignado",
        });
      }

      return res.status(500).json({ message: "Error al actualizar la asignacion", error });
    }
  };

  static removeAssignment = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const assignment = await CourseAssigned.findByIdAndDelete(id);

      if (!assignment) {
        return res.status(404).json({ message: "Asignacion no encontrada" });
      }

      await ClassSession.deleteMany({ courseAssigned: id });

      return res.status(200).json({ message: "Asignacion eliminada correctamente" });
    } catch (error) {
      return res.status(500).json({ message: "Error al eliminar la asignacion", error });
    }
  };

  static updateAssignmentMembers = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { memberIds } = req.body as { memberIds?: string[] };

    try {
      const assignment = await CourseAssigned.findById(id).populate({
        path: "professor",
        populate: ["role", "user"],
      });

      if (!assignment) {
        return res.status(404).json({ message: "Asignacion no encontrada" });
      }

      const isOwnerProfessor =
        req.auth?.profileId && String(assignment.professor._id) === req.auth.profileId;

      const canManage =
        isOwnerProfessor ||
        req.auth?.roles.some((role) => ["Admin", "Superadmin"].includes(role));

      if (!canManage) {
        return res.status(403).json({ message: "No tienes permisos para actualizar esta asignacion" });
      }

      const normalizedMemberIds = Array.from(
        new Set((memberIds ?? []).filter((memberId) => typeof memberId === "string")),
      );

      const availableMembers = await UserProfile.find({
        _id: { $in: normalizedMemberIds },
      }).populate("role");

      const allowedMembers = availableMembers.filter((member) =>
        "name" in member.role &&
        ["Asistente", "Miembro"].includes(member.role.name),
      );

      if (allowedMembers.length !== normalizedMemberIds.length) {
        return res.status(400).json({
          message: "Solo puedes registrar perfiles con rol Asistente o Miembro",
        });
      }

      const updatedAssignment = await CourseAssigned.findByIdAndUpdate(
        id,
        {
          members: normalizedMemberIds,
        },
        { new: true },
      )
        .populate("course")
        .populate(CourseController.memberPopulate)
        .populate({
          path: "professor",
          populate: ["role", "user"],
        });

      return res.status(200).json({
        message: "Miembros registrados correctamente en el curso",
        assignment: updatedAssignment,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al actualizar los miembros del curso", error });
    }
  };
}
