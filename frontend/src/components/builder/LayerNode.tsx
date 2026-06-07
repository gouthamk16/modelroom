import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { LayerNodeData } from "../../lib/graph";

const LABELS: Record<string, string> = {
  input: "INPUT",
  linear: "LINEAR",
  relu: "RELU",
  dropout: "DROPOUT",
  batchnorm1d: "BATCHNORM1D",
  output: "OUTPUT",
};

export function LayerNode({ data, selected }: NodeProps) {
  const d = data as LayerNodeData;
  const accent = d.type === "input" || d.type === "output";
  return (
    <div
      className={
        "rounded-lg border bg-surface-container-lowest shadow-sm min-w-[150px] " +
        (d.error
          ? "border-error"
          : selected
            ? "border-primary"
            : accent
              ? "border-primary/40"
              : "border-outline-variant")
      }
    >
      <Handle type="target" position={Position.Left} />
      <div className="px-3 py-2 border-b border-outline-variant flex items-center justify-between">
        <span className="text-label-md uppercase text-primary">{LABELS[d.type] ?? d.type}</span>
      </div>
      <div className="px-3 py-2 text-label-sm text-on-surface-variant">
        {Object.entries(d.params).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span>{k}</span>
            <span className="text-on-surface font-medium">{v}</span>
          </div>
        ))}
        {d.outShape && (
          <div className="mt-1 pt-1 border-t border-outline-variant/60 text-[10px]">
            → [{d.outShape.join(", ")}]
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
