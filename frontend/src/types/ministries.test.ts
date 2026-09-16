import { describe, it, expect } from "vitest";
import { MINISTRIES, ministrySchema } from "@/types/index";

/**
 * Tests unitarios para el catálogo de ministerios (pista B).
 *
 * Verifica:
 * - MINISTRIES tiene exactamente 14 valores
 * - Los valores son únicos
 * - Ninguno de los 5 valores legacy está en MINISTRIES
 * - ministrySchema acepta los 14 valores oficiales
 * - ministrySchema rechaza un valor legacy
 * - ministrySchema rechaza un valor inventado
 *
 * Sin `any`; sin `console.log`; determinista.
 */

const OFFICIAL_MINISTRIES = [
  "Ministerio de Alabanza",
  "Ministerio de Danza",
  "Ministerio de Audiovisuales",
  "Ministerio de Varones",
  "Ministerio de Jóvenes",
  "Ministerio de Parejas y Familia",
  "Ministerio de Mujeres",
  "Ministerio de Evangelismo y Consolidación",
  "Funda Esperanza",
  "Ministerio de Servidores",
  "Ministerio Infantil",
  "Ministerio de Oración e Intercesión",
  "Ministerio de Liberación",
  "Ministerio de Misericordia",
] as const;

const LEGACY_MINISTRIES = [
  "Ministerio de Danza (Niñas entre 7 y 14 años)",
  "Ministerio de Hombres",
  "Ministerio de Parejas y Familias",
  "Ministerio Iglesia Infantil",
  "Ministerio de Evangelismo y Consolidación G.V.E",
] as const;

describe("MINISTRIES — catálogo oficial (pista B)", () => {
  it("tiene exactamente 14 valores", () => {
    expect(MINISTRIES).toHaveLength(14);
  });

  it("los valores son únicos (no hay duplicados)", () => {
    const unique = new Set(MINISTRIES);
    expect(unique.size).toBe(MINISTRIES.length);
  });

  it("contiene exactamente los 14 valores oficiales", () => {
    for (const ministry of OFFICIAL_MINISTRIES) {
      expect(MINISTRIES).toContain(ministry);
    }
  });

  it("ninguno de los 5 valores legacy está en MINISTRIES", () => {
    for (const legacy of LEGACY_MINISTRIES) {
      expect(MINISTRIES).not.toContain(legacy);
    }
  });
});

describe("ministrySchema — validación zod", () => {
  it("acepta los 14 valores oficiales sin error", () => {
    for (const ministry of OFFICIAL_MINISTRIES) {
      const result = ministrySchema.safeParse(ministry);
      expect(result.success, `Falló con: ${ministry}`).toBe(true);
    }
  });

  it("rechaza un valor legacy (Ministerio de Hombres)", () => {
    const result = ministrySchema.safeParse("Ministerio de Hombres");
    expect(result.success).toBe(false);
  });

  it("rechaza un valor legacy (Ministerio de Danza con descripción)", () => {
    const result = ministrySchema.safeParse(
      "Ministerio de Danza (Niñas entre 7 y 14 años)",
    );
    expect(result.success).toBe(false);
  });

  it("rechaza un valor legacy (Ministerio de Parejas y Familias)", () => {
    const result = ministrySchema.safeParse("Ministerio de Parejas y Familias");
    expect(result.success).toBe(false);
  });

  it("rechaza un valor legacy (Ministerio Iglesia Infantil)", () => {
    const result = ministrySchema.safeParse("Ministerio Iglesia Infantil");
    expect(result.success).toBe(false);
  });

  it("rechaza un valor legacy (Ministerio de Evangelismo y Consolidación G.V.E)", () => {
    const result = ministrySchema.safeParse(
      "Ministerio de Evangelismo y Consolidación G.V.E",
    );
    expect(result.success).toBe(false);
  });

  it("rechaza un valor inventado", () => {
    const result = ministrySchema.safeParse("Ministerio Inventado XYZ");
    expect(result.success).toBe(false);
  });

  it("rechaza string vacío", () => {
    const result = ministrySchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rechaza null", () => {
    const result = ministrySchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("rechaza undefined", () => {
    const result = ministrySchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

describe("MINISTRIES export — coincide con OFFICIAL_MINISTRIES", () => {
  it("MINISTRIES === ministrySchema.options", () => {
    expect(MINISTRIES).toEqual(ministrySchema.options);
  });
});
