import ClassSession from "../models/class-session.model";
import { emitRealtimeInvalidation } from "../realtime/socket";
import {
  attendancePopulate,
  findMyActiveAssignment,
} from "./course-assignment.service";
import { AppError } from "./app-error";

const ATTENDANCE_QUERY_KEYS = [["myAttendance"], ["courseAssignments"]];

const calculateClassDate = (startDateValue: Date | string, classNumber: number) => {
  const classDate = new Date(startDateValue);
  classDate.setDate(classDate.getDate() + (classNumber - 1) * 7);
  return classDate;
};

/**
 * Devuelve el overview de asistencia del profesor autenticado:
 * su `CourseAssigned` activa (o null) + sesiones 1..totalClasses generadas.
 * Las sesiones no guardadas se devuelven con `_id: null`, `topic: ""`,
 * `observations: ""`, `attendance: []` y `date` calculada.
 * Las guardadas se devuelven con su `_id`, datos persistidos y `attendance` populada.
 */
export const getMyActiveAssignmentOverview = async (professorProfileId: string) => {
  const assignment = await findMyActiveAssignment(professorProfileId);

  if (!assignment) {
    return {
      assignment: null,
      sessions: [],
    };
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

export type AttendanceEntry = {
  studentId: string;
  present: boolean;
  notes?: string;
};

export type SaveAttendanceBody = {
  attendance?: AttendanceEntry[];
  topic?: string;
  observations?: string;
};

/**
 * Guarda la asistencia de la clase `classNumber` para el profesor autenticado.
 * `ClassSession.findOneAndUpdate({ courseAssigned, classNumber }, { ... }, { upsert: true, new: true })`.
 * Validaciones del contrato §4.2: estudiantes == miembros, sin repetidos, sin externos,
 * cantidad == miembros. Emite realtime `attendance.changed`.
 */
export const saveAttendance = async (
  professorProfileId: string,
  classNumber: string,
  body: SaveAttendanceBody,
) => {
  const assignment = await findMyActiveAssignment(professorProfileId);
  if (!assignment) {
    throw new AppError(404, "No tienes un curso activo asignado");
  }

  const normalizedClassNumber = Number(classNumber);
  if (!Number.isInteger(normalizedClassNumber) || normalizedClassNumber < 1) {
    throw new AppError(400, "El numero de clase no es valido");
  }
  if (normalizedClassNumber > assignment.totalClasses) {
    throw new AppError(400, "La clase seleccionada no existe en este curso");
  }

  const assignmentMemberIds = assignment.members.map((member) => String(member._id));
  const normalizedAttendance: Array<{
    student: string;
    present: boolean;
    notes?: string;
  }> = Array.isArray(body.attendance)
    ? body.attendance
        .filter(
          (entry): entry is AttendanceEntry =>
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
    throw new AppError(400, "No puedes repetir estudiantes en la asistencia");
  }

  const allStudentsBelongToAssignment = normalizedAttendance.every((entry) =>
    assignmentMemberIds.includes(entry.student),
  );
  if (!allStudentsBelongToAssignment) {
    throw new AppError(400, "Solo puedes registrar asistencia de miembros de tu curso");
  }

  if (
    assignmentMemberIds.length > 0 &&
    normalizedAttendance.length !== assignmentMemberIds.length
  ) {
    throw new AppError(
      400,
      "Debes registrar la asistencia de todos los miembros inscritos en la clase",
    );
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
      topic: typeof body.topic === "string" ? body.topic.trim() : undefined,
      observations:
        typeof body.observations === "string" ? body.observations.trim() : undefined,
      attendance: sortedAttendance,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).populate(attendancePopulate);

  emitRealtimeInvalidation("attendance.changed", ATTENDANCE_QUERY_KEYS);

  return savedSession;
};