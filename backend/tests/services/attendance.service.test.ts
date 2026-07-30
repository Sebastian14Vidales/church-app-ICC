import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  getMyActiveAssignmentOverview,
  saveAttendance,
  type AttendanceEntry,
  type SaveAttendanceBody,
} from "../../src/services/attendance.service";
import { AppError } from "../../src/services/app-error";

/**
 * Tests unitarios de `attendance.service.ts` (introducido en EPC-COURSES-001
 * paso 5). Cubre el overview generado (sesiones on-demand con `_id: null`)
 * y todas las validaciones de `saveAttendance` (404/400 + happy path).
 * Sin Mongo real; sin console.log; sin any.
 */

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
}));

vi.mock("../../src/models/course-assigned.model", () => {
  const courseAssignedModel = {
    findOne: vi.fn(),
  };
  return { default: courseAssignedModel };
});

vi.mock("../../src/models/class-session.model", () => {
  const classSessionModel = {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  };
  return { default: classSessionModel };
});

vi.mock("../../src/models/user-profile.model", async (importOriginal) => {
  const userProfileModel = {
    find: vi.fn(),
    findById: vi.fn(),
  };
  const actual = await importOriginal<typeof import("../../src/models/user-profile.model")>();
  return {
    ...actual,
    default: userProfileModel,
  };
});

import CourseAssigned from "../../src/models/course-assigned.model";
import ClassSession from "../../src/models/class-session.model";
import { emitRealtimeInvalidation } from "../../src/realtime/socket";

const assignedFindOne = CourseAssigned.findOne as unknown as ReturnType<typeof vi.fn>;
const classSessionFind = ClassSession.find as unknown as ReturnType<typeof vi.fn>;
const classSessionFindOneAndUpdate =
  ClassSession.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const realtimeMock = emitRealtimeInvalidation as unknown as ReturnType<typeof vi.fn>;

// ---- cadena fluida con populate/sort/lean/exec ---------------------------

type Chain = {
  populate: ReturnType<typeof vi.fn>;
  sort: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lean: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
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
  self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
    Promise.resolve(resolved).then(onfulfilled);
  return self;
};

// ---- fixtures -----------------------------------------------------------

const PROFESSOR_ID = "65a1f0c0c1d2a3b4f5e6f7a9";
const ASSIGNMENT_ID = "65a1f0c0c1d2a3b4f5e6f7c0";
const STUDENT_A = "65a1f0c0c1d2a3b4f5e6f7b1";
const STUDENT_B = "65a1f0c0c1d2a3b4f5e6f7b2";

const buildAssignment = (overrides: Record<string, unknown> = {}) => ({
  _id: ASSIGNMENT_ID,
  professor: PROFESSOR_ID,
  members: [{ _id: STUDENT_A }, { _id: STUDENT_B }],
  startDate: new Date("2026-02-01"),
  totalClasses: 4,
  ...overrides,
});

const buildStoredSession = (overrides: Record<string, unknown> = {}) => ({
  _id: "65a1f0c0c1d2a3b4f5e6f7d0",
  classNumber: 1,
  date: new Date("2026-02-01"),
  topic: "Tema",
  observations: "Obs",
  updatedAt: new Date("2026-02-01T22:30:00.000Z"),
  attendance: [
    {
      student: { _id: STUDENT_A },
      present: true,
      notes: "puntual",
    },
  ],
  ...overrides,
});

const resetMocks = () => {
  assignedFindOne.mockReset();
  classSessionFind.mockReset();
  classSessionFindOneAndUpdate.mockReset();
  realtimeMock.mockReset();
};

describe("attendance.service — getMyActiveAssignmentOverview", () => {
  beforeEach(resetMocks);

  it("devuelve { assignment: null, sessions: [] } cuando no hay activa", async () => {
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    const result = await getMyActiveAssignmentOverview(PROFESSOR_ID);
    expect(result).toEqual({ assignment: null, sessions: [] });
  });

  it("genera sesiones 1..totalClasses con storedSession consolidada y sesiones no guardadas", async () => {
    const assignment = buildAssignment({ totalClasses: 3 });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    const stored = buildStoredSession({ classNumber: 1, attendance: [{ student: { _id: STUDENT_A }, present: true, notes: "puntual" }] });
    classSessionFind.mockReturnValueOnce(chainableWith([stored]));

    const result = await getMyActiveAssignmentOverview(PROFESSOR_ID);

    expect(result.assignment).toBe(assignment);
    expect(Array.isArray(result.sessions)).toBe(true);
    expect(result.sessions).toHaveLength(3);

    // Sesion 1: stored -> trae _id, topic, attendance
    const session1 = result.sessions[0] as { _id: string; classNumber: number; topic: string; attendance: Array<{ student: unknown; present: boolean; notes: string }> };
    expect(session1._id).toBe(String(stored._id));
    expect(session1.classNumber).toBe(1);
    expect(session1.topic).toBe("Tema");
    expect(session1.attendance).toHaveLength(1);
    expect(session1.attendance[0].present).toBe(true);

    // Sesion 2 y 3: generadas -> _id null, topic, attendance []
    const session2 = result.sessions[1] as { _id: string | null; topic: string; attendance: unknown[]; date: string };
    expect(session2._id).toBeNull();
    expect(session2.topic).toBe("");
    expect(session2.attendance).toEqual([]);
    // date = startDate + (2-1)*7 dias = 2026-02-08
    expect(session2.date).toBe(new Date("2026-02-08").toISOString());
  });

  it("mapea attendance stored sin notes -> notes ''", async () => {
    const assignment = buildAssignment({ totalClasses: 1 });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    classSessionFind.mockReturnValueOnce(
      chainableWith([
        buildStoredSession({
          attendance: [{ student: { _id: STUDENT_A }, present: false }],
        }),
      ]),
    );

    const result = await getMyActiveAssignmentOverview(PROFESSOR_ID);
    const session1 = result.sessions[0] as { attendance: Array<{ notes: string }> };
    expect(session1.attendance[0].notes).toBe("");
  });
});

