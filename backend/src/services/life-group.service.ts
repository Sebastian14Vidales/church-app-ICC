import mongoose from "mongoose";
import LifeGroup, { ILifeGroup, ILifeGroupSession, LifeGroupType } from "../models/life-group.model";
import UserProfile from "../models/user-profile.model";
import { AppError } from "./app-error";

const LIFE_GROUP_TYPES: LifeGroupType[] = ["life-group", "couple-group"];

const memberPopulate = [
  "role",
  {
    path: "user",
    populate: { path: "roles" },
  },
];

export const sharedLifeGroupPopulate = [
  { path: "supervisor", populate: memberPopulate },
  { path: "leader", populate: memberPopulate },
  { path: "attendees", populate: memberPopulate },
  { path: "sessions.attendeesPresent", populate: memberPopulate },
];

type ProfileWithRole = {
  role?: { name?: string } | null;
  user?: { roles?: Array<{ name?: string } | null> } | null;
};

const hasLiderRole = (profile: ProfileWithRole | null): boolean => {
  if (!profile) return false;
  if (profile.role?.name === "Lider") return true;
  const userRoles = profile.user?.roles ?? [];
  return userRoles.some((role) => role?.name === "Lider");
};

const isAdminOrSuperadmin = (roles: string[]): boolean =>
  roles.some((role) => role === "Admin" || role === "Superadmin");

const toStringId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("_id" in value) return String((value as { _id: unknown })._id);
    if (
      "toString" in value &&
      typeof (value as { toString: () => string }).toString === "function"
    ) {
      return (value as { toString: () => string }).toString();
    }
  }
  return String(value);
};

const validateLeader = async (leaderId: string, excludeGroupId?: string) => {
  const profile = await UserProfile.findById(leaderId)
    .populate("role")
    .populate({ path: "user", populate: { path: "roles" } });
  if (!profile || !hasLiderRole(profile as unknown as ProfileWithRole)) {
    throw new AppError(400, "El líder seleccionado no tiene el rol Lider");
  }
  const existingFilter: Record<string, unknown> = { leader: leaderId };
  if (excludeGroupId) existingFilter._id = { $ne: excludeGroupId };
  const existingGroup = await LifeGroup.findOne(existingFilter);
  if (existingGroup) {
    throw new AppError(400, "El líder ya dirige otro grupo de vida");
  }
};

const validateAttendeesExist = async (attendeeIds: string[]) => {
  if (attendeeIds.length === 0) return;
  const found = await UserProfile.find({ _id: { $in: attendeeIds } }).select("_id");
  if (found.length !== attendeeIds.length) {
    throw new AppError(400, "Uno o más asistentes no existen");
  }
};

const validateType = (type: string): LifeGroupType => {
  if (!LIFE_GROUP_TYPES.includes(type as LifeGroupType)) {
    throw new AppError(400, "Tipo de grupo inválido");
  }
  return type as LifeGroupType;
};

type CallerContext = {
  profileId?: string | null;
  roles: string[];
};

export const findMine = async (context: CallerContext) => {
  const isAdmin = isAdminOrSuperadmin(context.roles);
  const isSupervisor = context.roles.includes("Supervisor");
  const isLeader = context.roles.includes("Lider");

  let filter: Record<string, unknown> = {};
  if (!isAdmin) {
    if (!context.profileId) {
      return [];
    }
    const orConditions: Record<string, unknown>[] = [];
    if (isSupervisor) orConditions.push({ supervisor: context.profileId });
    if (isLeader) orConditions.push({ leader: context.profileId });
    if (orConditions.length === 0) return [];
    filter = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
  }

  return LifeGroup.find(filter).sort({ name: 1 }).populate(sharedLifeGroupPopulate);
};

export type CreateLifeGroupBody = {
  name: string;
  neighborhood: string;
  address: string;
  leader: string;
  type: LifeGroupType;
  attendees: string[];
  supervisor?: string;
};

export const createLifeGroup = async (body: CreateLifeGroupBody, context: CallerContext) => {
  const { name, neighborhood, address, leader, type, attendees, supervisor } = body;
  const isAdmin = isAdminOrSuperadmin(context.roles);
  const supervisorProfileId = isAdmin ? supervisor ?? context.profileId : context.profileId;

  if (!supervisorProfileId) {
    throw new AppError(400, "No se pudo determinar el supervisor responsable");
  }

  await validateLeader(leader);
  const validatedType = validateType(type);
  const normalizedAttendees = attendees ?? [];
  await validateAttendeesExist(normalizedAttendees);

  const created = await LifeGroup.create({
    name,
    neighborhood,
    address,
    supervisor: supervisorProfileId,
    leader,
    type: validatedType,
    attendees: normalizedAttendees.map((attendeeId) => new mongoose.Types.ObjectId(attendeeId)),
  });

  if (!created) {
    throw new AppError(500, "Error al crear el grupo de vida");
  }

  const populated = await LifeGroup.findById(created._id).populate(sharedLifeGroupPopulate);
  if (!populated) {
    throw new AppError(500, "Error al crear el grupo de vida");
  }
  return populated;
};

export type UpdateLifeGroupBody = Partial<Omit<CreateLifeGroupBody, "supervisor">> & {
  supervisor?: string;
};

