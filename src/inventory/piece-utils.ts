import type { Cell } from "./types.js";

export function getPieceBounds(cells: readonly Cell[]): { w: number; h: number; minX: number; minY: number } {
  if (cells.length === 0) return { w: 0, h: 0, minX: 0, minY: 0 };
  let minX = cells[0].x, maxX = cells[0].x, minY = cells[0].y, maxY = cells[0].y;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1, minX, minY };
}

/**
 * Returns polygon vertices as flat [x0,y0, x1,y1, ...] pixel coords for PIXI.Graphics.poly.
 * Traces the same boundary as getPieceOutline but in absolute pixels relative to the piece origin.
 */
export function getPiecePolygon(cells: readonly Cell[], cellSize: number, gap: number): number[] {
  if (!cells?.length) return [0, 0, cellSize, 0, cellSize, cellSize, 0, cellSize];
  const { minX, minY } = getPieceBounds(cells);
  const set = new Set(cells.map((c) => `${c.x},${c.y}`));
  const step = cellSize + gap;
  const edges: [string, string][] = [];
  for (const c of cells) {
    const { x: cx, y: cy } = c;
    if (!set.has(`${cx},${cy - 1}`)) edges.push([`${cx},${cy}`, `${cx + 1},${cy}`]);
    if (!set.has(`${cx + 1},${cy}`)) edges.push([`${cx + 1},${cy}`, `${cx + 1},${cy + 1}`]);
    if (!set.has(`${cx},${cy + 1}`)) edges.push([`${cx + 1},${cy + 1}`, `${cx},${cy + 1}`]);
    if (!set.has(`${cx - 1},${cy}`)) edges.push([`${cx},${cy + 1}`, `${cx},${cy}`]);
  }
  const adj = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(b)!.push(a);
  }
  const vertices = [...adj.keys()];
  const start = vertices.sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    return ay !== by ? ay - by : ax - bx;
  })[0];
  if (!start) return [0, 0, cellSize, 0, cellSize, cellSize, 0, cellSize];
  const pts: number[] = [];
  let cur = start;
  let prev = "";
  do {
    const [x, y] = cur.split(",").map(Number);
    pts.push((x - minX) * step, (y - minY) * step);
    const neighbors = adj.get(cur);
    if (!neighbors?.length) break;
    const next = neighbors.find((n) => n !== prev) ?? neighbors[0];
    prev = cur;
    cur = next;
  } while (cur !== start);
  return pts;
}

/** Returns polygon vertices as percentages for clip-path, tracing the boundary clockwise. */
export function getPieceOutline(cells: readonly Cell[], w: number, h: number): string {
  if (!cells?.length) return "0% 0%, 100% 0%, 100% 100%, 0% 100%";
  const set = new Set(cells.map((c) => `${c.x},${c.y}`));
  const edges: [string, string][] = [];
  for (const c of cells) {
    const { x: cx, y: cy } = c;
    if (!set.has(`${cx},${cy - 1}`)) edges.push([`${cx},${cy}`, `${cx + 1},${cy}`]);
    if (!set.has(`${cx + 1},${cy}`)) edges.push([`${cx + 1},${cy}`, `${cx + 1},${cy + 1}`]);
    if (!set.has(`${cx},${cy + 1}`)) edges.push([`${cx + 1},${cy + 1}`, `${cx},${cy + 1}`]);
    if (!set.has(`${cx - 1},${cy}`)) edges.push([`${cx},${cy + 1}`, `${cx},${cy}`]);
  }
  const adj = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(b)!.push(a);
  }
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const vertices = [...adj.keys()];
  const start = vertices.sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    return ay !== by ? ay - by : ax - bx;
  })[0];
  if (!start) return "0% 0%, 100% 0%, 100% 100%, 0% 100%";
  const pts: [number, number][] = [];
  let cur = start;
  let prev = "";
  do {
    const [x, y] = cur.split(",").map(Number);
    pts.push([((x - minX) / w) * 100, ((y - minY) / h) * 100]);
    const neighbors = adj.get(cur);
    if (!neighbors?.length) break;
    const next = neighbors.find((n) => n !== prev) ?? neighbors[0];
    prev = cur;
    cur = next;
  } while (cur !== start);
  return pts.map(([x, y]) => `${x}% ${y}%`).join(", ");
}
