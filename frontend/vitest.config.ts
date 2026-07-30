import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath, URL } from "node:url";

/**
 * Vitest config del frontend (ICC Casa de Dios).
 *
 * - `environment: "jsdom"`: frontend con DOM para componentes React.
 * - `globals: true`: permite `describe`/`it`/`expect`/`vi` sin imports
 *   explícitos (alineado con el estilo del repo).
 * - `coverage`: provider `v8`, reporters `text` + `html`. Los thresholds
 *   ≥80% exigidos por AGENTS.md §9 se aplicarán cuando la suite de
 *   componentes críticos esté completa.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "dist/**",
        "node_modules/**",
        "**/*.config.ts",
        "**/index.ts",
        "**/router.tsx",
        "**/main.tsx",
        "**/vite-env.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
