import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { RunMetricPoint } from "./types";

// Live training metrics: seed from the run's persisted history, then append
// points pushed over the WebSocket. Closes on "done".
export function useRunStream(runId: number, active: boolean) {
  const [metrics, setMetrics] = useState<RunMetricPoint[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    api.getRun(runId).then((r) => {
      if (!cancelled) setMetrics(r.metrics ?? []);
    });

    if (active) {
      ws = new WebSocket(`ws://${location.host}/api/runs/${runId}/stream`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "metric") {
          setMetrics((m) =>
            m.some((p) => p.epoch === msg.data.epoch) ? m : [...m, msg.data]
          );
        }
        if (msg.type === "done") setDone(true);
      };
    }

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [runId, active]);

  return { metrics, done };
}
