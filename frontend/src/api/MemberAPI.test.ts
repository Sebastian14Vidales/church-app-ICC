import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "@/lib/axios";
import { bulkImportMembers } from "./MemberAPI";

/**
 * Tests unitarios para `MemberAPI.ts` — especialmente la función
 * `bulkImportMembers` añadida en el bulk import de miembros/asistentes.
 *
 * Cada test es determinista: mocks puros de `api` sin backend real,
 * sin `console.log`, sin `any`.
 */

vi.mock("@/lib/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const resetMocks = () => {
  vi.clearAllMocks();
};

const sampleBulkImportResponse = {
  total: 3,
  insertedCount: 2,
  failedCount: 1,
  inserted: [
    { row: 2, documentID: "12345678", firstName: "Juan", lastName: "Pérez" },
    { row: 4, documentID: "87654321", firstName: "María", lastName: "García" },
  ],
  errors: [
    {
      row: 3,
      documentID: "11111111",
      firstName: "Pedro",
      reason: "Documento duplicado en el archivo",
    },
  ],
};

describe("MemberAPI — bulkImportMembers", () => {
  beforeEach(resetMocks);

  it("llama a POST /members/bulk con FormData conteniendo el archivo", async () => {
    mockedApi.post.mockResolvedValue({ data: sampleBulkImportResponse });

    const file = new File(["fake content"], "asistentes.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await bulkImportMembers(file);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedApi.post.mock.calls[0];

    expect(url).toBe("/members/bulk");
    expect(body).toBeInstanceOf(FormData);
    // Verificar que el FormData contiene el archivo
    const formData = body as FormData;
    expect(formData.get("file")).toBe(file);
    // Axios establece Content-Type multipart automáticamente con FormData;
    // no hay tercer argumento config en api.post(url, data).
  });

  it("devuelve BulkImportResult cuando la respuesta es válida", async () => {
    mockedApi.post.mockResolvedValue({ data: sampleBulkImportResponse });

    const file = new File(["xlsx"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = await bulkImportMembers(file);

    expect(result).toMatchObject({
      total: 3,
      insertedCount: 2,
      failedCount: 1,
      inserted: expect.any(Array),
      errors: expect.any(Array),
    });
    expect(result.inserted[0]).toHaveProperty("row");
    expect(result.inserted[0]).toHaveProperty("documentID");
    expect(result.inserted[0]).toHaveProperty("firstName");
    expect(result.inserted[0]).toHaveProperty("lastName");
  });

  it("lanza error cuando safeParse del schema falla", async () => {
    // La respuesta no tiene la forma correcta de BulkImportResult
    mockedApi.post.mockResolvedValue({
      data: { insertedCount: "not-a-number", inserted: null },
    });

    const file = new File(["xlsx"], "bad.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // El código lanza Error("Respuesta de importacion masiva invalida") dentro del try,
    // pero el catch block lo convierte via getApiErrorMessage → fallback
    // "No se pudo procesar el archivo" (porque no es un AxiosError con response.data).
    await expect(bulkImportMembers(file)).rejects.toThrow("No se pudo procesar el archivo");
  });

  it("lanza error genérico cuando la red falla (sin respuesta)", async () => {
    mockedApi.post.mockRejectedValue(new Error("Network error"));

    const file = new File(["xlsx"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(bulkImportMembers(file)).rejects.toThrow("No se pudo procesar el archivo");
  });

  it("pasa el file correcto a FormData (verificado por el nombre del archivo)", async () => {
    mockedApi.post.mockResolvedValue({ data: sampleBulkImportResponse });

    const file = new File(["content"], "asistentes-ago-2026.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await bulkImportMembers(file);

    const formData = mockedApi.post.mock.calls[0][1] as FormData;
    const sentFile = formData.get("file") as File;
    expect(sentFile.name).toBe("asistentes-ago-2026.xlsx");
  });
});
