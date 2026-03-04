import type { Cell, Grid, Piece, PiecePlacement } from "./types.js";
import { getPieceBounds, getPieceOutline } from "./piece-utils.js";
import { canPlacePieceOnGrid } from "./placement.js";
import { grab, getGrabbed, release, setOnRelease, setGhostSnap, type GrabOffset, type GrabSource } from "./grabber.js";
import { updateOrCreateDropPreview, removeDropPreview } from "./drop-preview.js";

const CELL_SIZE = 52; /* larger to occupy ~50-60% of layout */
const MINIMIZED_CELL_SIZE = 8;
const DROP_CELL_SELECTOR = ".inventory-grid-drop-cell";

export interface GridDisplayCallbacks {
  onDropToGrid?: (pieceId: string, col: number, row: number, source: GrabSource) => void;
  onDropFromBag?: (pieceId: string, col: number, row: number) => void;
}

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
    if (el instanceof HTMLElement && el.classList.contains("inventory-grid-drop-cell")) {
      return el;
    }
    const candidate = el.closest?.(DROP_CELL_SELECTOR);
    if (candidate instanceof HTMLElement) return candidate;
  }

  // Fallback: direct geometry check in case overlay hit-testing misses grid cells.
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

export function renderGrid(
  container: HTMLElement,
  grid: Grid,
  pieces: readonly Piece[],
  callbacks?: GridDisplayCallbacks
): void {
  const { cells, placements = [] } = grid;
  container.innerHTML = "";

  const { minX, maxX, minY, maxY } = getBounds(cells);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));

  const wrapper = document.createElement("div");
  wrapper.className = "inventory-grid inventory-grid-active";

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!cellSet.has(`${x},${y}`)) continue;
      const cellEl = document.createElement("div");
      cellEl.className = "inventory-cell inventory-grid-drop-cell";
      cellEl.dataset.x = String(x);
      cellEl.dataset.y = String(y);
      cellEl.style.gridColumn = String(x - minX + 1);
      cellEl.style.gridRow = String(y - minY + 1);
      wrapper.appendChild(cellEl);
    }
  }

  const piecesLayer = document.createElement("div");
  piecesLayer.className = "inventory-grid-pieces";
  for (const p of placements) {
    const piece = getPieceById(pieces, p.pieceId);
    if (!piece) continue;
    const { w, h } = getPieceBounds(piece.cells);
    const outline = getPieceOutline(piece.cells, w, h);

    const pieceEl = document.createElement("div");
    pieceEl.className = "inventory-piece inventory-grid-piece";
    pieceEl.dataset.pieceId = piece.id;
    pieceEl.dataset.source = "grid";
    pieceEl.style.gridColumn = `${p.col - minX + 1} / span ${w}`;
    pieceEl.style.gridRow = `${p.row - minY + 1} / span ${h}`;
    pieceEl.style.clipPath = `polygon(${outline})`;
    piecesLayer.appendChild(pieceEl);
  }

  wrapper.appendChild(piecesLayer);
  const dropCells = Array.from(wrapper.querySelectorAll(DROP_CELL_SELECTOR)) as HTMLElement[];

  setGhostSnap((ev: MouseEvent) => {
    const g = getGrabbed();
    if (!g) return null;
    const cell = resolveDropCellAtPoint(dropCells, ev.clientX, ev.clientY);
    if (!cell) {
      removeDropPreview(piecesLayer);
      return null;
    }
    const dropPos = getDropCellPosition(cell);
    if (!dropPos) return null;
    const { col, row } = dropPos;
    const piece = getPieceById(pieces, g.pieceId);
    if (!piece) return null;
    const excludePieceId = g.source === "grid" ? g.pieceId : undefined;
    const isValid = canPlacePieceOnGrid(grid, piece, col, row, pieces, excludePieceId);
    updateOrCreateDropPreview(piecesLayer, piece, col, row, minX, minY, isValid);
    const rect = cell.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  });
  setOnRelease(() => {
    removeDropPreview(piecesLayer);
  });

  wrapper.style.setProperty("--cols", String(cols));
  wrapper.style.setProperty("--rows", String(rows));
  wrapper.style.setProperty("--cell-size", `${CELL_SIZE}px`);

  wrapper.querySelectorAll(".inventory-grid-piece").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const pieceEl = e.target as HTMLElement;
      const pieceId = pieceEl.dataset.pieceId;
      const piece = pieceId ? getPieceById(pieces, pieceId) : undefined;
      if (!piece) return;
      const rect = pieceEl.getBoundingClientRect();
      const ev = e as MouseEvent;
      const grabOffset: GrabOffset = {
        offsetX: ev.clientX - rect.left,
        offsetY: ev.clientY - rect.top,
        sourceCellSize: CELL_SIZE,
      };
      grab(pieceId!, "grid", piece, ev, grabOffset);
    });
  });

  if (callbacks?.onDropToGrid || callbacks?.onDropFromBag) {
    wrapper.addEventListener("click", (e) => {
      const g = getGrabbed();
      if (!g) return;
      if ((e.target as Element).closest(".inventory-grid-piece")) return;
      const piece = getPieceById(pieces, g.pieceId);
      if (!piece) return;
      const cell = (e.target as Element).closest(DROP_CELL_SELECTOR) as HTMLElement | null;
      if (!cell) return;
      const dropPos = getDropCellPosition(cell);
      if (!dropPos) return;
      const { col, row } = dropPos;
      const excludePieceId = g.source === "grid" ? g.pieceId : undefined;
      if (!canPlacePieceOnGrid(grid, piece, col, row, pieces, excludePieceId)) return;
      e.stopPropagation();
      if (callbacks?.onDropToGrid) callbacks.onDropToGrid(g.pieceId, col, row, g.source);
      else if (g.source === "bag" && callbacks?.onDropFromBag) callbacks.onDropFromBag(g.pieceId, col, row);
      release();
    });
  }

  container.appendChild(wrapper);
}

