import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

import {
  addMembers,
  buildAssignmentQuery,
  buildMyProfessorAssignmentQuery,
  buildMyStudentAssignmentQuery,
  calculateEndDate,
  closeAssignment,
  createAssignment,
  findMyActiveAssignment,
  getNextSpiritualGrowthStage,
  reopenAssignment,
  softDeleteAssignment,
  updateAssignment,
  validateProfessorUniqueActive,
} from "../../src/services/course-assignment.service";
import { AppError } from "../../src/services/app-error";

/**
 * Tests unitarios de `course-assignment.service.ts` (introducido en
 * EPC-COURSES-001 paso 5). Cubre todas las ramas significativas de la lógica
 * de negocio (404/400/409, profesor único activo, transacción de reopen).
 *
 * Sin Mongo real: los modelos y `emitRealtimeInvalidation` están mockeados
 * con `vi.mock`. `mongoose.startSession` se espía en runtime. Sin `console.log`,
 * sin `any`.
 */

// ---- mocks a nivel módulo -----------------------------------------------

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
}));

vi.mock("../../src/models/course-assigned.model", () => {
  const courseAssignedModel = {
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  };
  return { default: courseAssignedModel };
});

vi.mock("../../src/models/course.model", () => {
  const courseModel = {
    findOne: vi.fn(),
  };
  return { default: courseModel };
});

vi.mock("../../src/models/class-session.model", () => {
  const classSessionModel = {
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };
  return { default: classSessionModel };
});

vi.mock("../../src/models/user-profile.model", () => {
  const userProfileModel = {
    findById: vi.fn(),
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  };
  const SPIRITUAL_GROWTH_STAGES = [
    "Consolidación",
    "Discipulado básico",
    "Carácter cristiano",
    "Sanidad y propósito",
    "Cosmovisión bíblica",
    "Finanzas y Gobierno",
    "Doctrina cristiana",
  ];
  return { default: userProfileModel, SPIRITUAL_GROWTH_STAGES };
});

import CourseAssigned from "../../src/models/course-assigned.model";
import Course from "../../src/models/course.model";
import ClassSession from "../../src/models/class-session.model";
import UserProfile from "../../src/models/user-profile.model";
import { emitRealtimeInvalidation } from "../../src/realtime/socket";

// ---- acceso tipado a los mocks ------------------------------------------

const assignedFindOne = CourseAssigned.findOne as unknown as ReturnType<typeof vi.fn>;
const assignedFind = CourseAssigned.find as unknown as ReturnType<typeof vi.fn>;
const assignedFindById = CourseAssigned.findById as unknown as ReturnType<typeof vi.fn>;
const assignedFindOneAndUpdate =
  CourseAssigned.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const assignedCountDocuments =
  CourseAssigned.countDocuments as unknown as ReturnType<typeof vi.fn>;
const assignedCreate = CourseAssigned.create as unknown as ReturnType<typeof vi.fn>;
const assignedDeleteOne = CourseAssigned.deleteOne as unknown as ReturnType<typeof vi.fn>;
const assignedDeleteMany = CourseAssigned.deleteMany as unknown as ReturnType<typeof vi.fn>;

const courseFindOne = Course.findOne as unknown as ReturnType<typeof vi.fn>;
const classSessionCountDocuments =
  ClassSession.countDocuments as unknown as ReturnType<typeof vi.fn>;
const classSessionUpdateMany =
  ClassSession.updateMany as unknown as ReturnType<typeof vi.fn>;
const classSessionDeleteMany =
  ClassSession.deleteMany as unknown as ReturnType<typeof vi.fn>;

const userProfileFindById = UserProfile.findById as unknown as ReturnType<typeof vi.fn>;
const userProfileFind = UserProfile.find as unknown as ReturnType<typeof vi.fn>;
const userProfileFindByIdAndUpdate =
  UserProfile.findByIdAndUpdate as unknown as ReturnType<typeof vi.fn>;
const classSessionFind = ClassSession.find as unknown as ReturnType<typeof vi.fn>;

const realtimeMock = emitRealtimeInvalidation as unknown as ReturnType<typeof vi.fn>;

// ---- cadenas query fluidas (populate / sort / skip / limit / session) ---

type Chain = {
  populate: ReturnType<typeof vi.fn>;
  sort: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lean: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  session: ReturnType<typeof vi.fn>;
  then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) => Promise<U>;
};

const chainableWith = (resolved: unknown): Chain => {
  const self = {} as Chain;
  self.populate = vi.fn(() => self);
  self.sort = vi.fn(() => self);
  self.skip = vi.fn(() => self);
  self.limit = vi.fn(() => self);
  self.lean = vi.fn(() => self);
  self.exec = vi.fn(() => Promise.resolve(resolved));
  self.session = vi.fn(() => self);
  self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
    Promise.resolve(resolved).then(onfulfilled);
  return self;
};

// ---- fixtures -----------------------------------------------------------

