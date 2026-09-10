import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Members from "./Members";
import type { Mock } from "vitest";

/**
 * Regression tests para la regla de badge "Miembro" (ADR-0011 §D1).
 *
 * Cuando un miembro bautizado tiene rol Profesor, Supervisor o Pastor
 * (como rol primario o en user.roles), el badge "Miembro" NO se renderiza.
 * Si está bautizado pero solo tiene rol Miembro, SÍ se renderiza.
 * Los no bautizados no se ven afectados.
 *
 * Tests para el paso 9 del flujo canónico.
 * Sin `console.log`, sin `any`. Cada test es determinista e independiente.
 */

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

vi.mock("@/api/MemberAPI", () => ({
  bulkImportMembers: vi.fn(),
  createMember: vi.fn(),
  deleteMember: vi.fn(),
  getAllMembers: vi.fn().mockResolvedValue([]),
  updateMember: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/alert/SweetAlert", () => ({
  showSweetAlert: vi.fn(),
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

const mockUseAuth = vi.fn(() => ADMIN_USER);
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { getAllMembers } from "@/api/MemberAPI";

const mockedGetAllMembers = getAllMembers as Mock;

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

// ---- helper para construir un miembro -----------------------------------

const makeMember = (overrides: {
  _id: string;
  baptized?: boolean;
  primaryRole?: string;
  extraRoles?: string[];
  firstName?: string;
  lastName?: string;
  spiritualGrowthStage?: string;
}): {
  _id: string;
  firstName: string;
  lastName: string;
  baptized: boolean;
  role: { _id: string; name: string };
  user: { _id: string; email: string; roles: Array<{ _id: string; name: string }> } | null;
  documentID: string;
  phoneNumber: string;
  neighborhood: string;
  birthdate: string;
  bloodType: string;
  servesInMinistry: boolean;
  ministry: string | null;
  ministryInterest: string | null;
  spiritualGrowthStage?: string;
} => ({
  _id: overrides._id,
  firstName: overrides.firstName ?? "Nombre",
  lastName: overrides.lastName ?? "Apellido",
  baptized: overrides.baptized ?? false,
  role: { _id: "role-1", name: overrides.primaryRole ?? "Miembro" },
  user: overrides.extraRoles
    ? {
        _id: "user-1",
        email: "test@test.com",
        roles: overrides.extraRoles.map((name) => ({ _id: `role-${name}`, name })),
      }
    : null,
  documentID: "12345678",
  phoneNumber: "3001234567",
  neighborhood: "Centro",
  birthdate: "1990-01-01",
  bloodType: "O+",
  servesInMinistry: false,
  ministry: null,
  ministryInterest: null,
  spiritualGrowthStage: overrides.spiritualGrowthStage,
});

// ---- tests ----------------------------------------------------------------

describe("Members — ADR-0011 §D1: regla de badge 'Miembro'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(ADMIN_USER);
  });

  /**
   * Helper: Renderiza la página con un solo miembro en la lista
   * y retorna una función para consultar si el texto "Miembro" aparece.
   */
  const renderWithMember = (member: ReturnType<typeof makeMember>) => {
    mockedGetAllMembers.mockResolvedValueOnce([member]);
    renderWithProviders(<Members />);
    return {
      getMiembroBadge: () => screen.queryByText("Miembro"),
    };
  };

  it("bautizado + rol primario Pastor → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m1",
      baptized: true,
      primaryRole: "Pastor",
      firstName: "Roberto",
      lastName: "Pérez",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Roberto Pérez/)).toBeInTheDocument();
    });

    // El badge "Miembro" no debe aparecer
    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });

  it("bautizado + rol primario Supervisor → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m2",
      baptized: true,
      primaryRole: "Supervisor",
      firstName: "Laura",
      lastName: "García",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Laura García/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });

  it("bautizado + rol primario Profesor → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m3",
      baptized: true,
      primaryRole: "Profesor",
      firstName: "María",
      lastName: "López",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/María López/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });

  it("bautizado + extraRole Pastor (sin rol primario elevado) → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m4",
      baptized: true,
      primaryRole: "Miembro",
      extraRoles: ["Pastor"],
      firstName: "José",
      lastName: "Ramírez",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/José Ramírez/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });

  it("bautizado + extraRole Supervisor → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m5",
      baptized: true,
      primaryRole: "Asistente",
      extraRoles: ["Supervisor"],
      firstName: "Diana",
      lastName: "Morales",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Diana Morales/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });

  it("bautizado + extraRole Profesor → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m6",
      baptized: true,
      primaryRole: "Asistente",
      extraRoles: ["Profesor"],
      firstName: "Carlos",
      lastName: "Hernández",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Carlos Hernández/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });

  it("bautizado + SOLO rol Miembro (sin roles elevados) → SÍ渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m7",
      baptized: true,
      primaryRole: "Miembro",
      extraRoles: [],
      firstName: "Pedro",
      lastName: "Soto",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Pedro Soto/)).toBeInTheDocument();
    });

    expect(screen.getByText("Miembro")).toBeInTheDocument();
  });

  it("NO bautizado + rol primario Pastor → muestra Pastor, 'Miembro' NO aparece (sin efecto)", async () => {
    const member = makeMember({
      _id: "m8",
      baptized: false,
      primaryRole: "Pastor",
      firstName: "Samuel",
      lastName: "Vega",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Samuel Vega/)).toBeInTheDocument();
    });

    // El badge "Miembro" no debe aparecer (la regla solo aplica a bautizados)
    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
    // Pastor sí debe aparecer
    expect(screen.getByText("Pastor")).toBeInTheDocument();
  });

  it("NO bautizado + SOLO rol Miembro → SÍ渲染 'Miembro' badge (sin cambios para no bautizados)", async () => {
    const member = makeMember({
      _id: "m9",
      baptized: false,
      primaryRole: "Miembro",
      firstName: "Lucía",
      lastName: "Castro",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Lucía Castro/)).toBeInTheDocument();
    });

    expect(screen.getByText("Miembro")).toBeInTheDocument();
  });

  it("bautizado + multiple extraRoles incluyendo Supervisor → NO渲染 'Miembro' badge", async () => {
    const member = makeMember({
      _id: "m10",
      baptized: true,
      primaryRole: "Miembro",
      extraRoles: ["Supervisor", "Profesor"],
      firstName: "Andrés",
      lastName: "Ruiz",
    });
    renderWithMember(member);

    await waitFor(() => {
      expect(screen.getByText(/Andrés Ruiz/)).toBeInTheDocument();
    });

    expect(screen.queryByText("Miembro")).not.toBeInTheDocument();
  });
});

// ---- ADR-0014 D5: filtro "Ninguna" — PENDIENTE --------------------------------
// El componente HeroUI Select (MemberFilters) no expone label/for de forma testeable
// con getByLabelText/getByRole en el harness actual (el for del <label> apunta al
// input interno de HeroUI, no al botón visible). Tests de interacción con el filtro
// requieren un approach de userEvent o深い conocimiento del DOM interno de HeroUI.
// Pendiente: cover el filtro "Ninguna" con tests de integración o tests de lógica
// pura (Members.tsx::matchesGrowthStage) extraídos a un helper testeable.
