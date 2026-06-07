import type { Correlation } from "../../lib/types";

function cellColor(v: number): string {
  const a = Math.min(1, Math.abs(v));
  return v >= 0 ? `rgba(166, 59, 33, ${a})` : `rgba(93, 94, 96, ${a})`;
}

export function CorrelationHeatmap({ correlation }: { correlation: Correlation }) {
  const { columns, matrix } = correlation;
  if (columns.length < 2) return null;
  return (
    <div className="border border-outline-variant rounded-lg p-md bg-surface-container-lowest overflow-x-auto">
      <h3 className="text-label-md uppercase text-on-surface-variant mb-sm">Correlation</h3>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `120px repeat(${columns.length}, 48px)` }}
      >
        <div />
        {columns.map((c) => (
          <div
            key={`h-${c}`}
            className="text-label-sm text-on-surface-variant text-center truncate"
          >
            {c}
          </div>
        ))}
        {matrix.map((row, i) => (
          <div key={`r-${i}`} className="contents">
            <div className="text-label-sm text-on-surface-variant truncate pr-2 text-right self-center">
              {columns[i]}
            </div>
            {row.map((v, j) => (
              <div
                key={`c-${i}-${j}`}
                className="h-12 flex items-center justify-center text-[10px] rounded"
                style={{ backgroundColor: cellColor(v) }}
                title={`${columns[i]} × ${columns[j]}: ${v}`}
              >
                {v}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
