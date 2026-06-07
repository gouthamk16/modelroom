export interface SelectedLayer {
  id: string;
  type: string;
  params: Record<string, number>;
}

export function PropertiesPanel({
  node,
  onChange,
  onRemove,
}: {
  node: SelectedLayer | null;
  onChange: (id: string, params: Record<string, number>) => void;
  onRemove: (id: string) => void;
}) {
  if (!node) {
    return (
      <div className="text-body-sm text-on-surface-variant p-md">
        Select a layer to edit its properties.
      </div>
    );
  }

  const editable = node.type !== "relu";
  const removable = node.type !== "input" && node.type !== "output";

  return (
    <div className="flex flex-col gap-sm p-md">
      <div>
        <h3 className="text-headline-sm font-bold text-on-surface">{node.type}</h3>
        <p className="text-label-sm text-on-surface-variant uppercase">{node.id}</p>
      </div>

      {editable &&
        Object.entries(node.params).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-xs">
            <label htmlFor={key} className="text-label-md uppercase text-on-surface-variant">
              {key}
            </label>
            <input
              id={key}
              aria-label={key}
              type="number"
              value={value}
              step={key === "p" ? 0.05 : 1}
              onChange={(e) => onChange(node.id, { [key]: Number(e.target.value) })}
              className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}

      {node.type === "relu" && (
        <p className="text-body-sm text-on-surface-variant">No parameters.</p>
      )}

      {removable && (
        <button
          onClick={() => onRemove(node.id)}
          className="mt-sm text-error border border-error/40 rounded-full px-4 py-1.5 text-body-sm hover:bg-error/10"
        >
          Remove layer
        </button>
      )}
    </div>
  );
}
