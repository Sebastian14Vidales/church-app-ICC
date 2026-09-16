import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Request, Response, NextFunction } from "express";

/**
 * Smoke tests del router `notification.routes.ts` (pista A).
 *
 * Cubre:
 *  - GET /api/notifications sin token → 401
 *  - GET con limit fuera de rango (0, 51, "abc") → 400 con { errors: [...] }
 *  - GET con limit válido → 200 + shape NotificationsResponse
 *  - PATCH /:id/read con :id no MongoId → 400
 *  - PATCH /:id/read sin token → 401
 *  - PATCH /:id/read con notificación inexistente → 404
 *  - PATCH /:id/read con notificación del caller → 200 (idempotente)
 *  - PATCH /read-all sin token → 401
 *  - PATCH /read-all → 200 + shape MarkAllNotificationsReadResponse
 *  - PATCH /read-all no colisiona con PATCH /:id/read (ruta resuelta correctamente)
 *
 * Sin `any`; sin `console.log`; determinismo vía mocks.
 */

// ---- helpers de test-helpers --------------------------------------------
import {
  authHeader,
  noAuthHeader,
  type TestAuth,
} from "../_setup/test-helpers";

// ---- mocks a nivel módulo -----------------------------------------------

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
  emitRealtimeNotification: vi.fn(),
}));

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
  return { authenticate };
});

vi.mock("../../src/services/notification.service", () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

// ---- imports DESPUÉS de vi.mock -----------------------------------------

import notificationRouter from "../../src/services/notification.service";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "../../src/services/notification.service";

// Re-import router after mocks
import notificationRouter2 from "../../src/routes/notification.routes";

// ---- acceso tipado a los mocks ------------------------------------------

const mockListNotifications = listNotifications as unknown as ReturnType<typeof vi.fn>;
const mockMarkNotificationRead = markNotificationRead as unknown as ReturnType<typeof vi.fn>;
const mockMarkAllNotificationsRead = markAllNotificationsRead as unknown as ReturnType<typeof vi.fn>;

// ---- import AppError para los errores de mock ---------------------------
import { AppError } from "../../src/services/app-error";

// ---- fixtures de sesión --------------------------------------------------

const USER_AUTH: TestAuth = {
  userId: "u-user",
  email: "user@icc.test",
  name: "Usuario Test",
  roles: ["Miembro"],
  profileId: "profile-user",
};

const ADMIN_AUTH: TestAuth = {
  userId: "u-admin",
  email: "admin@icc.test",
  name: "Admin Test",
  roles: ["Admin"],
  profileId: "profile-admin",
};

/**
 * Fixture para el caso del incidente ADR-00??:
 * Superadmin tiene userId (sesión válida) pero profileId = null
 * (bootstrap de superadmin no tiene UserProfile).
 * El controller debe responder 200, nunca 401.
 */
const SUPERADMIN_AUTH: TestAuth = {
  userId: "u-superadmin",
  email: "superadmin@icc.test",
  name: "Superadmin Test",
  roles: ["Superadmin"],
  profileId: null as unknown as string, // null = sin UserProfile
};

// ---- helper para montar router bajo /api/notifications -------------------

const mountRouter = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require("express") as typeof import("express");
  const app = express();
  app.use(express.json());
  app.use("/api/notifications", notificationRouter2);
  return app;
};

const app = mountRouter();

const resetMocks = () => {
  vi.clearAllMocks();
  mockListNotifications.mockReset();
  mockMarkNotificationRead.mockReset();
  mockMarkAllNotificationsRead.mockReset();
};

// ---- tests --------------------------------------------------------------

