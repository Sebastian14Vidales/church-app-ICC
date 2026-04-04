import { Request, Response } from "express";
import Course from "../models/course.model";
import CourseAssigned from "../models/course-assigned.model";
import ClassSession from "../models/class-session.model";
import UserProfile from "../models/user-profile.model";
import { AuthenticatedRequest } from "../types/auth";
import { emitRealtimeInvalidation } from "../realtime/socket";

type AttendancePayload = {
  studentId: string;
  present: boolean;
  notes?: string;
};

const COURSE_QUERY_KEYS = [["courses"]];
const ASSIGNMENT_QUERY_KEYS = [["courseAssignments"], ["myCourses"], ["myAttendance"]];
const ATTENDANCE_QUERY_KEYS = [["myAttendance"], ["courseAssignments"]];

const calculateEndDate = (startDateValue: string, totalClasses: number) => {
  const startDate = new Date(startDateValue);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (totalClasses - 1) * 7);
  return endDate;
};

const calculateClassDate = (startDateValue: Date | string, classNumber: number) => {
  const classDate = new Date(startDateValue);
  classDate.setDate(classDate.getDate() + (classNumber - 1) * 7);
  return classDate;
};

export class CourseController {
  private static memberPopulate = {
    path: "members",
    populate: ["role", "user"],
  };

  private static professorPopulate = {
    path: "professor",
    populate: ["role", "user"],
  };

  private static attendancePopulate = {
    path: "attendance.student",
    populate: ["role", "user"],
  };

  private static buildAssignmentQuery = () =>
    CourseAssigned.find({})
      .populate("course")
      .populate(CourseController.memberPopulate)
      .populate(CourseController.professorPopulate);

  private static buildMyAssignmentQuery = (profileId: string) =>
    CourseAssigned.find({ professor: profileId })
      .populate("course")
      .populate(CourseController.memberPopulate)
      .populate(CourseController.professorPopulate);

  private static findMyActiveAssignment = (profileId: string) =>
    CourseAssigned.findOne({ professor: profileId, status: "active" })
      .populate("course")
      .populate(CourseController.memberPopulate)
      .populate(CourseController.professorPopulate);

  private static buildAttendanceOverview = async (profileId: string) => {
    const assignment = await CourseController.findMyActiveAssignment(profileId);

    if (!assignment) {
      return {
        assignment: null,
        sessions: [],
      };
    }

    const sessions = await ClassSession.find({ courseAssigned: assignment._id })
      .sort({ classNumber: 1 })
      .populate(CourseController.attendancePopulate);

    const sessionsByClassNumber = new Map(
      sessions.map((session) => [session.classNumber, session]),
    );

    const generatedSessions = Array.from({ length: assignment.totalClasses }, (_, index) => {
      const classNumber = index + 1;
      const storedSession = sessionsByClassNumber.get(classNumber);

      return {
        _id: storedSession ? String(storedSession._id) : null,
        classNumber,
        date: (storedSession?.date ?? calculateClassDate(assignment.startDate, classNumber)).toISOString(),
        topic: storedSession?.topic ?? "",
        observations: storedSession?.observations ?? "",
        attendance:
          storedSession?.attendance.map((entry) => ({
            student: entry.student,
            present: entry.present,
            notes: entry.notes ?? "",
          })) ?? [],
      };
    });

    return {
      assignment,
      sessions: generatedSessions,
    };
  };

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
      emitRealtimeInvalidation("courses.changed", COURSE_QUERY_KEYS);
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
      emitRealtimeInvalidation("courses.changed", COURSE_QUERY_KEYS);
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
      emitRealtimeInvalidation("courses.changed", COURSE_QUERY_KEYS);
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

      const assignments = await CourseController.buildMyAssignmentQuery(profileId);

