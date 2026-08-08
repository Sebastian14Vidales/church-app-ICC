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
 * Smoke test del router `course.routes.ts` (catÃ¡logo de `Course`).
 *
 * Contrato fuente de verdad: `docs/api/courses-api.md` Â§1.
 *
 * Alcance (paso 9 del flujo canÃ³nico, primera iteraciÃ³n):
 *   -Montar el router bajo `/api/courses` sin tocar Mongo ni JWT (mocks).
 *   - Verificar el happy path de `GET /` (shape `PaginatedResponse<Course>`).
 *   - Verificar validaciÃ³n de path (`GET /:id` invÃ¡lido â†’ 400).
 *   - Verificar autorizaciÃ³n: `POST /` sin auth â†’ 401 / no-admin â†’ 403.
 *   - Verificar la validaciÃ³n E-4: `DELETE /:id` con asignaciÃ³n activa
 *     mockeada â†’ 409, sin asignaciÃ³n activa â†’ soft-delete 200.
 *
 * TODO (paso 10, cobertura 80%):
 *   - Caso `GET /:id` vÃ¡lido existente â†’ 200 + shape `Course`.
 *   - Caso `PUT /:id` happy path.
 *   - Caso `POST /` happy path 201 (requiere mockear `new Course()`).
 *   - Drift a reportar: el contracto Â§1.3 dice
 *     "No tienes permisos para realizar esta acciÃ³n"; el cÃ³digo del
 *     middleware usa "No tienes permisos para esta acciÃ³n" (ver
 *     `auth.middleware.ts`). No se asserta el string exacto aquÃ­ para
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
      return res.status(401).json({ message: "La sesiÃ³n es invÃ¡lida o expirÃ³" });
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
        return res.status(403).json({ message: "No tienes permisos para esta acciÃ³n" });
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
  // y exponer mÃ©todos estÃ¡ticos usados por el controller. Vitest requiere
  // que el impl sea `function`/`class` para soportar `new` (los arrow
  // son rechazados: "is not a constructor").
  type CourseMock = ((this: { save: ReturnType<typeof vi.fn> }) => void) & {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    countDocuments: ReturnType<typeof vi.fn>;
    deleteOne: ReturnType<typeof vi.fn>;
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
  Course.deleteOne = vi.fn();
  return { default: Course };
});

vi.mock("../../src/models/course-assigned.model", () => {
  const courseAssignedModel = {
    find: vi.fn(),
    findOne: vi.fn(),
    deleteMany: vi.fn(),
  };
  return { default: courseAssignedModel };
});

vi.mock("../../src/models/class-session.model", () => ({
  __esModule: true,
  default: { deleteMany: vi.fn() },
}));

// Importar DESPUÃ‰S de los vi.mock (vitest los aplica antes de la
// resoluciÃ³n del router, que a su vez importa estos mÃ³dulos).
import courseRouter from "../../src/routes/course.routes";
import Course from "../../src/models/course.model";
import { SPIRITUAL_GROWTH_STAGES } from "../../src/models/user-profile.model";
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

const DEFAULT_SPIRITUAL_GROWTH_STAGE = SPIRITUAL_GROWTH_STAGES[0];

const courseFindOneMock = Course.findOne as unknown as ReturnType<typeof vi.fn>;
const courseFindMock = Course.find as unknown as ReturnType<typeof vi.fn>;
const courseCountMock = Course.countDocuments as unknown as ReturnType<typeof vi.fn>;
const courseFindOneAndUpdateMock = Course.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const courseDeleteOneMock = Course.deleteOne as unknown as ReturnType<typeof vi.fn>;

const CourseAssignedModule =
  await import("../../src/models/course-assigned.model");
const assignedFindOneMock = (CourseAssignedModule.default as unknown as {
  findOne: ReturnType<typeof vi.fn>;
}).findOne;
const assignedFindMock = (CourseAssignedModule.default as unknown as {
  find: ReturnType<typeof vi.fn>;
}).find;
const assignedDeleteManyMock = (CourseAssignedModule.default as unknown as {
  deleteMany: ReturnType<typeof vi.fn>;
}).deleteMany;

const ClassSessionModule = await import("../../src/models/class-session.model");
const classSessionDeleteManyMock = (ClassSessionModule.default as unknown as {
  deleteMany: ReturnType<typeof vi.fn>;
}).deleteMany;

const app = mountUnderCoursesPrefix(courseRouter);

const resetMocks = () => {
  courseFindOneMock.mockReset();
  courseFindMock.mockReset();
  courseCountMock.mockReset();
  courseFindOneAndUpdateMock.mockReset();
  courseDeleteOneMock.mockReset();
  assignedFindOneMock?.mockReset();
  assignedFindMock?.mockReset();
  assignedDeleteManyMock?.mockReset();
  classSessionDeleteManyMock?.mockReset();
};

