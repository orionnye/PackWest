import type { Piece } from "./types.js";

const CELL_CLASS = "inventory-drop-preview-cell";
const CELL_INVALID_CLASS = "inventory-drop-preview-cell-invalid";
const PREVIEW_ATTR = "data-drop-preview";

export function createDropPreviewCells(
  piece: Piece,
  col: number,
  row: number,
  minX: number,
  minY: number,
  isValid: boolean
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const c of piece.cells) {
    const gx = col + c.x;
    const gy = row + c.y;
    const cellEl = document.createElement("div");
    cellEl.className = `${CELL_CLASS} ${isValid ? "" : CELL_INVALID_CLASS}`.trim();
    cellEl.setAttribute(PREVIEW_ATTR, "true");
    cellEl.style.gridColumn = String(gx - minX + 1);
    cellEl.style.gridRow = String(gy - minY + 1);
    fragment.appendChild(cellEl);
  }

  return fragment;
}

export function removeDropPreview(container: HTMLElement): void {
  container.querySelectorAll(`[${PREVIEW_ATTR}="true"]`).forEach((el) => el.remove());
}

export function updateOrCreateDropPreview(
  container: HTMLElement,
  piece: Piece | undefined,
  col: number,
  row: number,
  minX: number,
  minY: number,
  isValid: boolean
): void {
  removeDropPreview(container);
  if (!piece) return;
  container.appendChild(createDropPreviewCells(piece, col, row, minX, minY, isValid));
}
