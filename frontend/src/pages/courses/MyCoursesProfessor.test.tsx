import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import MyCoursesProfessor from "./MyCoursesProfessor";

/**
 * Regression tests para MyCoursesProfessor (ADR-0018 D1/D3 — historial de cursos del profesor).
 *
 * Tests para el paso 9 del flujo canónico.
 * Sin console.log, sin any. Cada test es determinista e independiente.
 */

// ---- fixtures ---------------------------------------------------------------

const PROFESSOR_USER = {
  user: {
    id: "u-prof",
    email: "prof@icc.test",
    name: "Prof Test",
    roles: ["Profesor"] as string[],
    profileId: "profile-prof",
  },
  isAuthenticated: true,
};

const makeCourse = (overrides: Partial<{
  _id: string; name: string; description: string; level: number; spiritualGrowthStage: string;
}> = {}) => ({
  _id: overrides._id ?? "course-1",
  name: overrides.name ?? "Curso de Fe",
  description: overrides.description ?? "Un curso sobre la fe",
  level: overrides.level ?? 1,
  spiritualGrowthStage: overrides.spiritualGrowthStage ?? "Crecimiento Espiritual 1",
  isActive: true,
});

const makeParticipant = (id: string, firstName: string, lastName: string) => ({
  _id: id,
  firstName,
  lastName,
  role: { _id: "role-member", name: "Miembro" },
  documentID: "12345678",
});

const makeActiveAssignment = (overrides: Partial<{
  _id: string; course: ReturnType<typeof makeCourse>; members: ReturnType<typeof makeParticipant>[];
  totalClasses: number; registeredSessions: number;
}> = {}) => ({
  _id: overrides._id ?? "assign-active-1",
  course: overrides.course ?? makeCourse(),
  professor: makeParticipant("profile-prof", "Prof", "Test"),
  members: overrides.members ?? [],
  startDate: "2026-01-01T00:00:00.000Z",
  startTime: "09:00",
  totalClasses: overrides.totalClasses ?? 8,
  registeredSessions: overrides.registeredSessions ?? 0,
  endDate: "2026-03-01T00:00:00.000Z",
  location: "sala-1",
  status: "active" as const,
  endedAt: null,
  deletedAt: null,
});

const makeHistoryItem = (overrides: Partial<{
  _id: string; course: ReturnType<typeof makeCourse>; members: ReturnType<typeof makeParticipant>[];
  totalClasses: number; registeredSessions: number;
}> = {}) => ({
  ...makeActiveAssignment(overrides),
  _id: overrides._id ?? "assign-hist-1",
  status: "completed" as const,
  endedAt: "2026-03-01T00:00:00.000Z",
});

const makeHistoryDetail = (
  assignmentId: string,
  sessions: Array<{
    classNumber: number; date: string; attendance: Array<{ member: ReturnType<typeof makeParticipant>; present: boolean }>
  }> = [],
  overrides: Partial<{ course: ReturnType<typeof makeCourse> }> = {},
) => ({
  _id: assignmentId,
  course: overrides.course ?? makeCourse(),
  professor: makeParticipant("profile-prof", "Prof", "Test"),
  members: [makeParticipant("member-1", "Juan", "Pérez")],
  startDate: "2026-01-01T00:00:00.000Z",
  startTime: "09:00",
  totalClasses: 8,
  registeredSessions: sessions.length,
  endDate: "2026-03-01T00:00:00.000Z",
  location: "sala-1",
  status: "completed" as const,
  endedAt: "2026-03-01T00:00:00.000Z",
  deletedAt: null,
  sessions: sessions.map((s) => ({
    classNumber: s.classNumber,
    date: s.date,
    completedAt: s.date,
    topic: "",
    observations: "",
    attendance: s.attendance.map(a => ({
      member: a.member,
      present: a.present,
      notes: "",
    })),
  })),
});

const makeAttendanceOverview = (sessions: Array<{ _id: string }> = []) => ({
  sessions,
});

// ---- mocks -----------------------------------------------------------------

const mockUseMyActiveCourseAssignments = vi.fn();
const mockUseMyCourseAssignmentHistory = vi.fn();
const mockUseMyAttendanceOverview = vi.fn();
const mockUseUpdateCourseMembers = vi.fn();
const mockUseCloseCourseAssignment = vi.fn();
const mockUseCourseAssignmentDetail = vi.fn();
const mockExportAttendanceExcel = vi.fn();
const mockDownloadAttendancePdfReport = vi.fn();
const mockTriggerFileDownload = vi.fn();

vi.mock("@/hooks/courses", () => ({
  useMyActiveCourseAssignments: (...args: unknown[]) => mockUseMyActiveCourseAssignments(...args),
  useMyCourseAssignmentHistory: (...args: unknown[]) => mockUseMyCourseAssignmentHistory(...args),
  useMyAttendanceOverview: (...args: unknown[]) => mockUseMyAttendanceOverview(...args),
  useUpdateCourseMembers: () => mockUseUpdateCourseMembers(),
  useCloseCourseAssignment: () => mockUseCloseCourseAssignment(),
  useCourseAssignmentDetail: (...args: unknown[]) => mockUseCourseAssignmentDetail(...args),
}));

