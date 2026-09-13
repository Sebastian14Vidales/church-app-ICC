import { describe, expect, it } from "vitest";
import { areArraysEqual } from "./array";

describe("areArraysEqual", () => {
  it("returns true for identical arrays in the same order", () => {
    expect(areArraysEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("returns true for identical arrays in different order", () => {
    expect(areArraysEqual(["b", "a"], ["a", "b"])).toBe(true);
  });

  it("returns false for arrays of different lengths", () => {
    expect(areArraysEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false for arrays with different values", () => {
    expect(areArraysEqual(["a"], ["b"])).toBe(false);
  });

  it("returns true for two empty arrays", () => {
    expect(areArraysEqual([], [])).toBe(true);
  });
});
