import { describe, expect, it } from "vitest";
import {
  EC_CODEWORDS_PER_BLOCK,
  NUM_EC_BLOCKS,
  computeFormatBits,
  computeVersionBits,
  encodeQrMatrix,
  gfMultiply,
  numDataCodewords,
  numRawDataModules,
  qrMatrixToSvgPath,
  rsComputeDivisor,
  rsComputeRemainder,
  type QrErrorCorrection,
} from "./qr-encoder";

describe("numRawDataModules", () => {
  it("matches the published total-codeword counts", () => {
    // Total codewords = raw data modules / 8 (ISO/IEC 18004 Table 1).
    const knownTotals: Record<number, number> = {
      1: 26,
      2: 44,
      3: 70,
      4: 100,
      5: 134,
      7: 196,
      10: 346,
      14: 581,
      15: 655,
      21: 1156,
      32: 2465,
      40: 3706,
    };
    for (const [version, total] of Object.entries(knownTotals)) {
      expect(numRawDataModules(Number(version)) >>> 3).toBe(total);
    }
  });

  it("rejects out-of-range versions", () => {
    expect(() => numRawDataModules(0)).toThrow(RangeError);
    expect(() => numRawDataModules(41)).toThrow(RangeError);
  });
});

describe("EC block tables", () => {
  it("data + ecc codewords equal total codewords for every version and level", () => {
    // A wrong entry in either table breaks this identity, so this validates
    // all 80 table cells against the capacity formula.
    for (const ec of ["L", "M"] as const) {
      for (let v = 1; v <= 40; v++) {
        const total = numRawDataModules(v) >>> 3;
        const ecc =
          (EC_CODEWORDS_PER_BLOCK[ec][v - 1] ?? 0) *
          (NUM_EC_BLOCKS[ec][v - 1] ?? 0);
        expect(numDataCodewords(v, ec) + ecc, `version ${v}${ec}`).toBe(total);
        expect(numDataCodewords(v, ec), `version ${v}${ec} data > 0`).toBeGreaterThan(0);
      }
    }
  });

  it("capacity is monotonically increasing per level", () => {
    for (const ec of ["L", "M"] as const) {
      for (let v = 2; v <= 40; v++) {
        expect(numDataCodewords(v, ec)).toBeGreaterThan(
          numDataCodewords(v - 1, ec),
        );
      }
    }
  });
});

describe("format and version information", () => {
  it("matches known 15-bit format strings", () => {
    // Published values: EC M mask 0 → 101010000010010, EC L mask 0 → 111011111000100.
    expect(computeFormatBits("M", 0)).toBe(0b101010000010010);
    expect(computeFormatBits("L", 0)).toBe(0b111011111000100);
  });

  it("produces 15-bit, pairwise-distinct format values", () => {
    const seen = new Set<number>();
    for (const ec of ["L", "M"] as const) {
      for (let mask = 0; mask < 8; mask++) {
        const bits = computeFormatBits(ec, mask);
        expect(bits).toBeGreaterThanOrEqual(0);
        expect(bits).toBeLessThan(1 << 15);
        seen.add(bits);
      }
    }
    expect(seen.size).toBe(16);
  });

  it("matches the known 18-bit version string for version 7", () => {
    // Published value: version 7 → 000111110010010100.
    expect(computeVersionBits(7)).toBe(0b000111110010010100);
  });
});

describe("Reed-Solomon", () => {
  function gfPow(base: number, exp: number): number {
    let result = 1;
    for (let i = 0; i < exp; i++) result = gfMultiply(result, base);
    return result;
  }

  /** Evaluate polynomial (coefficients most-significant first) at x. */
  function polyEval(coefficients: number[], x: number): number {
    let acc = 0;
    for (const c of coefficients) acc = gfMultiply(acc, x) ^ c;
    return acc;
  }

  it("appended ECC makes the codeword polynomial divisible by the generator", () => {
    // A valid RS codeword evaluates to zero at every generator root α^0..α^(d-1).
    const data = [64, 86, 134, 86, 198, 198, 242, 236, 17, 236, 17, 236];
    for (const degree of [7, 10, 13, 22, 30]) {
      const divisor = rsComputeDivisor(degree);
      const ecc = rsComputeRemainder(data, divisor);
      const codeword = [...data, ...ecc];
      for (let i = 0; i < degree; i++) {
        expect(polyEval(codeword, gfPow(2, i)), `degree ${degree} root ${i}`).toBe(0);
      }
    }
  });

  it("gfMultiply agrees with known GF(256) products", () => {
    expect(gfMultiply(0, 0xff)).toBe(0);
    expect(gfMultiply(1, 0xab)).toBe(0xab);
    // α^255 = 1 in GF(2^8): repeated doubling cycles back.
    let x = 1;
    for (let i = 0; i < 255; i++) x = gfMultiply(x, 2);
    expect(x).toBe(1);
  });
});

