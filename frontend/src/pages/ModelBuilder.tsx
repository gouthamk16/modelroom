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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { fromGraphPayload, makeNode, toGraphPayload } from "../lib/graph";
import type { LayerNode as LayerNodeT } from "../lib/graph";
import type { LayerType, ModelSummary, ShapeReport } from "../lib/types";
import { LayerNode } from "../components/builder/LayerNode";
import { PropertiesPanel } from "../components/builder/PropertiesPanel";
import { TrainPanel } from "../components/training/TrainPanel";
import { RunView } from "../components/training/RunView";

const PALETTE: LayerType[] = ["linear", "relu", "dropout", "batchnorm1d"];
const nodeTypes = { layer: LayerNode };

export function ModelBuilder({
  model,
  datasetName,
  onBack,
}: {
  model: ModelSummary;
  datasetName?: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const initial = useMemo(() => fromGraphPayload(model.graph), [model.graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<LayerNodeT>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ShapeReport | null>(null);
  const [trainOpen, setTrainOpen] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);

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
    mutationFn: () => api.updateModel(model.id, { graph: toGraphPayload(nodes, edges, null) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["models", model.project_id] }),
  });

  const addNode = (type: LayerType) =>
    setNodes((nds) => [...nds, makeNode(type, { x: 240, y: 300 + nds.length * 8 })]);
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

  if (runId !== null) {
    return <RunView runId={runId} onBack={() => setRunId(null)} />;
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-md h-[calc(100vh-8rem)]">
      {trainOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-md"
          onClick={() => setTrainOpen(false)}
        >
          <div className="w-[460px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <TrainPanel
              modelId={model.id}
              onStarted={(rid) => {
                setTrainOpen(false);
                setRunId(rid);
              }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-sm min-h-0">
        <div className="flex items-center gap-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Models
          </button>
          <div className="ml-1">
            <span className="text-headline-sm font-bold text-on-surface">{model.name}</span>
            <span className="text-label-sm text-on-surface-variant ml-2">
              {datasetName ? `· ${datasetName}` : "· no dataset"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-sm">
            <button
              onClick={() => validate.mutate()}
              className="px-5 py-1.5 border border-primary text-primary rounded-full text-body-sm font-semibold hover:bg-primary/5"
            >
              Validate Architecture
            </button>
            <button
              onClick={() => save.mutate()}
              className="px-5 py-1.5 border border-outline-variant text-on-surface rounded-full text-body-sm font-semibold hover:bg-surface-variant/50"
            >
              {save.isSuccess ? "Saved" : "Save Model"}
            </button>
            <button onClick={() => setTrainOpen(true)} className="btn-primary px-5 py-1.5 text-body-sm">
              Train
            </button>
          </div>
        </div>

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
          <span className="text-label-sm text-on-surface-variant ml-1">
            Drag to arrange · drag from a port to connect · select + Backspace to delete
          </span>
        </div>

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
