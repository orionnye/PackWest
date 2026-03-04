import type { Piece } from "./types.js";
import { getPieceBounds, getPieceOutline } from "./piece-utils.js";

const GHOST_CELL_SIZE = 36;
const GHOST_CLASS = "inventory-grabber-ghost";

export type GrabSource = "grid" | "bag";

export interface GrabOffset {
  offsetX: number;
  offsetY: number;
  sourceCellSize: number;
}

export interface GrabbedState {
  pieceId: string;
  source: GrabSource;
  piece: Piece;
  grabOffset: GrabOffset;
}

let state: GrabbedState | null = null;
let ghostEl: HTMLElement | null = null;
let moveHandler: ((e: MouseEvent) => void) | null = null;
let docClickHandler: ((e: MouseEvent) => void) | null = null;
let contextMenuHandler: ((e: MouseEvent) => void) | null = null;
let onReleaseCallback: (() => void) | null = null;
let ghostSnapCallback: ((e: MouseEvent) => { x: number; y: number } | null) | null = null;

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
  const snap = ghostSnapCallback?.(e);
  if (snap) {
    ghostEl.style.visibility = "hidden";
    ghostEl.style.left = `${snap.x}px`;
    ghostEl.style.top = `${snap.y}px`;
  } else {
    ghostEl.style.visibility = "visible";
    const { offsetX, offsetY, sourceCellSize } = state.grabOffset;
    const scale = GHOST_CELL_SIZE / sourceCellSize;
    ghostEl.style.left = `${e.clientX - offsetX * scale}px`;
    ghostEl.style.top = `${e.clientY - offsetY * scale}px`;
  }
}

export function grab(
  pieceId: string,
  source: GrabSource,
  piece: Piece,
  ev?: MouseEvent,
  grabOffset?: GrabOffset
): void {
  release();
  const { w, h } = getPieceBounds(piece.cells);
  const size = grabOffset?.sourceCellSize ?? GHOST_CELL_SIZE;
  const defaultOffset: GrabOffset = {
    offsetX: (w * size) / 2,
    offsetY: (h * size) / 2,
    sourceCellSize: size,
  };
  state = { pieceId, source, piece, grabOffset: grabOffset ?? defaultOffset };
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

  contextMenuHandler = (e: MouseEvent) => {
    if (!state) return;
    e.preventDefault();
    release();
    document.removeEventListener("contextmenu", contextMenuHandler!, true);
    contextMenuHandler = null;
  };
  document.addEventListener("contextmenu", contextMenuHandler, true);
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
  if (contextMenuHandler) {
    document.removeEventListener("contextmenu", contextMenuHandler, true);
    contextMenuHandler = null;
  }
  ghostEl?.remove();
  ghostEl = null;
  state = null;
  onReleaseCallback?.();
}

export function setGhostSnap(cb: ((e: MouseEvent) => { x: number; y: number } | null) | null): void {
  ghostSnapCallback = cb;
}

export function setOnRelease(cb: (() => void) | null): void {
  onReleaseCallback = cb;
}

export function getGrabbed(): GrabbedState | null {
  return state;
}

export function isGrabbed(): boolean {
  return state !== null;
}
