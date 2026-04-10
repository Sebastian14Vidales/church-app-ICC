import Role from "../models/role.model";
import User from "../models/user.model";
import UserProfile from "../models/user-profile.model";
import CourseAssigned from "../models/course-assigned.model";
import Sermon from "../models/sermon.model";
import bycrpt from "bcrypt";

const CURRENT_ROLES = [
  "Asistente",
  "Miembro",
  "Profesor",
  "Pastor",
  "Supervisor",
  "Admin",
  "Superadmin",
] as const;

const LEGACY_ROLE_REPAIR_ORDER = [
  { legacyName: "Estudiante", replacementName: "Asistente" },
  { legacyName: "Miembro", replacementName: "Miembro" },
  { legacyName: "Profesor", replacementName: "Profesor" },
  { legacyName: "Pastor", replacementName: "Pastor" },
] as const;

const repairOrphanedRoleReferences = async () => {
  const roles = await Role.find({ name: { $in: CURRENT_ROLES } });
  const currentRoleMap = new Map(roles.map((role) => [role.name, role]));
  const currentRoleIds = new Set(roles.map((role) => String(role._id)));

  const [profileRoleRefs, userRoleRefs] = await Promise.all([
    UserProfile.distinct("role"),
    User.distinct("roles"),
  ]);

  const missingRoleRefs = Array.from(
    new Set(
      [...profileRoleRefs, ...userRoleRefs]
        .map((roleId) => String(roleId))
        .filter((roleId) => roleId && !currentRoleIds.has(roleId)),
    ),
  ).sort();

  if (!missingRoleRefs.length) {
    return;
  }

  const refsToRepair = missingRoleRefs.slice(0, LEGACY_ROLE_REPAIR_ORDER.length);
  const unresolvedRefs = missingRoleRefs.slice(LEGACY_ROLE_REPAIR_ORDER.length);

  for (const [index, missingRoleRef] of refsToRepair.entries()) {
    const repairTarget = LEGACY_ROLE_REPAIR_ORDER[index];
    const replacementRole = currentRoleMap.get(repairTarget.replacementName);

    if (!replacementRole) {
      console.warn(
        `No se pudo reparar el rol legado ${repairTarget.legacyName} porque no existe ${repairTarget.replacementName}.`,
      );
      continue;
    }

    const affectedUserIds = await User.find({ roles: missingRoleRef }).distinct("_id");

    await UserProfile.updateMany(
      { role: missingRoleRef },
      { $set: { role: replacementRole._id } },
    );
    await User.updateMany({ _id: { $in: affectedUserIds } }, { $pull: { roles: missingRoleRef } });
    await User.updateMany(
      { _id: { $in: affectedUserIds } },
      { $addToSet: { roles: replacementRole._id } },
    );
  }

  if (unresolvedRefs.length) {
    console.warn(
      `Quedaron referencias de roles sin reparar: ${unresolvedRefs.join(", ")}`,
    );
  }
};

const syncAccessRolesFromLinkedRecords = async () => {
  const [professorRole, pastorRole] = await Promise.all([
    Role.findOne({ name: "Profesor" }),
    Role.findOne({ name: "Pastor" }),
  ]);

  if (!professorRole || !pastorRole) {
    return;
  }

  const [professorProfileIds, pastorUserIds] = await Promise.all([
    CourseAssigned.distinct("professor"),
    Sermon.distinct("pastor"),
  ]);

  if (professorProfileIds.length) {
    const professorProfiles = await UserProfile.find({
      _id: { $in: professorProfileIds },
    }).select("_id user");

    const professorUserIds = professorProfiles
      .map((profile) => profile.user)
      .filter(Boolean);

    await UserProfile.updateMany(
      { _id: { $in: professorProfileIds } },
      { $set: { role: professorRole._id } },
    );

    if (professorUserIds.length) {
      await User.updateMany(
        { _id: { $in: professorUserIds } },
        { $set: { roles: [professorRole._id] } },
      );
    }
  }

  if (pastorUserIds.length) {
    await User.updateMany(
      { _id: { $in: pastorUserIds } },
      { $set: { roles: [pastorRole._id] } },
    );
    await UserProfile.updateMany(
      { user: { $in: pastorUserIds } },
      { $set: { role: pastorRole._id } },
    );
  }
};

export const seedDatabase = async () => {
  const allowedRoles = [...CURRENT_ROLES];

  for (const roleName of allowedRoles) {
    await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName },
      { upsert: true, new: true },
    );
  }

  await repairOrphanedRoleReferences();
  await syncAccessRolesFromLinkedRecords();

  const assistantRole = await Role.findOne({ name: "Asistente" });
  const obsoleteRoles = await Role.find({ name: { $nin: allowedRoles } });
  const obsoleteRoleIds = obsoleteRoles.map((role) => role._id);

  if (assistantRole && obsoleteRoleIds.length) {
    await UserProfile.updateMany(
      { role: { $in: obsoleteRoleIds } },
      { $set: { role: assistantRole._id } },
    );

    await User.updateMany(
      { roles: { $in: obsoleteRoleIds } },
      {
        $pull: { roles: { $in: obsoleteRoleIds } },
        $addToSet: { roles: assistantRole._id },
      },
    );

    await Role.deleteMany({ _id: { $in: obsoleteRoleIds } });
  }

  const superadminRole = await Role.findOne({ name: "Superadmin" });

  await User.findOneAndUpdate(
    { email: "vidales14sebastian@gmail.com" },
    {
      $set: {
        name: "Superadmin",
        active: true,
        confirmed: true,
        roles: superadminRole ? [superadminRole._id] : [],
      },
      $setOnInsert: {
        email: "vidales14sebastian@gmail.com",
        password: await bycrpt.hash("Superadmin1234", 10),
      },
    },
    { upsert: true, new: true },
  );
};
