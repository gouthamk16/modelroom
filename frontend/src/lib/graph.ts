import type { Edge, Node } from "@xyflow/react";
import type { LayerType, ModelGraph } from "./types";

export interface LayerNodeData extends Record<string, unknown> {
  type: LayerType;
  params: Record<string, number>;
  outShape?: number[];
  error?: string | null;
}

export type LayerNode = Node<LayerNodeData>;

export const DEFAULT_PARAMS: Record<LayerType, Record<string, number>> = {
  input: { features: 8 },
  linear: { out_features: 16 },
  relu: {},
  dropout: { p: 0.5 },
  batchnorm1d: {},
  output: { classes: 2 },
};

let seq = 0;

export function makeNode(type: LayerType, position: { x: number; y: number }): LayerNode {
  seq += 1;
  return {
    id: `${type}_${seq}`,
    type: "layer",
    position,
    data: { type, params: { ...DEFAULT_PARAMS[type] } },
    deletable: type !== "input" && type !== "output",
  };
}

export function initialFlow(): { nodes: LayerNode[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: "input",
        type: "layer",
        position: { x: 60, y: 160 },
        data: { type: "input", params: { features: 8 } },
        deletable: false,
      },
      {
        id: "output",
        type: "layer",
        position: { x: 460, y: 160 },
        data: { type: "output", params: { classes: 2 } },
        deletable: false,
      },
    ],
    edges: [{ id: "input-output", source: "input", target: "output" }],
  };
}

export function toGraphPayload(
  nodes: LayerNode[],
  edges: Edge[],
  inputFeatures: number | null
): ModelGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      params: n.data.params,
      x: n.position.x,
      y: n.position.y,
    })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
    input_features: inputFeatures,
  };
}
