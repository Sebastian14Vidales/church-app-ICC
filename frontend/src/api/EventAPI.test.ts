import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "@/lib/axios";
import {
  getEventsByStatus,
  getEventHistory,
  exportEventRegistrations,
  type EventStatus,
} from "./EventAPI";

/**
 * Tests unitarios para `EventAPI.ts` — especialmente las funciones
 * añadidas en ADR-0008:
 *   - getEventsByStatus(status)     → GET /api/events?status=<status>
 *   - getEventHistory()              → GET /api/events/history
 *   - exportEventRegistrations(id)  → GET /api/events/:id/export/registrations
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

const sampleEventResponse = {
  _id: "ev-1",
  name: "Retiro de jóvenes",
  capacity: 100,
  date: "2026-08-15",
  time: "09:00",
  place: "Sede Central",
  price: 25000,
  description: "Un retiro increíble",
  registrationDeadline: null,
  registrationClosed: false,
  registrationWindowClosed: false,
  daysUntilRegistrationDeadline: null,
  isPast: false,
  registrations: [],
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
  },
};

describe("EventAPI — ADR-0008 functions", () => {
  beforeEach(resetMocks);

  describe("getEventsByStatus", () => {
    it("llama a GET /events con params { status: 'upcoming' }", async () => {
      mockedApi.get.mockResolvedValue({ data: [sampleEventResponse] });

      const result = await getEventsByStatus("upcoming");

      expect(mockedApi.get).toHaveBeenCalledWith("/events", { params: { status: "upcoming" } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Retiro de jóvenes");
    });

    it("llama a GET /events con params { status: 'past' }", async () => {
      mockedApi.get.mockResolvedValue({
        data: [{ ...sampleEventResponse, _id: "ev-past", name: "Campaña anterior", isPast: true }],
      });

      const result = await getEventsByStatus("past");

      expect(mockedApi.get).toHaveBeenCalledWith("/events", { params: { status: "past" } });
      expect(result).toHaveLength(1);
      expect(result[0].isPast).toBe(true);
      expect(result[0].name).toBe("Campaña anterior");
    });

    it("normaliza la fecha del evento con extractDateOnly", async () => {
      mockedApi.get.mockResolvedValue({
        data: [{ ...sampleEventResponse, date: "2026-08-15T14:30:00.000Z" }],
      });

      const result = await getEventsByStatus("upcoming");

      // La respuesta normalizada debe tener date sin time ISO
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("devuelve array vacío cuando la API devuelve array vacío", async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      const result = await getEventsByStatus("upcoming");

      expect(result).toEqual([]);
    });
  });

  describe("getEventHistory", () => {
    it("llama a GET /events/history sin params", async () => {
      mockedApi.get.mockResolvedValue({
        data: [{ ...sampleEventResponse, isPast: true }],
      });

      const result = await getEventHistory();

      expect(mockedApi.get).toHaveBeenCalledWith("/events/history");
      expect(result).toHaveLength(1);
      expect(result[0].isPast).toBe(true);
    });

    it("normaliza fechas del historial", async () => {
      mockedApi.get.mockResolvedValue({
        data: [{ ...sampleEventResponse, date: "2025-01-10T08:00:00.000Z", isPast: true }],
      });

      const result = await getEventHistory();

      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("devuelve array vacío cuando no hay eventos históricos", async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      const result = await getEventHistory();

      expect(result).toEqual([]);
    });
  });

  describe("exportEventRegistrations", () => {
    it("llama a GET /events/:id/export/registrations con responseType blob", async () => {
      const blobData = new Blob(["test"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      mockedApi.get.mockResolvedValue({ data: blobData });

      const result = await exportEventRegistrations("ev-export-1");

      expect(mockedApi.get).toHaveBeenCalledWith(
        "/events/ev-export-1/export/registrations",
        { responseType: "blob" },
      );
      expect(result).toBe(blobData);
    });

    it("pasa el eventId correcto en la URL", async () => {
      mockedApi.get.mockResolvedValue({
        data: new Blob([], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      });

      await exportEventRegistrations("custom-event-id-123");

      expect(mockedApi.get).toHaveBeenCalledWith(
        "/events/custom-event-id-123/export/registrations",
        expect.objectContaining({ responseType: "blob" }),
      );
    });
  });
});
