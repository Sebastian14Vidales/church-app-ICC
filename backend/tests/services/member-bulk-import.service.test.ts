import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests unitarios de `member-bulk-import.service.ts` (bulk import de
 * miembros/asistentes desde Excel).
 *
 * Estrategia de mock:
 *   - xlsx.read y xlsx.utils.sheet_to_json se mockean completamente.
 *     sheet_to_json devuelve directamente las rows registradas por cada test.
 *   - SPIRITUAL_GROWTH_STAGES se incluye en el mock de user-profile.model
 *     (es una named export que el service importa).
 *   - UserProfile.find().select() usa la cadena thenable igual que el
 *     patrón de course-assignment.service.test.ts.
 *
 * Sin Mongo real. Sin `console.log`, sin `any`.
 */

// ---- state global para el mock de xlsx -------------------------------------

type SheetRows = (string | number)[][];
let registeredRows: SheetRows = [];

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof import("xlsx")>("xlsx");

  return {
    __esModule: true,
    ...actual,
    read: vi.fn((_buffer: Buffer, _options: unknown) => ({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    })),
    utils: {
      ...actual?.utils,
      sheet_to_json: vi.fn((_sheet: unknown, opts: { header?: number; defval?: string }): unknown[] => {
        if (opts.header === 1) {
          return registeredRows;
        }
        return actual?.utils?.sheet_to_json?.(_sheet, opts) ?? [];
      }),
    },
  };
});

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
}));

// Mock de user-profile.model que incluye SPIRITUAL_GROWTH_STAGES como named export
vi.mock("../../src/models/user-profile.model", () => {
  const chainable = (resolved: unknown) => {
    const self = {
      select: vi.fn(() => self),
      then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
        Promise.resolve(resolved).then(onfulfilled),
    };
    return self;
  };

  const mockFind = vi.fn(() => chainable([]));
  const mockInsertMany = vi.fn();

  return {
    __esModule: true,
    default: { find: mockFind, insertMany: mockInsertMany },
    SPIRITUAL_GROWTH_STAGES: [
      "Consolidación",
      "Discipulado básico",
      "Carácter cristiano",
      "Sanidad y propósito",
      "Cosmovisión bíblica",
      "Finanzas y Gobierno",
      "Doctrina cristiana",
    ],
  };
});

vi.mock("../../src/models/role.model", () => ({
  __esModule: true,
  default: { findOne: vi.fn() },
}));

// ---- acceso tipado a los mocks ------------------------------------------

const UserProfile = await import("../../src/models/user-profile.model").then(m => m.default);
const Role = await import("../../src/models/role.model").then(m => m.default);
const { emitRealtimeInvalidation } = await import("../../src/realtime/socket");
const XLSX = await import("xlsx");

const mockUserFind = UserProfile.find as unknown as ReturnType<typeof vi.fn>;
const mockUserInsertMany = UserProfile.insertMany as unknown as ReturnType<typeof vi.fn>;
const mockRoleFindOne = Role.findOne as unknown as ReturnType<typeof vi.fn>;
const realtimeMock = emitRealtimeInvalidation as unknown as ReturnType<typeof vi.fn>;
const mockXlsxRead = XLSX.read as unknown as ReturnType<typeof vi.fn>;
const mockSheetToJson = XLSX.utils.sheet_to_json as unknown as ReturnType<typeof vi.fn>;

// ---- fixtures -------------------------------------------------------------

const ASISTENTE_ROLE = { _id: "role-id-asistente", name: "Asistente" };

const HEADERS: (string | number)[] = [
  "Nombre",
  "Apellidos",
  "Documento",
  "Fecha de nacimiento",
  "Barrio",
  "Telefono",
  "Tipo de sangre",
  "Sirve en un ministerio",
  "Ministerio en el que sirve",
  "Ministerio de interes",
  "Ruta de crecimiento espiritual",
  "Encuentro y reencuentro",
];

const VALID_ROW_1: (string | number)[] = [
  "Juan",
  "Pérez",
  "12345678",
  "1990-05-15",
  "Barrio Centro",
  "3001234567",
  "O+",
  "Sí",
  "Ministerio de Alabanza",
  "",
  "Consolidación",
  "Ninguno",
];

const VALID_ROW_2: (string | number)[] = [
  "María",
  "García",
  "87654321",
  "1985-03-22",
  "Barrio Norte",
  "3009876543",
  "A-",
  "No",
  "",
  "Ministerio de Jóvenes",
  "Discipulado básico",
  "Encuentro",
];

// ---- helpers de cadena thenable -------------------------------------------

const chainable = (resolved: unknown) => {
  const self = {
    select: vi.fn(() => self),
    then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
      Promise.resolve(resolved).then(onfulfilled),
  };
  return self;
};

// ---- helper para registrar rows mockeados -------------------------------

const registerRows = (rows: SheetRows) => {
  registeredRows = rows;
  mockSheetToJson.mockReturnValue(rows);
};

// ---- tests ---------------------------------------------------------------

import { processBulkImport } from "../../src/services/member-bulk-import.service";

