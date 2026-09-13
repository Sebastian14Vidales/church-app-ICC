import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MyCoverage from "./MyCoverage";

/**
 * Regression tests para MyCoverage (ADR-0018 — MyCoverage sin campo Asistentes).
 *
 * El formulario de crear/editar grupo de vida NO debe incluir el campo "Asistentes"
 * ni enviar `attendees` en el payload — esa funcionalidad es gestionada por el líder
 * desde MyLifeGroup.
 *
 * Tests para el paso 9 del flujo canónico.
 * Sin console.log, sin any. Cada test es determinista e independiente.
 */

// ---- fixtures ---------------------------------------------------------------

const ADMIN_USER = {
  user: {
    id: "u-admin",
    email: "admin@icc.test",
    name: "Admin Test",
    roles: ["Admin"] as string[],
    profileId: "profile-admin",
  },
  isAuthenticated: true,
};

const makeMember = (id: string, firstName: string, lastName: string, roleName: string) => ({
  _id: id,
  firstName,
  lastName,
  baptized: true,
  role: { _id: `role-${roleName.toLowerCase()}`, name: roleName },
  user: null,
  documentID: "12345678",
  phoneNumber: "3001234567",
  neighborhood: "Centro",
  birthdate: "1990-01-01",
  bloodType: "O+",
  servesInMinistry: false,
  ministry: null,
  ministryInterest: null,
});

const makeLifeGroup = (overrides: Partial<{
  _id: string; name: string; neighborhood: string; address: string;
  type: "life-group" | "couple-group"; attendees: ReturnType<typeof makeMember>[];
}> = {}) => ({
  _id: overrides._id ?? "lg-1",
  name: overrides.name ?? "Grupo Central",
  neighborhood: overrides.neighborhood ?? "Centro",
  address: overrides.address ?? "Calle 10 # 20-30",
  type: overrides.type ?? "life-group",
  leader: makeMember("profile-lider", "Juan", "Líder", "Lider"),
  supervisor: makeMember("profile-sup", "María", "Supervisora", "Supervisor"),
  attendees: overrides.attendees ?? [],
  sessions: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

// ---- mocks -----------------------------------------------------------------

const mockGetMyLifeGroups = vi.fn();
const mockGetAllMembers = vi.fn();
const mockCreateLifeGroup = vi.fn();
const mockUpdateLifeGroup = vi.fn();

vi.mock("@/api/LifeGroupAPI", () => ({
  getMyLifeGroups: (...args: unknown[]) => mockGetMyLifeGroups(...args),
  createLifeGroup: (...args: unknown[]) => mockCreateLifeGroup(...args),
  updateLifeGroup: (...args: unknown[]) => mockUpdateLifeGroup(...args),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/dashboard/ModalView", () => ({
  default: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
      </div>
    ) : null,
}));

vi.mock("@/components/common/FormSelect", () => ({
  default: ({
    name,
    children,
    "aria-label": ariaLabel,
  }: {
    name: string;
    children: React.ReactNode;
    "aria-label": string;
  }) => (
    <div data-testid="form-select" data-name={name} aria-label={ariaLabel}>
      {children}
    </div>
  ),
}));

const mockUseAuth = vi.fn(() => ADMIN_USER);
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
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  };
};

const setupUser = () => userEvent.setup();

// ---- tests -----------------------------------------------------------------

