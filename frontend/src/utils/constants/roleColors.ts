import { type MemberRoleName } from "@/types/index";

export const roleColors: Record<MemberRoleName, string> = {
  Admin: "bg-red-100 text-red-800",
  Superadmin: "bg-fuchsia-100 text-fuchsia-800",
  Pastor: "bg-orange-100 text-orange-800",
  Profesor: "bg-green-100 text-green-800",
  Supervisor: "bg-purple-100 text-purple-800",
  Miembro: "bg-blue-100 text-blue-800",
  Asistente: "bg-gray-100 text-gray-800",
};

export const roleLabels: Record<MemberRoleName, string> = {
  Admin: "Administrador",
  Superadmin: "Superadministrador",
  Pastor: "Pastor",
  Profesor: "Profesor",
  Supervisor: "Supervisor",
  Miembro: "Miembro",
  Asistente: "Asistente",
};
