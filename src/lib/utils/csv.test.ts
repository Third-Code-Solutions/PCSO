import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("returns empty string for nullish values", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    expect(csvCell("Dela Cruz, Juan")).toBe('"Dela Cruz, Juan"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("neutralises formula-trigger prefixes", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tx")).toBe("'\tx");
  });

  it("leaves plain numbers and ordinary text untouched", () => {
    expect(csvCell("-1.5")).toBe("-1.5");
    expect(csvCell("+639171234567")).toBe("+639171234567");
    expect(csvCell(42)).toBe("42");
    expect(csvCell("SG-11")).toBe("SG-11");
    expect(csvCell("***-***-1234")).toBe("***-***-1234");
  });
});
