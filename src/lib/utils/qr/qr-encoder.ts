/**
 * Dependency-free QR Code encoder (ISO/IEC 18004).
 *
 * Scope: byte-mode segments, error-correction levels L and M, versions 1–40,
 * automatic version selection, full 8-mask penalty evaluation. Produces a
 * boolean module matrix that callers render themselves (SVG path in PDFs,
 * canvas, etc.). No `qrcode` npm dependency required.
 *
 * Used by the QR-verified document generators (PIM-017 / LDM-010): the matrix
 * encodes the public `/verify/[token]` URL carrying the signed HS256 JWT.
 *
 * Implementation follows the standard's algorithm structure (bit stream →
 * Reed-Solomon block interleave → function patterns → data zigzag → mask
 * selection by penalty score).
 */

export type QrErrorCorrection = "L" | "M";

export interface QrMatrix {
  /** Modules per side (17 + 4·version). */
  size: number;
  /** Chosen QR version (1–40). */
  version: number;
  /** Chosen mask pattern (0–7). */
  mask: number;
  /** `modules[y][x]` — `true` = dark module. */
  modules: boolean[][];
}

// ─── Version tables (levels L and M only) ────────────────────────────────────
// Index 0 = version 1. Validated in qr-encoder.test.ts against the raw module
// capacity formula (data + ecc codewords must equal total codewords).

export const EC_CODEWORDS_PER_BLOCK: Record<
  QrErrorCorrection,
  readonly number[]
> = {
  // prettier-ignore
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // prettier-ignore
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
};

export const NUM_EC_BLOCKS: Record<QrErrorCorrection, readonly number[]> = {
  // prettier-ignore
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // prettier-ignore
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
};

/** 2-bit EC indicator used in the format information string. */
const EC_FORMAT_BITS: Record<QrErrorCorrection, number> = { L: 1, M: 0 };

const MIN_VERSION = 1;
const MAX_VERSION = 40;

// ─── Capacity math ───────────────────────────────────────────────────────────

/** Raw data modules available after all function patterns are placed. */
export function numRawDataModules(version: number): number {
  if (version < MIN_VERSION || version > MAX_VERSION) {
    throw new RangeError(`QR version out of range: ${version}`);
  }
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Data codewords available at a version/EC level (total − error correction). */
export function numDataCodewords(
  version: number,
  ec: QrErrorCorrection,
): number {
  const total = numRawDataModules(version) >>> 3;
  const ecPerBlock = EC_CODEWORDS_PER_BLOCK[ec][version - 1];
  const blocks = NUM_EC_BLOCKS[ec][version - 1];
  if (ecPerBlock === undefined || blocks === undefined) {
    throw new RangeError(`QR version out of range: ${version}`);
  }
  return total - ecPerBlock * blocks;
}

// ─── GF(256) / Reed-Solomon ──────────────────────────────────────────────────

/** Multiply in GF(2^8) with the QR reducing polynomial x^8+x^4+x^3+x^2+1. */
export function gfMultiply(a: number, b: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((b >>> i) & 1) * a;
  }
  return z & 0xff;
}

/** Generator polynomial coefficients for a Reed-Solomon code of `degree`. */
export function rsComputeDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1; // (x - r0)(x - r1)... starts as the constant 1
  // Multiply by (x - α^i) for i = 0 .. degree-1.
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root);
      if (j + 1 < degree) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0);
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

/** Polynomial-division remainder of `data` by `divisor` (the ECC codewords). */
export function rsComputeRemainder(
  data: ArrayLike<number>,
  divisor: Uint8Array,
): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (let k = 0; k < data.length; k++) {
    const factor = (data[k] ?? 0) ^ (result[0] ?? 0);
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) {
      result[i] = (result[i] ?? 0) ^ gfMultiply(divisor[i] ?? 0, factor);
    }
  }
  return result;
}

// ─── Format / version information (BCH-protected) ───────────────────────────