describe("encodeQrMatrix", () => {
  const SAMPLE_URL =
    "https://hrs.pcso.gov.ph/verify/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    "x".repeat(320) +
    ".sig1234567890sig1234567890sig1234567890abc";

  function expectStructurallyValid(text: string, ec: QrErrorCorrection): void {
    const qr = encodeQrMatrix(text, ec);
    const { size, version, modules } = qr;

    expect(size).toBe(version * 4 + 17);
    expect(modules).toHaveLength(size);
    for (const row of modules) expect(row).toHaveLength(size);

    const at = (x: number, y: number): boolean => modules[y]?.[x] ?? false;

    // Finder pattern centers (all dark) and separators (all light).
    for (const [cx, cy] of [
      [3, 3],
      [size - 4, 3],
      [3, size - 4],
    ] as const) {
      expect(at(cx, cy), "finder center").toBe(true);
      expect(at(cx - 2, cy), "finder light ring").toBe(false);
      expect(at(cx - 3, cy), "finder outer ring").toBe(true);
    }
    expect(at(7, 7), "separator").toBe(false);

    // Timing patterns alternate between the finders.
    for (let i = 8; i < size - 8; i++) {
      expect(at(i, 6), `h timing at ${i}`).toBe(i % 2 === 0);
      expect(at(6, i), `v timing at ${i}`).toBe(i % 2 === 0);
    }

    // Always-dark module.
    expect(at(8, size - 8)).toBe(true);
  }

  it("produces a structurally valid matrix for a verify URL", () => {
    expectStructurallyValid(SAMPLE_URL, "M");
    expectStructurallyValid(SAMPLE_URL, "L");
  });

  it("is deterministic", () => {
    const a = encodeQrMatrix(SAMPLE_URL, "M");
    const b = encodeQrMatrix(SAMPLE_URL, "M");
    expect(a).toEqual(b);
  });

  it("selects the smallest fitting version", () => {
    // Version 1-M holds 16 data codewords = 128 bits; byte mode overhead is
    // 12 bits, so 14 bytes fit and 15 bytes spill to version 2.
    expect(encodeQrMatrix("a".repeat(14), "M").version).toBe(1);
    expect(encodeQrMatrix("a".repeat(15), "M").version).toBe(2);
  });

  it("selects a valid mask in range 0..7", () => {
    const qr = encodeQrMatrix(SAMPLE_URL, "M");
    expect(qr.mask).toBeGreaterThanOrEqual(0);
    expect(qr.mask).toBeLessThanOrEqual(7);
  });

  it("encodes multi-byte UTF-8 content by byte length", () => {
    const qr = encodeQrMatrix("Kalusugan ng Bayan — Sertipiko ✔", "M");
    expect(qr.size).toBe(qr.version * 4 + 17);
  });

  it("throws when the payload exceeds version 40 capacity", () => {
    expect(() => encodeQrMatrix("z".repeat(4000), "M")).toThrow(
      /too long/i,
    );
  });
});

describe("qrMatrixToSvgPath", () => {
  it("emits one path command per dark module with the quiet-zone offset", () => {
    const qr = encodeQrMatrix("PCSO", "M");
    const path = qrMatrixToSvgPath(qr, 2);
    const darkCount = qr.modules.flat().filter(Boolean).length;
    expect(path.match(/M\d+ \d+h1v1h-1z/g)).toHaveLength(darkCount);
    // Quiet zone: no module may start at coordinate < 2.
    expect(path.includes("M0 ")).toBe(false);
    expect(path.includes("M1 ")).toBe(false);
  });
});
