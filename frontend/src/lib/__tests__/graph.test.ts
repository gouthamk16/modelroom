import { describe, expect, test } from "vitest";
import { defaultGraph, addLayer, removeLayer, updateParams, chainEdges } from "../graph";

describe("graph helpers", () => {
  test("defaultGraph has input then output", () => {
    const g = defaultGraph(8, 2);
    expect(g.nodes.map((n) => n.type)).toEqual(["input", "output"]);
    expect(g.nodes[0].params.features).toBe(8);
    expect(g.nodes[1].params.classes).toBe(2);
  });

  test("addLayer inserts before output", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    expect(g.nodes.map((n) => n.type)).toEqual(["input", "linear", "output"]);
  });

  test("removeLayer drops by id and keeps input/output", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    const linId = g.nodes[1].id;
    const g2 = removeLayer(g, linId);
    expect(g2.nodes.map((n) => n.type)).toEqual(["input", "output"]);
  });

  test("updateParams sets a numeric param", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    const linId = g.nodes[1].id;
    const g2 = updateParams(g, linId, { out_features: 32 });
    expect(g2.nodes[1].params.out_features).toBe(32);
  });

  test("chainEdges connects consecutive nodes", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    const edges = chainEdges(g.nodes);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ source: g.nodes[0].id, target: g.nodes[1].id });
  });
});