const VALID_COURSE_ID = "65a1f0c0c1d2a3b4f5e6f7a8";
const VALID_PROFESSOR_ID = "65a1f0c0c1d2a3b4f5e6f7a9";
const VALID_MEMBER_ID = "65a1f0c0c1d2a3b4f5e6f7b0";
const OTHER_MEMBER_ID = "65a1f0c0c1d2a3b4f5e6f7b1";
const NON_EXISTENT_MEMBER_ID = "65a1f0c0c1d2a3b4f5e6f7b2";
const ASSIGNMENT_ID = "65a1f0c0c1d2a3b4f5e6f7c0";

const buildAssignment = (overrides: Record<string, unknown> = {}) => ({
  _id: ASSIGNMENT_ID,
  course: { _id: VALID_COURSE_ID, name: "Fundamentos", spiritualGrowthStage: "Consolidación" },
  professor: { _id: VALID_PROFESSOR_ID },
  members: [] as Array<{ _id: string }>,
  startDate: new Date("2026-02-01"),
  startTime: "18:00",
  totalClasses: 8,
  endDate: new Date("2026-03-22"),
  endedAt: null,
  location: "Sede Central",
  status: "active",
  deletedAt: null,
  toObject() {
    return this;
  },
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const buildPopulatedAssignment = (overrides: Record<string, unknown> = {}) => ({
  _id: ASSIGNMENT_ID,
  course: { _id: VALID_COURSE_ID, name: "Fundamentos", spiritualGrowthStage: "Consolidación" },
  professor: { _id: VALID_PROFESSOR_ID, role: { name: "Profesor" } },
  members: [{ _id: VALID_MEMBER_ID }],
  startDate: new Date("2026-02-01"),
  startTime: "18:00",
  totalClasses: 8,
  endDate: new Date("2026-03-22"),
  endedAt: null,
  location: "Sede Central",
  status: "active",
  deletedAt: null,
  toObject() {
    return this;
  },
  ...overrides,
});

const buildProfessorProfile = (overrides: Record<string, unknown> = {}) => ({
  _id: VALID_PROFESSOR_ID,
  role: { name: "Profesor" },
  user: { roles: [] },
  ...overrides,
});

const buildMember = (
  id: string,
  roleName: string,
  overrides: Record<string, unknown> = {},
) => ({
  _id: id,
  firstName: "Nombre",
  lastName: "Apellido",
  role: { name: roleName },
  spiritualGrowthStage: undefined,
  ...overrides,
});

const buildSession = (classNumber: number, attendance: Array<{ student: string; present: boolean }>) => ({
  classNumber,
  attendance,
});

const resetMocks = () => {
  vi.clearAllMocks();
  assignedFindOne.mockReset();
  assignedFind.mockReset();
  assignedFindById.mockReset();
  assignedFindOneAndUpdate.mockReset();
  assignedCountDocuments.mockReset();
  assignedCreate.mockReset();
  assignedDeleteOne.mockReset();
  assignedDeleteMany.mockReset();
  courseFindOne.mockReset();
  classSessionCountDocuments.mockReset();
  classSessionUpdateMany.mockReset();
  classSessionDeleteMany.mockReset();
  userProfileFindById.mockReset();
  userProfileFind.mockReset();
  userProfileFindByIdAndUpdate.mockReset();
  classSessionFind.mockReset();
  realtimeMock.mockReset();
};

// ---- tests --------------------------------------------------------------

describe("course-assignment.service — calculateEndDate", () => {
  it("suma (totalClasses-1)*7 dias a startDate", () => {
    const result = calculateEndDate("2026-02-01", 8);
    expect(result.toISOString()).toBe(new Date("2026-03-22").toISOString());
  });

  it("devuelve la misma fecha cuando totalClasses = 1", () => {
    const result = calculateEndDate("2026-02-01", 1);
    expect(result.toISOString()).toBe(new Date("2026-02-01").toISOString());
  });
});

describe("course-assignment.service — getNextSpiritualGrowthStage", () => {
  it('sin etapa actual devuelve la primera etapa "Consolidación"', () => {
    expect(getNextSpiritualGrowthStage(undefined)).toBe("Consolidación");
    expect(getNextSpiritualGrowthStage(null)).toBe("Consolidación");
    expect(getNextSpiritualGrowthStage("")).toBe("Consolidación");
  });

  it('desde "Cosmovisión bíblica" avanza a "Finanzas y Gobierno" (ADR-0007)', () => {
    expect(getNextSpiritualGrowthStage("Cosmovisión bíblica")).toBe("Finanzas y Gobierno");
  });

  it('desde "Finanzas y Gobierno" avanza a "Doctrina cristiana"', () => {
    expect(getNextSpiritualGrowthStage("Finanzas y Gobierno")).toBe("Doctrina cristiana");
  });

  it('en la última etapa no hay siguiente etapa', () => {
    expect(getNextSpiritualGrowthStage("Doctrina cristiana")).toBeNull();
  });

  it("etapa inválida devuelve null", () => {
    expect(getNextSpiritualGrowthStage("Etapa desconocida")).toBeNull();
  });
});

describe("course-assignment.service — validateProfessorUniqueActive", () => {
  beforeEach(resetMocks);

  it("no lanza cuando no existe otra asignacion activa (sin exclude)", async () => {
    assignedFindOne.mockResolvedValue(null);
    await expect(validateProfessorUniqueActive(VALID_PROFESSOR_ID)).resolves.toBeUndefined();
    expect(assignedFindOne).toHaveBeenCalledWith({
      professor: VALID_PROFESSOR_ID,
      status: "active",
      deletedAt: null,
    });
  });

  it("no lanza cuando hay excludeAssignmentId y el filtro incluye $ne", async () => {
    assignedFindOne.mockResolvedValue(null);
    await expect(
      validateProfessorUniqueActive(VALID_PROFESSOR_ID, ASSIGNMENT_ID),
    ).resolves.toBeUndefined();
    expect(assignedFindOne).toHaveBeenCalledWith({
      professor: VALID_PROFESSOR_ID,
      status: "active",
      deletedAt: null,
      _id: { $ne: ASSIGNMENT_ID },
    });
  });

  it("lanza 409 cuando existe otra activa", async () => {
    assignedFindOne.mockResolvedValue(buildAssignment());
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    await expect(validateProfessorUniqueActive(VALID_PROFESSOR_ID)).rejects.toMatchObject({
      status: 409,
      message: "Este profesor ya tiene un curso activo asignado",
    });
  });

  it("borra una asignacion activa huérfana si su curso ya no existe", async () => {
    assignedFindOne.mockResolvedValue(buildAssignment());
    courseFindOne.mockResolvedValue(null);
    assignedDeleteOne.mockResolvedValue({ deletedCount: 1 });

    await expect(validateProfessorUniqueActive(VALID_PROFESSOR_ID)).resolves.toBeUndefined();
    expect(assignedDeleteOne).toHaveBeenCalledWith({ _id: ASSIGNMENT_ID });
  });
});

describe("course-assignment.service — buildAssignmentQuery helpers", () => {
  beforeEach(resetMocks);

  it("buildAssignmentQuery retorna query con populate chain", () => {
    assignedFind.mockReturnValue(chainableWith([]));
    const query = buildAssignmentQuery({ status: "active" });
    expect(assignedFind).toHaveBeenCalledWith({ status: "active" });
    expect(query.populate).toBeDefined();
  });

  it("buildMyProfessorAssignmentQuery inyecta professor en el filtro", () => {
    assignedFind.mockReturnValue(chainableWith([]));
    const query = buildMyProfessorAssignmentQuery(VALID_PROFESSOR_ID, { status: "active" });
    expect(assignedFind).toHaveBeenCalledWith({
      professor: VALID_PROFESSOR_ID,
      status: "active",
    });
    expect(query.populate).toBeDefined();
  });

  it("buildMyStudentAssignmentQuery filtra por members", () => {
    assignedFind.mockReturnValue(chainableWith([]));
    const query = buildMyStudentAssignmentQuery(VALID_MEMBER_ID, { status: "completed" });
    expect(assignedFind).toHaveBeenCalledWith({ members: VALID_MEMBER_ID, status: "completed" });
    expect(query.populate).toBeDefined();
  });

  it("findMyActiveAssignment consulta por profesor activo y populate", async () => {
    // buildChain con thenableResolved = fixture
    const fixture = buildAssignment({ professor: VALID_PROFESSOR_ID });
    const chain = chainableWith(fixture);
    assignedFindOne.mockReturnValueOnce(chain);
    const result = await findMyActiveAssignment(VALID_PROFESSOR_ID);
    expect(assignedFindOne).toHaveBeenCalledWith({
      professor: VALID_PROFESSOR_ID,
      status: "active",
      deletedAt: null,
    });
    expect(result).toBe(fixture);
  });
});

describe("course-assignment.service — createAssignment", () => {
  beforeEach(resetMocks);

  const buildBody = () => ({
    course: VALID_COURSE_ID,
    professor: VALID_PROFESSOR_ID,
    startDate: "2026-02-01",
    startTime: "18:00",
    totalClasses: 8,
    location: "Sede Central",
  });

  it("crea y devuelve asignacion populada (happy path)", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    // profesor poblado con rol.name = Profesor
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    // validateProfessorUniqueActive: no hay otra activa
    assignedFindOne.mockResolvedValueOnce(null);
    assignedDeleteMany.mockResolvedValue({ deletedCount: 0 });
    assignedCreate.mockResolvedValue({ _id: ASSIGNMENT_ID });
    const populated = buildPopulatedAssignment();
    assignedFindById.mockReturnValueOnce(chainableWith(populated));

    const result = await createAssignment(buildBody());

    expect(assignedDeleteMany).toHaveBeenCalledWith({
      professor: VALID_PROFESSOR_ID,
      deletedAt: { $ne: null },
    });
    expect(assignedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        course: VALID_COURSE_ID,
        professor: VALID_PROFESSOR_ID,
        totalClasses: 8,
        endDate: new Date("2026-03-22"),
        status: "active",
      }),
    );
    expect(result).toBe(populated);
    expect(realtimeMock).toHaveBeenCalledWith(
      "courseAssignments.changed",
      expect.any(Array),
    );
  });

  it("purga asignaciones fantasma del profesor antes de insertar (ADR-0009 §D3)", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(null);
    assignedDeleteMany.mockResolvedValue({ deletedCount: 2 });
    assignedCreate.mockResolvedValue({ _id: ASSIGNMENT_ID });
    assignedFindById.mockReturnValueOnce(chainableWith(buildPopulatedAssignment()));

    await createAssignment(buildBody());

    expect(assignedDeleteMany).toHaveBeenCalledTimes(1);
    expect(assignedDeleteMany).toHaveBeenCalledWith({
      professor: VALID_PROFESSOR_ID,
      deletedAt: { $ne: null },
    });
    expect(assignedCreate).toHaveBeenCalled();
  });

  it("NO purga asignaciones completadas vigentes (deletedAt: null)", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(null);
    assignedDeleteMany.mockResolvedValue({ deletedCount: 0 });
    assignedCreate.mockResolvedValue({ _id: ASSIGNMENT_ID });
    assignedFindById.mockReturnValueOnce(chainableWith(buildPopulatedAssignment()));

    await createAssignment(buildBody());

    // El filtro de purga exige deletedAt != null, por lo que el historial
    // completed con deletedAt: null nunca se ve afectado.
    expect(assignedDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: { $ne: null } }),
    );
    expect(assignedDeleteMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: null }),
    );
  });

  it("404 si el curso no existe o esta soft-deleted", async () => {
    courseFindOne.mockResolvedValue(null);
    await expect(createAssignment(buildBody())).rejects.toMatchObject({
      status: 404,
      message: "Curso no encontrado",
    });
  });

  it("404 si el perfil de profesor no existe", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(null));
    await expect(createAssignment(buildBody())).rejects.toMatchObject({
      status: 404,
      message: "Profesor no encontrado",
    });
  });

  it("400 si el miembro no tiene rol Profesor (rol primario no Profesor y sin linkedUser)", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(
      chainableWith(buildProfessorProfile({ role: { name: "Miembro" } })),
    );
    await expect(createAssignment(buildBody())).rejects.toMatchObject({
      status: 400,
      message: "El miembro seleccionado no tiene rol de profesor",
    });
  });

  it("acepta profesor cuando rol primario no es Profesor pero user.roles lo incluye (linkedUser)", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(
      chainableWith(
        buildProfessorProfile({
          role: { name: "Miembro" },
          user: { roles: [{ name: "Profesor" }] },
        }),
      ),
    );
    assignedFindOne.mockResolvedValueOnce(null);
    assignedDeleteMany.mockResolvedValue({ deletedCount: 0 });
    assignedCreate.mockResolvedValue({ _id: ASSIGNMENT_ID });
    assignedFindById.mockReturnValueOnce(chainableWith(buildPopulatedAssignment()));

    await expect(createAssignment(buildBody())).resolves.toBeDefined();
    expect(assignedCreate).toHaveBeenCalled();
  });

  it("409 si el profesor ya tiene otra activa (validateProfessorUniqueActive)", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(buildAssignment());

    await expect(createAssignment(buildBody())).rejects.toMatchObject({
      status: 409,
      message: "Este profesor ya tiene un curso activo asignado",
    });
  });

  it("409 por duplicate key (code 11000) en CourseAssigned.create", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(null);
    assignedDeleteMany.mockResolvedValue({ deletedCount: 0 });
    const duplicateError: NodeJS.ErrnoException = Object.assign(new Error("dup"), {
      code: 11000,
    });
    assignedCreate.mockRejectedValue(duplicateError);

    await expect(createAssignment(buildBody())).rejects.toMatchObject({
      status: 409,
      message: "Este profesor ya tiene un curso activo asignado",
    });
  });

  it("propaga errores genericos lanzados por CourseAssigned.create", async () => {
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(null);
    assignedDeleteMany.mockResolvedValue({ deletedCount: 0 });
    assignedCreate.mockRejectedValue(new Error("boom"));

    await expect(createAssignment(buildBody())).rejects.toThrow("boom");
  });
});

