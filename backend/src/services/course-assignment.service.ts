import mongoose from "mongoose";
import CourseAssigned from "../models/course-assigned.model";
import Course from "../models/course.model";
import ClassSession from "../models/class-session.model";
import UserProfile, { SPIRITUAL_GROWTH_STAGES } from "../models/user-profile.model";
import { emitRealtimeInvalidation } from "../realtime/socket";
import { AppError } from "./app-error";
import type { CourseAssignedStatus } from "../models/course-assigned.model";

/**
 * Query keys invalidadas por una mutación de asignaciones.
 * Las keys están alineadas con `docs/api/courses-api.md` §0.
 */
const ASSIGNMENT_QUERY_KEYS = [["courseAssignments"], ["myCourses"], ["myAttendance"]];
const HISTORY_QUERY_KEYS = [["courseHistory"]];

/**
 * Configuración de populate reutilizable para `CourseAssigned`.
 * Se exporta para que los controllers la usen en consultas de lectura.
 */
export const memberPopulate = {
  path: "members",
  populate: [
    "role",
    {
      path: "user",
      populate: { path: "roles" },
    },
  ],
};

export const professorPopulate = {
  path: "professor",
  populate: [
    "role",
    {
      path: "user",
      populate: { path: "roles" },
    },
  ],
};

export const attendancePopulate = {
  path: "attendance.student",
  populate: [
    "role",
    {
      path: "user",
      populate: { path: "roles" },
    },
  ],
};

type Filter = Record<string, unknown>;

/**
 * Helper de consulta: buildAssignmentQuery — devuelve query ya populada
 * para listados de asignaciones aplicando el filtro indicado.
 */
export const buildAssignmentQuery = (filter: Filter = {}) =>
  CourseAssigned.find(filter)
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

export const buildMyProfessorAssignmentQuery = (profileId: string, filter: Filter = {}) =>
  CourseAssigned.find({ professor: profileId, ...filter })
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

export const buildMyStudentAssignmentQuery = (profileId: string, filter: Filter = {}) =>
  CourseAssigned.find({ members: profileId, ...filter })
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

export const findMyActiveAssignment = (profileId: string) =>
  CourseAssigned.findOne({ professor: profileId, status: "active", deletedAt: null })
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

/**
 * Calcula `endDate` calendario a partir de `startDate` y `totalClasses`
 * (ADR-0001 §D5, contrato §2.3): `startDate + (totalClasses-1) * 7 días`.
 */
export const calculateEndDate = (startDateValue: string, totalClasses: number) => {
  const startDate = new Date(startDateValue);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (totalClasses - 1) * 7);
  return endDate;
};

/**
 * Verifica si un perfil poblado tiene rol "Profesor" (rol primario o rol
 * vinculado al User). Conserva la heurística del controller original.
 */
const hasProfessorRole = (profile: unknown) => {
  if (!profile) {
    return false;
  }

  const profileWithRelations = profile as {
    role?: { name?: string } | null;
    user?: { roles?: Array<{ name?: string } | null> } | null;
  };

  const primaryRoleName =
    profileWithRelations.role &&
    typeof profileWithRelations.role === "object" &&
    typeof profileWithRelations.role.name === "string"
      ? profileWithRelations.role.name
      : null;

  if (primaryRoleName === "Profesor") {
    return true;
  }

  const linkedUserRoles =
    profileWithRelations.user &&
    typeof profileWithRelations.user === "object" &&
    Array.isArray(profileWithRelations.user.roles)
      ? profileWithRelations.user.roles
      : [];

  return linkedUserRoles.some(
    (role) =>
      role && typeof role === "object" && "name" in role && role.name === "Profesor",
  );
};

/**
 * Lanza 409 si el profesor ya tiene otra `CourseAssigned` activa (no soft-deleted).
 * `excludeAssignmentId` se usa al editar para excluir la propia asignación.
 */
export const validateProfessorUniqueActive = async (
  professorId: string,
  excludeAssignmentId?: string,
) => {
  const filter: Record<string, unknown> = {
    professor: professorId,
    status: "active",
    deletedAt: null,
  };
  if (excludeAssignmentId) {
    filter._id = { $ne: excludeAssignmentId };
  }
  const activeAssignment = await CourseAssigned.findOne(filter);
  if (activeAssignment) {
    const activeCourse = await Course.findOne({
      _id: activeAssignment.course,
      deletedAt: null,
    });
    if (!activeCourse) {
      await CourseAssigned.deleteOne({ _id: activeAssignment._id });
      return;
    }
    throw new AppError(409, "Este profesor ya tiene un curso activo asignado");
  }
};

