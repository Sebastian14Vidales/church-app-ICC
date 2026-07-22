import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

import {
  authHeader,
  noAuthHeader,
  mountUnderCoursesPrefix,
  VALID_ID,
  type TestAuth,
} from "../_setup/test-helpers";

/**
 * Smoke test del router `attendance.routes.ts` (asistencia).
 * Contrato fuente de verdad: `docs/api/courses-api.md` §4.
 *
 * Alcance (paso 9, primera iteración):
 *   - Verificar el cableo de rutas y autorización (rol `Profesor`).
 *   - `GET /api/courses/my-attendance` sin auth → 401 / no-Profesor → 403 /
 *     Profesor → 200 con shape `{ assignment, sessions }`.
 *   - `PUT /api/courses/my-attendance/classes/:classNumber` smoke: el
 *     verbo PUT (no POST/PATCH) está expuesto; el contrato §4.2 ratifica
 *     PUT como patrón idempotente correcto (sin drift aquí).
 *
 * TODO (paso 10, cobertura 80%):
 *   - Mockear `attendance.service` (no el controller) y cubrir 404/400
 *     de `saveAttendance` ("No tienes un curso activo asignado",
 *     "El número de clase no es válido").
 *   - Validar el overview generado (sessions 1..totalClasses con
 *     `_id: null` para no guardadas).
 */

const { sendOk } = vi.hoisted(() => {
  const sendOk =
    (body: unknown) =>
    (_req: Request, res: Response, _next: NextFunction) => {
      res.status(200).json(body);
    };
  return { sendOk };
});

vi.mock("../../src/middleware/auth.middleware", () => {
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-auth"];
    if (typeof raw !== "string" || raw.trim() === "") {
      return res.status(401).json({ message: "No autorizado" });
    }
    try {
      (req as unknown as { auth?: TestAuth }).auth = JSON.parse(raw) as TestAuth;
      return next();
    } catch {
      return res.status(401).json({ message: "La sesión es inválida o expiró" });
    }
  };
  const authorizeRoles =
    (allowedRoles: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const auth = (req as unknown as { auth?: TestAuth }).auth;
      if (!auth) {
        return res.status(401).json({ message: "No autorizado" });
      }
      const has = auth.roles.some((role) => allowedRoles.includes(role));
      if (!has) {
        return res.status(403).json({ message: "No tienes permisos para esta acción" });
      }
      return next();
    };
  return { authenticate, authorizeRoles };
});

vi.mock("../../src/controller/attendance.controller", () => {
  const getOverview = vi.fn(
    sendOk({ assignment: null, sessions: [] }),
  );
  const saveClassAttendance = vi.fn(
    sendOk({ message: "Asistencia guardada correctamente", session: {} }),
  );
  return {
    AttendanceController: { getOverview, saveClassAttendance },
  };
});

import attendanceRouter from "../../src/routes/attendance.routes";
import { AttendanceController } from "../../src/controller/attendance.controller";

const PROFESOR_AUTH: TestAuth = {
  userId: "u-prof",
  email: "profesor@icc.test",
  name: "Profesor Test",
  roles: ["Profesor"],
  profileId: VALID_ID,
};

const MEMBER_AUTH: TestAuth = {
  userId: "u-member",
  email: "member@icc.test",
  name: "Member Test",
  roles: ["Miembro"],
};

const app = mountUnderCoursesPrefix(attendanceRouter);

const mocked = AttendanceController as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const resetMocks = () => {
  Object.values(mocked).forEach((fn) => fn?.mockClear());
};

describe("attendance.routes.ts — smoke", () => {
  beforeEach(resetMocks);

  it("GET /api/courses/my-attendance sin auth → 401", async () => {
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(noAuthHeader());

    expect(res.status).toBe(401);
    expect(mocked.getOverview).not.toHaveBeenCalled();
  });

  it("GET /api/courses/my-attendance con rol no-Profesor → 403", async () => {
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(403);
    expect(mocked.getOverview).not.toHaveBeenCalled();
  });

  it("GET /api/courses/my-attendance con Profesor → 200 { assignment, sessions }", async () => {
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(authHeader(PROFESOR_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("assignment");
    expect(res.body).toHaveProperty("sessions");
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(mocked.getOverview).toHaveBeenCalledOnce();
  });

  it("PUT /api/courses/my-attendance/classes/:classNumber con body válido → 200 (verbo PUT smoke)", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send({
        attendance: [{ studentId: "65a1f0c0c1d2a3b4f5e6f7a9", present: true }],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Asistencia guardada correctamente");
    expect(res.body).toHaveProperty("session");
    expect(mocked.saveClassAttendance).toHaveBeenCalledOnce();
  });

  it("PUT /api/courses/my-attendance/classes/:classNumber con classNumber inválido → 400", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/0")
      .set(authHeader(PROFESOR_AUTH))
      .send({ attendance: [] });

    // min: 1 → 0 viola el validador.
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(mocked.saveClassAttendance).not.toHaveBeenCalled();
  });
});