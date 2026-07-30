import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

import {
  authHeader,
  noAuthHeader,
  mountUnderCoursesPrefix,
  VALID_ID,
  OTHER_VALID_ID,
  INVALID_ID,
  type TestAuth,
} from "../_setup/test-helpers";
import { AppError } from "../../src/services/app-error";

/**
 * Integration smoke test del router `course-assignment.routes.ts`.
 *
 * Migración (paso 10 del ADR-0001): se reemplazan los mocks de controller
 * por mocks de `services/course-assignment.service` + `models/*`. Los
 * controllers reales se ejecutan, cubriendo la lógica de orquestación
 * (`parsePagination`, mapeo de errores vía `handleControllerError`,
 * consolidación de sesiones en `findById`, dispatch por rol en
 * `findMyAssignments`/`findMyHistory`).
 *
 * Contrato fuente: `docs/api/courses-api.md` §2 y §3.
 *
 * Sin `any`; sin `console.log`; determinismo vía mocks.
 */

// ---- mocks a nivel módulo --------------------------------------------------

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

vi.mock("../../src/services/course-assignment.service", () => {
  const chain = (resolved: unknown) => {
    const self = {
      sort: vi.fn(() => self),
      skip: vi.fn(() => self),
      limit: vi.fn(() => self),
      populate: vi.fn(() => self),
      lean: vi.fn(() => self),
      exec: vi.fn(() => Promise.resolve(resolved)),
      then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
        Promise.resolve(resolved).then(onfulfilled),
    };
    return self;
  };
  return {
    addMembers: vi.fn(),
    buildAssignmentQuery: vi.fn(() => chain([{ _id: VALID_ID }])),
    buildMyProfessorAssignmentQuery: vi.fn(() => chain([{ _id: VALID_ID }])),
    buildMyStudentAssignmentQuery: vi.fn(() => chain([{ _id: VALID_ID }])),
    closeAssignment: vi.fn(),
    createAssignment: vi.fn(),
    reopenAssignment: vi.fn(),
    softDeleteAssignment: vi.fn(),
    updateAssignment: vi.fn(),
    attendancePopulate: { path: "attendance.student" },
    memberPopulate: { path: "members" },
    professorPopulate: { path: "professor" },
  };
});

vi.mock("../../src/models/course-assigned.model", () => {
  const model = {
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  };
  return { default: model };
});

vi.mock("../../src/models/class-session.model", () => {
  const model = {
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
    findOneAndUpdate: vi.fn(),
    populate: vi.fn((docs) => Promise.resolve(docs)),
  };
  return { default: model };
});

// ---- imports DESPUÉS de vi.mock --------------------------------------------

import courseAssignmentRouter from "../../src/routes/course-assignment.routes";
import {
  addMembers as addMembersService,
  buildAssignmentQuery,
  buildMyProfessorAssignmentQuery,
  buildMyStudentAssignmentQuery,
  closeAssignment as closeAssignmentService,
  createAssignment as createAssignmentService,
  reopenAssignment as reopenAssignmentService,
  softDeleteAssignment as softDeleteAssignmentService,
  updateAssignment as updateAssignmentService,
} from "../../src/services/course-assignment.service";
import CourseAssigned from "../../src/models/course-assigned.model";
import ClassSession from "../../src/models/class-session.model";

// ---- helpers de cadena locales --------------------------------------------

const chain = (resolved: unknown) => {
  const self = {
    sort: vi.fn(() => self),
    skip: vi.fn(() => self),
    limit: vi.fn(() => self),
    populate: vi.fn(() => self),
    lean: vi.fn(() => self),
    exec: vi.fn(() => Promise.resolve(resolved)),
    then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
      Promise.resolve(resolved).then(onfulfilled),
  };
  return self;
};

// ---- acceso tipado a los mocks --------------------------------------------

const assignedCountDocuments =
  CourseAssigned.countDocuments as unknown as ReturnType<typeof vi.fn>;
