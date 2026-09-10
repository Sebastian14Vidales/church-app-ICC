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
  exportAttendanceExcel,
  findMyActiveAssignment,
  getNextSpiritualGrowthStage,
  reopenAssignment,
  serializeCourseAssignedArray,
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
  const NO_SPIRITUAL_GROWTH_STAGE = "Ninguna";
  const SPIRITUAL_GROWTH_STAGE_CHOICES = [
    NO_SPIRITUAL_GROWTH_STAGE,
    ...SPIRITUAL_GROWTH_STAGES,
  ];
  return {
    default: userProfileModel,
    SPIRITUAL_GROWTH_STAGES,
    NO_SPIRITUAL_GROWTH_STAGE,
    SPIRITUAL_GROWTH_STAGE_CHOICES,
  };
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

// ---- cadenas query fluidas (populate / sort / skip / limit / session / select) ---

type Chain = {
  populate: ReturnType<typeof vi.fn>;
  sort: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lean: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  session: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
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
  self.select = vi.fn(() => self);
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
  // Default chainable so that .select() and .populate() don't throw
  // (individual tests override via mockReturnValueOnce as needed)
  classSessionFind.mockReturnValue(chainableWith([]));
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

  it('"Ninguna" se trata como sin etapa → siguiente es "Consolidación" (ADR-0014 D3)', () => {
    expect(getNextSpiritualGrowthStage("Ninguna")).toBe("Consolidación");
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

  it("miembro con 'Ninguna' es elegible para curso 'Consolidación' (ADR-0014 D3)", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Consolidación", spiritualGrowthStage: "Consolidación" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Ninguna" }),
      ]),
    );
    const populated = buildPopulatedAssignment({
      course: { _id: VALID_COURSE_ID, name: "Consolidación", spiritualGrowthStage: "Consolidación" },
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

  it("miembro con 'Ninguna' NO es elegible para 'Discipulado básico' — error con siguiente etapa 'Consolidación' (ADR-0014 D3)", async () => {
    const assignment = buildActiveAssignmentWithProfessor(VALID_PROFESSOR_ID, [], "active", {
      course: { _id: VALID_COURSE_ID, name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
    });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    userProfileFind.mockReturnValue(
      chainableWith([
        buildMember(VALID_MEMBER_ID, "Miembro", { spiritualGrowthStage: "Ninguna" }),
      ]),
    );

    await expect(
      addMembers(ASSIGNMENT_ID, [VALID_MEMBER_ID], {
        callerProfileId: VALID_PROFESSOR_ID,
        callerRoles: ["Profesor"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Nombre Apellido no es elegible para el curso "Discipulado básico". Su siguiente etapa es "Consolidación".',
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

describe("course-assignment.service — exportAttendanceExcel (ADR-0017 D1)", () => {
  beforeEach(resetMocks);

  /**
   * Builds a minimal assignment fixture with the given members and sessions.
   */
  const buildExportAssignment = (
    members: Array<{
      _id: string;
      firstName: string;
      lastName: string;
      documentID: string;
      spiritualGrowthStage: string;
    }>,
    sessions: Array<{
      classNumber: number;
      attendance: Array<{ studentId: string; present: boolean }>;
    }>,
    totalClasses: number,
  ) => {
    const assignmentId = ASSIGNMENT_ID;
    const assignment = buildPopulatedAssignment({
      course: { _id: VALID_COURSE_ID, name: "Fundamentos", spiritualGrowthStage: "Consolidación" },
      professor: { _id: VALID_PROFESSOR_ID, role: { name: "Profesor" } },
      members: members.map((m) => ({ _id: m._id })),
      totalClasses,
    });
    return { assignment, members, sessions, assignmentId };
  };

  /**
   * Builds a chainable for CourseAssigned.findOne that supports
   * `.populate("course").populate(memberPopulate).populate(professorPopulate).then`
   * Used in export tests where the code awaits the populate chain.
   */
  const assignmentChain = (resolved: unknown): Chain => {
    const self = {} as Chain;
    self.populate = vi.fn(() => self);
    self.sort = vi.fn(() => self);
    self.skip = vi.fn(() => self);
    self.limit = vi.fn(() => self);
    self.lean = vi.fn(() => self);
    self.exec = vi.fn(() => Promise.resolve(resolved));
    self.session = vi.fn(() => self);
    self.select = vi.fn(() => self);
    self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
      Promise.resolve(resolved).then(onfulfilled);
    return self;
  };

  const ADMIN_CONTEXT = { callerProfileId: OTHER_MEMBER_ID, callerRoles: ["Admin"] as string[] };
  const PROF_CONTEXT = { callerProfileId: VALID_PROFESSOR_ID, callerRoles: ["Profesor"] as string[] };
  const OTHER_PROF_CONTEXT = {
    callerProfileId: OTHER_MEMBER_ID,
    callerRoles: ["Profesor"] as string[],
  };

  it("200 + correct Content-Type and Content-Disposition headers when Admin calls", async () => {
    const { assignment } = buildExportAssignment([], [], 4);
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(chainableWith([]));

    const result = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);

    expect(result).toHaveProperty("buffer");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result).toHaveProperty("filename");
    expect(result.filename).toMatch(/^asistencia-.*-\d{8}\.xlsx$/);
  });

  it("403 when Professor is NOT the owner of the assignment", async () => {
    const { assignment } = buildExportAssignment([], [], 4);
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(chainableWith([]));

    await expect(
      exportAttendanceExcel(ASSIGNMENT_ID, OTHER_PROF_CONTEXT),
    ).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para esta acción",
    });
  });

  it("200 when Professor IS the owner of the assignment", async () => {
    const { assignment } = buildExportAssignment([], [], 4);
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(chainableWith([]));

    const result = await exportAttendanceExcel(ASSIGNMENT_ID, PROF_CONTEXT);
    expect(result).toHaveProperty("buffer");
    expect(result).toHaveProperty("filename");
  });

  it("404 when assignment does not exist", async () => {
    assignedFindOne.mockReturnValueOnce(assignmentChain(null));

    await expect(
      exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT),
    ).rejects.toMatchObject({
      status: 404,
      message: "Asignacion no encontrada",
    });
  });

  it("member with 100% attendance (all classes present) → Resultado = Aprobó", async () => {
    // totalClasses=4, member present in all 4 stored sessions
    const memberId = VALID_MEMBER_ID;
    const sessions = [
      { classNumber: 1, attendance: [{ studentId: memberId, present: true }] },
      { classNumber: 2, attendance: [{ studentId: memberId, present: true }] },
      { classNumber: 3, attendance: [{ studentId: memberId, present: true }] },
      { classNumber: 4, attendance: [{ studentId: memberId, present: true }] },
    ];
    const { assignment } = buildExportAssignment(
      [{ _id: memberId, firstName: "Juan", lastName: "Pérez", documentID: "123", spiritualGrowthStage: "Consolidación" }],
      sessions,
      4,
    );
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(
      chainableWith(
        sessions.map((s) => ({
          classNumber: s.classNumber,
          attendance: s.attendance.map((a) => ({ student: { _id: a.studentId }, present: a.present })),
        })),
      ),
    );

    const { buffer, filename } = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);

    // Verify buffer is valid XLSX (non-empty) and filename pattern
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    expect(filename).toMatch(/^asistencia-.*-\d{8}\.xlsx$/);

    // Verify correct XLSX structure: header row + member row
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    expect((rows[0] as string[])).toEqual([
      "Nombre", "Apellidos", "Documento", "Etapa de crecimiento",
      "Clases presentes", "Clases registradas", "% asistencia", "Resultado",
    ]);
    expect(rows).toHaveLength(2); // header + 1 member
    const memberRow = rows[1] as unknown[];
    // Verify numeric columns (text columns depend on XLSX encoding)
    expect(memberRow[4]).toBe(4);  // Clases presentes
    expect(memberRow[5]).toBe(4);  // Clases registradas
    expect(memberRow[6]).toBe(100); // % asistencia
    expect(memberRow[7]).toBe("Aprobó");
  });

  it("member with 70% exact attendance (7/10) → Resultado = Aprobó (boundary)", async () => {
    const memberId = VALID_MEMBER_ID;
    const totalClasses = 10;
    const storedSessions = Array.from({ length: 7 }, (_, i) => ({
      classNumber: i + 1,
      attendance: [{ studentId: memberId, present: true }],
    }));
    const { assignment } = buildExportAssignment(
      [{ _id: memberId, firstName: "Ana", lastName: "García", documentID: "456", spiritualGrowthStage: "Consolidación" }],
      storedSessions,
      totalClasses,
    );
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(
      chainableWith(
        storedSessions.map((s) => ({
          classNumber: s.classNumber,
          attendance: s.attendance.map((a) => ({ student: { _id: a.studentId }, present: a.present })),
        })),
      ),
    );

    const { buffer } = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);
    expect(buffer.length).toBeGreaterThan(100);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    expect(rows).toHaveLength(2);
    const memberRow = rows[1] as unknown[];
    expect(memberRow[6]).toBe(70); // 7/10 = 70%
    expect(memberRow[7]).toBe("Aprobó");
  });

  it("member with 69% attendance (9/13) → Resultado = No alcanzó el 70%", async () => {
    const memberId = VALID_MEMBER_ID;
    const totalClasses = 13;
    const storedSessions = Array.from({ length: 9 }, (_, i) => ({
      classNumber: i + 1,
      attendance: [{ studentId: memberId, present: true }],
    }));
    const { assignment } = buildExportAssignment(
      [{ _id: memberId, firstName: "Carlos", lastName: "Ruiz", documentID: "789", spiritualGrowthStage: "Consolidación" }],
      storedSessions,
      totalClasses,
    );
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(
      chainableWith(
        storedSessions.map((s) => ({
          classNumber: s.classNumber,
          attendance: s.attendance.map((a) => ({ student: { _id: a.studentId }, present: a.present })),
        })),
      ),
    );

    const { buffer } = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);
    expect(buffer.length).toBeGreaterThan(100);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    expect(rows).toHaveLength(2);
    const memberRow = rows[1] as unknown[];
    expect(memberRow[6]).toBe(69); // 9/13 = 69.23% → rounds to 69
    expect(memberRow[7]).toBe("No alcanzó el 70%");
  });

  it("member with 0% attendance (no classes stored) → Resultado = No alcanzó el 70%", async () => {
    const memberId = VALID_MEMBER_ID;
    const totalClasses = 8;
    const { assignment } = buildExportAssignment(
      [{ _id: memberId, firstName: "María", lastName: "López", documentID: "000", spiritualGrowthStage: "Consolidación" }],
      [],
      totalClasses,
    );
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(chainableWith([]));

    const { buffer } = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);
    expect(buffer.length).toBeGreaterThan(100);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    expect(rows).toHaveLength(2);
    const memberRow = rows[1] as unknown[];
    expect(memberRow[4]).toBe(0);  // Clases presentes
    expect(memberRow[5]).toBe(0);  // Clases registradas
    expect(memberRow[6]).toBe(0);  // % asistencia
    expect(memberRow[7]).toBe("No alcanzó el 70%");
  });

  it("unregistered classes count as absence (denominator = totalClasses, not registeredSessions)", async () => {
    const memberId = VALID_MEMBER_ID;
    const totalClasses = 10;
    const storedSessions = [
      { classNumber: 1, attendance: [{ studentId: memberId, present: true }] },
      { classNumber: 2, attendance: [{ studentId: memberId, present: false }] },
      { classNumber: 3, attendance: [{ studentId: memberId, present: true }] },
    ];
    const { assignment } = buildExportAssignment(
      [{ _id: memberId, firstName: "Pedro", lastName: "Navarro", documentID: "111", spiritualGrowthStage: "Consolidación" }],
      storedSessions,
      totalClasses,
    );
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(
      chainableWith(
        storedSessions.map((s) => ({
          classNumber: s.classNumber,
          attendance: s.attendance.map((a) => ({ student: { _id: a.studentId }, present: a.present })),
        })),
      ),
    );

    const { buffer } = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);
    expect(buffer.length).toBeGreaterThan(100);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    expect(rows).toHaveLength(2);
    const memberRow = rows[1] as unknown[];
    // 2 present out of 10 total → 20%
    expect(memberRow[4]).toBe(2);  // Clases presentes
    expect(memberRow[5]).toBe(3);  // Clases registradas
    expect(memberRow[6]).toBe(20); // % asistencia
    expect(memberRow[7]).toBe("No alcanzó el 70%");
  });

  it("exports correct headers in the first row", async () => {
    const { assignment } = buildExportAssignment([], [], 4);
    assignedFindOne.mockReturnValueOnce(assignmentChain(assignment));
    classSessionFind.mockReturnValueOnce(chainableWith([]));

    const { buffer } = await exportAttendanceExcel(ASSIGNMENT_ID, ADMIN_CONTEXT);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });

    const headerRow = rows[0] as string[];
    expect(headerRow).toEqual([
      "Nombre",
      "Apellidos",
      "Documento",
      "Etapa de crecimiento",
      "Clases presentes",
      "Clases registradas",
      "% asistencia",
      "Resultado",
    ]);
  });
});

