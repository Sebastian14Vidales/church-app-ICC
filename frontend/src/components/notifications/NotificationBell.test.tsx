import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import type { Mock } from "vitest";

/**
 * Tests unitarios de `NotificationBell.tsx` (pista A).
 *
 * Cover:
 *  - Badge: unreadCount 0 → sin badge; 5 → "5"; 120 → "99+"
 *  - Dropdown abre/cierra (click y Escape)
 *  - Dropdown muestra lista ítems con título/mensaje
 *  - Ítem no leído con indicador visual (dot)
 *  - Click en ítem → marca leída y navega al link
 *  - "Marcar todas como leídas" dispara la mutación
 *  - Estados vacío y error con copy en español
 *
 * Sin `any`; sin `console.log`; determinista.
 */

// ---- mocks --------------------------------------------------------------

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { info: vi.fn() },
}));

import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

const mockedUseNotifications = useNotifications as unknown as Mock;
const mockedUseNavigate = useNavigate as unknown as Mock;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
};

const now = new Date().toISOString();

const makeNotification = (overrides: {
  _id?: string;
  title?: string;
  message?: string;
  link?: string | null;
  readAt?: string | null;
}) => ({
  _id: "n1",
  title: "Nueva asignación de curso",
  message: "Se te asignó el curso «Fundamentos de la Fe».",
  link: "/my-courses",
  readAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

// ---- helpers ------------------------------------------------------------

const buildNotificationsResult = (
  notifications: ReturnType<typeof makeNotification>[],
  unreadCount: number,
) => ({
  notifications,
  unreadCount,
  isLoading: false,
  isError: false,
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  isMarkingAllRead: false,
});

// ---- tests --------------------------------------------------------------

describe("NotificationBell — Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unreadCount=0 → no renderiza el badge", () => {
    mockedUseNotifications.mockReturnValue(buildNotificationsResult([], 0));
    renderWithProviders(<NotificationBell />);

    // No debe haber span con número de badge
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // El badge (span con bg-red-600) no debe existir
    const badge = screen.queryByRole("status");
    expect(badge).toBeNull();
  });

  it("unreadCount=5 → badge muestra '5'", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult([makeNotification({ _id: "n1" })], 5),
    );
    renderWithProviders(<NotificationBell />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("unreadCount=120 → badge muestra '99+'", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult(Array.from({ length: 120 }, (_, i) => makeNotification({ _id: `n${i}` })), 120),
    );
    renderWithProviders(<NotificationBell />);

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.queryByText("120")).not.toBeInTheDocument();
  });

  it("aria-label refleja el count correcto", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult([makeNotification()], 3),
    );
    renderWithProviders(<NotificationBell />);

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Notificaciones (3 no leídas)");
  });

  it("aria-label sin unread → 'Notificaciones'", () => {
    mockedUseNotifications.mockReturnValue(buildNotificationsResult([], 0));
    renderWithProviders(<NotificationBell />);

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Notificaciones");
  });
});

describe("NotificationBell — Dropdown open/close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("click en el botón abre el dropdown", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult([makeNotification()], 1),
    );
    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Notificaciones")).toBeInTheDocument();
  });

  it("Escape cierra el dropdown", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult([makeNotification()], 1),
    );
    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("click fuera del dropdown lo cierra", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult([makeNotification()], 1),
    );
    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("NotificationBell — Lista de ítems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza título y mensaje de cada notificación", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult(
        [
          makeNotification({
            _id: "n1",
            title: "Nueva asignación",
            message: "Se te asignó el curso.",
          }),
          makeNotification({
            _id: "n2",
            title: "Inscripción en curso",
            message: "Fuiste inscrito en un curso.",
          }),
        ],
        2,
      ),
    );
    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Nueva asignación")).toBeInTheDocument();
    expect(screen.getByText("Se te asignó el curso.")).toBeInTheDocument();
    expect(screen.getByText("Inscripción en curso")).toBeInTheDocument();
    expect(screen.getByText("Fuiste inscrito en un curso.")).toBeInTheDocument();
  });

  it("ítem no leído muestra indicador visual (dot azul)", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult(
        [
          makeNotification({ _id: "n1", readAt: null }),
          makeNotification({ _id: "n2", readAt: now }),
        ],
        1,
      ),
    );
    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole("button"));

    // El dot azul (span con bg-blue-600) solo para n1
    const dots = screen.getAllByText("", { selector: "span" });
    // Al menos 1 dot visible para la notificación no leída
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it("ítem leído NO muestra indicador visual", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult(
        [makeNotification({ _id: "n1", readAt: now })],
        0,
      ),
    );
    renderWithProviders(<NotificationBell />);

    fireEvent.click(screen.getByRole("button"));

    // No hay dot azul cuando está todo leído
    // (El dot solo se renderiza cuando !readAt)
    const blueDot = screen.queryByText("", {
      selector: "span.bg-blue-600",
    });
    expect(blueDot).toBeNull();
  });
});