/** 15-bit format info for an EC level + mask, including the fixed XOR mask. */
export function computeFormatBits(ec: QrErrorCorrection, mask: number): number {
  const data = (EC_FORMAT_BITS[ec] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/** 18-bit version info for versions ≥ 7. */
export function computeVersionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  return (version << 12) | rem;
}

// ─── Bit stream (byte-mode segment) ──────────────────────────────────────────

function buildDataCodewords(
  bytes: Uint8Array,
  version: number,
  ec: QrErrorCorrection,
): Uint8Array {
  const bits: number[] = [];
  const appendBits = (value: number, length: number): void => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  const ccBits = version <= 9 ? 8 : 16;
  appendBits(0b0100, 4); // byte-mode indicator
  appendBits(bytes.length, ccBits);
  for (const b of bytes) appendBits(b, 8);

  const capacityBits = numDataCodewords(version, ec) * 8;
  // Terminator + pad to byte boundary.
  appendBits(0, Math.min(4, capacityBits - bits.length));
  appendBits(0, (8 - (bits.length % 8)) % 8);
  // Alternating pad bytes 0xEC / 0x11.
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(pad, 8);
  }

  const result = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i++) {
    result[i >>> 3] = (result[i >>> 3] ?? 0) | ((bits[i] ?? 0) << (7 - (i & 7)));
  }
  return result;
}

// ─── Block split + ECC + interleave ──────────────────────────────────────────

function addEccAndInterleave(
  data: Uint8Array,
  version: number,
  ec: QrErrorCorrection,
): Uint8Array {
  const numBlocks = NUM_EC_BLOCKS[ec][version - 1] ?? 0;
  const blockEccLen = EC_CODEWORDS_PER_BLOCK[ec][version - 1] ?? 0;
  const rawCodewords = numRawDataModules(version) >>> 3;
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: Uint8Array[] = [];
  const rsDiv = rsComputeDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = rsComputeRemainder(dat, rsDiv);
    // Short blocks leave a one-byte gap before the ECC so the interleave
    // loop below can treat every block as long-block-length.
    const block = new Uint8Array(shortBlockLen + 1);
    block.set(dat, 0);
    block.set(ecc, shortBlockLen + 1 - blockEccLen);
    blocks.push(block);
  }

  const result = new Uint8Array(rawCodewords);
  let idx = 0;
  const blockLen = blocks[0]?.length ?? 0;
  for (let i = 0; i < blockLen; i++) {
    for (let j = 0; j < blocks.length; j++) {
      // Skip the gap byte in short blocks.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result[idx] = blocks[j]?.[i] ?? 0;
        idx += 1;
      }
    }
  }
  return result;
}

// ─── Matrix construction ─────────────────────────────────────────────────────

interface Canvas {
  size: number;
  /** modules[y][x] */
  modules: boolean[][];
  /** isFunction[y][x] — reserved (non-data) modules */
  isFunction: boolean[][];
}

function makeCanvas(size: number): Canvas {
  return {
    size,
    modules: Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    ),
    isFunction: Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    ),
  };
}

function setFunctionModule(
  c: Canvas,
  x: number,
  y: number,
  isDark: boolean,
): void {
  const row = c.modules[y];
  const fnRow = c.isFunction[y];
  if (!row || !fnRow) return;
  row[x] = isDark;
  fnRow[x] = true;
}

function alignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step =
    version === 32
      ? 26
      : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result: number[] = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

