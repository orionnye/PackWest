import type { Cell, Grid, Piece } from "./types.js";
import { getPieceBounds } from "./piece-utils.js";
import { canPlacePieceOnGrid } from "./placement.js";
import {
  grab,
  getGrabbed,
  release,
  setOnRelease,
  setGhostSnap,
  type GrabOffset,
  type GrabSource,
} from "./grabber.js";
import { createGridRenderer, type GridRenderer } from "./grid-pixi.js";

export const CELL_SIZE = 52;
export const MINIMIZED_CELL_SIZE = 8;
const CELL_GAP = 3;
const FULL_PADDING = 16;
const MINI_PADDING = 4;
const DROP_CELL_SELECTOR = ".inventory-grid-drop-cell";

export interface GridDisplayOptions {
  cellSize?: number;
  interactive?: boolean;
  onClick?: () => void;
}

export interface GridDisplayCallbacks {
  onDropToGrid?: (pieceId: string, col: number, row: number, source: GrabSource) => void;
  onDropFromBag?: (pieceId: string, col: number, row: number) => void;
}

interface RenderContext {
  grid: Grid;
  pieces: readonly Piece[];
  minX: number;
  minY: number;
  dropCells: HTMLElement[];
  dropCellByPos: Map<string, HTMLElement>;
  callbacks: GridDisplayCallbacks | undefined;
}

interface ContainerState {
  renderer: GridRenderer;
  wrapper: HTMLElement;
  overlay: HTMLElement | null;
  onClick: (() => void) | undefined;
  ctx: RenderContext;
}

const containerStateMap = new WeakMap<HTMLElement, ContainerState>();

function getBounds(cells: readonly Cell[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (cells.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = cells[0].x, maxX = cells[0].x, minY = cells[0].y, maxY = cells[0].y;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, maxX, minY, maxY };
}

function getPieceById(pieces: readonly Piece[], pieceId: string): Piece | undefined {
  return pieces.find((p) => p.id === pieceId);
}

function resolveDropCellAtPoint(
  dropCells: readonly HTMLElement[],
  clientX: number,
  clientY: number
): HTMLElement | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (el instanceof HTMLElement && el.classList.contains("inventory-grid-drop-cell")) return el;
    const candidate = el.closest?.(DROP_CELL_SELECTOR);
    if (candidate instanceof HTMLElement) return candidate;
  }
  for (const cell of dropCells) {
    const rect = cell.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return cell;
    }
  }
  return null;
}

function getDropCellPosition(cell: HTMLElement): { col: number; row: number } | null {
  const col = Number(cell.dataset.x);
  const row = Number(cell.dataset.y);
  if (Number.isNaN(col) || Number.isNaN(row)) return null;
  return { col, row };
}

function getGrabbedPieceCellOffset(piece: Piece, grabOffset: GrabOffset): { cellX: number; cellY: number } {
  const { w, h, minX, minY } = getPieceBounds(piece.cells);
  const rawCellX = Math.floor(grabOffset.offsetX / grabOffset.sourceCellSize);
  const rawCellY = Math.floor(grabOffset.offsetY / grabOffset.sourceCellSize);
  return {
    cellX: minX + Math.max(0, Math.min(w - 1, rawCellX)),
    cellY: minY + Math.max(0, Math.min(h - 1, rawCellY)),
  };
}

function applyCanvasStyle(canvas: HTMLCanvasElement, cellSize: number): void {
  const mini = cellSize <= MINIMIZED_CELL_SIZE;
  canvas.style.display = "block";
  canvas.style.borderRadius = mini ? "10px" : "16px";
  canvas.style.border = `${mini ? 3 : 4}px solid #4a4038`;
  canvas.style.boxSizing = "border-box";
  canvas.style.boxShadow = mini
    ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 6px rgba(30,25,20,0.6)"
    : "inset 0 0 30px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.08), 0 6px 0 #4a4038, 0 10px 24px rgba(30,25,20,0.6)";
}

