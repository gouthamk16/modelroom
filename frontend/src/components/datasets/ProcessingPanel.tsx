import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { PipelineStep, PreparationSummary } from "../../lib/types";

const STEP_TYPES = ["drop_nulls", "impute", "standardize", "minmax", "one_hot"];

export function ProcessingPanel({
  datasetId,
  columns,
}: {
  datasetId: number;
  columns: string[];
}) {
  const [target, setTarget] = useState("");
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [summary, setSummary] = useState<PreparationSummary | null>(null);

  const apply = useMutation({
    mutationFn: async () => {
      await api.savePipeline(datasetId, {
        target,
        steps,
        train_ratio: 0.7,
        val_ratio: 0.15,
        seed: 42,
      });
      return api.applyPipeline(datasetId);
    },
    onSuccess: setSummary,
  });

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col gap-sm">
      <h3 className="text-headline-sm font-bold text-on-surface">Data Processing</h3>

      <label className="text-label-md uppercase text-on-surface-variant" htmlFor="target">
        Target
      </label>
      <select
        id="target"
        aria-label="Target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm"
      >
        <option value="">Select target…</option>
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-xs">
        {steps.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between border border-outline-variant rounded px-3 py-2 bg-surface-container-low"
          >
            <span className="text-body-sm font-medium">
              {i + 1}. {s.type}
            </span>
            <button
              onClick={() => setSteps(steps.filter((_, j) => j !== i))}
              className="text-on-surface-variant hover:text-error material-symbols-outlined text-[18px]"
            >
              close
            </button>
          </div>
        ))}
      </div>

      <select
        aria-label="Add step"
        value=""
        onChange={(e) => {
          if (e.target.value) setSteps([...steps, { type: e.target.value, params: {} }]);
        }}
        className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm"
      >
        <option value="">+ Add step</option>
        {STEP_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <button
        disabled={!target || apply.isPending}
        onClick={() => apply.mutate()}
        className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold text-body-sm hover:brightness-110 disabled:opacity-50"
      >
        Apply Pipeline
      </button>

      {summary && (
        <div className="border-t border-outline-variant pt-sm mt-xs text-body-sm text-on-surface">
          <div className="text-label-md uppercase text-on-surface-variant mb-xs">Result</div>
          <div>
            {summary.task} · {summary.n_features} features
            {summary.task === "classification" ? ` · ${summary.n_classes} classes` : ""}
          </div>
          <div className="text-on-surface-variant">
            {summary.splits.train} train · {summary.splits.val} val · {summary.splits.test} test
          </div>
        </div>
      )}
    </div>
  );
}