export function renderMinimizedGrid(
  container: HTMLElement,
  grid: Grid,
  pieces: readonly Piece[],
  onClick: () => void
): void {
  const { cells, placements = [] } = grid;
  container.innerHTML = "";
  container.className = "inventory-minimized-slot";

  const { minX, maxX, minY, maxY } = getBounds(cells);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));

  const wrapper = document.createElement("div");
  wrapper.className = "inventory-grid inventory-grid-minimized";
  wrapper.style.setProperty("--cols", String(cols));
  wrapper.style.setProperty("--rows", String(rows));
  wrapper.style.setProperty("--cell-size", `${MINIMIZED_CELL_SIZE}px`);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!cellSet.has(`${x},${y}`)) continue;
      const cellEl = document.createElement("div");
      cellEl.className = "inventory-cell";
      cellEl.dataset.x = String(x);
      cellEl.dataset.y = String(y);
      cellEl.style.gridColumn = String(x - minX + 1);
      cellEl.style.gridRow = String(y - minY + 1);
      wrapper.appendChild(cellEl);
    }
  }

  const piecesLayer = document.createElement("div");
  piecesLayer.className = "inventory-grid-pieces inventory-grid-pieces-minimized";
  for (const p of placements) {
    const piece = getPieceById(pieces, p.pieceId);
    if (!piece) continue;
    const { w, h } = getPieceBounds(piece.cells);
    const outline = getPieceOutline(piece.cells, w, h);

    const pieceEl = document.createElement("div");
    pieceEl.className = "inventory-piece inventory-grid-piece inventory-grid-piece-minimized";
    pieceEl.dataset.pieceId = piece.id;
    pieceEl.style.gridColumn = `${p.col - minX + 1} / span ${w}`;
    pieceEl.style.gridRow = `${p.row - minY + 1} / span ${h}`;
    pieceEl.style.clipPath = `polygon(${outline})`;
    piecesLayer.appendChild(pieceEl);
  }
  wrapper.appendChild(piecesLayer);

  container.appendChild(wrapper);
  container.addEventListener("click", onClick);
}