export async function renderGrid(
  container: HTMLElement,
  grid: Grid,
  pieces: readonly Piece[],
  options?: GridDisplayOptions,
  callbacks?: GridDisplayCallbacks
): Promise<void> {
  const cellSize = options?.cellSize ?? CELL_SIZE;
  const interactive = options?.interactive ?? false;
  const padding = cellSize <= MINIMIZED_CELL_SIZE ? MINI_PADDING : FULL_PADDING;
  const step = cellSize + CELL_GAP;

  const { cells, placements = [] } = grid;
  const { minX, maxX, minY, maxY } = getBounds(cells);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  let state = containerStateMap.get(container);

  if (!state) {
    const renderer = await createGridRenderer(cellSize, padding);
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;display:inline-block;line-height:0;";
    if (interactive) wrapper.classList.add("inventory-grid-active");

    applyCanvasStyle(renderer.canvas, cellSize);
    wrapper.appendChild(renderer.canvas);

    let overlay: HTMLElement | null = null;
    if (interactive) {
      overlay = document.createElement("div");
      overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;";
      wrapper.appendChild(overlay);
    }

    container.appendChild(wrapper);

    const ctx: RenderContext = {
      grid,
      pieces,
      minX,
      minY,
      dropCells: [],
      dropCellByPos: new Map(),
      callbacks,
    };

    state = { renderer, wrapper, overlay, onClick: options?.onClick, ctx };
    containerStateMap.set(container, state);

    (container as any).__destroyGrid = () => {
      state!.renderer.destroy();
      containerStateMap.delete(container);
    };

    if (!interactive) {
      wrapper.addEventListener("click", () => state!.onClick?.());
    }

    if (interactive) {
      setGhostSnap((ev: MouseEvent) => {
        const g = getGrabbed();
        if (!g) return null;
        const cell = resolveDropCellAtPoint(ctx.dropCells, ev.clientX, ev.clientY);
        if (!cell) {
          state!.renderer.clearPreview();
          return null;
        }
        const dropPos = getDropCellPosition(cell);
        if (!dropPos) return null;
        const piece = getPieceById(ctx.pieces, g.pieceId);
        if (!piece) return null;
        const { cellX, cellY } = getGrabbedPieceCellOffset(piece, g.grabOffset);
        const col = dropPos.col - cellX;
        const row = dropPos.row - cellY;
        const excludePieceId = g.source === "grid" ? g.pieceId : undefined;
        const isValid = canPlacePieceOnGrid(ctx.grid, piece, col, row, ctx.pieces, excludePieceId);
        state!.renderer.drawPreview(piece, col, row, ctx.minX, ctx.minY, isValid);
        const originCell = ctx.dropCellByPos.get(`${col},${row}`) ?? cell;
        const rect = originCell.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
      });

      setOnRelease(() => state!.renderer.clearPreview());

      wrapper.addEventListener("click", (e) => {
        const g = getGrabbed();
        if (!g) return;
        if ((e.target as Element).closest(".inventory-grid-piece")) return;
        const piece = getPieceById(ctx.pieces, g.pieceId);
        if (!piece) return;
        const cell = (e.target as Element).closest(DROP_CELL_SELECTOR) as HTMLElement | null;
        if (!cell) return;
        const dropPos = getDropCellPosition(cell);
        if (!dropPos) return;
        const { cellX, cellY } = getGrabbedPieceCellOffset(piece, g.grabOffset);
        const col = dropPos.col - cellX;
        const row = dropPos.row - cellY;
        const excludePieceId = g.source === "grid" ? g.pieceId : undefined;
        if (!canPlacePieceOnGrid(ctx.grid, piece, col, row, ctx.pieces, excludePieceId)) return;
        e.stopPropagation();
        const cbs = ctx.callbacks;
        if (cbs?.onDropToGrid) cbs.onDropToGrid(g.pieceId, col, row, g.source);
        else if (g.source === "bag" && cbs?.onDropFromBag) cbs.onDropFromBag(g.pieceId, col, row);
        release();
      });
    }
  }

  const { renderer, overlay, ctx } = state;

  // Update mutable context so event handlers always reference current data
  ctx.grid = grid;
  ctx.pieces = pieces;
  ctx.minX = minX;
  ctx.minY = minY;
  ctx.callbacks = callbacks;
  state.onClick = options?.onClick;

  renderer.draw(grid, pieces, minX, minY, cols, rows);

  if (interactive && overlay) {
    overlay.innerHTML = "";
    const dropCells: HTMLElement[] = [];
    const dropCellByPos = new Map<string, HTMLElement>();

    for (const c of cells) {
      const cellEl = document.createElement("div");
      cellEl.className = "inventory-grid-drop-cell";
      cellEl.dataset.x = String(c.x);
      cellEl.dataset.y = String(c.y);
      cellEl.style.cssText = [
        "position:absolute",
        `left:${padding + (c.x - minX) * step}px`,
        `top:${padding + (c.y - minY) * step}px`,
        `width:${cellSize}px`,
        `height:${cellSize}px`,
        "pointer-events:auto",
        "background:transparent",
      ].join(";");
      overlay.appendChild(cellEl);
      dropCells.push(cellEl);
      dropCellByPos.set(`${c.x},${c.y}`, cellEl);
    }

    ctx.dropCells = dropCells;
    ctx.dropCellByPos = dropCellByPos;

    for (const p of placements) {
      const piece = getPieceById(pieces, p.pieceId);
      if (!piece) continue;
      const { w, h } = getPieceBounds(piece.cells);
      const pw = w * cellSize + (w > 1 ? (w - 1) * CELL_GAP : 0);
      const ph = h * cellSize + (h > 1 ? (h - 1) * CELL_GAP : 0);

      const pieceEl = document.createElement("div");
      pieceEl.className = "inventory-grid-piece";
      pieceEl.dataset.pieceId = piece.id;
      pieceEl.style.cssText = [
        "position:absolute",
        `left:${padding + (p.col - minX) * step}px`,
        `top:${padding + (p.row - minY) * step}px`,
        `width:${pw}px`,
        `height:${ph}px`,
        "pointer-events:auto",
        "background:transparent",
        "cursor:grab",
      ].join(";");
      overlay.appendChild(pieceEl);

      pieceEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const pieceId = pieceEl.dataset.pieceId;
        const pc = pieceId ? getPieceById(ctx.pieces, pieceId) : undefined;
        if (!pc) return;
        const rect = pieceEl.getBoundingClientRect();
        const ev = e as MouseEvent;
        grab(pieceId!, "grid", pc, ev, {
          offsetX: ev.clientX - rect.left,
          offsetY: ev.clientY - rect.top,
          sourceCellSize: cellSize,
        });
      });
    }
  }
}

export function destroyGrid(container: HTMLElement): void {
  (container as any).__destroyGrid?.();
}
