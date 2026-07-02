import { describe, it, expect } from "vitest";
import {
  normalizePdsSection31,
  hasSection31Content,
} from "./pds-section31";

describe("normalizePdsSection31", () => {
  it("passes through a clean payload unchanged", () => {
    // Arrange
    const raw = { skills: ["Typing", "Driving"], hobbies: ["Chess"] };

    // Act
    const result = normalizePdsSection31(raw);

    // Assert
    expect(result).toEqual({
      skills: ["Typing", "Driving"],
      hobbies: ["Chess"],
    });
  });

  it("trims whitespace and drops blank entries", () => {
    const result = normalizePdsSection31({
      skills: ["  Welding  ", "   ", ""],
      hobbies: ["\tReading\n"],
    });

    expect(result).toEqual({ skills: ["Welding"], hobbies: ["Reading"] });
  });

  it("de-duplicates case-insensitively, keeping first-seen casing/order", () => {
    const result = normalizePdsSection31({
      skills: ["Coding", "coding", "CODING", "Design"],
      hobbies: [],
    });

    expect(result.skills).toEqual(["Coding", "Design"]);
    expect(result.hobbies).toEqual([]);
  });

  it("ignores non-string array members", () => {
    const result = normalizePdsSection31({
      skills: ["Cooking", 42, null, { x: 1 }, "Baking"],
      hobbies: [true, "Painting"],
    });

    expect(result.skills).toEqual(["Cooking", "Baking"]);
    expect(result.hobbies).toEqual(["Painting"]);
  });

  it("degrades malformed input to empty arrays without throwing", () => {
    expect(normalizePdsSection31(null)).toEqual({ skills: [], hobbies: [] });
    expect(normalizePdsSection31(undefined)).toEqual({
      skills: [],
      hobbies: [],
    });
    expect(normalizePdsSection31("nope")).toEqual({ skills: [], hobbies: [] });
    expect(normalizePdsSection31(123)).toEqual({ skills: [], hobbies: [] });
    expect(normalizePdsSection31({ skills: "x", hobbies: 5 })).toEqual({
      skills: [],
      hobbies: [],
    });
  });

  it("defaults missing keys to empty arrays", () => {
    expect(normalizePdsSection31({})).toEqual({ skills: [], hobbies: [] });
    expect(normalizePdsSection31({ skills: ["A"] })).toEqual({
      skills: ["A"],
      hobbies: [],
    });
  });
});

describe("hasSection31Content", () => {
  it("returns true when any skill or hobby is present", () => {
    expect(hasSection31Content({ skills: ["A"], hobbies: [] })).toBe(true);
    expect(hasSection31Content({ skills: [], hobbies: ["B"] })).toBe(true);
  });

  it("returns false when both lists are empty", () => {
    expect(hasSection31Content({ skills: [], hobbies: [] })).toBe(false);
  });
});
