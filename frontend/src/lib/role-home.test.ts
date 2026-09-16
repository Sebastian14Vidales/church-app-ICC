import { describe, it, expect } from "vitest";
import { getHomePathForRoles } from "./role-home";
import PATHS from "@/utils/constants/routes";

/**
 * Unit tests para getHomePathForRoles (ADR-0020 — Dashboard role-based access).
 *
 * Tabla completa de casos:
 * - Roles únicos: Admin, Superadmin → dashboard; Profesor → myCourses;
 *   Supervisor → lifeGroups; Lider → myLifeGroup; Pastor → members;
 *   Asistente/Miembro → myCoursesStudent; desconocido/fallback → profile.
 * - Multi-rol: el rol de mayor privilegio gana según la prioridad
 *   Admin/Superadmin > Profesor > Supervisor > Lider > Pastor > Asistente/Miembro.
 *
 * Tests para el paso 9 del flujo canónico.
 * Sin console.log, sin any. Cada test es determinista e independiente.
 */

describe("getHomePathForRoles", () => {
  // ---- Single-role cases ----------------------------------------------------

  it('["Admin"] returns dashboard', () => {
    expect(getHomePathForRoles(["Admin"])).toBe(PATHS.dashboard);
  });

  it('["Superadmin"] returns dashboard', () => {
    expect(getHomePathForRoles(["Superadmin"])).toBe(PATHS.dashboard);
  });

  it('["Profesor"] returns myCourses', () => {
    expect(getHomePathForRoles(["Profesor"])).toBe(PATHS.myCourses);
  });

  it('["Supervisor"] returns lifeGroups', () => {
    expect(getHomePathForRoles(["Supervisor"])).toBe(PATHS.lifeGroups);
  });

  it('["Lider"] returns myLifeGroup', () => {
    expect(getHomePathForRoles(["Lider"])).toBe(PATHS.myLifeGroup);
  });

  it('["Pastor"] returns members', () => {
    expect(getHomePathForRoles(["Pastor"])).toBe(PATHS.members);
  });

  it('["Asistente"] returns myCoursesStudent', () => {
    expect(getHomePathForRoles(["Asistente"])).toBe(PATHS.myCoursesStudent);
  });

  it('["Miembro"] returns myCoursesStudent', () => {
    expect(getHomePathForRoles(["Miembro"])).toBe(PATHS.myCoursesStudent);
  });

  // ---- Multi-role cases -----------------------------------------------------

  it('["Profesor", "Admin"] returns dashboard — Admin wins over Profesor', () => {
    expect(getHomePathForRoles(["Profesor", "Admin"])).toBe(PATHS.dashboard);
  });

  it('["Admin", "Profesor"] returns dashboard — Admin wins (order independent)', () => {
    expect(getHomePathForRoles(["Admin", "Profesor"])).toBe(PATHS.dashboard);
  });

  it('["Lider", "Supervisor"] returns lifeGroups — Supervisor wins over Lider', () => {
    expect(getHomePathForRoles(["Lider", "Supervisor"])).toBe(PATHS.lifeGroups);
  });

  it('["Supervisor", "Lider"] returns lifeGroups — Supervisor wins (order independent)', () => {
    expect(getHomePathForRoles(["Supervisor", "Lider"])).toBe(PATHS.lifeGroups);
  });

  it('["Profesor", "Supervisor"] returns myCourses — Profesor wins over Supervisor', () => {
    expect(getHomePathForRoles(["Profesor", "Supervisor"])).toBe(PATHS.myCourses);
  });

  it('["Superadmin", "Lider"] returns dashboard — Superadmin wins over Lider', () => {
    expect(getHomePathForRoles(["Superadmin", "Lider"])).toBe(PATHS.dashboard);
  });

  it('["Supervisor", "Admin"] returns dashboard — Admin wins over Supervisor', () => {
    expect(getHomePathForRoles(["Supervisor", "Admin"])).toBe(PATHS.dashboard);
  });

  // ---- Edge / fallback cases ------------------------------------------------

  it("[] (empty roles) returns profile — fallback", () => {
    expect(getHomePathForRoles([])).toBe(PATHS.profile);
  });

  it('["Otro"] (unknown role) returns profile — fallback', () => {
    expect(getHomePathForRoles(["Otro"])).toBe(PATHS.profile);
  });

  it('["Otro", "Admin"] returns dashboard — Admin wins over unknown', () => {
    expect(getHomePathForRoles(["Otro", "Admin"])).toBe(PATHS.dashboard);
  });

  it('["Otro", "Pastor"] returns members — Pastor wins over unknown', () => {
    expect(getHomePathForRoles(["Otro", "Pastor"])).toBe(PATHS.members);
  });

  it('["Asistente", "Profesor"] returns myCourses — Profesor wins over Asistente', () => {
    expect(getHomePathForRoles(["Asistente", "Profesor"])).toBe(PATHS.myCourses);
  });

  it('["Miembro", "Lider"] returns myLifeGroup — Lider wins over Miembro', () => {
    expect(getHomePathForRoles(["Miembro", "Lider"])).toBe(PATHS.myLifeGroup);
  });
});