export type CreateAssignmentBody = {
  course: string;
  professor: string;
  startDate: string;
  startTime: string;
  totalClasses: number;
  location: string;
  status?: CourseAssignedStatus;
};

/**
 * Crea una `CourseAssigned` tras validar existencia del `Course` (no soft-deleted),
 * existencia y rol "Profesor" del `UserProfile`, y unicidad de profesor activo.
 * Emite realtime `courseAssignments.changed`.
 */
export const createAssignment = async (body: CreateAssignmentBody) => {
  const {
    course,
    professor,
    startDate,
    startTime,
    totalClasses,
    location,
    status = "active",
  } = body;

  const existingCourse = await Course.findOne({ _id: course, deletedAt: null });
  if (!existingCourse) {
    throw new AppError(404, "Curso no encontrado");
  }

  const professorProfile = await UserProfile.findById(professor)
    .populate("role")
    .populate({ path: "user", populate: { path: "roles" } });
  if (!professorProfile) {
    throw new AppError(404, "Profesor no encontrado");
  }
  if (!hasProfessorRole(professorProfile)) {
    throw new AppError(400, "El miembro seleccionado no tiene rol de profesor");
  }

  await validateProfessorUniqueActive(professor);

  const computedEndDate = calculateEndDate(startDate, Number(totalClasses));

  let createdAssignmentId: mongoose.Types.ObjectId;
  try {
    const created = await CourseAssigned.create({
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
    createdAssignmentId = created._id;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    ) {
      throw new AppError(409, "Este profesor ya tiene un curso activo asignado");
    }
    throw error;
  }

  const populatedAssignment = await CourseAssigned.findById(createdAssignmentId)
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

  emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);
  return populatedAssignment;
};

export type UpdateAssignmentBody = {
  course: string;
  professor: string;
  startDate: string;
  startTime: string;
  totalClasses: number;
  location: string;
  status?: CourseAssignedStatus;
};

/**
 * Actualiza una `CourseAssigned` (sólo Superadmin a nivel de ruta).
 * Repite las validaciones de `createAssignment` (curso, profesor, rol) y
 * valida unicidad de profesor activo **excluyendo la propia asignación**.
 * Emite realtime `courseAssignments.changed`.
 */
export const updateAssignment = async (id: string, body: UpdateAssignmentBody) => {
  const existingAssignment = await CourseAssigned.findOne({ _id: id, deletedAt: null });
  if (!existingAssignment) {
    throw new AppError(404, "Asignacion no encontrada");
  }

  const {
    course,
    professor,
    startDate,
    startTime,
    totalClasses,
    location,
    status = existingAssignment.status,
  } = body;

  const existingCourse = await Course.findOne({ _id: course, deletedAt: null });
  if (!existingCourse) {
    throw new AppError(404, "Curso no encontrado");
  }

  const professorProfile = await UserProfile.findById(professor)
    .populate("role")
    .populate({ path: "user", populate: { path: "roles" } });
  if (!professorProfile) {
    throw new AppError(404, "Profesor no encontrado");
  }
  if (!hasProfessorRole(professorProfile)) {
    throw new AppError(400, "El miembro seleccionado no tiene rol de profesor");
  }

  await validateProfessorUniqueActive(professor, id);

  const computedEndDate = calculateEndDate(startDate, Number(totalClasses));

  const updatedAssignment = await CourseAssigned.findOneAndUpdate(
    { _id: id, deletedAt: null },
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
    .populate(memberPopulate)
    .populate(professorPopulate);

  emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);
  return updatedAssignment;
};

