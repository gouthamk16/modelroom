import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Connection, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { initialFlow, makeNode, toGraphPayload } from "../lib/graph";
import type { LayerNode as LayerNodeT } from "../lib/graph";
import type { LayerType, ShapeReport } from "../lib/types";
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

  const initial = useMemo(() => initialFlow(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<LayerNodeT>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ShapeReport | null>(null);

  const validate = useMutation({
    mutationFn: () => api.validateModel(toGraphPayload(nodes, edges, null)),
    onSuccess: (rep) => {
      setReport(rep);
      const byId = Object.fromEntries(rep.nodes.map((n) => [n.id, n]));
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, outShape: byId[n.id]?.out_shape, error: byId[n.id]?.error },
        }))
      );
    },
  });
  const save = useMutation({
    mutationFn: () => api.saveModel(projectId!, "mlp", toGraphPayload(nodes, edges, null)),
  });

  const addNode = (type: LayerType) =>
    setNodes((nds) => [...nds, makeNode(type, { x: 220, y: 300 + nds.length * 8 })]);

  const onConnect = (c: Connection) => setEdges((eds) => addEdge(c, eds));

  const updateParams = (id: string, params: Record<string, number>) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } } : n
      )
    );

  const removeNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selected = selectedNode
    ? { id: selectedNode.id, type: selectedNode.data.type, params: selectedNode.data.params }
    : null;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-md h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-sm min-h-0">
        <div className="flex items-center gap-sm flex-wrap">
          {PALETTE.map((t) => (
            <button
              key={t}
              onClick={() => addNode(t)}
              className="px-4 py-1.5 border border-outline-variant rounded-full text-body-sm hover:border-primary hover:text-primary transition-colors"
            >
              + {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-sm">
            <button
              onClick={() => validate.mutate()}
              className="px-5 py-1.5 border border-primary text-primary rounded-full text-body-sm font-semibold hover:bg-primary/5"
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

        <p className="text-label-sm text-on-surface-variant">
          Drag layers to arrange · drag from a port to connect · select + Backspace to delete.
          {!projectId && " Create a project to enable saving."}
        </p>

        <div className="flex-1 min-h-0 border border-outline-variant rounded-lg bg-surface-container-low overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
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
        <PropertiesPanel node={selected} onChange={updateParams} onRemove={removeNode} />
      </div>
    </div>
  );
}
