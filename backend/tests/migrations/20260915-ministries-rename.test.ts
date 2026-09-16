import { describe, it, expect } from "vitest";

import { MINISTRY_RENAMES } from "../../src/config/migrations/20260915-ministries-rename";
import { MINISTRIES } from "../../src/models/user-profile.model";

/**
 * Tests unitarios para el mapeo de renombres de ministerios legacy.
 *
 * No requieren MongoDB real: solo verifican que los valores legacy se
 * mapeen a los nombres oficiales del catálogo actualizado.
 */

describe("20260915-ministries-rename mapping", () => {
  it("mapea todos los valores legacy a los nombres oficiales", () => {
    expect(MINISTRY_RENAMES).toEqual({
      "Ministerio de Danza (Niñas entre 7 y 14 años)": "Ministerio de Danza",
      "Ministerio de Hombres": "Ministerio de Varones",
      "Ministerio de Parejas y Familias": "Ministerio de Parejas y Familia",
      "Ministerio Iglesia Infantil": "Ministerio Infantil",
      "Ministerio de Evangelismo y Consolidación G.V.E":
        "Ministerio de Evangelismo y Consolidación",
    });
  });

  it("no mapea desde valores oficiales y todos los destinos están en MINISTRIES", () => {
    for (const [legacy, renamed] of Object.entries(MINISTRY_RENAMES)) {
      expect(MINISTRIES).not.toContain(legacy);
      expect(MINISTRIES).toContain(renamed);
    }
  });
});