/**
 * Borrado físico de una `CourseAssigned` + cascada de sus `ClassSession`
 * (ADR-0009 §D2, excepción al soft-delete del catálogo de asignaciones).
 * Elimina permanentemente la asignación y las sesiones de clase vinculadas
 * de la base de datos, para que el profesor quede libre de inmediato y no
 * queden registros huerfanos que bloqueen nuevas asignaciones (error 409
 * "Este profesor ya tiene un curso activo asignado").
 * Emite realtime `courseAssignments.changed`.
 *
 * El nombre `softDeleteAssignment` se conserva por compatibilidad de la
 * superficie publica (controller, tests, frontend), pero la operacion es
 * ahora un hard-delete en cascada ratificado por el Sponsor.
 *
 * [AUDIT-PENDING] Debe registrarse acción `course.assignment.delete`
 * con contexto `{ assignmentId }` una vez disponible el módulo de auditoría.
 */
export const softDeleteAssignment = async (id: string) => {
  const assignment = await CourseAssigned.findOne({ _id: id, deletedAt: null });
  if (!assignment) {
    throw new AppError(404, "Asignacion no encontrada");
  }
  // Cascada: eliminar sesiones de clase vinculadas y la asignacion (fisico).
  await ClassSession.deleteMany({ courseAssigned: id });
  await CourseAssigned.deleteOne({ _id: id });
  emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);
  // TODO[AUDIT-PENDING]: audit("course.assignment.delete", { assignmentId: id })
  return assignment;
};

/**
 * Devuelve la siguiente etapa de crecimiento espiritual en la secuencia canónica.
 * - Sin etapa actual (null, undefined o vacío): "Consolidación".
 * - Etapa inválida o última etapa ("Doctrina cristiana"): `null` (no hay siguiente).
 * Nota: la última etapa depende de `SPIRITUAL_GROWTH_STAGES`; insertar una
 * etapa intermedia no requiere cambios de lógica (ADR-0007).
 */
export const getNextSpiritualGrowthStage = (currentStage?: string | null) => {
  if (!currentStage) return SPIRITUAL_GROWTH_STAGES[0];
  const currentIndex = SPIRITUAL_GROWTH_STAGES.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === SPIRITUAL_GROWTH_STAGES.length - 1) return null;
  return SPIRITUAL_GROWTH_STAGES[currentIndex + 1];
};

const memberIdToString = (member: unknown) => {
  if (typeof member === "string") return member;
  const candidate = member as { _id?: unknown; toString?: () => string } | null;
  if (candidate?._id !== undefined) return String(candidate._id);
  return candidate?.toString ? candidate.toString() : String(member);
};

export type AddMembersContext = {
  callerProfileId?: string | null;
  callerRoles: string[];
};

/**
 * Reemplaza los `members` de una asignación activa.
 * Valida:
 *   - existencia y no soft-delete de la asignación (404 "Asignacion no encontrada")
 *   - verificación de dueño si el caller es Profesor (no Admin/Superadmin bypass)
 *   - status === "active" y deletedAt: null (400 "Solo puedes registrar miembros en cursos activos")
 *   - cada memberId existe (404)
 *   - todos los memberIds tienen role.name ∈ {Asistente, Miembro}
 *     (400 "Solo puedes registrar perfiles con rol Asistente o Miembro")
 *   - la siguiente etapa de crecimiento espiritual del miembro coincide con la etapa del curso
 *     (400 con mensaje personalizado por miembro, ADR-0006 D3).
 * Emite realtime `courseAssignments.members.changed`.
 */
