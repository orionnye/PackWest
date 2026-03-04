import type { Piece, PiecePlacement } from "./types.js";
import { getPieceBounds, getPieceOutline } from "./piece-utils.js";
import { grab, getGrabbed, release, type GrabOffset } from "./grabber.js";

const PIECE_BAG_CELL_SIZE = 22;
const COLS = 7;
const ROWS = 5;

function getPieceById(pieces: readonly Piece[], pieceId: string): Piece | undefined {
  return pieces.find((p) => p.id === pieceId);
}

export interface PieceBagCallbacks {
  onDropFromGrid?: (pieceId: string) => void;
}

export function renderPieceBag(
  container: HTMLElement,
  pieces: readonly Piece[],
  placements: readonly PiecePlacement[],
  callbacks?: PieceBagCallbacks
): void {
  container.innerHTML = "";
  container.className = "inventory-piece-bag";

  const title = document.createElement("h3");
  title.className = "inventory-piece-bag-title";
  title.textContent = "Piece Bag";
  container.appendChild(title);

  const wrapper = document.createElement("div");
  wrapper.className = "inventory-piece-bag-grid";
  wrapper.style.setProperty("--cols", String(COLS));
  wrapper.style.setProperty("--rows", String(ROWS));
  wrapper.style.setProperty("--cell-size", `${PIECE_BAG_CELL_SIZE}px`);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cellEl = document.createElement("div");
      cellEl.className = "inventory-cell inventory-piece-bag-slot";
      cellEl.style.gridColumn = String(x + 1);
      cellEl.style.gridRow = String(y + 1);
      wrapper.appendChild(cellEl);
    }
  }

  const piecesLayer = document.createElement("div");
  piecesLayer.className = "inventory-piece-bag-pieces";
  for (const p of placements) {
    const piece = getPieceById(pieces, p.pieceId);
    if (!piece) continue;
    const { w, h } = getPieceBounds(piece.cells);
    const outline = getPieceOutline(piece.cells, w, h);

    const pieceEl = document.createElement("div");
    pieceEl.className = "inventory-piece";
    pieceEl.dataset.pieceId = piece.id;
    pieceEl.dataset.source = "bag";
    pieceEl.style.gridColumn = `${p.col + 1} / span ${w}`;
    pieceEl.style.gridRow = `${p.row + 1} / span ${h}`;
    pieceEl.style.clipPath = `polygon(${outline})`;
    piecesLayer.appendChild(pieceEl);
  }

  wrapper.appendChild(piecesLayer);

  wrapper.addEventListener("mouseover", (e) => {
    const pieceEl = (e.target as HTMLElement).closest(".inventory-piece") as HTMLElement | null;
    const pieceId = pieceEl?.dataset.pieceId;
    wrapper.querySelectorAll(".piece-hovered").forEach((el) => el.classList.remove("piece-hovered"));
    if (pieceId) pieceEl?.classList.add("piece-hovered");
  });
  wrapper.addEventListener("mouseleave", () => {
    wrapper.querySelectorAll(".piece-hovered").forEach((el) => el.classList.remove("piece-hovered"));
  });

  wrapper.querySelectorAll(".inventory-piece").forEach((el) => {
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
        sourceCellSize: PIECE_BAG_CELL_SIZE,
      };
      grab(pieceId!, "bag", piece, ev, grabOffset);
    });
  });

  if (callbacks?.onDropFromGrid) {
    wrapper.addEventListener("click", (e) => {
      const g = getGrabbed();
      if (!g || g.source !== "grid") return;
      if ((e.target as HTMLElement).closest(".inventory-piece")) return;
      e.stopPropagation();
      callbacks.onDropFromGrid!(g.pieceId);
      release();
    });
  }

  container.appendChild(wrapper);
}