describe("course.routes.ts â€” smoke", () => {
  beforeEach(resetMocks);

  it("GET /api/courses â€” 200 con shape PaginatedResponse<Course>", async () => {
    courseCountMock.mockResolvedValue(1);
    courseFindMock.mockReturnValueOnce(chainable([
      { _id: VALID_ID, name: "Fundamentos", description: "d", level: "basic", spiritualGrowthStage: "ConsolidaciÃ³n", isActive: true },
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
    expect(res.body.items[0]).toHaveProperty("spiritualGrowthStage", "ConsolidaciÃ³n");
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it("GET /api/courses/:id con id invÃ¡lido â†’ 400 (validador isMongoId)", async () => {
    const res = await request(app)
      .get(`/api/courses/${INVALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(400);
    // El contrato Â§1.2 especifica el mensaje "ID de curso invÃ¡lido".
    // express-validator entrega `errors[]`; no calmamos el mensaje
    // exacto de ese array para no acoplar el test a la estructura interna
    // del validador (drift menor).
    expect(res.body).toHaveProperty("errors");
  });

  it("GET /api/courses/:id con id Mongo vÃ¡lido + curso inexistente â†’ 404", async () => {
    courseFindOneMock.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("POST /api/courses sin auth â†’ 401", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(noAuthHeader())
      .send({ name: "x", description: "y", level: "basic" });

    expect(res.status).toBe(401);
  });

  it("POST /api/courses con auth no-admin â†’ 403", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(MEMBER_AUTH))
      .send({ name: "x", description: "y", level: "basic" });

    expect(res.status).toBe(403);
  });

  it("POST /api/courses con admin pero body invÃ¡lido â†’ 400 (validador)", async () => {
    // Falta `name` y `description`; `level` fuera del enum.
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ level: "expert" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("POST /api/courses sin spiritualGrowthStage â†’ 400 (validador)", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Fundamentos", description: "desc", level: "basic" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(Course).not.toHaveBeenCalled();
  });

  it("POST /api/courses con spiritualGrowthStage invÃ¡lida â†’ 400 (validador)", async () => {
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Fundamentos", description: "desc", level: "basic", spiritualGrowthStage: "Invalida" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(Course).not.toHaveBeenCalled();
  });

  it("DELETE /api/courses/:id — borrado físico 200 MessageResponse", async () => {
    courseFindOneMock.mockResolvedValue({ _id: VALID_ID, deletedAt: null });
    // Simula que hay una asignación → .find().select("_id").lean() devuelve los _ids
    const mockFindChain = () => ({
      select: () => mockFindChain(),
      lean: () =>
        new Promise<Array<{ _id: string }>>((resolve) => {
          process.nextTick(() => resolve([{ _id: "assignment-1" }]));
        }),
    });
    assignedFindMock.mockImplementation(mockFindChain as (typeof assignedFindMock));
    classSessionDeleteManyMock.mockResolvedValue({ deletedCount: 2 });
    assignedDeleteManyMock.mockResolvedValue({ deletedCount: 1 });
    courseDeleteOneMock.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso eliminado exitosamente");
    // Cascade: ClassSession.deleteMany recibe los IDs de asignaciones
    expect(classSessionDeleteManyMock).toHaveBeenCalledWith({
      courseAssigned: { $in: ["assignment-1"] },
    });
    // Luego CourseAssigned.deleteMany
    expect(assignedDeleteManyMock).toHaveBeenCalledWith({ course: VALID_ID });
    // Finalmente Course.deleteOne
    expect(courseDeleteOneMock).toHaveBeenCalledWith({ _id: VALID_ID });
    expect(emitRealtimeInvalidation).toHaveBeenCalledWith(
      "courses.changed",
      [["courses"]],
    );
    expect(emitRealtimeInvalidation).toHaveBeenCalledWith(
      "courseAssignments.changed",
      [["courseAssignments"], ["myCourses"], ["myAttendance"]],
    );
    expect(emitRealtimeInvalidation).toHaveBeenCalledWith(
      "courseHistory.changed",
      [["courseHistory"]],
    );
  });

  it("DELETE /api/courses/:id — sin asignaciones → omite ClassSession.deleteMany", async () => {
    courseFindOneMock.mockResolvedValue({ _id: VALID_ID, deletedAt: null });
    // Sin asignaciones: .find().select("_id").lean() devuelve array vacío
    const mockFindChain = () => ({
      select: () => mockFindChain(),
      lean: () =>
        new Promise<Array<{ _id: string }>>((resolve) => {
          process.nextTick(() => resolve([]));
        }),
    });
    assignedFindMock.mockImplementation(mockFindChain as (typeof assignedFindMock));
    assignedDeleteManyMock.mockResolvedValue({ deletedCount: 0 });
    courseDeleteOneMock.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso eliminado exitosamente");
    // ClassSession.deleteMany NO debe invocarse cuando no hay asignaciones
    expect(classSessionDeleteManyMock).not.toHaveBeenCalled();
    expect(assignedDeleteManyMock).toHaveBeenCalledWith({ course: VALID_ID });
    expect(courseDeleteOneMock).toHaveBeenCalledWith({ _id: VALID_ID });
  });

  it("DELETE /api/courses/:id con curso ausente → 404", async () => {
    courseFindOneMock.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("DELETE /api/courses/:id sin auth â†’ 401", async () => {
    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(noAuthHeader());

    expect(res.status).toBe(401);
  });

  it("DELETE /api/courses/:id cuando CourseAssigned.deleteMany lanza â†’ 500 'Error al eliminar curso'", async () => {
    courseFindOneMock.mockResolvedValue({ _id: VALID_ID, deletedAt: null });
    assignedDeleteManyMock.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .delete(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al eliminar curso");
  });
});

// ---- Llenado de cobertura del catÃ¡logo (POST/PUT happy + GET filtros) ----

const realtimeMock = emitRealtimeInvalidation as unknown as ReturnType<typeof vi.fn>;

describe("course.routes.ts â€” catÃ¡logo (POST/PUT happy + filtros GET)", () => {
beforeEach(() => {
    resetMocks();
    realtimeMock.mockReset();
    // El constructor `new Course(...)` precisa reset para que cada test
    // pueda configurar su fixture `save` (vitest mock factory instala el
    // inicial; le dejamos el comportamiento default save=resolve(undefined)).
    (Course as unknown as { mockClear: () => void }).mockClear();
  });

  it("POST /api/courses (admin) happy path â†’ 201 'Curso creado exitosamente' + realtime courses.changed", async () => {
    // El factory por defecto de vi.mock retorna `{ save: vi.fn().mockResolvedValue(undefined) }`.
    // El controller hace `new Course({...})` â†’ `await course.save()` â†’ 201.
    const res = await request(app)
      .post("/api/courses")
      .set(authHeader(ADMIN_AUTH))
      .send({
        name: "Fundamentos",
        description: "desc",
        level: "basic",
        spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Curso creado exitosamente");
    expect(realtimeMock).toHaveBeenCalledWith("courses.changed", [["courses"]]);
    // El constructor fue invocado con los campos whitelist.
    expect(Course).toHaveBeenCalledWith({
      name: "Fundamentos",
      description: "desc",
      level: "basic",
      spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      isActive: undefined,
    });
  });

  it("POST /api/courses cuando save lanza â†’ 500 'Error al crear curso'", async () => {
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
      .send({
        name: "Fundamentos",
        description: "desc",
        level: "basic",
        spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al crear curso");
  });

  it("GET /api/courses/:id happy path â†’ 200 con el Course encontrado", async () => {
    const course = {
      _id: VALID_ID,
      name: "Fundamentos",
      description: "desc",
      level: "basic",
      spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      isActive: true,
    };
    courseFindOneMock.mockResolvedValue(course);

    const res = await request(app)
      .get(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(course);
    expect(courseFindOneMock).toHaveBeenCalledWith({ _id: VALID_ID, deletedAt: null });
  });

  it("GET /api/courses con filtros name/level/isActive â†’ 200 aplica regex/level/bool", async () => {
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

  it("GET /api/courses cuando find lanza â†’ 500 'Error al obtener cursos'", async () => {
    courseCountMock.mockResolvedValue(0);
    courseFindMock.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get("/api/courses")
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener cursos");
  });

  it("PUT /api/courses/:id (admin) happy path â†’ 200 con el Course actualizado + realtime", async () => {
    const updated = { _id: VALID_ID, name: "X", description: "Y", level: "basic", spiritualGrowthStage: "Discipulado bÃ¡sico", isActive: false };
    courseFindOneAndUpdateMock.mockResolvedValueOnce(updated);

    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({
        name: "X",
        description: "Y",
        isActive: false,
        level: "basic",
        spiritualGrowthStage: SPIRITUAL_GROWTH_STAGES[1],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(courseFindOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: VALID_ID, deletedAt: null },
      {
        name: "X",
        description: "Y",
        level: "basic",
        spiritualGrowthStage: SPIRITUAL_GROWTH_STAGES[1],
        isActive: false,
      },
      { new: true },
    );
    expect(realtimeMock).toHaveBeenCalledWith("courses.changed", [["courses"]]);
  });

  it("PUT /api/courses/:id con curso no encontrado â†’ 404 'Curso no encontrado'", async () => {
    courseFindOneAndUpdateMock.mockResolvedValueOnce(null);
    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({
        name: "X",
        description: "Y",
        isActive: false,
        level: "basic",
        spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("PUT /api/courses/:id con rol Miembro â†’ 403 (ADMIN_ROLES only)", async () => {
    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(MEMBER_AUTH))
      .send({
        name: "X",
        description: "Y",
        isActive: false,
        level: "basic",
        spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      });
    expect(res.status).toBe(403);
    expect(courseFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("PUT /api/courses/:id cuando findOneAndUpdate lanza â†’ 500 'Error al actualizar curso'", async () => {
    courseFindOneAndUpdateMock.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .put(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({
        name: "X",
        description: "Y",
        isActive: false,
        level: "basic",
        spiritualGrowthStage: DEFAULT_SPIRITUAL_GROWTH_STAGE,
      });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al actualizar curso");
  });

  it("GET /api/courses/:id cuando findOne lanza â†’ 500 'Error al obtener curso'", async () => {
    courseFindOneMock.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get(`/api/courses/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener curso");
  });
});


