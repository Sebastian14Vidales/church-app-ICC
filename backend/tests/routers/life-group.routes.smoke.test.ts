import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";
import type { Express } from "express";

import {
  authHeader,
  noAuthHeader,
  VALID_ID,
  INVALID_ID,
  type TestAuth,
} from "../_setup/test-helpers";

/**
 * Smoke tests del router `life-group.routes.ts` (ADR-0011 §D4-D5).
 *
 * Estrategia: mockear el auth middleware para poder testear validación de input
 * (400) y auth (401/403) sin depender de JWT real. Los servicios están
 * mockeados para evitar MongoDB real.
 *
 * Sin `any`; sin `console.log`.
 */

// ---- mocks a nivel módulo -------------------------------------------------

// Mock del auth middleware —.injecta req.auth desde el header x-test-auth
vi.mock("../../src/middleware/auth.middleware", () => {
  const authenticate = (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.headers["x-test-auth"];
    if (typeof raw !== "string" || raw.trim() === "") {
      return _res.status(401).json({ message: "No autorizado" });
    }
    try {
      (req as unknown as { auth?: TestAuth }).auth = JSON.parse(raw) as TestAuth;
      return next();
    } catch {
      return _res.status(401).json({ message: "La sesión es inválida o expiró" });
    }
  };
  const authorizeRoles =
    (allowedRoles: string[]) =>
    (_req: Request, _res: Response, next: NextFunction) => {
      const auth = (_req as unknown as { auth?: TestAuth }).auth;
      if (!auth) {
        return _res.status(401).json({ message: "No autorizado" });
      }
      const has = auth.roles.some((role) => allowedRoles.includes(role));
      if (!has) {
        return _res.status(403).json({ message: "No tienes permisos para esta acción" });
      }
      return next();
    };
  return { authenticate, authorizeRoles };
});

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
}));

// vi.hoisted() crea mocks al nivel del archivo, disponibles antes de vi.mock.
const {
  mockFindMine,
  mockCreateLifeGroup,
  mockUpdateLifeGroup,
  mockAddSession,
  mockUpdateSession,
  mockDeleteSession,
} = vi.hoisted(() => ({
  mockFindMine: vi.fn(),
  mockCreateLifeGroup: vi.fn(),
  mockUpdateLifeGroup: vi.fn(),
  mockAddSession: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockDeleteSession: vi.fn(),
}));

vi.mock("../../src/services/life-group.service", () => ({
  findMine: mockFindMine,
  createLifeGroup: mockCreateLifeGroup,
  updateLifeGroup: mockUpdateLifeGroup,
  addSession: mockAddSession,
  updateSession: mockUpdateSession,
  deleteSession: mockDeleteSession,
}));

vi.mock("../../src/models/life-group.model", () => ({
  default: { findOne: vi.fn() },
}));

vi.mock("../../src/models/user-profile.model", () => ({
  default: { findById: vi.fn(), find: vi.fn() },
}));

// ---- imports DESPUÉS de vi.mock --------------------------------------------

import lifeGroupRouter from "../../../src/routes/life-group.routes";

// ---- fixtures de sesión ---------------------------------------------------

const ADMIN_AUTH: TestAuth = {
  userId: "u-admin",
  email: "admin@icc.test",
  name: "Admin Test",
  roles: ["Admin"],
  profileId: "profile-admin",
};

const SUPERVISOR_AUTH: TestAuth = {
  userId: "u-sup",
  email: "sup@icc.test",
  name: "Supervisor Test",
  roles: ["Supervisor"],
  profileId: "profile-sup",
};

const ASISTENTE_AUTH: TestAuth = {
  userId: "u-asistente",
  email: "asistente@icc.test",
  name: "Asistente Test",
  roles: ["Asistente"],
  profileId: "profile-asistente",
};

const LIDERSUPERVISOR_AUTH: TestAuth = {
  userId: "u-lider-sup",
  email: "lider@icc.test",
  name: "Lider Supervisor Test",
  roles: ["Lider", "Supervisor"],
  profileId: "profile-lider-sup",
};

// ---- montar router bajo /api/life-groups ---------------------------------

const mountRouter = (): Express => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require("express") as typeof import("express");
  const app = express();
  app.use(express.json());
  app.use("/api/life-groups", lifeGroupRouter);
  return app;
};

const app = mountRouter();

