export interface Cell {
  x: number;
  y: number;
}

export interface PiecePlacement {
  pieceId: string;
  col: number;
  row: number;
}

export interface Grid {
  cells: readonly Cell[];
  placements?: readonly PiecePlacement[];
}

export interface Piece {
  id: string;
  cells: readonly Cell[];
}
