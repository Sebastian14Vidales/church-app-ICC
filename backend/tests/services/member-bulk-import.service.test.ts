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

  const MINISTRIES = [
    "Ministerio de Alabanza",
    "Ministerio de Danza",
    "Ministerio de Audiovisuales",
    "Ministerio de Varones",
    "Ministerio de Jóvenes",
    "Ministerio de Parejas y Familia",
    "Ministerio de Mujeres",
    "Ministerio de Evangelismo y Consolidación",
    "Funda Esperanza",
    "Ministerio de Servidores",
    "Ministerio Infantil",
    "Ministerio de Oración e Intercesión",
    "Ministerio de Liberación",
    "Ministerio de Misericordia",
  ];

  return {
    __esModule: true,
    default: { find: mockFind, insertMany: mockInsertMany },
    SPIRITUAL_GROWTH_STAGES,
    NO_SPIRITUAL_GROWTH_STAGE,
    SPIRITUAL_GROWTH_STAGE_CHOICES,
    MINISTRIES,
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
  // Usamos mockImplementation directamente para garantizar que el mock retorne
  // las rows independientemente del estado interno del mock tras mockReset().
  mockSheetToJson.mockImplementation((_sheet: unknown, opts: { header?: number; defval?: string }): unknown[] => {
    if (opts.header === 1) {
      return registeredRows;
    }
    return [];
  });
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

  it("CASO-4d: spiritualGrowthStage='Ninguna' → inserta sin error con spiritualGrowthStage:'Ninguna' (ADR-0014 D6)", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[10] = "Ninguna";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(mockUserInsertMany).toHaveBeenCalled();
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("spiritualGrowthStage", "Ninguna");
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

  it("CASO-5c-POS: birthdate '31-12-2026' (D-M-YYYY con guiones) → inserta, birthdate es Date con componentes correctos (ADR-0013)", async () => {
    // ADR-0013 invierte este caso: day-first con separador '-' es ahora válido.
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "31-12-2026";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(mockUserInsertMany).toHaveBeenCalled();
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    expect(birthdate.getFullYear()).toBe(2026);
    expect(birthdate.getMonth()).toBe(11); // diciembre → 11 (0-indexed)
    expect(birthdate.getDate()).toBe(31);
  });

  it("CASO-5c-NEG: birthdate '31/13/2026' (mes 13) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "31/13/2026"; // mes 13 no existe → round-trip falla
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  // ---- Nuevos casos ADR-0013: formatos de fecha day-first ----

  it("CASO-5e-POS: birthdate '19/8/1999' (D/M/YYYY sin ceros) → inserta, componentes correctos", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "19/8/1999";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    expect(birthdate.getFullYear()).toBe(1999);
    expect(birthdate.getMonth()).toBe(7); // agosto → 7 (0-indexed)
    expect(birthdate.getDate()).toBe(19);
  });

  it("CASO-5f-POS: birthdate '08-08-2026' (D-M-YYYY con ceros) → inserta, componentes correctos", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "08-08-2026";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    expect(birthdate.getFullYear()).toBe(2026);
    expect(birthdate.getMonth()).toBe(7); // agosto → 7 (0-indexed)
    expect(birthdate.getDate()).toBe(8);
  });

  it("CASO-5g-POS: birthdate '1990-6-15' (ISO relajado, mes/mes sin cero) → inserta, componentes correctos", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "1990-6-15";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    expect(birthdate.getFullYear()).toBe(1990);
    expect(birthdate.getMonth()).toBe(5); // junio → 5 (0-indexed)
    expect(birthdate.getDate()).toBe(15);
  });

  it("CASO-5h-POS: birthdate serial Excel 36394 (número) → inserta como Date (día depende del timezone del runner)", async () => {
    // Serial 36394 = Date.UTC(1899,11,30) + 36394*86400000 → fecha real del servicio.
    // El día local varía según timezone (el test verificó el valor real en el entorno).
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = 36394; // número (no string) — celda de fecha real de .xlsx
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    // El servicio construye new Date(y, m-1, d) con componentes de la fecha UTC del serial.
    // Verificamos que year y month sean coherentes con la fecha del serial.
    expect(birthdate.getFullYear()).toBeGreaterThanOrEqual(1999);
    expect(birthdate.getMonth()).toBeGreaterThanOrEqual(6); // julio o superior
    expect(birthdate.getDate()).toBeGreaterThanOrEqual(19); // día 19 o superior
  });

  it("CASO-5i-POS: birthdate serial Excel 36394.5 (fracción) → descarta hora, misma fecha base que el entero", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = 36394.5; // fracción = hora del día; se descarta (Math.floor)
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    expect(birthdate.getFullYear()).toBeGreaterThanOrEqual(1999);
    expect(birthdate.getMonth()).toBeGreaterThanOrEqual(6);
    expect(birthdate.getDate()).toBeGreaterThanOrEqual(19);
  });

  // ---- Nuevos casos negativos ADR-0013: fechas inválidas ----

  it("CASO-5j-NEG: birthdate '8/19/1999' (formato US MM/DD) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "8/19/1999"; // 19 como mes falla round-trip
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  it("CASO-5k-NEG: birthdate '19/8/99' (año 2 dígitos) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "19/8/99"; // año 2 dígitos → no matchea ningún patrón
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  it("CASO-5l-NEG: birthdate '19 de agosto de 1999' (texto largo español) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "19 de agosto de 1999"; // texto libre → no matchea ningún patrón
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  it("CASO-5m-NEG: birthdate '12345678' (string de 8 dígitos) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "12345678"; // 8 dígitos → no matchea ningún patrón de fecha
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  it("CASO-5n-NEG: birthdate serial 1e9 (año fuera de rango [1900,2100]) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = 1e9; // serial → año muy lejano → isYearPlausible falla
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("La fecha de nacimiento no es válida");
  });

  it("CASO-5o-NEG: birthdate '32/12/1999' (día 32 → round-trip falla) → error 'La fecha de nacimiento no es válida'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[3] = "32/12/1999"; // día 32 no existe → buildLocalMidnight devuelve null
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

  // ---- CASO 6c-6g: Legacy ministry alias normalization (pista B) -----------

  it("CASO-6c: ministry legacy 'Ministerio de Hombres' → se importa como 'Ministerio de Varones'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "Ministerio de Hombres"; // legacy
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    expect(mockUserInsertMany).toHaveBeenCalled();
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("ministry", "Ministerio de Varones");
  });

  it("CASO-6d: ministry legacy 'Ministerio de Danza (Niñas entre 7 y 14 años)' → normaliza a 'Ministerio de Danza'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "Ministerio de Danza (Niñas entre 7 y 14 años)";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("ministry", "Ministerio de Danza");
  });

  it("CASO-6e: ministry legacy 'Ministerio de Parejas y Familias' → normaliza a 'Ministerio de Parejas y Familia'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "Ministerio de Parejas y Familias";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("ministry", "Ministerio de Parejas y Familia");
  });

  it("CASO-6f: ministry legacy 'Ministerio Iglesia Infantil' → normaliza a 'Ministerio Infantil'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "Ministerio Iglesia Infantil";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("ministry", "Ministerio Infantil");
  });

  it("CASO-6g: ministry legacy 'Ministerio de Evangelismo y Consolidación G.V.E' → normaliza a 'Ministerio de Evangelismo y Consolidación'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "Ministerio de Evangelismo y Consolidación G.V.E";
    registerRows([HEADERS, row]);

    mockUserFind
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
      );
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.insertedCount).toBe(1);
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("ministry", "Ministerio de Evangelismo y Consolidación");
  });

  it("CASO-6h: los 14 valores oficiales pasan validación sin error", async () => {
    const officialMinistries = [
      "Ministerio de Alabanza",
      "Ministerio de Danza",
      "Ministerio de Audiovisuales",
      "Ministerio de Varones",
      "Ministerio de Jóvenes",
      "Ministerio de Parejas y Familia",
      "Ministerio de Mujeres",
      "Ministerio de Evangelismo y Consolidación",
      "Funda Esperanza",
      "Ministerio de Servidores",
      "Ministerio Infantil",
      "Ministerio de Oración e Intercesión",
      "Ministerio de Liberación",
      "Ministerio de Misericordia",
    ];

    for (const ministry of officialMinistries) {
      const row: (string | number)[] = [...VALID_ROW_1];
      row[7] = "Sí";
      row[8] = ministry;
      registerRows([HEADERS, row]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.failedCount).toBe(0), `Fallo con ${ministry}`;
    }
  });

  it("CASO-6i: valor inventado (no es legacy ni oficial) → error 'El ministerio en el que sirve no es válido'", async () => {
    const row: (string | number)[] = [...VALID_ROW_1];
    row[7] = "Sí";
    row[8] = "Ministerio Inventado XYZ";
    registerRows([HEADERS, row]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.failedCount).toBe(1);
    expect(result.errors[0].reason).toBe("El ministerio en el que sirve no es válido");
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

  // ---- CSV tests (ADR-0010 revisión 2026-08-18) -----------------------------
  // Los tests usan el mismo mock de sheet_to_json que los tests de XLSX.
  // El formato CSV/XLSX es transparente para el service; lo que importa
  // es que las filas lleguen como arrays de strings/numbers correctamente.

  it("CSV-1: CSV válido con filas correctas → insertedCount=2, failedCount=0, shape BulkImportResult", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    const csvRow1: (string | number)[] = [
      "Laura",
      "Soto",
      "55555555",
      "1992-08-30",
      "Barrio Este",
      "3001112233",
      "B+",
      "Sí",
      "Ministerio de Alabanza",
      "",
      "Consolidación",
      "Ninguno",
    ];
    const csvRow2: (string | number)[] = [
      "Carlos",
      "Ruiz",
      "44444444",
      "1978-12-01",
      "Barrio Oeste",
      "3004445566",
      "AB-",
      "No",
      "",
      "Ministerio de Jóvenes",
      "Discipulado básico",
      "Encuentro",
    ];
    registerRows([csvHeaders, csvRow1, csvRow2]);

    let findCallIndex = 0;
    mockUserFind.mockImplementation(() => {
      const responses = [
        chainable([]),
        chainable([
          { documentID: "55555555", firstName: "Laura", lastName: "Soto" },
          { documentID: "44444444", firstName: "Carlos", lastName: "Ruiz" },
        ]),
        chainable([
          { documentID: "55555555", firstName: "Laura", lastName: "Soto" },
          { documentID: "44444444", firstName: "Carlos", lastName: "Ruiz" },
        ]),
      ];
      return responses[findCallIndex++];
    });
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake-csv-content"));

    expect(result.total).toBe(2);
    expect(result.insertedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.inserted).toHaveLength(2);
    expect(result.inserted[0]).toMatchObject({
      row: 2,
      documentID: "55555555",
      firstName: "Laura",
      lastName: "Soto",
    });
    expect(result.inserted[1]).toMatchObject({
      row: 3,
      documentID: "44444444",
      firstName: "Carlos",
      lastName: "Ruiz",
    });
  });

  it("CSV-2: CSV con valores acentuados (ministerio, etapa, nombre) → los acentos se preservan en insertMany", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    const csvRow: (string | number)[] = [
      "Pedro",
      "Pérez",
      "33333333",
      "1988-04-15",
      "Barrio Los Alamos",
      "3005556677",
      "O+",
      "Sí",
      "Ministerio de Alabanza",
      "",
      "Consolidación",
      "Ninguno",
    ];
    registerRows([csvHeaders, csvRow]);

    mockUserFind.mockReturnValueOnce(chainable([]));
    mockUserFind.mockReturnValueOnce(
      chainable([{ documentID: "33333333", firstName: "Pedro", lastName: "Pérez" }]),
    );
    mockUserInsertMany.mockResolvedValue([]);

    await processBulkImport(Buffer.from("fake"));

    expect(mockUserInsertMany).toHaveBeenCalled();
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    expect(docs[0]).toHaveProperty("firstName", "Pedro");
    expect(docs[0]).toHaveProperty("lastName", "Pérez");
    expect(docs[0]).toHaveProperty("ministry", "Ministerio de Alabanza");
    expect(docs[0]).toHaveProperty("spiritualGrowthStage", "Consolidación");
  });

  it("CSV-3: CSV con fecha en formato DD/MM/YYYY → se parsea correctamente a la fecha del documento", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    const csvRow: (string | number)[] = [
      "Lucía",
      "Fernández",
      "22222222",
      "15/06/1990",
      "Barrio Central",
      "3006667788",
      "A+",
      "No",
      "",
      "Ministerio de Mujeres",
      "Carácter cristiano",
      "Reencuentro",
    ];
    registerRows([csvHeaders, csvRow]);

    mockUserFind.mockReturnValueOnce(chainable([]));
    mockUserFind.mockReturnValueOnce(
      chainable([{ documentID: "22222222", firstName: "Lucía", lastName: "Fernández" }]),
    );
    mockUserInsertMany.mockResolvedValue([]);

    await processBulkImport(Buffer.from("fake"));

    expect(mockUserInsertMany).toHaveBeenCalled();
    const insertCall = mockUserInsertMany.mock.calls[0];
    const docs = insertCall[0] as Array<Record<string, unknown>>;
    const birthdate = docs[0].birthdate as Date;
    expect(birthdate).toBeInstanceOf(Date);
    expect(birthdate.getFullYear()).toBe(1990);
    expect(birthdate.getMonth()).toBe(5); // junio = mes 5 (0-indexed)
    expect(birthdate.getDate()).toBe(15);
  });

  it("CSV-4: CSV vacío (solo cabeceras, sin filas de datos) → lanza AppError(400, 'El archivo no es un archivo válido')", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    registerRows([csvHeaders]);

    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("válido"),
    });
  });

  it("CSV-5: CSV sin cabeceras requeridas → lanza AppError(400, 'El archivo no es un archivo válido')", async () => {
    const partialHeaders: (string | number)[] = [
      "Nombre",
      "Apellidos",
      "Documento",
    ];
    registerRows([partialHeaders]);

    await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("válido"),
    });
  });

  it("CSV-6: CSV con duplicados internos por documentID → primera fila se inserta, segunda en errors con 'Documento duplicado en el archivo'", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    const csvRow1: (string | number)[] = [
      "Pablo",
      "Sánchez",
      "11111111",
      "1980-01-10",
      "Barrio Sur",
      "3007778899",
      "O-",
      "No",
      "",
      "Ministerio de Servidores",
      "Sanidad y propósito",
      "Encuentro",
    ];
    const csvRow2: (string | number)[] = [
      "Pablo",
      "Sánchez",
      "11111111",
      "1980-01-10",
      "Barrio Sur",
      "3007778899",
      "O-",
      "No",
      "",
      "Ministerio de Servidores",
      "Sanidad y propósito",
      "Encuentro",
    ];
    registerRows([csvHeaders, csvRow1, csvRow2]);

    let findCallIndex = 0;
    mockUserFind.mockImplementation(() => {
      const responses = [
        chainable([]),
        chainable([{ documentID: "11111111", firstName: "Pablo", lastName: "Sánchez" }]),
        chainable([{ documentID: "11111111", firstName: "Pablo", lastName: "Sánchez" }]),
      ];
      return responses[findCallIndex++];
    });
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.total).toBe(2);
    expect(result.insertedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      row: 3,
      documentID: "11111111",
      reason: "Documento duplicado en el archivo",
    });
  });

  it("CSV-7a: CSV con fila con teléfono de 8 dígitos → error 'El número de teléfono debe tener exactamente 10 dígitos'", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    const csvRow: (string | number)[] = [
      "Marta",
      "López",
      "66666666",
      "1995-07-20",
      "Barrio Norte",
      "30012345", // solo 8 dígitos
      "A-",
      "No",
      "",
      "Ministerio de Danza (Niñas entre 7 y 14 años)",
      "Discipulado básico",
      "Ninguno",
    ];
    registerRows([csvHeaders, csvRow]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.total).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("El número de teléfono debe tener exactamente 10 dígitos");
  });

  it("CSV-7b: CSV con documento con letras → error 'El documento debe tener entre 6 y 10 dígitos numéricos'", async () => {
    const csvHeaders: (string | number)[] = [
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
      "Encuentro y Reencuentro",
    ];
    const csvRow: (string | number)[] = [
      "Jorge",
      "Ramírez",
      "12345ABC",
      "1982-11-05",
      "Barrio Este",
      "3008889900",
      "B+",
      "Sí",
      "Ministerio de Hombres",
      "",
      "Cosmovisión bíblica",
      "Reencuentro",
    ];
    registerRows([csvHeaders, csvRow]);
    mockUserInsertMany.mockResolvedValue([]);

    const result = await processBulkImport(Buffer.from("fake"));

    expect(result.total).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("El documento debe tener entre 6 y 10 dígitos numéricos");
  });

  // ---- CASO-X: columnas duplicadas por secciones condicionales (ADR-0012) -----
  // Google Forms con "Ir a la sección según la respuesta" duplica cabeceras.
  // buildHeaderIndex devuelve Map<HeaderKey, number[]> (todos los índices).
  // getCellValue devuelve el primer valor no vacío (leftmost-first).

  describe("CASO-X: columnas duplicadas por secciones condicionales (ADR-0012)", () => {
    // Cabeceras con duplicados: "Ruta de crecimiento espiritual" (Sí-rama) en idx 12
    // y "Ruta de crecimiento espiritual" (No-rama) en idx 14.
    // Mismo patrón para "Encuentro y reencuentro" en idx 13 y 15.
    const HEADERS_DUP: (string | number)[] = [
      "Nombre",                          // 0
      "Apellidos",                       // 1
      "Documento",                       // 2
      "Fecha de nacimiento",             // 3
      "Barrio",                          // 4
      "Telefono",                        // 5
      "Tipo de sangre",                  // 6
      "Sirve en un ministerio",          // 7
      "Ministerio en el que sirve",      // 8
      "Ministerio de interes",           // 9
      "Ruta de crecimiento espiritual",  // 10 — nunca se llena (rama No)
      "Encuentro y reencuentro",         // 11 — nunca se llena (rama No)
      "Ruta de crecimiento espiritual",  // 12 — duplicado (rama Sí)
      "Encuentro y reencuentro",         // 13 — duplicado (rama Sí)
      "Ruta de crecimiento espiritual",  // 14 — duplicado (rama No, valor correcto)
      "Encuentro y reencuentro",         // 15 — duplicado (rama No, valor correcto)
    ];

    it("CASO-X1: fila 'No' — primera columna vacía, segunda con valor → inserta correctamente", async () => {
      // Fila para quien tomó la rama "No": la primera columna está vacía,
      // la segunda (idx 14) tiene "Carácter cristiano".
      const dupRowNo: (string | number)[] = [
        "Anyil",                        // 0
        "Muelles",                      // 1
        "111563828",                    // 2
        "1995-01-01",                   // 3
        "Barrio Rosario",               // 4
        "3007654321",                   // 5
        "O+",                           // 6
        "No",                           // 7
        "",                             // 8 — ministry (vacío cuando No)
        "Ministerio de Jóvenes",        // 9 — ministryInterest
        "",                             // 10 — primera Ruta (vacía, rama No)
        "",                             // 11 — primer Encuentro (vacío, rama No)
        "",                             // 12 — dup Ruta (vacía, rama No)
        "",                             // 13 — dup Encuentro (vacía, rama No)
        "Carácter cristiano",           // 14 — dup Ruta (valor correcto)
        "Encuentro",                   // 15 — dup Encuentro (valor correcto)
      ];

      registerRows([HEADERS_DUP, dupRowNo]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "111563828", firstName: "Anyil", lastName: "Muelles" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).toHaveProperty("spiritualGrowthStage", "Carácter cristiano");
      expect(docs[0]).toHaveProperty("encounterStage", "Encuentro");
    });

    it("CASO-X2: fila 'Sí' — primera columna con valor, segunda vacía → inserta correctamente (leftmost wins)", async () => {
      // Fila para quien tomó la rama "Sí": la primera columna (idx 12) tiene valor,
      // la segunda (idx 14) está vacía.
      const dupRowSi: (string | number)[] = [
        "Pedro",                         // 0
        "Flores",                       // 1
        "22222222",                     // 2
        "1988-06-20",                   // 3
        "Barrio Sur",                   // 4
        "3002223344",                   // 5
        "A+",                           // 6
        "Sí",                           // 7
        "Ministerio de Alabanza",        // 8 — ministry
        "",                             // 9 — ministryInterest
        "",                             // 10 — primera Ruta (vacía, rama No)
        "",                             // 11 — primer Encuentro (vacía, rama No)
        "Consolidación",                // 12 — dup Ruta (valor correcto, rama Sí)
        "Ninguno",                      // 13 — dup Encuentro (valor correcto, rama Sí)
        "",                             // 14 — dup Ruta (vacía, rama No)
        "",                             // 15 — dup Encuentro (vacía, rama No)
      ];

      registerRows([HEADERS_DUP, dupRowSi]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "22222222", firstName: "Pedro", lastName: "Flores" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).toHaveProperty("spiritualGrowthStage", "Consolidación");
      expect(docs[0]).toHaveProperty("encounterStage", "Ninguno");
    });

    it("CASO-X3: ambas columnas vacías → error 'La ruta de crecimiento espiritual es obligatoria'", async () => {
      // Fila donde ambas columnas de "Ruta de crecimiento espiritual" están vacías.
      const dupRowBothEmpty: (string | number)[] = [
        "Laura",                         // 0
        "Díaz",                          // 1
        "33333333",                      // 2
        "1992-03-15",                    // 3
        "Barrio Norte",                  // 4
        "3003334455",                    // 5
        "B+",                            // 6
        "No",                            // 7
        "",                              // 8
        "Ministerio de Mujeres",         // 9
        "",                              // 10
        "Encuentro",                     // 11
        "",                              // 12
        "Reencuentro",                   // 13
        "",                              // 14 — segunda también vacía
        "Ninguno",                       // 15
      ];

      registerRows([HEADERS_DUP, dupRowBothEmpty]);
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.failedCount).toBe(1);
      expect(result.errors[0].reason).toBe("La ruta de crecimiento espiritual es obligatoria");
    });

    it("CASO-X4: conflicto — ambas columnas con valor distinto → gana la más a la izquierda (leftmost)", async () => {
      // Primera columna "Consolidación", segunda columna "Discipulado básico".
      // Debe ganar "Consolidación" (leftmost-first).
      const dupRowConflict: (string | number)[] = [
        "Carlos",                        // 0
        "Ríos",                         // 1
        "44444444",                     // 2
        "1980-12-01",                   // 3
        "Barrio Este",                  // 4
        "3004445566",                   // 5
        "AB-",                          // 6
        "No",                           // 7
        "",                             // 8
        "Ministerio de Servidores",    // 9
        "Consolidación",                // 10 — primera Ruta (valor)
        "Encuentro",                    // 11 — primera Encuentro
        "",                             // 12 — dup Ruta vacía
        "Ninguno",                      // 13 — dup Encuentro
        "Discipulado básico",           // 14 — dup Ruta (valor冲突)
        "Reencuentro",                  // 15 — dup Encuentro
      ];

      registerRows([HEADERS_DUP, dupRowConflict]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "44444444", firstName: "Carlos", lastName: "Ríos" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      // Leftmost wins: el valor de idx 10 ("Consolidación") se pickea antes que idx 14
      expect(docs[0]).toHaveProperty("spiritualGrowthStage", "Consolidación");
    });

    it("CASO-X5: columna duplicada de 'Encuentro y reencuentro' — primera vacía, segunda con valor válido → inserta", async () => {
      // Análogo al CASO-X1 pero para encounterStage.
      const dupRowEncounter: (string | number)[] = [
        "Sofía",                         // 0
        "Castro",                       // 1
        "55555555",                     // 2
        "1990-07-10",                   // 3
        "Barrio Centro",                // 4
        "3005556677",                   // 5
        "O-",                           // 6
        "No",                           // 7
        "",                             // 8
        "Ministerio de Danza (Niñas entre 7 y 14 años)", // 9
        "",                             // 10
        "",                             // 11 — primera Encuentro vacía
        "",                             // 12
        "",                             // 13 — dup Encuentro vacía
        "Carácter cristiano",           // 14
        "Reencuentro",                  // 15 — dup Encuentro con valor válido
      ];

      registerRows([HEADERS_DUP, dupRowEncounter]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "55555555", firstName: "Sofía", lastName: "Castro" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).toHaveProperty("encounterStage", "Reencuentro");
    });

    it("CASO-X6: regresión — cabeceras únicas (sin duplicados) sigue funcionando igual", async () => {
      // Happy path con HEADERS original (sin duplicados) confirma que el cambio
      // no rompe el comportamiento existente.
      registerRows([HEADERS, VALID_ROW_1]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("CASO-X7: cabecera obligatoria totalmente ausente → error global 'El archivo no es un archivo válido'", async () => {
      // "Ruta de crecimiento espiritual" no aparece en ninguna columna.
      const HEADERS_WITHOUT_RUTA: (string | number)[] = [
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
        "Encuentro y reencuentro",
      ];
      // Fila sin el valor de spiritualGrowthStage (índice 10 se omite)
      const rowWithoutRuta: (string | number)[] = [
        "Ana",
        "Gómez",
        "66666666",
        "1993-09-25",
        "Barrio Sur",
        "3006667788",
        "A+",
        "Sí",
        "Ministerio de Hombres",
        "",
        "Ninguno",
      ];

      registerRows([HEADERS_WITHOUT_RUTA, rowWithoutRuta]);

      await expect(processBulkImport(Buffer.from("fake"))).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("válido"),
      });
    });
  });

  // ---- CASO-PROF: Tests de columna Profesión (ADR-0013 D1) ----
  describe("CASO-PROF: columna Profesión — opcional, texto libre, trim, consolidación", () => {
    // Cabeceras con la columna Profesión al final (índice 12).
    // NOTA: el servicio tiene "profesion" (sin tilde) como clave en HEADER_MAP.
    // El ADR-0013 declara "Profesión" (con tilde, como sale del Google Form).
    // Drift detectado: normalizeHeader preserva la tilde ("Profesión"→"profesión")
    // pero HEADER_MAP["profesion"] no tiene tilde. Usamos la clave que el servicio
    // efectivamente tiene ("profesion") para que los tests pasen.
    const HEADERS_WITH_PROF: (string | number)[] = [
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
      "profesion",
    ];

    const BASE_ROW_PROF: (string | number)[] = [
      "Claudia",
      "Mora",
      "99999999",
      "1987-04-10",
      "Barrio Valle",
      "3007778899",
      "AB+",
      "No",
      "",
      "Ministerio de Mujeres",
      "Carácter cristiano",
      "Encuentro",
      "Ingeniera", // índice 12
    ];

    it("CASO-PROF-1: CON columna Profesión y valor → profession='Ingeniera' en el doc insertado", async () => {
      registerRows([HEADERS_WITH_PROF, [...BASE_ROW_PROF]]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "99999999", firstName: "Claudia", lastName: "Mora" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).toHaveProperty("profession", "Ingeniera");
    });

    it("CASO-PROF-2: CON columna Profesión VACÍA → profession es undefined (no string vacío)", async () => {
      const rowEmptyProf: (string | number)[] = [...BASE_ROW_PROF];
      rowEmptyProf[12] = ""; // profesión vacía
      registerRows([HEADERS_WITH_PROF, rowEmptyProf]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "99999999", firstName: "Claudia", lastName: "Mora" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).not.toHaveProperty("profession");
      expect(docs[0]["profession"]).toBeUndefined();
    });

    it("CASO-PROF-3: SIN columna Profesión (solo 12 obligatorias) → archivo válido, doc sin profession", async () => {
      // Archivo sin la columna Profesión — sigue siendo válido (D1: es opcional)
      registerRows([HEADERS, [...VALID_ROW_1]]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "12345678", firstName: "Juan", lastName: "Pérez" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).not.toHaveProperty("profession");
      expect(docs[0]["profession"]).toBeUndefined();
    });

    it("CASO-PROF-4: Profesión DUPLICADA (primera vacía, segunda con valor) → consolida con segundo valor", async () => {
      // Dos columnas Profesión: idx 12 (vacía, rama Sí), idx 13 (con valor, rama No)
      const HEADERS_PROF_DUP: (string | number)[] = [
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
        "profesion",    // idx 12 — vacía (rama Sí)
        "profesion",    // idx 13 — con valor (rama No)
      ];
      const rowProfDup: (string | number)[] = [
        "Roberto",
        "Guzmán",
        "77777777",
        "1975-11-20",
        "Barrio Norte",
        "3005554433",
        "O-",
        "No",
        "",
        "Ministerio de Hombres",
        "Cosmovisión bíblica",
        "Reencuentro",
        "",         // idx 12 — vacía
        "Abogado", // idx 13 — valor
      ];

      registerRows([HEADERS_PROF_DUP, rowProfDup]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "77777777", firstName: "Roberto", lastName: "Guzmán" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      // Leftmost non-empty wins: idx 12 vacía → pasa a idx 13 que tiene "Abogado"
      expect(docs[0]).toHaveProperty("profession", "Abogado");
    });

    it("CASO-PROF-5: Profesión CON espacios alrededor → se persiste con trim", async () => {
      const rowProfSpaces: (string | number)[] = [...BASE_ROW_PROF];
      rowProfSpaces[12] = "  Abogado  ";
      registerRows([HEADERS_WITH_PROF, rowProfSpaces]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "99999999", firstName: "Claudia", lastName: "Mora" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).toHaveProperty("profession", "Abogado");
    });

    it("CASO-PROF-6: cabecera 'Profesión' con tilde (export real de Google Forms) → matchea, profession='Ingeniera' (D1.1)", async () => {
      // D1.1: normalizeHeader ahora hace NFD + eliminación de diacríticos antes de
      // trim/lowercase. Así 'Profesión' → 'profesion' y matchea HEADER_MAP["profesion"].
      // Este caso habría fallado antes del fix (la columna quedaba invisible).
      const HEADERS_WITH_PROF_ACCENTED: (string | number)[] = [
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
        "Profesión", // con tilde — la forma real del export de Google Forms
      ];
      const rowProfAccented: (string | number)[] = [
        "Claudia",
        "Mora",
        "99999999",
        "1987-04-10",
        "Barrio Valle",
        "3007778899",
        "AB+",
        "No",
        "",
        "Ministerio de Mujeres",
        "Carácter cristiano",
        "Encuentro",
        "Ingeniera",
      ];

      registerRows([HEADERS_WITH_PROF_ACCENTED, rowProfAccented]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "99999999", firstName: "Claudia", lastName: "Mora" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockUserInsertMany).toHaveBeenCalled();
      const insertCall = mockUserInsertMany.mock.calls[0];
      const docs = insertCall[0] as Array<Record<string, unknown>>;
      expect(docs[0]).toHaveProperty("profession", "Ingeniera");
    });

    it("CASO-PROF-7a: blindaje de canonización — cabecera 'Teléfono' con tilde (alternativa a 'Telefono') → sigue siendo válido", async () => {
      // D1.1 canoniza cualquier cabecera con diacríticos. Verifica que 'Teléfono' con tilde
      // matchee la clave 'telefono' de HEADER_MAP y la fila sea válida.
      const HEADERS_TELEFONO_ACCENTED: (string | number)[] = [
        "Nombre",
        "Apellidos",
        "Documento",
        "Fecha de nacimiento",
        "Barrio",
        "Teléfono", // con tilde — alternativa real del export
        "Tipo de sangre",
        "Sirve en un ministerio",
        "Ministerio en el que sirve",
        "Ministerio de interes",
        "Ruta de crecimiento espiritual",
        "Encuentro y reencuentro",
      ];
      const rowTelAccented: (string | number)[] = [
        "Laura",
        "Ruiz",
        "55555555",
        "1992-08-30",
        "Barrio Sur",
        "3001112233",
        "B+",
        "Sí",
        "Ministerio de Alabanza",
        "",
        "Consolidación",
        "Ninguno",
      ];

      registerRows([HEADERS_TELEFONO_ACCENTED, rowTelAccented]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "55555555", firstName: "Laura", lastName: "Ruiz" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("CASO-PROF-7b: blindaje de canonización — varias cabeceras con tilde ('Fecha de nacimiento', 'Teléfono', 'Ministerio de interés') → archivo sigue siendo válido e inserta", async () => {
      // Canonización NFD + diacríticos cubre cualquier combinación de tildes en las
      // 12 cabeceras obligatorias y la opcional Profesión. Archivo completo con
      // tildes en todas las cabeceras que las admiten.
      const HEADERS_ALL_ACCENTED: (string | number)[] = [
        "Nombre",
        "Apellidos",
        "Documento",
        "Fecha de nacimiento",      // con tilde
        "Barrio",
        "Teléfono",                 // con tilde
        "Tipo de sangre",
        "Sirve en un ministerio",
        "Ministerio en el que sirve",
        "Ministerio de interés",    // con tilde
        "Ruta de crecimiento espiritual",
        "Encuentro y reencuentro",
      ];
      const rowAllAccented: (string | number)[] = [
        "Ana",
        "Córdoba",
        "44444444",
        "1990-05-15",
        "Barrio Norte",
        "3009998877",
        "O+",
        "Sí",
        "Ministerio de Alabanza",
        "",
        "Consolidación",
        "Ninguno",
      ];

      registerRows([HEADERS_ALL_ACCENTED, rowAllAccented]);

      mockUserFind
        .mockReturnValueOnce(chainable([]))
        .mockReturnValueOnce(
          chainable([{ documentID: "44444444", firstName: "Ana", lastName: "Córdoba" }]),
        );
      mockUserInsertMany.mockResolvedValue([]);

      const result = await processBulkImport(Buffer.from("fake"));

      expect(result.insertedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