describe("course-assignment.service — updateAssignment", () => {
  beforeEach(resetMocks);

  const buildBody = () => ({
    course: VALID_COURSE_ID,
    professor: VALID_PROFESSOR_ID,
    startDate: "2026-02-01",
    startTime: "18:00",
    totalClasses: 8,
    location: "Sede Central",
  });

  it("happy path conserva el status existente y emite realtime", async () => {
    const existing = buildAssignment({ status: "completed" });
    assignedFindOne.mockResolvedValueOnce(existing);
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(null); // validar profesor unico (exclude id)
    const populated = buildPopulatedAssignment();
    assignedFindOneAndUpdate.mockReturnValueOnce(chainableWith(populated));

    const result = await updateAssignment(ASSIGNMENT_ID, buildBody());

    expect(assignedFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: ASSIGNMENT_ID, deletedAt: null },
      expect.objectContaining({
        status: "completed", // default desde existing
        endDate: new Date("2026-03-22"),
      }),
      { new: true },
    );
    expect(result).toBe(populated);
    expect(realtimeMock).toHaveBeenCalledWith(
      "courseAssignments.changed",
      expect.any(Array),
    );
  });

  it("404 si la asignacion no existe o esta soft-deleted", async () => {
    assignedFindOne.mockResolvedValueOnce(null);
    await expect(updateAssignment(ASSIGNMENT_ID, buildBody())).rejects.toMatchObject({
      status: 404,
      message: "Asignacion no encontrada",
    });
  });

  it("404 si el curso no existe", async () => {
    assignedFindOne.mockResolvedValueOnce(buildAssignment());
    courseFindOne.mockResolvedValue(null);
    await expect(updateAssignment(ASSIGNMENT_ID, buildBody())).rejects.toMatchObject({
      status: 404,
      message: "Curso no encontrado",
    });
  });

  it("404 si el profesor no existe", async () => {
    assignedFindOne.mockResolvedValueOnce(buildAssignment());
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(null));
    await expect(updateAssignment(ASSIGNMENT_ID, buildBody())).rejects.toMatchObject({
      status: 404,
      message: "Profesor no encontrado",
    });
  });

  it("400 si el profesor asignado no tiene rol Profesor", async () => {
    assignedFindOne.mockResolvedValueOnce(buildAssignment());
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(
      chainableWith(buildProfessorProfile({ role: { name: "Asistente" } })),
    );
    await expect(updateAssignment(ASSIGNMENT_ID, buildBody())).rejects.toMatchObject({
      status: 400,
      message: "El miembro seleccionado no tiene rol de profesor",
    });
  });

  it("409 si el profesor ya tiene otra activa (excluyendo la propia)", async () => {
    assignedFindOne.mockResolvedValueOnce(buildAssignment());
    courseFindOne.mockResolvedValue({ _id: VALID_COURSE_ID });
    userProfileFindById.mockReturnValueOnce(chainableWith(buildProfessorProfile()));
    assignedFindOne.mockResolvedValueOnce(buildAssignment());

    await expect(updateAssignment(ASSIGNMENT_ID, buildBody())).rejects.toMatchObject({
      status: 409,
      message: "Este profesor ya tiene un curso activo asignado",
    });
    // El segundo findOne (validateProfessorUniqueActive) lleva _id $ne:
    expect(assignedFindOne).toHaveBeenLastCalledWith({
      professor: VALID_PROFESSOR_ID,
      status: "active",
      deletedAt: null,
      _id: { $ne: ASSIGNMENT_ID },
    });
  });
});

