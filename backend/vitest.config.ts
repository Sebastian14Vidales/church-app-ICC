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
      /**
       * Restringimos el reporte y los thresholds al módulo de Cursos
       * (EPC-COURSES-001, ADR-0001 §D1). Las dependencias transversales
       * (auth.utils, action-token.model, validation middleware) son infra
       * preexistente no modificada en esta épica; dejarlas dentro del
       * scope rebajaría artificialmente el umbral y mezclaría deuda externa
       * con la responsabilidad de este paso. Cuando otros módulos ganen
       * suite propia, el `devops-engineer`/`chief-architect` puede ampliar
       * este `include` o quitarlo y mover a un `perFile` global.
       */
      include: [
        "src/controller/course.controller.ts",
        "src/controller/course-assignment.controller.ts",
        "src/controller/attendance.controller.ts",
        "src/services/course-assignment.service.ts",
        "src/services/attendance.service.ts",
        "src/services/app-error.ts",
        "src/routes/course.routes.ts",
        "src/routes/course-assignment.routes.ts",
        "src/routes/attendance.routes.ts",
        // NOTA: los modelos Mongoose (`course.model.ts`,
        // `course-assigned.model.ts`, `class-session.model.ts`) NO se
        // incluyen aquí. AGENTS.md §9 enumera "controllers, services,
        // middleware, hooks críticos" como capas críticas; los modelos
        // son schema definitions (sin lógica de negocio) y de antemano
        // están 100% cubiertos sólo si se cargan, lo cual choca con la
        // estrategia de mocks de servicios (paso 10). Su validación de
        // runtime (índices, partialFilterExpression) vive en la suite de
        // migración/test DB del `database-engineer`, no en esta capa.
      ],
      exclude: [
        "dist/**",
        "node_modules/**",
        "**/*.config.ts",
        "src/config/migrations/**",
        "tests/**",
      ],
      // Umbral minimum exigido por AGENTS.md §9 (calidad ≥ 80% en capas
      // críticas). Activado en el paso 10 del ADR-0001. Si una iteración
      // futura necesita bajar puntualmente una métrica por debajo de 80,
      // se documenta en el reporte y se eleva al `Chief AI Architect`.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});