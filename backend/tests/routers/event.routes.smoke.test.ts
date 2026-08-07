import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express, Router } from "express";
import * as xlsx from "xlsx";

import {
  authHeader,
  noAuthHeader,
  chainable,
  VALID_ID,
  INVALID_ID,
  OTHER_VALID_ID,
  type TestAuth,
} from "../_setup/test-helpers";

vi.mock("../../src/middleware/auth.middleware", () => {
  const authenticate = (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
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

vi.mock("../../src/models/user-profile.model", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../src/models/event.model", () => {
  const Event = {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create: vi.fn(),
  };
  return { default: Event };
});

import eventRouter from "../../src/routes/event.routes";
import Event from "../../src/models/event.model";

const findMock = Event.find as unknown as ReturnType<typeof vi.fn>;
const findByIdMock = Event.findById as unknown as ReturnType<typeof vi.fn>;

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

const mountUnderEventsPrefix = (router: Router): Express => {
  const express = require("express") as typeof import("express");
  const app = express();
  app.use(express.json());
  app.use("/api/events", router);
  return app;
};

const app = mountUnderEventsPrefix(eventRouter);

const makeEvent = (overrides: Partial<{
  _id: string;
  name: string;
  date: Date;
  time: string;
  registrations: unknown[];
}> = {}) => ({
  _id: VALID_ID,
  name: "Evento",
  capacity: 100,
  date: new Date(),
  time: "10:00",
  place: "Sede Central",
  price: 10000,
  description: "",
  registrationClosed: false,
  registrations: [],
  ...overrides,
});

const resetMocks = () => {
  findMock.mockReset();
  findByIdMock.mockReset();
};

describe("event.routes.ts — listados e historial", () => {
  beforeEach(resetMocks);

  it("GET /api/events?status=upcoming filtra eventos pasados", async () => {
    const upcoming = makeEvent({
      _id: VALID_ID,
      name: "Retiro próximo",
      date: new Date(Date.now() + 7 * 86400000),
      time: "10:00",
    });
    const past = makeEvent({
      _id: OTHER_VALID_ID,
      name: "Retiro pasado",
      date: new Date(Date.now() - 7 * 86400000),
      time: "10:00",
    });

    findMock.mockReturnValueOnce(chainable([upcoming, past]));

    const res = await request(app)
      .get("/api/events?status=upcoming")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Retiro próximo");
    expect(res.body[0].isPast).toBe(false);
  });

  it("GET /api/events?status=past filtra eventos próximos y ordena descendente", async () => {
    const olderPast = makeEvent({
      _id: VALID_ID,
      name: "Retiro antiguo",
      date: new Date(Date.now() - 14 * 86400000),
      time: "09:00",
    });
    const recentPast = makeEvent({
      _id: OTHER_VALID_ID,
      name: "Retiro reciente",
      date: new Date(Date.now() - 2 * 86400000),
      time: "18:00",
    });

    findMock.mockReturnValueOnce(chainable([olderPast, recentPast]));

    const res = await request(app)
      .get("/api/events?status=past")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].isPast).toBe(true);
    expect(res.body[1].isPast).toBe(true);
    expect(res.body[0].name).toBe("Retiro reciente");
    expect(res.body[1].name).toBe("Retiro antiguo");
  });

  it("GET /api/events/history es alias semántico de ?status=past", async () => {
    const pastEvent = makeEvent({
      _id: VALID_ID,
      name: "Evento histórico",
      date: new Date(Date.now() - 3 * 86400000),
      time: "08:00",
    });

    findMock.mockReturnValueOnce(chainable([pastEvent]));

    const res = await request(app)
      .get("/api/events/history")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isPast).toBe(true);
    expect(res.body[0].name).toBe("Evento histórico");
  });

  it("GET /api/events sin status incluye próximos y pasados", async () => {
    const upcoming = makeEvent({
      _id: VALID_ID,
      name: "Próximo",
      date: new Date(Date.now() + 5 * 86400000),
      time: "10:00",
    });
    const past = makeEvent({
      _id: OTHER_VALID_ID,
      name: "Pasado",
      date: new Date(Date.now() - 5 * 86400000),
      time: "10:00",
    });

    findMock.mockReturnValueOnce(chainable([upcoming, past]));

    const res = await request(app)
      .get("/api/events")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.some((event: { isPast: boolean }) => event.isPast)).toBe(true);
    expect(res.body.some((event: { isPast: boolean }) => !event.isPast)).toBe(true);
  });

  it("GET /api/events?status=invalido devuelve 400", async () => {
    const res = await request(app)
      .get("/api/events?status=invalido")
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Parámetros de consulta inválidos");
  });

  it("GET /api/events sin autenticación devuelve 401", async () => {
    const res = await request(app).get("/api/events").set(noAuthHeader());

    expect(res.status).toBe(401);
  });
});