describe("course-assignment.service — softDeleteAssignment (hard-delete en cascada, ADR-0009 §D2)", () => {
  beforeEach(resetMocks);

  it("404 si no existe asignacion activa/no-soft-deleted", async () => {
    assignedFindOne.mockResolvedValue(null);
    await expect(softDeleteAssignment(ASSIGNMENT_ID)).rejects.toMatchObject({
      status: 404,
      message: "Asignacion no encontrada",
    });
    expect(classSessionDeleteMany).not.toHaveBeenCalled();
    expect(assignedDeleteOne).not.toHaveBeenCalled();
  });

  it("happy path borra fisico en cascada y emite realtime", async () => {
    const fixture = buildAssignment();
    assignedFindOne.mockResolvedValue(fixture);
    const assignment = await softDeleteAssignment(ASSIGNMENT_ID);
    expect(assignment).toBe(fixture);
    expect(assignedFindOne).toHaveBeenCalledWith({ _id: ASSIGNMENT_ID, deletedAt: null });
    expect(classSessionDeleteMany).toHaveBeenCalledWith({ courseAssigned: ASSIGNMENT_ID });
    expect(assignedDeleteOne).toHaveBeenCalledWith({ _id: ASSIGNMENT_ID });
    expect(realtimeMock).toHaveBeenCalledWith(
      "courseAssignments.changed",
      expect.any(Array),
    );
  });
});

