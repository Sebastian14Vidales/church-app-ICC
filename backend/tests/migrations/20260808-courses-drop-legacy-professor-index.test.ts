import { describe, it, expect } from "vitest";

import {
  IndexInfo,
  isLegacyProfessorUniqueIndex,
} from "../../src/config/migrations/20260808-courses-drop-legacy-professor-index";

/**
 * Tests unitarios para la heurística de detección del índice legacy.
 *
 * No requieren MongoDB real: solo cubren la identificación del índice
 * `unique` sobre `{ professor: 1 }` sin `partialFilterExpression`
 * (ADR-0009 §D3.1).
 */

describe("20260808-courses-drop-legacy-professor-index helpers", () => {
  describe("isLegacyProfessorUniqueIndex", () => {
    it("identifica el índice legacy autogenerado por Mongoose", () => {
      const legacyIndex: IndexInfo = {
        v: 2,
        key: { professor: 1 },
        name: "professor_1",
        unique: true,
      };

      expect(isLegacyProfessorUniqueIndex(legacyIndex)).toBe(true);
    });

    it("rechaza el índice correcto del schema", () => {
      const correctIndex: IndexInfo = {
        v: 2,
        key: { professor: 1 },
        name: "course_assigned_unique_active_professor",
        unique: true,
        partialFilterExpression: {
          status: "active",
          deletedAt: null,
        },
      };

      expect(isLegacyProfessorUniqueIndex(correctIndex)).toBe(false);
    });

    it("rechaza índices que no son únicos", () => {
      const nonUniqueIndex: IndexInfo = {
        v: 2,
        key: { professor: 1 },
        name: "course_assigned_status_professor",
      };

      expect(isLegacyProfessorUniqueIndex(nonUniqueIndex)).toBe(false);
    });

    it("rechaza índices con clave compuesta", () => {
      const compositeIndex: IndexInfo = {
        v: 2,
        key: { professor: 1, course: 1 },
        name: "professor_1_course_1",
        unique: true,
      };

      expect(isLegacyProfessorUniqueIndex(compositeIndex)).toBe(false);
    });

    it("rechaza índices con clave distinta a professor", () => {
      const otherIndex: IndexInfo = {
        v: 2,
        key: { course: 1 },
        name: "course_1",
        unique: true,
      };

      expect(isLegacyProfessorUniqueIndex(otherIndex)).toBe(false);
    });

    it("rechaza índices que ya tienen partialFilterExpression", () => {
      const partialIndex: IndexInfo = {
        v: 2,
        key: { professor: 1 },
        name: "professor_1_partial",
        unique: true,
        partialFilterExpression: {
          status: "active",
        },
      };

      expect(isLegacyProfessorUniqueIndex(partialIndex)).toBe(false);
    });

    it("rechaza el índice _id primario", () => {
      const idIndex: IndexInfo = {
        v: 2,
        key: { _id: 1 },
        name: "_id_",
        unique: true,
      };

      expect(isLegacyProfessorUniqueIndex(idIndex)).toBe(false);
    });
  });
});
