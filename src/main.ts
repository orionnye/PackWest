import type { Grid } from "./inventory/types.js";
import { Store } from "@adobe/data/ecs";
import {
  inventorySchema,
  renderGrid,
  renderMinimizedGrid,
  renderPieceBag,
  createOvalGrid,
  canPlacePieceOnGrid,
  findNextBagSlot,
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

function renderAll(): void {
  renderGrid(gridContainer, grid(), pieces(), {
    onDropFromBag: (pieceId, col, row) => {
      const piece = pieces().find((p) => p.id === pieceId);
      if (!piece || !canPlacePieceOnGrid(grid(), piece, col, row, pieces())) return;
      const bagPlacements = pieceBag().placements.filter((p) => p.pieceId !== pieceId);
      const gridPlacements = [...(grid().placements ?? []), { pieceId, col, row }];
      store.resources.pieceBag = { ...pieceBag(), placements: bagPlacements };
      store.resources.grid = { ...grid(), placements: gridPlacements };
      renderAll();
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
      renderAll();
    },
  });
}

function renderMinimizedRow(): void {
  minimizedRow.innerHTML = "";
  for (let i = 0; i < gridHistory.length; i++) {
    const slot = document.createElement("div");
    const g = gridHistory[i];
    renderMinimizedGrid(slot, g, pieces(), () => {
      const current = grid();
      if (current.cells.length > 0) {
        gridHistory[i] = { cells: [...current.cells], placements: current.placements ? [...current.placements] : [] };
      } else {
        gridHistory.splice(i, 1);
      }
      store.resources.grid = { cells: [...g.cells], placements: [...(g.placements ?? [])] };
      renderAll();
      renderMinimizedRow();
    });
    minimizedRow.appendChild(slot);
  }
}

function applyGrid(pushCurrent = false): void {
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
  renderAll();
  renderMinimizedRow();
}

const btn = document.createElement("button");
btn.textContent = "Regenerate Grid";
btn.className = "inventory-regenerate-btn";
btn.type = "button";
btn.addEventListener("click", () => applyGrid(true));

topHalf.append(gridContainer, piecesContainer);
app.append(btn, topHalf, minimizedRow);
applyGrid(false);
