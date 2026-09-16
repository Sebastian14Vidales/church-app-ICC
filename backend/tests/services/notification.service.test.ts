import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests unitarios de `notification.service.ts` (pista A — módulo de notificaciones).
 *
 * Cover: createNotification, notifyAdmins, listNotifications,
 *        markNotificationRead, markAllNotificationsRead.
 *
 * Sin Mongo real: los modelos y `emitRealtimeNotification` están mockeados
 * con `vi.mock`. Sin `console.log`, sin `any`.
 */

// ---- mocks a nivel módulo -----------------------------------------------

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeNotification: vi.fn(),
}));

vi.mock("../../src/models/notification.model", () => {
  const create = vi.fn();
  const findOne = vi.fn();
  const find = vi.fn();
  const countDocuments = vi.fn();
  const updateMany = vi.fn();
  return {
    __esModule: true,
    default: Object.assign(
      // Constructor (no se usa directamente en los tests)
      vi.fn(() => ({ then: <U>(cb: (v: unknown) => U) => cb(null) })),
      { create, findOne, find, countDocuments, updateMany },
    ),
    // Named exports para acceso directo a los mocks estáticos
    create,
    findOne,
    find,
    countDocuments,
    updateMany,
  };
});

vi.mock("../../src/models/role.model", () => ({
  __esModule: true,
  default: Object.assign(vi.fn(), {
    find: vi.fn(),
  }),
}));

vi.mock("../../src/models/user.model", () => ({
  __esModule: true,
  default: Object.assign(vi.fn(), {
    find: vi.fn(),
  }),
}));



// ---- acceso tipado a los mocks ------------------------------------------

import {
  create as mockNotificationCreate,
  findOne as mockNotificationFindOne,
  find as mockNotificationFind,
  countDocuments as mockNotificationCountDocuments,
  updateMany as mockNotificationUpdateMany,
} from "../../src/models/notification.model";
import Role from "../../src/models/role.model";
import User from "../../src/models/user.model";
import { emitRealtimeNotification } from "../../src/realtime/socket";
// Modelo real para vi.spyOn (sin conexión a BD)
import Notification from "../../src/models/notification.model";

const mockNotificationSave = vi.fn();

const mockRoleFind = (Role.find as unknown as ReturnType<typeof vi.fn>);
const mockUserFind = (User.find as unknown as ReturnType<typeof vi.fn>);

const realtimeNotificationMock = (emitRealtimeNotification as unknown as ReturnType<typeof vi.fn>);

// ---- helpers de cadena thenable (simulan Mongoose Query) --------------

type Chain = {
  select: ReturnType<typeof vi.fn>;
  sort: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) => Promise<U>;
};

/** Cadena thenable estilo Mongoose Query que soporta .select(), .sort(), .limit() y .then() */
const chainable = (resolved: unknown): Chain => {
  const self = {} as Chain;
  self.select = vi.fn(() => self);
  self.sort = vi.fn(() => self);
  self.limit = vi.fn(() => self);
  self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
    Promise.resolve(resolved).then(onfulfilled);
  return self;
};

// ---- fixtures -----------------------------------------------------------

const PROFILE_ID = "65a1f0c0c1d2a3b4f5e6f7a1";
const NOTIF_ID = "65a1f0c0c1d2a3b4f5e6f7b0";
const OTHER_PROFILE_ID = "65a1f0c0c1d2a3b4f5e6f7b1";
const ADMIN_ROLE_ID = "65a1f0c0c1d2a3b4f5e6f7c0";
const ADMIN_USER_ID = "65a1f0c0c1d2a3b4f5e6f7c1";
const ADMIN_PROFILE_ID_1 = "65a1f0c0c1d2a3b4f5e6f7c2";
const ADMIN_PROFILE_ID_2 = "65a1f0c0c1d2a3b4f5e6f7c3";

const buildNotificationDoc = (overrides: Record<string, unknown> = {}) => {
  const now = new Date();
  return {
    _id: { toString: () => NOTIF_ID },
    recipientUser: { toString: () => PROFILE_ID },
    type: "course-assignment",
    title: "Nueva asignación de curso",
    message: "Se te asignó el curso «Fundamentos de la Fe» como profesor.",
    link: "/my-courses",
    readAt: null,
    createdAt: now,
    updatedAt: now,
    save: mockNotificationSave,
    ...overrides,
  };
};

// ---- imports del service bajo test --------------------------------------