const assignedFindOne = CourseAssigned.findOne as unknown as ReturnType<typeof vi.fn>;
const classSessionFind = ClassSession.find as unknown as ReturnType<typeof vi.fn>;

const mockCreateAssignment = createAssignmentService as unknown as ReturnType<typeof vi.fn>;
const mockUpdateAssignment = updateAssignmentService as unknown as ReturnType<typeof vi.fn>;
const mockSoftDeleteAssignment =
  softDeleteAssignmentService as unknown as ReturnType<typeof vi.fn>;
const mockAddMembers = addMembersService as unknown as ReturnType<typeof vi.fn>;
const mockCloseAssignment = closeAssignmentService as unknown as ReturnType<typeof vi.fn>;
const mockReopenAssignment = reopenAssignmentService as unknown as ReturnType<typeof vi.fn>;
const mockBuildAssignmentQuery =
  buildAssignmentQuery as unknown as ReturnType<typeof vi.fn>;
const mockBuildMyProfessorQuery =
  buildMyProfessorAssignmentQuery as unknown as ReturnType<typeof vi.fn>;
const mockBuildMyStudentQuery =
  buildMyStudentAssignmentQuery as unknown as ReturnType<typeof vi.fn>;

// ---- fixtures de sesiones consolidada --------------------------------------

const SUPERADMIN_AUTH: TestAuth = {
  userId: "u-super",
  email: "super@icc.test",
  name: "Super Admin",
  roles: ["Superadmin"],
  profileId: OTHER_VALID_ID,
};

const ADMIN_AUTH: TestAuth = {
  userId: "u-admin",
  email: "admin@icc.test",
  name: "Admin Test",
  roles: ["Admin"],
  profileId: OTHER_VALID_ID,
};

const PROFESOR_AUTH: TestAuth = {
  userId: "u-prof",
  email: "prof@icc.test",
  name: "Profesor Test",
  roles: ["Profesor"],
  profileId: VALID_ID,
};

const MEMBER_AUTH: TestAuth = {
  userId: "u-member",
  email: "member@icc.test",
  name: "Member Test",
  roles: ["Miembro"],
  profileId: OTHER_VALID_ID,
};

const buildAssignmentFixture = (
  overrides: Record<string, unknown> = {},
) => ({
  _id: VALID_ID,
  course: { _id: OTHER_VALID_ID, name: "Fundamentos" },
  professor: { _id: VALID_ID, firstName: "Prof" },
  members: [] as unknown[],
  startDate: new Date("2026-02-01"),
  startTime: "18:00",
  totalClasses: 2,
  endDate: new Date("2026-02-08"),
  endedAt: null,
  location: "Sede Central",
  status: "active",
  deletedAt: null,
  toObject() {
    return {
      _id: this._id,
      course: this.course,
      professor: this.professor,
      members: this.members,
      startDate: this.startDate,
      startTime: this.startTime,
      totalClasses: this.totalClasses,
      endDate: this.endDate,
      endedAt: this.endedAt,
      location: this.location,
      status: this.status,
      deletedAt: this.deletedAt,
    };
  },
  ...overrides,
});

const buildStoredSession = (classNumber: number) => ({
  _id: `65a1f0c0c1d2a3b4f5e6f7d${classNumber}`,
  classNumber,
  date: new Date(`2026-02-0${classNumber}`),
  topic: `Tema ${classNumber}`,
  observations: "ok",
  updatedAt: new Date(`2026-02-0${classNumber}T22:30:00.000Z`),
  attendance: [
    {
      student: {
        _id: OTHER_VALID_ID,
        firstName: "Estudiante",
        lastName: "Test",
        documentID: "123456",
        birthdate: new Date("1990-01-01"),
        neighborhood: "Barrio",
        phoneNumber: "3001234567",
        bloodType: "O+",
        role: { _id: OTHER_VALID_ID, name: "Miembro" },
        user: null,
      },
      present: true,
      notes: "",
    },
  ],
});

const app = mountUnderCoursesPrefix(courseAssignmentRouter);

