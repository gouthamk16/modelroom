import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  addLayer,
  chainEdges,
  defaultGraph,
  removeLayer,
  updateParams,
} from "../lib/graph";
import type { GraphNode, LayerType, ShapeReport } from "../lib/types";
import { LayerNode } from "../components/builder/LayerNode";
import { PropertiesPanel } from "../components/builder/PropertiesPanel";

const PALETTE: LayerType[] = ["linear", "relu", "dropout", "batchnorm1d"];
const nodeTypes = { layer: LayerNode };

export function ModelBuilder() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
  const projectId = projects[0]?.id ?? null;

  const [graph, setGraph] = useState(() => defaultGraph(8, 2));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ShapeReport | null>(null);

  const validate = useMutation({
    mutationFn: () => api.validateModel(graph),
    onSuccess: setReport,
  });
  const save = useMutation({
    mutationFn: () => api.saveModel(projectId!, "mlp", graph),
  });

  const reportById = useMemo(
    () => Object.fromEntries((report?.nodes ?? []).map((n) => [n.id, n])),
    [report]
  );

  const flowNodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: "layer",
    position: { x: i * 220, y: 80 },
    data: {
      type: n.type,
      params: n.params,
      outShape: reportById[n.id]?.out_shape,
      error: reportById[n.id]?.error,
    },
  }));
  const flowEdges: Edge[] = chainEdges(graph.nodes).map((e) => ({ ...e, animated: true }));

  const selected: GraphNode | null =
    graph.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-md h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-sm">
        <div className="flex items-center gap-sm">
          {PALETTE.map((t) => (
            <button
              key={t}
              onClick={() => setGraph((g) => addLayer(g, t))}
              className="px-4 py-1.5 border border-outline-variant rounded-full text-body-sm hover:border-primary hover:text-primary"
            >
              + {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-sm">
            <button
              onClick={() => validate.mutate()}
              className="px-5 py-1.5 border border-primary text-primary rounded-full text-body-sm font-semibold"
            >
              Validate Architecture
            </button>
            <button
              disabled={!projectId}
              onClick={() => save.mutate()}
              className="btn-primary px-5 py-1.5 text-body-sm"
            >
              Save Model
            </button>
          </div>
        </div>

        <div className="flex-1 border border-outline-variant rounded-lg bg-surface-container-low overflow-hidden">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {report && (
          <div
            className={
              "rounded-lg border px-md py-sm text-body-sm " +
              (report.valid
                ? "border-primary/40 bg-primary-container/10 text-on-surface"
                : "border-error/40 bg-error/5 text-error")
            }
          >
            {report.valid ? (
              <span>Valid · {report.total_params.toLocaleString()} parameters</span>
            ) : (
              <span>{report.errors.join(" · ")}</span>
            )}
          </div>
        )}
      </div>

      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-y-auto">
        <PropertiesPanel
          node={selected}
          onChange={(id, params) => setGraph((g) => updateParams(g, id, params))}
          onRemove={(id) => {
            setGraph((g) => removeLayer(g, id));
            setSelectedId(null);
          }}
        />
      </div>
    </div>
  );
}
