import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Histogram as HistogramData } from "../../lib/types";

export function Histogram({ data }: { data: HistogramData }) {
  const rows =
    data.kind === "numeric"
      ? (data.bins ?? []).map((b) => ({
          label: `${b.start.toFixed(1)}–${b.end.toFixed(1)}`,
          count: b.count,
        }))
      : (data.bars ?? []).map((b) => ({ label: b.value, count: b.count }));

  return (
    <div className="border border-outline-variant rounded-lg p-md bg-surface-container-lowest h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} height={50} />
          <YAxis tick={{ fontSize: 10 }} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="#a63b21" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
