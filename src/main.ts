import type { Grid } from "./inventory/types.js";
import { Store } from "@adobe/data/ecs";
import {
  inventorySchema,
  renderGrid,
  destroyGrid,
  renderPieceBag,
  createOvalGrid,
  canPlacePieceOnGrid,
  findNextBagSlot,
  MINIMIZED_CELL_SIZE,
} from "./inventory/index.js";
import "./inventory/grid-display.css";

const app = document.getElementById("app")!;

const store = Store.create(inventorySchema);
const topHalf = document.createElement("div");
topHalf.className = "inventory-top-half";

const gridContainer = document.createElement("div");
gridContainer.className = "inventory-grid-section";

const piecesContainer = document.createElement("div");
piecesContainer.className = "inventory-pieces-section";

const minimizedRow = document.createElement("div");
minimizedRow.className = "inventory-minimized-row";

const gridHistory: Grid[] = [];
const pieces = () => store.resources.pieces.items;
const grid = () => store.resources.grid;
const pieceBag = () => store.resources.pieceBag;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

async function renderAll(): Promise<void> {
  await renderGrid(gridContainer, grid(), pieces(), { interactive: true }, {
    onDropToGrid: (pieceId, col, row, source) => {
      const piece = pieces().find((p) => p.id === pieceId);
      const excludePieceId = source === "grid" ? pieceId : undefined;
      if (!piece || !canPlacePieceOnGrid(grid(), piece, col, row, pieces(), excludePieceId)) return;
      const bagPlacements =
        source === "bag" ? pieceBag().placements.filter((p) => p.pieceId !== pieceId) : pieceBag().placements;
      const gridPlacements = [...(grid().placements ?? []).filter((p) => p.pieceId !== pieceId), { pieceId, col, row }];
      store.resources.pieceBag = { ...pieceBag(), placements: bagPlacements };
      store.resources.grid = { ...grid(), placements: gridPlacements };
      void renderAll();
    },
  });
  renderPieceBag(piecesContainer, pieces(), pieceBag().placements, {
    onDropFromGrid: (pieceId) => {
      const piece = pieces().find((p) => p.id === pieceId);
      if (!piece) return;
      const { col, row } = findNextBagSlot(pieceBag().placements, pieces(), piece);
      const bagPlacements = [...pieceBag().placements, { pieceId, col, row }];
      const gridPlacements = (grid().placements ?? []).filter((p) => p.pieceId !== pieceId);
      store.resources.pieceBag = { ...pieceBag(), placements: bagPlacements };
      store.resources.grid = { ...grid(), placements: gridPlacements };
      void renderAll();
    },
  });
}

async function renderMinimizedRow(): Promise<void> {
  Array.from(minimizedRow.children).forEach((child) => destroyGrid(child as HTMLElement));
  minimizedRow.innerHTML = "";
  for (let i = 0; i < gridHistory.length; i++) {
    const slot = document.createElement("div");
    slot.className = "inventory-minimized-slot";
    const g = gridHistory[i];
    minimizedRow.appendChild(slot);
    await renderGrid(slot, g, pieces(), {
      cellSize: MINIMIZED_CELL_SIZE,
      onClick: () => {
        const current = grid();
        if (current.cells.length > 0) {
          gridHistory[i] = { cells: [...current.cells], placements: current.placements ? [...current.placements] : [] };
        } else {
          gridHistory.splice(i, 1);
        }
        store.resources.grid = { cells: [...g.cells], placements: [...(g.placements ?? [])] };
        void renderAll();
        void renderMinimizedRow();
      },
    });
  }
}

async function applyGrid(pushCurrent = false): Promise<void> {
  if (pushCurrent) {
    const current = grid();
    if (current.cells.length > 0) {
      gridHistory.push({ cells: [...current.cells], placements: current.placements ? [...current.placements] : [] });
    }
  }

  const gridParams = {
    width: Math.floor(randomInRange(4, 8)),
    height: Math.floor(randomInRange(4, 8)),
    density: randomInRange(0.1, 0.5),
    roundness: randomInRange(1.1, 1.35),
  };
  store.resources.grid = { ...createOvalGrid(gridParams), placements: [] };
  await renderAll();
  await renderMinimizedRow();
}

const btn = document.createElement("button");
btn.textContent = "Regenerate Grid";
btn.className = "inventory-regenerate-btn";
btn.type = "button";
btn.addEventListener("click", () => void applyGrid(true));

topHalf.append(gridContainer, piecesContainer);
app.append(btn, topHalf, minimizedRow);
void applyGrid(false);
