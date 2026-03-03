import type { Piece } from "./types.js";
import { getPieceBounds, getPieceOutline } from "./piece-utils.js";

const PREVIEW_CLASS = "inventory-drop-preview";

export function createDropPreview(
  piece: Piece,
  col: number,
  row: number,
  minX: number,
  minY: number
): HTMLElement {
  const { w, h } = getPieceBounds(piece.cells);
  const outline = getPieceOutline(piece.cells, w, h);

  const el = document.createElement("div");
  el.className = PREVIEW_CLASS;
  el.style.gridColumn = `${col - minX + 1} / span ${w}`;
  el.style.gridRow = `${row - minY + 1} / span ${h}`;
  el.style.clipPath = `polygon(${outline})`;
  return el;
}

export function removeDropPreview(container: HTMLElement): void {
  container.querySelector(`.${PREVIEW_CLASS}`)?.remove();
}

export function updateOrCreateDropPreview(
  container: HTMLElement,
  piece: Piece | undefined,
  col: number,
  row: number,
  minX: number,
  minY: number
): void {
  removeDropPreview(container);
  if (!piece) return;
  container.appendChild(createDropPreview(piece, col, row, minX, minY));
}
