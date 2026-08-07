import { describe, it, expect } from "vitest";

import {
  inferSpiritualGrowthStage,
  normalizeCourseName,
} from "../../src/config/migrations/20260804-courses-missing-spiritual-growth-stage";

/**
 * Tests unitarios para los helpers de la migración de cursos legacy.
 *
 * No requieren MongoDB real: solo cubren la normalización de nombres y el
 * mapeo heurístico a etapas de crecimiento espiritual (ADR-0006 / ADR-0007).
 */

describe("20260804-courses-missing-spiritual-growth-stage helpers", () => {
  describe("normalizeCourseName", () => {
    it("quita tildes, espacios y pasa a minúsculas", () => {
      expect(normalizeCourseName("Cosmovisón")).toBe("cosmovison");
      expect(normalizeCourseName("Caracter Cristiano")).toBe("caractercristiano");
      expect(normalizeCourseName("  Doctrina  ")).toBe("doctrina");
      expect(normalizeCourseName("Finanzas y Gobierno")).toBe("finanzasygobierno");
    });
  });

  describe("inferSpiritualGrowthStage", () => {
    it("mapea los nombres legacy detectados a la etapa correcta", () => {
      expect(inferSpiritualGrowthStage("Cosmovisón")).toBe("Cosmovisión bíblica");
      expect(inferSpiritualGrowthStage("Caracter Cristiano")).toBe("Carácter cristiano");
      expect(inferSpiritualGrowthStage("Doctrina")).toBe("Doctrina cristiana");
      expect(inferSpiritualGrowthStage("Finanzas")).toBe("Finanzas y Gobierno");
    });

    it("acepta variaciones sin acentos o con espacios", () => {
      expect(inferSpiritualGrowthStage("cosmovision")).toBe("Cosmovisión bíblica");
      expect(inferSpiritualGrowthStage("Caractercristiano")).toBe("Carácter cristiano");
      expect(inferSpiritualGrowthStage("FINANZAS")).toBe("Finanzas y Gobierno");
      expect(inferSpiritualGrowthStage("Finanzas y Gobierno")).toBe("Finanzas y Gobierno");
    });

    it("devuelve null para nombres no reconocidos", () => {
      expect(inferSpiritualGrowthStage("Misterios del Antiguo Testamento")).toBeNull();
      expect(inferSpiritualGrowthStage("")).toBeNull();
    });
  });
});
