import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * Mock de thinking-orbs para evitar dependencia de canvas/renderizado real.
 * Renderiza un elemento simple con los atributos relevantes para verificar
 * el comportamiento del LoadingSpinner.
 */
vi.mock("thinking-orbs", () => ({
  ThinkingOrb: ({
    state,
    size,
    speed,
    "aria-label": ariaLabel,
  }: {
    state: string;
    size: number;
    speed: number;
    "aria-label": string;
  }) => (
    <div
      data-testid="thinking-orb"
      data-state={state}
      data-size={size}
      data-speed={speed}
      aria-label={ariaLabel}
    />
  ),
}));

describe("LoadingSpinner", () => {
  it("renderiza el contenedor con role='status'", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("sin label, el aria-label del ThinkingOrb es 'Cargando'", () => {
    render(<LoadingSpinner />);
    const orb = screen.getByTestId("thinking-orb");
    expect(orb).toHaveAttribute("aria-label", "Cargando");
  });

  it("con label='Cargando miembros...', el aria-label del spinner es correcto", () => {
    render(<LoadingSpinner label="Cargando miembros..." />);
    const orb = screen.getByTestId("thinking-orb");
    expect(orb).toHaveAttribute("aria-label", "Cargando miembros...");
  });

  it("con label='Cargando miembros...', el texto visible se muestra sin conflicto con sr-only", () => {
    render(<LoadingSpinner label="Cargando miembros..." />);
    // El span.visible tiene "text-slate-600"; el sr-only tiene "sr-only".
    // Usamos función de filtro para seleccionar solo el span visible.
    const visibleLabel = screen.getByText((content, element) => {
      const hasText = content === "Cargando miembros...";
      const isVisibleSpan = (element as HTMLElement)?.className?.includes("text-slate-600") ?? false;
      return hasText && isVisibleSpan;
    });
    expect(visibleLabel).toBeInTheDocument();
  });

  it("el span sr-only contiene el texto del label (o默认值)", () => {
    const { container } = render(<LoadingSpinner label="Cargando miembros..." />);
    const srOnlySpan = container.querySelector(".sr-only");
    expect(srOnlySpan).toBeInTheDocument();
    expect(srOnlySpan).toHaveTextContent("Cargando miembros...");
  });

  it("sin label, el span sr-only contiene el texto por defecto 'Cargando'", () => {
    const { container } = render(<LoadingSpinner />);
    const srOnlySpan = container.querySelector(".sr-only");
    expect(srOnlySpan).toBeInTheDocument();
    expect(srOnlySpan).toHaveTextContent("Cargando");
  });

  it("aplica className al contenedor", () => {
    render(<LoadingSpinner className="mi-clase-personalizada" />);
    const container = screen.getByRole("status");
    expect(container).toHaveClass("mi-clase-personalizada");
  });

  it("passes correct props to ThinkingOrb (state=working, size=64, speed=1.4)", () => {
    render(<LoadingSpinner />);
    const orb = screen.getByTestId("thinking-orb");
    expect(orb).toHaveAttribute("data-state", "working");
    expect(orb).toHaveAttribute("data-size", "64");
    expect(orb).toHaveAttribute("data-speed", "1.4");
  });
});
