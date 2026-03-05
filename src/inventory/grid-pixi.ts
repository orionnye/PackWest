import { Application, Graphics } from "pixi.js";
import type { Grid, Piece } from "./types.js";
import { getPieceBounds, getPiecePolygon } from "./piece-utils.js";

const GAP = 3;

const COLORS = {
  cell:            0x5c5046,
  piece:           0x1a3a5c,
  pieceBorder:     0x0a2030,
  previewValid:    0x5a7a5a,
  previewInvalid:  0x7a3c3c,
} as const;

const PIECE_BORDER_WIDTH = 2;

export interface GridRenderer {
  canvas: HTMLCanvasElement;
  draw(grid: Grid, pieces: readonly Piece[], minX: number, minY: number, cols: number, rows: number): void;
  drawPreview(piece: Piece, col: number, row: number, minX: number, minY: number, isValid: boolean): void;
  clearPreview(): void;
  destroy(): void;
}

export async function createGridRenderer(cellSize: number, padding: number): Promise<GridRenderer> {
  const app = new Application();
  await app.init({
    background: 0x4a4038,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    autoStart: false,
    width: 100,
    height: 100,
  });

  const step = cellSize + GAP;
  const cellRadius = cellSize < 16 ? 2 : 6;

  const cellsGfx = new Graphics();
  const piecesGfx = new Graphics();
  const previewGfx = new Graphics();
  app.stage.addChild(cellsGfx, piecesGfx, previewGfx);

  function toPixel(coord: number, minCoord: number): number {
    return padding + (coord - minCoord) * step;
  }

  function draw(
    grid: Grid,
    pieces: readonly Piece[],
    minX: number,
    minY: number,
    cols: number,
    rows: number
  ): void {
    const w = padding * 2 + cols * cellSize + (cols > 1 ? (cols - 1) * GAP : 0);
    const h = padding * 2 + rows * cellSize + (rows > 1 ? (rows - 1) * GAP : 0);
    app.renderer.resize(w, h);

    cellsGfx.clear();
    piecesGfx.clear();
    previewGfx.clear();

    for (const c of grid.cells) {
      cellsGfx
        .roundRect(toPixel(c.x, minX), toPixel(c.y, minY), cellSize, cellSize, cellRadius)
        .fill(COLORS.cell);
    }

    for (const p of grid.placements ?? []) {
      const piece = pieces.find((pc) => pc.id === p.pieceId);
      if (!piece) continue;
      const { minX: pMinX, minY: pMinY } = getPieceBounds(piece.cells);
      const ox = toPixel(p.col + pMinX, minX);
      const oy = toPixel(p.row + pMinY, minY);
      const pts = getPiecePolygon(piece.cells, cellSize, GAP);
      const translated = pts.map((v, i) => v + (i % 2 === 0 ? ox : oy));
      piecesGfx.poly(translated).fill(COLORS.piece).stroke({ color: COLORS.pieceBorder, width: PIECE_BORDER_WIDTH });
    }

    app.render();
  }

  function drawPreview(
    piece: Piece,
    col: number,
    row: number,
    minX: number,
    minY: number,
    isValid: boolean
  ): void {
    previewGfx.clear();
    const color = isValid ? COLORS.previewValid : COLORS.previewInvalid;
    const { minX: pMinX, minY: pMinY } = getPieceBounds(piece.cells);
    const ox = toPixel(col + pMinX, minX);
    const oy = toPixel(row + pMinY, minY);
    const pts = getPiecePolygon(piece.cells, cellSize, GAP);
    const translated = pts.map((v, i) => v + (i % 2 === 0 ? ox : oy));
    previewGfx.poly(translated).fill({ color, alpha: 0.9 }).stroke({ color: COLORS.pieceBorder, width: PIECE_BORDER_WIDTH, alpha: 0.9 });
    app.render();
  }

  function clearPreview(): void {
    previewGfx.clear();
    app.render();
  }

  function destroy(): void {
    app.destroy(true, { children: true });
  }

  return {
    canvas: app.canvas as HTMLCanvasElement,
    draw,
    drawPreview,
    clearPreview,
    destroy,
  };
}