const resetMocks = () => {
  vi.clearAllMocks();
  mockFindMine.mockReset();
  mockCreateLifeGroup.mockReset();
  mockUpdateLifeGroup.mockReset();
  mockAddSession.mockReset();
  mockUpdateSession.mockReset();
  mockDeleteSession.mockReset();
};

// ---- tests ----------------------------------------------------------------

describe("life-group.routes — GET /api/life-groups", () => {
  beforeEach(resetMocks);

  it("sin autenticación → 401", async () => {
    const res = await request(app).get("/api/life-groups").set(noAuthHeader());
    expect(res.status).toBe(401);
  });

  it("con auth válida → 200 + delegates al controller", async () => {
    mockFindMine.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH));
    expect(res.status).toBe(200);
    expect(mockFindMine).toHaveBeenCalled();
  });
});

describe("life-group.routes — POST /api/life-groups", () => {
  beforeEach(resetMocks);

  const validBody = {
    name: "Nuevo Grupo",
    neighborhood: "Centro",
    address: "Calle 10 # 20-30",
    leader: VALID_ID,
    type: "life-group",
    attendees: [] as string[],
  };

  it("sin autenticación → 401", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(noAuthHeader())
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("Asistente (sin rol) → 403", async () => {
    mockCreateLifeGroup.mockResolvedValue({});
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(ASISTENTE_AUTH))
      .send(validBody);
    expect(res.status).toBe(403);
    expect(mockCreateLifeGroup).not.toHaveBeenCalled();
  });

  it("name faltante → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, name: undefined } as Record<string, unknown>);
    expect(res.status).toBe(400);
  });

  it("neighborhood faltante → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, neighborhood: undefined } as Record<string, unknown>);
    expect(res.status).toBe(400);
  });

  it("address faltante → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, address: undefined } as Record<string, unknown>);
    expect(res.status).toBe(400);
  });

  it("leader con MongoId inválido → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, leader: "not-a-mongoid" });
    expect(res.status).toBe(400);
  });

  it("type inválido → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, type: "invalid-type" });
    expect(res.status).toBe(400);
  });

  it("attendees.* con MongoId inválido → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, attendees: [INVALID_ID] });
    expect(res.status).toBe(400);
  });

  it("Admin + body válido → 201 + delegates al controller", async () => {
    mockCreateLifeGroup.mockResolvedValue({});
    const res = await request(app)
      .post("/api/life-groups")
      .set(authHeader(ADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(201);
    expect(mockCreateLifeGroup).toHaveBeenCalled();
  });
});

describe("life-group.routes — PATCH /api/life-groups/:id", () => {
  beforeEach(resetMocks);

  it("sin autenticación → 401", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}`)
      .set(noAuthHeader())
      .send({ name: "Nuevo Nombre" });
    expect(res.status).toBe(401);
  });

  it("Asistente (sin rol) → 403", async () => {
    mockUpdateLifeGroup.mockResolvedValue({});
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}`)
      .set(authHeader(ASISTENTE_AUTH))
      .send({ name: "Nuevo" });
    expect(res.status).toBe(403);
    expect(mockUpdateLifeGroup).not.toHaveBeenCalled();
  });

  it("id no es MongoId → 400", async () => {
    const res = await request(app)
      .patch("/api/life-groups/not-a-mongoid")
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ name: "Nuevo" });
    expect(res.status).toBe(400);
  });

  it("name vacío → 400", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("type inválido → 400", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ type: "invalid" });
    expect(res.status).toBe(400);
  });

  it("leader con MongoId inválido → 400", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ leader: "not-mongo" });
    expect(res.status).toBe(400);
  });

  it("Admin + body válido → 200 + delegates al controller", async () => {
    mockUpdateLifeGroup.mockResolvedValue({});
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send({ name: "Nuevo" });
    expect(res.status).toBe(200);
    expect(mockUpdateLifeGroup).toHaveBeenCalled();
  });
});

