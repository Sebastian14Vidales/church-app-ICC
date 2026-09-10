import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

/**
 * Smoke tests del router `user-profile.routes.ts` para el endpoint
 * `POST /api/members/bulk` (bulk import de miembros desde Excel).
 *
 * Cubre:
 *  - 400 sin archivo adjunto
 *  - 403 con rol no-admin (Profesor)
 *  - 200 con rol admin y archivo válido (delega al controller)
 *  - 400 con mimetype inválido (text/plain)
 *
 * Sin `any`; sin `console.log`; determinismo vía mocks.
 */

// ---- helpers de test-helpers (mismo directorio) ---------------------------
import {
  authHeader,
  noAuthHeader,
  type TestAuth,
} from "../_setup/test-helpers";

// ---- mocks a nivel módulo -------------------------------------------------

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
    (_req: Request, res: Response, next: NextFunction) => {
      const auth = (_req as unknown as { auth?: TestAuth }).auth;
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

// Mock del service para no depender de la lógica de bulk import en route tests
vi.mock("../../src/services/member-bulk-import.service", () => ({
  processBulkImport: vi.fn(),
}));

// Mock de modelos para el resto de rutas del router (findAll, etc.)
vi.mock("../../src/models/user-profile.model", () => {
  const chain = (resolved: unknown) => {
    const self = {
      populate: vi.fn(() => self),
      then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
        Promise.resolve(resolved).then(onfulfilled),
    };
    return self;
  };
  return {
    default: {
      find: vi.fn(() => chain([])),
      findOne: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    },
  };
});

vi.mock("../../src/models/role.model", () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));

vi.mock("../../src/models/user.model", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));

// ---- imports DESPUÉS de vi.mock --------------------------------------------

import userProfileRouter from "../../src/routes/user-profile.routes";
import { processBulkImport } from "../../src/services/member-bulk-import.service";
import { AppError } from "../../src/services/app-error";

// ---- acceso tipado a los mocks --------------------------------------------

const mockProcessBulkImport = processBulkImport as unknown as ReturnType<typeof vi.fn>;

// ---- fixtures de sesión ----------------------------------------------------

const ADMIN_AUTH: TestAuth = {
  userId: "u-admin",
  email: "admin@icc.test",
  name: "Admin Test",
  roles: ["Admin"],
  profileId: "profile-admin",
};

const SUPERADMIN_AUTH: TestAuth = {
  userId: "u-super",
  email: "super@icc.test",
  name: "Super Admin",
  roles: ["Superadmin"],
  profileId: "profile-super",
};

const PROFESOR_AUTH: TestAuth = {
  userId: "u-prof",
  email: "prof@icc.test",
  name: "Profesor Test",
  roles: ["Profesor"],
  profileId: "profile-prof",
};

// ---- helper para montar router bajo /api/members ---------------------------

const mountRouter = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require("express") as typeof import("express");
  const app = express();
  app.use(express.json());
  app.use("/api/members", userProfileRouter);
  return app;
};

const app = mountRouter();

const resetMocks = () => {
  vi.clearAllMocks();
  mockProcessBulkImport.mockReset();
};

// ---- tests ----------------------------------------------------------------