      return res.status(200).json(assignments);
    } catch (error) {
      return res.status(500).json({ message: "Error al obtener tus cursos", error });
    }
  };

  static findMyAttendanceOverview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profileId = req.auth?.profileId;

      if (!profileId) {
        return res.status(200).json({
          assignment: null,
          sessions: [],
        });
      }

      const overview = await CourseController.buildAttendanceOverview(profileId);
      return res.status(200).json(overview);
    } catch (error) {
      return res.status(500).json({ message: "Error al obtener la asistencia del curso activo", error });
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
        .populate(CourseController.professorPopulate);

      emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);
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
        .populate(CourseController.professorPopulate);

      emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);
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
      emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);

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

      if (assignment.status !== "active") {
        return res.status(400).json({
          message: "Solo puedes registrar miembros en cursos activos",
        });
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
        .populate(CourseController.professorPopulate);

      emitRealtimeInvalidation("courseAssignments.members.changed", ASSIGNMENT_QUERY_KEYS);
      return res.status(200).json({
        message: "Miembros registrados correctamente en el curso",
        assignment: updatedAssignment,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al actualizar los miembros del curso", error });
    }
  };

  static closeMyAssignment = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

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

      const canClose =
        isOwnerProfessor ||
        req.auth?.roles.some((role) => ["Admin", "Superadmin"].includes(role));

      if (!canClose) {
        return res.status(403).json({ message: "No tienes permisos para cerrar este curso" });
      }

      if (assignment.status !== "active") {
        return res.status(400).json({ message: "Este curso ya no esta activo" });
      }

      const savedSessionsCount = await ClassSession.countDocuments({
        courseAssigned: assignment._id,
      });

      if (savedSessionsCount < assignment.totalClasses) {
        return res.status(400).json({
          message: "Debes registrar todas las clases antes de cerrar el curso",
        });
      }

      assignment.status = "completed";
      await assignment.save();

      emitRealtimeInvalidation("courseAssignments.closed", ASSIGNMENT_QUERY_KEYS);
      return res.status(200).json({
        message: "Curso cerrado correctamente",
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al cerrar el curso", error });
    }
  };

  static saveMyAttendance = async (req: AuthenticatedRequest, res: Response) => {
    const { classNumber } = req.params;
    const { attendance, topic, observations } = req.body as {
      attendance?: AttendancePayload[];
      topic?: string;
      observations?: string;
    };

    try {
      const profileId = req.auth?.profileId;

      if (!profileId) {
        return res.status(401).json({ message: "No autorizado" });
      }

      const assignment = await CourseController.findMyActiveAssignment(profileId);

      if (!assignment) {
        return res.status(404).json({ message: "No tienes un curso activo asignado" });
      }

      const normalizedClassNumber = Number(classNumber);

      if (!Number.isInteger(normalizedClassNumber) || normalizedClassNumber < 1) {
        return res.status(400).json({ message: "El numero de clase no es valido" });
      }

      if (normalizedClassNumber > assignment.totalClasses) {
        return res.status(400).json({ message: "La clase seleccionada no existe en este curso" });
      }

      const assignmentMemberIds = assignment.members.map((member) => String(member._id));
      const normalizedAttendance = Array.isArray(attendance)
        ? attendance
            .filter(
              (entry): entry is AttendancePayload =>
                Boolean(entry) &&
                typeof entry.studentId === "string" &&
                typeof entry.present === "boolean",
            )
            .map((entry) => ({
              student: entry.studentId,
              present: entry.present,
              notes: typeof entry.notes === "string" ? entry.notes.trim() : undefined,
            }))
        : [];

      const uniqueStudentIds = new Set(normalizedAttendance.map((entry) => entry.student));

      if (uniqueStudentIds.size !== normalizedAttendance.length) {
        return res.status(400).json({ message: "No puedes repetir estudiantes en la asistencia" });
      }

      const allStudentsBelongToAssignment = normalizedAttendance.every((entry) =>
        assignmentMemberIds.includes(entry.student),
      );

      if (!allStudentsBelongToAssignment) {
        return res.status(400).json({ message: "Solo puedes registrar asistencia de miembros de tu curso" });
      }

      if (
        assignmentMemberIds.length > 0 &&
        normalizedAttendance.length !== assignmentMemberIds.length
      ) {
        return res.status(400).json({
          message: "Debes registrar la asistencia de todos los miembros inscritos en la clase",
        });
      }

      const sortedAttendance = assignmentMemberIds
        .map((memberId) => normalizedAttendance.find((entry) => entry.student === memberId))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const savedSession = await ClassSession.findOneAndUpdate(
        {
          courseAssigned: assignment._id,
          classNumber: normalizedClassNumber,
        },
        {
          courseAssigned: assignment._id,
          classNumber: normalizedClassNumber,
          date: calculateClassDate(assignment.startDate, normalizedClassNumber),
          topic: typeof topic === "string" ? topic.trim() : undefined,
          observations: typeof observations === "string" ? observations.trim() : undefined,
          attendance: sortedAttendance,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      ).populate(CourseController.attendancePopulate);

      emitRealtimeInvalidation("attendance.changed", ATTENDANCE_QUERY_KEYS);
      return res.status(200).json({
        message: "Asistencia guardada correctamente",
        session: savedSession,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al guardar la asistencia", error });
    }
  };
}