describe("life-group.routes — POST /api/life-groups/:id/sessions", () => {
  beforeEach(resetMocks);

  const validBody = {
    date: "2026-08-10T19:00:00.000Z",
    attendeesPresent: [VALID_ID],
    offeringAmount: 50000,
    notes: "Primera sesión",
  };

  it("sin autenticación → 401", async () => {
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(noAuthHeader())
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("Asistente (sin rol) → 403", async () => {
    mockAddSession.mockResolvedValue({});
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(ASISTENTE_AUTH))
      .send(validBody);
    expect(res.status).toBe(403);
    expect(mockAddSession).not.toHaveBeenCalled();
  });

  it("id no es MongoId → 400", async () => {
    const res = await request(app)
      .post("/api/life-groups/not-mongo/sessions")
      .set(authHeader(SUPERVISOR_AUTH))
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("date faltante → 400", async () => {
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ attendeesPresent: [VALID_ID], offeringAmount: 50000 });
    expect(res.status).toBe(400);
  });

  it("date inválido → 400", async () => {
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, date: "no-es-fecha" });
    expect(res.status).toBe(400);
  });

  it("attendeesPresent no es array → 400", async () => {
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, attendeesPresent: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it("attendeesPresent.* con MongoId inválido → 400", async () => {
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, attendeesPresent: [INVALID_ID] });
    expect(res.status).toBe(400);
  });

  it("offeringAmount negativo → 400", async () => {
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, offeringAmount: -100 });
    expect(res.status).toBe(400);
  });

  it("Lider/Supervisor/Admin + body válido → 201", async () => {
    mockAddSession.mockResolvedValue({});
    const res = await request(app)
      .post(`/api/life-groups/${VALID_ID}/sessions`)
      .set(authHeader(LIDERSUPERVISOR_AUTH))
      .send(validBody);
    expect(res.status).toBe(201);
    expect(mockAddSession).toHaveBeenCalled();
  });
});

describe("life-group.routes — PATCH /api/life-groups/:id/sessions/:sessionId", () => {
  beforeEach(resetMocks);

  const validBody = {
    date: "2026-08-17T19:00:00.000Z",
    attendeesPresent: [VALID_ID],
    offeringAmount: 75000,
    notes: "Sesión actualizada",
  };

  it("sin autenticación → 401", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(noAuthHeader())
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("Asistente (sin rol) → 403", async () => {
    mockUpdateSession.mockResolvedValue({});
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(authHeader(ASISTENTE_AUTH))
      .send(validBody);
    expect(res.status).toBe(403);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it("id no es MongoId → 400", async () => {
    const res = await request(app)
      .patch("/api/life-groups/not-mongo/sessions/sess-1")
      .set(authHeader(SUPERVISOR_AUTH))
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("sessionId no es MongoId → 400", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}/sessions/not-mongo`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("date inválido → 400", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, date: "fecha-invalida" });
    expect(res.status).toBe(400);
  });

  it("offeringAmount negativo → 400", async () => {
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(authHeader(SUPERVISOR_AUTH))
      .send({ ...validBody, offeringAmount: -50 });
    expect(res.status).toBe(400);
  });

  it("Admin + body válido → 200", async () => {
    mockUpdateSession.mockResolvedValue({});
    const res = await request(app)
      .patch(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH))
      .send(validBody);
    expect(res.status).toBe(200);
    expect(mockUpdateSession).toHaveBeenCalled();
  });
});

describe("life-group.routes — DELETE /api/life-groups/:id/sessions/:sessionId", () => {
  beforeEach(resetMocks);

  it("sin autenticación → 401", async () => {
    const res = await request(app)
      .delete(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(noAuthHeader());
    expect(res.status).toBe(401);
  });

  it("Asistente (sin rol) → 403", async () => {
    mockDeleteSession.mockResolvedValue({});
    const res = await request(app)
      .delete(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(authHeader(ASISTENTE_AUTH));
    expect(res.status).toBe(403);
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it("id no es MongoId → 400", async () => {
    const res = await request(app)
      .delete("/api/life-groups/not-mongo/sessions/sess-1")
      .set(authHeader(SUPERVISOR_AUTH));
    expect(res.status).toBe(400);
  });

  it("sessionId no es MongoId → 400", async () => {
    const res = await request(app)
      .delete(`/api/life-groups/${VALID_ID}/sessions/not-mongo`)
      .set(authHeader(SUPERVISOR_AUTH));
    expect(res.status).toBe(400);
  });

  it("Admin → 200", async () => {
    mockDeleteSession.mockResolvedValue({});
    const res = await request(app)
      .delete(`/api/life-groups/${VALID_ID}/sessions/${VALID_ID}`)
      .set(authHeader(ADMIN_AUTH));
    expect(res.status).toBe(200);
    expect(mockDeleteSession).toHaveBeenCalled();
  });
});
