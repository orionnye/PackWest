import type { Piece } from "./types.js";
import { Store } from "@adobe/data/ecs";
import { PIECES } from "./pieces.js";

const cellSchema = {
  type: "object" as const,
  properties: {
    x: { type: "integer" as const },
    y: { type: "integer" as const },
  },
  required: ["x", "y"] as const,
};

const piecePlacementSchema = {
  type: "object" as const,
  properties: {
    pieceId: { type: "string" as const },
    col: { type: "integer" as const },
    row: { type: "integer" as const },
  },
  required: ["pieceId", "col", "row"] as const,
};

const gridResourceSchema = {
  type: "object" as const,
  properties: {
    cells: {
      type: "array" as const,
      items: cellSchema,
      default: [] as { x: number; y: number }[],
    },
    placements: {
      type: "array" as const,
      items: piecePlacementSchema,
      default: [] as { pieceId: string; col: number; row: number }[],
    },
  },
  required: ["cells", "placements"] as const,
  default: (() => {
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) cells.push({ x, y });
    return { cells, placements: [] };
  })(),
};

const piecesResourceSchema = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          cells: {
            type: "array" as const,
            items: cellSchema,
          },
        },
        required: ["id", "cells"] as const,
      },
      default: PIECES,
    },
  },
  required: ["items"] as const,
  default: { items: PIECES },
};

const pieceBagPlacementSchema = {
  type: "object" as const,
  properties: {
    pieceId: { type: "string" as const },
    col: { type: "integer" as const },
    row: { type: "integer" as const },
  },
  required: ["pieceId", "col", "row"] as const,
};

const pieceBagResourceSchema = {
  type: "object" as const,
  properties: {
    cols: { type: "integer" as const, default: 7 },
    rows: { type: "integer" as const, default: 5 },
    placements: {
      type: "array" as const,
      items: pieceBagPlacementSchema,
      default: [
        { pieceId: "I", col: 0, row: 0 },
        { pieceId: "O", col: 4, row: 0 },
        { pieceId: "T", col: 0, row: 2 },
        { pieceId: "L", col: 3, row: 0 },
        { pieceId: "J", col: 5, row: 0 },
        { pieceId: "S", col: 0, row: 3 },
        { pieceId: "Z", col: 3, row: 3 },
        { pieceId: "1x1", col: 6, row: 0 },
        { pieceId: "2x2", col: 5, row: 2 },
        { pieceId: "3x1", col: 4, row: 4 },
      ],
    },
  },
  required: ["cols", "rows", "placements"] as const,
  default: {
    cols: 7,
    rows: 5,
    placements: [
      { pieceId: "I", col: 0, row: 0 },
      { pieceId: "O", col: 4, row: 0 },
      { pieceId: "T", col: 0, row: 2 },
      { pieceId: "L", col: 3, row: 0 },
      { pieceId: "J", col: 5, row: 0 },
      { pieceId: "S", col: 0, row: 3 },
      { pieceId: "Z", col: 3, row: 3 },
      { pieceId: "1x1", col: 6, row: 0 },
      { pieceId: "2x2", col: 5, row: 2 },
      { pieceId: "3x1", col: 4, row: 4 },
    ],
  },
};

export const inventorySchema = Store.Schema.create({
  components: {},
  resources: {
    grid: gridResourceSchema,
    pieces: piecesResourceSchema,
    pieceBag: pieceBagResourceSchema,
  },
  archetypes: {},
});
