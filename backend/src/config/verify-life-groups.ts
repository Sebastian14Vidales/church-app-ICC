import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import colors from "colors";
import LifeGroup from "../models/life-group.model";
import UserProfile from "../models/user-profile.model";
import type { IRole } from "../models/role.model";
import type { IUser } from "../models/user.model";

dotenv.config();

const SUPERVISOR_ROLE = "Supervisor";
const LEADER_ROLE = "Lider";

interface PopulatedUser extends Omit<IUser, "roles"> {
  roles: IRole[];
}

interface PopulatedProfile {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  role: IRole;
  user?: PopulatedUser;
}

interface RawLifeGroup {
  _id: Types.ObjectId;
  name: string;
  neighborhood: string;
  supervisor?: Types.ObjectId;
  leader?: Types.ObjectId;
}

interface GroupReportEntry {
  name: string;
  neighborhood: string;
  supervisorName: string;
  leaderName: string;
  hasSupervisorRole: boolean;
  hasLeaderRole: boolean;
  isOrphan: boolean;
  missing?: string;
}

const fullName = (profile?: PopulatedProfile): string =>
  profile ? `${profile.firstName} ${profile.lastName}`.trim() : "(desconocido)";

const hasRole = (profile: PopulatedProfile, roleName: string): boolean => {
  const primaryRoleName = profile.role?.name;
  const userRoles = profile.user?.roles ?? [];
  const userRoleNames = userRoles.map((role) => role.name);
  return primaryRoleName === roleName || userRoleNames.includes(roleName);
};

const run = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(colors.red.bold("DATABASE_URL no está definida"));
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log(colors.green.bold("Conectado a MongoDB"));

  const rawGroups = await LifeGroup.find().lean<RawLifeGroup[]>();
  const profileIds = rawGroups
    .flatMap((group) => [group.supervisor, group.leader].filter(Boolean))
    .map((id) => (id as Types.ObjectId).toString());

  const uniqueProfileIds = [...new Set(profileIds)].map(
    (id) => new Types.ObjectId(id),
  );

  const rawProfiles = (await UserProfile.find({
    _id: { $in: uniqueProfileIds },
  })
    .populate<{ role: IRole }>("role")
    .populate<{ user: PopulatedUser }>({
      path: "user",
      populate: { path: "roles" },
    })
    .lean()) as PopulatedProfile[];

  const profileMap = new Map<string, PopulatedProfile>(
    rawProfiles.map((profile) => [
      profile._id.toString(),
      profile,
    ]),
  );

  const entries: GroupReportEntry[] = rawGroups.map((group) => {
    const supervisor = group.supervisor
      ? profileMap.get(group.supervisor.toString())
      : undefined;
    const leader = group.leader
      ? profileMap.get(group.leader.toString())
      : undefined;

    const supervisorName = fullName(supervisor);
    const leaderName = fullName(leader);
    const isOrphan = !supervisor || !leader;
    const missing: string | undefined =
      !supervisor && !leader
        ? "supervisor y líder"
        : !supervisor
          ? "supervisor"
          : !leader
            ? "líder"
            : undefined;

    return {
      name: group.name,
      neighborhood: group.neighborhood,
      supervisorName,
      leaderName,
      hasSupervisorRole: supervisor
        ? hasRole(supervisor, SUPERVISOR_ROLE)
        : false,
      hasLeaderRole: leader ? hasRole(leader, LEADER_ROLE) : false,
      isOrphan,
      missing,
    };
  });

  const coverageMap = new Map<string, number>();
  entries.forEach((entry) => {
    if (entry.isOrphan) return;
    const current = coverageMap.get(entry.supervisorName) ?? 0;
    coverageMap.set(entry.supervisorName, current + 1);
  });

  const suspiciousAssignments = entries.filter(
    (entry) => !entry.isOrphan && !entry.hasSupervisorRole,
  );
  const leadersWithoutRole = entries.filter(
    (entry) => !entry.isOrphan && !entry.hasLeaderRole,
  );
  const orphanGroups = entries.filter((entry) => entry.isOrphan);

  console.log(colors.cyan("\n--- Resumen de grupos de vida ---"));
  console.log(`Total de grupos activos: ${rawGroups.length}`);

  console.log(colors.cyan("\n--- Cobertura por supervisor ---"));
  if (coverageMap.size === 0) {
    console.log("No hay grupos con supervisor asignado.");
  } else {
    [...coverageMap.entries()]
      .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
      .forEach(([name, count]) => {
        console.log(`  ${name}: ${count} grupo(s)`);
      });
  }

  console.log(colors.cyan("\n--- Asignaciones sospechosas ---"));
  if (suspiciousAssignments.length === 0) {
    console.log(
      colors.green("No se encontraron supervisores sin rol Supervisor."),
    );
  } else {
    console.log(
      colors.yellow(
        `⚠ Grupos cuyo supervisor no tiene rol Supervisor (${suspiciousAssignments.length}):`,
      ),
    );
    suspiciousAssignments.forEach((entry) => {
      console.log(
        `  - ${entry.name} | ${entry.supervisorName} | ${entry.neighborhood}`,
      );
    });
  }

  console.log(colors.cyan("\n--- Líderes sin rol ---"));
  if (leadersWithoutRole.length === 0) {
    console.log(colors.green("No se encontraron líderes sin rol Lider."));
  } else {
    console.log(
      colors.yellow(
        `⚠ Grupos cuyo líder no tiene rol Lider (${leadersWithoutRole.length}):`,
      ),
    );
    leadersWithoutRole.forEach((entry) => {
      console.log(
        `  - ${entry.name} | ${entry.leaderName} | ${entry.neighborhood}`,
      );
    });
  }

  console.log(colors.cyan("\n--- Datos huérfanos ---"));
  if (orphanGroups.length === 0) {
    console.log(colors.green("No se encontraron grupos sin supervisor o líder."));
  } else {
    console.log(
      colors.yellow(
        `⚠ Grupos sin supervisor o líder (${orphanGroups.length}):`,
      ),
    );
    orphanGroups.forEach((entry) => {
      console.log(
        `  - ${entry.name} | falta: ${entry.missing} | ${entry.neighborhood}`,
      );
    });
  }

  await mongoose.disconnect();
  console.log(colors.green.bold("\nDesconectado de MongoDB"));

  const findings =
    suspiciousAssignments.length +
    leadersWithoutRole.length +
    orphanGroups.length;

  if (findings === 0) {
    console.log(colors.green.bold("\nOK: sin hallazgos"));
    process.exit(0);
  } else {
    console.log(
      colors.yellow.bold(
        `\nHallazgos: ${findings} (${suspiciousAssignments.length} supervisor(es), ${leadersWithoutRole.length} líder(es), ${orphanGroups.length} huérfano(s))`,
      ),
    );
    process.exit(2);
  }
};

run().catch((error) => {
  console.error(colors.red.bold(error));
  process.exit(1);
});
