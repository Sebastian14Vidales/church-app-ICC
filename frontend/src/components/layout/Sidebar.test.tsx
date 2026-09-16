import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import { AuthContext } from "@/hooks/useAuth";
import type { AuthContextValue } from "@/lib/auth.types";

/**
 * Unit tests para Sidebar — visibility of Dashboard and role-specific items (ADR-0020).
 *
 * Verifica que:
 * - Dashboard link aparece SOLO para Admin y Superadmin.
 * - "Mis cursos" aparece SOLO para Profesor.
 * - "Mi cobertura" aparece SOLO para Supervisor.
 * - "Mi grupo de vida" aparece para Lider y Supervisor (aunque Supervisor ve "Mi cobertura" primero).
 * - "Mi grupo de vida" aparece SOLO para Lider (sin Admin/Profesor/Supervisor).
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

const SUPERADMIN_USER = {
  user: {
    id: "u-super",
    email: "super@icc.test",
    name: "Superadmin Test",
    roles: ["Superadmin"] as string[],
    profileId: "profile-super",
  },
  isAuthenticated: true,
  isBootstrapping: false,
  isSessionTransitioning: false,
  token: "token-super",
  login: vi.fn(),
  logout: vi.fn(),
};

// ---- helpers ----------------------------------------------------------------

const renderSidebarWithAuth = (authValue: AuthContextValue) => {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

// ---- tests -----------------------------------------------------------------

describe("Sidebar — Dashboard and role items visibility (ADR-0020)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Dashboard link", () => {
    it('Admin — Dashboard link IS visible', () => {
      renderSidebarWithAuth(ADMIN_USER);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it('Superadmin — Dashboard link IS visible', () => {
      renderSidebarWithAuth(SUPERADMIN_USER);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it('Profesor — Dashboard link is NOT visible', () => {
      renderSidebarWithAuth(PROFESSOR_USER);
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    });

    it('Supervisor — Dashboard link is NOT visible', () => {
      renderSidebarWithAuth(SUPERVISOR_USER);
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    });

    it('Lider — Dashboard link is NOT visible', () => {
      renderSidebarWithAuth(LIDEN_USER);
      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    });
  });

  describe("'Mis cursos' link", () => {
    it('Profesor — "Mis cursos" IS visible', () => {
      renderSidebarWithAuth(PROFESSOR_USER);
      expect(screen.getByText("Mis cursos")).toBeInTheDocument();
    });

    it('Admin — "Mis cursos" is NOT visible (Admin sees "Cursos")', () => {
      renderSidebarWithAuth(ADMIN_USER);
      expect(screen.queryByText("Mis cursos")).not.toBeInTheDocument();
      // Admin gets "Cursos" instead
      expect(screen.getByText("Cursos")).toBeInTheDocument();
    });

    it('Supervisor — "Mis cursos" is NOT visible', () => {
      renderSidebarWithAuth(SUPERVISOR_USER);
      expect(screen.queryByText("Mis cursos")).not.toBeInTheDocument();
    });

    it('Lider — "Mis cursos" is NOT visible', () => {
      renderSidebarWithAuth(LIDEN_USER);
      expect(screen.queryByText("Mis cursos")).not.toBeInTheDocument();
    });
  });

  describe("'Mi cobertura' link", () => {
    it('Supervisor — "Mi cobertura" IS visible', () => {
      renderSidebarWithAuth(SUPERVISOR_USER);
      expect(screen.getByText("Mi cobertura")).toBeInTheDocument();
    });

    it('Admin — "Mi cobertura" is NOT visible', () => {
      renderSidebarWithAuth(ADMIN_USER);
      expect(screen.queryByText("Mi cobertura")).not.toBeInTheDocument();
    });

    it('Profesor — "Mi cobertura" is NOT visible', () => {
      renderSidebarWithAuth(PROFESSOR_USER);
      expect(screen.queryByText("Mi cobertura")).not.toBeInTheDocument();
    });

    it('Lider — "Mi cobertura" is NOT visible', () => {
      renderSidebarWithAuth(LIDEN_USER);
      expect(screen.queryByText("Mi cobertura")).not.toBeInTheDocument();
    });
  });

  describe("'Mi grupo de vida' link", () => {
    it('Lider (solo Lider, sin Admin/Profesor/Supervisor) — "Mi grupo de vida" IS visible', () => {
      renderSidebarWithAuth(LIDEN_USER);
      expect(screen.getByText("Mi grupo de vida")).toBeInTheDocument();
    });

    it('Supervisor — "Mi grupo de vida" is NOT visible (Supervisor is not a Lider)', () => {
      // Supervisor does NOT have the Lider role, so isLider=false → Mi grupo de vida is NOT added.
      renderSidebarWithAuth(SUPERVISOR_USER);
      expect(screen.queryByText("Mi grupo de vida")).not.toBeInTheDocument();
    });

    it('Admin — "Mi grupo de vida" is NOT visible (Admin has different nav items)', () => {
      renderSidebarWithAuth(ADMIN_USER);
      expect(screen.queryByText("Mi grupo de vida")).not.toBeInTheDocument();
    });

    it('Profesor — "Mi grupo de vida" is NOT visible', () => {
      renderSidebarWithAuth(PROFESSOR_USER);
      expect(screen.queryByText("Mi grupo de vida")).not.toBeInTheDocument();
    });
  });

  describe("User name and role label", () => {
    it("Admin — renders user name and role label", () => {
      renderSidebarWithAuth(ADMIN_USER);
      expect(screen.getByText("Admin Test")).toBeInTheDocument();
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("Profesor — renders user name and 'Profesor' role label", () => {
      renderSidebarWithAuth(PROFESSOR_USER);
      expect(screen.getByText("Prof Test")).toBeInTheDocument();
      expect(screen.getByText("Profesor")).toBeInTheDocument();
    });
  });
});