describe("NotificationBell — Interacciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("click en ítem con link → marca leída y navega", async () => {
    const markRead = vi.fn();
    const navigate = vi.fn();
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult(
        [makeNotification({ _id: "n1", readAt: null, link: "/my-courses" })],
        1,
      ),
    );
    mockedUseNotifications.mockReturnValue({
      ...buildNotificationsResult([makeNotification({ _id: "n1" })], 1),
      markRead,
    });
    mockedUseNavigate.mockReturnValue(navigate as never);

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    const menuItems = screen.getAllByRole("menuitem");
    fireEvent.click(menuItems[0]);

    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).toHaveBeenCalledWith("/my-courses");
  });

  it("click en ítem sin link → solo marca leída, no navega", () => {
    const markRead = vi.fn();
    const navigate = vi.fn();
    mockedUseNotifications.mockReturnValue({
      ...buildNotificationsResult(
        [makeNotification({ _id: "n1", readAt: null, link: null })],
        1,
      ),
      markRead,
    });
    mockedUseNavigate.mockReturnValue(navigate as never);

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    const menuItems = screen.getAllByRole("menuitem");
    fireEvent.click(menuItems[0]);

    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Marcar todas como leídas" dispara markAllRead', () => {
    const markAllRead = vi.fn();
    mockedUseNotifications.mockReturnValue({
      ...buildNotificationsResult(
        [
          makeNotification({ _id: "n1", readAt: null }),
          makeNotification({ _id: "n2", readAt: null }),
        ],
        2,
      ),
      markAllRead,
    });

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    const markAllButton = screen.getByText("Marcar todas como leídas");
    fireEvent.click(markAllButton);

    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it("'Marcar todas como leídas' no aparece cuando no hay notificaciones no leídas", () => {
    mockedUseNotifications.mockReturnValue(
      buildNotificationsResult(
        [makeNotification({ _id: "n1", readAt: now })],
        0,
      ),
    );

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByText("Marcar todas como leídas")).not.toBeInTheDocument();
  });
});

describe("NotificationBell — Estados vacío y error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estado vacío: copy en español 'No tienes notificaciones'", () => {
    mockedUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isError: false,
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      isMarkingAllRead: false,
    });

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("No tienes notificaciones")).toBeInTheDocument();
    expect(
      screen.getByText("Te avisaremos cuando haya algo nuevo."),
    ).toBeInTheDocument();
  });

  it("estado error: copy en español 'No pudimos cargar tus notificaciones'", () => {
    mockedUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isError: true,
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      isMarkingAllRead: false,
    });

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    expect(
      screen.getByText("No pudimos cargar tus notificaciones"),
    ).toBeInTheDocument();
  });

  it("estado loading: spinner con label 'Cargando notificaciones...'", () => {
    mockedUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: true,
      isError: false,
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      isMarkingAllRead: false,
    });

    renderWithProviders(<NotificationBell />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("img", { name: "Cargando notificaciones..." })).toBeInTheDocument();
  });
});