describe("attendance.service — saveAttendance", () => {
  beforeEach(resetMocks);

  const bodyWith = (attendance: AttendanceEntry[]): SaveAttendanceBody => ({
    attendance,
    topic: "Introducción",
    observations: "ok",
  });

  const mockActiveAssignment = () => {
    const assignment = buildAssignment();
    // findMyActiveAssignment → CourseAssigned.findOne(...).populate chain
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    return assignment;
  };

  it("404 si el profesor no tiene curso activo", async () => {
    assignedFindOne.mockReturnValueOnce(chainableWith(null));
    const body: SaveAttendanceBody = { attendance: [] };
    await expect(
      saveAttendance(PROFESSOR_ID, "1", body),
    ).rejects.toMatchObject({
      status: 404,
      message: "No tienes un curso activo asignado",
    });
  });

  it("400 si classNumber no es entero positivo (0)", async () => {
    mockActiveAssignment();
    await expect(
      saveAttendance(PROFESSOR_ID, "0", bodyWith([])),
    ).rejects.toMatchObject({
      status: 400,
      message: "El numero de clase no es valido",
    });
  });

  it("400 si classNumber > totalClasses", async () => {
    mockActiveAssignment(); // totalClasses = 4
    await expect(
      saveAttendance(PROFESSOR_ID, "5", bodyWith([])),
    ).rejects.toMatchObject({
      status: 400,
      message: "La clase seleccionada no existe en este curso",
    });
  });

  it("400 si hay estudiantes repetidos", async () => {
    mockActiveAssignment();
    const dup: AttendanceEntry[] = [
      { studentId: STUDENT_A, present: true },
      { studentId: STUDENT_A, present: false },
    ];
    await expect(
      saveAttendance(PROFESSOR_ID, "1", bodyWith(dup)),
    ).rejects.toMatchObject({
      status: 400,
      message: "No puedes repetir estudiantes en la asistencia",
    });
  });

  it("400 si un estudiante no pertenece a la asignacion", async () => {
    mockActiveAssignment();
    const externalId = "65a1f0c0c1d2a3b4f5e6f7ff";
    const external: AttendanceEntry[] = [
      { studentId: STUDENT_A, present: true },
      { studentId: STUDENT_B, present: false },
      { studentId: externalId, present: true },
    ];
    await expect(
      saveAttendance(PROFESSOR_ID, "1", bodyWith(external)),
    ).rejects.toMatchObject({
      status: 400,
      message: "Solo puedes registrar asistencia de miembros de tu curso",
    });
  });

  it("400 si la cantidad != members", async () => {
    mockActiveAssignment(); // 2 members
    const subset: AttendanceEntry[] = [{ studentId: STUDENT_A, present: true }];
    await expect(
      saveAttendance(PROFESSOR_ID, "1", bodyWith(subset)),
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Debes registrar la asistencia de todos los miembros inscritos en la clase",
    });
  });

  it("happy path: clase dentro de rango, asistencia completa, llama findOneAndUpdate upsert + realtime", async () => {
    const assignment = mockActiveAssignment();
    const attendance: AttendanceEntry[] = [
      { studentId: STUDENT_A, present: true, notes: "puntual" },
      { studentId: STUDENT_B, present: false },
    ];
    const savedSession = { _id: "65a1f0c0c1d2a3b4f5e6f7d0", classNumber: 2 };
    classSessionFindOneAndUpdate.mockReturnValueOnce(chainableWith(savedSession));

    const result = await saveAttendance(PROFESSOR_ID, "2", bodyWith(attendance));

    expect(result).toBe(savedSession);
    // attendance ordenada por el orden de members de la asignacion
    expect(classSessionFindOneAndUpdate).toHaveBeenCalledWith(
      { courseAssigned: assignment._id, classNumber: 2 },
      expect.objectContaining({
        courseAssigned: assignment._id,
        classNumber: 2,
        topic: "Introducción",
        observations: "ok",
        attendance: [
          { student: STUDENT_A, present: true, notes: "puntual" },
          { student: STUDENT_B, present: false, notes: undefined },
        ],
      }),
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    expect(realtimeMock).toHaveBeenCalledWith("attendance.changed", expect.any(Array));
  });

  it("filtra entradas con datos invalidos (studentId no string o present no boolean)", async () => {
    mockActiveAssignment();
    // Una entrada valida y otra invalida -> filtrada antes del unique-check.
    // Con 1 valida sobre 2 members -> count mismatch 400 (rama valida).
    const mixed = [
      { studentId: STUDENT_A, present: true },
      { studentId: 123, present: true },
    ] as unknown as AttendanceEntry[];
    await expect(
      saveAttendance(PROFESSOR_ID, "1", bodyWith(mixed)),
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Debes registrar la asistencia de todos los miembros inscritos en la clase",
    });
  });

  it("toma attendance ausente como [] y members vacios -> happy sin assertions", async () => {
    const assignment = buildAssignment({ members: [] });
    assignedFindOne.mockReturnValueOnce(chainableWith(assignment));
    const savedSession = { _id: "65a1f0c0c1d2a3b4f5e6f7d0" };
    classSessionFindOneAndUpdate.mockReturnValueOnce(chainableWith(savedSession));

    const result = await saveAttendance(PROFESSOR_ID, "1", { topic: "X" });
    expect(result).toBe(savedSession);
    expect(classSessionFindOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        attendance: [],
        topic: "X",
        observations: undefined,
      }),
      expect.any(Object),
    );
  });
});