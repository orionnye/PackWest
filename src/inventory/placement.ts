import type { Cell, Grid, Piece, PiecePlacement } from "./types.js";
import { getPieceBounds } from "./piece-utils.js";

const BAG_COLS = 7;
const BAG_ROWS = 5;

function getGridCellSet(cells: readonly Cell[]): Set<string> {
  return new Set(cells.map((c) => `${c.x},${c.y}`));
}

function getOccupiedByPlacements(
  placements: readonly PiecePlacement[],
  pieces: readonly Piece[]
): Set<string> {
  const occupied = new Set<string>();
  for (const p of placements) {
    const piece = pieces.find((pi) => pi.id === p.pieceId);
    if (!piece) continue;
    for (const c of piece.cells) {
      occupied.add(`${p.col + c.x},${p.row + c.y}`);
    }
  }
  return occupied;
}

export function findNextBagSlot(
  placements: readonly PiecePlacement[],
  pieces: readonly Piece[],
  newPiece: Piece
): { col: number; row: number } {
  const occupied = getOccupiedByPlacements(placements, pieces);
  for (let row = 0; row < BAG_ROWS; row++) {
    for (let col = 0; col < BAG_COLS; col++) {
      let fits = true;
      for (const c of newPiece.cells) {
        const gx = col + c.x;
        const gy = row + c.y;
        if (gx < 0 || gx >= BAG_COLS || gy < 0 || gy >= BAG_ROWS || occupied.has(`${gx},${gy}`)) {
          fits = false;
          break;
        }
      }
      if (fits) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

export function canPlacePieceOnGrid(
  grid: Grid,
  piece: Piece,
  col: number,
  row: number,
  pieces: readonly Piece[],
  excludePieceId?: string
): boolean {
  const gridCells = getGridCellSet(grid.cells);
  const placements = (grid.placements ?? []).filter((p) => p.pieceId !== excludePieceId);
  const occupied = getOccupiedByPlacements(placements, pieces);

  for (const c of piece.cells) {
    const gx = col + c.x;
    const gy = row + c.y;
    if (!gridCells.has(`${gx},${gy}`)) return false;
    if (occupied.has(`${gx},${gy}`)) return false;
  }
  return true;
}