describe("MyCoverage — ADR-0018: el formulario NO incluye campo Asistentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(ADMIN_USER);
    mockGetMyLifeGroups.mockResolvedValue([]);
    mockGetAllMembers.mockResolvedValue([
      makeMember("profile-lider", "Juan", "Líder", "Lider"),
      makeMember("profile-sup", "María", "Supervisora", "Supervisor"),
      makeMember("member-1", "Pedro", "Asistente", "Asistente"),
    ]);
    mockCreateLifeGroup.mockResolvedValue({ message: "Grupo creado" });
    mockUpdateLifeGroup.mockResolvedValue({ message: "Grupo actualizado" });
  });

  it("el formulario de crear NO contiene ningún campo 'Asistentes'", async () => {
    const user = setupUser();
    mockGetMyLifeGroups.mockResolvedValue([]);

    renderWithProviders(<MyCoverage />);

    await waitFor(() => {
      expect(screen.queryByText(/cargando cobertura/i)).not.toBeInTheDocument();
    });

    // Open create modal
    const createButton = screen.getByRole("button", { name: /nuevo grupo de vida/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    // Check that NO FormSelect with name="attendees" exists
    const allSelects = document.querySelectorAll('[data-testid="form-select"]');
    const attendeeSelects = Array.from(allSelects).filter(
      (el) => el.getAttribute("data-name") === "attendees",
    );
    expect(attendeeSelects).toHaveLength(0);
  });

  it("el formulario de editar (grupo existente) NO contiene ningún campo 'Asistentes'", async () => {
    const user = setupUser();
    const existingGroup = makeLifeGroup({
      _id: "lg-existing",
      name: "Grupo Existente",
      attendees: [makeMember("member-1", "Pedro", "Asistente", "Asistente")],
    });
    mockGetMyLifeGroups.mockResolvedValue([existingGroup]);

    renderWithProviders(<MyCoverage />);

    // Wait for groups to load
    await waitFor(() => {
      expect(screen.getByText("Grupo Existente")).toBeInTheDocument();
    });

    // Click edit button
    const editButton = screen.getByRole("button", { name: /editar grupo/i });
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    // Check that NO FormSelect with name="attendees" exists
    const allSelects = document.querySelectorAll('[data-testid="form-select"]');
    const attendeeSelects = Array.from(allSelects).filter(
      (el) => el.getAttribute("data-name") === "attendees",
    );
    expect(attendeeSelects).toHaveLength(0);
  });

  it("al crear, el payload de createLifeGroup NO incluye attendees", async () => {
    const user = setupUser();
    mockGetMyLifeGroups.mockResolvedValue([]);
    const createSpy = vi.fn().mockResolvedValue({ message: "Grupo creado" });
    mockCreateLifeGroup.mockImplementation(createSpy);

    renderWithProviders(<MyCoverage />);

    await waitFor(() => {
      expect(screen.queryByText(/cargando cobertura/i)).not.toBeInTheDocument();
    });

    // Open create modal
    const createButton = screen.getByRole("button", { name: /nuevo grupo de vida/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    // Fill required fields (using form inputs)
    const nameInput = document.querySelector('input[id="coverage-name"]') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Nuevo Grupo Test");

    const neighborhoodInput = document.querySelector('input[id="coverage-neighborhood"]') as HTMLInputElement;
    await user.clear(neighborhoodInput);
    await user.type(neighborhoodInput, "Barrio Nuevo");

    const addressInput = document.querySelector('input[id="coverage-address"]') as HTMLInputElement;
    await user.clear(addressInput);
    await user.type(addressInput, "Dirección Nueva");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /crear grupo/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });

    // Verify the payload does NOT contain attendees
    const calledWith = createSpy.mock.calls[createSpy.mock.calls.length - 1][0];
    expect(calledWith).not.toHaveProperty("attendees");
  });

  it("el formulario muestra la nota informativa sobre gestión de asistentes", async () => {
    const user = setupUser();
    mockGetMyLifeGroups.mockResolvedValue([]);

    renderWithProviders(<MyCoverage />);

    await waitFor(() => {
      expect(screen.queryByText(/cargando cobertura/i)).not.toBeInTheDocument();
    });

    // Open create modal
    const createButton = screen.getByRole("button", { name: /nuevo grupo de vida/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeInTheDocument();
    });

    // The info note should mention that attendees are managed by the leader
    expect(screen.getByText(/los asistentes los gestiona el líder/i)).toBeInTheDocument();
  });
});
