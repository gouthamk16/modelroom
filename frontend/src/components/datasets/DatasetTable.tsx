import type { Preview, SchemaColumn } from "../../lib/types";

export function PreviewTable({ preview }: { preview: Preview }) {
  return (
    <div className="overflow-x-auto border border-outline-variant rounded-lg bg-surface-container-lowest">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-on-surface-variant">
            {preview.columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, i) => (
            <tr key={i} className="border-b border-outline-variant/50">
              {preview.columns.map((c) => (
                <td key={c} className="px-3 py-2 text-on-surface">
                  {row[c] === null || row[c] === undefined ? "—" : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchemaList({ schema }: { schema: SchemaColumn[] }) {
  const maxRows = Math.max(1, ...schema.map((c) => c.n_null + c.n_unique));
  return (
    <div className="flex flex-col gap-xs">
      {schema.map((c) => (
        <div
          key={c.name}
          className="flex items-center justify-between border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest"
        >
          <div className="flex items-center gap-2">
            <span
              className={
                "w-2 h-2 rounded-full " +
                (c.kind === "numeric" ? "bg-primary" : "bg-primary-container")
              }
            />
            <span className="font-medium text-on-surface">{c.name}</span>
            <span className="text-label-sm text-on-surface-variant">{c.dtype}</span>
          </div>
          <div className="flex items-center gap-md text-label-sm text-on-surface-variant">
            <span>{c.n_unique} unique</span>
            <span title="missing values">
              {c.n_null > 0 ? `${Math.round((c.n_null / maxRows) * 100)}% null` : "no nulls"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