export const addMembers = async (id: string, memberIds: string[], context: AddMembersContext) => {
  const assignment = await CourseAssigned.findOne({ _id: id, deletedAt: null })
    .populate("course")
    .populate({
      path: "professor",
      populate: ["role", "user"],
    });

  if (!assignment) {
    throw new AppError(404, "Asignacion no encontrada");
  }

  const isOwnerProfessor =
    context.callerProfileId &&
    String((assignment.professor as { _id: unknown })._id) === context.callerProfileId;
  const canManage =
    isOwnerProfessor ||
    context.callerRoles.some((role) => ["Admin", "Superadmin"].includes(role));

  if (!canManage) {
    throw new AppError(403, "No tienes permisos para actualizar esta asignacion");
  }

  if (assignment.status !== "active") {
    throw new AppError(400, "Solo puedes registrar miembros en cursos activos");
  }

  const courseStage = (assignment.course as { spiritualGrowthStage?: string } | null)
    ?.spiritualGrowthStage;
  if (!courseStage) {
    throw new AppError(500, "La asignación no tiene una etapa de crecimiento definida");
  }

  const normalizedMemberIds = Array.from(
    new Set((memberIds ?? []).filter((memberId) => typeof memberId === "string")),
  );

  const availableMembers = await UserProfile.find({
    _id: { $in: normalizedMemberIds },
  }).populate("role");

  const memberById = new Map(
    availableMembers.map((member) => [memberIdToString(member), member]),
  );

  for (const memberId of normalizedMemberIds) {
    if (!memberById.has(memberId)) {
      throw new AppError(404, `No se encontró un miembro con ID ${memberId}`);
    }
  }

  const allowedMembers = availableMembers.filter((member) => {
    const role = (member as { role?: { name?: string } | null }).role;
    return (
      role && typeof role === "object" && "name" in role && ["Asistente", "Miembro"].includes(role.name as string)
    );
  });

  if (allowedMembers.length !== normalizedMemberIds.length) {
    throw new AppError(400, "Solo puedes registrar perfiles con rol Asistente o Miembro");
  }

  for (const memberId of normalizedMemberIds) {
    const member = memberById.get(memberId)!;
    const nextStage = getNextSpiritualGrowthStage(member.spiritualGrowthStage);
    if (nextStage !== courseStage) {
      const memberName = `${member.firstName} ${member.lastName}`;
      if (nextStage === null) {
        throw new AppError(
          400,
          `${memberName} no puede inscribirse: ya alcanzó la última etapa de crecimiento espiritual`,
        );
      }
      throw new AppError(
        400,
        `${memberName} no es elegible para el curso "${courseStage}". Su siguiente etapa es "${nextStage}".`,
      );
    }
  }

  const updatedAssignment = await CourseAssigned.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { members: normalizedMemberIds } },
    { new: true },
  )
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

  emitRealtimeInvalidation("courseAssignments.members.changed", ASSIGNMENT_QUERY_KEYS);
  return updatedAssignment;
};

export type CloseAssignmentContext = {
  callerProfileId?: string | null;
  callerRoles: string[];
};

/**
 * Cierra un curso: set `status = "completed"` y `endedAt = new Date()`.
 * Valida existencia + active status + todas las sesiones registradas
 * ( `ClassSession.countDocuments >= totalClasses` ).
 * Verificación de dueño si el caller es Profesor.
 * Después del cierre, recorre los miembros inscritos y, si su asistencia >= 70%,
 * actualiza `UserProfile.spiritualGrowthStage` a la etapa del curso (ADR-0006 D5).
 * Emite realtime `courseAssignments.closed` y `courseHistory.changed`.
 *
 * [AUDIT-PENDING] Debe registrarse acción `course.assignment.close`
 * con contexto `{ assignmentId, professorId }`.
 */
export const closeAssignment = async (id: string, context: CloseAssignmentContext) => {
  const assignment = await CourseAssigned.findOne({ _id: id, deletedAt: null })
    .populate("course")
    .populate({
      path: "professor",
      populate: ["role", "user"],
    });

  if (!assignment) {
    throw new AppError(404, "Asignacion no encontrada");
  }

  const isOwnerProfessor =
    context.callerProfileId &&
    String((assignment.professor as { _id: unknown })._id) === context.callerProfileId;
  const canClose =
    isOwnerProfessor ||
    context.callerRoles.some((role) => ["Admin", "Superadmin"].includes(role));

  if (!canClose) {
    throw new AppError(403, "No tienes permisos para cerrar este curso");
  }

  if (assignment.status !== "active") {
    throw new AppError(400, "Este curso ya no esta activo");
  }

  const savedSessionsCount = await ClassSession.countDocuments({
    courseAssigned: assignment._id,
    deletedAt: null,
  });

  if (savedSessionsCount < assignment.totalClasses) {
    throw new AppError(400, "Debes registrar todas las clases antes de cerrar el curso");
  }

  assignment.status = "completed";
  assignment.endedAt = new Date();
  await assignment.save();

  const courseStage = (assignment.course as { spiritualGrowthStage?: string } | null)
    ?.spiritualGrowthStage;
  if (courseStage) {
    const sessions = await ClassSession.find({
      courseAssigned: assignment._id,
      deletedAt: null,
    });

    const memberIds = assignment.members.map((member) => memberIdToString(member));

    for (const memberId of memberIds) {
      const totalClasses = assignment.totalClasses;
      const presentCount = sessions.reduce((count, session) => {
        const entry = session.attendance.find(
          (att) => memberIdToString(att.student) === memberId,
        );
        return count + (entry?.present === true ? 1 : 0);
      }, 0);
      const attendanceRate = totalClasses ? Math.round((presentCount / totalClasses) * 100) : 0;

      if (attendanceRate >= 70) {
        await UserProfile.findByIdAndUpdate(memberId, { spiritualGrowthStage: courseStage });
      }
    }
  }

  emitRealtimeInvalidation("courseAssignments.closed", ASSIGNMENT_QUERY_KEYS);
  emitRealtimeInvalidation("courseHistory.changed", HISTORY_QUERY_KEYS);
  // TODO[AUDIT-PENDING]: audit("course.assignment.close", { assignmentId: id, professorId: assignment.professor._id })
  return assignment;
};