function drawFunctionPatterns(
  c: Canvas,
  version: number,
  ec: QrErrorCorrection,
): void {
  const { size } = c;

  // Timing patterns.
  for (let i = 0; i < size; i++) {
    setFunctionModule(c, 6, i, i % 2 === 0);
    setFunctionModule(c, i, 6, i % 2 === 0);
  }

  // Finder patterns + separators (out-of-bounds cells are clipped).
  const drawFinder = (cx: number, cy: number): void => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          setFunctionModule(c, x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Alignment patterns (skip the three finder corners).
  const alignPos = alignmentPatternPositions(version);
  const numAlign = alignPos.length;
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      const skip =
        (i === 0 && j === 0) ||
        (i === 0 && j === numAlign - 1) ||
        (i === numAlign - 1 && j === 0);
      if (skip) continue;
      const cx = alignPos[i] ?? 0;
      const cy = alignPos[j] ?? 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(
            c,
            cx + dx,
            cy + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    }
  }

  // Format information (reserved now with mask 0; redrawn after mask choice).
  drawFormatBits(c, ec, 0);

  // Version information (versions 7+).
  if (version >= 7) {
    const bits = computeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(c, a, b, bit);
      setFunctionModule(c, b, a, bit);
    }
  }
}

function drawFormatBits(
  c: Canvas,
  ec: QrErrorCorrection,
  mask: number,
): void {
  const { size } = c;
  const bits = computeFormatBits(ec, mask);
  const getBit = (i: number): boolean => ((bits >>> i) & 1) !== 0;

  // First copy (around the top-left finder).
  for (let i = 0; i <= 5; i++) setFunctionModule(c, 8, i, getBit(i));
  setFunctionModule(c, 8, 7, getBit(6));
  setFunctionModule(c, 8, 8, getBit(7));
  setFunctionModule(c, 7, 8, getBit(8));
  for (let i = 9; i < 15; i++) setFunctionModule(c, 14 - i, 8, getBit(i));

  // Second copy (split between top-right and bottom-left finders).
  for (let i = 0; i < 8; i++) setFunctionModule(c, size - 1 - i, 8, getBit(i));
  for (let i = 8; i < 15; i++)
    setFunctionModule(c, 8, size - 15 + i, getBit(i));

  // Always-dark module.
  setFunctionModule(c, 8, size - 8, true);
}

function drawCodewords(c: Canvas, data: Uint8Array): void {
  const { size } = c;
  let i = 0; // bit index into data
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!(c.isFunction[y]?.[x] ?? true) && i < data.length * 8) {
          const row = c.modules[y];
          if (row) {
            row[x] = (((data[i >>> 3] ?? 0) >>> (7 - (i & 7))) & 1) !== 0;
          }
          i += 1;
        }
        // Remaining unfilled data modules stay light (remainder bits = 0).
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new RangeError(`Mask out of range: ${mask}`);
  }
}

function applyMask(c: Canvas, mask: number): void {
  for (let y = 0; y < c.size; y++) {
    const row = c.modules[y];
    const fnRow = c.isFunction[y];
    if (!row || !fnRow) continue;
    for (let x = 0; x < c.size; x++) {
      if (!fnRow[x] && maskBit(mask, x, y)) row[x] = !row[x];
    }
  }
}

// ─── Penalty score (spec rules N1–N4) ────────────────────────────────────────

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

