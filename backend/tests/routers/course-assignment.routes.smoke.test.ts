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
 * Smoke test del router `course-assignment.routes.ts` (asignaciones,
 * miembros, close, reopen, my-courses). Contrato fuente de verdad:
 * `docs/api/courses-api.md` §2 y §3.
 *
 * Alcance (paso 9, primera iteración):
 *   - Verificar el cableo de rutas + autorización + validación de path
 *     sin tocar Mongoose ni services. Para ello se mockea el controller
 *     completo: cada endpoint devuelve el shape contratado (200 paginado
 *     / `{ message, assignment }` etc.) mediante `res.status().json()`.
 *   - Confirmar que el verbo correcto está expuesto (POST en `/members`
 *     y `/close` y `/reopen`; NO PATCH en `/members` — drift D-11
 *     resuelto).
 *
 * TODO (paso 10, cobertura 80%):
 *   - Migrar este smoke a una capa de `service` mocks (no controller
 *     mocks) para validar la lógica de negocio (409 por profesor ya
 *     activo, reabrir completed-only, verificación de dueño en close).
 *   - Probar `GET /api/courses/assignments/history` con filtros
 *     `professor`/`location` y su orden `endDate desc`.
 *   - Probar `GET /api/courses/my-courses` y `/my-courses/history`
 *     dispatch por rol del `req.auth` (profesor vs miembro).
 *
 * Drift a reportar: el mensaje de `authorizeRoles` difiere del contrato
 * (ver `course.routes.smoke.test.ts`); aquí tampoco se asserta el
 * string exacto del 403.
 */

const { sendOk, sendCreated } = vi.hoisted(() => {
  const sendOk =
    (body: unknown) =>
    (_req: Request, res: Response, _next: NextFunction) => {
      res.status(200).json(body);
    };
  const sendCreated =
    (body: unknown) =>
    (_req: Request, res: Response, _next: NextFunction) => {
      res.status(201).json(body);
    };
  return { sendOk, sendCreated };
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

vi.mock("../../src/controller/course-assignment.controller", () => {
  const findAll = vi.fn(sendOk({ items: [], total: 0, page: 1, limit: 20 }));
  const findHistory = vi.fn(
    sendOk({ items: [], total: 0, page: 1, limit: 20 }),
  );
  const findById = vi.fn(sendOk({ _id: VALID_ID, sessions: [] }));
  const create = vi.fn(
    sendCreated({ message: "Curso asignado correctamente", assignment: {} }),
  );
  const update = vi.fn(
    sendOk({ message: "Asignacion actualizada correctamente", assignment: {} }),
  );
  const remove = vi.fn(sendOk({ message: "Asignacion eliminada correctamente" }));
  const addMembers = vi.fn(
    sendOk({
      message: "Miembros registrados correctamente en el curso",
      assignment: {},
    }),
  );
  const close = vi.fn(sendOk({ message: "Curso cerrado correctamente" }));
  const reopen = vi.fn(
    sendOk({ message: "Curso reabierto correctamente", assignment: {} }),
  );
  const findMyAssignments = vi.fn(sendOk([]));
  const findMyHistory = vi.fn(sendOk([]));
  return {
    CourseAssignmentController: {
      findAll,
      findHistory,
      findById,
      create,
      update,
      remove,
      addMembers,
      close,
      reopen,
      findMyAssignments,
      findMyHistory,
    },
  };
});

import courseAssignmentRouter from "../../src/routes/course-assignment.routes";
import { CourseAssignmentController } from "../../src/controller/course-assignment.controller";

const SUPERADMIN_AUTH: TestAuth = {
  userId: "u-super",
  email: "super@icc.test",
  name: "Super Admin",
  roles: ["Superadmin"],
};

const MEMBER_AUTH: TestAuth = {
  userId: "u-member",
  email: "member@icc.test",
  name: "Member Test",
  roles: ["Miembro"],
};

const app = mountUnderCoursesPrefix(courseAssignmentRouter);

const mocked = CourseAssignmentController as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const resetMocks = () => {
  Object.values(mocked).forEach((fn) => fn?.mockClear());
};

describe("course-assignment.routes.ts — smoke", () => {
  beforeEach(resetMocks);

  it("GET /api/courses/assignments → 200 paginated", async () => {
    const res = await request(app)
      .get("/api/courses/assignments")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
      }),
    );
    expect(mocked.findAll).toHaveBeenCalledOnce();
  });

  it("GET /api/courses/assignments/history → 200 paginated (status=completed)", async () => {
    const res = await request(app)
      .get("/api/courses/assignments/history")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(mocked.findHistory).toHaveBeenCalledOnce();
  });

  it("GET /api/courses/assignments/:id con id inválido → 400", async () => {
    const res = await request(app)
      .get("/api/courses/assignments/not-a-mongoid")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(mocked.findById).not.toHaveBeenCalled();
  });

  it("POST /api/courses/assignments/:id/reopen sin auth → 401", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(noAuthHeader());

    expect(res.status).toBe(401);
    expect(mocked.reopen).not.toHaveBeenCalled();
  });

  it("POST /api/courses/assignments/:id/reopen con rol no-Superadmin → 403", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(403);
    expect(mocked.reopen).not.toHaveBeenCalled();
  });

  it("POST /api/courses/assignments/:id/reopen con Superadmin → 200 { message, assignment }", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso reabierto correctamente");
    expect(res.body).toHaveProperty("assignment");
    expect(mocked.reopen).toHaveBeenCalledOnce();
  });

  it("POST /api/courses/assignments/:id/close → 200 (verbo POST, no PATCH)", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(authHeader(SUPERADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso cerrado correctamente");
    expect(mocked.close).toHaveBeenCalledOnce();
  });

  it("POST /api/courses/assignments/:id/members → 200 (verbo POST; drift D-11 resuelto)", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({ memberIds: ["65a1f0c0c1d2a3b4f5e6f7a9"] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "Miembros registrados correctamente en el curso",
    );
    expect(mocked.addMembers).toHaveBeenCalledOnce();
  });

  it("PATCH /api/courses/assignments/:id/members → 404 (PATCH rechazado; sólo POST)", async () => {
    const res = await request(app)
      .patch(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({ memberIds: ["65a1f0c0c1d2a3b4f5e6f7a9"] });

    // No hay handler PATCH declarado → Express 5 cae al 404 por defecto.
    expect(res.status).toBe(404);
    expect(mocked.addMembers).not.toHaveBeenCalled();
  });

  it("POST /api/courses/assignments — admin → 201 { message, assignment }", async () => {
    const adminAuth: TestAuth = { ...MEMBER_AUTH, roles: ["Admin"] };
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(adminAuth))
      .send({
        course: VALID_ID,
        professor: "65a1f0c0c1d2a3b4f5e6f7a9",
        startDate: "2026-02-01",
        startTime: "18:00",
        totalClasses: 8,
        location: "Sede Central",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Curso asignado correctamente");
    expect(res.body).toHaveProperty("assignment");
    expect(mocked.create).toHaveBeenCalledOnce();
  });

  it("GET /api/courses/my-courses → 200 array plano", async () => {
    const res = await request(app)
      .get("/api/courses/my-courses")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mocked.findMyAssignments).toHaveBeenCalledOnce();
  });

  it("GET /api/courses/my-courses/history → 200 array plano", async () => {
    const res = await request(app)
      .get("/api/courses/my-courses/history")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mocked.findMyHistory).toHaveBeenCalledOnce();
  });
});