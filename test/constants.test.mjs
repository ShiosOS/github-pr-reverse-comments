import { describe, it, expect } from "vitest";
import constants from "../constants.js";

const { ORDER, normalizeOrder } = constants;

describe("normalizeOrder", () => {
  it("passes through the two valid values", () => {
    expect(normalizeOrder(ORDER.NEWEST)).toBe(ORDER.NEWEST);
    expect(normalizeOrder(ORDER.OLDEST)).toBe(ORDER.OLDEST);
  });

  it("falls back to newest for anything else from storage", () => {
    expect(normalizeOrder(undefined)).toBe(ORDER.NEWEST);
    expect(normalizeOrder(null)).toBe(ORDER.NEWEST);
    expect(normalizeOrder("")).toBe(ORDER.NEWEST);
    expect(normalizeOrder("descending")).toBe(ORDER.NEWEST);
    expect(normalizeOrder(42)).toBe(ORDER.NEWEST);
  });
});
