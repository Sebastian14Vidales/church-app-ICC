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
import { AppError } from "../../src/services/app-error";

/**
 * Integration smoke test del router `attendance.routes.ts` (asistencia).
 *
 * Migración (paso 10): se sustituye el mock del controller por un mock de
 * `services/attendance.service`. El controller real se ejecuta, cubriendo
 * la lógica de orquestación (401 cuando no hay profileId en
 * `saveClassAttendance`, mapeo de AppError en `handleControllerError`).
 *
 * Contrato fuente: `docs/api/courses-api.md` §4. Sin `any`, sin `console.log`.
 */

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

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
}));

vi.mock("../../src/services/attendance.service", () => ({
  getMyActiveAssignmentOverview: vi.fn(),
  saveAttendance: vi.fn(),
}));

import attendanceRouter from "../../src/routes/attendance.routes";
import {
  getMyActiveAssignmentOverview,
  saveAttendance,
} from "../../src/services/attendance.service";

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
  profileId: VALID_ID,
};

const PROFESOR_NO_PROFILE: TestAuth = {
  userId: "u-prof2",
  email: "profesor2@icc.test",
  name: "Profesor Test2",
  roles: ["Profesor"],
  // profileId undefined: para proveer el branch 401 en saveClassAttendance
};

const mockGetOverview =
  getMyActiveAssignmentOverview as unknown as ReturnType<typeof vi.fn>;
const mockSaveAttendance = saveAttendance as unknown as ReturnType<typeof vi.fn>;

const app = mountUnderCoursesPrefix(attendanceRouter);

const resetMocks = () => {
  mockGetOverview.mockReset();
  mockSaveAttendance.mockReset();
};

describe("attendance.routes — getOverview", () => {
  beforeEach(resetMocks);

  it("GET /my-attendance sin auth → 401", async () => {
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(noAuthHeader());
    expect(res.status).toBe(401);
    expect(mockGetOverview).not.toHaveBeenCalled();
  });

  it("GET /my-attendance con rol no-Profesor → 403", async () => {
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(403);
    expect(mockGetOverview).not.toHaveBeenCalled();
  });

  it("GET /my-attendance con Profesor (profileId presente) → 200 { assignment, sessions }", async () => {
    mockGetOverview.mockResolvedValueOnce({
      assignment: { _id: VALID_ID, status: "active" },
      sessions: [
        { _id: null, classNumber: 1, attendance: [] },
      ],
    });
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("assignment");
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(mockGetOverview).toHaveBeenCalledWith(VALID_ID);
  });

  it("GET /my-attendance con Profesor sin profileId → 200 { assignment: null, sessions: [] }", async () => {
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(authHeader(PROFESOR_NO_PROFILE));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ assignment: null, sessions: [] });
    expect(mockGetOverview).not.toHaveBeenCalled();
  });

  it("GET /my-attendance cuando el service lanza → 500 'Error al obtener la asistencia...'", async () => {
    mockGetOverview.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get("/api/courses/my-attendance")
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener la asistencia del curso activo");
  });
});

describe("attendance.routes — saveClassAttendance", () => {
  beforeEach(resetMocks);

  const validAttendanceBody = {
      attendance: [{ studentId: "65a1f0c0c1d2a3b4f5e6f7a9", present: true }],
  };

  it("PUT /my-attendance/classes/:classNumber (Profesor) → 200 { message, session }", async () => {
    const session = { _id: VALID_ID, classNumber: 1 };
    mockSaveAttendance.mockResolvedValueOnce(session);
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Asistencia guardada correctamente");
    expect(res.body.session).toEqual(session);
    expect(mockSaveAttendance).toHaveBeenCalledWith(VALID_ID, "1", validAttendanceBody);
  });

  it("PUT /my-attendance/classes/:classNumber sin auth → 401", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(noAuthHeader())
      .send(validAttendanceBody);
    expect(res.status).toBe(401);
    expect(mockSaveAttendance).not.toHaveBeenCalled();
  });

  it("PUT con rol no-Profesor → 403", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(MEMBER_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(403);
    expect(mockSaveAttendance).not.toHaveBeenCalled();
  });

  it("PUT con Profesor sin profileId → 401 'No autorizado'", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_NO_PROFILE))
      .send(validAttendanceBody);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("No autorizado");
    expect(mockSaveAttendance).not.toHaveBeenCalled();
  });

  it("PUT con classNumber inválido (0) → 400 (validador min:1)", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/0")
      .set(authHeader(PROFESOR_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(mockSaveAttendance).not.toHaveBeenCalled();
  });

  it("PUT con attendance no array → 400 (validador isArray)", async () => {
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send({ attendance: "no-array" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("PUT cuando service lanza 404 'No tienes un curso activo asignado'", async () => {
    mockSaveAttendance.mockRejectedValueOnce(
      new AppError(404, "No tienes un curso activo asignado"),
    );
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("No tienes un curso activo asignado");
  });

  it("PUT cuando service lanza 400 'No puedes repetir estudiantes...' → 400", async () => {
    mockSaveAttendance.mockRejectedValueOnce(
      new AppError(400, "No puedes repetir estudiantes en la asistencia"),
    );
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No puedes repetir estudiantes en la asistencia");
  });

  it("PUT cuando service lanza 400 'Debes registrar la asistencia...'", async () => {
    mockSaveAttendance.mockRejectedValueOnce(
      new AppError(
        400,
        "Debes registrar la asistencia de todos los miembros inscritos en la clase",
      ),
    );
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Debes registrar la asistencia de todos los miembros inscritos en la clase",
    );
  });

  it("PUT cuando service lanza error genérico → 500 'Error al guardar la asistencia'", async () => {
    mockSaveAttendance.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .put("/api/courses/my-attendance/classes/1")
      .set(authHeader(PROFESOR_AUTH))
      .send(validAttendanceBody);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al guardar la asistencia");
  });
});