import { defineConfig } from "vitest/config";

/**
 * Vitest config del backend (ICC Casa de Dios).
 *
 * - `environment: "node"`: backend puro, sin DOM.
 * - `globals: true`: permite `describe`/`it`/`expect`/`vi` sin imports
 *   explícitos (alineado con el estilo del repo).
 * - `coverage`: provider `v8`, reporters `text` + `html`. Los thresholds
 *   ≥80% exigidos por AGENTS.md §9 NO se imponen todavía: el paso 10 del
 *   flujo canónico activa la cobertura una vez que el `frontend-engineer`
 *   cierre las iteraciones 7-8. Aquí sólo se deja la infraestructura
 *   lista para que el `testing-engineer` pueda activar thresholds sin
 *   refactor posterior.
 * - `exclude`: se ignora `dist/`, `node_modules/`, los archivos de
 *   config, las migraciones (ambientes puntuales) y los helpers de
 *   seed/db que requieren Mongo real.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "dist/**",
        "node_modules/**",
        "**/*.config.ts",
        "src/config/migrations/**",
        "tests/**",
      ],
      // thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      // ↑ Se deja comentado de forma intencional; el `Chief AI Architect`
      //   lo activa en el paso 10 junto con el `testing-engineer`.
    },
  },
});