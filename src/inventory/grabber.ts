import type { Piece } from "./types.js";
import { getPieceBounds, getPieceOutline } from "./piece-utils.js";

const GHOST_CELL_SIZE = 36;
const GHOST_CLASS = "inventory-grabber-ghost";

export type GrabSource = "grid" | "bag";

export interface GrabbedState {
  pieceId: string;
  source: GrabSource;
  piece: Piece;
}

let state: GrabbedState | null = null;
let ghostEl: HTMLElement | null = null;
let moveHandler: ((e: MouseEvent) => void) | null = null;
let docClickHandler: ((e: MouseEvent) => void) | null = null;

const INVENTORY_SELECTOR = ".inventory-grid-active, .inventory-piece-bag-grid";

function createGhost(piece: Piece): HTMLElement {
  const { w, h } = getPieceBounds(piece.cells);
  const outline = getPieceOutline(piece.cells, w, h);
  const el = document.createElement("div");
  el.className = GHOST_CLASS;
  el.style.width = `${w * GHOST_CELL_SIZE}px`;
  el.style.height = `${h * GHOST_CELL_SIZE}px`;
  el.style.clipPath = `polygon(${outline})`;
  document.body.appendChild(el);
  return el;
}

function onMouseMove(e: MouseEvent): void {
  if (!ghostEl || !state) return;
  const { w, h } = getPieceBounds(state.piece.cells);
  const size = GHOST_CELL_SIZE;
  ghostEl.style.left = `${e.clientX - (w * size) / 2}px`;
  ghostEl.style.top = `${e.clientY - (h * size) / 2}px`;
}

export function grab(pieceId: string, source: GrabSource, piece: Piece, ev?: MouseEvent): void {
  release();
  state = { pieceId, source, piece };
  ghostEl = createGhost(piece);
  moveHandler = onMouseMove;
  document.addEventListener("mousemove", moveHandler);
  if (ev) onMouseMove(ev);
  else {
    ghostEl.style.left = "-999px";
    ghostEl.style.top = "-999px";
  }

  docClickHandler = (e: MouseEvent) => {
    if (!state) return;
    const el = e.target as Element;
    if (el.closest?.(INVENTORY_SELECTOR)) return;
    release();
    document.removeEventListener("click", docClickHandler!, true);
    docClickHandler = null;
  };
  document.addEventListener("click", docClickHandler, true);
}

export function release(): void {
  if (moveHandler) {
    document.removeEventListener("mousemove", moveHandler);
    moveHandler = null;
  }
  if (docClickHandler) {
    document.removeEventListener("click", docClickHandler, true);
    docClickHandler = null;
  }
  ghostEl?.remove();
  ghostEl = null;
  state = null;
}

export function getGrabbed(): GrabbedState | null {
  return state;
}

export function isGrabbed(): boolean {
  return state !== null;
}