export const updateLifeGroup = async (
  id: string,
  body: UpdateLifeGroupBody,
  context: CallerContext,
) => {
  const group = await LifeGroup.findById(id);
  if (!group) {
    throw new AppError(404, "Grupo de vida no encontrado");
  }

  const isAdmin = isAdminOrSuperadmin(context.roles);
  const isSupervisorOfGroup = String(group.supervisor) === context.profileId;
  if (!isAdmin && !isSupervisorOfGroup) {
    throw new AppError(403, "No tienes permisos para esta acción");
  }

  if (body.supervisor !== undefined && isAdmin) {
    group.supervisor = new mongoose.Types.ObjectId(body.supervisor);
  }
  if (body.name !== undefined) group.name = body.name;
  if (body.neighborhood !== undefined) group.neighborhood = body.neighborhood;
  if (body.address !== undefined) group.address = body.address;
  if (body.type !== undefined) {
    group.type = validateType(body.type);
  }
  if (body.leader !== undefined) {
    await validateLeader(body.leader, id);
    group.leader = new mongoose.Types.ObjectId(body.leader);
  }
  if (body.attendees !== undefined) {
    await validateAttendeesExist(body.attendees);
    group.attendees = body.attendees.map(
      (attendeeId) => new mongoose.Types.ObjectId(attendeeId),
    );
  }

  await group.save();
  const populated = await LifeGroup.findById(id).populate(sharedLifeGroupPopulate);
  if (!populated) {
    throw new AppError(500, "Error al actualizar el grupo de vida");
  }
  return populated;
};

export type SessionBody = {
  date: string;
  attendeesPresent: string[];
  offeringAmount: number;
  notes?: string;
};

const canManageSessions = (group: ILifeGroup, context: CallerContext): boolean => {
  if (isAdminOrSuperadmin(context.roles)) return true;
  if (String(group.supervisor) === context.profileId) return true;
  if (context.profileId && String(group.leader) === context.profileId) return true;
  return false;
};

const validateSessionBody = (body: Partial<SessionBody>, groupAttendees: unknown[]) => {
  if (body.date !== undefined) {
    const parsedDate = new Date(body.date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new AppError(400, "La fecha de la sesión es inválida");
    }
  }
  if (body.offeringAmount !== undefined && body.offeringAmount < 0) {
    throw new AppError(400, "La ofrenda no puede ser negativa");
  }
  if (body.attendeesPresent !== undefined) {
    const attendeeIdSet = new Set(groupAttendees.map(toStringId));
    const allPresentAreAttendees = body.attendeesPresent.every((id) => attendeeIdSet.has(id));
    if (!allPresentAreAttendees) {
      throw new AppError(400, "Los asistentes presentes deben pertenecer al grupo");
    }
  }
};

const findGroupOrThrow = async (id: string) => {
  const group = await LifeGroup.findById(id);
  if (!group) {
    throw new AppError(404, "Grupo de vida no encontrado");
  }
  return group;
};

export const addSession = async (id: string, body: SessionBody, context: CallerContext) => {
  const group = await findGroupOrThrow(id);
  if (!canManageSessions(group, context)) {
    throw new AppError(403, "No tienes permisos para esta acción");
  }

  validateSessionBody(body, group.attendees);

  const weekNumber =
    (group.sessions.length
      ? Math.max(...group.sessions.map((session) => session.weekNumber))
      : 0) + 1;

  group.sessions.push({
    date: new Date(body.date),
    weekNumber,
    attendeesPresent: body.attendeesPresent.map(
      (attendeeId) => new mongoose.Types.ObjectId(attendeeId),
    ),
    offeringAmount: body.offeringAmount,
    notes: body.notes,
  } as ILifeGroupSession);

  await group.save();

  const newSession = group.sessions[group.sessions.length - 1];
  const populated = await LifeGroup.findById(id).populate(sharedLifeGroupPopulate);
  if (!populated) {
    throw new AppError(500, "Error al registrar la sesión");
  }
  const populatedSession = populated.sessions.id(newSession._id);
  if (!populatedSession) {
    throw new AppError(500, "Error al registrar la sesión");
  }
  return { session: populatedSession, lifeGroup: populated };
};

export const updateSession = async (
  id: string,
  sessionId: string,
  body: Partial<SessionBody>,
  context: CallerContext,
) => {
  const group = await findGroupOrThrow(id);
  if (!canManageSessions(group, context)) {
    throw new AppError(403, "No tienes permisos para esta acción");
  }

  const session = group.sessions.id(sessionId);
  if (!session) {
    throw new AppError(404, "Sesión no encontrada");
  }

  validateSessionBody(body, group.attendees);

  if (body.date !== undefined) session.date = new Date(body.date);
  if (body.attendeesPresent !== undefined) {
    session.attendeesPresent = body.attendeesPresent.map(
      (attendeeId) => new mongoose.Types.ObjectId(attendeeId),
    );
  }
  if (body.offeringAmount !== undefined) session.offeringAmount = body.offeringAmount;
  if (body.notes !== undefined) session.notes = body.notes;

  await group.save();

  const populated = await LifeGroup.findById(id).populate(sharedLifeGroupPopulate);
  if (!populated) {
    throw new AppError(500, "Error al actualizar la sesión");
  }
  const populatedSession = populated.sessions.id(sessionId);
  if (!populatedSession) {
    throw new AppError(500, "Error al actualizar la sesión");
  }
  return { session: populatedSession, lifeGroup: populated };
};

export const deleteSession = async (
  id: string,
  sessionId: string,
  context: CallerContext,
) => {
  const group = await findGroupOrThrow(id);
  if (!canManageSessions(group, context)) {
    throw new AppError(403, "No tienes permisos para esta acción");
  }

  const session = group.sessions.id(sessionId);
  if (!session) {
    throw new AppError(404, "Sesión no encontrada");
  }

  group.sessions.pull(sessionId);
  await group.save();

  const populated = await LifeGroup.findById(id).populate(sharedLifeGroupPopulate);
  if (!populated) {
    throw new AppError(500, "Error al eliminar la sesión");
  }
  return populated;
};