function penaltyScore(c: Canvas): number {
  const { size, modules } = c;
  let result = 0;

  const at = (x: number, y: number): boolean => modules[y]?.[x] ?? false;

  // N1: runs of ≥5 same-colored modules in rows and columns.
  for (let y = 0; y < size; y++) {
    let runColor = at(0, y);
    let runLen = 1;
    for (let x = 1; x < size; x++) {
      if (at(x, y) === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) result += PENALTY_N1 + (runLen - 5);
        runColor = at(x, y);
        runLen = 1;
      }
    }
    if (runLen >= 5) result += PENALTY_N1 + (runLen - 5);
  }
  for (let x = 0; x < size; x++) {
    let runColor = at(x, 0);
    let runLen = 1;
    for (let y = 1; y < size; y++) {
      if (at(x, y) === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) result += PENALTY_N1 + (runLen - 5);
        runColor = at(x, y);
        runLen = 1;
      }
    }
    if (runLen >= 5) result += PENALTY_N1 + (runLen - 5);
  }

  // N2: 2×2 blocks of a single color.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = at(x, y);
      if (
        color === at(x + 1, y) &&
        color === at(x, y + 1) &&
        color === at(x + 1, y + 1)
      ) {
        result += PENALTY_N2;
      }
    }
  }

  // N3: finder-like patterns 1011101 with 4 light modules on either side.
  const hasFinderPattern = (bits: boolean[], start: number): boolean => {
    const core = [true, false, true, true, true, false, true];
    for (let i = 0; i < 7; i++) {
      if (bits[start + i] !== core[i]) return false;
    }
    const lightBefore = (() => {
      for (let i = start - 4; i < start; i++) {
        if (i >= 0 && bits[i]) return false;
      }
      return start - 4 >= 0;
    })();
    const lightAfter = (() => {
      for (let i = start + 7; i < start + 11; i++) {
        if (i < bits.length && bits[i]) return false;
      }
      return start + 11 <= bits.length;
    })();
    return lightBefore || lightAfter;
  };
  for (let y = 0; y < size; y++) {
    const rowBits: boolean[] = [];
    const colBits: boolean[] = [];
    for (let x = 0; x < size; x++) {
      rowBits.push(at(x, y));
      colBits.push(at(y, x));
    }
    for (let x = 0; x + 7 <= size; x++) {
      if (hasFinderPattern(rowBits, x)) result += PENALTY_N3;
      if (hasFinderPattern(colBits, x)) result += PENALTY_N3;
    }
  }

  // N4: dark-module proportion deviation from 50%, in 5% steps.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (at(x, y)) dark += 1;
    }
  }
  const total = size * size;
  const k = Math.floor(Math.abs(dark * 20 - total * 10) / total);
  result += k * PENALTY_N4;

  return result;
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Encode `text` (UTF-8, byte mode) into a QR module matrix.
 *
 * Picks the smallest version that fits at the requested EC level and the
 * mask pattern with the lowest penalty score.
 *
 * @throws Error when the payload exceeds version 40 capacity.
 */
export function encodeQrMatrix(
  text: string,
  ec: QrErrorCorrection = "M",
): QrMatrix {
  const bytes = new TextEncoder().encode(text);

  let version = -1;
  for (let v = MIN_VERSION; v <= MAX_VERSION; v++) {
    const capacityBits = numDataCodewords(v, ec) * 8;
    const ccBits = v <= 9 ? 8 : 16;
    if (4 + ccBits + bytes.length * 8 <= capacityBits) {
      version = v;
      break;
    }
  }
  if (version === -1) {
    throw new Error(
      `Payload too long for a QR code at EC level ${ec} (${bytes.length} bytes)`,
    );
  }

  const dataCodewords = buildDataCodewords(bytes, version, ec);
  const allCodewords = addEccAndInterleave(dataCodewords, version, ec);

  const size = version * 4 + 17;
  const canvas = makeCanvas(size);
  drawFunctionPatterns(canvas, version, ec);
  drawCodewords(canvas, allCodewords);

  // Choose the mask with the minimum penalty (format bits included).
  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(canvas, mask);
    drawFormatBits(canvas, ec, mask);
    const score = penaltyScore(canvas);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(canvas, mask); // XOR is self-inverse — undo
  }
  applyMask(canvas, bestMask);
  drawFormatBits(canvas, ec, bestMask);

  return { size, version, mask: bestMask, modules: canvas.modules };
}

/**
 * Render a QR matrix as a single SVG path string (`M.. h1v1h-1z` per dark
 * module) in module coordinates, offset by `quietZone` modules on each side.
 * Callers wrap it in an `<svg viewBox="0 0 N N">` where
 * `N = size + 2·quietZone`.
 */
export function qrMatrixToSvgPath(qr: QrMatrix, quietZone = 2): string {
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++) {
    const row = qr.modules[y];
    if (!row) continue;
    for (let x = 0; x < qr.size; x++) {
      if (row[x]) {
        parts.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
      }
    }
  }
  return parts.join("");
}