describe("course-assignment.service — addMembers", () => {
  beforeEach(resetMocks);

  const buildActiveAssignmentWithProfessor = (
    professorId: string,
    members: Array<{ _id: string }> = [],
    status = "active",
    overrides: Record<string, unknown> = {},
  ) =>
    buildAssignment({
      professor: { _id: professorId },
      members,
      status,
      ...overrides,
    });

  it("404 si la asignacion no existe", async () => {
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Asignacion no encontrada",
    });
  });

  it("403 si el caller es Profesor y no es el dueño", async () => {
    assignedFindOne.mockReturnValueOnce(
      chainableWith(buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID)),
    );
    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: OTHER_MEMBER_ID, // no es el profesor dueño
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para actualizar esta asignacion",
    });
  });

  it("400 si la asignacion NO esta active", async () => {
    assignedFindOne.mockReturnValueOnce(
      chainableWith(buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "completed")),
    );
    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Solo puedes registrar miembros en cursos activos",
    });
  });

  it("400 si alguno de los memberIds no es Asistente/Miembro", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [
      { _id: VALID_MEMBER_ID },
    ]);
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    // Solo uno de los 2 pasados es Asistente/Miembro → diferencia de longitud
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro"),
        buildMember(OTHER_MEMBER_ID, "Profesor"), // rol invalido
      ]),
    );

    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID, OTHER_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Solo puedes registrar perfiles con rol Asistente o Miembro",
    });
  });

  it("dedupe memberIds y actualiza (happy path, Admin caller, bypass owner)", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID);
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([buildMember(VALID_MEMBER_ID, "Miembro")]),
    );
    const populated = buildPopulatedAssignment();
    assignedFindOneAndUpdate.mockReturnValueOnce(chainableWith(populated));

    const result = await addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID, VALID_MEMBER_ID], {
      callerProfileId: OTHER_MEMBER_ID, // Admin: bypass owner check
      callerRoles: ["Admin"],
    });

    expect(result).toBe(populated);
    expect(assignedFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: ASSIGNMENT_ID, deletedAt: null },
      { $set: { members: [VALID_MEMBER_ID] } },
      { new: true },
    );
    expect(realtimeMock).toHaveBeenCalledWith(
      "courseAssignments.members.changed",
      expect.any(Array),
    );
  });

  it("404 si algún memberId no existe", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID);
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(chainableWith([]));

    await expect(
      addMembers(ASSIGNMENT_ID, [NON_EXISTENT_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: `No se encontró un miembro con ID ${NON_EXISTENT_MEMBER_ID}`,
    });
  });

  it("inscribe miembro elegible cuando la siguiente etapa coincide con la del curso", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Consolidación" }),
      ]),
    );
    const populated = buildPopulatedAssignment({
      course: { _id: VALID_COURSE_ID, name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
      members: [{ _id: VALID_MEMBER_ID }],
    });
    assignedFindOneAndUpdate.mockReturnValueOnce(chainableWith(populated));

    const result = await addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
      callerProfileId: VALID_PROFESSOR_ID,
      callerRoles: ["Profesor"],
    });

    expect(result).toBe(populated);
    expect(assignedFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: ASSIGNMENT_ID, deletedAt: null },
      { $set: { members: [VALID_MEMBER_ID] } },
      { new: true },
    );
  });

  it("rechaza miembro no elegible cuando la etapa no coincide", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Carácter cristiano" }),
      ]),
    );

    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: `Nombre Apellido no es elegible para el curso "Discipulado básico". Su siguiente etapa es "Sanidad y propósito".`,
    });
  });

  it("rechaza miembro en última etapa sin siguiente etapa", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Doctrina", spiritualGrowthStage: "Doctrina cristiana" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Doctrina cristiana" }),
      ]),
    );

    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Nombre Apellido no puede inscribirse: ya alcanzó la última etapa de crecimiento espiritual",
    });
  });

  it("inscribe miembro en 'Finanzas y Gobierno' cuando viene de 'Cosmovisión bíblica' (ADR-0007)", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Finanzas y Gobierno", spiritualGrowthStage: "Finanzas y Gobierno" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Cosmovisión bíblica" }),
      ]),
    );
    const populated = buildPopulatedAssignment({
      course: { _id: VALID_COURSE_ID, name: "Finanzas y Gobierno", spiritualGrowthStage: "Finanzas y Gobierno" },
      members: [{ _id: VALID_MEMBER_ID }],
    });
    assignedFindOneAndUpdate.mockReturnValueOnce(chainableWith(populated));

    const result = await addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
      callerProfileId: VALID_PROFESSOR_ID,
      callerRoles: ["Profesor"],
    });

    expect(result).toBe(populated);
  });

  it("rechaza miembro en 'Cosmovisión bíblica' para curso 'Doctrina cristiana' (salta etapa ADR-0007)", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Doctrina", spiritualGrowthStage: "Doctrina cristiana" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Cosmovisión bíblica" }),
      ]),
    );

    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Nombre Apellido no es elegible para el curso "Doctrina cristiana". Su siguiente etapa es "Finanzas y Gobierno".',
    });
  });
});

