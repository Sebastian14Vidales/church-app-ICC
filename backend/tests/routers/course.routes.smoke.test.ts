import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

import {
  authHeader,
  noAuthHeader,
  chainable,
  mountUnderCoursesPrefix,
  VALID_ID,
  INVALID_ID,
  type TestAuth,
} from "../_setup/test-helpers";

/**
 * Smoke test del router `course.routes.ts` (catálogo de `Course`).
 *
 * Contrato fuente de verdad: `docs/api/courses-api.md` §1.
 *
 * Alcance (paso 9 del flujo canónico, primera iteración):
 *   -Montar el router bajo `/api/courses` sin tocar Mongo ni JWT (mocks).
 *   - Verificar el happy path de `GET /` (shape `PaginatedResponse<Course>`).
 *   - Verificar validación de path (`GET /:id` inválido → 400).
 *   - Verificar autorización: `POST /` sin auth → 401 / no-admin → 403.
 *   - Verificar la validación E-4: `DELETE /:id` con asignación activa
 *     mockeada → 409, sin asignación activa → soft-delete 200.
 *
 * TODO (paso 10, cobertura 80%):
 *   - Caso `GET /:id` válido existente → 200 + shape `Course`.
 *   - Caso `PUT /:id` happy path.
 *   - Caso `POST /` happy path 201 (requiere mockear `new Course()`).
 *   - Drift a reportar: el contracto §1.3 dice
 *     "No tienes permisos para realizar esta acción"; el código del
 *     middleware usa "No tienes permisos para esta acción" (ver
 *     `auth.middleware.ts`). No se asserta el string exacto aquí para
 *     no acoplarse al drift; se reporta para que el `quality-engineer`
 *     lo resuelva.
 */

vi.mock("../../src/middleware/auth.middleware", () => {
  const authenticate = (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
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
    (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
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

vi.mock("../../src/models/course.model", () => {
  const courseModel = {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  };
  return { default: courseModel };
});

vi.mock("../../src/models/course-assigned.model", () => {
  const courseAssignedModel = {
    findOne: vi.fn(),
  };
  return { default: courseAssignedModel };
});

// Importar DESPUÉS de los vi.mock (vitest los aplica antes de la
// resolución del router, que a su vez importa estos módulos).
import courseRouter from "../../src/routes/course.routes";
import Course from "../../src/models/course.model";

const ADMIN_AUTH: TestAuth = {
  userId: "u-admin",
  email: "admin@icc.test",
  name: "Admin Test",
  roles: ["Admin"],
};

const MEMBER_AUTH: TestAuth = {
  userId: "u-member",
  email: "member@icc.test",
  name: "Member Test",
  roles: ["Miembro"],
};

const courseFindOneMock = Course.findOne as unknown as ReturnType<typeof vi.fn>;
const courseFindMock = Course.find as unknown as ReturnType<typeof vi.fn>;
const courseCountMock = Course.countDocuments as unknown as ReturnType<typeof vi.fn>;
const courseFindOneAndUpdateMock = Course.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;

const CourseAssignedModule =
  await import("../../src/models/course-assigned.model");
const assignedFindOneMock = (CourseAssignedModule.default as unknown as {
  findOne: ReturnType<typeof vi.fn>;
}).findOne;

const app = mountUnderCoursesPrefix(courseRouter);

const resetMocks = () => {
  courseFindOneMock.mockReset();
  courseFindMock.mockReset();
  courseCountMock.mockReset();
  courseFindOneAndUpdateMock.mockReset();
  assignedFindOneMock?.mockReset();
};

describe("course.routes.ts — smoke", () => {
  beforeEach(resetMocks);

  it("GET /api/courses — 200 con shape PaginatedResponse<Course>", async () => {
    courseCountMock.mockResolvedValue(1);
    courseFindMock.mockReturnValueOnce(chainable([{ _id: VALID_ID, name: "Fundamentos", description: "d", level: "basic", isActive: true }]));

    const res = await request(app)
      .get("/api/courses")
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
      }),
    );
    expect(res.body.items.length).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it("GET /api/courses/:id con id inválido → 400 (validador isMongoId)", async () => {
    const res = await request(app)
      .get(`/api/courses/${INVALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(400);
    // El contrato §1.2 especifica el mensaje "ID de curso inválido".
    // express-validator entrega `errors[]`; no calmamos el mensaje
    // exacto de ese array para no acoplar el test a la estructura interna
    // del validador (drift menor).
    expect(res.body).toHaveProperty("errors");
  });

  it("GET /api/courses/:id con id Mongo válido + curso inexistente → 404", async () => {
    courseFindOneMock.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("POST /api/courses sin auth → 401", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(noAuthHeader())
      .send({ name: "x", description: "y", level: "basic" });

    expect(res.status).toBe(401);
  });

  it("POST /api/courses con auth no-admin → 403", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(MEMBER_AUTH))
      .send({ name: "x", description: "y", level: "basic" });

    expect(res.status).toBe(403);
  });

  it("POST /api/courses con admin pero body inválido → 400 (validador)", async () => {
    // Falta `name` y `description`; `level` fuera del enum.
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ level: "expert" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("DELETE /api/courses/:id con asignación activa → 409 (validación E-4)", async () => {
    assignedFindOneMock?.mockResolvedValue({ _id: VALID_ID });

    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "No puedes eliminar un curso con asignaciones activas",
    );
  });

  it("DELETE /api/courses/:id sin asignación activa → soft-delete 200 MessageResponse", async () => {
    assignedFindOneMock?.mockResolvedValue(null);
    courseFindOneAndUpdateMock.mockResolvedValue({
      _id: VALID_ID,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso eliminado exitosamente");
  });

  it("DELETE /api/courses/:id con curso ya soft-deleted → 404", async () => {
    assignedFindOneMock?.mockResolvedValue(null);
    courseFindOneAndUpdateMock.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("DELETE /api/courses/:id sin auth → 401", async () => {
    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(noAuthHeader());

    expect(res.status).toBe(401);
  });
});