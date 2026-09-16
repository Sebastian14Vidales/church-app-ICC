import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  connectRealtime,
  disconnectRealtime,
  onRealtimeInvalidation,
  onRealtimeNotification,
} from "./realtime";
import { io, type Socket } from "socket.io-client";

/**
 * Tests unitarios de `realtime.ts` (pista A).
 *
 * Verifica el wiring de `onRealtimeNotification`:
 * - registra handler para el evento "notifications:new"
 * - retorna función de desuscripción
 * - el handler recibe el payload correcto
 *
 * Como no hay precedente de test de socket en el repo, usamos un mock
 * de socket.io-client inyectado vía vi.mock.
 *
 * Sin `any`; sin `console.log`; determinista.
 */

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}));

const mockedIo = io as unknown as ReturnType<typeof vi.fn>;

const buildFakeSocket = (): Socket => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler?: (...args: unknown[]) => void) => {
      if (!handler) {
        listeners.delete(event);
      } else {
        listeners.get(event)?.delete(handler);
      }
    }),
    disconnect: vi.fn(),
    emit: vi.fn(),
    // Exponer para tests: dispara un evento simulando el servidor
    __emit: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.forEach((h) => h(...args));
    },
  } as unknown as Socket;
};

let fakeSocket: ReturnType<typeof buildFakeSocket>;

beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket = buildFakeSocket();
  mockedIo.mockReturnValue(fakeSocket as unknown as Socket);
  // Resetear el socket singleton
  disconnectRealtime();
});

describe("realtime — onRealtimeNotification", () => {
  it("registra un listener para el evento 'notifications:new'", () => {
    connectRealtime("test-token");

    const handler = vi.fn();
    const unsubscribe = onRealtimeNotification(handler);

    expect(fakeSocket.on).toHaveBeenCalledWith("notifications:new", expect.any(Function));

    unsubscribe();
  });

  it("el handler recibe el payload correcto cuando el servidor emite", () => {
    connectRealtime("test-token");

    const handler = vi.fn();
    const now = new Date().toISOString();
    const notificationPayload = {
      notification: {
        _id: "n1",
        type: "course-assignment",
        title: "Nueva asignación",
        message: "Se te asignó el curso.",
        link: "/my-courses",
        readAt: null,
        createdAt: now,
        updatedAt: now,
      },
    };

    const unsubscribe = onRealtimeNotification(handler);
    // Simular emisión del servidor
    (fakeSocket.__emit as unknown as (event: string, payload: object) => void)(
      "notifications:new",
      notificationPayload,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(notificationPayload);

    unsubscribe();
  });

  it("retorna función que desuscribe el listener", () => {
    connectRealtime("test-token");

    const handler = vi.fn();
    const unsubscribe = onRealtimeNotification(handler);
    unsubscribe();

    expect(fakeSocket.off).toHaveBeenCalledWith("notifications:new", expect.any(Function));
  });

  it("desuscripción efectiva: el handler deja de recibir eventos", () => {
    connectRealtime("test-token");

    const handler = vi.fn();
    const now = new Date().toISOString();
    const notificationPayload = {
      notification: {
        _id: "n1",
        type: "course-assignment",
        title: "Test",
        message: "Test msg",
        link: null,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      },
    };

    const unsubscribe = onRealtimeNotification(handler);
    unsubscribe();

    // Tras unsubscribe, emitir no debe llamar al handler
    (fakeSocket.__emit as unknown as (event: string, payload: object) => void)(
      "notifications:new",
      notificationPayload,
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("onRealtimeNotification antes de connect → no lanza (socket es null-safe)", () => {
    // Sin connectRealtime, realtimeSocket es null
    const handler = vi.fn();
    const unsubscribe = onRealtimeNotification(handler);

    expect(unsubscribe).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("realtime — onRealtimeInvalidation", () => {
  it("registra un listener para el evento 'queries:invalidate'", () => {
    connectRealtime("test-token");

    const handler = vi.fn();
    const unsubscribe = onRealtimeInvalidation(handler);

    expect(fakeSocket.on).toHaveBeenCalledWith(
      "queries:invalidate",
      expect.any(Function),
    );

    unsubscribe();
  });

  it("el handler recibe el payload de invalidación", () => {
    connectRealtime("test-token");

    const handler = vi.fn();
    const invalidationPayload = {
      type: "members.changed",
      queryKeys: [["members"]],
      timestamp: new Date().toISOString(),
    };

    const unsubscribe = onRealtimeInvalidation(handler);
    (fakeSocket.__emit as unknown as (event: string, payload: object) => void)(
      "queries:invalidate",
      invalidationPayload,
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(invalidationPayload);

    unsubscribe();
  });
});

describe("realtime — connect/disconnect", () => {
  it("connectRealtime inicializa socket con auth token", () => {
    connectRealtime("mi-token-secreto");

    expect(mockedIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: { token: "mi-token-secreto" },
        transports: ["websocket", "polling"],
      }),
    );
  });

  it("disconnectRealtime llama disconnect en el socket", () => {
    connectRealtime("test-token");
    disconnectRealtime();

    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("connectRealtime desconecta socket previo antes de conectar otro", () => {
    connectRealtime("token-1");
    connectRealtime("token-2");

    // El primer socket fue desconectado
    expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
  });
});
