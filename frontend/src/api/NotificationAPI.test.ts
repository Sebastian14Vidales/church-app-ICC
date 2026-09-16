import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "@/lib/axios";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./NotificationAPI";

/**
 * Tests unitarios para `NotificationAPI.ts` (pista A).
 *
 * Valida:
 * - zod schema de respuesta ok para cada función
 * - errores lanzados cuando safeParse fails
 * - mensajes de fallback cuando la API falla sin cuerpo de error
 *
 * Sin `any`; sin `console.log`; mocks puros de `api`.
 */

vi.mock("@/lib/axios", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

const resetMocks = () => {
  vi.clearAllMocks();
};

const now = new Date().toISOString();

const VALID_NOTIFICATION = {
  _id: "n1",
  type: "course-assignment",
  title: "Nueva asignación de curso",
  message: "Se te asignó el curso «Fundamentos de la Fe».",
  link: "/my-courses",
  readAt: null,
  createdAt: now,
  updatedAt: now,
};

const VALID_NOTIFICATIONS_RESPONSE = {
  items: [VALID_NOTIFICATION],
  unreadCount: 1,
};

describe("NotificationAPI — zod validation", () => {
  beforeEach(resetMocks);

  describe("getMyNotifications", () => {
    it("devuelve NotificationsResponse cuando la API responde con shape válido", async () => {
      mockedApi.get.mockResolvedValue({ data: VALID_NOTIFICATIONS_RESPONSE });

      const result = await getMyNotifications(20);

      expect(result).toMatchObject({
        items: expect.any(Array),
        unreadCount: 1,
      });
      expect(result.items[0]._id).toBe("n1");
      expect(result.items[0].title).toBe("Nueva asignación de curso");
    });

    it("lanza cuando la API responde con shape inválido (falta unreadCount)", async () => {
      mockedApi.get.mockResolvedValue({ data: { items: [VALID_NOTIFICATION] } });

      await expect(getMyNotifications(20)).rejects.toThrow(
        "No se pudieron obtener las notificaciones",
      );
    });

    it("lanza cuando la API responde con items vacío inválido (no es array)", async () => {
      mockedApi.get.mockResolvedValue({ data: { items: "no-array", unreadCount: 0 } });

      await expect(getMyNotifications(20)).rejects.toThrow();
    });

    it("pasa limit a GET con params { limit }", async () => {
      mockedApi.get.mockResolvedValue({ data: { items: [], unreadCount: 0 } });

      await getMyNotifications(10);

      expect(mockedApi.get).toHaveBeenCalledWith("/notifications", {
        params: { limit: 10 },
      });
    });

    it("lanza con mensaje de fallback cuando la API falla sin cuerpo", async () => {
      mockedApi.get.mockRejectedValue(new Error("Network error"));

      await expect(getMyNotifications()).rejects.toThrow(
        "No se pudieron obtener las notificaciones",
      );
    });
  });

  describe("markNotificationRead", () => {
    const VALID_MARK_READ_RESPONSE = {
      message: "Notificación marcada como leída",
      notification: { ...VALID_NOTIFICATION, readAt: now },
    };

    it("devuelve MarkNotificationReadResponse con shape válido", async () => {
      mockedApi.patch.mockResolvedValue({ data: VALID_MARK_READ_RESPONSE });

      const result = await markNotificationRead("n1");

      expect(result.message).toBe("Notificación marcada como leída");
      expect(result.notification.readAt).not.toBeNull();
    });

    it("lanza cuando la API responde con shape inválido (falta notification)", async () => {
      mockedApi.patch.mockResolvedValue({ data: { message: "Ok" } });

      await expect(markNotificationRead("n1")).rejects.toThrow(
        "No se pudo marcar la notificacion como leida",
      );
    });

    it("lanza con mensaje de fallback cuando la API falla sin cuerpo", async () => {
      mockedApi.patch.mockRejectedValue(new Error("Network error"));

      await expect(markNotificationRead("n1")).rejects.toThrow(
        "No se pudo marcar la notificacion como leida",
      );
    });

    it("llama a PATCH /notifications/:id/read con el ID correcto", async () => {
      mockedApi.patch.mockResolvedValue({ data: VALID_MARK_READ_RESPONSE });

      await markNotificationRead("custom-notif-id");

      expect(mockedApi.patch).toHaveBeenCalledWith("/notifications/custom-notif-id/read");
    });
  });

  describe("markAllNotificationsRead", () => {
    const VALID_MARK_ALL_RESPONSE = {
      message: "Todas las notificaciones fueron marcadas como leídas",
      updatedCount: 5,
    };

    it("devuelve MarkAllNotificationsReadResponse con shape válido", async () => {
      mockedApi.patch.mockResolvedValue({ data: VALID_MARK_ALL_RESPONSE });

      const result = await markAllNotificationsRead();

      expect(result.message).toBe("Todas las notificaciones fueron marcadas como leídas");
      expect(result.updatedCount).toBe(5);
    });

    it("lanza cuando la API responde con shape inválido (falta updatedCount)", async () => {
      mockedApi.patch.mockResolvedValue({ data: { message: "Ok" } });

      await expect(markAllNotificationsRead()).rejects.toThrow(
        "No se pudieron marcar las notificaciones como leidas",
      );
    });

    it("lanza con mensaje de fallback cuando la API falla sin cuerpo", async () => {
      mockedApi.patch.mockRejectedValue(new Error("Network error"));

      await expect(markAllNotificationsRead()).rejects.toThrow(
        "No se pudieron marcar las notificaciones como leidas",
      );
    });

    it("llama a PATCH /notifications/read-all", async () => {
      mockedApi.patch.mockResolvedValue({ data: VALID_MARK_ALL_RESPONSE });

      await markAllNotificationsRead();

      expect(mockedApi.patch).toHaveBeenCalledWith("/notifications/read-all");
    });
  });
});
