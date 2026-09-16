import { PATHS } from "@/utils/constants/routes";

export const getHomePathForRoles = (roles: string[]): string => {
  if (roles.some((role) => role === "Admin" || role === "Superadmin")) {
    return PATHS.dashboard;
  }

  if (roles.includes("Profesor")) {
    return PATHS.myCourses;
  }

  if (roles.includes("Supervisor")) {
    return PATHS.lifeGroups;
  }

  if (roles.includes("Lider")) {
    return PATHS.myLifeGroup;
  }

  if (roles.includes("Pastor")) {
    return PATHS.members;
  }

  if (roles.some((role) => role === "Asistente" || role === "Miembro")) {
    return PATHS.myCoursesStudent;
  }

  return PATHS.profile;
};