describe("course-assignment.service — closeAssignment", () => {
  beforeEach(resetMocks);

  const buildActiveForProfessor = (
    professorId: string,
    totalClasses = 8,
    overrides: Record<string, unknown> = {},
  ) =>
    buildAssignment({
      professor: { _id: professorId },
      totalClasses,
      status: "active",
      ...overrides,
    });

  it("404 si la asignacion no existe", async () => {
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    await expect(
      closeAssignment(ASSIGNMENT_ID, {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Asignacion no encontrada",
    });
  });

  it("403 si caller Profesor no dueño", async () => {
    assignedFindOne.mockReturnValueOnce(
      chainableWith(buildActiveForProfessor(VALID_PROFESSOR_ID)),
    );
    await expect(
      closeAssignment(ASSIGNMENT_ID, {
        callerProfileId: OTHER_MEMBER_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para cerrar este curso",
    });
  });

  it("400 si la asignacion ya NO esta active", async () => {
    assignedFindOne.mockReturnValueOnce(
      chainableWith(
        buildAssignment({
          professor: { _id: VALID_PROFESSOR_ID },
          totalClasses: 8,
          status: "completed",
        }),
      ),
    );
    await expect(
      closeAssignment(ASSIGNMENT_ID, {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Este curso ya no esta activo",
    });
  });

  it("400 si no todas las sesiones estan registradas", async () => {
    const assignment = buildActiveForProfessor(VALID_PROFESSOR_ID, 8);
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    classSessionCountDocuments.mockResolvedValue(7); // < 8

    await expect(
      closeAssignment(ASSIGNMENT_ID, {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Debes registrar todas las clases antes de cerrar el curso",
    });
  });

  it("happy path: set status completed + endedAt, emite courseAssignments.closed y courseHistory.changed", async () => {
    const assignment = buildActiveForProfessor(VALID_PROFESSOR_ID, 8);
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    classSessionCountDocuments.mockResolvedValue(8);

    const returned = await closeAssignment(ASSIGNMENT_ID, {
      callerProfileId: VALID_PROFESSOR_ID,
      callerRoles: ["Profesor"],
    });

    expect(returned.status).toBe("completed");
    expect(returned.endedAt).toBeInstanceOf(Date);
    expect(assignment.save).toHaveBeenCalled();
    expect(realtimeMock).toHaveBeenCalledWith(
      "courseAssignments.closed",
      expect.any(Array),
    );
    expect(realtimeMock).toHaveBeenCalledWith("courseHistory.changed", expect.any(Array));
  });

  it("happy path: Admin bypassa owner check", async () => {
    const assignment = buildActiveForProfessor(VALID_PROFESSOR_ID, 4);
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    classSessionCountDocuments.mockResolvedValue(4);

    const returned = await closeAssignment(ASSIGNMENT_ID, {
      callerProfileId: OTHER_MEMBER_ID,
      callerRoles: ["Admin"],
    });

    expect(returned.status).toBe("completed");
  });

  it("avance automático: actualiza etapa de miembros con asistencia >= 70%", async () => {
    const assignment = buildActiveForProfessor(VALID_PROFESSOR_ID, 8, {
      course: { _id: VALID_COURSE_ID, name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
      members: [{ _id: VALID_MEMBER_ID }, { _id: OTHER_MEMBER_ID }],
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    classSessionCountDocuments.mockResolvedValue(8);
    classSessionFind.mockReturnValue(
      chainableWith(
        Array.from({ length: 8 }, (_, i) =>
          buildSession(i + 1, [
            { student: VALID_MEMBER_ID, present: true },
            { student: OTHER_MEMBER_ID, present: true },
          ]),
        ),
      ),
    );
    userProfileFindByIdAndUpdate.mockResolvedValue(null);

    const returned = await closeAssignment(ASSIGNMENT_ID, {
      callerProfileId: VALID_PROFESSOR_ID,
      callerRoles: ["Profesor"],
    });

    expect(returned.status).toBe("completed");
    expect(userProfileFindByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(userProfileFindByIdAndUpdate).toHaveBeenCalledWith(VALID_MEMBER_ID, {
      spiritualGrowthStage: "Discipulado básico",
    });
    expect(userProfileFindByIdAndUpdate).toHaveBeenCalledWith(OTHER_MEMBER_ID, {
      spiritualGrowthStage: "Discipulado básico",
    });
  });

  it("avance automático: no actualiza etapa de miembros con asistencia < 70%", async () => {
    const assignment = buildActiveForProfessor(VALID_PROFESSOR_ID, 8, {
      course: { _id: VALID_COURSE_ID, name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
      members: [{ _id: VALID_MEMBER_ID }],
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    classSessionCountDocuments.mockResolvedValue(8);
    classSessionFind.mockReturnValue(
      chainableWith(
        Array.from({ length: 8 }, (_, i) =>
          buildSession(i + 1, [{ student: VALID_MEMBER_ID, present: i < 4 }]),
        ),
      ),
    );

    const returned = await closeAssignment(ASSIGNMENT_ID, {
      callerProfileId: VALID_PROFESSOR_ID,
      callerRoles: ["Profesor"],
    });

    expect(returned.status).toBe("completed");
    expect(userProfileFindByIdAndUpdate).not.toHaveBeenCalled();
  });
});

// ---- reopen -------------------------------------------------------------
//
// Necesitamos mockear `mongoose.startSession` para poder ejecutar el callback
// de `withTransaction` directamente y controlar el flujo. La sesión falsa
// expone `withTransaction(cb)` que ejecuta la callback y `endSession`.

type FakeSession = {
  withTransaction: ReturnType<typeof vi.fn>;
  endSession: ReturnType<typeof vi.fn>;
};

const buildFakeSession = (): FakeSession => {
  const session: FakeSession = {
    withTransaction: vi.fn(),
    endSession: vi.fn(),
  };
  session.withTransaction.mockImplementation(
    async (cb: (session: FakeSession) => Promise<unknown>) => cb(session),
  );
  return session;
};

const mockStartSession = (session: FakeSession) => {
  const spy = vi.spyOn(mongoose, "startSession");
  spy.mockResolvedValue(session as unknown as mongoose.ClientSession);
  return spy;
};

describe("course-assignment.service — reopenAssignment", () => {
  beforeEach(resetMocks);

  it("404 si la asignacion no existe", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    // dentro de transaccion: findOne retorna null
    const insideFindOne = vi.fn().mockReturnValueOnce(chainableWith(null));
    assignedFindOne.mockImplementation(insideFindOne);

    await expect(reopenAssignment(ASSIGNMENT_ID, {})).rejects.toMatchObject({
      status: 404,
      message: "Asignación no encontrada",
    });
    expect(session.endSession).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("409 si la asignacion NO esta completed", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({ status: "active" });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));

    await expect(reopenAssignment(ASSIGNMENT_ID, {})).rejects.toMatchObject({
      status: 409,
      message: "Solo se puede reabrir una asignación completada",
    });
    spy.mockRestore();
  });

  it("409 si el profesor ya tiene otra asignacion activa", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({
      status: "completed",
      professor: VALID_PROFESSOR_ID,
    });
    // primera findOne (asignacion), segunda findOne (conflictivo)
    assignedFindOne
      .mockReturnValueOnce(chainableWith(assignment))
      .mockReturnValueOnce(chainableWith(buildAssignment({ status: "active" })));

    await expect(reopenAssignment(ASSIGNMENT_ID, {})).rejects.toMatchObject({
      status: 409,
      message: "El profesor ya tiene otro curso activo asignado",
    });
    spy.mockRestore();
  });

  it("400 si totalClasses no es entero positivo", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({
      status: "completed",
      professor: VALID_PROFESSOR_ID,
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    assignedFindOne.mockReturnValueOnce(chainableWith(null)); // sin conflicto

    await expect(
      reopenAssignment(ASSIGNMENT_ID, { totalClasses: 0 }),
    ).rejects.toMatchObject({
      status: 400,
      message: "El total de clases debe ser un entero mayor a 0",
    });
    spy.mockRestore();
  });

  it("happy path sin totalClasses: mantiene previous, status active, endedAt null", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({
      status: "completed",
      professor: VALID_PROFESSOR_ID,
      totalClasses: 8,
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    const populated = buildPopulatedAssignment({ status: "active", totalClasses: 8 });
    assignedFindById.mockReturnValueOnce(chainableWith(populated));

    const result = await reopenAssignment(ASSIGNMENT_ID, {});

    expect(result).toBe(populated);
    expect(assignment.status).toBe("active");
    expect(assignment.endedAt).toBeNull();
    expect(assignment.save).toHaveBeenCalled();
    expect(classSessionUpdateMany).not.toHaveBeenCalled();
    expect(realtimeMock).toHaveBeenCalledWith("courseHistory.changed", expect.any(Array));
    expect(realtimeMock).toHaveBeenCalledWith(
      "courseAssignments.changed",
      expect.any(Array),
    );
    spy.mockRestore();
  });

  it("happy path con totalClasses menor: llama ClassSession.updateMany (AC7.6)", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({
      status: "completed",
      professor: VALID_PROFESSOR_ID,
      totalClasses: 8,
      startDate: new Date("2026-02-01"),
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    classSessionUpdateMany.mockResolvedValue({ matchedCount: 2 });
    const populated = buildPopulatedAssignment({ status: "active", totalClasses: 5 });
    assignedFindById.mockReturnValueOnce(chainableWith(populated));

    const result = await reopenAssignment(ASSIGNMENT_ID, { totalClasses: 5 });

    expect(result).toBe(populated);
    expect(assignment.totalClasses).toBe(5);
    expect(assignment.endDate).toEqual(calculateEndDate("2026-02-01T00:00:00.000Z", 5));
    expect(classSessionUpdateMany).toHaveBeenCalledWith(
      {
        courseAssigned: ASSIGNMENT_ID,
        classNumber: { $gt: 5 },
        deletedAt: null,
      },
      { $set: { deletedAt: expect.any(Date) } },
      { session },
    );
    spy.mockRestore();
  });

  it("happy path con totalClasses mayor: NO llama updateMany", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({
      status: "completed",
      professor: VALID_PROFESSOR_ID,
      totalClasses: 5,
      startDate: new Date("2026-02-01"),
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    const populated = buildPopulatedAssignment({ status: "active", totalClasses: 12 });
    assignedFindById.mockReturnValueOnce(chainableWith(populated));

    await reopenAssignment(ASSIGNMENT_ID, { totalClasses: 12 });

    expect(classSessionUpdateMany).not.toHaveBeenCalled();
    expect(assignment.totalClasses).toBe(12);
    spy.mockRestore();
  });

  it("500 si posteriormente la asignacion populada no se encuentra (findById null)", async () => {
    const session = buildFakeSession();
    const spy = mockStartSession(session);
    const assignment = buildAssignment({
      status: "completed",
      professor: VALID_PROFESSOR_ID,
      totalClasses: 8,
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    assignedFindById.mockReturnValueOnce(chainableWith(null));

    await expect(reopenAssignment(ASSIGNMENT_ID, {})).rejects.toMatchObject({
      status: 500,
      message: "Error al reabrir el curso",
    });
    spy.mockRestore();
  });
});
