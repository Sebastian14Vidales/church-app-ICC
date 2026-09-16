import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth, GuestOnly } from "./RouteGuards";
import { AuthContext } from "@/hooks/useAuth";
import type { AuthContextValue } from "@/lib/auth.types";
import PATHS from "@/utils/constants/routes";

/**
 * Unit tests para RequireAuth y GuestOnly (ADR-0020 — Dashboard role-based access).
 *
 * Tests de integración ligeros usando MemoryRouter con stubs sintéticos.
 * Se verifican: redirección por rol, isBootstrapping, usuario no autenticado,
 * y GuestOnly con sesión activa.
 *
 * Tests para el paso 9 del flujo canónico.
 * Sin console.log, sin any. Cada test es determinista e independiente.
 */

// ---- fixtures ----------------------------------------------------------------

const ADMIN_USER = {
  user: {
    id: "u-admin",
    email: "admin@icc.test",
    name: "Admin Test",
    roles: ["Admin"] as string[],
    profileId: "profile-admin",
  },
  isAuthenticated: true,
  isBootstrapping: false,
  isSessionTransitioning: false,
  token: "token-admin",
  login: vi.fn(),
  logout: vi.fn(),
};

const PROFESSOR_USER = {
  user: {
    id: "u-prof",
    email: "prof@icc.test",
    name: "Prof Test",
    roles: ["Profesor"] as string[],
    profileId: "profile-prof",
  },
  isAuthenticated: true,
  isBootstrapping: false,
  isSessionTransitioning: false,
  token: "token-prof",
  login: vi.fn(),
  logout: vi.fn(),
};

const SUPERVISOR_USER = {
  user: {
    id: "u-sup",
    email: "sup@icc.test",
    name: "Supervisor Test",
    roles: ["Supervisor"] as string[],
    profileId: "profile-sup",
  },
  isAuthenticated: true,
  isBootstrapping: false,
  isSessionTransitioning: false,
  token: "token-sup",
  login: vi.fn(),
  logout: vi.fn(),
};

const LIDEN_USER = {
  user: {
    id: "u-lider",
    email: "lider@icc.test",
    name: "Lider Test",
    roles: ["Lider"] as string[],
    profileId: "profile-lider",
  },
  isAuthenticated: true,
  isBootstrapping: false,
  isSessionTransitioning: false,
  token: "token-lider",
  login: vi.fn(),
  logout: vi.fn(),
};

const GUEST_USER = {
  user: null,
  isAuthenticated: false,
  isBootstrapping: false,
  isSessionTransitioning: false,
  token: null,
  login: vi.fn(),
  logout: vi.fn(),
};

const BOOTSTRAPPING_USER = {
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isSessionTransitioning: false,
  token: null,
  login: vi.fn(),
  logout: vi.fn(),
};

// ---- helpers ----------------------------------------------------------------

const renderWithAuth = (
  ui: React.ReactElement,
  initialEntries: string[],
  authValue: AuthContextValue,
) => {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          {/*
           * Stub "/protected" — ruta de prueba protegida por Admin/Superadmin.
           * Stub "/alternate" — destino de redirección para usuarios sin acceso.
           */}
          <Route
            path="/protected"
            element={<RequireAuth allowedRoles={["Admin", "Superadmin"]} />}
          >
            <Route
              index
              element={<div data-testid="protected-content">Protected Content</div>}
            />
          </Route>
          <Route
            path={PATHS.login}
            element={<div data-testid="login-page">Login Page</div>}
          />
          <Route
            path={PATHS.myCourses}
            element={<div data-testid="my-courses-page">My Courses</div>}
          />
          <Route
            path={PATHS.lifeGroups}
            element={<div data-testid="life-groups-page">Life Groups</div>}
          />
          <Route
            path={PATHS.myLifeGroup}
            element={<div data-testid="my-life-group-page">My Life Group</div>}
          />
          <Route
            path="*"
            element={<div data-testid="fallback-page">Fallback</div>}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

const renderGuestOnlyWithAuth = (
  ui: React.ReactElement,
  initialEntries: string[],
  authValue: AuthContextValue,
) => {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path={PATHS.login}
            element={<GuestOnly />}
          >
            <Route
              index
              element={<div data-testid="login-form">Login Form</div>}
            />
          </Route>
          <Route
            path={PATHS.myCourses}
            element={<div data-testid="my-courses-page">My Courses</div>}
          />
          <Route
            path="*"
            element={<div data-testid="fallback-page">Fallback</div>}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

// ---- RequireAuth tests -------------------------------------------------------

describe("RequireAuth — role-based access (ADR-0020)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Admin accessing /protected (allowed Admin/Superadmin) — renders protected content", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], ADMIN_USER);

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("Superadmin accessing /protected (allowed Admin/Superadmin) — renders protected content", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], {
      ...ADMIN_USER,
      user: { ...ADMIN_USER.user, roles: ["Superadmin"] },
    });

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("Profesor accessing /protected (allowed Admin/Superadmin) — redirects to /my-courses", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], PROFESSOR_USER);

    // The component redirects; the fallback "*" catches and renders fallback-page
    // But actually the Navigate component replaces, so the current rendered page is the redirected one.
    // With our route setup, the Navigate to /my-courses will match the /my-courses route
    expect(screen.getByTestId("my-courses-page")).toBeInTheDocument();
  });

  it("Supervisor accessing /protected (allowed Admin/Superadmin) — redirects to /life-groups", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], SUPERVISOR_USER);

    expect(screen.getByTestId("life-groups-page")).toBeInTheDocument();
  });

  it("Lider accessing /protected (allowed Admin/Superadmin) — redirects to /mi-grupo-de-vida", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], LIDEN_USER);

    expect(screen.getByTestId("my-life-group-page")).toBeInTheDocument();
  });

  it("Guest (not authenticated) accessing /protected — redirects to /login", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], GUEST_USER);

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("isBootstrapping — shows loading spinner instead of redirecting", () => {
    renderWithAuth(<RequireAuth allowedRoles={["Admin", "Superadmin"]} />, ["/protected"], BOOTSTRAPPING_USER);

    // The component renders LoadingSpinner while bootstrapping
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });
});

// ---- GuestOnly tests --------------------------------------------------------

describe("GuestOnly — redirect authenticated users (ADR-0020)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticated Profesor accessing /login — redirects to /my-courses", () => {
    renderGuestOnlyWithAuth(<GuestOnly />, [PATHS.login], PROFESSOR_USER);

    expect(screen.getByTestId("my-courses-page")).toBeInTheDocument();
  });

  it("not authenticated user accessing /login — renders login form", () => {
    renderGuestOnlyWithAuth(<GuestOnly />, [PATHS.login], GUEST_USER);

    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("isBootstrapping — shows loading spinner instead of redirecting", () => {
    renderGuestOnlyWithAuth(<GuestOnly />, [PATHS.login], BOOTSTRAPPING_USER);

    // The component renders LoadingSpinner while bootstrapping
    expect(screen.queryByTestId("login-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("my-courses-page")).not.toBeInTheDocument();
  });
});