import {
  createNotification,
  notifyAdmins,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../src/services/notification.service";

const resetMocks = () => {
  vi.clearAllMocks();
  mockNotificationCreate.mockReset();
  mockNotificationFindOne.mockReset();
  mockNotificationFind.mockReset();
  mockNotificationCountDocuments.mockReset();
  mockNotificationUpdateMany.mockReset();
  mockNotificationSave.mockReset();
  mockRoleFind.mockReset();
  mockUserFind.mockReset();
  realtimeNotificationMock.mockReset();
};

// ---- tests --------------------------------------------------------------

describe("notification.service — createNotification", () => {
  beforeEach(resetMocks);

  it("persiste con recipientProfileId y devuelve notificación serializada", async () => {
    const now = new Date();
    const doc = buildNotificationDoc({ createdAt: now, updatedAt: now });
    mockNotificationCreate.mockResolvedValue(doc);

    const result = await createNotification({
      recipientUser: PROFILE_ID,
      type: "course-assignment",
      title: "Nueva asignación de curso",
      message: "Se te asignó el curso.",
      link: "/my-courses",
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      recipientUser: PROFILE_ID,
      type: "course-assignment",
      title: "Nueva asignación de curso",
      message: "Se te asignó el curso.",
      link: "/my-courses",
    });
    expect(result._id).toBe(NOTIF_ID);
    expect(result.type).toBe("course-assignment");
    expect(result.readAt).toBeNull();
  });

  it("emite emitRealtimeNotification a ['profile:<id>'] con la notificación serializada", async () => {
    const now = new Date();
    const doc = buildNotificationDoc({ createdAt: now, updatedAt: now });
    mockNotificationCreate.mockResolvedValue(doc);

    await createNotification({
      recipientUser: PROFILE_ID,
      type: "course-assignment",
      title: "Nueva asignación de curso",
      message: "Mensaje",
      link: null,
    });

    expect(realtimeNotificationMock).toHaveBeenCalledTimes(1);
    const [rooms, payload] = realtimeNotificationMock.mock.calls[0];
    expect(rooms).toEqual([`user:${PROFILE_ID}`]);
    // payload = { notification: Notification }
    expect(payload).toHaveProperty("notification");
    const notif = (payload as { notification: Record<string, unknown> }).notification;
    expect(notif._id).toBe(NOTIF_ID);
    expect(notif.title).toBe("Nueva asignación de curso");
    expect(notif.message).toBe("Se te asignó el curso «Fundamentos de la Fe» como profesor.");
    expect(notif.link).toBe("/my-courses");
    expect(notif.readAt).toBeNull();
  });

  it("link null se serializa como null en la respuesta", async () => {
    const now = new Date();
    const doc = buildNotificationDoc({ link: null, createdAt: now, updatedAt: now });
    mockNotificationCreate.mockResolvedValue(doc);

    const result = await createNotification({
      recipientUser: PROFILE_ID,
      type: "course-assignment",
      title: "Test",
      message: "Test msg",
      link: null,
    });

    expect(result.link).toBeNull();
  });
});

describe("notification.service — notifyAdmins", () => {
  beforeEach(resetMocks);

  it("resuelve Role→User y crea una notificación por usuario admin", async () => {
    // Role.find().select("_id") → chainable con [{ _id: ADMIN_ROLE_ID }]
    mockRoleFind.mockReturnValue(chainable([{ _id: ADMIN_ROLE_ID }]));
    // User.find().select("_id") → chainable con los dos usuarios admin
    mockUserFind.mockReturnValue(
      chainable([{ _id: ADMIN_USER_ID }, { _id: ADMIN_PROFILE_ID_1 }]),
    );
    // createNotification se resuelve correctamente
    mockNotificationCreate.mockResolvedValue(buildNotificationDoc());

    await notifyAdmins({
      type: "course-assignment",
      title: "Curso asignado",
      message: "Se asignó un curso.",
      link: "/courses",
    });

    // Dos admins → dos llamadas a createNotification
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    const calls = mockNotificationCreate.mock.calls;
    expect(calls[0][0]).toMatchObject({
      recipientUser: ADMIN_USER_ID,
      type: "course-assignment",
      title: "Curso asignado",
    });
    expect(calls[1][0]).toMatchObject({
      recipientUser: ADMIN_PROFILE_ID_1,
    });
  });

  it("sin admins → no-op sin error", async () => {
    mockRoleFind.mockReturnValue(chainable([]));

    await expect(
      notifyAdmins({
        type: "course-assignment",
        title: "Test",
        message: "Test msg",
      }),
    ).resolves.toBeUndefined();

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("sin usuarios con rol admin → no-op sin error", async () => {
    mockRoleFind.mockReturnValue(chainable([{ _id: ADMIN_ROLE_ID }]));
    mockUserFind.mockReturnValue(chainable([]));

    await expect(
      notifyAdmins({
        type: "course-assignment",
        title: "Test",
        message: "Test msg",
      }),
    ).resolves.toBeUndefined();

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("createNotification que rechaza → tolerancia a fallos (no lanza, solo log)", async () => {
    mockRoleFind.mockReturnValue(chainable([{ _id: ADMIN_ROLE_ID }]));
    mockUserFind.mockReturnValue(chainable([{ _id: ADMIN_USER_ID }]));
    mockNotificationCreate.mockRejectedValue(new Error("Notification service down"));

    // No debe lanzar
    await expect(
      notifyAdmins({
        type: "course-assignment",
        title: "Test",
        message: "Test msg",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("notification.service — listNotifications", () => {
  beforeEach(resetMocks);

  it("filtra por recipientProfileId, ordena createdAt desc, unreadCount correcto", async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 3600_000);
    const newer = new Date(now.getTime() - 1000);

    const items = [
      buildNotificationDoc({ _id: { toString: () => "n2" }, createdAt: newer, updatedAt: newer }),
      buildNotificationDoc({ _id: { toString: () => "n1" }, createdAt: older, updatedAt: older }),
    ];

    mockNotificationFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
            Promise.resolve(items).then(onfulfilled),
        }),
      }),
    });
    mockNotificationCountDocuments.mockResolvedValue(3);

    const result = await listNotifications(PROFILE_ID, 20);

    expect(mockNotificationFind).toHaveBeenCalledWith({ recipientUser: PROFILE_ID });
    expect(result.unreadCount).toBe(3);
    expect(result.items).toHaveLength(2);
    // Orden desc
    expect(result.items[0]._id).toBe("n2");
    expect(result.items[1]._id).toBe("n1");
  });

  it("devuelve items vacíos y unreadCount 0 cuando no hay notificaciones", async () => {
    mockNotificationFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
            Promise.resolve([]).then(onfulfilled),
        }),
      }),
    });
    mockNotificationCountDocuments.mockResolvedValue(0);

    const result = await listNotifications(PROFILE_ID, 20);

    expect(result.items).toHaveLength(0);
    expect(result.unreadCount).toBe(0);
  });
});

