import { describe, it, expect } from "vitest";

/**
 * Regression test: Confirmar que el router de Sermons ha sido eliminado
 * del backend (ADR-0011 §D7).
 *
 * El archivo `backend/src/routes/sermon.routes.ts` no debe existir.
 * Si existiera, la importación dinámica resolvería sin error.
 * Al no existir, el import dinámico rechaza con error de módulo.
 *
 * Tests para el paso 9 del flujo canónico.
 * Sin `console.log`, sin `any`.
 */
describe("Sermon routes — ADR-0011 §D7: router removal", () => {
  it("sermon.routes module cannot be imported (was deleted)", async () => {
    await expect(import("../../../src/routes/sermon.routes")).rejects.toThrow();
  });
});
