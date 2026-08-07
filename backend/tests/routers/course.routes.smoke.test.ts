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
  // `Course` debe ser invocable como constructor (`new Course({...})`)
  // y exponer métodos estáticos usados por el controller. Vitest requiere
  // que el impl sea `function`/`class` para soportar `new` (los arrow
  // son rechazados: "is not a constructor").
  type CourseMock = ((this: { save: ReturnType<typeof vi.fn> }) => void) & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
    mockClear: () => void;
    mockImplementationOnce: (
      impl: (this: { save: ReturnType<typeof vi.fn> }) => void,
    ) => void;
  };
  const Course = vi.fn(function CourseInstanceMock(
    this: { save: ReturnType<typeof vi.fn> },
  ) {
    this.save = vi.fn().mockResolvedValue(undefined);
  }) as unknown as CourseMock;
  Course.findOne = vi.fn();
  Course.find = vi.fn();
  Course.findOneAndUpdate = vi.fn();
  Course.countDocuments = vi.fn();
  return { default: Course };
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
import { emitRealtimeInvalidation } from "../../src/realtime/socket";

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
    courseFindMock.mockReturnValueOnce(chainable([
      { _id: VALID_ID, name: "Fundamentos", description: "d", level: "basic", spiritualGrowthStage: "Consolidación", isActive: true },
    ]));

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
    expect(res.body.items[0]).toHaveProperty("spiritualGrowthStage", "Consolidación");
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

  it("POST /api/courses sin spiritualGrowthStage → 400 (validador)", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Fundamentos", description: "desc", level: "basic" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(Course).not.toHaveBeenCalled();
  });

  it("POST /api/courses con spiritualGrowthStage inválida → 400 (validador)", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Fundamentos", description: "desc", level: "basic", spiritualGrowthStage: "Invalida" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(Course).not.toHaveBeenCalled();
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

  it("DELETE /api/courses/:id cuando CourseAssigned.findOne lanza → 500 'Error al eliminar curso'", async () => {
    assignedFindOneMock?.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al eliminar curso");
  });
});

// ---- Llenado de cobertura del catálogo (POST/PUT happy + GET filtros) ----

const realtimeMock = emitRealtimeInvalidation as unknown as ReturnType<typeof vi.fn>;

describe("course.routes.ts — catálogo (POST/PUT happy + filtros GET)", () => {
beforeEach(() => {
    resetMocks();
    realtimeMock.mockReset();
    // El constructor `new Course(...)` precisa reset para que cada test
    // pueda configurar su fixture `save` (vitest mock factory instala el
    // inicial; le dejamos el comportamiento default save=resolve(undefined)).
    (Course as unknown as { mockClear: () => void }).mockClear();
  });

  it("POST /api/courses (admin) happy path → 201 'Curso creado exitosamente' + realtime courses.changed", async () => {
    // El factory por defecto de vi.mock retorna `{ save: vi.fn().mockResolvedValue(undefined) }`.
    // El controller hace `new Course({...})` → `await course.save()` → 201.
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Fundamentos", description: "desc", level: "basic", spiritualGrowthStage: "Consolidación" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Curso creado exitosamente");
    expect(realtimeMock).toHaveBeenCalledWith("courses.changed", [["courses"]]);
    // El constructor fue invocado con los campos whitelist.
    expect(Course).toHaveBeenCalledWith({
      name: "Fundamentos",
      description: "desc",
      level: "basic",
      spiritualGrowthStage: "Consolidación",
      isActive: undefined,
    });
  });

  it("POST /api/courses cuando save lanza → 500 'Error al crear curso'", async () => {
    (Course as unknown as {
      mockImplementationOnce: (
        impl: (this: { save: ReturnType<typeof vi.fn> }) => void,
      ) => void;
    }).mockImplementationOnce(
      function CourseThrowingMock(this: { save: ReturnType<typeof vi.fn> }) {
        this.save = vi.fn().mockRejectedValue(new Error("boom"));
      },
    );

    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Fundamentos", description: "desc", level: "basic", spiritualGrowthStage: "Consolidación" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al crear curso");
  });

  it("GET /api/courses/:id happy path → 200 con el Course encontrado", async () => {
    const course = { _id: VALID_ID, name: "Fundamentos", description: "desc", level: "basic", spiritualGrowthStage: "Consolidación", isActive: true };
    courseFindOneMock.mockResolvedValue(course);

    const res = await request(app)
      .get(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(course);
    expect(courseFindOneMock).toHaveBeenCalledWith({ _id: VALID_ID, deletedAt: null });
  });

  it("GET /api/courses con filtros name/level/isActive → 200 aplica regex/level/bool", async () => {
    courseCountMock.mockResolvedValue(0);
    courseFindMock.mockReturnValueOnce(chainable([]));
    const res = await request(app)
      .get("/api/courses?name=fund&level=basic&isActive=true")
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(courseCountMock).toHaveBeenCalledWith({
      deletedAt: null,
      name: { $regex: "fund", $options: "i" },
      level: "basic",
      isActive: true,
    });
  });

  it("GET /api/courses con isActive=false branch opuesto al filter bool", async () => {
    courseCountMock.mockResolvedValue(0);
    courseFindMock.mockReturnValueOnce(chainable([]));
    await request(app)
      .get("/api/courses?isActive=false")
      .set(authHeader(ADMIN_AUTH));
    expect(courseCountMock).toHaveBeenCalledWith({ deletedAt: null, isActive: false });
  });

  it("GET /api/courses cuando find lanza → 500 'Error al obtener cursos'", async () => {
    courseCountMock.mockResolvedValue(0);
    courseFindMock.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get("/api/courses")
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener cursos");
  });

  it("PUT /api/courses/:id (admin) happy path → 200 con el Course actualizado + realtime", async () => {
    const updated = { _id: VALID_ID, name: "X", description: "Y", level: "basic", spiritualGrowthStage: "Discipulado básico", isActive: false };
    courseFindOneAndUpdateMock.mockResolvedValueOnce(updated);

    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "X", description: "Y", isActive: false, level: "basic", spiritualGrowthStage: "Discipulado básico" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(courseFindOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: VALID_ID, deletedAt: null },
      { name: "X", description: "Y", level: "basic", spiritualGrowthStage: "Discipulado básico", isActive: false },
      { new: true },
    );
    expect(realtimeMock).toHaveBeenCalledWith("courses.changed", [["courses"]]);
  });

  it("PUT /api/courses/:id con curso no encontrado → 404 'Curso no encontrado'", async () => {
    courseFindOneAndUpdateMock.mockResolvedValueOnce(null);
    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "X", description: "Y", isActive: false, level: "basic", spiritualGrowthStage: "Consolidación" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("PUT /api/courses/:id con rol Miembro → 403 (ADMIN_ROLES only)", async () => {
    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(MEMBER_AUTH))
      .send({ name: "X", description: "Y", isActive: false, level: "basic", spiritualGrowthStage: "Consolidación" });
    expect(res.status).toBe(403);
    expect(courseFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("PUT /api/courses/:id cuando findOneAndUpdate lanza → 500 'Error al actualizar curso'", async () => {
    courseFindOneAndUpdateMock.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "X", description: "Y", isActive: false, level: "basic", spiritualGrowthStage: "Consolidación" });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al actualizar curso");
  });

  it("GET /api/courses/:id cuando findOne lanza → 500 'Error al obtener curso'", async () => {
    courseFindOneMock.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener curso");
  });
});