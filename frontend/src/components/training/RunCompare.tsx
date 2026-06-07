import { useQueries } from "@tanstack/react-query";
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

const COLORS = ["#a63b21", "#e86b4d", "#5d5e60", "#8b716b", "#ba1a1a"];

export function RunCompare({ runIds, onClose }: { runIds: number[]; onClose: () => void }) {
  const results = useQueries({
    queries: runIds.map((id) => ({ queryKey: ["run", id], queryFn: () => api.getRun(id) })),
  });
  const runs = results.map((r) => r.data).filter((r) => r != null);

  // merge val_acc by epoch into rows: { epoch, run_<id>: acc }
  const epochs = new Set<number>();
  runs.forEach((r) => (r!.metrics ?? []).forEach((m) => epochs.add(m.epoch)));
  const rows = [...epochs]
    .sort((a, b) => a - b)
    .map((epoch) => {
      const row: Record<string, number> = { epoch };
      runs.forEach((r) => {
        const m = (r!.metrics ?? []).find((p) => p.epoch === epoch);
        if (m) row[`run_${r!.id}`] = m.val_acc;
      });
      return row;
    });

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Jobs
        </button>
        <h3 className="text-headline-sm font-bold text-on-surface ml-1">Compare runs</h3>
      </div>

      <div className="border border-outline-variant rounded-lg p-md bg-surface-container-lowest h-72">
        <div className="text-label-md uppercase text-on-surface-variant mb-xs">
          Validation accuracy
        </div>
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={rows}>
            <CartesianGrid strokeOpacity={0.12} vertical={false} />
            <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={40} />
            <Tooltip />
            {runs.map((r, i) => (
              <Line
                key={r!.id}
                type="monotone"
                dataKey={`run_${r!.id}`}
                name={`Run #${r!.id}`}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full text-body-sm border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
        <thead>
          <tr className="border-b border-outline-variant text-on-surface-variant text-label-sm uppercase">
            <th className="text-left px-3 py-2">Run</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Epochs</th>
            <th className="text-left px-3 py-2">Best val acc</th>
            <th className="text-left px-3 py-2">Final val loss</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r!.id} className="border-b border-outline-variant/50">
              <td className="px-3 py-2 font-medium text-on-surface">#{r!.id}</td>
              <td className="px-3 py-2 text-on-surface-variant">{r!.status}</td>
              <td className="px-3 py-2 text-on-surface-variant">{r!.summary.epochs ?? "—"}</td>
              <td className="px-3 py-2 text-on-surface">
                {r!.summary.best_val_acc != null ? r!.summary.best_val_acc.toFixed(4) : "—"}
              </td>
              <td className="px-3 py-2 text-on-surface-variant">
                {r!.summary.final_val_loss != null ? r!.summary.final_val_loss.toFixed(4) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