const resetMocks = () => {
  vi.clearAllMocks();
  registeredRows = [];
  // Restore default chainable for UserProfile.find — mockReset clears the
  // mock implementation entirely, por lo que necesitamos redefinir el retorno
  // por defecto para que siempre tenga .select() disponible.
  mockUserFind.mockReset();
  mockUserFind.mockReturnValue(chainable([]));
  mockUserInsertMany.mockReset();
  mockRoleFindOne.mockReset();
  realtimeMock.mockReset();
  mockXlsxRead.mockReset();
  mockSheetToJson.mockReset();
};

describe("member-bulk-import.service — processBulkImport", () => {
  beforeEach(() => {
    resetMocks();
    mockRoleFindOne.mockResolvedValue(ASISTENTE_ROLE);
    mockXlsxRead.mockReturnValue({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } });
    // Por defecto find devuelve array vacío
    mockUserFind.mockReturnValue(chainable([]));
  });

  // ---- CASO 1: Happy path -----------------------------------------------

  it("CASO-1: happy path — 2 filas válidas, ninguna en BD → insertedCount=2, failedCount=0", async () => {
    registerRows([HEADERS, VALID_ROW_1, VALID_ROW_2]);

    // Seqüencia de respuestas para las 3 llamadas a UserProfile.find
    let findCallIndex = 0;
    const findResponses = [
      chainable([]), // (1) dedup: nadie existe
      chainable([
        // (2) re-query post-insert: ambos documentos insertados
        { documentID: "12345678", firstName: "Juan", lastName: "Pérez" },
        { documentID: "87654321", firstName: "María", lastName: "García" },
      ]),
      chainable([
        // (3) final re-query: mismo resultado
        { documentID: "12345678", firstName: "Juan", lastName: "Pérez" },
        { documentID: "87654321", firstName: "María", lastName: "García" },
      ]),
    ];
    mockUserFind.mockImplementation(() => findResponses[findCallIndex++]);

    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.total).toBe(2);
    expect(result.insertedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.inserted).toHaveLength(2);
    expect(result.inserted[0]).toMatchObject({
      row: 2,
      documentID: "12345678",
      firstName: "Juan",
      lastName: "Pérez",
    });
    expect(result.inserted[1]).toMatchObject({
      row: 3,
      documentID: "87654321",
      firstName: "María",
      lastName: "García",
    });
  });

  it("CASO-1b: insertMany se llama con ordered:false y baptized:false y role Asistente", async () => {
    registerRows([HEADERS, VALID_ROW_1]);
    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]));
    mockUserInsertMany.mockResolvedValue([]);

    await processBulkImport(Buffer.from("fake"));

    expect(mockUserInsertMany).toHaveBeenCalled();
    const insertCall = mockUserInsertMany.mock.calls[0];
    expect(insertCall[1]).toEqual(expect.objectContaining({ ordered: false }));

    const docs = insertCall[0] as Array<Record<string, unknown>>;
    docs.forEach((doc) => {
      expect(doc).toHaveProperty("baptized", false);
      expect(doc).toHaveProperty("role", "role-id-asistente");
      expect(doc).not.toHaveProperty("email");
      expect(doc).not.toHaveProperty("user");
    });
  });

  // ---- CASO 2: Duplicado dentro del archivo ------------------------------

  it("CASO-2: duplicado dentro del archivo — primera gana, segunda en errors con 'Documento duplicado en el archivo'", async () => {
    registerRows([
      HEADERS,
      [...VALID_ROW_1],
      [...VALID_ROW_1.slice(0, 2), "12345678", ...VALID_ROW_1.slice(3)],
    ]);
    let findCallIndex = 0;
    mockUserFind.mockImplementation(() => {
      const responses = [
        chainable([]), // dedup: nadie existe
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]), // re-query
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]), // final
      ];
      return responses[findCallIndex++];
    });
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      row: 3,
      documentID: "12345678",
      reason: "Documento duplicado en el archivo",
    });
    expect(result.insertedCount).toBe(1);
  });

  // ---- CASO 3: Duplicado contra BD ---------------------------------------

  it("CASO-3: duplicado contra BD — fila va a errors con 'Ya existe un miembro con este número de documento'", async () => {
    registerRows([HEADERS, VALID_ROW_1]);
    // La query de dedup encuentra el documento existente → candidato descartado
    // No se llama insertMany, no hay re-query de inserted (toInsertCandidates vacío)
    mockUserFind.mockReturnValueOnce(
      chainable([{ documentID: "12345678" }]),
    );

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.total).toBe(1);
    expect(result.insertedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      row: 2,
      documentID: "12345678",
      reason: "Ya existe un miembro con este número de documento",
    });
    expect(mockUserInsertMany).not.toHaveBeenCalled();
  });

  // ---- CASO 4: Enums inválidos -------------------------------------------

  it("CASO-4a: bloodType='X' → error 'El tipo de sangre no es válido'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[6] = "X";
    registerRows([HEADERS, row]);
    // Validity fails at validation → no insert → no re-query needed
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("El tipo de sangre no es válido");
  });

  it("CASO-4b: spiritualGrowthStage='Inventado' → error 'La ruta de crecimiento espiritual no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[10] = "Inventado";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La ruta de crecimiento espiritual no es válida");
  });

  it("CASO-4c: encounterStage='Raro' → error 'El campo Encuentro y Reencuentro no es válido'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[11] = "Raro";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("El campo Encuentro y Reencuentro no es válido");
  });

  // ---- CASO 5: Validaciones de formato -----------------------------------

  it("CASO-5a: documentID con 5 dígitos → error 'El documento debe tener entre 6 y 10 dígitos numéricos'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[2] = "12345";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("El documento debe tener entre 6 y 10 dígitos numéricos");
  });

  it("CASO-5b: phoneNumber con 9 dígitos → error 'El número de teléfono debe tener exactamente 10 dígitos'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[5] = "300123456";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("El número de teléfono debe tener exactamente 10 dígitos");
  });

  it("CASO-5c: birthdate con formato raro '31-12-2026' → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "31-12-2026";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  it("CASO-5d: servesInMinistry='quiza' (no normalizable) → error 'Debes indicar si sirve en un ministerio (Si/No)'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "quiza";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("Debes indicar si sirve en un ministerio (Si/No)");
  });

  // ---- CASO 6: ministry vs ministryInterest -------------------------------

  it("CASO-6a: servesInMinistry=true sin ministry → error 'Debes seleccionar el ministerio en el que sirve'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("Debes seleccionar el ministerio en el que sirve");
  });

  it("CASO-6b: servesInMinistry=false con ministry pero sin ministryInterest → error", async () => {
    const row: (string | number)[] = [...VALID_ROW_2];
    row[7] = "No";
    row[8] = "Ministerio de Alabanza";
    row[9] = "";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("Debes seleccionar el ministerio en el que está interesado");
  });

  // ---- CASO 7: Cabeceras faltantes ---------------------------------------

  it("CASO-7: falta la cabecera 'Documento' → lanza AppError(400)", async () => {
    const headersWithoutDoc = HEADERS.filter((h) => h !== "Documento");
    const row = VALID_ROW_1.slice(1);
    registerRows([headersWithoutDoc as (string | number)[], row as (string | number)[]]);

    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      status: 400,
    });
  });

  // ---- CASO 8: Archivo vacío / sin cuerpo de datos ------------------------

  it("CASO-8a: solo cabecera (1 fila) → lanza AppError(400)", async () => {
    registerRows([HEADERS]);

    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      message: expect.stringContaining("válido"),
    });
  });

  it("CASO-8b: sin hojas → lanza AppError(400)", async () => {
    registerRows([]);
    mockXlsxRead.mockReturnValue({ SheetNames: [], Sheets: {} });

    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      message: expect.stringContaining("válido"),
    });
  });

  // ---- CASO 9: Inserción parcial -----------------------------------------

  it("CASO-9: insertMany partial failure — la fila que falla aparece en errors con reason", async () => {
    registerRows([HEADERS, VALID_ROW_1, VALID_ROW_2]);

    let findCallIndex = 0;
    mockUserFind.mockImplementation(() => {
      const responses = [
        chainable([]), // dedup: nadie existe
        chainable([{ documentID: "87654321", firstName: "María", lastName: "García" }]), // re-query: solo row2
        chainable([{ documentID: "87654321", firstName: "María", lastName: "García" }]), // final: same
      ];
      return responses[findCallIndex++];
    });

    // insertMany falla en la primera fila con un error de duplicate key
    class InsertManyError extends Error {
      writeErrors: Array<{
        err: { op: { documentID: string }; errmsg: string };
      }>;

      constructor() {
        super("bulk write error");
        // La estructura que espera findInsertErrorReason es writeErrors[0].err.op.documentID
        this.writeErrors = [
          {
            err: {
              op: { documentID: "12345678" },
              errmsg: "duplicate key error collection: ICC Casa de Dios index: documentID",
            },
          },
        ];
      }
    }

    mockUserInsertMany.mockRejectedValue(new InsertManyError());

    const result = await processBulkImport(Buffer.from("fake"));

    // Fila 2 (12345678) falla en insert → va a errors con reason no vacío
    const failedRow2 = result.errors.find((e) => e.row === 2);
    expect(failedRow2).toBeDefined();
    expect(typeof failedRow2?.reason).toBe("string");
    expect(failedRow2!.reason.length).toBeGreaterThan(0);
  });

  // ---- Emisión de realtime -------------------------------------------------

  it("emite emitRealtimeInvalidation con members.changed al finalizar", async () => {
    registerRows([HEADERS, VALID_ROW_1]);
    mockUserFind.mockReturnValue(chainable([]));
    mockUserInsertMany.mockResolvedValue([]);

    await processBulkImport(Buffer.from("fake"));

    expect(realtimeMock).toHaveBeenCalledWith(
      "members.changed",
      expect.arrayContaining([["members"]]),
    );
  });
});
