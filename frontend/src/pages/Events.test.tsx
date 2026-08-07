import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Events from "../pages/Events";

/**
 * Regression tests para la entrega múltiple EPC-EVENTS-001 (ADR-0008):
 * - Historial automático de eventos (pasado vs. próximos)
 * - Exportación Excel de inscritos
 *
 * Tests para el paso 9 del flujo canónico.
 *
 * Sin `console.log`, sin `any`. Cada test es determinista e independiente.
 */

const createMockEvent = (overrides: Partial<Event> & { _id: string; isPast: boolean }): Event => ({
  _id: overrides._id,
  name: overrides.name ?? "Evento de prueba",
  capacity: overrides.capacity ?? 100,
  date: overrides.date ?? "2026-08-15T00:00:00.000Z",
  time: overrides.time ?? "09:00",
  place: overrides.place ?? "Sede principal",
  price: overrides.price ?? 0,
  description: overrides.description ?? "",
  registrationDeadline: overrides.registrationDeadline ?? null,
  registrationClosed: overrides.registrationClosed ?? false,
  registrationWindowClosed: overrides.registrationWindowClosed ?? false,
  daysUntilRegistrationDeadline: overrides.daysUntilRegistrationDeadline ?? null,
  isPast: overrides.isPast,
  registrations: overrides.registrations ?? [],
  summary: {
    registeredCount: 0,
    paidInFullCount: 0,
    partialPaymentCount: 0,
    debtCount: 0,
    cancelledCount: 0,
    paidTotal: 0,
    pendingTotal: 0,
    availableSpots: 100,
    occupancyRate: 0,
    ...overrides.summary,
  },
} as Event);

vi.mock("@/api/EventAPI", () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  deleteEventRegistration: vi.fn(),
  exportEventRegistrations: vi.fn(),
  getEventHistory: vi.fn(),
  getEventsByStatus: vi.fn(),
  updateEvent: vi.fn(),
  updateEventRegistration: vi.fn(),
  upsertEventRegistration: vi.fn(),
}));

vi.mock("@/api/MemberAPI", () => ({
  getAllMembers: vi.fn().mockResolvedValue([]),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@test.com", name: "Admin", roles: ["Admin"], profileId: "p1" },
    isAuthenticated: true,
  }),
}));

import {
  getEventsByStatus,
  getEventHistory,
  exportEventRegistrations,
} from "@/api/EventAPI";
import type { Event } from "@/api/EventAPI";
import type { Mock } from "vitest";

const mockedGetEventsByStatus = getEventsByStatus as Mock;
const mockedGetEventHistory = getEventHistory as Mock;
const mockedExportEventRegistrations = exportEventRegistrations as Mock;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactNode) => {
  const queryClient = createTestQueryClient();
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  };
};