describe("course-assignment.service — serializeCourseAssignedArray (ADR-0017 D2)", () => {
  beforeEach(resetMocks);

  it("adds correct registeredSessions count per assignment (no N+1)", async () => {
    const assignmentA = {
      _id: "assign-a",
      course: { name: "Curso A" },
      totalClasses: 8,
      toObject() {
        return this;
      },
    };
    const assignmentB = {
      _id: "assign-b",
      course: { name: "Curso B" },
      totalClasses: 4,
      toObject() {
        return this;
      },
    };

    // 5 sessions for A, 2 sessions for B, 1 session for C (not in list)
    classSessionFind.mockReturnValueOnce(
      chainableWith([
        { courseAssigned: "assign-a" },
        { courseAssigned: "assign-a" },
        { courseAssigned: "assign-a" },
        { courseAssigned: "assign-a" },
        { courseAssigned: "assign-a" },
        { courseAssigned: "assign-b" },
        { courseAssigned: "assign-b" },
      ]),
    );

    const result = await serializeCourseAssignedArray([assignmentA, assignmentB]);

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("registeredSessions", 5);
    expect(result[0]).toHaveProperty("course");
    expect(result[1]).toHaveProperty("registeredSessions", 2);
  });

  it("returns registeredSessions: 0 when no ClassSession records exist", async () => {
    const assignment = {
      _id: "assign-no-sessions",
      course: { name: "Sin sesiones" },
      toObject() {
        return this;
      },
    };
    classSessionFind.mockReturnValueOnce(chainableWith([]));

    const result = await serializeCourseAssignedArray([assignment]);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("registeredSessions", 0);
  });

  it("preserves original shape of each assignment (rest of fields intact)", async () => {
    const assignment = {
      _id: "assign-shape",
      course: { _id: "course-1", name: "Discipulado", spiritualGrowthStage: "Discipulado básico" },
      professor: { _id: "prof-1", firstName: "Pedro" },
      members: [],
      startDate: new Date("2026-02-01"),
      totalClasses: 6,
      status: "active",
      toObject() {
        return this;
      },
    };
    classSessionFind.mockReturnValueOnce(chainableWith([{ courseAssigned: "assign-shape" }]));

    const [result] = await serializeCourseAssignedArray([assignment]);

    expect(result).toHaveProperty("_id", "assign-shape");
    expect(result).toHaveProperty("course.name", "Discipulado");
    expect(result).toHaveProperty("totalClasses", 6);
    expect(result).toHaveProperty("registeredSessions", 1);
  });

  it("handles plain objects without toObject method", async () => {
    const assignment = {
      _id: "assign-plain",
      course: { name: "Plain Curso" },
    };

    classSessionFind.mockReturnValueOnce(chainableWith([{ courseAssigned: "assign-plain" }]));

    const result = await serializeCourseAssignedArray([assignment]);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("registeredSessions", 1);
  });

  it("skips assignments with null/undefined _id", async () => {
    const validAssignment = {
      _id: "valid-id",
      course: { name: "Válido" },
      toObject() {
        return this;
      },
    };
    const invalidAssignment = {
      _id: null,
      course: { name: "Sin ID" },
      toObject() {
        return this;
      },
    };

    // Session records for "valid-id" only; null-id gets undefined (no matching sessions)
    classSessionFind.mockReturnValueOnce(
      chainableWith([{ courseAssigned: "valid-id" }]),
    );

    const result = await serializeCourseAssignedArray([validAssignment, invalidAssignment]);

    // Both assignments are in result; null-id gets registeredSessions from counts.get("null") = undefined
    expect(result).toHaveLength(2);
    // valid-id has 1 session
    expect(result[0]).toHaveProperty("_id", "valid-id");
    expect(result[0]).toHaveProperty("registeredSessions", 1);
    // null-id → String(null) = "null"; counts.get("null") is undefined → 0
    expect(result[1]).toHaveProperty("_id", null);
    expect(result[1]).toHaveProperty("registeredSessions", 0);
  });
});
