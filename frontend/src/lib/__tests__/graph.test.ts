import { describe, expect, test } from "vitest";
import { makeNode, initialFlow, toGraphPayload } from "../graph";

describe("graph helpers", () => {
  test("initialFlow has input and output connected", () => {
    const { nodes, edges } = initialFlow();
    expect(nodes.map((n) => n.data.type)).toEqual(["input", "output"]);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: "input", target: "output" });
    expect(nodes[0].deletable).toBe(false);
  });

  test("makeNode gives unique ids, default params, and is deletable", () => {
    const a = makeNode("linear", { x: 0, y: 0 });
    const b = makeNode("linear", { x: 0, y: 0 });
    expect(a.id).not.toBe(b.id);
    expect(a.data.params.out_features).toBe(16);
    expect(a.deletable).toBe(true);
  });

  test("toGraphPayload maps nodes (with positions), edges, and input features", () => {
    const { nodes, edges } = initialFlow();
    const payload = toGraphPayload(nodes, edges, 12);
    expect(payload.input_features).toBe(12);
    expect(payload.nodes[0]).toMatchObject({ id: "input", type: "input", x: 60, y: 160 });
    expect(payload.edges).toEqual([{ source: "input", target: "output" }]);
  });
});