describe("Events — ADR-0008: historial y exportación Excel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetEventsByStatus.mockResolvedValue([
      createMockEvent({ _id: "e1", name: "Retiro de jóvenes", isPast: false }),
    ]);
    mockedGetEventHistory.mockResolvedValue([
      createMockEvent({ _id: "e2", name: "Campaña pasada", isPast: true }),
    ]);
  });

  describe("tabs Próximos / Historial", () => {
    it("renderiza ambos tabs", async () => {
      renderWithProviders(<Events />);
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /Próximos eventos/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("tab", { name: /Historial/i })).toBeInTheDocument();
    });

    it("tab Próximos está activo por defecto (aria-selected=true)", async () => {
      renderWithProviders(<Events />);
      const upcomingTab = await screen.findByRole("tab", { name: /Próximos eventos/i });
      expect(upcomingTab).toHaveAttribute("aria-selected", "true");
    });

    it("al cambiar a Historial el tab Próximos pierde aria-selected=true", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Events />);

      const upcomingTab = await screen.findByRole("tab", { name: /Próximos eventos/i });
      expect(upcomingTab).toHaveAttribute("aria-selected", "true");

      const historyTab = screen.getByRole("tab", { name: /Historial/i });
      await user.click(historyTab);

      await waitFor(() => {
        expect(upcomingTab).toHaveAttribute("aria-selected", "false");
      });
    });

    it("se carga el historial desde getEventHistory al montar y no usa ?status=past", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Events />);

      await waitFor(() => {
        expect(mockedGetEventsByStatus).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockedGetEventHistory).toHaveBeenCalled();
      });

      const historyTab = screen.getByRole("tab", { name: /Historial/i });
      await user.click(historyTab);

      // El componente precarga ambas listas; el cambio de tab solo muestra la cache.
      expect(mockedGetEventHistory).toHaveBeenCalledTimes(1);
      expect(mockedGetEventsByStatus).not.toHaveBeenCalledWith("past");
    });

    it("muestra contenido del tab Historial al hacer click en el tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Events />);

      const historyTab = screen.getByRole("tab", { name: /Historial/i });
      await user.click(historyTab);

      const historyPanel = await screen.findByRole("tabpanel", { name: /Historial/i });
      await waitFor(() => {
        expect(historyPanel).toHaveTextContent("Campaña pasada");
      });
    });
  });

  describe("empty states", () => {
    it("muestra empty state en Próximos cuando no hay eventos próximos", async () => {
      mockedGetEventsByStatus.mockResolvedValueOnce([]);
      renderWithProviders(<Events />);

      const upcomingPanel = await screen.findByRole("tabpanel", { name: /Próximos eventos/i });
      await waitFor(() => {
        expect(upcomingPanel).toHaveTextContent(/Aún no hay próximos eventos/i);
      });
    });

    it("muestra empty state en Historial cuando no hay eventos pasados", async () => {
      const user = userEvent.setup();
      mockedGetEventHistory.mockResolvedValueOnce([]);
      renderWithProviders(<Events />);

      const historyTab = screen.getByRole("tab", { name: /Historial/i });
      await user.click(historyTab);

      const historyPanel = await screen.findByRole("tabpanel", { name: /Historial/i });
      await waitFor(() => {
        expect(historyPanel).toHaveTextContent(/Aún no hay eventos en el historial/i);
      });
    });
  });

  describe("exportación Excel", () => {
    it("botón Descargar Excel existe en el detalle", async () => {
      renderWithProviders(<Events />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Descargar Excel/i })).toBeInTheDocument();
      });
    });

    it("al hacer clic en Descargar Excel se llama a exportEventRegistrations con el id del evento seleccionado", async () => {
      const user = userEvent.setup();
      mockedExportEventRegistrations.mockResolvedValue(
        new Blob(["dummy"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-url");
      vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      renderWithProviders(<Events />);

      const downloadButton = await screen.findByRole("button", { name: /Descargar Excel/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockedExportEventRegistrations).toHaveBeenCalledWith("e1", expect.any(Object));
      });

      clickSpy.mockRestore();
    });

    it("el nombre del archivo de descarga incluye el nombre del evento", async () => {
      const user = userEvent.setup();
      const blob = new Blob(["dummy"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      mockedExportEventRegistrations.mockResolvedValue(blob);
      vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-url");
      vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

      let capturedDownload = "";
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tagName, options) => {
          const el = originalCreateElement(tagName as string, options);
          if (tagName === "a") {
            Object.defineProperty(el, "download", {
              set(value: string) {
                capturedDownload = value;
              },
              get() {
                return capturedDownload;
              },
              configurable: true,
            });
          }
          return el;
        });

      renderWithProviders(<Events />);

      const downloadButton = await screen.findByRole("button", { name: /Descargar Excel/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockedExportEventRegistrations).toHaveBeenCalled();
      });

      expect(capturedDownload).toContain("Retiro de jóvenes");
      expect(capturedDownload).toMatch(/\.xlsx$/);

      createElementSpy.mockRestore();
    });
  });

  describe("selección de evento al cambiar de tab", () => {
    it("al cambiar de tab se muestra el primer evento de la nueva lista", async () => {
      const user = userEvent.setup();
      mockedGetEventsByStatus.mockResolvedValueOnce([
        createMockEvent({ _id: "e1", name: "Primer evento próximo", isPast: false }),
      ]);
      mockedGetEventHistory.mockResolvedValueOnce([
        createMockEvent({ _id: "e2", name: "Evento histórico", isPast: true }),
      ]);

      renderWithProviders(<Events />);

      const upcomingPanel = await screen.findByRole("tabpanel", { name: /Próximos eventos/i });
      await waitFor(() => {
        expect(upcomingPanel).toHaveTextContent("Primer evento próximo");
      });

      const historyTab = screen.getByRole("tab", { name: /Historial/i });
      await user.click(historyTab);

      const historyPanel = await screen.findByRole("tabpanel", { name: /Historial/i });
      await waitFor(() => {
        expect(historyPanel).toHaveTextContent("Evento histórico");
      });
    });
  });
});
