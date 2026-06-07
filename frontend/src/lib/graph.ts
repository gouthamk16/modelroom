import type { GraphNode, LayerType, ModelGraph } from "./types";

const DEFAULT_PARAMS: Record<LayerType, Record<string, number>> = {
  input: { features: 8 },
  linear: { out_features: 16 },
  relu: {},
  dropout: { p: 0.5 },
  batchnorm1d: {},
  output: { classes: 2 },
};

let seq = 0;
function newId(type: LayerType): string {
  seq += 1;
  return `${type}_${seq}`;
}

export function defaultGraph(features: number, classes: number): ModelGraph {
  return {
    nodes: [
      { id: "input", type: "input", params: { features } },
      { id: "output", type: "output", params: { classes } },
    ],
    input_features: features,
  };
}

export function addLayer(graph: ModelGraph, type: LayerType): ModelGraph {
  const node: GraphNode = { id: newId(type), type, params: { ...DEFAULT_PARAMS[type] } };
  const outIdx = graph.nodes.findIndex((n) => n.type === "output");
  const insertAt = outIdx === -1 ? graph.nodes.length : outIdx;
  const nodes = [...graph.nodes.slice(0, insertAt), node, ...graph.nodes.slice(insertAt)];
  return { ...graph, nodes };
}

export function removeLayer(graph: ModelGraph, id: string): ModelGraph {
  if (id === "input" || id === "output") return graph;
  return { ...graph, nodes: graph.nodes.filter((n) => n.id !== id) };
}

export function updateParams(
  graph: ModelGraph,
  id: string,
  params: Record<string, number>
): ModelGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === id ? { ...n, params: { ...n.params, ...params } } : n
    ),
  };
}

export function chainEdges(
  nodes: GraphNode[]
): { id: string; source: string; target: string }[] {
  return nodes.slice(0, -1).map((n, i) => ({
    id: `${n.id}-${nodes[i + 1].id}`,
    source: n.id,
    target: nodes[i + 1].id,
  }));
}
