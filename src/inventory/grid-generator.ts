import type { Cell, Grid } from "./types.js";

export interface NoisyGridOptions {
  width: number;
  height: number;
  /** Probability (0–1) that a cell is kept. Lower = more holes. */
  density?: number;
  /** Optional seed for reproducible results. */
  seed?: number;
}

export interface OvalGridOptions {
  width?: number;
  height?: number;
  /** Boundary noise (0–1). 1 = clean oval, lower = irregular edges. */
  density?: number;
  /** Ellipse looseness (>1 = rounder, fewer corners cut). 1.2 = ~1–2 corners missing. */
  roundness?: number;
  seed?: number;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normalize cell to unit square (-1..1) so all corners are equidistant from center.
 * Uses bounding-box corners at ±1; eliminates ellipse bias toward top-left.
 */
function normalizedDistance(width: number, height: number, cellX: number, cellY: number): number {
  const cellCx = cellX + 0.5;
  const cellCy = cellY + 0.5;
  const centerX = width / 2;
  const centerY = height / 2;
  const halfW = width / 2;
  const halfH = height / 2;
  const nx = (cellCx - centerX) / halfW;
  const ny = (cellCy - centerY) / halfH;
  return nx * nx + ny * ny;
}

export function createNoisyGrid(options: NoisyGridOptions): Grid {
  const { width, height, density = 0.85, seed } = options;
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;

  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rng() < density) cells.push({ x, y });
    }
  }

  return { cells };
}

export function createOvalGrid(options: OvalGridOptions = {}): Grid {
  const raw = options;
  const width = Math.min(7, Math.max(4, raw.width ?? 5));
  const height = Math.min(7, Math.max(4, raw.height ?? 5));
  const density = raw.density ?? 0.2;
  const roundness = Math.min(1.35, Math.max(1.1, raw.roundness ?? 1.2));
  const seed = raw.seed;
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;

  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = normalizedDistance(width, height, x, y);
      const threshold = roundness;

      if (d <= threshold) {
        cells.push({ x, y });
      } else if (d <= threshold * 1.1 && rng() < density) {
        cells.push({ x, y });
      }
    }
  }

  return { cells };
}