const resetMocks = () => {
  vi.clearAllMocks();
  assignedCountDocuments.mockReset();
  assignedFindOne.mockReset();
  classSessionFind.mockReset();
  mockCreateAssignment.mockReset();
  mockUpdateAssignment.mockReset();
  mockSoftDeleteAssignment.mockReset();
  mockAddMembers.mockReset();
  mockCloseAssignment.mockReset();
  mockReopenAssignment.mockReset();
  mockBuildAssignmentQuery.mockReset();
  mockBuildMyProfessorQuery.mockReset();
  mockBuildMyStudentQuery.mockReset();
  mockBuildAssignmentQuery.mockReturnValue(chain([{ _id: VALID_ID }]));
};

describe("course-assignment.routes — findAll / findHistory", () => {
  beforeEach(resetMocks);

  it("GET /api/courses/assignments → 200 paginated (status active por defecto)", async () => {
    assignedCountDocuments.mockResolvedValue(1);
    mockBuildAssignmentQuery.mockReturnValueOnce(chain([{ _id: VALID_ID }]));

    const res = await request(app)
      .get("/api/courses/assignments")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
    expect(assignedCountDocuments).toHaveBeenCalledWith({
      status: "active",
      deletedAt: null,
    });
    expect(mockBuildAssignmentQuery).toHaveBeenCalledWith({
      status: "active",
      deletedAt: null,
    });
  });

  it("GET /api/courses/assignments?status=completed → 200 con sort endDate desc", async () => {
    assignedCountDocuments.mockResolvedValue(0);
    const c = chain([]);
    mockBuildAssignmentQuery.mockReturnValueOnce(c);

    const res = await request(app)
      .get("/api/courses/assignments?status=completed&page=2&limit=5")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(c.sort).toHaveBeenCalledWith({ endDate: -1 });
    expect(c.skip).toHaveBeenCalledWith(5); // (page-1)*limit = 5
    expect(c.limit).toHaveBeenCalledWith(5);
  });

  it("GET /api/courses/assignments?status=invalido → 400 (validador enum)", async () => {
    const res = await request(app)
      .get("/api/courses/assignments?status=invalido")
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("GET /api/courses/assignments/history → 200 con filtros professor/location", async () => {
    assignedCountDocuments.mockResolvedValue(2);
    const c = chain([{ _id: VALID_ID }, { _id: OTHER_VALID_ID }]);
    mockBuildAssignmentQuery.mockReturnValueOnce(c);

    const res = await request(app)
      .get(
        `/api/courses/assignments/history?professor=${OTHER_VALID_ID}&location=Sede`,
      )
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(c.sort).toHaveBeenCalledWith({ endDate: -1 });
    expect(assignedCountDocuments).toHaveBeenCalledWith({
      status: "completed",
      deletedAt: null,
      professor: OTHER_VALID_ID,
      location: { $regex: "Sede", $options: "i" },
    });
  });

  it("GET /api/courses/assignments/history?professor=invalido → 400 (isMongoId)", async () => {
    const res = await request(app)
      .get("/api/courses/assignments/history?professor=no-mongoid")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("GET /api/courses/assignments/history sin filtros → 200 con filtro base (rama falsy de professor/location)", async () => {
    assignedCountDocuments.mockResolvedValue(0);
    mockBuildAssignmentQuery.mockReturnValueOnce(chain([]));
    const res = await request(app)
      .get("/api/courses/assignments/history")
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(200);
    expect(assignedCountDocuments).toHaveBeenCalledWith({
      status: "completed",
      deletedAt: null,
    });
  });

  it("GET /api/courses/assignments retorna 500 cuando countDocuments falla", async () => {
    assignedCountDocuments.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .get("/api/courses/assignments")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener asignaciones");
  });

  it("GET /api/courses/assignments/history retorna 500 cuando countDocuments falla", async () => {
    assignedCountDocuments.mockRejectedValue(new Error("boom"));
    const res = await request(app)
      .get("/api/courses/assignments/history")
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener el historial de asignaciones");
  });
});

describe("course-assignment.routes — findById (sesiones consolidadas)", () => {
  beforeEach(resetMocks);

  it("GET /:id con id Mongo válido + curso existente → 200 con sessions 1..totalClasses (stored + no stored branches)", async () => {
    // totalClasses=3, sólo sesiones 1 y 2 almacenadas → clase 3 cae en la
    // rama generada (storedSession undefined). Cubre los `??` del
    // consolidador (topic/observations/attendance/completedAt/date).
    const assignment = buildAssignmentFixture({ totalClasses: 3 });
    assignedFindOne.mockReturnValueOnce(chain(assignment));
    const sessions = [buildStoredSession(1), buildStoredSession(2)];
    classSessionFind.mockReturnValueOnce(chain(sessions));

    const res = await request(app)
      .get(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(VALID_ID);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions).toHaveLength(3);
    expect(res.body.sessions[0].classNumber).toBe(1);
    expect(res.body.sessions[0].topic).toBe("Tema 1");
    expect(res.body.sessions[0].attendance).toHaveLength(1);
    expect(res.body.sessions[1].classNumber).toBe(2);
    expect(res.body.sessions[2].classNumber).toBe(3);
    // Sesion no guardada:
    expect(res.body.sessions[2].topic).toBe("");
    expect(res.body.sessions[2].observations).toBe("");
    expect(res.body.sessions[2].completedAt).toBeNull();
    expect(res.body.sessions[2].attendance).toEqual([]);
  });

  it("GET /:id con asignacion inexistente → 404 'Asignacion no encontrada'", async () => {
    assignedFindOne.mockReturnValueOnce(chain(null));
    const res = await request(app)
      .get(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Asignacion no encontrada");
  });

  it("GET /:id con id inválido → 400 (validador isMongoId)", async () => {
    const res = await request(app)
      .get(`/api/courses/assignments/${INVALID_ID}`)
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("GET /:id cuando CourseAssigned.findOne lanza → 500 'Error al obtener la asignación'", async () => {
    assignedFindOne.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener la asignación");
  });
});

describe("course-assignment.routes — create", () => {
  beforeEach(resetMocks);

  const validBody = {
    course: OTHER_VALID_ID,
    professor: VALID_ID,
    startDate: "2026-02-01",
    startTime: "18:00",
    totalClasses: 8,
    location: "Sede Central",
  };

  it("POST /api/courses/assignments (admin) → 201 { message, assignment }", async () => {
    const assignment = buildAssignmentFixture();
    mockCreateAssignment.mockResolvedValueOnce(assignment);

    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(ADMIN_AUTH))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Curso asignado correctamente");
    expect(res.body.assignment).toEqual(
      expect.objectContaining({
        _id: VALID_ID,
        status: "active",
        totalClasses: 2,
        location: "Sede Central",
      }),
    );
  });

  it("POST /api/courses/assignments con rol Miembro → 403", async () => {
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(MEMBER_AUTH))
      .send(validBody);
    expect(res.status).toBe(403);
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it("POST sin auth → 401", async () => {
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(noAuthHeader())
      .send(validBody);
    expect(res.status).toBe(401);
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it("POST con body incompleto → 400 (validadores)", async () => {
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(ADMIN_AUTH))
      .send({ course: OTHER_VALID_ID });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it("POST con status:'cancelled' → 400 (validador enum; AC D-05)", async () => {
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(ADMIN_AUTH))
      .send({ ...validBody, status: "cancelled" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });

  it("POST cuando service lanza AppError 404 'Curso no encontrado' → 404", async () => {
    mockCreateAssignment.mockRejectedValueOnce(
      new AppError(404, "Curso no encontrado"),
    );
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(ADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Curso no encontrado");
  });

  it("POST cuando service lanza 409 profesor único activo → 409 con duplicateKeyMessage", async () => {
    // El service lanza AppError(409) directamente (no es duplicate-key raw);
    // el controller mapea AppError tal cual (rama AppError).
    mockCreateAssignment.mockRejectedValueOnce(
      new AppError(409, "Este profesor ya tiene un curso activo asignado"),
    );
    const res = await request(app)
      .post("/api/courses/assignments")
      .set(authHeader(ADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Este profesor ya tiene un curso activo asignado");
  });
});

describe("course-assignment.routes — update", () => {
  beforeEach(resetMocks);

  const validBody = {
    course: OTHER_VALID_ID,
    professor: VALID_ID,
    startDate: "2026-02-01",
    startTime: "18:00",
    totalClasses: 8,
    location: "Sede Central",
  };

  it("PUT /api/courses/assignments/:id (Superadmin) → 200 { message, assignment }", async () => {
    const assignment = buildAssignmentFixture({ status: "completed" });
    mockUpdateAssignment.mockResolvedValueOnce(assignment);
    const res = await request(app)
      .put(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Asignacion actualizada correctamente");
    expect(mockUpdateAssignment).toHaveBeenCalledWith(VALID_ID, validBody);
  });

  it("PUT con Admin (no Superadmin) → 403", async () => {
    const res = await request(app)
      .put(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(403);
    expect(mockUpdateAssignment).not.toHaveBeenCalled();
  });

  it("PUT cuando service lanza 404 → 404 'Asignacion no encontrada'", async () => {
    mockUpdateAssignment.mockRejectedValueOnce(
      new AppError(404, "Asignacion no encontrada"),
    );
    const res = await request(app)
      .put(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Asignacion no encontrada");
  });

  it("PUT con id inválido → 400 (validador)", async () => {
    const res = await request(app)
      .put(`/api/courses/assignments/${INVALID_ID}`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(400);
    expect(mockUpdateAssignment).not.toHaveBeenCalled();
  });
});

describe("course-assignment.routes — remove (DELETE)", () => {
  beforeEach(resetMocks);

  it("DELETE /api/courses/assignments/:id (Superadmin) → 200 'Asignacion eliminada correctamente'", async () => {
    mockSoftDeleteAssignment.mockResolvedValueOnce(buildAssignmentFixture());
    const res = await request(app)
      .delete(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(SUPERADMIN_AUTH));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Asignacion eliminada correctamente");
  });

  it("DELETE con Admin → 403 (sólo Superadmin)", async () => {
    const res = await request(app)
      .delete(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(403);
    expect(mockSoftDeleteAssignment).not.toHaveBeenCalled();
  });

  it("DELETE cuando service lanza 404 → 404", async () => {
    mockSoftDeleteAssignment.mockRejectedValueOnce(
      new AppError(404, "Asignacion no encontrada"),
    );
    const res = await request(app)
      .delete(`/api/courses/assignments/${VALID_ID}`)
      .set(authHeader(SUPERADMIN_AUTH));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Asignacion no encontrada");
  });

  it("DELETE con id inválido → 400", async () => {
    const res = await request(app)
      .delete(`/api/courses/assignments/${INVALID_ID}`)
      .set(authHeader(SUPERADMIN_AUTH));
    expect(res.status).toBe(400);
  });
});

describe("course-assignment.routes — addMembers (POST /:id/members)", () => {
  beforeEach(resetMocks);

  it("POST /members → 200 'Miembros registrados correctamente en el curso'", async () => {
    mockAddMembers.mockResolvedValueOnce(buildAssignmentFixture());
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(PROFESOR_AUTH))
      .send({ memberIds: [OTHER_VALID_ID] });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Miembros registrados correctamente en el curso");
    expect(mockAddMembers).toHaveBeenCalledWith(VALID_ID, [OTHER_VALID_ID], {
      callerProfileId: PROFESOR_AUTH.profileId,
      callerRoles: PROFESOR_AUTH.roles,
    });
  });

  it("PATCH /members → 404 (verbo rechazado; D-11 resuelto)", async () => {
    const res = await request(app)
      .patch(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({ memberIds: [OTHER_VALID_ID] });
    expect(res.status).toBe(404);
    expect(mockAddMembers).not.toHaveBeenCalled();
  });

  it("POST /members con rol Miembro → 403 (no en [Profesor, Admin, Superadmin])", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(MEMBER_AUTH))
      .send({ memberIds: [OTHER_VALID_ID] });
    expect(res.status).toBe(403);
    expect(mockAddMembers).not.toHaveBeenCalled();
  });

  it("POST /members con body.memberIds faltante → 400", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(PROFESOR_AUTH))
      .send({});
    expect(res.status).toBe(400);
    expect(mockAddMembers).not.toHaveBeenCalled();
  });

  it("POST /members cuando service lanza 403 (no dueño) → 403", async () => {
    mockAddMembers.mockRejectedValueOnce(
      new AppError(403, "No tienes permisos para actualizar esta asignacion"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(PROFESOR_AUTH))
      .send({ memberIds: [OTHER_VALID_ID] });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tienes permisos para actualizar esta asignacion");
  });

  it("POST /members cuando service lanza 400 'Solo puedes registrar...' → 400", async () => {
    mockAddMembers.mockRejectedValueOnce(
      new AppError(400, "Solo puedes registrar miembros en cursos activos"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/members`)
      .set(authHeader(PROFESOR_AUTH))
      .send({ memberIds: [OTHER_VALID_ID] });
    expect(res.status).toBe(400);
  });
});

describe("course-assignment.routes — close (POST /:id/close)", () => {
  beforeEach(resetMocks);

  it("POST /close (Profesor dueño) → 200 'Curso cerrado correctamente'", async () => {
    mockCloseAssignment.mockResolvedValueOnce(buildAssignmentFixture());
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso cerrado correctamente");
  });

  it("POST /close con rol Miembro → 403 (no en TEACHING+Admin+Superadmin)", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(403);
    expect(mockCloseAssignment).not.toHaveBeenCalled();
  });

  it("POST /close cuando service lanza 403 (profesor no dueño) → 403", async () => {
    mockCloseAssignment.mockRejectedValueOnce(
      new AppError(403, "No tienes permisos para cerrar este curso"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tienes permisos para cerrar este curso");
  });

  it("POST /close cuando service lanza 400 'Este curso ya no esta activo'", async () => {
    mockCloseAssignment.mockRejectedValueOnce(
      new AppError(400, "Este curso ya no esta activo"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Este curso ya no esta activo");
  });

  it("POST /close cuando service lanza 400 'Debes registrar todas las clases...'", async () => {
    mockCloseAssignment.mockRejectedValueOnce(
      new AppError(400, "Debes registrar todas las clases antes de cerrar el curso"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Debes registrar todas las clases antes de cerrar el curso",
    );
  });

  it("POST /close sin auth → 401", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/close`)
      .set(noAuthHeader());
    expect(res.status).toBe(401);
    expect(mockCloseAssignment).not.toHaveBeenCalled();
  });
});

describe("course-assignment.routes — reopen (POST /:id/reopen)", () => {
  beforeEach(resetMocks);

  it("POST /reopen (Superadmin) → 200 { message, assignment }", async () => {
    mockReopenAssignment.mockResolvedValueOnce(
      buildAssignmentFixture({ status: "active" }),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({ totalClasses: 5 });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Curso reabierto correctamente");
    expect(res.body).toHaveProperty("assignment");
    expect(mockReopenAssignment).toHaveBeenCalledWith(VALID_ID, { totalClasses: 5 });
  });

  it("POST /reopen sin auth → 401", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(noAuthHeader());
    expect(res.status).toBe(401);
    expect(mockReopenAssignment).not.toHaveBeenCalled();
  });

  it("POST /reopen con rol no-Superadmin → 403", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(403);
    expect(mockReopenAssignment).not.toHaveBeenCalled();
  });

  it("POST / reopen 404 cuando service lanza 'Asignación no encontrada'", async () => {
    mockReopenAssignment.mockRejectedValueOnce(
      new AppError(404, "Asignación no encontrada"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Asignación no encontrada");
  });

  it("POST /reopen 409 'Solo se puede reabrir una asignación completada'", async () => {
    mockReopenAssignment.mockRejectedValueOnce(
      new AppError(409, "Solo se puede reabrir una asignación completada"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Solo se puede reabrir una asignación completada");
  });

  it("POST /reopen 409 'El profesor ya tiene otro curso activo asignado'", async () => {
    mockReopenAssignment.mockRejectedValueOnce(
      new AppError(409, "El profesor ya tiene otro curso activo asignado"),
    );
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("El profesor ya tiene otro curso activo asignado");
  });

  it("POST /reopen con totalClasses 0 → 400 (validador)", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${VALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({ totalClasses: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(mockReopenAssignment).not.toHaveBeenCalled();
  });

  it("POST /reopen con id inválido → 400 (validador)", async () => {
    const res = await request(app)
      .post(`/api/courses/assignments/${INVALID_ID}/reopen`)
      .set(authHeader(SUPERADMIN_AUTH))
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("course-assignment.routes — my-courses", () => {
  beforeEach(resetMocks);

  it("GET /my-courses (Profesor) → 200 array plano via buildMyProfessorQuery", async () => {
    mockBuildMyProfessorQuery.mockReturnValueOnce(chain([{ _id: VALID_ID }]));
    const res = await request(app)
      .get("/api/courses/my-courses")
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockBuildMyProfessorQuery).toHaveBeenCalledWith(VALID_ID, {
      status: "active",
      deletedAt: null,
    });
  });

  it("GET /my-courses (Miembro) → dispatch por buildMyStudentQuery", async () => {
    mockBuildMyStudentQuery.mockReturnValueOnce(chain([{ _id: OTHER_VALID_ID }]));
    const res = await request(app)
      .get("/api/courses/my-courses")
      .set(authHeader(MEMBER_AUTH));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockBuildMyStudentQuery).toHaveBeenCalledWith(OTHER_VALID_ID, {
      status: "active",
      deletedAt: null,
    });
  });

  it("GET /my-courses sin profileId → 200 [] (no llama service)", async () => {
    const noProfile: TestAuth = {
      userId: "u",
      email: "e@e.test",
      name: "x",
      roles: ["Miembro"],
      // profileId undefined
    };
    const res = await request(app)
      .get("/api/courses/my-courses")
      .set(authHeader(noProfile));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockBuildMyProfessorQuery).not.toHaveBeenCalled();
    expect(mockBuildMyStudentQuery).not.toHaveBeenCalled();
  });

  it("GET /my-courses/history (Profesor) → 200 array plano con sort endDate desc", async () => {
    const c = chain([{ _id: VALID_ID }]);
    mockBuildMyProfessorQuery.mockReturnValueOnce(c);
    const res = await request(app)
      .get("/api/courses/my-courses/history")
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(c.sort).toHaveBeenCalledWith({ endDate: -1 });
    expect(mockBuildMyProfessorQuery).toHaveBeenCalledWith(VALID_ID, {
      status: "completed",
      deletedAt: null,
    });
  });

  it("GET /my-courses/history sin auth → 401", async () => {
    const res = await request(app)
      .get("/api/courses/my-courses/history")
      .set(noAuthHeader());
    expect(res.status).toBe(401);
  });

  it("GET /my-courses cuando el service lanza → 500 'Error al obtener tus cursos'", async () => {
    mockBuildMyProfessorQuery.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get("/api/courses/my-courses")
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener tus cursos");
  });

  it("GET /my-courses/history sin profileId → 200 [] (Profesor sin profileId)", async () => {
    const noProfile: TestAuth = {
      userId: "u",
      email: "e@e.test",
      name: "x",
      roles: ["Profesor"],
    };
    const res = await request(app)
      .get("/api/courses/my-courses/history")
      .set(authHeader(noProfile));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockBuildMyProfessorQuery).not.toHaveBeenCalled();
  });

  it("GET /my-courses/history cuando el service lanza → 500 'Error al obtener tu historial de cursos'", async () => {
    mockBuildMyProfessorQuery.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .get("/api/courses/my-courses/history")
      .set(authHeader(PROFESOR_AUTH));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Error al obtener tu historial de cursos");
  });
});