export type ReopenAssignmentBody = {
  totalClasses?: number;
};

/**
 * Reabre una asignación `completed` (sólo Superadmin a nivel de ruta).
 * Transacción Mongo (ADR-0001 §D5, AC7.1-AC7.4):
 *   - La asignación debe existir, `status === "completed"`, `deletedAt: null`.
 *   - El profesor NO debe tener otra activa (409 "El profesor ya tiene otro curso activo asignado").
 *   - Recalcular `endDate` si `totalClasses` viene.
 *   - Si `totalClasses` nuevo < anterior, soft-delete en `ClassSession` con `classNumber > nuevoTotal`
 *     (AC7.6: NO borrar físicamente).
 *   - Set `status = "active"`, `endedAt = null`.
 *   - Emitir realtime `courseHistory.changed` y `courseAssignments.changed`.
 *
 * [AUDIT-PENDING] Debe registrarse acción `course.reopen` con contexto
 * `{ assignmentId, oldStatus: "completed", newStatus: "active", totalClasses }`.
 */
export const reopenAssignment = async (id: string, body: ReopenAssignmentBody) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const assignment = await CourseAssigned.findOne({
        _id: id,
        deletedAt: null,
      }).session(session);

      if (!assignment) {
        throw new AppError(404, "Asignación no encontrada");
      }
      if (assignment.status !== "completed") {
        throw new AppError(409, "Solo se puede reabrir una asignación completada");
      }

      const conflicting = await CourseAssigned.findOne({
        professor: assignment.professor,
        status: "active",
        deletedAt: null,
        _id: { $ne: id },
      }).session(session);
      if (conflicting) {
        throw new AppError(409, "El profesor ya tiene otro curso activo asignado");
      }

      const previousTotalClasses = assignment.totalClasses;
      let nextTotalClasses = previousTotalClasses;

      if (body?.totalClasses !== undefined) {
        const incoming = Number(body.totalClasses);
        if (!Number.isInteger(incoming) || incoming < 1) {
          throw new AppError(400, "El total de clases debe ser un entero mayor a 0");
        }
        nextTotalClasses = incoming;
      }

      if (nextTotalClasses !== previousTotalClasses) {
        assignment.totalClasses = nextTotalClasses;
        assignment.endDate = calculateEndDate(
          assignment.startDate.toISOString(),
          nextTotalClasses,
        );

        if (nextTotalClasses < previousTotalClasses) {
          await ClassSession.updateMany(
            {
              courseAssigned: assignment._id,
              classNumber: { $gt: nextTotalClasses },
              deletedAt: null,
            },
            { $set: { deletedAt: new Date() } },
            { session },
          );
        }
      }

      assignment.status = "active";
      assignment.endedAt = null;
      await assignment.save({ session });
    });
  } finally {
    await session.endSession();
  }

  const populatedAssignment = await CourseAssigned.findById(id)
    .populate("course")
    .populate(memberPopulate)
    .populate(professorPopulate);

  if (!populatedAssignment) {
    throw new AppError(500, "Error al reabrir el curso");
  }

  emitRealtimeInvalidation("courseHistory.changed", HISTORY_QUERY_KEYS);
  emitRealtimeInvalidation("courseAssignments.changed", ASSIGNMENT_QUERY_KEYS);
  // TODO[AUDIT-PENDING]: audit("course.reopen", {
  //   assignmentId: id,
  //   oldStatus: "completed",
  //   newStatus: "active",
  //   totalClasses: populatedAssignment.totalClasses,
  // })
  return populatedAssignment;
};
