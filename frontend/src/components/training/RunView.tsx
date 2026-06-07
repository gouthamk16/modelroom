import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import { useRunStream } from "../../lib/useRunStream";
import type { Run, RunMetricPoint } from "../../lib/types";

const STATUS_STYLE: Record<string, string> = {
  running: "bg-primary-container/20 text-primary",
  paused: "bg-surface-variant text-on-surface-variant",
  completed: "bg-primary-container/20 text-primary",
  failed: "bg-error/10 text-error",
  stopped: "bg-surface-variant text-on-surface-variant",
  queued: "bg-surface-variant text-on-surface-variant",
};

function Chart({
  title,
  data,
  lines,
}: {
  title: string;
  data: RunMetricPoint[];
  lines: { key: string; color: string; label: string }[];
}) {
  return (
    <div className="border border-outline-variant rounded-lg p-md bg-surface-container-lowest h-64">
      <div className="text-label-md uppercase text-on-surface-variant mb-xs">{title}</div>
      <ResponsiveContainer width="100%" height="88%">
        <LineChart data={data}>
          <CartesianGrid strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RunView({ runId, onBack }: { runId: number; onBack: () => void }) {
  const { data: run } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId),
    refetchInterval: (q) => {
      const s = (q.state.data as Run | undefined)?.status;
      return s === "running" || s === "paused" ? 1000 : false;
    },
  });
  const active = run?.status === "running";
  const { metrics } = useRunStream(runId, active);
  const status = run?.status ?? "queued";

  return (
    <div className="flex flex-col gap-md h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <span className="text-headline-sm font-bold text-on-surface ml-1">Run #{runId}</span>
        <span
          className={
            "px-3 py-1 rounded-full text-label-sm uppercase font-semibold " +
            (STATUS_STYLE[status] ?? "")
          }
        >
          {status}
        </span>
        <div className="ml-auto flex items-center gap-sm">
          {status === "running" && (
            <button
              onClick={() => api.pauseRun(runId)}
              className="px-4 py-1.5 border border-outline-variant rounded-full text-body-sm hover:border-primary hover:text-primary"
            >
              Pause
            </button>
          )}
          {status === "paused" && (
            <button onClick={() => api.resumeRun(runId)} className="btn-primary px-4 py-1.5 text-body-sm">
              Resume
            </button>
          )}
          {(status === "running" || status === "paused") && (
            <button
              onClick={() => api.stopRun(runId)}
              className="px-4 py-1.5 border border-error/40 text-error rounded-full text-body-sm hover:bg-error/10"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <Chart
          title="Loss"
          data={metrics}
          lines={[
            { key: "train_loss", color: "#a63b21", label: "train" },
            { key: "val_loss", color: "#e86b4d", label: "val" },
          ]}
        />
        <Chart
          title="Validation accuracy"
          data={metrics}
          lines={[{ key: "val_acc", color: "#a63b21", label: "val_acc" }]}
        />
      </div>

      <div className="flex-1 min-h-0 border border-outline-variant rounded-lg bg-inverse-surface/95 overflow-auto p-sm">
        <pre className="text-label-sm text-inverse-on-surface whitespace-pre-wrap font-mono">
          {run?.log || "Waiting for logs…"}
        </pre>
      </div>
    </div>
  );
}