describe("event.routes.ts — exportación Excel", () => {
  beforeEach(resetMocks);

  const buildEventForExport = () =>
    makeEvent({
      _id: VALID_ID,
      name: "Retiro de jóvenes",
      date: new Date("2026-08-15T00:00:00.000Z"),
      time: "09:00",
      capacity: 120,
      price: 25000,
      registrations: [
        {
          _id: OTHER_VALID_ID,
          status: "registered",
          amountPaid: 25000,
          notes: "Pago completo",
          createdAt: new Date("2026-01-04T10:00:00.000Z"),
          updatedAt: new Date("2026-01-04T10:00:00.000Z"),
          profile: {
            _id: OTHER_VALID_ID,
            firstName: "María",
            lastName: "Gómez",
            documentID: "1234567890",
            phoneNumber: "3001234567",
            neighborhood: "Centro",
            role: { _id: VALID_ID, name: "Miembro" },
            user: null,
          },
        },
      ],
    });

  it("GET /api/events/:id/export/registrations devuelve Excel con status 200 y Content-Type correcto", async () => {
    findByIdMock.mockReturnValueOnce(chainable(buildEventForExport()));

    const res = await request(app)
      .get(`/api/events/${VALID_ID}/export/registrations`)
      .set(authHeader(ADMIN_AUTH))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers["content-disposition"]).toMatch(
      /attachment; filename="inscritos-retiro_de_jovenes-20260815\.xlsx"/,
    );

    const workbook = xlsx.read(res.body as Buffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("Inscritos");
    expect(workbook.SheetNames).toContain("Resumen");

    const inscritosSheet = workbook.Sheets["Inscritos"];
    const inscritosData = xlsx.utils.sheet_to_json<string[]>(inscritosSheet, { header: 1 });
    expect(inscritosData[0]).toContain("Nombre completo");
    expect(inscritosData[0]).toContain("Documento");
    expect(inscritosData[0]).toContain("Estado de pago");
    expect(inscritosData).toHaveLength(2);
    expect(inscritosData[1]).toContain("María Gómez");
    expect(inscritosData[1]).toContain("Pagado");

    const resumenSheet = workbook.Sheets["Resumen"];
    const resumenData = xlsx.utils.sheet_to_json<string[]>(resumenSheet, { header: 1 });
    expect(resumenData.some((row) => row.includes("Nombre del evento"))).toBe(true);
    expect(resumenData.some((row) => row.includes("Retiro de jóvenes"))).toBe(true);
    expect(resumenData.some((row) => row.includes("Total recaudado"))).toBe(true);
  });

  it("GET /api/events/:id/export/registrations con id inválido devuelve 400", async () => {
    const res = await request(app)
      .get(`/api/events/${INVALID_ID}/export/registrations`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("GET /api/events/:id/export/registrations sin autenticación devuelve 401", async () => {
    const res = await request(app)
      .get(`/api/events/${VALID_ID}/export/registrations`)
      .set(noAuthHeader());

    expect(res.status).toBe(401);
  });

  it("GET /api/events/:id/export/registrations con rol no-admin devuelve 403", async () => {
    const res = await request(app)
      .get(`/api/events/${VALID_ID}/export/registrations`)
      .set(authHeader(MEMBER_AUTH));

    expect(res.status).toBe(403);
  });

  it("GET /api/events/:id/export/registrations con evento inexistente devuelve 404", async () => {
    findByIdMock.mockReturnValueOnce(chainable(null));

    const res = await request(app)
      .get(`/api/events/${VALID_ID}/export/registrations`)
      .set(authHeader(ADMIN_AUTH));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Evento no encontrado");
  });
});