describe("notification.routes — GET /api/notifications", () => {
  beforeEach(resetMocks);

  it("sin token → 401", async () => {
    const res = await request(app).get("/api/notifications").set(noAuthHeader());
    expect(res.status).toBe(401);
  });

  it("limit=0 → 400 con { errors: [...] } (contrato repo)", async () => {
    mockListNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    const res = await request(app)
      .get("/api/notifications?limit=0")
      .set(authHeader(USER_AUTH));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it("limit=51 → 400 con { errors: [...] } (contrato repo)", async () => {
    mockListNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    const res = await request(app)
      .get("/api/notifications?limit=51")
      .set(authHeader(USER_AUTH));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("limit=abc → 400 con { errors: [...] } (contrato repo)", async () => {
    mockListNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    const res = await request(app)
      .get("/api/notifications?limit=abc")
      .set(authHeader(USER_AUTH));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("limit=20 (válido) → 200 + shape NotificationsResponse", async () => {
    const now = new Date().toISOString();
    mockListNotifications.mockResolvedValue({
      items: [
        {
          _id: "n1",
          type: "course-assignment",
          title: "Nueva asignación",
          message: "Se te asignó el curso.",
          link: "/my-courses",
          readAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      unreadCount: 1,
    });

    const res = await request(app)
      .get("/api/notifications?limit=20")
      .set(authHeader(USER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: expect.any(Array),
      unreadCount: expect.any(Number),
    });
    expect(res.body.items[0]).toMatchObject({
      _id: "n1",
      type: "course-assignment",
      title: "Nueva asignación",
    });
  });

  it("sin limit (default 20) → 200", async () => {
    mockListNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    const res = await request(app)
      .get("/api/notifications")
      .set(authHeader(USER_AUTH));
    expect(res.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // REGRESIÓN: incidente superadmin con profileId null
  // El superadmin inicia sesión con userId válido pero sin UserProfile (profileId=null).
  // Antes del fix: controller respondía 401 → interceptor 401→logout del frontend.
  // Después del fix: controller usa solo userId → responde 200 (vacío).
  // ---------------------------------------------------------------------------
  it("superadmin con profileId null → 200 (regresión incidente)", async () => {
    mockListNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    const res = await request(app)
      .get("/api/notifications")
      .set(authHeader(SUPERADMIN_AUTH));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], unreadCount: 0 });
  });
});

describe("notification.routes — PATCH /api/notifications/:id/read", () => {
  beforeEach(resetMocks);

  it("sin token → 401", async () => {
    const res = await request(app)
      .patch("/api/notifications/65a1f0c0c1d2a3b4f5e6f7a8/read")
      .set(noAuthHeader());
    expect(res.status).toBe(401);
  });

  it(":id no MongoId → 400 con { errors: [...] }", async () => {
    const res = await request(app)
      .patch("/api/notifications/not-a-mongoid/read")
      .set(authHeader(USER_AUTH));
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
    expect(Array.isArray(res.body.errors)).toBe(true);
    // Mensaje en español
    const idError = res.body.errors.find(
      (e: { msg?: string }) => e.msg?.includes("inválido"),
    );
    expect(idError).toBeDefined();
  });

  it("notificación inexistente → 404", async () => {
    mockMarkNotificationRead.mockRejectedValue(
      new AppError(404, "Notificación no encontrada"),
    );
    const res = await request(app)
      .patch("/api/notifications/65a1f0c0c1d2a3b4f5e6f7a8/read")
      .set(authHeader(USER_AUTH));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Notificación no encontrada");
  });

  it("notificación del caller → 200, respuesta idempotente (already read)", async () => {
    const now = new Date().toISOString();
    mockMarkNotificationRead.mockResolvedValue({
      message: "Notificación marcada como leída",
      notification: {
        _id: "65a1f0c0c1d2a3b4f5e6f7a8",
        type: "course-assignment",
        title: "Nueva asignación",
        message: "Se te asignó el curso.",
        link: "/my-courses",
        readAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    const res = await request(app)
      .patch("/api/notifications/65a1f0c0c1d2a3b4f5e6f7a8/read")
      .set(authHeader(USER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Notificación marcada como leída");
    expect(res.body.notification.readAt).not.toBeNull();
  });

  // REGRESIÓN: superadmin con profileId null → 200 (nunca 401)
  it("superadmin con profileId null en PATCH /:id/read → 200", async () => {
    mockMarkNotificationRead.mockResolvedValue({
      message: "Notificación marcada como leída",
      notification: {
        _id: "65a1f0c0c1d2a3b4f5e6f7a8",
        type: "course-assignment",
        title: "Nueva asignación",
        message: "Se te asignó el curso.",
        link: "/my-courses",
        readAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    const res = await request(app)
      .patch("/api/notifications/65a1f0c0c1d2a3b4f5e6f7a8/read")
      .set(authHeader(SUPERADMIN_AUTH));
    expect(res.status).toBe(200);
  });
});

describe("notification.routes — PATCH /api/notifications/read-all", () => {
  beforeEach(resetMocks);

  it("sin token → 401", async () => {
    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set(noAuthHeader());
    expect(res.status).toBe(401);
  });

  it("happy path → 200 + shape MarkAllNotificationsReadResponse", async () => {
    mockMarkAllNotificationsRead.mockResolvedValue({
      message: "Todas las notificaciones fueron marcadas como leídas",
      updatedCount: 3,
    });

    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set(authHeader(USER_AUTH));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Todas las notificaciones fueron marcadas como leídas",
      updatedCount: 3,
    });
  });

  it("PATCH /read-all no colisiona con PATCH /:id/read (ruta resuelta correctamente)", async () => {
    // "read-all" no debe matchear con :id/read
    // Si colisionara, Express usaría la primera ruta coincidente (read-all si está antes)
    // En notification.routes.ts, /read-all está ANTES de /:id/read
    // → La request a /read-all debe llegar a markAllRead, no a markRead
    mockMarkAllNotificationsRead.mockResolvedValue({
      message: "Todas las notificaciones fueron marcadas como leídas",
      updatedCount: 0,
    });

    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set(authHeader(USER_AUTH));

    expect(res.status).toBe(200);
    expect(mockMarkAllNotificationsRead).toHaveBeenCalled();
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  // REGRESIÓN: superadmin con profileId null → 200 con updatedCount 0
  it("superadmin con profileId null en PATCH /read-all → 200 + updatedCount 0", async () => {
    mockMarkAllNotificationsRead.mockResolvedValue({
      message: "Todas las notificaciones fueron marcadas como leídas",
      updatedCount: 0,
    });
    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set(authHeader(SUPERADMIN_AUTH));
    expect(res.status).toBe(200);
    expect(res.body.updatedCount).toBe(0);
  });
});
