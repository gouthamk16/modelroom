import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";

function selectedDevices(): string[] {
  try {
    const v = localStorage.getItem("modelroom.devices");
    const ids = v ? (JSON.parse(v) as string[]) : [];
    return ids.length ? ids : ["cpu"];
  } catch {
    return ["cpu"];
  }
}

export function TrainPanel({
  modelId,
  onStarted,
}: {
  modelId: number;
  onStarted: (runId: number) => void;
}) {
  const [optimizer, setOptimizer] = useState("adam");
  const [lr, setLr] = useState(0.001);
  const [epochs, setEpochs] = useState(20);
  const [batch, setBatch] = useState(32);

  const start = useMutation({
    mutationFn: () =>
      api.createRun(modelId, {
        optimizer,
        lr,
        epochs,
        batch_size: batch,
        devices: selectedDevices(),
      }),
    onSuccess: (run) => onStarted(run.id),
  });

  const devices = selectedDevices();

  return (
    <div className="border border-outline-variant rounded-xl p-md bg-surface-container-lowest flex flex-col gap-sm">
      <h3 className="text-headline-sm font-bold text-on-surface">Train model</h3>
      <div className="grid grid-cols-2 gap-sm">
        <label className="flex flex-col gap-xs text-label-md uppercase text-on-surface-variant">
          Optimizer
          <select
            value={optimizer}
            onChange={(e) => setOptimizer(e.target.value)}
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm normal-case text-on-surface"
          >
            <option value="adam">adam</option>
            <option value="sgd">sgd</option>
          </select>
        </label>
        <label className="flex flex-col gap-xs text-label-md uppercase text-on-surface-variant">
          Learning rate
          <input
            type="number"
            step="0.0001"
            value={lr}
            onChange={(e) => setLr(Number(e.target.value))}
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm text-on-surface"
          />
        </label>
        <label className="flex flex-col gap-xs text-label-md uppercase text-on-surface-variant">
          Epochs
          <input
            type="number"
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm text-on-surface"
          />
        </label>
        <label className="flex flex-col gap-xs text-label-md uppercase text-on-surface-variant">
          Batch size
          <input
            type="number"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm text-on-surface"
          />
        </label>
      </div>
      <div className="text-label-sm text-on-surface-variant">
        Device(s): {devices.join(", ")} — change in the status bar.
      </div>
      {start.isError && (
        <div className="text-body-sm text-error">
          {(start.error as Error).message.includes("400")
            ? "This model's dataset needs an applied preprocessing pipeline first (Datasets → Apply Pipeline)."
            : "Could not start training."}
        </div>
      )}
      <button
        disabled={start.isPending}
        onClick={() => start.mutate()}
        className="btn-primary px-6 py-2.5 text-body-sm self-start"
      >
        Start training
      </button>
    </div>
  );
}