describe("notification.service — markNotificationRead", () => {
  beforeEach(resetMocks);

  it("404 si la notificación no existe", async () => {
    mockNotificationFindOne.mockResolvedValue(null);

    await expect(markNotificationRead(NOTIF_ID, PROFILE_ID)).rejects.toMatchObject({
      status: 404,
      message: "Notificación no encontrada",
    });
  });

  it("404 si la notificación existe pero no es del caller", async () => {
    // El doc tiene OTHER_PROFILE_ID, pero la query del service usa PROFILE_ID
    // → Mongoose no encuentra coincidencia → el servicio lanza 404
    const doc = buildNotificationDoc({
      recipientUser: { toString: () => OTHER_PROFILE_ID },
    });
    mockNotificationFindOne.mockImplementation((query: { recipientUser?: string }) => {
      // Simula Mongoose: si el query tiene recipientUser diferente → null
      if (query?.recipientUser && query.recipientUser !== OTHER_PROFILE_ID) {
        return {
          select: vi.fn().mockReturnThis(),
          then: <U>(cb: (v: unknown) => U) => cb(null),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        then: <U>(cb: (v: unknown) => U) => cb(doc),
      };
    });

    await expect(markNotificationRead(NOTIF_ID, PROFILE_ID)).rejects.toMatchObject({
      status: 404,
      message: "Notificación no encontrada",
    });
  });

  it("marca readAt y devuelve notificación actualizada", async () => {
    const doc = buildNotificationDoc({ readAt: null });
    mockNotificationFindOne.mockResolvedValue(doc);
    mockNotificationSave.mockResolvedValue(undefined);

    const result = await markNotificationRead(NOTIF_ID, PROFILE_ID);

    expect(mockNotificationSave).toHaveBeenCalled();
    expect(result.message).toBe("Notificación marcada como leída");
    expect(result.notification.readAt).not.toBeNull();
  });

  it("idempotente: ya leída no cambia readAt ni falla", async () => {
    const alreadyRead = new Date("2026-09-10T10:00:00.000Z");
    const doc = buildNotificationDoc({ readAt: alreadyRead });
    mockNotificationFindOne.mockResolvedValue(doc);

    const result = await markNotificationRead(NOTIF_ID, PROFILE_ID);

    expect(mockNotificationSave).not.toHaveBeenCalled();
    expect(result.notification.readAt).toBe(alreadyRead.toISOString());
  });
});

describe("notification.service — markAllNotificationsRead", () => {
  beforeEach(resetMocks);

  it("updateMany de no leídas y devuelve updatedCount", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ modifiedCount: 5 });

    const result = await markAllNotificationsRead(PROFILE_ID);

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      { recipientUser: PROFILE_ID, readAt: null },
      { $set: { readAt: expect.any(Date) } },
    );
    expect(result.message).toBe("Todas las notificaciones fueron marcadas como leídas");
    expect(result.updatedCount).toBe(5);
  });

  it("devuelve updatedCount 0 cuando no hay notificaciones no leídas", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ modifiedCount: 0 });

    const result = await markAllNotificationsRead(PROFILE_ID);

    expect(result.updatedCount).toBe(0);
  });
});