describe("user-profile.routes — POST /api/members/bulk", () => {
  beforeEach(resetMocks);

  // Helper: construye una petición multipart con supertest
  const buildRequest = (auth: TestAuth, extraFields?: Record<string, unknown>) => {
    const req = request(app)
      .post("/api/members/bulk")
      .set(authHeader(auth));

    // Si hay archivo, lo adjuntamos
    if (extraFields?.file) {
      req.attach("file", Buffer.from("fake xlsx"), {
        filename: "test.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }

    return req;
  };

  it("POST /bulk sin archivo → 400 'Debes adjuntar un archivo .xlsx o .csv'", async () => {
    const res = await buildRequest(ADMIN_AUTH);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Debes adjuntar un archivo .xlsx o .csv");
    expect(mockProcessBulkImport).not.toHaveBeenCalled();
  });

  it("POST /bulk con rol Profesor → 403", async () => {
    // El middleware authorizeRoles(ADMIN_ROLES) es el segundo authorizeRoles
    // (antes está MEMBER_MANAGER_ROLES), así que Profesor debería ser rechazado
    // por authorizeRoles(["Admin", "Superadmin"]) → 403
    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(PROFESOR_AUTH))
      .attach("file", Buffer.from("fake xlsx"), {
        filename: "test.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(403);
    expect(mockProcessBulkImport).not.toHaveBeenCalled();
  });

  it("POST /bulk con rol Admin y mimetype válido → 200 + shape de BulkImportResult", async () => {
    const bulkResult = {
      total: 1,
      insertedCount: 1,
      failedCount: 0,
      inserted: [{ row: 2, documentID: "12345678", firstName: "Juan", lastName: "Pérez" }],
      errors: [],
    };
    mockProcessBulkImport.mockResolvedValue(bulkResult);

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", Buffer.from("fake xlsx"), {
        filename: "asistentes.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 1,
      insertedCount: 1,
      failedCount: 0,
      inserted: expect.any(Array),
      errors: expect.any(Array),
    });
    expect(mockProcessBulkImport).toHaveBeenCalled();
  });

  it("POST /bulk con rol Superadmin → 200 (superadmin también en ADMIN_ROLES)", async () => {
    mockProcessBulkImport.mockResolvedValue({
      total: 0,
      insertedCount: 0,
      failedCount: 0,
      inserted: [],
      errors: [],
    });

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(SUPERADMIN_AUTH))
      .attach("file", Buffer.from("fake xlsx"), {
        filename: "asistentes.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(200);
  });

  // ---- CASO 4b: texto plano sin extensión válida → 400 (ni mimetype ni extensión coinciden) ----
  it("POST /bulk con mimetype inválido (text/plain) sin extensión válida → 400 'El archivo no es un archivo válido'", async () => {
    // Multer fileFilter rechaza text/plain SIN extensión .csv/.xlsx
    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", Buffer.from("not an excel"), {
        filename: "test.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("El archivo no es un archivo válido");
    expect(mockProcessBulkImport).not.toHaveBeenCalled();
  });

  it("POST /bulk sin auth → 401", async () => {
    const res = await request(app)
      .post("/api/members/bulk")
      .set(noAuthHeader())
      .attach("file", Buffer.from("fake xlsx"), {
        filename: "test.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(401);
  });

  it("POST /bulk cuando processBulkImport lanza AppError → propagate status y message", async () => {
    mockProcessBulkImport.mockRejectedValue(
      new AppError(400, "El archivo no contiene las cabeceras esperadas"),
    );

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", Buffer.from("fake xlsx"), {
        filename: "mal.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("El archivo no contiene las cabeceras esperadas");
  });

  it("POST /bulk cuando processBulkImport lanza error genérico → 500", async () => {
    mockProcessBulkImport.mockRejectedValue(new Error("boom"));

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", Buffer.from("fake xlsx"), {
        filename: "test.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    expect(res.status).toBe(500);
  });

  // ---- CSV tests (ADR-0010 revisión 2026-08-18) --------------------------------

  it("POST /bulk con archivo .csv mimetype text/csv y rol Admin → 200 + BulkImportResult shape", async () => {
    const bulkResult = {
      total: 1,
      insertedCount: 1,
      failedCount: 0,
      inserted: [{ row: 2, documentID: "12345678", firstName: "Juan", lastName: "Pérez" }],
      errors: [],
    };
    mockProcessBulkImport.mockResolvedValue(bulkResult);

    const csvContent = Buffer.from(
      "Nombre,Apellidos,Documento,Fecha de nacimiento,Barrio,Telefono,Tipo de sangre,Sirve en un ministerio,Ministerio en el que sirve,Ministerio de interes,Ruta de crecimiento espiritual,Encuentro y Reencuentro\n" +
      "Juan,Pérez,12345678,1990-05-15,Barrio Centro,3001234567,O+,Sí,Ministerio de Alabanza,,Consolidación,Ninguno",
      "utf-8",
    );

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", csvContent, {
        filename: "asistentes.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 1,
      insertedCount: 1,
      failedCount: 0,
      inserted: expect.any(Array),
      errors: expect.any(Array),
    });
    expect(mockProcessBulkImport).toHaveBeenCalled();
  });

  it("POST /bulk con archivo .csv mimetype text/plain y rol Superadmin → 200 (aceptado por extensión .csv)", async () => {
    mockProcessBulkImport.mockResolvedValue({
      total: 0,
      insertedCount: 0,
      failedCount: 0,
      inserted: [],
      errors: [],
    });

    const csvContent = Buffer.from(
      "Nombre,Apellidos,Documento,Fecha de nacimiento,Barrio,Telefono,Tipo de sangre,Sirve en un ministerio,Ministerio en el que sirve,Ministerio de interes,Ruta de crecimiento espiritual,Encuentro y Reencuentro",
      "utf-8",
    );

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(SUPERADMIN_AUTH))
      .attach("file", csvContent, {
        filename: "asistentes.csv",
        contentType: "text/plain",
      });

    expect(res.status).toBe(200);
    expect(mockProcessBulkImport).toHaveBeenCalled();
  });

  it("POST /bulk con archivo .csv mimetype application/json → 200 (aceptado por extensión .csv)", async () => {
    mockProcessBulkImport.mockResolvedValue({
      total: 1,
      insertedCount: 1,
      failedCount: 0,
      inserted: [{ row: 2, documentID: "12345678", firstName: "Ana", lastName: "García" }],
      errors: [],
    });

    const csvContent = Buffer.from(
      "Nombre,Apellidos,Documento,Fecha de nacimiento,Barrio,Telefono,Tipo de sangre,Sirve en un ministerio,Ministerio en el que sirve,Ministerio de interes,Ruta de crecimiento espiritual,Encuentro y Reencuentro\n" +
      "Ana,García,12345678,1985-03-22,Barrio Sur,3009876543,A+,No,,Ministerio de Jóvenes,Discipulado básico,Encuentro",
      "utf-8",
    );

    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", csvContent, {
        filename: "asistentes.csv",
        contentType: "application/json",
      });

    expect(res.status).toBe(200);
    expect(mockProcessBulkImport).toHaveBeenCalled();
  });

  it("POST /bulk con archivo sin extensión y mimetype application/pdf → 400 'El archivo no es un archivo válido'", async () => {
    const res = await request(app)
      .post("/api/members/bulk")
      .set(authHeader(ADMIN_AUTH))
      .attach("file", Buffer.from("fake pdf content"), {
        filename: "documento",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("El archivo no es un archivo válido");
    expect(mockProcessBulkImport).not.toHaveBeenCalled();
  });

});