vi.mock("@/api/CourseAPI", () => ({
  exportAttendanceExcel: (...args: unknown[]) => mockExportAttendanceExcel(...args),
}));

vi.mock("@/utils/attendanceReport", () => ({
  downloadAttendancePdfReport: (...args: unknown[]) => mockDownloadAttendancePdfReport(...args),
}));

vi.mock("@/utils/file-download", () => ({
  triggerFileDownload: (...args: unknown[]) => mockTriggerFileDownload(...args),
}));

vi.mock("@/api/MemberAPI", () => ({
  getAllMembers: vi.fn().mockResolvedValue([]),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/alert/SweetAlert", () => ({
  showSweetAlert: vi.fn(),
}));

vi.mock("@/components/dashboard/ModalView", () => ({
  default: vi.fn(),
}));

const mockUseAuth = vi.fn(() => PROFESSOR_USER);
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// ---- helpers ----------------------------------------------------------------

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </MemoryRouter>,
    ),
    queryClient,
  };
};

const setupUser = () => userEvent.setup();

// ---- tests -----------------------------------------------------------------

describe("MyCoursesProfessor — Tab Historial (ADR-0018 D1/D3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(PROFESSOR_USER);

    // Default: active course loaded, no history
    mockUseMyActiveCourseAssignments.mockReturnValue({
      data: [makeActiveAssignment()],
      isLoading: false,
      isError: false,
    });
    mockUseMyCourseAssignmentHistory.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    mockUseMyAttendanceOverview.mockReturnValue({
      data: makeAttendanceOverview([]),
      isLoading: false,
      isError: false,
    });
    mockUseUpdateCourseMembers.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue("Miembros actualizados"),
      isPending: false,
    });
    mockUseCloseCourseAssignment.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue("Curso cerrado"),
      isPending: false,
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: null,
    });
  });

  it("al expandir un curso cerrado en Historial, el hero muestra datos del curso + badge 'Curso completado'", async () => {
    const user = setupUser();
    const historyItem = makeHistoryItem({
      _id: "hist-1",
      course: makeCourse({ name: "Curso de Crecimiento" }),
    });
    const historyDetail = makeHistoryDetail(
      "hist-1",
      [
        {
          classNumber: 1,
          date: "2026-01-15T00:00:00.000Z",
          attendance: [{ member: makeParticipant("member-1", "Juan", "Pérez"), present: true }],
        },
      ],
      { course: makeCourse({ name: "Curso de Crecimiento" }) },
    );

    mockUseMyCourseAssignmentHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [historyItem],
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: historyDetail,
    });

    renderWithProviders(<MyCoursesProfessor />);

    // Switch to History tab
    const historyTab = screen.getByRole("tab", { name: /historial/i });
    await user.click(historyTab);

    // Expand the history item
    const expandButton = screen.getByRole("button", { name: /ver detalle de curso de crecimiento/i });
    await user.click(expandButton);

    // Hero should show "Curso completado" badge
    await waitFor(() => {
      expect(screen.getByText("Curso completado")).toBeInTheDocument();
    });

    // Hero should show the course name
    expect(screen.getByRole("heading", { name: "Curso de Crecimiento", level: 1 })).toBeInTheDocument();
  });

  it("al colapsar un curso cerrado, el hero vuelve al curso activo", async () => {
    const user = setupUser();
    const historyItem = makeHistoryItem({
      _id: "hist-1",
      course: makeCourse({ name: "Curso Cerrado" }),
    });
    const historyDetail = makeHistoryDetail("hist-1", []);

    mockUseMyCourseAssignmentHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [historyItem],
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: historyDetail,
    });

    renderWithProviders(<MyCoursesProfessor />);

    // Switch to History tab
    const historyTab = screen.getByRole("tab", { name: /historial/i });
    await user.click(historyTab);

    // Expand the history item
    const expandButton = screen.getByRole("button", { name: /ver detalle de curso cerrado/i });
    await user.click(expandButton);

    // Hero shows history course
    await waitFor(() => {
      expect(screen.getByText("Curso completado")).toBeInTheDocument();
    });

    // Collapse
    const collapseButton = screen.getByRole("button", { name: /ocultar detalle/i });
    await user.click(collapseButton);

    // Hero returns to active course view (no "Curso completado" badge)
    await waitFor(() => {
      expect(screen.queryByText("Curso completado")).not.toBeInTheDocument();
    });
  });

  it("con detalle cargado y sesiones, los botones PDF y Excel están habilitados", async () => {
    const user = setupUser();
    const historyItem = makeHistoryItem({ _id: "hist-1" });
    const historyDetail = makeHistoryDetail("hist-1", [
      {
        classNumber: 1,
        date: "2026-01-15T00:00:00.000Z",
        attendance: [{ member: makeParticipant("member-1", "Juan", "Pérez"), present: true }],
      },
    ]);

    mockUseMyCourseAssignmentHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [historyItem],
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: historyDetail,
    });
    mockExportAttendanceExcel.mockReturnValue(Promise.resolve(new Blob(["test"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })));

    renderWithProviders(<MyCoursesProfessor />);

    const historyTab = screen.getByRole("tab", { name: /historial/i });
    await user.click(historyTab);

    const expandButton = screen.getByRole("button", { name: /ver detalle/i });
    await user.click(expandButton);

    await waitFor(() => {
      expect(screen.getAllByText("Descargar reporte PDF")[0]).toBeInTheDocument();
    });

    const pdfButton = screen.getAllByRole("button", { name: /descargar reporte pdf/i })[0];
    const excelButton = screen.getAllByRole("button", { name: /exportar excel/i })[0];

    expect(pdfButton).not.toBeDisabled();
    expect(excelButton).not.toBeDisabled();
  });

  it("PDF botón llama a downloadAttendancePdfReport con el filename correcto", async () => {
    const user = setupUser();
    const historyItem = makeHistoryItem({
      _id: "hist-1",
      course: makeCourse({ name: "Curso de Fe" }),
    });
    const historyDetail = makeHistoryDetail("hist-1", [
      {
        classNumber: 1,
        date: "2026-01-15T00:00:00.000Z",
        attendance: [{ member: makeParticipant("member-1", "Juan", "Pérez"), present: true }],
      },
    ]);

    mockUseMyCourseAssignmentHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [historyItem],
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: historyDetail,
    });

    renderWithProviders(<MyCoursesProfessor />);

    const historyTab = screen.getByRole("tab", { name: /historial/i });
    await user.click(historyTab);

    const expandButton = screen.getByRole("button", { name: /ver detalle/i });
    await user.click(expandButton);

    await waitFor(() => {
      expect(screen.getAllByText("Descargar reporte PDF")[0]).toBeInTheDocument();
    });

    const pdfButton = screen.getAllByRole("button", { name: /descargar reporte pdf/i })[0];
    await user.click(pdfButton);

    expect(mockDownloadAttendancePdfReport).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: historyDetail,
        sessions: historyDetail.sessions,
        filename: "asistencia-Curso de Fe.pdf",
      }),
    );
  });

  it("Excel botón llama a exportAttendanceExcel y triggerFileDownload con filename correcto", async () => {
    const user = setupUser();
    const historyItem = makeHistoryItem({
      _id: "hist-1",
      course: makeCourse({ name: "Curso de Fe" }),
    });
    const historyDetail = makeHistoryDetail("hist-1", [
      {
        classNumber: 1,
        date: "2026-01-15T00:00:00.000Z",
        attendance: [{ member: makeParticipant("member-1", "Juan", "Pérez"), present: true }],
      },
    ]);

    mockUseMyCourseAssignmentHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [historyItem],
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: historyDetail,
    });
    const blob = new Blob(["test"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    mockExportAttendanceExcel.mockResolvedValue(blob);

    renderWithProviders(<MyCoursesProfessor />);

    const historyTab = screen.getByRole("tab", { name: /historial/i });
    await user.click(historyTab);

    const expandButton = screen.getByRole("button", { name: /ver detalle/i });
    await user.click(expandButton);

    await waitFor(() => {
      expect(screen.getAllByText("Exportar Excel")[0]).toBeInTheDocument();
    });

    const excelButton = screen.getAllByRole("button", { name: /exportar excel/i })[0];
    await user.click(excelButton);

    await waitFor(() => {
      expect(mockExportAttendanceExcel).toHaveBeenCalledWith("hist-1", expect.any(Object));
    });

    // The mutation onSuccess calls triggerFileDownload with the blob and filename
    expect(mockTriggerFileDownload).toHaveBeenCalledWith(blob, "asistencia-Curso de Fe.xlsx");
  });

  it("con detalle sin sesiones, los botones PDF y Excel están deshabilitados", async () => {
    const user = setupUser();
    const historyItem = makeHistoryItem({ _id: "hist-1" });
    const historyDetailNoSessions = makeHistoryDetail("hist-1", []);

    mockUseMyCourseAssignmentHistory.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [historyItem],
    });
    mockUseCourseAssignmentDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      data: historyDetailNoSessions,
    });

    renderWithProviders(<MyCoursesProfessor />);

    const historyTab = screen.getByRole("tab", { name: /historial/i });
    await user.click(historyTab);

    const expandButton = screen.getByRole("button", { name: /ver detalle/i });
    await user.click(expandButton);

    await waitFor(() => {
      expect(screen.getAllByText("Descargar reporte PDF")[0]).toBeInTheDocument();
    });

    const pdfButton = screen.getAllByRole("button", { name: /descargar reporte pdf/i })[0];
    const excelButton = screen.getAllByRole("button", { name: /exportar excel/i })[0];

    expect(pdfButton).toBeDisabled();
    expect(excelButton).toBeDisabled();

    // Also check the status message
    expect(screen.getAllByText(/no tiene sesiones registradas/i)[0]).toBeInTheDocument();
  });
});
